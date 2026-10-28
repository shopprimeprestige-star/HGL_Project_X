/** ── LE STELLE DELLE CHAT IN OSSERVAZIONE (1-3) ─────────────────────────────
 *  Richiesta del titolare (28/10/2026): mettere le chat «in osservazione» con
 *  1-3 stelle di priorità, da impostare e vedere dalla lista. Le regole (chiave
 *  del numero, 0→1→2→3→0) stanno in crm/wa-orari; qui la lettura e il salvataggio
 *  in `app_config` «wa_stelle», condivisa da tutto lo studio.
 *  ⚠️ I SALVATAGGI VANNO IN FILA: tre tocchi veloci per arrivare a 3 stelle
 *   facevano partire tre «leggi, cambia, scrivi» insieme, e vinceva l'ultimo ad
 *   arrivare. Il valore nuovo si calcola sullo stato più recente (`ref`), e si
 *   rilegge prima di scrivere per non perdere le stelle di un collega. */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CHIAVE_CONFIG_STELLE,
  conStelle,
  leggiStelle,
  scriviStelle,
  stellaDopo,
  stelleDi,
  type MappaStelle,
} from "@/crm/wa-orari";

export function useStelle(): {
  stelle: MappaStelle;
  di: (telefono: string) => number;
  cambia: (telefono: string) => void;
} {
  const [stelle, setStelle] = useState<MappaStelle>({});
  const ref = useRef<MappaStelle>({});
  const coda = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let vivo = true;
    void supabase
      .from("app_config")
      .select("value")
      .eq("key", CHIAVE_CONFIG_STELLE)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        ref.current = leggiStelle(data?.value);
        setStelle(ref.current);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const cambia = useCallback((telefono: string) => {
    const prima = ref.current;
    const nuove = stellaDopo(stelleDi(prima, telefono));
    ref.current = conStelle(prima, telefono, nuove);
    setStelle(ref.current);
    coda.current = coda.current
      .then(async () => {
        const { data } = await supabase
          .from("app_config")
          .select("value")
          .eq("key", CHIAVE_CONFIG_STELLE)
          .maybeSingle();
        const mappa = conStelle(leggiStelle(data?.value), telefono, nuove);
        const { error } = await supabase.from("app_config").upsert(
          {
            key: CHIAVE_CONFIG_STELLE,
            value: scriviStelle(mappa),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );
        if (error) throw error;
      })
      .catch(() => {
        toast.error("Stelle non salvate", { description: "Riprova fra un istante." });
        //  Si torna a com'era quel numero prima del tocco, non si azzera tutto.
        ref.current = conStelle(ref.current, telefono, stelleDi(prima, telefono));
        setStelle(ref.current);
      });
  }, []);

  const di = useCallback((telefono: string) => stelleDi(stelle, telefono), [stelle]);
  return { stelle, di, cambia };
}
