/** ── PONTE WHATSAPP · MEDIA: LE AZIONI, LA LOGICA ────────────────────────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T3 (PIANO c.1, c.3, c2,
 *  d.3, D11, D14). Quattro ingressi, con le `PorteMediaAzioni` finte nelle prove:
 *   · `gestisciMacMedia`   il Mac prende le richieste di «Mostra» (`media_prendi`)
 *                          e chiude un lavoro richiesto (`media_esito`); la chiama
 *                          `ingresso.ts` DOPO la chiave `X-HGL-Token` e solo se ha
 *                          la porta `mediaAzioni`;
 *   · `campiBattitoMedia`  i campi nuovi della risposta al battito (`media_v`,
 *                          `media_richieste`, `media_auto`);
 *   · `gestisciAzione`     il browser chiede `richiedi`, `timer` o `libera`; la
 *                          chiama la rotta `/api/crm/ponte-media-azione` DOPO la
 *                          sessione;
 *   · `giroScadute`        l'hook del cron (ogni minuto): libera i media scaduti e,
 *                          ogni 30 minuti, fa le pulizie e toglie gli orfani.
 *
 *  ⚠️ L'utente non arriva MAI dal corpo: è `porte.utente()` (`manychat_config`), e
 *   per il browser deve essere quello della sessione (403 altrimenti).
 *  ⚠️ Cancellare (D11): UNA chiave = chiunque veda la chat; `chiavi`, `numero` e
 *   `tutto` = permesso «impostazioni» (403 per ciascuno). La selezione è un tipo
 *   esplicito: «tutto» non nasce mai da un campo mancante.
 *  ⚠️ Il percorso da togliere da Storage viene SOLO dal database (`da_liberare`,
 *   `scadute`, `orfani`) e prima di ogni `remove` si ricontrolla: forma
 *   `<uuid>/<uuid>.<ext>` e cartella dell'utente. Il bucket lo fissa la porta.
 *  ⚠️ «Liberato» si segna DOPO la rimozione e solo se Storage ha risposto bene:
 *   un errore lascia la riga `pronta` e il passo dopo ritenta (tutto idempotente).
 *  ⚠️ Nei log solo `porte.avviso(codice, conteggi)`: mai numeri, chiavi, percorsi.
 *   Un errore del database arriva come `{ code }` e si risponde con una frase fissa.
 *  ───────────────────────────────────────────────────────────────────────── */
import { CODICI_MIGRAZIONE } from "./invio-giro";
import { leggiChiave, leggiInterruttore } from "./media";
import { PERCORSO_MEDIA } from "./media-tipi";
import {
  CHIAVI_MAX,
  ESITI_RICHIESTA,
  GRUPPO_REMOVE,
  MAX_PRENDI,
  MEDIA_V,
  ORFANI_OGNI_MINUTI,
  ORFANI_PER_GIRO,
  PASSO_LIBERA,
  SCADUTE_PER_GIRO,
  TIMER_AMMESSI,
  type AzioneBrowser,
  type CodiceAvvisoAzioni,
  type EsitoRichiesta,
  type MotivoAzione,
  type PorteMediaAzioni,
  type RispostaAzione,
  type RisultatoLibera,
  type SelezioneLibera,
  type VoceMedia,
} from "./media-azioni-tipi";

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

/** Un intero ≥ 0 da una porta (un valore storto vale 0). */
const intero = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

/** SQLSTATE 22023: la funzione SQL ha rifiutato un parametro (colpa del corpo, non del database). */
const CODICE_PARAMETRO_NON_VALIDO = "22023";
/** Il codice con cui la porta dice «Storage non ha risposto». */
const CODICE_STORAGE = "storage";

/** Il codice di log di un errore: Storage, migrazione mancante, o database. */
const avvisoDi = (e: unknown): CodiceAvvisoAzioni => {
  const c = codiceDi(e);
  if (c === CODICE_STORAGE) return "media_storage";
  return CODICI_MIGRAZIONE.includes(c) ? "media_migrazione" : "media_database";
};

const gruppi = <T>(v: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < v.length; i += n) out.push(v.slice(i, i + n));
  return out;
};

/** Il percorso di un oggetto del bucket come lo sceglie il database, nella cartella di QUESTO utente.
 *  Prima di ogni `remove`: un percorso che non passa non arriva a Storage. */
