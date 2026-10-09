// ── IL BIGLIETTO DELLA CONSULENZA — IL MOTORE ───────────────────────────────
//  Un'immagine 1920×1080 che il consulente allega al messaggio WhatsApp con cui
//  manda il link dell'invito. Non ripete quello che il messaggio dice già in
//  testo (giorno, ora, indirizzo): quelle cose il cliente le legge meglio dal
//  testo, che si copia e si tocca. Il biglietto porta l'unica cosa che né il
//  messaggio né la pagina hanno — la ragione per volerci essere: le tre
//  soluzioni, affiancate, di cui una è la nostra.
//
//  Qui dentro non c'è nessun testo di prodotto scritto a mano: tutto quello che
//  si legge sul biglietto arriva da ./consulenza-contenuti, che è lo stesso file
//  da cui legge la pagina pubblica. Sono due disegni della stessa frase, non due
//  frasi — e il cliente li vede a due minuti di distanza.
//
//  ⚠️ QUESTO FILE NON PUÒ STAMPARE PIÙ DI QUELLO CHE PUBBLICA LA PAGINA.
//  L'invito pubblico espone sei campi e non uno di più (src/crm/invito.ts:52-69,
//  src/routes/api.public.invito.ts:15-20): nome di battesimo, giorno, ora,
//  durata, consulente, link. Il biglietto si disegna nel browser del CRM, dove
//  a portata di dito ci sono anche cognome, telefono, email, città, note, stato
//  della trattativa e importi — e un'immagine si inoltra più facilmente di un
//  link, perché nessuno la rilegge prima di girarla. Vale la stessa lista di
//  sei. Chi aggiunge un campo a DatiBiglietto lo sta pubblicando su internet.
//
//  ⚠️ NESSUNA DIPENDENZA. Canvas 2D per il disegno, TextEncoder e Uint8Array per
//  il PDF. Niente html2canvas, niente jspdf, niente satori, e soprattutto niente
//  SVG dentro un <img>: dentro un tag immagine il font del documento NON viene
//  caricato e il biglietto uscirebbe con un carattere di ripiego diverso da
//  quello che il consulente vede a schermo. Canvas 2D risolve le famiglie come
//  il DOM, quindi il biglietto assomiglia al sito.
import {
  durataInParole,
  durataPulita,
  giorniDaOggiInvito,
  giornoPerEsteso,
  oraPulita,
  type DatiInvito,
} from "./invito";
import { FRASI, SOLUZIONI, type ConcettoIcona } from "./consulenza-contenuti";

// ── L'INTERFACCIA ───────────────────────────────────────────────────────────

export interface DatiBiglietto {
  nome: string; // nome di battesimo gia ripulito
  giorno: string; // aaaa-mm-gg
  ora: string; // hh:mm
  durataMinuti: number;
  consulente?: string;
  link: string; // indirizzo pubblico della pagina invito
  /** Il numero del cliente. Come `link`, NON viene disegnato: serve solo al
   *  pannello per aprire WhatsApp già sulla chat giusta invece che sull'elenco
   *  delle conversazioni. Un numero di telefono stampato su un'immagine che si
   *  inoltra sarebbe un dato personale in giro per niente. */
  telefono?: string;
  /** Il codice della stanza Meetly, quando ce n'è una. Come `telefono` e
   *  `link` NON viene disegnato: serve a depositare questa stessa immagine
   *  anche come anteprima di /meetly/<codice>, che è il link che il cliente
   *  riceve piu' spesso. */
  stanza?: string;
  /** ── CHI HA RICEVUTO QUESTO LINK ────────────────────────────────────────
   *  Il gettone della persona (vedi `gettoneDi` in crm/fascia-consulenza).
   *  Come `stanza`, `link` e `telefono` NON viene disegnato: serve a depositare
   *  questa immagine anche sotto il codice personale di chi la riceverà
   *  (`<stanza>_<gettone>`), perché in una consulenza con tre persone il
   *  biglietto depositato sotto la sola stanza è uno solo — e portava il nome
   *  del primo arrivato a tutti e tre. Vedi shop/chi-dal-link. */
  gettone?: string;
}

//  ⚠️ `link` fa parte del dato ma NON viene disegnato, e non è una dimenticanza.
//  Un indirizzo stampato su un'immagine non si tocca e non si copia: va
//  ricopiato a mano da un cliente che quello stesso indirizzo ce l'ha già,
//  cliccabile, nella riga di messaggio sopra la foto. Un QR ha lo stesso difetto
//  con in più il fatto che il telefono con cui lo si dovrebbe inquadrare è
//  quello su cui l'immagine è aperta. Il campo resta nella firma perché il
//  biglietto e l'invito nascono dallo stesso gesto e chi chiama ha già quel
//  valore in mano; il giorno in cui il committente lo volesse sopra, il disegno
//  andrà spostato dentro il `then` della fetch di /api/crm/invito — e da quel
//  momento erediterà la guardia `invitiInCorso` (MeetGiornalieri.tsx:572-579),
//  che alla seconda pressione ravvicinata esce senza fare nulla E SENZA DIRE
//  NULLA. Oggi il biglietto esce anche se quella chiamata fallisce.

// ── MISURE E COLORI ─────────────────────────────────────────────────────────

const LARG = 1920;
const ALT = 1080;

//  Perché NON si disegna a scala doppia (3840×2160 con ctx.scale(2,2)).
//  La scala doppia serve quando una tela si MOSTRA su uno schermo a densità
//  alta: lì i pixel logici sono meno di quelli fisici e il testo sfarfalla.
//  Questa tela non si mostra mai — nasce fuori dal documento, si esporta e
//  muore. A 1920 il testo più piccolo è 28 px REALI, che è già il doppio di un
//  testo grande su una pagina; raddoppiare darebbe un file quattro volte più
//  pesante che WhatsApp ricomprime peggio (più byte da buttare = artefatti più
//  grossi), per un dettaglio che nessuno vedrà mai. La nitidezza qui la decide
//  la ricompressione del destinatario, non la nostra densità.

/** Colonna utile: 120 px di margine a sinistra e a destra. */
const SX = 120;
const DX = 1800;

/** ⚠️ RISERVA WHATSAPP. Il fumetto della chat appoggia ora e spunte in basso a
 *  destra, sopra una velatura scura: qualunque cosa disegnata dentro questo
 *  rettangolo esce illeggibile e sporca. Niente contenuto oltre questa x sulla
 *  riga bassa, e niente entro 48 px dai quattro angoli (il fumetto è
 *  arrotondato e li mangia). */
const FINE_RIGA_BASSA = 1460;

/** ── LA FASCIA SICURA ──────────────────────────────────────────────────────
 *  ⚠️ Il biglietto è 16:9, ma i programmi di messaggistica NON lo mostrano
 *  intero: lo ritagliano verso la loro forma, che su WhatsApp è vicina al 2:1.
 *  Su 1080 di altezza vuol dire perdere una sessantina di pixel sopra e
 *  altrettanti sotto — ed è esattamente così che sono sparite la riga della
 *  durata e la pastiglia del prezzo, che stavano a 1032 e a 1056.
 *  Da qui in avanti: NIENTE INCHIOSTRO fuori da questa fascia. Non è una
 *  raccomandazione di stile, è il bordo oltre il quale il destinatario non
 *  vede. Il fondo e le sfumature possono uscirne — anzi devono, o comparirebbe
 *  una banda vuota — ma testo, pastiglie e icone no. */
const SICURO_ALTO = 64;
const SICURO_BASSO = 1016;

const COL = {
  fondo: "#081634",
  sfumaturaAlto: "#0b1e42",
  sfumaturaBasso: "#0a1a3a",
  marca: "#0f90fe",
  marcaChiara: "#8ecbff",
  navySuMarca: "#041028",
  verde: "#00d492",
  bianco: "#ffffff",
} as const;

const b = (a: number) => `rgba(255,255,255,${a})`;

//  ⚠️ I colori si scrivono qui, in esadecimale. Mai
//  getComputedStyle(...).getPropertyValue("--brand"): le proprietà
//  personalizzate tornano il testo grezzo `oklch(0.65 0.19 252)`, e dove il
//  motore non lo interpreta l'assegnazione a fillStyle VIENE IGNORATA IN
//  SILENZIO — si continua a disegnare col colore precedente (nero all'inizio),
//  senza nessun errore. E `--brand` non è `#3b82f6`: quello è
//  l'approssimazione a mano di api.og.card.ts, un blu diverso.

