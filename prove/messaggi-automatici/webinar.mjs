/** ── PROVE: WEBINAR, CHAT E PRENOTA IN CHAT ──
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T6 (webinar e chat; la prenotazione in
 *  chat è in `prove/manychat/prenota-interruttore.mjs` e `prenota-porte.mjs`). Qui si prova che:
 *   · `/api/whatsapp-send` con `automatico` e il messaggio spento risponde 409 PRIMA di
 *     `leggiCanale` e anche sul ramo Cloud (che chiama Graph senza passare da `inviaWhatsapp`);
 *   · il campo può solo frenare: assente, «manuale» o una chiave che non è del catalogo = invio a mano;
 *   · `mandaPromemoria` passa `automatico` solo se glielo dicono, e un 409 «spento» non segna «avvisato»;
 *   · il tasto a mano «in-diretta» (`azione:"promemoria"`) non passa mai `automatico`: mai bloccato.
 *  La rotta e `mandaPromemoria` sono i file VERI, impacchettati con i soli client finti
 *  (database, canale, registro, `fetch`). Nessun numero né nome veri: tutto inventato.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

/** Impacchetta un file vero sostituendo i moduli indicati (`[regex, codice]`). */
async function impacchetta(radice, entrata, finti, nome) {
  const dir = mkdtempSync(join(tmpdir(), "webinar-msg-"));
  const file = new Map();
  finti.forEach(([re, codice], i) => {
    const p = join(dir, `finto${i}.mjs`);
    writeFileSync(p, codice);
    file.set(re, p);
  });
  const fuori = join(dir, `${nome}.cjs`);
  await build({
    entryPoints: [join(radice, entrata)],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: fuori,
    logLevel: "error",
    alias: { "@": join(radice, "src") },
    plugins: [
      {
        name: "finti",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => {
            for (const [re, p] of file) if (re.test(a.path)) return { path: p };
            return undefined;
          });
        },
      },
    ],
  });
  return {
    modulo: createRequire(import.meta.url)(fuori),
    pulisci: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Il corpo di una chiamata `mandaPromemoria({ ... })`, parentesi comprese. */
function chiamateMandaPromemoria(testo) {
  const fuori = [];
  for (
    let i = testo.indexOf("mandaPromemoria({");
    i >= 0;
    i = testo.indexOf("mandaPromemoria({", i + 1)
  ) {
    let livello = 0;
    let j = testo.indexOf("(", i);
    for (; j < testo.length; j++) {
      if (testo[j] === "(") livello++;
      else if (testo[j] === ")" && --livello === 0) break;
    }
    fuori.push({ da: i, testo: testo.slice(i, j + 1) });
  }
  return fuori;
}

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

export async function proveWebinarMessaggi(mod, { c, gruppo, radice }) {
  const { eChiaveMessaggio } = mod["messaggi-automatici/catalogo"];

  // ═══ I FINTI ═══════════════════════════════════════════════════════════════
  //  Tutto passa da `globalThis.__wm`, rimesso a zero a ogni prova.
  const finti = [
    [
      /^@tanstack\/react-router$/,
      `export const createFileRoute = () => (opzioni) => ({ options: opzioni });`,
    ],
    [
      /^@supabase\/supabase-js$/,
      `export const createClient = () => ({ auth: { getUser: async () => ({ data: { user: { id: "utente-1" } }, error: null }) } });`,
    ],
    [
      /client\.server$/,
      `const q = (t) => ({
         select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: t === "whatsapp_settings" ? globalThis.__wm.settings : null }) }) }),
         insert: async (v) => { globalThis.__wm.scritte.push([t, "insert", v]); return { error: null }; },
         upsert: async (v) => { globalThis.__wm.scritte.push([t, "upsert", v]); return { error: null }; },
       });
       export const supabaseAdmin = { from: (t) => q(t) };`,
    ],
    [
      /manychat\/porta\.server$/,
      `export const leggiCanale = async () => { globalThis.__wm.canaleLetto++; return globalThis.__wm.canale; };
       export const nomeDelLead = async () => "";
       export const portePortaVere = () => { globalThis.__wm.porteUsate++; return {}; };
       export const segnaRispostoDalCrm = async () => {};`,
    ],
    [
      /messaggi-automatici\/registro\.server$/,
      `export const messaggioAcceso = async (chiave) => {
         globalThis.__wm.registroLetto.push(chiave);
         if (globalThis.__wm.registroLancia) throw new Error("db giù");
         return globalThis.__wm.acceso.has(chiave);
       };`,
    ],
  ];
  const rotta = await impacchetta(radice, "src/routes/api.whatsapp-send.ts", finti, "rotta");
  const salaFinta = [
    /^\.\/sala\.server$/,
    `export const daAvvisare = async () => globalThis.__wm.iscritti;
     export const segnaAvvisato = async (codice, contatto) => { globalThis.__wm.avvisati.push(contatto); };`,
  ];
  const promemoria = await impacchetta(
    radice,
    "src/webinar/promemoria.server.ts",
    [salaFinta],
    "promemoria",
  );

  const POST = rotta.modulo.Route.options.server.handlers.POST;
  const { mandaPromemoria } = promemoria.modulo;
  const fetchVero = globalThis.fetch;
  const erroreVero = console.error;
  //  La rotta scrive un codice nel log a ogni invio fermato: qui sarebbe solo rumore.
  console.error = () => {};

  /** Rimette il mondo a zero. `acceso`: le chiavi che il registro dà per accese. */
  const mondo = ({ acceso = [], canale = "cloud", registroLancia = false, iscritti = [] } = {}) => {
    globalThis.__wm = {
      acceso: new Set(acceso),
      registroLancia,
      registroLetto: [],
      canale: { canale, flussi: {} },
      canaleLetto: 0,
      porteUsate: 0,
      settings: { phone_number_id: "111", access_token: "token-inventato", mode: "live" },
      scritte: [],
      iscritti,
      avvisati: [],
      graph: [],
      corpiVersoLaRotta: [],
    };
    //  `fetch` finto: la rotta di invio (con il suo URL) è la rotta VERA; Graph risponde bene.
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.endsWith("/api/whatsapp-send")) {
        globalThis.__wm.corpiVersoLaRotta.push(JSON.parse(init.body));
        return POST({
          request: new Request(u, { method: "POST", headers: init.headers, body: init.body }),
        });
      }
      globalThis.__wm.graph.push(u);
      return Response.json({
        display_phone_number: "+39 000 0000",
        messages: [{ id: "wamid.inventato" }],
      });
    };
  };
  const chiama = async (corpo) => {
    const r = await POST({
      request: new Request("http://prova/api/whatsapp-send", {
        method: "POST",
        headers: { authorization: "Bearer inventato", "content-type": "application/json" },
        body: JSON.stringify({ to: "+390000000001", body: "ciao", ...corpo }),
      }),
    });
    return { stato: r.status, corpo: await r.json().catch(() => null) };
  };

  try {
    // ═══ LA ROTTA /api/whatsapp-send ══════════════════════════════════════════
    gruppo("WEBINAR · /api/whatsapp-send · «automatico» col messaggio spento");
    {
      mondo();
      let r = await chiama({ automatico: "webinar_in_diretta" });
      c("spento, canale Cloud: 409 «spento»", [409, "spento"], [r.stato, r.corpo?.category]);
      c(
        "e prima di tutto: non legge il canale, non chiama Graph, non scrive nello storico",
        [0, 0, 0, 0],
        [
          globalThis.__wm.canaleLetto,
          globalThis.__wm.graph.length,
          globalThis.__wm.scritte.length,
          globalThis.__wm.porteUsate,
        ],
      );
      c(
        "ha letto il registro UNA volta, con la chiave dichiarata",
        ["webinar_in_diretta"],
        globalThis.__wm.registroLetto,
      );
      c(
        "la risposta non porta numero né testo",
        false,
        JSON.stringify(r.corpo).includes("0000000001") || JSON.stringify(r.corpo).includes("ciao"),
      );

      mondo({ canale: "manychat" });
      r = await chiama({ automatico: "webinar_in_diretta" });
      c("spento, canale ManyChat: 409 «spento»", [409, "spento"], [r.stato, r.corpo?.category]);
      c(
        "senza leggere il canale né toccare la porta",
        [0, 0],
        [globalThis.__wm.canaleLetto, globalThis.__wm.porteUsate],
      );

      mondo({ registroLancia: true });
      r = await chiama({ automatico: "webinar_in_diretta" });
      c(
        "registro che lancia: spento (si ferma, non parte)",
        [409, 0, 0],
        [r.stato, globalThis.__wm.graph.length, globalThis.__wm.canaleLetto],
      );

      mondo({ acceso: ["prenota_chat"] });
      r = await chiama({ automatico: "webinar_in_diretta" });
      c(
        "acceso un altro messaggio: questo resta spento",
        [409, 0],
        [r.stato, globalThis.__wm.graph.length],
      );
    }

    gruppo("WEBINAR · /api/whatsapp-send · «automatico» col messaggio acceso");
    {
      mondo({ acceso: ["webinar_in_diretta"] });
      const r = await chiama({ automatico: "webinar_in_diretta" });
      c("acceso: parte (Cloud, Graph chiamato)", [200, true], [r.stato, r.corpo?.ok]);
      c(
        "il canale si legge una volta e Graph riceve il controllo del numero e l'invio",
        [1, 2],
        [globalThis.__wm.canaleLetto, globalThis.__wm.graph.length],
      );
    }

    gruppo("WEBINAR · /api/whatsapp-send · un campo può solo frenare, mai sbloccare");
    {
      //  Registro tutto spento: senza il campo (o con un campo che non vale) l'invio a mano parte.
      for (const [nome, corpo] of [
        ["campo assente", {}],
        ["«manuale»", { automatico: "manuale" }],
        ["una chiave che non è del catalogo", { automatico: "messaggio_inventato" }],
        ["un numero", { automatico: 42 }],
        ["null", { automatico: null }],
        ["una lista", { automatico: ["webinar_in_diretta"] }],
      ]) {
        mondo();
        const r = await chiama(corpo);
        c(
          `${nome}: invio a mano, parte`,
          [200, 0, 2],
          [r.stato, globalThis.__wm.registroLetto.length, globalThis.__wm.graph.length],
        );
      }
      //  La chiave valida spegne soltanto: con il registro acceso non cambia l'esito del resto.
      mondo({ acceso: ["webinar_in_diretta"] });
      const r = await chiama({ templateName: "modello_inventato", body: undefined });
      c("con un modello e senza campo: parte", 200, r.stato);
      c(
        "«manuale» non è una chiave del catalogo (così non si consulta il registro)",
        false,
        eChiaveMessaggio("manuale"),
      );
    }

    // ═══ mandaPromemoria ═════════════════════════════════════════════════════
    const iscritti = (n) =>
      Array.from({ length: n }, (_, i) => ({ contatto: `+39000000010${i}`, nome: `Prova${i}` }));
    const base = {
      codice: "sala-inventata",
      titolo: "Titolo inventato",
      link: "https://esempio.invalid/webinar/sala-inventata",
      origine: "http://prova",
      intestazioni: { authorization: "Bearer inventato" },
    };

    gruppo("WEBINAR · mandaPromemoria · il parametro «automatico»");
    {
      mondo({ iscritti: iscritti(3) });
      await mandaPromemoria({ ...base, tipo: "in-diretta" });
      c(
        "senza il parametro il corpo non porta «automatico» (testo)",
        [3, false],
        [
          globalThis.__wm.corpiVersoLaRotta.length,
          globalThis.__wm.corpiVersoLaRotta.some((b) => "automatico" in b),
        ],
      );

      mondo({ iscritti: iscritti(2) });
      await mandaPromemoria({ ...base, tipo: "in-diretta", template: "modello_inventato" });
      c(
        "senza il parametro, col modello: nemmeno",
        [2, false],
        [
          globalThis.__wm.corpiVersoLaRotta.length,
          globalThis.__wm.corpiVersoLaRotta.some((b) => "automatico" in b),
        ],
      );

      mondo({ iscritti: iscritti(2), acceso: ["webinar_in_diretta"] });
      await mandaPromemoria({ ...base, tipo: "in-diretta", automatico: "webinar_in_diretta" });
      c(
        "col parametro il corpo porta la chiave dichiarata (testo)",
        ["webinar_in_diretta", "webinar_in_diretta"],
        globalThis.__wm.corpiVersoLaRotta.map((b) => b.automatico),
      );

      mondo({ iscritti: iscritti(1), acceso: ["webinar_in_diretta"] });
      await mandaPromemoria({
        ...base,
        tipo: "in-diretta",
        automatico: "webinar_in_diretta",
        template: "modello_inventato",
      });
      c(
        "col parametro e col modello: la chiave c'è, il testo no",
        ["webinar_in_diretta", "modello_inventato", false],
        [
          globalThis.__wm.corpiVersoLaRotta[0].automatico,
          globalThis.__wm.corpiVersoLaRotta[0].templateName,
          "body" in globalThis.__wm.corpiVersoLaRotta[0],
        ],
      );
      c(
        "ogni chiave dichiarata è del catalogo",
        true,
        eChiaveMessaggio(globalThis.__wm.corpiVersoLaRotta[0].automatico),
      );
    }

    gruppo("WEBINAR · mandaPromemoria · spento non segna «avvisato»");
    {
      //  Registro spento, chiamata automatica (la strada vera: mandaPromemoria → rotta vera → 409).
      mondo({ iscritti: iscritti(7) });
      let e = await mandaPromemoria({
        ...base,
        tipo: "in-diretta",
        automatico: "webinar_in_diretta",
      });
      c(
        "spento: nessuno mandato, nessun fallito, tutti «spenti»",
        { mandati: 0, falliti: 0, fuoriFinestra: 0, spenti: 7 },
        e,
      );
      c(
        "nessuno segnato come avvisato e Graph mai chiamato",
        [0, 0],
        [globalThis.__wm.avvisati.length, globalThis.__wm.graph.length],
      );

      //  Riacceso: quelle stesse persone ricevono il messaggio (non erano state segnate).
      globalThis.__wm.acceso.add("webinar_in_diretta");
      e = await mandaPromemoria({ ...base, tipo: "in-diretta", automatico: "webinar_in_diretta" });
      c("riacceso: partono tutti", { mandati: 7, falliti: 0, fuoriFinestra: 0, spenti: 0 }, e);
      c("e adesso sì, segnati uno per uno", 7, globalThis.__wm.avvisati.length);

      //  Un 502 qualsiasi resta un fallimento; la finestra delle 24 ore resta se stessa.
      mondo({ iscritti: iscritti(3) });
      globalThis.fetch = async (_u, init) => {
        const n = JSON.parse(init.body).to;
        if (n.endsWith("0"))
          return Response.json(
            { error: "wa_api_error", category: "outside_24h_window" },
            { status: 502 },
          );
        if (n.endsWith("1"))
          return Response.json({ error: "wa_api_error", category: "unknown" }, { status: 502 });
        return Response.json({ error: "x", category: "spento" }, { status: 409 });
      };
      e = await mandaPromemoria({ ...base, tipo: "in-diretta", automatico: "webinar_in_diretta" });
      c(
        "ogni esito nel suo conto: finestra, fallito, spento",
        { mandati: 0, falliti: 1, fuoriFinestra: 1, spenti: 1 },
        e,
      );
      c("e nessuno segnato", 0, globalThis.__wm.avvisati.length);

      //  Un 409 senza la categoria «spento» NON è «spento»: è un fallimento (non lo si nasconde).
      mondo({ iscritti: iscritti(2) });
      globalThis.fetch = async () => Response.json({ error: "conflitto" }, { status: 409 });
      e = await mandaPromemoria({ ...base, tipo: "in-diretta", automatico: "webinar_in_diretta" });
      c(
        "409 senza «spento»: fallito, non spento",
        { mandati: 0, falliti: 2, fuoriFinestra: 0, spenti: 0 },
        e,
      );
    }

    gruppo("WEBINAR · il tasto a mano «in-diretta» non è mai bloccato");
    {
      //  Registro tutto spento: il tasto a mano (tipo in-diretta, SENZA parametro) manda a tutti.
      mondo({ iscritti: iscritti(4) });
      const e = await mandaPromemoria({ ...base, tipo: "in-diretta" });
      c(
        "registro spento, tasto a mano: partono tutti",
        { mandati: 4, falliti: 0, fuoriFinestra: 0, spenti: 0 },
        e,
      );
      c("e il registro non è stato nemmeno consultato", [], globalThis.__wm.registroLetto);

      const testo = readFileSync(join(radice, "src/routes/api.crm.webinar.ts"), "utf8");
      const codice = senzaCommenti(testo);
      const chiamate = chiamateMandaPromemoria(codice);
      c("in api.crm.webinar.ts ci sono due chiamate a mandaPromemoria", 2, chiamate.length);
      const [automatica, aMano] = chiamate;
      c(
        "la prima è l'avvio della diretta e porta «automatico»",
        [true, true],
        [
          /tipo: "in-diretta"/.test(automatica.testo),
          /automatico: "webinar_in_diretta"/.test(automatica.testo),
        ],
      );
      c(
        "la seconda è il tasto «promemoria» e NON porta «automatico»",
        [false, true],
        [
          /automatico/.test(aMano.testo),
          /azione === "promemoria"/.test(codice.slice(Math.max(0, aMano.da - 400), aMano.da)),
        ],
      );
      c(
        "e in tutto il file «automatico» compare una volta sola",
        1,
        (codice.match(/\bautomatico\b/g) ?? []).length,
      );
      c(
        "il tasto a mano passa sempre da «tipo» scelto da chi preme (anche in-diretta)",
        true,
        /tipo: b\.tipo === "in-diretta" \? "in-diretta" : "manca-poco"/.test(aMano.testo),
      );
    }

    // ═══ IL SORGENTE ═════════════════════════════════════════════════════════
    gruppo("WEBINAR · /api/whatsapp-send · il controllo sta PRIMA del ramo Cloud (sorgente)");
    {
      const codice = senzaCommenti(
        readFileSync(join(radice, "src/routes/api.whatsapp-send.ts"), "utf8"),
      );
      const posizione = (x) => codice.indexOf(x);
      c("il controllo c'è", true, posizione("messaggioAcceso(") > 0);
      c(
        "viene prima di leggiCanale",
        true,
        posizione("messaggioAcceso(") < posizione("leggiCanale(userId)"),
      );
      c(
        "viene prima del ramo ManyChat e di ogni chiamata a Graph",
        [true, true],
        [
          posizione("messaggioAcceso(") < posizione("inviaWhatsapp("),
          posizione("messaggioAcceso(") < posizione("graph.facebook.com"),
        ],
      );
      c(
        "è dopo i controlli di sessione e di corpo (401 e 400 restano com'erano)",
        true,
        posizione("invalid_session") < posizione("messaggioAcceso(") &&
          posizione("missing_params") < posizione("messaggioAcceso("),
      );
      c(
        "la chiave si valida con il catalogo",
        true,
        /eChiaveMessaggio\(body\.automatico\)/.test(codice),
      );
      c(
        "la stessa chiave va alla porta come «messaggio» (assente = manuale)",
        true,
        /messaggio: automatico \?\? "manuale"/.test(codice),
      );
      c(
        "risponde 409 con category «spento»",
        true,
        /category: "spento"/.test(codice) && /status: 409/.test(codice),
      );
      c(
        "un guasto del registro non fa partire",
        true,
        /catch\s*\{[^}]*acceso = false/.test(codice),
      );
    }
  } finally {
    globalThis.fetch = fetchVero;
    console.error = erroreVero;
    delete globalThis.__wm;
    rotta.pulisci();
    promemoria.pulisci();
  }
}
