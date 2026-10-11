/** ── IL BLOG: L'ELENCO DEGLI ARTICOLI ───────────────────────────────────────
 *  Pagina pubblica per Google e per chi arriva dai Reel: solo articoli
 *  pubblicati, i più recenti prima. Il testo si legge già nell'HTML del server
 *  (loader), non dopo: è quello che conta per l'indicizzazione. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/landing/Footer";
import { articoliPubblicati } from "@/blog/dati";
import { MARCHIO, SITO, dataItaliana, jsonLd, minutiDiLettura } from "@/seo/regole";

const TITOLO = "Blog: protesi capillari, patch e alternative";
const DESCRIZIONE =
  "Guide oneste su protesi capillari, patch cutanee, trapianto e sistemi non chirurgici: come funzionano, pro e contro, per chi vanno bene.";

export const Route = createFileRoute("/blog/")({
  loader: () => articoliPubblicati(),
  head: () => ({
    meta: [
      { title: `${TITOLO} | ${MARCHIO}` },
      { name: "description", content: DESCRIZIONE },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITOLO },
      { property: "og:description", content: DESCRIZIONE },
      { property: "og:url", content: `${SITO}/blog` },
    ],
    links: [{ rel: "canonical", href: `${SITO}/blog` }],
    scripts: [
      {
        type: "application/ld+json",
        children: jsonLd({ "@context": "https://schema.org", "@type": "Blog", name: `Blog di ${MARCHIO}`, url: `${SITO}/blog`, inLanguage: "it-IT" }),
      },
    ],
  }),
  component: ElencoBlog,
});

function ElencoBlog() {
  const articoli = Route.useLoaderData();
  return (
    <main className="min-h-screen overflow-x-hidden bg-white-trama">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-14 lg:py-20 text-ink">
        <Link to="/" className="text-[0.7rem] tracking-[0.22em] uppercase text-brand font-semibold hover:underline">
          ← {MARCHIO}
        </Link>
        <h1 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight">{TITOLO}</h1>
        <p className="mt-3 text-ink-muted">{DESCRIZIONE}</p>

        {articoli.length === 0 ? (
          <p className="mt-12 text-ink-muted">Presto i primi articoli.</p>
        ) : (
          <ul className="mt-10 divide-y divide-black/10">
            {articoli.map((a) => (
              <li key={a.slug} className="py-7">
                <Link to="/blog/$slug" params={{ slug: a.slug }} className="group block">
                  <h2 className="text-xl md:text-2xl font-semibold leading-snug group-hover:text-brand">{a.titolo}</h2>
                  <p className="mt-2 text-ink-muted">{a.descrizione}</p>
                  <p className="mt-2 text-sm text-ink-muted">
                    {dataItaliana(a.pubblicato_il)} · {minutiDiLettura(a.corpo)} min di lettura
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Footer />
    </main>
  );
}
