/** ── VETRINA V1 · T74 · LE FOTO DELLO SHOP (parte pura) ─────────────────────
 *  Cosa deve valere (D98, D99, V1-T4, V1-T14):
 *   · `srcset` dalle misure del CMS (480/960/1600), ma mai una misura OLTRE la prima che copre il doppio del riquadro
 *     più grande che lo slot raggiunge: nessuna immagine più larga del doppio del suo riquadro, salvo la prima che lo copre;
 *   · `width`/`height` sempre dichiarati (il browser riserva lo spazio, nessuno scatto);
 *   · solo la foto `prima` (sopra la piega) è `eager` + `fetchpriority="high"`; le altre `lazy` + `decoding="async"`;
 *   · `alt` mancante: lancia in sviluppo, in produzione disegna `alt=""` (il CMS blocca già la pubblicazione senza descrizione);
 *   · le foto globali (landing: un solo file, ridotto nell'editor al lato di D99) non hanno `srcset`.
 *  Nessun React qui: la prova lo gira senza browser. Il disegno è `src/components/shop/FotoShop.tsx`. */

/** Le misure che il CMS produce per ogni foto (quadrate). Di una foto «campione» esiste solo la 480. */
export type MisureFoto = { w480: string; w960?: string; w1600?: string };

/** Proporzioni (larghezza, altezza): prodotto quadrato, persone e video 4:5, studio e pacco 4:3. */
export const proporzioni = { quadrata: [1, 1], persona: [4, 5], studio: [4, 3] } as const;
type Proporzione = readonly [number, number];

export type UsoFoto = "card" | "galleria" | "miniatura" | "hero" | "ritratto" | "pacco" | "colori" | "poster";

/** `riquadro` = il lato più grande (in px CSS) che lo slot raggiunge; `lato` = lato lungo del file di una foto globale (D99,
 *  per le foto del CMS conta la misura più grande offerta). `sizes` descrive il riquadro al browser. */
export const USI: Record<UsoFoto, { prop: Proporzione; riquadro: number; lato: number; sizes: string }> = {
  card: { prop: proporzioni.quadrata, riquadro: 300, lato: 960, sizes: "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" },
  galleria: { prop: proporzioni.quadrata, riquadro: 640, lato: 1600, sizes: "(min-width: 1024px) 50vw, 100vw" },
  miniatura: { prop: proporzioni.quadrata, riquadro: 96, lato: 480, sizes: "96px" },
  hero: { prop: proporzioni.persona, riquadro: 440, lato: 1100, sizes: "(min-width: 768px) 440px, 100vw" },
  ritratto: { prop: proporzioni.quadrata, riquadro: 72, lato: 240, sizes: "72px" },
  pacco: { prop: proporzioni.studio, riquadro: 480, lato: 960, sizes: "(min-width: 768px) 480px, 100vw" },
  colori: { prop: proporzioni.studio, riquadro: 480, lato: 960, sizes: "(min-width: 768px) 480px, 100vw" },
  poster: { prop: proporzioni.persona, riquadro: 480, lato: 960, sizes: "(min-width: 768px) 480px, 100vw" },
};

const uso = (nome: string) => {
  const u = USI[nome as UsoFoto];
  if (!u) throw new Error(`FotoShop: uso sconosciuto «${nome}»`);
  return u;
};

export function sizesPer(nome: string): string {
  return uso(nome).sizes;
}

/** Le misure che esistono, dalla più piccola, tagliate dopo la prima che copre il doppio del `riquadro` (senza `riquadro`: tutte). */
export function candidati(foto: Partial<MisureFoto> | null | undefined, riquadro = Infinity): { url: string; w: number }[] {
  const tutte: { url: string; w: number }[] = [];
  for (const [w, url] of [[480, foto?.w480], [960, foto?.w960], [1600, foto?.w1600]] as [number, string | undefined][]) if (url) tutte.push({ url, w });
  const fine = tutte.findIndex((m) => m.w >= 2 * riquadro);
  return fine < 0 ? tutte : tutte.slice(0, fine + 1);
}

export function srcsetDa(foto: Partial<MisureFoto> | null | undefined, riquadro = Infinity): string {
  return candidati(foto, riquadro).map((m) => `${m.url} ${m.w}w`).join(", ");
}

/** Larghezza e altezza di un file col lato lungo `lato` nella proporzione `prop`. */
const misure = (prop: Proporzione, lato: number) => {
  const [a, b] = prop;
  return a >= b ? { width: lato, height: Math.round((lato * b) / a) } : { width: Math.round((lato * a) / b), height: lato };
};

export type DatiFoto = {
  /** Le misure del CMS (prodotti, categorie, campioni). */
  foto?: Partial<MisureFoto> | null;
  /** Una foto globale (un solo file, già ridotta nell'editor). */
  src?: string | null;
  alt?: string | null;
  uso: UsoFoto;
  /** Vince su quello dell'uso. */
  sizes?: string;
  /** Solo la prima foto sopra la piega. */
  prima?: boolean;
  /** `true` (di sviluppo) lancia se manca l'alt; `false` disegna `alt=""`. */
  sviluppo?: boolean;
};

export type AttributiImg = {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  width: number;
  height: number;
  loading: "eager" | "lazy";
  decoding?: "async";
  fetchPriority?: "high";
};

/** Gli attributi dell'`<img>`, o `null` se non c'è nessuna foto (non si disegna niente). */
export function attributiImg(d: DatiFoto): AttributiImg | null {
  const u = uso(d.uso);
  const lista = candidati(d.foto, u.riquadro);
  const singola = lista.length ? "" : (d.src ?? "");
  if (!lista.length && !singola) return null;
  if (typeof d.alt !== "string" && (d.sviluppo ?? true)) throw new Error("FotoShop: manca l'alt della foto");
  const prima = d.prima === true;
  return {
    src: lista.length ? lista[0].url : singola,
    srcSet: lista.length ? srcsetDa(d.foto, u.riquadro) : undefined,
    sizes: lista.length ? (d.sizes ?? u.sizes) : undefined,
    alt: typeof d.alt === "string" ? d.alt : "",
    ...misure(u.prop, lista.length ? lista[lista.length - 1].w : u.lato),
    loading: prima ? "eager" : "lazy",
    decoding: prima ? undefined : "async",
    fetchPriority: prima ? "high" : undefined,
  };
}
