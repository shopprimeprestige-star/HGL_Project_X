/** ── IL MODELLO DEL CATALOGO (CMS), E I SUOI VALIDATORI ────────────────────
 *  Commessa 2026-11-20-shop-completo (T05). Modulo PURO: niente React, niente database, niente rete.
 *
 *  Qui stanno i tipi del catalogo (PIANO §3.1: `ProdottoPubblico` è ciò che esce al pubblico e NIENT'ALTRO),
 *  le costanti (slot dei media, limiti, tetti di lunghezza) e le regole piccole che tutti devono applicare allo
 *  stesso modo: indirizzo (slug), SKU, prezzi in centesimi, varianti generate dalle opzioni, caratteristiche.
 *
 *  ⚠️ I tipi `Prodotto`, `Variante`, `Media`, `Categoria` sono in camelCase come `ProdottoPubblico`; le righe del
 *  database (S1) sono in snake_case (`prezzo_cent`, `riga_presentazione`…): la conversione è del server
 *  (`src/crm/negozio/*.server.ts`, `src/shop/cms/pubblico.ts`), non di questo file.
 *  ⚠️ I prezzi sono SEMPRE in centesimi interi. L'euro con la virgola esiste solo a video e verso le piattaforme. */

/* ── costanti ─────────────────────────────────────────────────────────── */

/** Gli slot dei media (D30, Design §4.4.3). `campione` è la pallina di un VALORE di colore di una variante. */
export const SLOT = ["principale", "foto2", "foto3", "foto4", "foto5", "scala", "video", "confezione", "campione"] as const;
export type Slot = (typeof SLOT)[number];
export const SOTTO_RUOLI = ["retro_base", "macro_attaccatura", "colore_luce", "altro"] as const;
export type SottoRuolo = (typeof SOTTO_RUOLI)[number];

export const MAX_OPZIONI = 3;
export const MAX_COMBINAZIONI = 50;
const MAX_SLUG = 80;
const MAX_SKU = 40;

/** Il prezzo sta in un `integer` di Postgres (a 32 bit con segno): oltre non entra. */
export const MAX_CENT = 2_147_483_647;

/** Quanto può essere lungo ogni testo (Design §4.10): la schermata li mostra, il server li fa rispettare. */
export const TETTI = { riga: 90, breve: 300, alt: 125, seoTitolo: 60, seoDescrizione: 155 } as const;

/* ── tipi ─────────────────────────────────────────────────────────────── */

export type TipoProdotto = "patch" | "cura" | "kit";
export type StatoProdotto = "bozza" | "pubblicato" | "archiviato";
export type StatoCaratteristica = "confermato" | "da_confermare";

export interface Caratteristica {
  etichetta: string;
  valore: string;
  /** Una caratteristica tecnica non confermata dal titolare NON esce al pubblico. */
  stato: StatoCaratteristica;
  fonte: string | null;
}

export interface Canali {
  sito: boolean;
  meta: boolean;
  google: boolean;
  tiktok: boolean;
}

/** I campi del prodotto che si possono cambiare in «bozza di modifica» quando è già pubblicato (D27). */
export interface CampiProdotto {
  nome: string;
  tipo: TipoProdotto;
  marca: string | null;
  rigaPresentazione: string | null;
  descrizioneBreve: string;
  descrizioneLunga: string | null;
  perChi: string | null;
  caratteristiche: Caratteristica[];
  passi: string[];
  confezione: string[];
  avvertenze: string[];
  faq: { d: string; r: string }[];
  resoConsentito: boolean | null;
  resoGiorni: number | null;
  boxConsulenza: boolean;
  correlatoId: string | null;
  canali: Canali;
  seoTitolo: string | null;
  seoDescrizione: string | null;
  seoMediaId: string | null;
}

export interface Prodotto extends CampiProdotto {
  id: string;
  sku: string;
  slug: string;
  stato: StatoProdotto;
  /** `codice` = importato dal vecchio catalogo (D28); `null` = nato nel CMS. */
  origine: "codice" | null;
  prezzoCent: number;
  gtin: string | null;
  mpn: string | null;
  categoriaGoogle: string | null;
  pesoG: number | null;
  classeSpedizione: string | null;
  fornitore: string | null;
  schedaTecnicaPath: string | null;
  noteInterne: string | null;
  notaTitolare: string | null;
  bozzaModifiche: Partial<CampiProdotto> | null;
  bozzaModificataIl: string | null;
  idCodice: string | null;
  creatoIl: string;
  aggiornatoIl: string;
  pubblicatoIl: string | null;
}

