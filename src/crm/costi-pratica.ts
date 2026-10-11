/** ── I COSTI DI UNA PRATICA — UN POSTO SOLO IN CUI SI SOMMANO ──────────────
 *
 *  Quanto ci è costato servire QUESTO cliente. Tre voci ce le ha ogni pratica —
 *  l'impianto, chi lo installa, chi taglia — e stanno in tre campi loro perché
 *  è su quei tre che il CRM fa i conti da sempre. Tutto il resto è un elenco
 *  scritto a mano (`payment.costi.altri`), perché non esiste una lista chiusa
 *  che copra quello che succede davvero.
 *
 *  ⚠️ QUESTO FILE ESISTE PER NON AVERE DUE SOMME. I costi di una pratica erano
 *   sommati in tre posti — kpi-calcoli, kpi-netto e la scheda del lead — e ogni
 *   volta che se ne aggiungeva uno bisognava ricordarsi di tutti e tre. Il
 *   costo della trasferta è la prova che non funziona: è stato scritto per mesi
 *   e sommato in uno solo dei tre, con la benzina pagata davvero e il margine
 *   che faceva finta di no (la nota è ancora in types.ts).
 *   Da qui in poi la somma si chiede a `totaleCostiPratica`, e chi aggiunge una
 *   voce nuova la aggiunge una volta sola.
 *
 *  ⚠️ LETTURE PRUDENTI: le schede arrivano da un archivio importato, dove un
 *   importo può essere una stringa, `null`, o un elenco può non essere un
 *   elenco. Un accesso dato per scontato qui non produce un numero sbagliato:
 *   spegne la pagina che lo chiama.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Lead, LeadData, VoceCosto } from "./types";

/** Le tre voci che ogni pratica ha, con il nome che usa chi le paga.
 *  ⚠️ Il nome a schermo e il campo in archivio sono due cose diverse e devono
 *   restare tali: «Parrucchiere» si chiamava «Taglio», e rinominare il campo
 *   avrebbe azzerato il costo su ogni scheda già compilata. */
export const VOCI_FISSE = [
  { chiave: "costoProdotto", titolo: "Impianto", su: "sempre" },
  { chiave: "costoInstallatore", titolo: "Installatore", su: "posa" },
  { chiave: "costoTaglio", titolo: "Parrucchiere", su: "posa" },
  //  ⚠️ Solo sui pacchi, e al posto degli altri due: su una spedizione un
  //   installatore non esiste, e un campo che chiede un costo che non può
  //   esistere si riempie a caso. Il perché per esteso sta in
  //   `applyAutoStatus` (crm/types), che è anche il posto che li azzera.
  { chiave: "costoSpedizione", titolo: "Spedizione", su: "pacco" },
] as const;

/** Le voci che hanno senso su questa pratica. ⚠️ Si decide dal MODO DI
 *  CONSEGNA e non dallo stato: sono due campi diversi, e lo stato può dire
 *  «venduto» mentre la consegna dice «pacco». */
export function vociFissePer(daSpedire: boolean) {
  return VOCI_FISSE.filter((v) => v.su === "sempre" || v.su === (daSpedire ? "pacco" : "posa"));
}

export type ChiaveCostoFisso = (typeof VOCI_FISSE)[number]["chiave"];

const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Le voci scritte a mano su questa pratica, sempre come elenco leggibile. */
export function altriCosti(d?: Pick<LeadData, "payment"> | null): VoceCosto[] {
  const v = d?.payment?.costi?.altri;
  if (!Array.isArray(v)) return [];
  return v
    .filter((r): r is VoceCosto => !!r && typeof r === "object")
    .map((r) => ({
      id: String(r.id ?? ""),
      titolo: String(r.titolo ?? "").trim(),
      importo: numero(r.importo),
    }))
    .filter((r) => r.id);
}

export function totaleAltriCosti(d?: Pick<LeadData, "payment"> | null): number {
  return altriCosti(d).reduce((s, r) => s + r.importo, 0);
}

/** ── LA SOMMA, UNA VOLTA SOLA ─────────────────────────────────────────────
 *  Le tre voci fisse, il viaggio della posa a domicilio e tutto quello che è
 *  stato scritto a mano. È questo il numero che il margine sottrae. */
export function totaleCostiPratica(d?: Pick<LeadData, "payment"> | null): number {
  const c = d?.payment?.costi;
  return (
    numero(c?.costoProdotto) +
    numero(c?.costoInstallatore) +
    numero(c?.costoTaglio) +
    //  Benzina, pedaggi e ore di strada delle pose a domicilio: lo scrive
    //  salvaCostoViaggio() in crm/spedizione.ts ed è un'uscita come le altre.
    //  Il corriere: gemello del viaggio, sulle pratiche che si spediscono.
    numero(c?.costoSpedizione) +
    numero(c?.costoTrasferta) +
    totaleAltriCosti(d)
  );
}

/** Comodità per chi ha in mano la scheda intera invece dei soli dati. */
export const costiDelLead = (l?: Lead | null): number => totaleCostiPratica(l?.data);

