/** ── PAGINE 404 E 500 DELLO SHOP (V1 · T83, documento §3.2 e §4.5.10) ─────────
 *  Una card bianca centrata (`max-w-xl`) su `bg-light-panel`, l'icona in tondo, un h1, il testo, «Patch pronte» (pieno) e «Cura» (link).
 *  Nessuna illustrazione. Si montano come `notFoundComponent` / `errorComponent` delle rotte V1 (T93), cioè dentro il guscio nuovo.
 *  ⚠️ Non leggono NIENTE dal router (né parametri, né dati del loader, né contesto): nel punto in cui la radice li mostra quei dati non ci sono.
 *  Il 500 non mostra mai l'errore vero. Il contatto compare solo se `assistenza` è un testo confermato dal titolare (D63, D87): una sola porta, `filtraConfermati`. */
import { SearchX, TriangleAlert } from "lucide-react";
import { TESTI_PROVVISORI, TESTI_SHOP } from "@/landing/testi-shop";
import { HREF_CURA, HREF_PATCH_PRONTE } from "@/shop/cms/vetrina-carrello";
import { filtraConfermati } from "@/shop/cms/testi-confermati";
import { StatoVuoto, type AzioneStato } from "../StatoVuoto";

/** La card: sempre la stessa per 404 e 500. Solo il filo del bordo, senza ombra (l'ombra è di ciò che galleggia) e senza sollevamento al passaggio del mouse: non è cliccabile. */
function SchedaCentrata({ children }: { children: React.ReactNode }) {
  return (
    <section data-pagina-errore className="bg-light-panel px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-xl rounded-[14px] border border-ink/10 bg-white px-6 py-10 sm:px-10 sm:py-12">{children}</div>
    </section>
  );
}

/** Dove si va da una pagina che non c'è o che si è rotta: le patch (pieno, o contorno se c'è già un «Riprova») e la cura (link). */
const vaiA = (pieno: boolean): AzioneStato[] => [
  { testo: TESTI_SHOP.err404.bottone, href: HREF_PATCH_PRONTE, aspetto: pieno ? "pieno" : "contorno" },
  { testo: TESTI_SHOP.err404.link, href: HREF_CURA, aspetto: "link" },
];

export function PaginaNonTrovata() {
  return (
    <SchedaCentrata>
      <StatoVuoto livello="h1" icona={SearchX} titolo={TESTI_SHOP.err404.titolo} testo={TESTI_SHOP.err404.testo} azioni={vaiA(true)} />
    </SchedaCentrata>
  );
}

export interface PaginaErroreProps {
  /** I testi confermati dal titolare (l'uscita di `confermatiDa`): se `assistenza` è scritta e vera, si legge sotto il testo. */
  confermati?: unknown;
  /** Ripete il caricamento (il `reset` del router). Senza, il bottone «Riprova» non c'è. */
  riprova?: () => void;
}

export function PaginaErrore({ confermati, riprova }: PaginaErroreProps) {
  const contatto = filtraConfermati(confermati).assistenza;
  const azioni: AzioneStato[] = riprova
    ? [{ testo: TESTI_PROVVISORI.errore.riprova, onClick: riprova, aspetto: "pieno" }, ...vaiA(false)]
    : vaiA(true);
  return (
    <SchedaCentrata>
      <StatoVuoto livello="h1" icona={TriangleAlert} titolo={TESTI_SHOP.err500.titolo} testo={[TESTI_SHOP.err500.testo, contatto]} azioni={azioni} />
    </SchedaCentrata>
  );
}
