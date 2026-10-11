/** ── CHI SI TELEFONA OGGI, E CHI SI ASPETTA ────────────────────────────────
 *
 *  Segnalazione del committente: «se un lead lo metto da ricontattare fra due
 *  settimane, su lead importati deve uscire fino alla data in cui va
 *  ricontattato: ora continua a mostrarlo anche se metto una data dopo».
 *
 *  ── COM'ERA ──────────────────────────────────────────────────────────────
 *  La regola esisteva già, ma in UN POSTO SOLO: la coda delle telefonate
 *  (`eDaChiamare`) saltava chi aveva una promessa per un altro giorno. Gli
 *  altri due posti che rispondono alla stessa domanda — l'elenco «Da chiamare
 *  in lista» e il numero scritto sulla sua linguetta — guardavano solo lo
 *  STATO: «richiamo» era «da chiamare», fosse per oggi o fra due settimane.
 *  Risultato: la persona spariva dalla coda e restava nell'elenco, e dall'altra
 *  parte sembrava che la data non servisse a niente.
 *
 *  ── LA REGOLA, UNA SOLA ──────────────────────────────────────────────────
 *  Si telefona oggi a chi ha la prima chiamata ancora aperta E non ha una
 *  promessa per un giorno che deve ancora arrivare. Quando quel giorno arriva,
 *  rientra da solo — e ci rientra in cima, perché una promessa scaduta è la
 *  cosa più urgente che c'è.
 *
 *  ⚠️ VALE PER TUTTE E DUE LE PROMESSE CON UNA DATA: il richiamo concordato
 *   («ti chiamo giovedì») e «vi ricontatto io» («entro giovedì»). Telefonare
 *   PRIMA del giorno promesso è il modo più rapido per farsi dire di no, e nel
 *   secondo caso è anche fare l'opposto di quello che ha chiesto la persona.
 *  ⚠️ NON SI TOGLIE DI MEZZO NESSUNO: chi aspetta non è sparito, è in attesa.
 *   Lo si ritrova nell'elenco con l'interruttore acceso, e il giorno della
 *   promessa torna in cima da sé. Toglierlo davvero sarebbe il modo elegante
 *   di perdere un lead.
 *  ⚠️ UNA DATA STORTA NON RIMANDA NIENTE: negli archivi importati le date
 *   illeggibili sono centinaia, e trattarle come «promessa per dopo» vorrebbe
 *   dire centinaia di schede che non si telefonano più. Nel dubbio si chiama.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eStatoDaChiamare, type LeadData, type LeadStatus } from "@/crm/types";

/** Gli stati che portano una promessa con una data. */
const CON_PROMESSA: LeadStatus[] = ["richiamo", "ci_ricontatta_lui"];

/** La data promessa, in forma `AAAA-MM-GG`. Vuota = non ce n'è una leggibile. */
export function giornoPromesso(d?: Partial<LeadData> | null): string {
  if (!d || !CON_PROMESSA.includes(d.stato as LeadStatus)) return "";
  const g = String(d.dataRicontatto ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(g) ? g : "";
}

/** ── ⚠️ SI CHIAMAVA `giorniDa`, COME UN'ALTRA ────────────────────────────
 *  In questa stessa cartella `ricarico.ts` esporta un `giorniDa` che conta i
 *  giorni PASSATI da una data; questa conta quelli che MANCANO. Due funzioni
 *  con lo stesso nome e il segno opposto, a due file di distanza: finché
 *  questa è privata non succede niente, e il giorno in cui qualcuno la esporta
 *  o la copia il guasto è una promessa chiamata due settimane prima.
 *  Il nome adesso dice da che parte si conta.
 *  `NaN` = non si sa (e «non si sa» non è «oggi»). */
function fraQuantiGiorni(giorno: string, oggi: Date): number {
  const o = new Date(oggi);
  o.setHours(0, 0, 0, 0);
  const d = new Date(`${giorno}T00:00:00`);
  if (Number.isNaN(d.getTime())) return Number.NaN;
  return Math.round((d.getTime() - o.getTime()) / 86_400_000);
}

/** Ha una promessa per un giorno che deve ancora arrivare? */
export function promessaPerDopo(d?: Partial<LeadData> | null, oggi: Date = new Date()): boolean {
  const g = giornoPromesso(d);
  if (!g) return false;
  const quanti = fraQuantiGiorni(g, oggi);
  return Number.isFinite(quanti) && quanti > 0;
}

/** Si telefona oggi? */
export function daTelefonareOggi(d?: Partial<LeadData> | null, oggi: Date = new Date()): boolean {
  if (!d || !eStatoDaChiamare(d.stato)) return false;
  return !promessaPerDopo(d, oggi);
}

/** Che cosa scrivere su chi aspetta. Vuoto = non aspetta niente. */
export function etichettaAttesa(d?: Partial<LeadData> | null, oggi: Date = new Date()): string {
  if (!promessaPerDopo(d, oggi)) return "";
  const quanti = fraQuantiGiorni(giornoPromesso(d), oggi);
  if (quanti === 1) return "torna domani";
  return quanti <= 14
    ? `torna fra ${quanti} giorni`
    : `torna il ${giornoPromesso(d).split("-").reverse().join("/")}`;
}
