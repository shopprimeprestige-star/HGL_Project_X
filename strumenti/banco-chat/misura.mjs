/** Misura il banco: telefono finto (390x844, CPU 4x più lenta), Chrome di sistema, playwright-core.
 *  Uso: PLAYWRIGHT_CORE=/percorso/a/playwright-core node strumenti/banco-chat/misura.mjs [etichetta] [url]
 *  Prima: npx vite build -c strumenti/banco-chat/vite.config.mjs && npx vite preview -c strumenti/banco-chat/vite.config.mjs */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
const etichetta = process.argv[2] ?? "misura";
const url = process.argv[3] ?? "http://localhost:5199/";
const CPU = Number(process.env.CPU ?? 4);

const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
await page.addInitScript(() => {
  window.__lunghi = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lunghi.push(e.duration); }).observe({ type: "longtask", buffered: true });
});
const out = { etichetta, cpu: CPU };
const prendi = () => page.evaluate(() => ({ ...window.__banco.stats, log: undefined }));
const lunghi = () => page.evaluate(() => { const l = window.__lunghi.splice(0); return { n: l.length, totMs: Math.round(l.reduce((a, b) => a + b, 0)), maxMs: Math.round(Math.max(0, ...l)) }; });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));

// A. Caricamento
const t0 = Date.now();
await page.goto(url);
await page.waitForSelector("ul li", { timeout: 120000 });
out.primeRighe_ms = Date.now() - t0;
await page.waitForFunction(() => !document.body.innerText.includes("Caricamento chat"), null, { timeout: 120000 });
await page.waitForTimeout(3000);
out.caricamento = { ...(await prendi()), ...(await lunghi()) };
out.righeNelDom = await page.locator("ul li").count();
out.nodiDom = await page.evaluate(() => document.getElementsByTagName("*").length);

// B. Scrittura nella ricerca
const cerca = page.getByLabel("Cerca nome o numero");
await cerca.click();
const tasti = async (campo, testo) => {
  const tempi = [];
  for (const ch of testo) {
    const a = Date.now();
    await page.keyboard.type(ch);
    await frame();
    tempi.push(Date.now() - a);
  }
  tempi.sort((x, y) => x - y);
  return { medianaMs: tempi[Math.floor(tempi.length / 2)], maxMs: tempi.at(-1) };
};
await lunghi();
out.ricerca_per_tasto = await tasti(cerca, "nome12");
await cerca.fill("");
await frame();

// C. Apro una chat e scrivo nella casella
const t1 = Date.now();
await page.evaluate(() => window.__apri(window.__banco.D.contatti[4].phone_e164)); // una chat calda: finestra aperta
await page.waitForSelector("textarea", { timeout: 60000 });
out.apriChat_ms = Date.now() - t1;
await page.waitForTimeout(1500);
await lunghi();
const ta = page.locator("textarea").first();
await ta.click();
out.casella_per_tasto = await tasti(ta, "Buongiorno, grazie per averci scritto");
out.casella_lunghi = await lunghi();

// D. Raffica di messaggi vivi (30 in ~3 s)
const prima = await prendi();
await lunghi();
await page.evaluate(async () => {
  for (let i = 0; i < 30; i++) { window.__banco.arrivaMessaggio(i); await new Promise((r) => setTimeout(r, 100)); }
});
await page.waitForTimeout(4000);
const dopo = await prendi();
out.raffica30 = { richieste: dopo.richieste - prima.richieste, righe: dopo.righe - prima.righe, kb: Math.round((dopo.byte - prima.byte) / 1024), ...(await lunghi()) };

// E. Un solo messaggio vivo: dal evento alla riga in cima
await page.getByRole("button", { name: /Tutte/ }).first().click().catch(() => {});
console.log(JSON.stringify(out, null, 1));
await b.close();
