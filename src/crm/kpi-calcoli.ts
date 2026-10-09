// ── LE FORMULE DEI KPI ──────────────────────────────────────────────────────
//  Questo file contiene SOLO calcolo: nessun componente, nessuno stato. Sta
//  separato dalla pagina per un motivo pratico — le stesse formule vanno usate
//  dal riepilogo, dalla tabella per consulente e dal dettaglio giornaliero. Se
//  vivessero dentro la pagina, prima o poi una delle tre verrebbe modificata da
//  sola e le tre sezioni comincerebbero a contraddirsi.
//
//  ── DA DOVE VENGONO QUESTI NUMERI ─────────────────────────────────────────
//  Sono la trascrizione fedele del CRM che l'azienda già usa. La regola seguita
//  qui è: prima l'identità dei numeri, poi l'eleganza della formula. Dove il
//  CRM di riferimento è incoerente (e in un paio di punti lo è, sono segnalati
//  con "SCELTA DEL RIFERIMENTO") la scelta viene replicata tale e quale: un
//  numero "più giusto" ma diverso da quello a cui si è abituati non viene
//  creduto, e un KPI a cui non si crede non serve a niente.

import { totaleCostiPratica } from "@/crm/costi-pratica";
import type { AdSpending, Consultant, Lead } from "@/crm/types";
import { eAppuntamento, STATI_CHIUSURA_VINTA } from "@/crm/types";

// ── I DUE ELENCHI DI STATI CHE DECIDONO TUTTO ───────────────────────────────
//  "Consulenza fatta" = la persona si è presentata e ha parlato con qualcuno,
//  qualunque sia poi stato l'esito (anche "perdi tempo": la consulenza è
//  comunque avvenuta e ha comunque consumato un'ora di agenda).
//  Nota: "presentato" non esiste fra gli stati di questo CRM ma resta
//  nell'elenco per allineamento con l'originale — non fa danno, semplicemente
//  non trova mai riscontro.
export const STATI_CONSULENZA: readonly string[] = [
  "presentato",
  "venduto",
  //  Le tre chiusure vinte prendono il posto che aveva il solo "venduto": se il
  //  cliente ha comprato, la consulenza c'è stata per definizione. Senza questa
  //  riga ogni vendita chiusa da oggi sparirebbe dalle consulenze svolte — e
  //  siccome le consulenze sono il DENOMINATORE del tasso di chiusura, il tasso
  //  sarebbe salito da solo, di colpo, senza che nessuno avesse venduto di più.
  ...STATI_CHIUSURA_VINTA,
  "acconto",
  "da_ricontattare",
  "sta_valutando",
  "perdi_tempo",
  "in_attesa_acconto",
  "viene_in_sede",
  "gestire_in_chat",
  "concluso",
  //  ⚠️ "irreperibile" NON è qui, ed è una scelta, non una dimenticanza. Questo
  //   elenco vuol dire «la persona si è presentata e ha parlato con qualcuno»,
  //   e il silenzio non lo dimostra: lo si segna dopo una consulenza vera, ma
  //   anche dopo una serie di telefonate a vuoto su un lead che non è mai
  //   arrivato in agenda. Contare quelle come consulenze svolte gonfierebbe il
  //   denominatore e farebbe scendere il tasso di chiusura senza motivo.
  //   Se il committente decide il contrario, è una riga sola da aggiungere qui:
  //   metterla ora e toglierla fra sei mesi invece sposterebbe i numeri già
  //   letti, ed è l'unico danno che non si ripara.
];

//  "Cliente acquisito". ATTENZIONE — SCELTA DEL RIFERIMENTO: "concluso" NON è
//  qui dentro. Nel CRM di riferimento una trattativa archiviata come conclusa
//  smette di contare come conversione e sparisce dal fatturato del periodo,
//  anche se il denaro è stato incassato davvero. È un difetto, ma è il difetto
//  che produce i numeri a cui l'utente è abituato, quindi viene replicato.
//  (L'unico recupero previsto dall'originale è lo stato "viene_in_sede" con
//  l'acconto spuntato: vedi `eConversione`.)
//  ⚠️ "venduto" RESTA IN TESTA all'elenco anche se non si assegna più: in
//  archivio ci sono centinaia di schede che lo portano, e sono le vendite di
//  tutti i mesi già chiusi. Toglierlo azzererebbe il fatturato storico —
//  letteralmente: i totali dell'anno scorso andrebbero a zero da soli.
//  Le tre chiusure vinte gli si aggiungono accanto: dicono la stessa cosa e
//  valgono un cliente acquisito ciascuna, esattamente come lui.
export const STATI_CONVERSIONE: readonly string[] = ["venduto", "acconto", ...STATI_CHIUSURA_VINTA];

