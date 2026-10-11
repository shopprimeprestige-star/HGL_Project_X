/** ── SITEMAP.XML ────────────────────────────────────────────────────────────
 *  La mappa del sito per i motori di ricerca: le pagine pubbliche fisse più
 *  gli articoli del blog PUBBLICATI (mai le bozze).
 *
 *  ⚠️ SE LA TABELLA DEGLI ARTICOLI NON RISPONDE, LA MAPPA ESCE LO STESSO,
 *   con le sole pagine fisse. Vale anche prima che la tabella esista: questa
 *   rotta si può pubblicare prima della migrazione del blog. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PAGINE_PUBBLICHE, SITO, sitemapXml, type VoceMappa } from "@/seo/regole";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const voci: VoceMappa[] = PAGINE_PUBBLICHE.map((percorso) => ({ percorso }));
        try {
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
          for (const a of data ?? []) voci.push({ percorso: `/blog/${a.slug}`, aggiornato: a.aggiornato_il || a.pubblicato_il });
        } catch {
          /* solo le pagine fisse */
        }
        return new Response(sitemapXml(voci, SITO), {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
