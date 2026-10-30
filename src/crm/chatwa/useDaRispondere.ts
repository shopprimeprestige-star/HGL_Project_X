/** ── IL NUMERETTO «DA RISPONDERE» DEL MENU ─────────────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM), T12 / D25. Dice quante chat
 *  aspettano una risposta, per la voce WhatsApp della barra laterale.
 *
 *  PERCHÉ È FATTO COSÌ
 *  La barra è su ogni pagina del CRM: il costo di questo numero lo paga tutto il
 *  giorno chiunque, anche chi non apre mai la chat. Quindi:
 *   · legge poche colonne (entrata, risposto, ultimo messaggio e sua direzione) e solo
 *     dei contatti che hanno già scritto almeno una volta;
 *   · NESSUN realtime: una lettura all'apertura, una al minuto, una quando la
 *     finestra torna visibile. A scheda nascosta non legge niente;
 *   · il criterio NON è scritto qui: è `contaDaRispondere` di ./stato, la stessa
 *     regola che decide la lista della pagina. ⚠️ Ma l'INSIEME è più stretto: il
 *     menu legge solo i contatti con le colonne nuove, la pagina ripiega anche
 *     sui messaggi caricati (senza limite di età dal 30/10). Nei primi giorni dopo la
 *     migrazione il menu può dire meno della pagina, finché i clienti non
 *     riscrivono: non è un errore di conto, è l'insieme;
 *   · non può mai rompere il menu né mostrare un errore: colonne non ancora
 *     create (migrazione non applicata), rete assente, permessi → nessun
 *     numero nuovo. Si tiene l'ULTIMO valore buono (0 se non ce n'è mai stato):
 *     un giro di rete fallito non deve far sparire il badge dicendo «nessuna
 *     chat» quando ce ne sono.
 *  `attivo` è falso per chi non vede la voce WhatsApp: niente lettura inutile.
 *
 *  Nei log non scrive niente (né numeri, né nomi, né testi). */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../AuthContext";
import type { WaContactRow } from "./tipi";
import { colonnaMancante, contaDaRispondere } from "./stato";

/** Ogni quanto si rilegge, a finestra visibile. */
const OGNI_MS = 60_000;
/** Il tetto di righe per richiesta di Supabase è 1000: si legge a pagine. */
const PAGINA = 1000;
/** shortcut: al massimo 5000 contatti con messaggi in entrata, oltre il numero
 *  si ferma lì (sotto-stima); quando succede, passare a un conteggio sul server. */
const MAX_PAGINE = 5;

/** Le ultime due servono a vedere se l'ultimo messaggio è NOSTRO (regola del 30/10/2026). */
const COLONNE_BASE = "id,ultimo_in_entrata_il,risposto_il,ultimo_in_entrata_anteprima";
const COLONNE = `${COLONNE_BASE},ultimo_messaggio_il,ultimo_messaggio_direzione`;

type Riga = Pick<
  WaContactRow,
  | "id"
  | "ultimo_in_entrata_il"
  | "risposto_il"
  | "ultimo_in_entrata_anteprima"
  | "ultimo_messaggio_il"
  | "ultimo_messaggio_direzione"
>;

/** La catena di Supabase, ridotta ai soli metodi usati qui (come in useChatWa). */
interface Catena {
  select: (s: string) => Catena;
  eq: (k: string, v: string) => Catena;
  not: (k: string, op: string, v: null) => Catena;
  order: (k: string) => Catena;
  range: (da: number, a: number) => Promise<{ data: Riga[] | null; error: unknown }>;
}

/** La lettura vera: una pagina di righe, `null` se il database dice no. */
type LeggiPagina = (da: number, a: number) => Promise<Riga[] | null>;

/** Quante chat sono in attesa, leggendo tutte le pagine; `null` a qualunque errore. */
export async function contaDalDatabase(leggi: LeggiPagina, adesso: Date): Promise<number | null> {
  try {
    const righe: Riga[] = [];
    for (let p = 0; p < MAX_PAGINE; p++) {
      const pagina = await leggi(p * PAGINA, (p + 1) * PAGINA - 1);
      if (!pagina) return null;
      righe.push(...pagina);
      if (pagina.length < PAGINA) break;
    }
    return contaDaRispondere(righe, adesso);
  } catch {
    return null;
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
      const pagina = (colonne: string) =>
        (supabase as unknown as { from: (t: string) => Catena })
          .from("whatsapp_contacts")
          .select(colonne)
          .eq("user_id", userId)
          .not("ultimo_in_entrata_il", "is", null)
          .order("id")
          .range(da, a);
      const r = await pagina(COLONNE);
      //  Migrazione dell'ultimo messaggio non applicata: si conta come prima (solo `risposto_il`).
      if (r.error && colonnaMancante(r.error as { code?: string; message: string }))
        return (await pagina(COLONNE_BASE)).data;
      return r.error ? null : r.data;
    };

    //  Una lettura alla volta: se la rete è lenta e un'altra scatta, si salta.
    let inCorso = false;
    const aggiorna = async () => {
      if (inCorso || document.visibilityState === "hidden") return;
      inCorso = true;
      const conto = await contaDalDatabase(leggi, new Date());
      inCorso = false;
      //  `null` = lettura fallita: si tiene il numero di prima.
      if (vivo && conto !== null) setN(conto);
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