export interface Variante {
  id: string;
  prodottoId: string;
  sku: string;
  nome: string;
  opzioni: Record<string, string>;
  /** `null` = vale il prezzo del prodotto (D25). */
  prezzoCent: number | null;
  giacenza: number;
  pesoG: number | null;
  attiva: boolean;
  gtin: string | null;
  ordine: number;
}

export interface Media {
  id: string;
  prodottoId: string | null;
  categoriaId: string | null;
  /** Solo per lo slot `campione`. */
  varianteId: string | null;
  slot: Slot;
  sottoRuolo: SottoRuolo | null;
  tipo: "foto" | "video";
  path480: string | null;
  path960: string | null;
  path1600: string | null;
  pathVideo: string | null;
  pathCopertina: string | null;
  durataS: number | null;
  alt: string;
  testoParlato: string | null;
  sottotitoliOk: boolean;
  muto: boolean;
  ritraePersone: boolean;
  liberatoriaOk: boolean;
  valoreOpzione: string | null;
  ordine: number;
  rimossoIl: string | null;
}

export interface Categoria {
  id: string;
  slug: string;
  nome: string;
  tipo: "categoria" | "collezione";
  frase: string | null;
  fotoPath: string | null;
  seoTitolo: string | null;
  seoDescrizione: string | null;
  ordine: number;
  visibile: boolean;
  pubblicataIl: string | null;
}

/** Un'immagine quadrata nelle tre misure. */
export interface SrcFoto {
  w480: string;
  w960: string;
  w1600: string;
}

/** Ciò che il pubblico può vedere di un prodotto (PIANO §3.1). **Mai** altri campi: c'è una prova che controlla chiave per chiave. */
export interface ProdottoPubblico {
  sku: string;
  slug: string;
  nome: string;
  marca: string | null;
  tipo: TipoProdotto;
  rigaPresentazione: string | null;
  descrizioneBreve: string;
  descrizioneLunga: string | null;
  perChi: string | null;
  /** Solo quelle con stato «confermato». */
  caratteristiche: { etichetta: string; valore: string }[];
  passi: string[];
  confezione: string[];
  avvertenze: string[];
  faq: { d: string; r: string }[];
  categorie: { slug: string; nome: string }[];
  media: {
    id: string;
    slot: Exclude<Slot, "campione">;
    sottoRuolo: SottoRuolo | null;
    alt: string;
    ordine: number;
    src: SrcFoto | null;
    video: string | null;
    copertina: string | null;
    testoParlato: string | null;
    muto: boolean;
  }[];
  opzioni: { nome: string; valori: { valore: string; campione: { w480: string } | null }[] }[];
  /** `prezzoCent` è `null` per Invisible Derm (D39): quel prezzo non lascia mai il server. */
  varianti: { sku: string; nome: string; opzioni: Record<string, string>; prezzoCent: number | null; disponibile: boolean }[];
  /** `null` per Invisible Derm (D39): il costo si vede in consulenza. */
  prezzoDaCent: number | null;
  /** `false` per Invisible Derm (D39): si mostra la scheda, non si compra. */
  acquistabile: boolean;
  reso: { consentito: boolean | null; giorni: number | null };
  boxConsulenza: boolean;
  /** «Ti serve anche». `sku`, `prezziDiversi` e `aggiungibile` sono quelli della card del collegato (`cardDaPubblico`): `aggiungibile` = si compra con
   *  un clic, e solo allora `sku` è lo SKU dell'unica variante (altrimenti `null`). */
  correlato: { slug: string; nome: string; prezzoDaCent: number | null; foto: SrcFoto | null; sku: string | null; prezziDiversi: boolean; aggiungibile: boolean } | null;
  seo: { titolo: string | null; descrizione: string | null; immagine: string | null };
  gtin: string | null;
  aggiornatoIl: string;
  /** Solo con una chiave di anteprima valida (D31). */
  anteprima?: { nascosti: { blocco: string; motivo: string }[] };
}

