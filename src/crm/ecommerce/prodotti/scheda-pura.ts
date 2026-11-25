/** ── LA SCHEDA PRODOTTO: LE REGOLE SENZA SCHERMO (scheda-pura.ts) ──────────────
 *  Commessa 2026-11-20-shop-completo, T15 (Design §4.10.2 e §4.10.4). Niente React e niente rete: il modulo che si scrive
 *  (tutto testo, come lo digita il titolare), la conversione nei campi che il server accetta, il confronto «solo ciò che
 *  è cambiato», il pannello «Prima di pubblicare» in tempo reale (la STESSA `controllaPubblicazione` del server), a quale
 *  sezione porta ogni voce, il segno «a posto / da sistemare (n)», l'indirizzo dell'anteprima e le regole delle varianti.
 *  Si prova in `prove/negozio/scheda-pura.mjs` (impacchettato con esbuild).
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · Un campo con un errore NON parte mai verso il server (il server rifiuterebbe l'intero salvataggio e tutti i campi
 *    dopo restavano bloccati): l'errore sta accanto al campo e il pulsante «Pubblica» resta spento.
 *  · Lo SKU, l'indirizzo e il PREZZO di un prodotto pubblicato non partono col salvataggio automatico: lo SKU e l'indirizzo
 *    non si cambiano più, il prezzo ha il suo tasto (è l'unico campo che cambia il sito subito: nessun «1» a metà di «19,90»).
 *  · Il prezzo passa SEMPRE da `centDaEuro` (mai `parseFloat`, mai `* 100`).
 *  · Non esistono prezzo barrato, sconto, stelle, best seller: non c'è un campo per scriverli. */
import {
  MAX_COMBINAZIONI,
  MAX_OPZIONI,
  TETTI,
  centDaEuro,
  combinazioni,
  skuValido,
  slugValido,
  type Canali,
  type Caratteristica,
  type Media,
  type OpzioneInput,
  type Prodotto,
  type TipoProdotto,
  type Variante,
} from "@/shop/cms/modello";
import { controllaPubblicazione, type SkuUsato, type Voce } from "@/shop/cms/pubblicazione";
import { eInvisibleDerm } from "@/shop/cms/pubblico";
import { controllaTesto } from "@/shop/cms/testi";

/* ══ LE SEZIONI ═════════════════════════════════════════════════════════════ */

export const SEZIONI = [
  { id: "identita", titolo: "Nome e indirizzo" },
  { id: "categorie", titolo: "Categorie" },
  { id: "descrizione", titolo: "Descrizione" },
  { id: "caratteristiche", titolo: "Caratteristiche" },
  { id: "prezzo", titolo: "Prezzo" },
  { id: "varianti", titolo: "Varianti e giacenza" },
  { id: "foto", titolo: "Foto e video" },
  { id: "uso", titolo: "Come si usa e cosa c'è dentro" },
  { id: "reso", titolo: "Reso, consulenza e consegna" },
  { id: "canali", titolo: "Dove si vede" },
  { id: "ricerca", titolo: "Ricerca su Google" },
] as const;
export type SezioneId = (typeof SEZIONI)[number]["id"];

/* ══ IL MODULO (tutto testo) ════════════════════════════════════════════════ */

export interface Modulo {
  nome: string;
  slug: string;
  sku: string;
  tipo: TipoProdotto;
  marca: string;
  rigaPresentazione: string;
  descrizioneBreve: string;
  descrizioneLunga: string;
  perChi: string;
  caratteristiche: Caratteristica[];
  /** Euro come li scrive il titolare («19,90»). Vuoto = ancora nessun prezzo. */
  prezzo: string;
  /** Una voce per riga. */
  passi: string;
  confezione: string;
  avvertenze: string;
  faq: { d: string; r: string }[];
  reso: "" | "si" | "no";
  resoGiorni: string;
  boxConsulenza: boolean;
  /** L'id del prodotto collegato, o vuoto. */
  correlatoId: string;
  canali: Canali;
  seoTitolo: string;
  seoDescrizione: string;
  /** Editor prodotti (E5): i campi del prodotto semplice e delle colonne laterali, tutti come testo che si scrive. */
  gtin: string;
  mpn: string;
  categoriaGoogle: string;
  /** Grammi, intero («250»). */
  pesoG: string;
  classeSpedizione: string;
  fornitore: string;
  noteInterne: string;
  notaTitolare: string;
}
export type CampoModulo = keyof Modulo;

