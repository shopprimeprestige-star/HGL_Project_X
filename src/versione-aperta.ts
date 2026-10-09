/** ── LA VERSIONE APERTA NEL BROWSER, E IL SUO UNICO RIMEDIO ────────────────
 *
 *  Le pagine si scaricano a pezzi, e ogni pezzo porta nel nome un codice che
 *  CAMBIA a ogni pubblicazione. Un telefono con la scheda aperta da ieri, che
 *  oggi si sposta su una schermata non ancora scaricata, chiede un pezzo che
 *  non esiste più: il caricamento fallisce e compare «Qualcosa si è rotto».
 *  Il rimedio è uno solo e lo fa il programma da sé — ricaricare, una volta.
 *
 *  ⚠️ QUESTO FILE NON IMPORTA NIENTE, ED È IL SUO MOTIVO DI ESISTERE. Il segno
 *   del ricaricamento serve a due file che si tengono per mano — `src/router`
 *   (che decide di ricaricare) e `routes/__root` (che dichiara che l'app è
 *   partita) — e il secondo è dentro l'albero delle rotte che il primo importa.
 *   Farli parlare direttamente vorrebbe dire un anello di import, e in questo
 *   programma un anello non si manifesta come errore di compilazione: si
 *   manifesta come una funzione «undefined» a runtime, cioè come la schermata
 *   d'errore che questo file esiste per evitare. Un terzo file senza import non
 *   può chiudere nessun anello.
 *  ───────────────────────────────────────────────────────────────────────── */

/** ── «QUESTO ERRORE È UN PEZZO CHE NON È ARRIVATO» ─────────────────────────
 *  Sta qui e non dentro `src/router` per una ragione sola: qui si può provare.
 *  Il router è una schermata con la sua grafica, questa è una domanda con una
 *  risposta — e la risposta decide se il telefono si riprende da solo o resta
 *  con «Try again» in faccia.
 *
 *  ⚠️ OGNI BROWSER LO DICE CON PAROLE SUE, e questo elenco conosceva solo
 *   quelle di Chrome. WebKit — cioè ogni iPhone, Safari o no — dice «An
 *   unknown error occurred when fetching the script», «Unable to load script»
 *   e, per una richiesta caduta per strada, «Load failed» dove Chrome dice
 *   «Failed to fetch». Da qui la segnalazione del committente: sul telefono
 *   il rimedio non partiva, e restava il caricamento infinito seguito dalla
 *   schermata tecnica.
 *  ⚠️ Chi aggiunge una frase qui aggiunga anche la sua prova: è l'unico modo
 *   di accorgersi, fra sei mesi, che un browser ha cambiato il suo messaggio. */
const PEZZO_MANCANTE =
  /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Failed to fetch|unknown error occurred when fetching the script|Unable to load script|Load failed/i;

/** L'errore è «non sono riuscito a scaricare un pezzo dell'app»? */
export function erroreDiVersione(e: { name?: string; message?: string } | null | undefined): boolean {
  return PEZZO_MANCANTE.test(`${e?.name || ""} ${e?.message || ""}`);
}

/** Il vecchio segno booleano «ho già ricaricato». NON LO SCRIVE PIÙ NESSUNO:
 *  al suo posto c'è il conteggio a tempo di `ricaricaPerPezzoMancante`. Resta
 *  qui solo perché le schede già aperte possono averlo addosso, spento a metà,
 *  e `appPartita` lo cancella per liberarle. */
const SEGNO = "hg_stale_reload";

