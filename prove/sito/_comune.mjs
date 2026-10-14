/** Aiuti comuni delle prove del sito: confronto, impacchettamento con esbuild. */
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const qui = dirname(fileURLToPath(import.meta.url));
export const radice = join(qui, "..", "..");
const richiedi = createRequire(join(radice, "package.json"));
const esbuild = richiedi("esbuild");

export function leggi(rel) {
  return readFileSync(join(radice, rel), "utf8");
}

/** Una prova: `c(nome, atteso, ottenuto)` confronta, `finisci()` esce con 1 se qualcosa è rosso. */
export function nuovaProva(titolo) {
  let totale = 0;
  let fallite = 0;
  const c = (nome, atteso, ottenuto) => {
    totale++;
    const a = JSON.stringify(atteso);
    const o = JSON.stringify(ottenuto);
    if (a !== o) {
      fallite++;
      console.error(`  ✗ ${nome}\n      atteso:   ${a}\n      ottenuto: ${o}`);
    }
  };
  const vero = (nome, cond) => c(nome, true, !!cond);
  const finisci = () => {
    if (fallite) {
      console.error(`✗ ${titolo}: ${fallite} su ${totale} controlli falliti`);
      process.exit(1);
    }
    console.log(`✓ ${titolo}: ${totale} controlli`);
  };
  return { c, vero, finisci };
}

//  Una cartella per ogni lancio, cancellata alla fine: due worktree che provano insieme non si pestano i file.
//  realpath: su macOS /var è un collegamento a /private/var, e senza esbuild carica il finto due volte.
const dove = realpathSync(mkdtempSync(join(tmpdir(), "prove-sito-c-")));
process.on("exit", () => rmSync(dove, { recursive: true, force: true }));

/** Quanto di `src/landing/booking/tracking` serve alle prove: registra le chiamate. */
const TRACKING_FINTO = `
export const chiamate = { trackEvent: [], firePixel: [], fireCapi: [], captureSourceData: [], avviati: [] };
let n = 0;
export const eventId = () => "evt-finto-" + (++n);
export const trackEvent = async (...a) => { chiamate.trackEvent.push(a); };
export const firePixel = (...a) => { chiamate.firePixel.push(a); };
export const fireCapi = async (...a) => { chiamate.fireCapi.push(a); };
export const initAdminCheck = () => Promise.resolve(false);
export const isAdminLogged = () => false;
export const subscribeAdminStatus = (f) => { f(false); return () => {}; };
export const initHeartbeat = () => { chiamate.avviati.push("initHeartbeat"); return () => {}; };
export const initLivePresence = () => { chiamate.avviati.push("initLivePresence"); return () => {}; };
export const initScrollTracking = () => { chiamate.avviati.push("initScrollTracking"); return () => {}; };
export const initClickTracking = () => { chiamate.avviati.push("initClickTracking"); return () => {}; };
export const initHighQualityVisit = () => () => {};
export const captureSourceData = () => { chiamate.captureSourceData.push(1); return { utm_source: "prova" }; };
export const buildJourneySnapshot = () => ({ touch_history: [], touch_count: 0, first_channel: null, last_channel: null, journey_type: "cold_direct", days_to_convert: 0, hours_to_convert: 0 });
export const detectSource = () => "organic";
`;

/** Impacchetta un file del progetto (alias `@` = src) e lo carica. Il tracking vero e il client Supabase sono sostituiti da finti. */
export async function carica(sorgenteRel, nome, { reactFinto = false, reactVero = false, routerFinto = false } = {}) {
  const trackingFinto = join(dove, "tracking-finto.js");
  writeFileSync(trackingFinto, TRACKING_FINTO);
  const clientFinto = join(dove, "client-finto.js");
  writeFileSync(clientFinto, "export const supabase = {};");
  //  React finto (solo se serve): gli effetti girano subito, così si prova un gancio senza schermo.
  const reactFinto_ = join(dove, "react-finto.js");
  writeFileSync(
    reactFinto_,
    `export const chiusure = [];
export const useEffect = (f) => { const c = f(); if (typeof c === "function") chiusure.push(c); };
export const useState = (v) => [v, () => {}];
export class Component { constructor(props) { this.props = props; this.state = {}; } setState() {} }`,
  );
  //  Router finto (solo se serve): `Link` diventa un `<a href>`, così un componente con collegamenti si disegna senza router.
  const routerFinto_ = join(dove, "router-finto.js");
  writeFileSync(routerFinto_, `import { createElement } from "react";\nexport const Link = ({ to, children, ...resto }) => createElement("a", { href: to, ...resto }, children);\n`);
  const fuori = join(dove, `${nome}.cjs`);
  //  Entrata di prova: il file vero + il registro delle chiamate del tracking finto.
  const entrata = join(dove, `${nome}-entrata.ts`);
  writeFileSync(
    entrata,
    `export * from ${JSON.stringify(join(radice, sorgenteRel))};\nexport { chiamate } from ${JSON.stringify(trackingFinto)};\n${reactFinto ? `export { chiusure } from ${JSON.stringify(reactFinto_)};\n` : ""}`,
  );
  await esbuild.build({
    entryPoints: [entrata],
    outfile: fuori,
    bundle: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    //  Le immagini importate dai componenti (il logo) diventano un testo qualunque: qui si guarda il codice, non il disegno.
    loader: { ".png": "dataurl", ".webp": "dataurl", ".svg": "dataurl" },
    logLevel: "error",
    absWorkingDir: radice,
    alias: { "@": join(radice, "src") },
    plugins: [
      {
        name: "finti",
        setup(b) {
          b.onResolve({ filter: /(^|\/)tracking$/ }, () => ({ path: trackingFinto }));
          //  React vero ma UNO solo (quello del progetto, lo stesso che usa la prova): fuori dal pacchetto.
          if (reactVero) b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, (a) => ({ path: richiedi.resolve(a.path), external: true }));
          if (routerFinto) b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: routerFinto_ }));
          if (reactFinto) b.onResolve({ filter: /^react$/ }, () => ({ path: reactFinto_ }));
          b.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, () => ({ path: clientFinto }));
        },
      },
    ],
  });
  return createRequire(import.meta.url)(fuori);
}
