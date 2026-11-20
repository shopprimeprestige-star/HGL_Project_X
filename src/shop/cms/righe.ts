/** ── DALLE RIGHE DEL DATABASE AI TIPI DEL MODELLO ───────────────────────────
 *  Commessa 2026-11-20-shop-completo (T07). Modulo PURO. Qui, e solo qui, le colonne in snake_case di S1
 *  (`prezzo_cent`, `riga_presentazione`…) diventano i tipi in camelCase di `modello.ts`. Le usano `pubblico.ts` (T07)
 *  e le schermate/rotte del CRM (T08): nessuno le rifà per conto suo.
 *
 *  Valgono per le righe delle VISTE `shop_v_*` e per quelle delle TABELLE (l'anteprima legge dalle tabelle).
 *  ⚠️ Una colonna che la vista non porta (giacenza, note, fornitore, creato_il…) esce neutra: `null`, `""`, `false`.
 *  ⚠️ Le colonne che servono solo a FILTRARE (`stato`, `attiva`, `liberatoria_ok`, `rimosso_il`) nelle viste possono
 *   sparire: la vista mostra già solo righe pubblicate e pulite. Se la colonna MANCA, la riga vale «in regola»;
 *   se c'è, conta quello che dice (una riga di tabella ha sempre tutte e quattro). Un valore strano (`stato: "x"`) non è «manca»: la riga si scarta.
 *  ⚠️ Una riga inservibile (senza id, slug, SKU, nome, prezzo valido…) dà `null`: chi legge la salta, non lancia. */
import {
  SLOT,
  SOTTO_RUOLI,
  normalizzaCaratteristiche,
  slugValido,
  type CampiProdotto,
  type Canali,
  type Categoria,
  type Media,
  type Prodotto,
  type Slot,
  type StatoProdotto,
  type TipoProdotto,
  type Variante,
} from "./modello";

/* ── lettura prudente di valori di forma qualunque (le usa anche chi costruisce l'uscita pubblica) ── */
export type Riga = Record<string, unknown>;
export const oggetto = (x: unknown): Riga | null => (x && typeof x === "object" && !Array.isArray(x) ? (x as Riga) : null);
export const righeDi = (x: unknown): Riga[] =>
  Array.isArray(x) ? x.flatMap((r): Riga[] => { const o = oggetto(r); return o ? [o] : []; }) : [];
export const testo = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x.trim() : null);
export const testi = (x: unknown): string[] => (Array.isArray(x) ? x.flatMap((t) => testo(t) ?? []) : []);
export const intero = (x: unknown): number | null => (typeof x === "number" && Number.isSafeInteger(x) ? x : null);
export const booleano = (x: unknown): boolean | null => (typeof x === "boolean" ? x : null);
export const faq = (x: unknown): { d: string; r: string }[] =>
  Array.isArray(x) ? x.flatMap((f) => { const o = oggetto(f); const d = testo(o?.d), r = testo(o?.r); return d && r ? [{ d, r }] : []; }) : [];
/** Colonna di filtro: se manca (vista) vale «sì»; se c'è vale solo `true` (un `null` o un testo non è un sì). */
const siSeManca = (x: unknown): boolean => (x === undefined ? true : x === true);

const TIPI: readonly string[] = ["patch", "cura", "kit"];
const STATI: readonly string[] = ["bozza", "pubblicato", "archiviato"];

/* ── prodotto ─────────────────────────────────────────────────────────── */

export function prodottoDaRiga(riga: unknown): Prodotto | null {
  const o = oggetto(riga);
  if (!o) return null;
  const id = testo(o.id), sku = testo(o.sku), slug = testo(o.slug), nome = testo(o.nome), prezzoCent = intero(o.prezzo_cent);
  if (!id || !sku || !slug || !slugValido(slug) || !nome || !TIPI.includes(String(o.tipo)) || prezzoCent === null || prezzoCent < 0) return null;
  // `stato` può mancare solo nelle viste (che mostrano i pubblicati): allora vale «pubblicato». Un valore fuori elenco scarta la riga.
  if (o.stato !== undefined && !STATI.includes(String(o.stato))) return null;
  const contenuto = oggetto(o.contenuto) ?? {};
  const canali = oggetto(o.canali) ?? {};
  const canale = (k: keyof Canali) => canali[k] === true;
  return {
    id, sku, slug, nome, prezzoCent,
    tipo: o.tipo as TipoProdotto,
    stato: (o.stato as StatoProdotto | undefined) ?? "pubblicato",
    origine: o.origine === "codice" ? "codice" : null,
    marca: testo(o.marca),
    rigaPresentazione: testo(o.riga_presentazione),
    descrizioneBreve: testo(o.descrizione_breve) ?? "",
    descrizioneLunga: testo(o.descrizione_lunga),
    perChi: testo(o.per_chi),
    caratteristiche: normalizzaCaratteristiche(o.caratteristiche),
    passi: testi(contenuto.passi),
    confezione: testi(contenuto.confezione),
    avvertenze: testi(contenuto.avvertenze),
    faq: faq(contenuto.faq),
    resoConsentito: booleano(o.reso_consentito),
    resoGiorni: intero(o.reso_giorni),
    boxConsulenza: o.box_consulenza === true,
    correlatoId: testo(o.correlato_id),
    canali: { sito: canale("sito"), meta: canale("meta"), google: canale("google"), tiktok: canale("tiktok") },
    seoTitolo: testo(o.seo_titolo),
    seoDescrizione: testo(o.seo_descrizione),
    seoMediaId: testo(o.seo_media_id),
    gtin: testo(o.gtin),
    mpn: testo(o.mpn),
    categoriaGoogle: testo(o.categoria_google),
    pesoG: intero(o.peso_g),
    classeSpedizione: testo(o.classe_spedizione),
    fornitore: testo(o.fornitore),
    schedaTecnicaPath: testo(o.scheda_tecnica_path),
    noteInterne: testo(o.note_interne),
    notaTitolare: testo(o.nota_titolare),
    // shortcut: la bozza si passa com'è (oggetto o niente); chi la applica prende solo i campi che sa leggere (`pubblico.ts`). Si cambia se T08 vuole validarla qui.
    bozzaModifiche: oggetto(o.bozza_modifiche) as Partial<CampiProdotto> | null,
    bozzaModificataIl: testo(o.bozza_modificata_il),
    idCodice: testo(o.id_codice),
    creatoIl: testo(o.creato_il) ?? "",
    aggiornatoIl: testo(o.aggiornato_il) ?? "",
    pubblicatoIl: testo(o.pubblicato_il),
  };
}