// Stati esclusi dai conteggi di costo: un no-show non è un lead che è costato
// una consulenza, e un "fissa meet dopo" non è ancora entrato nel funnel.
const STATI_NON_CONTEGGIABILI: readonly string[] = ["no_show", "fissa_meet_dopo"];

export type Intervallo = "oggi" | "ieri" | "3" | "7" | "15" | "30" | "60" | "90" | "tutto";

/** Vero se la data (stringa ISO o "yyyy-MM-dd") cade nel periodo scelto. */
export type FiltroPeriodo = (valore?: string | null) => boolean;

/** ── IL PERIODO ────────────────────────────────────────────────────────────
 *  Finestra mobile: "30 giorni" significa "dalle 30×24 ore fa a adesso", non
 *  "dal primo del mese". Il riferimento tiene l'ORA corrente nel taglio, quindi
 *  un lead entrato 30 giorni fa alle 9:00 esce dalla finestra se ora sono le
 *  10:00. È voluto? Probabilmente no, ma è così che contano i numeri di oggi.
 *
 *  SCELTA DEL RIFERIMENTO (difetto): "ieri" parte da ieri ALL'ORA CORRENTE e
 *  finisce a ieri 23:59, quindi copre solo la coda della giornata invece che
 *  l'intera giornata. Replicato identico.
 */
export function creaFiltroPeriodo(intervallo: Intervallo): FiltroPeriodo {
  if (intervallo === "tutto") return () => true;

  let inizio: Date;
  let fine: Date | null = null;

  if (intervallo === "oggi") {
    inizio = new Date();
    inizio.setHours(0, 0, 0, 0);
    fine = new Date(inizio);
    fine.setHours(23, 59, 59, 999);
  } else if (intervallo === "ieri") {
    inizio = new Date();
    inizio.setDate(inizio.getDate() - 1); // conserva l'ora corrente: vedi nota sopra
    fine = new Date(inizio);
    fine.setHours(23, 59, 59, 999);
  } else {
    inizio = new Date();
    inizio.setDate(inizio.getDate() - Number(intervallo));
  }

  return (valore) => {
    if (!valore) return false;
    const d = new Date(valore);
    if (Number.isNaN(d.getTime())) return false;
    return fine ? d >= inizio && d <= fine : d >= inizio;
  };
}

/** Solo la parte "yyyy-MM-dd" di una data, sia essa ISO completa o già corta. */
export function giornoDi(valore?: string | null): string {
  return (valore || "").slice(0, 10);
}

/** ── QUANDO UN LEAD È UN CLIENTE ───────────────────────────────────────────
 *  Una delle tre chiusure vinte (nel nostro centro, a domicilio, da spedire),
 *  l'acconto incassato, o il vecchio "venduto" delle schede in archivio: sono
 *  tutti lo stesso fatto — questa persona ha comprato.
 *  In più il caso "viene in sede": lì la vendita si chiude di persona e lo
 *  stato resta quello, per questo l'acconto spuntato vale come conversione.
 *  NON si guarda l'importo dell'acconto ma la spunta: sono due campi diversi e
 *  il riferimento usa la spunta. */