export const percorsoRimovibile = (path: unknown, userId: string): path is string =>
  typeof path === "string" && PERCORSO_MEDIA.test(path) && path.startsWith(`${userId}/`);

// ── Il Mac: `media_prendi` e `media_esito` ─────────────────────────────────

/** `media_prendi` ripulito: quante richieste al massimo (1..5), o null (400). */
export function leggiPrendi(json: unknown): number | null {
  if (!oggetto(json) || json.v !== 1 || json.tipo !== "media_prendi") return null;
  const m = json.max;
  return typeof m === "number" && Number.isInteger(m) && m >= 1 ? Math.min(m, MAX_PRENDI) : null;
}

/** `media_esito` ripulito, o null (400). */
export function leggiEsito(json: unknown): { chiave: string; esito: EsitoRichiesta } | null {
  if (!oggetto(json) || json.v !== 1 || json.tipo !== "media_esito") return null;
  const k = leggiChiave(json.chiave);
  const esito = json.esito;
  if (!k || !(ESITI_RICHIESTA as readonly unknown[]).includes(esito)) return null;
  return { chiave: k.chiave, esito: esito as EsitoRichiesta };
}

function nonValido(porte: PorteMediaAzioni): Response {
  porte.avviso("media_non_valido");
  return risposta(400, { ok: false, errore: "corpo_non_valido" });
}

/** Database: 400 se l'SQL rifiuta un parametro, 503 `migrazione` se manca la migrazione (il Mac
 *  trattiene), 500 `database` per il resto (il Mac ritenta: ogni passo è idempotente). */
function erroreMac(porte: PorteMediaAzioni, e: unknown): Response {
  if (codiceDi(e) === CODICE_PARAMETRO_NON_VALIDO) return nonValido(porte);
  if (CODICI_MIGRAZIONE.includes(codiceDi(e))) {
    porte.avviso("media_migrazione");
    return risposta(503, { ok: false, errore: "migrazione" });
  }
  porte.avviso("media_database");
  return risposta(500, { ok: false, errore: "database" });
}

/** Il Mac prende le richieste di «Mostra» o ne chiude una. L'utente è quello del server. */
export async function gestisciMacMedia(
  porte: PorteMediaAzioni,
  userId: string,
  json: unknown,
): Promise<Response> {
  const tipo = oggetto(json) ? json.tipo : null;
  try {
    if (tipo === "media_prendi") {
      const max = leggiPrendi(json);
      if (!max) return nonValido(porte);
      const grezze = await porte.prendi(userId, max);
      if (!Array.isArray(grezze)) throw { code: "?" };
      //  Solo chiavi valide: ciò che il Mac riceve è sempre una chiave `bw:`.
      const richieste = grezze
        .filter((k) => leggiChiave(k))
        .slice(0, MAX_PRENDI)
        .map((chiave) => ({ chiave }));
      porte.avviso("media_prendi", { n: richieste.length });
      return risposta(200, { ok: true, richieste });
    }
    const e = tipo === "media_esito" ? leggiEsito(json) : null;
    if (!e) return nonValido(porte);
    await porte.richiestaEsito(userId, e.chiave, e.esito);
    porte.avviso("media_esito", { [e.esito]: 1 });
    return risposta(200, { ok: true });
  } catch (e) {
    return erroreMac(porte, e);
  }
}

// ── Il battito ─────────────────────────────────────────────────────────────

/** I campi nuovi della risposta al battito (D8, c2.2): `media_v` (il Worker serve le quattro
 *  categorie), `media_richieste` (solo se > 0: il Mac azzera la pausa e chiama `media_prendi`) e
 *  `media_auto` (le categorie scaricate in automatico). Solo con l'interruttore ACCESO: spento (o
 *  assente, o illeggibile) nessun campo, il Mac resta alle sole foto come con un Worker vecchio e la
 *  risposta è identica a quella di prima. Non lancia mai. */
