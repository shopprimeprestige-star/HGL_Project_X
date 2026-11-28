/** ── «METTI LE CATEGORIE»: LE REGOLE (categorie-auto.ts) ─────────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E16. Puro: nessuna rete, nessun database. Il file di Shopify non porta le categorie né la descrizione breve,
 *  e il canale «sito» nasce spento: un prodotto importato resta fuori da «Pubblica» con tre cose mancanti. Qui si decide COSA proporre;
 *  come si scrive sta in `categorie-auto-flusso.ts`, la finestra in `FinestraCategorieAuto.tsx`.
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · La categoria si propone dal NOME (e dal «Type» di Shopify quando c'è): la prima regola che combacia vince, dalla più specifica alla più
 *    generica («SCALP PROTECTOR SPRAY» è protezione, non uno spray; «PERFECT REMOVER … COLLE E TAPE» è un solvente, non una colla).
 *    Chi non combacia con niente non ha proposta: resta com'è e il titolare sceglie dal menu.
 *  · Le categorie che esistono già nel catalogo (migrazione del catalogo: Protesi & Toupee, Shampoo, Adesivi & Nastri…) si riusano, trovate per
 *    indirizzo (slug) o per nome: non se ne crea una seconda.
 *  · Mai sovrascrivere: la categoria si AGGIUNGE a quelle che ha, la descrizione breve e il canale «sito» si riempiono solo dove sono vuoti, e solo
 *    sulle bozze (su un prodotto pubblicato un testo finirebbe tra le «modifiche non pubblicate»). */
import { TETTI, slugDa, type TipoProdotto } from "@/shop/cms/modello";
import type { Voce } from "@/shop/cms/pubblicazione";
import { controllaTesto } from "@/shop/cms/testi";

export interface CategoriaAuto {
  slug: string;
  nome: string;
}

/** Le categorie che si propongono. I primi cinque indirizzi (e due nomi) sono quelli della migrazione del catalogo: se ci sono si riusano. */
export const CATEGORIE_AUTO: readonly CategoriaAuto[] = [
  { slug: "toupee", nome: "Protesi & Toupee" },
  { slug: "adesivi", nome: "Adesivi & Nastri" },
  { slug: "solventi", nome: "Solventi & Remover" },
  { slug: "protezione-cute", nome: "Protezione cute" },
  { slug: "shampoo", nome: "Shampoo" },
  { slug: "maschere-e-trattamenti", nome: "Maschere e trattamenti" },
  { slug: "styling", nome: "Styling" },
  { slug: "accessori", nome: "Accessori" },
  { slug: "kit", nome: "Kit Completi" },
];

/** Maiuscolo, senza accenti né apici ricurvi: così «PROFÉSIA» e «3/4”» si confrontano con quello che scriviamo qui. */
const norma = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’“”]/g, "'")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/** Le regole in ordine di forza: la prima che combacia col nome vince. */
const REGOLE: readonly { slug: string; parole: RegExp }[] = [
  { slug: "kit", parole: /\bKIT PROMO\b/ },
  { slug: "toupee", parole: /^PROTESI CAPELLI\b|\bKIT ?\/ ?\d+ PEZZI\b/ },
  { slug: "protezione-cute", parole: /\bSCALP PROTECTOR\b/ },
  { slug: "shampoo", parole: /\bSHAMPOO\b/ },
  { slug: "solventi", parole: /\b(REMOVER|SOLVENTE|CLEAN|DISCHETTI)\b/ },
  { slug: "accessori", parole: /\b(PENNELLO|TOUCH UP PEN|OPZIONE RITAGLIO)\b/ },
  {
    slug: "adesivi",
    parole:
      /\b(BOND|GLUE|COLLA|COLLE|TAPE|NASTRO|HOLD|LACE|STICK|SENSI-TAK|PRO-FLEX|NO SHINE|EXTENDA|QUICK AGGRESSIVE)\b|\d ?YARDS?\b/,
  },
  {
    slug: "maschere-e-trattamenti",
    parole:
      /\b(MASK|MASCHERA|OLIO|BENESSERE CUTE|ARGILLA|HYDRA BOOST|RICOSTRUZIONE|FLUIDO|BUTTER)\b/,
  },
  {
    slug: "styling",
    parole: /\b(GEL|CERA|WAX|POMADE|MOUSSE|LACCA|HAIRSPRAY|CURL|WHIPPED CREAM)\b/,
  },
  // «COLORE» da solo è la parola più debole: una «maschera colore» è una maschera
  { slug: "accessori", parole: /\bCOLORE\b/ },
];

