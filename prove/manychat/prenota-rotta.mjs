/** ── PROVE: LA ROTTA E LA SICUREZZA (T8) ──────────────────────────────────────────────
 *
 *  Commessa 2026-10-27 (prenota in chat), PIANO.md T8, SPEC 7.1 e 9.7.
 *  La rotta VERA (`src/routes/api.public.manychat-prenota.ts`) viene impacchettata
 *  qui con esbuild, con due soli pezzi finti: `@tanstack/react-router` (restituisce
 *  le opzioni) e `prenota.server` (restituisce le porte del mondo finto di
 *  `prenota-mondo.mjs`, al posto di Supabase). Il resto (chiave, limite, orchestratore,
 *  log) è il codice vero. `fetch` qui è un allarme: la rotta non chiama NESSUNO.
 *
 *  Il corpo è uno stream che si accorge se qualcuno lo legge; i log sono catturati.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { ID, SENSIBILI, TEL, TOKEN, corpoTesto, creaMondo } from "./prenota-mondo.mjs";

const URL_ROTTA = "https://sito.test/api/public/manychat-prenota";
const PERCORSO = "/api/public/manychat-prenota";
const SUBSCRIBER = "99887766";
const TESTO_CLIENTE = "segretissimo-testo-del-cliente";

export async function proveDellaRottaPrenota(mod, { c, gruppo, radice }) {
  const sorgente = readFileSync(join(radice, "src/routes/api.public.manychat-prenota.ts"), "utf8");
  const albero = readFileSync(join(radice, "src/routeTree.gen.ts"), "utf8");

  /* ═══ 1. IL SORGENTE E L'ALBERO DELLE ROTTE ═════════════════════════════ */
  gruppo("PRENOTA · ROTTA · SORGENTE E ALBERO GENERATO");
  {
    //  Senza commenti: le intestazioni nominano `fetch(` e `request.json` per dire che NON si usano.
    const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    c("la rotta è quella giusta", true, codice.includes(`createFileRoute("${PERCORSO}")`));
    c("risponde solo a POST", ["POST"], [...codice.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s*:/g)].map((x) => x[1]));
    c("passa il segreto del Worker", true, codice.includes("segreto: process.env.MANYCHAT_RITORNO_TOKEN"));
    c("usa l'orchestratore e le porte vere, senza riscriverle", true,
      codice.includes("gestisciRichiestaPrenota(portePrenota()") &&
      codice.includes('from "@/crm/manychat/prenota"') &&
      codice.includes('from "@/crm/manychat/prenota.server"'));
    c("non chiama nessuno (niente fetch)", false, /\bfetch\s*\(/.test(codice));
    c("non legge il corpo da sé (lo fa l'orchestratore, dopo la chiave)", false, /\.(json|text|formData|arrayBuffer|blob)\s*\(|\.body\b/.test(codice));
    c("i soli import sono router, orchestratore e porte", [
      "@/crm/manychat/prenota",
      "@/crm/manychat/prenota.server",
      "@tanstack/react-router",
    ], [...codice.matchAll(/from\s+"([^"]+)"/g)].map((x) => x[1]).sort());
    c("l'intestazione dichiara pubblica, 503/401/413 e solo codici nei log", true,
      /PUBBLICA/.test(sorgente) && /503/.test(sorgente) && /401/.test(sorgente) && /413/.test(sorgente) && /solo codici/i.test(sorgente));
    c("nei log solo l'esito", true, /console\.info\(`\[manychat-prenota\] \$\{response\.status\} \$\{esito\}`\)/.test(codice));
    c("nessun altro console", 1, (codice.match(/console\./g) ?? []).length);

    c("routeTree.gen.ts conosce la rotta (import)", true,
      albero.includes("import { Route as ApiPublicManychatPrenotaRouteImport } from './routes/api.public.manychat-prenota'"));
    c("…il percorso nell'albero", true, albero.includes(`'${PERCORSO}'`));
    c("…registrata una volta sola nell'elenco dei figli", 1, (albero.match(/ApiPublicManychatPrenotaRoute: ApiPublicManychatPrenotaRoute,/g) ?? []).length);
    c("…accanto a quella delle risposte, che c'è ancora", true, albero.includes("ApiPublicManychatRispostaRoute: ApiPublicManychatRispostaRoute,"));
  }

  /* ═══ 2. LA ROTTA VERA, IMPACCHETTATA ════════════════════════════════════ */
  const cartella = mkdtempSync(join(tmpdir(), "rotta-prenota-"));
  const fetchVero = globalThis.fetch;
  const tokenVero = process.env.MANYCHAT_RITORNO_TOKEN;
  const conLog = ["log", "info", "warn", "error", "debug"];
  const consoleVero = Object.fromEntries(conLog.map((k) => [k, console[k]]));
  try {
    const file = join(cartella, "rotta.cjs");
    await build({
      stdin: { contents: `export { Route } from "@/routes/api.public.manychat-prenota";`, resolveDir: radice, loader: "ts" },
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: file,
      logLevel: "error",
      alias: { "@": join(radice, "src") },
      plugins: [
        {
          name: "finti",
          setup(b) {
            b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: "router", namespace: "finto" }));
            b.onResolve({ filter: /^@\/crm\/manychat\/prenota\.server$/ }, () => ({ path: "server", namespace: "finto" }));
            b.onLoad({ filter: /^router$/, namespace: "finto" }, () => ({
              contents: "export const createFileRoute = (path) => (options) => ({ path, options });",
              loader: "js",
            }));
            b.onLoad({ filter: /^server$/, namespace: "finto" }, () => ({
              contents: "export const portePrenota = () => globalThis.__PORTE_PRENOTA_PROVA__();",
              loader: "js",
            }));
          },
        },
      ],
    });
    const { Route } = createRequire(import.meta.url)(file);
    const POST = Route.options.server.handlers.POST;

    //  ⚠️ Un allarme al posto di `fetch`: la rotta non deve chiamare NESSUNO.
    let chiamateEsterne = 0;
    globalThis.fetch = () => {
      chiamateEsterne++;
      throw new Error("la rotta non deve chiamare nessuno");
    };

    /** Uno stream che conta quante volte qualcuno lo tira (highWaterMark 0: non si legge da solo). */
    const flusso = (pezzi) => {
      const spia = { tirati: 0 };
      let i = 0;
      const enc = new TextEncoder();
      spia.stream = new ReadableStream(
        {
          pull(ctl) {
            spia.tirati++;
            const p = typeof pezzi === "function" ? pezzi(i++) : pezzi[i++];
            if (p === undefined) ctl.close();
            else if (p instanceof Error) ctl.error(p);
            else ctl.enqueue(enc.encode(p));
          },
        },
        { highWaterMark: 0 },
      );
      return spia;
    };
    const richiesta = (spia, headers) =>
      new Request(URL_ROTTA, { method: "POST", headers, body: spia.stream, duplex: "half" });

    /** Chiama la rotta vera con il mondo dato; cattura i log; ridà risposta, JSON e log. */
    const chiama = async (m, o) => {
      //  `token: undefined` vuol dire «segreto assente», non «quello solito».
      const { chiave, corpo, intestazioni = {} } = o;
      const token = "token" in o ? o.token : TOKEN;
      const log = [];
      for (const k of conLog) console[k] = (...a) => log.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
      if (token === undefined) delete process.env.MANYCHAT_RITORNO_TOKEN;
      else process.env.MANYCHAT_RITORNO_TOKEN = token;
      globalThis.__PORTE_PRENOTA_PROVA__ = () => m.porte;
      const spia = Array.isArray(corpo) || typeof corpo === "function" ? flusso(corpo) : flusso([JSON.stringify(corpo)]);
      try {
        const risposta = await POST({
          request: richiesta(spia, { ...(chiave === undefined ? {} : { "x-hgl-token": chiave }), ...intestazioni }),
        });
        const testo = await risposta.text();
        let json = null;
        try {
          json = JSON.parse(testo);
        } catch {
          /* resta null: la prova lo segnala */
        }
        return { stato: risposta.status, testo, json, intestazioni: risposta.headers, log, spia };
      } finally {
        for (const k of conLog) console[k] = consoleVero[k];
      }
    };
    //  Cercato in tutto ciò che esce: risposte e log.
    const segreti = [
      ...Object.values(SENSIBILI),
      TEL,
      `+${TEL}`,
      ID(1),
      SUBSCRIBER,
      TESTO_CLIENTE,
      TOKEN,
      "anna",
    ];
    const trapelato = (r, m) => {
      const tutto = (r.testo + "\n" + r.log.join("\n") + "\n" + (m ? m.avvisi.join("\n") : "")).toLowerCase();
      return segreti.filter((s) => tutto.includes(s.toLowerCase()));
    };
    const corpoCompleto = (testo) =>
      JSON.stringify({ ...corpoTesto(testo), crm_lead_id: ID(1), telefono: `+${TEL}`, subscriber_id: SUBSCRIBER });
    const grande = () => (i) => (i < 200 ? "x".repeat(1024) : undefined);

    gruppo("PRENOTA · ROTTA · 503 SENZA SEGRETO, 401 SENZA CHIAVE");
    {
      let m = creaMondo(mod);
      let r = await chiama(m, { token: undefined, chiave: TOKEN, corpo: [corpoCompleto("sera")] });
      c("segreto assente sul server: 503", 503, r.stato);
      c("…JSON mai vuoto, senza cache, corpo mai letto, nessuna porta", [true, "no-store", 0, []], [!!r.json && r.testo.length > 0, r.intestazioni.get("cache-control"), r.spia.tirati, m.chiamate]);
      c("…il corpo non dice altro", { ok: false, errore: "non_configurato" }, r.json);
      c("…niente trapelato", [], trapelato(r, m));
      r = await chiama(m, { token: "", chiave: "", corpo: [corpoCompleto("sera")] });
      c("segreto vuoto e chiave vuota: 503, non entra", [503, 0], [r.stato, r.spia.tirati]);

      let sbagliata = null;
      for (const [nome, chiave] of [
        ["senza chiave", undefined],
        ["chiave vuota", ""],
        ["chiave sbagliata, stessa lunghezza", "x".repeat(TOKEN.length)],
        ["chiave più corta", TOKEN.slice(0, -1)],
        ["chiave più lunga", TOKEN + "t"],
        ["chiave di un solo carattere", "t"],
        ["chiave giusta in maiuscolo", TOKEN.toUpperCase()],
      ]) {
        m = creaMondo(mod);
        r = await chiama(m, { chiave, corpo: [corpoCompleto("sera")] });
        c(`${nome}: 401`, 401, r.stato);
        c(`${nome}: corpo mai letto, nessuna porta toccata`, [0, []], [r.spia.tirati, m.chiamate]);
        c(`${nome}: risposta JSON non vuota, senza cache`, [{ ok: false, errore: "non_autorizzato" }, "no-store"], [r.json, r.intestazioni.get("cache-control")]);
        c(`${nome}: niente trapelato`, [], trapelato(r, m));
        sbagliata ??= r.testo;
        c(`${nome}: stessa risposta di tutte le altre chiavi sbagliate`, sbagliata, r.testo);
      }
      //  Un corpo enorme con la chiave sbagliata: 401, non 413 (non si guarda nemmeno quanto è grande).
      m = creaMondo(mod);
      r = await chiama(m, { chiave: "x", corpo: grande(), intestazioni: { "content-length": "999999" } });
      c("corpo enorme con chiave sbagliata: 401 e mai letto", [401, 0], [r.stato, r.spia.tirati]);
    }

    gruppo("PRENOTA · ROTTA · 413 E CORPO STORTO");
    {
      let m = creaMondo(mod);
      //  Il Content-Length mente (10 byte): conta quello che arriva davvero.
      let r = await chiama(m, { chiave: TOKEN, corpo: grande(), intestazioni: { "content-length": "10" } });
      c("oltre 8 KB, Content-Length bugiardo: 413", 413, r.stato);
      c("…si smette di leggere al limite (non si scarica tutto)", true, r.spia.tirati > 0 && r.spia.tirati < 20);
      c("…risposta JSON, nessuna porta, niente trapelato", [{ ok: false, errore: "troppo_grande" }, [], []], [r.json, m.chiamate, trapelato(r, m)]);
      c("…il log dice solo il codice", ["[manychat-prenota] 413 troppo_grande"], r.log);

      //  Un solo pezzo da 9 KB, senza Content-Length.
      r = await chiama(m, { chiave: TOKEN, corpo: ["a".repeat(9000)] });
      c("un pezzo solo da 9 KB: 413", 413, r.stato);
      //  Appena sotto il limite non è 413.
      r = await chiama(m, { chiave: TOKEN, corpo: ["{" + " ".repeat(8000) + "}"] });
      c("8 KB scarsi di JSON vuoto: non è 413", true, r.stato === 200);

      for (const [nome, corpo] of [
        ["JSON rotto", ["{non json"]],
        ["corpo vuoto", []],
        ["JSON che non è un oggetto", ['"sera"']],
        ["un array", ["[1,2,3]"]],
        ["null", ["null"]],
        ["azione sconosciuta", [JSON.stringify({ azione: "cancella", telefono: `+${TEL}` })]],
        ["flusso che si rompe a metà", ['{"azione":"te', new Error(`rotto: ${SENSIBILI.cognome} ${TEL}`)]],
      ]) {
        m = creaMondo(mod);
        r = await chiama(m, { chiave: TOKEN, corpo });
        c(`${nome}: 200 nessuno, testo vuoto`, [200, true, "nessuno", ""], [r.stato, r.json?.ok, r.json?.esito, r.json?.testo]);
        c(`${nome}: nessuna scheda toccata, niente trapelato`, [0, []], [m.scritture.length, trapelato(r, m)]);
        c(`${nome}: un log solo, con il codice`, 1, r.log.length);
      }
    }

    gruppo("PRENOTA · ROTTA · SPENTA, RICHIESTA VERA, NIENTE DATI NEI LOG");
    {
      //  Spenta: oltre la configurazione, le porte lanciano se toccate.
      const m = creaMondo(mod, { cfg: null });
      const toccata = [];
      const porte = new Proxy(m.porte, {
        get(bersaglio, nome) {
          const v = bersaglio[nome];
          if (typeof v !== "function" || ["config", "avviso", "adesso"].includes(nome)) return v;
          return (...a) => {
            toccata.push(String(nome));
            throw new Error(`porta toccata oltre la config: ${String(nome)} ${TEL}`);
          };
        },
      });
      const spenta = { porte, avvisi: m.avvisi, chiamate: m.chiamate, scritture: m.scritture };
      const r = await chiama(spenta, { chiave: TOKEN, corpo: [corpoCompleto("sera")] });
      c("spenta: 200 nessuno, testo vuoto", [200, "nessuno", ""], [r.stato, r.json?.esito, r.json?.testo]);
      c("…nessuna porta oltre la configurazione, zero scritture", [[], 0], [toccata, m.scritture.length]);
      c("…senza cache, il log dice solo il codice", ["no-store", ["[manychat-prenota] 200 spenta"]], [r.intestazioni.get("cache-control"), r.log]);
      c("…niente trapelato", [], trapelato(r, m));

      //  Un testo del cliente che non si capisce: il testo non torna indietro né finisce nei log.
      let w = creaMondo(mod);
      let q = await chiama(w, { chiave: TOKEN, corpo: [JSON.stringify({ ...corpoTesto(TESTO_CLIENTE), subscriber_id: SUBSCRIBER })] });
      c("testo non capito: 200 nessuno", [200, "nessuno", ""], [q.stato, q.json?.esito, q.json?.testo]);
      c("…il testo del cliente non esce da nessuna parte", [], trapelato(q, w));

      //  La richiesta vera, con la scheda piena di dati sensibili: «sera».
      w = creaMondo(mod);
      q = await chiama(w, { chiave: TOKEN, corpo: [corpoCompleto("sera")] });
      c("«sera»: 200, ok, esito e testo presenti", [200, true, "string", "string"], [q.stato, q.json?.ok, typeof q.json?.esito, typeof q.json?.testo]);
      c("…senza cache, JSON", ["no-store", true], [q.intestazioni.get("cache-control"), /json/.test(q.intestazioni.get("content-type") ?? "")]);
      c("…un log solo, `stato codice`", true, q.log.length === 1 && /^\[manychat-prenota\] 200 [a-z0-9_]+$/.test(q.log[0]));
      c("…né il numero, né il cognome, né le note, né il subscriber_id, né altri clienti nei log", [], trapelato({ ...q, testo: "" }, w));
      c("…nemmeno negli avvisi", [], segreti.filter((s) => w.avvisi.join("\n").toLowerCase().includes(s.toLowerCase())));
      //  Nella risposta può comparire il solo nome di battesimo del lead stesso (SPEC 9.1), mai il resto.
      const nellaRisposta = Object.values(SENSIBILI).concat([TEL, `+${TEL}`, ID(1), SUBSCRIBER, TOKEN]).filter((s) => q.testo.toLowerCase().includes(s.toLowerCase()));
      c("…e nella risposta nessun dato oltre il nome del lead", [], nellaRisposta);

      //  Un errore del database porta dentro numero e cognome: non deve uscire.
      w = creaMondo(mod);
      w.guasto = { al: 3 };
      q = await chiama(w, { chiave: TOKEN, corpo: [corpoCompleto("sera")] });
      c("database che si rompe: la risposta è comunque JSON valida", [200, true], [q.stato, !!q.json && typeof q.json.esito === "string"]);
      c("…senza dati nei log né nella risposta", [], trapelato({ ...q, testo: q.json?.testo?.replace(/Anna/g, "") ?? "" }, w));
    }

    c("la rotta non ha mai chiamato nessuno (fetch)", 0, chiamateEsterne);
  } finally {
    globalThis.fetch = fetchVero;
    for (const k of conLog) console[k] = consoleVero[k];
    if (tokenVero === undefined) delete process.env.MANYCHAT_RITORNO_TOKEN;
    else process.env.MANYCHAT_RITORNO_TOKEN = tokenVero;
    delete globalThis.__PORTE_PRENOTA_PROVA__;
    rmSync(cartella, { recursive: true, force: true });
  }
}
