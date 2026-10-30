/** ── PONTE WHATSAPP · LE IMMAGINI (origine, download protetto, coda su disco) ─
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T6 (PIANO c.1, c.2, c.3).
 *  Un'immagine arrivata (viva o dallo storico) entra in una coda SU DISCO; un
 *  ciclo la prende (una alla volta), chiede il permesso al CRM (`media_permesso`),
 *  la scarica da WhatsApp, la carica su Storage con l'URL monouso che il CRM ha
 *  dato (`media_fatto` chiude). Il Worker non vede mai i byte e sul Mac non c'è
 *  nessuna chiave di Supabase.
 *
 *  Questo file NON importa Baileys e NON tocca il socket: riceve `scarica`
 *  (= `downloadContentFromMessage`) da `collega.mjs`/`index.mjs` (compito T8).
 *
 *  ⚠️ SICUREZZA DEL DOWNLOAD (c.1). Il campo `url` di un `imageMessage` lo scrive
 *   CHI SCRIVE AL NUMERO; in Baileys rc14 `downloadContentFromMessage` prende
 *   l'host da lì e la sua `fetch` non ha né timeout né limite di byte. Quindi:
 *    1. `validaOrigine` PRIMA di ogni richiesta: `mediaKey` di 32 byte,
 *       `directPath` che comincia con `/` (mai `//`, `..`, `\`, spazi), `url`
 *       (se c'è) `https:` con host `*.whatsapp.net` letto con `new URL().hostname`,
 *       senza utente, password, porta. Altrimenti il messaggio è scartato, senza
 *       ripiego sul `directPath`;
 *    2. a Baileys va una COPIA NUOVA `{ mediaKey, directPath }` (mai `url`, mai
 *       l'oggetto del messaggio) e `{ host }` deciso da noi;
 *    3. il flusso si legge a pezzi con un tetto (8 MiB + 10 %) e un timeout di
 *       30 s fatto con `Promise.race` e un timer: un flusso fermo non produce
 *       pezzi e un controllo dentro il ciclo di lettura non scatterebbe mai;
 *    4. l'errore di Baileys contiene l'`url` (`Failed to fetch stream from …`):
 *       NON si legge, NON si registra. Se ne estrae solo `status` (404/410 =
 *       scaduta). Nel registro: parole fisse e numeri.
 *   `downloadMediaMessage` è vietato in tutto il servizio.
 *  ⚠️ Su disco (`immagini/coda/<impronta>.json`, 600; cartelle 700) ci sono la
 *   chiave `bw:<numero>:<id>` (il numero è un dato cliente) e la chiave del
 *   media: stessa cartella riservata delle credenziali; fuori da backup e log.
 *  ⚠️ Nessun `console.*`: i codici del registro sono parole fisse.
 *
 *  La tabella di c.2 (nessuna foto si butta per un guasto passeggero):
 *    download 404/410 (scaduta), `troppo_grande`, `tipo`, `gia_presente` → scartata;
 *    `spenta` (1 ora) e `tetto` (6 ore) → resta, il ciclo dorme;
 *    400/401/429/503/5xx, rete, risposta storta → resta, il ciclo dorme
 *      5 min → 15 min → 1 h → 3 h (Worker vecchio o migrazione mancante: si aspetta);
 *    download o PUT che falliscono → resta con attese 5 min → 15 min → 1 h → 3 h,
 *      al quinto tentativo scartata (`errori`).
 *
 *  shortcut: il limite di 600 all'ora è in memoria (un riavvio lo azzera, ma le
 *  pause di 2–5 s restano: al massimo ~1.000 all'ora); da salvare su disco
 *  solo se `ponte-wa` si riavvia spesso.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { interoDa } from "./estrai.mjs";
import { spedisci } from "./lotti.mjs";

export const LIMITI_IMMAGINI = {
  /** peso massimo di un'immagine (anche il limite del bucket `ponte-media`) */
  maxByte: 8 * 1024 * 1024,
  /** il flusso si legge fino a maxByte × tolleranza, poi si distrugge */
  tolleranza: 1.1,
  /** download + lettura, in tutto */
  timeoutMs: 30_000,
  /** oltre, il messaggio non è più sul CDN di WhatsApp: segnaposto, senza tentare */
  giorni: 14,
  maxCoda: 5000,
  allOra: 600,
  pausaMinMs: 2000,
  pausaMaxMs: 5000,
  attese: [300_000, 900_000, 3_600_000, 10_800_000],
  tentativi: 5,
  pausaSpentaMs: 3_600_000,
  pausaTettoMs: 21_600_000,
  hostDiSerie: "mmg.whatsapp.net",
};