export async function campiBattitoMedia(
  porte: PorteMediaAzioni,
  userId: string,
): Promise<Record<string, unknown>> {
  try {
    const sw = leggiInterruttore(await porte.interruttore());
    //  Interruttore spento: niente da annunciare (il Mac non scarica niente) e la risposta è quella di sempre.
    if (!sw.acceso) return {};
    //  La tabella delle richieste può mancare (migrazione A non applicata): vale «nessuna».
    const n = intero(await porte.inAttesa(userId).catch(() => 0));
    return { media_v: MEDIA_V, ...(n > 0 ? { media_richieste: n } : {}), media_auto: sw.auto };
  } catch {
    return {};
  }
}

// ── Il browser: la lettura del corpo ───────────────────────────────────────

const NUMERO = /^\d{8,15}$/;

/** `timer`: assente o «tieni» = tieni sempre (`null`); altrimenti uno dei cinque valori. `obbligatorio`
 *  per l'azione `timer`. Il risultato è `{ valore }` o `null` (corpo non valido). */
function leggiTimer(v: unknown, obbligatorio: boolean): { valore: number | null } | null {
  if (v === undefined) return obbligatorio ? null : { valore: null };
  if (v === "tieni") return { valore: null };
  return typeof v === "number" && (TIMER_AMMESSI as readonly number[]).includes(v)
    ? { valore: v }
    : null;
}

/** Quale selezione porta `libera`: ESATTAMENTE una fra `chiave`, `chiavi`, `numero`, `tutto: true`. */
function leggiSelezione(json: Record<string, unknown>): SelezioneLibera | null {
  const presenti = ["chiave", "chiavi", "numero", "tutto"].filter((k) => json[k] !== undefined);
  if (presenti.length !== 1) return null;
  if (presenti[0] === "chiave") {
    const k = leggiChiave(json.chiave);
    return k ? { tipo: "chiave", chiave: k.chiave } : null;
  }
  if (presenti[0] === "chiavi") {
    const l = json.chiavi;
    if (!Array.isArray(l) || l.length < 1 || l.length > CHIAVI_MAX) return null;
    const ok = l.every((k) => leggiChiave(k));
    return ok ? { tipo: "chiavi", chiavi: [...new Set(l as string[])] } : null;
  }
  if (presenti[0] === "numero")
    return typeof json.numero === "string" && NUMERO.test(json.numero)
      ? { tipo: "numero", numero: json.numero }
      : null;
  return json.tutto === true ? { tipo: "tutto" } : null;
}

/** Il corpo del browser ripulito, o null (400). */
export function leggiAzione(json: unknown): AzioneBrowser | null {
  if (!oggetto(json)) return null;
  if (json.azione === "libera") {
    const selezione = leggiSelezione(json);
    return selezione ? { azione: "libera", selezione } : null;
  }
  if (json.azione !== "richiedi" && json.azione !== "timer") return null;
  const k = leggiChiave(json.chiave);
  const t = leggiTimer(json.timer, json.azione === "timer");
  return k && t ? { azione: json.azione, chiave: k.chiave, timerS: t.valore } : null;
}

// ── Liberare ───────────────────────────────────────────────────────────────

/** Toglie da Storage (a gruppi) e SOLO DOPO segna `liberato`. Un gruppo che fallisce (Storage o
 *  database) non si segna: le sue chiavi finiscono in `falliti`, le altre vanno avanti. */
async function liberaVoci(
  porte: PorteMediaAzioni,
  userId: string,
  voci: VoceMedia[],
): Promise<{ liberati: number; byte: number; falliti: Set<string> }> {
  const r = { liberati: 0, byte: 0, falliti: new Set<string>() };
  for (const g of gruppi(voci, GRUPPO_REMOVE)) {
    try {
      r.byte += intero(await porte.rimuovi(g.map((v) => v.path)));
      r.liberati += intero(await porte.liberato(userId, g));
    } catch (e) {
      for (const v of g) r.falliti.add(v.chiave);
      porte.avviso(avvisoDi(e));
    }
  }
  return r;
}

/** Le righe lette dal database che si possono togliere (chiave e percorso validi); le altre si contano. */
function voceValida(v: unknown, userId: string): v is VoceMedia {
  return oggetto(v) && !!leggiChiave(v.chiave) && percorsoRimovibile(v.path, userId);
}

/** UN passo di liberazione (d.3): al più `PASSO_LIBERA` file. Il pannello lo ripete finché
 *  `restano` è 0, e si ferma se `non_riusciti` > 0. */
