/** ── LA SCHEDA NUOVA: LE REGOLE SENZA SCHERMO (scheda-nuova-puro.ts) ──────────
 *  Commessa 2026-11-25-editor-prodotti, E9 (SPEC §2.1). Niente React: la scheda vuota, le proposte di SKU e indirizzo dal titolo,
 *  i controlli prima di scrivere, la richiesta `prodotto_crea` (UNA sola, completa) e come si leggono le sue risposte.
 *  Si prova in `prove/negozio/scheda-nuova-sorgente.mjs`, anche contro il vero server dei prodotti sul finto del database.
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · Finché non si preme «Salva bozza» nel database non nasce niente: da qui non parte nessuna richiesta prima di `creaBozza`.
 *  · `campi` porta ciò che è del PRODOTTO (prezzo, peso, barcode, descrizioni, canali…); `variante` solo la giacenza iniziale e il costo.
 *    Nome, tipo, SKU e indirizzo stanno in cima: il server rifiuta se li trova dentro `campi`.
 *  · I canali partono SEMPRE, tutti e quattro, uguali a come si vedono: il database li parte spenti e un prodotto senza canali non si pubblica.
 *  · «duplicato»: lo dice il server per lo SKU (la frase lo nomina) e per l'indirizzo (frase generica). Per l'indirizzo PROPOSTO dal titolo
 *    si riprova una volta con titolo e SKU insieme; per uno scritto a mano no, si dice dov'è il problema.
 *  · `parziale`: il prodotto c'è ma un passo dopo è fallito. Non si rifà «Salva bozza» (darebbe «SKU già usato»): lo si apre. */
import type { RisultatoAzione } from "@/crm/negozio/client";
import { centDaEuro, slugDa } from "@/shop/cms/modello";
import {
  campiDaModulo,
  eInvisibleDerm,
  quantitaDaTesto,
  type Errori,
  type Modulo,
} from "./scheda-pura";

/** Come si manda un'azione al server: `negozio.esegui`. */
export type Crea = (azione: string, dati?: Record<string, unknown>) => Promise<RisultatoAzione>;
export interface Categoria {
  id: string;
  nome: string;
}

/* ══ LA SCHEDA VUOTA E LE PROPOSTE ══════════════════════════════════════════ */

/** Il «sito» parte acceso (come i canali di vendita di Shopify): una bozza non si vede comunque, e così «Pubblica» chiede una cosa in meno. */
export const moduloVuoto = (): Modulo => ({
  nome: "",
  slug: "",
  sku: "",
  tipo: "patch",
  marca: "",
  rigaPresentazione: "",
  descrizioneBreve: "",
  descrizioneLunga: "",
  perChi: "",
  caratteristiche: [],
  prezzo: "",
  passi: "",
  confezione: "",
  avvertenze: "",
  faq: [],
  reso: "",
  resoGiorni: "",
  boxConsulenza: false,
  correlatoId: "",
  canali: { sito: true, meta: false, google: false, tiktok: false },
  seoTitolo: "",
  seoDescrizione: "",
  gtin: "",
  mpn: "",
  categoriaGoogle: "",
  pesoG: "",
  classeSpedizione: "",
  fornitore: "",
  noteInterne: "",
  notaTitolare: "",
});

/** «Lace Front Swiss + PU» → `LACE-FRONT-SWISS-PU`: maiuscolo, al massimo 40 segni, mai un trattino in fondo. */
export const propostaSku = (nome: string): string =>
  slugDa(nome).toUpperCase().slice(0, 40).replace(/-+$/, "");

/** Applica un cambio al modulo. SKU e indirizzo seguono il titolo finché non li hai scritti tu (restano uguali alla proposta del titolo di prima). */
export function applicaCambio(m: Modulo, p: Partial<Modulo>): Modulo {
  const dopo = { ...m, ...p };
  if (p.nome === undefined) return dopo;
  if (p.sku === undefined && (m.sku === "" || m.sku === propostaSku(m.nome)))
    dopo.sku = propostaSku(p.nome);
  if (p.slug === undefined && (m.slug === "" || m.slug === slugDa(m.nome)))
    dopo.slug = slugDa(p.nome);
  return dopo;
}

