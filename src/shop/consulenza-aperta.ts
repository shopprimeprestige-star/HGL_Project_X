/** ── UNA CONSULENZA APERTA RESTA APERTA ────────────────────────────────────
 *
 *  Segnalazione del committente: «fai che quando entrano le persone funziona.
 *  Ora non va, quando la gente entra non li ammette».
 *
 *  ── CHE COSA SUCCEDEVA, MISURATO ─────────────────────────────────────────
 *  Riprodotto in due schede: consulenza avviata (codice `gmn-pcdg-mkc`), poi il
 *  consulente passa al CRM per aprire la scheda del cliente — che è quello che
 *  si fa sempre mentre lo si aspetta. Dopo sei minuti la riga della consulenza
 *  sul server diceva:
 *
 *      live: true   hb: 19:01:51   (ora: 19:08:17)   callActive: FALSE
 *
 *  Il battito si era fermato nell'istante in cui quella scheda si era
 *  ricaricata. Da lì in poi il server dichiarava la consulenza non più viva, e
 *  il cliente che apriva il suo link leggeva «In attesa che il consulente avvii
 *  la sessione» — per sempre. Non è che non venisse ammesso: non poteva nemmeno
 *  BUSSARE. Dall'altra parte non arrivava nessuna richiesta, e il consulente
 *  vedeva una consulenza che secondo lui era avviata.
 *
 *  ── PERCHÉ IL BATTITO SI FERMAVA ─────────────────────────────────────────
 *  «La consulenza è aperta» viveva in una variabile della scheda (`sessionLive`),
 *  e il battito partiva solo se quella era accesa. Ma quella variabile muore a
 *  ogni CARICAMENTO di pagina — una ricarica, un link aperto sopra, un
 *  aggiornamento pubblicato — mentre sul server la riga resta `live: true`. Da
 *  quel momento la postazione che possiede la consulenza è l'unica che potrebbe
 *  tenerla viva, e non lo fa: crede di non avere niente in corso.
 *
 *  Qui c'è la sola domanda che serve a rimediare: «questa consulenza è MIA ed è
 *  ancora aperta? allora me la riprendo». Chi chiama poi riaccende la sessione e
 *  ribatte (vedi `riprendiConsulenzaAperta` in shop/call).
 *
 *  ⚠️ RIPRENDERE NON È AVVIARE UNA VIDEOCHIAMATA. Si riapre la stanza — il
 *   cliente può entrare e bussare — ma la telecamera non si accende da sola:
 *   quella la avvia una persona. Tenere insieme le due cose farebbe partire una
 *   videochiamata che nessuno ha chiesto (è già scritto in PresenterBar, dove si
 *   usa `inChiamata` proprio per questo).
 *  ⚠️ NON SI RIPRENDE LA CONSULENZA DI UN COLLEGA: se la riga porta un nome e
 *   non è il nostro si lascia stare. Due postazioni sullo stesso canale sono il
 *   guasto vecchio in cui «Accetta» mandava il via libera in una stanza dove il
 *   cliente non c'era.
 *  ⚠️ E NON SI RESUSCITA QUELLA DI IERI: si riprende solo se il battito è di
 *   poco fa. Il caso da rimediare è una pagina che si ricarica — lì il battito
 *   ha al massimo pochi secondi — non una sessione lasciata aperta il giorno
 *   prima chiudendo il portatile, che riaprendosi da sola rimetterebbe in
 *   funzione un link che il consulente credeva scaduto.
 *  ───────────────────────────────────────────────────────────────────────── */

/** La riga della consulenza come la risponde il server (api.presenter.session).
 *  Solo i campi che contano per questa decisione. */
export interface RigaConsulenza {
  live?: boolean;
  code?: string | null;
  presenterId?: string | null;
  /** Ultimo battito, in ISO. È quello che dice «quanto tempo è passato». */
  hb?: string | null;
}

/** ── QUANTO INDIETRO SI PUÒ ANDARE ─────────────────────────────────────────
 *  Dieci minuti. La ricarica che causava il guasto lascia un battito vecchio di
 *  pochi secondi, quindi dieci minuti sono larghissimi per il caso vero; e sono
 *  troppo pochi perché una consulenza di stamattina si riapra da sola nel
 *  pomeriggio. In mezzo c'è il pulsante «Rientra», che è lì per quello. */
export const RIPRESA_MAX_MS = 10 * 60_000;

/** ── QUANTO SILENZIO VUOL DIRE «FINITA» ────────────────────────────────────
 *  Un quarto d'ora. È dodici volte la finestra che tiene dentro il cliente
 *  (`HB_MAX_MS`, settanta secondi) e dieci volte il battito rallentato di una
 *  scheda in secondo piano: nessuno che stia davvero lavorando può caderci
 *  dentro. */
export const SILENZIO_FINE_MS = 15 * 60_000;

