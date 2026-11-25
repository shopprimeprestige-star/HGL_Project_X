/** ── EDITOR PRODOTTI · E11 · GLI INVARIANTI DELLA COMMESSA ───────────────────────────────────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, PIANO E11 e §6. Qui non si prova una schermata: si prova che la commessa, nel suo insieme, non ha
 *  fatto danni che nessuna prova di compito vede.
 *  · LA SCHEDA FINTA (`strumenti/scheda-finta/`) non può parlare col database vero: il lanciatore RIFIUTA di partire con un `.env*` o un
 *    `.dev.vars*` (la funzione è quella della vetrina finta, non riscritta), nessun file dello strumento nomina una chiave, e nessun file di
 *    `src/` lo importa;
 *  · IL COSTO non esce dal negozio: una riga variante con `costo_cent: 1234` passata a `varianteDaRiga` e a `costruisciPubblico` non lascia
 *    traccia nel risultato serializzato (PROVA ESEGUITA, non una grep: se una modifica scrive `...riga`, qui diventa rosso);
 *  · SOLO AGGIUNTE: `package.json` e lockfile come all'origine del ramo, nessun DELETE/DROP/TRUNCATE nel codice nuovo e nella migrazione,
 *    nessun `console.` nei file nuovi, nessun `costo_cent`/`costoCent` in `src/shop/**` né nella migrazione delle viste, le quattro viste
 *    `shop_v_*` identiche, le 33 bozze del finto invariate dopo una lettura vera.
 *  «Codice nuovo» = i file AGGIUNTI rispetto a `origin/main` (git), sotto `src/` e `strumenti/scheda-finta/`. Dati inventati, nessuna rete. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { fintoDb } from "./_finto-db.mjs";
import { prodottoProva, varianteProva } from "./dati.mjs";

const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1").replace(/^\s*--.*$/gm, "");
/** Tutti i file di una cartella, sottocartelle comprese (percorsi assoluti). */
const filesDi = (dir) =>
  existsSync(dir) ? readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? filesDi(p) : [p]; }) : [];

