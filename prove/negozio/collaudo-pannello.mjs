/** ── NEGOZIO · RILASCIO 2 · T68 parte 4 · IL RIQUADRO «COLLAUDO CON CHIAVE» NELLA SCHEDA CASSA ─────────────────────────────
 *  T67 ha dato l'azione `collaudo_chiave` di `/api/crm/negozio`, ma nel CRM non c'era nessun pulsante che la chiamasse. Qui si prova
 *  il riquadro di `PannelloCassa.tsx` (D57):
 *   · il CONTRATTO: la rotta VERA (impacchettata con esbuild; finti solo router, database e guardia) risponde alla chiamata che il
 *     pannello fa davvero (`creaLinkCollaudo`): il link è `…/shop/collaudo#k=…` (mai `?`), la guardia chiesta è «pagamenti», UNA volta;
 *   · la FRASE fissa («Il link dura 2 ore…»), il pulsante SPENTO durante l'invio, «Copia» e il suo messaggio;
 *   · gli ERRORI in italiano (senza permesso, sessione, cassa non pronta, rete, risposta strana): mai un codice, mai la chiave;
 *   · NESSUN `console`, NESSUN `localStorage`/`sessionStorage`, niente cronologia né cookie: il link vive solo nello stato del riquadro.
 *  Limite dichiarato: la guardia vera (`guardiaCRM`, token e permessi) è finta, provata altrove; qui si guarda CHE permesso chiede la
 *  rotta. Nessun browser: la vista si prova come HTML (`react-dom/server`) e il clic sul pulsante non è provato qui. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";

/** Un segreto inventato per firmare il link (è la chiave di servizio, che nel pannello non deve comparire mai). */
const SEGRETO = ["segreto", "di", "prova", "00000000"].join("-");
const FRASE =
  "Il link dura 2 ore. Finché dura, lo può usare chiunque lo abbia: mandalo solo a te stesso e cancella il messaggio dopo l'uso.";