export function eConversione(lead: Pick<Lead, "data">): boolean {
  const s = lead.data.stato;
  if (STATI_CONVERSIONE.includes(s)) return true;
  if (s === "viene_in_sede" && lead.data.accontoVieneInSede === true) return true;
  /*  ── ⚠️ E SE I SOLDI SONO ENTRATI, HA COMPRATO ─────────────────────────
      Detto dal committente con queste parole: «per chiusure si intende basta
      che l'acconto sia incassato».
      Di norma non serve — `applyAutoStatus` porta a «Acconto incassato» ogni
      scheda con un anticipo sopra lo zero — ma «di norma» non basta su un
      numero che finisce nei conti. Restano fuori le schede scritte prima che
      quella regola esistesse, quelle arrivate da un'importazione, e quelle
      messe a mano in uno stato che l'automatismo non tocca.
      Il risultato era una vendita con dei soldi incassati che non compariva
      in nessun periodo: nessuna somma la smentiva, e il fatturato usciva più
      basso del vero senza che niente lo dicesse.
      ⚠️ Si guarda l'IMPORTO e non la spunta: la spunta dice «me lo ha
       promesso», l'importo dice che è arrivato. */
  return (Number(lead.data.payment?.accontoPagato) || 0) > 0;
}

/** ── FATTURATO LORDO DI UNA SCHEDA ─────────────────────────────────────────
 *  L'IMPORTO DAVVERO SALVATO SUL LEAD, cercato in ordine di attendibilità e
 *  fermandosi al primo che esiste.
 *
 *  Il primo gradino è `prezzoFinaleVendita` e da solo basta quasi sempre: è il
 *  prezzo concordato a fine trattativa, ed è l'UNICO che il riferimento
 *  guardava. Finché c'è quello i numeri sono identici a ieri, scheda per
 *  scheda — il passato non si muove di un euro.
 *
 *  Gli altri gradini valgono solo dove prima usciva ZERO. Il divieto di
 *  ripiego («niente prezzoTotale, niente acconto») era scritto per non gonfiare
 *  il fatturato rispetto ai numeri noti, e serviva finché il prezzo finale era
 *  l'unico posto in cui si scriveva una cifra. Oggi la chiusura ne ha un altro
 *  (`chiusura.totalePreventivo`) e la richiesta del committente è esplicita: il
 *  ricavo è quello che c'è scritto sulla scheda. Una vendita registrata senza
 *  prezzo finale valeva zero e abbassava ogni media della pagina — un errore
 *  più grande di quello che si voleva evitare.
 *
 *  ⚠️ QUALCHE TOTALE SI MUOVERÀ, E VERSO L'ALTO. Le schede chiuse che avevano
 *   solo il totale del preventivo o solo l'acconto entrano nel fatturato da
 *   oggi: sono soldi veri, ma chi confronta con uno screenshot di ieri deve
 *   sapere perché il numero è cambiato.
 *  ⚠️ L'ACCONTO È L'ULTIMO GRADINO e non è il fatturato della pratica: è la
 *   sola cifra certa quando non ce n'è nessun'altra. Sottostima, non gonfia —
 *   fra i due errori possibili è quello che non fa prendere decisioni sbagliate. */
export function ricavoLordo(lead: Pick<Lead, "data">): number {
  const d = lead.data;
  const finale = Number(d.payment?.prezzoFinaleVendita) || 0;
  if (finale > 0) return finale;
  const totalePreventivo = Number(d.chiusura?.totalePreventivo) || 0;
  if (totalePreventivo > 0) return totalePreventivo;
  const preventivato = Number(d.payment?.prezzoTotale) || 0;
  if (preventivato > 0) return preventivato;
  return accontoDi(lead);
}

/** ── MARGINE DI UNA SCHEDA (NETTO) ─────────────────────────────────────────
 *  Prezzo finale meno i costi dichiarati sulla scheda: taglio, installatore,
 *  prodotto e il viaggio della posa a domicilio (costoTrasferta, che le pose a
 *  domicilio salvano insieme agli altri). Se il prezzo è stato scritto IVA inclusa lo si
 *  scorpora prima (÷1,22) perché l'IVA non è ricavo, è denaro dello Stato che
 *  transita.
 *
 *  SCELTA DEL RIFERIMENTO: i costi vengono sottratti al prezzo GIÀ scorporato,
 *  come se fossero anch'essi netti — e il risultato NON viene fermato a zero.
 *  Una scheda con costi maggiori del prezzo restituisce un margine negativo e
 *  abbassa il totale. È corretto sul piano economico (quella vendita ha perso
 *  denaro) ed è ciò che fa l'originale, quindi resta così. */
