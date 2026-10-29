/** ── LETTURA DELLO STATO DEL PONTE (avviso «il ponte è fermo») ──────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T8. Legge la riga
 *  dell'utente in `ponte_wa_stato` e ne ricava l'avviso (`avvisoPonte`).
 *
 *  Stesso passo di `useDaRispondere`, per lo stesso motivo: costa poco e non
 *  rompe niente. Una lettura all'apertura, una al minuto, una quando la scheda
 *  torna visibile; a scheda nascosta niente. Nessun realtime.
 *  Errore, rete assente, tabella non ancora creata (migrazione non applicata),
 *  permessi → nessun avviso: la pagina non mostra mai un errore per colpa di
 *  questa lettura. Vale anche dopo una lettura buona: un avviso come «da 12
 *  minuti» invecchierebbe, quindi con un errore si toglie.
 *  Nei log non scrive niente. */
import { useEffect, useState } from "react";
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

/** L'avviso da mostrare adesso; `nessuna` finché non si sa o se qualcosa va storto. */
export function useStatoPonte(): AvvisoPonte {
  const { user } = useAuth();
  const userId = user?.id;
  const [avviso, setAvviso] = useState<AvvisoPonte>(NIENTE);

  useEffect(() => {
    if (!userId) {
      setAvviso(NIENTE);
      return;
    }
    let vivo = true;
    let inCorso = false;

    const aggiorna = async () => {
      if (inCorso || document.visibilityState === "hidden") return;
      inCorso = true;
      let nuovo = NIENTE;
      try {
        const { data, error } = await (supabase as unknown as { from: (t: string) => Catena })
          .from("ponte_wa_stato")
          .select("stato,aggiornato_il,storico")
          .eq("user_id", userId)
          .maybeSingle();
        if (!error) nuovo = avvisoPonte(data, new Date());
      } catch {
        //  rete o permessi: nessun avviso
      }
      inCorso = false;
      if (vivo) setAvviso(nuovo);
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

  return avviso;
}
