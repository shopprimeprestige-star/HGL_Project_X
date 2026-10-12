// ── IMPORTAZIONE DI UN ARCHIVIO CRM ─────────────────────────────────────────
//  Un archivio esportato da un CRM precedente non parla la stessa lingua di
//  questo: alcuni campi hanno un altro nome, alcuni stati qui non esistevano,
//  e il pagamento sta in una chiave diversa. Tradurre a mano ottocento schede
//  non è un'opzione — e nemmeno buttare via ciò che non combacia.
//
//  Qui la traduzione è dichiarata una volta sola e si può leggere: ogni riga
//  dice da dove viene un dato e dove va a finire. Quello che non ha una
//  corrispondenza NON viene silenziosamente perso: viene contato e mostrato,
//  così si decide sapendo cosa si sta importando.
import { ALL_LEAD_STATUSES } from "./types";
//  «Stesso numero» si decide in un posto solo in tutto il CRM: è la funzione
//  che fa diventare rosso il campo quando si scrive un numero che c'è già.
import { chiaveTelefono } from "./telefono-doppio";
//  Le date dei fogli italiani si leggono col giorno PRIMA del mese: una regola
//  sola, la stessa dell'importazione delle installazioni.
import { dataDaCella, oraDaCella } from "./installazioni-csv";
import type { AdSpending, ConsultantData, LeadData, LeadStatus, TrackingInfo } from "./types";
//  Le risposte del modulo si riconoscono in UN punto solo: vedi la nota in
//  testa a crm/modulo-lead.ts (si guarda il valore, non l'intestazione).
import {
  campoDellaColonna,
  intestazioneLeggibile,
  leggiRisposte,
  riconosciRisposta,
} from "./modulo-lead";

/** Forma di una scheda nell'archivio: tutto facoltativo, niente è garantito. */
type SchedaArchivio = Record<string, unknown>;

export interface ArchivioCrm {
  leads?: SchedaArchivio[];
  consultants?: SchedaArchivio[];
  adSpending?: SchedaArchivio[];
  //  ── ANCHE I NOSTRI FILE ─────────────────────────────────────────────────
  //  La copia completa scaricata da Impostazioni → Dati scrive i campi in
  //  italiano (`consulenti`, `spese`) e mette ogni scheda dentro `data`, come
  //  sta nel database. È il file che la gente si ritrova sul computer: se
  //  trascinandolo qui non venisse riconosciuto, direbbe «812 righe scartate»
  //  senza che nessuno capisca perché.
  consulenti?: SchedaArchivio[];
  spese?: SchedaArchivio[];
  exportedAt?: string;
  esportatoIl?: string;
  version?: number;
  versione?: number;
}

/** ── STATI: DA COME SI CHIAMAVANO A COME SI CHIAMANO ────────────────────────
 *  La maggior parte combacia già. Restano i casi in cui l'archivio usa un nome
 *  che qui non esiste: si porta al più vicino per SIGNIFICATO, non per assonanza,
 *  e la traduzione viene mostrata prima di importare. */
export const STATI_TRADOTTI: Record<string, LeadStatus> = {
  // non esiste più come stato a sé: una trattativa "non interessato" è chiusa,
  // ed è esattamente ciò che qui si chiama annullato.
  non_interessato: "annullato",
  // varianti di scrittura viste negli archivi
  daContattare: "da_contattare",
  nonRisponde: "non_risponde",
  appuntamento: "appuntamento_fissato",
  meet_fissato: "appuntamento_fissato",
  //  ⚠️ RESTA "venduto", ed è una decisione, non una dimenticanza. Questa
  //   tabella traduce gli archivi di ALTRI CRM, cioè scrive STORIA: quelle
  //   schede dicono «ha comprato» e nient'altro — di come sia arrivato
  //   l'impianto non portano notizia, e inventarla scegliendo una delle tre
  //   chiusure di oggi vorrebbe dire mettere in bocca all'archivio una cosa che
  //   non ha mai detto (per esempio far comparire in agenda pose in sede mai
  //   avvenute). "venduto" è esattamente lo stato storico che serve: non si
  //   assegna più a mano, ma si legge, conta fra le conversioni (STATI_VINTI) e
  //   vale «posa già fatta» (posaFatta) — che per un archivio chiuso è vero.
  vendita: "venduto",
  acconto_pagato: "acconto",
  in_attesa: "in_attesa_acconto",
  ricontattare: "da_ricontattare",
  valuta: "sta_valutando",
  noshow: "no_show",
  chat: "gestire_in_chat",
  sede: "viene_in_sede",
  // l'appuntamento di chi era già in archivio, scritto nei modi in cui capita
  appuntamento_ri_fissato: "appuntamento_rifissato",
  "appuntamento ri-fissato": "appuntamento_rifissato",
  rifissato: "appuntamento_rifissato",
  ri_fissato: "appuntamento_rifissato",
};

/** ── GLI STATI CHE ESISTONO DAVVERO ─────────────────────────────────────────
 *  Prima erano un elenco scritto a mano qui dentro, e si era già scollato dal
 *  vero: mancavano "fatto", "non_fatto", "da_spostare" e "sede_disdetta",
 *  quindi una scheda archiviata come consulenza svolta rientrava come «Da
 *  contattare» — l'archivio veniva importato, ma la sua storia no. Adesso
 *  l'elenco è UNO SOLO (types.ts) e non può più scollarsi. */
const STATI_VALIDI = new Set<LeadStatus>(ALL_LEAD_STATUSES);

/** Traduce uno stato dell'archivio. Sconosciuto → "da_contattare", che è il solo
 *  stato che non afferma nulla di falso su una trattativa. */
export function traduciStato(v: unknown): { stato: LeadStatus; tradotto: boolean } {
  const raw = String(v ?? "").trim();
  if (STATI_VALIDI.has(raw as LeadStatus)) return { stato: raw as LeadStatus, tradotto: false };
  const m = STATI_TRADOTTI[raw];
  if (m) return { stato: m, tradotto: true };
  return { stato: "da_contattare", tradotto: true };
}

const FONTI = new Set(["ADV", "Organico", "Passa parola", "Store"]);
function traduciFonte(v: unknown): LeadData["fonte"] {
  const raw = String(v ?? "").trim();
  if (FONTI.has(raw)) return raw as LeadData["fonte"];
  const b = raw.toLowerCase();
  //  ⚠️ «fb» e «ig» sono la colonna `platform` delle liste Meta: sono
  //   inserzioni, non passaparola. Senza queste due sigle ogni lead pagato
  //   entrava come «Organico» e il costo per contatto risultava sbagliato.
  if (b === "fb" || b === "ig" || b.includes("instagram")) return "ADV";
  if (b.includes("adv") || b.includes("ads") || b.includes("meta") || b.includes("face"))
    return "ADV";
  if (b.includes("passa")) return "Passa parola";
  if (b.includes("store") || b.includes("negozio")) return "Store";
  if (b) return "Organico";
  return undefined;
}

/** Telefono leggibile: gli archivi contengono spesso caratteri invisibili di
 *  direzione del testo, incollati dai gestionali. Restano dentro e rompono la
 *  ricerca e i link a WhatsApp. */