const PATCH: TipoProdotto = "patch";

/** L'indirizzo della categoria proposta per un prodotto, o `null` se nessuna regola combacia. `tipo` è il «Type» di Shopify (o il tipo dello shop). */
export function proponiCategoria(nome: unknown, tipo?: unknown): string | null {
  if (typeof tipo === "string" && (norma(tipo) === "PROTESI CAPELLI" || tipo === PATCH))
    return "toupee";
  if (typeof nome !== "string") return null;
  const n = norma(nome);
  return REGOLE.find((r) => r.parole.test(n))?.slug ?? null;
}

/* ══ LE CATEGORIE CHE ESISTONO GIÀ ══════════════════════════════════════════ */

export interface CategoriaNota {
  id: string;
  slug: string;
  nome: string;
}

/** Quella che il catalogo ha già per questo indirizzo: stesso slug, oppure un nome che scritto da indirizzo dà quello stesso slug. */
export const trovaCategoria = (
  slug: string,
  note: readonly CategoriaNota[],
): CategoriaNota | undefined =>
  note.find((k) => k.slug === slug) ?? note.find((k) => slugDa(k.nome) === slug);

/** Le categorie scelte che nel catalogo non ci sono ancora, una volta sola ciascuna, nell'ordine di prima comparsa. Si creano nascoste. */
export function categorieDaCreare(
  scelte: readonly (string | null)[],
  note: readonly CategoriaNota[],
): CategoriaAuto[] {
  const fuori: CategoriaAuto[] = [];
  for (const s of scelte) {
    if (!s || fuori.some((k) => k.slug === s) || trovaCategoria(s, note)) continue;
    const k = CATEGORIE_AUTO.find((x) => x.slug === s);
    if (k) fuori.push(k);
  }
  return fuori;
}

/* ══ LA DESCRIZIONE BREVE ═══════════════════════════════════════════════════ */

const pulito = (t: unknown) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim() : "");

/** Taglia a `max` segni, MAI oltre: fine di frase se ce n'è una (il segno finale conta), altrimenti l'ultima parola intera con i puntini. */
function taglia(t: string, max: number): string {
  if (t.length <= max) return t;
  const frase = new RegExp(`^[\\s\\S]{1,${max - 1}}[.!?](?=\\s|$)`).exec(t)?.[0];
  if (frase) return frase;
  const corto = t.slice(0, max - 1);
  return `${corto.slice(0, Math.max(corto.lastIndexOf(" "), 1)).replace(/[\s,;:.]+$/, "")}…`;
}

/** Dopo queste sigle il punto non chiude la frase («ca. 3 cm», «es. rosso»). */
const SIGLE = /\b(ca|n|nr|es|ecc|cfr|max|min|circa|pag|tel|vs)\.$/i;

/** La prima frase del primo paragrafo che ne ha una (il titoletto senza punto non si fonde con la frase dopo); senza sigle che la spezzano. */
function primaFrase(lunga: unknown): string {
  if (typeof lunga !== "string") return "";
  const paragrafi = lunga
    .split(/\n\s*\n/)
    .map(pulito)
    .filter(Boolean);
  const p = paragrafi.find((x) => /[.!?](\s|$)/.test(x)) ?? paragrafi[0] ?? "";
  for (const m of p.matchAll(/[.!?](?=\s|$)/g)) {
    const fino = p.slice(0, m.index + 1);
    if (!SIGLE.test(fino)) return fino;
  }
  return p;
}

/** La descrizione breve proposta: la «descrizione per Google» già salvata, altrimenti la prima frase della descrizione lunga.
 *  `null` se non c'è niente da proporre o se il testo ha una frase che il negozio non pubblica (cifre vicino a Invisible Derm, sconti). */
export function proponiBreve(seoDescrizione: unknown, descrizioneLunga: unknown): string | null {
  const seo = pulito(seoDescrizione);
  const base = seo || primaFrase(descrizioneLunga);
  if (!base) return null;
  const testo = taglia(base, TETTI.breve);
  return controllaTesto(testo).bloccanti.length ? null : testo;
}

/* ══ UN PRODOTTO LETTO E COSA SI FA ═════════════════════════════════════════ */

export interface Canali {
  sito: boolean;
  meta: boolean;
  google: boolean;
  tiktok: boolean;
}
/** Ciò che serve della scheda di un prodotto: la versione per scrivere, le categorie che ha, i campi da guardare, i bloccanti di oggi. */
export interface Lettura {
  versione: string;
  stato: string;
  categorie: string[];
  breve: string;
  seo: string;
  lunga: string;
  canali: Canali;
  bloccanti: Voce[];
}

