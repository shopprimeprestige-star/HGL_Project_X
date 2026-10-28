/** ── LA CHAT WHATSAPP · DETTATURA: IL REGISTRATORE E LA SUA BARRA ──────────
 *
 *  Commessa 2026-10-28-chat-dettatura. Tocca il microfono → registra (indicatore
 *  rosso, tempo, livello della voce) → «Fatto» manda l'audio a /api/crm/dettatura
 *  e il testo torna nella casella, AGGIUNTO alla bozza: non parte mai da solo.
 *  «Annulla» butta via la registrazione. Regole pure in ./dettatura.
 *  ⚠️ L'audio vive solo in memoria fino alla risposta: niente salvato, niente log.
 *  ⚠️ Il microfono si spegne sempre (tracce fermate), anche cambiando chat.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, Trash2, TriangleAlert, X } from "lucide-react";
import { fetchCRM } from "@/crm/AuthContext";
import { cn } from "@/lib/utils";
import { DURATA_MAX_MS, codiceDaErroreMicrofono, fraseErrore, mimeDaRegistrare } from "./dettatura";
import { tempoVocale } from "./stile";

export type StatoDettatura = "ferma" | "registra" | "trascrive";

/** Quante barre del livello si vedono, e ogni quanto si aggiornano. */
const BARRE = 28;
const PASSO_MS = 100;

