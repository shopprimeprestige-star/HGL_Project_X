// ── DISPONIBILITÀ DEL CONSULENTE ────────────────────────────────────────────
//  Da qui esce l'unica risposta a "quando è libero": la usano l'agenda mensile,
//  la scheda del lead e la programmazione delle installazioni. Se questo file
//  sbaglia, sbagliano tutti insieme e nello stesso modo — motivo per cui le due
//  correzioni qui sotto valgono più di qualunque ritocco alle pagine.
//
//  COSA ESPONE
//   · getFreeSlotsForDate → gli orari liberi di UN giorno (anche zero);
//   · generateAvailability → i prossimi N giorni che hanno almeno un buco;
//   · caricoGiorni        → quanto è pieno ogni giorno, per la barra del mese;
//   · prossimoSlotLibero  → il primo orario prenotabile da adesso in poi.
//  Le ultime due sono nate per il calendario: prima la pagina se le calcolava
//  in casa, con un'altra unità di misura (gli appuntamenti invece degli slot),
//  e il mese raccontava un carico che nessun'altra vista confermava.
import type {
  AppuntamentoManutenzione,
  Consultant,
  FasciaOraria,
  InstallazioneInfo,
  Lead,
  Pausa,
} from "./types";
//  ── LE MANUTENZIONI SONO IMPEGNI COME GLI ALTRI ────────────────────────────
//   Si importano DUE cose sole e tutte e due pure: come si legge l'elenco dei
//   ritorni di un cliente e quanto dura un ritorno. `manutenzione/regole` non
//   importa React né questo file — importa solo i tipi — quindi non si chiude
//   nessun anello. La durata NON si ricopia qui: un secondo `60` scritto a mano
//   diventerebbe 45 di là e 60 di qua al primo ritocco, e l'agenda direbbe due
//   cose diverse sullo stesso pomeriggio.
import { DURATA_MANUTENZIONE, manutenzioniDi } from "./manutenzione/regole";
//  La durata di serie di una consulenza: una sola per tutto il CRM.
import { DURATA_PREDEFINITA } from "./invito";
//  «La consulenza non è avvenuta» si decide in un posto solo (crm/types), ed è
//  metà della risposta a «questo orario è ancora occupato?».
import { STATI_NON_SVOLTA } from "./types";
//  ⚠️ IL CONTO DELLE PERSONE IN UNA FASCIA STA IN UN POSTO SOLO, e non è qui:
//   `statoDellaFascia` la usano anche il server (api.crm.disponibilita) e le
//   schermate. Due conti scritti in due file sono il modo in cui due schermate
//   finiscono per dire il contrario sullo stesso pomeriggio.
import {
  slotScegliibile,
  statoDellaFascia,
  type ModoFascia,
  type StatoSlot,
} from "./fascia-consulenza";

/** ── ⚠️ UN ORARIO RESTA OCCUPATO SOLO FINCHÉ DEVE ANCORA SUCCEDERE ────────
 *
 *  Segnalazione del committente: «quando metto “da spostare” si deve liberare
 *  anche lo slot di quell'orario: se è da riprogrammare, il vecchio orario si
 *  libera».
 *
 *  Era vero ed era grave: l'orario veniva dichiarato occupato SOLO perché la
 *  scheda aveva una data e un'ora, senza guardare che cosa dice lo stato. Una
 *  consulenza saltata alle 15:00 continuava a tenersi il suo posto per sempre
 *  — la data vecchia nessuno la cancella, è la memoria di quando doveva essere
 *  — quindi l'agenda mostrava pieno un pomeriggio vuoto e il setter spostava
 *  il cliente a un'altra ora per niente. Con tre o quattro rinvii in una
 *  settimana la giornata risultava piena senza avere un solo appuntamento.
 *
 *  ⚠️ L'ELENCO È DI STATI IN CUI NON DEVE PIÙ SUCCEDERE NIENTE, non di stati
 *   "brutti": chi ha comprato, chi sta valutando, chi ha un ricontatto fissato
 *   ha avuto — o avrà — il suo incontro, e il suo orario resta suo.
 *  ⚠️ UNO STATO MAI VISTO TIENE L'ORARIO. Gli stati arrivano da un JSONB e
 *   negli archivi importati c'è di tutto: davanti a una parola che non
 *   conosciamo è meglio mostrare occupato un orario libero (si guarda e si
 *   decide) che libero un orario occupato (due clienti alla stessa ora).
 *  ⚠️ NON VALE PER POSE E MANUTENZIONI: quelle hanno uno stato loro, scritto
 *   sulla posa e sul ritorno, e non dipendono da come è messo il lead. Un
 *   cliente «concluso» con l'installazione in calendario occupa eccome. */
export const STATI_CHE_LIBERANO_LO_SLOT: string[] = [
  //  Cliente assente e «da riprogrammare»: l'incontro non è avvenuto e quella
  //  data è solo il ricordo di quando doveva essere.
  ...STATI_NON_SVOLTA,
  //  Non succederà più: la trattativa è chiusa o la persona non si trova.
  "annullato",
  "perdi_tempo",
  "irreperibile",
  "concluso",
  //  La visita in sede è stata disdetta: l'ora in negozio torna libera.
  "sede_disdetta",
  //  «Meet da fissare» dice che un appuntamento NON c'è: se sulla scheda è
  //  rimasta una data vecchia, non è un impegno di nessuno.
  "fissa_meet_dopo",
];

/** L'appuntamento di questa scheda tiene ancora occupato il suo orario? */
export function tieneLoSlot(stato?: string | null): boolean {
  return !STATI_CHE_LIBERANO_LO_SLOT.includes(String(stato ?? ""));
}

export interface DaySlots {
  date: string; // YYYY-MM-DD
  label: string; // "Sab 18 Apr"
  dow: number;
  slots: string[]; // ["09:00","09:45",...] — solo quelle che si possono scegliere
  /** ── TUTTE le ore del giorno, con com'è messa ciascuna ─────────────────
   *  Comprese quelle che NON si possono scegliere: si mostrano sbarrate. È la
   *  richiesta del committente — «l'orario lo deve dare ma sbarrato, non
   *  cliccabile» — e ha una ragione: un'ora che sparisce fa venire il dubbio
   *  che manchi per un errore del programma, e a quel punto non ci si fida più
   *  nemmeno delle altre. */
  ore?: SlotConStato[];
}

/** Quanto è pieno un giorno, misurato in slot e non in appuntamenti.
 *
 *  Contare gli appuntamenti come unità è la misura sbagliata: un meeting da 90
 *  minuti e una telefonata da 15 valgono "uno" a testa, e una giornata con tre
 *  installazioni sembrava più libera di una con quattro chiamate. Qui il
 *  denominatore è la capienza reale del giorno (gli slot lavorabili) e il
 *  numeratore il tempo che non è più prenotabile. */
export interface CaricoGiorno {
  date: string;
  /** il consulente lavora in questo giorno della settimana */
  lavorativo: boolean;
  /** slot lavorabili in totale: la capienza della giornata */
  totali: number;
  /** slot ancora prenotabili */
  liberi: number;
  /** slot già consumati da impegni presi */
  occupati: number;
  /** 0 = giornata tutta libera, 1 = non entra più niente */
  carico: number;
}

/** Il primo orario davvero prenotabile a partire da adesso. */
export interface SlotProssimo {
  date: string;
  ora: string;
  /** "Gio 14 Ago" */
  label: string;
}

