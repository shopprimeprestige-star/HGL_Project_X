/** ── LA CAMERINA TONDA, FUORI DALLA VIDEOCHIAMATA ──────────────────────────
 *
 *  Segnalazione del committente: «la camera di quando condivido il link solo
 *  preventivo deve essere sempre rotonda come quando faccio Meetly, stesso
 *  design; replica proprio le stesse funzioni di Meetly della camera nello
 *  stato contenuti».
 *
 *  È la stessa cosa che l'ospite vede durante i contenuti in una consulenza
 *  vera (`ContentPip` dentro call.tsx): un CERCHIO che si trascina dove si
 *  vuole e si ridimensiona dall'angolo — trascinando per la misura esatta, o
 *  con un tocco secco per girare fra piccola, consigliata e grande.
 *
 *  ── ⚠️ DOVE STA E QUANTO È GRANDE LO SANNO TUTTI E DUE ───────────────────
 *  Seconda segnalazione: «la grandezza che ho io sulla mia dashboard non
 *  reagisce come su Meetly; dove posiziono il riquadro si deve spostare, dove
 *  lo metto, e la grandezza che metto».
 *  Erano due riquadri indipendenti che si somigliavano. Ora sono UNA COSA SOLA
 *  vista da due parti: si sposta di qua e si sposta di là, si allarga di qua e
 *  si allarga di là. Il filo passa dal canale della camera
 *  (`condividiPip` / `usePipCameraLink`).
 *
 *  ⚠️ LA MISURA VIAGGIA COME FRAZIONE, SUL METRO DEL CLIENTE. 240 punti sul
 *   monitor del consulente sono un francobollo; gli stessi 240 sul telefono
 *   del cliente sono mezzo schermo. Il metro comune è lo schermo di CHI GUARDA
 *   — che infatti si annuncia con le sue misure — ed è la stessa scelta dello
 *   specchio della PiP in chiamata (vedi `pip-misure.ts`, dove è scritta per
 *   esteso). È anche il motivo per cui l'anteprima del consulente ora nasce
 *   PICCOLA: è grande com'è sul telefono di chi la guarda, non sul suo monitor.
 *
 *  ── ⚠️ PERCHÉ NON SI RIUSA DIRETTAMENTE QUELLA DELLA CHIAMATA ────────────
 *  Perché sta dentro `call.tsx`, e importare `call.tsx` vuol dire importare il
 *  motore della videochiamata: sul DISPOSITIVO DEL CLIENTE partirebbe da solo
 *  il battito della consulenza (un POST ogni otto secondi) su una pagina che
 *  con la consulenza non c'entra — e su `/media-diretta`, che oggi non lo
 *  carica affatto, si tirerebbe dentro mezzo programma per disegnare un
 *  cerchio.
 *  Quello che invece SI RIUSA è l'aritmetica delle misure (`pip-misure.ts`,
 *  già fuori da call.tsx e già provata): è lì che sta la differenza fra una
 *  camerina grande come una moneta e una che copre mezzo schermo, e averne
 *  due copie vorrebbe dire due cerchi diversi per la stessa persona.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useRef, useState } from "react";
import { Move } from "lucide-react";
import {
  frazioneDaMisura,
  misuraDaFrazione,
  pipLarghezzaDefault,
  pipLimiti,
  pipMisure,
  schermoLocale,
  type SchermoBase,
} from "@/shop/pip-misure";
import { condividiPip, usePipCameraLink } from "@/shop/camera-link";

/** La misura scelta a mano si ricorda: è la stessa chiave della camerina della
 *  videochiamata, perché per chi guarda è la stessa cosa — «quanto la voglio
 *  grande».
 *  ⚠️ Solo per chi la guarda per sé. Nello SPECCHIO del consulente il numero è
 *   quello del cliente: scriverlo qui vorrebbe dire ereditare sul proprio
 *   monitor una misura pensata per un telefono (ed è lo stesso avvertimento
 *   scritto nella PiP della chiamata). */
const CHIAVE_MISURA = "hg_pip_w";

