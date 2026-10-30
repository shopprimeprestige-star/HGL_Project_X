/** ── PONTE WHATSAPP · LE IMMAGINI: LA LOGICA ─────────────────────────────────
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T5 (PIANO c.3, c.4).
 *  Due ingressi, con le `PorteMedia` finte nelle prove:
 *   · `gestisciMedia`   il Mac chiede il permesso (`media_permesso`) o dice
 *                       «fatto» (`media_fatto`); la chiama `ingresso.ts` DOPO la
 *                       chiave `X-HGL-Token` e solo se ha la porta `media`;
 *   · `gestisciLettura` il browser chiede il link di una foto (`GET`); la
 *                       chiama la rotta `/api/crm/ponte-media` DOPO la sessione.
 *
 *  ⚠️ L'utente non arriva MAI dal corpo: è `porte.utente()` (`manychat_config`);
 *   il numero si ricava dalla chiave, non da un campo.
 *  ⚠️ L'ordine dei rifiuti: interruttore (spento, riga assente o rotta = spento)
 *   → tipo → peso → funzione SQL (che ricontrolla e applica il tetto). Prima il
 *   TypeScript, così una foto che non può passare non tocca il database.
 *  ⚠️ Il percorso lo sceglie il database e deve sembrare un nome casuale: se
 *   contiene il numero del cliente, o esce dalla cartella, è un errore.
 *  ⚠️ Nei log solo `porte.avviso(codice, conteggi)`: mai numeri, chiavi, percorsi
 *   o indirizzi. Un errore del database arriva come `{ code }` e si risponde con
 *   una frase fissa.
 *  ───────────────────────────────────────────────────────────────────────── */
import { CODICI_MIGRAZIONE } from "./invio-giro";
import {
  CHIAVE_MEDIA,
  FIRMA_LETTURA_S,
  MEDIA_MAX_BYTE,
  MEDIA_MIME,
  TETTO_GB_DI_SERIE,
  type EsitoFattoSql,
  type ErroreMedia,
  type Interruttore,
  type MotivoRifiutoMedia,
  type PorteMedia,
  type RispostaLettura,
} from "./media-tipi";

const RISPOSTA = { "Content-Type": "application/json", "Cache-Control": "no-store" };

const oggetto = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function risposta(stato: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status: stato, headers: RISPOSTA });
}

const codiceDi = (e: unknown): string => {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "?";
};

// ── L'interruttore (c.4) ──────────────────────────────────────────────────

/** Il tetto più alto che si accetta dal valore: oltre è un errore di scrittura.
 *  shortcut: 100 GB basta (il piano ne ha 1); se Storage crescesse, alzarlo. */
const TETTO_GB_MAX = 100;

/** `app_config.ponte_immagini` → interruttore. Il valore è un TESTO JSON
 *  (`{"acceso":false,"tettoGB":0.8}`); un oggetto già letto vale uguale. Assente,
 *  rotto o con `acceso` diverso da `true` = spento. Un tetto assurdo = 0,8. */
export function leggiInterruttore(grezzo: unknown): Interruttore {
  const spento: Interruttore = { acceso: false, tettoGB: TETTO_GB_DI_SERIE };
  let v: unknown = grezzo;
  if (typeof grezzo === "string") {
    try {
      v = JSON.parse(grezzo);
    } catch {
      return spento;
    }
  }
  if (!oggetto(v) || v.acceso !== true) return spento;
  const t = v.tettoGB;
  const tettoGB =
    typeof t === "number" && Number.isFinite(t) && t > 0 && t <= TETTO_GB_MAX
      ? t
      : TETTO_GB_DI_SERIE;
  return { acceso: true, tettoGB };
}

/** Il tetto in byte (GB di 10^9 byte, come la somma di `storage.objects`). */
export const tettoInByte = (gb: number): number => Math.floor(gb * 1e9);

// ── La lettura dei corpi ──────────────────────────────────────────────────

/** La chiave `bw:…` e il numero che ne esce, o null. */
export function leggiChiave(v: unknown): { chiave: string; numero: string } | null {
  if (typeof v !== "string") return null;
  const m = CHIAVE_MEDIA.exec(v);
  return m ? { chiave: v, numero: m[1] } : null;
}

/** `media_permesso` ripulito, o null (400). Il numero viene dalla chiave. */
export function leggiPermesso(
  json: unknown,
): { chiave: string; numero: string; mime: string; byte: number } | null {
  if (!oggetto(json) || json.v !== 1 || json.tipo !== "media_permesso") return null;
  const k = leggiChiave(json.chiave);
  const { mime, byte } = json;
  if (!k || typeof mime !== "string" || mime.length > 100) return null;
  if (typeof byte !== "number" || !Number.isInteger(byte) || byte < 1) return null;
  return { ...k, mime, byte };
}

/** `media_fatto` ripulito, o null (400). */
export function leggiFatto(json: unknown): { chiave: string; numero: string } | null {
  if (!oggetto(json) || json.v !== 1 || json.tipo !== "media_fatto") return null;
  return leggiChiave(json.chiave);
}

/** Un percorso di Storage come lo vuole questo codice: pezzi di lettere, cifre,
 *  `-` e `_` (al più tre cartelle) e un'estensione di immagine; mai il numero
 *  del cliente. Il database lo sceglie a caso, qui si controlla soltanto. */
