/** ── PROVE: INVIO A MANO DAL PONTE · rotte e porte (compito T5) ──
 *
 *  Commessa 2026-10-30-ponte-invio-manuale. Le DUE rotte VERE
 *  (`api.public.ponte-whatsapp.ts`, che ora serve anche `prendi` ed `esito`, e
 *  `api.crm.ponte-invio.ts`, quella del browser) si impacchettano con esbuild
 *  insieme a `invio-giro.ts`, `ingresso.ts` e alle porte VERE
 *  (`invio.server.ts`); finti solo il router, la sessione (`guardiaCRM`) e il
 *  client Supabase con la chiave di servizio, che diventa il database in
 *  memoria di `rotta.mjs` (`MONDO_FINTO`, NON toccato) più la coda
 *  `ponte_wa_invii` e le tre funzioni SQL dell'invio, dette in JavaScript.
 *  ⚠️ Le funzioni finte servono a far girare il codice TypeScript vero, non a
 *   provare l'SQL: l'SQL lo prova `prove/sql/ponte-invio.sql` su Postgres vero.
 *  `fetch` è un allarme: le rotte non chiamano nessuno fuori dal database.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { build } from "esbuild";
import { MONDO_FINTO, PERCORSO, TOKEN, UTENTE, chiama, nuovoMondo } from "./rotta.mjs";

const ALTRO_UTENTE = "99999999-1111-4222-8333-444444444444";
const NOTO = "393330000101";
const SECONDO = "393330000102";
const PERCORSO_BROWSER = "/api/crm/ponte-invio";

/** La coda e le tre funzioni dell'invio, sopra il mondo finto di `rotta.mjs`. */
const MONDO_INVII =
  MONDO_FINTO.replace("export const supabaseAdmin", "const supabaseBase") +
  `
let __n = 0;
const uuid = () => "a0a0a0a0-0000-4000-8000-" + String(++__n).padStart(12, "0");
const adesso = () => new Date().toISOString();
const proietta = (r, cols) => Object.fromEntries(cols.map((k) => [k, r[k] ?? null]));

/** ponte_wa_invii: eq, is, in, lt, gte, limit, insert, update, delete, count. */
function tabellaInvii() {
  const filtri = [];
  const c = { azione: "select", valori: null, colonne: null, tetto: Infinity, uno: false, conta: false, ritorno: null };
  const q = {
    select: (cols, o) => { if (c.azione === "select") { c.colonne = cols.split(",").map((s) => s.trim()); c.conta = !!(o && o.count); } else c.ritorno = cols.split(",").map((s) => s.trim()); return q; },
    insert: (v) => ((c.azione = "insert"), (c.valori = v), q),
    update: (v) => ((c.azione = "update"), (c.valori = v), q),
    delete: () => ((c.azione = "delete"), q),
    eq: (k, v) => (filtri.push((r) => r[k] === v), q),
    is: (k, v) => (filtri.push((r) => (r[k] ?? null) === v), q),
    in: (k, v) => (filtri.push((r) => v.includes(r[k])), q),
    lt: (k, v) => (filtri.push((r) => r[k] != null && r[k] < v), q),
    gte: (k, v) => (filtri.push((r) => r[k] != null && r[k] >= v), q),
    limit: (n) => ((c.tetto = n), q),
    maybeSingle: () => ((c.uno = true), q),
    single: () => ((c.uno = true), q),
    then: (ok, no) => Promise.resolve(esegui()).then(ok, no),
  };
  function esegui() {
    st().chiamate.push({ tabella: "ponte_wa_invii", azione: c.azione });
    const g = guasto("ponte_wa_invii");
    if (g) return g;
    const tutte = righe("ponte_wa_invii");
    if (c.azione === "select") {
      const r = tutte.filter((x) => filtri.every((f) => f(x)));
      const out = r.slice(0, c.tetto).map((x) => proietta(x, c.colonne));
      return { data: c.uno ? (out[0] ?? null) : out, error: null, count: c.conta ? r.length : null };
    }
    if (c.azione === "insert") {
      scritto("ponte_wa_invii", "insert", Object.keys(c.valori), "diretta");
      if (tutte.some((x) => x.user_id === c.valori.user_id && x.chiave === c.valori.chiave))
        return { data: null, error: { code: "23505", message: "duplicate key 393330000101 Anna Finta" } };
      const riga = { id: uuid(), stato: "in_attesa", motivo: null, preso_il: null, inviato_il: null, wa_message_id: null, created_at: adesso(), aggiornato_il: adesso(), ...c.valori };
      tutte.push(riga);
      const out = proietta(riga, c.ritorno ?? ["id"]);
      return { data: c.uno ? out : [out], error: null };
    }
    const toccate = tutte.filter((x) => filtri.every((f) => f(x)));
    if (c.azione === "update") {
      scritto("ponte_wa_invii", "update", Object.keys(c.valori), "diretta");
      for (const r of toccate) Object.assign(r, c.valori);
      return { data: toccate.map((r) => proietta(r, c.ritorno ?? ["stato"])), error: null };
    }
    scritto("ponte_wa_invii", "delete", [], "diretta");
    st().tab.ponte_wa_invii = tutte.filter((x) => !toccate.includes(x));
    return { data: null, error: null };
  }
  return q;
}

const contattoDi = (u, n) => righe("whatsapp_contacts").find((x) => x.user_id === u && (x.phone_e164 === "+" + n || x.phone_e164 === n));

/** ponte_wa_invio_fatti: «ha già una chat», STOP, ponte, prelievi, righe aperte. */
function fattiInvio(a) {
  const u = a.p_user_id, n = a.p_numero;
  const k = contattoDi(u, n);
  const entrata = righe("whatsapp_messages").some((m) => m.user_id === u && m.direction === "inbound" && (m.from_number === "+" + n || m.from_number === n)) || !!k?.ultimo_in_entrata_il;
  const p = righe("ponte_wa_stato").find((x) => x.user_id === u);
  const inv = righe("ponte_wa_invii").filter((x) => x.user_id === u);
  return {
    entrata, stop: !!k?.non_scrivere_dal, ponte_stato: p?.stato ?? null, ponte_battito: p?.aggiornato_il ?? null,
    invii_attivi: p?.contatori?.invii_attivi === 1,
    ultime24h: inv.filter((x) => x.preso_il && Date.parse(x.preso_il) > Date.now() - 24 * 3600e3).length,
    in_coda: inv.filter((x) => x.stato === "in_attesa" || x.stato === "in_invio").length,
  };
}

/** ponte_wa_invii_prendi: scade, intervallo, tetto, STOP/mai scritto, una riga a in_invio. */
function prendiInvii(a) {
  const u = a.p_user_id, ora = Date.now();
  const inv = righe("ponte_wa_invii").filter((x) => x.user_id === u);
  const out = { invio: null, attendi_s: 0, limite: false, scaduti: 0, incerti: 0, respinti: 0 };
  for (const r of inv) {
    if (r.stato === "in_attesa" && Date.parse(r.created_at) < ora - a.p_scadenza_min * 60e3) { r.stato = "non_inviato"; r.motivo = "scaduto"; out.scaduti++; }
    if (r.stato === "in_invio" && Date.parse(r.preso_il ?? r.created_at) < ora - a.p_incerto_min * 60e3) { r.stato = "non_inviato"; r.motivo = "esito_incerto"; out.incerti++; }
  }
  const attesa = inv.filter((x) => x.stato === "in_attesa").sort((p, q) => (p.created_at < q.created_at ? -1 : 1));
  if (!attesa.length) return out;
  const ultimo = Math.max(0, ...inv.filter((x) => x.preso_il).map((x) => Date.parse(x.preso_il)));
  if (ultimo > ora - a.p_intervallo_s * 1000) { out.attendi_s = Math.ceil((ultimo + a.p_intervallo_s * 1000 - ora) / 1000); return out; }
  if (inv.filter((x) => x.preso_il && Date.parse(x.preso_il) > ora - 24 * 3600e3).length >= a.p_al_giorno) { out.attendi_s = 3600; out.limite = true; return out; }
  for (const r of attesa) {
    const f = fattiInvio({ p_user_id: u, p_numero: r.numero });
    if (f.stop) { r.stato = "non_inviato"; r.motivo = "stop"; out.respinti++; continue; }
    if (!f.entrata) { r.stato = "non_inviato"; r.motivo = "mai_scritto"; out.respinti++; continue; }
    r.stato = "in_invio"; r.preso_il = adesso();
    out.invio = { id: r.id, numero: r.numero, testo: r.testo };
    return out;
  }
  return out;
}

/** ponte_wa_invio_esito: le regole del testo SQL, in JavaScript. */
function esitoInvii(a) {
  const r = righe("ponte_wa_invii").find((x) => x.user_id === a.p_user_id && x.id === a.p_id);
  if (!r) return { ok: false, stato: null, nuovo: false };
  if (a.p_esito === "inviato") {
    if (r.stato === "inviato") return { ok: true, stato: "inviato", nuovo: false };
    const wa = a.p_wa_id ?? "";
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(wa) || !(r.stato === "in_invio" || (r.stato === "non_inviato" && r.motivo === "esito_incerto")))
      return { ok: false, stato: r.stato, nuovo: false };
    let quando = Date.now();
    const da = Date.parse(r.preso_il ?? r.created_at);
    if (a.p_ts && a.p_ts * 1000 >= da - 60e3 && a.p_ts * 1000 <= Date.now() + 600e3) quando = a.p_ts * 1000;
    const iso0 = new Date(quando).toISOString();
    r.stato = "inviato"; r.motivo = null; r.wa_message_id = wa; r.inviato_il = iso0; r.aggiornato_il = adesso();
    const msg = righe("whatsapp_messages");
    const chiave = "bw:" + r.numero + ":" + wa;
    if (!msg.some((m) => m.wa_message_id === chiave)) {
      const riga = { id: "e-" + (msg.length + 1) + "-0000-4000-8000-000000000000", user_id: a.p_user_id, wa_message_id: chiave, direction: "outbound",
        from_number: "baileys", to_number: "+" + r.numero, body: r.testo, status: "sent", canale: "baileys", created_at: iso0, raw_payload: {} };
      msg.push(riga);
      scritto("whatsapp_messages", "insert", Object.keys(riga).filter((k) => k !== "id"), "ponte_wa_invio_esito");
    }
    const k = contattoDi(a.p_user_id, r.numero);
    const ora = adesso();
    const vero = iso0 < ora ? iso0 : ora;
    if (k) {
      k.last_message_at = !k.last_message_at || iso0 > k.last_message_at ? iso0 : k.last_message_at;
      k.risposto_il = !k.risposto_il || vero > k.risposto_il ? vero : k.risposto_il;
      k.updated_at = ora;
      scritto("whatsapp_contacts", "update", ["last_message_at", "risposto_il", "updated_at"], "ponte_wa_invio_esito");
    } else {
      righe("whatsapp_contacts").push({ user_id: a.p_user_id, phone_e164: "+" + r.numero, last_message_at: iso0, risposto_il: vero, origine: "baileys", unread_count: 0 });
      scritto("whatsapp_contacts", "insert", ["user_id", "phone_e164", "last_message_at", "risposto_il", "origine"], "ponte_wa_invio_esito");
    }
    return { ok: true, stato: "inviato", nuovo: true };
  }
  if (a.p_esito === "errore") {
    if (r.stato === "non_inviato") return { ok: true, stato: "non_inviato", nuovo: false };
    if (r.stato !== "in_invio") return { ok: false, stato: r.stato, nuovo: false };
    const ammessi = ["mai_scritto", "stop", "scaduto", "non_collegato", "numero_non_valido", "testo_non_valido", "limite_ponte", "esito_incerto", "errore_invio"];
    r.stato = "non_inviato"; r.motivo = ammessi.includes(a.p_motivo) ? a.p_motivo : "errore_invio"; r.aggiornato_il = adesso();
    return { ok: true, stato: "non_inviato", nuovo: true };
  }
  return { ok: false, stato: r.stato, nuovo: false };
}

export const supabaseAdmin = {
  from: (t) => (t === "ponte_wa_invii" ? tabellaInvii() : supabaseBase.from(t)),
  rpc: async (fn, a) => {
    if (!fn.startsWith("ponte_wa_inv")) return supabaseBase.rpc(fn, a);
    st().rpc.push({ fn, args: JSON.parse(JSON.stringify(a)) });
    const g = guasto(fn);
    if (g) return g;
    if (fn === "ponte_wa_invio_fatti") return { data: fattiInvio(a), error: null };
    if (fn === "ponte_wa_invii_prendi") return { data: prendiInvii(a), error: null };
    if (fn === "ponte_wa_invio_esito") return { data: esitoInvii(a), error: null };
    return { data: null, error: { code: "42883", message: "function does not exist" } };
  },
};`;

