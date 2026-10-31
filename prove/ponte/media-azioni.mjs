/** ── PROVE: I MEDIA DEL PONTE · AZIONI DEL SERVER (media-azioni*.ts) ──────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T3 (PIANO c.1, c.3, c2,
 *  d.3). La logica (`media-azioni.ts`) con porte finte: il database è un
 *  piccolo elenco in memoria che fa quello che promettono le funzioni SQL di
 *  (e) (solo `pronta`, `path` uguale), Storage un elenco di oggetti che può
 *  rompersi. Poi le TRE rotte vere (`api.crm.ponte-media-azione`,
 *  `hooks/media-scadute`, `api.public.ponte-whatsapp`) impacchettate con
 *  esbuild insieme alle porte vere (`media-azioni.server.ts`), con router,
 *  sessione e client Supabase finti: si guarda quali funzioni SQL e quale
 *  bucket vengono chiamati. L'SQL lo prova T1 (`prove/sql/…`).
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs` (`ponte/media-azioni`,
 *  `ponte/media-azioni-tipi`, `ponte/ingresso`). `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const UTENTE = "0b0b0b0b-1111-4222-8333-444444444444";
const ALTRO = "99999999-1111-4222-8333-444444444444";
const NUMERO = "393331234567";
const NUMERO2 = "393339876543";
const chiaveDi = (n, numero = NUMERO) => `bw:${numero}:3EB0A${String(n).padStart(4, "0")}`;
const nomeDi = (n) => `${String(n).padStart(8, "0")}-1111-4222-8333-444444444444`;
const pathDi = (n, utente = UTENTE, ext = "jpg") => `${utente}/${nomeDi(n)}.${ext}`;
const ACCESO = (auto) => JSON.stringify({ acceso: true, tettoGB: 5, ...(auto ? { auto } : {}) });

/** Il database e Storage finti, con le regole delle funzioni SQL di (e). */
function porteFinte(o = {}) {
  const righe = (o.righe ?? []).map((r) => ({ stato: "pronta", numero: NUMERO, ...r }));
  const oggetti = new Map((o.oggetti ?? righe.map((r) => r.path)).map((p) => [p, 1000]));
  const chiamate = [];
  const avvisi = [];
  const richieste = o.richieste ?? [];
  const guasto = (chi) => {
    if (o.rompi === chi)
      throw {
        code: o.codice ?? (chi === "rimuovi" ? "storage" : "XX000"),
        message: `errore con ${NUMERO} e Anna Finta`,
      };
  };
  const porte = {
    righe,
    oggetti,
    chiamate,
    avvisi,
    richieste,
    avviso: (codice, conteggi) => avvisi.push([codice, conteggi]),
    async utente() {
      chiamate.push(["utente"]);
      guasto("utente");
      return o.utente === undefined ? UTENTE : o.utente;
    },
    async interruttore() {
      chiamate.push(["interruttore"]);
      guasto("interruttore");
      return o.interruttore === undefined
        ? ACCESO(["foto", "audio", "video", "documento"])
        : o.interruttore;
    },
    async richiedi(u, chiave, timerS) {
      chiamate.push(["richiedi", u, chiave, timerS]);
      guasto("richiedi");
      return o.richiedi ?? { esito: "in_attesa" };
    },
    async prendi(u, max) {
      chiamate.push(["prendi", u, max]);
      guasto("prendi");
      return o.prendi ?? [];
    },
    async richiestaEsito(u, chiave, esito) {
      chiamate.push(["richiestaEsito", u, chiave, esito]);
      guasto("richiestaEsito");
    },
    async inAttesa(u) {
      chiamate.push(["inAttesa", u]);
      guasto("inAttesa");
      return o.inAttesa ?? 0;
    },
    async timer(u, chiave, s) {
      chiamate.push(["timer", u, chiave, s]);
      guasto("timer");
      return o.timer ?? { ok: true, stato: "pronta", scade_il: "2026-11-01T10:00:00Z" };
    },
    async daLiberare(u, numero, chiavi, limite) {
      chiamate.push(["daLiberare", u, numero, chiavi, limite]);
      guasto("daLiberare");
      return righe
        .filter(
          (r) =>
            r.stato === "pronta" &&
            (numero === null || r.numero === numero) &&
            (chiavi === null || chiavi.includes(r.chiave)),
        )
        .slice(0, limite)
        .map((r) => ({ chiave: r.chiave, path: r.path }));
    },
    async rimuovi(paths) {
      chiamate.push(["rimuovi", [...paths]]);
      guasto("rimuovi");
      if (
        o.rompiGruppo !== undefined &&
        chiamate.filter((x) => x[0] === "rimuovi").length === o.rompiGruppo
      )
        throw { code: "storage" };
      let byte = 0;
      for (const p of paths) {
        if (oggetti.delete(p)) byte += 1000;
      }
      return byte;
    },
    async liberato(u, voci) {
      chiamate.push(["liberato", u, voci.map((v) => ({ ...v }))]);
      guasto("liberato");
      let n = 0;
      for (const v of voci) {
        const r = righe.find((x) => x.chiave === v.chiave);
        if (r && r.stato === "pronta" && r.path === v.path) ((r.stato = "liberato"), n++);
      }
      return n;
    },
    async scadute(limite) {
      chiamate.push(["scadute", limite]);
      guasto("scadute");
      return righe
        .filter((r) => r.stato === "pronta" && r.scaduta)
        .slice(0, limite)
        .map((r) => ({ user_id: r.utente ?? UTENTE, chiave: r.chiave, path: r.path }));
    },
    async orfani(limite) {
      chiamate.push(["orfani", limite]);
      guasto("orfani");
      const conRiga = new Set(
        righe
          .filter((r) => r.stato === "pronta" || r.stato === "in_caricamento")
          .map((r) => r.path),
      );
      return [...(o.orfani ?? [...oggetti.keys()].filter((p) => !conRiga.has(p)))].slice(0, limite);
    },
    async pulizia() {
      chiamate.push(["pulizia"]);
      guasto("pulizia");
    },
  };
  return porte;
}

const nomiChiamate = (p) => p.chiamate.map((x) => x[0]);
const logPulito = (avvisi) =>
  avvisi.every(
    ([k, n]) =>
      /^[a-z_]+$/.test(k) &&
      (n === undefined ||
        Object.entries(n).every(([ch, v]) => /^[a-z_]+$/.test(ch) && typeof v === "number")),
  ) && !/3933|3EB0|Anna|supabase|token|\.jpg|bw:|0b0b0b0b|00000/.test(JSON.stringify(avvisi));

const senzaCommenti = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Il database e Storage finti per le rotte vere. */
const SUPABASE_FINTO = `
const st = () => globalThis.__mondoAzioni;
function tabella(nome) {
  const filtri = [];
  const q = {
    select: () => q,
    eq: (c, v) => (filtri.push([c, v]), q),
    maybeSingle: async () => {
      const r = (st().tab[nome] ?? []).filter((x) => filtri.every(([c, v]) => x[c] === v));
      return { data: r[0] ?? null, error: null };
    },
    then: (ok, ko) => {
      const r = (st().tab[nome] ?? []).filter((x) => filtri.every(([c, v]) => x[c] === v));
      return Promise.resolve({ data: r, error: null }).then(ok, ko);
    },
  };
  return q;
}
export const supabaseAdmin = {
  from: (t) => tabella(t),
  rpc: async (fn, a) => {
    st().rpc.push({ fn, args: JSON.parse(JSON.stringify(a)) });
    if (st().guasti[fn]) return { data: null, error: { code: st().guasti[fn], message: "errore con 393331234567 e Anna Finta" } };
    const r = st().risposte[fn];
    return { data: typeof r === "function" ? r(a) : (r ?? null), error: null };
  },
  storage: {
    from: (bucket) => ({
      remove: async (paths) => {
        st().rimossi.push({ bucket, paths: [...paths] });
        if (st().guasti.storage) return { data: null, error: { message: "errore con " + paths[0] } };
        return { data: paths.map((p) => ({ name: p, metadata: { size: 1000 } })), error: null };
      },
    }),
  },
};`;

