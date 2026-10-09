// ── L'INVITO ALL'APPUNTAMENTO — LE REGOLE COMUNI ────────────────────────────
//  Un "invito" è una pagina pubblica che dice a un cliente QUANDO ha la
//  consulenza, QUANTO dura, COME si svolge e CHI incontra. Si manda dopo aver
//  fissato, e chi la riceve la apre dal telefono — spesso giorni prima.
//
//  Questo file non conosce né il database né il browser: sono solo la forma
//  dell'invito e le regole per dire una data a parole. Serve a tutti e tre i
//  lati (chi genera il link, chi lo legge dal server, chi disegna la pagina)
//  senza trascinare Supabase dentro il pacchetto mandato al browser — la stessa
//  divisione che fa già src/media/galleria.ts.
//
//  ⚠️ QUI DENTRO NON PUÒ ENTRARE NIENTE DI PRIVATO. La pagina la apre chiunque
//  abbia il link: telefono, email, note e stato della trattativa non escono da
//  questo tipo, e non ci devono entrare "solo per comodità" più avanti.

// ── DOVE VIVE UN INVITO ─────────────────────────────────────────────────────
//  Due righe in app_config, e servono entrambe perché le domande sono due e
//  opposte:
//   · `invito:<codice>` → di chi è questo link. La legge la pagina pubblica,
//     che del lead conosce solo il codice nell'indirizzo;
//   · `invitoDi:<leadId>` → il codice già dato a questo appuntamento. La legge
//     il CRM, per non generare un link nuovo ogni volta che si preme il tasto.
//     Senza, il consulente che clicca due volte manderebbe due indirizzi
//     diversi per la stessa consulenza e non saprebbe quale dei due è "quello".
//  È lo stesso schema di `meet:<leadId>` (api.crm.meeting-session): un
//  appuntamento, un codice.
export const chiaveInvito = (codice: string) => `invito:${codice}`;
export const chiaveInvitoDiLead = (leadId: string) =>
  `invitoDi:${String(leadId || "")
    .trim()
    .slice(0, 64)}`;

/** La riga salvata sotto `invito:<codice>`. Volutamente magra: NON è una copia
 *  dell'appuntamento, è un puntatore.
 *
 *  PERCHÉ NON SI FOTOGRAFA DATA E ORA QUI DENTRO. Un appuntamento si sposta —
 *  succede ogni giorno — e una fotografia scattata al momento della generazione
 *  continuerebbe a dire l'ora vecchia a un cliente che ha già in mano il link.
 *  Quello è esattamente il modo di far presentare qualcuno all'ora sbagliata.
 *  Leggendo il lead a ogni apertura, la pagina è vera anche fra tre giorni.
 *
 *  `userId` è lo studio proprietario del lead: viaggia con la riga perché la
 *  lettura pubblica possa restare dentro quello studio senza fidarsi di niente
 *  che arrivi dall'indirizzo. */
export interface RigaInvito {
  codice: string;
  leadId: string;
  userId: string;
  creatoIl: string;
}

/** Quello che la pagina pubblica riceve davvero. Cinque campi, e nessuno di
 *  questi identifica la persona più di quanto già faccia il link stesso:
 *  `nome` è il solo nome di battesimo, `link` è la stanza a cui il cliente è
 *  comunque atteso. */
export interface DatiInvito {
  /** solo il nome di battesimo: mai il cognome, che insieme alla città
   *  renderebbe la pagina un documento su una persona */
  nome: string;
  /** "2026-08-21" — stringa vuota quando la data non si legge */
  data: string;
  /** "15:30" — stringa vuota quando l'ora manca */
  ora: string;
  durata: number;
  /** il nome del consulente, vuoto se non assegnato */
  consulente: string;
  /** la stanza Meetly, vuota se questo appuntamento non ne ha una nostra */
  link: string;
}

