/** ── IL CMS DEI PRODOTTI: IL SERVER (prodotti.server.ts) ────────────────────
 *  Commessa 2026-11-20-shop-completo (T08). Tutto ciò che fanno prodotti, varianti, media e stato in
 *  `/api/crm/negozio` TRANNE il collegamento a `guardiaCRM` e al client Supabase: quelli stanno nella rotta (T10).
 *  Qui si ricevono PORTE (guardia, database, orologio, log, chiave di servizio): si prova con finti, senza rete né chiavi.
 *  ⚠️ Deve restare importabile senza ambiente: niente `process.env`, niente client creato a livello di modulo.
 *
 *  GET ?prodotti[&segmento=&categoria=&q=] → elenco, ogni riga col primo motivo per cui non è pubblicabile
 *  GET ?prodotto=<id>                       → scheda completa (varianti, media, bozza, storico, esito di `controllaPubblicazione`)
 *  POST { azione, … }                       → `AZIONI_PRODOTTI`; altre azioni (giacenza, categorie, interruttori) sono di T09
 *  Risposte: `{ ok: true, … }` oppure `{ ok: false, motivo, frase }` (la frase in italiano la scrive il server).
 *
 *  ── LE REGOLE CHE TIENE ─────────────────────────────────────────────────────
 *  · La guardia («pagamenti») apre ogni gestore: prima niente si legge e niente si scrive.
 *  · Nessuna cancellazione, da nessuna parte (D5): si archivia, una foto «rimossa» ha `rimosso_il`.
 *  · Un prodotto PUBBLICATO: i testi (campi di `CampiProdotto`) vanno in `bozza_modifiche`, il sito resta com'è finché
 *    non si preme «Pubblica le modifiche» (D27). Prezzo, varianti e foto cambiano subito, MA un salvataggio che
 *    lo renderebbe non pubblicabile è rifiutato (eccezione: il ritiro per liberatoria revocata lo riporta in bozza, con un avviso).
 *  · Pubblicare ripete TUTTI i controlli di `controllaPubblicazione` (la stessa funzione del pannello).
 *  · Ogni campo cambiato lascia una riga in `shop_storico` (chi, prima, dopo). La scheda porta `versione`
 *    (`aggiornato_il`): se è cambiata → 409.
 *  · Nei log SOLO codici: mai l'oggetto errore, mai testi del cliente o del titolare. */
import {
  MAX_CENT,
  MAX_COMBINAZIONI,
  SLOT,
  SOTTO_RUOLI,
  TETTI,
  combinazioni,
  normalizzaCaratteristiche,
  skuValido,
  slugDa,
  slugValido,
  type Canali,
  type Media,
  type Prodotto,
} from "../../shop/cms/modello";
import {
  controllaPubblicazione,
  skuLibero,
  type EsitoPubblicazione,
  type SkuUsato,
} from "../../shop/cms/pubblicazione";
import { statoDisponibilita } from "../../shop/cms/giacenza";
import { controllaTesto } from "../../shop/cms/testi";
import { emettiChiaveAnteprima } from "../../shop/cms/anteprima";
import {
  faq as leggiFaq,
  mediaDaRiga,
  oggetto,
  prodottoDaRiga,
  varianteDaRiga,
  type VarianteLetta,
} from "../../shop/cms/righe";

/* ══ LE PORTE ═══════════════════════════════════════════════════════════════ */

interface EsitoDb {
  data: unknown;
  error: { code?: unknown } | null;
}
/** Il pezzo di costruttore di query di Supabase che serve qui (il finto delle prove ha lo stesso aspetto). */
export interface Costruttore extends PromiseLike<EsitoDb> {
  select(colonne?: string): Costruttore;
  insert(righe: Record<string, unknown> | Record<string, unknown>[]): Costruttore;
  update(patch: Record<string, unknown>): Costruttore;
  eq(colonna: string, valore: unknown): Costruttore;
  in(colonna: string, valori: string[]): Costruttore;
  is(colonna: string, valore: null): Costruttore;
  order(colonna: string, opzioni?: { ascending?: boolean }): Costruttore;
  limit(n: number): Costruttore;
  single(): Costruttore;
}
export interface ClienteDb {
  from(tabella: string): Costruttore;
  /** Le funzioni SQL (la giacenza si muove solo con `shop_giacenza_muovi`). */
  rpc(nome: string, args: Record<string, unknown>): PromiseLike<EsitoDb>;
}
export interface DipendenzeProdotti {
  /** La guardia del CRM («pagamenti»): `ok` col nome di chi chiama, oppure la risposta 401/403 da restituire così com'è. */
  guardia: (request: Request) => Promise<{ ok: true; nome: string } | { ok: false; risposta: Response }>;
  db: ClienteDb;
  adesso: () => Date;
  /** Solo CODICI. */
  log: (codice: string) => void;
  /** La chiave di servizio, da cui si deriva la chiave dell'anteprima (D16/D31). `undefined` = non c'è. */
  chiaveServizio: () => string | undefined;
}

/* ══ COSTANTI E AIUTI ═══════════════════════════════════════════════════════ */

export const AZIONI_PRODOTTI = [
  "prodotto_crea", "prodotto_salva", "prodotto_pubblica_modifiche", "prodotto_scarta_modifiche", "prodotto_stato",
  "prodotto_duplica", "prodotto_adotta", "gruppo_stato", "anteprima_chiave", "variante_salva", "varianti_genera",
  "variante_attiva", "media_registra", "media_ordina", "media_alt", "media_flag", "media_rimuovi",
] as const;

const MANCANTI = ["42703", "42P01", "PGRST204", "PGRST205", "PGRST202"];
const MAX_CORPO = 200_000;
/** Ogni prodotto pubblicato è una scrittura con i suoi controlli: poche per richiesta. */
const MAX_GRUPPO = 20;
/** Lo stesso tetto delle combinazioni e del database (250). */
const MAX_VARIANTI = MAX_COMBINAZIONI;
/** shortcut: l'elenco legge fino a questo numero di prodotti (il catalogo parte da 33); si pagina se un giorno serve. */
const MAX_PRODOTTI = 1000;
const TIPI = ["patch", "cura", "kit"];
const STATI = ["bozza", "pubblicato", "archiviato"];

