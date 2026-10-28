/** ── LE RISPOSTE RAPIDE, SALVATE PER TUTTO LO STUDIO ───────────────────────
 *  Richiesta del titolare (28/10/2026): risposte rapide modificabili con la
 *  matita, condivise dallo studio. Le regole stanno in ./risposte-rapide; qui
 *  la lettura e il salvataggio in `app_config` «wa_risposte_rapide», come
 *  `useStelle` fa con «wa_stelle». Nessuna migrazione: la tabella c'è già.
 *  ⚠️ I SALVATAGGI VANNO IN FILA e ognuno rilegge il valore prima di scrivere:
 *   un collega che aggiunge una risposta mentre io ne correggo un'altra non
 *   perde la sua. Il cambio è una funzione (elenco → elenco), così si rifà
 *   sull'elenco appena riletto e non su quello che avevo in pagina. */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CHIAVE_CONFIG_RISPOSTE,
  leggiRisposte,
  ripristinate,
  scriviRisposte,
  type RispostaRapida,
} from "./risposte-rapide";

type Cambio = (elenco: RispostaRapida[]) => RispostaRapida[];

async function rileggi(): Promise<RispostaRapida[]> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", CHIAVE_CONFIG_RISPOSTE)
    .maybeSingle();
  if (error) throw error;
  return leggiRisposte(data?.value);
}

export function useRisposteRapide(): {
  risposte: RispostaRapida[];
  /** Applica un cambio (aggiungi, modifica, elimina) e lo salva in fila. */
  cambia: (cambio: Cambio) => void;
  /** Rimette i testi di partenza per tutto lo studio. */
  ripristina: () => void;
} {
  //  Finché la lettura non torna si mostrano i predefiniti: la casella non resta senza risposte.
  const [risposte, setRisposte] = useState<RispostaRapida[]>(ripristinate);
  const ref = useRef<RispostaRapida[]>(risposte);
  const coda = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let vivo = true;
    rileggi()
      .then((l) => {
        if (!vivo) return;
        ref.current = l;
        setRisposte(l);
      })
      //  Senza lettura restano i predefiniti: niente avviso, la casella funziona lo stesso.
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const cambia = useCallback((cambio: Cambio) => {
    ref.current = cambio(ref.current);
    setRisposte(ref.current);
    coda.current = coda.current
      .then(async () => {
        const salvate = await rileggi();
        const { error } = await supabase.from("app_config").upsert(
          {
            key: CHIAVE_CONFIG_RISPOSTE,
            value: scriviRisposte(cambio(salvate)),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );
        if (error) throw error;
      })
      .catch(async () => {
        toast.error("Risposte rapide non salvate", { description: "Riprova fra un istante." });
        //  Si torna a quello che c'è davvero salvato, non a un elenco che nessun altro vede.
        try {
          ref.current = await rileggi();
          setRisposte(ref.current);
        } catch {
          /* resta quello in pagina */
        }
      });
  }, []);

  const ripristina = useCallback(() => cambia(() => ripristinate()), [cambia]);

  return { risposte, cambia, ripristina };
}
