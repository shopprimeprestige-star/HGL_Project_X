/** ── PONTE WHATSAPP · I MEDIA (origine, download protetto, coda, «Mostra») ────
 *
 *  Il nome è quello della commessa 2026-10-30 (le foto); da 2026-10-31-media-e-archiviazione, compito T6
 *  (PIANO a.1, a.3, a.5, c2.2, c2.3) gestisce TUTTI i media: foto, vocali/audio, video, documenti.
 *  Un media arrivato (vivo o dallo storico) entra nel CATALOGO (`catalogo.mjs`, T5); se la categoria è
 *  automatica e il messaggio è abbastanza recente è anche IN CODA (stato `in_coda` dello stesso record).
 *  Un ciclo prende un lavoro alla volta, chiede il permesso al CRM (`media_permesso`), lo scarica da
 *  WhatsApp, lo carica su Storage con l'URL monouso che il CRM ha dato e chiude con `media_fatto`.
 *  Il Worker non vede mai i byte e sul Mac non c'è nessuna chiave di Supabase.
 *
 *  Questo file NON importa Baileys e NON tocca il socket: riceve `scarica` (= `downloadContentFromMessage`)
 *  da `index.mjs` (compito T7).
 *
 *  ⚠️ SICUREZZA DEL DOWNLOAD (c.1). I campi `url`/`directPath` di un messaggio media li scrive CHI SCRIVE
 *   AL NUMERO; in Baileys rc14 `downloadContentFromMessage` prende l'host da lì e la sua `fetch` non ha né
 *   timeout né limite di byte. Quindi:
 *    1. `validaOrigine` PRIMA di ogni richiesta: `mediaKey` di 32 byte, `directPath` che comincia con `/`
 *       (mai `//`, `..`, `\`, spazi), `url` (se c'è) `https:` con host `*.whatsapp.net` letto con
 *       `new URL().hostname`, senza utente, password, porta. Altrimenti il messaggio è scartato, senza
 *       ripiego sul `directPath`;
 *    2. a Baileys va una COPIA NUOVA `{ mediaKey, directPath }` (mai `url`, mai l'oggetto del messaggio),
 *       `{ host }` deciso da noi e il tipo preso da `TIPO_BAILEYS` (quello del MESSAGGIO, non del mime:
 *       la chiave di decifratura dipende dal tipo del messaggio);
 *    3. il flusso si legge a pezzi con un tetto (peso massimo della categoria + 10 %) e un timeout della
 *       categoria fatto con `Promise.race` e un timer: un flusso fermo non produce pezzi e un controllo
 *       dentro il ciclo di lettura non scatterebbe mai;
 *    4. l'errore di Baileys contiene l'`url` (`Failed to fetch stream from …`): NON si legge, NON si
 *       registra. Se ne estrae solo `status` (404/410 = scaduta). Nel registro: parole fisse e numeri.
 *   `downloadMediaMessage`, `updateMediaMessage`, `reuploadRequest`, `requestPlaceholderResend` sono vietati
 *   in tutto il servizio: il ponte resta in sola lettura verso WhatsApp.
 *  ⚠️ Il TIPO lo decidono i byte (D2): `firma.mjs` li legge dopo il download; il PUT parte con il
 *   `Content-Type` dei byte; se non sono della categoria del messaggio il file si scarta.
 *  ⚠️ Nel catalogo (cartella 700, file 600, accanto ad `auth/`) ci sono la chiave `bw:<numero>:<id>` e la
 *   chiave del media. Nessun `console.*`: i codici del registro sono parole fisse.
 *
 *  Lavoro AUTOMATICO (la tabella di c.2, nessun media si butta per un guasto passeggero):
 *    download 404/410 (scaduta), `troppo_grande`, `tipo` → scartato anche dal catalogo (non si potrà mai mostrare);
 *    `gia_presente`, `liberato`, `manuale` → esce dalla coda, RESTA nel catalogo (per «Mostra»);
 *    `spenta` (1 ora) e `tetto` (30 minuti) → resta, il ciclo dorme (per gli automatici);
 *    400/401/429/503/5xx, rete, risposta storta → resta, il ciclo dorme 5 min → 15 min → 1 h → 3 h;
 *    download o PUT che falliscono → resta con attese 5 min → 15 min → 1 h → 3 h, al quinto tentativo
 *      esce dalla coda (`errori`) e resta nel catalogo.
 *  Lavoro RICHIESTO («Mostra», c2.2–c2.3): UN SOLO tentativo, passa avanti a tutto e ignora età, `auto`, pause e
 *   tetti orari; qualunque ostacolo chiude subito con `media_esito` (`scaduta` per 403/404/410, `tetto`,
 *   `spenta`, `troppo_grande`, `tipo`, `errore`) e non si ritenta. Non dorme mai.
 *
 *  shortcut: il limite di 600 lavori e 1 GiB all'ora è in memoria (un riavvio lo azzera, ma le pause di 2–5 s
 *  restano); da salvare su disco solo se `ponte-wa` si riavvia spesso.
 *  shortcut: le categorie automatiche si imparano dal battito; finché il Worker non ha risposto (o se è
 *  vecchio) valgono le sole foto e gli altri media vanno solo nel catalogo, poi «Mostra»; non c'è una
 *  ripassata che li metta in coda dopo: si aggiunge se il titolare vede vocali mancanti dopo un riavvio.
 *  shortcut: i lavori «richiesti» stanno in memoria; un riavvio li perde, ma il CRM li riassegna dopo 10 minuti.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { creaCatalogo } from "./catalogo.mjs";
import { interoDa } from "./estrai.mjs";
import { mimeDaByte, normalizzaMime } from "./firma.mjs";
import { spedisci } from "./lotti.mjs";

const MIB = 1024 * 1024;

/** Peso massimo, tempo di scarico (download + lettura) e giorni di età per il download AUTOMATICO, per categoria
 *  (PIANO a.1). Il peso è anche il limite del bucket `ponte-media`; copia di `media-tipi.ts` (la parità la prova T11). */
