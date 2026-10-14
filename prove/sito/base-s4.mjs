/** ── PROVA S4.0 · LE BASI CHE SERVONO AGLI ALTRI ───────────────────────────
 *  Quattro cose, tutte sul codice vero:
 *   1. il caricatore delle immagini di `_comune.mjs` (il logo del Footer si disegna);
 *   2. `togliFrasiAmmesse`: le sole frasi che le scansioni delle parole vietate lasciano passare;
 *   3. `stato-pagina.ts`: il video che gira e il foglio aperto, letti dalla barra;
 *   4. `prove.mjs`: cartella temporanea unica per lancio (due worktree insieme non si pestano).
 *  ───────────────────────────────────────────────────────────────────────── */
import { createRequire } from "node:module";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carica, leggi, nuovaProva, radice } from "./_comune.mjs";
import { FRASI_AMMESSE, togliFrasiAmmesse } from "./_frasi-ammesse.mjs";

const { c, vero, finisci } = nuovaProva("base S4.0");
const richiedi = createRequire(join(radice, "package.json"));

/* ── 1. Il Footer di oggi si disegna: il logo (.png) diventa un testo ──── */
{
  const F = await carica("src/components/landing/Footer.tsx", "footer-s4", { reactVero: true, routerFinto: true });
  const html = richiedi("react-dom/server").renderToStaticMarkup(richiedi("react").createElement(F.Footer));
  vero("Footer: si disegna col logo importato", /<img[^>]*src="data:image\/png;base64,/.test(html));
  vero("Footer di oggi: promessa, indirizzo e P.IVA", html.includes("Indistinguibile dalla cute.") && html.includes("P.IVA 18486531009"));
}

/* ── 2. Le frasi ammesse sono esatte, e solo quelle ────────────────────── */
const LIMITE = "E non cura la caduta: la copre.";
c("la frase del limite è ammessa", true, FRASI_AMMESSE.includes(LIMITE));
c("senza la frase del limite non resta niente da leggere", "Vuole manutenzione, circa 10 minuti.  Meglio che lo sai prima.", togliFrasiAmmesse(`Vuole manutenzione, circa 10 minuti. ${LIMITE} Meglio che lo sai prima.`));
vero("tolta la frase, «cura» non c'è più", !/\bcura/i.test(togliFrasiAmmesse(`3. Il limite vero. ${LIMITE}`)));
//  Una variante NON è ammessa: la scansione deve ancora vederla.
for (const v of ["Non cura la caduta, la copre.", "E non cura la caduta.", "È la cura per la caduta.", "La nostra cura: la copre.", "E cura la caduta: la copre."]) {
  vero(`non ammessa: «${v}»`, /\bcura/i.test(togliFrasiAmmesse(v)));
}
vero("«solo noi» resta vietato anche con la frase accanto", /solo noi/i.test(togliFrasiAmmesse(`Solo noi. ${LIMITE}`)));
vero("l'etichetta «Solo da noi» è ammessa", FRASI_AMMESSE.includes("Solo da noi"));
vero("la riga 5 («in esclusiva») è ammessa", FRASI_AMMESSE.some((f) => f.includes("in esclusiva")));
c("tre frasi e non una di più", 3, FRASI_AMMESSE.length);

/* ── 3. Lo stato della pagina (video che gira, foglio aperto) ──────────── */
{
  const sorgente = "src/landing/sito/soluzioni/stato-pagina.ts";
  const codice = leggi(sorgente);
  vero("esporta segnaVideo, segnaFoglio, usaStatoPagina", ["segnaVideo", "segnaFoglio", "usaStatoPagina"].every((n) => new RegExp(`export (function|const) ${n}\\b`).test(codice)));
  vero("usa useSyncExternalStore", /useSyncExternalStore/.test(codice));

  //  Sul server: sempre «niente gira, niente aperto», qualunque cosa abbia segnato una richiesta prima.
  const S = await carica(sorgente, "stato-pagina-server", { reactVero: true });
  const { renderToStaticMarkup } = richiedi("react-dom/server");
  const { createElement } = richiedi("react");
  const Mostra = () => createElement("i", null, JSON.stringify(S.usaStatoPagina()));
  S.segnaVideo(true);
  S.segnaFoglio(true);
  c("server: lo stato di una richiesta non passa alla successiva", '<i>{"videoGira":false,"foglioAperto":false}</i>', renderToStaticMarkup(createElement(Mostra)).replace(/&quot;/g, '"'));

  //  Sul browser: React finto che legge lo snapshot e registra gli abbonati.
  //  realpath: su macOS /var è un collegamento a /private/var, e senza esbuild carica il finto due volte.
  const dove = realpathSync(mkdtempSync(join(tmpdir(), "prove-stato-pagina-")));
  try {
    writeFileSync(join(dove, "react-finto.js"), "export const abbonati = [];\nexport const useSyncExternalStore = (iscriviti, leggiSnapshot) => { abbonati.push(iscriviti); return leggiSnapshot(); };\n");
    writeFileSync(join(dove, "entrata.ts"), `export * from ${JSON.stringify(join(radice, sorgente))};\nexport { abbonati } from "./react-finto.js";\n`);
    await richiedi("esbuild").build({
      entryPoints: [join(dove, "entrata.ts")], outfile: join(dove, "fuori.cjs"), bundle: true, format: "cjs", platform: "node", logLevel: "error", absWorkingDir: radice,
      plugins: [{ name: "react-finto", setup: (b) => b.onResolve({ filter: /^react$/ }, () => ({ path: join(dove, "react-finto.js") })) }],
    });
    const B = createRequire(import.meta.url)(join(dove, "fuori.cjs"));
    const prima = B.usaStatoPagina();
    c("browser: all'inizio niente gira, niente aperto", { videoGira: false, foglioAperto: false }, prima);
    vero("lo stato uguale resta lo stesso oggetto (niente giri a vuoto)", B.usaStatoPagina() === prima);
    let avvisi = 0;
    const iscriviti = B.abbonati[0];
    const smetti = iscriviti(() => avvisi++);
    B.segnaVideo(true);
    c("video in riproduzione", { videoGira: true, foglioAperto: false }, B.usaStatoPagina());
    B.segnaVideo(true);
    c("lo stesso valore non avvisa di nuovo", 1, avvisi);
    B.segnaFoglio(true);
    c("foglio aperto, video che gira", { videoGira: true, foglioAperto: true }, B.usaStatoPagina());
    B.segnaVideo(false);
    B.segnaFoglio(false);
    c("tornano tutti e due a false", { videoGira: false, foglioAperto: false }, B.usaStatoPagina());
    c("un avviso per ogni cambio vero", 4, avvisi);
    smetti();
    B.segnaVideo(true);
    c("chi smette di ascoltare non è più avvisato", 4, avvisi);
    B.segnaVideo(false);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}

/* ── 4. `prove.mjs`: cartella unica per lancio, e la scansione usa le frasi ammesse ── */
{
  const p = leggi("prove/prove.mjs");
  vero("cartella temporanea con mkdtempSync", /const dove = mkdtempSync\(join\(tmpdir\(\), "prove-contabilita-"\)\)/.test(p));
  vero("non più la cartella fissa «prove-contabilita»", !/join\(tmpdir\(\), "prove-contabilita"\)/.test(p));
  vero("cancellata a fine prova", /rmSync\(dove, \{ recursive: true, force: true \}\);\nprocess\.exit\(rotti/.test(p));
  vero("la scansione dei testi nuovi toglie le frasi ammesse", /togliFrasiAmmesse\(senzaCommenti\(leggi\(f\)\)\)/.test(p));
}

finisci();