const json = (o: unknown, stato = 200): Response =>
  new Response(JSON.stringify(o), { status: stato, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const codiceDi = (e: { code?: unknown } | null | undefined): string => String(e?.code ?? "?").replace(/[^A-Za-z0-9_]/g, "").slice(0, 12) || "?";
const nomeDi = (e: unknown): string => String((e as { name?: unknown } | null)?.name ?? "?").replace(/[^A-Za-z0-9_]/g, "").slice(0, 30) || "?";
const eId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{1,64}$/.test(v);

class Rifiuto extends Error {
  constructor(readonly motivo: string, readonly stato: number, readonly frase: string, readonly extra: Record<string, unknown> = {}) {
    super(motivo);
  }
}
const rifiuta = (motivo: string, stato: number, frase: string, extra?: Record<string, unknown>) => new Rifiuto(motivo, stato, frase, extra);
const valore = (frase: string) => rifiuta("valore", 400, frase);
const NON_TROVATO = () => rifiuta("non_trovato", 404, "Prodotto non trovato.");
const CONFLITTO = () => rifiuta("conflitto", 409, "Un'altra persona ha modificato questo prodotto nel frattempo: ricarica la scheda e riprova.");
/** La colonna `costo_cent` arriva con la migrazione 20261125: finché non c'è, il costo resta spento (SPEC criterio 3). */
const COSTO_SPENTO = () => rifiuta("migrazione", 409, "Per il costo serve un aggiornamento del database: chiedi a chi gestisce il database di applicarlo.");
const MIGRAZIONE = () =>
  rifiuta("migrazione", 409, "Mancano gli aggiornamenti del database del catalogo: chiedi a chi gestisce il database di applicarli.");

/** Esegue una query: gli errori diventano un `Rifiuto` con la frase (e nel log solo il codice). */
async function q(d: DipendenzeProdotti, dove: string, p: PromiseLike<EsitoDb>): Promise<unknown> {
  const r = await p;
  if (!r.error) return r.data;
  const codice = codiceDi(r.error);
  if (MANCANTI.includes(codice)) throw MIGRAZIONE();
  if (codice === "23505") throw rifiuta("duplicato", 409, "Questo SKU o questo indirizzo è già usato da un altro prodotto.");
  if (codice === "23503") throw valore("Il prodotto o la categoria indicati non esistono.");
  if (codice === "23514") throw rifiuta("non_pubblicabile", 422, "Il database non permette questa modifica: controlla i dati e riprova.");
  d.log(`${dove} ${codice}`);
  throw rifiuta("interno", 500, "Il database non ha risposto: riprova tra un momento.");
}
const righe = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? x.flatMap((r): Record<string, unknown>[] => { const o = oggetto(r); return o ? [o] : []; }) : []);

/** Tra due media dello stesso slot (e per ogni elenco): `ordine`, poi `id`. Mai l'ordine d'arrivo, mai la data. */
export const ordinaMedia = <T extends { ordine: number; id: string }>(m: readonly T[]): T[] =>
  [...m].sort((a, b) => a.ordine - b.ordine || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/* ══ LO STATO DI UN PRODOTTO ════════════════════════════════════════════════ */

interface Stato {
  riga: Record<string, unknown>;
  prodotto: Prodotto;
  varianti: VarianteLetta[];
  /** Solo i media non rimossi. */
  media: Media[];
  categorie: string[];
  /** Il costo di ogni variante, letto dalla riga grezza: `varianteDaRiga` non lo porta (non deve mai arrivare al sito). Colonna assente = tutti `null`. */
  costi: Record<string, number | null>;
}
interface SkuNoto extends SkuUsato {
  varianteId: string | null;
}

async function carica(d: DipendenzeProdotti, id: unknown): Promise<Stato> {
  if (!eId(id)) throw valore("Il prodotto indicato non è valido.");
  const riga = righe(await q(d, "prodotto", d.db.from("shop_prodotti").select("*").eq("id", id).limit(1)))[0];
  const prodotto = riga && prodottoDaRiga(riga);
  if (!riga || !prodotto) throw NON_TROVATO();
  const [v, m, c] = await Promise.all([
    q(d, "varianti", d.db.from("shop_varianti").select("*").eq("prodotto_id", id)),
    q(d, "media", d.db.from("shop_media").select("*").eq("prodotto_id", id).is("rimosso_il", null)),
    q(d, "categorie", d.db.from("shop_prodotti_categorie").select("categoria_id").eq("prodotto_id", id)),
  ]);
  const costi: Record<string, number | null> = {};
  for (const x of righe(v)) if (typeof x.id === "string") costi[x.id] = typeof x.costo_cent === "number" && Number.isInteger(x.costo_cent) ? x.costo_cent : null;
  return {
    riga,
    prodotto,
    costi,
    varianti: righe(v).flatMap((x) => varianteDaRiga(x) ?? []).sort((a, b) => a.ordine - b.ordine || (a.id < b.id ? -1 : 1)),
    media: ordinaMedia(righe(m).flatMap((x) => mediaDaRiga(x) ?? [])),
    categorie: righe(c).flatMap((x) => (typeof x.categoria_id === "string" ? [x.categoria_id] : [])),
  };
}

/** Gli SKU `skus` che sono già in uso, di prodotti e di varianti, col prodotto a cui appartengono. Si chiede al database
 *  proprio di QUEGLI SKU (non si carica un elenco): vale anche con un catalogo che supera ogni tetto. */
async function skuNoti(d: DipendenzeProdotti, skus: readonly string[]): Promise<SkuNoto[]> {
  const lista = [...new Set(skus.filter((x): x is string => typeof x === "string" && x !== ""))];
  if (!lista.length) return [];
  const [p, v] = await Promise.all([
    q(d, "sku", d.db.from("shop_prodotti").select("id,sku").in("sku", lista)),
    q(d, "sku", d.db.from("shop_varianti").select("id,prodotto_id,sku").in("sku", lista)),
  ]);
  return [
    ...righe(p).flatMap((r) => (typeof r.id === "string" && typeof r.sku === "string" ? [{ sku: r.sku, prodottoId: r.id, varianteId: null }] : [])),
    ...righe(v).flatMap((r) => (typeof r.id === "string" && typeof r.prodotto_id === "string" && typeof r.sku === "string" ? [{ sku: r.sku, prodottoId: r.prodotto_id, varianteId: r.id }] : [])),
  ];
}
/** Gli SKU di un prodotto: il suo e quelli delle sue varianti. */
const skusDi = (s: Stato): string[] => [s.prodotto.sku, ...s.varianti.map((v) => v.sku)];

/** La colonna `costo_cent` c'è? Si chiede al database (una riga): `false` solo se manca davvero, un guasto resta un guasto. */
async function costoDisponibile(d: DipendenzeProdotti): Promise<boolean> {
  try {
    await q(d, "costo", d.db.from("shop_varianti").select("costo_cent").limit(1));
    return true;
  } catch (e) {
    if (e instanceof Rifiuto && e.motivo === "migrazione") return false;
    throw e;
  }
}

/** Gli stessi controlli del pannello «Prima di pubblicare». Nel R1 la spedizione non è ancora valutabile (`null`). */
const controlla = (s: Stato, tutti: readonly SkuUsato[]): EsitoPubblicazione =>
  controllaPubblicazione(s.prodotto, s.varianti, s.media, s.categorie, { spedizioneImpostata: null, tuttiGliSku: tutti });

const chiaveVoce = (v: { campo: string; frase: string }) => `${v.campo}|${v.frase}`;

/** Un prodotto PUBBLICATO non deve diventare non pubblicabile per colpa di una modifica: i bloccanti nuovi (che prima non c'erano) la rifiutano. */
function nonPeggiora(prima: Stato, dopo: Stato, tutti: readonly SkuUsato[]): void {
  if (prima.prodotto.stato !== "pubblicato") return;
  const vecchi = new Set(controlla(prima, tutti).bloccanti.map(chiaveVoce));
  const nuovi = controlla(dopo, tutti).bloccanti.filter((b) => !vecchi.has(chiaveVoce(b)));
  if (nuovi.length)
    throw rifiuta("non_pubblicabile", 422, `${nuovi[0].frase} Il prodotto è sul sito: la modifica non è stata salvata.`, { bloccanti: nuovi });
}

/* ══ I CAMPI DEL PRODOTTO ═══════════════════════════════════════════════════ */

/** I campi che, su un prodotto pubblicato, vanno in `bozza_modifiche` (D27). */
const CAMPI_BOZZA = [
  "nome", "tipo", "marca", "rigaPresentazione", "descrizioneBreve", "descrizioneLunga", "perChi", "caratteristiche", "passi",
  "confezione", "avvertenze", "faq", "resoConsentito", "resoGiorni", "boxConsulenza", "correlatoId", "canali", "seoTitolo",
  "seoDescrizione", "seoMediaId",
] as const;
const CONTENUTO = ["passi", "confezione", "avvertenze", "faq"];
const COLONNA: Record<string, string> = {
  nome: "nome", tipo: "tipo", marca: "marca", rigaPresentazione: "riga_presentazione", descrizioneBreve: "descrizione_breve",
  descrizioneLunga: "descrizione_lunga", perChi: "per_chi", caratteristiche: "caratteristiche", resoConsentito: "reso_consentito",
  resoGiorni: "reso_giorni", boxConsulenza: "box_consulenza", correlatoId: "correlato_id", canali: "canali", seoTitolo: "seo_titolo",
  seoDescrizione: "seo_descrizione", seoMediaId: "seo_media_id", sku: "sku", slug: "slug", prezzoCent: "prezzo_cent", gtin: "gtin", mpn: "mpn",
  categoriaGoogle: "categoria_google", pesoG: "peso_g", classeSpedizione: "classe_spedizione", fornitore: "fornitore",
  schedaTecnicaPath: "scheda_tecnica_path", noteInterne: "note_interne", notaTitolare: "nota_titolare",
};

const testoOpz = (nome: string, max: number) => (v: unknown) => {
  if (v === null) return null;
  if (typeof v !== "string" || v.length > max) throw valore(`«${nome}» deve essere un testo di al massimo ${max} segni.`);
  return v.trim() || null;
};
const testoObb = (nome: string, max: number) => (v: unknown) => {
  const t = testoOpz(nome, max)(v);
  if (!t) throw valore(`«${nome}» non può essere vuoto.`);
  return t;
};
const elenco = (nome: string) => (v: unknown) => {
  if (!Array.isArray(v) || v.length > 30 || v.some((t) => typeof t !== "string" || t.length > 500)) throw valore(`«${nome}»: al massimo 30 voci di testo, di al massimo 500 segni.`);
  return v.map((t) => (t as string).trim()).filter(Boolean);
};
const interoIn = (nome: string, max: number) => (v: unknown) => {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > max) throw valore(`«${nome}» deve essere un numero intero da 0 a ${max}.`);
  return v;
};
const bool = (nome: string) => (v: unknown) => {
  if (typeof v !== "boolean") throw valore(`«${nome}» deve essere sì o no.`);
  return v;
};
const VALIDA: Record<string, (v: unknown) => unknown> = {
  nome: testoObb("Nome", 120),
  tipo: (v) => {
    if (typeof v !== "string" || !TIPI.includes(v)) throw valore("Il tipo deve essere patch, cura o kit.");
    return v;
  },
  marca: testoOpz("Marca", 80),
  rigaPresentazione: testoOpz("Riga di presentazione", TETTI.riga),
  descrizioneBreve: testoOpz("Descrizione breve", TETTI.breve),
  descrizioneLunga: testoOpz("Descrizione lunga", 5000),
  perChi: testoOpz("Per chi è", 200),
  caratteristiche: (v) => {
    if (!Array.isArray(v) || v.length > 40) throw valore("Le caratteristiche sono al massimo 40.");
    const norm = normalizzaCaratteristiche(v);
    if (norm.some((r) => r.etichetta.length > 80 || r.valore.length > 300)) throw valore("Una caratteristica è troppo lunga (etichetta 80 segni, valore 300).");
    if (norm.some((r) => r.stato === "confermato" && !r.fonte)) throw valore("Una caratteristica «confermata» ha bisogno della fonte (la scheda del fornitore o il file).");
    return norm;
  },
  passi: elenco("Come si usa"),
  confezione: elenco("Nella confezione"),
  avvertenze: elenco("Avvertenze"),
  faq: (v) => {
    if (!Array.isArray(v) || v.length > 20) throw valore("Le domande frequenti sono al massimo 20.");
    const f = leggiFaq(v);
    if (f.some((x) => x.d.length > 300 || x.r.length > 1500)) throw valore("Una domanda frequente è troppo lunga.");
    return f;
  },
  resoConsentito: (v) => (v === null ? null : bool("Reso consentito")(v)),
  resoGiorni: interoIn("Giorni per il reso", 365),
  boxConsulenza: bool("Box consulenza"),
  correlatoId: (v) => {
    if (v !== null && !eId(v)) throw valore("Il prodotto collegato non è valido.");
    return v;
  },
  canali: (v) => {
    const o = oggetto(v);
    const k: (keyof Canali)[] = ["sito", "meta", "google", "tiktok"];
    if (!o || k.some((c) => typeof o[c] !== "boolean") || Object.keys(o).length !== 4) throw valore("I canali sono quattro interruttori: sito, Meta, Google, TikTok.");
    return { sito: o.sito, meta: o.meta, google: o.google, tiktok: o.tiktok };
  },
  seoTitolo: testoOpz("Titolo SEO", 300),
  seoDescrizione: testoOpz("Descrizione SEO", 500),
  seoMediaId: (v) => {
    if (v !== null && !eId(v)) throw valore("L'immagine di condivisione non è valida.");
    return v;
  },
  sku: (v) => {
    if (typeof v !== "string" || !skuValido(v)) throw valore("Lo SKU non è valido: maiuscolo, senza spazi, da 2 a 40 segni (per esempio HG-T01).");
    return v;
  },
  slug: (v) => {
    if (typeof v !== "string" || !slugValido(v)) throw valore("L'indirizzo non è valido: minuscole, numeri e trattini (per esempio lace-front).");
    return v;
  },
  prezzoCent: (v) => {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_CENT) throw valore("Il prezzo non è valido.");
    return v;
  },
  gtin: testoOpz("GTIN", 20),
  mpn: testoOpz("MPN", 40),
  categoriaGoogle: testoOpz("Categoria Google", 200),
  pesoG: interoIn("Peso", 1_000_000),
  classeSpedizione: testoOpz("Classe di spedizione", 40),
  fornitore: testoOpz("Fornitore", 200),
  schedaTecnicaPath: testoOpz("Scheda tecnica", 300),
  noteInterne: testoOpz("Note", 5000),
  notaTitolare: testoOpz("Nota", 2000),
};