/** Le categorie come le dà il server: si tengono solo quelle con id e nome. */
export function elencoCategorie(x: unknown): Categoria[] {
  if (!Array.isArray(x)) return [];
  return x.flatMap((k) => {
    const o = k as { id?: unknown; nome?: unknown } | null;
    return o && typeof o.id === "string" && typeof o.nome === "string"
      ? [{ id: o.id, nome: o.nome }]
      : [];
  });
}

/* ══ I CONTROLLI E LA RICHIESTA ═════════════════════════════════════════════ */

export interface DatiBozza {
  modulo: Modulo;
  /** I pezzi iniziali come li scrive il titolare; vuoto = 0. */
  quantita: string;
  /** Il costo in euro; vuoto = nessun costo. */
  costo: string;
  /** Falso se si è scoperto che il database non ha ancora la colonna del costo: il costo non parte. */
  costoDisponibile: boolean;
  categorie: readonly string[];
}
export interface ErroriBozza {
  campi: Errori;
  quantita?: string;
  costo?: string;
}

/** Le chiavi che il server non vuole dentro `campi` di `prodotto_crea` (hanno il loro posto, o non esistono ancora). */
const FUORI_DA_CAMPI = ["nome", "tipo", "sku", "slug", "correlatoId", "seoMediaId", "stato"];

export function controllaBozza(
  d: DatiBozza,
): { ok: true; richiesta: Record<string, unknown> } | { ok: false; errori: ErroriBozza } {
  //  Invisible Derm non ha un prezzo nello shop (D39): il campo non c'è e un prezzo rimasto da prima non parte.
  const m = eInvisibleDerm(d.modulo.nome, d.modulo.slug) ? { ...d.modulo, prezzo: "" } : d.modulo;
  const { campi, errori: tutti } = campiDaModulo(m);
  //  SKU e indirizzo vuoti si propongono dal titolo: senza titolo l'errore è uno solo.
  const errori = Object.fromEntries(
    Object.entries(tutti).filter(
      ([k]) => !(tutti.nome && ((k === "sku" && !m.sku) || (k === "slug" && !m.slug))),
    ),
  ) as Errori;
  const fuori: ErroriBozza = { campi: errori };

  let giacenza = 0;
  if (d.quantita.trim()) {
    const q = quantitaDaTesto(d.quantita);
    if (q.ok) giacenza = q.n;
    else fuori.quantita = "La quantità è un numero intero da 0 a 1.000.000 (per esempio 12).";
  }
  let costoCent: number | null = null;
  if (d.costoDisponibile && d.costo.trim()) {
    costoCent = centDaEuro(d.costo);
    if (costoCent === null)
      fuori.costo =
        "Scrivi il costo in euro, per esempio 10,40 (al massimo due cifre dopo la virgola).";
  }
  if (Object.keys(errori).length || fuori.quantita || fuori.costo)
    return { ok: false, errori: fuori };

  const resto = Object.fromEntries(
    Object.entries(campi).filter(([k]) => !FUORI_DA_CAMPI.includes(k)),
  );
  return {
    ok: true,
    richiesta: {
      nome: campi.nome,
      tipo: m.tipo,
      sku: m.sku,
      slug: m.slug,
      campi: resto,
      categorie: [...d.categorie],
      variante: { giacenza, ...(costoCent !== null ? { costoCent } : {}) },
    },
  };
}

/** C'è qualcosa di scritto che uscendo andrebbe perso? La scheda non toccata (o scritta e poi cancellata) no: nessun avviso falso. */
export const eScritta = (d: DatiBozza): boolean =>
  JSON.stringify(d.modulo) !== JSON.stringify(moduloVuoto()) ||
  d.quantita.trim() !== "" ||
  d.costo.trim() !== "" ||
  d.categorie.length > 0;

