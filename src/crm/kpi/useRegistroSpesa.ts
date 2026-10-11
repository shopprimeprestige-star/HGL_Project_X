// ── LA SPESA, LETTA UNA VOLTA SOLA ──────────────────────────────────────────
//
//  ── IL DIFETTO CHE QUESTO FILE CHIUDE ─────────────────────────────────────
//  La pagina KPI conteneva DUE VOLTE gli stessi quattro numeri — costo per
//  lead, costo per cliente, ritorno sulla spesa, netto — calcolati su due spese
//  diverse: la panoramica usava solo la spesa sincronizzata da Meta più una
//  stima TikTok, «KPI manuale» solo quella scritta a mano. Stesso periodo,
//  stessa pagina, due «costo per cliente». Chi cambiava linguetta vedeva il
//  numero muoversi e concludeva che la pagina era rotta.
//
//  Adesso la spesa la costruisce `costruisciRegistroSpesa` (./spesa), UNA sola
//  volta, con una regola dichiarata in pagina; questo hook è il pezzo che le
//  procura i dati. Ogni scheda che mostra un numero in euro passa da qui e da
//  nessun'altra parte.
//
//  ⚠️ PERCHÉ UN HOOK E NON UNA LETTURA NEL CONTENITORE
//  Le schede sono componenti separati e ne vive UNA alla volta: «Chiamate» non
//  ha nessun numero in euro e non deve interrogare il database per niente.
//  Chiamandolo dentro le tre schede che la spesa la mostrano davvero, la
//  lettura avviene solo quando serve — e sempre con la stessa costruzione, che
//  è il punto.
//
//  ⚠️ TUTTI GLI HOOK STANNO SOPRA I RETURN ANTICIPATI di chi lo usa: questo
//  hook ne contiene quattro e non ha rami condizionali al suo interno.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { getAdsFinancials, syncMetaSpendNow } from "@/crm/ads-financials.functions";
import {
  creaFiltroPeriodo,
  giornoDi,
  type FiltroPeriodo,
  type Intervallo,
} from "@/crm/kpi-calcoli";
import { estremiPeriodo, type Estremi } from "@/crm/kpi/finestra";
import { costruisciRegistroSpesa, type RegistroSpesa } from "@/crm/kpi/spesa";

export interface SpesaDelPeriodo {
  /** La spesa unica del periodo, già pronta per le formule di kpi-calcoli. */
  registro: RegistroSpesa;
  /** ── IL FILTRO, NON SOLO LA SPESA ───────────────────────────────────────
   *  Esce da qui perché è LO STESSO oggetto con cui la spesa è stata tagliata.
   *  ⚠️ `creaFiltroPeriodo` fissa l'istante di riferimento QUANDO viene
   *  chiamata («30 giorni» = «dalle 30×24 ore fa a adesso»): due filtri creati
   *  in due punti diversi sono due finestre leggermente diverse, e su «oggi» o
   *  «ieri» la differenza cade proprio sul confine. Uno solo, e passa di qui. */
  dentro: FiltroPeriodo;
  /** Gli estremi della finestra, per interrogare il database e per scriverli. */
  estremi: Estremi;
  /** Quando la sincronizzazione con Meta ha letto l'ultima volta. `null` = mai,
   *  in questo periodo. */
  ultimaSync: string | null;
  caricando: boolean;
  sincronizzando: boolean;
  /** Riscarica da Meta la spesa della finestra che si sta guardando. */
  riallinea: () => void;
}

/** ── LA SPESA DEL PERIODO ──────────────────────────────────────────────────
 *  Due letture legate al periodo: la spesa Meta giorno per giorno dalla tabella
 *  `meta_ad_spend`, e il budget giornaliero TikTok dalle impostazioni. Le
 *  registrazioni scritte a mano arrivano da `CRMContext`, che le tiene già in
 *  memoria. Il resto lo fa `costruisciRegistroSpesa`. */