const leggiMisura = (metro?: SchermoBase): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const n = Number(localStorage.getItem(CHIAVE_MISURA));
    const { min, max } = pipLimiti(metro);
    if (Number.isFinite(n) && n >= min && n <= max) return Math.round(n);
  } catch {
    /* memoria non leggibile (navigazione privata): vale il predefinito */
  }
  return null;
};

/** Il video, con le stesse difese della camerina della chiamata.
 *  ⚠️ Parte SEMPRE in muto: Safari rifiuta la riproduzione automatica di un
 *   video con audio e ci disegna sopra il proprio pulsante «play» — che sulla
 *   faccia di chi ti sta parlando è la cosa peggiore che possa comparire.
 *   (Oggi il flusso è solo video, ma la regola vale lo stesso.)
 *  ⚠️ E se qualcosa lo ferma — rientro dallo sfondo, telefonata in arrivo,
 *   scheda tornata davanti — riparte da solo: un video in pausa si porta
 *   dietro quel pulsante per tutto il tempo. */
function VideoTondo({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const riprendi = useCallback(() => {
    const v = ref.current;
    if (!v || !v.srcObject || !v.paused) return;
    void v.play?.().catch(() => {});
  }, []);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    //  Solo se cambia davvero: riassegnare lo stesso flusso fa ripartire la
    //  pipeline del browser, cioè un lampeggio.
    if (v.srcObject !== stream) v.srcObject = stream;
    if (stream) void v.play?.().catch(() => {});
  }, [stream]);
  useEffect(() => {
    const su = () => {
      if (document.visibilityState === "visible") riprendi();
    };
    document.addEventListener("visibilitychange", su);
    window.addEventListener("focus", su);
    //  ⚠️ E un controllo lento: una traccia che riparte dopo un sobbalzo di
    //   rete lascia il video in pausa senza avvisare nessuno, e resta un
    //   cerchio nero a schermo. Due secondi sono abbastanza per non farsene
    //   accorgere e abbastanza pochi da non pesare.
    const t = window.setInterval(riprendi, 2000);
    return () => {
      document.removeEventListener("visibilitychange", su);
      window.removeEventListener("focus", su);
      clearInterval(t);
    };
  }, [riprendi]);
  return (
    <video
      ref={ref}
      autoPlay
      muted
      playsInline
      onCanPlay={riprendi}
      /*  ── ⚠️ DENTRO UN TONDO SI RIEMPIE, NON SI CONTIENE ─────────────────
          Un video 16:9 «contenuto» in un cerchio diventa una striscia in mezzo
          a due mezzelune vuote — cioè un rettangolo disegnato dentro un
          cerchio, il contrario di quello che serve. Con `cover` si perdono i
          lati, che in un mezzo busto sono sfondo. */
      className="h-full w-full object-cover"
    />
  );
}