function pulisciTelefono(v: unknown): string {
  return String(v ?? "")
    .replace(/[‎‏‪-‮⁦-⁩]/g, "")
    .trim();
}
function testo(v: unknown): string | undefined {
  const t = String(v ?? "").trim();
  return t || undefined;
}
function numero(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export interface EsitoTraduzione {
  leads: LeadData[];
  consulenti: ConsultantData[];
  spese: AdSpending["data"][];
  /** stati che sono stati portati a un nome diverso: {vecchio → nuovo: quante} */
  statiTradotti: Record<string, { a: LeadStatus; n: number }>;
  /** schede scartate perché senza nulla di riconoscibile */
  scartate: number;
}

/** Traduce l'intero archivio. Non tocca il database: restituisce solo ciò che
 *  verrebbe scritto, perché prima di importare ottocento schede si guarda. */
export function traduciArchivio(a: ArchivioCrm): EsitoTraduzione {
  const statiTradotti: EsitoTraduzione["statiTradotti"] = {};
  let scartate = 0;

  const leads: LeadData[] = [];
  for (const riga of a.leads ?? []) {
    //  La scheda può essere piatta (archivi di altri gestionali) o dentro
    //  `data` (le righe del nostro database). Si guarda dentro se c'è.
    const r = ((riga?.data ?? riga) || {}) as SchedaArchivio;
    const nome = testo(r.nome) ?? "";
    const cognome = testo(r.cognome) ?? "";
    const telefono = pulisciTelefono(r.telefono);
    if (!nome && !cognome && !telefono) {
      scartate++;
      continue;
    }

    const { stato, tradotto } = traduciStato(r.stato);
    if (tradotto) {
      const k = String(r.stato ?? "(vuoto)");
      statiTradotti[k] = { a: stato, n: (statiTradotti[k]?.n ?? 0) + 1 };
    }

    const d: LeadData = {
      nome,
      cognome,
      telefono,
      email: testo(r.email),
      citta: testo(r.citta),
      fonte: traduciFonte(r.fonte),
      consulenteId: (r.consulenteId as string) || null,
      stato,
      highlighted: !!r.highlighted,
      createdAt: testo(r.createdAt) ?? new Date().toISOString(),
      // meeting
      dataMeeting: testo(r.dataMeeting),
      oraMeeting: testo(r.oraMeeting),
      durataMeeting: numero(r.durataMeeting) ?? 45,
      linkMeeting: testo(r.linkMeeting),
      // richiami e sede
      dataRicontatto: testo(r.dataRicontatto),
      oraRicontatto: testo(r.oraRicontatto),
      dataVieneInSede: testo(r.dataVieneInSede),
      oraVieneInSede: testo(r.oraVieneInSede),
      durataVieneInSede: numero(r.durataVieneInSede) ?? 60,
      accontoVieneInSede: !!r.accontoVieneInSede,
      // note
      note: testo(r.note),
      notePostCall: testo(r.notePostCall),
      // prodotto
      codiceColore: testo(r.codiceColore),
      dettagliImpianto: testo(r.dettagliImpianto),
      videoColoreSent: !!r.videoColoreSent,
      // ── IL PAGAMENTO CAMBIA NOME ──────────────────────────────────────────
      //  Nell'archivio la chiave è "pagamento", qui è "payment". Stesso
      //  contenuto, nome diverso: è la traduzione che salva gli importi.
      payment: (r.payment ?? r.pagamento) as LeadData["payment"],
      installazione: r.installazione as LeadData["installazione"],
      statoOrdine: (r.statoOrdine as LeadData["statoOrdine"]) || undefined,
      // lavorazione in chat e storia
      inGestione: !!r.inGestione,
      dataGestione: testo(r.dataGestione),
      oraGestione: testo(r.oraGestione),
      noteGestione: testo(r.noteGestione),
      promo: testo(r.promo),
      importato: true,
      noRispondeCount: numero(r.noRispondeCount),
      giaPresente: !!r.giaPresente,
      giaPresenteCount: numero(r.giaPresenteCount),
      acquisti: Array.isArray(r.acquisti) ? (r.acquisti as unknown[]) : undefined,
    };
    leads.push(d);
  }

  const consulenti: ConsultantData[] = (a.consultants ?? a.consulenti ?? []).map((c) => {
    const dati = (c.data ?? c) as SchedaArchivio;
    return {
      nome: testo(dati.nome) ?? "Consulente",
      email: testo(dati.email) ?? "",
      calendarioCollegato: !!dati.calendarioCollegato,
      giorniLavorativi: Array.isArray(dati.giorniLavorativi)
        ? (dati.giorniLavorativi as number[])
        : [1, 2, 3, 4, 5],
      fasceOrarie: Array.isArray(dati.fasceOrarie)
        ? (dati.fasceOrarie as { inizio: string; fine: string }[])
        : [],
      pause: (dati.pause as ConsultantData["pause"]) ?? {},
      maxCallGiorno: numero(dati.maxCallGiorno) ?? 10,
      attivo: dati.attivo === undefined ? true : !!dati.attivo,
      priorita: numero(dati.priorita) ?? 1,
    } as ConsultantData;
  });

  const spese = (a.adSpending ?? a.spese ?? []).map((x) => {
    const dati = (x.data ?? x) as SchedaArchivio;
    return {
      data: testo(dati.data) ?? new Date().toISOString().slice(0, 10),
      campagna: testo(dati.campagna) ?? "",
      fonte: testo(dati.fonte) ?? "ADV",
      importoSpeso: numero(dati.importoSpeso) ?? 0,
      leadGenerati: numero(dati.leadGenerati) ?? 0,
      meetFissati: numero(dati.meetFissati) ?? 0,
      conversioni: numero(dati.conversioni) ?? 0,
    } as AdSpending["data"];
  });

  return { leads, consulenti, spese, statiTradotti, scartate };
}

/** ── CHI È GIÀ IN ARCHIVIO: UNA REGOLA SOLA ───────────────────────────────
 *  Serve a non creare doppioni reimportando.
 *
 *  ⚠️ «STESSO NUMERO» SI DECIDE IN UN POSTO SOLO, e adesso è `chiaveTelefono`
 *   (crm/telefono-doppio) — la stessa funzione che fa diventare rosso il campo
 *   quando si scrive un numero che c'è già. Qui c'era una seconda regola,
 *   scritta a mano e con una soglia diversa (8 cifre invece di 6): due idee di
 *   «stesso numero» nello stesso programma vogliono dire che l'avviso dice
 *   «ce l'abbiamo già» e l'importazione, sulla stessa riga, crea una scheda
 *   nuova. È esattamente il cartello che `telefono-doppio` porta in testa.
 *
 *  ⚠️ SENZA TELEFONO SERVONO NOME **E** COGNOME. Il ripiego era
 *   `n:<nome>|<cognome>` sempre, anche vuoti: due schede senza niente dentro
 *   avevano la stessa chiave `n:|` e l'importazione le trattava come la stessa
 *   persona. E con il solo nome, tutti i «Mario» senza numero diventavano uno.
 *
 *  ⚠️ STRINGA VUOTA = «NON SI PUÒ DIRE CHI È». Non è una chiave: chi la riceve
 *   deve trattare quella riga come nuova e non confrontarla con nessuno (vedi
 *   `separaRitorni`). Prima «non si sa» era una chiave come le altre, cioè il
 *   modo più silenzioso di fondere due persone diverse. */
export function chiaveLead(d: { telefono?: string; nome?: string; cognome?: string }): string {
  const t = chiaveTelefono(d.telefono);
  if (t) return `t:${t}`;
  const nome = String(d.nome || "")
    .trim()
    .toLowerCase();
  const cognome = String(d.cognome || "")
    .trim()
    .toLowerCase();
  return nome && cognome ? `n:${nome}|${cognome}` : "";
}

// ── I CONTATTI DI RITORNO ───────────────────────────────────────────────────
//  IL NOME. Chiamarli "doppioni" o "saltati" era il racconto sbagliato: un
//  doppione è un errore da eliminare, e infatti l'unica cosa che si poteva fare
//  era ignorarli. Ma quelle righe non sono un errore del file: sono persone che
//  ERANO GIÀ NELL'ARCHIVIO e che oggi ricompaiono in una lista — cioè il
//  contatto più caldo che ci sia, perché ci abbiamo già parlato e sappiamo
//  com'era andata. "Contatti di ritorno" dice esattamente questo: la scheda in
//  archivio resta la sua, con il suo stato e le sue note; quello che è tornato
//  è il contatto, e chiede una decisione (di solito: si rifissa un meet).
//
//  COSA NON SI FA. Non si sovrascrive la scheda esistente con la riga del file:
//  il file sa meno dell'archivio — di solito ha solo nome e telefono — e
//  scriverci sopra cancellerebbe mesi di storia per aggiungere zero.

/** Una riga del file che ha ritrovato la propria scheda in archivio. */
export interface ContattoDiRitorno<T> {
  /** Come la riga è stata letta dal file (serve per i dati che il file porta). */
  letto: LeadData;
  /** La scheda che c'era già: è LEI che comanda, e la sua storia non si tocca. */
  scheda: T;
}

export interface EsitoRitorni<T> {
  /** Mai visti: sono questi, e solo questi, che verranno creati. */
  nuovi: LeadData[];
  /** Una voce per PERSONA, non per riga: chi compare due volte nel file resta uno. */
  ritorni: ContattoDiRitorno<T>[];
  /** Righe ripetute DENTRO il file (stessa persona due volte nella stessa lista). */
  ripetute: number;
}

/** Divide ciò che è stato letto in "mai visti" e "di ritorno".
 *  Generica sulla scheda in archivio perché qui dentro non esiste il tipo Lead
 *  del database: interessa solo che abbia un `data` con nome/cognome/telefono. */
export function separaRitorni<
  T extends { data: { telefono?: string; nome?: string; cognome?: string } },
>(letti: LeadData[], archivio: T[]): EsitoRitorni<T> {
  //  L'archivio arriva dal database: può essere vuoto, e una singola scheda può
  //  avere `data` mancante (schede vecchie salvate male). Una mappa costruita
  //  con guardie costa niente e non fa cadere la pagina.
  const perChiave = new Map<string, T>();
  for (const s of archivio ?? []) {
    if (!s || typeof s !== "object" || !s.data) continue;
    const k = chiaveLead(s.data);
    //  ⚠️ Senza chiave non si entra nella mappa: una scheda di cui non si sa
    //   dire chi è non deve farsi riconoscere da nessuno.
    if (!k) continue;
    //  Se in archivio ci sono due schede con la stessa chiave vince la PRIMA:
    //  è quella che l'elenco mostra per prima, quindi è quella che l'utente si
    //  aspetta di veder cambiare quando preme un pulsante qui.
    if (!perChiave.has(k)) perChiave.set(k, s);
  }

  //  ── LA STESSA PERSONA DUE VOLTE NELLO STESSO FILE ──────────────────────
  //   Le liste vere sono sporche: lo stesso numero compare due volte perché è
  //   stato caricato da due campagne. Senza questa guardia la seconda riga
  //   creava una SECONDA scheda per la stessa persona — cioè esattamente il
  //   doppione che l'importazione dice di evitare — e il contatto di ritorno
  //   sarebbe comparso due volte nel suo elenco.
  const viste = new Set<string>();
  const nuovi: LeadData[] = [];
  const ritorni: ContattoDiRitorno<T>[] = [];
  let ripetute = 0;

  for (const l of letti ?? []) {
    const k = chiaveLead(l);
    //  ⚠️ Una riga senza chiave è SEMPRE nuova e non si confronta con niente:
    //   trattarla come «già vista» fonderebbe fra loro righe che hanno in
    //   comune soltanto il fatto di essere incomplete.
    if (!k) {
      nuovi.push(l);
      continue;
    }
    if (viste.has(k)) {
      ripetute++;
      continue;
    }
    viste.add(k);
    const scheda = perChiave.get(k);
    if (scheda) ritorni.push({ letto: l, scheda });
    else nuovi.push(l);
  }
  return { nuovi, ritorni, ripetute };
}

// ── LE NOTE DI UNA SCHEDA, TUTTE ────────────────────────────────────────────
//  Le note di un lead non stanno in un campo solo: c'è il diario (`note`, che
//  si allunga in coda una riga per volta), gli appunti dopo la chiamata, quelli
//  della lavorazione in chat e la spiegazione di quando è stato dato per perso.
//  Chi guarda un contatto di ritorno vuole leggerle TUTTE in un colpo — quel
//  che serve per decidere se richiamarlo sta lì dentro.

export interface NotaLead {
  /** Come si legge la data, se la riga ce l'ha davanti. */
  data?: string;
  /** Da dove viene, quando non è il diario (es. "Dopo la chiamata"). */
  fonte?: string;
  testo: string;
}

/** Solo se è davvero una stringa: negli archivi importati `note` è a volte un
 *  oggetto o un numero, e trattarlo da testo scriverebbe "[object Object]". */
function soloTesto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Tutte le note di una scheda, LA PIÙ RECENTE IN ALTO.
 *  Il diario si allunga in coda (ogni riga nuova va in fondo), quindi per
 *  leggerlo dal più recente si scorre al contrario. */
export function noteDelLead(d?: Partial<LeadData> | null): NotaLead[] {
  if (!d || typeof d !== "object") return [];
  const fuori: NotaLead[] = [];

  const diario = soloTesto(d.note);
  if (diario) {
    const righe = diario
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean);
    for (const r of righe.reverse()) {
      //  Le righe scritte dal CRM hanno la forma "12 ago · Testo". Il separatore
      //  può mancare (note scritte a mano): in quel caso è tutto testo, e va
      //  bene così — meglio una nota senza data che una nota tagliata.
      const i = r.indexOf(" · ");
      const testa = i > 0 ? r.slice(0, i).trim() : "";
      if (i > 0 && testa.length <= 14) fuori.push({ data: testa, testo: r.slice(i + 3).trim() });
      else fuori.push({ testo: r });
    }
  }

  const postCall = soloTesto(d.notePostCall);
  if (postCall) fuori.push({ fonte: "Dopo la chiamata", testo: postCall });

  const gestione = soloTesto(d.noteGestione);
  if (gestione) fuori.push({ fonte: "Lavorazione in chat", testo: gestione });

  const perso = soloTesto(d.lostReasonNote);
  if (perso) fuori.push({ fonte: "Motivo del perso", testo: perso });

  return fuori;
}

