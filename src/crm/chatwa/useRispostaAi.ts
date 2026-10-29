/** ── RISPOSTA AI: LA SCELTA DEI MESSAGGI E L'ATTESA DEL MAC ──────────────────
 *
 *  Richiesta del titolare (29/10/2026): si scelgono 1-4 messaggi della chat e
 *  il Mac (Claude Haiku, con le informazioni di AIOS) scrive la risposta, che
 *  finisce nella casella. Le regole sono in crm/risposte-ai/regole.
 *  Qui: la riga in `wa_risposte_ai`, l'attesa (lettura ogni 2 secondi, fino
 *  a 3 minuti) e lo stato del Mac (`app_config` «risposte_ai_battito»).
 *  ⚠️ Senza la migrazione 20261029200000 la tabella non c'è: si dice in chiaro.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ATTESA_MAX_S,
  CHIAVE_BATTITO,
  LIMITE_INDICAZIONE,
  MAX_SCELTI,
  erroreInChiaro,
  pcAcceso,
  sceltiDiPartenza,
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

export interface RispostaAiApi {
  attivo: boolean;
  fase: FaseAi;
  scelti: string[];
  cambia: (id: string) => void;
  indicazione: string;
  setIndicazione: (t: string) => void;
  /** `true` acceso, `false` spento, `null` non si sa (mai visto) */
  pc: boolean | null;
  apri: () => void;
  chiudi: () => void;
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
  const [fase, setFase] = useState<FaseAi>("scelta");
  const [scelti, setScelti] = useState<string[]>([]);
  const [indicazione, setIndicazioneGrezza] = useState("");
  const [pc, setPc] = useState<boolean | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  /** la richiesta in corso: se cambia chat o si annulla, la risposta non arriva più */
  const giro = useRef(0);

  const chiudi = useCallback(() => {
    giro.current++;
    setAttivo(false);
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
    setScelti(sceltiDiPartenza(p.messaggi));
    setErrore(null);
    setFase("scelta");
    setAttivo(true);
  };

  const cambia = (id: string) =>
    setScelti((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_SCELTI ? s : [...s, id],
    );

  const scrivi = async () => {
    if (!p.telefono || scelti.length === 0 || fase === "attesa") return;
    const mio = ++giro.current;
    setErrore(null);
    setFase("attesa");
    const { data, error } = await tabella("wa_risposte_ai")
      .insert({
        telefono: p.telefono,
        messaggi: scelti,
        indicazione: indicazione.trim() || null,
      })
      .select("id")
      .single();
    if (mio !== giro.current) return;
    if (error || !data?.id) {
      setFase("scelta");
      setErrore(
        ["42P01", "PGRST205"].includes(String(error?.code ?? ""))
          ? "Manca la tabella delle risposte AI nel database (migrazione da applicare)."
          : "Non riesco a mandare la richiesta. Riprova.",
      );
      return;
    }
    const id = String(data.id);
    const fine = Date.now() + ATTESA_MAX_S * 1000;
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
    setFase("scelta");
    setErrore(
      "Il Mac non ha risposto in tempo. Controlla che sia acceso e collegato, poi riprova.",
    );
  };

  return {
    attivo,
    fase,
    scelti,
    cambia,
    indicazione,
    setIndicazione: (t) => setIndicazioneGrezza(t.slice(0, LIMITE_INDICAZIONE)),
    pc,
    apri,
    chiudi,
    scrivi,
    errore,
  };
}
