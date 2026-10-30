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
  const base = mkdtempSync(join(tmpdir(), "ponte-immagini-"));
  let n = 0;

  /** Un'istanza con tutto finto. `server` = risposte del CRM per tipo di richiesta. */
  function nuovo(opz = {}) {
    const cartella = join(base, `i${n++}`);
    return montaSu(cartella, opz);
  }
  function montaSu(cartella, opz = {}) {
    const stato = { ora: opz.ora ?? T0, pause: [], chiamate: [], violazioni: [], log: [], scarichi: [], put: [], avvii: [] };
    const server = {
      permesso: () => ({ stato: 200, corpo: { ok: true, esito: "carica", url_carico: CARICO } }),
      fatto: () => ({ stato: 200, corpo: { ok: true, esito: "pronta" } }),
      put: () => ({ status: 200 }),
      ...(opz.server ?? {}),
    };
    const fetchFinto = async (indirizzo, init = {}) => {
      const corpo = init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
      stato.chiamate.push({ url: String(indirizzo), metodo: init.method ?? "GET", corpo, intestazioni: init.headers ?? {}, ora: stato.ora, byte: Buffer.isBuffer(init.body) ? init.body.length : null, redirect: init.redirect });
      if (String(indirizzo) === PONTE) {
        const r = corpo?.tipo === "media_permesso" ? server.permesso(corpo) : corpo?.tipo === "media_fatto" ? server.fatto(corpo) : { stato: 400, corpo: { ok: false } };
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
          return flusso(JPEG);
        };
    const registro = (codice, conteggi = {}) => {
      const buono = typeof codice === "string" && /^[a-z_]+$/.test(codice) && Object.entries(conteggi).every(([k, v]) => /^[a-z_]+$/.test(k) && typeof v === "number");
      if (!buono) stato.violazioni.push(`registro non pulito: ${String(codice)}`);
      stato.log.push(`${codice} ${JSON.stringify(conteggi)}`);
    };
    let istanza;
    const pianifica = (f, ms) => {
      stato.pause.push(ms);
      stato.ora += ms;
      if (stato.pause.length > (opz.maxPause ?? 200)) istanza.ferma();
      setImmediate(f);
    };
    istanza = I.creaImmagini({
      url: PONTE,
      token: "t".repeat(40),
      cartella,
      scarica,
      fetch: fetchFinto,
      registro,
      orologio: () => stato.ora,
      casuale: () => 0.5,
      pianifica,
      timeoutScaricoMs: opz.timeoutScaricoMs ?? 30_000,
      ...(opz.opzioni ?? {}),
    });
    return { img: istanza, stato, cartella, coda: join(cartella, "coda") };
  }
  const nelDisco = (coda) => (existsSync(coda) ? readdirSync(coda).filter((f) => f.endsWith(".json")) : []);
  const accodaUna = (x, i = 1, immagine = img(), ts = TS) => x.img.accoda({ chiave: chiave(i), immagine, ts });

  try {
    // ── 0. Il file e le sue regole fisse ────────────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: LIMITI E CODICE (compito T6)");
    const grezzo = readFileSync(join(src, "immagini.mjs"), "utf8");
    const codice = grezzo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    c("limiti: 8 MiB, +10 %, 30 s, 14 giorni, 5.000 file, 600 all'ora, 2–5 s", [8 * MIB, 1.1, 30_000, 14, 5000, 600, 2000, 5000], [I.LIMITI_IMMAGINI.maxByte, I.LIMITI_IMMAGINI.tolleranza, I.LIMITI_IMMAGINI.timeoutMs, I.LIMITI_IMMAGINI.giorni, I.LIMITI_IMMAGINI.maxCoda, I.LIMITI_IMMAGINI.allOra, I.LIMITI_IMMAGINI.pausaMinMs, I.LIMITI_IMMAGINI.pausaMaxMs]);
    c("attese di un lavoro che non riesce: 5 min, 15 min, 1 h, 3 h", [300_000, 900_000, 3_600_000, 10_800_000], I.LIMITI_IMMAGINI.attese);
    c("interruttore spento: il ciclo dorme 1 ora; tetto pieno: 6 ore", [3_600_000, 21_600_000], [I.LIMITI_IMMAGINI.pausaSpentaMs, I.LIMITI_IMMAGINI.pausaTettoMs]);
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

    c("tipoDaByte: JPEG, PNG, WebP, altro", ["image/jpeg", "image/png", "image/webp", null, null], [I.tipoDaByte(JPEG), I.tipoDaByte(PNG), I.tipoDaByte(WEBP), I.tipoDaByte(Buffer.from("<svg onload=alert(1)>")), I.tipoDaByte(Buffer.alloc(0))]);

    // ── 2. Il download protetto (c.1 punti 2-5) ─────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: IL DOWNLOAD PROTETTO (c.1)");
    {
      const x = nuovo({ scarica: scaricaStileBaileys(async (ind) => void 0, () => flusso(JPEG)) });
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
      const x = nuovo({ scarica: scaricaStileBaileys(async (ind) => void richieste.push(ind), () => flusso(JPEG)) });
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
        const x = nuovo({ scarica: scaricaStileBaileys(async (ind) => void richieste.push(ind), () => flusso(JPEG)) });
        const r = accodaUna(x, 1, img({ url }));
        await x.img.avvia();
        if (richieste.length || x.stato.chiamate.length || x.stato.scarichi.length) tutteSenzaRichieste = false;
        if (r.ok !== false || r.motivo !== "origine_non_valida") tutteScartate = false;
        sulDisco += nelDisco(x.coda).length;
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
        const x = nuovo({ scarica: scaricaStileBaileys(async () => void richieste++, () => flusso(JPEG)) });
        accodaUna(x, 1, img({ directPath }));
        await x.img.avvia();
        richieste += x.stato.chiamate.length + x.stato.scarichi.length;
      }
      c("con un directPath ostile (anche //evil e ..): nessuna richiesta", 0, richieste);
    }
    {
      //  Un job nel disco manomesso (host 127.0.0.1, chiave sbagliata, nome sbagliato): scartato al caricamento.
      const x = nuovo();
      accodaUna(x, 1);
      accodaUna(x, 2);
      accodaUna(x, 3);
      const nomi = nelDisco(x.coda);
      const leggi = (f) => JSON.parse(readFileSync(join(x.coda, f), "utf8"));
      const f1 = nomeFile(chiave(1));
      const f2 = nomeFile(chiave(2));
      writeFileSync(join(x.coda, f1), JSON.stringify({ ...leggi(f1), host: "127.0.0.1" }));
      writeFileSync(join(x.coda, f2), JSON.stringify({ ...leggi(f2), directPath: "//evil.example/x" }));
      const y = montaSu(x.cartella);
      await y.img.avvia();
      c("coda manomessa (host 127.0.0.1, directPath //evil): quei lavori non partono, il terzo sì", [3, 1, []], [nomi.length, y.stato.scarichi.length, y.stato.violazioni]);
    }
    {
      //  Peso: il flusso senza fine si ferma al tetto; il peso dichiarato non conta.
      const x = nuovo({ scarica: async (a, b, o, s) => { const f = infinito(); s.flusso = f; return f; } });
      accodaUna(x, 1, img({ fileLength: 100 }));
      await x.img.avvia();
      c("flusso infinito: fermato al tetto, distrutto, lavoro scartato (non resta)", [true, 0, 0], [x.stato.flusso?.destroyed, nelDisco(x.coda).length, x.stato.put.length]);
      c("flusso infinito: nessun upload e nessun fatto", ["media_permesso"], x.stato.chiamate.filter((k) => k.corpo).map((k) => k.corpo.tipo));
      c("flusso infinito: contato fra le scartate, non fra gli errori", [1, 0], [x.img.contatori().scartate, x.img.contatori().errori]);
    }
    {
      //  Flusso FERMO: nessun pezzo, quindi un controllo dentro il ciclo non scatterebbe. Promise.race con un timer.
      const x = nuovo({ maxPause: 1, timeoutScaricoMs: 40, scarica: async (a, b, o, s) => { const f = fermo(); s.flusso = f; return f; } });
      accodaUna(x, 1);
      const t = performance.now();
      await x.img.avvia();
      const ms = performance.now() - t;
      c("flusso fermo: il timeout scatta (40 ms nella prova) e il flusso è distrutto", [true, true], [ms < 1500, x.stato.flusso?.destroyed]);
      c("flusso fermo: il lavoro resta in coda con un tentativo, nessun upload", [1, 0], [nelDisco(x.coda).length, x.stato.put.length]);
      c("flusso fermo: 'errori' conta solo i lavori scartati, non i tentativi", 0, x.img.contatori().errori);
    }
    {
      //  La chiamata a scarica() che non risolve mai (la fetch interna pende): stesso timer.
      const x = nuovo({ maxPause: 1, timeoutScaricoMs: 40, scarica: () => new Promise(() => {}) });
      accodaUna(x, 1);
      const t = performance.now();
      await x.img.avvia();
      c("scarica() che non risponde mai: il timeout scatta lo stesso, il lavoro resta", [true, 1], [performance.now() - t < 1500, nelDisco(x.coda).length]);
    }
    {
      //  Una scarica() che risolve DOPO il timeout: il flusso tardivo si distrugge.
      let tardivo = null;
      const x = nuovo({ maxPause: 1, timeoutScaricoMs: 30, scarica: () => new Promise((ok) => setTimeout(() => ok((tardivo = fermo())), 120)) });
      accodaUna(x, 1);
      await x.img.avvia();
      await new Promise((r) => setTimeout(r, 250));
      c("scarica() tardiva: il flusso che arriva dopo il timeout viene distrutto", true, tardivo?.destroyed === true);
    }
    {
      //  Un errore di Baileys con l'url dentro: il registro non lo vede mai.
      const errore = Object.assign(new Error("Failed to fetch stream from http://segreto.example/dati?chiave=SEGRETA"), { output: { statusCode: 500 }, data: { url: "http://segreto.example/dati" } });
      const x = nuovo({ maxPause: 1, scarica: async () => { throw errore; } });
      accodaUna(x, 1);
      await x.img.avvia();
      const tutto = x.stato.log.join("\n");
      c("errore di Baileys con url nel testo: il registro non contiene url, host, segreti", [], ["http", "segreto", "SEGRETA", "Failed", "fetch stream", "example"].filter((s) => tutto.includes(s)));
      c("errore di Baileys con url nel testo: nessuna violazione del registro; il lavoro resta (500)", [[], 1], [x.stato.violazioni, nelDisco(x.coda).length]);
      c("il registro non contiene numeri di cliente né chiavi", [], [NUMERO, "bw:", "ID0001"].filter((s) => tutto.includes(s)));
    }
    {
      //  404 e 410 → scaduta (definitiva); 403/500/senza codice → resta.
      for (const [stato, atteso] of [[404, "scartato"], [410, "scartato"], [403, "resta"], [500, "resta"], [undefined, "resta"]]) {
        const x = nuovo({ maxPause: 1, scarica: async () => { throw Object.assign(new Error("http://x"), stato ? { output: { statusCode: stato } } : {}); } });
        accodaUna(x, 1);
        await x.img.avvia();
        const rimasti = nelDisco(x.coda).length;
        c(`download ${stato ?? "senza codice"}: ${atteso}`, [atteso === "resta" ? 1 : 0, stato === 404 || stato === 410 ? 1 : 0], [rimasti, x.img.contatori().scadute]);
      }
      const y = nuovo({ scarica: async () => { throw Object.assign(new Error("x"), { statusCode: 404 }); } });
      accodaUna(y, 1);
      await y.img.avvia();
      c("download: il 404 si legge anche da statusCode del Boom", [0, 1], [nelDisco(y.coda).length, y.img.contatori().scadute]);
    }
    {
      //  Controllo dei byte magici: SVG/HTML dichiarati come JPEG non passano.
      for (const [nome, dati, mime] of [["SVG", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>"), "image/jpeg"], ["HTML", Buffer.from("<html><script>x</script></html>"), "image/png"], ["PNG dichiarato JPEG", PNG, "image/jpeg"], ["vuoto", Buffer.alloc(0), "image/jpeg"]]) {
        const x = nuovo({ scarica: async () => flusso(dati) });
        accodaUna(x, 1, img({ mimetype: mime }));
        await x.img.avvia();
        c(`byte magici: ${nome} → scartato, nessun upload`, [0, 0], [nelDisco(x.coda).length, x.stato.put.length]);
      }
      for (const [nome, dati, mime] of [["JPEG", JPEG, "image/jpeg"], ["PNG", PNG, "image/png"], ["WebP", WEBP, "image/webp"]]) {
        const x = nuovo({ scarica: async () => flusso(dati) });
        accodaUna(x, 1, img({ mimetype: mime }));
        await x.img.avvia();
        c(`byte magici: ${nome} → caricato`, [1, 0, mime], [x.stato.put.length, nelDisco(x.coda).length, x.stato.chiamate.find((k) => k.metodo === "PUT")?.intestazioni["Content-Type"]]);
      }
      const pezzi = nuovo({ scarica: async () => flusso(JPEG.subarray(0, 3), JPEG.subarray(3, 50), JPEG.subarray(50)) });
      accodaUna(pezzi, 1);
      await pezzi.img.avvia();
      c("il flusso a più pezzi si rimette insieme", true, Buffer.compare(pezzi.stato.put[0] ?? Buffer.alloc(0), JPEG) === 0);
    }
    {
      //  Oltre 8 MiB (ma sotto il tetto di lettura): scartata troppo_grande; sopra +10 %: fermata.
      const grande = Buffer.concat([JPEG, Buffer.alloc(8 * MIB + 100, 1)]);
      const x = nuovo({ scarica: async () => flusso(grande) });
      accodaUna(x, 1);
      await x.img.avvia();
      c("immagine di 8 MiB + 100 byte: scartata, nessun upload", [0, 0, 1], [nelDisco(x.coda).length, x.stato.put.length, x.img.contatori().scartate]);
      const limite = Buffer.concat([JPEG, Buffer.alloc(8 * MIB - JPEG.length, 1)]);
      const y = nuovo({ scarica: async () => flusso(limite) });
      accodaUna(y, 1);
      await y.img.avvia();
      c("immagine di esattamente 8 MiB: caricata", [1, 8 * MIB], [y.stato.put.length, y.stato.put[0]?.length]);
    }

    // ── 3. Il flusso con il CRM (c.3) ───────────────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: PERMESSO, CARICO, FATTO (c.3)");
    {
      const x = nuovo();
      accodaUna(x, 1, img({ fileLength: 1234 }));
      await x.img.avvia();
      const [p, put, f] = x.stato.chiamate;
      c("tre richieste in ordine: permesso al ponte, PUT sull'URL di carico, fatto al ponte", [PONTE, CARICO, PONTE], [p?.url, put?.url, f?.url]);
      c("permesso: {v:1, tipo, chiave, mime, byte} e il token nell'intestazione", [{ v: 1, tipo: "media_permesso", chiave: chiave(1), mime: "image/jpeg", byte: 1234 }, "t".repeat(40)], [p?.corpo, p?.intestazioni["X-HGL-Token"]]);
      c("fatto: {v:1, tipo, chiave} e niente altro (il peso del Mac non si usa)", { v: 1, tipo: "media_fatto", chiave: chiave(1) }, f?.corpo);
      c("PUT: i byte scaricati, il tipo vero, senza upsert, senza seguire redirect", [JPEG.length, "image/jpeg", "false", "error"], [put?.byte, put?.intestazioni["Content-Type"], put?.intestazioni["x-upsert"], put?.redirect]);
      c("PUT: l'unico PUT è sull'URL del CRM, nessuna violazione del fetch finto", [[], 1], [x.stato.violazioni, x.stato.chiamate.filter((k) => k.metodo === "PUT").length]);
      c("fine: ok 1, coda su disco vuota", [1, 0, 0], [x.img.contatori().ok, x.img.contatori().in_coda, nelDisco(x.coda).length]);
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
        const x = nuovo({ server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "carica", url_carico } }) }, maxPause: 4 });
        accodaUna(x, 1);
        await x.img.avvia();
        put += x.stato.chiamate.filter((k) => k.metodo === "PUT").length;
        violazioni = violazioni.concat(x.stato.violazioni);
        rimasti += nelDisco(x.coda).length;
      }
      c("url_carico non valido (http, host estraneo, altro bucket…): mai un PUT, mai una fetch fuori lista", [0, []], [put, violazioni]);
      c("url_carico non valido: i lavori restano in coda (colpa del server, non della foto)", Object.keys(cattivi).length, rimasti);
    }

    // ── 4. La tabella di c.2, riga per riga ─────────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: COSA SI TIENE E COSA SI SCARTA (c.2)");
    {
      const caso = async (nome, server, { resta, scartata = 0, chiamateAlMassimo = 40, pausa } = {}) => {
        const x = nuovo({ server, maxPause: 6 });
        accodaUna(x, 1);
        await x.img.avvia();
        c(`${nome}: ${resta ? "il lavoro RESTA" : "il lavoro è scartato"}`, resta ? 1 : 0, nelDisco(x.coda).length);
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
      const tetto = await caso("rifiutato: tetto", rif("tetto"), { resta: true, pausa: 21_600_000 });
      c("rifiutato: tetto → contato in 'tetto' (a ogni risposta del CRM)", true, tetto.img.contatori().tetto >= 1);
      await caso("rifiutato: troppo_grande", rif("troppo_grande"), { resta: false });
      await caso("rifiutato: tipo", rif("tipo"), { resta: false });
      await caso("già presente", { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "gia_presente" } }) }, { resta: false });
      await caso("rifiutato con un motivo che non conosciamo", rif("boh"), { resta: true });
    }
    {
      //  Le attese del server: 5 min → 15 min → 1 h → 3 h, e il lavoro non si consuma.
      const x = nuovo({ server: { permesso: () => ({ stato: 400, corpo: null }) }, maxPause: 12 });
      accodaUna(x, 1);
      await x.img.avvia();
      const lunghe = x.stato.pause.filter((ms) => ms > 10_000).map((ms) => Math.round(ms / 60_000));
      c("Worker vecchio: le attese salgono 5, 15, 60, 180 minuti e poi restano a 180", [5, 15, 60, 180, 180], lunghe.slice(0, 5));
      c("Worker vecchio, dopo molti tentativi: la foto c'è ancora (nessun conteggio di errori)", [1, 0], [nelDisco(x.coda).length, x.img.contatori().errori]);
    }
    {
      //  Lo stesso Worker che torna a funzionare: il lavoro trattenuto parte e finisce.
      let n = 0;
      const x = nuovo({ server: { permesso: () => (n++ < 2 ? { stato: 503, corpo: null } : { stato: 200, corpo: { ok: true, esito: "carica", url_carico: CARICO } }) } });
      accodaUna(x, 1);
      await x.img.avvia();
      c("503 due volte, poi il server c'è: la foto viene caricata", [1, 0, 1], [x.stato.put.length, nelDisco(x.coda).length, x.img.contatori().ok]);
    }
    {
      //  PUT che fallisce: per lavoro 5 min, 15 min, 1 h, 3 h; al quinto tentativo scartato (errori).
      const x = nuovo({ server: { put: () => ({ status: 500 }) }, maxPause: 40 });
      accodaUna(x, 1);
      await x.img.avvia();
      const lunghe = x.stato.pause.filter((ms) => ms > 10_000).map((ms) => Math.round(ms / 60_000));
      c("PUT fallito: attese di 5, 15, 60, 180 minuti", [5, 15, 60, 180], lunghe);
      c("PUT fallito 5 volte: scartato, contato in 'errori', cinque PUT in tutto", [0, 1, 5], [nelDisco(x.coda).length, x.img.contatori().errori, x.stato.put.length]);
      c("PUT fallito: mai il 'fatto'", 0, x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_fatto").length);
    }
    {
      const x = nuovo({ server: { put: () => ({ rete: true }) }, maxPause: 40 });
      accodaUna(x, 1);
      await x.img.avvia();
      c("PUT senza rete (eccezione): stessa regola, scartato al quinto", [0, 1], [nelDisco(x.coda).length, x.img.contatori().errori]);
      const tutto = x.stato.log.join("\n");
      c("PUT senza rete: nessun testo dell'errore nel registro", false, tutto.includes("rete assente"));
    }
    {
      //  PUT fallito due volte, poi riesce: il lavoro finisce.
      let n = 0;
      const x = nuovo({ server: { put: () => ({ status: n++ < 2 ? 503 : 200 }) } });
      accodaUna(x, 1);
      await x.img.avvia();
      c("PUT fallito due volte e poi buono: caricata, coda vuota", [3, 0, 1], [x.stato.put.length, nelDisco(x.coda).length, x.img.contatori().ok]);
    }
    {
      //  PUT 409 (l'oggetto c'è già, la risposta si era persa): si va al 'fatto'.
      const x = nuovo({ server: { put: () => ({ status: 409 }) } });
      accodaUna(x, 1);
      await x.img.avvia();
      c("PUT 409 (oggetto già presente): si passa al 'fatto' e il lavoro finisce", [1, 0], [x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_fatto").length, nelDisco(x.coda).length]);
    }
    {
      //  'fatto' che non va: la foto è già su Storage, il lavoro resta SENZA riscaricare né ricaricare.
      let n = 0;
      const x = nuovo({ server: { fatto: () => (n++ < 2 ? { stato: 500, corpo: null } : { stato: 200, corpo: { ok: true, esito: "pronta" } }) } });
      accodaUna(x, 1);
      await x.img.avvia();
      c("'fatto' fallito due volte: un solo download, un solo PUT, tre 'fatto', poi finito", [1, 1, 3, 0, 1], [x.stato.scarichi.length, x.stato.put.length, x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_fatto").length, nelDisco(x.coda).length, x.img.contatori().ok]);
      c("'fatto' ritentato senza ripetere il permesso", 1, x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_permesso").length);
    }
    {
      //  L'esito di 'fatto' è quello VERO di T5 (media-tipi.ts): sempre 200 {ok:true, esito:"pronta"|"in_caricamento"|"assente"}.
      const fatti = (x) => x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_fatto").length;
      const permessiChiesti = (x) => x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_permesso").length;
      const risposta = (esito) => ({ stato: 200, corpo: esito === undefined ? { ok: true } : { ok: true, esito } });

      const a1 = nuovo({ server: { fatto: () => risposta("pronta") } });
      accodaUna(a1, 1);
      await a1.img.avvia();
      c("'fatto' → pronta: lavoro concluso, contato 'ok', file tolto", [1, 0], [a1.img.contatori().ok, nelDisco(a1.coda).length]);

      //  in_caricamento: la foto NON è pronta, il lavoro resta con caricato:true e si ritenta solo il 'fatto'.
      const b1 = nuovo({ server: { fatto: () => risposta("in_caricamento") }, maxPause: 1 });
      accodaUna(b1, 1);
      await b1.img.avvia();
      const dopo1 = JSON.parse(readFileSync(join(b1.coda, nomeFile(chiave(1))), "utf8"));
      c("'fatto' → in_caricamento: il lavoro RESTA (non è 'ok'), con caricato:true e un guasto", [0, 1, true, 1], [b1.img.contatori().ok, nelDisco(b1.coda).length, dopo1.caricato, dopo1.guasti]);
      const b2 = nuovo({ server: { fatto: () => risposta("in_caricamento") }, maxPause: 40 });
      accodaUna(b2, 1);
      await b2.img.avvia();
      const lunghe = b2.stato.pause.filter((ms) => ms > 10_000).map((ms) => Math.round(ms / 60_000));
      c("'fatto' → in_caricamento sempre: 5 tentativi con attese 5, 15, 60, 180 minuti, poi scartato 'errori'", [[5, 15, 60, 180], 5, 0, 1, 0], [lunghe, fatti(b2), nelDisco(b2.coda).length, b2.img.contatori().errori, b2.img.contatori().ok]);
      c("in_caricamento: un solo download, un solo PUT, un solo permesso (si ritenta solo il 'fatto')", [1, 1, 1], [b2.stato.scarichi.length, b2.stato.put.length, permessiChiesti(b2)]);
      let n1 = 0;
      const b3 = nuovo({ server: { fatto: () => risposta(n1++ < 2 ? "in_caricamento" : "pronta") } });
      accodaUna(b3, 1);
      await b3.img.avvia();
      c("in_caricamento due volte, poi pronta: finito, contato 'ok'", [1, 0, 3], [b3.img.contatori().ok, nelDisco(b3.coda).length, fatti(b3)]);

      //  assente: la riga di permesso non c'è più → caricato:false e si rifà il permesso (e il carico).
      let n2 = 0;
      const d1 = nuovo({ server: { fatto: () => risposta(n2++ < 1 ? "assente" : "pronta") } });
      accodaUna(d1, 1);
      await d1.img.avvia();
      c("'fatto' → assente: si rifà il permesso, il download e il carico; poi pronta", [2, 2, 2, 2, 1, 0], [permessiChiesti(d1), d1.stato.scarichi.length, d1.stato.put.length, fatti(d1), d1.img.contatori().ok, nelDisco(d1.coda).length]);
      const d2 = nuovo({ server: { fatto: () => risposta("assente") }, maxPause: 1 });
      accodaUna(d2, 1);
      await d2.img.avvia();
      const dopo2 = JSON.parse(readFileSync(join(d2.coda, nomeFile(chiave(1))), "utf8"));
      c("'fatto' → assente: nel file caricato:false e un guasto contato; il lavoro resta", [false, 1, 0], [dopo2.caricato === true, dopo2.guasti, d2.img.contatori().ok]);
      const d3 = nuovo({ server: { fatto: () => risposta("assente") }, maxPause: 80 });
      accodaUna(d3, 1);
      await d3.img.avvia();
      c("'fatto' → assente sempre: dopo 5 tentativi scartato 'errori' (nessun giro infinito)", [0, 1, 0], [nelDisco(d3.coda).length, d3.img.contatori().errori, d3.img.contatori().ok]);

      //  Qualunque altra risposta 200+ok senza 'pronta' è 'non pronta'.
      for (const [nome, esito] of [["senza esito", undefined], ["esito sconosciuto", "forse"], ["esito non stringa", 7]]) {
        const e1 = nuovo({ server: { fatto: () => risposta(esito) }, maxPause: 1 });
        accodaUna(e1, 1);
        await e1.img.avvia();
        c(`'fatto' ${nome}: non è pronta, il lavoro resta e non è contato 'ok'`, [0, 1], [e1.img.contatori().ok, nelDisco(e1.coda).length]);
      }
    }
    {
      //  Un lavoro "avvelenato" (il CRM gli risponde sempre 500) non ferma la coda e dopo 5 tentativi è scartato.
      let x;
      let nuove = 0;
      x = nuovo({
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
      c("lavoro avvelenato (sempre 500) mentre le altre foto vanno: scartato 'errori' al 5° tentativo", [1, 0], [x.img.contatori().errori, nelDisco(x.coda).length]);
      c("  e le altre foto sono state caricate (tutte), nessuna persa", [nuove, nuove], [x.img.contatori().ok, x.stato.put.length]);
      c("  il lavoro avvelenato ha chiesto il permesso 5 volte, non di più", 5, x.stato.chiamate.filter((k) => k.corpo?.chiave === chiave(1)).length);

      //  Un CRM giù per TUTTI (nessuna risposta buona) non scarta niente.
      const giu = nuovo({ server: { permesso: () => ({ stato: 500, corpo: null }) }, maxPause: 60 });
      for (let i = 1; i <= 3; i++) accodaUna(giu, i);
      await giu.img.avvia();
      c("Worker che dà 500 a tutti per ore: nessun lavoro scartato, tutti e 3 restano", [0, 3, 0], [giu.img.contatori().errori, nelDisco(giu.coda).length, giu.img.contatori().ok]);
    }
    {
      //  L'URL di carico può stare anche su <ref>.storage.supabase.co.
      const nuovoDominio = "https://abcdefgh.storage.supabase.co/storage/v1/object/upload/sign/ponte-media/u/p.jpg?token=A";
      const x = nuovo({ server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "carica", url_carico: nuovoDominio } }) } });
      accodaUna(x, 1);
      await x.img.avvia();
      const dominiNo = nuovo({ server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "carica", url_carico: "https://abcdefgh.storage.supabase.co.evil.example/storage/v1/object/upload/sign/ponte-media/u/p.jpg" } }) }, maxPause: 2 });
      accodaUna(dominiNo, 1);
      await dominiNo.img.avvia();
      c("url_carico su <ref>.storage.supabase.co: accettato; con un suffisso estraneo no", [1, 0, []], [x.stato.chiamate.filter((k) => k.metodo === "PUT" && k.url === nuovoDominio).length, dominiNo.stato.put.length, dominiNo.stato.violazioni]);
    }

    // ── 5. La coda su disco (D5, c.2) ───────────────────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: LA CODA SU DISCO (c.2)");
    {
      const x = nuovo();
      const r = accodaUna(x, 1, img(), TS);
      const [f] = nelDisco(x.coda);
      c("accoda: ok, un file nominato dall'impronta della chiave (nessun numero nel nome)", [true, nomeFile(chiave(1)), false], [r.ok, f, f?.includes(NUMERO)]);
      c("permessi: cartelle 700, file 600", [0o700, 0o700, 0o600], [permessi(x.cartella), permessi(x.coda), permessi(join(x.coda, f))]);
      const dati = JSON.parse(readFileSync(join(x.coda, f), "utf8"));
      c("nel file: chiave, mime, peso, host, percorso, chiave del media (base64 di 32 byte) e orario del messaggio", [chiave(1), "image/jpeg", 4000, "mmg.whatsapp.net", DIRECT, 32, TS], [dati.chiave, dati.mime, dati.byte, dati.host, dati.directPath, Buffer.from(dati.mediaKey, "base64").length, dati.ts]);
      c("nel file non c'è l'url del messaggio", false, readFileSync(join(x.coda, f), "utf8").includes("url"));
      c("nessun file temporaneo rimasto", [], readdirSync(x.coda).filter((n2) => !n2.endsWith(".json")));
      c("la stessa foto due volte: una sola riga in coda", [true, "gia_in_coda", 1], [accodaUna(x, 1).ok === false, accodaUna(x, 1).motivo, nelDisco(x.coda).length]);
      c("in_coda conta i lavori", 1, x.img.contatori().in_coda);
    }
    {
      //  Un permesso sbagliato nelle cartelle già esistenti (umask a 022) viene corretto.
      const cartella = join(base, "perm");
      mkdirSync(join(cartella, "coda"), { recursive: true, mode: 0o755 });
      const x = montaSu(cartella);
      c("cartelle già esistenti con 755 → 700", [0o700, 0o700], [permessi(x.cartella), permessi(x.coda)]);
    }
    {
      //  Riavvio: la coda su disco riprende.
      const x = nuovo();
      accodaUna(x, 1);
      accodaUna(x, 2);
      accodaUna(x, 3);
      const y = montaSu(x.cartella);
      c("riavvio: i tre lavori sono ancora lì", 3, y.img.contatori().in_coda);
      await y.img.avvia();
      c("riavvio: ripresi e finiti (tre PUT)", [3, 0], [y.stato.put.length, nelDisco(y.coda).length]);
    }
    {
      //  A metà: un lavoro che ha già un guasto e un'attesa non perde il conto.
      const x = nuovo({ server: { put: () => ({ status: 500 }) }, maxPause: 1 });
      accodaUna(x, 1);
      await x.img.avvia();
      const dopo = JSON.parse(readFileSync(join(x.coda, nomeFile(chiave(1))), "utf8"));
      c("dopo un guasto il file porta il numero di guasti e l'attesa (e resta 600)", [1, true, 0o600], [dopo.guasti, dopo.prossimo_il > T0, permessi(join(x.coda, nomeFile(chiave(1))))]);
      const y = montaSu(x.cartella, { server: { put: () => ({ status: 500 }) }, maxPause: 40 });
      y.stato.ora = x.stato.ora;
      await y.img.avvia();
      c("riavviato: continua dal conto di prima (5 PUT in tutto, non 5 in più)", [4, 1], [y.stato.put.length, y.img.contatori().errori]);
    }
    {
      //  File corrotti, nomi estranei, resti temporanei.
      const cartella = join(base, "corrotti");
      mkdirSync(join(cartella, "coda"), { recursive: true, mode: 0o700 });
      const buono = nuovo();
      accodaUna(buono, 7);
      const fb = nomeFile(chiave(7));
      const sano = readFileSync(join(buono.coda, fb), "utf8");
      const hash = (s) => createHash("sha256").update(s).digest("hex");
      writeFileSync(join(cartella, "coda", fb), sano, { mode: 0o600 });
      writeFileSync(join(cartella, "coda", `${hash("a")}.json`), "{non è json", { mode: 0o600 });
      writeFileSync(join(cartella, "coda", `${hash("b")}.json`), "[]", { mode: 0o600 });
      writeFileSync(join(cartella, "coda", `${hash("c")}.json`), JSON.stringify({ ...JSON.parse(sano), chiave: "bw:abc:1" }), { mode: 0o600 });
      writeFileSync(join(cartella, "coda", `${hash("d")}.json`), JSON.stringify({ ...JSON.parse(sano), mediaKey: Buffer.alloc(8).toString("base64") }), { mode: 0o600 });
      writeFileSync(join(cartella, "coda", `${hash("e")}.json`), JSON.stringify({ ...JSON.parse(sano), mime: "image/svg+xml" }), { mode: 0o600 });
      writeFileSync(join(cartella, "coda", "nome-strano.json"), sano, { mode: 0o600 });
      writeFileSync(join(cartella, "coda", `${fb}.tmp-123`), sano, { mode: 0o600 });
      const x = montaSu(cartella);
      c("file corrotti, di un'altra chiave, con chiave media o tipo falsi, nome strano, resti .tmp: tutti scartati, resta il buono", [1, [fb]], [x.img.contatori().in_coda, readdirSync(x.coda)]);
      await x.img.avvia();
      c("il lavoro buono parte, gli altri non fanno nessuna richiesta", [1, 1], [x.stato.put.length, x.stato.scarichi.length]);
      c("il registro conta i file corrotti, senza dire quali", true, x.stato.log.some((r) => r.startsWith("immagini_coda_corrotta")));
    }
    {
      //  Scadenza: 14 giorni dal messaggio.
      const x = nuovo();
      const adesso = x.stato.ora / 1000;
      const dentro = accodaUna(x, 1, img(), adesso - 14 * GIORNO_S + 120);
      const fuori = accodaUna(x, 2, img(), adesso - 14 * GIORNO_S - 120);
      c("accoda: messaggio di 14 giorni meno 2 minuti → in coda; più vecchio di 14 giorni → scartato (vecchia), niente su disco", [true, false, "vecchia", 1], [dentro.ok, fuori.ok, fuori.motivo, nelDisco(x.coda).length]);
      c("la vecchia non è una 'scaduta' (non si è nemmeno tentato): sta nelle scartate", [0, 1], [x.img.contatori().scadute, x.img.contatori().scartate]);
      //  Un lavoro che invecchia in coda: dopo 14 giorni sparisce da solo.
      const y = nuovo({ server: { permesso: () => ({ stato: 503, corpo: null }) }, maxPause: 30 });
      accodaUna(y, 1, img(), y.stato.ora / 1000 - 13 * GIORNO_S);
      y.stato.ora += 2 * 86_400_000;
      await y.img.avvia();
      c("un lavoro trattenuto che compie 14 giorni viene tolto e contato 'scadute'", [0, 1], [nelDisco(y.coda).length, y.img.contatori().scadute]);
      //  All'avvio: un file già scaduto non parte.
      const z = nuovo();
      accodaUna(z, 1, img(), z.stato.ora / 1000 - 13 * GIORNO_S);
      const w = montaSu(z.cartella, { ora: T0 + 3 * 86_400_000 });
      c("all'avvio un lavoro già scaduto (13 giorni + 3) è tolto subito e contato", [0, 0, 1], [w.img.contatori().in_coda, nelDisco(w.coda).length, w.img.contatori().scadute]);
    }
    {
      //  Tetto di 5.000 file (qui 3 per brevità) e il valore vero.
      const x = nuovo({ opzioni: { maxCoda: 3 } });
      const esiti = [1, 2, 3, 4, 5].map((i) => accodaUna(x, i));
      c("coda piena: oltre il tetto il lavoro nuovo è scartato, contato 'coda_piena'", [[true, true, true, false, false], "coda_piena", 3, 2], [esiti.map((e) => e.ok), esiti[3].motivo, nelDisco(x.coda).length, x.img.contatori().coda_piena]);
      c("il tetto di serie è 5.000", 5000, I.LIMITI_IMMAGINI.maxCoda);
    }
    {
      //  Altri scarti all'ingresso: tipo, peso.
      const x = nuovo();
      const r = (m) => accodaUna(x, 9, m);
      c("tipo non ammesso (gif, svg, heic, vuoto, assente) → 'tipo'", ["tipo", "tipo", "tipo", "tipo", "tipo"], [r(img({ mimetype: "image/gif" })).motivo, r(img({ mimetype: "image/svg+xml" })).motivo, r(img({ mimetype: "image/heic" })).motivo, r(img({ mimetype: "" })).motivo, r(img({ mimetype: undefined })).motivo]);
      c("mime con parametri e maiuscole → accettato", true, accodaUna(nuovo(), 1, img({ mimetype: "Image/JPEG; charset=binary" })).ok);
      c("peso dichiarato oltre 8 MiB → 'troppo_grande' senza chiedere niente", "troppo_grande", r(img({ fileLength: 8 * MIB + 1 })).motivo);
      c("peso dichiarato assente, zero o negativo → 'peso_non_valido'", ["peso_non_valido", "peso_non_valido", "peso_non_valido"], [r(img({ fileLength: undefined })).motivo, r(img({ fileLength: 0 })).motivo, r(img({ fileLength: -5 })).motivo]);
      c("peso dichiarato come Long di protobuf → accettato", true, accodaUna(nuovo(), 1, img({ fileLength: { low: 5000, high: 0, unsigned: true, toNumber: () => 5000 } })).ok);
      c("chiave del messaggio non valida o orario non valido → rifiutato", [false, false, false], [x.img.accoda({ chiave: "bw:x:y", immagine: img(), ts: TS }).ok, x.img.accoda({ chiave: chiave(1), immagine: img(), ts: "ieri" }).ok, x.img.accoda(null).ok]);
      c("nessuno di questi ha scritto su disco", 0, nelDisco(x.coda).length);
    }
    {
      //  Disco che non scrive: nessuna eccezione, lavoro rifiutato.
      const cartella = join(base, "sola-lettura");
      const x = montaSu(cartella);
      rmSync(x.coda, { recursive: true });
      writeFileSync(x.coda, "ora sono un file");
      const r = accodaUna(x, 1);
      c("la cartella della coda non scrivibile: accoda risponde senza lanciare", [false, "disco"], [r.ok, r.motivo]);
    }

    // ── 6. Il ritmo: uno alla volta, 2–5 s, non più di 600 all'ora ──────
    gruppo("PONTE WHATSAPP · IMMAGINI: RITMO (c.2)");
    {
      const x = nuovo({ maxPause: 400 });
      for (let i = 1; i <= 5; i++) accodaUna(x, i);
      await x.img.avvia();
      c("fra un lavoro e l'altro una pausa di 2–5 s (casuale 0,5 → 3,5 s)", [4, true], [x.stato.pause.length, x.stato.pause.every((ms) => ms === 3500)]);
    }
    {
      const x = nuovo({ scarica: async (a, b, o, s) => { s.insieme = (s.insieme ?? 0) + 1; s.massimo = Math.max(s.massimo ?? 0, s.insieme); await new Promise((r) => setTimeout(r, 5)); s.insieme--; return flusso(JPEG); } });
      for (let i = 1; i <= 6; i++) accodaUna(x, i);
      void x.img.sveglia();
      void x.img.avvia();
      await x.img.avvia();
      c("mai due download insieme (anche chiamando avvia e sveglia più volte)", [1, 6], [x.stato.massimo, x.stato.put.length]);
    }
    {
      const x = nuovo({ maxPause: 5000 });
      for (let i = 1; i <= 601; i++) accodaUna(x, i);
      await x.img.avvia();
      const permessi = x.stato.chiamate.filter((k) => k.corpo?.tipo === "media_permesso").map((k) => k.ora);
      const peggiore = Math.max(...permessi.map((t) => permessi.filter((u) => u <= t && u > t - 3_600_000).length));
      c("601 lavori: tutti finiti (la 601ª ha aspettato)", [601, 0], [x.img.contatori().ok, nelDisco(x.coda).length]);
      c("in nessuna ora mobile più di 600 richieste di permesso", true, peggiore <= 600);
      c("la 601ª è partita almeno un'ora dopo la prima", true, permessi[600] - permessi[0] >= 3_600_000);
      c("l'attesa della 601ª è comparsa fra le pause (più di 10 minuti)", true, x.stato.pause.some((ms) => ms > 600_000));
    }
    {
      //  ferma(): il ciclo esce anche se dorme.
      const x = nuovo({ server: { permesso: () => ({ stato: 200, corpo: { ok: true, esito: "rifiutato", motivo: "spenta" } }) } });
      let tenuta = null;
      x.img = I.creaImmagini({ url: PONTE, token: "t".repeat(40), cartella: x.cartella, scarica: async () => flusso(JPEG), fetch: async () => ({ status: 200, text: async () => JSON.stringify({ ok: true, esito: "rifiutato", motivo: "spenta" }) }), registro: () => {}, orologio: () => x.stato.ora, casuale: () => 0.5, pianifica: (f, ms) => { tenuta = f; } });
      accodaUna(x, 1);
      const ciclo = x.img.avvia();
      await new Promise((r) => setTimeout(r, 20));
      const t = performance.now();
      await x.img.ferma();
      await ciclo;
      c("ferma(): il ciclo addormentato (un'ora) si sveglia ed esce subito, il lavoro resta", [true, 1], [performance.now() - t < 500, nelDisco(x.coda).length]);
      c("(la pausa era davvero in corso)", true, typeof tenuta === "function");
      c("dopo ferma() accoda funziona ancora e sveglia() non parte", [true], [accodaUna(x, 2).ok]);
    }

    // ── 7. La sicurezza del registro, sul sorgente ──────────────────────
    gruppo("PONTE WHATSAPP · IMMAGINI: NIENTE NEL REGISTRO CHE NON SIA UN CODICE (c.1 punto 4)");
    {
      const chiamateRegistro = [...codice.matchAll(/registro\(\s*([^)]*)\)/g)].map((m) => m[1]);
      c("ogni registro(...) ha come primo argomento una parola fissa tra virgolette", [], chiamateRegistro.filter((a) => !/^"[a-z_]+"/.test(a)));
      c("ci sono chiamate al registro (la guardia non è vuota)", true, chiamateRegistro.length > 5);
      c("nel codice l'errore non si legge mai (.message, .stack, String(e), template con l'errore)", [], [/\.message\b|\.stack\b/.test(codice) ? "message/stack" : null, /String\(\s*e\w*\s*\)|\$\{\s*e\w*\s*\}|JSON\.stringify\(\s*e\w*\s*\)/.test(codice) ? "errore trasformato in testo" : null].filter(Boolean));
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