/** I campi come li vuole `prodotto_salva` (camelCase, tipi veri). */
export interface CampiScheda {
  nome: string;
  slug: string;
  sku: string;
  tipo: TipoProdotto;
  marca: string | null;
  rigaPresentazione: string | null;
  descrizioneBreve: string | null;
  descrizioneLunga: string | null;
  perChi: string | null;
  caratteristiche: Caratteristica[];
  prezzoCent: number;
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
  gtin: string | null;
  mpn: string | null;
  categoriaGoogle: string | null;
  pesoG: number | null;
  classeSpedizione: string | null;
  fornitore: string | null;
  noteInterne: string | null;
  notaTitolare: string | null;
}
export type Errori = Partial<Record<CampoModulo, string>>;

/** Centesimi → «19,90». Zero = campo vuoto (un prodotto nuovo non ha ancora un prezzo). */
export const prezzoInTesto = (cent: number): string =>
  Number.isSafeInteger(cent) && cent > 0
    ? `${Math.floor(cent / 100)},${String(cent % 100).padStart(2, "0")}`
    : "";

/** Dal prodotto al modulo. Un PUBBLICATO mostra la bozza di modifica sopra i valori vivi (D27): è ciò che il titolare ha scritto. */
export function moduloDaProdotto(p: Prodotto): Modulo {
  const e: Prodotto =
    p.stato === "pubblicato" && p.bozzaModifiche ? { ...p, ...p.bozzaModifiche } : p;
  const righe = (x: string[] | null | undefined) => (Array.isArray(x) ? x.join("\n") : "");
  return {
    nome: e.nome,
    slug: p.slug,
    sku: p.sku,
    tipo: e.tipo,
    marca: e.marca ?? "",
    rigaPresentazione: e.rigaPresentazione ?? "",
    descrizioneBreve: e.descrizioneBreve ?? "",
    descrizioneLunga: e.descrizioneLunga ?? "",
    perChi: e.perChi ?? "",
    caratteristiche: Array.isArray(e.caratteristiche)
      ? e.caratteristiche.map((r) => ({ ...r }))
      : [],
    prezzo: prezzoInTesto(p.prezzoCent),
    passi: righe(e.passi),
    confezione: righe(e.confezione),
    avvertenze: righe(e.avvertenze),
    faq: Array.isArray(e.faq) ? e.faq.map((f) => ({ d: f.d, r: f.r })) : [],
    reso: e.resoConsentito === true ? "si" : e.resoConsentito === false ? "no" : "",
    resoGiorni: e.resoGiorni === null || e.resoGiorni === undefined ? "" : String(e.resoGiorni),
    boxConsulenza: e.boxConsulenza === true,
    correlatoId: e.correlatoId ?? "",
    canali: {
      sito: e.canali?.sito === true,
      meta: e.canali?.meta === true,
      google: e.canali?.google === true,
      tiktok: e.canali?.tiktok === true,
    },
    seoTitolo: e.seoTitolo ?? "",
    seoDescrizione: e.seoDescrizione ?? "",
    gtin: e.gtin ?? "",
    mpn: e.mpn ?? "",
    categoriaGoogle: e.categoriaGoogle ?? "",
    pesoG: e.pesoG === null || e.pesoG === undefined ? "" : String(e.pesoG),
    classeSpedizione: e.classeSpedizione ?? "",
    fornitore: e.fornitore ?? "",
    noteInterne: e.noteInterne ?? "",
    notaTitolare: e.notaTitolare ?? "",
  };
}

/** Ha una bozza di modifica (D27)? Un oggetto vuoto non è una bozza. */
export const haBozza = (b: unknown): boolean =>
  !!b && typeof b === "object" && !Array.isArray(b) && Object.keys(b).length > 0;

/* ══ DAL MODULO AI CAMPI ════════════════════════════════════════════════════ */

