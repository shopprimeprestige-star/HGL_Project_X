/** ── L'HEADER DELLO SHOP (VETRINA V1 · T82a) ──────────────────────────────────────────────────────────────────
 *  Documento del Design §4.5.1 e PIANO-V1 D84. Una riga sola, `sticky`, fondo notte al 95 % e NIENTE sfocatura dello sfondo
 *  (su un header che scorre sopra foto pesanti costa troppo ai telefoni economici).
 *  · Telefono: logo · [ricerca] · carrello (con numerino) · menu, tre tasti da 44 px. Computer: logo · Patch pronte · Cura ·
 *    Consulenza gratuita · [ricerca] · carrello.
 *  · «Cura» = tendina con SOLO le categorie che hanno prodotti (una categoria senza prodotti non esiste, Design §4.14 n. 11).
 *  · «Consulenza gratuita» = voce di testo con sottolineatura (mai un bottone pieno): apre `PannelloProblemi` (in ritardo) col
 *    punto d'ingresso «pannello», e conta `ClickConsulenza` (D84).
 *  · Il menu del telefono è un foglio Radix Dialog che si scarica al primo tocco (`MenuTelefono`); il fuoco torna al suo tasto
 *    con il riduttore `foglio` di `vetrina-interazioni`, ma non se si è scelta una voce (si è partiti per un'altra pagina).
 *  Cosa NON fa: la ricerca è di `RicercaShop` (T82b), che si monta nel posto `ricerca`; «Assistenza» e «Domande» del menu del Design
 *  non ci sono, perché le pagine di servizio sono V2. Il fuoco vero, Esc e `aria-live` si guardano nel browser (T103c, T106).
 *  `GuscioShop` (T93) mette `id="contenuto"` (con `tabIndex={-1}`) sul `main`: è il bersaglio di «Vai al contenuto». */
import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Menu, ShoppingBag } from "lucide-react";
import logo from "@/assets/logo-hair-genius.png";
import { traccia, type NomeEvento } from "@/landing/consulenza/eventi";
import { riempi, TESTI_PROVVISORI, TESTI_SHOP } from "@/landing/testi-shop";
import { useCart } from "@/shop/CartContext";
import type { CategoriaPubblica } from "@/shop/cms/modello";
import { FOGLIO_CHIUSO, foglio, TENDINA_CHIUSA, voceEvidenziata, type StatoFoglio, type StatoTendina } from "@/shop/cms/vetrina-interazioni";

const MenuTelefono = lazy(() => import("./MenuTelefono"));
const PannelloProblemi = lazy(() => import("@/components/landing/consulenza/PannelloProblemi"));

/** L'`id` del contenuto della pagina: il bersaglio di «Vai al contenuto». */
export const ID_CONTENUTO = "contenuto";
/** Chi apre il foglio del menu: il riduttore `foglio` lo ricorda e alla chiusura dice a chi restituire il fuoco. */
export const ID_TASTO_MENU = "tasto-menu";

/** Testi che il documento non dà (nome della navigazione per chi usa lo schermo parlato, titolo del foglio): provvisori, senza parole
 *  vietate, per il copywriter. Niente altro è scritto qui: tutto il resto viene da `testi-shop.ts`. */
export const TESTI_HEADER_PROVVISORI = { navPrincipale: "Principale", titoloMenu: "Menu" };

/** Il conteggio del clic su «Consulenza gratuita» (SPEC n. 22: solo contatore interno, mai alle piattaforme).
 *  shortcut: il nome non è ancora in `NomeEvento` (`eventi.ts` non è di T82a), si dichiara qui con un cast; si toglie quando lo aggiunge chi ne è proprietario. */
const EVENTO_CLIC_CONSULENZA = "ClickConsulenza" as NomeEvento;

const T = TESTI_SHOP;
const GUSCIO = TESTI_PROVVISORI.guscio;

/* ── funzioni pure ─────────────────────────────────────────────────────────────────────────────────────────── */

/** La categoria delle patch: ha il nome della voce «Patch pronte». Non è mai una voce di «Cura». */
const CATEGORIA_PATCH = T.categorie.find((c) => c.nome === T.header.patch);
const hrefCategoria = (slug: string) => `/shop/c/${slug}`;
/** Lo slug e l'indirizzo di «Patch pronte» (la categoria con quel nome nel documento). */
export const SLUG_PATCH = CATEGORIA_PATCH?.slug ?? "";
export const HREF_PATCH = hrefCategoria(SLUG_PATCH);

export interface VoceCura {
  slug: string;
  nome: string;
  href: string;
}

/** Le voci di «Cura»: le categorie del documento (nel loro ordine, con i loro nomi) che hanno almeno un prodotto pubblicato.
 *  Elenco mancante o rotto (guasto del server) = nessuna voce, e «Cura» non si disegna. */
