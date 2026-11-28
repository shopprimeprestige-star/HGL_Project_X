/** ── L'IMPORT DEI PRODOTTI: IL SERVER (import.server.ts) ──────────────────────
 *  Commessa 2026-11-25-editor-prodotti (E3), PIANO §1.1 e §1.4. Porte come `spedizioni.server.ts` (guardia, database, orologio, log).
 *
 *  POST { azione: "prodotti_importa_verifica", slugs[≤300], skus[≤400] }  → `{ ok, presenti, skuUsati, categorie, costoDisponibile, importaDisponibile }`
 *  POST { azione: "prodotti_importa", prodotti: ProdottoImport[≤5] }       → `{ ok, risultati: [{ handle, esito, prodottoId?, errori?, avvisi? }] }`
 *  I tipi stanno in `import-contratto.ts`, le regole in `import-regole.ts` (le stesse del browser: stessa frase).
 *
 *  ── LE REGOLE CHE TIENE ─────────────────────────────────────────────────────
 *  · La guardia («pagamenti») viene PRIMA di tutto, anche prima di leggere il corpo.
 *  · La verifica è di SOLA LETTURA: nessuna scrittura (la funzione si «sonda» con un prodotto vuoto, che esce `non_valido` senza scrivere).
 *    Le liste di indirizzi e SKU si spezzano in query da al massimo 100 valori; la risposta ha solo id, nome, stato, indirizzo, SKU:
 *    mai costo, note interne, giacenza.
 *  · L'import non si fida del browser: ogni prodotto rifà TUTTI i controlli con `validaProdottoImport` (il corpo è un'altra cosa dal
 *    CSV: handle e SKU non normalizzati sono un errore, non si correggono). Un prodotto con errori non parte e non ferma gli altri.
 *  · Il prodotto passa alla funzione SQL `shop_import_prodotto` con i campi scritti UNO PER UNO: `stato`, `id`, `canali`, `origine`
 *    e simili del corpo non arrivano mai al database (entra sempre in bozza). `p_chi` è il nome della guardia, mai del corpo; la data
 *    della nota «Importato da CSV il …» è quella del server (ora italiana).
 *  · I testi si ripuliscono dai bordi con `trim()` JS (toglie anche tab e a capo): la funzione SQL usa `btrim` e toglie solo gli spazi.
 *  · Il corpo si legge con `leggiTesto(request, LIMITI.byteServer)` (200 000) (non `leggiCorpo`, che ha 20 000): i gruppi veri sono più grandi.
 *  · Una funzione assente (migrazione non applicata) = 409 con la frase «Per importare serve un aggiornamento del database».
 *  · Un prodotto che c'è già (stesso indirizzo: `shop_import_prodotto` dice «già presente» senza scrivere) si SOVRASCRIVE con
 *    `shop_import_sovrascrivi` (migrazione 20261128130000): stessi controlli, varianti per SKU, quelle tolte dal file si spengono.
 *    Se il database non ha ancora quella funzione resta «già presente» (saltato), come prima.
 *  · Nessuna cancellazione, da nessuna parte. Nei log SOLO codici. */
import { skuValido, slugValido } from "../../shop/cms/modello";
import { LIMITI, type AvvisoRiga, type ErroreRiga, type ProdottoImport, type RisultatoImporta } from "./import-contratto";
import { normalizzaSku, validaProdottoImport } from "./import-regole";
import {
  azioneDi,
  dati,
  eMancante,
  eOggetto,
  gestisci,
  guasto,
  leggiTesto,
  rifiuta,
  righe,
  type PorteDb,
} from "./comune";

export const AZIONI_IMPORT = ["prodotti_importa_verifica", "prodotti_importa"] as const;

/** Quanti valori al massimo in una query `.in(...)`: gli indirizzi lunghi verso PostgREST. */
const PEZZO = 100;
const MAX_SKUS = 400;
const FRASE_NON_VALIDA = "La richiesta non è valida.";

/** La funzione SQL (migrazione 20261125120000). */
const FUNZIONE = "shop_import_prodotto";
/** La sovrascrittura di un prodotto già presente (migrazione 20261128130000): stessi argomenti. */
const SOVRASCRIVI = "shop_import_sovrascrivi";

const valore = (frase: string) => rifiuta("valore", 400, frase);
const sigla = (x: unknown): string => String(x ?? "?").replace(/[^A-Za-z0-9_.]/g, "").slice(0, 30) || "?";

/** Il corpo di una richiesta dell'import: JSON, un oggetto, non oltre 200 000 byte (413). */
async function leggiCorpoImport(request: Request): Promise<Record<string, unknown>> {
  const testo = await leggiTesto(request, LIMITI.byteServer);
  let corpo: unknown;
  try {
    corpo = JSON.parse(testo);
  } catch {
    throw valore(FRASE_NON_VALIDA);
  }
  if (!eOggetto(corpo)) throw valore(FRASE_NON_VALIDA);
  return corpo;
}