const RIGHE_MAX = 30;
const RIGA_MAX = 500;
const CARATTERISTICHE_MAX = 40;
const FAQ_MAX = 20;
const GIORNI_RESO_MAX = 365;
const MAX_SEO = { titolo: 300, descrizione: 500 } as const;
const MAX_PESO_G = 1_000_000;

const righeDi = (t: string): string[] =>
  t
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const uguali = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Il testo di un campo, tutto in una stringa, per cercare ciò che non si può scrivere (stessa cosa che fa il server). */
function testoDi(m: Modulo, k: CampoModulo): string {
  if (k === "caratteristiche")
    return m.caratteristiche.map((r) => `${r.etichetta}\n${r.valore}\n${r.fonte ?? ""}`).join("\n");
  if (k === "faq") return m.faq.map((f) => `${f.d}\n${f.r}`).join("\n");
  const v = m[k];
  return typeof v === "string" ? v : "";
}
/** I campi di testo libero, quelli su cui si cercano parole da non usare e frasi vietate. */
const CAMPI_TESTO: readonly CampoModulo[] = [
  "nome",
  "marca",
  "rigaPresentazione",
  "descrizioneBreve",
  "descrizioneLunga",
  "perChi",
  "caratteristiche",
  "passi",
  "confezione",
  "avvertenze",
  "faq",
  "seoTitolo",
  "seoDescrizione",
  // il server cerca le frasi vietate in OGNI campo che riceve: qui lo stesso (E5)
  "gtin",
  "mpn",
  "categoriaGoogle",
  "classeSpedizione",
  "fornitore",
  "noteInterne",
  "notaTitolare",
];

/** Accanto a ogni campo di testo: i BLOCCHI (non si scrive) e gli AVVISI (parole da non usare). Un campo pulito non compare. */
export function avvisiCampi(
  m: Modulo,
): Partial<Record<CampoModulo, { bloccanti: string[]; avvisi: string[] }>> {
  const fuori: Partial<Record<CampoModulo, { bloccanti: string[]; avvisi: string[] }>> = {};
  for (const k of CAMPI_TESTO) {
    const esito = controllaTesto(testoDi(m, k));
    const bloccanti = [...new Set(esito.bloccanti.map((b) => b.frase))];
    const avvisi = [...new Set(esito.avvisi.map((a) => a.frase))];
    if (bloccanti.length || avvisi.length) fuori[k] = { bloccanti, avvisi };
  }
  return fuori;
}

/**
 * Il modulo → i campi per il server, più gli errori da mostrare accanto ai campi. Un campo con un errore NON è in `campi`.
 * ⚠️ Lo stesso controllo del server (`prodotti.server.ts`, `VALIDA`): se il server avrebbe rifiutato, qui c'è già la frase.
 */
