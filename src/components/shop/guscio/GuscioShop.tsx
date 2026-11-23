/** ── IL GUSCIO NUOVO DELLO SHOP (VETRINA V1 · T93 · D72, D83, D84) ────────────────────────────────────────────
 *  Avvolge SOLO le cinque pagine V1 (`/shop`, `/shop/c/<slug>`, `/shop/cerca`, `/shop/prodotto/<slug>`, `/shop/carrello`) con il catalogo `cms`:
 *  lo sceglie `shop.tsx` (`guscioPerPercorso`), che lo monta dentro `CartProvider`. Cassa, ordine e collaudo non lo vedono mai.
 *  Dall'alto in basso: header (con la ricerca nel suo posto) · striscia «senza connessione» · `main` (`id="contenuto"`, `tabIndex={-1}`:
 *  il bersaglio di «Vai al contenuto», che sta già nell'header) · piè di pagina · in fondo, DOPO il piè di pagina e fuori da `main`, la barra fissa.
 *  La barra la decide `barraFissa(percorso, stato)`: consulenza su home e categoria (la monta il guscio, `sopraAlBanner` e `hoverScuro`);
 *  acquisto su scheda e carrello (il guscio ha in fondo uno SLOT, `data-slot-barra-fissa`, e la pagina ci disegna `BarraAcquisto`/`BarraCarrello` con `createPortal`, perché
 *  solo lei ha nome, prezzo e gesto d'aggiunta: `useSlotBarra()`). Lo stato della pagina (404, 500, prodotto non in vendita, anteprima) lo
 *  dice la pagina con `useStatoPagina(...)`: con uno stato che non sia «normale» non c'è nessuna barra.
 *  Per le pagine che arrivano dopo (T94-T98): `NonTrovataShop` e `ErroreShop` sono i `notFoundComponent` e `errorComponent` da montare sulle rotte
 *  V1 (avvolgono la pagina di T83, segnalano lo stato e conservano il ricaricamento dei pezzi che non arrivano di `router.tsx`);
 *  `ConfinePezzoInRitardo` è il confine d'errore comune per i pezzi caricati in ritardo (menu, lightbox, filtri).
 *  Cosa NON fa: i dati delle pagine, le barre vere (T84a), la cassa. `data-shop-v1` va su `<html>` (lo scroll e i portali lo vedono) e si toglie
 *  allo smontaggio. Il fuoco vero, `inert` e il telefono si guardano nel browser (T103c, T106). Testi: solo `testi-shop.ts`. */
