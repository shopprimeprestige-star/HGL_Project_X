/** ── PROVE: MEETLY «OFFERTE SENZA RISPOSTA» (consulenza del 10/11/2026, ore 17:07) ──
 *  Dati veri (scatola nera, sola lettura): il consulente (mesh, ice «new», tracce locali 1+1, remote 0)
 *  ha 53 e poi 75 offerte inviate, 0 ricevute, 0 risposte; nessun rapporto dell'ospite.
 *  Regole in src/shop/scheda-ferma.ts; innesti in src/shop/call.tsx e src/shop/scatola-nera*.ts.
 *
 *  Cosa si prova, e cosa NO:
 *   · SÌ: `maybeInitiate` rimandava la stessa offerta a OGNI saluto dell'ospite, senza nessun
 *     limite di cadenza né alcuna traccia di quando era partita l'ultima. Con 53 saluti in 15 s
 *     (la raffica letta nei dati, se è davvero una raffica) uscivano 53 offerte uguali.
 *   · SÌ: la scatola nera non permetteva di distinguere «raffica» da «tre minuti di saluti ogni 3 s»,
 *     né di sapere se il consulente stava offrendo PRIMA che la chiamata fosse partita, né se il
 *     canale di segnalazione dell'altro lato era davvero agganciato.
 *   · NO: perché l'ospite non rispondesse. Dal codice non è dimostrabile (vedi LAVAGNA).
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveMeetlyOfferte(mod, { c, gruppo, radice }) {
  const M = mod["shop/scheda-ferma"];
  const S = mod["shop/scatola-nera"];
  const B = mod["shop/scatola-nera-browser"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const nudo = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const corpoDi = (testo, firma) => {
    const i = testo.indexOf(firma);
    if (i < 0) return "";
    const a = testo.indexOf("{", testo.indexOf(")", i + firma.length));
    let n = 0;
    for (let k = a; k < testo.length; k++) {
      if (testo[k] === "{") n++;
      else if (testo[k] === "}" && --n === 0) return testo.slice(a, k + 1);
    }
    return "";
  };
  const call = nudo(leggi("src/shop/call.tsx"));

  gruppo("MEETLY OFFERTE · LA STESSA OFFERTA NON SI RIMANDA A RAFFICA");
  c("la regola esiste ed è esportata", "function", typeof M.puoRimandareOfferta);
  //  Simulazione di `maybeInitiate`: ogni saluto dell'ospite è un'occasione per rimandare l'offerta ancora senza risposta.
  const simula = (salutiAlSecondo, secondi, regola = (a) => M.puoRimandareOfferta(a)) => {
    let ultimo; // istante dell'ultimo invio (la prima offerta parte al primo saluto)
    let inviate = 0;
    const passo = 1000 / salutiAlSecondo;
    for (let t = 0; t <= secondi * 1000; t += passo) {
      if (inviate === 0 || regola({ ultimoInvio: ultimo, adesso: t })) {
        inviate++;
        ultimo = t;
      }
    }
    return inviate;
  };
  c("PRIMA (rinvio a ogni saluto): 53 saluti in 15 s = 53 offerte identiche, come nei dati veri", 54, simula(53 / 15, 15, () => true));
  const raffica = simula(53 / 15, 15);
  c("RAFFICA dei dati veri: 53 saluti in 15 s non fanno più 53 offerte (al massimo una ogni 2,5 s)", true, raffica <= 7 && raffica >= 1);
  c("…e il tetto vale anche per una raffica più fitta (75 saluti in 15 s)", true, simula(75 / 15, 15) <= 7);
  c("cadenza normale (un saluto ogni 3 s): ogni saluto rimanda, come prima", 6, simula(1 / 3, 15));
  c("la prima offerta parte sempre (nessun invio precedente)", true, M.puoRimandareOfferta({ ultimoInvio: undefined, adesso: 0 }));
  c("a ridosso dell'ultimo invio non si rimanda", false, M.puoRimandareOfferta({ ultimoInvio: 1000, adesso: 1200 }));
  c("passato l'intervallo si rimanda", true, M.puoRimandareOfferta({ ultimoInvio: 1000, adesso: 1000 + M.RIMANDA_OFFERTA_OGNI_MS }));
  c("l'orologio che torna indietro non blocca le offerte per sempre", true, M.puoRimandareOfferta({ ultimoInvio: 5000, adesso: 100 }));
  c("l'intervallo sta sotto il battito dei saluti (3 s): la cadenza normale non cambia", true, M.RIMANDA_OFFERTA_OGNI_MS < 3000);

  gruppo("MEETLY OFFERTE · GLI INNESTI IN CALL.TSX");
  c("importa la regola", true, /puoRimandareOfferta/.test(call.slice(0, call.indexOf("const S = {"))));
  const mi = corpoDi(call, "async function maybeInitiate(");
  c("maybeInitiate: il rinvio passa dalla regola", true, /puoRimandareOfferta\(\{\s*ultimoInvio:\s*offertaInviataIl\.get\(pid\)/.test(mi));
  c("maybeInitiate: ogni offerta (prima e rinvio) ricorda quando è partita", 2, (mi.match(/offertaInviataIl\.set\(pid,/g) || []).length);
  c("maybeInitiate: la guardia «solo se l'answer non è arrivato» c'è ancora", true, /!p\.currentRemoteDescription/.test(mi));
  c("maybeInitiate: il consulente fermo e il ramo SFU sono rimasti dove erano", true, /haSensoChiamare\(hostInChiamata\.get\(pid\)\)/.test(mi) && /trasportoSfu\(\)/.test(mi));
  for (const f of ["function removePeer(", "function resetRoster(", "function teardownMedia("])
    c(`${f.replace("function ", "").replace("(", "")}: dimentica l'ora dell'ultima offerta`, true, /offertaInviataIl\.(delete\(pid\)|clear\(\))/.test(corpoDi(call, f)));

  gruppo("MEETLY OFFERTE · LA SCATOLA NERA DICE QUELLO CHE MANCAVA");
  const base = {
    v: 1, rid: "abc123def456", tipo: "blocco", ruolo: "consulente", browser: "Chrome 156", sistema: "macOS",
    rete: { tipo: "", effettiva: "4g" }, hasTurn: true,
    stati: { signaling: "have-local-offer", ice: "new", connessione: "new", raccolta: "complete" },
    locali: [], remoti: [], coppia: null,
    segnali: { offerteInviate: 53, offerteRicevute: 0, risposteInviate: 0, risposteRicevute: 0, iceInviati: 0, iceRicevuti: 0, offerteScartate: 0 },
    permessi: { camera: "concesso", microfono: "concesso" }, erroreMedia: "",
    tracce: { locali: { video: 1, audio: 1 }, remote: { video: 0, audio: 0, vive: 0 } },
    incontroMs: 15000, collegatoMs: null,
  };
  const con = (extra = {}, seg = {}) => S.pulisciRapporto({ ...base, ...extra, segnali: { ...base.segnali, ...seg } });
  c("un rapporto vecchio (senza i campi nuovi) vale zero e canale ignoto", [0, 0, ""], [con().segnali.helloRicevuti, con().segnali.offerteFuoriChiamata, con().canale]);
  c("i due contatori nuovi passano, con il tetto dei numeri", [40, 7], [con({}, { helloRicevuti: 40, offerteFuoriChiamata: 7 }).segnali.helloRicevuti, con({}, { helloRicevuti: 40, offerteFuoriChiamata: 7 }).segnali.offerteFuoriChiamata]);
  c("…e non sono negativi né testo", [0, 0], [con({}, { helloRicevuti: -3, offerteFuoriChiamata: "x" }).segnali.helloRicevuti, con({}, { helloRicevuti: -3, offerteFuoriChiamata: "x" }).segnali.offerteFuoriChiamata]);
  c("il canale: solo i quattro stati di Supabase", ["SUBSCRIBED", "TIMED_OUT", "CHANNEL_ERROR", "CLOSED"], ["SUBSCRIBED", "TIMED_OUT", "CHANNEL_ERROR", "CLOSED"].map((s) => con({ canale: s }).canale));
  c("…un testo libero (nomi, indirizzi) non esce", "", con({ canale: "Mario Rossi 203.0.113.5" }).canale);
  c("la frase di diagnosi non cambia per i campi nuovi", S.diagnosi(S.pulisciRapporto(base)).frase, S.diagnosi(con({ canale: "SUBSCRIBED" }, { helloRicevuti: 9 })).frase);

  //  Il browser conta davvero (finto browser, timer dei 15 s accelerato).
  const fin = { navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"), fetch: globalThis.fetch, setTimeout: globalThis.setTimeout };
  const inviati = [];
  const pc = { signalingState: "have-local-offer", iceConnectionState: "new", connectionState: "new", iceGatheringState: "complete", getStats: async () => new Map() };
  let attiva = false;
  const dip = () => ({
    stanza: () => "kfr-mbqd-tzp", ruolo: () => "consulente", iceServers: () => [{ urls: ["turn:t.example:3478"] }],
    peer: () => pc, remoto: () => undefined, locale: () => null, mediaVivo: () => false,
    trasporto: () => "mesh", ripiego: () => "", videochiamataAttiva: () => attiva,
  });
  const aspetta = (ms) => new Promise((ok) => fin.setTimeout(ok, ms));
  try {
    Object.defineProperty(globalThis, "navigator", { value: { userAgent: "x" }, configurable: true });
    globalThis.fetch = async (u, o) => (inviati.push(JSON.parse(o.body)), { ok: true });
    globalThis.setTimeout = (f, ms, ...a) => fin.setTimeout(f, ms >= S.ATTESA_MS ? 5 : ms, ...a);
    const sc = B.creaScatola(dip());
    sc.canale("TIMED_OUT");
    sc.incontro("p1");
    for (let i = 0; i < 4; i++) sc.hello("p1");
    sc.segnale("p1", "offer", true); // la chiamata non è ancora partita: offerta fuori chiamata
    sc.segnale("p1", "offer", true);
    attiva = true;
    sc.segnale("p1", "offer", true); // chiamata partita
    sc.segnale("p1", "offer", false); // un'offerta ricevuta non è un'offerta uscita fuori chiamata
    sc.hello("mai-incontrato"); // un pid mai incontrato non rompe niente
    await aspetta(120);
    sc.chiudiTutto();
    const r = inviati[0]?.rapporto;
    c("il rapporto porta i saluti ricevuti", 4, r?.segnali?.helloRicevuti);
    c("…le offerte uscite PRIMA che la chiamata partisse", 2, r?.segnali?.offerteFuoriChiamata);
    c("…il totale delle offerte inviate resta quello di sempre", 3, r?.segnali?.offerteInviate);
    c("…e lo stato del canale di segnalazione", "TIMED_OUT", r?.canale);
  } finally {
    if (fin.navigator) Object.defineProperty(globalThis, "navigator", fin.navigator);
    globalThis.fetch = fin.fetch;
    globalThis.setTimeout = fin.setTimeout;
  }

  const sn = leggi("src/shop/scatola-nera-browser.ts");
  c("scatola browser: ha i ganci hello e canale", true, /\bhello\(pid: string\)/.test(sn) && /\bcanale\(stato: string\)/.test(sn));
  const hello = call.slice(call.indexOf('event: "hello"'), call.indexOf('event: "bye"'));
  c("call.tsx: il gestore hello conta il saluto ricevuto", true, /scatola\.hello\(pid\)/.test(hello));
  const sub = call.slice(call.indexOf("ch.subscribe((st)"), call.indexOf("ch.subscribe((st)") + 400);
  c("call.tsx: lo stato della sottoscrizione si registra PRIMA di scartare quelli diversi da SUBSCRIBED", true, sub.indexOf("scatola.canale(st)") > 0 && sub.indexOf("scatola.canale(st)") < sub.indexOf('!== "SUBSCRIBED"'));

  gruppo("MEETLY OFFERTE · LA SENTINELLA: SALUTI PER CHIAMANTE, RIMOZIONI PER MOTIVO, RAPPORTO SENZA INCONTRO");
  c("saluti a raffica: più di 20 in 10 s", [false, true], [S.salutiARaffica(Array.from({ length: 20 }, (_, i) => i * 100), 2000), S.salutiARaffica(Array.from({ length: 21 }, (_, i) => i * 100), 2100)]);
  c("il battito normale (uno ogni 3 s) non è una raffica", false, S.salutiARaffica([0, 3000, 6000, 9000, 12000], 12000));
  c("i saluti vecchi di più di 10 s non contano", false, S.salutiARaffica(Array.from({ length: 30 }, (_, i) => i), 20000));
  const motivi = {
    "dedupe-dev": "dedupe-dev", "dedupe-host": "dedupe-host", "roster-autorevole": "roster-autorevole", "self-in-roster": "roster-autorevole",
    bye: "bye", "host-fantasma>15s": "host-fantasma", "non saluta più da 31s": "non-saluta", "no-hello": "non-saluta",
    "presentatore-uscito(no-hello>10s + pc closed)": "presentatore-uscito", blocked: "blocked",
    "media aperti dopo la connessione": "media-dopo-connessione", "purge-manuale": "pulizia", "Mario Rossi 203.0.113.5": "altro", [undefined]: "altro",
  };
  c("ogni motivo di removePeer finisce in una voce dell'elenco chiuso", Object.values(motivi), Object.keys(motivi).map((k) => S.motivoRimozione(k === "undefined" ? undefined : k)));
  const base2 = { ...base, ruolo: "ospite", sentinella: true, canale: "SUBSCRIBED" };
  const sen = (extra) => S.pulisciRapporto({ ...base2, ...extra });
  c("un rapporto vecchio vale: non sentinella, tutti i contatori a zero, nessun errore di render", [false, 0, 0, ""], (() => { const r = S.pulisciRapporto({ ...base, canale: undefined }); return [r.sentinella, Object.values(r.chiamanti).reduce((a, b) => a + b, 0), Object.values(r.rimossi).reduce((a, b) => a + b, 0), r.erroreRender]; })());
  c("la sentinella passa e resta tipo «blocco» (il CHECK della tabella non cambia)", ["blocco", true], [sen({}).tipo, sen({}).sentinella]);
  c("i contatori passano solo per le voci dell'elenco chiuso", [7, 3, undefined], [sen({ chiamanti: { velo: 7, "Mario Rossi": 99 } }).chiamanti.velo, sen({ rimossi: { "dedupe-dev": 3 } }).rimossi["dedupe-dev"], sen({ chiamanti: { "Mario Rossi": 99 } }).chiamanti["Mario Rossi"]]);
  c("…con tetto e senza negativi", [100000, 0], [sen({ chiamanti: { velo: 1e9 } }).chiamanti.velo, sen({ chiamanti: { velo: -5 } }).chiamanti.velo]);
  c("l'errore di render: solo il nome, mai il testo", ["TypeError", ""], [sen({ erroreRender: "TypeError" }).erroreRender, sen({ erroreRender: "TypeError: Cannot read mario.rossi@x.it" }).erroreRender]);
  c("la frase di diagnosi della sentinella dice raffica e quanti saluti", "L'ospite manda saluti a raffica (30 registrati)", S.diagnosi(sen({ chiamanti: { velo: 10, canale: 20 } })).frase);
  c("…e un rapporto normale NON è letto come sentinella", false, /raffica/.test(S.diagnosi(S.pulisciRapporto(base)).frase));
  c("pulisciRapporto resta sotto il limite di byte con tutto pieno", true, JSON.stringify(sen({ chiamanti: Object.fromEntries(S.CHIAMANTI.map((k) => [k, 99999])), rimossi: Object.fromEntries(S.RIMOZIONI.map((k) => [k, 99999])) })).length < S.LIMITE_BYTE);

  //  Il browser: il ciclo vero, con ora e timer finti.
  const fin2 = { navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"), fetch: globalThis.fetch };
  const spediti = [];
  let t0 = 1_000_000;
  const dip2 = (ruolo) => ({
    stanza: () => "kfr-mbqd-tzp", ruolo: () => ruolo, iceServers: () => [], peer: () => undefined, remoto: () => undefined,
    locale: () => null, mediaVivo: () => false, trasporto: () => "mesh", ripiego: () => "", adesso: () => t0,
  });
  const attendi = (ms) => new Promise((ok) => setTimeout(ok, ms));
  try {
    Object.defineProperty(globalThis, "navigator", { value: { userAgent: "x" }, configurable: true });
    globalThis.fetch = async (u, o) => (spediti.push(JSON.parse(o.body)), { ok: true });
    const g = B.creaScatola(dip2("ospite"));
    g.canale("SUBSCRIBED");
    g.erroreDiRender("TypeError");
    for (let i = 0; i < 12; i++) { g.salutoInviato("velo"); t0 += 100; }
    for (let i = 0; i < 8; i++) { g.salutoInviato("errore-render"); t0 += 100; }
    await attendi(20);
    c("20 saluti in 2 s NON bastano: nessuna sentinella", 0, spediti.length);
    g.rimosso("host-fantasma>15s");
    g.rimosso("dedupe-dev");
    g.rimosso("dedupe-dev");
    g.chiudiTutto(); // un azzeramento: anche questo si conta
    g.salutoInviato("canale"); // il 21esimo: da qui parte la sentinella, con tutto quello contato fin qui
    await attendi(20);
    c("21 saluti in 10 s, senza nessun incontro: parte la sentinella", 1, spediti.length);
    const r = spediti[0]?.rapporto;
    c("…è un «blocco» con il campo che la distingue", ["blocco", true, "ospite"], [r?.tipo, r?.sentinella, r?.ruolo]);
    c("…porta i saluti per chiamante", [12, 8, 1, 0], [r?.chiamanti?.velo, r?.chiamanti?.["errore-render"], r?.chiamanti?.canale, r?.chiamanti?.battito]);
    c("…le rimozioni per motivo (compreso l'azzeramento)", [1, 2], [r?.rimossi?.["host-fantasma"], r?.rimossi?.["dedupe-dev"]]);
    c("…e l'azzeramento di chiudiTutto", 1, r?.rimossi?.azzeramento);
    c("…lo stato del canale e il nome dell'ultimo errore di render", ["SUBSCRIBED", "TypeError"], [r?.canale, r?.erroreRender]);
    c("…senza incontro: nessun interlocutore descritto", [0, 0], [r?.incontroMs, r?.segnali?.offerteInviate]);
    c("…e nessun dato personale: solo campi dell'elenco", true, JSON.stringify(r) === JSON.stringify(S.pulisciRapporto(r)));
    for (let i = 0; i < 60; i++) { g.salutoInviato("battito"); t0 += 10; }
    await attendi(20);
    c("UNA volta sola per collegamento, anche se la raffica continua", 1, spediti.length);
    const cons = B.creaScatola(dip2("consulente"));
    for (let i = 0; i < 60; i++) { cons.salutoInviato("battito"); t0 += 10; }
    await attendi(20);
    c("il consulente non manda sentinelle (è un rapporto dell'ospite)", 1, spediti.length);
    const lento = B.creaScatola(dip2("ospite"));
    for (let i = 0; i < 40; i++) { lento.salutoInviato("battito"); t0 += 3000; }
    await attendi(20);
    c("un battito normale per due minuti non fa partire niente", 1, spediti.length);
    const rotto = B.creaScatola({ ...dip2("ospite"), stanza: () => { throw new Error("rotta"); } });
    for (let i = 0; i < 30; i++) rotto.salutoInviato("velo");
    c("un gancio che lancia non rompe la chiamata", true, true);
    await attendi(20);
  } finally {
    if (fin2.navigator) Object.defineProperty(globalThis, "navigator", fin2.navigator);
    globalThis.fetch = fin2.fetch;
  }

  gruppo("MEETLY OFFERTE · LA SENTINELLA: GLI INNESTI IN CALL.TSX");
  const sh = corpoDi(call, "function sendHello(");
  c("sendHello conta il saluto per chiamante, PRIMA di spedirlo", true, /scatola\.salutoInviato\(chi\)/.test(sh) && sh.indexOf("scatola.salutoInviato(chi)") < sh.indexOf('send("hello"'));
  c("sendHello: il chiamante di default è «altro»", true, /function sendHello\(req = false, chi = "altro"\)/.test(call));
  for (const [chi, re] of [
    ["battito", /sendHello\(false, "battito"\)/], ["presenza", /sendHello\(false, "presenza"\)/], ["risposta", /sendHello\(false, "risposta"\)/],
    ["canale", /sendHello\(true, "canale"\)/], ["velo", /sendHello\(true, "velo"\)/], ["errore-render", /sendHello\(true, "errore-render"\)/], ["media", /sendHello\(true, "media"\)/],
  ])
    c(`call.tsx: il chiamante «${chi}» è dichiarato`, true, re.test(call));
  c("il Worker e il suo ripiego passano da «battito»", 2, (call.match(/sendHello\(false, "battito"\)/g) || []).length);
  c("removePeer conta il motivo", true, /scatola\.rimosso\(why\)/.test(corpoDi(call, "function removePeer(")));
  c("l'errore di render registra il NOME, prima del ritorno per il presentatore", true, call.indexOf("scatola.erroreDiRender(err?.name") > 0 && call.indexOf("scatola.erroreDiRender(err?.name") < call.indexOf("if (!isGuest()) return;"));
}
