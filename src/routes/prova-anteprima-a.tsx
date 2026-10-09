/** PAGINA DI PROVA A — serve a isolare, non al pubblico.
 *
 *  Dopo sei tentativi falliti sull'anteprima dei link, il committente ha chiesto
 *  la cosa giusta: partire da un'anteprima semplice e vedere se compare.
 *  Queste due pagine sono identiche in tutto tranne UNA cosa — da dove arriva
 *  l'immagine — così la risposta «si vede / non si vede» punta il dito da sola:
 *
 *   · PROVA A → l'immagine arriva DIRETTAMENTE dal deposito esterno. Il nostro
 *     servitore non c'entra niente.
 *   · PROVA B → l'immagine passa dalla nostra rotta, come nelle pagine vere.
 *
 *  A si vede e B no  → il difetto è nella nostra rotta.
 *  Non si vede nessuna delle due → il difetto non è nell'applicazione: è più in
 *  alto (filtri di Cloudflare sui crawler, o il dominio).
 *  Si vedono tutte e due → l'applicazione è a posto e quello che resta è la
 *  memoria delle anteprime già fallite sui link vecchi.
 *
 *  ⚠️ Nessun `noindex` qui, di proposito: toglie di mezzo anche quel dubbio.
 *  Da cancellare quando la faccenda è chiusa.
 */
import { createFileRoute } from "@tanstack/react-router";

const IMG = "https://jrezhxbuetpfhvsrkrwo.supabase.co/storage/v1/object/public/anteprime/_predefinita.jpg";
const T = "Prova anteprima A — Hair Genius Labs";
const D = "Pagina di prova: se vedi l'immagine qui sopra, l'anteprima funziona.";

export const Route = createFileRoute("/prova-anteprima-a")({
  head: () => ({
    meta: [
      { title: T },
      { name: "description", content: D },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Hair Genius Labs" },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
      { property: "og:url", content: "https://hair-genius-hub.hair/prova-anteprima-a" },
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
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <main style={{ background: "#081634", color: "#fff", minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Prova anteprima A</h1>
      <p style={{ opacity: 0.7, marginBottom: 16 }}>L'immagine arriva direttamente dal deposito esterno: il nostro servitore non partecipa.</p>
      <img src={IMG} alt="" style={{ width: "100%", maxWidth: 700, borderRadius: 12 }} />
    </main>
  );
}
