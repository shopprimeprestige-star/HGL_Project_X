/** ── NEGOZIO · RILASCIO 2 · T68 · LE REGOLE CHE TAGLIANO TUTTO IL RILASCIO (PIANO-R2 T68, D44, D45, D46, D51, D53) ──────
 *  Prove di SORGENTE (albero sintattico di TypeScript, non ricerche di testo, dove la forma conta) sui file del R2, più due prove
 *  di comportamento con un log finto. Ogni regola mette in colonna le violazioni «file:riga»: atteso lista vuota.
 *   1  nessuna chiave in nessun file (src, supabase, documenti, `.env.example`), nemmeno quelle di prova nel codice;
 *   2  nei log passano solo codici: mai `message`, `details`, `hint` di un errore, mai un oggetto in un `console.*`
 *      (e con un database che risponde errori pieni di testi segreti il log non li contiene);
 *   3  nessuna scrittura diretta sulle tabelle che D44, D46 e D53 vogliono dietro una funzione SQL; le funzioni critiche si
 *      chiamano solo dai file che il piano nomina;
 *   4  nessun DELETE, `.delete()`, DROP, TRUNCATE nel codice del R2 né nelle migrazioni (corpi delle funzioni compresi);
 *   5  nessun nome o CAP dello studio nei file nuovi di `src/`; nessuna cifra di Invisible Derm nei file nuovi e nei modelli di base;
 *   6  nessuna libreria nuova, nessun `stripe` in `package.json`;
 *   7  nessuna intestazione CORS nelle rotte del R2;
 *   8  ogni gestore delle rotte ha un `try/catch` di primo livello (o passa a una funzione che lo ha);
 *   9  gli indirizzi di ritorno vengono da `SITO`, mai da `Host` né `Origin`;
 *  10  la cifra di ripiego della spedizione (490) è scritta in un solo file;
 *  11  `.env.example` e `DEPLOY.md` dicono le tre variabili e le migrazioni nell'ordine giusto.
 *  ⚠️ La ricerca delle parole proibite NON guarda `prove/`, dove le parole stanno per forza (qui sono costruite a pezzi). Dati inventati. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import ts from "typescript";

// ── i file del R2 ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Cartelle interamente del R2 (tutto ciò che ci nasce dentro è controllato). */
const CARTELLE_R2 = ["src/shop/stripe", "src/shop/cassa", "src/shop/email"];
/** File nuovi del R2 fuori da quelle cartelle (PIANO-R2 §11). */
const NUOVI_FUORI = [
  "src/crm/ecommerce/cassa/PannelloCassa.tsx", "src/crm/ecommerce/dialoghi/DialogoAnnulla.tsx", "src/crm/ecommerce/dialoghi/DialogoRimborso.tsx",
  "src/crm/ecommerce/dialoghi/DialogoSpedisci.tsx", "src/crm/ecommerce/dialoghi/Finestra.tsx", "src/crm/ecommerce/email/ModelliEmail.tsx",
  "src/crm/ecommerce/pagamento.ts", "src/crm/ecommerce/pagina-r2.ts", "src/crm/ecommerce/rimborsi.server.ts", "src/crm/ecommerce/rimborso.ts",
  "src/crm/ecommerce/spedizioni/ElencoTariffe.tsx", "src/crm/ecommerce/tracking.ts", "src/crm/ecommerce/useDettaglioOrdine.ts",
  "src/crm/negozio/email.server.ts", "src/crm/negozio/fatti.server.ts", "src/crm/negozio/spedizioni.server.ts",
  "src/routes/api.crm.negozio-email.ts", "src/routes/api.crm.stripe.ts", "src/routes/api.public.shop-cassa-permesso.ts", "src/routes/api.public.shop-cassa.ts",
  "src/routes/api.public.shop-collaudo.ts", "src/routes/api.public.stripe-webhook.ts", "src/routes/shop.collaudo.tsx", "src/routes/shop.ordine.$ref.tsx",
  "src/shop/cms/cassa-pubblica.functions.ts", "src/shop/cms/cassa-sito.functions.ts", "src/shop/cms/cassa-sito.ts", "src/shop/cms/collaudo.ts",
  "src/shop/cms/testi-confermati.ts", "src/shop/useTariffa.ts",
];
/** File di R1 che il R2 ha modificato: si controllano per le regole del codice (non per le parole proibite: potrebbero venire da R1). */
const MODIFICATI = [
  "src/crm/ecommerce/DettaglioOrdine.tsx", "src/crm/ecommerce/ElencoOrdini.tsx", "src/crm/ecommerce/Panoramica.tsx", "src/crm/ecommerce/azioni.ts",
  "src/crm/ecommerce/client.ts", "src/crm/ecommerce/conti.ts", "src/crm/ecommerce/ordine.ts", "src/crm/ecommerce/ordini-ui.ts", "src/crm/ecommerce/ordini.server.ts",
  "src/crm/negozio/cancello.ts", "src/crm/negozio/interruttori.server.ts", "src/crm/negozio/smista.server.ts", "src/routes/CRM.ecommerce.tsx",
  "src/routes/api.crm.negozio.ts", "src/routes/api.crm.ordini.ts", "src/routes/shop.carrello.tsx", "src/routes/shop.checkout.tsx", "src/routes/shop.tsx",
  "src/shop/cms/catalogo.functions.ts",
];
const MIGRAZIONI = [
  "20261122120000_shop_pagamenti.sql", "20261122123000_shop_orders_protezione.sql", "20261122130000_shop_spedizioni.sql", "20261122140000_shop_email.sql",
];
const BASE_R1 = "46cf8d5"; // l'ultimo commit di R1: da qui si contano le librerie nuove