/** Un id per una voce nuova. Non serve che sia universale: deve solo non
 *  ripetersi dentro la stessa scheda, e reggere due «+» premuti di fila. */
export function nuovoIdVoce(): string {
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** ── LE VOCI DI COSTO DI UNA PRATICA, UNA PER UNA ─────────────────────────
 *  La somma la fa `totaleCostiPratica`; questo elenco serve a chi deve
 *  guardarle una per una — la contabilità, che di ogni voce deve sapere il
 *  TITOLO per decidere se è scaricabile.
 *  ⚠️ I titoli sono quelli che legge una persona («Parrucchiere»), non i nomi
 *   dei campi in archivio («costoTaglio»): è su quelli che il titolare mette la
 *   spunta, e due vocabolari diversi vorrebbero dire una spunta messa su una
 *   voce e un costo che continua a passare sotto un altro nome. */
export function vociCostoDi(l?: Lead | null): VoceCosto[] {
  const c = l?.data?.payment?.costi;
  const fuori: VoceCosto[] = [];
  for (const v of VOCI_FISSE) {
    const n = numero(c?.[v.chiave]);
    if (n > 0) fuori.push({ id: `${l?.id ?? ""}:${v.chiave}`, titolo: v.titolo, importo: n });
  }
  const viaggio = numero(c?.costoTrasferta);
  if (viaggio > 0)
    fuori.push({ id: `${l?.id ?? ""}:viaggio`, titolo: "Viaggio", importo: viaggio });
  for (const r of altriCosti(l?.data)) {
    fuori.push({ ...r, id: `${l?.id ?? ""}:${r.id}` });
  }
  return fuori;
}


/** ── IL DENARO DI UNA PRATICA ───────────────────────────────────────────────
 *  Queste tre stavano in `InstallationScheduleDialog.tsx`, in mezzo a mezza
 *  interfaccia. Sono venute qui perché sono REGOLE DI DENARO, e le regole di
 *  denaro vanno messe alla prova: da lì non si potevano, perché per caricarle
 *  bisognava tirarsi dietro React e tutta la finestra.
 *  Quel file continua a esportarle, così nessuno deve cambiare import.
 */

/** Il prezzo concordato. Il «finale» vince sul «totale»: è quello che resta
 *  dopo lo sconto, ed è la cifra che il cliente ha in mente. */
export function prezzoVendita(l: { data?: { payment?: { prezzoFinaleVendita?: unknown; prezzoTotale?: unknown } } }): number {
  return Number(l?.data?.payment?.prezzoFinaleVendita) || Number(l?.data?.payment?.prezzoTotale) || 0;
}

/** Quanto è già in cassa. Nelle installazioni non si chiama «acconto»: è
 *  semplicemente la parte già incassata. */
export function giaIncassato(l: { data?: { payment?: { accontoPagato?: unknown } } }): number {
  return Number(l?.data?.payment?.accontoPagato) || 0;
}

/** Quanto resta da incassare. Mai negativo: se il cliente ha versato più del
 *  dovuto, il residuo è zero e non un credito a suo favore.
 *
 *  ⚠️ IL RIPIEGO SULL'ARCHIVIO. Metà delle pratiche importate non ha il prezzo
 *   di vendita ma porta un `saldoRimanente` già calcolato da chi ha fatto
 *   l'importazione. Senza, quelle righe direbbero «da definire» e resterebbero
 *   fuori dal totale: il tecnico uscirebbe convinto di non dover ritirare
 *   niente. */
export function saldoAllaConsegna(
  l: { data?: { payment?: { prezzoFinaleVendita?: unknown; prezzoTotale?: unknown; accontoPagato?: unknown; saldoRimanente?: unknown } } },
): number {
  const prezzo = prezzoVendita(l);
  if (prezzo > 0) return Math.max(0, prezzo - giaIncassato(l));
  return Math.max(0, Number(l?.data?.payment?.saldoRimanente) || 0);
}

/** ── IL PREZZO DOPO UNO SCONTO ────────────────────────────────────────────
 *  Lo sconto si scrive come CIFRA CHE SI TOGLIE — «gli ho fatto cinquanta» —
 *  e il prezzo chiuso lo fa il programma: è il verso in cui la frase esce di
 *  bocca davanti al cliente, e non chiede una sottrazione a mente mentre si
 *  parla.
 *  ⚠️ Mai sotto zero, e mai più del prezzo. Uno sconto più grande del prezzo
 *   darebbe una pratica dal valore negativo: in cassa non vuol dire niente, e
 *   nelle KPI diventerebbe un ricavo che si sottrae agli altri.
 *  ⚠️ E si toglie PRIMA dell'IVA. Scontare il totale ivato vuol dire regalare
 *   anche l'imposta su quella parte — che poi si versa comunque — ed è anche
 *   l'unico ordine che una fattura può ripetere. */
export function prezzoScontato(listino: unknown, sconto: unknown): number {
  const p = Math.max(0, numero(listino));
  const s = Math.min(Math.max(0, numero(sconto)), p);
  return Math.round((p - s) * 100) / 100;
}
