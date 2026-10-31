/** ── PROVE: LE IMMAGINI DEL PONTE · ROTTE E PORTE (compito T5) ──
 *
 *  Commessa 2026-10-30-ponte-storico-completo (PIANO c.3, c.4). Le DUE rotte
 *  VERE (`api.public.ponte-whatsapp.ts`, che ora serve anche `media_permesso`
 *  e `media_fatto`, e `api.crm.ponte-media.ts`, la lettura del browser) si
 *  impacchettano con esbuild insieme a `ingresso.ts`, `media.ts` e alle porte
 *  VERE (`media.server.ts`); finti solo il router, la sessione (`guardiaCRM`) e
 *  il client Supabase con la chiave di servizio: il database in memoria di
 *  `rotta.mjs` (`MONDO_FINTO`, NON toccato) più Storage, la tabella
 *  `ponte_wa_media` e le due funzioni SQL, dette in JavaScript.
 *  ⚠️ Le funzioni finte servono a far girare il codice TypeScript vero, non a
 *   provare l'SQL: lo prova `prove/sql/ponte-immagini.sql` (T4) su Postgres vero.
 *   Il loro contratto (risposte `esito`/`motivo`/`path`, `stato`) è quello
 *   scritto nella voce di T5 in LAVAGNA.
 *  `fetch` è un allarme: le rotte non chiamano nessuno fuori da Supabase.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { MONDO_FINTO, TOKEN, UTENTE, chiama, nuovoMondo } from "./rotta.mjs";

const ALTRO_UTENTE = "99999999-1111-4222-8333-444444444444";
const NUMERO = "393330000101";
const CHIAVE = `bw:${NUMERO}:3EB0AA01`;
const CHIAVE2 = `bw:${NUMERO}:3EB0AA02`;
const MIB8 = 8 * 1024 * 1024;
const ACCESO = '{"acceso":true,"tettoGB":0.8}';
const PERCORSO_MEDIA = "/api/crm/ponte-media";

/** Storage, `ponte_wa_media` e le due funzioni SQL, sopra il mondo finto di `rotta.mjs`. */
const MONDO_MEDIA =
  MONDO_FINTO.replace("export const supabaseAdmin", "const supabaseBase") +
  `
let __m = 0;
const MIB8 = 8 * 1024 * 1024;
const oggetti = () => (st().oggetti ??= new Map());
const firme = () => (st().firme ??= []);

function permessoMedia(a) {
  const tutte = righe("ponte_wa_media");
  const k = tutte.find((r) => r.user_id === a.p_user_id && r.chiave === a.p_chiave);
  if (k && k.stato === "pronta") return { esito: "gia_presente" };
  if (!["image/jpeg", "image/png", "image/webp"].includes(a.p_mime)) return { esito: "rifiutato", motivo: "tipo" };
  if (a.p_byte > MIB8) return { esito: "rifiutato", motivo: "troppo_grande" };
  const usati = tutte.filter((r) => r.stato === "pronta").reduce((s, r) => s + r.byte, 0);
  if (usati + a.p_byte > a.p_tetto_byte) return { esito: "rifiutato", motivo: "tetto" };
  if (k) return { esito: "carica", path: k.path };
  const ext = a.p_mime === "image/png" ? "png" : a.p_mime === "image/webp" ? "webp" : "jpg";
  const path = a.p_user_id + "/" + String(++__m).padStart(8, "a") + "-1111-4222-8333-444444444444." + ext;
  tutte.push({ user_id: a.p_user_id, chiave: a.p_chiave, numero: a.p_numero, path, mime: a.p_mime, byte: a.p_byte, stato: "in_caricamento" });
  scritto("ponte_wa_media", "insert", ["user_id", "chiave", "numero", "path", "mime", "byte", "stato"], "ponte_wa_media_permesso");
  return { esito: "carica", path };
}

function fattoMedia(a) {
  const r = righe("ponte_wa_media").find((x) => x.user_id === a.p_user_id && x.chiave === a.p_chiave);
  if (!r) return { stato: "assente" };
  if (r.stato === "pronta") return { stato: "pronta", byte: r.byte };
  if (!oggetti().has(r.path)) return { stato: "in_caricamento" };
  r.stato = "pronta";
  r.byte = oggetti().get(r.path);
  scritto("ponte_wa_media", "update", ["byte", "stato"], "ponte_wa_media_fatto");
  return { stato: "pronta", byte: r.byte };
}

export const supabaseAdmin = {
  from: (t) => supabaseBase.from(t),
  rpc: async (fn, a) => {
    if (!fn.startsWith("ponte_wa_media")) return supabaseBase.rpc(fn, a);
    st().rpc.push({ fn, args: JSON.parse(JSON.stringify(a)) });
    const g = guasto(fn);
    if (g) return g;
    if (fn === "ponte_wa_media_permesso") return { data: permessoMedia(a), error: null };
    if (fn === "ponte_wa_media_fatto") return { data: fattoMedia(a), error: null };
    return { data: null, error: { code: "42883", message: "function does not exist" } };
  },
  storage: {
    from: (bucket) => ({
      createSignedUploadUrl: async (path) => {
        firme().push({ azione: "carico", bucket, path });
        const g = guasto("storage");
        if (g) return { data: null, error: { message: "errore con " + path } };
        return { data: { signedUrl: "https://prova.supabase.co/storage/v1/object/upload/sign/" + bucket + "/" + path + "?token=SEGRETO-DI-CARICO", token: "SEGRETO-DI-CARICO", path }, error: null };
      },
      createSignedUrl: async (path, secondi, opzioni) => {
        firme().push({ azione: "lettura", bucket, path, secondi, ...(opzioni?.download ? { download: opzioni.download } : {}) });
        if (st().guasti.lettura) return { data: null, error: { name: "StorageApiError", status: 503, statusCode: "503", message: "errore con " + path } };
        if (st().guasti.lettura_rete) return { data: null, error: { name: "StorageUnknownError", message: "fetch failed per " + path } };
        if (!oggetti().has(path)) return { data: null, error: { name: "StorageApiError", status: 400, statusCode: "404", message: "Object not found " + path } };
        return { data: { signedUrl: "https://prova.supabase.co/storage/v1/object/sign/" + bucket + "/" + path + "?token=SEGRETO-DI-LETTURA" }, error: null };
      },
    }),
  },
};`;

