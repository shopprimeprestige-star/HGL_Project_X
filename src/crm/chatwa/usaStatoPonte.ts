/** ── LETTURA DELLO STATO DEL PONTE (avviso «il ponte è fermo») ──────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T8. Legge la riga
 *  dell'utente in `ponte_wa_stato` e ne ricava l'avviso (`avvisoPonte`).
 *  Commessa 2026-10-30-ponte-invio-manuale, T6: la lettura è `useRigaPonte`
 *  (con i `contatori`), così la riusa anche l'invio dal telefono: UNA lettura al
 *  minuto, non due. `useStatoPonte` ne ricava l'avviso.
 *
 *  Stesso passo di `useDaRispondere`, per lo stesso motivo: costa poco e non
 *  rompe niente. Una lettura all'apertura, una al minuto, una quando la scheda
 *  torna visibile; a scheda nascosta niente. Nessun realtime.
 *  Errore, rete assente, tabella non ancora creata (migrazione non applicata),
 *  permessi → nessun avviso: la pagina non mostra mai un errore per colpa di
 *  questa lettura. Vale anche dopo una lettura buona: un avviso come «da 12
 *  minuti» invecchierebbe, quindi con un errore si toglie.
 *  Nei log non scrive niente. */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../AuthContext";
import { avvisoPonte, type AvvisoPonte, type RigaStatoPonte } from "./avvisoPonte";

/** Ogni quanto si rilegge, a scheda visibile. */
const OGNI_MS = 60_000;

/** La catena di Supabase, ridotta ai soli metodi usati qui. I tipi generati
 *  non conoscono la tabella nuova: da qui il cast, come nelle porte del ponte. */
interface Catena {
  select: (s: string) => Catena;
  eq: (k: string, v: string) => Catena;
  maybeSingle: () => Promise<{ data: RigaStatoPonte | null; error: unknown }>;
}

const NIENTE: AvvisoPonte = { mostra: false, gravita: "nessuna", frase: "" };

/** La riga di stato del ponte, riletta ogni minuto; `null` finché non si sa, se
 *  non c'è, o se qualcosa va storto (rete, permessi, tabella non creata). */
export function useRigaPonte(): RigaStatoPonte | null {
  const { user } = useAuth();
  const userId = user?.id;
  const [riga, setRiga] = useState<RigaStatoPonte | null>(null);

  useEffect(() => {
    if (!userId) {
      setRiga(null);
      return;
    }
    let vivo = true;
    let inCorso = false;

    const aggiorna = async () => {
      if (inCorso || document.visibilityState === "hidden") return;
      inCorso = true;
      let nuova: RigaStatoPonte | null = null;
      try {
        const { data, error } = await (supabase as unknown as { from: (t: string) => Catena })
          .from("ponte_wa_stato")
          .select("stato,aggiornato_il,storico,contatori")
          .eq("user_id", userId)
          .maybeSingle();
        if (!error) nuova = data;
      } catch {
        //  rete o permessi: nessuna riga
      }
      inCorso = false;
      if (vivo) setRiga(nuova);
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
  }, [userId]);

  return riga;
}

/** L'avviso da mostrare adesso; `nessuna` finché non si sa o se qualcosa va storto. */
export function useStatoPonte(): AvvisoPonte {
  const riga = useRigaPonte();
  //  L'ora si guarda a ogni lettura (ogni minuto): un avviso sparisce o arriva con la riga nuova.
  return useMemo(() => (riga ? avvisoPonte(riga, new Date()) : NIENTE), [riga]);
}
