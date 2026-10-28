/** ── IL NUMERETTO «DA RISPONDERE» DEL MENU ─────────────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM), T12 / D25. Dice quante chat
 *  aspettano una risposta, per la voce WhatsApp della barra laterale.
 *
 *  PERCHÉ È FATTO COSÌ
 *  La barra è su ogni pagina del CRM: il costo di questo numero lo paga tutto il
 *  giorno chiunque, anche chi non apre mai la chat. Quindi:
 *   · legge SOLO tre colonne (`id`, `ultimo_in_entrata_il`, `risposto_il`) e solo
 *     dei contatti che hanno già scritto almeno una volta;
 *   · NESSUN realtime: una lettura all'apertura, una al minuto, una quando la
 *     finestra torna visibile. A scheda nascosta non legge niente;
 *   · il criterio NON è scritto qui: è `contaDaRispondere` di ./stato, la stessa
 *     funzione che decide la lista della pagina, così menu e pagina non dicono
 *     due cifre;
 *   · non può mai rompere il menu né mostrare un errore: colonne non ancora
 *     create (migrazione non applicata), rete assente, permessi → 0, cioè
 *     nessun numeretto. Un numero mancante è meno grave di una barra rotta.
 *  `attivo` è falso per chi non vede la voce WhatsApp: niente lettura inutile.
 *
 *  Nei log non scrive niente (né numeri, né nomi, né testi). */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../AuthContext";
import type { WaContactRow } from "./tipi";
import { contaDaRispondere } from "./stato";

/** Ogni quanto si rilegge, a finestra visibile. */
const OGNI_MS = 60_000;
/** Il tetto di righe per richiesta di Supabase è 1000: si legge a pagine. */
const PAGINA = 1000;
/** shortcut: al massimo 5000 contatti con messaggi in entrata, oltre il numero
 *  si ferma lì (sotto-stima); quando succede, passare a un conteggio sul server. */
const MAX_PAGINE = 5;

type Riga = Pick<WaContactRow, "id" | "ultimo_in_entrata_il" | "risposto_il">;

/** La lettura vera: una pagina di righe, `null` se il database dice no. */
type LeggiPagina = (da: number, a: number) => Promise<Riga[] | null>;

/** Quante chat sono in attesa, leggendo tutte le pagine; `0` a qualunque errore. */
export async function contaDalDatabase(leggi: LeggiPagina, adesso: Date): Promise<number> {
  try {
    const righe: Riga[] = [];
    for (let p = 0; p < MAX_PAGINE; p++) {
      const pagina = await leggi(p * PAGINA, (p + 1) * PAGINA - 1);
      if (!pagina) return 0;
      righe.push(...pagina);
      if (pagina.length < PAGINA) break;
    }
    return contaDaRispondere(righe, adesso);
  } catch {
    return 0;
  }
}

/** Il numero di chat in attesa per l'utente collegato; `0` finché non si sa. */
export function useDaRispondere(attivo: boolean): number {
  const { user } = useAuth();
  const [n, setN] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    if (!attivo || !userId) {
      setN(0);
      return;
    }
    let vivo = true;

    const leggi: LeggiPagina = async (da, a) => {
      const q = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (
              k: string,
              v: string,
            ) => {
              not: (
                k: string,
                op: string,
                v: null,
              ) => {
                order: (k: string) => {
                  range: (
                    da: number,
                    a: number,
                  ) => Promise<{ data: Riga[] | null; error: unknown }>;
                };
              };
            };
          };
        };
      };
      const { data, error } = await q
        .from("whatsapp_contacts")
        .select("id,ultimo_in_entrata_il,risposto_il")
        .eq("user_id", userId)
        .not("ultimo_in_entrata_il", "is", null)
        .order("id")
        .range(da, a);
      return error ? null : data;
    };

    const aggiorna = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const conto = await contaDalDatabase(leggi, new Date());
      if (vivo) setN(conto);
    };

    const rileggi = () => void aggiorna();
    rileggi();
    const giro = setInterval(rileggi, OGNI_MS);
    document.addEventListener("visibilitychange", rileggi);
    return () => {
      vivo = false;
      clearInterval(giro);
      document.removeEventListener("visibilitychange", rileggi);
    };
  }, [attivo, userId]);

  return n;
}