export function campiDaModulo(m: Modulo): { campi: Partial<CampiScheda>; errori: Errori } {
  const campi: Partial<CampiScheda> = {};
  const errori: Errori = {};
  const errore = (k: CampoModulo, frase: string) => void (errori[k] = errori[k] ?? frase);

  const nome = m.nome.trim();
  if (!nome) errore("nome", "Scrivi il nome del prodotto.");
  else if (nome.length > 120) errore("nome", "Il nome può avere al massimo 120 segni.");
  else campi.nome = nome;

  if (!slugValido(m.slug))
    errore("slug", "L'indirizzo ha solo minuscole, numeri e trattini (per esempio lace-front).");
  else campi.slug = m.slug;
  if (!skuValido(m.sku))
    errore("sku", "Lo SKU è maiuscolo, senza spazi, da 2 a 40 segni (per esempio HG-T01).");
  else campi.sku = m.sku;
  campi.tipo = m.tipo;

  const opz = (
    k: CampoModulo,
    t: string,
    max: number,
    nomeCampo: string,
  ): string | null | undefined => {
    const v = t.trim();
    if (v.length > max)
      return void errore(k, `${nomeCampo}: al massimo ${max} segni (ora ${v.length}).`);
    return v || null;
  };
  const marca = opz("marca", m.marca, 80, "La marca");
  if (marca !== undefined) campi.marca = marca;
  const riga = opz(
    "rigaPresentazione",
    m.rigaPresentazione,
    TETTI.riga,
    "La riga di presentazione",
  );
  if (riga !== undefined) campi.rigaPresentazione = riga;
  const breve = opz("descrizioneBreve", m.descrizioneBreve, TETTI.breve, "La descrizione breve");
  if (breve !== undefined) campi.descrizioneBreve = breve;
  const lunga = opz("descrizioneLunga", m.descrizioneLunga, 5000, "La descrizione lunga");
  if (lunga !== undefined) campi.descrizioneLunga = lunga;
  const perChi = opz("perChi", m.perChi, 200, "«Per chi è»");
  if (perChi !== undefined) campi.perChi = perChi;
  const seoT = opz("seoTitolo", m.seoTitolo, MAX_SEO.titolo, "Il titolo");
  if (seoT !== undefined) campi.seoTitolo = seoT;
  const seoD = opz("seoDescrizione", m.seoDescrizione, MAX_SEO.descrizione, "La descrizione");
  if (seoD !== undefined) campi.seoDescrizione = seoD;
  // i campi del prodotto semplice e delle colonne laterali (stessi massimi di `VALIDA` del server)
  const gtin = opz("gtin", m.gtin, 20, "Il barcode");
  if (gtin !== undefined) campi.gtin = gtin;
  const mpn = opz("mpn", m.mpn, 40, "Il codice produttore");
  if (mpn !== undefined) campi.mpn = mpn;
  const catGoogle = opz("categoriaGoogle", m.categoriaGoogle, 200, "La categoria Google");
  if (catGoogle !== undefined) campi.categoriaGoogle = catGoogle;
  const classe = opz("classeSpedizione", m.classeSpedizione, 40, "La classe di spedizione");
  if (classe !== undefined) campi.classeSpedizione = classe;
  const fornitore = opz("fornitore", m.fornitore, 200, "Il fornitore");
  if (fornitore !== undefined) campi.fornitore = fornitore;
  const noteInterne = opz("noteInterne", m.noteInterne, 5000, "La nota interna");
  if (noteInterne !== undefined) campi.noteInterne = noteInterne;
  const notaTitolare = opz("notaTitolare", m.notaTitolare, 2000, "La nota del titolare");
  if (notaTitolare !== undefined) campi.notaTitolare = notaTitolare;
  const peso = m.pesoG.trim();
  if (!peso) campi.pesoG = null;
  else if (!/^\d{1,7}$/.test(peso) || Number(peso) > MAX_PESO_G)
    errore(
      "pesoG",
      `Il peso è un numero intero di grammi, da 0 a ${MAX_PESO_G} (per esempio 250).`,
    );
  else campi.pesoG = Number(peso);

  // prezzo: vuoto = ancora zero (una bozza); il resto passa da centDaEuro
  const prezzo = m.prezzo.trim();
  if (!prezzo) campi.prezzoCent = 0;
  else {
    const cent = centDaEuro(prezzo);
    if (cent === null)
      errore(
        "prezzo",
        "Scrivi il prezzo in euro, per esempio 19,90 (al massimo due cifre dopo la virgola).",
      );
    else campi.prezzoCent = cent;
  }

  // liste, una voce per riga
  for (const [k, nomeLista] of [
    ["passi", "Come si usa"],
    ["confezione", "Nella confezione"],
    ["avvertenze", "Avvertenze"],
  ] as const) {
    const voci = righeDi(m[k]);
    if (voci.length > RIGHE_MAX) errore(k, `${nomeLista}: al massimo ${RIGHE_MAX} voci.`);
    else if (voci.some((v) => v.length > RIGA_MAX))
      errore(k, `${nomeLista}: una voce è troppo lunga (al massimo ${RIGA_MAX} segni).`);
    else campi[k] = voci;
  }

  // caratteristiche: una riga tutta vuota si scarta; una a metà è un errore; «confermata» vuole la fonte
  const righeCar = m.caratteristiche.map((r) => ({
    etichetta: r.etichetta.trim(),
    valore: r.valore.trim(),
    stato: r.stato,
    fonte: (r.fonte ?? "").trim() || null,
  }));
  const piene = righeCar.filter((r) => r.etichetta || r.valore || r.fonte);
  if (piene.some((r) => !r.etichetta || !r.valore))
    errore(
      "caratteristiche",
      "Una caratteristica è a metà: scrivi sia il nome sia il valore, oppure togli la riga.",
    );
  else if (piene.some((r) => r.stato === "confermato" && !r.fonte))
    errore(
      "caratteristiche",
      "Una caratteristica «confermata» ha bisogno della fonte (la scheda del fornitore o il file).",
    );
  else if (piene.length > CARATTERISTICHE_MAX)
    errore("caratteristiche", `Le caratteristiche sono al massimo ${CARATTERISTICHE_MAX}.`);
  else if (piene.some((r) => r.etichetta.length > 80 || r.valore.length > 300))
    errore("caratteristiche", "Una caratteristica è troppo lunga (nome 80 segni, valore 300).");
  else
    campi.caratteristiche = piene.map((r) => ({
      etichetta: r.etichetta,
      valore: r.valore,
      stato: r.stato,
      fonte: r.fonte,
    }));

  // domande frequenti
  const faq = m.faq.map((f) => ({ d: f.d.trim(), r: f.r.trim() })).filter((f) => f.d || f.r);
  if (faq.some((f) => !f.d || !f.r))
    errore(
      "faq",
      "Una domanda frequente è a metà: scrivi la domanda e la risposta, oppure togli la riga.",
    );
  else if (faq.length > FAQ_MAX) errore("faq", `Le domande frequenti sono al massimo ${FAQ_MAX}.`);
  else if (faq.some((f) => f.d.length > 300 || f.r.length > 1500))
    errore("faq", "Una domanda frequente è troppo lunga (domanda 300 segni, risposta 1500).");
  else campi.faq = faq;

  // reso
  if (m.reso === "si") {
    campi.resoConsentito = true;
    const g = m.resoGiorni.trim();
    if (!g) campi.resoGiorni = null;
    else if (!/^\d{1,3}$/.test(g) || Number(g) > GIORNI_RESO_MAX)
      errore("resoGiorni", `I giorni per il reso sono un numero intero da 0 a ${GIORNI_RESO_MAX}.`);
    else campi.resoGiorni = Number(g);
  } else {
    campi.resoConsentito = m.reso === "no" ? false : null;
    campi.resoGiorni = null;
  }

  if (m.boxConsulenza && m.tipo !== "patch")
    errore("boxConsulenza", "Il box consulenza si mostra solo sulle patch.");
  else campi.boxConsulenza = m.boxConsulenza;
  campi.correlatoId = m.correlatoId.trim() || null;
  campi.canali = {
    sito: m.canali.sito,
    meta: m.canali.meta,
    google: m.canali.google,
    tiktok: m.canali.tiktok,
  };

  // ciò che non si può scrivere: il campo resta com'era (non parte) e l'errore sta accanto
  for (const [k, a] of Object.entries(avvisiCampi(m)) as [CampoModulo, { bloccanti: string[] }][]) {
    if (!a.bloccanti.length) continue;
    errori[k] = a.bloccanti[0];
    delete (campi as Record<string, unknown>)[k];
  }
  return { campi, errori };
}

