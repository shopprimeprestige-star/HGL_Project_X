/** ── PROVA S2 · IL DISEGNO, IN UN BROWSER VERO ─────────────────────────────
 *  `node prove/sito/soluzioni-disegno.mjs`. `soluzioni-media.mjs` legge il TESTO del codice; qui si guarda
 *  quello che il browser disegna davvero: il CSS di `styles.css` compilato da Tailwind (come nella build),
 *  i componenti veri, Chrome (Playwright) e `getComputedStyle`. Le prove di prima erano verdi su difetti che
 *  a schermo c'erano: comandi del video nascosti da una regola vecchia, mirini rimasti quelli di oggi, anello
 *  del fuoco tagliato, fuoco perso al play.
 *  Serve: Chrome, `playwright-core` (in `~/.npm/_npx/*` o nel progetto), `ffmpeg` (video finti, senza lampi). */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { extname, join } from "node:path";
import { nuovaProva, radice } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("soluzioni-disegno");
const richiedi = createRequire(join(radice, "package.json"));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function trovaPlaywright() {
  const cache = join(homedir(), ".npm/_npx");
  const candidati = [join(radice, "node_modules")];
  if (existsSync(cache)) for (const d of readdirSync(cache)) candidati.push(join(cache, d, "node_modules"));
  for (const base of candidati) if (existsSync(join(base, "playwright-core"))) return createRequire(base + "/")("playwright-core");
  return null;
}
const pw = trovaPlaywright();
if (!pw || !existsSync(CHROME)) {
  console.error("✗ soluzioni-disegno: servono Chrome e playwright-core (npx playwright-core). Senza, il disegno non si può provare.");
  process.exit(1);
}

//  axe-core: nel progetto, oppure nella cartella di prova del collaudo (nessuna installazione nuova: il disco è quasi pieno).
const AXE_PERCORSI = [
  join(radice, "node_modules/axe-core/axe.min.js"),
  process.env.AXE_CORE ?? "",
  "/private/tmp/claude-501/-Users-admin-Documents-Reel-Studio/66b7aff4-3505-4481-87ef-93fd96f7c4e5/scratchpad/collaudo-finale/axe/node_modules/axe-core/axe.min.js",
];
const AXE = AXE_PERCORSI.find((x) => x && existsSync(x));
if (!AXE) {
  console.error("✗ soluzioni-disegno: manca axe-core (node_modules/axe-core o variabile AXE_CORE=/percorso/axe.min.js).");
  process.exit(1);
}

const dove = realpathSync(mkdtempSync(join(tmpdir(), "prove-disegno-")));
process.on("exit", () => rmSync(dove, { recursive: true, force: true }));

/* ── 1. Il CSS come lo compila la build (Tailwind) ─────────────────────── */
const { compile } = richiedi("@tailwindcss/node");
const sorgenteCss = readFileSync(join(radice, "src/styles.css"), "utf8");
const compilato = await compile(sorgenteCss, { base: join(radice, "src"), onDependency: () => {} });
writeFileSync(join(dove, "app.css"), compilato.build(["sr-only"]));

