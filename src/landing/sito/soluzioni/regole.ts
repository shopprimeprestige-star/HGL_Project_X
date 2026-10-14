/** ── LE REGOLE DELLA PAGINA «TRE SOLUZIONI» · PURE ──────────────────────────
 *  Niente `window`, niente rete: lavorano sul contenuto grezzo del CRM
 *  (`LandingContent`) SOLO SUL SERVER e ne tirano fuori la `VistaSoluzioni`,
 *  l'unica cosa che arriva al browser. Nell'HTML non devono finire i testi
 *  della vecchia landing («47€», «1326», «Verificato»), né l'indirizzo di un
 *  file nascosto (liberatoria spenta, cancello chiuso).
 *  Le prove (`prove/sito/soluzioni-regole.mjs`) le guardano una per una.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { FieldDef, LandingContent } from "@/landing/landing-content";
import { mancantiSoluzioni, urlMedia, type Mancante } from "./cancello";

export { urlMedia };

export type Interesse = "trapianto" | "invisible-derm" | "non-so";

export interface Slot {
  src: string;
  poster: string;
  alt: string;
}

export interface VistaSoluzioni {
  pubblicabile: boolean;
  anteprima: boolean;
  mancanti: Mancante[];
  /** protocol.titolareFoto */
  ritratto: Slot | null;
  /** Tutte o nessuna (4.2), dopo ripieghi e liberatorie. */
  miniature: { trapianto: Slot; patch: Slot; invisibile: Slot } | null;
  /** null solo in anteprima col cancello chiuso. */
  video: { slot: Slot; trascrizione: string | null } | null;
  /** Video + copertina + liberatoria (decisioni 13-14 del piano). */
  macro: Slot | null;
  /** Immagine di condivisione; ripiego: la copertina. */
  ogImage: string | null;
}

/** Il cancello chiuso e niente da mostrare. Congelata: nessuno la cambia per sbaglio. */
export const VISTA_VUOTA: VistaSoluzioni = Object.freeze({
  pubblicabile: false,
  anteprima: false,
  mancanti: Object.freeze(["video", "copertina", "sottotitoli"]) as unknown as Mancante[],
  ritratto: null,
  miniature: null,
  video: null,
  macro: null,
  ogImage: null,
});

/** Regola della liberatoria: un file con una persona si vede se è il titolare (o un collaboratore),
 *  oppure se c'è un cliente E la liberatoria scritta è accesa. «Chi si vede» vuoto vale «cliente». */
export function mostrabile(chi: string, liberatoria: string): boolean {
  return chi === "titolare" || liberatoria === "1";
}

/** Il valore pulito di un campo (testi e media): senza spazi ai bordi; vuoto o con «{{» (da confermare) → null. */
export function campo(c: LandingContent, chiave: string): string | null {
  const v = c.media[chiave] || c.texts[chiave];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return !t || t.includes("{{") ? null : t;
}

export interface OpzioniVista {
  origineStorage: string;
  /** La foto del primo articolo in stock del negozio: un valore del codice, non passa da `urlMedia`. */
  fotoPatchRipiego: string | null;
  /** Il ripiego `s03.media` per la clip ha già superato il controllo di tipo e peso (lo fa il server). */
  macroRipiegoOk: boolean;
  anteprima: boolean;
}

const chiSiVede = (c: LandingContent, prefisso: "v3.trapianto" | "v3.macro") =>
  mostrabile(campo(c, `${prefisso}Chi`) ?? "", campo(c, `${prefisso}Liberatoria`) ?? "");

function foto(c: LandingContent, origineStorage: string, chiave: string, chiaveAlt: string): Slot | null {
  const src = urlMedia(campo(c, chiave), origineStorage);
  return src ? { src, poster: "", alt: campo(c, chiaveAlt) ?? "" } : null;
}

/** L'indirizzo del ripiego `s03.media` per la clip, se SERVE e vale la pena controllarlo (una `HEAD` costa tempo):
 *  solo se la clip propria manca, c'è la copertina, e «chi si vede» la lascia mostrare. Altrimenti null. */
export function ripiegoMacroDaVerificare(c: LandingContent, origineStorage: string): string | null {
  if (urlMedia(campo(c, "protocol.macroVideo"), origineStorage)) return null;
  if (!urlMedia(campo(c, "protocol.macroPoster"), origineStorage)) return null;
  if (!chiSiVede(c, "v3.macro")) return null;
  return urlMedia(campo(c, "s03.media"), origineStorage) || null;
}