/** Tutti i testi scritti in un valore (anche dentro elenchi e coppie), per cercare ciò che non si può scrivere. */
const testiDi = (v: unknown): string[] =>
  typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(testiDi) : v && typeof v === "object" ? Object.values(v).flatMap(testiDi) : [];

/** Controlla e normalizza i campi ricevuti. Un campo sconosciuto o un testo che non si può scrivere (cifre vicino a «Invisible Derm», sconti) è un rifiuto. */
function validaCampi(campi: unknown): Record<string, unknown> {
  const o = oggetto(campi);
  if (!o || Object.keys(o).length === 0) throw valore("Non c'è niente da salvare.");
  const fuori: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const f = VALIDA[k];
    if (!f) throw valore(`Il campo «${k}» non si può cambiare così.`);
    fuori[k] = f(v);
    nessunTestoVietato(fuori[k]);
  }
  return fuori;
}

const uguali = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** I campi (camelCase) → colonne. I quattro del contenuto si fondono col `contenuto` che c'è già. */
function inColonne(campi: Record<string, unknown>, contenutoAttuale: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let contenuto: Record<string, unknown> | null = null;
  for (const [k, v] of Object.entries(campi)) {
    if (CONTENUTO.includes(k)) (contenuto ??= { ...(oggetto(contenutoAttuale) ?? {}) })[k] = v;
    else out[COLONNA[k]] = v;
  }
  if (contenuto) out.contenuto = contenuto;
  return out;
}

/* ══ LO STORICO E LA SCRITTURA DEL PRODOTTO ═════════════════════════════════ */

interface Ctx {
  d: DipendenzeProdotti;
  chi: string;
  ora: string;
}
const rigaStorico = (c: Ctx, entita: string, id: string, campo: string, prima: unknown, dopo: unknown) => ({
  entita, entita_id: id, campo, prima: prima ?? null, dopo: dopo ?? null, chi: c.chi, creato_il: c.ora,
});
/** Prima il dato, poi lo storico: se lo storico non si scrive il dato resta com'è e lo si dice (`storico: false`). */
async function registra(c: Ctx, rr: ReturnType<typeof rigaStorico>[]): Promise<boolean> {
  if (!rr.length) return true;
  try {
    const r = await c.d.db.from("shop_storico").insert(rr);
    if (r.error) c.d.log(`storico ${codiceDi(r.error)}`);
    return !r.error;
  } catch (e) {
    c.d.log(`storico eccezione ${nomeDi(e)}`);
    return false;
  }
}
/** Due versioni sono la stessa se sono lo stesso ISTANTE: `…Z` e `…+00:00` (il formato di PostgREST) non sono due versioni. */
const stessaVersione = (a: unknown, b: unknown): boolean =>
  typeof a === "string" && typeof b === "string" && (a === b || (Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b)));

/** Scrive il prodotto solo se nessuno l'ha toccato dopo la `versione` letta (0 righe = 409). Restituisce la versione nuova
 *  COME L'HA SCRITTA IL DATABASE (riletta, non quella che gli abbiamo mandato). */
async function scriviProdotto(c: Ctx, s: Stato, patch: Record<string, unknown>): Promise<string> {
  const r = righe(
    await q(
      c.d,
      "prodotto",
      c.d.db.from("shop_prodotti").update({ ...patch, aggiornato_il: c.ora }).eq("id", s.prodotto.id).eq("aggiornato_il", s.riga.aggiornato_il).select("aggiornato_il"),
    ),
  );
  if (r.length === 0) throw CONFLITTO();
  return typeof r[0].aggiornato_il === "string" ? r[0].aggiornato_il : c.ora;
}
/** La bozza di modifica rimasta indietro non deve MAI essere applicata sopra valori più recenti: quando il prodotto cambia stato o si scrivono le colonne vive, si azzera. */
const AZZERA_BOZZA = { bozza_modifiche: null, bozza_modificata_il: null };

/** Un testo che non si può scrivere (cifre vicino a «Invisible Derm», sconti) è un rifiuto, ovunque stia. */
function nessunTestoVietato(...valori: unknown[]): void {
  for (const t of testiDi(valori)) {
    const b = controllaTesto(t).bloccanti[0];
    if (b) throw valore(b.frase);
  }
}

/** Il prodotto com'è dopo aver messo i campi (camelCase) sopra. */
const conCampi = (s: Stato, campi: Record<string, unknown>): Stato => ({ ...s, prodotto: { ...s.prodotto, ...campi } as Prodotto });
const effettivo = (s: Stato, k: string): unknown => (s.prodotto as unknown as Record<string, unknown>)[k];

/* ══ LE AZIONI SUI PRODOTTI ═════════════════════════════════════════════════ */

type Azione = (c: Ctx, corpo: Record<string, unknown>) => Promise<Record<string, unknown>>;

/** Cosa si può dare a `prodotto_crea` dentro `campi`: i campi della scheda, TRANNE quelli che hanno il loro posto (nome, tipo, SKU, indirizzo)
 *  o che puntano a righe che in un prodotto nuovo non esistono (prodotto collegato, immagine di condivisione). */
const FUORI_DA_CREA = ["nome", "tipo", "sku", "slug", "correlatoId", "seoMediaId"];
const MAX_CATEGORIE = 10;
const MAX_PEZZI = 1_000_000;
const eUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const CONTENUTO_VUOTO = { passi: [], confezione: [], avvertenze: [], faq: [] };

function campiDiCrea(campi: unknown, tipo: string): Record<string, unknown> {
  const o = oggetto(campi);
  if (!o) throw valore("I dati del prodotto non sono validi.");
  for (const k of Object.keys(o)) if (FUORI_DA_CREA.includes(k) || !Object.prototype.hasOwnProperty.call(VALIDA, k)) throw valore(`Il campo «${k}» non si può dare così.`);
  if (!Object.keys(o).length) return {};
  const v = validaCampi(o);
  if (v.boxConsulenza === true && tipo !== "patch") throw valore("Il box consulenza si mostra solo sulle patch.");
  return v;
}
function categorieDiCrea(x: unknown): string[] {
  if (!Array.isArray(x) || x.length > MAX_CATEGORIE || !x.every(eUuid)) throw valore(`Le categorie non sono valide (al massimo ${MAX_CATEGORIE}).`);
  return [...new Set(x)];
}
/** La variante «Unica» di un prodotto nuovo: dalla richiesta solo la giacenza (carico iniziale) e il costo; SKU e nome sono quelli del prodotto. */
function unicaDiCrea(x: unknown): { giacenza: number; costoCent: number | null } {
  const o = oggetto(x);
  if (!o || Object.keys(o).some((k) => k !== "giacenza" && k !== "costoCent")) throw valore("Per la variante «Unica» si possono dare solo la giacenza e il costo.");
  return {
    giacenza: o.giacenza == null ? 0 : (interoIn("Giacenza", MAX_PEZZI)(o.giacenza) as number),
    costoCent: o.costoCent === undefined ? null : (interoIn("Costo", MAX_CENT)(o.costoCent) as number | null),
  };
}

