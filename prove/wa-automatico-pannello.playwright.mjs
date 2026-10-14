#!/usr/bin/env node
/** ── IL PANNELLO «MESSAGGI AUTOMATICI» DEL TITOLARE (compito 8) ─────────────
 *
 *  Prove nel browser vero, con Supabase FINTO: la sessione è finta (in
 *  localStorage), ogni richiesta verso `finto.supabase.test` è intercettata e
 *  risponde un piccolo database in memoria. Niente esce verso il database vero.
 *
 *  Cosa si prova:
 *   1. un consulente che non è admin non vede la voce e non fa nessuna richiesta
 *      a `wa_auto_*`;
 *   2. l'admin vede stato, regole, ultimi invii ed esclusi; la lettura di
 *      `whatsapp_settings` NON chiede mai le chiavi (token, segreto);
 *   3. l'interruttore cambia `auto_attivo`; il passaggio al reale chiede
 *      conferma e «Annulla» non scrive niente;
 *   4. una regola si salva (fascia, momento), una fascia storta non parte;
 *   5. «Riattiva» chiede conferma e cancella la riga giusta;
 *   6. migrazione non applicata: messaggio chiaro, nessun crollo;
 *   7. dal pannello partono richieste solo verso `wa_auto_*` e `whatsapp_settings`;
 *   8. telefono stretto: niente scorrimento orizzontale della pagina.
 *
 *  ── COME SI USA ── (come `consenso-wa.playwright.mjs`)
 *      server locale con ambiente finto sulla porta 5199, poi
 *      node prove/wa-automatico-pannello.playwright.mjs
 *  shortcut: `playwright-core` non è nelle dipendenze (`npm i --no-save
 *  playwright-core`); metterla in devDependencies quando entra nel collaudo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { chromium } from "playwright-core";

const BASE = process.env.PROVA_URL || "http://127.0.0.1:5199";
const FINTO = "https://finto.supabase.test";
const UID = "00000000-0000-4000-8000-000000000001";

let ok = 0;
const falliti = [];
function verifica(nome, condizione, dettaglio = "") {
  if (condizione) ok++;
  else falliti.push(`${nome} ${dettaglio}`.trim());
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const SESSIONE = (() => {
  const scade = Math.floor(Date.now() / 1000) + 24 * 3600;
  const utente = {
    id: UID, aud: "authenticated", role: "authenticated", email: "titolare@prova.test",
    app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
  };
  return {
    access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", exp: scade })}.firma`,
    token_type: "bearer", expires_in: 24 * 3600, expires_at: scade, refresh_token: "r", user: utente,
  };
})();

/** Il database finto: righe diverse per prova, rinnovato a ogni apertura. */
function nuovoDb({ admin = true, migrazione = true } = {}) {
  return {
    admin,
    migrazione,
    settings: { auto_attivo: false, auto_simulato: true, auto_tetto_giorno: 40, auto_qualita: null, auto_sospeso_motivo: null, auto_sospeso_il: null },
    regole: [
      { id: "r1", user_id: UID, codice: "ricontatto", descrizione: "Ricontatto alla data fissata", attiva: true, riferimento: "ricontatto", stato_lead: null, giorni_prima: 0, ora_fissa: "09:00", minuti_prima: null, template: "promemoria_ricontatto", ora_da: "09:00", ora_a: "20:00" },
      { id: "r2", user_id: UID, codice: "consulenza-vigilia", descrizione: "Promemoria il giorno prima", attiva: true, riferimento: "consulenza", stato_lead: null, giorni_prima: 1, ora_fissa: "18:00", minuti_prima: null, template: "promemoria_meet", ora_da: "09:00", ora_a: "20:00" },
      { id: "r3", user_id: UID, codice: "consulenza-10min", descrizione: "Promemoria 10 minuti prima", attiva: false, riferimento: "consulenza", stato_lead: null, giorni_prima: 0, ora_fissa: null, minuti_prima: 10, template: "promemoria_meet", ora_da: "08:45", ora_a: "21:30" },
    ],
    invii: [
      { id: "i1", user_id: UID, lead_id: "L1", regola: "ricontatto", scadenza: "2026-10-14T07:00:00Z", telefono_e164: "393331234567", template: "promemoria_ricontatto", stato: "simulato", motivo: null, simulato: true, wa_message_id: null, prenotato_il: "2026-10-14T07:00:05Z", esito_il: "2026-10-14T07:00:06Z" },
      { id: "i2", user_id: UID, lead_id: "L2", regola: "consulenza-10min", scadenza: "2026-10-14T08:50:00Z", telefono_e164: "393339876543", template: "promemoria_meet", stato: "saltato", motivo: "fuori fascia", simulato: true, wa_message_id: null, prenotato_il: "2026-10-14T08:50:05Z", esito_il: "2026-10-14T08:50:05Z" },
    ],
    esclusi: [
      { id: "e1", user_id: UID, telefono_e164: "393331112222", motivo: "stop", testo: "STOP", created_at: "2026-10-13T10:00:00Z" },
    ],
  };
}

