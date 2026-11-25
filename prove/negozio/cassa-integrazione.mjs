/** ── NEGOZIO · RILASCIO 2 · T68 · IL PANNELLO «CASSA» DEL CRM E LA ROTTA VERA `/api/crm/stripe` ───────────────────
 *  T62 (il pannello: `pagina-r2.ts` e `PannelloCassa.tsx`) scrive il suo contratto a occhio, con una porta finta; T57 (la rotta
 *  `src/routes/api.crm.stripe.ts`) lo scrive per conto suo. Qui si collegano: il file della ROTTA VERA, impacchettato con esbuild,
 *  risponde alle chiamate che il pannello fa davvero (`caricaStripe`, `leggiNastro`, `provaAdesso`), e la schermata si disegna con
 *  quello che la rotta ha detto.
 *    GET                      → { ok, collegato, modalita: "prova"|"reale"|null, ultimoWebhook }
 *    POST { prova_adesso }    → { ok, frase? }, oppure 409 senza chiave
 *  Finti: la guardia del CRM (provata altrove: qui si guarda solo CHE permesso chiede la rotta e che forma di «no» chiede di tenere),
 *  il database (`fintoDb`) e Stripe (`stripeFinto`, al posto del `fetch` globale). Nessuna rete, nessuna chiave vera.
 *  ⚠️ Se il contratto non torna, non si corregge `src/` da qui: si scrive in LAVAGNA. */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";
import { fintoDb } from "./_finto-db.mjs";
import { stripeFinto, CHIAVE_PROVA } from "./_stripe-finto.mjs";

