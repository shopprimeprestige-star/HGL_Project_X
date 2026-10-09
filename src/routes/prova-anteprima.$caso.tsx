/** DUE PAGINE DI PROVA, PER CAPIRE DOVE SI ROMPE L'ANTEPRIMA
 *  ═══════════════════════════════════════════════════════════════════════════
 *
 *  Non servono al lavoro: servono a rispondere a UNA domanda alla volta, perché
 *  finora si è cambiato più di una cosa fra un tentativo e l'altro e nessun
 *  risultato ha mai potuto dire di chi fosse la colpa.
 *
 *  /prova-anteprima/a — il caso più semplice che esista:
 *      · immagine presa DIRETTAMENTE dal deposito (un JPEG fermo, il nostro
 *        codice non c'entra niente);
 *      · nessun `robots`, nessun `noindex`;
 *      · nessuna query, nessun rimando, niente di dinamico.
 *    Se qui l'anteprima NON compare, il problema non è mai stato il nostro
 *    codice: è la pagina che non viene letta affatto (filtro di rete, blocco
 *    del lettore, o l'applicazione con cui si prova).
 *
 *  /prova-anteprima/b — identica in tutto, tranne UNA cosa: l'immagine passa
 *    dalla nostra rotta invece che dal deposito.
 *    Se `a` funziona e `b` no, il colpevole è la rotta.
 *    Se funzionano tutte e due, il colpevole è ciò che resta sulla pagina vera
 *    dell'invito — cioè il `noindex` — e si toglie in una riga.
 *
 *  ⚠️ Da cancellare quando la questione è chiusa: sono due pagine pubbliche che
 *  non servono a nessun cliente.
 */
import { createFileRoute } from "@tanstack/react-router";

const DEPOSITO =
  "https://jrezhxbuetpfhvsrkrwo.supabase.co/storage/v1/object/public/anteprime/_predefinita.jpg";
const NOSTRA = "https://hair-genius-hub.hair/api/og/anteprima/invito/_predefinita.jpg";

export const Route = createFileRoute("/prova-anteprima/$caso")({
  head: ({ params }) => {
    const dalDeposito = params.caso !== "b";
    const IMG = dalDeposito ? DEPOSITO : NOSTRA;
    const T = dalDeposito ? "Prova A — immagine dal deposito" : "Prova B — immagine dalla nostra rotta";
    const D = "Pagina di prova per l'anteprima dei link. Non è una pagina del sito.";
    return {
      meta: [
        { title: T },
        { name: "description", content: D },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Hair Genius Labs" },
        { property: "og:title", content: T },
        { property: "og:description", content: D },
        { property: "og:url", content: `https://hair-genius-hub.hair/prova-anteprima/${params.caso}` },
        { property: "og:image", content: IMG },
        { property: "og:image:secure_url", content: IMG },
        { property: "og:image:type", content: "image/jpeg" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "675" },
        { property: "og:locale", content: "it_IT" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: T },
        { name: "twitter:description", content: D },
        { name: "twitter:image", content: IMG },
      ],
    };
  },
  component: Pagina,
});

function Pagina() {
  const { caso } = Route.useParams();
  const dalDeposito = caso !== "b";
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-8 text-sm">
      <h1 className="text-lg font-semibold">
        Prova {dalDeposito ? "A" : "B"} — anteprima del link
      </h1>
      <p className="text-muted-foreground">
        {dalDeposito
          ? "L'immagine dichiarata qui viene presa direttamente dal deposito: nessun nostro codice in mezzo, nessun noindex."
          : "Identica alla prova A, tranne che l'immagine passa dalla nostra rotta."}
      </p>
      <p className="text-muted-foreground">
        Manda questo indirizzo in una chat e guarda se compare il riquadro con l'immagine.
      </p>
    </main>
  );
}