export const LIMITI_MEDIA = {
  foto: { maxByte: 8 * MIB, timeoutMs: 30_000, giorni: 14 },
  audio: { maxByte: 16 * MIB, timeoutMs: 60_000, giorni: 14 },
  video: { maxByte: 45 * MIB, timeoutMs: 240_000, giorni: 7 },
  documento: { maxByte: 25 * MIB, timeoutMs: 90_000, giorni: 14 },
};

/** Il tipo che `downloadContentFromMessage` vuole per ogni categoria: le uniche quattro voci ammesse. */
export const TIPO_BAILEYS = {
  foto: "image",
  audio: "audio",
  video: "video",
  documento: "document",
};

export const LIMITI_IMMAGINI = {
  /** il flusso si legge fino a maxByte × tolleranza, poi si distrugge */
  tolleranza: 1.1,
  maxCoda: 5000,
  allOra: 600,
  /** i byte dei lavori automatici partiti nell'ultima ora (oltre ai 600 lavori) */
  allOraByte: 1024 * MIB,
  pausaMinMs: 2000,
  pausaMaxMs: 5000,
  attese: [300_000, 900_000, 3_600_000, 10_800_000],
  tentativi: 5,
  pausaSpentaMs: 3_600_000,
  /** era 6 ore: ora un tetto liberato dal titolare si ritrova in mezz'ora (e «Mostra» non aspetta mai) */
  pausaTettoMs: 1_800_000,
  /** dopo un blocco di storico gli automatici aspettano: un nuovo storico non deve riempire il tetto */
  pausaDopoStoricoMs: 600_000,
  /** chiavi che «Mostra» prende dal CRM in una volta */
  maxRichieste: 5,
  hostDiSerie: "mmg.whatsapp.net",
};

const ORA_MS = 3_600_000;
const GIORNO_MS = 86_400_000;
const HOST_WHATSAPP = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.whatsapp\.net$/;
/** un solo quantificatore su una classe: nessun giro lungo (c'è anche il tetto di 1024) */
const PERCORSO_VALIDO = /^\/(?!\/)[A-Za-z0-9._~\-/?=&%+]*$/;
const CHIAVE_VALIDA = /^bw:\d{8,15}:[A-Za-z0-9_.-]{1,128}$/;
const FILE_CODA = /^[0-9a-f]{64}\.json$/;
const STORAGE_PERCORSO = "/storage/v1/object/upload/sign/ponte-media/";
const HOST_STORAGE = /^[a-z0-9-]+(\.storage)?\.supabase\.co$/;

const oggetto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

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

/** Controlla l'origine di un messaggio media (`imageMessage`, `audioMessage`…) PRIMA di qualunque richiesta (c.1 punto 1).
 *  `{ ok: true, mediaKey: Buffer(32), directPath, host }` oppure
 *  `{ ok: false, motivo: "origine_non_valida" }`. L'`url` non si usa mai per
 *  scaricare: serve solo a scegliere l'host (altrimenti `mmg.whatsapp.net`). */