import { Component, createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import logo from "@/assets/logo-hair-genius.png";
import { BarraConsulenza } from "@/components/landing/consulenza/BarraConsulenza";
import { TESTI_PROVVISORI, TESTI_SHOP } from "@/landing/testi-shop";
import { emettiSoloContatore } from "@/lib/tracciamento/api";
import type { CategoriaPubblica } from "@/shop/cms/modello";
import { barraFissa, guscioPerPercorso, type StatoPagina } from "@/shop/cms/vetrina-barre";
import { erroreDiVersione, ricaricaPerPezzoMancante, ripulisciERicarica } from "@/versione-aperta";
import { BannerOffline } from "./BannerOffline";
import { useAltezzaBanner } from "./BarreFisse";
import { FooterShop } from "./FooterShop";
import { PaginaErrore, PaginaNonTrovata } from "./PagineErrore";
import { RicercaShop } from "./RicercaShop";
import { ID_CONTENUTO, ShopHeader } from "./ShopHeader";

const PannelloProblemi = lazy(() => import("@/components/landing/consulenza/PannelloProblemi"));

/** D72: il guscio nuovo vale solo sulle cinque pagine V1 (`guscioPerPercorso` di T79); `shop.tsx` lo chiede da qui. */
export const guscioNuovo = (pathname: unknown): boolean => guscioPerPercorso(pathname) === "nuovo";

/* ── ciò che le pagine possono chiedere al guscio ──────────────────────────────────────────────────────────── */

interface Contesto {
  /** La pagina dice com'è (404, 500, non in vendita…): `barraFissa` ne tiene conto. */
  segnala: (stato: StatoPagina) => void;
  /** Il nodo in fondo al guscio dove una pagina d'acquisto disegna la sua barra; `null` sul server, prima del montaggio e fuori dal guscio. */
  slot: HTMLElement | null;
}
const ContestoGuscio = createContext<Contesto>({ segnala: () => {}, slot: null });

/** Da chiamare nel corpo di una pagina che non vuole barre: `useStatoPagina("non_trovata" | "errore" | "non_in_vendita")`. Allo smontaggio torna «normale». */
export function useStatoPagina(stato: StatoPagina): void {
  const { segnala } = useContext(ContestoGuscio);
  useEffect(() => {
    if (stato === "normale") return;
    segnala(stato);
    return () => segnala("normale");
  }, [stato, segnala]);
}

/** Il nodo della barra d'acquisto (scheda, carrello): `createPortal(<BarraAcquisto … />, slot)` quando non è `null`. */
export function useSlotBarra(): HTMLElement | null {
  return useContext(ContestoGuscio).slot;
}

/** 404 e 500 dentro il guscio: avvolgono la pagina di T83 (che non legge il router) e dicono alla pagina il suo stato. */
export function NonTrovataShop() {
  useStatoPagina("non_trovata");
  return <PaginaNonTrovata />;
}

/** Il 500 non mostra mai l'errore vero. Conserva il rimedio di `router.tsx` per un pezzo che non arriva (versione nuova pubblicata): ricarica da sé,
 *  due volte al massimo in cinque minuti. «Riprova» ricarica davvero (un loader rotto non si ripara rimontando la rotta), dopo aver ripulito i pezzi in cache. */
export function ErroreShop({ error }: { error: Error }) {
  useStatoPagina("errore");
  const pezzoMancante = erroreDiVersione(error);
  useEffect(() => {
    if (pezzoMancante) ricaricaPerPezzoMancante(error);
  }, [error, pezzoMancante]);
  return <PaginaErrore riprova={() => void ripulisciERicarica()} />;
}

/* ── i pezzi caricati in ritardo ───────────────────────────────────────────────────────────────────────────── */

/** Confine d'errore comune: un pezzo che non arriva (senza rete, o una versione nuova) NON manda in errore tutta la pagina, mostra `ripiego`.
 *  ⚠️ `React.lazy` si ricorda del rifiuto: il pezzo non riparte finché non si ricarica la pagina, perciò il ripiego propone «Riprova» che ricarica. */
export class ConfinePezzoInRitardo extends Component<{ ripiego: ReactNode; children?: ReactNode }, { guasto: boolean }> {
  state = { guasto: false };
  static getDerivedStateFromError() {
    return { guasto: true };
  }
  render() {
    return this.state.guasto ? this.props.ripiego : this.props.children;
  }
}

/** Al posto dell'header se un suo pezzo in ritardo non arriva: il logo (porta alla home), una frase calma e «Riprova». Mai rosso. */
export function HeaderDiRiserva() {
  return (
    <header className="border-b border-white/10 bg-[#081634] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 min-[360px]:px-6 lg:px-10">
        <Link to="/shop" className="shop-anello-scuro inline-flex min-h-11 shrink-0 items-center">
          <img src={logo} alt={TESTI_PROVVISORI.guscio.logoAlt} className="h-6 w-auto select-none" draggable={false} />
        </Link>
        <p role="status" className="min-w-0 flex-1 text-sm text-white/85">
          {TESTI_SHOP.err500.testo}
        </p>
        <button
          type="button"
          onClick={() => void ripulisciERicarica()}
          className="shop-anello-scuro inline-flex min-h-11 items-center rounded-md border border-white/40 px-4 text-sm font-medium text-white hover:bg-white/10"
        >
          {TESTI_PROVVISORI.errore.riprova}
        </button>
      </div>
    </header>
  );
}

/* ── i collegamenti al documento (funzioni, così si provano con un documento finto) ────────────────────────── */

/** `data-shop-v1` su `<html>`: lo scorrimento (`scroll-padding`) e i portali di Radix lo vedono. Restituisce la funzione che lo toglie. */
export function collegaRadiceShop(doc: Pick<Document, "documentElement">): () => void {
  const radice = doc.documentElement;
  radice.setAttribute("data-shop-v1", "");
  return () => radice.removeAttribute("data-shop-v1");
}

/** Con la riga di ricerca aperta sul telefono, la lente che sta dietro non si raggiunge con Tab (`tabindex="-1"`); il fuoco da programma resta
 *  possibile, perché alla chiusura la ricerca lo restituisce proprio alla lente. */
export function allineaLente(lente: Pick<Element, "getAttribute" | "setAttribute" | "removeAttribute">): void {
  if (lente.getAttribute("aria-expanded") === "true") lente.setAttribute("tabindex", "-1");
  else lente.removeAttribute("tabindex");
}

/** La lente è il primo bottone con `aria-expanded` della ricerca di T82b (che non si tocca): la si segue finché cambia. */
export function collegaLente(radice: Pick<Element, "querySelector">, Osservatore: typeof MutationObserver = MutationObserver): () => void {
  const lente = radice.querySelector("button[aria-expanded]");
  if (!lente) return () => {};
  const allinea = () => allineaLente(lente);
  allinea();
  const o = new Osservatore(allinea);
  o.observe(lente, { attributes: true, attributeFilter: ["aria-expanded"] });
  return () => {
    o.disconnect();
    lente.removeAttribute("tabindex");
  };
}

/** `display: contents`: il contenitore non pesa sul disegno dell'header (i suoi figli restano figli della riga). */
function RicercaNelGuscio({ categorie }: { categorie?: GuscioShopProps["categorie"] }) {
  const rif = useRef<HTMLDivElement | null>(null);
  useEffect(() => (rif.current ? collegaLente(rif.current) : undefined), []);
  return (
    <div ref={rif} className="contents">
      <RicercaShop categorie={categorie} />
    </div>
  );
}

/* ── il guscio ─────────────────────────────────────────────────────────────────────────────────────────────── */

export interface GuscioShopProps {
  /** Le categorie con i loro prodotti (`elencoCategorie`, dal loader del layout): per «Cura» e per il vocabolario della ricerca. Mancanti = nessuna voce «Cura». */
  categorie?: readonly Pick<CategoriaPubblica, "slug" | "nome" | "quanti">[] | null;
  /** Di norma `<Outlet />`. */
  children?: ReactNode;
}

export function GuscioShop({ categorie, children }: GuscioShopProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [stato, setStato] = useState<StatoPagina>("normale");
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [pannelloMontato, setPannelloMontato] = useState(false);
  const [pannelloAperto, setPannelloAperto] = useState(false);

  // ⚠️ L'ordine conta: prima l'attributo, poi `useAltezzaBanner`, che scrive `--banner-h` proprio su quell'elemento.
  useEffect(() => collegaRadiceShop(document), []);
  useAltezzaBanner();

  const barra = barraFissa(pathname, stato);
  //  Lo slot lo vede solo chi disegna la barra d'acquisto, e solo se `barraFissa` la vuole (non su 404, 500, anteprima, Invisible Derm).
  const contesto = useMemo(() => ({ segnala: setStato, slot: barra === "acquisto" ? slot : null }), [slot, barra]);

  /** La voce «Consulenza gratuita» del piè di pagina: lo stesso flusso dell'header (D84), contata come `ClickConsulenza` dal punto «footer». */
  const apriConsulenza = () => {
    // SPEC n. 22: solo contatore interno (`lp_events`), mai alle piattaforme
    emettiSoloContatore("ClickConsulenza", { punto: "footer" });
    setPannelloMontato(true);
    setPannelloAperto(true);
  };

  return (
    <div data-guscio="nuovo" className="flex min-h-screen flex-col bg-white text-ink">
      <ContestoGuscio.Provider value={contesto}>
        <ConfinePezzoInRitardo ripiego={<HeaderDiRiserva />}>
          <ShopHeader categorie={categorie} ricerca={<RicercaNelGuscio categorie={categorie} />} />
        </ConfinePezzoInRitardo>
        <BannerOffline />
        <main id={ID_CONTENUTO} tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <FooterShop consulenza={apriConsulenza} />
        {pannelloMontato && (
          // shortcut: se il pezzo non arriva il pannello non si apre e non si dice niente (il tasto di «Riprova» è dell'header); se serve un avviso, qui.
          <ConfinePezzoInRitardo ripiego={null}>
            <Suspense fallback={null}>
              <PannelloProblemi aperto={pannelloAperto} onApertoChange={setPannelloAperto} provenienza="stock" punto="pannello" />
            </Suspense>
          </ConfinePezzoInRitardo>
        )}
        {/* In fondo, dopo il piè di pagina e fuori da `main`: lo spazio che la barra riserva sta sempre sotto tutto. */}
        {barra === "consulenza" && <BarraConsulenza provenienza="stock" sopraAlBanner hoverScuro />}
        {/* Lo slot c'è sempre ed è l'ultimo figlio del guscio (attributo concordato con T97b e T98). */}
        <div ref={setSlot} data-slot-barra-fissa="" />
      </ContestoGuscio.Provider>
    </div>
  );
}

export default GuscioShop;
