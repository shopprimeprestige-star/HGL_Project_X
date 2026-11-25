import { createFileRoute } from "@tanstack/react-router";
import { PaginaOrdine } from "@/shop/cassa/PaginaOrdine";

/** La pagina di un ordine: `/shop/ordine/<ref>?t=<chiave>` (PIANO-R2 §3.3, D14, D48). La chiave sta nell'indirizzo: la pagina la legge solo nel browser
 *  (`PaginaOrdine`), non la passa al router e non la mette nel titolo. Le intestazioni vanno anche sul DOCUMENTO HTML (quelle della funzione del
 *  server valgono solo per la sua risposta): niente cache, nessun referrer, nessun indice. Il `headers` della rotta, nell'unione degli incontri,
 *  prevale su quello della radice (`strict-origin`). */
export const Route = createFileRoute("/shop/ordine/$ref")({
  headers: () => ({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex",
  }),
  head: () => ({
    meta: [
      { title: "Il tuo ordine | Hair Genius Shop" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Ordine,
});

function Ordine() {
  const { ref } = Route.useParams();
  return <PaginaOrdine ricevuto={ref} />;
}
