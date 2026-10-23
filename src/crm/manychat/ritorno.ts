/** ── LA RISPOSTA CHE TORNA DA MANYCHAT ─────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito U2. Funzioni pure: il
 *  corpo si legge dallo stream, la chiave si confronta esatta, l'impronta toglie
 *  i doppioni, l'abbinamento collega la risposta a un invio vero. Prove in
 *  `prove/manychat/ritorno.mjs`.
 *
 *  Quando il cliente risponde, una External Request di ManyChat chiama la rotta
 *  `/api/public/manychat-risposta` con una chiave segreta nell'intestazione
 *  (`X-HGL-Token`) e un corpo così (PIANO §4.1):
 *    {"crm_invio_id":"…","crm_lead_id":"…","subscriber_id":"…",
 *     "telefono":"<telefono di sistema>","testo":"…"}
 *
 *  ⚠️ Il `telefono` vale SOLO dietro la chiave giusta.
 *  ⚠️ Il corpo si legge dallo stream e ci si ferma oltre 8 KB, senza fidarsi di
 *   `Content-Length`: chi lo manda è fuori dal CRM.
 *  ⚠️ Nei log mai il numero, il testo o il `subscriber_id`.
 *  ───────────────────────────────────────────────────────────────────────── */

import { numeroPerWhatsapp } from "../promemoria/formati";

/** Il corpo massimo che si legge, in byte. */
export const MAX_CORPO_BYTE = 8192;
/** Il testo della risposta si tiene al massimo così lungo. */
export const MAX_TESTO = 2000;
/** Un invio si abbina a una risposta fino a questi giorni dopo. */
const GIORNI_ABBINAMENTO = 7;

export interface CorpoRitorno {
  crmInvioId: string;
  crmLeadId: string;
  subscriberId: string;
  /** il telefono WhatsApp di sistema (cifre o con «+», come lo manda ManyChat) */
  telefono: string;
  testo: string;
}

/** Legge il corpo VERO, fermandosi oltre `max` byte. `troppoGrande` = oltre.
 *  Non guarda `Content-Length` (chi manda è fuori dal CRM e può mentire): conta
 *  i byte che arrivano, e al primo pezzo che sfora annulla lo stream e smette.
 *  Un flusso che si rompe a metà dà un corpo vuoto, non un errore. */
export async function leggiCorpoLimitato(
  stream: ReadableStream<Uint8Array> | null,
  max: number = MAX_CORPO_BYTE,
): Promise<{ testo: string; troppoGrande: boolean }> {
  if (!stream) return { testo: "", troppoGrande: false };
  const lettore = stream.getReader();
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  try {
    for (;;) {
      const { done, value } = await lettore.read();
      if (done) break;
      totale += value.byteLength;
      if (totale > max) {
        await lettore.cancel().catch(() => undefined);
        return { testo: "", troppoGrande: true };
      }
      pezzi.push(value);
    }
  } catch {
    return { testo: "", troppoGrande: false };
  }
  const intero = new Uint8Array(totale);
  let posto = 0;
  for (const p of pezzi) {
    intero.set(p, posto);
    posto += p.byteLength;
  }
  return { testo: new TextDecoder().decode(intero), troppoGrande: false };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un valore qualunque del JSON come stringa: i numeri si convertono, il resto
 *  (oggetti, booleani, assente) è vuoto. */
function comeStringa(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return "";
}

/** Il testo ripulito: senza il carattere nullo (Postgres lo rifiuta), tagliato a
 *  `MAX_TESTO` senza spezzare una emoji a metà. */
function testoPulito(v: string): string {
  const senzaNulli = v.split("\u0000").join("");
  if (senzaNulli.length <= MAX_TESTO) return senzaNulli;
  const taglio = senzaNulli.charCodeAt(MAX_TESTO - 1);
  //  L'ultimo pezzo tenuto è la prima metà di una coppia: via anche quella.
  return senzaNulli.slice(0, taglio >= 0xd800 && taglio <= 0xdbff ? MAX_TESTO - 1 : MAX_TESTO);
}

/** Dal JSON al corpo: tutto stringa, il testo tagliato a `MAX_TESTO`. `null` se
 *  non è un oggetto. I due id del CRM valgono solo se sono uuid, e il
 *  `subscriber_id` solo se sono cifre: un segnaposto di ManyChat non risolto
 *  («{{user_id}}») o una stringa strana diventano vuoti e non arrivano mai a
 *  una query. */
export function leggiCorpo(json: unknown): CorpoRitorno | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const uuid = (v: unknown) => {
    const s = comeStringa(v).trim();
    return UUID.test(s) ? s : "";
  };
  const sub = comeStringa(o.subscriber_id).trim();
  return {
    crmInvioId: uuid(o.crm_invio_id),
    crmLeadId: uuid(o.crm_lead_id),
    subscriberId: /^\d{1,18}$/.test(sub) ? sub : "",
    telefono: comeStringa(o.telefono).trim().slice(0, 40),
    testo: testoPulito(comeStringa(o.testo)),
  };
}