/** Quali campi vanno al server: solo quelli cambiati. Su un pubblicato SKU, indirizzo e prezzo non partono da soli. */
export function patchCampi(
  salvati: Partial<CampiScheda>,
  nuovi: Partial<CampiScheda>,
  o: { pubblicato: boolean },
): Partial<CampiScheda> {
  const fuori: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(nuovi)) {
    if (o.pubblicato && (k === "sku" || k === "slug" || k === "prezzoCent")) continue;
    if (!uguali((salvati as Record<string, unknown>)[k], v)) fuori[k] = v;
  }
  return fuori as Partial<CampiScheda>;
}

/* ══ «PRIMA DI PUBBLICARE», IN TEMPO REALE ══════════════════════════════════ */

const CAMPO_A_SEZIONE: Record<string, SezioneId> = {
  nome: "identita",
  slug: "identita",
  sku: "identita",
  tipo: "identita",
  marca: "identita",
  categoria: "categorie",
  categorie: "categorie",
  rigaPresentazione: "descrizione",
  descrizioneBreve: "descrizione",
  descrizioneLunga: "descrizione",
  perChi: "descrizione",
  caratteristiche: "caratteristiche",
  prezzo: "prezzo",
  varianti: "varianti",
  fotoPrincipale: "foto",
  alt: "foto",
  video: "foto",
  media: "foto",
  passi: "uso",
  confezione: "uso",
  avvertenze: "uso",
  faq: "uso",
  reso: "reso",
  resoGiorni: "reso",
  boxConsulenza: "reso",
  correlatoId: "reso",
  spedizione: "reso",
  canali: "canali",
  seoTitolo: "ricerca",
  seoDescrizione: "ricerca",
};

