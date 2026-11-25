/** ── VETRINA V1 · T83 · PIÈ DI PAGINA, ERRORI, STATI VUOTI, SCHELETRI E OFFLINE ────────────────────────
 *  `FooterShop`, `PagineErrore` (404 e 500), `BannerOffline` in `src/components/shop/guscio/`, e `StatoVuoto`, `StatoErrore`,
 *  `Scheletro` in `src/components/shop/`. Disegnati davvero (esbuild + react-dom/server, come `foto-shop.mjs`), dati inventati,
 *  nessuna rete. Criteri: V1-H4 (ogni link del piè di pagina porta a una pagina che esiste: l'elenco è CHIUSO), V1-T15 (404, 500, vuoti;
 *  scheletri e offline per la sola logica: i timer veri e `setOffline` sono di T103c), V1-T6 (parole vietate), V1-T7 (nessun indirizzo),
 *  V1-T3 (un solo pieno, rosso mai), V1-T16 (nessun testo scritto a mano nei componenti).
 *  ⚠️ Il finto `notFound` di `_rende.mjs` ignora gli argomenti: il 404 della radice non si può provare dal router. Qui si prova ciò che
 *  dipende da T83: la pagina si disegna da SOLA, con un router in cui ogni lettura di dati (`useParams`, `useLoaderData`, `useRouteContext`…)
 *  LANCIA, perché nel punto in cui la radice la mostra quei dati non ci sono. */
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gestore, rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);

const COMP = "src/components/shop";
const FILE = {
  footer: `${COMP}/guscio/FooterShop.tsx`,
  errori: `${COMP}/guscio/PagineErrore.tsx`,
  offline: `${COMP}/guscio/BannerOffline.tsx`,
  vuoto: `${COMP}/StatoVuoto.tsx`,
  errore: `${COMP}/StatoErrore.tsx`,
  scheletro: `${COMP}/Scheletro.tsx`,
};