const DOW_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MONTH_SHORT = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];

//  Durate assunte quando la trattativa non ne porta una: sono le stesse che usa
//  la griglia di tutti i consulenti, così un blocco lungo un'ora occupa un'ora
//  in entrambe le viste e non "sparisce" passando da una all'altra.
/*  ⚠️ QUANTO OCCUPA UNA CONSULENZA SENZA DURATA SCRITTA. Era 30, mentre la
    durata di serie con cui si FISSA adesso è 60 (crm/invito): un appuntamento
    salvato senza il campo avrebbe liberato la mezz'ora che in realtà stava
    usando, e l'agenda avrebbe offerto a un altro cliente la seconda metà di
    una consulenza. Lo stesso numero, in un posto solo. */
const DURATA_MEETING = DURATA_PREDEFINITA;
const DURATA_SEDE = 60;
const DURATA_INSTALLAZIONE = 60;

/** ── IL TEMPO PER LA STRADA ─────────────────────────────────────────────────
 *  Un'installazione non occupa solo l'ora in cui si posa: chi ci va parte prima
 *  e torna dopo, e in quelle ore non è disponibile per niente — né per un'altra
 *  posa né per una consulenza, perché la persona è la stessa. Finché questo
 *  tempo non era scritto da nessuna parte l'agenda lo dichiarava libero, e a
 *  fissarci sopra una videochiamata ci si accorgeva il giorno stesso.
 *
 *  ⚠️⚠️ CINQUE NUMERI DIVERSI, CINQUE DECISIONI DIVERSE — NON UNA SVISTA ⚠️⚠️
 *  Chi legge queste righe fra sei mesi vedrà 120, 180, 30, ancora 120 e ancora
 *  30, e penserà che qualcuno si sia dimenticato di allinearli. Non è così: sono
 *  richieste distinte dello STESSO committente, fatte in momenti diversi, e
 *  ognuna riguarda un mestiere suo.
 *   · STRADA_POSATORE = 120 · chi posa parte due ore prima e rientra due ore
 *     dopo. Deciso per primo.
 *   · STRADA_DRIVER   = 180 · chi guida parte prima del posatore e rientra
 *     dopo di lui: tre ore. Deciso insieme al mestiere «driver».
 *   · STRADA_INSTALLATORE = 30 · «un'installazione occupa il suo slot più
 *     mezz'ora prima e mezz'ora dopo». È il PAVIMENTO di ogni posa: la mezz'ora
 *     che serve comunque per scaricare, salire e rimettere a posto.
 *     ⚠️ Si chiamava STRADA_TECNICO: stesso numero, stessa regola, e il mestiere
 *     che si chiamava «tecnico» adesso si chiama «installatore» ovunque — vedi
 *     la testata di crm/kpi-setter.ts.
 *   · STRADA_ACCOMPAGNATORE = 120 · chi va INSIEME a posare fa lo stesso
 *     viaggio di chi posa: parte con lui e torna con lui. Il numero coincide con
 *     quello del posatore ed è scritto per esteso invece che come alias, perché
 *     sono DUE decisioni: il giorno in cui il committente allunga il margine
 *     dell'uno non deve muovere in silenzio quello dell'altro.
 *   · STRADA_MANUTENTORE = 30 · chi esegue un RITORNO per la manutenzione.
 *     ⚠️ Trenta e non centoventi, e la ragione va detta perché è l'unica di
 *     tutte e cinque che non parla di strada: la manutenzione si fa IN SEDE, il
 *     cliente viene da noi. Dargli le due ore del posatore vorrebbe dire
 *     togliere mezza giornata a chi non esce dal negozio — l'errore che tutto
 *     questo blocco chiede di non fare. Ma non è nemmeno zero: mezz'ora prima e
 *     mezz'ora dopo è il tempo che serve comunque per preparare la postazione,
 *     ricevere il cliente che arriva con dieci minuti di ritardo e rimettere a
 *     posto. A zero il CRM offrirebbe volentieri lo slot che comincia nel minuto
 *     esatto in cui finisce il ritorno precedente, ed è così che due clienti si
 *     ritrovano seduti nella stessa sala d'attesa.
 *     È lo stesso numero di STRADA_INSTALLATORE — il pavimento — ed è scritto
 *     per esteso e non come alias per la stessa ragione dell'accompagnatore:
 *     sono due decisioni, e il giorno in cui una si muove l'altra non deve
 *     seguirla di nascosto.
 *     ⚠️ Se su un ritorno si sceglie anche un DRIVER o un ACCOMPAGNATORE, quei
 *     due tengono i LORO numeri (180 e 120) e non questo. Non è un'incoerenza:
 *     un driver su un ritorno c'è solo quando qualcuno va a PRENDERE il cliente,
 *     e chi affianca parte e torna con lui — cioè il viaggio, in quel caso,
 *     esiste davvero. Scegliere quelle due persone È la dichiarazione che
 *     qualcuno si muove; se non si muove nessuno, si sceglie il solo manutentore.
 *  ⚠️ Non allinearli. Portarli tutti a 30 «per coerenza» rimetterebbe in agenda
 *  un'ora e mezza di strada che il posatore sta davvero facendo, e due ore e
 *  mezza di quella del driver: sarebbero slot venduti a chi è in autostrada.
 *  Portarli tutti a 120 toglierebbe due ore a chi non si muove.
 *  Se un giorno cambiano davvero, cambiano UNO ALLA VOLTA e su richiesta.
 *
 *  ⚠️ UNA PERSONA CON PIÙ MESTIERI SULLA STESSA POSA PRENDE IL MARGINE PIÙ
 *  LARGO, non la somma e non l'ultimo trovato: vedi `margineStrada`. Fra due
 *  risposte diverse sullo stesso orario si tiene quella che toglie più tempo —
 *  uno slot perso costa un buco in agenda, uno slot promesso per sbaglio costa
 *  due persone nello stesso posto alla stessa ora.
 *
 *  ⚠️ NON È UN SECONDO ELENCO DI REGOLE. La fascia allargata si somma agli
 *  impegni già contati qui dentro (meeting, visite in sede, altre pose) e passa
 *  per gli stessi filtri di sempre — giorni lavorativi, fasce orarie, pause,
 *  indisponibilità.
 *
 *  ⚠️ VALE PER OGNI POSA, anche per quelle che si fanno in sede: è la regola
 *  come è stata chiesta, ed è anche quella prudente. Se un giorno si volesse
 *  limitarla alle sole trasferte, il punto da toccare è UNO — `margineStrada`
 *  qui sotto — e non sparso per il file. */
export const STRADA_POSATORE = 120;
export const STRADA_DRIVER = 180;
export const STRADA_INSTALLATORE = 30;
export const STRADA_ACCOMPAGNATORE = 120;
export const STRADA_MANUTENTORE = 30;