// ── IMPORTAZIONE DA CSV ─────────────────────────────────────────────────────
//  Le liste arrivano da fuori — un foglio di calcolo, un'esportazione di
//  qualcun altro — e non hanno mai le stesse intestazioni. Riconoscerle a mano
//  ogni volta è lavoro sprecato: qui le intestazioni si riconoscono da sole,
//  in italiano e in inglese, con o senza accenti.

/** Divide una riga CSV rispettando le virgolette (i campi note contengono virgole). */
function dividiRiga(riga: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "",
    dentro = false;
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (c === '"') {
      if (dentro && riga[i + 1] === '"') {
        cur += '"';
        i++;
      } else dentro = !dentro;
    } else if (c === sep && !dentro) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** Il separatore non è sempre la virgola: i fogli italiani usano il punto e
 *  virgola. Si sceglie quello che compare di più nella prima riga. */
function separatore(intestazione: string): string {
  const c = (intestazione.match(/,/g) || []).length;
  const p = (intestazione.match(/;/g) || []).length;
  const t = (intestazione.match(/\t/g) || []).length;
  if (t > c && t > p) return "\t";
  return p > c ? ";" : ",";
}

const senzaAccenti = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Come si può chiamare una colonna. Il primo nome è il nostro. */
const COLONNE: Record<string, string[]> = {
  nome: ["nome", "firstname", "first_name", "name", "cliente"],
  cognome: ["cognome", "lastname", "last_name", "surname"],
  /** ── ⚠️ IL NOME TUTTO ATTACCATO ─────────────────────────────────────────
   *  Le esportazioni di Meta (Facebook/Instagram Lead Ads) non hanno nome e
   *  cognome separati: hanno `full_name`, «Mario Esempio» in una casella
   *  sola. Finché non c'era questa riga, quelle liste entravano SENZA NOME —
   *  e una scheda senza nome, per chi telefona, è un numero e basta. */
  nomeCompleto: ["fullname", "nomecompleto", "nomeecognome", "nominativo"],
  telefono: ["telefono", "phone", "cellulare", "mobile", "numero", "phonenumber", "tel"],
  email: ["email", "mail", "posta", "indirizzoemail"],
  citta: ["citta", "city", "comune", "localita"],
  fonte: ["fonte", "source", "provenienza", "canale", "platform", "piattaforma"],
  /*  ⚠️ «lead_status» è lo stato che dà META («CREATED»), non il nostro: non
      corrisponde a nessuno dei nostri stati e `traduciStato` lo riporta
      giustamente a «da contattare». Sta comunque in questo elenco perché così
      la colonna risulta LETTA: lasciandola fuori finiva fra le risposte del
      modulo, e ogni scheda importata nasceva con la nota «Dal modulo:
      CREATED» — rumore su ottocento schede. */
  stato: ["stato", "status", "esito", "leadstatus"],
  note: ["note", "notes", "annotazioni", "commento", "messaggio"],
  createdAt: ["data", "date", "createdat", "datacreazione", "dataarrivo", "createdtime"],
  /*  ── ⚠️ DA DOVE ARRIVA DAVVERO QUESTO CONTATTO ────────────────────────
      Un file di Meta (Lead Ads) porta inserzione, gruppo, campagna e modulo,
      con i loro identificativi. Prima finivano fra le «colonne ignorate»: le
      schede importate entravano senza sapere da quale inserzione venissero, e
      nei conti delle campagne (crm/ads-financials) non comparivano proprio —
      la spesa era lì, i lead che aveva prodotto no. */
  adId: ["adid", "ad_id"],
  adName: ["adname", "ad_name", "inserzione", "nomeinserzione"],
  adsetId: ["adsetid", "adset_id"],
  adsetName: ["adsetname", "adset_name", "gruppoinserzioni"],
  campaignId: ["campaignid", "campaign_id", "idcampagna"],
  campaignName: ["campaignname", "campaign_name", "campagna", "nomecampagna"],
  formId: ["formid", "form_id"],
  formName: ["formname", "form_name", "modulo", "nomemodulo"],
};

/** Meta mette una sigla davanti ai suoi identificativi (`ag:`, `as:`, `c:`,
 *  `f:`, `l:`). Dentro ai nostri conti serve il numero: con la sigla davanti
 *  non combacia con quello che arriva dalle API delle campagne, e il lead
 *  resta attaccato a un'inserzione che non esiste. */
const senzaSigla = (v: string) => v.replace(/^[a-z]{1,3}:/i, "").trim();

/* ── ⚠️ QUANDO L'INTESTAZIONE NON DESCRIVE LE SUE COLONNE ──────────────────
   Il file vero che ha fatto nascere queste righe (una lista Meta passata da
   Fogli Google) ha DICIANNOVE colonne di intestazione e diciannove valori per
   riga, e non combaciano: dalla dodicesima in poi l'intestazione è spostata di
   uno. Sotto `phone_number` c'è l'indirizzo email, sotto `email` il nome,
   sotto `full_name` la risposta a una domanda del modulo. Succede perché una
   colonna è stata spostata nel foglio e l'intestazione è rimasta indietro:
   nessuno se ne accorge guardando il file, perché a occhio le colonne sono
   tutte lì.
   Fidandosi dell'intestazione si importano trenta schede con l'email nel campo
   del telefono — e il guasto si scopre chiamando.
   Per questo l'intestazione PROPONE e i DATI DECIDONO: se la colonna che
   l'intestazione chiama «telefono» non contiene telefoni, si cerca quella che
   li contiene. Vale solo per le tre cose che si riconoscono guardandole — il
   telefono, l'email, il nome — e solo quando l'intestazione è palesemente
   smentita: dove non c'è nulla da correggere, non si corregge niente. */

/** Un telefono: da otto a quindici cifre, e si accetta il prefisso `p:` che
 *  Meta mette davanti ai numeri.
 *  ⚠️ IL TETTO DELLE QUINDICI CIFRE NON È PIGNOLERIA. Le liste Meta portano
 *   identificativi lunghissimi tutti di cifre (`l:1000000000000001`), e senza
 *   un limite superiore la colonna degli id vince su quella dei telefoni: la
 *   prima prova di questo controllo ha importato trenta schede con il numero
 *   di riferimento di Facebook al posto del cellulare. Quindici è il massimo
 *   che esista al mondo (E.164).
 *  ⚠️ E un prefisso diverso da `p:` squalifica il valore: `l:`, `ag:`, `c:`
 *   sono identificativi, non numeri da chiamare. */
const paTelefono = (v: string) => {
  const t = v.trim();
  if (/^\w{1,3}:/.test(t) && !/^p:/i.test(t)) return false;
  const corpo = t.replace(/^p:/i, "");
  //  ⚠️ NESSUNA LETTERA, e nemmeno una virgola. «Modulo senza titolo
  //   30/11/24, 01:36» ha dieci cifre dentro e senza questa riga vinceva la
  //   colonna dei telefoni: la seconda prova di questo controllo ha importato
  //   il nome del modulo come numero di telefono di tutte e ventotto le
  //   persone. Un numero è fatto di cifre e di separatori, e basta.
  if (!/^[\d\s+()./-]+$/.test(corpo)) return false;
  const cifre = (corpo.match(/\d/g) || []).length;
  return cifre >= 8 && cifre <= 15;
};
const paEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v.trim());
/** ── UN NOME E COGNOME ─────────────────────────────────────────────────────
 *  Due parole o più, solo lettere.
 *  ⚠️ DUE PAROLE E NON UNA, e serve a SCEGLIERE la colonna, non a leggerla.
 *   Le risposte a scelta multipla di Meta sono parole singole — «nulla»,
 *   «poco» — e una parola singola di sole lettere è un nome quanto lo è una
 *   risposta: la terza prova di questo controllo ha chiamato «nulla»
 *   ventotto persone. Con due parole la colonna giusta vince e quella delle
 *   risposte perde, perché i nomi veri quasi sempre sono due.
 *   Una volta scelta la colonna, i nomi di una parola sola dentro ci restano:
 *   «pinco» e «tizio» sono in questo file, e sono persone. */
