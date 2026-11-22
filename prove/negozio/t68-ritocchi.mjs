/** ── NEGOZIO · R2 · T68 PARTE 3 · I RITOCCHI CHIESTI DAI REVISORI ────────────────────────────────────────
 *  Un controllo per ogni punto della lista «Da mettere in T68» (LAVAGNA, Onda 5), visti rossi prima del codice:
 *   1. la frase di `rimborso_transizione_ignorata` è neutra;
 *   2. «Annulla l'ordine…» si spegne con «Rimborsa» (rimborso in corso, rimborsi illeggibili), non per «niente da rimborsare»;
 *      la finestra di annullo dice «non si può annullare» accanto a «Rimborsa ora»;
 *   3. la frase della giacenza nomina il tasto vero; una «Correggi» fallita non chiude il modulo;
 *   4. `ElencoTariffe`: riallineo della sola parte salvata, `role="alert"` sugli errori, messaggio del nome del corriere vuoto;
 *   5. cassa `stripe` con catalogo `codice`: l'avviso dei 4,90 € c'è, con la frase giusta (`?cassa` porta `catalogo_sito`);
 *   6. `FRASE_TESTO_CAMBIATO` non dice più di ricaricare;
 *   7. `NON_PAGATI` e il predicato della fattura stanno in `ordini-ui.ts`; un solo `Riquadro`.
 *  Schermate con `react-dom/server` su dati inventati, server veri su database finto. Nessuna rete, nessun dato vero. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { rigaOrdineProva } from "../ecommerce/dati.mjs";
import { fintoDb } from "./_finto-db.mjs";
import { tabelleProva } from "./dati.mjs";
import { porte, get, leggi } from "./_server.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const ID = uuid(1);
const CHIAVE = "11111111-1111-4111-8111-111111111111";
const ISTANTE = "2026-11-20T10:00:00.000Z";

export async function prove(mod, { c, gruppo, radice }) {
  const O = mod["ecommerce/ordine"];
  const U = mod["ecommerce/ordini-ui"];
  const IN = mod["negozio/interruttori.server"];
  const leggiFile = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : "");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  gruppo("NEGOZIO R2 · I RITOCCHI DEI REVISORI (T68 parte 3)");

  const stripe = (extra = {}) =>
    O.normalizzaOrdine(rigaOrdineProva({
      id: ID, order_ref: "HG-T68C", stato_pagamento: "pagato", pagato_il: "2026-11-21T12:00:00.000Z", pagato_importo: 24.9,
      metodo_pagamento: "stripe", metodo_dettaglio: "card", canale: "sito", totale_cent: 2490, fattura_richiesta: true,
      stripe_sessione_id: "cs_test_SESSIONE_FINTA", stripe_pagamento_id: "pi_test_PAGAMENTO_FINTO", ...extra,
    }));
  const rimb = (n, importoCent, stato) => ({
    id: uuid(100 + n), importoCent, stato, motivo: "Prova di rimborso", origine: "crm", chi: "Giulia Esempio",
    creatoIl: "2026-11-21T11:00:00.000Z", aggiornatoIl: "2026-11-21T11:00:00.000Z", stripeRimborsoId: "re_test_RIMBORSO_FINTO",
  });

  // ══ 1 · 2 · 3 · 7 · LE REGOLE PURE DI ordini-ui.ts ═══════════════════════════════════════════════════════
  const E = U.ETICHETTA_AVVISO ?? {};
  c("1 · rimborso_transizione_ignorata: la frase neutra (non dice chi ha ragione)", "Il registro dei rimborsi e Stripe non dicono la stessa cosa: controlla su Stripe.", E.rimborso_transizione_ignorata);
  c("3 · giacenza_da_verificare: nomina il tasto «Segna verificata», non «Giacenza verificata»", [true, false], [/«Segna verificata»/.test(E.giacenza_da_verificare ?? ""), /Giacenza verificata/.test(E.giacenza_da_verificare ?? "")]);

  const pagato = stripe();
  const inAttesa = stripe({ stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null });
  const t = (extra) => (typeof U.tastoRimborso === "function" ? U.tastoRimborso({ ordine: pagato, rimborsi: [], inInvio: false, blocco: null, ...extra }) : {});
  c("2 · annullaSpento: acceso con rimborsi leggibili e qualcosa da rimborsare", false, t().annullaSpento);
  c("2 · …spento con un rimborso in corso (blocco sullo stesso elenco)", true, (() => { const r = []; return t({ rimborsi: r, blocco: { rimborsi: r } }).annullaSpento; })());
  c("2 · …spento con i rimborsi che non si leggono", [true, true], [t({ rimborsi: null }).annullaSpento, t({ rimborsi: "guasto" }).annullaSpento]);
  c("2 · …NON spento quando non c'è niente da rimborsare (l'annullo resta possibile)", false, t({ rimborsi: [rimb(1, 2490, "riuscito")] }).annullaSpento);
  c("2 · …NON spento mentre l'invio è in corso per sé (lo spegne già `fermo`)", false, t({ inInvio: true }).annullaSpento);

  c("7 · ordini-ui esporta NON_PAGATI (in attesa, scaduto, fallito) e il predicato della fattura", [["in_attesa", "scaduto", "fallito"], "function"], [U.NON_PAGATI ?? null, typeof U.fatturaDaFare]);
  c("7 · fatturaDaFare: richiesta e non emessa sì; emessa o non richiesta no", [true, false, false], typeof U.fatturaDaFare === "function"
    ? [U.fatturaDaFare(stripe()), U.fatturaDaFare(stripe({ fattura_emessa_il: "2026-11-22T09:00:00.000Z" })), U.fatturaDaFare(stripe({ fattura_richiesta: false }))]
    : ["manca"]);
  const elencoSrc = senzaCommenti(leggiFile("src/crm/ecommerce/ElencoOrdini.tsx"));
  c("7 · ElencoOrdini non ha più le sue copie: importa NON_PAGATI e fatturaDaFare da ordini-ui", [false, false, true, true], [/const NON_PAGATI/.test(elencoSrc), /const fatturaDaFare/.test(elencoSrc), /import \{[^}]*\bNON_PAGATI\b[^}]*\} from "\.\/ordini-ui"/.test(elencoSrc), /import \{[^}]*\bfatturaDaFare\b[^}]*\} from "\.\/ordini-ui"/.test(elencoSrc)]);
  const tariffeSrc = senzaCommenti(leggiFile("src/crm/ecommerce/spedizioni/ElencoTariffe.tsx"));
  const cassaSrc = senzaCommenti(leggiFile("src/crm/ecommerce/cassa/PannelloCassa.tsx"));
  c("7 · un solo Riquadro: né ElencoTariffe né PannelloCassa lo definiscono, e lo importano dallo stesso file", [false, false, true], [/function Riquadro\b/.test(tariffeSrc), /function Riquadro\b/.test(cassaSrc), /import \{[^}]*\bRiquadro\b[^}]*\} from "@\/crm\/ecommerce\/Riquadro"/.test(tariffeSrc) && /import \{[^}]*\bRiquadro\b[^}]*\} from "@\/crm\/ecommerce\/Riquadro"/.test(cassaSrc)]);

  // ══ 6 · email.server.ts ═════════════════════════════════════════════════════════════════════════════════
  const emailSrc = leggiFile("src/crm/negozio/email.server.ts");
  const frase = /const FRASE_TESTO_CAMBIATO\s*=\s*([\s\S]*?);\n/.exec(emailSrc)?.[1] ?? "";
  c("6 · FRASE_TESTO_CAMBIATO non dice più di ricaricare né di rifare la modifica (la scheda si rilegge da sola)", [true, false, false], [frase.length > 20, /ricarica/i.test(frase), /rifai/i.test(frase)]);

  // ══ 5 · ?cassa porta catalogo_sito (e CHIAVI_CASSA non cambia) ═══════════════════════════════════════════
  const conCassa = (cassa, catalogo) => {
    const t2 = tabelleProva();
    const imp = (chiave, valore) => ({ chiave, valore, aggiornato_il: ISTANTE, aggiornato_da: null });
    t2.shop_impostazioni = t2.shop_impostazioni.filter((r) => !["cassa_sito", "catalogo_sito"].includes(r.chiave));
    t2.shop_impostazioni.push(imp("cassa_sito", cassa), imp("catalogo_sito", catalogo), imp("pagamento_sicuro", false), imp("metodi_pagamento", []), imp("resi_confermati", false));
    return t2;
  };
  const FATTI = () => ({ bannerPresente: true, chiavePresente: true, segretoPresente: true, tariffaAttiva: true, s4Presente: true, pagamentoIncassa: false });
  const leggiCassaServer = async (cassa, catalogo) => {
    const { d } = porte({ db: fintoDb({ tabelle: conCassa(cassa, catalogo) }), fattiEsterni: FATTI });
    return leggi(await IN.gestisciGET(get("cassa"), d));
  };
  const sc = await leggiCassaServer("stripe", "codice");
  c("5 · `?cassa` legge anche catalogo_sito (valore, versione)", ["codice", true], [sc.corpo.interruttori?.catalogo_sito?.valore, typeof sc.corpo.interruttori?.catalogo_sito?.aggiornatoIl === "string"]);
  const serverSrc = senzaCommenti(leggiFile("src/crm/negozio/interruttori.server.ts"));
  c("5 · …senza toccare CHIAVI_CASSA (il messaggio di migrazione di leggiValore ne dipende)", true, /const CHIAVI_CASSA = \["cassa_sito", "pagamento_sicuro", "metodi_pagamento", "resi_confermati"\];/.test(serverSrc));

  // ══ LE SCHERMATE: i componenti si impacchettano e si disegnano ═══════════════════════════════════════════
  const dove = mkdtempSync(join(tmpdir(), "t68c-"));
  try {
    const req = createRequire(join(radice, "package.json"));
    const reactDelProgetto = { name: "react-del-progetto", setup(b) {
      b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) => ({ path: req.resolve(a.path), external: true }));
    } };
    const tsx = async (entrata, nome) => {
      if (!existsSync(join(radice, entrata))) return {};
      await build({ entryPoints: [join(radice, entrata)], bundle: true, platform: "node", format: "cjs", outfile: join(dove, `${nome}.cjs`),
        loader: { ".tsx": "tsx", ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".webp": "dataurl" }, alias: { "@": join(radice, "src") },
        plugins: [reactDelProgetto], logLevel: "silent", jsx: "automatic" });
      return createRequire(import.meta.url)(join(dove, `${nome}.cjs`));
    };
    const { createElement: h } = req("react");
    const { renderToStaticMarkup } = req("react-dom/server");
    const D = await tsx("src/crm/ecommerce/DettaglioOrdine.tsx", "dettaglio");
    const DA = await tsx("src/crm/ecommerce/dialoghi/DialogoAnnulla.tsx", "annulla");
    const ET = await tsx("src/crm/ecommerce/spedizioni/ElencoTariffe.tsx", "tariffe");
    const testo = (x) => x.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
    const bottoni = (x) => x.split("<button").slice(1).map((s) => "<button" + s.slice(0, s.indexOf("</button>") + 9));
    const spento = (tag) => /\sdisabled=""/.test(tag.slice(0, tag.indexOf(">") + 1));
    const conTesto = (x, re) => bottoni(x).filter((b) => re.test(testo(b)));

    // ── 2 · il dettaglio: «Annulla l'ordine…» ──
    const nulla = async () => ({ ok: true, nessunCambio: true });
    const d = (ord, rimborsi) => ({
      ordineId: ID, dettaglio: { ordine: ord, riservati: { fattura: null, consensi: null }, rimborsi, email: [], storico: [], avvisi: [], migrazione: { pronta: true, pagamenti: true } },
      inCaricamento: false, errore: null, inInvio: false,
      ricarica: nulla, spedisci: nulla, riconcilia: nulla, fatturaEmessa: nulla, emailInvia: nulla, giacenzaVerificata: nulla, correggiStato: nulla,
      apriDialogo: () => ({ chiaveRichiesta: CHIAVE, rimborso: nulla, annulla: nulla }),
    });
    const corpo = (ord, rimborsi) => (D.CorpoStripe ? renderToStaticMarkup(h(D.CorpoStripe, { ordine: ord, d: d(ord, rimborsi), comandi: true, occupato: false, esito: null, chiedi: async () => true, storico: async () => ({ ok: true, eventi: [], migrazionePronta: true }) })) : "manca");
    const annulla = (x) => conTesto(x, /Annulla l'ordine/)[0] ?? "";
    c("2 · rimborsi leggibili con qualcosa da rimborsare: «Annulla l'ordine…» acceso", false, spento(annulla(corpo(pagato, [rimb(1, 500, "riuscito")]))));
    c("2 · rimborsi che non si leggono: «Rimborsa» e «Annulla l'ordine…» spenti insieme", [true, true], [conTesto(corpo(pagato, null), /^\s*Rimborsa\s*$/).every(spento), spento(annulla(corpo(pagato, null)))]);
    c("2 · niente da rimborsare: «Annulla l'ordine…» resta acceso", false, spento(annulla(corpo(pagato, [rimb(1, 2490, "riuscito")]))));
    c("2 · ordine ancora in attesa (niente rimborsi da leggere): «Annulla l'ordine…» acceso", false, spento(annulla(corpo(inAttesa, null))));
    const dettSrc = senzaCommenti(leggiFile("src/crm/ecommerce/DettaglioOrdine.tsx"));
    const blocco = /else \{\s*setCorrezione\(null\);[\s\S]{0,120}avviaAzione\("correggi_stato"/.test(dettSrc);
    c("3 · «Correggi» fallita: il modulo non si chiude prima dell'esito (il motivo scritto resta)", false, blocco);

    // ── 2 · la finestra di annullo ──
    const dialogo = { chiaveRichiesta: CHIAVE, annulla: nulla };
    const fa = (rimborsi) => (DA.FormAnnulla ? renderToStaticMarkup(h(DA.FormAnnulla, { ordine: pagato, rimborsi, dialogo, inInvio: false, onFatto: () => {}, onChiudi: () => {} })) : "manca");
    c("2 · finestra di annullo: accanto a «Rimborsa ora» c'è «non si può annullare»", true, /Rimborsa ora[^<]*non si può annullare/.test(testo(fa([]))));

    // ── 4 · ElencoTariffe ──
    const tariffa = { id: "t1", nome: "Tracciata", corriere: null, costoCent: 490, giorniMin: null, giorniMax: null, attiva: true, provvisoria: true, confermata: false, confermataIl: null, aggiornatoIl: ISTANTE };
    const corrieri = [{ nome: "BRT", modello: "https://vai.example/{numero}" }];
    const modulo = (extra = {}) => ({ ...(ET.moduloDaTariffa ? ET.moduloDaTariffa(tariffa) : {}), ...extra });
    const dati = (extra = {}) => ({ tariffa, corrieri, resi: false, cassa: "vecchia", catalogo: "cms", ...extra });
    const vista = (extra = {}) => (ET.VistaTariffe ? renderToStaticMarkup(h(ET.VistaTariffe, {
      dati: dati(), errore: null, modulo: modulo(), corrieri, numeroProva: "", lavoro: null, esito: null,
      onModulo: () => {}, onSalva: () => {}, onConferma: () => {}, onCorrieri: () => {}, onSalvaCorrieri: () => {}, onNumeroProva: () => {}, onResi: () => {}, onRiprova: () => {}, ...extra,
    })) : "manca");
    const alert = (x, re) => (x.match(/<p[^>]*>[\s\S]*?<\/p>/g) ?? []).filter((p) => /role="alert"/.test(p.slice(0, p.indexOf(">"))) && re.test(testo(p)));
    c("4 · N2: l'errore del nome e quello del costo hanno role=\"alert\"", [1, 1], [alert(vista({ modulo: modulo({ nome: " " }) }), /nome della tariffa/).length, alert(vista({ modulo: modulo({ costo: "abc" }) }), /Scrivi il costo/).length]);
    c("4 · N2: l'errore dei tempi e quello dei corrieri hanno role=\"alert\"", [1, 1], [alert(vista({ modulo: modulo({ giorniMin: "5", giorniMax: "" }) }), /giorni vanno da 1 a 60/).length, /role="alert"[^>]*>(?:<svg[\s\S]*?<\/svg>)?\s*Il modello di link/.test(vista({ corrieri: [{ nome: "BRT", modello: "http://x.example/{numero}" }] })) ? 1 : 0]);
    c("4 · N2: senza errori nessun role=\"alert\" nei campi", 0, alert(vista(), /./).length);
    const senzaNome = testo(vista({ corrieri: [{ nome: "", modello: "https://vai.example/{numero}" }], numeroProva: "123" }));
    c("4 · N3: nome del corriere vuoto → «manca il nome», non «il modello non è valido»", [true, false], [/manca il nome/i.test(senzaNome), /il modello non è valido/.test(senzaNome)]);
    c("4 · N3: modello davvero sbagliato → resta «il modello non è valido»", true, /il modello non è valido/.test(testo(vista({ corrieri: [{ nome: "Cattivo", modello: "https://{numero}.sito.example/" }], numeroProva: "123" }))));

    // N1: il riallineo dopo un salvataggio tocca solo la parte salvata
    const nuovo = { tariffa: { ...tariffa, costoCent: 590 }, corrieri: [{ nome: "GLS", modello: "" }], resi: true, cassa: "stripe", catalogo: "cms" };
    const prima = dati();
    const r = (parte) => (typeof ET.riallinea === "function" ? ET.riallinea(prima, nuovo, parte) : null);
    c("4 · N1: salvata la tariffa → si riallinea il modulo, NON i corrieri; i dati dei corrieri restano quelli visti", [true, false, 590, "BRT"], [r("tariffa")?.modulo, r("tariffa")?.corrieri, r("tariffa")?.dati.tariffa.costoCent, r("tariffa")?.dati.corrieri[0].nome]);
    c("4 · N1: salvati i corrieri → si riallineano i corrieri, NON il modulo", [false, true, 490, "GLS"], [r("corrieri")?.modulo, r("corrieri")?.corrieri, r("corrieri")?.dati.tariffa.costoCent, r("corrieri")?.dati.corrieri[0].nome]);
    c("4 · N1: l'interruttore dei resi non ha bozza: si riallinea, e con esso la cassa; il modulo e i corrieri no", [false, false, true, "stripe"], [r("resi")?.modulo, r("resi")?.corrieri, r("resi")?.dati.resi, r("resi")?.dati.cassa]);
    c("4 · N1: prima lettura (nessuna parte) o dati assenti → tutto", [true, true, "GLS"], [r(undefined)?.modulo, r(undefined)?.corrieri, r(undefined)?.dati.corrieri[0].nome]);
    c("4 · N1: senza dati di prima si prende tutto, qualunque parte", [true, true], [ET.riallinea?.(null, nuovo, "tariffa").corrieri, ET.riallinea?.(null, nuovo, "tariffa").modulo]);

    // ── 5 · l'avviso dei 4,90 € ──
    const OGGI = "la cassa di oggi usa ancora 4,90";
    const avv = (extra) => testo(vista({ dati: dati(extra) }));
    c("5 · cassa effettiva «vecchia» con catalogo «cms»: l'avviso c'è, con la frase di sempre", [true, true], [avv({ cassa: "vecchia", catalogo: "cms" }).includes(OGGI), /vale solo per il carrello/.test(avv({ cassa: "vecchia", catalogo: "cms" }))]);
    c("5 · cassa effettiva «stripe»: nessun avviso", false, avv({ cassa: "stripe", catalogo: "cms" }).includes(OGGI));
    const cod = avv({ cassa: "vecchia", catalogo: "codice" });
    c("5 · catalogo «codice»: l'avviso c'è e NON promette la tariffa al carrello (il carrello di oggi non la legge)", [true, false, true], [/4,90/.test(cod), /vale solo per il carrello/.test(cod), /catalogo/i.test(cod)]);
    c("5 · cassa non letta (null): l'avviso resta, come prima", true, avv({ cassa: null, catalogo: null }).includes(OGGI));
    // la lettura vera: `?cassa` del server vero dentro `caricaSpedizioni`
    const fetchVera = async (url) => {
      const q = url.split("?")[1] ?? "";
      if (q.startsWith("spedizioni")) return Response.json({ ok: true, tariffa: null, corrieri: [] });
      const { d: dd } = porte({ db: fintoDb({ tabelle: conCassa(globalThis.__cassa, globalThis.__catalogo) }), fattiEsterni: FATTI });
      return IN.gestisciGET(get(q), dd);
    };
    const carica = async (cassa, catalogo) => {
      globalThis.__cassa = cassa;
      globalThis.__catalogo = catalogo;
      return ET.caricaSpedizioni ? ET.caricaSpedizioni(fetchVera) : {};
    };
    const kCodice = await carica("stripe", "codice");
    const kCms = await carica("stripe", "cms");
    const kVecchia = await carica("vecchia", "cms");
    c("5 · caricaSpedizioni: «stripe» col catalogo «codice» → cassa effettiva «vecchia»; con «cms» → «stripe»; «vecchia» resta «vecchia»", ["vecchia", "stripe", "vecchia"], [kCodice.cassa, kCms.cassa, kVecchia.cassa]);
    c("5 · …e dice anche il catalogo (serve alla frase giusta)", ["codice", "cms"], [kCodice.catalogo, kCms.catalogo]);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}