/** ── UN PEZZO CHE NON ARRIVA NON DEVE ROMPERE LA PAGINA ───────────────────
 *  Segnalazione del committente, con la schermata sotto gli occhi: «Qualcosa
 *  si è rotto — Importing a module script failed», aprendo Meetly.
 *
 *  Il sito non era rotto (ogni pezzo nominato dalla pagina rispondeva): era la
 *  sua scheda, aperta prima di una pubblicazione, che chiedeva un pezzo con il
 *  nome di ieri. Per quel caso il rimedio esiste da tempo — si ricarica una
 *  volta e i nomi tornano giusti — ma stamattina, staccando il motore della
 *  consulenza dal pezzo d'avvio, il pezzo che ASCOLTA quel guasto è finito
 *  dentro il motore: cioè dentro l'unica cosa che non riusciva a caricarsi.
 *  Il rimedio non poteva più partire, e restava la schermata tecnica.
 *
 *  ⚠️ UN SEGNO TUTTO SUO, che `appPartita` NON cancella. Quello generale si
 *   cancella appena l'applicazione disegna la prima schermata — e qui la
 *   prima schermata si disegna ECCOME: è il pezzo caricato dopo che manca.
 *   Con quel segno, una pubblicazione rotta davvero manderebbe la scheda in
 *   ricarica all'infinito. Qui il freno è un altro: il conteggio a tempo di
 *   `decidiTentativo`, che non ha bisogno di nessuno che lo spenga. */
const SEGNO_PEZZO = "hg_pezzo_mancante";

/** Quanti tentativi si concedono, e in quanto tempo.
 *  ⚠️ NON PIÙ «UNO PER SCHEDA», ED È UNA CORREZIONE NATA DAL VERO. Il segno
 *   booleano restava scritto quando l'applicazione NON riusciva a partire —
 *   perché a cancellarlo è il programma che parte — e da lì in poi il soccorso
 *   si rifiutava di lavorare: il committente restava sulla schermata tecnica
 *   con un pulsante «Try again» che ritentava lo stesso pezzo mancante, cioè
 *   non poteva funzionare. Due tentativi in cinque minuti riparano il caso
 *   normale (una pubblicazione mentre la scheda è aperta) e lasciano comunque
 *   impossibile il giro infinito. */
export const TENTATIVI_MAX = 2;
export const FINESTRA_MS = 5 * 60 * 1000;

/** ── LA DECISIONE, SENZA BROWSER ATTORNO ──────────────────────────────────
 *  Tutta la regola sta qui, su due valori semplici: quello che c'è scritto nel
 *  segno e che ora è. Così si può provare davvero (vedi proveDeiPezziMancanti)
 *  invece di fidarsi: il pezzo delicato non è il ricaricamento, è il conteggio.
 *
 *  Ritorna se si ricarica e, in caso, cosa va scritto nel segno.
 *  ⚠️ `da` NON si rinnova a ogni tentativo: la finestra parte dal PRIMO. Se si
 *   rinnovasse, due ricaricamenti a catena la sposterebbero in avanti ogni
 *   volta e il conteggio non scadrebbe mai. */
export function decidiTentativo(grezzo: string | null, ora: number): { ricarica: boolean; segno?: string } {
  let n = 0;
  let da = 0;
  try {
    const j = grezzo ? (JSON.parse(grezzo) as { n?: number; da?: number }) : null;
    if (j && Number.isFinite(Number(j.da)) && Number(j.da) > 0 && ora - Number(j.da) <= FINESTRA_MS) {
      //  Dentro la finestra: il conteggio vale. Fuori si riparte da zero — una
      //  pubblicazione di stamattina non deve impedire il soccorso di stasera.
      n = Number(j.n) || 0;
      da = Number(j.da);
    }
  } catch {
    /* segno illeggibile (scritto da una versione vecchia, o storto): da zero */
  }
  if (n >= TENTATIVI_MAX) return { ricarica: false };
  return { ricarica: true, segno: JSON.stringify({ n: n + 1, da: da || ora }) };
}

export function ricaricaPerPezzoMancante(e: { name?: string; message?: string } | null | undefined): boolean {
  if (typeof window === "undefined" || !erroreDiVersione(e)) return false;
  let grezzo: string | null = null;
  try { grezzo = sessionStorage.getItem(SEGNO_PEZZO); } catch { /* niente archiviazione: si tenta */ }
  const esito = decidiTentativo(grezzo, Date.now());
  if (!esito.ricarica) {
    console.warn("[APP] un pezzo del programma continua a non arrivare: lascio la schermata con il pulsante per ricaricare");
    return false;
  }
  try { sessionStorage.setItem(SEGNO_PEZZO, esito.segno!); } catch { /* senza archiviazione si ricarica lo stesso */ }
  console.warn("[APP] un pezzo del programma non è arrivato (versione nuova pubblicata): ricarico");
  //  ⚠️ NON SI RICARICA E BASTA: prima si richiedono i pezzi scavalcando la
  //   cache. Con `immutable` un ricaricamento normale ripesca la stessa copia
  //   rotta all'infinito — è il «dice così ma non va» del committente. Il
  //   dettaglio sta nel cartellone sotto `SEGNO_URL`.
  void ripulisciERicarica();
  return true;
}