export function useRegistroSpesa(intervallo: Intervallo): SpesaDelPeriodo {
  const { user } = useAuth();
  const { adSpending } = useCRM();
  const fnFinanze = useServerFn(getAdsFinancials);
  const fnSync = useServerFn(syncMetaSpendNow);

  const [metaGiorni, setMetaGiorni] = useState<{ giorno: string; importo: number }[]>([]);
  const [tiktokAlGiorno, setTiktokAlGiorno] = useState(0);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [caricando, setCaricando] = useState(true);
  const [sincronizzando, setSincronizzando] = useState(false);
  /** Cambia dopo un riallineamento e fa ripartire la lettura: senza, il
   *  pulsante aggiornerebbe il database e non lo schermo. */
  const [giroDiSync, setGiroDiSync] = useState(0);

  const estremi = useMemo(() => estremiPeriodo(intervallo), [intervallo]);
  const dentro = useMemo(() => creaFiltroPeriodo(intervallo), [intervallo]);

  useEffect(() => {
    //  Senza sessione non c'è niente da leggere: si smette di dire «Leggo la
    //  spesa…» invece di restare in attesa per sempre.
    if (!user) {
      setCaricando(false);
      return;
    }
    let vivo = true;
    setCaricando(true);
    Promise.all([
      supabase
        .from("meta_ad_spend")
        .select("spend, spend_date, fetched_at")
        .eq("user_id", user.id)
        .gte("spend_date", estremi.da)
        .lte("spend_date", estremi.a),
      supabase
        .from("tracking_config")
        .select("daily_spend_tiktok")
        .eq("user_id", user.id)
        .maybeSingle(),
    ])
      .then(([spesa, cfg]) => {
        if (!vivo) return;
        //  Una riga per annuncio, più annunci nello stesso giorno: si accorpa
        //  per data, che è l'unità con cui ragionano le formule.
        const perGiorno = new Map<string, number>();
        let ultima: string | null = null;
        for (const r of spesa.data ?? []) {
          const g = giornoDi(r.spend_date);
          if (!g) continue;
          perGiorno.set(g, (perGiorno.get(g) || 0) + (Number(r.spend) || 0));
          if (!ultima || String(r.fetched_at) > ultima) ultima = String(r.fetched_at);
        }
        setMetaGiorni([...perGiorno.entries()].map(([giorno, importo]) => ({ giorno, importo })));
        setUltimaSync(ultima);
        setTiktokAlGiorno(Number(cfg.data?.daily_spend_tiktok) || 0);
        setCaricando(false);
      })
      .catch(() => {
        //  Una lettura caduta non deve lasciare la pagina a «Leggo la spesa…»
        //  per sempre: si mostra quello che c'è (le registrazioni a mano) e la
        //  copertura dirà che dei giorni sono scoperti.
        if (!vivo) return;
        setCaricando(false);
      });
    return () => {
      vivo = false;
    };
  }, [user, estremi, giroDiSync]);

  const registro = useMemo(
    () =>
      costruisciRegistroSpesa({
        aMano: adSpending,
        meta: metaGiorni,
        tiktokAlGiorno,
        estremi,
        dentro,
        userId: user?.id || "",
      }),
    [adSpending, metaGiorni, tiktokAlGiorno, estremi, dentro, user],
  );

  /** ── RIALLINEARE ADESSO ──────────────────────────────────────────────────
   *  La sincronizzazione gira da sola ogni quarto d'ora. Il pulsante serve
   *  quando si è appena cambiato il budget e si vuole vedere l'effetto senza
   *  aspettare: riscarica la finestra che si sta guardando, non tutto lo
   *  storico. */
  const riallinea = useCallback(() => {
    if (sincronizzando) return;
    const corri = async () => {
      setSincronizzando(true);
      const avviso = toast.loading("Riallineo la spesa con Meta…");
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("Sessione non valida");
        const finestra = {
          accessToken: token,
          sinceISO: new Date(`${estremi.da}T00:00:00`).toISOString(),
          untilISO: new Date(`${estremi.a}T23:59:59`).toISOString(),
        };
        const r = await fnSync({ data: finestra });
        toast.success(`Spesa aggiornata · ${r.rows} giornate`, { id: avviso });
        //  Si tocca anche la funzione lato server delle finanze: è lei a tenere
        //  il conto di quando i dati sono stati letti l'ultima volta.
        fnFinanze({ data: finestra }).catch(() => undefined);
        setGiroDiSync((x) => x + 1);
      } catch (e) {
        toast.error("Riallineamento non riuscito", {
          id: avviso,
          description: e instanceof Error ? e.message : "Errore",
        });
      } finally {
        setSincronizzando(false);
      }
    };
    void corri();
  }, [sincronizzando, estremi, fnSync, fnFinanze]);

  return { registro, dentro, estremi, ultimaSync, caricando, sincronizzando, riallinea };
}