/* ── variante ─────────────────────────────────────────────────────────── */

/** La variante com'è nel modello, con in più `disponibile`, perché la vista non dà la giacenza (D1): `giacenza` è `null`
 *  quando la riga viene da una vista, e `disponibile` dice solo se c'è. */
export type VarianteLetta = Omit<Variante, "giacenza"> & { giacenza: number | null; disponibile: boolean };

/** `null` se manca id, prodotto o SKU, o se la variante ha un prezzo PROPRIO storto (negativo, con virgola, testo):
 *  non ripiega sul prezzo del prodotto, perché sarebbe un prezzo inventato. */
export function varianteDaRiga(riga: unknown): VarianteLetta | null {
  const o = oggetto(riga);
  if (!o) return null;
  const id = testo(o.id), prodottoId = testo(o.prodotto_id), sku = testo(o.sku);
  if (!id || !prodottoId || !sku) return null;
  let prezzoCent: number | null = null;
  if (o.prezzo_cent !== null && o.prezzo_cent !== undefined) {
    prezzoCent = intero(o.prezzo_cent);
    if (prezzoCent === null || prezzoCent < 0) return null;
  }
  const opzioni: Record<string, string> = {};
  for (const [k, v] of Object.entries(oggetto(o.opzioni) ?? {})) if (testo(v)) opzioni[k] = String(v).trim();
  const attiva = siSeManca(o.attiva);
  const giacenza = typeof o.giacenza === "number" && Number.isFinite(o.giacenza) ? o.giacenza : null;
  return {
    id, prodottoId, sku, nome: testo(o.nome) ?? "", opzioni, prezzoCent, giacenza, pesoG: intero(o.peso_g), attiva, gtin: testo(o.gtin),
    ordine: intero(o.ordine) ?? 0,
    disponibile: attiva && (giacenza !== null ? giacenza > 0 : o.disponibile === true),
  };
}

/* ── media ────────────────────────────────────────────────────────────── */

/** Il media com'è nel modello, più `creatoIl` (solo le tabelle lo hanno) per scegliere tra due foto dello stesso slot. */
export type MediaLetto = Media & { creatoIl: string | null };

export function mediaDaRiga(riga: unknown): MediaLetto | null {
  const o = oggetto(riga);
  if (!o) return null;
  const id = testo(o.id);
  if (!id || !(SLOT as readonly string[]).includes(String(o.slot))) return null;
  const slot = o.slot as Slot;
  const ritraePersone = o.ritrae_persone === true;
  return {
    id,
    prodottoId: testo(o.prodotto_id),
    categoriaId: testo(o.categoria_id),
    varianteId: testo(o.variante_id),
    slot,
    sottoRuolo: (SOTTO_RUOLI as readonly string[]).includes(String(o.sotto_ruolo)) ? (o.sotto_ruolo as Media["sottoRuolo"]) : null,
    tipo: o.tipo === "video" || slot === "video" ? "video" : "foto",
    path480: testo(o.path_480),
    path960: testo(o.path_960),
    path1600: testo(o.path_1600),
    pathVideo: testo(o.path_video),
    pathCopertina: testo(o.path_copertina),
    durataS: intero(o.durata_s),
    alt: typeof o.alt === "string" ? o.alt : "",
    testoParlato: testo(o.testo_parlato),
    sottotitoliOk: o.sottotitoli_ok === true,
    muto: o.muto === true,
    ritraePersone,
    // manca (vista) = la vista ha già tolto chi non ce l'ha; c'è = conta il valore
    liberatoriaOk: siSeManca(o.liberatoria_ok),
    valoreOpzione: testo(o.valore_opzione),
    ordine: intero(o.ordine) ?? 0,
    rimossoIl: testo(o.rimosso_il),
    creatoIl: testo(o.creato_il),
  };
}

/* ── categoria ────────────────────────────────────────────────────────── */

export function categoriaDaRiga(riga: unknown): Categoria | null {
  const o = oggetto(riga);
  if (!o) return null;
  const id = testo(o.id), slug = testo(o.slug), nome = testo(o.nome);
  if (!id || !slug || !slugValido(slug) || !nome) return null;
  return {
    id, slug, nome,
    tipo: o.tipo === "collezione" ? "collezione" : "categoria",
    frase: testo(o.frase),
    fotoPath: testo(o.foto_path),
    seoTitolo: testo(o.seo_titolo),
    seoDescrizione: testo(o.seo_descrizione),
    ordine: intero(o.ordine) ?? 0,
    // una vista mostra solo le visibili; se la colonna manca vale «visibile». Una tabella ha sempre la colonna.
    visibile: siSeManca(o.visibile),
    pubblicataIl: testo(o.pubblicata_il),
  };
}
