/** ── E-COMMERCE · R2 · T65 · LA SCHEDA «SPEDIZIONI» DEL CRM ───────────────────────────────────────
 *  `src/crm/ecommerce/spedizioni/ElencoTariffe.tsx` (sostituisce il segnaposto di T62). Regole (PIANO-R2 T65, D51, D62; SPEC 7.4 n. 7):
 *   · il costo si scrive in euro e va al server in centesimi interi (`4,90` → 490, `4.9` → 490, `abc` → errore, mai un numero a virgola);
 *   · la tariffa non confermata porta l'etichetta «Provvisoria»; «Conferma la tariffa» c'è solo finché non è confermata;
 *   · il salvataggio manda la versione VISTA (`atteso` = `aggiornatoIl`); un 409 si legge con la frase del server e la scheda si rilegge;
 *   · senza tariffa attiva la scheda dice che la cassa Stripe resterà chiusa;
 *   · un avviso sempre visibile: finché la cassa nuova non è accesa la cassa di oggi usa ancora 4,90 € (decisione del capo progetto, dopo T59);
 *   · i corrieri hanno un modello di link, e c'è la prova «metti un numero e guarda il link»;
 *   · l'interruttore «Spedizioni e resi sono scritti nelle pagine» scrive `resi_confermati`;
 *   · la soglia gratuita NON si mostra (D51) e non si scrive; nessuna rotta nuova: solo `/api/crm/negozio` (T50, T56).
 *  Il lato del server si prova col SERVER VERO di T50 e di T56 e il loro database finto; la schermata si disegna sul serio con `react-dom/server`.
 *  Dati inventati. Nessun accesso al database vero. */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";
import { fintoDb } from "../negozio/_finto-db.mjs";
import { tariffaSeme, ID_TARIFFA_SEME } from "../negozio/_dati-r2.mjs";
import { porte, get, leggi } from "../negozio/_server.mjs";

const ISTANTE = "2026-11-20T10:00:00.000Z";
const CORRIERI_SEME = ["BRT", "GLS", "SDA", "DHL", "UPS", "Poste Italiane"].map((nome) => ({ nome, modello: "" }));
const FRASE_CASSA_OGGI = "Finché la cassa nuova non è accesa, la tariffa vale solo per il carrello: la cassa di oggi usa ancora 4,90 €";