/** ── QUANTO DURA UNA CONSULENZA, QUANDO NESSUNO LO DICE ───────────────────
 *  Richiesta del committente: «fai che di default, quando fisso consulenze, in
 *  tutti i campi — sia lead importati sia nuovo lead — sia 60 minuti,
 *  ovviamente sempre che si può cambiare».
 *
 *  ⚠️ QUESTO NUMERO È UNO SOLO, E ADESSO LO È DAVVERO. Prima ce n'erano
 *   quattro, scritti in quattro file: 45 qui, 30 nella scheda del lead, 30
 *   nella finestra veloce (la coda dei lead importati), 30 nella giornata
 *   dell'agenda — più due «45» scritti a mano nel salvataggio. Lo stesso
 *   appuntamento durava 30, 45 o 60 minuti a seconda della schermata da cui lo
 *   si era fissato, e in agenda si sovrapponeva a quello dopo.
 *   Cambiarlo qui li cambia tutti: è il senso di averlo in un posto solo.
 *  ⚠️ NON È UN OBBLIGO: la durata resta scelta a mano in ogni schermata
 *   (15, 30, 45, 60, 90). Questo è solo il valore da cui si parte. */
export const DURATA_PREDEFINITA = 60;
/** Sotto i cinque minuti non è un appuntamento, sopra le otto ore non è un
 *  numero: nell'archivio importato capitano gli zeri e le durate in secondi. */
const DURATA_MIN = 5;
const DURATA_MAX = 480;

// ── I DATI VERI NON RISPETTANO I TIPI ───────────────────────────────────────
//  Tutto quello che arriva dal database è "una stringa di cui ci si fida":
//  scritta anche da import di CRM precedenti e modificabile a mano dal pannello
//  Supabase. Queste tre funzioni sono la porta: quello che non passa vale
//  "non lo so", che è diverso da "oggi" e diverso da zero.

/** "2026-08-21T00:00" → "2026-08-21". Stringa vuota se non è una data vera:
 *  `2026-13-45` ha la forma giusta e non esiste, e senza il secondo controllo
 *  finirebbe sulla pagina di un cliente come "NaN". */
export function dataPulita(v: unknown): string {
  const s = String(v ?? "")
    .trim()
    .slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  //  Mezzogiorno, mai mezzanotte: nelle due notti del cambio d'ora una data
  //  costruita a mezzanotte scivola al giorno prima.
  return s;
}

/** "9:00", "09.00", "09:00:00" → "09:00". Chi ha importato l'archivio ha usato
 *  tutte e tre le forme, e `new Date("...T9:00")` non è una data in nessun
 *  browser: sarebbe una pagina che dice "Invalid Date" al cliente. */
