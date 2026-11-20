/** ── SHOP R1 · T28 · IL CANCELLO DEL CONSENSO DENTRO `tracking.ts` ─────────────────────
 *  `src/landing/booking/tracking.ts` e `BookingFunnel.tsx`. Si impacchetta il file VERO con una Supabase finta, un
 *  browser finto (finestra, documento, archivi che contano le scritture, `fetch`, cookie) e si provano gli scenari:
 *   · senza marketing nessun pixel e nessuna chiamata a `capi`; `lp_events` e `public_leads` senza `fbp`, `fbc`,
 *     `fbclid`, `external_id`, `ttclid`; `lp_external_id` mai creato;
 *   · la storia dei contatti (30 giorni) su `localStorage` solo con le statistiche, altrimenti su `sessionStorage`;
 *   · i passi della consulenza vanno alle piattaforme come `BookingDatePick`/`BookingTimePick` (mai `AddToCart`),
 *     ma i nomi INTERNI letti dal CRM non cambiano (stessi numeri: 6A n. 4);
 *   · se la migrazione S3 manca, l'insert del lead ritenta senza le due colonne del consenso.
 *  Dati: tutti inventati. */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";

const requireQui = createRequire(import.meta.url);
const V2 = (o) => JSON.stringify({ v: 2, ts: 1_700_000_000_000, statistiche: false, marketing: false, ...o });
const MARKETING = V2({ statistiche: true, marketing: true });
const STATISTICHE = V2({ statistiche: true });
const NECESSARI = V2({});

