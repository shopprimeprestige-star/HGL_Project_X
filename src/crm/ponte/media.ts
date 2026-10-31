/** ── PONTE WHATSAPP · I MEDIA: LA LOGICA ─────────────────────────────────────
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T5 (PIANO c.3, c.4),
 *  estesa il 31/10 a vocali, video e documenti (commessa
 *  2026-10-31-media-e-archiviazione, compito T2: PIANO a.4, b.2, D2, D13).
 *  Due ingressi, con le `PorteMedia` finte nelle prove:
 *   · `gestisciMedia`   il Mac chiede il permesso (`media_permesso`) o dice
 *                       «fatto» (`media_fatto`); la chiama `ingresso.ts` DOPO la
 *                       chiave `X-HGL-Token` e solo se ha la porta `media`;
 *   · `gestisciLettura` il browser chiede il link di un file (`GET`); la
 *                       chiama la rotta `/api/crm/ponte-media` DOPO la sessione.
 *
 *  ⚠️ L'utente non arriva MAI dal corpo: è `porte.utente()` (`manychat_config`);
 *   il numero si ricava dalla chiave, non da un campo.
 *  ⚠️ L'ordine dei rifiuti: interruttore (spento, riga assente o rotta = spento)
 *   → tipo → peso della categoria → categoria non automatica (`manuale`, salvo
 *   un lavoro `richiesto` con la sua richiesta `in_corso`) → funzione SQL (che
 *   ricontrolla e applica il tetto). Prima il TypeScript, così un media che non
 *   può passare non tocca il database.
 *  ⚠️ Il tipo lo decide Storage, non il mittente (D2): qui il mime dichiarato
 *   serve solo a rifiutare presto; la riga lo riscrive `media_fatto` dal mime
 *   dell'oggetto, e `uso` / `Content-Disposition` si ricavano da quello.
 *  ⚠️ Il percorso lo sceglie il database e deve sembrare un nome casuale: se
 *   contiene il numero del cliente, o esce dalla cartella, è un errore.
 *  ⚠️ Nei log solo `porte.avviso(codice, conteggi)`: mai numeri, chiavi, percorsi
 *   o indirizzi. Un errore del database arriva come `{ code }` e si risponde con
 *   una frase fissa.
 *  ───────────────────────────────────────────────────────────────────────── */
