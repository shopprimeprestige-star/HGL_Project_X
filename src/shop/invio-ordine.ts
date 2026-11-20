/** ── INVIO DELL'ORDINE DAL CHECKOUT: LA PARTE CHE SI PUÒ DECIDERE SENZA RETE ──
 *  Commessa 2026-11-17-crm-ecommerce (T1). Prima il checkout faceva
 *  `insert().select("order_ref")` da anonimo: la rilettura chiede una policy
 *  SELECT che per `anon` non esiste, l'errore finiva in un `catch {}` e il
 *  cliente vedeva «Ordine confermato» con l'ordine mai salvato.
 *
 *  Qui si decide solo ciò che non ha bisogno di rete (prove/ecommerce/checkout.mjs):
 *   · `id` e `order_ref` nascono UNA volta per tentativo d'acquisto e si riusano
 *     nei nuovi invii: dopo un timeout il primo invio può essere andato a buon
 *     fine, e con lo stesso `id` il secondo trova la chiave già presa (23505) →
 *     «già salvato», niente doppione. Se il carrello o i dati cambiano, la firma
 *     cambia e nasce un tentativo NUOVO: altrimenti il 23505 confermerebbe un
 *     ordine diverso da quello che il cliente ha davanti.
 *   · l'esito si legge dal CODICE dell'errore, mai dal testo (cambia con la lingua e la versione).
 *  Puro: niente React, niente Supabase, niente `window`. */

/** Il tentativo d'acquisto in corso: gli identificativi e la firma del contenuto per cui valgono. */
export interface Tentativo {
  id: string;
  orderRef: string;
  firma: string;
}

/** I campi che il cliente compila. */
export interface FormOrdine {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  indirizzo: string;
  citta: string;
  cap: string;
  note: string;
}

export interface DatiOrdine {
  form: FormOrdine;
  items: unknown[];
  subtotal: number;
  shipping: number;
  total: number;
}

export type EsitoInvio = "salvato" | "errore";

/** Unica cosa che il cliente legge quando l'ordine non è stato registrato. */
export const MESSAGGIO_ERRORE_ORDINE =
  "Non siamo riusciti a registrare il tuo ordine. Il carrello è ancora qui: riprova tra un momento.";

type Cripto =
  | { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array }
  | null
  | undefined;

/** UUID v4. `randomUUID` se c'è, altrimenti `getRandomValues`. */
export function uuidNuovo(cripto: Cripto = globalThis.crypto): string {
  if (cripto?.randomUUID) return cripto.randomUUID();
  const b = new Uint8Array(16);
  if (cripto?.getRandomValues) cripto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); // shortcut: Math.random solo se il browser non ha crypto, è un id d'ordine non un segreto; toglierlo quando non serviranno più browser così vecchi
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Il contenuto dell'ordine come testo: se cambia anche solo un campo, è un altro ordine. */
export function firmaOrdine(d: DatiOrdine): string {
  const f = d.form;
  return JSON.stringify([
    f.nome,
    f.cognome,
    f.email,
    f.telefono,
    f.indirizzo,
    f.citta,
    f.cap,
    f.note,
    d.items,
    d.subtotal,
    d.shipping,
    d.total,
  ]);
}

/** Lo stesso tentativo se il contenuto è identico; altrimenti identificativi nuovi. */
export function tentativoPer(
  precedente: Tentativo | null,
  firma: string,
  ora: number = Date.now(),
  uuid: () => string = uuidNuovo,
): Tentativo {
  if (precedente && precedente.firma === firma) return precedente;
  return { id: uuid(), orderRef: `HG-${ora.toString(36).toUpperCase().slice(-6)}`, firma };
}

/** La riga da inserire in `shop_orders`. Niente `created_at`: la policy lo vuole = adesso. */
export function rigaOrdine(t: Tentativo, d: DatiOrdine) {
  const f = d.form;
  return {
    id: t.id,
    order_ref: t.orderRef,
    nome: f.nome,
    cognome: f.cognome,
    email: f.email,
    telefono: f.telefono,
    indirizzo: f.indirizzo,
    citta: f.citta,
    cap: f.cap,
    note: f.note || null,
    items: d.items,
    subtotal: d.subtotal,
    shipping: d.shipping,
    total: d.total,
    status: "nuovo",
  };
}

/** Manda la riga e dice com'è andata. 23505 (chiave già presa) = il primo invio era riuscito. */
export async function inviaOrdine(
  riga: ReturnType<typeof rigaOrdine>,
  inserisci: (
    riga: ReturnType<typeof rigaOrdine>,
  ) => PromiseLike<{ error: { code?: string } | null } | undefined>,
): Promise<EsitoInvio> {
  try {
    const { error } = (await inserisci(riga)) as { error: { code?: string } | null };
    return error === null || error.code === "23505" ? "salvato" : "errore";
  } catch {
    return "errore";
  }
}