export function formatDayLabel(d: Date): string {
  return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** Data locale YYYY-MM-DD.
 *  `toISOString()` converte in UTC: la mezzanotte italiana diventa le 22 del
 *  giorno prima, e la disponibilità di un mese intero finiva incolonnata sul
 *  giorno sbagliato (il calendario mostrava gli slot di domani su oggi). */
function isoLocale(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "09:30" → 570. Null se il valore non è un orario. */
function minuti(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** ── ⚠️ TRE PERSONE NELLA STESSA FASCIA, POI BASTA ────────────────────────
 *  Richiesta del committente: «fai che posso aggiungere fino a 3 persone nella
 *  stessa ora di consulenza per singolo consulente, con un contatore 1/3, 2/3,
 *  3/3, e poi quello slot non è più disponibile».
 *
 *  Finora una consulenza fissata rendeva la fascia ROSSA ma premibile: nessun
 *  limite scritto da nessuna parte, quindi nessuno poteva dire quand'era
 *  troppo. Adesso il limite c'è, è un numero solo, e sta qui.
 *
 *  ⚠️ VALE SOLO PER LE CONSULENZE. Le pose, i ritorni per la manutenzione, le
 *   visite in sede e le chiusure restano impegni ESCLUSIVI: chi è in strada con
 *   il furgone non può essere in tre posti, e la capienza lì sarebbe uno slot
 *   venduto a chi è in autostrada. Per questo gli intervalli si marcano uno per
 *   uno (`consulenza: true`) invece di contarli tutti insieme.
 *  ⚠️ E NON TOCCA `personaLibera`: quella risponde a «questa persona può stare
 *   QUI in questa fascia», che è una domanda sul corpo, non sull'agenda. Una
 *   consulenza in corso la occupa comunque. */
export const CAPIENZA_PREDEFINITA = 3;

/*  ── ⚠️ E IL NUMERO SI CAMBIA DALLE IMPOSTAZIONI ──────────────────────────
    Richiesta del committente: «fai che posso cambiare il numero dalle
    impostazioni».
    Tre era scritto nel codice, quindi cambiarlo voleva dire una pubblicazione.
    Adesso è un registro tenuto in memoria — come i blocchi della disponibilità
    (crm/blocchi.ts), e per lo stesso motivo: il calcolo degli slot è SINCRONO
    e deve restarlo, quindi non può aspettare una lettura dal database a ogni
    riga di calendario.
    Chi disegna disponibilità chiama prima `assicuraCapienza()` (crm/capienza),
    una volta per sessione; finché nessuno l'ha chiamata vale il predefinito,
    che è il comportamento di sempre.
    ⚠️ Questo file resta PURO: niente database, niente rete. È la condizione
     per poterlo provare senza aprire un browser, e la lettura sta di là. */
let capienza = CAPIENZA_PREDEFINITA;

/** Quante consulenze stanno nella stessa fascia, adesso. */
export function capienzaConsulenza(): number {
  return capienza;
}

/** La riga di `app_config` in cui il numero è scritto. Sta qui, accanto alla
 *  regola che lo usa, perché la leggono in due: il CRM (crm/capienza.ts) e il
 *  server della disponibilità (routes/api.crm.disponibilita.ts). */
export const CHIAVE_CAPIENZA = "crm_capienza_fascia";

/** Da quello che c'è scritto nella riga al numero.
 *  ⚠️ Una riga illeggibile, o scritta male, NON deve poter chiudere l'agenda:
 *   si torna al predefinito. Si accetta sia `{"capienza": 4}` sia il numero
 *   scritto da solo, che è la forma di chi lo scrive a mano. */
export function leggiCapienzaDaJson(testo: string | null | undefined): number {
  if (!testo) return CAPIENZA_PREDEFINITA;
  try {
    const parsed = JSON.parse(testo) as unknown;
    const grezzo =
      typeof parsed === "number"
        ? parsed
        : ((parsed as { capienza?: unknown } | null)?.capienza ?? null);
    const n = Math.round(Number(grezzo));
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : CAPIENZA_PREDEFINITA;
  } catch {
    return CAPIENZA_PREDEFINITA;
  }
}

/** Scrive il numero nel registro e restituisce quello davvero applicato.
 *
 *  ⚠️ Si accetta solo un intero fra 1 e 10, e fuori da lì si torna al
 *   predefinito: uno zero (o un campo svuotato) chiuderebbe l'agenda di tutti
 *   senza che nessuno capisca perché, e un numero enorme è un errore di
 *   battitura, non una scelta. */
export function impostaCapienza(n: unknown): number {
  const v = Math.round(Number(n));
  capienza = Number.isFinite(v) && v >= 1 && v <= 10 ? v : CAPIENZA_PREDEFINITA;
  return capienza;
}

interface Intervallo {
  inizio: number;
  fine: number;
  /** Di chi è questo impegno, quando si sa: serve solo a dirlo a chi guarda. */
  chi?: string;
  /** true = è una consulenza, e le consulenze si sommano fino alla capienza. */
  consulenza?: boolean;
}

function siSovrappone(a: Intervallo, b: Intervallo): boolean {
  return a.inizio < b.fine && a.fine > b.inizio;
}

function getFasceForDay(consultant: Consultant, dow: number): FasciaOraria[] {
  const overrides = consultant.data.fasceOrarieGiorno?.[dow];
  if (overrides && overrides.length > 0) return overrides;
  return consultant.data.fasceOrarie || [];
}

/** ── LE PAUSE HANNO DUE FORME NEL DATABASE ─────────────────────────────────
 *  Il tipo dichiara `Pausa[]`, ma nei dati veri convivono DUE forme:
 *   · un elenco, dove ogni pausa si porta dentro il proprio `giorno`;
 *   · un oggetto per giorno — { "1": [...], "2": [...] } — che è la forma
 *     prodotta dall'importazione del vecchio archivio (import-backup mette `{}`
 *     come valore predefinito).
 *  Dare per scontato l'elenco costava un `.filter is not a function` che
 *  abbatteva l'intera scheda del contatto, non solo l'agenda. Il server la
 *  distinzione la faceva già (api.crm.disponibilita): ora la fa anche qui, e
 *  questa è l'unica porta da cui le pause entrano nel calcolo degli orari.
 *  Esportata perché la griglia della squadra deve leggerle allo stesso modo:
 *  due letture diverse dello stesso campo erano già costate un pomeriggio in
 *  cui sopra c'erano "6 liberi" e sotto "4". */
export function pauseDelGiorno(consultant: Consultant, dow: number): Pausa[] {
  const grezzo = consultant.data.pause as unknown;
  if (Array.isArray(grezzo)) {
    return (grezzo as Pausa[]).filter((p) => p && p.giorno === dow);
  }
  if (grezzo && typeof grezzo === "object") {
    const delGiorno = (grezzo as Record<string, unknown>)[String(dow)];
    //  Nella forma a oggetto il giorno è la chiave: le voci dentro non hanno
    //  `giorno`, e filtrarle per quel campo le avrebbe fatte sparire tutte.
    return Array.isArray(delGiorno) ? (delGiorno as Pausa[]).filter(Boolean) : [];
  }
  return [];
}

function getPauseForDay(consultant: Consultant, dow: number): Pausa[] {
  return pauseDelGiorno(consultant, dow);
}

/** Una pausa è tempo in cui il consulente NON c'è, esattamente come
 *  un'indisponibilità: qui però veniva ignorata, e il CRM proponeva volentieri
 *  le 13:00 a chi la pausa se l'era messa in agenda apposta. La griglia della
 *  squadra le toglieva già (buildWorkMask): due conti diversi sullo stesso
 *  pomeriggio significavano "6 liberi" nel calendario e "4 liberi" sotto. */
function siSovrapponeAPausa(pause: Pausa[], fascia: Intervallo): boolean {
  return pause.some((p) => {
    const ps = minuti(p.inizio);
    const pe = minuti(p.fine);
    return ps !== null && pe !== null && siSovrappone(fascia, { inizio: ps, fine: pe });
  });
}

/** Quanto tempo per la strada tocca a QUESTA persona su QUESTA posa, in minuti.
 *  `null` = non la riguarda, e allora la fascia non si conta affatto.
 *
 *  ── IL MASSIMO, NON IL PRIMO CHE COMBACIA ─────────────────────────────────
 *  Una persona può avere più mestieri sulla stessa posa — chi ci va a posare può
 *  essere anche l'installatore, chi guida può esserlo anche lui — e ogni
 *  mestiere porta il suo margine (vedi le costanti in cima, che sono decisioni
 *  distinte del committente). Qui si prende il PIÙ LARGO fra quelli che la
 *  riguardano: fra due risposte diverse sullo stesso orario si tiene quella che
 *  toglie più tempo, che è la sola scelta che non manda due persone nello stesso
 *  posto alla stessa ora. Sommarli sarebbe l'errore opposto — cinque ore di
 *  strada per un viaggio solo — e prendere il primo trovato renderebbe il
 *  risultato dipendente dall'ordine delle righe qui sotto.
 *
 *  ⚠️ L'ACCOMPAGNATORE ENTRA QUI DENTRO, E NON IN UN CONTO SUO. È tutto il punto
 *  dell'agenda unica: chi va insieme all'installatore risulta occupato ESATTAMENTE
 *  come lui, con il suo margine di strada. Scritto altrove — o non scritto —
 *  sarebbe la persona che il CRM continua a dichiarare libera mentre è già sul
 *  furgone, e che qualcuno fisserebbe altrove per lo stesso pomeriggio.
 *
 *  ⚠️ STRADA_INSTALLATORE È IL PAVIMENTO E OGGI NON VINCE MAI, ED È VOLUTO.
 *  Chi è attaccato a una posa lo è come esecutore, come accompagnatore o come
 *  driver, quindi il massimo finisce sempre a 120 o a 180 e la mezz'ora resta
 *  sotto. Non è un numero morto: è la parte della regola che dice «una posa
 *  toglie SEMPRE almeno mezz'ora prima e mezz'ora dopo», ed è la sola che
 *  continuerà a valere il giorno in cui una posa porterà una persona che non è
 *  nessuno dei tre. Metterlo qui adesso costa una riga; scoprirlo mancante quel
 *  giorno costa un'agenda che dichiara libero chi è ancora sul furgone.
 *  ⚠️ E soprattutto: NON si è sostituito 120 con 30. Il pavimento si AGGIUNGE
 *  agli altri margini, non li corregge — vedi il blocco delle costanti. */
function margineStrada(inst: InstallazioneInfo | undefined, consultantId: string): number | null {
  if (!inst) return null;
  const posatore = inst.consulenteInstallazioneId === consultantId;
  //  Il campo può essere `null` (nessun driver) e l'id vuoto: senza questo
  //  controllo un consulente con id "" — che non esiste — combacerebbe con
  //  tutte le pose senza driver, e la sua agenda risulterebbe piena. Vale
  //  identico per l'accompagnatore, che è nullable per la stessa ragione.
  const driver = !!consultantId && inst.driverId === consultantId;
  const accompagnatore = !!consultantId && inst.accompagnatoreId === consultantId;
  if (!posatore && !driver && !accompagnatore) return null;
  return Math.max(
    STRADA_INSTALLATORE,
    posatore ? STRADA_POSATORE : 0,
    accompagnatore ? STRADA_ACCOMPAGNATORE : 0,
    driver ? STRADA_DRIVER : 0,
  );
}

/** La fascia che una posa toglie all'agenda di una persona: l'intervento più il
 *  tempo per la strada, prima e dopo. `null` = quella posa non la riguarda o non
 *  ha un orario (una pratica senza ora non occupa niente: occupa una riga
 *  nell'elenco «senza data», che è un altro problema). */
function fasciaDellaPosa(
  inst: InstallazioneInfo | undefined,
  consultantId: string,
): Intervallo | null {
  const margine = margineStrada(inst, consultantId);
  if (margine === null) return null;
  const inizio = minuti(inst?.orarioInstallazione);
  if (inizio === null) return null;
  const durata =
    inst?.durataInstallazione && inst.durataInstallazione > 0
      ? inst.durataInstallazione
      : DURATA_INSTALLAZIONE;
  //  L'inizio può finire prima della mezzanotte (una posa alle 08:00 con tre ore
  //  di strada): resta un numero negativo e va benissimo per il confronto fra
  //  intervalli, che è l'unica cosa che ci facciamo. Tagliarlo a zero
  //  restituirebbe tempo libero che non c'è.
  return { inizio: inizio - margine, fine: inizio + durata + margine };
}

/** ── E LO STESSO CONTO PER UN RITORNO ──────────────────────────────────────
 *  Gemello di `margineStrada`, e sta qui accanto apposta: un ritorno per la
 *  manutenzione può portarsi dietro fino a TRE persone — chi lo esegue, chi lo
 *  affianca e chi va a prendere il cliente — esattamente come una posa, e finché
 *  qui si leggeva il solo `consulenteId` le altre due risultavano libere mentre
 *  erano già impegnate. È lo stesso identico errore già corretto sulle pose,
 *  ripetuto su un altro tipo di appuntamento.
 *
 *  ⚠️ IL MASSIMO, come per la posa, e non la somma né il primo che combacia.
 *  Il pavimento è STRADA_MANUTENTORE: un ritorno toglie SEMPRE almeno mezz'ora
 *  prima e mezz'ora dopo a chiunque ci sia attaccato (vedi il blocco delle
 *  costanti, dove c'è scritto perché trenta e non centoventi).
 *  ⚠️ Chi guida e chi affianca tengono i LORO numeri: il margine è una proprietà
 *  del viaggio che fa quella persona, non dell'intervento. Chiederglielo più
 *  corto qui che sulle pose vorrebbe dire dichiarare libero, in questa
 *  schermata, un driver che ogni altra mostra in strada. */
function margineRitorno(m: AppuntamentoManutenzione, consultantId: string): number | null {
  //  Id vuoto = nessuno: senza questa guardia un consulente con id "" — che non
  //  esiste — combacerebbe con ogni ritorno senza driver e senza
  //  accompagnatore, e la sua agenda risulterebbe piena. Stessa prudenza di
  //  `margineStrada`, e per lo stesso motivo: i campi sono nullable.
  if (!consultantId) return null;
  const esegue = m.consulenteId === consultantId;
  const accompagnatore = m.accompagnatoreId === consultantId;
  const driver = m.driverId === consultantId;
  if (!esegue && !accompagnatore && !driver) return null;
  return Math.max(
    STRADA_MANUTENTORE,
    accompagnatore ? STRADA_ACCOMPAGNATORE : 0,
    driver ? STRADA_DRIVER : 0,
  );
}

/** La fascia che un ritorno toglie all'agenda di una persona: l'intervento più
 *  il suo margine, prima e dopo. `null` = quel ritorno non la riguarda o non ha
 *  un'ora — e un promemoria non ha un'ora, che è tutta la ragione per cui non
 *  occupa niente a nessuno (crm/types.ts).
 *  ⚠️ È l'UNICO posto in cui questa regola è scritta, come `fasciaDellaPosa` per
 *  le pose: la usano tutti e due i conti (gli orari del giorno e il carico del
 *  mese), o il mese dichiara libero un pomeriggio che il giorno mostra pieno. */
function fasciaDelRitorno(m: AppuntamentoManutenzione, consultantId: string): Intervallo | null {
  const margine = margineRitorno(m, consultantId);
  if (margine === null) return null;
  const inizio = minuti(m.ora);
  if (inizio === null) return null;
  const durata = m.durata && m.durata > 0 ? m.durata : DURATA_MANUTENZIONE;
  return { inizio: inizio - margine, fine: inizio + durata + margine };
}

function isSlotBlocked(
  consultant: Consultant,
  date: string,
  slot: string,
  duration: number,
): boolean {
  const ind = consultant.data.indisponibilita || [];
  const dayInd = ind.filter((x) => x.data === date);
  if (dayInd.length === 0) return false;
  const start = minuti(slot);
  if (start === null) return false;
  const fascia: Intervallo = { inizio: start, fine: start + duration };
  for (const i of dayInd) {
    if (!i.inizio && !i.fine) return true; // tutto il giorno
    const iStart = minuti(i.inizio);
    const iEnd = minuti(i.fine);
    if (iStart !== null && iEnd !== null && siSovrappone(fascia, { inizio: iStart, fine: iEnd })) {
      return true;
    }
  }
  return false;
}

function generateSlotsForDay(consultant: Consultant, date: string, duration: number): string[] {
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return [];
  const dow = d.getDay();
  if (!consultant.data.giorniLavorativi.includes(dow)) return [];
  const fasce = getFasceForDay(consultant, dow);
  const pause = getPauseForDay(consultant, dow);
  const out: string[] = [];
  fasce.forEach((f) => {
    const [sh, sm] = f.inizio.split(":").map(Number);
    const [eh, em] = f.fine.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + duration <= end) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      const s = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (
        !siSovrapponeAPausa(pause, { inizio: cur, fine: cur + duration }) &&
        !isSlotBlocked(consultant, date, s, duration)
      ) {
        out.push(s);
      }
      cur += duration;
    }
  });
  //  Fasce scritte in disordine (pomeriggio prima del mattino) uscivano in
  //  disordine, e chi legge "il primo orario libero" prendeva il primo della
  //  lista, non il primo della giornata.
  return out.sort();
}

/** Il tempo già impegnato, come INTERVALLI e non come singoli orari.
 *
 *  Prima si segnava occupato solo l'orario esatto di inizio: un meeting delle
 *  09:00 lungo un'ora lasciava libere le 09:30, e il CRM proponeva di fissarci
 *  sopra un secondo appuntamento. La sovrapposizione si scopriva il giorno
 *  stesso, con due persone in attesa. Qui si tiene conto della durata reale
 *  (meeting, visita in sede, installazione), con i valori di ripiego dichiarati
 *  in cima al file quando la scheda non la specifica. */
function getBusyIntervals(
  consultantId: string,
  date: string,
  allLeads: Lead[],
  excludeLeadId?: string,
  escludiManutenzioneId?: string,
): Intervallo[] {
  const busy: Intervallo[] = [];
  const aggiungi = (
    ora: string | undefined,
    durata: number | undefined,
    fallback: number,
    chi?: string,
    consulenza?: boolean,
  ) => {
    const inizio = minuti(ora);
    if (inizio === null) return;
    busy.push({
      inizio,
      fine: inizio + (durata && durata > 0 ? durata : fallback),
      chi,
      consulenza,
    });
  };

  for (const l of allLeads) {
    if (l.id === excludeLeadId) continue;
    const d = l.data;
    //  ⚠️ Un appuntamento saltato o annullato non tiene più il suo posto: la
    //   data resta sulla scheda (è la memoria di quando doveva essere) ma non
    //   è più un impegno. Vedi `tieneLoSlot` qui sopra — la regola sta lì, e
    //   non vale per pose e manutenzioni, che hanno uno stato loro.
    const vivo = tieneLoSlot(d.stato);
    if (vivo && d.consulenteId === consultantId && d.dataMeeting === date) {
      //  ⚠️ `true`: la consulenza è l'UNICO impegno che si somma — fino a tre
      //   persone nella stessa fascia (vedi capienzaConsulenza()). La visita in
      //   sede qui sotto no: quella è una persona in carne e ossa davanti a te.
      aggiungi(
        d.oraMeeting,
        d.durataMeeting,
        DURATA_MEETING,
        `${d.nome || ""} ${d.cognome || ""}`.trim(),
        true,
      );
    }
    if (vivo && d.consulenteId === consultantId && d.dataVieneInSede === date) {
      aggiungi(
        d.oraVieneInSede,
        d.durataVieneInSede,
        DURATA_SEDE,
        `${d.nome || ""} ${d.cognome || ""}`.trim(),
      );
    }
    //  Installazioni: vale il consulente scritto sulla POSA (che può non essere
    //  quello del lead) e, con lo stesso peso, chi lo affianca sul lavoro e chi
    //  lo porta. La fascia comprende il tempo per la strada — vedi
    //  fasciaDellaPosa, che è l'unico posto in cui questa regola è scritta.
    const inst = d.installazione;
    if (inst?.dataInstallazione === date) {
      const fascia = fasciaDellaPosa(inst, consultantId);
      if (fascia) busy.push(fascia);
    }
    //  ── I RITORNI PER LA MANUTENZIONE ────────────────────────────────────
    //   Solo quelli FISSATI: un promemoria è una data attesa, non ha un'ora e
    //   non deve togliere niente a nessuno — è tutta la ragione per cui i due
    //   stati sono distinti (crm/types.ts). E si guardano i nomi scritti sulla
    //   RIGA, non quello del lead: la manutenzione la fa chi la esegue, che
    //   spesso non è il consulente della trattativa.
    //   ⚠️ Le persone attaccate a un ritorno sono TRE, non una — chi lo esegue,
    //   chi lo affianca e chi va a prendere il cliente — e la fascia di
    //   ciascuna la calcola `fasciaDelRitorno`, che è l'unico posto in cui
    //   questa regola è scritta. Leggere qui il solo `consulenteId`, com'era
    //   prima, lasciava liberi in agenda gli altri due.
    for (const m of manutenzioniDi(d)) {
      if (m.stato !== "fissata" || m.data !== date) continue;
      //  L'appuntamento che si sta SPOSTANDO non si dichiara occupato da sé:
      //  senza questa riga, riaprirlo per cambiargli ora farebbe sparire
      //  proprio l'ora che ha adesso, e la finestra sembrerebbe dire che il
      //  posto se l'è preso qualcun altro.
      if (escludiManutenzioneId && m.id === escludiManutenzioneId) continue;
      const fascia = fasciaDelRitorno(m, consultantId);
      if (fascia) busy.push(fascia);
    }
  }
  return busy;
}

/** ── ⚠️ TUTTI GLI ORARI, NON SOLO I LIBERI ────────────────────────────────
 *
 *  Richiesta del committente: «quando uno slot è prenotato deve essere
 *  contrassegnato in rosso; deve restare selezionabile; e il rosso deve tenere
 *  conto della DURATA della prenotazione — una consulenza dalle 15:00 alle
 *  16:30 tiene occupati anche gli slot in mezzo, e solo dopo le 16:30 si torna
 *  liberi».
 *
 *  Finora un orario preso veniva TOLTO dall'elenco, e chi guardava non poteva
 *  distinguere due cose che si decidono in modo opposto: «a quell'ora non si
 *  lavora» e «a quell'ora c'è già un cliente». Sulla prima non c'è niente da
 *  fare; sulla seconda si chiama il collega, si accorcia, o si accavalla
 *  sapendo cosa si sta facendo.
 *
 *  Il rosso segue la durata perché la sovrapposizione si calcola fra DUE
 *  intervalli — quello che si sta fissando e quello già preso — e non fra due
 *  orari di inizio. È la stessa regola che decide `libero`, scritta una volta
 *  sola in `siSovrappone`.
 */
export interface SlotConStato {
  ora: string;
  libero: boolean;
  /** Chi tiene occupato l'orario, quando si sa. */
  chi?: string;
  /** Fino a che ora, in formato HH:MM: è l'informazione che fa decidere. */
  fino?: string;
  /** Quante consulenze ci sono già dentro questa fascia (il «2» di «2/3»). */
  presi: number;
  /** Quante ce ne stanno in tutto (il «3»). */
  capienza: number;
  /** ── COM'È MESSA, IN UNA PAROLA ──────────────────────────────────────
   *  libero · insieme (c'è qualcuno alla stessa ora, e c'è posto) · pieno ·
   *  coperto (una consulenza di un ALTRO orario ci passa sopra, o è una pausa).
   *  Le quattro le decide `statoDellaFascia` in crm/fascia-consulenza, ed è
   *  l'unica regola: le schermate dipingono, non ricalcolano. */
  stato: StatoSlot;
  /** Se è coperto: l'ora di ciò che lo copre («coperto da quella delle 9:45»). */
  copertoDa?: string;
}

const oraDaMinuti = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** ── ⚠️ QUANTA GENTE C'È IN QUESTA FASCIA, E SE CE NE STA ANCORA ──────────
 *  Una sola funzione risponde, e da lei passano TUTTE le schermate: la griglia
 *  del giorno, l'elenco degli orari liberi, il carico del mese e il «primo
 *  orario libero». Scriverla due volte è il modo in cui due schermate
 *  finiscono per dire il contrario sullo stesso pomeriggio — ed è successo
 *  davvero, con `dataMeeting` marcata da una parte sola.
 *
 *  Le regole, in ordine:
 *   · un impegno ESCLUSIVO che tocca la fascia (posa, ritorno, visita in sede)
 *     la chiude e basta: non si somma niente, non c'è capienza che tenga;
 *   · le consulenze si contano; finché sono meno della capienza la fascia
 *     resta scegliebile, e il contatore dice a che punto siamo;
 *   · `fino` è la fine PIÙ LONTANA fra quelle che la toccano, perché è
 *     l'orario in cui la fascia torna davvero libera — non quella della prima. */
function capienzaDellaFascia(fascia: Intervallo, occupati: Intervallo[], modo?: ModoFascia) {
  /*  ── ⚠️ IL CONTO NON SI FA PIÙ QUI ────────────────────────────────────
      La regola sta in `crm/fascia-consulenza` (`statoDellaFascia`), dov'è
      provata, e la usano sia questa schermata sia il server
      (api.crm.disponibilita). Finché erano due conti scritti in due posti,
      due schermate dicevano cose diverse sullo stesso pomeriggio — ed è
      successo davvero.
      Qui resta solo la traduzione fra le due forme: gli intervalli di questo
      file (minuti `inizio`/`fine`) e quelli della regola (`da`/`a`). */
  const e = statoDellaFascia({
    inizio: fascia.inizio,
    durata: fascia.fine - fascia.inizio,
    //  ⚠️ `consulenza === true`, non `!== false`: in questo file gli impegni
    //   ESCLUSIVI (posa, ritorno, visita in sede) non scrivono il campo, e
    //   `undefined !== false` li avrebbe fatti passare per consulenze — cioè
    //   una posa sarebbe diventata «1 di 3, c'è ancora posto». Le due prove
    //   che lo dicono sono già in archivio, e questa riga le ha fatte urlare.
    occupati: occupati.map((o) => ({
      da: o.inizio,
      a: o.fine,
      chi: o.chi,
      consulenza: o.consulenza === true,
    })),
    modo,
    capienza: capienzaConsulenza(),
  });
  return {
    libero: slotScegliibile(e),
    stato: e.stato,
    presi: e.presi,
    capienza: e.posti,
    chi: e.chi || undefined,
    fino: e.fino != null ? oraDaMinuti(e.fino) : undefined,
    copertoDa: e.copertoDa != null ? oraDaMinuti(e.copertoDa) : undefined,
  };
}

export function slotDelGiorno(
  consultant: Consultant,
  date: string,
  duration: number,
  allLeads: Lead[],
  excludeLeadId?: string,
  escludiManutenzioneId?: string,
  /** ── ⚠️ IL MODO DI OGNI FASCIA, «HH:MM» → solo/aperta ─────────────────
   *  Senza, questo motore userebbe la capienza generale per TUTTE le fasce, e
   *  un'ora tenuta per una persona sola direbbe «1/3, c'è posto». È il motivo
   *  per cui la stessa ora si leggeva in due modi a seconda della schermata:
   *  il server lo sapeva, il browser no. Chi ha l'elenco lo passa (lo dà
   *  `api/crm/disponibilita`); chi non ce l'ha resta com'era. */
  modi?: Map<string, ModoFascia> | Record<string, ModoFascia> | null,
): SlotConStato[] {
  const tutti = generateSlotsForDay(consultant, date, duration);
  if (tutti.length === 0) return [];
  const modoDi = (ora: string): ModoFascia | undefined =>
    !modi ? undefined : modi instanceof Map ? modi.get(ora) : modi[ora];
  const occupati = getBusyIntervals(
    consultant.id,
    date,
    allLeads,
    excludeLeadId,
    escludiManutenzioneId,
  );
  return tutti.map((ora) => {
    const inizio = minuti(ora);
    //  Un'ora illeggibile non si offre e si dice perché: «coperto» è lo stato
    //  che il resto della schermata sa già disegnare (sbarrato, non cliccabile).
    if (inizio === null)
      return {
        ora,
        libero: false,
        presi: 0,
        capienza: capienzaConsulenza(),
        stato: "coperto" as StatoSlot,
      };
    return {
      ora,
      ...capienzaDellaFascia({ inizio, fine: inizio + duration }, occupati, modoDi(ora)),
    };
  });
}

/** ── QUANTE PERSONE HAI GIÀ IN CIASCUN ORARIO ─────────────────────────────
 *  La mappa «ora → quante consulenze ci sono già dentro», per le schermate che
 *  lavorano con un elenco di orari e non con gli slot interi (la fila di orari
 *  da offrire, nell'agenda). Non è un secondo conto: è `slotDelGiorno`, letto
 *  in un'altra forma. */
export function presiPerOra(
  consultant: Consultant,
  date: string,
  duration: number,
  allLeads: Lead[],
  excludeLeadId?: string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of slotDelGiorno(consultant, date, duration, allLeads, excludeLeadId))
    out.set(s.ora, s.presi);
  return out;
}

