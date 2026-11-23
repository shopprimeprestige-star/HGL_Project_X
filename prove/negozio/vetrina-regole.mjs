/** ── VETRINA V1 · T99a · LE REGOLE DI SORGENTE (PIANO-V1 §7.3, D102) ──────────────────────────────────────────────
 *  Stesso stile di `r2-regole.mjs`: il sorgente si legge con l'albero di TypeScript dove la forma conta (i commenti non sono mai «codice»: l'albero non li
 *  porta) e ogni regola mette in colonna le violazioni «file:riga». Atteso: lista vuota. È una prova ADDITIVA: non tocca altre prove né `src/`.
 *  Le regole sull'HTML reso (3, 4, 5b, 17) sono di T99b (`vetrina-regole-html.mjs`).
 *
 *  I FILE DI V1 (`BASE_V1 = 99d94d3`): ciò che è nuovo o modificato rispetto al base in `src/components/shop/**`, `src/shop/cms/vetrina-*.ts`,
 *  `src/shop/cms/contenuto-shop.functions.ts`, `src/landing/testi-shop.ts`, `src/routes/shop*.tsx`. Dei file MODIFICATI contano solo le righe nuove
 *  (diff col base); il codice di oggi spostato di peso in un'altra funzione si esclude con un elenco chiuso (`SPOSTATO_DI_OGGI`), e la regola 9 prova
 *  che è davvero identico al base.
 *   1  nessun `PlaceholderBox`, `btn-premium`, `backdrop-blur`, `sonner`/`toast`… nei file V1;     2  nessun `Anton`, `Instrument`, `font-family`, rosso;
 *   5  ogni `<FotoShop` e `<img` ha `alt`;      6  nessun testo scritto a mano nei componenti (JsxText e aria-label/placeholder/alt/title);
 *   7  nessun pixel/script di terzi, importazioni di tracciamento a elenco chiuso;      8  nessuno storage che legga un prezzo;
 *   9  le cinque rotte di oggi: corpo identico al base (smistatori);      10 consulenza: dove sta e dove no;      11 `package.json` come il base;
 *  12  nessuna chiave in `process.env`;      13 `styles.css`: blocco V1 sotto `[data-shop-v1]`, il resto uguale al base;
 *  15  link del footer = rotte che esistono;      16  testi modificabili con valore vero, `shop.conf.*` vuoti;      18  carattere/lingua = guscio per percorso.
 *  Regola 14 (nessun `routeTree.gen.ts` nei file dei compiti): è il controllo del capo all'unione, il sorgente non lo può sapere. NON è coperta qui.
 *  ⚠️ La ricerca delle parole proibite non guarda `prove/` (qui le parole stanno per forza). Dati: solo il sorgente, nessun database né rete.
 *  Lancio da solo: serve un lanciatore che costruisce `mod` come `prove.mjs` (la prova legge `mod` solo per moduli che sono in MODULI). */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const BASE_V1 = "99d94d3";
const requireQui = createRequire(import.meta.url);

/** Dove il sorgente V1 sta (§7.3). */
const DI_V1 = [
  (f) => /^src\/components\/shop\/.+\.tsx?$/.test(f),
  (f) => /^src\/shop\/cms\/vetrina-[^/]+\.ts$/.test(f),
  (f) => f === "src/shop/cms/contenuto-shop.functions.ts",
  (f) => f === "src/landing/testi-shop.ts",
  (f) => /^src\/routes\/shop(\.[^/]+)?\.tsx$/.test(f),
];
/** Codice di oggi spostato di peso dentro un file modificato: non è «nuovo». La regola 9 prova che è uguale al base. */
const SPOSTATO_DI_OGGI = { "src/routes/shop.tsx": ["GuscioDiOggi"] };
/** Le cinque rotte di oggi e come si riconosce il loro smistatore (regola 9). `sostituita`: la funzione del base che ora è uno smistatore;
 *  `rimasto`: l'elemento del suo corpo che deve ritrovarsi identico (dove: la funzione del file di adesso). `c.$slug`: la rotta esiste solo con `cms`, nessun corpo di oggi. */
const SMISTATORI = [
  { file: "src/routes/shop.tsx", sostituita: "ShopLayout", rimasto: { apertura: /bg-blueprint min-h-screen text-white/, dove: "GuscioDiOggi" } },
  { file: "src/routes/shop.index.tsx" },
  { file: "src/routes/shop.prodotto.$slug.tsx", sostituita: "ProductDetail", rimasto: { apertura: /^<SchedaVista\b/, dove: "ProductDetail" } },
  { file: "src/routes/shop.carrello.tsx" },
];
const KEYFRAMES_D100 = new Set(["shop-respiro", "shop-foglio", "shop-dissolvi", "shop-pop"]);
const ALLEGATI_PREZZO = new Set(["prezzo", "prezzi", "price", "prices", "cent", "cents", "centesimi", "importo", "totale", "subtotale", "amount"]);
const IMPORT_TRACCIA_AMMESSI = new Set(["emettiEvento", "emettiSoloContatore", "traccia", "GestisciCookie"]);

