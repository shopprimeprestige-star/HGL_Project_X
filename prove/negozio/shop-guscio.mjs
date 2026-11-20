/** ── SHOP R1 · T18 · IL GUSCIO DELLO SHOP: MODALITÀ, BARRA, PIÈ DI PAGINA ───────────
 *  `src/routes/shop.tsx` (unico proprietario) e `src/shop/cms/guscio.ts`.
 *  Tre livelli, senza browser:
 *   1. il SORGENTE (la modalità si legge una volta, con ripiego su `codice`; il link dei cookie c'è; niente carattere
 *      nuovo, niente indirizzo della sede, niente lettura del database dal browser);
 *   2. il MARKUP, disegnato con `react-dom/server` dalla rotta VERA (aiuto `_pagine.mjs`):
 *      con `codice` testata e piè di pagina sono IDENTICI a oggi (D29) salvo il link «Gestisci cookie»;
 *      con `cms` la frase «Spedizione gratuita sopra €59» non c'è (la cifra non è più vera) e il link c'è lo stesso;
 *   3. il nome della protesi per la barra con il catalogo CMS (`nomeProtesiPerBarra`).
 *  I due blocchi «identici a oggi» sono stati ricavati dal codice di PRIMA di T18 (commit e28471d). */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { impacchettaPagina, impostaPagina, testoVisibile } from "./_pagine.mjs";
import { mediaProva, prodottoProva, uuid, varianteProva } from "./dati.mjs";

/** La testata di oggi (le immagini incorporate sono sostituite da DATA). */
const TESTATA_DI_OGGI =
  '<header class="sticky top-0 z-30 border-b border-white/10 bg-[#081634]/85 backdrop-blur"><div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3"><a href="/shop" class="flex items-center gap-2"><img src="DATA" alt="Hair Genius" class="h-8 w-8 rounded-md object-contain"/><span class="text-sm font-semibold tracking-tight text-white">Hair Genius <span class="text-brand">Shop</span></span></a><nav class="hidden items-center gap-6 md:flex"><a href="/shop" class="text-sm transition text-white">Catalogo</a><a href="/preventivo" class="text-sm text-white/60 transition hover:text-white">Preventivo su misura</a><a href="/" class="text-sm text-white/60 transition hover:text-white">Analisi gratuita</a></nav><div class="flex items-center gap-2">';
