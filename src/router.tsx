import { createRouter, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { routeTree } from "./routeTree.gen";
import { erroreDiVersione, indirizziDellaPagina, ricaricaPerPezzoMancante, rinfrescaPezzi, ripulisciERicarica } from "@/versione-aperta";

/** true se questo browser è quello del CLIENTE (link ospite / gate attivo). */
const GUEST_FLAG = "hg_is_guest";
function isGuestDevice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    //  Il riconoscimento è ripetuto qui e non importato da live.ts di proposito:
    //  live.ts tira dentro il motore della chiamata, e il router non deve
    //  caricarlo per rispondere a una domanda da una riga. Il vecchio nome resta
    //  nell'elenco finché in giro ci sono link /videochiamata già mandati.
    const inStanza = /^\/(?:meetly|videochiamata)\/[^/]/.test(window.location.pathname);
    if (q.get("watch") || inStanza || q.get("client") === "1") {
      // ── MEMORIA DEL "SONO UN CLIENTE" ─────────────────────────────────────
      //  Il riconoscimento si basava solo su ciò che è visibile NEL MOMENTO in
      //  cui l'errore viene intercettato: parametro nell'indirizzo e classi
      //  sulla pagina. Ma un errore può scattare mentre l'indirizzo sta
      //  cambiando (navigazione fra schermate) o prima che le classi vengano
      //  applicate: in quegli istanti il cliente risultava un presentatore e si
      //  vedeva la schermata tecnica. Da qui l'"a volte sì, a volte no".
      //  Ora il fatto di essere un cliente viene RICORDATO per tutta la sessione.
      try { sessionStorage.setItem(GUEST_FLAG, "1"); } catch { /* */ }
      return true;
    }
    try { if (sessionStorage.getItem(GUEST_FLAG) === "1") return true; } catch { /* */ }
    const c = document.documentElement.classList;
    return c.contains("hg-guest") || c.contains("hg-guest-gated");
  } catch { return false; }
}

/** L'ospite non deve MAI vedere una schermata tecnica.
 *  Vede la schermata brandizzata di attesa e la pagina si ricarica da sola:
 *  nella pratica per lui è un attimo di caricamento, non un errore. */
function GuestFallback({ error }: { error: Error }) {
  useEffect(() => {
    console.error("[GUEST][ERR] schermata di errore intercettata:", error?.message || error);
    // segnalazione al presentatore (badge "Ricarica") + ripristino automatico
    import("@/shop/call")
      .then((m) => m.reportGuestError?.(`Rotta: ${error?.message || String(error)}`, error?.stack || ""))
      .catch(() => { /* */ });
    // ── NON RICARICARE PER UN ERRORE BENIGNO ──────────────────────────────
    //  Ricaricare la pagina del cliente significa farlo USCIRE e rientrare nella
    //  videochiamata: per lui è uno scollegamento. Va fatto solo quando serve
    //  davvero. Gli errori di rimozione di un nodo (tipici dello smontaggio di
    //  un lettore esterno mentre si cambia schermata) non richiedono un
    //  ricaricamento: basta ricostruire la schermata, e la chiamata resta viva.
    const benign = /NotFoundError|removeChild|insertBefore|The object can not be found here/i
      .test(`${error?.name || ""} ${error?.message || ""}`);
    if (benign) {
      console.warn("[GUEST][ERR] errore di smontaggio: ricostruisco la schermata SENZA ricaricare (la chiamata resta attiva)");
      return;
    }
    const t = setTimeout(() => { try { window.location.reload(); } catch { /* */ } }, 1400);
    return () => clearTimeout(t);
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050f24] px-6 text-center text-white">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand" />
      <p className="text-base font-semibold">Un attimo, sto preparando la tua consulenza…</p>
      <p className="text-sm text-white/50">Resta pure su questa pagina.</p>
    </div>
  );
}

