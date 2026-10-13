/** ── CHI SI CHIAMA PER PRIMO, E PERCHÉ ─────────────────────────────────────
 *
 *  Richiesta del titolare: la setter apre «Lead importati» e capisce subito chi
 *  chiamare e per quale motivo. Una lista sola, ordinata per MOTIVO, con la
 *  targhetta del perché su ogni riga.
 *
 *  DA DOVE ARRIVA: la regola «chi è in coda» e l'ordine stavano dentro la
 *  pagina (`eDaChiamare`, `ordinaCoda`, `patchEsito` in CRM.importa.tsx), senza
 *  prove. Qui sono moduli puri: stessi lead, stessa ora, stesso risultato. La
 *  pagina li usa e non decide niente.
 *
 *  ── L'ORDINE (deciso dal titolare, 12/10) ─────────────────────────────────
 *   1. PROMESSA     un richiamo che abbiamo promesso, e il giorno è arrivato
 *   2. DI RITORNO   è ricomparso in una lista e aspetta una decisione
 *   3. NUOVO        è arrivato dal file meno di 24 ore fa e nessuno l'ha chiamato
 *   4. È LA SUA ORA ha chiesto di essere chiamato in questa fascia
 *   5. PRIMA CHIAMATA   mai chiamato (prima i «caldi»)
 *   6. RITENTO      non ha risposto
 *
 *  ⚠️ PROMESSA SOLO CON UN GIORNO LEGGIBILE, E ARRIVATO. Negli archivi importati
 *   le date illeggibili sono centinaia: se un «richiamo» senza giorno contasse
 *   come promessa finirebbero tutti in cima, sopra i ritorni e i nuovi. Senza
 *   giorno si ordina per stato (ritento) e lo dice il testo. Una promessa per un
 *   giorno futuro non è in lista: la regola è di `da-telefonare` e non cambia.
 *  ⚠️ «MI RICHIAMA LUI» NON È UN RICHIAMO NOSTRO. La telefonata la fa lui: il
 *   testo dice «doveva farsi vivo lui», mai «richiamo» (stesso avviso di
 *   `prossimaAzione`, in crm/ui).
 *  ⚠️ «NUOVO» SOLO SE LA DATA VIENE DAL FILE (`listaOrigine.dataDalFile`).
 *   Senza una colonna data `createdAt` è l'ora del caricamento: una lista
 *   vecchia caricata a mano sarebbe tutta «arrivata 40 minuti fa» e starebbe
 *   per 24 ore sopra le prime chiamate calde.
 *  ⚠️ «È LA SUA ORA» VALE ANCHE PER I RITENTO: chi ha chiesto «pranzo» e non ha
 *   risposto alle 9 si richiama a pranzo, non a caso. Sta sopra le prime
 *   chiamate (così ha deciso il titolare). L'orario scritto a mano
 *   (`quandoTesto`) non conta mai: non è una fascia, è una frase.
 *  ⚠️ IL NUMERO DEL VERDETTO È QUI (`contaPromesse`) E NON NELLA TESTATA: conta
 *   le righe che mostra lo Stato «Promesse», non le note del setter né i saltati.
 *   Se i due numeri venissero da posti diversi, il primo clic smentirebbe la
 *   frase in cima.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  LEAD_STATUS_LABEL,
  type Lead,
  type LeadData,
  type LeadStatus,
  type MotivoChiamata,
  type RisposteModulo,
} from "@/crm/types";
import { etichettaRisposta } from "@/crm/modulo-lead";
import { daTelefonareOggi, giornoPromesso, promessaPerDopo } from "./da-telefonare";
import { eContattatoWhatsApp, eDaDecidere, eRimandato } from "./ricarico";
import { eSaltato } from "./saltati";

export type LeadLike = { id: string; data?: Partial<LeadData> | null };

export interface OpzioniChiamata {
  /** I lead appena riportati a galla da un file, in questa schermata. */
  idRitorno?: ReadonlySet<string>;
  /** Come si leggono le risposte del modulo. Il ripiego è `d.modulo`; la pagina
   *  passa `moduloLetto`, che recupera anche le risposte scritte nelle note. */
  moduloDi?: (d: Partial<LeadData>) => RisposteModulo | undefined;
}