/** Le due rotte vere, con router, sessione e database finti. */
async function caricaRotte(radice) {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-invio-rotte-"));
  const finta = join(cartella, "supabase-finto.js");
  writeFileSync(finta, MONDO_INVII);
  const file = join(cartella, "rotte.cjs");
  await build({
    stdin: {
      contents: `export { Route as RottaMac } from "@/routes/api.public.ponte-whatsapp";\nexport { Route as RottaBrowser } from "@/routes/api.crm.ponte-invio";`,
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

/** Esegue `f` catturando tutti i log. */
async function conLog(f) {
  const livelli = ["log", "info", "warn", "error", "debug"];
  const veri = Object.fromEntries(livelli.map((k) => [k, console[k]]));
  const log = [];
  for (const k of livelli) console[k] = (...a) => log.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  try {
    return { ...(await f()), log };
  } finally {
    for (const k of livelli) console[k] = veri[k];
  }
}

/** La rotta del browser, con la sessione scelta dalla prova. */
async function chiamaBrowser(POST, { corpo, sessione = "ok", nome = "Anna Finta", testoGrezzo }) {
  globalThis.__guardia = async () =>
    sessione === "nessuna"
      ? { ok: false, risposta: new Response(JSON.stringify({ error: "Accedi al CRM." }), { status: 401 }) }
      : { ok: true, chi: { adminUserId: sessione === "altra" ? ALTRO_UTENTE : sessione === "vuota" ? "" : UTENTE, nome } };
  return conLog(async () => {
    const request = new Request(`https://sito.test${PERCORSO_BROWSER}`, {
      method: "POST",
      headers: { authorization: "Bearer finto" },
      body: testoGrezzo ?? JSON.stringify(corpo),
      duplex: "half",
    });
    const r = await POST({ request });
    const testo = await r.text();
    let json = null;
    try {
      json = JSON.parse(testo);
    } catch {
      json = null;
    }
    return { r, json };
  });
}

/** SPEC 6: giro, promemoria e hook non nominano mai la coda né le porte dell'invio. */
//  `ponte/invio.server` e non solo `invio.server`: ManyChat ha un suo `invio.server` che non c'entra.
const NOMI_DELL_INVIO = ["ponte_wa_invii", "ponte-invio", "invio-giro", "ponte/invio.server", "PorteInvio", "ponte_wa_invio"];
const senzaCommenti = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function fileSotto(cartella, estensioni) {
  try {
    return readdirSync(cartella, { recursive: true })
      .map(String)
      .filter((f) => estensioni.some((e) => f.endsWith(e)))
      .map((f) => join(cartella, f));
  } catch {
    return [];
  }
}

/** Le violazioni della regola SPEC 6 sotto `radice`: l'elenco di `file: nome`. */
export function violazioniSpec6(radice) {
  const v = [];
  const dentro = [
    ...["src/crm/manychat", "src/crm/promemoria", "src/routes/hooks"].flatMap((d) => fileSotto(join(radice, d), [".ts", ".tsx"])),
    ...fileSotto(join(radice, "supabase"), [".sql", ".toml"]).filter((f) => !f.endsWith("20261030120000_ponte_invio_manuale.sql")),
  ];
  for (const f of dentro) {
    const t = senzaCommenti(readFileSync(f, "utf8"));
    for (const n of NOMI_DELL_INVIO) if (t.includes(n)) v.push(`${relative(radice, f)}: ${n}`);
  }
  //  La rotta del browser la chiama solo il suo hook (e la rotta stessa).
  const ammessi = ["api.crm.ponte-invio.ts", "usaInvioPonte.ts", "routeTree.gen.ts"];
  for (const f of fileSotto(join(radice, "src"), [".ts", ".tsx"])) {
    if (ammessi.some((a) => f.endsWith(a))) continue;
    if (senzaCommenti(readFileSync(f, "utf8")).includes("api/crm/ponte-invio")) v.push(`${relative(radice, f)}: api/crm/ponte-invio`);
  }
  return v;
}

export async function provePonteInvioRotta(mod, { c, gruppo, radice }) {
  const T = mod["ponte/invio-tipi"];
  const I = mod["ponte/invio"];
  const L = T.LIMITI_INVIO;
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const rottaMac = leggi("src/routes/api.public.ponte-whatsapp.ts");
  const rottaWeb = leggi("src/routes/api.crm.ponte-invio.ts");
  const porteSrc = leggi("src/crm/ponte/invio.server.ts");
  const albero = leggi("src/routeTree.gen.ts");

  /* ═══ 1. I SORGENTI ══════════════════════════════════════════════════════ */
  gruppo("PONTE · INVIO A MANO · ROTTE E PORTE · SORGENTI (T5)");
  {
    const web = senzaCommenti(rottaWeb);
    c("rotta del browser: il percorso giusto", true, web.includes(`createFileRoute("${PERCORSO_BROWSER}")`));
    c("rotta del browser: solo OPTIONS e POST", ["OPTIONS", "POST"], [...web.matchAll(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*:/g)].map((x) => x[1]));
    c("rotta del browser: guardiaCRM(request, cors, null), una volta, e l'installazione della sessione", [1, 1, 1], [(web.match(/guardiaCRM\(request, cors, null\)/g) ?? []).length, (web.match(/guardiaCRM\(/g) ?? []).length, (web.match(/adminUserId/g) ?? []).length > 0 ? 1 : 0]);
    c("rotta del browser: corpo al più 16 KB, letto a flusso", [true, true], [/CORPO_MAX_BYTE\s*=\s*16_384/.test(web), /leggiCorpoLimitato\(request\.body, CORPO_MAX_BYTE\)/.test(web)]);
    c("rotta del browser: no-store, niente console né fetch", [true, false, false], [web.includes("no-store"), /console\./.test(web), /\bfetch\s*\(/.test(web)]);
    c("rotta del browser: i soli import", ["./api.crm.accesso", "@/crm/manychat/ritorno", "@/crm/ponte/invio-giro", "@/crm/ponte/invio.server", "@tanstack/react-router"], [...web.matchAll(/from\s+"([^"]+)"/g)].map((x) => x[1]).sort());
    const mac = senzaCommenti(rottaMac);
    c("rotta del ponte: passa le porte dell'invio, il resto invariato", [true, true], [mac.includes("gestisciRichiesta(porteIngresso()"), mac.includes("invii: porteInvio()")]);
    c("routeTree.gen.ts importa la rotta del browser, una volta sola", [true, true, 1], [albero.includes("import { Route as ApiCrmPonteInvioRouteImport } from './routes/api.crm.ponte-invio'"), albero.includes(`'${PERCORSO_BROWSER}'`), (albero.match(/ApiCrmPonteInvioRoute: ApiCrmPonteInvioRoute,/g) ?? []).length]);
    const porte = senzaCommenti(porteSrc);
    c("porte: le tre funzioni SQL dell'invio per nome, e nessun'altra", ["ponte_wa_invii_prendi", "ponte_wa_invio_esito", "ponte_wa_invio_fatti"], [...new Set([...porte.matchAll(/\.rpc(?:<.*?>)?\(\s*"(\w+)"/g)].map((x) => x[1]))].sort());
    c("porte: le sole tabelle sono manychat_config e ponte_wa_invii (mai i messaggi, mai i contatti)", ["manychat_config", "ponte_wa_invii"], [...new Set([...porte.matchAll(/\.from\(\s*(?:"(\w+)"|(\w+))/g)].map((x) => x[1] ?? (x[2] === "TABELLA" ? "ponte_wa_invii" : x[2])))].sort());
    c("porte: la chiave di servizio con il cast, mai il messaggio d'errore", [true, false], [porte.includes("supabaseAdmin as unknown as"), /\.message\b/.test(porte)]);
    c("porte: STOP e «ha già una chat» non si leggono qui (stanno nella funzione SQL)", [], ["non_scrivere_dal", "ultimo_in_entrata", "unread_count", "crm_leads", "whatsapp_contacts", "whatsapp_messages"].filter((n) => porte.includes(n)));
    const corpo = (nome) => porte.match(new RegExp(`${nome}: async \\([^)]*\\) => \\{([\\s\\S]*?)\\n    \\},`))?.[1] ?? "";
    c("porte: inviatiDalCrm e inAttesa hanno try/catch e non rilanciano", [true, true, false], [/try \{/.test(corpo("inviatiDalCrm")) && /catch \{/.test(corpo("inviatiDalCrm")), /try \{/.test(corpo("inAttesa")) && /catch \{/.test(corpo("inAttesa")), /lancia\(/.test(corpo("inviatiDalCrm") + corpo("inAttesa"))]);
    c("porte: prendi passa i limiti di LIMITI_INVIO come parametri", [true, true, true, true], ["intervalloS", "alGiorno", "scadenzaMin", "incertoMin"].map((k) => porte.includes(`LIMITI_INVIO.${k}`)));
  }

  /* ═══ 2. SPEC 6: IL GIRO NON USA MAI IL PONTE PER INVIARE ════════════════ */
  gruppo("PONTE · INVIO A MANO · SPEC 6: IL GIRO NON USA MAI IL PONTE (T5)");
  {
    c("sotto manychat, promemoria, hook e nelle migrazioni esistenti nessun nome dell'invio a mano; /api/crm/ponte-invio solo dove deve", [], violazioniSpec6(radice));
    //  Prova negativa: una copia con uno di quei nomi in `src/crm/manychat/` fa fallire la regola.
    const copia = mkdtempSync(join(tmpdir(), "ponte-spec6-"));
    try {
      for (const d of ["src/crm/manychat", "src/crm/promemoria", "src/routes/hooks", "supabase"]) cpSync(join(radice, d), join(copia, d), { recursive: true });
      mkdirSync(join(copia, "src/chat"), { recursive: true });
      c("la copia intatta passa", [], violazioniSpec6(copia));
      writeFileSync(join(copia, "src/crm/manychat/intruso.ts"), `import { porteInvio } from "../ponte/invio.server";\nexport const x = porteInvio;\n`);
      c("negativa: un file sotto manychat che nomina invio.server fa fallire la regola", true, violazioniSpec6(copia).some((v) => v.includes("manychat/intruso.ts")));
      rmSync(join(copia, "src/crm/manychat/intruso.ts"));
      writeFileSync(join(copia, "src/routes/hooks/intruso.ts"), `const t = "ponte_wa_invii";\n`);
      c("negativa: un hook che nomina ponte_wa_invii fa fallire la regola", true, violazioniSpec6(copia).some((v) => v.includes("hooks/intruso.ts")));
      rmSync(join(copia, "src/routes/hooks/intruso.ts"));
      writeFileSync(join(copia, "supabase/migrations/20260101000000_intruso.sql"), `select public.ponte_wa_invii_prendi(null);\n`);
      c("negativa: una migrazione o un cron che chiama ponte_wa_invii_prendi fa fallire la regola", true, violazioniSpec6(copia).some((v) => v.includes("20260101000000_intruso.sql")));
      rmSync(join(copia, "supabase/migrations/20260101000000_intruso.sql"));
      writeFileSync(join(copia, "src/chat/altro.ts"), `fetch("/api/crm/ponte-invio");\n`);
      c("negativa: un altro file che chiama /api/crm/ponte-invio fa fallire la regola", true, violazioniSpec6(copia).some((v) => v.includes("chat/altro.ts")));
    } finally {
      rmSync(copia, { recursive: true, force: true });
    }
  }

  /* ═══ 3. LE ROTTE VERE ═══════════════════════════════════════════════════ */
  const fetchVero = globalThis.fetch;
  let esterne = 0;
  globalThis.fetch = () => {
    esterne++;
    throw new Error("le rotte non devono chiamare nessuno");
  };
  const rotte = await caricaRotte(radice);
  try {
    const ADESSO = Date.now();
    const iso = (deltaS) => new Date(ADESSO + deltaS * 1000).toISOString();
    const s = (i) => Math.floor(Date.parse(i) / 1000);
    /** l'ora vera dell'invio come la riporta il Mac: secondi interi */
    const vero = (deltaS) => new Date(s(iso(deltaS)) * 1000).toISOString();
    const ID1 = "b1b1b1b1-1111-4222-8333-444444444441";
    const ID2 = "b1b1b1b1-1111-4222-8333-444444444442";
    const ID3 = "b1b1b1b1-1111-4222-8333-444444444443";
    const ID4 = "b1b1b1b1-1111-4222-8333-444444444444";
    const CRM_ID = "c0c0c0c0-1111-4222-8333-000000000001";
    const riga = (o = {}) => ({
      id: ID1, user_id: UTENTE, chiave: "chiave-di-prova-1", numero: NOTO, testo: "Buongiorno Anna, ti aspetto domani", stato: "in_attesa", motivo: null,
      creato_da: "Anna Finta", wa_message_id: null, created_at: iso(-30), preso_il: null, inviato_il: null, aggiornato_il: iso(-30), ...o,
    });
    /** Un mondo in cui tutto va bene: ponte collegato, invii accesi, il cliente ha scritto. */
    const base = (extra = {}) => ({
      manychat_config: [{ id: 1, user_id: UTENTE }],
      whatsapp_contacts: [{ user_id: UTENTE, phone_e164: "+" + NOTO, display_name: null, unread_count: 2, last_message_at: iso(-3 * 86400), non_scrivere_dal: null }],
      whatsapp_messages: [{ id: "m-in-1", user_id: UTENTE, wa_message_id: "mc-in-1", direction: "inbound", from_number: "+" + NOTO, to_number: "manychat", body: "Ciao, vorrei info", status: "delivered", canale: "manychat", created_at: iso(-2 * 86400) }],
      ponte_wa_stato: [{ user_id: UTENTE, stato: "collegato", aggiornato_il: iso(-10), contatori: { invii_attivi: 1 } }],
      ponte_wa_invii: [],
      crm_leads: [],
      ...extra,
    });
    const lotto = (messaggi) => ({ v: 1, tipo: "lotto", origine: "vivo", messaggi, nomi: {} });
    const eco = (o = {}) => ({ id: "3EB0EC01", numero: NOTO, dir: "out", ts: s(iso(-20)), testo: "Buongiorno Anna, ti aspetto domani", tipo: "testo", stato: "sent", ...o });
    const battito = { v: 1, tipo: "battito", stato: "collegato", collegato_dal: iso(-600), ultimo_messaggio_il: iso(-30), storico: { fatto: true, avanzamento: 100 }, in_coda: 0, scartati: 0, versione: "7.0.0-rc14" };
    const preso = (corpo, o = {}) => ({ v: 1, tipo: "prendi", ...corpo, ...o });

    let { RottaMac, RottaBrowser } = rotte.carica();
    let POST = RottaMac.options.server.handlers.POST;
    let POSTWEB = RottaBrowser.options.server.handlers.POST;
    const ricarica = () => {
      ({ RottaMac, RottaBrowser } = rotte.carica());
      POST = RottaMac.options.server.handlers.POST;
      POSTWEB = RottaBrowser.options.server.handlers.POST;
    };

    /* ── 3a. Il Mac: chiave, dimensione, corpo ───────────────────────────── */
    gruppo("PONTE · INVIO A MANO · IL MAC: PRENDI ED ESITO · PROTEZIONE (T5)");
    {
      c("le rotte hanno solo i gestori attesi", [["POST"], ["OPTIONS", "POST"]], [Object.keys(RottaMac.options.server.handlers), Object.keys(RottaBrowser.options.server.handlers).sort()]);
      let m = nuovoMondo(base({ ponte_wa_invii: [riga()] }));
      let letto = false;
      const flusso = new ReadableStream({ pull() { letto = true; throw new Error("il corpo non si legge senza chiave"); } }, { highWaterMark: 0 });
      let x = await chiama(POST, { flusso, chiave: undefined });
      c("prendi senza chiave: 401, il corpo non si legge", [401, false, 0], [x.r.status, letto, m.chiamate.length + m.rpc.length]);
      for (const corpo of [preso(), { v: 1, tipo: "esito", id: ID1, esito: "inviato", wa_id: "3EB0A1" }]) {
        x = await chiama(POST, { corpo, chiave: "sbagliata" });
        c(`${corpo.tipo} con la chiave sbagliata: 401 e il database non si tocca`, [401, 0], [x.r.status, m.chiamate.length + m.rpc.length]);
        x = await chiama(POST, { corpo, token: undefined });
        c(`${corpo.tipo} con il segreto assente: 503`, 503, x.r.status);
        x = await chiama(POST, { corpo, token: "corto", chiave: "corto" });
        c(`${corpo.tipo} con il segreto corto: 503`, 503, x.r.status);
      }
      x = await chiama(POST, { corpo: "a".repeat(262145) });
      c("corpo oltre 256 KB: 413", 413, x.r.status);
      c("nessuna di queste ha toccato la coda", [{ stato: "in_attesa" }], m.tab.ponte_wa_invii.map(({ stato }) => ({ stato })));

      //  senza le porte dell'invio (come un ponte che non le conosce) prendi/esito sono corpo non valido
      const G = mod["ponte/ingresso"];
      const porteVuote = { avviso() {}, utente: async () => UTENTE };
      for (const corpo of [preso(), { v: 1, tipo: "esito", id: ID1, esito: "errore" }]) {
        const r = await G.gestisciRichiesta(porteVuote, { request: new Request("https://sito.test/x", { method: "POST", headers: { "x-hgl-token": TOKEN }, body: JSON.stringify(corpo) }), segreto: TOKEN, adesso: new Date() });
        c(`${corpo.tipo} senza le porte dell'invio: 400 corpo_non_valido, come prima`, [400, "corpo_non_valido"], [r.status, (await r.json()).errore]);
      }
    }

    /* ── 3b. Il Mac: il prelievo ─────────────────────────────────────────── */
    gruppo("PONTE · INVIO A MANO · IL MAC: IL PRELIEVO (T5)");
    {
      const m = nuovoMondo(base({ ponte_wa_invii: [riga(), riga({ id: ID2, chiave: "chiave-di-prova-2", testo: "Secondo", created_at: iso(-20) }), riga({ id: ID3, user_id: ALTRO_UTENTE, chiave: "altra-chiave-1" })] }));
      const x = await chiama(POST, { corpo: preso({ user_id: ALTRO_UTENTE }) });
      c("prendi: 200 con la riga più vecchia, nella forma del contratto", [200, { ok: true, invio: { id: ID1, numero: NOTO, testo: "Buongiorno Anna, ti aspetto domani" }, attendi_s: 0, limite: false }], [x.r.status, x.json]);
      const rpc = m.rpc.find((r) => r.fn === "ponte_wa_invii_prendi");
      c("prendi: l'utente viene dal database, mai dal corpo", UTENTE, rpc?.args.p_user_id);
      c("prendi: i quattro limiti arrivano da LIMITI_INVIO", { p_intervallo_s: L.intervalloS, p_al_giorno: L.alGiorno, p_scadenza_min: L.scadenzaMin, p_incerto_min: L.incertoMin }, { p_intervallo_s: rpc.args.p_intervallo_s, p_al_giorno: rpc.args.p_al_giorno, p_scadenza_min: rpc.args.p_scadenza_min, p_incerto_min: rpc.args.p_incerto_min });
      c("prendi: la riga passa a in_invio, quella dell'altro utente non si tocca", ["in_invio", "in_attesa"], [m.tab.ponte_wa_invii.find((r) => r.id === ID1).stato, m.tab.ponte_wa_invii.find((r) => r.id === ID3).stato]);
      const y = await chiama(POST, { corpo: preso() });
      c("un secondo prendi subito dopo: attende (l'intervallo), non offre mai l'in_invio", [true, null, false], [y.json.attendi_s > 0, y.json.invio, y.json.limite]);
      c("prendi con un corpo senza v: 400", 400, (await chiama(POST, { corpo: { tipo: "prendi" } })).r.status);
      c("nei log solo codici: niente testo, numeri o id", [], [...x.log, ...y.log].filter((l) => !l.startsWith("[ponte-invio] ") || [NOTO, "Buongiorno", "Anna", ID1, UTENTE].some((v) => l.includes(v))));
    }

    /* ── 3c. Il Mac: l'esito ─────────────────────────────────────────────── */
    gruppo("PONTE · INVIO A MANO · IL MAC: L'ESITO (T5)");
    {
      const m = nuovoMondo(base({ ponte_wa_invii: [riga({ stato: "in_invio", preso_il: iso(-20) }), riga({ id: ID2, chiave: "chiave-di-prova-2", stato: "in_attesa" }), riga({ id: ID3, user_id: ALTRO_UTENTE, chiave: "altra-chiave-1", stato: "in_invio", preso_il: iso(-10) })] }));
      const esito = (o = {}) => ({ v: 1, tipo: "esito", id: ID1, esito: "inviato", wa_id: "3EB0A1", ts: s(iso(-5)), ...o });
      const x = await chiama(POST, { corpo: { ...esito(), user_id: ALTRO_UTENTE } });
      c("esito inviato: 200 con lo stato", [200, { ok: true, stato: "inviato" }], [x.r.status, x.json]);
      const bw = m.tab.whatsapp_messages.filter((r) => r.wa_message_id === `bw:${NOTO}:3EB0A1`);
      c("esito inviato: una riga del ponte, uscita, con il testo e l'ora vera", [1, "outbound", "baileys", "Buongiorno Anna, ti aspetto domani", vero(-5)], [bw.length, bw[0]?.direction, bw[0]?.canale, bw[0]?.body, bw[0]?.created_at]);
      c("esito inviato: l'utente viene dal database, mai dal corpo", [UTENTE], [...new Set(m.rpc.filter((r) => r.fn === "ponte_wa_invio_esito").map((r) => r.args.p_user_id))]);
      const contatto = m.tab.whatsapp_contacts[0];
      c("esito inviato: il contatto fa uscire la chat da «Da rispondere», senza toccare i non letti", [vero(-5), 2], [contatto.risposto_il, contatto.unread_count]);
      const y = await chiama(POST, { corpo: esito() });
      c("esito ripetuto (rete persa): 200, stessa risposta, una sola riga del ponte", [200, { ok: true, stato: "inviato" }, 1], [y.r.status, y.json, m.tab.whatsapp_messages.filter((r) => r.canale === "baileys").length]);
      const z = await chiama(POST, { corpo: esito({ id: ID3 }) });
      c("esito per la riga di un altro utente: 404 sconosciuto, la riga non si tocca", [404, "sconosciuto", "in_invio"], [z.r.status, z.json?.errore, m.tab.ponte_wa_invii.find((r) => r.id === ID3).stato]);
      const w = await chiama(POST, { corpo: esito({ id: "b1b1b1b1-1111-4222-8333-4444444449ff" }) });
      c("esito per una riga che non c'è: 404 sconosciuto", [404, "sconosciuto"], [w.r.status, w.json?.errore]);
      const a = await chiama(POST, { corpo: esito({ id: ID2, wa_id: "3EB0A2" }) });
      c("esito su una riga ancora in_attesa: 409 stato_non_ammesso, niente si chiude, nessuna riga del ponte", [409, "stato_non_ammesso", "in_attesa", 1], [a.r.status, a.json?.errore, m.tab.ponte_wa_invii.find((r) => r.id === ID2).stato, m.tab.whatsapp_messages.filter((r) => r.canale === "baileys").length]);
      const b = await chiama(POST, { corpo: esito({ id: ID2, esito: "errore", motivo: "non_collegato" }) });
      c("esito errore su una riga in_attesa: 409 anche lui", [409, "stato_non_ammesso"], [b.r.status, b.json?.errore]);
      for (const [nome, corpo] of [["wa_id vuoto", esito({ wa_id: "" })], ["wa_id con caratteri vietati", esito({ wa_id: "../x" })], ["id che non è un uuid", esito({ id: "uno" })], ["esito sconosciuto", esito({ esito: "forse" })]]) {
        const r = await chiama(POST, { corpo });
        c(`esito con ${nome}: 400 corpo_non_valido`, [400, "corpo_non_valido"], [r.r.status, r.json?.errore]);
      }

      //  errore: il motivo passa solo se è della lista
      const m2 = nuovoMondo(base({ ponte_wa_invii: [riga({ stato: "in_invio", preso_il: iso(-20) }), riga({ id: ID2, chiave: "chiave-di-prova-2", stato: "in_invio", preso_il: iso(-20) })] }));
      const e1 = await chiama(POST, { corpo: { v: 1, tipo: "esito", id: ID1, esito: "errore", motivo: "esito_incerto" } });
      const e2 = await chiama(POST, { corpo: { v: 1, tipo: "esito", id: ID2, esito: "errore", motivo: "qualcosa di mio" } });
      c("esito errore: 200 non_inviato, motivo della lista o errore_invio", [200, 200, "non_inviato", "esito_incerto", "errore_invio"], [e1.r.status, e2.r.status, e1.json?.stato, m2.tab.ponte_wa_invii[0].motivo, m2.tab.ponte_wa_invii[1].motivo]);
      const e3 = await chiama(POST, { corpo: { v: 1, tipo: "esito", id: ID1, esito: "inviato", wa_id: "3EB0A9" } });
      c("esito inviato dopo esito_incerto: la verità vince sul dubbio", [200, "inviato"], [e3.r.status, e3.json?.stato]);
      const e4 = await chiama(POST, { corpo: { v: 1, tipo: "esito", id: ID2, esito: "inviato", wa_id: "3EB0A8" } });
      c("esito inviato su un errore che NON era esito_incerto: 409, la riga resta non_inviato", [409, "non_inviato"], [e4.r.status, m2.tab.ponte_wa_invii[1].stato]);
      c("nei log solo codici: niente testo, numeri o id", [], [...x.log, ...y.log, ...a.log, ...e1.log].filter((l) => !l.startsWith("[ponte-invio] ") || [NOTO, "Buongiorno", ID1, ID2, "3EB0A1"].some((v) => l.includes(v))));
    }

    /* ── 3d. L'eco dell'invio: nessun doppione, in tutti e due gli ordini ── */
    gruppo("PONTE · INVIO A MANO · L'ECO DELL'INVIO, NESSUN DOPPIONE (T5)");
    {
      //  esito → eco
      let m = nuovoMondo(base({ ponte_wa_invii: [riga({ stato: "in_invio", preso_il: iso(-20) })] }));
      await chiama(POST, { corpo: { v: 1, tipo: "esito", id: ID1, esito: "inviato", wa_id: "3EB0EC01", ts: s(iso(-18)) } });
      const dopoEsito = { risposto: m.tab.whatsapp_contacts[0].risposto_il, righe: m.tab.whatsapp_messages.filter((r) => r.canale === "baileys").length };
      const x = await chiama(POST, { corpo: lotto([eco()]) });
      c("esito → eco: il lotto non scrive niente, l'eco conta fra i già presenti", [0, 1, 1], [x.json?.nuovi, x.json?.gia_presenti, m.tab.whatsapp_messages.filter((r) => r.canale === "baileys").length]);
      c("esito → eco: nessun pari cercato né scritto per quella chiave", [], m.rpc.filter((r) => r.fn === "ponte_wa_scrivi").flatMap((r) => r.args.p_righe.concat(r.args.p_pari)));
      c("esito → eco: «risposto» scritto una volta sola", dopoEsito.risposto, m.tab.whatsapp_contacts[0].risposto_il);

      //  eco → esito (l'esito è in ritardo)
      m = nuovoMondo(base({ ponte_wa_invii: [riga({ stato: "in_invio", preso_il: iso(-20) })] }));
      const y = await chiama(POST, { corpo: lotto([eco({ ts: s(iso(-18)) })]) });
      const dopoEco = { risposto: m.tab.whatsapp_contacts[0].risposto_il, righe: m.tab.whatsapp_messages.filter((r) => r.canale === "baileys").length };
      const z = await chiama(POST, { corpo: { v: 1, tipo: "esito", id: ID1, esito: "inviato", wa_id: "3EB0EC01", ts: s(iso(-18)) } });
      c("eco → esito: l'eco entra come riga normale", [1, 1], [y.json?.nuovi, dopoEco.righe]);
      c("eco → esito: l'esito arriva dopo senza errori, ancora UNA riga del ponte", [200, "inviato", 1], [z.r.status, z.json?.stato, m.tab.whatsapp_messages.filter((r) => r.canale === "baileys").length]);
      c("eco → esito: «risposto» resta quello dell'eco (una volta sola)", dopoEco.risposto, m.tab.whatsapp_contacts[0].risposto_il);
      c("eco → esito: la riga della coda è inviata col suo id", ["inviato", "3EB0EC01"], [m.tab.ponte_wa_invii[0].stato, m.tab.ponte_wa_invii[0].wa_message_id]);

      //  il testo uguale a una riga di ManyChat vicina: senza la porta si nasconderebbe come pari
      const manychat = { id: CRM_ID, user_id: UTENTE, wa_message_id: "mc-out-1", direction: "outbound", from_number: "manychat", to_number: "+" + NOTO, body: "Buongiorno Anna, ti aspetto domani", status: "sent", canale: "manychat", created_at: iso(-25) };
      m = nuovoMondo(base({ whatsapp_messages: [...base().whatsapp_messages, manychat], ponte_wa_invii: [riga({ stato: "inviato", wa_message_id: "3EB0EC01", inviato_il: iso(-20), preso_il: iso(-25) })] }));
      const n = await chiama(POST, { corpo: lotto([eco()]) });
      c("un testo mandato a mano vicino a una riga ManyChat uguale: l'eco NON si abbina come pari", [0, 1, 0], [n.json?.doppioni, n.json?.gia_presenti, m.rpc.filter((r) => r.fn === "ponte_wa_candidati").length]);
      m = nuovoMondo(base({ whatsapp_messages: [...base().whatsapp_messages, manychat] }));
      const d = await chiama(POST, { corpo: lotto([eco()]) });
      c("…controprova: senza quella riga nella coda l'eco si abbina come sempre (doppione)", [1, 1], [d.json?.doppioni, d.json?.nuovi]);

      //  un lotto senza uscite nostre è identico a prima (nemmeno una lettura della coda)
      m = nuovoMondo(base());
      const i = await chiama(POST, { corpo: lotto([{ id: "3EB0IN01", numero: NOTO, dir: "in", ts: s(iso(-30)), testo: "Grazie", tipo: "testo" }]) });
      c("un lotto di sole entrate: stessa risposta di sempre, la coda non si legge", [1, 0], [i.json?.nuovi, m.chiamate.filter((q) => q.tabella === "ponte_wa_invii").length]);

      //  il battito riconcilia ignorando le chiavi proprie
      const bwNostro = { id: "b-0-0000-4000-8000-000000000000", user_id: UTENTE, wa_message_id: `bw:${NOTO}:3EB0EC01`, direction: "outbound", from_number: "baileys", to_number: "+" + NOTO, body: "Buongiorno Anna, ti aspetto domani", media_type: null, status: "sent", canale: "baileys", created_at: iso(-290) };
      m = nuovoMondo(base({ whatsapp_messages: [...base().whatsapp_messages, bwNostro, { ...manychat, created_at: iso(-300) }], ponte_wa_invii: [riga({ stato: "inviato", wa_message_id: "3EB0EC01", inviato_il: iso(-290) })] }));
      const bt = await chiama(POST, { corpo: battito });
      c("il battito ignora le chiavi proprie: nessun riconciliato, nessun duplicato_di", [0, undefined], [bt.json?.riconciliati, m.tab.whatsapp_messages.find((r) => r.wa_message_id === bwNostro.wa_message_id).duplicato_di]);
      m = nuovoMondo(base({ whatsapp_messages: [...base().whatsapp_messages, bwNostro, { ...manychat, created_at: iso(-300) }] }));
      const bt2 = await chiama(POST, { corpo: battito });
      c("…controprova: senza quella riga nella coda il battito riconcilia come sempre", 1, bt2.json?.riconciliati);
    }

    /* ── 3e. Il battito e la tabella che manca ───────────────────────────── */
    gruppo("PONTE · INVIO A MANO · IL BATTITO E LA MIGRAZIONE MANCANTE (T5)");
    {
      let m = nuovoMondo(base({ ponte_wa_invii: [riga(), riga({ id: ID2, chiave: "chiave-di-prova-2" }), riga({ id: ID3, chiave: "chiave-di-prova-3", stato: "inviato" })] }));
      let x = await chiama(POST, { corpo: battito });
      c("battito con righe in attesa: risponde anche invii_in_attesa", { ok: true, riconciliati: 0, invii_in_attesa: 2 }, x.json);
      m = nuovoMondo(base());
      x = await chiama(POST, { corpo: battito });
      c("battito con la coda vuota: risposta IDENTICA a quella di prima", { ok: true, riconciliati: 0 }, x.json);

      //  tabella assente: stessa scrittura e stessa risposta di una tabella vuota
      for (const codice of ["42P01", "PGRST205", "42703"]) {
        ricarica();
        const chiaro = nuovoMondo(base());
        const a = await chiama(POST, { corpo: lotto([eco({ id: "3EB0X1" })]) });
        //  `updated_at` è l'ora di adesso: cambia di un millisecondo da una prova all'altra
        const fisso = (t) => JSON.stringify([t.whatsapp_messages, t.whatsapp_contacts.map(({ updated_at, ...resto }) => resto)]);
        const sc1 = fisso(chiaro.tab);
        ricarica();
        const rotto = nuovoMondo(base(), { ponte_wa_invii: codice });
        const b = await chiama(POST, { corpo: lotto([eco({ id: "3EB0X1" })]) });
        const sc2 = fisso(rotto.tab);
        c(`lotto vivo con la tabella assente (${codice}): 200 e stessa scrittura di prima`, [200, a.json, sc1], [b.r.status, b.json, sc2]);
        ricarica();
        nuovoMondo(base(), { ponte_wa_invii: codice });
        const p1 = await chiama(POST, { corpo: battito });
        const p2 = await chiama(POST, { corpo: battito });
        const avvisi = (l) => l.filter((r) => r.includes("invio_migrazione")).length;
        c(`battito con la tabella assente (${codice}): 200 come oggi, un solo avviso per processo`, [200, { ok: true, riconciliati: 0 }, 1, 0], [p1.r.status, p1.json, avvisi(p1.log), avvisi(p2.log)]);
        c(`…i log non hanno il messaggio dell'errore (${codice})`, [], [...p1.log, ...b.log].filter((l) => l.includes("Anna Finta") || l.includes("393330000101")));
      }

      //  prendi/esito con la tabella o le funzioni assenti: 503 (il Mac aspetta 5 minuti)
      ricarica();
      nuovoMondo(base(), { ponte_wa_invii_prendi: "PGRST202" });
      const p = await chiama(POST, { corpo: preso() });
      const p2 = await chiama(POST, { corpo: preso() });
      c("prendi con la funzione assente: 503 migrazione, avviso una volta", [503, "migrazione", 1, 0], [p.r.status, p.json?.errore, p.log.filter((l) => l.includes("invio_migrazione")).length, p2.log.filter((l) => l.includes("invio_migrazione")).length]);
      nuovoMondo(base(), { ponte_wa_invio_esito: "42883" });
      const e = await chiama(POST, { corpo: { v: 1, tipo: "esito", id: ID1, esito: "errore" } });
      c("esito con la funzione assente: 503 migrazione", [503, "migrazione"], [e.r.status, e.json?.errore]);
      nuovoMondo(base(), { ponte_wa_invii_prendi: "XX000" });
      const g = await chiama(POST, { corpo: preso() });
      c("un altro errore del database: 500 database (il Mac ritenta), mai il messaggio", [500, "database", false], [g.r.status, g.json?.errore, [...g.log, JSON.stringify(g.json)].some((l) => l.includes("Anna Finta") || l.includes("393330000101"))]);
    }

    /* ── 3f. Il browser: protezione e accodamento ────────────────────────── */
    gruppo("PONTE · INVIO A MANO · IL BROWSER: ACCODARE (T5)");
    {
      const chiave = (n) => `chiave-prova-${String(n).padStart(3, "0")}`;
      const accoda = (o = {}) => ({ azione: "accoda", numero: NOTO, testo: "Buongiorno Anna, ti aspetto domani", chiave: chiave(1), ...o });
      let m = nuovoMondo(base());
      let x = await chiamaBrowser(POSTWEB, { corpo: accoda(), sessione: "nessuna" });
      c("senza sessione: 401, niente in coda", [401, 0], [x.r.status, m.tab.ponte_wa_invii.length]);
      x = await chiamaBrowser(POSTWEB, { corpo: accoda(), sessione: "altra" });
      c("sessione di un'altra installazione: 403 non_autorizzato, niente in coda", [403, "non_autorizzato", 0], [x.r.status, x.json?.motivo, m.tab.ponte_wa_invii.length]);
      x = await chiamaBrowser(POSTWEB, { corpo: accoda(), sessione: "vuota" });
      c("sessione senza installazione: 403", 403, x.r.status);
      c("OPTIONS risponde 204 con le intestazioni CORS", [204, "POST, OPTIONS"], await (async () => { const r = await RottaBrowser.options.server.handlers.OPTIONS(); return [r.status, r.headers.get("access-control-allow-methods")]; })());

      m = nuovoMondo(base({
        ponte_wa_invii: [
          riga({ id: ID1, chiave: "vecchia-inviata", stato: "inviato", created_at: iso(-31 * 86400), wa_message_id: "OLD1" }),
          riga({ id: ID2, chiave: "vecchia-fallita", stato: "non_inviato", motivo: "scaduto", created_at: iso(-31 * 86400) }),
          riga({ id: ID3, chiave: "vecchia-in-attesa", stato: "in_attesa", created_at: iso(-31 * 86400) }),
          riga({ id: ID4, chiave: "recente-inviata", stato: "inviato", created_at: iso(-3600), wa_message_id: "NEW1" }),
          riga({ id: "b1b1b1b1-1111-4222-8333-444444444445", user_id: ALTRO_UTENTE, chiave: "altro-vecchia", stato: "inviato", created_at: iso(-31 * 86400) }),
        ],
      }));
      x = await chiamaBrowser(POSTWEB, { corpo: accoda(), nome: "Anna Finta" });
      const nuova = m.tab.ponte_wa_invii.find((r) => r.chiave === chiave(1));
      c("accoda valido: 200 e una riga in_attesa, col nome di chi ha scritto", [200, true, "in_attesa", "Anna Finta"], [x.r.status, x.json?.ok, nuova?.stato, nuova?.creato_da]);
      c("accoda: risponde con l'id della riga", nuova?.id, x.json?.id);
      c("la pulizia tocca solo le righe terminate e vecchie dello stesso utente", ["recente-inviata", "vecchia-in-attesa", "altro-vecchia", chiave(1)].sort(), m.tab.ponte_wa_invii.map((r) => r.chiave).sort());
      const y = await chiamaBrowser(POSTWEB, { corpo: accoda() });
      c("lo stesso tocco due volte (stessa chiave): una riga sola, stessa risposta", [200, nuova.id, 1], [y.r.status, y.json?.id, m.tab.ponte_wa_invii.filter((r) => r.chiave === chiave(1)).length]);
      c("…e la seconda non conta come nuovo accodamento nei log", [1, 0], [x.log.filter((l) => l.includes("invio_accodato")).length, y.log.filter((l) => l.includes("invio_accodato")).length]);
      m = nuovoMondo(base());
      const lungo = await chiamaBrowser(POSTWEB, { corpo: accoda({ chiave: chiave(2), testo: "😀".repeat(2000) }) });
      c("2000 emoji (8 KB di testo, oltre 8 KB di corpo): 200, non 413", 200, lungo.r.status);
      m = nuovoMondo(base());
      const virgolette = await chiamaBrowser(POSTWEB, { corpo: accoda({ chiave: chiave(3), testo: '"\n'.repeat(1000) }) });
      m = nuovoMondo(base());
      c("2000 caratteri che nel JSON si raddoppiano: 200", 200, virgolette.r.status);
      c("il nome di chi scrive si taglia a 80 caratteri", 80, (await (async () => { await chiamaBrowser(POSTWEB, { corpo: accoda({ chiave: chiave(4) }), nome: "N".repeat(200) }); return m.tab.ponte_wa_invii.find((r) => r.chiave === chiave(4)).creato_da.length; })()));

      //  i rifiuti: il motivo giusto, lo stato HTTP giusto, nessuna riga
      const rifiuti = [
        ["testo vuoto", () => base(), { testo: "   " }, 400, "testo_vuoto"],
        ["testo di 2001 caratteri", () => base(), { testo: "x".repeat(2001) }, 400, "testo_lungo"],
        ["numero non valido", () => base(), { numero: "12345" }, 400, "numero_non_valido"],
        ["ponte non collegato (battito vecchio)", () => base({ ponte_wa_stato: [{ user_id: UTENTE, stato: "collegato", aggiornato_il: iso(-400), contatori: { invii_attivi: 1 } }] }), {}, 409, "ponte_non_collegato"],
        ["ponte con lo stato non collegato", () => base({ ponte_wa_stato: [{ user_id: UTENTE, stato: "attesa_qr", aggiornato_il: iso(-10), contatori: { invii_attivi: 1 } }] }), {}, 409, "ponte_non_collegato"],
        ["invii spenti sul Mac", () => base({ ponte_wa_stato: [{ user_id: UTENTE, stato: "collegato", aggiornato_il: iso(-10), contatori: {} }] }), {}, 409, "invii_spenti"],
        ["STOP", () => base({ whatsapp_contacts: [{ user_id: UTENTE, phone_e164: "+" + NOTO, unread_count: 0, non_scrivere_dal: iso(-3600) }] }), {}, 409, "stop"],
        ["cliente che non ha mai scritto", () => base({ whatsapp_messages: [], whatsapp_contacts: [] }), {}, 409, "mai_scritto"],
        ["20 prelievi nelle ultime 24 ore", () => base({ ponte_wa_invii: Array.from({ length: 20 }, (_, i) => riga({ id: `d0d0d0d0-1111-4222-8333-${String(i).padStart(12, "0")}`, chiave: `gia-fatto-${i}`, stato: "inviato", wa_message_id: `W${i}`, preso_il: iso(-3600 - i) })) }), {}, 429, "limite_giornaliero"],
        ["3 messaggi già in coda", () => base({ ponte_wa_invii: Array.from({ length: 3 }, (_, i) => riga({ id: `d1d1d1d1-1111-4222-8333-${String(i).padStart(12, "0")}`, chiave: `in-coda-${i}` })) }), {}, 409, "coda_piena"],
      ];
      for (const [nome, mondo, cambio, stato, motivo] of rifiuti) {
        m = nuovoMondo(mondo());
        const prima = m.tab.ponte_wa_invii.length;
        const r = await chiamaBrowser(POSTWEB, { corpo: accoda({ chiave: chiave(9), ...cambio }) });
        c(`rifiuto: ${nome}`, [stato, motivo, I.fraseMotivo(motivo), prima], [r.r.status, r.json?.motivo, r.json?.frase, m.tab.ponte_wa_invii.length]);
      }

      //  forma storta
      m = nuovoMondo(base());
      const grande = await chiamaBrowser(POSTWEB, { corpo: null, testoGrezzo: "a".repeat(16385) });
      c("corpo oltre 16 KB: 413, niente in coda", [413, 0], [grande.r.status, m.tab.ponte_wa_invii.length]);
      for (const [nome, corpo, testoGrezzo] of [["JSON rotto", null, "{non è json"], ["azione sconosciuta", { azione: "annulla", id: ID1 }], ["chiave corta", accoda({ chiave: "corta" })], ["riprova senza uuid", { azione: "riprova", id: "uno" }], ["un numero come corpo", 7]]) {
        const r = await chiamaBrowser(POSTWEB, { corpo, testoGrezzo });
        c(`corpo storto: ${nome} → 400 corpo_non_valido`, [400, "corpo_non_valido", 0], [r.r.status, r.json?.motivo, m.tab.ponte_wa_invii.length]);
      }
      c("sempre JSON e no-store", ["application/json", "no-store"], [String(x.r.headers.get("content-type")).split(";")[0], x.r.headers.get("cache-control")]);

      //  senza la migrazione la rotta dà 503 e non scrive
      ricarica();
      m = nuovoMondo(base(), { ponte_wa_invio_fatti: "42883" });
      const sm = await chiamaBrowser(POSTWEB, { corpo: accoda() });
      c("senza la migrazione (funzione assente): 503 migrazione", [503, "migrazione"], [sm.r.status, sm.json?.motivo]);
      m = nuovoMondo(base(), { ponte_wa_invii: "42P01" });
      const sm2 = await chiamaBrowser(POSTWEB, { corpo: accoda() });
      c("senza la migrazione (tabella assente): 503 migrazione, i log senza testi", [503, "migrazione", false], [sm2.r.status, sm2.json?.motivo, [...sm2.log, JSON.stringify(sm2.json)].some((l) => l.includes("Anna Finta") || l.includes("393330000101"))]);
      m = nuovoMondo(base(), { ponte_wa_invio_fatti: "XX000" });
      const sm3 = await chiamaBrowser(POSTWEB, { corpo: accoda() });
      c("un altro errore del database: 500 database con una frase fissa", [500, "database"], [sm3.r.status, sm3.json?.motivo]);

      //  nei log: niente testo, numeri, nomi, id
      const tuttiLog = [...x.log, ...y.log, ...lungo.log, ...sm.log];
      c("nei log solo [ponte-invio] <codice> e contatori", [], tuttiLog.filter((l) => !/^\[ponte-invio\] [a-z_]+( [a-z_]+=\d+)*$/.test(l)));
      c("…senza testo, numero, nome o id", [], tuttiLog.filter((l) => [NOTO, "Buongiorno", "Anna", nuova.id, UTENTE, chiave(1)].some((v) => l.includes(v))));
    }

    /* ── 3g. Il browser: riprovare ───────────────────────────────────────── */
    gruppo("PONTE · INVIO A MANO · IL BROWSER: RIPROVARE (T5)");
    {
      const ripr = (id, extra = {}) => ({ azione: "riprova", id, ...extra });
      const rigaD = (o) => riga({ id: ID1, stato: "non_inviato", motivo: "scaduto", created_at: iso(-3600), ...o });
      const stato = (m, id = ID1) => m.tab.ponte_wa_invii.find((r) => r.id === id);

      let m = nuovoMondo(base({ ponte_wa_invii: [rigaD()] }));
      let x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      const r1 = stato(m);
      c("riprova di «scaduto»: la STESSA riga torna in_attesa, senza motivo e con l'ora nuova", [200, { ok: true, id: ID1, stato: "in_attesa" }, 1, null, true], [x.r.status, x.json, m.tab.ponte_wa_invii.length, r1.motivo, Date.parse(r1.created_at) > ADESSO - 5000]);
      const y = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      c("doppio tocco: 200, una riga sola, stato invariato al secondo", [200, "in_attesa", 1, r1.created_at], [y.r.status, y.json?.stato, m.tab.ponte_wa_invii.length, stato(m).created_at]);
      c("…e la seconda non è un nuovo accodamento nei log", [1, 0], [x.log.filter((l) => l.includes("invio_accodato")).length, y.log.filter((l) => l.includes("invio_accodato")).length]);

      m = nuovoMondo(base({ ponte_wa_invii: [rigaD({ motivo: "esito_incerto", preso_il: iso(-3500) })] }));
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      c("riprova di «esito_incerto» senza conferma: rifiutato con la frase della conferma, la riga non si tocca", [409, "non_riprovabile", I.FRASE_CONFERMA_INCERTO, "non_inviato"], [x.r.status, x.json?.motivo, x.json?.frase, stato(m).stato]);
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1, { confermaIncerto: true }) });
      c("…con la conferma: torna in coda", [200, "in_attesa"], [x.r.status, stato(m).stato]);

      for (const motivo of ["stop", "mai_scritto"]) {
        m = nuovoMondo(base({ ponte_wa_invii: [rigaD({ motivo })] }));
        x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1, { confermaIncerto: true }) });
        c(`riprova di «${motivo}»: rifiutata, la riga non si tocca`, [409, "non_riprovabile", "non_inviato"], [x.r.status, x.json?.motivo, stato(m).stato]);
      }
      m = nuovoMondo(base({ ponte_wa_invii: [rigaD({ stato: "inviato", motivo: null, wa_message_id: "W1", inviato_il: iso(-60) })] }));
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      c("riprova di un messaggio già inviato: rifiutata", [409, "non_riprovabile", "inviato"], [x.r.status, x.json?.motivo, stato(m).stato]);

      //  decisione 3: la riga nel database è ancora aperta ma la chat la mostra scaduta/incerta
      m = nuovoMondo(base({ ponte_wa_invii: [riga({ stato: "in_attesa", created_at: iso(-11 * 60) })] }));
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      c("riga ancora in_attesa nel database ma scaduta per la chat (Mac spento): il riprova la rimette in coda", [200, "in_attesa", true], [x.r.status, x.json?.stato, Date.parse(stato(m).created_at) > ADESSO - 5000]);
      m = nuovoMondo(base({ ponte_wa_invii: [riga({ stato: "in_invio", preso_il: iso(-4 * 60), created_at: iso(-5 * 60) })] }));
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      c("riga ancora in_invio ma incerta per la chat, senza conferma: rifiutata e intatta", [409, "in_invio"], [x.r.status, stato(m).stato]);
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1, { confermaIncerto: true }) });
      c("…con la conferma: torna in_attesa", [200, "in_attesa", null], [x.r.status, stato(m).stato, stato(m).motivo]);
      m = nuovoMondo(base({ ponte_wa_invii: [riga({ stato: "in_invio", preso_il: iso(-60), created_at: iso(-90) }), riga({ id: ID2, chiave: "chiave-di-prova-2", stato: "in_attesa", created_at: iso(-60) })] }));
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1, { confermaIncerto: true }) });
      const x2 = await chiamaBrowser(POSTWEB, { corpo: ripr(ID2) });
      c("riga in_invio da 1 minuto o in_attesa da 1 minuto (ancora vive): 200 con lo stato com'è, nulla cambia", [200, "in_invio", 200, "in_attesa", iso(-60)], [x.r.status, x.json?.stato, x2.r.status, x2.json?.stato, stato(m, ID2).created_at]);

      //  altri utenti e righe che non esistono
      m = nuovoMondo(base({ ponte_wa_invii: [rigaD({ user_id: ALTRO_UTENTE })] }));
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      c("riprova della riga di un altro utente: 404, la riga non si tocca", [404, "non_inviato"], [x.r.status, stato(m).stato]);
      x = await chiamaBrowser(POSTWEB, { corpo: ripr("b1b1b1b1-1111-4222-8333-4444444449ff") });
      c("riprova di una riga che non c'è: 404", 404, x.r.status);

      //  il server ricontrolla STOP, ponte e limiti anche per il riprova
      m = nuovoMondo(base({ ponte_wa_invii: [rigaD()], whatsapp_contacts: [{ user_id: UTENTE, phone_e164: "+" + NOTO, unread_count: 0, non_scrivere_dal: iso(-60) }] }));
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      c("riprova dopo che il cliente ha scritto STOP: 409 stop, la riga resta non_inviato", [409, "stop", "non_inviato"], [x.r.status, x.json?.motivo, stato(m).stato]);
      m = nuovoMondo(base({ ponte_wa_invii: [rigaD(), ...Array.from({ length: 20 }, (_, i) => riga({ id: `d0d0d0d0-1111-4222-8333-${String(i).padStart(12, "0")}`, chiave: `gia-fatto-${i}`, stato: "inviato", wa_message_id: `W${i}`, preso_il: iso(-3600 - i) }))] }));
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      c("riprova col tetto giornaliero raggiunto: 429", [429, "limite_giornaliero"], [x.r.status, x.json?.motivo]);
      m = nuovoMondo(base({ ponte_wa_invii: [rigaD()], ponte_wa_stato: [{ user_id: UTENTE, stato: "fermo", aggiornato_il: iso(-10), contatori: { invii_attivi: 1 } }] }));
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      c("riprova a ponte spento: 409 ponte_non_collegato", [409, "ponte_non_collegato"], [x.r.status, x.json?.motivo]);
      m = nuovoMondo(base({ ponte_wa_invii: [rigaD(), ...Array.from({ length: 3 }, (_, i) => riga({ id: `d1d1d1d1-1111-4222-8333-${String(i).padStart(12, "0")}`, chiave: `in-coda-${i}` }))] }));
      x = await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      c("riprova con 3 messaggi già in coda: 409 coda_piena", [409, "coda_piena"], [x.r.status, x.json?.motivo]);

      //  il riprova rimette in coda: il prelievo successivo lo offre di nuovo
      m = nuovoMondo(base({ ponte_wa_invii: [rigaD({ motivo: "errore_invio" })] }));
      await chiamaBrowser(POSTWEB, { corpo: ripr(ID1) });
      const p = await chiama(POST, { corpo: preso() });
      c("dopo il riprova il Mac riprende la stessa riga", [ID1, "in_invio"], [p.json?.invio?.id, stato(m).stato]);
    }

    c("le rotte non hanno chiamato nessuno fuori dal database", 0, esterne);
  } finally {
    globalThis.fetch = fetchVero;
    delete globalThis.__ponteMondo;
    delete globalThis.__guardia;
    rotte.chiudi();
  }
}

void PERCORSO;
