/** ── LE REGOLE DELL'IMPORT DEI PRODOTTI (EDITOR PRODOTTI · E2b) ─────────────
 *  SPEC §6.1-6.5, PIANO §1.1. Modulo PURO: la STESSA funzione gira nel browser (anteprima) e nel server (che rifà ogni controllo:
 *  un file o una richiesta manipolati non passano). Le frasi sono per una persona, in italiano, e dicono cosa scrivere.
 *   - i prezzi passano SEMPRE da `centDaEuro` (mai `parseFloat`); i testi dagli stessi blocchi della scheda (`controllaTesto`);
 *   - i massimi numerici sono quelli della funzione SQL (`LIMITI`): un «99999999999» è un errore a parole, non del database;
 *   - il prodotto entra sempre in bozza: qui non esiste nemmeno un campo «stato». */
import { MAX_CENT, MAX_COMBINAZIONI, MAX_OPZIONI, centDaEuro, skuValido, slugValido } from "@/shop/cms/modello";
import { eInvisibleDerm } from "@/shop/cms/pubblico";
import { controllaTesto } from "@/shop/cms/testi";
import { LIMITI, type AvvisoRiga, type ErroreRiga, type ProdottoImport, type RispostaVerifica } from "./import-contratto";

export { MAX_COMBINAZIONI, MAX_OPZIONI };

/** Lo SKU come lo vuole la scheda: maiuscolo, gli spazi diventano trattini. */
export const normalizzaSku = (t: string): string => t.trim().toUpperCase().replace(/\s+/g, "-");

/** Il testo di un valore scritto dall'utente, accorciato per stare in una frase. */
export const mostra = (t: unknown): string => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
};

