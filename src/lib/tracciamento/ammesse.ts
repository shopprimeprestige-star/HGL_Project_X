/*  ── LE PAGINE AMMESSE AI PIXEL E AL BANNER (modulo puro) ───────────────────────
    Shop R1 · T26 · PIANO D14, D15, §3.4. Una funzione sola per pixel, banner e provider.

    ⚠️ Si elencano le pagine AMMESSE (per SCHEMA di percorso, non per prefisso) e le chiavi di query AMMESSE, non quelle
       escluse: una pagina o una chiave nuova non traccia finché qualcuno non la aggiunge qui. Le pagine private portano
       codici nell'indirizzo (`?t=`, `?anteprima=`, `?watch=`, `?ref_code=`…): non devono arrivare a Meta, TikTok e
       Google, e il banner non deve comparirci (sala d'attesa del cliente, anteprima del CMS dentro il CRM).
       Una pagina è ammessa SOLO se OGNI chiave della sua query è `utm_*` o fra `CHIAVI_QUERY_AMMESSE`: qualunque chiave
       sconosciuta la rende non ammessa (lista bianca, non lista nera).
    ⚠️ L'indirizzo che esce verso le piattaforme si RICOSTRUISCE (`urlPulito`: origine + percorso + sole chiavi
       ammesse); il referrer si riduce all'origine (`referrerPulito`). Mai copiati da `location`. */

/** I casi noti di codici privati. ⚠️ Non decidono più niente: vale la lista BIANCA qui sotto (ogni chiave non ammessa
 *  esclude la pagina, queste comprese). Restano come elenco documentato e per le prove. */
export const CHIAVI_QUERY_VIETATE = ["anteprima", "t", "watch", "modifica", "sess", "code", "codice", "token", "key", "embed"] as const;
/** Le sole chiavi di query che una pagina ammessa può avere, e che possono uscire (più tutte quelle che cominciano per `utm_`).
 *  Click id e campagne delle piattaforme; `gad_source`, `gad_campaignid` e `gclsrc` li aggiunge Google Ads insieme a `gclid`. */
export const CHIAVI_QUERY_AMMESSE = ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "gad_source", "gad_campaignid", "gclsrc", "ad_id", "adset_id", "campaign_id", "ad_name", "creative", "creative_name"] as const;

const MAX_VALORE = 200;
/** Uno slug: minuscolo, cifre, trattini. */
const SLUG = /^[a-z0-9][a-z0-9_-]*$/;
/** Le pagine ammesse senza parametri (percorso normalizzato). */
const FISSE = new Set([
  "/", "/shop", "/shop/cerca", "/shop/carrello", "/shop/checkout",
  "/shop/spedizioni-e-resi", "/shop/garanzia", "/shop/assistenza", "/shop/domande",
  "/invisible-derm", "/invisible-derm-v1", "/nuova", "/blog", "/cookie-policy", "/privacy-policy", "/termini-e-condizioni",
]);
/** Le pagine ammesse con un solo segmento variabile: prefisso → (slug). */
const CON_SLUG = ["/shop/c/", "/shop/prodotto/", "/blog/"];

/** Il percorso come lo legge il router: senza `?…` e `#…`, minuscolo, senza barra finale. «» se non è testo. */
function normalizza(percorso: unknown): string {
  if (typeof percorso !== "string") return "";
  const p = percorso.split("#")[0].split("?")[0].toLowerCase().replace(/\/+$/, "");
  return p === "" ? (percorso.startsWith("/") ? "/" : "") : p;
}

/** Le coppie chiave/valore di una ricerca, con la chiave in minuscolo. */
function coppie(ricerca: unknown): [string, string][] {
  if (typeof ricerca !== "string") return [];
  return [...new URLSearchParams(ricerca.replace(/^\?/, "")).entries()].map(([k, v]) => [k.toLowerCase(), v]);
}

const chiaveAmmessa = (k: string) => k.startsWith("utm_") || (CHIAVI_QUERY_AMMESSE as readonly string[]).includes(k);

export function percorsoAmmesso(percorso: unknown, ricerca: unknown, inCornice: boolean): boolean {
  if (inCornice || typeof percorso !== "string") return false;
  // ogni chiave deve essere ammessa, ovunque sia scritta: nella ricerca o dentro il percorso
  const incorporata = percorso.split("#")[0].split("?").slice(1).join("?");
  if ([...coppie(ricerca), ...coppie(incorporata)].some(([k]) => !chiaveAmmessa(k))) return false;
  const p = normalizza(percorso);
  if (FISSE.has(p)) return true;
  const prefisso = CON_SLUG.find((x) => p.startsWith(x));
  return !!prefisso && SLUG.test(p.slice(prefisso.length));
}

/** Il banner compare dove le pagine sono ammesse, e non a un amministratore già riconosciuto. */
export function bannerAmmesso(percorso: unknown, ricerca: unknown, inCornice: boolean, admin: boolean): boolean {
  return !admin && percorsoAmmesso(percorso, ricerca, inCornice);
}

/** Le sole chiavi ammesse di una ricerca, come testo senza «?» («utm_source=a&fbclid=1»). */
export function queryPulita(ricerca: unknown): string {
  const u = new URLSearchParams();
  for (const [k, v] of coppie(ricerca)) if (chiaveAmmessa(k)) u.append(k, v.slice(0, MAX_VALORE));
  return u.toString();
}

/** L'indirizzo che esce verso le piattaforme: origine + percorso normalizzato + sole chiavi ammesse. «» se non si può. */
export function urlPulito(origine: unknown, percorso: unknown, ricerca: unknown): string {
  if (typeof origine !== "string" || typeof percorso !== "string") return "";
  const o = origine.replace(/\/+$/, "");
  if (!/^https?:\/\/[^/?#\s]+$/.test(o)) return "";
  const q = queryPulita([ricerca, percorso.split("#")[0].split("?").slice(1).join("?")].filter((x) => typeof x === "string").join("&"));
  return `${o}${normalizza(percorso) || "/"}${q ? `?${q}` : ""}`;
}

/** Del referrer resta solo l'origine (mai percorso né query); «» se è vuoto, rotto o non http(s). */
export function referrerPulito(referrer: unknown, _origine?: unknown): string {
  if (typeof referrer !== "string" || !referrer) return "";
  try {
    const u = new URL(referrer);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return u.origin;
  } catch {
    return "";
  }
}
