import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
//  Il riquadro delle note esce dai contenitori con `overflow-hidden` della
//  lista: senza portale verrebbe tagliato dagli angoli arrotondati.
import { createPortal } from "react-dom";
import { useCRM } from "@/crm/CRMContext";
import { useAuth } from "@/crm/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Finestra, Foglio, Pannello } from "@/crm/ui/Finestra";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LEAD_STATUS_LABEL,
  SELECTABLE_LEAD_STATUSES,
  //  Il criterio di "consulenza svolta" non si riscrive qui: sta in crm/types e
  //  lo usano anche l'agenda e i totali del giorno.
  eStatoNonSvolta,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "@/crm/types";
//  Pastiglia di stato, colori dell'esito e filtri a segmento arrivano dal
//  linguaggio comune (crm/ui): lo stesso lead deve avere lo stesso
//  aspetto qui, nell'agenda e nella ricerca ⌘K.
//
//  LA PROSSIMA AZIONE E IL SUO ORDINE ARRIVANO DA LÌ ANCHE LORO. Questa pagina
//  se n'era scritta una copia: calcolava la stessa frase ma senza il numero di
//  urgenza, e ordinava per DISTANZA da oggi — così un appuntamento fra tre
//  giorni e uno scaduto da tre finivano fianco a fianco, quando invece il primo
//  può aspettare e il secondo sta facendo perdere il lead. Ora la regola
//  è una sola per tutto il CRM: prossimaAzione() dice cosa fare,
//  ordinaPerUrgenza() mette in cima chi va sentito prima.
import {
  CLASSE_BADGE_STATO,
  LENTI_ESITO,
  Segmento,
  TONO_AZIONE,
  classiStato,
  dataBreve,
  etichettaQuando,
  eur,
  normalizza,
  trovaNelLead,
  ordinaPerUrgenza,
  dettoIlInChiaro,
  prossimaAzione,
  soloCifre,
  soloData,
  type ChiaveEsito,
  BarraSelezione,
  CLASSE_AZIONE_BARRA,
} from "@/crm/ui";
import { useConsulente } from "@/crm/consulente-sessione";
import { LeadDialog } from "@/crm/LeadDialog";
/*  I DUE GESTI CHE NON DEVONO COSTARE UN'APERTURA DI SCHEDA.
 *  · `avviaConsulenza` apre (o riusa) la stanza di QUELL'appuntamento, ci mette
 *    il consulente e porta con sé i dati del lead: il preventivo nasce già
 *    intestato. Si importa e non si riscrive — due modi di avviare una
 *    consulenza sono due stanze diverse per lo stesso appuntamento, con il
 *    consulente in una e il cliente nell'altra.
 *  · `InstallationScheduleDialog` è la procedura guidata della posa: si monta e
 *    basta, il file è di un altro. */
//  `esitoContato` è la stessa funzione con cui l'agenda decide se un
//  appuntamento è svolto, assente o da riprogrammare: la lente «Svolte» di
//  questa pagina e il totale del giorno devono contare con lo stesso metro.
import { avviaConsulenza, esitoContato } from "@/crm/MeetGiornalieri";
import { InstallationScheduleDialog } from "@/crm/InstallationScheduleDialog";
//  Le consulenze le fanno solo i consulenti, e chi lo sia lo dice un file solo:
//  qui dentro ci sono QUATTRO elenchi di nomi, e riscrivere il filtro in ognuno
//  vorrebbe dire quattro occasioni di divergere.
import {
  NotaSoloConsulenti,
  TESTO_SOLO_CONSULENTI,
  consulentiPerConsulenza,
} from "@/crm/chi-fa-la-consulenza";
//  «Ha già pagato» si decide in un punto solo in tutto il CRM (stato acconto,
//  stato venduto, o un acconto incassato su una scheda importata): riscrivere
//  qui la condizione significherebbe un tasto che compare nell'elenco e non
//  nella scheda, o viceversa.
import { trattativaVinta } from "@/crm/SchedaCliente";
import { PulsantePreventivi } from "@/crm/preventivi/DelLead";
import { PulsanteFatture } from "@/crm/fatture/DelLead";
import { PulsanteInvitaAlWebinar } from "@/webinar/InvitoDaLead";
import { FumettoStato } from "@/crm/FumettoStato";
import {
  DialogoCompimento,
  QuickStatusDialog,
  apreProceduraQuando,
  compimentoDi,
  passoOvvioDi,
  requiresAnyDialog,
} from "@/crm/QuickStatusDialog";
import { SelettoreStatoDialog } from "@/crm/SelettoreStatoDialog";
import { AvvisoExtra, richiedeChiusura, useChiusura } from "@/crm/ChiusuraDialog";
import { DateRangeFilter, type DateRange } from "@/crm/DateRangeFilter";
import { computeAllPresetDeltas, type RangeDeltaPoint } from "@/crm/range-delta";
import { leadAttributionDate, leadIsConverted, leadRevenue } from "@/crm/lead-analytics";
import { buildWhatsAppLink, getWhatsAppMessageForStatus } from "@/crm/whatsapp";
import { useStickyShadow } from "@/hooks/use-sticky-topbar";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarRange,
  Check,
  ChevronDown,
  Download,
  Keyboard,
  ListChecks,
  MessageCircle,
  Pencil,
  Phone,
  PhoneIncoming,
  PhoneCall,
  Plus,
  Route as RouteIcona,
  Search,
  SlidersHorizontal,
  Star,
  StickyNote,
  Trash2,
  Upload,
  UserRound,
  Video,
  Wrench,
  X,
} from "lucide-react";

//  Il cartellino della priorità: lo stesso dell'elenco delle installazioni.
import { SegnoPriorita } from "@/crm/PrioritaPosa";

export const Route = createFileRoute("/CRM/trattative")({
  component: LeadsPage,
});

/* ═══════════════════════════════════════════════════════════════════════════
   ELENCO LEAD — la pagina che si guarda tutto il giorno.

   La domanda a cui questa schermata risponde è una sola: «chi devo sentire
   adesso, e a che punto siamo». Tutto il resto (importi, tracking, note,
   qualifica) è consultazione: sta nel pannello a destra, si apre in un clic e
   non occupa spazio finché non serve.

   Perciò la riga porta quattro informazioni e basta:
     nome · stato · prossima azione · consulente.
   Con ottocentocinquanta lead, ogni colonna in più è una colonna che si legge
   ottocentocinquanta volte.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── I GRUPPI: OGNI SCHEDA È UN MOMENTO DI LAVORO ───────────────────────────
//  Un elenco unico non è consultabile. I gruppi non sono categorie astratte:
//  sono i momenti della giornata in cui si aprono.
//
//  ⚠️ IL GRUPPO «IMPORTATI» NON STA PIÙ QUI, ED È UNA RICHIESTA DEL COMMITTENTE.
//  Una lista appena caricata si lavora al telefono, un lead avviato si lavora in
//  consulenza: sono due mestieri, e tenerli nella stessa schermata obbligava
//  questa pagina a parlare due vocabolari di stati che non si dovevano mai
//  incontrare. Le liste hanno adesso una casa loro — «Lead importati»,
//  /CRM/avanzamento — dove si caricano, si chiamano e si segnano.
//  NESSUNA SCHEDA È SPARITA DA QUI: i lead importati restano dentro «Tutte» e
//  si isolano con il filtro «Da dove viene → Da una lista importata», che è
//  rimasto dov'era. Quello che se n'è andato è il GRUPPO, non i lead.
type Gruppo = "attivi" | "ricontattare" | "gia_presenti" | "annullati" | "conclusi" | "tutte";

const GRUPPI: { chiave: Gruppo; titolo: string; spiega: string }[] = [
  { chiave: "attivi", titolo: "In corso", spiega: "Lead aperti: si lavorano oggi" },
  {
    chiave: "ricontattare",
    titolo: "Da ricontattare",
    spiega: "Richiami e date fissate: si aprono per prime la mattina",
  },
  {
    chiave: "gia_presenti",
    titolo: "Già in archivio",
    spiega: "Erano già a sistema quando sono rientrati",
  },
  //  Il gruppo raccoglie lo stato "annullato", che adesso si legge "Non
  //  interessato": la scheda deve chiamarlo con lo stesso nome della pastiglia.
  { chiave: "annullati", titolo: "Non interessati", spiega: "Chiusi senza appuntamento" },
  {
    chiave: "conclusi",
    titolo: "Conclusi",
    spiega: "Pratiche chiuse: si consultano, non si lavorano",
  },
  //  L'archivio intero. Non è un momento di lavoro: è la destinazione del
  //  conteggio "312 di 843" — il totale doveva essere raggiungibile, altrimenti
  //  è un numero che si legge e basta.
  { chiave: "tutte", titolo: "Tutte", spiega: "L'archivio completo, senza partizioni" },
];

/** Stati che raccolgono chi va risentito: alimentano il gruppo "Da ricontattare". */
const DA_RICONTATTARE: string[] = [
  "richiamo",
  "da_ricontattare",
  "fissa_meet_dopo",
  "sta_valutando",
  //  ⚠️ C'È DENTRO ANCHE CHI DEVE RICHIAMARE LUI, e non è una svista: questo
  //   gruppo è «chi va risentito», e una promessa fatta dal cliente va
  //   risentita esattamente come una nostra — altrimenti il giorno che passa
  //   in silenzio non lo guarda nessuno. Di CHI sia il turno lo dice lo stato,
  //   che resta scritto sulla riga.
  "ci_ricontatta_lui",
];

/** Importato finché non ha una consulenza fissata: data E consulente.
 *  È il momento in cui smette di essere la riga di una lista e diventa un lead
 *  vero — prima di allora si lavora con gli esiti del primo contatto. */
const eImportato = (l: Lead) => !!l.data.importato && !(l.data.dataMeeting && l.data.consulenteId);

/* ═══════════════════════════════════════════════════════════════════════════
   I DUE TASTI DEL MOMENTO — QUANDO COMPAIONO, E PERCHÉ NON SEMPRE

   Sulla riga ci sono tre gesti che valgono per chiunque (segna, chiama,
   scrivi). Il quarto dipende da dove sta il lead, e non è mai più di uno: o si
   avvia la videoconsulenza, o si programma la posa. Le due condizioni si
   escludono a vicenda — chi ha pagato non ha più una consulenza da fare — e
   questo è il modo in cui la riga resta a quattro icone invece di diventare una
   fila che non si legge più.

   Tutti i campi arrivano dall'archivio e nessuno è garantito della forma che
   dichiara: `soloData` regge anche un numero o un null, e sul telefono/ora si
   passa da String() invece che da `.trim()` diretto.
   ═════════════════════════════════════════════════════════════════════════ */

/** Gli stati in cui non c'è nessuna consulenza da avviare: la pratica è chiusa
 *  o il contatto non è mai diventato un lead lavorabile. */
const STATI_SENZA_CONSULENZA: string[] = ["concluso", "annullato", "perdi_tempo"];

/** Si può avviare la videoconsulenza di questo lead?
 *  Servono tutte e tre: il consulente (entra come padrone di casa), il giorno e
 *  l'ora (la stanza è di QUELL'appuntamento). Su un contatto mai chiamato il
 *  tasto sarebbe rumore: lì il lavoro è telefonare. */
function puoAvviareConsulenza(l: Lead): boolean {
  const d = l?.data;
  if (!d) return false;
  if (trattativaVinta(d)) return false;
  if (STATI_SENZA_CONSULENZA.includes(d.stato)) return false;
  return !!(d.consulenteId && soloData(d.dataMeeting) && String(d.oraMeeting ?? "").trim());
}

/** Ha già pagato: il lavoro non è più vendere, è consegnare. */
function puoProgrammareLaPosa(l: Lead): boolean {
  return !!l?.data && trattativaVinta(l.data);
}

/** Esito dell'appuntamento: la domanda che ci si fa più spesso guardando
 *  l'elenco, quindi sta fuori dai menu e si preme in un gesto solo. */
type Esito = ChiaveEsito;

/** ── «SVOLTA» QUI È UN CALCOLO, NON UNO STATO ──────────────────────────────
 *  La lente verde contava le schede con lo stato "fatto". Quello stato non si
 *  assegna più — una consulenza è svolta quando NON è segnata cliente assente
 *  né da riprogrammare — quindi il conto va rifatto ogni volta.
 *
 *  IL NUMERO CAMBIA RISPETTO A PRIMA, ED È IL PUNTO: prima un cliente venduto
 *  subito dopo la consulenza usciva dalle «svolte» (il suo stato era "venduto",
 *  non "fatto"), e il filtro mostrava solo le schede rimaste ferme lì in mezzo.
 *  Adesso comprende venduti, acconti, visite in sede, "sta valutando",
 *  ricontatti fissati e le schede storiche già segnate "fatto".
 *
 *  DUE PALETTI, perché qui non si guarda una giornata ma l'archivio intero:
 *   · serve un appuntamento (dataMeeting): un lead mai incontrato non ha svolto
 *     nessuna consulenza, per quanto il suo stato non sia negativo;
 *   · "Appuntamento fissato" non conta: deve ancora succedere.
 *  Sono gli stessi due paletti dell'agenda — li applica `esitoContato`. */
function consulenzaSvolta(l: Lead): boolean {
  //  Lettura difensiva: gira dentro un useMemo sull'archivio intero, e una
  //  scheda importata senza `data` non deve poter far cadere la pagina.
  if (!l?.data?.dataMeeting) return false;
  return esitoContato(l) === "fatto";
}

type Ordine = "azione" | "recenti" | "nome";

/* ── L'ORDINE: PRIMA CHI VA SENTITO PRIMA ──────────────────────────────────
   L'elenco non si ordina per data di inserimento — «cosa è arrivato per
   ultimo» non è una domanda che si fa nessuno. Si ordina per IMMINENZA, che
   crm/ui calcola una volta per tutto il CRM: le scadenze già passate in cima
   (più sono vecchie più salgono), poi oggi, poi i giorni a venire, poi chi non
   ha ancora una data, in fondo le pratiche chiuse.

   L'ECCEZIONE ERA LA LISTA APPENA IMPORTATA, dove quasi nessuno ha una data e
   l'imminenza non discrimina più niente: a parità decideva l'ordine con cui una
   lista si lavora al telefono (prima i richiami promessi, poi chi non è mai
   stato chiamato…). Quella regola è andata con le liste, in
   crm/kpi/DaFareScheda.tsx (`ordinaPerPrimaChiamata`): qui non c'era più niente
   da ordinare così, e lasciarne una copia significava vederla divergere. */

const perCognome = (l: Lead) => `${l.data.cognome || ""} ${l.data.nome || ""}`;

/* ═══════════════════════════════════════════════════════════════════════════
   I FILTRI — QUATTRO DOMANDE, NON QUINDICI CAMPI

   Riscritti da zero. Prima erano organizzati come è fatto il database — un
   controllo per colonna — e per rispondere a «chi devo richiamare adesso fra i
   miei» bisognava toccarne tre in tre posti diversi. Adesso sono raggruppati
   per DOMANDA, e le domande di una giornata vera sono quattro:

     · DI CHI È      → consulente, «solo i miei»
     · A CHE PUNTO È → esito dell'appuntamento e stato del lead. UNO SOLO: il
                       vocabolario della prima chiamata è andato con le liste,
                       in «Lead importati» — qui non si mescola più niente
     · QUANDO        → in ritardo, oggi, entro la settimana, senza data, e il
                       periodo di ingresso
     · DA DOVE VIENE → fonte, e come è entrato (lista importata, funnel,
                       rientro)

   Ogni gruppo ha la sua icona e il suo titolo, si azzera da solo, e i filtri
   accesi restano SEMPRE in pagina come pastiglie con la X. Il conteggio
   «312 di 843» non si nasconde mai, e tutto sopravvive al ricaricamento.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Le quattro domande. Servono a dare a ogni filtro un solo posto dove stare:
 *  se un filtro nuovo non risponde a nessuna di queste, è un filtro che non
 *  serve a chi lavora. */
type Domanda = "chi" | "punto" | "quando" | "dove";

const DOMANDE: {
  chiave: Domanda;
  /** Il titolo del blocco: è la domanda, scritta come la si fa a voce. */
  titolo: string;
  /** Il nome corto sul pulsante della barra. */
  breve: string;
  icona: typeof UserRound;
}[] = [
  { chiave: "punto", titolo: "A che punto è", breve: "Stato", icona: ListChecks },
  { chiave: "chi", titolo: "Di chi è", breve: "Consulente", icona: UserRound },
  { chiave: "quando", titolo: "Quando", breve: "Quando", icona: CalendarClock },
  { chiave: "dove", titolo: "Da dove viene", breve: "Provenienza", icona: RouteIcona },
];

/** ── QUANDO CADE LA PROSSIMA AZIONE ────────────────────────────────────────
 *  Quattro secchi che NON si sovrappongono, così i conteggi si sommano e non
 *  si contraddicono. "Entro 7 giorni" esclude oggi apposta: chi filtra "oggi"
 *  vuole la giornata, chi filtra la settimana vuole ciò che deve ancora
 *  arrivare. Le pratiche chiuse non hanno scadenza e non entrano in nessuno. */
type Scadenza = "tutte" | "ritardo" | "oggi" | "settimana" | "senza_data";

const VOCI_SCADENZA: {
  chiave: Exclude<Scadenza, "tutte">;
  titolo: string;
  /** Il colore è SEGNALE: rosa = perso tempo, sky = adesso, ambra = manca un
   *  passaggio (la data), slate = neutro. */
  classe: string;
}[] = [
  { chiave: "ritardo", titolo: "In ritardo", classe: "border-rose-200 bg-rose-50 text-rose-700" },
  { chiave: "oggi", titolo: "Oggi", classe: "border-sky-200 bg-sky-50 text-sky-700" },
  {
    chiave: "settimana",
    titolo: "Entro 7 giorni",
    classe: "border-border bg-muted text-foreground",
  },
  {
    chiave: "senza_data",
    titolo: "Senza data",
    classe: "border-amber-200 bg-amber-50 text-amber-700",
  },
];

/** In quale secchio cade un lead. `prossimaAzione` regge già i campi storti
 *  (date illeggibili, stati sconosciuti): qui si traduce solo il suo tono. */
function scadenzaDi(l: Lead): Exclude<Scadenza, "tutte"> | null {
  const az = prossimaAzione(l);
  if (az.tono === "ritardo") return "ritardo";
  if (az.tono === "oggi") return "oggi";
  if (az.tono === "futuro") return az.urgenza <= 7 ? "settimana" : null;
  if (az.tono === "aperto") return "senza_data";
  //  "chiuso": la pratica è finita, non c'è nessuna scadenza da filtrare.
  return null;
}

/** ── COME È ENTRATO ────────────────────────────────────────────────────────
 *  Diverso dalla FONTE (che dice il canale commerciale): questo dice per quale
 *  porta è passato il contatto, ed è la domanda di chi ha appena caricato un
 *  CSV o sta ripescando i rientri. */
type Provenienza = "tutte" | "importati" | "diretti" | "rientri";

const VOCI_PROVENIENZA: { chiave: Exclude<Provenienza, "tutte">; titolo: string }[] = [
  { chiave: "importati", titolo: "Da una lista importata" },
  { chiave: "diretti", titolo: "Dal funnel o inseriti a mano" },
  { chiave: "rientri", titolo: "Erano già in archivio" },
];

/** L'etichetta di una fonte assente. Non è una fonte: è un buco, e chiamarlo
 *  per nome è l'unico modo per poterlo cercare. */
const SENZA_FONTE = "—";

/** La fonte di un lead, ridotta a una stringa affidabile: nell'archivio
 *  importato questo campo è a volte un numero, a volte una stringa vuota. */
function fonteDi(l: Lead): string {
  const f = l.data?.fonte;
  const s = typeof f === "string" ? f.trim() : f == null ? "" : String(f).trim();
  return s || SENZA_FONTE;
}

interface Filtri {
  gruppo: Gruppo;
  // ── A CHE PUNTO È ───────────────────────────────────────────────────────
  /** Com'è andato l'appuntamento. */
  esito: Esito | null;
  /** Stati del lead, a scelta multipla. */
  stati: string[];
  // ── DI CHI È ────────────────────────────────────────────────────────────
  /** "all" · "nessuno" · id del consulente. */
  consulenteId: string;
  // ── QUANDO ──────────────────────────────────────────────────────────────
  scadenza: Scadenza;
  from: string | null;
  to: string | null;
  // ── DA DOVE VIENE ───────────────────────────────────────────────────────
  fonti: string[];
  provenienza: Provenienza;
  // ── TRASVERSALI ─────────────────────────────────────────────────────────
  /** Solo i lead segnati con la stella. */
  evidenziati: boolean;
  cerca: string;
  ordine: Ordine;
}

const FILTRI_VUOTI: Filtri = {
  gruppo: "attivi",
  esito: null,
  stati: [],
  consulenteId: "all",
  scadenza: "tutte",
  from: null,
  to: null,
  fonti: [],
  provenienza: "tutte",
  evidenziati: false,
  cerca: "",
  ordine: "azione",
};

/** A quale domanda risponde ogni filtro. Da qui nascono il conteggio per
 *  blocco e l'azzeramento di un blocco solo: scritto una volta, non ripetuto
 *  in tre punti che poi divergono. */
const DOMANDA_DI: Record<Domanda, (keyof Filtri)[]> = {
  punto: ["esito", "stati"],
  chi: ["consulenteId"],
  quando: ["scadenza", "from", "to"],
  dove: ["fonti", "provenienza"],
};

/** Un filtro è "acceso" quando differisce dal suo valore vuoto. Gli array
 *  vanno confrontati per lunghezza: `[] !== []`. */
function acceso(f: Filtri, campo: keyof Filtri): boolean {
  const v = f[campo];
  if (Array.isArray(v)) return v.length > 0;
  return v !== FILTRI_VUOTI[campo];
}

const quantiAccesi = (f: Filtri, d: Domanda) => DOMANDA_DI[d].filter((c) => acceso(f, c)).length;

const CHIAVE_FILTRI = "crm-trattative-filtri";
/** Chi sono io, quando non c'è una sessione consulente da cui dedurlo: serve
 *  al pulsante "Solo i miei" e si sceglie una volta sola. */
const CHIAVE_IO = "crm-trattative-io";
/** Se un giorno la forma dei filtri cambia si riparte puliti, invece di
 *  rileggere campi che non esistono più e filtrare su valori senza senso.
 *  2 = riscrittura per domande (scadenza, fonti, provenienza).
 *  3 = via il gruppo «Importati» e l'esito della prima chiamata. IL NUMERO VA
 *      ALZATO: chi aveva lasciato la pagina dentro quel gruppo si ritroverebbe
 *      con un `gruppo` che nessun ramo riconosce — cioè l'elenco dei lead
 *      attivi con scritto sopra un gruppo che non esiste. */
