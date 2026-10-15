import { createFileRoute, redirect } from "@tanstack/react-router";
import { SITO } from "@/seo/regole";
import { destinazioneCancello } from "@/landing/sito/soluzioni/regole";
import { PaginaProtocol } from "@/landing/sito/PaginaProtocol";
import { TESTI_PROTOCOL } from "@/landing/testi-sito";

/** /protocol: la pagina che le ads e la home portano alla consulenza. La pagina vera sta in `landing/sito`.
 *  ⚠️ Finché il redesign non è approvato NON va online: oggi sul sito risponde 404, e la vecchia pagina ha ancora i
 *  «SEGNAPOSTO» e un modulo che non salva. Chi la apre va alla home con un 302 (temporaneo: mai 301, che i browser
 *  ricordano), con gli UTM intatti. `beforeLoad` gira a ogni richiesta, già sul server. Quando il redesign è approvato
 *  si toglie il `beforeLoad` (e `/protocol` esce da `PAGINE_NASCOSTE`). */
export const Route = createFileRoute("/protocol")({
  beforeLoad: ({ location }) => {
    throw redirect({ href: destinazioneCancello(location.searchStr), statusCode: 302 });
  },
  component: PaginaProtocol,
  head: () => ({
    links: [{ rel: "canonical", href: `${SITO}/protocol` }],
    meta: [
      { title: TESTI_PROTOCOL.meta.titolo },
      { name: "description", content: TESTI_PROTOCOL.meta.descrizione },
      //  Nascosta finché il redesign non è approvato (vedi PAGINE_NASCOSTE in seo/regole.ts).
      { name: "robots", content: "noindex" },
      { property: "og:title", content: TESTI_PROTOCOL.meta.titolo },
      { property: "og:description", content: TESTI_PROTOCOL.meta.descrizione },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITO}/protocol` },
      { property: "og:site_name", content: "Hair Genius Labs" },
      { property: "og:locale", content: "it_IT" },
    ],
  }),
});