/** L'elemento da mettere a fuoco dopo un «Salva bozza» respinto: il primo campo con un errore, poi la quantità, poi il costo. */
export function primoCampoDaSistemare(e: ErroriBozza): string | null {
  const primo = Object.keys(e.campi)[0];
  if (primo) return `f-${primo}`;
  return e.quantita ? "f-giacenza" : e.costo ? "f-costo" : null;
}

/* ══ «SALVA BOZZA» ══════════════════════════════════════════════════════════ */

export type EsitoBozza =
  /** Il prodotto c'è. `id` nullo = la risposta non lo diceva (si cerca nell'elenco); `mancanti` = i passi dopo il primo che non sono riusciti. */
  | { tipo: "creato"; id: string | null; mancanti: string[] }
  /** Non è nato niente: gli errori stanno accanto ai campi. */
  | { tipo: "errori"; errori: ErroriBozza }
  /** Non è nato niente: il database non ha ancora la colonna del costo. */
  | { tipo: "costo_spento"; frase: string }
  /** Non è nato niente (o non si sa): la frase del server. */
  | { tipo: "fermo"; frase: string };

const PASSI: Record<string, string> = {
  variante: "la variante «Unica» (prezzo e scorte)",
  giacenza: "le scorte iniziali",
  categorie: "le categorie",
};

/** La frase del banner quando il prodotto c'è ma un passo dopo è fallito. */
export const fraseMancanti = (passi: readonly string[]): string =>
  `Il prodotto c'è, in bozza, ma non sono riuscito a salvare ${passi.map((p) => PASSI[p] ?? p).join(", ")}. Aprilo e completa questi dati dalla sua scheda.`;

/**
 * «Salva bozza»: UNA `prodotto_crea` completa. Se l'indirizzo PROPOSTO dal titolo è già usato (due colori con lo stesso nome) si riprova una
 * volta con titolo e SKU insieme; per l'indirizzo scritto a mano o per lo SKU no (la frase dice dov'è il problema). Mai due prodotti.
 */
export async function creaBozza(crea: Crea, d: DatiBozza): Promise<EsitoBozza> {
  const c = controllaBozza(d);
  if (!c.ok) return { tipo: "errori", errori: c.errori };
  const { nome, sku, slug } = c.richiesta as { nome: string; sku: string; slug: string };
  let r = await crea("prodotto_crea", c.richiesta);
  if (
    !r.ok &&
    r.errore.tipo === "duplicato" &&
    !r.errore.messaggio.includes(sku) &&
    slug === slugDa(nome)
  )
    r = await crea("prodotto_crea", { ...c.richiesta, slug: slugDa(`${nome} ${sku}`) });
  if (!r.ok) {
    const { tipo, messaggio } = r.errore;
    if (tipo === "duplicato")
      return {
        tipo: "errori",
        errori: {
          campi: messaggio.includes(sku)
            ? { sku: messaggio }
            : { slug: "Questo indirizzo è già usato da un altro prodotto: cambialo." },
        },
      };
    if (tipo === "migrazione" && /costo/i.test(messaggio))
      return { tipo: "costo_spento", frase: messaggio };
    return { tipo: "fermo", frase: messaggio };
  }
  const id = (r.dati.prodotto as { id?: unknown } | undefined)?.id;
  const parziale = Array.isArray(r.dati.parziale) ? r.dati.parziale : [];
  return {
    tipo: "creato",
    id: typeof id === "string" ? id : null,
    mancanti: parziale.filter((p): p is string => typeof p === "string"),
  };
}

/** Dopo «Salva bozza» riuscito: si apre il prodotto, a meno che un passo dopo il primo sia fallito (`mancanti`) o non si sappia l'id: allora un avviso. */
export const dopoCreazione = (
  e: Extract<EsitoBozza, { tipo: "creato" }>,
): { tipo: "apri"; id: string } | { tipo: "avviso"; id: string | null; mancanti: string[] } =>
  e.id && e.mancanti.length === 0
    ? { tipo: "apri", id: e.id }
    : { tipo: "avviso", id: e.id, mancanti: e.mancanti };
