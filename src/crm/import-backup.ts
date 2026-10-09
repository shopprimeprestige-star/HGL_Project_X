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
import type { AdSpending, ConsultantData, LeadData, LeadStatus, TrackingInfo } from "./types";
//  Le risposte del modulo si riconoscono in UN punto solo: vedi la nota in
//  testa a crm/modulo-lead.ts (si guarda il valore, non l'intestazione).
import {
  DOMANDE_MODULO,
  leggiRisposte,
  paDomanda,
  paRisposta,
  pulisci,
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
   *  cognome separati: hanno `full_name`, «Michele Ruggiero» in una casella
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
 *   identificativi lunghissimi tutti di cifre (`l:2055445158436359`), e senza
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
 *   «antonio» e «aksi» sono in questo file, e sono persone. */
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

/** Traduce un CSV in schede pronte. Le colonne che non riconosce le ignora,
 *  ma le RIPORTA: così si vede subito se una colonna importante è rimasta
 *  fuori perché scritta in un modo imprevisto. */
export function traduciCsv(testo: string): {
  leads: LeadData[];
  colonneIgnorate: string[];
  scartate: number;
} {
  const righe = testo.split(/\r?\n/).filter((r) => r.trim().length > 0);
  if (!righe.length) return { leads: [], colonneIgnorate: [], scartate: 0 };
  const sep = separatore(righe[0]);
  const intestGrezze = dividiRiga(righe[0], sep);
  const intest = intestGrezze.map(senzaAccenti);

  const indice: Record<string, number> = {};
  const fuoriElenco: number[] = [];
  intest.forEach((h, i) => {
    const nostro = Object.entries(COLONNE).find(([, alias]) =>
      alias.some((a) => senzaAccenti(a) === h),
    );
    if (nostro && indice[nostro[0]] === undefined) indice[nostro[0]] = i;
    else if (!nostro && h) fuoriElenco.push(i);
  });

  //  Tutte le righe di dati, divise una volta sola: servono due volte — per
  //  controllare l'intestazione e per costruire le schede — e dividerle due
  //  volte su un file da ottocento righe si sente.
  const dati = righe.slice(1).map((r) => dividiRiga(r, sep));

  /* ── ⚠️ L'INTESTAZIONE PROPONE, I DATI DECIDONO ────────────────────────
     Si guardano le prime righe: se sotto la colonna che l'intestazione chiama
     «telefono» non ci sono telefoni, comanda la colonna che ce li ha. Vedi la
     nota lunga sopra `colonnaCheContiene`: questo file esiste davvero, ed è
     il motivo per cui una lista di trenta persone entrava con l'email nel
     campo del telefono. */
  const campione = dati.slice(0, 20);
  /** ⚠️ NON BASTA CHE QUALCHE VALORE COMBACI: la colonna sbagliata ne ha
   *  sempre uno per caso — «nulla» è una parola e passa per un nome. Si chiede
   *  la MAGGIORANZA delle righe, la stessa soglia di `colonnaCheContiene`, e
   *  solo se l'intestazione non la raggiunge si cerca altrove. */
  /*  ── ⚠️ CI SI PUÒ CREDERE, A QUESTA INTESTAZIONE? ──────────────────────
      Serve a decidere una cosa sola ma delicata: se scrivere la DOMANDA
      accanto a una risposta del questionario che non riconosciamo (vedi
      crm/modulo-lead). Su un file con le intestazioni spostate di una colonna
      si stamperebbe «in quale zona d'Italia: mattina (9:00–12:00)» dentro la
      scheda di una persona — e una bugia stampata si crede.
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
  const intestazioniAffidabili = ancoreDichiarate > 0 && ancoreSbagliate === 0;

  /*  ── ⚠️ «COLONNA IGNORATA» DEVE VOLER DIRE IGNORATA ───────────────────
      Le domande del modulo non hanno un nome di colonna che possiamo
      prevedere — sono la domanda per esteso, punto interrogativo compreso, e
      cambiano a ogni modulo — quindi non stanno e non possono stare in
      `COLONNE`. Ma ADESSO vengono lette (diventano voci della scheda), e
      continuare a elencarle fra le ignorate direbbe una bugia a chi guarda
      l'anteprima: cercherebbe un guasto che non c'è.
      Si riconoscono come si riconoscono le risposte: guardando i valori nelle
      prime righe, e l'intestazione solo per la domanda che ammette una
      risposta scritta a mano. */
  const colonneDelModulo = new Set(
    fuoriElenco.filter((i) => {
      if (campione.some((r) => riconosciRisposta((r[i] || "").trim()))) return true;
      const testa = pulisci(intestGrezze[i] ?? "");
      if (!!testa && DOMANDE_MODULO.some((d) => d.aMano && d.intestazione.test(testa))) return true;
      //  Una domanda che non conosciamo, con sotto risposte vere: da oggi si
      //  legge anche quella (è «tutte le risposte del questionario»), quindi
      //  non è una colonna ignorata.
      return (
        intestazioniAffidabili &&
        paDomanda(intestGrezze[i] ?? "") &&
        campione.some((r) => paRisposta((r[i] || "").trim()))
      );
    }),
  );
  const ignorate = fuoriElenco.filter((i) => !colonneDelModulo.has(i)).map((i) => intestGrezze[i]);

  const leads: LeadData[] = [];
  let scartate = 0;
  for (const c of dati) {
    const v = (k: string) => (indice[k] === undefined ? "" : (c[indice[k]] || "").trim());
    /* ── ⚠️ «Michele Ruggiero» IN UNA CASELLA SOLA ────────────────────────
       Meta esporta `full_name`. La prima parola è il nome, il resto il
       cognome: su «Giovanni Battista Zito» si sbaglia — diventa «Giovanni» +
       «Battista Zito» — ed è il taglio meno sbagliato possibile senza un
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
        Quello che si riconosce (come vive il problema, se ci conosce, zona,
        quando chiamarlo) entra in `modulo`, dove si può contare e filtrare.
        Quello che NON si riconosce continua a finire nelle note come prima:
        buttarlo sarebbe peggio, e inventargli una voce anche. */
    const modulo = leggiRisposte(
      intestGrezze,
      c,
      new Set(Object.values(indice)),
      intestazioniAffidabili,
    );
    //  ⚠️ Confronto RIPULITO da entrambe le parti: nel file la risposta è
    //   «abbastanza», nella scheda diventa «Abbastanza», e senza questo la
    //   stessa risposta finirebbe due volte — una come voce e una nelle note.
    const dettoDalModulo = new Set((modulo?.risposte ?? []).map((r) => pulisci(r.risposta)));
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
      note: v("note") || rispostePerNota(c, indice, dettoDalModulo) || undefined,
      createdAt: v("createdAt") || new Date().toISOString(),
      consulenteId: null,
      durataMeeting: 45,
      importato: true,
    } as LeadData);
  }
  return { leads, colonneIgnorate: [...new Set(ignorate)], scartate };
}