/** «Riga 7 (handle `x`): …» come lo vede la persona. */
export const descriviErrore = (e: { riga: number; handle?: string; frase: string }): string =>
  `${e.riga > 0 ? `Riga ${e.riga}` : "File"}${e.handle ? ` (handle \`${e.handle}\`)` : ""}: ${e.frase}`;

/* ── prezzi ─────────────────────────────────────────────────────────── */

/** «1.234,50» o «1,234.50»: i separatori di migliaia non esistono. Se c'è, la frase dice come scriverlo. */
const MIGLIAIA = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$|^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/;

/** Un prezzo scritto nel file → centesimi. Vuoto → `null` (non è un errore: decide chi chiama). */
export function leggiPrezzo(testo: string, colonna: string): { ok: true; cent: number | null } | { ok: false; frase: string } {
  const t = testo.replace("€", "").trim();
  if (!t) return { ok: true, cent: null };
  const cent = centDaEuro(t);
  if (cent !== null) return { ok: true, cent };
  if (MIGLIAIA.test(t)) {
    const senza = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "") : /\.\d{1,2}$/.test(t) && /,\d{3}/.test(t) ? t.replace(/,/g, "").replace(".", ",") : t.replace(/[.,]/g, "");
    return { ok: false, frase: `${colonna} «${mostra(testo)}» ha il separatore delle migliaia: scrivi ${senza}.` };
  }
  if (/^\d+(?:[.,]\d{1,2})?$/.test(t)) return { ok: false, frase: `${colonna} «${mostra(testo)}» è troppo alto: il massimo è 21474836,47.` };
  if (/^\d+[.,]\d+$/.test(t)) return { ok: false, frase: `${colonna} «${mostra(testo)}» ha più di due decimali: scrivi 19,90.` };
  return { ok: false, frase: `${colonna} «${mostra(testo)}» non è un prezzo. Scrivi 19,90.` };
}

/* ── controllo di un prodotto ───────────────────────────────────────── */

export interface ContestoImport {
  /** Se c'è, le categorie del prodotto devono stare qui (il server le conosce; il lettore le ha già filtrate). */
  categorie?: readonly { slug: string }[];
}

// eslint-disable-next-line no-control-regex
const CONTROLLI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
const A_CAPO = /[\n\r\t]/;
const EMOJI = /[\p{Emoji_Presentation}️]/u;
const TIPI = ["patch", "cura", "kit"];

const intero = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const stringa = (x: unknown): string => (typeof x === "string" ? x : "");

/** Gli stessi controlli della scheda su un prodotto già normalizzato. Gli errori fermano il prodotto, gli avvisi no. */
export function validaProdottoImport(p: ProdottoImport, ctx: ContestoImport = {}): { errori: ErroreRiga[]; avvisi: AvvisoRiga[] } {
  const errori: ErroreRiga[] = [];
  const avvisi: AvvisoRiga[] = [];
  const o = (p && typeof p === "object" ? p : {}) as Partial<ProdottoImport>;
  const handle = stringa(o.handle);
  const varianti = Array.isArray(o.varianti) ? o.varianti : [];
  const riga0 = intero(varianti[0]?.riga, 0, 1e9) ? varianti[0].riga : 0;
  const err = (riga: number, frase: string) => errori.push({ riga, handle, frase });
  const avv = (riga: number, frase: string) => avvisi.push({ riga, handle, frase });
  const derm = eInvisibleDerm(o.titolo, handle);

  /** Un testo: lunghezza, caratteri strani, parole vietate (errore) e da non usare (avviso). `solo` = una sola riga, senza emoji. */
  const testo = (riga: number, etichetta: string, valore: unknown, max: number, solo: boolean) => {
    if (valore === undefined || valore === null || valore === "") return;
    if (typeof valore !== "string") return err(riga, `${etichetta} non è un testo.`);
    if (valore.length > max) return err(riga, `${etichetta} è lungo ${valore.length} segni: il massimo è ${max}.`);
    if (CONTROLLI.test(valore) || (solo && A_CAPO.test(valore))) return err(riga, `${etichetta} contiene caratteri di controllo o a capo che non si possono usare: riscrivilo.`);
    if (solo && EMOJI.test(valore)) return err(riga, `${etichetta} contiene un'emoji: toglila e scrivi solo testo.`);
    const r = controllaTesto(valore);
    for (const b of r.bloccanti) err(riga, `${etichetta}: ${b.frase}`);
    for (const a of r.avvisi) avv(riga, `${etichetta}: ${a.frase}`);
  };

  if (!slugValido(handle)) err(riga0, `L'indirizzo (Handle) «${mostra(handle)}» non è valido: minuscole, numeri e trattini (per esempio lace-front).`);
  const titolo = stringa(o.titolo);
  if (!titolo.trim()) err(riga0, "Manca il Title (il nome del prodotto): è obbligatorio nella prima riga di ogni prodotto.");
  else testo(riga0, "Title", titolo, LIMITI.nome, true);
  if (!TIPI.includes(stringa(o.tipo))) err(riga0, "Il tipo deve essere patch, cura o kit.");
  testo(riga0, "Vendor", o.marca, LIMITI.marca, true);
  testo(riga0, "Short Description", o.descrizioneBreve, LIMITI.descrizioneBreve, false);
  testo(riga0, "Body (HTML)", o.descrizioneLunga, LIMITI.descrizioneLunga, false);
  testo(riga0, "Product Category", o.categoriaGoogle, LIMITI.categoriaGoogle, true);
  testo(riga0, "Supplier", o.fornitore, LIMITI.fornitore, true);
  testo(riga0, "SEO Title", o.seoTitolo, LIMITI.seoTitolo, true);
  testo(riga0, "SEO Description", o.seoDescrizione, LIMITI.seoDescrizione, false);
  if (stringa(o.seoTitolo).length > 60) avv(riga0, `Il SEO Title è lungo ${stringa(o.seoTitolo).length} segni: Google ne mostra circa 60.`);
  if (stringa(o.seoDescrizione).length > 155) avv(riga0, `La SEO Description è lunga ${stringa(o.seoDescrizione).length} segni: Google ne mostra circa 155.`);

  if (!o.sku) err(riga0, "Manca lo SKU.");
  else if (!skuValido(o.sku)) err(riga0, `Lo SKU «${mostra(o.sku)}» non è valido: maiuscolo, senza spazi, da 2 a 40 segni (per esempio HG-T01).`);
  if (!intero(o.prezzoCent, 0, MAX_CENT)) err(riga0, "Il prezzo del prodotto non è valido: intero, in centesimi, da 0 a 2147483647.");
  else if (derm && o.prezzoCent > 0) err(riga0, "Invisible Derm non ha prezzo nello shop: il costo si vede in consulenza.");
  else if (o.prezzoCent === 0 && !derm) avv(riga0, "Il prezzo è 0: il prodotto entra in bozza, ma si può pubblicare solo con un prezzo maggiore di 0.");
  if (o.pesoG !== undefined && !intero(o.pesoG, 0, LIMITI.peso)) err(riga0, `Il peso non è valido: grammi interi, da 0 a ${LIMITI.peso}.`);
  const gtin = (riga: number, g: unknown) => {
    if (g === undefined || g === null || g === "") return;
    if (typeof g !== "string" || g.length > LIMITI.gtin || CONTROLLI.test(g)) return err(riga, `Il barcode «${mostra(g)}» non è valido: al massimo ${LIMITI.gtin} segni.`);
    if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(g)) avv(riga, `Il barcode «${mostra(g)}» non ha 8, 12, 13 o 14 cifre: controllalo.`);
  };
  gtin(riga0, o.gtin);

  const cat = Array.isArray(o.categorie) ? o.categorie : [];
  if (!Array.isArray(o.categorie) || cat.some((x) => typeof x !== "string")) err(riga0, "Le categorie non sono valide.");
  else if (cat.length > LIMITI.categorieSuProdotto) err(riga0, `Ci sono ${cat.length} categorie: il massimo è ${LIMITI.categorieSuProdotto}.`);
  else if (ctx.categorie) {
    const note = new Set(ctx.categorie.map((c) => c.slug));
    for (const s of cat) if (!note.has(s)) err(riga0, `La categoria «${mostra(s)}» non esiste: creala in Categorie.`);
  }

  if (!Array.isArray(o.varianti) || varianti.length === 0) err(riga0, "Il prodotto non ha nessuna variante.");
  else if (varianti.length > LIMITI.variantiPerProdotto) err(riga0, `Ci sono ${varianti.length} varianti: il massimo è ${LIMITI.variantiPerProdotto}.`);
  const viste = new Map<string, number>();
  for (const v of varianti.slice(0, LIMITI.variantiPerProdotto + 1)) {
    const riga = intero(v?.riga, 0, 1e9) ? v.riga : riga0;
    if (!v || typeof v !== "object") { err(riga0, "Una variante non è valida."); continue; }
    if (!v.sku) err(riga, "Manca lo SKU della variante.");
    else if (!skuValido(v.sku)) err(riga, `Lo SKU «${mostra(v.sku)}» non è valido: maiuscolo, senza spazi, da 2 a 40 segni (per esempio HG-T01).`);
    else if (viste.has(v.sku)) err(riga, `Lo SKU ${v.sku} è scritto due volte nel prodotto (righe ${viste.get(v.sku)} e ${riga}).`);
    else viste.set(v.sku, riga);
    if (!stringa(v.nome).trim()) err(riga, "La variante non ha un nome.");
    else testo(riga, "Il nome della variante", v.nome, LIMITI.nome, true);
    const op = v.opzioni && typeof v.opzioni === "object" && !Array.isArray(v.opzioni) ? Object.entries(v.opzioni) : null;
    if (!op) err(riga, "Le opzioni della variante non sono valide.");
    else {
      if (op.length > MAX_OPZIONI) err(riga, `Ci sono ${op.length} opzioni, il massimo è ${MAX_OPZIONI}.`);
      for (const [k, x] of op) {
        if (!k.trim() || !stringa(x).trim()) err(riga, "Un'opzione ha il nome o il valore vuoto.");
        else { testo(riga, `L'opzione «${mostra(k)}»`, k, LIMITI.nomeOpzione, true); testo(riga, `Il valore «${mostra(x)}»`, x, LIMITI.nomeOpzione, true); }
      }
    }
    if (v.prezzoCent !== null && !intero(v.prezzoCent, 0, MAX_CENT)) err(riga, "Il prezzo della variante non è valido: intero, in centesimi, da 0 a 2147483647.");
    else if (derm && (v.prezzoCent ?? 0) > 0) err(riga, "Invisible Derm non ha prezzo nello shop: il costo si vede in consulenza.");
    if (v.costoCent !== null && !intero(v.costoCent, 0, MAX_CENT)) err(riga, "Il costo non è valido: intero, in centesimi, da 0 a 2147483647.");
    if (v.pesoG !== null && !intero(v.pesoG, 0, LIMITI.peso)) err(riga, `Il peso non è valido: grammi interi, da 0 a ${LIMITI.peso}.`);
    if (!intero(v.giacenza, 0, LIMITI.giacenza)) err(riga, `La giacenza non è valida: un numero intero da 0 a ${LIMITI.giacenza}.`);
    gtin(riga, v.gtin);
  }
  // La stessa frase sulla stessa riga una volta sola (lo SKU del prodotto è quello della prima variante).
  const unici = <T extends { riga: number; frase: string }>(x: T[]): T[] => x.filter((e, i) => x.findIndex((y) => y.riga === e.riga && y.frase === e.frase) === i);
  return { errori: unici(errori), avvisi: unici(avvisi) };
}

