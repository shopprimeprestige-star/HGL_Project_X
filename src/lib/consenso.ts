/*  ── IL CONSENSO AI COOKIE (modulo puro: nessun React, nessun DOM obbligatorio) ──
    Shop R1 · T23 · PIANO §3.4, D10. Legge e scrive la scelta del visitatore; dice quali
    piattaforme si possono caricare e come va impostato il Consent Mode di Google.

    ⚠️ Regola di fondo: nel dubbio vale «no». Un valore rotto, una chiave strana, uno storage
       che lancia o che non c'è → «non scelto», e «non scelto» non carica niente.
    ⚠️ La scelta vecchia (v1, `hgl_cookie_consent_v1`) si legge ma non si cancella mai:
       «reject» resta un rifiuto valido; «accept» NON vale per Meta/TikTok/Google (il vecchio
       banner non li nominava), quindi si ripropone la scelta.
    ⚠️ Il valore è dichiarato dal browser: è un'attestazione, non una prova. */

export const CHIAVE_V1 = "hgl_cookie_consent_v1";
export const CHIAVE_V2 = "hgl_cookie_consent_v2";
/** L'evento che la pagina riceve quando la scelta cambia (lo ascolta il provider, T27). */
export const EVENTO_CONSENSO = "hgl:consenso";

export type Consenso = {
  scelto: boolean;
  statistiche: boolean;
  marketing: boolean;
  /** Quando è stata fatta la scelta (ms); 0 se non c'è o non si sa. */
  ts: number;
  /** Vero se la scelta viene dalla chiave v1. */
  legacy?: boolean;
};
export type Piattaforma = "meta" | "tiktok" | "google";
/** Quel che serve dello storage: basta un `localStorage` o un finto. */
export type Magazzino = Pick<Storage, "getItem" | "setItem">;

/** Legge una chiave senza mai lanciare (storage bloccato, assente, senza metodi). */
function leggiChiave(storage: Magazzino | null | undefined, chiave: string): string | null {
  try {
    const v = storage?.getItem(chiave);
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

/** La scelta v2: solo con versione 2 e i due booleani veri e propri. Altrimenti `null`. */
function leggiV2(grezzo: string | null): Consenso | null {
  if (!grezzo) return null;
  try {
    const o: unknown = JSON.parse(grezzo);
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const { v, statistiche, marketing, ts } = o as Record<string, unknown>;
    if (v !== 2 || typeof statistiche !== "boolean" || typeof marketing !== "boolean") return null;
    return { scelto: true, statistiche, marketing, ts: typeof ts === "number" && Number.isFinite(ts) ? ts : 0 };
  } catch {
    return null;
  }
}

export function leggiConsenso(storage: Magazzino | null | undefined): Consenso {
  const nuova = leggiV2(leggiChiave(storage, CHIAVE_V2));
  if (nuova) return nuova;
  const vecchia = leggiChiave(storage, CHIAVE_V1);
  // «reject» è un rifiuto e resta valido; «accept» no: non nominava le piattaforme.
  if (vecchia === "reject") return { scelto: true, statistiche: false, marketing: false, ts: 0, legacy: true };
  if (vecchia === "accept") return { scelto: false, statistiche: false, marketing: false, ts: 0, legacy: true };
  return { scelto: false, statistiche: false, marketing: false, ts: 0 };
}

/** Scrive la scelta v2 (senza toccare v1) e avvisa la pagina. Restituisce quel che si legge DOPO:
 *  se lo storage non lascia scrivere vale «non scelto» e non lancia. `adesso` in millisecondi. */
export function scriviConsenso(
  storage: Magazzino | null | undefined,
  scelta: { statistiche: boolean; marketing: boolean },
  adesso: number,
): Consenso {
  try {
    storage?.setItem(
      CHIAVE_V2,
      JSON.stringify({ v: 2, statistiche: scelta.statistiche === true, marketing: scelta.marketing === true, ts: adesso }),
    );
  } catch {
    /* storage bloccato: sotto si rilegge e vale «non scelto» */
  }
  const letto = leggiConsenso(storage);
  try {
    if (typeof window !== "undefined" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent(EVENTO_CONSENSO, { detail: letto }));
    }
  } catch {
    /* nessuno ascolta: niente di grave */
  }
  return letto;
}

/** Si può caricare lo script di quella piattaforma? Meta e TikTok: solo con «marketing».
 *  Google: con «statistiche» o «marketing» (il Consent Mode fa il resto). */
export function puoCaricare(piattaforma: Piattaforma, c: Consenso | null | undefined): boolean {
  if (!c?.scelto) return false;
  if (piattaforma === "meta" || piattaforma === "tiktok") return c.marketing === true;
  if (piattaforma === "google") return c.statistiche === true || c.marketing === true;
  return false;
}

type Voce = "granted" | "denied";
/** Le quattro voci del Consent Mode di Google: solo «granted» o «denied», mai altro. */
export function modoGoogle(c: Consenso | null | undefined): {
  analytics_storage: Voce;
  ad_storage: Voce;
  ad_user_data: Voce;
  ad_personalization: Voce;
} {
  const scelto = c?.scelto === true;
  const stat: Voce = scelto && c?.statistiche === true ? "granted" : "denied";
  const mkt: Voce = scelto && c?.marketing === true ? "granted" : "denied";
  return { analytics_storage: stat, ad_storage: mkt, ad_user_data: mkt, ad_personalization: mkt };
}