export function ricavoNetto(lead: Pick<Lead, "data">): number {
  //  ⚠️ LA SOMMA NON SI SCRIVE PIÙ QUI. Stava scritta in tre posti — questo,
  //   kpi-netto e la scheda del lead — e chi aggiungeva una voce doveva
  //   ricordarsene tre volte. Non è andata bene nemmeno una volta: il costo
  //   della trasferta è stato scritto per mesi e sommato in uno solo dei tre.
  //   Adesso la fa `totaleCostiPratica`, che conta anche le voci scritte a
  //   mano (crm/costi-pratica).
  const costi = lead.data.payment?.costi;
  const totaleCosti = totaleCostiPratica(lead.data);
  let lordo = ricavoLordo(lead);
  if (costi?.ivaInclusa) lordo = lordo / 1.22;
  return lordo - totaleCosti;
}

/** Acconto effettivamente incassato sulla scheda.
 *  `payment.accontoPagato` resta la cassa e comanda: è il campo che fa scattare
 *  lo stato "acconto" e che ricalcola il saldo. `chiusura.accontoIncassato` è
 *  quello che si è digitato chiudendo la vendita, e i due DEVONO essere lo
 *  stesso numero — chi scrive la chiusura li salva insieme.
 *  Il ripiego esiste per il giorno in cui non succede: meglio un acconto letto
 *  dal posto sbagliato che un incasso vero che nei KPI vale zero. Se un giorno
 *  i due numeri divergono, quello giusto è sempre payment. */