const VERSIONE_FILTRI = 3;

/*  Quello che c'è nel localStorage l'ha scritto una versione qualsiasi di
    questa pagina, o un dito su una console: si rilegge senza fidarsi. Un
    `stati` che arriva come oggetto e finisce in un `.filter` è il modo esatto
    in cui una pagina muore in mano al cliente. */
const soloStringhe = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function leggiFiltri(): Filtri {
  if (typeof window === "undefined") return FILTRI_VUOTI;
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_FILTRI);
    if (!grezzo) return FILTRI_VUOTI;
    const salvati = JSON.parse(grezzo) as Partial<Filtri> & { v?: number };
    if (!salvati || typeof salvati !== "object" || salvati.v !== VERSIONE_FILTRI)
      return FILTRI_VUOTI;
    return {
      ...FILTRI_VUOTI,
      ...salvati,
      stati: soloStringhe(salvati.stati),
      fonti: soloStringhe(salvati.fonti),
    };
  } catch {
    return FILTRI_VUOTI;
  }
}

function scriviFiltri(f: Filtri) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHIAVE_FILTRI, JSON.stringify({ ...f, v: VERSIONE_FILTRI }));
  } catch {
    //  Spazio esaurito o navigazione privata: i filtri valgono comunque per
    //  questa sessione, non c'è niente da dire all'utente.
  }
}

/** Il periodo scritto come lo si legge: "1 ago → 13 ago", non due ISO. */
const FMT_BREVE = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
function etichettaPeriodo(from: string | null, to: string | null): string {
  const leggi = (iso: string) => FMT_BREVE.format(new Date(`${iso}T00:00:00`));
  if (from && to) return from === to ? leggi(from) : `${leggi(from)} → ${leggi(to)}`;
  if (from) return leggi(from);
  if (to) return `fino al ${leggi(to)}`;
  return "Sempre";
}

// ── STATI APPLICABILI A UN GRUPPO DI LEAD ──────────────────────────────────
//  In blocco si possono assegnare solo gli stati che NON aprono una finestra:
//  "venduto" o "viene in sede" chiedono importi e date, e quelle si scrivono
//  un lead alla volta. Metterli qui significherebbe scrivere gli stessi importi
//  su venti clienti diversi.
//  ⚠️ Le domande da fare sono DUE, e servono tutte e due: `requiresAnyDialog`
//   conosce il modulo dei pagamenti e le date, `richiedeChiusura` conosce le tre
//   chiusure vinte, che hanno una finestra propria e che quella domanda non
//   intercetta. Senza la seconda, «Nel nostro centro» finiva fra gli stati
//   applicabili a cinquanta lead in un colpo: cinquanta vendite registrate
//   senza un euro incassato su nessuna, tutte verdi, e nessuno che ci torni.
const STATI_MASSIVI = SELECTABLE_LEAD_STATUSES.filter(
  (s) => !requiresAnyDialog(s) && !richiedeChiusura(s),
);
//  "non_fatto" non si assegna più a mano: al suo posto "no_show", che dice la
//  stessa cosa con la parola giusta (vedi ESITI in crm/ui).
//  Nemmeno "fatto" si assegna più, in blocco meno che mai: una consulenza è
//  svolta quando NON è segnata assente né da riprogrammare, quindi un comando
//  di gruppo "segna svolte" non avrebbe niente da scrivere. Restano i due esiti
//  negativi, che sono anche gli unici che ha senso dare a venti righe insieme
//  (una mattina saltata, un consulente malato).
const ESITI_MASSIVI: LeadStatus[] = ["no_show", "da_spostare"];

/* ═══════════════════════════════════════════════════════════════════════════
   IL SEGNO DELLA PROSSIMA AZIONE — DOVE AVVIENE, NON SOLO QUANDO

   Nella colonna «Prossima azione» c'era un problema segnalato da chi la usa:
   chi viene IN SEDE e chi fa la consulenza A DISTANZA erano due righe di testo
   identiche per peso, colore e posizione, e si distinguevano solo rileggendo
   la parola. Sono però due lavori diversi: per chi arriva di persona bisogna
   liberare la sala, preparare i campioni e dire dove parcheggiare; per chi si
   collega basta mandare il link. Sbagliare quella lettura costa una mattina.

   Perciò ogni azione porta un SEGNO, prima delle parole: si riconosce con la
   coda dell'occhio mentre si scorre, senza leggere. Il segno dice DOVE e COME,
   il colore continua a dire QUANDO (rosa = in ritardo, ambra = oggi): due
   informazioni diverse su due canali diversi, mai in concorrenza.

   «In sede» ha in più il riquadro attorno all'icona: è l'unico caso in cui
   qualcuno si sposta fisicamente, ed è quello che non deve sfuggire.
   ═══════════════════════════════════════════════════════════════════════════ */

type Segno = {
  icona: typeof Building2;
  /** true = icona in un riquadro: il cliente si muove, viene qui. */
  inSede?: boolean;
  titolo: string;
};

//  Le chiavi sono le frasi che restituisce prossimaAzione() in crm/ui: stanno
//  scritte per esteso invece che dedotte, così se un giorno là dentro nasce un
//  gesto nuovo qui non compare un'icona sbagliata — semplicemente non compare.
const SEGNI_AZIONE: Record<string, Segno> = {
  "In sede": { icona: Building2, inSede: true, titolo: "Il cliente viene in sede" },
  "Fissa data in sede": {
    icona: Building2,
    inSede: true,
    titolo: "Appuntamento in sede: manca la data",
  },
  Consulenza: { icona: Video, titolo: "Consulenza a distanza" },
  "Fissa la consulenza": { icona: Video, titolo: "Consulenza a distanza da fissare" },
  "Fissa data e ora": { icona: Video, titolo: "Appuntamento senza data" },
  "Definisci il seguito": { icona: Video, titolo: "Consulenza svolta: manca il seguito" },
  Richiamo: { icona: Phone, titolo: "Telefonata" },
  "Prima chiamata": { icona: Phone, titolo: "Mai chiamato" },
  "Riprova a chiamare": { icona: Phone, titolo: "Telefonata da ripetere" },
  "Fissa il richiamo": { icona: Phone, titolo: "Telefonata da fissare" },
  "Fissa il ricontatto": { icona: Phone, titolo: "Ricontatto da fissare" },
  //  ⚠️ La cornetta che ENTRA: la telefonata la fa lui. Senza queste due righe
  //   la riga resterebbe senza segno — le chiavi sono le FRASI di
  //   `prossimaAzione`, e un gesto nuovo là dentro qui non compare da solo.
  "Si fa vivo lui": { icona: PhoneIncoming, titolo: "Ci ricontatta lui" },
  "Aspetta che si faccia vivo": { icona: PhoneIncoming, titolo: "Ci ricontatta lui: senza data" },
  "Sollecita l'acconto": { icona: Phone, titolo: "Acconto da sollecitare" },
  "In gestione via chat": { icona: MessageCircle, titolo: "Si sta gestendo in chat" },
  Installazione: { icona: Wrench, titolo: "Installazione" },
  "Programma l'installazione": { icona: Wrench, titolo: "Installazione da programmare" },
  Riprogramma: { icona: CalendarRange, titolo: "Appuntamento da rifissare" },
};

/** Il segno di un'azione. Grigio sempre: il colore in questa colonna è già
 *  impegnato a dire se si è in ritardo, e due colori che dicono due cose sulla
 *  stessa riga si annullano a vicenda. */
