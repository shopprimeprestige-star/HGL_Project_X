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
  const L = await import(url("lotti.mjs"));
  const X = await import(url("index.mjs"));
  const base = mkdtempSync(join(tmpdir(), "ponte-t8-"));
  let n = 0;

  /** Un collegamento con tutto finto. `opz.senzaImmagini`: nessuna immagine; `opz.immagini`: un oggetto al suo posto. */
  async function monta(opz = {}) {
    const dir = join(base, `s${n++}`);
    mkdirSync(dir, { mode: 0o700 });
    const fila = L.creaFila({ cartella: join(dir, "fila"), orologio: () => T0 });
    const log = [];
    const violazioni = [];
    const chiamate = [];
    const scarichi = [];
    const registro = (codice, conteggi = {}) => {
      const pulito = typeof codice === "string" && /^[a-z_]+$/.test(codice) && Object.entries(conteggi).every(([k, v]) => /^[a-z_]+$/.test(k) && typeof v === "number");
      if (!pulito) violazioni.push(`registro non pulito: ${String(codice)}`);
      log.push([codice, conteggi]);
    };
    const fetchFinto = async (indirizzo, init = {}) => {
      const corpo = init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
      if (String(indirizzo) === PONTE) {
        chiamate.push({ metodo: init.method ?? "GET", tipo: corpo?.tipo, corpo });
        const r = corpo?.tipo === "media_permesso" ? { ok: true, esito: "carica", url_carico: CARICO } : corpo?.tipo === "media_fatto" ? { ok: true, esito: "pronta" } : { ok: false };
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
      return Readable.from([JPEG]);
    };
    const immagini = opz.senzaImmagini
      ? undefined
      : (opz.immagini ?? I.creaImmagini({ url: PONTE, token: "t".repeat(40), cartella: join(dir, "immagini"), scarica, fetch: fetchFinto, registro, orologio: () => T0, casuale: () => 0.5, pianifica: (f) => setImmediate(f) }));
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
      await immagini?.sveglia?.();
    };
    return { col, immagini, s, dir, log, chiamate, scarichi, violazioni, righe, finito, coda: join(dir, "immagini", "coda") };
  }
  const sulDisco = (x) => (existsSync(x.coda) ? readdirSync(x.coda).filter((f) => f.endsWith(".json")).length : 0);
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
      c("…contatori: una ok, niente in coda, niente sul disco", [1, 0, 0], [x.immagini.contatori().ok, x.immagini.contatori().in_coda, sulDisco(x)]);
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
      const x = await monta();
      await x.s.emetti("messaging-history.set", {
        messages: [
          foto(`${C1}@s.whatsapp.net`, "H1", {}, { ts: TS - 3 * GIORNO_S }),
          foto(`${C2}@s.whatsapp.net`, "H2", {}, { ts: TS - 20 * GIORNO_S }),
          testo(`${C1}@s.whatsapp.net`, "H3", "ciao dallo storico"),
        ],
        progress: 40,
        syncType: 2,
      });
      await x.finito();
      c("storico: le tre righe di testo vanno in fila/storico (anche la foto vecchia, come prima)", ["H1", "H2", "H3"], x.righe("storico").map((m) => m.id).sort());
      c("storico: solo la foto di 3 giorni fa si carica (una richiesta di permesso, un PUT)", [["media_permesso", "put", "media_fatto"], `bw:${C1}:H1`], [tipi(x), x.chiamate[0]?.corpo?.chiave]);
      c("storico: quella di 20 giorni fa è scartata (vecchia) senza nessuna richiesta", [1, 1, 0], [x.immagini.contatori().scartate, x.immagini.contatori().ok, x.immagini.contatori().in_coda]);
      c("storico: il log `storico` resta quello di prima (letti, validi, tipo)", [["storico", { letti: 3, validi: 3, tipo: 2 }]], x.log.filter(([k]) => k === "storico"));
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
      c("…e le foto ostili sono contate come scartate, mai in coda né sul disco", [Object.keys(ostili).length, 0, 0], [x.immagini.contatori().scartate, x.immagini.contatori().in_coda, sulDisco(x)]);
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
        await x.s.emetti("messaging-history.set", { messages: [foto(`${C1}@s.whatsapp.net`, "K1", {}, { ts: TS - GIORNO_S })], progress: 100, syncType: 2 });
        await x.s.emetti("messages.upsert", { type: "notify", messages: [foto(`${C2}@s.whatsapp.net`, "K2"), testo(`${C2}@s.whatsapp.net`, "K3", "ciao")] });
        await x.finito();
      };
      const con = await monta();
      await eventi(con);
      const senza = await monta({ senzaImmagini: true });
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
      c("index.mjs: il download di Baileys passa come `scarica` e le immagini non si creano con --senza-invio", [true, true], [/\bscarica:\s*baileys\.downloadContentFromMessage\b/.test(index), /if\s*\(\s*!senzaInvio\b[^)]*\)\s*\{\s*immagini\s*=\s*creaImmagini\(/.test(index)]);
      c("index.mjs: un guasto nell'avvio delle immagini non ferma il ponte (try/catch con un codice di log)", true, /immagini_non_avviate/.test(index));
      c("index.mjs: all'avvio riprende la coda su disco e allo stop la ferma", [true, true], [/immagini\??\.avvia\(\)/.test(index), /immagini\??\.ferma\(\)/.test(index)]);
      c("index.mjs: la riga `immagini` del registro nasce da contiImmagini", true, /contiImmagini\(immagini\.contatori\(\)\)/.test(index) && /registro\("immagini",\s*\w+\)/.test(index));
      c("collega.mjs: riceve `immagini` come opzione e non importa né Baileys né immagini.mjs", [true, false, false], [/\bimmagini\s*=\s*null\b/.test(collega), /from "\.\/immagini\.mjs"/.test(collega), /@whiskeysockets/.test(collega)]);
      c("collega.mjs: la foto passa da immagineDa (stesse regole di leggiMessaggio) e da accoda, dentro un try/catch", [true, true], [/immagineDa\(/.test(collega), /immagini\.accoda\(/.test(collega)]);
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