/** Impacchetta un modulo del progetto (con esbuild) e ne restituisce le esportazioni: per le funzioni pure dei componenti e per i testi. */
function carica(radice, file) {
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "prova-footer-stati-"));
  try {
    const r = esbuild.buildSync({
      entryPoints: [join(radice, file)], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
      loader: { ".png": "dataurl" }, alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
    });
    const f = join(dir, "modulo.cjs");
    writeFileSync(f, r.outputFiles[0].text);
    return requireQui(f);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Il testo che si legge in una pagina: senza marcatori, con le entità di `react-dom/server` rimesse a posto, spazi ridotti. */
const testo = (html) =>
  html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const hrefs = (html) => [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => m[1]);
const conta = (html, re) => (html.match(re) ?? []).length;
/** I tag `<a …>` interi (per guardare le classi di ogni link). */
const tagA = (html) => html.match(/<a\b[^>]*>/g) ?? [];

/** Un router in cui si può solo fare un link: ogni lettura di dati LANCIA. Così si prova che la pagina non ne ha bisogno. */
const ROUTER_SENZA_DATI = `
  import React from "react";
  const veleno = (nome) => () => { throw new Error(nome + ": la pagina non deve leggere dati del router"); };
  export const Link = ({ to, params, search, hash, children, className, activeProps, inactiveProps, activeOptions, preload, replace, resetScroll, viewTransition, ...resto }) =>
    React.createElement("a", { ...resto, href: String(to), className }, children);
  export const useParams = veleno("useParams");
  export const useLoaderData = veleno("useLoaderData");
  export const useRouteContext = veleno("useRouteContext");
  export const useSearch = veleno("useSearch");
  export const useRouterState = veleno("useRouterState");
  export const useMatch = veleno("useMatch");
  export const useRouter = veleno("useRouter");
  export const useNavigate = veleno("useNavigate");
  export const useLocation = veleno("useLocation");
`;
const SENZA_DATI = { finti: { "@tanstack/react-router": ROUTER_SENZA_DATI } };

/** Le rotte che esistono davvero, come espressioni sull'indirizzo (`shop.c.$slug.tsx` → `/shop/c/<uno>`). Letto dalle cartelle, non scritto a mano. */
function rotteEsistenti(radice) {
  const nomi = readdirSync(join(radice, "src/routes")).filter((f) => /\.tsx?$/.test(f) && !f.startsWith("__")).map((f) => f.replace(/\.tsx?$/, ""));
  return nomi.map((n) => {
    const parti = n.split(".").filter((p) => p !== "index" && p !== "");
    const corpo = parti.map((p) => (p.startsWith("$") ? "[^/]+" : p.replace(/[[\]]/g, "").replace(/[-/\\^$*+?.()|{}]/g, "\\$&"))).join("/");
    return new RegExp(`^/${corpo}$`);
  });
}

// ── regole su tutto ciò che questo compito disegna (V1-T6, V1-T7, V1-T3, V1-T16) ──
const PAROLE_VIETATE = [/toupee/i, /indistinguibil/i, /invisibile/i, /garantit/i, /premium/i, /\bRemy\b/, /Best seller/i, /Top rated/i, /Risparmi/i, /Bio-Mimetic/i, /1\.500/, /214 recensioni/i, /4,8\/5/, /\bultimi\b/i, /da confermare/i, /\{\{/];
const INDIRIZZO = [/Scipioni/i, /\bcivico\b/i, /\bvia\s+[A-Z][a-z]+/, /\bviale\b/i, /\bpiazza\b/i, /\b00\d{3}\b/];
/** Per ogni file: ciò che non deve comparire nel sorgente (carattere, rosso, sfondo sfocato, grigi dei segnaposto, bianco troppo spento). */
const VIETATO_NEL_CODICE = [
  [/Anton|Instrument/, "carattere di oggi"], [/font-family/, "font-family"], [/backdrop-/, "backdrop-"], [/#FF3B3B|bg-destructive|text-destructive|border-destructive/i, "rosso del brand"],
  [/PlaceholderBox|MediaSlot/, "segnaposto"], [/localStorage|sessionStorage/, "memoria del browser"], [/text-white\/(?:[0-5]\d|[0-9])\b/, "testo bianco sotto il 60 %"],
  [/bg-(?:gray|zinc|slate|neutral|stone)-/, "grigio di Tailwind"],
];
/** Il solo logo del piè di pagina è un'immagine: negli altri file, nessuna immagine (V1-T4: nessuna illustrazione). */
const IMMAGINE = [/<(?:img|picture|video)\b/, "immagine nei componenti di stato"];

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T83 · PIÈ DI PAGINA, ERRORI, STATI (23/11/2026)");
  const sorgente = Object.fromEntries(Object.entries(FILE).map(([k, f]) => [k, (() => { try { return readFileSync(join(radice, f), "utf8"); } catch { return null; } })()]));
  c("i sei file di T83 esistono", [], Object.entries(FILE).filter(([k]) => sorgente[k] === null).map(([, f]) => f));
  if (Object.values(sorgente).some((s) => s === null)) return;

  const T = carica(radice, "src/landing/testi-shop.ts");
  const { TESTI_SHOP, TESTI_PROVVISORI, riempi } = T;
  const INT = carica(radice, "src/shop/cms/vetrina-interazioni.ts");
  const HREF = carica(radice, "src/shop/cms/vetrina-carrello.ts");
  const rotte = rotteEsistenti(radice);
  const esiste = (href) => rotte.some((r) => r.test(href.split("#")[0].split("?")[0]));
  const slugCategorie = TESTI_SHOP.categorie.map((x) => x.slug);

  // ═════════════ PIÈ DI PAGINA ═════════════
  //  T100a: «Cura» c'è solo se la sua categoria ha prodotti: il piè di pagina riceve le categorie dal guscio (come l'header)
  const SLUG_CURA = HREF.HREF_CURA.replace("/shop/c/", "");
  const CON_PRODOTTI = [{ slug: slugCategorie[0], quanti: 2 }, { slug: SLUG_CURA, quanti: 3 }];
  const f = await rendiComponente(radice, FILE.footer, "FooterShop", { anno: 2031, categorie: CON_PRODOTTI });
  const F = f.html;
  const TF = testo(F);
  c("piè di pagina: un solo <footer>, fondo `bg-footer`, testo `white/75`", [1, true, true], [conta(F, /<footer\b/g), /class="[^"]*\bbg-footer\b/.test(F), /\btext-white\/75\b/.test(F)]);
  c("piè di pagina: il logo ha alt, width e height (V1-T4)", [true], [/<img\b(?=[^>]*\salt="[^"]+")(?=[^>]*\swidth="\d+")(?=[^>]*\sheight="\d+")[^>]*>/.test(F)]);
  c("piè di pagina: «Hair Genius Labs · Roma», ragione sociale e P.IVA (le parole del documento)", [true, true], [TF.includes("Hair Genius Labs · Roma"), TF.includes("HAIR GENIUS LABS SRLS · P.IVA 18486531009")]);
  c("piè di pagina: NESSUN indirizzo dello studio (V1-T7)", [], INDIRIZZO.filter((re) => re.test(TF)).map(String));
  c("piè di pagina: l'anno viene dalla proprietà e il segnaposto è riempito", [true, false], [TF.includes("© 2031 Hair Genius Labs. Tutti i diritti riservati."), TF.includes("{anno}")]);

  // V1-H4: l'elenco dei link è chiuso, e ognuno porta a una rotta che esiste
  const LINK_ATTESI = [HREF.HREF_PATCH_PRONTE, HREF.HREF_CURA, "/termini-e-condizioni", "/privacy-policy", "/cookie-policy"];
  c("piè di pagina: i link sono ESATTAMENTE questi cinque (elenco chiuso, V1-H4)", [...LINK_ATTESI].sort(), hrefs(F).sort());
  const hCura = async (categorie) => hrefs((await rendiComponente(radice, FILE.footer, "FooterShop", { anno: 2031, categorie })).html).includes(HREF.HREF_CURA);
  c("piè di pagina: «Cura» compare solo se la sua categoria ha prodotti (con prodotti sì; senza proprietà, `null`, elenco vuoto, `quanti` 0, categoria assente o elenco rotto no)", [true, false, false, false, false, false, false], [
    await hCura(CON_PRODOTTI), await hCura(undefined), await hCura(null), await hCura([]), await hCura([{ slug: SLUG_CURA, quanti: 0 }]), await hCura([{ slug: slugCategorie[0], quanti: 4 }]), await hCura("rotto"),
  ]);
  const senzaCura = hrefs((await rendiComponente(radice, FILE.footer, "FooterShop", { anno: 2031 })).html).sort();
  c("piè di pagina: senza prodotti restano gli altri quattro link («Patch pronte» e i tre legali), nessun link rotto", [...LINK_ATTESI.filter((h) => h !== HREF.HREF_CURA)].sort(), senzaCura);
  c("piè di pagina: ogni link porta a una rotta che esiste nel progetto", [], hrefs(F).filter((h) => !esiste(h)));
  c("piè di pagina: i due link di categoria hanno uno slug del documento (§3.4)", [true, true], [HREF.HREF_PATCH_PRONTE, HREF.HREF_CURA].map((h) => slugCategorie.includes(h.replace("/shop/c/", ""))));
  c("piè di pagina: le rotte legali sono quelle vere di Termini, Privacy e Cookie", [true, true, true], ["termini-e-condizioni", "privacy-policy", "cookie-policy"].map((n) => readFileSync(join(radice, `src/routes/${n}.tsx`), "utf8").includes(`createFileRoute("/${n}")`)));
  c("piè di pagina: «Aiuto» non si monta in V1 (nessuna colonna, nessun link di assistenza o domande)", [false, []], [/\bAiuto\b/i.test(TF), hrefs(F).filter((h) => /aiuto|assistenza|faq|spedizion|garanzia|contatt/i.test(h))]);
  c("piè di pagina: due colonne con il loro titolo, e ogni <nav> è nominato da un titolo che c'è", [2, true, true], (() => {
    const navs = [...F.matchAll(/<nav\b[^>]*\saria-labelledby="([^"]+)"/g)].map((m) => m[1]);
    return [navs.length, navs.every((id) => F.includes(`id="${id}"`)), [TESTI_SHOP.footer.colonnaShop, TESTI_SHOP.footer.colonnaLegale].every((t) => TF.includes(t))];
  })());
  c("piè di pagina: i link legali e le due voci dello shop hanno il nome del documento", [true, true, true, true, true], [TESTI_SHOP.header.patch, TESTI_SHOP.header.cura, TESTI_SHOP.footer.termini, TESTI_SHOP.footer.privacy, TESTI_SHOP.footer.cookie].map((t) => TF.includes(t)));
  c("piè di pagina: il comando che riapre i cookie c'è (`GestisciCookie`, quello che esiste)", [1], [conta(F, /\sdata-gestisci-cookie\b/g)]);
  c("piè di pagina: ogni link ha l'area da 44 px (`min-h-11`)", [], tagA(F).filter((a) => !/\bmin-h-11\b/.test(a)));
  c("piè di pagina: senza `consulenza` la voce «Consulenza gratuita» non c'è (non è una pagina)", [false], [TF.includes(TESTI_SHOP.header.consulenza)]);
  const fc = await rendiComponente(radice, FILE.footer, "FooterShop", { anno: 2031, categorie: CON_PRODOTTI, consulenza: () => { fc.chiamato = true; } });
  c("piè di pagina: con `consulenza` la voce è un bottone (non un link) e lo scatto chiama chi l'ha data", [true, hrefs(fc.html).length, true], (() => {
    const bottone = gestore(fc.pagina, "button", TESTI_SHOP.header.consulenza);
    bottone();
    return [testo(fc.html).includes(TESTI_SHOP.header.consulenza), hrefs(fc.html).length, fc.chiamato === true];
  })());
  c("piè di pagina: il bottone della consulenza non aggiunge link", [LINK_ATTESI.length], [hrefs(fc.html).length]);

  // ═════════════ 404 e 500 ═════════════
  const p404 = await rendiComponente(radice, FILE.errori, "PaginaNonTrovata", {}, SENZA_DATI);
  const H4 = p404.html, T4 = testo(H4);
  c("404: si disegna da sola, anche se ogni lettura di dati del router lancia (la radice non ne ha)", true, T4.length > 0);
  c("404: un solo h1, e dice il titolo e il testo del documento", [1, true, true], [conta(H4, /<h1\b/g), T4.includes(TESTI_SHOP.err404.titolo), T4.includes(TESTI_SHOP.err404.testo)]);
  c("404: «Patch pronte» pieno verso la categoria, «Cura» come link verso la cura (un solo pieno)", [[HREF.HREF_PATCH_PRONTE, HREF.HREF_CURA], 1, 0], (() => {
    const a = tagA(H4);
    return [hrefs(H4), conta(H4, /data-aspetto="pieno"/g), a.filter((x) => !/\bmin-h-1[12]\b/.test(x)).length];
  })());
  c("404: i nomi dei due bottoni sono quelli del documento", [true, true], [TESTI_SHOP.err404.bottone, TESTI_SHOP.err404.link].map((t) => T4.includes(t)));
  c("404: nessuna illustrazione (nessuna img, picture, video; l'icona è nascosta ai lettori di schermo)", [0, 0, true], [conta(H4, /<(?:img|picture|video)\b/g), conta(H4, /<svg\b(?![^>]*aria-hidden="true")/g), /<svg\b[^>]*aria-hidden="true"/.test(H4)]);
  c("404: card centrata (`max-w-xl`) su `bg-light-panel`", [true, true], [/\bmax-w-xl\b/.test(H4), /\bbg-light-panel\b/.test(H4)]);
  c("404: nessun rosso, nessuna parola vietata, nessun indirizzo", [[], []], [[...PAROLE_VIETATE, ...INDIRIZZO].filter((re) => re.test(T4)).map(String), [/destructive/, /FF3B3B/i, /\bred-\d/].filter((re) => re.test(H4)).map(String)]);

  const e500 = await rendiComponente(radice, FILE.errori, "PaginaErrore", {}, SENZA_DATI);
  const H5 = e500.html, T5 = testo(H5);
  c("500: un solo h1, titolo e testo del documento, nessun contatto senza testo confermato", [1, true, true], [conta(H5, /<h1\b/g), T5.includes(TESTI_SHOP.err500.titolo), T5.includes(TESTI_SHOP.err500.testo)]);
  c("500: senza `riprova` non c'è il bottone «Riprova»; «Patch pronte» è l'unico pieno", [0, 1], [conta(H5, /<button\b/g), conta(H5, /data-aspetto="pieno"/g)]);
  c("500 senza contatto: nessun paragrafo oltre al testo (nessuna riga vuota, nessun «scrivici» inventato)", [1, false], [conta(H5, /<p\b/g), /scrivici/i.test(T5)]);
  const CONTATTO = "Prova: scrivi a assistenza@esempio.test";
  const con = await rendiComponente(radice, FILE.errori, "PaginaErrore", { confermati: { assistenza: CONTATTO } }, SENZA_DATI);
  c("500: con `assistenza` confermata il contatto si legge, com'è scritto", [true, 2], [testo(con.html).includes(CONTATTO), conta(con.html, /<p\b/g)]);
  const NON_CONFERMATI = [
    ["vuoto", { assistenza: "" }], ["solo spazi", { assistenza: "   " }], ["segnaposto aperto", { assistenza: "scrivici: {{contatto}}" }],
    ["null", { assistenza: null }], ["altra chiave (reso)", { reso: CONTATTO }], ["non è un testo", { assistenza: 5 }], ["chiave sconosciuta", { contatto: CONTATTO }], ["assente", {}],
  ];
  for (const [nome, confermati] of NON_CONFERMATI) {
    const r = await rendiComponente(radice, FILE.errori, "PaginaErrore", { confermati }, SENZA_DATI);
    c(`500: contatto NON mostrato se ${nome}`, [1, false], [conta(r.html, /<p\b/g), /\{\{|CONTATTO|esempio\.test/.test(testo(r.html))]);
  }
  const nulla = await rendiComponente(radice, FILE.errori, "PaginaErrore", { confermati: null }, SENZA_DATI);
  c("500: `confermati` nullo non rompe la pagina", true, testo(nulla.html).includes(TESTI_SHOP.err500.titolo));
  let riprovato = 0;
  const rip = await rendiComponente(radice, FILE.errori, "PaginaErrore", { riprova: () => { riprovato++; } }, SENZA_DATI);
  gestore(rip.pagina, "button", TESTI_PROVVISORI.errore.riprova)();
  c("500: con `riprova` c'è «Riprova», chiama chi l'ha data; resta UN solo pieno", [true, 1, 1], [testo(rip.html).includes(TESTI_PROVVISORI.errore.riprova), riprovato, conta(rip.html, /data-aspetto="pieno"/g)]);
  c("500: nessuna illustrazione, nessun rosso, nessuna parola vietata, nessun indirizzo", [0, [], []], [conta(H5, /<(?:img|picture|video)\b/g), [...PAROLE_VIETATE, ...INDIRIZZO].filter((re) => re.test(T5)).map(String), [/destructive/, /FF3B3B/i, /\bred-\d/].filter((re) => re.test(H5)).map(String)]);
  c("500: l'errore vero non si mostra mai (la pagina non accetta né legge `error`)", false, /\berror\b/.test(sorgente.errori.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));

  // ═════════════ STATO VUOTO ═════════════
  const AZ = [
    { testo: "Primo", href: "/shop/c/patch-pronte", aspetto: "pieno" },
    { testo: "Secondo", href: "/shop", aspetto: "contorno" },
    { testo: "Terzo", href: "/shop/carrello", aspetto: "link" },
  ];
  const v = await rendiComponente(radice, FILE.vuoto, "StatoVuoto", { titolo: "Titolo di prova", testo: "Riga di prova.", azioni: AZ });
  const HV = v.html;
  c("stato vuoto: titolo come h2 (di norma) e riga di testo", [1, 0, true, true], [conta(HV, /<h2\b/g), conta(HV, /<h1\b/g), testo(HV).includes("Titolo di prova"), testo(HV).includes("Riga di prova.")]);
  c("stato vuoto: i tre ingressi, nell'ordine dato, ognuno col suo aspetto e un solo pieno", [["/shop/c/patch-pronte", "/shop", "/shop/carrello"], ["pieno", "contorno", "link"]], [hrefs(HV), [...HV.matchAll(/data-aspetto="(\w+)"/g)].map((m) => m[1])]);
  c("stato vuoto: centrato, `max-w-md`, icona in tondo nascosta ai lettori di schermo, nessuna illustrazione", [true, true, 0], [/\bmax-w-md\b/.test(HV), /<svg\b[^>]*aria-hidden="true"/.test(HV), conta(HV, /<(?:img|picture|video)\b/g)]);
  c("stato vuoto: bersagli da 44 px (`min-h-11` o `min-h-12`) su ogni link", [], tagA(HV).filter((a) => !/\bmin-h-1[12]\b/.test(a)));
  const v1 = await rendiComponente(radice, FILE.vuoto, "StatoVuoto", { titolo: "Pagina", livello: "h1" });
  c("stato vuoto: `livello=\"h1\"` fa un h1; senza testo né ingressi nessun paragrafo e nessun link", [1, 0, 0, 0], [conta(v1.html, /<h1\b/g), conta(v1.html, /<h2\b/g), conta(v1.html, /<p\b/g), hrefs(v1.html).length]);
  const vTesto = await rendiComponente(radice, FILE.vuoto, "StatoVuoto", { titolo: "Pagina", testo: null });
  c("stato vuoto: testo `null` = la riga non si disegna", 0, conta(vTesto.html, /<p\b/g));
  let scattato = 0;
  const vb = await rendiComponente(radice, FILE.vuoto, "StatoVuoto", { titolo: "Filtri", azioni: [{ testo: "Azzera", onClick: () => { scattato++; }, aspetto: "pieno" }] });
  gestore(vb.pagina, "button", "Azzera")();
  c("stato vuoto: un ingresso senza `href` è un bottone che chiama la funzione (es. «Azzera filtri»)", [1, 0, 1], [conta(vb.html, /<button\b[^>]*\stype="button"/g), hrefs(vb.html).length, scattato]);

  // ═════════════ STATO DI ERRORE ═════════════
  let riprovo = 0;
  const se = await rendiComponente(radice, FILE.errore, "StatoErrore", { titolo: "Errore di prova", testo: "Non si è caricato.", riprova: () => { riprovo++; }, azioni: [{ testo: "Torna", href: "/shop", aspetto: "contorno" }] });
  gestore(se.pagina, "button", TESTI_PROVVISORI.errore.riprova)();
  c("stato di errore: «Riprova» (pieno) chiama chi l'ha data, senza ricaricare; l'altro ingresso è un contorno", [1, ["pieno", "contorno"], true], [riprovo, [...se.html.matchAll(/data-aspetto="(\w+)"/g)].map((m) => m[1]), testo(se.html).includes(TESTI_PROVVISORI.errore.riprova)]);
  const se2 = await rendiComponente(radice, FILE.errore, "StatoErrore", { titolo: "Errore", testo: "Testo." });
  c("stato di errore: senza `riprova` nessun bottone «Riprova»", [false, 0], [testo(se2.html).includes(TESTI_PROVVISORI.errore.riprova), conta(se2.html, /<button\b/g)]);
  c("stato di errore: icona di avviso su tondo notte, nascosta ai lettori; nessun rosso, nessuna illustrazione", [true, [], 0], [/<svg\b[^>]*aria-hidden="true"/.test(se.html) && /bg-\[#0A1430\]/.test(se.html), [/destructive/, /FF3B3B/i, /\bred-\d/, /rosso/i].filter((re) => re.test(se.html)).map(String), conta(se.html, /<(?:img|picture|video)\b/g)]);

  // ═════════════ SCHELETRI (la logica: i timer veri sono di T103c) ═════════════
  const S = carica(radice, FILE.scheletro);
  const vecchia = await rendiComponente(radice, FILE.scheletro, "Scheletro", { inAttesa: true, quanti: 3, children: "VISTA-VECCHIA" });
  c("scheletro: all'inizio dell'attesa (prima dei 300 ms) si tiene la vista vecchia, nessuno scheletro", [true, 0], [vecchia.html.includes("VISTA-VECCHIA"), conta(vecchia.html, /shop-scheletro/g)]);
  const ferma = await rendiComponente(radice, FILE.scheletro, "Scheletro", { inAttesa: false, quanti: 3, children: "VISTA-VERA" });
  c("scheletro: senza attesa si vede la vista vera", [true, 0], [ferma.html.includes("VISTA-VERA"), conta(ferma.html, /shop-scheletro/g)]);
  const g = await rendiComponente(radice, FILE.scheletro, "GrigliaScheletri", { quanti: 5 });
  const HG = g.html;
  c("scheletro: tante carte quante chieste, ognuna con foto 1:1, due righe, prezzo e bottone da 44 px", [5, 5, 10, 5, 5], [conta(HG, /data-scheletro-card\b/g), conta(HG, /\baspect-square\b/g), conta(HG, /data-scheletro-riga\b/g), conta(HG, /data-scheletro-prezzo\b/g), conta(HG, /\bh-11\b/g)]);
  c("scheletro: azzurro tenue che respira (`shop-scheletro`, `shop-respiro`), mai grigio, nascosto ai lettori", [true, true, 0, true], [/\bshop-scheletro\b/.test(HG), /\bshop-respiro\b/.test(HG), conta(HG, /bg-(?:gray|zinc|slate|neutral|stone|muted)|animate-pulse/g), /aria-hidden="true"/.test(HG)]);
  c("scheletro: un annuncio per chi non vede, in una regione `status` («Un attimo…»), e `aria-busy`", [true, true, true], [/role="status"/.test(HG), testo(HG).includes(TESTI_SHOP.microtesti.attesaPagina), /aria-busy="true"/.test(HG)]);
  // il timer può scattare 1 ms prima del confronto con l'orologio: allo scatto lo STATO si porta a un istante che basta (revisione di T105)
  const inizio = 1_000_000;
  const scatti = [inizio - 50, inizio, inizio + 1, inizio + 299, inizio + INT.RITARDO_SCHELETRO_MS, inizio + INT.RITARDO_SCHELETRO_MS + 1, inizio + 9000];
  c("scheletro: all'istante del timer lo scheletro è SEMPRE mostrato, anche se il timer scatta in anticipo di 1 ms", scatti.map(() => true), scatti.map((adesso) => INT.mostraScheletro(inizio, S.istanteDelTimer(inizio, adesso))));
  c("scheletro: l'istante del timer non va mai prima del ritardo e non ritarda un orologio già avanti", [inizio + 300, inizio + 300, inizio + 5000], [S.istanteDelTimer(inizio, inizio + 299), S.istanteDelTimer(inizio, inizio), S.istanteDelTimer(inizio, inizio + 5000)]);
  c("scheletro: il ritardo e la regola vengono da `vetrina-interazioni` (nessun 300 scritto a mano)", [true, true, false], [/\bmostraScheletro\b/.test(sorgente.scheletro) && /vetrina-interazioni/.test(sorgente.scheletro), /\bRITARDO_SCHELETRO_MS\b/.test(sorgente.scheletro), /\b300\b/.test(sorgente.scheletro.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))]);
  c("scheletro: allo scatto del timer il componente cambia uno stato (`setTimeout` che chiama un `set…`) e lo cancella allo smontaggio", [true, true], [/setTimeout\(\s*\(\)\s*=>\s*set\w+\(/.test(sorgente.scheletro), /clearTimeout\(/.test(sorgente.scheletro)]);

  // ═════════════ OFFLINE (la logica: `setOffline` vero è di T103c) ═════════════
  const rete = (online) => rendiComponente(radice, FILE.offline, "StrisciaRete", { online });
  const off = await rete(false);
  c("offline: con la rete assente la striscia dice il testo del documento (§3.13), in una regione `status`", [true, true], [testo(off.html).includes(TESTI_SHOP.microtesti.connessionePersa), /role="status"/.test(off.html)]);
  const risposte = [];
  for (const o of [true, null, undefined]) risposte.push(testo((await rete(o)).html));
  c("offline: con la rete presente o sconosciuta (server, `null`) la striscia non c'è, ma la regione `status` sì (si annuncia solo ciò che compare)", [["", "", ""], true], [risposte, /role="status"/.test((await rete(true)).html)]);
  const banner = await rendiComponente(radice, FILE.offline, "BannerOffline", {});
  c("offline: `BannerOffline` sul server disegna la regione vuota (si parte da «online»)", [true, ""], [/role="status"/.test(banner.html), testo(banner.html)]);
  c("offline: ascolta `online` e `offline` e smette allo smontaggio; usa `statoRete`", [true, true, true, true, true], [/addEventListener\(\s*"online"/.test(sorgente.offline), /addEventListener\(\s*"offline"/.test(sorgente.offline), /removeEventListener\(\s*"online"/.test(sorgente.offline) && /removeEventListener\(\s*"offline"/.test(sorgente.offline), /\bnavigator\.onLine\b/.test(sorgente.offline), /\bstatoRete\b/.test(sorgente.offline) && /vetrina-interazioni/.test(sorgente.offline)]);
  c("offline: la striscia non è rossa né grigia (V1-T3)", [], [/destructive/, /FF3B3B/i, /\bred-\d/, /bg-(?:gray|zinc|slate|neutral|stone)-/].filter((re) => re.test(off.html)).map(String));

  // ═════════════ REGOLE SU TUTTI I FILE DI T83 ═════════════
  const tutti = { ...Object.fromEntries(Object.entries(sorgente).map(([k, s]) => [FILE[k], s])) };
  for (const [file, s] of Object.entries(tutti)) {
    const senzaCommenti = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    c(`${file.split("/").pop()}: nessun carattere, rosso, sfondo sfocato o grigio vietato nel codice`, [], [...VIETATO_NEL_CODICE, ...(file === FILE.footer ? [] : [IMMAGINE])].filter(([re]) => re.test(senzaCommenti)).map(([, n]) => n));
    c(`${file.split("/").pop()}: nessuna parola vietata né indirizzo nel codice (V1-T6, V1-T7)`, [], [...PAROLE_VIETATE, ...INDIRIZZO].filter((re) => re.test(senzaCommenti)).map(String));
  }
  // V1-T16: nessun testo scritto a mano nei componenti (albero di TypeScript: testi nei figli e negli attributi che si leggono)
  const ts = requireQui("typescript");
  const conLettere = (x) => /\p{L}/u.test(x);
  const ATTRIBUTI_LETTI = new Set(["aria-label", "aria-description", "placeholder", "alt", "title"]);
  const scritti = (file, s) => {
    const albero = ts.createSourceFile(file, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const trovati = [];
    const visita = (n) => {
      if (ts.isJsxText(n) && conLettere(n.text)) trovati.push(n.text.trim());
      if (ts.isJsxAttribute(n) && ATTRIBUTI_LETTI.has(n.name.getText()) && n.initializer && ts.isStringLiteral(n.initializer) && conLettere(n.initializer.text)) trovati.push(n.initializer.text);
      if (ts.isJsxExpression(n) && n.expression && (ts.isStringLiteral(n.expression) || ts.isNoSubstitutionTemplateLiteral(n.expression)) && conLettere(n.expression.text) && !ts.isJsxAttribute(n.parent)) trovati.push(n.expression.text);
      ts.forEachChild(n, visita);
    };
    visita(albero);
    return trovati;
  };
  for (const [file, s] of Object.entries(tutti)) c(`${file.split("/").pop()}: nessun testo scritto a mano (V1-T16: tutto da testi-shop)`, [], scritti(file, s));
  c("la prova che cerca i testi scritti a mano riconosce quelli veri (finto con testo nel figlio, in un attributo e in una espressione)", 3, scritti("x.tsx", 'export const A = () => <div aria-label="Ciao"><p>Ciao mondo</p>{"Altro testo"}</div>;').length);
}