// ── IL CARATTERE ────────────────────────────────────────────────────────────

//  La stessa pila di src/styles.css:49. Va ripetuta a mano perché ctx.font non
//  eredita niente dal CSS. Nel progetto non esiste nessun @font-face e nessun
//  webfont: "Inter" c'è solo su chi se l'è installata, e per tutti gli altri
//  disegna il carattere di sistema (San Francisco, Segoe UI, Roboto).
//  Conseguenza da conoscere: il biglietto NON esce identico da due computer
//  diversi. Stessa gerarchia, stesse misure, disegno delle lettere diverso.
//  È il motivo per cui ogni riga qui sotto viene misurata invece che data per
//  buona.
const PILA = '"Inter", ui-sans-serif, system-ui, sans-serif';

let pilaVerificata: string | null = null;

/** ⚠️ Se la stringa passata a ctx.font non si lascia interpretare,
 *  l'assegnazione viene ignorata IN SILENZIO e resta il valore precedente —
 *  `10px sans-serif` appena nata la tela. Il risultato è tutto il biglietto
 *  scritto grande come una mosca su una tela da 1920, senza nessuna eccezione
 *  da intercettare. Un solo controllo all'avvio copre tutto il disegno, e in
 *  caso di rifiuto si ripiega sulla famiglia generica, che nessun motore può
 *  rifiutare. */
function pilaSicura(ctx: CanvasRenderingContext2D): string {
  if (pilaVerificata) return pilaVerificata;
  ctx.font = "10px sans-serif";
  ctx.font = `400 100px ${PILA}`;
  pilaVerificata = ctx.font === "10px sans-serif" ? "sans-serif" : PILA;
  return pilaVerificata;
}

/** ⚠️ Pesi ammessi: 400 / 500 / 600 / 700. Senza @font-face si disegna col
 *  carattere di sistema, e un 800 che il sistema non ha viene sintetizzato
 *  ingrassando i tratti: su un titolo da 104 px si vede che è finto. */
function font(ctx: CanvasRenderingContext2D, peso: 400 | 500 | 600 | 700, corpo: number): string {
  return `${peso} ${corpo}px ${pilaSicura(ctx)}`;
}

function usaFont(ctx: CanvasRenderingContext2D, peso: 400 | 500 | 600 | 700, corpo: number) {
  ctx.font = font(ctx, peso, corpo);
}

const largh = (ctx: CanvasRenderingContext2D, s: string) => ctx.measureText(s).width;

// ── SCRIVERE ────────────────────────────────────────────────────────────────

/** Tutte le `y` di questo file sono LINEE DI BASE, mai bordi superiori: è
 *  l'unico modo perché il disegno non dipenda dalle metriche del carattere, che
 *  cambiano da macchina a macchina. Con `textBaseline = "top"` le tre carte
 *  affiancate si allineerebbero su un Mac e no su un Windows. */
function scrivi(
  ctx: CanvasRenderingContext2D,
  testo: string,
  x: number,
  base: number,
  colore: string,
): number {
  ctx.fillStyle = colore;
  ctx.fillText(testo, x, base);
  return largh(ctx, testo);
}

//  ⚠️ QUI NON C'È NESSUNA FUNZIONE CHE MANDA A CAPO, e non è una mancanza: su
//  questo biglietto nessun testo va a capo. Ogni riga ha sopra o sotto un
//  elemento a linea di base fissa (la pastiglia di categoria, il primo punto,
//  il titolo, le carte), quindi una riga in più non "spinge" niente: entra
//  dentro il vicino. Le difese sono due, e sono queste due: scendere di corpo
//  fino al pavimento dei 28 px, e poi troncare.

/** L'ultima difesa, quando rimpicciolire non è permesso (28 px è il pavimento
 *  del biglietto: sotto, l'anteprima in chat non regge). Toglie un carattere
 *  alla volta finché ci sta, e chiude con i puntini. */