export function percorsoValido(path: unknown, numero: string): path is string {
  return (
    typeof path === "string" &&
    /^[A-Za-z0-9_-]{1,64}(\/[A-Za-z0-9_-]{1,64}){0,2}\.(jpg|png|webp)$/.test(path) &&
    !path.includes(numero)
  );
}

// ── Il Mac: `media_permesso` e `media_fatto` ───────────────────────────────

/** Un errore del database: 503 `migrazione` se manca la migrazione (il Mac
 *  trattiene), 500 `database` per il resto (il Mac ritenta). */
function erroreDb(porte: PorteMedia, e: unknown): Response {
  if (CODICI_MIGRAZIONE.includes(codiceDi(e))) {
    porte.avviso("media_migrazione");
    return risposta(503, { ok: false, errore: "migrazione" satisfies ErroreMedia });
  }
  porte.avviso("media_database");
  return risposta(500, { ok: false, errore: "database" satisfies ErroreMedia });
}

function rifiuta(porte: PorteMedia, motivo: MotivoRifiutoMedia): Response {
  porte.avviso("media_rifiutato", { [motivo]: 1 });
  return risposta(200, { ok: true, esito: "rifiutato", motivo });
}

/** Il Mac chiede se può caricare una foto, o dice che ha caricato. L'utente è
 *  quello del server. Le due richieste del corpo si riconoscono da `tipo`. */
export async function gestisciMedia(
  porte: PorteMedia,
  userId: string,
  json: unknown,
): Promise<Response> {
  const tipo = oggetto(json) ? json.tipo : null;
  try {
    if (tipo === "media_fatto") {
      const f = leggiFatto(json);
      if (!f) return nonValido(porte);
      const stato: unknown = ((await porte.fatto(userId, f.chiave)) as EsitoFattoSql | null)?.stato;
      if (stato !== "pronta" && stato !== "in_caricamento" && stato !== "assente")
        throw { code: "?" };
      porte.avviso("media_fatto", { [stato]: 1 });
      return risposta(200, { ok: true, esito: stato });
    }

    const p = tipo === "media_permesso" ? leggiPermesso(json) : null;
    if (!p) return nonValido(porte);
    const sw = leggiInterruttore(await porte.interruttore());
    if (!sw.acceso) return rifiuta(porte, "spenta");
    if (!(MEDIA_MIME as readonly string[]).includes(p.mime)) return rifiuta(porte, "tipo");
    if (p.byte > MEDIA_MAX_BYTE) return rifiuta(porte, "troppo_grande");

    const e = await porte.permesso(userId, {
      chiave: p.chiave,
      numero: p.numero,
      mime: p.mime,
      byte: p.byte,
      tettoByte: tettoInByte(sw.tettoGB),
    });
    if (e?.esito === "gia_presente") {
      porte.avviso("media_permesso", { gia_presente: 1 });
      return risposta(200, { ok: true, esito: "gia_presente" });
    }
    if (e?.esito === "rifiutato") {
      const motivo = e.motivo;
      if (motivo !== "tetto" && motivo !== "troppo_grande" && motivo !== "tipo")
        throw { code: "?" };
      return rifiuta(porte, motivo);
    }
    if (e?.esito === "carica" && percorsoValido(e.path, p.numero)) {
      const url = await porte.firmaCarico(e.path);
      porte.avviso("media_permesso", { carica: 1 });
      return risposta(200, { ok: true, esito: "carica", url_carico: url });
    }
    throw { code: "?" };
  } catch (e) {
    return erroreDb(porte, e);
  }
}

function nonValido(porte: PorteMedia): Response {
  porte.avviso("media_non_valido");
  return risposta(400, { ok: false, errore: "corpo_non_valido" satisfies ErroreMedia });
}

// ── Il browser: `GET` del link di una foto ─────────────────────────────────

const rifiutoLettura = (
  stato: number,
  motivo: Extract<RispostaLettura["corpo"], { ok: false }>["motivo"],
): RispostaLettura => ({
  stato,
  corpo: { ok: false, motivo },
});

/** Il link di una foto pronta. `adminUserId` è l'installazione della sessione:
 *  deve essere quella del database, altrimenti 403. La riga si cerca per
 *  l'utente della sessione (già verificato uguale a quello del database): la
 *  foto di un altro utente è «non trovata». */
export async function gestisciLettura(
  porte: PorteMedia,
  i: { adminUserId: string; chiave: unknown },
): Promise<RispostaLettura> {
  try {
    const userId = await porte.utente();
    if (!userId || !i.adminUserId || i.adminUserId !== userId) {
      porte.avviso("media_lettura", { rifiutata: 1 });
      return rifiutoLettura(403, "non_autorizzato");
    }
    const k = leggiChiave(i.chiave);
    if (!k) {
      porte.avviso("media_lettura", { non_valida: 1 });
      return rifiutoLettura(400, "chiave_non_valida");
    }
    const path = await porte.percorsoPronto(userId, k.chiave);
    const url = path ? await porte.firmaLettura(path, FIRMA_LETTURA_S) : null;
    if (!url) {
      porte.avviso("media_lettura", { non_trovata: 1 });
      return rifiutoLettura(404, "non_trovata");
    }
    porte.avviso("media_lettura", { ok: 1 });
    return { stato: 200, corpo: { ok: true, url } };
  } catch (e) {
    if (CODICI_MIGRAZIONE.includes(codiceDi(e))) {
      porte.avviso("media_migrazione");
      return rifiutoLettura(503, "migrazione");
    }
    porte.avviso("media_database");
    return rifiutoLettura(500, "database");
  }
}
