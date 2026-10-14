/** ── PROVE DI /soluzioni · PAGINA, TAVOLA, SPIEGAZIONE, ROTTA E API (compiti S3.1-S3.3) ─────────────
 *  `node prove/sito/soluzioni-pagina.mjs`. Disegna sul server i componenti veri (`renderToStaticMarkup`) con una
 *  `VistaSoluzioni` costruita qui, e guarda l'HTML: cosa c'è, cosa non c'è, in che ordine. Il comportamento nel
 *  browser (apertura, fuoco, Esc, barra, foglio) lo prova Playwright in S4.5.
 *  I componenti di S2 e le funzioni di S1 sono quelli veri; S4 (foglio e barra) è ancora un segnaposto in `ponte-s4.tsx`.
 *  Qui si guarda ciò che decide S3 (struttura, ordine, regole).
 *  ───────────────────────────────────────────────────────────────────────────────────────────────── */
import { createRequire } from "node:module";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leggi, nuovaProva, radice } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("pagina /soluzioni");
const richiedi = createRequire(join(radice, "package.json"));
const esbuild = richiedi("esbuild");

//  Una cartella per lancio, cancellata alla fine (due worktree che provano insieme non si pestano i file).
const dove = realpathSync(mkdtempSync(join(tmpdir(), "prove-soluzioni-")));
process.on("exit", () => rmSync(dove, { recursive: true, force: true }));

const TRACKING_FINTO = `
export const chiamate = [];
export const eventId = () => "evt";
export const trackEvent = async (...a) => { chiamate.push(["trackEvent", ...a]); };
export const firePixel = () => {}; export const fireCapi = async () => {};
export const initAdminCheck = () => Promise.resolve(false); export const isAdminLogged = () => false;
export const subscribeAdminStatus = () => () => {};
export const initHeartbeat = () => () => {}; export const initLivePresence = () => () => {};
export const initScrollTracking = () => () => {}; export const initClickTracking = () => () => {};
export const initHighQualityVisit = () => () => {};
export const captureSourceData = () => ({});
`;
//  Il router vero non serve (e non gira fuori da un'app): un `Link` che è un <a>, `ScriptOnce` che scrive lo script,
//  `createFileRoute` che restituisce le opzioni, `redirect` che si lancia come oggetto riconoscibile.
const ROUTER_FINTO = `
import { createElement } from "react";
export const Link = ({ to, children, ...r }) => createElement("a", { href: to, ...r }, children);
export const ScriptOnce = ({ children }) => createElement("script", { "data-scriptonce": "", dangerouslySetInnerHTML: { __html: children } });
export const createFileRoute = (path) => (options) => ({ path, options, useLoaderData: () => null });
export const redirect = (o) => Object.assign(new Error("redirect"), { redirezione: o });
`;

let contatore = 0;
/** Impacchetta `sorgente` (un piccolo file di prova che importa i file veri) e lo carica.
 *  `finti`: elenco di [filtro, codice] — i moduli che il filtro riconosce diventano quel codice. */
async function impacchetta(sorgente, finti = []) {
  const n = ++contatore;
  const fuori = join(dove, `fuori-${n}.cjs`);
  //  Ogni modulo finto è codice in memoria che si risolve dalla radice del progetto (così trova `react`).
  const standard = [
    [/(^|\/)tracking$/, "tracking", TRACKING_FINTO],
    [/^@tanstack\/react-router$/, "router", ROUTER_FINTO],
    [/^@\/integrations\/supabase\/client$/, "client", "export const supabase = {};"],
  ];
  const tutti = [...finti.map(([filtro, codice], i) => [filtro, `utente-${i}`, codice]), ...standard];
  const codici = new Map(tutti.map(([, nome, codice]) => [nome, codice]));
  await esbuild.build({
    stdin: { contents: sorgente, resolveDir: radice, loader: "ts", sourcefile: `entrata-${n}.ts` },
    outfile: fuori,
    bundle: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    loader: { ".png": "dataurl", ".webp": "dataurl", ".svg": "dataurl" },
    logLevel: "error",
    absWorkingDir: radice,
    alias: { "@": join(radice, "src") },
    plugins: [
      {
        name: "finti",
        setup(b) {
          for (const [filtro, nome] of tutti) b.onResolve({ filter: filtro }, () => ({ path: nome, namespace: "finto" }));
          b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: codici.get(a.path), loader: "ts", resolveDir: radice }));
        },
      },
    ],
  });
  return createRequire(import.meta.url)(fuori);
}

const rel = (p) => JSON.stringify(join(radice, p));
const PRELUDIO = `import { renderToStaticMarkup } from "react-dom/server";\nimport { createElement as h } from "react";\n`;

/* ── La vista di prova: tutto pieno, e le sue varianti ─────────────────────────────────────────── */
const slot = (nome) => ({ src: `https://progetto.supabase.co/storage/v1/object/public/landing-media/${nome}.webp`, poster: `https://progetto.supabase.co/storage/v1/object/public/landing-media/${nome}-poster.webp`, alt: `Alt di ${nome}` });
const PIENA = {
  pubblicabile: true,
  anteprima: false,
  mancanti: [],
  ritratto: slot("ritratto"),
  miniature: { trapianto: slot("trapianto"), patch: slot("patch"), invisibile: slot("invisibile") },
  video: { slot: slot("video"), trascrizione: "Le parole dette davvero." },
  macro: slot("macro"),
  ogImage: "https://progetto.supabase.co/storage/v1/object/public/landing-media/og.jpg",
};

