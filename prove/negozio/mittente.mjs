/** ── SHOP R1 · T25 · IL MITTENTE LATO SERVER E LE ROTTE PUBBLICHE ─────────────────────
 *  `src/lib/tracciamento/{mittente,config-pubblica}.ts` e le tre rotte sottili. Niente rete: `fetch` finto che
 *  registra ogni chiamata, un database finto con le sole chiamate che il mittente usa, un registro finto (`log`).
 *  Token, indirizzi IP e user agent sono INVENTATI (`TOKEN-META-FINTO`…): servono a cercarli, in ogni risposta e in
 *  ogni riga di registro, e a non trovarli. Cosa deve valere (D13, D14, D16, 6A n. 3, 5, 6):
 *   · l'indirizzo dell'evento lo costruisce il SERVER col suo dominio, mai quello dichiarato dal client;
 *   · `Purchase` e simili → 403 anche con permesso valido; permesso scaduto o alterato → 401 e nessuna chiamata esterna;
 *   · nel corpo per Meta/TikTok nessuna email, telefono o nome: solo IP e user agent dalle intestazioni;
 *   · i token non compaiono mai né nelle risposte né nel registro; la risposta non spiega mai l'errore;
 *   · `tracking-config` legge la riga più recente con almeno un ID, e non porta mai token né codici di prova. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CHIAVE = "chiave-di-servizio-finta";
const TOKEN_META = "TOKEN-META-FINTO-0123456789";
const TOKEN_TIKTOK = "TOKEN-TIKTOK-FINTO-9876543210";
const IP = "203.0.113.7";
const UA = "Mozilla/5.0 (prova) Finto/1.0";
const SITO = "https://sito.test";
const T0 = 1_800_000_000_000;
const MIN = 60_000;
const RIGA_CONFIG = {
  user_id: "u1", updated_at: "2026-11-10T10:00:00Z",
  meta_pixel_id: "123456789012345", meta_access_token: TOKEN_META, meta_test_event_code: "TEST111",
  tiktok_pixel_id: "C1ABCDEF2GHIJKL3MNOP", tiktok_access_token: TOKEN_TIKTOK, tiktok_test_event_code: "TT222",
  google_ga4_id: "G-TEST1234", google_ads_id: "AW-12345678", google_ads_label_acquisto: "abc",
};

/** Un database finto, quanto basta: `from(t).select(cols).order().limit()`, `insert`, `delete().lt()`. */
function fintoDb({ config = [RIGA_CONFIG], proprietari = [{ user_id: "u1", creato_il: "2026-11-01T00:00:00Z" }], tabellaProprietarioMancante = false, tabellaConfigMancante = false, esitiRotta = false, deleteRotta = false } = {}) {
  const chiamate = [];
  const esiti = [];
  const db = {
    chiamate, esiti,
    from(t) {
      if (t === "tracciamento_proprietario") {
        return {
          select(cols) {
            chiamate.push({ t, op: "select", cols });
            const f = {
              order: () => f, limit: () => f,
              then: (ok, ko) => Promise.resolve(tabellaProprietarioMancante
                ? { data: null, error: { code: "42P01", message: "relation does not exist" } }
                : { data: [...proprietari].sort((a, b) => String(a.creato_il).localeCompare(String(b.creato_il))).map((r) => ({ user_id: r.user_id })), error: null }).then(ok, ko),
            };
            return f;
          },
        };
      }
      if (t === "tracking_config") {
        return {
          select(cols) {
            chiamate.push({ t, op: "select", cols });
            const lista = String(cols).split(",").map((x) => x.trim());
            const filtri = [];
            const esegui = () => {
              if (tabellaConfigMancante) return { data: null, error: { code: "42P01", message: "relation does not exist" } };
              return { data: config.filter((r) => filtri.every(([k, v]) => r[k] === v)).map((r) => Object.fromEntries(lista.map((k) => [k, r[k] ?? null]))), error: null };
            };
            const f = { eq: (k, v) => { filtri.push([k, v]); return f; }, order: () => f, limit: () => f, then: (ok, ko) => Promise.resolve(esegui()).then(ok, ko) };
            return f;
          },
        };
      }
      if (t === "tracciamento_esiti") {
        return {
          insert(riga) {
            chiamate.push({ t, op: "insert", riga });
            if (esitiRotta) return Promise.resolve({ error: { code: "42P01", message: "relation does not exist" } });
            esiti.push(riga);
            return Promise.resolve({ error: null });
          },
          delete() {
            return { lt: (col, val) => { chiamate.push({ t, op: "delete", col, val }); return deleteRotta ? Promise.reject(new Error("rotto")) : Promise.resolve({ error: null }); } };
          },
        };
      }
      throw new Error(`tabella non prevista nel finto: ${t}`);
    },
  };
  return db;
}