function tronca(ctx: CanvasRenderingContext2D, testo: string, larghezzaMax: number): string {
  if (largh(ctx, testo) <= larghezzaMax) return testo;
  let s = testo;
  while (s.length > 1 && largh(ctx, `${s}…`) > larghezzaMax) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Sceglie il primo corpo della scala con cui il testo ci sta, e lo lascia
 *  impostato sul contesto. Torna il corpo scelto, che a volte serve a chi
 *  chiama per decidere l'interlinea. L'ultimo corpo della scala è il pavimento:
 *  se nemmeno quello basta, chi chiama tronca. */
function adattaCorpo(
  ctx: CanvasRenderingContext2D,
  testo: string,
  peso: 400 | 500 | 600 | 700,
  scala: readonly number[],
  larghezzaMax: number,
): number {
  for (const corpo of scala) {
    usaFont(ctx, peso, corpo);
    if (largh(ctx, testo) <= larghezzaMax) return corpo;
  }
  usaFont(ctx, peso, scala[scala.length - 1]);
  return scala[scala.length - 1];
}

// ── FORME ───────────────────────────────────────────────────────────────────

/** Rettangolo arrotondato scritto a mano con arcTo invece di roundRect: la
 *  scorciatoia non esiste su Safari prima della 16.4, e il CRM lo aprono dagli
 *  iPad che ci sono in sede. Una carta senza angoli è un difetto visibile; un
 *  metodo mancante è un'eccezione che porta via tutta la generazione. */
function rettArrotondato(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  const raggio = Math.min(r, w / 2, h / 2);
  p.moveTo(x + raggio, y);
  p.arcTo(x + w, y, x + w, y + h, raggio);
  p.arcTo(x + w, y + h, x, y + h, raggio);
  p.arcTo(x, y + h, x, y, raggio);
  p.arcTo(x, y, x + w, y, raggio);
  p.closePath();
  return p;
}

/** ⚠️ Un'ombra lasciata accesa dà la sua aureola blu a OGNI lettera disegnata
 *  dopo, e il biglietto sembra fuori fuoco senza che si capisca perché. Si
 *  accende per un riempimento solo e si spegne subito. */
function conAlone(
  ctx: CanvasRenderingContext2D,
  colore: string,
  sfocatura: number,
  scartoY: number,
  disegna: () => void,
) {
  ctx.shadowColor = colore;
  ctx.shadowBlur = sfocatura;
  ctx.shadowOffsetY = scartoY;
  disegna();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

// ── LE ICONE ────────────────────────────────────────────────────────────────
//  Sei forme, tutte archi e segmenti su una griglia 64×64 con tratto 4. Si
//  disegnano scalando il contesto, così a 40 px il tratto diventa 2,5 px da
//  solo e resta coerente con le altre senza nessun calcolo.
//
//  ⚠️ Nessuna icona "medica" e nessuna illustrazione oltre a queste. Un bisturi
//  accanto a «Trapianto» trasforma un elenco rassicurante in un'ansia, e un
//  cerotto accanto a «Patch» fa sembrare la seconda opzione un ripiego
//  sanitario. Sono icone che dicono il MECCANISMO, non lo strumento.
//
//  Nessun tracciato ha più di otto segmenti e nessun dettaglio scende sotto le
//  6 unità di griglia: dopo la ricompressione di WhatsApp restano riconoscibili
//  per sagoma, che a 40 px è tutto quello che sopravvive.

interface Icona {
  tratto: Path2D;
  pieno?: Path2D;
}

const GRADI = Math.PI / 180;

/** Un arco che comincia davvero dove deve: senza il moveTo iniziale il
 *  tracciato tira una riga dritta dall'ultimo punto al principio dell'arco, e
 *  compare un raggio che nessuno ha disegnato. */
function arco(p: Path2D, cx: number, cy: number, r: number, da: number, a: number) {
  p.moveTo(cx + r * Math.cos(da * GRADI), cy + r * Math.sin(da * GRADI));
  p.arc(cx, cy, r, da * GRADI, a * GRADI);
}

function segmento(p: Path2D, x1: number, y1: number, x2: number, y2: number) {
  p.moveTo(x1, y1);
  p.lineTo(x2, y2);
}

/** Calendario — la pastiglia della data. Il quadratino pieno è il giorno
 *  segnato: è l'unico dettaglio che fa leggere «calendario» invece di
 *  «finestra». */
function iconaCalendario(): Icona {
  const t = rettArrotondato(8, 14, 48, 42, 6);
  segmento(t, 20, 8, 20, 20);
  segmento(t, 44, 8, 44, 20);
  segmento(t, 8, 28, 56, 28);
  const pieno = new Path2D();
  pieno.rect(18, 38, 6, 6);
  return { tratto: t, pieno };
}

/** LA CALOTTA — la base comune delle tre icone di prodotto.
 *
 *  Le tre icone non sono tre disegni: sono la STESSA testa vista tre volte, e
 *  cambia solo cosa le succede sopra. Prima ognuna aveva la sua base (una linea
 *  di terra, un'altra linea di terra, niente) e infatti le tre non si leggevano
 *  come una famiglia — si leggevano come tre scarabocchi diversi. Con una
 *  calotta sola, affiancate raccontano la storia da sinistra a destra senza una
 *  parola: capelli solo da una parte e una freccia → uno strato appoggiato
 *  sopra → capelli dappertutto, senza giunzioni.
 *
 *  ⚠️ Una linea dritta non è una testa. Era il difetto della versione
 *  precedente: tre bastoncini piantati su un pavimento sono un grafico a barre,
 *  gli stessi tre su una curva sono capelli. La curva costa un arco.
 *
 *  ⚠️ La curva è ALTA 16 unità su 51 di larghezza, e non 12 su 56. Una calotta
 *  troppo piatta torna a essere una linea: si legge come il rigo di una riga di
 *  testo, e i capelli sopra diventano ciglia. Il rapporto conta più del raggio —
 *  ed è anche quello che dà all'icona i due terzi di altezza del suo riquadro,
 *  invece di stringersi nella metà bassa e sembrare disegnata più piccola delle
 *  altre. */
function calotta(p: Path2D) {
  arco(p, 32, 72, 28, 205, 335);
}

/** Trapianto — capelli fitti da una parte, niente dall'altra, e una freccia che
 *  va dall'una all'altra. Si legge «da qui a lì» senza sapere leggere.
 *
 *  ⚠️ L'asta della freccia è DRITTA, e prima era un arco. Con un arco la punta
 *  arriva in diagonale mentre le due barbe erano simmetriche rispetto
 *  all'orizzontale: una delle due puntava IN AVANTI e l'insieme leggeva come una
 *  coda di pesce, non come una freccia. Su un tracciato curvo le barbe vanno
 *  ruotate con la tangente, e la barba interna finisce comunque appiccicata
 *  all'asta. Dritta, l'angolo si calcola una volta e resta giusto.
 *
 *  ⚠️ E dalla parte diradata non c'è più «un capello corto»: a 64 px un capello
 *  più corto degli altri non dice «qui è diradato», dice «questa asta è più
 *  corta». Il vuoto è l'unica cosa che si legge come vuoto. */
function iconaTrapianto(): Icona {
  const t = new Path2D();
  calotta(t);
  //  Tre capelli che escono DALLA calotta, non da un pavimento: le basi stanno
  //  sull'arco (230°, 245°, 260°), calcolate, non messe a occhio.
  segmento(t, 14, 51, 10, 26);
  segmento(t, 20, 47, 17, 22);
  segmento(t, 27, 44, 26, 20);
  //  Asta e barbe: 11 unità a ±40° dalla direzione dell'asta. A 40° e non a 30°
  //  perché con un tratto da 4 su una griglia da 64 due barbe a 30° si toccano
  //  e la punta esce come un triangolo pieno.
  segmento(t, 34, 14, 52, 36);
  segmento(t, 52, 36, 52, 25);
  segmento(t, 52, 36, 41, 34);
  return { tratto: t };
}

/** Patch — la stessa testa, con SOPRA un secondo arco che porta i capelli. Due
 *  archi concentrici a sei unità di distanza sono la cosa più vicina a «uno
 *  strato appoggiato» che si possa dire con due tratti, e il bordo visibile
 *  dello strato è esattamente ciò che il testo della carta dice: si toglie.
 *
 *  ⚠️ Prima era una cupola su una linea con tre ciuffi sopra, e i ciuffi
 *  partivano 4-6 unità SOPRA la cupola invece che dalla cupola: a schermo si
 *  vedeva il distacco, e l'insieme leggeva come una cloche da ristorante che
 *  fuma. Qui le basi dei tre capelli stanno sull'arco della patch (245°, 270°,
 *  295°) e non fluttuano. */
function iconaPatch(): Icona {
  const t = new Path2D();
  calotta(t);
  arco(t, 32, 72, 35, 225, 315);
  segmento(t, 17, 40, 14, 16);
  segmento(t, 32, 37, 32, 13);
  segmento(t, 47, 40, 50, 16);
  return { tratto: t };
}

/** Invisible Derm Protocol — la stessa testa, con i capelli su TUTTA la
 *  larghezza e nessun bordo, nessuno strato, nessuna freccia. Accanto alle
 *  altre due dice l'unica cosa che il testo della carta promette davvero
 *  («studiato perché non si veda»): non si vede dove comincia.
 *
 *  ⚠️ Prima qui c'erano tre archi concentrici e un punto, cioè il simbolo del
 *  WIFI — disegnato benissimo, e di un'altra cosa. Su una carta che sta a venti
 *  centimetri dalla riga «Niente da scaricare» quel glifo diceva «internet», e
 *  in un materiale sulla calvizie è l'unico posto dove un cliente poteva
 *  fermarsi a chiedersi cosa c'entrasse.
 *
 *  ⚠️ È volutamente l'icona più semplice delle tre e non la più elaborata,
 *  anche se è la carta di punta. Del protocollo non si racconta il meccanismo
 *  (lo dice il testo: te lo mostriamo in consulenza), e un'icona che spiegasse
 *  più del testo starebbe promettendo qualcosa che nessuno ha verificato. */
function iconaProtocollo(): Icona {
  const t = new Path2D();
  calotta(t);
  segmento(t, 9, 56, 5, 33);
  segmento(t, 19, 47, 15, 22);
  segmento(t, 32, 44, 32, 18);
  segmento(t, 45, 47, 49, 22);
  segmento(t, 55, 56, 59, 33);
  return { tratto: t };
}

function iconaOrologio(): Icona {
  const t = new Path2D();
  arco(t, 32, 32, 24, 0, 360);
  segmento(t, 32, 32, 32, 16);
  segmento(t, 32, 32, 44, 38);
  return { tratto: t };
}

const ICONE_PRODOTTO: Record<ConcettoIcona, () => Icona> = {
  trapianto: iconaTrapianto,
  patch: iconaPatch,
  protocollo: iconaProtocollo,
};

function disegnaIcona(
  ctx: CanvasRenderingContext2D,
  icona: Icona,
  x: number,
  y: number,
  lato: number,
  colore: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(lato / 64, lato / 64);
  ctx.strokeStyle = colore;
  ctx.fillStyle = colore;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(icona.tratto);
  if (icona.pieno) ctx.fill(icona.pieno);
  ctx.restore();
}

// ── IL LOGO ─────────────────────────────────────────────────────────────────

//  ⚠️ IL LOGO ARRIVA SEMPRE DA UN'ALTRA ORIGINE, e disegnarlo dritto rompe il
//  biglietto in un punto in cui nessuno guarda. /api/presenter/brand torna un
//  indirizzo che sta su Supabase Storage — oppure una stringa qualunque
//  incollata a mano nel pannello (PresenterSettingsHub.tsx:86), quindi la
//  politica CORS di quel dominio non si conosce in anticipo. Un drawImage di
//  un'immagine di altra origine SPORCA la tela, e da quel momento toBlob lancia
//  SecurityError. Non c'è nessun sintomo prima: il biglietto si disegna
//  benissimo, ed è lo scarico a esplodere.
//  `img.crossOrigin = "anonymous"` non basta — funziona solo se il server
//  remoto manda Access-Control-Allow-Origin, e dove manca l'immagine non si
//  carica proprio, cioè si perde comunque il logo.
//  La strada è il ponte che il progetto ha già: /api/proxy rimanda i byte non
//  HTML così come sono (api.proxy.ts:171-181). Chiamato dall'app è
//  same-origin, e i byte che ne escono — letti come blob — non sporcano niente.

/** Il marchio disegnabile. ⚠️ `ImageBitmap` **o** `HTMLImageElement`: sono due
 *  cose diverse solo per il compilatore, `drawImage` le accetta entrambe e
 *  tutte e due espongono `width`/`height`. Il ripiego serve ai motori che non
 *  hanno `createImageBitmap` — vedi la nota qui sotto. */
export type Marchio = ImageBitmap | HTMLImageElement;

//  ⚠️ SI RICORDA L'IMMAGINE, NON L'ATTESA. Prima qui viveva anche la PROMESSA
//  (`logoInVolo`) e la si riusava: sembra un risparmio ed è una trappola,
//  perché se quell'attesa resta appesa una volta resta appesa PER SEMPRE, e
//  ogni chiamante successivo si ferma con lei — senza errori, senza sintomi.
//  Tenendo l'immagine, un guasto passeggero se lo porta via il tentativo dopo.
let logoInCache: Marchio | null | undefined;

/** Un tetto di tempo su ogni passo: niente qui dentro può fermarsi per sempre,
 *  e un logo che tarda vale un logo assente — non un biglietto che non esce. */
const conLimite = <X,>(p: Promise<X>, ms: number, dove: string): Promise<X> =>
  Promise.race([p, new Promise<X>((_, no) => setTimeout(() => no(new Error(`timeout: ${dove}`)), ms))]);

async function scaricaLogo(): Promise<Marchio | null> {
  const risposta = await conLimite(fetch("/api/presenter/brand"), 4000, "marchio");
  if (!risposta.ok) throw new Error("marchio non disponibile");
  const dati = (await risposta.json()) as { logoUrl?: unknown };
  const indirizzo = typeof dati.logoUrl === "string" ? dati.logoUrl.trim() : "";
  //  Nessun logo caricato è il caso NORMALE di un'installazione nuova, non un
  //  errore: BrandLogo.tsx lo prevede già e ripiega sul marchio scritto. Questa
  //  è una RISPOSTA, e come tale si può ricordare per tutta la sessione.
  if (!indirizzo) return null;

  const r = await conLimite(fetch(`/api/proxy?u=${encodeURIComponent(indirizzo)}`), 6000, "ponte");
  //  ⚠️ Due controlli, e servono tutti e due.
  //  (1) allowed() del ponte rifiuta host privati e schemi non http/https
  //      rispondendo 400 CON UN CORPO DI TESTO: senza questo controllo si
  //      finirebbe a costruire un'immagine da una frase.
  //  (2) stessa storia per un tipo di contenuto che non è un'immagine.
  if (!r.ok || !(r.headers.get("content-type") || "").toLowerCase().startsWith("image/")) {
    throw new Error("il ponte non ha restituito un'immagine");
  }
  const blob = await conLimite(r.blob(), 6000, "lettura dei byte");

  /** ── ⚠️ NIENTE `decode()`: SI FERMA NELLE SCHEDE IN SECONDO PIANO ────────
   *  Era la ragione vera per cui il biglietto usciva col nome scritto invece
   *  che col marchio. `HTMLImageElement.decode()` è legato al disegno della
   *  pagina, e il browser il disegno delle schede non attive lo rimanda —
   *  quindi l'attesa non finiva mai. E il gestionale, quando genera
   *  un'anteprima, è quasi sempre una scheda in secondo piano.
   *  `createImageBitmap` lavora sul file e basta: non ha niente a che fare con
   *  quello che si vede a schermo, e infatti risponde lo stesso. */
  if (typeof createImageBitmap === "function") {
    const bmp = await conLimite(createImageBitmap(blob), 6000, "lettura del marchio");
    //  ⚠️ Terzo controllo: un SVG senza dimensioni intrinseche è largo 0.
    //   drawImage non disegnerebbe niente, o lancerebbe InvalidStateError
    //   portandosi via tutta la generazione.
    return bmp.width > 0 && bmp.height > 0 ? bmp : null;
  }

  //  Ripiego per i browser senza `createImageBitmap`: `onload` scatta anche in
  //  secondo piano, `decode()` no.
  const url = URL.createObjectURL(blob);
  const img = new Image();
  const pronta = new Promise<void>((si, no) => {
    img.onload = () => si();
    img.onerror = () => no(new Error("marchio illeggibile"));
  });
  img.src = url;
  try {
    await conLimite(pronta, 6000, "lettura del marchio");
  } finally {
    //  Revocato solo DOPO che il browser ha finito di leggerlo: l'immagine
    //  decodificata resta valida, e non ci si porta dietro un blob per tutta la
    //  sessione.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null;
}

/** Il logo, una volta per sessione. Non lancia mai: qualunque cosa vada storta
 *  vale "logo assente", che è un caso normale e non un guasto.
 *
 *  ⚠️ SI RICORDA LA RISPOSTA, NON IL GUASTO. «Nessun logo caricato» è una
 *  risposta e vale per tutta la sessione. Una rete caduta per un attimo no:
 *  metterla in cache vorrebbe dire disegnare senza logo TUTTI i biglietti del
 *  pomeriggio, e nemmeno il tasto "Riprova" potrebbe rimediare — non si
 *  tornerebbe mai a chiedere, perché la risposta è già "in archivio". Dopo un
 *  errore non si ricorda niente e il tentativo successivo riparte da capo. */
export async function precaricaLogo(): Promise<Marchio | null> {
  if (logoInCache !== undefined) return logoInCache;
  try {
    logoInCache = await scaricaLogo();
    return logoInCache;
  } catch (e) {
    //  ⚠️ `logoInCache` resta indefinito: il prossimo disegno riprova invece di
    //   ereditare un guasto passeggero.
    console.warn("[BIGLIETTO] marchio non caricato:", (e as Error)?.message || e);
    return null;
  }
}

// ── ZONA 0 · IL FONDO ───────────────────────────────────────────────────────

/** Riproduce `.bg-brandfill` (styles.css:218-239), nell'ordine INVERSO a quello
 *  del CSS: là gli aloni stanno sopra in un livello separato, qui si sovrappone
 *  a mano dal basso. */
function fondo(ctx: CanvasRenderingContext2D) {
  //  ⚠️ Primo comando in assoluto, e non è un dettaglio: la JPEG non ha canale
  //  alfa, e qualunque zona rimasta trasparente verrebbe composta SU NERO al
  //  momento della codifica. Un biglietto con la cornice nera.
  ctx.fillStyle = COL.fondo;
  ctx.fillRect(0, 0, LARG, ALT);

  const s = ctx.createLinearGradient(0, 0, 0, ALT);
  s.addColorStop(0, COL.sfumaturaAlto);
  s.addColorStop(0.55, COL.fondo);
  s.addColorStop(1, COL.sfumaturaBasso);
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, LARG, ALT);

  //  ⚠️ Le fermate trasparenti ripetono gli STESSI TRE NUMERI del colore pieno.
  //  La parola `transparent` in una sfumatura Canvas vale rgba(0,0,0,0):
  //  l'interpolazione passerebbe per il grigio e attorno al bagliore si
  //  vedrebbe un alone morto.
  //  ⚠️ E senza translate+scale l'alone esce ROTONDO: su un 16:9 si nota
  //  subito, perché l'originale CSS è un'ellisse larga quanto la pagina.
  alone(ctx, 960, ALT, 1152, 540, "20,50,120", 0.35);
  alone(ctx, 960, 0, 1344, 594, "56,110,220", 0.3);

  //  Griglia a rettangoli pieni, non a linee: ⚠️ una linea da 2 px tracciata
  //  con stroke su una coordinata intera cade a cavallo di due pixel ed esce
  //  sbiadita e doppia.
  //  Il passo è 120 e non i 28 del CSS perché sul telefono la pagina è larga
  //  ~430 px, dove 28 px valgono ~125 px riportati su 1920. E 120 divide esatto
  //  sia 1920 sia 1080: nessuna mezza cella sui bordi.
  ctx.fillStyle = b(0.045);
  for (let x = 0; x < LARG; x += 120) ctx.fillRect(x, 0, 2, ALT);
  for (let y = 0; y < ALT; y += 120) ctx.fillRect(0, y, LARG, 2);
}

function alone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  raggio: number,
  altezza: number,
  rgb: string,
  opacita: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, altezza / raggio);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, raggio);
  g.addColorStop(0, `rgba(${rgb},${opacita})`);
  g.addColorStop(0.7, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-raggio, -raggio, raggio * 2, raggio * 2);
  ctx.restore();
}

