/** ── NEGOZIO · R2 · T64 · IL DETTAGLIO DELL'ORDINE E LE FINESTRE DI CONFERMA ───────────────────────────────
 *  `src/crm/ecommerce/DettaglioOrdine.tsx`, `src/crm/ecommerce/dialoghi/{Finestra,DialogoSpedisci,DialogoRimborso,DialogoAnnulla}.tsx`
 *  e le regole pure nuove di `src/crm/ecommerce/ordini-ui.ts`. PIANO-R2 §3.4, §6.1 T64, D55; SPEC 7.4 n. 5, 6; 8A n. 2, 6.
 *  Tre livelli: (1) le regole PURE (moduli impacchettati: moduli di verifica dei form, avvisi, fattura, email, esiti);
 *  (2) le schermate DISEGNATE con `react-dom/server` su dati inventati (il pannello e le finestre vivono in un portale: si
 *  provano i loro CORPI, come nella prova di T12); (3) il SORGENTE (ciò che non deve esserci: `window.confirm`, «Elimina», HTML
 *  grezzo, JSON intero, id di Stripe, funzioni nude del client). Nessuna rete, nessun orologio vero. Dati di fantasia.
 *  Se un file non c'è ancora, ogni controllo che lo riguarda è rosso per la ragione giusta («manca …») e non si ferma tutto. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { rigaOrdineProva } from "../ecommerce/dati.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const ID = uuid(1);
const CHIAVE = "11111111-1111-4111-8111-111111111111";
const ADESSO = new Date("2026-11-22T12:00:00.000Z");

export async function prove(mod, { c, gruppo, radice }) {
  const O = mod["ecommerce/ordine"];
  const U = mod["ecommerce/ordini-ui"];
  const ha = (nome) => typeof U[nome] === "function";
  const leggi = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : "");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  const prova = async (nome, fn) => {
    try {
      await fn();
    } catch (e) {
      c(`${nome}: nessuna eccezione`, "nessuna", String(e?.message ?? e).slice(0, 140));
    }
  };

  const stripe = (extra = {}) =>
    O.normalizzaOrdine(
      rigaOrdineProva({
        id: ID, order_ref: "HG-T64A", stato_pagamento: "pagato", pagato_il: "2026-11-21T12:00:00.000Z", pagato_importo: 24.9,
        metodo_pagamento: "stripe", metodo_dettaglio: "card", canale: "sito", totale_cent: 2490, fattura_richiesta: true,
        stripe_sessione_id: "cs_test_SESSIONE_FINTA", stripe_pagamento_id: "pi_test_PAGAMENTO_FINTO", ...extra,
      }),
    );
  const vecchio = (extra = {}) => O.normalizzaOrdine(rigaOrdineProva({ id: ID, ...extra }));
  const rimb = (n, importoCent, stato, extra = {}) => ({
    id: uuid(100 + n), importoCent, stato, motivo: "Prova di rimborso", origine: "crm", chi: "Giulia Esempio",
    creatoIl: "2026-11-21T11:00:00.000Z", aggiornatoIl: "2026-11-21T11:00:00.000Z", stripeRimborsoId: "re_test_RIMBORSO_FINTO", ...extra,
  });

  gruppo("NEGOZIO R2 · IL DETTAGLIO DELL'ORDINE E LE FINESTRE DI CONFERMA (T64)");

  // ══ 1 · LE FRASI DEGLI AVVISI NUOVI ═════════════════════════════════════════════════════════════════════
  const E = U.ETICHETTA_AVVISO ?? {};
  c("avviso email_non_inviata: la frase onesta (non dice «non inviata», dice «non è partita al primo tentativo»)", true, /^L'email non è partita al primo tentativo: controlla se è poi arrivata\.?$/.test(E.email_non_inviata ?? ""));
  c("avviso rimborso_transizione_ignorata: frase neutra (T68), non dice chi ha ragione", true, /^Il registro dei rimborsi e Stripe non dicono la stessa cosa: controlla su Stripe\.?$/.test(E.rimborso_transizione_ignorata ?? ""));
  c("avvisi livemode_diverso e metodo_non_scritto: frasi brevi, in italiano, senza il nome del codice", [true, true], ["livemode_diverso", "metodo_non_scritto"].map((k) => typeof E[k] === "string" && E[k].length >= 20 && E[k].length <= 160 && !E[k].includes(k) && !/_/.test(E[k])));
  c("un avviso nuovo non cade più nella frase «non conosce»", false, /non conosce/.test((U.avvisiOrdine?.(stripe({ avvisi: [{ codice: "email_non_inviata", gravita: "giallo", rif: "evt_1", il: "2026-11-21T10:00:00.000Z" }, { codice: "livemode_diverso", gravita: "giallo" }, { codice: "metodo_non_scritto", gravita: "giallo" }, { codice: "rimborso_transizione_ignorata", gravita: "rosso" }] })) ?? ["manca"]).join(" ")));

  // ══ 2 · GLI AVVISI CON I LORO TASTI ═════════════════════════════════════════════════════════════════════
  await prova("avvisiDettaglio", () => {
    const v = ha("avvisiDettaglio")
      ? U.avvisiDettaglio(stripe({ giacenza_da_verificare: true, avvisi: [{ codice: "doppio_pagamento", gravita: "rosso", rif: "cs_x", il: "2026-11-21T10:00:00.000Z" }, { codice: "livemode_diverso", gravita: "giallo", rif: null, il: null }] }))
      : null;
    const di = (re) => v?.find((x) => re.test(x.testo));
    c("avviso «giacenza da verificare»: rosso, con i tasti «Rimborsa» e «Segna verificata»", [true, ["rimborsa", "giacenza_verificata"]], [di(/giacenza/i)?.rosso === true, di(/giacenza/i)?.azioni ?? null]);
    c("avviso doppio_pagamento: rosso, con il tasto «Rimborsa»", [true, ["rimborsa"]], [di(/due volte/i)?.rosso === true, di(/due volte/i)?.azioni ?? null]);
    c("un avviso giallo di gravità, senza tasti", [false, []], [di(/Stripe ha mandato|evento/i)?.rosso ?? "manca", di(/Stripe ha mandato|evento/i)?.azioni ?? "manca"]);
    c("la frase della giacenza non si ripete (colonna e avviso nel registro dicono la stessa cosa: una volta sola)", 1, (ha("avvisiDettaglio") ? U.avvisiDettaglio(stripe({ giacenza_da_verificare: true, avvisi: [{ codice: "giacenza_da_verificare", gravita: "rosso", rif: null, il: null }] })).filter((x) => /giacenza/i.test(x.testo)).length : -1));
    c("avvisiOrdine (la funzione di prima) non cambia per un ordine pulito", [], U.avvisiOrdine(vecchio()));
  });

  // ══ 3 · «RIMBORSA»: IMPORTO, MASSIMO, BLOCCO ════════════════════════════════════════════════════════════
  await prova("centDaTesto", () => {
    const k = ha("centDaTesto") ? (t) => U.centDaTesto(t) : () => "manca centDaTesto";
    c("l'importo si scrive in euro e va ai centesimi interi: «24,90» e «24.9» = 2490, «5» = 500, «0,05» = 5", [2490, 2490, 500, 5], [k("24,90"), k("24.9"), k("5"), k("0,05")]);
    c("importi che non sono soldi: «abc», «», «1e3», «-5», «5,999», «1.000,00», «0x10» → nessuno", [null, null, null, null, null, null, null], ["abc", "", "1e3", "-5", "5,999", "1.000,00", "0x10"].map(k));
  });
  const o = stripe();
  const ok5 = [rimb(1, 500, "riuscito")];
  await prova("controllaFormRimborso", () => {
    const f = (form, rimborsi = [], chiave = CHIAVE, ordine = o) => (ha("controllaFormRimborso") ? U.controllaFormRimborso(ordine, form, rimborsi, chiave) : { ok: "manca controllaFormRimborso" });
    const buono = { importo: "10,00", motivo: "Il cliente ha restituito il pacco", conferma: true };
    const r = f(buono);
    c("rimborso: i dati giusti diventano centesimi interi, motivo, conferma", [true, 1000, "Il cliente ha restituito il pacco"], [r.ok, r.importoCent, r.motivo]);
    c("rimborso: la conferma esplicita è obbligatoria (senza, non parte)", false, f({ ...buono, conferma: false }).ok);
    c("rimborso: il motivo è obbligatorio (vuoto e di 4 lettere no, di 5 sì)", [false, false, true], [f({ ...buono, motivo: "" }).ok, f({ ...buono, motivo: "abcd" }).ok, f({ ...buono, motivo: "abcde" }).ok]);
    c("rimborso: un importo scritto male o a zero non parte", [false, false, false], [f({ ...buono, importo: "abc" }).ok, f({ ...buono, importo: "0" }).ok, f({ ...buono, importo: "" }).ok]);
    c("rimborso: oltre il residuo non parte, e la frase dice il massimo (24,90 − 5,00 = 19,90)", [false, true], [f({ ...buono, importo: "19,91" }, ok5).ok, /19,90/.test(f({ ...buono, importo: "19,91" }, ok5).errore ?? "")]);
    c("rimborso: esattamente il residuo passa", [true, 1990], [f({ ...buono, importo: "19,90" }, ok5).ok, f({ ...buono, importo: "19,90" }, ok5).importoCent]);
    c("rimborso: un rimborso già richiesto occupa la cifra; uno fallito la libera", [false, true], [f({ ...buono, importo: "24,90" }, [rimb(2, 1000, "richiesto")]).ok, f({ ...buono, importo: "24,90" }, [rimb(3, 1000, "fallito")]).ok]);
    c("rimborso: elenco dei rimborsi illeggibile (null, voce sporca) → non parte", [false, false], [f(buono, null).ok, f(buono, [{ stato: "boh" }]).ok]);
    c("rimborso: senza la chiave del dialogo non parte", false, f(buono, [], "").ok);
    c("rimborso: un ordine non pagato non si rimborsa", false, f(buono, [], CHIAVE, stripe({ stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null })).ok);
  });
  await prova("tastoRimborso", () => {
    const t = (rimborsi, extra = {}) => (ha("tastoRimborso") ? U.tastoRimborso({ ordine: o, rimborsi, inInvio: false, blocco: null, ...extra }) : { attivo: "manca tastoRimborso", ragione: null });
    const lista = [rimb(1, 500, "riuscito")];
    c("tasto «Rimborsa»: acceso con un residuo e l'elenco letto", true, t(lista).attivo);
    c("tasto «Rimborsa»: spento mentre un'azione è in corso (inInvio)", false, t(lista, { inInvio: true }).attivo);
    c("tasto «Rimborsa»: spento se i rimborsi non si leggono, e dice perché", [false, true], [t(null).attivo, /leggere/.test(t(null).ragione ?? "")]);
    c("tasto «Rimborsa»: spento se non resta niente", [false, true], [t([rimb(1, 2490, "riuscito")]).attivo, /niente/i.test(t([rimb(1, 2490, "riuscito")]).ragione ?? "")]);
    //  rimborso «in corso»: si blocca finché l'elenco non è riletto (un elenco NUOVO, non lo stesso array)
    const visto = [rimb(1, 500, "riuscito")];
    const bloccato = t(visto, { blocco: { rimborsi: visto } });
    c("rimborso in corso: il tasto resta spento finché l'elenco è lo stesso di prima, e la frase dice «non ripetere»", [false, true], [bloccato.attivo, /non ripet/i.test(bloccato.ragione ?? "")]);
    c("…e si riaccende quando l'elenco è stato riletto (un array nuovo)", true, t([rimb(1, 500, "riuscito"), rimb(2, 1000, "richiesto")].slice(0, 1), { blocco: { rimborsi: visto } }).attivo);
    c("l'elenco riletto che non si legge più (null) non riaccende niente", false, t(null, { blocco: { rimborsi: visto } }).attivo);
  });
  await prova("rimborsoInCorso", () => {
    const r = (effetti, extra = {}) => ({ ok: true, nessunCambio: false, ordine: o, storico: true, effetti, email: null, avvisi: [], ...extra });
    const g = (x) => (ha("rimborsoInCorso") ? U.rimborsoInCorso(x) : "manca rimborsoInCorso");
    c("un effetto «rimborso in_corso» (anche dentro un annullo) è un rimborso in corso", [true, false, false, false, false], [
      g(r([{ tipo: "rimborso", esito: "in_corso", frase: "Stripe non ha risposto. Non ripeterlo." }])),
      g(r([{ tipo: "rimborso", esito: "fatto", frase: "Rimborso richiesto." }])),
      g(r([{ tipo: "email", esito: "in_corso", frase: "In invio." }])),
      g({ ok: true, nessunCambio: true }),
      g({ ok: false, errore: { tipo: "rete", messaggio: "x" } }),
    ]);
  });

  // ══ 4 · «ANNULLA»: MOTIVO E SCELTE ══════════════════════════════════════════════════════════════════════
  await prova("controllaFormAnnulla", () => {
    const f = (form, ordine = o, rimborsi = [], chiave = CHIAVE) => (ha("controllaFormAnnulla") ? U.controllaFormAnnulla(ordine, form, rimborsi, chiave) : { ok: "manca controllaFormAnnulla" });
    const buono = { motivo: "Il cliente ha cambiato idea", rimborso: "ora", magazzino: "si" };
    c("annullo di un ordine pagato: motivo + «rimborsa ora» + «in magazzino» → partono i tre dati", [true, "Il cliente ha cambiato idea", "ora", true], [f(buono).ok, f(buono).motivo, f(buono).rimborso, f(buono).rimettiInMagazzino]);
    c("l'annullo NON si invia senza motivo (vuoto, spazi, solo a capo)", [false, false, false], [f({ ...buono, motivo: "" }).ok, f({ ...buono, motivo: "   " }).ok, f({ ...buono, motivo: "\n\n" }).ok]);
    c("l'annullo di un ordine pagato non parte senza aver scelto il rimborso, né il magazzino (nessuna scelta di partenza)", [false, false], [f({ ...buono, rimborso: "" }).ok, f({ ...buono, magazzino: "" }).ok]);
    c("«nessun rimborso dovuto» e «non in magazzino» sono scelte valide", [true, "nessuno", false], [f({ ...buono, rimborso: "nessuno", magazzino: "no" }).ok, f({ ...buono, rimborso: "nessuno", magazzino: "no" }).rimborso, f({ ...buono, rimborso: "nessuno", magazzino: "no" }).rimettiInMagazzino]);
    const attesa = stripe({ stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null });
    c("ordine ancora in attesa di pagamento: basta il motivo, nessuna scelta da fare", [true, false, false], [f({ motivo: "Il cliente non paga", rimborso: "", magazzino: "" }, attesa).ok, U.scelteAnnulla?.(attesa, []).rimborso ?? "manca", U.scelteAnnulla?.(attesa, []).magazzino ?? "manca"]);
    c("ordine pagato: servono entrambe le scelte", [true, true], [U.scelteAnnulla?.(o, []).rimborso ?? "manca", U.scelteAnnulla?.(o, []).magazzino ?? "manca"]);
    c("ordine già rimborsato del tutto: niente scelta del rimborso, resta il magazzino", [false, true], [U.scelteAnnulla?.(stripe({ stato_pagamento: "rimborsato", rimborsato_cent: 2490 }), [rimb(1, 2490, "riuscito")]).rimborso ?? "manca", U.scelteAnnulla?.(stripe({ stato_pagamento: "rimborsato", rimborsato_cent: 2490 }), [rimb(1, 2490, "riuscito")]).magazzino ?? "manca"]);
    c("rimborso «ora» con l'elenco dei rimborsi illeggibile: non parte (fallisce chiuso)", false, f(buono, o, null).ok);
    c("motivo oltre 500 caratteri: non parte", false, f({ ...buono, motivo: "x".repeat(501) }).ok);
  });

  // ══ 5 · «SPEDISCI»: CORRIERE E NUMERO ═══════════════════════════════════════════════════════════════════
  await prova("controllaFormSpedisci", () => {
    const f = (form, ordine = o) => (ha("controllaFormSpedisci") ? U.controllaFormSpedisci(ordine, form) : { ok: "manca controllaFormSpedisci" });
    c("spedisci: corriere dell'elenco + numero valido → i dati", [true, "BRT", "12345678"], [f({ corriere: "BRT", numero: "12345678", senzaTracking: false }).ok, f({ corriere: "BRT", numero: "12345678", senzaTracking: false }).corriere, f({ corriere: "BRT", numero: " 12345678 ", senzaTracking: false }).numero]);
    c("spedisci: senza corriere, o con un corriere fuori elenco, non parte", [false, false], [f({ corriere: "", numero: "12345678", senzaTracking: false }).ok, f({ corriere: "Corriere Inventato", numero: "12345678", senzaTracking: false }).ok]);
    c("spedisci: numero mancante, troppo corto (4), troppo lungo (41) o con segni strani non parte", [false, false, false, false, false], ["", "1234", "1".repeat(41), "12345<script>", "abc\ndef12"].map((numero) => f({ corriere: "BRT", numero, senzaTracking: false }).ok));
    c("spedisci: «senza tracking» non vuole né corriere né numero", [true, true], [f({ corriere: "", numero: "", senzaTracking: true }).ok, f({ corriere: "", numero: "", senzaTracking: true }).senzaTracking]);
    c("spedisci: un ordine non pagato non si spedisce", false, f({ corriere: "BRT", numero: "12345678", senzaTracking: false }, stripe({ stato_pagamento: "in_attesa", pagato_il: null })).ok);
  });

  // ══ 6 · «CORREGGI LO STATO» E I PASSI DELL'ORDINE ═══════════════════════════════════════════════════════
  await prova("comandiEvasione", () => {
    const g = (stato, extra = {}) => (ha("comandiEvasione") ? U.comandiEvasione(stripe({ status: stato, ...extra })) : null);
    c("ordine nuovo e pagato: avanti «in preparazione», si può spedire e annullare, non si corregge", [["in_preparazione"], true, true, []], (() => { const x = g("nuovo"); return [x?.avanti, x?.spedisci, x?.annulla, x?.correzioni]; })());
    c("ordine spedito: avanti «consegnato»; correzione solo «in preparazione»", [["consegnato"], ["in_preparazione"]], (() => { const x = g("spedito"); return [x?.avanti, x?.correzioni]; })());
    c("ordine annullato: nessun avanti, non si spedisce né si annulla; si può riattivare («nuovo»)", [[], false, false, ["nuovo"]], (() => { const x = g("annullato"); return [x?.avanti, x?.spedisci, x?.annulla, x?.correzioni]; })());
    c("ordine consegnato: niente di niente", [[], false, false, []], (() => { const x = g("consegnato"); return [x?.avanti, x?.spedisci, x?.annulla, x?.correzioni]; })());
    c("ordine NON pagato (in attesa): non si prepara né si spedisce, ma si può annullare", [[], false, true], (() => { const x = g("nuovo", { stato_pagamento: "in_attesa", pagato_il: null }); return [x?.avanti, x?.spedisci, x?.annulla]; })());
    //  ogni correzione offerta dalla schermata è accettata dalla stessa funzione del server
    const Z = mod["ecommerce/azioni"];
    const tutte = ["in_preparazione", "spedito", "annullato"].flatMap((s) => (g(s)?.correzioni ?? []).map((a) => [s, a]));
    c("ogni correzione offerta è ammessa da `costruisciAzione` (la schermata e il server dicono la stessa cosa)", tutte.map(() => true), tutte.map(([da, a]) => Z.costruisciAzione({ azione: "correggi_stato", ordineId: ID, da, a, motivo: "Errore di inserimento" }, stripe({ status: da }), ADESSO, { rimborsi: [] }).ok));
  });
  await prova("controllaFormCorreggi", () => {
    const f = (form, ordine = stripe({ status: "spedito" }), rimborsi = []) => (ha("controllaFormCorreggi") ? U.controllaFormCorreggi(ordine, form, rimborsi) : { ok: "manca controllaFormCorreggi" });
    c("correggi: serve il motivo (vuoto no, scritto sì)", [false, true], [f({ a: "in_preparazione", motivo: "" }).ok, f({ a: "in_preparazione", motivo: "Spedito per sbaglio" }).ok]);
    c("correggi: riattivare un annullato con un rimborso richiesto o riuscito non parte", [false, true], [f({ a: "nuovo", motivo: "Annullato per errore" }, stripe({ status: "annullato" }), [rimb(1, 500, "richiesto")]).ok, f({ a: "nuovo", motivo: "Annullato per errore" }, stripe({ status: "annullato" }), []).ok]);
  });

  // ══ 7 · FATTURA E CONSENSI: SOLO CAMPI NOTI, SOLO TESTO ═════════════════════════════════════════════════
  const fatturaSporca = { tipo: "azienda", denominazione: "Esempio Srl", piva: "01234567897", sdi: "ABC1234", pec: "esempio@pec.example.com", cf: "", extra: "<img src=x onerror=alert(1)>", segreto: "NON-DEVE-COMPARIRE", annidato: { a: 1 } };
  const consensiSporchi = { termini: true, privacy: true, versione: "2026-11", marketing: false, il: "2026-11-20T10:00:00.000Z", ip: "203.0.113.9", user_agent: "Browser di prova", sconosciuto: "NON-MOSTRARE" };
  await prova("datiFattura", () => {
    const righe = ha("datiFattura") ? U.datiFattura(fatturaSporca) : null;
    const tutto = JSON.stringify(righe);
    c("fattura: i campi noti ci sono, con l'etichetta in italiano", true, !!righe && ["Esempio Srl", "01234567897", "ABC1234", "esempio@pec.example.com", "Azienda"].every((x) => tutto.includes(x)));
    c("fattura: un campo che non conosciamo non si mostra (né nome né valore, né oggetti annidati)", false, /NON-DEVE|onerror|annidato|segreto|extra/.test(tutto));
    c("fattura: un campo vuoto non fa una riga", false, !!righe && righe.some((r) => /Codice fiscale/.test(r.etichetta)));
    c("fattura: non-oggetti e null danno nessuna riga, mai un'eccezione", [[], [], [], []], [null, "testo", 42, []].map((x) => (ha("datiFattura") ? U.datiFattura(x) : "manca")));
    c("fattura: un valore lunghissimo si taglia (tetto)", true, !!righe && U.datiFattura({ denominazione: "x".repeat(5000) })[0].valore.length <= 200);
    const cons = ha("datiConsensi") ? JSON.stringify(U.datiConsensi(consensiSporchi)) : "";
    c("consensi: termini, privacy, versione, marketing (sì/no) e la data", true, ["2026-11", "Termini", "Privacy", "Marketing"].every((x) => cons.includes(x)) && /No/.test(cons));
    c("consensi: né indirizzo IP né browser né campi sconosciuti", false, /203\.0\.113|Browser di prova|NON-MOSTRARE|sconosciuto/.test(cons));
    const testo = ha("testoPerFattura") ? U.testoPerFattura(stripe({ items: [{ product_id: "p1", name: "Prodotto di prova", qty: 2, unit_price: 10 }], subtotal: 20, shipping: 4.9, total: 24.9 }), fatturaSporca) : "";
    c("«Copia i dati per la fattura»: un testo semplice con intestatario, partita IVA, SDI, PEC, indirizzo, righe e totale", true, ["Esempio Srl", "01234567897", "ABC1234", "esempio@pec.example.com", "Via Inventata 1", "Prodotto di prova", "24,90"].every((x) => testo.includes(x)));
    c("…e senza i campi che non conosciamo né gli id di Stripe", false, /NON-DEVE|onerror|cs_test|pi_test/.test(testo));
  });

  // ══ 8 · EMAIL PER ORDINE ════════════════════════════════════════════════════════════════════════════════
  await prova("righeEmail", () => {
    const righe = (ordine, email = []) => (ha("righeEmail") ? U.righeEmail(ordine, email) : []);
    const r = righe(stripe(), [{ chiave: "conferma_ordine", stato: "inviata", il: "2026-11-21T10:05:00.000Z", codice: null }, { chiave: "spedito", stato: "errore", il: null, codice: "http_422" }, { chiave: "rimborso", stato: "in_invio", il: null, codice: null }]);
    const di = (k) => r.find((x) => x.chiave === k);
    c("email: le CINQUE, nell'ordine dei modelli", ["conferma_ordine", "spedito", "pagamento_non_riuscito", "rimborso", "annullato"], r.map((x) => x.chiave));
    c("email: stato in italiano («Inviata», «Non riuscita», «In invio», «Non ancora inviata»)", [true, true, true, true], [/Inviata/.test(di("conferma_ordine")?.stato ?? ""), /Non riuscita/.test(di("spedito")?.stato ?? ""), /In invio/.test(di("rimborso")?.stato ?? ""), /Non ancora/.test(di("annullato")?.stato ?? "")]);
    c("email: «Invia ora» libero se non è mai partita o se è fallita; bloccato (con la ragione) se è già partita o in invio", [null, null, true, true], [di("pagamento_non_riuscito")?.blocco ?? null, di("spedito")?.blocco ?? null, /già/i.test(di("conferma_ordine")?.blocco ?? ""), /in invio/i.test(di("rimborso")?.blocco ?? "")]);
    c("email: ordine senza indirizzo → bloccata, con la ragione", true, righe(stripe({ email: "" })).every((x) => /indirizzo/i.test(x.blocco ?? "")));
    c("email: la conferma d'ordine su un ordine annullato è bloccata, con la ragione (le altre no)", [true, null], [/annullato/i.test(righe(stripe({ status: "annullato" })).find((x) => x.chiave === "conferma_ordine")?.blocco ?? ""), righe(stripe({ status: "annullato" })).find((x) => x.chiave === "annullato")?.blocco ?? null]);
    c("email: il codice dell'errore è solo un codice breve, mai un testo lungo", true, r.every((x) => (x.stato + (x.dettaglio ?? "")).length < 80));
    c("email: se il dettaglio non c'è si legge dall'ordine (email_inviate)", true, /Inviata/.test(righe(stripe({ email_inviate: { conferma_ordine: { stato: "inviata", il: "2026-11-21T10:05:00.000Z" } } })).find((x) => x.chiave === "conferma_ordine")?.stato ?? ""));
  });

  // ══ 9 · LE FRASI DOPO UN'AZIONE NUOVA ═══════════════════════════════════════════════════════════════════
  await prova("esitoAzioneR2", () => {
    const ok = (extra = {}) => ({ ok: true, nessunCambio: false, ordine: o, storico: true, effetti: [], email: null, avvisi: [], ...extra });
    const g = (r, a) => (ha("esitoAzioneR2") ? U.esitoAzioneR2(r, a) : { tono: "manca", testo: "" });
    c("riuscita: una riga tranquilla con la frase dell'azione", ["ok", true], [g(ok(), "spedisci").tono, /spedito/i.test(g(ok(), "spedisci").testo)]);
    c("rimborso in corso: tono «avviso» e la frase dice «non ripetere»", ["avviso", true], [g(ok({ effetti: [{ tipo: "rimborso", esito: "in_corso", frase: "Stripe non ha risposto: il rimborso resta «richiesto»." }] }), "rimborso").tono, /non ripet/i.test(g(ok({ effetti: [{ tipo: "rimborso", esito: "in_corso", frase: "Stripe non ha risposto: il rimborso resta «richiesto»." }] }), "rimborso").testo)]);
    c("effetto non riuscito (es. magazzino): tono «errore» con la frase del server", ["errore", true], [g(ok({ effetti: [{ tipo: "giacenza_rimetti", esito: "non_riuscito", frase: "Non sono riuscito a rimettere i pezzi in magazzino." }] }), "annulla").tono, /magazzino/.test(g(ok({ effetti: [{ tipo: "giacenza_rimetti", esito: "non_riuscito", frase: "Non sono riuscito a rimettere i pezzi in magazzino." }] }), "annulla").testo)]);
    c("storico non scritto: tono «avviso»", "avviso", g(ok({ storico: false }), "annulla").tono);
    c("email partita dopo «spedito»: la frase del server si aggiunge; email non inviata: tono «avviso»", [true, "avviso"], [/Email inviata/.test(g(ok({ email: { chiave: "spedito", stato: "inviata", frase: "Email inviata." } }), "spedisci").testo), g(ok({ email: { chiave: "spedito", stato: "spenta", frase: "Email non inviata: interruttore spento." } }), "spedisci").tono]);
    c("nessun cambio: «era già così»", true, /già così/.test(g({ ok: true, nessunCambio: true }, "riconcilia").testo));
    c("conflitto 409: la frase del collega; permesso/rete: la frase dell'errore", [true, "errore", "errore"], [/collega/.test(g({ ok: false, errore: { tipo: "conflitto", messaggio: "x" } }, "spedisci").testo), g({ ok: false, errore: { tipo: "rete", messaggio: "Non so se la modifica sia stata salvata." } }, "rimborso").tono, g({ ok: false, errore: { tipo: "permesso", messaggio: "Non hai il permesso." } }, "rimborso").tono]);
    c("nessuna frase vuota o con «undefined», qualunque azione", false, ["spedisci", "annulla", "rimborso", "riconcilia", "fattura_emessa", "email_invia", "giacenza_verificata", "correggi_stato"].some((a) => !g(ok(), a).testo || /undefined|\[object/.test(g(ok(), a).testo)));
  });

  // ══ 10 · LE SCHERMATE, DISEGNATE SUL SERIO ══════════════════════════════════════════════════════════════
  const dove = mkdtempSync(join(tmpdir(), "dettaglio-r2-"));
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
    const DR = await tsx("src/crm/ecommerce/dialoghi/DialogoRimborso.tsx", "rimborso");
    const DA = await tsx("src/crm/ecommerce/dialoghi/DialogoAnnulla.tsx", "annulla");
    const DS = await tsx("src/crm/ecommerce/dialoghi/DialogoSpedisci.tsx", "spedisci");
    const testo = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    const bottoni = (html) => html.split("<button").slice(1).map((s) => "<button" + s.slice(0, s.indexOf("</button>") + 9));
    const spento = (tag) => /\sdisabled=""/.test(tag.slice(0, tag.indexOf(">") + 1));
    const conTesto = (html, re) => bottoni(html).filter((b) => re.test(testo(b)));
    const senzaDati = async () => ({ ok: true, nessunCambio: true });
    const stoVuoto = async () => ({ ok: true, eventi: [], migrazionePronta: true });
    const chiedi = async () => true;

    // ── il dettaglio di un ordine Stripe: tutto il pannello, con un dettaglio letto ──
    const ordine = stripe({
      giacenza_da_verificare: true,
      avvisi: [{ codice: "doppio_pagamento", gravita: "rosso", rif: "cs_test_ALTRA", il: "2026-11-21T10:00:00.000Z" }],
      email_inviate: { conferma_ordine: { stato: "inviata", il: "2026-11-21T10:05:00.000Z", codice: null } },
      items: [{ product_id: "p1", name: "Prodotto di prova", qty: 1, unit_price: 20 }], subtotal: 20, shipping: 4.9, total: 24.9,
    });
    const dettaglio = (extra = {}) => ({
      ordine, riservati: { fattura: fatturaSporca, consensi: consensiSporchi }, rimborsi: [rimb(1, 500, "riuscito")],
      email: [{ chiave: "conferma_ordine", stato: "inviata", il: "2026-11-21T10:05:00.000Z", codice: null }],
      storico: [], avvisi: [], migrazione: { pronta: true, pagamenti: true }, ...extra,
    });
    const nulla = async () => ({ ok: true, nessunCambio: true });
    const d = (extra = {}) => ({
      ordineId: ID, dettaglio: dettaglio(), inCaricamento: false, errore: null, inInvio: false,
      ricarica: nulla, spedisci: nulla, riconcilia: nulla, fatturaEmessa: nulla, emailInvia: nulla, giacenzaVerificata: nulla, correggiStato: nulla,
      apriDialogo: () => ({ chiaveRichiesta: CHIAVE, rimborso: nulla, annulla: nulla }), ...extra,
    });
    const corpo = (dd = d(), extra = {}) => (D.CorpoStripe ? renderToStaticMarkup(h(D.CorpoStripe, { ordine, d: dd, comandi: true, occupato: false, esito: null, chiedi, storico: stoVuoto, ...extra })) : "manca CorpoStripe");
    const html = corpo();
    const t = testo(html);

    c("il corpo per gli ordini della cassa nuova c'è (`CorpoStripe`), e `CorpoOrdine` resta", ["function", "function"], [typeof D.CorpoStripe, typeof D.CorpoOrdine]);
    c("pagamento: stato, importo, metodo e data", true, /Pagato/.test(t) && /€ 24,90/.test(t) && /Stripe/.test(t) && /21 nov/.test(t));
    c("pagamento: rimborsi con importo, stato e motivo", true, /€ 5,00/.test(t) && /Riuscito/.test(t) && /Prova di rimborso/.test(t));
    c("gli id di Stripe (sessione, pagamento, rimborso) non si vedono, né nel testo né negli attributi", false, /cs_test|pi_test|re_test|stripe_/i.test(html));
    c("avvisi: «giacenza da verificare» e «pagato due volte», in rosso (role=alert)", [true, true, true], [/giacenza è da verificare/i.test(t), /due volte/.test(t), /role="alert"[^>]*rose|rose[^>]*role="alert"|role="alert"[\s\S]{0,80}border-rose/.test(html)]);
    c("tasti: «Rimborsa» (più d'uno: nel pagamento e negli avvisi), «Segna verificata», «Controlla con Stripe»", [true, true, true], [conTesto(html, /^\s*Rimborsa\s*$/).length >= 3, conTesto(html, /Segna verificata/).length === 1, conTesto(html, /Controlla con Stripe/).length === 1]);
    c("«Rimborsa» passa da un dialogo: il tasto apre, non rimborsa (nessun invio diretto nel sorgente: vedi sotto)", true, conTesto(html, /^\s*Rimborsa\s*$/).every((b) => /type="button"/.test(b)));
    c("fattura: i dati noti, come testo; «Copia i dati per la fattura» e «Segna fattura emessa»", true, ["Esempio Srl", "01234567897", "ABC1234", "esempio@pec.example.com"].every((x) => t.includes(x)) && conTesto(html, /Copia i dati per la fattura/).length === 1 && conTesto(html, /Segna fattura emessa/).length === 1);
    c("fattura e consensi: niente HTML grezzo, niente JSON, niente campi sconosciuti, niente IP", false, /<img|onerror|NON-DEVE|NON-MOSTRARE|203\.0\.113|Browser di prova|\{&quot;|\{"/.test(html));
    c("consensi: versione dei testi e marketing «No»", true, /2026-11/.test(t) && /Marketing[^A-Za-z]*No/.test(t));
    c("email: le cinque righe, con «Invia ora» (spento dove c'è la ragione)", [5, true], [conTesto(html, /Invia ora/).length, conTesto(html, /Invia ora/).some((b) => spento(b))]);
    c("email: la ragione del blocco si legge (non solo in un tooltip)", true, /già (è )?partita|già inviata/i.test(t));
    c("stato dell'ordine: «Segna in preparazione», «Spedisci…», «Annulla l'ordine…»", [true, true, true], [conTesto(html, /Segna in preparazione/).length === 1, conTesto(html, /^\s*Spedisci/).length === 1, conTesto(html, /Annulla l'ordine/).length === 1]);
    c("nessun menu libero dello stato (i passi si fanno coi tasti giusti), nessun «Segna come pagato», nessun «Annulla pagamento»", [false, false, false], [/<select[^>]*aria-label="Stato ordine/.test(html), /Segna come pagato/.test(t), /Annulla pagamento/.test(t)]);
    c("nessun campo libero per il tracking (si scrive spedendo)", false, /Codice di tracciamento/.test(t));
    c("cliente, righe, storico e note interne ci sono ancora", true, /Anna Esempio/.test(t) && /Prodotto di prova/.test(t) && /Storico/.test(t) && /Note interne/.test(t));
    c("nessun «NaN», «undefined», «Infinity», «[object»", false, /NaN|undefined|Infinity|\[object/.test(t));
    c("nessuna parola di cancellazione", false, /elimin|cancell|delete/i.test(html));

    // ── tasti spenti durante un invio, o senza migrazione, o senza dettaglio ──
    const durante = corpo(d({ inInvio: true }));
    const delleAzioni = (x) => bottoni(x).filter((b) => /Rimborsa|Controlla con Stripe|Segna verificata|Segna fattura emessa|Invia ora|Spedisci|Annulla l'ordine|Segna in preparazione/.test(testo(b)));
    c("durante un invio (`inInvio`) tutti i tasti delle azioni nuove sono spenti (e ce ne sono almeno 10)", [true, true], [delleAzioni(durante).length >= 10, delleAzioni(durante).every(spento)]);
    const spenti = corpo(d(), { comandi: false });
    c("senza la migrazione i tasti sono spenti (almeno 8) e il motivo è scritto", [true, true, true], [delleAzioni(spenti).length >= 8, delleAzioni(spenti).every(spento), /database/i.test(testo(spenti))]);
    const senzaDett = corpo(d({ dettaglio: null, inCaricamento: true }));
    c("dettaglio non ancora letto (o senza permesso): nessun tasto di azione, nessun dato riservato, lo dice", [0, false, true], [bottoni(senzaDett).filter((b) => /Rimborsa|Invia ora|Segna fattura emessa|Copia i dati/.test(testo(b))).length, /01234567897|Esempio Srl/.test(testo(senzaDett)), /Carico|leggo|non riesco/i.test(testo(senzaDett))]);
    const negato = corpo(d({ dettaglio: null, inCaricamento: false, errore: { tipo: "permesso", messaggio: "Non hai il permesso di vedere questo ordine." } }));
    c("senza permesso: la frase dell'errore, nessun tasto, nessun dato fiscale", [true, 0, false], [/permesso/.test(testo(negato)), bottoni(negato).filter((b) => /Rimborsa|Invia ora|Segna fattura emessa|Copia i dati/.test(testo(b))).length, /01234567897/.test(testo(negato))]);
    const senzaRimb = corpo(d({ dettaglio: dettaglio({ rimborsi: null }) }));
    c("rimborsi illeggibili (null): lo dice, «Rimborsa» spento; non dice «nessun rimborso»", [true, true, false], [/rimborsi[^.]*non[^.]*legg|non[^.]*legg[^.]*rimborsi/i.test(testo(senzaRimb)), conTesto(senzaRimb, /^\s*Rimborsa\s*$/).length > 0 && conTesto(senzaRimb, /^\s*Rimborsa\s*$/).every(spento), /Nessun rimborso/.test(testo(senzaRimb))]);

    // ── gli stati dell'ordine ──
    const spedito = stripe({ status: "spedito", spedito_il: "2026-11-21T15:00:00.000Z", corriere: "BRT", tracking: "12345678", tracking_url: "https://tracking.example.com/12345678" });
    const ts = (o2) => corpo(d({ dettaglio: dettaglio({ ordine: o2 }) }), { ordine: o2 });
    const hs = ts(spedito);
    c("ordine spedito: corriere, numero e link (https) per il tracking; «Segna consegnato»; «Correggi lo stato»", [true, true, 1, 1], [/BRT/.test(testo(hs)) && /12345678/.test(testo(hs)), /href="https:\/\/tracking\.example\.com\/12345678"/.test(hs), conTesto(hs, /Segna consegnato/).length, conTesto(hs, /Correggi lo stato/).length]);
    c("un link di tracciamento che non è https (javascript:, http:) non diventa un collegamento", false, /href="(javascript|http:|data)/i.test(ts(stripe({ status: "spedito", spedito_il: "2026-11-21T15:00:00.000Z", corriere: "BRT", tracking: "12345678", tracking_url: "javascript:alert(1)" }))));
    c("ordine spedito senza tracking: lo dice", true, /senza tracking/i.test(testo(ts(stripe({ status: "spedito", spedito_il: "2026-11-21T15:00:00.000Z", senza_tracking: true })))));
    const ann = ts(stripe({ status: "annullato", annullo_motivo: "Il cliente ha cambiato idea", annullato_il: "2026-11-21T16:00:00.000Z" }));
    c("ordine annullato: il motivo si legge e «Correggi lo stato» offre la riattivazione; niente «Spedisci»", [true, 1, 0], [/Il cliente ha cambiato idea/.test(testo(ann)), conTesto(ann, /Correggi lo stato/).length, conTesto(ann, /^\s*Spedisci/).length]);
    const inAttesa = ts(stripe({ stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null, scade_il: "2099-01-01T10:00:00.000Z" }));
    c("ordine in attesa di pagamento: lo dice, nessun «Rimborsa», nessun «Spedisci»; «Controlla con Stripe» c'è", [true, 0, 0, 1], [/In attesa di pagamento/.test(testo(inAttesa)), conTesto(inAttesa, /^\s*Rimborsa\s*$/).length, conTesto(inAttesa, /^\s*Spedisci/).length, conTesto(inAttesa, /Controlla con Stripe/).length]);
    const senzaFattura = ts(stripe({ fattura_richiesta: false }));
    c("senza fattura richiesta: lo dice, niente tasto «Segna fattura emessa»", [true, 0], [/non ha chiesto la fattura/i.test(testo(senzaFattura)), conTesto(senzaFattura, /Segna fattura emessa/).length]);
    const fe = ts(stripe({ fattura_emessa_il: "2026-11-22T09:00:00.000Z", fattura_nota: "Fattura n. 12" }));
    c("fattura già emessa: data e nota, niente tasto «Segna fattura emessa»", [true, 0], [/Fattura n\. 12/.test(testo(fe)), conTesto(fe, /Segna fattura emessa/).length]);

    // ── gli ordini di prima: tutto com'era ──
    const vec = vecchio({ status: "nuovo" });
    const hv = D.CorpoOrdine ? renderToStaticMarkup(h(D.CorpoOrdine, { ordine: vec, comandi: true, occupato: false, esito: null, chiedi, storico: stoVuoto })) : "manca";
    c("ordine di prima (senza stato di pagamento): il corpo è quello di sempre (menu stato, «Segna come pagato», tracking libero)", [true, true, true, false], [/<select[^>]*aria-label="Stato ordine/.test(hv), /Segna come pagato/.test(testo(hv)), /Codice di tracciamento/.test(testo(hv)), /Controlla con Stripe|Rimborsa/.test(testo(hv))]);

    // ── le finestre ──
    const nulla2 = async () => ({ ok: true, nessunCambio: true });
    const dialogo = { chiaveRichiesta: CHIAVE, rimborso: nulla2, annulla: nulla2 };
    const filled = (html2) => bottoni(html2).filter((b) => /bg-primary|bg-destructive/.test(b));
    const fr = (extra = {}) => (DR.FormRimborso ? renderToStaticMarkup(h(DR.FormRimborso, { ordine, rimborsi: [rimb(1, 500, "riuscito")], dialogo, inInvio: false, onFatto: () => {}, onChiudi: () => {}, ...extra })) : "manca FormRimborso");
    const hr = fr();
    c("dialogo «Rimborsa»: l'importo parte dal residuo (24,90 − 5,00 = 19,90), c'è il motivo e la conferma esplicita", [true, true, true], [/value="19,90"/.test(hr), /<textarea[^>]*maxLength="500"|maxLength="500"[^>]*<\/textarea>|<textarea[^>]*maxlength="500"/i.test(hr), /type="checkbox"/.test(hr) && /non si può annullare/i.test(testo(hr))]);
    c("dialogo «Rimborsa»: UN solo bottone pieno («Rimborsa»), l'altro è «Torna indietro» ed è un contorno", [1, true, true], [filled(hr).length, /Rimborsa/.test(testo(filled(hr)[0] ?? "")), conTesto(hr, /Torna indietro/).length === 1 && !/bg-primary/.test(conTesto(hr, /Torna indietro/)[0])]);
    const hri = fr({ inInvio: true });
    c("dialogo «Rimborsa»: durante l'invio il bottone si spegne (nessun doppio invio) e dice che sta lavorando", [true, true], [filled(hri).every(spento) && filled(hri).length === 1, /Invio in corso|Sto inviando|Un momento/i.test(testo(hri))]);
    c("dialogo «Rimborsa»: nessun id, nessun IP, solo l'importo e la frase che il rimborso non si annulla", false, /cs_test|pi_test|re_test|stripe_/i.test(hr));
    const fa = (extra = {}) => (DA.FormAnnulla ? renderToStaticMarkup(h(DA.FormAnnulla, { ordine, rimborsi: [rimb(1, 500, "riuscito")], dialogo, inInvio: false, onFatto: () => {}, onChiudi: () => {}, ...extra })) : "manca FormAnnulla");
    const ha1 = fa();
    c("dialogo «Annulla»: motivo obbligatorio, scelta del rimborso (ora / nessuno) e del magazzino (sì / no), NESSUNA scelta di partenza", [true, true, 0], [/<textarea/.test(ha1), /Rimborsa ora/.test(testo(ha1)) && /Nessun rimborso dovuto/.test(testo(ha1)) && /magazzino/.test(testo(ha1)), (ha1.match(/<input[^>]*type="radio"[^>]*checked/g) ?? []).length]);
    c("dialogo «Annulla»: un solo bottone pieno, durante l'invio spento", [1, true], [filled(ha1).length, filled(fa({ inInvio: true })).every(spento)]);
    const haAttesa = fa({ ordine: stripe({ stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null }), rimborsi: [] });
    c("dialogo «Annulla» di un ordine in attesa: nessuna scelta di rimborso né di magazzino, e dice che la sessione si chiude", [false, true], [/Rimborsa ora|magazzino/.test(testo(haAttesa)), /sessione/i.test(testo(haAttesa))]);
    const fs = (extra = {}) => (DS.FormSpedisci ? renderToStaticMarkup(h(DS.FormSpedisci, { ordine, spedisci: nulla2, inInvio: false, onFatto: () => {}, onChiudi: () => {}, ...extra })) : "manca FormSpedisci");
    const hsp = fs();
    c("dialogo «Spedisci»: corriere dall'elenco (menu), numero in un campo di testo con tetto (40), «senza tracking»", [true, true, true], [["BRT", "GLS", "SDA", "DHL", "UPS", "Poste Italiane"].every((n) => hsp.includes(n)), /<input[^>]*maxLength="40"|maxLength="40"/.test(hsp), /senza tracking/i.test(testo(hsp))]);
    c("dialogo «Spedisci»: un solo bottone pieno, durante l'invio spento", [1, true], [filled(hsp).length, filled(fs({ inInvio: true })).every(spento)]);
    c("le finestre non hanno bottoni di cancellazione né frasi di «elimina»", false, /elimin|cancell|delete/i.test(hr + ha1 + hsp));
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }

  // ══ 11 · IL SORGENTE: CIÒ CHE NON DEVE ESSERCI, E CIÒ CHE DEVE ══════════════════════════════════════════
  const FILE = ["src/crm/ecommerce/DettaglioOrdine.tsx", "src/crm/ecommerce/dialoghi/Finestra.tsx", "src/crm/ecommerce/dialoghi/DialogoSpedisci.tsx", "src/crm/ecommerce/dialoghi/DialogoRimborso.tsx", "src/crm/ecommerce/dialoghi/DialogoAnnulla.tsx"];
  const grezzi = FILE.map(leggi);
  const src = grezzi.map(senzaCommenti);
  const [dett, fin, dsp, drm, dan] = src;
  c("i cinque file ci sono (il pannello e le quattro finestre)", [true, true, true, true, true], grezzi.map((g) => g.length > 500));
  c("niente window.confirm, confirm( o alert( in nessun file", [false, false, false, false, false], src.map((s) => /window\.(confirm|alert|prompt)|\bconfirm\(|\balert\(|\bprompt\(/.test(s)));
  c("niente «Elimina», «Cancella», «delete», «DELETE» nei testi e nelle chiamate", [false, false, false, false, false], src.map((s) => /Elimin|Cancell|\bdelete\b|"DELETE"/i.test(s)));
  c("niente HTML grezzo né JSON dell'intero oggetto riservato", [false, false, false, false, false], src.map((s) => /dangerouslySetInnerHTML|innerHTML|JSON\.stringify|__html/.test(s)));
  c("gli id di Stripe non compaiono nel codice delle schermate (sessione, pagamento, rimborso)", [false, false, false, false, false], src.map((s) => /stripeSessioneId|stripePagamentoId|stripeRimborsoId|stripe_sessione|stripe_pagamento/.test(s)));
  c("solo l'archivio e l'hook di T61: `useDettaglioOrdine` sì; le funzioni nude di `client.ts` mai (dal client si importano solo tipi)", [true, true], [/useDettaglioOrdine/.test(dett), src.every((s) => !/import\s+(?!type\b)[^;]*from\s+"\.{1,2}\/(\.\/)?client"/.test(s.replace(/\n/g, " ")))]);
  c("le schermate non parlano con la rete (niente fetch, niente fetchCRM, niente supabase)", [false, false, false, false, false], src.map((s) => /\bfetch\b|fetchCRM|supabase|XMLHttpRequest/.test(s)));
  c("i dialoghi si montano con `key={…id}` e solo quando sono aperti", [true, true, true], [/<DialogoRimborso\b[^>]*key=\{[^}]*\.id\}|<DialogoRimborso\s+key=\{/.test(dett), /<DialogoAnnulla\b[^>]*key=\{[^}]*\.id\}|<DialogoAnnulla\s+key=\{/.test(dett), /<DialogoSpedisci\b[^>]*key=\{[^}]*\.id\}|<DialogoSpedisci\s+key=\{/.test(dett)]);
  c("`apriDialogo(` si chiama UNA volta per dialogo, all'apertura (un `useState`/`useRef` con inizializzatore), mai nel disegno", [1, 1, 0], [(drm.match(/apriDialogo\(\)/g) ?? []).length, (dan.match(/apriDialogo\(\)/g) ?? []).length, (dsp.match(/apriDialogo/g) ?? []).length]);
  c("…dentro un inizializzatore: `useState(() => apriDialogo())`", [true, true], [/useState\(\s*\(\)\s*=>\s*apriDialogo\(\)\s*\)/.test(drm), /useState\(\s*\(\)\s*=>\s*apriDialogo\(\)\s*\)/.test(dan)]);
  c("le tre finestre si disabilitano con `inInvio` e non si chiudono mentre invia", [true, true, true], [dsp, drm, dan].map((s) => /disabled=\{[^}]*inInvio/.test(s)));
  c("la finestra (`Finestra`) è un AlertDialog: non si chiude cliccando fuori, e con `inInvio` nemmeno con Esc", [true, true], [/AlertDialog\b/.test(fin), /inInvio/.test(fin)]);
  c("il numero di tracking è un campo di testo con tetto (`maxLength` da `NUMERO_MAX`)", true, /maxLength=\{NUMERO_MAX\}|maxLength=\{40\}/.test(dsp));
  c("il pannello usa la frase del server per il rimborso in corso e blocca il tasto con `tastoRimborso`", [true, true], [/tastoRimborso\(/.test(dett), /rimborsoInCorso\(/.test(dett)]);
  c("«Invia ora» mostra `blocco` (la ragione), «Rimborsa» mostra `ragione`", [true, true], [/\.blocco\b/.test(dett), /\.ragione\b/.test(dett)]);
  c("fattura e consensi passano da `datiFattura`/`datiConsensi` (campi noti), «Copia» da `testoPerFattura`", [true, true, true], [/datiFattura\(/.test(dett), /datiConsensi\(/.test(dett), /testoPerFattura\(/.test(dett)]);
  c("il link di tracciamento si mette solo se comincia per https:// (nessun javascript:)", true, /https:(\\)?\/(\\)?\//.test(dett) && /href=\{/.test(dett));
  c("i file che non sono di T64 non cambiano: `ElencoOrdini.tsx`, `Panoramica.tsx`, `client.ts`, `CRM.ecommerce.tsx` non importano le finestre nuove", [false, false, false, false], ["src/crm/ecommerce/ElencoOrdini.tsx", "src/crm/ecommerce/Panoramica.tsx", "src/crm/ecommerce/client.ts", "src/routes/CRM.ecommerce.tsx"].map((f) => /dialoghi\//.test(leggi(f))));
}
