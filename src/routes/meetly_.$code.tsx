// ── MEETLY — LA STANZA DI UNA SINGOLA CONSULENZA ────────────────────────────
//  /meetly/kfr-mbqd-tzp
//
//  Meetly è il nome del nostro software di videoconsulenza, e sta nell'indirizzo
//  perché è la prima cosa che il cliente legge quando gli arriva il messaggio:
//  un indirizzo che porta un nome si riconosce, uno che descrive un'azione no.
//
//  Ogni consulenza ha la sua stanza, come le riunioni a cui il cliente è già
//  abituato. Prima il codice viaggiava come parametro
//  (?watch=kfr-mbqd-tzp): funzionava, ma un indirizzo con il punto interrogativo
//  e il segno di uguale non si detta al telefono, si taglia nelle anteprime dei
//  messaggi, e non dice al cliente che sta aprendo LA SUA consulenza e non una
//  pagina qualsiasi.
//
//  Le forme vecchie restano tutte valide — i link già mandati non si possono
//  richiamare indietro: /videochiamata/CODICE rimanda qui in modo permanente, e
//  il parametro ?watch= lo legge lo stesso unico punto del programma
//  (`watchId`), che accetta entrambe le forme.
//
//  Il trattino basso nel nome del file (meetly_.$code) dice al router: "questa
//  NON è una schermata dentro l'altra". Senza, /meetly sarebbe diventata la
//  cornice di /meetly/CODICE — e non essendo una cornice (non ha un punto in cui
//  ospitare la schermata figlia) l'indirizzo col codice rispondeva "pagina non
//  trovata".
import { createFileRoute } from "@tanstack/react-router";
import { watchId as getWatch, useLiveNav } from "@/shop/live";
import { CHIAVE_CHI, codiceAnteprimaDi } from "@/shop/chi-dal-link";

const OG_TITLE = "Meetly — la tua videoconsulenza con Hair Genius Labs";
const OG_DESC = "Tocca per entrare: il tuo consulente ti aspetta. Consulenza personalizzata in video, dal browser, senza installare nulla.";
/** L'anteprima di QUESTA stanza: l'indirizzo è fisso e decide al momento della
 *  richiesta (vedi api.og.anteprima). Il biglietto viene depositato dal CRM nel
 *  momento in cui il consulente lo guarda, sotto il codice della stanza. */
/** ── E L'ANTEPRIMA È DI CHI HA RICEVUTO QUESTO LINK ────────────────────────
 *  Segnalazione del committente: «ora l'anteprima mostra il nome del primo che
 *  ho assegnato a quell'orario, invece deve mostrare il nome corretto a ogni
 *  persona sul suo link».
 *
 *  La stanza è una sola e il biglietto depositato sotto il suo codice è uno
 *  solo: tre persone nella stessa consulenza se lo riscrivevano sopra a turno,
 *  e restava il nome del primo. Il link però porta già chi lo riceve
 *  (`?chi=p…`), e quel gettone entra nell'indirizzo dell'immagine: tre link,
 *  tre immagini, tre nomi giusti.
 *
 *  ⚠️ IL GETTONE SI LEGGE DA `match.search`, non dai parametri del percorso:
 *   è una domanda in coda all'indirizzo. È la stessa strada di /preventivo, che
 *   da lì legge il numero del preventivo per la propria anteprima — e funziona
 *   anche quando la pagina la chiede un lettore di anteprime, che è il solo
 *   caso che conta qui.
 *  ⚠️ UNA DOMANDA SOLA NELL'INDIRIZZO DELL'IMMAGINE, cioè nessuna: il gettone
 *   sta nel PERCORSO (…/invito/stanza_gettone.jpg). Dentro l'HTML una seconda
 *   domanda si scriverebbe con l'e commerciale come entità (`&amp;`) e chi non
 *   la decodifica chiede un indirizzo storto e rinuncia in silenzio — è la
 *   trappola già scritta per esteso in api.og.anteprima.$tipo.$codice. */
const anteprimaStanza = (code: string, chi?: string) =>
  `https://hair-genius-hub.hair/api/og/anteprima/invito/${encodeURIComponent(
    codiceAnteprimaDi(code, chi),
  )}.jpg`;

export const Route = createFileRoute("/meetly_/$code")({
  //  ── L'ANTEPRIMA È DI QUESTA STANZA ──────────────────────────────────────
  //   Il codice della stanza sta nell'indirizzo dell'immagine, quindi ogni
  //   cliente vede nel riquadro il biglietto preparato per lui — lo stesso che
  //   il consulente ha visto e mandato. Se non è stato depositato, l'indirizzo
  //   risponde col marchio dello studio (api.og.anteprima): mai un buco.
  head: ({ params, match }) => {
    const cerca = (match as { search?: Record<string, unknown> } | undefined)?.search;
    const chi = String((cerca?.[CHIAVE_CHI] ?? "") as string);
    const IMG = anteprimaStanza(params.code, chi);
    return {
      meta: [
        { title: OG_TITLE },
        { name: "robots", content: "noindex" },
        { name: "description", content: OG_DESC },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Meetly — Hair Genius Labs" },
        { property: "og:title", content: OG_TITLE },
        { property: "og:description", content: OG_DESC },
        //  Vedi il commento gemello su invito.$codice: og:image da solo non
        //  basta a tutti i lettori di anteprime.
        { property: "og:image", content: IMG },
        { property: "og:image:secure_url", content: IMG },
        { property: "og:image:type", content: "image/jpeg" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "675" },
        { property: "og:locale", content: "it_IT" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: OG_TITLE },
        { name: "twitter:description", content: OG_DESC },
        { name: "twitter:image", content: IMG },
        { name: "theme-color", content: "#050f24" },
      ],
    };
  },
  component: StanzaMeetly,
});

function StanzaMeetly() {
  //  Il codice si legge dall'indirizzo con la stessa funzione usata ovunque:
  //  qui arriva dal percorso, altrove dal parametro, ma il valore è uno solo.
  const watch = getWatch();
  useLiveNav(false, watch);   // segue il consulente appena apre una schermata
  // Sfondo neutro: non si vede mai davvero — sopra c'è sempre la schermata
  // d'attesa o, a consulenza avviata, la videochiamata.
  return <div className="bg-blueprint min-h-screen" />;
}