/** «25/11/2026» nell'ora italiana: a mezzanotte il giorno del server e quello di chi importa non sono lo stesso. */
const dataItaliana = (d: Date): string =>
  new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

/* ══ LA VERIFICA (sola lettura) ═════════════════════════════════════════════ */

/** Un elenco di valori: al massimo `max`; ciò che non ha la forma di un indirizzo o di uno SKU non arriva mai alla query. */
function elenco(x: unknown, max: number, norma: (s: string) => string, buono: (s: string) => boolean): string[] {
  if (!Array.isArray(x) || x.length > max) throw valore(FRASE_NON_VALIDA);
  return [...new Set(x.filter((s): s is string => typeof s === "string").map(norma).filter(buono))];
}

/** Legge `tabella` dove `colonna` è fra i `valori`, a gruppi da `PEZZO`. */
async function leggiIn(d: PorteDb, dove: string, tabella: string, colonne: string, colonna: string, valori: string[]): Promise<Record<string, unknown>[]> {
  const fuori: Record<string, unknown>[] = [];
  for (let da = 0; da < valori.length; da += PEZZO)
    fuori.push(...righe(dati(d, dove, await d.db.from(tabella).select(colonne).in(colonna, valori.slice(da, da + PEZZO)))));
  return fuori;
}

/** Una sonda che dice sì/no: «manca» (colonna o funzione assente) = no; un guasto vero resta un guasto. */
async function disponibile(d: PorteDb, dove: string, prova: () => PromiseLike<{ data: unknown; error: { code?: unknown } | null }>, letto: (data: unknown) => boolean): Promise<boolean> {
  const r = await prova();
  if (r.error) {
    if (eMancante(r.error)) return false;
    throw guasto(d, dove, r.error);
  }
  return letto(r.data);
}

async function verifica(corpo: Record<string, unknown>, chi: string, d: PorteDb) {
  const slugs = elenco(corpo.slugs, LIMITI.prodottiPerFile, (s) => s, slugValido);
  const skus = elenco(corpo.skus, MAX_SKUS, normalizzaSku, skuValido);

  const presenti = (await leggiIn(d, "verifica", "shop_prodotti", "id, slug, nome, stato", "slug", slugs)).map((r) => ({
    id: String(r.id), slug: String(r.slug), nome: String(r.nome), stato: String(r.stato),
  }));

  // Lo SKU è di un prodotto o di una sua variante: il prodotto vince (come la funzione SQL); il nome si legge dal prodotto.
  const dalProdotto = await leggiIn(d, "verifica", "shop_prodotti", "id, sku, nome", "sku", skus);
  const dallaVariante = await leggiIn(d, "verifica", "shop_varianti", "sku, prodotto_id", "sku", skus);
  const nomi = new Map(
    (await leggiIn(d, "verifica", "shop_prodotti", "id, nome", "id", [...new Set(dallaVariante.map((r) => String(r.prodotto_id)))])).map((r) => [String(r.id), String(r.nome)]),
  );
  const usati = new Map<string, { sku: string; prodottoId: string; prodottoNome: string; comeVariante: boolean }>();
  for (const r of dalProdotto) usati.set(String(r.sku), { sku: String(r.sku), prodottoId: String(r.id), prodottoNome: String(r.nome), comeVariante: false });
  for (const r of dallaVariante)
    if (!usati.has(String(r.sku))) usati.set(String(r.sku), { sku: String(r.sku), prodottoId: String(r.prodotto_id), prodottoNome: nomi.get(String(r.prodotto_id)) ?? "", comeVariante: true });

  const categorie = (await categorieEsistenti(d, "verifica")).map((r) => ({ id: String(r.id), slug: String(r.slug), nome: String(r.nome) }));
  // Il costo si legge UNA volta, con limit 1, solo per sapere se la colonna c'è; il valore non si guarda.
  const costoDisponibile = await disponibile(d, "verifica", () => d.db.from("shop_varianti").select("costo_cent").limit(1), () => true);
  // La funzione si sonda con un prodotto vuoto: esce `non_valido` e non scrive (PIANO §1.1).
  const importaDisponibile = await disponibile(d, "verifica", () => d.db.rpc(FUNZIONE, { p_prodotto: {}, p_varianti: [], p_categorie: [], p_chi: chi }), (x) => eOggetto(x) && x.esito === "non_valido");
  return { presenti, skuUsati: [...usati.values()], categorie, costoDisponibile, importaDisponibile };
}