const conta = (testo, re) => (testo.match(re) ?? []).length;
const decodifica = (t) => t.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const testoVisibile = (html) => decodifica(html.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
//  Il testo di un blocco così com'è scritto (senza spazi fra i tag): per confrontare una riga intera.
const testoRiga = (html) => decodifica(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const interattivi = (html) => conta(html, /<(a|button)[\s>]/g);

/* ═══ S3.1 · TESTATA E TAVOLA ═══════════════════════════════════════════════════════════════════ */
{
  const m = await impacchetta(
    `${PRELUDIO}
import { Testata } from ${rel("src/landing/sito/soluzioni/Testata")};
import { TavolaSoluzioni } from ${rel("src/landing/sito/soluzioni/TavolaSoluzioni")};
const no = () => {};
export const testata = (p) => renderToStaticMarkup(h(Testata, { onPrenota: no, ...p }));
export const tavola = (p) => renderToStaticMarkup(h(TavolaSoluzioni, { aperta: false, onAlterna: no, onPrenota: no, cellaRef: { current: null }, ...p }));
`,
  );
  const T = await impacchetta(`export * from ${rel("src/landing/testi-sito")};`);
  const S = T.TESTI_SOLUZIONI;

  /* ── Testata ── */
  const t = m.testata({ ritratto: PIENA.ritratto });
  c("testata: un solo <h1>", 1, conta(t, /<h1[\s>]/g));
  c("testata: il titolo in due blocchi (a capo dopo il «?» su computer)", ["Trapianto, patch o Invisible Derm?", "Li facciamo tutti e tre."], [...(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(t)?.[1] ?? "").matchAll(/<span class="block[^"]*">([\s\S]*?)<\/span>(?=<span class="block|$)/g)].map((x) => testoRiga(x[1])));
  vero("testata: «tutti e tre» è l'unica parola in accento", conta(t, /tutti e tre/g) === 1 && /<span class="[^"]*">tutti e tre<\/span>/.test(t));
  vero("testata: il logo con il suo alt e l'indirizzo", t.includes('alt="Hair Genius Labs"') && testoVisibile(t).includes(S.marchio.indirizzo));
  c("testata: nessun collegamento (né alla home, né menu, WhatsApp o telefono): zero <a> e zero <nav>", 0, conta(t, /<(a|nav)[\s>]/g));
  vero("testata: il sottotitolo accanto al ritratto", testoVisibile(t).includes(S.sottotitolo));
  vero("testata: il ritratto ha l'alt della vista e fetchpriority=high", /<img[^>]*alt="Alt di ritratto"[^>]*/.test(t) && /<img[^>]*alt="Alt di ritratto"[^>]*fetchpriority="high"/i.test(t));
  c("testata: con il ritratto, 2 immagini (logo + volto)", 2, conta(t, /<img[\s>]/g));
  const senza = m.testata({ ritratto: null });
  c("testata: senza ritratto niente cerchio, resta solo il logo", 1, conta(senza, /<img[\s>]/g));
  vero("testata: senza ritratto il sottotitolo c'è lo stesso", testoVisibile(senza).includes(S.sottotitolo));
  vero("testata: senza ritratto nessun cerchio vuoto né iniziali", !/rounded-full/.test(senza));
  c("testata: il bottone blu in alto a destra (solo da 1024) c'è una volta, con la sua riga", [1, true], [conta(t, /Prenota la consulenza gratuita/g), testoVisibile(t).includes(S.primario.riga)]);
  vero("testata: quel blocco è nascosto sotto i 1024 px (classi hidden + lg:block)", [...t.matchAll(/<div class="([^"]*)">/g)].some((x) => x[1].split(" ").includes("hidden") && x[1].split(" ").includes("lg:block")));

  /* ── Tavola ── */
  const v = m.tavola({ miniature: PIENA.miniature });
  const righe = [...v.matchAll(/<li[\s>][\s\S]*?<\/li>/g)].map((x) => x[0]);
  c("tavola: tre righe", 3, righe.length);
  c("tavola: ogni riga ha UN solo elemento attivo (link esteso, niente bottoni dentro bottoni)", [1, 1, 1], righe.map(interattivi));
  c("tavola: numeri 01 · 02 · 03 nell'ordine", ["01", "02", "03"], righe.map((r) => /(0[123])/.exec(testoVisibile(r))?.[1]));
  c("tavola: tre H2 con i nomi in ordine", ["Trapianto", "Patch", "Invisible Derm"], [...v.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((x) => testoVisibile(x[1])));
  vero("tavola: ogni riga ha la sua riga di testo", S.voci.every((voce, i) => testoVisibile(righe[i]).includes(voce.riga)));
  vero("tavola: il link esteso (::after su tutta la riga) su ogni azione", righe.every((r) => /after:absolute/.test(r) && /after:inset-0/.test(r)));
  vero("tavola: l'azione non gonfia la riga (min-h-0: l'area di tocco è già la riga)", righe.every((r) => /class="[^"]*\bmin-h-0\b/.test(r)));
  vero("tavola: un solo «+» nel bottone della cella 03 (lo disegna S2)", conta(righe[2], /<svg/g) === 1);
  vero("tavola: la terza riga è la cella con id=\"invisible-derm\"", /^<li[^>]*id="invisible-derm"/.test(righe[2]) && !/id="invisible-derm"/.test(righe[0] + righe[1]));
  vero("tavola: 01 è un bottone (apre il modulo), senza href", /<button/.test(righe[0]) && !/<a[\s>]/.test(righe[0]) && testoVisibile(righe[0]).includes("Si può fare nel mio caso?"));
  vero("tavola: 02 è un link al catalogo", /<a [^>]*href="\/shop"/.test(righe[1]) && testoVisibile(righe[1]).includes("Patch pronte in stock →"));
  vero("tavola: 03 ha l'etichetta «Solo da noi», le altre no", testoVisibile(righe[2]).includes("Solo da noi") && !/Solo da noi/.test(righe[0] + righe[1]));
  vero("tavola: 03 chiusa: aria-expanded=false, aria-controls, testo «Che cos'è Invisible Derm?»",
    /<button[^>]*aria-expanded="false"/.test(righe[2]) && /<button[^>]*aria-controls="spiegazione-invisible-derm"/.test(righe[2]) && testoVisibile(righe[2]).includes("Che cos'è Invisible Derm?"));
  vero("tavola: 03 ha l'etichetta accessibile della scheda", righe[2].includes(S.voci[2].etichettaAccessibile));
  const aperta = m.tavola({ miniature: PIENA.miniature, aperta: true });
  const rigaAperta = [...aperta.matchAll(/<li[\s>][\s\S]*?<\/li>/g)].map((x) => x[0])[2];
  vero("tavola: 03 aperta: aria-expanded=true e «Chiudi la spiegazione»", /<button[^>]*aria-expanded="true"/.test(rigaAperta) && testoVisibile(rigaAperta).includes("Chiudi la spiegazione") && !testoVisibile(rigaAperta).includes("Che cos'è"));
  c("tavola: con le miniature, 3 immagini con larghezza e altezza", [3, 3], [conta(v, /<img[\s>]/g), conta(v, /<img[^>]*width="\d+"[^>]*height="\d+"/g)]);
  vero("tavola: ogni miniatura ha il suo alt", ["trapianto", "patch", "invisibile"].every((n) => v.includes(`alt="Alt di ${n}"`)));
  const testo = m.tavola({ miniature: null });
  c("tavola: «tutte o nessuna»: senza miniature zero <img>", 0, conta(testo, /<img[\s>]/g));
  vero("tavola: senza miniature compaiono i tre numeri grandi", conta(testo, /text-\[40px\]/g) === 3);
  vero("tavola: con le miniature i numeri grandi non ci sono", !/text-\[40px\]/.test(v));
  vero("tavola: niente riquadri grigi né PlaceholderBox", !/bg-gray|bg-neutral|bg-slate|placeholder/i.test(testo + v));

  /* ── Il bottone blu sotto la tavola: solo telefono, e non mentre la spiegazione è aperta (decisione 12) ── */
  const sotto = (h) => conta(h, /Prenota la consulenza gratuita/g);
  c("blu sotto la tavola: c'è a spiegazione chiusa", 1, sotto(v));
  vero("blu sotto la tavola: è nascosto da 1024 (su computer sta in alto)", /<div class="[^"]*lg:hidden[^"]*">(?:(?!<\/div>)[\s\S])*Prenota la consulenza gratuita/.test(v));
  c("blu sotto la tavola: NON si disegna a spiegazione aperta", 0, sotto(aperta));
  vero("blu sotto la tavola: porta la sua riga", testoVisibile(v).includes(S.primario.riga));

  /* ── Niente prezzi, promesse o segnaposto nell'HTML ── */
  const tutto = testoVisibile(t + v + testo);
  vero("nessuna parola vietata nell'HTML (prezzi, «invisibile», «Indistinguibile», {{ , «da confermare»)", !/€|\binvisibil[ei]/i.test(tutto) && !/Indistinguibil|\{\{|da confermare|Verificato|1326/.test(t + v + testo));
}

/* ── Niente copie di ciò che ha già S2 (caratteri, fondi, animazione, scala tipografica) ── */
{
  const sorgenti = ["Testata", "TavolaSoluzioni", "SpiegazioneInvisible", "PaginaSoluzioni", "stile"].map((f) => leggi(`src/landing/sito/soluzioni/${f}.${f === "stile" ? "ts" : "tsx"}`)).join("\n");
  vero("niente @font-face né famiglie scritte a mano: i caratteri sono quelli di S2 (sol-h1, sol-h2-*, token --hgl-font-*)", !/AntonHGL|InterTightHGL|font-\[family-name:(?!var\(--hgl-font)/.test(sorgenti));
  vero("niente fondi o griglie scritti a mano: sol-fondo-notte e sol-fondo-chiaro", !/STILE_NOTTE|STILE_CHIARO|linear-gradient|backgroundImage/.test(sorgenti) && /sol-fondo-notte/.test(sorgenti) && /sol-fondo-chiaro/.test(sorgenti));
  vero("l'animazione del pannello è sol-pannello (S2)", /sol-pannello"/.test(sorgenti) && !/grid-rows-\[/.test(sorgenti));
  vero("nessuna copia dei segnaposto dei contratti di S1 e S2 (ponte.ts, ponte-ui.tsx, traccia-soluzioni.ts)", !/from "\.\/ponte"|from "\.\/ponte-ui"|traccia-soluzioni/.test(sorgenti));
}

/* ═══ S3.2 · LA SPIEGAZIONE «CHE COS'È INVISIBLE DERM?» ═══════════════════════════════════════════ */
{
  const m = await impacchetta(
    `${PRELUDIO}
import { SpiegazioneInvisible } from ${rel("src/landing/sito/soluzioni/SpiegazioneInvisible")};
const no = () => {};
const stato = (aperta, montata) => ({ aperta, montata, istantanea: false, chiudi: no, apri: no, alterna: no, titoloRef: { current: null }, cellaRef: { current: null } });
export const spiegazione = (aperta, montata, vista, extra = {}) => renderToStaticMarkup(h(SpiegazioneInvisible, { stato: stato(aperta, montata), vista, onPrenota: no, priorita: false, ...extra }));
`,
  );
  const T = await impacchetta(`export * from ${rel("src/landing/testi-sito")};`);
  const E = T.TESTI_SOLUZIONI.spiegazione;
  const posizione = (html, testo) => html.indexOf(testo);
  const URL_MEDIA = ["video.webp", "video-poster.webp", "macro.webp", "macro-poster.webp"];

  /* ── Chiusa: nell'HTML per Google e per la ricerca nella pagina, ma senza un solo file video ── */
  const chiusa = m.spiegazione(false, false, PIENA);
  vero("chiusa: <section id=\"spiegazione-invisible-derm\" aria-labelledby=\"titolo-invisible-derm\"> nascosta (hidden)",
    /<section[^>]*id="spiegazione-invisible-derm"/.test(chiusa) && /<section[^>]*aria-labelledby="titolo-invisible-derm"/.test(chiusa) && /<section[^>]*\shidden=""/.test(chiusa));
  //  React 19.2 non conosce «until-found»: gli si passa il booleano e scrive hidden="". La parola giusta la mette il gancio dopo il disegno
  //  (useLayoutEffect, ogni volta che il pannello torna chiuso): qui si controlla che il codice lo faccia; il browser vero lo prova Playwright.
  const sorgenteSpiegazione = leggi("src/landing/sito/soluzioni/SpiegazioneInvisible.tsx");
  vero("chiusa: dopo il disegno il pannello diventa hidden=\"until-found\" (ripiego: resta hidden, nei browser che non lo conoscono)",
    /useLayoutEffect\([\s\S]*?setAttribute\("hidden", "until-found"\)[\s\S]*?\[montata\]\)/.test(sorgenteSpiegazione));
  vero("chiusa: il titolo (H2 con id e tabindex=-1) e la prima riga sono nell'HTML", /<h2[^>]*id="titolo-invisible-derm"[^>]*tabindex="-1"|<h2[^>]*tabindex="-1"[^>]*id="titolo-invisible-derm"/.test(chiusa) && testoVisibile(chiusa).includes(E.primaRiga));
  c("chiusa: nessun <video> nel DOM", 0, conta(chiusa, /<video[\s>]/g));
  vero("chiusa: nessun indirizzo di video, copertina o clip nell'HTML", URL_MEDIA.every((u) => !chiusa.includes(u)));
  vero("chiusa: le tre righe e le due piccole ci sono (testo per chi cerca nella pagina)", [...E.righe, ...E.piccole].every((r) => testoVisibile(chiusa).includes(r.testo)));

  /* ── Aperta dal server (?apri) o dopo il tocco: niente hidden, i media ci sono ── */
  const aperta = m.spiegazione(true, true, PIENA);
  vero("aperta: nessun attributo hidden", !/<section[^>]*\shidden/.test(aperta));
  vero("aperta: il video del titolare (copertina) e la clip ci sono", aperta.includes("video-poster.webp") && aperta.includes("macro-poster.webp") && conta(aperta, /<video[\s>]/g) === 2 && /class="sol-clip"/.test(aperta));
  vero("aperta: la clip ha la sua descrizione e la didascalia dei testi", aperta.includes(PIENA.macro.alt) && testoVisibile(aperta).includes(E.macro.didascalia));
  vero("aperta: la trascrizione (se c'è) è nell'HTML come testo", testoVisibile(aperta).includes("Le parole dette davvero."));

  /* ── L'ordine della 3.2: titolo → prima riga → video → macro → righe → limite → piccole → passo → chiudi ── */
  const ordine = [E.titolo, E.primaRiga, 'class="sol-video"', 'class="sol-clip"', E.righe[0].testo, E.righe[1].testo, E.righe[2].testo, E.piccole[0].testo, E.piccole[1].testo, E.passo.bottone, E.passo.riga, E.passo.chiudi];
  const normale = decodifica(aperta);
  const indici = ordine.map((x) => normale.indexOf(x));
  c("ordine: ogni pezzo c'è", [], indici.map((v, i) => (v < 0 ? ordine[i] : null)).filter(Boolean));
  c("ordine: titolo → prima riga → video → macro → tre righe → due piccole → bottone → riga → chiudi", true, indici.every((v, i) => i === 0 || v > indici[i - 1]));
  vero("il limite vero sta prima del bottone, con il filetto a sinistra e la frase intera", normale.indexOf("E non cura la caduta: la copre.") < normale.indexOf(E.passo.bottone) && /<li[^>]*class="[^"]*border-l-2[^"]*"[^>]*>(?:(?!<\/li>)[\s\S])*Il limite vero/.test(aperta));
  {
    const [righe, piccole] = [...aperta.matchAll(/<ul class="[^"]*">([\s\S]*?)<\/ul>/g)].map((x) => x[1]);
    vero("le tre righe hanno un'icona ciascuna (aria-hidden), le due piccole nessuna", conta(righe, /<svg[^>]*aria-hidden="true"/g) === 3 && conta(piccole, /<svg/g) === 0);
  }
  c("passo: il bottone «Prenota la consulenza gratuita» c'è una volta, nel pannello", 1, conta(aperta, new RegExp(E.passo.bottone, "g")));
  //  I colori (bordo #0B5FB0 del blu sul chiaro, testo notte dei link) li dà S2 dentro `.sol-fondo-chiaro`: qui si guarda che la sezione ce l'abbia
  //  e che il blu e il link stiano dentro; il colore calcolato lo prova il browser (vedi la LAVAGNA).
  vero("fondo: la spiegazione è `sol-fondo-chiaro` (classe di S2, nessun colore copiato)", /<section[^>]*class="sol-fondo-chiaro[^"]*"/.test(aperta) && !/style="[^"]*background/.test(aperta));
  vero("passo: il bottone blu e «Chiudi la spiegazione» stanno dentro quel fondo, con i ruoli di S2", /class="sol-btn-primario"/.test(aperta) && /<button[^>]*class="sol-link[^"]*"[^>]*><span>Chiudi la spiegazione<\/span>/.test(aperta));

  /* ── Quando manca qualcosa ── */
  const senzaMacro = m.spiegazione(true, true, { ...PIENA, macro: null });
  c("senza clip: nessun blocco della clip, il resto della spiegazione resta", [0, true], [conta(senzaMacro, /<figure[\s>]/g), [...E.righe, ...E.piccole].every((r) => testoVisibile(senzaMacro).includes(r.testo)) && testoVisibile(senzaMacro).includes(E.passo.bottone)]);

  /* ── Anteprima dal CRM: la riga tratteggiata, mai sul sito ── */
  const senzaVideoAnteprima = m.spiegazione(true, true, { ...PIENA, pubblicabile: false, anteprima: true, mancanti: ["video", "copertina", "sottotitoli"], video: null });
  vero("anteprima senza video: al posto del video la riga tratteggiata con il testo della 4.7", /border-dashed/.test(senzaVideoAnteprima) && testoVisibile(senzaVideoAnteprima).includes(E.anteprima.senzaVideo));
  const senzaVideoSito = m.spiegazione(true, true, { ...PIENA, pubblicabile: false, anteprima: false, video: null });
  vero("sul sito (anteprima=false) la riga dell'anteprima non esiste mai", !/border-dashed|Anteprima/.test(senzaVideoSito));
  vero("anteprima senza video: nessun riquadro grigio al posto del video", !/bg-gray|bg-neutral|placeholder/i.test(senzaVideoAnteprima));
  const soloSottotitoli = m.spiegazione(true, true, { ...PIENA, pubblicabile: false, anteprima: true, mancanti: ["sottotitoli"] });
  vero("anteprima con il video ma senza conferma dei sottotitoli: il video si vede e la riga dice cosa manca davvero", soloSottotitoli.includes("video-poster.webp") && /border-dashed/.test(soloSottotitoli) && testoVisibile(soloSottotitoli).includes("manca la conferma dei sottotitoli") && !testoVisibile(soloSottotitoli).includes("manca il video"));
  const senzaCopertina = m.spiegazione(true, true, { ...PIENA, pubblicabile: false, anteprima: true, mancanti: ["copertina"], video: null });
  vero("anteprima con il video ma senza copertina: la riga dice la copertina, NON «manca il video» (sarebbe falso)", testoVisibile(senzaCopertina).includes("Anteprima. Non va online: manca la copertina.") && !testoVisibile(senzaCopertina).includes("manca il video"));
  vero("anteprima pubblicabile: nessuna riga tratteggiata", !/border-dashed/.test(m.spiegazione(true, true, { ...PIENA, anteprima: true })));

  /* ── Il testo che arriva dal CRM (trascrizione, alt) resta testo: mai HTML ── */
  const ostile = m.spiegazione(true, true, { ...PIENA, video: { slot: { ...PIENA.video.slot, alt: 'x" onerror="alert(1)' }, trascrizione: "</script><img src=x onerror=alert(1)>" } });
  vero("la trascrizione ostile non diventa HTML (</script><img … onerror> è scritto come testo)", !ostile.includes("<img src=x") && !ostile.includes("</script><img") && ostile.includes("&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;"));
  vero("l'alt ostile non esce dall'attributo (nessun tag ha un attributo onerror)", !/<[^>]+\sonerror=/.test(ostile.replace(/"[^"]*"/g, '""')) && ostile.includes("&quot; onerror=&quot;alert(1)"));
}

/* ═══ S3.3 · LA PAGINA INTERA, LA ROTTA E L'API DELL'ANTEPRIMA ════════════════════════════════════ */
const TRACCIA_FINTA = `
export const usaTracciamentoPagina = (p) => { (globalThis.__tracciati ??= []).push(p); };
export const traccia = () => {};
`;
{
  const m = await impacchetta(
    `${PRELUDIO}
import { PaginaSoluzioni } from ${rel("src/landing/sito/soluzioni/PaginaSoluzioni")};
export const pagina = (vista, apriDalServer = false) => { globalThis.__tracciati = []; return renderToStaticMarkup(h(PaginaSoluzioni, { vista, apriDalServer })); };
export const tracciati = () => globalThis.__tracciati;
`,
    [[/landing\/sito\/traccia$/, TRACCIA_FINTA]],
  );
  const T = await impacchetta(`export * from ${rel("src/landing/testi-sito")};`);
  const S = T.TESTI_SOLUZIONI;

  const chiusa = m.pagina(PIENA);
  const aperta = m.pagina(PIENA, true);
  const hrefs = (html) => [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((x) => x[1]);

  /* ── Cosa c'è e cosa non c'è ── */
  vero("pagina: la radice è lang=\"it\" con la classe del tema", /<div[^>]*class="[^"]*tema-soluzioni[^"]*"[^>]*lang="it"|<div[^>]*lang="it"[^>]*class="[^"]*tema-soluzioni/.test(chiusa));
  c("pagina: un solo <h1> e un solo <main>", [1, 1], [conta(chiusa, /<h1[\s>]/g), conta(chiusa, /<main[\s>]/g)]);
  vero("pagina: il footer sta fuori da <main> (altrimenti non è più il piè di pagina)", chiusa.indexOf("</main>") < chiusa.indexOf("<footer") && chiusa.indexOf("<footer") > 0);
  c("pagina: le sole uscite sono il catalogo (barra + riga 02) e i link legali del footer", ["/cookie-policy", "/privacy-policy", "/shop", "/shop", "/termini-e-condizioni"], hrefs(chiusa).sort());
  vero("pagina: niente WhatsApp, telefono, email, blog, social", !/wa\.me|whatsapp|tel:|mailto:|href="\/blog|instagram|facebook/i.test(chiusa));
  c("pagina: l'unico <nav> è quello dei link legali del footer (niente menu)", ['aria-label="Informazioni legali"'], [...chiusa.matchAll(/<nav[^>]*>/g)].map((x) => /aria-label="[^"]*"/.exec(x[0])?.[0]));
  vero("pagina: niente StickyHeader, BarraConsulenza, MediaSlot, PlaceholderBox", !/data-barra-consulenza|placeholder|data-sticky/i.test(chiusa));
  vero("pagina: l'ordine è testata → tavola → spiegazione → footer", (() => { const i = [chiusa.indexOf("<h1"), chiusa.indexOf("<ol"), chiusa.indexOf("<section"), chiusa.indexOf("<footer")]; return i.every((v, k) => v > -1 && (k === 0 || v > i[k - 1])); })());
  c("pagina: la barra delle patch c'è una volta, dal primo disegno (è nell'HTML del server), con la sua etichetta accessibile", 1, conta(chiusa, /Vai al catalogo delle patch pronte in stock/g));
  vero("pagina: il foglio del modulo non occupa posto a foglio chiuso", !/role="dialog"/.test(chiusa));
  c("pagina chiusa: il bottone «Prenota la consulenza gratuita» c'è 3 volte (alto a destra da 1024, sotto la tavola su telefono, nel passo della spiegazione chiusa)", 3, conta(chiusa, /Prenota la consulenza gratuita/g));
  c("pagina: nessuno script d'apertura quando non c'è ?apri", 0, conta(chiusa, /data-scriptonce/g));
  vero("pagina chiusa: la spiegazione è nascosta e senza video", /<section[^>]*id="spiegazione-invisible-derm"[^>]*\shidden=""/.test(chiusa) && !/<video/.test(chiusa));
  c("pagina chiusa: le immagini sono logo, ritratto, tre miniature e il logo del footer", 6, conta(chiusa, /<img[\s>]/g));

  /* ── Aperta dal server (?apri=invisible-derm) ── */
  vero("?apri: il pannello è già aperto nell'HTML (nessun hidden)", /<section[^>]*id="spiegazione-invisible-derm"/.test(aperta) && !/<section[^>]*\shidden/.test(aperta));
  vero("?apri: la copertina del video e la clip ci sono già", aperta.includes('alt="Alt di video"') && /<video/.test(aperta));
  c("?apri: il blu sotto la tavola non si disegna (nel pannello c'è il suo gemello): 2 bottoni in tutto", 2, conta(aperta, /Prenota la consulenza gratuita/g));
  {
    const script = /<script data-scriptonce="">([\s\S]*?)<\/script>/.exec(aperta)?.[1] ?? "";
    vero("?apri: UNO script che porta la cella 03 in cima prima del primo disegno", conta(aperta, /data-scriptonce/g) === 1 && script.includes('getElementById("invisible-derm")') && script.includes("scrollIntoView"));
    vero("?apri: lo script sta dopo il pannello (a quel punto la pagina è già abbastanza alta per scorrere)", aperta.indexOf("data-scriptonce") > aperta.indexOf("</section>"));
    vero("?apri: lo script non tocca il fuoco", !/focus\(/.test(script));
    vero("?apri: lo script scrive anche #invisible-derm (senza, dopo l'idratazione il router rimette la pagina in cima)", script.includes("replaceState") && script.includes("#invisible-derm") && script.includes("location.search"));
  }

  /* ── Tracciamento: sul sito sì, nell'anteprima del CRM no ── */
  m.pagina(PIENA);
  c("tracciamento: sul sito la visita si conta con il percorso /soluzioni", ["/soluzioni"], m.tracciati());
  m.pagina({ ...PIENA, anteprima: true });
  c("tracciamento: nell'anteprima del CRM i numeri del titolare non sporcano le visite", [], m.tracciati());

  /* ── Quando manca qualcosa la pagina non si rompe e non ha riquadri grigi ── */
  const povera = m.pagina({ ...PIENA, ritratto: null, miniature: null, macro: null }, true);
  c("pagina povera: solo i due loghi (testata e footer) come immagini (la copertina del video è nel pannello)", 2, conta(povera.replace(/<button[^>]*aria-label[\s\S]*?<\/button>/g, ""), /<img[\s>]/g));
  vero("pagina povera: ci sono lo stesso titolo, tre righe, spiegazione e bottone", conta(povera, /<h1[\s>]/g) === 1 && conta(povera, /<li[\s>]/g) >= 6 && povera.includes(S.spiegazione.passo.bottone));
  vero("nessuna parola vietata nella pagina intera (prezzi, «invisibile», «Indistinguibile», {{, «da confermare», stelle)", !/€|\binvisibil[ei]/i.test(testoVisibile(chiusa + aperta + povera)) && !/Indistinguibil|\{\{|da confermare|Verificato|1326|★/.test(chiusa + aperta + povera));
}

/* ── La rotta: cancello, 302, testa, cache ─────────────────────────────────────────────────────── */
{
  const CONTENUTI_FINTO = `
export const chiamate = { leggi: [], registra: [] };
export const leggiSoluzioni = async (o) => { chiamate.leggi.push(o); if (globalThis.__leggiLancia) throw new Error("db giù"); return globalThis.__vista; };
export const registraCancello = (o) => { chiamate.registra.push(o); if (globalThis.__registraLancia) return Promise.reject(new Error("lp_events giù")); return Promise.resolve(); };
`;
  //  `regole` (destinazioneCancello, apriDaRicerca, VISTA_VUOTA) è quella vera di S1: la rotta la usa com'è.
  const R = await impacchetta(
    `export { Route } from ${rel("src/routes/soluzioni")}; export { chiamate } from "@/landing/sito/soluzioni/contenuti";`,
    [
      [/soluzioni\/contenuti$/, CONTENUTI_FINTO],
      [/soluzioni\/PaginaSoluzioni$/, `export const PaginaSoluzioni = () => null;`],
    ],
  );
  const { options } = R.Route;
  const VUOTA = { pubblicabile: false, anteprima: false, mancanti: ["video", "copertina", "sottotitoli"], ritratto: null, miniature: null, video: null, macro: null, ogImage: null };
  const lancia = async (searchStr, search = {}) => {
    R.chiamate.leggi.length = 0;
    R.chiamate.registra.length = 0;
    try {
      const deps = options.loaderDeps({ search });
      return { ok: await options.loader({ deps, location: { searchStr } }) };
    } catch (e) {
      return { redirezione: e.redirezione, errore: e.redirezione ? null : e.message };
    }
  };

  c("rotta: /soluzioni", "/soluzioni", R.Route.path);
  c("rotta: cache e ricarica (decisione 11): staleTime infinito e mai ricaricata", [Infinity, false], [options.staleTime, options.shouldReload]);

  globalThis.__vista = VUOTA;
  let r = await lancia("?utm_source=meta&utm_campaign=ottobre&apri=invisible-derm&anteprima=sbagliato&x=1", { utm_source: "meta", apri: "invisible-derm", anteprima: "sbagliato" });
  c("cancello chiuso: 302 verso la home con i soli parametri delle campagne (mai 301)", { href: "/?utm_source=meta&utm_campaign=ottobre", statusCode: 302 }, r.redirezione);
  c("cancello chiuso: il codice d'anteprima sbagliato arriva al server e basta, non apre niente", [{ data: { anteprima: "sbagliato" } }], R.chiamate.leggi);
  c("cancello chiuso: la visita fermata si registra con la stessa query ({ data: { search } })", [{ data: { search: "?utm_source=meta&utm_campaign=ottobre&apri=invisible-derm&anteprima=sbagliato&x=1" } }], R.chiamate.registra);
  r = await lancia("", {});
  c("cancello chiuso senza parametri: 302 alla home pulita", { href: "/", statusCode: 302 }, r.redirezione);
  c("senza codice: leggiSoluzioni riceve anteprima undefined", [{ data: { anteprima: undefined } }], R.chiamate.leggi);

  globalThis.__registraLancia = true;
  r = await lancia("?utm_source=meta", { utm_source: "meta" });
  c("cancello chiuso con la registrazione che fallisce: 302 lo stesso, nessuna eccezione", 302, r.redirezione?.statusCode);
  globalThis.__registraLancia = false;
  globalThis.__leggiLancia = true;
  r = await lancia("?utm_source=meta", { utm_source: "meta" });
  c("lettura che lancia: mai un 500, cancello chiuso e 302", [302, null], [r.redirezione?.statusCode, r.errore ?? null]);
  globalThis.__leggiLancia = false;

  globalThis.__vista = { ...VUOTA, pubblicabile: true, mancanti: [] };
  r = await lancia("?apri=invisible-derm", { apri: "invisible-derm" });
  c("pubblicabile: la vista arriva alla pagina, niente 302 e niente registrazione", [true, 0], [r.ok?.pubblicabile, R.chiamate.registra.length]);
  globalThis.__vista = { ...VUOTA, anteprima: true };
  r = await lancia("?anteprima=codice-giusto", { anteprima: "codice-giusto" });
  c("anteprima valida: la pagina si vede anche col cancello chiuso, niente 302", [true, false], [r.ok?.anteprima, !!r.redirezione]);

  /* ── La testa della pagina ── */
  const testa = (loaderData, search = {}) => options.head({ loaderData, match: { search } });
  const cerca = (t, chiave, valore) => t.meta.find((x) => x[chiave] === valore);
  let t = testa({ ...VUOTA, pubblicabile: true });
  c("testa: titolo della 3.6", "Trapianto, patch o Invisible Derm | Hair Genius Labs Roma", t.meta.find((x) => x.title)?.title);
  vero("testa: noindex", !!t.meta.find((x) => x.name === "robots" && /noindex/.test(x.content)));
  c("testa: canonical /soluzioni", [{ rel: "canonical", href: "https://hair-genius-hub.hair/soluzioni" }], t.links.filter((l) => l.rel === "canonical"));
  vero("testa: i caratteri precaricati di S2 ci sono", t.links.some((l) => l.rel === "preload" && /anton/.test(l.href)));
  c("testa: descrizione normale", "Facciamo trapianto, patch e Invisible Derm. In consulenza gratuita, anche in videochiamata, ti diciamo quale serve davvero a te.", cerca(t, "name", "description")?.content);
  t = testa({ ...VUOTA, pubblicabile: true }, { apri: "invisible-derm" });
  c("testa: con ?apri la descrizione per gli annunci", "Che cos'è Invisible Derm: un sistema di capelli su misura, sottile e naturale, senza chirurgia. Te lo spiega il titolare in 30 secondi.", cerca(t, "name", "description")?.content);
  c("testa: titolo per la condivisione social", "Trapianto, patch o Invisible Derm? Li facciamo tutti e tre.", cerca(t, "property", "og:title")?.content);
  vero("testa: og:image assente se non c'è", !t.meta.some((x) => x.property === "og:image"));
  const OG = "https://progetto.supabase.co/storage/v1/object/public/landing-media/og.jpg";
  const conVideo = (poster) => ({ ...VUOTA, pubblicabile: true, ogImage: OG, video: { slot: { src: "", poster, alt: "Alt del poster" }, trascrizione: null } });
  t = testa(conVideo(OG));
  c("testa: og:image dalla vista, con l'alt della copertina quando l'immagine è la copertina", [OG, "Alt del poster"], [cerca(t, "property", "og:image")?.content, cerca(t, "property", "og:image:alt")?.content]);
  t = testa(conVideo("https://progetto.supabase.co/storage/v1/object/public/landing-media/poster.webp"));
  c("testa: se l'immagine di condivisione NON è la copertina, niente og:image:alt (non è il suo alt)", [OG, undefined], [cerca(t, "property", "og:image")?.content, cerca(t, "property", "og:image:alt")?.content]);
  vero("testa: senza dati della rotta (errore) non lancia", (() => { try { return !!testa(undefined).meta.length; } catch { return false; } })());

  /* ── La sorgente: nessun import vietato nella rotta ── */
  const rotta = leggi("src/routes/soluzioni.tsx");
  vero("rotta: nessun import del contenuto grezzo, né di MediaSlot, PlaceholderBox, useLandingContent, traccia-provvisoria", !/landing-content|MediaSlot|PlaceholderBox|useLandingContent|traccia-provvisoria|StickyHeader|BarraConsulenza/.test(rotta));
  vero("rotta: il 302 è temporaneo, mai 301", /statusCode:\s*302/.test(rotta) && !/\b301\b/.test(rotta.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
}

/* ── L'API dell'anteprima: codice breve per il CRM, mai il token nell'indirizzo ───────────────────── */
{
  const ACCESSO_FINTO = `
export const guardiaCRM = async (request, cors, permesso) => {
  (globalThis.__guardie ??= []).push(permesso);
  return globalThis.__sessione ? { ok: true, chi: {} } : { ok: false, risposta: new Response(JSON.stringify({ ok: false }), { status: 401, headers: cors }) };
};`;
  const DB_FINTO = `
export const supabaseAdmin = {
  from: (tabella) => ({
    select: () => ({ eq: (_c, chiave) => ({ maybeSingle: async () => { (globalThis.__letture ??= []).push([tabella, chiave]); if (globalThis.__dbGiu) throw new Error("db giù"); return { data: globalThis.__riga ?? null }; } }) }),
    upsert: async (riga, opzioni) => { (globalThis.__scritture ??= []).push([tabella, riga, opzioni]); if (globalThis.__dbGiu) throw new Error("db giù"); globalThis.__riga = { value: riga.value }; return { error: null }; },
  }),
};`;
  const A = await impacchetta(`export { Route } from ${rel("src/routes/api.crm.anteprima-soluzioni")};`, [
    [/\/api\.crm\.accesso$/, ACCESSO_FINTO],
    [/integrations\/supabase\/client\.server$/, DB_FINTO],
  ]);
  const gestori = A.Route.options.server.handlers;
  const chiedi = async (metodo = "POST") => {
    const risposta = await gestori[metodo]({ request: new Request("https://sito.test/api/crm/anteprima-soluzioni", { method: metodo, headers: { "X-CRM-Sessione": "x" } }) });
    return { stato: risposta.status, cache: risposta.headers.get("Cache-Control"), corpo: await risposta.json().catch(() => null) };
  };
  const rimetti = () => { globalThis.__guardie = []; globalThis.__scritture = []; globalThis.__letture = []; globalThis.__riga = null; globalThis.__dbGiu = false; globalThis.__sessione = true; };
  const FRA_UN_MINUTO = new Date(Date.now() + 60_000).toISOString();
  const IERI = new Date(Date.now() - 86_400_000).toISOString();
  const CODICE_B = "b".repeat(32);
  const FORMA = /^[0-9a-f]{32}$/;

  rimetti();
  globalThis.__sessione = false;
  let r = await chiedi();
  c("api: senza sessione del CRM 401 e non scrive né legge niente", [401, 0, 0], [r.stato, globalThis.__scritture.length, globalThis.__letture.length]);
  c("api: chiede il permesso della pagina Landing del CRM (marketing)", ["marketing"], globalThis.__guardie);

  rimetti();
  r = await chiedi();
  vero("api: con la sessione crea un codice di 32 caratteri esadecimali (crypto, non Math.random)", r.stato === 200 && r.corpo?.ok === true && FORMA.test(r.corpo?.codice));
  c("api: lo scrive in app_config sotto la chiave unica, con onConflict", ["app_config", "anteprima-soluzioni", { onConflict: "key" }], [globalThis.__scritture[0]?.[0], globalThis.__scritture[0]?.[1]?.key, globalThis.__scritture[0]?.[2]]);
  c("api: nel database c'è lo stesso codice e la scadenza (JSON), non il token di sessione", { codice: r.corpo?.codice, scade: r.corpo?.scade }, JSON.parse(globalThis.__scritture[0][1].value));
  vero("api: la scadenza è fra circa 30 minuti", Math.abs(Date.parse(r.corpo?.scade) - Date.now() - 30 * 60_000) < 5_000);
  vero("api: la risposta non si tiene in cache (no-store)", /no-store/.test(r.cache ?? ""));

  globalThis.__riga = { value: JSON.stringify({ codice: CODICE_B, scade: FRA_UN_MINUTO }) };
  globalThis.__scritture = [];
  r = await chiedi();
  c("api: se c'è già un codice ancora valido lo riusa (titolare e collaboratore non si annullano a vicenda)", [200, CODICE_B, 0], [r.stato, r.corpo?.codice, globalThis.__scritture.length]);

  globalThis.__riga = { value: JSON.stringify({ codice: CODICE_B, scade: IERI }) };
  r = await chiedi();
  vero("api: un codice scaduto si sostituisce", r.stato === 200 && r.corpo?.codice !== CODICE_B && globalThis.__scritture.length === 1);

  for (const rovinato of ["non è json", "null", "[]", JSON.stringify({ codice: 5 }), JSON.stringify({ codice: "corto", scade: FRA_UN_MINUTO })]) {
    globalThis.__riga = { value: rovinato };
    globalThis.__scritture = [];
    r = await chiedi();
    c(`api: riga illeggibile (${rovinato.slice(0, 12)}) → ne crea una nuova, nessuna eccezione`, [200, 1], [r.stato, globalThis.__scritture.length]);
  }
  rimetti();
  globalThis.__dbGiu = true;
  r = await chiedi();
  c("api: database giù → 500 con un motivo, mai un'eccezione né un codice finto", [500, false], [r.stato, r.corpo?.ok]);

  const api = leggi("src/routes/api.crm.anteprima-soluzioni.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  vero("api: la guardia viene prima di ogni accesso al database", api.indexOf("guardiaCRM(request") > -1 && api.indexOf("guardiaCRM(request") < api.indexOf("supabaseAdmin.from"));
  vero("api: il codice non nasce da Math.random", !/Math\.random/.test(api));
  vero("api: nessun GET (il codice non si legge con un indirizzo)", !/\bGET\s*:/.test(api));
}

finisci();
