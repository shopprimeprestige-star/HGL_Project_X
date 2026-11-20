/** ── DATI INVENTATI PER LE PROVE DELL'E-COMMERCE ───────────────────────────
 *  ⚠️ Nomi di fantasia, numeri `+39 300 000xxxx`, indirizzi `@example.com`.
 *   Mai nomi, telefoni, email o indirizzi veri, in nessuna prova di questa cartella. */

/** I campi del modulo del checkout, già compilati con dati finti. */
export const formProva = (extra = {}) => ({
  nome: "Anna",
  cognome: "Esempio",
  email: "anna.esempio@example.com",
  telefono: "+39 300 000 0001",
  indirizzo: "Via Inventata 1",
  citta: "Cittàfinta",
  cap: "00000",
  note: "",
  ...extra,
});

/** Le righe del carrello come le manda il checkout (`items`). */
export const itemsProva = (extra = []) => [
  { product_id: "prodotto-uno", name: "Prodotto di prova", slug: "prodotto-di-prova", qty: 1, unit_price: 20, variant: null },
  ...extra,
];

/** Un ordine come lo leggerà il CRM (forma di `shop_orders`), per i compiti che seguono. */
export const rigaOrdineProva = (extra = {}) => ({
  id: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-11-17T10:00:00.000Z",
  order_ref: "HG-PROVA1",
  ...formProva(),
  items: itemsProva(),
  subtotal: 20,
  shipping: 4.9,
  total: 24.9,
  status: "nuovo",
  ...extra,
});

/** Una scheda lead di fantasia, per i compiti che seguono. */
export const leadProva = (extra = {}) => ({
  id: "00000000-0000-4000-8000-0000000000a1",
  created_at: "2026-11-01T09:00:00.000Z",
  data: { nome: "Bruno", cognome: "Prova", telefono: "+39 300 000 0002", email: "bruno.prova@example.com", stato: "da_contattare" },
  ...extra,
});