/** ── L'APP È PARTITA ───────────────────────────────────────────────────────
 *  Si chiama quando il programma riesce a disegnare la sua prima schermata, e
 *  cancella il segno.
 *
 *  ⚠️ PRIMA LO CANCELLAVA LA SCHERMATA D'ERRORE SMONTANDOSI, e non funzionava:
 *   dopo un ricaricamento quella schermata non si smonta — la pagina riparte da
 *   zero e non c'è più niente da smontare. Il segno restava scritto nella
 *   scheda per sempre, e alla pubblicazione successiva il rimedio si rifiutava
 *   di fare il suo lavoro: errore in faccia, e per toglierlo bisognava sapere
 *   che si chiude la scheda. Un telefono che aveva speso il suo ricaricamento
 *   settimane prima non si riprendeva più da solo.
 *  ⚠️ E IL GIRO INFINITO RESTA IMPOSSIBILE: se una pubblicazione è rotta
 *   davvero, l'app non parte, nessuno cancella il segno, e il ricaricamento
 *   resta uno solo. Non è cambiata la protezione: è cambiato CHI dichiara il
 *   successo — e «l'app si è disegnata» è l'unica dichiarazione vera. */
export function appPartita() {
  try {
    //  Ripulitura del vecchio segno booleano: vedi la nota su `SEGNO`.
    sessionStorage.removeItem(SEGNO);
  } catch {
    /* niente archiviazione, niente da cancellare */
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RICARICARE NON BASTA SEMPRE: A VOLTE IL PEZZO CE L'HA GIÀ, ED È ROTTO
   ───────────────────────────────────────────────────────────────────────────
   Segnalazione del committente, con la schermata nuova sotto gli occhi: «dice
   così ma non va». Cioè: la pagina riconosceva il pezzo mancante, offriva
   «Ricarica la pagina», lui ricaricava — e tornava lo stesso errore.

   ⚠️ PERCHÉ RICARICARE NON POTEVA BASTARE. I pezzi sono serviti con
    `cache-control: public, max-age=31536000, immutable` (vedi public/_headers,
    e è giusto così: il nome contiene l'impronta del contenuto). «immutable»
    dice al browser: NON chiedermelo mai più, nemmeno se l'utente ricarica.
    Se la copia che quel browser ha in pancia è arrivata storta — una richiesta
    interrotta, una rete che ha chiuso a metà, un blocco contenuti che l'ha
    svuotata — quella copia rotta resta lì per un anno, e ogni ricaricamento la
    ripesca identica. Dal di fuori: «non va, e non va mai più».

   Il rimedio è chiedere quei file SCAVALCANDO la cache (`cache: "reload"`,
   che va in rete e SOSTITUISCE la copia tenuta) e solo dopo ricaricare.
   E se invece arrivano tutti, la diagnosi è un'altra e va detta: non è il
   sito, è qualcosa nel browser che li blocca.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Dove la pagina segna l'ultimo indirizzo che non è riuscita a caricare. Lo
 *  scrive lo script d'avvio in `routes/__root` (un ascoltatore in fase di
 *  cattura, l'unico modo di vedere il fallimento di un `<link modulepreload>`),
 *  perché il messaggio d'errore di Safari il nome del file non lo dice. */
export const SEGNO_URL = "hg_pezzo_url";

/** ── QUALI INDIRIZZI VALE LA PENA RICHIEDERE ──────────────────────────────
 *  Pura apposta: è la parte che sbaglia (doppioni, indirizzi di altri domini,
 *  immagini, `undefined` finiti dentro) e va provata.
 *  · solo i pezzi dell'app (`/assets/…` .js o .css): il resto non c'entra;
 *  · niente doppioni, e l'ultimo fallito per primo — è quello che ci
 *    interessa davvero, e se la rete è lenta è l'unico che facciamo in tempo;
 *  · un tetto, perché una pagina del CRM ne dichiara più di cento e non si
 *    tiene l'utente fermo a guardare. */
export function pezziDaRinfrescare(candidati: (string | null | undefined)[], ultimo?: string | null, tetto = 40): string[] {
  const buoni: string[] = [];
  const visti = new Set<string>();
  for (const grezzo of [ultimo, ...candidati]) {
    if (typeof grezzo !== "string") continue;
    const u = grezzo.trim();
    if (!u) continue;
    //  Si guarda il percorso, non l'indirizzo intero: lo stesso file può
    //  arrivare come «/assets/x.js» o «https://sito/assets/x.js».
    const senzaQuery = u.split("?")[0].split("#")[0];
    if (!/\/assets\/[^/]+\.(?:js|css)$/i.test(senzaQuery)) continue;
    const chiave = senzaQuery.slice(senzaQuery.indexOf("/assets/"));
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    buoni.push(u);
    if (buoni.length >= tetto) break;
  }
  return buoni;
}

/** Gli indirizzi dei pezzi che QUESTA pagina ha dichiarato, più l'ultimo che
 *  si sa non essere arrivato. Tocca il documento, quindi qui non si prova:
 *  la scelta è già stata provata sopra. */
export function indirizziDellaPagina(): string[] {
  if (typeof document === "undefined") return [];
  let ultimo: string | null = null;
  try { ultimo = sessionStorage.getItem(SEGNO_URL); } catch { /* */ }
  const nodi = Array.from(document.querySelectorAll<HTMLElement>('link[rel="modulepreload"], link[rel="stylesheet"], script[src]'));
  const candidati = nodi.map((n) => (n as HTMLLinkElement).href || (n as HTMLScriptElement).src);
  return pezziDaRinfrescare(candidati, ultimo);
}

/** ── RICHIEDE I PEZZI SCAVALCANDO LA CACHE ────────────────────────────────
 *  Ritorna quelli che NON arrivano. Un elenco vuoto è un'informazione, non un
 *  successo a metà: vuol dire che il sito li dà tutti e il guasto è dentro il
 *  browser di chi guarda.
 *  ⚠️ C'è un tempo massimo: questa funzione sta fra l'utente e il rimedio, e
 *   una rete morta non deve trasformarsi in un'attesa senza fine. */
export async function rinfrescaPezzi(urls: string[], tempoMax = 2500): Promise<string[]> {
  if (typeof fetch !== "function" || !urls.length) return [];
  const scaduto = new Promise<"scaduto">((ok) => setTimeout(() => ok("scaduto"), tempoMax));
  const falliti: string[] = [];
  const lavoro = Promise.all(urls.map(async (u) => {
    try {
      //  `cache: "reload"` va in rete e SOSTITUISCE la copia tenuta: è tutto
      //  il punto di questa funzione. `no-store` invece non la sostituirebbe.
      const r = await fetch(u, { cache: "reload", credentials: "same-origin" });
      if (!r.ok) falliti.push(`${u} (${r.status})`);
    } catch {
      falliti.push(`${u} (bloccato)`);
    }
  }));
  await Promise.race([lavoro, scaduto]);
  return falliti;
}

/** Il gesto completo: rinfresca i pezzi di questa pagina e poi ricarica.
 *  È quello che fa il pulsante «Ricarica la pagina» della schermata d'errore,
 *  ed è anche la coda del soccorso automatico. */
export async function ripulisciERicarica(): Promise<void> {
  try {
    const falliti = await rinfrescaPezzi(indirizziDellaPagina());
    if (falliti.length) console.warn("[APP] pezzi che non arrivano nemmeno scavalcando la cache:", falliti);
    else console.warn("[APP] tutti i pezzi rispondono: la copia tenuta dal browser è stata sostituita");
    try { sessionStorage.removeItem(SEGNO_URL); } catch { /* */ }
  } catch { /* si ricarica lo stesso */ }
  try { window.location.reload(); } catch { /* */ }
}