/* ── 2. I componenti veri, impacchettati per il browser ────────────────── */
const esbuild = richiedi("esbuild");
writeFileSync(join(dove, "traccia-finta.js"), "export const traccia = () => {};\n");
writeFileSync(
  join(dove, "entrata.tsx"),
  `import { createRoot } from "react-dom/client";
import { VideoParlato } from ${JSON.stringify(join(radice, "src/landing/sito/soluzioni/VideoParlato"))};
import { ClipLoop } from ${JSON.stringify(join(radice, "src/landing/sito/soluzioni/ClipLoop"))};
const slot = { src: "/v.mp4", poster: "/poster.png", alt: "Il titolare ti guarda." };
createRoot(document.getElementById("r")!).render(
  <div className="sol-fondo-chiaro" style={{ padding: 20 }}>
    <div style={{ width: 350 }}>
      <VideoParlato slot={slot} formato="4:5" testi={{ pillola: "Te lo spiego in 30 secondi", riguarda: "Riguarda", etichettaPlay: "Guarda il video: che cos'è Invisible Derm, con audio", leggiTesto: "Leggi il testo del video" }} trascrizione="Ciao a tutti." />
      <div style={{ width: 210, marginTop: 24 }}>
        <ClipLoop slot={slot} formato="4:5" descrizione="d" didascalia="Da 10 centimetri." etichette={{ ferma: "Pausa", riparti: "Parti" }} />
      </div>
    </div>
  </div>,
);
const notte = document.createElement("div");
notte.className = "sol-fondo-notte";
notte.innerHTML = '<div id="tavola" class="brackets" style="margin:24px;width:300px;height:100px"><span class="br-tr"></span><span class="br-bl"></span></div>';
document.querySelector("main")!.appendChild(notte);
`,
);
await esbuild.build({
  entryPoints: [join(dove, "entrata.tsx")],
  outfile: join(dove, "bundle.js"),
  bundle: true,
  format: "iife",
  jsx: "automatic",
  logLevel: "error",
  absWorkingDir: radice,
  nodePaths: [join(radice, "node_modules")],
  alias: { "@": join(radice, "src") },
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "finti", setup: (b) => b.onResolve({ filter: /sito\/traccia$/ }, () => ({ path: join(dove, "traccia-finta.js") })) }],
});

