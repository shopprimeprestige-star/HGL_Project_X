import { createFileRoute } from "@tanstack/react-router";
import { SITO } from "@/seo/regole";
import { PaginaProtocol } from "@/landing/sito/PaginaProtocol";
import { TESTI_PROTOCOL } from "@/landing/testi-sito";

/** /protocol: la pagina che le ads e la home portano alla consulenza. La pagina vera sta in `landing/sito`. */
export const Route = createFileRoute("/protocol")({
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
