/** ── RISPOSTA AI: LA SCELTA DEI MESSAGGI E L'ATTESA DEL MAC ──────────────────
 *
 *  Richiesta del titolare (29/10/2026): si scelgono 1-4 messaggi della chat e
 *  il Mac (Claude Haiku, con le informazioni di AIOS) scrive la risposta, che
 *  finisce nella casella. Le regole sono in crm/risposte-ai/regole.
 *  Qui: la riga in `wa_risposte_ai`, l'attesa (lettura ogni 2 secondi, fino
 *  a 3 minuti) e lo stato del Mac (`app_config` «risposte_ai_battito»).
 *  ⚠️ Senza la migrazione 20261029200000 la tabella non c'è: si dice in chiaro.
 *  ⚠️ UN TOCCO (30/10/2026): con messaggi del cliente senza risposta «Rispondi
 *   con AI» parte subito, con quei messaggi; nella barra si può annullare o
 *   cambiare i messaggi (`ferma`) e riprovare. Senza messaggi si apre la scelta.
 *  ⚠️ ORARI LIBERI (30/10/2026): la richiesta porta gli orari veri dei prossimi
 *   giorni (`useGiorniLiberi`, lo stesso di Slot liberi) nella colonna `orari`.
 *   Senza la migrazione 20261030100000 la colonna manca: si riprova senza.
 *  ⚠️ RISPIEGA (30/10/2026): stessa strada, `modo: "rispiega"`. Si sceglie la nostra
 *   risposta e le domande del cliente (fino a 8, anche nostre: `apriRispiega`), niente
 *   parte da solo, nessuna indicazione né orario. Senza la migrazione 20261030180000
 *   (colonna `modo`) NON si riprova senza: sarebbe una risposta a un'altra domanda.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGiorniLiberi } from "@/crm/useGiorniLiberi";
import { oggiIso } from "@/crm/ui";
import { MAX_RISPIEGA, commuta, controllaScelta, fraseControllo } from "@/crm/risposte-ai/rispiega";
import {
  ATTESA_MAX_S,
  CHIAVE_BATTITO,
  LIMITE_INDICAZIONE,
  MAX_SCELTI,
  colonnaMancante,
  erroreInChiaro,
  pcAcceso,
  sceltiDiPartenza,
  testoOrari,
} from "@/crm/risposte-ai/regole";
import type { WaMessageRow } from "./tipi";

type Esito<T> = { data: T | null; error: { code?: string; message?: string } | null };
type Q = {
  insert: (v: Record<string, unknown>) => Q;
  select: (c: string) => Q;
  eq: (c: string, v: string) => Q;
  single: () => PromiseLike<Esito<Record<string, unknown>>>;
  maybeSingle: () => PromiseLike<Esito<Record<string, unknown>>>;
};
const tabella = (t: string) => (supabase as unknown as { from: (t: string) => Q }).from(t);

export type FaseAi = "scelta" | "attesa";
/** `rispondi` = «Rispondi con AI»; `rispiega` = «Rispiega con AI» (barra e prompt suoi). */
export type ModoAi = "rispondi" | "rispiega";

export interface RispostaAiApi {
  attivo: boolean;
  modo: ModoAi;
  fase: FaseAi;
  scelti: string[];
  cambia: (id: string) => void;
  indicazione: string;
  setIndicazione: (t: string) => void;
  /** `true` acceso, `false` spento, `null` non si sa (mai visto) */
  pc: boolean | null;
  apri: () => void;
  /** accende la selezione per «Rispiega con AI», con questa bolla già scelta */
  apriRispiega: (id: string) => void;
  chiudi: () => void;
  /** smette di aspettare e torna alla scelta, con gli stessi messaggi, per cambiarli e riprovare */
  ferma: () => void;
  scrivi: () => Promise<void>;
  errore: string | null;
}