/** I modi di un solo giorno, da una mappa che li ha tutti («AAAA-MM-GG HH:MM»).
 *  ⚠️ Chi non passa niente resta com'era: nessuna schermata è obbligata a
 *   conoscere i modi per funzionare. */
function modiDelGiorno(
  modi: Map<string, ModoFascia> | Record<string, ModoFascia> | null | undefined,
  giorno: string,
): Map<string, ModoFascia> | undefined {
  if (!modi) return undefined;
  const voci: [string, ModoFascia][] =
    modi instanceof Map ? [...modi.entries()] : Object.entries(modi);
  const out = new Map<string, ModoFascia>();
  for (const [chiave, modo] of voci) {
    const [g, ora] = String(chiave).split(" ");
    if (g === giorno && ora) out.set(ora, modo);
  }
  return out.size ? out : undefined;
}

/** Filtra gli orari che non toccano nessun impegno già preso. */
function scartaOccupati(
  slots: string[],
  duration: number,
  occupati: Intervallo[],
  modi?: Map<string, ModoFascia>,
): string[] {
  if (occupati.length === 0 && !modi?.size) return slots;
  return slots.filter((s) => {
    const inizio = minuti(s);
    if (inizio === null) return false;
    //  ⚠️ Stessa regola della griglia, e non una copia: una fascia con una
    //   consulenza dentro ha ancora posto, e va CONTATA fra le libere — se no
    //   il calendario mostra pieno un giorno che la griglia mostra aperto.
    return capienzaDellaFascia({ inizio, fine: inizio + duration }, occupati, modi?.get(s)).libero;
  });
}

