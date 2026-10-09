// ── DITO DEL PRESENTATORE, FLUIDO ──────────────────────────────────────────
//  PERCHÉ PRIMA ERA SCATTOSO: il canale realtime accetta poche decine di
//  messaggi al secondo per client, quindi le posizioni del dito partono a
//  ~8-14 al secondo. Disegnandole così com'erano, il cliente vedeva 8-14
//  fotogrammi al secondo: il movimento risultava a scatti anche con la rete
//  perfetta. Aumentare la frequenza d'invio non è una strada: si sfonderebbe il
//  limite del canale e le posizioni verrebbero scartate (peggio).
//
//  Rimedio: il cliente ANIMA fra una posizione e la successiva. Ogni fotogramma
//  dello schermo (60/s) il dito si avvicina all'ultima posizione ricevuta, così
//  il movimento è continuo e resta agganciato al presentatore.
//
//  In più il componente NON usa lo stato di React: scrive direttamente sullo
//  stile del nodo. Altrimenti 60 aggiornamenti al secondo farebbero ridisegnare
//  l'intera pagina del preventivo — e a quel punto sarebbe scattoso tutto.
import { useEffect, useRef } from "react";
import { Pointer } from "lucide-react";

export interface PtrTarget { x: number; y: number; on: boolean }

/** `fixed`: coordinate riferite al VIEWPORT. Altrimenti al contenitore genitore
 *  (che deve essere `relative`) — così ogni pagina mantiene il proprio sistema
 *  di riferimento esattamente com'era. */
/** ── DUE DITA SULLA STESSA PAGINA ──────────────────────────────────────────
 *  Da quando il preventivo si compila in due (shop/preventivi-di-gruppo), su
 *  uno schermo possono esserci DUE dita: il proprio e quello dell'altro. Con
 *  lo stesso colore sarebbero indistinguibili — e sapere «quello lì è il suo»
 *  è tutto il punto della cosa. Il colore si passa da fuori, con classi
 *  intere: Tailwind le vede solo se sono scritte per esteso nel sorgente.
 *  ⚠️ L'ETICHETTA non è un vezzo: con due dita che si muovono, il nome
 *   attaccato al dito è l'unica cosa che toglie ogni dubbio su chi sta
 *   indicando cosa. */
export interface TintaDito { ping: string; alone: string; punto: string }
const TINTA_DI_SERIE: TintaDito = { ping: "bg-brand/40", alone: "bg-brand/50", punto: "bg-brand" };

export function PointerDot({
  target,
  fixed = false,
  className = "",
  tinta = TINTA_DI_SERIE,
  etichetta,
}: {
  target: PtrTarget;
  fixed?: boolean;
  className?: string;
  tinta?: TintaDito;
  etichetta?: string;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const tgt = useRef<PtrTarget>(target);
  const cur = useRef({ x: target.x, y: target.y });
  const wasOn = useRef(target.on);
  tgt.current = target;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const a = tgt.current;
      const c = cur.current;
      const el = box.current;
      // ── A RIPOSO NON SI FA NULLA ──────────────────────────────────────────
      //  Sul telefono del cliente ogni fotogramma conta: un ciclo che scrive
      //  sullo stile 60 volte al secondo anche a dito SPENTO rubava lavoro al
      //  video della chiamata. Quando il dito è spento ed è già fermo sul
      //  bersaglio, il ciclo si limita a riprogrammarsi.
      const settled = Math.abs(a.x - c.x) < 0.0005 && Math.abs(a.y - c.y) < 0.0005;
      if (!el || (settled && a.on === wasOn.current)) { raf = requestAnimationFrame(loop); return; }
      if (el) {
        if (a.on && !wasOn.current) { c.x = a.x; c.y = a.y; }   // riapparso: nessuna scia dal punto vecchio
        wasOn.current = a.on;
        // inseguimento esponenziale: raggiunge il bersaglio in ~80ms, cioè prima
        // che arrivi la posizione successiva → nessun ritardo percepibile
        const k = 0.4;
        c.x += (a.x - c.x) * k;
        c.y += (a.y - c.y) * k;
        el.style.opacity = a.on ? "1" : "0";
        el.style.left = `${c.x * 100}%`;
        el.style.top = `${c.y * 100}%`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={box} aria-hidden
      className={`pointer-events-none ${fixed ? "fixed" : "absolute"} z-[60] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150 ${className}`}
      style={{ opacity: 0, left: 0, top: 0, willChange: "left, top" }}>
      <span className={`absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full ${tinta.ping}`} />
      <span className={`absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md ${tinta.alone}`} />
      <span className={`absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/90 shadow-lg ${tinta.punto}`} />
      <Pointer className="relative h-8 w-8 translate-x-2.5 translate-y-2.5 fill-white/20 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.6)]" />
      {etichetta && (
        <span className="absolute left-7 top-7 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[10.5px] font-semibold text-white shadow-lg backdrop-blur">
          {etichetta}
        </span>
      )}
    </div>
  );
}