const codice = (f) => /\.(ts|tsx)$/.test(f);
const camminaCartella = (radice, rel) => {
  const dir = join(radice, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = `${rel}/${n}`;
    return statSync(join(radice, p)).isDirectory() ? camminaCartella(radice, p) : [p];
  });
};
const albero = (testo, nome) => ts.createSourceFile(nome, testo, ts.ScriptTarget.ES2022, true, nome.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const cammina = (nodo, f) => { f(nodo); ts.forEachChild(nodo, (n) => cammina(n, f)); };
const nodi = (sf, tipo) => { const r = []; cammina(sf, (n) => { if (tipo(n)) r.push(n); }); return r; };
const riga = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
const eStringa = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
// Il testo di un SQL senza commenti (a riga e a blocco): i commenti spiegano, non eseguono.
const sqlSenzaCommenti = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T68 · LE REGOLE DEL RILASCIO (22/11/2026)");
  const leggi = (rel) => readFileSync(join(radice, rel), "utf8");
  const nuovi = [...new Set([...CARTELLE_R2.flatMap((d) => camminaCartella(radice, d)).filter(codice), ...NUOVI_FUORI])].sort();
  const tutti = [...nuovi, ...MODIFICATI];
  const alberi = {};
  for (const f of tutti) if (existsSync(join(radice, f))) alberi[f] = albero(leggi(f), f);
  const eServer = (f) => /\.server\.ts$|\.functions\.ts$|\/api\.[a-z.-]+\.ts$|\/collaudo\.ts$|\/cassa-sito\.ts$/.test(f);
  const server = tutti.filter((f) => alberi[f] && eServer(f));
  const rotte = tutti.filter((f) => alberi[f] && /^src\/routes\/api\./.test(f));

  c("i file del R2 elencati esistono tutti (un nome che non c'è renderebbe vuota una regola)", [], [...NUOVI_FUORI, ...MODIFICATI, ...MIGRAZIONI.map((m) => `supabase/migrations/${m}`)].filter((f) => !existsSync(join(radice, f))));
  c("i controlli girano su abbastanza file (cartelle del R2 comprese)", true, nuovi.length >= 55 && server.length >= 25 && rotte.length >= 8);

  // ── 1 · nessuna chiave ──
  {
    const CHIAVI = /\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{8,}|\bre_[A-Za-z0-9]{20,}/;
    const doc = ["DEPLOY.md", ".env.example", "wrangler.jsonc", "package.json"].filter((f) => existsSync(join(radice, f)));
    const fonti = [...camminaCartella(radice, "src"), ...camminaCartella(radice, "supabase")].filter((f) => /\.(ts|tsx|sql|md|json|jsonc|toml)$/.test(f));
    const trovate = [...fonti, ...doc].filter((f) => CHIAVI.test(leggi(f)));
    c("nessuna chiave (Stripe, segreto del webhook, Resend) in src, supabase, documenti e configurazione", [], trovate);
    const jwt = /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/;
    c("nessun gettone (JWT) nei file del R2", [], tutti.filter((f) => alberi[f] && jwt.test(leggi(f))));
  }

  // ── 2 · nei log solo codici ──
  {
    const eLog = (n) => {
      if (!ts.isCallExpression(n)) return false;
      const t = n.expression.getText().replace(/\?\./g, ".");
      return /^console\./.test(t) || /(^|\.)log$/.test(t);
    };
    const PROIBITI = /\.(message|details|hint|stack|body|testo|cause)\b/;
    const male = [];
    const oggetti = [];
    let viste = 0;
    for (const f of tutti.filter((x) => alberi[x])) { // tutti i file del R2, non solo i server: un log nel browser vale lo stesso
      const sf = alberi[f];
      for (const n of nodi(sf, eLog)) {
        viste++;
        const testo = n.expression.getText();
        if (n.arguments.some((a) => PROIBITI.test(a.getText()))) male.push(`${f}:${riga(sf, n)}`);
        if (/^console\./.test(testo) && !n.arguments.every((a) => eStringa(a) || ts.isTemplateExpression(a) || (ts.isIdentifier(a) && a.text === "codice"))) oggetti.push(`${f}:${riga(sf, n)}`);
      }
    }
    c("le chiamate al log del R2 sono molte (la regola guarda qualcosa)", true, viste >= 60);
    c("nessun log riceve `message`, `details`, `hint` o `stack` di un errore", [], male);
    c("nessun `console.*` riceve un oggetto: solo testi e il codice", [], oggetti);

    // comportamento: un database che risponde errori pieni di segreti; il log registrato non deve contenerli
    const SEGRETO = "SEGRETO-dei-clienti-anna@esempio.it";
    const errore = { code: "57P01", message: SEGRETO, details: SEGRETO, hint: SEGRETO };
    const catena = (esito) => new Proxy({}, { get: (_, k) => (k === "then" ? (ok) => Promise.resolve(esito).then(ok) : () => catena(esito)) });
    const dbRotto = { from: () => catena({ data: null, error: errore }), rpc: () => catena({ data: null, error: errore }) };
    const righe = [];
    const log = (x) => righe.push(String(x));
    const T = mod["shop/cassa/tariffe.server"];
    const K = mod["shop/cms/cassa-sito"];
    const ci = !!T?.tariffaSpedizione && !!K?.leggiCassa;
    c("i moduli per la prova del log ci sono", true, ci);
    if (ci) {
      const a = await T.tariffaSpedizione({ db: dbRotto, adesso: () => 1_000, cassa: () => "stripe", log });
      const b = await K.leggiCassa({ db: dbRotto, adesso: () => 1_000, log });
      c("con un database in errore: la tariffa è «assente», la cassa è «vecchia» (mai un'eccezione)", ["assente", "vecchia"], [a.stato, b]);
      c("…e il log ha registrato qualcosa (la prova non passa per caso), solo con il codice e senza il testo segreto", [true, false, true], [
        righe.length >= 2, righe.some((r) => r.includes(SEGRETO) || /anna@/.test(r)), righe.every((r) => r.includes("57P01")),
      ]);
    }
  }

  // ── 3 · le scritture passano dalle funzioni SQL ──
  {
    const radiceTabella = (call) => {
      // risale la catena `db.from("shop_x").update(...)` fino al `from`
      for (let e = call.expression; e; ) {
        if (ts.isCallExpression(e)) { if (/\.from$/.test(e.expression.getText()) && e.arguments[0] && eStringa(e.arguments[0])) return e.arguments[0].text; e = e.expression; }
        else if (ts.isPropertyAccessExpression(e) || ts.isNonNullExpression(e) || ts.isParenthesizedExpression(e) || ts.isAwaitExpression(e)) e = e.expression;
        else return null;
      }
      return null;
    };
    const SCRITTURE = new Set(["insert", "update", "upsert", "delete"]);
    // chi può scrivere direttamente: (tabella → operazione → file). Tutto il resto passa da una funzione SQL.
    const AMMESSE = {
      shop_orders: { update: ["src/shop/cassa/webhook.server.ts", "src/crm/ecommerce/ordini.server.ts"], insert: ["src/routes/shop.checkout.tsx"] },
      shop_order_eventi: { insert: ["src/crm/ecommerce/ordini.server.ts"] },
    };
    const PAGATO = ["pagato_il", "pagato_importo", "metodo_pagamento", "stato_pagamento", "stripe_sessione_id", "stripe_pagamento_id", "rimborsato_cent", "totale_cent",
      "giacenza_scalata_il", "giacenza_rimessa_il", "giacenza_da_verificare", "email_inviate", "avvisi", "prova", "annullato_il", "scade_il", "riprova_n"];
    const fuori = [];
    const sulPagato = [];
    let scritture = 0;
    for (const f of tutti.filter((x) => alberi[x] && codice(x))) {
      const sf = alberi[f];
      for (const n of nodi(sf, (x) => ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && SCRITTURE.has(x.expression.name.text))) {
        const t = radiceTabella(n);
        if (!t || !t.startsWith("shop_")) continue;
        scritture++;
        const op = n.expression.name.text;
        if (!(AMMESSE[t]?.[op] ?? []).includes(f)) fuori.push(`${f}:${riga(sf, n)} ${op} ${t}`);
        const a = n.arguments[0];
        if (t === "shop_orders" && op === "update" && a && ts.isObjectLiteralExpression(a) && a.properties.some((p) => p.name && PAGATO.includes(p.name.getText()))) sulPagato.push(`${f}:${riga(sf, n)}`);
      }
    }
    c("la regola ha trovato le scritture dirette del R2 (almeno quelle note)", true, scritture >= 3);
    c("nessuna scrittura diretta su una tabella `shop_*` fuori dall'elenco (rimborsi, sessioni, eventi, limiti, email, riservati: solo funzioni SQL)", [], fuori);
    c("l'unico `update` diretto con campi letti (il webhook) non tocca stato, importi, giacenza né avvisi: solo il dettaglio del metodo", [], sulPagato);

    // le funzioni critiche si chiamano solo dai file che il piano nomina
    const FUNZIONI = {
      shop_ordine_pagato: ["src/shop/cassa/webhook.server.ts", "src/shop/cassa/cassa.server.ts", "src/crm/ecommerce/rimborsi.server.ts"], // D44, D66 (riprova), D55 (Controlla con Stripe)
      shop_rimborso_riconcilia: ["src/shop/cassa/webhook.server.ts", "src/crm/ecommerce/rimborsi.server.ts"], // D46
      shop_rimborso_prenota: ["src/crm/ecommerce/rimborsi.server.ts"],
      shop_email_prenota: ["src/shop/email/invio.server.ts"], // D53: una sola volta per ordine e messaggio
      shop_email_esito: ["src/shop/email/invio.server.ts"],
      shop_ordine_crea: ["src/shop/cassa/cassa.server.ts"],
      shop_ordine_riapri: ["src/shop/cassa/cassa.server.ts"], // D66
    };
    const dove = {};
    for (const f of tutti) {
      if (!alberi[f]) continue;
      for (const n of nodi(alberi[f], (x) => eStringa(x) && x.text in FUNZIONI)) (dove[n.text] ??= new Set()).add(f);
    }
    c("ogni funzione critica è chiamata (la regola vede dove)", Object.keys(FUNZIONI).sort(), Object.keys(dove).sort());
    c("le funzioni critiche si nominano solo nei file ammessi", [], Object.entries(dove).flatMap(([nome, file]) => [...file].filter((f) => !FUNZIONI[nome].includes(f)).map((f) => `${f} ${nome}`)));
  }

  // ── 4 · niente cancellazioni ──
  {
    const cancella = [];
    for (const f of tutti.filter((x) => alberi[x])) {
      const sf = alberi[f];
      for (const n of nodi(sf, (x) => ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === "delete")) {
        let e = n.expression.expression, daDatabase = false;
        while (e) { if (ts.isCallExpression(e) && /\.from$/.test(e.expression.getText())) { daDatabase = true; break; } e = e.expression; }
        if (daDatabase) cancella.push(`${f}:${riga(sf, n)} .delete()`);
      }
      for (const n of nodi(sf, (x) => eStringa(x) || ts.isTemplateHead(x) || ts.isTemplateMiddle(x) || ts.isTemplateTail(x)))
        if (/\bDELETE\s+FROM\b|\bDROP\s+(TABLE|TRIGGER|FUNCTION|POLICY|COLUMN|SCHEMA|INDEX)\b/i.test(n.text) ||
          /\bTRUNCATE\b/.test(n.text) || /\bTRUNCATE\s+TABLE\b/i.test(n.text)) cancella.push(`${f}:${riga(sf, n)} SQL`);
    }
    c("nessun `.delete()` sul database e nessun DELETE/DROP/TRUNCATE scritto nel codice del R2", [], cancella);
    const sql = MIGRAZIONI.filter((m) => existsSync(join(radice, "supabase/migrations", m)))
      .filter((m) => /\b(DELETE|DROP|TRUNCATE)\b/i.test(sqlSenzaCommenti(leggi(`supabase/migrations/${m}`))));
    c("nelle quattro migrazioni del R2 nessun DELETE, DROP o TRUNCATE (corpi delle funzioni compresi; il ripristino sta solo nei commenti)", [], sql);
  }

  // ── 5 · parole proibite nei file nuovi ──
  {
    const NOME = new RegExp(["scipi", "oni"].join(""), "i");
    const CAP = new RegExp(`\\b${["00", "192"].join("")}\\b`);
    const sorgenti = nuovi.filter((f) => alberi[f]);
    const sql = MIGRAZIONI.map((m) => `supabase/migrations/${m}`);
    const colpe = [...sorgenti, ...sql].filter((f) => existsSync(join(radice, f))).filter((f) => NOME.test(leggi(f)) || CAP.test(leggi(f)));
    c("nessun nome né CAP dello studio nei file nuovi di src e nelle migrazioni del R2", [], colpe);
    // Invisible Derm: un prezzo vicino al nome (stessa riga o le due dopo)
    const PREZZO = /€\s*\d|\d\s*€|\b\d+[.,]\d{2}\b|\b\d+\s*(euro|eur)\b|prezzo_cent\s*[:=]\s*[1-9]/i;
    const cifre = [];
    for (const f of [...sorgenti, ...sql].filter((x) => existsSync(join(radice, x)))) {
      const righe = leggi(f).split("\n");
      righe.forEach((r, i) => { if (/invisible[\s_-]*derm/i.test(r) && PREZZO.test(righe.slice(i, i + 3).join(" "))) cifre.push(`${f}:${i + 1}`); });
    }
    c("nessuna cifra di Invisible Derm vicino al suo nome, in nessun file nuovo né nei modelli di base", [], cifre);
    const BASE = mod["shop/email/modelli-base"];
    const testi = JSON.stringify(BASE ?? {});
    c("i modelli di base delle email non nominano Invisible Derm e non portano cifre in euro", [true, false, false], [testi.length > 200, /invisible/i.test(testi), /€\s*\d|\d\s*€/.test(testi)]);
  }

  // ── 6 · librerie ──
  {
    const pacchetto = JSON.parse(leggi("package.json"));
    const nomi = (p) => Object.keys({ ...p.dependencies, ...p.devDependencies, ...p.peerDependencies, ...p.optionalDependencies });
    c("nessun pacchetto `stripe` né `@stripe/*` in package.json (la cassa parla con Stripe da sé, senza libreria)", [], nomi(pacchetto).filter((n) => n === "stripe" || n.startsWith("@stripe/")));
    let prima = null;
    try { prima = JSON.parse(execFileSync("git", ["show", `${BASE_R1}:package.json`], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch { /* resta null */ }
    c(`package.json si legge dal commit di R1 (${BASE_R1}): senza, la regola «nessuna libreria nuova» non può girare`, true, prima !== null);
    if (prima) c("nessuna libreria nuova rispetto a R1", [], nomi(pacchetto).filter((n) => !nomi(prima).includes(n)));
  }

  // ── 7 · nessuna intestazione CORS ──
  c("nessuna `Access-Control-*` nei file del R2 (le rotte pubbliche le chiama solo il sito stesso)", [], tutti.filter((f) => alberi[f] && /access-control-/i.test(leggi(f))));

  // ── 8 · try/catch di primo livello ──
  {
    const funzioni = {};
    for (const f of server) for (const n of nodi(alberi[f], (x) => ts.isFunctionDeclaration(x) && x.name && x.body)) funzioni[n.name.text] = n;
    const haTry = (fn) => !!fn?.body && ts.isBlock(fn.body) && fn.body.statements.some((s) => ts.isTryStatement(s));
    const senza = [];
    let gestori = 0;
    for (const f of rotte) {
      const sf = alberi[f];
      for (const p of nodi(sf, (x) => ts.isPropertyAssignment(x) && x.name.getText() === "handlers" && ts.isObjectLiteralExpression(x.initializer)))
        for (const g of p.initializer.properties) {
          if (!ts.isPropertyAssignment(g) || !ts.isArrowFunction(g.initializer)) { senza.push(`${f} ${g.name?.getText()}`); continue; }
          gestori++;
          const fn = g.initializer;
          if (ts.isBlock(fn.body)) { if (!haTry(fn)) senza.push(`${f}:${riga(sf, g)} ${g.name.getText()}`); continue; }
          // gestore a una riga: il corpo è la chiamata a una funzione che deve avere il `try` a primo livello
          const chiamata = ts.isCallExpression(fn.body) ? fn.body.expression.getText() : "";
          if (!haTry(funzioni[chiamata])) senza.push(`${f}:${riga(sf, g)} ${g.name.getText()} → ${chiamata || "?"}`);
        }
    }
    c("la regola ha visto i gestori delle rotte del R2 (otto rotte, 12 gestori)", 12, gestori);
    c("ogni gestore ha un `try/catch` di primo livello (o chiama una funzione che lo ha)", [], senza);
  }

  // ── 9 · SITO, mai Host né Origin ──
  {
    const cattive = [];
    for (const f of server) {
      const sf = alberi[f];
      for (const n of nodi(sf, (x) => eStringa(x) && /^(host|origin|x-forwarded-host|x-forwarded-proto)$/i.test(x.text))) cattive.push(`${f}:${riga(sf, n)} «${n.text}»`);
      for (const n of nodi(sf, (x) => ts.isPropertyAccessExpression(x) && /^(origin|host|hostname)$/.test(x.name.text) && !/^(process|self)$/.test(x.expression.getText()))) cattive.push(`${f}:${riga(sf, n)} .${n.name.text}`);
    }
    c("nel codice del server del R2 nessuna lettura di Host, Origin o X-Forwarded-Host", [], cattive);
    c("la cassa e le email prendono l'indirizzo di ritorno da `SITO` (costante), non dalla richiesta", [true, true, true], [
      /import \{ SITO \} from "@\/lib\/sito"/.test(leggi("src/shop/cassa/collega.server.ts")),
      /sito: SITO/.test(leggi("src/shop/cassa/collega.server.ts")),
      /\$\{p\.sito\}\/shop\/ordine\//.test(leggi("src/shop/cassa/cassa.server.ts")),
    ]);
  }

  // ── 10 · 490 in un solo file ──
  {
    const con490 = nuovi.filter((f) => alberi[f] && nodi(alberi[f], (x) => ts.isNumericLiteral(x) && x.text === "490").length > 0);
    c("la cifra 490 (centesimi, il ripiego della spedizione) è scritta come numero in un solo file nuovo del R2", ["src/shop/cassa/tariffe.server.ts"], con490);
  }

  // ── 11 · i documenti del titolare ──
  {
    const env = leggi(".env.example");
    const nomi = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SHOP_EMAIL_INDIRIZZO"];
    c(".env.example elenca le tre variabili del R2 e le lascia vuote", [true, true, true], nomi.map((n) => new RegExp(`^${n}=(""|)\\s*$`, "m").test(env)));
    const deploy = leggi("DEPLOY.md");
    const posizioni = ["20261117120000_ecommerce_ordini", "20261120120000_shop_catalogo.", ...MIGRAZIONI.map((m) => m.replace(/\.sql$/, ""))].map((m) => deploy.indexOf(m));
    c("DEPLOY.md nomina le migrazioni (M1, R1, S4, S4b, S5, S6) nell'ordine in cui si applicano", true, posizioni.every((p) => p >= 0) && posizioni.every((p, i) => i === 0 || p > posizioni[i - 1]));
    c("DEPLOY.md dice di NON usare `supabase db push` e di usare il SQL Editor", [true, true], [/non (si )?usa(re)?[^.\n]*supabase db push|supabase db push[^.\n]*(non|mai)/i.test(deploy), /SQL Editor/.test(deploy)]);
    c("DEPLOY.md nomina il webhook e le tre variabili", [true, true, true, true], [/stripe-webhook/.test(deploy), ...nomi.map((n) => deploy.includes(n))]);
    c("i file delle migrazioni nominate in DEPLOY.md esistono", [], posizioni.length ? MIGRAZIONI.concat(["20261117120000_ecommerce_ordini.sql", "20261120120000_shop_catalogo.sql"]).filter((m) => !existsSync(join(radice, "supabase/migrations", m))) : ["?"]);
  }
}
