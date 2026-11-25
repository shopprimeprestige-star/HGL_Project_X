/** ── LA CATEGORIA DELLO SHOP (`/shop/c/<slug>`) ─────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T19; V1 · T95). Esiste solo con il catalogo CMS: mostra i prodotti PUBBLICATI della categoria.
 *  Una categoria che non c'è, non è visibile o non ha prodotti pubblicati non esiste: l'indirizzo rimanda a `/shop`
 *  (Design §4.14 n. 11). Con il catalogo del codice la pagina non c'è (404, come oggi). Il testo dei prodotti si legge già
 *  nell'HTML del server (`loader`): è ciò che vede chi arriva da una ricerca.
 *  ⚠️ I filtri stanno nell'indirizzo (`?colore=…&disp=1`) ma si applicano nel browser sui prodotti già caricati: `validateSearch` lascia passare
 *   ogni parametro (i filtri li legge T90, gli altri, come gli utm, restano) e NON c'è `loaderDeps`: un filtro non rifà il loader (T90, punto 2).
 *  ⚠️ Il disegno è di `PaginaCategoria` (T95); il guscio (header, piè di pagina, barre) è di `shop.tsx` (T93). */
import { createFileRoute, notFound, rootRouteId, redirect, type ErrorComponentProps } from "@tanstack/react-router";
import { ErroreRottaShop } from "@/components/shop/guscio/GuscioShop";
import { leggeroDaPubblico, PaginaCategoria } from "@/components/shop/pagine/PaginaCategoria";
import { TESTI_SHOP, riempi } from "@/landing/testi-shop";
import { SITO } from "@/seo/regole";
import type { SpedizionePubblica } from "@/shop/cassa/spedizione";
import { tariffaSpedizione } from "@/shop/cassa/tariffe.functions";
import { elencoCategorie, elencoProdotti } from "@/shop/cms/catalogo.functions";
import { contenutoShop } from "@/shop/cms/contenuto-shop.functions";
import { datiStrutturatiLista, serializzaJsonLd } from "@/shop/cms/json-ld";
import type { ProdottoPubblico } from "@/shop/cms/modello";
import { contenutoVuoto, mediaDi } from "@/shop/cms/vetrina-contenuto";
import { canonical, immagineCondivisione, metaCategorie } from "@/shop/cms/vetrina-seo";

const TARIFFA_ASSENTE: SpedizionePubblica = { stato: "assente" };

export const Route = createFileRoute("/shop/c/$slug")({
  validateSearch: (search: Record<string, unknown>): Record<string, unknown> => search,
  loader: async ({ params, context }) => {
    if (context.modalita !== "cms") throw notFound({ routeId: rootRouteId });
    let prodotti: Awaited<ReturnType<typeof elencoProdotti>> = [];
    let categorie: Awaited<ReturnType<typeof elencoCategorie>> = [];
    //  un guasto non è un errore al pubblico: contenuto di partenza e tariffa assente (la fascia di fiducia mostra le sole voci vere)
    const contenuto = contenutoShop().catch(contenutoVuoto);
    const tariffa = tariffaSpedizione().catch((): SpedizionePubblica => TARIFFA_ASSENTE);
    try {
      [prodotti, categorie] = await Promise.all([elencoProdotti({ data: { categoria: params.slug } }), elencoCategorie()]);
    } catch {
      /* un guasto non è un errore al pubblico: come una categoria vuota */
    }
    const categoria = categorie.find((c) => c.slug === params.slug);
    if (!categoria || prodotti.length === 0) throw redirect({ to: "/shop" });
    //  i meta di tutte le categorie insieme: mai due uguali (D97, V1-C3), anche se il CMS scrive lo stesso testo due volte
    const meta = metaCategorie(categorie)[categorie.indexOf(categoria)];
    return { categoria, meta, prodotti: prodotti.map(leggeroDaPubblico), contenuto: await contenuto, tariffa: await tariffa };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [] };
    const { meta: { titolo, descrizione }, prodotti, contenuto } = loaderData;
    const url = canonical(`/shop/c/${params.slug}`, SITO);
    const media = mediaDi(contenuto);
    const immagine = immagineCondivisione({ condivisione: media["shop.condivisione"], heroFoto: media["shop.heroFoto"] });
    //  shortcut: `datiStrutturatiLista` legge solo slug e nome; si passa l'elenco leggero con un cast invece di cambiare `json-ld.ts` (non è di T95). Cambiarla quando si tocca quel file.
    const lista = prodotti.map((p) => ({ slug: p.card.slug, nome: p.card.nome })) as unknown as ProdottoPubblico[];
    return {
      meta: [
        //  stesso suffisso di scheda, carrello e cerca («… | Hair Genius Shop»); se il CMS lo ha già scritto non si raddoppia
        { title: titolo.includes("Hair Genius") ? titolo : riempi(TESTI_SHOP.meta.scheda.titolo, { nome: titolo }) },
        { name: "description", content: descrizione },
        { property: "og:description", content: descrizione },
        { property: "og:type", content: "website" },
        { property: "og:title", content: titolo },
        { property: "og:url", content: url },
        ...(immagine ? [{ property: "og:image", content: immagine }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: serializzaJsonLd(datiStrutturatiLista(lista, SITO)) }],
    };
  },
  errorComponent: ErroreCategoria,
  component: CategoriaShop,
});

//  500: con `cms` quello del guscio nuovo (senza barra), con `codice` quello di sempre. Il 404 resta della radice: con `cms` la rotta non lo lancia mai (rimanda a `/shop`).
function ErroreCategoria(props: ErrorComponentProps) {
  return <ErroreRottaShop {...props} cms={Route.useRouteContext().modalita === "cms"} />;
}

function CategoriaShop() {
  const dati = Route.useLoaderData();
  //  `key`: passando da una categoria all'altra la pagina riparte da zero (consulenza chiusa, filtri e fuoco nuovi)
  return <PaginaCategoria key={dati.categoria.slug} dati={dati} search={Route.useSearch()} />;
}
