/** ── LE CATEGORIE DEL CMS: IL SERVER (categorie.server.ts) ──────────────────
 *  Commessa 2026-11-20-shop-completo (T09), PIANO §3.3 e Design §4.10.5.
 *
 *  GET  ?categorie                                        → `{ ok, categorie: [...] }` (nell'ordine del sito)
 *  POST { azione: "categoria_salva", id?, nome, slug?, tipo?, frase?, seoTitolo?, seoDescrizione?, versione? }
 *       { azione: "categoria_ordina", ids: [uuid, …] }    → l'elenco completo, nell'ordine voluto
 *       { azione: "categoria_visibile", id, visibile, versione }
 *       { azione: "categoria_foto", categoriaId, path, alt, versione }   → la foto della categoria (già caricata con il permesso di `media.server.ts`)
 *       { azione: "prodotto_categorie", prodottoId, categorie: [uuid, …], versione }   → sostituisce l'insieme delle categorie di un prodotto
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · Lo slug è unico (anche se un altro lo prende nell'istante dell'inserimento: 23505) e si BLOCCA dopo la prima
 *    pubblicazione (`pubblicata_il`, che si scrive la prima volta che la categoria diventa visibile).
 *  · Modificare una categoria che esiste vuole la `versione` (`aggiornato_il` che la scheda ha visto): se è cambiata, 409.
 *  · Ogni cambio lascia una riga per campo in `shop_storico` (chi, prima, dopo). Solo INSERT: il registro non si aggiorna
 *    (niente `upsert`, niente `ON CONFLICT DO UPDATE`: il database non lo permette nemmeno a `service_role`).
 *    Se lo storico non si scrive la categoria resta salvata e la risposta dice `storico: false`.
 *  · Nessuna cancellazione: una categoria si nasconde (`visibile`).
 *  · UNICA eccezione: `prodotto_categorie` toglie righe dal legame `shop_prodotti_categorie` (nessun dato storico; D5 vale per
 *    prodotti, categorie e foto). Prima si AGGIUNGE e poi si toglie, così un prodotto pubblicato non resta mai senza categoria
 *    nemmeno a metà; se l'insieme nuovo sarebbe vuoto per un pubblicato, si rifiuta. La `versione` è l'`aggiornato_il` del
 *    PRODOTTO e si fa avanzare (confronto-e-scambio): due persone che cambiano le categorie insieme non si sovrascrivono. */
import { TETTI, slugDa, slugValido } from "@/shop/cms/modello";
import { categoriaDaRiga } from "@/shop/cms/righe";
import { controllaTesto } from "@/shop/cms/testi";
import { percorsoShopValido } from "./media.server";
import { azioneDi, conflitto, dati, eUuid, gestisci, guasto, leggiCorpo, rifiuta, righe, stessoIstante, versioneAttuale, type PorteDb } from "./comune";

export const AZIONI_CATEGORIE = ["categoria_salva", "categoria_ordina", "categoria_visibile", "categoria_foto", "prodotto_categorie"] as const;
const MAX_NOME = 60;
const MAX_FRASE = 200;
const MAX_CATEGORIE = 100;
const TIPI = ["categoria", "collezione"];

type Riga = Record<string, unknown>;
interface Cambio {
  campo: string;
  prima: unknown;
  dopo: unknown;
}

/* ── lettura ─────────────────────────────────────────────────────────── */

const leggiTutte = async (d: PorteDb): Promise<Riga[]> =>
  righe(dati(d, "lettura", await d.db.from("shop_categorie").select("*").order("ordine").order("nome").limit(500)));

