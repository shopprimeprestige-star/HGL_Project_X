/** ── PROVE: IL SERVIZIO SUL MAC: IL COLLEGAMENTO E LE IMMAGINI (compito T8) ──
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T8 (PIANO §e, T8).
 *  `collega.mjs` aggancia `immagini.mjs` agli eventi (messaggi vivi e storico) e
 *  `index.mjs` la crea e la tiene accesa. SENZA WhatsApp e senza rete: Baileys è
 *  un socket finto, `scarica` (il `downloadContentFromMessage`) e `fetch` sono
 *  finti, l'orologio è fermo. Il `fetch` finto segna una violazione se riceve un
 *  indirizzo che non sia il ponte del CRM o l'URL di carico validato.
 *  La guardia statica (lista bianca del download e del socket) sta in
 *  `servizio-guardie.mjs` (`violazioniImmagini`).
 *  Commessa 2026-10-31-media-e-archiviazione, compito T7: le quattro categorie (foto, vocali, video,
 *  documenti) entrano nel catalogo condiviso `media/catalogo` e, se automatiche, in coda; lo storico
 *  chiama `dopoStorico`, la risposta del battito `dopoBattito`. Sul socket non entra niente di nuovo.
 *  Dati inventati: nessun numero né nome vero (prefisso 39 333 000…).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

const NOI = "393330009999";
const C1 = "393330000001";
const C2 = "393330000002";
const T0 = Date.UTC(2026, 9, 30, 12, 0, 0);
const TS = T0 / 1000 - 3600;
const GIORNO_S = 86_400;
const PONTE = "https://ponte.prova.test/api/public/ponte-whatsapp";
const CARICO = "https://abcdefgh.supabase.co/storage/v1/object/upload/sign/ponte-media/utente/percorso.jpg?token=SEGRETO";
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const OGG = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(200, 3)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(200, 2)]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200, 4)]);
/** i byte che il `scarica` finto restituisce per ogni tipo di Baileys */
const BYTE_PER_TIPO = { image: JPEG, audio: OGG, video: MP4, document: PDF };
const DIRECT = "/v/t62.7118-24/12345_67890.enc?ccb=11-4&oh=01_abc&oe=6720ABCD";

/** Un `imageMessage` come lo dà Baileys 7. */
const imm = (extra = {}) => ({ mimetype: "image/jpeg", mediaKey: Buffer.alloc(32, 7), directPath: DIRECT, url: "https://mmg.whatsapp.net/v/t62.7118-24/12345_67890.enc?ccb=11-4", fileLength: 4000, ...extra });
/** Un `WAMessage` con una foto. */
const foto = (jid, id, extra = {}, { key = {}, ts = TS, involucro } = {}) => ({
  key: { remoteJid: jid, fromMe: false, id, ...key },
  messageTimestamp: ts,
  message: involucro ? { [involucro]: { message: { imageMessage: imm(extra) } } } : { imageMessage: imm(extra) },
  pushName: "Cliente Finto",
});
/** I campi che ogni media di WhatsApp porta per scaricare (origine vera). */
const ORIGINE = { mediaKey: Buffer.alloc(32, 7), directPath: DIRECT, url: "https://mmg.whatsapp.net/v/t62.7118-24/12345_67890.enc?ccb=11-4" };
/** Un WAMessage con un messaggio di tipo `proto` (audioMessage, videoMessage, documentMessage…). */
const media = (proto, jid, id, campi, { key = {}, ts = TS, involucro } = {}) => {
  const m = { [proto]: { ...ORIGINE, ...campi } };
  return { key: { remoteJid: jid, fromMe: false, id, ...key }, messageTimestamp: ts, message: involucro ? { [involucro]: { message: m } } : m, pushName: "Cliente Finto" };
};
const vocale = (jid, id, extra = {}, o) => media("audioMessage", jid, id, { mimetype: "audio/ogg; codecs=opus", ptt: true, seconds: 7, fileLength: 3000, ...extra }, o);
const video = (jid, id, extra = {}, o) => media("videoMessage", jid, id, { mimetype: "video/mp4", seconds: 12, width: 640, height: 480, fileLength: 900_000, ...extra }, o);
const documento = (jid, id, extra = {}, o) => media("documentMessage", jid, id, { mimetype: "application/pdf", fileName: "preventivo.pdf", fileLength: 20_000, ...extra }, o);
const testo = (jid, id, t) => ({ key: { remoteJid: jid, fromMe: false, id }, messageTimestamp: TS, message: { conversation: t }, pushName: "Cliente Finto" });

/** Baileys finto: registra le opzioni del socket e QUALI proprietà del socket il collegamento tocca. */
function baileysFinto() {
  const socket = [];
  const baileys = {
    Browsers: { macOS: (b) => ["Mac OS", b, "14.4.1"] },
    useMultiFileAuthState: async (cartella) => ({ state: { cartella }, saveCreds: async () => {} }),
    makeWASocket: (opzioni) => {
      const ascolti = new Map();
      const toccate = new Set();
      const s = {
        user: { id: `${NOI}:3@s.whatsapp.net` },
        ev: { on: (nome, f) => ascolti.set(nome, [...(ascolti.get(nome) ?? []), f]) },
        ws: { on: () => {} },
        signalRepository: { lidMapping: { getPNForLID: async () => null } },
        end: () => {},
      };
      //  Al collegamento arriva il Proxy: `toccate` sono le proprietà che il servizio legge; l'emettitore resta fuori.
      const visto = new Proxy(s, { get: (t, k) => (toccate.add(String(k)), t[k]) });
      socket.push({ opzioni, toccate, eventi: () => [...ascolti.keys()].sort(), emetti: async (nome, dati) => { for (const f of ascolti.get(nome) ?? []) await f(dati); }, visto });
      return visto;
    },
  };
  return { baileys, socket };
}

