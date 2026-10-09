/** ── DA CHE COSA È FATTA UNA GIORNATA ──────────────────────────────────────
 *
 *  Questo file non disegna niente: prende le trattative e le cose scritte a
 *  mano e restituisce l'elenco delle RIGHE della pagina «Da fare oggi», già
 *  ordinate e già divise per momento. È volutamente una funzione pura — stessi
 *  lead, stessa ora, stesso risultato — perché così si può ragionare sul
 *  «che cosa entra nella giornata» senza tirarsi dietro React.
 *  È la stessa scelta, per le stesse ragioni, di
 *  crm/notifications/eventi-crm.ts, che sta al motore delle notifiche come
 *  questo file sta alla pagina.
 *
 *  ── UNA PERSONA = UNA RIGA ────────────────────────────────────────────────
 *  Un lead può soddisfare due criteri insieme (non risponde al telefono E ha un
 *  richiamo fissato per oggi). In quel caso NON compare due volte: le regole
 *  qui sotto sono un elenco ORDINATO e vince la prima che risponde, cioè la più
 *  precisa. Un nome che compare due volte in una lista di cose da fare la fa
 *  smettere di essere una lista: si perde il conto di che cosa si è già fatto.
 *
 *  ── PERCHÉ SI RAGGRUPPA PER MOMENTO E NON PER TIPO ────────────────────────
 *  La domanda di chi apre questa pagina non è «quante telefonate ho», è «e
 *  adesso?». Alle 9:40, fra una consulenza delle 9:15 e un richiamo delle
 *  10:00, il fatto che uno sia un meet e l'altro una chiamata conta molto meno
 *  del fatto che sono a venti minuti di distanza: raggruppare per tipo
 *  costringerebbe a leggere tre elenchi e a ricomporre l'orario a mente.
 *  Il TIPO non sparisce — è l'icona e il verbo di ogni riga, ed è un filtro
 *  della barra: è una lente, non una parete.
 *  Con tre cose da fare i gruppi vuoti non compaiono e la pagina è un elenco
 *  solo; con quaranta, le fasce orarie sono l'unica cosa che la rende
 *  percorribile senza scorrere due volte.
 *  ───────────────────────────────────────────────────────────────────────── */

