/** ── SHOP R1 · T26 · IL CARICATORE DEGLI SCRIPT E L'API DEL BROWSER ──────────────────
 *  `src/lib/tracciamento/carica.ts` e `api.ts`. Qui non c'è un browser: c'è un DOCUMENTO FINTO che registra ogni
 *  script inserito (e a che punto erano le code dei pixel in quel momento: serve a provare l'ORDINE), una finestra
 *  finta, un `fetch` finto, un archivio finto. Nessuna rete, nessun ID vero (ID inventati).
 *  Cosa deve valere: senza scelta nessuno script e nessuna chiamata; con la scelta solo gli script permessi,
 *  una volta sola; i pixel con le impostazioni di D13; la revoca che ripulisce i cookie; la navigazione verso una
 *  pagina non ammessa che spegne tutto; lo stesso `event_id` nel browser e nel server. */

const CONFIG = {
  meta: { pixelId: "123456789012345" },
  tiktok: { pixelId: "C1ABCDEF2GHIJKL3MNOP" },
  google: { ga4Id: "G-TEST1234", adsId: "AW-12345678", adsLabelAcquisto: "abcDEF123" },
};
const NIENTE = { scelto: false, statistiche: false, marketing: false, ts: 0 };
const NECESSARI = { scelto: true, statistiche: false, marketing: false, ts: 1 };
const STATISTICHE = { scelto: true, statistiche: true, marketing: false, ts: 1 };
const MARKETING = { scelto: true, statistiche: true, marketing: true, ts: 1 };
const TUTTO_NEGATO = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };

/** Il mondo finto: documento, finestra, e il registro di quel che succede. */
function mondo({ host = "www.sito.test", path = "/shop", search = "", cookie = "", admin = false, cornice = false, referrer = "", tiktok = true } = {}) {
  const m = { scripts: [], cookieScritti: [], reloads: 0, cookie, localStorage: {}, rimossi: [], pushate: [], sostituite: [], navigazioni: [], ascoltatori: [], meta: null };
  m.documento = {
    referrer,
    get cookie() { return m.cookie; },
    set cookie(v) { m.cookieScritti.push(String(v)); },
    createElement: (tag) => (tag === "meta" ? { tag, remove() { m.meta = null; } } : { tag }),
    querySelector: (sel) => (sel === "#hgl-referrer" ? m.meta : null),
    head: {
      appendChild: (n) => n.tag === "meta" ? void (m.meta = n) : m.scripts.push({ src: n.src, async: n.async, dl: (m.finestra.dataLayer ?? []).length, fq: m.finestra.fbq?.queue?.length ?? -1, dp: m.finestra.fbq?.disablePushState }),
    },
  };
  m.finestra = {
    location: { hostname: host, pathname: path, search, origin: `https://${host}`, reload: () => { m.reloads++; }, assign: (u) => m.navigazioni.push(u) },
    addEventListener: (tipo, f, cattura) => m.ascoltatori.push({ tipo, f, cattura, scriptGiaDentro: m.scripts.length }),
    history: { pushState(...a) { m.pushate.push({ questo: this === m.finestra.history, a }); }, replaceState(...a) { m.sostituite.push({ questo: this === m.finestra.history, a }); } },
    localStorage: { removeItem: (k) => m.rimossi.push(k), getItem: (k) => m.localStorage[k] ?? null, setItem: (k, v) => { m.localStorage[k] = String(v); } },
  };
  m.porte = { documento: m.documento, finestra: m.finestra, admin: () => admin, inCornice: () => cornice, tiktokNelBrowser: tiktok };
  /** Indietro/avanti: l'indirizzo cambia, poi scattano gli ascoltatori di `popstate` (prima quelli in cattura). */
  m.indietro = (pathname, search = "") => { m.finestra.location.pathname = pathname; m.finestra.location.search = search; for (const a of [...m.ascoltatori].filter((x) => x.tipo === "popstate").sort((x, y) => Number(!!y.cattura) - Number(!!x.cattura))) a.f(); };
  return m;
}
const chiamate = (lista) => (lista ?? []).map((x) => Array.from(x));
const dl = (m) => chiamate(m.finestra.dataLayer);
const fq = (m) => chiamate(m.finestra.fbq?.queue);
const tq = (m) => (m.finestra.ttq ?? []).map((x) => (Array.isArray(x) ? x : Array.from(x)));
const srcs = (m) => m.scripts.map((s) => s.src);