/** Quanti prodotti PUBBLICATI ha ogni categoria (bozze e archiviati non contano). */
async function contaPubblicati(d: PorteDb): Promise<Map<string, number>> {
  // shortcut: due letture intere invece di un conteggio per categoria; il tetto di PostgREST (di solito 1000 righe) basta
  // per un negozio di qualche decina di articoli. Si cambia con una vista di conteggio quando il catalogo supera le 1000 righe.
  const pubblicati = new Set(righe(dati(d, "lettura", await d.db.from("shop_prodotti").select("id").eq("stato", "pubblicato").limit(5000))).map((r) => r.id));
  const legami = righe(dati(d, "lettura", await d.db.from("shop_prodotti_categorie").select("prodotto_id, categoria_id").limit(10000)));
  const conti = new Map<string, number>();
  for (const l of legami)
    if (pubblicati.has(l.prodotto_id) && typeof l.categoria_id === "string") conti.set(l.categoria_id, (conti.get(l.categoria_id) ?? 0) + 1);
  return conti;
}

/** Ciò che il pannello vede di una categoria (mai la riga intera). `versione` = `aggiornato_il`, da rimandare quando si salva. */
function vista(riga: Riga, quanti: number) {
  const k = categoriaDaRiga(riga);
  if (!k) return null;
  return {
    id: k.id, slug: k.slug, nome: k.nome, tipo: k.tipo, frase: k.frase, fotoPath: k.fotoPath,
    seoTitolo: k.seoTitolo, seoDescrizione: k.seoDescrizione, ordine: k.ordine, visibile: k.visibile, pubblicataIl: k.pubblicataIl,
    versione: typeof riga.aggiornato_il === "string" ? riga.aggiornato_il : null,
    quanti,
    /** «Nascosta dal sito»: spenta oppure senza prodotti pubblicati. */
    nascosta: !(k.visibile && quanti > 0),
    slugBloccato: k.pubblicataIl !== null,
  };
}

export async function leggiCategorie(d: PorteDb) {
  const [tutte, conti] = [await leggiTutte(d), await contaPubblicati(d)];
  return tutte.flatMap((r) => vista(r, conti.get(String(r.id)) ?? 0) ?? []);
}

/* ── scrittura ───────────────────────────────────────────────────────── */

/** Una riga di storico per campo cambiato. Non fa mai fallire l'azione: dice solo se è riuscita. */
async function scriviStorico(d: PorteDb, entita: string, id: string, cambi: Cambio[], chi: string): Promise<boolean> {
  if (!cambi.length) return true;
  try {
    const r = await d.db.from("shop_storico").insert(cambi.map((x) => ({ entita, entita_id: id, campo: x.campo, prima: x.prima ?? null, dopo: x.dopo ?? null, chi })));
    if (r.error) {
      guasto(d, "storico", r.error); // scrive il codice nel log; qui l'errore non si lancia
      return false;
    }
    return true;
  } catch (e) {
    d.log(`storico eccezione ${String((e as { name?: unknown })?.name ?? "?").replace(/[^A-Za-z0-9_]/g, "").slice(0, 30)}`);
    return false;
  }
}

/** L'aggiornamento di UNA categoria, solo se la versione è ancora quella letta (`versione` = il testo di `aggiornato_il` com'è nel database; 0 righe = l'ha cambiata un altro). */
async function aggiorna(d: PorteDb, id: string, versione: string | null, patch: Riga): Promise<void> {
  let q = d.db.from("shop_categorie").update({ ...patch, aggiornato_il: d.adesso().toISOString() }).eq("id", id);
  if (versione !== null) q = q.eq("aggiornato_il", versione);
  const r = await q.select("id");
  if (r.error) {
    if (String(r.error.code) === "23505") throw rifiuta("slug_occupato", 409, "Questo indirizzo è già usato da un'altra categoria.");
    dati(d, "aggiorna", r);
  }
  if (!Array.isArray(r.data) || r.data.length === 0) throw conflitto("La categoria è stata modificata da qualcun altro nel frattempo: ricarica e riprova.");
}

