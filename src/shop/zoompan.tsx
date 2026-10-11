// Zoom/pan condiviso (slide + media della pagina "Media").
//  Estratto da src/routes/slide.tsx per essere riusato senza duplicare la logica.
import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize, Minimize, RotateCcw, Pointer } from "lucide-react";
//  L'aritmetica dello zoom sta in un file suo perché è provata: vedi
//  shop/zoom-passi.ts e proveDelloZoom in prove/prove.mjs.
import { ingrandita, passoDoppioClick, scalaLimitata, SCALA_MIN } from "@/shop/zoom-passi";

// Feature 2 — hook zoom/pan (pinch trackpad = ctrl+wheel, drag per spostare)
//  FIX: React registra "wheel" come listener PASSIVO sul root → e.preventDefault()
//  dentro onWheel non ha effetto e il browser esegue il proprio zoom di pagina
//  (lo zoom sulle foto prima/dopo e sui video sembrava "rotto"). Registriamo quindi
//  un listener NATIVO non-passivo sul contenitore (hostRef) + le scorciatoie +/-.
export function useZoomPan(enabled = true) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const pan = useRef<{ x: number; y: number } | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  /*  ⚠️ Gli estremi e lo scatto a 1 stanno in `shop/zoom-passi`: è lì che si
      legge perché, ed è lì che è provato. */
  const clamp = scalaLimitata;
  const onWheel = (e: React.WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setScale((s) => { const n = clamp(s - e.deltaY * 0.01); if (n === 1) { setTx(0); setTy(0); } return n; }); };
  const zoom = (d: number) => setScale((s) => { const n = clamp(s + d); if (n === 1) { setTx(0); setTy(0); } return n; });
  //  Il pulsante "100%" e il tasto di ritorno devono poter tornare a 1 anche
  //  da 1,0000000000000002: `clamp` ci scatta, quindi il confronto `=== 1`
  //  dei pulsanti adesso è affidabile.
  // ── CAUSA DELLO ZOOM "ROTTO" ───────────────────────────────────────────────
  //  Prima il listener nativo veniva agganciato da un useEffect([enabled]) che
  //  LEGGEVA hostRef.current: il ref è però una callback inline, quindi React lo
  //  azzera e riassegna ad ogni render, e l'effetto (che non si ri-esegue mai)
  //  restava legato al nodo catturato al mount — dopo i refactor del box media
  //  quel nodo poteva non essere più quello mostrato → nessun zoom.
  //  Ora l'aggancio avviene NELLA callback del ref (attachHost): il listener
  //  segue sempre l'elemento realmente montato. In più i listener sono in
  //  CAPTURE, così i controlli nativi del <video> non possono ingoiare
  //  ctrl+wheel e il doppio click.
  const bumpRef = useRef<() => void>(() => {});
  const detach = useRef<(() => void) | null>(null);
  const attachHost = (el: HTMLElement | null) => {
    hostRef.current = el;
    detach.current?.(); detach.current = null;
    if (!el || typeof el.addEventListener !== "function" || !enabled) return;
    const nativeWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); e.stopPropagation();
      setScale((s) => { const n = clamp(s - e.deltaY * 0.01); if (n === 1) { setTx(0); setTy(0); } return n; });
    };
    const nativeDbl = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); bumpRef.current(); };
    el.addEventListener("wheel", nativeWheel, { passive: false, capture: true });
    el.addEventListener("dblclick", nativeDbl, { capture: true });
    detach.current = () => {
      el.removeEventListener("wheel", nativeWheel, { capture: true } as EventListenerOptions);
      el.removeEventListener("dblclick", nativeDbl, { capture: true } as EventListenerOptions);
    };
  };
  useEffect(() => () => { detach.current?.(); detach.current = null; }, []);
  // scorciatoie da tastiera: + / - per ingrandire e ridurre (0 non usato: reset rimosso)
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoom(0.4); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoom(-0.4); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  const dir = useRef<1 | -1>(1); // doppio click: sale fino al massimo, poi torna indietro
  const bump = () => setScale((s) => {
    const p = passoDoppioClick(s, dir.current);
    dir.current = p.verso;
    if (p.scala === SCALA_MIN) { setTx(0); setTy(0); }
    return p.scala;
  });
  bumpRef.current = bump; // il listener nativo usa sempre l'ultima closure
  const reset = () => { setScale(1); setTx(0); setTy(0); dir.current = 1; };
  const zoomed = ingrandita(scale);
  const panHandlers = {
    onPointerDown: (e: React.PointerEvent) => { if (!zoomed) return; e.preventDefault(); pan.current = { x: e.clientX - tx, y: e.clientY - ty }; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ } },
    onPointerMove: (e: React.PointerEvent) => {
      if (!pan.current) return;
      // limita lo spostamento ai bordi: non si vede mai oltre l'immagine
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const maxX = ((scale - 1) * r.width) / 2;
      const maxY = ((scale - 1) * r.height) / 2;
      setTx(Math.max(-maxX, Math.min(maxX, e.clientX - pan.current.x)));
      setTy(Math.max(-maxY, Math.min(maxY, e.clientY - pan.current.y)));
    },
    onPointerUp: () => { pan.current = null; },
  };
  const style: React.CSSProperties = { transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: "center center", transition: pan.current ? "none" : "transform .12s" };
  return { scale, tx, ty, zoomed, style, onWheel, zoom, bump, reset, panHandlers, hostRef, attachHost };
}
export function ZoomControls({ zp, onFull, full, pointerOn, onTogglePointer }: { zp: ReturnType<typeof useZoomPan>; onFull?: () => void; full?: boolean; pointerOn?: boolean; onTogglePointer?: () => void }) {
  return (
    <div data-hg-noptr onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-lg border border-white/15 bg-black/55 p-1 backdrop-blur">
      <button onClick={() => zp.zoom(-0.4)} title="Riduci" className="rounded p-1 text-white/80 hover:bg-white/15"><ZoomOut className="h-4 w-4" /></button>
      {/* la percentuale è un pulsante: UN click riporta a 100% (scale 1, pan azzerato).
          Il reset si propaga all'ospite tramite l'evento "mediazoom" già esistente
          (l'effetto su scale/tx/ty notifica il genitore che trasmette). */}
      <button onClick={zp.reset} disabled={zp.scale === 1 && zp.tx === 0 && zp.ty === 0} title="Torna al 100%"
        className="w-10 rounded px-0.5 py-1 text-center text-[10px] tabular-nums text-white/70 hover:bg-white/15 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent">
        {Math.round(zp.scale * 100)}%
      </button>
      <button onClick={zp.reset} title="Torna al 100%" className="rounded p-1 text-white/80 hover:bg-white/15"><RotateCcw className="h-4 w-4" /></button>
      <button onClick={() => zp.zoom(0.4)} title="Ingrandisci" className="rounded p-1 text-white/80 hover:bg-white/15"><ZoomIn className="h-4 w-4" /></button>
      {onFull && <button onClick={onFull} title={full ? "Riduci" : "Schermo intero"} className="rounded p-1 text-white/80 hover:bg-white/15">{full ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</button>}
      {onTogglePointer && <button onClick={onTogglePointer} title="Puntatore per indicare al cliente" className={`rounded p-1 ${pointerOn ? "bg-brand text-white" : "text-white/80 hover:bg-white/15"}`}><Pointer className="h-4 w-4" /></button>}
    </div>
  );
}
