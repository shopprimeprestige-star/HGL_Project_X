/** ── L'ORDINE DELL'E-COMMERCE, COME LO LEGGE IL CRM ────────────────────────
 *  Commessa 2026-11-17-crm-ecommerce (T3). Modulo PURO: niente React, niente database.
 *  Rilascio 2 (T46): l'ordine guadagna i campi di pagamento, spedizione, fattura, avvisi (colonne di S4). Ogni campo nuovo ha un valore
 *  sano se la colonna manca o è sporca (prima di S4, o con i default di S4, l'ordine si legge identico a prima). Nessun campo di prima cambia.
 *
 *  `shop_orders` è scritta dal checkout (un cliente qualunque) e, dalla migrazione M1, anche dal
 *  CRM. Una riga può quindi avere `items` nullo, prezzi in stringa, uno stato che non esiste, un
 *  testo enorme. Qui si traduce ogni riga in un `Ordine` SEMPRE sano: mai `NaN`, mai eccezioni, tutto
 *  con un tetto. Una riga senza id o senza data valida non si può mostrare né aggiornare: è uno
 *  scarto, e `normalizzaTutti` lo CONTA, così la pagina può dirlo invece di far sparire l'ordine.
 *
 *  I nomi delle colonne nuove (lead_id, senza_lead, pagato_il, …) vengono da PIANO §3.1: questo file
 *  non dipende da `types.ts`. Prima della migrazione sono `null` e l'ordine si legge lo stesso. */

import { eStatoPagamento, type StatoPagamento } from "./pagamento";

export type StatoOrdine = "nuovo" | "in_preparazione" | "spedito" | "consegnato" | "annullato";
export const STATI_ORDINE: readonly StatoOrdine[] = ["nuovo", "in_preparazione", "spedito", "consegnato", "annullato"];
export const ETICHETTA_STATO: Record<StatoOrdine, string> = {
  nuovo: "Nuovo",
  in_preparazione: "In preparazione",
  spedito: "Spedito",
  consegnato: "Consegnato",
  annullato: "Annullato",
};

export type MetodoPagamento = "bonifico" | "contanti" | "carta" | "altro" | "stripe";
export const ETICHETTA_METODO: Record<MetodoPagamento, string> = {
  bonifico: "Bonifico",
  contanti: "Contanti",
  carta: "Carta",
  altro: "Altro",
  stripe: "Stripe",
};

export interface RigaOrdine {
  prodottoId: string | null;
  nome: string;
  slug: string | null;
  variante: string | null;
  qty: number;
  prezzo: number;
}

/** Un avviso sull'ordine (colonna `avvisi`, scritta dalle funzioni SQL): `gravita` è «rosso» o «giallo», `rif` l'oggetto a cui si riferisce (sessione, rimborso…). */
export interface AvvisoOrdine {
  codice: string;
  gravita: string;
  rif: string | null;
  il: string | null;
}
/** Com'è andata una email dell'ordine (colonna `email_inviate`, chiave = nome del modello): `stato` è «in_invio», «inviata» o «errore». */
export interface EmailOrdine {
  stato: string;
  il: string | null;
  codice: string | null;
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

  // ── Rilascio 2 (S4): tutto «sano» se la colonna manca. Gli hash della chiave pubblica e della firma del tentativo NON si leggono qui. ──
  /** La colonna `stato_pagamento` se è uno dei sette stati, altrimenti `null`: lo stato si deduce in `statoPagamentoDi` (pagamento.ts). */
  statoPagamento: StatoPagamento | null;
  stripeSessioneId: string | null;
  stripePagamentoId: string | null;
  metodoDettaglio: string | null;
  /** Ordine di prova (Stripe in modalità di prova): non entra nelle cifre (D58). */
  prova: boolean;
  /** «sito» per gli ordini della cassa nuova. */
  canale: string | null;
  /** Il totale in centesimi interi (D50); `null` per gli ordini di prima. */
  totaleCent: number | null;
  /** Rimborsato finora, in centesimi interi; 0 se niente o illeggibile. */
  rimborsatoCent: number;
  scadeIl: string | null;
  riprovaN: number;
  provincia: string | null;
  nazione: string | null;
  giacenzaDaVerificare: boolean;
  giacenzaScalataIl: string | null;
  giacenzaRimessaIl: string | null;
  speditoIl: string | null;
  corriere: string | null;
  trackingUrl: string | null;
  senzaTracking: boolean;
  annulloMotivo: string | null;
  annullatoIl: string | null;
  fatturaRichiesta: boolean;
  fatturaEmessaIl: string | null;
  fatturaNota: string | null;
  emailInviate: Record<string, EmailOrdine>;
  avvisi: AvvisoOrdine[];
}