/** ── LE RISPOSTE DEL MODULO, DENTRO LE NOTE ────────────────────────────────
 *  Una lista Meta porta anche le risposte alle domande del modulo — «alopecia
 *  androgenetica», «abbastanza», «nulla» — e sono la cosa più utile che ci sia
 *  per chi poi telefona: sa già con chi sta parlando prima di dire pronto.
 *  Finivano buttate, perché non corrispondono a nessuna nostra colonna.
 *
 *  ⚠️ SENZA L'ETICHETTA DELLA DOMANDA, ed è una scelta: su questo file
 *   l'intestazione è spostata di una colonna (vedi sopra), quindi scrivere
 *   «quanto ti infastidisce: alopecia androgenetica» vorrebbe dire stampare
 *   una bugia dentro la scheda. I valori invece sono giusti comunque. Tre
 *   parole in fila si leggono in un secondo; una domanda sbagliata si legge e
 *   si crede.
 *  ⚠️ E SOLO QUELLE CHE SEMBRANO RISPOSTE: identificativi (`l:`, `ag:`),
 *   date, `true`/`false` e i nomi di campagne e moduli non dicono niente a chi
 *   chiama e riempirebbero la scheda di rumore. */
function rispostePerNota(
  riga: string[],
  indice: Record<string, number>,
  /*  ⚠️ Quello che è già diventato una VOCE della scheda non si ripete qui:
      la stessa risposta scritta in due posti diventa, il giorno in cui una
      delle due si corregge, due risposte diverse — e non si sa più quale
      valga. */
  giaVoci: Set<string> = new Set(),
): string {
  const presi = new Set(Object.values(indice));
  const fuori: string[] = [];
  riga.forEach((valore, i) => {
    if (presi.has(i)) return;
    const t = (valore || "").trim();
    if (riconosciRisposta(t) || giaVoci.has(pulisci(t))) return;
    if (!t || t.length > 60) return;
    if (/^\w{1,3}:/.test(t)) return; // l: ag: as: c: f: p:
    if (/^(true|false)$/i.test(t)) return;
    if (/\d{4}-\d{2}-\d{2}/.test(t)) return;
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t)) return; // «Modulo senza titolo 30/11/24»
    if (/^\d+$/.test(t)) return;
    if (/[|€]/.test(t)) return; // nomi di campagne e inserzioni
    fuori.push(t.replace(/_/g, " ").trim());
  });
  return fuori.length ? `Dal modulo: ${fuori.join(" · ")}` : "";
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
