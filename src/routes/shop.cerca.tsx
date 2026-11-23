/** ── LA RICERCA DELLO SHOP (`/shop/cerca?q=`) · VETRINA V1 · T96 ─────────────────────────────────────────────
 *  Esiste solo con il catalogo CMS (con `codice` è 404, come oggi) e non si indicizza. Il caricamento scarica l'elenco SENZA il testo cercato
 *  (`q` non va mai al server, né nei suoi log) e non dipende da `q` (`loaderDeps`): il filtro lo fa la pagina. `Search` non lo emette né la
 *  rotta né la pagina: lo emette l'header (D90). */
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { PaginaCerca, testoDaIndirizzo } from "@/components/shop/pagine/PaginaCerca";
import { TESTI_PROVVISORI } from "@/landing/testi-shop";
import { elencoProdotti } from "@/shop/cms/catalogo.functions";
import { soloLeggere } from "@/shop/cms/vetrina-card";
import { quattroDallaVetrina } from "@/shop/cms/vetrina-ricerca";

export const Route = createFileRoute("/shop/cerca")({
  validateSearch: (cerca: Record<string, unknown>) => ({ q: testoDaIndirizzo(cerca.q) }),
  loader: async ({ context }) => {
    if (context.modalita !== "cms") throw notFound();
    //  Un guasto non è «nessun risultato»: la pagina lo dice e lascia riprovare.
    try {
      //  Al browser arrivano solo le card leggere (e le 4 patch dello stato vuoto), non i prodotti interi (V1-T14).
      const prodotti = await elencoProdotti({ data: {} });
      return {
        carte: soloLeggere(prodotti),
        suggeriti: soloLeggere(quattroDallaVetrina(prodotti)),
        guasto: false,
      };
    } catch {
      return { carte: [], suggeriti: [], guasto: true };
    }
  },
  //  Nessun indice (anche nell'intestazione del documento); il titolo non porta il testo cercato.
  headers: () => ({ "X-Robots-Tag": "noindex" }),
  head: () => ({
    meta: [
      { title: TESTI_PROVVISORI.cerca.metaTitolo },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: CercaShop,
});

function CercaShop() {
  const { q } = Route.useSearch();
  const { carte, suggeriti, guasto } = Route.useLoaderData();
  const router = useRouter();
  return (
    <PaginaCerca
      carte={carte}
      suggeriti={suggeriti}
      q={q}
      guasto={guasto}
      riprova={() => void router.invalidate()}
    />
  );
}