/* ── confronto con il catalogo (la risposta di `prodotti_importa_verifica`) ── */

/** Dopo la verifica: chi c'è già (si SOVRASCRIVE: va in `daAggiornare`, e in `giaPresenti` per la tabella e le foto), chi usa uno SKU
 *  di un ALTRO prodotto (errore: gli SKU del prodotto stesso si possono riusare), chi è nuovo. */
export function confrontaConCatalogo(
  prodotti: readonly ProdottoImport[],
  catalogo: Pick<RispostaVerifica, "presenti" | "skuUsati">,
): {
  nuovi: ProdottoImport[];
  daAggiornare: ProdottoImport[];
  giaPresenti: { handle: string; prodottoId: string; nome: string; pubblicato?: boolean }[];
  errori: ErroreRiga[];
} {
  const presenti = new Map(catalogo.presenti.map((x) => [x.slug, x]));
  const usati = new Map(catalogo.skuUsati.map((x) => [x.sku.toUpperCase(), x]));
  const nuovi: ProdottoImport[] = [];
  const daAggiornare: ProdottoImport[] = [];
  const giaPresenti: { handle: string; prodottoId: string; nome: string; pubblicato?: boolean }[] = [];
  const errori: ErroreRiga[] = [];
  for (const p of prodotti) {
    const c = presenti.get(p.handle);
    const mie: ErroreRiga[] = [];
    for (const v of p.varianti) {
      const u = usati.get(v.sku.toUpperCase());
      if (u && u.prodottoId !== c?.id) mie.push({ riga: v.riga, handle: p.handle, frase: `Lo SKU ${v.sku.toUpperCase()} è già usato dal prodotto «${u.prodottoNome}».` });
    }
    if (mie.length) errori.push(...mie.map((e) => ({ ...e, righeProdotto: p.varianti.map((v) => v.riga) })));
    else if (c) {
      giaPresenti.push({ handle: p.handle, prodottoId: c.id, nome: c.nome, pubblicato: c.stato === "pubblicato" });
      daAggiornare.push(p);
    } else nuovi.push(p);
  }
  return { nuovi, daAggiornare, giaPresenti, errori };
}
