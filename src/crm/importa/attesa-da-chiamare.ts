/** ── DA «ATTESA WHATSAPP» A «DA CHIAMARE», DA SOLO ──────────────────────────
 *
 *  Richiesta del titolare (28/10/2026): «fai che cambia stato Attesa WhatsApp
 *  in Da chiamare» quando resta in attesa più di 10 ore. Lo fa il server ogni
 *  15 minuti (hooks/attesa-da-chiamare), anche a CRM chiuso.
 *
 *  Chi si sposta: stato `attesa_whatsapp` da almeno 10 ore (stessa regola della
 *  sezione «Da chiamare» della chat, crm/chatwa/daChiamare), senza un messaggio
 *  del cliente da allora, senza STOP sul numero.
 *  ⚠️ Solo chi è nello STATO «Attesa WhatsApp»: il solo tasto WhatsApp premuto
 *   (senza stato) non cambia la scheda di nessuno.
 *  ⚠️ La modifica tocca solo lo stato e la sua storia (stato di prima e ora):
 *   il resto della scheda resta com'è. Il server la scrive solo se la scheda
 *   non è cambiata nel frattempo (vedi la rotta).
 *  ───────────────────────────────────────────────────────────────────────── */
import { LEAD_STATUS_LABEL, type LeadData, type LeadStatus } from "@/crm/types";
import { calcolaDaChiamare } from "@/crm/chatwa/daChiamare";
import { aRoma } from "@/crm/promemoria/formati";
import { conNota } from "@/crm/manychat/prenota-scheda";

export interface ContattoWa {
  /** l'ultimo messaggio del cliente */
  ultimoInEntrataIl?: string | null;
  /** STOP: ha chiesto di non essere contattato */
  stop?: boolean;
}

/** Le ultime nove cifre: la stessa impronta del numero usata in tutto il CRM. */
export const nove = (t?: string | null): string =>
  String(t ?? "")
    .replace(/\D/g, "")
    .slice(-9);

/** La modifica da scrivere sulla scheda, o `null` se non va spostata. */
export function patchDaChiamare(
  d: Partial<LeadData> | null | undefined,
  contatto: ContattoWa | null | undefined,
  adesso: Date,
): Partial<LeadData> | null {
  if (!d || d.stato !== "attesa_whatsapp") return null;
  const esito = calcolaDaChiamare({
    dati: d,
    messaggi: [],
    stop: contatto?.stop ?? false,
    ultimaEntrataIl: contatto?.ultimoInEntrataIl ?? null,
    adesso,
  });
  if (!esito.si) return null;
  const ora = adesso.toISOString();
  return {
    stato: "da_chiamare",
    statoPrecedente: "attesa_whatsapp",
    statoPrecedenteIl: ora,
    statoDal: ora,
  };
}

/** ── E INDIETRO: CHI SCRIVE TORNA IN «ATTESA WHATSAPP» (29-30/10/2026) ──────
 *  Richiesta del titolare: se il lead è in uno stato «da setter» e scrive, si
 *  riapre la finestra delle 24 ore e la scheda torna da sola in «Attesa
 *  WhatsApp», così si vede subito e si risponde.
 *  ⚠️ ELENCO CHIUSO: solo questi quattro stati cambiano. Tutto il resto (Non
 *   interessato, Richiamo concordato, Appuntamento fissato/rifissato, Ci
 *   ricontatta lui, Perditempo e ogni stato dopo la consulenza) resta com'è
 *   anche se il cliente scrive. Un nuovo stato NON entra qui da solo.
 *  Vale se l'ultimo messaggio del cliente è arrivato DOPO l'ingresso nello
 *  stato ed entro le ultime 24 ore (finestra aperta); mai con lo STOP.
 *  «Messaggio del cliente» = `ultimo_in_entrata_il` della rubrica, che lo
 *  scrive solo ManyChat DOPO i controlli su eco e doppioni: i messaggi nostri
 *  non lo toccano. Le chiamate WhatsApp in entrata non arrivano da nessuna
 *  fonte (il ponte le scarta, il webhook Cloud non legge `calls`): non contano. */
export const STATI_CHE_TORNANO_IN_ATTESA = [
  "da_contattare",
  "non_risponde",
  "segreteria",
  "da_chiamare",
] as const satisfies readonly LeadStatus[];

const FINESTRA_MS = 24 * 3600_000;
const due = (n: number) => String(n).padStart(2, "0");

/** «30/10 alle 00:09», ora di Roma. */
function quandoARoma(iso: number): string {
  const r = aRoma(new Date(iso));
  const [, mese, giorno] = r.giorno.split("-");
  return `${giorno}/${mese} alle ${due(Math.floor(r.minuti / 60))}:${due(r.minuti % 60)}`;
}

/** `modificataIl`: l'`updated_at` della riga, solo come ripiego quando la scheda
 *  non ha `statoDal` né `statoPrecedenteIl` (schede vecchie o importate): senza
 *  una data d'ingresso non si saprebbe dire se ha scritto DOPO. */
export function patchRitornoAttesa(
  d: Partial<LeadData> | null | undefined,
  contatto: ContattoWa | null | undefined,
  adesso: Date,
  modificataIl?: string | null,
): Partial<LeadData> | null {
  if (!d || !contatto || contatto.stop) return null;
  const stato = d.stato as string | undefined;
  if (!stato || !(STATI_CHE_TORNANO_IN_ATTESA as readonly string[]).includes(stato)) return null;
  const entrata = Date.parse(contatto.ultimoInEntrataIl ?? "");
  if (!Number.isFinite(entrata)) return null;
  if (adesso.getTime() - entrata > FINESTRA_MS) return null;
  const date = (xs: unknown[]) =>
    xs.map((x) => Date.parse(String(x ?? ""))).filter((x) => Number.isFinite(x));
  let dal = date([d.statoDal, d.statoPrecedenteIl]);
  if (dal.length === 0) dal = date([modificataIl]);
  //  Senza nessuna data non si sa se ha scritto DOPO: si lascia com'è.
  if (dal.length === 0 || entrata <= Math.max(...dal)) return null;
  const ora = adesso.toISOString();
  const riga = `Tornato in Attesa WhatsApp: ha scritto il ${quandoARoma(entrata)} (era: ${LEAD_STATUS_LABEL[stato as LeadStatus] ?? stato})`;
  return {
    stato: "attesa_whatsapp",
    statoPrecedente: stato as LeadStatus,
    statoPrecedenteIl: ora,
    statoDal: ora,
    note: conNota(d.note, riga),
  };
}
