/** ── PROVE DEL CALENDARIO (compito B7) ─────────────────────────────────────
 *  `node prove/sito/calendario.mjs`. `BookingFunnel` ha due modi:
 *   - «completo» (predefinito): il funnel lungo di oggi, identico;
 *   - «solo-calendario»: solo il passo 0 (giorno e ora), per il modulo corto.
 *  Cosa copre: le regole degli orari (esclusi i passati, sul calendario di
 *  Roma come la funzione SQL `fissa_orario_lead_sito`), il disegno dei due modi
 *  (react-dom/server sul componente vero) e le promesse sul codice: niente
 *  localStorage né eventi di montaggio in «solo-calendario», `funnel_settings`
 *  letta con lo stesso ordine della funzione SQL in tutti e due i modi.
 *  I tocchi veri (scelta dell'ora → `onOrarioScelto`) li guarda Playwright.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createRequire } from "node:module";
import { join } from "node:path";
import { carica, leggi, nuovaProva, radice } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("calendario (BookingFunnel)");

/* ── 1. REGOLE DEGLI ORARI ──────────────────────────────────────────────── */
const R = await carica("src/landing/booking/calendario-regole.ts", "calendario-regole");
const orari = ["09:00", "09:30", "12:00", "14:30", "15:00", "21:30"];

// 14/10/2026: a Roma c'è l'ora legale (UTC+2).
c("Roma: 12:30 UTC d'ottobre = 14:30", { oggi: "2026-10-14", minuti: 14 * 60 + 30 }, R.adessoARoma(new Date("2026-10-14T12:30:00Z")));
c("Roma: 22:30 UTC è già il giorno dopo", { oggi: "2026-10-15", minuti: 30 }, R.adessoARoma(new Date("2026-10-14T22:30:00Z")));
c("Roma: ora solare d'inverno (UTC+1)", { oggi: "2026-12-02", minuti: 30 }, R.adessoARoma(new Date("2026-12-01T23:30:00Z")));
c("Roma: a mezzanotte e un minuto", { oggi: "2026-10-14", minuti: 1 }, R.adessoARoma(new Date("2026-10-13T22:01:00Z")));

const adesso = new Date("2026-10-14T12:30:00Z"); // 14:30 a Roma
const base = { orari, bloccati: [], occupati: [], adesso };
c("oggi: restano solo gli orari DOPO l'ora attuale (14:30 esce, 15:00 resta)", ["15:00", "21:30"], R.orariDelGiorno({ ...base, data: "2026-10-14" }));
c("oggi, tardi: nessun orario", [], R.orariDelGiorno({ ...base, data: "2026-10-14", adesso: new Date("2026-10-14T19:45:00Z") }));
c("domani: tutti gli orari", orari, R.orariDelGiorno({ ...base, data: "2026-10-15" }));
c("ieri: nessuno", [], R.orariDelGiorno({ ...base, data: "2026-10-13" }));
c("oggi, 14:29:59: le 14:30 sono ancora «dopo»", ["14:30", "15:00", "21:30"], R.orariDelGiorno({ ...base, data: "2026-10-14", adesso: new Date("2026-10-14T12:29:59Z") }));
c("oggi, 14:30:30: le 14:30 sono passate (come nel server, che confronta con l'ora attuale)", ["15:00", "21:30"], R.orariDelGiorno({ ...base, data: "2026-10-14", adesso: new Date("2026-10-14T12:30:30Z") }));
c("bloccati e occupati escono come prima", ["09:00", "12:00", "21:30"], R.orariDelGiorno({ ...base, data: "2026-10-15", bloccati: ["09:30"], occupati: ["14:30", "15:00"] }));
c("occupati anche come Set", ["09:00"], R.orariDelGiorno({ ...base, orari: ["09:00", "09:30"], data: "2026-10-15", occupati: new Set(["09:30"]) }));
c("senza «adesso» (modo completo) i passati restano, com'è oggi", orari, R.orariDelGiorno({ orari, bloccati: [], occupati: [], data: "2026-10-14" }));
c("orario scritto male: non si offre mai", ["15:00"], R.orariDelGiorno({ ...base, orari: ["15:00", "tardi", "25:99", ""], data: "2026-10-14" }));
c("l'ordine dato resta quello dato", ["21:30", "15:00"], R.orariDelGiorno({ ...base, orari: ["21:30", "15:00"], data: "2026-10-14" }));

/* ── 2. IL DISEGNO DEI DUE MODI ─────────────────────────────────────────── */
const richiedi = createRequire(join(radice, "package.json"));
const F = await carica("src/landing/booking/BookingFunnel.tsx", "booking-funnel", { reactVero: true });
const { renderToStaticMarkup } = richiedi("react-dom/server");
const { createElement } = richiedi("react");
const testoDi = (h) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const completo = testoDi(renderToStaticMarkup(createElement(F.BookingFunnel, { variant: "light" })));
vero("completo: intestazione a passi (Step 1 di 5)", completo.includes("Step 1 di 5"));
vero("completo: «Prenota analisi»", completo.includes("Prenota analisi"));
vero("completo: titolo del calendario di oggi", completo.includes("Scegli giorno e orario per la consulenza"));
vero("completo: «Online · 30 min · gratis · Google Meet» come oggi", completo.includes("Online · 30 min · gratis · Google Meet"));
vero("completo: il calendario ha i giorni della settimana", completo.includes("LUN") && completo.includes("DOM"));