export function validaOrigine(messaggio) {
  const no = { ok: false, motivo: "origine_non_valida" };
  if (!oggetto(messaggio)) return no;
  const k = messaggio.mediaKey;
  if (!(Buffer.isBuffer(k) || k instanceof Uint8Array) || k.length !== 32) return no;
  if (!percorsoValido(messaggio.directPath)) return no;
  let host = LIMITI_IMMAGINI.hostDiSerie;
  if (messaggio.url !== undefined && messaggio.url !== null && messaggio.url !== "") {
    host = hostDaUrl(messaggio.url);
    if (!host) return no;
  }
  return { ok: true, mediaKey: Buffer.from(k), directPath: messaggio.directPath, host };
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

class ErroreMedia extends Error {
  constructor(codice) {
    super(codice);
    this.codice = codice;
  }
}

/** L'impronta della chiave: il nome del file (il numero del cliente non sta nel nome). */
const nomeDi = (chiave) => `${createHash("sha256").update(chiave).digest("hex")}.json`;

/** Quando un messaggio esce dalla finestra del download AUTOMATICO (14 giorni, video 7). */
const scadutoIl = ({ ts, categoria }) => ts * 1000 + LIMITI_MEDIA[categoria].giorni * GIORNO_MS;

/** Il corpo di `media_permesso`: i dettagli della bolla viaggiano solo se ci sono; `richiesto` solo per «Mostra». */
const corpoPermesso = (v, richiesto) => ({
  v: 1,
  tipo: "media_permesso",
  chiave: v.chiave,
  mime: v.mime,
  byte: v.byte,
  ...(richiesto ? { richiesto: true } : {}),
  ...Object.fromEntries(["nome", "durata_s", "larghezza", "altezza", "miniatura"].filter((k) => v[k] !== undefined).map((k) => [k, v[k]])),
});

/** Quello che mandava `collega.mjs` finché c'era solo la foto, `{ chiave, ts, immagine }`, e quello di `mediaDa`
 *  (`estrai.mjs`), `{ chiave, ts, categoria, media, dettagli }`: tutte e due → `{ categoria, media, dettagli }`. */
function datiDi(r) {
  if (!oggetto(r)) return null;
  if (typeof r.categoria === "string" && Object.hasOwn(LIMITI_MEDIA, r.categoria)) return { categoria: r.categoria, media: r.media, dettagli: oggetto(r.dettagli) ? r.dettagli : {} };
  if (r.immagine === undefined) return null;
  const mime = normalizzaMime("foto", r.immagine?.mimetype);
  const byte = interoDa(r.immagine?.fileLength);
  return { categoria: "foto", media: r.immagine, dettagli: { ...(mime ? { mime } : {}), ...(byte !== null ? { byte } : {}) } };
}

/** I media.
 *
 *  `opzioni`: `url`, `token` (come i lotti); `cartella` (`immagini/`: ci si leggono, una volta, i lavori della coda
 *  `v: 1`); `catalogo` (quello di `creaCatalogo`, lo stesso di `collega.mjs`, in una cartella DEDICATA — di serie
 *  `media/catalogo`: il catalogo cancella i file che non riconosce; se manca ne crea uno in `<cartella>/catalogo`); `scarica` (= `downloadContentFromMessage` di Baileys: `(copia, tipo, { host })` → flusso);
 *  `registro`; `orologio`, `fetch`, `casuale`, `pianifica` (le prove li sostituiscono); `timeoutScaricoMs`
 *  (tutte le categorie; di serie quello della categoria), `timeoutCaricoMs` (di serie `max(60 s, byte/150 KB/s)`),
 *  `maxCoda`.
 *
 *  Uscita: `{ accoda, dopoBattito, dopoStorico, avvia, sveglia, ferma, contatori }`.
 *  `accoda(richiesta)` → `{ ok: true, in_coda: boolean }` | `{ ok: false, motivo }` (non lancia mai). `richiesta` = l'uscita
 *  di `mediaDa`; `in_coda: false` = solo nel catalogo (categoria non automatica, troppo vecchio per l'automatico):
 *  si potrà mostrare con «Mostra». `dopoBattito(corpo)`: la risposta del battito (`media_v`, `media_auto`,
 *  `media_richieste`) — impara le categorie automatiche e, con richieste, azzera le pause e prende le chiavi.
 *  `dopoStorico()`: gli automatici aspettano 10 minuti. `avvia()` e `sveglia()` restituiscono la promessa del
 *  ciclo (uno solo alla volta: un download alla volta). */
export function creaImmagini({ url, token, cartella, catalogo, scarica, registro = () => {}, orologio = Date.now, fetch = globalThis.fetch, casuale = Math.random, pianifica = setTimeout, timeoutScaricoMs, timeoutCaricoMs, maxCoda = LIMITI_IMMAGINI.maxCoda }) {
  const L = LIMITI_IMMAGINI;
  const proprio = !catalogo;
  catalogo ??= creaCatalogo({ cartella: join(cartella, "catalogo"), registro, orologio });
  //  Si accende subito: gli eventi del socket non devono trovare il catalogo spento (è idempotente).
  const pronto = catalogo.avvia().catch(() => registro("immagini_catalogo_non_avviato"));

  const conti = { ok: 0, scadute: 0, errori: 0, tetto: 0, scartate: 0, coda_piena: 0 };
  /** [orario, byte] dei lavori automatici partiti nell'ultima ora */
  let partiti = [];
  /** le categorie automatiche: finché il Worker non dice `media_v: 2` valgono le sole foto (D8) */
  let autoCat = new Set(["foto"]);
  let sospesoFino = 0;
  let storicoFino = 0;
  /** le chiavi di «Mostra» in attesa (in memoria: un riavvio le perde, il CRM le riassegna dopo 10 minuti) */
  const richiesti = [];
  /** risposte storte del CRM di fila (si azzera a ogni risposta buona); `ultimoBuono` e `primo`/`ultimo`
   *  dei lavori sono numeri d'ordine degli eventi (`ordine`), non orari: due eventi nello stesso millisecondo si distinguono. */
  let fallitiDiFila = 0;
  let ordine = 0;
  let ultimoBuono = 0;
  /** per lavoro: quante volte il CRM l'ha rifiutato in modo storto (400/5xx…), da quando, ultima volta; solo in memoria */
  const serverPerLavoro = new Map();
  let avviato = false;
  let fermato = false;
  let corso = null;
  let rilascia = null;
  let v1Letti = false;

  const casualePausa = () => L.pausaMinMs + Math.floor(casuale() * (L.pausaMaxMs - L.pausaMinMs));

  /** Una pausa che si può interrompere (`rilascia`): `ferma()` e un battito con richieste la svegliano. */
  const pausa = (ms) =>
    new Promise((ok) => {
      const fine = () => {
        if (rilascia === fine) rilascia = null;
        ok();
      };
      rilascia = fine;
      pianifica(fine, Math.max(0, ms));
    });

  /** Il lavoro lascia la coda ma RESTA nel catalogo (per «Mostra»), senza guasti né attese: il record si riscrive pulito. */
  function inCatalogo(voce) {
    serverPerLavoro.delete(voce.chiave);
    catalogo.togli(voce.chiave);
    catalogo.aggiungi({ ...voce, stato: "catalogato", guasti: undefined, prossimo_il: undefined, caricato: undefined, richiesto: undefined });
  }

  /** Il lavoro lascia la coda E il catalogo: non c'è più nulla da riprovare né da mostrare. */
  function dimentica(chiave) {
    serverPerLavoro.delete(chiave);
    catalogo.togli(chiave);
  }

  /** Il CRM ha risposto bene (200 + ok): la rete e il Worker funzionano. */
  function serverVivo() {
    fallitiDiFila = 0;
    ultimoBuono = ++ordine;
  }

  /** Il CRM non è pronto (Worker vecchio, migrazione mancante, chiave, rete, risposta storta): il lavoro RESTA.
   *  Il lavoro aspetta 5 min → 15 min → 1 h → 3 h; solo dalla seconda risposta storta di fila dorme anche
   *  tutto il ciclo (un CRM giù). Un lavoro che prende 5 risposte storte mentre il CRM risponde bene agli
   *  altri (almeno una buona fra la quarta e la quinta) è lui il problema: esce dalla coda (`errori`), così non
   *  blocca le altre. Un CRM giù per tutti non scarta niente. */
  function serverNonPronto(voce, http) {
    registro("immagini_server_non_pronto", { http: http ?? 0 });
    const adesso = orologio();
    fallitiDiFila++;
    const attesa = L.attese[Math.min(fallitiDiFila - 1, L.attese.length - 1)];
    const prima = serverPerLavoro.get(voce.chiave);
    const s = prima ?? { n: 0, primo: ++ordine, ultimo: 0 };
    s.n++;
    const serverRispondeBene = ultimoBuono > s.primo && ultimoBuono > s.ultimo;
    s.ultimo = ++ordine;
    serverPerLavoro.set(voce.chiave, s);
    if (s.n >= L.tentativi && serverRispondeBene) return { tipo: "scarta", conto: "errori", tieni: true };
    catalogo.imposta(voce.chiave, { prossimo_il: adesso + attesa });
    if (fallitiDiFila >= 2) sospesoFino = adesso + attesa;
    return { tipo: "sospeso" };
  }

  /** Un guasto di QUESTO lavoro (download o PUT): attese crescenti, al quinto tentativo esce dalla coda. */
  function guasto(voce, azzeraCaricato) {
    const guasti = (voce.guasti ?? 0) + 1;
    if (guasti >= L.tentativi) {
      conti.errori++;
      inCatalogo(voce);
      return;
    }
    const prossimo_il = orologio() + L.attese[Math.min(guasti - 1, L.attese.length - 1)];
    if (azzeraCaricato) {
      //  `imposta` non sa togliere `caricato`: si riscrive il record
      catalogo.togli(voce.chiave);
      catalogo.aggiungi({ ...voce, guasti, prossimo_il, caricato: undefined });
    } else catalogo.imposta(voce.chiave, { guasti, prossimo_il });
  }

  /** Scarica e rimette insieme il media. Mai oltre il tetto della categoria, mai oltre il suo timeout (c.1 punti 2-4).
   *  `{ ok: true, dati }` | `{ ok: false, esito: "troppo_grande" | "guasto", stato }` (`stato` = HTTP, se Baileys ne ha dato uno). */
  async function scaricaProtetto(lavoro) {
    //  La COPIA: solo mediaKey e directPath. L'host lo fissiamo noi.
    const copia = { mediaKey: Buffer.from(lavoro.mediaKey), directPath: lavoro.directPath };
    const limite = Math.floor(LIMITI_MEDIA[lavoro.categoria].maxByte * L.tolleranza);
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
      const f = await scarica(copia, TIPO_BAILEYS[lavoro.categoria], { host: lavoro.host });
      if (chiuso) {
        //  arrivato dopo il timeout: nessuno lo leggerà
        distruggi(f);
        return null;
      }
      aperto = f;
      const pezzi = [];
      let totale = 0;
      for await (const pezzo of f) {
        if (!(pezzo instanceof Uint8Array)) throw new ErroreMedia("flusso_non_valido");
        totale += pezzo.length;
        if (totale > limite) throw new ErroreMedia("troppo_grande");
        pezzi.push(pezzo);
      }
      return Buffer.concat(pezzi, totale);
    })();
    lettura.catch(() => {});
    //  Un flusso fermo non produce pezzi: il timeout NON può stare dentro il ciclo di lettura.
    const scadenza = new Promise((_, no) => {
      timer = setTimeout(() => no(new ErroreMedia("timeout")), timeoutScaricoMs ?? LIMITI_MEDIA[lavoro.categoria].timeoutMs);
    });
    try {
      const dati = await Promise.race([lettura, scadenza]);
      return dati ? { ok: true, dati } : { ok: false, esito: "guasto", stato: null };
    } catch (errore) {
      if (errore instanceof ErroreMedia) return { ok: false, esito: errore.codice === "troppo_grande" ? "troppo_grande" : "guasto", stato: null };
      return { ok: false, esito: "guasto", stato: statoDi(errore) };
    } finally {
      chiuso = true;
      clearTimeout(timer);
      distruggi(aperto);
    }
  }

  /** I byte scaricati: dentro il peso della categoria e DELLA categoria (D2). `{ mime }` (quello dei byte) | `{ motivo }`. */
  function verificaByte(lavoro, dati) {
    if (dati.length > LIMITI_MEDIA[lavoro.categoria].maxByte) return { motivo: "troppo_grande" };
    //  `mimeDaByte` risponde solo con un mime della categoria del messaggio: un video che dentro è un vocale, o
    //  uno ZIP rinominato .pdf, è null. Dentro la famiglia vince il tipo vero (png dichiarato jpeg → image/png).
    const mime = mimeDaByte(lavoro.categoria, dati, { nome: lavoro.nome });
    return mime ? { mime } : { motivo: "tipo" };
  }

  /** PUT dei byte sull'URL di carico: lo stato HTTP, o null se la rete non risponde. Nessun redirect. */
  async function caricaSuStorage(urlCarico, dati, mime) {
    try {
      const attesaMs = timeoutCaricoMs ?? Math.max(60_000, Math.ceil(dati.length / 150_000) * 1000);
      const r = await fetch(urlCarico, { method: "PUT", headers: { "Content-Type": mime, "x-upsert": "false" }, body: dati, redirect: "error", signal: AbortSignal.timeout(attesaMs) });
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
  /** 409: l'oggetto c'è già (un PUT precedente è andato e la risposta si è persa): si passa al «fatto», che ne legge il peso. */
  const putRiuscito = (stato) => stato !== null && ((stato >= 200 && stato < 300) || stato === 409);

  /** Il lavoro AUTOMATICO intero. Restituisce `{ tipo }`: `fatto`, `scarta` (+ `conto`, `tieni`), `sospeso` (il CRM non è pronto), `guasto`. */
  async function processa(voce) {
    if (!voce.caricato) {
      const p = await spedisci({ url, token, corpo: corpoPermesso(voce, false), fetch });
      const risposta = p.corpo;
      if (p.stato !== 200 || risposta?.ok !== true) return serverNonPronto(voce, p.stato);
      //  `serverVivo` solo quando la risposta è una di quelle previste: una risposta che non capiamo non prova che il CRM stia bene.
      if (risposta.esito === "gia_presente") {
        serverVivo();
        return { tipo: "scarta", conto: "scartate", tieni: true };
      }
      if (risposta.esito === "rifiutato") {
        if (risposta.motivo === "spenta") {
          serverVivo();
          registro("immagini_spente");
          sospesoFino = orologio() + L.pausaSpentaMs;
          return { tipo: "sospeso" };
        }
        if (risposta.motivo === "tetto") {
          serverVivo();
          conti.tetto++;
          registro("immagini_tetto_pieno");
          sospesoFino = orologio() + L.pausaTettoMs;
          return { tipo: "sospeso" };
        }
        if (risposta.motivo === "troppo_grande" || risposta.motivo === "tipo") {
          serverVivo();
          return { tipo: "scarta", conto: "scartate" };
        }
        //  liberato: il titolare l'ha liberato; manuale: la categoria non è automatica per il Worker. Resta per «Mostra».
        if (risposta.motivo === "liberato" || risposta.motivo === "manuale") {
          serverVivo();
          return { tipo: "scarta", conto: "scartate", tieni: true };
        }
        return serverNonPronto(voce, p.stato);
      }
      const urlCarico = risposta.esito === "carica" ? urlCaricoValido(risposta.url_carico) : null;
      if (!urlCarico) {
        registro("immagini_url_carico_non_valido");
        return serverNonPronto(voce, p.stato);
      }
      serverVivo();

      const d = await scaricaProtetto(voce);
      if (!d.ok) {
        if (d.stato === 404 || d.stato === 410) return { tipo: "scarta", conto: "scadute" };
        if (d.esito === "troppo_grande") return { tipo: "scarta", conto: "scartate" };
        return { tipo: "guasto" };
      }
      const vero = verificaByte(voce, d.dati);
      if (vero.motivo) return { tipo: "scarta", conto: "scartate" };

      if (!putRiuscito(await caricaSuStorage(urlCarico, d.dati, vero.mime))) return { tipo: "guasto" };
      catalogo.imposta(voce.chiave, { caricato: true });
    }

    const f = await spedisci({ url, token, corpo: { v: 1, tipo: "media_fatto", chiave: voce.chiave }, fetch });
    if (f.stato !== 200 || f.corpo?.ok !== true) return serverNonPronto(voce, f.stato);
    //  Il CRM risponde SEMPRE 200 e dice com'è andata: `pronta` (Storage ha l'oggetto), `in_caricamento` (non lo
    //  vede ancora), `assente` (nessun permesso per quella chiave), `tipo`/`troppo_grande` (l'oggetto non era
    //  buono: il Worker l'ha tolto). Chiuso solo con `pronta`; qualunque altra cosa (anche un esito che non
    //  conosciamo) è «non pronta»: il media non si butta.
    if (!["pronta", "in_caricamento", "assente", "tipo", "troppo_grande"].includes(f.corpo.esito)) return serverNonPronto(voce, f.stato);
    serverVivo();
    if (f.corpo.esito === "pronta") return { tipo: "fatto" };
    if (f.corpo.esito === "tipo" || f.corpo.esito === "troppo_grande") return { tipo: "scarta", conto: "scartate" };
    //  la riga di permesso non c'è più: si rifà il permesso da capo (stesso percorso)
    return { tipo: "guasto", azzeraCaricato: f.corpo.esito === "assente" };
  }

  /** Un lavoro automatico, dall'inizio all'esito. Non lancia mai. Restituisce `true` se ha lavorato davvero (poi la pausa di cortesia). */
  async function lavora(voce) {
    let esito;
    try {
      esito = await processa(voce);
    } catch {
      registro("immagini_lavoro_fallito");
      esito = { tipo: "guasto" };
    }
    if (esito.tipo === "fatto") {
      conti.ok++;
      inCatalogo(voce);
    } else if (esito.tipo === "scarta") {
      conti[esito.conto]++;
      if (esito.tieni) inCatalogo(voce);
      else dimentica(voce.chiave);
    } else if (esito.tipo === "guasto") guasto(voce, esito.azzeraCaricato);
    return esito.tipo !== "sospeso";
  }

  /** «Mostra»: UN SOLO tentativo (c2.3). Qualunque ostacolo chiude subito con `media_esito`; niente catena di ritentativi,
   *  niente attese. Se nemmeno l'esito arriva, il lavoro si lascia: il CRM riassegna la richiesta dopo 10 minuti.
   *  Non lancia mai. Restituisce `true` se ha scaricato davvero (poi la pausa di cortesia). */
  async function lavoraRichiesto(chiave) {
    const esito = async (motivo) => {
      const r = await spedisci({ url, token, corpo: { v: 1, tipo: "media_esito", chiave, esito: motivo }, fetch });
      if (r.stato !== 200 || r.corpo?.ok !== true) registro("immagini_esito_non_arrivato");
    };
    const voce = catalogo.leggi(chiave);
    if (!voce) {
      await esito("non_catalogato");
      return false;
    }
    let scaricato = false;
    //  `media_fatto` e il suo esito: il Worker chiude la richiesta (e imposta il timer) solo da qui. `caricato`: l'abbiamo
    //  messo noi in Storage (conta come `ok`); con `gia_presente` no.
    const concludi = async (caricato) => {
      const f = await spedisci({ url, token, corpo: { v: 1, tipo: "media_fatto", chiave }, fetch });
      if (f.stato === 200 && f.corpo?.ok === true && f.corpo.esito === "pronta") {
        if (caricato) conti.ok++;
        //  se era anche un lavoro automatico, ora è fatto
        if (voce.stato === "in_coda") inCatalogo(voce);
      } else if (f.stato === 200 && f.corpo?.ok === true && (f.corpo.esito === "tipo" || f.corpo.esito === "troppo_grande")) {
        dimentica(chiave);
        await esito(f.corpo.esito);
      } else await esito("errore");
    };
    try {
      const p = await spedisci({ url, token, corpo: corpoPermesso(voce, true), fetch });
      const risposta = p.corpo;
      if (p.stato !== 200 || risposta?.ok !== true) {
        await esito("errore");
        return false;
      }
      //  già presente: nessun download, ma il CRM va avvertito subito (`media_fatto`), altrimenti la richiesta resta `in_corso` e
      //  si riassegna ogni 10 minuti
      if (risposta.esito === "gia_presente") {
        await concludi(false);
        return false;
      }
      if (risposta.esito === "rifiutato") {
        const m = risposta.motivo;
        if (m === "troppo_grande" || m === "tipo") dimentica(chiave);
        await esito(["tetto", "spenta", "troppo_grande", "tipo"].includes(m) ? m : "errore");
        return false;
      }
      const urlCarico = risposta.esito === "carica" ? urlCaricoValido(risposta.url_carico) : null;
      if (!urlCarico) {
        registro("immagini_url_carico_non_valido");
        await esito("errore");
        return false;
      }

      scaricato = true;
      const d = await scaricaProtetto(voce);
      if (!d.ok) {
        //  403/404/410: il link `oe=` è scaduto (il caso tipico a 20–30 giorni); non si recupera
        if (d.stato === 403 || d.stato === 404 || d.stato === 410) {
          conti.scadute++;
          dimentica(chiave);
          await esito("scaduta");
        } else if (d.esito === "troppo_grande") {
          dimentica(chiave);
          await esito("troppo_grande");
        } else await esito("errore");
        return true;
      }
      const vero = verificaByte(voce, d.dati);
      if (vero.motivo) {
        dimentica(chiave);
        await esito(vero.motivo);
        return true;
      }
      if (!putRiuscito(await caricaSuStorage(urlCarico, d.dati, vero.mime))) {
        await esito("errore");
        return true;
      }
      await concludi(true);
      return true;
    } catch {
      registro("immagini_richiesta_fallita");
      await esito("errore");
      return scaricato;
    }
  }

  /** Il ciclo: prima le richieste del titolare, poi i lavori automatici uno alla volta, i più nuovi per primi; esce a coda vuota o fermato. */
  async function ciclo() {
    while (!fermato) {
      if (richiesti.length > 0) {
        const scaricato = await lavoraRichiesto(richiesti.shift());
        if (scaricato && !fermato && (richiesti.length > 0 || catalogo.conteggio().in_coda > 0)) await pausa(casualePausa());
        continue;
      }
      const adesso = orologio();
      const voci = [];
      for (const v of catalogo.voci("in_coda")) {
        if (adesso > scadutoIl(v)) {
          //  fuori dalla finestra automatica: lascia la coda, per «Mostra» c'è ancora il catalogo
          inCatalogo(v);
          conti.scadute++;
        } else voci.push(v);
      }
      if (voci.length === 0) return;
      const fermoFino = Math.max(sospesoFino, storicoFino);
      if (fermoFino > adesso) {
        await pausa(fermoFino - adesso);
        continue;
      }
      partiti = partiti.filter(([t]) => adesso - t < ORA_MS);
      if (partiti.length >= L.allOra) {
        await pausa(partiti[0][0] + ORA_MS - adesso);
        continue;
      }
      const pronti = voci.filter((v) => (v.prossimo_il ?? 0) <= adesso);
      if (pronti.length === 0) {
        await pausa(Math.min(...voci.map((v) => v.prossimo_il)) - adesso);
        continue;
      }
      const scelto = pronti.reduce((a, b) => (b.ts > a.ts ? b : a));
      //  Il tetto orario in byte: se questo lavoro lo supera, si aspetta che escano dall'ora i primi che bastano.
      let eccesso = partiti.reduce((somma, [, b]) => somma + b, scelto.byte) - L.allOraByte;
      if (eccesso > 0) {
        let quando = adesso;
        for (const [t, b] of partiti) {
          eccesso -= b;
          quando = t + ORA_MS;
          if (eccesso <= 0) break;
        }
        await pausa(quando - adesso);
        continue;
      }
      partiti.push([adesso, scelto.byte]);
      const lavorato = await lavora(scelto);
      if (lavorato && !fermato && catalogo.conteggio().in_coda > 0) await pausa(casualePausa());
    }
  }

  function sveglia() {
    if (fermato) return Promise.resolve();
    if (corso) return corso;
    corso = (async () => {
      //  Si parte in un tick successivo: `corso` è già assegnato se `accoda` richiama `sveglia` durante il primo giro (due cicli insieme = due download insieme).
      await Promise.resolve();
      try {
        //  Se qualcosa è arrivato mentre il ciclo finiva, `sveglia` ha trovato `corso` ancora acceso: si rigira, nello stesso passo in cui `corso` si spegne.
        do await ciclo();
        while (!fermato && (richiesti.length > 0 || catalogo.conteggio().in_coda > 0));
      } catch {
        registro("immagini_ciclo_fallito");
      } finally {
        corso = null;
      }
    })();
    return corso;
  }

  /** I lavori della coda di prima (`<cartella>/coda/*.json`, `v: 1`, solo foto) passano UNA volta nel catalogo
   *  (con i loro guasti e `caricato`) e il file vecchio si cancella. Il catalogo rilegge e ricontrolla tutto. */
  function leggiCodaV1() {
    if (v1Letti) return;
    v1Letti = true;
    const vecchia = join(cartella, "coda");
    let nomi = [];
    try {
      nomi = readdirSync(vecchia);
    } catch {
      return;
    }
    let scartati = 0;
    for (const nome of nomi) {
      //  Un guasto su UN file (una sottocartella, un permesso) non ferma gli altri né `avvia()`: quello che non è un nostro file resta dov'è.
      try {
        const percorso = join(vecchia, nome);
        let d = null;
        if (FILE_CODA.test(nome)) {
          try {
            d = JSON.parse(readFileSync(percorso, "utf8"));
          } catch {
            d = null;
          }
        }
        const buono = oggetto(d) && d.v === 1 && typeof d.chiave === "string" && nomeDi(d.chiave) === nome;
        const r = buono ? catalogo.aggiungi({ ...d, categoria: "foto", stato: "in_coda" }) : { ok: false };
        if (!r.ok) scartati++;
        rmSync(percorso, { force: true });
      } catch {
        scartati++;
      }
    }
    try {
      rmdirSync(vecchia);
    } catch {
      // non vuota: va bene così
    }
    if (scartati) registro("immagini_coda_vecchia_scartata", { file: scartati });
  }

  return {
    /** Mette un media nel catalogo e, se è automatico e recente, in coda. Non scarica e non chiede niente. */
    accoda(richiesta) {
      const { chiave, ts } = richiesta ?? {};
      const dati = datiDi(richiesta);
      if (!dati || typeof chiave !== "string" || !CHIAVE_VALIDA.test(chiave) || !Number.isInteger(ts) || ts < 1) return { ok: false, motivo: "non_valido" };
      const scarta = (motivo) => {
        conti.scartate++;
        return { ok: false, motivo };
      };
      const { categoria, media, dettagli } = dati;
      const origine = validaOrigine(media);
      if (!origine.ok) return scarta(origine.motivo);
      const mime = typeof dettagli.mime === "string" && normalizzaMime(categoria, dettagli.mime) === dettagli.mime ? dettagli.mime : null;
      if (!mime) return scarta("tipo");
      const byte = dettagli.byte;
      if (!Number.isInteger(byte) || byte < 1) return scarta("peso_non_valido");
      if (byte > LIMITI_MEDIA[categoria].maxByte) return scarta("troppo_grande");
      //  in coda solo se la categoria è automatica e il messaggio è dentro la finestra (14 giorni, video 7)
      const entra = autoCat.has(categoria) && orologio() <= scadutoIl({ ts, categoria });
      const pieno = entra && catalogo.conteggio().in_coda >= maxCoda;
      const r = catalogo.aggiungi({
        chiave,
        ts,
        categoria,
        mime,
        mediaKey: origine.mediaKey,
        directPath: origine.directPath,
        host: origine.host,
        stato: entra && !pieno ? "in_coda" : "catalogato",
        byte,
        nome: dettagli.nome,
        durata_s: dettagli.durata_s,
        larghezza: dettagli.larghezza,
        altezza: dettagli.altezza,
        miniatura: dettagli.miniatura,
        guasti: 0,
        prossimo_il: 0,
      });
      if (!r.ok) return r.motivo === "vecchia" ? scarta("vecchia") : { ok: false, motivo: r.motivo === "non_avviato" || r.motivo === "fermato" ? r.motivo : "non_valido" };
      if (r.gia) return entra ? { ok: false, motivo: "gia_in_coda" } : { ok: true, in_coda: false };
      if (pieno) {
        conti.coda_piena++;
        return { ok: false, motivo: "coda_piena" };
      }
      if (entra && avviato && !fermato) void sveglia();
      return { ok: true, in_coda: entra };
    },
    /** La risposta del battito (`media_v`, `media_auto`, `media_richieste`). Non lancia mai. */
    async dopoBattito(corpo) {
      try {
        if (!oggetto(corpo)) return;
        const v2 = Number.isInteger(corpo.media_v) && corpo.media_v >= 2;
        autoCat = new Set(v2 && Array.isArray(corpo.media_auto) ? corpo.media_auto.filter((k) => Object.hasOwn(LIMITI_MEDIA, k)) : ["foto"]);
        if (!Number.isInteger(corpo.media_richieste) || corpo.media_richieste < 1) return;
        //  «Mostra»: la pausa (tetto pieno, poi liberato; interruttore) si azzera subito e il ciclo si sveglia.
        sospesoFino = 0;
        const p = await spedisci({ url, token, corpo: { v: 1, tipo: "media_prendi", max: L.maxRichieste }, fetch });
        if (p.stato === 200 && p.corpo?.ok === true && Array.isArray(p.corpo.richieste)) {
          let nuove = 0;
          for (const r of p.corpo.richieste) {
            const k = r?.chiave;
            if (nuove >= L.maxRichieste || typeof k !== "string" || !CHIAVE_VALIDA.test(k) || richiesti.includes(k)) continue;
            richiesti.push(k);
            nuove++;
          }
        } else registro("immagini_prendi_fallito", { http: p.stato ?? 0 });
        rilascia?.();
        if (avviato && !fermato) void sveglia();
      } catch {
        registro("immagini_battito_fallito");
      }
    },
    /** Dopo un blocco di storico: gli automatici aspettano 10 minuti (le richieste no). */
    dopoStorico() {
      storicoFino = orologio() + L.pausaDopoStoricoMs;
    },
    /** All'avvio del ponte: riprende la coda rimasta nel catalogo (e le vecchie `coda/` v:1, una volta). */
    async avvia() {
      avviato = true;
      await pronto;
      leggiCodaV1();
      return sveglia();
    },
    sveglia,
    /** SIGTERM: il ciclo esce appena può e ciò che il catalogo ha in attesa si scrive; ritorna quando ha finito. */
    async ferma() {
      fermato = true;
      rilascia?.();
      await (corso ?? Promise.resolve());
      await catalogo.svuota();
      if (proprio) await catalogo.ferma();
    },
    /** Solo numeri, per la riga `immagini` del registro. */
    contatori: () => ({ ...conti, in_coda: catalogo.conteggio().in_coda }),
  };
}
