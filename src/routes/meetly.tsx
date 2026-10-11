// ── MEETLY — IL LINK DEL CLIENTE ────────────────────────────────────────────
//  Il link che mandi non è quello del preventivo: è il link della
//  VIDEOCONSULENZA, e Meetly è il software che la ospita. Questa pagina non ha
//  contenuti propri di proposito.
//   · Se la consulenza non è ancora avviata, il cliente vede la schermata
//     brandizzata di attesa (la mostra il gate ospite, che copre qualunque
//     pagina finché non sei tu ad aprirla).
//   · Appena presenti qualcosa — preventivo, slide, media, sito — è la pagina
//     stessa a portarlo lì, seguendo te.
//  Prima il link puntava al preventivo: il cliente atterrava su una pagina di
//  contenuti anche quando non c'era ancora nessuna consulenza in corso.
//  La forma senza codice resta perché i link storici con ?watch= finiscono qui;
//  quelli nuovi hanno il codice nel percorso (/meetly/kfr-mbqd-tzp).
import { createFileRoute } from "@tanstack/react-router";
import { watchId as getWatch, useLiveNav } from "@/shop/live";

// ── ANTEPRIMA DEL LINK ──────────────────────────────────────────────────────
//  Quando mandi il link su WhatsApp, Messenger o via email, il programma legge
//  queste indicazioni per costruire il riquadro d'anteprima. Senza, veniva
//  mostrata quella generica del sito: il cliente riceveva un invito a una
//  videoconsulenza che sembrava un link qualsiasi alla pagina principale.
const OG_TITLE = "Meetly — la tua videoconsulenza con Hair Genius Labs";
const OG_DESC = "Tocca per entrare: il tuo consulente ti aspetta. Consulenza personalizzata in video, dal browser, senza installare nulla.";
const OG_IMAGE = "https://tanstack-start-app.shop-primeprestige.workers.dev/api/og/card?tipo=videochiamata";

export const Route = createFileRoute("/meetly")({
  head: () => ({
    meta: [
      { title: OG_TITLE },
      { name: "robots", content: "noindex" },
      { name: "description", content: OG_DESC },
      // riquadro d'anteprima (WhatsApp, Messenger, Telegram, iMessage, email…)
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Meetly — Hair Genius Labs" },
      { property: "og:title", content: OG_TITLE },
      { property: "og:description", content: OG_DESC },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:locale", content: "it_IT" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: OG_TITLE },
      { name: "twitter:description", content: OG_DESC },
      // colore della barra sui telefoni: coerente col marchio
      { name: "theme-color", content: "#050f24" },
    ],
  }),
  component: IngressoMeetly,
});

function IngressoMeetly() {
  const watch = getWatch();
  useLiveNav(false, watch);   // segue il presentatore appena apre una schermata
  // Sfondo neutro: in pratica non si vede mai: sopra c'è sempre la schermata
  // d'attesa o, a chiamata avviata, la videochiamata.
  return <div className="bg-blueprint min-h-screen" />;
}