export function oraPulita(v: unknown): string {
  const m = /^(\d{1,2})[:.](\d{2})/.exec(String(v ?? "").trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** La durata, riportata dentro numeri che si possono scrivere su una pagina. */
export function durataPulita(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < DURATA_MIN || n > DURATA_MAX) return DURATA_PREDEFINITA;
  return n;
}

// ── IL SOLO NOME DI BATTESIMO, ANCHE QUANDO IL CAMPO NON LO È ───────────────
//  Sulla scheda `nome` e `cognome` sono due campi distinti, e finché è il CRM a
//  riempirli `nome` è davvero il solo nome. Ma l'archivio importato non è così:
//  quando il file d'origine aveva una colonna sola ("Mario Rossi") tutto è
//  finito dentro `nome` e `cognome` è rimasto vuoto — succede regolarmente con
//  le esportazioni dei moduli e con i lead di Meta.
//  Fidarsi del campo significherebbe scrivere il cognome in cima a una pagina
//  pubblica che chiunque può inoltrare. Qui si decide guardando i DUE campi:
//   · se il cognome c'è, `nome` sta facendo il suo mestiere e resta intero —
//     "Anna Maria" non va tagliato a "Anna";
//   · se il cognome manca e il nome ha più parole, è quasi certo un nome
//     completo schiacciato in un campo solo: si tiene la prima parola. Nel caso
//     raro di un doppio nome senza cognome si perde la seconda parola, che è un
//     saluto meno preciso — non un cognome pubblicato.
//  In più si toglie comunque il cognome se compare in coda al nome ("Mario
//  Rossi" + "Rossi"), che è l'altro modo in cui gli import lo duplicano.
const MAX_NOME = 40;
export function nomeDiBattesimo(nomeGrezzo: unknown, cognomeGrezzo: unknown): string {
  const cognome = String(cognomeGrezzo ?? "")
    .trim()
    .replace(/\s+/g, " ");
  let nome = String(nomeGrezzo ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!nome) return "";
  if (cognome) {
    const coda = ` ${cognome.toLowerCase()}`;
    if (nome.length > cognome.length && nome.toLowerCase().endsWith(coda)) {
      nome = nome.slice(0, nome.length - coda.length).trim();
    }
    return nome.slice(0, MAX_NOME);
  }
  return nome.split(" ")[0].slice(0, MAX_NOME);
}

/** Quello che torna dalla rete non è ancora un invito: si accetta solo ciò che
 *  si sa disegnare. `null` = non c'è niente da mostrare, e chi chiama deve
 *  trattarlo come "link non più valido". */
export function normalizzaInvito(grezzo: unknown): DatiInvito | null {
  if (!grezzo || typeof grezzo !== "object" || Array.isArray(grezzo)) return null;
  const g = grezzo as Record<string, unknown>;
  return {
    //  Il taglio del cognome è già stato fatto dal server (vedi
    //  nomeDiBattesimo): qui si ripulisce solo la forma di ciò che è arrivato.
    nome: String(g.nome ?? "")
      .trim()
      .slice(0, MAX_NOME),
    data: dataPulita(g.data),
    ora: oraPulita(g.ora),
    durata: durataPulita(g.durata),
    consulente: String(g.consulente ?? "")
      .trim()
      .slice(0, 40),
    link: typeof g.link === "string" && /^https?:\/\//i.test(g.link.trim()) ? g.link.trim() : "",
  };
}

// ── QUANDO, DETTO IN PAROLE ─────────────────────────────────────────────────
//  «Giovedì 21 agosto alle 15:30» si capisce; «2026-08-21 15:30» obbliga a
//  guardare il calendario. E se è oggi si scrive OGGI: è la domanda a cui la
//  pagina esiste per rispondere in due secondi.

/** Lo scarto in GIORNI DI CALENDARIO fra una data e oggi. `NaN` quando la data
 *  non si legge — ed è la ragione per cui esiste questa funzione invece di una
 *  sottrazione: "non lo so" non è "oggi", e una data illeggibile trattata come
 *  oggi metterebbe in cima alla pagina di un cliente un «Oggi alle 15:30» che
 *  nessuno gli ha mai detto.
 *  È la stessa regola di `giorniDaOggi` (src/crm/ui.tsx), riscritta qui e non
 *  importata perché quel file è il linguaggio del CRM: importarne una riga
 *  trascinerebbe l'intero pannello dentro il pacchetto di una pagina pubblica
 *  che deve aprirsi su una connessione da telefono. */
export function giorniDaOggiInvito(dataISO: string): number {
  const s = dataPulita(dataISO);
  if (!s) return Number.NaN;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return Number.NaN;
  return Math.round((d.getTime() - oggi.getTime()) / 86_400_000);
}

/** Il momento esatto dell'appuntamento, in millisecondi. `NaN` se manca un
 *  pezzo: senza ora non esiste nessun conto alla rovescia da fare. */
export function istanteInvito(data: string, ora: string): number {
  const g = dataPulita(data);
  const o = oraPulita(ora);
  if (!g || !o) return Number.NaN;
  return new Date(`${g}T${o}:00`).getTime();
}

/** A che punto è l'appuntamento rispetto a chi sta guardando la pagina.
 *   · `ignoto`  — data o ora illeggibili: non si inventa un giorno;
 *   · `futuro`  — un altro giorno: il tasto per entrare non serve ancora;
 *   · `oggi`    — è il giorno, e il tasto diventa il protagonista;
 *   · `adesso`  — siamo nella finestra dell'incontro;
 *   · `passato` — è finito: si dice, invece di mostrare un conto negativo. */
export type FaseInvito = "ignoto" | "futuro" | "oggi" | "adesso" | "passato";

/** Quanto si resta "in tempo" dopo l'ora di fine. Un incontro che sfora di
 *  venti minuti è normale, e la pagina non deve dire "è passato" a un cliente
 *  che sta ancora parlando col consulente. */
const TOLLERANZA_MS = 30 * 60_000;
/** Da quanto prima il tasto per entrare vale "adesso": un'ora prima chi apre la
 *  pagina si sta già preparando. */
const ANTICIPO_MS = 60 * 60_000;

export function faseInvito(d: DatiInvito, adesso: number): FaseInvito {
  const inizio = istanteInvito(d.data, d.ora);
  if (Number.isNaN(inizio)) return "ignoto";
  const fine = inizio + d.durata * 60_000 + TOLLERANZA_MS;
  if (adesso > fine) return "passato";
  const giorni = giorniDaOggiInvito(d.data);
  if (Number.isNaN(giorni)) return "ignoto";
  if (giorni > 0) return "futuro";
  //  Giorni negativi con la fine ancora davanti non esistono; se capitasse
  //  (orologio del telefono spostato) vale "oggi", che è la lettura innocua.
  return adesso >= inizio - ANTICIPO_MS ? "adesso" : "oggi";
}

/** "giovedì 21 agosto". Costruito una volta sola: dentro un render verrebbe
 *  ricreato a ogni battito del conto alla rovescia. */
const FMT_ESTESO = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Iniziale maiuscola: la frase apre la pagina, e "giovedì 21 agosto" scritto
 *  minuscolo in caratteri grandi sembra un errore di composizione. */
const capitale = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** LA RIGA PIÙ IMPORTANTE DELLA PAGINA: «Oggi alle 15:30», «Domani alle 9:00»,
 *  «Giovedì 21 agosto alle 15:30». Stringa vuota se non si sa quando — la
 *  pagina in quel caso dice che il consulente confermerà, invece di inventare.
 *
 *  «Oggi» e «Domani» non sono un vezzo: sono le due giornate che si capiscono
 *  senza aprire il calendario, ed è il committente ad averle chieste per prime. */
export function quandoInParole(d: DatiInvito): string {
  const giorni = giorniDaOggiInvito(d.data);
  const ora = oraPulita(d.ora);
  if (Number.isNaN(giorni) || !ora) return "";
  const alle = `alle ${ora}`;
  if (giorni === 0) return `Oggi ${alle}`;
  if (giorni === 1) return `Domani ${alle}`;
  if (giorni === -1) return `Ieri ${alle}`;
  return `${capitale(FMT_ESTESO.format(new Date(`${d.data}T12:00:00`)))} ${alle}`;
}

/** Il giorno per esteso senza l'ora — serve alla riga secondaria quando in
 *  cima c'è scritto "Oggi": chi apre la pagina di lunedì vuole comunque poter
 *  segnare la data da qualche parte. */
export function giornoPerEsteso(d: DatiInvito): string {
  const s = dataPulita(d.data);
  if (!s) return "";
  return capitale(FMT_ESTESO.format(new Date(`${s}T12:00:00`)));
}

const plurale = (n: number, uno: string, molti: string) => `${n} ${n === 1 ? uno : molti}`;

/** QUANTO MANCA. Sotto la data, in parole: «Mancano 3 giorni», «Manca 1 ora»,
 *  «Fra 20 minuti», «È il momento». Stringa vuota quando non c'è niente da
 *  contare (appuntamento passato o data ignota): un conto alla rovescia
 *  negativo è il difetto che questa pagina non può permettersi. */
export function quantoMancaInParole(d: DatiInvito, adesso: number): string {
  const inizio = istanteInvito(d.data, d.ora);
  if (Number.isNaN(inizio)) return "";
  const fase = faseInvito(d, adesso);
  if (fase === "passato") return "";
  const minuti = Math.round((inizio - adesso) / 60_000);
  if (minuti <= 0) return "È il momento";
  if (minuti < 60) return `Fra ${plurale(minuti, "minuto", "minuti")}`;
  const giorni = giorniDaOggiInvito(d.data);
  //  Oltre la giornata si conta in giorni e non in ore: "fra 51 ore" è un
  //  numero che nessuno traduce in un giorno della settimana.
  if (giorni >= 1) return `Fra ${plurale(giorni, "giorno", "giorni")}`;
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  //  I minuti si dicono solo se cambiano qualcosa: "fra 2 ore e 3 minuti" è
  //  precisione finta su un appuntamento fissato al quarto d'ora.
  return resto >= 5
    ? `Fra ${plurale(ore, "ora", "ore")} e ${plurale(resto, "minuto", "minuti")}`
    : `Fra ${plurale(ore, "ora", "ore")}`;
}

/** «Dura circa 45 minuti» / «Dura circa 1 ora e 30 minuti». Il "circa" è
 *  onesto: è la durata prevista di un incontro fra persone, non un timer. */
export function durataInParole(minuti: number): string {
  const m = durataPulita(minuti);
  if (m < 60) return `${plurale(m, "minuto", "minuti")}`;
  const ore = Math.floor(m / 60);
  const resto = m % 60;
  return resto
    ? `${plurale(ore, "ora", "ore")} e ${plurale(resto, "minuto", "minuti")}`
    : `${plurale(ore, "ora", "ore")}`;
}