/** «Salva bozza» di un prodotto nuovo. La richiesta vecchia (nome, tipo, SKU, indirizzo) crea la sola bozza, come sempre. Con `campi`, `categorie`
 *  e `variante` crea anche la variante «Unica» (con la giacenza come «carico») e lega le categorie.
 *  ⚠️ Tutto si controlla PRIMA del primo insert: indirizzo, SKU fra i prodotti E SKU fra le varianti (uno SKU di variante di un altro prodotto
 *  farebbe nascere la bozza e fallire la Unica: una bozza orfana che il progetto non sa cancellare), categorie, costo. Resta solo la corsa fra
 *  due persone: se un passo DOPO il primo insert fallisce la risposta è `ok:true` con `parziale` (i passi mancati) e la scheda lo dice. */
const prodotto_crea: Azione = async (c, corpo) => {
  const nome = VALIDA.nome(corpo.nome) as string;
  const tipo = VALIDA.tipo(corpo.tipo) as string;
  const sku = VALIDA.sku(corpo.sku) as string;
  const slug = VALIDA.slug(corpo.slug ?? slugDa(nome)) as string;
  nessunTestoVietato(nome);
  const campi = corpo.campi === undefined ? {} : campiDiCrea(corpo.campi, tipo);
  const categorie = corpo.categorie === undefined ? [] : categorieDiCrea(corpo.categorie);
  const unica = corpo.variante === undefined ? null : unicaDiCrea(corpo.variante);
  if (!skuLibero(sku, await skuNoti(c.d, [sku]), null)) throw rifiuta("duplicato", 409, `Lo SKU “${sku}” è già usato da un altro prodotto.`);
  // solo per chiarezza: `shop_prodotti.slug` è UNIQUE e l'insert del prodotto è il primo passo, quindi fallirebbe da solo (23505, stessa frase)
  if (righe(await q(c.d, "crea", c.d.db.from("shop_prodotti").select("id").eq("slug", slug).limit(1))).length)
    throw rifiuta("duplicato", 409, "Questo SKU o questo indirizzo è già usato da un altro prodotto.");
  if (categorie.length && righe(await q(c.d, "crea", c.d.db.from("shop_categorie").select("id").in("id", categorie))).length !== categorie.length)
    throw valore("Una categoria indicata non esiste.");
  if (unica?.costoCent != null && !(await costoDisponibile(c.d))) throw COSTO_SPENTO();

  const r = righe(await q(c.d, "crea", c.d.db.from("shop_prodotti").insert({ sku, slug, nome, tipo, stato: "bozza", prezzo_cent: 0, creato_il: c.ora, aggiornato_il: c.ora, ...inColonne(campi, CONTENUTO_VUOTO) }).select("*")))[0];
  const p = r && prodottoDaRiga(r);
  if (!p) throw rifiuta("interno", 500, "Il prodotto non è stato creato: riprova.");

  // da qui il prodotto c'è: un passo che fallisce si segnala in `parziale`, non si butta via il resto
  const parziale: string[] = [];
  const tenta = async <T>(passo: string, f: () => Promise<T>): Promise<T | null> => {
    try {
      return await f();
    } catch (e) {
      c.d.log(`crea ${passo} ${e instanceof Rifiuto ? e.motivo : nomeDi(e)}`);
      parziale.push(passo);
      return null;
    }
  };
  let variante: VarianteLetta | null = null;
  if (unica) {
    variante = await tenta("variante", async () => {
      const riga = righe(await q(c.d, "crea", c.d.db.from("shop_varianti").insert({
        prodotto_id: p.id, sku, nome: "Unica", opzioni: {}, prezzo_cent: null, giacenza: 0, attiva: true, ordine: 1,
        ...(unica.costoCent !== null ? { costo_cent: unica.costoCent } : {}),
      }).select("*")))[0];
      const v = riga && varianteDaRiga(riga);
      if (!v) throw rifiuta("interno", 500, "La variante non è stata creata.");
      return v;
    });
    if (unica.giacenza > 0) {
      const caricata = variante && (await tenta("giacenza", async () => {
        const g = await c.d.db.rpc("shop_giacenza_muovi", { p_variante: variante!.id, p_delta: unica.giacenza, p_motivo: "carico", p_nota: "Prodotto nuovo", p_chi: c.chi, p_ordine_ref: null });
        if (g.error) throw rifiuta(`db_${codiceDi(g.error)}`, 500, "Il carico non è stato scritto.");
        return true;
      }));
      if (!variante) parziale.push("giacenza");
      else if (caricata) variante = { ...variante, giacenza: unica.giacenza, disponibile: true };
    }
  }
  if (categorie.length)
    await tenta("categorie", async () => void (await q(c.d, "crea", c.d.db.from("shop_prodotti_categorie").insert(categorie.map((categoria_id) => ({ prodotto_id: p.id, categoria_id }))))));
  const storico = await registra(c, [
    rigaStorico(c, "prodotto", p.id, "creato", null, { sku, slug, nome, tipo }),
    ...(variante ? [rigaStorico(c, "variante", variante.id, "creata", null, { sku, nome: "Unica" })] : []),
  ]);
  return { prodotto: p, versione: p.aggiornatoIl, storico, ...(variante ? { variante } : {}), ...(parziale.length ? { parziale } : {}) };
};

const prodotto_salva: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  if (!stessaVersione(corpo.versione, s.riga.aggiornato_il)) throw CONFLITTO();
  const nuovi = validaCampi(corpo.campi);
  const pubblicato = s.prodotto.stato === "pubblicato";
  if (("sku" in nuovi || "slug" in nuovi) && s.prodotto.pubblicatoIl)
    throw valore("Lo SKU e l'indirizzo di un prodotto già pubblicato non si cambiano: i collegamenti e gli ordini li usano.");
  if ("sku" in nuovi && !skuLibero(nuovi.sku as string, await skuNoti(c.d, [nuovi.sku as string]), s.prodotto.id))
    throw rifiuta("duplicato", 409, `Lo SKU “${nuovi.sku}” è già usato da un altro prodotto.`);
  if ((nuovi.boxConsulenza ?? effettivo(s, "boxConsulenza")) === true && (nuovi.tipo ?? effettivo(s, "tipo")) !== "patch")
    throw valore("Il box consulenza si mostra solo sulle patch.");
  if (nuovi.correlatoId === s.prodotto.id) throw valore("Un prodotto non può essere collegato a se stesso.");

  const vivi: Record<string, unknown> = {};
  const inBozza: Record<string, unknown> = {};
  const righeStorico: ReturnType<typeof rigaStorico>[] = [];
  for (const [k, v] of Object.entries(nuovi)) {
    const attuale = pubblicato && (CAMPI_BOZZA as readonly string[]).includes(k) ? (s.prodotto.bozzaModifiche as Record<string, unknown> | null)?.[k] ?? effettivo(s, k) : effettivo(s, k);
    if (uguali(attuale, v)) continue;
    if (pubblicato && (CAMPI_BOZZA as readonly string[]).includes(k)) inBozza[k] = v;
    else vivi[k] = v;
    righeStorico.push(rigaStorico(c, "prodotto", s.prodotto.id, pubblicato && k in inBozza ? `bozza:${k}` : k, attuale, v));
  }
  if (!righeStorico.length) return { cambiati: [], versione: s.prodotto.aggiornatoIl, bozza: false, storico: true };

  if (Object.keys(vivi).length) {
    const dopo = conCampi(s, vivi);
    nonPeggiora(s, dopo, await skuNoti(c.d, [...skusDi(s), ...skusDi(dopo)]));
  }
  const patch = inColonne(vivi, s.riga.contenuto);
  // un prodotto che non è sul sito scrive le colonne vive: una bozza di modifica rimasta indietro non deve più essere applicata
  if (!pubblicato && s.prodotto.bozzaModifiche) {
    Object.assign(patch, AZZERA_BOZZA);
    righeStorico.push(rigaStorico(c, "prodotto", s.prodotto.id, "bozza", s.prodotto.bozzaModifiche, null));
  }
  if (Object.keys(inBozza).length) {
    patch.bozza_modifiche = { ...(s.prodotto.bozzaModifiche ?? {}), ...inBozza };
    patch.bozza_modificata_il = c.ora;
  }
  const versione = await scriviProdotto(c, s, patch);
  const storico = await registra(c, righeStorico);
  return { cambiati: righeStorico.map((r) => r.campo), versione, bozza: Object.keys(inBozza).length > 0, storico };
};

/** Applica la bozza di modifica ai campi vivi, se i controlli lo permettono. */
const prodotto_pubblica_modifiche: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  if (corpo.versione !== undefined && !stessaVersione(corpo.versione, s.riga.aggiornato_il)) throw CONFLITTO();
  const bozza = s.prodotto.bozzaModifiche;
  if (s.prodotto.stato !== "pubblicato" || !bozza || !Object.keys(bozza).length) throw valore("Non ci sono modifiche da pubblicare.");
  const campi = validaCampi(Object.fromEntries(Object.entries(bozza).filter(([k]) => (CAMPI_BOZZA as readonly string[]).includes(k))));
  if ((campi.boxConsulenza ?? s.prodotto.boxConsulenza) === true && (campi.tipo ?? s.prodotto.tipo) !== "patch") throw valore("Il box consulenza si mostra solo sulle patch.");
  const dopo = conCampi(s, campi);
  const esito = controlla(dopo, await skuNoti(c.d, skusDi(dopo)));
  if (esito.bloccanti.length) throw rifiuta("non_pubblicabile", 422, `${esito.bloccanti[0].frase} Le modifiche restano in bozza.`, { bloccanti: esito.bloccanti });
  const cambiati = Object.entries(campi).filter(([k, v]) => !uguali(effettivo(s, k), v));
  const versione = await scriviProdotto(c, s, { ...inColonne(campi, s.riga.contenuto), ...AZZERA_BOZZA });
  const storico = await registra(c, cambiati.map(([k, v]) => rigaStorico(c, "prodotto", s.prodotto.id, k, effettivo(s, k), v)));
  return { cambiati: cambiati.map(([k]) => k), versione, storico };
};