/** Il browser sa registrare? (browser dentro le app, vecchi Safari: no → tasto nascosto). */
function registratorePresente(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** Il registratore. `onTesto` riceve il testo trascritto (letto all'ultimo momento:
 *  la bozza può essere cambiata nel frattempo). */
export function useDettatura(onTesto: (testo: string) => void) {
  //  Solo dopo il montaggio: sul server non c'è `window` e il disegno deve coincidere.
  const [possibile, setPossibile] = useState(false);
  useEffect(() => setPossibile(registratorePresente()), []);
  const [stato, setStato] = useState<StatoDettatura>("ferma");
  const [ms, setMs] = useState(0);
  const [livelli, setLivelli] = useState<number[]>(() => Array(BARRE).fill(0));
  const [errore, setErrore] = useState<string | null>(null);

  const testoRef = useRef(onTesto);
  testoRef.current = onTesto;
  /** Ogni annullamento cambia il giro: una risposta di un giro vecchio si butta. */
  const giro = useRef(0);
  const spegni = useRef<() => void>(() => {});
  const registratore = useRef<MediaRecorder | null>(null);

  const annulla = useCallback(() => {
    giro.current += 1;
    const r = registratore.current;
    registratore.current = null;
    if (r && r.state !== "inactive") r.stop();
    spegni.current();
    setStato("ferma");
  }, []);
  useEffect(() => annulla, [annulla]);

  useEffect(() => {
    if (errore === null) return;
    const t = setTimeout(() => setErrore(null), 8000);
    return () => clearTimeout(t);
  }, [errore]);

  const manda = async (audio: Blob, durataMs: number, mio: number) => {
    setStato("trascrive");
    try {
      const res = await fetchCRM("/api/crm/dettatura", {
        method: "POST",
        headers: { "Content-Type": audio.type, "x-durata-ms": String(Math.round(durataMs)) },
        body: audio,
      });
      const j = (await res.json().catch(() => null)) as {
        ok?: boolean;
        testo?: string;
        error?: string;
      } | null;
      if (mio !== giro.current) return;
      if (res.ok && j?.ok && j.testo) testoRef.current(j.testo);
      else setErrore(fraseErrore(res.status === 401 ? "sessione" : (j?.error ?? "trascrizione")));
    } catch {
      if (mio === giro.current) setErrore(fraseErrore("rete"));
    } finally {
      if (mio === giro.current) setStato("ferma");
    }
  };

  const avvia = async () => {
    if (stato !== "ferma") return;
    setErrore(null);
    const mio = ++giro.current;
    let flusso: MediaStream;
    try {
      flusso = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      if (mio === giro.current)
        setErrore(fraseErrore(codiceDaErroreMicrofono((e as Error)?.name ?? "")));
      return;
    }
    //  Cambiata chat mentre il browser chiedeva il permesso: niente registrazione.
    if (mio !== giro.current) {
      flusso.getTracks().forEach((t) => t.stop());
      return;
    }
    const mime = mimeDaRegistrare((t) => MediaRecorder.isTypeSupported(t));
    let r: MediaRecorder;
    try {
      r = new MediaRecorder(flusso, mime ? { mimeType: mime } : undefined);
    } catch {
      flusso.getTracks().forEach((t) => t.stop());
      setErrore(fraseErrore("non_supportato"));
      return;
    }

    //  Il livello della voce, per le barre: se l'AudioContext non parte, barre ferme.
    let contesto: AudioContext | null = null;
    let analisi: AnalyserNode | null = null;
    try {
      contesto = new AudioContext();
      //  Safari lo crea «sospeso» fuori dal tocco: senza resume le barre restano ferme.
      void contesto.resume().catch(() => {});
      analisi = contesto.createAnalyser();
      analisi.fftSize = 512;
      contesto.createMediaStreamSource(flusso).connect(analisi);
    } catch {
      analisi = null;
    }
    const campioni = new Uint8Array(512);
    const inizio = Date.now();
    const orologio = setInterval(() => {
      const passati = Date.now() - inizio;
      setMs(passati);
      if (analisi) {
        analisi.getByteTimeDomainData(campioni);
        let somma = 0;
        for (const v of campioni) somma += ((v - 128) / 128) ** 2;
        const l = Math.min(1, Math.sqrt(somma / campioni.length) * 4);
        setLivelli((p) => [...p.slice(1), l]);
      }
      //  Due minuti: si ferma da solo e trascrive quello che c'è.
      if (passati >= DURATA_MAX_MS && r.state === "recording") r.stop();
    }, PASSO_MS);
    spegni.current = () => {
      clearInterval(orologio);
      flusso.getTracks().forEach((t) => t.stop());
      void contesto?.close().catch(() => {});
      spegni.current = () => {};
    };

    const pezzi: Blob[] = [];
    r.ondataavailable = (e) => {
      if (e.data.size) pezzi.push(e.data);
    };
    r.onstop = () => {
      const durata = Date.now() - inizio;
      spegni.current();
      if (mio !== giro.current) return;
      registratore.current = null;
      void manda(new Blob(pezzi, { type: r.mimeType || mime }), durata, mio);
    };
    registratore.current = r;
    setMs(0);
    setLivelli(Array(BARRE).fill(0));
    r.start();
    setStato("registra");
  };

  /** «Fatto»: ferma e trascrive (il resto lo fa `onstop`). */
  const fatto = () => {
    const r = registratore.current;
    if (r && r.state === "recording") r.stop();
  };

  return {
    possibile,
    stato,
    ms,
    livelli,
    errore,
    chiudiErrore: () => setErrore(null),
    avvia: () => void avvia(),
    fatto,
    annulla,
  };
}

type Dettatura = ReturnType<typeof useDettatura>;

/** Il tasto del microfono. `grande`: al posto dell'invio (casella vuota, come WhatsApp). */
export function TastoMicrofono({ d, grande }: { d: Dettatura; grande?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={d.avvia}
      aria-label="Detta il messaggio"
      title="Detta il messaggio: parla e il testo va nella casella"
      className={cn(
        "grid shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        grande
          ? "h-11 w-11 bg-emerald-500 text-white hover:bg-emerald-600"
          : "h-11 w-10 text-muted-foreground hover:text-foreground md:h-10",
      )}
    >
      <Mic className={grande ? "h-5 w-5" : "h-[18px] w-[18px]"} aria-hidden />
    </button>
  );
}

/** La barra che prende il posto della casella mentre si registra o si trascrive. */
export function BarraDettatura({ d }: { d: Dettatura }) {
  const registra = d.stato === "registra";
  return (
    <div className="px-3 py-2 flex items-center gap-2">
      <button
        type="button"
        onClick={d.annulla}
        aria-label="Annulla la dettatura"
        title="Annulla"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trash2 className="h-[18px] w-[18px]" aria-hidden />
      </button>
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[22px] border border-input bg-background px-4 md:rounded-lg"
      >
        {registra ? (
          <>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 motion-safe:animate-pulse"
              aria-hidden
            />
            <span className="w-10 shrink-0 tabular-nums text-[14px] text-foreground">
              {tempoVocale(d.ms / 1000)}
            </span>
            <span className="sr-only">Registrazione in corso, massimo 2 minuti</span>
            <span
              className="flex h-6 min-w-0 flex-1 items-center gap-[2px] overflow-hidden"
              aria-hidden
            >
              {d.livelli.map((l, i) => (
                <span
                  key={i}
                  className="w-[3px] shrink-0 rounded-full bg-red-400"
                  style={{ height: `${Math.max(12, Math.round(l * 100))}%` }}
                />
              ))}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-2 text-[14px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Trascrivo…
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={d.fatto}
        disabled={!registra}
        aria-label="Fatto: trascrivi nella casella"
        title="Fatto"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Check className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

/** L'errore, in una riga sopra la casella (un avviso in basso finirebbe sotto la tastiera). */
export function AvvisoDettatura({ d }: { d: Dettatura }) {
  if (!d.errore) return null;
  return (
    <div role="alert" className="flex items-start gap-2 px-3 pt-2 text-[12.5px] text-amber-800">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
      <span className="flex-1">{d.errore}</span>
      <button
        type="button"
        onClick={d.chiudiErrore}
        aria-label="Chiudi l'avviso"
        className="-mt-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
