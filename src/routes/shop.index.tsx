import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { Search, Star, ShieldCheck, Truck, Sparkles } from "lucide-react";
import { CATEGORIES, PRODUCTS, type CategoryKey } from "@/shop/catalog";
import { elencoCategorie, elencoProdotti } from "@/shop/cms/catalogo.functions";
import { ChipCategorie, GrigliaProdotti, useListaVista } from "@/shop/cms/GrigliaProdotti";
import { creaEmettitoreRicerca, filtraVoci, frasaSenzaRisultati, vociDaCodice, vociDaPubblici } from "@/shop/cms/elenco";
import { emettiEvento } from "@/lib/tracciamento/api";
import { NOME_PRODOTTO } from "@/landing/testi-sito";

export const Route = createFileRoute("/shop/")({
  //  Con il catalogo CMS il testo dei prodotti si legge già nell'HTML del server; con quello del codice non si chiede niente.
  //  Un guasto non è un errore al pubblico: elenco vuoto.
  loader: async ({ context }) => {
    if (context.modalita !== "cms") return null;
    try {
      const [prodotti, categorie] = await Promise.all([elencoProdotti({ data: {} }), elencoCategorie()]);
      return { prodotti, categorie };
    } catch {
      return { prodotti: [], categorie: [] };
    }
  },
  component: Storefront,
});

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;
function icon(name: string): IconType {
  return (Lucide as unknown as Record<string, IconType>)[name] ?? Lucide.Package;
}

function Storefront() {
  //  La modalità la legge il guscio (`/shop`) una volta sola e la mette nel contesto.
  const { modalita } = Route.useRouteContext();
  const dati = Route.useLoaderData();
  const cms = modalita === "cms";
  const [cat, setCat] = useState<CategoryKey | "all">("all");
  const [q, setQ] = useState("");

  const tutte = useMemo(() => (cms ? vociDaPubblici(dati?.prodotti ?? []) : vociDaCodice(PRODUCTS)), [cms, dati]);
  const filtered = useMemo(() => filtraVoci(tutte, cat, q), [tutte, cat, q]);
  const categorieCms = dati?.categorie ?? [];

  //  Gli eventi: la lista vista (una volta per visita) e la ricerca (dopo 1 secondo di pausa o con Invio, solo il testo).
  //  Il testo cercato resta nella pagina: non va nell'indirizzo.
  useListaVista("tutti", tutte);
  const ricerca = useMemo(() => creaEmettitoreRicerca((testo) => emettiEvento("Search", { searchString: testo })), []);
  useEffect(() => ricerca.ferma, [ricerca]);

  return (
    <div className="space-y-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center sm:py-16">
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative mx-auto max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Collezione {NOME_PRODOTTO}
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Toupee <span className="text-brand">indistinguibili</span> e tutto per curarli.
          </h1>
          <p className="mx-auto max-w-xl text-white/60">
            Protesi lace e skin di grado premium, più shampoo, balsami, districanti, solventi e adesivi.
            La cura completa per chi indossa un sistema di capelli.
          </p>
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                ricerca.scrivi(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") ricerca.invio(q);
              }}
              aria-label="Cerca nel negozio"
              placeholder="Cerca protesi, shampoo, remover…"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
          {/* Con il catalogo CMS queste tre righe non si dicono: il voto e i clienti erano dati d'esempio, la soglia dei 59 € non c'è più,
              il materiale lo prova solo la scheda del fornitore. */}
          {!cms && (
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-xs text-white/50">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand" /> Capelli veri Remy</span>
              <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-brand" /> Spedizione gratis &gt; €59</span>
              <span className="flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-300" /> 4.8/5 · 1.500+ clienti</span>
            </div>
          )}
        </div>
      </section>

      {/* CATEGORIE */}
      {cms ? (
        categorieCms.length > 0 && <ChipCategorie categorie={categorieCms} />
      ) : (
      <section>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCat("all")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              cat === "all" ? "bg-brand text-white" : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Tutti
          </button>
          {CATEGORIES.map((c) => {
            const Icon = icon(c.icon);
            const active = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active ? "bg-brand text-white" : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" /> {c.label}
              </button>
            );
          })}
        </div>
      </section>
      )}

      {/* GRIGLIA */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            {cat === "all" ? "Tutti i prodotti" : CATEGORIES.find((c) => c.key === cat)?.label}
          </h2>
          <span className="text-sm text-white/40">{filtered.length} articoli</span>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            {cms && !q.trim() ? "Nessun prodotto disponibile in questo momento." : frasaSenzaRisultati(q, cms)}
          </div>
        ) : (
          <GrigliaProdotti voci={filtered} />
        )}
      </section>
    </div>
  );
}