/** Il piè di pagina di oggi: `@ANNO@` è l'anno corrente. */
const PIEDE_DI_OGGI =
  '<footer class="bg-footer border-t border-white/10"><div class="mx-auto max-w-6xl px-4 py-10"><div class="flex flex-col items-center gap-3 text-center"><img src="DATA" alt="Hair Genius" class="h-9 w-9 rounded-md object-contain"/><p class="text-sm text-white/60">Hair Genius Labs · Protesi e cura di grado premium</p><div class="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/45"><a href="/privacy-policy" class="hover:text-white/80">Privacy</a><a href="/termini-e-condizioni" class="hover:text-white/80">Termini</a><a href="/cookie-policy" class="hover:text-white/80">Cookie</a><a href="/shop" class="hover:text-white/80">Catalogo</a></div><p class="mt-2 text-[11px] text-white/30">© @ANNO@ Hair Genius Labs SRLS · Spedizione gratuita sopra €59</p></div></div></footer>';

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T18 · IL GUSCIO DELLO SHOP: MODALITÀ, BARRA, PIÈ DI PAGINA (20/11/2026)");
  const leggi = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : "");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const guscio = leggi("src/routes/shop.tsx");
  const nudo = senzaCommenti(guscio);

  /* ───────────────── 1 · IL SORGENTE ───────────────── */
  c("la modalità si legge UNA volta sola, con `modalitaCatalogo()`, importata dalle funzioni del server", [1, true], [(nudo.match(/modalitaCatalogo\(/g) ?? []).length, /from "@\/shop\/cms\/catalogo\.functions"/.test(nudo)]);
  c("la modalità si legge in `beforeLoad`: i compiti figli la ricevono nel contesto (`modalita`) e non la rileggono", true, /beforeLoad\s*:\s*async[\s\S]{0,300}modalitaCatalogo\(/.test(nudo));
  c("se la lettura fallisce lo shop resta com'è: `catch` che dà «codice»", true, /catch[\s\S]{0,80}["']codice["']/.test(nudo));
  c("il piè di pagina monta `<GestisciCookie />` (una volta), importato dal provider del consenso", [1, true], [(nudo.match(/<GestisciCookie/g) ?? []).length, /from "@\/components\/tracciamento\/GestisciCookie"/.test(nudo)]);
  c("nessun cambio di carattere né di aspetto (D29): niente Inter, niente `carattere`, niente `font-family`", false, /\bInter\b|lib\/carattere|font-family/.test(nudo));
  c("nessun indirizzo dello studio nel guscio", false, /Scipioni|\bVia degli\b/i.test(guscio));
  c("il browser non legge il database: niente `catalogo.server`, niente `supabase`, niente tabelle `shop_`", false, /catalogo\.server|supabase|\bshop_[a-z_]+/.test(nudo));
  c("la barra, con il catalogo CMS, ricava la protesi dall'adattatore (`nomeProtesiPerBarra`) e dalla scheda del server", [true, true], [/nomeProtesiPerBarra/.test(nudo), /schedaProdotto\(/.test(nudo)]);
  c("la barra riceve il nome della scheda del server (`nomeCms`) solo con il catalogo CMS, e quello di `getProduct` solo con il codice", [true, true], [/<BarraConsulenza[^>]*prodotto=\{modalita === "cms" \? nomeCms :/.test(nudo), /modalita !== "cms" && slugLetto \? getProduct\(slugLetto\)/.test(nudo)]);
  c("la scheda del server si chiede solo con il catalogo CMS e un indirizzo di scheda, e si butta se la pagina cambia (`vivo`)", [true, true], [/modalita !== "cms" \|\| !slugLetto\) return/.test(nudo), /let vivo = true[\s\S]*vivo = false/.test(nudo)]);

  /* ───────────────── 2 · IL MARKUP ───────────────── */
  let M = null;
  try {
    M = await impacchettaPagina(
      radice,
      `import { renderToStaticMarkup } from "react-dom/server";
       import { createElement } from "react";
       export { Route } from "@/routes/shop";
       export const disegna = (C) => renderToStaticMarkup(createElement(C));`,
      "shop-guscio",
    );
  } catch (e) {
    console.log("   (shop.tsx non si impacchetta:", String(e?.message ?? e).split("\n")[0], ")");
  }
  c("la rotta `/shop` si impacchetta e ha un componente", true, typeof M?.Route?.options?.component === "function");
  if (typeof M?.Route?.options?.component === "function") {
    const vista = (modalita, pathname = "/shop", searchStr = "") => {
      impostaPagina({ pathname, searchStr, context: { modalita } });
      return M.disegna(M.Route.options.component).replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, "DATA");
    };
    const piede = (h) => h.match(/<footer[\s\S]*<\/footer>/)?.[0] ?? "";
    const anno = String(new Date().getFullYear());
    const oggi = PIEDE_DI_OGGI.replace("@ANNO@", anno);
    const BOTTONE = /<button[^>]*>Gestisci cookie<\/button>/;

    const co = vista("codice");
    c("codice: la testata è IDENTICA a oggi", true, co.includes(TESTATA_DI_OGGI));
    c("codice: il link «Gestisci cookie» c'è, una volta, ed è un bottone che non invia niente", [1, true], [(piede(co).match(/Gestisci cookie/g) ?? []).length, /<button type="button"[^>]*>Gestisci cookie<\/button>/.test(piede(co))]);
    c("codice: tolto quel link, il piè di pagina è IDENTICO a oggi (stessi link, stessa frase sulla spedizione)", oggi, piede(co).replace(BOTTONE, ""));
    c("codice: il link sta dopo «Cookie» e prima di «Catalogo»", true, (() => { const p = piede(co); return p.indexOf(">Cookie<") < p.indexOf("Gestisci cookie") && p.indexOf("Gestisci cookie") < p.indexOf(">Catalogo<"); })());
    c("codice: «Spedizione gratuita sopra €59» resta com'è oggi", true, testoVisibile(piede(co)).includes("Spedizione gratuita sopra €59"));
    c("il link «Gestisci cookie» ha un'area da toccare di almeno 24 px (-my-1.5 py-1.5 sul testo da 16 px) senza allungare la riga, e ha il cursore giusto", [true, true], (() => { const b = piede(co).match(/<button[^>]*>/)?.[0] ?? ""; return [/py-1\.5/.test(b) && /-my-1\.5/.test(b), /cursor-pointer/.test(b)]; })());

    const cms = vista("cms");
    c("cms: la testata è la stessa", true, cms.includes(TESTATA_DI_OGGI));
    c("cms: nel piè di pagina niente «59», niente «Spedizione gratuita» (la cifra non è più vera)", [false, false], [/59/.test(testoVisibile(piede(cms))), /Spedizione gratuita/i.test(testoVisibile(piede(cms)))]);
    c("cms: il piè di pagina ha ancora Privacy, Termini, Cookie, Catalogo, il link «Gestisci cookie» e la ragione sociale", [true, true, true, true, true, true],
      ["Privacy", "Termini", "Cookie", "Catalogo", "Gestisci cookie", `© ${anno} Hair Genius Labs SRLS`].map((t) => testoVisibile(piede(cms)).includes(t)));
    //  D38: con `cms` la frase non dice «premium» e i link passano da white/45 a white/60 (contrasto); il resto è quello di oggi
    const oggiCms = oggi.replace(" · Spedizione gratuita sopra €59", "").replace("Protesi e cura di grado premium", "Patch e prodotti per la cura").replace("text-xs text-white/45", "text-xs text-white/60");
    c("cms: il resto del piè di pagina è quello di oggi, tolta la frase sulla spedizione, con la frase nuova (D38) e i link a white/60", oggiCms, piede(cms).replace(BOTTONE, ""));
    c("cms: «Gestisci cookie» eredita il colore white/60 dei link vicini (nessun colore suo più scuro)", [true, false], [/text-white\/60/.test(piede(cms).match(/<div class="flex flex-wrap[^"]*"/)?.[0] ?? ""), /text-white\/(30|40|45|50)/.test(piede(cms).match(/<button[^>]*>/)?.[0] ?? "")]);
    c("cms: nel piè di pagina niente «premium», «indistinguibil…», «Remy»", false, /premium|indistinguibil|Remy/i.test(testoVisibile(piede(cms))));
    c("codice: il piè di pagina dice ancora «grado premium» (non cambia niente)", true, /grado premium/.test(testoVisibile(piede(co))));
    c("cms e codice: nessun indirizzo dello studio nel piè di pagina né nella testata", false, /Scipioni|Via degli|\bVia\b/.test(testoVisibile(piede(cms) + piede(co) + cms)));
    const cmsRotto = vista(undefined);
    c("un contesto senza modalità (lettura fallita) disegna lo shop di sempre: la frase sulla spedizione c'è", true, testoVisibile(piede(cmsRotto)).includes("Spedizione gratuita sopra €59"));

    /* il link dei cookie dove il banner non può comparire non c'è */
    c("sulle pagine non ammesse (ordine, anteprima, link del cliente) il link «Gestisci cookie» non c'è: un bottone che non fa niente è peggio di nessuno", [false, false, false, false],
      [["/shop/ordine/ab12", "?t=1"], ["/shop/prodotto/x", "?anteprima=abc"], ["/shop", "?watch=abc"], ["/shop", "?modifica"]].map(([p, q]) => /Gestisci cookie/.test(vista("cms", p, q))));
    c("sulle pagine dello shop ammesse il link c'è (elenco, categoria, scheda, carrello, cassa)", [true, true, true, true, true],
      ["/shop", "/shop/c/shampoo", "/shop/prodotto/patch-1", "/shop/carrello", "/shop/checkout"].map((p) => /Gestisci cookie/.test(vista("codice", p))));
  }

  /* ───────────────── 2b · LA DESCRIZIONE IN `head` ───────────────── */
  //  `head` gira dopo `beforeLoad`: la modalità la legge dal contesto del match (`match.context.modalita`).
  if (typeof M?.Route?.options?.head === "function") {
    const descr = (match) => M.Route.options.head({ match, matches: [], params: {} })?.meta?.find((m) => m.name === "description")?.content ?? "";
    const titolo = (match) => M.Route.options.head({ match })?.meta?.find((m) => m.title)?.title;
    const DESCRIZIONE_DI_OGGI = "Protesi lace e skin indistinguibili, shampoo, balsami, districanti, solventi e adesivi. Tutto per chi indossa un toupee.";
    c("head, codice: la descrizione è quella di oggi", DESCRIZIONE_DI_OGGI, descr({ context: { modalita: "codice" } }));
    c("head, contesto assente o rotto (lettura fallita): quella di oggi, mai un errore", [DESCRIZIONE_DI_OGGI, DESCRIZIONE_DI_OGGI], [descr({}), descr(undefined)]);
    const dCms = descr({ context: { modalita: "cms" } });
    c("head, cms: descrizione neutra, senza «premium», «indistinguibil…», «Remy», e non vuota", [true, false], [dCms.length > 20, /premium|indistinguibil|Remy/i.test(dCms)]);
    c("head, cms: dice quello che dice D38 («Patch e prodotti per la cura»)", true, /Patch e prodotti per la cura/.test(dCms));
    c("head: il titolo della pagina è lo stesso con i due cataloghi (D38 non lo cambia)", true, titolo({ context: { modalita: "cms" } }) === titolo({ context: { modalita: "codice" } }));
  } else c("la rotta `/shop` ha `head`", "function", typeof M?.Route?.options?.head);

  /* ───────────────── 2c · LA MODALITÀ DURA TUTTA LA VISITA (nel browser) ───────────────── */
  //  Nel browser la modalità si tiene in una variabile del modulo: un guasto a metà visita non riporta lo shop su `codice`.
  //  Sul server si legge a ogni richiesta. Ogni scenario ha un modulo NUOVO (la variabile riparte da zero).
  const fresca = () => impacchettaPagina(
    radice,
    `import { renderToStaticMarkup } from "react-dom/server";
     import { createElement } from "react";
     export { Route } from "@/routes/shop";
     export const disegna = (C) => renderToStaticMarkup(createElement(C));`,
    "shop-guscio-visita",
  );
  const finestraFinta = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {}, removeEventListener() {} };
  const conFinestra = async (nel, f) => {
    const prima = Object.getOwnPropertyDescriptor(globalThis, "window");
    if (nel) globalThis.window = finestraFinta;
    try { return await f(); } finally { if (prima) Object.defineProperty(globalThis, "window", prima); else delete globalThis.window; }
  };
  /** Una sequenza di letture del server: ogni valore è «cms», «codice» o un errore (`"errore"`). */
  const sequenza = (...esiti) => { let i = 0; const n = { chiamate: 0 }; return { n, dai: () => { n.chiamate++; const e = esiti[Math.min(i++, esiti.length - 1)]; if (e === "errore") throw new Error("rete giù"); return e; } }; };
  const modalitaDi = async (V, ctx = {}) => (await V.Route.options.beforeLoad(ctx)).modalita;
  try {
    // browser: la prima lettura è «cms», poi la rete cade → resta «cms», e non si richiede nemmeno
    const A = await fresca();
    const sA = sequenza("cms", "errore");
    impostaPagina({ server: { modalita: sA.dai } });
    const lettureA = await conFinestra(true, async () => [await modalitaDi(A), await modalitaDi(A), await modalitaDi(A)]);
    c("browser: letta «cms» una volta, un guasto a metà visita NON riporta su «codice»", ["cms", "cms", "cms"], lettureA);
    c("browser: dopo la prima lettura la modalità non si richiede più al server", 1, sA.n.chiamate);

    // browser: la pagina è arrivata dal server (beforeLoad non rigira): il componente fissa la modalità del contesto
    const B = await fresca();
    const sB = sequenza("errore");
    impostaPagina({ pathname: "/shop", searchStr: "", context: { modalita: "cms" }, server: { modalita: sB.dai } });
    const lettureB = await conFinestra(true, async () => { B.disegna(B.Route.options.component); return [await modalitaDi(B)]; });
    c("browser: la pagina arrivata dal server con «cms»: il primo clic con la rete caduta resta su «cms»", ["cms"], lettureB);
    c("browser: …e non richiede la modalità al server", 0, sB.n.chiamate);

    // browser: primo guasto, nessuna modalità ancora → «codice», e resta tale per la visita (coerenza: il carrello non cambia catalogo)
    const C = await fresca();
    const sC = sequenza("errore", "cms");
    impostaPagina({ server: { modalita: sC.dai } });
    c("browser: se la prima lettura fallisce, «codice»; la visita resta coerente (niente salto a «cms» a metà)", ["codice", "codice"], await conFinestra(true, async () => [await modalitaDi(C), await modalitaDi(C)]));

    // server (niente `window`): ogni richiesta rilegge
    const D = await fresca();
    const sD = sequenza("cms", "errore", "codice", "cms");
    impostaPagina({ server: { modalita: sD.dai } });
    c("server: la modalità si legge a OGNI richiesta (un guasto → «codice» solo per quella richiesta)", ["cms", "codice", "codice", "cms"], await conFinestra(false, async () => [await modalitaDi(D), await modalitaDi(D), await modalitaDi(D), await modalitaDi(D)]));
    c("server: quattro richieste, quattro letture", 4, sD.n.chiamate);
  } catch (e) {
    c("la modalità dura tutta la visita: la prova non deve lanciare", "ok", String(e?.stack ?? e).split("\n").slice(0, 3).join(" | "));
  }

  /* ───────────────── 3 · LA PROTESI PER LA BARRA ───────────────── */
  const G = mod["shop/cms/guscio"];
  const PUB = mod["shop/cms/pubblico"];
  c("`guscio.ts` dà `nomeProtesiPerBarra`", "function", typeof G?.nomeProtesiPerBarra);
  if (G?.nomeProtesiPerBarra && PUB?.costruisciPubblico) {
    const righe = {
      prodotti: [
        prodottoProva({ id: uuid(0x700), sku: "PROVA-P", slug: "una-patch", nome: "Una patch di prova", tipo: "patch" }),
        prodottoProva({ id: uuid(0x701), sku: "PROVA-C", slug: "una-cura", nome: "Una cura di prova", tipo: "cura" }),
        prodottoProva({ id: uuid(0x702), sku: "PROVA-K", slug: "un-kit", nome: "Un kit di prova", tipo: "kit" }),
      ],
      varianti: [uuid(0x700), uuid(0x701), uuid(0x702)].map((id, i) => varianteProva({ id: uuid(0x800 + i), prodotto_id: id, sku: `PROVA-V${i}`, nome: "Unica", opzioni: {}, giacenza: 3 })),
      media: [uuid(0x700), uuid(0x701), uuid(0x702)].map((id, i) => mediaProva({ id: uuid(0x900 + i), prodotto_id: id, slot: "principale" })),
    };
    const [patch, cura, kit] = PUB.costruisciPubblico(righe, { baseMedia: "https://media.prova.test/shop" });
    c("la barra sa il nome della PROTESI guardata: una patch dà il suo nome", "Una patch di prova", G.nomeProtesiPerBarra(patch));
    c("…una cura o un kit no (come oggi, dove solo la categoria «toupee» dà il nome)", [undefined, undefined], [G.nomeProtesiPerBarra(cura), G.nomeProtesiPerBarra(kit)]);
    c("…nessun prodotto (non trovato, guasto, bozza senza chiave) → nessun nome, mai un errore", [undefined, undefined, undefined], [G.nomeProtesiPerBarra(null), G.nomeProtesiPerBarra(undefined), G.nomeProtesiPerBarra({})]);
  }
}