const MIME_AMMESSI = new Set(["image/jpeg", "image/png", "image/webp"]);
const ORA_MS = 3_600_000;
const GIORNO_MS = 86_400_000;
const HOST_WHATSAPP = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.whatsapp\.net$/;
/** un solo quantificatore su una classe: nessun giro lungo (c'è anche il tetto di 1024) */
const PERCORSO_VALIDO = /^\/(?!\/)[A-Za-z0-9._~\-/?=&%+]*$/;
const CHIAVE_VALIDA = /^bw:\d{8,15}:[A-Za-z0-9_.-]{1,128}$/;
const FILE_CODA = /^[0-9a-f]{64}\.json$/;
const BASE64_32 = /^[A-Za-z0-9+/]{43}=$/;
const STORAGE_PERCORSO = "/storage/v1/object/upload/sign/ponte-media/";
const HOST_STORAGE = /^[a-z0-9-]+\.supabase\.co$/;

const oggetto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** Il tipo vero di un'immagine dai primi byte (mai fidarsi del `mimetype` del mittente). */
export function tipoDaByte(b) {
  if (!(b instanceof Uint8Array) || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

const hostValido = (h) => typeof h === "string" && h.length <= 253 && HOST_WHATSAPP.test(h);
const percorsoValido = (p) => typeof p === "string" && p.length <= 1024 && PERCORSO_VALIDO.test(p) && !p.includes("..") && !/%2e|%2f|%5c/i.test(p);

/** L'host di un `url` di WhatsApp, oppure null se non è `https://*.whatsapp.net` pulito. */
function hostDaUrl(url) {
  if (typeof url !== "string" || url.length > 4096) return null;
  //  Sulla stringa GREZZA, prima del parser (che toglie tab e a capo e cambia i `\` in `/`).
  if (/[\u0000- \u007f\\]/.test(url)) return null;
  if (url.slice(0, 8).toLowerCase() !== "https://") return null;
  const resto = url.slice(8);
  const fine = resto.search(/[/?#]/);
  const autorita = fine < 0 ? resto : resto.slice(0, fine);
  if (autorita.includes("@") || autorita.includes(":")) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  return hostValido(u.hostname) ? u.hostname : null;
}

/** Controlla l'origine di un `imageMessage` PRIMA di qualunque richiesta (c.1 punto 1).
 *  `{ ok: true, mediaKey: Buffer(32), directPath, host }` oppure
 *  `{ ok: false, motivo: "origine_non_valida" }`. L'`url` non si usa mai per
 *  scaricare: serve solo a scegliere l'host (altrimenti `mmg.whatsapp.net`). */
export function validaOrigine(immagine) {
  const no = { ok: false, motivo: "origine_non_valida" };
  if (!oggetto(immagine)) return no;
  const k = immagine.mediaKey;
  if (!(Buffer.isBuffer(k) || k instanceof Uint8Array) || k.length !== 32) return no;
  if (!percorsoValido(immagine.directPath)) return no;
  let host = LIMITI_IMMAGINI.hostDiSerie;
  if (immagine.url !== undefined && immagine.url !== null && immagine.url !== "") {
    host = hostDaUrl(immagine.url);
    if (!host) return no;
  }
  return { ok: true, mediaKey: Buffer.from(k), directPath: immagine.directPath, host };
}

/** `mimetype` → uno dei tre ammessi (senza parametri, minuscolo), oppure null. */
function mimeDi(m) {
  if (typeof m !== "string") return null;
  const t = m.split(";")[0].trim().toLowerCase();
  return MIME_AMMESSI.has(t) ? t : null;
}

/** L'URL di carico dato dal CRM: solo `https://*.supabase.co/storage/v1/object/upload/sign/ponte-media/…`. */
function urlCaricoValido(x) {
  if (typeof x !== "string" || x.length > 2048 || /[\u0000- \u007f\\]/.test(x)) return null;
  let u;
  try {
    u = new URL(x);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port || !HOST_STORAGE.test(u.hostname) || !u.pathname.startsWith(STORAGE_PERCORSO)) return null;
  return u.href;
}

/** Lo `status` HTTP di un errore di Baileys (Boom), e NIENTE altro: il testo contiene l'`url`. */
function statoDi(errore) {
  const s = errore?.output?.statusCode ?? errore?.statusCode ?? errore?.data?.statusCode;
  return Number.isInteger(s) ? s : null;
}

class ErroreImmagine extends Error {
  constructor(codice) {
    super(codice);
    this.codice = codice;
  }
}

/** L'impronta della chiave: il nome del file (il numero del cliente non sta nel nome). */
const nomeDi = (chiave) => `${createHash("sha256").update(chiave).digest("hex")}.json`;

/** Un lavoro letto da disco, controllato di nuovo (il file è nostro, ma si ricontrolla), oppure null. */
function lavoroValido(nome, d) {
  if (!oggetto(d) || d.v !== 1 || typeof d.chiave !== "string" || !CHIAVE_VALIDA.test(d.chiave) || nomeDi(d.chiave) !== nome) return null;
  if (typeof d.mediaKey !== "string" || !BASE64_32.test(d.mediaKey) || Buffer.from(d.mediaKey, "base64").length !== 32) return null;
  if (!percorsoValido(d.directPath) || !hostValido(d.host) || !MIME_AMMESSI.has(d.mime)) return null;
  if (!Number.isInteger(d.byte) || d.byte < 1 || d.byte > LIMITI_IMMAGINI.maxByte) return null;
  if (!Number.isInteger(d.ts) || d.ts < 1) return null;
  if (!Number.isInteger(d.guasti) || d.guasti < 0 || d.guasti >= LIMITI_IMMAGINI.tentativi) return null;
  if (!Number.isFinite(d.prossimo_il) || (d.caricato !== undefined && typeof d.caricato !== "boolean")) return null;
  return { v: 1, chiave: d.chiave, mediaKey: d.mediaKey, directPath: d.directPath, host: d.host, mime: d.mime, byte: d.byte, ts: d.ts, guasti: d.guasti, prossimo_il: d.prossimo_il, ...(d.caricato ? { caricato: true } : {}) };
}

/** Scrittura atomica con permessi 600. */
function scrivi(percorso, dati) {
  const temporaneo = `${percorso}.tmp-${process.pid}`;
  try {
    writeFileSync(temporaneo, JSON.stringify(dati), { mode: 0o600 });
    renameSync(temporaneo, percorso);
  } catch (errore) {
    rmSync(temporaneo, { force: true });
    throw errore;
  }
}

/** Le immagini.
 *
 *  `opzioni`: `url`, `token` (come i lotti); `cartella` (`immagini/`); `scarica`
 *  (= `downloadContentFromMessage` di Baileys: `(copia, "image", { host })` →
 *  flusso); `registro`; `orologio`, `fetch`, `casuale`, `pianifica` (le prove li
 *  sostituiscono); `timeoutScaricoMs`, `timeoutCaricoMs`, `maxCoda`.
 *
 *  Uscita: `{ accoda, avvia, sveglia, ferma, contatori }`.
 *  `accoda({ chiave, immagine, ts })` → `{ ok: true }` | `{ ok: false, motivo }`
 *  (non lancia mai); `chiave` = `bw:<numero>:<id>`, `immagine` = l'`imageMessage`,
 *  `ts` = secondi UNIX del messaggio. `avvia()` e `sveglia()` restituiscono la
 *  promessa del ciclo (uno solo alla volta: un download alla volta). */
export function creaImmagini({ url, token, cartella, scarica, registro = () => {}, orologio = Date.now, fetch = globalThis.fetch, casuale = Math.random, pianifica = setTimeout, timeoutScaricoMs = LIMITI_IMMAGINI.timeoutMs, timeoutCaricoMs = 60_000, maxCoda = LIMITI_IMMAGINI.maxCoda }) {
  const L = LIMITI_IMMAGINI;
  const coda = join(cartella, "coda");
  for (const d of [cartella, coda]) {
    mkdirSync(d, { recursive: true, mode: 0o700 });
    try {
      chmodSync(d, 0o700);
    } catch {
      // cartella non nostra: si va avanti
    }
  }

  /** nome del file → lavoro (la verità è su disco; qui la copia per non rileggerla) */
  const indice = new Map();
  const conti = { ok: 0, scadute: 0, errori: 0, tetto: 0, scartate: 0, coda_piena: 0 };
  let partiti = [];
  let sospesoFino = 0;
  let guastiServer = 0;
  let avviato = false;
  let fermato = false;
  let corso = null;
  let rilascia = null;

  const fileDi = (nome) => join(coda, nome);
  const scadutoIl = (ts) => ts * 1000 + L.giorni * GIORNO_MS;

  function togli(nome) {
    indice.delete(nome);
    rmSync(fileDi(nome), { force: true });
  }

  /** Riscrive il file di un lavoro (conto dei guasti, attesa, `caricato`). Un disco che non scrive non ferma il ciclo. */
  function salva(nome, lavoro) {
    try {
      scrivi(fileDi(nome), lavoro);
    } catch {
      registro("immagini_disco_non_scrivibile");
    }
  }

  // Al riavvio: la coda su disco riprende. Corrotti, manomessi, di nome strano, resti `.tmp`: via.
  let corrotti = 0;
  let nomi = [];
  try {
    nomi = readdirSync(coda);
  } catch {
    registro("immagini_coda_illeggibile");
  }
  for (const nome of nomi) {
    if (nome.includes(".tmp-")) {
      rmSync(fileDi(nome), { force: true });
      continue;
    }
    let lavoro = null;
    if (FILE_CODA.test(nome)) {
      try {
        lavoro = lavoroValido(nome, JSON.parse(readFileSync(fileDi(nome), "utf8")));
      } catch {
        lavoro = null;
      }
    }
    if (!lavoro) {
      rmSync(fileDi(nome), { force: true });
      corrotti++;
    } else if (orologio() > scadutoIl(lavoro.ts)) {
      rmSync(fileDi(nome), { force: true });
      conti.scadute++;
    } else indice.set(nome, lavoro);
  }
  if (corrotti) registro("immagini_coda_corrotta", { file: corrotti });

  const pausa = (ms) =>
    new Promise((ok) => {
      rilascia = ok;
      pianifica(() => {
        rilascia = null;
        ok();
      }, Math.max(0, ms));
    });

  /** Il CRM non è pronto (Worker vecchio, migrazione mancante, chiave, rete, risposta storta): il lavoro RESTA, il ciclo dorme. */
  function serverNonPronto(http) {
    registro("immagini_server_non_pronto", { http: http ?? 0 });
    sospesoFino = orologio() + L.attese[Math.min(guastiServer++, L.attese.length - 1)];
    return { tipo: "sospeso" };
  }

  /** Un guasto di QUESTO lavoro (download o PUT): attese crescenti, al quinto tentativo scartato. */
  function guasto(nome, lavoro) {
    lavoro.guasti++;
    if (lavoro.guasti >= L.tentativi) {
      conti.errori++;
      togli(nome);
      return;
    }
    lavoro.prossimo_il = orologio() + L.attese[Math.min(lavoro.guasti - 1, L.attese.length - 1)];
    salva(nome, lavoro);
  }

  /** Scarica e rimette insieme l'immagine. Mai oltre il tetto, mai oltre il timeout (c.1 punti 2-4).
   *  `{ ok: true, dati }` | `{ ok: false, esito: "scaduta" | "troppo_grande" | "guasto" }`. */
  async function scaricaProtetto(lavoro) {
    //  La COPIA: solo mediaKey e directPath. L'host lo fissiamo noi.
    const copia = { mediaKey: Buffer.from(lavoro.mediaKey, "base64"), directPath: lavoro.directPath };
    const limite = Math.floor(L.maxByte * L.tolleranza);
    let aperto = null;
    let chiuso = false;
    let timer;
    const distruggi = (f) => {
      try {
        f?.destroy?.();
      } catch {
        // già chiuso
      }
    };
    const lettura = (async () => {
      const f = await scarica(copia, "image", { host: lavoro.host });
      if (chiuso) {
        //  arrivato dopo il timeout: nessuno lo leggerà
        distruggi(f);
        return null;
      }
      aperto = f;
      const pezzi = [];
      let totale = 0;
      for await (const pezzo of f) {
        if (!(pezzo instanceof Uint8Array)) throw new ErroreImmagine("flusso_non_valido");
        totale += pezzo.length;
        if (totale > limite) throw new ErroreImmagine("troppo_grande");
        pezzi.push(pezzo);
      }
      return Buffer.concat(pezzi, totale);
    })();
    lettura.catch(() => {});
    //  Un flusso fermo non produce pezzi: il timeout NON può stare dentro il ciclo di lettura.
    const scadenza = new Promise((_, no) => {
      timer = setTimeout(() => no(new ErroreImmagine("timeout")), timeoutScaricoMs);
    });
    try {
      const dati = await Promise.race([lettura, scadenza]);
      return dati ? { ok: true, dati } : { ok: false, esito: "guasto" };
    } catch (errore) {
      if (errore instanceof ErroreImmagine) return { ok: false, esito: errore.codice === "troppo_grande" ? "troppo_grande" : "guasto" };
      const stato = statoDi(errore);
      return { ok: false, esito: stato === 404 || stato === 410 ? "scaduta" : "guasto" };
    } finally {
      chiuso = true;
      clearTimeout(timer);
      distruggi(aperto);
    }
  }

  /** PUT dei byte sull'URL di carico: lo stato HTTP, o null se la rete non risponde. Nessun redirect. */
  async function caricaSuStorage(urlCarico, dati, mime) {
    try {
      const r = await fetch(urlCarico, { method: "PUT", headers: { "Content-Type": mime, "x-upsert": "false" }, body: dati, redirect: "error", signal: AbortSignal.timeout(timeoutCaricoMs) });
      try {
        await r.body?.cancel();
      } catch {
        // niente da liberare
      }
      return r.status;
    } catch {
      return null;
    }
  }

  /** Il lavoro intero. Restituisce `{ tipo }`: `fatto`, `scarta` (+ `conto`), `sospeso` (il CRM non è pronto), `guasto`. */
  async function processa(nome, lavoro) {
    if (!lavoro.caricato) {
      const p = await spedisci({ url, token, corpo: { v: 1, tipo: "media_permesso", chiave: lavoro.chiave, mime: lavoro.mime, byte: lavoro.byte }, fetch });
      const risposta = p.corpo;
      if (p.stato !== 200 || risposta?.ok !== true) return serverNonPronto(p.stato);
      guastiServer = 0;
      if (risposta.esito === "gia_presente") return { tipo: "scarta", conto: "scartate" };
      if (risposta.esito === "rifiutato") {
        if (risposta.motivo === "spenta") {
          registro("immagini_spente");
          sospesoFino = orologio() + L.pausaSpentaMs;
          return { tipo: "sospeso" };
        }
        if (risposta.motivo === "tetto") {
          conti.tetto++;
          registro("immagini_tetto_pieno");
          sospesoFino = orologio() + L.pausaTettoMs;
          return { tipo: "sospeso" };
        }
        if (risposta.motivo === "troppo_grande" || risposta.motivo === "tipo") return { tipo: "scarta", conto: "scartate" };
        return serverNonPronto(p.stato);
      }
      const urlCarico = risposta.esito === "carica" ? urlCaricoValido(risposta.url_carico) : null;
      if (!urlCarico) {
        registro("immagini_url_carico_non_valido");
        return serverNonPronto(p.stato);
      }

      const d = await scaricaProtetto(lavoro);
      if (!d.ok) {
        if (d.esito === "scaduta") return { tipo: "scarta", conto: "scadute" };
        if (d.esito === "troppo_grande") return { tipo: "scarta", conto: "scartate" };
        return { tipo: "guasto" };
      }
      if (d.dati.length > L.maxByte || tipoDaByte(d.dati) !== lavoro.mime) return { tipo: "scarta", conto: "scartate" };

      const stato = await caricaSuStorage(urlCarico, d.dati, lavoro.mime);
      //  409: l'oggetto c'è già (un PUT precedente è andato e la risposta si è persa): si passa al «fatto», che ne legge il peso.
      if (!(stato !== null && ((stato >= 200 && stato < 300) || stato === 409))) return { tipo: "guasto" };
      lavoro.caricato = true;
      salva(nome, lavoro);
    }

    const f = await spedisci({ url, token, corpo: { v: 1, tipo: "media_fatto", chiave: lavoro.chiave }, fetch });
    if (f.stato !== 200 || f.corpo?.ok !== true) return serverNonPronto(f.stato);
    guastiServer = 0;
    return { tipo: "fatto" };
  }

  /** Un lavoro, dall'inizio all'esito. Non lancia mai. Restituisce `true` se ha lavorato davvero (poi la pausa di cortesia). */
  async function lavora(nome) {
    const lavoro = indice.get(nome);
    let esito;
    try {
      esito = await processa(nome, lavoro);
    } catch {
      registro("immagini_lavoro_fallito");
      esito = { tipo: "guasto" };
    }
    if (esito.tipo === "fatto") {
      conti.ok++;
      togli(nome);
    } else if (esito.tipo === "scarta") {
      conti[esito.conto]++;
      togli(nome);
    } else if (esito.tipo === "guasto") guasto(nome, lavoro);
    return esito.tipo !== "sospeso";
  }

  /** Il ciclo: lavori uno alla volta, vecchi per primi (scadono prima); esce a coda vuota o fermato. */
  async function ciclo() {
    while (!fermato) {
      const adesso = orologio();
      for (const [nome, lavoro] of indice) {
        if (adesso > scadutoIl(lavoro.ts)) {
          togli(nome);
          conti.scadute++;
        }
      }
      if (indice.size === 0) return;
      if (sospesoFino > adesso) {
        await pausa(sospesoFino - adesso);
        continue;
      }
      partiti = partiti.filter((t) => adesso - t < ORA_MS);
      if (partiti.length >= L.allOra) {
        await pausa(partiti[0] + ORA_MS - adesso);
        continue;
      }
      let scelto = null;
      let piuVicino = Infinity;
      for (const [nome, lavoro] of indice) {
        if (lavoro.prossimo_il <= adesso) {
          if (!scelto || lavoro.ts < indice.get(scelto).ts) scelto = nome;
        } else piuVicino = Math.min(piuVicino, lavoro.prossimo_il);
      }
      if (!scelto) {
        await pausa(piuVicino - adesso);
        continue;
      }
      partiti.push(adesso);
      const lavorato = await lavora(scelto);
      if (lavorato && !fermato && indice.size > 0) await pausa(L.pausaMinMs + Math.floor(casuale() * (L.pausaMaxMs - L.pausaMinMs)));
    }
  }

  function sveglia() {
    if (fermato) return Promise.resolve();
    if (corso) return corso;
    corso = ciclo()
      .catch(() => registro("immagini_ciclo_fallito"))
      .finally(() => {
        corso = null;
      });
    return corso;
  }

  return {
    /** Mette in coda un'immagine. Non scarica e non chiede niente: scrive un file e sveglia il ciclo. */
    accoda(richiesta) {
      const { chiave, immagine, ts } = richiesta ?? {};
      if (typeof chiave !== "string" || !CHIAVE_VALIDA.test(chiave) || !Number.isInteger(ts) || ts < 1) return { ok: false, motivo: "non_valido" };
      const scarta = (motivo) => {
        conti.scartate++;
        return { ok: false, motivo };
      };
      const origine = validaOrigine(immagine);
      if (!origine.ok) return scarta(origine.motivo);
      const mime = mimeDi(immagine.mimetype);
      if (!mime) return scarta("tipo");
      const byte = interoDa(immagine.fileLength);
      if (!Number.isInteger(byte) || byte < 1) return scarta("peso_non_valido");
      if (byte > L.maxByte) return scarta("troppo_grande");
      const nome = nomeDi(chiave);
      if (indice.has(nome)) return { ok: false, motivo: "gia_in_coda" };
      if (orologio() > scadutoIl(ts)) return scarta("vecchia");
      if (indice.size >= maxCoda) {
        conti.coda_piena++;
        return { ok: false, motivo: "coda_piena" };
      }
      const lavoro = { v: 1, chiave, mediaKey: origine.mediaKey.toString("base64"), directPath: origine.directPath, host: origine.host, mime, byte, ts, guasti: 0, prossimo_il: 0 };
      try {
        scrivi(fileDi(nome), lavoro);
      } catch {
        registro("immagini_disco_non_scrivibile");
        return { ok: false, motivo: "disco" };
      }
      indice.set(nome, lavoro);
      if (avviato && !fermato) void sveglia();
      return { ok: true };
    },
    /** All'avvio del ponte: riprende la coda rimasta su disco. */
    avvia() {
      avviato = true;
      return sveglia();
    },
    sveglia,
    /** SIGTERM: il ciclo esce appena può; ritorna quando ha finito. */
    ferma() {
      fermato = true;
      rilascia?.();
      return corso ?? Promise.resolve();
    },
    /** Solo numeri, per la riga `immagini` del registro. */
    contatori: () => ({ ...conti, in_coda: indice.size }),
  };
}
