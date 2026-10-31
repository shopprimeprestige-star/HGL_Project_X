/** ── PROVE: IL SERVIZIO SUL MAC: LE IMMAGINI (origine, download protetto, coda su disco) ──
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T6 (PIANO c.1, c.2, c.3).
 *  Prova `strumenti/ponte-whatsapp/src/immagini.mjs` SENZA rete e senza Baileys:
 *  `scarica` (il `downloadContentFromMessage` di Baileys) e `fetch` sono finti;
 *  l'orologio e le pause sono finti (le pause fanno avanzare l'orologio).
 *  Il `fetch` finto FA FALLIRE la prova se riceve un indirizzo che non sia il
 *  ponte del CRM o l'URL di carico `https://*.supabase.co/storage/…/ponte-media/…`.
 *  Dati inventati: nessun numero né nome vero (prefisso 39 333 000…).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

const T0 = Date.UTC(2026, 9, 30, 12, 0, 0);
const TS = T0 / 1000 - 3600;
const GIORNO_S = 86_400;
const NUMERO = "393330000001";
const PONTE = "https://ponte.prova.test/api/public/ponte-whatsapp";
const CARICO = "https://abcdefgh.supabase.co/storage/v1/object/upload/sign/ponte-media/utente/percorso.jpg?token=SEGRETO";
const MIB = 1024 * 1024;
const permessi = (p) => statSync(p).mode & 0o777;

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 2)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBP"), Buffer.alloc(200, 3)]);

const OGG = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(200, 4)]);
const ftyp = (marca) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftyp"), Buffer.from(marca), Buffer.alloc(200, 5)]);
const MP4 = ftyp("isom");
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 6)]);
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(200, 8)]);
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** una miniatura JPEG in base64 (passa il CHECK della tabella) */
const MINI = "/9j/4AAQSkZJRg==";

const DIRECT = "/v/t62.7118-24/12345_67890.enc?ccb=11-4&oh=01_abc&oe=6720ABCD&_nc_sid=5e03e0";
/** Un `imageMessage` come lo dà Baileys 7. */
const img = (extra = {}) => ({ mimetype: "image/jpeg", mediaKey: Buffer.alloc(32, 7), directPath: DIRECT, url: "https://mmg.whatsapp.net/v/t62.7118-24/12345_67890.enc?ccb=11-4", fileLength: 4000, ...extra });
const chiave = (i) => `bw:${NUMERO}:ID${String(i).padStart(4, "0")}`;
const nomeFile = (k) => `${createHash("sha256").update(k).digest("hex")}.json`;

/** Un flusso che dà i pezzi e finisce. */
const flusso = (...pezzi) => Readable.from(pezzi);
/** Un flusso che non finisce mai (un estraneo che risponde con dati senza fine). */
const infinito = () => new Readable({ read() { this.push(Buffer.alloc(64 * 1024, 9)); } });
/** Un flusso fermo: non emette niente, non finisce. */
const fermo = () => new Readable({ read() {} });

/** Quello che fa Baileys rc14 (`messages-media.js:416-421`): l'host è `opts.host` oppure quello dell'`url`;
 *  con `directPath` si scarica da `https://<host><directPath>`, senza si scarica `url` così com'è. */
function scaricaStileBaileys(fetchFinto, corpo) {
  return async ({ mediaKey, directPath, url }, tipo, opts = {}) => {
    const dominio = (u) => { try { return new URL(u).host; } catch { return undefined; } };
    const host = opts.host ?? dominio(url);
    const indirizzo = directPath ? `https://${host ?? "mmg.whatsapp.net"}${directPath}` : url;
    await fetchFinto(indirizzo, { method: "GET" });
    return corpo();
  };
}