const prodotto_scarta_modifiche: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  if (corpo.versione !== undefined && !stessaVersione(corpo.versione, s.riga.aggiornato_il)) throw CONFLITTO();
  if (!s.prodotto.bozzaModifiche) return { versione: s.prodotto.aggiornatoIl, storico: true };
  const versione = await scriviProdotto(c, s, AZZERA_BOZZA);
  const storico = await registra(c, [rigaStorico(c, "prodotto", s.prodotto.id, "bozza", s.prodotto.bozzaModifiche, null)]);
  return { versione, storico };
};

/** Cambia lo stato (pubblicato, bozza, archiviato). Per pubblicare ripete tutti i controlli. */
async function cambiaStato(c: Ctx, id: unknown, nuovo: unknown, versione?: unknown): Promise<Record<string, unknown>> {
  if (typeof nuovo !== "string" || !STATI.includes(nuovo)) throw valore("Lo stato deve essere bozza, pubblicato o archiviato.");
  const s = await carica(c.d, id);
  if (versione !== undefined && !stessaVersione(versione, s.riga.aggiornato_il)) throw CONFLITTO();
  if (s.prodotto.stato === nuovo) return { versione: s.prodotto.aggiornatoIl, cambiato: false, storico: true };
  if (nuovo === "pubblicato") {
    if (s.prodotto.origine === "codice") throw rifiuta("non_pubblicabile", 422, "Prima usa questo prodotto dal «Vecchio catalogo»: poi puoi completarlo e pubblicarlo.");
    const esito = controlla(s, await skuNoti(c.d, skusDi(s)));
    if (esito.bloccanti.length) {
      const mancano = esito.bloccanti.length;
      throw rifiuta("non_pubblicabile", 422, mancano === 1 ? esito.bloccanti[0].frase : `Mancano ${mancano} cose: ${esito.bloccanti[0].frase}`, { bloccanti: esito.bloccanti });
    }
  }
  // chi torna in bozza (o si archivia, o si pubblica da bozza) lascia dietro la bozza di modifica: le colonne vive sono le uniche valide
  const conBozza = s.prodotto.bozzaModifiche !== null;
  const versioneNuova = await scriviProdotto(c, s, { stato: nuovo, ...(nuovo === "pubblicato" && !s.prodotto.pubblicatoIl ? { pubblicato_il: c.ora } : {}), ...(conBozza ? AZZERA_BOZZA : {}) });
  const storico = await registra(c, [rigaStorico(c, "prodotto", s.prodotto.id, "stato", s.prodotto.stato, nuovo), ...(conBozza ? [rigaStorico(c, "prodotto", s.prodotto.id, "bozza", s.prodotto.bozzaModifiche, null)] : [])]);
  return { versione: versioneNuova, cambiato: true, storico };
}
const prodotto_stato: Azione = (c, corpo) => cambiaStato(c, corpo.prodottoId, corpo.stato, corpo.versione);

const gruppo_stato: Azione = async (c, corpo) => {
  const ids = corpo.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_GRUPPO || !ids.every(eId)) throw valore(`Si possono cambiare al massimo ${MAX_GRUPPO} prodotti alla volta: scegline meno e ripeti.`);
  // «archiviato» = il Cestino dell'elenco (E14): si sposta, non si cancella niente (D5)
  if (corpo.stato !== "pubblicato" && corpo.stato !== "bozza" && corpo.stato !== "archiviato") throw valore("Qui si può solo pubblicare, rimettere in bozza o spostare nel Cestino.");
  let cambiati = 0;
  const restano: { id: string; motivo: string }[] = [];
  for (const id of [...new Set(ids as string[])]) {
    try {
      if ((await cambiaStato(c, id, corpo.stato)).cambiato) cambiati++;
    } catch (e) {
      if (!(e instanceof Rifiuto) || e.motivo === "interno" || e.motivo === "migrazione") throw e;
      restano.push({ id, motivo: e.frase });
    }
  }
  const chiave = corpo.stato === "pubblicato" ? "pubblicati" : corpo.stato === "archiviato" ? "archiviati" : "bozze";
  return { [chiave]: cambiati, restano };
};

const prodotto_adotta: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  if (s.prodotto.origine !== "codice") throw valore("Questo prodotto non viene dal vecchio catalogo.");
  const versione = await scriviProdotto(c, s, { origine: null });
  const storico = await registra(c, [rigaStorico(c, "prodotto", s.prodotto.id, "origine", "codice", null)]);
  return { versione, storico };
};

/** Copia tutto TRANNE foto e SKU (lo SKU nuovo è obbligatorio). Le varianti si copiano con giacenza 0, SKU derivati e lo stesso costo. */
const prodotto_duplica: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  const sku = VALIDA.sku(corpo.sku) as string;
  const nuoviSku = s.varianti.map((v, k) => ({ v, sku: (v.sku.startsWith(s.prodotto.sku) ? sku + v.sku.slice(s.prodotto.sku.length) : `${sku}-${k + 1}`).slice(0, 40) }));
  const tutti = await skuNoti(c.d, [sku, ...nuoviSku.map((n) => n.sku)]);
  for (const x of [sku, ...nuoviSku.map((n) => n.sku)])
    if (!skuValido(x) || !skuLibero(x, tutti, null)) throw rifiuta("duplicato", 409, `Lo SKU “${x}” non è valido o è già usato da un altro prodotto.`);
  const slug = VALIDA.slug(corpo.slug ?? slugDa(`${s.prodotto.nome} copia`)) as string;
  const r = s.riga;
  const copia = righe(
    await q(c.d, "duplica", c.d.db.from("shop_prodotti").insert({
      sku, slug, nome: s.prodotto.nome, tipo: r.tipo, stato: "bozza", origine: null, prezzo_cent: r.prezzo_cent, marca: r.marca,
      riga_presentazione: r.riga_presentazione, descrizione_breve: r.descrizione_breve, descrizione_lunga: r.descrizione_lunga, per_chi: r.per_chi,
      caratteristiche: r.caratteristiche, contenuto: r.contenuto, reso_consentito: r.reso_consentito, reso_giorni: r.reso_giorni,
      box_consulenza: r.box_consulenza, canali: r.canali, mpn: r.mpn, categoria_google: r.categoria_google, peso_g: r.peso_g,
      classe_spedizione: r.classe_spedizione, fornitore: r.fornitore, seo_titolo: r.seo_titolo, seo_descrizione: r.seo_descrizione,
      creato_il: c.ora, aggiornato_il: c.ora,
    }).select("*")),
  )[0];
  const nuovo = r && copia && prodottoDaRiga(copia);
  if (!nuovo) throw rifiuta("interno", 500, "La copia non è stata creata: riprova.");
  // il costo si copia solo se c'è: un costo letto implica che la colonna esiste (senza migrazione `costi` è tutto `null` e la chiave non si scrive)
  const conCosto = nuoviSku.some(({ v }) => s.costi[v.id] != null);
  if (nuoviSku.length)
    await q(c.d, "duplica", c.d.db.from("shop_varianti").insert(nuoviSku.map(({ v, sku: sv }) => ({
      prodotto_id: nuovo.id, sku: sv, nome: v.nome, opzioni: v.opzioni, prezzo_cent: v.prezzoCent, giacenza: 0, peso_g: v.pesoG, attiva: v.attiva, ordine: v.ordine,
      ...(conCosto ? { costo_cent: s.costi[v.id] ?? null } : {}),
    }))));
  if (s.categorie.length) await q(c.d, "duplica", c.d.db.from("shop_prodotti_categorie").insert(s.categorie.map((categoria_id) => ({ prodotto_id: nuovo.id, categoria_id }))));
  const storico = await registra(c, [rigaStorico(c, "prodotto", nuovo.id, "creato", null, { copiaDi: s.prodotto.id, sku })]);
  return { prodotto: nuovo, versione: nuovo.aggiornatoIl, storico };
};

const anteprima_chiave: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  const chiave = c.d.chiaveServizio();
  if (!chiave) throw rifiuta("chiave", 503, "L'anteprima non è disponibile: manca la chiave di servizio del sito.");
  const token = await emettiChiaveAnteprima(chiave, s.prodotto.slug, Date.parse(c.ora));
  return { url: `/shop/prodotto/${s.prodotto.slug}?anteprima=${token}`, scade: new Date(Date.parse(c.ora) + 24 * 3600 * 1000).toISOString() };
};

/* ══ LE VARIANTI ════════════════════════════════════════════════════════════ */