// ── ZONA A · LA TESTATA ─────────────────────────────────────────────────────

function marchioScritto(ctx: CanvasRenderingContext2D) {
  //  La stessa coppia di BrandLogo.tsx:24, non un'invenzione: chi ha visto il
  //  CRM riconosce le stesse due parole con lo stesso taglio di colore.
  usaFont(ctx, 600, 44);
  const w = scrivi(ctx, "Hair Genius ", SX, 128, COL.bianco);
  scrivi(ctx, "Labs", SX + w, 128, COL.marca);
}

function testata(ctx: CanvasRenderingContext2D, inv: DatiInvito, logo: Marchio | null) {
  if (logo && logo.width > 0 && logo.height > 0) {
    //  Proporzioni conservate dentro un riquadro 320×64, ancorato a sinistra e
    //  centrato sulla riga del logo. Larghezza e altezza di destinazione sempre
    //  esplicite: è l'altra metà della difesa contro gli SVG senza dimensioni.
    //  ⚠️ `width`/`height` e non `naturalWidth`: le ha anche `ImageBitmap`, e
    //   su un'immagine creata a mano e mai messa in pagina valgono lo stesso.
    const scala = Math.min(320 / logo.width, 64 / logo.height);
    const w = logo.width * scala;
    const h = logo.height * scala;
    ctx.drawImage(logo, SX, 112 - h / 2, w, h);
  } else {
    //  Senza logo si va avanti senza dire niente a nessuno. Il biglietto senza
    //  logo è un biglietto; il biglietto che non si genera non è niente. E in
    //  alto a sinistra non deve mai restare un buco.
    marchioScritto(ctx);
  }

  pastigliaData(ctx, inv);

  //  Tre righe che sono una colonna sola sotto la pastiglia, non tre elementi
  //  sparsi: stesso bordo destro, passo costante di 44.
  ctx.textAlign = "right";
  usaFont(ctx, 500, 34);
  scrivi(ctx, FRASI.cosaE, DX, 224, b(0.85));
  usaFont(ctx, 400, 34);
  scrivi(ctx, FRASI.preventivoSuMisura, DX, 268, b(0.65));
  //  La richiesta di disdire per tempo è scritta come un favore che si chiede,
  //  non come una regola con una penale: chi non può esserci e teme la sfuriata
  //  semplicemente sparisce, e uno slot bruciato in silenzio costa più di uno
  //  spostato in tempo. Nessun termine di ore — "entro 24 ore" sarebbe una
  //  condizione che nessuno ha mai concordato con il cliente.
  usaFont(ctx, 400, 28);
  scrivi(ctx, FRASI.disdettaBreve, DX, 312, b(0.45));
  ctx.textAlign = "left";
}

