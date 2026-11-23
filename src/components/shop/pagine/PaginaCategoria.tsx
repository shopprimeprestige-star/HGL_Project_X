/** ── PaginaCategoria · VETRINA V1 · T95 ───────────────────────────────────────
 *  La pagina `/shop/c/<slug>` (documento §3.4 e §4.5.3). Dall'alto: fascia blueprint compatta (percorso, titolo, frase, voci di fiducia vere e,
 *  da 768 px, la foto della categoria in 4:3), poi la griglia di card con i filtri di T90 su fondo bianco, in fondo «Non sai quale scegliere?»
 *  con la consulenza come LINK (mai un bottone pieno: l'unico pieno della pagina, se serve, è dei filtri).
 *  Non monta il guscio (header, piè di pagina, barre fisse: sono di T93) e non legge niente da sé: il `loader` della rotta le dà `dati`.
 *  ⚠️ Il loader dà card LEGGERE (`ProdottoCategoria`: la card, lo SKU e quel che serve ai filtri), non i `ProdottoPubblico` interi: descrizioni,
 *   FAQ e media non viaggiano nell'HTML. L'elenco `dati.prodotti` è quello del loader, non si rifà a ogni disegno (i filtri lo usano come dipendenza).
 *  ⚠️ Il contenitore è `px-4 min-[360px]:px-6` e NESSUN suo antenato ha `overflow`: la barra «Filtra» (`sticky`, `-mx-4 min-[360px]:-mx-6`) e la
 *   colonna dei filtri (`lg:sticky`) lo presuppongono (T90, punto 4). Il `-mx` della barra vale solo sotto i 1024 px, dove il contenitore è a tutta larghezza.
 *  ⚠️ Testi: solo da `testi-shop.ts` e dal contenuto dello shop (`testiDi`: uno svuotato nel CRM non si disegna, V1-T16). Titolo e frase come D97.
 *  La foto della categoria viene dal CMS (D95: `CategoriaPubblica.foto`, il pannello CRM la carica già): le chiavi `shop.cat.<slug>.foto` non esistono. */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { FotoShop } from "@/components/shop/FotoShop";
import { GrigliaCard } from "@/components/shop/GrigliaCard";
import { FiltriCategoria } from "@/components/shop/categoria/FiltriCategoria";
import { FasciaFiducia, vociDellaFascia } from "@/components/shop/home/FasciaFiducia";
import { ALT_MODELLI_SHOP, TESTI_SHOP, riempi } from "@/landing/testi-shop";
import { EVENTO_CONSENSO } from "@/lib/consenso";
import { emettiEvento, emettiSoloContatore } from "@/lib/tracciamento/api";
import type { SpedizionePubblica } from "@/shop/cassa/spedizione";
import { emettiUnaVolta, suScelta } from "@/shop/cms/elenco";
import type { CategoriaPubblica, ProdottoPubblico } from "@/shop/cms/modello";
import { eInvisibleDerm } from "@/shop/cms/pubblico";
import { cardDaPubblico, type CardLeggera } from "@/shop/cms/vetrina-card";
import { confermatiDa, testiDi, type ContenutoShop } from "@/shop/cms/vetrina-contenuto";
import type { Filtrabile } from "@/shop/cms/vetrina-filtri";

const PannelloProblemi = lazy(() => import("@/components/landing/consulenza/PannelloProblemi"));

/** Un prodotto della categoria com'è nel loader: la card, lo SKU (per `ViewContent`) e ciò che i filtri leggono (varianti e opzioni). */
export interface ProdottoCategoria extends Filtrabile {
  sku: string;
  card: CardLeggera;
}

export function leggeroDaPubblico(p: ProdottoPubblico): ProdottoCategoria {
  return { sku: p.sku, card: cardDaPubblico(p), varianti: p.varianti, opzioni: p.opzioni };
}

/** Quello che il `loader` della rotta dà alla pagina. */
export interface DatiCategoria {
  categoria: CategoriaPubblica;
  prodotti: ProdottoCategoria[];
  contenuto: ContenutoShop;
  tariffa: SpedizionePubblica;
}

/** Un testo che si può disegnare: scritto davvero e senza segnaposto aperto. */
const SEGNAPOSTO = "{" + "{";
const scritto = (t: unknown): string | null => (typeof t === "string" && t.trim() !== "" && !t.includes(SEGNAPOSTO) ? t.trim() : null);

/** D97: titolo e frase sono quelli del CMS; se mancano e lo slug è una delle sei categorie del documento (§3.4), quelli del documento. */
export function testiCategoria(c: Pick<CategoriaPubblica, "slug" | "nome" | "frase">): { titolo: string; frase: string | null } {
  const riga = TESTI_SHOP.categorie.find((x) => x.slug === c.slug);
  return { titolo: scritto(c.nome) ?? riga?.titolo ?? c.slug, frase: scritto(c.frase) ?? riga?.frase ?? null };
}

/** `ViewContent` della lista (product_group): una volta per visita e per categoria. Gli SKU sono quelli dei prodotti, senza Invisible Derm (come
 *  `eventoListaCategoria`, T79: la prova li confronta). `emettiEvento` non mette in coda: senza consenso non parte e non si segna, perciò si
 *  riprova dopo la scelta sul banner (`suScelta`). Dipende solo da `chiave`: l'elenco di una pagina non cambia mentre la si guarda. */