export function vistaSoluzioni(c: LandingContent, o: OpzioniVista): VistaSoluzioni {
  const mancanti = mancantiSoluzioni(c, o.origineStorage);
  const pubblicabile = mancanti.length === 0;
  //  Cancello chiuso e niente anteprima: nemmeno il ritratto esce (chiunque può chiamare la funzione del server).
  if (!pubblicabile && !o.anteprima) return { ...VISTA_VUOTA, mancanti };

  const os = o.origineStorage;
  const copertina = urlMedia(campo(c, "v3.invisiblePoster"), os);
  const filmato = urlMedia(campo(c, "v3.invisibleVideo"), os);

  //  Clip della macro: video proprio (o ripiego controllato) + copertina + liberatoria.
  const macroPoster = urlMedia(campo(c, "protocol.macroPoster"), os);
  const macroVideo = urlMedia(campo(c, "protocol.macroVideo"), os) || (o.macroRipiegoOk ? urlMedia(campo(c, "s03.media"), os) : "");
  const macroOk = chiSiVede(c, "v3.macro");
  const macro: Slot | null = macroOk && macroVideo && macroPoster ? { src: macroVideo, poster: macroPoster, alt: campo(c, "protocol.macroVideoAlt") ?? "" } : null;

  //  Le tre miniature: tutte o nessuna. Quella di Invisible Derm segue «chi si vede» della macro.
  const trapianto = chiSiVede(c, "v3.trapianto") ? foto(c, os, "v3.trapiantoFoto", "v3.trapiantoFotoAlt") : null;
  const altPatch = campo(c, "home.cartaCatalogoFotoAlt") ?? "";
  const patch = foto(c, os, "home.cartaCatalogoFoto", "home.cartaCatalogoFotoAlt") ?? (o.fotoPatchRipiego ? { src: o.fotoPatchRipiego, poster: "", alt: altPatch } : null);
  const invisibile = !macroOk
    ? null
    : (foto(c, os, "v3.invisibleMiniatura", "v3.invisibleMiniaturaAlt") ??
      (macroPoster ? { src: macroPoster, poster: "", alt: campo(c, "v3.invisibleMiniaturaAlt") ?? "" } : null));

  return {
    pubblicabile,
    anteprima: o.anteprima,
    mancanti,
    ritratto: foto(c, os, "protocol.titolareFoto", "protocol.titolareFotoAlt"),
    miniature: trapianto && patch && invisibile ? { trapianto, patch, invisibile } : null,
    video: filmato && copertina ? { slot: { src: filmato, poster: copertina, alt: campo(c, "v3.invisibleVideoAlt") ?? "" }, trascrizione: campo(c, "v3.invisibleTrascrizione") } : null,
    macro,
    ogImage: urlMedia(campo(c, "v3.condivisioneImmagine"), os) || copertina || null,
  };
}

/* ── Dove va chi trova il cancello chiuso ──────────────────────────────── */

const CHIAVI_FONTE = new Set(["fbclid", "gclid", "ttclid", "ad_id", "adset_id", "campaign_id"]);
const LUNGHEZZA_MASSIMA_FONTE = 200;

/** La home, con la sola fonte dell'annuncio (utm_*, fbclid, gclid, ttclid, ad_id, adset_id, campaign_id):
 *  «apri», «anteprima» e tutto il resto restano fuori. Sempre un percorso del sito, mai un altro indirizzo. */
export function destinazioneCancello(search: string): string {
  const fuori = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(typeof search === "string" ? search : "")) {
    if (v && v.length <= LUNGHEZZA_MASSIMA_FONTE && (CHIAVI_FONTE.has(k) || /^utm_[a-z0-9_]{1,30}$/.test(k))) fuori.append(k, v);
  }
  const resto = fuori.toString();
  return resto ? `/?${resto}` : "/";
}

/** `?apri=invisible-derm`: la pagina arriva già aperta sulla spiegazione. Accetta la ricerca già letta ({ apri }) o il testo. */
export function apriDaRicerca(search: unknown): boolean {
  if (typeof search === "string") return new URLSearchParams(search).get("apri") === "invisible-derm";
  if (search && typeof search === "object" && !Array.isArray(search)) return (search as { apri?: unknown }).apri === "invisible-derm";
  return false;
}

/* ── Gli avvisi dell'editor: dicono, non bloccano ──────────────────────── */

const TIPI_AMMESSI = { video: ["video/mp4"], image: ["image/webp", "image/jpeg", "image/png"] } as const;
const MB = 1024 * 1024;
/** Quanto scarto sulle proporzioni è «lo stesso formato» (718×1280 è 9:16). */
const SCARTO_PROPORZIONI = 0.03;

function proporzione(formato: string): number | null {
  const m = /^(\d+)(?::|x)(\d+)$/.exec(formato);
  return m ? Number(m[1]) / Number(m[2]) : null;
}

function pesoInByte(peso: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(KB|MB)\s*$/i.exec(peso);
  return m ? Number(m[1].replace(",", ".")) * (m[2].toUpperCase() === "MB" ? MB : 1024) : null;
}

const comeSiScrive = (byte: number) => (byte >= MB ? `${(byte / MB).toFixed(1).replace(".", ",")} MB` : `${Math.round(byte / 1024)} KB`);

/** Avvisi in italiano su un file appena scelto. Non blocca mai: la decisione resta al titolare. */
export function avvisiFile(
  f: { tipo: string; larghezza: number; altezza: number; byte: number },
  def: Pick<FieldDef, "type" | "formato" | "pesoMax">,
): string[] {
  if (def.type !== "image" && def.type !== "video") return [];
  const avvisi: string[] = [];
  if (!(TIPI_AMMESSI[def.type] as readonly string[]).includes(f.tipo)) {
    avvisi.push(def.type === "video" ? "Il file non è un video MP4: la pagina potrebbe non riuscire a mostrarlo." : "Il file non è un'immagine WebP, JPEG o PNG: la pagina potrebbe non riuscire a mostrarla.");
  }
  const atteso = def.formato ? proporzione(def.formato) : null;
  if (def.formato && atteso && f.larghezza > 0 && f.altezza > 0 && Math.abs(f.larghezza / f.altezza - atteso) / atteso > SCARTO_PROPORZIONI) {
    avvisi.push(`Le proporzioni non tornano: servono ${def.formato.replace("x", "×")} e questo file è ${f.larghezza}×${f.altezza}.`);
  }
  const massimo = def.pesoMax ? pesoInByte(def.pesoMax) : null;
  if (def.pesoMax && massimo && f.byte > massimo) {
    avvisi.push(`Il file pesa ${comeSiScrive(f.byte)}: il massimo consigliato è ${def.pesoMax}. La pagina si caricherebbe più lenta.`);
  }
  return avvisi;
}
