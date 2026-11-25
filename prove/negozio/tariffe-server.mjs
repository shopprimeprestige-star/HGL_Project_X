/** ── NEGOZIO · T50 · LA TARIFFA PUBBLICA (`tariffaSpedizione`) ──────────────
 *  `src/shop/cassa/tariffe.server.ts` + l'involucro `tariffe.functions.ts`. Regole (PIANO-R2 T50, D51, D62):
 *   · legge la tariffa attiva dell'Italia, memoria di 30 s (un guasto 5 s), MAI un'eccezione;
 *   · la risposta è `SpedizionePubblica` di T45: sei chiavi, niente `provvisoria`, `confermata_il`, `id`;
 *     con la tariffa provvisoria corriere, tempi e frase sono `null`;
 *   · tariffa inattiva o nessuna riga → `assente`;
 *   · RIPIEGO (D51): tabella S5 assente E cassa effettiva `vecchia` → 490 non confermata; con la cassa `stripe` → `assente`;
 *     il 490 è scritto UNA volta, in quel file, e in nessun altro file della cassa nuova. Dati inventati. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tariffaSeme } from "./_dati-r2.mjs";

const ORA = Date.parse("2026-11-20T12:00:00.000Z");
const CHIAVI = ["confermata", "corriere", "costoCent", "frase", "stato", "tempi"];
const confermata = (extra = {}) => tariffaSeme({ provvisoria: false, confermata_il: "2026-11-20T11:00:00.000Z", corriere: "BRT", giorni_min: 2, giorni_max: 4, ...extra });
const vecchia = async () => "vecchia";
const stripe = async () => "stripe";

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · LA TARIFFA PUBBLICA (21/11/2026, T50)");
  const T = mod["shop/cassa/tariffe.server"];
  if (!T) return c("il modulo src/shop/cassa/tariffe.server.ts esiste", true, false);
  const SP = mod["shop/cassa/spedizione"];

  const log = [];
  /** Una porta nuova (database nuovo = memoria nuova); `cassa` è la cassa effettiva. */
  const nuova = (righe, { cassa = vecchia, ...opz } = {}) => {
    const db = fintoDb({ tabelle: { shop_spedizioni_tariffe: righe }, ...opz });
    const t = { t: ORA };
    return { db, t, vai: () => T.tariffaSpedizione({ db, adesso: () => t.t, cassa, log: (x) => log.push(x) }) };
  };
  const letture = (db) => db.registro.filter((q) => q.tab === "shop_spedizioni_tariffe").length;

  // ── la risposta: sei chiavi, con la tariffa provvisoria ──
  const p = nuova([tariffaSeme()]);
  const r1 = await p.vai();
  c("tariffa provvisoria (il seme): costo 490, non confermata, corriere/tempi/frase nulli", { stato: "ok", costoCent: 490, confermata: false, corriere: null, tempi: null, frase: null }, r1);
  c("…le chiavi sono le sei del contratto e nient'altro", CHIAVI, Object.keys(r1).sort());
  const prov = await nuova([tariffaSeme({ corriere: "BRT", giorni_min: 2, giorni_max: 4 })]).vai();
  c("provvisoria con corriere e tempi già scritti → corriere, tempi e frase restano NULLI (D62: il server li annulla)", [490, false, null, null, null], [prov.costoCent, prov.confermata, prov.corriere, prov.tempi, prov.frase]);
  const ok = await nuova([confermata()]).vai();
  c("dopo «Conferma» (provvisoria falsa, data passata): ci sono corriere, tempi e frase", [true, "BRT", { min: 2, max: 4 }, "Consegna in 2-4 giorni lavorativi dopo la preparazione"], [ok.confermata, ok.corriere, ok.tempi, ok.frase]);
  c("…sempre le sei chiavi", CHIAVI, Object.keys(ok).sort());
  const parziale = await nuova([confermata({ giorni_max: null })]).vai();
  c("confermata ma un solo limite dei tempi scritto → niente tempi e niente frase (il corriere sì)", [true, "BRT", null, null], [parziale.confermata, parziale.corriere, parziale.tempi, parziale.frase]);
  const senzaCorriere = await nuova([confermata({ corriere: null })]).vai();
  c("confermata senza corriere → corriere nullo, tempi sì", [null, { min: 2, max: 4 }], [senzaCorriere.corriere, senzaCorriere.tempi]);
  const futura = await nuova([confermata({ confermata_il: "2026-11-21T12:00:00.000Z" })]).vai();
  c("`confermata_il` nel futuro → ancora non confermata", [false, null, null, null], [futura.confermata, futura.corriere, futura.tempi, futura.frase]);
  const testo = JSON.stringify([r1, prov, ok, parziale]);
  c("nelle risposte NON compaiono mai `provvisoria`, `confermata_il`, `id`, né l'id vero della tariffa, né paese, attiva, nome", [false, false, false, false, false, false, false],
    [/provvisoria/.test(testo), /confermata_il/.test(testo), /"id"/.test(testo), testo.includes(tariffaSeme().id), /paese/.test(testo), /attiva/.test(testo), /Spedizione tracciata/.test(testo)]);
  c("la risposta è la stessa che dà `leggiSpedizione` di T45 sulla stessa riga (un contratto solo)", SP.leggiSpedizione(confermata(), ORA), ok);
  const gratis = await nuova([confermata({ gratis_da_cent: 100 })]).vai();
  c("una soglia «gratis da» scritta nella tabella è ignorata (D51): il costo resta 490", 490, gratis.costoCent);

  // ── tariffa assente ──
  c("tariffa inattiva (spenta dal titolare) → assente", { stato: "assente" }, await nuova([tariffaSeme({ attiva: false })]).vai());
  c("nessuna riga nella tabella → assente (la cassa non si apre)", { stato: "assente" }, await nuova([]).vai());
  c("costo storto nella tabella (null) → assente, mai un costo inventato", { stato: "assente" }, await nuova([confermata({ costo_cent: null })]).vai());
  c("…anche con la cassa vecchia: una tariffa spenta NON è «migrazione assente», niente ripiego", { stato: "assente" }, await nuova([tariffaSeme({ attiva: false })], { cassa: vecchia }).vai());

  // ── la memoria di 30 secondi ──
  const m = nuova([tariffaSeme()]);
  await m.vai();
  m.t.t += 29_000;
  await m.vai();
  c("due chiamate a 29 secondi di distanza = UNA lettura della tabella", 1, letture(m.db));
  m.t.t += 2_000;
  await m.vai();
  c("a 31 secondi dalla prima → una seconda lettura", 2, letture(m.db));
  const m2 = nuova([tariffaSeme()]);
  await Promise.all([m2.vai(), m2.vai(), m2.vai()]);
  c("tre chiamate nello stesso istante = una lettura sola", 1, letture(m2.db));
  const m3 = nuova([tariffaSeme()]);
  await m3.vai();
  m3.db.tabelle.shop_spedizioni_tariffe[0].costo_cent = 590;
  m3.t.t += 10_000;
  c("il titolare cambia il costo: entro 30 secondi si vede ancora il vecchio", 490, (await m3.vai()).costoCent);
  m3.t.t += 21_000;
  c("…dopo 31 secondi si vede il nuovo", 590, (await m3.vai()).costoCent);
  const m4 = nuova([tariffaSeme()]);
  await m4.vai();
  m4.t.t -= 5_000;
  await m4.vai();
  c("l'orologio che torna indietro non congela la memoria: si rilegge", 2, letture(m4.db));
  const diversi = [nuova([tariffaSeme()]), nuova([tariffaSeme({ costo_cent: 990 })])];
  c("due database (due isolati) hanno due memorie: non si mescolano", [490, 990], [(await diversi[0].vai()).costoCent, (await diversi[1].vai()).costoCent]);

  // ── mai un'eccezione: guasti ──
  let rotto = true;
  const g = nuova([tariffaSeme()], { errori: { "shop_spedizioni_tariffe.select": () => (rotto ? { error: { code: "57P01", message: "PROVA riga con dati" } } : undefined) } });
  c("errore del database (non «tabella assente») → assente, mai un'eccezione", { stato: "assente" }, await g.vai());
  c("…e con la cassa vecchia lo stesso: il ripiego è SOLO per la tabella assente (D51), non per ogni guasto", { stato: "assente" }, await nuova([tariffaSeme()], { cassa: vecchia, errori: { "shop_spedizioni_tariffe.select": { error: { code: "57P01", message: "x" } } } }).vai());
  g.t.t += 3_000;
  await g.vai();
  c("un guasto si ricorda 5 secondi: a 3 secondi non si rilegge", 1, letture(g.db));
  rotto = false;
  g.t.t += 3_000;
  const tornata = await g.vai();
  c("…a 6 secondi si rilegge e la tariffa torna (non resta «assente» per 30 s)", [2, 490], [letture(g.db), tornata.costoCent]);
  const ex = nuova([tariffaSeme()], { errori: { "shop_spedizioni_tariffe.select": { lancia: new TypeError("PROVA rete con dati") } } });
  c("il database lancia un'eccezione → assente, nessuna eccezione fuori", { stato: "assente" }, await ex.vai());
  c("nel log solo codici, mai il testo dell'errore", [true, false], [log.length > 0, log.some((x) => /PROVA|dati/.test(x))]);
  c("…il codice dell'errore c'è", true, log.some((x) => x.includes("57P01")));
  const anomalo = await T.tariffaSpedizione({ db: null, adesso: () => ORA, cassa: vecchia }).catch(() => "ECCEZIONE");
  c("persino con un database nullo (collegamento mancante) → assente, nessuna eccezione", { stato: "assente" }, anomalo);

  // ── il ripiego di D51 ──
  const ass = (opz) => nuova([tariffaSeme()], { mancante: ["shop_spedizioni_tariffe"], ...opz });
  const rip = await ass({ cassa: vecchia }).vai();
  c("S5 assente + cassa vecchia → 490 non confermata, senza corriere, tempi e frase (il sito di oggi)", { stato: "ok", costoCent: 490, confermata: false, corriere: null, tempi: null, frase: null }, rip);
  c("…con le stesse sei chiavi del contratto", CHIAVI, Object.keys(rip).sort());
  c("S5 assente + cassa stripe → assente (la cassa non si apre, «manca la tariffa»)", { stato: "assente" }, await ass({ cassa: stripe }).vai());
  c("S5 assente (PGRST205) + cassa vecchia → 490 anche con l'altro codice di tabella assente", 490, (await ass({ cassa: vecchia, codiceMancante: "PGRST205" }).vai()).costoCent);
  c("S5 assente e la cassa non si riesce a leggere (lancia) → vecchia (ogni errore → vecchia, D56): 490", 490, (await ass({ cassa: async () => { throw new Error("PROVA"); } }).vai()).costoCent);
  const cambia = { v: "vecchia" };
  const dinamica = ass({ cassa: async () => cambia.v });
  await dinamica.vai();
  cambia.v = "stripe";
  c("il ripiego guarda la cassa a ogni chiamata (la lettura della tabella è in memoria, la scelta no): vecchia → stripe cambia la risposta subito", { stato: "assente" }, await dinamica.vai());
  c("…e con S5 assente la tabella si legge una volta sola per entrambe le risposte", 1, letture(dinamica.db));
  c("tabella presente e tariffa presente, cassa vecchia → vale la tabella (590), non il ripiego", 590, (await nuova([tariffaSeme({ costo_cent: 590 })], { cassa: vecchia }).vai()).costoCent);
  let chieste = 0;
  await T.tariffaSpedizione({ db: fintoDb({ tabelle: { shop_spedizioni_tariffe: [tariffaSeme()] } }), adesso: () => ORA, cassa: async () => { chieste++; return "vecchia"; } });
  c("la cassa non viene nemmeno chiesta quando la tariffa c'è", 0, chieste);

  // ── il sorgente: il 490 è uno, qui, e in nessun altro file della cassa nuova ──
  const nudo = (f) => readFileSync(join(radice, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const conta = (s) => (s.match(/\b490\b/g) ?? []).length;
  const server = nudo("src/shop/cassa/tariffe.server.ts");
  c("tariffe.server.ts: il 490 è scritto UNA volta sola (fuori dai commenti)", 1, conta(server));
  const cassaNuova = ["src/crm/negozio/spedizioni.server.ts", "src/shop/cms/cassa-sito.ts", "src/shop/cms/cassa-sito.functions.ts", "src/shop/cassa/tariffe.functions.ts", ...readdirSync(join(radice, "src/shop/cassa")).filter((f) => /\.tsx?$/.test(f) && f !== "tariffe.server.ts").map((f) => `src/shop/cassa/${f}`), ...readdirSync(join(radice, "src/shop/stripe")).map((f) => `src/shop/stripe/${f}`)];
  const colpevoli = cassaNuova.filter((f) => { try { const s = nudo(f); return conta(s) > 0 || s.includes("SPEDIZIONE_CMS_CENT"); } catch { return false; } });
  c("nessun altro file della cassa nuova contiene 490 o SPEDIZIONE_CMS_CENT", [], colpevoli);
  const vecchiaCassa = mod["shop/cms/cassa"];
  c("il ripiego vale quanto la costante della cassa vecchia (SPEDIZIONE_CMS_CENT): le due cifre non possono divergere", vecchiaCassa.SPEDIZIONE_CMS_CENT, rip.costoCent);
  c("tariffe.server.ts non scrive mai: nessuna scrittura nel registro, nessun .insert .update .upsert .delete .rpc nel sorgente", [[], []],
    [[...new Set([m, m2, p, ass({}), g].flatMap((x) => x.db.registro.filter((q) => q.op !== "select").map((q) => q.op)))], [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("].filter((t) => server.includes(t))]);
  c("…non scrive mai nel log altro che codici (nessun console, nessun .message)", [false, false], [/console\./.test(server), /\.message/.test(server)]);
  c("…non conosce la chiave di servizio né l'ambiente (importabile senza ambiente)", [false, false], [/process\.env/.test(server), /SERVICE_ROLE/.test(server)]);
  c("…legge SOLO la tariffa attiva dell'Italia", [true, true, true], [server.includes('"shop_spedizioni_tariffe"'), server.includes('.eq("attiva", true)'), server.includes('.eq("paese", "IT")')]);

  // ── l'involucro per le pagine ──
  const fn = nudo("src/shop/cassa/tariffe.functions.ts");
  c("tariffe.functions.ts: createServerFn GET, intestazione `public, max-age=30`, nessun errore verso il pubblico", [true, true, true, true],
    [fn.includes("createServerFn"), /method:\s*"GET"/.test(fn), fn.includes("public, max-age=30"), fn.includes("catch")]);
  c("…esporta `tariffaSpedizione` (il nome del contratto, PIANO-R2 §3.7)", true, /export const tariffaSpedizione\b/.test(fn));
  c("…il `public` solo per la chiamata del browser (stessa regola del catalogo: `cacheDellaRisposta`)", true, fn.includes("cacheDellaRisposta"));
  c("…la cassa effettiva per il ripiego viene da `cassaEffettivaDelServer` (un solo punto, lo stesso delle pagine)", true, fn.includes("cassaEffettivaDelServer"));
}