function pastigliaData(ctx: CanvasRenderingContext2D, inv: DatiInvito) {
  //  ⚠️ NON si usa quandoInParole. Per i giorni 0 e 1 restituisce «Oggi alle
  //  15:30» e «Domani alle 15:30»: parole vere su una pagina che si ricalcola a
  //  ogni apertura, FALSE su un'immagine appena passa mezzanotte. Un biglietto
  //  è una fotografia, e la fotografia non sa che giorno è quando la si guarda.
  //  Per la stessa ragione niente conto alla rovescia (quantoMancaInParole):
  //  perfetto su una pagina viva, velenoso su un file che resta in una chat.
  //
  //  ⚠️ I due pezzi si uniscono filtrando i vuoti invece di incollarli. Se la
  //  data non si legge, `giornoPerEsteso` torna stringa vuota: incollata darebbe
  //  una pastiglia che comincia con uno spazio e dice « alle 15:30». Non
  //  dovrebbe capitare — il tasto compare solo con data e ora buone
  //  (MeetGiornalieri.tsx:785-787) — ma costa un filter e toglie di mezzo
  //  l'unico modo in cui questa riga può uscire storta.
  const testo = [giornoPerEsteso(inv), inv.ora ? `alle ${inv.ora}` : ""].filter(Boolean).join(" ");

  ctx.textAlign = "left";
  let corpo = 48;
  usaFont(ctx, 600, corpo);
  let w = largh(ctx, testo) + 136;
  if (DX - w < 480) {
    //  Il logo arriva al massimo a 440: sotto i 480 si rischia di toccarlo, e
    //  si scende di un gradino una volta sola.
    corpo = 44;
    usaFont(ctx, 600, corpo);
    w = largh(ctx, testo) + 136;
  }
  const px = DX - w;

  //  ⚠️ SE È OGGI CAMBIA IL COLORE, NON IL TESTO. È la decisione più
  //  importante del biglietto e va contro l'istinto. Il motivo sta scritto nel
  //  repository, nel commento a invito.ts:36-44: una fotografia scattata al
  //  momento della generazione continuerebbe a dire l'ora vecchia a un cliente
  //  che ha già in mano il link. Una pastiglia accesa vista il giorno dopo è
  //  solo una pastiglia accesa; una pastiglia che dice «Oggi» vista il giorno
  //  dopo è una bugia con l'ora dentro. E nessuna variante per «domani»: una
  //  terza forma per una giornata che non ha niente di diverso dalle altre è
  //  una forma che nessuno riconosce.
  const oggi = giorniDaOggiInvito(inv.data) === 0;
  //  ⚠️ Il bordo alto della pastiglia sta sotto SICURO_ALTO: sopra quella riga
  //  il destinatario non vede (vedi la fascia sicura).
  const corpoPastiglia = rettArrotondato(px, Math.max(68, SICURO_ALTO + 4), w, 88, 44);

  if (oggi) {
    conAlone(ctx, "rgba(15,144,254,0.45)", 60, 10, () => {
      ctx.fillStyle = COL.marca;
      ctx.fill(corpoPastiglia);
    });
  } else {
    ctx.fillStyle = "rgba(15,144,254,0.14)";
    ctx.fill(corpoPastiglia);
    ctx.strokeStyle = "rgba(15,144,254,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke(corpoPastiglia);
  }

  disegnaIcona(ctx, iconaCalendario(), px + 36, 92, 40, oggi ? COL.navySuMarca : COL.marcaChiara);
  usaFont(ctx, 600, corpo);
  scrivi(ctx, testo, px + 96, 129, oggi ? COL.navySuMarca : COL.bianco);
}

// ── ZONA B · SALUTO E TITOLO ────────────────────────────────────────────────

function saluto(ctx: CanvasRenderingContext2D, nome: string) {
  //  ⚠️ Il nome che arriva qui è GIÀ passato da nomeDiBattesimo (invito.ts:138)
  //  e non è mai il campo grezzo del lead, né tantomeno nome + cognome. È la
  //  trappola nuova di questo lavoro: finora il taglio del cognome lo faceva il
  //  server, e chi disegna nel browser ha il cognome intero a portata di dito.
  //  Se la pagina pubblica non pubblica il cognome, non può pubblicarlo la sua
  //  fotografia — che per giunta si inoltra più facilmente del link.
  const testo = nome ? `Ciao ${nome},` : "Ciao,";
  //  Mai su due righe: la seconda riga spingerebbe giù il titolo e le carte,
  //  che sono il motivo per cui il biglietto esiste. Si rimpicciolisce, e sotto
  //  i 36 px si tronca il nome — succede solo con un campo da 35-40 caratteri,
  //  cioè con un dato sporco, perché nomeDiBattesimo taglia già a 40.
  adattaCorpo(ctx, testo, 500, [52, 44, 36], 1000);
  scrivi(ctx, tronca(ctx, testo, 1000), SX, 312, b(0.75));

  usaFont(ctx, 600, 104);
  ctx.letterSpacing = "-1px";
  //  A 104 px il titolo misura circa 1196 px su 1680 disponibili: c'è margine
  //  anche su un carattere di sistema più largo di Inter, e infatti il titolo
  //  non si adatta mai. È l'unica riga che sopravvive all'anteprima in chat
  //  (~300 px), ed è lì che il biglietto si gioca tutto.
  scrivi(ctx, FRASI.titoloBiglietto, SX, 424, COL.bianco);
  ctx.letterSpacing = "0px";
}

