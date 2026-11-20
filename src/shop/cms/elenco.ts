/** ── ELENCO, CATEGORIA E RICERCA DELLO SHOP: LE REGOLE CHE SI PROVANO SENZA BROWSER ─
 *  Commessa 2026-11-20-shop-completo (T19). Modulo PURO: niente React, niente rete, niente `window`.
 *  Lo usano `src/routes/shop.index.tsx`, `src/routes/shop.c.$slug.tsx` e `GrigliaProdotti.tsx`.
 *
 *  ⚠️ Gli eventi di navigazione non portano dati personali: il testo cercato esce SOLO se non somiglia a un'email o a un
 *   telefono (`testoDaCercare`), e non entra mai nell'indirizzo della pagina (la ricerca è nella pagina, non nell'URL).
 *  ⚠️ Invisible Derm non ha mai un prezzo nello shop (decisione del titolare, 20/11, D39): il server lo manda già con `prezzoCent: null`;
 *   qui `senzaPrezzo` copre sia il prezzo nullo sia il nome (`eInvisibleDerm`). All'integrazione (T32) il nome lo riconosce la
 *   funzione di `pubblico.ts`. */
import type { CategoryKey, Product } from "../catalog";
import type { DatiEvento } from "../../lib/tracciamento/eventi";
import { daPubblicoAProdotto, skuDaCodice } from "./adattatore";
import type { SnapRiga } from "./carrello";
import type { ProdottoPubblico } from "./modello";

/** Quanto si aspetta, dopo l'ultimo tasto, prima di contare la ricerca. */
export const PAUSA_RICERCA_MS = 1000;
const MAX_TESTO_RICERCA = 80;
/** Quanto si aspetta, dopo la scelta sul banner, prima di rifare un evento di pagina (vedi `suScelta`). */
export const ATTESA_DOPO_SCELTA_MS = 2000;
/** Da quante cifre in poi un testo somiglia a un telefono o a un numero d'ordine, e non esce. */
const CIFRE_DA_NON_MANDARE = 6;

/** Una scheda dell'elenco: il `Product` che le pagine di oggi disegnano, e (solo con il catalogo CMS) il prodotto del server. */
export interface VoceElenco {
  product: Product;
  pubblico?: ProdottoPubblico;
}

export const vociDaCodice = (prodotti: readonly Product[]): VoceElenco[] => prodotti.map((product) => ({ product }));
export const vociDaPubblici = (pubblici: readonly ProdottoPubblico[]): VoceElenco[] => pubblici.map((p) => ({ product: daPubblicoAProdotto(p), pubblico: p }));

