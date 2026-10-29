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
  //  `statoDal` è l'ora che scrive il server quando mette lo stato (ManyChat):
  //  ripiego se manca quella del CRM. Senza nessuna delle tre non si sa da
  //  quando aspetta, e non si inventa: resta fuori.
  if (d.stato === "attesa_whatsapp")
    return valido(d.statoPrecedenteIl) ?? valido(d.statoDal) ?? valido(d.whatsappInviatoIl);
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
  //  Lo stato «Da chiamare» (28/10/2026): ci è già arrivato, non si aspetta altro.
  const giaDaChiamare = p.dati?.stato === "da_chiamare";
  const dal = giaDaChiamare
    ? (p.dati?.statoPrecedenteIl ?? p.dati?.statoDal ?? null)
    : inAttesaDal(p.dati);
  if (!dal || !Number.isFinite(Date.parse(dal))) return NO;
  const inizio = Date.parse(dal);
  if (!giaDaChiamare && p.adesso.getTime() - inizio < ORE_PRIMA_DI_CHIAMARE * 3600_000) return NO;
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

/** ── LA PILLOLA «DA CHIAMARE» E I SUOI SOTTOFILTRI (28/10/2026) ──────────────
 *  Le chat collegate a un lead il cui stato è uno di questi cinque, in questo
 *  ordine. `attesa_whatsapp` NON c'è: quelli aspettano la risposta del cliente.
 *  Tutto puro, provato in prove/manychat/chat-sottofiltri.mjs. */
export const STATI_SOTTOFILTRI = [
  "da_chiamare",
  "non_risponde",
  "segreteria",
  "richiamo",
  "ci_ricontatta_lui",
] as const;
export type StatoChiamata = (typeof STATI_SOTTOFILTRI)[number];
export type Sottofiltro = "tutti" | StatoChiamata;

/** Gli stati che si scelgono dalla riga (non serve aprire la chat), nell'ordine in cui si usano. */
export const STATI_CAMBIO_RAPIDO = [
  "non_risponde",
  "segreteria",
  "richiamo",
  "ci_ricontatta_lui",
  "appuntamento_fissato",
  "annullato", // «Non interessato»
  "da_chiamare",
] as const;

interface ChatConStato {
  lead?: {
    data?: {
      stato?: string | null;
      statoDal?: string | null;
      statoPrecedenteIl?: string | null;
    } | null;
  } | null;
}

/** Lo stato di chiamata della chat, o `null` se non ha scheda o lo stato è un altro. */
export function statoChiamata(c: ChatConStato): StatoChiamata | null {
  const s = String(c.lead?.data?.stato ?? "");
  return (STATI_SOTTOFILTRI as readonly string[]).includes(s) ? (s as StatoChiamata) : null;
}

/** Quante chat per sottofiltro; «tutti» è la somma. I chip a zero li nasconde chi disegna. */
export function contaSottofiltri(chats: ChatConStato[]): Record<Sottofiltro, number> {
  const n: Record<Sottofiltro, number> = {
    tutti: 0,
    da_chiamare: 0,
    non_risponde: 0,
    segreteria: 0,
    richiamo: 0,
    ci_ricontatta_lui: 0,
  };
  for (const c of chats) {
    const s = statoChiamata(c);
    if (!s) continue;
    n[s]++;
    n.tutti++;
  }
  return n;
}

/** Dal cambio di stato (ISO) per ordinare; senza data valida = «non si sa», in fondo al suo stato. */
const quandoCambiato = (c: ChatConStato): number => {
  const d = c.lead?.data;
  const t = Date.parse(String(d?.statoDal ?? d?.statoPrecedenteIl ?? ""));
  return Number.isFinite(t) ? t : Infinity;
};

/** Le chat del sottofiltro. «tutti» = un elenco solo, ordinato per stato (nell'ordine di
 *  `STATI_SOTTOFILTRI`) e dentro ogni stato dal cambio di stato più vecchio al più nuovo.
 *  Non muta l'ingresso; la parità resta com'era (sort stabile). */
export function chatDaChiamare<T extends ChatConStato>(chats: T[], sotto: Sottofiltro): T[] {
  return chats
    .filter((c) => {
      const s = statoChiamata(c);
      return s !== null && (sotto === "tutti" || s === sotto);
    })
    .sort((a, b) => {
      const per =
        STATI_SOTTOFILTRI.indexOf(statoChiamata(a)!) - STATI_SOTTOFILTRI.indexOf(statoChiamata(b)!);
      if (per) return per;
      const x = quandoCambiato(a);
      const y = quandoCambiato(b);
      return x === y ? 0 : x < y ? -1 : 1;
    });
}

/** Gli stati che la riga offre per il cambio rapido. La regola del CRM (`statiPer`) a un lead non
 *  «importato» (quelli del modulo) ne ammette pochi, ma chi è GIÀ in uno stato di chiamata (o in
 *  attesa WhatsApp / da contattare) sta lavorando proprio quella telefonata: deve poter scegliere
 *  tutti e sette. Per gli altri stati resta `statiPer`, che qui arriva come `ammessi`. */
export function statiMenuRiga(
  statoAttuale: string | null | undefined,
  ammessi: ReadonlySet<string>,
): (typeof STATI_CAMBIO_RAPIDO)[number][] {
  const inChiamata =
    (STATI_SOTTOFILTRI as readonly string[]).includes(String(statoAttuale)) ||
    statoAttuale === "attesa_whatsapp" ||
    statoAttuale === "da_contattare";
  return STATI_CAMBIO_RAPIDO.filter((s) => inChiamata || ammessi.has(s));
}

/** La pastiglia della finestra di 24 ore nelle righe di «Da chiamare» (29/10/2026).
 *  Senza dati sulla finestra niente pastiglia (meglio niente che un verde falso). */
export function pastigliaFinestra(
  f: { aperta: boolean; frase: string } | undefined | null,
): { aperta: boolean; testo: string; titolo: string } | null {
  if (!f) return null;
  return f.aperta
    ? { aperta: true, testo: "Si può scrivere", titolo: f.frase || "Finestra di 24 ore aperta" }
    : { aperta: false, testo: "Finestra chiusa", titolo: f.frase || "Passate 24 ore: serve un modello approvato" };
}