export async function prove(_mod, { c, gruppo, radice }) {
  const esbuild = requireQui("esbuild");
  gruppo("SHOP R1 · T28 · IL CANCELLO DEL CONSENSO NELLA CONSULENZA (20/11/2026)");
  const finta = join(tmpdir(), "supabase-finta-cancello.js");
  writeFileSync(
    finta,
    `export const supabase = {
  auth: { getSession: async () => ({ data: { session: null } }) },
  from: () => ({ insert: async (x) => { globalThis.__sb.inserti.push(x); return {}; } }),
};`,
  );
  const bundle = async (file, extra = {}) =>
    (await esbuild.build({
      entryPoints: [join(radice, file)], bundle: true, format: "cjs", platform: "node", write: false, logLevel: "error",
      alias: { "@/integrations/supabase/client": finta, "@": join(radice, "src") },
      define: { "import.meta.env.VITE_SUPABASE_URL": '"http://127.0.0.1:9"', "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '"finta"' },
      ...extra,
    })).outputFiles[0].text;
  const codice = await bundle("src/landing/booking/tracking.ts");

  /** Un visitatore finto: carica il file vero con i suoi globali, e restituisce gli strumenti. */
  async function visita({ consenso = null, cookie = "", href = "https://sito.test/invisible-derm", admin = "0", storage = {} } = {}) {
    const u = new URL(href);
    const mem = { local: new Map(), session: new Map(admin === null ? [] : [["lp_admin_skip", admin]]) };
    if (consenso) mem.local.set("hgl_cookie_consent_v2", consenso);
    for (const [k, v] of Object.entries(storage)) mem.local.set(k, v);
    const scritture = { local: [], session: [] };
    const store = (nome) => ({
      getItem: (k) => (mem[nome].has(k) ? mem[nome].get(k) : null),
      setItem: (k, v) => { scritture[nome].push(k); mem[nome].set(k, String(v)); },
      removeItem: (k) => void mem[nome].delete(k),
    });
    const pixel = [];
    const ttq = [];
    const fetches = [];
    const ripristina = [];
    const metti = (k, v) => { ripristina.push([k, Object.getOwnPropertyDescriptor(globalThis, k)]); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };
    globalThis.__sb = { inserti: [] };
    metti("window", {
      location: { href: u.href, search: u.search, pathname: u.pathname, hostname: u.hostname, origin: u.origin },
      sessionStorage: store("session"), localStorage: store("local"),
      fbq: (...a) => pixel.push(a), ttq: { track: (...a) => ttq.push(a) },
      addEventListener() {}, innerWidth: 390,
    });
    metti("document", { referrer: "", cookie, addEventListener() {} });
    metti("sessionStorage", globalThis.window.sessionStorage);
    metti("localStorage", globalThis.window.localStorage);
    metti("navigator", { userAgent: "Mozilla/5.0 (iPhone) Safari/Finto" });
    metti("fetch", async (url, init) => { fetches.push({ url: String(url), corpo: init?.body ? JSON.parse(init.body) : null }); return { ok: true, status: 200 }; });
    const m = { exports: {} };
    new Function("module", "exports", "require", codice)(m, m.exports, requireQui);
    return {
      T: m.exports, pixel, ttq, fetches, mem, scritture,
      righe: () => globalThis.__sb.inserti,
      fine: () => { for (const [k, d] of ripristina.reverse()) d ? Object.defineProperty(globalThis, k, d) : delete globalThis[k]; },
    };
  }
  const con = async (opz, f) => { const v = await visita(opz); try { return await f(v); } finally { v.fine(); } };
  const CHIAVI_PIATTAFORMA = ["fbp", "fbc", "fbclid", "external_id"];
  const URL_ADS = "https://sito.test/invisible-derm?utm_source=meta&utm_campaign=c1&fbclid=FBCLID9&ttclid=TTCLID9&ad_id=77";
  const COOKIE = "_fbp=fb.1.1700.99; _fbc=fb.1.1700.abc";

  /* ── 0. nessuna funzione esportata è sparita ── */
  const ESPORTATE = ["getTouchHistory", "appendTouch", "classifyJourneyClient", "buildJourneySnapshot", "getExternalId", "getSessionId", "eventId", "captureSourceData", "detectSource", "initAdminCheck", "subscribeAdminStatus", "isAdminLogged", "trackEvent", "firePixel", "fireCapi", "initHighQualityVisit", "initHeartbeat", "initScrollTracking", "trackClick", "initClickTracking", "initLivePresence", "subscribeLiveVisitorsCount"];
  await con({}, async (v) => c("nessuna funzione esportata da tracking.ts è sparita (le firme restano)", [], ESPORTATE.filter((n) => typeof v.T[n] !== "function")));
  await con({}, async (v) => c("`colonnaConsensoMancante` è esportata (serve al ripiego di BookingFunnel)", "function", typeof v.T.colonnaConsensoMancante));

  /* ── 1. senza scelta / solo necessari / solo statistiche: nessun pixel, nessuna chiamata a capi ── */
  for (const [nome, consenso] of [["senza scelta", null], ["solo necessari", NECESSARI], ["solo statistiche", STATISTICHE], ["scelta v1 «accept» (non vale per le piattaforme)", null]]) {
    const storage = nome.startsWith("scelta v1") ? { hgl_cookie_consent_v1: "accept" } : {};
    await con({ consenso, cookie: COOKIE, href: URL_ADS, storage }, async (v) => {
      v.T.firePixel("Lead", { value: 1 }, "ev1");
      await v.T.fireCapi("Lead", "ev1", { email: "a@example.com", phone: "3391234567" }, { value: 1 });
      await v.T.fireCapi("HighQualityVisit", "ev2", {}, {});
      await new Promise((ok) => setTimeout(ok, 5));
      c(`${nome}: firePixel non chiama fbq né ttq, fireCapi non chiama fetch (0 e 0 e 0)`, [0, 0, 0], [v.pixel.length, v.ttq.length, v.fetches.length]);
    });
  }

  /* ── 2. con marketing: pixel e capi partono, con lo stesso event_id e l'indirizzo pulito ── */
  await con({ consenso: MARKETING, cookie: COOKIE, href: `${URL_ADS}&q=SEGRETO#frammento` }, async (v) => {
    v.T.firePixel("Lead", { value: 1 }, "ev-lead");
    await v.T.fireCapi("Lead", "ev-lead", { email: "a@example.com" }, { value: 1 });
    await new Promise((ok) => setTimeout(ok, 5));
    c("con marketing: il pixel parte con l'event_id dato", ["track", "Lead", "ev-lead"], [v.pixel[0]?.[0], v.pixel[0]?.[1], v.pixel[0]?.[3]?.eventID]);
    const corpo = v.fetches[0]?.corpo;
    c("con marketing: capi riceve lo STESSO event_id, e i dati di sempre (fbp, fbc, fbclid, ttclid, external_id)", ["ev-lead", true, true, "FBCLID9", "TTCLID9", true], [corpo?.event_id, corpo?.user_data?.fbp === "fb.1.1700.99", corpo?.user_data?.fbc === "fb.1.1700.abc", corpo?.user_data?.fbclid, corpo?.user_data?.ttclid, !!corpo?.user_data?.external_id]);
    c("l'indirizzo che va a capi è RICOSTRUITO: niente `q`, niente frammento, solo le chiavi ammesse", "https://sito.test/invisible-derm?utm_source=meta&utm_campaign=c1&fbclid=FBCLID9&ttclid=TTCLID9&ad_id=77", corpo?.event_source_url);
    c("il cookie e l'archivio: `lp_external_id` si crea solo con marketing", true, v.mem.local.has("lp_external_id"));
  });

  /* ── 3. captureSourceData / detectSource / getExternalId ── */
  for (const [nome, consenso] of [["senza scelta", null], ["solo necessari", NECESSARI], ["solo statistiche", STATISTICHE]]) {
    await con({ consenso, cookie: COOKIE, href: URL_ADS }, async (v) => {
      const s = v.T.captureSourceData();
      c(`${nome}: captureSourceData NON porta fbp, fbc, fbclid, ttclid, external_id (anche con cookie e indirizzo pieni)`, [undefined, undefined, undefined, undefined, undefined], [s.fbp, s.fbc, s.fbclid, s.ttclid, s.external_id]);
      c(`${nome}: restano UTM e identificativi di campagna (vengono dall'indirizzo, non dal dispositivo)`, ["meta", "c1", "77"], [s.utm_source, s.utm_campaign, s.ad_id]);
      c(`${nome}: lp_external_id non si crea e non c'è traccia dei click id nell'archivio della sessione`, [false, false], [v.mem.local.has("lp_external_id"), /FBCLID9|TTCLID9|fb\.1\./.test(String(v.mem.session.get("lp_source_data")))]);
      c(`${nome}: getExternalId non crea niente`, ["", false], [v.T.getExternalId(), v.mem.local.has("lp_external_id")]);
    });
  }
  await con({ consenso: MARKETING, cookie: COOKIE, href: URL_ADS }, async (v) => {
    const s = v.T.captureSourceData();
    c("con marketing: captureSourceData porta tutto come prima", ["fb.1.1700.99", "fb.1.1700.abc", "FBCLID9", "TTCLID9", true], [s.fbp, s.fbc, s.fbclid, s.ttclid, !!s.external_id]);
    c("con marketing: lp_external_id c'è e resta lo stesso alla seconda chiamata", true, v.T.getExternalId() === s.external_id && !!v.mem.local.get("lp_external_id"));
  });
  const fonti = [["https://sito.test/?ttclid=T1", "tiktok"], ["https://sito.test/?fbclid=F1", "meta"], ["https://sito.test/?utm_source=instagram", "meta"], ["https://sito.test/", "organic"]];
  for (const consenso of [null, MARKETING]) {
    for (const [href, atteso] of fonti) await con({ consenso, href }, async (v) => c(`detectSource ${consenso ? "con" : "senza"} marketing: ${href.split("/").pop() || "/"} → ${atteso} (il canale si capisce dal click, anche se il click id non si conserva)`, atteso, v.T.detectSource()));
  }

  /* ── 4. la storia dei contatti: localStorage solo con le statistiche ── */
  await con({ consenso: null, href: URL_ADS }, async (v) => {
    v.T.captureSourceData();
    c("senza scelta: la storia dei contatti NON tocca localStorage (nessuna scrittura) e sta nell'archivio della sessione", [[], true], [v.scritture.local, v.mem.session.has("lp_touch_history")]);
    const snap = v.T.buildJourneySnapshot();
    c("…e il percorso si legge lo stesso (1 contatto; con ttclid e fbclid insieme vince TikTok, come sempre)", [1, "tiktok"], [snap.touch_count, snap.first_channel]);
    c("…senza click id nei contatti", false, /FBCLID9|TTCLID9/.test(String(v.mem.session.get("lp_touch_history"))));
  });
  await con({ consenso: NECESSARI, href: URL_ADS, storage: { lp_touch_history: JSON.stringify([{ ch: "google", ts: Date.now() }]) } }, async (v) => {
    v.T.captureSourceData();
    c("solo necessari con una vecchia storia nel localStorage: non si legge e non si riscrive (resta intatta)", [[], 1], [v.scritture.local, v.T.getTouchHistory().length]);
    c("…la nuova storia sta solo nella sessione", ["tiktok"], JSON.parse(v.mem.session.get("lp_touch_history")).map((t) => t.ch));
  });
  await con({ consenso: STATISTICHE, href: URL_ADS }, async (v) => {
    v.T.captureSourceData();
    c("con le statistiche (senza marketing): la storia va su localStorage", [true, false], [v.mem.local.has("lp_touch_history"), v.mem.session.has("lp_touch_history")]);
    c("…ma senza click id (solo con marketing)", false, /FBCLID9|TTCLID9/.test(String(v.mem.local.get("lp_touch_history"))));
  });
  await con({ consenso: MARKETING, href: URL_ADS }, async (v) => {
    v.T.captureSourceData();
    c("con marketing: la storia va su localStorage, col click id come prima", [true, true], [v.mem.local.has("lp_touch_history"), /FBCLID9/.test(String(v.mem.local.get("lp_touch_history")))]);
  });

  /* ── 5. lp_events: stesse righe, senza gli identificativi ── */
  const riga = async (opz) => con(opz, async (v) => { await v.T.trackEvent("AddToCart", 1, { content_name: "date_pick", event_id: "e1" }, { dedupKey: "date_pick" }); return v.righe()[0]; });
  for (const [nome, consenso] of [["senza scelta", null], ["solo necessari", NECESSARI], ["solo statistiche", STATISTICHE]]) {
    const r = await riga({ consenso, cookie: COOKIE, href: URL_ADS });
    c(`${nome}: la riga di lp_events c'è, senza fbp, fbc, fbclid, external_id, user_agent`, [1, [null, null, null, null, null]], [r ? 1 : 0, [r?.fbp, r?.fbc, r?.fbclid, r?.external_id, r?.user_agent]]);
    c(`${nome}: …e con UTM, identificativi di campagna e il nome interno «AddToCart»/date_pick intatti`, ["AddToCart", "date_pick", "meta", "c1", "77", 1], [r?.event_name, r?.payload?.content_name, r?.utm_source, r?.utm_campaign, r?.ad_id, r?.step]);
  }
  const rm = await riga({ consenso: MARKETING, cookie: COOKIE, href: URL_ADS });
  c("con marketing: la riga ha fbp, fbc, fbclid, external_id e user_agent come prima", [true, true, "FBCLID9", true, true], [rm?.fbp === "fb.1.1700.99", rm?.fbc === "fb.1.1700.abc", rm?.fbclid, !!rm?.external_id, !!rm?.user_agent]);

  /* ── 6. admin: come prima ── */
  await con({ consenso: MARKETING, admin: "1", cookie: COOKIE, href: URL_ADS }, async (v) => {
    await v.T.trackEvent("x", null, {}); v.T.firePixel("Lead", {}, "e"); await v.T.fireCapi("Lead", "e");
    c("amministratore: nessuna riga, nessun pixel, nessuna chiamata (anche con tutto il consenso)", [0, 0, 0], [v.righe().length, v.pixel.length, v.fetches.length]);
  });

  /* ── 7. il ripiego dell'insert senza le colonne del consenso ── */
  await con({}, async (v) => {
    const f = v.T.colonnaConsensoMancante;
    c("colonnaConsensoMancante: PGRST204 e 42703 che nominano le colonne del consenso → sì", [true, true, true], [
      f({ code: "PGRST204", message: "Could not find the 'consenso_marketing' column of 'public_leads' in the schema cache" }),
      f({ code: "42703", message: 'column "consenso_ts" of relation "public_leads" does not exist' }),
      f({ code: "PGRST204", message: "Could not find the 'consenso_ts' column" }),
    ]);
    c("…ogni altro errore → no (un'altra colonna mancante o un errore di rete non si ritenta)", [false, false, false, false, false, false], [
      f({ code: "PGRST204", message: "Could not find the 'ad_name' column of 'public_leads'" }),
      f({ code: "23505", message: "duplicate key consenso_marketing" }),
      f({ code: "42501", message: "permission denied" }),
      f({ message: "Failed to fetch" }), f(null), f(undefined),
    ]);
  });

  /* ── 8. il testo di BookingFunnel.tsx ── */
  const funnel = readFileSync(join(radice, "src/landing/booking/BookingFunnel.tsx"), "utf8");
  const senzaCommenti = funnel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  c("BookingFunnel: i passi della consulenza non escono più come «AddToCart» verso le piattaforme", [false, false], [/firePixel\(\s*"AddToCart"/.test(senzaCommenti), /fireCapi\(\s*"AddToCart"/.test(senzaCommenti)]);
  c("BookingFunnel: escono come BookingDatePick e BookingTimePick, con emettiEvento (una volta sola per apertura)", [true, true, true, true], [/emettiUnaVolta\(\s*"BookingDatePick"/.test(senzaCommenti), /emettiUnaVolta\(\s*"BookingTimePick"/.test(senzaCommenti), /emettiEvento\(nome\)/.test(senzaCommenti), /from "@\/lib\/tracciamento\/api"/.test(senzaCommenti)]);
  c("BookingFunnel: i conteggi INTERNI restano com'erano (trackEvent AddToCart con content_name date_pick e time_pick, stessi dedupKey)", [true, true, true, true], [
    /trackEvent\(\s*"AddToCart",\s*1,\s*\{[^}]*content_name: "date_pick"[^}]*\}\s*,\s*\{ dedupKey: "date_pick" \}/.test(senzaCommenti),
    /trackEvent\(\s*"AddToCart",\s*1,\s*\{[^}]*content_name: "time_pick"[^}]*\}\s*,\s*\{ dedupKey: "time_pick" \}/.test(senzaCommenti),
    /custom_event: CUSTOM_EVENTS\.selezionaData/.test(senzaCommenti), /custom_event: CUSTOM_EVENTS\.selezionaOrario/.test(senzaCommenti),
  ]);
  c("BookingFunnel: il PageView verso le piattaforme non c'è più (lo emette il provider, D19); resta il PageView interno", [false, false, true], [/firePixel\(\s*"PageView"/.test(senzaCommenti), /fireCapi\(\s*"PageView"/.test(senzaCommenti), /trackEvent\(\s*"PageView"/.test(senzaCommenti)]);
  c("BookingFunnel: il Lead c'è ancora (pixel e capi) e anche il ViewContent del modulo", [true, true, true], [/firePixel\(\s*"Lead"/.test(senzaCommenti), /fireCapi\(\s*"Lead"/.test(senzaCommenti), /fireCapi\(\s*"ViewContent"/.test(senzaCommenti)]);
  c("BookingFunnel: l'insert scrive consenso_marketing e consenso_ts, e ritenta senza se la colonna manca", [true, true, true, true], [/consenso_marketing/.test(senzaCommenti), /consenso_ts/.test(senzaCommenti), /colonnaConsensoMancante\(/.test(senzaCommenti), /\.insert\(\s*(senza|riprova|payloadSenza)[A-Za-z]*\s+as never\)/.test(senzaCommenti)]);
  c("BookingFunnel: fbp, fbc, fbclid, ttclid, external_id entrano nell'insert SOLO con il consenso marketing (condizione scritta nel codice)", [true, true, true, true, true], ["fbp", "fbc", "fbclid", "ttclid", "external_id"].map((k) => new RegExp(`${k}:\\s*marketing\\s*\\?`).test(senzaCommenti)));
  c("BookingFunnel: il modulo si persiste ancora (loadPersisted/clearPersisted/savePersisted): la ricarica per la revoca non lo perde", [true, true, true], [/function loadPersisted\(/.test(senzaCommenti), /function clearPersisted\(/.test(senzaCommenti), /savePersisted\(step, form\)/.test(senzaCommenti)]);

  /* ── 9. continuità del CRM: stessi numeri ── */
  const lp = await bundle("src/crm/lp-performance.ts");
  const mL = { exports: {} };
  new Function("module", "exports", "require", lp)(mL, mL.exports, requireQui);
  const ev = (id, sess, nome, payload = null, step = null, quando = "2026-11-20T10:00:00Z") => ({ id, created_at: quando, event_name: nome, session_id: sess, step, payload, utm_source: "meta", device: "ios", is_bot: false });
  const eventi = [
    ev("1", "s1", "PageView", {}, 0), ev("2", "s1", "AddToCart", { content_name: "date_pick", event_id: "x", custom_event: "SelezionaData" }, 1), ev("3", "s1", "AddToCart", { content_name: "time_pick", event_id: "y" }, 1), ev("4", "s1", "Lead", {}, 6),
    ev("5", "s2", "PageView", {}, 0), ev("6", "s2", "AddToCart", { content_name: "date_pick" }, 1),
    ev("7", "s3", "PageView", {}, 0),
    // eventi con i NOMI NUOVI delle piattaforme: non sono righe di lp_events, e se mai lo fossero non devono contare come click
    ev("8", "s3", "BookingDatePick", { content_name: "date_pick" }, 1),
  ];
  const stats = mL.exports.buildLpDashboardStats(eventi);
  const per = Object.fromEntries(stats.sessions.map((s) => [s.id, [s.dateClicked, s.timeClicked, s.converted]]));
  c("lp-performance.ts, su un set inventato di righe di lp_events (nomi interni AddToCart/date_pick/time_pick): gli stessi dateClicked, timeClicked e converted di sempre", { s1: [true, true, true], s2: [true, false, false], s3: [false, false, false] }, per);
  const letti = readFileSync(join(radice, "src/crm/lp-performance.ts"), "utf8");
  c("…e i file del CRM non sono toccati da T28: lp-performance.ts legge ancora «AddToCart» con content_name date_pick/time_pick", [true, true], [/"AddToCart"/.test(letti) && /"date_pick"/.test(letti), /"time_pick"/.test(letti)]);
}
