/** ── IL CURSORE DEL CONFRONTO «Patch standard / Invisible Derm» ─────────────
 *  Due immagini della stessa inquadratura una sopra l'altra: la patch standard è ritagliata
 *  dal lato destro, si vede la parte a sinistra del manico. Senza librerie.
 *  - `pos` = % di patch standard visibile (50 all'inizio). Il server disegna già il 50%.
 *  - Mouse, dito e penna con i pointer events; `touch-action: pan-y` lascia libero lo
 *    scorrimento verticale della pagina.
 *  - Tastiera sul pomello (role="slider"): frecce ±5, Maiusc+frecce o Pagina su/giù ±20,
 *    Home = tutta Invisible Derm, Fine = tutta la patch standard.
 *  - Etichette neutre e identiche; mai «Prima/Dopo». Se manca UNA delle due immagini la
 *    coppia sparisce intera (mai mezza foto).
 *  shortcut: nessuna transizione nemmeno al tocco su un punto (la richiesta 120 ms è facoltativa),
 *   aggiungerla se il salto sembra brusco. */
import { useId, useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";
import { trackClick } from "@/landing/booking/tracking";
import { CONFRONTO, DIDASCALIA_COPPIA } from "@/landing/testi-invisible-derm";

type Props = {
  numero: number;
  titolo: string;
  /** chiave della coppia per il tracciamento, es. "id.confronto1" */
  coppia: string;
  patch: string;
  derm: string;
  /** descrizione della coppia (va sull'immagine di base) */
  alt: string;
  /** la prima coppia si carica subito, le altre in lazy */
  subito?: boolean;
  /** classi Tailwind della proporzione e della larghezza */
  className?: string;
  /** etichette sinistra/destra (di base patch standard / Invisible Derm) */
  etichette?: { patch: string; derm: string };
  didascalia?: string;
};

const limita = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export function CursoreConfronto({ numero, titolo, coppia, patch, derm, alt, subito, className = "aspect-[4/5]", etichette = CONFRONTO.etichette, didascalia = DIDASCALIA_COPPIA }: Props) {
  const [pos, setPos] = useState(50);
  const cornice = useRef<HTMLDivElement>(null);
  const premuto = useRef(false);
  const mosso = useRef(false);
  const istruzione = useId();
  if (!patch || !derm) return null;

  const interazione = () => trackClick("confronto_interazione", { coppia }, { dedupKey: `confronto:${coppia}` });
  const vaiA = (n: number) => {
    setPos(limita(n));
    interazione();
  };
  const daPuntatore = (clientX: number) => {
    const r = cornice.current?.getBoundingClientRect();
    if (r && r.width > 0) vaiA(((clientX - r.left) / r.width) * 100);
  };
  const tasto = (e: React.KeyboardEvent) => {
    const passo = e.shiftKey ? 20 : 5;
    const nuovo =
      e.key === "ArrowLeft" ? pos - passo
      : e.key === "ArrowRight" ? pos + passo
      : e.key === "PageUp" ? pos + 20
      : e.key === "PageDown" ? pos - 20
      : e.key === "Home" ? 0
      : e.key === "End" ? 100
      : null;
    if (nuovo === null) return;
    e.preventDefault();
    vaiA(nuovo);
  };
  const etichetta = "min-h-11 bg-[#081634]/90 px-3 text-etichetta font-semibold uppercase tracking-[0.18em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <figure className="mx-auto w-full">
      <h3 className="mb-3 text-center text-xl font-bold text-white md:text-2xl">
        <span className="text-brand">{numero} ·</span> {titolo}
      </h3>
      <p id={istruzione} className="mb-2 flex items-center justify-center gap-2 text-sm text-white/75">
        <MoveHorizontal className="h-4 w-4" aria-hidden="true" />
        {CONFRONTO.istruzione}
      </p>
      <div
        ref={cornice}
        className={`relative mx-auto w-full select-none overflow-hidden rounded-md border border-white/15 bg-blueprint-fine ${className}`}
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => {
          premuto.current = true;
          mosso.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
          // col dito il tocco sposta solo se non è l'inizio di uno scorrimento (vedi onPointerUp)
          if (e.pointerType !== "touch") daPuntatore(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!premuto.current) return;
          mosso.current = true;
          daPuntatore(e.clientX);
        }}
        onPointerUp={(e) => {
          if (premuto.current && !mosso.current && e.pointerType === "touch") daPuntatore(e.clientX);
          premuto.current = false;
        }}
        onPointerCancel={() => {
          premuto.current = false;
        }}
      >
        <img src={derm} alt={alt} loading={subito ? "eager" : "lazy"} decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={patch} alt="" aria-hidden="true" loading={subito ? "eager" : "lazy"} decoding="async" draggable={false} className="h-full w-full object-cover" />
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white" style={{ left: `${pos}%` }} />
        <div
          role="slider"
          tabIndex={0}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pos}
          aria-valuetext={`${etichette.patch} ${pos}%, ${etichette.derm} ${100 - pos}%`}
          aria-label={`Confronto: ${titolo.toLowerCase()}`}
          aria-describedby={istruzione}
          onKeyDown={tasto}
          className="absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#081634] bg-white text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ left: `clamp(22px, ${pos}%, calc(100% - 22px))` }}
        >
          <MoveHorizontal className="h-5 w-5" aria-hidden="true" />
        </div>
        <button type="button" aria-pressed={pos === 100} onPointerDown={(e) => e.stopPropagation()} onClick={() => vaiA(100)} className={`absolute left-0 top-0 rounded-br-md ${etichetta}`}>
          {etichette.patch}
        </button>
        <button type="button" aria-pressed={pos === 0} onPointerDown={(e) => e.stopPropagation()} onClick={() => vaiA(0)} className={`absolute right-0 top-0 rounded-bl-md ${etichetta}`}>
          {etichette.derm}
        </button>
      </div>
      <figcaption className="mt-3 text-center text-sm text-white/75">{didascalia}</figcaption>
    </figure>
  );
}