function useListaVista(chiave: string, prodotti: readonly ProdottoCategoria[], categoria: string) {
  useEffect(() => {
    const skus = prodotti.filter((p) => !eInvisibleDerm(p.card.nome, p.card.slug)).map((p) => p.sku);
    if (skus.length === 0) return;
    let archivio: Storage | null = null;
    try {
      archivio = window.sessionStorage;
    } catch {
      /* archivio non disponibile */
    }
    const prova = () => emettiUnaVolta(archivio, chiave, () => emettiEvento("ViewContent", { contentType: "product_group", contentIds: skus, categoria }));
    prova();
    return suScelta(window, EVENTO_CONSENSO, prova);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave]);
}

const PERCORSO = TESTI_SHOP.footer.colonnaShop;

export function PaginaCategoria({ dati, search }: { dati: DatiCategoria; search: unknown }) {
  const { categoria, contenuto, tariffa } = dati;
  //  stabile (dipende solo dall'elenco del loader); salta ciò che non è una riga leggera, come `soloLeggere` salta ciò che non ha nome
  const prodotti = useMemo(() => (Array.isArray(dati.prodotti) ? dati.prodotti.filter((p) => !!p?.card) : []), [dati.prodotti]);
  const { titolo, frase } = testiCategoria(categoria);
  const t = testiDi(contenuto);
  const blocco = { titolo: t["shop.cat.blocco.titolo"], testo: t["shop.cat.blocco.testo"], link: t["shop.cat.blocco.link"] };
  const confermati = confermatiDa(contenuto);
  const alt = categoria.fotoAlt ?? riempi(ALT_MODELLI_SHOP.categoria, { categoria: categoria.nome, n: prodotti.length });
  useListaVista(`c:${categoria.slug}`, prodotti, categoria.nome);

  // ── la consulenza: il flusso che esiste, in ritardo (come l'header) ──
  const [pannelloMontato, setPannelloMontato] = useState(false);
  const [pannelloAperto, setPannelloAperto] = useState(false);
  const apriConsulenza = () => {
    emettiSoloContatore("ClickConsulenza", { punto: "categoria" });
    setPannelloMontato(true);
    setPannelloAperto(true);
  };

  return (
    <>
      {/* la fascia: compatta, blueprint; la foto solo da 768 px (sotto, `display:none`: non si scarica e non si legge) */}
      <section aria-labelledby="categoria-titolo" className="bg-blueprint">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-6 pt-2 min-[360px]:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10 md:pb-10 md:pt-4 lg:px-10">
          <div className="min-w-0">
            <nav aria-label={PERCORSO}>
              <ol className="flex flex-wrap items-center gap-x-1 text-sm text-white/75">
                <li>
                  <Link to="/shop" className="shop-anello-scuro inline-flex min-h-11 items-center underline-offset-4 hover:text-white hover:underline">
                    {PERCORSO}
                  </Link>
                </li>
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRight className="size-4" />
                </li>
                <li aria-current="page" className="text-white">
                  {categoria.nome}
                </li>
              </ol>
            </nav>
            <h1 id="categoria-titolo" className="mt-1 text-balance text-3xl font-bold leading-[1.05] tracking-tight text-white md:text-5xl">
              {titolo}
            </h1>
            {frase && <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/75">{frase}</p>}
            <FasciaFiducia voci={vociDellaFascia(contenuto, tariffa)} className="mt-5" />
          </div>
          {categoria.foto && (
            <div className="hidden w-[300px] md:block lg:w-[360px]">
              <FotoShop foto={categoria.foto} alt={alt} uso="pacco" sizes="(min-width: 1024px) 360px, 300px" className="rounded-md" />
            </div>
          )}
        </div>
      </section>

      {/* i prodotti, su bianco: nessun antenato con `overflow` (la barra «Filtra» e la colonna dei filtri sono `sticky`) */}
      <section className="bg-white text-ink">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 min-[360px]:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          <FiltriCategoria prodotti={prodotti} search={search}>
            {(visibili) => <GrigliaCard card={visibili.map((p) => p.card)} colonne={3} testi={confermati} prima livello="h2" className="2xl:grid-cols-4" />}
          </FiltriCategoria>
        </div>
      </section>

      {(blocco.titolo || blocco.testo || blocco.link) && (
        <section aria-labelledby={blocco.titolo ? "categoria-blocco" : undefined} className="bg-light-panel">
          <div className="mx-auto max-w-7xl px-4 py-12 min-[360px]:px-6 lg:px-10 lg:py-16">
            <div className="max-w-2xl rounded-[14px] border border-ink/10 bg-white p-6 md:p-8">
              {blocco.titolo && (
                <h2 id="categoria-blocco" className="text-balance text-2xl font-bold tracking-tight text-ink">
                  {blocco.titolo}
                </h2>
              )}
              {blocco.testo && <p className="mt-2 text-base leading-relaxed text-ink-muted">{blocco.testo}</p>}
              {blocco.link && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={apriConsulenza}
                  className="shop-anello mt-3 inline-flex min-h-11 items-center font-semibold text-brand-scuro underline underline-offset-4 hover:text-ink"
                >
                  {blocco.link}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {pannelloMontato && (
        <Suspense fallback={null}>
          <PannelloProblemi aperto={pannelloAperto} onApertoChange={setPannelloAperto} provenienza="stock" punto="pannello" />
        </Suspense>
      )}
    </>
  );
}

export default PaginaCategoria;
