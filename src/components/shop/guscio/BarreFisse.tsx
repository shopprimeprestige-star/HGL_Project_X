/** ── BARRE FISSE DELLO SHOP SUL TELEFONO · VETRINA V1 · T84a (D83, V1-H5, V1-S6, V1-K1) ───────────────────────
 *  `BarraAcquisto` (scheda: miniatura, nome, prezzo, [Aggiungi al carrello]) e `BarraCarrello` (carrello: «Totale · Vai alla
 *  cassa»), più `useAltezzaBanner`, che dice alle barre quanto spazio occupa il banner dei cookie.
 *  Documento del Design §4.5 «Barra d'acquisto» e §4.5.12:
 *   · compaiono SOLO sotto i 1024 px (sopra, il blocco d'acquisto è `sticky` e il riepilogo sta a destra), quando il blocco
 *     marcato `data-barra-nascondi="vista"` (nome-prezzo-bottone; sul carrello il bottone del riepilogo) è FUORI dallo schermo;
 *   · fondo bianco, bordo alto `ink/10`, `shadow-galleggiante`, bottone «notte»; mai il blu della consulenza, mai il rosso;
 *   · nascoste = `inert` (Tab non le raggiunge) e fuori schermo; lo spazio in fondo alla pagina resta riservato (72 px + zona
 *     dei gesti, `spazioRiservato`) così la pagina non salta e il piè di pagina non finisce sotto la barra;
 *   · stanno SOPRA il banner (z-40 contro z-50): `bottom: var(--banner-h)`, scritto da `useAltezzaBanner` su `[data-shop-v1]`;
 *   · il carrello vuoto non ha né barra né spazio. La barra della consulenza non c'è mai insieme a queste (`barraFissa`, T79).
 *  ⚠️ Prezzi: solo `PrezzoVista` (T79) → `testoPrezzo`. Mai la memoria del browser, mai una cifra scritta qui.
 *  ⚠️ Testi: solo `testi-shop.ts`. ⚠️ Chi disegna la scheda e il carrello (T97b, T98) deve mettere `ATTRIBUTO_BLOCCO` sul blocco d'acquisto
 *   (sul carrello, sul bottone del riepilogo) e montare la barra giusta in base a `barraFissa(percorso, stato)`.
 *
 *  DECISIONE (D83, «tra 640 e 1023 px: decisione del dev»): il banner sotto i 640 px è una barra a tutta larghezza, da 640 è una
 *  scheda in basso a sinistra larga fino a 448 px. `--banner-h` NON è l'altezza del banner ma quanto schermo occupa dal basso
 *  (altezza + distanza dal fondo: sotto i 640 px sono la stessa cosa). Così le barre stanno sopra il banner a ogni larghezza
 *  sotto i 1024 px, senza sovrapporsi, e senza spostarle a destra (a 640 px a destra resterebbero 176 px: non bastano). T103c lo guarda. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { FotoShop } from "@/components/shop/FotoShop";
import { TESTI_SHOP } from "@/landing/testi-shop";
import { spazioRiservato } from "@/shop/cms/vetrina-barre";
import { barraCarrello, testoPrezzo, type PrezzoVista } from "@/shop/cms/vetrina-carrello";
import type { MisureFoto } from "@/shop/cms/vetrina-foto";

/* ── la parte pura: quando una barra deve farsi da parte ─────────────────── */