export async function prove(mod, { c, gruppo }) {
  const K = mod["lib/tracciamento/carica"];
  const API = mod["lib/tracciamento/api"];
  gruppo("SHOP R1 · T26 · IL CARICATORE DEGLI SCRIPT (20/11/2026)");
  c("i moduli ci sono", [true, true], [typeof K?.creaCaricatore === "function", typeof API?.creaApi === "function"]);
  if (!K?.creaCaricatore || !API?.creaApi) return;
  const nuovo = (opz) => { const m = mondo(opz); m.car = K.creaCaricatore(m.porte); return m; };

  /* ── senza scelta, solo necessari ── */
  const a = nuovo();
  a.car.applicaConsenso(NIENTE, CONFIG);
  c("senza scelta: 0 script, nessun pixel, nessun cookie toccato, nessuna ricarica", [0, false, false, false, 0, 0, 0], [a.scripts.length, "fbq" in a.finestra, "ttq" in a.finestra, "dataLayer" in a.finestra, a.cookieScritti.length, a.reloads, a.rimossi.length]);
  const b = nuovo();
  b.car.applicaConsenso(NECESSARI, CONFIG);
  c("solo necessari: 0 script esterni, nessun pixel", [0, false, false, false], [b.scripts.length, "fbq" in b.finestra, "ttq" in b.finestra, "dataLayer" in b.finestra]);
  c("applicaConsenso con consenso o config nulli: non lancia, 0 script", [0, 0, 0], [(() => { const x = nuovo(); x.car.applicaConsenso(null, CONFIG); x.car.applicaConsenso(MARKETING, null); x.car.applicaConsenso(MARKETING, {}); return x.scripts.length; })(), 0, 0]);

  /* ── statistiche: solo Google, in ordine ── */
  const s = nuovo();
  s.car.applicaConsenso(STATISTICHE, CONFIG);
  c("statistiche: un solo script, quello di Google (gtag.js con l'ID di GA4), asincrono", [["https://www.googletagmanager.com/gtag/js?id=G-TEST1234"], [true]], [srcs(s), s.scripts.map((x) => x.async)]);
  c("statistiche: nessun pixel di Meta o di TikTok", [false, false], ["fbq" in s.finestra, "ttq" in s.finestra]);
  const dls = dl(s);
  c("Google: la PRIMA chiamata è `consent default` con tutto negato", ["consent", "default", TUTTO_NEGATO.analytics_storage, TUTTO_NEGATO.ad_storage, TUTTO_NEGATO.ad_user_data, TUTTO_NEGATO.ad_personalization],
    [dls[0][0], dls[0][1], dls[0][2].analytics_storage, dls[0][2].ad_storage, dls[0][2].ad_user_data, dls[0][2].ad_personalization]);
  c("Google: il `default` c'è PRIMA dello script (almeno una chiamata già in coda quando lo script entra)", true, s.scripts[0].dl >= 1);
  const iUpd = dls.findIndex((x) => x[0] === "consent" && x[1] === "update");
  c("Google: l'`update` viene DOPO il default e dopo l'inserimento dello script", [true, true], [iUpd > 0, iUpd >= s.scripts[0].dl]);
  c("Google: l'`update` con le sole statistiche: analytics granted, tutto il resto denied", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }, dls[iUpd]?.[2]);
  const conf = dls.find((x) => x[0] === "config" && x[1] === "G-TEST1234");
  c("GA4: `config` con send_page_view false e senza i segnali pubblicitari (non c'è marketing)", [false, false, false], [conf?.[2]?.send_page_view, conf?.[2]?.allow_google_signals, conf?.[2]?.allow_ad_personalization_signals]);
  c("senza marketing: ads_data_redaction acceso e nessun `config` di Google Ads", [true, false], [dls.some((x) => x[0] === "set" && x[1] === "ads_data_redaction" && x[2] === true), dls.some((x) => x[0] === "config" && x[1] === "AW-12345678")]);
  c("la funzione gtag è quella di Google (mette in coda gli `arguments`, non un array)", true, Object.prototype.toString.call(s.finestra.dataLayer[0]) === "[object Arguments]");

  /* ── marketing: Meta, TikTok, Google ── */
  const k = nuovo();
  k.car.applicaConsenso(MARKETING, CONFIG);
  c("marketing: gli script sono Google, Meta e TikTok, uno per uno", ["https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=C1ABCDEF2GHIJKL3MNOP&lib=ttq", "https://connect.facebook.net/en_US/fbevents.js", "https://www.googletagmanager.com/gtag/js?id=G-TEST1234"], srcs(k).sort());
  const f = fq(k);
  const iAuto = f.findIndex((x) => x[0] === "set" && x[1] === "autoConfig");
  const iInit = f.findIndex((x) => x[0] === "init");
  c("Meta: `autoConfig` false per quel pixel, PRIMA di `init`", [true, ["set", "autoConfig", false, "123456789012345"], true], [iAuto >= 0 && iAuto < iInit, f[iAuto], iInit >= 0]);
  c("Meta: `init` ha il solo ID (nessun dato utente: l'abbinamento lo fa il server con l'hash)", ["init", "123456789012345"], f[iInit]);
  c("Meta: il pixel non manda un PageView da sé (lo emette il provider, D19)", false, f.some((x) => x[0] === "track"));
  c("Meta: i due passi di preparazione sono già in coda quando lo script entra", true, k.scripts.find((x) => /fbevents/.test(x.src)).fq >= 2);
  c("TikTok: il pixel è caricato con il suo ID e NON parte `page()` da solo", [true, false], [!!k.finestra.ttq?._i?.["C1ABCDEF2GHIJKL3MNOP"], tq(k).some((x) => x[0] === "page")]);
  const dlk = dl(k);
  c("marketing: Google ha `update` con tutto granted e `config` col segnale pubblicitario acceso", ["granted", true, true], [dlk.find((x) => x[1] === "update")?.[2]?.ad_personalization, dlk.find((x) => x[0] === "config" && x[1] === "G-TEST1234")?.[2]?.allow_google_signals, dlk.find((x) => x[0] === "config" && x[1] === "G-TEST1234")?.[2]?.allow_ad_personalization_signals]);
  c("marketing: c'è la configurazione di Google Ads e nessun ads_data_redaction", [true, false], [dlk.some((x) => x[0] === "config" && x[1] === "AW-12345678"), dlk.some((x) => x[0] === "set" && x[1] === "ads_data_redaction" && x[2] === true)]);
  c("lo script di Google è uno solo (GA4 e Ads viaggiano insieme)", 1, srcs(k).filter((x) => /googletagmanager/.test(x)).length);

  /* ── mai due volte, e l'avanzamento di scelta ── */
  k.car.applicaConsenso(MARKETING, CONFIG);
  k.car.applicaConsenso(MARKETING, CONFIG);
  c("applicaConsenso ripetuto: gli script non si duplicano", 3, k.scripts.length);
  c("…e le code dei pixel non ricevono due volte `init` né `load`", [1, 1], [fq(k).filter((x) => x[0] === "init").length, dl(k).filter((x) => x[0] === "config" && x[1] === "G-TEST1234").length]);
  const up = nuovo();
  up.car.applicaConsenso(STATISTICHE, CONFIG);
  up.car.applicaConsenso(MARKETING, CONFIG);
  c("da statistiche a marketing: arrivano Meta e TikTok, Google resta uno", [3, 1], [up.scripts.length, srcs(up).filter((x) => /googletagmanager/.test(x)).length]);
  c("…e Google riceve il nuovo `update` con la pubblicità concessa, e il segnale pubblicitario si accende", [true, true],
    [dl(up).filter((x) => x[1] === "update").at(-1)?.[2]?.ad_storage === "granted", dl(up).filter((x) => x[0] === "config" && x[1] === "G-TEST1234").at(-1)?.[2]?.allow_ad_personalization_signals === true]);

  /* ── config assente o sbagliata ── */
  c("config vuota: nessuno script; solo Meta: solo Meta", [0, 1], [(() => { const x = nuovo(); x.car.applicaConsenso(MARKETING, { meta: null, tiktok: null, google: null }); return x.scripts.length; })(), (() => { const x = nuovo(); x.car.applicaConsenso(MARKETING, { meta: CONFIG.meta, tiktok: null, google: null }); return x.scripts.length; })()]);
  const cattivi = [{ meta: { pixelId: "1'];alert(1)//" } }, { tiktok: { pixelId: "x\" onload=\"y" } }, { google: { ga4Id: "G-1&x=<script>", adsId: "AW-../x", adsLabelAcquisto: "a" } }, { meta: { pixelId: 12345678901 } }, { google: { ga4Id: "", adsId: null } }];
  c("ID dal formato strano: non si carica nessuno script (niente codice dentro gli indirizzi)", [0, 0, 0, 0, 0], cattivi.map((cfg) => { const x = nuovo(); x.car.applicaConsenso(MARKETING, { meta: null, tiktok: null, google: null, ...cfg }); return x.scripts.length; }));
  c("solo Google Ads (senza GA4): lo script entra con l'ID di Ads", ["https://www.googletagmanager.com/gtag/js?id=AW-12345678"], (() => { const x = nuovo(); x.car.applicaConsenso(MARKETING, { google: { ga4Id: null, adsId: "AW-12345678", adsLabelAcquisto: null } }); return srcs(x); })());

  /* ── Meta e TikTok non seguono da soli i cambi di pagina (pushState) ── */
  c("Meta: `fbq.disablePushState = true` già impostato quando lo script di Meta entra nella pagina", [true, true], [k.scripts.find((x) => /fbevents/.test(x.src)).dp, k.finestra.fbq.disablePushState]);
  const g0 = nuovo();
  g0.finestra.fbq = Object.assign(function () {}, { queue: [] });
  g0.car.applicaConsenso(MARKETING, CONFIG);
  c("…anche se `fbq` c'era già (messo da altri)", true, g0.finestra.fbq.disablePushState);

  /* ── la guardia del router: pushState / replaceState verso una pagina non ammessa ── */
  const gp = nuovo({ path: "/shop" });
  gp.car.applicaConsenso(MARKETING, CONFIG);
  gp.finestra.history.pushState({ x: 1 }, "", "/shop/carrello?utm_source=a");
  c("verso una pagina ammessa: la navigazione prosegue com'è (stesso `this`, stessi argomenti), niente sospensione", [1, true, [{ x: 1 }, "", "/shop/carrello?utm_source=a"], false, 0], [gp.pushate.length, gp.pushate[0]?.questo, gp.pushate[0]?.a, gp.car.sospeso(), gp.navigazioni.length]);
  gp.finestra.history.pushState({}, "", "/shop/ordine/HG-1?t=abc");
  c("verso /shop/ordine/x?t=…: PRIMA che l'indirizzo cambi si spegne tutto e si naviga con una pagina nuova (l'indirizzo NON passa dal router)", [1, true, ["https://www.sito.test/shop/ordine/HG-1?t=abc"]], [gp.pushate.length, gp.car.sospeso(), gp.navigazioni]);
  c("…e Meta e Google sono già a tacere in quel momento (consent revoke / denied)", [true, true], [fq(gp).some((x) => x[0] === "consent" && x[1] === "revoke"), JSON.stringify(dl(gp).filter((x) => x[1] === "update").at(-1)?.[2]) === JSON.stringify(TUTTO_NEGATO)]);
  const gr = nuovo({ path: "/shop" });
  gr.car.applicaConsenso(MARKETING, CONFIG);
  gr.finestra.history.replaceState(null, "", "https://www.sito.test/CRM/leads");
  c("replaceState verso una pagina non ammessa (indirizzo intero): stessa guardia", [0, true, ["https://www.sito.test/CRM/leads"]], [gr.sostituite.length, gr.car.sospeso(), gr.navigazioni]);
  const gq = nuovo({ path: "/shop" });
  gq.car.applicaConsenso(MARKETING, CONFIG);
  gq.finestra.history.pushState(null, "", "/shop/prodotto/x?qualcosa=Y");
  c("verso una pagina con una chiave sconosciuta (lista bianca): stessa guardia", [0, 1], [gq.pushate.length, gq.navigazioni.length]);
  const gs = nuovo({ path: "/shop" });
  gs.finestra.history.pushState(null, "", "/shop/ordine/HG-1?t=abc");
  c("senza script caricati la guardia non fa niente: la navigazione prosegue", [1, 0, false], [gs.pushate.length, gs.navigazioni.length, gs.car.sospeso()]);
  const gx = nuovo({ path: "/shop" });
  gx.car.applicaConsenso(MARKETING, CONFIG);
  gx.finestra.history.pushState(null, "", "https://altro.test/x");
  gx.finestra.history.pushState(null, "");
  gx.finestra.history.pushState(null, "", null);
  c("destinazione di un altro sito o senza indirizzo: non è affar nostro, passa al router vero", [3, 0, false], [gx.pushate.length, gx.navigazioni.length, gx.car.sospeso()]);
  const gn = mondo({ path: "/shop" });
  delete gn.finestra.history;
  let eh = null;
  try { K.creaCaricatore(gn.porte).applicaConsenso(MARKETING, CONFIG); } catch (e) { eh = String(e); }
  c("senza `history` (ambiente senza router) non lancia", null, eh);
  c("dentro una cornice non c'è nessuno script: nessuna deviazione, la navigazione prosegue", [1, 0], (() => { const x = nuovo({ cornice: true }); x.car.applicaConsenso(MARKETING, CONFIG); x.finestra.history.pushState(null, "", "/shop/ordine/x?t=1"); return [x.pushate.length, x.navigazioni.length]; })());

  /* ── indietro/avanti (popstate): l'indirizzo è già cambiato, si spegne prima che parta un evento ── */
  const po = nuovo({ path: "/shop" });
  c("l'ascoltatore di popstate è registrato alla creazione, in fase di cattura, quando non c'è ancora nessuno script", [1, true, 0], [po.ascoltatori.filter((x) => x.tipo === "popstate").length, po.ascoltatori[0]?.cattura, po.ascoltatori[0]?.scriptGiaDentro]);
  po.car.applicaConsenso(MARKETING, CONFIG);
  c("…e resta uno solo anche dopo aver caricato gli script", 1, po.ascoltatori.filter((x) => x.tipo === "popstate").length);
  po.indietro("/shop/carrello");
  c("indietro/avanti verso una pagina AMMESSA: niente sospensione, niente ricarica", [false, 0], [po.car.sospeso(), po.reloads]);
  po.indietro("/shop/ordine/HG-1", "?t=abc");
  c("indietro/avanti verso una pagina NON ammessa con gli script caricati: sospendi e ricarica subito", [true, 1], [po.car.sospeso(), po.reloads]);
  c("…Meta e Google già a tacere (consent revoke / tutto denied) e `ga-disable` acceso", [true, true, true], [fq(po).some((x) => x[0] === "consent" && x[1] === "revoke"), JSON.stringify(dl(po).filter((x) => x[1] === "update").at(-1)?.[2]) === JSON.stringify(TUTTO_NEGATO), po.finestra["ga-disable-G-TEST1234"] === true]);
  const pq = nuovo({ path: "/shop" });
  pq.car.applicaConsenso(MARKETING, CONFIG);
  pq.indietro("/shop", "?ref_code=X");
  c("indietro verso un indirizzo con una chiave sconosciuta (lista bianca): stessa sospensione", [true, 1], [pq.car.sospeso(), pq.reloads]);
  const pn = nuovo({ path: "/shop" });
  pn.indietro("/CRM/leads");
  c("senza script caricati popstate non fa niente", [false, 0], [pn.car.sospeso(), pn.reloads]);
  const pa = nuovo({ path: "/shop", admin: true });
  pa.indietro("/CRM/leads");
  c("a un amministratore (nessuno script) nemmeno", [false, 0], [pa.car.sospeso(), pa.reloads]);
  const pg = mondo({ path: "/shop" });
  delete pg.finestra.addEventListener;
  let ep = null;
  try { K.creaCaricatore(pg.porte).applicaConsenso(MARKETING, CONFIG); } catch (e) { ep = String(e); }
  c("senza addEventListener non lancia", null, ep);

  /* ── TikTok nel browser: spento di default ── */
  const tt = mondo({ path: "/shop" });
  delete tt.porte.tiktokNelBrowser;
  const ttc = K.creaCaricatore(tt.porte);
  ttc.applicaConsenso(MARKETING, CONFIG);
  c("TikTok nel browser è spento di default: nessuno script e nessun `ttq` (gli eventi vanno a TikTok dal server); Meta e Google caricano", [false, 2, true], ["ttq" in tt.finestra || tt.scripts.some((x) => /tiktok/.test(x.src)), tt.scripts.length, ttc.caricati().meta && ttc.caricati().google && !ttc.caricati().tiktok]);
  c("con `tiktokNelBrowser: true` (come nelle altre prove) TikTok si carica e l'API gli manda gli eventi", true, "ttq" in k.finestra);

  /* ── dove non si carica: admin, cornice, pagine non ammesse ── */
  const casiNo = [
    ["admin loggato", { admin: true }],
    ["dentro una cornice (anteprima del CMS)", { cornice: true }],
    ["/shop/ordine/x?t=1", { path: "/shop/ordine/x", search: "?t=1" }],
    ["/invisible-derm?watch=ABC", { path: "/invisible-derm", search: "?watch=ABC" }],
    ["/CRM/ecommerce", { path: "/CRM/ecommerce" }],
    ["/shop/prodotto/x?anteprima=k", { path: "/shop/prodotto/x", search: "?anteprima=k" }],
  ];
  for (const [nome, opz] of casiNo) {
    const x = nuovo(opz);
    x.car.applicaConsenso(MARKETING, CONFIG);
    c(`con tutto il consenso ma ${nome}: 0 script, nessun pixel, nessuna ricarica`, [0, false, false, 0], [x.scripts.length, "fbq" in x.finestra, "dataLayer" in x.finestra, x.reloads]);
  }

  /* ── la navigazione verso una pagina non ammessa ── */
  const n = nuovo({ path: "/shop" });
  n.car.applicaConsenso(MARKETING, CONFIG);
  n.finestra.location.pathname = "/shop/carrello";
  n.car.applicaConsenso(MARKETING, CONFIG);
  c("da /shop a /shop/carrello (ammessa): niente sospensione, niente ricarica", [0, false], [n.reloads, n.car.sospeso()]);
  n.finestra.location.pathname = "/shop/ordine/HG-1";
  n.finestra.location.search = "?t=1";
  n.car.applicaConsenso(MARKETING, CONFIG);
  c("da /shop a /shop/ordine/x?t=1 con gli script caricati: sospende e ricarica una volta", [true, 1], [n.car.sospeso(), n.reloads]);
  c("sospendi: Meta `consent revoke`; Google: update con tutto negato e `ga-disable` sull'ID; TikTok senza cookie", [true, true, true, true, true],
    [fq(n).some((x) => x[0] === "consent" && x[1] === "revoke"),
      JSON.stringify(dl(n).filter((x) => x[1] === "update").at(-1)?.[2]) === JSON.stringify(TUTTO_NEGATO),
      n.finestra["ga-disable-G-TEST1234"] === true, n.finestra["ga-disable-AW-12345678"] === true,
      tq(n).some((x) => x[0] === "disableCookie")]);
  n.car.applicaConsenso(MARKETING, CONFIG);
  n.finestra.location.pathname = "/shop";
  n.finestra.location.search = "";
  n.car.applicaConsenso(MARKETING, CONFIG);
  c("sospeso resta sospeso: niente nuove ricariche, niente nuovi script", [1, 3], [n.reloads, n.scripts.length]);
  const v = nuovo({ path: "/shop/ordine/x", search: "?t=1" });
  v.car.applicaConsenso(MARKETING, CONFIG);
  c("pagina non ammessa senza script caricati: nessuna ricarica", [0, false], [v.reloads, v.car.sospeso()]);
  const dip = nuovo({ path: "/shop" });
  dip.car.applicaConsenso(STATISTICHE, CONFIG);
  dip.finestra.location.pathname = "/CRM";
  dip.car.applicaConsenso(STATISTICHE, CONFIG);
  c("anche con solo Google caricato, andare in /CRM sospende e ricarica", [true, 1], [dip.car.sospeso(), dip.reloads]);

  /* ── la revoca: prima si sospende, poi si ripulisce (anche i `_gac_` di Google Ads) ── */
  const rv = nuovo({ host: "www.sito.test", cookie: "_gac_UA-123=1; _gac_gb_G-TEST1234=2; _gaxyz=no; sessione=tienimi" });
  rv.car.applicaConsenso(MARKETING, CONFIG);
  rv.cookieScritti.length = 0;
  rv.car.revoca();
  c("revoca: cancella anche i cookie `_gac_*` di Google Ads (e non quelli che gli somigliano)", [true, true, false, false], [rv.cookieScritti.some((x) => x.startsWith("_gac_UA-123=;")), rv.cookieScritti.some((x) => x.startsWith("_gac_gb_G-TEST1234=;")), rv.cookieScritti.some((x) => x.startsWith("_gaxyz=")), rv.cookieScritti.some((x) => x.startsWith("sessione="))]);
  c("revoca chiama `sospendi()` all'inizio: Meta `consent revoke`, Google tutto negato e `ga-disable`, e non si emette più niente", [true, true, true, true], [fq(rv).some((x) => x[0] === "consent" && x[1] === "revoke"), JSON.stringify(dl(rv).filter((x) => x[1] === "update").at(-1)?.[2]) === JSON.stringify(TUTTO_NEGATO), rv.finestra["ga-disable-G-TEST1234"] === true, rv.car.sospeso()]);
  const rvOrdine = nuovo({ cookie: "_fbp=x" });
  rvOrdine.car.applicaConsenso(MARKETING, CONFIG);
  const eventiPrima = rvOrdine.cookieScritti.length;
  rvOrdine.car.revoca();
  c("revoca: la sospensione precede la cancellazione dei cookie (il `consent revoke` è già in coda e i cookie si scrivono dopo)", [true, true], [fq(rvOrdine).some((x) => x[0] === "consent" && x[1] === "revoke"), rvOrdine.cookieScritti.length > eventiPrima]);

  /* ── su una pagina non ammessa il referrer completo non esce ── */
  const rf = nuovo({ path: "/shop/ordine/HG-1", search: "?t=abc" });
  rf.car.applicaConsenso(NIENTE, CONFIG);
  c("pagina non ammessa: c'è `<meta name=\"referrer\" content=\"strict-origin\">` (esce solo l'origine; con no-referrer YouTube rifiuta i lettori, errore 153), anche senza consenso e senza script", [true, "referrer", "strict-origin", 0], [!!rf.meta, rf.meta?.name, rf.meta?.content, rf.scripts.length]);
  rf.car.applicaConsenso(NIENTE, CONFIG);
  c("…una volta sola, non si duplica", true, !!rf.meta);
  rf.finestra.location.pathname = "/shop";
  rf.finestra.location.search = "";
  rf.car.applicaConsenso(NIENTE, CONFIG);
  c("tornando in una pagina ammessa il meta si toglie", null, rf.meta);
  const rfa = nuovo({ path: "/shop" });
  rfa.car.applicaConsenso(MARKETING, CONFIG);
  c("pagina ammessa: nessun meta", null, rfa.meta);
  const rfc = nuovo({ path: "/shop", cornice: true });
  rfc.car.applicaConsenso(NIENTE, CONFIG);
  c("in una cornice (non ammessa) c'è", true, !!rfc.meta);
  const rfd = nuovo({ path: "/CRM/leads" });
  delete rfd.documento.querySelector;
  let er = null;
  try { rfd.car.applicaConsenso(NIENTE, CONFIG); } catch (e) { er = String(e); }
  c("documento senza querySelector: non lancia", null, er);

  /* ── la revoca ── */
  const COOKIE = "_fbp=fb.1.2; _fbc=fb.1.3; _ga=GA1.2; _ga_ABC123=GS1; _gid=GA1.3; _gcl_au=1.1; _gcl_aw=2; _ttp=tt; lp_external_id=x; sessione=tienimi; _gatto=non_mio";
  const r = nuovo({ host: "www.sito.test", cookie: COOKIE });
  r.car.applicaConsenso(MARKETING, CONFIG);
  r.cookieScritti.length = 0;
  r.car.revoca();
  const scritti = r.cookieScritti;
  const dominiDi = (nome) => scritti.filter((x) => x.startsWith(`${nome}=;`)).map((x) => (/domain=([^;]+)/.exec(x) || [])[1] ?? "(host)").sort();
  const DOMINI = ["(host)", ".sito.test", ".www.sito.test", "www.sito.test"];
  c("revoca: ogni cookie delle piattaforme si cancella su host, `host`, `.host` e sul dominio padre", [], ["_fbp", "_fbc", "_ga", "_ga_ABC123", "_gid", "_gcl_au", "_gcl_aw", "_ttp", "lp_external_id"].filter((nome) => JSON.stringify(dominiDi(nome)) !== JSON.stringify(DOMINI)).map((nome) => [nome, dominiDi(nome)]));
  c("revoca: ogni cancellazione ha path=/ e una scadenza nel passato", true, scritti.length > 0 && scritti.every((x) => /path=\//.test(x) && /expires=Thu, 01 Jan 1970/.test(x) && /max-age=0/.test(x)));
  c("revoca: i cookie che non sono delle piattaforme non si toccano (nemmeno «_gatto», che somiglia a «_ga»)", [], scritti.filter((x) => /^(sessione|_gatto)=/.test(x)));
  c("revoca: `lp_external_id` e la storia dei contatti `lp_touch_history` si tolgono dall'archivio del browser, e si chiede la ricarica (una sola)", [true, true, 1], [r.rimossi.includes("lp_external_id"), r.rimossi.includes("lp_touch_history"), r.reloads]);
  c("revoca: se l'archivio lancia sulla prima chiave, la seconda si toglie lo stesso", true, (() => { const x = nuovo({}); const tolte = []; x.finestra.localStorage.removeItem = (k) => { if (k === "lp_external_id") throw new Error("bloccato"); tolte.push(k); }; x.car.revoca(); return tolte.includes("lp_touch_history"); })());
  c("revoca: cancella anche i cookie che non erano in elenco ma cominciano per `_ga_` o `_gcl_`", true, (() => { const x = nuovo({ cookie: "_ga_ZZZ999=1; _gcl_dc=2" }); x.car.revoca(); return x.cookieScritti.some((s) => s.startsWith("_ga_ZZZ999=;")) && x.cookieScritti.some((s) => s.startsWith("_gcl_dc=;")); })());
  const r2 = nuovo({ host: "sito.test" });
  r2.car.revoca();
  c("revoca su un dominio di due parti: host, `sito.test`, `.sito.test`, e non `.test`", [true, false], [r2.cookieScritti.some((x) => /^_fbp=;.*domain=\.sito\.test/.test(x)), r2.cookieScritti.some((x) => /domain=\.test(;|$)/.test(x))]);
  const r3 = nuovo({ host: "localhost" });
  r3.car.revoca();
  c("revoca su localhost o su un indirizzo numerico: solo il cookie dell'host, nessun domain=", [true, true], [r3.cookieScritti.length > 0 && r3.cookieScritti.every((x) => !/domain=/.test(x)), (() => { const y = nuovo({ host: "127.0.0.1" }); y.car.revoca(); return y.cookieScritti.every((x) => !/domain=/.test(x)); })()]);
  const r4 = nuovo({ host: "www.sito.test" });
  Object.defineProperty(r4.documento, "cookie", { get() { throw new Error("cookie bloccati"); }, set() { throw new Error("cookie bloccati"); } });
  let err = null;
  try { r4.car.revoca(); } catch (e) { err = String(e); }
  c("revoca con i cookie bloccati dal browser: non lancia e chiede comunque la ricarica", [null, 1], [err, r4.reloads]);

  /* ── L'API DEL BROWSER: emettiEvento ── */
  gruppo("SHOP R1 · T26 · API DEL BROWSER: emettiEvento, emettiSoloContatore (20/11/2026)");
  const ID = /^[0-9a-f-]{36}$/;
  function sito({ consenso = MARKETING, path = "/shop/prodotto/lace-front", search = "?utm_source=meta", admin = false, cornice = false, adesso = 1_800_000_000_000, referrer = "https://l.facebook.com/l.php?u=x" } = {}) {
    const m = mondo({ path, search, admin, cornice, referrer });
    m.car = K.creaCaricatore(m.porte);
    m.fetchLog = [];
    m.contatori = [];
    m.ora = adesso;
    m.fetch = async (url, init = {}) => {
      m.fetchLog.push({ url: String(url), metodo: init.method ?? "GET", corpo: init.body ? JSON.parse(init.body) : null });
      return { ok: true, status: 200, json: async () => ({ permesso: "1800000600000.permesso-finto" }) };
    };
    m.api = API.creaApi({ finestra: m.finestra, fetch: m.fetch, adesso: () => m.ora, caricatore: m.car, consenso: () => consenso, contatore: (n, p) => m.contatori.push([n, p]) });
    if (consenso.scelto) m.car.applicaConsenso(consenso, CONFIG);
    return m;
  }
  const dati = { contentIds: ["HG-001"], contentType: "product", valueCent: 2890, numItems: 1 };

  const e = sito();
  const id = e.api.emettiEvento("AddToCart", dati);
  await e.api.scarica();
  c("emettiEvento con consenso marketing restituisce un event_id", true, ID.test(id));
  const fb = fq(e).find((x) => x[0] === "track");
  const tk = tq(e).find((x) => x[0] === "track");
  const gt = dl(e).find((x) => x[0] === "event");
  c("Meta: fbq('track','AddToCart', parametri, {eventID}) con lo stesso id", ["track", "AddToCart", id], [fb?.[0], fb?.[1], fb?.[3]?.eventID]);
  c("Meta: i parametri hanno i prodotti e il valore in euro", { content_ids: ["HG-001"], content_type: "product", currency: "EUR", value: 28.9, num_items: 1 }, fb?.[2]);
  c("TikTok: ttq.track('AddToCart', parametri, {event_id}) con lo stesso id", ["track", "AddToCart", id], [tk?.[0], tk?.[1], tk?.[3]?.event_id]);
  c("Google: gtag('event','add_to_cart', …) con valore e articoli", ["event", "add_to_cart", 28.9, [{ item_id: "HG-001" }]], [gt?.[0], gt?.[1], gt?.[2]?.value, gt?.[2]?.items]);
  c("il server: prima chiede il permesso, poi manda l'evento (due chiamate)", [["GET", "/api/public/evento-permesso"], ["POST", "/api/public/evento"]], e.fetchLog.map((x) => [x.metodo, x.url]));
  const corpo = e.fetchLog[1]?.corpo ?? {};
  c("la richiesta al server ha lo STESSO event_id, il permesso e `consenso: true`", [id, "1800000600000.permesso-finto", true, "AddToCart"], [corpo.eventId, corpo.permesso, corpo.consenso, corpo.nome]);
  c("la richiesta porta il percorso e le sole chiavi ammesse (niente indirizzo intero)", ["/shop/prodotto/lace-front", "utm_source=meta"], [corpo.percorso, corpo.query]);
  c("…e nessun dato personale né altro indirizzo nel corpo", false, /@|https?:|sito\.test|"fbp"|"fbc"|email|telefono/i.test(JSON.stringify(corpo)));
  e.api.emettiEvento("ViewContent", { contentIds: ["HG-001"], contentType: "product" });
  await e.api.scarica();
  c("il permesso si tiene in memoria: la seconda richiesta non lo richiede", [3, 1], [e.fetchLog.length, e.fetchLog.filter((x) => x.url.includes("permesso")).length]);
  e.ora += 9.5 * 60_000;
  e.api.emettiEvento("ViewContent", { contentIds: ["HG-002"], contentType: "product" });
  await e.api.scarica();
  c("passati 9 minuti e mezzo il permesso si rinnova", 2, e.fetchLog.filter((x) => x.url.includes("permesso")).length);
  const due = new Set([id, e.api.emettiEvento("AddToCart", dati), e.api.emettiEvento("AddToCart", dati)]);
  await e.api.scarica();
  c("ogni evento ha il suo id (nessun id riusato)", 3, due.size);

  // senza consenso, solo necessari, statistiche
  const senza = sito({ consenso: NIENTE });
  c("senza scelta: emettiEvento restituisce null, nessun pixel, nessuna chiamata", [null, 0, false], [senza.api.emettiEvento("AddToCart", dati), senza.fetchLog.length, "fbq" in senza.finestra]);
  const nec = sito({ consenso: NECESSARI });
  c("solo necessari: null e nessuna chiamata", [null, 0], [nec.api.emettiEvento("AddToCart", dati), nec.fetchLog.length]);
  const st = sito({ consenso: STATISTICHE });
  const idS = st.api.emettiEvento("AddToCart", dati);
  await st.api.scarica();
  c("solo statistiche: parte solo Google, nessuna chiamata al server, nessun pixel di Meta/TikTok", [true, 0, false], [ID.test(idS), st.fetchLog.length, "fbq" in st.finestra || "ttq" in st.finestra]);

  // dove non si emette
  for (const [nome, opz] of [["admin", { admin: true }], ["dentro una cornice", { cornice: true }], ["pagina ordine", { path: "/shop/ordine/HG-1", search: "?t=abc" }], ["pagina con ?anteprima", { search: "?anteprima=k" }], ["/CRM", { path: "/CRM" }]]) {
    const x = sito(opz);
    c(`${nome}: emettiEvento → null, nessuna chiamata al server`, [null, 0], [x.api.emettiEvento("AddToCart", dati), x.fetchLog.length]);
  }
  const sosp = sito({ path: "/shop" });
  sosp.finestra.location.pathname = "/shop/ordine/HG-1";
  sosp.finestra.location.search = "?t=1";
  sosp.car.applicaConsenso(MARKETING, CONFIG);
  c("dopo `sospendi`: null", null, sosp.api.emettiEvento("AddToCart", dati));
  const x1 = sito();
  c("eventi senza prodotti o con nomi d'acquisto: null e nessuna chiamata", [null, null, null, null, 0], [x1.api.emettiEvento("ViewContent", {}), x1.api.emettiEvento("Purchase", dati), x1.api.emettiEvento("CompletePayment", dati), x1.api.emettiEvento("", dati), x1.fetchLog.length]);

  // Google: OGNI evento porta l'indirizzo pulito e il referrer ridotto all'origine (`gtag('set', …)`)
  const pv = sito({ path: "/Shop/Prodotto/Lace-Front", search: "?utm_source=meta&fbclid=9" });
  const idP = pv.api.emettiEvento("PageView");
  await pv.api.scarica();
  const sets = () => dl(pv).filter((x) => x[0] === "set" && x[1]?.page_location);
  c("Google: c'è un `set` con l'indirizzo RICOSTRUITO (minuscolo, solo chiavi ammesse) e il referrer ridotto all'origine", ["https://www.sito.test/shop/prodotto/lace-front?utm_source=meta&fbclid=9", "https://l.facebook.com"], [sets()[0]?.[1]?.page_location, sets()[0]?.[1]?.page_referrer]);
  const primaDelConfig = dl(pv).findIndex((x) => x[0] === "config");
  c("…e il `set` viene PRIMA di ogni `config` e di ogni evento", [true, true], [dl(pv).findIndex((x) => x[0] === "set" && x[1]?.page_location) < primaDelConfig, dl(pv).findIndex((x) => x[0] === "set" && x[1]?.page_location) < dl(pv).findIndex((x) => x[0] === "event")]);
  c("PageView: Meta ha lo stesso id; il server riceve il percorso e le sole chiavi ammesse", [idP, "/Shop/Prodotto/Lace-Front", "utm_source=meta&fbclid=9"], [fq(pv).filter((x) => x[0] === "track").at(-1)?.[3]?.eventID, pv.fetchLog.at(-1)?.corpo?.percorso, pv.fetchLog.at(-1)?.corpo?.query]);
  // navigazione interna + altri eventi: l'indirizzo si aggiorna, il referrer diventa l'origine del sito
  pv.finestra.location.pathname = "/shop/carrello";
  pv.finestra.location.search = "";
  pv.api.emettiEvento("ViewCart", { contentIds: ["HG-001"] });
  pv.api.emettiEvento("AddToCart", dati);
  await pv.api.scarica();
  c("dopo la navigazione, il primo evento aggiorna `set` (nuovo indirizzo, referrer = origine del sito) e il secondo no (non è cambiato)", [2, "https://www.sito.test/shop/carrello", "https://www.sito.test"], [sets().length, sets().at(-1)?.[1]?.page_location, sets().at(-1)?.[1]?.page_referrer]);
  // ogni `event` è preceduto da un `set` con l'indirizzo pulito della sua pagina
  const eventi = dl(pv);
  let ultimo = null; const senzaIndirizzo = [];
  eventi.forEach((x, i) => { if (x[0] === "set" && x[1]?.page_location) ultimo = x[1].page_location; if (x[0] === "event" && (!ultimo || /[A-Z]/.test(ultimo))) senzaIndirizzo.push(i); });
  c("ogni evento di Google ha già un indirizzo pulito (minuscolo, ricostruito) impostato prima di sé", [], senzaIndirizzo);
  c("nessun indirizzo grezzo (maiuscole del percorso vero) arriva a Google, Meta o TikTok", false, /Lace-Front/.test(JSON.stringify([fq(pv), tq(pv), dl(pv)])));

  // il server non risponde / il permesso non arriva: non si rompe niente
  const rotto = sito();
  rotto.api = API.creaApi({ finestra: rotto.finestra, fetch: async () => { throw new Error("rete assente"); }, adesso: () => 1, caricatore: rotto.car, consenso: () => MARKETING, contatore: () => {} });
  let err5 = null, id5 = null;
  try { id5 = rotto.api.emettiEvento("AddToCart", dati); await rotto.api.scarica(); } catch (er) { err5 = String(er); }
  c("rete assente: nessuna eccezione, l'evento del browser parte lo stesso", [null, true], [err5, ID.test(id5)]);
  const rifiuto = sito();
  const rifiutate = [];
  rifiuto.api = API.creaApi({ finestra: rifiuto.finestra, fetch: async (u, i) => { rifiutate.push([i?.method ?? "GET", String(u)]); return { ok: false, status: 503, json: async () => ({}) }; }, adesso: () => 1, caricatore: rifiuto.car, consenso: () => MARKETING, contatore: () => {} });
  let err6 = null;
  try { rifiuto.api.emettiEvento("AddToCart", dati); await rifiuto.api.scarica(); } catch (er) { err6 = String(er); }
  c("permesso rifiutato (503): nessuna eccezione e nessun invio dell'evento (solo la richiesta del permesso)", [null, [["GET", "/api/public/evento-permesso"]]], [err6, rifiutate]);
  // Lead: i pixel del browser sì, il server no (resta su `capi`, T28)
  const ld = sito();
  const idL = ld.api.emettiEvento("Lead", { valueCent: 0 });
  await ld.api.scarica();
  c("Lead: parte dai pixel del browser con lo stesso id, ma NON chiama il server (nemmeno il permesso)", [true, true, 0], [fq(ld).some((x) => x[0] === "track" && x[1] === "Lead" && x[3]?.eventID === idL), ID.test(idL), ld.fetchLog.length]);

  // il contatore interno
  const ct = sito({ consenso: NIENTE });
  ct.api.emettiSoloContatore("shop_vista_carrello", { righe: 2 });
  c("emettiSoloContatore: scrive il conteggio interno anche senza consenso (nessuna chiamata a Meta/TikTok/Google né al server)", [[["shop_vista_carrello", { righe: 2 }]], 0, false], [ct.contatori, ct.fetchLog.length, "fbq" in ct.finestra]);
  c("emettiSoloContatore con nome vuoto o non testo: niente", 0, (() => { const x = sito(); x.api.emettiSoloContatore("", {}); x.api.emettiSoloContatore(null); return x.contatori.length; })());
  c("emettiSoloContatore: il payload porta solo numeri, testi brevi e booleani (niente oggetti annidati né testi lunghi)", [{ a: 1, b: "x", c: true }], [(() => { const x = sito(); x.api.emettiSoloContatore("shop_x", { a: 1, b: "x", c: true, d: { annidato: 1 }, e: "y".repeat(300), f: [1], g: null }); return x.contatori[0][1]; })()]);

  // sul server, o senza window, le funzioni esportate non fanno niente
  c("le funzioni esportate (senza window) sono no-op: null, nessuna eccezione", [null, null], [API.emettiEvento("AddToCart", dati), API.emettiSoloContatore("shop_x")]);
}
