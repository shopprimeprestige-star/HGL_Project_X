/** ── LA RICERCA DELLO SHOP (`/shop/cerca?q=`) · VETRINA V1 · T96 ─────────────────────────────────────────────
 *  Esiste solo con il catalogo CMS (con `codice` è 404, come oggi) e non si indicizza. Il caricamento scarica l'elenco SENZA il testo cercato
 *  (`q` non va mai al server, né nei suoi log) e non dipende da `q` (`loaderDeps`): il filtro lo fa la pagina. `Search` non lo emette né la
 *  rotta né la pagina: lo emette l'header (D90). */
import { createFileRoute, notFound, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { ErroreRottaShop } from "@/components/shop/guscio/GuscioShop";
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
  errorComponent: ErroreCerca,
  component: CercaShop,
});

//  500: con `cms` quello del guscio nuovo (senza barra), con `codice` quello di sempre. Il 404 resta della radice: con `cms` la rotta non lo lancia mai.
function ErroreCerca(props: ErrorComponentProps) {
  return <ErroreRottaShop {...props} cms={Route.useRouteContext().modalita === "cms"} />;
}

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