/** Le due rotte vere, con router, sessione e database finti. */
async function caricaRotte(radice) {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-media-rotte-"));
  const finta = join(cartella, "supabase-finto.js");
  writeFileSync(finta, MONDO_MEDIA);
  const file = join(cartella, "rotte.cjs");
  await build({
    stdin: {
      contents: `export { Route as RottaMac } from "@/routes/api.public.ponte-whatsapp";\nexport { Route as RottaMedia } from "@/routes/api.crm.ponte-media";\nexport { gestisciRichiesta } from "@/crm/ponte/ingresso";`,
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
          b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: "router", namespace: "finto" }));
          b.onResolve({ filter: /^@\/integrations\/supabase\/client\.server$/ }, () => ({ path: finta }));
          b.onResolve({ filter: /^\.\/api\.crm\.accesso$/ }, () => ({ path: "accesso", namespace: "finto" }));
          b.onLoad({ filter: /^router$/, namespace: "finto" }, () => ({
            contents: "export const createFileRoute = (path) => (options) => ({ path, options });",
            loader: "js",
          }));
          //  La sessione: la decide la prova (`globalThis.__guardia`).
          b.onLoad({ filter: /^accesso$/, namespace: "finto" }, () => ({
            contents: "export const guardiaCRM = (request, cors, permesso) => globalThis.__guardia(request, cors, permesso);",
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

/** Il mondo di partenza: tutto acceso, l'utente configurato. */
const base = (extra = {}) => ({
  manychat_config: [{ id: 1, user_id: UTENTE }],
  app_config: [{ key: "ponte_immagini", value: ACCESO }],
  ponte_wa_media: [],
  ...extra,
});

/** Una riga di `ponte_wa_media`. */
const NOME_PRONTA = "bbbbbbb1-1111-4222-8333-444444444444.jpg";
const riga = (o = {}) => ({ user_id: UTENTE, chiave: CHIAVE, numero: NUMERO, path: `${UTENTE}/${NOME_PRONTA}`, mime: "image/jpeg", byte: 5000, stato: "pronta", ...o });

const permesso = (o = {}) => ({ v: 1, tipo: "media_permesso", chiave: CHIAVE, mime: "image/jpeg", byte: 5000, ...o });
const fatto = (o = {}) => ({ v: 1, tipo: "media_fatto", chiave: CHIAVE, ...o });

/** Sessione scelta dalla prova + chiamata GET. */
async function leggiMedia(GET, { id = NOME_PRONTA, sessione = "ok", query } = {}) {
  //  `query: ""` = nessun parametro (un `id: undefined` varrebbe l'identificativo di serie).
  globalThis.__guardia = async () =>
    sessione === "nessuna"
      ? { ok: false, risposta: new Response(JSON.stringify({ error: "Accedi al CRM." }), { status: 401 }) }
      : { ok: true, chi: { adminUserId: sessione === "altra" ? ALTRO_UTENTE : sessione === "vuota" ? "" : UTENTE, nome: "Anna Finta" } };
  const livelli = ["log", "info", "warn", "error", "debug"];
  const veri = Object.fromEntries(livelli.map((k) => [k, console[k]]));
  const log = [];
  for (const k of livelli) console[k] = (...a) => log.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  try {
    const q = query ?? (id === undefined ? "" : `?id=${encodeURIComponent(id)}`);
    const request = new Request(`https://sito.test${PERCORSO_MEDIA}${q}`, { method: "GET", headers: { authorization: "Bearer finto" } });
    const r = await GET({ request });
    const testo = await r.text();
    let json = null;
    try {
      json = JSON.parse(testo);
    } catch {
      json = null;
    }
    return { r, json, log };
  } finally {
    for (const k of livelli) console[k] = veri[k];
  }
}

export async function provePonteImmaginiRotta(mod, { c, gruppo, radice }) {
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const rottaMac = senzaCommenti(leggi("src/routes/api.public.ponte-whatsapp.ts"));
  const rottaWeb = senzaCommenti(leggi("src/routes/api.crm.ponte-media.ts"));
  const porteSrc = senzaCommenti(leggi("src/crm/ponte/porte.server.ts"));
  const albero = leggi("src/routeTree.gen.ts");

  /* ═══ 1. I SORGENTI ══════════════════════════════════════════════════════ */
  gruppo("PONTE · IMMAGINI · ROTTE · SORGENTI (T5)");
  {
    c("rotta del browser: il percorso giusto", true, rottaWeb.includes(`createFileRoute("${PERCORSO_MEDIA}")`));
    c("rotta del browser: solo OPTIONS e GET (niente scritture)", ["OPTIONS", "GET"], [...rottaWeb.matchAll(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*:/g)].map((x) => x[1]));
    c("rotta del browser: legge ?id=… e non ?chiave (nell'indirizzo non entra il numero del cliente)", [true, false], [/searchParams\.get\("id"\)/.test(rottaWeb), /chiave/.test(rottaWeb)]);
    c("rotta del browser: guardiaCRM(request, cors, null), una volta sola", [1, 1], [(rottaWeb.match(/guardiaCRM\(request, cors, null\)/g) ?? []).length, (rottaWeb.match(/guardiaCRM\(/g) ?? []).length]);
    c("rotta del browser: l'installazione della sessione, no-store, niente console né fetch né lettura del corpo", [true, true, false, false, false],
      [rottaWeb.includes("adminUserId"), rottaWeb.includes("no-store"), /console\./.test(rottaWeb), /\bfetch\s*\(/.test(rottaWeb), /request\.(body|json|text|formData)/.test(rottaWeb)]);
    c("rotta del browser: i soli import", ["./api.crm.accesso", "@/crm/ponte/media", "@/crm/ponte/media.server", "@tanstack/react-router"], [...rottaWeb.matchAll(/from\s+"([^"]+)"/g)].map((x) => x[1]).sort());
    c("rotta del ponte: passa anche le porte dei media, il resto invariato", [true, true, true], [rottaMac.includes("gestisciRichiesta(porteIngresso()"), rottaMac.includes("invii: porteInvio()"), rottaMac.includes("media: porteMedia()")]);
    c("porte.server.ts ripassa porteMedia (la rotta del ponte importa solo quel file)", true, /export \{ porteMedia \} from "\.\/media\.server"/.test(porteSrc));
    c("routeTree.gen.ts importa la rotta di lettura, una volta sola", [true, true, 1],
      [albero.includes("import { Route as ApiCrmPonteMediaRouteImport } from './routes/api.crm.ponte-media'"), albero.includes(`'${PERCORSO_MEDIA}'`), (albero.match(/ApiCrmPonteMediaRoute: ApiCrmPonteMediaRoute,/g) ?? []).length]);
  }

  /* ═══ 2. LE ROTTE VERE ═══════════════════════════════════════════════════ */
  const fetchVero = globalThis.fetch;
  let esterne = 0;
  globalThis.fetch = () => {
    esterne++;
    throw new Error("le rotte non devono chiamare nessuno");
  };
  const rotte = await caricaRotte(radice);
  try {
    let moduli = rotte.carica();
    let POST = moduli.RottaMac.options.server.handlers.POST;
    let GET = moduli.RottaMedia.options.server.handlers.GET;
    const OPTIONS = moduli.RottaMedia.options.server.handlers.OPTIONS;
    const soloMedia = (m) => m.rpc.map((r) => r.fn);

    /* ── 2.1 la chiave del ponte e la porta ─────────────────────────────── */
    gruppo("PONTE · IMMAGINI · POST · CHIAVE, PORTA, ORDINE (T5)");
    {
      let m = nuovoMondo(base());
      let letto = false;
      const flusso = new ReadableStream({ pull(k) { letto = true; k.enqueue(new TextEncoder().encode(JSON.stringify(permesso()))); k.close(); } }, { highWaterMark: 0 });
      let x = await chiama(POST, { flusso, chiave: "sbagliata" });
      c("chiave sbagliata: 401 e il corpo non si legge", [401, false], [x.r.status, letto]);
      x = await chiama(POST, { corpo: permesso(), token: undefined });
      c("segreto assente: 503, niente database", [503, 0], [x.r.status, m.chiamate.length + m.rpc.length]);
      x = await chiama(POST, { corpo: permesso(), chiave: undefined });
      c("senza chiave: 401, niente database", [401, 0], [x.r.status, m.chiamate.length + m.rpc.length]);

      //  Senza la porta `media` il corpo è «non valido» come prima (nessun database).
      const { gestisciRichiesta } = moduli;
      const avvisi = [];
      let toccato = 0;
      const porteVuote = new Proxy({ avviso: (k) => avvisi.push(k) }, { get: (o, k) => (k in o ? o[k] : () => (toccato++, Promise.resolve(UTENTE))) });
      for (const corpo of [permesso(), fatto()]) {
        const r = await gestisciRichiesta(porteVuote, {
          request: new Request("https://sito.test/x", { method: "POST", headers: { "x-hgl-token": TOKEN }, body: JSON.stringify(corpo) }),
          segreto: TOKEN,
          adesso: new Date(),
        });
        c(`senza la porta media: ${corpo.tipo} → 400 corpo_non_valido, database intatto`, [400, "corpo_non_valido", 0], [r.status, (await r.json()).errore, toccato]);
      }

      //  L'utente non arriva dal corpo.
      m = nuovoMondo(base());
      x = await chiama(POST, { corpo: { ...permesso(), user_id: ALTRO_UTENTE, numero: "393339999999" } });
      c("permesso con user_id e numero nel corpo: il database vede l'utente di manychat_config e il numero della chiave", [UTENTE, NUMERO],
        [m.rpc[0]?.args.p_user_id, m.rpc[0]?.args.p_numero]);
      c("manychat_config senza riga: 503 non_configurato, nessuna funzione", [503, "non_configurato", 0], await (async () => {
        const mm = nuovoMondo(base({ manychat_config: [] }));
        const y = await chiama(POST, { corpo: permesso() });
        return [y.r.status, y.json?.errore, mm.rpc.length];
      })());
    }

    /* ── 2.2 il giro intero ──────────────────────────────────────────────── */
    gruppo("PONTE · IMMAGINI · POST · IL GIRO (T5)");
    {
      const m = nuovoMondo(base());
      let x = await chiama(POST, { corpo: permesso() });
      c("acceso: 200 carica con l'URL di carico", [200, "carica"], [x.r.status, x.json?.esito]);
      c("…l'URL è quello firmato da Storage nel bucket ponte-media", true, /^https:\/\/prova\.supabase\.co\/storage\/v1\/object\/upload\/sign\/ponte-media\//.test(x.json?.url_carico));
      c("…sempre JSON e no-store", ["application/json", "no-store"], [String(x.r.headers.get("content-type")).split(";")[0], x.r.headers.get("cache-control")]);
      const path = m.tab.ponte_wa_media[0]?.path ?? "";
      c("…il percorso è una riga della tabella e non porta il numero né l'id del messaggio", [1, false, false], [m.tab.ponte_wa_media.length, path.includes(NUMERO), path.includes("3EB0AA01")]);
      c("…la funzione SQL riceve i parametri del contratto", ["p_byte", "p_chiave", "p_mime", "p_numero", "p_tetto_byte", "p_user_id"], Object.keys(m.rpc[0].args).sort());
      c("…con il tetto di 0,8 GB in byte", 800_000_000, m.rpc[0].args.p_tetto_byte);
      c("…e la firma di Storage è per quel percorso, nel bucket giusto", [{ azione: "carico", bucket: "ponte-media", path }], m.firme);

      x = await chiama(POST, { corpo: fatto() });
      c("media_fatto prima del caricamento: in_caricamento", [200, "in_caricamento"], [x.r.status, x.json?.esito]);
      m.oggetti.set(path, 4321);
      x = await chiama(POST, { corpo: fatto() });
      c("media_fatto dopo il caricamento: pronta", [200, "pronta"], [x.r.status, x.json?.esito]);
      c("…il peso lo scrive la funzione dal database (4321), non il Mac", 4321, m.tab.ponte_wa_media[0]?.byte);
      x = await chiama(POST, { corpo: fatto({ chiave: CHIAVE2 }) });
      c("media_fatto di una chiave mai chiesta: assente", [200, "assente"], [x.r.status, x.json?.esito]);
      x = await chiama(POST, { corpo: permesso() });
      c("lo stesso permesso dopo la fine: gia_presente (idempotente)", [200, "gia_presente"], [x.r.status, x.json?.esito]);
      c("…senza una seconda firma di carico", 1, m.firme.filter((f) => f.azione === "carico").length);
      c("il database si scrive solo dalle due funzioni SQL", [], m.scritture.filter((w) => w.via === "diretta"));
      c("le sole tabelle toccate dal TypeScript: manychat_config e app_config", ["app_config", "manychat_config"], [...new Set(m.chiamate.map((q) => q.tabella))].sort());
    }

    /* ── 2.3 interruttore, tetto, limiti ─────────────────────────────────── */
    gruppo("PONTE · IMMAGINI · POST · INTERRUTTORE, TETTO, LIMITI (T5)");
    {
      for (const [nome, app_config] of [
        ["spento", [{ key: "ponte_immagini", value: '{"acceso":false,"tettoGB":0.8}' }]],
        ["riga assente", []],
        ["valore rotto", [{ key: "ponte_immagini", value: "{rotto" }]],
        ["valore non testo", [{ key: "ponte_immagini", value: 5 }]],
      ]) {
        const m = nuovoMondo(base({ app_config }));
        const x = await chiama(POST, { corpo: permesso() });
        c(`${nome}: rifiutato «spenta», nessuna funzione SQL, nessuna firma`, [200, { ok: true, esito: "rifiutato", motivo: "spenta" }, 0, 0], [x.r.status, x.json, m.rpc.length, (m.firme ?? []).length]);
      }
      let m = nuovoMondo(base({ ponte_wa_media: [riga({ chiave: CHIAVE2, byte: 799_999_000 })] }));
      let x = await chiama(POST, { corpo: permesso({ byte: 2000 }) });
      c("oltre il tetto (799.999.000 + 2000 > 0,8 GB): rifiutato «tetto»", [200, { ok: true, esito: "rifiutato", motivo: "tetto" }], [x.r.status, x.json]);
      c("…e nessuna firma di carico", 0, (m.firme ?? []).length);
      m = nuovoMondo(base({ ponte_wa_media: [riga({ chiave: CHIAVE2, byte: 799_999_000 })], app_config: [{ key: "ponte_immagini", value: '{"acceso":true,"tettoGB":0.9}' }] }));
      x = await chiama(POST, { corpo: permesso({ byte: 2000 }) });
      c("con il tetto a 0,9 GB la stessa foto passa", "carica", x.json?.esito);
      m = nuovoMondo(base());
      x = await chiama(POST, { corpo: permesso({ byte: MIB8 + 1 }) });
      c("8 MiB + 1: «troppo_grande», niente SQL", [{ ok: true, esito: "rifiutato", motivo: "troppo_grande" }, 0], [x.json, m.rpc.length]);
      x = await chiama(POST, { corpo: permesso({ byte: MIB8 }) });
      c("8 MiB esatti: carica", "carica", x.json?.esito);
      m = nuovoMondo(base());
      x = await chiama(POST, { corpo: permesso({ mime: "image/svg+xml" }) });
      c("SVG: «tipo», niente SQL", [{ ok: true, esito: "rifiutato", motivo: "tipo" }, 0], [x.json, m.rpc.length]);
      x = await chiama(POST, { corpo: permesso({ byte: -3 }) });
      c("byte negativo: 400 corpo_non_valido", [400, "corpo_non_valido"], [x.r.status, x.json?.errore]);
      x = await chiama(POST, { corpo: permesso({ chiave: "bw:1:2" }) });
      c("chiave storta: 400", 400, x.r.status);
    }

    /* ── 2.4 guasti e log ────────────────────────────────────────────────── */
    gruppo("PONTE · IMMAGINI · POST · GUASTI E LOG (T5)");
    {
      let m = nuovoMondo(base(), { ponte_wa_media_permesso: "42883" });
      let x = await chiama(POST, { corpo: permesso() });
      c("funzione assente (migrazione non applicata): 503 migrazione", [503, { ok: false, errore: "migrazione" }], [x.r.status, x.json]);
      c("…il log dice una volta «media_migrazione» e nient'altro", true, x.log.some((l) => l.includes("media_migrazione")) && !x.log.some((l) => /3933|3EB0|Anna/.test(l)));
      m = nuovoMondo(base(), { ponte_wa_media_permesso: "08006" });
      x = await chiama(POST, { corpo: permesso() });
      c("guasto del database: 500 database, il Mac ritenta", [500, { ok: false, errore: "database" }], [x.r.status, x.json]);
      m = nuovoMondo(base(), { storage: "x" });
      x = await chiama(POST, { corpo: permesso() });
      c("Storage non firma: 500 database, e il percorso non finisce nel log", [500, false], [x.r.status, x.log.some((l) => /aaaaaaa|\.jpg|prova\.supabase/.test(l))]);
      m = nuovoMondo(base(), { app_config: "08006" });
      x = await chiama(POST, { corpo: permesso() });
      c("lettura dell'interruttore fallita: 500, nessuna funzione", [500, 0], [x.r.status, m.rpc.length]);
      m = nuovoMondo(base(), { ponte_wa_media_fatto: "08006" });
      x = await chiama(POST, { corpo: fatto() });
      c("media_fatto con il database guasto: 500", 500, x.r.status);

      //  Un giro intero con tutti i log insieme.
      nuovoMondo(base());
      const tutti = [];
      for (const corpo of [permesso(), permesso(), fatto(), permesso({ mime: "image/gif" }), permesso({ byte: MIB8 + 1 }), permesso({ byte: 0 })]) {
        tutti.push(...(await chiama(POST, { corpo })).log);
      }
      c("nei log solo «[ponte-media] codice chiave=numero» (o i codici del ponte): nessun numero, chiave, percorso, URL o token", [],
        tutti.filter((l) => !/^\[ponte-(media|wa)\] [a-z_]+( [a-z_]+=\d+)*$/.test(l) || /3933|3EB0|bw:|supabase|SEGRETO|\.jpg|aaaaaaa/.test(l)));
      c("…e qualcosa si è scritto davvero", true, tutti.some((l) => l.startsWith("[ponte-media]")));
      c("nessuna chiamata fuori da Supabase (fetch intatto)", 0, esterne);
    }

    /* ── 2.5 la lettura ──────────────────────────────────────────────────── */
    gruppo("PONTE · IMMAGINI · GET /api/crm/ponte-media (T5)");
    {
      const pronta = riga();
      let m = nuovoMondo(base({ ponte_wa_media: [pronta] }));
      m.oggetti = new Map([[pronta.path, 5000]]);
      let x = await leggiMedia(GET);
      c("sessione giusta, riga pronta: 200 con l'URL firmato", [200, true], [x.r.status, /^https:\/\/prova\.supabase\.co\/storage\/v1\/object\/sign\/ponte-media\//.test(x.json?.url)]);
      c("…ok e url, nient'altro", ["ok", "url"], Object.keys(x.json ?? {}).sort());
      c("…Cache-Control: no-store", "no-store", x.r.headers.get("cache-control"));
      c("…il link dura 300 secondi, nel bucket ponte-media", [{ azione: "lettura", bucket: "ponte-media", path: pronta.path, secondi: 300 }], m.firme);
      c("…il log non contiene niente (né numero, né chiave, né URL)", [], x.log.filter((l) => /3933|3EB0|bw:|supabase|SEGRETO|\.jpg/.test(l) || !/^\[ponte-media\] [a-z_]+( [a-z_]+=\d+)*$/.test(l)));
      c("…nessuna scrittura", 0, m.scritture.length);

      m = nuovoMondo(base({ ponte_wa_media: [pronta] }));
      x = await leggiMedia(GET, { sessione: "nessuna" });
      c("senza sessione: 401, il database non si tocca", [401, 0], [x.r.status, m.chiamate.length + m.rpc.length]);
      x = await leggiMedia(GET, { sessione: "altra" });
      c("sessione di un'altra installazione: 403, la riga non si legge", [403, "non_autorizzato", 0], [x.r.status, x.json?.motivo, m.chiamate.filter((q) => q.tabella === "ponte_wa_media").length]);
      c("…no-store anche sul 403", "no-store", x.r.headers.get("cache-control"));
      x = await leggiMedia(GET, { sessione: "vuota" });
      c("sessione senza installazione: 403", 403, x.r.status);

      m = nuovoMondo(base({ ponte_wa_media: [riga({ user_id: ALTRO_UTENTE })] }));
      m.oggetti = new Map([[pronta.path, 5000]]);
      x = await leggiMedia(GET);
      c("la riga è di un altro utente: 404, nessuna firma", [404, "non_trovata", 0], [x.r.status, x.json?.motivo, (m.firme ?? []).length]);
      m = nuovoMondo(base({ ponte_wa_media: [riga({ stato: "in_caricamento" })] }));
      m.oggetti = new Map([[pronta.path, 5000]]);
      x = await leggiMedia(GET);
      c("la riga è ancora in caricamento: 404", 404, x.r.status);
      m = nuovoMondo(base({ ponte_wa_media: [pronta] }));
      x = await leggiMedia(GET);
      c("la riga c'è ma l'oggetto in Storage no: 404", [404, "non_trovata"], [x.r.status, x.json?.motivo]);
      m = nuovoMondo(base());
      x = await leggiMedia(GET);
      c("nessuna riga: 404", 404, x.r.status);
      for (const id of [null, "", "bw:1:2", CHIAVE, NOME_PRONTA.replace(".jpg", ""), `${UTENTE}/${NOME_PRONTA}`, "x".repeat(400)]) {
        m = nuovoMondo(base({ ponte_wa_media: [pronta] }));
        x = await leggiMedia(GET, id === null ? { query: "" } : { id });
        c(`identificativo non valido (${id === null ? "assente" : id.slice(0, 8) || "vuoto"}): 400, la riga non si legge`, [400, 0], [x.r.status, m.chiamate.filter((q) => q.tabella === "ponte_wa_media").length]);
      }
      //  La vecchia forma (?chiave=bw:…, con il numero del cliente nell'indirizzo) non è più accettata.
      m = nuovoMondo(base({ ponte_wa_media: [pronta] }));
      m.oggetti = new Map([[pronta.path, 5000]]);
      x = await leggiMedia(GET, { query: `?chiave=${encodeURIComponent(CHIAVE)}` });
      c("la vecchia query ?chiave=bw:… non vale più: 400, nessuna riga letta", [400, 0], [x.r.status, m.chiamate.filter((q) => q.tabella === "ponte_wa_media").length]);
      //  Un guasto di Storage non è «foto sparita».
      m = nuovoMondo(base({ ponte_wa_media: [pronta] }), { lettura: "x" });
      m.oggetti = new Map([[pronta.path, 5000]]);
      x = await leggiMedia(GET);
      c("Storage risponde 503 alla firma: 503 storage (non 404), niente nel log che sia un percorso o un link", [503, "storage", []], [x.r.status, x.json?.motivo, x.log.filter((l) => /bbbbbbb|supabase|\.jpg|0b0b/.test(l) || !/^\[ponte-media\] [a-z_]+( [a-z_]+=\d+)*$/.test(l))]);
      c("…no-store anche qui", "no-store", x.r.headers.get("cache-control"));
      m = nuovoMondo(base({ ponte_wa_media: [pronta] }), { lettura_rete: "x" });
      m.oggetti = new Map([[pronta.path, 5000]]);
      x = await leggiMedia(GET);
      c("rete caduta verso Storage (errore senza stato): 503 storage", [503, "storage"], [x.r.status, x.json?.motivo]);
      m = nuovoMondo(base({ ponte_wa_media: [pronta] }), { ponte_wa_media: "08006" });
      x = await leggiMedia(GET);
      c("database guasto: 500 e il log dice solo il codice", [500, true], [x.r.status, x.log.every((l) => /^\[ponte-media\] [a-z_]+( [a-z_]+=\d+)*$/.test(l))]);
      m = nuovoMondo(base({ ponte_wa_media: [pronta] }), { ponte_wa_media: "42P01" });
      x = await leggiMedia(GET);
      c("tabella assente: 503 migrazione", [503, "migrazione"], [x.r.status, x.json?.motivo]);
      //  Dal 31/10: `uso` e i documenti (la logica fine è in media-regole.mjs; qui la rotta vera).
      const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const NOME_DOC = "ccccccc1-1111-4222-8333-444444444444.docx";
      const doc = riga({ path: `${UTENTE}/${NOME_DOC}`, mime: DOCX, categoria: "documento", nome: "Relazione", chiave: CHIAVE2 });
      m = nuovoMondo(base({ ponte_wa_media: [doc] }));
      m.oggetti = new Map([[doc.path, 5000]]);
      x = await leggiMedia(GET, { id: NOME_DOC, query: `?id=${NOME_DOC}&uso=apri` });
      c("documento, uso=apri: 200; il link è un allegato col nome ripulito e l'estensione del mime", [200, "Relazione.docx", 300], [x.r.status, m.firme[0]?.download, m.firme[0]?.secondi]);
      x = await leggiMedia(GET, { query: `?id=${NOME_DOC}` });
      c("documento senza uso (vale «vedi»): 400 uso_non_valido, nessuna firma", [400, "uso_non_valido", 1], [x.r.status, x.json?.motivo, m.firme.length]);
      x = await leggiMedia(GET, { query: `?id=${NOME_DOC}&uso=scarica` });
      c("uso inventato: 400 uso_non_valido", [400, "uso_non_valido"], [x.r.status, x.json?.motivo]);
      const film = riga({ path: `${UTENTE}/${NOME_PRONTA.replace(".jpg", ".mp4")}`, mime: "video/mp4", categoria: "video", chiave: CHIAVE2 });
      m = nuovoMondo(base({ ponte_wa_media: [film] }));
      m.oggetti = new Map([[film.path, 5000]]);
      x = await leggiMedia(GET, { query: `?id=${NOME_PRONTA.replace(".jpg", ".mp4")}&uso=video` });
      c("video, uso=video: 200 con il link da 1.800 secondi", [200, 1800], [x.r.status, m.firme[0]?.secondi]);
      m = nuovoMondo(base({ ponte_wa_media: [pronta] }));
      m.oggetti = new Map([[pronta.path, 5000]]);
      x = await leggiMedia(GET, { query: `?id=${NOME_PRONTA}&uso=video` });
      c("foto con uso=video: 400 uso_non_valido", [400, "uso_non_valido"], [x.r.status, x.json?.motivo]);
      x = await leggiMedia(GET, { query: `?id=${NOME_PRONTA}&uso=vedi` });
      c("foto con uso=vedi: 200 come senza uso", 200, x.r.status);

      const o = await OPTIONS({});
      c("OPTIONS: 204", 204, o.status);
      c("nessuna chiamata fuori da Supabase (fetch intatto)", 0, esterne);
    }
  } finally {
    globalThis.fetch = fetchVero;
    delete globalThis.__guardia;
    delete globalThis.__ponteMondo;
    rotte.chiudi();
  }
}
