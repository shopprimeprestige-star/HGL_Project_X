/** ── SHOP R1 · T30 · «TRACCIAMENTO» NELLE IMPOSTAZIONI: SALUTE, PROPRIETARIO, ID DI GOOGLE ─────
 *  `src/crm/tracciamento/{regole,salute.server}.ts`, `src/routes/api.crm.tracciamento.ts` e il pannello.
 *  Database e guardia FINTI, nessuna rete. Token, codici di prova e indirizzi IP sono INVENTATI e si cercano in ogni risposta:
 *  non devono esserci mai. Cosa deve valere:
 *   · permesso «impostazioni» su OGNI chiamata, prima di leggere qualunque cosa;
 *   · se S3 manca: «non ancora attivo», nessun errore;
 *   · il proprietario del tracciamento: nessuno / questo account / un altro (mai l'id di nessuno nella risposta);
 *   · lo stato degli invii da `tracciamento_esiti`, solo come CODICI;
 *   · gli ID di Google si accettano solo nel formato giusto, altrimenti una frase che dice cosa fare;
 *   · mai un token a schermo, in nessuna colonna richiesta e in nessuna risposta. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TOKEN = "TOKEN-FINTO-SEGRETISSIMO-123";
const CODICE_PROVA = "TESTCODEFINTO999";
const UTENTE = "11111111-1111-4111-8111-111111111111";
const ALTRO = "22222222-2222-4222-8222-222222222222";
const T0 = new Date("2026-11-20T12:00:00Z");
const ISO = (minutiFa) => new Date(T0.getTime() - minutiFa * 60_000).toISOString();
const RIGA = { user_id: UTENTE, meta_pixel_id: "123456789012345", tiktok_pixel_id: "C1ABCDEF2GHIJKL3MNOP", google_ga4_id: "G-TEST1234", google_ads_id: "AW-12345678", meta_test_event_code: null, tiktok_test_event_code: null, meta_access_token: TOKEN, tiktok_access_token: TOKEN };

/** Un database finto con le sole chiamate di `salute.server.ts`. */
function db({ proprietari = [{ user_id: UTENTE, creato_il: ISO(9999) }], config = [RIGA], esiti = [], senzaS3 = false, esitiRotti = false, erroreProprietari = null } = {}) {
  const chiamate = [];
  const dbf = {
    chiamate,
    from(t) {
      const q = { t, cols: "", filtri: [], limite: Infinity };
      const f = {
        select(cols) { q.cols = String(cols); return f; },
        eq(k, v) { q.filtri.push([k, v]); return f; },
        order() { return f; }, limit(n) { q.limite = n; return f; },
        then(ok, ko) {
          chiamate.push({ t, cols: q.cols, filtri: q.filtri });
          let r;
          if (t === "tracciamento_proprietario") r = erroreProprietari ? { data: null, error: erroreProprietari } : senzaS3 ? { data: null, error: { code: "42P01" } } : { data: [...proprietari].sort((a, b) => String(a.creato_il).localeCompare(String(b.creato_il))).map((p) => ({ user_id: p.user_id })), error: null };
          else if (t === "tracking_config") r = { data: config.filter((x) => q.filtri.every(([k, v]) => x[k] === v)).map((x) => Object.fromEntries(q.cols.split(",").map((k) => [k.trim(), x[k.trim()] ?? null]))), error: null };
          else if (t === "tracciamento_esiti") r = senzaS3 || esitiRotti ? { data: null, error: { code: "42P01" } } : { data: esiti.filter((x) => q.filtri.every(([k, v]) => x[k] === v)).sort((a, b) => (Date.parse(b.creato_il) || 0) - (Date.parse(a.creato_il) || 0)).slice(0, q.limite), error: null };
          else throw new Error(`tabella non prevista: ${t}`);
          return Promise.resolve(r).then(ok, ko);
        },
      };
      return f;
    },
  };
  return dbf;
}
const dip = (o = {}, guardia) => {
  const logs = [];
  const d = {
    guardia: guardia ?? (async () => ({ ok: true, utenteId: UTENTE })),
    db: o.dbf ?? db(o), adesso: () => T0, log: (c) => logs.push(String(c)),
  };
  return { d, logs };
};
const chiama = async (mod, o = {}, guardia) => {
  const { d, logs } = dip(o, guardia);
  const r = await mod.gestisciGET(new Request("https://sito.test/api/crm/tracciamento"), d);
  return { r, corpo: await r.json(), logs, d };
};