const idDi = (x: unknown): string => {
  if (!eUuid(x)) throw rifiuta("valore", 400, "La categoria indicata non è valida.");
  return x;
};
const versioneDi = (x: unknown): string => {
  if (typeof x !== "string" || x.length > 40 || Number.isNaN(Date.parse(x))) throw rifiuta("valore", 400, "Manca la versione della categoria: ricarica la pagina.");
  return x;
};
const testoOpzionale = (x: unknown, max: number, nome: string): string | null => {
  if (x === null || x === undefined) return null;
  if (typeof x !== "string") throw rifiuta("valore", 400, `${nome} non è valido.`);
  const t = x.trim();
  if (t.length > max) throw rifiuta("valore", 400, `${nome} può avere al massimo ${max} caratteri.`);
  return t || null;
};
const nomeDi = (x: unknown): string => {
  if (typeof x !== "string" || !x.trim()) throw rifiuta("valore", 400, "Scrivi il nome della categoria.");
  if (x.trim().length > MAX_NOME) throw rifiuta("valore", 400, `Il nome può avere al massimo ${MAX_NOME} caratteri.`);
  return x.trim();
};
const slugDi = (x: unknown): string => {
  if (typeof x !== "string" || !slugValido(x)) throw rifiuta("valore", 400, "L'indirizzo non è valido: solo lettere minuscole, numeri e trattini.");
  return x;
};
const FRASE_SLUG_OCCUPATO = "Questo indirizzo è già usato da un'altra categoria.";

/** I campi che il corpo porta (quelli assenti non cambiano), già controllati. Colonna → valore. */
function campiDelCorpo(corpo: Riga, nuova: boolean): Riga {
  const patch: Riga = {};
  if (nuova || "nome" in corpo) patch.nome = nomeDi(corpo.nome);
  if ("slug" in corpo) patch.slug = slugDi(corpo.slug);
  if ("tipo" in corpo) {
    if (typeof corpo.tipo !== "string" || !TIPI.includes(corpo.tipo)) throw rifiuta("valore", 400, "Il tipo deve essere «categoria» o «collezione».");
    patch.tipo = corpo.tipo;
  }
  if ("frase" in corpo) patch.frase = testoOpzionale(corpo.frase, MAX_FRASE, "La frase");
  if ("seoTitolo" in corpo) patch.seo_titolo = testoOpzionale(corpo.seoTitolo, TETTI.seoTitolo, "Il titolo per Google");
  if ("seoDescrizione" in corpo) patch.seo_descrizione = testoOpzionale(corpo.seoDescrizione, TETTI.seoDescrizione, "La descrizione per Google");
  return patch;
}