// Calcola gli slot LIBERI per un singolo giorno specifico (anche se 0).
// A differenza di `generateAvailability`, non scarta i giorni vuoti.
export function getFreeSlotsForDate(
  consultant: Consultant,
  date: string,
  duration: number,
  allLeads: Lead[],
  excludeLeadId?: string,
): string[] {
  const slots = generateSlotsForDay(consultant, date, duration);
  if (slots.length === 0) return [];
  return scartaOccupati(
    slots,
    duration,
    getBusyIntervals(consultant.id, date, allLeads, excludeLeadId),
  );
}

/** ── QUESTA PERSONA È LIBERA IN QUESTA FASCIA? ─────────────────────────────
 *  Non «ci sono slot liberi quel giorno», ma «può stare QUI, da quest'ora, per
 *  tanto». È la domanda che si fa scegliendo il driver e l'accompagnatore:
 *  l'orario è già stato deciso sull'agenda di chi esegue, e degli altri due si
 *  vuole solo sapere se in quella fascia sono liberi.
 *
 *  Le regole sono le STESSE degli orari liberi — giorno lavorativo, fasce,
 *  pause, indisponibilità, impegni già presi — perché una seconda regola
 *  scritta a parte è esattamente il modo in cui due schermate finiscono per
 *  dire il contrario sullo stesso pomeriggio.
 *
 *  `margine` è il tempo per la strada da aggiungere prima e dopo (STRADA_DRIVER
 *  per chi guida, STRADA_ACCOMPAGNATORE per chi affianca). Si conta solo sugli
 *  IMPEGNI: pretendere che stiano dentro
 *  l'orario di lavoro anche le tre ore di viaggio significherebbe non trovare
 *  mai nessuno libero per una posa del mattino.
 *
 *  ⚠️ `escludiManutenzioneId` è la stessa cosa che `generateAvailability` accetta
 *  già, e serve qui per la stessa ragione: quando si SPOSTA un ritorno, le
 *  persone che ci sono già sopra devono restare scegliibili. Senza, riaprire un
 *  ritorno per cambiargli ora mostrerebbe il suo accompagnatore come occupato —
 *  occupato da quello stesso ritorno — e non lo si potrebbe più confermare.
 *  ⚠️ E NON si usa `excludeLeadId` al suo posto: quella scorciatoia toglie di
 *  mezzo la trattativa INTERA, cioè anche il meeting e la posa dello stesso
 *  cliente, che invece devono continuare a contare. */