async function liberaPasso(
  porte: PorteMediaAzioni,
  userId: string,
  sel: SelezioneLibera,
): Promise<RisultatoLibera> {
  //  Mai numero nullo + chiavi nulle per sbaglio: «tutto» è l'unico caso in cui sono nulli entrambi.
  const numero = sel.tipo === "numero" ? sel.numero : null;
  const chiavi = sel.tipo === "chiave" ? [sel.chiave] : sel.tipo === "chiavi" ? sel.chiavi : null;
  const lette = await porte.daLiberare(userId, numero, chiavi, PASSO_LIBERA);
  const voci = lette.filter((v) => voceValida(v, userId));
  const scartate = lette.length - voci.length;
  if (scartate > 0) porte.avviso("media_percorso", { n: scartate });

  const r = await liberaVoci(porte, userId, voci);
  let restano = 0;
  if (lette.length >= PASSO_LIBERA) {
    //  Un passo pieno: quanti ce ne sono ancora (un minimo, al più un passo). Quelli di questo passo
    //  che non si sono liberati (falliti o scartati) non contano: il pannello si ferma su di loro.
    const dopo = await porte.daLiberare(userId, numero, chiavi, PASSO_LIBERA);
    const viste = new Set(lette.map((v) => v?.chiave));
    restano = dopo.filter((v) => !viste.has(v.chiave)).length;
  }
  const esito = {
    liberati: r.liberati,
    byte: r.byte,
    restano,
    non_riusciti: scartate + r.falliti.size,
  };
  porte.avviso("media_liberati", esito);
  return esito;
}

// ── Il browser: richiedi, timer, libera ────────────────────────────────────

const rifiuto = (stato: number, motivo: MotivoAzione, extra: object = {}): RispostaAzione => ({
  stato,
  corpo: { ok: false, motivo, ...extra },
});

/** Database: 400 se l'SQL rifiuta un parametro, 503 `migrazione` se manca la migrazione, 500 il resto. */
function erroreBrowser(porte: PorteMediaAzioni, e: unknown): RispostaAzione {
  if (codiceDi(e) === CODICE_PARAMETRO_NON_VALIDO) {
    porte.avviso("media_non_valido");
    return rifiuto(400, "corpo_non_valido");
  }
  porte.avviso(avvisoDi(e));
  return CODICI_MIGRAZIONE.includes(codiceDi(e))
    ? rifiuto(503, "migrazione")
    : rifiuto(500, "database");
}

/** L'azione del browser. `adminUserId` è l'installazione della sessione: deve essere quella del
 *  database, altrimenti 403. `puoImpostazioni` = la sessione ha il permesso «impostazioni» (lo
 *  decide la rotta): serve a `libera` con `chiavi`, `numero` o `tutto`. */
export async function gestisciAzione(
  porte: PorteMediaAzioni,
  i: { adminUserId: string | undefined; corpo: unknown; puoImpostazioni: boolean },
): Promise<RispostaAzione> {
  try {
    const userId = await porte.utente();
    if (!userId || !i.adminUserId || i.adminUserId !== userId) {
      porte.avviso("media_azione", { rifiutata: 1 });
      return rifiuto(403, "non_autorizzato");
    }
    const a = leggiAzione(i.corpo);
    if (!a) {
      porte.avviso("media_non_valido");
      return rifiuto(400, "corpo_non_valido");
    }

    if (a.azione === "richiedi") {
      //  Spenta = nessuna richiesta nasce. Il tetto lo applica `media_permesso` quando il Mac carica
      //  (un lavoro richiesto che lo supera chiude con `media_esito tetto`).
      if (!leggiInterruttore(await porte.interruttore()).acceso) return rifiuto(409, "spenta");
      const e = await porte.richiedi(userId, a.chiave, a.timerS);
      if (e?.esito === "non_trovata") return rifiuto(404, "non_trovata");
      if (e?.esito !== "in_attesa" && e?.esito !== "gia_pronta") throw { code: "?" };
      porte.avviso("media_azione", { richiesta: 1 });
      return { stato: 200, corpo: { ok: true, esito: e.esito } };
    }

    if (a.azione === "timer") {
      const e = await porte.timer(userId, a.chiave, a.timerS);
      if (e?.ok && e.stato === "pronta")
        return { stato: 200, corpo: { ok: true, stato: "pronta", scade_il: e.scade_il ?? null } };
      if (e?.ok && e.stato === "richiesta")
        return { stato: 200, corpo: { ok: true, stato: "richiesta" } };
      if (e && e.ok === false) return rifiuto(404, "non_trovata");
      throw { code: "?" };
    }

    //  Cancellare di massa è distruttivo: chiavi (array), numero e tutto chiedono «impostazioni».
    if (a.selezione.tipo !== "chiave" && !i.puoImpostazioni) {
      porte.avviso("media_azione", { vietata: 1 });
      return rifiuto(403, "permesso");
    }
    const r = await liberaPasso(porte, userId, a.selezione);
    //  Niente liberato e qualcosa non riuscito: un cliente ingenuo che guarda solo `ok` non deve crederci.
    if (r.liberati === 0 && r.non_riusciti > 0) return rifiuto(503, "storage", r);
    return { stato: 200, corpo: { ok: true, ...r } };
  } catch (e) {
    return erroreBrowser(porte, e);
  }
}