/* ── 3. Video finti (nessun lampo: colore fisso e un quadrato che scorre piano) ── */
const ff = (...a) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...a]);
ff("-f", "lavfi", "-i", "color=c=0x203060:s=360x450:d=3:r=25", "-f", "lavfi", "-i", "sine=frequency=220:d=3", "-vf", "drawbox=x='t*60':y=200:w=80:h=80:color=0x5CB6FF:t=fill", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", join(dove, "v.mp4"));
ff("-f", "lavfi", "-i", "color=c=0x405080:s=350x438:d=1", "-frames:v", "1", join(dove, "poster.png"));
writeFileSync(join(dove, "index.html"), `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Prova</title><link rel="stylesheet" href="/app.css"></head><body style="margin:0"><main class="tema-soluzioni"><div id="r"></div></main><script src="/bundle.js"></script></body></html>`);
//  Una pagina «come la home»: stessi video e stessi mirini FUORI dal tema, per provare che il tema non li cambia.
writeFileSync(join(dove, "home.html"), `<!doctype html><html lang="it"><head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"></head><body><div id="b" class="brackets" style="width:300px;height:100px"><span class="br-tr"></span><span class="br-bl"></span></div></body></html>`);

const TIPI = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".mp4": "video/mp4", ".png": "image/png", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x").pathname;
  const file = url.startsWith("/fonts/") ? join(radice, "public", url) : join(dove, url === "/" ? "index.html" : url);
  if (!file.startsWith(dove) && !file.startsWith(join(radice, "public"))) return res.writeHead(403).end();
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TIPI[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const p = await ctx.newPage();
  const errori = [];
  p.on("pageerror", (e) => errori.push(e.message));
  await p.goto(base + "/index.html");
  await p.waitForSelector(".sol-copertina");
  c("la pagina non ha errori", [], errori);

  /* ── I mirini del tema: 16 px, a filo, dettagli al 50% ───────────────── */
  const mirino = await p.evaluate(() => {
    const s = getComputedStyle(document.getElementById("tavola"), "::before");
    return { w: s.width, h: s.height, top: s.top, left: s.left, colore: s.borderTopColor };
  });
  c("mirino in tema: 16 × 16, a filo con l'angolo", ["16px", "16px", "0px", "0px"], [mirino.w, mirino.h, mirino.top, mirino.left]);
  c("mirino in tema: dettagli al 50%", "rgba(201, 214, 255, 0.5)", mirino.colore);
  const mirinoBr = await p.evaluate(() => {
    const s = getComputedStyle(document.querySelector("#tavola > .br-tr"));
    return { w: s.width, top: s.top, right: s.right, colore: s.borderTopColor };
  });
  c("mirino in tema (angolo alto a destra): 16 px, a filo, dettagli al 50%", ["16px", "0px", "0px", "rgba(201, 214, 255, 0.5)"], [mirinoBr.w, mirinoBr.top, mirinoBr.right, mirinoBr.colore]);
  const pChiaro = await p.evaluate(() => {
    const el = document.createElement("div");
    el.className = "sol-fondo-chiaro";
    el.innerHTML = '<div class="brackets" id="t2"></div>';
    document.querySelector("main").appendChild(el);
    return getComputedStyle(document.getElementById("t2"), "::after").borderBottomColor;
  });
  c("mirino sul chiaro: blu notte al 50%", "rgba(10, 20, 48, 0.5)", pChiaro);

  //  Fuori dal tema (la home) i mirini restano quelli di oggi: 14 px a 8 px.
  const h = await ctx.newPage();
  await h.goto(base + "/home.html");
  const fuori = await h.evaluate(() => {
    const s = getComputedStyle(document.getElementById("b"), "::before");
    return [s.width, s.top, s.left];
  });
  c("fuori dal tema i mirini sono quelli di oggi (14 px a 8 px)", ["14px", "8px", "8px"], fuori);
  await h.close();

  /* ── I comandi del video del titolare ─────────────────────────────────── */
  //  Una regola vecchia nasconde i comandi nativi di TUTTI i video (camere della chiamata). Il nostro video li deve avere.
  await p.locator(".sol-copertina").focus();
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => document.querySelector(".sol-video video")?.currentTime > 0.2, null, { timeout: 8000 });
  vero("video del titolare: l'attributo controls c'è dopo il tocco", await p.evaluate(() => document.querySelector(".sol-video video").controls));
  //  Si vede davvero: i comandi nativi non sono nello stesso pixel del fotogramma (immagine con e senza comandi).
  await p.locator(".sol-video video").evaluate((v) => v.pause());
  const box = await p.locator(".sol-video").boundingBox();
  const conComandi = await p.screenshot({ clip: { x: box.x, y: box.y + box.height - 60, width: box.width, height: 60 } });
  await p.locator(".sol-video video").evaluate((v) => v.removeAttribute("controls"));
  const senza = await p.screenshot({ clip: { x: box.x, y: box.y + box.height - 60, width: box.width, height: 60 } });
  vero("video del titolare: la barra dei comandi è davvero disegnata in basso", !conComandi.equals(senza));
  await p.locator(".sol-video video").evaluate((v) => v.setAttribute("controls", ""));
  vero("video del titolare: si può mettere in pausa", await p.locator(".sol-video video").evaluate((v) => v.paused));

  //  Il tasto play/pausa nativo (dentro la shadow DOM del browser) esiste, ha misura e un aspetto da controllo, e funziona.
  //  Una regola `appearance: none !important` lo lascia senza disegno: la barra c'è ma senza tasto.
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const tastoNativo = async () => {
    const { nodes } = await cdp.send("DOM.getFlattenedDocument", { depth: -1, pierce: true });
    const n = nodes.find((x) => x.attributes?.includes("-webkit-media-controls-play-button"));
    if (!n) return null;
    const stile = Object.fromEntries((await cdp.send("CSS.getComputedStyleForNode", { nodeId: n.nodeId })).computedStyle.map((s) => [s.name, s.value]));
    const q = (await cdp.send("DOM.getBoxModel", { nodeId: n.nodeId })).model.content;
    return { display: stile.display, aspetto: stile.appearance, eventi: stile["pointer-events"], opacita: stile.opacity, x: (q[0] + q[2]) / 2, y: (q[1] + q[5]) / 2, larghezza: q[2] - q[0] };
  };
  const play = await tastoNativo();
  vero("video del titolare: il tasto play/pausa nativo esiste", !!play);
  c("tasto play/pausa nativo: visibile e toccabile", ["block", "auto", "1"], [play?.display, play?.eventi, play?.opacita]);
  c("tasto play/pausa nativo: aspetto da controllo del browser (appearance non azzerata)", "-internal-media-control", play?.aspetto);
  vero("tasto play/pausa nativo: ha una misura (≥ 30 px)", (play?.larghezza ?? 0) >= 30);
  //  E funziona: un clic sul tasto fa partire e un altro ferma.
  await p.mouse.click(play.x, play.y);
  await p.waitForTimeout(400);
  const parte = await p.locator(".sol-video video").evaluate((v) => !v.paused);
  await p.mouse.click(play.x, play.y);
  await p.waitForTimeout(300);
  const ferma = await p.locator(".sol-video video").evaluate((v) => v.paused);
  vero("video del titolare: il clic sul tasto play/pausa lo fa partire e poi lo ferma", parte && ferma);

  //  Da tastiera: durante il video si può tornare sul video (Shift+Tab dal link dopo il video) e fermarlo con Spazio.
  await p.reload();
  await p.waitForSelector(".sol-copertina");
  const tabPrima = await p.evaluate(() => document.querySelector(".sol-video video").tabIndex);
  c("prima del tocco il video non è nell'ordine del Tab (c'è la copertina)", -1, tabPrima);
  await p.locator(".sol-copertina").focus();
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => document.querySelector(".sol-video video")?.currentTime > 0.3, null, { timeout: 8000 });
  c("durante il video: tabindex 0 (si raggiunge con la tastiera)", 0, await p.evaluate(() => document.querySelector(".sol-video video").tabIndex));
  await p.keyboard.press("Tab");
  await p.keyboard.press("Shift+Tab");
  c("Tab e Shift+Tab riportano il fuoco sul video", "VIDEO", await p.evaluate(() => document.activeElement?.tagName));
  await p.keyboard.press("Space");
  await p.waitForTimeout(300);
  vero("Spazio sul video lo mette in pausa", await p.locator(".sol-video video").evaluate((v) => v.paused));

  /* ── Il fuoco ──────────────────────────────────────────────────────────── */
  await p.reload();
  await p.waitForSelector(".sol-copertina");
  await p.keyboard.press("Tab");
  const fuocoCopertina = await p.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return { classe: el.className, stile: s.outlineStyle, larghezza: parseFloat(s.outlineWidth), distanza: parseFloat(s.outlineOffset) };
  });
  c("Tab: il fuoco arriva alla copertina", "sol-copertina", fuocoCopertina.classe);
  c("fuoco sulla copertina: anello pieno", "solid", fuocoCopertina.stile);
  //  Il riquadro taglia (overflow hidden): l'anello deve stare tutto DENTRO il bordo della copertina.
  vero(`fuoco sulla copertina: anello dentro il riquadro (offset ${fuocoCopertina.distanza}, spessore ${fuocoCopertina.larghezza})`, fuocoCopertina.distanza + fuocoCopertina.larghezza <= 0);
  //  E a schermo si vede: i pixel lungo il bordo alto della copertina non sono quelli senza fuoco.
  const b2 = await p.locator(".sol-copertina").boundingBox();
  const area = { x: b2.x + 40, y: b2.y, width: 120, height: 6 };
  const conFuoco = await p.screenshot({ clip: area });
  await p.evaluate(() => document.activeElement.blur());
  const senzaFuoco = await p.screenshot({ clip: area });
  vero("fuoco sulla copertina: l'anello si vede a schermo", !conFuoco.equals(senzaFuoco));

  //  Al play il fuoco va al video (non al body); alla fine torna alla copertina.
  await p.locator(".sol-copertina").focus();
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => document.querySelector(".sol-video video")?.currentTime > 0.2, null, { timeout: 8000 });
  c("al play il fuoco è sul video", "VIDEO", await p.evaluate(() => document.activeElement?.tagName));
  await p.evaluate(() => {
    const v = document.querySelector(".sol-video video");
    v.currentTime = v.duration - 0.2;
  });
  await p.waitForSelector(".sol-copertina", { timeout: 8000 });
  await p.waitForTimeout(150);
  c("alla fine il fuoco torna sulla copertina", "sol-copertina", await p.evaluate(() => document.activeElement?.className));

  //  Un clic del mouse (fuoco non da tastiera) non deve rubare il fuoco a niente: il fuoco al video vale solo se era sulla copertina.
  await p.reload();
  await p.waitForSelector(".sol-copertina");
  await p.evaluate(() => document.activeElement?.blur());
  await p.evaluate(() => document.querySelector(".sol-copertina").click());
  await p.waitForFunction(() => document.querySelector(".sol-video video")?.currentTime > 0.2, null, { timeout: 8000 });
  vero("play da un clic: nessun errore e il video gira", errori.length === 0);

  /* ── Il tasto della clip: anello visibile (sta dentro il riquadro con overflow hidden) ──── */
  await p.reload();
  await p.waitForSelector(".sol-media-tasto");
  await p.locator(".sol-media-tasto").focus();
  await p.keyboard.press("Shift+Tab");
  await p.keyboard.press("Tab");
  const tasto = await p.evaluate(() => {
    const el = document.querySelector(".sol-media-tasto");
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect(), q = el.parentElement.getBoundingClientRect();
    const fuori = parseFloat(s.outlineOffset) + parseFloat(s.outlineWidth);
    return { dentro: r.right + fuori <= q.right && r.bottom + fuori <= q.bottom, stile: s.outlineStyle };
  });
  vero("tasto della clip: ha l'anello e l'anello sta dentro il riquadro che taglia", tasto.stile === "solid" && tasto.dentro);

  /* ── Misura dei titoli a 1440 ─────────────────────────────────────────── */
  const grande = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await grande.goto(base + "/index.html");
  const misure = await grande.evaluate(() => {
    const prova = (cl) => {
      const el = document.createElement("h2");
      el.className = cl;
      el.textContent = "x";
      document.querySelector("main").appendChild(el);
      return Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100;
    };
    return { h1: prova("sol-h1"), nome: prova("sol-h2-nome"), spiegazione: prova("sol-h2-spiegazione") };
  });
  c("a 1440: H1 64, nomi 32, spiegazione 44", { h1: 64, nome: 32, spiegazione: 44 }, { h1: misure.h1, nome: Math.round(misure.nome), spiegazione: misure.spiegazione });
  vero(`a 1440: i nomi sono 32 px pieni (letto ${misure.nome})`, misure.nome >= 31.95);

  /* ── axe-core: il nome accessibile contiene il testo visibile (WCAG 2.5.3, V13) ──────────
     La copertina del video ha il testo «Te lo spiego in 30 secondi» e, a fine video, «Riguarda»:
     il nome del bottone deve cominciare da quello che si legge sul bottone. */
  const axe = async (pag) => {
    await pag.addScriptTag({ content: readFileSync(AXE, "utf8") });
    return pag.evaluate(async () => {
      const r = await window.axe.run(document, { rules: { "label-content-name-mismatch": { enabled: true } }, resultTypes: ["violations"] });
      return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id + ": " + v.nodes.map((n) => n.target.join(" ")).join(" | "));
    });
  };
  await p.reload();
  await p.waitForSelector(".sol-copertina");
  c("axe (gravi e critiche) sulla copertina del video: nessuna violazione", [], await axe(p));
  const nome = await p.evaluate(() => document.querySelector(".sol-copertina").getAttribute("aria-label"));
  vero(`il nome accessibile comincia dal testo visibile («${nome}»)`, nome?.startsWith("Te lo spiego in 30 secondi"));
  vero("il nome accessibile dice ancora che c'è l'audio", /con audio/.test(nome ?? ""));
  //  A fine video il testo visibile è «Riguarda»: anche il nome.
  await p.locator(".sol-copertina").click();
  await p.waitForFunction(() => document.querySelector(".sol-video video")?.currentTime > 0.2, null, { timeout: 8000 });
  await p.evaluate(() => {
    const v = document.querySelector(".sol-video video");
    v.currentTime = v.duration - 0.2;
  });
  await p.waitForSelector(".sol-copertina", { timeout: 8000 });
  c("axe a fine video («Riguarda»): nessuna violazione", [], await axe(p));
  vero("a fine video il nome comincia da «Riguarda»", (await p.evaluate(() => document.querySelector(".sol-copertina").getAttribute("aria-label")))?.startsWith("Riguarda"));
} finally {
  await browser.close();
  server.close();
}
finisci();
