/** ── UN ARTICOLO DEL BLOG ───────────────────────────────────────────────────
 *  Testo, domande frequenti e invito alla consulenza gratuita. Titolo, meta
 *  description, canonical e dati strutturati (BlogPosting, percorso, FAQ)
 *  vengono da `seo/regole.ts`, gli stessi che il CRM controlla prima di
 *  lasciar pubblicare.
 *
 *  ⚠️ UNA BOZZA NON SI APRE DA QUI: `articoloPubblicato` legge solo i
 *   pubblicati, e il database non dà altro al pubblico. Un indirizzo che non
 *   esiste o un articolo ritirato rispondono 404. */
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Footer } from "@/components/landing/Footer";
import { articoloPubblicato } from "@/blog/dati";
import {
  MARCHIO,
  SITO,
  articoloDaRiga,
  dataItaliana,
  datiStrutturatiArticolo,
  jsonLd,
  markdownInHtml,
  minutiDiLettura,
} from "@/seo/regole";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const riga = await articoloPubblicato(params.slug);
    if (!riga) throw notFound();
    return riga;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: `Articolo non trovato | ${MARCHIO}` }, { name: "robots", content: "noindex" }] };
    const a = articoloDaRiga(loaderData);
    const url = `${SITO}/blog/${a.slug}`;
    return {
      meta: [
        { title: `${a.titolo} | ${MARCHIO}` },
        { name: "description", content: a.descrizione },
        { name: "author", content: a.autore },
        { property: "og:type", content: "article" },
        { property: "og:title", content: a.titolo },
        { property: "og:description", content: a.descrizione },
        { property: "og:url", content: url },
        ...(a.immagine ? [{ property: "og:image", content: a.immagine }] : []),
        ...(a.pubblicato ? [{ property: "article:published_time", content: a.pubblicato }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: datiStrutturatiArticolo(a, SITO).map((d) => ({ type: "application/ld+json", children: jsonLd(d) })),
    };
  },
  component: PaginaArticolo,
});

function PaginaArticolo() {
  const riga = Route.useLoaderData();
  const a = articoloDaRiga(riga);
  const faq = (a.faq || []).filter((f) => f.domanda?.trim() && f.risposta?.trim());
  return (
    <main className="min-h-screen overflow-x-hidden bg-white-trama">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-14 lg:py-20 text-ink">
        <nav aria-label="Percorso" className="text-[0.7rem] tracking-[0.22em] uppercase text-brand font-semibold">
          <Link to="/" className="hover:underline">Home</Link>
          <span className="mx-2 text-ink-muted">/</span>
          <Link to="/blog" className="hover:underline">Blog</Link>
        </nav>
        <h1 className="mt-6 text-3xl md:text-[2.6rem] md:leading-[1.15] font-bold tracking-tight">{a.titolo}</h1>
        <p className="mt-4 text-lg text-ink-muted">{a.descrizione}</p>
        <p className="mt-4 text-sm text-ink-muted">
          {a.autore}
          {a.pubblicato ? ` · ${dataItaliana(a.pubblicato)}` : ""}
          {a.aggiornato && a.pubblicato && dataItaliana(a.aggiornato) !== dataItaliana(a.pubblicato) ? ` · aggiornato il ${dataItaliana(a.aggiornato)}` : ""}
          {` · ${minutiDiLettura(a.corpo)} min di lettura`}
        </p>
        {a.immagine ? <img src={a.immagine} alt="" className="mt-8 w-full rounded-xl" loading="eager" /> : null}

        <div className="articolo-blog mt-10" dangerouslySetInnerHTML={{ __html: markdownInHtml(a.corpo) }} />

        {faq.length ? (
          <section className="mt-14">
            <h2 className="text-2xl font-bold">Domande frequenti</h2>
            <div className="mt-4 divide-y divide-black/10">
              {faq.map((f) => (
                <details key={f.domanda} className="py-4">
                  <summary className="cursor-pointer font-semibold">{f.domanda}</summary>
                  <p className="mt-2 text-ink-muted leading-relaxed">{f.risposta}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <aside className="mt-14 rounded-xl bg-blueprint text-white p-6 md:p-8">
          <p className="text-xl font-bold">Vuoi capire cosa va bene per te?</p>
          <p className="mt-2 text-white/80">
            Nella consulenza gratuita guardiamo insieme la tua situazione e ti diciamo con franchezza quale soluzione ha senso, anche se non è la nostra.
          </p>
          <a href="/#prenota" className="mt-5 inline-block rounded-full bg-white text-ink px-6 py-3 font-semibold hover:bg-white/90">
            Prenota la consulenza gratuita
          </a>
        </aside>
      </article>
      <Footer />
    </main>
  );
}