export async function provePonteServizioImmagini(_mod, { c, gruppo, radice }) {
  const src = join(radice, "strumenti/ponte-whatsapp/src");
  const I = await import(pathToFileURL(join(src, "immagini.mjs")).href);
  const K = await import(pathToFileURL(join(src, "catalogo.mjs")).href);
  const base = mkdtempSync(join(tmpdir(), "ponte-immagini-"));
  let n = 0;
  /** i cataloghi creati: a fine prova si svuotano (nessuna scrittura asincrona sopra una cartella cancellata) */
  const cataloghi = [];

  /** Un'istanza con tutto finto. `server` = risposte del CRM per tipo di richiesta. */
  async function nuovo(opz = {}) {
    const cartella = join(base, `i${n++}`);
    return montaSu(cartella, opz);
  }
  /** `opz.trattieni`: le pause non scattano da sole (le tiene `stato.trattenute`): serve a provare il risveglio. */
  async function montaSu(cartella, opz = {}) {
    const stato = { ora: opz.ora ?? T0, pause: [], chiamate: [], violazioni: [], log: [], scarichi: [], put: [], avvii: [], trattenute: [] };
    const server = {
      permesso: () => ({ stato: 200, corpo: { ok: true, esito: "carica", url_carico: CARICO } }),
      fatto: () => ({ stato: 200, corpo: { ok: true, esito: "pronta" } }),
      prendi: () => ({ stato: 200, corpo: { ok: true, richieste: [] } }),
      esito: () => ({ stato: 200, corpo: { ok: true } }),
      put: () => ({ status: 200 }),
      ...(opz.server ?? {}),
    };
    const risposte = { media_permesso: server.permesso, media_fatto: server.fatto, media_prendi: server.prendi, media_esito: server.esito };
    const fetchFinto = async (indirizzo, init = {}) => {
      const corpo = init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
      stato.chiamate.push({ url: String(indirizzo), metodo: init.method ?? "GET", corpo, intestazioni: init.headers ?? {}, ora: stato.ora, byte: Buffer.isBuffer(init.body) ? init.body.length : null, redirect: init.redirect });
      if (String(indirizzo) === PONTE) {
        const r = risposte[corpo?.tipo]?.(corpo) ?? { stato: 400, corpo: { ok: false } };
        if (r.rete) throw new Error("rete assente http://segreto.example/x");
        return { status: r.stato, text: async () => JSON.stringify(r.corpo ?? null) };
      }
      if (/^https:\/\/[a-z0-9-]+(\.storage)?\.supabase\.co\/storage\/v1\/object\/upload\/sign\/ponte-media\//.test(String(indirizzo)) && init.method === "PUT") {
        stato.put.push(init.body);
        const r = server.put(init);
        if (r.rete) throw new Error("rete assente");
        return { status: r.status, body: { cancel: async () => {} } };
      }
      stato.violazioni.push(String(indirizzo));
      throw new Error("indirizzo non ammesso");
    };
    const scarica = opz.scarica
      ? (...a) => {
          stato.scarichi.push(a);
          return opz.scarica(...a, stato);
        }
      : async (...a) => {
          stato.scarichi.push(a);
          //  i byte giusti per il tipo che Baileys riceve (image → una foto, audio → un OggS, video → un mp4, document → un PDF)
          return flusso({ audio: OGG, video: MP4, document: PDF }[a[1]] ?? JPEG);
        };
    const registro = (codice, conteggi = {}) => {
      const buono = typeof codice === "string" && /^[a-z_]+$/.test(codice) && Object.entries(conteggi).every(([k, v]) => /^[a-z_]+$/.test(k) && typeof v === "number");
      if (!buono) stato.violazioni.push(`registro non pulito: ${String(codice)}`);
      stato.log.push(`${codice} ${JSON.stringify(conteggi)}`);
    };
    let istanza;
    const pianifica = (f, ms) => {
      stato.pause.push(ms);
      if (opz.trattieni) {
        f.ms = ms;
        stato.trattenute.push(f);
        return;
      }
      stato.ora += ms;
      if (stato.pause.length > (opz.maxPause ?? 200)) istanza.ferma();
      setImmediate(f);
    };
    const catalogo = K.creaCatalogo({ cartella: join(cartella, "catalogo"), registro, orologio: () => stato.ora });
    cataloghi.push(catalogo);
    await catalogo.avvia();
    istanza = I.creaImmagini({
      url: PONTE,
      token: "t".repeat(40),
      cartella,
      catalogo,
      scarica,
      fetch: fetchFinto,
      registro,
      orologio: () => stato.ora,
      casuale: () => 0.5,
      pianifica,
      timeoutScaricoMs: opz.timeoutScaricoMs ?? 30_000,
      ...(opz.opzioni ?? {}),
    });
    return { img: istanza, stato, cartella, catalogo, coda: join(cartella, "catalogo") };
  }
  /** I lavori in coda (da scaricare da soli), come nomi di file: la coda e il catalogo sono lo stesso record. */
  const nelDisco = (x) => x.catalogo.voci("in_coda").map((v) => nomeFile(v.chiave));
  const accodaUna = (x, i = 1, immagine = img(), ts = TS) => x.img.accoda({ chiave: chiave(i), immagine, ts });
  /** Una richiesta nella forma di `mediaDa` (estrai.mjs): { chiave, ts, categoria, media, dettagli }. */
  const CATEGORIE = {
    foto: { byte: JPEG, tipo: "image", dettagli: { mime: "image/jpeg", byte: 4000, larghezza: 640, altezza: 480, miniatura: MINI } },
    audio: { byte: OGG, tipo: "audio", dettagli: { mime: "audio/ogg", byte: 9000, durata_s: 12 } },
    video: { byte: MP4, tipo: "video", dettagli: { mime: "video/mp4", byte: 5 * MIB, durata_s: 30, larghezza: 1280, altezza: 720, miniatura: MINI } },
    documento: { byte: PDF, tipo: "document", dettagli: { mime: "application/pdf", byte: 120_000, nome: "listino.pdf", miniatura: MINI } },
  };
  const media = (categoria, i = 1, dettagli = {}, ts = TS) => ({ chiave: chiave(i), ts, categoria, media: { mediaKey: Buffer.alloc(32, 7), directPath: DIRECT, url: "https://mmg.whatsapp.net/v/t62.7118-24/12345_67890.enc?ccb=11-4" }, dettagli: { ...CATEGORIE[categoria].dettagli, ...dettagli } });
  /** Le quattro categorie sono automatiche (come dopo un battito del Worker nuovo). */
  const tutteAuto = (x) => x.img.dopoBattito({ media_v: 2, media_auto: ["foto", "audio", "documento", "video"] });
  const permessiDi = (x) => x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_permesso");
  const esitiDi = (x) => x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_esito").map((k) => k.corpo);
  /** Fa scattare le pause di cortesia (meno di 10 s) di un'istanza con `trattieni`, finché `cond()`; le lunghe restano tenute. */
  const pompa = async (x, cond) => {
    for (let t = 0; t < 2000 && !cond(); t++) {
      for (const f of [...x.stato.trattenute]) {
        if (f.ms >= 10_000) continue;
        x.stato.trattenute.splice(x.stato.trattenute.indexOf(f), 1);
        x.stato.ora += f.ms;
        f();
      }
      await new Promise((r) => setTimeout(r, 2));
    }
    return cond();
  };
  const attendi = async (cond) => {
    for (let t = 0; t < 400 && !cond(); t++) await new Promise((r) => setTimeout(r, 5));
    return cond();
  };
  /** Il CRM che, a «prendi», consegna queste chiavi (una volta sola). */
  const consegna = (...chiavi) => {
    let dato = false;
    return () => {
      const richieste = dato ? [] : chiavi.map((k) => ({ chiave: k }));
      dato = true;
      return { stato: 200, corpo: { ok: true, richieste } };
    };
  };

  try {
    // ── 0. Il file e le sue regole fisse ────────────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: LIMITI E CODICE (compito T6)");
    const grezzo = readFileSync(join(src, "immagini.mjs"), "utf8");
    const codice = grezzo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    c("limiti per categoria (a.1): peso, tempo di scarico, età per il download automatico", { foto: [8 * MIB, 30_000, 14], audio: [16 * MIB, 60_000, 14], video: [45 * MIB, 240_000, 7], documento: [25 * MIB, 90_000, 14] }, Object.fromEntries(Object.entries(I.LIMITI_MEDIA).map(([k, v]) => [k, [v.maxByte, v.timeoutMs, v.giorni]])));
    c("il video pesa 47.185.920 byte (45 MiB): sta sotto i 50 MB decimali di Supabase", 47_185_920, I.LIMITI_MEDIA.video.maxByte);
    c("limiti: +10 % di lettura, 5.000 file, 600 all'ora, 1 GiB all'ora, 2–5 s", [1.1, 5000, 600, 1024 * MIB, 2000, 5000], [I.LIMITI_IMMAGINI.tolleranza, I.LIMITI_IMMAGINI.maxCoda, I.LIMITI_IMMAGINI.allOra, I.LIMITI_IMMAGINI.allOraByte, I.LIMITI_IMMAGINI.pausaMinMs, I.LIMITI_IMMAGINI.pausaMaxMs]);
    c("niente automatici nei 10 minuti dopo un blocco di storico; «Mostra» prende al massimo 5 chiavi", [600_000, 5], [I.LIMITI_IMMAGINI.pausaDopoStoricoMs, I.LIMITI_IMMAGINI.maxRichieste]);
    c("attese di un lavoro che non riesce: 5 min, 15 min, 1 h, 3 h", [300_000, 900_000, 3_600_000, 10_800_000], I.LIMITI_IMMAGINI.attese);
    c("interruttore spento: il ciclo dorme 1 ora; tetto pieno: 30 minuti (non più 6 ore)", [3_600_000, 1_800_000], [I.LIMITI_IMMAGINI.pausaSpentaMs, I.LIMITI_IMMAGINI.pausaTettoMs]);
    c("TIPO_BAILEYS: esattamente 4 voci costanti, una per categoria", { foto: "image", audio: "audio", video: "video", documento: "document" }, I.TIPO_BAILEYS);
    c("mai downloadMediaMessage, updateMediaMessage, reuploadRequest, requestPlaceholderResend (nel codice)", [], ["downloadMediaMessage", "updateMediaMessage", "reuploadRequest", "requestPlaceholderResend"].filter((x) => codice.includes(x)));
    c("nessun console, nessun import di Baileys, nessuna cartella di casa", [], ["console", "@whiskeysockets", "homedir", "tmpdir", "process.env"].filter((x) => codice.includes(x)));
    c("nessun socket di WhatsApp: niente `sock`", false, /\bsock\b/.test(codice));
    c("il flusso di Baileys non si legge con un controllo nel ciclo soltanto: c'è una Promise.race", true, /Promise\.race/.test(codice));
    c("l'host si legge con new URL(…).hostname", true, /new URL\(/.test(codice) && /\.hostname/.test(codice));

    // ── 1. validaOrigine (c.1 punto 1) ──────────────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: VALIDARE L'ORIGINE PRIMA DI OGNI RICHIESTA (c.1)");
    const ok = I.validaOrigine(img());
    c("origine buona: ok, host del messaggio, percorso e chiave di 32 byte", [true, "mmg.whatsapp.net", DIRECT, 32], [ok.ok, ok.host, ok.directPath, ok.mediaKey?.length]);
    c("senza url: host di serie mmg.whatsapp.net", [true, "mmg.whatsapp.net"], (({ ok: o, host }) => [o, host])(I.validaOrigine(img({ url: undefined }))));
    c("url vuoto: come assente", [true, "mmg.whatsapp.net"], (({ ok: o, host }) => [o, host])(I.validaOrigine(img({ url: "" }))));
    c("url su un sottodominio cdn di whatsapp.net: l'host è quello", [true, "scontent.cdn.whatsapp.net"], (({ ok: o, host }) => [o, host])(I.validaOrigine(img({ url: "https://scontent.cdn.whatsapp.net/v/x.enc" }))));
    c("host in maiuscolo → minuscolo", "mmg.whatsapp.net", I.validaOrigine(img({ url: "https://MMG.WhatsApp.NET/v/x" })).host);
    c("mediaKey come Uint8Array di 32 byte → ok", true, I.validaOrigine(img({ mediaKey: new Uint8Array(32) })).ok);

    const urlOstili = {
      "http: in chiaro": "http://mmg.whatsapp.net/v/x.enc",
      "127.0.0.1": "https://127.0.0.1/v/x.enc",
      "localhost": "https://localhost/v/x.enc",
      "rete di casa": "https://192.168.1.1/admin",
      "IPv6 locale": "https://[::1]/x",
      "host estraneo": "https://evil.example/v/x.enc",
      "whatsapp.net come prefisso": "https://mmg.whatsapp.net.evil.com/v/x.enc",
      "somiglia a whatsapp.net": "https://evilwhatsapp.net/v/x.enc",
      "whatsapp.net senza sottodominio": "https://whatsapp.net/v/x.enc",
      "utente@ (l'host vero è evil)": "https://mmg.whatsapp.net@evil.example/v/x.enc",
      "utente e password": "https://utente:segreta@mmg.whatsapp.net/v/x.enc",
      "porta": "https://mmg.whatsapp.net:8080/v/x.enc",
      "porta 443 scritta": "https://mmg.whatsapp.net:443/v/x.enc",
      "backslash": "https://evil.example\\@mmg.whatsapp.net/v/x.enc",
      "punto finale": "https://mmg.whatsapp.net./v/x.enc",
      "file:": "file:///etc/passwd",
      "ftp:": "ftp://mmg.whatsapp.net/x",
      "javascript:": "javascript:alert(1)",
      "non è un url": "mmg.whatsapp.net/v/x",
      "con spazio": "https://mmg.whatsapp.net /x",
      "a capo": "https://mmg.whatsapp.net\n.evil.example/x",
      "punycode": "https://xn--mmg-whatsapp-0za.net/x",
      "non è una stringa": 42,
      "oggetto": { href: "https://mmg.whatsapp.net/x" },
    };
    for (const [nome, url] of Object.entries(urlOstili)) c(`url ostile (${nome}) → origine non valida`, false, I.validaOrigine(img({ url })).ok);
    c("url ostile con directPath valido → scartato (nessun ripiego sul directPath)", { ok: false, motivo: "origine_non_valida" }, I.validaOrigine(img({ url: "http://127.0.0.1/x" })));

    const percorsiOstili = {
      "assente": undefined,
      "vuoto": "",
      "non comincia con /": "v/t62/x.enc",
      "// iniziale (sposta l'host)": "//evil.example/x",
      "//evil con @": "//mmg.whatsapp.net@evil.example/x",
      "..": "/v/../../x",
      "backslash": "/v\\x.enc",
      "spazio": "/v/x .enc",
      "a capo": "/v/x\n.enc",
      "carattere di controllo": "/v/x\u0000.enc",
      "cancelletto": "/v/x.enc#frammento",
      "%2e codificato": "/v/%2e%2e/x",
      "%2f codificato": "/v%2f%2fx",
      "%5c codificato": "/v%5cx",
      "più di 1024 caratteri": `/${"a".repeat(1024)}`,
      "non è una stringa": 7,
      "con @": "/v@evil.example/x",
    };
    for (const [nome, directPath] of Object.entries(percorsiOstili)) c(`directPath ostile (${nome}) → origine non valida`, false, I.validaOrigine(img({ directPath })).ok);
    c("directPath lungo 1024 → ok", true, I.validaOrigine(img({ directPath: `/${"a".repeat(1023)}` })).ok);

    const chiaviOstili = {
      "assente": undefined,
      "stringa": "AAAA",
      "31 byte": Buffer.alloc(31),
      "33 byte": Buffer.alloc(33),
      "array di numeri": Array.from({ length: 32 }, () => 1),
      "oggetto qualunque": { length: 32 },
      "null": null,
    };
    for (const [nome, mediaKey] of Object.entries(chiaviOstili)) c(`mediaKey ostile (${nome}) → origine non valida`, false, I.validaOrigine(img({ mediaKey })).ok);
    c("messaggio non oggetto → origine non valida", [false, false, false], [I.validaOrigine(null).ok, I.validaOrigine("x").ok, I.validaOrigine(undefined).ok]);

    const t0 = performance.now();
    I.validaOrigine(img({ url: `https://${"a.".repeat(5000)}whatsapp.net/x`, directPath: `/${"a/".repeat(3000)}` }));
    I.validaOrigine(img({ url: `https://${"a-".repeat(20000)}!whatsapp.net/x` }));
    c("input enormi: nessun giro lungo (sotto 50 ms)", true, performance.now() - t0 < 50);

    c("i byte li giudica firma.mjs, non più immagini.mjs (tipoDaByte non c'è più)", [undefined, true], [I.tipoDaByte, /from "\.\/firma\.mjs"/.test(grezzo)]);

    // ── 2. Il download protetto (c.1 punti 2-5) ─────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: IL DOWNLOAD PROTETTO (c.1)");
    {
      const x = await nuovo({ scarica: scaricaStileBaileys(async (ind) => void 0, () => flusso(JPEG)) });
      accodaUna(x);
      await x.img.avvia();
      const [args] = x.stato.scarichi;
      c("un messaggio buono: scarica(copia, 'image', { host }) e basta", [1, "image", { host: "mmg.whatsapp.net" }], [x.stato.scarichi.length, args?.[1], args?.[2]]);
      c("la copia ha SOLO mediaKey e directPath (mai url, mai l'oggetto del messaggio)", [["directPath", "mediaKey"], true, DIRECT], [Object.keys(args?.[0] ?? {}).sort(), Buffer.isBuffer(args?.[0]?.mediaKey) && args[0].mediaKey.length === 32, args?.[0]?.directPath]);
      c("la copia non è l'oggetto del messaggio", false, args?.[0] === undefined);
    }
    {
      //  Baileys vero: l'host viene da `opts.host`; qui si misura l'indirizzo che il suo codice costruirebbe.
      const richieste = [];
      const x = await nuovo({ scarica: scaricaStileBaileys(async (ind) => void richieste.push(ind), () => flusso(JPEG)) });
      accodaUna(x, 1, img({ url: "https://scontent.cdn.whatsapp.net/v/x.enc" }));
      await x.img.avvia();
      c("l'indirizzo che Baileys costruirebbe: https, host *.whatsapp.net, percorso nostro", [`https://scontent.cdn.whatsapp.net${DIRECT}`], richieste);
    }
    {
      //  URL ostili: mai una richiesta, di nessun tipo, e niente su disco.
      let tutteSenzaRichieste = true;
      let tutteScartate = true;
      let sulDisco = 0;
      let violazioni = [];
      for (const url of Object.values(urlOstili)) {
        const richieste = [];
        const x = await nuovo({ scarica: scaricaStileBaileys(async (ind) => void richieste.push(ind), () => flusso(JPEG)) });
        const r = accodaUna(x, 1, img({ url }));
        await x.img.avvia();
        if (richieste.length || x.stato.chiamate.length || x.stato.scarichi.length) tutteSenzaRichieste = false;
        if (r.ok !== false || r.motivo !== "origine_non_valida") tutteScartate = false;
        sulDisco += nelDisco(x).length;
        violazioni = violazioni.concat(x.stato.violazioni);
      }
      c("con un url ostile: nessuna richiesta (né download né fetch né permesso)", true, tutteSenzaRichieste);
      c("con un url ostile: accoda() risponde origine_non_valida", true, tutteScartate);
      c("con un url ostile: niente nella coda su disco", 0, sulDisco);
      c("con un url ostile: nessuna violazione del fetch finto", [], violazioni);
    }
    {
      //  Un directPath ostile con url pulito: stessa cosa.
      let richieste = 0;
      for (const directPath of Object.values(percorsiOstili)) {
        const x = await nuovo({ scarica: scaricaStileBaileys(async () => void richieste++, () => flusso(JPEG)) });
        accodaUna(x, 1, img({ directPath }));
        await x.img.avvia();
        richieste += x.stato.chiamate.length + x.stato.scarichi.length;
      }
      c("con un directPath ostile (anche //evil e ..): nessuna richiesta", 0, richieste);
    }
    {
      //  Un lavoro nel catalogo manomesso (host 127.0.0.1, directPath //evil): scartato al caricamento.
      const x = await nuovo();
      accodaUna(x, 1);
      accodaUna(x, 2);
      accodaUna(x, 3);
      const nomi = nelDisco(x);
      await x.catalogo.svuota();
      const leggi = (f) => JSON.parse(readFileSync(join(x.coda, f), "utf8"));
      const f1 = nomeFile(chiave(1));
      const f2 = nomeFile(chiave(2));
      writeFileSync(join(x.coda, f1), JSON.stringify({ ...leggi(f1), host: "127.0.0.1" }));
      writeFileSync(join(x.coda, f2), JSON.stringify({ ...leggi(f2), directPath: "//evil.example/x" }));
      const y = await montaSu(x.cartella);
      await y.img.avvia();
      c("catalogo manomesso (host 127.0.0.1, directPath //evil): quei lavori non partono, il terzo sì", [3, 1, []], [nomi.length, y.stato.scarichi.length, y.stato.violazioni]);
    }
    {
      //  Peso: il flusso senza fine si ferma al tetto; il peso dichiarato non conta.
      const x = await nuovo({ scarica: async (a, b, o, s) => { const f = infinito(); s.flusso = f; return f; } });
      accodaUna(x, 1, img({ fileLength: 100 }));
      await x.img.avvia();
      c("flusso infinito: fermato al tetto, distrutto, lavoro scartato (non resta)", [true, 0, 0], [x.stato.flusso?.destroyed, nelDisco(x).length, x.stato.put.length]);
      c("flusso infinito: nessun upload e nessun fatto", ["media_permesso"], x.stato.chiamate.filter((k) => k.corpo).map((k) => k.corpo.tipo));
      c("flusso infinito: contato fra le scartate, non fra gli errori", [1, 0], [x.img.contatori().scartate, x.img.contatori().errori]);
    }
    {
      //  Flusso FERMO: nessun pezzo, quindi un controllo dentro il ciclo non scatterebbe. Promise.race con un timer.
      const x = await nuovo({ maxPause: 1, timeoutScaricoMs: 40, scarica: async (a, b, o, s) => { const f = fermo(); s.flusso = f; return f; } });
      accodaUna(x, 1);
      const t = performance.now();
      await x.img.avvia();
      const ms = performance.now() - t;
      c("flusso fermo: il timeout scatta (40 ms nella prova) e il flusso è distrutto", [true, true], [ms < 1500, x.stato.flusso?.destroyed]);
      c("flusso fermo: il lavoro resta in coda con un tentativo, nessun upload", [1, 0], [nelDisco(x).length, x.stato.put.length]);
      c("flusso fermo: 'errori' conta solo i lavori scartati, non i tentativi", 0, x.img.contatori().errori);
    }
    {
      //  La chiamata a scarica() che non risolve mai (la fetch interna pende): stesso timer.
      const x = await nuovo({ maxPause: 1, timeoutScaricoMs: 40, scarica: () => new Promise(() => {}) });
      accodaUna(x, 1);
      const t = performance.now();
      await x.img.avvia();
      c("scarica() che non risponde mai: il timeout scatta lo stesso, il lavoro resta", [true, 1], [performance.now() - t < 1500, nelDisco(x).length]);
    }
    {
      //  Una scarica() che risolve DOPO il timeout: il flusso tardivo si distrugge.
      let tardivo = null;
      const x = await nuovo({ maxPause: 1, timeoutScaricoMs: 30, scarica: () => new Promise((ok) => setTimeout(() => ok((tardivo = fermo())), 120)) });
      accodaUna(x, 1);
      await x.img.avvia();
      await new Promise((r) => setTimeout(r, 250));
      c("scarica() tardiva: il flusso che arriva dopo il timeout viene distrutto", true, tardivo?.destroyed === true);
    }
    {
      //  Un errore di Baileys con l'url dentro: il registro non lo vede mai.
      const errore = Object.assign(new Error("Failed to fetch stream from http://segreto.example/dati?chiave=SEGRETA"), { output: { statusCode: 500 }, data: { url: "http://segreto.example/dati" } });
      const x = await nuovo({ maxPause: 1, scarica: async () => { throw errore; } });
      accodaUna(x, 1);
      await x.img.avvia();
      const tutto = x.stato.log.join("\n");
      c("errore di Baileys con url nel testo: il registro non contiene url, host, segreti", [], ["http", "segreto", "SEGRETA", "Failed", "fetch stream", "example"].filter((s) => tutto.includes(s)));
      c("errore di Baileys con url nel testo: nessuna violazione del registro; il lavoro resta (500)", [[], 1], [x.stato.violazioni, nelDisco(x).length]);
      c("il registro non contiene numeri di cliente né chiavi", [], [NUMERO, "bw:", "ID0001"].filter((s) => tutto.includes(s)));
    }
    {
      //  404 e 410 → scaduta (definitiva); 403/500/senza codice → resta.
      for (const [stato, atteso] of [[404, "scartato"], [410, "scartato"], [403, "resta"], [500, "resta"], [undefined, "resta"]]) {
        const x = await nuovo({ maxPause: 1, scarica: async () => { throw Object.assign(new Error("http://x"), stato ? { output: { statusCode: stato } } : {}); } });
        accodaUna(x, 1);
        await x.img.avvia();
        const rimasti = nelDisco(x).length;
        c(`download ${stato ?? "senza codice"}: ${atteso}`, [atteso === "resta" ? 1 : 0, stato === 404 || stato === 410 ? 1 : 0], [rimasti, x.img.contatori().scadute]);
      }
      const y = await nuovo({ scarica: async () => { throw Object.assign(new Error("x"), { statusCode: 404 }); } });
      accodaUna(y, 1);
      await y.img.avvia();
      c("download: il 404 si legge anche da statusCode del Boom", [0, 1], [nelDisco(y).length, y.img.contatori().scadute]);
    }
    {
      //  Controllo dei byte magici: SVG/HTML dichiarati come JPEG non passano.
      for (const [nome, dati, mime] of [["SVG", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>"), "image/jpeg"], ["HTML", Buffer.from("<html><script>x</script></html>"), "image/png"], ["vuoto", Buffer.alloc(0), "image/jpeg"]]) {
        const x = await nuovo({ scarica: async () => flusso(dati) });
        accodaUna(x, 1, img({ mimetype: mime }));
        await x.img.avvia();
        c(`byte magici: ${nome} → scartato, nessun upload`, [0, 0], [nelDisco(x).length, x.stato.put.length]);
      }
      for (const [nome, dati, mime] of [["JPEG", JPEG, "image/jpeg"], ["PNG", PNG, "image/png"], ["WebP", WEBP, "image/webp"]]) {
        const x = await nuovo({ scarica: async () => flusso(dati) });
        accodaUna(x, 1, img({ mimetype: mime }));
        await x.img.avvia();
        c(`byte magici: ${nome} → caricato`, [1, 0, mime], [x.stato.put.length, nelDisco(x).length, x.stato.chiamate.find((k) => k.metodo === "PUT")?.intestazioni["Content-Type"]]);
      }
      //  Il tipo lo decidono i byte (D2): un PNG dichiarato JPEG è sempre una foto e il PUT parte con il tipo VERO.
      const png = await nuovo({ scarica: async () => flusso(PNG) });
      accodaUna(png, 1, img({ mimetype: "image/jpeg" }));
      await png.img.avvia();
      c("byte magici: PNG dichiarato JPEG → stessa famiglia (foto): caricato con il Content-Type dei byte (image/png)", [1, "image/png"], [png.stato.put.length, png.stato.chiamate.find((k) => k.metodo === "PUT")?.intestazioni["Content-Type"]]);
      const pezzi = await nuovo({ scarica: async () => flusso(JPEG.subarray(0, 3), JPEG.subarray(3, 50), JPEG.subarray(50)) });
      accodaUna(pezzi, 1);
      await pezzi.img.avvia();
      c("il flusso a più pezzi si rimette insieme", true, Buffer.compare(pezzi.stato.put[0] ?? Buffer.alloc(0), JPEG) === 0);
    }
    {
      //  Oltre 8 MiB (ma sotto il tetto di lettura): scartata troppo_grande; sopra +10 %: fermata.
      const grande = Buffer.concat([JPEG, Buffer.alloc(8 * MIB + 100, 1)]);
      const x = await nuovo({ scarica: async () => flusso(grande) });
      accodaUna(x, 1);
      await x.img.avvia();
      c("immagine di 8 MiB + 100 byte: scartata, nessun upload", [0, 0, 1], [nelDisco(x).length, x.stato.put.length, x.img.contatori().scartate]);
      const limite = Buffer.concat([JPEG, Buffer.alloc(8 * MIB - JPEG.length, 1)]);
      const y = await nuovo({ scarica: async () => flusso(limite) });
      accodaUna(y, 1);
      await y.img.avvia();
      c("immagine di esattamente 8 MiB: caricata", [1, 8 * MIB], [y.stato.put.length, y.stato.put[0]?.length]);
    }

    // ── 3. Il flusso con il CRM (c.3) ───────────────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: PERMESSO, CARICO, FATTO (c.3)");
    {
      const x = await nuovo();
      accodaUna(x, 1, img({ fileLength: 1234 }));
      await x.img.avvia();
      const [p, put, f] = x.stato.chiamate;
      c("tre richieste in ordine: permesso al ponte, PUT sull'URL di carico, fatto al ponte", [PONTE, CARICO, PONTE], [p?.url, put?.url, f?.url]);
      c("permesso: {v:1, tipo, chiave, mime, byte} e il token nell'intestazione", [{ v: 1, tipo: "media_permesso", chiave: chiave(1), mime: "image/jpeg", byte: 1234 }, "t".repeat(40)], [p?.corpo, p?.intestazioni["X-HGL-Token"]]);
      c("fatto: {v:1, tipo, chiave} e niente altro (il peso del Mac non si usa)", { v: 1, tipo: "media_fatto", chiave: chiave(1) }, f?.corpo);
      c("PUT: i byte scaricati, il tipo vero, senza upsert, senza seguire redirect", [JPEG.length, "image/jpeg", "false", "error"], [put?.byte, put?.intestazioni["Content-Type"], put?.intestazioni["x-upsert"], put?.redirect]);
      c("PUT: l'unico PUT è sull'URL del CRM, nessuna violazione del fetch finto", [[], 1], [x.stato.violazioni, x.stato.chiamate.filter((k) => k.metodo === "PUT").length]);
      c("fine: ok 1, coda su disco vuota", [1, 0, 0], [x.img.contatori().ok, x.img.contatori().in_coda, nelDisco(x).length]);
      const tutto = x.stato.log.join("\n");
      c("il registro non contiene il token di Storage né l'URL di carico", [], ["SEGRETO", "supabase", "token"].filter((s) => tutto.includes(s)));
    }
    {
      //  L'URL di carico del CRM si controlla: solo https://*.supabase.co/storage/v1/object/upload/sign/ponte-media/…
      const cattivi = {
        "http:": "http://abcdefgh.supabase.co/storage/v1/object/upload/sign/ponte-media/u/p.jpg?token=A",
        "host estraneo": "https://evil.example/storage/v1/object/upload/sign/ponte-media/u/p.jpg?token=A",
        "supabase.co come prefisso": "https://abcdefgh.supabase.co.evil.example/storage/v1/object/upload/sign/ponte-media/u/p.jpg",
        "utente@": "https://abcdefgh.supabase.co@evil.example/storage/v1/object/upload/sign/ponte-media/u/p.jpg",
        "porta": "https://abcdefgh.supabase.co:8443/storage/v1/object/upload/sign/ponte-media/u/p.jpg",
        "altro bucket": "https://abcdefgh.supabase.co/storage/v1/object/upload/sign/landing-media/u/p.jpg?token=A",
        "altro percorso": "https://abcdefgh.supabase.co/rest/v1/whatsapp_messages",
        "IP": "https://127.0.0.1/storage/v1/object/upload/sign/ponte-media/u/p.jpg",
        "non è una stringa": 5,
      };
      let put = 0;
      let violazioni = [];
      let rimasti = 0;
      for (const url_carico of Object.values(cattivi)) {
        const x = await nuovo({ server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "carica", url_carico } }) }, maxPause: 4 });
        accodaUna(x, 1);
        await x.img.avvia();
        put += x.stato.chiamate.filter((k) => k.metodo === "PUT").length;
        violazioni = violazioni.concat(x.stato.violazioni);
        rimasti += nelDisco(x).length;
      }
      c("url_carico non valido (http, host estraneo, altro bucket…): mai un PUT, mai una fetch fuori lista", [0, []], [put, violazioni]);
      c("url_carico non valido: i lavori restano in coda (colpa del server, non della foto)", Object.keys(cattivi).length, rimasti);
    }

    // ── 4. La tabella di c.2, riga per riga ─────────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: COSA SI TIENE E COSA SI SCARTA (c.2)");
    {
      const caso = async (nome, server, { resta, scartata = 0, chiamateAlMassimo = 40, pausa } = {}) => {
        const x = await nuovo({ server, maxPause: 6 });
        accodaUna(x, 1);
        await x.img.avvia();
        c(`${nome}: ${resta ? "il lavoro RESTA" : "il lavoro è scartato"}`, resta ? 1 : 0, nelDisco(x).length);
        if (pausa) c(`${nome}: il ciclo dorme ${pausa} ms`, true, x.stato.pause.includes(pausa));
        c(`${nome}: nessun download, nessun upload`, [0, 0], [x.stato.scarichi.length, x.stato.put.length]);
        return x;
      };
      const rif = (motivo) => ({ permesso: () => ({ stato: 200, corpo: { ok: true, esito: "rifiutato", motivo } }) });
      await caso("Worker vecchio (400)", { permesso: () => ({ stato: 400, corpo: { ok: false } }) }, { resta: true });
      await caso("migrazione mancante (503)", { permesso: () => ({ stato: 503, corpo: { ok: false, errore: "migrazione" } }) }, { resta: true });
      await caso("chiave sbagliata (401)", { permesso: () => ({ stato: 401, corpo: null }) }, { resta: true });
      await caso("troppe richieste (429)", { permesso: () => ({ stato: 429, corpo: null }) }, { resta: true });
      await caso("errore del server (500)", { permesso: () => ({ stato: 500, corpo: null }) }, { resta: true });
      await caso("errore del server (502)", { permesso: () => ({ stato: 502, corpo: null }) }, { resta: true });
      await caso("rete assente", { permesso: () => ({ rete: true }) }, { resta: true });
      await caso("risposta senza JSON", { permesso: () => ({ stato: 200, corpo: null }) }, { resta: true });
      await caso("rifiutato: spenta", rif("spenta"), { resta: true, pausa: 3_600_000 });
      const tetto = await caso("rifiutato: tetto", rif("tetto"), { resta: true, pausa: 1_800_000 });
      c("rifiutato: tetto → contato in 'tetto' (a ogni risposta del CRM)", true, tetto.img.contatori().tetto >= 1);
      await caso("rifiutato: troppo_grande", rif("troppo_grande"), { resta: false });
      await caso("rifiutato: tipo", rif("tipo"), { resta: false });
      await caso("già presente", { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "gia_presente" } }) }, { resta: false });
      await caso("rifiutato con un motivo che non conosciamo", rif("boh"), { resta: true });
    }
    {
      //  Le attese del server: 5 min → 15 min → 1 h → 3 h, e il lavoro non si consuma.
      const x = await nuovo({ server: { permesso: () => ({ stato: 400, corpo: null }) }, maxPause: 12 });
      accodaUna(x, 1);
      await x.img.avvia();
      const lunghe = x.stato.pause.filter((ms) => ms > 10_000).map((ms) => Math.round(ms / 60_000));
      c("Worker vecchio: le attese salgono 5, 15, 60, 180 minuti e poi restano a 180", [5, 15, 60, 180, 180], lunghe.slice(0, 5));
      c("Worker vecchio, dopo molti tentativi: la foto c'è ancora (nessun conteggio di errori)", [1, 0], [nelDisco(x).length, x.img.contatori().errori]);
    }
    {
      //  Lo stesso Worker che torna a funzionare: il lavoro trattenuto parte e finisce.
      let n = 0;
      const x = await nuovo({ server: { permesso: () => (n++ < 2 ? { stato: 503, corpo: null } : { stato: 200, corpo: { ok: true, esito: "carica", url_carico: CARICO } }) } });
      accodaUna(x, 1);
      await x.img.avvia();
      c("503 due volte, poi il server c'è: la foto viene caricata", [1, 0, 1], [x.stato.put.length, nelDisco(x).length, x.img.contatori().ok]);
    }
    {
      //  PUT che fallisce: per lavoro 5 min, 15 min, 1 h, 3 h; al quinto tentativo scartato (errori).
      const x = await nuovo({ server: { put: () => ({ status: 500 }) }, maxPause: 40 });
      accodaUna(x, 1);
      await x.img.avvia();
      const lunghe = x.stato.pause.filter((ms) => ms > 10_000).map((ms) => Math.round(ms / 60_000));
      c("PUT fallito: attese di 5, 15, 60, 180 minuti", [5, 15, 60, 180], lunghe);
      c("PUT fallito 5 volte: scartato, contato in 'errori', cinque PUT in tutto", [0, 1, 5], [nelDisco(x).length, x.img.contatori().errori, x.stato.put.length]);
      c("PUT fallito: mai il 'fatto'", 0, x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_fatto").length);
    }
    {
      const x = await nuovo({ server: { put: () => ({ rete: true }) }, maxPause: 40 });
      accodaUna(x, 1);
      await x.img.avvia();
      c("PUT senza rete (eccezione): stessa regola, scartato al quinto", [0, 1], [nelDisco(x).length, x.img.contatori().errori]);
      const tutto = x.stato.log.join("\n");
      c("PUT senza rete: nessun testo dell'errore nel registro", false, tutto.includes("rete assente"));
    }
    {
      //  PUT fallito due volte, poi riesce: il lavoro finisce.
      let n = 0;
      const x = await nuovo({ server: { put: () => ({ status: n++ < 2 ? 503 : 200 }) } });
      accodaUna(x, 1);
      await x.img.avvia();
      c("PUT fallito due volte e poi buono: caricata, coda vuota", [3, 0, 1], [x.stato.put.length, nelDisco(x).length, x.img.contatori().ok]);
    }
    {
      //  PUT 409 (l'oggetto c'è già, la risposta si era persa): si va al 'fatto'.
      const x = await nuovo({ server: { put: () => ({ status: 409 }) } });
      accodaUna(x, 1);
      await x.img.avvia();
      c("PUT 409 (oggetto già presente): si passa al 'fatto' e il lavoro finisce", [1, 0], [x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_fatto").length, nelDisco(x).length]);
    }
    {
      //  'fatto' che non va: la foto è già su Storage, il lavoro resta SENZA riscaricare né ricaricare.
      let n = 0;
      const x = await nuovo({ server: { fatto: () => (n++ < 2 ? { stato: 500, corpo: null } : { stato: 200, corpo: { ok: true, esito: "pronta" } }) } });
      accodaUna(x, 1);
      await x.img.avvia();
      c("'fatto' fallito due volte: un solo download, un solo PUT, tre 'fatto', poi finito", [1, 1, 3, 0, 1], [x.stato.scarichi.length, x.stato.put.length, x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_fatto").length, nelDisco(x).length, x.img.contatori().ok]);
      c("'fatto' ritentato senza ripetere il permesso", 1, x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_permesso").length);
    }
    {
      //  L'esito di 'fatto' è quello VERO di T5 (media-tipi.ts): sempre 200 {ok:true, esito:"pronta"|"in_caricamento"|"assente"}.
      const fatti = (x) => x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_fatto").length;
      const permessiChiesti = (x) => x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_permesso").length;
      const risposta = (esito) => ({ stato: 200, corpo: esito === undefined ? { ok: true } : { ok: true, esito } });

      const a1 = await nuovo({ server: { fatto: () => risposta("pronta") } });
      accodaUna(a1, 1);
      await a1.img.avvia();
      c("'fatto' → pronta: lavoro concluso, contato 'ok', file tolto", [1, 0], [a1.img.contatori().ok, nelDisco(a1).length]);

      //  in_caricamento: la foto NON è pronta, il lavoro resta con caricato:true e si ritenta solo il 'fatto'.
      const b1 = await nuovo({ server: { fatto: () => risposta("in_caricamento") }, maxPause: 1 });
      accodaUna(b1, 1);
      await b1.img.avvia();
      const dopo1 = b1.catalogo.leggi(chiave(1));
      c("'fatto' → in_caricamento: il lavoro RESTA (non è 'ok'), con caricato:true e un guasto", [0, 1, true, 1], [b1.img.contatori().ok, nelDisco(b1).length, dopo1.caricato, dopo1.guasti]);
      const b2 = await nuovo({ server: { fatto: () => risposta("in_caricamento") }, maxPause: 40 });
      accodaUna(b2, 1);
      await b2.img.avvia();
      const lunghe = b2.stato.pause.filter((ms) => ms > 10_000).map((ms) => Math.round(ms / 60_000));
      c("'fatto' → in_caricamento sempre: 5 tentativi con attese 5, 15, 60, 180 minuti, poi scartato 'errori'", [[5, 15, 60, 180], 5, 0, 1, 0], [lunghe, fatti(b2), nelDisco(b2).length, b2.img.contatori().errori, b2.img.contatori().ok]);
      c("in_caricamento: un solo download, un solo PUT, un solo permesso (si ritenta solo il 'fatto')", [1, 1, 1], [b2.stato.scarichi.length, b2.stato.put.length, permessiChiesti(b2)]);
      let n1 = 0;
      const b3 = await nuovo({ server: { fatto: () => risposta(n1++ < 2 ? "in_caricamento" : "pronta") } });
      accodaUna(b3, 1);
      await b3.img.avvia();
      c("in_caricamento due volte, poi pronta: finito, contato 'ok'", [1, 0, 3], [b3.img.contatori().ok, nelDisco(b3).length, fatti(b3)]);

      //  assente: la riga di permesso non c'è più → caricato:false e si rifà il permesso (e il carico).
      let n2 = 0;
      const d1 = await nuovo({ server: { fatto: () => risposta(n2++ < 1 ? "assente" : "pronta") } });
      accodaUna(d1, 1);
      await d1.img.avvia();
      c("'fatto' → assente: si rifà il permesso, il download e il carico; poi pronta", [2, 2, 2, 2, 1, 0], [permessiChiesti(d1), d1.stato.scarichi.length, d1.stato.put.length, fatti(d1), d1.img.contatori().ok, nelDisco(d1).length]);
      const d2 = await nuovo({ server: { fatto: () => risposta("assente") }, maxPause: 1 });
      accodaUna(d2, 1);
      await d2.img.avvia();
      const dopo2 = d2.catalogo.leggi(chiave(1));
      c("'fatto' → assente: nel file caricato:false e un guasto contato; il lavoro resta", [false, 1, 0], [dopo2.caricato === true, dopo2.guasti, d2.img.contatori().ok]);
      const d3 = await nuovo({ server: { fatto: () => risposta("assente") }, maxPause: 80 });
      accodaUna(d3, 1);
      await d3.img.avvia();
      c("'fatto' → assente sempre: dopo 5 tentativi scartato 'errori' (nessun giro infinito)", [0, 1, 0], [nelDisco(d3).length, d3.img.contatori().errori, d3.img.contatori().ok]);

      //  Qualunque altra risposta 200+ok senza 'pronta' è 'non pronta'.
      for (const [nome, esito] of [["senza esito", undefined], ["esito sconosciuto", "forse"], ["esito non stringa", 7]]) {
        const e1 = await nuovo({ server: { fatto: () => risposta(esito) }, maxPause: 1 });
        accodaUna(e1, 1);
        await e1.img.avvia();
        c(`'fatto' ${nome}: non è pronta, il lavoro resta e non è contato 'ok'`, [0, 1], [e1.img.contatori().ok, nelDisco(e1).length]);
      }
    }
    {
      //  Un lavoro "avvelenato" (il CRM gli risponde sempre 500) non ferma la coda e dopo 5 tentativi è scartato.
      let x;
      let nuove = 0;
      x = await nuovo({
        maxPause: 400,
        server: {
          permesso: (corpo) => {
            if (corpo.chiave !== chiave(1)) return { stato: 200, corpo: { ok: true, esito: "carica", url_carico: CARICO } };
            accodaUna(x, 100 + ++nuove); // intanto arrivano foto nuove, e vanno bene
            return { stato: 500, corpo: null };
          },
        },
      });
      accodaUna(x, 1, img(), TS - 100);
      await x.img.avvia();
      c("lavoro avvelenato (sempre 500) mentre le altre foto vanno: scartato 'errori' al 5° tentativo", [1, 0], [x.img.contatori().errori, nelDisco(x).length]);
      c("  e le altre foto sono state caricate (tutte), nessuna persa", [nuove, nuove], [x.img.contatori().ok, x.stato.put.length]);
      c("  il lavoro avvelenato ha chiesto il permesso 5 volte, non di più", 5, x.stato.chiamate.filter((k) => k.corpo?.chiave === chiave(1)).length);

      //  Un CRM giù per TUTTI (nessuna risposta buona) non scarta niente.
      const giu = await nuovo({ server: { permesso: () => ({ stato: 500, corpo: null }) }, maxPause: 60 });
      for (let i = 1; i <= 3; i++) accodaUna(giu, i);
      await giu.img.avvia();
      c("Worker che dà 500 a tutti per ore: nessun lavoro scartato, tutti e 3 restano", [0, 3, 0], [giu.img.contatori().errori, nelDisco(giu).length, giu.img.contatori().ok]);
    }
    {
      //  L'URL di carico può stare anche su <ref>.storage.supabase.co.
      const nuovoDominio = "https://abcdefgh.storage.supabase.co/storage/v1/object/upload/sign/ponte-media/u/p.jpg?token=A";
      const x = await nuovo({ server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "carica", url_carico: nuovoDominio } }) } });
      accodaUna(x, 1);
      await x.img.avvia();
      const dominiNo = await nuovo({ server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "carica", url_carico: "https://abcdefgh.storage.supabase.co.evil.example/storage/v1/object/upload/sign/ponte-media/u/p.jpg" } }) }, maxPause: 2 });
      accodaUna(dominiNo, 1);
      await dominiNo.img.avvia();
      c("url_carico su <ref>.storage.supabase.co: accettato; con un suffisso estraneo no", [1, 0, []], [x.stato.chiamate.filter((k) => k.metodo === "PUT" && k.url === nuovoDominio).length, dominiNo.stato.put.length, dominiNo.stato.violazioni]);
    }

    // ── 5. La coda su disco (D5, c.2) ───────────────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: LA CODA È IL CATALOGO, SU DISCO (c.2)");
    {
      const x = await nuovo();
      const r = accodaUna(x, 1, img(), TS);
      await x.catalogo.svuota();
      const [f] = readdirSync(x.coda);
      c("accoda: ok, un file nominato dall'impronta della chiave (nessun numero nel nome)", [true, nomeFile(chiave(1)), false], [r.ok, f, f?.includes(NUMERO)]);
      c("permessi: cartelle 700, file 600", [0o700, 0o600], [permessi(x.coda), permessi(join(x.coda, f))]);
      const dati = JSON.parse(readFileSync(join(x.coda, f), "utf8"));
      c("nel file: chiave, categoria, mime, peso, host, percorso, chiave del media (base64 di 32 byte), orario, stato in_coda", [chiave(1), "foto", "image/jpeg", 4000, "mmg.whatsapp.net", DIRECT, 32, TS, "in_coda"], [dati.chiave, dati.categoria, dati.mime, dati.byte, dati.host, dati.directPath, Buffer.from(dati.mediaKey, "base64").length, dati.ts, dati.stato]);
      c("nel file non c'è l'url del messaggio", false, readFileSync(join(x.coda, f), "utf8").includes("url"));
      c("nessun file temporaneo rimasto", [], readdirSync(x.coda).filter((n2) => !n2.endsWith(".json")));
      c("la stessa foto due volte: una sola riga in coda", [true, "gia_in_coda", 1], [accodaUna(x, 1).ok === false, accodaUna(x, 1).motivo, nelDisco(x).length]);
      c("in_coda conta i lavori", 1, x.img.contatori().in_coda);
    }
    {
      //  Un permesso sbagliato nelle cartelle già esistenti (umask a 022) viene corretto.
      const cartella = join(base, "perm");
      mkdirSync(join(cartella, "catalogo"), { recursive: true, mode: 0o755 });
      const x = await montaSu(cartella);
      c("cartelle già esistenti con 755 → 700", 0o700, permessi(x.coda));
    }
    {
      //  Senza `catalogo` nelle opzioni ne crea uno suo (accanto alla cartella) e lo avvia da sé.
      const cartella = join(base, "proprio");
      const img2 = I.creaImmagini({ url: PONTE, token: "t".repeat(40), cartella, scarica: async () => flusso(JPEG), fetch: async () => ({ status: 200, text: async () => "{}" }), registro: () => {}, orologio: () => T0, casuale: () => 0.5, pianifica: () => {} });
      await img2.avvia();
      const r = img2.accoda({ chiave: chiave(1), immagine: img(), ts: TS });
      c("senza catalogo passato: ne crea uno suo, avviato da avvia() — accoda funziona", [true, true], [r.ok, existsSync(join(cartella, "catalogo"))]);
      await img2.ferma();
    }
    {
      //  Un catalogo non avviato non perde in silenzio: accoda lo dice.
      const cat = K.creaCatalogo({ cartella: join(base, "non-avviato") });
      const img3 = I.creaImmagini({ url: PONTE, token: "t".repeat(40), cartella: join(base, "non-avviato-i"), catalogo: cat, scarica: async () => flusso(JPEG), fetch: async () => ({ status: 200, text: async () => "{}" }), registro: () => {}, orologio: () => T0, casuale: () => 0.5, pianifica: () => {} });
      const r = img3.accoda({ chiave: chiave(1), immagine: img(), ts: TS });
      c("catalogo non ancora avviato: accoda non lancia e risponde non_avviato", [false, "non_avviato"], [r.ok, r.motivo]);
    }
    {
      //  Riavvio: la coda su disco riprende.
      const x = await nuovo();
      accodaUna(x, 1);
      accodaUna(x, 2);
      accodaUna(x, 3);
      await x.catalogo.svuota();
      const y = await montaSu(x.cartella);
      c("riavvio: i tre lavori sono ancora lì", 3, y.img.contatori().in_coda);
      await y.img.avvia();
      c("riavvio: ripresi e finiti (tre PUT)", [3, 0], [y.stato.put.length, nelDisco(y).length]);
    }
    {
      //  A metà: un lavoro che ha già un guasto e un'attesa non perde il conto.
      const x = await nuovo({ server: { put: () => ({ status: 500 }) }, maxPause: 1 });
      accodaUna(x, 1);
      await x.img.avvia();
      await x.catalogo.svuota();
      const dopo = JSON.parse(readFileSync(join(x.coda, nomeFile(chiave(1))), "utf8"));
      c("dopo un guasto il file porta il numero di guasti e l'attesa (e resta 600)", [1, true, 0o600], [dopo.guasti, dopo.prossimo_il > T0, permessi(join(x.coda, nomeFile(chiave(1))))]);
      const y = await montaSu(x.cartella, { server: { put: () => ({ status: 500 }) }, maxPause: 40 });
      y.stato.ora = x.stato.ora;
      await y.img.avvia();
      c("riavviato: continua dal conto di prima (5 PUT in tutto, non 5 in più)", [4, 1], [y.stato.put.length, y.img.contatori().errori]);
    }
    {
      //  File corrotti, nomi estranei, resti temporanei: li scarta il catalogo, immagini.mjs non vede altro.
      const cartella = join(base, "corrotti");
      mkdirSync(join(cartella, "catalogo"), { recursive: true, mode: 0o700 });
      const buono = await nuovo();
      accodaUna(buono, 7);
      await buono.catalogo.svuota();
      const fb = nomeFile(chiave(7));
      const sano = readFileSync(join(buono.coda, fb), "utf8");
      const hash = (s2) => createHash("sha256").update(s2).digest("hex");
      const qui = (nome) => join(cartella, "catalogo", nome);
      writeFileSync(qui(fb), sano, { mode: 0o600 });
      writeFileSync(qui(`${hash("a")}.json`), "{non è json", { mode: 0o600 });
      writeFileSync(qui(`${hash("b")}.json`), "[]", { mode: 0o600 });
      writeFileSync(qui(`${hash("c")}.json`), JSON.stringify({ ...JSON.parse(sano), chiave: "bw:abc:1" }), { mode: 0o600 });
      writeFileSync(qui(`${hash("d")}.json`), JSON.stringify({ ...JSON.parse(sano), mediaKey: Buffer.alloc(8).toString("base64") }), { mode: 0o600 });
      writeFileSync(qui(`${hash("e")}.json`), JSON.stringify({ ...JSON.parse(sano), mime: "image/svg+xml" }), { mode: 0o600 });
      writeFileSync(qui("nome-strano.json"), sano, { mode: 0o600 });
      writeFileSync(qui(`${fb}.tmp-123`), sano, { mode: 0o600 });
      const x = await montaSu(cartella);
      c("file corrotti, di un'altra chiave, con chiave media o tipo falsi, nome strano, resti .tmp: tutti scartati, resta il buono", [1, [fb]], [x.img.contatori().in_coda, readdirSync(x.coda)]);
      await x.img.avvia();
      c("il lavoro buono parte, gli altri non fanno nessuna richiesta", [1, 1], [x.stato.put.length, x.stato.scarichi.length]);
      c("il registro conta i file corrotti, senza dire quali", true, x.stato.log.some((r) => r.startsWith("catalogo_voci_corrotte")));
    }
    {
      //  I lavori della coda di prima (v: 1, cartella `coda/`) si rileggono UNA volta e passano nel catalogo.
      const cartella = join(base, "v1");
      mkdirSync(join(cartella, "coda"), { recursive: true, mode: 0o700 });
      const vecchio = (i, extra = {}) => ({ v: 1, chiave: chiave(i), mediaKey: Buffer.alloc(32, 7).toString("base64"), directPath: DIRECT, host: "mmg.whatsapp.net", mime: "image/jpeg", byte: 4000, ts: TS, guasti: 2, prossimo_il: 0, ...extra });
      writeFileSync(join(cartella, "coda", nomeFile(chiave(1))), JSON.stringify(vecchio(1)), { mode: 0o600 });
      writeFileSync(join(cartella, "coda", nomeFile(chiave(2))), JSON.stringify(vecchio(2, { caricato: true })), { mode: 0o600 });
      writeFileSync(join(cartella, "coda", nomeFile(chiave(3))), JSON.stringify(vecchio(3, { host: "127.0.0.1" })), { mode: 0o600 });
      writeFileSync(join(cartella, "coda", nomeFile(chiave(4))), "{rotto", { mode: 0o600 });
      const x = await montaSu(cartella);
      c("v:1: prima di avvia() il catalogo non li ha ancora", 0, x.img.contatori().in_coda);
      await x.img.avvia();
      const saltato = x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_permesso").map((k) => k.corpo.chiave);
      c("v:1: i due buoni sono ripresi (il caricato:true salta il permesso), quello con host 127.0.0.1 e il rotto no", [1, [chiave(1)], 2], [saltato.length, saltato, x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_fatto").length]);
      c("v:1: la cartella vecchia è sparita: si rilegge una volta sola", false, existsSync(join(cartella, "coda")));
      c("v:1: dopo il lavoro i due restano nel catalogo come catalogato (per «Mostra»)", [2, 0, "catalogato"], [x.catalogo.conteggio().catalogato, x.catalogo.conteggio().in_coda, x.catalogo.leggi(chiave(1))?.stato]);
      c("v:1: nessuna violazione", [], x.stato.violazioni);
    }
    {
      //  Età: 14 giorni per foto, vocali e documenti, 7 per i video, 30 per restare nel catalogo (a.1, c2.1).
      const x = await nuovo();
      const adesso = x.stato.ora / 1000;
      const dentro = accodaUna(x, 1, img(), adesso - 14 * GIORNO_S + 120);
      const fuori = accodaUna(x, 2, img(), adesso - 14 * GIORNO_S - 120);
      const vecchissima = accodaUna(x, 3, img(), adesso - 30 * GIORNO_S - 120);
      c("accoda: 14 giorni meno 2 minuti → in coda; più vecchia di 14 → solo catalogo (si potrà chiedere «Mostra»); più vecchia di 30 → scartata", [[true, true], [true, false], [false, "vecchia"], 1, 2], [[dentro.ok, dentro.in_coda], [fuori.ok, fuori.in_coda], [vecchissima.ok, vecchissima.motivo], nelDisco(x).length, x.catalogo.conteggio().voci]);
      c("la fuori finestra non è una 'scaduta' (non si è nemmeno tentato)", 0, x.img.contatori().scadute);
      //  Un lavoro che invecchia in coda: dopo 14 giorni lascia la coda ma resta nel catalogo.
      const y = await nuovo({ server: { permesso: () => ({ stato: 503, corpo: null }) }, maxPause: 30 });
      accodaUna(y, 1, img(), y.stato.ora / 1000 - 13 * GIORNO_S);
      y.stato.ora += 2 * 86_400_000;
      await y.img.avvia();
      c("un lavoro trattenuto che compie 14 giorni esce dalla coda, contato 'scadute', e resta nel catalogo", [0, 1, 1], [nelDisco(y).length, y.img.contatori().scadute, y.catalogo.conteggio().catalogato]);
      //  All'avvio: un lavoro già fuori finestra non parte.
      const z = await nuovo();
      accodaUna(z, 1, img(), z.stato.ora / 1000 - 13 * GIORNO_S);
      await z.catalogo.svuota();
      const w = await montaSu(z.cartella, { ora: T0 + 3 * 86_400_000 });
      await w.img.avvia();
      c("all'avvio un lavoro già scaduto (13 giorni + 3) non parte, esce dalla coda e si conta", [0, 0, 1], [nelDisco(w).length, w.stato.scarichi.length, w.img.contatori().scadute]);
    }
    {
      //  Tetto di 5.000 file (qui 3 per brevità) e il valore vero.
      const x = await nuovo({ opzioni: { maxCoda: 3 } });
      const esiti = [1, 2, 3, 4, 5].map((i) => accodaUna(x, i));
      c("coda piena: oltre il tetto il lavoro nuovo è scartato, contato 'coda_piena'", [[true, true, true, false, false], "coda_piena", 3, 2], [esiti.map((e) => e.ok), esiti[3].motivo, nelDisco(x).length, x.img.contatori().coda_piena]);
      c("il tetto di serie è 5.000", 5000, I.LIMITI_IMMAGINI.maxCoda);
    }
    {
      //  Altri scarti all'ingresso: tipo, peso.
      const x = await nuovo();
      const r = (m) => accodaUna(x, 9, m);
      c("tipo non ammesso (gif, svg, heic, vuoto, assente) → 'tipo'", ["tipo", "tipo", "tipo", "tipo", "tipo"], [r(img({ mimetype: "image/gif" })).motivo, r(img({ mimetype: "image/svg+xml" })).motivo, r(img({ mimetype: "image/heic" })).motivo, r(img({ mimetype: "" })).motivo, r(img({ mimetype: undefined })).motivo]);
      c("mime con parametri e maiuscole → accettato", true, accodaUna(await nuovo(), 1, img({ mimetype: "Image/JPEG; charset=binary" })).ok);
      c("peso dichiarato oltre 8 MiB → 'troppo_grande' senza chiedere niente", "troppo_grande", r(img({ fileLength: 8 * MIB + 1 })).motivo);
      c("peso dichiarato assente, zero o negativo → 'peso_non_valido'", ["peso_non_valido", "peso_non_valido", "peso_non_valido"], [r(img({ fileLength: undefined })).motivo, r(img({ fileLength: 0 })).motivo, r(img({ fileLength: -5 })).motivo]);
      c("peso dichiarato come Long di protobuf → accettato", true, accodaUna(await nuovo(), 1, img({ fileLength: { low: 5000, high: 0, unsigned: true, toNumber: () => 5000 } })).ok);
      c("chiave del messaggio non valida o orario non valido → rifiutato", [false, false, false], [x.img.accoda({ chiave: "bw:x:y", immagine: img(), ts: TS }).ok, x.img.accoda({ chiave: chiave(1), immagine: img(), ts: "ieri" }).ok, x.img.accoda(null).ok]);
      c("nessuno di questi ha scritto su disco", 0, nelDisco(x).length);
    }
    // ── 6. Il ritmo: uno alla volta, 2–5 s, non più di 600 all'ora ──────
    gruppo("PONTE WHATSAPP · IMMAGINI: RITMO (c.2)");
    {
      const x = await nuovo({ maxPause: 400 });
      for (let i = 1; i <= 5; i++) accodaUna(x, i);
      await x.img.avvia();
      c("fra un lavoro e l'altro una pausa di 2–5 s (casuale 0,5 → 3,5 s)", [4, true], [x.stato.pause.length, x.stato.pause.every((ms) => ms === 3500)]);
    }
    {
      const x = await nuovo({ scarica: async (a, b, o, s) => { s.insieme = (s.insieme ?? 0) + 1; s.massimo = Math.max(s.massimo ?? 0, s.insieme); await new Promise((r) => setTimeout(r, 5)); s.insieme--; return flusso(JPEG); } });
      for (let i = 1; i <= 6; i++) accodaUna(x, i);
      void x.img.sveglia();
      void x.img.avvia();
      await x.img.avvia();
      c("mai due download insieme (anche chiamando avvia e sveglia più volte)", [1, 6], [x.stato.massimo, x.stato.put.length]);
    }
    {
      const x = await nuovo({ maxPause: 5000 });
      for (let i = 1; i <= 601; i++) accodaUna(x, i);
      await x.img.avvia();
      const permessi = x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_permesso").map((k) => k.ora);
      const peggiore = Math.max(...permessi.map((t) => permessi.filter((u) => u <= t && u > t - 3_600_000).length));
      c("601 lavori: tutti finiti (la 601ª ha aspettato)", [601, 0], [x.img.contatori().ok, nelDisco(x).length]);
      c("in nessuna ora mobile più di 600 richieste di permesso", true, peggiore <= 600);
      c("la 601ª è partita almeno un'ora dopo la prima", true, permessi[600] - permessi[0] >= 3_600_000);
      c("l'attesa della 601ª è comparsa fra le pause (più di 10 minuti)", true, x.stato.pause.some((ms) => ms > 600_000));
    }
    {
      //  ferma(): il ciclo esce anche se dorme.
      const x = await nuovo({ server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "rifiutato", motivo: "spenta" } }) } });
      let tenuta = null;
      x.img = I.creaImmagini({ url: PONTE, token: "t".repeat(40), cartella: x.cartella, catalogo: x.catalogo, scarica: async () => flusso(JPEG), fetch: async () => ({ status: 200, text: async () => JSON.stringify({ ok: true, esito: "rifiutato", motivo: "spenta" }) }), registro: () => {}, orologio: () => x.stato.ora, casuale: () => 0.5, pianifica: (f, ms) => { tenuta = f; } });
      accodaUna(x, 1);
      const ciclo = x.img.avvia();
      await new Promise((r) => setTimeout(r, 20));
      const t = performance.now();
      await x.img.ferma();
      await ciclo;
      c("ferma(): il ciclo addormentato (un'ora) si sveglia ed esce subito, il lavoro resta", [true, 1], [performance.now() - t < 500, nelDisco(x).length]);
      c("(la pausa era davvero in corso)", true, typeof tenuta === "function");
      c("dopo ferma() accoda funziona ancora e sveglia() non parte", [true], [accodaUna(x, 2).ok]);
    }

    // ── 7. Le quattro categorie (a.1, a.3) ──────────────────────────────
    gruppo("PONTE WHATSAPP · MEDIA: FOTO, VOCALI, VIDEO, DOCUMENTI");
    for (const [categoria, def] of Object.entries(CATEGORIE)) {
      const x = await nuovo();
      await tutteAuto(x);
      const r = x.img.accoda(media(categoria, 1));
      await x.img.avvia();
      const [args] = x.stato.scarichi;
      const mimeAtteso = def.dettagli.mime;
      const corpoAtteso = { v: 1, tipo: "media_permesso", chiave: chiave(1), mime: mimeAtteso, byte: def.dettagli.byte, ...Object.fromEntries(["nome", "durata_s", "larghezza", "altezza", "miniatura"].filter((k) => def.dettagli[k] !== undefined).map((k) => [k, def.dettagli[k]])) };
      c(`${categoria}: accodata, scaricata con il tipo di Baileys giusto (${def.tipo}) e host fissato da noi`, [true, 1, def.tipo, { host: "mmg.whatsapp.net" }], [r.ok && r.in_coda, x.stato.scarichi.length, args?.[1], args?.[2]]);
      c(`${categoria}: la copia ha SOLO mediaKey e directPath`, ["directPath", "mediaKey"], Object.keys(args?.[0] ?? {}).sort());
      c(`${categoria}: il permesso porta mime, peso e i dettagli della bolla (nome, durata, misure, miniatura) — nient'altro`, corpoAtteso, permessiDi(x)[0]?.corpo);
      c(`${categoria}: PUT con il Content-Type dei byte; coda vuota e voce rimasta nel catalogo per «Mostra»`, [1, mimeAtteso, 0, "catalogato"], [x.stato.put.length, x.stato.chiamate.find((k) => k.metodo === "PUT")?.intestazioni["Content-Type"], nelDisco(x).length, x.catalogo.leggi(chiave(1))?.stato]);
      c(`${categoria}: finita la coda la voce non porta più guasti, attese né «caricato»`, [undefined, undefined, undefined], [x.catalogo.leggi(chiave(1))?.guasti, x.catalogo.leggi(chiave(1))?.prossimo_il, x.catalogo.leggi(chiave(1))?.caricato]);
      c(`${categoria}: nessuna violazione, registro pulito`, [], x.stato.violazioni);
    }
    {
      //  Peso: il limite è della categoria, a +1 byte no.
      const massimi = { foto: 8 * MIB, audio: 16 * MIB, video: 45 * MIB, documento: 25 * MIB };
      for (const [categoria, max] of Object.entries(massimi)) {
        const x = await nuovo();
        await tutteAuto(x);
        const giu = x.img.accoda(media(categoria, 1, { byte: max }));
        const su = x.img.accoda(media(categoria, 2, { byte: max + 1 }));
        c(`${categoria}: esattamente ${max / MIB} MiB in coda; un byte in più → troppo_grande, mai chiesto`, [true, false, "troppo_grande", 1], [giu.ok, su.ok, su.motivo, nelDisco(x).length]);
      }
      //  Il flusso senza fine si ferma a max × 1,1 anche per il video (45 MiB), e si distrugge.
      for (const categoria of ["audio", "video", "documento"]) {
        const x = await nuovo({ scarica: async (a, b, o, st) => { const f = infinito(); st.flusso = f; return f; } });
        await tutteAuto(x);
        x.img.accoda(media(categoria, 1, { byte: 1000 }));
        await x.img.avvia();
        c(`${categoria}: flusso infinito fermato al tetto di lettura, distrutto, lavoro scartato e tolto anche dal catalogo`, [true, 0, 0, 0, 0], [x.stato.flusso?.destroyed, nelDisco(x).length, x.catalogo.conteggio().voci, x.stato.put.length, x.img.contatori().errori]);
      }
    }
    {
      //  La famiglia dei byte (D2): decidono i byte; se non sono della categoria del messaggio → scartato.
      const prova = async (nome, categoria, dettagli, byte, atteso) => {
        const x = await nuovo({ scarica: async () => flusso(byte) });
        await tutteAuto(x);
        x.img.accoda(media(categoria, 1, dettagli));
        await x.img.avvia();
        const put = x.stato.chiamate.find((k) => k.metodo === "PUT");
        c(`byte: ${nome}`, atteso === null ? [null, 0, 0] : [atteso, 1, 0], [put?.intestazioni["Content-Type"] ?? null, x.stato.put.length, nelDisco(x).length]);
      };
      await prova("un video che dentro è un vocale OggS → scartato", "video", {}, OGG, null);
      await prova("un vocale che dentro è HTML → scartato", "audio", {}, Buffer.from("<html><script>alert(1)</script></html>"), null);
      await prova("un PDF dichiarato ma con HTML dentro → scartato", "documento", {}, Buffer.from("<html><body>x</body></html>"), null);
      await prova("uno ZIP rinominato .pdf → scartato", "documento", {}, ZIP, null);
      await prova("un vocale Android (mp4 con marca isom, dichiarato audio/mp4) → audio/mp4", "audio", { mime: "audio/mp4" }, MP4, "audio/mp4");
      await prova("un vocale ogg dichiarato audio/mpeg → PUT come audio/ogg (stessa famiglia)", "audio", { mime: "audio/mpeg" }, OGG, "audio/ogg");
      await prova("un video quicktime dichiarato mp4 → PUT come video/quicktime", "video", {}, ftyp("qt  "), "video/quicktime");
      await prova("un docx col nome .docx dichiarato docx → docx", "documento", { mime: DOCX, nome: "preventivo.docx" }, ZIP, DOCX);
      await prova("uno ZIP col nome .zip dichiarato docx → scartato", "documento", { mime: DOCX, nome: "archivio.zip" }, ZIP, null);
    }

    // ── 8. Chi entra in coda e chi resta solo nel catalogo (D7, D8) ─────
    gruppo("PONTE WHATSAPP · MEDIA: AUTOMATICI PER CATEGORIA, ETÀ, ORDINE");
    {
      const x = await nuovo();
      const r = ["foto", "audio", "video", "documento"].map((cat, i) => x.img.accoda(media(cat, i + 1)));
      c("prima di sapere cosa dice il Worker: solo le foto in coda, il resto solo nel catalogo (Mac nuovo su Worker vecchio non butta i vocali)", [[true, false, false, false], 1, 4], [r.map((e) => e.ok && e.in_coda), nelDisco(x).length, x.catalogo.conteggio().voci]);
      await x.img.dopoBattito({ media_v: 1, media_auto: ["foto", "audio", "video", "documento"] });
      c("battito senza media_v 2 (Worker vecchio): le altre categorie non diventano automatiche", false, x.img.accoda(media("audio", 5)).in_coda);
      await x.img.dopoBattito({ media_v: 2 });
      c("media_v 2 senza `auto`: solo le foto (come dice il piano)", [true, false], [x.img.accoda(media("foto", 6)).in_coda, x.img.accoda(media("audio", 7)).in_coda]);
      await x.img.dopoBattito({ media_v: 2, media_auto: ["foto", "audio", "documento", "strano", 7] });
      c("media_v 2 con auto foto/audio/documento: in coda, il video no; categorie strane ignorate", [true, true, false], [x.img.accoda(media("audio", 8)).in_coda, x.img.accoda(media("documento", 9)).in_coda, x.img.accoda(media("video", 10)).in_coda]);
      await x.img.dopoBattito({ media_v: 2, media_auto: [] });
      c("auto vuoto (il titolare le ha spente): niente in coda, tutto nel catalogo", false, x.img.accoda(media("foto", 11)).in_coda);
      c("la voce già catalogata e poi riaccodata non si duplica", [true, 1], [x.img.accoda(media("video", 3)).ok, x.catalogo.voci().filter((v) => v.chiave === chiave(3)).length]);
    }
    {
      //  Età: foto, vocali e documenti 14 giorni, video 7; per restare nel catalogo 30.
      const x = await nuovo();
      await tutteAuto(x);
      const adesso = x.stato.ora / 1000;
      const quando = (giorni) => adesso - giorni * GIORNO_S;
      const r = (cat, i, giorni) => x.img.accoda(media(cat, i, {}, quando(giorni)));
      c("video di 6 giorni → in coda; di 8 giorni → solo catalogo", [true, false], [r("video", 1, 6).in_coda, r("video", 2, 8).in_coda]);
      c("audio e documento di 13 giorni → in coda; di 15 → solo catalogo", [true, true, false, false], [r("audio", 3, 13).in_coda, r("documento", 4, 13).in_coda, r("audio", 5, 15).in_coda, r("documento", 6, 15).in_coda]);
      c("più di 30 giorni: non entra nemmeno nel catalogo", [false, "vecchia"], (({ ok, motivo }) => [ok, motivo])(r("video", 7, 31)));
    }
    {
      //  Ordine: i più nuovi prima (i vecchi scadono comunque dopo), uno alla volta.
      const x = await nuovo();
      const ts = (giorni) => TS - giorni * GIORNO_S;
      accodaUna(x, 1, img(), ts(5));
      accodaUna(x, 2, img(), ts(1));
      accodaUna(x, 3, img(), ts(3));
      await x.img.avvia();
      c("ordine degli automatici: dal più nuovo al più vecchio", [chiave(2), chiave(3), chiave(1)], permessiDi(x).map((k) => k.corpo.chiave));
    }

    // ── 9. Il tetto orario in byte (1 GiB) ──────────────────────────────
    gruppo("PONTE WHATSAPP · MEDIA: TETTO ORARIO IN BYTE");
    {
      const x = await nuovo({ maxPause: 5000 });
      await tutteAuto(x);
      for (let i = 1; i <= 30; i++) x.img.accoda(media("video", i, { byte: 40 * MIB }));
      await x.img.avvia();
      const p = permessiDi(x).map((k) => ({ t: k.ora, b: k.corpo.byte }));
      const peggiore = Math.max(...p.map(({ t }) => p.filter((u) => u.t <= t && u.t > t - 3_600_000).reduce((somma, u) => somma + u.b, 0)));
      c("30 video da 40 MiB: tutti finiti, nessuno perso", [30, 0], [x.img.contatori().ok, nelDisco(x).length]);
      c("in nessuna ora mobile più di 1 GiB (25 × 40 MiB = 1000 MiB, il 26° aspetta)", true, peggiore <= 1024 * MIB);
      c("il 26° è partito almeno un'ora dopo il 1°", true, p[25].t - p[0].t >= 3_600_000);
      c("fra le pause c'è l'attesa lunga del tetto in byte (più di 10 minuti)", true, x.stato.pause.some((ms) => ms > 600_000));
    }
    {
      //  Anche le foto da 8 MiB sono contate in byte; con tanti lavori piccoli vale il tetto da 600.
      const x = await nuovo({ maxPause: 5000 });
      for (let i = 1; i <= 140; i++) x.img.accoda(media("foto", i, { byte: 8 * MIB }));
      await x.img.avvia();
      const p = permessiDi(x).map((k) => ({ t: k.ora, b: k.corpo.byte }));
      const peggiore = Math.max(...p.map(({ t }) => p.filter((u) => u.t <= t && u.t > t - 3_600_000).reduce((somma, u) => somma + u.b, 0)));
      c("140 foto da 8 MiB (1.120 MiB): finite tutte, mai più di 1 GiB in un'ora", [140, true], [x.img.contatori().ok, peggiore <= 1024 * MIB]);
    }

    // ── 10. «Mostra» dal segnaposto: un solo tentativo (c2.2, c2.3) ─────
    gruppo("PONTE WHATSAPP · MEDIA: «MOSTRA», UN SOLO TENTATIVO");
    /** Un'istanza con un media NEL CATALOGO (non automatico) e il CRM che consegna quella richiesta. */
    async function conRichiesta(categoria, opz = {}, dettagli = {}, ts = TS) {
      const x = await nuovo({ ...opz, server: { prendi: consegna(chiave(5)), ...(opz.server ?? {}) } });
      const r = x.img.accoda(media(categoria, 5, dettagli, ts));
      c(`  (${categoria} nel catalogo, non in coda)`, [true, false], [r.ok, r.in_coda]);
      await x.img.dopoBattito({ media_v: 2, media_auto: ["foto"], media_richieste: 1 });
      await x.img.avvia();
      return x;
    }
    {
      const x = await conRichiesta("video");
      const tipi = x.stato.chiamate.map((k) => k.corpo?.tipo ?? k.metodo);
      const [args] = x.stato.scarichi;
      c("Mostra: prendi (max 5), permesso con richiesto:true e i dettagli, scarico, PUT, fatto; nessun esito", ["media_prendi", "media_permesso", "PUT", "media_fatto"], tipi);
      c("Mostra: prendi chiede al massimo 5 chiavi", { v: 1, tipo: "media_prendi", max: 5 }, x.stato.chiamate[0]?.corpo);
      c("Mostra: il permesso porta richiesto:true dopo il peso, poi i dettagli", { v: 1, tipo: "media_permesso", chiave: chiave(5), mime: "video/mp4", byte: 5 * MIB, richiesto: true, durata_s: 30, larghezza: 1280, altezza: 720, miniatura: MINI }, permessiDi(x)[0]?.corpo);
      c("Mostra: scarica() col tipo del video e la copia senza url", ["video", ["directPath", "mediaKey"]], [args?.[1], Object.keys(args?.[0] ?? {}).sort()]);
      c("Mostra: PUT con il tipo dei byte; contato ok; voce ancora nel catalogo, mai in coda", [1, "video/mp4", 1, 0, "catalogato"], [x.stato.put.length, x.stato.chiamate.find((k) => k.metodo === "PUT")?.intestazioni["Content-Type"], x.img.contatori().ok, nelDisco(x).length, x.catalogo.leggi(chiave(5))?.stato]);
      c("Mostra: senza dormire (nessuna pausa lunga) e nessuna violazione", [true, []], [x.stato.pause.every((ms) => ms <= 5000), x.stato.violazioni]);
    }
    {
      //  Ignora età, `auto` e pause: una foto di 20 giorni (fuori finestra) si mostra lo stesso.
      const x = await conRichiesta("foto", {}, {}, TS - 20 * GIORNO_S);
      c("Mostra: una foto di 20 giorni (oltre la finestra automatica) parte", [1, 0], [x.stato.put.length, esitiDi(x).length]);
    }
    {
      const casi = [
        ["download 403 (link scaduto)", { scarica: async () => { throw Object.assign(new Error("http://x"), { output: { statusCode: 403 } }); } }, "scaduta", true],
        ["download 404", { scarica: async () => { throw Object.assign(new Error("http://x"), { output: { statusCode: 404 } }); } }, "scaduta", true],
        ["download 410", { scarica: async () => { throw Object.assign(new Error("http://x"), { statusCode: 410 }); } }, "scaduta", true],
        ["download 500", { scarica: async () => { throw Object.assign(new Error("http://x"), { output: { statusCode: 500 } }); } }, "errore", false],
        ["rete (nessun codice)", { scarica: async () => { throw new Error("ECONNRESET http://segreto.example/x"); } }, "errore", false],
        ["flusso fermo", { timeoutScaricoMs: 40, scarica: async () => fermo() }, "errore", false],
        ["flusso senza fine", { scarica: async () => infinito() }, "troppo_grande", true],
        ["byte che non sono di un video", { scarica: async () => flusso(Buffer.from("<html>no</html>")) }, "tipo", true],
        ["permesso: tetto", { server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "rifiutato", motivo: "tetto" } }) } }, "tetto", false],
        ["permesso: spenta", { server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "rifiutato", motivo: "spenta" } }) } }, "spenta", false],
        ["permesso: troppo_grande", { server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "rifiutato", motivo: "troppo_grande" } }) } }, "troppo_grande", true],
        ["permesso: tipo", { server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "rifiutato", motivo: "tipo" } }) } }, "tipo", true],
        ["permesso: motivo che non conosciamo", { server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "rifiutato", motivo: "boh" } }) } }, "errore", false],
        ["permesso: 500", { server: { permesso: () => ({ stato: 500, corpo: null }) } }, "errore", false],
        ["permesso: rete assente", { server: { permesso: () => ({ rete: true }) } }, "errore", false],
        ["permesso: url di carico non valido", { server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "carica", url_carico: "http://evil.example/x" } }) } }, "errore", false],
        ["PUT 500", { server: { put: () => ({ status: 500 }) } }, "errore", false],
        ["PUT senza rete", { server: { put: () => ({ rete: true }) } }, "errore", false],
        ["fatto 500", { server: { fatto: () => ({ stato: 500, corpo: null }) } }, "errore", false],
        ["fatto: in_caricamento", { server: { fatto: () => ({ stato: 200, corpo: { ok: true, esito: "in_caricamento" } }) } }, "errore", false],
        ["fatto: tipo (il Worker toglie l'oggetto)", { server: { fatto: () => ({ stato: 200, corpo: { ok: true, esito: "tipo" } }) } }, "tipo", true],
      ];
      for (const [nome, opz, esito, tolta] of casi) {
        const x = await conRichiesta("video", { maxPause: 6, ...opz });
        const tutto = x.stato.log.join("\n");
        c(`Mostra, ${nome}: un solo permesso, un solo esito «${esito}» subito, nessun ritentativo`, [1, [{ v: 1, tipo: "media_esito", chiave: chiave(5), esito }], 0], [permessiDi(x).length, esitiDi(x), nelDisco(x).length]);
        c(`Mostra, ${nome}: ${tolta ? "la voce esce dal catalogo (non c'è più nulla da riprovare)" : "la voce resta nel catalogo per un nuovo tentativo"}`, tolta ? 0 : 1, x.catalogo.conteggio().voci);
        c(`Mostra, ${nome}: nessuna attesa lunga; il registro non contiene url, host né segreti`, [true, [], []], [x.stato.pause.every((ms) => ms <= 5000), ["http", "segreto", "example", "ECONN"].filter((t) => tutto.includes(t)), x.stato.violazioni]);
      }
    }
    {
      //  L'esito stesso non arriva (il CRM non risponde): il lavoro si lascia, nessun ritentativo (la richiesta si riassegna dopo 10 minuti).
      const x = await conRichiesta("video", { maxPause: 6, server: { permesso: () => ({ stato: 500, corpo: null }), esito: () => ({ stato: 503, corpo: null }) } });
      c("Mostra, anche l'esito fallisce: un solo permesso, un solo tentativo di esito, il ciclo finisce", [1, 1, 0], [permessiDi(x).length, esitiDi(x).length, nelDisco(x).length]);
      const y = await nuovo({ server: { prendi: consegna(chiave(77)) } });
      await y.img.dopoBattito({ media_v: 2, media_richieste: 1 });
      await y.img.avvia();
      c("Mostra su una chiave che il catalogo non ha: esito non_catalogato, nessun permesso né scarico", [[{ v: 1, tipo: "media_esito", chiave: chiave(77), esito: "non_catalogato" }], 0, 0], [esitiDi(y), permessiDi(y).length, y.stato.scarichi.length]);
      const z = await conRichiesta("video", { server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "gia_presente" } }) } });
      c("Mostra su un media già presente: né scarico né esito (lo mostra la bolla)", [0, 0], [z.stato.scarichi.length, esitiDi(z).length]);
    }
    {
      //  Le chiavi che il CRM consegna: al massimo 5, valide, senza doppioni; un CRM che sbaglia non fa danni.
      const x = await nuovo({ server: { prendi: consegna(chiave(1), chiave(1), "bw:x:y", chiave(2), chiave(3), chiave(4), chiave(5), chiave(6), chiave(7)) } });
      for (let i = 1; i <= 7; i++) x.img.accoda(media("video", i));
      await x.img.dopoBattito({ media_v: 2, media_richieste: 9 });
      await x.img.avvia();
      c("prendi consegna 9 voci (un doppione, una non valida): si lavorano al massimo 5 diverse", [chiave(1), chiave(2), chiave(3), chiave(4), chiave(5)], permessiDi(x).map((k) => k.corpo.chiave));
      const y = await nuovo({ server: { prendi: () => ({ stato: 500, corpo: null }) } });
      await y.img.dopoBattito({ media_v: 2, media_richieste: 1 });
      const z = await nuovo({ server: { prendi: () => ({ rete: true }) } });
      await z.img.dopoBattito({ media_v: 2, media_richieste: 1 });
      let lanciato = false;
      try {
        for (const corpo of [null, undefined, "x", 7, [], { media_richieste: "tre" }, { media_v: "2", media_auto: "foto" }, { media_richieste: -1 }, { media_richieste: 1e9 }]) await y.img.dopoBattito(corpo);
      } catch {
        lanciato = true;
      }
      c("dopoBattito non lancia mai: prendi che dà 500 o cade, corpi storti", [false, 0, 0], [lanciato, permessiDi(y).length + permessiDi(z).length, esitiDi(y).length + esitiDi(z).length]);
      const k = await nuovo();
      await k.img.dopoBattito({ media_v: 2, media_auto: ["foto"] });
      c("senza media_richieste nel battito, prendi non viene chiamato", 0, k.stato.chiamate.length);
    }
    {
      //  Ordine: prima le richieste del titolare, poi i più nuovi.
      const x = await nuovo({ server: { prendi: consegna(chiave(5)) } });
      x.img.accoda(media("video", 5, {}, TS - 9 * GIORNO_S)); // solo catalogo (oltre 7 giorni)
      accodaUna(x, 1, img(), TS - 3 * GIORNO_S);
      accodaUna(x, 2, img(), TS - 1 * GIORNO_S);
      await x.img.dopoBattito({ media_v: 2, media_auto: ["foto"], media_richieste: 1 });
      await x.img.avvia();
      c("ordine: prima il richiesto, poi il più nuovo, poi il più vecchio", [chiave(5), chiave(2), chiave(1)], permessiDi(x).map((k) => k.corpo.chiave));
    }

    // ── 11. Pause che non valgono per «Mostra» (c2.2, punto 3) ──────────
    gruppo("PONTE WHATSAPP · MEDIA: IL BATTITO CON RICHIESTE AZZERA LA PAUSA");
    {
      //  Tetto pieno → il ciclo dorme 30 minuti → spazio liberato → Mostra: parte subito.
      const x = await nuovo({
        trattieni: true,
        server: {
          prendi: consegna(chiave(5)),
          permesso: (corpo) => (corpo.richiesto ? { stato: 200, corpo: { ok: true, esito: "carica", url_carico: CARICO } } : { stato: 200, corpo: { ok: true, esito: "rifiutato", motivo: "tetto" } }),
        },
      });
      x.img.accoda(media("video", 5, {}, TS - 9 * GIORNO_S)); // solo catalogo
      accodaUna(x, 1);
      const ciclo = x.img.avvia();
      await attendi(() => x.stato.trattenute.length === 1);
      c("tetto pieno: il ciclo dorme 30 minuti (non 6 ore), la foto resta in coda", [[1_800_000], 1], [x.stato.pause, nelDisco(x).length]);
      await x.img.dopoBattito({ media_v: 2, media_auto: ["foto"], media_richieste: 1 });
      const partito = await attendi(() => x.stato.put.length === 1);
      c("battito con media_richieste > 0: il richiesto parte SUBITO, senza aspettare i 30 minuti (la pausa tenuta non è scattata)", [true, 1], [partito, x.stato.put.length]);
      c("…e la richiesta è stata servita con richiesto:true, senza esiti d'errore", [true, 0], [permessiDi(x).some((k) => k.corpo.richiesto === true && k.corpo.chiave === chiave(5)), esitiDi(x).length]);
      await pompa(x, () => permessiDi(x).filter((k) => k.corpo.chiave === chiave(1)).length === 2 && x.stato.pause.at(-1) === 1_800_000);
      c("la pausa è stata azzerata: la foto in coda ha chiesto di nuovo (e ha ritrovato il tetto: nuova pausa di 30 minuti)", [2, 1_800_000], [permessiDi(x).filter((k) => k.corpo.chiave === chiave(1)).length, x.stato.pause.at(-1)]);
      await x.img.ferma();
      await ciclo;
    }
    {
      //  Il tetto orario in byte e la pausa dopo lo storico non fermano «Mostra».
      const x = await nuovo({ trattieni: true, server: { prendi: consegna(chiave(99)) } });
      x.img.accoda(media("documento", 99, {}, TS - 20 * GIORNO_S)); // solo catalogo
      await tutteAuto(x);
      for (let i = 1; i <= 26; i++) x.img.accoda(media("video", i, { byte: 40 * MIB }));
      x.img.dopoStorico();
      const ciclo = x.img.avvia();
      await attendi(() => x.stato.trattenute.length === 1);
      c("dopo lo storico gli automatici aspettano 10 minuti: nessun permesso finché la pausa non scade", [[600_000], 0], [x.stato.pause, permessiDi(x).length]);
      await x.img.dopoBattito({ media_v: 2, media_auto: ["foto", "audio", "documento", "video"], media_richieste: 1 });
      const partito = await attendi(() => x.stato.put.length === 1);
      c("…ma «Mostra» non aspetta la pausa dello storico", [true, chiave(99)], [partito, permessiDi(x)[0]?.corpo.chiave]);
      await x.img.ferma();
      await ciclo;
    }
    {
      //  Con 25 video già partiti nell'ora, il 26° aspetta; una richiesta no.
      const x = await nuovo({ trattieni: true, server: { prendi: consegna(chiave(99)) } });
      x.img.accoda(media("documento", 99, {}, TS - 20 * GIORNO_S));
      await tutteAuto(x);
      for (let i = 1; i <= 26; i++) x.img.accoda(media("video", i, { byte: 40 * MIB }));
      const ciclo = x.img.avvia();
      //  le pause di cortesia (2–5 s) scattano con la pompa; quella del tetto in byte resta tenuta
      await pompa(x, () => x.stato.pause.some((ms) => ms > 600_000));
      const lunga = x.stato.pause.some((ms) => ms > 600_000);
      const prima = permessiDi(x).length;
      c("25 video da 40 MiB partiti, il 26° aspetta il tetto in byte (pausa lunga)", [true, 25], [lunga, prima]);
      await x.img.dopoBattito({ media_v: 2, media_auto: ["foto", "audio", "documento", "video"], media_richieste: 1 });
      const partito = await attendi(() => permessiDi(x).some((k) => k.corpo.chiave === chiave(99)));
      c("…e «Mostra» parte lo stesso, senza aspettare l'ora", [true, 26], [partito, permessiDi(x).length]);
      await x.img.ferma();
      await ciclo;
    }

    // ── 12. Cosa succede al lavoro automatico (a.5) ─────────────────────
    gruppo("PONTE WHATSAPP · MEDIA: ESITI DEL LAVORO AUTOMATICO");
    {
      const rif = (motivo) => ({ permesso: () => ({ stato: 200, corpo: { ok: true, esito: "rifiutato", motivo } }) });
      const caso = async (nome, server, { coda, catalogo }) => {
        const x = await nuovo({ server, maxPause: 6 });
        x.img.accoda(media("audio", 1)); // prima del battito l'audio è solo catalogato
        await tutteAuto(x);
        x.img.accoda(media("audio", 2));
        await x.img.avvia();
        c(`automatico, ${nome}: in coda ${coda}, nel catalogo ${catalogo} (la prima voce è audio solo catalogata)`, [coda, catalogo], [nelDisco(x).length, x.catalogo.conteggio().voci]);
        return x;
      };
      await caso("«liberato» (il titolare l'ha liberato): lascia la coda ma resta per «Mostra»", rif("liberato"), { coda: 0, catalogo: 2 });
      await caso("«manuale» (categoria non automatica per il Worker): lascia la coda, resta nel catalogo", rif("manuale"), { coda: 0, catalogo: 2 });
      await caso("«tipo»: scartato anche dal catalogo (non si potrà mai mostrare)", rif("tipo"), { coda: 0, catalogo: 1 });
      await caso("«troppo_grande»: scartato anche dal catalogo", rif("troppo_grande"), { coda: 0, catalogo: 1 });
      await caso("«fatto» risponde tipo: il Worker ha tolto l'oggetto, scartato anche dal catalogo", { fatto: () => ({ stato: 200, corpo: { ok: true, esito: "tipo" } }) }, { coda: 0, catalogo: 1 });
      await caso("«fatto» risponde troppo_grande: idem", { fatto: () => ({ stato: 200, corpo: { ok: true, esito: "troppo_grande" } }) }, { coda: 0, catalogo: 1 });
      await caso("già presente: lascia la coda e resta nel catalogo", { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "gia_presente" } }) }, { coda: 0, catalogo: 2 });
      const x = await nuovo({ scarica: async () => { throw Object.assign(new Error("http://x"), { output: { statusCode: 404 } }); } });
      await tutteAuto(x);
      x.img.accoda(media("audio", 1));
      await x.img.avvia();
      c("automatico, download 404: scartato anche dal catalogo (nessun «Mostra» possibile)", [0, 0, 1], [nelDisco(x).length, x.catalogo.conteggio().voci, x.img.contatori().scadute]);
    }
    {
      //  I lavori automatici non mandano mai `richiesto` né esiti.
      const x = await nuovo();
      accodaUna(x, 1);
      await x.img.avvia();
      c("un lavoro automatico non porta `richiesto` e non manda `media_esito`", [false, 0], [Object.hasOwn(permessiDi(x)[0].corpo, "richiesto"), esitiDi(x).length]);
    }
    {
      //  Un errore di Baileys con l'url dentro non arriva mai al registro, nemmeno per le quattro categorie.
      const errore = Object.assign(new Error("Failed to fetch stream from http://segreto.example/dati?chiave=SEGRETA"), { output: { statusCode: 500 } });
      const x = await nuovo({ maxPause: 3, scarica: async () => { throw errore; } });
      await tutteAuto(x);
      for (const [i, cat] of ["audio", "video", "documento"].entries()) x.img.accoda(media(cat, i + 1));
      await x.img.avvia();
      const tutto = x.stato.log.join("\n");
      c("errori di Baileys su audio, video, documento: nessun url, host o segreto nel registro", [], ["http", "segreto", "SEGRETA", "Failed", "example", NUMERO, "bw:"].filter((t) => tutto.includes(t)));
    }
    {
      //  Il codice: `scarica(` una volta sola, col tipo preso dalla tabella.
      const chiamate = [...codice.matchAll(/\bscarica\(([^)]*)\)/g)].map((m) => m[1].replace(/\s+/g, " ").trim());
      c("nel codice scarica( compare una volta sola, col tipo di TIPO_BAILEYS e l'host nostro", ["copia, TIPO_BAILEYS[lavoro.categoria], { host: lavoro.host }"], chiamate);
      c("la tabella TIPO_BAILEYS ha esattamente 4 voci scritte nel codice", true, /const TIPO_BAILEYS = \{\s*foto: "image",\s*audio: "audio",\s*video: "video",\s*documento: "document",?\s*\}/.test(codice));
      c("nessun fetch verso indirizzi diversi dall'URL di carico validato (immagini.mjs non parla col CRM da sola: usa spedisci)", [], [...codice.matchAll(/\bfetch\s*\(\s*(\w+)/g)].map((m) => m[1]).filter((a) => a !== "urlCarico"));
    }

    // ── 13. La sicurezza del registro, sul sorgente ──────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: NIENTE NEL REGISTRO CHE NON SIA UN CODICE (c.1 punto 4)");
    {
      const chiamateRegistro = [...codice.matchAll(/registro\(\s*([^)]*)\)/g)].map((m) => m[1]);
      c("ogni registro(...) ha come primo argomento una parola fissa tra virgolette", [], chiamateRegistro.filter((a) => !/^"[a-z_]+"/.test(a)));
      c("ci sono chiamate al registro (la guardia non è vuota)", true, chiamateRegistro.length > 5);
      c("nel codice l'errore non si legge mai (.message, .stack, String(e), template con l'errore)", [], [/\.message\b|\.stack\b/.test(codice) ? "message/stack" : null, /String\(\s*e\w*\s*\)|\$\{\s*e\w*\s*\}|JSON\.stringify\(\s*e\w*\s*\)/.test(codice) ? "errore trasformato in testo" : null].filter(Boolean));
    }
  } finally {
    await Promise.all(cataloghi.map((k) => k.ferma().catch(() => {})));
    rmSync(base, { recursive: true, force: true });
  }
}