/** ── LA CONSULENZA CHE NESSUNO HA CHIUSO ───────────────────────────────────
 *
 *  Misurato in archivio: 13 consulenze dichiarate «vive», ferme da 4 a 102 ore.
 *  Nessuno le chiude — si chiude la scheda e basta, e il programma non lo sa.
 *  Non è solo sporcizia: la barra propone «Rientra» su una stanza di quattro
 *  giorni fa, e premendolo si trasmette su un codice il cui link non ce l'ha
 *  più nessuno (mentre il cliente aspetta sul suo, che è un altro).
 *
 *  ⚠️ NON SI CHIUDE QUANDO LA SCHEDA SI CHIUDE. Una ricaricata della pagina
 *   sembra identica a una scheda chiusa, e ammazzerebbe una consulenza viva
 *   con il cliente dentro. L'unica cosa che distingue davvero le due è il
 *   SILENZIO che segue: dopo un quarto d'ora non è una ricarica.
 *  ⚠️ SI DECIDE ALLA LETTURA, e chi legge riscrive la riga chiusa: così
 *   l'archivio si pulisce da solo senza nessun lavoro periodico. */
export function consulenzaDaChiudere(
  riga: { live?: boolean; hb?: string | null; startedAt?: string | null } | null | undefined,
  adesso = Date.now(),
): boolean {
  if (!riga?.live) return false;
  //  L'ultimo segno di vita: il battito, o — sulle righe nate prima che il
  //  battito esistesse — l'ora di apertura.
  const t = Date.parse(String(riga.hb || riga.startedAt || ""));
  //  Nessuna data leggibile su una riga che si dichiara viva: è una riga
  //  rotta, e una riga rotta non deve tenere aperta una stanza per sempre.
  if (!Number.isFinite(t)) return true;
  return adesso - t > SILENZIO_FINE_MS;
}

export function siRiprendeLaConsulenza(p: {
  riga?: RigaConsulenza | null;
  /** Il codice che questa postazione ha in mano (`hg_live_session`). */
  mioCodice?: string | null;
  /** Chi sta usando questa postazione, se lo sappiamo. */
  ioSono?: string | null;
  /** La sessione è già accesa qui dentro: non c'è niente da riprendere. */
  giaAperta: boolean;
  adesso?: number;
}): boolean {
  const riga = p.riga;
  if (!riga?.live) return false;
  if (p.giaAperta) return false;
  //  Il codice deve essere lo STESSO: è l'unica cosa che lega una postazione a
  //  una consulenza. Senza questo controllo si adotterebbe la stanza che il
  //  server ha risposto, cioè si cambierebbe canale sotto a chi sta bussando.
  const mio = String(p.mioCodice || "").trim();
  const suo = String(riga.code || "").trim();
  if (!mio || !suo || mio !== suo) return false;
  //  Il nome si controlla solo se lo sanno tutti e due: le righe scritte dalle
  //  versioni vecchie non hanno `presenterId`, e scartarle vorrebbe dire non
  //  riprendere mai niente proprio durante il passaggio a questa versione.
  const chi = String(riga.presenterId || "").trim();
  const io = String(p.ioSono || "").trim();
  if (chi && io && chi !== io) return false;
  const t = riga.hb ? Date.parse(riga.hb) : NaN;
  if (!Number.isFinite(t)) return false;
  //  Un battito «nel futuro» è l'orologio del computer che non coincide con
  //  quello del server: vale come fresco, non come impossibile.
  return (p.adesso ?? Date.now()) - t < RIPRESA_MAX_MS;
}

/** ── E QUANDO NON È PIÙ APERTA? ────────────────────────────────────────────
 *  Trovato provando il pannello in locale: chiusa la consulenza sul server, la
 *  scheda del consulente continuava a mostrare il pannello «Cosa vede il
 *  cliente» col nome del cliente dentro. È la stessa famiglia della
 *  segnalazione «c'è sempre questo aperto, anche se non ho Meetly aperto»:
 *  allora il difetto era `readLiveId()` (l'ULTIMA stanza, per sempre), e la
 *  cura fu guardare `sessionLive`. Ma `sessionLive`, una volta acceso, non lo
 *  spegneva nessuno: la spegne solo chi chiude la consulenza DA QUESTA scheda.
 *  Chi la chiude da un'altra scheda, o da un altro computer, lasciava questa
 *  convinta di essere in diretta.
 *
 *  ⚠️ SI CHIUDE SOLO SU UNA RISPOSTA CHIARA, E MAI SULLA PRIMA. Una rete che
 *   manca, una risposta a metà o la riga non ancora scritta (l'avvio è appena
 *   partito) non sono una chiusura: due letture negative di fila, a dieci
 *   secondi l'una dall'altra, sono una chiusura. Spegnere per sbaglio vorrebbe
 *   dire fermare il battito a metà consulenza, cioè chiudere la porta in
 *   faccia a chi sta bussando — il guasto peggiore dei due. */
export function siChiudeLaConsulenza(p: {
  /** La riga letta dal server. `null`/assente = non si è capito: non si chiude. */
  riga?: RigaConsulenza | null;
  /** Il codice che questa postazione ha in mano. */
  mioCodice?: string | null;
  /** Quante letture negative di fila ci sono già state (questa compresa). */
  negativeDiFila?: number;
}): boolean {
  const riga = p.riga;
  if (!riga) return false;                     // niente risposta: non si conclude niente
  const mio = String(p.mioCodice || "").trim();
  if (!mio) return false;
  //  Se il server parla di UN'ALTRA stanza, questa non è una risposta sulla mia.
  const suo = String(riga.code || "").trim();
  if (riga.live === true && (!suo || suo === mio)) return false;   // è viva: niente da chiudere
  if (riga.live === true) return false;        // viva, ma di un altro codice: non mi riguarda
  return (Number(p.negativeDiFila) || 0) >= 2;
}
