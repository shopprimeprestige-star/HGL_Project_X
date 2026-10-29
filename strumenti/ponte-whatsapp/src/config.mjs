/** ── PONTE WHATSAPP · LA CONFIGURAZIONE (config.env) ──────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T5 (PIANO §a1, §b1).
 *  `config.env` sta in `~/Library/Application Support/HGL/ponte-wa/`, mai nel
 *  repo, con permessi 600. Righe `CHIAVE=valore` (`#` = commento, virgolette
 *  e `export ` ammessi):
 *    PONTE_URL            indirizzo https della rotta del CRM
 *    PONTE_TOKEN          lo stesso segreto di `PONTE_WA_TOKEN` del Worker (≥ 32)
 *    STORICO_GIORNI       0 = tutto (di serie; non si cambia senza il titolare)
 *    ATTESA_PARI_SECONDI  attesa dei vivi prima di spedirli (di serie 30)
 *
 *  ⚠️ Gli errori sono parole fisse con una frase per il titolare: non
 *   contengono mai il token né l'indirizzo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { readFileSync, statSync } from "node:fs";

/** Caratteri minimi del token: `LIMITI.tokenMinimo` di `src/crm/ponte/tipi.ts`. */
export const TOKEN_MINIMO = 32;

const MESSAGGI = {
  manca_file: "Manca config.env: crealo con PONTE_URL e PONTE_TOKEN (vedi la guida).",
  permessi_larghi: "config.env è leggibile da altri utenti del Mac: chmod 600 config.env",
  manca_url: "Manca PONTE_URL in config.env.",
  url_non_valido: "PONTE_URL non è un indirizzo valido (senza utente e password).",
  url_non_https: "PONTE_URL deve cominciare con https://",
  manca_token: "Manca PONTE_TOKEN in config.env.",
  token_corto: `PONTE_TOKEN è troppo corto: servono almeno ${TOKEN_MINIMO} caratteri (openssl rand -hex 32).`,
  valore_non_valido: "STORICO_GIORNI e ATTESA_PARI_SECONDI devono essere numeri interi (0-3650 e 0-300).",
};

const errore = (codice) => ({ ok: false, errore: codice, messaggio: MESSAGGI[codice] });

/** Le righe `CHIAVE=valore` del file. */
function righe(testo) {
  const voci = {};
  for (const grezza of String(testo).split(/\r?\n/)) {
    const r = grezza.trim().replace(/^export\s+/, "");
    if (!r || r.startsWith("#")) continue;
    const i = r.indexOf("=");
    if (i <= 0) continue;
    let v = r.slice(i + 1).trim();
    if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0]) v = v.slice(1, -1);
    voci[r.slice(0, i).trim()] = v;
  }
  return voci;
}

function intero(v, di_serie, max) {
  if (v === undefined || v === "") return di_serie;
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n <= max ? n : null;
}

/** Il testo di `config.env` → `{ ok: true, config }` o `{ ok: false, errore, messaggio }`. */
export function analizzaConfig(testo) {
  const v = righe(testo);
  if (!v.PONTE_URL) return errore("manca_url");
  let url;
  try {
    url = new URL(v.PONTE_URL);
  } catch {
    return errore("url_non_valido");
  }
  if (url.protocol !== "https:") return errore("url_non_https");
  if (url.username || url.password || !url.hostname) return errore("url_non_valido");
  if (!v.PONTE_TOKEN) return errore("manca_token");
  if (v.PONTE_TOKEN.length < TOKEN_MINIMO) return errore("token_corto");
  const storicoGiorni = intero(v.STORICO_GIORNI, 0, 3650);
  const attesaPariSecondi = intero(v.ATTESA_PARI_SECONDI, 30, 300);
  if (storicoGiorni === null || attesaPariSecondi === null) return errore("valore_non_valido");
  return { ok: true, config: { url: v.PONTE_URL, token: v.PONTE_TOKEN, storicoGiorni, attesaPariSecondi } };
}

/** Legge `config.env` da `percorso`: rifiuta il file se altri utenti
 *  possono leggerlo o scriverlo (permessi diversi da 600/400). */
export function leggiConfig(percorso) {
  let info;
  try {
    info = statSync(percorso);
  } catch {
    return errore("manca_file");
  }
  if ((info.mode & 0o077) !== 0) return errore("permessi_larghi");
  let testo;
  try {
    testo = readFileSync(percorso, "utf8");
  } catch {
    return errore("manca_file");
  }
  return analizzaConfig(testo);
}