/** ── PERCHÉ L'ERRORE COMPARE "OGNI TANTO" E SOLO CAMBIANDO SCHERMATA ────────
 *  Le pagine (/slide, /presenta, /preventivo) vengono caricate a pezzi, e ogni
 *  pezzo ha un nome con un codice che CAMBIA a ogni pubblicazione. Se il
 *  dispositivo del cliente ha aperto la pagina PRIMA di una pubblicazione e poi
 *  si sposta su una schermata non ancora scaricata, chiede al server un pezzo
 *  che non esiste più → il caricamento fallisce e il router mostra la schermata
 *  d'errore. Torna tutto a posto ricaricando (nuovi codici): esattamente quello
 *  che hai osservato. "Try again" non poteva funzionare perché rimontava la
 *  stessa rotta e richiedeva di nuovo lo stesso pezzo mancante.
 *  Rimedio: riconoscere questo errore e ricaricare da soli — due tentativi in
 *  cinque minuti, poi una schermata con il pulsante giusto. */
function isStaleBuildError(error: Error): boolean {
  //  La regola sta in `versione-aperta` insieme al segno del ricaricamento:
  //  è lo stesso argomento, e là si può provare (vedi proveDeiPezziMancanti).
  return erroreDiVersione(error);
}
/** ── LA SCHERMATA DEL PEZZO CHE NON ARRIVA ────────────────────────────────
 *  Non è un guasto del programma: è una versione nuova pubblicata mentre
 *  questa scheda era aperta, oppure una copia rotta tenuta dal browser.
 *  ⚠️ E QUI SI FA UNA DIAGNOSI, non si tira a indovinare. Il committente ha
 *   ricaricato e ha rivisto lo stesso errore («dice così ma non va»): senza
 *   sapere QUALE file non arriva non si può dire se il sito non lo dà o se è
 *   il browser a non volerlo. La pagina se lo chiede da sola, e lo scrive.
 *  Il pulsante non ricarica e basta: prima richiede i pezzi scavalcando la
 *  cache (`ripulisciERicarica`), perché con `immutable` un ricaricamento
 *  normale ripesca all'infinito la stessa copia rotta. */
