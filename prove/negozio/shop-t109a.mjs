/** ── VETRINA V1 · T109a · GUSCIO E SCORRIMENTO: LE CORREZIONI DEI COLLAUDI T103a/b/c (23/11/2026) ──────────────────────
 *  Un controllo per ogni difetto. Dove la resa non si misura senza un browser (testo al 200 %, pixel coperti, fuoco vero) la prova legge il
 *  sorgente e dice nel nome COSA guarda; dove c'è una funzione pura la prova la esegue; la 404 è disegnata davvero (`_rende.mjs`).
 *   1 · testata a testo 200 %: logo che si stringe, tre tasti da 44 px veri (non in rem), niente cambia con `codice`  (T103a-3, T103b-1)
 *   2 · `scroll-padding-bottom`: `--barra-h` esiste sempre (di partenza è il banner) e la barra consulenza la scrive   (T103a-1, T103b-3)
 *   3 · banner cookie e barra consulenza da 640 px in su: la barra sta SOPRA il banner a ogni larghezza                  (T103c-1)
 *   4 · «Cura» del piè di pagina a 44 × 44                                                                                (T103a-5)
 *   5 · 404 sotto `/shop/*` nel guscio nuovo, con i testi che esistono, `codice` com'è oggi                              (T103a-4)
 *   6 · il fuoco torna a chi ha aperto il pannello consulenza dopo Esc                                                    (T103a-6, T103c-4)
 *   7 · con `codice` il 404 di categoria e ricerca resta quello della radice (il `notFoundComponent` di `/shop` non lo prende)   (revisore)
 *  Regola: `mod[...]` solo per i moduli di MODULI; gli altri si caricano con `carica(radice, "src/…")`. Nessuna rete, dati inventati. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { rendi, rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);
const BASE = "d20da6c";

/** Impacchetta un modulo del progetto e ne restituisce le esportazioni (`null` se non esiste o non si impacchetta: la prova diventa rossa, non lancia). */
function carica(radice, file) {
  const dir = mkdtempSync(join(tmpdir(), "prova-t109a-"));
  try {
    const r = requireQui("esbuild").buildSync({
      entryPoints: [join(radice, file)], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
      loader: { ".png": "dataurl" }, alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
    });
    const f = join(dir, "modulo.cjs");
    writeFileSync(f, r.outputFiles[0].text);
    return requireQui(f);
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const classiDi = (tag) => tag?.match(/className="([^"]*)"/)?.[1].split(/\s+/) ?? [];
/** Il primo tag che contiene `marca` (da `<` a `>`), per leggerne le classi. */
const tagCon = (src, marca) => { const i = src.indexOf(marca); if (i < 0) return null; const a = src.lastIndexOf("<", i); return src.slice(a, src.indexOf(">", i) + 1); };
const dalBase = (radice, file) => { try { return execFileSync("git", ["show", `${BASE}:${file}`], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 24 }); } catch { return null; } };
const corpo = (src, firma) => { const i = src.indexOf(firma); if (i < 0) return null; const f = src.indexOf("\n}", i); return f < 0 ? null : src.slice(i, f + 2); };

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T109a · GUSCIO E SCORRIMENTO (23/11/2026)");
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const nudo = (f) => senzaCommenti(leggi(f));
  const T = carica(radice, "src/landing/testi-shop.ts");
  const TS = T?.TESTI_SHOP;

  /* ── 1 · testata a testo 200 % ── */
  const header = nudo("src/components/shop/guscio/ShopHeader.tsx");
  const ricerca = nudo("src/components/shop/guscio/RicercaShop.tsx");
  const tagLogo = tagCon(header, 'className="brackets');
  const tagImg = tagCon(header, "<img src={logo}");
  c("T103a-3: il logo della testata si stringe (`min-w-0 shrink`, non `shrink-0`) e l'immagine con lui (`min-w-0 object-contain`)", [true, true, false, true, true], [
    classiDi(tagLogo).includes("min-w-0"), classiDi(tagLogo).includes("shrink"), classiDi(tagLogo).includes("shrink-0"), classiDi(tagImg).includes("min-w-0"), classiDi(tagImg).includes("object-contain"),
  ]);
  const tasto = (src) => src.match(/const TASTO =\s*"([^"]*)"/)?.[1].split(/\s+/) ?? [];
  c("T103b-1: i tasti della testata (carrello, menu) sono 44 × 44 px veri, non in rem: a testo al 200 % non diventano 88", [true, true, false, false], [
    tasto(header).includes("h-[44px]"), tasto(header).includes("w-[44px]"), tasto(header).includes("h-11"), tasto(header).includes("w-11"),
  ]);
  c("T103b-1: lo stesso per la lente e la X della ricerca (che stanno nella stessa riga)", [true, true, false, false], [
    tasto(ricerca).includes("h-[44px]"), tasto(ricerca).includes("w-[44px]"), tasto(ricerca).includes("h-11"), tasto(ricerca).includes("w-11"),
  ]);
  c("T103b-1: le icone dei tre tasti sono in px (24 px dentro 44 px, non 48 px dentro 44 a testo al 200 %)", [true, true, true, true], [
    /<ShoppingBag className="h-\[24px\] w-\[24px\]"/.test(header), /<Menu className="h-\[24px\] w-\[24px\]"/.test(header), /<Search className="h-\[24px\] w-\[24px\]"/.test(ricerca), /<X className="h-\[24px\] w-\[24px\]"/.test(ricerca),
  ]);
  const shopBase = dalBase(radice, "src/routes/shop.tsx");
  const shopOra = leggi("src/routes/shop.tsx");
  const testata = (s) => corpo(s ?? "", "function Header()");
  c("T103a-3: con `codice` la testata di oggi (`Header` di `shop.tsx`) è uguale al base byte per byte", [true, true], [testata(shopBase) !== null, testata(shopBase) === testata(shopOra)]);

  /* ── 2 · scroll-padding-bottom ── */
  const css = leggi("src/styles.css");
  const bloccoV1 = css.match(/\[data-shop-v1\] \{[^}]*\}/)?.[0] ?? "";
  c("T103a-1: sulla radice `--barra-h` c'è sempre: di partenza è `--banner-h` (così il banner aperto conta anche senza barre) e lo scorrimento la legge ancora", [true, true], [
    /--barra-h:\s*var\(--banner-h,\s*0px\)\s*;/.test(bloccoV1), /scroll-padding-bottom:\s*calc\(var\(--barra-h,\s*0px\)\s*\+\s*16px\)/.test(bloccoV1),
  ]);
  const barra = nudo("src/components/landing/consulenza/BarraConsulenza.tsx");
  c("T103a-1: la barra consulenza (nello shop, sopra il banner) scrive `--barra-h` = banner + la sua altezza e la toglie quando se ne va", [true, true, true], [
    /setProperty\(\s*"--barra-h",\s*`calc\(var\(--banner-h,\s*0px\)\s*\+\s*\$\{[^}]+\}px\)`\s*\)/.test(barra), /removeProperty\(\s*"--barra-h"\s*\)/.test(barra), /if \(!sopraAlBanner \|\| !visibile/.test(barra),
  ]);

  /* ── 3 · la barra sta sopra il banner a ogni larghezza ── */
  const classi = corpo(barra, "export function classiBarra") ?? "";
  c("T103c-1: `classiBarra` con `sopraAlBanner` mette `bottom` sotto il banner sotto E da 640 px (`max-sm:` e `sm:`); senza l'opzione resta la landing di oggi", [true, true, true], [
    classi.includes("max-sm:bottom-[var(--banner-h,0px)]"), classi.includes(" sm:bottom-[var(--banner-h,0px)]"), /sopraAlBanner \? `\$\{contenitore\} [^`]*` : contenitore/.test(classi),
  ]);

  /* ── 4 · «Cura» del piè di pagina ── */
  const footer = nudo("src/components/shop/guscio/FooterShop.tsx");
  c("T103a-5: i link del piè di pagina sono larghi almeno 44 px oltre che alti (`min-w-11`), così «Cura» non è 32 × 44", [true, true], [
    /const LINK =\s*"[^"]*\bmin-w-11\b/.test(footer), /const LINK =\s*"[^"]*\bmin-h-11\b/.test(footer),
  ]);
  const hf = (await rendiComponente(radice, "src/components/shop/guscio/FooterShop.tsx", "FooterShop", { anno: 2031, categorie: [{ slug: TS.categorie[1].slug, quanti: 3 }] })).html;
  const linkDelPiede = [...hf.matchAll(/<(a|button)\b[^>]*>/g)].map((m) => m[0]).filter((t) => /underline-offset-4/.test(t) && /shop-anello-scuro/.test(t));
  c("T103a-5: nel piè di pagina disegnato ogni link e bottone da 44 px ha `min-w-11` e `min-h-11`", [true, []], [linkDelPiede.length >= 5, linkDelPiede.filter((t) => !(/\bmin-w-11\b/.test(t) && /\bmin-h-11\b/.test(t)))]);

  /* ── 5 · 404 sotto /shop/* ── */
  c("T103a-4: la rotta `/shop` ha il suo `notFoundComponent`", true, /notFoundComponent:\s*\w+/.test(senzaCommenti(shopOra)));
  const CMS = { modalita: "cms" };
  const ignota = { pathname: "/shop/zzz-non-esiste", matches: [{ routeId: "__root__" }, { routeId: "/shop", globalNotFound: true }], loaderData: undefined, server: {}, outlet: "CONTENUTO-PROVA" };
  const testo = (h) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
  const layoutCms = await rendi(radice, "src/routes/shop.tsx", { ...ignota, context: CMS }).catch(() => ({ html: "" }));
  c("T103a-4: con `cms` un percorso che non esiste sta nel guscio NUOVO (testata nuova, un `main`, piè nuovo), non in quello di oggi", [true, true, false], [
    layoutCms.html.includes('data-guscio="nuovo"'), /<main[^>]*id="contenuto"/.test(layoutCms.html), layoutCms.html.includes("bg-blueprint"),
  ]);
  const nonTrovata = await rendi(radice, "src/routes/shop.tsx", { ...ignota, context: CMS, componente: "notFoundComponent" }).catch(() => ({ html: "" }));
  const h1 = nonTrovata.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) ?? [];
  c("T103a-4: la 404 è la card di scheda e categoria: un solo h1 col titolo di `err404`, il testo di `err404`, «Patch pronte» e «Cura», niente inglese", [1, true, true, true, false], [
    h1.length, TS && testo(nonTrovata.html).includes(TS.err404.titolo), TS && testo(nonTrovata.html).includes(TS.err404.testo), TS && testo(nonTrovata.html).includes(TS.err404.bottone) && testo(nonTrovata.html).includes(TS.err404.link), /Not Found|not found/.test(nonTrovata.html),
  ]);
  const nonTrovataCodice = await rendi(radice, "src/routes/shop.tsx", { ...ignota, context: { modalita: "codice" }, componente: "notFoundComponent" }).catch(() => ({ html: "" }));
  c("T103a-4: con `codice` la 404 resta quella predefinita del router di oggi (`<p>Not Found</p>`)", "<p>Not Found</p>", nonTrovataCodice.html);
  const layoutCodice = await rendi(radice, "src/routes/shop.tsx", { ...ignota, context: { modalita: "codice" } }).catch(() => ({ html: "" }));
  c("T103a-4: con `codice` il percorso che non esiste resta nel guscio di oggi", [false, true], [layoutCodice.html.includes('data-guscio="nuovo"'), layoutCodice.html.includes("bg-blueprint")]);
  const layoutVero = await rendi(radice, "src/routes/shop.tsx", { pathname: "/shop/checkout", matches: [{ routeId: "__root__" }, { routeId: "/shop" }, { routeId: "/shop/checkout" }], context: CMS, server: {}, outlet: "X" }).catch(() => ({ html: "" }));
  c("T103a-4: la cassa (rotta che esiste) resta nel guscio di oggi anche con `cms`", [false, true], [layoutVero.html.includes('data-guscio="nuovo"'), layoutVero.html.includes("bg-blueprint")]);

  /* ── 6 · il fuoco torna a chi ha aperto il pannello consulenza ── */
  const F = carica(radice, "src/components/landing/consulenza/fuoco.ts");
  const evento = () => { const e = { fermato: false, preventDefault() { e.fermato = true; } }; return e; };
  const bottone = (connesso) => { const b = { isConnected: connesso, chiamate: 0, focus() { b.chiamate++; } }; return b; };
  const e1 = evento(); const b1 = bottone(true);
  const e2 = evento(); const b2 = bottone(false);
  const e3 = evento();
  c("T103a-6: `restituisciFuoco` rimette il fuoco su chi aveva aperto il pannello (e ferma il comportamento predefinito di Radix, che senza `Trigger` lo lascia sul `body`)", [true, true, 1], [F?.restituisciFuoco?.(e1, b1), e1.fermato, b1.chiamate]);
  c("T103a-6: se chi aveva aperto non c'è più (menu chiuso, pagina cambiata) non fa niente: nessun fuoco su un elemento staccato", [false, false, 0, false], [F?.restituisciFuoco?.(e2, b2), e2.fermato, b2.chiamate, F?.restituisciFuoco?.(e3, null)]);
  const doc = (attivo, corpo_) => ({ activeElement: attivo, body: corpo_ });
  const corpoDoc = { nome: "body" }; const pulsante = { nome: "pulsante" };
  c("T103a-6: `chiHaAperto` ricorda l'elemento col fuoco, ma non il `body` né il vuoto", [pulsante, null, null], [F?.chiHaAperto?.(doc(pulsante, corpoDoc)), F?.chiHaAperto?.(doc(corpoDoc, corpoDoc)), F?.chiHaAperto?.(doc(null, corpoDoc))]);
  const pannello = nudo("src/components/landing/consulenza/PannelloProblemi.tsx");
  c("T103a-6: il pannello ricorda chi l'ha aperto PRIMA che la barra diventi `inert` e glielo restituisce alla chiusura (`onCloseAutoFocus`)", [true, true], [
    /chiHaAperto\(document\)/.test(pannello), /onCloseAutoFocus=\{\(e\) =>[^}]*restituisciFuoco\(e,/.test(pannello),
  ]);

  /* ── 7 · con `codice` `throw notFound()` di ricerca e categoria resta della radice ── */
  //  Con il `notFoundComponent` di `/shop` un `notFound()` senza `routeId` passa dalla radice alla rotta `/shop` (il 404 perde il guscio di oggi e diventa un `<p>`).
  //  Prova con il router vero (`createRouter` + `createMemoryHistory`, nessun server): il loader lancia ESATTAMENTE ciò che c'è scritto nel sorgente di ciascuna rotta.
  const R = await import(pathToFileURL(join(radice, "node_modules/@tanstack/react-router/dist/esm/index.js")).href);
  for (const [file, percorso] of [["src/routes/shop.cerca.tsx", "/shop/cerca"], ["src/routes/shop.c.$slug.tsx", "/shop/c/x"]]) {
    const src = nudo(file);
    const arg = src.match(/throw notFound\(([^)]*(?:\([^)]*\))?[^)]*)\)/)?.[1].trim() ?? "?";
    c(`${file}: il \`notFound\` del ramo \`codice\` indica la radice (\`notFound({ routeId: rootRouteId })\`) e importa \`rootRouteId\``, [true, true], [arg === "{ routeId: rootRouteId }", /import \{[^}]*\brootRouteId\b[^}]*\} from "@tanstack\/react-router"/.test(src)]);
    const opzioni = arg === "" ? undefined : arg === "{ routeId: rootRouteId }" ? { routeId: R.rootRouteId } : { sconosciuto: true };
    const root = R.createRootRoute({ notFoundComponent: () => null });
    const shop = R.createRoute({ getParentRoute: () => root, path: "/shop", component: () => null, notFoundComponent: () => null });
    const figlia = R.createRoute({ getParentRoute: () => shop, path: percorso.startsWith("/shop/c/") ? "/c/$slug" : "/cerca", loader: () => { throw R.notFound(opzioni); }, component: () => null });
    const router = R.createRouter({ routeTree: root.addChildren([shop.addChildren([figlia])]), history: R.createMemoryHistory({ initialEntries: [percorso] }) });
    await router.load();
    const globale = router.state.matches.filter((m) => m.globalNotFound).map((m) => m.routeId);
    c(`${file}: con \`/shop\` che ha il suo \`notFoundComponent\` il 404 di \`codice\` è gestito dalla RADICE (\`globalNotFound\` su \`__root__\`, non su \`/shop\`)`, ["__root__"], globale);
  }
}