/** A quale sezione porta una voce. Lo «sku» è ambiguo (il prodotto o una sua variante): si capisce dalla frase. Un campo che non conosco porta in cima. */
export function sezioneDi(voce: Voce, ctx: { nome: string; sku: string }): SezioneId {
  if (voce.campo === "sku") {
    if (voce.frase.includes("due varianti")) return "varianti";
    return voce.frase.includes(`“${ctx.sku}”`) || voce.frase.includes(`“${ctx.nome}”`)
      ? "identita"
      : "varianti";
  }
  return Object.hasOwn(CAMPO_A_SEZIONE, voce.campo) ? CAMPO_A_SEZIONE[voce.campo] : "identita";
}

/** L'id dell'elemento a cui porta una voce (il campo, o l'inizio della sezione se il campo non ha un suo elemento). */
export const idCampo = (campo: string): string => `f-${campo}`;

export interface ControlloLive {
  bloccanti: Voce[];
  informativi: Voce[];
}

/**
 * Il pannello «Prima di pubblicare»: gli errori del modulo (campi che non partono) e `controllaPubblicazione` sul prodotto
 * COME SARÀ. In bozza conta il prezzo scritto; su un pubblicato conta il prezzo vivo (quello scritto e non ancora applicato non conta).
 * `altriSku`: gli SKU degli altri prodotti che la pagina conosce (l'elenco): gli SKU delle varianti di altri li controlla il server.
 */
export function controlloLive(o: {
  base: Prodotto;
  campi: Partial<CampiScheda>;
  errori: Errori;
  varianti: readonly Variante[];
  media: readonly Media[];
  categorie: readonly string[];
  altriSku: readonly SkuUsato[];
  pubblicato: boolean;
}): ControlloLive {
  const { prezzoCent, ...resto } = o.campi;
  const prodotto = {
    ...o.base,
    ...resto,
    ...(!o.pubblicato && prezzoCent !== undefined ? { prezzoCent } : {}),
  } as Prodotto;
  const esito = controllaPubblicazione(prodotto, o.varianti, o.media, o.categorie, {
    spedizioneImpostata: null,
    tuttiGliSku: o.altriSku,
  });
  const daiCampi: Voce[] = Object.entries(o.errori).map(([campo, frase]) => ({
    campo,
    frase: frase as string,
  }));
  const visti = new Set<string>();
  const bloccanti = [...daiCampi, ...esito.bloccanti].filter((v) =>
    visti.has(v.frase) ? false : (visti.add(v.frase), true),
  );
  return { bloccanti, informativi: esito.informativi };
}

export interface ConteggioSezione {
  bloccanti: number;
  informativi: number;
}
export function conteggiPerSezione(
  bloccanti: readonly Voce[],
  informativi: readonly Voce[],
  ctx: { nome: string; sku: string },
): Record<SezioneId, ConteggioSezione> {
  const conti = Object.fromEntries(
    SEZIONI.map((s) => [s.id, { bloccanti: 0, informativi: 0 }]),
  ) as Record<SezioneId, ConteggioSezione>;
  for (const v of bloccanti) conti[sezioneDi(v, ctx)].bloccanti++;
  for (const v of informativi) conti[sezioneDi(v, ctx)].informativi++;
  return conti;
}

