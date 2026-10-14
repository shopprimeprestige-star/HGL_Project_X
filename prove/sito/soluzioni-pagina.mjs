/** ── PROVE DI /soluzioni · PAGINA, TAVOLA, SPIEGAZIONE, ROTTA E API (compiti S3.1-S3.3) ─────────────
 *  `node prove/sito/soluzioni-pagina.mjs`. Disegna sul server i componenti veri (`renderToStaticMarkup`) con una
 *  `VistaSoluzioni` costruita qui, e guarda l'HTML: cosa c'è, cosa non c'è, in che ordine. Il comportamento nel
 *  browser (apertura, fuoco, Esc, barra, foglio) lo prova Playwright in S4.5.
 *  Le parti di S1, S2 e S4 entrano da `ponte.ts` / `ponte-ui.tsx`: qui non si guarda come sono disegnate,
 *  ma solo ciò che decide S3 (struttura, ordine, regole).
 *  ───────────────────────────────────────────────────────────────────────────────────────────────── */
import { createRequire } from "node:module";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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
  const file = (nome, codice) => {
    const p = join(dove, nome);
    writeFileSync(p, codice);
    return p;
  };
  const tracking = file(`tracking-${n}.js`, TRACKING_FINTO);
  const router = file(`router-${n}.js`, ROUTER_FINTO);
  const client = file(`client-${n}.js`, "export const supabase = {};");
  const sostituti = finti.map(([filtro, codice], i) => [filtro, file(`finto-${n}-${i}.ts`, codice)]);
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
          for (const [filtro, percorso] of sostituti) b.onResolve({ filter: filtro }, () => ({ path: percorso }));
          b.onResolve({ filter: /(^|\/)tracking$/ }, () => ({ path: tracking }));
          b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: router }));
          b.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, () => ({ path: client }));
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
export const tavola = (p) => renderToStaticMarkup(h(TavolaSoluzioni, { aperta: false, onAlterna: no, onPrenota: no, bottoneRef: { current: null }, cellaRef: { current: null }, ...p }));
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

/* ═══ S3.2 · LA SPIEGAZIONE «CHE COS'È INVISIBLE DERM?» ═══════════════════════════════════════════ */
{
  const m = await impacchetta(
    `${PRELUDIO}
import { SpiegazioneInvisible } from ${rel("src/landing/sito/soluzioni/SpiegazioneInvisible")};
const no = () => {};
const stato = (aperta, montata) => ({ aperta, montata, chiudi: no, apri: no, alterna: no, titoloRef: { current: null }, bottoneRef: { current: null }, cellaRef: { current: null } });
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
  vero("aperta: il video del titolare (copertina) e la clip ci sono", aperta.includes("video-poster.webp") && /<video[\s>]/.test(aperta) && aperta.includes("data-src=\"https://progetto.supabase.co/storage/v1/object/public/landing-media/macro.webp\""));
  vero("aperta: la clip ha la sua descrizione e la didascalia dei testi", aperta.includes(PIENA.macro.alt) && testoVisibile(aperta).includes(E.macro.didascalia));
  vero("aperta: la trascrizione (se c'è) è nell'HTML come testo", testoVisibile(aperta).includes("Le parole dette davvero."));

  /* ── L'ordine della 3.2: titolo → prima riga → video → macro → righe → limite → piccole → passo → chiudi ── */
  const ordine = [E.titolo, E.primaRiga, 'alt="Alt di video"', "<video", E.righe[0].testo, E.righe[1].testo, E.righe[2].testo, E.piccole[0].testo, E.piccole[1].testo, E.passo.bottone, E.passo.riga, E.passo.chiudi];
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
  vero("passo: il bordo del bottone blu sul chiaro è #0B5FB0 (mai #0F90FE per il testo)", /<button[^>]*data-ruolo="primario"[^>]*class="[^"]*border-\[var\(--hgl-elettrico-su-chiaro,#0B5FB0\)\]/.test(aperta));
  vero("«Chiudi la spiegazione» in fondo è un link d'azione (bottone senza href)", /<button[^>]*data-ruolo="link"[^>]*>\s*Chiudi la spiegazione/.test(aperta));

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
  vero("anteprima pubblicabile: nessuna riga tratteggiata", !/border-dashed/.test(m.spiegazione(true, true, { ...PIENA, anteprima: true })));

  /* ── Il testo che arriva dal CRM (trascrizione, alt) resta testo: mai HTML ── */
  const ostile = m.spiegazione(true, true, { ...PIENA, video: { slot: { ...PIENA.video.slot, alt: 'x" onerror="alert(1)' }, trascrizione: "</script><img src=x onerror=alert(1)>" } });
  vero("la trascrizione ostile non diventa HTML (</script><img … onerror> è scritto come testo)", !ostile.includes("<img src=x") && !ostile.includes("</script><img") && ostile.includes("&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;"));
  vero("l'alt ostile non esce dall'attributo (nessun tag ha un attributo onerror)", !/<[^>]+\sonerror=/.test(ostile.replace(/"[^"]*"/g, '""')) && ostile.includes("&quot; onerror=&quot;alert(1)"));
}

finisci();
