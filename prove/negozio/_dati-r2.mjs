/** ── DATI INVENTATI PER LE PROVE DEL RILASCIO 2 (T40) ──────────────────────
 *  ⚠️ Tutto di fantasia: nomi, `+39 300 000 xxxx`, `@example.com`, SKU `PROVA-…`, sessioni `cs_test_…` finte.
 *   Mai dati di clienti veri, in nessuna prova di questa cartella. Nessun `Math.random`, nessun `Date.now`: ogni
 *   chiamata dà gli stessi dati (la fotografia dei conti ne ha l'impronta, `conti-invariati.mjs`).
 *  Cosa c'è:
 *   · `ordiniR1R2()`          40 ordini di oggi (R1/R2), di ogni stato, con e senza `pagato_il`: la fotografia dei conti;
 *   · `conDefaultS4(riga)`    la stessa riga dopo S4 (colonne nuove ai loro default): la seconda forma della fotografia;
 *   · `righeSporche()`        righe che `normalizzaTutti` deve scartare e contare;
 *   · `partenzaDa(spec)`      il mondo di partenza di uno scenario (`_scenari-soldi.json`): catalogo, ordini, sessioni;
 *   · `tariffaSeme()`, `modelliEmailSeme()`  i semi di S5 e di S6; `sessioneStripeProva`, `rimborsoStripeProva`, `eventoStripeProva`. */
import { COLONNE_S4, CHIAVI_EMAIL } from "./_finto-db.mjs";
import { uuid } from "./dati.mjs";

/** Il «adesso» della fotografia (ordiniFermi): dopo l'ultimo dei 40 ordini. */
export const ADESSO_FOTO = "2026-11-20T12:00:00.000Z";
/** Il fuso con cui si fa la fotografia: periodi e giorni dell'andamento sono giorni LOCALI. */
export const FUSO_FOTO = "Europe/Rome";

const STATI = ["nuovo", "in_preparazione", "spedito", "consegnato", "annullato"];
/** [id, nome, prezzo €]: sei prodotti inventati. */
const CATALOGO = [
  ["prodotto-uno", "Prodotto di prova uno", 12.5],
  ["prodotto-due", "Prodotto di prova due", 24.9],
  ["prodotto-tre", "Prodotto di prova tre", 39],
  ["prodotto-quattro", "Prodotto di prova quattro", 59.9],
  ["prodotto-cinque", "Prodotto di prova cinque", 9.99],
  ["prodotto-sei", "Prodotto di prova sei", 120],
];
const NOMI = ["Anna", "Bruno", "Carla", "Dario", "Elena", "Fabio", "Giulia", "Ugo", "Irene", "Livio", "Marta", "Nico"];
const METODI = ["bonifico", "carta", "contanti", "altro"];
const arrotonda = (n) => Math.round(n * 100) / 100;
/** Un istante in UTC: il giorno 1 di settembre più `giorni`, alle `h:m` (si usano ore di giornata: in Europa/Rome il giorno è lo stesso). */
const istante = (giorni, h, m) => new Date(Date.UTC(2026, 8, 1 + giorni, h, m)).toISOString();

