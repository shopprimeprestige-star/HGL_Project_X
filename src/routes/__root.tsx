import { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
/*  ── ⚠️ IL MOTORE DELLA CONSULENZA NON STA PIÙ NEL PEZZO D'AVVIO ──────────
    Misurato: 849 kB il pezzo d'avvio, di cui 400 il motore — caricato su ogni
    pagina, CRM compreso, dove non disegna niente. Adesso arriva a parte: vedi
    shop/motore-pigro e la regola in shop/link-ospite. */
import { lazy, Suspense, useCallback, useState } from "react";
import { ConfineOspite, SchermataUnAttimo } from "@/shop/ConfineOspite";
import { linkDaCliente, motoreSubito } from "@/shop/link-ospite";

/*  ⚠️ E SE IL PEZZO NON ARRIVA, LA PAGINA RESTA IN PIEDI. Una scheda aperta
    prima di una pubblicazione chiede pezzi con i nomi di ieri: prima questo
    caso lo intercettava il motore stesso — cioè proprio quello che non
    arrivava — e al committente restava la schermata «Qualcosa si è rotto».
    Adesso: si ricarica una volta sola (vedi `ricaricaPerPezzoMancante`), e
    intanto la pagina continua a funzionare senza il motore, che è un di più:
    al cliente si mostra la schermata d'attesa, a chi lavora niente. */
const MotoreConCancello = lazy(() =>
  import("@/shop/motore-pigro").catch((e) => {
    ricaricaPerPezzoMancante(e as { name?: string; message?: string });
    const senzaMotore = () => (daCliente() ? <SchermataUnAttimo /> : <></>);
    return { default: senzaMotore as unknown as typeof import("@/shop/motore-pigro").default };
  }),
);

/** Questa pagina è aperta da un cliente? (copia locale, senza il motore) */
function daCliente(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return linkDaCliente({
      percorso: window.location.pathname,
      ricerca: window.location.search,
      inCornice: window.self !== window.top,
    });
  } catch { return false; }
}
import { appPartita, ricaricaPerPezzoMancante } from "@/versione-aperta";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  // ── IL DOCUMENTO NON SI TIENE IN CACHE ────────────────────────────────────
  //  L'HTML contiene i nomi dei pezzi di codice, che cambiano a ogni
  //  pubblicazione. Se il browser lo conserva per suo conto, continua a
  //  chiedere pezzi che non esistono più: da qui le pagine che "non si
  //  aggiornano" e i clienti che cadono a metà consulenza dopo un deploy.
  //  `no-cache` non vieta la cache: obbliga a chiedere al server se è cambiata,
  //  quindi non costa banda quando non serve.
  headers: () => ({ "Cache-Control": "no-cache, must-revalidate" }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bio-mimetic Implant™" },
      {
        name: "description",
        content:
          "Bio-mimetic Implant™ — impianto di grado clinico, indistinguibile dalla cute. Analisi tecnica gratuita.",
      },
      { name: "author", content: "Hair Genius Labs" },
      // ── ANTEPRIME: LE DICHIARA OGNI PAGINA ─────────────────────────────
      //  Qui c'erano titolo, descrizione e immagine buoni per il sito
      //  pubblico. Ma queste righe vengono PRIMA di quelle delle singole
      //  pagine, e i programmi di messaggistica leggono la prima che trovano:
      //  qualunque link condiviso — preventivo, videoconsulenza, slide —
      //  mostrava la stessa anteprima generica, ereditata per giunta dal
      //  modello con cui il sito era nato ("Replicates landing pages…").
      //  Ora l'anteprima la dichiara la pagina che viene condivisa.
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Hair Genius Labs" },
      { property: "og:locale", content: "it_IT" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

// Gate ospite PRIMA del primo paint: se l'URL ha ?watch= (link ospite, non dentro
// l'iframe di anteprima) marchio subito <html> così il CSS nasconde il contenuto
// della pagina. Nessun lampo di slide/preventivo prima dell'attesa + nome.
// Contestualmente forzo il viewport a scala 1 (niente pagina "pinch-zoomata").
/*  ── ⚠️ LA RETE DI SICUREZZA DELL'AVVIO, PRIMA DI TUTTO ───────────────────
    Segnalazione del committente, con la schermata sotto gli occhi: la pagina
    del presentatore ferma su «Caricamento…», per sempre.
    Il meccanismo, ricostruito: ogni pubblicazione ribattezza i pezzi del
    programma. Una scheda ripristinata da Safari (o rimasta aperta) riparte
    dall'HTML e chiede il pezzo d'avvio con il nome di IERI: quel file non
    esiste più, il modulo non parte, e NESSUNO se ne accorge — non c'è un
    errore da intercettare, perché il programma non è mai partito. Resta a
    schermo la pagina disegnata dal server, con dentro «Caricamento…» che non
    finirà mai, e i clic che non rispondono.
    Qui c'è l'unica cosa che può salvarla: un controllo che vive PRIMA del
    programma, nella pagina stessa. Se dopo otto secondi il programma non ha
    dato segni di vita, si ricarica — e ricaricando l'HTML (che non sta mai in
    cache) i nomi tornano giusti.
    ⚠️ UNA VOLTA SOLA PER SCHEDA: se una pubblicazione fosse rotta davvero, la
     pagina resterebbe com'è invece di ricaricarsi all'infinito. Il segno lo
     cancella il programma quando parte (`hg-viva`), così la volta dopo la
     rete di sicurezza è di nuovo pronta.
    ⚠️ E solo a scheda VISIBILE: una scheda in secondo piano viene rallentata
     dal browser, e otto secondi lì non vogliono dire niente. */
/*  ── CHI NON È ARRIVATO: IL NOME DEL FILE ─────────────────────────────────
    Safari, quando un modulo non si carica, dice «Importing a module script
    failed» e basta: il nome del file non lo dice né a noi né all'utente, e
    senza quel nome non si può sapere se è il sito a non darlo o il browser a
    non volerlo. Un ascoltatore in FASE DI CATTURA vede invece il fallimento
    del singolo `<link rel=modulepreload>` / `<script>`, con il suo indirizzo.
    ⚠️ Sta qui, in uno script che gira PRIMA del programma, perché i primi
     fallimenti avvengono prima che il programma esista. Un soccorso non può
     vivere dentro ciò che deve soccorrere — è già costato una sera. */
const SPIA_PEZZI = `try{window.addEventListener('error',function(e){try{
var t=e&&e.target;if(!t||t===window)return;
var u=t.href||t.src;if(!u||u.indexOf('/assets/')<0)return;
sessionStorage.setItem('hg_pezzo_url',u);
console.warn('[APP] non arriva:',u);}catch(_){}} ,true);}catch(e){}`;

const AVVIO_BOOT = `try{var K='hg_avvio_fallito';
setTimeout(function(){try{
if(document.documentElement.classList.contains('hg-viva'))return;
if(document.visibilityState==='hidden')return;
if(sessionStorage.getItem(K)==='1')return;
sessionStorage.setItem(K,'1');
location.reload();}catch(e){}},8000);}catch(e){}`;

const GUEST_GATE_BOOT = `try{var p=new URLSearchParams(location.search);
if(p.get('watch')&&window.self===window.top){document.documentElement.classList.add('hg-guest-gated','hg-guest');
var m=document.querySelector('meta[name="viewport"]');
if(!m){m=document.createElement('meta');m.setAttribute('name','viewport');document.head.appendChild(m);}
m.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=5, user-scalable=1, viewport-fit=cover');
document.documentElement.style.zoom='';}}catch(e){}`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: SPIA_PEZZI }} />
        <script dangerouslySetInnerHTML={{ __html: GUEST_GATE_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: AVVIO_BOOT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // GATE OSPITE GLOBALE — vale per OGNI pagina aperta con un link ?watch=.
  // MECCANISMO (non più solo CSS): finché l'ospite non è PRONTO, l'<Outlet> non
  // viene proprio RENDERIZZATO. In DOM c'è solo la schermata di caricamento
  // brandizzata di <CallMount> (WaitingScreen / GuestJoinGate / ConnectingScreen).
  // Nessuna corsa fra classi CSS e render può far lampeggiare il preventivo.
  // La prontezza NON dipende più dalla pagina montata: la calcola il motore
  // leggendo lo stato AUTOREVOLE dal server (curpage + quotestate) — vedi
  // startGuestReadinessPoll() in shop/call.tsx — con timeout di sicurezza 7s e
  // isteresi (una volta pronto non si torna mai al caricamento).
  // La classe CSS resta come doppia sicurezza insieme allo script pre-paint.
  /*  ── IL CANCELLO PRIMA CHE IL MOTORE ARRIVI ───────────────────────────
      Sui link del cliente si parte CHIUSI: il motore sta arrivando e finché
      non c'è nessuno può dire se è il momento di mostrare i contenuti — e un
      preventivo che lampeggia prima della sala d'attesa è esattamente la cosa
      da non fare. Su tutte le altre pagine si parte aperti: lì il cancello
      non è mai esistito. */
  const [gated, setGated] = useState<boolean>(daCliente);
  const cancello = useCallback((chiuso: boolean) => setGated(chiuso), []);
  /*  ── QUANDO SI CHIEDE IL MOTORE ────────────────────────────────────────
      Subito dove serve subito — il link del cliente (è il motore a disegnare
      la sala d'attesa) e la postazione con una consulenza aperta (è il motore
      a ricevere le bussate). Altrove si aspetta che il browser abbia finito
      di disegnare: nel CRM quel mezzo megabyte non deve rubare la rete ai dati
      della dashboard. Vedi `motoreSubito` in shop/link-ospite. */
  const [motoreOra, setMotoreOra] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return motoreSubito({
        percorso: window.location.pathname,
        ricerca: window.location.search,
        inCornice: window.self !== window.top,
        consulenzaAperta: !!localStorage.getItem("hg_live_session"),
      });
    } catch { return true; }
  });
  useEffect(() => {
    if (motoreOra || typeof window === "undefined") return;
    const chiedilo = () => setMotoreOra(true);
    //  ⚠️ Con un tetto: `requestIdleCallback` su una pagina che non sta mai
    //   ferma potrebbe non arrivare mai, e il consulente resterebbe senza
    //   motore — cioè senza bussate.
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = ric ? ric(chiedilo, { timeout: 2500 }) : window.setTimeout(chiedilo, 1200);
    return () => {
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (ric && cic) cic(id as number); else clearTimeout(id as number);
    };
  }, [motoreOra]);
  //  ⚠️ L'APP È PARTITA: si cancella il segno del ricaricamento automatico dopo
  //   una pubblicazione. Se restasse scritto, il rimedio funzionerebbe una
  //   volta sola per scheda e alla pubblicazione dopo il telefono resterebbe
  //   sulla schermata d'errore. Il perché per esteso sta in `appPartita`
  //   (src/router.tsx).
  /*  ⚠️ L'ASCOLTATORE STA QUI, NON NEL MOTORE. Vite avvisa PRIMA che un
      precaricamento fallito diventi un errore; finché questo ascoltatore
      viveva dentro il motore, il caso peggiore — è il motore a non arrivare —
      restava scoperto. */
  useEffect(() => {
    const suPezzo = (e: Event) => {
      const dettaglio = (e as unknown as { payload?: { message?: string } })?.payload;
      ricaricaPerPezzoMancante({ message: dettaglio?.message || "dynamically imported module" });
    };
    window.addEventListener("vite:preloadError", suPezzo as EventListener);
    return () => window.removeEventListener("vite:preloadError", suPezzo as EventListener);
  }, []);
  useEffect(() => {
    /*  «Il programma è vivo»: lo dice a chi controlla da fuori (vedi
        AVVIO_BOOT) e cancella il segno, così la rete di sicurezza è pronta
        per la prossima volta. */
    try {
      document.documentElement.classList.add("hg-viva");
      sessionStorage.removeItem("hg_avvio_fallito");
    } catch { /* senza archiviazione va bene lo stesso */ }
    appPartita();
    /*  ── ⚠️ QUANDO LA PAGINA COMINCIA DAVVERO A RISPONDERE ────────────────
        Segnalazione del committente: «non risponde subito appena carica la
        pagina, dopo 10 secondi funzionano i clic».
        È la differenza fra VEDERE una pagina e POTERLA USARE: il server manda
        la pagina già disegnata (per questo compare subito), ma finché il
        browser non ha finito di scaricare e collegare il programma, i
        pulsanti sono figure. Questa riga è l'unico modo di misurare quel
        momento dal computer di chi lo vive: si legge nel registro del
        browser, e dice il numero invece di farlo indovinare. */
    if (typeof performance !== "undefined") {
      console.log(`[PRONTO] la pagina risponde ai clic (+${Math.round(performance.now())} ms dall'apertura)`);
    }
  }, []);
  useEffect(() => {
    const cl = document.documentElement.classList;
    if (gated) cl.add("hg-guest-gated");
    else { cl.remove("hg-guest-gated"); console.log("[GUEST] gate rilasciato: contenuti visibili"); }
  }, [gated]);
  return (
    <>
      {!gated && (
        <div id="hg-outlet" style={{ display: "contents" }}>
          {/* RESILIENZA OSPITE — un errore di render della PAGINA non deve mai
             mostrare al cliente la schermata tecnica del router: GuestSafe
             sostituisce la schermata di attesa brandizzata, ri-monta da solo
             dopo ~1s e avvisa il presentatore (badge "Ricarica"). Sul
             presentatore GuestSafe è trasparente. */}
          <ConfineOspite tag="page">
            <Outlet />
          </ConfineOspite>
        </div>
      )}
      {/*  ⚠️ `fallback={null}`: mentre il motore arriva non si disegna NIENTE
           al suo posto. Il cancello lo tiene chiuso la radice (qui sopra), e
           una schermata di attesa in più farebbe lampeggiare due cose diverse
           nello stesso istante. */}
      {motoreOra && (
        <Suspense fallback={null}>
          <MotoreConCancello cancello={cancello} />
        </Suspense>
      )}
    </>
  );
}