export async function prove(mod, { c, gruppo, radice }) {
  const git = (...a) => execFileSync("git", a, { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const STRUMENTO = join(radice, "strumenti", "scheda-finta");
  const MIGRAZIONE = join(radice, "supabase", "migrations", "20261125120000_shop_editor_prodotti.sql");
  const MIGRAZIONE_VISTE = join(radice, "supabase", "migrations", "20261120120000_shop_catalogo.sql");
  /** Il punto da cui il ramo è partito: se `main` va avanti, «uguale a main» non diventa rosso per colpa di altri. */
  let base = "";
  try { base = git("merge-base", "HEAD", "origin/main").trim(); } catch { /* senza `origin/main` (clone senza remoto): niente base */ }
  /** Senza `origin/main`, o con la base uguale a HEAD (main dopo l'unione: non c'è più «il ramo» da confrontare), i controlli che si leggono
   *  dal diff NON hanno senso: si dichiara il salto (riga «SALTATO»), non si va in rosso. Restano attivi quelli che leggono solo file. */
  let head = "";
  try { head = git("rev-parse", "HEAD").trim(); } catch { /* idem */ }
  const conBase = /^[0-9a-f]{40}$/.test(base) && base !== head;
  const dalDiff = (nome, atteso, letto) =>
    conBase ? c(nome, atteso, typeof letto === "function" ? letto() : letto) : c(`SALTATO (${base ? "base = HEAD, siamo su main dopo l'unione" : "manca origin/main"}): ${nome}`, true, true);
  const cambiati = (...f) => { try { return git("diff", "--name-only", base, "--", ...f).split("\n").filter(Boolean); } catch { return ["git non risponde"]; } };
  const nuovi = !conBase ? [] : (() => {
    try {
      const aggiunti = git("diff", "--name-only", "--diff-filter=A", base).split("\n");
      const nonTracciati = git("ls-files", "--others", "--exclude-standard").split("\n");
      return [...new Set([...aggiunti, ...nonTracciati])].filter(Boolean);
    } catch { return []; }
  })();
  const codiceNuovo = (conBase ? nuovi : filesDi(join(radice, "strumenti", "scheda-finta")).map((f) => relative(radice, f))).filter((f) => /^(src\/.*\.tsx?|strumenti\/scheda-finta\/.*\.(mjs|tsx?|html))$/.test(f));

  /* ══ 1 · LA SCHEDA FINTA NON PUÒ TOCCARE IL DATABASE VERO ═════════════════════════════════════════════ */
  gruppo("EDITOR PRODOTTI · E11 · LA SCHEDA FINTA (salvaguardie)");
  const file = (n) => join(STRUMENTO, n);
  c("lo strumento c'è: lanciatore, istruzioni, entrata vite (pagina e html), alias dell'accesso, dati", [true, true, true, true, true, true], ["avvia.mjs", "LEGGIMI.md", "index.html", "pagina.tsx", "auth-finto.ts", "dati.mjs"].map((n) => existsSync(file(n))));
  if (existsSync(file("avvia.mjs"))) {
    const A = await import(pathToFileURL(file("avvia.mjs")).href);
    const sandbox = mkdtempSync(join(tmpdir(), "scheda-finta-prova-"));
    try {
      let n = 0;
      const esito = async (nomeFile) => {
        const cartella = join(sandbox, `app-${++n}`);
        mkdirSync(cartella);
        writeFileSync(join(cartella, nomeFile), "PROVA=inventato\n");
        try { await A.avvia({ radice: cartella, porta: 0 }); return "è partito"; } catch (e) { return e?.name ?? String(e); }
      };
      c("con un `.env`, un `.env.local`, un `.dev.vars` o un `.ENV` nella cartella dell'app il lanciatore RIFIUTA di partire (ErroreSalvaguardia)", ["ErroreSalvaguardia", "ErroreSalvaguardia", "ErroreSalvaguardia", "ErroreSalvaguardia"], [await esito(".env"), await esito(".env.local"), await esito(".dev.vars"), await esito(".ENV")]);
      const pulita = join(sandbox, "pulita"); mkdirSync(pulita); writeFileSync(join(pulita, ".env.example"), "NOME_DI_PROVA=\n");
      const V = await import(pathToFileURL(join(radice, "strumenti", "vetrina-finta", "avvia.mjs")).href);
      const sorgente = readFileSync(file("avvia.mjs"), "utf8");
      c("la funzione che cerca i segreti è quella della vetrina finta (importata, non riscritta); `.env.example` non conta", [true, false, []], [
        /import\s*\{[^}]*\btrovaFileSegreti\b[^}]*\}\s*from\s*"\.\.\/vetrina-finta\/avvia\.mjs"/.test(sorgente), /(function|const)\s+(trovaFileSegreti|eFileSegreto)\b/.test(sorgente), V.trovaFileSegreti([pulita]),
      ]);
    } finally { rmSync(sandbox, { recursive: true, force: true }); }
  }
  const avvia = existsSync(file("avvia.mjs")) ? readFileSync(file("avvia.mjs"), "utf8") : "";
  const corpoAvvia = senzaCommenti(avvia);
  c("il controllo dei file segreti viene PRIMA di creare il server vite (nella funzione `avvia`)", true, corpoAvvia.indexOf("trovaFileSegreti(") > 0 && corpoAvvia.indexOf("trovaFileSegreti(") < corpoAvvia.indexOf("createServer("));
  c("vite: `envDir` su una cartella vuota (mkdtemp), `envPrefix` che non espone nulla della shell, `cacheDir` temporanea (non la `.vite` condivisa)", [true, true, true, true], [/envDir:\s*vuota/.test(corpoAvvia), /envPrefix:\s*"SCHEDA_FINTA_"/.test(corpoAvvia), /cacheDir:\s*join\(temporanea/.test(corpoAvvia), /mkdtempSync\(/.test(corpoAvvia)]);
  c("il server vero si carica con `ssrLoadModule` (nessun pacchetto in più) e non c'è `fetch(` verso l'esterno", [true, false], [/ssrLoadModule\(/.test(corpoAvvia), /\bfetch\(/.test(corpoAvvia)]);
  c("la rotta è solo locale: ascolta su 127.0.0.1 e il finto sta in memoria (nessun client Supabase)", [true, false], [/host:\s*"127\.0\.0\.1"/.test(corpoAvvia), /supabase/i.test(corpoAvvia)]);
  const alias = existsSync(file("auth-finto.ts")) ? senzaCommenti(readFileSync(file("auth-finto.ts"), "utf8")) : "";
  const iAlias = corpoAvvia.indexOf("AuthContext"), iDove = corpoAvvia.search(/find:\s*\/\^@\\\/\/,/);
  c("l'accesso è SOSTITUITO: l'alias di `@/crm/AuthContext` sta prima di `@/`, punta a `auth-finto.ts`, che esporta `fetchCRM` e non importa nulla", [true, true, true, 0], [iAlias > 0 && iDove > iAlias, /auth-finto\.ts/.test(corpoAvvia), /export const fetchCRM\b/.test(alias), (alias.match(/^\s*import\b/gm) || []).length]);
  const tutti = filesDi(STRUMENTO);
  const vietate = tutti.flatMap((f) => (/service_role|SUPABASE_|sk_|eyJ/.test(readFileSync(f, "utf8")) ? [relative(radice, f)] : []));
  c("nessun file di `strumenti/scheda-finta/` nomina `service_role`, `SUPABASE_`, `sk_` o `eyJ` (e ci sono dei file)", [[], true], [vietate, tutti.length >= 6]);
  const importatoDaSrc = filesDi(join(radice, "src")).filter((f) => /\.(tsx?|mjs|js)$/.test(f) && /scheda-finta|strumenti\//.test(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")));
  c("nessun file di `src/` importa lo strumento (né lo nomina: `strumenti/` o `scheda-finta`, commenti esclusi)", [], importatoDaSrc.map((f) => relative(radice, f)));
  c("la configurazione del progetto non conosce lo strumento: `vite.config.ts` e `tsconfig.json` non lo nominano, `npm test` non lo lancia", [false, false, false], [/scheda-finta/.test(readFileSync(join(radice, "vite.config.ts"), "utf8")), /scheda-finta/.test(readFileSync(join(radice, "tsconfig.json"), "utf8")), /scheda-finta/.test(JSON.parse(readFileSync(join(radice, "package.json"), "utf8")).scripts?.test ?? "")]);

  /* ══ 2 · IL COSTO NON ESCE (prova eseguita) ═══════════════════════════════════════════════════════════ */
  gruppo("EDITOR PRODOTTI · E11 · IL COSTO NON ESCE DAL NEGOZIO");
  const R = mod["shop/cms/righe"], P = mod["shop/cms/pubblico"];
  c("i moduli `righe` e `pubblico` si caricano", [true, true], [typeof R?.varianteDaRiga === "function", typeof P?.costruisciPubblico === "function"]);
  if (R && P) {
    const senza = varianteProva({ prezzo_cent: 1990 });
    const con = { ...senza, costo_cent: 1234 };
    const sv = JSON.stringify(R.varianteDaRiga(con));
    c("`varianteDaRiga` con `costo_cent: 1234`: stesso risultato di quella senza costo, e né «costo» né «1234» nel serializzato", [true, false, false, true], [sv === JSON.stringify(R.varianteDaRiga(senza)), /costo/i.test(sv), /1234/.test(sv), sv.length > 40]);
    const costruito = (varianti) => JSON.stringify(P.costruisciPubblico({ prodotti: [prodottoProva()], varianti, media: [], categorie: [], prodottiCategorie: [] }));
    const sp = costruito([con]);
    c("`costruisciPubblico` con la stessa riga: stesso risultato di quello senza costo, né «costo» né «1234», e il prodotto c'è davvero", [true, false, false, true], [sp === costruito([senza]), /costo/i.test(sp), /1234/.test(sp), sp.includes(prodottoProva().nome)]);
    const spCosto = JSON.stringify(P.costruisciPubblico({ prodotti: [{ ...prodottoProva(), costo_cent: 1234 }], varianti: [con], media: [], categorie: [], prodottiCategorie: [] }));
    c("…anche col costo sulla riga del PRODOTTO e dentro un'anteprima", [false, false], [/costo|1234/i.test(spCosto), /costo|1234/i.test(JSON.stringify(P.costruisciPubblico({ prodotti: [{ ...prodottoProva({ stato: "bozza", pubblicato_il: null }), costo_cent: 1234 }], varianti: [con], media: [] }, { anteprima: { slug: prodottoProva().slug } })))]);
  }
  const sorgentiShop = filesDi(join(radice, "src", "shop"));
  /** ⚠️ La grep letterale «nessun `costo_cent` in `src/shop/**`» non regge: su main esistono già nove file che la dicono, TUTTI del costo di SPEDIZIONE
   *  (la tariffa: `costo_cent` di `shop_spedizioni_tariffe`), non del costo del prodotto. Si prova quindi che (1) la commessa non ha toccato nessun file di
   *  `src/shop/**` e (2) chi nomina il costo è solo la tariffa: un decimo file, o uno dei moduli del catalogo (`righe`, `pubblico`, `catalogo`), è rosso. */
  const TARIFFA = ["src/shop/useTariffa.ts", "src/shop/cassa/cassa.server.ts", "src/shop/cassa/tariffa-carrello.ts", "src/shop/cassa/spedizione.ts", "src/shop/cassa/tariffe.server.ts", "src/shop/cassa/cassa-client.ts", "src/shop/cms/vetrina-fiducia.ts", "src/shop/stripe/sessione.ts", "src/shop/cms/vetrina-carrello.ts"];
  dalDiff("la commessa non ha toccato nessun file di `src/shop/**` (il sito pubblico non cambia)", [], () => cambiati("src/shop"));
  c("`costo_cent`/`costoCent` in `src/shop/**` solo nei nove file della TARIFFA di spedizione, mai nei moduli del catalogo", [TARIFFA.sort(), true], [sorgentiShop.filter((f) => /costo_cent|costoCent/.test(readFileSync(f, "utf8"))).map((f) => relative(radice, f)).sort(), sorgentiShop.length > 20]);

  /* ══ 3 · SOLO AGGIUNTE ════════════════════════════════════════════════════════════════════════════════ */
  gruppo("EDITOR PRODOTTI · E11 · SOLO AGGIUNTE");
  dalDiff("c'è un punto di partenza (merge-base con origin/main) e ci sono file nuovi da guardare", [true, true], [conBase, codiceNuovo.length > 10]);
  c("c'è comunque qualcosa da guardare per `console.` e DELETE: i file dello strumento (o tutti i nuovi, se c'è la base)", true, codiceNuovo.length >= 6);
  dalDiff("`package.json` e i lockfile (package-lock.json, bun.lockb) sono identici a quelli di origin/main: nessun pacchetto nuovo", [], () => cambiati("package.json", "package-lock.json", "bun.lockb"));
  const sql = existsSync(MIGRAZIONE) ? senzaCommenti(readFileSync(MIGRAZIONE, "utf8")) : "";
  c("la migrazione `20261125120000` c'è e non ha DELETE, DROP, TRUNCATE (commenti compresi nel controllo)", [true, false], [sql.length > 500, /\b(DELETE|DROP|TRUNCATE)\b/i.test(readFileSync(MIGRAZIONE, "utf8"))]);
  const conParole = codiceNuovo.filter((f) => /\b(DELETE|DROP|TRUNCATE)\b|\.(delete|truncate)\(/.test(senzaCommenti(readFileSync(join(radice, f), "utf8"))));
  c("nessun DELETE/DROP/TRUNCATE (né `.delete(`) nel codice nuovo (src e strumento)", [], conParole);
  const conConsole = codiceNuovo.filter((f) => /\bconsole\./.test(senzaCommenti(readFileSync(join(radice, f), "utf8"))));
  c("nessun `console.` nei file nuovi (src e strumento: il lanciatore scrive con `process.stdout`)", [], conConsole);
  const viste = existsSync(MIGRAZIONE_VISTE) ? readFileSync(MIGRAZIONE_VISTE, "utf8") : "";
  c("le quattro viste `shop_v_*` stanno nella migrazione di S1 e nessuna nomina il costo", [4, false], [(senzaCommenti(viste).match(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+public\.shop_v_\w+/gi) || []).length, /costo_cent|costoCent/.test(viste)]);
  c("la nuova migrazione non nomina `shop_v_` nel codice (non ridefinisce nessuna vista)", 0, (sql.match(/shop_v_/g) || []).length);
  dalDiff("la migrazione delle viste (S1) è IDENTICA a quella di origin/main e nessuna migrazione nuova nomina `shop_v_`", [[], []], () => [cambiati("supabase/migrations/20261120120000_shop_catalogo.sql"), nuovi.filter((f) => f.startsWith("supabase/migrations/") && /shop_v_/.test(senzaCommenti(readFileSync(join(radice, f), "utf8"))))]);

  /* ══ 4 · LE 33 BOZZE DEL FINTO ════════════════════════════════════════════════════════════════════════ */
  gruppo("EDITOR PRODOTTI · E11 · LE 33 BOZZE DEL FINTO");
  if (existsSync(file("dati.mjs")) && mod["negozio/smista.server"]) {
    const { seme } = await import(pathToFileURL(file("dati.mjs")).href);
    const t0 = seme();
    c("il seme ha 33 prodotti, TUTTI in bozza, mai pubblicati, con PROVA nel nome e SKU e indirizzi tutti diversi", [33, true, true, true, 33, 33], [
      t0.shop_prodotti.length, t0.shop_prodotti.every((p) => p.stato === "bozza"), t0.shop_prodotti.every((p) => p.pubblicato_il === null), t0.shop_prodotti.every((p) => /PROVA/.test(p.nome)),
      new Set(t0.shop_prodotti.map((p) => p.sku)).size, new Set(t0.shop_prodotti.map((p) => p.slug)).size,
    ]);
    c("ogni prodotto ha almeno una variante, con la colonna `costo_cent` presente e vuota (migrazione applicata, nessun costo)", [true, true], [
      t0.shop_prodotti.every((p) => t0.shop_varianti.some((v) => v.prodotto_id === p.id)), t0.shop_varianti.every((v) => v.costo_cent === null),
    ]);
    const db = fintoDb({ tabelle: seme() });
    const ora = new Date("2026-11-25T10:00:00.000Z");
    const d = { guardia: async () => ({ ok: true, nome: "PROVA" }), db, adesso: () => ora, log: () => {}, chiaveServizio: () => undefined, fattiEsterni: () => ({ bannerPresente: true }) };
    const r = await mod["negozio/smista.server"].gestisciGET(new Request("https://finto.test/api/crm/negozio?prodotti"), d);
    const corpo = await r.json();
    c("lo smistamento vero legge dal finto: 200 e 33 prodotti nell'elenco", [200, 33], [r.status, corpo.prodotti?.length]);
    c("dopo la lettura le 33 bozze sono IDENTICHE al seme e il finto non ha scritto niente", [true, 0], [JSON.stringify(db.tabelle.shop_prodotti) === JSON.stringify(seme().shop_prodotti), db.scritture.length]);
  } else {
    c("il seme del finto c'è (`dati.mjs`) e lo smistamento si carica", true, false);
  }
}
