/** ── PROVE: IL SERVIZIO SUL MAC: GUARDIE (un solo punto d'invio, log puliti) ──
 *
 *  File d'area della commessa 2026-10-29-ponte-whatsapp-baileys, compito T6;
 *  la regola «sola lettura» è diventata «un solo `sendMessage`, a mano, con
 *  limiti» nella commessa 2026-10-30-ponte-invio-manuale, compito T3.
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

/** La regola dell'invio (commessa 2026-10-30-ponte-invio-manuale): in tutto il
 *  servizio `sendMessage` compare UNA volta sola, in `collega.mjs`, come
 *  `sock.sendMessage(jid, { text: <testo> })`, senza altre chiavi (citazioni,
 *  menzioni, media, anteprime…). `codice` = file → sorgente senza commenti.
 *  Restituisce l'elenco delle violazioni (vuoto = regola rispettata). */
export function violazioniUnSoloInvio(codice) {
  const v = [];
  const dove = Object.entries(codice).flatMap(([f, t]) => [...t.matchAll(/sendMessage/g)].map(() => f));
  if (dove.length !== 1) v.push(`sendMessage compare ${dove.length} volte (deve essere 1)`);
  if (dove.some((f) => f !== "collega.mjs")) v.push(`sendMessage fuori da collega.mjs: ${dove.filter((f) => f !== "collega.mjs").join(", ")}`);
  const esatte = Object.values(codice).flatMap((t) => [...t.matchAll(/\bsock\.sendMessage\(jid, \{ text: \w+ \}\)/g)]);
  if (esatte.length !== 1) v.push("manca la forma sock.sendMessage(jid, { text: testo })");
  for (const [f, t] of Object.entries(codice)) {
    for (const m of t.matchAll(/sendMessage\(([^)]*)\)/g)) {
      if (/\b(quoted|mentions|image|video|document|audio|sticker|location|contacts|react|forward|edit|delete|linkPreview|caption|viewOnce|ptt)\b/.test(m[1])) v.push(`${f}: sendMessage con una chiave non ammessa`);
    }
  }
  return v;
}

/** La lista bianca del download delle immagini (commessa 2026-10-30-ponte-storico-completo, T8, PIANO c.1):
 *  · `downloadMediaMessage`, `updateMediaMessage`, `reuploadRequest`, `requestPlaceholderResend` non compaiono in
 *    nessun file (il primo accetta l'`url` del messaggio; gli altri chiedono al telefono di rimandare i media);
 *  · `downloadContentFromMessage` compare solo in `index.mjs` (il controllo che esista e il valore di `scarica`; Baileys
 *    arriva solo da lì); `immagini.mjs` lo riceve come parametro;
 *  · in `immagini.mjs` `scarica(` si chiama una volta sola, con `(copia, "image", { host: … })`, e `copia` ha SOLO
 *    `mediaKey` e `directPath` (mai `url`, mai l'oggetto del messaggio); il lavoro viene da `accoda`, che chiama
 *    `validaOrigine` PRIMA di scrivere in coda, o dal disco, riletto con `lavoroValido`;
 *  · nessun modulo di rete di Node; `fetch(` solo verso `PONTE_URL` (`lotti.mjs`, `fetch(url`) e verso l'URL di
 *    carico già validato (`immagini.mjs`, `fetch(urlCarico`, che esce da `urlCaricoValido`).
 *  `codice` = file → sorgente senza commenti. Restituisce le violazioni (vuoto = regola rispettata). */