export async function prove(mod, { c, gruppo, radice }) {
  const SP = mod["negozio/spedizioni.server"];
  const IN = mod["negozio/interruttori.server"];
  const leggiFile = (f) => readFileSync(join(radice, f), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");

  gruppo("E-COMMERCE · R2 · T65 · LA SCHEDA «SPEDIZIONI» (22/11/2026)");

  const dove = mkdtempSync(join(tmpdir(), "spedizioni-schermata-"));
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

    const E = await tsx("src/crm/ecommerce/spedizioni/ElencoTariffe.tsx", "tariffe");
    c("ElencoTariffe.tsx si compila e porta ElencoTariffe e VistaTariffe", [true, true], ["ElencoTariffe", "VistaTariffe"].map((n) => typeof E[n] === "function"));
    if (E.__errore) c("ElencoTariffe.tsx: l'errore di compilazione", "nessuno", E.__errore);
    /** Una funzione che non c'è fa rosso la prova, non la fa crollare. */
    const fn = (nome) => (typeof E[nome] === "function" ? E[nome] : () => `«${nome}» non esiste`);

    // ── il costo: euro a schermo, centesimi interi al server ──
    const euro = fn("costoInCentesimi");
    const cent = (t) => { const r = euro(t); return r?.ok === true ? r.centesimi : r?.ok === false ? "errore" : "non esiste"; };
    c("`4,90` → 490 e `4.9` → 490 (virgola o punto, uno o due decimali)", [490, 490, 490, 490], [cent("4,90"), cent("4.9"), cent("4,9"), cent("4.90")]);
    c("interi e bordi: `5` → 500, `0` → 0, `0,05` → 5, `999` → 99900, `999,00` → 99900", [500, 0, 5, 99900, 99900], [cent("5"), cent("0"), cent("0,05"), cent("999"), cent("999,00")]);
    c("spazi e il segno dell'euro si tolgono: ` 4,90 € ` → 490", 490, cent(" 4,90 € "));
    c("`abc` → errore, vuoto → errore, segno meno → errore", ["errore", "errore", "errore", "errore"], [cent("abc"), cent(""), cent("   "), cent("-1")]);
    c("più di due decimali, due separatori, oltre i 999 euro, esponenti e cifre strane → errore (mai arrotondare in silenzio)", ["errore", "errore", "errore", "errore", "errore", "errore", "errore"],
      [cent("4,999"), cent("4,9,0"), cent("1000"), cent("999,01"), cent("1e2"), cent("0x10"), cent("4,")]);
    c("l'errore dice cosa fare: una frase in italiano con un esempio", [true, true], [(() => { const r = euro("abc"); return typeof r?.frase === "string" && r.frase.length > 15; })(), /4,90/.test(euro("abc")?.frase ?? "")]);
    c("il risultato è sempre un intero sicuro (nessun 489,99999)", true, ["4,90", "0,29", "1,15", "19,99", "8,2"].every((t) => Number.isSafeInteger(euro(t)?.centesimi)));
    c("`0,29` → 29 e `1,15` → 115 (niente errori di virgola mobile)", [29, 115], [cent("0,29"), cent("1,15")]);
    const inEuro = fn("centesimiInEuro");
    c("dai centesimi agli euro come si leggono: 490 → «4,90», 99900 → «999,00», 5 → «0,05», 0 → «0,00»", ["4,90", "999,00", "0,05", "0,00"], [inEuro(490), inEuro(99900), inEuro(5), inEuro(0)]);

    // ── il modulo: dal testo a ciò che va al server ──
    const tariffaVista = (extra = {}) => ({ id: ID_TARIFFA_SEME, nome: "Spedizione tracciata in Italia", corriere: null, costoCent: 490, giorniMin: null, giorniMax: null, attiva: true, provvisoria: true, confermata: false, confermataIl: null, aggiornatoIl: ISTANTE, ...extra });
    const modulo = (extra = {}) => ({ ...fn("moduloDaTariffa")(tariffaVista()), ...extra });
    const m0 = modulo();
    c("dal seme: nome, costo «4,90», niente corriere né tempi, attiva", ["Spedizione tracciata in Italia", "4,90", "", "", "", true], [m0.nome, m0.costo, m0.corriere, m0.giorniMin, m0.giorniMax, m0.attiva]);
    const v0 = fn("verificaModulo")(m0);
    c("un modulo buono → i campi del server, con il costo in centesimi INTERI e i tempi vuoti = null", [true, 490, null, null, true, null], [v0.ok, v0.campi?.costoCent, v0.campi?.giorniMin, v0.campi?.giorniMax, v0.campi?.attiva, v0.campi?.corriere]);
    const v1 = fn("verificaModulo")(modulo({ costo: "5,9", corriere: " BRT ", giorniMin: "2", giorniMax: "4" }));
    c("«5,9», corriere «BRT» (tolti gli spazi), tempi 2 e 4 → 590, «BRT», 2, 4", [590, "BRT", 2, 4], [v1.campi?.costoCent, v1.campi?.corriere, v1.campi?.giorniMin, v1.campi?.giorniMax]);
    const vErr = fn("verificaModulo")(modulo({ costo: "abc" }));
    c("costo «abc» → il modulo non è valido, l'errore sta sul costo e dice la frase", [false, true], [vErr.ok, typeof vErr.errori?.costo === "string" && vErr.errori.costo.length > 15]);
    c("nome vuoto → errore sul nome", true, typeof fn("verificaModulo")(modulo({ nome: "  " })).errori?.nome === "string");
    c("nome oltre 80 segni → errore sul nome", true, typeof fn("verificaModulo")(modulo({ nome: "x".repeat(81) })).errori?.nome === "string");
    c("corriere oltre 40 segni → errore sul corriere", true, typeof fn("verificaModulo")(modulo({ corriere: "x".repeat(41) })).errori?.corriere === "string");
    const tempiMale = [["2", ""], ["", "4"], ["5", "3"], ["0", "3"], ["2", "61"], ["1,5", "3"], ["a", "b"]].map(([a, b]) => fn("verificaModulo")(modulo({ giorniMin: a, giorniMax: b })));
    c("tempi: uno solo, minimo oltre il massimo, zero, oltre 60, decimali, lettere → tutti errore sui tempi", Array(7).fill(true), tempiMale.map((v) => v.ok === false && typeof v.errori?.tempi === "string"));
    c("tempi giusti (1-60, minimo ≤ massimo, anche uguali) passano", [true, true], [fn("verificaModulo")(modulo({ giorniMin: "1", giorniMax: "60" })).ok, fn("verificaModulo")(modulo({ giorniMin: "3", giorniMax: "3" })).ok]);
    c("modulo cambiato o no, rispetto alla tariffa vista", [false, true, true, true, true], [
      fn("moduloCambiato")(m0, tariffaVista()), fn("moduloCambiato")(modulo({ costo: "5,00" }), tariffaVista()), fn("moduloCambiato")(modulo({ nome: "Altro" }), tariffaVista()),
      fn("moduloCambiato")(modulo({ attiva: false }), tariffaVista()), fn("moduloCambiato")(modulo({ giorniMin: "2", giorniMax: "4" }), tariffaVista()),
    ]);
    c("«4,9» al posto di «4,90» NON è un cambio (stesso importo)", false, fn("moduloCambiato")(modulo({ costo: "4,9" }), tariffaVista()));

    // ── i corrieri e il link di prova ──
    const link = fn("linkDiProva");
    const elenco = [{ nome: "BRT", modello: "https://vai.brt.example/track?n={numero}" }, { nome: "GLS", modello: "" }, { nome: "Cattivo", modello: "https://{numero}.sito.example/" }];
    const lp = link(elenco, "AB 12/3");
    c("«metti un numero e guarda il link»: il numero si codifica nel modello; senza modello niente link; modello con il numero nell'host niente link", ["https://vai.brt.example/track?n=AB%2012%2F3", null, null], [lp?.[0]?.link ?? "x", lp?.[1]?.link ?? null, lp?.[2]?.link ?? null]);
    c("…senza numero nessun link per nessuno", [null, null, null], (Array.isArray(link(elenco, "  ")) ? link(elenco, "  ") : []).map((x) => x.link));
    const cc = fn("controllaCorrieri");
    c("elenco buono → nessuna frase; nome vuoto, doppione (anche con le maiuscole), modello `http://` o senza {numero}, oltre 20 voci → una frase", [null, "frase", "frase", "frase", "frase", "frase"], [
      cc(elenco.slice(0, 2)), ...[
        [{ nome: " ", modello: "" }], [{ nome: "BRT", modello: "" }, { nome: "brt", modello: "" }], [{ nome: "X", modello: "http://x.example/{numero}" }], [{ nome: "X", modello: "https://x.example/" }],
        Array.from({ length: 21 }, (_, i) => ({ nome: `C${i}`, modello: "" })),
      ].map((e) => (typeof cc(e) === "string" && cc(e).length > 10 ? "frase" : cc(e))),
    ]);

    // ── le chiamate, col SERVER VERO di T50 (spedizioni) e di T56 (interruttori) e il database finto ──
    const tabelle = (extra = {}) => ({
      shop_spedizioni_tariffe: [tariffaSeme()],
      shop_impostazioni: [
        { chiave: "corrieri", valore: structuredClone(CORRIERI_SEME), aggiornato_il: ISTANTE, aggiornato_da: null },
        { chiave: "cassa_sito", valore: "vecchia", aggiornato_il: ISTANTE, aggiornato_da: null },
        { chiave: "catalogo_sito", valore: "cms", aggiornato_il: ISTANTE, aggiornato_da: null }, // T68: `stripe` vale solo col catalogo `cms` (cassaEffettiva)
        { chiave: "pagamento_sicuro", valore: false, aggiornato_il: ISTANTE, aggiornato_da: null },
        { chiave: "metodi_pagamento", valore: ["carta"], aggiornato_il: ISTANTE, aggiornato_da: null },
        { chiave: "resi_confermati", valore: false, aggiornato_il: ISTANTE, aggiornato_da: null },
      ],
      shop_storico: [],
      ...extra,
    });
    const fatti = () => ({ bannerPresente: true, chiavePresente: true, segretoPresente: true, tariffaAttiva: true, s4Presente: true, pagamentoIncassa: false });
    /** La `fetch` della pagina collegata ai due server veri: `?spedizioni` e le azioni di tariffa e corrieri vanno a T50, `?cassa` e gli interruttori a T56. */
    const portaServer = (opz = {}) => {
      const db = opz.db ?? fintoDb({ tabelle: opz.tabelle ?? tabelle() });
      const chiamate = [];
      const f = async (url, init = {}) => {
        const corpo = init.body ? JSON.parse(init.body) : null;
        chiamate.push({ url, metodo: init.method ?? "GET", corpo });
        const { d } = porte({ db, fattiEsterni: fatti });
        if (init.method === "POST") {
          const r = new Request(`https://sito.test${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: init.body });
          return corpo?.azione === "interruttore_imposta" ? IN.gestisciPOST(r, d) : SP.gestisciPOST(r, d);
        }
        const q = url.split("?")[1] ?? "";
        return q.startsWith("spedizioni") ? SP.gestisciGET(get(q), d) : IN.gestisciGET(get(q), d);
      };
      return { f, db, chiamate };
    };
    const riga = (db) => db.tabelle.shop_spedizioni_tariffe.find((r) => r.id === ID_TARIFFA_SEME);
    const imp = (db, chiave) => db.tabelle.shop_impostazioni.find((r) => r.chiave === chiave)?.valore;

    c("gli indirizzi sono quelli che esistono già: nessuna rotta nuova", ["/api/crm/negozio?spedizioni"], [E.urlSpedizioni]);

    const a = portaServer();
    const k = await fn("caricaSpedizioni")(a.f);
    c("leggere la scheda: UNA GET a ?spedizioni e UNA a ?cassa (per `resi_confermati`), niente altro", [2, "GET", "GET", true, true], [a.chiamate.length, a.chiamate[0]?.metodo, a.chiamate[1]?.metodo, a.chiamate.some((x) => x.url === "/api/crm/negozio?spedizioni"), a.chiamate.some((x) => x.url === "/api/crm/negozio?cassa")]);
    c("dal server vero: la tariffa del seme (490, non confermata), i sei corrieri e «resi non confermati»", [true, ID_TARIFFA_SEME, 490, false, ISTANTE, 6, false], [k.ok, k.tariffa?.id, k.tariffa?.costoCent, k.tariffa?.confermata, k.tariffa?.aggiornatoIl, k.corrieri?.length, k.resi]);
    const stripeAcceso = tabelle().shop_impostazioni.map((r) => (r.chiave === "cassa_sito" ? { ...r, valore: "stripe" } : r));
    const kStripe = await fn("caricaSpedizioni")(portaServer({ tabelle: tabelle({ shop_impostazioni: stripeAcceso }) }).f);
    c("la cassa che il sito usa si legge da `?cassa`: «vecchia» col seme, «stripe» se è accesa", ["vecchia", "stripe"], [k.cassa, kStripe.cassa]);
    const kSenzaCassa = await fn("caricaSpedizioni")(portaServer({ tabelle: tabelle({ shop_impostazioni: tabelle().shop_impostazioni.filter((r) => r.chiave !== "cassa_sito") }) }).f);
    c("se `cassa_sito` non si legge (seme assente) vale «null»: l'avviso resta visibile", [true, null], [kSenzaCassa.ok, kSenzaCassa.cassa ?? null]);
    c("…la soglia gratuita non arriva alla scheda (nemmeno come campo)", false, /gratis|gratuit|soglia/i.test(JSON.stringify(k)));
    const kSenzaSeme = await fn("caricaSpedizioni")(portaServer({ tabelle: tabelle({ shop_impostazioni: tabelle().shop_impostazioni.filter((r) => r.chiave !== "resi_confermati") }) }).f);
    c("senza il seme dei resi (S5 non applicata del tutto) la scheda arriva lo stesso, con `resi` «null» (l'interruttore non si può girare)", [true, null], [kSenzaSeme.ok, kSenzaSeme.resi ?? null]);
    const kNo = await fn("caricaSpedizioni")(portaServer({ db: fintoDb({ tabelle: tabelle(), mancante: ["shop_spedizioni_tariffe"] }) }).f);
    c("tabella delle tariffe assente → un errore con la sua frase (non una scheda vuota che sembra a posto)", [false, true], [kNo.ok, typeof kNo.messaggio === "string" && kNo.messaggio.length > 15]);
    const k403 = await fn("caricaSpedizioni")(async () => new Response(JSON.stringify({ ok: false }), { status: 403, headers: { "Content-Type": "application/json" } }));
    c("403 → «permesso», senza dati", [false, "permesso"], [k403.ok, k403.tipo]);

    // salvare: valore visto, centesimi interi
    const s = portaServer();
    const rs = await fn("salvaTariffa")(s.f, tariffaVista(), modulo({ costo: "5,9", corriere: "BRT", giorniMin: "2", giorniMax: "4" }));
    const post1 = s.chiamate.find((x) => x.metodo === "POST");
    c("«Salva»: UN POST con la versione vista (`atteso`), l'id, il costo in centesimi INTERI e i tempi", [1, "tariffa_salva", ISTANTE, ID_TARIFFA_SEME, 590, true, "BRT", 2, 4, true], [
      s.chiamate.filter((x) => x.metodo === "POST").length, post1?.corpo?.azione, post1?.corpo?.atteso, post1?.corpo?.id, post1?.corpo?.costoCent, Number.isInteger(post1?.corpo?.costoCent), post1?.corpo?.corriere, post1?.corpo?.giorniMin, post1?.corpo?.giorniMax, post1?.corpo?.attiva,
    ]);
    c("…riuscito, e nel database ora c'è 590 (e la soglia non è stata toccata)", [true, 590, "BRT", null], [rs.ok, riga(s.db).costo_cent, riga(s.db).corriere, riga(s.db).gratis_da_cent]);
    c("…il corpo non porta nessun campo della soglia gratuita", false, /gratis|gratuit|soglia/i.test(JSON.stringify(post1?.corpo)));
    const sNon = portaServer();
    const rNon = await fn("salvaTariffa")(sNon.f, tariffaVista(), modulo({ costo: "abc" }));
    c("costo «abc»: non parte NESSUNA richiesta e l'errore dice perché", [false, 0, true], [rNon.ok, sNon.chiamate.length, typeof rNon.messaggio === "string" && rNon.messaggio.length > 15]);

    // il 409: un'altra persona ha cambiato la tariffa
    const sv = portaServer({ db: fintoDb({ tabelle: tabelle({ shop_spedizioni_tariffe: [tariffaSeme({ costo_cent: 690, aggiornato_il: "2026-11-20T11:00:00.000Z" })] }) }) });
    const rv = await fn("salvaTariffa")(sv.f, tariffaVista(), modulo({ costo: "5,9" }));
    c("versione vista vecchia → «conflitto» con la frase del server, e nel database non è cambiato niente", [false, "conflitto", true, 690], [rv.ok, rv.tipo, /altra persona|ricarica/i.test(rv.messaggio ?? ""), riga(sv.db).costo_cent]);

    // conferma
    const cf = portaServer();
    const rcf = await fn("confermaTariffa")(cf.f, tariffaVista());
    const postCf = cf.chiamate.find((x) => x.metodo === "POST");
    c("«Conferma la tariffa»: UN POST con l'id e la versione vista, niente costi né nomi", [1, "tariffa_conferma", ID_TARIFFA_SEME, ISTANTE, ["atteso", "azione", "id"]], [
      cf.chiamate.filter((x) => x.metodo === "POST").length, postCf?.corpo?.azione, postCf?.corpo?.id, postCf?.corpo?.atteso, Object.keys(postCf?.corpo ?? {}).sort(),
    ]);
    c("…nel database la tariffa non è più provvisoria e c'è la data della conferma", [true, false, true], [rcf.ok, riga(cf.db).provvisoria, typeof riga(cf.db).confermata_il === "string"]);
    const rcf2 = await fn("confermaTariffa")(portaServer({ db: fintoDb({ tabelle: tabelle({ shop_spedizioni_tariffe: [tariffaSeme({ aggiornato_il: "2026-11-20T11:00:00.000Z" })] }) }) }).f, tariffaVista());
    c("conferma con la versione vecchia → «conflitto», non conferma niente", [false, "conflitto"], [rcf2.ok, rcf2.tipo]);

    // «Salva» su una tariffa già confermata: l'avviso del server arriva alla scheda
    const gia = portaServer({ db: fintoDb({ tabelle: tabelle({ shop_spedizioni_tariffe: [tariffaSeme({ provvisoria: false, confermata_il: "2026-11-20T10:30:00.000Z", corriere: "BRT", giorni_min: 2, giorni_max: 4 })] }) }) });
    const rg = await fn("salvaTariffa")(gia.f, tariffaVista({ provvisoria: false, confermata: true, corriere: "BRT", giorniMin: 2, giorniMax: 4 }), modulo({ costo: "5,00", corriere: "BRT", giorniMin: "2", giorniMax: "4" }));
    c("salvare una tariffa già confermata: la scheda riceve l'avviso «subito visibile ai clienti»", [true, true], [rg.ok, /subito visibile ai clienti/.test(rg.avviso ?? "")]);

    // corrieri
    const cr = portaServer();
    const nuovi = [...CORRIERI_SEME.slice(1), { nome: "BRT", modello: "https://vai.brt.example/track?n={numero}" }];
    const rcr = await fn("salvaCorrieri")(cr.f, nuovi, CORRIERI_SEME);
    const postCr = cr.chiamate.find((x) => x.metodo === "POST");
    c("corrieri: UN POST con l'elenco nuovo e l'elenco VISTO (`atteso`)", [1, "corrieri_salva", 6, 6], [cr.chiamate.filter((x) => x.metodo === "POST").length, postCr?.corpo?.azione, postCr?.corpo?.corrieri?.length, postCr?.corpo?.atteso?.length]);
    c("…riuscito e salvato nel database", [true, "https://vai.brt.example/track?n={numero}"], [rcr.ok, imp(cr.db, "corrieri")?.find((x) => x.nome === "BRT")?.modello]);
    const rcrN = await fn("salvaCorrieri")(portaServer().f, [{ nome: "X", modello: "http://x.example/{numero}" }], CORRIERI_SEME);
    c("un modello `http://`: il server lo rifiuta con la sua frase (e la scheda la mostra)", [false, "rifiutato", true], [rcrN.ok, rcrN.tipo, /https/.test(rcrN.messaggio ?? "")]);
    const crv = portaServer({ db: fintoDb({ tabelle: tabelle({ shop_impostazioni: tabelle().shop_impostazioni.map((r) => (r.chiave === "corrieri" ? { ...r, valore: [{ nome: "BRT", modello: "" }] } : r)) }) }) });
    const rcrv = await fn("salvaCorrieri")(crv.f, nuovi, CORRIERI_SEME);
    c("elenco visto vecchio → «conflitto»", [false, "conflitto"], [rcrv.ok, rcrv.tipo]);

    // resi
    const rz = portaServer();
    const rr = await fn("impostaResi")(rz.f, true, false);
    const postRz = rz.chiamate.find((x) => x.metodo === "POST");
    c("«Spedizioni e resi sono scritti nelle pagine»: POST `interruttore_imposta` su `resi_confermati`, con il valore visto", [1, { azione: "interruttore_imposta", chiave: "resi_confermati", valore: true, atteso: false }, true, true], [
      rz.chiamate.filter((x) => x.metodo === "POST").length, postRz?.corpo, rr.ok, imp(rz.db, "resi_confermati")]);
    const rr2 = await fn("impostaResi")(portaServer().f, false, true); // io credevo fosse acceso: nel database è spento
    c("resi: valore visto vecchio → «conflitto»", [false, "conflitto"], [rr2.ok, rr2.tipo]);
    const rr3 = await fn("impostaResi")(portaServer().f, "si", false);
    c("resi: un valore che non è sì/no non parte nemmeno", false, rr3.ok);

    // la rete cade a metà di un salvataggio: dice che non sa se è stato scritto
    const eRete = await fn("salvaTariffa")(async () => { throw new Error("giù"); }, tariffaVista(), modulo({ costo: "5,9" }));
    c("rete caduta durante il salvataggio: «rete» e la frase dice che può essere stato scritto", ["rete", true], [eRete.tipo, /non so|controlla/i.test(eRete.messaggio ?? "")]);

    // ── la schermata, disegnata sul serio ──
    const testo = (x) => x.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
    const tagPer = (html, attr, val) => html.match(new RegExp(`<(?:button|input)[^>]*${attr}="${val}"[^>]*>`))?.[0] ?? "";
    const spento = (t) => /\sdisabled(=|\s|>)/.test(t);
    const acceso = (t) => /aria-checked="true"/.test(t) || /\schecked(=|\s|>)/.test(t);
    const dati = (extra = {}) => ({ tariffa: tariffaVista(), corrieri: CORRIERI_SEME, resi: false, cassa: "vecchia", ...extra });
    const base = (extra = {}) => ({
      dati: dati(), errore: null, modulo: modulo(), corrieri: CORRIERI_SEME, numeroProva: "", lavoro: null, esito: null,
      onModulo: () => {}, onSalva: () => {}, onConferma: () => {}, onCorrieri: () => {}, onSalvaCorrieri: () => {}, onNumeroProva: () => {}, onResi: () => {}, onRiprova: () => {},
      ...extra,
    });
    const vista = (extra) => (typeof E.VistaTariffe === "function" ? renderToStaticMarkup(h(E.VistaTariffe, base(extra))) : "");
    const T = (extra) => testo(vista(extra));

    const html = vista();
    const t0 = testo(html);
    c("tariffa del seme: l'etichetta «Provvisoria», il costo «4,90» nel campo, il nome", [true, true, true], [/Provvisoria/.test(t0), tagPer(html, "id", "tariffa-costo").includes('value="4,90"'), tagPer(html, "id", "tariffa-nome").includes("Spedizione tracciata in Italia")]);
    c("…«Conferma la tariffa» c'è e si può premere (nessuna modifica in sospeso)", [true, false], [/Conferma la tariffa/.test(t0), spento((html.match(/<button[^>]*>[^<]*(?:<[^>]*>[^<]*)*?Conferma la tariffa/g) ?? [""]).pop().match(/<button[^>]*>/g)?.pop() ?? "")]);
    c("…e dice cosa cambia confermando: finché non è confermata ai clienti arriva solo il costo (D62)", true, /finché non la confermi[^.]*solo il costo/i.test(t0));
    const tConf = T({ dati: dati({ tariffa: tariffaVista({ provvisoria: false, confermata: true, confermataIl: "2026-11-20T10:30:00.000Z", corriere: "BRT", giorniMin: 2, giorniMax: 4 }) }), modulo: modulo({ corriere: "BRT", giorniMin: "2", giorniMax: "4" }) });
    c("tariffa confermata: «Confermata», nessuna etichetta «Provvisoria», nessun «Conferma la tariffa»", [true, false, false], [/Confermata/.test(tConf), /Provvisoria/.test(tConf), /Conferma la tariffa/.test(tConf)]);
    c("…ma con una modifica non salvata dice di salvare prima", true, /salva prima/i.test(T({ modulo: modulo({ costo: "5,9" }) })));
    const bConf = (h2) => { const i = h2.indexOf("Conferma la tariffa"); return i < 0 ? "" : h2.slice(0, i).match(/<button[^>]*>(?![\s\S]*<button)/)?.[0] ?? ""; };
    c("«Conferma la tariffa» è spento mentre ci sono modifiche non salvate e quando il costo non è valido", [false, true, true], [spento(bConf(html)), spento(bConf(vista({ modulo: modulo({ costo: "5,9" }) }))), spento(bConf(vista({ modulo: modulo({ costo: "abc" }) })))]);
    const bSalva = (h2) => { const i = h2.indexOf("Salva la tariffa"); return i < 0 ? "" : h2.slice(0, i).match(/<button[^>]*>(?![\s\S]*<button)/)?.[0] ?? ""; };
    c("«Salva la tariffa» è spento senza modifiche, acceso con una modifica valida, spento con un costo sbagliato", [true, false, true], [spento(bSalva(html)), spento(bSalva(vista({ modulo: modulo({ costo: "5,9" }) }))), spento(bSalva(vista({ modulo: modulo({ costo: "abc" }) })))]);
    const vAbc = vista({ modulo: modulo({ costo: "abc" }) });
    c("costo «abc»: sotto il campo c'è la frase d'errore (con l'esempio) e il campo è segnato come non valido", [true, true], [/Scrivi il costo in euro[^.]*4,90/.test(testo(vAbc)), /aria-invalid="true"/.test(tagPer(vAbc, "id", "tariffa-costo"))]);
    c("il campo del costo ha il simbolo dell'euro e la tastiera dei numeri decimali", [true, true], [/€/.test(t0), /inputMode="decimal"|inputmode="decimal"/i.test(tagPer(html, "id", "tariffa-costo"))]);

    c("l'avviso della cassa di oggi è sempre visibile, con le parole del capo progetto", true, t0.includes(FRASE_CASSA_OGGI));
    c("…anche mentre i dati arrivano e anche quando la lettura è fallita", [true, true], [T({ dati: null }).includes(FRASE_CASSA_OGGI), T({ dati: null, errore: "Non riesco a collegarmi al server." }).includes(FRASE_CASSA_OGGI)]);
    c("…e anche con la tariffa confermata", true, tConf.includes(FRASE_CASSA_OGGI));
    c("…e con la cassa letta «vecchia» o non letta (`null`)", [true, true], [T({ dati: dati({ cassa: "vecchia" }) }).includes(FRASE_CASSA_OGGI), T({ dati: dati({ cassa: null }) }).includes(FRASE_CASSA_OGGI)]);
    c("con la cassa Stripe accesa l'avviso dei 4,90 € NON c'è (la tariffa vale anche per la cassa)", [false, false], [T({ dati: dati({ cassa: "stripe" }) }).includes(FRASE_CASSA_OGGI), /4,90 €/.test(T({ dati: dati({ cassa: "stripe" }), modulo: modulo({ costo: "5,00" }) }))]);
    c("…ma il resto della scheda c'è lo stesso (tariffa, corrieri, resi)", [true, true, true], ["Tariffa per l'Italia", "Corrieri e link di tracciamento", "Spedizioni e resi sono scritti nelle pagine"].map((x) => T({ dati: dati({ cassa: "stripe" }) }).includes(x)));
    c("…è un avviso (role=status), non un errore", true, /role="status"[^>]*>[\s\S]{0,900}la cassa di oggi usa ancora 4,90/.test(html));

    const frCassaChiusa = (t) => /cassa Stripe resta chiusa/i.test(t) && /Il negozio sta per aprire/.test(t);
    c("con la tariffa attiva NON dice che la cassa resterà chiusa", false, frCassaChiusa(t0));
    c("senza nessuna tariffa nel database: dice che la cassa Stripe resta chiusa e che il cliente vede «Il negozio sta per aprire»", true, frCassaChiusa(T({ dati: dati({ tariffa: null }), modulo: modulo() })));
    c("con la tariffa spenta (non attiva): stessa frase", true, frCassaChiusa(T({ dati: dati({ tariffa: tariffaVista({ attiva: false }) }), modulo: modulo({ attiva: false }) })));
    c("se hai appena spento «attiva» nel modulo (non ancora salvato) lo dice già, accanto all'interruttore", true, /resta chiusa/i.test(T({ modulo: modulo({ attiva: false }) })));
    c("senza tariffa non si disegna un modulo da compilare nel vuoto: niente «Salva la tariffa»", false, /Salva la tariffa/.test(T({ dati: dati({ tariffa: null }) })));

    c("la soglia gratuita non si mostra: nessuna parola «gratis», «gratuit», «soglia» nella scheda", false, /gratis|gratuit|soglia/i.test(t0 + tConf));
    c("i tempi vuoti restano vuoti (nessun «0»), e si spiega che vuoti non si mostrano", [true, true], [tagPer(html, "id", "tariffa-giorni-min").includes('value=""'), /vuoti[^.]*non si mostrano|lasciali vuoti/i.test(t0)]);
    c("attiva: l'interruttore è acceso per la tariffa attiva e spento per quella spenta", [true, false], [acceso(tagPer(html, "aria-label", "Tariffa attiva")), acceso(tagPer(vista({ modulo: modulo({ attiva: false }) }), "aria-label", "Tariffa attiva"))]);

    // corrieri nella schermata
    c("i corrieri del seme si leggono e ognuno ha il campo del modello di link", [true, true, true], [/BRT/.test(vista()) && /Poste Italiane/.test(vista()), (html.match(/aria-label="Modello di link di [^"]+"/g) ?? []).length >= 6, /https:\/\/[^.]*\{numero\}|\{numero\}/.test(t0)]);
    const vCorr = vista({ corrieri: elenco.slice(0, 1), numeroProva: "AB123" });
    c("la prova del link: un campo «Numero di prova» e, con un numero, il link che ne esce", [true, true], [tagPer(vCorr, "id", "numero-prova").includes('value="AB123"'), testo(vCorr).includes("https://vai.brt.example/track?n=AB123")]);
    c("…senza un numero invita a scriverlo e non mostra nessun link", [true, false], [/Metti un numero/i.test(t0), /https:\/\/vai/.test(t0)]);
    c("al massimo 20 corrieri: a 20 «Aggiungi un corriere» è spento", [false, true], [spento(tagPer(vista(), "aria-label", "Aggiungi un corriere")), spento(tagPer(vista({ corrieri: Array.from({ length: 20 }, (_, i) => ({ nome: `C${i}`, modello: "" })) }), "aria-label", "Aggiungi un corriere"))]);
    c("«Salva i corrieri» è spento senza modifiche e con un elenco sbagliato, acceso con una modifica buona", [true, true, false], [
      spento(tagPer(html, "aria-label", "Salva i corrieri")),
      spento(tagPer(vista({ corrieri: [{ nome: "", modello: "" }] }), "aria-label", "Salva i corrieri")),
      spento(tagPer(vista({ corrieri: [...CORRIERI_SEME, { nome: "Nuovo", modello: "" }] }), "aria-label", "Salva i corrieri")),
    ]);

    // resi
    const swResi = tagPer(html, "aria-label", "Spedizioni e resi sono scritti nelle pagine");
    c("l'interruttore dei resi c'è, è spento e si può girare; acceso se `resi_confermati` è vero", [true, false, false, true], [
      swResi !== "", acceso(swResi), spento(swResi), acceso(tagPer(vista({ dati: dati({ resi: true }) }), "aria-label", "Spedizioni e resi sono scritti nelle pagine")),
    ]);
    const vSenzaSeme = vista({ dati: dati({ resi: null }) });
    c("senza il seme dei resi l'interruttore è spento e dice di applicare l'aggiornamento delle spedizioni", [true, true], [spento(tagPer(vSenzaSeme, "aria-label", "Spedizioni e resi sono scritti nelle pagine")), /aggiornamento[^.]*spedizioni|S5/i.test(testo(vSenzaSeme))]);
    c("spiega a cosa serve: lo shop non si apre finché le pagine di spedizioni e resi non sono scritte", true, /pagine[^.]*(spedizioni|resi)[^.]*(shop|aprire)|(shop|aprire)[^.]*pagine[^.]*(spedizioni|resi)/i.test(t0));

    // stati: errore, attesa, occupato, esito
    c("lettura fallita: la frase e «Riprova»; nessun dato vecchio, nessun modulo", [true, true, false], [/La sessione è scaduta/.test(T({ dati: null, errore: "La sessione è scaduta: rientra nel CRM." })), /Riprova/.test(T({ dati: null, errore: "La sessione è scaduta: rientra nel CRM." })), /Salva la tariffa/.test(T({ dati: null, errore: "La sessione è scaduta: rientra nel CRM." }))]);
    c("dati non ancora arrivati: dice che arrivano (tariffe) e non mostra moduli da compilare", [true, true, false], [/tariff/i.test(T({ dati: null })), /arriv/i.test(T({ dati: null })), /Salva la tariffa/.test(T({ dati: null }))]);
    c("mentre una richiesta è in corso tutti i bottoni e gli interruttori stanno fermi", [true, true, true, true], [
      spento(bSalva(vista({ modulo: modulo({ costo: "5,9" }), lavoro: "tariffa" }))), spento(bConf(vista({ lavoro: "tariffa" }))), spento(tagPer(vista({ lavoro: "resi" }), "aria-label", "Spedizioni e resi sono scritti nelle pagine")),
      spento(tagPer(vista({ lavoro: "tariffa" }), "aria-label", "Aggiungi un corriere")),
    ]);
    c("l'esito sta nel riquadro dove si è lavorato: tariffa, corrieri, resi (una volta sola ciascuno)", [true, true, true, 1], [
      testo(vista({ esito: { tono: "ok", testo: "ESITO-TARIFFA", dove: "tariffa" } })).indexOf("Tariffa per l'Italia") < testo(vista({ esito: { tono: "ok", testo: "ESITO-TARIFFA", dove: "tariffa" } })).indexOf("ESITO-TARIFFA"),
      testo(vista({ esito: { tono: "errore", testo: "ESITO-CORRIERI", dove: "corrieri" } })).indexOf("Corrieri") < testo(vista({ esito: { tono: "errore", testo: "ESITO-CORRIERI", dove: "corrieri" } })).indexOf("ESITO-CORRIERI"),
      testo(vista({ esito: { tono: "ok", testo: "ESITO-RESI", dove: "resi" } })).includes("ESITO-RESI"),
      testo(vista({ esito: { tono: "ok", testo: "ESITO-TARIFFA", dove: "tariffa" } })).split("ESITO-TARIFFA").length - 1,
    ]);
    c("un esito d'errore si annuncia come avviso (role=alert), uno riuscito come stato", [true, true], [/role="alert"[^>]*>[\s\S]{0,800}ESITO-X/.test(vista({ esito: { tono: "errore", testo: "ESITO-X", dove: "tariffa" } })), /role="status"[^>]*>[\s\S]{0,600}ESITO-Y/.test(vista({ esito: { tono: "ok", testo: "ESITO-Y", dove: "tariffa" } }))]);
    c("«Elimina», «Cancella», «Rimuovi» non esistono nella scheda", false, /elimin|cancell|rimuov|delete/i.test(t0 + T({ dati: dati({ tariffa: null }) })));

    // il segnaposto di T62 è sparito
    c("il segnaposto «arrivano con il prossimo aggiornamento» non c'è più", false, /prossimo aggiornamento/i.test(t0));
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }

  // ── i file ──
  const FILE = "src/crm/ecommerce/spedizioni/ElencoTariffe.tsx";
  let sorgente = null;
  try { sorgente = leggiFile(FILE); } catch { /* il file non c'è */ }
  c("il file del compito esiste", true, sorgente !== null);
  const nudo = senzaCommenti(sorgente ?? "");
  c("nessuna chiave, nessun ambiente, nessun log, nessun accesso diretto al database", false, /\b(sk|rk|pk)_(test|live)|whsec_|STRIPE_(SECRET|WEBHOOK)|process\.env|import\.meta\.env|console\.|@\/integrations\/supabase|createClient|\.from\(["']/.test(nudo));
  c("«Elimina», «Cancella», «Rimuovi» non esistono nel file (nemmeno come parola di una frase)", false, /elimin|cancell|rimuov|delete/i.test(nudo.replace(/\/api\/[^"'`\s]*/g, "")));
  c("la soglia gratuita non è nel file: né `gratis_da_cent` né «gratis» né «soglia»", false, /gratis|gratuit|soglia/i.test(nudo));
  c("parla solo con `/api/crm/negozio`: nessun altro indirizzo, nessuna rotta nuova", [], [...new Set((nudo.match(/\/api\/[a-z0-9/_-]+/gi) ?? []))].filter((u) => u !== "/api/crm/negozio"));
  c("non usa `window.confirm`, `alert()` né `prompt()`", false, /window\.(confirm|alert|prompt)|\balert\(|\bconfirm\(|\bprompt\(/.test(nudo));
  c("le richieste passano da `chiamaRotta` di T62 (una sola implementazione di errori e frasi), non da un `fetch` scritto qui", [true, false], [/chiamaRotta/.test(nudo), /(?<![A-Za-z.])fetch\(/.test(nudo)]);
  c("la lettura parte da un effetto, mai nel disegno e mai a livello di modulo", true, /useEffect\(\(\) => \{[\s\S]{0,300}void carica\(\)/.test(nudo));
}
