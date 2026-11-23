/** ── PaginaScheda · VETRINA V1 · T97b ────────────────────────────────────────────────────────────────────────
 *  La pagina della scheda prodotto dello shop nuovo (SPEC §4.5.4; V1-S1…S6, V1-T8). Monta i pezzi già fatti: galleria (T86), testata e blocco
 *  d'acquisto (T87b, con la scelta di T87a), barra d'acquisto (T84a), sezioni (T88a, T88b) e pop-up d'uscita. Non decide niente di suo: quali
 *  blocchi e in che ordine lo dice `bloccheScheda` (T78), le voci di fiducia `vociFiducia` (T76), le parole stanno in `testi-shop.ts`.
 *  Contratto delle proprietà (fissato da `shop-scheda-v1.mjs`): `{ scheda, tariffa, testi, cassa, anteprima }`, tutte dalla rotta (T97a):
 *   · `scheda`: `Scheda` di `scheda.ts`. Si disegna SOLO con `tipo: "cms"`; con altro (lettura della modalità fallita per un attimo: `codice`) non si monta
 *     niente: la riga dello smistatore (T97a) guarda anche `scheda.tipo` e cade sul componente di oggi;
 *   · `tariffa`: `tariffaSpedizione()`; `testi`: `contenutoShop()` (`{testi, media}`: da qui testi di pagina, foto e testi confermati); `cassa`: `cassaPubblica()`;
 *   · `anteprima`: la scheda è una bozza vista con la chiave (D94): si vede com'è, ma non si vende (manca il bottone, non c'è la barra, non c'è il pop-up).
 *  Regole:
 *   · `useAcquisto` UNA volta: stesso gesto e stesso stato al blocco e alla barra (un solo `AddToCart`, mai due). Il resto della pagina non emette eventi
 *     (`ViewContent` è della rotta). La pagina è montata con `key={slug}`: passando da un prodotto all'altro scelta e striscia ripartono da zero.
 *   · La scelta di variante è della pagina (`SelettoreVariante` dentro `BloccoAcquisto` la riceve): si ripulisce dei valori che il prodotto non ha più.
 *   · La barra d'acquisto NON sta qui dentro: si disegna con un portale nello slot in fondo al guscio, dopo il piè di pagina (regola (a) di T93). Il guscio
 *     mette `<div data-slot-barra-fissa />` come ultimo figlio; senza lo slot la barra non c'è. Mai una `BarraConsulenza` (la monta solo il guscio).
 *   · Sul telefono: galleria, blocco, sezioni. Sul computer il blocco è `sticky` nella colonna di destra, alto quanto galleria e sezioni «media» (colore,
 *     confezione) che stanno sotto la galleria; il resto a tutta larghezza. Il kit («Cosa contiene») lo disegna solo `SezioniScheda1`.
 *   · La lightbox (Radix, `lazy` dentro la galleria) si precarica al primo tocco o fuoco sulla galleria; se il pezzo non si scarica il confine d'errore lascia
 *     la foto principale e la scheda resta. Lo stesso confine regge il pannello della consulenza.
 *  Non verificato qui (nessun browser): disegno a 390/1280 px, barra davvero nello slot del guscio vero, fuoco, scorrimento (T103c, T106). */
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FotoShop } from "@/components/shop/FotoShop";
import { BarraAcquisto } from "@/components/shop/guscio/BarreFisse";
import { BloccoAcquisto, useAcquisto } from "@/components/shop/scheda/BloccoAcquisto";
import { GalleriaProdotto } from "@/components/shop/scheda/GalleriaProdotto";
import { SezioniScheda1 } from "@/components/shop/scheda/SezioniScheda1";
import { SezioniScheda2 } from "@/components/shop/scheda/SezioniScheda2";
import { PopupUscita } from "@/components/landing/consulenza/PopupUscita";
import { emettiSoloContatore } from "@/lib/tracciamento/api";
import { useCart } from "@/shop/CartContext";
import type { SpedizionePubblica } from "@/shop/cassa/spedizione";
import type { ProdottoPubblico } from "@/shop/cms/modello";
import type { Scheda } from "@/shop/cms/scheda";
import { cardDaPubblico } from "@/shop/cms/vetrina-card";
import type { PrezzoVista } from "@/shop/cms/vetrina-carrello";
import { confermatiDa, mediaDi, testiDi, type ContenutoShop } from "@/shop/cms/vetrina-contenuto";
import { vociFiducia, type IngressiFiducia } from "@/shop/cms/vetrina-fiducia";
import { ordinaGalleria } from "@/shop/cms/vetrina-galleria";
import { bloccheScheda, popupPuoMontarsi, type Blocco } from "@/shop/cms/vetrina-scheda";
import type { Scelta } from "@/shop/cms/vetrina-varianti";