function SegnoAzione({ cosa }: { cosa: string }) {
  const segno = SEGNI_AZIONE[cosa];
  //  Le azioni chiuse ("Nessuna azione", "—") non hanno segno: non c'è niente
  //  da fare, e un'icona lì chiederebbe attenzione per dire "ignorami".
  if (!segno) return null;
  const Icona = segno.icona;
  return (
    <span
      title={segno.titolo}
      //  L'etichetta a voce sta sull'involucro e non sull'icona: chi legge con
      //  la tastiera o con un lettore di schermo deve sentire "viene in sede",
      //  non "grafico".
      aria-label={segno.titolo}
      role="img"
      className={
        segno.inSede
          ? "grid h-4 w-4 shrink-0 place-items-center rounded border border-slate-300 bg-slate-100 text-slate-600"
          : "inline-flex shrink-0 text-muted-foreground"
      }
    >
      <Icona className={segno.inSede ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LE NOTE A COMPARSA — LEGGERE SENZA APRIRE

   Le note sono il posto dove sta il perché di un lead: «vuole pensarci
   fino a fine mese», «la moglie non è convinta», «richiamare dopo le 18». Erano
   raggiungibili solo aprendo la scheda, cioè uscendo dall'elenco che si sta
   lavorando: chi scorre ottocento righe non lo fa, e quel perché non lo legge
   più nessuno.

   Adesso stanno sotto la pastiglia dello stato — e sotto la voce del filtro
   corrispondente, dove la domanda è «cosa c'è dentro questo gruppo». Un
   riquadro solo, usato in tutti e due i posti e per TUTTI gli stati: non c'è
   un riquadro per il ricontatto e uno per il resto.

   TRE REGOLE, TUTTE E TRE NATE DA UN FASTIDIO VERO
    1. Se non ci sono note il riquadro NON si apre e l'icona non compare: un
       riquadro vuoto che appare al passaggio del mouse è solo un ostacolo.
    2. Si legge, non si consulta: nota più recente in alto, data in piccolo
       sopra ogni nota, testo a capo, altezza massima con scorrimento interno.
    3. Sul telefono il passaggio del mouse non esiste. La stessa icona che sul
       monitor dice "qui ci sono note" al tocco APRE il riquadro, e si chiude
       toccando fuori. Nessuna delle due strade è esclusiva dell'altra.

   Il riquadro vive in un portale su document.body: l'elenco è dentro un
   contenitore con `overflow-hidden` (gli angoli arrotondati della lista), e un
   riquadro in posizione assoluta lì dentro verrebbe tagliato a metà.
   ═════════════════════════════════════════════════════════════════════════ */

/** Una nota sola, già divisa dal resto del diario. */
interface RigaNota {
  /** La data com'era scritta ("12 ago"): non si reinterpreta, si mostra. */
  quando?: string;
  /** Di chi è la nota: serve solo quando il riquadro raccoglie più lead. */
  chi?: string;
  testo: string;
}

/*  Le note si appendono con la data davanti — «12 ago · ha chiesto tempo» — ma
    l'archivio importato porta anche date all'italiana e ISO. I mesi sono
    scritti per esteso invece che come "tre lettere qualsiasi": senza,
    «12 persone: le vuole tutte» diventava una nota datata "12 persone".
    Quello che non ha una data davanti non viene comunque buttato: diventa la
    continuazione della nota precedente. */
const MESI_BREVI = "gen|feb|mar|apr|mag|giu|lug|ago|set|sett|ott|nov|dic";
const RE_DATA_NOTA = new RegExp(
  `^\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?|\\d{1,2}\\s+(?:${MESI_BREVI})[a-zà-ù]*\\.?(?:\\s+\\d{2,4})?)\\s*[·\\-–—:]\\s*(.*)$`,
  "i",
);

/** Quante note al massimo tiene un riquadro: oltre, non si legge più — si
 *  scorre. Il numero totale resta scritto nell'intestazione. */
const MAX_NOTE = 40;

/** ── DAL TESTO UNICO ALLE NOTE ────────────────────────────────────────────
 *  Il campo `note` è una stringa sola con le aggiunte in coda. Qui si torna
 *  indietro: una voce per aggiunta, la più recente in cima (si appende in
 *  fondo, quindi l'ordine di lettura è quello inverso).
 *
 *  L'argomento è `unknown` NON per pignoleria: questo valore arriva dal
 *  database e negli archivi importati non è sempre una stringa. Un `.split()`
 *  dato per scontato qui butterebbe giù l'intera riga del lead. */
function blocchiNota(grezzo: unknown): RigaNota[] {
  const testo = typeof grezzo === "string" ? grezzo : "";
  if (!testo.trim()) return [];
  const righe: RigaNota[] = [];
  for (const linea of testo.split(/\r?\n/)) {
    const pulita = linea.trim();
    if (!pulita) continue;
    const m = RE_DATA_NOTA.exec(pulita);
    if (m) righe.push({ quando: m[1].trim(), testo: m[2].trim() });
    else if (righe.length) righe[righe.length - 1].testo += `\n${pulita}`;
    else righe.push({ testo: pulita });
  }
  return righe.filter((r) => r.testo.trim()).reverse();
}

/** L'ultima nota di ogni lead di un gruppo, con il nome davanti: è il
 *  riquadro che si apre dal filtro. Non tutte le note di tutti — sarebbe un
 *  muro — ma l'ultima cosa detta a ciascuno, che è la domanda vera. */
function raccogliNote(righe: Lead[], chiave: (l: Lead) => string): Record<string, RigaNota[]> {
  const mappa: Record<string, RigaNota[]> = {};
  for (const l of righe) {
    const k = chiave(l);
    const elenco = (mappa[k] ??= []);
    if (elenco.length >= MAX_NOTE) continue;
    const blocchi = blocchiNota(l.data?.note);
    if (!blocchi.length) continue;
    elenco.push({
      ...blocchi[0],
      chi: `${l.data?.nome || ""} ${l.data?.cognome || ""}`.trim() || "senza nome",
    });
  }
  return mappa;
}

/** Il riquadro. `righe` vuoto = niente icona e niente riquadro. */
function NoteAComparsa({
  righe,
  titolo,
  blocco,
  className,
  children,
}: {
  righe: RigaNota[];
  /** Cosa sto guardando: "Note del lead", "Ultima nota per lead". */
  titolo: string;
  /** true = riga a sé (una voce di filtro), non un pezzo di riga. */
  blocco?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [aperto, setAperto] = useState(false);
  const [posizione, setPosizione] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    /** true = foglio dal basso, a tutta larghezza: è la forma sul telefono. */
    foglio?: boolean;
  } | null>(null);
  const ancora = useRef<HTMLSpanElement>(null);
  const pannello = useRef<HTMLDivElement>(null);
  const bottone = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);

  const annulla = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  /*  Il riquadro si posiziona a mano, in coordinate di finestra: sotto il
      bersaglio se c'è spazio, sopra se sta per uscire dallo schermo, e sempre
      dentro i bordi laterali (una riga in fondo all'elenco aprirebbe fuori). */
  const calcola = () => {
    const r = ancora.current?.getBoundingClientRect();
    if (!r) return;
    /*  ── ⚠️ SUL TELEFONO NON SI APPENDE A NIENTE ─────────────────────────
        Un riquadro ancorato alla riga, su uno schermo da 375 punti, nasce
        largo quanto lo schermo e alto quanto ci sta: metà volte apre sotto la
        tastiera o sotto la barra di sistema, e si chiude al primo sfioramento
        perché la pagina si è mossa di due pixel. Qui diventa quello che è: un
        foglio dal basso, che si legge e si scorre. La forma appesa resta sul
        monitor, dove il mouse c'è e la riga sta ferma. */
    if (window.innerWidth < 640) {
      setPosizione({ left: 0, width: window.innerWidth, bottom: 0, foglio: true });
      return;
    }
    const larghezza = Math.min(340, window.innerWidth - 24);
    const left = Math.min(Math.max(12, r.left), Math.max(12, window.innerWidth - larghezza - 12));
    const sotto = window.innerHeight - r.bottom;
    setPosizione(
      sotto < 260 && r.top > sotto
        ? { left, width: larghezza, bottom: window.innerHeight - r.top + 6 }
        : { left, width: larghezza, top: r.bottom + 6 },
    );
  };

  const apri = () => {
    annulla();
    calcola();
    setAperto(true);
  };

  //  Il ritardo in apertura evita che il riquadro sbatta in faccia a chi sta
  //  solo passando con il mouse per arrivare altrove. Quello in chiusura serve
  //  al viaggio fra la pastiglia e il riquadro: senza, il riquadro sparisce
  //  mentre ci si sta andando e le note lunghe non si possono scorrere.
  const apriConRitardo = () => {
    /*  ── ⚠️ SOLO DOVE IL MOUSE ESISTE DAVVERO ────────────────────────────
        Sul telefono il browser finge un `mouseenter` al primo tocco: il
        riquadro si apriva da solo sfiorando la riga per scorrere, e si
        richiudeva subito dopo perché lo scorrimento lo chiude. Risultato: le
        note lampeggiavano e non si leggevano mai. `(hover: hover)` è vero solo
        su un puntatore vero — lì il passaggio resta com'era. */
    if (typeof window !== "undefined" && !window.matchMedia("(hover: hover)").matches) return;
    annulla();
    timer.current = window.setTimeout(apri, 160);
  };
  const chiudiConRitardo = () => {
    annulla();
    timer.current = window.setTimeout(() => setAperto(false), 140);
  };
  const chiudiSubito = () => {
    annulla();
    setAperto(false);
  };

  //  Chiudere: un tocco fuori (è così che si chiude sul telefono), Esc, e a
  //  ogni scorrimento della pagina — un riquadro ancorato a una riga che si è
  //  spostata indica la riga sbagliata, ed è peggio che non averlo. Lo
  //  scorrimento DENTRO al riquadro non lo chiude: è il modo di leggerlo.
  //  "Dentro" è il riquadro o la sua icona, NON tutto il bersaglio: premendo la
  //  pastiglia si apre il selettore di stato, e il riquadro resterebbe appeso
  //  sopra la finestra — è più in alto di lei.
  useEffect(() => {
    if (!aperto) return;
    const suo = (t: Node | null) =>
      !!t && (!!bottone.current?.contains(t) || !!pannello.current?.contains(t));
    const fuori = (e: Event) => {
      if (!suo(e.target as Node | null)) setAperto(false);
    };
    const suTasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAperto(false);
    };
    const suScorrimento = (e: Event) => {
      if (!suo(e.target as Node | null)) setAperto(false);
    };
    document.addEventListener("pointerdown", fuori, true);
    window.addEventListener("keydown", suTasto);
    window.addEventListener("scroll", suScorrimento, true);
    window.addEventListener("resize", suScorrimento);
    return () => {
      document.removeEventListener("pointerdown", fuori, true);
      window.removeEventListener("keydown", suTasto);
      window.removeEventListener("scroll", suScorrimento, true);
      window.removeEventListener("resize", suScorrimento);
    };
  }, [aperto]);

  //  Il timer non deve sopravvivere alla riga che lo ha acceso: l'elenco si
  //  rifiltra di continuo e le righe vanno e vengono.
  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  //  L'uscita anticipata sta DOPO tutti gli hook: sopra di loro cambierebbe il
  //  numero di hook chiamati da una riga all'altra, e React conta per posizione.
  if (!righe.length) return <>{children}</>;

  return (
    <span
      ref={ancora}
      className={`${blocco ? "flex w-full" : "inline-flex"} min-w-0 items-center gap-1 ${className ?? ""}`}
      onMouseEnter={apriConRitardo}
      onMouseLeave={chiudiConRitardo}
    >
      {children}
      <button
        ref={bottone}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (aperto) chiudiSubito();
          else apri();
        }}
        aria-expanded={aperto}
        /*  Niente `title`: il riquadro si apre già al passaggio del mouse, e il
            fumetto del browser gli finirebbe sopra mentre lo si legge. */
        aria-label={`Mostra le note (${righe.length})`}
        /*  ── ⚠️ L'ICONA È PICCOLA, IL BERSAGLIO NO ────────────────────────
            Disegnata, l'icona è 12 punti: sul monitor è giusta, col pollice è
            immancabile — e ogni tentativo mancato apriva la scheda del lead,
            perché il tocco cadeva sulla riga. `before` allarga la zona
            sensibile di 10 punti per lato (36 punti in tutto) SENZA spostare
            un pixel di quello che si vede, e sparisce da `sm` in su, dove
            allargarla ruberebbe i passaggi del mouse alle colonne vicine. */
        className={`relative shrink-0 rounded p-0.5 transition before:absolute before:-inset-2.5 before:content-[''] sm:before:hidden ${
          aperto ? "text-slate-700" : "text-slate-400 hover:text-slate-700"
        }`}
      >
        <StickyNote className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
      </button>

      {aperto &&
        posizione &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={pannello}
            role="tooltip"
            style={{
              position: "fixed",
              left: posizione.left,
              top: posizione.top,
              bottom: posizione.bottom,
              width: posizione.width,
              //  Dentro al foglio dei filtri (un dialogo) il resto della pagina
              //  è reso non cliccabile: senza questa riga il riquadro si
              //  vedrebbe ma non si potrebbe scorrere.
              pointerEvents: "auto",
            }}
            className={
              posizione.foglio
                ? "z-[60] rounded-t-2xl border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-left shadow-2xl"
                : "z-[60] rounded-xl border border-slate-200 bg-white p-2.5 text-left shadow-xl"
            }
            onMouseEnter={annulla}
            onMouseLeave={chiudiConRitardo}
            onClick={(e) => e.stopPropagation()}
          >
            {/*  ⚠️ La maniglia c'è SOLO nel foglio: è il segno che si chiude
                trascinando o toccando fuori, e su un riquadro appeso al mouse
                non significherebbe niente. */}
            {posizione.foglio && (
              <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-slate-300" aria-hidden />
            )}
            <div className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {titolo}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                {righe.length === MAX_NOTE ? `${MAX_NOTE}+` : righe.length}
              </span>
            </div>
            <div
              className={`flex flex-col gap-2 overflow-y-auto overscroll-contain pr-1 ${
                posizione.foglio ? "max-h-[55dvh]" : "max-h-[15rem]"
              }`}
            >
              {righe.map((r, i) => (
                <div key={i} className="min-w-0">
                  {(r.quando || r.chi) && (
                    <div className="flex items-baseline gap-1.5 text-[11px] leading-tight text-slate-400">
                      {r.quando && <span className="shrink-0 tabular-nums">{r.quando}</span>}
                      {r.chi && <span className="min-w-0 truncate font-medium">{r.chi}</span>}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words text-[12.5px] leading-snug text-slate-700">
                    {r.testo}
                  </p>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

/** Le note di UN lead. Il taglio del testo si rifà solo quando il testo
 *  cambia: in un elenco di trecento righe rifarlo a ogni battuta della ricerca
 *  sarebbe lavoro buttato. */
function NoteLead({
  lead,
  className,
  children,
}: {
  lead: Lead;
  className?: string;
  children: ReactNode;
}) {
  const righe = useMemo(() => blocchiNota(lead.data?.note).slice(0, MAX_NOTE), [lead.data?.note]);
  return (
    <NoteAComparsa righe={righe} titolo="Note del lead" className={className}>
      {children}
    </NoteAComparsa>
  );
}

/* ── PEZZI DI INTERFACCIA RIUSATI ──────────────────────────────────────── */

/** ── LA SPUNTA DELL'IMPEGNO ───────────────────────────────────────────────
 *  Compare solo sugli stati che sono una promessa (vedi COMPIMENTO). È un
 *  cerchietto sottile: da spento non chiede niente a nessuno — sta accanto alla
 *  pastiglia come un segno di spunta non ancora fatto — al passaggio del mouse
 *  si riempie di verde, e resta pieno mentre la finestrella della nota è
 *  aperta, così si vede su quale riga si sta lavorando.
 *
 *  ⚠️ Sugli stati a passo ovvio il cerchietto e la pastiglia portano alla
 *  STESSA identica finestra, ed è voluto: sul telefono la pastiglia non c'è
 *  (la riga stretta mostra lo stato come testo e apre la scheda), quindi
 *  togliere il cerchietto lì dove la pastiglia lo copre significherebbe due
 *  interfacce diverse fra monitor e telefono per lo stesso gesto. Due porte,
 *  una stanza — mai due stanze. */
function SpuntaCompimento({
  lead,
  attiva,
  onClick,
}: {
  lead: Lead;
  /** true = la finestrella di questa riga è aperta. */
  attiva: boolean;
  onClick: () => void;
}) {
  const meta = compimentoDi(lead.data?.stato);
  if (!meta) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${meta.spiega} → ${LEAD_STATUS_LABEL[meta.stato]}`}
      aria-label={`${meta.spiega}: passa a ${LEAD_STATUS_LABEL[meta.stato]}`}
      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition ${
        attiva
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-slate-300 text-transparent hover:border-emerald-500 hover:bg-emerald-500/15 hover:text-emerald-700"
      }`}
    >
      <Check className="h-3 w-3" />
    </button>
  );
}

/** Il segnale di stato. È sempre lo stesso oggetto — nella riga, nel pannello —
 *  e si preme sempre per cambiare stato.
 *
 *  ── DUE PASTIGLIE IN UNA ──────────────────────────────────────────────────
 *  Su quasi tutti gli stati si apre il selettore, e il segno è la freccetta in
 *  giù: «qui sotto c'è un elenco». Sugli stati a passo ovvio (oggi solo
 *  «Attesa acconto», vedi STATI_A_PASSO_OVVIO) premerla propone DIRETTAMENTE
 *  l'unico seguito possibile, e il segno diventa una spunta: la freccetta
 *  prometterebbe un elenco che non arriva.
 *  Il selettore non sparisce — sta dentro la conferma («Scegli un altro
 *  stato») e sul tasto S — perché una pastiglia che sa fare una cosa sola
 *  sarebbe un vicolo cieco per chi quel lead lo deve annullare. */
function ChipStato({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const passo = passoOvvioDi(lead.data?.stato);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        //  ── IL TITOLO PORTA L'ETICHETTA PER INTERO ──────────────────────
        //   Da quando la pastiglia cede spazio all'avviso dei soldi (vedi il
        //   `min-w-0` qui sotto) il testo dentro si può accorciare, e uno
        //   stato lungo come «Nel nostro centro» resterebbe leggibile solo
        //   aprendo il menu — cioè entrando in un comando di scrittura per
        //   fare una domanda di lettura. È lo stesso rimedio che la pastiglia
        //   condivisa (PastigliaStato) ha già.
        title={
          passo
            ? `${passo.spiega} → ${LEAD_STATUS_LABEL[passo.stato]} · chiede conferma (S per l'elenco)`
            : `${LEAD_STATUS_LABEL[lead.data.stato] ?? lead.data.stato} · cambia stato (S)`
        }
        aria-label={
          passo
            ? `${LEAD_STATUS_LABEL[lead.data.stato]}: passa a ${LEAD_STATUS_LABEL[passo.stato]}, con conferma`
            : undefined
        }
        /*  ⚠️ `min-w-0` NON È DECORAZIONE, È IL RIMEDIO A UNA SOVRAPPOSIZIONE.
            `CLASSE_BADGE_STATO` porta `max-w-full`, che sembra bastare e non
            basta: un elemento flessibile senza `min-w-0` non scende sotto la
            larghezza del proprio contenuto, quindi la pastiglia si prendeva
            tutta la cella e l'avviso dei soldi che le sta accanto finiva
            oltre il bordo, addosso alla colonna «Prossima azione». Con questa
            riga a cedere è il testo dello stato — che si accorcia e resta nel
            titolo — mentre l'importo, che è l'informazione che nessuno deve
            perdere, resta intero. */
        className={`${CLASSE_BADGE_STATO} ${classiStato(lead.data.stato)} h-6 min-w-0 transition hover:brightness-95`}
      >
        {/*  ?? stato: una pastiglia vuota su una riga non si spiega. */}
        <span className="truncate">{LEAD_STATUS_LABEL[lead.data.stato] ?? lead.data.stato}</span>
        {passo ? (
          <Check className="h-3 w-3 shrink-0 opacity-70" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        )}
      </button>
      {/*  ── I SOLDI CHE IL CLIENTE ANCORA NON SA ─────────────────────────
           Questa pagina è l'elenco lungo delle trattative, cioè il posto dove
           un lead vinto passa la maggior parte della sua vita — ed era l'unico
           dei quattro elenchi in cui l'avviso NON compariva, perché qui la
           pastiglia è scritta in casa e non è quella condivisa.
           ⚠️ Sta FUORI dal pulsante di proposito: dentro prenderebbe il verde
            della pastiglia vinta (che vuol dire l'opposto) e diventerebbe parte
            del bersaglio che apre il cambio stato. `AvvisoExtra` non disegna
            niente quando non c'è niente da dire, quindi non serve una
            condizione qui intorno. */}
      <AvvisoExtra dati={lead.data} className="ml-1" />
    </>
  );
}

/** ── LA PASTIGLIA DI UN FILTRO ACCESO ──────────────────────────────────────
 *  Un filtro che non si vede è un filtro che fa sparire le righe senza dire
 *  perché: qui ogni filtro attivo è un oggetto in pagina, dice cosa sta
 *  togliendo e si spegne dov'è, senza tornare nel menu da cui è nato. */
function Pastiglia({
  etichetta,
  valore,
  classe,
  onRimuovi,
}: {
  /** Il campo, in grigio: "Stato", "Consulente"… Si può omettere quando il
   *  valore parla da solo (una ricerca, un periodo). */
  etichetta?: string;
  valore: ReactNode;
  classe?: string;
  onRimuovi: () => void;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-2 pr-1 text-[11.5px] font-medium ${
        classe ?? "border-border bg-muted text-foreground"
      }`}
    >
      {etichetta && <span className="shrink-0 opacity-60">{etichetta}</span>}
      <span className="truncate">{valore}</span>
      <button
        type="button"
        onClick={onRimuovi}
        title="Togli questo filtro"
        aria-label={`Togli il filtro ${etichetta ? `${etichetta} ` : ""}${typeof valore === "string" ? valore : ""}`}
        className="shrink-0 rounded-full p-0.5 opacity-60 transition hover:bg-black/10 hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** Una riga dentro un menu di filtro. Il conteggio a destra è la ragione per
 *  cui si preme o non si preme: senza, si sceglie alla cieca. */
function VoceFiltro({
  attivo,
  etichetta,
  conteggio,
  onClick,
}: {
  attivo: boolean;
  etichetta: ReactNode;
  conteggio?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attivo}
      /*  min-w-0 flex-1: la voce può stare dentro la riga che apre le note (un
          contenitore flex) e lì "w-full" da solo la farebbe debordare. */
      className={`flex w-full min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition ${
        attivo
          ? "border-slate-300 bg-slate-100"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
          attivo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
        }`}
      >
        {attivo && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-800">{etichetta}</span>
      {conteggio !== undefined && (
        <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{conteggio}</span>
      )}
    </button>
  );
}

/** ── UN BLOCCO = UNA DOMANDA ───────────────────────────────────────────────
 *  L'intestazione porta l'icona della domanda (si riconosce senza leggere,
 *  che è il punto), quanti filtri sono accesi qui dentro, e la X che azzera
 *  QUESTO blocco soltanto: chi ha stretto troppo su un lato non deve buttare
 *  via anche gli altri tre. Il fondo colorato quando è acceso serve a
 *  ritrovarlo scorrendo il pannello. */
function BloccoDomanda({
  titolo,
  icona: Icona,
  accesi,
  onAzzera,
  children,
}: {
  titolo: string;
  icona: typeof UserRound;
  accesi: number;
  onAzzera: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-slate-200 last:border-b-0">
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 ${accesi ? "bg-slate-100" : "bg-slate-50/60"}`}
      >
        <Icona className={`h-3.5 w-3.5 shrink-0 ${accesi ? "text-slate-700" : "text-slate-400"}`} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {titolo}
        </span>
        {accesi > 0 && (
          <>
            <span className="shrink-0 rounded-full bg-slate-900 px-1.5 text-[11px] font-semibold leading-[17px] tabular-nums text-white">
              {accesi}
            </span>
            <button
              type="button"
              onClick={onAzzera}
              title={`Azzera «${titolo}»`}
              aria-label={`Azzera i filtri di ${titolo}`}
              className="shrink-0 rounded p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
      <div className="px-3 py-2">{children}</div>
    </section>
  );
}

/** Una parte del blocco: la stessa domanda chiesta a un campo diverso
 *  (dentro «Quando» ci sono la scadenza e il periodo di ingresso). */
function SottoBlocco({
  titolo,
  nota,
  children,
}: {
  titolo: string;
  nota?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-500">{titolo}</span>
        {nota && <span className="truncate text-[11px] text-slate-400">{nota}</span>}
      </div>
      {children}
    </div>
  );
}

/** ── SCELTA RAPIDA: PASTIGLIE INVECE DI UN ELENCO ──────────────────────────
 *  Per le domande a poche risposte (quando, come è entrato) un elenco con le
 *  caselle costa quattro righe di altezza e un puntamento preciso; qui sono
 *  bottoni larghi in due colonne, che sul telefono si prendono col pollice. */
function ScelteRapide({
  voci,
  attiva,
  onScegli,
}: {
  voci: { chiave: string; titolo: string; conteggio: number; classe?: string }[];
  /** null = nessuna scelta ("tutte"): non si disegna un bottone in più. */
  attiva: string | null;
  onScegli: (chiave: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {voci.map((v) => {
        const on = attiva === v.chiave;
        return (
          <button
            key={v.chiave}
            type="button"
            aria-pressed={on}
            onClick={() => onScegli(on ? null : v.chiave)}
            title={on ? "Togli questo filtro" : `Mostra solo: ${v.titolo}`}
            className={`flex items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-left text-[12px] font-medium transition ${
              on
                ? "border-slate-900 bg-slate-900 text-white"
                : (v.classe ?? "border-border bg-muted text-foreground") + " hover:brightness-95"
            }`}
          >
            <span className="min-w-0 truncate">{v.titolo}</span>
            <span
              className={`shrink-0 rounded px-1 text-[11px] tabular-nums ${on ? "bg-white/20" : "bg-white/70"}`}
            >
              {v.conteggio}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL CONTATORE DELLE CHIAMATE — UN TOCCO SU, UNA PRESSIONE GIÙ

   Richiesta del committente: un pulsante FUORI dalla scheda, sulla riga, che a
   ogni clic aumenta di uno le chiamate fatte a quel contatto, e tenendolo
   premuto le diminuisce. Nessuno indovina la pressione lunga: per questo la
   spiegazione sta nel fumetto del mouse E nell'etichetta a voce, scritta per
   esteso, non "contatore".

   TRE TRAPPOLE, TUTTE E TRE VERE:
    1. la pressione lunga non deve far scattare anche il clic — un tocco lungo
       finisce sempre con un `click`, quindi il gesto lungo alza una bandierina
       che il clic successivo consuma e ignora;
    2. sul telefono una pressione lunga apre il menu di sistema («copia»,
       «condividi») e la selezione del testo: si spengono con `contextmenu`
       annullato, `touch-none` e `select-none`;
    3. il conteggio non scende mai sotto zero, e non parte mai da NaN: il campo
       arriva dal database e negli archivi importati è anche una stringa.

   Il numero sta SUL pulsante: un contatore che non si vede è un contatore che
   nessuno tiene aggiornato.
   ═════════════════════════════════════════════════════════════════════════ */

/** ⚠️ PROVVISORIO — `chiamateFatte` non esiste ancora in src/crm/types.ts, che
 *  non è un file di questo agente: la riga esatta da aggiungere sta nella
 *  risposta ("richieste"). Nel frattempo il campo si dichiara qui: i lead sono
 *  JSONB, quindi il valore si scrive e si rilegge senza migrazioni, e quando la
 *  proprietà entrerà nel tipo basterà cancellare questo alias. */
type DatiConChiamate = LeadData & { chiamateFatte?: number };

/** Quante chiamate risultano fatte. Non si fida del tipo dichiarato: il valore
 *  arriva dal database e può essere una stringa, un null o un numero assurdo. */
function chiamateDi(l: Lead | null | undefined): number {
  const n = Number((l?.data as DatiConChiamate | undefined)?.chiamateFatte);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Quanto dura la pressione perché conti come "lunga". 500 ms: sotto si
 *  attiva per sbaglio scorrendo l'elenco, sopra sembra che non funzioni. */
const PRESSIONE_LUNGA = 500;

function PulsanteChiamate({
  lead,
  onCambia,
}: {
  lead: Lead;
  /** Riceve il valore nuovo, già garantito >= 0. */
  onCambia: (valore: number) => void;
}) {
  const daArchivio = chiamateDi(lead);
  /** ── IL NUMERO SI MUOVE SUBITO, L'ARCHIVIO ARRIVA DOPO ───────────────────
   *  Il salvataggio è una chiamata di rete: finché non torna, `lead` porta
   *  ancora il valore vecchio. Leggendo solo da lì, due tocchi ravvicinati
   *  scrivevano due volte lo STESSO numero — la seconda chiamata segnata
   *  spariva — e su una linea lenta il numero restava fermo mezzo secondo,
   *  cioè esattamente il tempo in cui si tocca di nuovo pensando che non abbia
   *  funzionato. Qui il conto vive nel pulsante e l'archivio lo riallinea
   *  quando risponde. */
  const [mostrato, setMostrato] = useState(daArchivio);
  /** L'ultimo valore visto arrivare dall'archivio: serve a distinguere «il
   *  salvataggio è tornato» da «ho appena toccato io». */
  const ultimoArchivio = useRef(daArchivio);
  /** Il valore corrente senza aspettare il ridisegno: lo legge il timer della
   *  pressione lunga, che è nato uno o due tocchi fa. */
  const vivo = useRef(daArchivio);
  const timer = useRef<number | null>(null);
  /** true = la pressione lunga ha già fatto il suo lavoro; il `click` che
   *  arriva subito dopo va buttato, altrimenti toglie uno e ne rimette uno. */
  const eraLunga = useRef(false);
  const [premuto, setPremuto] = useState(false);

  //  Il lead può cambiare anche per mano d'altri (un altro consulente, un'altra
  //  scheda, il ricarico della lista): quando il numero vero si muove, comanda
  //  lui. Non `daArchivio !== mostrato`, che riporterebbe indietro il tocco
  //  appena dato mentre il salvataggio è ancora per aria.
  useEffect(() => {
    if (daArchivio === ultimoArchivio.current) return;
    ultimoArchivio.current = daArchivio;
    vivo.current = daArchivio;
    setMostrato(daArchivio);
  }, [daArchivio]);

  /** Un solo punto in cui il numero cambia: mai sotto zero, mai a metà. */
  const cambia = (valore: number) => {
    const n = Math.max(0, valore);
    vivo.current = n;
    setMostrato(n);
    onCambia(n);
  };

  const ferma = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setPremuto(false);
  };

  //  Il timer non deve sopravvivere alla riga: l'elenco si rifiltra di
  //  continuo e le righe vengono smontate mentre il dito è ancora giù.
  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const giu = () => {
    eraLunga.current = false;
    setPremuto(true);
    timer.current = window.setTimeout(() => {
      eraLunga.current = true;
      setPremuto(false);
      timer.current = null;
      //  Mai sotto zero: "meno una chiamata" su chi non ne ha ricevuta
      //  nessuna non significa niente, e un -1 in archivio non si toglie più.
      cambia(vivo.current - 1);
      //  Piccola vibrazione dove esiste: sul telefono è l'unico modo di
      //  sapere che il gesto lungo è scattato senza guardare il numero.
      navigator.vibrate?.(15);
    }, PRESSIONE_LUNGA);
  };

  return (
    <button
      type="button"
      onPointerDown={giu}
      onPointerUp={ferma}
      onPointerLeave={ferma}
      onPointerCancel={ferma}
      onClick={(e) => {
        e.stopPropagation();
        if (eraLunga.current) {
          //  La bandierina si consuma qui: il clic dopo la pressione lunga è
          //  uno solo, e il prossimo tocco deve tornare a contare.
          eraLunga.current = false;
          return;
        }
        cambia(vivo.current + 1);
      }}
      //  Il menu di sistema del tocco lungo (copia/condividi) coprirebbe il
      //  gesto proprio mentre lo si sta facendo.
      onContextMenu={(e) => e.preventDefault()}
      title={`Chiamate fatte: ${mostrato}. Un clic ne aggiunge una, tieni premuto per toglierne una.`}
      aria-label={`Chiamate fatte: ${mostrato}. Premi per aggiungerne una, tieni premuto per toglierne una.`}
      className={`inline-flex h-7 shrink-0 select-none items-center gap-0.5 rounded-md px-1 text-[11.5px] font-semibold tabular-nums transition ${
        premuto
          ? "bg-slate-200 text-slate-900"
          : mostrato > 0
            ? "text-sky-700 hover:bg-sky-50"
            : "text-muted-foreground hover:bg-muted"
      }`}
      //  touch-action: la pressione lunga non deve diventare uno scorrimento
      //  né far comparire la lente di ingrandimento di iOS.
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}
    >
      <PhoneCall className="h-3.5 w-3.5" />
      {mostrato}
    </button>
  );
}

function VoceDettaglio({ etichetta, valore }: { etichetta: string; valore?: ReactNode }) {
  if (valore === undefined || valore === null || valore === "" || valore === false) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="shrink-0 text-[11.5px] text-muted-foreground">{etichetta}</span>
      <span className="min-w-0 truncate text-right text-[12.5px] font-medium">{valore}</span>
    </div>
  );
}

function SezionePannello({
  titolo,
  className,
  children,
}: {
  titolo: string;
  /** Serve a mostrare la stessa sezione solo sul telefono o solo sul monitor
   *  (le note stanno in due posti diversi nei due casi). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`border-t border-border px-4 py-3 ${className ?? ""}`}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titolo}
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGINA
   ═══════════════════════════════════════════════════════════════════════════ */

function LeadsPage() {
  //  `reload` non serve più: lo chiamava l'importazione del CSV, che adesso sta
  //  in «Lead importati». Ogni altra scrittura qui passa da updateLead, che
  //  aggiorna il contesto da sé.
  const { leads, consultants, deleteLead, updateLead } = useCRM();
  const { user } = useAuth();

  // ── I FILTRI ──────────────────────────────────────────────────────────
  //  Uno stato solo: si legge dal disco all'apertura, ci si riscrive a ogni
  //  cambiamento. Chi torna sulla pagina ritrova esattamente l'elenco che
  //  stava lavorando.
  const [filtri, setFiltri] = useState<Filtri>(leggiFiltri);
  const { gruppo, esito, consulenteId, scadenza, provenienza, cerca, ordine } = filtri;
  const range = useMemo<DateRange>(
    () => ({ from: filtri.from, to: filtri.to }),
    [filtri.from, filtri.to],
  );
  const statiScelti = useMemo(() => new Set(filtri.stati), [filtri.stati]);
  const fontiScelte = useMemo(() => new Set(filtri.fonti), [filtri.fonti]);

  const imposta = <C extends keyof Filtri>(campo: C, valore: Filtri[C]) =>
    setFiltri((f) => ({ ...f, [campo]: valore }));

  /** Azzera una domanda sola: la X sull'intestazione del blocco. */
  const azzeraDomanda = (d: Domanda) =>
    setFiltri((f) => {
      const next = { ...f };
      for (const campo of DOMANDA_DI[d]) {
        (next as Record<string, unknown>)[campo] = FILTRI_VUOTI[campo];
      }
      return next;
    });

  useEffect(() => {
    scriviFiltri(filtri);
  }, [filtri]);

  /** Il pannello con tutti i filtri e la fascia del periodo: aperti su
   *  richiesta, così la barra resta di una riga sola. */
  const [pannelloFiltri, setPannelloFiltri] = useState(false);
  const [periodoAperto, setPeriodoAperto] = useState(false);
  /** Sul telefono i filtri diventano un foglio dal basso invece di un pannello
   *  ancorato: è l'unica forma che non copre l'elenco e non finisce fuori dallo
   *  schermo. Il contenuto è lo stesso. */
  const telefono = useIsMobile();

  // ── stato dell'elenco ─────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursore, setCursore] = useState(0);
  const [limite, setLimite] = useState(100);
  const [dettaglioId, setDettaglioId] = useState<string | null>(null);
  /** Provenienza e qualifica, aperte a mano: esiste solo sul telefono —
   *  sul monitor quelle sezioni sono sempre a vista e questo non si legge
   *  nemmeno. Si azzera cambiando lead: i dati aperti su una scheda non
   *  sono una preferenza, sono una curiosità su QUELLA persona. */
  const [mostraTuttiIDati, setMostraTuttiIDati] = useState(false);

  //  Cambiando scheda si richiude: vedi la nota qui sopra.
  useEffect(() => {
    setMostraTuttiIDati(false);
  }, [dettaglioId]);
  const [inCorso, setInCorso] = useState(false);
  /** I lead che aspettano la conferma di eliminazione. Vuoto = nessuna
   *  domanda in corso. */
  const [daButtare, setDaButtare] = useState<Lead[]>([]);

  // ── finestre ──────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<Lead | null>(null);
  const [open, setOpen] = useState(false);
  const [quickLead, setQuickLead] = useState<Lead | null>(null);
  const [quickStatus, setQuickStatus] = useState<LeadStatus | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  //  La finestra delle tre chiusure vinte: si porta dietro i suoi stati.
  const chiusura = useChiusura();
  /** Selettore di stato: unico per mouse e tastiera, si filtra scrivendo. */
  const [statoLead, setStatoLead] = useState<Lead | null>(null);
  /** Il lead su cui si è premuta la spunta: apre la nota del compimento. */
  const [compLead, setCompLead] = useState<Lead | null>(null);
  /** Il lead di cui si sta programmando la posa, e se la procedura guidata è
   *  aperta. Due stati e non uno: alla chiusura la finestra ha la sua
   *  animazione, e togliendole il lead nello stesso istante si vedrebbe un
   *  riquadro vuoto per mezzo secondo. Stesso schema della dashboard. */
  const [posaLead, setPosaLead] = useState<Lead | null>(null);
  const [posaAperta, setPosaAperta] = useState(false);
  const apriPosa = (l: Lead) => {
    setPosaLead(l);
    setPosaAperta(true);
  };
  const [aiutoAperto, setAiutoAperto] = useState(false);

  const scrolled = useStickyShadow();
  const cercaRef = useRef<HTMLInputElement | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);
  /** Lo scorrimento automatico deve avvenire SOLO quando è la tastiera a
   *  muovere il cursore: altrimenti ogni ricalcolo del filtro sposterebbe la
   *  pagina sotto le mani di chi sta leggendo. */
  const daTastiera = useRef(false);
  /** Ultima riga toccata: serve alla selezione a intervallo con Shift. */
  const ultimaRiga = useRef<number | null>(null);

  const consultantName = (id?: string | null) =>
    consultants.find((c) => c.id === id)?.data.nome ?? "—";

  /* ── CHI SONO IO ─────────────────────────────────────────────────────────
     "Solo i miei" è il filtro più premuto di tutti, ma funziona solo se la
     pagina sa chi sta guardando. Si prova nell'ordine: la sessione consulente,
     poi l'email con cui si è entrati, poi la scelta fatta a mano una volta —
     così il pulsante c'è anche per chi entra come titolare. */
  const sessioneConsulente = useConsulente();
  const [ioScelto, setIoScelto] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(CHIAVE_IO),
  );
  const scegliIo = (id: string | null) => {
    setIoScelto(id);
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(CHIAVE_IO, id);
    else window.localStorage.removeItem(CHIAVE_IO);
  };
  const ioId = useMemo(() => {
    if (sessioneConsulente?.id) return sessioneConsulente.id;
    const mail = (user?.email || "").toLowerCase();
    const perEmail = mail
      ? consultants.find((c) => (c.data.email || "").toLowerCase() === mail)
      : undefined;
    if (perEmail) return perEmail.id;
    return ioScelto && consultants.some((c) => c.id === ioScelto) ? ioScelto : null;
  }, [sessioneConsulente, user?.email, consultants, ioScelto]);

  /** ── CHI PUÒ COMPARIRE DOVE SI SCEGLIE UN CONSULENTE ────────────────────
   *  Uno solo per tutta la pagina, e usato da TUTTI e quattro i punti che qui
   *  dentro mostrano dei nomi: il filtro «Di chi è», la domanda «Chi sei?», la
   *  tendina «Assegnazione» del pannello di dettaglio e il menu «Assegna» della
   *  selezione multipla. Quattro elenchi che rispondono alla stessa domanda in
   *  quattro modi diversi sono il motivo per cui poi nessuno si fida del primo.
   *  Le consulenze le fanno i consulenti: chi telefona, guida o posa non entra
   *  in nessuno dei quattro.
   *  ⚠️ Si passa `leads` perché chi ha già delle trattative assegnate deve
   *  restare visibile anche senza spunta — togliendolo, le sue trattative non
   *  si potrebbero più isolare col filtro e il pannello mostrerebbe un campo
   *  vuoto al posto di chi ci sta lavorando. Il ripiego (nessuno segnato in
   *  anagrafica = ci sono tutti, e lo si dice) sta in crm/chi-fa-la-consulenza. */
  const { elenco: consulentiScelta, ripiego: ripiegoConsulenti } = useMemo(
    () => consulentiPerConsulenza(consultants, { leads, anche: [ioId] }),
    [consultants, leads, ioId],
  );

  /* ── IL CARICAMENTO DI UNA LISTA NON STA PIÙ QUI ─────────────────────────
     C'era un pulsante «Importa lista» nella testata, che leggeva il CSV e lo
     scriveva senza mostrare niente prima: quante righe erano state capite,
     quante sarebbero state saltate e perché si scopriva a cose fatte. Adesso
     il caricamento vive dove la lista poi si lavora — «Lead importati»,
     /CRM/avanzamento — con l'anteprima davanti. Qui resta il collegamento, che
     è quello che serve a chi il pulsante lo cercava in questa pagina. */

  /* ── CAMBIO STATO ────────────────────────────────────────────────────────
     Gli stati che hanno bisogno di importi o date aprono la loro finestra;
     gli altri si applicano subito, senza conferme intermedie. */
  const cambiaStato = async (lead: Lead, nuovo: LeadStatus) => {
    setStatoLead(null);
    if (nuovo === lead.data.stato) return;
    //  Le tre chiusure vinte hanno la loro finestra, che scrive stato, importi
    //  e modo di consegna in un salvataggio solo. ⚠️ Il ramo va PRIMA di
    //  `requiresAnyDialog` e non scrive niente da sé: vedi ChiusuraDialog.
    if (chiusura.intercetta(lead, nuovo)) return;
    if (requiresAnyDialog(nuovo)) {
      setQuickLead(lead);
      setQuickStatus(nuovo);
      //  La finestra dei dettagli si apre dopo che il selettore si è chiuso:
      //  due finestre che si scambiano il posto nello stesso istante lasciano
      //  la pagina non cliccabile.
      setTimeout(() => setQuickOpen(true), 60);
      return;
    }
    try {
      const prima = lead.data.stato;
      await updateLead(lead.id, { stato: nuovo });
      /* ── ⚠️ CON DEI SOLDI IN CASSA, «ANNULLA» A PORTATA DI MANO ───────────
         Fino a ieri una pratica con l'acconto versato non si POTEVA spostare:
         qualunque stato si scegliesse, `applyAutoStatus` la riportava a
         «Acconto incassato». Adesso si sposta davvero — è quello che serviva —
         ma sposta anche i soldi: da certi stati quella pratica smette di
         contare fra le vendite del mese.
         Non è una domanda prima («sei sicuro?» si impara a premere senza
         leggere): è il passo indietro subito dopo, accanto alla conferma,
         mentre si sta ancora guardando la riga. Compare SOLO dove c'è una
         conseguenza, cioè con dei soldi dentro: altrove sarebbe rumore su ogni
         cambio di stato della giornata. */
      const inCassa = Number(lead.data.payment?.accontoPagato) || 0;
      toast.success(
        `${lead.data.nome} ${lead.data.cognome} → ${LEAD_STATUS_LABEL[nuovo]}`,
        inCassa > 0
          ? {
              description: `In cassa restano ${eur(inCassa)}: da questo stato la pratica può non contare più fra le vendite.`,
              action: {
                label: "Annulla",
                onClick: () => void updateLead(lead.id, { stato: prima }),
              },
            }
          : undefined,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aggiornamento non riuscito");
    }
  };

  /* ── IL CONTATORE DELLE CHIAMATE ────────────────────────────────────────
     Scrive e basta: niente toast di conferma. Il numero cambia SUL pulsante
     che si sta premendo — è già la conferma — e un avviso a ogni tocco su un
     gesto che si ripete venti volte di fila diventa una fila di riquadri che
     copre l'elenco. Si parla solo quando qualcosa va storto, perché quello
     invece non si vede da nessuna parte.

     ⚠️ `updateLead` oggi non solleva: se la scrittura fallisce scrive in
     console e torna zitto, quindi questo `catch` copre solo gli errori di rete
     veri. È così per TUTTA la pagina (anche il cambio di stato annuncia il
     successo comunque): la correzione sta nel contesto, ed è in «richieste». */
  const segnaChiamate = async (l: Lead, valore: number) => {
    const n = Math.max(0, Math.round(valore));
    try {
      //  ⚠️ Il campo non è ancora nel tipo (vedi DatiConChiamate): il cast è
      //  circoscritto a questa riga e sparisce appena entra in crm/types.
      await updateLead(l.id, { chiamateFatte: n } as Partial<DatiConChiamate>);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chiamata non registrata");
    }
  };

  /* ── LA SPUNTA: L'IMPEGNO È STATO ONORATO ───────────────────────────────
     Un gesto solo dalla riga, e UNA finestra sola in fondo.

     ⚠️ Prima qui c'era `requiresAnyDialog(meta.stato)`, e per l'acconto voleva
     dire saltare la conferma e aprire dritto il modulo degli importi: sette
     campi per dire «l'anticipo è arrivato», in mezzo a una telefonata. Adesso
     la regola è più stretta e guarda una cosa sola: lo stato d'arrivo si può
     scrivere senza chiedere altro?
      · un APPUNTAMENTO no — senza giorno e ora non esiste, e nessuna conferma
        può inventarli: lì si apre la procedura, come sempre;
      · l'ACCONTO sì — l'importo è un di più, non una condizione. Si conferma,
        e chi vuole metterlo a numero apre da lì la finestra di sempre.
     La domanda non ha una risposta scritta qui: la dà `apreProceduraQuando`,
     che legge la tabella del «quando» (crm/quando-per-stato.ts). Da quando la
     legge per intero, la spunta su «Ricontatto fissato» — che porta a «In
     valutazione» — chiede anche il giorno in cui lo si risente, invece di
     lasciare il lead in valutazione con addosso la data del richiamo di ieri:
     era il modo più silenzioso di far sparire un lead dalle code. */
  const avviaCompimento = (l: Lead) => {
    const meta = compimentoDi(l.data?.stato);
    if (!meta) return;
    if (apreProceduraQuando(meta.stato)) {
      setQuickLead(l);
      setQuickStatus(meta.stato);
      setQuickOpen(true);
      return;
    }
    setCompLead(l);
  };

  /* ── LA PASTIGLIA: UN CLIC, POI LA CONFERMA ─────────────────────────────
     Richiesta del committente sull'«Attesa acconto». Chi ha un passo ovvio lo
     propone subito (una finestra, che dice cliente, da dove a dove e cosa
     comporta); tutti gli altri aprono il selettore come hanno sempre fatto.
     La scelta di QUALI stati sta in STATI_A_PASSO_OVVIO, non qui: la pagina
     non deve sapere niente del significato degli stati. */
  const apriStato = (l: Lead) => {
    if (passoOvvioDi(l.data?.stato)) {
      setCompLead(l);
      return;
    }
    setStatoLead(l);
  };

  /* ── DALLA CONFERMA AGLI IMPORTI ────────────────────────────────────────
     Non è un secondo passaggio della stessa conferma: è un cambio di strada,
     e infatti quella che si lascia NON scrive niente. Il rinvio di 60ms è lo
     stesso di `cambiaStato`: due finestre che si scambiano il posto nello
     stesso istante lasciano la pagina non cliccabile. */
  const daCompimentoA = (l: Lead, dove: "importi" | "stato") => {
    const meta = compimentoDi(l.data?.stato);
    setCompLead(null);
    setTimeout(() => {
      if (dove === "stato") {
        setStatoLead(l);
        return;
      }
      if (!meta) return;
      setQuickLead(l);
      setQuickStatus(meta.stato);
      setQuickOpen(true);
    }, 60);
  };

  const deltaPoints = useMemo<RangeDeltaPoint[]>(() => {
    return leads.map((l) => {
      const raw = leadAttributionDate(l) || l.data.createdAt || "";
      const date = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10);
      return {
        date,
        lead: 1,
        conversions: leadIsConverted(l) ? 1 : 0,
        revenue: leadRevenue(l),
      };
    });
  }, [leads]);
  const presetDeltas = useMemo(() => computeAllPresetDeltas(deltaPoints), [deltaPoints]);

  /** Quanti lead ci sono in ogni gruppo: il numero sta sulla scheda, così si
   *  sceglie dove andare senza aprire e tornare indietro. */
  const conteggioGruppi = useMemo(() => {
    const c: Record<Gruppo, number> = {
      attivi: 0,
      ricontattare: 0,
      gia_presenti: 0,
      annullati: 0,
      conclusi: 0,
      tutte: leads.length,
    };
    for (const l of leads) {
      //  `eImportato` resta: serve a tenere le righe di una lista mai lavorata
      //  fuori da «In corso» e da «Non interessati», che è il motivo per cui
      //  esisteva prima ancora del gruppo.
      const imp = eImportato(l);
      if (
        !imp &&
        !["concluso", "annullato", "da_contattare", "non_risponde", "segreteria"].includes(
          l.data.stato,
        )
      )
        c.attivi++;
      if (DA_RICONTATTARE.includes(l.data.stato) || l.data.callbackAt) c.ricontattare++;
      if (l.data.giaPresente) c.gia_presenti++;
      if (l.data.stato === "annullato" && !imp) c.annullati++;
      if (l.data.stato === "concluso") c.conclusi++;
    }
    return c;
  }, [leads]);

  /* ── IL GRUPPO SELEZIONA, NON ORDINA ─────────────────────────────────────
     Qui si decide solo CHI entra nell'elenco. L'ordine si dà una volta sola in
     fondo alla catena, su quello che è rimasto dopo i filtri: ordinare ottocento
     righe per poi buttarne cinquecento è lavoro pagato due volte, e soprattutto
     erano due regole d'ordine diverse che potevano divergere. */
  const perGruppo = useMemo(() => {
    if (gruppo === "ricontattare")
      return leads.filter((l) => DA_RICONTATTARE.includes(l.data.stato) || !!l.data.callbackAt);
    if (gruppo === "gia_presenti") return leads.filter((l) => !!l.data.giaPresente);
    if (gruppo === "annullati")
      return leads.filter((l) => l.data.stato === "annullato" && !eImportato(l));
    if (gruppo === "conclusi") return leads.filter((l) => l.data.stato === "concluso");
    //  L'archivio intero: si arriva qui dal totale del conteggio, e la domanda
    //  è "dov'è finito quel nome", non "cosa devo fare oggi".
    if (gruppo === "tutte") return leads;
    //  In corso: i lead vivi. Fuori gli importati mai lavorati e i chiusi.
    return leads.filter(
      (l) =>
        !eImportato(l) &&
        !["concluso", "annullato", "da_contattare", "non_risponde", "segreteria"].includes(
          l.data.stato,
        ),
    );
  }, [leads, gruppo]);

  /** ── I CONTEGGI DEI FILTRI SONO RELATIVI AL GRUPPO APERTO ───────────────
   *  Un numero deve dire quanti risultati otterrò premendo QUEL filtro adesso.
   *  Contarli su tutto l'archivio faceva vedere "42" e poi zero righe. */
  const conteggi = useMemo(() => {
    const stato: Record<string, number> = {};
    const consulente: Record<string, number> = {};
    const fonte: Record<string, number> = {};
    const quando: Record<string, number> = {
      ritardo: 0,
      oggi: 0,
      settimana: 0,
      senza_data: 0,
    };
    const dove: Record<string, number> = { importati: 0, diretti: 0, rientri: 0 };
    let senzaConsulente = 0;
    let evidenziati = 0;
    //  Le consulenze svolte non si leggono più da uno stato: si contano riga
    //  per riga con lo stesso criterio dell'agenda (vedi consulenzaSvolta).
    let svolte = 0;
    //  UNA PASSATA SOLA per tutti i numeri di tutti e quattro i blocchi:
    //  ottocento righe attraversate quattro volte a ogni battuta della ricerca
    //  si sentono, e prossimaAzione() dentro scadenzaDi() non è gratis.
    for (const l of perGruppo) {
      if (consulenzaSvolta(l)) svolte++;
      stato[l.data.stato] = (stato[l.data.stato] || 0) + 1;
      if (l.data.consulenteId)
        consulente[l.data.consulenteId] = (consulente[l.data.consulenteId] || 0) + 1;
      else senzaConsulente++;
      if (l.data.highlighted) evidenziati++;
      const s = scadenzaDi(l);
      if (s) quando[s]++;
      fonte[fonteDi(l)] = (fonte[fonteDi(l)] || 0) + 1;
      if (l.data.importato) dove.importati++;
      else dove.diretti++;
      if (l.data.giaPresente) dove.rientri++;
    }
    return {
      stato,
      consulente,
      fonte,
      quando,
      dove,
      senzaConsulente,
      evidenziati,
      //  "Non fatto" comprende i no-show: sono la stessa cosa vista da due lati.
      //  "Svolte" invece non è più la somma di uno stato: è il conto qui sopra,
      //  cioè tutti gli appuntamenti avvenuti che non sono assenti né da
      //  riprogrammare. Il numero è più alto di prima e deve esserlo.
      esito: {
        fatto: svolte,
        no_show: (stato.non_fatto || 0) + (stato.no_show || 0),
        da_spostare: stato.da_spostare || 0,
      } as Record<Esito, number>,
    };
  }, [perGruppo]);

  /** Le fonti che esistono davvero nel gruppo aperto (più quelle già scelte,
   *  altrimenti un filtro acceso sparirebbe dall'elenco e non si potrebbe più
   *  togliere da lì). In ordine di quantità: le prime due voci coprono il 90%
   *  dei casi e devono stare in cima. */
  const fontiPresenti = useMemo(() => {
    const chiavi = new Set([...Object.keys(conteggi.fonte), ...filtri.fonti]);
    return [...chiavi].sort((a, b) => (conteggi.fonte[b] || 0) - (conteggi.fonte[a] || 0));
  }, [conteggi.fonte, filtri.fonti]);

  /** ── LE NOTE DIETRO A UNA VOCE DI FILTRO ────────────────────────────────
   *  «Ricontatto fissato: 34» dice quanti, non cosa. Passando sopra la voce si
   *  legge l'ultima cosa detta a ciascuno di quei 34 — che è la ragione per cui
   *  si sta guardando quel filtro. Una passata sola sul gruppo aperto, la
   *  stessa che serve ai conteggi. Le schede storiche segnate "non_fatto"
   *  confluiscono in "no_show" come fa il filtro: la voce è una sola. */
  const notePerStato = useMemo(
    () =>
      raccogliNote(perGruppo, (l) => (l.data?.stato === "non_fatto" ? "no_show" : l.data?.stato)),
    [perGruppo],
  );

  /* ── LA CATENA DEI FILTRI, NELL'ORDINE DELLE QUATTRO DOMANDE ─────────────
     Prima quello che scarta di più e costa meno (stato, consulente), poi le
     date, in fondo il testo — che è l'unico che deve normalizzare stringhe su
     ogni riga. Il conto finale è sempre lo stesso: cambia solo quanto lavoro
     fa la macchina mentre si scrive nella ricerca. */
  const filtrati = useMemo(() => {
    //  Una casella sola cerca su tutto: nome, cognome, telefono, email, città.
    //  Chiedere PRIMA su quale campo cercare è la ragione per cui si finisce a
    //  scorrere l'elenco a mano. Il testo si confronta senza accenti e il
    //  telefono a sole cifre, così "Nicolò" si trova scrivendo "nicolo" e
    //  "+39 333 12" trova "3331234567".
    const q = normalizza(cerca).trim();
    const qCifre = soloCifre(cerca);
    const base = perGruppo.filter((l) => {
      // ── A CHE PUNTO È ───────────────────────────────────────────────────
      if (esito) {
        //  La lente e il numero che le sta sopra devono dare lo stesso insieme:
        //  «Svolte» chiede a consulenzaSvolta (un calcolo), gli altri due
        //  restano confronti di stato — "Cliente assente" tira dentro anche le
        //  schede storiche segnate "non_fatto".
        const ok =
          esito === "fatto"
            ? consulenzaSvolta(l)
            : esito === "no_show"
              ? l.data.stato === "non_fatto" || l.data.stato === "no_show"
              : l.data.stato === esito;
        if (!ok) return false;
      }
      if (statiScelti.size > 0) {
        //  Scegliendo "Cliente assente" si prendono anche le schede storiche
        //  segnate "non_fatto": è lo stesso fatto scritto con la parola vecchia.
        const suo = l.data.stato === "non_fatto" ? "no_show" : l.data.stato;
        if (!statiScelti.has(suo) && !statiScelti.has(l.data.stato)) return false;
      }
      // ── DI CHI È ────────────────────────────────────────────────────────
      if (consulenteId === "nessuno") {
        if (l.data.consulenteId) return false;
      } else if (consulenteId !== "all" && l.data.consulenteId !== consulenteId) return false;
      if (filtri.evidenziati && !l.data.highlighted) return false;
      // ── QUANDO ──────────────────────────────────────────────────────────
      //  La scadenza guarda la PROSSIMA AZIONE (quando va sentito), il periodo
      //  guarda la data di INGRESSO (quando è arrivato): due domande diverse
      //  che stavano nello stesso blocco e si scambiavano per la stessa.
      if (scadenza !== "tutte" && scadenzaDi(l) !== scadenza) return false;
      if (range.from || range.to) {
        const d = (l.data.createdAt || "").slice(0, 10);
        // Solo "from" → singolo giorno
        if (range.from && !range.to && d !== range.from) return false;
        if (range.from && range.to && (d < range.from || d > range.to)) return false;
        if (!range.from && range.to && d > range.to) return false;
      }
      // ── DA DOVE VIENE ───────────────────────────────────────────────────
      if (fontiScelte.size > 0 && !fontiScelte.has(fonteDi(l))) return false;
      if (provenienza === "importati" && !l.data.importato) return false;
      if (provenienza === "diretti" && l.data.importato) return false;
      if (provenienza === "rientri" && !l.data.giaPresente) return false;
      // ── LA RICERCA, PER ULTIMA ──────────────────────────────────────────
      //  ⚠️ LA REGOLA STA IN `crm/ricerca-lead`, non più qui. Prima questa
      //   pagina guardava nome, cognome, email, città e telefono; la ricerca
      //   delle pose, nata dopo, doveva guardare anche le NOTE. Due regole
      //   diverse volevano dire cercare «citofono rotto» in una schermata e
      //   trovarlo, cercarlo nell'altra e no — con le stesse identiche parole,
      //   sullo stesso identico archivio. Adesso è una sola, e guarda anche le
      //   note: da qui non si trova meno di prima, si trova di più.
      if (!q && !qCifre) return true;
      return trovaNelLead(l, q, qCifre);
    });
    //  L'ordine si dà QUI, sull'elenco già ridotto. Il default è l'imminenza —
    //  chi va sentito prima sta in cima — e vale in tutti i gruppi. Gli altri
    //  due servono a cercare a mano ("l'avevo inserito ieri", "come si
    //  chiamava di cognome") e non pretendono di dire cosa fare.
    if (ordine === "recenti") {
      return [...base].sort((a, b) =>
        (b.data.createdAt || "").localeCompare(a.data.createdAt || ""),
      );
    }
    if (ordine === "nome") {
      return [...base].sort((a, b) => perCognome(a).localeCompare(perCognome(b), "it"));
    }
    return ordinaPerUrgenza(base);
  }, [
    perGruppo,
    esito,
    statiScelti,
    cerca,
    consulenteId,
    filtri.evidenziati,
    scadenza,
    range,
    fontiScelte,
    provenienza,
    ordine,
  ]);

  const visibili = useMemo(() => filtrati.slice(0, limite), [filtrati, limite]);
  const dettaglio = useMemo(
    () => leads.find((l) => l.id === dettaglioId) || null,
    [leads, dettaglioId],
  );

  /* ── LE PASTIGLIE: I FILTRI ACCESI, SEMPRE IN VISTA ──────────────────────
     Una per filtro attivo, ognuna con la sua X. È l'unico posto in cui si
     legge "perché vedo solo queste righe", e si spegne senza riaprire il menu
     da cui il filtro è nato. Gli stati e le fonti restano raggruppati quando
     sono più di uno: dieci pastiglie di stato sono una barra che cresce a
     dismisura e copre l'elenco che sta filtrando.
     L'ordine è quello delle quattro domande, lo stesso del pannello: chi ha
     acceso un filtro lo ritrova dov'era. */
  const pastiglie = useMemo(() => {
    const p: {
      chiave: string;
      etichetta?: string;
      valore: string;
      classe?: string;
      via: () => void;
    }[] = [];
    if (cerca) p.push({ chiave: "cerca", valore: `"${cerca}"`, via: () => imposta("cerca", "") });
    if (esito)
      p.push({
        chiave: "esito",
        etichetta: "Esito",
        //  Il nome arriva dalla lente e non da LEAD_STATUS_LABEL: la lente
        //  verde si chiama "Svolta" perché non è più lo stato "Consulenza
        //  svolta" — è tutto ciò che una consulenza l'ha avuta davvero.
        valore: LENTI_ESITO.find((e) => e.stato === esito)?.nome ?? esito,
        classe: LENTI_ESITO.find((e) => e.stato === esito)?.spento,
        via: () => imposta("esito", null),
      });
    if (filtri.stati.length === 1)
      p.push({
        chiave: "stato",
        etichetta: "Stato",
        valore: LEAD_STATUS_LABEL[filtri.stati[0] as LeadStatus] ?? filtri.stati[0],
        classe: classiStato(filtri.stati[0]),
        via: () => imposta("stati", []),
      });
    else if (filtri.stati.length > 1)
      p.push({
        chiave: "stato",
        valore: `${filtri.stati.length} stati`,
        via: () => imposta("stati", []),
      });
    if (consulenteId !== "all")
      p.push({
        chiave: "consulente",
        etichetta: "Consulente",
        valore:
          consulenteId === "nessuno"
            ? "nessuno"
            : `${consultantName(consulenteId)}${consulenteId === ioId ? " (io)" : ""}`,
        via: () => imposta("consulenteId", "all"),
      });
    if (scadenza !== "tutte") {
      const v = VOCI_SCADENZA.find((x) => x.chiave === scadenza);
      p.push({
        chiave: "scadenza",
        etichetta: "Quando",
        valore: v?.titolo ?? scadenza,
        classe: v?.classe,
        via: () => imposta("scadenza", "tutte"),
      });
    }
    if (range.from || range.to)
      p.push({
        chiave: "periodo",
        etichetta: "Entrati",
        valore: etichettaPeriodo(range.from, range.to),
        via: () => setFiltri((f) => ({ ...f, from: null, to: null })),
      });
    if (filtri.fonti.length === 1)
      p.push({
        chiave: "fonte",
        etichetta: "Fonte",
        valore: filtri.fonti[0] === SENZA_FONTE ? "senza fonte" : filtri.fonti[0],
        via: () => imposta("fonti", []),
      });
    else if (filtri.fonti.length > 1)
      p.push({
        chiave: "fonte",
        valore: `${filtri.fonti.length} fonti`,
        via: () => imposta("fonti", []),
      });
    if (provenienza !== "tutte")
      p.push({
        chiave: "provenienza",
        etichetta: "Entrato",
        valore: VOCI_PROVENIENZA.find((v) => v.chiave === provenienza)?.titolo ?? provenienza,
        via: () => imposta("provenienza", "tutte"),
      });
    if (filtri.evidenziati)
      p.push({
        chiave: "evidenziati",
        valore: "Da seguire",
        classe: "border-amber-200 bg-amber-50 text-amber-700",
        via: () => imposta("evidenziati", false),
      });
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cerca,
    esito,
    filtri.stati,
    filtri.fonti,
    filtri.evidenziati,
    consulenteId,
    scadenza,
    provenienza,
    range,
    ioId,
    consultants,
  ]);

  const filtriAttivi = pastiglie.length > 0;

  const azzeraFiltri = () =>
    setFiltri((f) => ({
      ...FILTRI_VUOTI,
      //  Il gruppo e l'ordinamento non sono filtri: sono dove sto guardando e
      //  come sto guardando. Azzerando i filtri non si cambia stanza.
      gruppo: f.gruppo,
      ordine: f.ordine,
    }));

  /** Cambiando filtro si riparte dall'alto: la posizione del cursore su un
   *  elenco diverso non significa più niente. */
  const chiaveFiltri = `${gruppo}|${esito}|${[...filtri.stati].sort().join(",")}|${consulenteId}|${filtri.evidenziati}|${scadenza}|${range.from}|${range.to}|${[...filtri.fonti].sort().join(",")}|${provenienza}|${cerca}|${ordine}`;
  useEffect(() => {
    setCursore(0);
    setLimite(100);
  }, [chiaveFiltri]);

  useEffect(() => {
    setCursore((c) => Math.max(0, Math.min(c, filtrati.length - 1)));
  }, [filtrati.length]);

  /** Porta in vista la riga sotto il cursore, ma solo se ci è arrivata la tastiera. */
  useEffect(() => {
    if (!daTastiera.current) return;
    daTastiera.current = false;
    const l = filtrati[cursore];
    if (!l) return;
    listaRef.current?.querySelector(`[data-riga="${l.id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursore, filtrati]);

  /** Carica altre righe quando si arriva in fondo: ottocento righe montate
   *  tutte insieme rallentano la digitazione nella ricerca. */
  const sentinellaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinellaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (voci) => {
        if (voci[0]?.isIntersecting) setLimite((n) => n + 100);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtrati.length, limite]);

  /* ── SELEZIONE ─────────────────────────────────────────────────────────── */
  const selezionaRiga = (indice: number, conShift: boolean) => {
    const l = filtrati[indice];
    if (!l) return;
    setSelected((prec) => {
      const next = new Set(prec);
      //  Shift seleziona un intervallo: su una lista da richiamare si prendono
      //  venti righe di fila, non venti righe una per una.
      if (conShift && ultimaRiga.current !== null) {
        const [da, a] = [
          Math.min(ultimaRiga.current, indice),
          Math.max(ultimaRiga.current, indice),
        ];
        const accendi = !prec.has(l.id);
        for (let i = da; i <= a; i++) {
          const r = filtrati[i];
          if (!r) continue;
          if (accendi) next.add(r.id);
          else next.delete(r.id);
        }
      } else if (next.has(l.id)) next.delete(l.id);
      else next.add(l.id);
      return next;
    });
    ultimaRiga.current = indice;
  };

  const tuttiSelezionati = filtrati.length > 0 && filtrati.every((l) => selected.has(l.id));
  const selezionaTutti = () => {
    setSelected(tuttiSelezionati ? new Set() : new Set(filtrati.map((l) => l.id)));
  };

  const selezionati = useMemo(
    () => filtrati.filter((l) => selected.has(l.id)),
    [filtrati, selected],
  );

  /* ── AZIONI DI GRUPPO ──────────────────────────────────────────────────── */
  const apriWhatsApp = (l: Lead) => {
    if (!l.data.telefono) return;
    const msg = getWhatsAppMessageForStatus(l, consultantName(l.data.consulenteId));
    window.open(buildWhatsAppLink(l.data.telefono, msg), "_blank");
  };

  const whatsappMassivo = () => {
    const target = selezionati.filter((l) => l.data.telefono);
    if (!target.length) return;
    // Apertura scaglionata: i browser bloccano le finestre aperte tutte insieme.
    target.forEach((l, i) => setTimeout(() => apriWhatsApp(l), i * 200));
    toast.message(`Apro ${target.length} conversazioni`, {
      description: "Una finestra per contatto.",
    });
  };

  const statoMassivo = async (s: LeadStatus) => {
    setInCorso(true);
    let fatti = 0;
    try {
      for (const l of selezionati) {
        if (l.data.stato === s) continue;
        await updateLead(l.id, { stato: s });
        fatti++;
      }
      toast.success(`${fatti} lead → ${LEAD_STATUS_LABEL[s]}`);
    } finally {
      setInCorso(false);
    }
  };

  const assegnaMassivo = async (cid: string | null) => {
    setInCorso(true);
    try {
      for (const l of selezionati) await updateLead(l.id, { consulenteId: cid });
      toast.success(
        cid
          ? `${selezionati.length} lead a ${consultantName(cid)}`
          : `${selezionati.length} lead senza consulente`,
      );
    } finally {
      setInCorso(false);
    }
  };

  /** ⚠️ QUI LA RISPOSTA SI BUTTAVA VIA, E DICEVA SEMPRE CHE ERA ANDATA BENE.
   *   `deleteLead` risponde `true` solo quando la riga è sparita DAVVERO
   *   dall'archivio (crm/CRMContext: un `delete` che non tocca nessuna riga —
   *   regola del database che rifiuta — non è un errore per Supabase); questo
   *   ciclo lo ignorava, svuotava la selezione e scriveva «Lead eliminati» in
   *   verde. Su venti lead con tre rifiuti: tre persone ancora in archivio,
   *   fuori dalla selezione, sotto un messaggio che diceva il contrario — e
   *   nessuno che le rifacesse. Adesso si contano e le rimaste RESTANO
   *   SELEZIONATE, che è la disciplina delle azioni di gruppo di /CRM/importa:
   *   quello che l'archivio ha rifiutato resta sotto gli occhi, pronto per un
   *   secondo tentativo. */
  /** ── ⚠️ LA CONFERMA NON È PIÙ QUELLA DEL BROWSER ────────────────────────
   *  Qui c'era `confirm()`: una riga di testo grigia in cima allo schermo con
   *  scritto «Eliminare 23 lead?» e due pulsanti. Tre cose che non poteva
   *  fare, e sono le tre che servono proprio qui:
   *   · dire CHI. «23 lead» non fa vedere se dentro c'è quello sbagliato, e in
   *     un elenco preso con Maiusc su venti righe è esattamente la domanda;
   *   · distinguere il pulsante che cancella da quello che non fa niente —
   *     nel riquadro del browser sono due pulsanti grigi identici;
   *   · essere in italiano corrente e con lo stesso aspetto del resto: una
   *     finestra di sistema in mezzo a un CRM sembra un errore della pagina, e
   *     un errore lo si chiude senza leggerlo.
   *  ⚠️ E `confirm()` BLOCCA il thread: su una lista lunga la pagina si ferma
   *   davvero, e chi la guarda non sa se sta aspettando lui o il programma.
   *  Adesso è la stessa finestra delle fatture: nomi dentro, rosso solo sul
   *  pulsante che cancella. */
  const eliminaMassivo = async () => {
    const bersagli = daButtare.length > 0 ? daButtare : selezionati;
    if (bersagli.length === 0) return;
    setDaButtare([]);
    setInCorso(true);
    const falliti: Lead[] = [];
    try {
      for (const l of bersagli) {
        if (!(await deleteLead(l.id))) falliti.push(l);
      }
    } finally {
      setInCorso(false);
    }
    setSelected(new Set(falliti.map((l) => l.id)));
    const fatti = bersagli.length - falliti.length;
    if (fatti > 0) {
      toast.success(fatti === 1 ? "1 lead eliminato" : `${fatti} lead eliminati`, {
        description: "Non c'è un cestino: quello che è uscito non torna.",
      });
    }
    if (falliti.length > 0) {
      //  Il motivo del database l'ha già detto `deleteLead`, una volta sola
      //  (i suoi avvisi hanno un id fisso e non si impilano): qui serve il
      //  CONTO, che è l'unica cosa che quel messaggio non può sapere.
      toast.error(
        falliti.length === 1 ? "1 lead NON eliminato" : `${falliti.length} lead NON eliminati`,
        { description: "Sono ancora in archivio e restano selezionati. Riprova." },
      );
    }
  };

  /* ── ESPORTAZIONE ──────────────────────────────────────────────────────── */
  const esportaCsv = (righe: Lead[], suffisso: string) => {
    if (righe.length === 0) return;
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = [
      "Data acquisizione",
      "Nome",
      "Cognome",
      "Telefono",
      "Email",
      "Citta",
      "Fonte",
      "Piattaforma Ads",
      "UTM source",
      "UTM campaign",
      "Stato",
      "Consulente",
      "Disagio",
      "Urgenza",
      "Pain points",
      "Data meeting",
      "Ora meeting",
      "Acconto pagato",
      "Prezzo finale",
      "Saldo rimanente",
      "Data installazione",
      "Note",
    ];
    const rows = righe.map((l) => [
      l.data.createdAt?.slice(0, 10) || "",
      l.data.nome,
      l.data.cognome,
      l.data.telefono,
      l.data.email || "",
      l.data.citta || "",
      l.data.fonte || "",
      l.data.piattaformaAds || "",
      l.data.tracking?.utm_source || "",
      l.data.tracking?.utm_campaign || "",
      LEAD_STATUS_LABEL[l.data.stato],
      consultantName(l.data.consulenteId),
      l.data.qualifica?.disagio ?? "",
      l.data.qualifica?.urgenza || "",
      (l.data.qualifica?.painPoints || []).join("|"),
      l.data.dataMeeting || "",
      l.data.oraMeeting || "",
      l.data.payment?.accontoPagato ?? "",
      l.data.payment?.prezzoFinaleVendita ?? "",
      l.data.payment?.saldoRimanente ?? "",
      l.data.installazione?.dataInstallazione || "",
      l.data.note || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    // Il BOM serve a Excel per aprire il file in UTF-8 senza accenti rotti.
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lead-${suffisso}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── SCORCIATOIE DA TASTIERA ─────────────────────────────────────────────
     Chi lavora l'elenco tiene le mani sulla tastiera: scorrere, aprire e
     cambiare stato sono i tre gesti che si ripetono centinaia di volte al
     giorno, e con il mouse costano ogni volta un puntamento.
     Non intercettiamo niente mentre si scrive o mentre è aperta una finestra:
     lì i tasti appartengono al campo, non alla pagina. */
  //  Il foglio dei filtri è una finestra come le altre: finché è aperto i tasti
  //  appartengono a lui. Senza questa riga "j" scorreva l'elenco NASCOSTO sotto
  //  al foglio, e alla chiusura ci si ritrovava altrove senza sapere perché.
  const bloccato = open || quickOpen || !!statoLead || !!compLead || posaAperta || pannelloFiltri;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const scrivendo =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (scrivendo) {
        if (e.key === "Escape") t?.blur();
        return;
      }
      if (bloccato || e.metaKey || e.ctrlKey || e.altKey) return;
      //  Con un menu o un calendario aperto i tasti appartengono a quello:
      //  altrimenti "Esc" chiuderebbe il menu E il pannello nello stesso colpo.
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      const corrente = filtrati[cursore];
      const muovi = (delta: number) => {
        e.preventDefault();
        daTastiera.current = true;
        const n = Math.max(0, Math.min(filtrati.length - 1, cursore + delta));
        //  Scorrendo oltre le righe già montate se ne montano altre: la
        //  tastiera non deve mai fermarsi contro un limite tecnico.
        if (n >= limite) setLimite(n + 40);
        setCursore(n);
      };
      switch (e.key) {
        case "ArrowDown":
        case "j":
          return muovi(1);
        case "ArrowUp":
        case "k":
          return muovi(-1);
        case "PageDown":
          return muovi(10);
        case "PageUp":
          return muovi(-10);
        case "Home":
          return muovi(-filtrati.length);
        case "End":
          return muovi(filtrati.length);
        case "Enter":
          if (corrente) {
            e.preventDefault();
            setDettaglioId(corrente.id);
          }
          return;
        case " ":
          if (corrente) {
            e.preventDefault();
            selezionaRiga(cursore, e.shiftKey);
          }
          return;
        //  S apre SEMPRE l'elenco completo, anche sugli stati a passo ovvio:
        //  la pastiglia lì propone l'unico seguito naturale, ma chi lavora a
        //  tastiera scorre venti righe e su una vuole "annullato" — un tasto
        //  che a seconda della riga fa due cose diverse si preme alla cieca.
        case "s":
        case "S":
          if (corrente) {
            e.preventDefault();
            setStatoLead(corrente);
          }
          return;
        case "m":
        case "M":
          if (corrente) {
            e.preventDefault();
            setEditing(corrente);
            setOpen(true);
          }
          return;
        case "w":
        case "W":
          if (corrente) {
            e.preventDefault();
            apriWhatsApp(corrente);
          }
          return;
        case "c":
        case "C":
          if (corrente?.data.telefono) {
            e.preventDefault();
            window.location.href = `tel:${corrente.data.telefono}`;
          }
          return;
        case "f":
        case "F":
          if (corrente) {
            e.preventDefault();
            void updateLead(corrente.id, { highlighted: !corrente.data.highlighted });
          }
          return;
        //  V come videochiamata, P come posa: gli stessi due tasti che stanno
        //  sulla riga, e valgono solo dove il tasto c'è — premere V su un
        //  contatto mai chiamato non deve aprire nessuna stanza.
        case "v":
        case "V":
          if (corrente && puoAvviareConsulenza(corrente)) {
            e.preventDefault();
            void avviaConsulenza(corrente);
          }
          return;
        case "p":
        case "P":
          if (corrente && puoProgrammareLaPosa(corrente)) {
            e.preventDefault();
            apriPosa(corrente);
          }
          return;
        case "a":
        case "A":
          e.preventDefault();
          selezionaTutti();
          return;
        case "/":
          e.preventDefault();
          cercaRef.current?.focus();
          return;
        case "?":
          e.preventDefault();
          setAiutoAperto((v) => !v);
          return;
        case "Escape":
          //  Una via d'uscita sola e prevedibile: prima chiude il pannello,
          //  poi annulla la selezione, poi pulisce i filtri.
          if (dettaglioId) setDettaglioId(null);
          else if (selected.size) setSelected(new Set());
          else if (filtriAttivi) azzeraFiltri();
          return;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrati, cursore, limite, bloccato, dettaglioId, selected.size, filtriAttivi]);

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  const statiPresenti = useMemo(() => {
    //  Nel menu degli stati compaiono solo quelli che esistono davvero nel
    //  gruppo aperto (più quelli già selezionati): scegliere fra sei voci vere
    //  è più rapido che scorrerne diciassette di cui dodici a zero.
    //  "Consulenza non svolta" e "Cliente assente" comparivano come DUE voci
    //  distinte che significano la stessa cosa: l'incontro non c'è stato. Chi
    //  filtrava doveva sceglierne una e ne perdeva metà. Qui la storica
    //  confluisce nella nuova, e la voce nel menu resta una sola.
    const chiavi = new Set(
      [...Object.keys(conteggi.stato), ...filtri.stati].map((k) =>
        k === "non_fatto" ? "no_show" : k,
      ),
    );
    const quanti = (k: string) =>
      k === "no_show"
        ? (conteggi.stato.no_show || 0) + (conteggi.stato.non_fatto || 0)
        : conteggi.stato[k] || 0;
    return [...chiavi].sort((a, b) => quanti(b) - quanti(a)) as LeadStatus[];
  }, [conteggi.stato, filtri.stati]);

  const cambiaStatoFiltro = (s: string) =>
    setFiltri((f) => ({
      ...f,
      stati: f.stati.includes(s) ? f.stati.filter((x) => x !== s) : [...f.stati, s],
    }));

  const cambiaFonteFiltro = (v: string) =>
    setFiltri((f) => ({
      ...f,
      fonti: f.fonti.includes(v) ? f.fonti.filter((x) => x !== v) : [...f.fonti, v],
    }));

  /* ═══════════════════════════════════════════════════════════════════════
     I QUATTRO BLOCCHI — UN BLOCCO PER DOMANDA

     Scritti una volta e montati in due posti: nei menu della barra (schermo
     largo, un menu per domanda) e dentro il pannello unico (telefono e
     schermi stretti). Sono FUNZIONI e non componenti perché così React non li
     rimonta a ogni battuta nella ricerca — un rimontaggio qui vuol dire
     perdere il fuoco mentre si scrive.

     ⚠️ IL VOCABOLARIO DELLA PRIMA CHIAMATA NON È PIÙ QUI. Da quando le liste
     hanno una casa loro («Lead importati», /CRM/avanzamento), questo blocco
     parla di una cosa sola: esito dell'appuntamento e stato del lead. Prima
     cambiava contenuto sotto le mani a seconda del gruppo aperto — ed era la
     ragione per cui serviva `vocabolarioDiImport` in tre punti diversi.
     ═════════════════════════════════════════════════════════════════════════ */

  /** 1 · A CHE PUNTO È — il filtro che si cambia più volte in un'ora. */
  const bloccoPunto = () => (
    <BloccoDomanda
      titolo="A che punto è"
      icona={ListChecks}
      accesi={quantiAccesi(filtri, "punto")}
      onAzzera={() => azzeraDomanda("punto")}
    >
      <>
        <SottoBlocco titolo="Esito dell'appuntamento">
          {/*  Sigla e colori vengono da crm/ui, gli stessi dei pulsanti
                dell'agenda: è la stessa cosa e va riconosciuta senza
                rileggere. Le lenti restano TRE anche se i pulsanti d'esito
                sono scesi a due: filtrare per «Svolte» serve ancora — è la
                domanda «chi ho incontrato» — solo che ora è un calcolo. */}
          <div className="flex gap-1.5">
            {LENTI_ESITO.map((e) => {
              const on = esito === e.stato;
              return (
                <button
                  key={e.stato}
                  type="button"
                  onClick={() => imposta("esito", on ? null : e.stato)}
                  title={
                    on
                      ? "Togli il filtro"
                      : e.stato === "fatto"
                        ? "Mostra solo gli appuntamenti avvenuti: tutti tranne i clienti assenti e quelli da riprogrammare"
                        : `Mostra solo: ${LEAD_STATUS_LABEL[e.stato]}`
                  }
                  aria-pressed={on}
                  className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-[12px] font-medium transition ${on ? e.acceso : e.spento}`}
                >
                  <span className="truncate">{e.breve}</span>
                  <span
                    className={`rounded px-1 text-[11px] tabular-nums ${on ? "bg-white/20" : "bg-white/70"}`}
                  >
                    {conteggi.esito[e.stato]}
                  </span>
                </button>
              );
            })}
          </div>
        </SottoBlocco>
        <SottoBlocco
          titolo="Stato del lead"
          nota={filtri.stati.length ? `${filtri.stati.length} scelti` : "tutti"}
        >
          <div className="max-h-52 space-y-0.5 overflow-y-auto">
            {statiPresenti.length === 0 && (
              <p className="px-2 py-1 text-[12px] text-slate-500">
                Nessuno stato in questo gruppo.
              </p>
            )}
            {statiPresenti.map((s) => (
              //  Il riquadro delle note è lo stesso della pastiglia sulla
              //  riga: un componente solo per tutti gli stati.
              <NoteAComparsa
                key={s}
                righe={notePerStato[s] ?? []}
                titolo={`${LEAD_STATUS_LABEL[s] ?? s} · ultima nota per lead`}
                blocco
              >
                <VoceFiltro
                  attivo={statiScelti.has(s)}
                  //  Uno stato che l'archivio porta ma il vocabolario non
                  //  conosce (una lista vecchia, un import fatto a mano)
                  //  darebbe una riga di filtro senza nome: si mostra la
                  //  chiave grezza, che almeno si può riconoscere.
                  etichetta={LEAD_STATUS_LABEL[s] ?? s}
                  conteggio={
                    s === "no_show"
                      ? (conteggi.stato.no_show || 0) + (conteggi.stato.non_fatto || 0)
                      : conteggi.stato[s] || 0
                  }
                  onClick={() => cambiaStatoFiltro(s)}
                />
              </NoteAComparsa>
            ))}
          </div>
        </SottoBlocco>
      </>
    </BloccoDomanda>
  );

  /** 2 · DI CHI È — «solo i miei» è il filtro più premuto della giornata, e
   *  sta in cima all'elenco, non in fondo fra gli altri consulenti. */
  const bloccoChi = () => (
    <BloccoDomanda
      titolo="Di chi è"
      icona={UserRound}
      accesi={quantiAccesi(filtri, "chi")}
      onAzzera={() => azzeraDomanda("chi")}
    >
      {ioId && (
        <button
          type="button"
          onClick={() => imposta("consulenteId", consulenteId === ioId ? "all" : ioId)}
          aria-pressed={consulenteId === ioId}
          title="Mostra solo i lead assegnati a me"
          className={`mb-1.5 flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition ${
            consulenteId === ioId
              ? "border-sky-600 bg-sky-600 text-white"
              : "border-sky-200 bg-sky-50 text-sky-700 hover:brightness-95"
          }`}
        >
          <span className="truncate">Solo i miei</span>
          <span
            className={`shrink-0 rounded px-1 text-[11px] tabular-nums ${consulenteId === ioId ? "bg-white/20" : "bg-white/70"}`}
          >
            {conteggi.consulente[ioId] || 0}
          </span>
        </button>
      )}
      <div className="max-h-52 space-y-0.5 overflow-y-auto">
        <VoceFiltro
          attivo={consulenteId === "all"}
          etichetta="Tutti i consulenti"
          conteggio={perGruppo.length}
          onClick={() => imposta("consulenteId", "all")}
        />
        {consulentiScelta.map((c) => (
          <VoceFiltro
            key={c.id}
            attivo={consulenteId === c.id}
            etichetta={c.id === ioId ? `${c.data.nome} · io` : c.data.nome}
            conteggio={conteggi.consulente[c.id] || 0}
            onClick={() => imposta("consulenteId", consulenteId === c.id ? "all" : c.id)}
          />
        ))}
        <VoceFiltro
          attivo={consulenteId === "nessuno"}
          etichetta="Senza consulente"
          conteggio={conteggi.senzaConsulente}
          onClick={() => imposta("consulenteId", consulenteId === "nessuno" ? "all" : "nessuno")}
        />
      </div>
      {/*  Senza sessione consulente la pagina non sa chi sta guardando: lo si
          dice una volta e "Solo i miei" funziona da lì in avanti. */}
      {/*  ⚠️ Gli stessi nomi dell'elenco qui sopra, e non l'anagrafica intera.
          «Solo i miei» guarda `consulenteId` delle trattative: chi non fa
          consulenze non può che trovarne zero, e la stessa colonna che sopra
          non lo mostra qui lo proponeva come identità — due risposte diverse
          alla stessa domanda a due centimetri di distanza. Chi ha trattative
          assegnate resta comunque premibile: ce lo tiene `consulentiScelta`. */}
      {!ioId && consulentiScelta.length > 0 && (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <div className="mb-1 text-[11px] text-slate-500">
            Chi sei? Serve al pulsante «Solo i miei».
          </div>
          <div className="flex flex-wrap gap-1">
            {consulentiScelta.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => scegliIo(c.id)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11.5px] text-slate-700 transition hover:bg-slate-100"
              >
                {c.data.nome}
              </button>
            ))}
          </div>
        </div>
      )}
      {/*  Il ripiego si dice in fondo al blocco, dove vale per tutti e due gli
          elenchi che ha appena riempito. */}
      <NotaSoloConsulenti ripiego={ripiegoConsulenti} className="mt-2" />
    </BloccoDomanda>
  );

  /** 3 · QUANDO — due domande diverse che prima erano una sola:
   *   · la SCADENZA guarda la prossima azione: quando va sentito;
   *   · il PERIODO guarda la data di ingresso: quando è arrivato.
   *  Confonderle voleva dire cercare «i ritardi di agosto» e ottenere «i lead
   *  entrati ad agosto», che è un altro elenco. */
  const bloccoQuando = () => (
    <BloccoDomanda
      titolo="Quando"
      icona={CalendarClock}
      accesi={quantiAccesi(filtri, "quando")}
      onAzzera={() => azzeraDomanda("quando")}
    >
      <SottoBlocco titolo="Quando va sentito" nota="prossima azione">
        <ScelteRapide
          voci={VOCI_SCADENZA.map((v) => ({
            chiave: v.chiave,
            titolo: v.titolo,
            classe: v.classe,
            conteggio: conteggi.quando[v.chiave] || 0,
          }))}
          attiva={scadenza === "tutte" ? null : scadenza}
          onScegli={(k) => imposta("scadenza", (k as Scadenza) ?? "tutte")}
        />
      </SottoBlocco>
      <SottoBlocco titolo="Quando è entrato" nota={etichettaPeriodo(range.from, range.to)}>
        <button
          type="button"
          onClick={() => {
            setPannelloFiltri(false);
            setPeriodoAperto(true);
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] text-slate-700 transition hover:bg-slate-50"
        >
          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="flex-1 truncate text-left">
            {etichettaPeriodo(range.from, range.to)}
          </span>
          <span className="shrink-0 text-[11px] text-slate-400">scegli</span>
        </button>
      </SottoBlocco>
    </BloccoDomanda>
  );

  /** 4 · DA DOVE VIENE — la fonte commerciale e la porta d'ingresso, che sono
   *  due cose diverse: un lead «ADV» può essere arrivato dal funnel o da una
   *  lista caricata a mano, e chi ripesca i rientri cerca la seconda. */
  const bloccoDove = () => (
    <BloccoDomanda
      titolo="Da dove viene"
      icona={RouteIcona}
      accesi={quantiAccesi(filtri, "dove")}
      onAzzera={() => azzeraDomanda("dove")}
    >
      <SottoBlocco titolo="Come è entrato">
        <ScelteRapide
          voci={VOCI_PROVENIENZA.map((v) => ({
            chiave: v.chiave,
            titolo: v.titolo,
            conteggio: conteggi.dove[v.chiave] || 0,
          }))}
          attiva={provenienza === "tutte" ? null : provenienza}
          onScegli={(k) => imposta("provenienza", (k as Provenienza) ?? "tutte")}
        />
      </SottoBlocco>
      <SottoBlocco
        titolo="Fonte"
        nota={filtri.fonti.length ? `${filtri.fonti.length} scelte` : "tutte"}
      >
        <div className="max-h-40 space-y-0.5 overflow-y-auto">
          {fontiPresenti.length === 0 && (
            <p className="px-2 py-1 text-[12px] text-slate-500">Nessuna fonte in questo gruppo.</p>
          )}
          {fontiPresenti.map((f) => (
            <VoceFiltro
              key={f}
              attivo={fontiScelte.has(f)}
              etichetta={f === SENZA_FONTE ? "Senza fonte" : f}
              conteggio={conteggi.fonte[f] || 0}
              onClick={() => cambiaFonteFiltro(f)}
            />
          ))}
        </div>
      </SottoBlocco>
    </BloccoDomanda>
  );

  /** In più — non è una domanda sul lead ma sul MODO di guardarlo. Sta in
   *  fondo e in tono minore apposta: la stella toglie righe (quindi è un
   *  filtro e fa pastiglia), l'ordinamento no e infatti non si azzera. */
  const bloccoInPiu = () => (
    <BloccoDomanda
      titolo="In più"
      icona={Star}
      accesi={filtri.evidenziati ? 1 : 0}
      onAzzera={() => imposta("evidenziati", false)}
    >
      <SottoBlocco titolo="Solo alcuni">
        <VoceFiltro
          attivo={filtri.evidenziati}
          etichetta="Solo quelli da seguire"
          conteggio={conteggi.evidenziati}
          onClick={() => imposta("evidenziati", !filtri.evidenziati)}
        />
      </SottoBlocco>
      <SottoBlocco titolo="Ordina per" nota={ordine === "azione" ? "consigliato" : undefined}>
        <div className="space-y-0.5">
          {(
            [
              ["azione", "Chi va sentito prima"],
              ["recenti", "Entrati di recente"],
              ["nome", "Cognome"],
            ] as const
          ).map(([k, t]) => (
            <VoceFiltro
              key={k}
              attivo={ordine === k}
              etichetta={t}
              onClick={() => imposta("ordine", k)}
            />
          ))}
        </div>
      </SottoBlocco>
    </BloccoDomanda>
  );

  /** Il contenuto del pannello: le quattro domande nell'ordine in cui si
   *  usano — prima quella che si cambia ogni ora, in fondo quella che si
   *  imposta una volta a settimana. */
  const bloccoDomanda = (d: Domanda) =>
    d === "punto"
      ? bloccoPunto()
      : d === "chi"
        ? bloccoChi()
        : d === "quando"
          ? bloccoQuando()
          : bloccoDove();

  const contenutoFiltri = () => (
    <>
      {DOMANDE.map((d) => (
        <div key={d.chiave}>{bloccoDomanda(d.chiave)}</div>
      ))}
      {bloccoInPiu()}
    </>
  );

  /** Cosa sta filtrando una domanda, in due parole, da scrivere SUL pulsante
   *  della barra. Quando i filtri accesi sono più d'uno vince il nome della
   *  domanda e il numero accanto: "Venduto +2" non si legge, "Stato 3" sì. */
  const riassuntoDomanda = (d: Domanda): string => {
    if (d === "punto") {
      if (esito && !filtri.stati.length)
        return LENTI_ESITO.find((e) => e.stato === esito)?.nome ?? "Stato";
      if (filtri.stati.length === 1 && !esito)
        return LEAD_STATUS_LABEL[filtri.stati[0] as LeadStatus] ?? filtri.stati[0];
      return "Stato";
    }
    if (d === "chi")
      return consulenteId === "all"
        ? "Consulente"
        : consulenteId === "nessuno"
          ? "Senza consulente"
          : `${consultantName(consulenteId)}${consulenteId === ioId ? " · io" : ""}`;
    if (d === "quando") {
      if (scadenza !== "tutte")
        return VOCI_SCADENZA.find((v) => v.chiave === scadenza)?.titolo ?? "Quando";
      if (range.from || range.to) return etichettaPeriodo(range.from, range.to);
      return "Quando";
    }
    if (provenienza !== "tutte")
      return VOCI_PROVENIENZA.find((v) => v.chiave === provenienza)?.titolo ?? "Provenienza";
    if (filtri.fonti.length === 1)
      return filtri.fonti[0] === SENZA_FONTE ? "Senza fonte" : filtri.fonti[0];
    if (filtri.fonti.length > 1) return `${filtri.fonti.length} fonti`;
    return "Provenienza";
  };

  /** Il pulsante che apre il pannello. Uno solo, montato dentro il popover sul
   *  desktop e da solo sul telefono: la pastiglia col numero di filtri accesi
   *  deve essere identica nei due casi, perché è il modo in cui si capisce a
   *  colpo d'occhio che l'elenco è ridotto. */
  const comandoFiltri = () => (
    <Button
      variant="outline"
      size="sm"
      className="h-9 shrink-0"
      title="Tutti i filtri"
      aria-label="Tutti i filtri"
      aria-expanded={pannelloFiltri}
      onClick={telefono ? () => setPannelloFiltri(true) : undefined}
    >
      <SlidersHorizontal className="h-3.5 w-3.5 sm:mr-1" />
      <span className="hidden sm:inline">Filtri</span>
      {pastiglie.length > 0 && (
        <span className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-semibold leading-none tabular-nums text-background">
          {pastiglie.length}
        </span>
      )}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* ── TESTATA: dove sono, quanto ce n'è, cosa posso avviare ──────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Lead</h1>
          {/*  Il conteggio vive nella barra dei filtri, accanto alle pastiglie:
              è lì che serve, perché è lì che si capisce cosa lo sta riducendo.
              Qui resta solo quanto si sta per toccare in blocco. */}
          {selezionati.length > 0 && (
            <span className="text-[12.5px] text-muted-foreground">
              {selezionati.length} selezionate
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/*  ── DOVE È FINITO «IMPORTA LISTA» ──────────────────────────────
              Il pulsante non carica più il file da qui: porta alla schermata
              dove la lista si carica CON l'anteprima e poi si lavora. Toglierlo
              del tutto avrebbe lasciato senza risposta chi lo cerca dove è
              sempre stato — e una funzione tolta senza sostituto si scopre
              giorni dopo, per telefono. */}
          <Button
            asChild
            variant="outline"
            size="sm"
            title="Carica una lista di contatti: si fa in «Lead importati», dove poi la lista si chiama"
            aria-label="Importa lista"
          >
            {/*  ⚠️ PORTAVA A /CRM/avanzamento, che il caricamento del CSV ce
                l'ha ancora ma non è più nel menu: chi premeva finiva su una
                pagina di cui non sa più il nome. Adesso porta alla schermata
                che nel menu si chiama «Lead importati» — la stessa scritta nel
                `title` qui sopra — dove il pulsante «Carica una lista» apre il
                pannello con l'anteprima e la lista si chiama subito dopo. */}
            <Link to="/CRM/importa">
              {/*  Su telefono restano le sole icone: le quattro azioni per
                  esteso occupavano due righe intere sopra l'elenco, cioè metà
                  del primo schermo prima di vedere un lead. */}
              <Upload className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Importa lista</span>
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => esportaCsv(filtrati, gruppo)}
            disabled={filtrati.length === 0}
            title="Esporta in CSV i lead filtrati"
            aria-label="Esporta"
          >
            <Download className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Esporta</span>
          </Button>
          <Popover open={aiutoAperto} onOpenChange={setAiutoAperto}>
            <PopoverTrigger asChild>
              {/*  Le scorciatoie hanno senso solo dove c'è una tastiera. */}
              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
                title="Scorciatoie da tastiera (?)"
                aria-label="Scorciatoie da tastiera"
              >
                <Keyboard className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <Pannello align="end" className="w-72" titolo="Scorciatoie da tastiera">
              <div className="space-y-1">
                {(
                  [
                    ["↑ ↓", "Scorri l'elenco"],
                    ["Invio", "Apri la scheda a lato"],
                    ["Spazio", "Seleziona la riga"],
                    ["Maiusc + Spazio", "Seleziona fino alla riga"],
                    ["S", "Cambia stato"],
                    ["M", "Apri la scheda completa"],
                    ["C", "Chiama"],
                    ["W", "Scrivi su WhatsApp"],
                    ["V", "Avvia la videoconsulenza"],
                    ["P", "Programma la posa"],
                    ["F", "Segna come da seguire"],
                    ["A", "Seleziona tutti i risultati"],
                    ["/", "Vai alla ricerca"],
                    ["Esc", "Chiudi, poi annulla la selezione"],
                  ] as const
                ).map(([k, d]) => (
                  <div key={k} className="flex items-center justify-between gap-3 text-[12px]">
                    <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                      {k}
                    </kbd>
                    <span className="text-slate-500">{d}</span>
                  </div>
                ))}
              </div>
            </Pannello>
          </Popover>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nuovo lead</span>
            <span className="sm:hidden">Nuovo</span>
          </Button>
        </div>
      </div>

      {/* ── GRUPPI: la partizione principale, sempre visibile ───────────────
          Sette schede su un telefono da 375 punti andavano a capo tre volte:
          novanta pixel di navigazione prima del primo lead, cioè un terzo del
          primo schermo speso per non leggere niente. Su telefono scorrono in
          orizzontale su UNA riga (la prima è quella che si usa, le altre sono a
          una strisciata); da tablet in su tornano a capo come prima, perché lì
          lo spazio c'è e vederle tutte insieme è meglio. */}
      <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        {GRUPPI.map(({ chiave, titolo, spiega }) => (
          <Segmento
            key={chiave}
            titolo={spiega}
            attivo={gruppo === chiave}
            conteggio={conteggioGruppi[chiave]}
            onClick={() => imposta("gruppo", chiave)}
            className="shrink-0"
          >
            {titolo}
          </Segmento>
        ))}
      </div>

      {/* ═══ LA BARRA DEI FILTRI ══════════════════════════════════════════════
          Prima era una fila di menu che cresceva a ogni funzione aggiunta:
          sette controlli sempre accesi, tre righe su tablet, e nessun modo di
          sapere quali stessero davvero filtrando. Adesso sono due cose sole:

            · UNA RIGA di comandi, fissa: cerca · stato · consulente · periodo ·
              solo i miei · tutti i filtri · quanti risultati. Non cresce mai,
              perché tutto il resto sta dietro un comando unico.
            · LE PASTIGLIE dei filtri accesi, sotto, ognuna con la sua X. Se non
              c'è nessun filtro la riga non esiste e non occupa niente.

          Su telefono la riga si riduce a tre cose — cerca, «solo i miei» e il
          comando dei filtri — e tutto il resto entra in un foglio che sale dal
          basso: i filtri non devono mangiare mezzo schermo sopra l'elenco che
          si è venuti a leggere.

          La regola per decidere cosa resta fuori e cosa va dentro è una sola:
          fuori sta ciò che si tocca più volte al giorno, dentro ciò che si
          imposta e si dimentica. Non l'importanza — la frequenza. */}
      {/*  La barra resta agganciata in alto solo da tablet in su: incollata su
          un telefono lasciava due lead visibili sotto di sé. */}
      <div
        className={`z-20 -mx-4 flex flex-col gap-1.5 border-b border-border bg-background/95 px-4 py-2 backdrop-blur transition-shadow md:sticky md:top-12 md:-mx-6 md:px-6 ${
          scrolled ? "md:shadow-[0_1px_3px_rgba(0,0,0,0.06)]" : ""
        }`}
      >
        <div className="flex items-center gap-1.5">
          {/*  UNA CASELLA SOLA: nome, cognome, telefono, email e città insieme.
              Far scegliere prima il campo su cui cercare è il modo più sicuro
              per non farla usare a nessuno. */}
          <div className="relative min-w-0 flex-1 md:max-w-[16rem]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={cercaRef}
              placeholder="Cerca nome, telefono, email"
              title="Cerca su nome, cognome, telefono, email e città insieme (/)"
              value={cerca}
              onChange={(e) => imposta("cerca", e.target.value)}
              className="h-9 w-full pl-8 pr-7 text-[13px]"
            />
            {cerca && (
              <button
                type="button"
                onClick={() => imposta("cerca", "")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Pulisci la ricerca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* ── LE QUATTRO DOMANDE, UNA PER PULSANTE ────────────────────────
              Dove lo schermo lo consente ogni domanda ha il suo menu, con la
              sua icona e il riassunto di cosa sta filtrando scritto SUL
              pulsante: si legge lo stato dei filtri senza aprire niente.
              Sotto xl vivono tutte dentro il comando unico «Filtri»: meglio un
              clic in più che una barra che si spezza in tre righe sopra
              l'elenco che si è venuti a leggere. */}
          <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
            {DOMANDE.map((d) => {
              const n = quantiAccesi(filtri, d.chiave);
              const Icona = d.icona;
              return (
                <Popover key={d.chiave}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-9 max-w-[11rem] ${n ? "border-foreground/40 bg-muted" : ""}`}
                      title={`${d.titolo} — filtra i lead`}
                    >
                      <Icona className="mr-1 h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{riassuntoDomanda(d.chiave)}</span>
                      {n > 1 && (
                        <span className="ml-1.5 shrink-0 rounded bg-foreground px-1 text-[11px] tabular-nums text-background">
                          {n}
                        </span>
                      )}
                      <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <Pannello
                    align="start"
                    className="w-72"
                    titolo={d.titolo}
                    contesto={`${filtrati.length.toLocaleString("it-IT")} di ${leads.length.toLocaleString("it-IT")} lead`}
                    senzaPadding
                    classeCorpo="max-h-[60vh] overflow-y-auto"
                  >
                    {bloccoDomanda(d.chiave)}
                  </Pannello>
                </Popover>
              );
            })}
          </div>

          {/* ── LE DUE DOMANDE DI OGNI MATTINA ──────────────────────────────
              «Chi è in ritardo» e «cosa scade oggi» sono le prime due cose che
              si guardano, tutti i giorni: stanno fuori da ogni menu, con il
              loro numero. Il colore è segnale e non decorazione — rosa per il
              ritardo (si sta perdendo qualcosa), sky per l'adesso.
              Da sm in su: sul telefono la riga deve restare di tre controlli,
              e da lì questi due sono a un tocco dentro «Filtri». */}
          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            {VOCI_SCADENZA.filter((v) => v.chiave === "ritardo" || v.chiave === "oggi").map((v) => {
              const on = scadenza === v.chiave;
              return (
                <button
                  key={v.chiave}
                  type="button"
                  onClick={() => imposta("scadenza", on ? "tutte" : v.chiave)}
                  aria-pressed={on}
                  title={
                    v.chiave === "ritardo"
                      ? "Mostra solo i lead con una scadenza già passata"
                      : "Mostra solo i lead con qualcosa in programma oggi"
                  }
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition ${
                    on
                      ? v.chiave === "ritardo"
                        ? "border-rose-600 bg-rose-600 text-white"
                        : "border-sky-600 bg-sky-600 text-white"
                      : `${v.classe} hover:brightness-95`
                  }`}
                >
                  <span>{v.titolo}</span>
                  <span
                    className={`rounded px-1 text-[11px] tabular-nums ${on ? "bg-white/20" : "bg-white/70"}`}
                  >
                    {conteggi.quando[v.chiave] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/*  "Solo i miei" è il filtro più premuto della giornata, e per questo
              è l'unico dei quotidiani che NON si nasconde mai: resta nella riga
              anche sul telefono, dove diventa la sola icona di una persona.
              Sky è la famiglia di "da fare adesso", la stessa delle righe in
              scadenza. */}
          {ioId && (
            <button
              type="button"
              onClick={() => imposta("consulenteId", consulenteId === ioId ? "all" : ioId)}
              aria-pressed={consulenteId === ioId}
              title="Mostra solo i lead assegnati a me"
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition ${
                consulenteId === ioId
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-sky-200 bg-sky-50 text-sky-700 hover:brightness-95"
              }`}
            >
              <UserRound className="h-3.5 w-3.5 shrink-0 sm:hidden" />
              <span className="hidden sm:inline">Solo i miei</span>
              <span
                className={`rounded px-1 text-[11px] tabular-nums ${consulenteId === ioId ? "bg-white/20" : "bg-white/70"}`}
              >
                {conteggi.consulente[ioId] || 0}
              </span>
            </button>
          )}

          {/* ── UN SOLO COMANDO PER TUTTO IL RESTO ──────────────────────────
              Sul desktop il pannello si apre accanto al pulsante, dove l'occhio
              è già. Sul telefono un pannello ancorato coprirebbe l'elenco a
              metà e verrebbe tagliato dal bordo: lì diventa un foglio che sale
              dal basso, con l'azione di conferma sotto il pollice. È lo stesso
              contenuto — i blocchi sono scritti una volta sola. */}
          {telefono ? (
            <>
              {comandoFiltri()}
              <Foglio
                aperto={pannelloFiltri}
                onCambio={setPannelloFiltri}
                titolo="Filtri"
                contesto={`${filtrati.length.toLocaleString("it-IT")} di ${leads.length.toLocaleString("it-IT")} lead`}
                larghezza="sm"
                senzaPadding
                azioni={
                  <>
                    {filtriAttivi && (
                      <Button variant="outline" size="sm" onClick={azzeraFiltri}>
                        Azzera tutto
                      </Button>
                    )}
                    {/*  Il pulsante di chiusura porta il conteggio: si scelgono
                        i filtri guardando il numero salire e scendere, e si
                        conferma quando è quello giusto. */}
                    <Button size="sm" onClick={() => setPannelloFiltri(false)}>
                      Mostra {filtrati.length.toLocaleString("it-IT")}
                    </Button>
                  </>
                }
              >
                {contenutoFiltri()}
              </Foglio>
            </>
          ) : (
            <Popover open={pannelloFiltri} onOpenChange={setPannelloFiltri}>
              <PopoverTrigger asChild>{comandoFiltri()}</PopoverTrigger>
              <Pannello
                align="end"
                className="w-[min(21rem,calc(100vw-1.5rem))]"
                titolo="Filtri"
                contesto={`${filtrati.length.toLocaleString("it-IT")} di ${leads.length.toLocaleString("it-IT")} lead`}
                azioni={
                  filtriAttivi ? (
                    <button
                      type="button"
                      onClick={azzeraFiltri}
                      className="rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Azzera tutto
                    </button>
                  ) : undefined
                }
                senzaPadding
                classeCorpo="max-h-[65vh] overflow-y-auto"
              >
                {contenutoFiltri()}
              </Pannello>
            </Popover>
          )}

          {/* ── QUANTI NE STO GUARDANDO ───────────────────────────────────────
              Sempre visibile, e cliccabile: il totale porta all'archivio
              completo senza filtri, che è la domanda che segue sempre («e le
              altre dove sono finite?»). */}
          <button
            type="button"
            onClick={() =>
              setFiltri((f) => ({ ...FILTRI_VUOTI, gruppo: "tutte", ordine: f.ordine }))
            }
            title="Apri l'archivio completo: azzera i filtri e mostra tutti i lead"
            className="ml-auto shrink-0 rounded-md px-1 py-0.5 text-[12.5px] tabular-nums transition hover:bg-muted"
          >
            <span className="font-semibold">{filtrati.length.toLocaleString("it-IT")}</span>
            <span className="text-muted-foreground">
              {" "}
              di {leads.length.toLocaleString("it-IT")}
            </span>
          </button>
        </div>

        {/* ── I FILTRI ACCESI ─────────────────────────────────────────────────
            Nessun filtro può restare nascosto in un menu chiuso: qui c'è tutto
            quello che sta togliendo righe dall'elenco, e si spegne dov'è. */}
        {filtriAttivi && (
          <div className="flex flex-wrap items-center gap-1.5">
            {pastiglie.map((p) => (
              <Pastiglia
                key={p.chiave}
                etichetta={p.etichetta}
                valore={p.valore}
                classe={p.classe}
                onRimuovi={p.via}
              />
            ))}
            <button
              type="button"
              onClick={azzeraFiltri}
              title="Azzera tutti i filtri (Esc)"
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" /> Azzera tutto
            </button>
          </div>
        )}
      </div>

      {/* ── IL PERIODO, A FASCIA ─────────────────────────────────────────────
          Fuori dalla barra perché è l'unico filtro che ha bisogno di spazio:
          scorciatoie, due calendari e il confronto con il periodo precedente.
          Chiuso per default, non toglie niente a chi non lo usa. */}
      {periodoAperto && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Periodo di ingresso
            </span>
            <button
              type="button"
              onClick={() => setPeriodoAperto(false)}
              className="text-muted-foreground transition hover:text-foreground"
              aria-label="Chiudi il periodo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <DateRangeFilter
            value={range}
            onChange={(v) => setFiltri((f) => ({ ...f, from: v.from, to: v.to }))}
            presetDeltas={presetDeltas}
          />
        </div>
      )}

      {/* ── ELENCO + PANNELLO ──────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {/* Intestazione colonne: dice cosa si sta leggendo, e porta la
              selezione totale nel punto in cui la si cerca. */}
          <div className="mb-1 flex items-center gap-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div
              role="checkbox"
              aria-checked={tuttiSelezionati}
              tabIndex={-1}
              onClick={selezionaTutti}
              title={tuttiSelezionati ? "Deseleziona tutto" : "Seleziona tutti i risultati (A)"}
              className="-my-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-foreground/[0.06]"
            >
              <Checkbox checked={tuttiSelezionati} className="pointer-events-none" />
            </div>
            <span className="min-w-0 flex-1">Nome</span>
            <span className="hidden w-[11.5rem] shrink-0 md:block">Stato</span>
            <span className="hidden w-[12rem] shrink-0 md:block">Prossima azione</span>
            <span className="hidden w-[8rem] shrink-0 lg:block">Consulente</span>
            <span className="w-[8.25rem] shrink-0 text-right md:w-[10rem]">Azioni</span>
          </div>

          <div
            ref={listaRef}
            className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
          >
            {filtrati.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <p className="text-[13px] text-muted-foreground">
                  {filtriAttivi
                    ? "Nessun lead con questi filtri."
                    : "Nessun lead in questo gruppo."}
                </p>
                {filtriAttivi ? (
                  <Button variant="outline" size="sm" onClick={azzeraFiltri}>
                    Azzera i filtri
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Nuovo lead
                  </Button>
                )}
              </div>
            )}

            {visibili.map((l, i) => {
              const az = prossimaAzione(l);
              const sel = selected.has(l.id);
              const sottoCursore = i === cursore;
              const aperto = dettaglioId === l.id;
              return (
                <div
                  key={l.id}
                  data-riga={l.id}
                  onClick={() => {
                    setCursore(i);
                    setDettaglioId(l.id);
                  }}
                  className={`group relative flex cursor-pointer items-center gap-2 px-2 py-2 transition-colors md:gap-3 ${
                    aperto ? "bg-primary/[0.07]" : sel ? "bg-primary/[0.07]" : "hover:bg-muted/60"
                  } ${sottoCursore ? "ring-1 ring-inset ring-primary/40" : ""}`}
                >
                  {/*  ── IL SEGNO A SINISTRA, E DICE DUE COSE DIVERSE ────────
                      Pieno = questa riga è SELEZIONATA; smorzato = ci sta
                      sopra il cursore della tastiera. Uno solo alla volta e
                      nello stesso posto, perché due barrette affiancate a due
                      pixel di distanza non si distinguono — e la selezione
                      vince, perché è quella su cui agiranno i comandi in
                      basso.
                      ⚠️ È lo stesso segno delle liste rifatte
                      (crm/importa/selezione): questa tabella non può usare
                      quel componente — è una griglia di <div>, non un elenco
                      di <li> — ma deve rispondere ai gesti allo stesso modo,
                      o il CRM ha due idee di «riga scelta». */}
                  {(sel || sottoCursore) && (
                    <span
                      className={
                        sel
                          ? "absolute inset-y-0 left-0 w-[3px] rounded-r bg-primary"
                          : "absolute inset-y-0 left-0 w-[2px] bg-primary/50"
                      }
                    />
                  )}

                  {/*  Il riquadro attorno alla spunta porta il bersaglio da
                      sedici a trentadue pixel senza ingrandire il segno: su un
                      telefono sedici pixel sono un tocco che sbaglia una volta
                      su tre, e qui sbagliarlo vuol dire aprire la scheda invece
                      di selezionare. */}
                  <div
                    role="checkbox"
                    aria-checked={sel}
                    aria-label="Seleziona"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      selezionaRiga(i, e.shiftKey);
                    }}
                    className="-my-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-foreground/[0.06]"
                  >
                    <Checkbox checked={sel} className="pointer-events-none" />
                  </div>

                  {/* NOME — e sotto, solo su schermo stretto, quello che
                      altrimenti starebbe nelle colonne. */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {l.data.highlighted && (
                        <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                      )}
                      {/*  `t-riga`: 15 sul telefono, 13 sul monitor. Vedi la
                          scala in styles.css. */}
                      <span className="t-riga truncate font-medium">
                        {l.data.nome} {l.data.cognome}
                      </span>
                      {/*  ── «DA ANTICIPARE», SULL'ARCHIVIO ────────────────
                          Richiesta del committente: la priorità si deve vedere
                          «anche fuori, sul lead». Questo è l'elenco che si apre
                          per cercare una persona per nome, ed è il posto in cui
                          scoprire che è stata messa in cima — e che giorno ha
                          chiesto — cambia la telefonata che si sta per fare.
                          Su chi non ha nessuna priorità non rende niente:
                          quattromila righe non pagano un pixel per questo. */}
                      <SegnoPriorita lead={l} />
                      {(l.data.giaPresenteCount ?? 0) > 1 && (
                        <span
                          className="shrink-0 rounded bg-muted px-1 text-[11px] text-muted-foreground"
                          title="Rientrato più volte"
                        >
                          ×{l.data.giaPresenteCount}
                        </span>
                      )}
                    </div>
                    {/*  Su telefono le colonne non ci sono: stato, prossima
                        azione e consulente si stringono in una riga sola. Il
                        segno dell'azione resta anche qui — è proprio dove lo
                        spazio manca che serve un'icona invece di una parola. */}
                    {/*  ── LA RIGA STRETTA, RIFATTA CON IL METRO IN MANO ────
                        Misurata su un telefono da 375 punti: alla colonna del
                        nome ne restano 169, e con la forma lunga del ritardo
                        («in ritardo di 23 g», 108 punti, che non si accorcia
                        mai) allo stato e all'azione ne restavano 61 in due.
                        A schermo si leggeva «Appu… · C…»: la riga diceva da
                        quanto una cosa è in ritardo senza dire né che cosa
                        fosse né a che punto era.
                        Tre tagli, in ordine di quanto rendono:
                         · il ritardo si dice breve — «23 g fa» — e libera
                           una sessantina di punti (vedi etichettaQuandoBreve);
                         · l'azione perde la PAROLA e tiene il SEGNO: l'icona
                           dice già «consulenza» o «installazione», e la parola
                           accanto costava altri sessanta punti per ripeterla;
                         · lo stato non si accorcia più per ultimo, perché è la
                           cosa per cui si guarda la riga.
                        Sul monitor non cambia niente: là ci sono le colonne. */}
                    <div className="t-nota flex items-center gap-1 truncate text-muted-foreground md:hidden">
                      {/*  Senza mouse non esiste il passaggio: qui l'icona delle
                          note è il modo di aprirle, e la spunta è a portata di
                          pollice come sul monitor. */}
                      <NoteLead lead={l} className="min-w-0">
                        <span className="truncate">
                          {LEAD_STATUS_LABEL[l.data.stato] ?? l.data.stato}
                        </span>
                      </NoteLead>
                      <SpuntaCompimento
                        lead={l}
                        attiva={compLead?.id === l.id}
                        onClick={() => avviaCompimento(l)}
                      />
                      <span className="shrink-0 opacity-50">·</span>
                      {/*  Il titolo porta la parola che l'icona sostituisce:
                          chi non riconosce il segno lo tiene premuto e legge. */}
                      <span className="shrink-0" title={az.cosa}>
                        <SegnoAzione cosa={az.cosa} />
                      </span>
                      {az.quandoBreve && (
                        <span
                          className={`shrink-0 tabular-nums ${TONO_AZIONE[az.tono]}`}
                          title={`${az.cosa} · ${az.quando}${dettoIlInChiaro(l.data) ? ` · ${dettoIlInChiaro(l.data)}` : ""}`}
                        >
                          {az.quandoBreve}
                        </span>
                      )}
                      {/*  ⚠️ Sul telefono la riga è un budget di punti, e qui
                           si spende solo dove serve: la data in cui l'ha detto
                           compare SOLO su «Ci ricontatta lui», che è l'unico
                           stato in cui si aspetta una mossa altrui. */}
                      {dettoIlInChiaro(l.data) && (
                        <span className="shrink-0 tabular-nums opacity-70">
                          · {dettoIlInChiaro(l.data)}
                        </span>
                      )}
                    </div>
                    <div className="hidden truncate text-[11.5px] text-muted-foreground md:block">
                      {l.data.telefono || "senza telefono"}
                      {l.data.citta ? ` · ${l.data.citta}` : ""}
                    </div>
                  </div>

                  {/* STATO — la pastiglia, le sue note, e la spunta quando lo
                      stato è un impegno che si può dichiarare onorato.
                      ⚠️ `overflow-hidden` è la rete: la cella ha una larghezza
                      fissa e quello che ci sta dentro deve accorciarsi, non
                      uscire. Senza, un pezzo qualunque messo qui domani
                      tornerebbe a stampare sopra la colonna accanto — che è
                      esattamente il difetto appena corretto, e si vedeva su
                      una riga vera con dei soldi da chiedere. */}
                  <div className="hidden w-[11.5rem] shrink-0 items-center gap-1.5 overflow-hidden md:flex">
                    <NoteLead lead={l} className="min-w-0 flex-1">
                      {/*  ⚠️ Il fumetto avvolge la pastiglia e non la
                          sostituisce: il clic sulla pastiglia continua ad
                          aprire il selettore di stato, che è il gesto per cui
                          quella pastiglia esiste. Il fumetto si apre dal
                          Popover, che intercetta il clic sul SUO involucro —
                          e su una riga senza data non si monta affatto. */}
                      <FumettoStato
                        lead={l}
                        onCompimento={(x) => avviaCompimento(x)}
                        onEvidenzia={(x) =>
                          void updateLead(x.id, { highlighted: !x.data.highlighted })
                        }
                      >
                        <ChipStato lead={l} onClick={() => apriStato(l)} />
                      </FumettoStato>
                    </NoteLead>
                    <SpuntaCompimento
                      lead={l}
                      attiva={compLead?.id === l.id}
                      onClick={() => avviaCompimento(l)}
                    />
                  </div>

                  {/* PROSSIMA AZIONE — il segno dice DOVE (in sede, a distanza,
                      al telefono, in cantiere), il colore dice QUANDO. */}
                  <div className="hidden w-[12rem] shrink-0 flex-col leading-tight md:flex">
                    <span className="flex items-center gap-1.5 text-[12.5px]">
                      <SegnoAzione cosa={az.cosa} />
                      <span className="truncate">{az.cosa}</span>
                    </span>
                    {az.quando && (
                      <span className={`truncate pl-[1.25rem] text-[11px] ${TONO_AZIONE[az.tono]}`}>
                        {az.quando}
                      </span>
                    )}
                    {/*  ── QUANDO L'HA DETTO ────────────────────────────────
                         Richiesta del committente: «fai che si vede anche
                         nella lista lead la data». Sopra c'è ENTRO QUANDO si
                         fa vivo; questa è l'altra metà — da quanto tempo
                         aspettiamo — e senza di lei si apre la scheda una per
                         una. Compare solo su «Ci ricontatta lui». */}
                    {dettoIlInChiaro(l.data) && (
                      <span className="truncate pl-[1.25rem] text-[11px] text-muted-foreground">
                        {dettoIlInChiaro(l.data)}
                      </span>
                    )}
                  </div>

                  {/* CONSULENTE */}
                  <div className="hidden w-[8rem] shrink-0 truncate text-[12.5px] text-muted-foreground lg:block">
                    {consultantName(l.data.consulenteId)}
                  </div>

                  {/* AZIONI RAPIDE — compaiono al passaggio, restano visibili
                      sulla riga sotto il cursore. */}
                  {/*  Su telefono i pulsanti restano sempre visibili: senza
                      mouse non esiste "al passaggio", e chiamare o scrivere
                      erano diventati impossibili senza prima aprire la scheda.

                      IL BUDGET DELLA RIGA È DI CINQUE SEGNI, E NON SI SFORA.
                      Tre valgono per chiunque — segna, chiama, scrivi — la
                      quarta è quella del momento del lead (o si avvia la
                      videoconsulenza, o si programma la posa: le due si
                      escludono a vicenda), e la quinta è il contatore delle
                      chiamate, che il committente ha chiesto ESPRESSAMENTE
                      fuori dalla scheda perché si tocca dopo ogni squillo e
                      aprire una finestra per un +1 costa più della telefonata.
                      Sta subito dopo il tasto per chiamare: il gesto è
                      «chiamo, poi segno». Se un giorno servisse un sesto
                      comando va dietro un menu «⋯»: una riga con otto icone,
                      letta ottocento volte al giorno, non si legge più.

                      SUL TELEFONO I SEGNI RESTANO QUATTRO. La colonna non può
                      allargarsi: su uno schermo da 375 punti ogni millimetro
                      preso qui è un nome tagliato a metà, e il nome è la cosa
                      per cui si guarda l'elenco. Cede la stella — la si vede
                      comunque accanto al nome, e si accende dalla scheda
                      aperta — non il contatore, che è il gesto nuovo e va
                      fatto col pollice subito dopo la chiamata. */}
                  <div
                    className={`flex shrink-0 items-center justify-end gap-0.5 transition-opacity md:w-[10rem] ${
                      sottoCursore || aperto
                        ? "opacity-100"
                        : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className="hidden h-7 w-7 md:inline-flex"
                      title="Segna come da seguire (F)"
                      onClick={() => void updateLead(l.id, { highlighted: !l.data.highlighted })}
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${l.data.highlighted ? "fill-amber-400 text-amber-400" : ""}`}
                      />
                    </Button>
                    {/*  IL CONTATORE — sempre presente, anche senza numero di
                        telefono in scheda: una chiamata si può fare da un
                        altro apparecchio, e un contatore che sparisce a metà
                        elenco è un contatore di cui non ci si fida più. */}
                    <PulsanteChiamate lead={l} onCambia={(n) => void segnaChiamate(l, n)} />
                    {l.data.telefono && (
                      <>
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Chiama (C)"
                        >
                          <a href={`tel:${l.data.telefono}`}>
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Scrivi su WhatsApp (W)"
                          onClick={() => apriWhatsApp(l)}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}

                    {/*  LA VIDEOCONSULENZA — cielo, perché è la cosa che si fa
                        adesso. Stessa videocamera dell'agenda: chi la riconosce
                        lì la riconosce qui, ed è la stessa stanza. */}
                    {puoAvviareConsulenza(l) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                        title="Avvia la videoconsulenza (V)"
                        aria-label="Avvia la videoconsulenza"
                        onClick={() => void avviaConsulenza(l)}
                      >
                        <Video className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/*  LA POSA — ambra finché manca la data (è il passaggio che
                        manca), verde quando c'è: il colore dice da solo se
                        questo cliente è ancora in attesa di un'installazione o
                        se è già a calendario, senza aprire niente. */}
                    {puoProgrammareLaPosa(l) &&
                      (() => {
                        const fissata = !!soloData(l.data.installazione?.dataInstallazione);
                        return (
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-7 w-7 ${
                              fissata
                                ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                            }`}
                            title={
                              fissata
                                ? `Posa del ${dataBreve(l.data.installazione?.dataInstallazione)} — cambiala (P)`
                                : "Programma la posa (P)"
                            }
                            aria-label={fissata ? "Cambia la posa" : "Programma la posa"}
                            onClick={() => apriPosa(l)}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                          </Button>
                        );
                      })()}
                  </div>
                </div>
              );
            })}

            {/* Il resto dell'elenco si carica arrivando in fondo. */}
            {limite < filtrati.length && (
              <div ref={sentinellaRef} className="p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimite((n) => n + 200)}>
                  Mostra altri ({filtrati.length - limite} rimanenti)
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── PANNELLO: tutto il resto del lead, senza cambiare pagina ─────── */}
        {dettaglio && (
          <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto border-t border-border bg-card shadow-lg lg:sticky lg:top-[7.5rem] lg:z-auto lg:max-h-[calc(100vh-9rem)] lg:w-[21rem] lg:shrink-0 lg:rounded-xl lg:border lg:shadow-none xl:w-[23rem]">
            <div className="flex items-start justify-between gap-2 border-b border-border p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold">
                    {dettaglio.data.nome} {dettaglio.data.cognome}
                  </span>
                  <button
                    type="button"
                    title="Segna come da seguire (F)"
                    onClick={() =>
                      void updateLead(dettaglio.id, { highlighted: !dettaglio.data.highlighted })
                    }
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${dettaglio.data.highlighted ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                    />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <NoteLead lead={dettaglio} className="min-w-0">
                    <ChipStato lead={dettaglio} onClick={() => apriStato(dettaglio)} />
                  </NoteLead>
                  <SpuntaCompimento
                    lead={dettaglio}
                    attiva={compLead?.id === dettaglio.id}
                    onClick={() => avviaCompimento(dettaglio)}
                  />
                  {/*  Lo stesso contatore della riga, identico nel gesto e nel
                      fumetto: chi lo impara nell'elenco lo ritrova qui. */}
                  <PulsanteChiamate
                    lead={dettaglio}
                    onCambia={(n) => void segnaChiamate(dettaglio, n)}
                  />
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => setDettaglioId(null)}
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* ── I GESTI DELLA SCHEDA APERTA ────────────────────────────
                Sopra i tre di sempre — chiama, scrivi, apri la scheda — che
                stanno sempre nello stesso posto e si imparano una volta.
                Sotto, a tutta larghezza, il gesto del momento: quando c'è, è
                il motivo per cui il pannello è stato aperto, e un quarto
                pulsante stretto in mezzo agli altri tre in un pannello da
                21rem non si preme né si legge. */}
            <div className="space-y-1.5 border-b border-border p-3">
              <div className="flex gap-1.5">
                {dettaglio.data.telefono ? (
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <a href={`tel:${dettaglio.data.telefono}`}>
                      <Phone className="mr-1 h-3.5 w-3.5" /> Chiama
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1" disabled>
                    <Phone className="mr-1 h-3.5 w-3.5" /> Chiama
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={!dettaglio.data.telefono}
                  onClick={() => apriWhatsApp(dettaglio)}
                >
                  <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setEditing(dettaglio);
                    setOpen(true);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Scheda
                </Button>
              </div>

              {puoAvviareConsulenza(dettaglio) && (
                <Button
                  size="sm"
                  className="w-full bg-sky-600 text-white hover:bg-sky-700"
                  onClick={() => void avviaConsulenza(dettaglio)}
                >
                  <Video className="mr-1 h-3.5 w-3.5" /> Avvia la videoconsulenza
                </Button>
              )}

              {/*  ── I PREVENTIVI DI QUESTO CLIENTE ──────────────────────────
                  Richiesto dal committente: da qui si vedono tutti i suoi
                  preventivi, si aprono per mostrarli in consulenza e si copia
                  il link da mandargli. Prima bisognava uscire, andare in
                  «Preventivi» e cercarlo per cognome — con due omonimi si
                  sbagliava persona, e il link partiva comunque.
                  ⚠️ A tutta larghezza e non stretto fra gli altri tre: sul
                  telefono è il pannello, non l'elenco, il posto da cui si
                  lavora un cliente, e un quarto pulsante in fila lì sopra non
                  si preme col pollice. */}
              {/*  ⚠️ Affiancati, e a metà ciascuno: sono la stessa domanda in
                  due tempi — che cosa gli ho proposto, che cosa gli ho
                  fatturato — e chi cerca l'una trova l'altra senza spostare
                  gli occhi. Uno sopra l'altro sarebbero due file in più in un
                  pannello che sul telefono si scorre già parecchio. */}
              <div className="flex gap-1.5">
                <PulsantePreventivi lead={dettaglio} className="flex-1" />
                <PulsanteFatture lead={dettaglio} className="flex-1" />
              </div>

              {/*  ── L'INVITO A UNA DIRETTA ────────────────────────────────
                  Sta QUI e non in una pagina «inviti» perché la decisione di
                  invitare qualcuno nasce guardando LUI: stai leggendo le sue
                  note, vedi che è fermo in valutazione da tre settimane, e ti
                  viene in mente che giovedì c'è la diretta sulle domande. In
                  una pagina a parte quella decisione non la prende nessuno,
                  perché quando ci arrivi non hai davanti la persona.
                  ⚠️ A tutta larghezza e sotto gli altri due: quelli sono la
                   trattativa (che gli ho proposto, che gli ho fatturato),
                   questo è un'altra cosa — e infilarlo in fila con loro
                   avrebbe fatto tre pulsanti stretti che sul telefono non si
                   premono col pollice. */}
              <PulsanteInvitaAlWebinar lead={dettaglio} className="w-full" />

              {/*  La posa dice già nel testo se c'è o non c'è una data:
                  «Programma la posa» in ambra è un passaggio che manca,
                  «Posa del 12 set» in verde è una cosa fatta che si può
                  ancora cambiare. */}
              {puoProgrammareLaPosa(dettaglio) &&
                (() => {
                  const quando = soloData(dettaglio.data.installazione?.dataInstallazione);
                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      className={`w-full ${
                        quando
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                          : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                      }`}
                      onClick={() => apriPosa(dettaglio)}
                    >
                      <Wrench className="mr-1 h-3.5 w-3.5" />
                      {quando ? `Posa del ${dataBreve(quando)}` : "Programma la posa"}
                    </Button>
                  );
                })()}
            </div>

            {/* ── LE NOTE, SUL TELEFONO, SUBITO ──────────────────────────
                Segnalato dal committente: «su mobile se cerco lead non mi fa
                vedere note neanche aprendo scheda». Le note c'erano — in
                fondo, sotto prossima azione, assegnazione, contatti,
                appuntamenti, importi, provenienza e qualifica. Su un monitor
                sono tutte a vista insieme; dentro un foglio alto tre quarti di
                schermo sono otto scorrimenti, e chi telefona non li fa: alza
                la cornetta senza sapere cosa si è detto l'ultima volta.
                ⚠️ Questa copia è `lg:hidden` e quella in fondo `hidden lg:block`:
                sul monitor non cambia NIENTE, e non si vedono mai tutte e due
                — due volte le stesse note sarebbero peggio che averle in
                fondo, perché la seconda fa dubitare della prima. */}
            {(dettaglio.data.note ||
              dettaglio.data.notePostCall ||
              dettaglio.data.noteGestione) && (
              <SezionePannello titolo="Note" className="lg:hidden">
                {[dettaglio.data.note, dettaglio.data.notePostCall, dettaglio.data.noteGestione]
                  .filter(Boolean)
                  .map((n, i) => (
                    <p
                      key={i}
                      className="whitespace-pre-wrap text-[12.5px] leading-snug text-muted-foreground"
                    >
                      {n}
                    </p>
                  ))}
              </SezionePannello>
            )}

            <SezionePannello titolo="Prossima azione">
              {(() => {
                const az = prossimaAzione(dettaglio);
                return (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <SegnoAzione cosa={az.cosa} />
                      <span className="truncate text-[13px] font-medium">{az.cosa}</span>
                    </span>
                    <span className={`shrink-0 text-[12px] ${TONO_AZIONE[az.tono]}`}>
                      {az.quando || "data non fissata"}
                    </span>
                  </div>
                );
              })()}
            </SezionePannello>

            <SezionePannello titolo="Assegnazione">
              <Select
                value={dettaglio.data.consulenteId || "nessuno"}
                onValueChange={(v) =>
                  void updateLead(dettaglio.id, { consulenteId: v === "nessuno" ? null : v })
                }
              >
                <SelectTrigger className="h-8 text-[12.5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nessuno">Nessun consulente</SelectItem>
                  {/*  Solo chi fa le consulenze: assegnare una trattativa vuol
                      dire decidere chi la porterà avanti fino alla consulenza,
                      e il nome di chi ce l'ha adesso resta comunque in tendina
                      (`consulentiScelta` tiene dentro chi ha lead assegnati). */}
                  {consulentiScelta.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.data.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NotaSoloConsulenti ripiego={ripiegoConsulenti} className="mt-1.5" />
            </SezionePannello>

            <SezionePannello titolo="Contatti">
              <VoceDettaglio etichetta="Telefono" valore={dettaglio.data.telefono} />
              <VoceDettaglio etichetta="Email" valore={dettaglio.data.email} />
              <VoceDettaglio etichetta="Città" valore={dettaglio.data.citta} />
              <VoceDettaglio etichetta="Età" valore={dettaglio.data.eta} />
            </SezionePannello>

            <SezionePannello titolo="Appuntamenti">
              <VoceDettaglio
                etichetta="Consulenza"
                valore={
                  dettaglio.data.dataMeeting
                    ? etichettaQuando(
                        soloData(dettaglio.data.dataMeeting),
                        dettaglio.data.oraMeeting,
                      )
                    : ""
                }
              />
              <VoceDettaglio
                etichetta="Ricontatto"
                valore={
                  dettaglio.data.dataRicontatto
                    ? etichettaQuando(
                        soloData(dettaglio.data.dataRicontatto),
                        dettaglio.data.oraRicontatto,
                      )
                    : ""
                }
              />
              <VoceDettaglio
                etichetta="In sede"
                valore={
                  dettaglio.data.dataVieneInSede
                    ? etichettaQuando(
                        soloData(dettaglio.data.dataVieneInSede),
                        dettaglio.data.oraVieneInSede,
                      )
                    : ""
                }
              />
              <VoceDettaglio
                etichetta="Installazione"
                valore={
                  dettaglio.data.installazione?.dataInstallazione
                    ? etichettaQuando(
                        soloData(dettaglio.data.installazione.dataInstallazione),
                        dettaglio.data.installazione.orarioInstallazione,
                      )
                    : ""
                }
              />
              <VoceDettaglio
                etichetta="Entrato il"
                valore={
                  dettaglio.data.createdAt ? dataBreve(soloData(dettaglio.data.createdAt)) : ""
                }
              />
            </SezionePannello>

            {(dettaglio.data.payment?.prezzoFinaleVendita ||
              dettaglio.data.payment?.accontoPagato) && (
              <SezionePannello titolo="Importi">
                <VoceDettaglio
                  etichetta="Prezzo finale"
                  valore={
                    dettaglio.data.payment?.prezzoFinaleVendita
                      ? `€ ${dettaglio.data.payment.prezzoFinaleVendita}`
                      : ""
                  }
                />
                <VoceDettaglio
                  etichetta="Acconto"
                  valore={
                    dettaglio.data.payment?.accontoPagato
                      ? `€ ${dettaglio.data.payment.accontoPagato}`
                      : ""
                  }
                />
                <VoceDettaglio
                  etichetta="Saldo"
                  valore={
                    dettaglio.data.payment?.saldoRimanente
                      ? `€ ${dettaglio.data.payment.saldoRimanente}`
                      : ""
                  }
                />
                <VoceDettaglio etichetta="Prodotto" valore={dettaglio.data.payment?.prodotto} />
              </SezionePannello>
            )}

            {/* ── I DATI DI RIFERIMENTO, CHIUSI SUL TELEFONO ────────────────
                Provenienza e qualifica non si guardano per DECIDERE: si
                guardano una volta, quando si prepara la telefonata. In un
                foglio alto tre quarti di schermo però stanno in mezzo alla
                strada di tutto il resto — e chi scorre per arrivare agli
                appuntamenti se li rilegge venti volte al giorno senza volerlo.
                Sul monitor restano aperti come sempre: là stanno tutti a
                vista insieme e non costano niente a nessuno.
                ⚠️ CHIUSI, NON TOLTI, e la differenza è la campagna: quando un
                 lead arriva da un annuncio, «da quale» è l'unica cosa che
                 spiega perché ha certe aspettative. Toglierla dal telefono
                 vorrebbe dire che chi lavora fuori sede non la vede mai. */}
            <div className={mostraTuttiIDati ? "contents" : "hidden lg:contents"}>
              <SezionePannello titolo="Provenienza">
                <VoceDettaglio etichetta="Fonte" valore={dettaglio.data.fonte} />
                <VoceDettaglio etichetta="Piattaforma" valore={dettaglio.data.piattaformaAds} />
                <VoceDettaglio
                  etichetta="Campagna"
                  valore={dettaglio.data.tracking?.utm_campaign}
                />
                <VoceDettaglio etichetta="Origine" valore={dettaglio.data.tracking?.utm_source} />
                <VoceDettaglio
                  etichetta="Importato da lista"
                  valore={dettaglio.data.importato ? "sì" : ""}
                />
                <VoceDettaglio
                  etichetta="Già in archivio"
                  valore={
                    dettaglio.data.giaPresente
                      ? `sì${dettaglio.data.giaPresenteCount ? ` (×${dettaglio.data.giaPresenteCount})` : ""}`
                      : ""
                  }
                />
              </SezionePannello>

              {(dettaglio.data.qualifica?.disagio ||
                dettaglio.data.qualifica?.urgenza ||
                dettaglio.data.qualifica?.painPoints?.length) && (
                <SezionePannello titolo="Qualifica">
                  <VoceDettaglio
                    etichetta="Disagio"
                    valore={
                      dettaglio.data.qualifica?.disagio
                        ? `${dettaglio.data.qualifica.disagio}/10`
                        : ""
                    }
                  />
                  <VoceDettaglio etichetta="Urgenza" valore={dettaglio.data.qualifica?.urgenza} />
                  <VoceDettaglio
                    etichetta="Priorità"
                    valore={(dettaglio.data.qualifica?.painPoints || []).join(", ")}
                  />
                </SezionePannello>
              )}
            </div>

            {/*  Il comando che li apre: solo sul telefono, perché sul monitor
                non c'è niente da aprire. */}
            <button
              type="button"
              onClick={() => setMostraTuttiIDati((v) => !v)}
              className="w-full border-t border-border px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground transition hover:text-foreground lg:hidden"
            >
              {mostraTuttiIDati ? "Nascondi provenienza e qualifica" : "Provenienza e qualifica"}
            </button>

            {(dettaglio.data.note ||
              dettaglio.data.notePostCall ||
              dettaglio.data.noteGestione) && (
              <SezionePannello titolo="Note" className="hidden lg:block">
                {[dettaglio.data.note, dettaglio.data.notePostCall, dettaglio.data.noteGestione]
                  .filter(Boolean)
                  .map((n, i) => (
                    <p
                      key={i}
                      className="whitespace-pre-wrap text-[12.5px] leading-snug text-muted-foreground"
                    >
                      {n}
                    </p>
                  ))}
              </SezionePannello>
            )}

            <div className="border-t border-border p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                //  ⚠️ IL PANNELLO SI CHIUDEVA COMUNQUE, anche quando
                //   l'eliminazione non era avvenuta: `deleteLead` risponde
                //   `false` se l'archivio ha rifiutato (crm/CRMContext), e
                //   chiudere sopra a un rifiuto è il modo per credere che il
                //   lead sia sparito e ritrovarselo in elenco al giro dopo. Si
                //   aspetta la risposta e si chiude solo se è sparito davvero;
                //   se no il pannello resta aperto, sulla stessa persona, con il
                //   motivo del database già a schermo.
                onClick={() => {
                  if (!confirm(`Eliminare ${dettaglio.data.nome} ${dettaglio.data.cognome}?`))
                    return;
                  void (async () => {
                    if (await deleteLead(dettaglio.id)) setDettaglioId(null);
                  })();
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Elimina lead
              </Button>
            </div>
          </aside>
        )}
      </div>

      {/* ── AZIONI DI GRUPPO: appaiono dove guardo, con quante righe toccano ── */}
      {/* ── ⚠️ LA BARRA È QUELLA CONDIVISA, NON PIÙ UNA COPIA ────────────────
          Qui c'era una seconda barra della selezione scritta a mano, identica a
          quella di crm/ui fino all'ultima classe. Due copie della stessa cosa
          divergono al primo ritocco, e infatti erano già divergenti: rifacendo
          il disegno della selezione, i lead — che sono l'elenco più usato del
          CRM — sarebbero rimasti con la barra vecchia.
          I pulsanti dentro sono restati quelli di questa pagina, perché le
          azioni sono sue: la barra dà il guscio, il conteggio e la X. */}
      <BarraSelezione conteggio={selezionati.length} onAnnulla={() => setSelected(new Set())}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className={CLASSE_AZIONE_BARRA} disabled={inCorso}>
              Stato <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56">
            <DropdownMenuLabel>Esito appuntamento</DropdownMenuLabel>
            {ESITI_MASSIVI.map((s) => (
              <DropdownMenuItem key={s} onClick={() => void statoMassivo(s)}>
                {LEAD_STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Stato del lead</DropdownMenuLabel>
            {STATI_MASSIVI.map((s) => (
              <DropdownMenuItem key={s} onClick={() => void statoMassivo(s)}>
                {LEAD_STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className={CLASSE_AZIONE_BARRA} disabled={inCorso}>
              <UserRound className="mr-1 h-3.5 w-3.5" /> Assegna
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52">
            <DropdownMenuLabel>Assegna a</DropdownMenuLabel>
            {/*  Lo stesso elenco della tendina «Assegnazione» del pannello:
                  qui si assegna a mazzi, ed è proprio il gesto in cui un nome
                  sbagliato in elenco fa il danno moltiplicato per venti. */}
            {consulentiScelta.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => void assegnaMassivo(c.id)}>
                {c.data.nome}
              </DropdownMenuItem>
            ))}
            {ripiegoConsulenti && (
              //  Dentro un menu la nota va come voce SPENTA: una riga
              //  premibile che non assegna niente sarebbe peggio del silenzio.
              <DropdownMenuItem disabled className="whitespace-normal text-[11px] leading-snug">
                {TESTO_SOLO_CONSULENTI}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void assegnaMassivo(null)}>
              Togli assegnazione
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="ghost"
          className={CLASSE_AZIONE_BARRA}
          onClick={whatsappMassivo}
          disabled={inCorso}
        >
          <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={CLASSE_AZIONE_BARRA}
          onClick={() => esportaCsv(selezionati, "selezione")}
          disabled={inCorso}
        >
          <Download className="mr-1 h-3.5 w-3.5" /> Esporta
        </Button>
        {/*  ⚠️ L'ELIMINA IN ROSSO E IN FONDO: è l'unico comando della barra
              che non si può disfare, e il suo vicino di casa non deve essere
              un pulsante che si preme dieci volte al giorno. */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-[12.5px] text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
          onClick={() => void eliminaMassivo()}
          disabled={inCorso}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Elimina
        </Button>
      </BarraSelezione>

      {/* ── LA CONFERMA DELL'ELIMINAZIONE ────────────────────────────────────
          ⚠️ NON C'È «ANNULLA» DOPO: un lead eliminato non si ripesca da nessun
           cestino, quindi la domanda sta PRIMA — con i nomi dentro, perché in
           un elenco preso con Maiusc su venti righe «23 lead» non fa vedere se
           dentro c'è quello sbagliato.
          È la stessa finestra dell'eliminazione delle fatture: stesso rosso,
          stesso posto, stesse parole. Due conferme diverse per lo stesso gesto
          insegnano a premere senza leggere. */}
      <Finestra
        aperta={daButtare.length > 0}
        onCambio={(v) => {
          if (!v) setDaButtare([]);
        }}
        larghezza="sm"
        bloccante
        icona={Trash2}
        titolo={
          daButtare.length === 1 ? "Elimino questo lead?" : `Elimino ${daButtare.length} lead?`
        }
        contesto="Non c'è un cestino: quello che esce non torna"
        azioni={
          <>
            <Button variant="outline" onClick={() => setDaButtare([])} disabled={inCorso}>
              Lascia stare
            </Button>
            <Button
              onClick={() => void eliminaMassivo()}
              disabled={inCorso}
              className="bg-rose-600 hover:bg-rose-700 sm:min-w-32"
            >
              {inCorso ? "Elimino…" : "Sì, elimina"}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-slate-700">
          {daButtare.length === 1 ? "Sparisce" : "Spariscono"} dall&apos;archivio con tutto quello
          che ci sta attaccato: note, appuntamenti, storia delle chiamate.
        </p>

        {/*  ⚠️ I NOMI SCRITTI, non contati: è l'unica cosa che permette di
            accorgersi che dentro la selezione c'è finito qualcuno che non
            doveva. Sopra gli otto si tronca — un elenco più lungo della
            finestra non si legge — ma quante siano le altre resta scritto,
            perché sparire in silenzio è ciò che questa riga impedisce. */}
        <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-600">
          {daButtare.slice(0, 8).map((l) => (
            <li key={l.id} className="truncate">
              {`${l.data?.nome ?? ""} ${l.data?.cognome ?? ""}`.trim() || "Senza nome"}
              {l.data?.telefono ? ` · ${l.data.telefono}` : ""}
            </li>
          ))}
          {daButtare.length > 8 && (
            <li className="pt-1 text-slate-500">e altri {daButtare.length - 8}</li>
          )}
        </ul>

        {/*  Il conto della cassa: un lead che ha comprato non è una riga
            qualunque, e cancellandolo escono dall'archivio anche i suoi soldi.
            Compare solo se ce n'è almeno uno, perché su una lista di contatti
            freddi sarebbe una riga che non dice niente. */}
        {daButtare.some((l) => Number(l.data?.payment?.accontoPagato) > 0) && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Fra questi c&apos;è chi ha già versato dei soldi: eliminandolo quegli incassi escono
              dai conti del periodo, e le fatture che gli sono state emesse restano senza scheda.
            </span>
          </p>
        )}
      </Finestra>

      {/* ── SELETTORE DI STATO ───────────────────────────────────────────────
          Uno solo, per il mouse e per la tastiera: si apre dalla pastiglia
          dello stato o con S, si filtra scrivendo, si conferma con Invio.
          Gli stati proposti sono quelli giusti per QUESTO lead — chi lavora una
          lista vede gli esiti della chiamata, chi ha fatto la consulenza vede
          quelli del lead avviato. */}
      <SelettoreStatoDialog
        lead={statoLead}
        onChiudi={() => setStatoLead(null)}
        onScegli={(l, s) => void cambiaStato(l, s)}
      />

      {/* ── LA NOTA DELLA SPUNTA, E LA CONFERMA DELLA PASTIGLIA ──────────────
          Si apre dal cerchietto accanto alla pastiglia — e, sugli stati a passo
          ovvio, dalla pastiglia stessa. È UNA finestra: dice cliente, da quale
          stato a quale e cosa comporta, chiede una nota facoltativa, Invio
          conferma ed Esc annulla. Lo stato avanza al suo compimento e la nota
          finisce datata in coda al diario della scheda — dove il riquadro a
          comparsa la ritrova subito dopo.
          I due tasti «Oppure» non confermano niente: portano dove si sarebbe
          andati comunque (gli importi dell'acconto, o l'elenco degli stati). */}
      <DialogoCompimento
        lead={compLead}
        onChiudi={() => setCompLead(null)}
        onImporti={(l) => daCompimentoA(l, "importi")}
        onAltroStato={(l) => daCompimentoA(l, "stato")}
      />

      <LeadDialog open={open} onOpenChange={setOpen} lead={editing} />

      {/* ── LA PROCEDURA GUIDATA DELLA POSA ──────────────────────────────────
          Si apre dalla riga (o con P) sui lead che hanno già pagato: prima
          l'unica strada era aprire la scheda completa, scorrere fino alla
          consegna e cercare lì il calendario dell'installatore. La finestra è
          la stessa che si usa nel modulo installazioni e nella dashboard: qui
          si monta e basta.
          Il lead resta appeso anche dopo la chiusura (`posaAperta` è l'unico
          interruttore): la finestra si chiude con la sua animazione, e
          togliendole i dati nello stesso istante si vedrebbe un riquadro vuoto
          mentre scompare. */}
      <InstallationScheduleDialog lead={posaLead} open={posaAperta} onOpenChange={setPosaAperta} />

      <QuickStatusDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        lead={quickLead}
        newStatus={quickStatus}
      />
      {chiusura.finestra}
    </div>
  );
}
