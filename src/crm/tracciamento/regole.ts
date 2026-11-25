/*  ── REGOLE DEL PANNELLO «TRACCIAMENTO» (puro: le usano la schermata e le prove) ───
    Shop R1 · T30 · PIANO §6.1, D35. Gli ID di Google si accettano solo nel formato giusto: finiscono in un indirizzo
    (lo script di Google) e un valore sbagliato sarebbe un guasto silenzioso o peggio. Anche `carica.ts` li ricontrolla. */

export interface IdGoogleInput {
  ga4: unknown;
  ads: unknown;
  etichetta: unknown;
  merchant: unknown;
}
export type CampoGoogle = "ga4" | "ads" | "etichetta" | "merchant";
export interface EsitoValidazione {
  ok: boolean;
  /** Il valore pulito di ogni campo, o `null` se vuoto (si cancella). Con un errore il campo sbagliato è `null`. */
  valori: Record<CampoGoogle, string | null>;
  errori: Partial<Record<CampoGoogle, string>>;
}

/** Il comando che il titolare lancia UNA volta dal SQL Editor per dire di chi è la configurazione del tracciamento (D35). */
export const COMANDO_PROPRIETARIO =
  "INSERT INTO public.tracciamento_proprietario (user_id) SELECT id FROM auth.users WHERE email = 'EMAIL-DEL-TITOLARE' ON CONFLICT DO NOTHING;";

const testo = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function validaIdGoogle(input: IdGoogleInput): EsitoValidazione {
  const valori: EsitoValidazione["valori"] = { ga4: null, ads: null, etichetta: null, merchant: null };
  const errori: EsitoValidazione["errori"] = {};

  const ga4 = testo(input.ga4).toUpperCase();
  if (ga4) {
    if (/^G-[A-Z0-9]{4,20}$/.test(ga4)) valori.ga4 = ga4;
    else errori.ga4 = "L'ID di Google Analytics 4 comincia per «G-» (per esempio G-ABC123XYZ). Lo trovi in Analytics, sotto Amministrazione → Flussi di dati.";
  }
  const ads = testo(input.ads).toUpperCase();
  if (ads) {
    if (/^AW-\d{5,15}$/.test(ads)) valori.ads = ads;
    else errori.ads = "L'ID di Google Ads comincia per «AW-» seguito da cifre (per esempio AW-123456789). Lo trovi nello strumento «Tag» di Google Ads.";
  }
  const etichetta = testo(input.etichetta);
  if (etichetta) {
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(etichetta)) errori.etichetta = "L'etichetta di conversione ha solo lettere, cifre, trattini e trattini bassi (3-40 segni), senza spazi.";
    else if (!valori.ads) errori.etichetta = errori.ads ? "Prima correggi l'ID di Google Ads: l'etichetta serve insieme a quello." : "L'etichetta di conversione serve insieme all'ID di Google Ads: inserisci prima quello.";
    else valori.etichetta = etichetta;
  }
  const merchant = testo(input.merchant);
  if (merchant) {
    if (/^\d{4,15}$/.test(merchant)) valori.merchant = merchant;
    else errori.merchant = "L'ID di Merchant Center è fatto di sole cifre (da 4 a 15), senza spazi.";
  }
  return { ok: Object.keys(errori).length === 0, valori, errori };
}

/** Codici di Postgres/PostgREST che dicono «tabella o colonna inesistente»: la migrazione S3 non è applicata.
 *  Ogni altro errore (rete, permessi, database giù) NON lo è: va detto come «non riesco a leggere ora». */
const MANCANTI = ["42P01", "42703", "PGRST204", "PGRST205"];
export function colonnaOTabellaMancante(errore: unknown): boolean {
  const codice = (errore as { code?: unknown } | null | undefined)?.code;
  return typeof codice === "string" && MANCANTI.includes(codice);
}

/** Una frase per un codice di esito (`tracciamento_esiti.esito`): solo codici, mai testi della piattaforma. */
export function fraseEsito(codice: unknown): string {
  const c = typeof codice === "string" ? codice : "";
  if (c === "ok") return "ricevuto";
  if (c === "errore_rete") return "piattaforma non raggiungibile";
  const m = /^http_(\d{3})$/.exec(c);
  if (m) return `rifiutato dalla piattaforma (${m[1]})`;
  return "esito non riconosciuto";
}