const PannelloProblemi = lazy(() => import("@/components/landing/consulenza/PannelloProblemi"));

/** Lo slot che `GuscioShop` (T93) mette come ULTIMO figlio, dopo il piè di pagina e fuori da `main`: lì si disegna la barra d'acquisto. */
export const SLOT_BARRA_FISSA = "[data-slot-barra-fissa]";

export interface PropsPaginaScheda {
  scheda: Scheda;
  tariffa?: SpedizionePubblica | null;
  testi?: ContenutoShop | null;
  cassa?: IngressiFiducia["cassa"];
  anteprima?: boolean;
}

const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const formatta = (cent: number) => EURO.format(cent / 100);
const prezzoValido = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n > 0;

/** Un pezzo caricato in ritardo che non arriva (rete caduta, pagina aperta durante una pubblicazione) non deve buttare via la scheda. */
export class ConfineErrore extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { guasto: boolean }
> {
  state = { guasto: false };
  static getDerivedStateFromError() {
    return { guasto: true };
  }
  render() {
    return this.state.guasto ? (this.props.fallback ?? null) : this.props.children;
  }
}

/** La scelta di variante tiene solo ciò che il prodotto ha ancora: un'opzione o un valore spariti (dati nuovi, stessa pagina) non restano. */
export function ripulisciScelta(
  prodotto: Pick<ProdottoPubblico, "opzioni">,
  scelta: Scelta | null | undefined,
): Scelta {
  const fuori: Scelta = {};
  for (const o of Array.isArray(prodotto?.opzioni) ? prodotto.opzioni : []) {
    const v = scelta?.[o.nome];
    if (typeof v === "string" && o.valori.some((x) => x.valore === v)) fuori[o.nome] = v;
  }
  return fuori;
}

/** Il prezzo della barra: quello della variante scelta, dal server. Senza scelta e con cifre diverse non c'è un solo prezzo da dire («—»: mai un «da» senza la parola). */
function prezzoBarra(
  prodotto: ProdottoPubblico,
  variante: ProdottoPubblico["varianti"][number] | null,
): PrezzoVista {
  if (variante)
    return prezzoValido(variante.prezzoCent)
      ? { tipo: "cifra", cent: variante.prezzoCent }
      : { tipo: "assente" };
  return !cardDaPubblico(prodotto).prezziDiversi && prezzoValido(prodotto.prezzoDaCent)
    ? { tipo: "cifra", cent: prodotto.prezzoDaCent }
    : { tipo: "assente" };
}

/** `key={slug}`: A → B → A non lascia a B la scelta, la striscia «è nel carrello» o il pannello di A. */
export function PaginaScheda(props: PropsPaginaScheda) {
  if (props?.scheda?.tipo !== "cms") return null;
  return (
    <SchedaVista key={props.scheda.prodotto.slug} {...props} prodotto={props.scheda.prodotto} />
  );
}