export function vociCura(categorie: readonly Pick<CategoriaPubblica, "slug" | "quanti">[] | null | undefined): VoceCura[] {
  const conProdotti = new Set<string>();
  for (const c of Array.isArray(categorie) ? (categorie as readonly unknown[]) : []) {
    const { slug, quanti } = (c ?? {}) as { slug?: unknown; quanti?: unknown };
    if (typeof slug === "string" && typeof quanti === "number" && Number.isInteger(quanti) && quanti > 0) conProdotti.add(slug);
  }
  return T.categorie
    .filter((c) => c.slug !== CATEGORIA_PATCH?.slug && conProdotti.has(c.slug))
    .map((c) => ({ slug: c.slug, nome: c.nome, href: hrefCategoria(c.slug) }));
}

/** Il numero nel pallino del carrello: niente a zero (o dato sbagliato), «99+» oltre 99. */
export function numerinoCarrello(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return "";
  return n > 99 ? "99+" : String(n);
}

/** La parola «Carrello» di «Carrello ({n})»: il numero sta nel pallino. */
const PAROLA_CARRELLO = T.header.carrello.replace(/\s*\(\{n\}\)\s*$/, "");

/* ── stile ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/** Tasto da 44 × 44 px, senza fondo: il fuoco è l'anello bianco di D100. */
const TASTO = "shop-anello-scuro inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/10";
/** Una voce della riga sul computer. */
const VOCE = "shop-anello-scuro inline-flex min-h-11 items-center border-b-2 border-transparent text-[15px] font-medium text-white/85 hover:text-white aria-[current=page]:border-white aria-[current=page]:text-white";

export interface ShopHeaderProps {
  /** Le categorie del catalogo, con quanti prodotti pubblicati hanno (`elencoCategorie`). Mancante = nessuna voce «Cura». */
  categorie?: readonly Pick<CategoriaPubblica, "slug" | "quanti">[] | null;
  /** La ricerca (`RicercaShop`, T82b): sul telefono è il primo dei tre tasti, sul computer il campo prima del carrello. */
  ricerca?: ReactNode;
}

