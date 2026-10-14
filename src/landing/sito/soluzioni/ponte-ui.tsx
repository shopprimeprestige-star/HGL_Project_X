/** ── PONTE · I COMPONENTI DI S2 E S4 USATI DA S3 ───────────────────────────────────────────────
 *  ⚠️ SEGNAPOSTO TEMPORANEO, come `ponte.ts`. Stesse firme del contratto del PIANO; il disegno è il minimo per
 *  provare la composizione (struttura, ordine, cosa c'è e cosa no). ALL'UNIONE diventa:
 *
 *    export { Foto } from "./Foto";
 *    export { VideoParlato } from "./VideoParlato";
 *    export { ClipLoop } from "./ClipLoop";
 *    export { BottonePrimario, BottoneContorno, LinkAzione } from "./Azioni";
 *    export { PRECARICA_FONT_SOLUZIONI } from "./font";
 *    export { FoglioModulo } from "./FoglioModulo";
 *    export { BarraPatch } from "./BarraPatch";
 *    export { Footer } from "@/components/landing/Footer";   // e in PaginaSoluzioni: <Footer variante="minimo" />
 *
 *  IPOTESI da verificare con le firme vere (LAVAGNA, voce S3):
 *   · Azioni: un solo componente per ruolo; con `href` disegna un <a>, senza un <button type="button">; accetta
 *     `className`, `ref` e gli attributi nativi (aria-*, data-*, onClick); NON aggiunge la freccia (è nel testo).
 *   · Foto: `priorita` = eager + fetchpriority high; senza = lazy.
 *   · FoglioModulo: `rientro` = ref dell'elemento a cui rendere il fuoco alla chiusura.
 *   · BarraPatch: si posiziona da sola (in alto da 1024, in basso sotto) e riserva il suo spazio dove sta messa.
 *  ───────────────────────────────────────────────────────────────────────────────────────────── */
import type { MouseEvent, ReactNode, Ref, RefObject } from "react";
import { LINK_CATALOGO, TESTI_SOLUZIONI } from "@/landing/testi-sito";
import type { FormatoMedia, Interesse, Slot } from "./ponte";

export const PRECARICA_FONT_SOLUZIONI: readonly Record<string, string>[] = [];

export function Foto({
  slot,
  larghezza,
  altezza,
  priorita,
  posizione,
  className,
}: {
  slot: Slot | null;
  formato: FormatoMedia;
  larghezza: number;
  altezza: number;
  priorita?: boolean;
  posizione?: string;
  className?: string;
}) {
  if (!slot) return null;
  return (
    <img
      src={slot.src}
      alt={slot.alt}
      width={larghezza}
      height={altezza}
      loading={priorita ? "eager" : "lazy"}
      {...(priorita ? { fetchPriority: "high" as const } : {})}
      decoding="async"
      className={className}
      style={posizione ? { objectPosition: posizione } : undefined}
    />
  );
}

export function VideoParlato({
  slot,
  testi,
  trascrizione,
}: {
  slot: Slot;
  formato: "4:5";
  testi: { pillola: string; riguarda: string; etichettaPlay: string; leggiTesto: string };
  trascrizione: string | null;
  priorita?: boolean;
}) {
  return (
    <div>
      <button type="button" aria-label={testi.etichettaPlay} data-video={slot.src}>
        <img src={slot.poster} alt={slot.alt} width={481} height={601} />
        <span>{testi.pillola}</span>
      </button>
      {trascrizione ? (
        <details>
          <summary>{testi.leggiTesto}</summary>
          <p>{trascrizione}</p>
        </details>
      ) : null}
    </div>
  );
}

export function ClipLoop({
  slot,
  descrizione,
  didascalia,
  etichette,
}: {
  slot: Slot;
  formato: "4:5";
  descrizione: string;
  didascalia: string;
  etichette: { ferma: string; riparti: string };
}) {
  return (
    <figure>
      <video muted loop playsInline preload="none" aria-hidden="true" data-src={slot.src} poster={slot.poster} />
      <span className="sr-only">{descrizione}</span>
      <button type="button">{etichette.ferma}</button>
      <figcaption>{didascalia}</figcaption>
    </figure>
  );
}

type PropsAzione = {
  href?: string;
  className?: string;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  [attributo: `aria-${string}`]: string | boolean | undefined;
  [attributo: `data-${string}`]: string | undefined;
};

function Azione({ href, children, ref, ...resto }: PropsAzione) {
  return href ? (
    <a href={href} ref={ref as Ref<HTMLAnchorElement>} {...resto}>
      {children}
    </a>
  ) : (
    <button type="button" ref={ref as Ref<HTMLButtonElement>} {...resto}>
      {children}
    </button>
  );
}

/** Ruolo «primario»: l'unico bottone blu. Porta `data-barra-nascondi="fondo"`. */
export function BottonePrimario(props: PropsAzione) {
  return <Azione data-barra-nascondi="fondo" data-ruolo="primario" {...props} />;
}
/** Ruolo «contorno»: solo «Che cos'è Invisible Derm?» / «Chiudi la spiegazione». */
export function BottoneContorno(props: PropsAzione) {
  return <Azione data-ruolo="contorno" {...props} />;
}
/** Ruolo «link d'azione». */
export function LinkAzione(props: PropsAzione) {
  return <Azione data-ruolo="link" {...props} />;
}

/** S2: `<Footer variante="minimo" />`. Qui solo i link legali, niente promessa, niente contatti. */
export function FooterMinimo() {
  return (
    <footer>
      <a href="/privacy-policy">Privacy</a> <a href="/cookie-policy">Cookie</a> <a href="/termini-e-condizioni">Termini</a>
    </footer>
  );
}

export function FoglioModulo(_: { aperto: boolean; interesse: Interesse; onChiudi: () => void; rientro: RefObject<HTMLElement | null> }) {
  return null;
}

export function BarraPatch() {
  return (
    <a href={LINK_CATALOGO} aria-label={TESTI_SOLUZIONI.barra.etichettaAccessibile} data-barra-patch="">
      {TESTI_SOLUZIONI.barra.testo}
    </a>
  );
}