async function salva(corpo: Riga, chi: string, d: PorteDb) {
  const nuova = corpo.id === undefined;
  const id = nuova ? null : idDi(corpo.id);
  const versione = nuova ? null : versioneDi(corpo.versione);
  const patch = campiDelCorpo(corpo, nuova);
  const tutte = await leggiTutte(d);
  const slugUsato = (slug: unknown) => tutte.some((r) => r.slug === slug && r.id !== id);

  if (id === null) {
    const slug = typeof patch.slug === "string" ? patch.slug : slugDi(slugDa(patch.nome));
    if (slugUsato(slug)) throw rifiuta("slug_occupato", 409, FRASE_SLUG_OCCUPATO);
    const ordine = tutte.reduce((m, r) => Math.max(m, typeof r.ordine === "number" ? r.ordine : 0), 0) + 1;
    const r = await d.db.from("shop_categorie").insert({ tipo: "categoria", ...patch, slug, ordine, visibile: false }).select("*");
    if (r.error && String(r.error.code) === "23505") throw rifiuta("slug_occupato", 409, FRASE_SLUG_OCCUPATO);
    const nata = righe(dati(d, "inserisci", r))[0];
    const nataId = nata && typeof nata.id === "string" ? nata.id : null;
    if (!nata || !nataId) throw guasto(d, "inserisci", { code: "risposta" });
    const cambi = Object.entries({ ...patch, slug }).filter(([, v]) => v !== null).map(([campo, dopo]) => ({ campo, prima: null, dopo }));
    return { categoria: { id: nataId, slug, versione: typeof nata.aggiornato_il === "string" ? nata.aggiornato_il : null }, storico: await scriviStorico(d, "categoria", nataId, cambi, chi) };
  }

  const corrente = tutte.find((r) => r.id === id);
  if (!corrente) throw rifiuta("non_trovato", 404, "Categoria non trovata.");
  if (!stessoIstante(versione, corrente.aggiornato_il)) throw conflitto("La categoria è stata modificata da qualcun altro nel frattempo: ricarica e riprova.");
  if (typeof patch.slug === "string" && patch.slug !== corrente.slug) {
    if (corrente.pubblicata_il) throw rifiuta("slug_bloccato", 409, "L'indirizzo di una categoria già pubblicata non si cambia: i link già condivisi smetterebbero di funzionare.");
    if (slugUsato(patch.slug)) throw rifiuta("slug_occupato", 409, FRASE_SLUG_OCCUPATO);
  }
  const cambi = Object.entries(patch).filter(([campo, dopo]) => (corrente[campo] ?? null) !== dopo).map(([campo, dopo]) => ({ campo, prima: corrente[campo] ?? null, dopo }));
  const slugDopo = typeof patch.slug === "string" ? patch.slug : String(corrente.slug);
  if (!cambi.length) return { categoria: { id, slug: slugDopo, versione: corrente.aggiornato_il }, cambiato: false };
  await aggiorna(d, id, String(corrente.aggiornato_il), Object.fromEntries(cambi.map((x) => [x.campo, x.dopo])));
  const nuovaVersione = await versioneAttuale(d, "shop_categorie", id);
  return { categoria: { id, slug: slugDopo, versione: nuovaVersione }, cambiato: true, storico: await scriviStorico(d, "categoria", id, cambi, chi) };
}

async function visibile(corpo: Riga, chi: string, d: PorteDb) {
  const id = idDi(corpo.id);
  const versione = versioneDi(corpo.versione);
  if (typeof corpo.visibile !== "boolean") throw rifiuta("valore", 400, "Dì se la categoria deve essere visibile o no.");
  const corrente = (await leggiTutte(d)).find((r) => r.id === id);
  if (!corrente) throw rifiuta("non_trovato", 404, "Categoria non trovata.");
  if (!stessoIstante(versione, corrente.aggiornato_il)) throw conflitto("La categoria è stata modificata da qualcun altro nel frattempo: ricarica e riprova.");
  if (corrente.visibile === corpo.visibile) return { cambiato: false, versione: corrente.aggiornato_il };
  const patch: Riga = { visibile: corpo.visibile };
  // la prima volta che esce si ricorda quando: da quel momento l'indirizzo non si cambia più
  if (corpo.visibile && !corrente.pubblicata_il) patch.pubblicata_il = d.adesso().toISOString();
  await aggiorna(d, id, String(corrente.aggiornato_il), patch);
  return { cambiato: true, versione: await versioneAttuale(d, "shop_categorie", id), storico: await scriviStorico(d, "categoria", id, [{ campo: "visibile", prima: corrente.visibile, dopo: corpo.visibile }], chi) };
}

async function ordina(corpo: Riga, chi: string, d: PorteDb) {
  const ids = corpo.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_CATEGORIE || !ids.every(eUuid) || new Set(ids).size !== ids.length)
    throw rifiuta("valore", 400, "L'elenco delle categorie non è valido.");
  const tutte = await leggiTutte(d);
  // l'elenco deve essere TUTTE le categorie: se ne è nata o sparita una, chi ordina guardava una lista vecchia
  if (tutte.length !== ids.length || !tutte.every((r) => ids.includes(r.id as string)))
    throw conflitto("L'elenco delle categorie è cambiato nel frattempo: ricarica e riordina.");
  let storico = true;
  // shortcut: un aggiornamento per ogni categoria spostata, senza transazione; riordinare è ripetibile e, se si ferma a metà, basta rifarlo
  for (const [posizione, id] of ids.entries()) {
    const corrente = tutte.find((r) => r.id === id);
    if (!corrente || corrente.ordine === posizione + 1) continue;
    await aggiorna(d, id as string, null, { ordine: posizione + 1 });
    storico = (await scriviStorico(d, "categoria", id as string, [{ campo: "ordine", prima: corrente.ordine, dopo: posizione + 1 }], chi)) && storico;
  }
  return { storico };
}