/** I 40 ordini «di oggi»: la forma di `shop_orders` PRIMA di S4 (nessuna colonna di S4). */
export function ordiniR1R2() {
  const ordini = [];
  for (let i = 0; i < 40; i++) {
    const p = (i * 5 + 3) % 12; // la persona: ogni cliente torna 3-4 volte
    const nPezzi = 1 + (i % 3);
    const items = [];
    for (let k = 0; k < nPezzi; k++) {
      const [id, nome, prezzo] = CATALOGO[(i + k * 2) % CATALOGO.length];
      items.push({
        product_id: id,
        name: nome,
        slug: id,
        qty: 1 + ((i + k) % 4 === 3 ? 1 : 0),
        unit_price: i % 7 === 3 ? String(prezzo).replace(".", ",") : prezzo, // ogni tanto il prezzo arriva come testo «24,9»
        variant: k % 3 === 0 ? null : k % 3 === 1 ? "Formato 100 ml" : { Colore: "Nero", Misura: "M" },
      });
    }
    const subtotale = arrotonda(items.reduce((s, r) => s + r.qty * Number(String(r.unit_price).replace(",", ".")), 0));
    const spedizione = subtotale >= 59 ? 0 : 4.9;
    const stato = STATI[i % 5];
    const pagato = Math.floor(i / 5) % 2 === 0; // gruppi di cinque: tutti e cinque gli stati, con e senza pagamento (4 + 4 per stato)
    const creato = istante(i * 2, 8 + (i % 9), (i * 7) % 60);
    ordini.push({
      id: uuid(0x5000 + i),
      created_at: creato,
      order_ref: `HG-F${String(i + 1).padStart(3, "0")}`,
      nome: NOMI[p],
      cognome: "Esempio",
      email: `cliente${p}@example.com`,
      telefono: `+39 300 000 ${String(100 + p).padStart(4, "0")}`,
      indirizzo: `Via Inventata ${p + 1}`,
      citta: "Cittàfinta",
      cap: "00000",
      note: i % 8 === 5 ? "Citofono rotto, suonare due volte" : null,
      items,
      subtotal: subtotale,
      shipping: spedizione,
      total: arrotonda(subtotale + spedizione),
      status: stato,
      lead_id: i % 4 === 0 ? uuid(0xa00 + p) : null,
      senza_lead: i % 10 === 1,
      pagato_il: pagato ? istante(i * 2 + 1, 9, 30) : null,
      pagato_importo: pagato && i % 9 !== 0 ? arrotonda(subtotale + spedizione) : null,
      metodo_pagamento: pagato ? METODI[i % 4] : null,
      tracking: stato === "spedito" || stato === "consegnato" ? `TRK${1000 + i}` : null,
      note_interne: i % 6 === 0 ? "nota interna inventata" : null,
      aggiornato_il: i % 3 === 0 ? istante(i * 2, 12 + (i % 9), 5) : null,
    });
  }
  // ── i casi storti, che la tabella non vieta (la scrive anche un anonimo) ──
  ordini[13].total = -5; //                         importo negativo: vale 0 e si conta fra gli anomali
  ordini[27].total = 5e6; //                        importo enorme
  ordini[33].pagato_importo = 9e9; //               incasso enorme
  ordini[20].items = null; //                       nessuna riga: il subtotale si legge, le righe no
  ordini[21].status = "ESOTICO"; //                 stato che non esiste: «nuovo», ma lo stato grezzo resta
  ordini[18].shipping = "4,90"; //                  numero in testo con la virgola
  ordini[7].telefono = "300 000 0105"; //           lo stesso telefono scritto senza prefisso…
  ordini[7].email = "  CLIENTE9@Example.com "; //  …e la stessa email con maiuscole e spazi
  ordini[16].lead_id = uuid(0xa90); //              due schede diverse con lo stesso telefono: restano due persone
  ordini[36].lead_id = uuid(0xa91);
  ordini[36].telefono = ordini[16].telefono;
  ordini[36].email = ordini[16].email;
  return ordini;
}

/** La stessa riga com'è DOPO S4: le colonne nuove con il loro default (`prova=false`, `rimborsato_cent=0`, `stato_pagamento` vuoto, …). */
export const conDefaultS4 = (riga) => ({ ...structuredClone(COLONNE_S4), ...riga });

/** Righe che non si possono leggere: senza id, senza data, non oggetti. `normalizzaTutti` le deve contare, non farle sparire. */
export function righeSporche() {
  return [null, 42, "testo", [], {}, { id: "x" }, { id: "y", created_at: "non una data" }, { id: "", created_at: "2026-11-01T10:00:00.000Z" }, ordiniR1R2()[0]];
}

/** I periodi della fotografia (giorni locali, estremi inclusi). */
export const PERIODI_FOTO = {
  tutto: { da: "2026-09-01", a: "2026-11-30" },
  novembre: { da: "2026-11-01", a: "2026-11-30" },
  settimana: { da: "2026-11-10", a: "2026-11-16" },
  ottobre: { da: "2026-10-01", a: "2026-10-31" },
  vuoto: { da: "2025-01-01", a: "2025-01-31" },
  capovolto: { da: "2026-11-30", a: "2026-11-01" },
};
/** «Scheda principale viva» finta: le schede pari puntano alla prima, la `a91` non si risolve. Deterministica. */
export const principaleFoto = (leadId) => (leadId === uuid(0xa91) ? null : leadId === uuid(0xa02) ? uuid(0xa00) : leadId);

// ── il mondo di uno scenario ─────────────────────────────────────────────────

/** Un'impronta di dati per la prova: JSON con le chiavi in ordine, così non dipende da come sono scritte. */
export const canonicoJson = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

/**
 * @param {object} spec  la `partenza` di uno scenario di `_scenari-soldi.json`:
 *   · `varianti`: [{sku, giacenza, prezzo_cent?, attiva?, pubblicato?, slug?, nome_prodotto?, nome?}]  → un prodotto (pubblicato) e una variante ciascuna;
 *   · `ordini`: [{id, ref, totale_cent, righe:[{sku, qty, prezzo_cent?}], sessioni?:["cs_…"], scade_il?, campi?:{colonna:valore}}]
 *       un ordine del sito nuovo, `in_attesa`, con le sue sessioni registrate (l'ultima è la corrente); `campi` sovrascrive colonne;
 *   · `tariffe`, `modelli`, `limiti`: righe grezze (le colonne mancanti prendono i default del finto).
 * @param {() => string} adesso
 */