export function liberoNellaFascia(
  consultant: Consultant,
  date: string,
  ora: string,
  durata: number,
  allLeads: Lead[],
  margine = 0,
  excludeLeadId?: string,
  escludiManutenzioneId?: string,
): boolean {
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const dow = d.getDay();
  if (!consultant.data.giorniLavorativi.includes(dow)) return false;
  const inizio = minuti(ora);
  if (inizio === null || !(durata > 0)) return false;
  const fascia: Intervallo = { inizio, fine: inizio + durata };

  //  L'intervento deve stare DENTRO una fascia di lavoro: a cavallo di una
  //  chiusura non è "quasi dentro", è fuori.
  const dentroOrario = getFasceForDay(consultant, dow).some((f) => {
    const fi = minuti(f.inizio);
    const ff = minuti(f.fine);
    return fi !== null && ff !== null && fascia.inizio >= fi && fascia.fine <= ff;
  });
  if (!dentroOrario) return false;
  if (siSovrapponeAPausa(getPauseForDay(consultant, dow), fascia)) return false;
  if (isSlotBlocked(consultant, date, ora, durata)) return false;

  const allargata: Intervallo = { inizio: inizio - margine, fine: inizio + durata + margine };
  return !getBusyIntervals(
    consultant.id,
    date,
    allLeads,
    excludeLeadId,
    escludiManutenzioneId,
  ).some((o) => siSovrappone(allargata, o));
}