function mondo(opz = {}) {
  const m = { logs: [], fetches: [], ora: T0, risposte: opz.risposte ?? {} };
  m.db = opz.db ?? fintoDb(opz.dbOpz);
  m.stato = { finestre: new Map(), ultimaPulizia: 0 };
  m.deps = {
    db: m.db,
    adesso: () => m.ora,
    chiave: "chiave" in opz ? opz.chiave : CHIAVE,
    sito: SITO,
    log: (codice) => m.logs.push(String(codice)),
    stato: m.stato,
    fetch: async (url, init = {}) => {
      const voce = { url: String(url), metodo: init.method ?? "GET", intestazioni: init.headers ?? {}, corpo: init.body ? JSON.parse(init.body) : null };
      m.fetches.push(voce);
      const r = m.risposte[/facebook/.test(voce.url) ? "meta" : "tiktok"] ?? { ok: true, status: 200 };
      if (r.lancia) throw new Error(`rete assente (${TOKEN_META})`);
      return { ok: r.ok, status: r.status, text: async () => "corpo-della-piattaforma" };
    },
  };
  return m;
}

export async function prove(mod, { c, gruppo, radice }) {
  const M = mod["lib/tracciamento/mittente"];
  const CP = mod["lib/tracciamento/config-pubblica"];
  const P = mod["lib/tracciamento/permesso"];
  gruppo("SHOP R1 · T25 · IL MITTENTE LATO SERVER (20/11/2026)");
  c("i moduli ci sono", [true, true, true], [typeof M?.gestisciEvento === "function", typeof M?.gestisciPermesso === "function", typeof CP?.leggiConfigPubblica === "function"]);
  if (!M?.gestisciEvento || !CP?.leggiConfigPubblica || !P) return;

  const K = await P.derivaChiave(CHIAVE);
  const permessoA = (ora = T0) => P.emettiPermesso(K, ora);
  const evento = async (extra = {}, { ora } = {}) => ({
    corpo: {
      nome: "AddToCart", eventId: "evt-0001", permesso: await permessoA(ora ?? T0), percorso: "/shop/prodotto/x", query: "utm_source=meta",
      dati: { contentIds: ["HG-001"], contentType: "product", valueCent: 2890, numItems: 1 }, consenso: true, ...extra,
    },
    ip: IP, userAgent: UA,
  });
  const vai = (m, r) => M.gestisciEvento(r, m.deps);
  const segreti = (x) => [TOKEN_META, TOKEN_TIKTOK].filter((t) => JSON.stringify(x).includes(t));

  /* ── il caso buono ── */
  const m = mondo();
  const r = await vai(m, await evento());
  c("evento valido: 200 e una risposta che dice solo «ok»", [200, { ok: true }], [r.stato, r.corpo]);
  c("parte una chiamata a Meta e una a TikTok, e basta", [["graph.facebook.com", "business-api.tiktok.com"].map((h) => true)].flat(), ["graph.facebook.com", "business-api.tiktok.com"].map((h) => m.fetches.filter((f) => f.url.includes(h)).length === 1));
  c("in tutto due chiamate", 2, m.fetches.length);
  const fm = m.fetches.find((f) => /facebook/.test(f.url));
  const ft = m.fetches.find((f) => /tiktok/.test(f.url));
  const d = fm.corpo.data[0];
  c("Meta: indirizzo di Graph col solo ID del pixel, il token NON è nell'indirizzo", ["https://graph.facebook.com/v19.0/123456789012345/events", false], [fm.url, fm.url.includes(TOKEN_META)]);
  c("Meta: nome, event_id uguale a quello ricevuto, sorgente sito, ora in secondi", ["AddToCart", "evt-0001", "website", Math.floor(T0 / 1000)], [d.event_name, d.event_id, d.action_source, d.event_time]);
  c("Meta: custom_data con prodotti e valore in euro", { content_ids: ["HG-001"], content_type: "product", currency: "EUR", value: 28.9, num_items: 1 }, d.custom_data);
  c("Meta: il codice di prova passa se configurato", "TEST111", fm.corpo.test_event_code);
  c("TikTok: l'evento ha lo stesso event_id, il pixel e il token in intestazione (non nell'indirizzo)", ["AddToCart", "evt-0001", "C1ABCDEF2GHIJKL3MNOP", TOKEN_TIKTOK, false], [ft.corpo.data[0].event, ft.corpo.data[0].event_id, ft.corpo.pixel_code, ft.intestazioni["Access-Token"], ft.url.includes(TOKEN_TIKTOK)]);
  c("TikTok: il codice di prova passa se configurato", "TT222", ft.corpo.test_event_code);

  /* ── l'indirizzo lo costruisce il server ── */
  c("event_source_url è sul dominio del SITO, col percorso e le sole chiavi ammesse (Meta e TikTok)", ["https://sito.test/shop/prodotto/x?utm_source=meta", "https://sito.test/shop/prodotto/x?utm_source=meta"], [d.event_source_url, ft.corpo.data[0].page.url]);
  const m2 = mondo();
  await vai(m2, await evento({ url: "https://evil.test/rubato", event_source_url: "https://evil.test/x", sourceUrl: "https://evil.test", percorso: "/Shop/C/Patch/", query: "?UTM_SOURCE=meta&fbclid=9" }));
  const d2 = m2.fetches[0].corpo.data[0];
  c("un indirizzo dichiarato dal client non esce: resta il dominio del sito, col percorso normalizzato e le sole chiavi ammesse", ["https://sito.test/shop/c/patch?utm_source=meta&fbclid=9", false], [d2.event_source_url, /evil/.test(JSON.stringify(m2.fetches))]);
  const m2b = mondo();
  const st2 = [];
  for (const query of ["utm_source=meta&q=SEGRETO", "ref_code=X", "qualcosa=Y", "email=a@example.com&fbclid=9"]) st2.push((await vai(m2b, await evento({ query }))).stato);
  c("una chiave di query che non è fra quelle ammesse (lista bianca) → 400 e nessuna chiamata: il server non ricostruisce un indirizzo da codici sconosciuti", [[400, 400, 400, 400], 0], [st2, m2b.fetches.length]);

  /* ── i dati: nessun dato personale, solo IP e user agent dalle intestazioni ── */
  c("Meta: user_data ha SOLO client_ip_address e client_user_agent, presi dalle intestazioni", [["client_ip_address", "client_user_agent"], IP, UA], [Object.keys(d.user_data).sort(), d.user_data.client_ip_address, d.user_data.client_user_agent]);
  c("TikTok: user ha SOLO ip e user_agent", [["ip", "user_agent"], IP, UA], [Object.keys(ft.corpo.data[0].user).sort(), ft.corpo.data[0].user.ip, ft.corpo.data[0].user.user_agent]);
  const m3 = mondo();
  const spiato = await evento({ user_data: { em: "a@example.com", ph: "3391234567", fn: "Mario" }, email: "a@example.com", telefono: "339 123 4567", nome: "AddToCart", dati: { contentIds: ["HG-001"], email: "a@example.com", nome: "Mario", telefono: "3391234567" } });
  spiato.ip = ""; spiato.userAgent = "";
  await vai(m3, spiato);
  const corpiTutti = JSON.stringify(m3.fetches.map((f) => f.corpo));
  c("nessuna email, telefono o nome in chiaro, né hash, nel corpo inviato (scansione), anche se il client li manda", false, /@|example\.com|3391234567|339 123|Mario|"em"|"ph"|"fn"|"email"|"phone"/.test(corpiTutti));
  c("senza IP e user agent nelle intestazioni, il corpo parte senza (nessun valore inventato)", [[], []], [Object.keys(m3.fetches[0].corpo.data[0].user_data), Object.keys(m3.fetches[1].corpo.data[0].user)]);

  /* ── segreti: mai nelle risposte né nel registro ── */
  const casiRisposte = [];
  for (const extra of [{}, { nome: "Purchase" }, { nome: "Foo" }, { consenso: false }, { permesso: "x" }]) {
    const mm = mondo({ risposte: { meta: { ok: false, status: 500 } } });
    const rr = await vai(mm, await evento(extra));
    casiRisposte.push([...segreti(rr), ...segreti(mm.logs), ...(/graph\.facebook|business-api|TOKEN/.test(JSON.stringify(rr)) ? ["risposta"] : [])]);
  }
  c("i token non compaiono mai né nelle risposte né nel registro (anche quando la piattaforma risponde con un errore)", [[], [], [], [], []], casiRisposte);
  const mr = mondo({ risposte: { meta: { lancia: true } } });
  const rr = await vai(mr, await evento());
  c("rete assente verso Meta (con il token dentro il messaggio d'errore): nessuna eccezione, risposta «ok», il token non va nel registro, TikTok parte lo stesso", [200, [], true], [rr.stato, segreti(mr.logs).concat(/203\.0\.113|Finto/.test(mr.logs.join()) ? ["ip"] : []), mr.fetches.some((f) => /tiktok/.test(f.url))]);
  c("il registro riceve solo codici brevi (lettere, cifre, trattino basso)", [], mr.logs.filter((x) => !/^[a-z0-9_]{1,40}$/.test(x)));

  /* ── nomi vietati, sconosciuti, forma ── */
  const VIETATI = ["Purchase", "CompletePayment", "Refund", "OrderPlaced", "PaymentFailed", "purchase", "PURCHASE", " Purchase", "Purchase ", "Purchase​", "PlaceAnOrder", "Complete_Payment", "ＰＵＲＣＨＡＳＥ", "Order-Placed"];
  const esitiV = [];
  const mv = mondo();
  for (const nome of VIETATI) { const x = await vai(mv, await evento({ nome })); esitiV.push([nome, x.stato]); }
  c("i nomi d'acquisto, in ogni scrittura, → 403 anche con permesso valido", VIETATI.map((n) => [n, 403]), esitiV);
  c("…e non parte nessuna chiamata esterna", 0, mv.fetches.length);
  const esitiN = [];
  const mn = mondo();
  for (const nome of ["Foo", "Lead", "", "addtocart", null, 42, {}, ["AddToCart"]]) { const x = await vai(mn, await evento({ nome })); esitiN.push(x.stato); }
  c("nome sconosciuto, `Lead` (resta su capi), vuoto, in minuscolo, non testo → 400", [400, 400, 400, 400, 400, 400, 400, 400], esitiN);
  c("…e nessuna chiamata", 0, mn.fetches.length);
  const mnn = mondo();
  const sta = [];
  for (const extra of [{ consenso: false }, { consenso: "true" }, { consenso: undefined }, { consenso: 1 }]) sta.push((await vai(mnn, await evento(extra))).stato);
  c("senza `consenso: true` (vero booleano) → 400", [400, 400, 400, 400], sta);
  const staId = [];
  for (const eventId of [undefined, "", "x".repeat(65), "evt 1", "evt/1", 42, "è"]) staId.push((await vai(mnn, await evento({ eventId }))).stato);
  c("event_id mancante, vuoto, oltre 64 segni, con spazi o segni strani, non testo → 400", staId.map(() => 400), staId);
  c("event_id di 64 segni → 200", 200, (await vai(mondo(), await evento({ eventId: "a".repeat(64) }))).stato);
  const staP = [];
  for (const [percorso, query] of [["/shop/ordine/HG-1", "t=abc"], ["/shop/ordine", ""], ["/CRM", ""], ["/preventivo", "sess=1"], ["/shop", "t=abc"], ["/shop", "anteprima=k"], ["/shop", "utm_source=a&watch=1"], ["/shop/qualcosa-di-nuovo", ""], [undefined, ""], [42, ""], ["", ""]]) staP.push((await vai(mnn, await evento({ percorso, query }))).stato);
  c("percorso non ammesso, o con una chiave vietata nella query → 400", staP.map(() => 400), staP);
  c("…nessuna chiamata esterna per tutti questi rifiuti", 0, mnn.fetches.length);
  c("query non testo: si ignora, il percorso decide (200)", 200, (await vai(mondo(), await evento({ query: { t: 1 } }))).stato);
  c("evento con prodotti ma senza id (AddToCart vuoto) → 400", 400, (await vai(mondo(), await evento({ dati: {} }))).stato);
  const strani = [];
  for (const corpo of [null, undefined, "testo", 42, [], true]) strani.push((await vai(mondo(), { corpo, ip: IP, userAgent: UA })).stato);
  c("corpo che non è un oggetto → 400", strani.map(() => 400), strani);

  /* ── il permesso ── */
  const mp = mondo();
  const sp = [];
  const buono = await evento();
  const vecchio = await evento({}, { ora: T0 - 11 * MIN });
  const alterato = await evento(); alterato.corpo.permesso = alterato.corpo.permesso.slice(0, -1) + (alterato.corpo.permesso.endsWith("a") ? "b" : "a");
  const altraChiave = await evento({ permesso: await P.emettiPermesso(await P.derivaChiave("altra"), T0) });
  for (const r of [vecchio, alterato, altraChiave, await evento({ permesso: undefined }), await evento({ permesso: "" }), await evento({ permesso: 42 }), await evento({ nome: "Purchase", permesso: "x" })]) sp.push((await vai(mp, r)).stato);
  c("permesso scaduto (+11 min), alterato, di un'altra chiave, mancante, vuoto, non testo → 401 (anche con un nome vietato: prima il permesso)", sp.map(() => 401), sp);
  c("…nessuna chiamata esterna e nessuna lettura delle impostazioni dei pixel", [0, 0], [mp.fetches.length, mp.db.chiamate.filter((x) => x.t === "tracking_config").length]);
  c("il permesso vale ancora a 9 minuti", 200, (await vai(mondo(), await evento({}, { ora: T0 - 9 * MIN }))).stato);

  /* ── chiave di servizio mancante: 503 e niente ── */
  const sc = [];
  for (const chiave of [null, undefined, "", 42]) { const mc = mondo({ chiave }); const x = await vai(mc, await evento()); sc.push([x.stato, x.corpo.ok, mc.fetches.length, mc.db.chiamate.length]); }
  c("chiave di servizio mancante → 503, {ok:false}, nessun invio, nessuna lettura", sc.map(() => [503, false, 0, 0]), sc);

  /* ── limite di frequenza (attrito, in memoria) ── */
  const ml = mondo();
  const lim = [];
  for (let i = 0; i < 61; i++) lim.push((await vai(ml, await evento({ eventId: `e${i}` }))).stato);
  c("i primi 60 eventi del minuto passano, il 61° → 429", [Array(60).fill(200), 429], [lim.slice(0, 60), lim[60]]);
  const altro = await evento({ eventId: "altro" }); altro.ip = "198.51.100.9";
  c("un altro indirizzo non è toccato dal limite", 200, (await vai(ml, altro)).stato);
  const fetchPrima = ml.fetches.length;
  await vai(ml, await evento({ eventId: "e-oltre" }));
  c("un evento oltre il limite non parte verso le piattaforme", fetchPrima, ml.fetches.length);
  ml.ora += 61_000;
  c("passato il minuto il limite si apre di nuovo", 200, (await vai(ml, await evento({ eventId: "e-dopo" }, { ora: ml.ora }))).stato);

  /* ── quali piattaforme: solo se ID e token ci sono ── */
  const soloT = mondo({ dbOpz: { config: [{ ...RIGA_CONFIG, meta_access_token: null }] } });
  await vai(soloT, await evento());
  c("Meta senza token: parte solo TikTok", [0, 1], [soloT.fetches.filter((f) => /facebook/.test(f.url)).length, soloT.fetches.filter((f) => /tiktok/.test(f.url)).length]);
  const soloM = mondo({ dbOpz: { config: [{ ...RIGA_CONFIG, tiktok_pixel_id: "" }] } });
  await vai(soloM, await evento());
  c("TikTok senza pixel: parte solo Meta", [1, 0], [soloM.fetches.filter((f) => /facebook/.test(f.url)).length, soloM.fetches.filter((f) => /tiktok/.test(f.url)).length]);
  const nessuna = mondo({ dbOpz: { config: [] } });
  const rn = await vai(nessuna, await evento());
  c("nessuna configurazione: 200, nessuna chiamata, niente nel registro degli esiti", [200, 0, 0], [rn.stato, nessuna.fetches.length, nessuna.db.esiti.length]);
  const dbRotto = mondo({ dbOpz: { tabellaConfigMancante: true } });
  c("tabella delle impostazioni illeggibile: 200, nessuna chiamata, nessuna eccezione", [200, 0], [(await vai(dbRotto, await evento())).stato, dbRotto.fetches.length]);
  const ESTRANEO = { ...RIGA_CONFIG, user_id: "u2", updated_at: "2026-12-01T00:00:00Z", meta_pixel_id: "999999999999", meta_access_token: "TOKEN-ESTRANEO", tiktok_pixel_id: "ESTRANEOPIXEL12345", tiktok_access_token: "TOKEN-ESTRANEO-TT" };
  const conEstraneo = mondo({ dbOpz: { config: [RIGA_CONFIG, ESTRANEO] } });
  await vai(conEstraneo, await evento());
  c("D35: la riga di un estraneo, PIÙ RECENTE e con ID e token diversi, è ignorata: si usano pixel e token del proprietario", ["123456789012345", "C1ABCDEF2GHIJKL3MNOP", false], [conEstraneo.fetches.find((f) => /facebook/.test(f.url))?.url.split("/")[4], conEstraneo.fetches.find((f) => /tiktok/.test(f.url))?.corpo.pixel_code, /ESTRANEO|999999999999/.test(JSON.stringify(conEstraneo.fetches))]);
  const soloEstraneo = mondo({ dbOpz: { config: [ESTRANEO] } });
  c("D35: se il proprietario non ha una riga, un estraneo non lo sostituisce: 200, nessuna chiamata", [200, 0], [(await vai(soloEstraneo, await evento())).stato, soloEstraneo.fetches.length]);
  const senzaProp = mondo({ dbOpz: { proprietari: [] } });
  c("D35: senza proprietario non parte niente (200, nessuna chiamata, nessun esito), anche se le righe hanno ID e token", [200, 0, 0], [(await vai(senzaProp, await evento())).stato, senzaProp.fetches.length, senzaProp.db.esiti.length]);
  const senzaTab = mondo({ dbOpz: { tabellaProprietarioMancante: true } });
  c("D35: tabella del proprietario assente (S3 non applicata): nessun invio, nessuna eccezione", [200, 0], [(await vai(senzaTab, await evento())).stato, senzaTab.fetches.length]);
  const duePro = mondo({ dbOpz: { config: [ESTRANEO, RIGA_CONFIG], proprietari: [{ user_id: "u2", creato_il: "2026-11-20T00:00:00Z" }, { user_id: "u1", creato_il: "2026-11-01T00:00:00Z" }] } });
  await vai(duePro, await evento());
  c("D35: con più proprietari vale il più vecchio (quello del seme)", "123456789012345", duePro.fetches.find((f) => /facebook/.test(f.url))?.url.split("/")[4]);

  /* ── il registro degli esiti ── */
  const me = mondo({ risposte: { meta: { ok: false, status: 400 } } });
  await vai(me, await evento());
  c("esiti: una riga per piattaforma con solo piattaforma, evento, event_id e un codice", [[{ piattaforma: "meta", evento: "AddToCart", event_id: "evt-0001", esito: "http_400" }, { piattaforma: "tiktok", evento: "AddToCart", event_id: "evt-0001", esito: "ok" }]], [me.db.esiti.map(({ creato_il, ...resto }) => resto)].map((x) => x));
  const mre = mondo({ risposte: { tiktok: { lancia: true } } });
  await vai(mre, await evento());
  c("esiti: rete assente → «errore_rete», mai il messaggio dell'errore", ["errore_rete", false], [mre.db.esiti.find((x) => x.piattaforma === "tiktok")?.esito, JSON.stringify(mre.db.esiti).includes(TOKEN_META)]);
  c("esiti: nessun dato personale, nessun token, nessun IP (scansione)", false, /TOKEN|203\.0\.113|Finto|@/.test(JSON.stringify([me.db.esiti, mre.db.esiti])));
  const mx = mondo({ dbOpz: { esitiRotta: true } });
  c("registro degli esiti mancante (S3 non applicata): l'evento parte lo stesso, risposta 200", [200, 2], [(await vai(mx, await evento())).stato, mx.fetches.length]);
  const mpul = mondo();
  await vai(mpul, await evento());
  const dele = () => mpul.db.chiamate.filter((x) => x.op === "delete");
  c("pulizia: la prima volta cancella gli esiti più vecchi di 30 giorni", [1, new Date(T0 - 30 * 24 * 60 * MIN).toISOString()], [dele().length, dele()[0]?.val]);
  await vai(mpul, await evento({ eventId: "e2" }));
  mpul.ora += 30 * MIN;
  await vai(mpul, await evento({ eventId: "e3" }, { ora: mpul.ora }));
  c("pulizia: al massimo una volta all'ora", 1, dele().length);
  mpul.ora += 40 * MIN;
  await vai(mpul, await evento({ eventId: "e4" }, { ora: mpul.ora }));
  c("pulizia: passata l'ora, di nuovo", 2, dele().length);
  const mdel = mondo({ dbOpz: { deleteRotta: true } });
  c("pulizia che fallisce: l'evento parte lo stesso", [200, 2], [(await vai(mdel, await evento())).stato, mdel.fetches.length]);

  /* ── il permesso: gestisciPermesso ── */
  gruppo("SHOP R1 · T25 · IL PERMESSO E LA CONFIGURAZIONE PUBBLICA (20/11/2026)");
  const mpe = mondo();
  const rp = await M.gestisciPermesso({ ip: IP }, mpe.deps);
  c("gestisciPermesso: 200 e un permesso che il mittente accetta", [200, true, true], [rp.stato, rp.corpo.ok, await P.verificaPermesso(rp.corpo.permesso, K, T0 + 9 * MIN)]);
  c("…che non è la chiave né la chiave derivata", [false, false], [JSON.stringify(rp).includes(CHIAVE), JSON.stringify(rp).includes(K)]);
  const rpc = await M.gestisciPermesso({ ip: IP }, mondo({ chiave: null }).deps);
  c("gestisciPermesso senza chiave di servizio: 503, nessun permesso", [503, false, undefined], [rpc.stato, rpc.corpo.ok, rpc.corpo.permesso]);
  const mpl = mondo();
  const sl = [];
  for (let i = 0; i < 61; i++) sl.push((await M.gestisciPermesso({ ip: IP }, mpl.deps)).stato);
  c("gestisciPermesso: il 61° del minuto → 429", [200, 429], [sl[59], sl[60]]);

  /* ── tracking-config: la riga del PROPRIETARIO (D35) ── */
  const PROP = { user_id: "u1", updated_at: "2026-11-01T00:00:00Z", meta_pixel_id: "123456789012345", tiktok_pixel_id: "C1ABCDEF2GHIJKL3MNOP", google_ga4_id: "G-TEST1234", google_ads_id: "AW-12345678", google_ads_label_acquisto: "abcDEF123", meta_access_token: "NON-DEVE-USCIRE", tiktok_access_token: "NON-DEVE-USCIRE", meta_test_event_code: "NON-DEVE-USCIRE", tiktok_test_event_code: "NON-DEVE-USCIRE" };
  const ESTR = { ...PROP, user_id: "u2", updated_at: "2026-12-01T00:00:00Z", meta_pixel_id: "999999999999", tiktok_pixel_id: "ESTRANEOPIXEL12345", google_ga4_id: "G-ESTRANEO1", google_ads_id: null };
  const SENZA_ID = { user_id: "u1", updated_at: "2026-11-19T00:00:00Z", meta_pixel_id: "", tiktok_pixel_id: "   ", google_ga4_id: null, google_ads_id: null, google_ads_label_acquisto: null };
  const VUOTO = { meta: null, tiktok: null, google: null };
  const tre = await CP.leggiConfigPubblica(fintoDb({ config: [PROP, ESTR] }));
  c("la riga di un estraneo, più recente e con ID diversi, viene ignorata: escono gli ID del proprietario", { meta: { pixelId: "123456789012345" }, tiktok: { pixelId: "C1ABCDEF2GHIJKL3MNOP" }, google: { ga4Id: "G-TEST1234", adsId: "AW-12345678", adsLabelAcquisto: "abcDEF123" } }, tre);
  c("…e non porta mai token né codici di prova", [], [JSON.stringify(tre)].filter((x) => /NON-DEVE|TOKEN|token|test|ESTRANEO|999999/.test(x)));
  c("senza proprietario non esce niente (anche se le righe hanno ID), e `tracking_config` non viene nemmeno letta", [VUOTO, 0], await (async () => { const db = fintoDb({ config: [PROP, ESTR], proprietari: [] }); return [await CP.leggiConfigPubblica(db), db.chiamate.filter((x) => x.t === "tracking_config").length]; })());
  c("tabella del proprietario assente (S3 non applicata) → tutto null, nessuna eccezione", VUOTO, await CP.leggiConfigPubblica(fintoDb({ tabellaProprietarioMancante: true })));
  c("il proprietario non ha una riga, un estraneo sì → tutto null (l'estraneo non lo sostituisce)", VUOTO, await CP.leggiConfigPubblica(fintoDb({ config: [ESTR] })));
  c("la riga del proprietario non ha ID → tutto null (anche se un estraneo più recente ne ha)", VUOTO, await CP.leggiConfigPubblica(fintoDb({ config: [SENZA_ID, ESTR] })));
  c("con più proprietari vale il più vecchio (quello del seme)", "123456789012345", (await CP.leggiConfigPubblica(fintoDb({ config: [ESTR, PROP], proprietari: [{ user_id: "u2", creato_il: "2026-11-20T00:00:00Z" }, { user_id: "u1", creato_il: "2026-11-01T00:00:00Z" }] }))).meta?.pixelId);
  const dbq = fintoDb({ config: [PROP, ESTR] });
  await CP.leggiConfigPubblica(dbq);
  const colonne = dbq.chiamate.map((x) => String(x.cols));
  c("la lettura chiede SOLO colonne pubbliche (mai `*`, mai token o codici di prova)", [], colonne.filter((x) => /\*|token|secret|test_event|spend|app_secret|verify/.test(x)));
  c("zero righe → tutto null, nessun errore", VUOTO, await CP.leggiConfigPubblica(fintoDb({ config: [] })));
  c("tabella delle impostazioni assente → tutto null, nessuna eccezione", VUOTO, await CP.leggiConfigPubblica(fintoDb({ tabellaConfigMancante: true })));
  c("solo Google Ads (senza GA4): Google c'è, Meta e TikTok no", { meta: null, tiktok: null, google: { ga4Id: null, adsId: "AW-12345678", adsLabelAcquisto: "abc" } }, await CP.leggiConfigPubblica(fintoDb({ config: [{ ...SENZA_ID, google_ads_id: "AW-12345678", google_ads_label_acquisto: "abc" }] })));
  c("gli ID si ripuliscono dagli spazi", "123456789012345", (await CP.leggiConfigPubblica(fintoDb({ config: [{ ...PROP, meta_pixel_id: "  123456789012345 " }] }))).meta?.pixelId);

  // la memoria di 5 minuti
  let ora = T0;
  const dbm = fintoDb({ config: [PROP] });
  const leggi = CP.creaLettoreConfig(dbm, () => ora);
  const lett = (db) => db.chiamate.filter((x) => x.t === "tracking_config").length;
  await leggi(); await leggi();
  c("memoria di 5 minuti: la seconda lettura non interroga il database", 1, lett(dbm));
  ora += 4 * MIN; await leggi();
  c("…a 4 minuti ancora in memoria", 1, lett(dbm));
  ora += 2 * MIN; await leggi();
  c("…a 6 minuti si rilegge", 2, lett(dbm));
  const dbe = fintoDb({ tabellaConfigMancante: true });
  const leggiE = CP.creaLettoreConfig(dbe, () => ora);
  await leggiE(); await leggiE();
  c("un errore di lettura non resta in memoria per 5 minuti (si riprova alla chiamata dopo)", 2, lett(dbe));
  const dbp = fintoDb({ tabellaProprietarioMancante: true });
  const leggiP = CP.creaLettoreConfig(dbp, () => ora);
  await leggiP(); await leggiP();
  c("anche con la tabella del proprietario assente si riprova (appena il titolare applica S3, i pixel compaiono)", 2, dbp.chiamate.length);

  /* ── le rotte sono sottili e non perdono segreti (sul sorgente) ── */
  const leggiF = (p) => readFileSync(join(radice, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const rotte = { evento: leggiF("src/routes/api.public.evento.ts"), permesso: leggiF("src/routes/api.public.evento-permesso.ts"), config: leggiF("src/routes/api.public.tracking-config.ts") };
  c("le tre rotte esistono col loro indirizzo", [true, true, true], [/createFileRoute\("\/api\/public\/evento"\)/.test(rotte.evento), /createFileRoute\("\/api\/public\/evento-permesso"\)/.test(rotte.permesso), /createFileRoute\("\/api\/public\/tracking-config"\)/.test(rotte.config)]);
  c("evento e permesso passano dal mittente (gestisciEvento / gestisciPermesso)", [true, true], [/gestisciEvento\(/.test(rotte.evento), /gestisciPermesso\(/.test(rotte.permesso)]);
  c("nessuna rotta apre l'accesso a tutti i siti (niente Access-Control-Allow-Origin: *) nelle due che scrivono", [false, false], [/Access-Control-Allow-Origin/.test(rotte.evento), /Access-Control-Allow-Origin/.test(rotte.permesso)]);
  c("la rotta degli eventi legge dalle intestazioni l'IP e lo user agent, e non dal corpo", [true, true], [/cf-connecting-ip/.test(rotte.evento), /user-agent/i.test(rotte.evento)]);
  c("la rotta della configurazione non nomina token, segreti né codici di prova, e non risponde con errori dettagliati", [false, false], [/access_token|secret|test_event/.test(rotte.config), /error\.message|e\.message|String\(e\)/.test(rotte.config)]);
  c("nessuna rotta scrive un token o una chiave in un registro (console.*)", [], Object.entries(rotte).filter(([, s]) => /console\.\w+\([^)]*(token|chiave|KEY|process\.env)/i.test(s)).map(([k]) => k));
  c("le rotte rispondono senza cache condivisa dove c'è un permesso o un evento", [true, true], [/no-store/.test(rotte.evento), /no-store/.test(rotte.permesso)]);
  c("il sorgente del mittente non scrive mai un token in un indirizzo (access_token nel corpo o in intestazione, non in `?access_token=`)", false, /\?access_token=|access_token=\$\{/.test(readFileSync(join(radice, "src/lib/tracciamento/mittente.ts"), "utf8")));
}
