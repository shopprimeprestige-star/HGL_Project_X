#!/usr/bin/env node
/** ── IL CONSENSO WHATSAPP NEL MODULO DI PRENOTAZIONE (compito 7) ───────────
 *
 *  Prove nel browser vero, con Supabase FINTO: ogni richiesta verso il
 *  database e verso la funzione `capi` è intercettata e risponde la prova.
 *  Non esce niente verso il database vero (l'indirizzo è `finto.supabase.test`).
 *
 *  Cosa si prova (colonna prova del PIANO, compito 7):
 *   (a) senza spunta: UNA richiesta, nessuna chiave `consenso_whatsapp*`;
 *   (b) con spunta: UNA richiesta con `consenso_whatsapp: true` e la versione,
 *       nessuna ora (la scrive il database);
 *   (c) colonna mancante (400 PGRST204) con spunta: seconda richiesta uguale
 *       senza le due chiavi, conferma a schermo, `fbq('track','Lead')` una
 *       volta, stesso `event_id`;
 *   (d) errore anche al secondo invio: messaggio d'errore, mai una terza;
 *   (e) senza spunta e PGRST204: nessun ritentativo.
 *  In più: la casella parte NON spuntata, si usa da tastiera, e non si ricorda
 *  fra una visita e l'altra.
 *
 *  ── COME SI USA ──────────────────────────────────────────────────────────
 *   1. server locale con ambiente finto:
 *        VITE_SUPABASE_URL=https://finto.supabase.test VITE_SUPABASE_PUBLISHABLE_KEY=x \
 *        SUPABASE_URL=https://finto.supabase.test SUPABASE_PUBLISHABLE_KEY=x \
 *        SUPABASE_SERVICE_ROLE_KEY=x npx vite dev --port 5199 --host 127.0.0.1
 *   2. node prove/consenso-wa.playwright.mjs            (usa Chrome installato)
 *  shortcut: `playwright-core` non è nelle dipendenze (si installa con
 *  `npm i --no-save playwright-core`), per non toccare package.json; metterla
 *  in devDependencies quando le prove nel browser entrano nel collaudo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { chromium } from "playwright-core";

const BASE = process.env.PROVA_URL || "http://127.0.0.1:5199";
const FINTO = "https://finto.supabase.test";
const VERSIONE = "wa-2026-10-14";
const ERRORE_COLONNA = {
  code: "PGRST204",
  message: "Could not find the 'consenso_whatsapp' column of 'public_leads' in the schema cache",
  details: null,
  hint: null,
};

let ok = 0;
const falliti = [];
function verifica(nome, condizione, dettaglio = "") {
  if (condizione) ok++;
  else falliti.push(`${nome} ${dettaglio}`.trim());
}

/** Il modulo sta in fondo alla pagina: si aspetta che ci sia e si scorre fin lì. */
async function prontoTel(page) {
  const tel = page.locator('input[name="tel"]');
  await tel.waitFor({ state: "attached", timeout: 30000 });
  await tel.scrollIntoViewIfNeeded();
}