/** Il tempo occupato di un consulente, indicizzato per data in una passata
 *  sola. Il calendario mensile chiede quarantadue giorni insieme: chiedendoli
 *  uno per uno si scorreva l'elenco delle trattative quarantadue volte. */
function indicizzaOccupato(
  consultantId: string,
  allLeads: Lead[],
  excludeLeadId?: string,
): Map<string, Intervallo[]> {
  const per = new Map<string, Intervallo[]>();
  const aggiungi = (
    data: string | undefined,
    ora: string | undefined,
    durata: number | undefined,
    fallback: number,
    consulenza?: boolean,
  ) => {
    if (!data) return;
    const inizio = minuti(ora);
    if (inizio === null) return;
    const riga = per.get(data);
    const int: Intervallo = {
      inizio,
      fine: inizio + (durata && durata > 0 ? durata : fallback),
      consulenza,
    };
    if (riga) riga.push(int);
    else per.set(data, [int]);
  };

  for (const l of allLeads) {
    if (l.id === excludeLeadId) continue;
    const d = l.data;
    if (d.consulenteId === consultantId) {
      //  ⚠️ Marcata come consulenza anche qui: il calendario del mese e la
      //   griglia del giorno devono dire la STESSA cosa, e se la capienza
      //   valesse solo di là un giorno risulterebbe pieno in una schermata e
      //   con posti liberi nell'altra.
      aggiungi(d.dataMeeting, d.oraMeeting, d.durataMeeting, DURATA_MEETING, true);
      aggiungi(d.dataVieneInSede, d.oraVieneInSede, d.durataVieneInSede, DURATA_SEDE);
    }
    //  Stessa regola dell'altro conto (getBusyIntervals): posatore,
    //  accompagnatore e driver, con il tempo per la strada dentro la fascia. Le
    //  due funzioni devono dire la
    //  stessa cosa — una riempie il calendario del mese, l'altra gli orari del
    //  giorno — e per questo la fascia la calcola una funzione sola.
    const inst = d.installazione;
    const fascia = inst?.dataInstallazione ? fasciaDellaPosa(inst, consultantId) : null;
    if (fascia && inst?.dataInstallazione) {
      const riga = per.get(inst.dataInstallazione);
      if (riga) riga.push(fascia);
      else per.set(inst.dataInstallazione, [fascia]);
    }
    //  Le manutenzioni fissate, con la stessa regola dell'altro conto: solo
    //  "fissata", e la fascia la calcola `fasciaDelRitorno` — chi esegue, chi
    //  affianca e chi porta, ciascuno col suo margine. Il calendario del mese e
    //  gli orari del giorno devono dire la stessa cosa, o il mese dichiara
    //  libero un pomeriggio che il giorno mostra pieno.
    for (const m of manutenzioniDi(d)) {
      if (m.stato !== "fissata" || !m.data) continue;
      const fascia = fasciaDelRitorno(m, consultantId);
      if (!fascia) continue;
      const riga = per.get(m.data);
      if (riga) riga.push(fascia);
      else per.set(m.data, [fascia]);
    }
  }
  return per;
}