const VALIDA_VARIANTE: Record<string, (v: unknown) => unknown> = {
  sku: VALIDA.sku,
  nome: testoObb("Nome della variante", 120),
  opzioni: (v) => {
    const o = oggetto(v);
    const voci = o ? Object.entries(o) : [];
    if (!o || voci.length > 3 || voci.some(([k, x]) => !k.trim() || k.length > 40 || typeof x !== "string" || !x.trim() || x.length > 40)) throw valore("Le opzioni sono al massimo 3, con nome e valore (per esempio Colore: Nero).");
    return Object.fromEntries(voci.map(([k, x]) => [k.trim(), (x as string).trim()]));
  },
  prezzoCent: (v) => (v === null ? null : VALIDA.prezzoCent(v)),
  pesoG: interoIn("Peso", 1_000_000),
  gtin: testoOpz("GTIN", 20),
  ordine: interoIn("Ordine", 1000),
  /** Il costo in centesimi (`null` = non scritto). Solo del CRM: non entra mai in `Variante` né nelle viste del sito. */
  costoCent: interoIn("Costo", MAX_CENT),
};
const COLONNA_VARIANTE: Record<string, string> = { sku: "sku", nome: "nome", opzioni: "opzioni", prezzoCent: "prezzo_cent", pesoG: "peso_g", gtin: "gtin", ordine: "ordine", costoCent: "costo_cent" };

/** Lo SKU di una variante deve essere libero fra tutti i prodotti e le altre varianti (quello del suo stesso prodotto va bene, come nelle 33 migrate). */
function skuVarianteLibero(sku: string, prodottoId: string, varianteId: string | null, tutti: readonly SkuNoto[]): boolean {
  return !tutti.some((u) => u.sku === sku && (u.prodottoId !== prodottoId || (u.varianteId !== null && u.varianteId !== varianteId)));
}

const variante_salva: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  const dati = oggetto(corpo.variante);
  if (!dati) throw valore("Mancano i dati della variante.");
  const esistente = dati.id === undefined ? null : s.varianti.find((v) => v.id === dati.id);
  if (dati.id !== undefined && !esistente) throw rifiuta("non_trovato", 404, "Variante non trovata.");
  const { id: _id, ...campi } = dati;
  for (const k of Object.keys(campi)) if (!VALIDA_VARIANTE[k]) throw valore(`Il campo «${k}» della variante non si può cambiare così.`);
  const nuovi = Object.fromEntries(Object.entries(campi).map(([k, v]) => [k, VALIDA_VARIANTE[k](v)]));
  if (!esistente && (typeof nuovi.sku !== "string" || typeof nuovi.nome !== "string")) throw valore("Una variante nuova ha bisogno di SKU e nome.");
  if (!esistente && s.varianti.length >= MAX_VARIANTI) throw valore(`Un prodotto ha al massimo ${MAX_VARIANTI} varianti.`);
  nessunTestoVietato(nuovi.nome, nuovi.opzioni);
  const tutti = await skuNoti(c.d, [...skusDi(s), ...(typeof nuovi.sku === "string" ? [nuovi.sku] : [])]);
  if (typeof nuovi.sku === "string" && nuovi.sku !== esistente?.sku && !skuVarianteLibero(nuovi.sku, s.prodotto.id, esistente?.id ?? null, tutti))
    throw rifiuta("duplicato", 409, `Lo SKU “${nuovi.sku}” è già usato da un altro prodotto o da un'altra variante.`);

  // il costo non è nel modello `Variante` (non deve mai arrivare al sito): si confronta col valore grezzo della riga
  if (!esistente && nuovi.costoCent === null) delete nuovi.costoCent;
  const attuale = (k: string): unknown => (k === "costoCent" ? s.costi[esistente?.id ?? ""] ?? null : (esistente as unknown as Record<string, unknown>)[k]);
  const cambi = Object.entries(nuovi).filter(([k, v]) => !esistente || !uguali(attuale(k), v));
  if (esistente && !cambi.length) return { variante: esistente, storico: true };
  if (cambi.some(([k]) => k === "costoCent") && !(await costoDisponibile(c.d))) throw COSTO_SPENTO();
  const patch = Object.fromEntries(cambi.map(([k, v]) => [COLONNA_VARIANTE[k], v]));
  // lo stato dopo, per vedere se il prodotto (se è sul sito) resta pubblicabile
  const { costoCent: _costo, ...nuoviV } = nuovi;
  const dopoV: VarianteLetta = esistente
    ? { ...esistente, ...Object.fromEntries(cambi.filter(([k]) => k !== "costoCent")) }
    : ({ id: "nuova", prodottoId: s.prodotto.id, giacenza: 0, attiva: true, disponibile: false, pesoG: null, gtin: null, ordine: s.varianti.length + 1, prezzoCent: null, opzioni: {}, ...nuoviV } as VarianteLetta);
  nonPeggiora(s, { ...s, varianti: esistente ? s.varianti.map((v) => (v.id === esistente.id ? dopoV : v)) : [...s.varianti, dopoV] }, tutti);

  let letta;
  if (esistente) {
    letta = righe(await q(c.d, "variante", c.d.db.from("shop_varianti").update({ ...patch, aggiornato_il: c.ora }).eq("id", esistente.id).eq("prodotto_id", s.prodotto.id).select("*")))[0];
  } else {
    letta = righe(await q(c.d, "variante", c.d.db.from("shop_varianti").insert({ prodotto_id: s.prodotto.id, giacenza: 0, attiva: true, ordine: s.varianti.length + 1, ...patch }).select("*")))[0];
  }
  const v = letta && varianteDaRiga(letta);
  if (!v) throw rifiuta("non_trovato", 404, "Variante non trovata.");
  const storico = await registra(c, cambi.map(([k, x]) => rigaStorico(c, "variante", v.id, k, esistente ? attuale(k) : null, x)));
  return { variante: v, storico };
};

const varianti_genera: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  const opzioni = corpo.opzioni;
  if (!Array.isArray(opzioni)) throw valore("Scrivi le opzioni (per esempio Colore con i suoi valori).");
  const g = combinazioni(s.prodotto.sku, opzioni as never);
  if (!g.ok) throw valore(g.frase);
  const noti = new Set(s.varianti.map((v) => v.sku));
  const nuove = g.varianti.filter((v) => !noti.has(v.sku));
  if (s.varianti.length + nuove.length > MAX_VARIANTI) throw valore(`Un prodotto ha al massimo ${MAX_VARIANTI} varianti.`);
  const tutti = await skuNoti(c.d, [...skusDi(s), ...nuove.map((v) => v.sku)]);
  const occupato = nuove.find((v) => !skuVarianteLibero(v.sku, s.prodotto.id, null, tutti));
  if (occupato) throw rifiuta("duplicato", 409, `Lo SKU “${occupato.sku}” è già usato da un altro prodotto: cambia lo SKU del prodotto o i valori.`);
  if (!nuove.length) return { create: [], esistenti: g.varianti.length, storico: true };
  const dopo = nuove.map((v, k) => ({ id: `nuova-${k}`, prodottoId: s.prodotto.id, sku: v.sku, nome: v.nome, opzioni: v.opzioni, prezzoCent: null, giacenza: 0, pesoG: null, attiva: true, gtin: null, ordine: 0, disponibile: false }));
  nonPeggiora(s, { ...s, varianti: [...s.varianti, ...dopo] }, tutti);
  const inserite = righe(
    await q(c.d, "genera", c.d.db.from("shop_varianti").insert(nuove.map((v, k) => ({ prodotto_id: s.prodotto.id, sku: v.sku, nome: v.nome, opzioni: v.opzioni, giacenza: 0, attiva: true, ordine: s.varianti.length + k + 1 }))).select("*")),
  ).flatMap((x) => varianteDaRiga(x) ?? []);
  const storico = await registra(c, inserite.map((v) => rigaStorico(c, "variante", v.id, "creata", null, { sku: v.sku, nome: v.nome })));
  return { create: inserite, esistenti: g.varianti.length - nuove.length, storico };
};

const variante_attiva: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  if (typeof corpo.attiva !== "boolean") throw valore("Dimmi se la variante è attiva o no.");
  const v = s.varianti.find((x) => x.id === corpo.varianteId);
  if (!v) throw rifiuta("non_trovato", 404, "Variante non trovata.");
  if (v.attiva === corpo.attiva) return { storico: true };
  nonPeggiora(s, { ...s, varianti: s.varianti.map((x) => (x.id === v.id ? { ...x, attiva: corpo.attiva as boolean } : x)) }, await skuNoti(c.d, skusDi(s)));
  await q(c.d, "attiva", c.d.db.from("shop_varianti").update({ attiva: corpo.attiva, aggiornato_il: c.ora }).eq("id", v.id).eq("prodotto_id", s.prodotto.id).select("id"));
  return { storico: await registra(c, [rigaStorico(c, "variante", v.id, "attiva", v.attiva, corpo.attiva)]) };
};

/* ══ I MEDIA ════════════════════════════════════════════════════════════════ */

const percorso = (nome: string) => (v: unknown) => {
  if (typeof v !== "string" || v.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(v) || v.includes("..")) throw valore(`Il file «${nome}» non è valido.`);
  return v;
};
const altOk = testoOpz("Testo alternativo", TETTI.alt);

/** Il ritiro di una foto per liberatoria revocata: se è STATO IL RITIRO a rendere il prodotto non pubblicabile (non una cosa che mancava già),
 *  il prodotto torna in bozza (con un avviso) invece di rifiutare. */