const paNomeIntero = (v: string) => {
  const t = v.trim();
  if (!t || t.length > 60 || /[_/@\d]/.test(t)) return false;
  if (/^\w+:/.test(t)) return false;
  return /^[\p{L}][\p{L}'\u2019.-]*(\s+[\p{L}][\p{L}'\u2019.-]*)+$/u.test(t);
};

/** L'indice della colonna che CONTIENE davvero questa cosa, guardando i dati.
 *  `-1` se nessuna colonna la contiene abbastanza spesso.
 *  ⚠️ «Abbastanza spesso» e non «sempre»: in una lista vera un telefono manca,
 *   un'email è scritta storta. Metà delle righe piene è il segno che quella
 *   colonna è QUELLA cosa; una riga sola non lo è. */
function colonnaCheContiene(righe: string[][], pare: (v: string) => boolean): number {
  let migliore = -1;
  let punteggio = 0;
  const quante = righe.length || 1;
  for (let i = 0; i < (righe[0]?.length ?? 0); i++) {
    let centri = 0;
    for (const r of righe) if (pare((r[i] || "").trim())) centri++;
    if (centri > punteggio && centri >= Math.max(1, Math.ceil(quante / 2))) {
      punteggio = centri;
      migliore = i;
    }
  }
  return migliore;
}