export function partenzaDa(spec, adesso = () => "2026-11-20T12:00:00.000Z") {
  const t = { shop_prodotti: [], shop_varianti: [], shop_orders: [], shop_stripe_sessioni: [], shop_ordini_riservati: [], shop_spedizioni_tariffe: [], shop_email_modelli: [], shop_limiti: [] };
  (spec.varianti ?? []).forEach((v, i) => {
    const pid = uuid(0x7000 + i);
    t.shop_prodotti.push({ id: pid, sku: `P-${v.sku}`, slug: v.slug ?? `prodotto-${v.sku}`.toLowerCase(), nome: v.nome_prodotto ?? `Prodotto ${v.sku}`, tipo: "cura", stato: v.pubblicato === false ? "bozza" : "pubblicato", prezzo_cent: v.prezzo_cent ?? 1000 });
    t.shop_varianti.push({ id: uuid(0x7100 + i), prodotto_id: pid, sku: v.sku, nome: v.nome ?? "Unica", opzioni: {}, prezzo_cent: v.prezzo_cent ?? null, giacenza: v.giacenza, attiva: v.attiva !== false });
  });
  (spec.ordini ?? []).forEach((o) => {
    const sessioni = o.sessioni ?? [];
    t.shop_orders.push({
      ...structuredClone(COLONNE_S4),
      id: o.id, order_ref: o.ref, created_at: adesso(), status: "nuovo", stato_pagamento: "in_attesa", canale: "sito", totale_cent: o.totale_cent,
      scade_il: o.scade_il ?? "2026-11-20T12:31:00.000Z", stripe_sessione_id: sessioni.at(-1) ?? null,
      email: "cliente0@example.com", nome: "Anna", cognome: "Esempio", total: o.totale_cent / 100, subtotal: o.totale_cent / 100, shipping: 0,
      items: (o.righe ?? []).map((r) => ({ product_id: r.sku, name: `Prodotto ${r.sku}`, slug: r.sku.toLowerCase(), qty: r.qty, unit_price: (r.prezzo_cent ?? o.totale_cent) / 100, variant: null })),
      ...(o.campi ?? {}),
    });
    t.shop_ordini_riservati.push({ ordine_id: o.id, fattura: null, attribuzione: null, consensi: { termini: true, privacy: true }, ip: null, user_agent: null });
    for (const s of sessioni) t.shop_stripe_sessioni.push({ sessione_id: s, ordine_id: o.id, creata_il: adesso(), scade_il: o.scade_il ?? "2026-11-20T12:31:00.000Z", stato: "aperta" });
  });
  t.shop_spedizioni_tariffe = structuredClone(spec.tariffe ?? []);
  t.shop_email_modelli = structuredClone(spec.modelli ?? []);
  t.shop_limiti = structuredClone(spec.limiti ?? []);
  return t;
}

// ── semi di S5 e S6 ──────────────────────────────────────────────────────────

/** Il seme di S5: «Spedizione tracciata in Italia», 4,90 €, attiva, provvisoria (id fisso: `ON CONFLICT (id) DO NOTHING`). */
export const ID_TARIFFA_SEME = uuid(0x8001);
export const tariffaSeme = (extra = {}) => ({
  id: ID_TARIFFA_SEME, paese: "IT", nome: "Spedizione tracciata in Italia", corriere: null, costo_cent: 490, gratis_da_cent: null,
  giorni_min: null, giorni_max: null, attiva: true, provvisoria: true, confermata_il: null,
  creato_il: "2026-11-20T10:00:00.000Z", aggiornato_il: "2026-11-20T10:00:00.000Z", ...extra,
});
/** Le cinque righe seme di S6: tutte spente, tutte col segnaposto, nessuna approvata. */
export const modelliEmailSeme = () =>
  CHIAVI_EMAIL.map((chiave) => ({
    chiave, oggetto: `{{da confermare}} (${chiave})`, testo: `{{da confermare}}: testo di ${chiave}`, acceso: false,
    approvato_da: null, approvato_il: null, approvato_hash: null, aggiornato_il: "2026-11-20T10:00:00.000Z",
  }));

// ── cose di Stripe, finte ────────────────────────────────────────────────────

/** Una sessione di Checkout come la restituisce Stripe (i campi che il codice legge). Id finto, nessun dato vero. */
export const sessioneStripeProva = (extra = {}) => ({
  id: "cs_test_prova0000000001", object: "checkout.session", status: "open", payment_status: "unpaid", livemode: false, mode: "payment",
  client_reference_id: uuid(0x6001), amount_total: 2890, currency: "eur", payment_intent: null, expires_at: 1795264260,
  url: "https://checkout.stripe.com/c/pay/cs_test_prova0000000001", metadata: { ordine_id: uuid(0x6001) }, ...extra,
});
/** Un rimborso come lo restituisce Stripe. */
export const rimborsoStripeProva = (extra = {}) => ({
  id: "re_prova0000000001", object: "refund", amount: 1000, currency: "eur", status: "succeeded", payment_intent: "pi_prova0000000001",
  metadata: {}, created: 1795260000, ...extra,
});
/** Un evento del webhook (forma di Stripe). */
export const eventoStripeProva = (tipo, oggetto, extra = {}) => ({
  id: "evt_prova0000000001", object: "event", type: tipo, livemode: false, created: 1795260000, data: { object: oggetto }, ...extra,
});
