/** ── SITEMAP.XML ────────────────────────────────────────────────────────────
 *  La mappa del sito per i motori di ricerca: le pagine pubbliche fisse, gli
 *  articoli del blog PUBBLICATI (mai le bozze) e, solo con il catalogo CMS
 *  acceso, i prodotti e le categorie dello shop PUBBLICATI (T22).
 *
 *  ⚠️ OGNI FONTE STA NEL SUO try/catch (`vociDellaMappa`): SE LA TABELLA DEGLI
 *   ARTICOLI O IL CATALOGO NON RISPONDONO, LA MAPPA ESCE LO STESSO con le altre.
 *   Vale anche prima che le tabelle esistano: questa rotta si può pubblicare
 *   prima delle migrazioni. Con il catalogo `codice` o senza la migrazione dello
 *   shop la mappa è identica a quella di prima. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { catalogoPubblico } from "@/shop/cms/catalogo.functions";
import { vociDellaMappa } from "@/shop/cms/sitemap";
import { PAGINE_PUBBLICHE, SITO, sitemapXml } from "@/seo/regole";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const blog = async () => {
          const { data } = await (supabaseAdmin as unknown as {
            from: (t: string) => {
              select: (c: string) => {
                eq: (k: string, v: string) => {
                  order: (k: string, o: { ascending: boolean }) => Promise<{ data: { slug: string; aggiornato_il: string | null; pubblicato_il: string | null }[] | null }>;
                };
              };
            };
          })
            .from("blog_articoli")
            .select("slug, aggiornato_il, pubblicato_il")
            .eq("stato", "pubblicato")
            .order("pubblicato_il", { ascending: false });
          return (data ?? []).map((a) => ({ percorso: `/blog/${a.slug}`, aggiornato: a.aggiornato_il || a.pubblicato_il }));
        };
        const voci = await vociDellaMappa({
          fisse: PAGINE_PUBBLICHE,
          blog,
          shop: async () => (await catalogoPubblico()).vociSitemap(),
        });
        return new Response(sitemapXml(voci, SITO), {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
