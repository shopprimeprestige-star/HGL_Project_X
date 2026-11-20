/*  ── COSTRUIRE UN EVENTO PER META, TIKTOK E GOOGLE (modulo puro) ───────────────
    Shop R1 · T24 · PIANO §3.4, tabella §1.9. Da un nome interno e dai dati del sito si ottiene, per ogni
    piattaforma, il nome e i parametri. Niente rete, niente DOM: lo usano il browser (T26) e il server (T25),
    così i due mandano le stesse cifre con lo stesso `event_id` (deduplica).

    ⚠️ `value` entra in CENTESIMI (interi) ed esce in EURO. Un valore non valido non si manda (e senza
       `value` non si manda nemmeno `currency`): meglio un evento senza cifra che una cifra sbagliata.
    ⚠️ Un nome fuori dalla mappa (e quindi ogni nome d'acquisto) non si costruisce: `null`. */
import { MAPPA_NOMI, NOMI_EVENTO, type NomeEvento } from "./nomi";

export type DatiEvento = {
  contentIds?: string[];
  contentName?: string;
  contentType?: "product" | "product_group";
  valueCent?: number;
  numItems?: number;
  searchString?: string;
  categoria?: string;
};
export type ContestoEvento = { eventId?: string };
export type EventoPiattaforma = { nome: string; eventId: string; parametri: Record<string, unknown> };
export type EventoGoogle = { nome: string; parametri: Record<string, unknown> };
export type EventoCostruito = { meta: EventoPiattaforma | null; tiktok: EventoPiattaforma | null; ga4: EventoGoogle };

/** Quanti prodotti al massimo in un evento (un carrello non ne ha di più). */
const MAX_PRODOTTI = 50;
const MAX_TESTO = 100;
/** Gli eventi che non hanno senso senza almeno un prodotto. */
const CON_PRODOTTI: readonly NomeEvento[] = ["ViewContent", "AddToCart", "RemoveFromCart", "ViewCart", "InitiateCheckout", "AddShippingInfo", "AddPaymentInfo"];

export function creaEventId(): string {
  return crypto.randomUUID();
}

/** Gli id dei prodotti: solo testi non vuoti, senza spazi ai bordi e senza doppioni, al massimo 50. */
function puliscoIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const fuori = ids.filter((i): i is string => typeof i === "string").map((i) => i.trim()).filter(Boolean);
  return [...new Set(fuori)].slice(0, MAX_PRODOTTI);
}

/** Un evento che parla di prodotti ma non ne ha: non si manda (a Meta sporcherebbe il catalogo).
 *  Eccezione: la lista (`ViewContent` di tipo `product_group`, es. /shop) può non avere id: è la pagina, non un prodotto. */
export function contenutiVuoti(nome: string, dati?: DatiEvento): boolean {
  if (nome === "ViewContent" && dati?.contentType === "product_group") return false;
  return (CON_PRODOTTI as readonly string[]).includes(nome) && puliscoIds(dati?.contentIds).length === 0;
}

/** Il testo di una ricerca, ma non se somiglia a un'email o a un telefono (otto cifre o più, o una chiocciola). */
function testoRicerca(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.trim().slice(0, MAX_TESTO);
  return !t || t.includes("@") || t.replace(/\D/g, "").length >= 8 ? "" : t;
}

const testo = (s: unknown): string => (typeof s === "string" ? s.trim().slice(0, MAX_TESTO) : "");

export function costruisciEvento(nome: string, dati?: DatiEvento, contesto?: ContestoEvento): EventoCostruito | null {
  if (!(NOMI_EVENTO as readonly string[]).includes(nome)) return null;
  const n = nome as NomeEvento;
  if (contenutiVuoti(n, dati)) return null;
  const mappa = MAPPA_NOMI[n];
  const eventId = contesto?.eventId || creaEventId();

  const ids = puliscoIds(dati?.contentIds);
  const tipo = dati?.contentType === "product_group" ? "product_group" : "product";
  const euro = Number.isInteger(dati?.valueCent) && (dati?.valueCent as number) >= 0 ? (dati?.valueCent as number) / 100 : null;
  const articoli = Number.isInteger(dati?.numItems) && (dati?.numItems as number) > 0 ? (dati?.numItems as number) : null;
  const ricerca = testoRicerca(dati?.searchString);
  const nomeProdotto = testo(dati?.contentName);
  const categoria = testo(dati?.categoria);

  const meta: Record<string, unknown> = {};
  const tiktok: Record<string, unknown> = {};
  const ga4: Record<string, unknown> = {};
  if (ids.length) {
    meta.content_ids = ids;
    tiktok.contents = ids.map((id) => ({ content_id: id, content_type: tipo }));
  }
  if (ids.length || (n === "ViewContent" && tipo === "product_group")) {
    meta.content_type = tipo;
    tiktok.content_type = tipo;
  }
  if (nomeProdotto) meta.content_name = nomeProdotto;
  if (categoria) {
    meta.content_category = categoria;
    if (n === "ViewContent" && tipo === "product_group") ga4.item_list_name = categoria;
  }
  if (euro !== null) {
    for (const p of [meta, tiktok, ga4]) {
      p.currency = "EUR";
      p.value = euro;
    }
  }
  if (ids.length) ga4.items = ids.map((id) => ({ item_id: id })); // come nella documentazione di Google: currency, value, items
  if (articoli !== null) meta.num_items = articoli;
  if (ricerca) {
    meta.search_string = ricerca;
    tiktok.query = ricerca;
    ga4.search_term = ricerca;
  }

  const nomeGa4 = n === "ViewContent" && tipo === "product_group" && mappa.ga4Lista ? mappa.ga4Lista : mappa.ga4;
  return {
    meta: { nome: mappa.meta, eventId, parametri: meta },
    tiktok: mappa.tiktok ? { nome: mappa.tiktok, eventId, parametri: tiktok } : null,
    ga4: { nome: nomeGa4, parametri: ga4 },
  };
}