import {
  MODO_CONSEGNA_DA_STATO,
  STATI_VINTI,
  eAppuntamento,
  posaFatta,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "@/crm/types";
import { accontoDi } from "@/crm/kpi-calcoli";
import { oggiIso, soloData } from "@/crm/ui";
import type { TonoAttesa } from "@/crm/ui";
import { giorniFra, istanteDi, oraPulita } from "./quando";
import type { TaskManuale } from "./task-manuali";

/* ═══════════════════════════════════════════════════════════════════════════
   1. I TIPI DI RIGA — che gesto è, detto con un verbo
   ═════════════════════════════════════════════════════════════════════════ */

export type TipoRiga =
  | "ricontatto"
  | "meet_da_fissare"
  | "meet_da_rifissare"
  | "chat"
  | "richiamo_setter"
  /** ── LA POSA DEL GIORNO ──────────────────────────────────────────────────
   *  L'unica riga di questo elenco che nasce da una scheda GIÀ VINTA: tutte le
   *  altre sono trattative aperte. Entra perché «e adesso cosa faccio» a metà
   *  mattina ha una risposta che per mesi non era in questa pagina — c'è un
   *  impianto da posare alle 15, e stava scritto solo in un'altra schermata. */
  | "installazione"
  | "task";

export interface MetaRiga {
  /** Il verbo all'infinito con cui inizia la riga: «Ricontattare Mario Rossi».
   *  All'infinito e non al participio («Da ricontattare») perché è un ordine
   *  che ci si dà, e si legge un quarto di secondo più in fretta. */
  verbo: string;
  /** Come si chiama il gruppo nella barra dei filtri: lì serve un sostantivo,
   *  non un comando. */
  filtro: string;
  /** Una riga che dice CHE COSA ci finisce dentro. Senza, il filtro si preme a
   *  caso e poi non si capisce perché mancano delle righe. */
  spiegazione: string;
}

export const META_RIGA: Record<TipoRiga, MetaRiga> = {
  ricontatto: {
    verbo: "Ricontattare",
    filtro: "Ricontatti",
    spiegazione: "Il richiamo è fissato per oggi: c'è una data, e spesso anche un'ora.",
  },
  meet_da_fissare: {
    verbo: "Fissare la consulenza con",
    filtro: "Meet da fissare",
    spiegazione: "Ha detto di sì alla consulenza ma non ha ancora un giorno.",
  },
  meet_da_rifissare: {
    verbo: "Rifissare la consulenza con",
    filtro: "Meet da rifissare",
    spiegazione: "La consulenza è saltata e aspetta una data nuova.",
  },
  chat: {
    verbo: "Rispondere in chat a",
    filtro: "Chat aperte",
    spiegazione: "Trattativa che si sta lavorando per messaggi: la palla è nostra.",
  },
  richiamo_setter: {
    verbo: "Riprovare a chiamare",
    filtro: "Chiamate da rifare",
    spiegazione: "Non ha risposto o è caduta la segreteria: si riprova.",
  },
  installazione: {
    verbo: "Installare",
    filtro: "Installazioni",
    spiegazione:
      "L'impianto è pagato e la posa è in calendario: c'è un giorno, e quasi sempre un'ora.",
  },
  task: {
    verbo: "",
    filtro: "Scritte a mano",
    spiegazione:
      "Le cose che ti sei scritto tu, che non nascono da un lead: hanno un giorno e, se serve, un'ora.",
  },
};

/** ── ⚠️ LO STESSO GESTO, MA DETTO COM'È DAVVERO ───────────────────────────
 *  Tre stati diversi finiscono nella stessa riga «Rifissare la consulenza
 *  con…», perché il gesto è uno: ridare una data. Ma per «Visita in sede
 *  disdetta» quella frase è FALSA — quella persona non aveva una consulenza,
 *  doveva venire in negozio — e chi la legge la richiama parlandole di un
 *  collegamento che non c'è mai stato. Il tipo di riga resta uno (serve al
 *  filtro e al conteggio); cambia la frase, dove lo stato la cambia davvero.
 *  ⚠️ Il ripiego è il verbo del tipo: uno stato nuovo che arriva qui domani
 *   non resta senza frase — dice quella generica, che è vera per tutti. */
const VERBO_PER_STATO: Partial<Record<LeadStatus, string>> = {
  sede_disdetta: "Rifissare la visita in sede con",
  //  Non si è presentato: la data c'era, ed è saltata da sola. «Riprovare»
  //  dice la cosa giusta a chi sta per prendere il telefono.
  no_show: "Riprovare la consulenza con",
  //  Era in segreteria: non è «non risponde», è «ha un messaggio che aspetta
  //  una risposta». Chi chiama sa già come aprire.
  segreteria: "Richiamare, gli hai lasciato un messaggio,",
};

export function verboRiga(tipo: TipoRiga, stato?: LeadStatus): string {
  return (stato && VERBO_PER_STATO[stato]) || META_RIGA[tipo].verbo;
}

/** L'ordine dei filtri a schermo e — non a caso — l'ordine con cui le regole
 *  vengono provate su ogni lead: dalla più precisa (c'è una data concordata)
 *  alla più dedotta (lo stato dice che c'è da riprovare). */
export const TIPI_RIGA: TipoRiga[] = [
  "ricontatto",
  "meet_da_fissare",
  "meet_da_rifissare",
  "chat",
  "richiamo_setter",
  "installazione",
  "task",
];

/* ═══════════════════════════════════════════════════════════════════════════
   2. LA RIGA
   ═════════════════════════════════════════════════════════════════════════ */

export interface RigaDaFare {
  /** Chiave stabile per React e per i conteggi: "lead:<id>" o "task:<id>".
   *  Con il prefisso perché gli id delle due fonti non si parlano e un giorno
   *  potrebbero coincidere. */
  id: string;
  tipo: TipoRiga;
  /** La frase pronta: «Ricontattare Mario Rossi». */
  cosa: string;
  /** Solo il nome, quando dietro c'è una persona: serve alla ricerca. */
  chi: string;
  lead?: Lead;
  task?: TaskManuale;
  /** Giorno ISO a cui la riga appartiene. */
  giorno: string;
  /** "15:30" oppure "" quando la cosa non ha un momento preciso. */
  ora: string;
  /** L'istante in millisecondi, `null` senza ora. */
  istante: number | null;
  /** Solo per le righe scritte a mano: già spuntata. */
  fatta: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. CHI ENTRA NELLA GIORNATA
   ═════════════════════════════════════════════════════════════════════════ */

/** Pratiche finite: si portano dietro date vecchie che non sono più lavoro.
 *  Stesso elenco — e stesso motivo — di `STATI_CHIUSI` in crm/ui.tsx: senza,
 *  una vendita conclusa un anno fa tornerebbe in cima «in ritardo di 400 g». */
const CHIUSI = new Set<LeadStatus>(["concluso", "annullato", "perdi_tempo"]);

/** Chi ha già comprato non si «ricontatta»: ha un'installazione da programmare
 *  e la sua pagina (/CRM/installazioni). Si legge
 *  `STATI_VINTI` da types.ts invece di riscrivere l'elenco: le tre chiusure
 *  vinte sono nate proprio per non essere più ricopiate a mano in venti file. */
const VINTI = new Set<LeadStatus>(STATI_VINTI);

const nomeDi = (d: LeadData): string =>
  `${d.nome || ""} ${d.cognome || ""}`.trim() || d.telefono || "Contatto senza nome";

/** Il giorno in cui lo stato ATTUALE è cominciato, quando si sa.
 *  Lo scrive CRMContext.updateLead a ogni cambio (`statoPrecedenteIl`), quindi
 *  esiste solo per le schede toccate dentro il CRM: sulle liste appena
 *  importate è assente, e va benissimo così — vedi la nota qui sotto. */
const statoCambiatoIl = (d: LeadData): string => soloData(d.statoPrecedenteIl);

/** ── LA REGOLA CHE TIENE LA PAGINA LEGGIBILE ───────────────────────────────
 *  Tre dei cinque tipi di riga nascono da uno STATO e non da una data
 *  ("Meet da fissare", "Chat", "Non risponde"): se bastasse lo stato, un
 *  archivio importato di ottocento numeri farebbe comparire ottocento righe il
 *  primo giorno, e la pagina «Da fare oggi» sarebbe l'elenco lead con un altro
 *  nome.
 *  Il criterio è quindi «è arrivato sul tavolo OGGI»: o c'è una data di oggi su
 *  un campo (ricontatto, consulenza, presa in carico della chat), oppure lo
 *  stato è cambiato oggi — cioè qualcuno ci ha messo le mani stamattina e ha
 *  lasciato qualcosa a metà.
 *  ⚠️ Chi è entrato in quello stato ieri e non è ancora stato lavorato NON
 *   compare, e non è una svista: quella è la coda arretrata, ha già la sua
 *   pagina (/CRM/avanzamento, lente «Tutta la coda») e si vede qui solo
 *   accendendo l'interruttore «anche l'arretrato». Un elenco di oggi che
 *   contiene anche ieri non è un elenco di oggi. */
const giornoDedotto = (d: LeadData): string => statoCambiatoIl(d);

interface Candidato {
  tipo: TipoRiga;
  giorno: string;
  ora: string;
}

/** Tutti i gesti che questa scheda potrebbe richiedere, dal più preciso al più
 *  dedotto. È un ELENCO e non un `return` al primo colpo, ed è una correzione
 *  che vale una riga di lavoro persa al giorno: un lead in chat che si porta
 *  dietro una data di ricontatto vecchia soddisfa la regola 1 con una data di
 *  ieri: uscendo subito, quella scheda finiva scartata come «arretrata» e la
 *  chat aperta OGGI non compariva da nessuna parte. Chi sceglie fra i candidati
 *  è `scegliCandidato`, che guarda prima la giornata e poi la precisione. */
function candidatiDi(d: LeadData): Candidato[] {
  const stato = d.stato;
  const fuori: Candidato[] = [];

  //  1. IL RICHIAMO CONCORDATO. È il caso più preciso: c'è una data, spesso
  //     un'ora, e qualcuno ha promesso al cliente di farsi sentire.
  //     `callbackAt` è il ripiego dei ricontatti automatici, che scrivono un
  //     ISO intero invece dei due campi separati.
  const giornoRicontatto = soloData(d.dataRicontatto) || soloData(d.callbackAt);
  if (giornoRicontatto) {
    fuori.push({
      tipo: "ricontatto",
      giorno: giornoRicontatto,
      ora: oraPulita(d.oraRicontatto),
    });
  }

  //  2. LA CONSULENZA DA FISSARE. Ha detto di sì e manca solo il giorno: è la
  //     cosa che frutta di più e quella che si dimentica per prima.
  if (stato === "fissa_meet_dopo") {
    fuori.push({ tipo: "meet_da_fissare", giorno: giornoDedotto(d), ora: "" });
  }

  //  3. LA CONSULENZA DA RIFISSARE. "Da riprogrammare" è lo stato di chi ha
  //     spostato l'incontro d'accordo con noi, "Cliente assente" di chi non si
  //     è presentato, "Visita in sede disdetta" di chi ha annullato la visita.
  //     Tre storie diverse, un gesto solo — ridare una data — e in una lista di
  //     cose da fare conta il gesto.
  if (stato === "da_spostare" || stato === "no_show" || stato === "sede_disdetta") {
    fuori.push({ tipo: "meet_da_rifissare", giorno: giornoDedotto(d), ora: "" });
  }

  //  4. LA CHAT APERTA. Se c'è la data di presa in carico si usa quella: dice
  //     quando la conversazione è diventata nostra, che è più preciso del
  //     cambio di stato.
  if (stato === "gestire_in_chat") {
    fuori.push({
      tipo: "chat",
      giorno: soloData(d.dataGestione) || giornoDedotto(d),
      ora: oraPulita(d.oraGestione),
    });
  }

  //  5. LA CHIAMATA DA RIFARE. È il lavoro del setter: ha squillato a vuoto o è
  //     partita la segreteria, e si riprova più tardi nella stessa giornata.
  //     "Da contattare" NON è qui di proposito: quella è la PRIMA chiamata, si
  //     lavora dalla lista importata (/CRM/avanzamento) e riempirebbe questa
  //     pagina con tutto l'archivio ancora da chiamare.
  if (stato === "non_risponde" || stato === "segreteria") {
    fuori.push({ tipo: "richiamo_setter", giorno: giornoDedotto(d), ora: "" });
  }

  return fuori;
}

/** Fra i gesti possibili vince quello che cade OGGI; se nessuno cade oggi vince
 *  il più preciso fra quelli che hanno almeno una data. È qui che si realizza
 *  «una persona = una riga»: la scelta si fa una volta, e la riga è una. */
function scegliCandidato(lista: Candidato[], oggi: string): Candidato | null {
  const conData = lista.filter((c) => !!c.giorno && c.giorno <= oggi);
  return conData.find((c) => c.giorno === oggi) ?? conData[0] ?? null;
}

export interface IngressoRighe {
  leads: Lead[];
  task: TaskManuale[];
  ora: Date;
}

/** ── SI COSTRUISCE TUTTO, SI MOSTRA UNA PARTE ──────────────────────────────
 *  Questa funzione non conosce più gli interruttori «anche l'arretrato» e
 *  «anche i prossimi giorni»: restituisce OGNI riga con la sua fascia, e la
 *  pagina decide quali fasce mostrare — esattamente come già fa con i filtri
 *  per tipo.
 *  Non è un riordino di comodo, è la correzione di un difetto: quando il filtro
 *  stava qui dentro, le righe escluse non esistevano proprio, quindi accanto
 *  all'interruttore non c'era e non poteva esserci un numero. Si premeva alla
 *  cieca «anche l'arretrato» per scoprire se c'era arretrato — ed è
 *  precisamente la regola che questa pagina si era già data per i filtri di
 *  tipo: «il numero accanto a un filtro deve dire quante righe si otterrebbero
 *  premendolo, non quante ce ne sono adesso». Un interruttore che nasconde
 *  senza dire quanto sta nascondendo è una lista che mente. */
export function costruisciRighe({ leads, task, ora }: IngressoRighe): RigaDaFare[] {
  const oggi = oggiIso(ora);
  const righe: RigaDaFare[] = [];

  for (const l of Array.isArray(leads) ? leads : []) {
    //  Scheda arrivata a metà dall'import: si salta PRIMA di leggerla. È la
    //  stessa lettura difensiva delle code di crm/ui.tsx — una sola riga senza
    //  `data` farebbe morire la pagina intera.
    const d = l?.data;
    if (!d) continue;

    /** ── LE POSE ENTRANO PRIMA DEL FILTRO SULLE VINTE ────────────────────
     *  Una posa è per definizione una scheda VINTA, cioè esattamente quello
     *  che la riga qui sotto scarta. Finché il controllo veniva prima, «Da
     *  fare oggi» non poteva mostrare nessuna installazione — e a metà mattina
     *  la domanda «e adesso cosa faccio» aveva una risposta che stava solo in
     *  un'altra schermata: c'è un impianto da posare alle 15.
     *  ⚠️ Le SPEDIZIONI non entrano: un pacco non ha un'ora e non occupa
     *   nessuno per un pomeriggio: non è un gesto della giornata, è una coda.
     *   Il modo si legge dallo stato, con la tabella di crm/types.
     *  ⚠️ E una posa già fatta non è più da fare: `posaFatta` è la stessa
     *   funzione che spegne il badge del menu e la riga della pagina pose. */
    const posa = d.installazione;
    const giornoPosa = soloData(posa?.dataInstallazione);
    if (giornoPosa && MODO_CONSEGNA_DA_STATO[d.stato] !== "spedizione" && !posaFatta(d)) {
      const chiPosa = nomeDi(d);
      const oraPosa = String(posa?.orarioInstallazione ?? "").trim();
      righe.push({
        id: `posa:${l.id}`,
        tipo: "installazione",
        cosa: `${META_RIGA.installazione.verbo} ${chiPosa}`.trim(),
        chi: chiPosa,
        lead: l,
        giorno: giornoPosa,
        ora: oraPosa,
        istante: istanteDi(giornoPosa, oraPosa),
        fatta: false,
      });
    }

    if (CHIUSI.has(d.stato) || VINTI.has(d.stato)) continue;
    //  ⚠️ L'APPUNTAMENTO GIÀ FISSATO NON ENTRA, ed è una scelta dichiarata.
    //   Le consulenze di oggi hanno già la loro schermata (la pagina Oggi,
    //   crm/MeetGiornalieri, e /CRM/agenda) con i loro esiti da segnare, i loro
    //   totali e i loro pulsanti; rifarne qui un secondo elenco vorrebbe dire
    //   due liste degli stessi appuntamenti che si possono contraddire — è
    //   esattamente il guasto già corretto fra il badge del menu e la pagina
    //   Oggi. Qui c'è il contorno della giornata, non l'agenda.
    //   Il giorno in cui il committente le volesse anche qui, è UNA regola in
    //   più in `candidatiDi` che legge dataMeeting/oraMeeting.
    if (eAppuntamento(d.stato)) continue;

    const regola = scegliCandidato(candidatiDi(d), oggi);
    //  Nessun gesto, o un gesto senza giorno: non appartiene a nessuna
    //  giornata, quindi è coda e non lavoro di oggi.
    if (!regola) continue;

    const chi = nomeDi(d);
    righe.push({
      id: `lead:${l.id}`,
      tipo: regola.tipo,
      cosa: `${verboRiga(regola.tipo, d.stato)} ${chi}`.trim(),
      chi,
      lead: l,
      giorno: regola.giorno,
      ora: regola.ora,
      istante: istanteDi(regola.giorno, regola.ora),
      fatta: false,
    });
  }

  for (const t of Array.isArray(task) ? task : []) {
    if (!t) continue;
    /** ── UNA SPUNTATA VIVE UN GIORNO SOLO ────────────────────────────────
     *  Resta barrata fino a mezzanotte — vedere quello che si è fatto è metà
     *  del motivo per cui si tiene una lista — e il giorno dopo esce
     *  dall'elenco (resta un mese nell'archivio, vedi task-manuali.tsx).
     *  Prima restava a schermo per tutto il mese di conservazione, e il
     *  risultato era che «Rimasto indietro» — il gruppo che deve gridare
     *  «questo non l'ha fatto nessuno» — si riempiva di roba fatta e barrata:
     *  trenta righe grigie sopra le due che contavano.
     *  Il giorno che conta è quello della SPUNTA (`fattaIl`), non quello per
     *  cui la riga era stata scritta: una cosa di lunedì spuntata oggi è
     *  lavoro di oggi, e va vista oggi. Le righe vecchie senza `fattaIl`
     *  ripiegano sulla loro data, che è l'unica cosa che si sa di loro. */
    if (t.fatta && (soloData(t.fattaIl) || t.data) !== oggi) continue;
    righe.push({
      id: `task:${t.id}`,
      tipo: "task",
      cosa: t.testo,
      chi: "",
      task: t,
      giorno: t.data,
      ora: oraPulita(t.ora),
      istante: istanteDi(t.data, t.ora),
      fatta: !!t.fatta,
    });
  }

  return righe;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. IL MOMENTO DELLA GIORNATA
   ═════════════════════════════════════════════════════════════════════════ */

export type Fascia =
  | "daIeri"
  | "adesso"
  | "mattina"
  | "pomeriggio"
  | "quandoCapita"
  | "arretrato"
  | "piuAvanti";

/** L'ordine in cui i gruppi compaiono a schermo, e il perché di questo ordine:
 *   · «Rimasto indietro» in cima anche se non è di oggi — è corto per
 *     costruzione (solo cose scritte a mano) ed è precisamente ciò che si
 *     dimentica una seconda volta se non lo si vede per primo;
 *   · poi il presente, poi il resto della giornata in ordine di orologio;
 *   · «Quando capita» in fondo: è la coda che si lavora quando il telefono è
 *     fermo, non deve stare fra due appuntamenti con un'ora;
 *   · l'arretrato dei lead penultimo, perché compare solo se lo si chiede;
 *   · «Nei prossimi giorni» in fondo a tutto, e non in cima come farebbe un
 *     calendario: qui non si programma la settimana, si finisce la giornata.
 *     Se stesse sopra, la prima cosa che si legge aprendo la pagina sarebbe
 *     lavoro che non è ancora nostro. */
export const FASCE: Fascia[] = [
  "daIeri",
  "adesso",
  "mattina",
  "pomeriggio",
  "quandoCapita",
  "arretrato",
  "piuAvanti",
];

export const TITOLO_FASCIA: Record<Fascia, string> = {
  daIeri: "Rimasto indietro",
  adesso: "Adesso",
  mattina: "Stamattina",
  pomeriggio: "Nel pomeriggio",
  quandoCapita: "In giornata, quando capita",
  arretrato: "Arretrato dei giorni scorsi",
  piuAvanti: "Nei prossimi giorni",
};

export const NOTA_FASCIA: Record<Fascia, string> = {
  daIeri: "Scritto a mano nei giorni scorsi e mai spuntato: si sposta a oggi in un clic",
  adesso: "È il momento — o lo era, e nessuno l'ha ancora fatto",
  mattina: "Ha un'ora, prima delle 13",
  pomeriggio: "Ha un'ora, dalle 13 in poi",
  quandoCapita: "Nessun orario: si fa quando il telefono è libero",
  arretrato: "Rimasto aperto nei giorni scorsi",
  piuAvanti: "Scritto a mano per un giorno che non è ancora arrivato",
};

/** ── I DUE MUCCHI DELL'ARRETRATO ───────────────────────────────────────────
 *  Le fasce fatte di cose SCADUTE E NON FATTE: hanno un giorno, quel giorno è
 *  passato, e nessuno le ha chiuse. Sono due e non una perché il gesto è
 *  diverso (una riga scritta a mano si sposta a oggi in un clic, un lead va
 *  richiamato), ma la domanda che pongono è la stessa — «che cosa non ho
 *  fatto» — e per questo si leggono nello stesso verso, che è quello scelto in
 *  crm/dafare/arretrati.
 *  ⚠️ «Nei prossimi giorni» NON è qui dentro, benché mescoli più giornate come
 *   gli altri due: il futuro non è arretrato, e leggerlo partendo dal giorno
 *   più lontano non risponde a nessuna domanda. Si tiene in ordine di
 *   calendario, sempre. */
export const FASCE_ARRETRATE: Fascia[] = ["daIeri", "arretrato"];

/** Il quarto d'ora che separa «più tardi» da «adesso». Non è un numero scelto
 *  qui: è lo stesso di `appuntamento_15min` nel motore delle notifiche, così la
 *  riga si accende nello stesso istante in cui arriva l'avviso. Due soglie
 *  diverse per la stessa cosa vorrebbero dire due orologi a schermo. */
export const SOGLIA_ADESSO_MS = 15 * 60_000;

/** Mezz'ora dopo l'ora una cosa non è più «adesso», è in ritardo. Anche questa
 *  arriva dal motore: è il momento in cui scatta «appuntamento passato senza
 *  esito». */
const SOGLIA_RITARDO_MS = 30 * 60_000;

/** Il confine fra mattina e pomeriggio, in minuti dalla mezzanotte. Le 13 e non
 *  le 12: qui si pranza dopo, e una consulenza delle 12:30 sta con quelle della
 *  mattina — è di quel blocco di lavoro che fa parte. */
const CONFINE_POMERIGGIO_MIN = 13 * 60;

export function fasciaDi(r: RigaDaFare, adesso: number, oggi: string): Fascia {
  if (r.giorno < oggi) return r.tipo === "task" ? "daIeri" : "arretrato";
  //  Il futuro è un gruppo suo e non «quando capita»: una cosa scritta per
  //  venerdì non è una cosa da fare oggi quando il telefono è libero, ed è la
  //  differenza fra un promemoria e una lista che si allunga da sola.
  if (r.giorno > oggi) return "piuAvanti";
  if (r.istante === null) return "quandoCapita";
  if (r.istante - adesso <= SOGLIA_ADESSO_MS) return "adesso";
  const [h, m] = r.ora.split(":");
  const minuti = Number(h) * 60 + Number(m);
  return minuti < CONFINE_POMERIGGIO_MIN ? "mattina" : "pomeriggio";
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. QUANTO MANCA
   ═════════════════════════════════════════════════════════════════════════ */

export interface Attesa {
  testo: string;
  tono: TonoAttesa;
}

const MIN = 60_000;

/** ── «FRA 12 MINUTI» ───────────────────────────────────────────────────────
 *  Il conto alla rovescia della riga, con il tono già scelto. I tre toni sono
 *  quelli di `ChipAttesa` (crm/ui.tsx) e corrispondono uno a uno ai tre momenti
 *  che il motore delle notifiche già distingue:
 *    attesa  → manca più di un quarto d'ora   (nessun avviso ancora)
 *    ora     → siamo dentro il quarto d'ora, o l'ora è appena passata
 *              (è il momento in cui arriva l'avviso, e l'unico a fondo pieno)
 *    ritardo → mezz'ora oltre l'orario: non è più un promemoria, è un buco.
 *  Sopra le due ore si smette di contare e si scrive l'ora: «fra 187 minuti»
 *  costringe a fare una divisione per sapere una cosa che l'orologio dice
 *  meglio. */
export function attesaDi(istante: number | null, ora: string, adesso: number): Attesa | null {
  if (istante === null) return null;
  const mancano = istante - adesso;
  if (mancano > 2 * 60 * MIN) return { testo: `alle ${ora}`, tono: "attesa" };
  if (mancano > 60 * MIN) {
    const min = Math.round(mancano / MIN);
    const h = Math.floor(min / 60);
    const resto = min % 60;
    return { testo: resto ? `fra ${h}h ${resto}min` : `fra ${h}h`, tono: "attesa" };
  }
  if (mancano > SOGLIA_ADESSO_MS) {
    return { testo: `fra ${Math.round(mancano / MIN)} min`, tono: "attesa" };
  }
  if (mancano > 0) {
    //  Un minuto arrotondato a zero direbbe «fra 0 min», che non vuol dire
    //  niente: sotto il minuto si dice che è adesso, perché è adesso.
    const min = Math.round(mancano / MIN);
    return { testo: min <= 0 ? "adesso" : `fra ${min} min`, tono: "ora" };
  }
  if (mancano > -SOGLIA_RITARDO_MS) return { testo: "adesso", tono: "ora" };
  const ritardo = Math.round(-mancano / MIN);
  if (ritardo < 120) return { testo: `in ritardo di ${ritardo} min`, tono: "ritardo" };
  return { testo: `era per le ${ora}`, tono: "ritardo" };
}

/** ── LA STESSA PASTIGLIA, ANCHE QUANDO IL GIORNO NON È OGGI ────────────────
 *  Dentro la giornata il conto alla rovescia è quello di sempre (`attesaDi`).
 *  Fuori dalla giornata contare i minuti sarebbe peggio che inutile: «fra 2870
 *  min» non dice niente, e «alle 15:00» su una riga di venerdì è una bugia
 *  bell'e buona — si legge come se fosse oggi pomeriggio. Fuori dalla giornata
 *  si contano quindi i GIORNI, che è l'unità con cui si decide se una cosa è un
 *  problema o no.
 *  Il tono resta quello delle altre pastiglie del CRM: rosso per il ritardo,
 *  azzurro tenue per l'attesa. L'azzurro pieno — «adesso» — resta al presente,
 *  che è l'unico momento in cui bisogna alzarsi dalla sedia. */
export function attesaRiga(r: RigaDaFare, adesso: number, oggi: string): Attesa | null {
  if (r.giorno === oggi) return attesaDi(r.istante, r.ora, adesso);
  const g = giorniFra(oggi, r.giorno);
  if (g === null || g === 0) return null;
  if (g < 0) {
    const ritardo = -g;
    return { testo: ritardo === 1 ? "da ieri" : `${ritardo} giorni fa`, tono: "ritardo" };
  }
  return { testo: g === 1 ? "domani" : `fra ${g} giorni`, tono: "attesa" };
}

/** L'ordine dentro un gruppo: prima il giorno, poi chi ha un'ora (e in ordine
 *  di orologio), poi chi non ce l'ha, e a parità il nome — così le righe
 *  restano ferme fra un aggiornamento e l'altro. Una lista che si riordina da
 *  sola mentre la si lavora fa perdere il segno, ed è la stessa ragione per cui
 *  `ordinaPerUrgenza` (crm/ui.tsx) ordina per cognome a parità di scadenza. */
export function ordinaRighe(righe: RigaDaFare[]): RigaDaFare[] {
  return [...righe].sort((a, b) => {
    //  Le righe già spuntate scendono in fondo al loro gruppo: restano visibili
    //  (vedere quello che si è fatto è metà del motivo per cui si tiene una
    //  lista) ma non stanno in mezzo al lavoro ancora aperto.
    if (a.fatta !== b.fatta) return a.fatta ? 1 : -1;
    //  ⚠️ Il giorno viene PRIMA dell'ora, e conta solo nei tre gruppi che
    //   mescolano più giornate (l'arretrato, il rimasto indietro, i prossimi
    //   giorni). Senza, una cosa di dieci giorni fa senza orario finiva sotto
    //   una di ieri con l'orario: dentro un elenco che mescola le giornate,
    //   l'ora non vuol dire niente finché non si è messo in fila il giorno.
    //  ⚠️ QUI C'ERA SCRITTO «il più vecchio deve stare in cima, SEMPRE», e
    //   quel «sempre» adesso è falso: nei due mucchi dell'arretrato il verso lo
    //   sceglie chi guarda, e di partenza si comincia dai più vicini a oggi —
    //   sono quelli che una telefonata recupera ancora. Il perché per esteso, e
    //   il perché la scelta è un comando e non una costante, stanno in
    //   crm/dafare/arretrati.
    //   Questa funzione resta com'era, con il giorno CRESCENTE: è l'ordine
    //   giusto per i quattro gruppi della giornata e per i prossimi giorni, ed
    //   è la base su cui `ordinaArretrati` rovescia il solo giorno. Girarlo qui
    //   dentro avrebbe rovesciato anche «Nei prossimi giorni», cioè avrebbe
    //   messo in cima la cosa scritta per la settimana prossima.
    if (a.giorno !== b.giorno) return a.giorno < b.giorno ? -1 : 1;
    if (a.istante !== null && b.istante !== null) return a.istante - b.istante;
    if (a.istante !== null) return -1;
    if (b.istante !== null) return 1;
    return (a.chi || a.cosa).localeCompare(b.chi || b.cosa);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. QUELLO CHE SERVE PRIMA DI ALZARE LA CORNETTA
   ═════════════════════════════════════════════════════════════════════════ */

export interface SchedaRapida {
  /** Le note generali della trattativa: è quello che si sa PRIMA della
   *  consulenza — cosa ha chiesto, cosa gli è stato promesso, com'è arrivato. */
  notePre: string;
  /** `notePostCall`: com'è andata la consulenza. Il campo esiste da sempre e ha
   *  il suo permesso dedicato (canAddPostCallNotes): non se ne inventa un
   *  altro, si legge questo. */
  notePost: string;
  /** `chiusura.note`: le righe libere sull'ACCORDO economico — la rata promessa
   *  a voce, lo sconto concesso, il «paga il resto alla consegna». Sono un'altra
   *  cosa dalle note post consulenza, ed è per questo che hanno un campo loro. */
  notePreventivo: string;
  /** Quanto vale la pratica: quello che gli è stato CHIESTO. */
  importoPreventivo: number;
  /** Quanto è già entrato in cassa. */
  acconto: number;
}

/** ── I QUATTRO PEZZI DI CARTA CHE SERVIREBBERO SULLA SCRIVANIA ─────────────
 *  ⚠️ L'importo è «quanto gli abbiamo chiesto», non «quanto abbiamo
 *   incassato»: sono i primi TRE gradini di `ricavoLordo` (crm/kpi-calcoli.ts),
 *   nello stesso ordine, MENO il quarto. Il quarto gradino di ricavoLordo è
 *   l'acconto, ed è giusto là — lì la domanda è «quanto ha fruttato questa
 *   scheda» e l'acconto è la sola cifra certa. Qui la domanda è un'altra, e
 *   mostrare 500 € di acconto sotto la parola «preventivo» farebbe dire al
 *   telefono una cifra che non è mai stata detta al cliente.
 *   L'acconto c'è, con il suo nome, sulla riga accanto — e si legge con
 *   `accontoDi`, cioè con la stessa regola dei KPI e non con una copia. */
export function schedaRapida(l: Lead): SchedaRapida {
  const d = l.data;
  const finale = Number(d.payment?.prezzoFinaleVendita) || 0;
  const totaleChiusura = Number(d.chiusura?.totalePreventivo) || 0;
  const preventivato = Number(d.payment?.prezzoTotale) || 0;
  return {
    notePre: String(d.note || "").trim(),
    notePost: String(d.notePostCall || "").trim(),
    notePreventivo: String(d.chiusura?.note || "").trim(),
    importoPreventivo: finale || totaleChiusura || preventivato || 0,
    acconto: accontoDi(l),
  };
}