/** La foto della categoria. Il percorso è quello che ha dato `media.server.ts` (cartella `foto/`); l'alt è obbligatorio.
 *  Si scrive in due posti: `shop_categorie.foto_path` (la colonna che le viste pubbliche leggono) e una riga di `shop_media`
 *  (slot «principale» della categoria) che porta il testo alternativo, perché `shop_categorie` non ha una colonna per l'alt.
 *  La foto di prima non si cancella: la sua riga di `shop_media` prende `rimosso_il`. */
async function fotoDellaCategoria(corpo: Riga, chi: string, d: PorteDb) {
  const id = idDi(corpo.categoriaId);
  const versione = versioneDi(corpo.versione);
  const path = corpo.path;
  if (!percorsoShopValido(path) || !path.startsWith("foto/")) throw rifiuta("valore", 400, "Il percorso della foto non è valido: carica prima la foto dal pannello.");
  const alt = typeof corpo.alt === "string" ? corpo.alt.trim() : "";
  if (!alt) throw rifiuta("valore", 400, "Descrivi la foto per chi non la vede: il testo alternativo è obbligatorio.");
  if (alt.length > TETTI.alt) throw rifiuta("valore", 400, `Il testo alternativo può avere al massimo ${TETTI.alt} caratteri.`);
  const testo = controllaTesto(alt);
  if (testo.bloccanti.length) throw rifiuta("valore", 400, testo.bloccanti[0].frase);

  const corrente = (await leggiTutte(d)).find((r) => r.id === id);
  if (!corrente) throw rifiuta("non_trovato", 404, "Categoria non trovata.");
  if (!stessoIstante(versione, corrente.aggiornato_il)) throw conflitto("La categoria è stata modificata da qualcun altro nel frattempo: ricarica e riprova.");
  await aggiorna(d, id, String(corrente.aggiornato_il), { foto_path: path });
  // shortcut: tre scritture senza transazione (categoria, vecchia foto tolta, foto nuova); se cade a metà basta ripetere il salvataggio
  const adesso = d.adesso().toISOString();
  dati(d, "foto", await d.db.from("shop_media").update({ rimosso_il: adesso }).eq("categoria_id", id).is("rimosso_il", null));
  dati(d, "foto", await d.db.from("shop_media").insert({ categoria_id: id, slot: "principale", tipo: "foto", path_960: path, alt, ordine: 0 }));
  const storico = await scriviStorico(d, "categoria", id, [{ campo: "foto", prima: corrente.foto_path ?? null, dopo: path }], chi);
  return {
    categoria: { id, slug: String(corrente.slug), versione: await versioneAttuale(d, "shop_categorie", id) },
    avvisi: testo.avvisi.map((a) => a.frase),
    storico,
  };
}

const MAX_CATEGORIE_PRODOTTO = 20;