export interface CategoriaPubblica {
  slug: string;
  nome: string;
  tipo: "categoria" | "collezione";
  frase: string | null;
  foto: SrcFoto | null;
  /** Il testo alternativo della stessa riga di `shop_v_media` da cui viene `foto` (D36); `null` se non c'è la foto. */
  fotoAlt: string | null;
  seo: { titolo: string | null; descrizione: string | null };
  ordine: number;
  /** Quanti prodotti pubblicati: una categoria senza prodotti pubblicati non esiste (Design §4.14 n. 11). */
  quanti: number;
}

/* ── indirizzo (slug) e SKU ───────────────────────────────────────────── */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Lo SKU è l'`id` dei feed e degli eventi: maiuscolo, senza spazi, 2-40 segni. */
const SKU = /^[A-Z0-9][A-Z0-9._-]{1,39}$/;

export const slugValido = (s: unknown): boolean => typeof s === "string" && s.length <= MAX_SLUG && SLUG.test(s);
export const skuValido = (s: unknown): boolean => typeof s === "string" && SKU.test(s);

const senzaAccenti = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** «Lace Front Swiss + PU» → `lace-front-swiss-pu`. Se non resta niente, vuoto: la schermata chiede di scriverlo a mano. */
export function slugDa(nome: unknown): string {
  if (typeof nome !== "string") return "";
  return senzaAccenti(nome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/, "");
}

/* ── prezzi ───────────────────────────────────────────────────────────── */

/**
 * Euro scritti dal titolare («19,90», «19.9», 19.9, 289) → centesimi interi, senza errori binari
 * (`29.9 * 100` fa 2990.0000000000005). Frazioni di centesimo, negativi e testo che non è un prezzo → `null`:
 * mai un prezzo inventato.
 */
export function centDaEuro(valore: unknown): number | null {
  let n: number;
  if (typeof valore === "string") {
    const t = valore.replace("€", "").trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    n = Number(t);
  } else if (typeof valore === "number") {
    n = valore;
  } else {
    return null;
  }
  const x = n * 100;
  const r = Math.round(x);
  return n >= 0 && r <= MAX_CENT && Math.abs(x - r) < 1e-6 ? r : null;
}

/** Centesimi → euro, come lo vogliono le piattaforme (`value: 28.9`). */
export const euroDaCent = (cent: number): number => Math.round(cent) / 100;

/** Il prezzo che conta (D25): quello della variante, o del prodotto se la variante non ne ha uno. Uno zero scritto è uno zero. */
export const prezzoEffettivo = (prodotto: { prezzoCent: number }, variante: { prezzoCent?: number | null }): number =>
  variante.prezzoCent ?? prodotto.prezzoCent;

/* ── varianti dalle opzioni ───────────────────────────────────────────── */

export interface OpzioneInput {
  nome: string;
  valori: string[];
}
export interface VarianteGenerata {
  sku: string;
  nome: string;
  opzioni: Record<string, string>;
}
export type MotivoCombinazioni =
  | "sku_non_valido"
  | "nessuna_opzione"
  | "troppe_opzioni"
  | "opzione_senza_nome"
  | "opzione_doppia"
  | "opzione_senza_valori"
  | "valore_vuoto"
  | "valore_doppio"
  | "troppe_combinazioni";
export type EsitoCombinazioni =
  | { ok: true; varianti: VarianteGenerata[] }
  | { ok: false; motivo: MotivoCombinazioni; frase: string };

const rifiuto = (motivo: MotivoCombinazioni, frase: string): EsitoCombinazioni => ({ ok: false, motivo, frase });
const chiave = (t: string) => t.trim().toLowerCase();
/** Le due lettere (o cifre) del valore per lo SKU proposto: «Nero» → NE, «30 cm» → 30, «—» → XX. */
const sigla = (valore: string) => (senzaAccenti(valore).toUpperCase().replace(/[^A-Z0-9]/g, "") || "XX").slice(0, 2);

/**
 * Le varianti che nascono da opzioni e valori (Design §4.10.4): il prodotto di tutti i valori, la prima opzione
 * gira più lenta. Lo SKU proposto è `<SKU del prodotto>-<2 lettere per valore>`; il titolare lo può cambiare.
 * Si rifiuta (con la frase per il titolare) oltre 3 opzioni o oltre 50 combinazioni, PRIMA di costruirle.
 */
