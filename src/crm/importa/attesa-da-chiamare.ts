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
import type { LeadData } from "@/crm/types";
import { calcolaDaChiamare } from "@/crm/chatwa/daChiamare";

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

/** ── E INDIETRO: DA «DA CHIAMARE» AD «ATTESA WHATSAPP» (29/10/2026) ─────────
 *  Richiesta del titolare: chi è in «Da chiamare» e risponde in chat (si riapre
 *  la finestra delle 24 ore) torna in «Attesa WhatsApp» ed esce dal filtro «Da
 *  chiamare». SOLO chi era in «Da chiamare»: ogni altro stato resta com'è anche
 *  se il cliente scrive.
 *  Vale se l'ultimo messaggio del cliente è arrivato DOPO l'ingresso in «Da
 *  chiamare» ed entro le ultime 24 ore (finestra aperta); mai con lo STOP. */
const FINESTRA_MS = 24 * 3600_000;
export function patchRitornoAttesa(
  d: Partial<LeadData> | null | undefined,
  contatto: ContattoWa | null | undefined,
  adesso: Date,
): Partial<LeadData> | null {
  if (!d || d.stato !== "da_chiamare" || !contatto || contatto.stop) return null;
  const entrata = Date.parse(contatto.ultimoInEntrataIl ?? "");
  if (!Number.isFinite(entrata)) return null;
  if (adesso.getTime() - entrata > FINESTRA_MS) return null;
  const dal = [d.statoDal, d.statoPrecedenteIl]
    .map((x) => Date.parse(String(x ?? "")))
    .filter((x) => Number.isFinite(x));
  //  Senza data d'ingresso non si sa se ha risposto DOPO: si lascia com'è.
  if (dal.length === 0 || entrata <= Math.max(...dal)) return null;
  const ora = adesso.toISOString();
  return {
    stato: "attesa_whatsapp",
    statoPrecedente: "da_chiamare",
    statoPrecedenteIl: ora,
    statoDal: ora,
  };
}
