/** ── PROVE: MEETLY SFU · IL CLIENT (T3, 31/10/2026) ───────────────────────────
 *  Commessa 2026-10-31-meetly-connessione, Parte B. Il client vero
 *  (src/shop/meetly-sfu.ts) girato in Node con un pc finto, un server finto
 *  (`chiama`) e un orologio finto: nessuna rete, nessun browser, nessun segreto.
 *  Dati inventati: nessun cliente vero.
 *
 *  ── PERCHÉ C'È UN THREAD A PARTE ─────────────────────────────────────────
 *  Il client è asincrono (promesse, timer) e prove.mjs chiama questa funzione
 *  senza `await`: se le prove ne restassero fuori, i controlli arriverebbero
 *  DOPO il riepilogo e `process.exit` li butterebbe via senza dire niente
 *  (verdi per assenza). Perciò gli scenari girano in un Worker (questo stesso
 *  file) e il thread principale aspetta con `Atomics.wait`, poi riporta ogni
 *  controllo con `c()`. Con un `await` davanti alla chiamata in prove.mjs
 *  funzionerebbe lo stesso. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, workerData, MessageChannel, receiveMessageOnPort } from "node:worker_threads";

/* ══════════════════════════════════════════════════════════════════════════
   THREAD PRINCIPALE: controlli sul sorgente + ponte verso il worker
   ══════════════════════════════════════════════════════════════════════════ */

export function proveMeetlySfuClient(mod, { c, gruppo, radice }) {
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  gruppo("MEETLY SFU · IL CLIENT · SORGENTE");
  const src = senzaCommenti(leggi("src/shop/meetly-sfu.ts"));
  c("il modulo esporta creaTrasportoSfu", "function", typeof mod["shop/meetly-sfu"]?.creaTrasportoSfu);
  c("niente console.* (i log passano da deps.log)", false, /console\./.test(src));
  c("niente Math.random (nessuna chiave generata qui)", false, /Math\.random/.test(src));
  c("niente indirizzi locali né segreti nel sorgente", false, /localhost|127\.0\.0\.1|MEETLY_SFU|Authorization|Bearer/.test(src));
  c("importa solo le regole pure di T1", ["./meetly-sfu-regole"], [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).filter((p, i, a) => a.indexOf(p) === i));
  c("nessun accesso a window all'import: ogni uso sta in una funzione o dietro typeof", false, /^(window|document|navigator)\./m.test(src));
  c("il gancio __hgSfu esiste solo con import.meta.env?.DEV", true, /import\.meta\.env\?\.DEV\)[^;]*__hgSfu/.test(src.replace(/\s+/g, " ")));
  c("l'uscita avvisa il server con keepalive", true, /"esci"[^;]*keepalive:\s*true/.test(src.replace(/\s+/g, " ")));
  c("rotta e azioni: una sola URL, nessuna modalità di prova", true, /\/api\/public\/meetly-sfu/.test(src) && !/MEETLY_SFU_PROVA|x-meetly-prova/.test(src));
  c("copia (non import) di attendiCandidati e della chiamata: nessun import da webinar", false, /webinar/.test(src));

  gruppo("MEETLY SFU · IL CLIENT · SCENARI (in un thread a parte)");
  const { esiti, errore } = eseguiScenari(radice);
  if (errore) c("gli scenari sono arrivati in fondo", "ok", errore);
  for (const e of esiti) {
    if (e.g) gruppo(e.g);
    else c(e.n, e.a, e.l);
  }
}

function eseguiScenari(radice) {
  const sab = new SharedArrayBuffer(4);
  const flag = new Int32Array(sab);
  const { port1, port2 } = new MessageChannel();
  const w = new Worker(fileURLToPath(import.meta.url), { workerData: { scenariSfu: true, radice, sab, porta: port2 }, transferList: [port2] });
  w.on("error", () => {});
  const r = Atomics.wait(flag, 0, 0, 240_000);
  const msg = receiveMessageOnPort(port1)?.message;
  void w.terminate();
  if (r === "timed-out" || !msg) return { esiti: [], errore: "scadenza: il worker non ha risposto" };
  return msg;
}

/* ══════════════════════════════════════════════════════════════════════════
   WORKER: gli scenari
   ══════════════════════════════════════════════════════════════════════════ */

if (!isMainThread && workerData?.scenariSfu) {
  const { radice, sab, porta } = workerData;
  const flag = new Int32Array(sab);
  const esiti = [];
  let errore = null;
  try {
    await scenari(radice, esiti);
  } catch (e) {
    errore = String(e?.stack || e).slice(0, 400);
  }
  porta.postMessage({ esiti, errore });
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
}