import { CODICI_MIGRAZIONE } from "./invio-giro";
import {
  AUTO_DI_SERIE,
  CATEGORIE_MEDIA,
  CHIAVE_MEDIA,
  ESTENSIONE_PER_MIME,
  FIRMA_LETTURA_S,
  FIRMA_VIDEO_S,
  ID_MEDIA,
  LIMITI_MEDIA,
  PERCORSO_MEDIA,
  TETTO_GB_DI_SERIE,
  USI_LETTURA,
  USI_PER_CATEGORIA,
  categoriaDi,
  type CategoriaMedia,
  type DettagliMedia,
  type ErroreMedia,
  type Interruttore,
  type MotivoRifiutoMedia,
  type PorteMedia,
  type RispostaLettura,
  type UsoLettura,
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
 *  shortcut: 100 GB basta (il tetto di serie è 5); se Storage crescesse, alzarlo. */
const TETTO_GB_MAX = 100;

/** Le categorie automatiche: la lista `auto` ripulita (voci sconosciute o doppie cadono, l'ordine è
 *  quello delle categorie). Senza una lista valgono solo le foto; una lista vuota è una scelta (nessuna). */
function leggiAuto(v: unknown): CategoriaMedia[] {
  if (!Array.isArray(v)) return [...AUTO_DI_SERIE];
  return CATEGORIE_MEDIA.filter((k) => v.includes(k));
}

/** `app_config.ponte_immagini` → interruttore. Il valore è un TESTO JSON
 *  (`{"acceso":true,"tettoGB":5,"auto":["foto","audio"]}`); un oggetto già letto vale uguale. Assente,
 *  rotto o con `acceso` diverso da `true` = spento. Un tetto assurdo = 5. */
export function leggiInterruttore(grezzo: unknown): Interruttore {
  const spento: Interruttore = {
    acceso: false,
    tettoGB: TETTO_GB_DI_SERIE,
    auto: [...AUTO_DI_SERIE],
  };
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
  return { acceso: true, tettoGB, auto: leggiAuto(v.auto) };
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

/** Nome del file di WhatsApp ripulito per la bolla: via controlli, direzioni del testo (U+202A–202E,
 *  U+2066–2069) e barre; al più 120 caratteri; vuoto = null. Si mostra sempre come nodo di testo. */
// eslint-disable-next-line no-control-regex
const NON_NEL_NOME = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069/\\]/g;
export function ripulisciNome(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Array.from(v.slice(0, 1000).replace(NON_NEL_NOME, "")).slice(0, 120).join("").trim();
  return t || null;
}

/** La miniatura è il JPEG di anteprima di WhatsApp in base64 (finisce in `data:image/jpeg;base64,`). */
const MINIATURA = /^\/9j\/[A-Za-z0-9+/]*={0,2}$/;
const MINIATURA_MAX = 12_000;

const intero = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;

/** Nome, durata, dimensioni e miniatura del corpo; ciò che è fuori misura diventa null, mai un errore.
 *  Null se non ne resta nessuno. */
export function leggiDettagli(json: Record<string, unknown>): DettagliMedia | null {
  const d: DettagliMedia = {
    nome: ripulisciNome(json.nome),
    durata_s: intero(json.durata_s, 0, 86_400),
    larghezza: intero(json.larghezza, 1, 20_000),
    altezza: intero(json.altezza, 1, 20_000),
    miniatura:
      typeof json.miniatura === "string" &&
      json.miniatura.length <= MINIATURA_MAX &&
      MINIATURA.test(json.miniatura)
        ? json.miniatura
        : null,
  };
  return Object.values(d).some((x) => x !== null) ? d : null;
}

/** `media_permesso` ripulito, o null (400). Il numero viene dalla chiave. `richiesto` e `dettagli`
 *  ci sono solo se il corpo li porta (e sono validi). */
export function leggiPermesso(json: unknown): {
  chiave: string;
  numero: string;
  mime: string;
  byte: number;
  richiesto?: true;
  dettagli?: DettagliMedia;
} | null {
  if (!oggetto(json) || json.v !== 1 || json.tipo !== "media_permesso") return null;
  const k = leggiChiave(json.chiave);
  const { mime, byte } = json;
  if (!k || typeof mime !== "string" || mime.length > 100) return null;
  if (typeof byte !== "number" || !Number.isInteger(byte) || byte < 1) return null;
  const dettagli = leggiDettagli(json);
  return {
    ...k,
    mime,
    byte,
    ...(json.richiesto === true ? { richiesto: true as const } : {}),
    ...(dettagli ? { dettagli } : {}),
  };
}

/** `media_fatto` ripulito, o null (400). */
export function leggiFatto(json: unknown): { chiave: string; numero: string } | null {
  if (!oggetto(json) || json.v !== 1 || json.tipo !== "media_fatto") return null;
  return leggiChiave(json.chiave);
}

/** Un percorso di Storage come lo vuole questo codice: pezzi di lettere, cifre,
 *  `-` e `_` (al più tre cartelle) e un'estensione di 2-5 lettere o cifre minuscole (la sceglie il
 *  database, senza elenco); mai il numero del cliente. Il database lo sceglie a caso, qui si controlla soltanto. */
export function percorsoValido(path: unknown, numero: string): path is string {
  return (
    typeof path === "string" &&
    /^[A-Za-z0-9_-]{1,64}(\/[A-Za-z0-9_-]{1,64}){0,2}\.[a-z0-9]{2,5}$/.test(path) &&
    !path.includes(numero)
  );
}

// ── Il Mac: `media_permesso` e `media_fatto` ───────────────────────────────

/** SQLSTATE 22023 (`invalid_parameter_value`): la funzione SQL ha rifiutato chiave, numero o
 *  utente. La rotta li ha già controllati, quindi è colpa del corpo e non del database. */
const CODICE_PARAMETRO_NON_VALIDO = "22023";
/** Il codice con cui le porte dicono «Storage non ha risposto» (non «oggetto assente»). */
const CODICE_STORAGE = "storage";

/** Un errore del database: 400 se la funzione rifiuta un parametro (22023), 503
 *  `migrazione` se manca la migrazione (il Mac trattiene), 500 `database` per il
 *  resto (il Mac ritenta). */
function erroreDb(porte: PorteMedia, e: unknown): Response {
  if (codiceDi(e) === CODICE_PARAMETRO_NON_VALIDO) return nonValido(porte);
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

const STATI_FATTO = ["pronta", "in_caricamento", "assente", "tipo", "troppo_grande"] as const;
const MOTIVI_SQL = ["tetto", "troppo_grande", "tipo", "liberato", "manuale"] as const;

/** Toglie da Storage l'oggetto di un `fatto` finito male (tipo o peso sbagliato). Il percorso viene dal
 *  database ma si ricontrolla: forma `<uuid>/<uuid>.<ext>` e cartella di QUESTO utente. Se non si riesce
 *  l'esito al Mac resta lo stesso (la riga è già `liberato`): l'oggetto lo toglie lo sweep degli orfani. */
async function rimuoviSbagliato(porte: PorteMedia, userId: string, path: unknown): Promise<void> {
  try {
    if (typeof path !== "string" || !PERCORSO_MEDIA.test(path) || !path.startsWith(`${userId}/`))
      throw { code: "?" };
    await porte.rimuovi(path);
  } catch {
    porte.avviso("media_storage", { non_rimosso: 1 });
  }
}

/** Il Mac chiede se può caricare un media, o dice che ha caricato. L'utente è
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
      const e = await porte.fatto(userId, f.chiave);
      const stato: unknown = e?.stato;
      if (!(STATI_FATTO as readonly unknown[]).includes(stato)) throw { code: "?" };
      if (stato === "tipo" || stato === "troppo_grande")
        await rimuoviSbagliato(porte, userId, e.path);
      porte.avviso("media_fatto", { [stato as string]: 1 });
      return risposta(200, { ok: true, esito: stato });
    }

    const p = tipo === "media_permesso" ? leggiPermesso(json) : null;
    if (!p) return nonValido(porte);
    const sw = leggiInterruttore(await porte.interruttore());
    if (!sw.acceso) return rifiuta(porte, "spenta");
    const categoria = categoriaDi(p.mime);
    if (!categoria) return rifiuta(porte, "tipo");
    if (p.byte > LIMITI_MEDIA[categoria]) return rifiuta(porte, "troppo_grande");
    //  Una categoria non automatica passa solo se il titolare l'ha chiesta con «Mostra»: `richiesto` non
    //  basta, serve la richiesta `in_corso` (il corpo lo scrive il Mac, ma il Mac non è il titolare).
    if (!sw.auto.includes(categoria)) {
      const chiesto = p.richiesto === true && (await porte.richiestaInCorso(userId, p.chiave));
      if (!chiesto) return rifiuta(porte, "manuale");
    }

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
      if (!(MOTIVI_SQL as readonly unknown[]).includes(motivo)) throw { code: "?" };
      return rifiuta(porte, motivo);
    }
    if (e?.esito === "carica" && percorsoValido(e.path, p.numero)) {
      //  I dettagli solo ora: per un permesso rifiutato o già presente non si scrive niente.
      if (p.dettagli) await porte.dettagli(userId, p.chiave, p.dettagli);
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

/** Il percorso in Storage di un file: la cartella dell'utente e il nome (`ID_MEDIA`), come lo
 *  sceglie la migrazione (`<user_id>/<uuid>.<ext>`). */
export const percorsoDi = (userId: string, id: string): string => `${userId}/${id}`;

/** Storage dice «l'oggetto non c'è»? Vale lo stato 404, sia nello stato HTTP sia nel corpo (con
 *  HTTP 400 lo Storage di Supabase scrive `statusCode: "404"`). Ogni altro errore (429, 5xx, rete)
 *  è un guasto passeggero, non una foto sparita. Mai il testo del messaggio: può portare il percorso. */
export function oggettoAssente(errore: unknown): boolean {
  if (!oggetto(errore)) return false;
  return [errore.status, errore.statusCode].some((v) => String(v) === "404");
}

const rifiutoLettura = (
  stato: number,
  motivo: Extract<RispostaLettura["corpo"], { ok: false }>["motivo"],
): RispostaLettura => ({
  stato,
  corpo: { ok: false, motivo },
});

/** Il nome del file scaricato: solo ASCII sicuro (lettere, cifre, spazio, `_`, `-`; ogni altro segno, punti
 *  compresi, diventa `_`), al più 80 caratteri, e l'estensione la mette il mime (mai quella scritta dal
 *  mittente). Senza nome, o con un nome senza lettere né cifre: «file». Un mime senza estensione nota non
 *  ne riceve una inventata. */
export function nomeSicuro(nome: unknown, mime: unknown): string {
  const ext = typeof mime === "string" ? ESTENSIONE_PER_MIME[mime] : undefined;
  const base = (typeof nome === "string" ? nome.slice(0, 1000) : "")
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[^A-Za-z0-9 _-]/gu, "_")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return `${/[A-Za-z0-9]/.test(base) ? base : "file"}${ext ? `.${ext}` : ""}`;
}

/** `?uso=`: assente = «vedi» (la chiamata di prima del 31/10); un valore fuori elenco = null. */
function leggiUso(v: unknown): UsoLettura | null {
  if (v === undefined || v === null) return "vedi";
  return (USI_LETTURA as readonly unknown[]).includes(v) ? (v as UsoLettura) : null;
}

/** Il link di un media pronto. `adminUserId` è l'installazione della sessione:
 *  deve essere quella del database, altrimenti 403. `id` = il nome del file
 *  (`ID_MEDIA`), mai la chiave del messaggio (porta il numero del cliente). La
 *  riga si cerca per l'utente della sessione (già verificato uguale a quello del
 *  database): il file di un altro utente è «non trovato». `uso` si verifica contro la
 *  categoria della RIGA (foto: vedi · vocale: vedi, apri · video: video · documento: apri).
 *  Il PDF si apre inline; il resto di `apri` è un allegato col nome ripulito (lo decide il server dal
 *  mime della riga, non il browser). Il video ha 30 minuti, il resto 5. */
export async function gestisciLettura(
  porte: PorteMedia,
  i: { adminUserId: string; id: unknown; uso?: unknown },
): Promise<RispostaLettura> {
  try {
    const userId = await porte.utente();
    if (!userId || !i.adminUserId || i.adminUserId !== userId) {
      porte.avviso("media_lettura", { rifiutata: 1 });
      return rifiutoLettura(403, "non_autorizzato");
    }
    const id = typeof i.id === "string" && ID_MEDIA.test(i.id) ? i.id : null;
    if (!id) {
      porte.avviso("media_lettura", { non_valida: 1 });
      return rifiutoLettura(400, "id_non_valido");
    }
    const uso = leggiUso(i.uso);
    if (!uso) {
      porte.avviso("media_lettura", { non_valida: 1 });
      return rifiutoLettura(400, "uso_non_valido");
    }
    const riga = await porte.percorsoPronto(userId, id);
    if (!riga) {
      porte.avviso("media_lettura", { non_trovata: 1 });
      return rifiutoLettura(404, "non_trovata");
    }
    const categoria = riga.categoria ?? categoriaDi(riga.mime);
    if (!categoria || !USI_PER_CATEGORIA[categoria].includes(uso)) {
      porte.avviso("media_lettura", { non_valida: 1 });
      return rifiutoLettura(400, "uso_non_valido");
    }
    const download =
      uso === "apri" && riga.mime !== "application/pdf"
        ? nomeSicuro(riga.nome, riga.mime)
        : undefined;
    const url = await porte.firmaLettura(
      riga.path,
      uso === "video" ? FIRMA_VIDEO_S : FIRMA_LETTURA_S,
      download ? { download } : undefined,
    );
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
    if (codiceDi(e) === CODICE_STORAGE) {
      porte.avviso("media_storage");
      return rifiutoLettura(503, "storage");
    }
    porte.avviso("media_database");
    return rifiutoLettura(500, "database");
  }
}