export function combinazioni(skuProdotto: string, opzioni: readonly OpzioneInput[]): EsitoCombinazioni {
  if (!skuValido(skuProdotto)) return rifiuto("sku_non_valido", "Prima serve lo SKU del prodotto: maiuscolo, senza spazi (per esempio HG-T01).");
  if (!Array.isArray(opzioni) || opzioni.length === 0) return rifiuto("nessuna_opzione", "Scrivi almeno un'opzione (per esempio Colore) con i suoi valori.");
  if (opzioni.length > MAX_OPZIONI)
    return rifiuto("troppe_opzioni", `Si possono usare al massimo ${MAX_OPZIONI} opzioni (per esempio colore, lunghezza e misura).`);

  const pulite: { nome: string; valori: string[] }[] = [];
  for (const o of opzioni) {
    const nome = typeof o?.nome === "string" ? o.nome.trim() : "";
    if (!nome) return rifiuto("opzione_senza_nome", "Un'opzione non ha il nome: scrivilo (per esempio Colore) o toglila.");
    if (pulite.some((p) => chiave(p.nome) === chiave(nome))) return rifiuto("opzione_doppia", `L'opzione «${nome}» è scritta due volte.`);
    if (!Array.isArray(o.valori) || o.valori.length === 0) return rifiuto("opzione_senza_valori", `All'opzione «${nome}» manca almeno un valore.`);
    const valori: string[] = o.valori.map((v: unknown) => (typeof v === "string" ? v.trim() : ""));
    if (valori.some((v) => !v)) return rifiuto("valore_vuoto", `Nell'opzione «${nome}» c'è un valore vuoto: scrivilo o toglilo.`);
    if (new Set(valori.map(chiave)).size !== valori.length) return rifiuto("valore_doppio", `Nell'opzione «${nome}» c'è un valore scritto due volte.`);
    pulite.push({ nome, valori });
  }

  const quante = pulite.reduce((n, o) => n * o.valori.length, 1);
  if (quante > MAX_COMBINAZIONI)
    return rifiuto("troppe_combinazioni", `Con queste opzioni si formerebbero ${quante} varianti: il massimo è ${MAX_COMBINAZIONI}. Togli qualche valore.`);

  let giri: { valori: string[]; opzioni: Record<string, string> }[] = [{ valori: [], opzioni: {} }];
  for (const o of pulite) giri = giri.flatMap((g) => o.valori.map((v) => ({ valori: [...g.valori, v], opzioni: { ...g.opzioni, [o.nome]: v } })));

  // Due valori che cominciano uguale («Biondo», «Biondo scuro») darebbero lo stesso SKU: dal secondo in poi si numera.
  const visti = new Set<string>();
  const varianti = giri.map((g) => {
    const proposto = `${skuProdotto}-${g.valori.map(sigla).join("-")}`;
    let sku = proposto.slice(0, MAX_SKU);
    for (let k = 2; visti.has(sku); k++) sku = proposto.slice(0, MAX_SKU - `-${k}`.length) + `-${k}`;
    visti.add(sku);
    return { sku, nome: g.valori.join(" / "), opzioni: g.opzioni };
  });
  return { ok: true, varianti };
}

/* ── caratteristiche ──────────────────────────────────────────────────── */

/**
 * Le caratteristiche come arrivano dal database (un JSON qualunque) → elenco sano. Una riga senza etichetta o senza
 * valore si scarta. Lo stato è «confermato» SOLO se è scritto esattamente così: qualunque altra cosa vale «da confermare»,
 * perché una caratteristica tecnica non verificata non deve mai finire in vetrina per sbaglio.
 */
export function normalizzaCaratteristiche(x: unknown): Caratteristica[] {
  if (!Array.isArray(x)) return [];
  const testo = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return x.flatMap((r): Caratteristica[] => {
    if (!r || typeof r !== "object") return [];
    const o = r as Record<string, unknown>;
    const etichetta = testo(o.etichetta);
    const valore = testo(o.valore);
    if (!etichetta || !valore) return [];
    return [{ etichetta, valore, stato: o.stato === "confermato" ? "confermato" : "da_confermare", fonte: testo(o.fonte) || null }];
  });
}
