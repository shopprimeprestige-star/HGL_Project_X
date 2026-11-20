/* eslint-disable @typescript-eslint/no-explicit-any -- il database è un client Supabase (vero sul server, finto nelle prove): si usano solo from/select/order/limit */
/*  ── LA CONFIGURAZIONE PUBBLICA DEI PIXEL (solo ID, mai token) ──────────────────
    Shop R1 · T25 · PIANO §3.4, D35 (che sostituisce D33). `GET /api/public/tracking-config` risponde con questo.

    ⚠️ DI CHI È LA CONFIGURAZIONE (D35). La policy di `tracking_config` lascia scrivere la propria riga a qualunque utente
       con una sessione: «la riga più recente» la sceglierebbe uno sconosciuto registrato. Si legge SOLO la riga
       dell'utente scritto in `tracciamento_proprietario` (S3, solo il server la legge). Se non c'è un proprietario, o la
       tabella manca (S3 non applicata), si chiude: nessun pixel, nessun invio.
    ⚠️ Si chiedono SOLO le colonne pubbliche, una per una: mai `*`, mai token, mai codici di prova.
    ⚠️ Un errore di lettura vale «niente configurato» e non lancia mai. */
import type { ConfigPubblica } from "./carica";

export type DbLettura = { from(tabella: string): any };
export type RigaConfig = Record<string, unknown>;

const COLONNE_PUBBLICHE = ["meta_pixel_id", "tiktok_pixel_id", "google_ga4_id", "google_ads_id", "google_ads_label_acquisto"];
const VUOTA: ConfigPubblica = { meta: null, tiktok: null, google: null };
const TENUTA_MS = 5 * 60 * 1000;

/** Un ID pulito dagli spazi, oppure `null` se è vuoto o non è testo. */
export const idPulito = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** La riga di `tracking_config` del PROPRIETARIO (il più vecchio di `tracciamento_proprietario`), con le colonne chieste.
 *  `riga` è `null` se non c'è proprietario o la sua riga; `errore` è vero se non si è riusciti a leggere (tabelle assenti, rete). */
export async function leggiRigaProprietario(db: DbLettura, colonne: string[]): Promise<{ riga: RigaConfig | null; errore: boolean }> {
  try {
    const p = await db.from("tracciamento_proprietario").select("user_id").order("creato_il", { ascending: true }).limit(1);
    if (p.error || !Array.isArray(p.data)) return { riga: null, errore: true };
    const utente = p.data[0]?.user_id;
    if (typeof utente !== "string" || !utente) return { riga: null, errore: false };
    const r = await db.from("tracking_config").select(colonne.join(",")).eq("user_id", utente).limit(1);
    if (r.error || !Array.isArray(r.data)) return { riga: null, errore: true };
    return { riga: r.data[0] ?? null, errore: false };
  } catch {
    return { riga: null, errore: true };
  }
}

async function leggi(db: DbLettura): Promise<{ config: ConfigPubblica; errore: boolean }> {
  const { riga, errore } = await leggiRigaProprietario(db, COLONNE_PUBBLICHE);
  if (!riga) return { config: VUOTA, errore };
  const meta = idPulito(riga.meta_pixel_id);
  const tiktok = idPulito(riga.tiktok_pixel_id);
  const ga4 = idPulito(riga.google_ga4_id);
  const ads = idPulito(riga.google_ads_id);
  return {
    config: {
      meta: meta ? { pixelId: meta } : null,
      tiktok: tiktok ? { pixelId: tiktok } : null,
      google: ga4 || ads ? { ga4Id: ga4, adsId: ads, adsLabelAcquisto: idPulito(riga.google_ads_label_acquisto) } : null,
    },
    errore: false,
  };
}

export async function leggiConfigPubblica(db: DbLettura): Promise<ConfigPubblica> {
  return (await leggi(db)).config;
}

/** Come `leggiConfigPubblica`, con memoria di 5 minuti, e dice anche se l'ultima lettura è fallita (la rotta, in quel caso,
 *  non la fa tenere in memoria a nessuno: `no-store`). Un errore di lettura NON resta in memoria. */
export function creaLettoreConfigConEsito(db: DbLettura, adesso: () => number): () => Promise<{ config: ConfigPubblica; errore: boolean }> {
  let memoria: { finoA: number; config: ConfigPubblica } | null = null;
  return async () => {
    const ora = adesso();
    if (memoria && ora < memoria.finoA) return { config: memoria.config, errore: false };
    const { config, errore } = await leggi(db);
    memoria = errore ? null : { finoA: ora + TENUTA_MS, config };
    return { config, errore };
  };
}

export function creaLettoreConfig(db: DbLettura, adesso: () => number): () => Promise<ConfigPubblica> {
  const lettore = creaLettoreConfigConEsito(db, adesso);
  return async () => (await lettore()).config;
}
