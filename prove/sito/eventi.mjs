/** ── PROVA C2 · GLI EVENTI DEL SITO (nomi fissi, nessun dato personale) ────
 *  `src/landing/sito/eventi.ts` e `traccia.ts`.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createRequire } from "node:module";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carica, leggi, nuovaProva, radice } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("eventi del sito");
const E = await carica("src/landing/sito/eventi.ts", "eventi");

//  Copiati dalla SPEC («Cosa si misura»): se cambia l'elenco, cambia qui apposta.
const DA_SPEC = [
  "vista_pagina", "scroll_50", "click_bottone", "modulo_inizio", "modulo_errore", "modulo_invio",
  "meetly_aperto", "consulenza_prenotata", "scelta_percorso",
  "stock_vista_scheda", "stock_box_visto", "stock_aggiungi_carrello", "stock_inizio_cassa",
  "consulenza_barra_vista", "consulenza_barra_click", "consulenza_barra_chiusa",
  "consulenza_pannello_aperto", "consulenza_problema_scelto", "consulenza_popup_mostrato",
  "consulenza_popup_click", "consulenza_modulo_inizio", "consulenza_modulo_invio",
];
//  Landing «Tre soluzioni» (SPEC landing v3, «Cosa si misura»): 10 nomi nuovi, solo aggiunte.
const SOLUZIONI = [
  "video_play", "video_50", "video_fine", "invisible_apri", "invisible_video_play", "invisible_video_50",
  "modulo_apri", "card_patch_clic", "barra_shop_clic", "soluzioni_cancello",
];
c("EVENTI_SITO = elenco della SPEC + i 10 della landing «Tre soluzioni»", [...DA_SPEC, ...SOLUZIONI].sort(), [...E.EVENTI_SITO].sort());
c("i primi 22 nomi restano al loro posto (solo aggiunte in fondo)", DA_SPEC, E.EVENTI_SITO.slice(0, DA_SPEC.length));
for (const nome of SOLUZIONI) vero(`ammesso: ${nome}`, E.EVENTI_SITO.includes(nome));
c("nessun nome doppio", E.EVENTI_SITO.length, new Set(E.EVENTI_SITO).size);
vero("niente stock_acquisto né stock_abbandono_carrello (fase 2)", !E.EVENTI_SITO.some((n) => /acquisto|abbandono/.test(n)));

/* ── Dettagli ammessi ──────────────────────────────────────────────────── */
c("DETTAGLI_AMMESSI", ["bottone", "sezione", "percorso", "campo", "voce", "motivo", "origine", "punto", "variante", "pagina", "interesse"], [...E.DETTAGLI_AMMESSI]);
for (const v of ["trapianto", "invisible-derm", "non-so"]) c(`interesse «${v}» passa`, { interesse: v }, E.ripulisciDettagli({ interesse: v }));
c("un telefono in «interesse» non passa", {}, E.ripulisciDettagli({ interesse: "333 1234567" }));
c("un'email in «interesse» non passa", {}, E.ripulisciDettagli({ interesse: "mario@esempio.it" }));
c("«interesse» lungo non passa", {}, E.ripulisciDettagli({ interesse: "x".repeat(80) }));
c("il video del titolare si distingue con «voce»", { voce: "invisibleVideo" }, E.ripulisciDettagli({ voce: "invisibleVideo" }));
c("il cancello si distingue con «voce»", { voce: "cancello", pagina: "/soluzioni" }, E.ripulisciDettagli({ voce: "cancello", pagina: "/soluzioni" }));
c("«origine» dell'apertura (tocco, link, ricerca) passa", ["tocco", "link", "ricerca"], ["tocco", "link", "ricerca"].filter((o) => E.ripulisciDettagli({ origine: o }).origine === o));
c("nome e telefono non passano, voce sì", { voce: "tenuta" }, E.ripulisciDettagli({ nome: "x", telefono: "3", voce: "tenuta" }));
c("email, testo libero e altre chiavi non passano", { campo: "telefono" }, E.ripulisciDettagli({ email: "a@b.it", testo: "ciao", problemaAltro: "ciao", note: "n", campo: "telefono" }));
c("valori vuoti o non semplici scartati", {}, E.ripulisciDettagli({ voce: undefined, motivo: null, punto: { a: 1 }, bottone: ["x"] }));
c("numeri e booleani semplici passano", { sezione: "hero", variante: "B" }, E.ripulisciDettagli({ sezione: "hero", variante: "B" }));
c("un valore lungo non passa (potrebbe essere testo libero)", {}, E.ripulisciDettagli({ voce: "x".repeat(200) }));
c("un numero di telefono nascosto in un valore ammesso non passa", {}, E.ripulisciDettagli({ voce: "333 1234567", campo: "3331234567" }));
c("un indirizzo email in un valore ammesso non passa", {}, E.ripulisciDettagli({ voce: "mario@esempio.it" }));
c("input non oggetto → vuoto", {}, E.ripulisciDettagli(undefined));
c("la pagina (percorso) passa", { pagina: "/protocol" }, E.ripulisciDettagli({ pagina: "/protocol" }));