export async function prove(mod, { c, gruppo, radice }) {
  const S = mod["tracciamento/salute.server"];
  const R = mod["tracciamento/regole"];
  gruppo("SHOP R1 · T30 · TRACCIAMENTO NELLE IMPOSTAZIONI (20/11/2026)");
  c("i moduli ci sono", [true, true], [typeof S?.gestisciGET === "function", typeof R?.validaIdGoogle === "function"]);
  if (!S?.gestisciGET || !R?.validaIdGoogle) return;

  /* ── il permesso: prima di tutto ── */
  const rifiuto = new Response(JSON.stringify({ ok: false, error: "permesso" }), { status: 403 });
  const senzaPermesso = await chiama(S, {}, async () => ({ ok: false, risposta: rifiuto }));
  c("permesso mancante → la risposta della guardia (403) e NESSUNA lettura del database", [403, 0], [senzaPermesso.r.status, senzaPermesso.d.db.chiamate.length]);
  const guardiaRotta = await chiama(S, {}, async () => { throw new Error(`rotta con ${TOKEN}`); });
  c("la guardia che lancia → 500 «ok:false», senza il testo dell'errore, nessuna lettura", [500, { ok: false }, 0, false], [guardiaRotta.r.status, guardiaRotta.corpo, guardiaRotta.d.db.chiamate.length, JSON.stringify([guardiaRotta.corpo, guardiaRotta.logs]).includes(TOKEN)]);

  /* ── il caso normale: proprietario = questo account ── */
  const esiti = [
    { piattaforma: "meta", evento: "AddToCart", esito: "ok", creato_il: ISO(2) },
    { piattaforma: "tiktok", evento: "PageView", esito: "http_400", creato_il: ISO(3) },
    { piattaforma: "meta", evento: "PageView", esito: "http_500", creato_il: ISO(10) },
    { piattaforma: "meta", evento: "ViewContent", esito: "ok", creato_il: ISO(30) },
    { piattaforma: "tiktok", evento: "PageView", esito: "errore_rete", creato_il: ISO(600) },
    { piattaforma: "meta", evento: "PageView", esito: "ok", creato_il: ISO(60 * 30) },
  ];
  const n = await chiama(S, { esiti });
  c("200, ok, attivo, il proprietario è questo account", [200, true, true, "tu"], [n.r.status, n.corpo.ok, n.corpo.attivo, n.corpo.proprietario]);
  c("quali ID ci sono (solo sì/no, mai il valore)", { meta: true, tiktok: true, ga4: true, ads: true }, n.corpo.pixel);
  c("la risposta non contiene MAI token, codici di prova, segreti, id utente, indirizzi IP o user agent", false, /token|secret|access|TOKEN-FINTO|TESTCODE|123456789012345|C1ABCDEF|G-TEST1234|AW-12345678|11111111-1111|22222222-2222|203\.0\.113|Mozilla/i.test(JSON.stringify(n.corpo)));
  c("le colonne chieste a `tracking_config` non sono token né segreti", [], n.d.db.chiamate.filter((x) => x.t === "tracking_config").map((x) => x.cols).filter((x) => /access_token|token|secret|verify|app_secret/.test(x)));
  c("…e la riga si cerca per il proprietario (eq user_id), non per data", [["user_id", UTENTE]], n.d.db.chiamate.find((x) => x.t === "tracking_config").filtri);
  c("per piattaforma: l'ultimo invio con evento, esito (solo codice) e quando", [{ evento: "AddToCart", esito: "ok", quando: ISO(2) }, { evento: "PageView", esito: "http_400", quando: ISO(3) }], [n.corpo.piattaforme.find((p) => p.piattaforma === "meta").ultimo, n.corpo.piattaforme.find((p) => p.piattaforma === "tiktok").ultimo]);
  c("per piattaforma: invii e errori nelle ultime 24 ore (Meta 3 con 1 errore; TikTok 2 con 2 errori, uno è di 10 ore fa)", [{ invii24h: 3, errori24h: 1 }, { invii24h: 2, errori24h: 2 }], ["meta", "tiktok"].map((k) => { const p = n.corpo.piattaforme.find((x) => x.piattaforma === k); return { invii24h: p.invii24h, errori24h: p.errori24h }; }));
  c("gli ultimi errori: solo codici, dal più recente (piattaforma, evento, esito, quando)", [{ piattaforma: "tiktok", evento: "PageView", esito: "http_400", quando: ISO(3) }, { piattaforma: "meta", evento: "PageView", esito: "http_500", quando: ISO(10) }, { piattaforma: "tiktok", evento: "PageView", esito: "errore_rete", quando: ISO(600) }], n.corpo.errori);
  c("`adesso` c'è (per dire «2 minuti fa» senza fidarsi dell'orologio del browser)", T0.toISOString(), n.corpo.adesso);

  /* ── esiti sporchi: solo codici ── */
  const sporchi = await chiama(S, { esiti: [
    { piattaforma: "meta", evento: "AddToCart", esito: `errore con ${TOKEN} e 203.0.113.7`, creato_il: ISO(1) },
    { piattaforma: "pinterest", evento: "x y z", esito: "http_400", creato_il: ISO(2) },
    { piattaforma: "meta", evento: "A".repeat(200), esito: "ok", creato_il: "non è una data" },
    { piattaforma: "tiktok", evento: "PageView", esito: "ok", creato_il: ISO(3), event_id: "evt-1", ip: "203.0.113.7", user_agent: "Mozilla/5.0" },
  ] });
  c("un esito che non è un codice breve diventa «altro»; evento e piattaforma strani non passano; nessun campo in più (event_id, ip, user agent)", [[], false], [sporchi.corpo.errori.filter((e) => !/^[a-z0-9_]{1,40}$/.test(e.esito) || !/^[A-Za-z0-9_]{1,40}$/.test(e.evento) || !["meta", "tiktok"].includes(e.piattaforma) || Object.keys(e).sort().join() !== "esito,evento,piattaforma,quando"), /TOKEN|203\.0|evt-1|Mozilla|pinterest|AAAAAAAA/.test(JSON.stringify(sporchi.corpo))]);
  c("…e l'esito sporco è «altro»", "altro", sporchi.corpo.errori[0]?.esito);

  /* ── nessun invio ancora ── */
  const vuoto = await chiama(S, { esiti: [] });
  c("senza invii: ogni piattaforma ha `ultimo` nullo e zero invii; nessun errore", [[null, null], [0, 0], []], [vuoto.corpo.piattaforme.map((p) => p.ultimo), vuoto.corpo.piattaforme.map((p) => p.invii24h), vuoto.corpo.errori]);

  /* ── il proprietario ── */
  const nessuno = await chiama(S, { dbf: db({ proprietari: [], esiti }) });
  c("senza proprietario: «nessuno», attivo, senza dire altro del sito (pixel e prova nulli) e il sito, in questo stato, non manda niente", [200, "nessuno", true, null, null], [nessuno.r.status, nessuno.corpo.proprietario, nessuno.corpo.attivo, nessuno.corpo.pixel, nessuno.corpo.prova]);
  c("…e non legge `tracking_config` di nessuno", 0, nessuno.d.db.chiamate.filter((x) => x.t === "tracking_config").length);
  const altro = await chiama(S, { dbf: db({ proprietari: [{ user_id: ALTRO, creato_il: ISO(100) }], config: [RIGA, { ...RIGA, user_id: ALTRO, meta_pixel_id: "999999999999", tiktok_pixel_id: null, google_ga4_id: null, google_ads_id: null }], esiti }) });
  c("il proprietario è un altro account: «altro», gli ID mostrati sono quelli di LUI (come i pixel del sito), mai l'id", ["altro", { meta: true, tiktok: false, ga4: false, ads: false }, false], [altro.corpo.proprietario, altro.corpo.pixel, /22222222|11111111/.test(JSON.stringify(altro.corpo))]);
  const due = await chiama(S, { dbf: db({ proprietari: [{ user_id: ALTRO, creato_il: ISO(10) }, { user_id: UTENTE, creato_il: ISO(500) }] }) });
  c("con due proprietari vale il più vecchio (come il sito)", "tu", due.corpo.proprietario);
  const senzaRiga = await chiama(S, { dbf: db({ config: [] }) });
  c("proprietario senza riga in tracking_config: tutto «no», nessun errore", [200, "tu", { meta: false, tiktok: false, ga4: false, ads: false }], [senzaRiga.r.status, senzaRiga.corpo.proprietario, senzaRiga.corpo.pixel]);

  /* ── S3 non applicata ── */
  const senzaS3 = await chiama(S, { dbf: db({ senzaS3: true }) });
  c("S3 assente: 200, «non ancora attivo», nessun errore, nessuna frase d'errore tecnica", [200, true, false, "non_ancora_attivo"], [senzaS3.r.status, senzaS3.corpo.ok, senzaS3.corpo.attivo, senzaS3.corpo.motivo]);
  c("…e non legge né gli esiti né la configurazione", [], senzaS3.d.db.chiamate.filter((x) => x.t !== "tracciamento_proprietario").map((x) => x.t));
  const esitiRotti = await chiama(S, { dbf: db({ esitiRotti: true }) });
  c("registro degli esiti illeggibile (con S3 presente): la pagina c'è lo stesso, `piattaforme` nullo", [200, true, null, null], [esitiRotti.r.status, esitiRotti.corpo.ok, esitiRotti.corpo.piattaforme, esitiRotti.corpo.errori]);

  /* ── la modalità prova ── */
  const prova = await chiama(S, { dbf: db({ config: [{ ...RIGA, meta_test_event_code: CODICE_PROVA, tiktok_test_event_code: null }], esiti }) });
  c("«modalità prova»: sì/no per piattaforma (il codice non esce)", [{ meta: true, tiktok: false }, false], [prova.corpo.prova, JSON.stringify(prova.corpo).includes(CODICE_PROVA)]);
  c("senza codici di prova: «no» per tutte", { meta: false, tiktok: false }, n.corpo.prova);

  /* ── note del revisore (T30) ── */
  // nota 2: «S3 non applicata» solo per tabella/colonna mancante; ogni altro errore è «non riesco a leggere ora»
  const MANCANTI = ["42P01", "42703", "PGRST204", "PGRST205"];
  c("colonnaOTabellaMancante: 42P01, 42703, PGRST204, PGRST205 → sì; ogni altro codice o forma → no", [[true, true, true, true], [false, false, false, false, false, false]], [
    MANCANTI.map((k) => R.colonnaOTabellaMancante({ code: k })),
    [{ code: "08006" }, { code: "57014" }, { code: "42501" }, { message: "Failed to fetch" }, null, undefined].map((e) => R.colonnaOTabellaMancante(e)),
  ]);
  for (const code of MANCANTI) {
    const m = await chiama(S, { dbf: db({ erroreProprietari: { code } }) });
    c(`registro dei proprietari con ${code}: S3 non applicata → 200, «non ancora attivo»`, [200, true, false, "non_ancora_attivo"], [m.r.status, m.corpo.ok, m.corpo.attivo, m.corpo.motivo]);
  }
  for (const err of [{ code: "08006", message: `connessione persa ${TOKEN}` }, { code: "57014" }, { code: "42501" }, { message: "Failed to fetch" }, {}]) {
    const e = await chiama(S, { dbf: db({ erroreProprietari: err }) });
    c(`registro dei proprietari con un altro errore (${err.code ?? err.message ?? "senza codice"}): NON «non ancora attivo» ma 500 «ok:false», senza testo, e non legge altro`, [500, { ok: false }, false, []], [e.r.status, e.corpo, JSON.stringify([e.corpo, e.logs]).includes(TOKEN), e.d.db.chiamate.filter((x) => x.t !== "tracciamento_proprietario")]);
  }
  c("…il registro dice solo un codice, mai il messaggio", [true], [(await chiama(S, { dbf: db({ erroreProprietari: { code: "08006", message: `connessione persa ${TOKEN}` } }) })).logs.every((l) => /^[a-z0-9_]{1,60}$/.test(l))]);

  // nota 1: i conteggi non si dichiarano esatti oltre il tetto, e una piattaforma non nasconde l'altra
  const molti = (piattaforma, quanti, minutiFa0 = 1, passo = 1) => Array.from({ length: quanti }, (_, i) => ({ piattaforma, evento: "ViewContent", esito: i % 10 === 0 ? "http_500" : "ok", creato_il: ISO(minutiFa0 + i * passo) }));
  const tanti = await chiama(S, { esiti: [...molti("meta", 250), { piattaforma: "tiktok", evento: "PageView", esito: "ok", creato_il: ISO(500) }] });
  const mT = tanti.corpo.piattaforme.find((p) => p.piattaforma === "meta");
  const tT = tanti.corpo.piattaforme.find((p) => p.piattaforma === "tiktok");
  c("250 invii di Meta in 24 ore: il numero si ferma al tetto (200) e lo dice (`oltreTetto`), non si fa passare per esatto", [200, true], [mT.invii24h, mT.oltreTetto]);
  c("…e TikTok, che ha un solo invio, compare lo stesso (non «Nessun invio ancora») e il suo numero è esatto", [{ evento: "PageView", esito: "ok", quando: ISO(500) }, 1, false], [tT.ultimo, tT.invii24h, tT.oltreTetto]);
  const meta200 = await chiama(S, { esiti: molti("meta", 200, 1, 1) });
  c("esattamente 200 righe tutte dentro le 24 ore: non si sa se ce ne sono altre → «oltre il tetto»", true, meta200.corpo.piattaforme.find((p) => p.piattaforma === "meta").oltreTetto);
  const confine = await chiama(S, { esiti: molti("meta", 250, 1, 10) }); // 10 minuti l'una: dentro le 24 ore solo le prime 144, poi si esce dalla finestra prima del tetto
  const mC = confine.corpo.piattaforme.find((p) => p.piattaforma === "meta");
  c("se le 200 righe lette escono dalla finestra di 24 ore il numero è esatto (nessun «+»)", [144, false], [mC.invii24h, mC.oltreTetto]);
  c("senza troppi invii (caso normale) nessuna piattaforma è «oltre il tetto»", [false, false], n.corpo.piattaforme.map((p) => p.oltreTetto));
  const perPiattaforma = tanti.d.db.chiamate.filter((x) => x.t === "tracciamento_esiti");
  c("gli esiti si leggono UNA volta per piattaforma, filtrati (eq piattaforma)", [[["piattaforma", "meta"]], [["piattaforma", "tiktok"]]], perPiattaforma.map((x) => x.filtri));
  c("gli ultimi errori restano uniti e dal più recente anche con due letture", [10, true], [tanti.corpo.errori.length, tanti.corpo.errori.every((e, i, a) => i === 0 || a[i - 1].quando >= e.quando)]);

  /* ── ID di Google: solo nel formato giusto ── */
  const v = (o) => R.validaIdGoogle({ ga4: "", ads: "", etichetta: "", merchant: "", ...o });
  c("tutti vuoti: valido, tutti `null` (si cancellano)", [true, { ga4: null, ads: null, etichetta: null, merchant: null }, {}], (() => { const x = v({}); return [x.ok, x.valori, x.errori]; })());
  c("GA4 e Ads giusti, anche con spazi e minuscole: valido e normalizzato", [true, "G-TEST1234", "AW-12345678"], (() => { const x = v({ ga4: " g-test1234 ", ads: "aw-12345678" }); return [x.ok, x.valori.ga4, x.valori.ads]; })());
  c("etichetta di conversione e Merchant giusti", [true, "abcDEF123_-x", "1234567890"], (() => { const x = v({ ads: "AW-12345678", etichetta: "abcDEF123_-x", merchant: "1234567890" }); return [x.ok, x.valori.etichetta, x.valori.merchant]; })());
  const sbagliati = [["ga4", "UA-12345-1"], ["ga4", "G-"], ["ga4", "G-ab cd"], ["ga4", "G-'; drop"], ["ga4", "GTM-ABC123"], ["ga4", "12345"], ["ads", "G-TEST1234"], ["ads", "AW-"], ["ads", "AW-12ab"], ["ads", "12345678"], ["merchant", "abc"], ["merchant", "12"], ["merchant", "12 34"]];
  c("ID nel formato sbagliato: non validi, con una frase che dice cosa fare (nessun valore salvabile)", [], sbagliati.filter(([k, val]) => { const x = v({ [k]: val }); return x.ok || typeof x.errori[k] !== "string" || x.errori[k].length < 15 || Object.values(x.valori).some((y) => y === val); }));
  c("la frase d'errore nomina il formato giusto", [true, true, true], [/G-/.test(v({ ga4: "UA-1" }).errori.ga4), /AW-/.test(v({ ads: "G-1" }).errori.ads), /cifre/.test(v({ merchant: "abc" }).errori.merchant)]);
  c("etichetta senza ID Google Ads: errore (serve insieme); etichetta con caratteri strani: errore", [true, true], [typeof v({ etichetta: "abcDEF123" }).errori.etichetta === "string", typeof v({ ads: "AW-12345678", etichetta: "ab cd'" }).errori.etichetta === "string"]);
  c("valori non testo: nessuna eccezione, valgono vuoti", [true, null], (() => { const x = R.validaIdGoogle({ ga4: null, ads: undefined, etichetta: 42, merchant: {} }); return [x.ok, x.valori.ga4]; })());
  c("il comando per scrivere il proprietario è quello deciso (D35), con l'email segnaposto", "INSERT INTO public.tracciamento_proprietario (user_id) SELECT id FROM auth.users WHERE email = 'EMAIL-DEL-TITOLARE' ON CONFLICT DO NOTHING;", R.COMANDO_PROPRIETARIO);
  c("fraseEsito: ok, http_400, errore_rete, altro", ["ricevuto", "rifiutato dalla piattaforma (400)", "piattaforma non raggiungibile", "esito non riconosciuto"], ["ok", "http_400", "errore_rete", "boh"].map((x) => R.fraseEsito(x)));

  /* ── le rotte e il pannello (sul sorgente) ── */
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senza = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const rotta = senza(leggi("src/routes/api.crm.tracciamento.ts"));
  c("la rotta usa il permesso «impostazioni» (lo stesso della pagina), è solo GET e non ha CORS", [true, true, false, false], [/guardiaCRM\(request, \{\}, "impostazioni"/.test(rotta), /GET:/.test(rotta) && !/POST:/.test(rotta), /Access-Control-Allow-Origin/.test(rotta), /\.delete\(|\.update\(|\.insert\(|\.upsert\(/.test(rotta)]);
  c("la rotta non scrive token o chiavi nei registri", [], /console\.\w+\([^)]*(token|chiave|KEY|process\.env|error\b)/i.test(rotta) ? ["console"] : []);
  const server = senza(leggi("src/crm/tracciamento/salute.server.ts"));
  c("salute.server.ts: non chiede token né segreti, non scrive niente e nessun `*`", [false, false, false], [/access_token|app_secret|verify_token|page_access/.test(server.replace(/["'`][^"'`\n]*(test_event_code)[^"'`\n]*["'`]/g, "")), /\.(insert|update|upsert|delete)\(/.test(server), /select\(\s*["'`]\*["'`]/.test(server)]);
  const pannello = senza(leggi("src/crm/tracciamento/PannelloTracciamento.tsx"));
  c("il pannello non nomina nessun token né segreto (mai a schermo, mai letto)", false, /access_token|app_secret|verify_token|page_access|_token/i.test(pannello));
  c("il pannello salva con upsert sulla riga dell'utente (onConflict user_id) SOLO le colonne di Google, dopo `validaIdGoogle`", [true, true, true, false], [/\.upsert\(/.test(pannello) && /onConflict: "user_id"/.test(pannello), /google_ga4_id/.test(pannello) && /google_ads_id/.test(pannello) && /google_ads_label_acquisto/.test(pannello) && /google_merchant_id/.test(pannello), pannello.indexOf("validaIdGoogle(") < pannello.indexOf(".upsert("), /meta_pixel_id|tiktok_pixel_id|daily_spend|ads_history_start/.test(pannello)]);
  c("il pannello dice «Imposta il proprietario dal SQL Editor» e mostra il comando; dice «non ancora attivo» se manca S3; ha la «modalità prova»", [true, true, true, true], [/Imposta il proprietario dal SQL Editor/.test(pannello), /COMANDO_PROPRIETARIO/.test(pannello), /non ancora attivo/i.test(pannello), /modalità prova/i.test(pannello)]);
  c("il pannello non ha controlli «a icona» senza nome (ogni bottone ha testo o aria-label) e ogni campo ha la sua etichetta", [true, true], [!/<Button[^>]*>\s*<\w+ className="[^"]*"\s*\/>\s*<\/Button>/.test(pannello), /<Label htmlFor=\{`tr-\$\{c\.chiave\}`\}>/.test(pannello) && (pannello.match(/chiave: "(ga4|ads|etichetta|merchant)"/g) || []).length === 4]);
  const primaDelBottone = pannello.slice(Math.max(0, pannello.indexOf("<RefreshCw") - 260), pannello.indexOf("<RefreshCw"));
  c("il pannello nota 3: «Aggiorna» rilegge SOLO lo stato degli invii (non cancella gli ID di Google che si stanno digitando)", [true, false], [/leggiSalute\(\)/.test(primaDelBottone), /leggiIdGoogle/.test(primaDelBottone)]);
  c("il pannello nota 3: gli ID di Google si rileggono quando cambia l'utente (`user.id`), non a ogni nuovo oggetto `user`", [true, false], [/\}, \[userId\]\);/.test(pannello), /\}, \[user\]\);/.test(pannello)]);
  c("il pannello nota 2: legge `colonnaOTabellaMancante` per decidere «non ancora attivo»; un altro errore dice «non riesco a leggere» e spegne i campi", [true, true, true], [/colonnaOTabellaMancante\(error\)/.test(pannello), /Non riesco a leggere gli ID di Google/.test(pannello), /disabled=\{colonneMancanti \|\| letturaGoogleRotta\}/.test(pannello)]);
  c("il pannello nota 1: con `oltreTetto` il numero porta il «+» (200+)", true, /p\.oltreTetto \? "\+" : ""/.test(pannello));
  c("il pannello nota 4: l'`aria-label` dei pixel impostati sta su un elemento con `role=\"group\"`", true, /<div[^>]*role="group"[^>]*aria-label="ID impostati per il proprietario"|<div[^>]*aria-label="ID impostati per il proprietario"[^>]*role="group"/.test(pannello));
  const pagina = leggi("src/routes/CRM.impostazioni.tsx");
  c("la pagina delle Impostazioni monta il pannello (una linguetta) e conserva tutte le linguette di oggi", [true, true, true, true, true, true, true, true, true, true, true, true], ["meta", "tiktok", "whatsapp", "messaggi", "landing", "costi", "alert", "meetly", "webinar", "ai", "diagnostica", "dati"].map((t) => new RegExp(`<TabsTrigger value="${t}"`).test(pagina)));
  c("…e c'è la linguetta «tracciamento» col suo contenuto, il pannello importato da un solo posto", [true, true, 1], [/<TabsTrigger value="tracciamento"/.test(pagina), /<TabsContent value="tracciamento"[^>]*>\s*<PannelloTracciamento \/>/.test(pagina), (pagina.match(/import \{ PannelloTracciamento \}/g) || []).length]);
  c("…e il salvataggio di oggi (`saveTracking`, tutti i campi Meta e TikTok) è com'era", [true, true, true], [/const saveTracking = async/.test(pagina), /meta_access_token: tracking\.meta_access_token \|\| null/.test(pagina), /tiktok_test_event_code: tracking\.tiktok_test_event_code \|\| null/.test(pagina)]);
}
