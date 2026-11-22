/** ── VETRINA V1 · T74 · LE FOTO DELLO SHOP E GLI STILI COMUNI ────────────────
 *  `src/shop/cms/vetrina-foto.ts` (srcset, sizes, misure, loading/fetchpriority, alt), `src/components/shop/FotoShop.tsx`
 *  (disegnato davvero con esbuild + react-dom/server) e il blocco di `src/styles.css` sotto `[data-shop-v1]` (D100).
 *  Cosa deve valere (V1-T4, V1-T5, V1-T14 sulle immagini, V1-T11/T12):
 *   · srcset 480/960/1600 dalle misure del CMS, ma mai una misura oltre la prima che copre il DOPPIO del riquadro;
 *   · width/height sempre presenti; solo la foto `prima` è eager + fetchpriority high, le altre lazy + async;
 *   · senza `alt` lancia in sviluppo e in produzione disegna alt=""; senza foto e con `nascondiSeVuoto` non c'è nessun nodo;
 *   · le foto globali (un solo file) hanno le misure di D99; lo sfondo è `brand-velo-10`, mai grigio;
 *   · lo stile sta tutto sotto `[data-shop-v1]` e contiene `prefers-reduced-motion`. Dati inventati, nessuna rete. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requireQui = createRequire(import.meta.url);

const FOTO = { w480: "https://m.prova.test/a-480.jpg", w960: "https://m.prova.test/a-960.jpg", w1600: "https://m.prova.test/a-1600.jpg" };

/** Disegna `FotoShop` con `props` (esbuild + react-dom/server). `produzione` imposta `import.meta.env.PROD` come farebbe Vite. */
async function disegna(radice, props, { produzione = false } = {}) {
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "prova-foto-"));
  try {
    const entrata = join(dir, "entrata.tsx");
    writeFileSync(
      entrata,
      `import { renderToStaticMarkup } from "react-dom/server";
       import React from "react";
       import { FotoShop } from "@/components/shop/FotoShop";
       export const html = (p) => renderToStaticMarkup(React.createElement(FotoShop, p));`,
    );
    const r = await esbuild.build({
      entryPoints: [entrata], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
      alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
      define: { "import.meta.env.PROD": String(produzione), "import.meta.env.DEV": String(!produzione) },
    });
    const file = join(dir, "foto.cjs");
    writeFileSync(file, r.outputFiles[0].text);
    return requireQui(file).html(props);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const lancia = (f) => { try { f(); return "non lancia"; } catch (e) { return e.message; } };
const attr = (html, nome) => (html.match(new RegExp(`\\s${nome}="([^"]*)"`, "i")) ?? [])[1];
const larghezze = (srcset) => srcset.split(",").map((x) => Number(x.trim().split(/\s+/)[1].replace("w", "")));

export async function prove(mod, { c, gruppo, radice }) {
  const V = mod["shop/cms/vetrina-foto"];
  gruppo("VETRINA V1 · T74 · FOTO E STILI COMUNI (23/11/2026)");

  // ── srcset: 480/960/1600, e mai oltre la prima misura che copre il doppio del riquadro ──
  c("srcset della galleria (riquadro 640 → serve 1280): tutte e tre le misure, in ordine", [480, 960, 1600], larghezze(V.srcsetDa(FOTO, 640)));
  c("srcset senza riquadro: tutte e tre, ognuna col suo URL", `${FOTO.w480} 480w, ${FOTO.w960} 960w, ${FOTO.w1600} 1600w`, V.srcsetDa(FOTO));
  c("srcset della card (riquadro 300 → serve 600): 480 e 960, la 1600 non si offre", [480, 960], larghezze(V.srcsetDa(FOTO, 300)));
  c("srcset della miniatura (riquadro 96 → serve 192): solo 480", [480], larghezze(V.srcsetDa(FOTO, 96)));
  c("con le sole misure che esistono (campione: solo 480) il srcset ha solo quella", [480], larghezze(V.srcsetDa({ w480: FOTO.w480 })));
  c("con 480 e 960 (card leggera) niente 1600 inventata", [480, 960], larghezze(V.srcsetDa({ w480: FOTO.w480, w960: FOTO.w960 })));
  c("senza foto il srcset è vuoto", ["", ""], [V.srcsetDa(null), V.srcsetDa({})]);
  // il criterio V1-T14 in forma di regola: nessuna misura dopo la prima che arriva a 2 × riquadro
  const sfori = [];
  for (const [uso, u] of Object.entries(V.USI)) {
    const w = larghezze(V.srcsetDa(FOTO, u.riquadro));
    const oltre = w.filter((x, i) => i > 0 && w[i - 1] >= 2 * u.riquadro);
    if (oltre.length) sfori.push(`${uso}: ${w}`);
  }
  c("per ogni uso nessuna misura del srcset viene dopo una che già copre il doppio del riquadro", [], sfori);

  // ── sizes ──
  c("sizes della card: 2 colonne sul telefono, 3 e 4 più su", "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw", V.sizesPer("card"));
  c("ogni uso ha un sizes non vuoto", [], Object.keys(V.USI).filter((u) => !V.sizesPer(u)));
  c("un uso che non esiste lancia (non si indovina)", "FotoShop: uso sconosciuto «tavolo»", lancia(() => V.sizesPer("tavolo")));

  // ── proporzioni e misure dichiarate ──
  c("proporzioni: prodotto 1:1, persone 4:5, studio e pacco 4:3", { quadrata: [1, 1], persona: [4, 5], studio: [4, 3] }, V.proporzioni);
  c("D99: lato massimo delle foto globali (hero 1100, ritratto 240, pacco/colori/poster 960)", [1100, 240, 960, 960, 960], ["hero", "ritratto", "pacco", "colori", "poster"].map((u) => V.USI[u].lato));
  c("D99: le foto globali con proporzione (4:5 → 880×1100, 1:1 → 240×240, 4:3 → 960×720, 4:5 → 768×960)", [[880, 1100], [240, 240], [960, 720], [960, 720], [768, 960]],
    ["hero", "ritratto", "pacco", "colori", "poster"].map((u) => { const a = V.attributiImg({ src: "https://m.prova.test/x.jpg", alt: "x", uso: u }); return [a.width, a.height]; }));

  // ── attributiImg ──
  const card = V.attributiImg({ foto: FOTO, alt: "Patch di prova", uso: "card" });
  c("card: width e height quadrati dell'ultima misura offerta (960), src = la più piccola", [960, 960, FOTO.w480], [card.width, card.height, card.src]);
  c("card: srcset di 480 e 960 e sizes della card", [[480, 960], V.sizesPer("card")], [larghezze(card.srcSet), card.sizes]);
  c("di norma lazy + async, nessuna priorità", ["lazy", "async", undefined], [card.loading, card.decoding, card.fetchPriority]);
  const prima = V.attributiImg({ foto: FOTO, alt: "Patch di prova", uso: "galleria", prima: true });
  c("la prima foto: eager + fetchpriority high", ["eager", "high"], [prima.loading, prima.fetchPriority]);
  c("…e la prima non ha decoding async (D98 lo vuole solo sulle altre)", undefined, prima.decoding);
  c("`sizes` passato da chi la usa vince su quello dell'uso", "100vw", V.attributiImg({ foto: FOTO, alt: "x", uso: "card", sizes: "100vw" }).sizes);
  const globale = V.attributiImg({ src: "https://m.prova.test/hero.jpg", alt: "Il titolare al lavoro", uso: "hero", prima: true });
  c("foto globale (un solo file): nessun srcset né sizes, src com'è", [undefined, undefined, "https://m.prova.test/hero.jpg"], [globale.srcSet, globale.sizes, globale.src]);
  c("senza foto e senza src non c'è niente da disegnare (null)", [null, null, null], [V.attributiImg({ alt: "x", uso: "card" }), V.attributiImg({ src: "", alt: "x", uso: "hero" }), V.attributiImg({ foto: null, src: null, alt: "x", uso: "card" })]);

  // ── alt mancante ──
  const senzaAlt = (alt, sviluppo) => lancia(() => V.attributiImg({ foto: FOTO, alt, uso: "card", sviluppo }));
  c("alt mancante in sviluppo: lancia (undefined e null)", ["FotoShop: manca l'alt della foto", "FotoShop: manca l'alt della foto"], [senzaAlt(undefined, true), senzaAlt(null, true)]);
  c("alt mancante in produzione: non lancia e disegna alt=\"\"", ["", "", ""], [V.attributiImg({ foto: FOTO, uso: "card", sviluppo: false }).alt, V.attributiImg({ foto: FOTO, alt: null, uso: "card", sviluppo: false }).alt, V.attributiImg({ foto: FOTO, alt: 7, uso: "card", sviluppo: false }).alt]);
  c("un alt vero resta com'è, anche in produzione", "Patch di prova", V.attributiImg({ foto: FOTO, alt: "Patch di prova", uso: "card", sviluppo: false }).alt);
  c("senza foto non serve l'alt: niente da disegnare, niente errore", null, V.attributiImg({ foto: null, uso: "card", sviluppo: true }));

  // ── il componente disegnato davvero ──
  const hCard = await disegna(radice, { foto: FOTO, alt: "Patch di prova", uso: "card" });
  c("disegno: un solo <img> con alt, width e height", [1, "Patch di prova", "960", "960"], [(hCard.match(/<img\b/g) ?? []).length, attr(hCard, "alt"), attr(hCard, "width"), attr(hCard, "height")]);
  c("disegno: lazy + async, nessun fetchpriority, srcset e sizes della card", ["lazy", "async", undefined, `${FOTO.w480} 480w, ${FOTO.w960} 960w`, V.sizesPer("card")], [attr(hCard, "loading"), attr(hCard, "decoding"), attr(hCard, "fetchpriority"), attr(hCard, "srcset"), attr(hCard, "sizes")]);
  const hPrima = await disegna(radice, { foto: FOTO, alt: "Patch di prova", uso: "galleria", prima: true });
  c("disegno: la prima è eager con fetchpriority high", ["eager", "high"], [attr(hPrima, "loading"), attr(hPrima, "fetchpriority")]);
  c("disegno: lo sfondo mentre arriva è brand-velo-10, mai grigio", [true, false], [/brand-velo-10/.test(hCard), /gray|grey|slate|zinc|neutral|bg-muted/.test(hCard)]);
  c("disegno: nessuna ombra, nessun gradiente, nessuna animazione sul riquadro", false, /shadow|gradient|animate-/.test(hCard));
  const hVuoto = await disegna(radice, { foto: null, src: "", alt: "x", uso: "card" });
  c("disegno: senza foto con `nascondiSeVuoto` (di norma) non c'è nessun nodo", "", hVuoto);
  const hVuoto2 = await disegna(radice, { foto: { w480: "" }, alt: "x", uso: "card", nascondiSeVuoto: true });
  c("disegno: anche una misura vuota conta come vuota", "", hVuoto2);
  const hRiquadro = await disegna(radice, { alt: "x", uso: "card", nascondiSeVuoto: false });
  c("disegno: con `nascondiSeVuoto={false}` resta il solo riquadro di sfondo, senza <img>", [true, false], [/brand-velo-10/.test(hRiquadro), /<img/.test(hRiquadro)]);
  const hGlob = await disegna(radice, { src: "https://m.prova.test/titolare.jpg", alt: "Il titolare", uso: "ritratto", className: "rounded-full" });
  c("disegno: ritratto da un solo file, 240×240, senza srcset, la classe del chiamante nel riquadro", ["240", "240", undefined, true], [attr(hGlob, "width"), attr(hGlob, "height"), attr(hGlob, "srcset"), /rounded-full/.test(hGlob)]);
  const hSenzaAlt = await disegna(radice, { foto: FOTO, uso: "card" }, { produzione: true });
  c("disegno in produzione senza alt: alt=\"\" presente, la pagina non si rompe", ["", 1], [attr(hSenzaAlt, "alt"), (hSenzaAlt.match(/<img\b/g) ?? []).length]);
  let sviluppoLancia;
  try { await disegna(radice, { foto: FOTO, uso: "card" }, { produzione: false }); sviluppoLancia = "non lancia"; } catch (e) { sviluppoLancia = e.message; }
  c("disegno in sviluppo senza alt: lancia", "FotoShop: manca l'alt della foto", sviluppoLancia);

  // ── sorgente: nessun segnaposto, nessun eager scritto a mano ──
  const sorg = readFileSync(join(radice, "src/components/shop/FotoShop.tsx"), "utf8");
  c("FotoShop non importa segnaposti (V1-T4)", false, /PlaceholderBox|HairSystemVisual|ProductVisual|ShopVisual/.test(sorg));
  c("`eager` non è scritto a mano nel componente: viene solo da `prima`", false, /["']eager["']/.test(sorg));

  // ── gli stili sotto [data-shop-v1] ──
  const css = readFileSync(join(radice, "src/styles.css"), "utf8");
  const inizio = css.indexOf("/* ── SHOP V1 · T74");
  const blocco = inizio < 0 ? "" : css.slice(inizio);
  c("il blocco di T74 c'è, è l'ultimo del file e c'è una sola intestazione", [true, 1], [inizio > 0, (css.match(/\/\* ── SHOP V1 · T74/g) ?? []).length]);
  // ogni regola ha il selettore che inizia per [data-shop-v1]; solo @keyframes (nomi `shop-*`) e @media fuori da una regola
  const senzaCommenti = blocco.replace(/\/\*[\s\S]*?\*\//g, "");
  const selettori = [];
  const leggi = (testo) => {
    let i = 0;
    while (i < testo.length) {
      const a = testo.indexOf("{", i);
      if (a < 0) break;
      const testa = testo.slice(i, a).trim();
      let prof = 1, j = a + 1;
      while (j < testo.length && prof) { if (testo[j] === "{") prof++; else if (testo[j] === "}") prof--; j++; }
      const dentro = testo.slice(a + 1, j - 1);
      if (testa.startsWith("@media")) leggi(dentro);
      else if (testa.startsWith("@keyframes")) selettori.push(testa);
      else selettori.push(testa);
      i = j;
    }
  };
  leggi(senzaCommenti);
  const fuori = selettori.filter((s) => !s.startsWith("@keyframes shop-") && !s.split(",").every((p) => p.trim().startsWith("[data-shop-v1]")));
  c("ogni selettore del blocco comincia per [data-shop-v1] (i @keyframes si chiamano shop-*)", [], fuori);
  c("il blocco contiene prefers-reduced-motion (animazioni a zero, transizioni 0,01 ms, scroll-behavior auto)", [true, true, true, true], [/@media \(prefers-reduced-motion: reduce\)/.test(blocco), /animation:\s*none\s*!important/.test(blocco), /transition-duration:\s*0\.01ms\s*!important/.test(blocco), /scroll-behavior:\s*auto\s*!important/.test(blocco)]);
  c("scroll-padding: 72 px sopra, la barra + 16 px sotto", [true, true], [/scroll-padding-top:\s*72px/.test(blocco), /scroll-padding-bottom:\s*calc\(var\(--barra-h,\s*0px\)\s*\+\s*16px\)/.test(blocco)]);
  c("le classi di D100 ci sono tutte", [], ["shop-anello", "shop-anello-scuro", "shop-respiro", "shop-foglio", "shop-dissolvi", "shop-pop", "shop-scheletro"].filter((k) => !new RegExp(`\\.${k}(?![\\w-])`).test(blocco)));
  c("fuoco: 2 px, scarto 2 px, #006CC4 su chiaro e bianco su scuro", [true, true], [/\.shop-anello:focus-visible\s*\{[^}]*outline:\s*2px solid #006CC4;[^}]*outline-offset:\s*2px/.test(blocco), /\.shop-anello-scuro:focus-visible\s*\{[^}]*outline:\s*2px solid #fff;[^}]*outline-offset:\s*2px/.test(blocco)]);
  c("respiro 0,55 ↔ 1 in 1,6 s; foglio 200 ms; dissolvi 150 ms; pop 0,8 → 1 in 200 ms", [true, true, true, true], [/animation:\s*shop-respiro 1\.6s/.test(blocco) && /opacity:\s*0\.55/.test(blocco), /animation:\s*shop-foglio 200ms/.test(blocco), /animation:\s*shop-dissolvi 150ms/.test(blocco), /animation:\s*shop-pop 200ms/.test(blocco) && /scale\(0\.8\)/.test(blocco)]);
  c("lo scheletro è brand-velo-10", true, /\.shop-scheletro\s*\{[^}]*var\(--brand-velo-10\)/.test(blocco));
  c("nessun nuovo fondo, gradiente, ombra, font o testo sfumato nel blocco", false, /gradient|box-shadow|@font-face|font-family|background-clip|backdrop-/.test(blocco));
  c("una sola animazione infinita nel blocco: il respiro dello scheletro", 1, (blocco.match(/infinite/g) ?? []).length);
}