/** Una chiave REALE inventata, a pezzi: nel sorgente non c'è nessuna stringa che somigli a una chiave. */
const CHIAVE_REALE = ["sk", "live", "finta0000000000000000"].join("_");
const ISTANTE = "2026-11-20T11:30:00.000Z";

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T68 · IL PANNELLO «CASSA» E LA ROTTA VERA /api/crm/stripe (22/11/2026)");
  const R2 = mod["ecommerce/pagina-r2"] ?? {};
  const dove = mkdtempSync(join(tmpdir(), "cassa-integrazione-"));
  const salvate = { chiave: process.env.STRIPE_SECRET_KEY, segreto: process.env.STRIPE_WEBHOOK_SECRET, fetch: globalThis.fetch, warn: console.warn };
  try {
    // ── la rotta vera, impacchettata: il router, il database e la guardia sono finti ──
    const finti = {
      name: "finti-della-cassa",
      setup(b) {
        const modulo = (nome, codice) => {
          const f = join(dove, nome);
          writeFileSync(f, codice);
          return f;
        };
        const router = modulo("router.cjs", "exports.createFileRoute = (percorso) => (opzioni) => ({ percorso, opzioni });");
        const db = modulo("db.cjs", "Object.defineProperty(exports, 'supabaseAdmin', { get: () => globalThis.__cassaDb });");
        const guardia = modulo(
          "guardia.cjs",
          `exports.guardiaCRM = async (richiesta, intestazioni, permesso, opzioni = {}) => {
             globalThis.__cassaGuardia.chiamate.push({ permesso, extra: opzioni.extra ?? null });
             const stato = globalThis.__cassaGuardia.stato;
             if (stato === 200) return { ok: true, chi: {} };
             return { ok: false, risposta: new Response(JSON.stringify({ ok: false, ...(opzioni.extra ?? {}) }), { status: stato, headers: { "Content-Type": "application/json" } }) };
           };`,
        );
        b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: router }));
        b.onResolve({ filter: /^@\/integrations\/supabase\/client\.server$/ }, () => ({ path: db }));
        b.onResolve({ filter: /^\.\/api\.crm\.accesso$/ }, () => ({ path: guardia }));
      },
    };
    let rotta = null;
    let errore = null;
    try {
      await build({
        entryPoints: [join(radice, "src/routes/api.crm.stripe.ts")],
        bundle: true,
        platform: "node",
        format: "cjs",
        outfile: join(dove, "rotta.cjs"),
        alias: { "@": join(radice, "src") },
        plugins: [finti],
        logLevel: "silent",
      });
      rotta = createRequire(import.meta.url)(join(dove, "rotta.cjs")).Route?.opzioni?.server?.handlers ?? null;
    } catch (e) {
      errore = String(e?.message ?? e).split("\n")[0];
    }
    c("la rotta vera /api/crm/stripe si impacchetta e ha i due gestori GET e POST", [true, true], [typeof rotta?.GET === "function", typeof rotta?.POST === "function"]);
    if (!rotta) {
      c("l'errore di compilazione della rotta", "nessuno", errore);
      return;
    }

    // ── la porta del pannello: una `fetch` che entra nella rotta vera ──
    globalThis.__cassaGuardia = { stato: 200, chiamate: [] };
    const log = [];
    console.warn = (...a) => log.push(a.map(String).join(" ")); // la rotta scrive solo codici con console.warn
    const ingressi = [];
    const porta = async (url, init = {}) => {
      const metodo = init.method ?? "GET";
      ingressi.push({ metodo, url });
      return rotta[metodo]({ request: new Request(`https://sito.test${url}`, { ...init, method: metodo }) });
    };
    const eventi = [
      { id: "evt_1", tipo: "charge.refunded", ricevuto_il: "2026-11-20T09:00:00.000Z", elaborato_il: ISTANTE, esito: "ok", ordine_id: null },
      { id: "evt_2", tipo: "checkout.session.completed", ricevuto_il: ISTANTE, elaborato_il: ISTANTE, esito: "ok", ordine_id: null },
    ];
    /** Un giro: l'ambiente (la chiave), il database, la guardia e Stripe; poi quello che serve. */
    const scenario = async ({ chiave, db = fintoDb({ tabelle: { shop_stripe_eventi: eventi } }), stato = 200, stripe = stripeFinto(), cosa }) => {
      if (chiave === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = chiave;
      globalThis.__cassaDb = db;
      globalThis.__cassaGuardia = { stato, chiamate: [] };
      globalThis.fetch = stripe.fetch;
      ingressi.length = 0;
      log.length = 0;
      try {
        return { ...(await cosa()), guardia: globalThis.__cassaGuardia.chiamate, stripe, log: [...log], ingressi: [...ingressi] };
      } finally {
        globalThis.fetch = salvate.fetch;
      }
    };
    const grezzo = async (r) => ({ stato: r.status, corpo: await r.json(), intestazioni: r.headers });

    // ── 1. GET: la forma che il pannello legge ──
    const gProva = await scenario({ chiave: CHIAVE_PROVA, cosa: async () => grezzo(await porta("/api/crm/stripe")) });
    c("GET con chiave di prova: 200 e {ok, collegato:true, modalita:\"prova\", ultimoWebhook:{tipo, ricevutoIl}} (il più recente)", [200, true, true, "prova", { tipo: "checkout.session.completed", ricevutoIl: ISTANTE }], [
      gProva.stato, gProva.corpo.ok, gProva.corpo.collegato, gProva.corpo.modalita, gProva.corpo.ultimoWebhook,
    ]);
    c("…i campi sono solo quelli del contratto, la risposta non si conserva (`no-store`) e Stripe non è stato chiamato (la GET non chiama Stripe)", [["collegato", "modalita", "ok", "ultimoWebhook"], "no-store", 0], [
      Object.keys(gProva.corpo).sort(), gProva.intestazioni.get("cache-control"), gProva.stripe.chiamate.length,
    ]);
    const gReale = await scenario({ chiave: CHIAVE_REALE, cosa: async () => grezzo(await porta("/api/crm/stripe")) });
    c("GET con chiave reale: modalita «reale»", [true, "reale"], [gReale.corpo.collegato, gReale.corpo.modalita]);
    const gNo = await scenario({ chiave: undefined, db: fintoDb({ tabelle: { shop_stripe_eventi: [] } }), cosa: async () => grezzo(await porta("/api/crm/stripe")) });
    c("GET senza chiave e senza eventi: collegato false, modalita null, ultimoWebhook null", [200, true, false, null, null], [gNo.stato, gNo.corpo.ok, gNo.corpo.collegato, gNo.corpo.modalita, gNo.corpo.ultimoWebhook]);
    const gStorta = await scenario({ chiave: "una-parola-qualunque", cosa: async () => grezzo(await porta("/api/crm/stripe")) });
    c("GET con una chiave che non è di Stripe: la modalità non si indovina (null)", null, gStorta.corpo.modalita);
    const gSenzaTabella = await scenario({ chiave: CHIAVE_PROVA, db: fintoDb({ mancante: true }), cosa: async () => grezzo(await porta("/api/crm/stripe")) });
    c("GET con S4 non applicata (tabella degli eventi assente): risponde lo stesso, ultimoWebhook null", [200, true, true, null], [gSenzaTabella.stato, gSenzaTabella.corpo.ok, gSenzaTabella.corpo.collegato, gSenzaTabella.corpo.ultimoWebhook]);

    // ── 2. il pannello legge la rotta vera ──
    const sProva = await scenario({ chiave: CHIAVE_PROVA, cosa: async () => ({ r: await R2.caricaStripe(porta), nastro: await R2.leggiNastro(porta) }) });
    c("`caricaStripe` sulla rotta vera: ok, collegato, «prova», ultimo webhook", [true, true, "prova", "checkout.session.completed", ISTANTE], [
      sProva.r?.ok, sProva.r?.stripe?.collegato, sProva.r?.stripe?.modalita, sProva.r?.stripe?.ultimoWebhook?.tipo, sProva.r?.stripe?.ultimoWebhook?.ricevutoIl,
    ]);
    c("`leggiNastro` e `mostraNastro`: il nastro «PROVA» si accende con la chiave di prova", [true, true], [sProva.nastro?.modalita === "prova", R2.mostraNastro(sProva.nastro)]);
    c("le due letture sono GET a /api/crm/stripe, con il permesso «pagamenti» chiesto alla guardia, e nessuna chiamata a Stripe", [["GET /api/crm/stripe", "GET /api/crm/stripe"], ["pagamenti", "pagamenti"], 0], [
      sProva.ingressi.map((i) => `${i.metodo} ${i.url}`), sProva.guardia.map((g) => g.permesso), sProva.stripe.chiamate.length,
    ]);
    const sReale = await scenario({ chiave: CHIAVE_REALE, cosa: async () => ({ r: await R2.caricaStripe(porta) }) });
    c("con la chiave reale il pannello legge «reale» e il nastro NON c'è", ["reale", false], [sReale.r?.stripe?.modalita, R2.mostraNastro(sReale.r?.stripe)]);
    const sNo = await scenario({ chiave: undefined, cosa: async () => ({ r: await R2.caricaStripe(porta) }) });
    c("senza chiave il pannello legge «non collegato», senza modalità e senza nastro", [true, false, null, false], [sNo.r?.ok, sNo.r?.stripe?.collegato, sNo.r?.stripe?.modalita, R2.mostraNastro(sNo.r?.stripe)]);

    // ── 3. i «no» della guardia: la forma che il pannello sa leggere ──
    const n401 = await scenario({ chiave: CHIAVE_PROVA, stato: 401, cosa: async () => ({ r: await R2.caricaStripe(porta), n: await R2.leggiNastro(porta), p: await R2.provaAdesso(porta) }) });
    c("sessione scaduta (401): il pannello dice «sessione», niente nastro, e «Prova adesso» non arriva a Stripe", ["sessione", null, false, "sessione", 0], [n401.r?.tipo, n401.n, n401.r?.ok, n401.p?.tipo, n401.stripe.chiamate.length]);
    const n403 = await scenario({ chiave: CHIAVE_PROVA, stato: 403, cosa: async () => ({ r: await R2.caricaStripe(porta), p: await R2.provaAdesso(porta) }) });
    c("senza permesso (403): il pannello dice «permesso», e Stripe non è stato chiamato", ["permesso", "permesso", 0], [n403.r?.tipo, n403.p?.tipo, n403.stripe.chiamate.length]);
    c("la guardia ha l'`extra` col quale anche il «no» ha la forma del contratto (collegato false, modalita null)", [{ collegato: false, modalita: null }, "pagamenti"], [n403.guardia[0]?.extra, n403.guardia[0]?.permesso]);

    // ── 4. POST «Prova adesso» ──
    const pProva = await scenario({ chiave: CHIAVE_PROVA, cosa: async () => ({ raw: await grezzo(await porta("/api/crm/stripe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ azione: "prova_adesso" }) })), p: await R2.provaAdesso(porta) }) });
    c("POST prova_adesso con chiave di prova: 200 e {ok:true, frase}", [200, true, true], [pProva.raw.stato, pProva.raw.corpo.ok, typeof pProva.raw.corpo.frase === "string" && pProva.raw.corpo.frase.length > 10]);
    c("…la chiamata a Stripe è UNA sola lettura innocua (GET /v1/checkout/sessions?limit=1), mai una scrittura", [2, ["GET"], ["/v1/checkout/sessions"]], [
      pProva.stripe.chiamate.length, [...new Set(pProva.stripe.chiamate.map((x) => x.metodo))], [...new Set(pProva.stripe.chiamate.map((x) => x.percorso))],
    ]);
    c("`provaAdesso` del pannello: ok e la frase è quella che ha scritto la rotta", [true, pProva.raw.corpo.frase], [pProva.p?.ok, pProva.p?.frase]);
    const pReale = await scenario({ chiave: CHIAVE_REALE, stripe: stripeFinto({ chiave: CHIAVE_REALE }), cosa: async () => ({ p: await R2.provaAdesso(porta) }) });
    c("«Prova adesso» con la chiave reale: ok, e la frase dice che è REALE", [true, true], [pReale.p?.ok, /REALE/.test(pReale.p?.frase ?? "")]);
    const pNo = await scenario({ chiave: undefined, cosa: async () => ({ raw: await grezzo(await porta("/api/crm/stripe", { method: "POST", body: JSON.stringify({ azione: "prova_adesso" }) })), p: await R2.provaAdesso(porta) }) });
    c("POST senza chiave: 409 {ok:false, motivo, frase}, e Stripe non è stato chiamato", [409, false, "non_collegato", true, 0], [pNo.raw.stato, pNo.raw.corpo.ok, pNo.raw.corpo.motivo, typeof pNo.raw.corpo.frase === "string" && pNo.raw.corpo.frase.length > 10, pNo.stripe.chiamate.length]);
    c("`provaAdesso` senza chiave: ok false, «rifiutato», con la frase scritta dalla rotta (non una frase generica)", [false, "rifiutato", pNo.raw.corpo.frase], [pNo.p?.ok, pNo.p?.tipo, pNo.p?.messaggio]);
    const pRif = await scenario({ chiave: CHIAVE_PROVA, stripe: stripeFinto({ chiave: CHIAVE_REALE }), cosa: async () => ({ p: await R2.provaAdesso(porta) }) });
    c("chiave rifiutata da Stripe (401): il pannello riceve «rifiutato» con la frase della rotta", [false, "rifiutato", true], [pRif.p?.ok, pRif.p?.tipo, /rifiutato/i.test(pRif.p?.messaggio ?? "")]);
    const guasto = stripeFinto();
    guasto.fallisci("GET /v1/checkout/sessions", { rete: true }, 3);
    const pGuasto = await scenario({ chiave: CHIAVE_PROVA, stripe: guasto, cosa: async () => ({ p: await R2.provaAdesso(porta) }) });
    c("Stripe che non risponde (502): il pannello dice «server» con la frase «riprova», e nel log un codice, non un testo", [false, "server", true, true], [
      pGuasto.p?.ok, pGuasto.p?.tipo, /riprova/i.test(pGuasto.p?.messaggio ?? ""), pGuasto.log.length > 0 && pGuasto.log.every((l) => /^\[stripe\] [A-Za-z0-9_ ]{1,60}$/.test(l)),
    ]);
    const pStrano = await scenario({ chiave: CHIAVE_PROVA, cosa: async () => ({ a: await grezzo(await porta("/api/crm/stripe", { method: "POST", body: JSON.stringify({ azione: "altro" }) })), b: await grezzo(await porta("/api/crm/stripe", { method: "POST", body: "non è json" })) }) });
    c("POST con un'azione sconosciuta o un corpo rotto: 400, e Stripe non è stato chiamato", [400, 400, 0], [pStrano.a.stato, pStrano.b.stato, pStrano.stripe.chiamate.length]);

    // ── 5. la chiave non esce mai: né dalla rotta né dal pannello ──
    const tutto = JSON.stringify([gProva.corpo, gReale.corpo, gNo.corpo, pProva.raw.corpo, pNo.raw.corpo, sProva.r, pProva.p, pReale.p, pNo.p, pRif.p, pGuasto.p, n403.guardia]);
    c("in nessuna risposta né in nessun esito del pannello compare la chiave (prova o reale), né «sk_», né «whsec_»", false, [CHIAVE_PROVA, CHIAVE_REALE].some((k) => tutto.includes(k)) || /sk_|rk_|whsec_/.test(tutto));
    c("Stripe riceve la chiave nell'intestazione (e solo lì): la prova di prima non ha trovato nulla altrove, e il registro del finto la maschera", false, JSON.stringify(pProva.stripe.chiamate).includes(CHIAVE_PROVA));

    // ── 6. la schermata, disegnata con quello che la rotta ha detto ──
    const req = createRequire(join(radice, "package.json"));
    const reactDelProgetto = { name: "react-del-progetto", setup(b) {
      b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (x) => ({ path: req.resolve(x.path), external: true }));
    } };
    let Pannello = null;
    try {
      await build({ entryPoints: [join(radice, "src/crm/ecommerce/cassa/PannelloCassa.tsx")], bundle: true, platform: "node", format: "cjs", outfile: join(dove, "pannello.cjs"),
        loader: { ".tsx": "tsx", ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".webp": "dataurl" }, alias: { "@": join(radice, "src") }, plugins: [reactDelProgetto], logLevel: "silent", jsx: "automatic" });
      Pannello = createRequire(import.meta.url)(join(dove, "pannello.cjs"));
    } catch (e) {
      c("PannelloCassa.tsx: l'errore di compilazione", "nessuno", String(e?.message ?? e).split("\n")[0]);
    }
    if (Pannello) {
      const { createElement: h } = req("react");
      const { renderToStaticMarkup } = req("react-dom/server");
      const testo = (x) => x.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
      const vista = (extra) => testo(renderToStaticMarkup(h(Pannello.VistaCassa, {
        stripe: null, erroreStripe: null, cassa: null, erroreCassa: null, lavoro: null, esito: null,
        indirizzo: "https://sito.test/api/public/stripe-webhook", copiato: false, provaEsito: null,
        onProva() {}, onCassa() {}, onSicuro() {}, onMetodo() {}, onCopia() {}, onRiprova() {}, ...extra,
      })));
      const vP = vista({ stripe: sProva.r?.stripe, provaEsito: pProva.p?.ok ? { ok: true, frase: pProva.p.frase } : null });
      c("schermata con la risposta vera (prova): «Stripe collegato · PROVA», l'ultimo webhook e la frase di «Prova adesso»", [true, true, true], [
        /Stripe collegato · PROVA/.test(vP), vP.includes("checkout.session.completed"), vP.includes(pProva.p?.frase ?? "§"),
      ]);
      c("schermata con la risposta vera (reale): «Stripe collegato · REALE»", true, /Stripe collegato · REALE/.test(vista({ stripe: sReale.r?.stripe })));
      const vN = vista({ stripe: sNo.r?.stripe, provaEsito: pNo.p?.ok === false ? { ok: false, frase: pNo.p.messaggio } : null });
      c("schermata senza chiave: dice che Stripe non è collegato e porta la frase della rotta", [true, true], [/Stripe non è collegato/i.test(vN), vN.includes(pNo.raw.corpo.frase)]);
      c("nessuna schermata mostra una chiave", false, /sk_|rk_|whsec_/.test(vP + vN + vista({ stripe: sReale.r?.stripe })));
    }
  } finally {
    process.env.STRIPE_SECRET_KEY = salvate.chiave;
    if (salvate.chiave === undefined) delete process.env.STRIPE_SECRET_KEY;
    if (salvate.segreto === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    globalThis.fetch = salvate.fetch;
    console.warn = salvate.warn;
    delete globalThis.__cassaDb;
    delete globalThis.__cassaGuardia;
    rmSync(dove, { recursive: true, force: true });
  }
}