export type TonoSezione = "ok" | "da_sistemare" | "da_controllare";
/** Il segno accanto al titolo della sezione. Sempre testo (mai solo il colore). */
export function statoSezione(c: ConteggioSezione): { tono: TonoSezione; testo: string } {
  if (c.bloccanti > 0) return { tono: "da_sistemare", testo: `da sistemare (${c.bloccanti})` };
  if (c.informativi > 0)
    return { tono: "da_controllare", testo: `da controllare (${c.informativi})` };
  return { tono: "ok", testo: "a posto" };
}

/* ══ INVISIBLE DERM (D39) ═══════════════════════════════════════════════════ */

/** Invisible Derm non ha un prezzo pubblico: la scheda non mostra il campo. La funzione è una sola, quella di `shop/cms/pubblico.ts` (D39/D40): qui si riesporta. */
export { eInvisibleDerm };

/* ══ L'ANTEPRIMA ════════════════════════════════════════════════════════════ */

/** `/shop/prodotto/<slug>?anteprima=<scadenza>.<firma>` (D31) → indirizzo assoluto. Qualunque altra forma → `null`: non si copia mai un indirizzo che non è nostro. */
export function indirizzoAnteprima(origine: string, url: unknown): string | null {
  if (
    typeof url !== "string" ||
    !/^\/shop\/prodotto\/[a-z0-9]+(?:-[a-z0-9]+)*\?anteprima=\d{1,16}\.[0-9a-f]{64}$/.test(url)
  )
    return null;
  return `${origine.replace(/\/+$/, "")}${url}`;
}

/* ══ LE VARIANTI ════════════════════════════════════════════════════════════ */

/** Le opzioni di oggi, ricostruite dalle varianti: nome nell'ordine in cui compare, valori nell'ordine delle varianti, senza doppioni. */
export function opzioniDaVarianti(varianti: readonly Variante[]): OpzioneInput[] {
  const per = new Map<string, string[]>();
  for (const v of [...varianti].sort((a, b) => a.ordine - b.ordine))
    for (const [nome, valore] of Object.entries(v.opzioni ?? {})) {
      const valori = per.get(nome) ?? [];
      if (!valori.includes(valore)) valori.push(valore);
      per.set(nome, valori);
    }
  return [...per].map(([nome, valori]) => ({ nome, valori }));
}

/** Il prezzo di una variante: vuoto = vale quello del prodotto (D25, `null`); altrimenti euro validi. */
export function prezzoVarianteDaTesto(
  t: string,
): { ok: true; cent: number | null } | { ok: false } {
  if (!t.trim()) return { ok: true, cent: null };
  const cent = centDaEuro(t);
  return cent === null ? { ok: false } : { ok: true, cent };
}

const MAX_PEZZI = 1_000_000;
/** I pezzi in magazzino: un intero da 0 a un milione (lo stesso tetto del server). */
export function quantitaDaTesto(t: string): { ok: true; n: number } | { ok: false } {
  const s = t.trim();
  if (!/^\d{1,7}$/.test(s) || Number(s) > MAX_PEZZI) return { ok: false };
  return { ok: true, n: Number(s) };
}

/** Quante combinazioni nascono dalle opzioni scritte, quante ci sono già e quante sono nuove; o la frase del limite (3 opzioni, 50 combinazioni). */
export function anteprimaCombinazioni(
  skuProdotto: string,
  opzioni: readonly OpzioneInput[],
  esistenti: readonly { sku: string }[],
): { ok: true; totale: number; nuove: number; esistenti: number } | { ok: false; frase: string } {
  const g = combinazioni(skuProdotto, opzioni);
  if (!g.ok) return { ok: false, frase: g.frase };
  const noti = new Set(esistenti.map((v) => v.sku));
  const nuove = g.varianti.filter((v) => !noti.has(v.sku)).length;
  return { ok: true, totale: g.varianti.length, nuove, esistenti: g.varianti.length - nuove };
}

/** I tetti, per le frasi della schermata («al massimo 3 opzioni e 50 combinazioni»). */
export const LIMITI_VARIANTI = { opzioni: MAX_OPZIONI, combinazioni: MAX_COMBINAZIONI } as const;