async function ritiroPerLiberatoria(c: Ctx, s: Stato, dopo: Stato, tutti: readonly SkuUsato[]): Promise<string | null> {
  if (s.prodotto.stato !== "pubblicato") return null;
  const vecchi = new Set(controlla(s, tutti).bloccanti.map(chiaveVoce));
  if (!controlla(dopo, tutti).bloccanti.some((b) => !vecchi.has(chiaveVoce(b)))) return null;
  await q(c.d, "bozza", c.d.db.from("shop_prodotti").update({ stato: "bozza", aggiornato_il: c.ora, ...AZZERA_BOZZA }).eq("id", s.prodotto.id).eq("stato", "pubblicato").select("id"));
  await registra(c, [rigaStorico(c, "prodotto", s.prodotto.id, "stato", "pubblicato", "bozza")]);
  return "La foto è stata ritirata perché manca la liberatoria. Senza una foto principale valida il prodotto non può stare sul sito: è tornato in bozza.";
}

const media_registra: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  if (typeof corpo.slot !== "string" || !(SLOT as readonly string[]).includes(corpo.slot)) throw valore("Lo spazio per la foto non esiste.");
  const slot = corpo.slot;
  const video = slot === "video";
  const alt = altOk(corpo.alt ?? null);
  if (corpo.sottoRuolo != null && !(SOTTO_RUOLI as readonly string[]).includes(corpo.sottoRuolo as string)) throw valore("Il ruolo della foto non esiste.");
  nessunTestoVietato(alt, corpo.testoParlato);
  const riga: Record<string, unknown> = {
    prodotto_id: s.prodotto.id, slot, tipo: video ? "video" : "foto", sotto_ruolo: corpo.sottoRuolo ?? null, alt: alt ?? "",
    ordine: s.media.length + 1, creato_il: c.ora,
    // I segni della persona nascono CON la riga (T32, D30): una foto con una persona non è mai in linea senza il suo segno, nemmeno per un istante.
    // Non detti = nessuna persona (il default di S1).
    ritrae_persone: corpo.ritraePersone == null ? false : bool("Ritrae persone")(corpo.ritraePersone),
    liberatoria_ok: corpo.liberatoriaOk == null ? false : bool("Liberatoria")(corpo.liberatoriaOk),
  };
  if (video) {
    riga.path_video = percorso("video")(corpo.pathVideo);
    riga.path_copertina = corpo.pathCopertina == null ? null : percorso("copertina")(corpo.pathCopertina);
    riga.durata_s = interoIn("Durata", 3600)(corpo.durataS ?? null);
    riga.muto = corpo.muto === true;
    riga.testo_parlato = testoOpz("Testo parlato", 2000)(corpo.testoParlato ?? null);
  } else {
    riga.path_480 = percorso("480")(corpo.path480);
    riga.path_960 = percorso("960")(corpo.path960);
    riga.path_1600 = percorso("1600")(corpo.path1600);
  }
  if (slot === "campione") {
    riga.valore_opzione = testoObb("Valore del colore", 40)(corpo.valoreOpzione);
    if (corpo.varianteId != null) {
      if (!s.varianti.some((v) => v.id === corpo.varianteId)) throw rifiuta("non_trovato", 404, "Variante non trovata.");
      riga.variante_id = corpo.varianteId;
    }
  }
  // uno slot ha UNA sola foto attiva: la nuova prende il posto di quelle che c'erano (tutte, così il risultato non dipende dall'ordine)
  const vecchie = s.media.filter((m) => m.slot === slot && (slot !== "campione" || m.valoreOpzione === riga.valore_opzione));
  //  Le colonne di filtro (T07) chiudono la riga se mancano: la foto nuova porta i valori di S1 (non rimossa, non ritrae persone), come la restituirà il database.
  const nuova = mediaDaRiga({ ...riga, id: "nuova", rimosso_il: null });
  if (!nuova) throw valore("La foto non è valida.");
  const tutti = await skuNoti(c.d, skusDi(s));
  nonPeggiora(s, { ...s, media: [...s.media.filter((m) => !vecchie.includes(m)), nuova] }, tutti);
  const messa = righe(await q(c.d, "media", c.d.db.from("shop_media").insert(riga).select("*")))[0];
  const m = messa && mediaDaRiga(messa);
  if (!m) throw rifiuta("interno", 500, "La foto non è stata salvata: riprova.");
  for (const v of vecchie) await q(c.d, "media", c.d.db.from("shop_media").update({ rimosso_il: c.ora }).eq("id", v.id).select("id"));
  const storico = await registra(c, [rigaStorico(c, "media", m.id, "registrato", null, { slot }), ...vecchie.map((v) => rigaStorico(c, "media", v.id, "rimosso", null, c.ora))]);
  return { media: m, sostituiti: vecchie.map((v) => v.id), storico };
};

const media_ordina: Azione = async (c, corpo) => {
  const s = await carica(c.d, corpo.prodottoId);
  const ids = corpo.ordine;
  if (!Array.isArray(ids) || !ids.every((i) => s.media.some((m) => m.id === i)) || new Set(ids).size !== ids.length) throw valore("L'ordine delle foto non è valido.");
  for (const [k, id] of (ids as string[]).entries()) await q(c.d, "ordina", c.d.db.from("shop_media").update({ ordine: k + 1 }).eq("id", id).eq("prodotto_id", s.prodotto.id).select("id"));
  return { storico: await registra(c, [rigaStorico(c, "prodotto", s.prodotto.id, "ordine foto", s.media.map((m) => m.id), ids)]) };
};

/** Trova il media (non rimosso) di un prodotto: il prodotto lo si ricava dal media. */
async function caricaDaMedia(d: DipendenzeProdotti, mediaId: unknown): Promise<{ s: Stato; m: Media }> {
  if (!eId(mediaId)) throw valore("La foto indicata non è valida.");
  const r = righe(await q(d, "media", d.db.from("shop_media").select("prodotto_id").eq("id", mediaId).is("rimosso_il", null).limit(1)))[0];
  if (typeof r?.prodotto_id !== "string") throw rifiuta("non_trovato", 404, "Foto non trovata.");
  const s = await carica(d, r.prodotto_id);
  const m = s.media.find((x) => x.id === mediaId);
  if (!m) throw rifiuta("non_trovato", 404, "Foto non trovata.");
  return { s, m };
}

const media_alt: Azione = async (c, corpo) => {
  const { s, m } = await caricaDaMedia(c.d, corpo.mediaId);
  const alt = altOk(corpo.alt) ?? "";
  nessunTestoVietato(alt);
  if (alt === m.alt) return { storico: true };
  nonPeggiora(s, { ...s, media: s.media.map((x) => (x.id === m.id ? { ...x, alt } : x)) }, await skuNoti(c.d, skusDi(s)));
  await q(c.d, "media", c.d.db.from("shop_media").update({ alt }).eq("id", m.id).select("id"));
  return { storico: await registra(c, [rigaStorico(c, "media", m.id, "alt", m.alt, alt)]) };
};

const FLAG: Record<string, [string, (v: unknown) => unknown]> = {
  sottotitoliOk: ["sottotitoli_ok", bool("Sottotitoli")], muto: ["muto", bool("Muto")], ritraePersone: ["ritrae_persone", bool("Ritrae persone")],
  liberatoriaOk: ["liberatoria_ok", bool("Liberatoria")], testoParlato: ["testo_parlato", testoOpz("Testo parlato", 2000)],
};
const media_flag: Azione = async (c, corpo) => {
  const { s, m } = await caricaDaMedia(c.d, corpo.mediaId);
  const dati = oggetto(corpo.flag);
  if (!dati || !Object.keys(dati).length || Object.keys(dati).some((k) => !FLAG[k])) throw valore("Non so quali caratteristiche della foto cambiare.");
  const nuovi = Object.fromEntries(Object.entries(dati).map(([k, v]) => [k, FLAG[k][1](v)]));
  nessunTestoVietato(nuovi.testoParlato);
  const attuale = m as unknown as Record<string, unknown>;
  const cambi = Object.entries(nuovi).filter(([k, v]) => !uguali(attuale[k], v));
  if (!cambi.length) return { storico: true };
  const dopo: Stato = { ...s, media: s.media.map((x) => (x.id === m.id ? { ...x, ...Object.fromEntries(cambi) } : x)) };
  const tutti = await skuNoti(c.d, skusDi(s));
  // togliere la liberatoria (o dire che ritrae persone) è un ritiro: non si rifiuta, se serve il prodotto torna in bozza
  const ritiro = nuovi.liberatoriaOk === false || nuovi.ritraePersone === true;
  if (!ritiro) nonPeggiora(s, dopo, tutti);
  await q(c.d, "media", c.d.db.from("shop_media").update(Object.fromEntries(cambi.map(([k, v]) => [FLAG[k][0], v]))).eq("id", m.id).select("id"));
  const avviso = ritiro ? await ritiroPerLiberatoria(c, s, dopo, tutti) : null;
  const storico = await registra(c, cambi.map(([k, v]) => rigaStorico(c, "media", m.id, k, attuale[k], v)));
  return { storico, ...(avviso ? { avviso, tornatoInBozza: true } : {}) };
};