export const NOME_MOTIVO: Record<MotivoChiamata, string> = {
  promessa: "PROMESSA",
  ritorno: "DI RITORNO",
  nuovo: "NUOVO",
  suaOra: "È LA SUA ORA",
  prima: "PRIMA CHIAMATA",
  ritento: "RITENTO",
};

const RANGO: Record<MotivoChiamata, number> = {
  promessa: 0,
  ritorno: 1,
  nuovo: 2,
  suaOra: 3,
  prima: 4,
  ritento: 5,
};

const ORA_MS = 3_600_000;
const GIORNO_MS = 24 * ORA_MS;
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

/* ═══════════════════════════════════════════════════════════════════════════
   CHI È IN LISTA
   ═════════════════════════════════════════════════════════════════════════ */

/** È di ritorno? Due modi, e solo uno dura (vedi la pagina): `eDaDecidere` sta
 *  sulla scheda in archivio; `idRitorno` è il file appena letto in questa
 *  schermata. Chi è in «Vedi dopo» o già scritto su WhatsApp non rientra dal
 *  secondo: premere «Vedi dopo» e ritrovarselo davanti sarebbe un tasto muto. */
function eDiRitorno(l: LeadLike, o?: OpzioniChiamata): boolean {
  if (eDaDecidere(l)) return true;
  return !!o?.idRitorno?.has(l.id) && !eRimandato(l) && !eContattatoWhatsApp(l);
}

/** La regola di oggi, spostata fuori dalla pagina senza cambiarla: non è
 *  saltato, non ha una promessa per un giorno che deve ancora arrivare, ed è
 *  di ritorno oppure è importato con la prima chiamata ancora aperta. */
