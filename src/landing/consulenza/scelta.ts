/** ── LA SCELTA DEL VISITATORE, RICORDATA PER LA VISITA ──────────────────────
 *  Chi tocca una voce nel pannello o nel box non deve riscegliere nel modulo.
 *  La scelta (e qualche segno: barra chiusa, pannello aperto, pop-up già visto)
 *  sta in `sessionStorage`, sotto una chiave sola, e dura quanto la visita.
 *
 *  ⚠️ La lettura è tollerante: dati rotti, vecchi o di forma sbagliata valgono
 *  «niente salvato», mai un errore a schermo. Anche con la memoria bloccata
 *  (Safari privato) la pagina non si rompe: si perde solo il ricordo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { PROBLEMI } from "@/landing/testi-sito";
import { pulisciTesto, type SceltaConsulenza } from "./regole";

export const CHIAVE_SCELTA = "hgl_consulenza_v1";
/** Chi aspetta una nuova scelta (il modulo) ascolta questo evento su `window`. */
export const EVENTO_SCELTA = "hgl:consulenza-scelta";

interface Memoria {
  scelta: SceltaConsulenza | null;
  pannelloAperto: boolean;
  popupMostrato: boolean;
  barraChiusa: boolean;
}

const PUNTI = ["barra", "pannello", "box", "popup", "home"];
const PROVENIENZE = ["stock", "consulenza"];

function leggiMemoria(): Memoria {
  const vuota: Memoria = {
    scelta: null,
    pannelloAperto: false,
    popupMostrato: false,
    barraChiusa: false,
  };
  try {
    if (typeof window === "undefined") return vuota;
    const grezzo = window.sessionStorage.getItem(CHIAVE_SCELTA);
    if (!grezzo) return vuota;
    const d = JSON.parse(grezzo) as Record<string, unknown> | null;
    if (!d || typeof d !== "object" || Array.isArray(d)) return vuota;
    return {
      scelta: pulisciScelta(d.scelta),
      pannelloAperto: d.pannelloAperto === true,
      popupMostrato: d.popupMostrato === true,
      barraChiusa: d.barraChiusa === true,
    };
  } catch {
    return vuota;
  }
}

function scriviMemoria(m: Memoria): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(CHIAVE_SCELTA, JSON.stringify(m));
  } catch {
    // memoria piena o bloccata: si perde il ricordo, la pagina funziona lo stesso
  }
}

/** Ricostruisce una scelta solo con campi noti e del tipo giusto; altrimenti `null`. */
function pulisciScelta(x: unknown): SceltaConsulenza | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.provenienza !== "string" || !PROVENIENZE.includes(o.provenienza)) return null;
  if (typeof o.punto !== "string" || !PUNTI.includes(o.punto)) return null;
  const problema = PROBLEMI.find((p) => p.id === o.problema)?.id ?? null;
  const scelta: SceltaConsulenza = {
    problema,
    provenienza: o.provenienza as SceltaConsulenza["provenienza"],
    punto: o.punto as SceltaConsulenza["punto"],
  };
  const altro = pulisciTesto(o.problemaAltro);
  if (problema === "altro" && altro) scelta.problemaAltro = altro;
  const prodotto = pulisciTesto(o.prodotto);
  if (prodotto) scelta.prodotto = prodotto;
  return scelta;
}

/** Salva la scelta per la visita e avvisa chi ascolta (il modulo). */
export function salvaScelta(s: SceltaConsulenza): void {
  const scelta = pulisciScelta(s);
  if (!scelta) return;
  scriviMemoria({ ...leggiMemoria(), scelta });
  try {
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent(EVENTO_SCELTA, { detail: scelta }));
  } catch {
    // niente evento: il modulo la legge comunque al montaggio
  }
}

export function leggiScelta(): SceltaConsulenza | null {
  return leggiMemoria().scelta;
}

export function segnaPannelloAperto(): void {
  scriviMemoria({ ...leggiMemoria(), pannelloAperto: true });
}
export function pannelloGiaAperto(): boolean {
  return leggiMemoria().pannelloAperto;
}

export function segnaPopupMostrato(): void {
  scriviMemoria({ ...leggiMemoria(), popupMostrato: true });
}
export function popupGiaMostrato(): boolean {
  return leggiMemoria().popupMostrato;
}

/** La X della barra: non torna per tutta la visita. */
export function segnaBarraChiusa(): void {
  scriviMemoria({ ...leggiMemoria(), barraChiusa: true });
}
export function barraChiusaInSessione(): boolean {
  return leggiMemoria().barraChiusa;
}
