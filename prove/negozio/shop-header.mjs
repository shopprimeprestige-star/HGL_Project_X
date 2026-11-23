/** ── VETRINA V1 · T82a · L'HEADER E IL MENU DEL TELEFONO ──────────────────────────────────────────────────────
 *  `src/components/shop/guscio/ShopHeader.tsx` e `MenuTelefono.tsx`, disegnati davvero (esbuild + react-dom/server, `_rende.mjs`).
 *  Cosa deve valere (V1-H3, V1-T11, V1-T12 parte logica; D84, D82):
 *   · header `sticky top-0 z-30`, fondo `#081634` al 95 % e NESSUNA sfocatura dello sfondo (`backdrop-…`, né nel disegno né nel sorgente);
 *   · «Vai al contenuto» è la prima cosa che si raggiunge con Tab e punta all'`id` del contenuto;
 *   · sul telefono tre tasti da 44 px (ricerca, carrello, menu); numerino bianco con testo notte (mai il pallino blu), `aria-live`;
 *   · «Cura» = tendina con SOLO le categorie che hanno prodotti (nessuna = nessuna voce Cura); «Consulenza gratuita» = voce di testo con
 *     sottolineatura, mai un bottone pieno, con il conteggio `ClickConsulenza`;
 *   · il menu è un foglio Radix Dialog caricato in ritardo; il fuoco torna al tasto che l'ha aperto (riduttore `foglio`), ma non se si
 *     è scelta una voce; righe alte 56 px; nessun testo scritto nel componente (solo `testi-shop.ts`).
 *  Il fuoco vero, Esc nel documento e `aria-live` che annuncia non girano senza browser (D103): qui si prova ciò che si vede nel marchio,
 *  gli attributi e le funzioni pure; il resto lo guardano T103c e T106. Dati inventati, nessuna rete. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as D from "./_dati-vetrina.mjs";
import { gestore, rendiComponente } from "./_rende.mjs";

/** Il router finto di questa prova: `Link` passa `onClick` e `aria-current` e li registra come gestori; il percorso è `stato.pathname`. */
const ROUTER = `
import React from "react";
export const Link = ({ to, params, children, onClick, ...resto }) => {
  if (onClick) globalThis.__pagina.gestori.push({ tipo: "a", props: { onClick, children } });
  const href = String(to).replace(/\\$(\\w+)/g, (_, k) => encodeURIComponent((params ?? {})[k] ?? ""));
  return React.createElement("a", { href, ...resto }, children);
};
export const useRouterState = (o) => {
  const s = { location: { pathname: globalThis.__pagina.pathname ?? "/shop" } };
  return o && o.select ? o.select(s) : s;
};
`;
/** Radix Dialog finto: il portale vero non disegna niente sul server. Qui ogni pezzo si disegna sul posto e registra le sue proprietà in `pagina.radix`. */
const RADIX = `
import React from "react";
const nota = (nome, p) => { (globalThis.__pagina.radix ??= []).push({ nome, props: p }); };
const pezzo = (nome, tag) => (props) => {
  nota(nome, props);
  const { children, asChild, forceMount, onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown, onPointerDownOutside, onInteractOutside, ...dom } = props;
  return React.createElement(tag, { "data-radix": nome, ...dom }, children);
};
export const Root = (props) => { nota("Root", props); return props.open ? props.children : null; };
export const Portal = ({ children }) => children;
export const Overlay = pezzo("Overlay", "div");
export const Content = pezzo("Content", "div");
export const Title = pezzo("Title", "h2");
export const Description = pezzo("Description", "p");
export const Close = pezzo("Close", "button");
`;
const FINTI = { "@tanstack/react-router": ROUTER, "@radix-ui/react-dialog": RADIX };

const SLUG = ["patch-pronte", "shampoo-e-balsami", "districanti", "colle-e-remover", "spazzole", "kit"];
/** Una categoria come la dà il catalogo (basta `slug` e `quanti`: sono gli unici campi che l'header legge). */
const cat = (slug, quanti) => ({ slug, nome: `nome-${slug}`, tipo: "categoria", frase: null, foto: null, fotoAlt: null, seo: { titolo: null, descrizione: null }, ordine: 0, quanti });
const TUTTE = SLUG.map((s) => cat(s, 3));