export function useRispostaAi(p: {
  telefono: string | null;
  messaggi: WaMessageRow[];
  /** mette il testo nella casella */
  onRisposta: (testo: string) => void;
}): RispostaAiApi {
  const [attivo, setAttivo] = useState(false);
  const [modo, setModo] = useState<ModoAi>("rispondi");
  const [fase, setFase] = useState<FaseAi>("scelta");
  const [scelti, setScelti] = useState<string[]>([]);
  const [indicazione, setIndicazioneGrezza] = useState("");
  const [pc, setPc] = useState<boolean | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  //  Gli orari liberi dei prossimi 7 giorni, letti al momento di chiedere.
  const { giorni } = useGiorniLiberi({ quanti: 7 });
  const giorniRef = useRef(giorni);
  giorniRef.current = giorni;
  /** la richiesta in corso: se cambia chat o si annulla, la risposta non arriva più */
  const giro = useRef(0);

  const chiudi = useCallback(() => {
    giro.current++;
    setAttivo(false);
    setModo("rispondi");
    setFase("scelta");
    setScelti([]);
    setIndicazioneGrezza("");
    setErrore(null);
  }, []);

  //  Cambiando chat si esce: i messaggi scelti erano di un'altra.
  useEffect(() => chiudi(), [p.telefono, chiudi]);

  //  Il Mac acceso o spento, mentre la scelta è aperta.
  useEffect(() => {
    if (!attivo) return;
    let vivo = true;
    const leggi = async () => {
      const { data } = await tabella("app_config")
        .select("value")
        .eq("key", CHIAVE_BATTITO)
        .maybeSingle();
      if (vivo) setPc(pcAcceso((data?.value as string | undefined) ?? null, new Date()));
    };
    void leggi();
    const t = setInterval(() => void leggi(), 15_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [attivo]);

  const apri = () => {
    setModo("rispondi");
    const partenza = sceltiDiPartenza(p.messaggi);
    setScelti(partenza);
    setErrore(null);
    setFase("scelta");
    setAttivo(true);
    //  Un tocco: se c'è qualcuno da rispondere si parte subito.
    if (partenza.length > 0) void scrivi(partenza);
  };

  const apriRispiega = (id: string) => {
    //  Una scelta già aperta (anche l'altra) non si sovrascrive da una pressione lunga.
    if (attivo) return;
    setModo("rispiega");
    setScelti([id]);
    setIndicazioneGrezza("");
    setErrore(null);
    setFase("scelta");
    setAttivo(true);
  };

  const ferma = () => {
    giro.current++;
    setFase("scelta");
    setErrore(null);
  };

  const cambia = (id: string) =>
    setScelti((s) =>
      modo === "rispiega"
        ? commuta(s, id, MAX_RISPIEGA)
        : s.includes(id)
          ? s.filter((x) => x !== id)
          : s.length >= MAX_SCELTI
            ? s
            : [...s, id],
    );

  /** `daScrivere`: i messaggi da rispondere; senza, quelli scelti nella barra. */
  const scrivi = async (daScrivere?: string[]) => {
    const messaggiScelti = daScrivere ?? scelti;
    if (!p.telefono || messaggiScelti.length === 0 || fase === "attesa") return;
    const rispiega = modo === "rispiega";
    //  Rispiega: prima si controlla la scelta (serve una bolla nostra), poi si chiede.
    const controllo = rispiega ? controllaScelta(messaggiScelti, p.messaggi) : null;
    if (controllo && !controllo.ok) {
      setErrore(fraseControllo(controllo.motivo));
      return;
    }
    const mio = ++giro.current;
    setErrore(null);
    setFase("attesa");
    const richiesta: Record<string, unknown> = {
      telefono: p.telefono,
      messaggi: controllo?.ok ? controllo.ids : messaggiScelti,
      indicazione: rispiega ? null : indicazione.trim() || null,
      ...(rispiega && { modo: "rispiega" }),
    };
    const orari = rispiega ? null : testoOrari(giorniRef.current, oggiIso(new Date()));
    const mandaRichiesta = (v: Record<string, unknown>) =>
      tabella("wa_risposte_ai").insert(v).select("id").single();
    let { data, error } = await mandaRichiesta(orari ? { ...richiesta, orari } : richiesta);
    //  Migrazione degli orari non ancora applicata: si chiede senza.
    if (orari && colonnaMancante(error)) ({ data, error } = await mandaRichiesta(richiesta));
    if (mio !== giro.current) return;
    if (error || !data?.id) {
      setFase("scelta");
      setErrore(
        ["42P01", "PGRST205"].includes(String(error?.code ?? ""))
          ? "Manca la tabella delle risposte AI nel database (migrazione da applicare)."
          : rispiega && colonnaMancante(error)
            ? "«Rispiega con AI» non è ancora attivo: manca un aggiornamento del database (migrazione da applicare)."
            : "Non riesco a mandare la richiesta. Riprova.",
      );
      return;
    }
    const id = String(data.id);
    const fine = Date.now() + ATTESA_MAX_S * 1000;
    try {
      while (Date.now() < fine) {
        await new Promise((ok) => setTimeout(ok, 2000));
        if (mio !== giro.current) return;
        const { data: r } = await tabella("wa_risposte_ai")
          .select("stato, risposta, errore")
          .eq("id", id)
          .maybeSingle();
        if (mio !== giro.current) return;
        if (r?.stato === "pronta" && typeof r.risposta === "string") {
          p.onRisposta(r.risposta);
          chiudi();
          return;
        }
        if (r?.stato === "errore") {
          setFase("scelta");
          setErrore(erroreInChiaro(r.errore as string | null));
          return;
        }
      }
    } catch {
      //  Senza rete la lettura lancia: la barra non resta su «Scrivendo…».
      if (mio !== giro.current) return;
      setFase("scelta");
      setErrore("Non riesco a leggere la risposta: controlla la connessione e riprova.");
      return;
    }
    if (mio !== giro.current) return;
    setFase("scelta");
    setErrore(
      "Il Mac non ha risposto in tempo. Controlla che sia acceso e collegato, poi riprova.",
    );
  };

  return {
    attivo,
    modo,
    fase,
    scelti,
    cambia,
    indicazione,
    setIndicazione: (t) => setIndicazioneGrezza(t.slice(0, LIMITE_INDICAZIONE)),
    pc,
    apri,
    apriRispiega,
    chiudi,
    ferma,
    scrivi: () => scrivi(),
    errore,
  };
}