const htmlSolo = renderToStaticMarkup(createElement(F.BookingFunnel, { variant: "light", modo: "solo-calendario", onOrarioScelto: () => {} }));
const solo = testoDi(htmlSolo);
vero("solo-calendario: il calendario c'è (giorni della settimana, frecce dei mesi)", solo.includes("LUN") && /aria-label="Mese successivo"/.test(htmlSolo));
vero("solo-calendario: niente intestazione a passi", !solo.includes("Step 1 di 5") && !/Step \d di/.test(solo));
vero("solo-calendario: niente «Prenota analisi»", !solo.includes("Prenota analisi"));
vero("solo-calendario: niente barra di avanzamento", !/bg-brand transition-all/.test(htmlSolo));
vero("solo-calendario: niente promessa di passo successivo", !solo.includes("prossimo step"));
vero("solo-calendario: niente «30 min» né «Google Meet» (dati non confermati)", !/30 min|Google Meet/.test(solo));
vero("solo-calendario: nessun «€»", !solo.includes("€"));

/* ── 3. LE PROMESSE SUL CODICE ──────────────────────────────────────────── */
const src = leggi("src/landing/booking/BookingFunnel.tsx");
const senzaCommenti = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
vero("prop modo: completo | solo-calendario", /modo\?:\s*"completo"\s*\|\s*"solo-calendario"/.test(senzaCommenti));
vero("prop onOrarioScelto(data, ora)", /onOrarioScelto\?:\s*\(data:\s*string,\s*ora:\s*string\)\s*=>\s*void/.test(senzaCommenti));
vero("il modo predefinito è «completo»", /modo\s*=\s*"completo"/.test(senzaCommenti));

// funnel_settings: la stessa riga che legge la funzione SQL (la più vecchia), in tutti e due i modi.
const lettura = /from\("funnel_settings"\)([\s\S]*?)\.maybeSingle\(\)/.exec(senzaCommenti)?.[1] ?? "";
vero("funnel_settings: trovata la lettura", lettura.length > 0);
vero("funnel_settings: .order(\"created_at\", { ascending: true }) prima di .limit(1)", /\.order\("created_at",\s*\{\s*ascending:\s*true\s*\}\)\s*\.limit\(1\)/.test(lettura.replace(/\s+/g, " ")));
c("funnel_settings: la lettura non dipende dal modo", false, /solo/.test(lettura));

// niente stato salvato né eventi di montaggio in solo-calendario.
const effettoMontaggio = /useEffect\(\(\) => \{[^]*?\n  \}, \[solo\]\);/.exec(senzaCommenti.slice(senzaCommenti.indexOf("setAudioMode(\"low\")") - 200))?.[0] ?? "";
vero("effetto di montaggio trovato", effettoMontaggio.includes('firePixel("PageView"'));
const dopoControllo = effettoMontaggio.split(/if \(solo\) return;/)[1] ?? "";
vero("montaggio: c'è un'uscita `if (solo) return;`", dopoControllo.length > 0);
for (const evento of ['captureSourceData()', 'trackEvent("PageView"', 'trackEvent("StepView"', 'trackEvent("FunnelStep"', 'firePixel("PageView"', 'fireCapi("PageView"', 'firePixel("ViewContent"', 'fireCapi("ViewContent"']) {
  vero(`montaggio: ${evento} sta dopo l'uscita di solo-calendario`, dopoControllo.includes(evento) && !effettoMontaggio.split(/if \(solo\) return;/)[0].includes(evento));
}
vero("localStorage: lo stato salvato non si legge in solo-calendario", /useEffect\(\(\) => \{\s*if \(solo\) \{\s*hydratedRef\.current = true;\s*return;\s*\}\s*const persisted = loadPersisted\(\)/.test(senzaCommenti));
vero("localStorage: non si salva in solo-calendario", /if \(!hydratedRef\.current \|\| solo\) return;\s*savePersisted/.test(senzaCommenti));
const dateEOra = senzaCommenti.slice(senzaCommenti.indexOf("const handleDatePick"), senzaCommenti.indexOf("const pickPortatore"));
vero("la scelta dell'ora in solo-calendario chiama onOrarioScelto(data, ora) PRIMA di ogni evento e NON passa al passo 1", /if \(solo\)\s*\{[^}]*onOrarioScelto\?\.\(form\.date, t\);\s*return;\s*\}\s*const id = makeEventId\(\);[\s\S]*goNext\(1\)/.test(dateEOra));
vero("la scelta del giorno in solo-calendario esce prima di Pixel e eventi del funnel lungo", /if \(solo\)\s*\{[^}]*return;\s*\}\s*const id = makeEventId\(\);\s*firePixel\("AddToCart"/.test(dateEOra));
vero("gli orari passati si escludono solo in solo-calendario (adesso passato solo lì)", /adesso:\s*solo\s*\?\s*adesso\s*:\s*undefined/.test(senzaCommenti));
vero("il «oggi» di solo-calendario è quello di Roma", /if \(solo\)\s*\{[^}]*adessoARoma\(t\)\.oggi/.test(senzaCommenti));

/* ── 4. NIENTE DI NUOVO PER CHI USA IL MODO COMPLETO ───────────────────── */
for (const f of ["src/routes/index.tsx", "src/routes/nuova.tsx", "src/components/landing/consulenza/PannelloProblemi.tsx"]) {
  vero(`${f}: monta BookingFunnel senza modo (resta «completo»)`, !/<BookingFunnel[^>]*modo=/.test(leggi(f)));
}

finisci();
