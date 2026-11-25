/*  ── LA SESSIONE DI CHECKOUT (R2 · T44 · D47) ──────────────────────────────────────────────────────
    `corpoSessione(ordine, righe, spedizione, url)`: PURO. Costruisce i campi della sessione, che `client.creaSessione` codifica.
    · importi interi in centesimi, valuta eur, nome = prodotto + variante, NESSUNA immagine, nessuna IVA, nessun metodo di pagamento elencato
      (decide il pannello Stripe: Apple/Google Pay, PayPal, Klarna);
    · la spedizione è una `shipping_options` `fixed_amount` (anche a 0): il totale di Stripe = subtotale + spedizione;
    · `expires_at` = `scade_il` dell'ordine (calcolato UNA volta alla creazione): due clic sovrapposti mandano parametri IDENTICI e l'Idempotency-Key tiene;
    · `client_reference_id` e `metadata[ordine_id]` = id ordine; `payment_intent_data[metadata][ordine_id]` = il ripiego per trovare l'ordine dai rimborsi;
    · del cliente passa solo l'email (Stripe la precompila): mai telefono, nome, indirizzo, codice fiscale. Un dato non valido lancia un codice, mai i dati.
    Gli indirizzi di ritorno li costruisce chi chiama dalla costante `SITO` (mai da `Host`/`Origin`). */
import type { CampiForm } from "./tipi";

export type OrdineSessione = { id: string; email?: string | null; scadeIl: string };
export type RigaSessione = { nome: string; variante?: string | null; qty: number; prezzoCent: number };
export type SpedizioneSessione = { costoCent: number };
export type UrlSessione = { successo: string; annullo: string };

const MAX_NOME = 250; // il limite di Stripe per il nome di un prodotto
const intero = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);
const https = (u: unknown): u is string => typeof u === "string" && /^https:\/\/[^\s]+$/.test(u);

export function corpoSessione(ordine: OrdineSessione, righe: RigaSessione[], spedizione: SpedizioneSessione, url: UrlSessione): CampiForm {
  if (!Array.isArray(righe) || righe.length === 0) throw new Error("riga_non_valida");
  for (const r of righe) {
    if (!r || typeof r.nome !== "string" || r.nome.trim() === "" || !intero(r.qty) || r.qty < 1 || !intero(r.prezzoCent) || r.prezzoCent < 1) throw new Error("riga_non_valida");
  }
  if (!spedizione || !intero(spedizione.costoCent) || spedizione.costoCent < 0) throw new Error("spedizione_non_valida");
  const scadenza = Date.parse(ordine?.scadeIl);
  if (!Number.isFinite(scadenza)) throw new Error("scadenza_non_valida");
  if (!https(url?.successo) || !https(url?.annullo)) throw new Error("url_non_valido");
  if (typeof ordine.id !== "string" || ordine.id === "") throw new Error("ordine_non_valido");

  return {
    mode: "payment",
    locale: "it",
    client_reference_id: ordine.id,
    ...(typeof ordine.email === "string" && ordine.email !== "" ? { customer_email: ordine.email } : {}),
    success_url: url.successo,
    cancel_url: url.annullo,
    expires_at: Math.floor(scadenza / 1000),
    metadata: { ordine_id: ordine.id },
    payment_intent_data: { metadata: { ordine_id: ordine.id } },
    line_items: righe.map((r) => ({
      quantity: r.qty,
      price_data: {
        currency: "eur",
        unit_amount: r.prezzoCent,
        product_data: { name: (r.variante ? `${r.nome} · ${r.variante}` : r.nome).slice(0, MAX_NOME) },
      },
    })),
    shipping_options: [
      { shipping_rate_data: { type: "fixed_amount", display_name: "Spedizione", fixed_amount: { amount: spedizione.costoCent, currency: "eur" } } },
    ],
  };
}

/** L'`Idempotency-Key` della sessione (D47): `sessione-<ordine id>-<firma>-r<riprova_n>`. La riprova (`riprova_n` letto sotto blocco da `shop_ordine_riapri`) la cambia. */
export function chiaveSessione(ordineId: string, firma: string, riprovaN: number): string {
  const segno = /^[A-Za-z0-9_-]{1,100}$/;
  if (!segno.test(ordineId) || !segno.test(firma) || !Number.isSafeInteger(riprovaN) || riprovaN < 0) throw new Error("chiave_non_valida");
  return `sessione-${ordineId}-${firma}-r${riprovaN}`;
}