// ── L'hook del cron ────────────────────────────────────────────────────────

export interface RisultatoGiro {
  /** falso se un passo ha avuto un guasto del database (la rotta risponde 500 e il cron lo registra) */
  ok: boolean;
  liberati: number;
  orfani: number;
  non_riusciti: number;
}

/** Il giro del minuto: libera i media `pronta` con timer scaduto (`scadute` → `remove` a gruppi →
 *  `liberato` con chiave e percorso letti); ai minuti 0 e 30 anche le pulizie e gli orfani (oggetti
 *  senza riga `pronta`/`in_caricamento`: rimozioni fallite). L'hook non ha memoria: lo decide
 *  l'ora. Ogni passo ha il suo `try`, e tutto è idempotente: un giro interrotto lo rifà il minuto dopo. */
export async function giroScadute(porte: PorteMediaAzioni, adesso: Date): Promise<RisultatoGiro> {
  const r: RisultatoGiro = { ok: true, liberati: 0, orfani: 0, non_riusciti: 0 };

  try {
    const perUtente = new Map<string, VoceMedia[]>();
    for (const s of await porte.scadute(SCADUTE_PER_GIRO)) {
      if (typeof s?.user_id !== "string" || !voceValida(s, s.user_id)) {
        r.non_riusciti++;
        porte.avviso("media_percorso", { n: 1 });
        continue;
      }
      perUtente.set(s.user_id, [
        ...(perUtente.get(s.user_id) ?? []),
        { chiave: s.chiave, path: s.path },
      ]);
    }
    for (const [userId, voci] of perUtente) {
      const e = await liberaVoci(porte, userId, voci);
      r.liberati += e.liberati;
      r.non_riusciti += e.falliti.size;
    }
    if (r.liberati > 0 || r.non_riusciti > 0)
      porte.avviso("media_scadute", { liberati: r.liberati, non_riusciti: r.non_riusciti });
  } catch (e) {
    r.ok = false;
    porte.avviso(avvisoDi(e));
  }

  if (adesso.getUTCMinutes() % ORFANI_OGNI_MINUTI !== 0) return r;

  //  Le pulizie prima (una `in_caricamento` vecchia passa a `liberato`: il suo oggetto diventa orfano
  //  e lo toglie il passo dopo). La funzione può non esserci ancora: non è un guasto.
  try {
    await porte.pulizia();
    porte.avviso("media_pulizia");
  } catch (e) {
    if (!CODICI_MIGRAZIONE.includes(codiceDi(e))) r.ok = false;
    porte.avviso(avvisoDi(e));
  }

  try {
    const nomi = (await porte.orfani(ORFANI_PER_GIRO)).filter((n) =>
      PERCORSO_MEDIA.test(String(n)),
    );
    for (const g of gruppi(nomi, GRUPPO_REMOVE)) {
      try {
        await porte.rimuovi(g);
        r.orfani += g.length;
      } catch (e) {
        r.non_riusciti += g.length;
        porte.avviso(avvisoDi(e));
      }
    }
    if (nomi.length > 0) porte.avviso("media_orfani", { n: r.orfani });
  } catch (e) {
    r.ok = false;
    porte.avviso(avvisoDi(e));
  }
  return r;
}