/** La chiave di `COLONNE` a cui appartiene questa intestazione (la prima che
 *  combacia, come ha sempre fatto `traduciCsv`), o niente. */
function chiaveDellaColonna(h: string): string | undefined {
  const t = senzaAccenti(h);
  if (!t) return undefined;
  return Object.entries(COLONNE).find(([, alias]) => alias.some((a) => senzaAccenti(a) === t))?.[0];
}

/* ── ⚠️ RIALLINEARE L'INTESTAZIONE: STRETTO, E NEL DUBBIO NIENTE ────────────
   Sul file vero di Meta le ultime colonne del foglio (le domande del modulo)
   sono finite in mezzo ai dati, e le intestazioni sono rimaste indietro di una
   (o due) colonne: sotto `phone_number` c'è l'email, sotto `full_name` la
   risposta. Le risposte si leggevano lo stesso, ma senza domanda: «Dal modulo:
   alopecia androgenetica · abbastanza · nulla».
   Rimettere le intestazioni a posto è l'unico modo per sapere sotto QUALE
   domanda sta «nulla» (Fastidio: per niente, oppure Già provato: niente). Ma
   una risposta sotto la domanda sbagliata è peggio di una risposta senza
   domanda: si legge e si crede. Per questo scatta solo se:
    · telefono, email e nome (le ancore: cose che si riconoscono guardandole)
      sono spostate TUTTE dello stesso k, e k è 1 o 2;
    · le ultime k intestazioni sono domande che conosciamo, e si ritrovano nei
      dati dalle loro risposte, in colonne vicine, a sinistra delle ancore;
    · rimesse a posto, ogni ancora cade sulla sua colonna.
   In tutti gli altri casi l'intestazione resta com'è e NON è affidabile. */
export interface IntestazioniRiallineate {
  intestazioni: string[];
  /** Di quante colonne era spostata (0 = non toccata). */
  spostamento: number;
  /** Ci si può credere, adesso? Falso = le domande non si scrivono. */
  affidabili: boolean;
}

const ANCORE: { chiave: string; pare: (v: string) => boolean }[] = [
  { chiave: "telefono", pare: paTelefono },
  { chiave: "email", pare: paEmail },
  { chiave: "nomeCompleto", pare: paNomeIntero },
];

/** Dove sta davvero questa cosa nei dati. Se la colonna dichiarata dall'intestazione
 *  la contiene (la stessa soglia di `quadra` in `traduciCsv`) è quella; altrimenti
 *  quella che la contiene di più. */
function doveStaDavvero(campione: string[][], dichiarata: number, pare: (v: string) => boolean): number {
  const soglia = Math.max(1, Math.ceil((campione.length || 1) / 2));
  const centri = campione.filter((r) => pare((r[dichiarata] || "").trim())).length;
  return centri >= soglia ? dichiarata : colonnaCheContiene(campione, pare);
}

/** La colonna dei dati che porta le risposte di questa domanda: quella in cui la
 *  MAGGIORANZA dei valori pieni è una risposta riconosciuta. -1 se non ce n'è
 *  una sola, anche se due colonne sono ugualmente buone: non si indovina. */
function colonnaDelleRisposte(campione: string[][], campo: NonNullable<ReturnType<typeof campoDellaColonna>>, escluse: Set<number>): number {
  const larghezza = campione.reduce((m, r) => Math.max(m, r.length), 0);
  let migliore = -1;
  let rapporto = 0;
  let pari = false;
  for (let i = 0; i < larghezza; i++) {
    if (escluse.has(i)) continue;
    const pieni = campione.map((r) => (r[i] || "").trim()).filter(Boolean);
    if (!pieni.length) continue;
    const giuste = pieni.filter((v) => riconosciRisposta(v, campo)).length;
    const r = giuste / pieni.length;
    if (r <= 0.5) continue;
    if (r > rapporto) {
      migliore = i;
      rapporto = r;
      pari = false;
    } else if (r === rapporto) pari = true;
  }
  return pari ? -1 : migliore;
}

/** Le tre domande dove, in `leggiRisposte`, la colonna comanda: sono quelle che
 *  un riallineamento sbagliato metterebbe sotto la domanda sbagliata. */
const DOMANDE_NUOVE: (ReturnType<typeof campoDellaColonna>)[] = ["problema", "fastidio", "giaFatto"];