export function CamerinaTonda({
  stream,
  specchio,
  titolo,
  nota,
  base,
}: {
  stream: MediaStream | null;
  /** true = è l'anteprima del consulente, «come la vede il cliente»: cambia
   *  solo il colore dell'anello e aggiunge la targhetta, come in chiamata. */
  specchio?: boolean;
  titolo?: string;
  /** Due parole in più sulla targhetta dello specchio (es. chi sta ricevendo). */
  nota?: string;
  /** Il METRO su cui si calcola la misura: lo schermo del cliente. Senza, vale
   *  la finestra di qui — che è giusto solo quando la finestra di qui È quella
   *  del cliente. */
  base?: SchermoBase;
}) {
  const scatola = useRef<HTMLDivElement | null>(null);
  const pip = usePipCameraLink();
  const [, ridisegna] = useState(0);
  const metro = base && base.w > 0 ? base : schermoLocale();

  //  Rotazione del telefono o finestra ridimensionata: la posizione è una
  //  frazione, quindi resta buona; i pixel no, e vanno rifatti.
  useEffect(() => {
    const su = () => ridisegna((n) => n + 1);
    window.addEventListener("resize", su);
    window.addEventListener("orientationchange", su);
    window.visualViewport?.addEventListener("resize", su);
    return () => {
      window.removeEventListener("resize", su);
      window.removeEventListener("orientationchange", su);
      window.visualViewport?.removeEventListener("resize", su);
    };
  }, []);

  /** ── LA LARGHEZZA ─────────────────────────────────────────────────────
   *  Prima quella decisa (da qui o dall'altro lato), poi — solo per chi la
   *  guarda per sé — quella ricordata, e infine il predefinito del metro.
   *  ⚠️ Lo specchio NON legge la misura ricordata: quella è la preferenza del
   *   consulente sul suo monitor, e qui il numero è del cliente. */
  const w = (() => {
    const { min, max } = pipLimiti(metro);
    const dentro = (n: number) => Math.round(Math.min(max, Math.max(min, n)));
    if (pip.f > 0) return misuraDaFrazione(pip.f, metro);
    if (!specchio) {
      const salvata = leggiMisura(metro);
      if (salvata) return dentro(salvata);
    }
    return dentro(pipLarghezzaDefault(metro));
  })();

  const spazio = () => {
    //  ⚠️ `|| 360`: una finestra che si dichiara larga zero esiste davvero
    //   (scheda mai mostrata, pagina aperta in sottofondo). Senza il ripiego,
    //   lo spazio libero viene zero e la camerina si incolla all'angolo in
    //   alto a sinistra — dove non l'ha messa nessuno.
    const W = (typeof window === "undefined" ? 0 : window.innerWidth) || 360;
    const H = (typeof window === "undefined" ? 0 : window.innerHeight) || 640;
    const el = scatola.current;
    const larg = el?.offsetWidth || w;
    const alt = el?.offsetHeight || w;
    const bordo = 8;
    return {
      bordo,
      liberoX: Math.max(1, W - larg - bordo * 2),
      liberoY: Math.max(1, H - alt - bordo * 2),
    };
  };

  const s = spazio();
  const stile: React.CSSProperties = {
    left: Math.round(s.bordo + pip.x * s.liberoX),
    top: Math.round(s.bordo + pip.y * s.liberoY),
    width: w,
  };

  //  ── TRASCINAMENTO ───────────────────────────────────────────────────
  //   La posizione va anche all'altro lato: si sposta qui, si sposta là.
  const presa = useRef<{ dx: number; dy: number } | null>(null);
  const daPuntatore = (e: React.PointerEvent) => {
    const c = spazio();
    const g = presa.current || { dx: 0, dy: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - g.dx - c.bordo) / c.liberoX)),
      y: Math.min(1, Math.max(0, (e.clientY - g.dy - c.bordo) / c.liberoY)),
    };
  };
  const manigliaSposta = {
    onPointerDown: (e: React.PointerEvent) => {
      const r = scatola.current?.getBoundingClientRect();
      presa.current = { dx: e.clientX - (r?.left ?? e.clientX), dy: e.clientY - (r?.top ?? e.clientY) };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      //  ⚠️ `vivo`: mentre si trascina si dice all'altro lato otto volte al
      //   secondo, non a ogni evento — altrimenti si intasa il canale con roba
      //   che lui non fa in tempo a disegnare.
      if (presa.current) condividiPip(daPuntatore(e), { vivo: true });
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!presa.current) return;
      //  L'ULTIMO invio non si perde mai: è quello che decide dove resta.
      condividiPip(daPuntatore(e));
      presa.current = null;
    },
    onPointerCancel: () => {
      presa.current = null;
    },
  };

  //  ── MISURA: si trascina l'angolo, o si tocca per girare fra le tre ──
  //   ⚠️ Il giro lo tiene un CONTATORE, non la ricerca della misura attuale
  //    nell'elenco: su uno schermo stretto il tetto schiaccia due misure sullo
  //    stesso numero, la ricerca trovava sempre la prima e il cerchio non
  //    cambiava più — «si allarga ma poi non si stringe più». È lo stesso
  //    difetto già corretto nella camerina della chiamata.
  const passo = useRef(0);
  const gesto = useRef<{ x0: number; w0: number; t0: number; mosso: boolean } | null>(null);
  const applica = (n: number, opts?: { vivo?: boolean }) => {
    const { min, max } = pipLimiti(metro);
    const v = Math.round(Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)));
    condividiPip({ f: frazioneDaMisura(v, metro) }, opts);
    return v;
  };
  const ricordaMisura = (v: number) => {
    //  ⚠️ In memoria va solo la PROPRIA misura: vedi il commento sulla chiave.
    if (specchio) return;
    try {
      localStorage.setItem(CHIAVE_MISURA, String(v));
    } catch {
      /* */
    }
  };
  const manigliaMisura = {
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      gesto.current = { x0: e.clientX, w0: w, t0: Date.now(), mosso: false };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = gesto.current;
      if (!g) return;
      e.stopPropagation();
      const d = e.clientX - g.x0;
      if (Math.abs(d) > 4) g.mosso = true;
      if (g.mosso) applica(g.w0 + d, { vivo: true });
    },
    onPointerUp: (e: React.PointerEvent) => {
      const g = gesto.current;
      gesto.current = null;
      if (!g) return;
      e.stopPropagation();
      if (!g.mosso && Date.now() - g.t0 < 600) {
        const m = pipMisure(metro);
        const vicina = m.findIndex((x) => Math.abs(x - w) < 12);
        const da = vicina >= 0 ? vicina : passo.current;
        passo.current = (da + 1) % m.length;
        ricordaMisura(applica(m[passo.current]));
        return;
      }
      ricordaMisura(applica(w));
    },
    onPointerCancel: () => {
      const g = gesto.current;
      gesto.current = null;
      if (g?.mosso) ricordaMisura(w);
    },
  };

  return (
    <div
      ref={scatola}
      style={stile}
      className="fixed z-[94] touch-none cursor-move select-none print:hidden"
      title={
        specchio
          ? "Come ti vede il cliente — trascinala per spostarla anche sul suo schermo"
          : titolo || "Trascinala dove vuoi"
      }
      {...manigliaSposta}
    >
      {specchio && (
        //  ⚠️ La targhetta ha un fondo suo: una scritta trasparente sopra il
        //   contenuto della pagina non si leggerebbe.
        <div className="mx-auto mb-1 flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-brand backdrop-blur">
          <Move className="h-2.5 w-2.5" /> come ti vede il cliente{nota ? ` · ${nota}` : ""}
        </div>
      )}
      {/*  ── ⚠️ TONDA, NON RETTANGOLARE ──────────────────────────────────
          Nessun contenitore attorno: niente bordo, niente fondo, niente
          imbottitura. Erano quelli a fare la scatola attorno alla camerina —
          e la scatola resta visibile anche arrotondando il video dentro. */}
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-full bg-brandfill shadow-2xl shadow-black/50 ring-2 ${
          specchio ? "ring-brand/60" : "ring-white/25"
        }`}
      >
        <VideoTondo stream={stream} />
      </div>
      {/* ── ANGOLO PER REGOLARE LA MISURA ───────────────────────────────
          Si trascina per la misura esatta; un tocco secco passa alla
          successiva fra piccola, consigliata e grande. L'area sensibile è
          molto più larga del segno disegnato: col dito serve almeno mezzo
          centimetro, altrimenti si finisce per spostare il cerchio.
          ⚠️ Sul BORDO del cerchio, non nell'angolo del riquadro: con una
           camerina tonda l'angolo in basso a destra è aria. */}
      <div
        {...manigliaMisura}
        data-hg-noptr
        title="Trascina per ridimensionare · tocca per cambiare misura"
        className="absolute bottom-[4%] right-[4%] z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-center justify-center rounded-full bg-black/60 backdrop-blur"
      >
        <svg viewBox="0 0 10 10" aria-hidden className="h-3.5 w-3.5 text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,.9)]">
          <path d="M9 1 1 9M9 5 5 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