/** Un blocco marcato `data-barra-nascondi`, misurato: `tipo` è il valore dell'attributo; le altre sono le misure dello schermo. */
export interface BloccoMisurato {
  tipo: string | undefined;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/** Va messo sul blocco d'acquisto (scheda) e sul bottone del riepilogo (carrello): finché è a schermo la barra si nasconde. */
export const ATTRIBUTO_BLOCCO = { "data-barra-nascondi": "vista" } as const;

/** `alto` = l'altezza UTILE dello schermo: quella sopra il banner dei cookie (`innerHeight - altezzaBanner`), perché ciò che sta dietro il banner non
 *  si vede e non si tocca. Un blocco copre la barra se una sua parte è nell'area utile; un blocco tutto sotto il banner conta come uscito (la barra compare).
 *  Un blocco senza dimensioni (`display:none`) o con un valore sconosciuto non conta. */
export function bloccoCopre(blocchi: readonly BloccoMisurato[], alto: number): boolean {
  return blocchi.some((b) => !(b.width === 0 && b.height === 0) && b.tipo === "vista" && b.bottom > 0 && b.top < alto);
}

/** Quanto schermo occupa il banner dei cookie, dal basso, in px interi (0 se non c'è, mai oltre lo schermo). */
export function altezzaBanner(rect: { top: number; height: number } | null | undefined, alto: number): number {
  if (!rect || !(rect.height > 0) || !Number.isFinite(rect.top) || !Number.isFinite(alto)) return 0;
  return Math.min(alto, Math.max(0, Math.round(alto - rect.top)));
}

/* ── il collegamento al browser (funzioni, così si provano con un documento finto) ──────────── */

type Finestra = Window & typeof globalThis;

/** Un solo ricalcolo per fotogramma, comunque molti siano gli eventi. */
function perFotogramma(win: Finestra, f: () => void) {
  let n = 0;
  return {
    pianifica: () => {
      if (!n) n = win.requestAnimationFrame(() => ((n = 0), f()));
    },
    annulla: () => {
      if (n) win.cancelAnimationFrame(n);
      n = 0;
    },
  };
}

export function misuraBlocchi(doc: Document): BloccoMisurato[] {
  return Array.from(doc.querySelectorAll<HTMLElement>("[data-barra-nascondi]"), (el) => {
    const r = el.getBoundingClientRect();
    return { tipo: el.dataset.barraNascondi, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  });
}

const bannerDi = (doc: Document) => doc.querySelector("[data-banner-cookie]");
const radiceShop = (doc: Document) => doc.querySelector<HTMLElement>("[data-shop-v1]");

/** Chiama `quandoCambia` quando il banner arriva, se ne va o cambia altezza (preferenze aperte) e quando cambia l'elemento `[data-shop-v1]`. */
function seguiBanner(win: Finestra, doc: Document, quandoCambia: () => void): () => void {
  let osservato: Element | null = null;
  const ridimensiona = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(quandoCambia) : null;
  const cambiaPagina = typeof win.MutationObserver === "function" ? new win.MutationObserver(() => {
    const banner = bannerDi(doc);
    if (banner !== osservato) {
      if (osservato) ridimensiona?.unobserve(osservato);
      if (banner) ridimensiona?.observe(banner);
      osservato = banner;
    }
    quandoCambia();
  }) : null;
  osservato = bannerDi(doc);
  if (osservato) ridimensiona?.observe(osservato);
  cambiaPagina?.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-shop-v1", "data-banner-cookie"] });
  return () => {
    cambiaPagina?.disconnect();
    ridimensiona?.disconnect();
  };
}

/** Rilegge le posizioni subito e poi a ogni scorrimento, ridimensionamento, cambio d'altezza della pagina (contenuti che arrivano dopo) e del banner.
 *  L'altezza utile è quella sopra il banner. Restituisce la funzione che scollega tutto. */
export function collegaBlocchi(win: Finestra, doc: Document, quandoCambia: (copre: boolean) => void): () => void {
  const verifica = () => quandoCambia(bloccoCopre(misuraBlocchi(doc), win.innerHeight - altezzaBanner(bannerDi(doc)?.getBoundingClientRect(), win.innerHeight)));
  const r = perFotogramma(win, verifica);
  verifica();
  win.addEventListener("scroll", r.pianifica, { passive: true });
  win.addEventListener("resize", r.pianifica);
  const osserva = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(r.pianifica) : null;
  osserva?.observe(doc.body);
  const scollegaBanner = seguiBanner(win, doc, r.pianifica);
  return () => {
    win.removeEventListener("scroll", r.pianifica);
    win.removeEventListener("resize", r.pianifica);
    osserva?.disconnect();
    scollegaBanner();
    r.annulla();
  };
}

/** Una proprietà scritta su `[data-shop-v1]`: si ricorda l'elemento su cui si è scritto, così la toglie da lì anche se l'attributo nel frattempo è sparito. */
function proprietaSuRadice(doc: Document, nome: string) {
  let scritto: HTMLElement | null = null;
  return {
    scrivi: (valore: string | null) => {
      const radice = radiceShop(doc);
      if (scritto && scritto !== radice) scritto.style.removeProperty(nome);
      scritto = radice;
      if (valore === null) radice?.style.removeProperty(nome);
      else radice?.style.setProperty(nome, valore);
    },
    togli: () => scritto?.style.removeProperty(nome),
  };
}

/** Scrive `--banner-h` su `[data-shop-v1]`: lo segue quando il banner arriva, cambia altezza o se ne va. */
export function collegaAltezzaBanner(win: Finestra, doc: Document): () => void {
  const banner = proprietaSuRadice(doc, "--banner-h");
  const scrivi = () => banner.scrivi(`${altezzaBanner(bannerDi(doc)?.getBoundingClientRect(), win.innerHeight)}px`);
  const r = perFotogramma(win, scrivi);
  const scollegaBanner = seguiBanner(win, doc, r.pianifica);
  win.addEventListener("resize", r.pianifica);
  scrivi();
  return () => {
    r.annulla();
    scollegaBanner();
    win.removeEventListener("resize", r.pianifica);
    banner.togli();
  };
}

/** Il fuoco non deve finire sotto la barra (WCAG 2.4.11): `src/styles.css` legge `--barra-h` (+ 16 px) come `scroll-padding-bottom`.
 *  Qui lo scrive: l'altezza vera della barra (0 sopra i 1024 px, dove è `display:none`) più il banner che le sta sotto. */
export function collegaBarraH(win: Finestra, doc: Document, barra: HTMLElement): () => void {
  const proprieta = proprietaSuRadice(doc, "--barra-h");
  const scrivi = () => {
    const h = barra.offsetHeight;
    proprieta.scrivi(h > 0 ? `calc(var(--banner-h, 0px) + ${h}px)` : null);
  };
  const osserva = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(scrivi) : null;
  osserva?.observe(barra);
  scrivi();
  return () => {
    osserva?.disconnect();
    proprieta.togli();
  };
}

/** Da montare una volta sola, nel guscio (T93): tiene `--banner-h` aggiornato. */
export function useAltezzaBanner(): void {
  useEffect(() => collegaAltezzaBanner(window, document), []);
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

/** La zona dei gesti dell'iPhone si lascia solo se sotto non c'è il banner (che ha già la sua). */
const ZONA_GESTI = "max(0px, calc(env(safe-area-inset-bottom, 0px) - var(--banner-h, 0px)))";

/** Parte «coperta» (nascosta) e si scopre solo dopo il primo controllo, fatto prima del disegno: mai un fotogramma sopra il bottone. */
function useBlocchiCoprono(attiva: boolean) {
  const rif = useRef<HTMLDivElement | null>(null);
  const [copre, setCopre] = useState(true);
  useLayoutEffect(() => {
    if (!attiva) return;
    return collegaBlocchi(window, document, setCopre);
  }, [attiva]);
  return { rif, copre };
}

function useBarraH(rif: RefObject<HTMLDivElement | null>, visibile: boolean) {
  useEffect(() => {
    const barra = rif.current;
    if (!visibile || !barra) return;
    return collegaBarraH(window, document, barra);
  }, [rif, visibile]);
}

/** Lo spazio riservato e la barra. `rif` serve a misurarla. Nascosta: `inert`, invisibile e spostata fuori dallo schermo. */
export function ContenitoreBarra({ visibile, etichetta, rif, children }: { visibile: boolean; etichetta: string; rif?: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  return (
    <>
      <div aria-hidden="true" data-barra-spazio="" className="lg:hidden" style={{ height: spazioRiservato("acquisto") }} />
      <div
        ref={rif}
        role="region"
        aria-label={etichetta}
        data-barra-fissa="acquisto"
        data-nascosta={visibile ? undefined : ""}
        inert={!visibile}
        style={{ paddingBottom: ZONA_GESTI }}
        className={`fixed inset-x-0 bottom-[var(--banner-h,0px)] z-40 border-t border-ink/10 bg-white shadow-galleggiante transition-[translate,visibility] duration-200 motion-reduce:transition-none lg:hidden ${
          visibile ? "translate-y-0" : "invisible translate-y-full"
        }`}
      >
        {/* 71 px + 1 px di bordo = i 72 del Design (§4.5), quanto lo spazio riservato: la pagina non scatta e il piè di pagina non resta sotto. */}
        <div className="mx-auto flex h-[71px] max-w-6xl items-center gap-3 px-4">{children}</div>
      </div>
    </>
  );
}

/** Bottone pieno «notte» 48 px (Design §4.2.4); disabilitato = bordo e testo attenuati, mai un riempimento grigio. */
const BOTTONE =
  "shop-anello inline-flex h-12 shrink-0 items-center justify-center rounded-md border-2 border-transparent bg-[#0A1430] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1B2A4E] disabled:border-ink/30 disabled:bg-white disabled:text-ink-muted disabled:hover:bg-white";

interface PropsAcquisto {
  nome: string;
  /** Il prezzo della variante scelta, dal server (`PrezzoVista`). */
  prezzo: PrezzoVista;
  /** Centesimi → «289,00 €». */
  formatta: (cent: number) => string;
  /** Le misure della foto della variante; senza, nessuna miniatura. */
  foto?: Partial<MisureFoto> | null;
  esaurito?: boolean;
  /** I 2 secondi di «Aggiunto» (`statoAggiunta`, T105). */
  aggiunto?: boolean;
  /** Lo stesso gesto del bottone nel blocco: aggiunge, oppure (manca una scelta) porta il fuoco alla scelta, che scorre fin lì. */
  onAggiungi: () => void;
}

export function BarraAcquisto({ nome, prezzo, formatta, foto, esaurito = false, aggiunto = false, onAggiungi }: PropsAcquisto) {
  const { rif, copre } = useBlocchiCoprono(true);
  useBarraH(rif, !copre);
  const t = TESTI_SHOP.scheda;
  return (
    <ContenitoreBarra visibile={!copre} etichetta={t.aggiungi} rif={rif}>
      {/* La miniatura non dice niente che il nome accanto non dica: alt vuoto. Sotto i 360 px (359,98 = prima di 360) il posto serve al nome. */}
      <FotoShop foto={foto} alt="" uso="miniatura" className="h-12 w-12 shrink-0 rounded-md max-[359.98px]:hidden" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink-muted">{nome}</p>
        <p className="text-base font-semibold tabular-nums text-ink">{testoPrezzo(prezzo, formatta)}</p>
      </div>
      <button type="button" onClick={onAggiungi} disabled={esaurito} className={BOTTONE}>
        <span aria-live="polite" className="inline-flex items-center gap-2">
          {aggiunto && !esaurito && <Check className="shop-pop h-4 w-4" aria-hidden="true" />}
          {esaurito ? t.esaurito : aggiunto ? t.aggiunto : t.aggiungi}
        </span>
      </button>
    </ContenitoreBarra>
  );
}

interface PropsCarrello {
  /** Quante righe si VEDONO (`vista.righe.length`): con 0 non c'è barra e non c'è spazio. */
  righe: number;
  totale: PrezzoVista;
  formatta: (cent: number) => string;
}

export function BarraCarrello({ righe, totale, formatta }: PropsCarrello) {
  const conRighe = barraCarrello({ righe }).visibile;
  const { rif, copre } = useBlocchiCoprono(conRighe);
  // Regola di T79: la barra c'è con righe e senza il bottone del riepilogo a schermo.
  const { visibile } = barraCarrello({ righe, nascondiConBottone: copre });
  useBarraH(rif, visibile);
  if (!conRighe) return null;
  const t = TESTI_SHOP.carrello;
  return (
    <ContenitoreBarra visibile={visibile} etichetta={t.vaiAllaCassa} rif={rif}>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-muted">{t.totale}</p>
        <p className="text-lg font-semibold tabular-nums text-ink">{testoPrezzo(totale, formatta)}</p>
      </div>
      {/* Sempre la cassa di oggi (`PERCORSO_CASSA`): la prova controlla che l'indirizzo sia lo stesso. */}
      <Link to="/shop/checkout" className={BOTTONE}>
        {t.vaiAllaCassa}
      </Link>
    </ContenitoreBarra>
  );
}