export function riallineaIntestazioni(intestazioni: string[], campione: string[][]): IntestazioniRiallineate {
  const invariata = (affidabili: boolean): IntestazioniRiallineate => ({
    intestazioni,
    spostamento: 0,
    affidabili,
  });
  //  1. Le ancore: solo quelle che l'intestazione dichiara e che nei dati si ritrovano.
  const ancore: { chiave: string; dichiarata: number; trovata: number }[] = [];
  for (const { chiave, pare } of ANCORE) {
    const dichiarata = intestazioni.findIndex((h) => chiaveDellaColonna(h) === chiave);
    if (dichiarata < 0) continue;
    const trovata = doveStaDavvero(campione, dichiarata, pare);
    if (trovata >= 0) ancore.push({ chiave, dichiarata, trovata });
  }
  //  2. Nessuna ancora: non c'è niente su cui fidarsi. Tutte a posto: non c'è niente da fare.
  if (!ancore.length) return invariata(false);
  if (ancore.every((a) => a.trovata === a.dichiarata)) return invariata(true);
  //  3. Lo stesso k per tutte, 1 o 2, e righe larghe quanto l'intestazione.
  const k = ancore[0].trovata - ancore[0].dichiarata;
  if (!(k === 1 || k === 2)) return invariata(false);
  if (ancore.some((a) => a.trovata - a.dichiarata !== k)) return invariata(false);
  const H = intestazioni.length;
  if (campione.some((r) => r.length !== H)) return invariata(false);
  //  4. Le ultime k intestazioni sono domande che conosciamo, e si ritrovano nei dati.
  const coda = intestazioni.slice(H - k);
  const escluse = new Set(ancore.map((a) => a.trovata));
  const posizioni: number[] = [];
  for (const h of coda) {
    const campo = campoDellaColonna(h);
    if (!campo) return invariata(false);
    const p = colonnaDelleRisposte(campione, campo, escluse);
    if (p < 0) return invariata(false);
    posizioni.push(p);
  }
  const s = posizioni[0];
  if (posizioni.some((p, j) => p !== s + j)) return invariata(false);   // vicine e nell'ordine
  if (s > Math.min(...ancore.map((a) => a.dichiarata))) return invariata(false);
  //  5. Le intestazioni nuove, e la controprova: ogni ancora sulla sua colonna.
  const nuove = [...intestazioni.slice(0, s), ...coda, ...intestazioni.slice(s, H - k)];
  const regge = ancore.every((a) => nuove.findIndex((h) => chiaveDellaColonna(h) === a.chiave) === a.trovata);
  if (!regge) return invariata(false);
  //  6. ⚠️ Anche le colonne-domanda che si spostano IN MEZZO devono ritrovare le
  //     loro risposte. Con due colonne scambiate (fastidio e già provato) coda e
  //     ancore tornano lo stesso, ma «abbastanza» finirebbe sotto «Già provato»
  //     e «nulla» sotto «Fastidio»: una bugia stampata. Le colonne tutte vuote
  //     non dicono niente e si saltano.
  for (let j = s; j < H; j++) {
    const campo = campoDellaColonna(nuove[j]);
    if (!campo || !DOMANDE_NUOVE.includes(campo)) continue;
    const pieni = campione.map((r) => (r[j] || "").trim()).filter(Boolean);
    if (!pieni.length) continue;
    const giuste = pieni.filter((v) => riconosciRisposta(v, campo)).length;
    if (giuste / pieni.length <= 0.5) return invariata(false);
  }
  return { intestazioni: nuove, spostamento: k, affidabili: true };
}

/** ── I BYTE DEL FILE, IN TESTO ─────────────────────────────────────────────
 *  `File.text()` legge sempre UTF-8, e un foglio salvato da Excel come «Testo
 *  Unicode» è UTF-16: ogni lettera seguita da uno zero, il separatore invisibile,
 *  e il file «non ha righe». Si guarda il BOM; senza BOM, gli zeri nelle
 *  posizioni dispari (UTF-16LE) o pari (UTF-16BE) dicono la codifica. */
export function leggiTestoFile(byte: Uint8Array): string {
  const decodifica = (codifica: string, da: number) =>
    new TextDecoder(codifica, { fatal: false }).decode(byte.subarray(da));
  if (byte.length >= 3 && byte[0] === 0xef && byte[1] === 0xbb && byte[2] === 0xbf) return decodifica("utf-8", 3);
  if (byte.length >= 2 && byte[0] === 0xff && byte[1] === 0xfe) return decodifica("utf-16le", 2);
  if (byte.length >= 2 && byte[0] === 0xfe && byte[1] === 0xff) return decodifica("utf-16be", 2);
  if (byte.length >= 2) {
    let zeriDispari = 0;
    let zeriPari = 0;
    for (let i = 0; i < byte.length; i++) if (byte[i] === 0) (i % 2 ? zeriDispari++ : zeriPari++);
    const posti = Math.floor(byte.length / 2);
    if (zeriDispari / posti > 0.3) return decodifica("utf-16le", 0);
    if (zeriPari / posti > 0.3) return decodifica("utf-16be", 0);
  }
  return decodifica("utf-8", 0);
}

/** ── EXCEL NON SI LEGGE ────────────────────────────────────────────────────
 *  Servirebbe una libreria pesante per un caso raro. Si riconosce, così
 *  l'anteprima dice cosa fare invece di «File non leggibile». */
export const MESSAGGIO_FILE_EXCEL =
  "File Excel: da Google Fogli fai File → Scarica → CSV, poi ricaricalo qui.";

/** `.xlsx`/`.xls` dal nome, oppure dai primi byte: uno zip («PK») o il vecchio
 *  formato di Office. */
export function eFileExcel(byte: Uint8Array, nome = ""): boolean {
  if (/\.(xlsx|xlsm|xls)$/i.test(nome)) return true;
  const inizia = (...b: number[]) => b.every((x, i) => byte[i] === x);
  return inizia(0x50, 0x4b, 0x03, 0x04) || inizia(0xd0, 0xcf, 0x11, 0xe0);
}

/** ── LA DATA D'ARRIVO, COME LA SCRIVE UN FOGLIO ITALIANO ──────────────────
 *  Meta scrive `2026-09-21T01:33:01-05:00` e vale com'è. Un foglio fatto a mano
 *  scrive «12/10/2026 09:15»: per un CRM italiano è il 12 ottobre. ⚠️ Lasciarla
 *  a `Date.parse` la legge all'americana (il 10 dicembre, o niente se il giorno
 *  supera il 12) e sposta di mesi l'ordine di arrivo e i periodi. Quindi: ISO
 *  com'è; altrimenti giorno/mese/anno (+ ora) e si scrive in ISO. Se non si
 *  legge, `dataDalFile` è falso e `createdAt` resta quello che era: nessuno
 *  deve credere che «è arrivato adesso» per una data che non si è capita. */
function dataDellaCella(cella: string): { createdAt: string; dataDalFile: boolean } {
  const t = cella.trim();
  if (!t) return { createdAt: "", dataDalFile: false };
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const quando = new Date(t);
    if (!Number.isFinite(quando.getTime())) return { createdAt: t, dataDalFile: false };
    //  ⚠️ Quando la data viene dal file, `createdAt` è SEMPRE un ISO completo:
    //   chi la rilegge con `new Date` o ne taglia i primi dieci caratteri
    //   (la scheda del lead) deve trovare lo stesso giorno. Quella di Meta
    //   (`…T…-05:00`) è già così e resta com'è.
    return { createdAt: /^\d{4}-\d{2}-\d{2}T/.test(t) ? t : quando.toISOString(), dataDalFile: true };
  }
  const giorno = dataDaCella(t);
  if (!giorno) return { createdAt: t, dataDalFile: false };
  //  ⚠️ Senza l'ora, MEZZOGIORNO e non mezzanotte: a mezzanotte locale l'ISO in
  //   UTC cade il giorno prima («03/04» diventerebbe «2026-04-02T22:00Z»).
  const quando = new Date(`${giorno}T${oraDaCella(t) || "12:00"}:00`);
  return Number.isFinite(quando.getTime())
    ? { createdAt: quando.toISOString(), dataDalFile: true }
    : { createdAt: t, dataDalFile: false };
}

