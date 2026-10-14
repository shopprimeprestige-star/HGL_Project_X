/** ── GLI EVENTI DEL SITO · NOMI FISSI, SOLO CONTEGGI ────────────────────────
 *  Funzioni pure. L'involucro che li spedisce è in `traccia.ts`.
 *  Nome, telefono e testo libero non possono finire in un evento nemmeno per
 *  sbaglio: `ripulisciDettagli` tiene solo le chiavi dell'elenco.
 *  `stock_acquisto` e `stock_abbandono_carrello` aspettano la fase 2.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Provenienza } from "@/landing/consulenza/regole";

export const EVENTI_SITO = [
  // home e Protocol
  "vista_pagina",
  "scroll_50",
  "click_bottone",
  "modulo_inizio",
  "modulo_errore",
  "modulo_invio",
  "meetly_aperto",
  "consulenza_prenotata",
  "scelta_percorso",
  // shop e consulenza
  "stock_vista_scheda",
  "stock_box_visto",
  "stock_aggiungi_carrello",
  "stock_inizio_cassa",
  "consulenza_barra_vista",
  "consulenza_barra_click",
  "consulenza_barra_chiusa",
  "consulenza_pannello_aperto",
  "consulenza_problema_scelto",
  "consulenza_popup_mostrato",
  "consulenza_popup_click",
  "consulenza_modulo_inizio",
  "consulenza_modulo_invio",
  // landing «Tre soluzioni» (/soluzioni): solo aggiunte, in fondo
  "video_play",
  "video_50",
  "video_fine",
  "invisible_apri",
  "invisible_video_play",
  "invisible_video_50",
  "modulo_apri",
  "card_patch_clic",
  "barra_shop_clic",
  "soluzioni_cancello",
] as const;

export type NomeEventoSito = (typeof EVENTI_SITO)[number];

/** Le sole chiavi che un evento può portare. */
export const DETTAGLI_AMMESSI = ["bottone", "sezione", "percorso", "campo", "voce", "motivo", "origine", "punto", "variante", "pagina", "interesse"] as const;

const LUNGHEZZA_MASSIMA = 60;

/** Un valore ammesso è breve e non assomiglia a un telefono né a un'email. */
function valoreAmmesso(v: unknown, chiave?: string): v is string | number | boolean {
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (!t || t.length > LUNGHEZZA_MASSIMA || t.includes("@")) return false;
  //  Un percorso («/blog/2026-10-14-…») ha molte cifre ma non è un telefono: inizia per «/» e non ha spazi.
  if ((chiave === "pagina" || chiave === "percorso") && /^\/[^\s]*$/.test(t)) return true;
  return !/\d{7,}/.test(t.replace(/[\s.\-+]/g, ""));
}

export function ripulisciDettagli(d: unknown): Record<string, string | number | boolean> {
  const fuori: Record<string, string | number | boolean> = {};
  if (!d || typeof d !== "object" || Array.isArray(d)) return fuori;
  const x = d as Record<string, unknown>;
  for (const k of DETTAGLI_AMMESSI) {
    if (k in x && valoreAmmesso(x[k], k)) fuori[k] = x[k] as string | number | boolean;
  }
  return fuori;
}

export type AzioneModulo = "inizio" | "errore" | "invio" | "calendario" | "prenotata";

/** Consulenza (home, Protocol) e shop hanno nomi diversi per lo stesso gesto. */
export function nomeEventoModulo(origine: Provenienza, azione: AzioneModulo): NomeEventoSito | null {
  const consulenza: Record<AzioneModulo, NomeEventoSito> = {
    inizio: "modulo_inizio",
    errore: "modulo_errore",
    invio: "modulo_invio",
    calendario: "meetly_aperto",
    prenotata: "consulenza_prenotata",
  };
  if (origine === "consulenza") return consulenza[azione];
  const stock: Record<AzioneModulo, NomeEventoSito | null> = {
    inizio: "consulenza_modulo_inizio",
    errore: null,
    invio: "consulenza_modulo_invio",
    calendario: "meetly_aperto",
    prenotata: "consulenza_prenotata",
  };
  return stock[azione];
}

/** Test A/B del bottone. Spento: sempre «A». Acceso: la variante già salvata, altrimenti metà e metà. */
export function varianteBottone(acceso: boolean, salvata: string | null, caso: () => number): "A" | "B" {
  if (!acceso) return "A";
  if (salvata === "A" || salvata === "B") return salvata;
  return caso() < 0.5 ? "A" : "B";
}

/** `?anteprima=<codice>`: il titolare guarda la pagina dal CRM. Il codice non deve mai arrivare a Meta, quindi in anteprima
 *  non parte nessun evento, Pixel o CAPI. Il confronto è sul nome del parametro, esatto. */
export function inAnteprima(search: unknown): boolean {
  return typeof search === "string" && new URLSearchParams(search).has("anteprima");
}

/** La pagina aperta ora è in anteprima dal CRM (`?anteprima=…`): niente evento, Pixel o CAPI. Fuori dal browser vale «no». */
export function paginaInAnteprima(): boolean {
  return typeof window !== "undefined" && inAnteprima(window.location?.search);
}
