/** ── IN ATTESA SU WHATSAPP ─────────────────────────────────────────────────
 *
 *  Richiesta del titolare (20/10/2026): un filtro «in attesa di conferma su
 *  WhatsApp», breve: «Attesa WhatsApp». Sono i lead a cui la setter ha scritto
 *  dalla scheda di Lead importati e che non hanno ancora un esito nuovo.
 *
 *  ⚠️ NIENTE STATO NUOVO NEL DATABASE. Si scrive l'ora del messaggio
 *   (`whatsappInviatoIl`) e si confronta con l'ora dell'ultimo cambio di stato
 *   (`statoPrecedenteIl`, lo scrive CRMContext.updateLead a ogni cambio): se lo
 *   stato è cambiato DOPO il messaggio — richiamo, appuntamento, non
 *   interessato — l'attesa è finita da sola, senza che nessuno la spenga.
 *  ⚠️ Le date si confrontano come istanti (`Date.parse`), non come testo.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "@/crm/types";

/** Cosa scrivere sulla scheda quando si preme WhatsApp. Non tocca lo stato. */
export function patchWhatsappInviato(
  d?: Partial<LeadData> | null,
  ora: Date = new Date(),
): Partial<LeadData> {
  const prima = Number(d?.whatsappInviatoVolte);
  return {
    whatsappInviatoIl: ora.toISOString(),
    whatsappInviatoVolte: Number.isFinite(prima) && prima >= 1 ? Math.floor(prima) + 1 : 1,
  };
}

/** Gli è stato scritto e lo stato non è cambiato da allora. */
export function inAttesaWhatsapp(d?: Partial<LeadData> | null): boolean {
  const scritto = Date.parse(String(d?.whatsappInviatoIl ?? ""));
  if (!Number.isFinite(scritto)) return false;
  const cambio = Date.parse(String(d?.statoPrecedenteIl ?? ""));
  return !Number.isFinite(cambio) || cambio <= scritto;
}