function SchedaVista({
  prodotto: dato,
  tariffa,
  testi,
  cassa,
  anteprima,
}: PropsPaginaScheda & { prodotto: ProdottoPubblico }) {
  // l'indirizzo con `?anteprima=` vale anche se il server non ha mandato l'elenco dei blocchi nascosti
  const prodotto = anteprima && !dato.anteprima ? { ...dato, anteprima: { nascosti: [] } } : dato;
  const inAnteprima = !!prodotto.anteprima;
  const { count } = useCart();
  const [grezza, setGrezza] = useState<Scelta>({});
  const scelta = ripulisciScelta(prodotto, grezza);
  const acquisto = useAcquisto(prodotto, scelta);
  const [slot, setSlot] = useState<Element | null>(null);
  const precaricata = useRef(false);
  const [pannelloMontato, setPannelloMontato] = useState(false);
  const [pannelloAperto, setPannelloAperto] = useState(false);
  // lo slot lo mette il guscio: si cerca dopo il montaggio (sul server non c'è un documento, e la barra non serve prima)
  useEffect(() => {
    setSlot(document.querySelector(SLOT_BARRA_FISSA));
  }, []);

  const confermati = confermatiDa(testi);
  const blocchi = bloccheScheda(prodotto, { tariffa, testi: confermati, cassa });
  const blocco = blocchi.find((b): b is Extract<Blocco, { id: "acquisto" }> => b.id === "acquisto");
  const voci = vociFiducia({ tariffa, testi: confermati, prodotto, cassa });
  const testiPagina = testiDi(testi);
  const mediaPagina = mediaDi(testi);
  const diapositive = ordinaGalleria(prodotto.media);
  const prima = diapositive.find((d) => d.tipo === "foto");

  // il pezzo della lightbox si scarica al primo tocco o fuoco sulla galleria: il primo tocco su una foto non aspetta il download
  const precarica = () => {
    if (precaricata.current) return;
    precaricata.current = true;
    void import("@/components/shop/scheda/Lightbox").catch(() => {
      precaricata.current = false; // si riprova al prossimo tocco; se non arriva, ci pensa il confine d'errore
    });
  };
  const apriConsulenza = () => {
    // SPEC n. 22: solo contatore interno, mai alle piattaforme
    emettiSoloContatore("ClickConsulenza", { punto: "colore" });
    setPannelloMontato(true);
    setPannelloAperto(true);
  };

  const barra =
    slot && blocco?.acquistabile && !inAnteprima
      ? createPortal(
          <BarraAcquisto
            nome={prodotto.nome}
            prezzo={prezzoBarra(prodotto, acquisto.variante)}
            formatta={formatta}
            foto={prodotto.media.find((m) => m.slot === "principale")?.src ?? null}
            esaurito={acquisto.esaurito}
            aggiunto={acquisto.aggiunto}
            onAggiungi={acquisto.aggiungi}
          />,
          slot,
        )
      : null;

  return (
    // i titoli delle sezioni (h2) hanno tutti la stessa misura nei loro file: `text-xl md:text-2xl` (T102 A12)
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 min-[360px]:px-6 lg:pt-10">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-x-12 lg:gap-y-10">
        <div
          className="min-w-0 lg:col-start-1 lg:row-start-1"
          onPointerDownCapture={precarica}
          onFocusCapture={precarica}
        >
          <ConfineErrore
            fallback={prima && <FotoShop foto={prima.src} alt={prima.alt} uso="galleria" prima />}
          >
            <GalleriaProdotto diapositive={diapositive} />
          </ConfineErrore>
        </div>
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {blocco && (
            <BloccoAcquisto
              prodotto={prodotto}
              blocco={blocco}
              scelta={scelta}
              onScegli={setGrezza}
              acquisto={acquisto}
              voci={voci}
              testi={confermati}
              formatta={formatta}
            />
          )}
        </div>
        <div className="min-w-0 empty:hidden lg:col-start-1 lg:row-start-2">
          <SezioniScheda1
            prodotto={prodotto}
            blocchi={blocchi}
            testi={testiPagina}
            media={mediaPagina}
            parte="media"
            onConsulenza={apriConsulenza}
          />
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-8 empty:hidden sm:gap-10 lg:mt-10">
        <SezioniScheda1
          prodotto={prodotto}
          blocchi={blocchi}
          testi={testiPagina}
          media={mediaPagina}
          parte="testo"
        />
        <SezioniScheda2 prodotto={prodotto} blocchi={blocchi} />
      </div>
      {pannelloMontato && (
        <ConfineErrore>
          <Suspense fallback={null}>
            <PannelloProblemi
              aperto={pannelloAperto}
              onApertoChange={setPannelloAperto}
              provenienza="stock"
              punto="pannello"
              prodotto={prodotto.nome}
            />
          </Suspense>
        </ConfineErrore>
      )}
      {!inAnteprima && popupPuoMontarsi(prodotto, count === 0) && (
        <PopupUscita aspetto="shop" prodotto={prodotto.nome} />
      )}
      {barra}
    </div>
  );
}
