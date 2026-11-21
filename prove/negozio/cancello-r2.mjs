/** ── NEGOZIO · T56 · IL CANCELLO NEL RILASCIO 2 E I FATTI DEL DATABASE ─────
 *  `src/crm/negozio/cancello.ts` (le tre righe di R2 e `condizioniCassa`) e `src/crm/negozio/fatti.server.ts`
 *  (`fattiDelDatabase`, `leggiVetrinaCassa`). Regole (PIANO-R2 §6.1 T56, D56, D65):
 *   · le righe «pagamento», «spedizione_resi», «email_conferma» escono da «non valutabile» solo quando il fatto è passato;
 *     se non è passato restano come in R1 (le prove di R1 sul cancello non cambiano);
 *   · `migrazioneOrdini` NON si passa mai: il cancello non si apre da solo finché la applica a mano il titolare (`puoAprire` falso);
 *   · `pagamentoIncassa` = un ordine REALE (non di prova), pagato e rimborsato per intero; `spedizioneResi` = tariffa confermata
 *     E `resi_confermati` messo dal titolare; `emailConferma` = un ordine con `email_inviate.conferma_ordine.stato = 'inviata'`;
 *   · le variabili d'ambiente non escono mai: solo «presente/assente»;
 *   · `leggiVetrinaCassa`: con cassa effettiva `vecchia` sempre `{sicuro:false, metodi:[]}`; ogni guasto → falso/vuoto.
 *  Dati inventati. Nessun accesso al database vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tariffaSeme } from "./_dati-r2.mjs";
import { uuid } from "./dati.mjs";

const ORA = "2026-11-20T12:00:00.000Z";
const ordine = (n, extra = {}) => ({
  id: uuid(0x7000 + n), order_ref: `HG-T${n}`, canale: "sito", prova: false, stato_pagamento: "rimborsato", pagato_il: "2026-11-20T09:00:00.000Z",
  email_inviate: {}, ...extra,
});
const imp = (chiave, valore) => ({ chiave, valore, aggiornato_il: ORA, aggiornato_da: null });
const confermata = (extra = {}) => tariffaSeme({ provvisoria: false, confermata_il: "2026-11-20T11:00:00.000Z", ...extra });
const AMBIENTE = { STRIPE_SECRET_KEY: "sk_test_FINTA00000000000000000000", STRIPE_WEBHOOK_SECRET: "whsec_FINTO0000000000000000000" };

export async function prove(mod, { c, gruppo, radice }) {
  const G = mod["negozio/cancello"];
  const F = mod["negozio/fatti.server"];
  gruppo("NEGOZIO · IL CANCELLO NEL RILASCIO 2 E I FATTI DEL DATABASE (21/11/2026, T56)");
  if (!F) return c("il modulo src/crm/negozio/fatti.server.ts esiste", true, false);
  const { condizioniUscita, condizioniCassa } = G;
  const riga = (e, chiave) => e.righe.find((x) => x.chiave === chiave);
  const base = { pubblicati: 3, conFotoPrincipale: 3, bannerPresente: true };

  // ── il cancello: le tre righe escono da «non valutabile» solo se il fatto è passato ──
  const r1 = condizioniUscita(base);
  for (const [fatto, chiave] of [["pagamentoIncassa", "pagamento"], ["spedizioneResi", "spedizione_resi"], ["emailConferma", "email_conferma"]]) {
    const v = condizioniUscita({ ...base, [fatto]: true }), f = condizioniUscita({ ...base, [fatto]: false });
    c(`«${chiave}»: fatto vero → valutabile e ok; falso → valutabile e no; non passato → come in R1 (non valutabile)`, [[true, true], [true, false], [false, false, riga(r1, chiave).frase]],
      [[riga(v, chiave).valutabile, riga(v, chiave).ok], [riga(f, chiave).valutabile, riga(f, chiave).ok], [riga(condizioniUscita({ ...base, [fatto]: undefined }), chiave).valutabile, riga(condizioniUscita({ ...base, [fatto]: null }), chiave).ok, riga(condizioniUscita({ ...base }), chiave).frase]]);
  }
  const tre = { ...base, pagamentoIncassa: true, spedizioneResi: true, emailConferma: true };
  c("con le tre righe vere e la migrazione degli ordini NON valutabile → `puoAprire` resta falso (D56: la applica il titolare a mano)", [false, false, false], [condizioniUscita(tre).puoAprire, riga(condizioniUscita(tre), "migrazione_ordini").valutabile, riga(condizioniUscita(tre), "migrazione_ordini").ok]);
  c("…con la migrazione attestata si apre (nulla è cambiato rispetto a R1)", true, condizioniUscita({ ...tre, migrazioneOrdini: true }).puoAprire);
  c("…«migrazione_ordini» non cambia: stessa riga con o senza i tre fatti", riga(r1, "migrazione_ordini"), riga(condizioniUscita(tre), "migrazione_ordini"));

  // ── condizioniCassa: una frase per ogni precondizione di D56 ──
  c("`condizioniCassa` esiste ed espone le sue quattro chiavi", [["chiave_stripe", "segreto_webhook", "tariffa", "migrazione_pagamenti"]], [[...(G.CHIAVI_CONDIZIONI_CASSA ?? [])]]);
  const tutte = { chiavePresente: true, segretoPresente: true, tariffaAttiva: true, s4Presente: true };
  const ok = condizioniCassa(tutte);
  c("tutto presente → si può accendere, quattro righe tutte ok", [true, 4, true], [ok.puoAccendere, ok.righe.length, ok.righe.every((x) => x.ok)]);
  const frasi = new Set();
  for (const [fatto, chiave, parola] of [["chiavePresente", "chiave_stripe", /chiave/i], ["segretoPresente", "segreto_webhook", /segreto/i], ["tariffaAttiva", "tariffa", /tariffa/i], ["s4Presente", "migrazione_pagamenti", /database|aggiornamento|S4/i]]) {
    const e = condizioniCassa({ ...tutte, [fatto]: false });
    const manca = e.righe.filter((x) => !x.ok);
    c(`manca solo «${fatto}» → non si accende, e c'è UNA riga che lo dice (${chiave}) con la sua frase`, [false, [chiave], true], [e.puoAccendere, manca.map((x) => x.chiave), parola.test(manca[0]?.frase ?? "")]);
    frasi.add(manca[0]?.frase);
  }
  c("le quattro frasi sono diverse fra loro (una per ciascuno)", 4, frasi.size);
  for (const strano of [undefined, null, {}, [], 5, "sì", { chiavePresente: "true", segretoPresente: 1, tariffaAttiva: "x", s4Presente: {} }])
    c(`fatti storti ${JSON.stringify(strano)} → non si accende mai (vale «no» per ogni riga)`, [false, 4], ((e) => [e.puoAccendere, e.righe.filter((x) => !x.ok).length])(condizioniCassa(strano)));

  // ── fattiDelDatabase: pagamentoIncassa ──
  const fatti = async (tabelle, extra = {}, ...resto) => {
    const ambiente = resto.length ? resto[0] : AMBIENTE; // `undefined` passato apposta resta `undefined`
    const db = fintoDb({ tabelle: { shop_impostazioni: [], shop_spedizioni_tariffe: [], shop_orders: [], ...tabelle }, ...extra });
    const log = [];
    const f = await F.fattiDelDatabase(db, ambiente, { adesso: () => new Date(ORA), log: (x) => log.push(x) });
    return { f, db, log };
  };
  const solo = async (tabelle, chiave, extra) => (await fatti(tabelle, extra)).f[chiave];
  c("`pagamentoIncassa`: nessun ordine → falso", false, await solo({}, "pagamentoIncassa"));
  c("…l'unico ordine rimborsato è di PROVA → falso", false, await solo({ shop_orders: [ordine(1, { prova: true })] }, "pagamentoIncassa"));
  c("…un ordine reale rimborsato per intero → vero", true, await solo({ shop_orders: [ordine(1)] }, "pagamentoIncassa"));
  c("…uno di prova e uno reale rimborsati → vero", true, await solo({ shop_orders: [ordine(1, { prova: true }), ordine(2)] }, "pagamentoIncassa"));
  for (const [nome, extra] of [["solo pagato (non rimborsato)", { stato_pagamento: "pagato" }], ["rimborsato in parte", { stato_pagamento: "rimborsato_in_parte" }], ["in attesa", { stato_pagamento: "in_attesa" }], ["rimborsato ma mai pagato (nessun `pagato_il`)", { pagato_il: null }], ["ordine R1 (stato vuoto)", { stato_pagamento: null }]])
    c(`…${nome} → falso`, false, await solo({ shop_orders: [ordine(1, extra)] }, "pagamentoIncassa"));

  // ── spedizioneResi ──
  const sp = async (tariffe, resi) => solo({ shop_spedizioni_tariffe: tariffe, shop_impostazioni: resi === undefined ? [] : [imp("resi_confermati", resi)] }, "spedizioneResi");
  c("`spedizioneResi`: tariffa provvisoria (il seme) e resi confermati → falso", false, await sp([tariffaSeme()], true));
  c("…tariffa confermata ma `resi_confermati` falso → falso", false, await sp([confermata()], false));
  c("…tariffa confermata ma `resi_confermati` assente (S5 non applicata) → falso", false, await sp([confermata()], undefined));
  c("…tariffa confermata e resi confermati → vero", true, await sp([confermata()], true));
  c("…`resi_confermati` scritto come testo «true» → falso (solo il vero booleano)", false, await sp([confermata()], "true"));
  c("…`confermata_il` nel futuro → falso (come lo vede il pubblico)", false, await sp([confermata({ confermata_il: "2026-11-21T12:00:00.000Z" })], true));
  c("…tariffa confermata ma non attiva → falso", false, await sp([confermata({ attiva: false })], true));
  c("…nessuna tariffa → falso", false, await sp([], true));

  // ── emailConferma ──
  const em = (email_inviate) => solo({ shop_orders: [ordine(1, { email_inviate })] }, "emailConferma");
  c("`emailConferma`: conferma `inviata` → vero (anche su un ordine di prova)", true, await solo({ shop_orders: [ordine(1, { prova: true, email_inviate: { conferma_ordine: { stato: "inviata" } } })] }, "emailConferma"));
  for (const stato of ["errore", "in_invio", "spenta", "segnaposto", "Inviata"]) c(`…stato «${stato}» → falso`, false, await em({ conferma_ordine: { stato } }));
  c("…`inviata` ma per un altro messaggio (spedito) → falso", false, await em({ spedito: { stato: "inviata" } }));
  c("…nessun ordine, colonna vuota o forma storta → falso", [false, false, false], [await solo({}, "emailConferma"), await em({}), await em("inviata")]);
  c("…fra molti ordini, basta uno con la conferma inviata", true, await solo({ shop_orders: [ordine(1), ordine(2, { email_inviate: { conferma_ordine: { stato: "errore" } } }), ordine(3, { email_inviate: { conferma_ordine: { stato: "inviata" } } })] }, "emailConferma"));

  // ── l'ambiente: solo presente/assente, mai il valore ──
  const amb = async (ambiente) => (await fatti({}, {}, ambiente)).f;
  const a1 = await amb(AMBIENTE);
  c("ambiente con chiave e segreto → `chiavePresente` e `segretoPresente` veri", [true, true], [a1.chiavePresente, a1.segretoPresente]);
  c("…il risultato non contiene MAI i valori (nemmeno un pezzo)", [false, false, false], [JSON.stringify(a1).includes("sk_test"), JSON.stringify(a1).includes("whsec"), JSON.stringify(a1).includes("FINT")]);
  c("…tutti i campi del risultato sono booleani o nulli", [], Object.entries(a1).filter(([, v]) => v !== null && typeof v !== "boolean").map(([k]) => k));
  for (const [nome, ambiente, attesi] of [["senza niente", {}, [false, false]], ["solo la chiave", { STRIPE_SECRET_KEY: "sk_test_x" }, [true, false]], ["solo il segreto", { STRIPE_WEBHOOK_SECRET: "whsec_x" }, [false, true]],
    ["valori vuoti o di soli spazi", { STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "   " }, [false, false]], ["valori non testo", { STRIPE_SECRET_KEY: 5, STRIPE_WEBHOOK_SECRET: {} }, [false, false]], ["ambiente nullo", null, [false, false]], ["ambiente assente", undefined, [false, false]]]) {
    const f = await amb(ambiente);
    c(`ambiente ${nome} → chiave/segreto ${attesi.map((x) => (x ? "presente" : "assente")).join("/")}`, attesi, [f.chiavePresente, f.segretoPresente]);
  }
  c("`migrazioneOrdini` non c'è nel risultato (la applica a mano il titolare)", false, "migrazioneOrdini" in a1);

  // ── tariffa attiva e S4 ──
  c("`tariffaAttiva`: la tariffa seme attiva → vero; nessuna → falso; inattiva → falso", [true, false, false],
    [(await fatti({ shop_spedizioni_tariffe: [tariffaSeme()] })).f.tariffaAttiva, (await fatti({})).f.tariffaAttiva, (await fatti({ shop_spedizioni_tariffe: [tariffaSeme({ attiva: false })] })).f.tariffaAttiva]);
  c("`s4Presente`: le colonne di S4 rispondono → vero", true, (await fatti({ shop_orders: [ordine(1)] })).f.s4Presente);
  const senzaS4 = await fatti({ shop_orders: [ordine(1)] }, { senzaColonne: { shop_orders: ["stato_pagamento", "email_inviate"] } });
  c("S4 non applicata (colonna assente) → `s4Presente` falso e nessuna eccezione; i fatti degli ordini restano «non valutabili»", [false, null, null], [senzaS4.f.s4Presente, senzaS4.f.pagamentoIncassa, senzaS4.f.emailConferma]);

  // ── mai un'eccezione, nel log solo codici ──
  const tutteMancanti = await fatti({}, { mancante: true });
  c("tutte le tabelle assenti → nessuna eccezione; niente si apre: i tre fatti non valutabili, S4 e tariffa assenti", [null, null, null, false, false], [tutteMancanti.f.pagamentoIncassa, tutteMancanti.f.spedizioneResi, tutteMancanti.f.emailConferma, tutteMancanti.f.s4Presente, tutteMancanti.f.tariffaAttiva]);
  const guasto = await fatti({ shop_orders: [ordine(1)] }, { errori: { "shop_orders.select": { error: { code: "57P01", message: "PROVA riga con dati veri" } } } });
  c("errore del database sugli ordini → fatti «non valutabili» (mai «vero»)", [null, null, false], [guasto.f.pagamentoIncassa, guasto.f.emailConferma, guasto.f.s4Presente]);
  c("…nel log solo codici, mai il testo", [true, false], [guasto.log.some((x) => x.includes("57P01")), guasto.log.some((x) => /PROVA|dati veri/.test(x))]);
  const lancia = await fatti({ shop_orders: [ordine(1)] }, { errori: { "shop_orders.select": { lancia: new TypeError("PROVA rete") } } });
  c("il database lancia un'eccezione → nessuna eccezione fuori; nel log il nome del tipo", [null, true, false], [lancia.f.pagamentoIncassa, lancia.log.length > 0, lancia.log.some((x) => /PROVA/.test(x))]);
  c("database nullo → nessuna eccezione, tutto «non valutabile» o falso", [null, false], await F.fattiDelDatabase(null, AMBIENTE).then((f) => [f.pagamentoIncassa, f.s4Presente]).catch(() => ["ECCEZIONE"]));
  c("sola lettura: nessuna scrittura, nessuna funzione chiamata", [], (await fatti({ shop_orders: [ordine(1)], shop_spedizioni_tariffe: [tariffaSeme()] })).db.registro.filter((q) => q.op !== "select"));

  // ── la vetrina: `leggiVetrinaCassa` (D65) ──
  gruppo("NEGOZIO · LA VETRINA DELLA CASSA (D65, T56)");
  const vetrina = async (cassa, righe, extra = {}, orologio = { t: Date.parse(ORA) }) => {
    const db = fintoDb({ tabelle: { shop_impostazioni: righe }, ...extra });
    const log = [];
    return { db, o: orologio, log, vai: (k = cassa) => F.leggiVetrinaCassa({ db, cassa: k, adesso: () => orologio.t, log: (x) => log.push(x) }) };
  };
  const vera = [imp("pagamento_sicuro", true), imp("metodi_pagamento", ["carta", "paypal"])];
  const v1 = await vetrina("stripe", vera);
  const r = await v1.vai();
  c("cassa `stripe` con i due valori in tabella → `sicuro` vero e i metodi spuntati", [true, ["carta", "paypal"], false], [r.sicuro, r.metodi, r.guasto]);
  const v2 = await vetrina("vecchia", vera);
  const rv = await v2.vai();
  c("cassa `vecchia`: `{sicuro:false, metodi:[]}` ANCHE se in tabella il valore è vero", [false, [], false], [rv.sicuro, rv.metodi, rv.guasto]);
  c("…e con la cassa vecchia non si legge nemmeno la tabella", 0, v2.db.registro.length);
  for (const [nome, righe] of [["tabella senza le due righe", []], ["`pagamento_sicuro` «true» (testo)", [imp("pagamento_sicuro", "true"), imp("metodi_pagamento", [])]], ["`pagamento_sicuro` 1", [imp("pagamento_sicuro", 1), imp("metodi_pagamento", [])]]]) {
    const x = await (await vetrina("stripe", righe)).vai();
    c(`${nome} → falso`, [false, []], [x.sicuro, x.metodi]);
  }
  const m1 = await (await vetrina("stripe", [imp("pagamento_sicuro", false), imp("metodi_pagamento", ["carta", "boh", "carta", 5, "klarna"])])).vai();
  c("metodi con un valore sconosciuto, un doppione e un numero → escono solo i conosciuti, una volta", ["carta", "klarna"], m1.metodi);
  c("`metodi_pagamento` che non è un elenco → vuoto", [[], []], [(await (await vetrina("stripe", [imp("metodi_pagamento", "carta")])).vai()).metodi, (await (await vetrina("stripe", [imp("metodi_pagamento", { carta: true })])).vai()).metodi]);
  const mancante = await vetrina("stripe", vera, { mancante: true });
  const rm = await mancante.vai();
  c("tabella assente → tutto falso/vuoto, nessuna eccezione", [false, []], [rm.sicuro, rm.metodi]);
  const gv = await vetrina("stripe", vera, { errori: { "shop_impostazioni.select": { error: { code: "57P01", message: "PROVA vetrina" } } } });
  const rg = await gv.vai();
  c("errore del database → falso/vuoto e `guasto` vero (la funzione risponde `no-store`); nel log solo il codice", [false, [], true, true, false], [rg.sicuro, rg.metodi, rg.guasto, gv.log.some((x) => x.includes("57P01")), gv.log.some((x) => /PROVA/.test(x))]);
  const lv = await vetrina("stripe", vera, { errori: { "shop_impostazioni.select": { lancia: new TypeError("PROVA rete") } } });
  c("il database lancia → falso/vuoto, nessuna eccezione", [false, [], true], await lv.vai().then((x) => [x.sicuro, x.metodi, x.guasto]).catch(() => ["ECCEZIONE"]));
  c("database nullo → falso/vuoto, nessuna eccezione", [false, []], await F.leggiVetrinaCassa({ db: null, cassa: "stripe" }).then((x) => [x.sicuro, x.metodi]).catch(() => ["ECCEZIONE"]));
  // memoria di 15 secondi
  const mm = await vetrina("stripe", vera);
  await mm.vai();
  mm.o.t += 14_000;
  await mm.vai();
  const letture = () => mm.db.registro.filter((q) => q.tab === "shop_impostazioni").length;
  c("due chiamate a 14 secondi di distanza = UNA lettura", 1, letture());
  mm.o.t += 2_000;
  await mm.vai();
  c("a 16 secondi dalla prima → una seconda lettura", 2, letture());
  const m3 = await vetrina("stripe", vera);
  await Promise.all([m3.vai(), m3.vai(), m3.vai()]);
  c("tre chiamate nello stesso istante = una lettura sola", 1, m3.db.registro.filter((q) => q.tab === "shop_impostazioni").length);
  const mg = await vetrina("stripe", vera, { errori: { "shop_impostazioni.select": { error: { code: "57P01", message: "x" } } } });
  await mg.vai();
  mg.o.t += 6_000;
  await mg.vai();
  c("un guasto si ricorda solo 5 secondi: a 6 secondi si rilegge", 2, mg.db.registro.filter((q) => q.tab === "shop_impostazioni").length);

  // ── la funzione del server, sul sorgente ──
  const fun = readFileSync(join(radice, "src/shop/cms/cassa-pubblica.functions.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  c("`cassaPubblica` è una `createServerFn` GET che legge la cassa EFFETTIVA (un solo punto di decisione) e `leggiVetrinaCassa`", [true, true, true], [/export const cassaPubblica\s*=\s*createServerFn\(\{ method: "GET" \}\)/.test(fun), fun.includes("cassaEffettivaDelServer"), fun.includes("leggiVetrinaCassa")]);
  c("…`no-store` sul guasto, `public, max-age=15` altrimenti, e il `public` solo sulla chiamata del browser (`cacheDellaRisposta`)", [true, true, true], [fun.includes("no-store"), fun.includes("public, max-age=15"), fun.includes("cacheDellaRisposta")]);
  c("…non scrive e non legge variabili d'ambiente (nessun `process.env`)", [false, false, false], [fun.includes("process.env"), /\.(insert|update|upsert|delete|rpc)\(/.test(fun), fun.includes("console.log")]);
  c("…risponde solo `{cassa, sicuro, metodi}` (nient'altro della cassa)", true, /cassa[^]*sicuro[^]*metodi/.test(fun));
  // i sorgenti nuovi
  for (const file of ["src/crm/negozio/fatti.server.ts", "src/shop/cms/cassa-pubblica.functions.ts"]) {
    const t = readFileSync(join(radice, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    c(`${file}: nessuna scrittura (insert, update, upsert, delete, rpc)`, [], [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("].filter((x) => t.includes(x)));
  }
  const ft = readFileSync(join(radice, "src/crm/negozio/fatti.server.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  c("fatti.server.ts: non legge l'ambiente da sé (arriva dalla porta) e non stampa nulla", [false, false], [/process\.env|import\.meta\.env/.test(ft), /console\./.test(ft)]);
}