async function scenari(radice, esiti) {
  const gruppo = (g) => esiti.push({ g });
  const c = (n, a, l) => esiti.push({ n, a: JSON.parse(JSON.stringify(a ?? null)), l: JSON.parse(JSON.stringify(l ?? null)) });
  const richiedi = createRequire(join(radice, "package.json"));
  const esbuild = richiedi("esbuild");
  const testo = esbuild.buildSync({
    entryPoints: [join(radice, "src/shop/meetly-sfu.ts")],
    bundle: true,
    format: "cjs",
    write: false,
    logLevel: "error",
  }).outputFiles[0].text;
  const m = { exports: {} };
  new Function("module", "exports", "require", testo)(m, m.exports, richiedi);
  const S = m.exports;

  const T0 = 1_800_000_000_000;
  const giro = () => new Promise((r) => setImmediate(r));

  /* ── L'AMBIENTE FINTO ──────────────────────────────────────────────── */
  let nTraccia = 0;
  const traccia = (kind, id) => ({ kind, id: id ?? `${kind}${++nTraccia}`, readyState: "live", enabled: true });

  class StreamFinto {
    constructor() { this.t = []; this.ops = []; }
    getTracks() { return [...this.t]; }
    getAudioTracks() { return this.t.filter((x) => x.kind === "audio"); }
    getVideoTracks() { return this.t.filter((x) => x.kind === "video"); }
    addTrack(x) { this.t.push(x); this.ops.push(`add:${x.id}`); }
    removeTrack(x) { this.t = this.t.filter((y) => y !== x); this.ops.push(`remove:${x.id}`); }
  }
  const media = ({ audio = true, video = true } = {}) => {
    const s = new StreamFinto();
    if (audio) s.t.push(traccia("audio"));
    if (video) s.t.push(traccia("video"));
    return s;
  };

  function creaAmbiente() {
    let ora = T0;
    let seq = 0;
    let timers = [];
    const orologio = {
      adesso: () => ora,
      dopo(ms, fn) { const t = { scade: ora + ms, fn, vivo: true, id: seq++ }; timers.push(t); return () => { t.vivo = false; }; },
      ogni(ms, fn) { const t = { scade: ora + ms, fn, vivo: true, ogni: ms, id: seq++ }; timers.push(t); return () => { t.vivo = false; }; },
    };
    const pulisci = async () => { for (let i = 0; i < 6; i++) await giro(); };
    const amb = {
      orologio, pulisci,
      chiamate: [], eventi: [], pcCreati: [], righe: [],
      sovrapposizioni: 0, inRinegoziazione: false,
      autoconnetti: { pub: "connected", sub: "connected" },
      raccolta: "subito",
      muti: new Set(),
      offertaPendente: [],
      rispondi: null,
      contaPubblica: new Map(),
      nSub: 0,
      nMid: 0,
    };
    amb.avanza = async (ms) => {
      const fine = ora + ms;
      await pulisci();
      for (;;) {
        timers = timers.filter((t) => t.vivo);
        const t = timers.filter((x) => x.scade <= fine).sort((a, b) => a.scade - b.scade || a.id - b.id)[0];
        if (!t) break;
        ora = Math.max(ora, t.scade);
        if (t.ogni) t.scade += t.ogni; else t.vivo = false;
        t.fn();
        await pulisci();
      }
      ora = fine;
      await pulisci();
    };
    amb.creaPc = (quale) => {
      const pc = new PcFinto(amb, quale);
      amb.pcCreati.push(pc);
      return pc;
    };
    amb.pc = (quale) => amb.pcCreati.filter((p) => p.quale === quale);
    amb.chiama = async (azione, corpo, opz) => {
      amb.chiamate.push({ azione, corpo: JSON.parse(JSON.stringify(corpo)), opz, t: ora });
      amb.eventi.push(`chiama.${azione}`);
      await giro();
      if (amb.rispondi) {
        const ov = await amb.rispondi(azione, corpo, amb.chiamate.filter((x) => x.azione === azione).length);
        if (ov !== undefined) return ov;
      }
      if (azione === "pubblica") {
        const n = (amb.contaPubblica.get(corpo.pid) ?? 0) + 1;
        amb.contaPubblica.set(corpo.pid, n);
        return {
          ok: true, status: 200, sessionId: `S-${corpo.pid}-${n}`, chiave: `K-${corpo.pid}-${n}`, answerSdp: "v=0 risposta-sfu",
          audio: corpo.midAudio !== "" ? `${corpo.pid}-a` : "", video: corpo.midVideo !== "" ? `${corpo.pid}-v` : "",
        };
      }
      if (azione === "abbonati") {
        if (amb.inRinegoziazione) amb.sovrapposizioni++;
        amb.inRinegoziazione = true;
        const tracce = corpo.tracce.map((t) => ({ mid: `m${++amb.nMid}`, trackName: t.trackName }));
        amb.offertaPendente = tracce;
        return { ok: true, status: 200, subSessionId: corpo.subSessionId || `SUB-${++amb.nSub}`, offerSdp: "v=0 offerta-sfu", serve: true, tracce };
      }
      if (azione === "rinegozia") { amb.inRinegoziazione = false; return { ok: true, status: 200 }; }
      return { ok: true, status: 200 };
    };
    return amb;
  }

  class PcFinto {
    constructor(amb, quale) {
      this.amb = amb; this.quale = quale;
      this.connectionState = "new";
      this.iceGatheringState = amb.raccolta === "subito" ? "complete" : "gathering";
      this.transceivers = [];
      this.asc = new Map();
      this.chiuso = false;
      this.localDescription = null;
    }
    addEventListener(t, f) { if (!this.asc.has(t)) this.asc.set(t, new Set()); this.asc.get(t).add(f); }
    removeEventListener(t, f) { this.asc.get(t)?.delete(f); }
    emetti(t, ev = {}) { for (const f of [...(this.asc.get(t) ?? [])]) f(ev); }
    stato(s) { if (this.chiuso || this.connectionState === s) return; this.connectionState = s; this.emetti("connectionstatechange"); }
    addTransceiver(track, init) {
      const sender = { track, async replaceTrack(t) { sender.track = t; } };
      const tr = { mid: null, kind: track.kind, direction: init.direction, sender, receiver: { track: null } };
      this.transceivers.push(tr);
      return tr;
    }
    getSenders() { return this.transceivers.map((t) => t.sender); }
    async createOffer() { return { type: "offer", sdp: "v=0 offerta-finta" }; }
    async createAnswer() { return { type: "answer", sdp: "v=0 risposta-finta" }; }
    async setLocalDescription(d) {
      this.amb.eventi.push(`${this.quale}.setLocal.${d.type}`);
      this.localDescription = d;
      if (this.quale === "pub") this.transceivers.forEach((t, i) => { if (t.mid === null) t.mid = String(i); });
    }
    async setRemoteDescription(d) {
      this.amb.eventi.push(`${this.quale}.setRemote.${d.type}`);
      if (d.type === "offer") {
        for (const n of this.amb.offertaPendente.splice(0)) {
          const kind = n.trackName.endsWith("-a") ? "audio" : "video";
          const t = traccia(kind, `r-${n.trackName}-${n.mid}`);
          const tr = { mid: n.mid, kind, direction: "recvonly", sender: { track: null }, receiver: { track: t } };
          this.transceivers.push(tr);
          //  ⚠️ Come nel browser: `track` scatta DENTRO setRemoteDescription.
          if (!this.amb.muti.has(n.trackName.slice(0, -2))) this.emetti("track", { track: t, transceiver: tr, receiver: tr.receiver, streams: [] });
        }
      }
      const modo = this.amb.autoconnetti[this.quale];
      if (modo) queueMicrotask(() => this.stato(modo));
    }
    close() { this.chiuso = true; this.connectionState = "closed"; }
    async getStats() {
      const r = new Map();
      const px = this.quale;
      r.set("cp", { id: "cp", type: "candidate-pair", bytesReceived: px === "pub" ? 500 : 700, bytesSent: 900, currentRoundTripTime: 0.04, localCandidateId: "lc", nominated: true });
      r.set("lc", { id: "lc", type: "local-candidate" });
      if (px === "pub") r.set("out", { id: "out", type: "outbound-rtp", bytesSent: 4000, transportId: "t" });
      else for (const t of this.transceivers) r.set(`in${t.mid}`, { id: `in${t.mid}`, type: "inbound-rtp", mid: t.mid, kind: t.kind, bytesReceived: 1000, transportId: "t" });
      return r;
    }
  }

  /* ── I PERSONAGGI ─────────────────────────────────────────────────── */
  const annuncioDi = (pid, n = 1, v = true) => ({ s: `S-${pid}-${n}`, a: `${pid}-a`, v: v ? `${pid}-v` : "" });

  /** Un trasporto con N peer già «entrati» come farebbe call.tsx. */
  async function avvio({ ruolo = "ospite", pid = "aaaa1111", altri = ["bbbb2222"], mioMedia = { audio: true, video: true }, annuncia = true, viva = true, dopoCreazione } = {}) {
    const amb = creaAmbiente();
    dopoCreazione?.(amb);
    const sfu = S.creaTrasportoSfu({
      ruolo, codice: "stanza-prova", pid,
      credenziali: () => ({ dev: "dev-1", segreto: "seg-1" }),
      creaPc: (_ice, quale) => amb.creaPc(quale),
      chiama: amb.chiama, ice: async () => [], orologio: amb.orologio,
      log: (r) => amb.righe.push(r), creaStream: () => new StreamFinto(),
    });
    const fall = [];
    sfu.onFallito((x) => fall.push(x));
    let nAnn = 0;
    sfu.onAnnuncio(() => nAnn++);
    const local = media(mioMedia);
    sfu.avvia(local);
    const peers = new Map();
    const peer = (id) => {
      const p = sfu.nuovoPeer(id);
      const o = { p, ricevute: [], cambi: [] };
      //  Come `makePeer` e `chiediRipresa` di call.tsx.
      p.ontrack = (e) => o.ricevute.push({ kind: e.track.kind, id: e.track.id, flusso: e.streams[0] });
      p.onconnectionstatechange = () => { o.cambi.push(p.connectionState); if (p.connectionState === "disconnected" || p.connectionState === "failed") sfu.riprova(id); };
      peers.set(id, o);
      return o;
    };
    for (const id of altri) peer(id);
    sfu.sincronizza();
    await amb.avanza(0);
    if (annuncia) for (const id of altri) sfu.suAnnuncio(id, annuncioDi(id));
    if (viva) for (const id of altri) sfu.viva(id);
    await amb.avanza(0);
    return { amb, sfu, fall, local, peers, peer, annunci: () => nAnn };
  }

  /** Il tempo che passa con i saluti ogni 3 s (come l'`hello` di un Worker). */
  async function passa(x, ms, chi) {
    const pids = chi ?? [...x.peers.keys()];
    for (let t = 0; t < ms; t += 3000) {
      for (const id of pids) x.sfu.viva(id);
      await x.amb.avanza(Math.min(3000, ms - t));
    }
  }
  const quante = (amb, azione) => amb.chiamate.filter((x) => x.azione === azione).length;
  const solo = (amb, nomi) => amb.eventi.filter((e) => nomi.includes(e));

  /* ══════════════════ 1. SEQUENZA DI PUBBLICAZIONE E ABBONAMENTO ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · SEQUENZA ESATTA");
  {
    const amb = creaAmbiente();
    const sfu = S.creaTrasportoSfu({ ruolo: "ospite", codice: "stanza-prova", pid: "aaaa1111", credenziali: () => ({ dev: "dev-1", segreto: "seg-1" }), creaPc: (_i, q) => amb.creaPc(q), chiama: amb.chiama, ice: async () => [], orologio: amb.orologio, log: () => {}, creaStream: () => new StreamFinto() });
    let nAnn = 0;
    sfu.onAnnuncio(() => nAnn++);
    const local = media();
    sfu.avvia(local);
    await amb.avanza(0);
    c("da soli non si pubblica (serve almeno un altro)", 0, amb.chiamate.length);
    sfu.nuovoPeer("bbbb2222");
    sfu.sincronizza();
    await amb.avanza(0);
    c("col primo altro si pubblica, una volta", 1, quante(amb, "pubblica"));
    sfu.sincronizza(); sfu.sincronizza();
    await amb.avanza(0);
    c("sincronizza ripetuto non ripubblica", 1, quante(amb, "pubblica"));
    const cp = amb.chiamate[0];
    c("pubblica porta codice, pid, dev e segreto della scheda", ["stanza-prova", "aaaa1111", "dev-1", "seg-1"], [cp.corpo.codice, cp.corpo.pid, cp.corpo.dev, cp.corpo.segreto]);
    c("…e i mid dell'SDP: audio 0, video 1", ["0", "1"], [cp.corpo.midAudio, cp.corpo.midVideo]);
    c("…l'offerta è NOSTRA (SDP pieno) e la prima volta non c'è chiave", [true, false], [cp.corpo.offerSdp.length > 0, "chiave" in cp.corpo]);
    c("ordine del pub: offerta locale → server → risposta remota", ["pub.setLocal.offer", "chiama.pubblica", "pub.setRemote.answer"], solo(amb, ["pub.setLocal.offer", "chiama.pubblica", "pub.setRemote.answer"]));
    c("l'annuncio è quello del server", { s: "S-aaaa1111-1", a: "aaaa1111-a", v: "aaaa1111-v" }, sfu.annuncio());
    c("onAnnuncio avvisa una volta", 1, nAnn);
    const pc = amb.pc("pub")[0];
    c("la traccia sul sender è LO STESSO OGGETTO di localStream (il mute arriva)", [true, true], [pc.transceivers[0].sender.track === local.getAudioTracks()[0], pc.transceivers[1].sender.track === local.getVideoTracks()[0]]);
    c("transceiver sendonly", ["sendonly", "sendonly"], pc.transceivers.map((t) => t.direction));

    amb.eventi.length = 0;
    sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222"));
    await amb.avanza(0);
    c("abbonarsi: offerta DELL'SFU → risposta nostra → rinegozia (dopo setLocal)", ["chiama.abbonati", "sub.setRemote.offer", "sub.setLocal.answer", "chiama.rinegozia"], amb.eventi);
    const ab = amb.chiamate.find((x) => x.azione === "abbonati").corpo;
    c("abbonati porta la chiave avuta e le due tracce di quella sessione", ["K-aaaa1111-1", [{ sessionId: "S-bbbb2222-1", trackName: "bbbb2222-a" }, { sessionId: "S-bbbb2222-1", trackName: "bbbb2222-v" }]], [ab.chiave, ab.tracce]);
    c("…la prima volta senza subSessionId", false, "subSessionId" in ab);
    const rn = amb.chiamate.find((x) => x.azione === "rinegozia").corpo;
    c("rinegozia porta sessione sub, chiave e la NOSTRA risposta", ["SUB-1", "K-aaaa1111-1", "v=0 risposta-finta"], [rn.subSessionId, rn.chiave, rn.answerSdp]);
    c("un solo pc pub e un solo pc sub", [1, 1], [amb.pc("pub").length, amb.pc("sub").length]);
    c("il pc pub non fa mai l'answer e il sub mai l'offer", [false, false], [amb.eventi.includes("pub.setLocal.answer"), amb.eventi.includes("sub.setLocal.offer")]);
  }

  gruppo("MEETLY SFU · CLIENT · NIENTE TRASCEIVER SENZA TRACCIA, CANDIDATI SENZA TRICKLE");
  {
    const x = await avvio({ mioMedia: { audio: true, video: false }, annuncia: false, viva: false });
    const pc = x.amb.pc("pub")[0];
    c("solo audio: UN transceiver, nessuno nato vuoto per il video", 1, pc.transceivers.length);
    c("…e il video non è nel corpo né nell'annuncio", ["", ""], [x.amb.chiamate[0].corpo.midVideo, x.sfu.annuncio().v]);
    const y = await avvio({ altri: [], dopoCreazione: (a) => { a.raccolta = "lenta"; } });
    y.sfu.nuovoPeer("bbbb2222"); y.sfu.sincronizza();
    await y.amb.avanza(3900);
    c("candidati che non finiscono: a 3,9 s non è ancora partito niente", 0, quante(y.amb, "pubblica"));
    await y.amb.avanza(300);
    c("…a 4 s si parte con quelli che ci sono (niente trickle)", 1, quante(y.amb, "pubblica"));
    const z = await avvio({ altri: [], mioMedia: { audio: false, video: false } });
    z.sfu.nuovoPeer("bbbb2222"); z.sfu.sincronizza();
    await z.amb.avanza(0);
    c("senza né audio né video non si pubblica (e non è un ripiego)", [0, []], [quante(z.amb, "pubblica"), z.fall]);
  }

  /* ══════════════════ 2. CODA DEL SUB ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · UNA CODA SOLA PER IL SUB");
  {
    const x = await avvio({ altri: ["bbbb2222", "cccc3333"], annuncia: false, viva: false });
    x.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222"));
    x.sfu.suAnnuncio("cccc3333", annuncioDi("cccc3333"));
    await x.amb.avanza(0);
    c("due annunci ravvicinati: due rinegoziazioni IN FILA", ["chiama.abbonati", "chiama.rinegozia", "chiama.abbonati", "chiama.rinegozia"], solo(x.amb, ["chiama.abbonati", "chiama.rinegozia"]));
    c("mai sovrapposte", 0, x.amb.sovrapposizioni);
    c("sullo stesso pc sub, con la sessione già avuta", [1, "SUB-1"], [x.amb.pc("sub").length, x.amb.chiamate.filter((a) => a.azione === "abbonati")[1].corpo.subSessionId]);
    //  tre annunci uno dopo l'altro, con un server lento
    const y = await avvio({ altri: ["bbbb2222", "cccc3333", "dddd4444"], annuncia: false, viva: false });
    for (const id of ["bbbb2222", "cccc3333", "dddd4444"]) y.sfu.suAnnuncio(id, annuncioDi(id));
    await y.amb.avanza(0);
    c("tre annunci: sei chiamate, a coppie, zero sovrapposizioni", [6, 0], [solo(y.amb, ["chiama.abbonati", "chiama.rinegozia"]).length, y.amb.sovrapposizioni]);
  }

  /* ══════════════════ 3-4. MID→PID E STREAM ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · MAPPA mid→pid PRIMA DELLA setRemoteDescription, UNO STREAM PER pid");
  {
    const x = await avvio();
    const b = x.peers.get("bbbb2222");
    c("le due tracce arrivano a ontrack (il finto le lancia DENTRO setRemoteDescription)", ["audio", "video"], b.ricevute.map((r) => r.kind));
    c("audio e video dello stesso pid nello STESSO stream", true, b.ricevute[0].flusso === b.ricevute[1].flusso);
    const flusso = b.ricevute[0].flusso;
    c("…con una traccia per tipo", [1, 1], [flusso.getAudioTracks().length, flusso.getVideoTracks().length]);
    const pcSub = x.amb.pc("sub")[0];
    pcSub.emetti("track", { track: traccia("video", "intruso"), transceiver: { mid: "m999" }, receiver: {}, streams: [] });
    c("una traccia con un mid che non conosciamo viene ignorata", 2, b.ricevute.length);
    //  ripubblica: nuova sessione dello stesso pid → la vecchia traccia video esce PRIMA
    const vecchiaVideo = flusso.getVideoTracks()[0].id;
    x.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222", 2));
    await x.amb.avanza(0);
    const nuovaVideo = flusso.getVideoTracks()[0].id;
    c("dopo la ripubblicazione resta UNA traccia video, la nuova", [1, true], [flusso.getVideoTracks().length, nuovaVideo !== vecchiaVideo]);
    const ops = flusso.ops;
    c("la vecchia si toglie PRIMA di aggiungere la nuova", true, ops.indexOf(`remove:${vecchiaVideo}`) >= 0 && ops.indexOf(`remove:${vecchiaVideo}`) < ops.indexOf(`add:${nuovaVideo}`));
    c("lo stream è sempre lo stesso oggetto", true, b.ricevute.every((r) => r.flusso === flusso));
    //  streams diversi per pid diversi
    const y = await avvio({ altri: ["bbbb2222", "cccc3333"] });
    c("pid diversi, stream diversi", false, y.peers.get("bbbb2222").ricevute[0].flusso === y.peers.get("cccc3333").ricevute[0].flusso);
    c("ogni peer riceve solo le SUE tracce", [2, 2], [y.peers.get("bbbb2222").ricevute.length, y.peers.get("cccc3333").ricevute.length]);
  }

  /* ══════════════════ 5. OSPITE PRIMA DEL CONSULENTE ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · L'OSPITE ARRIVATO PRIMA ASPETTA, NON RIPIEGA");
  for (const [nome, risp] of [
    ["409 non-dichiarato", { ok: false, status: 409, error: "non-dichiarato" }],
    ["409 stanza-piena", { ok: false, status: 409, error: "stanza-piena" }],
    ["429 limite", { ok: false, status: 429, error: "limite" }],
    ["403 non-ammesso (la sala non l'ha ancora detto al server)", { ok: false, status: 403, error: "non-ammesso" }],
  ]) {
    const x = await avvio({ altri: [], dopoCreazione: (a) => { a.rispondi = (az, _c, n) => (az === "pubblica" && n <= 3 ? risp : undefined); } });
    x.sfu.nuovoPeer("bbbb2222"); x.sfu.sincronizza();
    await x.amb.avanza(0);
    c(`${nome}: la prima volta non pubblica ma NON è un guasto`, [1, []], [quante(x.amb, "pubblica"), x.fall]);
    await x.amb.avanza(1400);
    c(`${nome}: a 1,4 s non ha ancora riprovato`, 1, quante(x.amb, "pubblica"));
    await x.amb.avanza(5000);
    c(`${nome}: dopo la dichiarazione pubblica, mai onFallito`, [4, []], [quante(x.amb, "pubblica"), x.fall]);
    c(`${nome}: l'annuncio c'è`, "S-aaaa1111-1", x.sfu.annuncio()?.s);
    c(`${nome}: i tentativi sono distanziati di 1,5 s`, [1500, 1500, 1500], x.amb.chiamate.slice(1).map((v, i) => v.t - x.amb.chiamate[i].t));
  }
  {
    const x = await avvio({ altri: [], dopoCreazione: (a) => { a.rispondi = (az) => (az === "pubblica" ? { ok: false, status: 409, error: "non-dichiarato" } : undefined); } });
    x.sfu.nuovoPeer("bbbb2222"); x.sfu.sincronizza();
    await x.amb.avanza(19_000);
    c("fino a ~20 s si continua ad aspettare", [[], true], [x.fall, quante(x.amb, "pubblica") >= 12]);
    await x.amb.avanza(3000);
    c("oltre ~20 s di «non ancora» si ripiega, una volta sola", ["server"], x.fall);
    await x.amb.avanza(10_000);
    c("…e poi si smette di insistere", ["server"], x.fall);
    const fine = quante(x.amb, "pubblica");
    await x.amb.avanza(10_000);
    c("…nessuna chiamata dopo il ripiego", fine, quante(x.amb, "pubblica"));
  }
  {
    //  anche l'abbonamento: un 409 non è un guasto
    const x = await avvio({ annuncia: false, viva: false, dopoCreazione: (a) => { a.rispondi = (az, _c, n) => (az === "abbonati" && n <= 2 ? { ok: false, status: 409, error: "stanza-piena" } : undefined); } });
    x.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222"));
    await x.amb.avanza(4000);
    c("abbonati con 409: riprova e alla fine si abbona, senza ripiego", [3, [], 2], [quante(x.amb, "abbonati"), x.fall, x.peers.get("bbbb2222").ricevute.length]);
  }

  /* ══════════════════ 6. VERI GUASTI → RIPIEGO ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · I GUASTI VERI PORTANO AL RIPIEGO");
  {
    const c1 = await avvio({ ruolo: "consulente", altri: [], dopoCreazione: (a) => { a.rispondi = (az) => (az === "pubblica" ? { ok: false, status: 502, error: "cloudflare" } : undefined); } });
    c1.sfu.nuovoPeer("bbbb2222"); c1.sfu.sincronizza();
    await c1.amb.avanza(3000);
    c("502 del consulente: onFallito('server'), un solo tentativo", [["server"], 1], [c1.fall, quante(c1.amb, "pubblica")]);
    const o1 = await avvio({ ruolo: "ospite", altri: [], dopoCreazione: (a) => { a.rispondi = (az) => (az === "pubblica" ? { ok: false, status: 500, error: "cloudflare" } : undefined); } });
    o1.sfu.nuovoPeer("bbbb2222"); o1.sfu.sincronizza();
    await o1.amb.avanza(5000);
    c("500 dell'ospite: DUE tentativi per rete, poi 'server'", [["server"], 2], [o1.fall, quante(o1.amb, "pubblica")]);
    const n1 = await avvio({ ruolo: "consulente", altri: [], dopoCreazione: (a) => { a.rispondi = (az) => (az === "pubblica" ? { ok: false, status: 503, error: "non-configurato" } : undefined); } });
    n1.sfu.nuovoPeer("bbbb2222"); n1.sfu.sincronizza();
    await n1.amb.avanza(3000);
    c("503 non-configurato: onFallito('non-configurato') subito", [["non-configurato"], 1], [n1.fall, quante(n1.amb, "pubblica")]);
    const t1 = await avvio({ ruolo: "consulente", altri: [], dopoCreazione: (a) => { a.autoconnetti.pub = null; } });
    t1.sfu.nuovoPeer("bbbb2222"); t1.sfu.sincronizza();
    await t1.amb.avanza(11_900);
    c("pub che non si collega: a 11,9 s ancora nessun ripiego", [], t1.fall);
    await t1.amb.avanza(300);
    c("…a 12 s dalla risposta: 'timeout-pub'", ["timeout-pub"], t1.fall);
    const m1 = await avvio({ ruolo: "consulente", altri: [], dopoCreazione: (a) => { a.rispondi = (az) => (az === "pubblica" ? new Promise(() => {}) : undefined); } });
    m1.sfu.nuovoPeer("bbbb2222"); m1.sfu.sincronizza();
    await m1.amb.avanza(7900);
    c("il server non risponde: a 7,9 s si aspetta ancora", [], m1.fall);
    await m1.amb.avanza(300);
    c("…a 8 s è un guasto: 'server'", ["server"], m1.fall);
    const s1 = await avvio({ ruolo: "consulente", altri: [], dopoCreazione: (a) => { a.rispondi = (az) => (az === "pubblica" ? { ok: true, status: 200, sessionId: "S-x", chiave: "K-x" } : undefined); } });
    s1.sfu.nuovoPeer("bbbb2222"); s1.sfu.sincronizza();
    await s1.amb.avanza(1000);
    c("risposta senza SDP: 'server'", ["server"], s1.fall);
    const e1 = await avvio({ altri: [], dopoCreazione: (a) => { a.rispondi = (az) => (az === "pubblica" ? { ok: false, status: 403, error: "escluso" } : undefined); } });
    e1.sfu.nuovoPeer("bbbb2222"); e1.sfu.sincronizza();
    await e1.amb.avanza(10_000);
    c("espulso (403 escluso): non insiste e non ripiega", [1, []], [quante(e1.amb, "pubblica"), e1.fall]);
    const p1 = await avvio({ pid: "ab", altri: [] });
    p1.sfu.nuovoPeer("bbbb2222"); p1.sfu.sincronizza();
    await p1.amb.avanza(1000);
    c("pid nostro fuori formato (troppo corto): 'server' e nessuna richiesta", [["server"], 0], [p1.fall, p1.amb.chiamate.length]);
    const u1 = await avvio({ ruolo: "consulente", annuncia: false, viva: false, dopoCreazione: (a) => { a.autoconnetti.sub = null; a.muti.add("bbbb2222"); } });
    u1.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222"));
    await u1.amb.avanza(14_900);
    c("abbonato ma niente tracce e sub mai collegato: a 14,9 s ancora nessun ripiego", [], u1.fall);
    await u1.amb.avanza(300);
    c("…a 15 s: 'timeout-sub'", ["timeout-sub"], u1.fall);
  }

  /* ══════════════════ 6b. LA MIA RIGA SUL SERVER È SPARITA ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · RIGA PERSA: SI RIPUBBLICA UNA VOLTA SENZA CHIAVE, POI SI RIPIEGA");
  for (const [nome, status, errore] of [
    ["403 chiave", 403, "chiave"],
    ["403 sessione", 403, "sessione"],
    ["403 traccia", 403, "traccia"],
    ["409 riga-mancante", 409, "riga-mancante"],
  ]) {
    const x = await avvio({ annuncia: false, viva: false, dopoCreazione: (a) => { a.rispondi = (az, _c, n) => (az === "abbonati" && n <= 1 ? { ok: false, status, error: errore } : undefined); } });
    x.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222"));
    await x.amb.avanza(4000);
    const pubs = x.amb.chiamate.filter((a) => a.azione === "pubblica");
    c(`${nome} su abbonati: ripubblica UNA volta, senza chiave, e NON ripiega`, [2, false, []], [pubs.length, "chiave" in (pubs[1]?.corpo ?? { chiave: 1 }), x.fall]);
    c(`${nome}: poi si abbona di nuovo con la chiave nuova e le tracce arrivano`, [2, "K-aaaa1111-2", 2], [quante(x.amb, "abbonati"), x.amb.chiamate.filter((a) => a.azione === "abbonati")[1]?.corpo.chiave, x.peers.get("bbbb2222").ricevute.length]);
    c(`${nome}: il sub vecchio è chiuso e ne nasce uno nuovo senza la vecchia sessione`, [2, true, false], [x.amb.pc("sub").length, x.amb.pc("sub")[0].chiuso, "subSessionId" in (x.amb.chiamate.filter((a) => a.azione === "abbonati")[1]?.corpo ?? {})]);
    const y = await avvio({ annuncia: false, viva: false, dopoCreazione: (a) => { a.rispondi = (az) => (az === "abbonati" ? { ok: false, status, error: errore } : undefined); } });
    y.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222"));
    await y.amb.avanza(10_000);
    c(`${nome} che si ripete: UNA sola ripubblicazione, poi il ripiego 'server'`, [2, ["server"]], [quante(y.amb, "pubblica"), y.fall]);
  }
  {
    //  un guasto vero dell'abbonamento resta un guasto: nessuna ripubblicazione
    const x = await avvio({ annuncia: false, viva: false, dopoCreazione: (a) => { a.rispondi = (az) => (az === "abbonati" ? { ok: false, status: 502, error: "cloudflare" } : undefined); } });
    x.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222"));
    await x.amb.avanza(4000);
    c("502 su abbonati: ripiego 'server' subito, nessuna ripubblicazione", [["server"], 1], [x.fall, quante(x.amb, "pubblica")]);
  }
  {
    //  'rinnova' trova la riga sparita: nuova 'pubblica' senza chiave, non un guasto
    const x = await avvio({ dopoCreazione: (a) => { a.rispondi = (az, _c, n) => (az === "rinnova" && n <= 1 ? { ok: false, status: 409, error: "riga-mancante" } : undefined); } });
    await passa(x, 130_000);
    const pubs = x.amb.chiamate.filter((a) => a.azione === "pubblica");
    c("rinnova 409 riga-mancante: una nuova pubblica SENZA chiave, nessun ripiego", [2, false, []], [pubs.length, "chiave" in (pubs[1]?.corpo ?? { chiave: 1 }), x.fall]);
    c("…e dopo la nuova pubblica il rinnovo riparte con la chiave nuova", true, x.amb.chiamate.filter((a) => a.azione === "rinnova").some((a) => a.corpo.chiave === "K-aaaa1111-2"));
    const y = await avvio({ dopoCreazione: (a) => { a.rispondi = (az) => (az === "rinnova" ? { ok: false, status: 409, error: "riga-mancante" } : undefined); } });
    await passa(y, 200_000);
    c("rinnova 409 che si ripete: UNA sola ripubblicazione (il rinnovo non è un guasto)", [2, []], [quante(y.amb, "pubblica"), y.fall]);
  }

  /* ══════════════════ 7. RICOSTRUZIONI ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · UN GUASTO DEL SUB CON TRE PEER = UNA RICOSTRUZIONE");
  {
    const x = await avvio({ altri: ["bbbb2222", "cccc3333", "dddd4444"] });
    c("prima del guasto: tutti e tre 'connected'", ["connected", "connected", "connected"], [...x.peers.values()].map((o) => o.p.connectionState));
    const sub0 = x.amb.pc("sub")[0];
    sub0.stato("failed");
    await x.amb.avanza(0);
    //  gcRoster chiama reoffer direttamente, riparaLeConnessioni giro su tutti: altre richieste
    x.sfu.riprova("bbbb2222"); x.sfu.riprova("cccc3333", true); x.sfu.riprova("dddd4444");
    await x.amb.avanza(0);
    c("i tre peer vedono 'failed' e chiedono la ripresa: UN sub nuovo", [2, 1], [x.amb.pc("sub").length, x.sfu.stato().ricostruzioni]);
    c("…il vecchio sub è chiuso e i tre pid sono riabbonati sul nuovo", [true, 6], [sub0.chiuso, quante(x.amb, "abbonati")]);
    c("nessun ripiego per una caduta sola", [], x.fall);
    await passa(x, 3000);
    c("a fine ripresa tornano tutti 'connected'", ["connected", "connected", "connected"], [...x.peers.values()].map((o) => o.p.connectionState));
    c("…e le tracce nuove sono arrivate a ontrack", [4, 4, 4], [...x.peers.values()].map((o) => o.ricevute.length));
    c("il pub non è stato toccato", [1, false], [x.amb.pc("pub").length, x.amb.pc("pub")[0].chiuso]);
  }
  {
    const x = await avvio({ altri: ["bbbb2222", "cccc3333", "dddd4444"] });
    x.amb.autoconnetti.sub = "failed";
    x.amb.pc("sub")[0].stato("failed");
    await x.amb.avanza(2000);
    c("guasto che PERSISTE: tre ricostruzioni, poi 'ice-fallita' (una volta)", [["ice-fallita"], 3, 4], [x.fall, x.sfu.stato().ricostruzioni, x.amb.pc("sub").length]);
    const prima = x.amb.pc("sub").length;
    await x.amb.avanza(30_000);
    c("dopo il ripiego non si ricostruisce più", prima, x.amb.pc("sub").length);
  }
  {
    //  tre cadute che si riprendono NON consumano il budget
    const x = await avvio({ altri: ["bbbb2222"] });
    for (let i = 0; i < 6; i++) {
      x.amb.pc("sub").at(-1).stato("failed");
      await passa(x, 2000);
    }
    c("sei cadute che si riprendono: sei ricostruzioni e nessun ripiego", [[], 6, 7], [x.fall, x.sfu.stato().ricostruzioni, x.amb.pc("sub").length]);
  }

  gruppo("MEETLY SFU · CLIENT · PID MUTO: SI RIABBONA LUI, MAI IL RIPIEGO");
  {
    const x = await avvio({ altri: ["bbbb2222", "cccc3333"], dopoCreazione: (a) => { a.muti.add("bbbb2222"); } });
    c("b è muto, c no", [0, 2], [x.peers.get("bbbb2222").ricevute.length, x.peers.get("cccc3333").ricevute.length]);
    c("…b non risulta 'connected' (le sue tracce non ci sono)", ["connecting", "connected"], [x.peers.get("bbbb2222").p.connectionState, x.peers.get("cccc3333").p.connectionState]);
    const subCreati = x.amb.pc("sub").length;
    await passa(x, 15_500);
    const perB = () => x.amb.chiamate.filter((a) => a.azione === "abbonati" && a.corpo.tracce[0].trackName.startsWith("bbbb")).length;
    c("a 15 s: riabbonato SOLO b (nessuna ricostruzione dei pc)", [true, subCreati, x.amb.pc("pub").length, []], [perB() >= 2, x.amb.pc("sub").length, x.amb.pc("pub").length, x.fall]);
    c("…c non è stato toccato", 1, x.amb.chiamate.filter((a) => a.azione === "abbonati" && a.corpo.tracce[0].trackName.startsWith("cccc")).length);
    await passa(x, 60_000);
    c("in un minuto non più di 2 riabbonamenti (più il primo)", true, x.amb.chiamate.filter((a) => a.azione === "abbonati" && a.corpo.tracce[0].trackName.startsWith("bbbb") && a.t <= T0 + 75_500).length <= 3);
    c("mai ripiego e mai ricostruzioni, per quanto muto", [[], 0], [x.fall, x.sfu.stato().ricostruzioni]);
    //  la richiesta diretta (gcRoster/reoffer → riprova) con pc sani
    const y = await avvio({ altri: ["bbbb2222"], dopoCreazione: (a) => { a.muti.add("bbbb2222"); } });
    await passa(y, 4000);
    const n0 = quante(y.amb, "abbonati");
    y.sfu.riprova("bbbb2222");
    await y.amb.avanza(0);
    c("riprova(pid) con pc sani e pid muto che saluta: riabbona", [n0 + 1, 1, []], [quante(y.amb, "abbonati"), y.amb.pc("sub").length, y.fall]);
  }
  {
    const x = await avvio({ altri: ["bbbb2222"], viva: false, dopoCreazione: (a) => { a.muti.add("bbbb2222"); } });
    x.sfu.viva("bbbb2222");
    await x.amb.avanza(20_000);
    x.sfu.riprova("bbbb2222");
    await x.amb.avanza(7000);
    c("pid che ha smesso di salutare e non manda niente: nessuna ricostruzione né riabbonamento", [1, 1, 1, []], [quante(x.amb, "abbonati"), x.amb.pc("sub").length, x.amb.pc("pub").length, x.fall]);
    c("…e per call.tsx dopo 25 s risulta 'failed' (se n'è andato)", "failed", x.peers.get("bbbb2222").p.connectionState);
  }

  /* ══════════════════ 8. RICOSTRUZIONE DURANTE LO SCHERMO ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · LA RICOSTRUZIONE RIPUBBLICA LA TRACCIA CORRENTE");
  {
    const x = await avvio();
    const camera = x.local.getVideoTracks()[0];
    const schermo = traccia("video", "schermo");
    await x.sfu.sostituisci("video", schermo);
    c("sostituisci mette la traccia sul sender del pub", true, x.amb.pc("pub")[0].transceivers[1].sender.track === schermo);
    x.amb.pc("pub")[0].stato("failed");
    await x.amb.avanza(0);
    const nuovo = x.amb.pc("pub")[1];
    c("caduta durante lo schermo: il pub nuovo pubblica lo SCHERMO, non la camera", [true, false], [nuovo.transceivers[1].sender.track === schermo, nuovo.transceivers[1].sender.track === camera]);
    c("…e il microfono è lo stesso di prima", true, nuovo.transceivers[0].sender.track === x.local.getAudioTracks()[0]);
    c("…la ripubblicazione porta la chiave del pid (è lo stesso)", "K-aaaa1111-1", x.amb.chiamate.filter((a) => a.azione === "pubblica")[1].corpo.chiave);
    c("…il vecchio pub è chiuso, l'annuncio è nuovo e si dice agli altri", [true, "S-aaaa1111-2", 2], [x.amb.pc("pub")[0].chiuso, x.sfu.annuncio().s, x.annunci()]);
    c("…il sub non si tocca", [1, []], [x.amb.pc("sub").length, x.fall]);
    const nera = traccia("video", "nera");
    await x.sfu.sostituisci("video", nera);
    x.amb.pc("pub")[1].stato("failed");
    await x.amb.avanza(0);
    c("caduta con camera nera: riparte la NERA", true, x.amb.pc("pub")[2].transceivers[1].sender.track === nera);
    //  stessa traccia dopo lo schermo → camera
    await x.sfu.sostituisci("video", camera);
    x.amb.pc("pub")[2].stato("failed");
    await x.amb.avanza(0);
    c("finito lo schermo e tornata la camera: dopo la caduta riparte la camera", true, x.amb.pc("pub")[3].transceivers[1].sender.track === camera);
    c("quattro pub, tutti collegati, nessun ripiego (nessuna era persistente)", [4, []], [x.amb.pc("pub").length, x.fall]);
  }
  {
    //  un pub che si riprende non consuma il budget; uno che persiste sì
    const x = await avvio();
    for (let i = 0; i < 5; i++) {
      x.amb.pc("pub").at(-1).stato("failed");
      await x.amb.avanza(0);
    }
    c("cinque cadute del pub che si riprendono: nessun ripiego", [[], 6], [x.fall, x.amb.pc("pub").length]);
    x.amb.autoconnetti.pub = "failed";
    x.amb.pc("pub").at(-1).stato("failed");
    await x.amb.avanza(2000);
    c("poi un pub che non si riprende: tre ricostruzioni e 'ice-fallita'", [["ice-fallita"], 9], [x.fall, x.amb.pc("pub").length]);
  }
  {
    //  la traccia cambia mentre si pubblica
    const x = await avvio({ altri: [], annuncia: false, viva: false });
    x.sfu.nuovoPeer("bbbb2222"); x.sfu.sincronizza();
    const schermo = traccia("video", "schermo2");
    await x.sfu.sostituisci("video", schermo);
    await x.amb.avanza(0);
    c("la sostituzione fatta mentre si negoziava finisce comunque sul sender", true, x.amb.pc("pub")[0].transceivers[1].sender.track === schermo);
  }

  /* ══════════════════ 9. CAMERA CONCESSA DOPO L'INGRESSO ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · UN TIPO CHE MANCAVA ARRIVA DOPO: SI RIPUBBLICA, SENZA BUDGET");
  {
    const x = await avvio({ mioMedia: { audio: true, video: false } });
    c("all'inizio solo audio, annuncio senza video", [1, ""], [x.amb.pc("pub")[0].transceivers.length, x.sfu.annuncio().v]);
    x.local.t.push(traccia("video", "camera-tardiva"));
    x.sfu.sincronizza();
    await x.amb.avanza(0);
    const nuovo = x.amb.pc("pub")[1];
    c("camera concessa dopo: nuovo pub con DUE transceiver, video della camera", [2, true], [nuovo.transceivers.length, nuovo.transceivers[1].sender.track.id === "camera-tardiva"]);
    c("…annuncio col video e avviso agli altri", ["aaaa1111-v", 2], [x.sfu.annuncio().v, x.annunci()]);
    c("…nessun ripiego", [], x.fall);
  }
  {
    //  ⚠️ Se la ripubblicazione per il tipo arrivato dopo NON si collega, non consuma il budget:
    //   restano tre ricostruzioni «vere» prima di 'ice-fallita' (1 iniziale + 1 del tipo + 3).
    const x = await avvio({ mioMedia: { audio: true, video: false } });
    x.amb.autoconnetti.pub = "failed";
    x.local.t.push(traccia("video", "camera-tardiva-2"));
    x.sfu.sincronizza();
    await x.amb.avanza(2000);
    c("tipo arrivato dopo e pub che non si collega: budget invariato, 'ice-fallita' alla terza persistente", [["ice-fallita"], 5], [x.fall, x.amb.pc("pub").length]);
  }
  {
    const x = await avvio({ mioMedia: { audio: true, video: false } });
    await x.sfu.sostituisci("video", traccia("video", "camera-da-sostituisci"));
    await x.amb.avanza(0);
    c("anche un sostituisci(video) su un tipo mancante ripubblica", [2, "camera-da-sostituisci"], [x.amb.pc("pub").length, x.amb.pc("pub")[1].transceivers[1].sender.track.id]);
    //  e ripetuti sincronizza non rifanno la ripubblicazione
    x.sfu.sincronizza(); x.sfu.sincronizza();
    await x.amb.avanza(0);
    c("sincronizza ripetuto non ripubblica ancora", 2, x.amb.pc("pub").length);
  }

  /* ══════════════════ 10. suAnnuncio ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · suAnnuncio IDEMPOTENTE, RESET IN close()");
  {
    const x = await avvio({ annuncia: false, viva: false });
    const a = annuncioDi("bbbb2222");
    x.sfu.suAnnuncio("bbbb2222", a);
    x.sfu.suAnnuncio("bbbb2222", { ...a });
    await x.amb.avanza(0);
    x.sfu.suAnnuncio("bbbb2222", { ...a });
    await x.amb.avanza(3000);
    x.sfu.suAnnuncio("bbbb2222", { ...a });
    await x.amb.avanza(0);
    c("lo stesso annuncio ripetuto (hello ogni 3 s): UN solo abbonamento", 1, quante(x.amb, "abbonati"));
    c("annunciati: 1", 1, x.sfu.stato().annunciati);
    x.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222", 2));
    await x.amb.avanza(0);
    c("sessione diversa dello stesso pid: nuovo abbonamento", 2, quante(x.amb, "abbonati"));
    //  close() poi lo stesso annuncio
    x.peers.get("bbbb2222").p.close();
    c("close(): annunciati torna a 0 (stato di annuncio azzerato)", 0, x.sfu.stato().annunciati);
    c("…e il peer risulta 'closed'", "closed", x.peers.get("bbbb2222").p.connectionState);
    x.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222", 2));
    await x.amb.avanza(0);
    c("dopo close() un hello con lo STESSO annuncio non abbona finché non c'è un peer", 2, quante(x.amb, "abbonati"));
    const nuovo = x.peer("bbbb2222");
    x.sfu.sincronizza();
    x.sfu.viva("bbbb2222");
    await x.amb.avanza(0);
    c("…col peer rinato riabbona (non resta 'connecting' fino al timeout)", [3, "connected", []], [quante(x.amb, "abbonati"), nuovo.p.connectionState, x.fall]);
    //  annunci sbagliati
    const n0 = quante(x.amb, "abbonati");
    x.sfu.suAnnuncio("cccc3333", { s: "S-c", a: "bbbb2222-a", v: "" });
    x.sfu.suAnnuncio("cccc3333", { s: "S-c", a: "cccc3333-x", v: "" });
    x.sfu.suAnnuncio("aaaa1111", annuncioDi("aaaa1111"));
    x.sfu.suAnnuncio("ZZ", annuncioDi("ZZ"));
    x.sfu.suAnnuncio("cccc3333", { s: "", a: "cccc3333-a", v: "" });
    x.sfu.suAnnuncio("cccc3333", { s: "S-c", a: "", v: "" });
    x.sfu.nuovoPeer("cccc3333");
    await x.amb.avanza(0);
    c("annunci con nomi fuori formato, di altri, propri o vuoti: ignorati", n0, quante(x.amb, "abbonati"));
    //  annuncio che arriva PRIMA del peer (hello: suAnnuncio poi maybeInitiate → nuovoPeer)
    const y = await avvio({ altri: [], annuncia: false, viva: false });
    y.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222"));
    await y.amb.avanza(0);
    c("annuncio prima del peer: si tiene e non si abbona ancora", [0, 1], [quante(y.amb, "abbonati"), y.sfu.stato().annunciati]);
    y.peer("bbbb2222"); y.sfu.sincronizza();
    await y.amb.avanza(0);
    c("…appena nasce il peer (sincronizza) si abbona", [1, 2], [quante(y.amb, "abbonati"), y.peers.get("bbbb2222").ricevute.length]);
  }

  /* ══════════════════ 11. M-LINE MORTE ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · OLTRE 12 M-LINE MORTE: RICOSTRUZIONE DOLCE DEL SUB");
  {
    const x = await avvio({ altri: ["bbbb2222"] });
    for (let i = 0; i < 6; i++) {
      const id = `p${i}aaaa`;
      const o = x.peer(id);
      x.sfu.sincronizza();
      x.sfu.suAnnuncio(id, annuncioDi(id));
      x.sfu.viva(id);
      await x.amb.avanza(0);
      o.p.close();
    }
    c("12 m-line morte: ancora nessuna ricostruzione", 1, x.amb.pc("sub").length);
    const id = "p6aaaa";
    const o = x.peer(id);
    x.sfu.sincronizza(); x.sfu.suAnnuncio(id, annuncioDi(id)); x.sfu.viva(id);
    await x.amb.avanza(0);
    o.p.close();
    await x.amb.avanza(0);
    c("la 13ª (14 morte): un sub nuovo, il vecchio chiuso", [2, true], [x.amb.pc("sub").length, x.amb.pc("sub")[0].chiuso]);
    c("…il pid ancora presente è riabbonato sul sub nuovo", true, x.amb.pc("sub")[1].transceivers.length === 2);
    c("…nessun ripiego, pub intatto", [[], 1], [x.fall, x.amb.pc("pub").length]);
    //  il budget è intatto: servono ancora tre guasti persistenti
    x.amb.autoconnetti.sub = "failed";
    x.amb.pc("sub").at(-1).stato("failed");
    await x.amb.avanza(2000);
    c("budget invariato: 'ice-fallita' dopo tre ricostruzioni persistenti (1 + 1 + 3 sub)", [["ice-fallita"], 5], [x.fall, x.amb.pc("sub").length]);
  }

  /* ══════════════════ 12. CAPOFILA ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · IL CAPOFILA");
  {
    const x = await avvio({ altri: ["bbbb2222", "cccc3333", "dddd4444"] });
    const pb = x.peers.get("bbbb2222").p, pcc = x.peers.get("cccc3333").p, pd = x.peers.get("dddd4444").p;
    const pubPc = x.amb.pc("pub")[0];
    c("capofila = pid minore: porta i DUE sender veri del pub", [2, true], [pb.getSenders().length, pb.getSenders().every((s) => pubPc.transceivers.some((t) => t.sender === s))]);
    c("gli altri: nessun sender (un solo video, un solo tetto)", [0, 0], [pcc.getSenders().length, pd.getSenders().length]);
    const sPrima = pb.getSenders();
    //  statistiche
    const tutte = async () => {
      let inbound = 0, pairRicevuti = 0, uscita = 0;
      for (const p of [pb, pcc, pd]) (await p.getStats()).forEach((v) => { if (v.type === "inbound-rtp") inbound += v.bytesReceived; if (v.type === "candidate-pair") pairRicevuti += v.bytesReceived; if (v.type === "outbound-rtp") uscita++; });
      return { inbound, pairRicevuti, uscita };
    };
    const s1 = await tutte();
    c("getStats: 3 pid × 2 tracce × 1000 byte, coppie a ZERO ricevuti, un solo outbound", { inbound: 6000, pairRicevuti: 0, uscita: 1 }, s1);
    const stB = await pb.getStats(), stC = await pcc.getStats();
    c("il capofila porta anche coppie e uscita, l'altro i soli inbound-rtp", [true, false], [[...stB.keys()].some((k) => k.startsWith("pub:")), [...stC.keys()].some((k) => k.startsWith("pub:"))]);
    c("id prefissati e localCandidateId riscritto", [true, true], [stB.has("pub:cp") && stB.has("sub:cp"), stB.get("pub:cp").localCandidateId === "pub:lc"]);
    c("gli inbound di C sono SOLO suoi (mid di C)", true, [...stC.values()].every((v) => v.type === "inbound-rtp" && ["m3", "m4"].includes(v.mid)));
    //  esce il pid minore
    pb.close();
    await x.amb.avanza(0);
    c("b esce: il capofila diventa c, con gli stessi sender", [0, true], [pb.getSenders().length, pcc.getSenders().length === 2 && pcc.getSenders().every((s) => sPrima.includes(s))]);
    c("…d resta senza sender", 0, pd.getSenders().length);
    const s2 = { inbound: 0, pairRicevuti: 0, uscita: 0 };
    for (const p of [pcc, pd]) (await p.getStats()).forEach((v) => { if (v.type === "inbound-rtp") s2.inbound += v.bytesReceived; if (v.type === "candidate-pair") s2.pairRicevuti += v.bytesReceived; if (v.type === "outbound-rtp") s2.uscita++; });
    c("stesso conteggio con il capofila nuovo (restano 2 pid: 4000), sempre un outbound", { inbound: 4000, pairRicevuti: 0, uscita: 1 }, s2);
    //  ricostruzione del pub: mai i sender del pc vecchio
    const vecchio = x.amb.pc("pub")[0];
    x.amb.autoconnetti.pub = null;
    vecchio.stato("failed");
    await x.amb.avanza(0);
    const nuovo = x.amb.pc("pub")[1];
    c("dopo la ricostruzione il capofila porta i sender del pc NUOVO, nessuno del vecchio", [true, false], [pcc.getSenders().length === 2 && pcc.getSenders().every((s) => nuovo.transceivers.some((t) => t.sender === s)), pcc.getSenders().some((s) => vecchio.transceivers.some((t) => t.sender === s))]);
  }
  {
    //  durante la ricostruzione del pub non c'è un sender vecchio da dare
    const x = await avvio({ altri: ["bbbb2222"], dopoCreazione: () => {} });
    let sbloccaPubblica;
    const fermo = new Promise((r) => { sbloccaPubblica = r; });
    let primo = true;
    x.amb.rispondi = (az, corpo) => (az === "pubblica" && !primo ? fermo.then(() => ({ ok: true, status: 200, sessionId: "S-nuova", chiave: "K-nuova", answerSdp: "v=0", audio: "aaaa1111-a", video: "aaaa1111-v" })) : (primo = false, undefined));
    x.amb.pc("pub")[0].stato("failed");
    await x.amb.avanza(0);
    const pb = x.peers.get("bbbb2222").p;
    const nuovoSender = pb.getSenders();
    c("mentre il pub si ricostruisce il capofila porta i sender del pc nato ora (mai del vecchio)", true, nuovoSender.every((s) => x.amb.pc("pub")[1].transceivers.some((t) => t.sender === s)) && nuovoSender.length === 2);
    sbloccaPubblica();
    await x.amb.avanza(0);
    c("a pubblicazione finita: sempre quelli nuovi", true, pb.getSenders().every((s) => x.amb.pc("pub")[1].transceivers.some((t) => t.sender === s)));
  }

  /* ══════════════════ 13-14. close / chiudiTutto / espelli ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · close() DEL PEER E chiudiTutto()");
  {
    const x = await avvio({ altri: ["bbbb2222", "cccc3333"] });
    const pb = x.peers.get("bbbb2222");
    pb.p.close();
    await x.amb.avanza(0);
    c("close() di un PeerSfu non chiude i pc condivisi", [false, false], [x.amb.pc("pub")[0].chiuso, x.amb.pc("sub")[0].chiuso]);
    c("…svuota lo stream di quel pid", 0, pb.ricevute[0].flusso.getTracks().length);
    c("…e l'altro peer è intatto", "connected", x.peers.get("cccc3333").p.connectionState);
    c("close() è idempotente", "closed", (pb.p.close(), pb.p.connectionState));
    x.sfu.chiudiTutto();
    await x.amb.avanza(0);
    c("chiudiTutto chiude pub e sub", [true, true], [x.amb.pc("pub")[0].chiuso, x.amb.pc("sub")[0].chiuso]);
    const esci = x.amb.chiamate.filter((a) => a.azione === "esci");
    c("…e chiama 'esci' con la chiave, in keepalive (uscita forzata)", [1, "K-aaaa1111-1", true], [esci.length, esci[0]?.corpo.chiave, esci[0]?.opz?.keepalive]);
    c("…il peer rimasto risulta 'closed'", "closed", x.peers.get("cccc3333").p.connectionState);
    x.sfu.chiudiTutto();
    c("chiudiTutto due volte: una sola 'esci'", 1, quante(x.amb, "esci"));
    const n = x.amb.chiamate.length;
    x.sfu.sincronizza(); x.sfu.suAnnuncio("bbbb2222", annuncioDi("bbbb2222")); x.sfu.viva("bbbb2222");
    await x.amb.avanza(30_000);
    c("dopo chiudiTutto non parte più niente (timer compresi)", n, x.amb.chiamate.length);
  }
  {
    //  uscita forzata mentre il server sta ancora rispondendo
    const x = await avvio({ altri: [], dopoCreazione: () => {} });
    let finisci;
    const fermo = new Promise((r) => { finisci = r; });
    x.amb.rispondi = (az) => (az === "pubblica" ? fermo : undefined);
    x.sfu.nuovoPeer("bbbb2222"); x.sfu.sincronizza();
    await x.amb.avanza(0);
    x.sfu.chiudiTutto();
    finisci({ ok: true, status: 200, sessionId: "S-tardiva", chiave: "K-tardiva", answerSdp: "v=0", audio: "aaaa1111-a", video: "aaaa1111-v" });
    await x.amb.avanza(0);
    const esci = x.amb.chiamate.filter((a) => a.azione === "esci");
    c("uscita mentre pubblica: la riga nata dopo viene cancellata (esci con la sua chiave)", [1, "K-tardiva"], [esci.length, esci[0]?.corpo.chiave]);
    c("…e il pc nato non resta aperto, nessun annuncio", [true, null], [x.amb.pc("pub")[0].chiuso, x.sfu.annuncio()]);
  }
  gruppo("MEETLY SFU · CLIENT · espelli(pid)");
  {
    const x = await avvio({ ruolo: "consulente", altri: ["bbbb2222", "cccc3333"] });
    const pb = x.peers.get("bbbb2222");
    x.sfu.espelli("bbbb2222");
    await x.amb.avanza(0);
    const e = x.amb.chiamate.filter((a) => a.azione === "espelli");
    c("espelli chiama l'azione col solo codice e pid", [1, { codice: "stanza-prova", pid: "bbbb2222" }], [e.length, e[0]?.corpo]);
    c("…e chiude il PeerSfu: closed, stream vuoto, nessun sender", ["closed", 0, 0], [pb.p.connectionState, pb.ricevute[0].flusso.getTracks().length, pb.p.getSenders().length]);
    c("…l'altro resta", "connected", x.peers.get("cccc3333").p.connectionState);
    c("…e il capofila passa a c", 2, x.peers.get("cccc3333").p.getSenders().length);
  }

  /* ══════════════════ STATO DELLA PERSONA ══════════════════ */
  gruppo("MEETLY SFU · CLIENT · «connected» VUOL DIRE CHE LA PERSONA C'È");
  {
    const x = await avvio();
    const o = x.peers.get("bbbb2222");
    c("tracce arrivate e saluto recente: 'connected'", "connected", o.p.connectionState);
    c("iceConnectionState segue", "connected", o.p.iceConnectionState);
    await x.amb.avanza(11_000);
    c("11 s senza saluto: ancora 'connected'", "connected", o.p.connectionState);
    const nCambi = o.cambi.length;
    await x.amb.avanza(2000);
    c("13 s di silenzio: 'disconnected' (e call.tsx è avvisata)", ["disconnected", true], [o.p.connectionState, o.cambi.length > nCambi]);
    c("…ice: 'disconnected'", "disconnected", o.p.iceConnectionState);
    await x.amb.avanza(13_000);
    c("26 s di silenzio: 'failed' mentre il pc verso Cloudflare è sano", ["failed", "connected", "connected"], [o.p.connectionState, x.amb.pc("pub")[0].connectionState, x.amb.pc("sub")[0].connectionState]);
    c("…senza ricostruire niente (la persona se n'è andata)", [0, 1, 1, []], [x.sfu.stato().ricostruzioni, x.amb.pc("pub").length, x.amb.pc("sub").length, x.fall]);
    x.sfu.viva("bbbb2222");
    c("riarriva un hello: torna 'connected'", "connected", o.p.connectionState);
    c("la sequenza notificata", ["connected", "disconnected", "failed", "connected"], o.cambi.slice(-4));
    //  con il verdetto del modulo vero (resta-in-lista) T1 lo prova già: qui l'adattatore dà lo stato giusto
    const y = await avvio({ viva: false });
    c("mai salutato: non è 'connected' anche se tracce e pc sono su", "connecting", y.peers.get("bbbb2222").p.connectionState);
    const z = await avvio({ annuncia: false, viva: true });
    c("salutato ma senza annuncio (nessuna traccia): 'connecting'", "connecting", z.peers.get("bbbb2222").p.connectionState);
    const w = await avvio({ altri: [] });
    const nuovo = w.sfu.nuovoPeer("bbbb2222");
    c("peer appena nato: 'new'", "new", nuovo.connectionState);
  }
  {
    //  un pc che cade e si riprende da solo in 3 s non fa rumore
    const x = await avvio();
    const o = x.peers.get("bbbb2222");
    x.amb.pc("sub")[0].stato("disconnected");
    await passa(x, 3000);
    c("pc 'disconnected' per 3 s (grazia 5 s): il peer resta 'connecting', non 'disconnected', e non si ricostruisce", ["connecting", 0], [o.p.connectionState, x.sfu.stato().ricostruzioni]);
    x.amb.pc("sub")[0].stato("connected");
    await passa(x, 3000);
    c("…si riprende da solo: di nuovo 'connected', nessuna ricostruzione", ["connected", 0, 1], [o.p.connectionState, x.sfu.stato().ricostruzioni, x.amb.pc("sub").length]);
    x.amb.pc("sub")[0].stato("disconnected");
    await passa(x, 7000);
    c("pc 'disconnected' oltre la grazia: ricostruzione del sub", [1, 2], [x.sfu.stato().ricostruzioni, x.amb.pc("sub").length]);
  }

  gruppo("MEETLY SFU · CLIENT · RINNOVA OGNI MINUTO, STATO, FINTI");
  {
    const x = await avvio();
    await passa(x, 125_000);
    const rn = x.amb.chiamate.filter((a) => a.azione === "rinnova");
    c("'rinnova' ogni 60 s (due in 125 s) con la chiave e senza segreto", [2, "K-aaaa1111-1", false], [rn.length, rn[0]?.corpo.chiave, "segreto" in (rn[0]?.corpo ?? {})]);
    c("…a distanza di 60 s", 60_000, rn[1].t - rn[0].t);
    const y = await avvio({ dopoCreazione: (a) => { a.rispondi = (az) => (az === "rinnova" ? { ok: false, status: 500, error: "cloudflare" } : undefined); } });
    await passa(y, 130_000);
    c("un 'rinnova' che fallisce non è un guasto", [[], true], [y.fall, quante(y.amb, "rinnova") >= 2]);
    c("stato(): pub/sub/annunciati/ricostruzioni", { pub: "connected", sub: "connected", annunciati: 1, ricostruzioni: 0 }, x.sfu.stato());
    const p = x.peers.get("bbbb2222").p;
    let msg = [];
    for (const f of ["createOffer", "createAnswer", "setLocalDescription", "setRemoteDescription", "addIceCandidate"]) {
      try { await p[f]({}); msg.push("niente errore"); } catch (e) { msg.push(String(e.message)); }
    }
    c("createOffer/Answer, set*Description, addIceCandidate: «non supportato in SFU»", Array(5).fill("non supportato in SFU"), msg);
    c("signalingState 'stable' e descrizioni finte non nulle", [true, true, true, "stable"], [!!p.localDescription, !!p.remoteDescription, !!p.currentRemoteDescription, p.signalingState]);
    p.setConfiguration({});
    const n0 = quante(x.amb, "abbonati");
    x.amb.pc("sub")[0].stato("connected");
    p.restartIce();
    await x.amb.avanza(0);
    c("restartIce con tutto sano non fa niente (niente ICE restart in SFU)", [n0, 1], [quante(x.amb, "abbonati"), x.amb.pc("sub").length]);
  }

  gruppo("MEETLY SFU · CLIENT · ricostruzione del pub: gli altri si riabbonano dal nuovo annuncio");
  {
    //  due client collegati allo stesso server finto: B vede il nuovo annuncio di A e riabbona
    const x = await avvio({ altri: ["bbbb2222"] });
    const a1 = x.sfu.annuncio();
    x.amb.pc("pub")[0].stato("failed");
    await x.amb.avanza(0);
    const a2 = x.sfu.annuncio();
    c("dopo la ricostruzione l'annuncio cambia sessione (gli altri lo vedono dall'hello)", [true, "aaaa1111-v"], [a1.s !== a2.s, a2.v]);
  }

  gruppo("MEETLY SFU · CLIENT · IL GANCIO DI SVILUPPO");
  {
    const x = await avvio();
    c("in Node (nessun window, nessun DEV) non c'è nessun gancio", "undefined", typeof globalThis.__hgSfu);
  }
}