export async function prove(mod, { c, gruppo, radice }) {
  gruppo(
    "SHOP R2 · T68 parte 4 · IL RIQUADRO «COLLAUDO CON CHIAVE» DELLA SCHEDA CASSA (22/11/2026)",
  );
  const dove = mkdtempSync(join(tmpdir(), "collaudo-pannello-"));
  const salvate = {
    segreto: process.env.SUPABASE_SERVICE_ROLE_KEY,
    warn: console.warn,
    log: console.log,
    error: console.error,
  };
  try {
    // ── la rotta vera: il router, il database e la guardia sono finti ──
    const finti = {
      name: "finti-del-collaudo",
      setup(b) {
        const modulo = (nome, codice) => {
          const f = join(dove, nome);
          writeFileSync(f, codice);
          return f;
        };
        const router = modulo(
          "router.cjs",
          "exports.createFileRoute = (percorso) => (opzioni) => ({ percorso, opzioni });",
        );
        const db = modulo("db.cjs", "exports.supabaseAdmin = {};");
        const guardia = modulo(
          "guardia.cjs",
          `exports.guardiaCRM = async (richiesta, intestazioni, permesso) => {
             globalThis.__collaudoGuardia.chiamate.push(permesso);
             const stato = globalThis.__collaudoGuardia.stato;
             if (stato === 200) return { ok: true, chi: { nome: "Prova" } };
             return { ok: false, risposta: new Response(JSON.stringify({ ok: false }), { status: stato, headers: { "Content-Type": "application/json" } }) };
           };`,
        );
        b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: router }));
        b.onResolve({ filter: /^@\/integrations\/supabase\/client\.server$/ }, () => ({
          path: db,
        }));
        b.onResolve({ filter: /^\.\/api\.crm\.accesso$/ }, () => ({ path: guardia }));
      },
    };
    let rotta = null;
    try {
      await build({
        entryPoints: [join(radice, "src/routes/api.crm.negozio.ts")],
        bundle: true,
        platform: "node",
        format: "cjs",
        outfile: join(dove, "rotta.cjs"),
        alias: { "@": join(radice, "src") },
        plugins: [finti],
        logLevel: "silent",
      });
      rotta =
        createRequire(import.meta.url)(join(dove, "rotta.cjs")).Route?.opzioni?.server?.handlers ??
        null;
    } catch (e) {
      c(
        "la rotta vera /api/crm/negozio si impacchetta: l'errore di compilazione",
        "nessuno",
        String(e?.message ?? e).split("\n")[0],
      );
    }
    c("la rotta vera /api/crm/negozio ha il gestore POST", true, typeof rotta?.POST === "function");

    // ── il pannello, impacchettato con il React del progetto ──
    const req = createRequire(join(radice, "package.json"));
    const reactDelProgetto = {
      name: "react-del-progetto",
      setup(b) {
        b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (x) => ({
          path: req.resolve(x.path),
          external: true,
        }));
      },
    };
    let P = null;
    try {
      await build({
        entryPoints: [join(radice, "src/crm/ecommerce/cassa/PannelloCassa.tsx")],
        bundle: true,
        platform: "node",
        format: "cjs",
        outfile: join(dove, "pannello.cjs"),
        loader: {
          ".tsx": "tsx",
          ".png": "dataurl",
          ".jpg": "dataurl",
          ".svg": "dataurl",
          ".webp": "dataurl",
        },
        alias: { "@": join(radice, "src") },
        plugins: [reactDelProgetto],
        logLevel: "silent",
        jsx: "automatic",
      });
      P = createRequire(import.meta.url)(join(dove, "pannello.cjs"));
    } catch (e) {
      c(
        "PannelloCassa.tsx si impacchetta: l'errore di compilazione",
        "nessuno",
        String(e?.message ?? e).split("\n")[0],
      );
    }
    //  Le chiamate e le frasi stanno in `pagina-r2.ts` (puro, come `provaAdesso`): si impacchetta a parte.
    let R2 = null;
    try {
      await build({
        entryPoints: [join(radice, "src/crm/ecommerce/pagina-r2.ts")],
        bundle: true,
        platform: "node",
        format: "cjs",
        outfile: join(dove, "pagina-r2.cjs"),
        alias: { "@": join(radice, "src") },
        logLevel: "silent",
      });
      R2 = createRequire(import.meta.url)(join(dove, "pagina-r2.cjs"));
    } catch (e) {
      c(
        "pagina-r2.ts si impacchetta: l'errore di compilazione",
        "nessuno",
        String(e?.message ?? e).split("\n")[0],
      );
    }
    c(
      "`pagina-r2.ts` esporta la chiamata (`creaLinkCollaudo`), la copia (`copiaLink`) e la frase; il pannello il riquadro (`VistaCollaudo`)",
      [true, true, FRASE, true],
      [
        typeof R2?.creaLinkCollaudo === "function",
        typeof R2?.copiaLink === "function",
        R2?.FRASE_COLLAUDO,
        typeof P?.VistaCollaudo === "function",
      ],
    );
    if (
      !P ||
      !R2 ||
      !rotta ||
      typeof R2.creaLinkCollaudo !== "function" ||
      typeof P.VistaCollaudo !== "function"
    )
      return;

    // ── 1. il contratto con la rotta vera ──
    process.env.SUPABASE_SERVICE_ROLE_KEY = SEGRETO;
    const ingressi = [];
    const log = [];
    const porta = async (url, init = {}) => {
      ingressi.push({ url, metodo: init.method ?? "GET", corpo: init.body ?? null });
      return rotta.POST({
        request: new Request(`https://sito.test${url}`, { ...init, method: init.method ?? "GET" }),
      });
    };
    const giro = async (stato, f = porta) => {
      globalThis.__collaudoGuardia = { stato, chiamate: [] };
      ingressi.length = 0;
      log.length = 0;
      //  La console si intercetta solo mentre gira il pannello: `c` deve poter scrivere.
      for (const m of ["warn", "log", "error"])
        console[m] = (...a) => log.push(a.map(String).join(" "));
      let esito;
      try {
        esito = await R2.creaLinkCollaudo(f);
      } finally {
        console.warn = salvate.warn;
        console.log = salvate.log;
        console.error = salvate.error;
      }
      return {
        esito,
        guardia: [...globalThis.__collaudoGuardia.chiamate],
        ingressi: [...ingressi],
        log: [...log],
      };
    };
    const ok = await giro(200);
    c(
      "con la rotta vera e la guardia che apre: ok e un link `…/shop/collaudo#k=<chiave>`, senza «?»",
      [true, true, false],
      [
        ok.esito.ok,
        /^https:\/\/[^\s#?]+\/shop\/collaudo#k=[^\s#?]{10,}$/.test(ok.esito.link ?? ""),
        String(ok.esito.link).includes("?"),
      ],
    );
    c(
      'la chiamata è UN POST a /api/crm/negozio con corpo {azione:"collaudo_chiave"}, e la guardia chiede «pagamenti» una volta sola',
      [
        [{ url: "/api/crm/negozio", metodo: "POST", corpo: { azione: "collaudo_chiave" } }],
        ["pagamenti"],
      ],
      [ok.ingressi.map((i) => ({ ...i, corpo: JSON.parse(i.corpo ?? "null") })), ok.guardia],
    );
    c(
      "il segreto di firma non compare nell'esito, e la rotta e il pannello non scrivono niente sulla console",
      [false, 0],
      [JSON.stringify(ok.esito).includes(SEGRETO), ok.log.length],
    );

    // ── 2. gli errori: frasi in italiano, mai codici né la chiave ──
    const CODICI =
      /\b[1-5]\d\d\b|non_configurato|non_collegato|interno|conflitto|undefined|null|\[object|TypeError|Error|Failed|fetch|sk_|rk_|whsec_/;
    const n403 = await giro(403);
    c(
      "senza permesso (403): ok false, «permesso», la frase dice che non può gestire i pagamenti, nessun link",
      [false, "permesso", true, undefined],
      [
        n403.esito.ok,
        n403.esito.tipo,
        /pagamenti/.test(n403.esito.messaggio ?? ""),
        n403.esito.link,
      ],
    );
    const n401 = await giro(401);
    c(
      "sessione scaduta (401): «sessione» e una frase che rimanda al CRM",
      [false, "sessione", true],
      [n401.esito.ok, n401.esito.tipo, /rientra nel CRM/.test(n401.esito.messaggio ?? "")],
    );
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const non = await giro(200);
    process.env.SUPABASE_SERVICE_ROLE_KEY = SEGRETO;
    c(
      "cassa non pronta (il sito non ha il segreto, 503): ok false e la frase della rotta in italiano, senza codici",
      [false, true, false],
      [
        non.esito.ok,
        /chiave per firmare il link/.test(non.esito.messaggio ?? ""),
        CODICI.test(non.esito.messaggio ?? ""),
      ],
    );
    const rete = await giro(200, async () => {
      throw new TypeError(`Failed to fetch https://sito.test/api/crm/negozio ${SEGRETO}`);
    });
    c(
      "rete caduta: frase «non riesco a collegarmi», senza il testo del browser né l'indirizzo né il segreto",
      [false, "rete", true, false],
      [
        rete.esito.ok,
        rete.esito.tipo,
        /collegarmi al server/.test(rete.esito.messaggio ?? ""),
        CODICI.test(rete.esito.messaggio ?? "") ||
          (rete.esito.messaggio ?? "").includes("sito.test"),
      ],
    );
    const hosting = await giro(
      200,
      async () => new Response("<html>Bad gateway</html>", { status: 502 }),
    );
    c(
      "una pagina d'errore dell'hosting (502 senza JSON): una frase «riprova», senza codici",
      [false, true, false],
      [
        hosting.esito.ok,
        /riprova/.test(hosting.esito.messaggio ?? ""),
        CODICI.test(hosting.esito.messaggio ?? ""),
      ],
    );
    const strano = async (corpo) =>
      (
        await giro(
          200,
          async () =>
            new Response(JSON.stringify(corpo), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
        )
      ).esito;
    const sSenza = await strano({ ok: true });
    const sFuori = await strano({ ok: true, link: "https://altro.example/qualsiasi" });
    const sJs = await strano({ ok: true, link: "javascript:alert(1)#k=abc" });
    c(
      "una risposta «ok» senza link o con un link che non è del collaudo non si mostra: errore in italiano",
      [
        [false, false, false],
        [true, true, true],
      ],
      [
        [sSenza.ok, sFuori.ok, sJs.ok],
        [
          /riprova/.test(sSenza.messaggio ?? ""),
          /riprova/.test(sFuori.messaggio ?? ""),
          /riprova/.test(sJs.messaggio ?? ""),
        ],
      ],
    );
    const chiaveNelFrase = await strano({
      ok: false,
      frase: `Errore con ${["sk", "live", "finta0000000000000000"].join("_")}`,
    });
    c(
      "una frase del server che somiglia a una chiave non si mostra",
      [false, false],
      [chiaveNelFrase.ok, /sk_/.test(chiaveNelFrase.messaggio ?? "")],
    );

    // ── 3. la vista ──
    const { createElement: h } = req("react");
    const { renderToStaticMarkup } = req("react-dom/server");
    const html = (extra) =>
      renderToStaticMarkup(
        h(P.VistaCollaudo, {
          link: null,
          errore: null,
          inCorso: false,
          copia: null,
          onCrea() {},
          onCopia() {},
          ...extra,
        }),
      );
    const testo = (x) =>
      x
        .replace(/<[^>]*>/g, " ")
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ");
    const link = ok.esito.link ?? "https://sito.test/shop/collaudo#k=abc.def";
    const v0 = html({});
    c(
      "a riposo: titolo «Collaudo con chiave», pulsante «Crea il link di collaudo» attivo, nessun link, nessun «Copia»",
      [true, true, false, false, false],
      [
        /Collaudo con chiave/.test(testo(v0)),
        /Crea il link di collaudo/.test(testo(v0)),
        /<button[^>]*\sdisabled=""/.test(v0),
        /Copia/.test(testo(v0)),
        /<input/.test(v0),
      ],
    );
    c(
      "la frase fissa si legge sempre (anche prima del clic), parola per parola",
      true,
      testo(v0).includes(FRASE),
    );
    const vInvio = html({ inCorso: true });
    c(
      "durante l'invio il pulsante è SPENTO (`disabled`) e dice che sta lavorando",
      [true, true],
      [
        /<button[^>]*\sdisabled=""[^>]*>[^]*?Creo il link/.test(vInvio),
        /Creo il link/.test(testo(vInvio)),
      ],
    );
    const vLink = html({ link });
    c(
      "col link: è in un campo di sola lettura (selezionabile), col nome per chi legge a voce, e c'è «Copia»",
      [true, true, true, true],
      [
        vLink.includes(`value="${link}"`),
        /<input[^>]*readOnly=""|<input[^>]*readonly=""/i.test(vLink),
        /<input[^>]*aria-label="Link di collaudo"/.test(vLink),
        /Copia/.test(testo(vLink)),
      ],
    );
    c(
      "la frase fissa resta anche col link, ed è collegata al campo (`aria-describedby`)",
      [true, true],
      [
        testo(vLink).includes(FRASE),
        (() => {
          const d = vLink.match(/<input[^>]*aria-describedby="([^"]+)"/)?.[1];
          return !!d && new RegExp(`id="${d}"`).test(vLink);
        })(),
      ],
    );
    const vErr = html({ errore: n403.esito.messaggio });
    c(
      'un errore si legge con `role="alert"` e non lascia nessun link',
      [true, false],
      [/role="alert"[^>]*>[^]*pagamenti/.test(vErr), /<input/.test(vErr)],
    );
    const vCopiato = html({ link, copia: { ok: true, testo: "Link copiato." } });
    c(
      'dopo «Copia» un messaggio con `role="status"`, che non ripete il link',
      [true, false],
      [
        /role="status"[^>]*>[^<]*Link copiato\./.test(vCopiato) ||
          /role="status"[^]*Link copiato\./.test(vCopiato),
        new RegExp(`role="status"[^>]*>[^<]*${link.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`).test(
          vCopiato,
        ),
      ],
    );
    c(
      "bersagli da 44 px sul telefono (`min-h-11`) e testo a 16 px (`text-base`) su pulsanti e campo; sul computer si rimpiccioliscono",
      [true, true, true],
      [
        /<button[^>]*class="[^"]*min-h-11/.test(vLink),
        /<input[^>]*class="[^"]*\btext-base\b/.test(vLink),
        /<button[^>]*class="[^"]*\btext-base\b/.test(vLink),
      ],
    );
    c(
      "nessuna vista mostra il segreto di firma né una chiave",
      false,
      [v0, vInvio, vLink, vErr, vCopiato].some(
        (x) => x.includes(SEGRETO) || /sk_|rk_|whsec_/.test(x),
      ),
    );
    c(
      "la scheda Cassa intera disegna il riquadro (`VistaCassa` con il suo `collaudo`)",
      true,
      (() => {
        const base = {
          stripe: null,
          erroreStripe: null,
          cassa: null,
          erroreCassa: null,
          lavoro: null,
          esito: null,
          indirizzo: "https://sito.test/api/public/stripe-webhook",
          copiato: false,
          provaEsito: null,
          onProva() {},
          onCassa() {},
          onSicuro() {},
          onMetodo() {},
          onCopia() {},
          onRiprova() {},
        };
        return /Collaudo con chiave/.test(
          testo(
            renderToStaticMarkup(
              h(P.VistaCassa, {
                ...base,
                collaudo: h(P.VistaCollaudo, {
                  link: null,
                  errore: null,
                  inCorso: false,
                  copia: null,
                  onCrea() {},
                  onCopia() {},
                }),
              }),
            ),
          ),
        );
      })(),
    );

    // ── 4. «Copia» ──
    const scritti = [];
    const appunti = { writeText: async (t) => void scritti.push(t) };
    const cOk = await R2.copiaLink(link, appunti);
    c(
      "«Copia» scrive il link negli appunti e risponde con una frase che non lo ripete",
      [[link], true, "Link copiato.", false],
      [scritti, cOk.ok, cOk.testo, cOk.testo.includes(link)],
    );
    const cNo = await R2.copiaLink(link, {
      writeText: async () => {
        throw new Error(`NotAllowedError ${link}`);
      },
    });
    c(
      "se il browser non lascia copiare: frase in italiano («copialo a mano»), senza il testo del browser né il link",
      [false, true, false],
      [
        cNo.ok,
        /a mano/.test(cNo.testo),
        /Error|NotAllowed/.test(cNo.testo) || cNo.testo.includes(link),
      ],
    );
    const cManca = await R2.copiaLink(link, undefined);
    c(
      "senza appunti nel browser (nessun `navigator.clipboard`) non si rompe: stessa frase «a mano»",
      [false, true],
      [cManca.ok, /a mano/.test(cManca.testo)],
    );

    // ── 5. il sorgente: niente console, niente memoria del browser, niente cronologia ──
    const grezzo = readFileSync(join(radice, "src/crm/ecommerce/cassa/PannelloCassa.tsx"), "utf8");
    const senzaCommenti = (x) =>
      x.replace(/\/\*[^]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    //  Il riquadro e le sue chiamate: i due sorgenti (le chiamate stanno in `pagina-r2.ts`).
    const t =
      senzaCommenti(grezzo) +
      senzaCommenti(readFileSync(join(radice, "src/crm/ecommerce/pagina-r2.ts"), "utf8"));
    c(
      "PannelloCassa.tsx e pagina-r2.ts: nessun `console`, `localStorage`, `sessionStorage`, `history`, `document.cookie`, `indexedDB`",
      [],
      [
        /\bconsole\b/,
        /\blocalStorage\b/,
        /\bsessionStorage\b/,
        /\bhistory\b/,
        /document\.cookie/,
        /\bindexedDB\b/,
      ]
        .filter((r) => r.test(t))
        .map(String),
    );
    c(
      "PannelloCassa.tsx e pagina-r2.ts: il link non entra in nessun attributo `href`/`src`, non si apre con `window.open` né con `location`",
      [false, false, false],
      [
        /href=\{[^}]*link/i.test(t),
        /window\.open\(/.test(t),
        /(?:window\.)?location\.(?:assign|href|replace)/.test(t),
      ],
    );
    c(
      'pagina-r2.ts: la chiamata è `chiamaRotta` a /api/crm/negozio con {azione:"collaudo_chiave"} (stesso client degli altri pulsanti)',
      true,
      /chiamaRotta\(/.test(t) && /collaudo_chiave/.test(t) && /\/api\/crm\/negozio/.test(t),
    );
  } finally {
    if (salvate.segreto === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = salvate.segreto;
    console.warn = salvate.warn;
    console.log = salvate.log;
    console.error = salvate.error;
    delete globalThis.__collaudoGuardia;
    rmSync(dove, { recursive: true, force: true });
  }
}
