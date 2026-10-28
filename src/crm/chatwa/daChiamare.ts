/** ── «DA CHIAMARE»: IN ATTESA SU WHATSAPP DA PIÙ DI 10 ORE ───────────────────
 *
 *  Richiesta del titolare (28/10/2026), corretta subito dopo: non tutti quelli
 *  che hanno ricevuto il primo messaggio, ma «solo quelli che rimangono in
 *  attesa WhatsApp per più di 10 ore di fila» si spostano nella scheda «Da
 *  chiamare» della chat, con il tasto per telefonare sopra la chat.
 *
 *  LA REGOLA (pura, provata in prove/prove.mjs, proveDelDaChiamare):
 *   · il lead è «in attesa WhatsApp» come nel resto del CRM: stato
 *     `attesa_whatsapp`, oppure il tasto WhatsApp premuto e nessun cambio di
 *     stato da allora (`inAttesaWhatsapp`, crm/importa/attesa-whatsapp);
 *   · l'attesa è cominciata almeno 10 ore fa: dall'ora in cui è stato messo lo
 *     stato (`statoPrecedenteIl`), o da quando è partito il messaggio
 *     (`whatsappInviatoIl`);
 *   · da allora il cliente non ha scritto (altrimenti è «Da rispondere»);
 *   · niente STOP sul numero.
 *  Esce da sola quando lo stato cambia (fissato, non risponde, richiamo…) o
 *  quando il cliente scrive.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "@/crm/types";
import { inAttesaWhatsapp } from "@/crm/importa/attesa-whatsapp";

export const ORE_PRIMA_DI_CHIAMARE = 10;

type Messaggio = { direction: string; created_at: string };

export interface DaChiamare {
  si: boolean;
  /** da quando è in attesa (ISO) */
  dal: string | null;
}

const NO: DaChiamare = { si: false, dal: null };

/** Da quando questo lead è in attesa su WhatsApp, o `null` se non lo è. */
export function inAttesaDal(d?: Partial<LeadData> | null): string | null {
  if (!d) return null;
  const valido = (x: unknown) => (Number.isFinite(Date.parse(String(x ?? ""))) ? String(x) : null);
  if (d.stato === "attesa_whatsapp")
    return valido(d.statoPrecedenteIl) ?? valido(d.whatsappInviatoIl);
  return inAttesaWhatsapp(d) ? valido(d.whatsappInviatoIl) : null;
}

export function calcolaDaChiamare(p: {
  /** la scheda del lead della chat (senza scheda non c'è attesa) */
  dati?: Partial<LeadData> | null;
  messaggi: Messaggio[];
  stop?: boolean;
  /** l'ultimo messaggio del cliente secondo la rubrica: vale anche se i
   *  messaggi caricati non arrivano così indietro */
  ultimaEntrataIl?: string | null;
  adesso: Date;
}): DaChiamare {
  if (p.stop) return NO;
  const dal = inAttesaDal(p.dati);
  if (!dal) return NO;
  const inizio = Date.parse(dal);
  if (p.adesso.getTime() - inizio < ORE_PRIMA_DI_CHIAMARE * 3600_000) return NO;
  let ultimaEntrata = Date.parse(String(p.ultimaEntrataIl ?? "")) || 0;
  for (const m of p.messaggi)
    if (m.direction === "inbound")
      ultimaEntrata = Math.max(ultimaEntrata, Date.parse(m.created_at) || 0);
  if (ultimaEntrata > inizio) return NO;
  return { si: true, dal };
}

/** Il numero della scheda nel formato delle chat («+39…»), o "" se non si sa
 *  dire. Serve a far comparire in «Da chiamare» anche chi è stato scritto dal
 *  WhatsApp del telefono e nel CRM non ha ancora una chat. */
export function telefonoE164(t?: string | null): string {
  let c = String(t ?? "").replace(/[^\d+]/g, "");
  if (c.startsWith("00")) c = `+${c.slice(2)}`;
  const cifre = c.replace(/\D/g, "");
  if (cifre.length < 8) return "";
  if (c.startsWith("+")) return `+${cifre}`;
  //  Un cellulare italiano scritto senza prefisso (3xx…, 9-10 cifre).
  if (/^3\d{8,9}$/.test(cifre)) return `+39${cifre}`;
  if (cifre.startsWith("39") && cifre.length >= 11) return `+${cifre}`;
  return "";
}
