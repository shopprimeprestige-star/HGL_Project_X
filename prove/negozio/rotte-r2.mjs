/** ── NEGOZIO · RILASCIO 2 · T57 · LE ROTTE (PIANO-R2 §3.1, §3.2, §3.4, §3.5, D45, D53, D59) ──────────────────────
 *  Le rotte sono sottili: collegano database, Stripe, email e orologio ai moduli già provati (T51-T56). Qui si provano
 *  · sul SORGENTE delle sette rotte (albero sintattico di TypeScript, non ricerche di testo): guardia, permessi, webhook, CORS,
 *    ambiente, log, `try/catch`;
 *  · sul modulo `src/shop/cassa/collega.server.ts`, dove sta il collegamento (legge l'ambiente solo dentro le funzioni): Stripe,
 *    stato e «Prova adesso», cassa aperta, porte dell'email, `dopoRisposta`.
 *  ⚠️ Chiavi e dati INVENTATI; nessuna rete (il `fetch` è il finto di Stripe). */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { fintoDb } from "./_finto-db.mjs";
import { stripeFinto, CHIAVE_PROVA, SEGRETO_PROVA } from "./_stripe-finto.mjs";

const CHIAVE_REALE = ["sk", "live", "finta0000000000000000"].join("_");
const SERVIZIO = "chiave-di-servizio-di-prova-non-vera";

const NUOVE = {
  "api.public.shop-cassa.ts": { percorso: "/api/public/shop-cassa", metodi: ["POST"] },
  "api.public.shop-cassa-permesso.ts": { percorso: "/api/public/shop-cassa-permesso", metodi: ["GET"] },
  "api.public.stripe-webhook.ts": { percorso: "/api/public/stripe-webhook", metodi: ["POST"] },
  "api.crm.stripe.ts": { percorso: "/api/crm/stripe", metodi: ["GET", "POST"], permesso: "pagamenti" },
  "api.crm.negozio-email.ts": { percorso: "/api/crm/negozio-email", metodi: ["GET", "POST"], permesso: "impostazioni" },
};
const MODIFICATE = {
  "api.crm.ordini.ts": { percorso: "/api/crm/ordini", metodi: ["GET", "POST"], permesso: "pagamenti" },
  "api.crm.negozio.ts": { percorso: "/api/crm/negozio", metodi: ["GET", "POST"], permesso: "pagamenti" },
};
const TUTTE = { ...NUOVE, ...MODIFICATE };
const PUBBLICHE = ["api.public.shop-cassa.ts", "api.public.shop-cassa-permesso.ts", "api.public.stripe-webhook.ts"];

/** L'albero di un file e un modo di camminarlo. */
const albero = (testo, nome) => ts.createSourceFile(nome, testo, ts.ScriptTarget.ES2022, true, nome.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const cammina = (nodo, f) => { f(nodo); ts.forEachChild(nodo, (n) => cammina(n, f)); };
const nodi = (sf, tipo) => { const r = []; cammina(sf, (n) => { if (tipo(n)) r.push(n); }); return r; };
const eFunzione = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n);
/** Le occorrenze di `process.env` che NON stanno dentro una funzione (cioè lette quando il modulo si carica). */
const envFuoriDaFunzioni = (sf) =>
  nodi(sf, (n) => ts.isPropertyAccessExpression(n) && n.expression.getText() === "process" && n.name.text === "env").filter((n) => {
    for (let p = n.parent; p; p = p.parent) if (eFunzione(p)) return false;
    return true;
  }).length;
