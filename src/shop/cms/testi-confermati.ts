/** ── I TESTI DI SERVIZIO CONFERMATI DAL TITOLARE ───────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T45 (PIANO-R2 D63). Modulo PURO.
 *  Reso, assistenza, WhatsApp, pronta consegna, garanzia, firmatario: **nessun testo scritto nel codice**. Il testo
 *  lo scrive il titolare nell'editor dei testi; finché è vuoto o porta ancora un segnaposto `{{…}}` vale `null`
 *  e la riga NON si disegna (pagina ordine, email, «Serve aiuto?»).
 *  Le chiavi sono provvisorie: V1(b) (`testi-shop.ts`) le allinea, e questo è l'unico punto di rinomina. */

export const CHIAVI_TESTI = ["reso", "assistenza", "assistenza_whatsapp", "pronta_consegna", "garanzia", "firmatario"] as const;

export type ChiaveTesto = (typeof CHIAVI_TESTI)[number];
/** Per ogni chiave: il testo confermato, oppure `null` = niente da mostrare. */
export type TestiConfermati = Record<ChiaveTesto, string | null>;

/** Solo i testi veri: scritti (non vuoti, non solo spazi) e senza segnaposto `{{…}}`. Le chiavi sconosciute si ignorano. */
export function filtraConfermati(grezzi: unknown): TestiConfermati {
  const fonte = grezzi && typeof grezzi === "object" && !Array.isArray(grezzi) ? (grezzi as Record<string, unknown>) : {};
  const fuori = {} as TestiConfermati;
  for (const k of CHIAVI_TESTI) {
    const v = Object.hasOwn(fonte, k) ? fonte[k] : null;
    const testo = typeof v === "string" ? v.trim() : "";
    fuori[k] = testo !== "" && !testo.includes("{{") ? testo : null;
  }
  return fuori;
}