export function ShopHeader({ categorie, ricerca }: ShopHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count } = useCart();
  const voci = vociCura(categorie);
  const numerino = numerinoCarrello(count);

  // ── il menu del telefono: foglio in ritardo, fuoco restituito al suo tasto ──
  const [menuMontato, setMenuMontato] = useState(false);
  const [menu, setMenu] = useState<StatoFoglio>(FOGLIO_CHIUSO);
  const tastoMenu = useRef<HTMLButtonElement | null>(null);
  /** A chi restituire il fuoco appena il foglio si è chiuso (lo dice il riduttore); `null` = a nessuno. Si legge una volta sola, dal gestore. */
  const fuocoA = useRef<string | null>(null);
  const apriMenu = () => {
    setMenuMontato(true);
    setMenu((s) => foglio(s, { tipo: "apri", da: ID_TASTO_MENU }));
  };
  /** Chiusura con la X, Esc o toccando fuori: il fuoco torna al tasto. */
  const chiudiMenu = (aperto: boolean) => {
    if (aperto) return;
    const dopo = foglio(menu, { tipo: "chiudi" });
    fuocoA.current = dopo.fuocoA;
    setMenu(dopo);
  };
  /** Chiusura perché si è scelta una voce: si va altrove, il fuoco non torna indietro. */
  const chiudiMenuSenzaFuoco = () => {
    fuocoA.current = null;
    setMenu(FOGLIO_CHIUSO);
  };
  const rendiFuoco = () => {
    if (fuocoA.current === ID_TASTO_MENU) tastoMenu.current?.focus();
    fuocoA.current = null;
  };

  // ── la consulenza: il flusso che esiste, in ritardo ──
  const [pannelloMontato, setPannelloMontato] = useState(false);
  const [pannelloAperto, setPannelloAperto] = useState(false);
  const apriConsulenza = () => {
    traccia(EVENTO_CLIC_CONSULENZA, { punto: "header" });
    setPannelloMontato(true);
    setPannelloAperto(true);
  };

  // ── la tendina «Cura» sul computer ──
  const [cura, setCura] = useState<StatoTendina>(TENDINA_CHIUSA);
  const tastoCura = useRef<HTMLButtonElement | null>(null);
  const vociCuraRef = useRef<(HTMLAnchorElement | null)[]>([]);
  // la voce evidenziata prende il fuoco quando la tendina è già visibile
  useEffect(() => {
    if (cura.aperta && cura.indice !== null) vociCuraRef.current[cura.indice]?.focus();
  }, [cura]);
  const tastiCura = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Escape") return;
    const r = voceEvidenziata(cura, e.key, voci.length);
    if (!r.gestito) return;
    e.preventDefault();
    setCura({ aperta: r.aperta, indice: r.indice });
    if (r.azione === "chiudi") tastoCura.current?.focus();
  };

  const fraseCarrello = riempi(T.header.carrelloAria, { n: count });
  const attivoPatch = pathname.replace(/\/+$/, "") === HREF_PATCH;

  return (
    <>
      <a
        href={`#${ID_CONTENUTO}`}
        className="shop-anello-scuro sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[#081634]"
      >
        {GUSCIO.vaiAlContenuto}
      </a>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#081634]/95">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 min-[360px]:px-6 lg:h-[72px] lg:gap-8 lg:px-10">
          <Link to="/shop" className="brackets shop-anello-scuro inline-flex shrink-0 items-center justify-center px-3 py-2.5 lg:px-4">
            <span className="br-tr" />
            <span className="br-bl" />
            <img src={logo} alt={GUSCIO.logoAlt} className="h-6 w-auto select-none lg:h-9" draggable={false} />
          </Link>

          <nav aria-label={TESTI_HEADER_PROVVISORI.navPrincipale} className="hidden items-center gap-8 lg:flex">
            <Link to="/shop/c/$slug" params={{ slug: SLUG_PATCH }} aria-current={attivoPatch ? "page" : undefined} className={VOCE}>
              {T.header.patch}
            </Link>
            {voci.length > 0 && (
              <div
                className="relative"
                onKeyDown={tastiCura}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setCura(TENDINA_CHIUSA);
                }}
                onPointerEnter={(e) => e.pointerType === "mouse" && setCura({ aperta: true, indice: null })}
                onPointerLeave={(e) => e.pointerType === "mouse" && setCura(TENDINA_CHIUSA)}
              >
                <button
                  ref={tastoCura}
                  type="button"
                  aria-expanded={cura.aperta}
                  aria-controls="cura-voci"
                  // il mouse l'ha già aperta passandoci sopra: il clic la lascia aperta; con tastiera e dito alterna
                  onClick={(e) => setCura((s) => (e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType === "mouse" ? { aperta: true, indice: null } : s.aperta ? TENDINA_CHIUSA : { aperta: true, indice: null }))}
                  className={`${VOCE} gap-1`}
                >
                  {T.header.cura}
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
                {/* `before:` = il ponte fra il tasto e l'elenco: il puntatore non lo chiude attraversando lo spazio */}
                <ul
                  id="cura-voci"
                  hidden={!cura.aperta}
                  className="absolute left-0 top-full z-40 mt-3 w-64 rounded-md border border-white/15 bg-[#0a1a3a] py-2 shadow-galleggiante before:absolute before:-top-3 before:left-0 before:h-3 before:w-full before:content-['']"
                >
                  {voci.map((v, i) => (
                    <li key={v.slug}>
                      <Link
                        to="/shop/c/$slug"
                        params={{ slug: v.slug }}
                        ref={(el) => {
                          vociCuraRef.current[i] = el;
                        }}
                        onFocus={() => setCura((s) => (s.indice === i ? s : { aperta: true, indice: i }))}
                        onClick={() => setCura(TENDINA_CHIUSA)}
                        className="shop-anello-scuro flex min-h-11 items-center px-4 text-[15px] text-white hover:bg-white/10"
                      >
                        {v.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={apriConsulenza}
              className="shop-anello-scuro inline-flex min-h-11 items-center text-[15px] font-medium text-white underline underline-offset-4 hover:text-white/80"
            >
              {T.header.consulenza}
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:gap-3">
            {ricerca}
            <Link
              to="/shop/carrello"
              aria-label={fraseCarrello}
              className={`${TASTO} relative xl:w-auto xl:gap-2 xl:px-3`}
            >
              <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              <span className="hidden text-[15px] font-medium xl:inline">{PAROLA_CARRELLO}</span>
              {numerino && (
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-[#081634] xl:static"
                >
                  {numerino}
                </span>
              )}
            </Link>
            {/* La riga che annuncia il carrello a chi usa lo schermo parlato: c'è sempre (anche vuota), così il cambio si sente. */}
            <span role="status" aria-live="polite" className="sr-only">
              {count > 0 ? fraseCarrello : ""}
            </span>
            <button
              ref={tastoMenu}
              type="button"
              data-fuoco={ID_TASTO_MENU}
              aria-label={GUSCIO.apriMenu}
              aria-haspopup="dialog"
              aria-expanded={menu.aperto}
              onClick={apriMenu}
              className={`${TASTO} lg:hidden`}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {menuMontato && (
        <Suspense fallback={null}>
          <MenuTelefono
            aperto={menu.aperto}
            onApertoChange={chiudiMenu}
            titolo={TESTI_HEADER_PROVVISORI.titoloMenu}
            voci={voci}
            onNavigazione={chiudiMenuSenzaFuoco}
            onConsulenza={apriConsulenza}
            onRendiFuoco={rendiFuoco}
          />
        </Suspense>
      )}
      {pannelloMontato && (
        <Suspense fallback={null}>
          <PannelloProblemi aperto={pannelloAperto} onApertoChange={setPannelloAperto} provenienza="stock" punto="pannello" />
        </Suspense>
      )}
    </>
  );
}

export default ShopHeader;