/** Oltre questo numero di righe d'ordine si tengono le prime e si dichiara `righeTroncate`. */
export const MAX_RIGHE = 200;
/** Quanti ordini si leggono al massimo dalla tabella (la rotta si ferma qui e dichiara `troncato`; la pagina lo scrive nell'avviso). */
export const MAX_ORDINI_LETTI = 20_000;
/** Tetto di ogni testo letto. shortcut: un solo tetto per tutti i campi, largo per le note; da dividere se un campo ne chiede uno suo. */
export const MAX_TESTO = 5000;

export { chiaveTelefono } from "../telefono-doppio";
/** Le domande sul pagamento che servono ai conti: si esportano da qui perché `conti.ts` importa SOLO da «./ordine» (la prova `ecommerce/conti` lo esige). Il codice sta in `pagamento.ts`. */
export { contaComeLavoro, contaNelleCifre, puoLavorare, statoEffettivo, statoPagamentoDi } from "./pagamento";

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

/** Intero non negativo e «sicuro» (centesimi, contatori), altrimenti `null`: negativi, frazioni tagliate, enormi e illeggibili non passano. */
function interoOnull(v: unknown): number | null {
  const n = numero(v);
  if (n === null || n < 0) return null;
  const i = Math.floor(n);
  return Number.isSafeInteger(i) ? i : null;
}

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
/** Quanti avvisi e quante email si tengono (le colonne sono jsonb scritte dal server, ma la tabella non lo garantisce). */
const MAX_AVVISI = 50;
const MAX_EMAIL = 20;

function leggiAvvisi(v: unknown): AvvisoOrdine[] {
  const fuori: AvvisoOrdine[] = [];
  for (const a of Array.isArray(v) ? v : []) {
    if (fuori.length >= MAX_AVVISI) break;
    const codice = eOggetto(a) ? testo(a.codice, 100) : "";
    if (eOggetto(a) && codice) fuori.push({ codice, gravita: testo(a.gravita, 20) || "giallo", rif: testoOnull(a.rif), il: data(a.il) });
  }
  return fuori;
}

function leggiEmail(v: unknown): Record<string, EmailOrdine> {
  const fuori: Record<string, EmailOrdine> = {};
  if (!eOggetto(v)) return fuori;
  for (const [k, e] of Object.entries(v).slice(0, MAX_EMAIL)) {
    const stato = eOggetto(e) ? testo(e.stato, 40) : "";
    if (eOggetto(e) && stato) fuori[testo(k, 100)] = { stato, il: data(e.il), codice: testoOnull(e.codice) };
  }
  return fuori;
}

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

    statoPagamento: eStatoPagamento(testo(riga.stato_pagamento, 100).toLowerCase()) ? (testo(riga.stato_pagamento, 100).toLowerCase() as StatoPagamento) : null,
    stripeSessioneId: testoOnull(riga.stripe_sessione_id),
    stripePagamentoId: testoOnull(riga.stripe_pagamento_id),
    metodoDettaglio: testoOnull(riga.metodo_dettaglio),
    prova: riga.prova === true,
    canale: testoOnull(riga.canale),
    totaleCent: interoOnull(riga.totale_cent),
    rimborsatoCent: interoOnull(riga.rimborsato_cent) ?? 0,
    scadeIl: data(riga.scade_il),
    riprovaN: interoOnull(riga.riprova_n) ?? 0,
    provincia: testoOnull(riga.provincia),
    nazione: testoOnull(riga.nazione),
    giacenzaDaVerificare: riga.giacenza_da_verificare === true,
    giacenzaScalataIl: data(riga.giacenza_scalata_il),
    giacenzaRimessaIl: data(riga.giacenza_rimessa_il),
    speditoIl: data(riga.spedito_il),
    corriere: testoOnull(riga.corriere),
    trackingUrl: testoOnull(riga.tracking_url),
    senzaTracking: riga.senza_tracking === true,
    annulloMotivo: testoOnull(riga.annullo_motivo),
    annullatoIl: data(riga.annullato_il),
    fatturaRichiesta: riga.fattura_richiesta === true,
    fatturaEmessaIl: data(riga.fattura_emessa_il),
    fatturaNota: testoOnull(riga.fattura_nota),
    emailInviate: leggiEmail(riga.email_inviate),
    avvisi: leggiAvvisi(riga.avvisi),
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