// ── ZONA C · LE TRE CARTE ───────────────────────────────────────────────────

const CARTE_X = [120, 696, 1272];
const CARTA_W = 528;
const CARTA_Y = 476;
//  ⚠️ 436 e non 460: le carte si sono accorciate per far salire tutta la riga
//  bassa dentro la FASCIA SICURA (vedi qui sotto). Trenta pixel di carta non li
//  nota nessuno; una riga di prezzo tagliata a metà la nota il cliente.
const CARTA_H = 436;
const TESTO_W = 448;

function carte(ctx: CanvasRenderingContext2D) {
  //  Il corpo dei nomi si decide UNA VOLTA per tutte e tre. Se ogni carta
  //  scegliesse il proprio, su un carattere di sistema largo «Invisible Derm»
  //  si rimpicciolirebbe e le altre due no: tre nomi di tre misure diverse
  //  affiancati leggono come un errore di composizione, non come gerarchia.
  let corpoNome = 48;
  for (const s of SOLUZIONI) {
    for (const riga of s.nomeRighe) {
      corpoNome = Math.min(corpoNome, adattaCorpo(ctx, riga, 600, [48, 44, 40], TESTO_W));
    }
  }

  //  Stessa regola per i sottotitoli, e per la stessa ragione: un corpo solo per
  //  tutte e tre.
  let corpoSotto = 30;
  for (const s of SOLUZIONI) {
    corpoSotto = Math.min(corpoSotto, adattaCorpo(ctx, s.sottotitolo, 400, [30, 28], TESTO_W));
  }

  SOLUZIONI.forEach((s, i) => {
    const L = CARTE_X[i] ?? CARTE_X[0];
    //  ⚠️ Le tre carte hanno GEOMETRIA IDENTICA. La terza si distingue solo per
    //  colore, bordo, alone e pastiglia. Alzarla di qualche pixel per farla
    //  "sporgere" non legge come gerarchia: con tre riquadri accostati le linee
    //  di base sfalsate leggono come uno sbaglio.
    const punta = s.chiave === "protocollo";
    const corpo = rettArrotondato(L, CARTA_Y, CARTA_W, CARTA_H, 32);

    if (punta) {
      conAlone(ctx, "rgba(56,110,220,0.35)", 60, 12, () => {
        ctx.fillStyle = "rgba(15,144,254,0.10)";
        ctx.fill(corpo);
      });
      ctx.strokeStyle = "rgba(15,144,254,0.55)";
    } else {
      ctx.fillStyle = b(0.05);
      ctx.fill(corpo);
      ctx.strokeStyle = b(0.12);
    }
    ctx.lineWidth = 2;
    ctx.stroke(corpo);

    const x = L + 40;
    disegnaIcona(ctx, ICONE_PRODOTTO[s.icona](), x, 512, 64, punta ? COL.marcaChiara : b(0.7));

    //  Il nome arriva già spezzato in due righe da consulenza-contenuti: la
    //  Canvas non manda a capo niente da sola, e se una sola carta scrivesse il
    //  nome su una riga tutto ciò che sta sotto scenderebbe di cinquanta pixel
    //  soltanto in quella.
    usaFont(ctx, 600, corpoNome);
    scrivi(ctx, s.nomeRighe[0], x, 634, COL.bianco);
    if (s.nomeRighe[1]) scrivi(ctx, s.nomeRighe[1], x, 686, COL.bianco);

    pastigliaCategoria(ctx, s.categoria, x, punta);

    //  ⚠️ IL SOTTOTITOLO STA SU UNA RIGA SOLA, e non è una semplificazione: la
    //  seconda riga NON CI STA. Impilando verso l'alto con interlinea 38 la
    //  prima riga cade a 774, e l'ascendente di un corpo 30 misura 21 px veri —
    //  quindi il testo sale a 753, mentre la pastiglia di categoria arriva a
    //  758. Cinque pixel di sovrapposizione, che nessuno vede finché il
    //  carattere di sistema di una macchina non è appena più largo di Inter:
    //  «Il metodo messo a punto da noi.» oggi misura 406 px su 448 disponibili,
    //  cioè manda a capo con il 10% di larghezza in più.
    //  E anche se ci stesse: due righe in una carta e una nelle altre due è una
    //  geometria diversa fra sorelle, che è la sola regola che tiene insieme le
    //  tre. Si scende di un gradino (30 → 28, il pavimento) e poi si tronca.
    usaFont(ctx, 400, corpoSotto);
    scrivi(ctx, tronca(ctx, s.sottotitolo, TESTO_W), x, 812, b(0.85));

    //  I due punti: sempre due, mai tre. Il biglietto ha spazio per due, e un
    //  terzo punto visibile solo sulla pagina sarebbe il primo passo verso i
    //  due testi che divergono.
    s.punti.forEach((testo, k) => {
      const cy = 855 + k * 42;
      ctx.beginPath();
      ctx.arc(L + 50, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = punta ? COL.marca : b(0.35);
      ctx.fill();
      //  28 px è il pavimento del biglietto e non si scende: se serve, si
      //  tronca.
      usaFont(ctx, 400, 28);
      scrivi(ctx, tronca(ctx, testo, TESTO_W - 32), L + 72, cy + 9, b(0.65));
    });
  });
}

function pastigliaCategoria(
  ctx: CanvasRenderingContext2D,
  testo: string,
  x: number,
  punta: boolean,
) {
  //  ⚠️ ctx.letterSpacing non esiste su tutti i motori: dove manca,
  //  l'assegnazione cade nel vuoto e la riga esce compatta — brutta ma
  //  leggibile, e comunque meglio che disegnarla lettera per lettera. Ma la
  //  misura va presa DOPO averla impostata, o la pastiglia esce più larga del
  //  suo contenuto sui motori che la applicano.
  usaFont(ctx, 600, 28);
  ctx.letterSpacing = "3px";
  //  ⚠️ La spaziatura viene contata anche DOPO l'ultima lettera — misurato:
  //  «NON CHIRURGICO» a 28 px passa da 241 a 283, cioè 14 caratteri × 3 px e non
  //  13. Senza toglierne uno la pastiglia ha 23 px di respiro a destra e 20 a
  //  sinistra: uno sbilanciamento che non si sa nominare e si vede lo stesso,
  //  perché le tre pastiglie stanno affiancate. Dove letterSpacing non esiste la
  //  sottrazione toglie 3 px a una pastiglia già compatta, e non si nota.
  const w = largh(ctx, testo) - 3 + 40;
  const p = rettArrotondato(x, 714, w, 44, 22);
  if (punta) {
    ctx.fillStyle = COL.marca;
    ctx.fill(p);
  } else {
    ctx.fillStyle = b(0.08);
    ctx.fill(p);
    ctx.strokeStyle = b(0.14);
    ctx.lineWidth = 1.5;
    ctx.stroke(p);
  }
  //  ⚠️ Sulla carta di punta il testo è quasi NERO su blu, non bianco su blu.
  //  WhatsApp ricomprime in JPEG con sottocampionamento del colore 4:2:0, che
  //  sbava i bordi delle tinte sature: lo scuro sopravvive, il bianco su blu a
  //  corpo piccolo no.
  scrivi(ctx, testo, x + 20, 744, punta ? COL.navySuMarca : b(0.85));
  ctx.letterSpacing = "0px";
}

// ── ZONA D · LA RIGA BASSA ──────────────────────────────────────────────────

function rigaBassa(ctx: CanvasRenderingContext2D, d: DatiBiglietto) {
  ctx.fillStyle = b(0.1);
  //  Le misure della riga bassa si ricavano DALLA FASCIA SICURA e non da numeri
  //  scritti a mano: così, se un giorno il ritaglio cambia, si sposta una
  //  costante sola invece di rincorrere quattro coordinate.
  ctx.fillRect(SX, SICURO_BASSO - 82, DX - SX, 2);

  //  ⚠️ durataPulita, mai `durataMeeting || 45` (il ripiego scritto a mano di
  //  MeetGiornalieri.tsx:422): una durata importata in secondi — 2700 — passa
  //  indenne da quel `||` e il biglietto stamperebbe «Circa 45 ore».
  const minuti = durataPulita(d.durataMinuti);
  const consulente = String(d.consulente || "").trim();
  const conNome = `Circa ${durataInParole(minuti)}${consulente ? ` con ${consulente}` : ""}`;
  const senzaNome = `Circa ${durataInParole(minuti)}`;

  //  ── PERCHÉ «NIENTE DA SCARICARE» NON STA PIÙ QUI ────────────────────────
  //  Ci stava, declassata a voce di riga, come risposta all'obiezione che
  //  nessuno pronuncia. Il committente l'ha voluta fuori dall'immagine, e la
  //  frase non è persa: resta nel messaggio WhatsApp che accompagna il
  //  biglietto e resta sulla pagina dell'appuntamento, che sono i due posti in
  //  cui si legge davvero. Toglierla di qui alleggerisce la riga bassa, che
  //  era la sola zona del biglietto con tre voci in fila.
  //  La riga bassa adesso ha una voce sola, e deve stare dentro la riserva di
  //  WhatsApp (vedi FINE_RIGA_BASSA): l'angolo in basso a destra è dove il
  //  fumetto della chat appoggia ora e spunte.
  const fine = (corpo: number, voce1: string) => {
    usaFont(ctx, 400, corpo);
    return SX + 58 + largh(ctx, voce1) + 64;
  };

  //  Le voci scorrono da sinistra MISURANDO il testo, non su colonne fisse:
  //  quando il consulente non è assegnato la prima voce si accorcia da sola e
  //  le altre le scivolano dietro, senza lasciare un buco in mezzo alla riga.
  //  Se la riga sfora la riserva di WhatsApp si cede in quest'ordine: prima il
  //  corpo, poi il nome del consulente, infine l'intera seconda voce.
  const ipotesi: Array<{ corpo: number; voce1: string }> = [
    { corpo: 36, voce1: conNome },
    { corpo: 32, voce1: conNome },
    { corpo: 32, voce1: senzaNome },
  ];
  const scelta =
    ipotesi.find((i) => fine(i.corpo, i.voce1) <= FINE_RIGA_BASSA) ?? ipotesi[ipotesi.length - 1];

  let c = SX;
  disegnaIcona(ctx, iconaOrologio(), c, SICURO_BASSO - 48, 40, COL.marcaChiara);
  usaFont(ctx, 400, scelta.corpo);
  c += 58 + scrivi(ctx, scelta.voce1, c + 58, SICURO_BASSO - 16, b(0.75));

  //  ── PERCHÉ QUI NON C'È PIÙ NESSUN PREZZO ────────────────────────────────
  //  C'era «Si parte da 389 €», in un riquadro di vetro a destra. Il committente
  //  l'ha voluto fuori dall'immagine, e la ragione regge da sé: questo biglietto
  //  annuncia un appuntamento, non vende. Un prezzo su un invito sposta la prima
  //  domanda del cliente da «che cosa mi propongono» a «quanto mi costa», e la
  //  sposta prima ancora che qualcuno gli abbia parlato.
  //  La soglia resta dove serve — sulla pagina dell'appuntamento, che si apre
  //  quando il cliente ha già deciso di guardare.
  void c;
}

// ── IL DISEGNO ──────────────────────────────────────────────────────────────

export async function disegnaBiglietto(canvas: HTMLCanvasElement, d: DatiBiglietto): Promise<void> {
  canvas.width = LARG;
  canvas.height = ALT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D non disponibile");

  //  ⚠️ Si aspetta il carattere PRIMA di scrivere una sola lettera, altrimenti
  //  la prima generazione della sessione esce con il ripiego e la seconda no —
  //  due biglietti diversi dallo stesso tasto, che è il difetto peggiore
  //  perché nessuno lo riproduce a comando.
  //  Onestà: oggi in questo progetto non c'è nessun @font-face, quindi
  //  document.fonts.ready si risolve subito e non promette niente. Costa zero e
  //  resta corretto il giorno in cui un font venisse imbarcato.
  try {
    if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;
  } catch {
    /* un motore senza FontFaceSet disegna comunque */
  }

  //  Il logo si prende PRIMA di cominciare, e da una cache di sessione: fra la
  //  pressione del tasto e lo scarico deve restarci solo la codifica. toBlob è
  //  già asincrona di suo, e un giro di rete in mezzo può far scadere il gesto
  //  dell'utente — Safari a quel punto blocca il salvataggio come se fosse una
  //  finestra a comparsa.
  const logo = await precaricaLogo();

  //  ⚠️ L'ora passa da oraPulita come passa la durata da durataPulita, e per lo
  //  stesso motivo: sul lead sta scritta in tutte le forme che l'archivio
  //  importato ha prodotto («9:00», «09.00», «09:00:00»). La pagina pubblica la
  //  normalizza in `normalizzaInvito` (invito.ts:170); qui, senza, il biglietto
  //  scriverebbe «alle 9:00» e la pagina aperta due secondi dopo «alle 09:00» —
  //  stesso appuntamento, due orari scritti in due modi, nella stessa chat.
  const inv: DatiInvito = {
    nome: d.nome,
    data: d.giorno,
    ora: oraPulita(d.ora),
    durata: durataPulita(d.durataMinuti),
    consulente: String(d.consulente || ""),
    link: d.link,
  };

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  pilaSicura(ctx);

  //  Ordine di disegno, senza eccezioni: fondo → aloni e riempimenti → bordi →
  //  icone → testo. Il testo per ultimo, sempre.
  fondo(ctx);
  testata(ctx, inv, logo);
  saluto(ctx, d.nome);
  carte(ctx);
  rigaBassa(ctx, d);
}

// ── IL PNG ──────────────────────────────────────────────────────────────────

function tela(): HTMLCanvasElement {
  return document.createElement("canvas");
}

function versoBlob(canvas: HTMLCanvasElement, tipo: string, qualita?: number): Promise<Blob> {
  return new Promise((risolvi, rifiuta) => {
    //  ⚠️ toBlob lancia SecurityError SINCRONO se la tela è stata sporcata da
    //  un'immagine di altra origine: è la ragione per cui il logo passa dal
    //  ponte /api/proxy e non da drawImage diretto. L'eccezione dentro
    //  l'esecutore diventa un rifiuto della promessa, così chi chiama non si
    //  trova un errore fuori dalla catena.
    canvas.toBlob(
      (blob) => (blob ? risolvi(blob) : rifiuta(new Error("La tela non ha prodotto nessun file"))),
      tipo,
      qualita,
    );
  });
}

/** Il PNG di una tela GIÀ disegnata.
 *
 *  ⚠️ Esiste per il tasto "Scarica". `pngBiglietto` è comoda per chi una tela
 *  non ce l'ha, ma al momento del clic fa due cose che lì non si vogliono:
 *   · RIDISEGNA. Il file diventa una SECONDA immagine, non quella che il
 *     consulente ha appena guardato. Finché il disegno esce identico non si
 *     nota; il giorno in cui il logo arriva in ritardo, o i dati cambiano
 *     mentre la finestra è aperta, si manda al cliente qualcosa che nessuno ha
 *     visto. «L'anteprima è il file» o è vero, o è una frase.
 *   · PUÒ TORNARE IN RETE. Passa da `precaricaLogo`, che dopo un errore
 *     dimentica — a ragione, vedi lì — e riprova: un giro di rete infilato fra
 *     la pressione del tasto e il salvataggio è proprio ciò che fa scadere il
 *     gesto dell'utente, e Safari a quel punto blocca lo scarico come se fosse
 *     una finestra a comparsa, senza dire niente a nessuno.
 *  In più risparmia una seconda tela da 1920×1080 a ogni clic, che sugli iPad
 *  che ci sono in sede non è aria.
 *  ⚠️ Chi la usa deve essere certo che il disegno sia FINITO: una tela ancora
 *  vuota qui esce come un rettangolo nero, e nessuno se ne accorge prima del
 *  cliente. */
export function pngDaTela(canvas: HTMLCanvasElement): Promise<Blob> {
  return versoBlob(canvas, "image/png");
}

export async function pngBiglietto(d: DatiBiglietto): Promise<Blob> {
  const canvas = tela();
  await disegnaBiglietto(canvas, d);
  return pngDaTela(canvas);
}

// ── IL PDF, BYTE PER BYTE ───────────────────────────────────────────────────

//  Cinque oggetti e un flusso di contenuto lungo una riga. Non serve nessuna
//  libreria per questo, e infatti non ce n'è.
//
//  ⚠️ DOVE QUESTI PDF SI ROMPONO SEMPRE: gli offset della tavola xref contati
//  sui CARATTERI invece che sui BYTE. In JavaScript "à".length vale 1, ma nel
//  file quel carattere occupa 2 byte in UTF-8: basta una lettera accentata in
//  un titolo, o il commento binario della seconda riga, e ogni offset
//  successivo è sbagliato. Il lettore dice "file danneggiato", oppure — peggio
//  — lo ripara in silenzio e mostra una pagina bianca. Qui si accumulano
//  Uint8Array in un elenco tenendo un contatore di byte veri, e non si compone
//  mai il PDF come stringa.
//
//  ⚠️ E la JPEG non passa MAI per una stringa: String.fromCharCode e ritorno
//  rovina ogni byte ≥ 0x80, e TextEncoder li raddoppia. Va inserita come blocco
//  di byte suo, presa da arrayBuffer().

/** Foglio A4 orizzontale, in punti tipografici (72 = un pollice).
 *  ⚠️ Non si usa MediaBox [0 0 1920 1080]: si aprirebbe, ma sarebbe una pagina
 *  di 26,7 × 15 pollici, cioè una cosa che nessuna stampante ha mai visto. Su
 *  A4 l'immagine 16:9 sta a piena larghezza con due bande sopra e sotto, e
 *  viene resa a circa 164 punti per pollice. */
const PAG_W = 841.89;
const PAG_H = 595.28;
const IMG_W = 841.89;
const IMG_H = 473.56;
const IMG_Y = 60.86;

export async function pdfBiglietto(d: DatiBiglietto): Promise<Blob> {
  const canvas = tela();
  await disegnaBiglietto(canvas, d);
  return pdfDaTela(canvas);
}

/** Il PDF di una tela GIÀ disegnata. Stessa ragione di `pngDaTela`: fra il clic
 *  e il file deve restarci solo la codifica. */
export async function pdfDaTela(canvas: HTMLCanvasElement): Promise<Blob> {
  //  ⚠️ Le misure si leggono DALLA TELA e non dalle costanti del file: /Width e
  //  /Height dichiarati nel PDF devono essere quelli veri della JPEG, o il
  //  lettore riscala l'immagine su una griglia che non esiste. Oggi coincidono;
  //  il giorno in cui qualcuno passasse una tela di misura diversa, coinciderebbero
  //  lo stesso.
  const larg = canvas.width;
  const alt = canvas.height;
  //  ⚠️ DCTDecode vuole una JPEG BASELINE, non progressiva. toBlob la produce
  //  baseline su tutti i browser correnti — ed è anche il motivo per cui in
  //  questo flusso non si può accettare una JPEG arrivata da fuori.
  const jpeg = new Uint8Array(await (await versoBlob(canvas, "image/jpeg", 0.92)).arrayBuffer());

  const enc = new TextEncoder();
  const pezzi: Uint8Array[] = [];
  let byte = 0;
  const spingi = (u: Uint8Array) => {
    pezzi.push(u);
    byte += u.length;
  };
  const testo = (s: string) => spingi(enc.encode(s));

  //  Intestazione, più il commento binario: quei quattro byte alti dicono agli
  //  strumenti che il file non è di solo testo e non va trattato a righe.
  testo("%PDF-1.4\n");
  spingi(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  //  La matrice `cm` scala il quadrato unitario dell'immagine e lo posiziona;
  //  l'origine del PDF è in BASSO a sinistra, non in alto.
  //  ⚠️ Nessun ritorno a capo in coda: /Length è il conteggio dei byte fra la
  //  fine di `stream\n` e l'inizio di `\nendstream`, e quei due ritorni a capo
  //  sono separatori, non dati. Contarne uno di troppo passa inosservato su
  //  Chrome e fa protestare Anteprima su macOS.
  const contenuto = `q ${IMG_W} 0 0 ${IMG_H} 0 ${IMG_Y} cm /Im0 Do Q`;
  const lunghezzaContenuto = enc.encode(contenuto).length;

  const offset: number[] = [0]; // la voce 0 è la testa della lista libera
  const oggetto = (corpo: string) => {
    offset.push(byte);
    testo(corpo);
  };

  oggetto("1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj\n");
  oggetto("2 0 obj <</Type/Pages/Kids[3 0 R]/Count 1>> endobj\n");
  oggetto(
    `3 0 obj <</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PAG_W} ${PAG_H}]` +
      "/Resources<</XObject<</Im0 5 0 R>>>>/Contents 4 0 R>> endobj\n",
  );
  oggetto(`4 0 obj <</Length ${lunghezzaContenuto}>>\nstream\n${contenuto}\nendstream\nendobj\n`);

  //  L'immagine: intestazione in testo, byte grezzi in un pezzo tutto suo.
  offset.push(byte);
  testo(
    `5 0 obj <</Type/XObject/Subtype/Image/Width ${larg}/Height ${alt}` +
      `/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpeg.length}>>\nstream\n`,
  );
  spingi(jpeg);
  testo("\nendstream\nendobj\n");

  //  ⚠️ startxref è l'offset della `x` di `xref` contato dal byte zero del
  //  file: include l'intestazione e il commento binario. Va preso adesso, dopo
  //  aver messo giù tutto il resto.
  const inizioXref = byte;
  //  ⚠️ Ogni riga della tavola è ESATTAMENTE 20 byte: dieci cifre, uno spazio,
  //  cinque cifre, uno spazio, la lettera, e DUE byte di fine riga — cioè lo
  //  spazio prima del ritorno a capo. Diciannove byte e Acrobat rifiuta il
  //  documento. Anche la voce zero deve esserci ed essere completa.
  //  `0 6` significa "sei voci a partire dalla numero 0" (cinque oggetti veri
  //  più la testa), e /Size nel trailer è il numero d'oggetto più alto più uno:
  //  sfasare uno dei due è l'errore classico di chi aggiunge un oggetto dopo.
  let xref = `xref\n0 ${offset.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offset.length; i++) {
    xref += `${String(offset[i]).padStart(10, "0")} 00000 n \n`;
  }
  testo(xref);
  testo(`trailer <</Size ${offset.length}/Root 1 0 R>>\nstartxref\n${inizioXref}\n%%EOF\n`);

  //  I pezzi arrivano al Blob così come sono: nessuna conversione, nessuna
  //  stringa di mezzo.
  return new Blob(pezzi as BlobPart[], { type: "application/pdf" });
}

// ── IL NOME DEL FILE ────────────────────────────────────────────────────────

/** `consulenza-2026-08-21-1530.png`.
 *  ⚠️ Nel nome NON entra il nome del cliente, e non è una svista: un nome di
 *  file viaggia attaccato all'immagine ed è la sola parte che nessuno rilegge
 *  prima di inoltrarla. La data serve al consulente a ritrovare il biglietto
 *  giusto fra dieci; il nome della persona non serve a nessuno. */
export function nomeFile(d: DatiBiglietto, estensione: "png" | "pdf"): string {
  const giorno = String(d.giorno || "").slice(0, 10) || "senza-data";
  //  ⚠️ Anche qui oraPulita, non un replace sul campo grezzo: un lead con «9:00»
  //  darebbe `consulenza-2026-08-17-900.png` e un altro con «09:00»
  //  `...-0900.png`. In una cartella ordinata per nome i biglietti delle nove
  //  finirebbero in due punti diversi, ed è esattamente il momento in cui il
  //  consulente allega quello sbagliato.
  const ora = oraPulita(d.ora).replace(":", "");
  return `consulenza-${giorno}${ora ? `-${ora}` : ""}.${estensione}`;
}
