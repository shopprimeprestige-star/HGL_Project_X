/** ── LE REGOLE DELLA PAGINA «TRE SOLUZIONI» · PURE ──────────────────────────
 *  Niente `window`, niente rete: lavorano sul contenuto grezzo del CRM
 *  (`LandingContent`) SOLO SUL SERVER e ne tirano fuori la `VistaSoluzioni`,
 *  l'unica cosa che arriva al browser. Nell'HTML non devono finire i testi
 *  della vecchia landing («47€», «1326», «Verificato»), né l'indirizzo di un
 *  file nascosto (liberatoria spenta, cancello chiuso).
 *  Le prove (`prove/sito/soluzioni-regole.mjs`) le guardano una per una.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { FieldDef, LandingContent } from "@/landing/landing-content";
import type { Mancante } from "./cancello";

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

//  S1.0: scheletro che compila e non lascia passare niente. Le regole vere arrivano in S1.1.
export function urlMedia(_u: unknown, _origineStorage: string): string {
  return "";
}

export function mostrabile(_chi: string, _liberatoria: string): boolean {
  return false;
}

export function vistaSoluzioni(
  _c: LandingContent,
  _o: { origineStorage: string; fotoPatchRipiego: string | null; macroRipiegoOk: boolean; anteprima: boolean },
): VistaSoluzioni {
  return VISTA_VUOTA;
}

export function campo(_c: LandingContent, _chiave: string): string | null {
  return null;
}

export function destinazioneCancello(_search: string): string {
  return "/";
}

export function apriDaRicerca(_search: unknown): boolean {
  return false;
}

export function avvisiFile(
  _f: { tipo: string; larghezza: number; altezza: number; byte: number },
  _def: Pick<FieldDef, "type" | "formato" | "pesoMax">,
): string[] {
  return [];
}
