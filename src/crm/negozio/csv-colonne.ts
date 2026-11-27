/** ── LE COLONNE DEL CSV DEI PRODOTTI (EDITOR PRODOTTI · E2b) ───────────────
 *  SPEC §6.2. UN SOLO ELENCO: lo usano il lettore (`csv-prodotti.ts`) e il file modello (`csv-modello.ts`), così se le colonne cambiano
 *  il modello cambia con loro. I nomi sono quelli di un'esportazione di Shopify; le tre colonne «in più» sono segnate `extra`.
 *  Le intestazioni si confrontano senza maiuscole, spazi, trattini e segni: «Variant SKU», «variant_sku», «variant-sku» sono la stessa. */

export type ChiaveColonna =
  | "handle" | "titolo" | "corpo" | "breve" | "marca" | "tipo" | "catGoogle" | "categorie" | "fornitore" | "seoTitolo" | "seoDescrizione"
  | "opt1Nome" | "opt1Valore" | "opt2Nome" | "opt2Valore" | "opt3Nome" | "opt3Valore"
  | "sku" | "prezzo" | "giacenza" | "grammi" | "barcode" | "costo"
  | "barrato" | "immagine" | "immaginePos" | "immagineAlt" | "immagineVariante" | "pubblicato" | "stato" | "altra";

export interface Colonna {
  chiave: ChiaveColonna;
  /** L'intestazione come la scrive Shopify (e come esce nel file modello). */
  intestazione: string;
  alias: string[];
  /** Ignorata: si legge per contarla e avvisare, ma non entra nel prodotto. */
  ignorata: boolean;
  /** Non è di Shopify: l'ho aggiunta io (SPEC §6.2). */
  extra?: boolean;
  /** Va nel file modello (quelle di Shopify che non servono davvero restano fuori). */
  nelModello: boolean;
}

/** Il testo con cui si confrontano le intestazioni. */
export const normalizzaIntestazione = (t: string): string => t.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");

const c = (chiave: ChiaveColonna, intestazione: string, alias: string[] = [], o: Partial<Colonna> = {}): Colonna =>
  ({ chiave, intestazione, alias, ignorata: false, nelModello: true, ...o });
const ign = (chiave: ChiaveColonna, intestazione: string, alias: string[] = [], nelModello = true): Colonna =>
  c(chiave, intestazione, alias, { ignorata: true, nelModello });

/** L'ordine è quello del file modello. */
export const COLONNE: readonly Colonna[] = [
  c("handle", "Handle"),
  c("titolo", "Title"),
  c("corpo", "Body (HTML)", ["body"]),
  c("breve", "Short Description", [], { extra: true }),
  c("marca", "Vendor"),
  c("tipo", "Type"),
  c("catGoogle", "Product Category"),
  c("categorie", "Categories", [], { extra: true }),
  c("fornitore", "Supplier", [], { extra: true }),
  c("seoTitolo", "SEO Title"),
  c("seoDescrizione", "SEO Description"),
  c("opt1Nome", "Option1 Name"), c("opt1Valore", "Option1 Value"),
  c("opt2Nome", "Option2 Name"), c("opt2Valore", "Option2 Value"),
  c("opt3Nome", "Option3 Name"), c("opt3Valore", "Option3 Value"),
  c("sku", "Variant SKU"),
  c("prezzo", "Variant Price"),
  c("giacenza", "Variant Inventory Qty"),
  c("grammi", "Variant Grams"),
  c("barcode", "Variant Barcode"),
  c("costo", "Cost per item"),
  ign("barrato", "Variant Compare At Price"),
  // Le foto (E13): si leggono, ma non vanno al server; le carica il browser dopo i prodotti (`importa-foto.ts`).
  c("immagine", "Image Src"),
  c("immaginePos", "Image Position"),
  c("immagineAlt", "Image Alt Text"),
  c("immagineVariante", "Variant Image"),
  ign("pubblicato", "Published"),
  ign("stato", "Status"),
  // Le altre che Shopify esporta: si ignorano e si elencano una volta sola nell'anteprima.
  ign("altra", "Tags", [], false),
  ign("altra", "Variant Inventory Tracker", [], false),
  ign("altra", "Variant Inventory Policy", [], false),
  ign("altra", "Variant Fulfillment Service", [], false),
  ign("altra", "Variant Requires Shipping", [], false),
  ign("altra", "Variant Taxable", [], false),
  ign("altra", "Variant Weight Unit", [], false),
  ign("altra", "Variant Tax Code", [], false),
  ign("altra", "Gift Card", [], false),
];

/** Intestazione normalizzata → colonna. Una `Map`, mai un oggetto: un'intestazione «__proto__» o «constructor» è solo un nome. */
const PER_NOME = new Map<string, Colonna>();
for (const col of COLONNE) for (const n of [col.intestazione, ...col.alias]) PER_NOME.set(normalizzaIntestazione(n), col);

export interface MappaColonne {
  /** chiave → posizione nella riga (la prima colonna con quel nome vince). */
  indici: Map<ChiaveColonna, number>;
  /** Le intestazioni che non si leggono (sconosciute o ignorate), come sono scritte nel file, senza ripetizioni. */
  ignorate: string[];
  /** Colonne scritte due volte: vale la prima. */
  doppie: string[];
  /** Il numero di opzioni oltre la terza che il file nomina (colonne Option4…): gli indici delle loro celle. */
  oltre: { numero: number; indice: number }[];
}

export function mappaColonne(intestazione: readonly string[]): MappaColonne {
  const indici = new Map<ChiaveColonna, number>();
  const ignorate: string[] = [];
  const doppie: string[] = [];
  const oltre: { numero: number; indice: number }[] = [];
  const viste = new Set<string>();
  intestazione.forEach((grezza, indice) => {
    const nome = grezza.trim();
    const chiave = normalizzaIntestazione(nome);
    if (!chiave) return;
    const o = /^option(\d+)(?:name|value)$/.exec(chiave);
    if (o && Number(o[1]) > 3) oltre.push({ numero: Number(o[1]), indice });
    if (viste.has(chiave)) { if (!doppie.includes(nome)) doppie.push(nome); return; }
    viste.add(chiave);
    const col = PER_NOME.get(chiave);
    if (!col || col.chiave === "altra") { if (!ignorate.includes(nome)) ignorate.push(nome); return; }
    if (col.ignorata) { if (!ignorate.includes(nome)) ignorate.push(nome); }
    indici.set(col.chiave, indice);
  });
  return { indici, ignorate, doppie, oltre };
}
