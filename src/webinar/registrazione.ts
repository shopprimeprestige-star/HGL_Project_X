/** ── REGISTRARE IL WEBINAR ──────────────────────────────────────────────────
 *
 *  Si registra NEL BROWSER DI CHI CONDUCE, non sul server. Non è un ripiego:
 *  è l'unico posto in cui esiste già tutto insieme — la sua camera, le voci di
 *  chi è salito sul palco, il montaggio come lo vede la sala. Farlo altrove
 *  vorrebbe dire un secondo abbonato headless da qualche parte, che costa
 *  banda a ogni diretta e una macchina da tenere in piedi.
 *
 *  ── COSA FINISCE NEL FILE ─────────────────────────────────────────────────
 *  Una tela 1280×720 su cui si disegna il relatore grande e, in basso, i
 *  riquadri di chi ha preso la parola; e una miscela audio con la sua voce più
 *  quelle del palco. Il palco cambia DURANTE la registrazione, quindi né i
 *  riquadri né le voci si possono decidere all'inizio: si guarda a ogni
 *  fotogramma chi c'è adesso.
 *
 *  ── I DUE MODI IN CUI QUESTA COSA SI ROMPE, E COME LI EVITA ───────────────
 *  1. LA SCHEDA IN SECONDO PIANO. `requestAnimationFrame` si ferma quando la
 *     finestra non è visibile: il video si congelerebbe sull'ultimo fotogramma
 *     mentre l'audio continua, e ci si accorgerebbe solo a diretta finita.
 *     Qui il disegno lo batte un `setInterval`, che in secondo piano rallenta
 *     ma non muore.
 *  2. IL FILE PERSO. Un'ora di webinar in memoria è centinaia di megabyte, e
 *     se la scheda si chiude non resta niente. I pezzi si accumulano ogni
 *     cinque secondi (`timeslice`), così alla peggio si perdono gli ultimi
 *     cinque — e chi chiude la finestra viene avvisato prima.
 */
import { supabase } from "@/integrations/supabase/client";

/** Il montaggio: chi è grande e chi sta nei riquadri, in questo istante. */
export interface Scena {
  /** il relatore. Se manca (camera spenta) si disegna comunque il fondo. */
  principale: MediaStream | null;
  /** chi ha preso la parola adesso, in ordine */
  riquadri: { nome: string; stream: MediaStream }[];
}

export interface Registrazione {
  /** chiude e restituisce il file. `null` se non è stato registrato niente. */
  ferma: () => Promise<Blob | null>;
  /** quanti secondi sono passati */
  secondi: () => number;
  /** quanto pesa finora, per dirlo a chi registra prima che sia troppo tardi */
  byte: () => number;
}

const LARGHEZZA = 1280;
const ALTEZZA = 720;
const FPS = 25;
/** Ogni quanto si stacca un pezzo. Cinque secondi è il massimo che si accetta
 *  di perdere se la scheda muore, e il minimo che non frammenta il file in
 *  migliaia di pezzetti. */
const PEZZO_MS = 5000;

/** I formati, in ordine di preferenza. VP9 pesa meno a parità di qualità;
 *  l'ultimo è la rete di sicurezza per i browser che non dicono la verità su
 *  `isTypeSupported`. */
const FORMATI = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=h264,opus",
  "video/webm",
  "video/mp4",
];

function formatoBuono(): string {
  for (const f of FORMATI) {
    try { if (MediaRecorder.isTypeSupported(f)) return f; } catch { /* si prova il prossimo */ }
  }
  return "";
}

/** Disegna un video dentro un rettangolo COPRENDOLO senza deformarlo: si
 *  ritaglia il di più invece di schiacciare la faccia di chi parla, che è
 *  esattamente ciò che si nota in una registrazione. */