async function caricaRotte(radice) {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-media-azioni-"));
  const finta = join(cartella, "supabase-finto.js");
  writeFileSync(finta, SUPABASE_FINTO);
  const file = join(cartella, "rotte.cjs");
  await build({
    stdin: {
      contents: [
        `export { Route as RottaAzione } from "@/routes/api.crm.ponte-media-azione";`,
        `export { Route as RottaHook } from "@/routes/hooks/media-scadute";`,
        `export { Route as RottaMac } from "@/routes/api.public.ponte-whatsapp";`,
        `export { porteMediaAzioni } from "@/crm/ponte/media-azioni.server";`,
      ].join("\n"),
      resolveDir: radice,
      loader: "ts",
    },
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
          b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
            path: "router",
            namespace: "finto",
          }));
          b.onResolve({ filter: /^@\/integrations\/supabase\/client\.server$/ }, () => ({
            path: finta,
          }));
          b.onResolve({ filter: /^\.\/api\.crm\.accesso$/ }, () => ({
            path: "accesso",
            namespace: "finto",
          }));
          //  La notifica push della rotta del ponte non c'entra: un finto che non fa niente.
          b.onResolve({ filter: /^@\/crm\/push\/invio\.server$/ }, () => ({
            path: "push",
            namespace: "finto",
          }));
          b.onLoad({ filter: /^router$/, namespace: "finto" }, () => ({
            contents: "export const createFileRoute = (path) => (options) => ({ path, options });",
            loader: "js",
          }));
          b.onLoad({ filter: /^accesso$/, namespace: "finto" }, () => ({
            contents:
              "export const guardiaCRM = (request, cors, permesso) => globalThis.__guardiaAzioni(request, cors, permesso);",
            loader: "js",
          }));
          b.onLoad({ filter: /^push$/, namespace: "finto" }, () => ({
            contents: "export const avvisaEntratePonte = async () => {};",
            loader: "js",
          }));
        },
      },
    ],
  });
  const richiedi = createRequire(import.meta.url);
  return {
    carica() {
      delete richiedi.cache[richiedi.resolve(file)];
      return richiedi(file);
    },
    chiudi: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

const mondo = (o = {}) => ({
  tab: {
    manychat_config: [{ id: 1, user_id: UTENTE }],
    app_config: [{ key: "ponte_immagini", value: ACCESO(["foto", "audio", "video", "documento"]) }],
    ponte_wa_media_richieste: [],
    ...(o.tab ?? {}),
  },
  rpc: [],
  rimossi: [],
  guasti: o.guasti ?? {},
  risposte: o.risposte ?? {},
});

/** Intercetta `console` mentre gira `fn`. */
async function conLog(fn) {
  const livelli = ["log", "info", "warn", "error", "debug"];
  const veri = Object.fromEntries(livelli.map((k) => [k, console[k]]));
  const log = [];
  for (const k of livelli)
    console[k] = (...a) =>
      log.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  try {
    return { esito: await fn(), log };
  } finally {
    for (const k of livelli) console[k] = veri[k];
  }
}

export async function proveMediaAzioni(mod, { c, gruppo, radice }) {
  const A = mod["ponte/media-azioni"];
  const T = mod["ponte/media-azioni-tipi"];
  const I = mod["ponte/ingresso"];
  const sorgente = (f) => readFileSync(join(radice, f), "utf8");

  /* ═══ 1. LE COSTANTI ═════════════════════════════════════════════════════ */
  gruppo("MEDIA · AZIONI · LE COSTANTI (T3)");
  c("i cinque timer ammessi", [300, 3600, 86400, 604800, 2592000], [...T.TIMER_AMMESSI]);
  c(
    "passo di liberazione 500, gruppi di Storage 100, scadute 200, orfani 100 ogni 30 minuti, prendi al più 5, media_v 2",
    [500, 100, 200, 100, 30, 5, 2],
    [
      T.PASSO_LIBERA,
      T.GRUPPO_REMOVE,
      T.SCADUTE_PER_GIRO,
      T.ORFANI_PER_GIRO,
      T.ORFANI_OGNI_MINUTI,
      T.MAX_PRENDI,
      T.MEDIA_V,
    ],
  );
  c(
    "gli esiti della richiesta (c2.3)",
    ["non_catalogato", "scaduta", "troppo_grande", "tipo", "tetto", "spenta", "errore"],
    [...T.ESITI_RICHIESTA],
  );

  /* ═══ 2. IL MAC: media_prendi e media_esito ══════════════════════════════ */
  gruppo("MEDIA · AZIONI · IL MAC: media_prendi e media_esito (c2.2, c2.3)");
  const mac = async (p, corpo) => {
    const r = await A.gestisciMacMedia(p, UTENTE, corpo);
    return { stato: r.status, json: await r.json(), cache: r.headers.get("cache-control") };
  };
  {
    const k1 = chiaveDi(1);
    const k2 = chiaveDi(2, NUMERO2);
    const p = porteFinte({ prendi: [k1, k2, "bw:12:x", "x"] });
    const r = await mac(p, { v: 1, tipo: "media_prendi", max: 3 });
    c(
      "prendi → 200 con le sole chiavi valide, nel formato del contratto",
      [200, { ok: true, richieste: [{ chiave: k1 }, { chiave: k2 }] }, "no-store"],
      [r.stato, r.json, r.cache],
    );
    c(
      "prendi chiede al database per l'utente del server, con il massimo del corpo",
      [["prendi", UTENTE, 3]],
      p.chiamate.filter((x) => x[0] === "prendi"),
    );
    const g = porteFinte();
    await mac(g, { v: 1, tipo: "media_prendi", max: 50 });
    c("prendi: il massimo non supera 5", 5, g.chiamate.find((x) => x[0] === "prendi")[2]);
    const casi = [{ max: 0 }, { max: -1 }, { max: 1.5 }, { max: "3" }, {}, { max: 3, v: 2 }];
    const st = [];
    for (const x of casi)
      st.push((await mac(porteFinte(), { v: 1, tipo: "media_prendi", ...x })).stato);
    c(
      "prendi con massimo 0, negativo, decimale, testo, assente o v sbagliata → 400",
      casi.map(() => 400),
      st,
    );
    const b = porteFinte({ rompi: "prendi", codice: "XX000" });
    const rb = await mac(b, { v: 1, tipo: "media_prendi", max: 3 });
    c(
      "prendi con database rotto → 500 database, senza il testo dell'errore",
      [500, { ok: false, errore: "database" }, false],
      [rb.stato, rb.json, /3933|Anna/.test(JSON.stringify(rb.json))],
    );
    const m = porteFinte({ rompi: "prendi", codice: "42883" });
    const rm = await mac(m, { v: 1, tipo: "media_prendi", max: 3 });
    c(
      "prendi con la funzione assente → 503 migrazione",
      [503, { ok: false, errore: "migrazione" }],
      [rb.stato === 500 && rm.stato, rm.json],
    );
    c(
      "prendi: nei log solo codici e numeri",
      true,
      logPulito(p.avvisi) && logPulito(b.avvisi) && logPulito(m.avvisi),
    );

    for (const esito of T.ESITI_RICHIESTA) {
      const e = porteFinte();
      const re = await mac(e, { v: 1, tipo: "media_esito", chiave: k1, esito });
      if (
        re.stato !== 200 ||
        re.json.ok !== true ||
        e.chiamate.find((x) => x[0] === "richiestaEsito")?.[3] !== esito
      )
        c(`esito ${esito}`, 200, re.stato);
    }
    const e = porteFinte();
    const re = await mac(e, { v: 1, tipo: "media_esito", chiave: k1, esito: "scaduta" });
    c(
      "esito scaduta → 200 {ok:true}, scritto per l'utente del server e per quella chiave",
      [200, { ok: true }, [["richiestaEsito", UTENTE, k1, "scaduta"]]],
      [re.stato, re.json, e.chiamate.filter((x) => x[0] === "richiestaEsito")],
    );
    const sbagliati = [
      { chiave: k1, esito: "boh" },
      { chiave: k1 },
      { esito: "errore" },
      { chiave: "bw:12:x", esito: "errore" },
      { chiave: 5, esito: "errore" },
      { chiave: k1, esito: "errore", v: 2 },
    ];
    const s2 = [];
    const tocca = [];
    for (const x of sbagliati) {
      const pe = porteFinte();
      s2.push((await mac(pe, { v: 1, tipo: "media_esito", ...x })).stato);
      tocca.push(pe.chiamate.length);
    }
    c(
      "esito sconosciuto, mancante o con chiave storta → 400 e il database non si tocca",
      [sbagliati.map(() => 400), sbagliati.map(() => 0)],
      [s2, tocca],
    );
    const pv = porteFinte({ rompi: "richiestaEsito", codice: "22023" });
    c(
      "esito rifiutato dall'SQL (22023) → 400, non 500",
      400,
      (await mac(pv, { v: 1, tipo: "media_esito", chiave: k1, esito: "errore" })).stato,
    );
    const pd = porteFinte({ rompi: "richiestaEsito", codice: "08006" });
    c(
      "esito con database rotto → 500 (il Mac ritenta: è idempotente)",
      500,
      (await mac(pd, { v: 1, tipo: "media_esito", chiave: k1, esito: "errore" })).stato,
    );
    c(
      "esito: nei log solo codici e numeri",
      true,
      logPulito(e.avvisi) && logPulito(pv.avvisi) && logPulito(pd.avvisi),
    );
  }

  /* ═══ 3. IL BATTITO ══════════════════════════════════════════════════════ */
  gruppo("MEDIA · AZIONI · I CAMPI NUOVI DEL BATTITO (D8, c2.2)");
  {
    const p = porteFinte({ inAttesa: 0 });
    c(
      "senza richieste: media_v 2 e media_auto, nessun media_richieste",
      { media_v: 2, media_auto: ["foto", "audio", "video", "documento"] },
      await A.campiBattitoMedia(p, UTENTE),
    );
    const q = porteFinte({ inAttesa: 3, interruttore: ACCESO(["foto", "audio"]) });
    c(
      "con 3 richieste: media_richieste 3 e le categorie automatiche del titolare",
      { media_v: 2, media_richieste: 3, media_auto: ["foto", "audio"] },
      await A.campiBattitoMedia(q, UTENTE),
    );
    const s = porteFinte({ interruttore: ACCESO() });
    c(
      "interruttore senza auto: solo foto",
      ["foto"],
      (await A.campiBattitoMedia(s, UTENTE)).media_auto,
    );
    const sp = porteFinte({ interruttore: null });
    c(
      "interruttore assente: nessun campo nuovo, risposta identica a quella di prima",
      {},
      await A.campiBattitoMedia(sp, UTENTE),
    );
    const sm = porteFinte({
      interruttore: JSON.stringify({ acceso: false, auto: ["foto", "audio"] }),
      inAttesa: 5,
    });
    c(
      "interruttore spento: nessun campo nuovo e la tabella delle richieste non si legge",
      [{}, false],
      [await A.campiBattitoMedia(sm, UTENTE), nomiChiamate(sm).includes("inAttesa")],
    );
    const r1 = porteFinte({ rompi: "inAttesa", codice: "42P01" });
    c(
      "tabella delle richieste assente: il battito non cade, niente media_richieste",
      { media_v: 2, media_auto: ["foto", "audio", "video", "documento"] },
      await A.campiBattitoMedia(r1, UTENTE),
    );
    const r2 = porteFinte({ rompi: "interruttore" });
    c(
      "interruttore illeggibile: nessun campo nuovo (il Mac resta alle sole foto)",
      {},
      await A.campiBattitoMedia(r2, UTENTE),
    );
  }

  /* ═══ 4. IL BROWSER: AZIONI ══════════════════════════════════════════════ */
  gruppo("MEDIA · AZIONI · IL BROWSER: richiedi, timer (c.3, c2.2)");
  const k1 = chiaveDi(1);
  const k2 = chiaveDi(2);
  const az = (p, corpo, o = {}) =>
    A.gestisciAzione(p, {
      adminUserId: "adminUserId" in o ? o.adminUserId : UTENTE,
      corpo,
      puoImpostazioni: o.imp ?? false,
    });
  {
    const p = porteFinte();
    const r = await az(p, { azione: "richiedi", chiave: k1, timer: 3600 });
    c(
      "richiedi → in_attesa, con il timer in secondi",
      [200, { ok: true, esito: "in_attesa" }, [["richiedi", UTENTE, k1, 3600]]],
      [r.stato, r.corpo, p.chiamate.filter((x) => x[0] === "richiedi")],
    );
    const q = porteFinte();
    await az(q, { azione: "richiedi", chiave: k1 });
    const q2 = porteFinte();
    await az(q2, { azione: "richiedi", chiave: k1, timer: "tieni" });
    c(
      "richiedi senza timer, o con «tieni»: tieni sempre (null)",
      [null, null],
      [
        q.chiamate.find((x) => x[0] === "richiedi")[3],
        q2.chiamate.find((x) => x[0] === "richiedi")[3],
      ],
    );
    const g = porteFinte({ richiedi: { esito: "gia_pronta" } });
    c(
      "richiedi su un file già pronto → gia_pronta",
      [200, { ok: true, esito: "gia_pronta" }],
      await az(g, { azione: "richiedi", chiave: k1 }).then((x) => [x.stato, x.corpo]),
    );
    const n = porteFinte({ richiedi: { esito: "non_trovata" } });
    c(
      "richiedi per una chiave che non è nei messaggi → 404 non_trovata",
      [404, { ok: false, motivo: "non_trovata" }],
      await az(n, { azione: "richiedi", chiave: k1 }).then((x) => [x.stato, x.corpo]),
    );
    const sp = porteFinte({ interruttore: JSON.stringify({ acceso: false }) });
    const rs = await az(sp, { azione: "richiedi", chiave: k1 });
    c(
      "richiedi con l'interruttore spento → 409 spenta, la richiesta non nasce",
      [409, { ok: false, motivo: "spenta" }, false],
      [rs.stato, rs.corpo, nomiChiamate(sp).includes("richiedi")],
    );
    const sr = porteFinte({ interruttore: null });
    c(
      "richiedi con l'interruttore assente = spento",
      409,
      (await az(sr, { azione: "richiedi", chiave: k1 })).stato,
    );
    c(
      "richiedi: chiunque veda la chat (anche senza «impostazioni»)",
      200,
      (await az(porteFinte(), { azione: "richiedi", chiave: k1 }, { imp: false })).stato,
    );
    const md = porteFinte({ rompi: "richiedi", codice: "PGRST202" });
    c(
      "richiedi con la migrazione mancante → 503 migrazione",
      [503, { ok: false, motivo: "migrazione" }],
      await az(md, { azione: "richiedi", chiave: k1 }).then((x) => [x.stato, x.corpo]),
    );
    const db = porteFinte({ rompi: "richiedi", codice: "XX000" });
    const rd = await az(db, { azione: "richiedi", chiave: k1 });
    c(
      "richiedi con il database rotto → 500 database, senza il testo dell'errore",
      [500, { ok: false, motivo: "database" }, false],
      [rd.stato, rd.corpo, /3933|Anna/.test(JSON.stringify(rd.corpo))],
    );
    c(
      "richiedi: nei log solo codici e numeri",
      true,
      logPulito(p.avvisi) && logPulito(sp.avvisi) && logPulito(md.avvisi) && logPulito(db.avvisi),
    );
  }
  {
    const volte = [];
    for (const t of [300, 3600, 86400, 604800, 2592000]) {
      const p = porteFinte();
      const r = await az(p, { azione: "timer", chiave: k1, timer: t });
      volte.push([r.stato, r.corpo.ok, p.chiamate.find((x) => x[0] === "timer")[3]]);
    }
    c(
      "timer: i cinque valori passano e arrivano all'SQL in secondi",
      [300, 3600, 86400, 604800, 2592000].map((t) => [200, true, t]),
      volte,
    );
    const p = porteFinte();
    const r = await az(p, { azione: "timer", chiave: k1, timer: "tieni" });
    c(
      "timer «tieni» → null all'SQL, risposta con scade_il",
      [200, { ok: true, stato: "pronta", scade_il: "2026-11-01T10:00:00Z" }, null],
      [r.stato, r.corpo, p.chiamate.find((x) => x[0] === "timer")[3]],
    );
    const rq = porteFinte({ timer: { ok: true, stato: "richiesta" } });
    c(
      "timer su un media ancora richiesto → stato richiesta",
      [200, { ok: true, stato: "richiesta" }],
      await az(rq, { azione: "timer", chiave: k1, timer: 300 }).then((x) => [x.stato, x.corpo]),
    );
    const as = porteFinte({ timer: { ok: false, stato: "assente" } });
    c(
      "timer su un media liberato o inesistente → 404 non_trovata",
      [404, { ok: false, motivo: "non_trovata" }],
      await az(as, { azione: "timer", chiave: k1, timer: 300 }).then((x) => [x.stato, x.corpo]),
    );
    const strani = [60, 0, -1, 301, "300", "1h", null, undefined, true, 3600.5];
    const stati = [];
    const toc = [];
    for (const t of strani) {
      const px = porteFinte();
      stati.push(
        (await az(px, { azione: "timer", chiave: k1, ...(t === undefined ? {} : { timer: t }) }))
          .stato,
      );
      toc.push(nomiChiamate(px).includes("timer"));
    }
    c(
      "timer fuori dai cinque valori (o assente) → 400 e l'SQL non si tocca",
      [strani.map(() => 400), strani.map(() => false)],
      [stati, toc],
    );
    c(
      "timer: chiunque veda la chat",
      200,
      (await az(porteFinte(), { azione: "timer", chiave: k1, timer: 300 })).stato,
    );
    c("timer: nei log solo codici e numeri", true, logPulito(p.avvisi) && logPulito(as.avvisi));
  }

  /* ═══ 5. IL BROWSER: CHI E CHE COSA ══════════════════════════════════════ */
  gruppo("MEDIA · AZIONI · IL BROWSER: installazione, corpo, permesso (c.3, D11)");
  {
    const casi = [
      ["utente del database diverso dalla sessione", porteFinte({ utente: ALTRO }), UTENTE],
      ["installazione non configurata", porteFinte({ utente: null }), UTENTE],
      ["sessione senza installazione", porteFinte(), ""],
      ["sessione senza installazione (undefined)", porteFinte(), undefined],
    ];
    for (const [nome, p, admin] of casi) {
      const r = await az(p, { azione: "libera", tutto: true }, { adminUserId: admin, imp: true });
      c(
        `403 non_autorizzato: ${nome}; il database non si tocca`,
        [403, { ok: false, motivo: "non_autorizzato" }, []],
        [r.stato, r.corpo, p.chiamate.filter((x) => x[0] !== "utente")],
      );
    }
    const nonValidi = [
      null,
      [],
      "x",
      {},
      { azione: "boh" },
      { azione: "richiedi" },
      { azione: "richiedi", chiave: "bw:12:x" },
      { azione: "richiedi", chiave: 5 },
      { azione: "timer", timer: 300 },
      { azione: "libera" },
      { azione: "libera", chiavi: [] },
      { azione: "libera", chiavi: "x" },
      { azione: "libera", chiavi: [k1, "bw:12:x"] },
      { azione: "libera", chiavi: Array.from({ length: 201 }, (_, i) => chiaveDi(i)) },
      { azione: "libera", numero: "123" },
      { azione: "libera", numero: "+393331234567" },
      { azione: "libera", numero: 393331234567 },
      { azione: "libera", tutto: false },
      { azione: "libera", tutto: "true" },
      { azione: "libera", tutto: 1 },
      { azione: "libera", chiave: k1, tutto: true },
      { azione: "libera", chiave: k1, numero: NUMERO },
      { azione: "libera", chiavi: [k1], numero: NUMERO },
      { azione: "libera", numero: NUMERO, tutto: true },
    ];
    const stati = [];
    const toccati = [];
    for (const x of nonValidi) {
      const p = porteFinte();
      const r = await az(p, x, { imp: true });
      stati.push(r.stato);
      toccati.push(p.chiamate.filter((y) => y[0] !== "utente").length);
    }
    c(
      "corpo non valido (azione, chiave, chiavi vuote o > 200, numero, tutto non vero, due selezioni insieme, `libera` vuota) → 400 e MAI «libera tutto» per sbaglio",
      [nonValidi.map(() => 400), nonValidi.map(() => 0)],
      [stati, toccati],
    );

    //  Tre prove, una per ciascuna selezione di massa: senza «impostazioni» → 403.
    const sel = {
      chiavi: { azione: "libera", chiavi: [k1, k2] },
      numero: { azione: "libera", numero: NUMERO },
      tutto: { azione: "libera", tutto: true },
    };
    for (const [nome, corpo] of Object.entries(sel)) {
      const p = porteFinte({
        righe: [
          { chiave: k1, path: pathDi(1) },
          { chiave: k2, path: pathDi(2) },
        ],
      });
      const r = await az(p, corpo, { imp: false });
      c(
        `libera con «${nome}» senza il permesso «impostazioni» → 403, niente letto, niente tolto da Storage`,
        [403, false, [], 2],
        [
          r.stato,
          r.corpo.ok,
          p.chiamate.filter((y) => ["daLiberare", "rimuovi", "liberato"].includes(y[0])),
          p.oggetti.size,
        ],
      );
      const q = porteFinte({
        righe: [
          { chiave: k1, path: pathDi(1) },
          { chiave: k2, path: pathDi(2) },
        ],
      });
      const rq = await az(q, corpo, { imp: true });
      c(`libera con «${nome}» CON «impostazioni» → 200`, [200, true], [rq.stato, rq.corpo.ok]);
    }
    const u = porteFinte({ righe: [{ chiave: k1, path: pathDi(1) }] });
    const ru = await az(u, { azione: "libera", chiave: k1 }, { imp: false });
    c(
      "libera con UNA chiave: chiunque veda la chat (senza «impostazioni»)",
      [200, { ok: true, liberati: 1, byte: 1000, restano: 0, non_riusciti: 0 }],
      [ru.stato, ru.corpo],
    );
    c(
      "libera con una chiave: all'SQL arriva solo quella chiave (mai numero nullo + chiavi nulle = tutto)",
      [["daLiberare", UTENTE, null, [k1], 500]],
      u.chiamate.filter((y) => y[0] === "daLiberare"),
    );
    const t403 = porteFinte();
    const rt = await az(t403, { azione: "richiedi", chiave: k1 }, { imp: false });
    c("richiedi, timer e libera di una chiave non chiedono «impostazioni»", 200, rt.stato);
  }

  /* ═══ 6. LIBERARE ════════════════════════════════════════════════════════ */
  gruppo("MEDIA · AZIONI · LIBERARE: passi, Storage che fallisce, regex del percorso (d.3, c.1)");
  {
    //  Passi da 500: 1.200 file → 3 chiamate, restano 700 → 200 → 0.
    const righe = Array.from({ length: 1200 }, (_, i) => ({
      chiave: chiaveDi(i),
      path: pathDi(i),
    }));
    const p = porteFinte({ righe });
    const passi = [];
    for (let i = 0; i < 6; i++) {
      const r = await az(p, { azione: "libera", tutto: true }, { imp: true });
      passi.push([r.stato, r.corpo.liberati, r.corpo.restano, r.corpo.non_riusciti, r.corpo.byte]);
      if (r.corpo.restano === 0) break;
    }
    c(
      "tutto: passi da 500 (restano 500, poi 200, poi 0), ogni passo 1000 byte per file",
      [
        [200, 500, 500, 0, 500000],
        [200, 500, 200, 0, 500000],
        [200, 200, 0, 0, 200000],
      ],
      passi,
    );
    c(
      "tutto: alla fine tutte le righe liberate e tutti gli oggetti tolti",
      [1200, 0],
      [p.righe.filter((r) => r.stato === "liberato").length, p.oggetti.size],
    );
    c(
      "ogni daLiberare chiede al più 500; ogni rimozione al più 100 percorsi",
      [true, true],
      [
        p.chiamate.filter((x) => x[0] === "daLiberare").every((x) => x[4] <= 500),
        p.chiamate.filter((x) => x[0] === "rimuovi").every((x) => x[1].length <= 100),
      ],
    );
    const primo = porteFinte({ righe: righe.slice(0, 500) });
    await az(primo, { azione: "libera", tutto: true }, { imp: true });
    c(
      "500 file = 5 rimozioni da 100 e `liberato` con le voci {chiave, path} lette dal database",
      [5, true],
      [
        primo.chiamate.filter((x) => x[0] === "rimuovi").length,
        primo.chiamate
          .filter((x) => x[0] === "liberato")
          .flatMap((x) => x[2])
          .every((v) => Object.keys(v).sort().join() === "chiave,path"),
      ],
    );
    c(
      "`liberato` arriva DOPO la rimozione dello stesso gruppo",
      true,
      (() => {
        const n = nomiChiamate(primo);
        return n.indexOf("rimuovi") < n.indexOf("liberato");
      })(),
    );

    //  Per numero: solo quelle di quel cliente.
    const due = porteFinte({
      righe: [
        { chiave: chiaveDi(1), path: pathDi(1) },
        { chiave: chiaveDi(2, NUMERO2), path: pathDi(2), numero: NUMERO2 },
      ],
    });
    const rn = await az(due, { azione: "libera", numero: NUMERO }, { imp: true });
    c(
      "libera per numero: solo i file di quel cliente",
      [1, ["pronta", "pronta"].length && "liberato", "pronta"],
      [rn.corpo.liberati, due.righe[0].stato, due.righe[1].stato],
    );
    c(
      "libera per numero: all'SQL arriva il numero e nessuna lista di chiavi",
      [["daLiberare", UTENTE, NUMERO, null, 500]],
      due.chiamate.filter((x) => x[0] === "daLiberare"),
    );
    const tt = porteFinte({ righe: [{ chiave: chiaveDi(1), path: pathDi(1) }] });
    await az(tt, { azione: "libera", tutto: true }, { imp: true });
    c(
      "libera tutto: numero e chiavi nulli, solo per l'utente del server",
      [["daLiberare", UTENTE, null, null, 500]],
      tt.chiamate.filter((x) => x[0] === "daLiberare"),
    );
    const nulla = porteFinte();
    c(
      "libera con niente da liberare → 200 con tutti zeri",
      [200, { ok: true, liberati: 0, byte: 0, restano: 0, non_riusciti: 0 }],
      await az(nulla, { azione: "libera", tutto: true }, { imp: true }).then((x) => [
        x.stato,
        x.corpo,
      ]),
    );

    //  Storage che fallisce: la riga NON passa a liberato.
    const f = porteFinte({
      righe: [
        { chiave: k1, path: pathDi(1) },
        { chiave: k2, path: pathDi(2) },
      ],
      rompi: "rimuovi",
    });
    const rf = await az(f, { azione: "libera", chiavi: [k1, k2] }, { imp: true });
    c(
      "Storage che fallisce → 503 storage, righe ancora pronte, `liberato` mai chiamato, contati i non riusciti",
      [503, "storage", 2, 0, ["pronta", "pronta"], false],
      [
        rf.stato,
        rf.corpo.motivo,
        rf.corpo.non_riusciti,
        rf.corpo.liberati,
        f.righe.map((r) => r.stato),
        nomiChiamate(f).includes("liberato"),
      ],
    );
    c(
      "Storage che fallisce: nel corpo non c'è il testo dell'errore e nel log solo codici",
      [false, true],
      [/3933|Anna/.test(JSON.stringify(rf.corpo)), logPulito(f.avvisi)],
    );
    const mezzo = porteFinte({
      righe: Array.from({ length: 250 }, (_, i) => ({ chiave: chiaveDi(i), path: pathDi(i) })),
      rompiGruppo: 2,
    });
    const rm = await az(mezzo, { azione: "libera", tutto: true }, { imp: true });
    c(
      "un gruppo su tre fallisce: gli altri due si liberano, il fallito resta pronto e si conta",
      [200, 150, 100, 100],
      [
        rm.stato,
        rm.corpo.liberati,
        rm.corpo.non_riusciti,
        mezzo.righe.filter((r) => r.stato === "pronta").length,
      ],
    );
    c(
      "un gruppo fallito non conta tra i «restano» (il pannello non gira a vuoto)",
      0,
      rm.corpo.restano,
    );
    const lf = porteFinte({
      righe: [{ chiave: k1, path: pathDi(1) }],
      rompi: "liberato",
      codice: "XX000",
    });
    const rl = await az(lf, { azione: "libera", chiave: k1 }, { imp: true });
    c(
      "`liberato` che fallisce dopo la rimozione: contato come non riuscito (la riga resta pronta e si ritenta)",
      [503, 1, "pronta"],
      [rl.stato, rl.corpo.non_riusciti, lf.righe[0].stato],
    );
    const dbr = porteFinte({ rompi: "daLiberare", codice: "XX000" });
    c(
      "lettura da liberare che fallisce → 500 database",
      [500, "database"],
      await az(dbr, { azione: "libera", tutto: true }, { imp: true }).then((x) => [
        x.stato,
        x.corpo.motivo,
      ]),
    );
    const mig = porteFinte({ rompi: "daLiberare", codice: "42883" });
    c(
      "funzione da liberare assente → 503 migrazione",
      [503, "migrazione"],
      await az(mig, { azione: "libera", tutto: true }, { imp: true }).then((x) => [
        x.stato,
        x.corpo.motivo,
      ]),
    );

    //  Il percorso arriva SOLO dal database, e prima di ogni rimozione si controlla.
    const cattivi = [
      `${UTENTE}/../${nomeDi(1)}.jpg`,
      `${ALTRO}/${nomeDi(2)}.jpg`,
      `altro-bucket/${nomeDi(3)}.jpg`,
      `${UTENTE}/${nomeDi(4)}.JPG`,
      `${UTENTE}/${nomeDi(5)}.jpg/..`,
      `/${UTENTE}/${nomeDi(6)}.jpg`,
      `${UTENTE}/cartella/${nomeDi(7)}.jpg`,
      `${UTENTE}/${nomeDi(8)}`,
      `${UTENTE}/*`,
      `${UTENTE}/`,
      "",
      null,
      42,
    ];
    const bu = porteFinte({ righe: [{ chiave: k1, path: pathDi(1) }], oggetti: [pathDi(1)] });
    const orig = bu.daLiberare;
    bu.daLiberare = async (...a) => [
      ...(await orig(...a)),
      ...cattivi.map((path, i) => ({ chiave: chiaveDi(900 + i), path })),
    ];
    const rb = await az(bu, { azione: "libera", tutto: true }, { imp: true });
    const rimossi = bu.chiamate.filter((x) => x[0] === "rimuovi").flatMap((x) => x[1]);
    c(
      "percorsi storti dal database (.., altra cartella, maiuscole, sottocartelle, jolly, vuoto, non testo): mai passati a Storage",
      [[pathDi(1)], cattivi.length, 1],
      [rimossi, rb.corpo.non_riusciti, rb.corpo.liberati],
    );
    const chiaveStorta = porteFinte({ righe: [] });
    chiaveStorta.daLiberare = async () => [
      { chiave: "x", path: pathDi(1) },
      { chiave: "bw:1:2", path: pathDi(2) },
    ];
    await az(chiaveStorta, { azione: "libera", tutto: true }, { imp: true });
    c(
      "una chiave storta dal database non arriva a Storage",
      [],
      chiaveStorta.chiamate.filter((x) => x[0] === "rimuovi"),
    );
  }

  /* ═══ 7. L'HOOK: I MEDIA SCADUTI E GLI ORFANI ════════════════════════════ */
  gruppo("MEDIA · AZIONI · L'HOOK DEI MEDIA SCADUTI E GLI ORFANI (c.1)");
  {
    const adesso = (min) => new Date(Date.UTC(2026, 10, 1, 10, min, 7));
    const righe = Array.from({ length: 250 }, (_, i) => ({
      chiave: chiaveDi(i),
      path: pathDi(i),
      scaduta: true,
    }));
    righe.push({ chiave: chiaveDi(900), path: pathDi(900) });
    const p = porteFinte({ righe });
    const g1 = await A.giroScadute(p, adesso(7));
    c(
      "scadute(200): libera 200, ne restano 50 scadute per il minuto dopo, il non scaduto non si tocca",
      [{ ok: true, liberati: 200, orfani: 0, non_riusciti: 0 }, 50, "pronta"],
      [
        g1,
        p.righe.filter((r) => r.scaduta && r.stato === "pronta").length,
        p.righe.find((r) => r.chiave === chiaveDi(900)).stato,
      ],
    );
    c(
      "si chiede scadute con 200, si rimuove a gruppi da 100",
      [[200], [100, 100]],
      [
        p.chiamate.filter((x) => x[0] === "scadute").map((x) => x[1]),
        p.chiamate.filter((x) => x[0] === "rimuovi").map((x) => x[1].length),
      ],
    );
    const g2 = await A.giroScadute(p, adesso(8));
    const g3 = await A.giroScadute(p, adesso(9));
    c(
      "il minuto dopo libera i 50 restanti; il successivo non trova niente (idempotente)",
      [50, 0],
      [g2.liberati, g3.liberati],
    );
    const r4 = await A.giroScadute(p, adesso(11));
    c(
      "ripetuto sullo stesso stato: nessuna rimozione né segnatura in più (3 rimozioni in tutto)",
      [0, 3],
      [r4.liberati, p.chiamate.filter((x) => x[0] === "rimuovi").length],
    );
    c(
      "minuto non multiplo di 30: né orfani né pulizia",
      [false, false],
      [nomiChiamate(p).includes("orfani"), nomiChiamate(p).includes("pulizia")],
    );
    c("nei log solo codici e numeri", true, logPulito(p.avvisi));

    //  La riga già riscritta da «Mostra» (percorso nuovo) non cambia.
    const ms = porteFinte({ righe: [{ chiave: k1, path: pathDi(1), scaduta: true }] });
    const orig = ms.scadute;
    ms.scadute = async (l) => {
      const letto = await orig(l);
      //  Fra scadute e liberato, «Mostra»: la riga torna in_caricamento con un percorso nuovo.
      ms.righe[0].stato = "in_caricamento";
      ms.righe[0].path = pathDi(77);
      return letto;
    };
    const gm = await A.giroScadute(ms, adesso(5));
    c(
      "scambio Mostra/liberato: la riga rimessa in coda non viene toccata dal cron",
      ["in_caricamento", pathDi(77), 0],
      [ms.righe[0].stato, ms.righe[0].path, gm.liberati],
    );

    //  Storage rotto: la riga resta pronta, nessuna segnatura.
    const sr = porteFinte({
      righe: [{ chiave: k1, path: pathDi(1), scaduta: true }],
      rompi: "rimuovi",
    });
    const gs = await A.giroScadute(sr, adesso(1));
    c(
      "Storage rotto: riga ancora pronta, `liberato` mai chiamato, contato, l'hook non cade",
      [{ ok: true, liberati: 0, orfani: 0, non_riusciti: 1 }, "pronta", false],
      [gs, sr.righe[0].stato, nomiChiamate(sr).includes("liberato")],
    );
    const dr = porteFinte({ rompi: "scadute", codice: "XX000" });
    const gd = await A.giroScadute(dr, adesso(1));
    c(
      "database rotto sulle scadute: ok falso, nel log un codice",
      [false, true],
      [gd.ok, logPulito(dr.avvisi) && dr.avvisi.some(([k]) => k === "media_database")],
    );
    const mg = porteFinte({ rompi: "scadute", codice: "42883" });
    c(
      "funzione assente (cron acceso prima delle migrazioni): ok falso, codice migrazione",
      [false, true],
      [(await A.giroScadute(mg, adesso(1))).ok, mg.avvisi.some(([k]) => k === "media_migrazione")],
    );

    //  Altro utente e percorso di un altro: non si rimuove.
    const al = porteFinte({ righe: [{ chiave: k1, path: pathDi(1, ALTRO), scaduta: true }] });
    const ga = await A.giroScadute(al, adesso(1));
    c(
      "una scaduta il cui percorso non sta nella cartella del suo utente: mai rimossa",
      [[], 1],
      [al.chiamate.filter((x) => x[0] === "rimuovi"), ga.non_riusciti],
    );
    const mx = porteFinte({
      righe: [{ chiave: k1, path: pathDi(1, ALTRO), scaduta: true, utente: ALTRO }],
    });
    await A.giroScadute(mx, adesso(1));
    c(
      "scadute di un utente: `liberato` per QUELL'utente (la sua cartella), non per un altro",
      [["liberato", ALTRO]],
      mx.chiamate.filter((x) => x[0] === "liberato").map((x) => [x[0], x[1]]),
    );

    //  Gli orfani: si decide dal minuto.
    const orf = [pathDi(500), pathDi(501), "altro/non-valido.jpg", `${UTENTE}/../x.jpg`, "x"];
    const o30 = porteFinte({ orfani: orf, oggetti: [pathDi(500), pathDi(501)] });
    const go = await A.giroScadute(o30, adesso(30));
    c(
      "minuto 30: pulizia, poi orfani; si tolgono i soli percorsi validi",
      [true, true, [pathDi(500), pathDi(501)], 2],
      [
        nomiChiamate(o30).includes("pulizia"),
        nomiChiamate(o30).indexOf("pulizia") < nomiChiamate(o30).indexOf("orfani"),
        o30.chiamate.filter((x) => x[0] === "rimuovi").flatMap((x) => x[1]),
        go.orfani,
      ],
    );
    c(
      "gli orfani si chiedono 100 alla volta",
      [[100]],
      [o30.chiamate.filter((x) => x[0] === "orfani").map((x) => x[1])],
    );
    const o0 = porteFinte({ orfani: orf });
    await A.giroScadute(o0, adesso(0));
    const o15 = porteFinte({ orfani: orf });
    await A.giroScadute(o15, adesso(15));
    const o31 = porteFinte({ orfani: orf });
    await A.giroScadute(o31, adesso(31));
    const o60 = porteFinte({ orfani: orf });
    await A.giroScadute(o60, new Date(Date.UTC(2026, 10, 1, 11, 0, 59)));
    c(
      "orfani solo ai minuti 0 e 30 (l'hook non ha memoria: decide dall'ora)",
      [true, false, false, true],
      [o0, o15, o31, o60].map((x) => nomiChiamate(x).includes("orfani")),
    );
    const grandi = porteFinte({
      orfani: Array.from({ length: 100 }, (_, i) => pathDi(i)),
      oggetti: Array.from({ length: 100 }, (_, i) => pathDi(i)),
    });
    await A.giroScadute(grandi, adesso(30));
    c(
      "100 orfani = un solo gruppo da 100",
      [100],
      grandi.chiamate.filter((x) => x[0] === "rimuovi").map((x) => x[1].length),
    );
    const oRotto = porteFinte({ orfani: [pathDi(1)], oggetti: [pathDi(1)], rompi: "rimuovi" });
    const gr = await A.giroScadute(oRotto, adesso(30));
    c(
      "Storage rotto sugli orfani: contato come non riuscito, l'hook non cade",
      [0, 1],
      [gr.orfani, gr.non_riusciti],
    );
    const pm = porteFinte({
      rompi: "pulizia",
      codice: "42883",
      orfani: [pathDi(1)],
      oggetti: [pathDi(1)],
    });
    const gp = await A.giroScadute(pm, adesso(30));
    c(
      "pulizia non ancora in database (funzione assente): gli orfani girano lo stesso, ok resta vero",
      [true, 1],
      [gp.ok, gp.orfani],
    );
    const pe = porteFinte({
      rompi: "pulizia",
      codice: "XX000",
      orfani: [pathDi(1)],
      oggetti: [pathDi(1)],
    });
    const ge = await A.giroScadute(pe, adesso(30));
    c(
      "pulizia che fallisce per altro: ok falso, gli orfani girano lo stesso",
      [false, 1],
      [ge.ok, ge.orfani],
    );
    const ore = porteFinte({
      rompi: "orfani",
      codice: "XX000",
      righe: [{ chiave: k1, path: pathDi(1), scaduta: true }],
    });
    const gq = await A.giroScadute(ore, adesso(30));
    c("orfani che falliscono non fermano le scadute già fatte", [false, 1], [gq.ok, gq.liberati]);
  }

  /* ═══ 8. L'INGRESSO (ingresso.ts) ════════════════════════════════════════ */
  // Le prove dell'ingresso con le porte nuove stanno in `ingresso.mjs` (righe nuove).

  /* ═══ 9. LE ROTTE VERE E LE PORTE VERE ═══════════════════════════════════ */
  gruppo("MEDIA · AZIONI · LE ROTTE VERE E LE PORTE VERE (T3)");
  const srv = senzaCommenti(sorgente("src/crm/ponte/media-azioni.server.ts"));
  const rotta = senzaCommenti(sorgente("src/routes/api.crm.ponte-media-azione.ts"));
  const hook = senzaCommenti(sorgente("src/routes/hooks/media-scadute.ts"));
  const logica = senzaCommenti(sorgente("src/crm/ponte/media-azioni.ts"));
  const tipi = senzaCommenti(sorgente("src/crm/ponte/media-azioni-tipi.ts"));
  const rottaMac = senzaCommenti(sorgente("src/routes/api.public.ponte-whatsapp.ts"));

  c(
    "Storage: solo il bucket costante BUCKET_MEDIA, nessun nome di bucket scritto a mano",
    [true, 0, true],
    [
      /storage\s*\.from\(BUCKET_MEDIA\)/.test(srv),
      (srv.match(/storage\s*\.from\(/g) ?? []).length -
        (srv.match(/storage\s*\.from\(BUCKET_MEDIA\)/g) ?? []).length,
      !/ponte-media["']/.test(srv),
    ],
  );
  c(
    "Storage: un solo `remove` in tutta la logica server, nessuna lista di bucket, nessun emptyBucket/deleteBucket",
    [1, false],
    [
      (srv.match(/\.remove\(/g) ?? []).length,
      /emptyBucket|deleteBucket|listBuckets|\.list\(/.test(srv),
    ],
  );
  c(
    "la logica non scrive mai in tabella (solo funzioni SQL) e non usa DELETE",
    [false, false],
    [/\.(insert|update|upsert|delete)\(/.test(srv + logica), /\bDELETE\b/i.test(srv + logica)],
  );
  c(
    "percorso: la regex PERCORSO_MEDIA controlla ogni percorso prima del `remove`",
    [true, true],
    [/PERCORSO_MEDIA\.test/.test(logica), /startsWith\(`\$\{/.test(logica)],
  );
  c(
    "nei sorgenti nessun console fuori dai codici e nessun `message` dell'errore",
    [false, false],
    [
      /console\.(log|error|warn|info)\([^)]*(message|\.path|chiave|numero)/.test(
        srv + rotta + hook,
      ),
      /\.message\b/.test(srv + logica + rotta + hook),
    ],
  );
  c(
    "rotta del browser: guardiaCRM senza permesso (basta essere entrati) e «impostazioni» deciso per selezione",
    [true, true, true],
    [
      /guardiaCRM\(request, cors, null\)/.test(rotta),
      /"impostazioni"/.test(rotta),
      /puoImpostazioni/.test(rotta),
    ],
  );
  c(
    "rotta del browser: solo POST e OPTIONS, corpo limitato",
    [true, false, true],
    [
      /POST:/.test(rotta) && /OPTIONS:/.test(rotta),
      /\bGET:/.test(rotta),
      /leggiCorpoLimitato/.test(rotta),
    ],
  );
  c(
    "hook: stessa autenticazione degli altri (chiave pubblicabile), risposta di soli conteggi",
    [true, true],
    [/authorization/.test(hook) && /SUPABASE_PUBLISHABLE_KEY/.test(hook), /giroScadute/.test(hook)],
  );
  c(
    "rotta del ponte: passa la porta `mediaAzioni`",
    true,
    /mediaAzioni:\s*porteMediaAzioni\(\)/.test(rottaMac),
  );
  c(
    "tipi: le porte e i codici di log sono in media-azioni-tipi.ts",
    [true, true],
    [/export interface PorteMediaAzioni/.test(tipi), /export type CodiceAvvisoAzioni/.test(tipi)],
  );

  const rotte = await caricaRotte(radice);
  try {
    const R = rotte.carica();
    const azione = R.RottaAzione.options.server.handlers;
    const hookH = R.RottaHook.options.server.handlers;
    const macH = R.RottaMac.options.server.handlers;
    c(
      "percorsi delle rotte",
      ["/api/crm/ponte-media-azione", "/hooks/media-scadute"],
      [R.RottaAzione.path, R.RottaHook.path],
    );

    const sessione =
      (tipo, extra = {}) =>
      async (_request, _cors, permesso) => {
        if (tipo === "nessuna")
          return {
            ok: false,
            risposta: new Response(JSON.stringify({ error: "Accedi al CRM." }), { status: 401 }),
          };
        const imp = tipo === "impostazioni";
        if (permesso && !imp) return { ok: false, risposta: new Response("{}", { status: 403 }) };
        return {
          ok: true,
          chi: {
            adminUserId: tipo === "altra" ? ALTRO : UTENTE,
            nome: "Anna Finta",
            accesso: { puo: (p) => imp && p === "impostazioni" },
            ...extra,
          },
        };
      };
    const POST = async (corpo, o = {}) => {
      globalThis.__mondoAzioni = o.mondo ?? mondo();
      globalThis.__guardiaAzioni = sessione(o.sessione ?? "semplice");
      const body = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
      const request = new Request("https://sito.test/api/crm/ponte-media-azione", {
        method: "POST",
        headers: { authorization: "Bearer finto", "content-type": "application/json" },
        body,
      });
      const { esito: r, log } = await conLog(() => azione.POST({ request }));
      let json = null;
      try {
        json = JSON.parse(await r.text());
      } catch {
        json = null;
      }
      return { r, json, log, m: globalThis.__mondoAzioni };
    };

    const a1 = await POST(
      { azione: "richiedi", chiave: k1, timer: 300 },
      { mondo: mondo({ risposte: { ponte_wa_media_richiedi: { esito: "in_attesa" } } }) },
    );
    c(
      "rotta: richiedi → 200 e la funzione SQL con utente del server, chiave e timer",
      [
        200,
        { ok: true, esito: "in_attesa" },
        [
          {
            fn: "ponte_wa_media_richiedi",
            args: { p_user_id: UTENTE, p_chiave: k1, p_timer_s: 300 },
          },
        ],
        "no-store",
      ],
      [a1.r.status, a1.json, a1.m.rpc, a1.r.headers.get("cache-control")],
    );
    c(
      "rotta: solo POST/OPTIONS esposti, OPTIONS 204",
      [true, undefined],
      [(await azione.OPTIONS()).status === 204, azione.GET],
    );
    const a2 = await POST({ azione: "richiedi", chiave: k1 }, { sessione: "nessuna" });
    c(
      "rotta: senza sessione → 401 e il database non si tocca",
      [401, 0],
      [a2.r.status, a2.m.rpc.length],
    );
    const a3 = await POST({ azione: "richiedi", chiave: k1 }, { sessione: "altra" });
    c(
      "rotta: installazione diversa dal database → 403",
      [403, { ok: false, motivo: "non_autorizzato" }, 0],
      [a3.r.status, a3.json, a3.m.rpc.length],
    );
    const a4 = await POST("{non json");
    c("rotta: JSON rotto → 400", [400, "corpo_non_valido"], [a4.r.status, a4.json?.motivo]);
    const grande = await POST({ azione: "libera", chiavi: [k1], riempimento: "x".repeat(17_000) });
    c(
      "rotta: corpo oltre il massimo → 413",
      [413, "corpo_troppo_grande"],
      [grande.r.status, grande.json?.motivo],
    );
    const chiaviMax = Array.from(
      { length: 200 },
      (_, i) => `bw:${NUMERO}:${"A".repeat(40)}${String(i).padStart(4, "0")}`,
    );
    const m200 = mondo({ risposte: { ponte_wa_media_da_liberare: [] } });
    const a200 = await POST(
      { azione: "libera", chiavi: chiaviMax },
      { sessione: "impostazioni", mondo: m200 },
    );
    c(
      "rotta: 200 chiavi lunghe (selezione intera del pannello) stanno nel corpo massimo",
      200,
      a200.r.status,
    );

    for (const [nome, corpo] of [
      ["chiavi", { azione: "libera", chiavi: [k1, k2] }],
      ["numero", { azione: "libera", numero: NUMERO }],
      ["tutto", { azione: "libera", tutto: true }],
    ]) {
      const x = await POST(corpo, { sessione: "semplice" });
      c(
        `rotta vera: libera «${nome}» senza «impostazioni» → 403, nessuna funzione SQL e nessun Storage`,
        [403, 0, 0],
        [
          x.r.status,
          x.m.rpc.filter((y) => y.fn !== "ponte_wa_media_richiedi").length,
          x.m.rimossi.length,
        ],
      );
    }

    //  Una liberazione vera: Storage del solo bucket, percorso dal database.
    const ml = mondo({
      risposte: {
        ponte_wa_media_da_liberare: [{ chiave: k1, path: pathDi(1) }],
        ponte_wa_media_liberato: (a) => a.p_voci.length,
      },
    });
    const lib = await POST({ azione: "libera", chiave: k1 }, { mondo: ml });
    c(
      "rotta vera: libera → da_liberare, remove sul bucket ponte-media col percorso del DATABASE, poi liberato con chiave+path",
      [
        200,
        { ok: true, liberati: 1, byte: 1000, restano: 0, non_riusciti: 0 },
        ["ponte_wa_media_da_liberare", "ponte_wa_media_liberato"],
        [{ bucket: "ponte-media", paths: [pathDi(1)] }],
        { p_user_id: UTENTE, p_voci: [{ chiave: k1, path: pathDi(1) }] },
      ],
      [lib.r.status, lib.json, lib.m.rpc.map((y) => y.fn), lib.m.rimossi, lib.m.rpc[1]?.args],
    );
    c(
      "rotta vera: da_liberare riceve numero nullo e SOLO la chiave",
      { p_user_id: UTENTE, p_numero: null, p_chiavi: [k1], p_limite: 500 },
      lib.m.rpc[0]?.args,
    );
    const ms = mondo({
      guasti: { storage: true },
      risposte: {
        ponte_wa_media_da_liberare: [{ chiave: k1, path: pathDi(1) }],
        ponte_wa_media_liberato: 1,
      },
    });
    const rs = await POST({ azione: "libera", chiave: k1 }, { mondo: ms });
    c(
      "rotta vera: Storage che fallisce → 503, `liberato` mai chiamato, nessun testo dell'errore in risposta né nel log",
      [503, false, false, false],
      [
        rs.r.status,
        rs.m.rpc.some((y) => y.fn === "ponte_wa_media_liberato"),
        /prova|3933|Anna|\.jpg/.test(JSON.stringify(rs.json)),
        rs.log.some((l) => /3933|Anna|\.jpg|bw:/.test(l)),
      ],
    );
    const mg = mondo({ guasti: { ponte_wa_media_da_liberare: "XX000" } });
    const rg = await POST(
      { azione: "libera", tutto: true },
      { sessione: "impostazioni", mondo: mg },
    );
    c(
      "rotta vera: database rotto → 500 e nel log solo un codice",
      [500, true],
      [rg.r.status, rg.log.every((l) => !/3933|Anna|bw:/.test(l))],
    );
    const tm = await POST(
      { azione: "timer", chiave: k1, timer: 86400 },
      {
        mondo: mondo({
          risposte: {
            ponte_wa_media_timer: { ok: true, stato: "pronta", scade_il: "2026-11-02T10:00:00Z" },
          },
        }),
      },
    );
    c(
      "rotta vera: timer → ponte_wa_media_timer(utente, chiave, secondi)",
      [200, "ponte_wa_media_timer", { p_user_id: UTENTE, p_chiave: k1, p_secondi: 86400 }],
      [tm.r.status, tm.m.rpc[0]?.fn, tm.m.rpc[0]?.args],
    );
    const spenta = await POST(
      { azione: "richiedi", chiave: k1 },
      {
        mondo: mondo({
          tab: { app_config: [{ key: "ponte_immagini", value: '{"acceso":false}' }] },
        }),
      },
    );
    c(
      "rotta vera: interruttore spento → 409 spenta, nessuna funzione SQL",
      [409, 0],
      [spenta.r.status, spenta.m.rpc.length],
    );

    //  L'hook.
    const HOOK = async (o = {}) => {
      globalThis.__mondoAzioni = o.mondo ?? mondo();
      process.env.SUPABASE_PUBLISHABLE_KEY = "chiave-pubblicabile-di-prova";
      const request = new Request("https://sito.test/hooks/media-scadute", {
        method: "POST",
        headers: o.senza
          ? {}
          : { authorization: `Bearer ${o.chiave ?? "chiave-pubblicabile-di-prova"}` },
      });
      const { esito: r, log } = await conLog(() => hookH.POST({ request }));
      return { r, json: await r.json(), log, m: globalThis.__mondoAzioni };
    };
    const h0 = await HOOK({ senza: true });
    c(
      "hook senza chiave → 401, il database non si tocca",
      [401, 0],
      [h0.r.status, h0.m.rpc.length],
    );
    const h1 = await HOOK({ chiave: "sbagliata" });
    c("hook con chiave sbagliata → 401", [401, 0], [h1.r.status, h1.m.rpc.length]);
    const mh = mondo({
      risposte: {
        ponte_wa_media_scadute: [
          { user_id: UTENTE, chiave: k1, path: pathDi(1) },
          { user_id: UTENTE, chiave: k2, path: pathDi(2) },
        ],
        ponte_wa_media_liberato: (a) => a.p_voci.length,
      },
    });
    const h2 = await HOOK({ mondo: mh });
    c(
      "hook → scadute(200), remove dei due percorsi dal bucket ponte-media, liberato con le voci; risposta di soli conteggi",
      [
        200,
        { ok: true, liberati: 2, orfani: 0, non_riusciti: 0 },
        { p_limite: 200 },
        [{ bucket: "ponte-media", paths: [pathDi(1), pathDi(2)] }],
      ],
      [h2.r.status, h2.json, h2.m.rpc[0]?.args, h2.m.rimossi],
    );
    c(
      "hook: il corpo della risposta ha solo numeri",
      true,
      Object.entries(h2.json).every(([k, v]) => k === "ok" || typeof v === "number"),
    );
    const h3 = await HOOK({ mondo: mondo({ guasti: { ponte_wa_media_scadute: "XX000" } }) });
    c(
      "hook con database rotto → 500, nel log solo un codice",
      [500, true],
      [h3.r.status, h3.log.every((l) => !/3933|Anna|bw:/.test(l))],
    );

    //  Le richieste che aspettano il Mac: in_attesa, più le in_corso da più di 10 minuti (rientrano in `prendi`).
    const fa = (min) => new Date(Date.now() - min * 60e3).toISOString();
    globalThis.__mondoAzioni = mondo({
      tab: {
        ponte_wa_media_richieste: [
          { user_id: UTENTE, chiave: chiaveDi(1), stato: "in_attesa", presa_il: null },
          { user_id: UTENTE, chiave: chiaveDi(2), stato: "in_attesa", presa_il: null },
          { user_id: ALTRO, chiave: chiaveDi(3), stato: "in_attesa", presa_il: null },
          { user_id: UTENTE, chiave: chiaveDi(4), stato: "in_corso", presa_il: fa(11) },
          { user_id: UTENTE, chiave: chiaveDi(5), stato: "in_corso", presa_il: fa(2) },
          { user_id: UTENTE, chiave: chiaveDi(6), stato: "non_disponibile", presa_il: fa(60) },
        ],
      },
    });
    const vere = R.porteMediaAzioni();
    c(
      "porta vera inAttesa: 2 in_attesa + 1 in_corso da 11 minuti; non la fresca, non l'altro utente, non la chiusa",
      3,
      await vere.inAttesa(UTENTE),
    );
    c(
      "porta vera interruttore: il valore grezzo di ponte_immagini",
      ACCESO(["foto", "audio", "video", "documento"]),
      await vere.interruttore(),
    );
    globalThis.__mondoAzioni = mondo({ guasti: { ponte_wa_media_pulizia: "42883" } });
    let codice = null;
    try {
      await vere.pulizia();
    } catch (e) {
      codice = e.code;
    }
    c("porta vera: un errore del database arriva come {code} e basta", "42883", codice);

    //  La rotta del Mac: media_prendi, media_esito e il battito (con le porte vere).
    const SEGRETO = "s".repeat(32);
    process.env.PONTE_WA_TOKEN = SEGRETO;
    const MAC = async (corpo, mondoMac) => {
      globalThis.__mondoAzioni = mondoMac;
      const request = new Request("https://sito.test/api/public/ponte-whatsapp", {
        method: "POST",
        headers: { "x-hgl-token": SEGRETO, "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const { esito: r, log } = await conLog(() => macH.POST({ request }));
      return { r, json: await r.json(), log, m: globalThis.__mondoAzioni };
    };
    const mp = mondo({ risposte: { ponte_wa_media_prendi: [k1, k2] } });
    const p1 = await MAC({ v: 1, tipo: "media_prendi", max: 5 }, mp);
    c(
      "rotta del ponte: media_prendi → richieste, ponte_wa_media_prendi(utente, max)",
      [
        200,
        { ok: true, richieste: [{ chiave: k1 }, { chiave: k2 }] },
        { p_user_id: UTENTE, p_max: 5 },
      ],
      [p1.r.status, p1.json, p1.m.rpc[0]?.args],
    );
    const e1 = await MAC(
      { v: 1, tipo: "media_esito", chiave: k1, esito: "scaduta" },
      mondo({ risposte: { ponte_wa_media_richiesta_esito: { ok: true } } }),
    );
    c(
      "rotta del ponte: media_esito → ponte_wa_media_richiesta_esito(utente, chiave, esito)",
      [200, { ok: true }, { p_user_id: UTENTE, p_chiave: k1, p_esito: "scaduta" }],
      [e1.r.status, e1.json, e1.m.rpc[0]?.args],
    );
    c(
      "rotta del ponte: nei log nessun numero né chiave",
      true,
      [p1, e1].every((x) => x.log.every((l) => !/3933|bw:|3EB0/.test(l))),
    );
  } finally {
    rotte.chiudi();
    delete globalThis.__mondoAzioni;
    delete globalThis.__guardiaAzioni;
  }
}
