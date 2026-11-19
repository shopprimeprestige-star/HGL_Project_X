/** ── L'ORDINE DELL'E-COMMERCE, COME LO LEGGE IL CRM ────────────────────────
 *  Commessa 2026-11-17-crm-ecommerce (T3). Modulo PURO: niente React, niente database.
 *
 *  `shop_orders` è scritta dal checkout (un cliente qualunque) e, dalla migrazione M1, anche dal
 *  CRM. Una riga può quindi avere `items` nullo, prezzi in stringa, uno stato che non esiste, un
 *  testo enorme. Qui si traduce ogni riga in un `Ordine` SEMPRE sano: mai `NaN`, mai eccezioni, tutto
 *  con un tetto. Una riga senza id o senza data valida non si può mostrare né aggiornare: è uno
 *  scarto, e `normalizzaTutti` lo CONTA, così la pagina può dirlo invece di far sparire l'ordine.
 *
 *  I nomi delle colonne nuove (lead_id, senza_lead, pagato_il, …) vengono da PIANO §3.1: questo file
 *  non dipende da `types.ts`. Prima della migrazione sono `null` e l'ordine si legge lo stesso. */

export type StatoOrdine = "nuovo" | "in_preparazione" | "spedito" | "consegnato" | "annullato";
export const STATI_ORDINE: readonly StatoOrdine[] = ["nuovo", "in_preparazione", "spedito", "consegnato", "annullato"];
export const ETICHETTA_STATO: Record<StatoOrdine, string> = {
  nuovo: "Nuovo",
  in_preparazione: "In preparazione",
  spedito: "Spedito",
  consegnato: "Consegnato",
  annullato: "Annullato",
};

export type MetodoPagamento = "bonifico" | "contanti" | "carta" | "altro";
export const ETICHETTA_METODO: Record<MetodoPagamento, string> = {
  bonifico: "Bonifico",
  contanti: "Contanti",
  carta: "Carta",
  altro: "Altro",
};

export interface RigaOrdine {
  prodottoId: string | null;
  nome: string;
  slug: string | null;
  variante: string | null;
  qty: number;
  prezzo: number;
}

export interface Ordine {
  id: string;
  ref: string;
  creatoIl: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  indirizzo: string;
  citta: string;
  cap: string;
  note: string | null;
  righe: RigaOrdine[];
  /** Le righe erano più di `MAX_RIGHE`: se ne tengono le prime. Gli importi restano quelli veri. */
  righeTroncate: boolean;
  subtotale: number;
  spedizione: number;
  totale: number;
  stato: StatoOrdine;
  /** Lo stato com'è scritto in tabella (utile se è uno che non conosciamo). */
  statoGrezzo: string;
  leadId: string | null;
  senzaLead: boolean;
  pagatoIl: string | null;
  pagatoImporto: number | null;
  metodoPagamento: MetodoPagamento | null;
  tracking: string | null;
  noteInterne: string | null;
  aggiornatoIl: string | null;
}

/** Oltre questo numero di righe d'ordine si tengono le prime e si dichiara `righeTroncate`. */
export const MAX_RIGHE = 200;
/** Quanti ordini si leggono al massimo dalla tabella (la rotta si ferma qui e dichiara `troncato`; la pagina lo scrive nell'avviso). */
export const MAX_ORDINI_LETTI = 20_000;
/** Quanti ordini si leggono al massimo dalla tabella (la rotta si ferma qui e dichiara `troncato`; la pagina lo scrive nell'avviso). */
export const MAX_ORDINI_LETTI = 20_000;
/** Tetto di ogni testo letto. shortcut: un solo tetto per tutti i campi, largo per le note; da dividere se un campo ne chiede uno suo. */
export const MAX_TESTO = 5000;

export { chiaveTelefono } from "../telefono-doppio";

// ── piccoli lettori (nessuno lancia) ───────────────────────────────────────

const eOggetto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Testo con tetto, senza spazi ai bordi. Non-testo → "". */
const testo = (v: unknown, max = MAX_TESTO): string => (typeof v === "string" ? v.slice(0, max).trim() : "");
const testoOnull = (v: unknown): string | null => testo(v) || null;

/** Numero finito se leggibile (numero o stringa «12.5» / «12,5»), altrimenti null. */
function numero(v: unknown): number | null {
  const t = typeof v === "string" && v.length < 40 ? v.trim().replace(",", ".") : "";
  const n = typeof v === "number" ? v : t ? Number(t) : NaN; // «» sarebbe 0: qui è illeggibile
  return Number.isFinite(n) ? n : null;
}

/** Arrotonda al centesimo; mai Infinity (con importi enormi n*100 straborda: si tiene n). */
const euro = (n: number): number => {
  const r = Math.round(n * 100) / 100;
  return Number.isFinite(r) ? r : Number.isFinite(n) ? n : 0;
};

/** Data valida (testo che il browser sa leggere) o null. */
const data = (v: unknown): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t && t.length < 64 && !Number.isNaN(Date.parse(t)) ? t : null;
};

function variante(v: unknown): string | null {
  if (typeof v === "string") return testoOnull(v);
  if (!eOggetto(v)) return null;
  const parti = Object.entries(v)
    .slice(0, 20)
    .map(([k, x]) => `${testo(k, 100)}: ${testo(typeof x === "number" ? String(x) : x, 200)}`)
    .filter((p) => !p.startsWith(": ") && !p.endsWith(": "));
  return parti.length ? parti.join(", ").slice(0, MAX_TESTO) : null;
}