export function accontoDi(lead: Pick<Lead, "data">): number {
  return (
    Number(lead.data.payment?.accontoPagato) || Number(lead.data.chiusura?.accontoIncassato) || 0
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  RIEPILOGO GENERALE
// ────────────────────────────────────────────────────────────────────────────

export interface MetricheGenerali {
  /** Lead entrati nel periodo, esclusi no-show e "fissa meet dopo". */
  lead: number;
  /** Lead entrati nel periodo senza alcuna esclusione: serve solo da controllo. */
  leadGrezzi: number;
  /** Appuntamenti validi: hanno una data meeting, non sono no-show né rinviati. */
  appuntamenti: number;
  /** Appuntamenti compresi i no-show: denominatore dello show rate. */
  appuntamentiConNoShow: number;
  /** Consulenze effettivamente svolte (stato in STATI_CONSULENZA). */
  consulenze: number;
  noShow: number;
  conversioni: number;
  spesa: number;
  fatturatoLordo: number;
  /** Margine del periodo, spesa pubblicitaria GIÀ sottratta (vedi nota). */
  fatturatoNetto: number;
  /** Quello dei due che corrisponde all'interruttore lordo/netto. */
  ricavo: number;
  costoPerLead: number;
  costoPerAppuntamento: number;
  /** Costo per cliente acquisito. */
  cpa: number;
  roas: number;
  /** Conversione: clienti su appuntamenti (i no-show non pesano). */
  cvr: number;
  /** Percentuale di appuntamenti a cui la persona si è presentata. */
  showRate: number;
  /** Percentuale di consulenze svolte che diventano cliente. */
  closeRate: number;
  /** Percentuale di lead che arriva a fissare un appuntamento. */
  leadVersoAppuntamento: number;
  /** Percentuale di lead che diventa cliente (l'imbuto intero). */
  conversioneTotale: number;
}

export function calcolaMetricheGenerali(
  leads: Lead[],
  adSpending: AdSpending[],
  dentro: FiltroPeriodo,
  lordo: boolean,
): MetricheGenerali {
  // ATTRIBUZIONE: nel riepilogo TUTTO è agganciato alla data di INGRESSO del
  // lead (`createdAt`), conversioni comprese. Significa che un lead entrato a
  // gennaio e chiuso a marzo pesa su gennaio. Il dettaglio giornaliero, più
  // sotto, usa invece la data del meeting per le conversioni: le due sezioni
  // NON tornano fra loro. È così anche nel riferimento (vedi `calcolaGiorni`).
  const nelPeriodo = leads.filter((l) => dentro(l.data.createdAt));

  const noShow = nelPeriodo.filter((l) => l.data.stato === "no_show").length;

  // Base dei costi: un no-show non è costato una consulenza e un rinvio non è
  // ancora un lead lavorato, quindi non diluiscono il costo per lead.
  const conteggiabili = nelPeriodo.filter((l) => !STATI_NON_CONTEGGIABILI.includes(l.data.stato));
  const lead = conteggiabili.length;

  const appuntamenti = nelPeriodo.filter(
    (l) => !!l.data.dataMeeting && !STATI_NON_CONTEGGIABILI.includes(l.data.stato),
  ).length;

  // Denominatore dello show rate: qui i no-show DEVONO esserci, altrimenti la
  // percentuale sarebbe sempre 100%. Restano fuori solo i meeting rinviati.
  const appuntamentiConNoShow = nelPeriodo.filter(
    (l) => !!l.data.dataMeeting && l.data.stato !== "fissa_meet_dopo",
  ).length;

  const chiusi = nelPeriodo.filter(eConversione);
  const conversioni = chiusi.length;

  const consulenze = nelPeriodo.filter((l) => STATI_CONSULENZA.includes(l.data.stato)).length;

  const spesa = adSpending
    .filter((s) => dentro(s.data.data))
    .reduce((somma, s) => somma + (Number(s.data.importoSpeso) || 0), 0);

  const fatturatoLordo = chiusi.reduce((somma, l) => somma + ricavoLordo(l), 0);
  // SCELTA DEL RIFERIMENTO: il "netto" non è solo il margine sulle schede — ha
  // già dentro la spesa pubblicitaria del periodo. È quindi il risultato del
  // periodo, non il margine commerciale. Va detto in pagina, altrimenti
  // sembra un errore di calcolo.
  const fatturatoNetto = chiusi.reduce((somma, l) => somma + ricavoNetto(l), 0) - spesa;
  const ricavo = lordo ? fatturatoLordo : fatturatoNetto;

  return {
    lead,
    leadGrezzi: nelPeriodo.length,
    appuntamenti,
    appuntamentiConNoShow,
    consulenze,
    noShow,
    conversioni,
    spesa,
    fatturatoLordo,
    fatturatoNetto,
    ricavo,
    costoPerLead: lead > 0 ? spesa / lead : 0,
    costoPerAppuntamento: appuntamenti > 0 ? spesa / appuntamenti : 0,
    cpa: conversioni > 0 ? spesa / conversioni : 0,
    // ROAS calcolato sul ricavo VISUALIZZATO: in modalità netto il numeratore
    // ha già la spesa sottratta, quindi il moltiplicatore scende parecchio.
    // È la formula del riferimento e cambiarla cambierebbe il numero atteso.
    roas: spesa > 0 ? ricavo / spesa : 0,
    cvr: appuntamenti > 0 ? (conversioni / appuntamenti) * 100 : 0,
    showRate:
      appuntamentiConNoShow > 0
        ? ((appuntamentiConNoShow - noShow) / appuntamentiConNoShow) * 100
        : 0,
    closeRate: consulenze > 0 ? (conversioni / consulenze) * 100 : 0,
    leadVersoAppuntamento: lead > 0 ? (appuntamenti / lead) * 100 : 0,
    conversioneTotale: lead > 0 ? (conversioni / lead) * 100 : 0,
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  MEET FISSATI NEGLI ULTIMI TRE GIORNI
// ────────────────────────────────────────────────────────────────────────────

/** ── QUANTI APPUNTAMENTI SI SONO FISSATI ───────────────────────────────────
 *  Non dipende dall'intervallo scelto: sono sempre oggi, ieri e l'altro ieri,
 *  perché servono a capire se il telefono sta girando ADESSO. Si contano i lead
 *  ENTRATI in quel giorno che hanno già un appuntamento: è la misura di quanto
 *  in fretta un lead nuovo viene messo in agenda. */
export function meetFissatiUltimiTreGiorni(leads: Lead[]): {
  oggi: number;
  ieri: number;
  altroIeri: number;
} {
  const giorno = (scarto: number) => {
    const d = new Date();
    d.setDate(d.getDate() - scarto);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const conta = (g: string) =>
    leads.filter(
      (l) =>
        giornoDi(l.data.createdAt) === g &&
        !!l.data.dataMeeting &&
        l.data.stato !== "fissa_meet_dopo",
    ).length;
  return { oggi: conta(giorno(0)), ieri: conta(giorno(1)), altroIeri: conta(giorno(2)) };
}

// ────────────────────────────────────────────────────────────────────────────
//  PER CONSULENTE
// ────────────────────────────────────────────────────────────────────────────

export interface MetricheConsulente {
  id: string;
  nome: string;
  /** TUTTI i lead assegnati, no-show e rinvii COMPRESI: vedi nota nel calcolo. */
  lead: number;
  /** Appuntamenti validi: stessa definizione del riepilogo (no no-show, no rinvii). */
  appuntamenti: number;
  /** Appuntamenti realmente svolti (né no-show, né solo fissati, né rinviati). */
  meetEffettuati: number;
  /** Consulenze svolte: è il DENOMINATORE del tasso di conversione. */
  consulenze: number;
  noShow: number;
  conversioni: number;
  acconti: number;
  fatturatoLordo: number;
  /**
   * Margine sulle schede del consulente. ATTENZIONE: qui la spesa pubblicitaria
   * NON è sottratta, mentre nel margine generale sì. Sono quindi due grandezze
   * diverse e la colonna non somma al totale in alto: questo è il margine
   * commerciale puro, quello generale è il risultato del periodo.
   */
  fatturatoNetto: number;
  /** TASSO DI CONVERSIONE del consulente: clienti su consulenze svolte. */
  cvr: number;
  /** Tasso alternativo: clienti su meeting effettivamente svolti. */
  cvrSuMeet: number;
  /** Quota di lead ricevuta sul totale dei lead assegnati. */
  quotaLead: number;
  /** Spesa pubblicitaria attribuita pro-quota. */
  spesaAttribuita: number;
  /** Costo per cliente del consulente, sulla spesa attribuita. */
  cpa: number;
  leadVersoAppuntamento: number;
  appuntamentoVersoCliente: number;
}

export function calcolaMetricheConsulenti(
  leads: Lead[],
  consultants: Consultant[],
  adSpending: AdSpending[],
  dentro: FiltroPeriodo,
): MetricheConsulente[] {
  // Stesso intervallo e stessa data di attribuzione del riepilogo: se qui si
  // usasse un'altra data, la somma della tabella non tornerebbe con il totale.
  const nelPeriodo = leads.filter((l) => dentro(l.data.createdAt));
  const spesaTotale = adSpending
    .filter((s) => dentro(s.data.data))
    .reduce((somma, s) => somma + (Number(s.data.importoSpeso) || 0), 0);

  // Denominatore della quota: SOLO i lead che hanno un consulente assegnato.
  // I lead ancora da smistare non appartengono a nessuno e non devono
  // annacquare la quota di chi sta lavorando.
  const leadAssegnati = nelPeriodo.filter((l) => !!l.data.consulenteId).length;

  interface Acc {
    id: string;
    nome: string;
    lead: number;
    appuntamenti: number;
    meetEffettuati: number;
    consulenze: number;
    noShow: number;
    conversioni: number;
    acconti: number;
    fatturatoLordo: number;
    fatturatoNetto: number;
  }

  const mappa = new Map<string, Acc>();
  const riga = (id: string, nome: string): Acc => {
    let r = mappa.get(id);
    if (!r) {
      r = {
        id,
        nome,
        lead: 0,
        appuntamenti: 0,
        meetEffettuati: 0,
        consulenze: 0,
        noShow: 0,
        conversioni: 0,
        acconti: 0,
        fatturatoLordo: 0,
        fatturatoNetto: 0,
      };
      mappa.set(id, r);
    }
    return r;
  };

  // Prima l'anagrafica: un consulente senza lead nel periodo deve restare in
  // tabella a zero, altrimenti "sparisce" e sembra che non esista più.
  for (const c of consultants) riga(c.id, c.data.nome || "Sconosciuto");

  for (const l of nelPeriodo) {
    const id = l.data.consulenteId;
    if (!id) continue;
    // Un lead può puntare a un consulente cancellato: non va perso, finisce
    // sotto "Sconosciuto" come nel riferimento.
    const nome = consultants.find((c) => c.id === id)?.data.nome || "Sconosciuto";
    const r = riga(id, nome);
    // ── ATTENZIONE, QUESTA COLONNA NON SOMMA AL RIEPILOGO ────────────────────
    //  Qui si contano TUTTI i lead assegnati, no-show e "fissa meet dopo"
    //  compresi, mentre "Lead entrati" del riepilogo li esclude. Non è una
    //  svista: su questo numero si calcola la quota di spesa pubblicitaria del
    //  consulente, e un lead che poi non si presenta è comunque un lead pagato.
    //  È la scelta del riferimento e va lasciata così, altrimenti la spesa
    //  attribuita e il CPA per persona cambiano.
    r.lead++;
    // Gli appuntamenti invece usano la STESSA definizione del riepilogo (niente
    // no-show, niente rinviati): così la colonna somma al totale in alto e il
    // "da appuntamento a cliente" del singolo è confrontabile con il CVR
    // generale. Il riferimento non ha una colonna appuntamenti per consulente,
    // quindi qui non c'è un numero storico da rispettare: meglio la coerenza.
    if (l.data.dataMeeting && !STATI_NON_CONTEGGIABILI.includes(l.data.stato)) {
      r.appuntamenti++;
    }
    //  "Effettuati" vuol dire GIÀ SUCCESSI: un appuntamento ancora in
    //  calendario non conta. Vale per entrambi gli stati di appuntamento —
    //  quello del cliente di ritorno è appena stato preso, non è stato svolto.
    if (
      l.data.dataMeeting &&
      l.data.stato !== "no_show" &&
      !eAppuntamento(l.data.stato) &&
      l.data.stato !== "fissa_meet_dopo"
    ) {
      r.meetEffettuati++;
    }
    if (STATI_CONSULENZA.includes(l.data.stato)) r.consulenze++;
    if (l.data.stato === "no_show") r.noShow++;
    if (eConversione(l)) {
      r.conversioni++;
      r.acconti += accontoDi(l);
      r.fatturatoLordo += ricavoLordo(l);
      r.fatturatoNetto += ricavoNetto(l);
    }
  }

  return [...mappa.values()]
    .map((r) => {
      const quotaLead = leadAssegnati > 0 ? r.lead / leadAssegnati : 0;
      // ── SPESA ATTRIBUITA PRO-QUOTA ────────────────────────────────────────
      //  La spesa pubblicitaria è una sola e non nasce "per consulente": viene
      //  spalmata in proporzione ai lead ricevuti. È un'approssimazione — chi
      //  riceve lead più cari risulta più economico di quanto sia — ma è il
      //  criterio del riferimento e serve a dare un CPA per persona.
      const spesaAttribuita = spesaTotale * quotaLead;
      return {
        ...r,
        quotaLead,
        spesaAttribuita,
        // ── IL TASSO DI CONVERSIONE DEL CONSULENTE ──────────────────────────
        //  Clienti ÷ CONSULENZE SVOLTE, non ÷ lead ricevuti e non ÷
        //  appuntamenti fissati. Il motivo è che il consulente non sceglie
        //  quanti lead gli arrivano né chi si presenta: l'unica cosa di cui
        //  risponde è la trattativa che ha davvero condotto. I no-show sono
        //  fuori dal denominatore perché "no_show" non è uno stato di
        //  consulenza.
        cvr: r.consulenze > 0 ? (r.conversioni / r.consulenze) * 100 : 0,
        cvrSuMeet: r.meetEffettuati > 0 ? (r.conversioni / r.meetEffettuati) * 100 : 0,
        cpa: r.conversioni > 0 ? spesaAttribuita / r.conversioni : 0,
        leadVersoAppuntamento: r.lead > 0 ? (r.appuntamenti / r.lead) * 100 : 0,
        appuntamentoVersoCliente: r.appuntamenti > 0 ? (r.conversioni / r.appuntamenti) * 100 : 0,
      };
    })
    .sort((a, b) => b.fatturatoLordo - a.fatturatoLordo || b.lead - a.lead);
}

// ────────────────────────────────────────────────────────────────────────────
//  GIORNO PER GIORNO
// ────────────────────────────────────────────────────────────────────────────

export interface SpesaDelGiorno {
  id: string;
  campagna: string;
  importo: number;
}

export interface MetricheGiorno {
  giorno: string;
  spesa: number;
  lead: number;
  appuntamenti: number;
  conversioni: number;
  fatturatoLordo: number;
  fatturatoNetto: number;
  spese: SpesaDelGiorno[];
  costoPerLead: number;
  cpa: number;
}

export function calcolaGiorni(
  leads: Lead[],
  adSpending: AdSpending[],
  dentro: FiltroPeriodo,
): MetricheGiorno[] {
  const giorni = new Map<string, MetricheGiorno>();
  const riga = (g: string): MetricheGiorno => {
    let r = giorni.get(g);
    if (!r) {
      r = {
        giorno: g,
        spesa: 0,
        lead: 0,
        appuntamenti: 0,
        conversioni: 0,
        fatturatoLordo: 0,
        fatturatoNetto: 0,
        spese: [],
        costoPerLead: 0,
        cpa: 0,
      };
      giorni.set(g, r);
    }
    return r;
  };

  // 1) LEAD e APPUNTAMENTI: attribuiti al giorno di INGRESSO del lead. È il
  //    giorno in cui la pubblicità ha prodotto il contatto, quindi è il giorno
  //    su cui ha senso dividere la spesa di quel giorno.
  const nelPeriodo = leads.filter((l) => dentro(l.data.createdAt));
  for (const l of nelPeriodo) {
    if (STATI_NON_CONTEGGIABILI.includes(l.data.stato)) continue;
    const g = giornoDi(l.data.createdAt);
    if (!g) continue;
    const r = riga(g);
    r.lead++;
    if (l.data.dataMeeting) r.appuntamenti++;
  }

  // 2) CONVERSIONI: attribuite al giorno del MEETING, non a quello di ingresso.
  //    ATTRIBUZIONE DIVERSA DAL RIEPILOGO, ed è voluta: la vendita è successa
  //    il giorno della consulenza, non il giorno in cui è arrivato il numero di
  //    telefono. Conseguenza da conoscere: la somma delle conversioni di questa
  //    tabella NON coincide con il totale del riepilogo, perché lì contano per
  //    data di ingresso. Il riferimento fa esattamente così e i due numeri
  //    divergono anche là.
  //    Si scorrono TUTTI i lead, non solo quelli entrati nel periodo: una
  //    vendita fatta questa settimana su un lead di due mesi fa deve comparire
  //    nel giorno in cui è stata chiusa.
  for (const l of leads) {
    if (!eConversione(l)) continue;
    const g = giornoDi(l.data.dataMeeting || l.data.createdAt);
    if (!g || !dentro(g)) continue;
    const r = riga(g);
    r.conversioni++;
    r.fatturatoLordo += ricavoLordo(l);
    r.fatturatoNetto += ricavoNetto(l);
  }

  // 3) SPESA del giorno, con le singole campagne registrate.
  for (const s of adSpending) {
    const g = giornoDi(s.data.data);
    if (!g || !dentro(g)) continue;
    const r = riga(g);
    const importo = Number(s.data.importoSpeso) || 0;
    r.spesa += importo;
    r.spese.push({ id: s.id, campagna: s.data.campagna || "—", importo });
  }

  return [...giorni.values()]
    .map((r) => {
      // SCELTA DEL RIFERIMENTO (incoerenza): la spesa del giorno viene tolta
      // dal netto SOLO se quel giorno c'è stata almeno una conversione. Un
      // giorno con 200 € di spesa e nessuna vendita mostra netto 0 invece di
      // −200 €, e la somma della colonna risulta più ottimistica del netto
      // generale. Replicato per non cambiare i numeri storici.
      const fatturatoNetto = r.conversioni > 0 ? r.fatturatoNetto - r.spesa : r.fatturatoNetto;
      return {
        ...r,
        fatturatoNetto,
        // I costi unitari si mostrano solo se c'è stata spesa: senza spesa il
        // valore sarebbe 0 e sembrerebbe "lead gratis" invece di "non misurato".
        costoPerLead: r.lead > 0 && r.spesa > 0 ? r.spesa / r.lead : 0,
        cpa: r.conversioni > 0 && r.spesa > 0 ? r.spesa / r.conversioni : 0,
      };
    })
    .sort((a, b) => b.giorno.localeCompare(a.giorno));
}