const media_rimuovi: Azione = async (c, corpo) => {
  const { s, m } = await caricaDaMedia(c.d, corpo.mediaId);
  const dopo: Stato = { ...s, media: s.media.filter((x) => x.id !== m.id) };
  const tutti = await skuNoti(c.d, skusDi(s));
  const revoca = corpo.liberatoriaRevocata === true;
  if (!revoca) nonPeggiora(s, dopo, tutti);
  await q(c.d, "media", c.d.db.from("shop_media").update({ rimosso_il: c.ora }).eq("id", m.id).select("id"));
  const avviso = revoca ? await ritiroPerLiberatoria(c, s, dopo, tutti) : null;
  const storico = await registra(c, [rigaStorico(c, "media", m.id, "rimosso", null, c.ora)]);
  return { storico, ...(avviso ? { avviso, tornatoInBozza: true } : {}) };
};

const AZIONI: Record<(typeof AZIONI_PRODOTTI)[number], Azione> = {
  prodotto_crea, prodotto_salva, prodotto_pubblica_modifiche, prodotto_scarta_modifiche, prodotto_stato, prodotto_duplica, prodotto_adotta,
  gruppo_stato, anteprima_chiave, variante_salva, varianti_genera, variante_attiva, media_registra, media_ordina, media_alt, media_flag, media_rimuovi,
};

/* ══ LE LETTURE ═════════════════════════════════════════════════════════════ */

const SEGMENTI = ["tutti", "pubblicati", "bozze", "da_sistemare", "vecchio_catalogo", "cestino"];

async function elencoProdotti(d: DipendenzeProdotti, p: URLSearchParams) {
  const segmento = p.get("segmento") ?? "tutti";
  if (!SEGMENTI.includes(segmento)) throw valore("Il filtro non esiste.");
  const [rp, rv, rm, rc] = await Promise.all([
    q(d, "elenco", d.db.from("shop_prodotti").select("*").order("nome").limit(MAX_PRODOTTI + 1)),
    q(d, "elenco", d.db.from("shop_varianti").select("*").limit(MAX_PRODOTTI * 5 + 1)),
    q(d, "elenco", d.db.from("shop_media").select("*").is("rimosso_il", null).limit(MAX_PRODOTTI * 12 + 1)),
    q(d, "elenco", d.db.from("shop_prodotti_categorie").select("*").limit(MAX_PRODOTTI * 5 + 1)),
  ]);
  // Si chiede UNA riga in più del tetto: se arriva, l'elenco è incompleto e lo si dice (`troncato`), mai in silenzio.
  const troncato = righe(rp).length > MAX_PRODOTTI || righe(rv).length > MAX_PRODOTTI * 5 || righe(rm).length > MAX_PRODOTTI * 12 || righe(rc).length > MAX_PRODOTTI * 5;
  const vs = righe(rv).flatMap((x) => varianteDaRiga(x) ?? []);
  const ms = righe(rm).flatMap((x) => mediaDaRiga(x) ?? []);
  const cs = righe(rc);
  const tutti: SkuUsato[] = [...righe(rp).flatMap((r) => (typeof r.id === "string" && typeof r.sku === "string" ? [{ sku: r.sku, prodottoId: r.id }] : [])), ...vs.map((v) => ({ sku: v.sku, prodottoId: v.prodottoId }))];
  const cerca = (p.get("q") ?? "").trim().toLowerCase();
  const categoria = p.get("categoria");
  const lista = righe(rp).slice(0, MAX_PRODOTTI).flatMap((riga) => {
    const prodotto = prodottoDaRiga(riga);
    if (!prodotto) return [];
    const categorie = cs.filter((x) => x.prodotto_id === prodotto.id).flatMap((x) => (typeof x.categoria_id === "string" ? [x.categoria_id] : []));
    const esito = controllaPubblicazione(prodotto, vs.filter((v) => v.prodottoId === prodotto.id), ms.filter((m) => m.prodottoId === prodotto.id), categorie, { spedizioneImpostata: null, tuttiGliSku: tutti });
    // giacenza = la somma delle varianti ATTIVE (una variante spenta non si vende, quindi non conta); canali = solo le quattro chiavi note
    const giacenza = vs.filter((v) => v.prodottoId === prodotto.id && v.attiva).reduce((s, v) => s + (typeof v.giacenza === "number" && Number.isFinite(v.giacenza) ? v.giacenza : 0), 0);
    const k = (prodotto.canali ?? {}) as Partial<Record<"sito" | "meta" | "google" | "tiktok", unknown>>;
    const canali = { sito: k.sito === true, meta: k.meta === true, google: k.google === true, tiktok: k.tiktok === true };
    return [{ prodotto, categorie, motivo: esito.bloccanti[0]?.frase ?? null, giacenza, canali }];
  });
  const righeOut = lista
    .filter(({ prodotto: x, categorie, motivo }) => {
      if (cerca && !`${x.nome} ${x.sku}`.toLowerCase().includes(cerca)) return false;
      if (categoria && !categorie.includes(categoria)) return false;
      const vecchio = x.origine === "codice";
      if (segmento === "vecchio_catalogo") return vecchio;
      if (vecchio) return false; // il vecchio catalogo sta solo nel suo segmento (D28)
      if (segmento === "cestino") return x.stato === "archiviato";
      if (x.stato === "archiviato") return false; // gli archiviati stanno solo nel Cestino (E14)
      if (segmento === "pubblicati") return x.stato === "pubblicato";
      if (segmento === "bozze") return x.stato === "bozza";
      if (segmento === "da_sistemare") return motivo !== null;
      return true;
    })
    .map(({ prodotto: x, motivo, giacenza, canali }) => ({
      id: x.id, sku: x.sku, slug: x.slug, nome: x.nome, tipo: x.tipo, stato: x.stato, origine: x.origine, prezzoCent: x.prezzoCent,
      versione: x.aggiornatoIl, haModifiche: x.bozzaModifiche !== null, motivo, canali, giacenza,
    }));
  return { prodotti: righeOut, troncato };
}

async function schedaProdotto(d: DipendenzeProdotti, id: string) {
  const s = await carica(d, id);
  const [storico, tutti, conCosto] = await Promise.all([
    q(d, "storico", d.db.from("shop_storico").select("id,entita,entita_id,campo,prima,dopo,chi,creato_il").eq("entita_id", id).order("creato_il", { ascending: false }).limit(50)),
    skuNoti(d, skusDi(s)),
    costoDisponibile(d),
  ]);
  const principale = s.media.filter((m) => m.slot === "principale")[0];
  return {
    prodotto: s.prodotto,
    versione: s.prodotto.aggiornatoIl,
    varianti: s.varianti.map((v) => ({ ...v, disponibilita: statoDisponibilita(v.giacenza, v.attiva) })),
    media: s.media,
    principaleId: principale?.id ?? null,
    categorie: s.categorie,
    storico: righe(storico),
    controllo: controlla(s, tutti),
    // il costo sta in una mappa a parte, solo nella risposta del CRM: mai dentro `varianti` (che prende la forma del sito)
    costi: conCosto ? Object.fromEntries(s.varianti.map((v) => [v.id, s.costi[v.id] ?? null])) : {},
    costoDisponibile: conCosto,
  };
}

/* ══ I GESTORI ══════════════════════════════════════════════════════════════ */

function rispostaDaErrore(e: unknown, d: DipendenzeProdotti): Response {
  if (e instanceof Rifiuto) return json({ ok: false, motivo: e.motivo, frase: e.frase, ...e.extra }, e.stato);
  d.log(`eccezione ${nomeDi(e)}`); // mai il messaggio
  return json({ ok: false, motivo: "interno", frase: "Qualcosa non ha funzionato: riprova tra un momento." }, 500);
}

export async function gestisciGET(request: Request, d: DipendenzeProdotti): Promise<Response> {
  try {
    const g = await d.guardia(request); // dentro il `try`: se la guardia lancia esce un JSON «interno»
    if (!g.ok) return g.risposta;
    const p = new URL(request.url).searchParams;
    if (p.has("prodotto")) return json({ ok: true, ...(await schedaProdotto(d, p.get("prodotto") ?? "")) });
    if (p.has("prodotti")) return json({ ok: true, ...(await elencoProdotti(d, p)) });
    throw valore("Non so cosa leggere.");
  } catch (e) {
    return rispostaDaErrore(e, d);
  }
}

export async function gestisciPOST(request: Request, d: DipendenzeProdotti): Promise<Response> {
  try {
    const g = await d.guardia(request);
    if (!g.ok) return g.risposta;
    if (Number(request.headers.get("content-length")) > MAX_CORPO) throw rifiuta("valore", 413, "La richiesta è troppo grande.");
    const testo = await request.text();
    if (testo.length > MAX_CORPO) throw valore("La richiesta è troppo grande.");
    let corpo: unknown;
    try {
      corpo = JSON.parse(testo);
    } catch {
      throw valore("La richiesta non è valida.");
    }
    const o = oggetto(corpo);
    const azione = o?.azione;
    if (!o || typeof azione !== "string" || !Object.prototype.hasOwnProperty.call(AZIONI, azione)) throw valore("Questa azione non esiste.");
    const chi = (typeof g.nome === "string" ? g.nome.trim().slice(0, 80) : "") || "Titolare";
    const esito = await AZIONI[azione as keyof typeof AZIONI]({ d, chi, ora: d.adesso().toISOString() }, o);
    return json({ ok: true, ...esito });
  } catch (e) {
    return rispostaDaErrore(e, d);
  }
}