const eOggetto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** La risposta della scheda (`GET ?prodotto=`) ridotta a `Lettura`; `null` se non ha la forma attesa (mai indovinare). */
export function leggiProdotto(scheda: unknown): Lettura | null {
  if (
    !eOggetto(scheda) ||
    !eOggetto(scheda.prodotto) ||
    typeof scheda.versione !== "string" ||
    !scheda.versione
  )
    return null;
  const p = scheda.prodotto;
  const k = eOggetto(p.canali) ? p.canali : {};
  const controllo =
    eOggetto(scheda.controllo) && Array.isArray(scheda.controllo.bloccanti)
      ? scheda.controllo.bloccanti
      : [];
  return {
    versione: scheda.versione,
    stato: typeof p.stato === "string" ? p.stato : "",
    categorie: Array.isArray(scheda.categorie)
      ? scheda.categorie.filter((x): x is string => typeof x === "string")
      : [],
    breve: pulito(p.descrizioneBreve),
    seo: pulito(p.seoDescrizione),
    lunga: pulito(p.descrizioneLunga),
    canali: {
      sito: k.sito === true,
      meta: k.meta === true,
      google: k.google === true,
      tiktok: k.tiktok === true,
    },
    bloccanti: controllo.filter(
      (b): b is Voce => eOggetto(b) && typeof b.campo === "string" && typeof b.frase === "string",
    ),
  };
}

export interface Opzioni {
  /** Riempi la descrizione breve dove è vuota. */
  breve: boolean;
  /** Accendi il canale «sito» dove tutti i canali sono spenti. */
  sito: boolean;
}
export interface Decisione {
  /** Gli id di categoria da AGGIUNGERE (vuoto se il prodotto la ha già, non ce n'è una scelta o non è una bozza). */
  aggiungi: string[];
  /** Il testo da scrivere nella descrizione breve, o `null` (già piena, non una bozza, niente da proporre). */
  breve: string | null;
  /** Accendere il canale «sito» (solo se i quattro canali sono tutti spenti). */
  sito: boolean;
}

/** Cosa si scrive su un prodotto letto. Mai sovrascrivere: ciò che c'è già resta com'è. */
export function decidi(l: Lettura, idCategoria: string | null, opz: Opzioni): Decisione {
  const bozza = l.stato === "bozza";
  return {
    // un prodotto pubblicato (o archiviato) non si tocca mai: nemmeno la categoria, che andrebbe subito sul sito vivo
    aggiungi: idCategoria && bozza && !l.categorie.includes(idCategoria) ? [idCategoria] : [],
    breve: opz.breve && bozza && !l.breve ? proponiBreve(l.seo, l.lunga) : null,
    sito: opz.sito && bozza && !Object.values(l.canali).some(Boolean),
  };
}

/* ══ «DA FARE A MANO» ═══════════════════════════════════════════════════════ */

/** Quello che resta bloccante dopo la decisione (categoria, descrizione breve e canale sono sistemati da noi). */
export function restaAMano(l: Lettura, d: Decisione): Voce[] {
  return l.bloccanti.filter(
    (b) =>
      !(b.campo === "categoria" && d.aggiungi.length > 0) &&
      !(b.campo === "descrizioneBreve" && d.breve !== null) &&
      !(b.campo === "canali" && d.sito),
  );
}

const A_MANO: Record<string, string> = {
  fotoPrincipale: "la foto principale",
  alt: "il testo alternativo delle foto",
  varianti: "le varianti",
  prezzo: "il prezzo",
  sku: "lo SKU",
  video: "i sottotitoli del video",
  spedizione: "la spedizione del negozio (costo e tempi)",
  descrizioneBreve: "la descrizione breve",
  categoria: "la categoria",
  canali: "i canali",
};

/** «Da fare a mano: la foto principale (12 prodotti), il prezzo (1 prodotto).» — una voce per campo, col numero di prodotti. `null` se non resta niente. */
export function fraseDaFareAMano(rimasti: readonly (readonly Voce[])[]): string | null {
  const conti = new Map<string, number>();
  for (const voci of rimasti)
    for (const campo of new Set(voci.map((v) => v.campo)))
      conti.set(campo, (conti.get(campo) ?? 0) + 1);
  if (conti.size === 0) return null;
  const voci = [...conti].map(
    ([campo, n]) => `${A_MANO[campo] ?? campo} (${n} ${n === 1 ? "prodotto" : "prodotti"})`,
  );
  return `Da fare a mano: ${voci.join(", ")}.`;
}
