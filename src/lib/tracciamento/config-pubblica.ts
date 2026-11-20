/* eslint-disable @typescript-eslint/no-explicit-any -- il database è un client Supabase (vero sul server, finto nelle prove): si usano solo from/select/order/limit */
/*  ── LA CONFIGURAZIONE PUBBLICA DEI PIXEL (solo ID, mai token) ──────────────────
    Shop R1 · T25 · PIANO §3.4, D33, §5. `GET /api/public/tracking-config` risponde con questo.

    ⚠️ `tracking_config` ha una riga per utente. Si legge QUELLA PIÙ RECENTE (per `updated_at`) fra le righe che hanno
       almeno un ID pubblico non vuoto (Meta, TikTok, Google GA4 o Ads): una riga vuota più nuova non spegne i pixel.
    ⚠️ Si chiedono SOLO le colonne pubbliche, una per una: mai `*`, mai token, mai codici di prova.
    ⚠️ Se le colonne di Google non ci sono ancora (la migrazione S3 non è applicata) si ripiega sulle vecchie: Meta e
       TikTok funzionano lo stesso. Un errore di lettura vale «niente configurato» e non lancia mai. */
import type { ConfigPubblica } from "./carica";

export type DbLettura = { from(tabella: string): any };
export type RigaConfig = Record<string, unknown>;

const COLONNE_BASE = ["meta_pixel_id", "tiktok_pixel_id", "updated_at"];
const COLONNE_GOOGLE = ["google_ga4_id", "google_ads_id", "google_ads_label_acquisto"];
const VUOTA: ConfigPubblica = { meta: null, tiktok: null, google: null };
const TENUTA_MS = 5 * 60 * 1000;

/** Un ID pulito dagli spazi, oppure `null` se è vuoto o non è testo. */
export const idPulito = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** La riga più recente (per `updated_at`) fra quelle che hanno almeno una di queste colonne piena. */
export function rigaPiuRecente(righe: RigaConfig[], colonneId: string[]): RigaConfig | null {
  const quando = (r: RigaConfig) => (typeof r.updated_at === "string" ? Date.parse(r.updated_at) || 0 : 0);
  return righe.filter((r) => colonneId.some((k) => idPulito(r[k]))).sort((a, b) => quando(b) - quando(a))[0] ?? null;
}

const colonnaMancante = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42703" || e.code === "PGRST204" || /column/i.test(e.message ?? ""));

async function leggi(db: DbLettura): Promise<{ config: ConfigPubblica; errore: boolean }> {
  try {
    const chiedi = (colonne: string[]) => db.from("tracking_config").select(colonne.join(",")).order("updated_at", { ascending: false }).limit(50);
    let r = await chiedi([...COLONNE_BASE, ...COLONNE_GOOGLE]);
    if (r.error && colonnaMancante(r.error)) r = await chiedi(COLONNE_BASE); // S3 non applicata
    if (r.error || !Array.isArray(r.data)) return { config: VUOTA, errore: true };
    const riga = rigaPiuRecente(r.data, ["meta_pixel_id", "tiktok_pixel_id", "google_ga4_id", "google_ads_id"]);
    if (!riga) return { config: VUOTA, errore: false };
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
  } catch {
    return { config: VUOTA, errore: true };
  }
}

export async function leggiConfigPubblica(db: DbLettura): Promise<ConfigPubblica> {
  return (await leggi(db)).config;
}

/** Come `leggiConfigPubblica`, con memoria di 5 minuti. Un errore di lettura NON resta in memoria. */
export function creaLettoreConfig(db: DbLettura, adesso: () => number): () => Promise<ConfigPubblica> {
  let memoria: { finoA: number; config: ConfigPubblica } | null = null;
  return async () => {
    const ora = adesso();
    if (memoria && ora < memoria.finoA) return memoria.config;
    const { config, errore } = await leggi(db);
    memoria = errore ? null : { finoA: ora + TENUTA_MS, config };
    return config;
  };
}