/** Quanto può essere lungo un valore conservato, e quante colonne al massimo
 *  per scheda: una cella con un tema dentro, o un file di cento colonne, non
 *  devono gonfiare la scheda nel database. */
const MAX_CARATTERI_DATI_FILE = 200;
const MAX_CHIAVI_DATI_FILE = 40;

/** Traduce un CSV in schede pronte. Quello che non diventa un campo della
 *  scheda si CONSERVA in `datiFile` e si riporta (`colonneConservate`): così si
 *  vede subito se una colonna importante è rimasta fuori perché scritta in un
 *  modo imprevisto, e non si perde niente. */
export function traduciCsv(testo: string): {
  leads: LeadData[];
  /** I nomi (quelli di `datiFile`) delle colonne conservate senza essere usate. */
  colonneConservate: string[];
  /** ⚠️ da togliere in T8: stessa cosa di `colonneConservate`, tenuta perché
   *  `PannelloCarica` e `DaFareScheda` continuino a compilare. */
  colonneIgnorate: string[];
  scartate: number;
  /** Di quante colonne era spostata l'intestazione (0 = a posto). */
  intestazioniRiallineate: number;
} {
  const righe = testo.split(/\r?\n/).filter((r) => r.trim().length > 0);
  if (!righe.length)
    return { leads: [], colonneConservate: [], colonneIgnorate: [], scartate: 0, intestazioniRiallineate: 0 };
  const sep = separatore(righe[0]);

  //  Tutte le righe di dati, divise una volta sola: servono due volte — per
  //  controllare l'intestazione e per costruire le schede — e dividerle due
  //  volte su un file da ottocento righe si sente.
  const dati = righe.slice(1).map((r) => dividiRiga(r, sep));
  const campione = dati.slice(0, 20);

  /* ── ⚠️ PRIMA SI RIMETTE A POSTO L'INTESTAZIONE, POI SI COSTRUISCE `indice` ─
     Vedi la nota lunga sopra `riallineaIntestazioni`: se le domande in coda
     stanno in realtà in mezzo ai dati, `indice` si deve costruire sulle
     intestazioni già sistemate, altrimenti i campi spostati restano spostati. */
  const riallineate = riallineaIntestazioni(dividiRiga(righe[0], sep), campione);
  const intestGrezze = riallineate.intestazioni;
  const intest = intestGrezze.map(senzaAccenti);

  const indice: Record<string, number> = {};
  intest.forEach((h, i) => {
    const nostro = chiaveDellaColonna(h);
    if (nostro && indice[nostro] === undefined) indice[nostro] = i;
  });

  /* ── ⚠️ L'INTESTAZIONE PROPONE, I DATI DECIDONO ────────────────────────
     Si guardano le prime righe: se sotto la colonna che l'intestazione chiama
     «telefono» non ci sono telefoni, comanda la colonna che ce li ha. Vedi la
     nota lunga sopra `colonnaCheContiene`: questo file esiste davvero, ed è
     il motivo per cui una lista di trenta persone entrava con l'email nel
     campo del telefono. */
  /** ⚠️ NON BASTA CHE QUALCHE VALORE COMBACI: la colonna sbagliata ne ha
   *  sempre uno per caso — «nulla» è una parola e passa per un nome. Si chiede
   *  la MAGGIORANZA delle righe, la stessa soglia di `colonnaCheContiene`, e
   *  solo se l'intestazione non la raggiunge si cerca altrove. */
  /*  ── ⚠️ CI SI PUÒ CREDERE, A QUESTA INTESTAZIONE? ──────────────────────
      Serve a decidere una cosa sola ma delicata: se scrivere la DOMANDA
      accanto a una risposta del questionario che non riconosciamo (vedi
      crm/modulo-lead) e se dare alle colonne conservate il loro nome. Su un
      file con le intestazioni spostate si stamperebbe «in quale zona d'Italia:
      mattina (9:00–12:00)» dentro la scheda di una persona — e una bugia
      stampata si crede.
      Il verdetto si ricava da quello che stiamo già facendo qui sotto: se una
      colonna che l'intestazione dichiarava (telefono, email, nome) NON
      conteneva quel dato, l'intestazione di questo file non descrive le sue
      colonne, e allora non si scrive nessuna domanda. */
  let ancoreDichiarate = 0;
  let ancoreSbagliate = 0;
  const quadra = (k: string, pare: (v: string) => boolean) => {
    const soglia = Math.max(1, Math.ceil((campione.length || 1) / 2));
    const i = indice[k];
    if (i !== undefined) {
      ancoreDichiarate++;
      const centri = campione.filter((r) => pare((r[i] || "").trim())).length;
      if (centri >= soglia) return;
      ancoreSbagliate++;
    }
    const trovata = colonnaCheContiene(campione, pare);
    if (trovata >= 0) indice[k] = trovata;
  };
  quadra("telefono", paTelefono);
  quadra("email", paEmail);
  //  Il nome si ricontrolla solo se non c'è già un nome separato: dove nome e
  //  cognome ci sono davvero, non c'è niente da indovinare.
  if (indice.nome === undefined) quadra("nomeCompleto", paNomeIntero);
  //  Nessuna àncora dichiarata vuol dire un'intestazione che non nomina
  //  nemmeno il telefono: non si è verificato niente, e non si scrive niente.
  const intestazioniAffidabili = riallineate.affidabili && ancoreDichiarate > 0 && ancoreSbagliate === 0;

  /*  ── ⚠️ I NOMI DELLE COLONNE CONSERVATE ───────────────────────────────
      Con le intestazioni affidabili il nome è l'intestazione, letta da una
      persona («is_organic» → «is organic»). Se non lo sono, o se la cella
      d'intestazione è vuota, è «colonna N»: scrivere «full name: alopecia
      androgenetica» sarebbe stampare una bugia. Un nome ripetuto riceve « (2)». */
  //  ⚠️ `reduce` e non `Math.max(...)`: con centomila righe lo spread sfora lo stack.
  const larghezza = dati.reduce((m, r) => Math.max(m, r.length), intestGrezze.length);
  const nomiColonna: string[] = [];
  const visti = new Map<string, number>();
  for (let i = 0; i < larghezza; i++) {
    const letta = intestazioniAffidabili ? intestazioneLeggibile(intestGrezze[i] ?? "") : "";
    const base = letta || `colonna ${i + 1}`;
    const volte = (visti.get(base) ?? 0) + 1;
    visti.set(base, volte);
    nomiColonna.push(volte > 1 ? `${base} (${volte})` : base);
  }
  const presi = new Set(Object.values(indice));
  const conservate = new Set<number>();
  const caricatoIl = new Date().toISOString();

  const leads: LeadData[] = [];
  let scartate = 0;
  for (const c of dati) {
    const v = (k: string) => (indice[k] === undefined ? "" : (c[indice[k]] || "").trim());
    /* ── ⚠️ «Mario Esempio» IN UNA CASELLA SOLA ────────────────────────
       Meta esporta `full_name`. La prima parola è il nome, il resto il
       cognome: su «Gian Maria Esempio» si sbaglia — diventa «Gian» +
       «Maria Esempio» — ed è il taglio meno sbagliato possibile senza un
       elenco di nomi doppi. Quello che conta è che la scheda abbia un nome:
       al telefono si dice quello, e il cognome si corregge in un secondo. */
    let nome = v("nome");
    let cognome = v("cognome");
    if (!nome && !cognome) {
      const intero = v("nomeCompleto").replace(/\s+/g, " ").trim();
      if (intero) {
        const spazio = intero.indexOf(" ");
        nome = spazio > 0 ? intero.slice(0, spazio) : intero;
        cognome = spazio > 0 ? intero.slice(spazio + 1) : "";
      }
    }
    //  ⚠️ `p:` davanti al numero è di Meta, non del cliente: lasciato dentro
    //   rende il numero inservibile — niente chiamata, niente WhatsApp, e la
    //   ricerca per telefono non lo trova più.
    const telefono = v("telefono")
      .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
      .replace(/^p:/i, "")
      .trim();
    if (!nome && !cognome && !telefono) {
      scartate++;
      continue;
    }
    const { stato } = traduciStato(v("stato") || "da_contattare");
    /*  ── ⚠️ LE RISPOSTE DEL MODULO DIVENTANO VOCI, NON NOTE ──────────────
        Richiesta del committente: «in base alle domande dentro al lead, ci
        siano anche queste info, ma non nelle note, ma proprio come voce a sé
        stante — così posso tenere traccia bene».
        Quello che si riconosce (problema, fastidio, già provato, come vive il
        problema, se ci conosce, zona, quando chiamarlo) entra in `modulo`, dove
        si può contare e filtrare. `usate` dice quali colonne ci sono finite:
        tutte le altre si conservano in `datiFile`. Niente va nelle note. */
    const usate = new Set<number>();
    const modulo = leggiRisposte(intestGrezze, c, presi, intestazioniAffidabili, usate);
    const datiFile: Record<string, string> = {};
    for (let i = 0; i < c.length; i++) {
      if (presi.has(i) || usate.has(i)) continue;
      const valore = (c[i] || "").trim();
      if (!valore) continue;
      if (Object.keys(datiFile).length >= MAX_CHIAVI_DATI_FILE) break;
      datiFile[nomiColonna[i]] = valore.slice(0, MAX_CARATTERI_DATI_FILE);
      conservate.add(i);
    }
    const tracking: TrackingInfo = {};
    //  Solo i campi di testo: `source` ha un elenco chiuso di valori e si
    //  scrive più sotto, dove si sa da quale piattaforma arriva.
    type ChiaveTesto =
      | "ad_id"
      | "adset_id"
      | "campaign_id"
      | "ad_name"
      | "campaign_name"
      | "adset_name"
      | "form_name";
    const seCe = (k: ChiaveTesto, valore: string) => {
      if (valore) tracking[k] = valore;
    };
    seCe("ad_id", senzaSigla(v("adId")));
    seCe("adset_id", senzaSigla(v("adsetId")));
    seCe("campaign_id", senzaSigla(v("campaignId")));
    seCe("ad_name", v("adName"));
    seCe("campaign_name", v("campaignName"));
    seCe("adset_name", v("adsetName"));
    seCe("form_name", v("formName"));
    //  `utm_campaign` è il campo che leggono le schermate più vecchie: tenerlo
    //  allineato costa una riga e fa comparire questi lead anche lì.
    if (tracking.campaign_name && !tracking.utm_campaign)
      tracking.utm_campaign = tracking.campaign_name;
    const piattaforma = senzaAccenti(v("fonte"));
    if (Object.keys(tracking).length && /fb|facebook|ig|instagram|meta/.test(piattaforma))
      tracking.source = "meta";
    //  ⚠️ La data d'arrivo è del file solo se la cella è piena e leggibile:
    //   altrimenti `createdAt` è l'ora del caricamento e «arrivato 40 minuti
    //   fa» sarebbe una bugia su una lista vecchia caricata oggi.
    const { createdAt, dataDalFile } = dataDellaCella(v("createdAt"));
    leads.push({
      nome,
      cognome,
      telefono,
      email: v("email") || undefined,
      citta: v("citta") || undefined,
      fonte: traduciFonte(v("fonte")) || "ADV",
      stato,
      modulo,
      tracking: Object.keys(tracking).length ? tracking : undefined,
      piattaformaAds: tracking.source === "meta" ? "meta" : undefined,
      //  Solo la colonna «note» del file: le risposte del modulo non si
      //  riscrivono qui, sono voci. (Il nome del file lo scrive l'anteprima.)
      note: v("note") || undefined,
      datiFile: Object.keys(datiFile).length ? datiFile : undefined,
      listaOrigine: { file: "", il: caricatoIl, dataDalFile },
      createdAt: createdAt || new Date().toISOString(),
      consulenteId: null,
      durataMeeting: 45,
      importato: true,
    } as LeadData);
  }
  const colonneConservate = [...conservate].sort((a, b) => a - b).map((i) => nomiColonna[i]);
  return {
    leads,
    colonneConservate,
    colonneIgnorate: colonneConservate,
    scartate,
    intestazioniRiallineate: riallineate.spostamento,
  };
}