function SchermataPezzoMancante({ error }: { error: Error }) {
  const [diagnosi, setDiagnosi] = useState<string>("Controllo quale pezzo non arriva…");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const falliti = await rinfrescaPezzi(indirizziDellaPagina());
      if (!vivo) return;
      if (falliti.length) {
        const nomi = falliti.map((u) => u.split("/").pop()).join(", ");
        setDiagnosi(`Il server non dà questo pezzo: ${nomi}`);
      } else {
        //  Tutti i pezzi rispondono: il sito sta bene. Allora o la copia
        //  tenuta dal browser era rotta — e adesso è stata sostituita, quindi
        //  ricaricare risolve — oppure qualcosa nel browser li blocca.
        setDiagnosi("Tutti i pezzi rispondono: la copia rovinata è stata sostituita, basta ricaricare.");
      }
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">C'è una versione nuova</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Questa scheda sta chiedendo pezzi che non esistono più, o ne ha in memoria una copia
          rovinata. Si sistema ricaricando: non perdi niente di quello che hai salvato.
        </p>
        <p className="mt-3 text-sm text-foreground/80">{diagnosi}</p>
        <button
          type="button"
          onClick={() => { void ripulisciERicarica(); }}
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Ricarica la pagina
        </button>
        <p className="mt-4 font-mono text-[11px] text-muted-foreground/70">{error?.message}</p>
      </div>
    </div>
  );
}

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  /*  ── ⚠️ UN PEZZO MANCANTE NON SI RIPARA RITENTANDO ────────────────────
      Segnalazione del committente, due volte in una sera: «Importing a module
      script failed» entrando come presentatore. Il sito stava bene (ho
      controllato uno per uno i 68 pezzi della pagina: ci sono tutti): era la
      sua scheda, aperta prima di una pubblicazione, che nel passare da una
      schermata all'altra chiedeva un pezzo col nome di ieri.
      Il soccorso c'era ma si era già speso — il segno «ho già ricaricato»
      restava scritto proprio nei casi in cui il programma NON riusciva a
      partire, perché a cancellarlo è il programma che parte. E il pulsante
      che restava, «Try again», ritentava la stessa rotta e lo stesso pezzo
      mancante: non poteva funzionare, mai.
      Adesso: due tentativi in cinque minuti (vedi `ricaricaPerPezzoMancante`)
      e, se non bastano, una schermata che dice la cosa vera e offre il gesto
      giusto — ricaricare. */
  const pezzoMancante = isStaleBuildError(error);
  useEffect(() => {
    if (typeof window === "undefined" || !pezzoMancante) return;
    ricaricaPerPezzoMancante(error);
  }, [error, pezzoMancante]);
  //  ⚠️ QUI NON SI SPEGNE NIENTE SMONTANDOSI. Nel caso che conta questa
  //   schermata non si smonta mai — dopo un ricaricamento la pagina riparte da
  //   zero — e ogni segno lasciato acceso qui resterebbe acceso per sempre. È
  //   la ragione per cui il conteggio dei tentativi scade col tempo invece di
  //   aspettare che qualcuno lo cancelli.

  // ── CAUSA PER CUI L'OSPITE VEDEVA ANCORA "Something went wrong" ───────────
  //  La protezione aggiunta in precedenza avvolge <Outlet/>. Ma un errore dentro
  //  una rotta viene catturato PRIMA dal router, che sostituisce il contenuto con
  //  QUESTO componente: la protezione, essendo più esterna, non veniva mai
  //  raggiunta. Ecco anche perché "Try again" non faceva nulla: rimontava la
  //  stessa rotta che falliva di nuovo, senza ricaricare né richiedere lo stato.
  //  Ora il caso ospite è gestito qui, al punto in cui l'errore viene davvero
  //  intercettato.
  if (isGuestDevice()) return <GuestFallback error={error} />;

  /*  Il caso «pezzo mancante» ha una schermata sua: non è un guasto del
      programma, è una versione nuova pubblicata mentre questa scheda era
      aperta — e si risolve ricaricando, non ritentando. */
  if (pezzoMancante) return <SchermataPezzoMancante error={error} />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Qualcosa si è rotto</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Questa schermata non è riuscita ad aprirsi. Sotto c'è il motivo tecnico: copialo e
          mandalo a chi segue il programma, è ciò che serve per correggere.
        </p>
        {/* ── L'ERRORE SI LEGGE, ANCHE IN PRODUZIONE ──────────────────────────
            Prima il motivo compariva SOLO in sviluppo: chi lavora vedeva
            "Something went wrong" e basta, e riferire un guasto voleva dire
            descriverlo a parole. Qui siamo già oltre il controllo sull'ospite
            qui sopra — quindi questa schermata la vede solo chi usa il
            programma, mai un cliente: mostrare il motivo non espone nulla. */}
        {error?.message && (
          <pre className="mt-4 max-h-56 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-[11px] leading-relaxed text-destructive">
            {error.message}
            {error.stack ? `\n\n${String(error.stack).split("\n").slice(0, 8).join("\n")}` : ""}
          </pre>
        )}
        {error?.message && (
          <button
            type="button"
            onClick={() => {
              const t = `${error.message}\n\n${error.stack ?? ""}`;
              navigator.clipboard?.writeText(t).catch(() => { /* niente appunti: resta leggibile sopra */ });
            }}
            className="mt-3 inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Copia il motivo tecnico
          </button>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              // "Try again" rimontava la stessa rotta che stava fallendo →
              // sembrava non fare nulla. Ricarica davvero.
              router.invalidate();
              reset();
              window.location.reload();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    // ── DISATTIVATO DI PROPOSITO ──────────────────────────────────────────
    //  Il ripristino automatico dello scroll per rotta RIMETTEVA l'ospite dove
    //  si trovava l'ULTIMA volta su quella pagina, ad ogni cambio schermata
    //  pilotato dal presentatore (preventivo → slide → media → preventivo).
    //  Combatteva direttamente con la sincronizzazione per ancore: da qui lo
    //  scarto costante che ricompariva su tutta la pagina. Qui la posizione la
    //  decide il presentatore, non la cronologia del browser.
    scrollRestoration: false,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
