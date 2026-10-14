/** ── PROVA C2 · GLI EVENTI DEL SITO (nomi fissi, nessun dato personale) ────
 *  `src/landing/sito/eventi.ts` e `traccia.ts`.
 *  ───────────────────────────────────────────────────────────────────────── */
import { carica, leggi, nuovaProva } from "./_comune.mjs";

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
c("EVENTI_SITO = elenco della SPEC", [...DA_SPEC].sort(), [...E.EVENTI_SITO].sort());
c("nessun nome doppio", E.EVENTI_SITO.length, new Set(E.EVENTI_SITO).size);
vero("niente stock_acquisto né stock_abbandono_carrello (fase 2)", !E.EVENTI_SITO.some((n) => /acquisto|abbandono/.test(n)));

/* ── Dettagli ammessi ──────────────────────────────────────────────────── */
c("DETTAGLI_AMMESSI", ["bottone", "sezione", "percorso", "campo", "voce", "motivo", "origine", "punto", "variante", "pagina"], [...E.DETTAGLI_AMMESSI]);
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
vero("traccia.ts non scrive in localStorage", !/localStorage/.test(leggi("src/landing/sito/traccia.ts").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")));

finisci();