const TABELLE_WA = ["wa_auto_regole", "wa_auto_invii", "wa_auto_esclusi"];

async function apri(browser, opzioni = {}, larghezza = 1280) {
  const db = nuovoDb(opzioni);
  const richieste = []; // { metodo, tabella, query, corpo }
  const context = await browser.newContext({ viewport: { width: larghezza, height: 900 } });
  await context.route(/^https:\/\/(connect\.facebook\.net|www\.googletagmanager\.com|analytics\.tiktok\.com)\//, (r) => r.abort());
  await context.route(`${FINTO}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, body, headers = {}) =>
      route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", ...headers }, body: body === undefined ? "" : JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (url.pathname.startsWith("/auth/v1/")) return json(200, SESSIONE.user);
    const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (!m) return json(200, []);
    const tabella = m[1];
    const metodo = req.method();
    const corpo = metodo === "PATCH" || metodo === "POST" ? req.postDataJSON() : undefined;
    richieste.push({ metodo, tabella, query: url.search, corpo });
    const mancante = { code: "PGRST205", message: `Could not find the table 'public.${tabella}' in the schema cache`, details: null, hint: null };
    if (TABELLE_WA.includes(tabella) && !db.migrazione) return json(404, mancante);
    const idDaQuery = url.searchParams.get("id")?.replace(/^eq\./, "");
    const oggetto = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const rispondi = (righe) => (oggetto ? (righe[0] ? json(200, righe[0]) : json(406, { code: "PGRST116", message: "0 rows", details: null, hint: null })) : json(200, righe));

    if (tabella === "user_settings") {
      const riga = { user_id: UID, is_admin: db.admin, scheme_access: [], display_name: "Titolare", can_accept_leads: true };
      if (url.searchParams.get("select") === "user_id" && req.headers()["prefer"]?.includes("count")) return json(200, [], { "content-range": "0-0/1" });
      return rispondi([riga]);
    }
    if (tabella === "whatsapp_settings") {
      if (metodo === "PATCH") {
        Object.assign(db.settings, corpo);
        return json(200, [{ user_id: UID }]);
      }
      return rispondi([{ ...db.settings }]);
    }
    if (tabella === "wa_auto_regole") {
      if (metodo === "PATCH") {
        const r = db.regole.find((x) => x.id === idDaQuery);
        if (r) Object.assign(r, corpo);
        return json(200, r ? [r] : []);
      }
      return rispondi(db.regole);
    }
    if (tabella === "wa_auto_invii") return rispondi(db.invii);
    if (tabella === "wa_auto_esclusi") {
      if (metodo === "DELETE") {
        const prima = db.esclusi.length;
        db.esclusi = db.esclusi.filter((x) => x.id !== idDaQuery);
        return json(200, prima === db.esclusi.length ? [] : [{ id: idDaQuery }]);
      }
      return rispondi(db.esclusi);
    }
    return rispondi([]);
  });
  const page = await context.newPage();
  const errori = [];
  page.on("pageerror", (e) => errori.push(e.message));
  await page.addInitScript((sessione) => {
    localStorage.setItem("sb-finto-auth-token", JSON.stringify(sessione));
  }, SESSIONE);
  await page.goto(`${BASE}/CRM/whatsapp`, { waitUntil: "domcontentloaded" });
  return { context, page, db, richieste, errori };
}

const voce = (page) => page.getByRole("button", { name: "Messaggi automatici" });
const pannello = (page) => page.getByRole("region", { name: "Messaggi automatici" });
async function apriPannello(t) {
  await voce(t.page).waitFor({ timeout: 60000 });
  t.dopoClic = t.richieste.length;
  await voce(t.page).click();
  await pannello(t.page).waitFor({ timeout: 15000 });
}
const interruttore = (t, nome) => pannello(t.page).getByRole("switch", { name: nome });

async function provaNonAdmin(browser) {
  const t = await apri(browser, { admin: false });
  await t.page.getByRole("button", { name: "Messaggi preimpostati" }).waitFor({ timeout: 60000 });
  await t.page.waitForTimeout(1500);
  verifica("1. non admin: nessuna voce «Messaggi automatici»", (await voce(t.page).count()) === 0);
  verifica("1. non admin: nessuna richiesta a wa_auto_*", !t.richieste.some((r) => TABELLE_WA.includes(r.tabella)));
  await t.context.close();
}

async function provaAdmin(browser) {
  const t = await apri(browser);
  await apriPannello(t);
  const p = pannello(t.page);
  await p.getByText("Spento", { exact: false }).first().waitFor({ timeout: 15000 });
  verifica("2. stato: spento", (await p.getByText(/non parte niente/i).count()) > 0);
  verifica("2. «Simulato» acceso", (await interruttore(t, "Simulato").getAttribute("aria-checked")) === "true");
  verifica("2. «Invii automatici» spento", (await interruttore(t, "Invii automatici").getAttribute("aria-checked")) === "false");
  verifica("2. tre regole", (await p.locator("[data-regola]").count()) === 3);
  verifica("2. la regola spenta si vede spenta", (await p.locator('[data-regola="consulenza-10min"]').getByRole("switch").getAttribute("aria-checked")) === "false");
  verifica("2. fascia 8:45-21:30 del promemoria dei 10 minuti", (await p.locator('[data-regola="consulenza-10min"] input[type="time"]').evaluateAll((i) => i.map((x) => x.value).join())).includes("08:45") );
  verifica("2. due invii nel registro", (await p.locator("[data-invio]").count()) === 2);
  verifica("2. esito «Simulato» e «Saltato» con il motivo", (await p.getByText("fuori fascia").count()) > 0);
  verifica("2. un escluso con la sua risposta", (await p.locator('[data-escluso="393331112222"]').count()) === 1);
  const lettureSettings = t.richieste.filter((r) => r.tabella === "whatsapp_settings" && r.metodo === "GET" && t.richieste.indexOf(r) >= t.dopoClic);
  verifica("2. whatsapp_settings letta dal pannello", lettureSettings.length >= 1);
  const colonne = lettureSettings.map((r) => decodeURIComponent(new URLSearchParams(r.query).get("select") || "")).join(",");
  verifica("2. nessuna chiave chiesta (token, segreto)", !/token|secret|app_secret|\*/i.test(colonne), colonne);
  // 7. solo wa_auto_* e whatsapp_settings
  const estranee = t.richieste.slice(t.dopoClic).filter((r) => !TABELLE_WA.includes(r.tabella) && r.tabella !== "whatsapp_settings");
  verifica("7. dal pannello solo wa_auto_* e whatsapp_settings", estranee.length === 0, JSON.stringify(estranee.map((r) => r.tabella)));
  if (process.env.PROVA_SCREEN) await t.page.screenshot({ path: `${process.env.PROVA_SCREEN}-desktop.png` });
  verifica("2. nessun errore di pagina", t.errori.length === 0, t.errori[0]);
  await t.context.close();
}

async function provaInterruttori(browser) {
  const t = await apri(browser);
  await apriPannello(t);
  const p = pannello(t.page);
  await interruttore(t, "Invii automatici").click();
  await p.getByText(/in simulazione/i).first().waitFor({ timeout: 10000 });
  verifica("3. acceso in simulazione: auto_attivo scritto", t.db.settings.auto_attivo === true);
  verifica("3. nessuna conferma per la simulazione", (await p.getByRole("button", { name: /Passa al reale/ }).count()) === 0);
  // passare al reale: conferma
  await interruttore(t, "Simulato").click();
  await p.getByRole("button", { name: /Passa al reale/ }).waitFor({ timeout: 5000 });
  verifica("3. il reale non parte senza conferma", t.db.settings.auto_simulato === true);
  await p.getByRole("button", { name: "Annulla" }).first().click();
  await t.page.waitForTimeout(300);
  verifica("3. «Annulla» non scrive niente", t.db.settings.auto_simulato === true);
  await interruttore(t, "Simulato").click();
  await p.getByRole("button", { name: /Passa al reale/ }).click();
  await p.getByText(/invia davvero/i).first().waitFor({ timeout: 10000 });
  verifica("3. con la conferma si passa al reale", t.db.settings.auto_simulato === false);
  // tornare al simulato è sempre libero
  await interruttore(t, "Simulato").click();
  await p.getByText(/in simulazione/i).first().waitFor({ timeout: 10000 });
  verifica("3. tornare al simulato è senza conferma", t.db.settings.auto_simulato === true);
  await t.context.close();
}

async function provaRegola(browser) {
  const t = await apri(browser);
  await apriPannello(t);
  const riga = pannello(t.page).locator('[data-regola="ricontatto"]');
  const salva = riga.getByRole("button", { name: "Salva" });
  verifica("4. «Salva» spento finché non cambia niente", await salva.isDisabled());
  await riga.getByLabel("Fino alle").fill("21:00");
  verifica("4. «Salva» si accende alla modifica", await salva.isEnabled());
  await salva.click();
  await t.page.waitForTimeout(600);
  verifica("4. fascia salvata", t.db.regole[0].ora_a === "21:00", t.db.regole[0].ora_a);
  const patch = t.richieste.filter((r) => r.metodo === "PATCH" && r.tabella === "wa_auto_regole");
  verifica("4. una sola richiesta, sulla riga giusta", patch.length === 1 && patch[0].query.includes("id=eq.r1"), patch[0]?.query);
  verifica("4. solo i campi della regola, mai user_id o codice", patch[0] && !("user_id" in patch[0].corpo) && !("codice" in patch[0].corpo), JSON.stringify(patch[0]?.corpo));
  // fascia storta
  await riga.getByLabel("Dalle").fill("21:30");
  await salva.click();
  await riga.getByRole("alert").waitFor({ timeout: 5000 });
  verifica("4. fascia storta: errore a schermo", (await riga.getByRole("alert").innerText()).length > 5);
  await t.page.waitForTimeout(400);
  verifica("4. fascia storta: nessuna scrittura", t.richieste.filter((r) => r.metodo === "PATCH" && r.tabella === "wa_auto_regole").length === 1);
  // accendere la regola spenta: subito
  const r3 = pannello(t.page).locator('[data-regola="consulenza-10min"]').getByRole("switch");
  await r3.click();
  await t.page.waitForTimeout(600);
  verifica("4. l'interruttore della regola scrive subito", t.db.regole[2].attiva === true);
  await t.context.close();
}

async function provaRiattiva(browser) {
  const t = await apri(browser);
  await apriPannello(t);
  const riga = pannello(t.page).locator('[data-escluso="393331112222"]');
  await riga.getByRole("button", { name: "Riattiva" }).click();
  verifica("5. «Riattiva» non cancella al primo clic", t.db.esclusi.length === 1);
  await riga.getByRole("button", { name: "Annulla" }).click();
  verifica("5. «Annulla» lascia tutto com'era", t.db.esclusi.length === 1 && (await riga.getByRole("button", { name: "Riattiva" }).count()) === 1);
  await riga.getByRole("button", { name: "Riattiva" }).click();
  await riga.getByRole("button", { name: /Conferma/ }).click();
  await pannello(t.page).locator('[data-escluso="393331112222"]').waitFor({ state: "detached", timeout: 10000 });
  verifica("5. riga cancellata dal database finto", t.db.esclusi.length === 0);
  verifica("5. cancellata con il filtro sulla riga", t.richieste.some((r) => r.metodo === "DELETE" && r.query.includes("id=eq.e1")));
  verifica("5. stato vuoto spiegato", (await pannello(t.page).getByText(/Nessun numero escluso/i).count()) === 1);
  await t.context.close();
}

async function provaMigrazione(browser) {
  const t = await apri(browser, { migrazione: false });
  await apriPannello(t);
  const p = pannello(t.page);
  await p.getByText(/migrazione/i).first().waitFor({ timeout: 15000 });
  verifica("6. migrazione mancante: messaggio chiaro", true);
  verifica("6. c'è «Riprova»", (await p.getByRole("button", { name: "Riprova" }).count()) === 1);
  verifica("6. nessun interruttore finto", (await p.getByRole("switch", { name: "Invii automatici" }).count()) === 0);
  t.db.migrazione = true;
  await p.getByRole("button", { name: "Riprova" }).click();
  await p.locator("[data-regola]").first().waitFor({ timeout: 10000 });
  verifica("6. dopo la migrazione «Riprova» carica", (await p.locator("[data-regola]").count()) === 3);
  await t.context.close();
}

async function provaVuoto(browser) {
  const t = await apri(browser);
  t.db.regole.length = 0;
  t.db.invii.length = 0;
  t.db.esclusi.length = 0;
  await apriPannello(t);
  const p = pannello(t.page);
  await p.getByText(/Nessun invio ancora/i).waitFor({ timeout: 10000 });
  verifica("vuoto: nessun invio spiegato", true);
  verifica("vuoto: nessuna regola spiegata", (await p.getByText(/Nessuna regola/i).count()) === 1);
  verifica("vuoto: nessun escluso spiegato", (await p.getByText(/Nessun numero escluso/i).count()) === 1);
  await t.context.close();
}

async function provaTelefono(browser) {
  const t = await apri(browser, {}, 390);
  await apriPannello(t);
  await t.page.waitForTimeout(500);
  const sbordo = await t.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  verifica("8. telefono: la pagina non scorre di lato", sbordo <= 0, `(${sbordo}px)`);
  //  Il comando vero può essere piccolo (l'interruttore è 36x20), ma l'area da toccare no:
  //  gli interruttori contano per la riga (label) che li contiene, i campi e i pulsanti per sé.
  const piccoli = await pannello(t.page).locator("button, [role=switch], input").evaluateAll((els) =>
    els
      .map((e) => ({ e, r: (e.getAttribute("role") === "switch" ? e.closest("label") ?? e : e).getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height < 28)
      .map(({ e }) => e.outerHTML.slice(0, 80)),
  );
  verifica("8. telefono: nessun comando con area sotto i 28px", piccoli.length === 0, JSON.stringify(piccoli));
  if (process.env.PROVA_SCREEN) {
    await t.page.setViewportSize({ width: 390, height: 2100 });
    await t.page.screenshot({ path: `${process.env.PROVA_SCREEN}-telefono.png` });
  }
  await t.context.close();
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [nome, prova] of [
    ["non admin", provaNonAdmin], ["admin", provaAdmin], ["interruttori", provaInterruttori],
    ["regola", provaRegola], ["riattiva", provaRiattiva], ["migrazione", provaMigrazione],
    ["vuoto", provaVuoto], ["telefono", provaTelefono],
  ]) {
    try {
      await prova(browser);
    } catch (e) {
      falliti.push(`prova ${nome}: ${String(e.message).split("\n")[0]}`);
    }
  }
} finally {
  await browser.close();
}
console.log(`${ok} controlli passati, ${falliti.length} falliti`);
for (const f of falliti) console.log(" ✗ " + f);
process.exit(falliti.length ? 1 : 0);
