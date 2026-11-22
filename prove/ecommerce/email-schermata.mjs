/** ── E-COMMERCE · R2 · T66 · LA SCHEDA «EMAIL» DEL CRM (src/crm/ecommerce/email/ModelliEmail.tsx) ───────────────
 *  Sostituisce il segnaposto di T62. Parla con la rotta che c'è già (`/api/crm/negozio-email`, permesso `impostazioni`, T54/T57):
 *  qui si prova con il SERVER VERO di T54 (`email.server.ts`) e il suo database finto, e si disegna la schermata sul serio.
 *  Regole (PIANO-R2 T66, SPEC 8A n. 2, 3, 4; D53):
 *   · i cinque modelli, ognuno con oggetto, testo, anteprima con dati inventati, stato «spenta/approvata da… il…», «Approva», interruttore;
 *   · l'interruttore è spento (disabilitato) con un testo non approvato, con un segnaposto `{{…}}`, con una variabile fuori elenco o con
 *     modifiche non salvate, e dice perché; spegnere si può SEMPRE;
 *   · «Approva» manda l'impronta del testo VISTO (non quella di un testo cambiato nel frattempo da un'altra persona);
 *   · modificare il testo avvisa che salvando si spegne e si toglie l'approvazione; chi approva lo scrive il server;
 *   · al primo 403 si chiama `onNegato()` (una volta sola): la linguetta sparisce, il permesso lo decide il server;
 *   · «saltata» (la conferma su un ordine annullato) è una scelta, non un guasto: la schermata lo dice;
 *   · nessun testo di marketing inventato: i modelli di base sono tutti segnaposto, e il file non porta testi suoi per i clienti.
 *  Nessun database vero, nessuna email vera, nessun dato vero. */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { fintoDb } from "../negozio/_finto-db.mjs";
import { modelliEmailSeme } from "../negozio/_dati-r2.mjs";
import { porte, guardiaNo } from "../negozio/_server.mjs";