/** I gestori GET/POST: le proprietà di `handlers`. */
const gestori = (sf) => {
  const r = [];
  cammina(sf, (n) => {
    if (ts.isPropertyAssignment(n) && n.name.getText() === "handlers" && ts.isObjectLiteralExpression(n.initializer))
      for (const p of n.initializer.properties) if (ts.isPropertyAssignment(p)) r.push({ metodo: p.name.getText(), corpo: p.initializer });
  });
  return r;
};
/** Il primo `await` di una funzione (in ordine di testo), com'è scritto. */
const primoAwait = (f) => {
  let primo = null;
  cammina(f.body ?? f, (n) => { if (!primo && ts.isAwaitExpression(n)) primo = n.expression.getText(); });
  return primo;
};
const chiamate = (sf, nome) => nodi(sf, (n) => ts.isCallExpression(n) && n.expression.getText() === nome);

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T57 · LE ROTTE (22/11/2026)");
  const dir = join(radice, "src/routes");
  const H = mod["shop/cassa/collega.server"];

  // ── i file ci sono, e sono le rotte giuste ──
  const fonti = {};
  for (const [file, m] of Object.entries(TUTTE)) {
    const esiste = existsSync(join(dir, file));
    c(`${file}: esiste`, true, esiste);
    if (!esiste) continue;
    fonti[file] = readFileSync(join(dir, file), "utf8");
    const sf = albero(fonti[file], file);
    c(`${file}: è la rotta ${m.percorso}`, true, chiamate(sf, "createFileRoute").some((x) => x.arguments[0]?.getText() === JSON.stringify(m.percorso)));
    c(`${file}: i soli gestori sono ${m.metodi.join(" e ")}`, m.metodi, gestori(sf).map((g) => g.metodo).sort());
  }
  c("il modulo src/shop/cassa/collega.server.ts esiste (il collegamento comune, importabile senza ambiente)", true, !!H);

  // ── guardia e permessi ──
  for (const [file, m] of Object.entries(TUTTE)) {
    if (!m.permesso || !fonti[file]) continue;
    const sf = albero(fonti[file], file);
    const guardie = chiamate(sf, "guardiaCRM");
    c(`${file}: una sola guardia, e col permesso «${m.permesso}» (mai l'altro)`, [1, true, false], [
      guardie.length,
      guardie.every((g) => g.arguments[2]?.getText() === JSON.stringify(m.permesso)),
      /"(pagamenti|impostazioni)"/g.test(fonti[file].replace(new RegExp(`"${m.permesso}"`, "g"), "")),
    ]);
  }
  {
    // la rotta che ha la sua logica (stato di Stripe): la guardia è il PRIMO `await` di ogni gestore
    const f = "api.crm.stripe.ts";
    if (fonti[f]) {
      const sf = albero(fonti[f], f);
      c(`${f}: la guardia è il primo await di ogni gestore (prima di leggere il corpo, l'ambiente o Stripe)`, true,
        gestori(sf).length === 2 && gestori(sf).every((g) => { const fn = ts.isArrowFunction(g.corpo) ? g.corpo : null; return !!fn && /^guardiaCRM\(|^guardia\(/.test(primoAwait(fn) ?? ""); }));
    }
    // le rotte sottili: ogni gestore passa DIRETTAMENTE a `gestisciGET`/`gestisciPOST` del modulo, che apre con la guardia
    for (const file of ["api.crm.ordini.ts", "api.crm.negozio.ts"]) {
      if (!fonti[file]) continue;
      const sf = albero(fonti[file], file);
      c(`${file}: ogni gestore è una sola chiamata a gestisciGET/gestisciPOST (la guardia è la prima cosa che il modulo fa), senza leggere il corpo`, true,
        gestori(sf).every((g) => ts.isArrowFunction(g.corpo) && !ts.isBlock(g.corpo.body) && new RegExp(`^gestisci${g.metodo}\\(request, `).test(g.corpo.body.getText())) &&
        !/request\.(json|text|arrayBuffer|formData)\(/.test(fonti[file]));
    }
  }

  // ── il webhook ──
  {
    const f = "api.public.stripe-webhook.ts";
    const modulo = readFileSync(join(radice, "src/shop/cassa/webhook.server.ts"), "utf8");
    if (fonti[f]) {
      c(`${f}: la rotta NON legge il corpo (lo fa gestisciWebhook, in byte, fermandosi al tetto): né json, né text, né arrayBuffer, né formData, né body`, false, /\.(json|text|arrayBuffer|formData|body)\b/.test(fonti[f].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
      c(`${f}: chiama gestisciWebhook con la richiesta intera`, true, chiamate(albero(fonti[f], f), "gestisciWebhook").some((x) => x.arguments[0]?.getText() === "request"));
      c(`${f}: solo POST`, ["POST"], gestori(albero(fonti[f], f)).map((g) => g.metodo));
    }
    c("webhook.server.ts legge il corpo in byte (flusso, con il tetto) e mai come testo o json", [true, false], [/getReader\(\)/.test(modulo), /richiesta\.(json|text|formData)\(/.test(modulo)]);
    c("webhook.server.ts: ogni risposta è `no-store`", true, /Cache-Control["']?: ["']no-store/.test(modulo));
  }

  // ── nessuna chiave in chiaro, nessun CORS, ambiente dentro le funzioni, log solo codici, try/catch ──
  const tutti = { ...fonti };
  const collega = join(radice, "src/shop/cassa/collega.server.ts");
  if (existsSync(collega)) tutti["collega.server.ts"] = readFileSync(collega, "utf8");
  for (const [file, testo] of Object.entries(tutti)) {
    const sf = albero(testo, file);
    const senza = testo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    c(`${file}: nessuna chiave scritta (Stripe, segreto del webhook, Resend, JWT)`, false, /sk_(live|test)_|rk_(live|test)_|whsec_[A-Za-z0-9]|\bre_[A-Za-z0-9]{12,}|eyJ[A-Za-z0-9_-]{20,}/.test(senza));
    c(`${file}: le variabili d'ambiente si leggono dentro funzioni, non quando il modulo si carica`, 0, envFuoriDaFunzioni(sf));
    c(`${file}: nessuna intestazione CORS`, false, /Access-Control|cors/i.test(senza));
    // `console.*`: solo testi (anche con `${codice}`), mai un oggetto, un errore intero o un suo messaggio
    const brutti = nodi(sf, (n) => ts.isCallExpression(n) && /^console\./.test(n.expression.getText())).filter((n) =>
      !n.arguments.every((a) => ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a) || (ts.isTemplateExpression(a) && a.templateSpans.every((s) => ts.isIdentifier(s.expression) && s.expression.text === "codice")) || (ts.isIdentifier(a) && a.text === "codice")));
    c(`${file}: nessun console.* che riceva un oggetto o un errore (solo testi e il \`codice\`)`, 0, brutti.length);
    c(`${file}: nessun console.log (si usa warn, con il prefisso della rotta)`, false, /console\.log\(/.test(senza));
  }
  for (const file of Object.keys(fonti)) {
    const sf = albero(fonti[file], file);
    // ogni gestore o delega direttamente a un gestisci* (che ha il suo try/catch, provato altrove) o ha un `try` di primo livello con un `catch`
    const senzaTry = gestori(sf).filter((g) => {
      if (!ts.isArrowFunction(g.corpo)) return true;
      if (!ts.isBlock(g.corpo.body)) return !new RegExp(`^gestisci${g.metodo}\\(request, `).test(g.corpo.body.getText());
      const s = g.corpo.body.statements;
      return !(s.length > 0 && s.every((x) => ts.isTryStatement(x) && !!x.catchClause));
    });
    c(`${file}: ogni gestore ha un try/catch di primo livello (o passa dritto a un gestisci* che lo ha)`, 0, senzaTry.length);
  }
  for (const file of PUBBLICHE) {
    if (!fonti[file]) continue;
    c(`${file}: le risposte che scrive la rotta sono no-store`, true, /no-store/.test(fonti[file]) || file === "api.public.stripe-webhook.ts");
    c(`${file}: l'indirizzo del sito è la costante SITO (mai Host o Origin) e l'IP viene da cf-connecting-ip`, [false, false], [/headers\.get\(["']([Hh]ost|[Oo]rigin)["']\)/.test(fonti[file]), /headers\.get\(["'](host|origin)["']\)/i.test(fonti[file])]);
  }
  if (fonti["api.public.shop-cassa.ts"]) c("shop-cassa: chiama gestisciCassa con la richiesta intera (il tetto e il corpo sono suoi)", true, chiamate(albero(fonti["api.public.shop-cassa.ts"], "x.ts"), "gestisciCassa").some((x) => x.arguments[0]?.getText() === "request"));
  if (fonti["api.public.shop-cassa-permesso.ts"]) c("shop-cassa-permesso: chiama gestisciPermesso", 1, chiamate(albero(fonti["api.public.shop-cassa-permesso.ts"], "x.ts"), "gestisciPermesso").length);
  if (fonti["api.crm.negozio-email.ts"]) {
    // T57, nota del revisore (b): come le altre rotte nuove, ogni gestore è un blocco con un `try/catch` di primo livello (risposta generica, nel log solo il codice)
    const f = "api.crm.negozio-email.ts";
    const sf = albero(fonti[f], f);
    const gs = gestori(sf);
    c(`${f}: ogni gestore è un blocco con un solo \`try\` di primo livello e un \`catch\`, e passa a gestisciGET/gestisciPOST`, [2, true], [
      gs.length,
      gs.every((g) => ts.isArrowFunction(g.corpo) && ts.isBlock(g.corpo.body) && g.corpo.body.statements.length === 1 && ts.isTryStatement(g.corpo.body.statements[0]) && !!g.corpo.body.statements[0].catchClause && new RegExp(`gestisci${g.metodo}\\(request, `).test(g.corpo.body.getText())),
    ]);
    c(`${f}: il \`catch\` risponde in modo generico (500 \`interno\`) e scrive nel log solo un testo fisso`, true,
      gs.every((g) => { const t = g.corpo.getText(); return /catch\s*\{/.test(t) && /status|, 500\)/.test(t) && /console\.warn\("\[negozio-email\] eccezione"\)/.test(t) && !/catch\s*\(/.test(t); }));
  }
  if (fonti["api.crm.ordini.ts"]) {
    // T57, nota del revisore (a): le porte `stripe` ed `email` si costruiscono DOPO la guardia, dentro il `try/catch` del modulo: nella funzione `guardia`, non quando si prepara l'oggetto delle dipendenze
    const f = "api.crm.ordini.ts";
    const sf = albero(fonti[f], f);
    const dentroGuardia = (nome) => {
      const ch = chiamate(sf, nome);
      return ch.length > 0 && ch.every((n) => { for (let p = n.parent; p; p = p.parent) if (ts.isPropertyAssignment(p) && p.name.getText() === "guardia") return true; return false; });
    };
    c(`${f}: clienteStripe(), porteInvio() e creaPorteEmail() sono chiamate solo dentro la funzione \`guardia\` (dopo che il permesso è dato)`, [true, true, true], [dentroGuardia("clienteStripe"), dentroGuardia("porteInvio"), dentroGuardia("creaPorteEmail")]);
  }
  if (fonti["api.crm.stripe.ts"]) {
    // il contratto fissato dal capo progetto (T62 lo usa già): GET senza Stripe, POST `prova_adesso`
    const sf = albero(fonti["api.crm.stripe.ts"], "api.crm.stripe.ts");
    const get = gestori(sf).find((g) => g.metodo === "GET")?.corpo.getText() ?? "";
    const post = gestori(sf).find((g) => g.metodo === "POST")?.corpo.getText() ?? "";
    c("api.crm.stripe.ts: il GET non chiama Stripe (nessun provaStripe, nessun fetch); il POST accetta solo l'azione `prova_adesso` e chiama provaStripe", [false, false, true, true], [/provaStripe|fetch\(/.test(get), /"prova"/.test(post), /"prova_adesso"/.test(post), /provaStripe\(/.test(post)]);
  }
  if (fonti["api.crm.negozio.ts"]) {
    const rn = fonti["api.crm.negozio.ts"].replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    c("api.crm.negozio.ts: i fatti vengono dal database (`fattiDelDatabase`) e dall'ambiente, e il banner resta `bannerPresente: true`", [true, true], [/fattiDelDatabase\(/.test(rn), /bannerPresente\s*:\s*true/.test(rn)]);
  }
  if (fonti["api.crm.ordini.ts"]) {
    const ro = fonti["api.crm.ordini.ts"];
    c("api.crm.ordini.ts: le porte `stripe` e `email` ci sono (rimborsi, «Controlla con Stripe», email)", [true, true], [/\bstripe\s*:/.test(ro), /\bemail\s*:/.test(ro)]);
  }
  if (!H) return;

  // ═══ IL MODULO DI COLLEGAMENTO ═══
  const amb = (extra = {}) => ({ STRIPE_SECRET_KEY: CHIAVE_PROVA, STRIPE_WEBHOOK_SECRET: SEGRETO_PROVA, SUPABASE_SERVICE_ROLE_KEY: SERVIZIO, ...extra });
  const SENZA = { STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: "", SUPABASE_SERVICE_ROLE_KEY: SERVIZIO };

  c("chiaveStripe / segretoWebhook: il valore se c'è (senza spazi), `undefined` se manca o è vuoto", [CHIAVE_PROVA, SEGRETO_PROVA, undefined, undefined, undefined], [
    H.chiaveStripe(amb({ STRIPE_SECRET_KEY: ` ${CHIAVE_PROVA} ` })), H.segretoWebhook(amb()), H.chiaveStripe(SENZA), H.segretoWebhook(SENZA), H.chiaveStripe({ STRIPE_SECRET_KEY: "   " })]);

  // stato: mai la chiave
  const db = fintoDb({ tabelle: { shop_stripe_eventi: [
    { id: "evt_1", tipo: "checkout.session.completed", ricevuto_il: "2026-11-20T10:00:00.000Z", elaborato_il: "2026-11-20T10:00:01.000Z", esito: "pagato", ordine_id: null },
    { id: "evt_2", tipo: "charge.refunded", ricevuto_il: "2026-11-20T11:30:00.000Z", elaborato_il: "2026-11-20T11:30:01.000Z", esito: "rimborso", ordine_id: null },
  ] } });
  const prova = await H.statoStripe({ ambiente: amb(), db });
  const reale = await H.statoStripe({ ambiente: amb({ STRIPE_SECRET_KEY: CHIAVE_REALE }), db });
  const niente = await H.statoStripe({ ambiente: SENZA, db });
  const storta = await H.statoStripe({ ambiente: amb({ STRIPE_SECRET_KEY: "una-parola-qualunque" }), db });
  c("stato: chiave di prova → collegato, modalità «prova»", [true, "prova"], [prova.collegato, prova.modalita]);
  c("stato: chiave reale → «reale»; nessuna chiave → non collegato, modalità null; una chiave che non è di Stripe → modalità null", [[true, "reale"], [false, null], [true, null]], [[reale.collegato, reale.modalita], [niente.collegato, niente.modalita], [storta.collegato, storta.modalita]]);
  c("stato: l'ultimo webhook ricevuto ({tipo, ricevutoIl}) è il più recente; senza eventi è null", [{ tipo: "charge.refunded", ricevutoIl: "2026-11-20T11:30:00.000Z" }, null], [prova.ultimoWebhook, (await H.statoStripe({ ambiente: amb(), db: fintoDb({ tabelle: { shop_stripe_eventi: [] } }) })).ultimoWebhook]);
  c("stato: tabella dei pagamenti assente (S4 non applicata) → ultimoWebhook null, nessuna eccezione", null, (await H.statoStripe({ ambiente: amb(), db: fintoDb({ mancante: true }) })).ultimoWebhook);
  c("stato: nessuna risposta contiene la chiave, il suo prefisso lungo, né il segreto del webhook", false,
    [prova, reale, niente, storta].some((r) => /sk_|rk_|whsec|finta0000|finto0000|una-parola/.test(JSON.stringify(r))));

  // «Prova adesso»: una sola lettura innocua
  const sf = stripeFinto();
  const ok = await H.provaStripe({ ambiente: amb(), chiamata: sf.fetch });
  c("«Prova adesso» con la chiave giusta → 200, ok, una frase; UNA sola chiamata, `GET /v1/checkout/sessions?limit=1`, nessuna scrittura", [200, true, true, 1, ["GET /v1/checkout/sessions"]], [ok.stato, ok.corpo.ok, typeof ok.corpo.frase === "string" && ok.corpo.frase.length > 5, sf.chiamate.length, sf.chiamate.map((x) => `${x.metodo} ${x.percorso}`)]);
  const sr = stripeFinto();
  sr.fallisci("GET /v1/checkout/sessions", { stato: 401, errore: { type: "invalid_request_error" } });
  const rifiutata = await H.provaStripe({ ambiente: amb(), chiamata: sr.fetch });
  const sx = stripeFinto();
  sx.fallisci("GET /v1/checkout/sessions", { rete: true });
  const guasta = await H.provaStripe({ ambiente: amb(), chiamata: sx.fetch });
  const sn = stripeFinto();
  const nonCollegato = await H.provaStripe({ ambiente: SENZA, chiamata: sn.fetch });
  c("«Prova adesso» con la chiave rifiutata (401) → ok:false, collegato:false, una frase; con la rete caduta → ok:false, una frase diversa", [false, false, true, false, true, true], [
    rifiutata.corpo.ok, rifiutata.corpo.collegato, typeof rifiutata.corpo.frase === "string" && rifiutata.corpo.frase.length > 5, guasta.corpo.ok, typeof guasta.corpo.frase === "string", guasta.corpo.frase !== rifiutata.corpo.frase]);
  c("«Prova adesso» senza chiave → 409 con una frase («non collegato»), nessuna chiamata a Stripe", [409, false, true, 0], [nonCollegato.stato, nonCollegato.corpo.ok, typeof nonCollegato.corpo.frase === "string" && nonCollegato.corpo.frase.length > 5, sn.chiamate.length]);
  c("«Prova adesso»: nessuna risposta contiene la chiave", false, [ok, rifiutata, guasta, nonCollegato].some((r) => /sk_|finta0000/.test(JSON.stringify(r))));

  // cassa aperta: chiavi e interruttore
  const cassa = (v) => { const f = async () => { f.n++; return v; }; f.n = 0; return f; };
  const prima = cassa("stripe"), vecchia = cassa("vecchia");
  c("cassa aperta: solo con la cassa `stripe` E la chiave di API E il segreto del webhook", [true, false, false, false, false], [
    (await H.aperturaCassa(prima, amb())).aperta, (await H.aperturaCassa(vecchia, amb())).aperta, (await H.aperturaCassa(cassa("stripe"), SENZA)).aperta,
    (await H.aperturaCassa(cassa("stripe"), amb({ STRIPE_WEBHOOK_SECRET: undefined }))).aperta, (await H.aperturaCassa(cassa("stripe"), amb({ STRIPE_SECRET_KEY: "una-parola" }))).aperta]);
  const senzaLettura = cassa("stripe");
  await H.aperturaCassa(senzaLettura, SENZA);
  c("cassa aperta: senza chiavi non si legge nemmeno il database", 0, senzaLettura.n);
  c("cassa aperta: se la lettura della cassa lancia → chiusa, mai un'eccezione", false, (await H.aperturaCassa(async () => { throw new Error("dati veri"); }, amb())).aperta);

  // Stripe: la chiave si legge al momento della richiesta
  {
    const s = stripeFinto();
    const cl = H.clienteStripe(amb(), s.fetch);
    await cl.sonda();
    const cl2 = H.clienteStripe(SENZA, s.fetch);
    const r2 = await cl2.sonda();
    c("clienteStripe: con la chiave dell'ambiente chiama Stripe; senza, risponde `chiave_mancante` senza chiamare", [1, false, "chiave_mancante"], [s.chiamate.length, r2.ok, r2.errore?.codice]);
  }

  // porte dell'email e della cassa
  const pi = H.porteInvio(db, () => undefined, amb({ RESEND_API_KEY: "chiave-resend-finta", SHOP_EMAIL_INDIRIZZO: "negozio@example.com" }));
  const pn = H.porteInvio(db, () => undefined, amb());
  c("porteInvio: mittente «Hair Genius Labs <indirizzo>» solo con SHOP_EMAIL_INDIRIZZO; il sito è la costante SITO; la chiave di servizio è quella dell'ambiente", [true, null, true, SERVIZIO], [pi.mittente() === "Hair Genius Labs <negozio@example.com>", pn.mittente(), /^https:\/\/[^/]+$/.test(pi.sito), pi.chiaveServizio]);
  c("porteInvio: senza RESEND_API_KEY l'invio dice `non_configurata` senza chiamare la rete", [false, "non_configurata"], await pn.resend({ from: "a", to: ["b@example.com"], subject: "s", text: "t", html: "h", reply_to: "a" }).then((r) => [r.ok, r.codice]));
  const opz = H.porteCassa({ db, richiesta: new Request("https://sito.test/api/public/shop-cassa", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1", "user-agent": "ProvaBrowser/1" } }), cassa: async () => "stripe", tariffa: async () => ({ stato: "assente" }), log: () => undefined, ambiente: amb() });
  c("porteCassa: IP da cf-connecting-ip (non da x-forwarded-for se c'è il primo), user agent, chiave di servizio, `prova` vero con la chiave di prova", ["203.0.113.7", "ProvaBrowser/1", SERVIZIO, true], [opz.ip, opz.userAgent, opz.chiaveServizio, opz.prova]);
  const reale2 = H.porteCassa({ db, richiesta: new Request("https://sito.test/", { method: "POST" }), cassa: async () => "stripe", tariffa: async () => ({ stato: "assente" }), log: () => undefined, ambiente: amb({ STRIPE_SECRET_KEY: CHIAVE_REALE }) });
  c("porteCassa: con la chiave reale `prova` è falso; la cassa si apre solo col sì dell'interruttore", [false, true], [reale2.prova, (await opz.cassaAperta()).aperta]);
  // dopoRisposta: fuori da Cloudflare resta il ripiego, che aspetta con un tetto e non lancia
  const dopo = await H.dopoLaRisposta();
  let finito = false;
  await dopo(new Promise((r) => setTimeout(() => { finito = true; r(1); }, 5)));
  c("dopoLaRisposta: fuori dal Worker è il ripiego (aspetta la promessa, non lancia nemmeno con una promessa che fallisce)", [true, "ok"], [finito, await Promise.resolve(dopo(Promise.reject(new Error("dati veri")))).then(() => "ok", () => "lancia")]);
}
