/** ── PROVE: IL SERVIZIO SUL MAC: GUARDIE (niente invii, log puliti) ──
 *
 *  File d'area della commessa 2026-10-29-ponte-whatsapp-baileys, compito T6.
 *  Prova l'esecuzione del servizio (`index.mjs`, `collega.mjs`, `qr.mjs`, il
 *  plist modello, `installa.sh`, `disinstalla.sh`) SENZA WhatsApp e senza
 *  rete: Baileys è sostituito da un socket finto, il QR da un PNG finto, le
 *  notifiche e `open` da un registro di chiamate. Niente launchd: gli script
 *  si controllano a testo e con `bash -n`; `installa.sh` si lancia solo con
 *  una HOME temporanea e un Node finto, e deve fermarsi prima di scrivere.
 *  I contratti stanno in `src/crm/ponte/tipi.ts` (`mod["ponte/tipi"]`).
 *  Dati inventati: nessun numero né nome vero (prefisso 39 333 000…).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const NOI = "393330009999";
const C1 = "393330000001";
const C2 = "393330000002";
const C3 = "393330000003";
const C4 = "393330000004";
const T0 = Date.UTC(2026, 9, 29, 12, 0, 0);
const TS = T0 / 1000 - 3600;
const permessi = (p) => statSync(p).mode & 0o777;

/** Il codice senza commenti: le guardie guardano solo quello che gira. */
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

/** Un `WAMessage` finto. */
function wa(remoteJid, id, testo, key = {}) {
  return { key: { remoteJid, fromMe: false, id, ...key }, messageTimestamp: TS, message: { conversation: testo }, pushName: "Cliente Finto" };
}

/** Baileys finto: registra le opzioni del socket e lascia emettere eventi. */
function baileysFinto() {
  const socket = [];
  const salvataggi = { n: 0 };
  const baileys = {
    Browsers: { macOS: (b) => ["Mac OS", b, "14.4.1"] },
    useMultiFileAuthState: async (cartella) => ({ state: { cartella }, saveCreds: async () => void salvataggi.n++ }),
    makeWASocket: (opzioni) => {
      const ascolti = new Map();
      const s = {
        opzioni,
        chiuso: 0,
        user: { id: `${NOI}:3@s.whatsapp.net` },
        ev: { on: (nome, f) => ascolti.set(nome, [...(ascolti.get(nome) ?? []), f]) },
        signalRepository: { lidMapping: { getPNForLID: async (lid) => (lid === "777@lid" ? `${C3}:0@s.whatsapp.net` : null) } },
        end: () => void s.chiuso++,
        emetti: async (nome, dati) => {
          for (const f of ascolti.get(nome) ?? []) await f(dati);
        },
        ascolta: (nome) => (ascolti.get(nome) ?? []).length,
      };
      socket.push(s);
      return s;
    },
  };
  return { baileys, socket, salvataggi };
}