/** Una pagina nuova con Supabase finto. `risposte` = una per ogni insert, in ordine. */
async function apri(browser, risposte) {
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const inserimenti = []; // corpi degli insert su public_leads
  const capi = [];
  const pixel = [];
  await context.route(/^https:\/\/(connect\.facebook\.net|www\.googletagmanager\.com|analytics\.tiktok\.com)\//, (r) => r.abort());
  await context.route(`${FINTO}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "POST" && url.pathname === "/rest/v1/public_leads") {
      inserimenti.push(req.postDataJSON());
      const r = risposte[inserimenti.length - 1] ?? { status: 201 };
      return route.fulfill({
        status: r.status,
        contentType: "application/json",
        body: r.body ? JSON.stringify(r.body) : "",
      });
    }
    if (req.method() === "POST" && url.pathname === "/functions/v1/capi") {
      capi.push(req.postDataJSON());
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    // tutto il resto (letture di impostazioni, slot occupati, sessione): vuoto
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__fbq = [];
    window.fbq = (...args) => window.__fbq.push(args);
    // Il modulo riparte dal passo dei contatti con data e ora già scelte.
    if (!localStorage.getItem("hgl_booking_funnel_v1")) {
      localStorage.setItem(
        "hgl_booking_funnel_v1",
        JSON.stringify({
          step: 4,
          ts: Date.now(),
          form: {
            date: "2026-10-20", time: "10:00", fullName: "Mario Rossi", email: "", telefono: "",
            citta: "", urgenza: "subito", disagio: 5, portatore: "no", portatoreMotivo: "",
            problema: "", problemaAltro: "",
          },
        }),
      );
    }
  });
  await page.goto(`${BASE}/nuova`, { waitUntil: "domcontentloaded" });
  await prontoTel(page);
  await page.locator('input[name="tel"]').fill("333 1234567");
  pixel.leggi = () => page.evaluate(() => window.__fbq);
  return { context, page, inserimenti, capi, pixel };
}

const casella = (page) => page.getByRole("checkbox", { name: /WhatsApp/i });
const invia = (page) => page.getByRole("button", { name: /Richiedi analisi/i });
const confermato = (page) => page.getByText("Consulenza confermata");
const chiavi = (corpo) => Object.keys(corpo).filter((k) => k.startsWith("consenso_whatsapp"));
const leadTrack = (chiamate) => chiamate.filter((a) => a[0] === "track" && a[1] === "Lead");

async function provaCasella(browser) {
  const t = await apri(browser, []);
  const c = casella(t.page);
  verifica("la casella esiste", (await c.count()) === 1);
  verifica("casella non pre-spuntata", !(await c.isChecked()));
  // tastiera: Tab fino alla casella, Spazio la spunta, Spazio la toglie
  await c.focus();
  await t.page.keyboard.press("Space");
  verifica("Spazio spunta la casella", await c.isChecked());
  await t.page.keyboard.press("Space");
  verifica("Spazio toglie la spunta", !(await c.isChecked()));
  // l'etichetta è collegata: un clic sul testo spunta
  await t.page.getByText(/ricevere su WhatsApp/i).click();
  verifica("clic sull'etichetta spunta", await c.isChecked());
  // dopo un ricaricamento il modulo si ricorda i dati ma NON il consenso
  await t.page.reload({ waitUntil: "domcontentloaded" });
  await prontoTel(t.page);
  verifica("il consenso non si ricorda dopo il ricaricamento", !(await casella(t.page).isChecked()));
  await t.context.close();
}

async function provaA(browser) {
  const t = await apri(browser, [{ status: 201 }]);
  await invia(t.page).click();
  await confermato(t.page).waitFor({ timeout: 15000 });
  verifica("(a) una sola richiesta", t.inserimenti.length === 1, `(${t.inserimenti.length})`);
  verifica("(a) nessuna chiave consenso_whatsapp*", chiavi(t.inserimenti[0]).length === 0, JSON.stringify(chiavi(t.inserimenti[0])));
  await t.context.close();
}

async function provaB(browser) {
  const t = await apri(browser, [{ status: 201 }]);
  await casella(t.page).check();
  await invia(t.page).click();
  await confermato(t.page).waitFor({ timeout: 15000 });
  const corpo = t.inserimenti[0];
  verifica("(b) una sola richiesta", t.inserimenti.length === 1, `(${t.inserimenti.length})`);
  verifica("(b) consenso_whatsapp true", corpo.consenso_whatsapp === true);
  verifica("(b) versione del testo", corpo.consenso_whatsapp_versione === VERSIONE, String(corpo.consenso_whatsapp_versione));
  verifica("(b) nessuna ora del consenso", !("consenso_whatsapp_il" in corpo), JSON.stringify(chiavi(corpo)));
  verifica("(b) solo le due chiavi attese", chiavi(corpo).length === 2, JSON.stringify(chiavi(corpo)));
  await t.context.close();
}

async function provaC(browser) {
  const t = await apri(browser, [{ status: 400, body: ERRORE_COLONNA }, { status: 201 }]);
  await casella(t.page).check();
  await invia(t.page).click();
  await confermato(t.page).waitFor({ timeout: 15000 });
  verifica("(c) due richieste", t.inserimenti.length === 2, `(${t.inserimenti.length})`);
  const [prima, seconda] = t.inserimenti;
  verifica("(c) la prima aveva le chiavi", chiavi(prima).length === 2);
  verifica("(c) la seconda non ha le chiavi", chiavi(seconda).length === 0, JSON.stringify(chiavi(seconda)));
  const { consenso_whatsapp, consenso_whatsapp_versione, ...restoPrima } = prima;
  verifica("(c) la seconda è la prima senza le due chiavi", JSON.stringify(restoPrima) === JSON.stringify(seconda));
  verifica("(c) stesso event_id", !!prima.event_id && prima.event_id === seconda.event_id);
  verifica("(c) nessun errore a schermo", (await t.page.getByText(/Errore invio/).count()) === 0);
  await t.page.waitForTimeout(500);
  const lead = leadTrack(await t.pixel.leggi());
  verifica("(c) fbq Lead una volta sola", lead.length === 1, `(${lead.length})`);
  verifica("(c) fbq con lo stesso event_id", lead[0]?.[3]?.eventID === prima.event_id);
  verifica("(c) CAPI una volta sola", t.capi.filter((x) => x.event_name === "Lead").length === 1);
  verifica("(c) CAPI con lo stesso event_id", t.capi.find((x) => x.event_name === "Lead")?.event_id === prima.event_id);
  await t.context.close();
}

async function provaD(browser) {
  const t = await apri(browser, [
    { status: 400, body: ERRORE_COLONNA },
    { status: 500, body: { code: "XX000", message: "guasto del database", details: null, hint: null } },
    { status: 201 }, // non deve mai essere chiesta
  ]);
  await casella(t.page).check();
  await invia(t.page).click();
  await t.page.getByText(/Errore invio/).waitFor({ timeout: 15000 });
  await t.page.waitForTimeout(1200);
  verifica("(d) mai una terza richiesta", t.inserimenti.length === 2, `(${t.inserimenti.length})`);
  verifica("(d) nessuna conferma", (await confermato(t.page).count()) === 0);
  verifica("(d) nessun Pixel Lead", leadTrack(await t.pixel.leggi()).length === 0);
  verifica("(d) nessun CAPI Lead", t.capi.filter((x) => x.event_name === "Lead").length === 0);
  await t.context.close();
}

async function provaE(browser) {
  const t = await apri(browser, [{ status: 400, body: ERRORE_COLONNA }, { status: 201 }]);
  await invia(t.page).click(); // senza spunta
  await t.page.getByText(/Errore invio/).waitFor({ timeout: 15000 });
  await t.page.waitForTimeout(1200);
  verifica("(e) nessun ritentativo senza spunta", t.inserimenti.length === 1, `(${t.inserimenti.length})`);
  verifica("(e) nessuna conferma", (await confermato(t.page).count()) === 0);
  await t.context.close();
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [nome, prova] of [["casella", provaCasella], ["a", provaA], ["b", provaB], ["c", provaC], ["d", provaD], ["e", provaE]]) {
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