/** L'apertura del tag che contiene `segno` (l'intero `<…>`), o `""`. */
function tag(html, segno) {
  const i = html.indexOf(segno);
  if (i < 0) return "";
  return html.slice(html.lastIndexOf("<", i), html.indexOf(">", i) + 1);
}
const classi = (t) => (t.match(/\sclass="([^"]*)"/) ?? [])[1]?.split(/\s+/).filter(Boolean) ?? [];
const attr = (t, nome) => (t.match(new RegExp(`\\s${nome}="([^"]*)"`)) ?? [])[1];
const conta = (testo, ago) => testo.split(ago).length - 1;
/** I testi dei link dentro l'elenco con quell'id (da `<ul id=…>` a `</ul>`). */
const vociDi = (html, id) => {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return [];
  return [...html.slice(i, html.indexOf("</ul>", i)).matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
};
/** Il testo di un elemento che comincia dopo `segno` fino alla chiusura `</…>` più vicina, senza i tag dentro. */
const testoDopo = (html, segno, chiusura) => {
  const i = html.indexOf(segno);
  if (i < 0) return null;
  const da = html.indexOf(">", i) + 1;
  return html.slice(da, html.indexOf(chiusura, da)).replace(/<[^>]*>/g, "");
};

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T82a · L'HEADER E IL MENU DEL TELEFONO (23/11/2026)");

  const fileHeader = join(radice, "src/components/shop/guscio/ShopHeader.tsx");
  const fileMenu = join(radice, "src/components/shop/guscio/MenuTelefono.tsx");
  const ci = [existsSync(fileHeader), existsSync(fileMenu)];
  c("i due componenti esistono (ShopHeader.tsx e MenuTelefono.tsx in components/shop/guscio)", [true, true], ci);
  if (!ci[0] || !ci[1]) return;
  const srcHeader = readFileSync(fileHeader, "utf8");
  const srcMenu = readFileSync(fileMenu, "utf8");

  // ── i pezzi puri, i testi e i riduttori, presi dallo stesso impacchettamento dei componenti ──
  const dir = mkdtempSync(join(tmpdir(), "prova-t82a-"));
  try {
    const calc = join(dir, "Calc.tsx");
    writeFileSync(
      calc,
      `import * as H from ${JSON.stringify(fileHeader)};
       import * as M from ${JSON.stringify(fileMenu)};
       import { TESTI_SHOP, TESTI_PROVVISORI } from "@/landing/testi-shop";
       import * as I from "@/shop/cms/vetrina-interazioni";
       export function Calc() { globalThis.__t82a = { H, M, TESTI_SHOP, TESTI_PROVVISORI, I }; return null; }`,
    );
    await rendiComponente(radice, calc, "Calc", {}, { finti: FINTI });
    const { H, M, TESTI_SHOP: T, TESTI_PROVVISORI: P, I } = globalThis.__t82a;
    const GUSCIO = P.guscio;

    const header = async (props = {}, stato = {}) => rendiComponente(radice, fileHeader, "ShopHeader", { categorie: TUTTE, ...props }, { finti: FINTI, ...stato });
    const menu = async (props = {}, stato = {}) => rendiComponente(radice, fileMenu, "MenuTelefono", { aperto: true, onApertoChange() {}, titolo: H.TESTI_HEADER_PROVVISORI.titoloMenu, voci: H.vociCura(TUTTE), onNavigazione() {}, onConsulenza() {}, onRendiFuoco() {}, ...props }, { finti: FINTI, ...stato });

    // ═══ 1 · «Cura» e il numerino: le funzioni pure ═══
    const nomiCura = T.categorie.filter((x) => x.slug !== "patch-pronte").map((x) => x.nome);
    c("`vociCura`: con tutte le categorie con prodotti, le cinque del documento nel loro ordine (senza «Patch pronte»), nome e indirizzo", [nomiCura, SLUG.slice(1).map((s) => `/shop/c/${s}`)], [H.vociCura(TUTTE).map((v) => v.nome), H.vociCura(TUTTE).map((v) => v.href)]);
    c("…e sono cinque (Shampoo e balsami, Districanti, Colle e remover, Spazzole, Kit)", 5, H.vociCura(TUTTE).length);
    c("`vociCura`: una categoria senza prodotti (`quanti` 0) non c'è", ["shampoo-e-balsami", "colle-e-remover", "spazzole", "kit"], H.vociCura([cat("shampoo-e-balsami", 2), cat("districanti", 0), cat("colle-e-remover", 1), cat("spazzole", 9), cat("kit", 1)]).map((v) => v.href.slice("/shop/c/".length)));
    c("`vociCura`: l'ordine è quello del documento, non quello in cui arrivano", ["shampoo-e-balsami", "districanti", "kit"], H.vociCura([cat("kit", 1), cat("districanti", 1), cat("shampoo-e-balsami", 1)]).map((v) => v.href.slice("/shop/c/".length)));
    c("`vociCura`: nessuna categoria con prodotti, elenco vuoto, mancante o null → nessuna voce", [[], [], [], []], [H.vociCura([]), H.vociCura(undefined), H.vociCura(null), H.vociCura(TUTTE.map((x) => ({ ...x, quanti: 0 })))]);
    c("`vociCura`: «Patch pronte» non è mai una voce di Cura; una categoria che il documento non conosce nemmeno", [], H.vociCura([cat("patch-pronte", 4), cat("toupee", 4), cat("sconosciuta", 4)]));
    c("`vociCura`: `quanti` negativo, decimale, testo o NaN non fa entrare la categoria", [], H.vociCura([cat("kit", -1), cat("districanti", Number.NaN), cat("spazzole", "5"), cat("colle-e-remover", undefined)]));
    c("`vociCura`: voci sporche (null, senza slug) non rompono", ["/shop/c/kit"], H.vociCura([null, {}, 5, cat("kit", 1)]).map((v) => v.href));
    c("`numerinoCarrello`: niente con 0 (o dato sbagliato), il numero fino a 99, «99+» oltre", ["", "", "", "1", "99", "99+", "99+"], [0, -3, Number.NaN, 1, 99, 100, 1000].map((n) => H.numerinoCarrello(n)));

    // ═══ 2 · l'header sul telefono e sul computer ═══
    const base = await header({}, { carrello: { count: 0 } });
    const h = base.html;
    const tagHeader = tag(h, "<header");
    const cl = classi(tagHeader);
    c("header: `sticky top-0 z-30`, bordo basso `white/10`, fondo `#081634` al 95 %", [true, true, true, true, true, true], ["sticky", "top-0", "z-30", "border-b", "border-white/10", "bg-[#081634]/95"].map((x) => cl.includes(x)));
    c("header: nessuna sfocatura dello sfondo, né nel disegno né nel sorgente (V1-H3)", [false, false, false], [/backdrop-/.test(h), /backdrop-/.test(srcHeader), /backdrop-/.test(srcMenu)]);
    c("header: nessun fondo diverso dal notte (niente gradienti, niente `bg-brand`, niente ombre) ", [], ["gradient", "bg-brand", "shadow-"].filter((x) => tagHeader.includes(x)));
    const riga = tag(h, 'class="mx-auto');
    c("contenitore `mx-auto max-w-7xl`, margini 16 px (320), 24 px (da 360) e 40 px (computer), alto 56 px (telefono) e 72 (computer)", [true, true, true, true, true, true, true], ["mx-auto", "max-w-7xl", "px-4", "min-[360px]:px-6", "lg:px-10", "h-14", "lg:h-[72px]"].map((x) => classi(riga).includes(x)));

    // «Vai al contenuto»
    const salto = tag(h, `>${GUSCIO.vaiAlContenuto}<`);
    c("«Vai al contenuto»: è un link all'id del contenuto, nascosto finché non ha il fuoco, e viene PRIMA dell'header", [`#${H.ID_CONTENUTO}`, true, true, true], [attr(salto, "href"), classi(salto).includes("sr-only"), classi(salto).includes("focus:not-sr-only"), h.indexOf(`>${GUSCIO.vaiAlContenuto}<`) < h.indexOf("<header")]);
    c("«Vai al contenuto»: quando compare sta sopra l'header e ha un fuoco visibile", [true, true], [classi(salto).some((x) => /^focus:z-\d+$|^focus:z-\[\d+\]$/.test(x) && Number(x.replace(/\D/g, "")) > 30), /shop-anello/.test(salto)]);
    c("l'id del contenuto è `contenuto` (lo scrive `GuscioShop` sul `main`); «Patch pronte» porta alla categoria delle patch", ["contenuto", "/shop/c/patch-pronte"], [H.ID_CONTENUTO, H.HREF_PATCH]);

    // marchio
    const logo = tag(h, `alt="${GUSCIO.logoAlt}"`);
    const linkLogo = tag(h, 'href="/shop"');
    c("logo: l'immagine ha la descrizione del marchio, è alta 24 px (36 sul computer) e non si trascina", [true, true, true], [classi(logo).includes("h-6"), classi(logo).includes("lg:h-9"), attr(logo, "draggable") === "false"]);
    c("logo: è un link a `/shop` con i bordi a mirino (`brackets`, `br-tr`, `br-bl`) e il fuoco bianco", [true, 2, true], [classi(linkLogo).includes("brackets"), conta(h, 'class="br-tr"') + conta(h, 'class="br-bl"'), /shop-anello-scuro/.test(linkLogo)]);

    // i tre tasti da 44 px (sul telefono): ricerca, carrello, menu
    const conRicerca = await header({ ricerca: "<RICERCA>" }, { carrello: { count: 0 } });
    c("il posto della ricerca è prima del carrello e del menu (ricerca, carrello, menu)", true, conRicerca.html.indexOf("&lt;RICERCA&gt;") > 0 && conRicerca.html.indexOf("&lt;RICERCA&gt;") < conRicerca.html.indexOf('href="/shop/carrello"') && conRicerca.html.indexOf('href="/shop/carrello"') < conRicerca.html.indexOf(`aria-label="${GUSCIO.apriMenu}"`));
    const tagCarrello = tag(h, 'href="/shop/carrello"');
    const tagMenu = tag(h, `aria-label="${GUSCIO.apriMenu}"`);
    c("carrello e menu: 44 × 44 px sul telefono (`h-11 w-11`), con il fuoco bianco", [true, true, true, true], [classi(tagCarrello).includes("h-11"), classi(tagCarrello).includes("w-11"), classi(tagMenu).includes("h-11") && classi(tagMenu).includes("w-11"), /shop-anello-scuro/.test(tagCarrello) && /shop-anello-scuro/.test(tagMenu)]);
    c("tasto menu: sparisce sul computer, è un bottone che apre un dialogo, chiuso di partenza", ["lg:hidden", "button", "dialog", "false", true], [classi(tagMenu).find((x) => x === "lg:hidden"), tagMenu.match(/^<(\w+)/)?.[1], attr(tagMenu, "aria-haspopup"), attr(tagMenu, "aria-expanded"), attr(tagMenu, "type") === "button"]);
    c("tasto menu: l'etichetta è quella di `testi-shop` (nessun testo scritto nel componente)", GUSCIO.apriMenu, attr(tagMenu, "aria-label"));

    // il numerino
    const con3 = (await header({}, { carrello: { count: 3 } })).html;
    const con120 = (await header({}, { carrello: { count: 120 } })).html;
    const pallino = tag(con3, ">3</span>");
    c("numerino con 0 prodotti: nessun pallino (e nessun «0»)", [false, false], [/\brounded-full\b/.test(h), h.includes(">0</span>")]);
    c("numerino con 3: pallino BIANCO con testo NOTTE, almeno 20 px, 12 px grassetto — mai il blu del marchio", [true, true, true, true, true, true, false], ["bg-white", "text-[#081634]", "h-5", "min-w-5", "text-xs", "font-bold"].map((x) => classi(pallino).includes(x)).concat(/bg-brand|text-white/.test(classi(pallino).join(" "))));
    c("numerino: tondo, e per chi usa lo schermo parlato è nascosto (lo dice la riga che annuncia)", [true, "true"], [classi(pallino).includes("rounded-full"), attr(pallino, "aria-hidden")]);
    c("numerino con più di 99: «99+»", ">99+</span>", con120.match(/>99\+<\/span>/)?.[0]);
    const aria3 = T.header.carrelloAria.replace("{n}", "3");
    const live = tag(con3, 'aria-live="polite"');
    c("`aria-live=\"polite\"`: c'è sempre (anche a carrello vuoto, vuota), e con 3 prodotti annuncia la frase di `testi-shop`", ["", aria3], [testoDopo(h, 'aria-live="polite"', "</span>"), testoDopo(con3, 'aria-live="polite"', "</span>")]);
    c("riga che annuncia: fuori schermo per chi vede (`sr-only`), `role=\"status\"`, e un'unica riga in tutto l'header", [true, "status", 1], [classi(live).includes("sr-only"), attr(live, "role"), conta(con3, "aria-live")]);
    c("il link del carrello ha il nome «Carrello, {n} prodotti» (da `testi-shop`) e porta a `/shop/carrello`", [aria3, "/shop/carrello", T.header.carrelloAria.replace("{n}", "0")], [attr(tag(con3, 'href="/shop/carrello"'), "aria-label"), attr(tag(con3, 'href="/shop/carrello"'), "href"), attr(tagCarrello, "aria-label")]);

    // le voci sul computer
    const nav = tag(h, "<nav");
    c("voci sul computer: dentro un `nav` con nome, nascosto sul telefono (compare da `lg`)", [true, true, true], [attr(nav, "aria-label") === H.TESTI_HEADER_PROVVISORI.navPrincipale, classi(nav).includes("hidden"), classi(nav).includes("lg:flex")]);
    const tagPatch = tag(h, `>${T.header.patch}<`);
    c("«Patch pronte»: link alla categoria delle patch, alto 44 px", ["/shop/c/patch-pronte", true], [attr(tagPatch, "href"), classi(tagPatch).includes("min-h-11")]);
    const attivo = (await header({}, { carrello: { count: 0 }, pathname: "/shop/c/patch-pronte" })).html;
    c("la pagina in cui si è: «Patch pronte» ha `aria-current=\"page\"` sulla sua pagina, e in nessun'altra", ["page", undefined, undefined], [attr(tag(attivo, `>${T.header.patch}<`), "aria-current"), attr(tag(h, `>${T.header.patch}<`), "aria-current"), attr(tag((await header({}, { pathname: "/shop/c/kit" })).html, `>${T.header.patch}<`), "aria-current")]);

    // «Cura»
    const tagCura = tag(h, 'aria-controls="cura-voci"');
    const elencoCura = tag(h, 'id="cura-voci"');
    c("«Cura»: è un bottone con la tendina `aria-expanded=\"false\"` di partenza, l'elenco c'è ma è nascosto (`hidden`)", ["button", "false", "cura-voci", true], [tagCura.match(/^<(\w+)/)?.[1], attr(tagCura, "aria-expanded"), attr(tagCura, "aria-controls"), /\shidden(=""|\s|>)/.test(elencoCura)]);
    c("«Cura»: il testo viene da `testi-shop`, l'area è alta 44 px", [T.header.cura, true], [testoDopo(h, 'aria-controls="cura-voci"', "</button>").trim(), classi(tagCura).includes("min-h-11")]);
    c("«Cura» con tutte le categorie: 5 voci, e i loro nomi sono quelli del documento", [nomiCura, 5], [vociDi(h, "cura-voci"), conta(h, 'href="/shop/c/') - 1]);
    const parziale = (await header({ categorie: [cat("patch-pronte", 2), cat("districanti", 1), cat("kit", 0), cat("spazzole", 5)] })).html;
    c("«Cura» con alcune categorie vuote: ci sono solo quelle che hanno prodotti (Districanti e Spazzole)", ["Districanti", "Spazzole"], vociDi(parziale, "cura-voci"));
    const senzaCura = (await header({ categorie: [cat("patch-pronte", 2)] })).html;
    c("senza nessuna categoria di cura con prodotti: niente «Cura» (né bottone né elenco), e «Patch pronte» resta", [false, false, true], [senzaCura.includes("cura-voci"), senzaCura.includes(`>${T.header.cura}<`), senzaCura.includes(`>${T.header.patch}<`)]);
    const senzaDati = (await header({ categorie: undefined })).html;
    c("senza l'elenco delle categorie (guasto del server): l'header si disegna lo stesso, senza «Cura»", [true, false], [senzaDati.includes("<header"), senzaDati.includes("cura-voci")]);

    // «Consulenza gratuita» (D84)
    const tagCons = tag(h, `>${T.header.consulenza}<`);
    const cc = classi(tagCons);
    c("«Consulenza gratuita»: una voce di testo con sottolineatura (bottone senza fondo né bordo), non un link a un'altra pagina", ["button", true, true, [], undefined], [tagCons.match(/^<(\w+)/)?.[1], cc.includes("underline"), cc.includes("underline-offset-4"), cc.filter((x) => /^(bg-|border(-|$)|rounded)/.test(x) && !x.startsWith("hover:")), attr(tagCons, "href")]);
    c("«Consulenza gratuita»: alta 44 px, con il fuoco bianco, `aria-haspopup=\"dialog\"` (apre il foglio)", [true, true, "dialog"], [cc.includes("min-h-11"), /shop-anello-scuro/.test(tagCons), attr(tagCons, "aria-haspopup")]);
    c("«Consulenza gratuita»: il testo viene da `testi-shop`, e c'è una sola voce (la tendina e il menu non la ripetono sul computer)", 1, conta(h, `>${T.header.consulenza}<`));
    base.pagina.tracce = [];
    gestore(base.pagina, "button", T.header.consulenza)();
    c("clic su «Consulenza gratuita»: si conta `ClickConsulenza` con il punto di partenza «header» (nessun altro dato)", [["ClickConsulenza", { punto: "header" }]], base.pagina.tracce);
    c("…e apre il flusso che esiste (`PannelloProblemi`, in ritardo) con un punto d'ingresso che esiste già e la provenienza «stock»", [true, true, true, true], [/lazy\(\(\) => import\("@\/components\/landing\/consulenza\/PannelloProblemi"\)\)/.test(srcHeader), /punto="pannello"/.test(srcHeader), /provenienza="stock"/.test(srcHeader), !/^import .*PannelloProblemi/m.test(srcHeader)]);

    // ═══ 3 · il menu del telefono ═══
    c("il menu si carica in ritardo: `lazy(import(\"./MenuTelefono\"))`, nessuna importazione fissa di Radix né del menu nell'header", [true, false, false], [/lazy\(\(\) => import\("\.\/MenuTelefono"\)\)/.test(srcHeader), /from "@radix-ui\/react-dialog"/.test(srcHeader), /^import .* from "\.\/MenuTelefono"/m.test(srcHeader)]);
    c("la prima volta si disegna solo il bottone: il foglio non c'è finché nessuno lo tocca", false, h.includes('data-radix="Content"'));
    c("il menu non si carica sul computer: il bottone sta in `lg:hidden` e il foglio parte solo al primo tocco (`menuMontato`)", true, /menuMontato/.test(srcHeader) && /useState\(false\)/.test(srcHeader));

    const m1 = await menu();
    const mh = m1.html;
    const rootProps = m1.pagina.radix.find((x) => x.nome === "Root").props;
    c("foglio: è un Radix Dialog, aperto quando glielo dice l'header e con il suo `onOpenChange`", [true, "function"], [rootProps.open, typeof rootProps.onOpenChange]);
    const contenuto = tag(mh, 'data-radix="Content"');
    const sfondo = tag(mh, 'data-radix="Overlay"');
    c("foglio: a tutto schermo, sopra l'header e il banner dei cookie, sotto i pannelli della consulenza (z 55 contro 60), fondo `bg-blueprint`", [true, true, true], [["fixed", "inset-0"].every((x) => classi(contenuto).includes(x)), classi(contenuto).includes("z-[55]") && classi(sfondo).includes("z-[55]"), classi(contenuto).includes("bg-blueprint")]);
    c("foglio: entra con le classi di D100 (`shop-foglio`, sfondo `shop-dissolvi`), nessuna animazione inventata, nessuna ombra", [true, true, false, false], [classi(contenuto).includes("shop-foglio"), classi(sfondo).includes("shop-dissolvi"), /animate-|slide-in|fade-in/.test(mh), /shadow-/.test(mh)]);
    c("foglio: ha un titolo (per chi usa lo schermo parlato) e nessuna descrizione (`aria-describedby` tolto: niente avviso di Radix)", [H.TESTI_HEADER_PROVVISORI.titoloMenu, true, true], [testoDopo(mh, 'data-radix="Title"', "</h2>"), classi(tag(mh, 'data-radix="Title"')).includes("sr-only"), m1.pagina.radix.find((x) => x.nome === "Content").props["aria-describedby"] === undefined && !m1.pagina.radix.some((x) => x.nome === "Description")]);
    const tagX = tag(mh, `aria-label="${GUSCIO.chiudiMenu}"`);
    c("foglio: la X di chiusura è da 44 px, con il fuoco bianco e il nome di `testi-shop`", [true, true, true], [classi(tagX).includes("h-11") && classi(tagX).includes("w-11"), /shop-anello-scuro/.test(tagX), tagX.includes("data-radix=\"Close\"")]);
    // le righe
    c("righe del menu: alte 56 px (`min-h-14`), larghe quanto il foglio, Patch pronte e Consulenza gratuita incluse", [true, true], [["Patch pronte", "Consulenza gratuita"].every((x) => classi(tag(mh, `>${x}<`)).includes("min-h-14") || classi(tag(mh, `>${x}`)).includes("min-h-14")), classi(tag(mh, 'href="/shop/c/patch-pronte"')).includes("w-full") || classi(tag(mh, 'href="/shop/c/patch-pronte"')).includes("flex")]);
    c("menu: Patch pronte, Cura, Consulenza gratuita — in questo ordine — e nient'altro (Assistenza e Domande non hanno ancora una pagina)", [true, false, false], [mh.indexOf(T.header.patch) < mh.indexOf(`>${T.header.cura}`) && mh.indexOf(`>${T.header.cura}`) < mh.lastIndexOf(T.header.consulenza), /Assistenza|Domande/.test(mh), /<a[^>]*href="\/(preventivo|privacy|termini)/.test(mh)]);
    const curaMenu = tag(mh, `aria-controls="menu-cura-voci"`);
    c("«Cura» nel menu: bottone `aria-expanded=\"false\"`, alto 56 px; si apre con le 5 voci (nascoste finché chiuso)", ["button", "false", true, 5, true], [curaMenu.match(/^<(\w+)/)?.[1], attr(curaMenu, "aria-expanded"), classi(curaMenu).includes("min-h-14"), conta(mh, 'href="/shop/c/') - 1, /\shidden(=""|\s|>)/.test(tag(mh, 'id="menu-cura-voci"'))]);
    c("«Cura» nel menu: le voci hanno la riga alta 56 px", true, [...mh.matchAll(/<a href="\/shop\/c\/(?!patch-pronte)[^"]*"[^>]*>/g)].every((m) => classi(m[0]).includes("min-h-14")));
    const menuParziale = (await menu({ voci: H.vociCura([cat("districanti", 1), cat("kit", 0)]) })).html;
    c("«Cura» nel menu con una sola categoria piena: una voce", 1, conta(menuParziale, 'href="/shop/c/') - 1);
    const menuSenzaCura = (await menu({ voci: [] })).html;
    c("«Cura» nel menu senza categorie: la riga non c'è", [false, true], [menuSenzaCura.includes("menu-cura-voci"), menuSenzaCura.includes(T.header.patch) && menuSenzaCura.includes(T.header.consulenza)]);
    const tagConsMenu = tag(mh, `>${T.header.consulenza}<`);
    c("«Consulenza gratuita» nel menu: voce di testo con sottolineatura (stessa dell'header), mai un bottone pieno", ["button", true, []], [tagConsMenu.match(/^<(\w+)/)?.[1], classi(tagConsMenu).includes("underline"), classi(tagConsMenu).filter((x) => /^(bg-|border(-|$)|rounded)/.test(x) && !x.startsWith("hover:"))]);
    c("in fondo al menu: il logo e «Hair Genius Labs · Roma» (da `testi-shop`)", [true, true], [mh.includes(`alt="${GUSCIO.logoAlt}"`), mh.includes(T.footer.riga)]);
    // i gesti
    const chiamate = [];
    const m2 = await menu({ onNavigazione: () => chiamate.push("navigazione"), onConsulenza: () => chiamate.push("consulenza"), onApertoChange: (a) => chiamate.push(["aperto", a]) });
    gestore(m2.pagina, "a", "Patch pronte")();
    gestore(m2.pagina, "button", T.header.consulenza)();
    c("un tocco su una voce del menu chiama `onNavigazione`; «Consulenza gratuita» chiama `onConsulenza` (e non chiude il foglio)", ["navigazione", "consulenza"], chiamate);
    let n = 0;
    const evento = { preventDefault: () => n++ };
    const m3 = await menu({ onRendiFuoco: () => chiamate.push("fuoco") });
    m3.pagina.radix.find((x) => x.nome === "Content").props.onCloseAutoFocus(evento);
    c("chiusura del foglio: il fuoco lo restituisce l'header (Radix non lo manda a caso: `preventDefault` + `onRendiFuoco`)", [1, "fuoco"], [n, chiamate.at(-1)]);
    const m4 = await menu({ aperto: false });
    c("foglio chiuso: Radix non disegna niente (`open` falso)", ["", false], [m4.html, m4.pagina.radix.find((x) => x.nome === "Root").props.open]);

    // ═══ 4 · il fuoco restituito, con il riduttore `foglio` di T105 ═══
    c("l'header usa `foglio` e `FOGLIO_CHIUSO` di `vetrina-interazioni` e `voceEvidenziata` per le frecce della tendina", [true, true, true], [/\bfoglio\b/.test(srcHeader) && /FOGLIO_CHIUSO/.test(srcHeader) && /@\/shop\/cms\/vetrina-interazioni/.test(srcHeader), /voceEvidenziata/.test(srcHeader), H.ID_TASTO_MENU === "tasto-menu"]);
    const aperto = I.foglio(I.FOGLIO_CHIUSO, { tipo: "apri", da: H.ID_TASTO_MENU });
    const chiuso = I.foglio(aperto, { tipo: "chiudi" });
    c("(il contratto da cui parte l'header) aprendo dal tasto del menu e chiudendo, il fuoco torna a quel tasto", [true, H.ID_TASTO_MENU, false], [aperto.aperto, chiuso.fuocoA, chiuso.aperto]);
    c("il tasto del menu porta l'id che il riduttore restituisce (`data-fuoco`), così il fuoco ritrova il bottone", H.ID_TASTO_MENU, attr(tagMenu, "data-fuoco"));
    c("il sorgente restituisce il fuoco una volta sola, da gestore (non da un effetto che ripartirebbe a ogni disegno)", [true, false], [/rendiFuoco/.test(srcHeader), /useEffect\([^)]*fuocoA/.test(srcHeader)]);

    // ═══ 5 · testi, parole vietate, bundle ═══
    const tutto = [h, con3, mh, menuParziale, parziale].join("\n");
    c("nessuna parola vietata, nessun prezzo, nessun indirizzo dello studio nel disegno", [], D.trovaParoleVietate(tutto));
    c("nessuna parola vietata nei due sorgenti (le doppie graffe del JSX, `params={{…}}`, non sono segnaposto)", [], D.trovaParoleVietate((srcHeader + srcMenu).replaceAll("={{", "=").replaceAll("}}", "}")));
    const letterali = [T.header.patch, T.header.cura, T.header.consulenza, T.header.carrello, T.header.carrelloAria, GUSCIO.vaiAlContenuto, GUSCIO.apriMenu, GUSCIO.chiudiMenu, GUSCIO.logoAlt, T.footer.riga];
    const codice = (srcHeader + srcMenu).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    c("i testi vengono tutti da `testi-shop.ts`: nessuno è scritto uguale, fra virgolette o nel JSX, nei due sorgenti (commenti esclusi)", [], letterali.filter((t) => new RegExp(`["'\`>{]\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*["'\`<}]`).test(codice)));
    c("i testi locali (nome della navigazione, titolo del foglio) sono costanti provvisorie dichiarate, senza parole vietate", [2, []], [Object.keys(H.TESTI_HEADER_PROVVISORI).length, D.trovaParoleVietate(JSON.stringify(H.TESTI_HEADER_PROVVISORI))]);
    c("nessun tracciamento diretto (`fbq`, `ttq`, `gtag`) e nessun colore del marchio dove non deve (`bg-brand` nel pallino)", [false, false], [/\b(fbq|ttq|gtag)\b/.test(srcHeader + srcMenu), /bg-brand/.test(srcHeader + srcMenu)]);
    c("ogni controllo ha il suo anello di fuoco (`shop-anello-scuro`); `outline-none` solo sul foglio stesso (che prende il fuoco da programma, non da tastiera)", [true, false, false], [conta(h, "shop-anello-scuro") >= 4, /outline-none/.test(h), /outline-none/.test(mh.replace(contenuto, ""))]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    delete globalThis.__t82a;
  }
}