// ── DIVISIONE DEI LEAD FRA I CONSULENTI ─────────────────────────────────────
//  Non "uno a testa a giro": a ogni lead tocca il consulente che in quel
//  momento ha MENO lavoro assegnato, e a pari lavoro quello con priorità più
//  alta. Chi ha già raggiunto il proprio massimo giornaliero viene saltato —
//  assegnare a chi non può richiamare significa perdere il lead due volte.
export interface QuotaConsulente {
  id: string;
  nome: string;
  max: number;
  attivo: boolean;
  priorita: number;
}

export function dividiLead<T extends { id: string }>(
  daAssegnare: T[],
  consulenti: QuotaConsulente[],
  giaAssegnati: Record<string, number> = {},
): { assegnazioni: { leadId: string; consulenteId: string }[]; nonAssegnati: number } {
  const carico: Record<string, number> = {};
  const liberi = consulenti.filter((c) => c.attivo);
  liberi.forEach((c) => {
    carico[c.id] = giaAssegnati[c.id] || 0;
  });

  const assegnazioni: { leadId: string; consulenteId: string }[] = [];
  let nonAssegnati = 0;
  for (const l of daAssegnare) {
    const disponibili = liberi.filter((c) => carico[c.id] < c.max);
    if (!disponibili.length) {
      nonAssegnati++;
      continue;
    }
    disponibili.sort((a, b) => carico[a.id] - carico[b.id] || a.priorita - b.priorita);
    const scelto = disponibili[0];
    carico[scelto.id]++;
    assegnazioni.push({ leadId: l.id, consulenteId: scelto.id });
  }
  return { assegnazioni, nonAssegnati };
}