const sha = (t) => createHash("sha256").update(t, "utf8").digest("hex");
const CHIAVI = ["conferma_ordine", "spedito", "pagamento_non_riuscito", "rimborso", "annullato"];
const FILE = "src/crm/ecommerce/email/ModelliEmail.tsx";
const OGGETTO = "Il tuo ordine {ref}";
const TESTO = "Ciao {nome}, ordine {ref}.\nSegui: {link_ordine}";
const SEME_IL = "2026-11-20T10:00:00.000Z";

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("E-COMMERCE · R2 · T66 · LA SCHEDA «EMAIL» DEL CRM (22/11/2026)");
  const S = mod["negozio/email.server"];
  const BASE = mod["shop/email/modelli-base"]?.MODELLI_BASE ?? [];
  const sorgente = readFileSync(join(radice, FILE), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");

  // ── il server vero, con il database finto ──
  const database = (modelli = modelliEmailSeme()) => {
    let n = 0;
    return fintoDb({ tabelle: { shop_email_modelli: structuredClone(modelli), shop_storico: [] }, adesso: () => new Date(Date.UTC(2026, 10, 21, 10, ++n)).toISOString() });
  };
  /** Una `fetch` collegata a `email.server.ts` (guardia aperta, o negata con lo stato dato). */
  const collega = ({ db = database(), stato = null, nome } = {}) => {
    const chiamate = [];
    const f = async (url, init = {}) => {
      chiamate.push({ url, metodo: init.method ?? "GET", corpo: init.body ? JSON.parse(init.body) : null, init });
      const { d } = porte({ db, ...(stato ? { guardia: guardiaNo(stato) } : nome ? { guardia: async () => ({ ok: true, nome }) } : {}) });
      const q = new Request(`https://sito.test${url}`, { method: init.method ?? "GET", headers: { "content-type": "application/json" }, ...(init.body ? { body: init.body } : {}) });
      return init.method === "POST" ? S.gestisciPOST(q, d) : S.gestisciGET(q, d);
    };
    return { f, db, chiamate };
  };
  const riga = (db, chiave) => db.tabelle.shop_email_modelli.find((m) => m.chiave === chiave);
  /** I modelli con `annullato` col testo vero e, se si vuole, approvato. */
  const conTestoVero = ({ approva = false, acceso = false } = {}) =>
    modelliEmailSeme().map((m) => (m.chiave === "annullato" ? { ...m, oggetto: OGGETTO, testo: TESTO, acceso, ...(approva ? { approvato_da: "Titolare Prova", approvato_il: SEME_IL, approvato_hash: sha(`${OGGETTO}\n${TESTO}`) } : {}) } : m));
  /** Una `fetch` finta che risponde e basta. */
  const porta = (stato, corpo) => ({ f: async () => new Response(JSON.stringify(corpo), { status: stato, headers: { "Content-Type": "application/json" } }) });

  // ── il modulo si compila ──
  const dove = mkdtempSync(join(tmpdir(), "email-schermata-"));
  try {
    const req = createRequire(join(radice, "package.json"));
    const reactDelProgetto = { name: "react-del-progetto", setup(b) {
      b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (x) => ({ path: req.resolve(x.path), external: true }));
    } };
    const tsx = async (entrata, nome) => {
      try {
        await build({ entryPoints: [join(radice, entrata)], bundle: true, platform: "node", format: "cjs", outfile: join(dove, `${nome}.cjs`),
          loader: { ".tsx": "tsx", ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".webp": "dataurl" }, alias: { "@": join(radice, "src") },
          plugins: [reactDelProgetto], logLevel: "silent", jsx: "automatic" });
        return createRequire(import.meta.url)(join(dove, `${nome}.cjs`));
      } catch (e) {
        return { __errore: String(e?.message ?? e).split("\n")[0] };
      }
    };
    const { createElement: h } = req("react");
    const { renderToStaticMarkup } = req("react-dom/server");
    const testo = (x) => x.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");
    const tag = (html, etichetta) => html.match(new RegExp(`<(?:button|input|textarea)[^>]*aria-label="${etichetta}"[^>]*>`))?.[0] ?? "";
    const spento = (t) => /\sdisabled(=|\s|>)/.test(t);
    const acceso = (t) => /aria-checked="true"/.test(t);

    const E = await tsx(FILE, "email");
    if (E.__errore) c("ModelliEmail.tsx: l'errore di compilazione", "nessuno", E.__errore);
    const fn = (nome) => (typeof E[nome] === "function" ? E[nome] : () => `«${nome}» non esiste`);
    const afn = (nome) => (typeof E[nome] === "function" ? E[nome] : async () => `«${nome}» non esiste`);
    c("ModelliEmail.tsx si compila e porta ModelliEmail (stesso nome e props del segnaposto) e VistaModelli", [true, true], [typeof E.ModelliEmail === "function", typeof E.VistaModelli === "function"]);
    c("l'indirizzo è quello della rotta che c'è già", "/api/crm/negozio-email", E.URL_EMAIL);

    // ── la lettura: UNA GET, i cinque modelli, solo i campi noti ──
    const ok = collega();
    const L = await afn("caricaModelli")(ok.f);
    c("leggere i modelli è UNA GET a /api/crm/negozio-email?modelli", [1, "GET", "/api/crm/negozio-email?modelli"], [ok.chiamate.length, ok.chiamate[0]?.metodo, ok.chiamate[0]?.url]);
    c("i cinque modelli, nell'ordine di S6, con oggetto, testo e impronta", [true, CHIAVI, true], [L.ok, L.modelli?.map((m) => m.chiave), L.modelli?.every((m) => m.impronta === sha(`${m.oggetto}\n${m.testo}`))]);
    const m0 = L.modelli?.[0] ?? {};
    c("il seme: spento, non approvato, nessuno ha approvato, con la versione del server (verbatim)", [false, false, null, SEME_IL], [m0.acceso, m0.approvato, m0.approvatoDa, m0.aggiornatoIl]);
    c("il giudizio sul contenuto: il seme ha un segnaposto", ["segnaposto", false], [m0.contenuto?.motivo, m0.contenuto?.ok]);
    c("le variabili ammesse di ogni messaggio arrivano dal server (una sola fonte)", true, JSON.stringify(L.variabili) === JSON.stringify(mod["shop/email/tipi"].VARIABILI_PER_CHIAVE));
    const sporca = await afn("caricaModelli")(porta(200, { ok: true, variabili: {}, modelli: [
      { ...m0, approvato_hash: "x".repeat(64), segreto: "sk_live_ABCDEF0123456789", frase: "whsec_ABCDEF0123456789" },
      { ...m0, chiave: "boh" }, { ...m0, impronta: "corta" }, { ...(L.modelli?.[1] ?? {}), contenuto: { ok: false, motivo: "inventato" } },
    ] }).f);
    c("si copiano solo i campi noti: nessuna chiave né campo in più arriva allo stato", false, /sk_|whsec_|approvato_hash|segreto/.test(JSON.stringify(sporca)));
    c("un modello con chiave sconosciuta, impronta storta o motivo inventato non entra", [1], [sporca.modelli?.length]);
    const errLettura = async (stato, corpo) => (await afn("caricaModelli")(porta(stato, corpo).f)).tipo;
    c("403 → «permesso», 401 → «sessione», 500 → «server», risposta senza modelli → «server»", ["permesso", "sessione", "server", "server"], [await errLettura(403, { ok: false, modelli: [] }), await errLettura(401, { ok: false }), await errLettura(500, { ok: false }), await errLettura(200, { ok: true })]);
    const eRete = await afn("caricaModelli")(async () => { throw new Error("giù /api/crm/negozio-email"); });
    c("rete caduta → «rete», con una frase che non ripete il testo del browser", ["rete", false], [eRete.tipo, /api\//.test(eRete.messaggio ?? "")]);
    const negato = await afn("caricaModelli")(collega({ stato: 403 }).f);
    c("dal server vero, senza il permesso (403): «permesso» e zero modelli", ["permesso"], [negato.tipo]);

    // ── onNegato: al primo 403, una volta sola ──
    const guardia = fn("creaGuardia");
    let chiamato = 0;
    const g = guardia(() => chiamato++);
    const r1 = g({ ok: false, tipo: "server", messaggio: "x" });
    const r2 = g({ ok: false, tipo: "permesso", messaggio: "no" });
    const r3 = g({ ok: false, tipo: "permesso", messaggio: "no" });
    const r4 = g({ ok: true, dati: {} });
    c("`creaGuardia`: chiama onNegato al PRIMO «permesso» (non per gli altri errori) e una volta sola; restituisce sempre l'esito com'è", [1, "server", "permesso", "permesso", true], [chiamato, r1?.tipo, r2?.tipo, r3?.tipo, r4?.ok]);
    let chiamato401 = 0;
    guardia(() => chiamato401++)({ ok: false, tipo: "sessione", messaggio: "x" });
    c("una sessione scaduta (401) non toglie la linguetta", 0, chiamato401);
    c("senza onNegato non si rompe niente", "permesso", guardia(undefined)({ ok: false, tipo: "permesso", messaggio: "x" })?.tipo);

    // ── quando si può accendere ──
    const modelloVero = (extra = {}) => ({ ...(L.modelli?.[4] ?? {}), oggetto: OGGETTO, testo: TESTO, impronta: sha(`${OGGETTO}\n${TESTO}`), contenuto: { ok: true }, approvato: false, approvatoDa: null, approvatoIl: null, acceso: false, ...extra });
    const pa = fn("puoAccendere");
    const seme = pa(L.modelli?.[0], false);
    c("il seme (segnaposto, non approvato): NON si può accendere, e dice «segnaposto»", [false, true], [seme.ok, /segnaposto/i.test(seme.frase ?? "")]);
    const nonApp = pa(modelloVero(), false);
    c("testo vero ma non approvato: NON si può accendere, dice di approvarlo", [false, true], [nonApp.ok, /approv/i.test(nonApp.frase ?? "")]);
    c("testo vero e approvato: si può accendere", true, pa(modelloVero({ approvato: true, approvatoDa: "Titolare Prova" }), false).ok);
    const sporcoR = pa(modelloVero({ approvato: true }), true);
    c("approvato ma con modifiche non salvate: NON si può accendere, dice di salvare", [false, true], [sporcoR.ok, /salva/i.test(sporcoR.frase ?? "")]);
    const varsc = pa(modelloVero({ approvato: true, contenuto: { ok: false, motivo: "variabile_sconosciuta" } }), false);
    c("variabile fuori elenco: NON si può accendere, e la frase parla delle variabili", [false, true], [varsc.ok, /variabil|graffa/i.test(varsc.frase ?? "")]);
    c("vuoto: NON si può accendere", false, pa(modelloVero({ approvato: true, contenuto: { ok: false, motivo: "vuoto" } }), false).ok);
    c("un testo che non si può accendere resta spegnibile: `puoSpegnere` vale sempre", [true, true], [fn("puoSpegnere")(modelloVero({ acceso: true, contenuto: { ok: false, motivo: "segnaposto" } }), true), fn("puoSpegnere")(modelloVero({ acceso: true }), false)]);

    // ── il giudizio sul testo che si sta scrivendo (stessa regola dell'invio) ──
    const gb = fn("giudizioBozza");
    c("bozza con «{{da confermare}}» → segnaposto; testo con le variabili giuste → ok", ["segnaposto", true], [gb("annullato", { oggetto: "{{da confermare}} Ordine", testo: "x" }).motivo, gb("annullato", { oggetto: OGGETTO, testo: TESTO }).ok]);
    c("una variabile di un altro messaggio ({totale} in «spedito»), o una graffa rimasta sola, → variabile_sconosciuta", ["variabile_sconosciuta", "variabile_sconosciuta", "variabile_sconosciuta"], [
      gb("spedito", { oggetto: "a", testo: "Totale {totale}" }).motivo, gb("annullato", { oggetto: "a", testo: "Ciao {nome" }).motivo, gb("annullato", { oggetto: "a", testo: "Ciao {cognome}" }).motivo,
    ]);
    c("oggetto o testo vuoti → vuoto", ["vuoto", "vuoto"], [gb("annullato", { oggetto: "  ", testo: "x" }).motivo, gb("annullato", { oggetto: "x", testo: "" }).motivo]);

    // ── modificare il testo avvisa ──
    const av = fn("avvisoModifica");
    const approvatoAcceso = modelloVero({ approvato: true, acceso: true });
    const testoCambiato = { oggetto: OGGETTO, testo: `${TESTO}\nGrazie.` };
    const cambio = av(approvatoAcceso, testoCambiato);
    c("testo cambiato su un messaggio acceso e approvato: l'avviso dice che si SPEGNE e che l'approvazione si TOGLIE", [true, true, true], [typeof cambio === "string", /spegn/i.test(cambio ?? ""), /approvazione/i.test(cambio ?? "") && /tol/i.test(cambio ?? "")]);
    c("testo uguale (anche solo con spazi in più ai bordi): nessun avviso", [null, null], [av(approvatoAcceso, { oggetto: OGGETTO, testo: TESTO }), av(approvatoAcceso, { oggetto: ` ${OGGETTO} `, testo: `${TESTO}\n` })]);
    c("testo cambiato su un messaggio non ancora approvato: un avviso più leggero (va approvato dopo), non «si spegne»", [true, false], [typeof av(modelloVero(), testoCambiato) === "string", /si spegne/i.test(av(modelloVero(), testoCambiato) ?? "")]);
    c("`eSporco`: vero solo se il testo è diverso da quello salvato", [false, true], [fn("eSporco")(approvatoAcceso, { oggetto: OGGETTO, testo: TESTO }), fn("eSporco")(approvatoAcceso, testoCambiato)]);

    // ── salvare, col server vero ──
    const dbS = database(conTestoVero({ approva: true, acceso: true }));
    const sv = collega({ db: dbS });
    const lS = await afn("caricaModelli")(sv.f);
    const mS = lS.modelli?.find((m) => m.chiave === "annullato");
    const nuovoTesto = `${TESTO}\nPer dubbi rispondi a questa email.`;
    const rS = await afn("salvaModello")(sv.f, mS, { oggetto: OGGETTO, testo: nuovoTesto });
    const salva = sv.chiamate.find((x) => x.metodo === "POST")?.corpo;
    c("salvare è UN POST con azione, chiave, la versione vista (`atteso`, verbatim), oggetto e testo", [{ azione: "modello_salva", chiave: "annullato", atteso: mS?.aggiornatoIl, oggetto: OGGETTO, testo: nuovoTesto }], [salva]);
    c("…riuscito: il modello torna riletto, SPENTO e senza approvazione (lo fa il database)", [true, false, false, false, nuovoTesto], [rS.ok, rS.modello?.acceso, rS.modello?.approvato, riga(dbS, "annullato").acceso, rS.modello?.testo]);
    const dbC = database(conTestoVero());
    const cs = collega({ db: dbC });
    const vecchio = (await afn("caricaModelli")(cs.f)).modelli.find((m) => m.chiave === "annullato");
    await afn("salvaModello")(cs.f, vecchio, { oggetto: OGGETTO, testo: "Testo di un'altra persona {nome}" }); // un'altra persona salva nel frattempo
    const rC = await afn("salvaModello")(cs.f, vecchio, { oggetto: OGGETTO, testo: "Il mio testo {nome}" });
    c("salvare con la versione vecchia (un'altra persona ha cambiato il testo): «conflitto», e il testo dell'altra persona resta", [false, "conflitto", "Testo di un'altra persona {nome}"], [rC.ok, rC.tipo, riga(dbC, "annullato").testo]);
    const nulla = collega();
    const rVuoto = await afn("salvaModello")(nulla.f, { ...mS, aggiornatoIl: null }, { oggetto: OGGETTO, testo: TESTO });
    const rVuoto2 = await afn("salvaModello")(nulla.f, mS, { oggetto: "  ", testo: TESTO });
    c("senza la versione vista, o con l'oggetto vuoto, il salvataggio non parte nemmeno (zero richieste)", [false, false, 0], [rVuoto.ok, rVuoto2.ok, nulla.chiamate.length]);

    // ── approvare: l'impronta del testo VISTO ──
    const dbA = database(conTestoVero());
    const ap = collega({ db: dbA, nome: "Titolare Prova" });
    const mA = (await afn("caricaModelli")(ap.f)).modelli.find((m) => m.chiave === "annullato");
    const rA = await afn("approvaModello")(ap.f, mA);
    const corpoA = ap.chiamate.find((x) => x.metodo === "POST")?.corpo;
    c("«Approva» è UN POST con azione, chiave e l'impronta del testo visto (nient'altro: né nome né testo)", [{ azione: "modello_approva", chiave: "annullato", impronta: sha(`${OGGETTO}\n${TESTO}`) }], [corpoA]);
    c("…riuscito: approvato, col nome che dà il SERVER (la guardia), spento ancora", [true, true, "Titolare Prova", false], [rA.ok, rA.modello?.approvato, rA.modello?.approvatoDa, rA.modello?.acceso]);
    const dbV = database(conTestoVero());
    const av2 = collega({ db: dbV });
    const visto = (await afn("caricaModelli")(av2.f)).modelli.find((m) => m.chiave === "annullato"); // io vedo il testo A…
    riga(dbV, "annullato").testo = "Un altro testo {nome}"; // …nel frattempo un'altra persona lo cambia
    const rV = await afn("approvaModello")(av2.f, visto);
    c("approvare un testo cambiato nel frattempo: manda l'impronta di QUELLO CHE HO VISTO, il server dice «conflitto» e non approva niente", [sha(`${OGGETTO}\n${TESTO}`), false, "conflitto", null], [av2.chiamate.find((x) => x.metodo === "POST")?.corpo?.impronta, rV.ok, rV.tipo, riga(dbV, "annullato").approvato_hash]);
    const dbP = database();
    const pp = collega({ db: dbP });
    const lP = await afn("caricaModelli")(pp.f);
    const rP = await afn("approvaModello")(pp.f, lP.modelli[0]);
    c("approvare il seme (segnaposto) non parte nemmeno: zero richieste di scrittura", [false, 0], [rP.ok, pp.chiamate.filter((x) => x.metodo === "POST").length]);
    c("`puoApprovare`: non con modifiche non salvate, non se c'è un segnaposto, non se è già approvato", [false, false, false, true], [
      fn("puoApprovare")(modelloVero(), true).ok, fn("puoApprovare")(L.modelli?.[0], false).ok, fn("puoApprovare")(modelloVero({ approvato: true }), false).ok, fn("puoApprovare")(modelloVero(), false).ok,
    ]);

    // ── accendere e spegnere ──
    const dbO = database(conTestoVero({ approva: true }));
    const on = collega({ db: dbO });
    const mO = (await afn("caricaModelli")(on.f)).modelli.find((m) => m.chiave === "annullato");
    const rOn = await afn("accendiModello")(on.f, mO, true);
    c("accendere è UN POST {azione, chiave, acceso:true}; con testo vero e approvato riesce", [{ azione: "modello_acceso", chiave: "annullato", acceso: true }, true, true], [on.chiamate.find((x) => x.metodo === "POST")?.corpo, rOn.ok, riga(dbO, "annullato").acceso]);
    const rOff = await afn("accendiModello")(on.f, rOn.modello, false);
    c("spegnere riesce sempre", [true, false], [rOff.ok, riga(dbO, "annullato").acceso]);
    const dbN = database();
    const nn = collega({ db: dbN });
    const lN = await afn("caricaModelli")(nn.f);
    const rN = await afn("accendiModello")(nn.f, lN.modelli[0], true);
    c("accendere il seme (segnaposto, non approvato) non parte nemmeno: zero richieste di scrittura, con la frase", [false, 0, true], [rN.ok, nn.chiamate.filter((x) => x.metodo === "POST").length, /segnaposto/i.test(rN.messaggio ?? "")]);
    const dbF = database(conTestoVero({ approva: true }));
    const ff = collega({ db: dbF });
    const mF = (await afn("caricaModelli")(ff.f)).modelli.find((m) => m.chiave === "annullato");
    riga(dbF, "annullato").testo = "Cambiato di nascosto {nome}"; // il testo cambia dopo che l'ho visto approvato
    const rF = await afn("accendiModello")(ff.f, mF, true);
    c("se il testo è cambiato dopo l'approvazione, il server rifiuta con la sua frase (il database è la seconda rete) e nulla si accende", [false, "rifiutato", false], [rF.ok, rF.tipo, riga(dbF, "annullato").acceso]);

    // ── la schermata, disegnata sul serio ──
    const base = (extra = {}) => ({
      modelli: L.modelli, variabili: L.variabili, bozze: {}, lavoro: null, esiti: {}, errore: null,
      onBozza: () => {}, onSalva: () => {}, onRipristina: () => {}, onApprova: () => {}, onAcceso: () => {}, onRiprova: () => {},
      ...extra,
    });
    const vista = (extra) => (typeof E.VistaModelli === "function" ? renderToStaticMarkup(h(E.VistaModelli, base(extra))) : "");
    const html = vista();
    const t = testo(html);
    const nome = (chiave) => fn("etichettaDi")(chiave);
    c("`etichettaDi`: un nome in italiano per ognuno dei cinque messaggi, tutti diversi e senza apostrofi", [5, true], [new Set(CHIAVI.map(nome)).size, CHIAVI.every((k) => /^[A-Za-zÀ-ù ]{6,40}$/.test(nome(k)))]);
    c("la schermata mostra i cinque messaggi", true, CHIAVI.every((k) => t.includes(nome(k))));
    c("ogni messaggio ha oggetto e testo da modificare, con le sue etichette", true, CHIAVI.every((k) => /<input[^>]*aria-label="Oggetto: /.test(html) && tag(html, `Oggetto: ${nome(k)}`) !== "" && tag(html, `Testo: ${nome(k)}`) !== ""));
    c("il testo che il server manda è quello che si legge nei campi (nessun testo inventato qui)", true, CHIAVI.every((k) => html.includes(`{{da confermare}}: testo di ${k}`)));
    c("tutti spenti alla nascita, e lo dice: «Spenta» cinque volte", 5, (t.match(/Spenta/g) || []).length);
    c("tutti e cinque gli interruttori sono disabilitati col seme (segnaposto, non approvato)", [true, true, true, true, true], CHIAVI.map((k) => spento(tag(html, `Email attiva: ${nome(k)}`))));
    c("…e la frase dice perché: segnaposto «{{da confermare}}»", true, /segnaposto[^.]*\{\{da confermare\}\}|\{\{da confermare\}\}[^.]*segnaposto/i.test(t) || (t.match(/segnaposto/gi) || []).length >= 5);
    c("…e c'è l'avviso del segnaposto una volta per messaggio (non una frase sola per tutti)", true, (t.match(/ha ancora un segnaposto/g) || []).length >= 5);
    c("«Approva» è disabilitato col segnaposto, per tutti", [true, true, true, true, true], CHIAVI.map((k) => spento(tag(html, `Approva ${nome(k)}`)) && tag(html, `Approva ${nome(k)}`) !== ""));
    c("«Salva» è disabilitato finché non c'è niente di cambiato", [true, true, true, true, true], CHIAVI.map((k) => spento(tag(html, `Salva ${nome(k)}`)) && tag(html, `Salva ${nome(k)}`) !== ""));
    c("ogni messaggio dice quali variabili si possono usare, con la graffa singola, e che una graffa sola blocca", [true, true, true], [CHIAVI.every((k) => (L.variabili?.[k] ?? []).every((v) => html.includes(`{${v}}`))), /una graffa per parte|una graffa per lato|graffe/i.test(t), /rimast[ae] sola|graffa sola/i.test(t)]);
    c("le variabili del messaggio «spedito» includono il tracking; quelle di «annullato» no", [true, false], [t.includes("{numero_tracking}"), (L.variabili?.annullato ?? []).includes("numero_tracking")]);
    c("l'anteprima è con dati inventati e lo dice", true, /anteprima/i.test(t) && /dati (inventati|di esempio)/i.test(t));
    c("la conferma d'ordine spiega che su un ordine annullato non parte, ed è una scelta e non un guasto (stato «saltata»)", [true, true], [/ordine annullato[^.]*non parte|non parte[^.]*ordine annullato/i.test(t), /scelta/i.test(t) && !/errore|guasto non/i.test(t.match(/non parte[^.]*\./i)?.[0] ?? "")]);

    // un testo vero e approvato
    const lVero = await afn("caricaModelli")(collega({ db: database(conTestoVero({ approva: true })) }).f);
    const vVero = vista({ modelli: lVero.modelli });
    const tVero = testo(vVero);
    c("testo vero e approvato: l'interruttore si può girare, e si legge «Approvata da Titolare Prova»", [false, true], [spento(tag(vVero, `Email attiva: ${nome("annullato")}`)), /Approvata da Titolare Prova/.test(tVero)]);
    c("…e «Approva» non c'è più per quel messaggio (è già approvato)", "", tag(vVero, `Approva ${nome("annullato")}`));
    const lAcc = await afn("caricaModelli")(collega({ db: database(conTestoVero({ approva: true, acceso: true })) }).f);
    const vAcc = vista({ modelli: lAcc.modelli });
    c("acceso: l'interruttore è acceso e dice «Accesa»", [true, false, true], [acceso(tag(vAcc, `Email attiva: ${nome("annullato")}`)), spento(tag(vAcc, `Email attiva: ${nome("annullato")}`)), /Accesa/.test(testo(vAcc))]);
    const lNonApp = await afn("caricaModelli")(collega({ db: database(conTestoVero()) }).f);
    const vNonApp = vista({ modelli: lNonApp.modelli });
    c("testo vero ma NON approvato: «Approva» si può premere, l'interruttore resta spento e dice di approvare", [false, true, true], [spento(tag(vNonApp, `Approva ${nome("annullato")}`)), spento(tag(vNonApp, `Email attiva: ${nome("annullato")}`)), /non è approvato|da approvare/i.test(testo(vNonApp))]);

    // la bozza: avvisi, interruttore spento, anteprima
    const bozzaMod = { annullato: { oggetto: OGGETTO, testo: testoCambiatoDi(TESTO) } };
    function testoCambiatoDi(x) { return `${x}\nUna riga in più.`; }
    const vMod = vista({ modelli: lAcc.modelli, bozze: bozzaMod });
    const tMod = testo(vMod);
    c("modifica non salvata su un messaggio acceso: l'avviso dice che salvando si spegne e si toglie l'approvazione", [true, true], [/si spegne/i.test(tMod), /approvazione/i.test(tMod)]);
    c("…«Salva» si può premere, «Approva» no (prima si salva), l'interruttore acceso si può SPEGNERE", [false, true, false], [spento(tag(vMod, `Salva ${nome("annullato")}`)), spento(tag(vMod, `Approva ${nome("annullato")}`)) || tag(vMod, `Approva ${nome("annullato")}`) === "", spento(tag(vMod, `Email attiva: ${nome("annullato")}`))]);
    c("…e c'è «Annulla le modifiche»", true, tag(vMod, `Annulla le modifiche: ${nome("annullato")}`) !== "");
    const vMod2 = vista({ modelli: lVero.modelli, bozze: bozzaMod });
    c("modifica su un messaggio approvato e spento: l'interruttore è spento e dice di salvare", [true, true], [spento(tag(vMod2, `Email attiva: ${nome("annullato")}`)), /salva/i.test(testo(vMod2).match(/Email attiva[\s\S]{0,400}/)?.[0] ?? testo(vMod2))]);
    const vSeg = vista({ modelli: lVero.modelli, bozze: { annullato: { oggetto: "{{da confermare}} Ordine", testo: "{{da confermare}}" } } });
    c("una bozza con «{{da confermare}}»: l'avviso del segnaposto compare e «Salva» resta possibile (si può salvare una bozza), ma non si approva", [true, false, true], [/ha ancora un segnaposto/i.test(testo(vSeg)), spento(tag(vSeg, `Salva ${nome("annullato")}`)), spento(tag(vSeg, `Approva ${nome("annullato")}`)) || tag(vSeg, `Approva ${nome("annullato")}`) === ""]);

    // l'anteprima
    const anteprima = fn("anteprimaDi");
    const aV = anteprima("annullato", { oggetto: OGGETTO, testo: TESTO });
    c("`anteprimaDi` mette dati inventati al posto delle variabili e non lascia graffe", [true, false], [/Giulia/.test(aV.testo ?? "") && /HG-/.test(aV.oggetto ?? ""), /[{}]/.test(`${aV.oggetto}${aV.testo}`)]);
    const aSeg = anteprima("annullato", { oggetto: "{{da confermare}} Ordine", testo: "{{da confermare}}" });
    c("con un segnaposto lo lascia com'è (si vede che manca il testo vero) e lo segnala", [true, true], [(aSeg.testo ?? "").includes("{{da confermare}}"), aSeg.segnaposto === true]);
    c("i dati inventati non sembrano veri: nessun indirizzo email, nessun telefono, solo il dominio riservato «.test»", [false, false], [/@/.test(JSON.stringify(anteprima("conferma_ordine", { oggetto: "x", testo: "{nome} {totale} {riepilogo_righe} {indirizzo_spedizione} {link_ordine}" }))), /\d{9,}/.test(JSON.stringify(anteprima("spedito", { oggetto: "x", testo: "{numero_tracking} {link_tracking}" }).testo).replace(/[A-Z]{2}\d{9}[A-Z]{2}/g, ""))]);
    c("in pagina compare l'anteprima col nome inventato", true, /Giulia/.test(t) || /Giulia/.test(vista({ modelli: lVero.modelli })));

    // stati della schermata
    c("lettura non ancora arrivata: «Controllo…», nessun interruttore", [true, 0], [/Controllo/.test(testo(vista({ modelli: null }))), (vista({ modelli: null }).match(/role="switch"/g) || []).length]);
    const vErr = testo(vista({ modelli: null, errore: "La sessione è scaduta: rientra nel CRM." }));
    c("errore di lettura: la frase del server e «Riprova»", [true, true], [/sessione è scaduta/.test(vErr), /Riprova/.test(vErr)]);
    c("nessun modello (database senza i semi): lo dice, senza inventarne", true, /non trovo|non ci sono/i.test(testo(vista({ modelli: [] }))));
    const vEsito = vista({ modelli: lVero.modelli, esiti: { annullato: { tono: "errore", testo: "ESITO-ANNULLATO" }, spedito: { tono: "ok", testo: "ESITO-SPEDITO" } } });
    c("l'esito sta dentro la scheda del messaggio che si è toccato, una volta; errore come avviso (role=alert), riuscito come stato", [true, 1, true, true], [
      testo(vEsito).indexOf(nome("annullato")) < testo(vEsito).indexOf("ESITO-ANNULLATO"), testo(vEsito).split("ESITO-ANNULLATO").length - 1,
      /role="alert"[^>]*>[\s\S]{0,600}ESITO-ANNULLATO/.test(vEsito), /role="status"[^>]*>[\s\S]{0,400}ESITO-SPEDITO/.test(vEsito),
    ]);
    c("mentre una richiesta è in corso gli interruttori e i tasti di quel messaggio si bloccano (niente doppio clic)", [true, true], [
      spento(tag(vista({ modelli: lVero.modelli, lavoro: { chiave: "annullato", cosa: "acceso" } }), `Email attiva: ${nome("annullato")}`)),
      spento(tag(vista({ modelli: lVero.modelli, bozze: bozzaMod, lavoro: { chiave: "annullato", cosa: "salva" } }), `Salva ${nome("annullato")}`)),
    ]);
    c("«Elimina», «Cancella», «Rimuovi» non esistono nella schermata", false, /elimin|cancell|rimuov|delete/i.test(t + tMod));
    c("la schermata non mostra mai una chiave né una variabile d'ambiente", false, /sk_|rk_|whsec_|RESEND|STRIPE_|SERVICE_ROLE/i.test(html + vVero));
  } catch (e) {
    //  Una funzione che manca fa rosso la prova, non la fa crollare: le prove dopo questa devono girare.
    c("la prova della scheda gira fino in fondo", "nessuna eccezione", String(e?.stack ?? e).split("\n").slice(0, 3).join(" | "));
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }

  // ── nessun testo di marketing inventato ──
  c("i cinque modelli di base sono tutti segnaposto: «{{da confermare}}» nell'oggetto e nel testo, spenti, mai approvati", [5, true], [BASE.length, BASE.length === 5 && BASE.every((m) => m.oggetto.includes("{{da confermare}}") && m.testo.includes("{{da confermare}}") && m.acceso === false && !m.approvato_hash)]);
  const nudo = senzaCommenti(sorgente);
  c("il file non porta testi per i clienti: nessuna formula di saluto, di ringraziamento, di offerta o di promessa", false, /grazie|gentile|egregi|cordial|sconto|offerta|promo|scopri|novit|benvenut|speciale|esclusiv|acquista|consulenz|24 ?ore|48 ?ore|spedizione gratuita/i.test(nudo));
  c("…e non copia nessun testo dei modelli di base", false, BASE.some((m) => m.testo.split("\n").some((r) => r.trim().length > 12 && nudo.includes(r.trim()))));
  c("nessuna chiave, variabile d'ambiente, log né accesso diretto al database nel file", false, /\b(sk|rk|pk)_(test|live)|whsec_|STRIPE_|RESEND|process\.env|import\.meta\.env|console\.|@\/integrations\/supabase|createClient|\.from\(["']/.test(nudo));
  c("«Elimina» e simili non compaiono nemmeno come parole di una frase", false, /elimin|cancell|delete|rimuov/i.test(nudo.replace(/\/api\/[^"'`\s]*/g, "")));
  c("non importa codice del server (nel pacchetto del browser non ci va)", false, /\.server["']|cloudflare:workers|node:/.test(nudo));
  c("il file non scrive rotte e non tocca il database: solo la rotta che c'è già", [true, false], [/\/api\/crm\/negozio-email/.test(nudo), /\/api\/(public|crm\/(ordini|negozio|stripe))\b/.test(nudo)]);
  c("al primo 403 il file chiama onNegato tramite `creaGuardia`, e ogni risposta della rotta ci passa", [true, true], [/creaGuardia\(/.test(nudo), (nudo.match(/guarda\(/g) || []).length >= 4]);
  c("la lettura parte da un effetto (all'apertura della scheda), mai nel disegno né a livello di modulo", true, /useEffect\(\(\) => \{[\s\S]{0,300}void carica\(\)/.test(nudo));
}