/** Il carico di un elenco di giorni, in un colpo solo.
 *
 *  È la misura che il calendario mensile disegna come barra di riempimento: gli
 *  slot lavorabili sono la lunghezza della barra, quelli già consumati la parte
 *  piena. Un impegno fuori dalle fasce di lavoro non compare nel conto (non
 *  toglie capienza a nessuno slot esistente) ma resta visibile nel pannello del
 *  giorno, dove va guardato. */
export function caricoGiorni(
  consultant: Consultant,
  duration: number,
  allLeads: Lead[],
  dates: string[],
): Map<string, CaricoGiorno> {
  const occupato = indicizzaOccupato(consultant.id, allLeads);
  const out = new Map<string, CaricoGiorno>();
  for (const date of dates) {
    const d = new Date(date + "T00:00:00");
    const lavorativo = Number.isNaN(d.getTime())
      ? false
      : consultant.data.giorniLavorativi.includes(d.getDay());
    const totali = generateSlotsForDay(consultant, date, duration);
    const liberi = scartaOccupati(totali, duration, occupato.get(date) ?? []);
    const occupati = totali.length - liberi.length;
    out.set(date, {
      date,
      lavorativo,
      totali: totali.length,
      liberi: liberi.length,
      occupati,
      carico: totali.length > 0 ? occupati / totali.length : 0,
    });
  }
  return out;
}

/** Il primo orario prenotabile da adesso in avanti.
 *
 *  `generateAvailability(...)[0]` non basta: restituisce anche le 09:00 di oggi
 *  quando sono le 16, e "prossimo libero: 09:00" mentre si è al telefono con
 *  qualcuno è un'informazione che fa fissare un appuntamento nel passato. */
export function prossimoSlotLibero(
  consultant: Consultant,
  duration: number,
  allLeads: Lead[],
  adesso: Date = new Date(),
  giorniAvanti = 60,
): SlotProssimo | null {
  //  L'indice degli impegni si costruisce una volta per tutti i sessanta
  //  giorni: chiedendo la disponibilità giorno per giorno si scorrerebbe
  //  l'elenco delle trattative sessanta volte per un solo orario.
  const occupato = indicizzaOccupato(consultant.id, allLeads);
  const oggi = isoLocale(adesso);
  const minutiAdesso = adesso.getHours() * 60 + adesso.getMinutes();
  const partenza = new Date(adesso);
  partenza.setHours(0, 0, 0, 0);

  for (let i = 0; i < giorniAvanti; i++) {
    const d = new Date(partenza);
    d.setDate(partenza.getDate() + i);
    const date = isoLocale(d);
    const liberi = scartaOccupati(
      generateSlotsForDay(consultant, date, duration),
      duration,
      occupato.get(date) ?? [],
    );
    for (const ora of liberi) {
      if (date === oggi) {
        const m = minuti(ora);
        if (m !== null && m < minutiAdesso) continue;
      }
      return { date, ora, label: formatDayLabel(d) };
    }
  }
  return null;
}

/** Genera N giorni a partire da `fromDate` (default oggi) per il consulente.
 *
 *  ⚠️ I DUE «ESCLUDI» NON SONO LA STESSA COSA, e confonderli costa uno slot
 *  venduto due volte:
 *   · `excludeLeadId` toglie di mezzo TUTTA la trattativa — serve a
 *     riprogrammare un meeting o una posa senza che l'appuntamento in corso di
 *     spostamento si dichiari occupato da sé;
 *   · `escludiManutenzioneId` toglie UNA riga sola, quella manutenzione lì.
 *     Serve alla finestra della manutenzione, che deve poter spostare un
 *     ritorno senza escludere anche il meeting e la posa dello stesso cliente:
 *     una manutenzione non può accavallarsi nemmeno agli altri appuntamenti di
 *     chi la fa. */
export function generateAvailability(
  consultant: Consultant,
  duration: number,
  allLeads: Lead[],
  daysAhead = 14,
  fromDate?: string,
  excludeLeadId?: string,
  escludiManutenzioneId?: string,
  /** ── ⚠️ LE ORE TENUTE PER UNA PERSONA SOLA ───────────────────────────
   *  Segnalazione del committente: «clicco la spunta che vuole stare solo, ma
   *  l'orario continua a essere disponibile per 3».
   *  Succedeva qui: questa funzione non ha mai saputo niente dei modi, e le
   *  schermate che la usano — la griglia della squadra, lo spostamento rapido
   *  — leggevano quindi la capienza generale su un'ora che ne ha UNO. La
   *  spunta scriveva davvero in archivio (il server la fa rispettare anche al
   *  cliente che si prenota dal link), ma dal gestionale non si vedeva.
   *  La chiave è `AAAA-MM-GG HH:MM`: lo stesso elenco serve quattordici giorni
   *  in un colpo, e una mappa per giorno sarebbe una mappa di mappe da
   *  ricostruire a ogni riga. */
  modi?: Map<string, ModoFascia> | Record<string, ModoFascia> | null,
): DaySlots[] {
  const start = fromDate ? new Date(fromDate + "T00:00:00") : new Date();
  start.setHours(0, 0, 0, 0);
  const result: DaySlots[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = isoLocale(d);
    const slots = generateSlotsForDay(consultant, date, duration);
    if (slots.length === 0) continue;
    const free = scartaOccupati(
      slots,
      duration,
      getBusyIntervals(consultant.id, date, allLeads, excludeLeadId, escludiManutenzioneId),
      //  ⚠️ Un'ora tenuta per una persona sola, con quella persona dentro, è
      //   PIENA: senza questa riga restava fra quelle «libere» e la si poteva
      //   offrire a un secondo cliente — cioè la spunta non serviva a niente.
      modiDelGiorno(modi, date),
    );
    if (free.length === 0) continue;
    result.push({
      date,
      label: formatDayLabel(d),
      dow: d.getDay(),
      slots: free,
      /*  ── ⚠️ E ANCHE COM'È MESSA OGNI ORA, NON SOLO QUALI SONO LIBERE ──
          Segnalazione del committente: spostando una consulenza «non mi dà gli
          slot 1/3 2/3 sugli orari».
          Questa funzione restituiva solo l'elenco delle ore libere, come
          testo: chi la usava — lo spostamento rapido, la scheda cliente — non
          poteva disegnare né il contatore né lo sbarrato, poteva solo mostrare
          o nascondere. Adesso porta con sé lo stato di TUTTE le ore del
          giorno, comprese quelle che non si possono scegliere: un'ora che
          sparisce fa venire il dubbio che manchi per un errore del
          programma. */
      //  I modi di QUESTO giorno, nella forma che `slotDelGiorno` si aspetta
      //  («HH:MM» → modo): si ritagliano dalla mappa di tutti i giorni.
      ore: slotDelGiorno(
        consultant,
        date,
        duration,
        allLeads,
        excludeLeadId,
        escludiManutenzioneId,
        modiDelGiorno(modi, date),
      ),
    });
  }
  return result;
}