export function inLista(l: LeadLike, adesso: Date, o?: OpzioniChiamata): boolean {
  const d = l?.data;
  if (!d || eSaltato(l as Lead)) return false;
  if (promessaPerDopo(d, adesso)) return false;
  if (eDiRitorno(l, o)) return true;
  return !!d.importato && daTelefonareOggi(d, adesso);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CALDO E FASCIA
   ═════════════════════════════════════════════════════════════════════════ */

/** Lead «caldo» (decisione del titolare): molto o abbastanza infastidito, OPPURE
 *  vuole risolvere ora o sta valutando, OPPURE ha già provato qualcosa. */
export function eCaldo(m?: RisposteModulo): boolean {
  if (!m) return false;
  return (
    m.fastidio === "molto" ||
    m.fastidio === "abbastanza" ||
    m.urgenza === "subito" ||
    m.urgenza === "valutando" ||
    //  ⚠️ «Ha già provato QUALCOSA»: ogni risposta tranne «niente». Così
    //   tricologia e tricopigmentazione (aggiunte dopo la misura sui lead
    //   veri) scaldano come trapianto, lozioni e farmaci, e una risposta
    //   nuova del modulo non resta fredda per una riga dimenticata.
    (!!m.giaFatto && m.giaFatto !== "niente")
  );
}

/** Perché è caldo, in poche parole: il primo motivo vero. */
function perchéCaldo(m: RisposteModulo): string {
  if (m.fastidio === "molto" || m.fastidio === "abbastanza") return `fastidio ${m.fastidio}`;
  if (m.urgenza === "subito") return "vuole risolvere ora";
  if (m.urgenza === "valutando") return "sta valutando";
  return `ha già provato: ${m.giaFatto}`;
}

/** Fasce in ore intere: l'inizio è compreso, la fine è esclusa. */
const FASCE: Record<string, [number, number]> = {
  mattina: [9, 12],
  pranzo: [12, 14],
  pomeriggio: [14, 18],
  sera: [18, 21],
};

export function eLaSuaOra(m: RisposteModulo | undefined, adesso: Date): boolean {
  const f = FASCE[String(m?.quando ?? "")];
  if (!f) return false;
  const ora = adesso.getHours();
  return ora >= f[0] && ora < f[1];
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL MOTIVO
   ═════════════════════════════════════════════════════════════════════════ */

const GIORNO_LEGGIBILE = /^\d{4}-\d{2}-\d{2}$/;

/** Il giorno `AAAA-MM-GG` di una data scritta in uno dei modi della scheda.
 *  Vuoto = illeggibile (e «non si sa» non è «oggi»).
 *  ⚠️ LA FORMA NON BASTA. Un vecchio gestionale scrive la data «zero»
 *   (`0000-00-00`, `2026-10-00`) e `2026-02-30` ha la forma giusta, ma nessuna è
 *   un giorno: passavano per «leggibili» e finivano in cima come PROMESSA
 *   «scaduta da 739.000 giorni», contata anche nel verdetto. Il giorno deve
 *   esistere davvero (si rifà il giro: il 30 febbraio per JavaScript è il 2
 *   marzo) e cadere da quando esiste il CRM (dal 2000). */
function giornoDi(v: unknown): string {
  const g = String(v ?? "").slice(0, 10);
  if (!GIORNO_LEGGIBILE.test(g)) return "";
  const [a, m, gg] = g.split("-").map(Number);
  if (a < 2000) return "";
  const d = new Date(a, m - 1, gg);
  return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === gg ? g : "";
}

/** Il giorno promesso: `giornoPromesso` e, se manca, il giorno di `callbackAt`,
 *  come fa `prossimaAzione` (crm/ui). Solo per i due stati con una promessa. */
function giornoDellaPromessa(d: Partial<LeadData>): string {
  if (d.stato !== "richiamo" && d.stato !== "ci_ricontatta_lui") return "";
  //  ⚠️ `giornoPromesso` guarda solo la forma: il giorno si ricontrolla qui.
  return giornoDi(giornoPromesso(d)) || giornoDi(d.callbackAt);
}

/** Il momento in cui la promessa è dovuta. Senza ora vale «inizio del giorno».
 *  ⚠️ L'ORA VALE SOLO PER UN «RICHIAMO» CON IL SUO GIORNO IN `dataRicontatto`.
 *   «Mi richiama lui» non ha un'ora nostra da rispettare (il testo dice
 *   «doveva farsi vivo lui oggi», e con un'ora salvata risultava «scaduta» alle
 *   dieci mentre la frase diceva «oggi»); e un giorno preso da `callbackAt` non
 *   è quello a cui l'ora si riferiva. */
function momentoDovuto(d: Partial<LeadData>, giorno: string): { quando: number; conOra: boolean } {
  const valeLOra = d.stato === "richiamo" && giornoDi(d.dataRicontatto) === giorno;
  const ora = valeLOra ? /^(\d{1,2}):(\d{2})/.exec(String(d.oraRicontatto ?? "")) : null;
  const [a, m, g] = giorno.split("-").map(Number);
  if (ora && Number(ora[1]) < 24 && Number(ora[2]) < 60) {
    return {
      quando: new Date(a, m - 1, g, Number(ora[1]), Number(ora[2])).getTime(),
      conOra: true,
    };
  }
  return { quando: new Date(a, m - 1, g).getTime(), conOra: false };
}

function inizioGiorno(adesso: Date): number {
  return new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate()).getTime();
}

const gg_mm = (giorno: string) => giorno.split("-").reverse().slice(0, 2).join("/");

function giornoScritto(giorno: string): string {
  const [a, m, g] = giorno.split("-").map(Number);
  return `${GIORNI[new Date(a, m - 1, g).getDay()]} ${gg_mm(giorno)}`;
}

/** «scaduto da 1 h» / «da 2 giorni». Con l'ora conta le ore, senza i giorni. */
function scadutoDa(m: { quando: number; conOra: boolean }, adesso: Date): string {
  if (m.conOra) {
    const ms = adesso.getTime() - m.quando;
    if (ms < ORA_MS) return `scaduto da ${Math.max(1, Math.floor(ms / 60_000))} min`;
    if (ms < GIORNO_MS) return `scaduto da ${Math.floor(ms / ORA_MS)} h`;
    const g = Math.floor(ms / GIORNO_MS);
    return `scaduto da ${g} ${g === 1 ? "giorno" : "giorni"}`;
  }
  const g = Math.round((inizioGiorno(adesso) - m.quando) / GIORNO_MS);
  return `scaduto da ${g} ${g === 1 ? "giorno" : "giorni"}`;
}

function testoPromessa(d: Partial<LeadData>, giorno: string, adesso: Date): string {
  const m = momentoDovuto(d, giorno);
  const passata = giorno < ymd(adesso);
  const oggi = giorno === ymd(adesso);
  if (d.stato === "ci_ricontatta_lui") {
    if (oggi) return "doveva farsi vivo lui oggi";
    return `doveva farsi vivo lui entro ${giornoScritto(giorno)}, ${scadutoDa({ ...m, conOra: false }, adesso)}`;
  }
  if (m.conOra) {
    const hhmm = String(d.oraRicontatto).slice(0, 5).padStart(5, "0");
    if (oggi)
      return m.quando <= adesso.getTime()
        ? `richiamo alle ${hhmm}, ${scadutoDa(m, adesso)}`
        : `richiamo alle ${hhmm}`;
    return `richiamo di ${giornoScritto(giorno)} alle ${hhmm}, ${scadutoDa(m, adesso)}`;
  }
  if (passata) return `richiamo di ${giornoScritto(giorno)}, ${scadutoDa(m, adesso)}`;
  return "richiamo di oggi";
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function tentativiDi(d: Partial<LeadData>): number {
  return Math.max(0, Number(d.noRispondeCount) || 0);
}

/** `createdAt` in millisecondi; `NaN` se vuoto o illeggibile. */
function arrivatoIl(d: Partial<LeadData>): number {
  const s = String(d.createdAt ?? "").trim();
  return s ? Date.parse(s) : Number.NaN;
}

/** La data del file non aveva l'ora: l'importazione ha messo mezzogiorno locale
 *  (data all'italiana) o mezzanotte UTC (ISO senza `T`). Nessuna ora vera cade
 *  al millisecondo su uno di questi due momenti: quindi l'ora è nostra. */
function senzaOraVera(t: number): boolean {
  const q = new Date(t);
  const mezzogiornoLocale =
    q.getHours() === 12 && q.getMinutes() === 0 && q.getSeconds() === 0 && q.getMilliseconds() === 0;
  const mezzanotteUtc =
    q.getUTCHours() === 0 && q.getUTCMinutes() === 0 && q.getUTCSeconds() === 0 && q.getUTCMilliseconds() === 0;
  return mezzogiornoLocale || mezzanotteUtc;
}

/** «arrivato 3 ore fa» solo se l'ora è vera; senza, si dice il giorno. */
function etàLeggibile(ms: number, adesso: Date, arrivo: number): string {
  if (senzaOraVera(arrivo)) {
    //  ⚠️ Un ISO senza ora («2026-10-12») è mezzanotte UTC: il suo giorno è
    //   quello scritto, non quello del fuso di chi guarda. Letto nel fuso
    //   locale, a ovest di Greenwich diventava il giorno prima («ieri»).
    const q = new Date(arrivo);
    const mezzogiornoLocale = q.getHours() === 12 && q.getMinutes() === 0;
    const giorno = mezzogiornoLocale ? ymd(q) : q.toISOString().slice(0, 10);
    return giorno === ymd(adesso) ? "arrivato oggi" : "arrivato ieri";
  }
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 1) return "arrivato adesso";
  if (min < 60) return `arrivato ${min} ${min === 1 ? "minuto" : "minuti"} fa`;
  const h = Math.floor(min / 60);
  return `arrivato ${h} ${h === 1 ? "ora" : "ore"} fa`;
}

const SCARTO_OROLOGI_MS = 5 * 60_000;

function eNuovo(d: Partial<LeadData>, adesso: Date): boolean {
  if (d.stato !== "da_contattare" || tentativiDi(d) > 0) return false;
  if (d.listaOrigine?.dataDalFile !== true) return false;
  const t = arrivatoIl(d);
  if (Number.isNaN(t)) return false;
  const età = adesso.getTime() - t;
  return età >= -SCARTO_OROLOGI_MS && età < GIORNO_MS;
}

export interface MotivoDiChiamata {
  motivo: MotivoChiamata;
  testo: string;
  caldo: boolean;
}

/** Il primo motivo vero, nell'ordine deciso dal titolare. */
export function motivoChiamata(l: LeadLike, adesso: Date, o?: OpzioniChiamata): MotivoDiChiamata {
  const d = l.data ?? {};
  const leggi = o?.moduloDi ?? ((x: Partial<LeadData>) => x.modulo);
  const modulo = leggi(d);
  const caldo = eCaldo(modulo);
  const fatto = (motivo: MotivoChiamata, testo: string): MotivoDiChiamata => ({
    motivo,
    testo,
    caldo,
  });

  //  1. PROMESSA — solo con un giorno leggibile, già arrivato.
  const giorno = giornoDellaPromessa(d);
  if (giorno && giorno <= ymd(adesso)) return fatto("promessa", testoPromessa(d, giorno, adesso));

  //  2. DI RITORNO
  if (eDiRitorno(l, o)) {
    const stato = d.stato ? (LEAD_STATUS_LABEL[d.stato as LeadStatus] ?? String(d.stato)) : "";
    return fatto("ritorno", stato ? `era «${stato}»` : "è tornato in una lista");
  }

  //  3. NUOVO
  if (eNuovo(d, adesso)) return fatto("nuovo", etàLeggibile(adesso.getTime() - arrivatoIl(d), adesso, arrivatoIl(d)));

  //  4. È LA SUA ORA — per i mai chiamati e per i ritento.
  const mai = d.stato === "da_contattare" && tentativiDi(d) === 0;
  const ritento =
    d.stato === "non_risponde" || d.stato === "segreteria" || d.stato === "da_contattare";
  if ((mai || ritento) && modulo && eLaSuaOra(modulo, adesso)) {
    return fatto("suaOra", `ha chiesto: ${etichettaRisposta("quando", String(modulo.quando))}`);
  }

  //  5. PRIMA CHIAMATA
  if (mai) return fatto("prima", caldo && modulo ? perchéCaldo(modulo) : "mai chiamato");

  //  6. RITENTO
  if (d.stato === "richiamo" || d.stato === "ci_ricontatta_lui") {
    const quando = giornoDellaPromessa(d);
    if (quando) return fatto("ritento", `richiamo previsto il ${gg_mm(quando)}`);
    return fatto(
      "ritento",
      d.stato === "richiamo" ? "richiamo senza giorno" : "doveva farsi vivo lui, senza giorno",
    );
  }
  if (d.stato === "non_risponde" || d.stato === "segreteria" || d.stato === "da_contattare") {
    return fatto("ritento", `${Math.max(1, tentativiDi(d)) + 1}° tentativo`);
  }
  const stato = d.stato ? (LEAD_STATUS_LABEL[d.stato as LeadStatus] ?? String(d.stato)) : "";
  return fatto("ritento", stato ? `stato «${stato}»` : "da richiamare");
}

/* ═══════════════════════════════════════════════════════════════════════════
   L'ORDINE
   ═════════════════════════════════════════════════════════════════════════ */

/** Ordina e basta: non toglie nessuno. Le chiavi, in quest'ordine:
 *   1. il rango del motivo;
 *   2. fra le promesse, il momento dovuto (prima la più vecchia);
 *   3. fra le prime chiamate, prima i caldi;
 *   4. meno tentativi (chi non ha mai squillato rende di più);
 *   5. da più tempo in lista. Una data illeggibile va in fondo, senza `NaN` nel
 *      confronto: un confronto con `NaN` non è né minore né maggiore e
 *      scombina l'ordinamento intero. */
export function ordinaChiamate<L extends LeadLike>(
  leads: L[],
  adesso: Date,
  o?: OpzioniChiamata,
): L[] {
  const righe = leads.map((l) => {
    const d = l.data ?? {};
    const m = motivoChiamata(l, adesso, o);
    const giorno = giornoDellaPromessa(d);
    const arrivo = arrivatoIl(d);
    return {
      l,
      rango: RANGO[m.motivo],
      dovuto: m.motivo === "promessa" && giorno ? momentoDovuto(d, giorno).quando : 0,
      freddo: m.motivo === "prima" && m.caldo ? 0 : 1,
      tentativi: tentativiDi(d),
      arrivo: Number.isNaN(arrivo) ? Number.POSITIVE_INFINITY : arrivo,
    };
  });
  const cmp = (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1);
  return righe
    .sort(
      (a, b) =>
        a.rango - b.rango ||
        cmp(a.dovuto, b.dovuto) ||
        a.freddo - b.freddo ||
        a.tentativi - b.tentativi ||
        cmp(a.arrivo, b.arrivo),
    )
    .map((x) => x.l);
}

/** Chi è in lista, già in ordine. */
export function listaDaChiamare<L extends LeadLike>(
  leads: L[],
  adesso: Date,
  o?: OpzioniChiamata,
): L[] {
  return ordinaChiamate(
    leads.filter((l) => inLista(l, adesso, o)),
    adesso,
    o,
  );
}

/** Le promesse della lista, per il verdetto in testata. `tutte` sono esattamente
 *  le righe che mostra lo Stato «Promesse»; `scadute` quelle il cui momento è
 *  già passato (con l'ora, se c'è; senza ora, se il giorno è prima di oggi). */
export function contaPromesse<L extends LeadLike>(
  leads: L[],
  adesso: Date,
  o?: OpzioniChiamata,
): { tutte: number; scadute: number } {
  let tutte = 0;
  let scadute = 0;
  for (const l of listaDaChiamare(leads, adesso, o)) {
    if (motivoChiamata(l, adesso, o).motivo !== "promessa") continue;
    tutte++;
    const d = l.data ?? {};
    const m = momentoDovuto(d, giornoDellaPromessa(d));
    if (m.conOra ? m.quando < adesso.getTime() : m.quando < inizioGiorno(adesso)) scadute++;
  }
  return { tutte, scadute };
}

/** La frase del verdetto in testata, dal conto di `contaPromesse`. Vuota =
 *  nessuna promessa (la testata dice «sei in pari»). Sta qui e non nella
 *  testata perché il numero e la frase non si possano separare: il clic porta
 *  allo Stato «Promesse», che mostra esattamente `tutte` righe. */
export function fraseVerdetto(c: { tutte: number; scadute: number }): string {
  const tutte = Number.isFinite(c.tutte) ? Math.max(0, Math.floor(c.tutte)) : 0;
  const scadute = Number.isFinite(c.scadute)
    ? Math.max(0, Math.min(tutte, Math.floor(c.scadute)))
    : 0;
  if (tutte === 0) return "";
  const promesse = tutte === 1 ? "1 promessa da mantenere" : `${tutte} promesse da mantenere`;
  if (scadute === 0)
    return tutte === 1 ? `${promesse}, non ancora scaduta` : `${promesse}, nessuna scaduta`;
  if (tutte === 1) return `${promesse}, scaduta: è in cima`;
  return `${promesse}, di cui ${scadute} scadut${scadute === 1 ? "a" : "e"}: sono in cima`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   L'ESITO CHE SI SCRIVE
   ═════════════════════════════════════════════════════════════════════════ */

/** Non è soltanto `{ stato }`: «non risponde» e «segreteria» fanno anche +1 al
 *  contatore dei tentativi, che è una chiave dell'ordine (chi non ha mai
 *  squillato viene prima di chi ha già rifiutato tre volte di rispondere).
 *  ⚠️ La regola sta qui e non dentro `segna` perché gli esiti si danno da due
 *   porte: una scheda per volta e a gruppi. Un contatore che vale solo se si
 *   passa dalla porta giusta è peggio di nessun contatore, perché l'ordine
 *   sembra comunque motivato. Spostata dalla pagina, identica a prima. */
export function patchEsito(
  d: Partial<LeadData> | null | undefined,
  stato: LeadStatus,
): Partial<LeadData> {
  const patch: Partial<LeadData> = { stato };
  if (stato === "non_risponde" || stato === "segreteria") {
    patch.noRispondeCount = (Number(d?.noRispondeCount) || 0) + 1;
  }
  return patch;
}

/** ── LA PERSONA IN CIMA RESTA FERMA ───────────────────────────────────────
 *  Revisione finale: la lista si riordina da sola ogni minuto — «È la sua
 *  ora» scatta alle 9, 12, 14, 18 e 21, «Nuovo» scade dopo 24 ore, e un lead
 *  caricato su un altro dispositivo arriva entro un minuto. Se in quel momento
 *  la scheda grande passava a un'altra persona, il «1» premuto dalla setter
 *  mentre parlava con la prima finiva sulla seconda.
 *  ⚠️ Chi è mostrato resta in cima finché la setter non fa un gesto (esito,
 *   salto, «Vedi dopo», una scelta, un cambio di filtri): sono quei gesti a
 *   azzerare `fermo`. Si riordina solo la lista sotto.
 *  ⚠️ Se chi era fermo esce dalla lista (lavorato su un altro dispositivo) la
 *   cima passa al primo della lista: non c'è più nessuno da tenere fermo. */
export function tieniInTesta<T extends { id: string }>(righe: T[], fermo: string | null): T[] {
  if (!fermo) return righe;
  const i = righe.findIndex((r) => r.id === fermo);
  return i > 0 ? [righe[i], ...righe.slice(0, i), ...righe.slice(i + 1)] : righe;
}