/** Confronto esatto di due chiavi, a tempo costante e anche con lunghezze
 *  diverse (false). Una chiave assente o vuota non è mai uguale a niente. */
export function stessaChiave(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  //  Si scorre sempre fino alla più lunga e non ci si ferma alla prima
  //  differenza; la lunghezza diversa entra nel risultato come tutto il resto.
  let diverso = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diverso |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diverso === 0;
}

/** Le cifre del telefono come le tiene il registro (`393331234567`), o `null`
 *  se non è un numero. Un cellulare italiano si riconosce anche senza prefisso;
 *  un numero straniero senza «+» si accetta com'è, purché abbia 8-15 cifre:
 *  qui serve solo a ritrovare un invio già fatto, non a scrivere a qualcuno. */
export function cifreTelefono(grezzo?: string | null): string | null {
  const numero = numeroPerWhatsapp(grezzo);
  if (numero) return numero;
  const cifre = String(grezzo ?? "").replace(/\D/g, "");
  return /^\d{8,15}$/.test(cifre) ? cifre : null;
}

/** L'impronta della risposta (SHA-256 troncato di subscriber + testo + minuto):
 *  il flusso e la Default Reply che mandano la stessa risposta fanno UNA riga
 *  (`wa_message_id = 'mc-in:<impronta>'`). I tre campi sono separati da un
 *  carattere che nel testo non entra come separatore, così «ab»+«c» e «a»+«bc»
 *  non si confondono. */
export async function impronta(
  subscriberId: string,
  testo: string,
  minuto: string,
): Promise<string> {
  const dati = new TextEncoder().encode(`${subscriberId}\u0000${testo}\u0000${minuto}`);
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", dati));
  let esa = "";
  for (const b of hash.slice(0, 16)) esa += b.toString(16).padStart(2, "0");
  return esa;
}

/** Un invio del registro, quanto serve ad abbinare la risposta. */
export interface InvioAbbinabile {
  id: string;
  leadId: string | null;
  /** solo cifre */
  telefono: string;
  subscriberId: string | null;
  /** ISO */
  prenotatoIl: string;
  stato: string;
}

export type Abbinamento =
  | { tipo: "invio"; invio: InvioAbbinabile }
  | { tipo: "ignorata"; motivo: "contatto_diverso" | "nessun_invio" };

/** Gli stati di un invio che può ricevere una risposta: è partito, o forse è
 *  partito. Un saltato o un fallito non ha mandato niente. */
const STATI_ABBINABILI = ["prenotato", "inviato", "incerto"];

/** Abbina la risposta a un invio: lo stesso `subscriber_id`; senza id, l'ultimo
 *  invio a quel telefono negli ultimi 7 giorni; altrimenti «ignorata».
 *  Se il corpo porta un `crm_invio_id` che è di un ALTRO contatto, la risposta
 *  si ignora del tutto (non si cerca un altro invio al suo posto). */
export function abbina(corpo: CorpoRitorno, invii: InvioAbbinabile[], adesso: Date): Abbinamento {
  const dal = adesso.getTime() - GIORNI_ABBINAMENTO * 24 * 3600e3;
  const recenti = invii.filter(
    (i) => STATI_ABBINABILI.includes(i.stato) && Date.parse(i.prenotatoIl) >= dal,
  );
  const tel = cifreTelefono(corpo.telefono);
  //  Stesso contatto: se tutti e due hanno l'id di ManyChat decide quello,
  //  altrimenti il telefono. Con un lato solo senza id e senza telefono non si
  //  può dire, e «non si può dire» vale no.
  const stessoContatto = (i: InvioAbbinabile) => {
    if (corpo.subscriberId && i.subscriberId) return i.subscriberId === corpo.subscriberId;
    return !!tel && i.telefono === tel;
  };

  if (corpo.crmInvioId) {
    const indicato = recenti.find((i) => i.id === corpo.crmInvioId);
    if (indicato)
      return stessoContatto(indicato)
        ? { tipo: "invio", invio: indicato }
        : { tipo: "ignorata", motivo: "contatto_diverso" };
  }
  let migliore: InvioAbbinabile | null = null;
  for (const i of recenti) {
    if (!stessoContatto(i)) continue;
    if (!migliore || Date.parse(i.prenotatoIl) > Date.parse(migliore.prenotatoIl)) migliore = i;
  }
  return migliore
    ? { tipo: "invio", invio: migliore }
    : { tipo: "ignorata", motivo: "nessun_invio" };
}