export async function provePonteServizioCollegaImmagini(_mod, { c, gruppo, radice }) {
  const src = join(radice, "strumenti/ponte-whatsapp/src");
  const url = (f) => pathToFileURL(join(src, f)).href;
  const K = await import(url("collega.mjs"));
  const I = await import(url("immagini.mjs"));
  const Ca = await import(url("catalogo.mjs"));
  const L = await import(url("lotti.mjs"));
  const X = await import(url("index.mjs"));
  const base = mkdtempSync(join(tmpdir(), "ponte-t8-"));
  let n = 0;

  /** Un collegamento con tutto finto. `opz.senzaImmagini`: nessuna immagine; `opz.immagini`: un oggetto al suo posto;
   *  `opz.mobile`: orologio e attese a mano (`x.avanza(ms)`), per le prove che dipendono dal tempo (dopo lo storico gli
   *  automatici aspettano 10 minuti: con l'orologio fermo il ciclo non finirebbe mai); `opz.richieste`: le chiavi che
   *  `media_prendi` restituisce («Mostra»). Il catalogo è UNO, in `media/catalogo`, come in `index.mjs`. */
  async function monta(opz = {}) {
    const dir = join(base, `s${n++}`);
    mkdirSync(dir, { mode: 0o700 });
    const fila = L.creaFila({ cartella: join(dir, "fila"), orologio: () => T0 });
    const log = [];
    const violazioni = [];
    const chiamate = [];
    const scarichi = [];
    let ora = T0;
    const orologio = opz.mobile ? () => ora : () => T0;
    const attese = [];
    const pianifica = opz.mobile ? (f, ms) => void attese.push({ a: ora + ms, f }) : (f) => setImmediate(f);
    const tick = async () => {
      for (let i = 0; i < 5; i++) await new Promise((ok) => setImmediate(ok));
    };
    /** porta l'orologio avanti e lascia lavorare il ciclo (solo con `mobile`) */
    const avanza = async (ms) => {
      ora += ms;
      for (let giri = 0; giri < 50; giri++) {
        const scadute = attese.filter((a) => a.a <= ora);
        if (!scadute.length) break;
        for (const a of scadute) attese.splice(attese.indexOf(a), 1);
        for (const a of scadute) a.f();
        await tick();
      }
      await tick();
    };
    const registro = (codice, conteggi = {}) => {
      const pulito = typeof codice === "string" && /^[a-z_]+$/.test(codice) && Object.entries(conteggi).every(([k, v]) => /^[a-z_]+$/.test(k) && typeof v === "number");
      if (!pulito) violazioni.push(`registro non pulito: ${String(codice)}`);
      log.push([codice, conteggi]);
    };
    const fetchFinto = async (indirizzo, init = {}) => {
      const corpo = init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
      if (String(indirizzo) === PONTE) {
        chiamate.push({ metodo: init.method ?? "GET", tipo: corpo?.tipo, corpo });
        const r = corpo?.tipo === "media_permesso" ? { ok: true, esito: "carica", url_carico: CARICO } : corpo?.tipo === "media_fatto" ? { ok: true, esito: "pronta" } : corpo?.tipo === "media_prendi" ? { ok: true, richieste: (opz.richieste ?? []).map((chiave) => ({ chiave })) } : { ok: true };
        return { status: 200, text: async () => JSON.stringify(r) };
      }
      if (String(indirizzo) === CARICO && init.method === "PUT") {
        chiamate.push({ metodo: "PUT", tipo: "put", byte: init.body?.length });
        return { status: 200, body: { cancel: async () => {} } };
      }
      violazioni.push(`richiesta a un indirizzo non ammesso: ${String(indirizzo).slice(0, 30)}`);
      throw new Error("indirizzo non ammesso");
    };
    const scarica = async (...a) => {
      scarichi.push(a);
      return Readable.from([BYTE_PER_TIPO[a[1]] ?? JPEG]);
    };
    const catalogo = Ca.creaCatalogo({ cartella: join(dir, "media", "catalogo"), registro, orologio });
    //  Come `index.mjs`: il catalogo è pronto PRIMA che il socket si colleghi (altrimenti `accoda` risponde `non_avviato`).
    await catalogo.avvia();
    const immagini = opz.senzaImmagini
      ? undefined
      : (opz.immagini ?? I.creaImmagini({ url: PONTE, token: "t".repeat(40), cartella: join(dir, "immagini"), catalogo, scarica, fetch: fetchFinto, registro, orologio, casuale: () => 0.5, pianifica }));
    const f = baileysFinto();
    const qrFinto = { mostra: async () => {}, togli: () => {}, notifica: async () => {} };
    const col = K.creaCollegamento({
      baileys: f.baileys,
      percorsi: { auth: join(dir, "auth"), lid: join(dir, "lid.json") },
      fila,
      qr: qrFinto,
      registro,
      ...(immagini !== undefined ? { immagini } : {}),
      ...(opz.storicoDal !== undefined ? { storicoDal: opz.storicoDal } : {}),
      orologio: () => T0,
      casuale: () => 0.5,
      pianifica: () => {},
      annulla: () => {},
    });
    await col.avvia();
    await immagini?.avvia?.();
    const s = f.socket[0];
    await s.emetti("connection.update", { connection: "open" });
    const righe = (origine) => {
      const d = join(dir, "fila", origine);
      return existsSync(d) ? readdirSync(d).flatMap((x) => JSON.parse(readFileSync(join(d, x), "utf8")).lotto.messaggi) : [];
    };
    /** aspetta che il ciclo delle immagini abbia finito quello che ha in coda */
    const finito = async () => {
      if (!opz.mobile || !immagini?.sveglia) return void (await immagini?.sveglia?.());
      //  orologio a mano: ci vogliono le pause di cortesia fra un lavoro e l'altro (2-5 s), si va avanti a passi da 6 s
      for (let i = 0; i < 40; i++) {
        if (await Promise.race([immagini.sveglia().then(() => true), tick().then(() => false)])) return;
        await avanza(6000);
      }
    };
    return { col, immagini, catalogo, s, dir, log, chiamate, scarichi, violazioni, righe, finito, avanza, tick, cartella: join(dir, "media", "catalogo") };
  }
  /** le voci del catalogo sul disco (si scrive in modo asincrono: prima si svuota il buffer) */
  const sulDisco = async (x) => {
    await x.catalogo.svuota();
    return existsSync(x.cartella) ? readdirSync(x.cartella).filter((f) => f.endsWith(".json")).length : 0;
  };
  const stati = (x) => Object.fromEntries(x.catalogo.voci().map((v) => [v.chiave.split(":")[2], v.stato]).sort(([a], [b]) => (a < b ? -1 : 1)));
  const tipi = (x) => x.chiamate.map((k) => k.tipo);

  try {
    // ── 1. Una foto viva ────────────────────────────────────────────────
    gruppo("PONTE WHATSAPP · FOTO VIVE E STORICO NEL COLLEGAMENTO (compito T8)");
    {
      const x = await monta();
      await x.s.emetti("messages.upsert", { type: "notify", messages: [foto(`${C1}@s.whatsapp.net`, "F1")] });
      await x.finito();
      c("foto viva: la riga di testo «📷 Foto» va in fila/vivo come prima", [["F1", C1, "in", "📷 Foto"]], x.righe("vivo").map((m) => [m.id, m.numero, m.dir, m.testo]));
      c("foto viva: UNA richiesta di permesso, UN PUT, UN «fatto» (in quest'ordine)", ["media_permesso", "put", "media_fatto"], tipi(x));
      c("…il permesso porta la chiave bw:<numero>:<id>, il tipo e il peso dichiarato", { v: 1, tipo: "media_permesso", chiave: `bw:${C1}:F1`, mime: "image/jpeg", byte: 4000 }, x.chiamate[0]?.corpo);
      c("…il download è uno solo, con una COPIA {mediaKey, directPath}, tipo «image» e l'host fissato", [1, ["directPath", "mediaKey"], "image", { host: "mmg.whatsapp.net" }], [x.scarichi.length, Object.keys(x.scarichi[0]?.[0] ?? {}).sort(), x.scarichi[0]?.[1], x.scarichi[0]?.[2]]);
      c("…il PUT porta i byte scaricati", JPEG.length, x.chiamate[1]?.byte);
      c("…contatori: una ok, niente in coda; la voce resta nel catalogo (per «Mostra»), come «catalogato»", [1, 0, 1, { F1: "catalogato" }], [x.immagini.contatori().ok, x.immagini.contatori().in_coda, await sulDisco(x), stati(x)]);
      c("…nessuna violazione (nessun indirizzo fuori dal ponte e dall'URL di carico, registro pulito)", [], x.violazioni);
    }

    // ── 2. La foto che manda il telefono (uscita) ───────────────────────
    {
      const x = await monta();
      await x.s.emetti("messages.upsert", { type: "append", messages: [foto(`${C1}@s.whatsapp.net`, "F2", {}, { key: { fromMe: true } })] });
      await x.finito();
      c("foto in uscita (dal telefono): riga «out» e stesso percorso delle immagini", [[["F2", "out"]], ["media_permesso", "put", "media_fatto"]], [x.righe("vivo").map((m) => [m.id, m.dir]), tipi(x)]);
    }

    // ── 3. Lo storico ───────────────────────────────────────────────────
    {
      //  Dopo un blocco di storico gli automatici aspettano 10 minuti (`dopoStorico`): orologio a mano.
      const x = await monta({ mobile: true });
      await x.s.emetti("messaging-history.set", {
        messages: [
          foto(`${C1}@s.whatsapp.net`, "H1", {}, { ts: TS - 3 * GIORNO_S }),
          foto(`${C2}@s.whatsapp.net`, "H2", {}, { ts: TS - 20 * GIORNO_S }),
          testo(`${C1}@s.whatsapp.net`, "H3", "ciao dallo storico"),
        ],
        progress: 40,
        syncType: 2,
      });
      await x.tick();
      c("storico: le tre righe di testo vanno in fila/storico (anche la foto vecchia, come prima)", ["H1", "H2", "H3"], x.righe("storico").map((m) => m.id).sort());
      c("storico: la foto di 3 giorni fa è in coda e quella di 20 giorni fa solo nel catalogo (per «Mostra»), nessuna scartata", [{ H1: "in_coda", H2: "catalogato" }, 0, 1], [stati(x), x.immagini.contatori().scartate, x.immagini.contatori().in_coda]);
      c("storico: …e sono sul disco tutte e due (cartella media/catalogo)", 2, await sulDisco(x));
      c("storico: subito dopo il blocco non parte nessun download (gli automatici aspettano 10 minuti)", [0, 0], [x.chiamate.length, x.scarichi.length]);
      await x.avanza(9 * 60_000);
      c("storico: …nemmeno dopo 9 minuti", [0, 0], [x.chiamate.length, x.scarichi.length]);
      await x.avanza(2 * 60_000);
      await x.finito();
      c("storico: dopo 11 minuti la foto di 3 giorni fa si carica (permesso, PUT, fatto)", [["media_permesso", "put", "media_fatto"], `bw:${C1}:H1`], [tipi(x), x.chiamate[0]?.corpo?.chiave]);
      c("storico: …la foto di 20 giorni fa non si è mossa", { H1: "catalogato", H2: "catalogato" }, stati(x));
      c("storico: il log `storico` resta quello di prima (letti, validi, tipo)", [["storico", { letti: 3, validi: 3, tipo: 2 }]], x.log.filter(([k]) => k === "storico"));
    }
    {
      //  Oltre 30 giorni il catalogo non tiene niente: la riga di testo entra, del media non resta traccia.
      const x = await monta({ mobile: true });
      await x.s.emetti("messaging-history.set", { messages: [foto(`${C1}@s.whatsapp.net`, "H5", {}, { ts: TS - 40 * GIORNO_S })], progress: 40, syncType: 2 });
      await x.tick();
      c("storico di 40 giorni fa: la riga di testo entra, il catalogo resta vuoto e non si chiede niente", [["H5"], 0, 0, 1], [x.righe("storico").map((m) => m.id), await sulDisco(x), x.chiamate.length, x.immagini.contatori().scartate]);
    }
    {
      //  Il taglio STORICO_GIORNI vale anche per le foto: più vecchia del taglio = nessuna coda.
      const x = await monta({ storicoDal: TS - GIORNO_S });
      await x.s.emetti("messaging-history.set", { messages: [foto(`${C1}@s.whatsapp.net`, "H4", {}, { ts: TS - 3 * GIORNO_S })], progress: 50, syncType: 2 });
      await x.finito();
      c("storico oltre il taglio STORICO_GIORNI: la foto non entra in coda e non si chiede niente", [0, 0, 0, 0], [x.immagini.contatori().in_coda, x.immagini.contatori().scartate, x.chiamate.length, x.scarichi.length]);
    }

    // ── 4. Origine ostile: nessuna richiesta, mai ───────────────────────
    gruppo("PONTE WHATSAPP · FOTO CON ORIGINE OSTILE NEL COLLEGAMENTO (compito T8, PIANO c.1)");
    {
      const ostili = {
        "url su 127.0.0.1": { url: "http://127.0.0.1/x" },
        "url https su 127.0.0.1": { url: "https://127.0.0.1/v/x.enc" },
        "url su un host estraneo": { url: "https://evil.example/v/x.enc" },
        "url che inizia come whatsapp.net ma è un altro host": { url: "https://mmg.whatsapp.net@evil.example/v/x.enc" },
        "url con porta": { url: "https://mmg.whatsapp.net:8080/v/x.enc" },
        "directPath che sposta l'host (//)": { directPath: "//evil.example/x" },
        "directPath con ..": { directPath: "/v/../../x" },
        "chiave del media troppo corta": { mediaKey: Buffer.alloc(8, 1) },
        "chiave del media assente": { mediaKey: undefined },
        "tipo non ammesso (svg)": { mimetype: "image/svg+xml" },
        "peso oltre 8 MiB": { fileLength: 9 * 1024 * 1024 },
        "peso mancante": { fileLength: undefined },
      };
      const x = await monta();
      let i = 0;
      for (const [nome, extra] of Object.entries(ostili)) {
        const prima = [x.chiamate.length, x.scarichi.length];
        await x.s.emetti("messages.upsert", { type: "notify", messages: [foto(`${C1}@s.whatsapp.net`, `O${i++}`, extra)] });
        await x.finito();
        c(`${nome}: nessuna richiesta e nessun download`, prima, [x.chiamate.length, x.scarichi.length]);
      }
      c("…ma le righe di testo «📷 Foto» sono entrate lo stesso (il messaggio non si perde)", Object.keys(ostili).length, x.righe("vivo").length);
      c("…e le foto ostili sono contate come scartate, mai in coda né nel catalogo", [Object.keys(ostili).length, 0, 0], [x.immagini.contatori().scartate, x.immagini.contatori().in_coda, await sulDisco(x)]);
      c("…nessuna violazione, registro pulito", [], x.violazioni);
    }
    {
      //  «Visualizza una volta» e i messaggi che non sono foto non si scaricano.
      const x = await monta();
      await x.s.emetti("messages.upsert", {
        type: "notify",
        messages: [
          foto(`${C1}@s.whatsapp.net`, "V1", { viewOnce: true }),
          foto(`${C1}@s.whatsapp.net`, "V2", {}, { involucro: "viewOnceMessage" }),
          testo(`${C1}@s.whatsapp.net`, "V3", "ciao"),
        ],
      });
      await x.finito();
      c("«visualizza una volta» e il testo: nessuna richiesta, nessun download, niente in coda", [0, 0, 0, 0], [x.chiamate.length, x.scarichi.length, x.immagini.contatori().in_coda, x.immagini.contatori().scartate]);
    }

    // ── 5. Senza immagini, o con un guasto: il ponte va avanti ───────────
    gruppo("PONTE WHATSAPP · SENZA IMMAGINI O CON UN GUASTO (compito T8)");
    {
      const x = await monta({ senzaImmagini: true });
      await x.s.emetti("messages.upsert", { type: "notify", messages: [foto(`${C1}@s.whatsapp.net`, "S1")] });
      c("senza l'opzione `immagini` (--senza-invio): la riga di testo entra, nessuna richiesta, nessun errore", [["S1", "📷 Foto"], 0, 0], [x.righe("vivo").map((m) => [m.id, m.testo])[0], x.chiamate.length, x.scarichi.length]);
    }
    {
      let chiamate = 0;
      const rotta = {
        accoda: () => {
          chiamate++;
          throw new Error("rotto http://segreto.example 393330000001");
        },
      };
      const x = await monta({ immagini: rotta });
      await x.s.emetti("messages.upsert", { type: "notify", messages: [foto(`${C1}@s.whatsapp.net`, "G1"), foto(`${C2}@s.whatsapp.net`, "G2")] });
      c("`accoda` che lancia: le righe di testo entrano comunque, tutte e due", ["G1", "G2"], x.righe("vivo").map((m) => m.id).sort());
      c("…ci si prova per ciascuna foto, e il log dice solo un codice fisso", [2, true], [chiamate, x.log.filter(([k]) => k === "immagini_accoda_fallita").length === 2]);
      c("…nel log nessun testo dell'errore, nessun numero, nessun indirizzo", [], x.log.filter((r) => /segreto|http|3933300|rotto/.test(JSON.stringify(r))));
      c("…e nessun evento è fallito (l'ascolto non ha perso il messaggio)", false, x.log.some(([k]) => k === "evento_fallito"));
    }

    // ── 6. Sul socket non entra niente di nuovo ─────────────────────────
    gruppo("PONTE WHATSAPP · SUL SOCKET NON ENTRA NIENTE DI NUOVO (compito T8)");
    {
      const eventi = async (x) => {
        await x.s.emetti("messaging-history.set", { messages: [foto(`${C1}@s.whatsapp.net`, "K1", {}, { ts: TS - GIORNO_S }), vocale(`${C1}@s.whatsapp.net`, "K4", {}, { ts: TS - GIORNO_S }), video(`${C1}@s.whatsapp.net`, "K5", {}, { ts: TS - GIORNO_S })], progress: 100, syncType: 2 });
        await x.s.emetti("messages.upsert", { type: "notify", messages: [foto(`${C2}@s.whatsapp.net`, "K2"), documento(`${C2}@s.whatsapp.net`, "K6"), testo(`${C2}@s.whatsapp.net`, "K3", "ciao")] });
        await x.avanza(11 * 60_000);
        await x.finito();
      };
      const con = await monta({ mobile: true });
      await eventi(con);
      const senza = await monta({ senzaImmagini: true, mobile: true });
      await eventi(senza);
      c("le proprietà del socket toccate sono le STESSE con e senza immagini", [...senza.s.toccate].sort(), [...con.s.toccate].sort());
      c("…e sono solo queste (ev, ws, user, signalRepository, end, sendMessage mai)", [], [...con.s.toccate].filter((k) => !["ev", "ws", "user", "signalRepository", "end"].includes(k)));
      c("le opzioni del socket sono le stesse chiavi di prima (nessuna in più)", ["auth", "browser", "getMessage", "logger", "markOnlineOnConnect", "shouldSyncHistoryMessage", "syncFullHistory"], Object.keys(con.s.opzioni).sort());
      c("gli eventi ascoltati sono gli stessi di prima (nessun evento nuovo)", senza.s.eventi(), con.s.eventi());
      c("il download e il carico sono due richieste a testa per foto, nessuna sul socket", [2, 2], [tipi(con).filter((t) => t === "media_permesso").length, tipi(con).filter((t) => t === "put").length]);
      c("nel registro, in tutto, solo codici fissi e numeri: nessun indirizzo, chiave del messaggio, numero, gettone", [], [...con.log, ...senza.log].filter((r) => /http|@|bw:|SEGRETO|token|\d{6,}/i.test(JSON.stringify(r))));
      c("…e nessuna violazione di registro", [], con.violazioni);
    }

    // ── 7. index.mjs: percorso, riga di log, accensione ──────────────────
    gruppo("PONTE WHATSAPP · INDEX: LA CARTELLA, LA RIGA `immagini` E L'ACCENSIONE (compito T8)");
    {
      c("percorsiDi: la cartella delle immagini sta sotto la cartella di stato, mai nel repo", "/Users/finto/Library/Application Support/HGL/ponte-wa/immagini", X.percorsiDi("/Users/finto").immagini);
      c("contiImmagini: solo ok, scadute, errori, tetto, in_coda (numeri)", { ok: 2, scadute: 1, errori: 0, tetto: 3, in_coda: 4 }, X.contiImmagini({ ok: 2, scadute: 1, errori: 0, tetto: 3, in_coda: 4, scartate: 9, coda_piena: 1, chiave: "bw:393330000001:X" }));
      c("contiImmagini: valori che non sono numeri, o assenti, valgono 0", [{ ok: 0, scadute: 0, errori: 0, tetto: 0, in_coda: 5 }, { ok: 0, scadute: 0, errori: 0, tetto: 0, in_coda: 0 }], [X.contiImmagini({ ok: Number.NaN, scadute: "7", in_coda: 5 }), X.contiImmagini(null)]);
      const dal = (nome) => readFileSync(join(src, nome), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      const index = dal("index.mjs");
      const collega = dal("collega.mjs");
      c("index.mjs: il download di Baileys passa come `scarica` e le immagini non si creano con --senza-invio", [true, true], [/\bscarica:\s*baileys\.downloadContentFromMessage\b/.test(index), /if\s*\(\s*!senzaInvio\b[^)]*\)\s*\{\s*catalogo\s*=\s*creaCatalogo\([^)]*\);\s*await catalogo\.avvia\(\);\s*immagini\s*=\s*creaImmagini\(/.test(index)]);
      c("index.mjs: un guasto nell'avvio delle immagini non ferma il ponte (try/catch con un codice di log)", true, /immagini_non_avviate/.test(index));
      c("index.mjs: all'avvio riprende la coda su disco e allo stop la ferma", [true, true], [/immagini\??\.avvia\(\)/.test(index), /immagini\??\.ferma\(\)/.test(index)]);
      c("index.mjs: la riga `immagini` del registro nasce da contiImmagini", true, /contiImmagini\(immagini\.contatori\(\)\)/.test(index) && /registro\("immagini",\s*\w+\)/.test(index));
      c("collega.mjs: riceve `immagini` come opzione e non importa né Baileys né immagini.mjs", [true, false, false], [/\bimmagini\s*=\s*null\b/.test(collega), /from "\.\/immagini\.mjs"/.test(collega), /@whiskeysockets/.test(collega)]);
      c("collega.mjs: il media passa da mediaDa (stesse regole di leggiMessaggio) e da accoda, dentro un try/catch; immagineDa non serve più", [true, true, false], [/\bmediaDa\(/.test(collega), /immagini\.accoda\(/.test(collega), /immagineDa/.test(collega)]);
      c("collega.mjs: di `immagini` usa solo accoda e dopoStorico (nessun altro metodo, niente di nuovo da chiedere)", ["accoda", "dopoStorico"], [...new Set([...collega.matchAll(/\bimmagini\??\.(\w+)/g)].map((m) => m[1]))].sort());
      //  T7: il catalogo condiviso e la risposta del battito.
      const P = X.percorsiDi("/Users/finto");
      const intreccia = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
      c("percorsiDi: il catalogo sta in media/catalogo sotto la cartella di stato; nessun'altra cartella lo contiene o ci sta dentro (il catalogo cancella i file che non riconosce)", ["/Users/finto/Library/Application Support/HGL/ponte-wa/media/catalogo", []], [P.catalogo, Object.entries(P).filter(([k, v]) => k !== "catalogo" && k !== "base" && k !== "log" && intreccia(P.catalogo, v)).map(([k]) => k)]);
      c("index.mjs: un solo catalogo, passato a creaImmagini, avviato PRIMA di creare il collegamento e di avviarlo", [true, true, true], [/creaImmagini\(\{[^}]*\bcatalogo\b/.test(index), index.indexOf("await catalogo.avvia()") > 0 && index.indexOf("await catalogo.avvia()") < index.indexOf("creaCollegamento({"), index.indexOf("await catalogo.avvia()") < index.indexOf("await col.avvia()")]);
      c("index.mjs: in chiudi() il catalogo si ferma DOPO le immagini e il collegamento (scrive quel che ha in attesa)", true, index.indexOf("immagini?.ferma()") > 0 && index.indexOf("col.ferma()") > 0 && index.indexOf("catalogo?.ferma()") > Math.max(index.indexOf("immagini?.ferma()"), index.indexOf("col.ferma()")));
      c("index.mjs: la risposta del battito (200) va a immagini.dopoBattito, con il corpo", true, /if\s*\(\s*r\.stato === 200\s*\)\s*immagini\?\.dopoBattito\(r\.corpo\)/.test(index));
      c("index.mjs: nessun catalogo con --senza-invio (si crea solo dentro `!senzaInvio`)", true, /creaCatalogo\(/.test(index) && index.indexOf("creaCatalogo(") > index.indexOf("if (!senzaInvio &&"));
    }

    // ── 8. T7: le quattro categorie, lo storico, il battito ──────────────
    gruppo("PONTE WHATSAPP · FOTO, VOCALI, VIDEO E DOCUMENTI NEL CATALOGO CONDIVISO (compito T7)");
    {
      const ch = (id) => `bw:${C1}:${id}`;
      const J = `${C1}@s.whatsapp.net`;
      const x = await monta();
      await x.s.emetti("messages.upsert", { type: "notify", messages: [foto(J, "M1"), vocale(J, "M2"), video(J, "M3"), documento(J, "M4"), testo(J, "M5", "ciao")] });
      await x.finito();
      c("quattro categorie: le righe di testo entrano tutte (e il testo semplice)", ["M1", "M2", "M3", "M4", "M5"], x.righe("vivo").map((m) => m.id).sort());
      c("quattro categorie: ENTRANO TUTTE nel catalogo (4 voci sul disco)", [4, { M1: "catalogato", M2: "catalogato", M3: "catalogato", M4: "catalogato" }], [await sulDisco(x), stati(x)]);
      c("D8, senza `media_v: 2` dal Worker: si scarica la sola foto, vocale, video e documento restano nel catalogo", [["media_permesso", "put", "media_fatto"], ["image"], ch("M1")], [tipi(x), x.scarichi.map((a) => a[1]), x.chiamate[0]?.corpo?.chiave]);
      c("…le voci del catalogo portano la categoria, il mime canonico e i dettagli della bolla", [["audio", "audio/ogg", 7], ["video", "video/mp4", 12, 640, 480], ["documento", "application/pdf", "preventivo.pdf"]], [
        ((v) => [v.categoria, v.mime, v.durata_s])(x.catalogo.leggi(ch("M2"))),
        ((v) => [v.categoria, v.mime, v.durata_s, v.larghezza, v.altezza])(x.catalogo.leggi(ch("M3"))),
        ((v) => [v.categoria, v.mime, v.nome])(x.catalogo.leggi(ch("M4"))),
      ]);
      c("…nessun file del catalogo contiene l'url del messaggio (solo mediaKey, directPath e host come segreti)", [], readdirSync(x.cartella).filter((f) => /https?:|mmg\.whatsapp\.net\/v\//.test(readFileSync(join(x.cartella, f), "utf8"))));

      //  Il Worker dice `media_v: 2` e le categorie automatiche: da qui anche vocali, video e documenti NUOVI si caricano.
      await x.immagini.dopoBattito({ ok: true, media_v: 2, media_auto: ["foto", "audio", "video", "documento"] });
      const prima = x.chiamate.length;
      await x.s.emetti("messages.upsert", { type: "notify", messages: [vocale(J, "N2", {}, { ts: TS + 10 }), video(J, "N3", {}, { ts: TS + 20 }), documento(J, "N4", {}, { ts: TS + 30 })] });
      await x.finito();
      const nuovi = x.chiamate.slice(prima);
      c("con `media_v: 2`: vocale, video e documento nuovi si caricano (3 permessi, 3 PUT, 3 «fatto»), ciascuno col suo tipo di Baileys", [3, 3, 3, ["audio", "document", "video"]], [nuovi.filter((k) => k.tipo === "media_permesso").length, nuovi.filter((k) => k.tipo === "put").length, nuovi.filter((k) => k.tipo === "media_fatto").length, x.scarichi.slice(1).map((a) => a[1]).sort()]);
      const permesso = (id) => nuovi.find((k) => k.corpo?.chiave === ch(id))?.corpo;
      c("…il permesso porta mime canonico, peso e i dettagli di ciascuna categoria", [
        { v: 1, tipo: "media_permesso", chiave: ch("N2"), mime: "audio/ogg", byte: 3000, durata_s: 7 },
        { v: 1, tipo: "media_permesso", chiave: ch("N3"), mime: "video/mp4", byte: 900_000, durata_s: 12, larghezza: 640, altezza: 480 },
        { v: 1, tipo: "media_permesso", chiave: ch("N4"), mime: "application/pdf", byte: 20_000, nome: "preventivo.pdf" },
      ], [permesso("N2"), permesso("N3"), permesso("N4")]);
      c("…la copia per Baileys è sempre e solo {mediaKey, directPath}, con l'host fissato da noi", [true], [x.scarichi.every((a) => JSON.stringify(Object.keys(a[0]).sort()) === '["directPath","mediaKey"]' && a[2]?.host === "mmg.whatsapp.net")]);
      c("…nessuna violazione, e nessun errore di Baileys finito nel registro", [[], false], [x.violazioni, x.log.some(([k]) => /baileys|errore_scarico/.test(k))]);
    }
    {
      //  Senza `media_v: 2` (anche con `media_auto` pieno) valgono le sole foto: Mac nuovo, Worker vecchio.
      const J = `${C1}@s.whatsapp.net`;
      const x = await monta();
      await x.immagini.dopoBattito({ ok: true, media_v: 1, media_auto: ["audio", "video", "documento"] });
      await x.immagini.dopoBattito({ ok: true, media_auto: ["audio"] });
      await x.s.emetti("messages.upsert", { type: "notify", messages: [vocale(J, "P1"), video(J, "P2"), documento(J, "P3")] });
      await x.finito();
      c("senza `media_v: 2` (assente o 1) i non-foto restano nel catalogo: nessuna richiesta, nessun download", [0, 0, { P1: "catalogato", P2: "catalogato", P3: "catalogato" }], [x.chiamate.length, x.scarichi.length, stati(x)]);
    }
    {
      //  «Mostra» su un media dello storico: catalogo (collega) → media_prendi (battito) → un solo tentativo, col tipo giusto.
      const J = `${C1}@s.whatsapp.net`;
      const chiave = `bw:${C1}:Q1`;
      const x = await monta({ mobile: true, richieste: [chiave] });
      await x.s.emetti("messaging-history.set", { messages: [vocale(J, "Q1", {}, { ts: TS - 2 * GIORNO_S })], progress: 40, syncType: 2 });
      await x.tick();
      c("storico: un vocale (non automatico finché il Worker non lo dice) sta solo nel catalogo", [{ Q1: "catalogato" }, 0], [stati(x), x.chiamate.length]);
      await x.immagini.dopoBattito({ ok: true, media_v: 2, media_auto: ["foto"], media_richieste: 1 });
      await x.tick();
      await x.finito();
      c("«Mostra»: media_prendi, poi permesso con `richiesto`, PUT e fatto, ANCHE dentro i 10 minuti dopo lo storico", ["media_prendi", "media_permesso", "put", "media_fatto"], tipi(x));
      c("…download del vocale col tipo «audio» e la copia {mediaKey, directPath}", [["audio"], ["directPath", "mediaKey"], true], [x.scarichi.map((a) => a[1]), Object.keys(x.scarichi[0]?.[0] ?? {}).sort(), x.chiamate.find((k) => k.tipo === "media_permesso")?.corpo?.richiesto]);
    }
    {
      //  Quello che non si scarica: documento con mime immagine, «visualizza una volta», origine ostile in ogni categoria.
      const J = `${C1}@s.whatsapp.net`;
      const x = await monta();
      const strane = [
        documento(J, "R1", { mimetype: "image/jpeg", fileName: "foto.jpg" }),
        vocale(J, "R2", { viewOnce: true }),
        video(J, "R3", { viewOnce: true }),
        video(J, "R4", {}, { involucro: "viewOnceMessage" }),
        vocale(J, "R5", { url: "https://evil.example/v/x.enc" }),
        video(J, "R6", { directPath: "//evil.example/x" }),
        documento(J, "R7", { url: "https://mmg.whatsapp.net:8080/v/x.enc" }),
        documento(J, "R8", { mimetype: "application/zip", fileName: "a.zip" }),
        vocale(J, "R9", { mediaKey: Buffer.alloc(8, 1) }),
        video(J, "RA", { fileLength: 50 * 1024 * 1024 }),
        vocale(J, "RB", { fileLength: 17 * 1024 * 1024 }),
      ];
      await x.s.emetti("messages.upsert", { type: "notify", messages: strane });
      await x.finito();
      c("media che non si scarica: la riga di testo entra comunque per tutti", strane.length, x.righe("vivo").length);
      c("…ma nessuna voce nel catalogo, nessuna richiesta, nessun download", [0, 0, 0, {}], [await sulDisco(x), x.chiamate.length, x.scarichi.length, stati(x)]);
      c("…nessuna violazione, registro pulito", [], x.violazioni);
    }

    // ── 9. dopoStorico: una volta per blocco, solo se c'è un media ────────
    gruppo("PONTE WHATSAPP · DOPO UN BLOCCO DI STORICO (compito T7)");
    {
      const J = `${C1}@s.whatsapp.net`;
      let accodati = 0;
      let dopoStorico = 0;
      const spia = { accoda: () => void accodati++, dopoStorico: () => void dopoStorico++ };
      const x = await monta({ immagini: spia });
      await x.s.emetti("messaging-history.set", { messages: [testo(J, "T1", "uno"), testo(J, "T2", "due")], progress: 10, syncType: 2 });
      c("un blocco di storico di solo testo: dopoStorico non si chiama (gli automatici non aspettano per niente)", [0, 0], [accodati, dopoStorico]);
      await x.s.emetti("messaging-history.set", { messages: [foto(J, "T3", {}, { ts: TS - GIORNO_S }), vocale(J, "T4", {}, { ts: TS - GIORNO_S }), video(J, "T5", {}, { ts: TS - GIORNO_S }), documento(J, "T6", {}, { ts: TS - GIORNO_S })], progress: 20, syncType: 2 });
      c("un blocco con quattro media: accoda per ciascuno e dopoStorico UNA volta", [4, 1], [accodati, dopoStorico]);
      await x.s.emetti("messages.upsert", { type: "notify", messages: [foto(J, "T7"), vocale(J, "T8")] });
      c("i messaggi vivi non chiamano dopoStorico", [6, 1], [accodati, dopoStorico]);
      await x.s.emetti("messaging-history.set", { messages: [foto(J, "T9", {}, { ts: TS - GIORNO_S })], progress: 30, syncType: 2 });
      c("un secondo blocco con media lo richiama (la pausa riparte da capo)", [7, 2], [accodati, dopoStorico]);
    }
    {
      //  Un dopoStorico che lancia non ferma lo storico: le righe entrano, il log dice solo un codice.
      const J = `${C1}@s.whatsapp.net`;
      const rotta = { accoda: () => ({ ok: true }), dopoStorico: () => { throw new Error("rotto http://segreto.example 393330000001"); } };
      const x = await monta({ immagini: rotta });
      await x.s.emetti("messaging-history.set", { messages: [foto(J, "U1", {}, { ts: TS - GIORNO_S })], progress: 40, syncType: 2 });
      c("dopoStorico che lancia: la riga di testo entra, lo storico si registra, nessun evento fallito", [["U1"], 1, false], [x.righe("storico").map((m) => m.id), x.log.filter(([k]) => k === "storico").length, x.log.some(([k]) => k === "evento_fallito")]);
      c("…il log dice un codice fisso e niente del testo dell'errore", [true, []], [x.log.some(([k]) => k === "immagini_storico_fallito"), x.log.filter((r) => /segreto|http|3933300|rotto/.test(JSON.stringify(r)))]);
      //  Una `immagini` di vecchio stampo (solo accoda) continua a funzionare.
      const y = await monta({ immagini: { accoda: () => ({ ok: true }) } });
      await y.s.emetti("messaging-history.set", { messages: [foto(J, "U2", {}, { ts: TS - GIORNO_S })], progress: 40, syncType: 2 });
      c("un oggetto `immagini` senza dopoStorico non rompe lo storico", [["U2"], false], [y.righe("storico").map((m) => m.id), y.log.some(([k]) => k === "evento_fallito")]);
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
