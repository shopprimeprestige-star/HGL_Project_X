/** ── PROVE: MEETLY, LE RIFINITURE DEL TERZO GIRO (10/11/2026) ──────────────────
 *  Cinque note non bloccanti rimaste dopo i primi due giri (commessa
 *  2026-11-10-meetly-avvio-bloccato). Regole in src/shop/scheda-ferma.ts; innesti
 *  in src/shop/call.tsx, src/shop/scatola-nera-browser.ts, src/routes/api.presenter.session.ts.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveMeetlyRifiniture(mod, { c, gruppo, radice }) {
  const M = mod["shop/scheda-ferma"];
  const B = mod["shop/scatola-nera-browser"];
  const SN = mod["shop/scatola-nera"];
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
  const srv = nudo(leggi("src/routes/api.presenter.session.ts"));

  gruppo("MEETLY RIFINITURE · 1 · IL BATTITO HTTP VA SUL WORKER, NON SOLO SUL TIMER DEL THREAD PRINCIPALE");
  const av = corpoDi(call, "function avviaBattito(");
  c("il Worker, oltre a sendHello, fa battere anche il server (pushHeartbeat)", true,
    /w\.onmessage = [^;]*pushHeartbeat\(/.test(av) || /onmessage[\s\S]{0,300}pushHeartbeat\(/.test(av));
  c("il Worker non fa battere il server a ogni tick di hello: ogni N tick", true,
    typeof M.OGNI_TICK_BATTITO_HTTP === "number" && M.OGNI_TICK_BATTITO_HTTP >= 1 && M.OGNI_TICK_BATTITO_HTTP <= 3);
  c("…e il ritmo vero (tick da 3 s) sta ben dentro la tenuta di 24 s: almeno 3 battiti", true,
    3000 * M.OGNI_TICK_BATTITO_HTTP * 3 <= M.TENUTA_ALTRA_SCHEDA_MS);
  c("il vecchio timer da 8 s batte solo se il Worker non c'è (ripiego), niente doppioni", true,
    /setInterval\(\(\) => \{?\s*if \(!battitoWorker\) pushHeartbeat\(\)/.test(call) || /if \(!battitoWorker\) pushHeartbeat\(\)/.test(call));
  c("lo scatto su visibilitychange resta", true, /visibilityState === "visible"\) pushHeartbeat\(\)/.test(call));

  gruppo("MEETLY RIFINITURE · 2 · schedaChiamata E chiamataAt NON ESCONO DAL SERVER");
  const sess = { live: true, code: "abc", presenterId: "p", presenterName: "N", startedAt: null, hb: "h", inChiamata: true, schedaChiamata: "uuid-x", chiamataAt: "2026-11-10T10:00:00.000Z" };
  const fuori = M.senzaCampiInterni(sess);
  c("i due campi interni sono tolti", [false, false], ["schedaChiamata" in fuori, "chiamataAt" in fuori]);
  c("tutto il resto resta uguale", { live: true, code: "abc", presenterId: "p", presenterName: "N", startedAt: null, hb: "h", inChiamata: true }, fuori);
  c("l'oggetto di partenza non si tocca (serve alla logica)", "uuid-x", sess.schedaChiamata);
  c("il server passa dalla funzione in GET e nelle due risposte del battito e in quella finale", true,
    (srv.match(/senzaCampiInterni\(/g) || []).length >= 4);
  c("nessuna risposta fa più `...cur`, `...next` o `...sess` a nudo", 0,
    (srv.match(/json\(\{ ok: true, \.\.\.(cur|next|sess)\b/g) || []).length + (srv.match(/json\(\{ \.\.\.sess,/g) || []).length);

  gruppo("MEETLY RIFINITURE · 3 · USCIRE DALLA VIDEOCHIAMATA AZZERA LA TENUTA DEL «IN CHIAMATA»");
  const setC = corpoDi(call, "function set(");
  c("set(): se la scheda passa da attiva a non attiva la tenuta si azzera", true,
    /p\.active === false && S\.active/.test(setC) && /inChiamataTenutoFinoA = 0/.test(setC));
  c("…e la variabile è dichiarata PRIMA di set() (niente zona morta all'avvio)", true,
    call.search(/let inChiamataTenutoFinoA\b/) > 0 && call.search(/let inChiamataTenutoFinoA\b/) < call.indexOf("function set(p: Partial<State>)"));
  c("la ripresa dopo la ricarica continua ad aprirla (riprendiConsulenzaAperta)", true,
    /inChiamataTenutoFinoA = Date\.now\(\) \+ TIENI_IN_CHIAMATA_MS/.test(corpoDi(call, "async function riprendiConsulenzaAperta(")));

  gruppo("MEETLY RIFINITURE · 4 · LA SCATOLA NERA NON CONTA I «SOLO CONTENUTI»");
  const R = M.chiamataAttivaPerRapporto;
  c("consulente: conta solo la sua chiamata", [true, false], [
    R({ ruolo: "host", miaAttiva: true, hostInChiamata: undefined }),
    R({ ruolo: "host", miaAttiva: false, hostInChiamata: undefined }),
  ]);
  c("ospite: il consulente gli ha detto active", true, R({ ruolo: "viewer", miaAttiva: true, hostInChiamata: undefined }));
  c("ospite: act:true nel saluto", true, R({ ruolo: "viewer", miaAttiva: false, hostInChiamata: true }));
  c("ospite con il consulente fuori videochiamata: no", false, R({ ruolo: "viewer", miaAttiva: false, hostInChiamata: false }));
  c("ospite, consulente di una pagina vecchia (non si sa) e nessun active: no", false, R({ ruolo: "viewer", miaAttiva: false, hostInChiamata: undefined }));

  const fin = { navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"), fetch: globalThis.fetch, setTimeout: globalThis.setTimeout };
  const inviati = [];
  const pc = { signalingState: "stable", iceConnectionState: "new", connectionState: "new", iceGatheringState: "new", getStats: async () => new Map() };
  const dip = (extra = {}) => ({
    stanza: () => "kfr-mbqd-tzp", ruolo: () => "consulente", iceServers: () => [], peer: () => pc, remoto: () => undefined,
    locale: () => null, mediaVivo: () => false, trasporto: () => "mesh", ripiego: () => "", ...extra,
  });
  const aspetta = (ms) => new Promise((ok) => fin.setTimeout(ok, ms));
  try {
    Object.defineProperty(globalThis, "navigator", { value: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/156.0 Safari/537.36" }, configurable: true });
    globalThis.fetch = async (u, o) => (inviati.push(JSON.parse(o.body)), { ok: true });
    //  I 15 s diventano 20 ms (e `setTimeout` accorciato solo per i 15 s).
    globalThis.setTimeout = (f, ms, ...a) => fin.setTimeout(f, ms >= SN.ATTESA_MS ? 20 : ms, ...a);

    //  a) compatibilità: senza il nuovo gancio il rapporto parte come prima
    const a = B.creaScatola(dip());
    a.incontro("p1");
    await aspetta(120);
    c("compatibilità: senza il gancio (come prima) il blocco parte", 1, inviati.length);
    a.chiudiTutto();

    //  b) fuori videochiamata: nessun rapporto, anche dopo molti giri
    let attiva = false;
    inviati.length = 0;
    const b = B.creaScatola(dip({ videochiamataAttiva: () => attiva }));
    b.incontro("p2");
    await aspetta(150);
    c("solo contenuti: dopo i 15 s NON parte nessun rapporto", 0, inviati.length);

    //  c) la videochiamata parte dopo: il rapporto non è prematuro (altri 15 s dal primo controllo che la vede)
    attiva = true;
    await aspetta(10);
    c("appena la chiamata è attiva non parte subito (mai prima di 15 s di chiamata)", 0, inviati.length);
    await aspetta(120);
    c("…ma se i media non arrivano, dopo i 15 s di chiamata il blocco parte", 1, inviati.length);
    c("…ed è un normale rapporto di blocco (v1, tipo blocco)", [1, "blocco"], [inviati[0]?.rapporto?.v, inviati[0]?.rapporto?.tipo]);
    b.chiudiTutto();

    //  d) videochiamata attiva fin dall'incontro: come prima, un solo giro da 15 s
    inviati.length = 0;
    const d = B.creaScatola(dip({ videochiamataAttiva: () => true }));
    d.incontro("p3");
    await aspetta(60);
    c("videochiamata attiva dall'incontro: il blocco parte ai 15 s, senza giri in più", 1, inviati.length);
    d.chiudiTutto();

    //  e) chiudi() ferma anche i controlli rimandati
    inviati.length = 0;
    attiva = false;
    const e = B.creaScatola(dip({ videochiamataAttiva: () => attiva }));
    e.incontro("p4");
    await aspetta(50);
    e.chiudi("p4");
    attiva = true;
    await aspetta(150);
    c("chiudi(): niente rapporto dopo l'uscita dell'interlocutore", 0, inviati.length);
    e.chiudiTutto();

    //  f) il gancio che lancia non rompe niente e non manda niente
    inviati.length = 0;
    const f = B.creaScatola(dip({ videochiamataAttiva: () => { throw new Error("rotto"); } }));
    f.incontro("p5");
    await aspetta(80);
    c("gancio rotto: nessun rapporto, nessun errore", 0, inviati.length);
    f.chiudiTutto();
  } finally {
    if (fin.navigator) Object.defineProperty(globalThis, "navigator", fin.navigator);
    globalThis.fetch = fin.fetch;
    globalThis.setTimeout = fin.setTimeout;
  }
  const dc = call.slice(call.indexOf("const scatola = creaScatola("), call.indexOf("const scatola = creaScatola(") + 900);
  c("call.tsx: la scatola riceve il gancio, che passa dalla regola con ruolo, S.active e hostInChiamata", true,
    /videochiamataAttiva: \(pid\) =>[\s\S]{0,200}chiamataAttivaPerRapporto\(/.test(dc) && /hostInChiamata\.get\(pid\)/.test(dc));

  gruppo("MEETLY RIFINITURE · 5 · IL «SÌ» DI inChiamata VALE PER LA TENUTA SOLO SE VIENE DAL PRESENTATORE");
  const S5 = M.schedaDelSi;
  c("un «sì» col cookie del presentatore: la scheda conta (può essere tenuta)", "A", S5({ scheda: "A", dichiarato: true, autenticato: true }));
  c("un «sì» senza cookie (estraneo, link del collega, pagina scaduta): scrive «sì» ma SENZA scheda, quindi non si tiene", "", S5({ scheda: "x", dichiarato: true, autenticato: false }));
  c("un «no» non cambia: la scheda resta (non dà nessun potere in più)", "B", S5({ scheda: "B", dichiarato: false, autenticato: false }));
  c("scheda assente: stringa vuota", "", S5({ scheda: "", dichiarato: true, autenticato: true }));
  //  l'effetto sul server: un «sì» estraneo non resiste al «no» del consulente (come prima delle tenute)
  const T0 = Date.parse("2026-11-10T10:00:00.000Z");
  const dopoEstraneo = M.inChiamataDelBattito({ corrente: { inChiamata: false }, dichiarato: true, scheda: S5({ scheda: "x", dichiarato: true, autenticato: false }), adesso: T0 });
  c("il «sì» dell'estraneo è registrato senza scheda", "", dopoEstraneo.schedaChiamata);
  c("…e il primo «no» del consulente lo cancella", false,
    M.inChiamataDelBattito({ corrente: dopoEstraneo, dichiarato: false, scheda: "CONSULENTE", adesso: T0 + 8000 }).inChiamata);
  const hb = srv.slice(srv.indexOf("if (body.hbOnly)"), srv.indexOf("const live = !!body.live"));
  c("il server controlla il cookie (sessioneDaRichiesta) nel ramo del battito, solo per il «sì»", true,
    /sessioneDaRichiesta\(request\)/.test(hb) && /schedaDelSi\(/.test(hb) && /body\.inChiamata/.test(hb));
  c("…e se il controllo del cookie fallisce non si rompe il battito (try/catch)", true, /try\s*\{[\s\S]*sessioneDaRichiesta\(request\)[\s\S]*\}\s*catch/.test(hb));
  c("il battito (hb) si aggiorna comunque, con o senza cookie", true, /hb: new Date\(\)\.toISOString\(\)/.test(hb));
}