// ── aiuti sull'albero ────────────────────────────────────────────────────────────────────────────────────────────
const albero = (testo, nome) => ts.createSourceFile(nome, testo, ts.ScriptTarget.ES2022, true, nome.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const cammina = (nodo, f) => { f(nodo); ts.forEachChild(nodo, (n) => cammina(n, f)); };
const nodi = (sf, tipo) => { const r = []; cammina(sf, (n) => { if (tipo(n)) r.push(n); }); return r; };
const rigaDi = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
const riga = (sf, n) => rigaDi(sf, n.getStart(sf));
const norma = (t) => t.replace(/\s+/g, " ").trim();
const eStringa = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
const nomeTag = (n) => n.tagName.getText();
const attributi = (el) => (ts.isJsxElement(el) ? el.openingElement : el).attributes.properties;
const attributo = (el, nome) => attributi(el).find((a) => ts.isJsxAttribute(a) && a.name.getText() === nome);
const valoreStringa = (a) => {
  const i = a?.initializer;
  if (!i) return null;
  if (eStringa(i)) return i.text;
  if (ts.isJsxExpression(i) && i.expression && eStringa(i.expression)) return i.expression.text;
  return null;
};
const elementiJsx = (sf) => nodi(sf, (n) => ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n));
const parole = (id) => id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-zà-ú0-9]+/).filter(Boolean);

/** I «gettoni di codice»: nomi, stringhe, testo dei JSX. Mai i commenti (l'albero non li ha), perciò un commento che nomina una cosa vietata non è una violazione. */
function gettoni(sf) {
  const r = [];
  cammina(sf, (n) => {
    if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n) || eStringa(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      r.push({ t: ts.isIdentifier(n) || ts.isPrivateIdentifier(n) ? n.text : n.text, pos: n.getStart(sf), nodo: n });
    } else if (ts.isJsxText(n)) {
      const t = n.getText(sf);
      r.push({ t, pos: n.pos + (t.length - t.trimStart().length) + (n.getFullStart() - n.pos), nodo: n });
    }
  });
  return r;
}

// ── git ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const git = (radice, args) => spawnSync("git", ["-C", radice, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const camminaCartella = (radice, rel) => {
  const dir = join(radice, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = `${rel}/${n}`;
    return statSync(join(radice, p)).isDirectory() ? camminaCartella(radice, p) : [p];
  });
};

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP V1 · T99a · LE REGOLE DI SORGENTE DELLA VETRINA (23/11/2026)");
  const lavoro = mkdtempSync(join(tmpdir(), "t99a-"));
  try {
    await corpo(mod, { c, radice, lavoro });
  } catch (e) {
    // una prova che lancia ferma tutta la suite: l'eccezione diventa un rosso con un nome
    c("la prova delle regole di sorgente arriva in fondo senza eccezioni", "nessuna", `eccezione: ${String(e?.stack ?? e).split("\n").slice(0, 3).join(" | ")}`);
  } finally {
    rmSync(lavoro, { recursive: true, force: true });
  }
}

/** Una regola che si rompe da sola è un rosso con il suo nome, non uno stop dell'intera prova. */
async function regola(c, nome, fn) {
  try { await fn(); } catch (e) { c(`${nome}: la regola si è fermata`, "nessuna eccezione", String(e?.message ?? e)); }
}