function disegnaCoprendo(
  ctx: CanvasRenderingContext2D, el: HTMLVideoElement,
  x: number, y: number, w: number, h: number,
) {
  const vw = el.videoWidth, vh = el.videoHeight;
  if (!vw || !vh) return false;
  const scala = Math.max(w / vw, h / vh);
  const dw = vw * scala, dh = vh * scala;
  ctx.drawImage(el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  return true;
}

export function avviaRegistrazione(scena: () => Scena, opzioni: { microfono: MediaStream | null }): Registrazione {
  const tela = document.createElement("canvas");
  tela.width = LARGHEZZA;
  tela.height = ALTEZZA;
  const ctx = tela.getContext("2d")!;

  //  Un <video> per ogni flusso, tenuto in vita fuori dal documento: è l'unico
  //  modo di leggere i fotogrammi di un MediaStream per disegnarli.
  const lettori = new Map<MediaStream, HTMLVideoElement>();
  const lettore = (s: MediaStream): HTMLVideoElement => {
    let el = lettori.get(s);
    if (!el) {
      el = document.createElement("video");
      el.srcObject = s;
      el.muted = true;      // il suono passa dalla miscela, non da qui: sennò è doppio
      el.playsInline = true;
      void el.play().catch(() => { /* riproverà da sé */ });
      lettori.set(s, el);
    }
    return el;
  };

  // ── LA MISCELA AUDIO ────────────────────────────────────────────────
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const actx = new Ctx();
  const destinazione = actx.createMediaStreamDestination();
  const giaMescolati = new Set<MediaStream>();
  const mescola = (s: MediaStream | null) => {
    if (!s || giaMescolati.has(s) || !s.getAudioTracks().length) return;
    giaMescolati.add(s);
    try { actx.createMediaStreamSource(s).connect(destinazione); } catch { /* traccia già chiusa */ }
  };
  mescola(opzioni.microfono);

  // ── IL DISEGNO ──────────────────────────────────────────────────────
  const fotogramma = () => {
    const s = scena();
    ctx.fillStyle = "#050f24";
    ctx.fillRect(0, 0, LARGHEZZA, ALTEZZA);

    const conRiquadri = s.riquadri.length > 0;
    const hPrincipale = conRiquadri ? ALTEZZA - 180 : ALTEZZA;

    if (s.principale) {
      mescola(s.principale);
      disegnaCoprendo(ctx, lettore(s.principale), 0, 0, LARGHEZZA, hPrincipale);
    }

    if (conRiquadri) {
      //  Al massimo cinque riquadri: oltre, diventano francobolli in cui non
      //  si riconosce nessuno, ed è meglio mostrarne meno e leggibili.
      const quanti = Math.min(5, s.riquadri.length);
      const larg = (LARGHEZZA - 20 * (quanti + 1)) / quanti;
      const alt = 140;
      const y = ALTEZZA - alt - 20;
      for (let i = 0; i < quanti; i++) {
        const r = s.riquadri[i];
        mescola(r.stream);
        const x = 20 + i * (larg + 20);
        ctx.fillStyle = "#0b1a33";
        ctx.fillRect(x, y, larg, alt);
        const disegnato = r.stream.getVideoTracks().length
          ? disegnaCoprendo(ctx, lettore(r.stream), x, y, larg, alt)
          : false;
        if (!disegnato) {
          //  Chi è salito in sola voce non ha niente da mostrare: si scrive
          //  l'iniziale invece di lasciare un rettangolo nero, che in una
          //  registrazione sembra un guasto.
          ctx.fillStyle = "#1e3a5f";
          ctx.beginPath();
          ctx.arc(x + larg / 2, y + alt / 2 - 10, 26, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#cbd5e1";
          ctx.font = "600 24px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText((r.nome || "?").trim().charAt(0).toUpperCase(), x + larg / 2, y + alt / 2 - 1);
        }
        //  Il nome sopra una fascia scura: su un video chiaro il testo bianco
        //  da solo sparisce, ed è il difetto che si scopre solo riguardando.
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x, y + alt - 26, larg, 26);
        ctx.fillStyle = "#fff";
        ctx.font = "500 14px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(String(r.nome || "").slice(0, 22), x + 8, y + alt - 8);
      }
    }
  };

  //  ⚠️ `setInterval` e non `requestAnimationFrame`: vedi la nota in testa.
  const orologio = setInterval(fotogramma, Math.round(1000 / FPS));
  fotogramma();

  // ── IL REGISTRATORE ─────────────────────────────────────────────────
  const uscita = new MediaStream();
  tela.captureStream(FPS).getVideoTracks().forEach((t) => uscita.addTrack(t));
  destinazione.stream.getAudioTracks().forEach((t) => uscita.addTrack(t));

  const tipo = formatoBuono();
  const pezzi: Blob[] = [];
  let peso = 0;
  const inizio = Date.now();

  const rec = new MediaRecorder(uscita, tipo ? { mimeType: tipo } : undefined);
  rec.ondataavailable = (e) => { if (e.data && e.data.size) { pezzi.push(e.data); peso += e.data.size; } };
  rec.start(PEZZO_MS);

  return {
    secondi: () => Math.round((Date.now() - inizio) / 1000),
    byte: () => peso,
    ferma: () =>
      new Promise<Blob | null>((risolvi) => {
        clearInterval(orologio);
        const chiudi = () => {
          lettori.forEach((el) => { el.srcObject = null; });
          lettori.clear();
          try { void actx.close(); } catch { /* già chiuso */ }
          risolvi(pezzi.length ? new Blob(pezzi, { type: tipo || "video/webm" }) : null);
        };
        if (rec.state === "inactive") { chiudi(); return; }
        rec.onstop = chiudi;
        try { rec.stop(); } catch { chiudi(); }
      }),
  };
}

/** ── DALLA MEMORIA ALL'ARCHIVIO ────────────────────────────────────────────
 *  Il file NON passa dal nostro server: si chiede un permesso di caricamento e
 *  si spedisce dritto alla Storage. Farlo passare da noi vorrebbe dire mandare
 *  centinaia di megabyte dentro una richiesta a un Worker, che ha un tetto
 *  molto più basso — e il rifiuto arriverebbe a caricamento finito. */
export async function archivia(
  file: Blob,
  dati: { codice: string; titolo: string; secondi: number },
  intestazioni: Record<string, string>,
): Promise<{ ok: boolean; motivo?: string }> {
  const chiedi = async (corpo: unknown) => {
    const r = await fetch("/api/crm/webinar-registrazioni", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...intestazioni },
      body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(String(j?.error || j?.motivo || `errore ${r.status}`));
    return j;
  };

  try {
    const permesso = await chiedi({
      azione: "permesso",
      codice: dati.codice,
      nome: `${dati.titolo}.webm`,
      peso: file.size,
    });

    //  Si usa il client della Storage e non una PUT scritta a mano: la forma
    //  esatta dell'indirizzo firmato è un dettaglio loro, e il giorno che
    //  cambia una PUT artigianale si rompe in silenzio.
    const { error } = await supabase.storage
      .from(String(permesso.bucket))
      .uploadToSignedUrl(String(permesso.percorso), String(permesso.token), file, {
        contentType: file.type || "video/webm",
      });
    if (error) return { ok: false, motivo: error.message };

    await chiedi({
      azione: "salva",
      codice: dati.codice,
      percorso: permesso.percorso,
      titolo: dati.titolo,
      secondi: dati.secondi,
      peso: file.size,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: String((e as Error).message || e) };
  }
}
