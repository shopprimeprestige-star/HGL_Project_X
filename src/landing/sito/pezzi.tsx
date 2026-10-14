/** ── PEZZI COMUNI DELLE PAGINE NUOVE (home, Protocol, catalogo) ─────────────
 *  Sezioni, bottoni, marchio, FAQ e passi: una volta sola, così le tre pagine
 *  restano uguali fra loro senza copiare le classi.
 *
 *  Tema Blueprint di DESIGN.md: navy per la testata e la chiusura, fondi
 *  chiari con la trama fine per il resto. Un solo blu (`brand-scuro` per i
 *  bottoni: bianco sopra fa 4,88:1). Testo mai sotto 11 px, campi e bottoni
 *  da pollice (min 56 px di altezza), ombre nessuna.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { MouseEvent, ReactNode } from "react";
import logo from "@/assets/logo-hair-genius.png";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type Tono = "scuro" | "pannello" | "griglia";

const SFONDI: Record<Tono, string> = {
  scuro: "bg-blueprint text-white",
  pannello: "bg-light-panel text-ink",
  griglia: "bg-white-grid text-ink",
};

/** Una fascia della pagina: fondo, contenitore, ritmo verticale. */
export function Sezione({
  id,
  tono,
  titoloId,
  nascondiBarra,
  children,
}: {
  id?: string;
  tono: Tono;
  titoloId?: string;
  /** Mentre questa sezione è sullo schermo la barra della consulenza si nasconde (non la copre, non la ripete). */
  nascondiBarra?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={titoloId}
      data-barra-nascondi={nascondiBarra ? "vista" : undefined}
      className={`${SFONDI[tono]} scroll-mt-6`}
    >
      <div className="mx-auto max-w-5xl px-5 py-14 sm:px-6 lg:px-10 lg:py-24">{children}</div>
    </section>
  );
}

export function Titolo({ id, tono, children }: { id?: string; tono: Tono; children: ReactNode }) {
  return (
    <h2
      id={id}
      className={`max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight text-balance md:text-4xl ${
        tono === "scuro" ? "text-white" : "text-ink"
      }`}
    >
      {children}
    </h2>
  );
}

/** Classi del bottone: stessa misura ovunque, cambia solo il contorno del fuoco. */
const BASE_BOTTONE =
  "inline-flex min-h-14 w-full items-center justify-center rounded-md bg-brand-scuro px-6 py-3 text-center text-base font-semibold leading-snug text-brand-foreground transition-colors hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2";
const TONO_BOTTONE: Record<"scuro" | "chiaro", string> = {
  scuro: "border border-white/30 hover:bg-navy-light focus-visible:outline-white",
  chiaro: "focus-visible:outline-brand-scuro",
};

export function Bottone({
  href,
  tono,
  onClick,
  children,
}: {
  href: string;
  tono: "scuro" | "chiaro";
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  return (
    <a href={href} onClick={onClick} className={`${BASE_BOTTONE} ${TONO_BOTTONE[tono]}`}>
      {children}
    </a>
  );
}

/** Due bottoni della stessa misura: uno sotto l'altro sul telefono, affiancati da `sm`. */
export function GrigliaBottoni({ children }: { children: ReactNode }) {
  return (
    <div data-barra-nascondi="vista" className="grid max-w-xl gap-3 sm:grid-cols-2">
      {children}
    </div>
  );
}

export function Marchio({ nome }: { nome?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="brackets inline-flex items-center justify-center px-5 py-3">
        <span className="br-tr" />
        <span className="br-bl" />
        <img src={logo} alt="Hair Genius Labs" className="h-8 w-auto select-none md:h-9" draggable={false} />
      </div>
      {nome ? <span className="text-base font-semibold tracking-tight text-white/80">{nome}</span> : null}
    </div>
  );
}

/** Va a un'altra pagina dopo aver dato a un evento il tempo di partire (al massimo 300 ms).
 *  Senza questa attesa, su telefono la richiesta dell'evento può essere tagliata dal cambio
 *  di pagina e la misura più importante (quale strada sceglie la persona) andrebbe persa.
 *  Con i tasti speciali (apri in una scheda nuova, ecc.) il collegamento fa il suo lavoro. */
export function vaiDopo(e: MouseEvent<HTMLAnchorElement>, href: string, prima: () => Promise<unknown> | void): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    void prima();
    return;
  }
  e.preventDefault();
  const fatto = Promise.resolve(prima()).catch(() => undefined);
  const tetto = new Promise((r) => setTimeout(r, 300));
  void Promise.race([fatto, tetto]).then(() => window.location.assign(href));
}

/** Scende al modulo con la dolcezza di sempre, ma senza animazione per chi la toglie. */
export function vaiAlModulo(e: MouseEvent<HTMLAnchorElement>): void {
  const el = document.getElementById("modulo");
  if (!el) return; // senza modulo il collegamento fa il suo lavoro da solo
  e.preventDefault();
  const ridotto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: ridotto ? "auto" : "smooth", block: "start" });
  try {
    window.history.replaceState(null, "", "#modulo");
  } catch {
    // l'indirizzo resta com'è: la pagina funziona lo stesso
  }
}

export function ListaFaq({ voci }: { voci: readonly { q: string; a: string }[] }) {
  return (
    <Accordion type="single" collapsible className="mt-8 max-w-3xl border-t border-ink/15">
      {voci.map((v, i) => (
        <AccordionItem key={v.q} value={`faq-${i}`} className="border-ink/15">
          <AccordionTrigger className="min-h-14 gap-4 py-4 text-base font-semibold leading-snug text-ink hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:text-lg [&>svg]:text-ink-muted">
            {v.q}
          </AccordionTrigger>
          <AccordionContent className="max-w-2xl pb-5 text-base leading-relaxed text-ink-muted">{v.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/** I passi in ordine: qui il numero dice qualcosa (prima, poi, infine). */
export function Passi({ voci }: { voci: readonly string[] }) {
  return (
    <ol className="mt-8 grid list-none gap-6 p-0 md:grid-cols-3 md:gap-8">
      {voci.map((v, i) => (
        <li key={v} className="border-t border-ink/15 pt-4">
          <span className="text-3xl font-bold tabular-nums text-brand" aria-hidden="true">
            {i + 1}
          </span>
          <p className="mt-2 text-lg font-semibold leading-snug text-ink">
            <span className="sr-only">Passo {i + 1}: </span>
            {v}
          </p>
        </li>
      ))}
    </ol>
  );
}