async function categorieEsistenti(d: PorteDb, dove: string): Promise<Record<string, unknown>[]> {
  return righe(dati(d, dove, await d.db.from("shop_categorie").select("id, slug, nome").order("nome").limit(500)));
}

/* ══ L'IMPORT ═══════════════════════════════════════════════════════════════ */

const ripulisci = (x: unknown): unknown => (typeof x === "string" ? x.trim() : x);
/** Le opzioni di una variante (`{ Colore: "Rosso" }`) con chiavi e valori ripuliti dai bordi: « Colore » e «Colore» sono la stessa opzione. Un valore che non è testo resta com'è (lo dice la validazione). */
const opzioniPulite = (x: unknown): unknown =>
  eOggetto(x) ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k.trim(), ripulisci(v)])) : x;
/** Le opzioni doppie dopo il trim (« Colore» e «Colore»): `pulito` le fonderebbe in silenzio e una delle due sparirebbe. Una riga e il nome per ogni variante coinvolta. */
const opzioniDoppie = (grezzo: unknown): { riga: number; nome: string }[] => {
  const varianti = eOggetto(grezzo) && Array.isArray(grezzo.varianti) ? grezzo.varianti : [];
  return varianti.flatMap((v) => {
    if (!eOggetto(v) || !eOggetto(v.opzioni) || !Number.isInteger(v.riga)) return [];
    const nomi = Object.keys(v.opzioni).map((k) => k.trim());
    const nome = nomi.find((n, i) => nomi.indexOf(n) !== i);
    return nome === undefined ? [] : [{ riga: v.riga as number, nome }];
  });
};
const vuotoANiente = <T>(x: T | undefined): T | undefined => (x === "" ? undefined : x);

/** Il prodotto come arriva dal browser, con i testi ripuliti dai bordi (anche da tab e a capo). Qualunque cosa non sia un oggetto resta com'è: la validazione lo dice. */
function pulito(x: unknown): ProdottoImport {
  const p = eOggetto(x) ? x : {};
  const varianti = Array.isArray(p.varianti) ? p.varianti.map((v) => (eOggetto(v) ? { ...v, nome: ripulisci(v.nome), gtin: ripulisci(v.gtin), opzioni: opzioniPulite(v.opzioni) } : v)) : p.varianti;
  return {
    ...p,
    titolo: ripulisci(p.titolo), marca: ripulisci(p.marca), descrizioneBreve: ripulisci(p.descrizioneBreve), descrizioneLunga: ripulisci(p.descrizioneLunga),
    categoriaGoogle: ripulisci(p.categoriaGoogle), fornitore: ripulisci(p.fornitore), seoTitolo: ripulisci(p.seoTitolo), seoDescrizione: ripulisci(p.seoDescrizione),
    gtin: ripulisci(p.gtin), varianti,
  } as ProdottoImport;
}

const conRighe = (errori: ErroreRiga[], p: ProdottoImport): ErroreRiga[] => {
  const righeProdotto = (Array.isArray(p.varianti) ? p.varianti : []).map((v) => v?.riga).filter((r): r is number => Number.isInteger(r)).slice(0, LIMITI.variantiPerProdotto);
  return errori.map((e) => ({ ...e, righeProdotto }));
};

