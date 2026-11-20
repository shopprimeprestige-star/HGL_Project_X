/** ── LA CATEGORIA DELLO SHOP (`/shop/c/<slug>`) ─────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T19). Esiste solo con il catalogo CMS: mostra i prodotti PUBBLICATI della categoria.
 *  Una categoria che non c'è, non è visibile o non ha prodotti pubblicati non esiste: l'indirizzo rimanda a `/shop`
 *  (Design §4.14 n. 11). Con il catalogo del codice la pagina non c'è (404, come oggi). Il testo dei prodotti si legge già
 *  nell'HTML del server (`loader`): è ciò che vede chi arriva da una ricerca. */
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { elencoCategorie, elencoProdotti } from "@/shop/cms/catalogo.functions";
import { ChipCategorie, GrigliaProdotti, useListaVista } from "@/shop/cms/GrigliaProdotti";
import { vociDaPubblici } from "@/shop/cms/elenco";
import { datiStrutturatiLista, serializzaJsonLd } from "@/shop/cms/json-ld";
import { MARCHIO, SITO } from "@/seo/regole";

export const Route = createFileRoute("/shop/c/$slug")({
  loader: async ({ params, context }) => {
    if (context.modalita !== "cms") throw notFound();
    let prodotti: Awaited<ReturnType<typeof elencoProdotti>> = [];
    let categorie: Awaited<ReturnType<typeof elencoCategorie>> = [];
    try {
      [prodotti, categorie] = await Promise.all([elencoProdotti({ data: { categoria: params.slug } }), elencoCategorie()]);
    } catch {
      /* un guasto non è un errore al pubblico: come una categoria vuota */
    }
    const categoria = categorie.find((c) => c.slug === params.slug);
    if (!categoria || prodotti.length === 0) throw redirect({ to: "/shop" });
    return { categoria, categorie, prodotti };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [] };
    const { categoria, prodotti } = loaderData;
    const titolo = categoria.seo.titolo ?? categoria.nome;
    const descrizione = categoria.seo.descrizione ?? categoria.frase;
    const url = `${SITO}/shop/c/${params.slug}`;
    return {
      meta: [
        { title: `${titolo} | ${MARCHIO}` },
        ...(descrizione ? [{ name: "description", content: descrizione }, { property: "og:description", content: descrizione }] : []),
        { property: "og:type", content: "website" },
        { property: "og:title", content: titolo },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: serializzaJsonLd(datiStrutturatiLista(prodotti, SITO)) }],
    };
  },
  component: CategoriaShop,
});

function CategoriaShop() {
  const { categoria, categorie, prodotti } = Route.useLoaderData();
  const voci = vociDaPubblici(prodotti);
  useListaVista(`c:${categoria.slug}`, voci, categoria.nome);
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <nav aria-label="Percorso" className="flex items-center gap-1.5 text-xs text-white/45">
          <Link to="/shop" className="hover:text-white">Shop</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-white/70">{categoria.nome}</span>
        </nav>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{categoria.nome}</h1>
        {categoria.frase && <p className="max-w-2xl text-white/60">{categoria.frase}</p>}
      </header>

      <ChipCategorie categorie={categorie} attiva={categoria.slug} />

      <section>
        <div className="mb-4 flex items-baseline justify-end">
          <span className="text-sm text-white/40">{voci.length} articoli</span>
        </div>
        <GrigliaProdotti voci={voci} />
      </section>
    </div>
  );
}