async function corpo(mod, { c, radice, lavoro }) {
  const leggi = (rel) => readFileSync(join(radice, rel), "utf8");
  const SERVE_STORIA = "serve la storia git: rilancia da un clone intero";

  // ── la storia git: senza, le regole che confrontano col base sono rosse con la frase chiesta dal piano ──
  const storia = git(radice, ["cat-file", "-e", `${BASE_V1}^{commit}`]).status === 0;
  c("la storia git ha il commit di base di V1 (99d94d3)", storia ? "presente" : "presente", storia ? "presente" : SERVE_STORIA);
  const daBase = (rel) => {
    if (!storia) return null;
    const r = git(radice, ["show", `${BASE_V1}:${rel}`]);
    return r.status === 0 ? r.stdout : null;
  };

  // ── i file di V1, con le righe nuove di quelli modificati ──
  const candidati = camminaCartella(radice, "src").filter((f) => DI_V1.some((t) => t(f))).sort();
  const v1 = [];
  for (const rel of candidati) {
    const testo = leggi(rel);
    const base = daBase(rel);
    if (base === null) { v1.push({ rel, testo, nuove: null }); continue; } // nuovo (o storia assente: tutto vale come nuovo)
    if (base === testo) continue; // non toccato da V1
    const a = join(lavoro, "base.txt");
    writeFileSync(a, base);
    const d = spawnSync("git", ["diff", "--no-index", "-U0", "--no-color", a, join(radice, rel)], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout ?? "";
    const nuove = new Set();
    for (const m of d.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
      const da = Number(m[1]);
      const n = m[2] === undefined ? 1 : Number(m[2]);
      for (let i = 0; i < n; i++) nuove.add(da + i);
    }
    v1.push({ rel, testo, nuove });
  }
  for (const f of v1) {
    f.sf = albero(f.testo, f.rel);
    // i tratti di codice di oggi spostati di peso: righe escluse
    f.esclusi = [];
    for (const nome of SPOSTATO_DI_OGGI[f.rel] ?? []) {
      const d = f.sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === nome);
      if (d) f.esclusi.push([riga(f.sf, d), rigaDi(f.sf, d.getEnd())]);
    }
    f.gettoni = gettoni(f.sf);
  }
  /** Vale come «nuovo»: nei file nuovi sempre, nei modificati solo se la riga è fra quelle aggiunte e non nel codice di oggi spostato. */
  const nuovo = (f, r) => (f.nuove === null || f.nuove.has(r)) && !f.esclusi.some(([a, b]) => r >= a && r <= b);
  const v1tsx = v1.filter((f) => f.rel.endsWith(".tsx"));
  const gettoniNuovi = (f) => f.gettoni.filter((g) => nuovo(f, rigaDi(f.sf, g.pos)));
  /** Cerca un'espressione regolare nei gettoni di codice di ogni file V1 → «file:riga». */
  const cerca = (re, files = v1) => files.flatMap((f) => gettoniNuovi(f).filter((g) => re.test(g.t)).map((g) => `${f.rel}:${rigaDi(f.sf, g.pos)}`));

  c("i file di V1 sono quelli che ci si aspetta (la regola non gira a vuoto)", true, v1.length >= 50 && v1tsx.length >= 35 && v1.some((f) => f.rel === "src/components/shop/guscio/GuscioShop.tsx") && v1.some((f) => f.rel === "src/routes/shop.cerca.tsx") && v1.some((f) => f.rel === "src/landing/testi-shop.ts"));
  c("i file modificati contano solo per le righe nuove (diff col base calcolato)", true, v1.filter((f) => f.nuove !== null).length >= 4 && v1.filter((f) => f.nuove !== null).every((f) => f.nuove.size > 0));
  const spostatiTrovati = Object.keys(SPOSTATO_DI_OGGI).every((rel) => (v1.find((f) => f.rel === rel)?.esclusi.length ?? 0) === SPOSTATO_DI_OGGI[rel].length);
  c("l'elenco del codice di oggi spostato corrisponde a funzioni che esistono", true, spostatiTrovati);

  // ── 1 · niente di quanto V1 ha deciso di non usare ──
  await regola(c, "regola 1", () => {
    const NOMI = /\b(PlaceholderBox|HairSystemVisual|ProductVisual|ShopVisual)\b/;
    const CLASSI = /(?<![\w-])(btn-premium|cta-shine|shine-sweep|holo|ring-pulse|reveal-up)(?![\w-])/;
    c("1 · nessun PlaceholderBox, HairSystemVisual, ProductVisual, ShopVisual nei file V1", [], cerca(NOMI));
    c("1 · nessuna classe btn-premium, cta-shine, shine-sweep, holo, ring-pulse, reveal-up nei file V1", [], cerca(CLASSI));
    c("1 · nessun backdrop-blur né backdrop-filter nei file V1", [], cerca(/backdrop-(?:blur|filter)|backdropFilter/));
    c("1 · nessun sonner né toast nei file V1", [], cerca(/sonner|toast/i));
  });

  // ── 2 · carattere e rosso ──
  await regola(c, "regola 2", () => {
    c("2 · nessun Anton né Instrument nei file V1", [], cerca(/\bAnton\b|\bInstrument\b|font-anton|font-instrument/i));
    c("2 · nessun font-family nei file V1 (il carattere è dei CSS, non dei componenti)", [], cerca(/font-?family/i));
    c("2 · nessun #FF3B3B né destructive nei file V1 (V1 non usa il rosso)", [], cerca(/#FF3B3B|destructive/i));
  });

  // ── 5 · alt ──
  await regola(c, "regola 5", () => {
    // `<img {...img}>` ha l'alt solo se `img` viene da `attributiImg(...)` e quella funzione scrive sempre la chiave `alt` (vetrina-foto.ts)
    const foto = v1.find((f) => f.rel === "src/shop/cms/vetrina-foto.ts");
    const costruttore = foto?.sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "attributiImg");
    const costruttoreDaAlt = !!costruttore && nodi(costruttore, (n) => ts.isReturnStatement(n) && !!n.expression && ts.isObjectLiteralExpression(n.expression) && n.expression.properties.some((p) => p.name?.getText(foto.sf) === "alt")).length > 0;
    const altDaCostruttore = (f, el) => {
      const sp = attributi(el).find(ts.isJsxSpreadAttribute);
      if (!sp || !ts.isIdentifier(sp.expression) || !costruttoreDaAlt) return false;
      return nodi(f.sf, (n) => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === sp.expression.text && !!n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(f.sf) === "attributiImg").length > 0;
    };
    c("5 · attributiImg scrive sempre la chiave alt (da cui l'alt di <img {...img}> in FotoShop)", true, costruttoreDaAlt);
    const senza = [];
    let viste = 0;
    for (const f of v1tsx) {
      for (const el of elementiJsx(f.sf)) {
        const nome = nomeTag(el);
        if (nome !== "FotoShop" && nome !== "img") continue;
        if (!nuovo(f, riga(f.sf, el))) continue;
        viste++;
        if (!attributo(el, "alt") && !(nome === "img" && altDaCostruttore(f, el))) senza.push(`${f.rel}:${riga(f.sf, el)} <${nome}>`);
      }
    }
    c("5 · ci sono immagini da controllare (FotoShop e img)", true, viste >= 5);
    c("5 · ogni <FotoShop e ogni <img nei file V1 ha alt=", [], senza);
  });

  // ── 6 · nessun testo scritto a mano ──
  await regola(c, "regola 6", () => {
    const LETTERE = /\p{L}/u;
    const ATTRIBUTI = new Set(["aria-label", "placeholder", "alt", "title"]);
    const scritti = [];
    for (const f of v1tsx) {
      cammina(f.sf, (n) => {
        let testo = null;
        let dove = n;
        if (ts.isJsxText(n)) { testo = n.getText(f.sf); dove = n; }
        else if (ts.isJsxAttribute(n) && ATTRIBUTI.has(n.name.getText())) testo = valoreStringa(n);
        else if (ts.isJsxExpression(n) && n.expression && eStringa(n.expression) && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) testo = n.expression.text;
        if (testo === null || !LETTERE.test(testo)) return;
        const r = ts.isJsxText(n) ? rigaDi(f.sf, n.pos + (n.getText(f.sf).length - n.getText(f.sf).trimStart().length)) : riga(f.sf, dove);
        if (nuovo(f, r)) scritti.push(`${f.rel}:${r} «${norma(testo).slice(0, 40)}»`);
      });
    }
    c("6 · nessun testo scritto a mano nei componenti (JsxText, aria-label, placeholder, alt, title: solo simboli e numeri)", [], scritti);
  });

  // ── 7 · nessuno script di terzi ──
  await regola(c, "regola 7", () => {
    c("7 · nessun fbq, ttq, gtag, js.stripe.com, @stripe/stripe-js nei file V1", [], cerca(/(?<![\w$])(fbq|ttq|gtag)(?![\w$])|js\.stripe\.com|@stripe\/stripe-js/));
    const html = [];
    for (const f of v1tsx) {
      for (const el of elementiJsx(f.sf)) {
        const a = attributo(el, "dangerouslySetInnerHTML");
        if (!a || !nuovo(f, riga(f.sf, a))) continue;
        const json = valoreStringa(attributo(el, "type")) === "application/ld+json";
        const gia = /serializzaJsonLd|JSON\.stringify/.test(a.getText(f.sf));
        if (!(json && gia)) html.push(`${f.rel}:${riga(f.sf, a)}`);
      }
    }
    c("7 · nessun dangerouslySetInnerHTML (tranne il JSON-LD già serializzato)", [], html);
    // le importazioni del tracciamento: a elenco chiuso (le sole parole che le pagine possono prendere)
    const fuori = [];
    let viste = 0;
    for (const f of v1) {
      for (const imp of f.sf.statements.filter(ts.isImportDeclaration)) {
        const modulo = imp.moduleSpecifier.text;
        if (!/tracciamento|consulenza\/eventi/.test(modulo) || !nuovo(f, riga(f.sf, imp))) continue;
        const cl = imp.importClause;
        if (!cl || cl.isTypeOnly) continue; // solo tipi: nessun codice che parte
        viste++;
        const nomi = [cl.name?.text, ...(cl.namedBindings && ts.isNamedImports(cl.namedBindings) ? cl.namedBindings.elements.filter((e) => !e.isTypeOnly).map((e) => (e.propertyName ?? e.name).text) : cl.namedBindings ? ["*"] : [])].filter(Boolean);
        for (const n of nomi) if (!IMPORT_TRACCIA_AMMESSI.has(n)) fuori.push(`${f.rel}:${riga(f.sf, imp)} ${n} da ${modulo}`);
      }
    }
    c("7 · il tracciamento si importa in più punti (la regola guarda qualcosa)", true, viste >= 6);
    c("7 · le pagine importano dal tracciamento solo emettiEvento, emettiSoloContatore, traccia (e il comando GestisciCookie)", [], fuori);
  });

  // ── 8 · nessun prezzo letto dal browser ──
  await regola(c, "regola 8", () => {
    const male = [];
    let usi = 0;
    for (const f of v1) {
      for (const g of f.gettoni) {
        if (!/^(localStorage|sessionStorage)$/.test(g.t) || !ts.isIdentifier(g.nodo) || !nuovo(f, rigaDi(f.sf, g.pos))) continue;
        usi++;
        // l'istruzione che tocca lo storage (e la sua chiave): se nomina un prezzo, lo sta leggendo; e se ne esce una variabile,
        // nella stessa funzione nessun accesso a una sua proprietà dal nome di prezzo (shortcut: flusso dei dati solo a un passo)
        let istr = g.nodo.parent;
        while (istr && !ts.isStatement(istr)) istr = istr.parent;
        let fn = istr;
        while (fn && !ts.isFunctionLike(fn) && !ts.isSourceFile(fn)) fn = fn.parent;
        const nomi = [];
        cammina(istr, (n) => { if (ts.isIdentifier(n) || eStringa(n)) nomi.push(...parole(n.text)); });
        const uscite = istr && ts.isVariableStatement(istr) ? istr.declarationList.declarations.flatMap((d) => nodi(d.name, ts.isIdentifier).map((i) => i.text)) : [];
        const usatiComePrezzo = uscite.length > 0 && nodi(fn, (n) => (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && uscite.includes(n.expression.text) && parole(n.name.text).some((p) => ALLEGATI_PREZZO.has(p))) || (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression) && uscite.includes(n.expression.text) && eStringa(n.argumentExpression) && parole(n.argumentExpression.text).some((p) => ALLEGATI_PREZZO.has(p)))).length > 0;
        if (nomi.some((p) => ALLEGATI_PREZZO.has(p)) || usatiComePrezzo) male.push(`${f.rel}:${rigaDi(f.sf, g.pos)}`);
      }
    }
    c("8 · nei file V1 lo storage del browser si usa (la regola guarda qualcosa)", true, usi >= 1);
    c("8 · nessun localStorage/sessionStorage che legga un prezzo nelle pagine nuove", [], male);
  });

  // ── 9 · le cinque rotte di oggi ──
  await regola(c, "regola 9", () => {
    if (!storia) {
      c("9 · smistatori: il confronto col base si può fare", "sì", SERVE_STORIA);
      return;
    }
    const dichiarazioni = (sf) => {
      const m = new Map();
      for (const s of sf.statements) {
        if (ts.isFunctionDeclaration(s) && s.name) m.set(s.name.text, norma(s.getText(sf)));
        else if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name)) m.set(d.name.text, norma(s.getText(sf)));
        else if (ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isClassDeclaration(s)) { if (s.name) m.set(s.name.text, norma(s.getText(sf))); }
      }
      return m;
    };
    const importi = (sf) => sf.statements.filter(ts.isImportDeclaration).flatMap((i) => {
      const cl = i.importClause;
      if (!cl) return [`${i.moduleSpecifier.text}::(effetto)`];
      const nomi = [cl.name?.text, ...(cl.namedBindings ? (ts.isNamedImports(cl.namedBindings) ? cl.namedBindings.elements.map((e) => (e.propertyName ?? e.name).text) : ["*"]) : [])].filter(Boolean);
      return nomi.map((n) => `${i.moduleSpecifier.text}::${n}`);
    });
    for (const s of SMISTATORI) {
      const baseTesto = daBase(s.file);
      if (baseTesto === null || !existsSync(join(radice, s.file))) { c(`9 · ${s.file}: il base c'è`, "sì", "no"); continue; }
      const sfBase = albero(baseTesto, s.file);
      const sfOra = albero(leggi(s.file), s.file);
      const dBase = dichiarazioni(sfBase);
      const dOra = dichiarazioni(sfOra);
      const cambiate = [...dBase.keys()].filter((k) => k !== "Route" && k !== s.sostituita && dBase.get(k) !== dOra.get(k));
      c(`9 · ${s.file}: ogni funzione, costante e tipo di oggi è identico al base (testo del corpo)`, [], cambiate);
      c(`9 · ${s.file}: le funzioni di oggi sono molte (la regola guarda qualcosa)`, true, dBase.size >= 3);
      // le sole differenze ammesse nelle importazioni: righe nuove. Una voce del base che sparisce cambia il codice di oggi.
      const ora = new Set(importi(sfOra));
      c(`9 · ${s.file}: nessuna importazione del base è sparita (le righe di import nuove sono ammesse)`, [], importi(sfBase).filter((i) => !ora.has(i)));
      if (s.sostituita) {
        const cerca1 = (sf, dove, apertura) => {
          const fn = sf.statements.find((x) => ts.isFunctionDeclaration(x) && x.name?.text === dove);
          if (!fn) return null;
          const el = nodi(fn, (n) => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)).find((n) => apertura.test(norma((ts.isJsxElement(n) ? n.openingElement : n).getText(sf))));
          return el ? norma(el.getText(sf)) : null;
        };
        const prima = cerca1(sfBase, s.sostituita, s.rimasto.apertura);
        const adesso = cerca1(sfOra, s.rimasto.dove, s.rimasto.apertura);
        c(`9 · ${s.file}: il disegno di ${s.sostituita} (base) c'è, e in «${s.rimasto.dove}» è identico`, true, prima !== null && prima === adesso);
      }
    }
  });

  // ── 10 · la consulenza ──
  await regola(c, "regola 10", () => {
    const GUSCIO = "src/components/shop/guscio/GuscioShop.tsx";
    const usi = (nome) => v1.flatMap((f) => elementiJsx(f.sf).filter((el) => nomeTag(el) === nome && nuovo(f, riga(f.sf, el))).map((el) => f.rel));
    const importaDa = (nome) => v1.filter((f) => f.sf.statements.filter(ts.isImportDeclaration).some((i) => nuovo(f, riga(f.sf, i)) && i.importClause?.namedBindings && ts.isNamedImports(i.importClause.namedBindings) && i.importClause.namedBindings.elements.some((e) => (e.propertyName ?? e.name).text === nome))).map((f) => f.rel);
    c("10 · BarraConsulenza si disegna solo in GuscioShop", [GUSCIO], [...new Set(usi("BarraConsulenza"))]);
    c("10 · BarraConsulenza si importa solo in GuscioShop", [GUSCIO], importaDa("BarraConsulenza"));
    // barraFissa: una definizione sola, una sola chiamante
    const def = v1.flatMap((f) => f.sf.statements.filter((s) => (ts.isFunctionDeclaration(s) && s.name?.text === "barraFissa") || (ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => d.name.getText(f.sf) === "barraFissa"))).map(() => f.rel));
    c("10 · barraFissa è definita una volta sola (in vetrina-barre)", ["src/shop/cms/vetrina-barre.ts"], def);
    const chiama = v1.filter((f) => f.rel !== "src/shop/cms/vetrina-barre.ts" && nodi(f.sf, (n) => ts.isCallExpression(n) && n.expression.getText(f.sf) === "barraFissa").length > 0).map((f) => f.rel);
    c("10 · barraFissa la chiama solo GuscioShop (una barra sola per pagina)", [GUSCIO], chiama);
    // il pop-up: solo la scheda, solo con il carrello vuoto
    c("10 · PopupUscita si disegna solo in PaginaScheda", ["src/components/shop/pagine/PaginaScheda.tsx"], [...new Set(usi("PopupUscita"))]);
    const scheda = v1.find((f) => f.rel === "src/components/shop/pagine/PaginaScheda.tsx");
    const popup = scheda && elementiJsx(scheda.sf).find((el) => nomeTag(el) === "PopupUscita");
    let sopra = popup?.parent;
    while (sopra && !(ts.isBinaryExpression(sopra) && sopra.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) sopra = sopra.parent;
    const chiamate = sopra ? nodi(sopra.left, (n) => ts.isCallExpression(n) && n.expression.getText(scheda.sf) === "popupPuoMontarsi") : [];
    c("10 · PopupUscita sta dietro un test popupPuoMontarsi(prodotto, carrello vuoto)", true, chiamate.length === 1 && chiamate[0].arguments.length === 2 && /(?:^|\W)count\s*===\s*0$|carrelloVuoto/.test(chiamate[0].arguments[1].getText(scheda.sf)));
    const vs = v1.find((f) => f.rel === "src/shop/cms/vetrina-scheda.ts");
    const fnPopup = vs?.sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "popupPuoMontarsi");
    c("10 · popupPuoMontarsi decide con il carrello vuoto (carrelloVuoto === true) e con una patch in vendita", true, !!fnPopup && /carrelloVuoto\s*===\s*true/.test(fnPopup.getText(vs.sf)) && /eUnaPatchInVendita/.test(fnPopup.getText(vs.sf)));
    // il box dopo le FAQ e la scheda tecnica: ordine degli elementi nell'elenco dei blocchi
    const fnBlocchi = vs?.sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "bloccheScheda");
    const ordine = fnBlocchi ? nodi(fnBlocchi, (n) => ts.isPropertyAssignment(n) && n.name.getText(vs.sf) === "id" && ts.isStringLiteral(n.initializer)).map((n) => n.initializer.text) : [];
    const [iFaq, iTecnica, iBox] = [ordine.indexOf("faq"), ordine.indexOf("schedaTecnica"), ordine.indexOf("box")];
    c("10 · nell'albero dei blocchi della scheda il box viene dopo FAQ e scheda tecnica", true, iFaq >= 0 && iTecnica >= 0 && iBox > iFaq && iBox > iTecnica);
    // il pannello: un punto d'ingresso e una provenienza che esistono (D84, regole.ts non si tocca)
    const regole = albero(leggi("src/landing/consulenza/regole.ts"), "regole.ts");
    const unione = (nome) => { const t = regole.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === nome); return t ? nodi(t, ts.isStringLiteral).map((n) => n.text) : []; };
    const punti = unione("PuntoIngresso");
    const provenienze = unione("Provenienza");
    const pannelli = v1tsx.flatMap((f) => elementiJsx(f.sf).filter((el) => nomeTag(el) === "PannelloProblemi" && nuovo(f, riga(f.sf, el))).map((el) => ({ f, el })));
    c("10 · i pannelli della consulenza ci sono (la regola guarda qualcosa)", true, pannelli.length >= 4 && punti.length >= 3 && provenienze.length >= 2);
    c("10 · ogni PannelloProblemi ha un punto d'ingresso e una provenienza che esistono", [], pannelli.filter(({ el }) => !punti.includes(valoreStringa(attributo(el, "punto"))) || !provenienze.includes(valoreStringa(attributo(el, "provenienza")))).map(({ f, el }) => `${f.rel}:${riga(f.sf, el)}`));
    // cassa, ordine e collaudo non montano il guscio nuovo
    const cassa = ["src/routes/shop.checkout.tsx", "src/routes/shop.ordine.$ref.tsx", "src/routes/shop.collaudo.tsx"];
    const presenti = cassa.filter((f) => existsSync(join(radice, f)));
    c("10 · i tre file della cassa esistono (la regola guarda qualcosa)", cassa, presenti);
    c("10 · GuscioShop non è importato da shop.checkout, shop.ordine, shop.collaudo", [], presenti.filter((f) => {
      const sf = albero(leggi(f), f);
      return sf.statements.filter(ts.isImportDeclaration).some((i) => /components\/shop\/guscio\//.test(i.moduleSpecifier.text)) || nodi(sf, (n) => ts.isIdentifier(n) && n.text === "GuscioShop").length > 0;
    }));
  });

  // ── 11 · package.json ──
  await regola(c, "regola 11", () => {
    const base = daBase("package.json");
    if (base === null) { c("11 · package.json: il confronto col base si può fare", "sì", SERVE_STORIA); return; }
    const b = JSON.parse(base);
    const o = JSON.parse(leggi("package.json"));
    const ordinato = (x) => JSON.stringify(Object.fromEntries(Object.entries(x ?? {}).sort(([a], [z]) => a.localeCompare(z))));
    c("11 · package.json: dependencies uguali a quelle di 99d94d3 (nessuna libreria nuova)", ordinato(b.dependencies), ordinato(o.dependencies));
    c("11 · package.json: devDependencies uguali a quelle di 99d94d3", ordinato(b.devDependencies), ordinato(o.devDependencies));
    const tutte = Object.keys({ ...o.dependencies, ...o.devDependencies, ...o.optionalDependencies, ...o.peerDependencies });
    c("11 · nessun Playwright, axe, Lighthouse in package.json", [], tutte.filter((n) => /playwright|axe-core|@axe-core|lighthouse|puppeteer/i.test(n)));
  });

  // ── 12 · nessuna chiave ──
  await regola(c, "regola 12", () => {
    const male = [];
    for (const f of v1) {
      for (const n of nodi(f.sf, (x) => ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x))) {
        const testo = n.expression.getText(f.sf);
        if (testo !== "process.env" && testo !== "import.meta.env") continue;
        if (!nuovo(f, riga(f.sf, n))) continue;
        const nome = ts.isPropertyAccessExpression(n) ? n.name.text : (eStringa(n.argumentExpression) ? n.argumentExpression.text : "«calcolato»");
        // come catalogo.functions.ts: leggono solo SUPABASE_* (anche con il prefisso VITE_ del browser)
        if (!/^(VITE_)?SUPABASE_[A-Z_]+$/.test(nome) && (/KEY|SECRET|TOKEN|PASS|STRIPE|RESEND|API|«calcolato»/i.test(nome))) male.push(`${f.rel}:${riga(f.sf, n)} ${nome}`);
      }
    }
    c("12 · nessun process.env né import.meta.env con nome di chiave nei file V1 (solo SUPABASE_*)", [], male);
    c("12 · nessuna chiave scritta nel sorgente V1 (sk_, whsec_, JWT)", [], v1.filter((f) => /\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{8,}|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(f.testo)).map((f) => f.rel));
  });

  // ── 13 · styles.css ──
  await regola(c, "regola 13", () => {
    const base = daBase("src/styles.css");
    if (base === null) { c("13 · styles.css: il confronto col base si può fare", "sì", SERVE_STORIA); return; }
    const css = leggi("src/styles.css");
    const inizio = css.search(/\/\*[^\n]*SHOP V1/);
    c("13 · styles.css ha il blocco V1 con la sua intestazione", true, inizio > 0);
    if (inizio <= 0) return;
    c("13 · fuori dal blocco V1 styles.css è uguale al base", base.trimEnd(), css.slice(0, inizio).trimEnd());
    const blocco = css.slice(inizio);
    const pulito = blocco.replace(/\/\*[\s\S]*?\*\//g, "");
    // un piccolo lettore di parentesi graffe: ogni regola di primo livello, e dentro le @media
    const regoleDi = (testo) => {
      const r = [];
      let i = 0;
      while (i < testo.length) {
        const aperta = testo.indexOf("{", i);
        if (aperta < 0) break;
        let livello = 1;
        let j = aperta + 1;
        while (j < testo.length && livello > 0) { if (testo[j] === "{") livello++; else if (testo[j] === "}") livello--; j++; }
        r.push({ prelude: testo.slice(i, aperta).trim(), dentro: testo.slice(aperta + 1, j - 1) });
        i = j;
      }
      return r;
    };
    const primo = regoleDi(pulito);
    const fuori = [];
    const keyframes = [];
    const animazioni = [];
    let media = 0;
    const guarda = (r) => {
      if (/^@keyframes\b/.test(r.prelude)) { keyframes.push(r.prelude.replace(/^@keyframes\s+/, "")); return; }
      if (/^@media\b/.test(r.prelude)) { media++; regoleDi(r.dentro).forEach(guarda); if (!/prefers-reduced-motion/.test(r.prelude)) fuori.push(`media non ammessa: ${r.prelude}`); return; }
      if (r.prelude.startsWith("@")) { fuori.push(r.prelude); return; }
      for (const sel of r.prelude.split(",").map((s) => s.trim())) if (!sel.includes("[data-shop-v1]")) fuori.push(sel);
      for (const m of r.dentro.matchAll(/animation(?:-name)?\s*:\s*([^;]+)/g)) animazioni.push(m[1].trim().split(/\s+/)[0]);
    };
    primo.forEach(guarda);
    c("13 · nel blocco V1 ogni selettore sta sotto [data-shop-v1]", [], fuori);
    c("13 · il blocco V1 contiene prefers-reduced-motion", true, /@media[^{]*prefers-reduced-motion/.test(pulito) && media >= 1);
    c("13 · nessuna @keyframes fuori dall'elenco D100 (respiro, foglio, dissolvi, pop)", [], keyframes.filter((k) => !KEYFRAMES_D100.has(k)));
    c("13 · nessuna animazione che non sia nell'elenco D100", [], animazioni.filter((a) => a !== "none" && !KEYFRAMES_D100.has(a)));
    c("13 · il blocco V1 non porta nuovi fondi: nessun gradiente, nessun @import, nessun @font-face", [], pulito.match(/gradient\(|@import|@font-face/g) ?? []);
    c("13 · il blocco V1 è letto (la regola guarda qualcosa)", true, primo.length >= 8 && keyframes.length >= 4);
  });

  // ── 15 · i link del footer ──
  await regola(c, "regola 15", () => {
    const rotte = camminaCartella(radice, "src/routes").filter((f) => /\.tsx?$/.test(f)).map((f) => f.replace(/^src\/routes\//, "").replace(/\.tsx?$/, ""))
      .filter((n) => !n.startsWith("api.") && !n.startsWith("__") && !n.startsWith("hooks/"))
      .map((n) => "/" + n.split(".").filter((s, i, a) => !(s === "index" && i === a.length - 1)).map((s) => (s.startsWith("$") ? "$" : s)).join("/"))
      .map((p) => p.replace(/\/$/, "") || "/");
    const esiste = (href) => {
      const p = href.split(/[?#]/)[0].toLowerCase().replace(/\/+$/, "") || "/";
      return rotte.some((r) => { const re = new RegExp(`^${r.toLowerCase().split("/").map((s) => (s === "$" ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/")}$`); return re.test(p); });
    };
    c("15 · l'elenco delle rotte è letto dai file (la regola guarda qualcosa)", true, rotte.includes("/shop") && rotte.includes("/shop/cerca") && rotte.includes("/privacy-policy"));
    const footer = v1.find((f) => f.rel === "src/components/shop/guscio/FooterShop.tsx");
    if (!footer) { c("15 · FooterShop.tsx esiste", true, false); return; }
    // i link: le proprietà `href` degli elenchi e i `to=`/`href=` scritti nel JSX; un nome si risolve con le costanti del modulo da cui arriva
    const nomiDa = new Map();
    for (const i of footer.sf.statements.filter(ts.isImportDeclaration)) {
      const nb = i.importClause?.namedBindings;
      if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) nomiDa.set(e.name.text, { modulo: i.moduleSpecifier.text, originale: (e.propertyName ?? e.name).text });
    }
    const link = [];
    for (const p of nodi(footer.sf, (n) => ts.isPropertyAssignment(n) && n.name.getText(footer.sf) === "href")) {
      if (eStringa(p.initializer)) link.push({ href: p.initializer.text, riga: riga(footer.sf, p) });
      else if (ts.isIdentifier(p.initializer)) {
        const origine = nomiDa.get(p.initializer.text);
        const chiave = origine?.modulo.replace(/^@\//, "");
        const letto = origine && mod[chiave]?.[origine.originale];
        link.push({ href: typeof letto === "string" ? letto : `«non risolto: ${p.initializer.text}»`, riga: riga(footer.sf, p) });
      } else link.push({ href: `«calcolato: ${p.initializer.getText(footer.sf)}»`, riga: riga(footer.sf, p) });
    }
    for (const el of elementiJsx(footer.sf)) for (const nome of ["to", "href"]) { const v = valoreStringa(attributo(el, nome)); if (v) link.push({ href: v, riga: riga(footer.sf, el) }); }
    c("15 · il piè di pagina ha i suoi link (la regola guarda qualcosa)", true, link.length >= 5);
    c("15 · ogni link del piè di pagina è una rotta che esiste", [], link.filter((l) => !esiste(l.href)).map((l) => `${footer.rel}:${l.riga} ${l.href}`));
  });

  // ── 16 · i testi modificabili ──
  await regola(c, "regola 16", async () => {
    const T = await caricaTesti(radice, lavoro);
    const campi = T.CAMPI_TESTO_SHOP;
    const confermati = campi.filter((x) => x.chiave.startsWith("shop.conf."));
    const vuotiAmmessi = (k) => /Trascrizione$|\.liberatoria$/.test(k);
    const pagina = campi.filter((x) => !x.chiave.startsWith("shop.conf.") && !vuotiAmmessi(x.chiave));
    c("16 · l'editor ha i testi di pagina e i sei confermati (la regola guarda qualcosa)", true, pagina.length >= 20 && confermati.length === 6 && campi.length === new Set(campi.map((x) => x.chiave)).size);
    c("16 · ogni testo di pagina modificabile parte con un valore vero (lettere, niente {{ né «da confermare»)", [], pagina.filter((x) => typeof x.default !== "string" || !/\p{L}{2}/u.test(x.default) || /\{\{|da confermare/i.test(x.default)).map((x) => x.chiave));
    c("16 · shop.conf.* parte vuoto (D77): nessun testo confermato inventato", [], confermati.filter((x) => x.default !== "").map((x) => x.chiave));
    c("16 · CAMPI_CONFERMATI sono i campi shop.conf.* dell'editor, nello stesso ordine", T.CAMPI_CONFERMATI, confermati.map((x) => x.chiave));
  });

  // ── 18 · carattere e lingua = guscio per percorso ──
  await regola(c, "regola 18", () => {
    const CAR = mod["lib/carattere"];
    const BAR = mod["shop/cms/vetrina-barre"];
    c("18 · i moduli del carattere e delle barre ci sono", true, !!CAR && !!BAR);
    if (!CAR || !BAR) return;
    const V1 = ["/shop", "/shop/", "/SHOP", "/shop?utm_source=meta", "/shop/c/patch-pronte", "/Shop/C/Patch-Pronte/", "/shop/cerca", "/shop/cerca?q=toupee", "/shop/prodotto/lace-front", "/SHOP/PRODOTTO/Lace-Front/", "/shop/carrello", "/shop/Carrello?x=1#top"];
    const OGGI = ["/shop/checkout", "/shop/checkout/", "/shop/ordine/HG-1", "/shop/ordine/HG-1?t=abc", "/shop/collaudo", "/shop/collaudo/", "/shop/xyz", "/shop/c", "/shop/c/a/b", "/shop/prodotto", "/shop/cerca/altro", "/shop/carrello/altro", "/shopx", "/shopping"];
    const riga = (p) => [BAR.guscioPerPercorso(p), CAR.usaInter(p), CAR.paginaInItaliano(p)];
    c("18 · le cinque pagine V1: guscio nuovo, Inter e lang it", V1.map(() => ["nuovo", true, true]), V1.map(riga));
    c("18 · cassa, ordine, collaudo e il resto di /shop: guscio di oggi, carattere e lingua di oggi", OGGI.map(() => ["oggi", false, false]), OGGI.map(riga));
  });

  c("14 · (regola del capo all'unione) nessun routeTree.gen.ts nei file dei compiti: NON coperta da questa prova", "capo", "capo");
}

/** Impacchetta `src/landing/testi-shop.ts` e ne restituisce le esportazioni, senza passare da `require` (nessuna cache di moduli resta viva). */
async function caricaTesti(radice, lavoro) {
  const esbuild = requireQui("esbuild");
  const entrata = join(lavoro, "entrata.ts");
  writeFileSync(entrata, `export * from ${JSON.stringify(join(radice, "src/landing/testi-shop.ts"))};`);
  const r = await esbuild.build({
    entryPoints: [entrata], bundle: true, write: false, platform: "node", format: "cjs", absWorkingDir: radice,
    alias: { "@": join(radice, "src") }, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
  });
  const m = { exports: {} };
  new Function("module", "exports", "require", r.outputFiles[0].text)(m, m.exports, requireQui);
  return m.exports;
}