function leggiRiga(v: unknown): RigaOrdine | null {
  if (!eOggetto(v)) return null;
  const prezzo = numero(v.unit_price);
  const qty = numero(v.qty);
  const q = qty !== null && qty > 0 ? Math.floor(qty) : 0;
  const pz = prezzo !== null && prezzo > 0 ? prezzo : 0;
  const finito = Number.isFinite(q * pz); // 1e308 × 1e308 sarebbe Infinity: la riga vale 0
  return {
    prodottoId: testoOnull(v.product_id),
    nome: testo(v.name) || "Prodotto senza nome",
    slug: testoOnull(v.slug),
    variante: variante(v.variant),
    qty: finito ? q : 0,
    prezzo: finito ? pz : 0,
  };
}

const METODI: readonly string[] = Object.keys(ETICHETTA_METODO);

/** Una riga di `shop_orders` → `Ordine`; `null` se manca l'id o la data non si legge. */
export function normalizzaOrdine(riga: unknown): Ordine | null {
  if (!eOggetto(riga)) return null;
  const id = testo(riga.id, 100);
  const creatoIl = data(riga.created_at);
  if (!id || !creatoIl) return null;

  // Si leggono TUTTE le righe (serve la somma se i totali mancano), se ne tengono le prime MAX_RIGHE.
  const items = Array.isArray(riga.items) ? riga.items : [];
  const righe: RigaOrdine[] = [];
  let somma = 0;
  let letti = 0; // righe valide: gli elementi scartati non contano per «troncate»
  for (const it of items) {
    const r = leggiRiga(it);
    if (!r) continue;
    const p = r.qty * r.prezzo;
    if (Number.isFinite(somma + p)) somma += p; // mai Infinity, nemmeno con tante righe enormi
    letti++;
    if (righe.length < MAX_RIGHE) righe.push(r);
  }
  somma = euro(somma);

  const spedizione = numero(riga.shipping) ?? 0;
  const subtotale = numero(riga.subtotal) ?? somma;
  const totale = numero(riga.total) ?? euro(somma + spedizione);

  const statoGrezzo = testo(riga.status, 100);
  const stato = (STATI_ORDINE as readonly string[]).includes(statoGrezzo.toLowerCase()) ? (statoGrezzo.toLowerCase() as StatoOrdine) : "nuovo";

  const metodo = testo(riga.metodo_pagamento, 100).toLowerCase();
  const pagatoImporto = numero(riga.pagato_importo);

  return {
    id,
    ref: testo(riga.order_ref, 100) || id.slice(0, 8),
    creatoIl,
    nome: testo(riga.nome),
    cognome: testo(riga.cognome),
    email: testo(riga.email),
    telefono: testo(riga.telefono),
    indirizzo: testo(riga.indirizzo),
    citta: testo(riga.citta),
    cap: testo(riga.cap),
    note: testoOnull(riga.note),
    righe,
    righeTroncate: letti > MAX_RIGHE,
    subtotale,
    spedizione,
    totale,
    stato,
    statoGrezzo,
    leadId: testoOnull(riga.lead_id),
    senzaLead: riga.senza_lead === true,
    pagatoIl: data(riga.pagato_il),
    pagatoImporto,
    metodoPagamento: !metodo ? null : METODI.includes(metodo) ? (metodo as MetodoPagamento) : "altro",
    tracking: testoOnull(riga.tracking),
    noteInterne: testoOnull(riga.note_interne),
    aggiornatoIl: data(riga.aggiornato_il),
  };
}

/** Tutte le righe; quelle che non si leggono (senza id o data) non spariscono in silenzio: si contano. */
export function normalizzaTutti(righe: unknown[]): { ordini: Ordine[]; scartati: number } {
  const ordini: Ordine[] = [];
  let scartati = 0;
  for (const r of Array.isArray(righe) ? righe : []) {
    const o = normalizzaOrdine(r);
    if (o) ordini.push(o);
    else scartati++;
  }
  return { ordini, scartati };
}

// ── piccole domande sull'ordine ────────────────────────────────────────────

export const eAnnullato = (o: Pick<Ordine, "stato">): boolean => o.stato === "annullato";
/** Incassato = c'è una data di pagamento (D7), anche se poi l'ordine è annullato. */
export const eIncassato = (o: Pick<Ordine, "pagatoIl">): boolean => o.pagatoIl !== null;
/** Quanto è entrato: l'importo scritto, altrimenti il totale dell'ordine. */
export const importoIncassato = (o: Pick<Ordine, "pagatoImporto" | "totale">): number => o.pagatoImporto ?? o.totale;
export const nomeCliente = (o: Pick<Ordine, "nome" | "cognome">): string => `${o.nome} ${o.cognome}`.trim() || "Senza nome";

/** Email come chiave di confronto: minuscola, senza spazi; vuota se non c'è una @. */
export function chiaveEmail(e?: string | null): string {
  const t = String(e ?? "").replace(/\s+/g, "").toLowerCase();
  return t.includes("@") ? t : "";
}

const TOLLERANZA = 0.011; // un centesimo, più il margine dei decimali binari

/** I conti tornano? righe = subtotale, subtotale + spedizione = totale (tolleranza di un centesimo). Con righe troncate la prima verifica non si può fare. */
export function totaleCoerente(o: Ordine): boolean {
  const righe = euro(o.righe.reduce((s, r) => s + r.qty * r.prezzo, 0));
  const righeOk = o.righeTroncate || Math.abs(righe - o.subtotale) <= TOLLERANZA;
  return righeOk && Math.abs(o.subtotale + o.spedizione - o.totale) <= TOLLERANZA;
}