/** Un prodotto: controlli → funzione SQL → esito. Un guasto del database lancia (500): chi importa riprova, i già entrati risultano «già presenti». */
async function importaUno(grezzo: unknown, chi: string, nota: string, categorie: Map<string, string>, d: PorteDb): Promise<RisultatoImporta> {
  const p = pulito(grezzo);
  const handle = typeof p.handle === "string" ? p.handle.slice(0, 80) : "";
  const { errori, avvisi } = validaProdottoImport(p, { categorie: [...categorie.keys()].map((slug) => ({ slug })) });
  const conAvvisi = (r: RisultatoImporta, a: AvvisoRiga[]): RisultatoImporta => (a.length ? { ...r, avvisi: a } : r);
  const doppie = opzioniDoppie(grezzo).map(({ riga, nome }) => ({ riga, handle, frase: `Due opzioni hanno lo stesso nome «${nome}» (spazi a parte): tienine una sola.` }));
  if (errori.length || doppie.length) return conAvvisi({ handle, esito: "errore", errori: conRighe([...errori, ...doppie], p) }, avvisi);

  const argomenti = {
    p_prodotto: {
      sku: p.sku, slug: p.handle, nome: p.titolo, tipo: p.tipo, prezzo_cent: p.prezzoCent,
      marca: vuotoANiente(p.marca), descrizione_breve: vuotoANiente(p.descrizioneBreve), descrizione_lunga: vuotoANiente(p.descrizioneLunga),
      categoria_google: vuotoANiente(p.categoriaGoogle), fornitore: vuotoANiente(p.fornitore), seo_titolo: vuotoANiente(p.seoTitolo),
      seo_descrizione: vuotoANiente(p.seoDescrizione), peso_g: p.pesoG, gtin: vuotoANiente(p.gtin), nota_titolare: nota,
    },
    p_varianti: p.varianti.map((v, i) => ({
      sku: v.sku, nome: v.nome, opzioni: v.opzioni, prezzo_cent: v.prezzoCent, peso_g: v.pesoG, gtin: vuotoANiente(v.gtin) ?? null,
      costo_cent: v.costoCent, giacenza: v.giacenza, ordine: i + 1,
    })),
    p_categorie: [...new Set(p.categorie.map((s) => categorie.get(s)))],
    p_chi: chi,
  };
  const r = await d.db.rpc(FUNZIONE, argomenti);
  if (r.error) throw eMancante(r.error) ? rifiuta("migrazione", 409, "Per importare serve un aggiornamento del database: chiedi a chi gestisce il database di applicarlo.") : guasto(d, "importa", r.error);

  let x = eOggetto(r.data) ? r.data : {};
  if (x.esito === "creato") return conAvvisi({ handle, esito: "creato", prodottoId: String(x.prodotto_id) }, avvisi);
  if (x.esito === "gia_presente") {
    // C'è già: il file lo sovrascrive. Senza la funzione nuova si salta, come prima.
    const giaPresente: RisultatoImporta = { handle, esito: "gia_presente", prodottoId: String(x.prodotto_id) };
    const s = await d.db.rpc(SOVRASCRIVI, argomenti);
    if (s.error) {
      if (eMancante(s.error)) return giaPresente;
      throw guasto(d, "sovrascrivi", s.error);
    }
    x = eOggetto(s.data) ? s.data : {};
    if (x.esito === "aggiornato") return conAvvisi({ handle, esito: "aggiornato", prodottoId: String(x.prodotto_id) }, avvisi);
    if (x.esito === "non_trovato") return giaPresente; // sparito fra le due chiamate: non si inventa niente
  }
  const tutteLeRighe = p.varianti.map((v) => v.riga);
  if (x.esito === "sku_usato") {
    const sku = String(x.sku);
    const riga = p.varianti.find((v) => v.sku === sku)?.riga ?? tutteLeRighe[0] ?? 0;
    const chiLoUsa = typeof x.prodotto_nome === "string" && x.prodotto_nome ? `dal prodotto «${x.prodotto_nome}»` : "da un altro prodotto";
    return { handle, esito: "errore", errori: [{ riga, handle, frase: `Lo SKU ${sku} è già usato ${chiLoUsa}.`, righeProdotto: tutteLeRighe }] };
  }
  if (x.motivo === "prezzo_pubblicato")
    return {
      handle, esito: "errore",
      errori: [{ riga: tutteLeRighe[0] ?? 0, handle, frase: "Il prodotto è online e nel file non ha un prezzo: aggiungi il prezzo nel file (o rimettilo in bozza) e ricarica.", righeProdotto: tutteLeRighe }],
    };
  d.log(`import non_valido ${sigla(x.motivo)}`); // la sigla, mai un valore
  return {
    handle, esito: "errore",
    errori: [{ riga: tutteLeRighe[0] ?? 0, handle, frase: "Il database non ha accettato questo prodotto: controlla i valori e riprova.", righeProdotto: tutteLeRighe }],
  };
}

async function importa(corpo: Record<string, unknown>, chi: string, d: PorteDb) {
  const lista = corpo.prodotti;
  if (!Array.isArray(lista) || lista.length === 0) throw valore("Manca l'elenco dei prodotti da importare.");
  if (lista.length > LIMITI.prodottiPerRichiesta) throw valore(`Si importano al massimo ${LIMITI.prodottiPerRichiesta} prodotti per volta.`);
  const categorie = new Map((await categorieEsistenti(d, "importa")).map((r) => [String(r.slug), String(r.id)]));
  const nota = `Importato da CSV il ${dataItaliana(d.adesso())}`;
  const risultati: RisultatoImporta[] = [];
  for (const x of lista) risultati.push(await importaUno(x, chi, nota, categorie, d)); // uno alla volta: ogni prodotto è la sua transazione
  return { risultati };
}

/* ══ I GESTORI ══════════════════════════════════════════════════════════════ */

export const gestisciPOST = (request: Request, d: PorteDb): Promise<Response> =>
  gestisci(request, d, async (chi) => {
    const corpo = await leggiCorpoImport(request);
    const azione = azioneDi(corpo, AZIONI_IMPORT);
    return azione === "prodotti_importa_verifica" ? verifica(corpo, chi, d) : importa(corpo, chi, d);
  });