/** Sostituisce l'insieme delle categorie di un prodotto. Una riga di storico (campo «categorie», prima e dopo come elenchi di slug). */
async function categorieDelProdotto(corpo: Riga, chi: string, d: PorteDb) {
  const prodottoId = idDi(corpo.prodottoId);
  const versione = versioneDi(corpo.versione);
  const ids = corpo.categorie;
  if (!Array.isArray(ids) || ids.length > MAX_CATEGORIE_PRODOTTO || !ids.every(eUuid) || new Set(ids).size !== ids.length)
    throw rifiuta("valore", 400, "L'elenco delle categorie non è valido.");

  const prodotto = righe(dati(d, "lettura", await d.db.from("shop_prodotti").select("id, stato, aggiornato_il").eq("id", prodottoId).limit(1)))[0];
  if (!prodotto) throw rifiuta("non_trovato", 404, "Prodotto non trovato.");
  if (!stessoIstante(versione, prodotto.aggiornato_il)) throw conflitto("Il prodotto è stato modificato da qualcun altro nel frattempo: ricarica e riprova.");
  const tutte = await leggiTutte(d);
  if (!ids.every((id) => tutte.some((k) => k.id === id))) throw rifiuta("categoria_inesistente", 404, "Una delle categorie scelte non esiste più: ricarica la pagina.");
  if (prodotto.stato === "pubblicato" && ids.length === 0)
    throw rifiuta("categoria_mancante", 409, "Un prodotto pubblicato deve avere almeno una categoria: scegline una oppure mettilo in bozza.");

  const attuali = righe(dati(d, "lettura", await d.db.from("shop_prodotti_categorie").select("categoria_id").eq("prodotto_id", prodottoId).limit(500))).map((r) => String(r.categoria_id));
  const aggiunte = ids.filter((id) => !attuali.includes(id));
  const tolte = attuali.filter((id) => !ids.includes(id));
  if (!aggiunte.length && !tolte.length) return { categorie: ids, cambiato: false, versione: prodotto.aggiornato_il };

  // il confronto-e-scambio sulla versione del prodotto: 0 righe = l'ha cambiato un altro (o ha cambiato le categorie)
  const passo = await d.db.from("shop_prodotti").update({ aggiornato_il: d.adesso().toISOString() }).eq("id", prodottoId).eq("aggiornato_il", String(prodotto.aggiornato_il)).select("id");
  if (righe(dati(d, "aggiorna", passo)).length === 0) throw conflitto("Il prodotto è stato modificato da qualcun altro nel frattempo: ricarica e riprova.");
  // shortcut: due scritture senza transazione (prima si aggiunge, poi si toglie); se la seconda cade, il prodotto ha una categoria in più e basta riprovare
  if (aggiunte.length) dati(d, "legami", await d.db.from("shop_prodotti_categorie").insert(aggiunte.map((categoria_id) => ({ prodotto_id: prodottoId, categoria_id }))));
  if (tolte.length) dati(d, "legami", await d.db.from("shop_prodotti_categorie").delete().eq("prodotto_id", prodottoId).in("categoria_id", tolte));
  const slugs = (elenco: string[]) => elenco.map((id) => String(tutte.find((k) => k.id === id)?.slug ?? id)).sort();
  const storico = await scriviStorico(d, "prodotto", prodottoId, [{ campo: "categorie", prima: slugs(attuali), dopo: slugs(ids) }], chi);
  return { categorie: ids, cambiato: true, versione: await versioneAttuale(d, "shop_prodotti", prodottoId), storico };
}

/* ── i gestori ───────────────────────────────────────────────────────── */

export async function eseguiCategorie(azione: string, corpo: Riga, chi: string, d: PorteDb) {
  if (azione === "categoria_salva") return salva(corpo, chi, d);
  if (azione === "categoria_visibile") return visibile(corpo, chi, d);
  if (azione === "prodotto_categorie") return categorieDelProdotto(corpo, chi, d);
  if (azione === "categoria_foto") return fotoDellaCategoria(corpo, chi, d);
  return ordina(corpo, chi, d);
}

export const gestisciGET = (request: Request, d: PorteDb): Promise<Response> =>
  gestisci(request, d, async () => {
    if (!new URL(request.url).searchParams.has("categorie")) throw rifiuta("azione_sconosciuta", 400, "Questa lettura non è prevista.");
    return { categorie: await leggiCategorie(d) };
  });

export const gestisciPOST = (request: Request, d: PorteDb): Promise<Response> =>
  gestisci(request, d, async (chi) => {
    const corpo = await leggiCorpo(request);
    return eseguiCategorie(azioneDi(corpo, AZIONI_CATEGORIE), corpo, chi, d);
  });
