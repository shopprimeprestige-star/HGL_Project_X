/** ── PROVE: MEETLY SFU · LA ROTTA SERVER (T2, 31/10/2026) ───────────────────────────────
 *  Commessa 2026-10-31-meetly-connessione, Parte B (PIANO.md §1.5, §3 T2, note N2 e N4,
 *  obiezioni 2, 6 e 7 del revisore). Il nucleo lato server gira qui in Node con TUTTO
 *  finto: archivio in memoria, Cloudflare finto, orologio e «fuori» (stanza viva,
 *  sala d'attesa) pilotati dalla prova. Niente rete, niente database.
 *  Moduli veri: src/shop/meetly-sfu-stanza.ts e src/shop/meetly-sfu-cloudflare.ts
 *  (impacchettati da prove.mjs). Del collante (`.server.ts`) e della rotta si legge
 *  il sorgente: importano il database e in Node non si caricano.
 *  Dati inventati: nessun cliente vero, nessuna chiave vera. */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

export async function proveMeetlySfuServer(mod, { c, gruppo, radice }) {
  {
    gruppo("MEETLY SFU · CONSULENTE SOLO NELLA PROPRIA STANZA (revisione di sicurezza 31/10)");
    const P = mod["shop/meetly-sfu-padrone"];
    const crm = (tipo, consultantId, agenda = true) => ({ tipo, consultantId, agenda });
    c("il proprietario conduce ovunque", true, P.eConsulenteDellaStanza({ padrone: "", sessioneId: "", crm: crm("proprietario", "") }));
    c("consulente CRM nella sua stanza: sì", true, P.eConsulenteDellaStanza({ padrone: "c1", sessioneId: "", crm: crm("consulente", "c1") }));
    c("consulente CRM in una stanza di un collega: no", false, P.eConsulenteDellaStanza({ padrone: "c2", sessioneId: "", crm: crm("consulente", "c1") }));
    c("consulente CRM senza «agenda»: no", false, P.eConsulenteDellaStanza({ padrone: "c1", sessioneId: "", crm: crm("consulente", "c1", false) }));
    c("sessione presentatore col PIN nella sua stanza: sì", true, P.eConsulenteDellaStanza({ padrone: "c1", sessioneId: "c1", crm: null }));
    c("sessione presentatore in una stanza altrui: no", false, P.eConsulenteDellaStanza({ padrone: "c2", sessioneId: "c1", crm: null }));
    c("stanza senza padrone noto: nessuno tranne il proprietario", false, P.eConsulenteDellaStanza({ padrone: "", sessioneId: "c1", crm: crm("consulente", "c1") }));
    c("codice consulente generale (sessione senza id): no", false, P.eConsulenteDellaStanza({ padrone: "c1", sessioneId: "", crm: null }));
    const rotta = readFileSync(join(radice, "src/routes/api.public.meetly-sfu.ts"), "utf8");
    c("la rotta non vale più «consulente» col solo permesso agenda", false, /const consulente = !!sessione \|\| !!crm\?\.accesso\.puo\("agenda"\);/.test(rotta));
    c("la rotta usa il padrone della stanza", true, /eConsulenteDellaStanza\(/.test(rotta) && /consulenteDellaSessione\(codice\)/.test(rotta));
  }

  const S = mod["shop/meetly-sfu-stanza"];
  const CF = mod["shop/meetly-sfu-cloudflare"];
  const R = mod["shop/meetly-sfu-regole"];
  gruppo("MEETLY SFU · LA ROTTA SERVER · MODULI");
  c("il nucleo della stanza e il client Cloudflare ci sono", [true, true], [!!S, !!CF]);
  if (!S || !CF) return;

  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const T0 = 1_800_000_000_000;
  const CODICE = "stanza-uno";
  const SEGRETO = "segreto-di-prova-0123456789";
  const SEGRETO_2 = "altro-segreto-di-prova-9876";

  /* ── IL BANCO: archivio, Cloudflare e «fuori» finti ─────────────────── */
  function banco({ senzaSegreti = false } = {}) {
    const st = { t: T0, viva: true, ammessi: new Set(), sessioni: 0, chiamate: [], cfRotto: null, log: [] };
    const righe = new Map();
    const archivio = {
      leggi: async (k) => righe.get(k)?.valore ?? null,
      scrivi: async (k, v) => (righe.set(k, { valore: v, at: st.t }), ""),
      cancella: async (k) => void righe.delete(k),
      elenca: async (p) => [...righe].filter(([k]) => k.startsWith(p)).map(([chiave, x]) => ({ chiave, valore: x.valore })),
      ripulisci: async (p, primaDi) => {
        for (const [k, x] of [...righe]) if (k.startsWith(p) && x.at < primaDi) righe.delete(k);
      },
    };
    const guasta = () => Object.assign(new Error("Cloudflare 500"), st.cfRotto);
    const cloudflare = senzaSegreti
      ? null
      : {
          nuovaSessione: async () => {
            if (st.cfRotto) throw guasta();
            st.sessioni++;
            return `sessione${st.sessioni}abc`;
          },
          tracceLocali: async (sid, sdp, tracce) => {
            if (st.cfRotto) throw guasta();
            st.chiamate.push(["locali", sid, tracce.map((t) => t.trackName)]);
            return { answerSdp: "v=0 RISPOSTA" };
          },
          tracceRemote: async (sid, tracce) => {
            if (st.cfRotto) throw guasta();
            st.chiamate.push(["remote", sid, tracce.map((t) => t.trackName)]);
            return {
              offerSdp: "v=0 OFFERTA",
              serve: true,
              tracce: tracce.map((t, i) => ({ mid: String(i), trackName: t.trackName })),
            };
          },
          rinegozia: async (sid) => void st.chiamate.push(["rinegozia", sid]),
        };
    const fuori = {
      stanzaViva: async () => st.viva,
      ammesso: async (_codice, pid) => st.ammessi.has(pid),
      adesso: () => st.t,
    };
    const deps = { archivio, cloudflare, fuori, log: (r) => st.log.push(String(r)) };
    const vai = (ruolo, corpo, extra = {}) =>
      S.trattaSfu(deps, {
        ruolo,
        contentType: "application/json",
        corpo: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
        ...extra,
      });
    const chiamate = (tipo) => st.chiamate.filter((x) => x[0] === tipo).length;
    return { st, righe, deps, vai, chiamate };
  }

  const pubOspite = (pid, extra = {}) => ({
    azione: "pubblica",
    codice: CODICE,
    pid,
    dev: `dev-${pid}`,
    segreto: SEGRETO,
    offerSdp: "v=0 OFFERTA-MIA",
    midAudio: "0",
    midVideo: "1",
    ...extra,
  });
  const dichiara = (b, codice = CODICE) => b.vai("consulente", { azione: "dichiara", codice, forzato: true });
  /** consulente `consul01` dichiara e pubblica. */
  async function conConsulente(b) {
    await dichiara(b);
    const r = await b.vai("consulente", pubOspite("consul01", { segreto: undefined }));
    return r.body;
  }
  /** un ospite ammesso che pubblica; torna la risposta. */
  async function entra(b, pid, extra = {}) {
    b.st.ammessi.add(pid);
    return b.vai("ospite", pubOspite(pid, extra));
  }
  const chiaveRiga = (b, codice, pid) => `meetly_sfu:${codice}:${pid}`;
  const riga = (b, pid, codice = CODICE) => {
    const v = b.righe.get(chiaveRiga(b, codice, pid))?.valore;
    return v ? JSON.parse(v) : null;
  };

  /* ── 1. L'OSPITE: STANZA VIVA, DICHIARATO, AMMESSO ──────────────────── */
  gruppo("MEETLY SFU · SERVER · L'OSPITE (stanza viva, dichiarato, ammesso)");
  {
    const b = banco();
    b.st.viva = false;
    b.st.ammessi.add("ospite01");
    const r0 = await (b.vai("ospite", pubOspite("ospite01")));
    c("stanza non viva: 409", 409, r0.status);
    b.st.viva = true;
    const r1 = await (b.vai("ospite", pubOspite("ospite01")));
    c("non dichiarato: 409 «non-dichiarato», non un errore terminale", [409, "non-dichiarato"], [r1.status, r1.body.error]);
    c("…e Cloudflare non è stato toccato", 0, b.st.sessioni + b.st.chiamate.length);
    // il consulente dichiara (e basta: nessuna pubblicazione), poi l'ospite passa
    const d = await (dichiara(b));
    c("il consulente dichiara: ok", [200, true], [d.status, d.body.ok]);
    c("la riga _stato dice sfu e ha un'ora", ["sfu", true], [
      JSON.parse(b.righe.get(`meetly_sfu:${CODICE}:_stato`).valore).trasporto,
      JSON.parse(b.righe.get(`meetly_sfu:${CODICE}:_stato`).valore).dichiaratoIl > 0,
    ]);
    const r2 = await (b.vai("ospite", pubOspite("ospite01")));
    c("tutto in regola: 200", [200, true], [r2.status, r2.body.ok]);
    c("risposta: sessione, chiave di 48 esadecimali, risposta SDP, nomi delle tracce", [true, true, true, "ospite01-a", "ospite01-v"], [
      /^sessione\d+abc$/.test(r2.body.sessionId),
      /^[0-9a-f]{48}$/.test(r2.body.chiave),
      r2.body.answerSdp === "v=0 RISPOSTA",
      r2.body.audio,
      r2.body.video,
    ]);
    c("a Cloudflare vanno le tracce <pid>-a e <pid>-v", ["locali", "ospite01-a", "ospite01-v"], [
      b.st.chiamate[0][0],
      ...b.st.chiamate[0][2],
    ]);
    const salvata = b.righe.get(chiaveRiga(b, CODICE, "ospite01")).valore;
    c("la riga salvata non contiene SDP né il segreto in chiaro", [false, false, false], [
      salvata.includes("v=0"),
      salvata.includes(SEGRETO),
      salvata.includes("OFFERTA"),
    ]);
    c("la riga porta ruolo, dev, chiave, sessione pub e un orario", ["ospite", "dev-ospite01", true, true], [
      riga(b, "ospite01").ruolo,
      riga(b, "ospite01").dev,
      riga(b, "ospite01").chiave === r2.body.chiave,
      riga(b, "ospite01").at === T0,
    ]);
  }
  {
    const b = banco();
    await conConsulente(b);
    // non ammesso: né pubblica né abbonati
    const rp = await (b.vai("ospite", pubOspite("intruso01")));
    c("non ammesso: 403 su pubblica", [403, "non-ammesso"], [rp.status, rp.body.error]);
    const prima = b.st.chiamate.length;
    const ra = await (
      b.vai("ospite", {
        azione: "abbonati",
        codice: CODICE,
        pid: "intruso01",
        chiave: "0".repeat(48),
        tracce: [{ sessionId: riga(b, "consul01").pub.sessionId, trackName: "consul01-v" }],
      })
    );
    c("non ammesso: 403 su abbonati (la chiave non esiste)", 403, ra.status);
    c("…e a Cloudflare non è partita nessuna richiesta", prima, b.st.chiamate.length);
    // chi conosce solo l'hello (pid + sessione del consulente) non ha una riga né una chiave
    c("l'intruso non ha lasciato righe", false, b.righe.has(chiaveRiga(b, CODICE, "intruso01")));
    // ammesso e consulente: ammissione solo in `pubblica` (N2)
    b.st.ammessi.add("ospite01");
    const rg = await (b.vai("ospite", pubOspite("ospite01")));
    b.st.ammessi.delete("ospite01"); // la sala lo rimette «in attesa»: abbonati NON lo richiede più
    const rab = await (
      b.vai("ospite", {
        azione: "abbonati",
        codice: CODICE,
        pid: "ospite01",
        chiave: rg.body.chiave,
        tracce: [{ sessionId: riga(b, "consul01").pub.sessionId, trackName: "consul01-a" }],
      })
    );
    c("N2: dopo pubblica la chiave basta, abbonati non rilegge la sala", 200, rab.status);
    // il consulente non passa dalla sala d'attesa
    const rc = await (b.vai("consulente", pubOspite("consul02", { segreto: undefined })));
    c("il consulente è esente dalla sala", 200, rc.status);
  }

  /* ── 2. DICHIARA ─────────────────────────────────────────────────────── */
  gruppo("MEETLY SFU · SERVER · DICHIARA");
  {
    const b = banco();
    const o = await (b.vai("ospite", { azione: "dichiara", codice: CODICE, forzato: true }));
    c("l'ospite non dichiara, nemmeno col «forzato»", [403, false], [o.status, b.righe.has(`meetly_sfu:${CODICE}:_stato`)]);
    const m = await (b.vai("consulente", { azione: "dichiara", codice: CODICE }));
    c("interruttore spento e niente «forzato»: 409, niente riga", [409, false], [m.status, b.righe.has(`meetly_sfu:${CODICE}:_stato`)]);
    const f = await (b.vai("consulente", { azione: "dichiara", codice: CODICE, forzato: true }));
    c("«forzato» vale anche a interruttore mesh", [200, true], [f.status, b.righe.has(`meetly_sfu:${CODICE}:_stato`)]);
    const b2 = banco();
    b2.righe.set("meetly_trasporto", { valore: JSON.stringify({ trasporto: "sfu" }), at: T0 });
    const i = await (b2.vai("consulente", { azione: "dichiara", codice: CODICE }));
    c("interruttore sfu: dichiara anche senza «forzato»", 200, i.status);
    const b3 = banco({ senzaSegreti: true });
    b3.righe.set("meetly_trasporto", { valore: JSON.stringify({ trasporto: "sfu" }), at: T0 });
    const n1 = await (b3.vai("consulente", { azione: "dichiara", codice: CODICE, forzato: true }));
    c("senza segreti: 503 «non-configurato», anche col forzato", [503, "non-configurato", false], [
      n1.status,
      n1.body.error,
      b3.righe.has(`meetly_sfu:${CODICE}:_stato`),
    ]);
    const n2 = await (b3.vai("ospite", pubOspite("ospite01")));
    c("senza segreti l'ospite che pubblica riceve 503", [503, "non-configurato"], [n2.status, n2.body.error]);
    // una stanza dichiarata non lo è per un'altra
    const b4 = banco();
    await (dichiara(b4, "altra-stanza"));
    b4.st.ammessi.add("ospite01");
    const altra = await (b4.vai("ospite", pubOspite("ospite01")));
    c("la dichiarazione è per stanza", [409, "non-dichiarato"], [altra.status, altra.body.error]);
  }

  /* ── 3. L'OSPITE PIÙ VELOCE DEL CONSULENTE ───────────────────────────── */
  gruppo("MEETLY SFU · SERVER · L'OSPITE ARRIVA PRIMA DELLA DICHIARAZIONE");
  {
    const b = banco();
    b.st.ammessi.add("ospite01");
    const tentativi = [];
    for (let i = 0; i < 3; i++) {
      const r = await (b.vai("ospite", pubOspite("ospite01")));
      tentativi.push([r.status, r.body.error]);
      b.st.t += 1500;
    }
    c("tre tentativi prima della dichiarazione: sempre 409 «non-dichiarato» (si ritenta, non si ripiega)", [
      [409, "non-dichiarato"],
      [409, "non-dichiarato"],
      [409, "non-dichiarato"],
    ], tentativi);
    await (dichiara(b));
    const dopo = await (b.vai("ospite", pubOspite("ospite01")));
    c("appena il consulente dichiara, il ritentativo passa", 200, dopo.status);
    c("la corsa non ha consumato il limite delle pubblicazioni", 1, riga(b, "ospite01").pubblicazioni.length);
  }

  /* ── 4. ESPELLI ──────────────────────────────────────────────────────── */
  gruppo("MEETLY SFU · SERVER · ESPELLI (obiezione 2)");
  {
    const b = banco();
    await conConsulente(b);
    const o = await (entra(b, "ospite01"));
    const chiave = o.body.chiave;
    const sessCons = riga(b, "consul01").pub.sessionId;
    const noOspite = await (b.vai("ospite", { azione: "espelli", codice: CODICE, pid: "ospite01" }));
    c("l'ospite non può espellere", [403, true], [noOspite.status, !!riga(b, "ospite01")]);
    const e = await (b.vai("consulente", { azione: "espelli", codice: CODICE, pid: "ospite01" }));
    c("il consulente espelle: ok, la riga sparisce", [200, null], [e.status, riga(b, "ospite01")]);
    const esc = JSON.parse(b.righe.get(`meetly_sfu:${CODICE}:_esclusi`).valore);
    c("_esclusi porta il pid dell'espulso e NON il suo dispositivo (si toglie la persona sbagliata, la si può riammettere)", [["ospite01"], []], [esc.pid, esc.dev]);
    const sessioniPrima = b.st.sessioni;
    const rp = await (b.vai("ospite", pubOspite("ospite01")));
    c("pubblica dopo l'espulsione: 403 escluso", [403, "escluso"], [rp.status, rp.body.error]);
    const ra = await (
      b.vai("ospite", {
        azione: "abbonati",
        codice: CODICE,
        pid: "ospite01",
        chiave,
        tracce: [{ sessionId: sessCons, trackName: "consul01-v" }],
      })
    );
    c("abbonati dopo l'espulsione, con la sua vecchia chiave: 403 escluso", [403, "escluso"], [ra.status, ra.body.error]);
    const rn = await (b.vai("ospite", { azione: "rinnova", codice: CODICE, pid: "ospite01", chiave }));
    c("rinnova dopo l'espulsione: 403 escluso", [403, "escluso"], [rn.status, rn.body.error]);
    c("nessuna nuova sessione Cloudflare dopo l'espulsione", sessioniPrima, b.st.sessioni);
    b.st.ammessi.add("ospite77");
    const altroPid = await (b.vai("ospite", pubOspite("ospite77", { dev: "dev-ospite01" })));
    c("lo stesso dispositivo con un pid nuovo (riammesso dopo la rimozione): pubblica, non resta un riquadro fantasma", 200, altroPid.status);
    const stessoPid = await (b.vai("ospite", pubOspite("ospite01")));
    c("il pid espulso resta escluso anche dopo che il suo dispositivo è rientrato con un altro", [403, "escluso"], [stessoPid.status, stessoPid.body.error]);
    // un altro ospite non è toccato
    const o2 = await (entra(b, "ospite02"));
    c("un altro ospite entra comunque", 200, o2.status);
    // espelli un pid che non ha mai pubblicato: si scrive comunque l'esclusione (l'espulsione non aspetta)
    const e2 = await (b.vai("consulente", { azione: "espelli", codice: CODICE, pid: "mai00001", dev: "dev-mai" }));
    const esc2 = JSON.parse(b.righe.get(`meetly_sfu:${CODICE}:_esclusi`).valore);
    c("espellere chi non ha riga scrive comunque l'esclusione", [200, true, true], [e2.status, esc2.pid.includes("mai00001"), esc2.dev.includes("dev-mai")]);
  }

  /* ── 5. ABBONATI E RINEGOZIA ─────────────────────────────────────────── */
  gruppo("MEETLY SFU · SERVER · ABBONATI E RINEGOZIA");
  {
    const b = banco();
    await conConsulente(b);
    await (dichiara(b, "altra-stanza"));
    const altra = await (b.vai("consulente", pubOspite("altro001", { codice: "altra-stanza", segreto: undefined })));
    const o = await (entra(b, "ospite01"));
    const sessCons = riga(b, "consul01").pub.sessionId;
    const ab = (tracce, extra = {}) =>
      b.vai("ospite", { azione: "abbonati", codice: CODICE, pid: "ospite01", chiave: o.body.chiave, tracce, ...extra });
    const buone = [
      { sessionId: sessCons, trackName: "consul01-a" },
      { sessionId: sessCons, trackName: "consul01-v" },
    ];
    const sessioniPrima = b.st.sessioni;
    const r = await (ab(buone));
    c("abbonarsi alle tracce del consulente: ok", [200, true], [r.status, r.body.ok]);
    c("la risposta ha subSessionId, offerta, serve e la mappa mid → traccia", [true, "v=0 OFFERTA", true, ["consul01-a", "consul01-v"]], [
      typeof r.body.subSessionId === "string" && r.body.subSessionId.length > 0,
      r.body.offerSdp,
      r.body.serve,
      r.body.tracce.map((t) => t.trackName),
    ]);
    c("la sessione sub è nata e sta nella riga", [sessioniPrima + 1, r.body.subSessionId], [b.st.sessioni, riga(b, "ospite01").sub.sessionId]);
    const r2 = await (ab(buone.slice(0, 1), { subSessionId: r.body.subSessionId }));
    c("con il subSessionId noto non ne nasce un'altra", [200, sessioniPrima + 1], [r2.status, b.st.sessioni]);

    const prova = (nome, esito) => c(nome, true, esito.status >= 400 && esito.status < 500);
    prova("chiave sbagliata: rifiutato", await (ab(buone, { chiave: "f".repeat(48) })));
    c("…con 403", 403, (await (ab(buone, { chiave: "f".repeat(48) }))).status);
    prova("sessione di un'altra stanza: rifiutato", await (ab([{ sessionId: altra.body.sessionId, trackName: "altro001-v" }])));
    prova("traccia propria: rifiutata", await (ab([{ sessionId: o.body.sessionId, trackName: "ospite01-a" }])));
    prova("nome fuori formato: rifiutato", await (ab([{ sessionId: sessCons, trackName: "consul01-x" }])));
    prova("nome di un pid che non c'è: rifiutato", await (ab([{ sessionId: sessCons, trackName: "fantasma1-v" }])));
    prova("sessione giusta con il nome di un altro: rifiutato", await (ab([{ sessionId: sessCons, trackName: "ospite01-a" }])));
    prova("nessuna traccia: rifiutato", await (ab([])));
    prova("tracce non è un elenco: rifiutato", await (ab("consul01-a")));
    prova("elemento nullo nell'elenco: rifiutato", await (ab([null])));
    const nove = Array.from({ length: 9 }, () => ({ sessionId: sessCons, trackName: "consul01-a" }));
    prova("più di 8 tracce: rifiutato", await (ab(nove)));
    const dopoRifiuti = b.chiamate("remote");
    c("nessun rifiuto è arrivato a Cloudflare", 2, dopoRifiuti);
    // rinegozia
    const rin = (sub, extra = {}) =>
      b.vai("ospite", { azione: "rinegozia", codice: CODICE, pid: "ospite01", chiave: o.body.chiave, subSessionId: sub, answerSdp: "v=0 RISPOSTA-MIA", ...extra });
    const rok = await (rin(r.body.subSessionId));
    c("rinegozia sul proprio sub: ok", [200, 1], [rok.status, b.chiamate("rinegozia")]);
    const consSub = await (
      b.vai("consulente", { azione: "abbonati", codice: CODICE, pid: "consul01", chiave: riga(b, "consul01").chiave, tracce: [{ sessionId: o.body.sessionId, trackName: "ospite01-a" }] })
    );
    const altrui = await (rin(consSub.body.subSessionId));
    c("rinegozia su un subSessionId non suo: 403", [403, 1], [altrui.status, b.chiamate("rinegozia")]);
    c("rinegozia con chiave sbagliata: 403", 403, (await (rin(r.body.subSessionId, { chiave: "f".repeat(48) }))).status);
    c("rinegozia senza risposta SDP: 400", 400, (await (rin(r.body.subSessionId, { answerSdp: "" }))).status);
    // senza segreti
    const bz = banco({ senzaSegreti: true });
    const z = await (bz.vai("ospite", { azione: "abbonati", codice: CODICE, pid: "ospite01", chiave: "a".repeat(48), tracce: buone }));
    c("senza segreti abbonati risponde 503", 503, z.status);
  }
  {
    // 30 abbonamenti al minuto per pid
    const b = banco();
    await conConsulente(b);
    const o = await (entra(b, "ospite01"));
    const sess = riga(b, "consul01").pub.sessionId;
    const ab = () =>
      b.vai("ospite", {
        azione: "abbonati", codice: CODICE, pid: "ospite01", chiave: o.body.chiave,
        tracce: [{ sessionId: sess, trackName: "consul01-a" }],
      });
    let ultimo;
    let ok = 0;
    for (let i = 0; i < 30; i++) {
      ultimo = await (ab());
      if (ultimo.status === 200) ok++;
    }
    c("trenta abbonamenti in un minuto passano", 30, ok);
    const trentuno = await (ab());
    c("il trentunesimo: 429 «limite»", [429, "limite"], [trentuno.status, trentuno.body.error]);
    b.st.t += 61_000;
    c("passato il minuto si riprende", 200, (await (ab())).status);
  }

  /* ── 6. LIMITI ───────────────────────────────────────────────────────── */
  gruppo("MEETLY SFU · SERVER · LIMITI (obiezione 6)");
  {
    // sesta ok, settima 429 (per pid, 10 minuti)
    const b = banco();
    await conConsulente(b);
    const o = await (entra(b, "ospite01"));
    let chiave = o.body.chiave;
    let ultimo;
    for (let i = 0; i < 5; i++) {
      b.st.t += 1000;
      ultimo = await (b.vai("ospite", pubOspite("ospite01", { chiave })));
    }
    c("sei pubblicazioni di un pid in 10 minuti passano", [200, 6], [ultimo.status, riga(b, "ospite01").pubblicazioni.length]);
    const sette = await (b.vai("ospite", pubOspite("ospite01", { chiave })));
    c("la settima: 429 «limite»", [429, "limite"], [sette.status, sette.body.error]);
    b.st.t += 601_000;
    const ottava = await (b.vai("ospite", pubOspite("ospite01", { chiave })));
    c("dopo 10 minuti si può", 200, ottava.status);
    c("la chiave resta quella (chi ha provato di essere lui non ne riceve una nuova)", chiave, ottava.body.chiave);
  }
  {
    // 40 per codice all'ora
    const b = banco();
    await conConsulente(b); // 1 pubblicazione (consul01)
    const pidList = ["ospite01", "ospite02", "ospite03", "ospite04", "ospite05", "ospite06", "ospite07"];
    const chiavi = {};
    let okTot = 1;
    for (const pid of pidList) {
      const r = await (entra(b, pid));
      chiavi[pid] = r.body.chiave;
      if (r.status === 200) okTot++;
    }
    let bloccata = null;
    for (let giro = 0; giro < 8 && !bloccata; giro++) {
      for (const pid of pidList) {
        b.st.t += 500;
        const r = await (b.vai("ospite", pubOspite(pid, { chiave: chiavi[pid] })));
        if (r.status === 200) okTot++;
        else if (!bloccata) bloccata = { pid, status: r.status, error: r.body.error, okTot };
      }
    }
    c("al più 40 pubblicazioni all'ora per stanza: poi 429 «limite»", [429, "limite", 40], [bloccata?.status, bloccata?.error, bloccata?.okTot]);
    c("…e il pid bloccato non aveva ancora toccato il suo limite", true, riga(b, bloccata.pid).pubblicazioni.length < 6);
    b.st.t += 3_600_001;
    const dopo = await (b.vai("ospite", pubOspite("ospite01", { chiave: chiavi.ospite01 })));
    c("passata l'ora si riparte", 200, dopo.status);
  }
  {
    // 8 vive: il nono è respinto; le righe vecchie non contano
    const b = banco();
    await conConsulente(b);
    for (let i = 1; i <= 7; i++) await (entra(b, `ospite0${i}`));
    const nono = await (entra(b, "ospite08"));
    c("il nono partecipante vivo: 409 «stanza-piena»", [409, "stanza-piena"], [nono.status, nono.body.error]);
    c("…e non lascia una riga", null, riga(b, "ospite08"));
    b.st.t += 181_000;
    const dopo = await (entra(b, "ospite08"));
    c("righe più vecchie di 3 minuti non contano nel tetto", 200, dopo.status);
    // le righe morte restano in archivio ma nessuna è «viva»
    const vive = [...b.righe].filter(([k]) => !k.endsWith("_stato")).map(([, x]) => JSON.parse(x.valore)).filter((r) => b.st.t - r.at <= 180_000);
    c("dopo 3 minuti la sola riga viva è l'ultima", ["ospite08"], vive.map((r) => r.pid));
  }
  {
    // ricarica con lo stesso dev: la riga si sostituisce, anche a stanza piena
    const b = banco();
    await conConsulente(b);
    for (let i = 1; i <= 7; i++) await (entra(b, `ospite0${i}`));
    b.st.ammessi.add("ricarica1");
    const ric = await (b.vai("ospite", pubOspite("ricarica1", { dev: "dev-ospite03" })));
    c("ricarica con lo stesso dispositivo: sostituisce la riga, niente «stanza-piena»", [200, null, true], [
      ric.status,
      riga(b, "ospite03"),
      !!riga(b, "ricarica1"),
    ]);
    c("le pubblicazioni della riga sostituita contano ancora per la stanza", true, riga(b, "ricarica1").ereditate.length === 1);
    // stesso dev ma un altro segreto: non è lui, la sua riga resta e il posto non c'è
    b.st.ammessi.add("furbo001");
    const furbo = await (b.vai("ospite", pubOspite("furbo001", { dev: "dev-ospite04", segreto: SEGRETO_2 })));
    c("stesso dev ma segreto diverso: non sostituisce la riga altrui", [409, true], [furbo.status, !!riga(b, "ospite04")]);
  }
  {
    // codice vuoto dopo la riduzione
    const b = banco();
    await dichiara(b);
    for (const codice of ["", "!!!", "   ", "///", null]) {
      const r = await (b.vai("consulente", pubOspite("consul01", { codice, segreto: undefined })));
      c(`codice ${JSON.stringify(codice)}: 400`, 400, r.status);
    }
    c("nessuna riga con codice vuoto (meetly_sfu::…)", [], [...b.righe.keys()].filter((k) => k.startsWith("meetly_sfu::")));
    const d = await (b.vai("consulente", { azione: "dichiara", codice: "!!!" }));
    c("anche dichiara con codice vuoto: 400", 400, d.status);
  }
  {
    // pubblica su pid esistente: serve la chiave (o riga morta con lo stesso segreto)
    const b = banco();
    await conConsulente(b);
    const o = await (entra(b, "ospite01"));
    const senza = await (b.vai("ospite", pubOspite("ospite01")));
    c("pid già vivo senza la sua chiave: 403", [403, o.body.sessionId], [senza.status, riga(b, "ospite01").pub.sessionId]);
    const sbagliata = await (b.vai("ospite", pubOspite("ospite01", { chiave: "f".repeat(48) })));
    c("…chiave sbagliata: 403", 403, sbagliata.status);
    const buona = await (b.vai("ospite", pubOspite("ospite01", { chiave: o.body.chiave })));
    c("con la sua chiave la riga si rifà (ricostruzione) e la chiave non cambia", [200, o.body.chiave, true], [
      buona.status,
      buona.body.chiave,
      buona.body.sessionId !== o.body.sessionId,
    ]);
    c("la ricostruzione tiene la sessione sub già registrata", true, riga(b, "ospite01").sub === null);
    // riga morta
    b.st.t += 181_000;
    const morta = await (b.vai("ospite", pubOspite("ospite01")));
    c("riga morta dello stesso pid e dello stesso segreto: si riprende senza chiave (nuova)", [200, true], [morta.status, morta.body.chiave !== o.body.chiave]);
    b.st.t += 181_000;
    const altroSegreto = await (b.vai("ospite", pubOspite("ospite01", { segreto: SEGRETO_2 })));
    c("riga morta di un pid ma con un altro segreto: 403", 403, altroSegreto.status);
    // il pid del consulente non si prende
    b.st.ammessi.add("consul01");
    const presa = await (b.vai("ospite", pubOspite("consul01")));
    c("chi legge il pid del consulente dall'hello non ne prende il posto", [403, true], [presa.status, riga(b, "consul01").ruolo === "consulente"]);
  }
  {
    // pubblicazione: richieste malformate
    const b = banco();
    await conConsulente(b);
    b.st.ammessi.add("ospite01");
    const sessioniPrima = b.st.sessioni;
    const casi = {
      "pid maiuscolo": pubOspite("OSPITE01"),
      "pid corto": pubOspite("abc"),
      "pid con trattino": pubOspite("ospite-01"),
      "pid assente": pubOspite(undefined),
      "offerta assente": pubOspite("ospite01", { offerSdp: "" }),
      "offerta non testo": pubOspite("ospite01", { offerSdp: { x: 1 } }),
      "nessun mid": pubOspite("ospite01", { midAudio: undefined, midVideo: undefined }),
      "mid sospetto": pubOspite("ospite01", { midAudio: "0/../x" }),
    };
    for (const [nome, corpo] of Object.entries(casi)) c(`${nome}: 400`, 400, (await (b.vai("ospite", corpo))).status);
    c("nessuna di queste ha toccato Cloudflare", sessioniPrima, b.st.sessioni);
    const solo = await (b.vai("ospite", pubOspite("ospite01", { midVideo: undefined })));
    c("solo audio (niente camera): si pubblica, il nome del video resta vuoto", [200, "ospite01-a", ""], [solo.status, solo.body.audio, solo.body.video]);
  }

  /* ── 7. RINNOVA, ESCI, PULIZIA ───────────────────────────────────────── */
  gruppo("MEETLY SFU · SERVER · RINNOVA, ESCI, PULIZIA (N4)");
  {
    const b = banco();
    await conConsulente(b);
    const o = await (entra(b, "ospite01"));
    const rin = (extra = {}) => b.vai("ospite", { azione: "rinnova", codice: CODICE, pid: "ospite01", chiave: o.body.chiave, ...extra });
    b.st.t += 100_000;
    const r = await (rin());
    c("rinnova aggiorna l'orario della riga", [200, T0 + 100_000], [r.status, riga(b, "ospite01").at]);
    c("rinnova con chiave sbagliata: 403, orario invariato", [403, T0 + 100_000], [(await (rin({ chiave: "f".repeat(48) }))).status, riga(b, "ospite01").at]);
    // riga morta ma ancora lì: rinnova la riporta in vita se c'è posto
    b.st.t += 200_000;
    const viva = await (rin());
    c("rinnova su una riga scaduta ma presente la riporta in vita", [200, b.st.t], [viva.status, riga(b, "ospite01").at]);
    // riga mancante
    b.righe.delete(chiaveRiga(b, CODICE, "ospite01"));
    const man = await (rin());
    c("rinnova su una riga mancante: 409 «riga-mancante» (non è un guasto: si ripubblica)", [409, "riga-mancante"], [man.status, man.body.error]);
    // senza posto
    const b2 = banco();
    await conConsulente(b2);
    const x = await (entra(b2, "ospite01"));
    for (let i = 2; i <= 7; i++) await (entra(b2, `ospite0${i}`));
    b2.st.t += 181_000; // tutti morti
    for (let i = 2; i <= 8; i++) await (entra(b2, `ospite0${i}`)); // sei+uno vivi di nuovo, più il consulente morto
    await (entra(b2, "ospite09"));
    const pieno = await (b2.vai("ospite", { azione: "rinnova", codice: CODICE, pid: "ospite01", chiave: x.body.chiave }));
    c("rinnova di una riga morta a stanza piena: 409 «stanza-piena»", [409, "stanza-piena"], [pieno.status, pieno.body.error]);
  }
  {
    const b = banco();
    await conConsulente(b);
    const o = await (entra(b, "ospite01"));
    const sbagliato = await (b.vai("ospite", { azione: "esci", codice: CODICE, pid: "ospite01", chiave: "f".repeat(48) }));
    c("esci con chiave sbagliata: 403 e la riga resta", [403, true], [sbagliato.status, !!riga(b, "ospite01")]);
    const esce = await (b.vai("ospite", { azione: "esci", codice: CODICE, pid: "ospite01", chiave: o.body.chiave }));
    c("esci cancella la riga", [200, null], [esce.status, riga(b, "ospite01")]);
    const ancora = await (b.vai("ospite", { azione: "esci", codice: CODICE, pid: "ospite01", chiave: o.body.chiave }));
    c("uscire due volte non è un errore", 200, ancora.status);
    c("la riga _stato e le altre persone restano", [true, true], [b.righe.has(`meetly_sfu:${CODICE}:_stato`), !!riga(b, "consul01")]);
    const sc = banco({ senzaSegreti: true });
    const e = await (sc.vai("ospite", { azione: "esci", codice: CODICE, pid: "ospite01", chiave: "a".repeat(48) }));
    c("esci non dipende dai segreti", 200, e.status);
  }
  {
    const b = banco();
    await conConsulente(b);
    // una riga vecchia di 25 ore e una di un'altra stanza, ferme dal giorno prima
    b.righe.set("meetly_sfu:vecchia-stanza:ospite09", { valore: "{}", at: T0 - 25 * 3_600_000 });
    b.righe.set(`meetly_sfu:${CODICE}:ospite05`, { valore: "{}", at: T0 - 23 * 3_600_000 });
    b.righe.set("meetly_trasporto", { valore: JSON.stringify({ trasporto: "mesh" }), at: T0 - 90 * 24 * 3_600_000 });
    b.righe.set("altra_chiave", { valore: "x", at: T0 - 90 * 24 * 3_600_000 });
    await (entra(b, "ospite01"));
    c("pubblica ripulisce le righe meetly_sfu di più di 24 ore", [false, true], [b.righe.has("meetly_sfu:vecchia-stanza:ospite09"), b.righe.has(`meetly_sfu:${CODICE}:ospite05`)]);
    c("…e non tocca l'interruttore né altre chiavi", [true, true], [b.righe.has("meetly_trasporto"), b.righe.has("altra_chiave")]);
  }

  /* ── 8. CONFIG E STATO ───────────────────────────────────────────────── */
  gruppo("MEETLY SFU · SERVER · CONFIG E STATO");
  {
    const b = banco();
    const no = await (b.vai("consulente", { azione: "config", trasporto: "sfu" }));
    c("config senza il permesso di configurare: 401, niente scritto", [401, false], [no.status, b.righe.has("meetly_trasporto")]);
    const sfu = await (b.vai("consulente", { azione: "config", trasporto: "sfu" }, { puoConfigurare: true }));
    c("config sfu con i segreti: scrive l'interruttore", [200, "sfu", { trasporto: "sfu" }], [
      sfu.status,
      sfu.body.trasporto,
      JSON.parse(b.righe.get("meetly_trasporto").valore),
    ]);
    const mesh = await (b.vai("consulente", { azione: "config", trasporto: "mesh" }, { puoConfigurare: true }));
    c("config mesh", [200, "mesh"], [mesh.status, JSON.parse(b.righe.get("meetly_trasporto").valore).trasporto]);
    const strano = await (b.vai("consulente", { azione: "config", trasporto: "p2p" }, { puoConfigurare: true }));
    c("un valore strano: 400", 400, strano.status);
    const ospite = await (b.vai("ospite", { azione: "config", trasporto: "sfu" }));
    c("un ospite non configura: 401", 401, ospite.status);
    const bz = banco({ senzaSegreti: true });
    const z = await (bz.vai("consulente", { azione: "config", trasporto: "sfu" }, { puoConfigurare: true }));
    c("senza segreti «sfu» è rifiutato: 409 «non-configurato»", [409, "non-configurato", false], [z.status, z.body.error, bz.righe.has("meetly_trasporto")]);
    const zm = await (bz.vai("consulente", { azione: "config", trasporto: "mesh" }, { puoConfigurare: true }));
    c("senza segreti «mesh» si può sempre scrivere", 200, zm.status);
    // GET ?stato=1
    const s1 = await (S.statoPubblico(b.deps));
    c("stato pubblico: solo trasporto e pronto", [{ trasporto: "mesh", pronto: true }], [s1.body]);
    b.righe.set("meetly_trasporto", { valore: JSON.stringify({ trasporto: "sfu" }), at: T0 });
    c("…con l'interruttore acceso", "sfu", (await (S.statoPubblico(b.deps))).body.trasporto);
    const s2 = await (S.statoPubblico(bz.deps));
    c("…senza segreti pronto è false", [{ trasporto: "mesh", pronto: false }], [s2.body]);
    bz.righe.set("meetly_trasporto", { valore: JSON.stringify({ trasporto: "sfu" }), at: T0 });
    c("…e se l'interruttore è rimasto su sfu senza segreti, il client vede pronto=false", false, (await (S.statoPubblico(bz.deps))).body.pronto);
  }

  /* ── 9. IL CORPO DELLA RICHIESTA ─────────────────────────────────────── */
  gruppo("MEETLY SFU · SERVER · TIPO, DIMENSIONE E FORMA DEL CORPO");
  {
    const b = banco();
    const corpo = JSON.stringify({ azione: "dichiara", codice: CODICE, forzato: true });
    c("Content-Type non JSON: 415", 415, (await (b.vai("consulente", corpo, { contentType: "text/plain" }))).status);
    c("Content-Type assente: 415", 415, (await (b.vai("consulente", corpo, { contentType: null }))).status);
    c("application/json; charset=utf-8 va bene", 200, (await (b.vai("consulente", corpo, { contentType: "application/json; charset=utf-8" }))).status);
    c("form url-encoded: 415", 415, (await (b.vai("consulente", corpo, { contentType: "application/x-www-form-urlencoded" }))).status);
    const gigante = JSON.stringify({ azione: "pubblica", codice: CODICE, pid: "ospite01", offerSdp: "v=0 " + "x".repeat(R.MAX_CORPO_BYTE) });
    c("corpo oltre 96 KB: 413", 413, (await (b.vai("ospite", gigante))).status);
    c("JSON rotto: 400", 400, (await (b.vai("ospite", "{non json"))).status);
    c("un elenco al posto dell'oggetto: 400", 400, (await (b.vai("ospite", "[1,2]"))).status);
    c("null: 400", 400, (await (b.vai("ospite", "null"))).status);
    c("azione sconosciuta: 400", 400, (await (b.vai("consulente", { azione: "prova", codice: CODICE }))).status);
    c("azione assente: 400", 400, (await (b.vai("consulente", { codice: CODICE }))).status);
    c("ruolo inventato: trattato come ospite (niente poteri)", 403, (await (b.vai("amministratore", { azione: "dichiara", codice: CODICE, forzato: true }))).status);
    c("nulla di tutto questo ha toccato Cloudflare", 0, b.st.sessioni);
  }

  /* ── 10. CLOUDFLARE SPARISCE O SBAGLIA ───────────────────────────────── */
  gruppo("MEETLY SFU · SERVER · CLOUDFLARE SBAGLIA: SOLO CODICI BREVI E LOG A CONTATORE");
  {
    const b = banco();
    await conConsulente(b);
    b.st.ammessi.add("ospite01");
    const sdpLungo = [
      "v=0",
      "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
      "c=IN IP4 203.0.113.77",
      "a=candidate:1 1 udp 2113937151 192.168.1.50 54400 typ host",
      "Authorization: Bearer SEGRETO-DI-PROVA-ABCDEFGH",
      "x".repeat(400),
    ].join("\n");
    b.st.cfRotto = { stato: 500, testo: sdpLungo };
    const r = await b.vai("ospite", pubOspite("ospite01"));
    c("Cloudflare in errore: 502 «cloudflare», nient'altro al client", [502, { ok: false, error: "cloudflare" }], [r.status, r.body]);
    //  Il contatore scrive alla 1ª, 2ª, 4ª, 8ª… volta: in 16 errori di fila ne cade almeno uno.
    for (let i = 0; i < 15; i++) await b.vai("ospite", pubOspite("ospite01"));
    const registro = b.st.log.join("\n");
    c("qualcosa è stato scritto nel log (altrimenti i controlli sotto non provano niente)", true, registro.length > 0);
    c("nel log: niente righe a=/c=, Authorization, token, indirizzi", [false, false, false, false, false], [
      /(^|\s)a=/.test(registro),
      /(^|\s)c=IN/.test(registro),
      /authorization/i.test(registro),
      /SEGRETO-DI-PROVA/.test(registro),
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(registro),
    ]);
    c("…e nessun codice stanza né pid", [false, false], [registro.includes(CODICE), registro.includes("ospite01")]);
    c("…e ogni riga di log è corta (testo tagliato a 120)", true, b.st.log.every((l) => l.length <= 220));
    const prima = b.st.log.length;
    for (let i = 0; i < 40; i++) {
      b.st.t += 100;
      await (b.vai("ospite", pubOspite("ospite01")));
    }
    c("40 errori non fanno 40 righe di log (contatore)", true, b.st.log.length - prima < 10);
    c("l'errore non lascia righe mezze scritte", null, riga(b, "ospite01"));
    // tutti i codici di errore visti finora sono brevi e dell'elenco chiuso
    const codici = new Set(
      [
        await (b.vai("ospite", "{rotto")),
        await (b.vai("ospite", pubOspite("ospite01"))),
        await (b.vai("ospite", { azione: "abbonati", codice: CODICE, pid: "ospite01", chiave: "a".repeat(48), tracce: [] })),
        await (b.vai("ospite", { azione: "dichiara", codice: CODICE })),
        await (b.vai("ospite", { azione: "rinnova", codice: CODICE, pid: "ospite01", chiave: "a".repeat(48) })),
        await (b.vai("ospite", { azione: "rinegozia", codice: CODICE, pid: "ospite01", chiave: "a".repeat(48), subSessionId: "x", answerSdp: "y" })),
      ].map((x) => x.body.error),
    );
    const ammessi = ["richiesta", "codice", "pid", "sdp", "tracce", "tipo", "troppo-grande", "azione", "non-ammesso", "non-dichiarato", "escluso", "limite", "stanza-piena", "non-configurato", "cloudflare", "chiave", "sessione", "traccia", "riga-mancante", "non-abilitato", "non-autorizzato", "archivio"];
    c("i codici d'errore sono solo quelli dell'elenco", [], [...codici].filter((x) => !ammessi.includes(x)));
  }
  {
    // tempi: un errore di archivio in scrittura non diventa un «ok»
    const b = banco();
    await conConsulente(b);
    b.st.ammessi.add("ospite01");
    b.deps.archivio.scrivi = async () => "disco pieno";
    const r = await (b.vai("ospite", pubOspite("ospite01")));
    c("se la riga non si scrive la risposta non è «ok»", [500, "archivio", false], [r.status, r.body.error, r.body.ok]);
    c("…e il messaggio dell'archivio non esce", false, JSON.stringify(r.body).includes("disco"));
  }

  /* ── 11. LA STANZA È VIVA? (copia delle regole di api.presenter.session) ─ */
  gruppo("MEETLY SFU · SERVER · STANZA VIVA (battito di 70 secondi)");
  {
    const viva = (hb, live = true, code = CODICE) => JSON.stringify({ live, code, hb: new Date(hb).toISOString() });
    c("battito di 10 secondi fa: viva", true, S.sessioneViva(viva(T0 - 10_000), null, CODICE, T0));
    c("battito di 69 secondi fa: viva", true, S.sessioneViva(viva(T0 - 69_000), null, CODICE, T0));
    c("battito di 71 secondi fa: non viva", false, S.sessioneViva(viva(T0 - 71_000), null, CODICE, T0));
    c("live false: non viva", false, S.sessioneViva(viva(T0, false), null, CODICE, T0));
    c("riga assente: non viva", false, S.sessioneViva(null, null, CODICE, T0));
    c("riga illeggibile: non viva", false, S.sessioneViva("{rotto", null, CODICE, T0));
    c("formato vecchio «1» (senza battito): non viva", false, S.sessioneViva("1", null, CODICE, T0));
    c("la riga storica vale solo se parla di QUESTA stanza", [true, false], [
      S.sessioneViva(null, viva(T0), CODICE, T0),
      S.sessioneViva(null, viva(T0, true, "altra-stanza"), CODICE, T0),
    ]);
    c("la riga della stanza vince su quella storica", false, S.sessioneViva(viva(T0 - 200_000), viva(T0), CODICE, T0));
  }

  /* ── 12. IL CLIENT HTTP VERSO CLOUDFLARE ─────────────────────────────── */
  gruppo("MEETLY SFU · CLOUDFLARE · IL CLIENT HTTP");
  {
    const TOKEN = "token-finto-di-prova-0001";
    const visti = [];
    let risposta = { ok: true, status: 200, testo: "{}" };
    const finto = async (url, init) => {
      visti.push({ url: String(url), init });
      if (risposta.lancia) throw risposta.lancia;
      return { ok: risposta.ok, status: risposta.status, text: async () => risposta.testo };
    };
    const cf = CF.creaCloudflare({ appId: "app1234567890", token: TOKEN, fetch: finto });
    risposta = { ok: true, status: 200, testo: JSON.stringify({ sessionId: "sessioneNuova1" }) };
    c("nuovaSessione torna il sessionId", "sessioneNuova1", await (cf.nuovaSessione()));
    c("…POST su …/v1/apps/<appId>/sessions/new con il token Bearer", ["https://rtc.live.cloudflare.com/v1/apps/app1234567890/sessions/new", "POST", `Bearer ${TOKEN}`], [
      visti[0].url,
      visti[0].init.method,
      visti[0].init.headers.Authorization,
    ]);
    risposta = { ok: true, status: 200, testo: JSON.stringify({ sessionDescription: { type: "answer", sdp: "v=0 RISP" }, tracks: [{ mid: "0", trackName: "k1-a" }] }) };
    const loc = await (cf.tracceLocali("sess1", "v=0 OFF", [{ mid: "0", trackName: "k1-a" }, { mid: "1", trackName: "k1-v" }]));
    c("tracceLocali: risposta SDP", "v=0 RISP", loc.answerSdp);
    c("…corpo: offerta + tracce location local", [
      "https://rtc.live.cloudflare.com/v1/apps/app1234567890/sessions/sess1/tracks/new",
      { sessionDescription: { type: "offer", sdp: "v=0 OFF" }, tracks: [{ location: "local", mid: "0", trackName: "k1-a" }, { location: "local", mid: "1", trackName: "k1-v" }] },
    ], [visti[1].url, JSON.parse(visti[1].init.body)]);
    risposta = { ok: true, status: 200, testo: JSON.stringify({ requiresImmediateRenegotiation: true, sessionDescription: { type: "offer", sdp: "v=0 OFFSFU" }, tracks: [{ mid: "2", trackName: "k2-a" }, { mid: "3", trackName: "k2-v" }] }) };
    const rem = await (cf.tracceRemote("sub1", [{ sessionId: "pubK2", trackName: "k2-a" }, { sessionId: "pubK2", trackName: "k2-v" }]));
    c("tracceRemote: offerta dell'SFU, serve, mappa mid → traccia", ["v=0 OFFSFU", true, [{ mid: "2", trackName: "k2-a" }, { mid: "3", trackName: "k2-v" }]], [rem.offerSdp, rem.serve, rem.tracce]);
    c("…corpo: location remote con sessionId e trackName", { tracks: [{ location: "remote", sessionId: "pubK2", trackName: "k2-a" }, { location: "remote", sessionId: "pubK2", trackName: "k2-v" }] }, JSON.parse(visti[2].init.body));
    risposta = { ok: true, status: 200, testo: JSON.stringify({ requiresImmediateRenegotiation: false, tracks: [{ mid: "2", trackName: "k2-a" }] }) };
    const senzaOfferta = await (cf.tracceRemote("sub1", [{ sessionId: "pubK2", trackName: "k2-a" }]));
    c("senza offerta dell'SFU «serve» è false", [false, ""], [senzaOfferta.serve, senzaOfferta.offerSdp]);
    risposta = { ok: true, status: 200, testo: "{}" };
    await (cf.rinegozia("sub1", "v=0 RISPMIA"));
    c("rinegozia: PUT …/renegotiate con la risposta", ["PUT", "https://rtc.live.cloudflare.com/v1/apps/app1234567890/sessions/sub1/renegotiate", { sessionDescription: { type: "answer", sdp: "v=0 RISPMIA" } }], [
      visti[4].init.method, visti[4].url, JSON.parse(visti[4].init.body),
    ]);
    // un errore su UNA traccia, dentro una risposta 200 (la documentazione lo dice)
    risposta = { ok: true, status: 200, testo: JSON.stringify({ sessionDescription: { type: "answer", sdp: "v=0 RISP" }, tracks: [{ mid: "0", trackName: "k1-a" }, { mid: "1", trackName: "k1-v", errorCode: "invalid_track", errorDescription: "no" }] }) };
    c("errore su una traccia dentro un 200: è un errore", true, await (cf.tracceLocali("sess1", "v=0", [{ mid: "0", trackName: "k1-a" }]).then(() => false, () => true)));
    risposta = { ok: true, status: 200, testo: JSON.stringify({ sessionDescription: { type: "answer", sdp: "v=0 R" }, tracks: [{ mid: "0", trackName: "k1-a" }] }) };
    risposta = { ok: true, status: 200, testo: JSON.stringify({ tracks: [] }) };
    c("tracceLocali senza risposta SDP: errore", true, await (cf.tracceLocali("sess1", "v=0", [{ mid: "0", trackName: "k1-a" }]).then(() => false, () => true)));
    risposta = { ok: true, status: 200, testo: JSON.stringify({}) };
    c("sessions/new senza sessionId: errore", true, await (cf.nuovaSessione().then(() => false, () => true)));
    risposta = { ok: true, status: 200, testo: "<html>" };
    c("risposta non JSON: errore", true, await (cf.nuovaSessione().then(() => false, () => true)));
    // HTTP 500
    risposta = { ok: false, status: 500, testo: `{"errorDescription":"boom ${TOKEN}"}` };
    const errore = await (cf.nuovaSessione().then(() => null, (e) => e));
    c("HTTP 500: errore con lo stato", 500, errore?.stato);
    c("…il messaggio dell'errore non porta il token", false, String(errore?.message).includes(TOKEN));
    risposta = { lancia: Object.assign(new Error("rete giù"), { name: "TimeoutError" }) };
    const rete = await (cf.nuovaSessione().then(() => null, (e) => e));
    c("rete o scadenza: errore con stato 0", 0, rete?.stato);
    c("…le richieste hanno un limite di tempo", true, visti.every((v) => !!v.init.signal));
    for (const brutto of ["", "../x", "a b", "app/../../x", "x".repeat(80)]) {
      let lancio = false;
      try { CF.creaCloudflare({ appId: brutto, token: TOKEN, fetch: finto }); } catch { lancio = true; }
      c(`appId ${JSON.stringify(brutto).slice(0, 20)} non si accetta`, true, lancio);
    }
    let senzaToken = false;
    try { CF.creaCloudflare({ appId: "app1234567890", token: "", fetch: finto }); } catch { senzaToken = true; }
    c("senza token non si crea il client", true, senzaToken);
  }

  /* ── 13. SICUREZZA: IL SORGENTE ──────────────────────────────────────── */
  gruppo("MEETLY SFU · SERVER · SICUREZZA (lettura del sorgente)");
  {
    const FILE = {
      stanza: "src/shop/meetly-sfu-stanza.ts",
      cloudflare: "src/shop/meetly-sfu-cloudflare.ts",
      collante: "src/shop/meetly-sfu.server.ts",
      rotta: "src/routes/api.public.meetly-sfu.ts",
    };
    c("i quattro file ci sono", [true, true, true, true], Object.values(FILE).map((f) => existsSync(join(radice, f))));
    const src = Object.fromEntries(Object.entries(FILE).map(([k, f]) => [k, existsSync(join(radice, f)) ? leggi(f) : ""]));
    const puro = Object.fromEntries(Object.entries(src).map(([k, t]) => [k, senzaCommenti(t)]));
    c("la chiave nasce da crypto.getRandomValues, non da Math.random", [true, false], [
      puro.stanza.includes("crypto.getRandomValues"),
      /Math\.random/.test(puro.stanza + puro.cloudflare + puro.collante + puro.rotta),
    ]);
    c("confronto della chiave a tempo costante (niente === sulla chiave)", [false, true], [
      /\.chiave\s*===|===\s*[a-z.]*\.chiave\b/.test(puro.stanza),
      /function uguali/.test(puro.stanza),
    ]);
    c("nessun Access-Control-Allow-Credentials", false, /Allow-Credentials/i.test(puro.rotta + puro.collante));
    const prova1 = ["MEETLY_SFU", "PROVA"].join("_");
    const prova2 = ["x", "meetly", "prova"].join("-");
    c("nessuna modalità di prova: né variabile né intestazione", [false, false], [
      Object.values(src).some((t) => t.includes(prova1)),
      Object.values(src).some((t) => t.toLowerCase().includes(prova2)),
    ]);
    // console: nel nucleo e nel client Cloudflare non ce n'è; altrove niente di sensibile
    c("nucleo e client Cloudflare non scrivono sulla console", false, /console\./.test(puro.stanza + puro.cloudflare));
    const righeConsole = (puro.collante + "\n" + puro.rotta).split("\n").filter((l) => /console\./.test(l));
    c("sulla console (collante e rotta) niente SDP, Authorization, codice o token", [], righeConsole.filter((l) => /sdp|authorization|bearer|codice|token|chiave|segreto/i.test(l)));
    // letterali che somigliano a una chiave
    const somiglia = (t) => (t.match(/(["'`])[A-Za-z0-9_\-+/=]{32,}\1/g) || []);
    c("nessun letterale che somigli a una chiave", [], Object.values(puro).flatMap(somiglia));
    // i segreti compaiono solo come process.env.NOME
    const cartelle = ["src", "supabase"];
    const files = [];
    const cammina = (dir) => {
      for (const n of readdirSync(join(radice, dir))) {
        if (n === "node_modules") continue;
        const rel = `${dir}/${n}`;
        const s = statSync(join(radice, rel));
        if (s.isDirectory()) cammina(rel);
        else if (/\.(ts|tsx|js|mjs|json|jsonc|sql|toml)$/.test(n)) files.push(rel);
      }
    };
    for (const d of cartelle) if (existsSync(join(radice, d))) cammina(d);
    for (const f of ["wrangler.jsonc", "wrangler.deploy.jsonc"]) if (existsSync(join(radice, f))) files.push(f);
    for (const f of readdirSync(radice)) if (/^\.env/.test(f)) files.push(f);
    const fuoriPosto = [];
    let lettiDaEnv = 0;
    for (const f of files) {
      const t = senzaCommenti(leggi(f));
      for (const m of t.matchAll(/MEETLY_SFU_APP_(ID|TOKEN)/g)) {
        const prima = t.slice(Math.max(0, m.index - 12), m.index);
        if (/process\.env\.$/.test(prima)) lettiDaEnv++;
        else fuoriPosto.push(f);
      }
    }
    c("MEETLY_SFU_APP_ID/TOKEN: solo come process.env.NOME, mai altrove", [], fuoriPosto);
    c("…e il collante li legge entrambi", true, lettiDaEnv >= 2);
    c("il collante legge i segreti con process.env", [true, true], [
      /process\.env\.MEETLY_SFU_APP_ID/.test(puro.collante),
      /process\.env\.MEETLY_SFU_APP_TOKEN/.test(puro.collante),
    ]);
    // la rotta è sottile e non decide da sé
    c("la rotta passa dal nucleo e non apre il database da sola", [true, false], [
      /trattaSfu/.test(puro.rotta),
      /supabaseAdmin/.test(puro.rotta),
    ]);
    c("la rotta riconosce il consulente da sessione o CRM (agenda) e configura con «consulenti»", [true, true, true, true], [
      /sessioneDaRichiesta/.test(puro.rotta),
      /chiamanteCRM/.test(puro.rotta),
      /"agenda"/.test(puro.rotta),
      /"consulenti"/.test(puro.rotta),
    ]);
    c("la rotta rifiuta i corpi enormi prima di leggerli", true, /content-length/i.test(puro.rotta));
    c("la rotta risponde sempre senza cache", true, /no-store/.test(puro.rotta));
    c("il nucleo non importa niente di server (gira anche nel banco di collaudo)", false, /client\.server|supabase|api\./.test(puro.stanza.replace(/\/\/.*$/gm, "").split("\n").filter((l) => /^\s*import /.test(l)).join("\n")));
    c("il client Cloudflare non importa niente di server", false, /^\s*import .*(server|supabase|routes)/m.test(puro.cloudflare));
    c("la chiave Cloudflare usa solo il token ricevuto, mai un URL diverso da rtc.live.cloudflare.com", true, /https:\/\/rtc\.live\.cloudflare\.com\/v1/.test(puro.cloudflare));
  }
}