export function violazioniImmagini(codice) {
  const v = [];
  const dove = (re) => Object.entries(codice).flatMap(([f, t]) => [...t.matchAll(re)].map(() => f));
  for (const nome of ["downloadMediaMessage", "updateMediaMessage", "reuploadRequest", "requestPlaceholderResend"]) {
    const f = dove(new RegExp(`\\b${nome}\\b`, "g"));
    if (f.length) v.push(`${nome} nel codice: ${[...new Set(f)].join(", ")}`);
  }
  const scarico = dove(/\bdownloadContentFromMessage\b/g);
  if (scarico.length === 0 || scarico.some((f) => f !== "index.mjs")) v.push(`downloadContentFromMessage deve comparire solo in index.mjs (trovato: ${[...new Set(scarico)].join(", ") || "mai"})`);
  if (!/\bscarica:\s*baileys\.downloadContentFromMessage\b/.test(codice["index.mjs"] ?? "")) v.push("index.mjs non passa baileys.downloadContentFromMessage come `scarica`");

  const im = codice["immagini.mjs"] ?? "";
  const chiamate = [...im.matchAll(/\bscarica\(([^)]*)\)/g)].map((m) => m[1].replace(/\s+/g, " ").trim());
  if (chiamate.length !== 1 || chiamate[0] !== 'copia, "image", { host: lavoro.host }') v.push(`in immagini.mjs scarica( si chiama una volta, con (copia, "image", { host: lavoro.host }); trovato: ${chiamate.join(" | ") || "mai"}`);
  const copie = [...im.matchAll(/\bconst copia = \{([^}]*)\}/g)].map((m) => [...m[1].matchAll(/(\w+)\s*:/g)].map((k) => k[1]).sort().join(","));
  if (copie.length !== 1 || copie[0] !== "directPath,mediaKey") v.push(`la copia per Baileys deve avere solo mediaKey e directPath (trovato: ${copie.join(" | ") || "nessuna"})`);
  const accoda = im.slice(Math.max(0, im.indexOf("accoda(richiesta)")));
  const prima = accoda.indexOf("const origine = validaOrigine(immagine);");
  const scrive = accoda.indexOf("indice.set(nome, lavoro)");
  if (prima < 0 || scrive < 0 || prima > scrive) v.push("accoda deve chiamare validaOrigine prima di mettere in coda");
  if ((im.match(/\bindice\.set\(/g) ?? []).length !== 2 || !/lavoroValido\(nome, JSON\.parse\(readFileSync/.test(im)) v.push("i lavori entrano in coda solo da accoda (validaOrigine) o dal disco riletto con lavoroValido");

  for (const [f, t] of Object.entries(codice)) {
    if (/from\s+"node:(http|https|http2|net|tls|dgram|dns)"/.test(t) || /\brequire\(\s*"(node:)?(http|https|http2|net|tls|dgram|dns)"/.test(t)) v.push(`${f}: modulo di rete di Node`);
    if (/\b(XMLHttpRequest|WebSocket|EventSource)\b/.test(t) || /\bundici\b/.test(t)) v.push(`${f}: client di rete diverso da fetch`);
  }
  const ammessi = { "lotti.mjs": ["fetch(url"], "immagini.mjs": ["fetch(urlCarico"] };
  for (const [f, t] of Object.entries(codice)) {
    const trovati = [...t.matchAll(/\bfetch\s*\(\s*(\w+)/g)].map((m) => `fetch(${m[1]}`);
    const fuori = trovati.filter((x) => !(ammessi[f] ?? []).includes(x));
    if (fuori.length) v.push(`${f}: fetch fuori lista (${fuori.join(", ")})`);
  }
  if (!/const urlCarico = risposta\.esito === "carica" \? urlCaricoValido\(/.test(im)) v.push("immagini.mjs: l'URL di carico deve uscire da urlCaricoValido");
  return v;
}

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
      const nodi = [];
      const s = {
        opzioni,
        chiuso: 0,
        user: { id: `${NOI}:3@s.whatsapp.net` },
        ev: { on: (nome, f) => ascolti.set(nome, [...(ascolti.get(nome) ?? []), f]) },
        //  il websocket grezzo: Baileys ci emette i nodi ricevuti (`CB:message`)
        ws: { on: (nome, f) => nome === "CB:message" && nodi.push(f) },
        signalRepository: { lidMapping: { getPNForLID: async (lid) => (lid === "777@lid" ? `${C3}:0@s.whatsapp.net` : null) } },
        end: () => void s.chiuso++,
        emetti: async (nome, dati) => {
          for (const f of ascolti.get(nome) ?? []) await f(dati);
        },
        ascolta: (nome) => (ascolti.get(nome) ?? []).length,
        //  come `EventEmitter.emit`: chiama in modo sincrono; qui si aspetta anche
        //  la promessa restituita, per leggere lo stato dopo
        nodiAscoltati: () => nodi.length,
        emettiNodo: async (nodo) => {
          for (const f of nodi) await f(nodo);
        },
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
    c("il servizio ha i file del piano", true, ["cache.mjs", "collega.mjs", "config.mjs", "estrai.mjs", "immagini.mjs", "index.mjs", "invio.mjs", "lotti.mjs", "qr.mjs", "riconnessione.mjs"].every((f) => file.includes(f)));
    const codice = Object.fromEntries(file.map((f) => [f, senzaCommenti(readFileSync(join(src, f), "utf8"))]));
    const vietati = ["readMessages", "sendReceipt", "sendPresenceUpdate", "groupCreate", "updateProfile", "relayMessage", "chatModify", "logout", "sendNode", "rejectCall", "presenceSubscribe", "updateBlockStatus", "appPatch", "sendRetryRequest", "sendWAMBuffer", "query("];
    c("nessuna chiamata che scrive o legge a nome del titolare (tranne l'invio a mano), in nessun file", [], file.flatMap((f) => vietati.filter((v) => codice[f].includes(v)).map((v) => `${f}: ${v}`)));
    c("UN SOLO sendMessage in tutto il servizio, in collega.mjs, solo {text}", [], violazioniUnSoloInvio(codice));
    //  Prova negativa: una copia del sorgente con una seconda scrittura (o con una
    //  chiave in più) deve far fallire la regola.
    const copia = join(base, "copia-src");
    mkdirSync(copia);
    for (const f of file) writeFileSync(join(copia, f), readFileSync(join(src, f), "utf8"));
    const dellaCopia = () => Object.fromEntries(file.map((f) => [f, senzaCommenti(readFileSync(join(copia, f), "utf8"))]));
    c("la copia intatta passa la regola (la prova negativa parte da qui)", [], violazioniUnSoloInvio(dellaCopia()));
    const collegaOriginale = readFileSync(join(copia, "collega.mjs"), "utf8");
    writeFileSync(join(copia, "collega.mjs"), `${collegaOriginale}\nasync function altroInvio(jid) { return sock.sendMessage(jid, { text: "ciao" }); }\n`);
    c("negativa: una seconda sendMessage in collega.mjs fa fallire la regola", true, violazioniUnSoloInvio(dellaCopia()).length > 0);
    writeFileSync(join(copia, "collega.mjs"), collegaOriginale.replace("sock.sendMessage(jid, { text: testo })", "sock.sendMessage(jid, { text: testo, mentions: [jid] })"));
    c("negativa: una chiave in più (mentions) accanto a sendMessage fa fallire la regola", true, violazioniUnSoloInvio(dellaCopia()).length > 0);
    writeFileSync(join(copia, "collega.mjs"), collegaOriginale);
    writeFileSync(join(copia, "invio.mjs"), `${readFileSync(join(copia, "invio.mjs"), "utf8")}\nconst x = (s) => s.sendMessage(1, { text: "a" });\n`);
    c("negativa: sendMessage in un altro file (invio.mjs) fa fallire la regola", true, violazioniUnSoloInvio(dellaCopia()).length > 0);
    const senzaInvio = collegaOriginale.replace("sock.sendMessage(jid, { text: testo })", "Promise.resolve({})");
    writeFileSync(join(copia, "collega.mjs"), senzaInvio);
    writeFileSync(join(copia, "invio.mjs"), readFileSync(join(src, "invio.mjs"), "utf8"));
    c("negativa: nessuna sendMessage (la regola non è vuota) fa fallire la regola", true, violazioniUnSoloInvio(dellaCopia()).length > 0);
    //  Le immagini (T8): lista bianca del download. Il socket non c'entra: il download è una funzione di Baileys
    //  che riceve la sola copia {mediaKey, directPath} e l'host deciso da noi.
    c("immagini: download e rete solo come da lista bianca (nessun downloadMediaMessage, un solo downloadContentFromMessage in index.mjs, copia senza url, fetch solo verso il ponte e l'URL di carico)", [], violazioniImmagini(codice));
    {
      const originale = Object.fromEntries(file.map((f) => [f, readFileSync(join(src, f), "utf8")]));
      const prova = (nome, cambia, attesa = true) => {
        const m = { ...originale };
        cambia(m);
        const trovate = violazioniImmagini(Object.fromEntries(Object.entries(m).map(([f, t]) => [f, senzaCommenti(t)])));
        c(`negativa (immagini): ${nome}`, attesa, trovate.length > 0);
      };
      c("la copia intatta passa la regola delle immagini (le prove negative partono da qui)", [], violazioniImmagini(Object.fromEntries(Object.entries(originale).map(([f, t]) => [f, senzaCommenti(t)]))));
      for (const nome of ["downloadMediaMessage", "updateMediaMessage", "reuploadRequest", "requestPlaceholderResend"]) prova(`${nome} in collega.mjs`, (m) => (m["collega.mjs"] += `\nconst x = ${nome};\n`));
      prova("una seconda downloadContentFromMessage in immagini.mjs", (m) => (m["immagini.mjs"] += "\nconst y = downloadContentFromMessage;\n"));
      prova("index.mjs non passa più downloadContentFromMessage", (m) => (m["index.mjs"] = m["index.mjs"].replace("scarica: baileys.downloadContentFromMessage", "scarica: undefined")));
      prova("la copia per Baileys porta anche l'url", (m) => (m["immagini.mjs"] = m["immagini.mjs"].replace("directPath: lavoro.directPath };", "directPath: lavoro.directPath, url: lavoro.url };")));
      prova("download senza l'host fissato", (m) => (m["immagini.mjs"] = m["immagini.mjs"].replace('"image", { host: lavoro.host }', '"image"')));
      prova("download con un tipo diverso da «image»", (m) => (m["immagini.mjs"] = m["immagini.mjs"].replace('"image", { host: lavoro.host }', '"video", { host: lavoro.host }')));
      prova("accoda mette in coda prima di validare", (m) => (m["immagini.mjs"] = m["immagini.mjs"].replace("const origine = validaOrigine(immagine);", "const origine = { ok: true };")));
      prova("un fetch verso un indirizzo qualunque in immagini.mjs", (m) => (m["immagini.mjs"] += "\nconst z = fetch(indirizzo);\n"));
      prova("un fetch in collega.mjs", (m) => (m["collega.mjs"] += "\nconst w = fetch(url);\n"));
      prova("l'URL di carico non validato", (m) => (m["immagini.mjs"] = m["immagini.mjs"].replace("urlCaricoValido(risposta.url_carico)", "risposta.url_carico")));
      prova("un modulo di rete di Node", (m) => (m["immagini.mjs"] = `import { request } from "node:https";\n${m["immagini.mjs"]}`));
    }
    //  Lista bianca: sul socket si chiamano SOLO questi (tutto il resto è vietato).
    //  `ws.on` (guasto 2): solo per ASCOLTARE i nodi `message` ricevuti, e
    //  contare quelli senza contenuto (`hosted_unavailable_fanout`). Ascoltare
    //  non manda niente: `ws.send`, `ws.emit` e il resto restano vietati.
    const ammesse = new Set(["ev.on", "ws.on", "end", "signalRepository.lidMapping.getPNForLID", "sendMessage"]);
    const chiamate = file.flatMap((f) => [...codice[f].matchAll(/\bsock\??\.([\w?.]+)\s*\(/g)].map((m) => m[1].replace(/\?/g, "")));
    c("sul socket si chiamano solo ev.on, ws.on, end, getPNForLID e l'unico sendMessage", [], chiamate.filter((x) => !ammesse.has(x)));
    c("il socket si usa davvero (la guardia non è vuota)", true, chiamate.includes("ev.on") && chiamate.includes("ws.on") && chiamate.includes("signalRepository.lidMapping.getPNForLID") && chiamate.filter((x) => x === "sendMessage").length === 1);
    c("ws.on solo per CB:message (nessun altro nodo, nessun frame)", [], [...Object.values(codice).join("\n").matchAll(/\bsock\??\.ws\??\.on\(\s*([^,]*),/g)].map((m) => m[1]).filter((x) => x !== '"CB:message"'));
    c("sul websocket niente send, emit, write, close", [], file.filter((f) => /\bws\??\.(send|sendNode|emit|write|close|end)\b/.test(codice[f])));
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
    c("percorsi: tutti sotto la cartella di stato, tranne il log", { base: casa, app: `${casa}/app`, auth: `${casa}/auth`, fila: `${casa}/fila`, invii: `${casa}/invii`, immagini: `${casa}/immagini`, config: `${casa}/config.env`, stato: `${casa}/stato.json`, lid: `${casa}/lid.json`, qr: `${casa}/qr.png`, cache: `${casa}/cache`, chiaveCache: `${casa}/chiave-cache`, log: "/Users/finto/Library/Logs/hgl-ponte-wa.log" }, p);
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
    const log8 = [];
    const qrFinto = { mostra: async (t) => void mostrati.push(t), togli: () => void mostrati.push("tolto"), notifica: async (k) => void notifiche.push(k) };
    const col = K.creaCollegamento({
      baileys,
      percorsi: P,
      fila,
      qr: qrFinto,
      registro: (codice, conteggi) => void log8.push([codice, conteggi]),
      orologio: () => T0,
      casuale: () => 0.5,
      pianifica: (f, ms) => timer.push({ f, ms }),
      annulla: () => {},
      avvisa: () => avvisi.push(col.istantanea().stato),
    });
    await col.avvia();
    const s1 = socket[0];
    c("socket: opzioni del §a3", { browser: ["Mac OS", "Chrome", "14.4.1"], syncFullHistory: true, markOnlineOnConnect: false, logger: K.LOGGER_MUTO, auth: { cartella: P.auth } }, { browser: s1.opzioni.browser, syncFullHistory: s1.opzioni.syncFullHistory, markOnlineOnConnect: s1.opzioni.markOnlineOnConnect, logger: s1.opzioni.logger, auth: s1.opzioni.auth });
    //  TUTTE LE CHAT (30/10): il default di Baileys scarta la sincronizzazione FULL (`syncType !== FULL`);
    //  il ponte accetta ogni tipo di storico che il telefono manda al nuovo abbinamento.
    c("socket: shouldSyncHistoryMessage accetta FULL, RECENT, INITIAL_BOOTSTRAP e ogni altro tipo", [true, true, true, true, "function"], [
      s1.opzioni.shouldSyncHistoryMessage?.({ syncType: 2 }),
      s1.opzioni.shouldSyncHistoryMessage?.({ syncType: 3 }),
      s1.opzioni.shouldSyncHistoryMessage?.({ syncType: 0 }),
      s1.opzioni.shouldSyncHistoryMessage?.({}),
      typeof s1.opzioni.shouldSyncHistoryMessage,
    ]);
    //  T1 (30/10, ponte-storico-completo): l'identità arriva da config.env; di serie Chrome, come oggi.
    {
      const stato8b = join(base, "stato8b");
      mkdirSync(stato8b, { mode: 0o700 });
      const f = baileysFinto();
      const colD = K.creaCollegamento({
        baileys: f.baileys,
        percorsi: { auth: join(stato8b, "auth"), lid: join(stato8b, "lid.json") },
        fila: L.creaFila({ cartella: join(stato8b, "fila"), orologio: () => T0 }),
        qr: qrFinto,
        identita: "Desktop",
        registro: () => {},
        orologio: () => T0,
        casuale: () => 0.5,
        pianifica: () => {},
        annulla: () => {},
      });
      await colD.avvia();
      c("socket: con identita Desktop il browser è Mac OS Desktop", ["Mac OS", "Desktop"], f.socket[0].opzioni.browser.slice(0, 2));
      c("socket: le chiavi delle opzioni restano quelle di prima (nessuna in più)", ["auth", "browser", "getMessage", "logger", "markOnlineOnConnect", "shouldSyncHistoryMessage", "syncFullHistory"], Object.keys(f.socket[0].opzioni).sort());
    }
    c("socket: getMessage rende solo i messaggi inviati da noi (id sconosciuto → undefined)", undefined, await s1.opzioni.getMessage({ id: "X" }));
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
      syncType: 2,
    });
    const lotti8 = readdirSync(join(stato8, "fila/storico")).map((f) => JSON.parse(readFileSync(join(stato8, "fila/storico", f), "utf8")).lotto);
    c("storico → in fila/storico i tre messaggi con numero", [["S1", C1], ["S2", C2], ["S3", C3]], lotti8.flatMap((l) => l.messaggi.map((m) => [m.id, m.numero])));
    c("storico → i nomi dei contatti viaggiano col lotto", "Cliente Uno", lotti8[0].nomi[C1]);
    c("log storico: solo letti, validi e tipo (syncType, un numero); mai altro", [["storico", { letti: 6, validi: 3, tipo: 2 }]], log8.filter(([k]) => k === "storico"));
    c("log storico: nessun testo, numero di telefono o nome", false, /Cliente|ciao|\d{9,}/.test(JSON.stringify(log8.filter(([k]) => k === "storico"))));
    //  un syncType che non è un numero non entra nel log
    await s1.emetti("messaging-history.set", { messages: [], syncType: "2; messaggio di prova", progress: 40 });
    c("log storico: un syncType non numerico non viene scritto", { letti: 0, validi: 0 }, log8.filter(([k]) => k === "storico").at(-1)[1]);
    c("storico → avanzamento dal progress", { fatto: false, avanzamento: 40 }, col.istantanea().storico);
    c("estrazione: letti e validi", { letti: 6, validi: 3 }, Object.fromEntries(["letti", "validi"].map((k) => [k, col.istantanea().estrazione[k]])));
    c("diagnosi: scarti per motivo, solo numeri", { senza_numero: 1, gruppo: 1, se_stesso: 1 }, col.istantanea().diagnosi.scarti);
    c("lid.json: mappa dello storico e di getPNForLID, permessi 600", [{ 555: C2, 777: C3 }, 0o600], [JSON.parse(readFileSync(P.lid, "utf8")), permessi(P.lid)]);
    c("ultimo_messaggio_il = l'orario vero dell'ultimo messaggio", new Date(TS * 1000).toISOString(), col.istantanea().ultimo_messaggio_il);

    await s1.emetti("messaging-history.status", { syncType: 2, status: "complete" });
    c("storico completo → fatto, 100", { fatto: true, avanzamento: 100 }, col.istantanea().storico);

    await s1.emetti("messages.upsert", { type: "notify", messages: [wa(`${C4}@s.whatsapp.net`, "V1", "vivo")] });
    await s1.emetti("messages.upsert", { type: "append", messages: [wa(`${C4}@s.whatsapp.net`, "V2", "vivo dal telefono", { fromMe: true })] });
    const vivi = readdirSync(join(stato8, "fila/vivo")).map((f) => JSON.parse(readFileSync(join(stato8, "fila/vivo", f), "utf8")));
    c("diagnosi: tipi di Baileys per direzione (storico e vivi)", { in_conversation: 7, out_conversation: 1 }, col.istantanea().diagnosi.tipi);

    c("messages.upsert (notify e append) → fila/vivo, pronti dopo 30 s", [["V1", "in"], ["V2", "out"], [T0 + 30_000]], [...vivi.flatMap((v) => v.lotto.messaggi.map((m) => [m.id, m.dir])), [...new Set(vivi.map((v) => v.prossimo_il))]]);

    //  I nodi grezzi: si contano quelli senza contenuto, per tipo.
    const nodoMsg = (id, figli, attrs = {}) => ({ tag: "message", attrs: { id, from: `${NOI}:99@s.whatsapp.net`, recipient: `${C4}@s.whatsapp.net`, t: String(TS), ...attrs }, content: figli });
    const ospitato = [{ tag: "unavailable", attrs: { type: "hosted_unavailable_fanout" } }];
    await s1.emettiNodo(nodoMsg("H1", ospitato));
    await s1.emettiNodo(nodoMsg("H2", [{ tag: "unavailable", attrs: { type: "view_once_unavailable_fanout" } }]));
    await s1.emettiNodo(nodoMsg("N1", [{ tag: "enc", attrs: { type: "msg" } }]));
    let nodoRotto = "nessun errore";
    try {
      await s1.emettiNodo(null);
      await s1.emettiNodo({ tag: "message", get attrs() { throw new Error("nodo rotto"); }, content: ospitato });
    } catch {
      nodoRotto = "errore uscito";
    }
    c("un nodo rotto non fa cadere Baileys (nessun errore esce dall'ascolto)", "nessun errore", nodoRotto);
    c("diagnosi: nodi senza contenuto contati per tipo", { hosted_unavailable_fanout: 2, view_once_unavailable_fanout: 1 }, col.istantanea().diagnosi.nodi);
    const nascosti = readdirSync(join(stato8, "fila/vivo"))
      .map((f) => JSON.parse(readFileSync(join(stato8, "fila/vivo", f), "utf8")).lotto.messaggi)
      .flat()
      .filter((m) => m.id === "H1");
    c("il nodo ospitato uscito da noi va in fila/vivo col segnaposto", [{ id: "H1", numero: C4, dir: "out", ts: TS, testo: "📋 Messaggio inviato da ManyChat (testo non visibile)", tipo: "altro", stato: "sent" }], nascosti);
    c("estrazione: invii nascosti registrati, contati come letti e validi", [1, 9, 6], [col.istantanea().estrazione.invii_nascosti, col.istantanea().estrazione.letti, col.istantanea().estrazione.validi]);
    c("diagnosi: l'invio nascosto contato come tipo out_invio_nascosto", 1, col.istantanea().diagnosi.tipi.out_invio_nascosto);
    c("l'ascolto dei nodi è uno solo per socket", 1, s1.nodiAscoltati());
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
    c("gli eventi del socket vecchio si ignorano", 3, readdirSync(join(stato8, "fila/vivo")).length);
    await s1.emettiNodo(nodoMsg("H9", ospitato));
    c("i nodi del socket vecchio non si contano", 2, col.istantanea().diagnosi.nodi.hosted_unavailable_fanout);

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
    const ist = {
      stato: "collegato",
      collegato_dal: "2026-10-29T11:00:00.000Z",
      ultimo_messaggio_il: null,
      storico: { fatto: true, avanzamento: 100 },
      estrazione: { letti: 10, validi: 8, invii_nascosti: 2, non_decifrati: 1 },
      diagnosi: { scarti: { gruppo: 1, tipo_sconosciuto: 1 }, tipi: { in_conversation: 9, out_placeholder_message: 1 }, nodi: { hosted_unavailable_fanout: 3 } },
    };
    const filaC = { in_coda: 4, lotti_storico: 1, lotti_vivo: 1, scartati: 2, non_noti_scaduti: 0, divisi: 0, piena: false };
    const b = I.corpoBattito(ist, filaC, {});
    c("battito: la forma di BattitoPonte (più diagnosi, che il CRM ignora)", ["v", "tipo", "stato", "collegato_dal", "ultimo_messaggio_il", "storico", "in_coda", "scartati", "contatori", "versione", "diagnosi"], Object.keys(b));
    c("battito: nei contatori i nodi ospitati, quelli registrati e i segnaposto non decifrati", { fanout_ospitati: 3, fanout_registrati: 2, non_decifrati: 1 }, { fanout_ospitati: b.contatori.fanout_ospitati, fanout_registrati: b.contatori.fanout_registrati, non_decifrati: b.contatori.non_decifrati });
    c("battito: diagnosi intera (scarti, tipi, nodi)", ist.diagnosi, b.diagnosi);
    c("battito: la diagnosi tiene solo numeri e chiavi [a-z_]", { scarti: { gruppo: 1 }, tipi: {}, nodi: {} }, I.corpoBattito({ ...ist, diagnosi: { scarti: { gruppo: 1, "Brutta Chiave": 2, testo: "x" }, tipi: null } }, filaC, {}).diagnosi);
    const conti = I.contiDiagnosi(b.diagnosi);
    c("log della diagnosi: chiavi con prefisso, solo numeri", { scarto_gruppo: 1, scarto_tipo_sconosciuto: 1, tipo_in_conversation: 9, tipo_out_placeholder_message: 1, nodo_hosted_unavailable_fanout: 3 }, conti);
    c("il CRM tiene tutti i contatori del battito (al più 22 con in_coda e scartati)", true, Object.keys(b.contatori).length + 2 <= 22);
    c("battito: v 1, tipo battito, versione di Baileys", [1, "battito", I.VERSIONE_BAILEYS], [b.v, b.tipo, b.versione]);
    c("battito: contatori solo numeri, chiavi minuscole, al più 20 (+ in_coda e scartati)", [true, true], [Object.entries(b.contatori).every(([k, v]) => /^[a-z_]+$/.test(k) && Number.isFinite(v)), Object.keys(b.contatori).length <= 20]);
    const bc = I.corpoBattito(ist, filaC, { cache: { numeri: 3, promossi: 7, errori: 2 } });
    c("battito: i numeri della cache (numeri, messaggi passati al CRM, scritture fallite)", { cache_numeri: 3, cache_promossi: 7, cache_errori: 2 }, { cache_numeri: bc.contatori.cache_numeri, cache_promossi: bc.contatori.cache_promossi, cache_errori: bc.contatori.cache_errori });
    c("battito: con la cache i contatori restano al più 20", true, Object.keys(bc.contatori).length <= 20);
    c("battito: senza cache i suoi contatori valgono 0", [0, 0, 0], [b.contatori.cache_numeri, b.contatori.cache_promossi, b.contatori.cache_errori]);
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
