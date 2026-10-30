/** ── IL NUMERETTO «DA RISPONDERE» DEL MENU ─────────────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM), T12 / D25. Dice quante chat
 *  aspettano una risposta, per la voce WhatsApp della barra laterale.
 *
 *  PERCHÉ È FATTO COSÌ
 *  La barra è su ogni pagina del CRM: il costo di questo numero lo paga tutto il
 *  giorno chiunque, anche chi non apre mai la chat. Quindi:
 *   · legge poche colonne (entrata, risposto, ultimo messaggio e sua direzione; i nostri invii
 *     `failed` solo per i pochi contatti che l'ultimo messaggio nostro toglierebbe dall'attesa: vedi
 *     ./menuDaRispondere) e solo
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
import { contaDalDatabase, type PorteMenu } from "./menuDaRispondere";

/** Ogni quanto si rilegge, a finestra visibile. */
const OGNI_MS = 60_000;

/** La catena di Supabase, ridotta ai soli metodi usati qui (come in useChatWa). */
interface Catena extends PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> {
  select: (s: string) => Catena;
  eq: (k: string, v: string) => Catena;
  not: (k: string, op: string, v: null) => Catena;
  in: (k: string, v: string[]) => Catena;
  gte: (k: string, v: string) => Catena;
  order: (k: string) => Catena;
  range: (da: number, a: number) => Catena;
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

    const tabella = (t: string) => (supabase as unknown as { from: (t: string) => Catena }).from(t);
    const porte: PorteMenu = {
      contatti: async (colonne, da, a) =>
        await tabella("whatsapp_contacts")
          .select(colonne)
          .eq("user_id", userId)
          .not("ultimo_in_entrata_il", "is", null)
          .order("id")
          .range(da, a),
      //  I nostri invii non partiti (`failed`) dei soli numeri che servono.
      fallitiDi: async (numeri, dal) => {
        const { data, error } = await tabella("whatsapp_messages")
          .select("to_number,created_at")
          .eq("user_id", userId)
          .eq("direction", "outbound")
          .eq("status", "failed")
          .in("to_number", numeri)
          .gte("created_at", dal);
        return error ? null : (data as { to_number: string; created_at: string }[] | null);
      },
    };

    //  Una lettura alla volta: se la rete è lenta e un'altra scatta, si salta.
    let inCorso = false;
    const aggiorna = async () => {
      if (inCorso || document.visibilityState === "hidden") return;
      inCorso = true;
      const conto = await contaDalDatabase(porte, new Date());
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