export async function provePonteServizioGuardie(_mod, { c, gruppo, radice }) {
  gruppo("PONTE WHATSAPP · IL SERVIZIO SUL MAC: GUARDIE ED ESECUZIONE (compito T6)");
  const cartella = join(radice, "strumenti/ponte-whatsapp");
  const src = join(cartella, "src");
  const url = (f) => pathToFileURL(join(src, f)).href;
  const I = await import(url("index.mjs"));
  const K = await import(url("collega.mjs"));
  const Q = await import(url("qr.mjs"));
  const L = await import(url("lotti.mjs"));
  const base = mkdtempSync(join(tmpdir(), "ponte-t6-"));

  try {
    // ── 1. Guardie statiche su TUTTO il servizio ─────────────────────────
    const file = readdirSync(src).filter((f) => f.endsWith(".mjs")).sort();
    c("il servizio ha i file del piano", true, ["collega.mjs", "config.mjs", "estrai.mjs", "index.mjs", "lotti.mjs", "qr.mjs", "riconnessione.mjs"].every((f) => file.includes(f)));
    const codice = Object.fromEntries(file.map((f) => [f, senzaCommenti(readFileSync(join(src, f), "utf8"))]));
    const vietati = ["sendMessage", "readMessages", "sendReceipt", "sendPresenceUpdate", "groupCreate", "updateProfile", "relayMessage", "chatModify", "logout", "sendNode", "rejectCall", "presenceSubscribe", "updateBlockStatus", "appPatch", "sendRetryRequest", "sendWAMBuffer", "query("];
    c("nessuna chiamata che scrive su WhatsApp, in nessun file", [], file.flatMap((f) => vietati.filter((v) => codice[f].includes(v)).map((v) => `${f}: ${v}`)));
    //  Lista bianca: sul socket si chiamano SOLO questi (tutto il resto è vietato).
    const ammesse = new Set(["ev.on", "end", "signalRepository.lidMapping.getPNForLID"]);
    const chiamate = file.flatMap((f) => [...codice[f].matchAll(/\bsock\??\.([\w?.]+)\s*\(/g)].map((m) => m[1].replace(/\?/g, "")));
    c("sul socket si chiamano solo ev.on, end e getPNForLID", [], chiamate.filter((x) => !ammesse.has(x)));
    c("il socket si usa davvero (la guardia non è vuota)", true, chiamate.includes("ev.on") && chiamate.includes("signalRepository.lidMapping.getPNForLID"));
    c("nessun console.<metodo>(…) né console[…] in nessun file", [], file.filter((f) => /\bconsole\s*(\.\s*\w+\s*\(|\[)/.test(codice[f])));
    c("console si tocca solo in index.mjs, per sostituirla", [], file.filter((f) => f !== "index.mjs" && /\bconsole\b/.test(codice[f])));
    c("Baileys entra solo da index.mjs (import dinamico)", [], file.filter((f) => f !== "index.mjs" && codice[f].includes("@whiskeysockets/baileys")));
    c("index.mjs: Baileys con import() e non in cima al file", [true, false], [/import\(\s*"@whiskeysockets\/baileys"\s*\)/.test(codice["index.mjs"]), /^import[^\n]*@whiskeysockets/m.test(codice["index.mjs"])]);
    c("la cartella di casa si legge solo in index.mjs", [], file.filter((f) => f !== "index.mjs" && /homedir|process\.env\.HOME|tmpdir/.test(codice[f])));
    c("index.mjs mette umask 077 (file 600, cartelle 700)", true, /process\.umask\(0o077\)/.test(codice["index.mjs"]));
    c("nessun logout: scollegare il dispositivo lo fa solo il titolare", false, /logout/.test(Object.values(codice).join("\n")));

    // ── 2. Dove scrive: solo nella cartella di stato e nel log ────────────
    const p = I.percorsiDi("/Users/finto");
    const casa = "/Users/finto/Library/Application Support/HGL/ponte-wa";
    c("percorsi: tutti sotto la cartella di stato, tranne il log", { base: casa, app: `${casa}/app`, auth: `${casa}/auth`, fila: `${casa}/fila`, config: `${casa}/config.env`, stato: `${casa}/stato.json`, lid: `${casa}/lid.json`, qr: `${casa}/qr.png`, log: "/Users/finto/Library/Logs/hgl-ponte-wa.log" }, p);
    c("percorsi: nessuno nel repo né nel com.ponte.whatsapp di Oclak", [], Object.values(p).filter((x) => x.includes("Documents") || x.includes("/ponte-whatsapp")));

    // ── 3. Node: solo LTS 22 o 24, come engines ──────────────────────────
    const pkg = JSON.parse(readFileSync(join(cartella, "package.json"), "utf8"));
    c("Node ammessi = engines di package.json", pkg.engines.node, I.NODE_AMMESSI.map((n) => `^${n}.0.0`).join(" || "));
    c("nodeAmmesso: 22 e 24 sì, 20, 23, 25 no", [true, true, false, false, false], ["22.12.0", "24.3.1", "20.19.0", "23.1.0", "25.9.0"].map(I.nodeAmmesso));
    c("la versione di Baileys del battito è quella di package.json", pkg.dependencies["@whiskeysockets/baileys"], I.VERSIONE_BAILEYS);

    // ── 4. Il registro: solo codici e numeri, rotazione a 5 MB ───────────
    c("rotazione a 5 MB", 5 * 1024 * 1024, I.LOG_MAX_BYTE);
    const log = join(base, "prova.log");
    const reg = I.creaRegistro({ percorso: log, maxByte: 400, orologio: () => T0 });
    reg("avvio", { lotti: 3, testo: "Ciao 393330000001", jid: 5, "Brutta Chiave": 1, n: Number.NaN });
    reg("Ciao 393330000001@s.whatsapp.net");
    const righe = readFileSync(log, "utf8").trim().split("\n");
    c("registro: data, codice e solo contatori numerici", ["2026-10-29T12:00:00.000Z avvio lotti=3 jid=5", "2026-10-29T12:00:00.000Z codice_non_valido"], righe);
    for (let i = 0; i < 30; i++) reg("battito", { in_coda: i });
    c("registro: oltre il tetto il file passa in .1 e riparte", [true, true], [existsSync(`${log}.1`), statSync(log).size <= 400]);

    // ── 5. La prova dei log (obiezione 5): console e uscite sostituite ────
    const figlio = join(base, "figlio.mjs");
    const logFiglio = join(base, "figlio.log");
    writeFileSync(
      figlio,
      `import { blindaUscite, creaRegistro } from ${JSON.stringify(url("index.mjs"))};
       blindaUscite(creaRegistro({ percorso: ${JSON.stringify(logFiglio)} }), { terminale: false });
       console.info({ remoteJid: "${C1}@s.whatsapp.net", text: "Ciao segreto", body: "appuntamento" });
       console.log("qr 2@QRFINTO,abc", "${C2}@lid");
       console.warn("Closing session", { jid: "${C1}.0" });
       console.error(new Error("body ${C1}"));
       console.debug("Cliente Finto"); console.trace("traccia ${C2}");
       process.stdout.write("${C1} Ciao segreto\\n");
       process.stderr.write("${C2} Ciao segreto\\n");
       Promise.reject(new Error("rifiuto ${C1}@s.whatsapp.net"));
       setTimeout(() => { throw new Error("eccezione ${C2}@lid Ciao segreto"); }, 20);`,
    );
    const r = spawnSync(process.execPath, [figlio], { encoding: "utf8", timeout: 20_000 });
    c("prova dei log: stdout e stderr del processo restano vuoti", ["", ""], [r.stdout, r.stderr]);
    const scritto = existsSync(logFiglio) ? readFileSync(logFiglio, "utf8") : "";
    c("prova dei log: nel log nessun numero, JID, testo, nome o QR", [], ["3933300", "@", "Ciao", "segreto", "Cliente", "QRFINTO", "appuntamento", "Closing"].filter((x) => scritto.includes(x)));
    c("prova dei log: nel log ci sono i codici (console, uscite, rifiuto, eccezione)", [true, true, true, true, true], ["console_info", "console_error", "uscita_stdout", "promessa_rifiutata", "eccezione"].map((x) => scritto.includes(x)).slice(0, 5));
    c("un'eccezione non gestita chiude il processo (launchd lo riavvia)", 70, r.status);

    // ── 6. Il logger di Baileys è muto ───────────────────────────────────
    const muto = K.LOGGER_MUTO;
    c("logger di Baileys: livello silent, child muto, metodi che non fanno niente", ["silent", true, true], [muto.level, muto.child({ jid: "x" }) === muto, ["trace", "debug", "info", "warn", "error", "fatal"].every((m) => muto[m]({ remoteJid: `${C1}@s.whatsapp.net` }, "qr") === undefined)]);

    // ── 7. Il QR: PNG 600, open e notifica una volta, terminale se c'è ────
    const chiamate7 = [];
    const terminale = [];
    const stato7 = join(base, "stato7");
    mkdirSync(stato7, { mode: 0o700 });
    const qr = Q.creaQr({
      percorso: join(stato7, "qr.png"),
      generaPng: async (t) => Buffer.from(`PNG:${t}`),
      disegnaTerminale: async () => "▀▄▀",
      esegui: async (cmd, args) => void chiamate7.push([cmd, ...args]),
      terminale: (t) => terminale.push(t),
    });
    await qr.mostra("2@QRFINTO");
    await qr.mostra("2@QRFINTO2");
    c("QR: qr.png scritto con permessi 600 e il codice nuovo", [0o600, "PNG:2@QRFINTO2"], [permessi(join(stato7, "qr.png")), readFileSync(join(stato7, "qr.png"), "utf8")]);
    c("QR: open e notifica solo al primo codice, non a ogni rinnovo", ["open", "osascript"], chiamate7.map((x) => x[0]));
    c("QR: il PNG si apre con open, la notifica è un testo fisso passato come argomento", [true, true], [chiamate7[0][1] === join(stato7, "qr.png"), chiamate7[1].includes(Q.NOTIFICHE.attesa_qr)]);
    c("QR: la notifica non contiene il codice", false, chiamate7.flat().some((x) => String(x).includes("QRFINTO")));
    c("QR: nel terminale (se interattivo) il disegno, mai il testo del codice", [true, false], [terminale.some((t) => t.includes("▀▄▀")), terminale.some((t) => t.includes("QRFINTO"))]);
    qr.togli();
    c("QR: togli() cancella il file", false, existsSync(join(stato7, "qr.png")));
    const qrMuto = Q.creaQr({ percorso: join(stato7, "qr.png"), generaPng: async () => Buffer.from("x"), esegui: async () => { throw new Error("niente osascript"); } });
    await qrMuto.mostra("2@ALTRO");
    c("QR: se open o osascript falliscono il ponte va avanti", true, existsSync(join(stato7, "qr.png")));
    c("notifiche: testi fissi, senza numeri né la parola QR in un dato", true, Object.values(Q.NOTIFICHE).every((t) => typeof t === "string" && !/\d{6,}/.test(t)));

    // ── 8. Il collegamento con un Baileys finto ──────────────────────────
    const stato8 = join(base, "stato8");
    mkdirSync(stato8, { mode: 0o700 });
    const P = { auth: join(stato8, "auth"), lid: join(stato8, "lid.json") };
    const fila = L.creaFila({ cartella: join(stato8, "fila"), orologio: () => T0 });
    const { baileys, socket, salvataggi } = baileysFinto();
    const timer = [];
    const avvisi = [];
    const notifiche = [];
    const mostrati = [];
    const qrFinto = { mostra: async (t) => void mostrati.push(t), togli: () => void mostrati.push("tolto"), notifica: async (k) => void notifiche.push(k) };
    const col = K.creaCollegamento({
      baileys,
      percorsi: P,
      fila,
      qr: qrFinto,
      registro: () => {},
      orologio: () => T0,
      casuale: () => 0.5,
      pianifica: (f, ms) => timer.push({ f, ms }),
      annulla: () => {},
      avvisa: () => avvisi.push(col.istantanea().stato),
    });
    await col.avvia();
    const s1 = socket[0];
    c("socket: opzioni del §a3", { browser: ["Mac OS", "Desktop", "14.4.1"], syncFullHistory: true, markOnlineOnConnect: false, logger: K.LOGGER_MUTO, auth: { cartella: P.auth } }, { browser: s1.opzioni.browser, syncFullHistory: s1.opzioni.syncFullHistory, markOnlineOnConnect: s1.opzioni.markOnlineOnConnect, logger: s1.opzioni.logger, auth: s1.opzioni.auth });
    c("socket: getMessage non restituisce mai un messaggio (niente reinvii)", undefined, await s1.opzioni.getMessage({ id: "X" }));
    c("auth/ creata con permessi 700", 0o700, permessi(P.auth));
    await s1.emetti("creds.update", {});
    c("creds.update salva le credenziali", 1, salvataggi.n);

    await s1.emetti("connection.update", { qr: "2@QRFINTO" });
    c("qr → stato attesa_qr e QR mostrato", ["attesa_qr", "2@QRFINTO"], [col.istantanea().stato, mostrati[0]]);
    c("qr nuovo → lo storico ricomincia (fatto 0, avanzamento 0)", { fatto: false, avanzamento: 0 }, col.istantanea().storico);
    await s1.emetti("connection.update", { connection: "open" });
    c("open → stato collegato, QR tolto, collegato_dal = adesso", ["collegato", "tolto", new Date(T0).toISOString()], [col.istantanea().stato, mostrati[1], col.istantanea().collegato_dal]);

    await s1.emetti("messaging-history.set", {
      messages: [
        wa(`${C1}@s.whatsapp.net`, "S1", "ciao dallo storico"),
        wa("555@lid", "S2", "dal lid della mappa"),
        wa("777@lid", "S3", "dal lid di getPNForLID"),
        wa("999@lid", "S4", "lid sconosciuto"),
        wa("120363000000000000@g.us", "S5", "gruppo"),
        wa(`${NOI}@s.whatsapp.net`, "S6", "a me stesso"),
      ],
      contacts: [{ id: `${C1}@s.whatsapp.net`, notify: "Cliente Uno" }],
      lidPnMappings: [{ lid: "555@lid", pn: `${C2}@s.whatsapp.net` }],
      progress: 40,
    });
    const lotti8 = readdirSync(join(stato8, "fila/storico")).map((f) => JSON.parse(readFileSync(join(stato8, "fila/storico", f), "utf8")).lotto);
    c("storico → in fila/storico i tre messaggi con numero", [["S1", C1], ["S2", C2], ["S3", C3]], lotti8.flatMap((l) => l.messaggi.map((m) => [m.id, m.numero])));
    c("storico → i nomi dei contatti viaggiano col lotto", "Cliente Uno", lotti8[0].nomi[C1]);
    c("storico → avanzamento dal progress", { fatto: false, avanzamento: 40 }, col.istantanea().storico);
    c("estrazione: contatori per motivo, solo numeri", { letti: 6, validi: 3, senza_numero: 1, gruppo: 1, se_stesso: 1 }, Object.fromEntries(["letti", "validi", "senza_numero", "gruppo", "se_stesso"].map((k) => [k, col.istantanea().estrazione[k]])));
    c("lid.json: mappa dello storico e di getPNForLID, permessi 600", [{ 555: C2, 777: C3 }, 0o600], [JSON.parse(readFileSync(P.lid, "utf8")), permessi(P.lid)]);
    c("ultimo_messaggio_il = l'orario vero dell'ultimo messaggio", new Date(TS * 1000).toISOString(), col.istantanea().ultimo_messaggio_il);

    await s1.emetti("messaging-history.status", { syncType: 2, status: "complete" });
    c("storico completo → fatto, 100", { fatto: true, avanzamento: 100 }, col.istantanea().storico);

    await s1.emetti("messages.upsert", { type: "notify", messages: [wa(`${C4}@s.whatsapp.net`, "V1", "vivo")] });
    await s1.emetti("messages.upsert", { type: "append", messages: [wa(`${C4}@s.whatsapp.net`, "V2", "vivo dal telefono", { fromMe: true })] });
    const vivi = readdirSync(join(stato8, "fila/vivo")).map((f) => JSON.parse(readFileSync(join(stato8, "fila/vivo", f), "utf8")));
    c("messages.upsert (notify e append) → fila/vivo, pronti dopo 30 s", [["V1", "in"], ["V2", "out"], [T0 + 30_000]], [...vivi.flatMap((v) => v.lotto.messaggi.map((m) => [m.id, m.dir])), [...new Set(vivi.map((v) => v.prossimo_il))]]);

    await s1.emetti("lid-mapping.update", { lid: "888@lid", pn: `${C4}@s.whatsapp.net` });
    c("lid-mapping.update (una voce) → lid.json", C4, JSON.parse(readFileSync(P.lid, "utf8"))["888"]);
    c("dopo ogni cambiamento si avvisa (stato.json e invio)", true, avvisi.length >= 5);

    //  440: non riconnette subito, aspetta 10 minuti.
    await s1.emetti("connection.update", { connection: "close", lastDisconnect: { error: { output: { statusCode: 440 } } } });
    c("440 → sostituita, attesa 10 minuti, notifica", ["sostituita", 600_000, "sostituita"], [col.istantanea().stato, timer.at(-1).ms, notifiche.at(-1)]);
    c("nessun socket nuovo prima dell'attesa", 1, socket.length);
    await timer.at(-1).f();
    c("dopo l'attesa un socket nuovo", 2, socket.length);
    const s2 = socket[1];
    await s1.emetti("messages.upsert", { type: "notify", messages: [wa(`${C4}@s.whatsapp.net`, "VECCHIO", "dal socket vecchio")] });
    c("gli eventi del socket vecchio si ignorano", 2, readdirSync(join(stato8, "fila/vivo")).length);

    //  Rete: attese crescenti, mai un ciclo stretto.
    await s2.emetti("connection.update", { connection: "close", lastDisconnect: { error: { output: { statusCode: 428 } } } });
    c("428 → in_collegamento con attesa di 5 s", ["in_collegamento", 5000], [col.istantanea().stato, timer.at(-1).ms]);
    await timer.at(-1).f();
    const s3 = socket[2];
    await s3.emetti("connection.update", { connection: "close", lastDisconnect: { error: { output: { statusCode: 408 } } } });
    c("seconda chiusura di rete → 15 s", 15_000, timer.at(-1).ms);
    await timer.at(-1).f();

    //  401: la sessione va da parte, lid.json si azzera, si riparte col QR.
    const s4 = socket[3];
    writeFileSync(join(P.auth, "creds.json"), "{}");
    await s4.emetti("connection.update", { connection: "close", lastDisconnect: { error: { output: { statusCode: 401 } } } });
    const daParte = readdirSync(stato8).filter((f) => f.startsWith("auth.scollegato-"));
    c("401 → auth/ spostata (non riusata), lid.json azzerato, notifica", [1, true, false, "sessione_scaduta", "sessione_scaduta"], [daParte.length, existsSync(join(stato8, daParte[0] ?? "-", "creds.json")), existsSync(P.lid), col.istantanea().stato, notifiche.at(-1)]);
    c("401 → auth/ nuova, vuota, 700, e socket subito", [[], 0o700, 0], [readdirSync(P.auth), permessi(P.auth), timer.at(-1).ms]);
    await timer.at(-1).f();
    c("401 → il socket nuovo parte senza credenziali (compare il QR)", 5, socket.length);

    col.ferma();
    const timerPrima = timer.length;
    await socket[4].emetti("connection.update", { connection: "close", lastDisconnect: { error: { output: { statusCode: 428 } } } });
    c("ferma(): chiude il socket e non riconnette più", [1, timerPrima], [socket[4].chiuso, timer.length]);

    // ── 9. Il battito ────────────────────────────────────────────────────
    const ist = { stato: "collegato", collegato_dal: "2026-10-29T11:00:00.000Z", ultimo_messaggio_il: null, storico: { fatto: true, avanzamento: 100 }, estrazione: { letti: 10, validi: 8, gruppo: 2 } };
    const filaC = { in_coda: 4, lotti_storico: 1, lotti_vivo: 1, scartati: 2, non_noti_scaduti: 0, divisi: 0, piena: false };
    const b = I.corpoBattito(ist, filaC, {});
    c("battito: la forma di BattitoPonte", ["v", "tipo", "stato", "collegato_dal", "ultimo_messaggio_il", "storico", "in_coda", "scartati", "contatori", "versione"], Object.keys(b));
    c("battito: v 1, tipo battito, versione di Baileys", [1, "battito", I.VERSIONE_BAILEYS], [b.v, b.tipo, b.versione]);
    c("battito: contatori solo numeri, chiavi minuscole, al più 20", [true, true], [Object.entries(b.contatori).every(([k, v]) => /^[a-z_]+$/.test(k) && Number.isFinite(v)), Object.keys(b.contatori).length <= 20]);
    c("battito: fila piena e collegato → coda_piena", "coda_piena", I.corpoBattito(ist, { ...filaC, piena: true }, {}).stato);
    c("battito: 401/503 dal CRM e collegato → errore", "errore", I.corpoBattito(ist, filaC, { erroreServer: true }).stato);
    c("battito: senza WhatsApp vince lo stato del collegamento", "attesa_qr", I.corpoBattito({ ...ist, stato: "attesa_qr" }, filaC, { erroreServer: true }).stato);
    c("battito ogni 60 s", 60_000, I.BATTITO_MS);

    // ── 10. Il plist modello ─────────────────────────────────────────────
    const plist = readFileSync(join(cartella, "launchd/it.hgl.ponte-whatsapp.plist.modello"), "utf8");
    const chiave = (k) => plist.match(new RegExp(`<key>${k}</key>\\s*<string>([^<]*)</string>`))?.[1];
    c("plist: etichetta it.hgl.ponte-whatsapp", "it.hgl.ponte-whatsapp", chiave("Label"));
    c("plist: stdout e stderr al log a rotazione, cartella app/", ["{{LOG}}", "{{LOG}}", "{{APP}}"], [chiave("StandardOutPath"), chiave("StandardErrorPath"), chiave("WorkingDirectory")]);
    c("plist: caffeinate -i <node> src/index.mjs", ["/usr/bin/caffeinate", "-i", "{{NODE}}", "src/index.mjs"], [...(plist.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? "").matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]));
    c("plist: RunAtLoad, ThrottleInterval 30, Background, PATH con homebrew", [true, true, true, true], [/<key>RunAtLoad<\/key>\s*<true\/>/.test(plist), /<key>ThrottleInterval<\/key>\s*<integer>30<\/integer>/.test(plist), /<key>ProcessType<\/key>\s*<string>Background<\/string>/.test(plist), /<key>PATH<\/key>\s*<string>[^<]*\/opt\/homebrew\/bin/.test(plist)]);
    c("plist: niente token, niente percorsi personali", [false, false, false], [/TOKEN|[0-9a-f]{32}/i.test(plist), /\/Users\//.test(plist), /Documents/.test(plist)]);

    // ── 11. installa.sh e disinstalla.sh ─────────────────────────────────
    const ins = join(cartella, "installa.sh");
    const dis = join(cartella, "disinstalla.sh");
    c("installa.sh e disinstalla.sh: sintassi bash valida", [0, 0], [spawnSync("bash", ["-n", ins]).status, spawnSync("bash", ["-n", dis]).status]);
    const testoIns = readFileSync(ins, "utf8");
    const testoDis = readFileSync(dis, "utf8");
    const righeIns = testoIns.split("\n").filter((r) => !/^\s*#/.test(r));
    c("installa.sh: npm ci --omit=dev --ignore-scripts, col npm accanto al Node LTS", true, righeIns.some((r) => /"\$NPM" ci --omit=dev --ignore-scripts/.test(r)));
    c("installa.sh: la chiave si legge con read -s (non si vede)", true, /^\s*read\b[^\n]*\s-r?s\b[^\n]*\bTOKEN\s*$/m.test(testoIns));
    c("installa.sh: la chiave non si stampa mai (va solo nel file temporaneo)", [], righeIns.filter((r) => /\$\{?TOKEN\b/.test(r) && /(echo|printf)/.test(r) && !/>>"\$tmp"\s*$/.test(r)));
    c("installa.sh: la chiave si scrive una volta sola, in config.env.tmp", 1, righeIns.filter((r) => /printf 'PONTE_TOKEN=%s\\n' "\$TOKEN" >>"\$tmp"/.test(r)).length);
    c("installa.sh e disinstalla.sh: nessun launchctl load", [false, false], [/launchctl load/.test(testoIns), /launchctl load/.test(testoDis)]);
    const corpoInstalla = testoIns.match(/^installa\(\) \{\n([\s\S]*?)^\}/m)?.[1] ?? null;
    c("installa.sh: installa() non lancia launchctl (lo dice e basta)", [true, []], [corpoInstalla !== null, (corpoInstalla ?? "").split("\n").filter((r) => /^\s*launchctl\b/.test(r))]);
    c("installa.sh: il Node si controlla prima di scrivere qualunque cosa", true, (corpoInstalla ?? "").indexOf("trova_node") < (corpoInstalla ?? "").indexOf("mkdir"));
    c("installa.sh: sottocomandi installa, stato, scollega, chiave", true, ["installa)", "stato)", "scollega)", "chiave)"].every((k) => testoIns.includes(k)));
    c("installa.sh: stessa etichetta e cartella del servizio", [true, true], [testoIns.includes("it.hgl.ponte-whatsapp"), testoIns.includes("Library/Application Support/HGL/ponte-wa")]);
    c("disinstalla.sh: --tutto chiede conferma prima di cancellare la cartella di stato", true, /--tutto/.test(testoDis) && /read -r/.test(testoDis));

    //  Node non LTS: installa.sh si ferma con una frase chiara PRIMA di scrivere.
    const casaFinta = join(base, "casa");
    mkdirSync(casaFinta);
    const nodeFinto = join(base, "node-finto");
    writeFileSync(nodeFinto, "#!/bin/sh\necho v25.9.0\n");
    chmodSync(nodeFinto, 0o755);
    const rNode = spawnSync("bash", [ins], { encoding: "utf8", env: { PATH: "/usr/bin:/bin", HOME: casaFinta, PONTE_NODE: nodeFinto }, timeout: 20_000 });
    c("installa.sh con Node 25: esce con errore", true, rNode.status !== 0);
    c("installa.sh con Node 25: dice la versione trovata e cosa fare", [true, true, true], [/25/.test(rNode.stderr), /22 o 24/.test(rNode.stderr), /brew install node@24/.test(rNode.stderr)]);
    c("installa.sh con Node 25: non ha scritto niente nella casa", [], readdirSync(casaFinta));
    const rStato = spawnSync("bash", [ins, "stato"], { encoding: "utf8", env: { PATH: "/usr/bin:/bin", HOME: casaFinta, PONTE_NODE: nodeFinto }, timeout: 20_000 });
    c("installa.sh stato senza installazione: lo dice e non scrive", [true, []], [/non è installato/.test(rStato.stdout + rStato.stderr), readdirSync(casaFinta)]);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