/** Il filtro di oggi: per categoria e per testo (nome, riga breve, descrizione), senza maiuscole. Non cambia l'ordine. */
export function filtraVoci(voci: readonly VoceElenco[], categoria: CategoryKey | "all", testo: string): VoceElenco[] {
  const q = testo.trim().toLowerCase();
  return voci.filter(({ product: p }) => {
    if (categoria !== "all" && p.category !== categoria) return false;
    if (q && !`${p.name} ${p.short} ${p.description}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Il nome «Invisible Derm» (anche «Protocol®», maiuscole e spazi doppi): per lui lo shop non mostra mai un prezzo. */
export const eInvisibleDerm = (nome: unknown): boolean => typeof nome === "string" && /invisible[\s\-_]*derm/i.test(nome);

/** Il prezzo arriva come numero? (Il server, per Invisible Derm, manda `null`.) */
const eNumero = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Questa scheda non mostra un prezzo: Invisible Derm (per nome) o un prodotto del CMS a cui il server non ha dato nessun prezzo. */
export const senzaPrezzo = (v: VoceElenco): boolean => eInvisibleDerm(v.product.name) || (!!v.pubblico && !(eNumero(v.pubblico.prezzoDaCent) && v.pubblico.varianti.some((x) => eNumero(x.prezzoCent))));

/** Il conteggio sopra la griglia: «1 articolo», «5 articoli». */
export const etichettaArticoli = (n: number): string => `${n} ${n === 1 ? "articolo" : "articoli"}`;

/** La frase quando la ricerca non trova niente. Con il catalogo CMS è quella del Copywriter (documento, §3.13). */
export const frasaSenzaRisultati = (testo: string, cms: boolean): string =>
  cms ? `Non troviamo “${testo}”. Prova con un'altra parola, o chiedici aiuto.` : `Nessun prodotto trovato per «${testo}».`;

/** Cosa si mette nel carrello da una scheda dell'elenco con un clic: SOLO un prodotto del CMS con una sola variante, disponibile,
 *  senza opzioni da scegliere. Altrimenti `null` (si va alla scheda). */
export function daAggiungereDalCard(v: VoceElenco): { sku: string; snap: SnapRiga } | null {
  const p = v.pubblico;
  if (!p || p.opzioni.length > 0 || p.varianti.length !== 1 || !p.varianti[0].disponibile) return null;
  const x = p.varianti[0];
  if (!eNumero(x.prezzoCent)) return null; // senza prezzo (D39) non si compra dalla scheda dell'elenco
  return { sku: x.sku, snap: { nome: p.nome, slug: p.slug, prezzoCent: x.prezzoCent, foto: p.media.find((m) => m.slot === "principale")?.src ?? null, varianteNome: Object.keys(x.opzioni).length ? x.nome : null } };
}

/** `true` se questo prodotto del CMS ha più prezzi diversi fra le sue varianti (allora il prezzo mostrato è «Da …»). */
export const haPrezziDiversi = (p: ProdottoPubblico | undefined): boolean => !!p && new Set(p.varianti.map((v) => v.prezzoCent).filter(eNumero)).size > 1;

/* ── gli eventi ───────────────────────────────────────────────────────── */

/** Il testo di una ricerca da contare, o `null` se non si deve contare: vuoto, una lettera sola, con una chiocciola o con sei cifre o più. */
export function testoDaCercare(q: unknown): string | null {
  if (typeof q !== "string") return null;
  const t = q.replace(/\s+/g, " ").trim().slice(0, MAX_TESTO_RICERCA).trim();
  if (t.length < 2 || t.includes("@") || t.replace(/\D/g, "").length >= CIFRE_DA_NON_MANDARE) return null;
  return t;
}

/** I dati di `ViewContent` per una lista (`product_group`): gli SKU dei prodotti mostrati (quello del CMS, o `HG-…` per il vecchio
 *  catalogo) e il nome della categoria. `null` se non c'è niente da dire: un elenco senza prodotti non si conta. */
export function datiListaVisualizzata(voci: readonly VoceElenco[], categoria?: string): DatiEvento | null {
  const skus = voci.map((v) => v.pubblico?.sku ?? skuDaCodice(v.product.id)).filter(Boolean);
  if (skus.length === 0) return null;
  return { contentType: "product_group", contentIds: skus, ...(categoria ? { categoria } : {}) };
}

/** Emette `emetti` una volta sola per visita (un archivio di sessione) e per chiave. Se l'evento non parte (`null`: niente
 *  consenso) non si segna: alla visita dopo si riprova. Un archivio che non risponde non ferma l'evento. */
export function emettiUnaVolta(archivio: Pick<Storage, "getItem" | "setItem"> | null, chiave: string, emetti: () => string | null): void {
  const k = `hg_vc_lista:${chiave}`;
  try {
    if (archivio?.getItem(k)) return;
  } catch {
    /* archivio non leggibile: si emette lo stesso */
  }
  if (!emetti()) return;
  try {
    archivio?.setItem(k, "1");
  } catch {
    /* non si segna: pazienza */
  }
}

interface Orologio<T> {
  set: (f: () => void, ms: number) => T;
  clear: (id: T) => void;
}

const OROLOGIO_VERO: Orologio<ReturnType<typeof setTimeout>> = { set: (f, ms) => setTimeout(f, ms), clear: (id) => clearTimeout(id) };

/** Dopo la scelta sul banner dei cookie il provider carica i pixel (prima legge se è un amministratore e la configurazione):
 *  si aspetta un poco e poi si rifà `azione`. Così `ViewContent` parte anche se il banner si accetta DOPO il caricamento della pagina.
 *  Ritorna la funzione che toglie l'ascolto e l'attesa. Due scelte vicine = una sola azione.
 *  shortcut: attesa fissa di 2 s (il provider non dice «pronto»); se i pixel non sono ancora pronti l'evento va comunque al server
 *  (il consenso c'è), si cambia se il provider espone un segnale di fine caricamento. */
export function suScelta<T = ReturnType<typeof setTimeout>>(
  ascolta: Pick<EventTarget, "addEventListener" | "removeEventListener">,
  evento: string,
  azione: () => void,
  attesaMs = ATTESA_DOPO_SCELTA_MS,
  orologio: Orologio<T> = OROLOGIO_VERO as unknown as Orologio<T>,
): () => void {
  let attesa: T | undefined;
  const ferma = () => {
    if (attesa !== undefined) orologio.clear(attesa);
    attesa = undefined;
  };
  const sentito = () => {
    ferma();
    attesa = orologio.set(() => {
      attesa = undefined;
      azione();
    }, attesaMs);
  };
  ascolta.addEventListener(evento, sentito);
  return () => {
    ferma();
    ascolta.removeEventListener(evento, sentito);
  };
}

/** La ricerca da contare: dopo una pausa di 1 secondo dall'ultimo tasto, o subito con Invio. Lo stesso testo non si ripete. */
export function creaEmettitoreRicerca<T = ReturnType<typeof setTimeout>>(
  emetti: (testo: string) => void,
  orologio: Orologio<T> = OROLOGIO_VERO as unknown as Orologio<T>,
  pausaMs = PAUSA_RICERCA_MS,
) {
  let ultimo = "";
  let attesa: T | undefined;
  const ferma = () => {
    if (attesa !== undefined) orologio.clear(attesa);
    attesa = undefined;
  };
  const invia = (q: string) => {
    const t = testoDaCercare(q);
    if (!t || t === ultimo) return;
    ultimo = t;
    try {
      emetti(t);
    } catch {
      /* un conteggio perso non rompe la pagina */
    }
  };
  return {
    scrivi(q: string) {
      ferma();
      attesa = orologio.set(() => invia(q), pausaMs);
    },
    invio(q: string) {
      ferma();
      invia(q);
    },
    ferma,
  };
}
