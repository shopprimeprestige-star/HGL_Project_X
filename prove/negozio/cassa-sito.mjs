/** ── NEGOZIO · T50 · L'INTERRUTTORE «CASSA DEL SITO» (LETTURA) ──────────────
 *  `src/shop/cms/cassa-sito.ts` (+ l'involucro `cassa-sito.functions.ts`). Regole (PIANO-R2 T50, D56):
 *   · `vecchia|stripe`, memoria di 15 s (un guasto 5 s), ogni errore o valore strano → `vecchia`, mai un'eccezione;
 *   · `cassaEffettiva(catalogo, cassa)` = `stripe` solo con il catalogo `cms` (le righe `codice` non hanno SKU né giacenza);
 *   · la cassa vecchia resta l'impostazione predefinita. `SHOP_CASSA_FORZA` vale solo in locale. Dati inventati. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";

const ORA = Date.parse("2026-11-20T12:00:00.000Z");
const riga = (valore) => ({ chiave: "cassa_sito", valore, aggiornato_il: "2026-11-20T10:00:00.000Z", aggiornato_da: null });

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · LA CASSA DEL SITO, LETTURA (21/11/2026, T50)");
  const C = mod["shop/cms/cassa-sito"];
  if (!C) return c("il modulo src/shop/cms/cassa-sito.ts esiste", true, false);

  // ── le due regole pure ──
  c("cassaDa: solo «stripe» (esatto) è stripe; tutto il resto è vecchia", ["stripe", "vecchia", "vecchia", "vecchia", "vecchia", "vecchia", "vecchia", "vecchia", "vecchia", "vecchia"],
    ["stripe", "vecchia", "Stripe", " stripe", "boh", "", null, undefined, 5, true].map((v) => C.cassaDa(v)));
  c("cassaEffettiva: stripe solo se anche il catalogo è cms", ["stripe", "vecchia", "vecchia", "vecchia"], [C.cassaEffettiva("cms", "stripe"), C.cassaEffettiva("codice", "stripe"), C.cassaEffettiva("cms", "vecchia"), C.cassaEffettiva("codice", "vecchia")]);
  c("cassaEffettiva con valori strani → vecchia", ["vecchia", "vecchia", "vecchia", "vecchia"], [C.cassaEffettiva(undefined, "stripe"), C.cassaEffettiva("cms", undefined), C.cassaEffettiva("CMS", "stripe"), C.cassaEffettiva(null, null)]);

  // ── la lettura ──
  const orologio = () => ({ t: ORA });
  const nuova = (righe, opz = {}) => {
    const db = fintoDb({ tabelle: { shop_impostazioni: righe }, ...(opz.finto ?? {}) });
    const o = orologio();
    const log = [];
    return { db, o, log, vai: (extra = {}) => C.leggiCassa({ db, adesso: () => o.t, log: (x) => log.push(x), ...extra }) };
  };
  const letture = (db) => db.registro.filter((q) => q.tab === "shop_impostazioni").length;
  c("la riga dice stripe → stripe", "stripe", await nuova([riga("stripe")]).vai());
  c("la riga dice vecchia → vecchia (il seme di S4)", "vecchia", await nuova([riga("vecchia")]).vai());
  c("riga assente (seme mancante) → vecchia", "vecchia", await nuova([]).vai());
  for (const strano of ["Stripe", "boh", "", null, 5, true, { cassa: "stripe" }, ["stripe"]])
    c(`valore strano ${JSON.stringify(strano)} → vecchia`, "vecchia", await nuova([riga(strano)]).vai());
  c("tabella assente (S4 non applicata) → vecchia", "vecchia", await nuova([riga("stripe")], { finto: { mancante: ["shop_impostazioni"] } }).vai());
  c("tabella assente (PGRST205) → vecchia", "vecchia", await nuova([riga("stripe")], { finto: { mancante: ["shop_impostazioni"], codiceMancante: "PGRST205" } }).vai());
  const guasto = nuova([riga("stripe")], { finto: { errori: { "shop_impostazioni.select": { error: { code: "57P01", message: "PROVA riga con dati" } } } } });
  c("errore del database → vecchia (anche se la riga direbbe stripe)", "vecchia", await guasto.vai());
  c("…nel log solo il codice, mai il testo", [true, false], [guasto.log.some((x) => x.includes("57P01")), guasto.log.some((x) => /PROVA|dati/.test(x))]);
  const lancia = nuova([riga("stripe")], { finto: { errori: { "shop_impostazioni.select": { lancia: new TypeError("PROVA rete") } } } });
  c("il database lancia un'eccezione → vecchia, nessuna eccezione fuori", "vecchia", await lancia.vai());
  c("…nel log solo il nome del tipo", [true, false], [lancia.log.length > 0, lancia.log.some((x) => /PROVA/.test(x))]);
  c("database nullo (collegamento mancante) → vecchia, nessuna eccezione", "vecchia", await C.leggiCassa({ db: null, adesso: () => ORA }).catch(() => "ECCEZIONE"));
  c("senza `adesso` funziona lo stesso (orologio vero)", "stripe", await C.leggiCassa({ db: fintoDb({ tabelle: { shop_impostazioni: [riga("stripe")] } }) }));

  // ── la memoria di 15 secondi ──
  const m = nuova([riga("stripe")]);
  await m.vai();
  m.o.t += 14_000;
  await m.vai();
  c("due chiamate a 14 secondi di distanza = UNA lettura", 1, letture(m.db));
  m.o.t += 2_000;
  await m.vai();
  c("a 16 secondi dalla prima → una seconda lettura", 2, letture(m.db));
  const m2 = nuova([riga("stripe")]);
  await Promise.all([m2.vai(), m2.vai(), m2.vai()]);
  c("tre chiamate nello stesso istante = una lettura sola", 1, letture(m2.db));
  const m3 = nuova([riga("stripe")]);
  await m3.vai();
  m3.db.tabelle.shop_impostazioni[0].valore = "vecchia";
  m3.o.t += 10_000;
  c("il titolare torna alla cassa vecchia: entro 15 secondi si vede ancora stripe", "stripe", await m3.vai());
  m3.o.t += 6_000;
  c("…dopo 16 secondi vale vecchia", "vecchia", await m3.vai());
  const m4 = nuova([riga("stripe")]);
  await m4.vai();
  m4.o.t -= 5_000;
  await m4.vai();
  c("l'orologio che torna indietro non congela la memoria: si rilegge", 2, letture(m4.db));
  let rotto = true;
  const g = nuova([riga("stripe")], { finto: { errori: { "shop_impostazioni.select": () => (rotto ? { error: { code: "57P01", message: "x" } } : undefined) } } });
  await g.vai();
  g.o.t += 3_000;
  await g.vai();
  c("un guasto si ricorda 5 secondi: a 3 secondi non si rilegge", 1, letture(g.db));
  rotto = false;
  g.o.t += 3_000;
  c("…a 6 secondi si rilegge e la cassa torna quella vera (non resta «vecchia» per 15 s)", "stripe", await g.vai());
  const due = [nuova([riga("stripe")]), nuova([riga("vecchia")])];
  c("due database (due isolati) hanno due memorie", ["stripe", "vecchia"], [await due[0].vai(), await due[1].vai()]);

  // ── l'interruttore di emergenza, solo se chiede «stripe» o «vecchia» ──
  const f = nuova([riga("vecchia")]);
  c("forza «stripe» → stripe, senza leggere il database", ["stripe", 0], [await f.vai({ forza: "stripe" }), f.db.chiamate]);
  const f2 = nuova([riga("stripe")]);
  c("forza «vecchia» → vecchia anche se la tabella dice stripe, senza leggere", ["vecchia", 0], [await f2.vai({ forza: "vecchia" }), f2.db.chiamate]);
  for (const forza of ["boh", "", null, undefined, "STRIPE", "cms"]) c(`forza ${JSON.stringify(forza)} → ignorata: vale la tabella`, "stripe", await nuova([riga("stripe")]).vai({ forza }));
  c("la lettura non scrive mai", [], m.db.registro.filter((q) => q.op !== "select"));

  // ── il sorgente ──
  const nudo = (f) => readFileSync(join(radice, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const puro = nudo("src/shop/cms/cassa-sito.ts");
  c("cassa-sito.ts: legge solo shop_impostazioni, mai scrive, mai l'ambiente", [true, false, false, false], [puro.includes('"shop_impostazioni"'), /\.(insert|update|upsert|delete|rpc)\(/.test(puro), /process\.env/.test(puro), /console\./.test(puro)]);
  c("…un valore che non è «stripe» vale vecchia: nessun altro valore apre la cassa nuova", [true, false], [/=== "stripe"/.test(puro), /!== "vecchia"/.test(puro)]);
  const fn = nudo("src/shop/cms/cassa-sito.functions.ts");
  c("cassa-sito.functions.ts: createServerFn, `no-store` sul guasto, mai un errore verso il pubblico", [true, true, true], [fn.includes("createServerFn"), fn.includes("no-store"), fn.includes("catch")]);
  c("…SHOP_CASSA_FORZA si legge solo in locale (import.meta.env.DEV), mai in produzione", [true, true], [fn.includes("SHOP_CASSA_FORZA"), fn.includes("import.meta.env.DEV")]);
  c("…lo stato effettivo usa `leggiCassa` e `cassaEffettiva` col catalogo", [true, true, true], [fn.includes("leggiCassa"), fn.includes("cassaEffettiva("), fn.includes("modalita()")]);
}
