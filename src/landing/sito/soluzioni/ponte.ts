/** ── PONTE · I CONTRATTI DI S1 USATI DA S3 (dati, vista, cancello, anteprima, eventi) ──────────
 *  ⚠️ SEGNAPOSTO TEMPORANEO. La pagina `/soluzioni` dipende da file che scrivono S1, S2 e S4 su rami
 *  paralleli (PIANO-landing-v3, «Contratto»). Per non toccare file altrui e tenere `tsc` pulito, S3 importa
 *  TUTTO da qui, mai dai file veri, con le firme esatte del contratto.
 *
 *  ALL'UNIONE (ordine S1 → S2 → S4 → S3) questo file diventa un elenco di riesportazioni, e basta:
 *
 *    export type { Interesse, Slot, VistaSoluzioni } from "./regole";
 *    export { VISTA_VUOTA, destinazioneCancello, apriDaRicerca } from "./regole";
 *    export type { Mancante } from "./cancello";
 *    export { fraseSemaforo } from "./cancello";
 *    export { leggiSoluzioni, registraCancello } from "./contenuti";
 *    export { nuovoCodice, codiceValido } from "./anteprima";
 *    export type { Formato as FormatoMedia } from "@/landing/landing-content";
 *
 *  e `tracciaSoluzioni` diventa `export { traccia as tracciaSoluzioni } from "@/landing/sito/traccia"`.
 *  Poi si controlla che le IPOTESI qui sotto («IPOTESI») coincidano con le firme vere (LAVAGNA, voce S3).
 *  Le funzioni pure sono scritte per intero (sono corte e provate da S1); quelle che parlano col server no.
 *  ───────────────────────────────────────────────────────────────────────────────────────────── */
import { traccia } from "@/landing/sito/traccia";
import type { NomeEventoSito } from "@/landing/sito/eventi";

export type Interesse = "trapianto" | "invisible-derm" | "non-so";
export type Mancante = "video" | "copertina" | "sottotitoli";
export type FormatoMedia = "16:9" | "9:16" | "4:5" | "4:3" | "3:2" | "1:1" | "1200x630";

export interface Slot {
  src: string;
  poster: string;
  alt: string;
}

/** Quello che il loader manda al browser: già filtrato sul server (liberatorie, interruttori, indirizzi). */
export interface VistaSoluzioni {
  pubblicabile: boolean;
  anteprima: boolean;
  mancanti: Mancante[];
  ritratto: Slot | null;
  miniature: { trapianto: Slot; patch: Slot; invisibile: Slot } | null;
  video: { slot: Slot; trascrizione: string | null } | null;
  macro: Slot | null;
  ogImage: string | null;
}

export const VISTA_VUOTA: VistaSoluzioni = {
  pubblicabile: false,
  anteprima: false,
  mancanti: ["video", "copertina", "sottotitoli"],
  ritratto: null,
  miniature: null,
  video: null,
  macro: null,
  ogImage: null,
};

const PARAMETRI_CHE_SEGUONO = /^(utm_[a-z0-9_]+|fbclid|gclid|ttclid|ad_id|adset_id|campaign_id)$/i;

/** La home, con i soli parametri delle campagne (mai `apri`, `anteprima` o altro). */
export function destinazioneCancello(search: string): string {
  const tenuti = new URLSearchParams();
  new URLSearchParams(search).forEach((valore, chiave) => {
    if (PARAMETRI_CHE_SEGUONO.test(chiave)) tenuti.append(chiave, valore);
  });
  const resto = tenuti.toString();
  return resto ? `/?${resto}` : "/";
}

export function apriDaRicerca(search: unknown): boolean {
  return !!search && typeof search === "object" && (search as Record<string, unknown>).apri === "invisible-derm";
}

export function fraseSemaforo(m: Mancante[]): string {
  if (!m.length) return "Pronta per andare online";
  const nomi: Record<Mancante, string> = { video: "il video", copertina: "la copertina", sottotitoli: "la conferma dei sottotitoli" };
  return `Non va online: manca ${m.map((x) => nomi[x]).join(", ")}`;
}

/** IPOTESI: `createServerFn` si chiama `leggiSoluzioni({ data: { anteprima } })`. Qui: sempre la vista vuota (cancello chiuso). */
export async function leggiSoluzioni(_opzioni: { data: { anteprima?: string } }): Promise<VistaSoluzioni> {
  return VISTA_VUOTA;
}

/** IPOTESI: `registraCancello({ data: search })`, mai bloccante oltre 300 ms. Qui: non scrive niente. */
export async function registraCancello(_opzioni: { data: string }): Promise<void> {}

/** Il codice d'anteprima (S1, `anteprima.ts`): da `crypto.getRandomValues`, mai `Math.random`; vale 30 minuti. */
export function nuovoCodice(adesso: Date = new Date()): { codice: string; scade: string } {
  const byte = crypto.getRandomValues(new Uint8Array(16));
  const codice = Array.from(byte, (b) => b.toString(16).padStart(2, "0")).join("");
  return { codice, scade: new Date(adesso.getTime() + 30 * 60_000).toISOString() };
}

/** `salvato` = `{ codice, scade }` già letto da `app_config`; `dato` = il codice che arriva. Vero solo se uguali e non scaduto. */
export function codiceValido(salvato: unknown, dato: unknown, adesso: Date): boolean {
  if (!salvato || typeof salvato !== "object" || typeof dato !== "string" || dato.length < 32) return false;
  const { codice, scade } = salvato as { codice?: unknown; scade?: unknown };
  if (typeof codice !== "string" || typeof scade !== "string" || codice !== dato) return false;
  const t = Date.parse(scade);
  return Number.isFinite(t) && t > adesso.getTime();
}

/** Gli eventi nuovi di S1.3 (`EVENTI_SITO`). Finché non ci sono, `traccia` li scarta (è già così per i nomi fuori lista). */
export type NomeEventoSoluzioni =
  | "invisible_apri"
  | "invisible_video_play"
  | "invisible_video_50"
  | "modulo_apri"
  | "card_patch_clic"
  | "barra_shop_clic"
  | "soluzioni_cancello"
  | "video_play"
  | "video_50"
  | "video_fine";

export function tracciaSoluzioni(nome: NomeEventoSoluzioni, dettagli: Record<string, unknown> = {}): void {
  traccia(nome as NomeEventoSito, dettagli);
}