/* ── Nome dell'evento del modulo, per le due origini ───────────────────── */
for (const [azione, consulenza, stock] of [
  ["inizio", "modulo_inizio", "consulenza_modulo_inizio"],
  ["errore", "modulo_errore", null],
  ["invio", "modulo_invio", "consulenza_modulo_invio"],
  ["calendario", "meetly_aperto", "meetly_aperto"],
  ["prenotata", "consulenza_prenotata", "consulenza_prenotata"],
]) {
  c(`consulenza · ${azione}`, consulenza, E.nomeEventoModulo("consulenza", azione));
  c(`stock · ${azione}`, stock, E.nomeEventoModulo("stock", azione));
  vero(`i nomi di ${azione} stanno nell'elenco`, [consulenza, stock].filter(Boolean).every((n) => E.EVENTI_SITO.includes(n)));
}

/* ── Test A/B del bottone ──────────────────────────────────────────────── */
c("spento → sempre A (anche con una B salvata)", ["A", "A", "A"], [E.varianteBottone(false, null, () => 0.9), E.varianteBottone(false, "B", () => 0.9), E.varianteBottone(false, "A", () => 0.1)]);
c("acceso con salvata → stabile", ["B", "A"], [E.varianteBottone(true, "B", () => 0.1), E.varianteBottone(true, "A", () => 0.9)]);
c("acceso, salvata rotta → si estrae di nuovo", ["A", "B"], [E.varianteBottone(true, "zzz", () => 0.2), E.varianteBottone(true, "zzz", () => 0.8)]);
{
  let a = 0;
  for (let i = 0; i < 1000; i++) if (E.varianteBottone(true, null, () => i / 1000) === "A") a++;
  vero(`metà e metà su 1000 estrazioni a griglia (A=${a})`, a >= 450 && a <= 550);
  let seme = 12345;
  const casuale = () => ((seme = (seme * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let b = 0;
  for (let i = 0; i < 1000; i++) if (E.varianteBottone(true, null, casuale) === "A") b++;
  vero(`metà e metà su 1000 estrazioni pseudo-casuali (A=${b})`, b >= 450 && b <= 550);
}

/* ── traccia(): l'involucro ────────────────────────────────────────────── */
{
  const T = await carica("src/landing/sito/traccia.ts", "traccia");
  globalThis.window = { location: { pathname: "/protocol" }, sessionStorage: { getItem: () => null, setItem() {} } };
  T.traccia("modulo_invio", { nome: "Mario", telefono: "3331234567", voce: "tenuta", problemaAltro: "ciao" });
  await new Promise((r) => setTimeout(r, 20));
  const ultima = T.chiamate.trackEvent.at(-1);
  c("traccia: nome dell'evento", "modulo_invio", ultima?.[0]);
  c("traccia: solo dettagli ammessi, più la pagina", { voce: "tenuta", pagina: "/protocol" }, ultima?.[2]);
  vero("traccia: nessun nome né telefono nel dettaglio", !JSON.stringify(ultima ?? []).match(/Mario|3331234567|ciao/));
  T.traccia("evento_non_in_elenco");
  await new Promise((r) => setTimeout(r, 20));
  c("traccia: un evento fuori elenco non parte", 1, T.chiamate.trackEvent.length);
  delete globalThis.window;
}
/* ── usaTracciamentoPagina: le pagine nuove non montano BookingFunnel ──── */
{
  const T = await carica("src/landing/sito/traccia.ts", "traccia-pagina", { reactFinto: true });
  const ascoltatori = [];
  globalThis.window = {
    location: { pathname: "/protocol" },
    sessionStorage: { getItem: () => null, setItem() {} },
    scrollY: 0,
    innerHeight: 800,
    addEventListener: (n, f) => ascoltatori.push([n, f]),
    removeEventListener() {},
  };
  globalThis.document = { body: { scrollHeight: 2000 }, documentElement: { scrollHeight: 2000 } };
  T.usaTracciamentoPagina("protocol");
  c("la fonte (utm, fbclid) si salva subito, al montaggio", 1, T.chiamate.captureSourceData.length);
  await new Promise((r) => setTimeout(r, 20));
  c("PageView di Meta (Pixel) una volta, con un id", ["PageView", true], [T.chiamate.firePixel[0]?.[0], typeof T.chiamate.firePixel[0]?.[2] === "string"]);
  c("PageView di Meta (CAPI) con lo stesso id del Pixel", T.chiamate.firePixel[0]?.[2], T.chiamate.fireCapi[0]?.[1]);
  const pv = T.chiamate.trackEvent.find((x) => x[0] === "PageView");
  c("PageView di lp_events come la home di oggi (Visita_Landing)", [0, "Visita_Landing", "protocol"], [pv?.[1], pv?.[2]?.custom_event, pv?.[2]?.pagina]);
  c("vista_pagina una volta", 1, T.chiamate.trackEvent.filter((x) => x[0] === "vista_pagina").length);
  c("nessun scroll_50 prima di scorrere", 0, T.chiamate.trackEvent.filter((x) => x[0] === "scroll_50").length);
  globalThis.window.scrollY = 1000;
  ascoltatori.filter(([n]) => n === "scroll").forEach(([, f]) => f());
  await new Promise((r) => setTimeout(r, 20));
  c("Scroll e Click come la home di oggi, una volta sola per pagina", [1, 1], [T.chiamate.avviati.filter((x) => x === "initScrollTracking").length, T.chiamate.avviati.filter((x) => x === "initClickTracking").length]);
  c("scroll_50 a metà pagina", 1, T.chiamate.trackEvent.filter((x) => x[0] === "scroll_50").length);
  delete globalThis.window;
  delete globalThis.document;
}
/* ── Smontata prima che il controllo amministratore risponda ──────────── */
{
  const T = await carica("src/landing/sito/traccia.ts", "traccia-smontata", { reactFinto: true });
  const ascoltatori = [];
  globalThis.window = {
    location: { pathname: "/protocol" },
    sessionStorage: { getItem: () => null, setItem() {} },
    scrollY: 0,
    innerHeight: 800,
    addEventListener: (n, f) => ascoltatori.push([n, f]),
    removeEventListener() {},
  };
  globalThis.document = { body: { scrollHeight: 2000 }, documentElement: { scrollHeight: 2000 } };
  T.usaTracciamentoPagina("protocol");
  T.chiusure.forEach((chiudi) => chiudi()); // la pagina si smonta subito (StrictMode, cambio pagina)
  await new Promise((r) => setTimeout(r, 20));
  c("smontata prima della risposta: nessun ascoltatore resta attaccato", [0, []], [ascoltatori.length, T.chiamate.avviati]);
  c("smontata prima della risposta: nessun PageView parte", 0, T.chiamate.firePixel.length);
  delete globalThis.window;
  delete globalThis.document;
}
//  Percorsi lunghi con la data dentro (/blog/2026-10-14-…) non sono telefoni.
c("pagina con la data nel percorso passa", { pagina: "/blog/2026-10-14-capelli" }, E.ripulisciDettagli({ pagina: "/blog/2026-10-14-capelli" }));
c("percorso con molte cifre passa se inizia con /", { percorso: "/shop/prodotto/thin-skin-003" }, E.ripulisciDettagli({ percorso: "/shop/prodotto/thin-skin-003" }));
c("un telefono in «pagina» non passa", {}, E.ripulisciDettagli({ pagina: "3331234567" }));
vero("traccia.ts non scrive in localStorage", !/localStorage/.test(leggi("src/landing/sito/traccia.ts").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")));

/* ── Anteprima dal CRM: il codice non deve mai arrivare a Meta ─────────────
 *  `/soluzioni?anteprima=<codice>`: nessun evento, nessun Pixel, nessun CAPI, nessun PageView. */
{
  for (const [search, atteso] of [["?anteprima=abc", true], ["anteprima=abc", true], ["?utm_source=ig&anteprima=abc", true], ["?anteprima=", true], ["?apri=invisible-derm", false], ["?x=anteprima", false], ["?anteprima2=1", false], ["", false], [undefined, false], [null, false], [5, false]])
    c(`inAnteprima(${JSON.stringify(search)})`, atteso, E.inAnteprima(search));
  const T = await carica("src/landing/sito/traccia.ts", "traccia-anteprima", { reactFinto: true });
  const finestra = (search) => {
    globalThis.window = { location: { pathname: "/soluzioni", search }, sessionStorage: { getItem: () => null, setItem() {} }, scrollY: 0, innerHeight: 800, addEventListener() {}, removeEventListener() {} };
    globalThis.document = { body: { scrollHeight: 2000 }, documentElement: { scrollHeight: 2000 } };
  };
  const azzera = () => { for (const k of Object.keys(T.chiamate)) T.chiamate[k].length = 0; T.chiusure.length = 0; };
  const attendi = () => new Promise((r) => setTimeout(r, 20));
  finestra("?anteprima=abcdef0123456789");
  azzera();
  T.traccia("modulo_apri", { interesse: "trapianto" });
  T.traccia("video_play", { voce: "invisibleVideo" });
  T.usaTracciamentoPagina("/soluzioni");
  await attendi();
  c("in anteprima: nessun evento, nessun Pixel, nessun CAPI, nessun PageView, nessun ascoltatore", { trackEvent: 0, firePixel: 0, fireCapi: 0, captureSourceData: 0, avviati: 0 }, Object.fromEntries(Object.keys(T.chiamate).map((k) => [k, T.chiamate[k].length])));
  vero("in anteprima la pulizia dell'effetto c'è e non lancia", T.chiusure.every((x) => (x?.(), true)));
  //  Senza anteprima (con altri parametri) tutto parte come prima.
  finestra("?utm_source=ig&apri=invisible-derm");
  azzera();
  T.traccia("modulo_apri", { interesse: "trapianto" });
  T.usaTracciamentoPagina("/soluzioni");
  await attendi();
  vero("senza anteprima: gli eventi partono", T.chiamate.trackEvent.some((x) => x[0] === "modulo_apri") && T.chiamate.firePixel.length > 0);
  //  Finestra senza `search` (le prove di sopra, i browser strani): conta come niente anteprima.
  globalThis.window = { location: { pathname: "/x" }, sessionStorage: { getItem: () => null, setItem() {} } };
  azzera();
  T.traccia("modulo_apri", {});
  await attendi();
  c("location senza search: l'evento parte", 1, T.chiamate.trackEvent.length);
  delete globalThis.window;
  delete globalThis.document;
}

/* ── S1.3 · il tracciamento non rompe mai la pagina ────────────────────────
 *  Nella realtà la causa è `sessionStorage.getItem` non protetto dentro `tracking.ts`
 *  (modalità privata di Safari): `initAdminCheck` e `captureSourceData` lanciano.
 *  Qui un `tracking` finto che lancia (o rifiuta) quando glielo si chiede. */
{
  const dove = realpathSync(mkdtempSync(join(tmpdir(), "prove-eventi-rotto-")));
  process.on("exit", () => rmSync(dove, { recursive: true, force: true }));
  const esbuild = createRequire(join(radice, "package.json"))("esbuild");
  const trackingRotto = join(dove, "tracking-rotto.js");
  writeFileSync(
    trackingRotto,
    `const rompi = () => globalThis.__rompi;
export const eventId = () => "e";
export const trackEvent = async () => { globalThis.__eventi.push("trackEvent"); };
export const firePixel = () => { globalThis.__eventi.push("firePixel"); };
export const fireCapi = async () => {};
export const initAdminCheck = () => {
  if (rompi() === "iniz-sync") throw new Error("sessionStorage bloccato");
  if (rompi() === "iniz-async") return Promise.reject(new Error("rifiutata"));
  return Promise.resolve(false);
};
export const subscribeAdminStatus = () => { if (rompi() === "iscrizione") throw new Error("rotta"); return () => { globalThis.__eventi.push("smesso"); }; };
export const captureSourceData = () => { if (rompi() === "fonte") throw new Error("sessionStorage bloccato"); return {}; };
export const initHeartbeat = () => () => {};
export const initLivePresence = () => () => {};
export const initScrollTracking = () => () => {};
export const initClickTracking = () => () => {};
export const initHighQualityVisit = () => () => {};
`,
  );
  const reactFinto = join(dove, "react-finto.js");
  writeFileSync(reactFinto, `export const useEffect = (f) => { const c = f(); globalThis.__chiusure.push(c); };\nexport const useState = (v) => [v, () => {}];`);
  const entrata = join(dove, "entrata.ts");
  writeFileSync(entrata, `export * from ${JSON.stringify(join(radice, "src/landing/sito/traccia.ts"))};`);
  await esbuild.build({
    entryPoints: [entrata],
    outfile: join(dove, "traccia-rotta.cjs"),
    bundle: true,
    format: "cjs",
    platform: "node",
    logLevel: "error",
    absWorkingDir: radice,
    alias: { "@": join(radice, "src") },
    plugins: [
      {
        name: "finti",
        setup(b) {
          b.onResolve({ filter: /(^|\/)tracking$/ }, () => ({ path: trackingRotto }));
          b.onResolve({ filter: /^react$/ }, () => ({ path: reactFinto }));
          b.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, () => ({ path: trackingRotto }));
        },
      },
    ],
  });
  const T = createRequire(import.meta.url)(join(dove, "traccia-rotta.cjs"));
  const nonGestite = [];
  const registra = (e) => nonGestite.push(String(e?.message ?? e));
  process.on("unhandledRejection", registra);
  const finestra = () => {
    globalThis.window = { location: { pathname: "/soluzioni" }, sessionStorage: { getItem() { throw new Error("bloccata"); }, setItem() { throw new Error("bloccata"); } }, addEventListener() {}, removeEventListener() {}, scrollY: 0, innerHeight: 800 };
    globalThis.document = { body: { scrollHeight: 2000 }, documentElement: { scrollHeight: 2000 } };
    globalThis.__eventi = [];
    globalThis.__chiusure = [];
  };
  const prova = async (nome, rompi, fn) => {
    finestra();
    globalThis.__rompi = rompi;
    let lanciata = null;
    try { await fn(); } catch (e) { lanciata = e?.message ?? String(e); }
    await new Promise((r) => setTimeout(r, 20));
    c(`${nome}: nessuna eccezione`, null, lanciata);
  };
  await prova("traccia con sessionStorage che lancia (e tracking sano)", "", () => T.traccia("modulo_apri", { interesse: "trapianto" }));
  await prova("traccia con initAdminCheck che lancia subito", "iniz-sync", () => T.traccia("modulo_apri", { interesse: "trapianto" }));
  await prova("traccia con initAdminCheck che rifiuta", "iniz-async", () => T.traccia("modulo_apri", { interesse: "trapianto" }));
  c("nessuna promessa rifiutata rimasta senza gestione (traccia)", [], nonGestite);
  await prova("pagina: captureSourceData che lancia", "fonte", () => T.usaTracciamentoPagina("soluzioni"));
  c("pagina: l'effetto restituisce comunque la sua pulizia", "function", typeof globalThis.__chiusure[0]);
  await prova("pagina: la pulizia non lancia", "fonte", () => globalThis.__chiusure[0]?.());
  await prova("pagina: initAdminCheck che lancia subito", "iniz-sync", () => T.usaTracciamentoPagina("soluzioni"));
  c("pagina: pulizia presente anche qui", "function", typeof globalThis.__chiusure[0]);
  await prova("pagina: la pulizia non lancia (2)", "iniz-sync", () => globalThis.__chiusure[0]?.());
  await prova("pagina: initAdminCheck che rifiuta", "iniz-async", () => T.usaTracciamentoPagina("soluzioni"));
  await prova("pagina: iscrizione che lancia", "iscrizione", () => T.usaTracciamentoPagina("soluzioni"));
  c("pagina: pulizia presente anche con l'iscrizione rotta", "function", typeof globalThis.__chiusure[0]);
  c("nessuna promessa rifiutata rimasta senza gestione (pagina)", [], nonGestite);
  //  Con tutto sano gli eventi partono come prima.
  await prova("pagina sana", "", () => T.usaTracciamentoPagina("soluzioni"));
  c("pagina sana: PageView e vista partono", true, globalThis.__eventi.includes("firePixel") && globalThis.__eventi.includes("trackEvent"));
  globalThis.__chiusure.forEach((x) => x?.());
  c("pagina sana: la pulizia chiude l'iscrizione", true, globalThis.__eventi.includes("smesso"));
  process.off("unhandledRejection", registra);
  delete globalThis.window;
  delete globalThis.document;
}

finisci();
