/** ── PROVE: LA ROTTA E LE PORTE VERE ──
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T4 (PIANO §b, T4).
 *  La rotta VERA (`src/routes/api.public.ponte-whatsapp.ts`) si impacchetta
 *  con esbuild insieme a `gestisciRichiesta` (T3) e alle porte VERE
 *  (`src/crm/ponte/porte.server.ts`); finti solo due pezzi:
 *  `@tanstack/react-router` (restituisce le opzioni) e il client Supabase con
 *  la chiave di servizio, che diventa un database in memoria (`MONDO_FINTO`).
 *  Le funzioni SQL lì dentro imitano quelle di T1 e della commessa «tutte le
 *  chat» (stesse regole del testo SQL, dette in JavaScript): servono a far
 *  girare il codice vero, non a provare l'SQL (lo provano `prove/sql/ponte-wa.sql`
 *  e `prove/sql/ponte-tutte.sql` su Postgres). `ponte_wa_noti` non c'è più: dal
 *  30/10 (D7 tolta) la rotta non la chiama, e se la chiamasse sarebbe un errore.
 *  `fetch` è un allarme: la rotta non chiama nessuno fuori dal database.
 *
 *  `MONDO_FINTO` e `caricaRotta` servono anche a `non-interferenza.mjs`.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

export const PERCORSO = "/api/public/ponte-whatsapp";
export const TOKEN = "t".repeat(24) + "-chiave-di-prova-0123456789";
export const UTENTE = "0b0b0b0b-1111-4222-8333-444444444444";

/** Il database finto. Le tabelle stanno in `globalThis.__ponteMondo.tab`;
 *  ogni scrittura (diretta o dentro una funzione SQL finta) finisce in
 *  `scritture` come `{ tabella, azione, colonne, via }`. */
export const MONDO_FINTO = `
const st = () => globalThis.__ponteMondo;
const cifre = (t) => String(t ?? "").replace(/\\D/g, "");
const sec = (iso) => Date.parse(iso) / 1000;
const iso = (s) => new Date(s * 1000).toISOString();
const righe = (t) => (st().tab[t] ??= []);
const scritto = (tabella, azione, colonne, via) => st().scritture.push({ tabella, azione, colonne: [...colonne].sort(), via });
const guasto = (chi) => {
  const g = st().guasti[chi];
  return g ? { data: null, error: { code: g, message: "errore con 393330009999 e Anna Finta dentro" } } : null;
};
const cliente = (m) => cifre(m.direction === "inbound" ? m.from_number : m.to_number);

function tabella(nome) {
  const filtri = [];
  let azione = "select", valori = null, tetto = Infinity, colonne = null, chiave = null, ordine = null, uno = false;
  const q = {
    select: (c) => ((colonne = c.split(",").map((s) => s.trim())), q),
    insert: (v) => ((azione = "insert"), (valori = v), q),
    update: (v) => ((azione = "update"), (valori = v), q),
    upsert: (v, o) => ((azione = "upsert"), (valori = v), (chiave = o.onConflict.split(",")), q),
    eq: (c, v) => (filtri.push((r) => r[c] === v), q),
    is: (c, v) => (filtri.push((r) => (r[c] ?? null) === v), q),
    gte: (c, v) => (filtri.push((r) => r[c] >= v), q),
    order: (c, o) => ((ordine = [c, o.ascending]), q),
    limit: (n) => ((tetto = n), q),
    maybeSingle: () => ((uno = true), q),
    then: (ok, no) => Promise.resolve(esegui()).then(ok, no),
  };
  function esegui() {
    st().chiamate.push({ tabella: nome, azione });
    const g = guasto(nome);
    if (g) return g;
    const tutte = righe(nome);
    if (azione === "select") {
      let r = tutte.filter((x) => filtri.every((f) => f(x)));
      if (ordine) r = [...r].sort((a, b) => (a[ordine[0]] < b[ordine[0]] ? -1 : 1) * (ordine[1] ? 1 : -1));
      r = r.slice(0, tetto).map((x) => Object.fromEntries(colonne.map((k) => [k, x[k] ?? null])));
      return { data: uno ? (r[0] ?? null) : r, error: null };
    }
    scritto(nome, azione, Object.keys(valori), "diretta");
    if (azione === "upsert") {
      const c = tutte.find((r) => chiave.every((k) => r[k] === valori[k]));
      if (c) Object.assign(c, valori);
      else tutte.push({ ...valori });
      return { data: null, error: null };
    }
    if (azione === "insert") tutte.push({ ...valori });
    else for (const r of tutte.filter((x) => filtri.every((f) => f(x)))) Object.assign(r, valori);
    return { data: null, error: null };
  }
  return q;
}

/** ponte_wa_candidati: le regole 1-4 del §c1, più «non già presa». */
function candidati(a) {
  const out = [];
  const presi = new Set(righe("whatsapp_messages").map((m) => m.duplicato_di).filter(Boolean));
  for (const q of a.p_righe)
    for (const m of righe("whatsapp_messages"))
      if (m.user_id === a.p_user_id && m.canale !== "baileys" && (m.duplicato_di ?? null) === null && !presi.has(m.id) &&
          m.status !== "failed" && m.direction === (q.d === "in" ? "inbound" : "outbound") &&
          cliente(m) === q.n && Math.abs(sec(m.created_at) - q.t) <= 180)
        out.push({ k: q.k, id: m.id, created_at: m.created_at, direction: m.direction,
          body: m.body == null ? null : m.body.slice(0, 1200), canale: m.canale ?? null });
  return out;
}

/** D9 (30/10): solo un'entrata viva, mai nata con un pari (nemmeno perso), degli ultimi 7 giorni. */
const attesa = (r, pari) => (r.e && r.d === "in" && !pari.some((p) => p.k === r.k) && r.t >= Date.now() / 1000 - 7 * 86400 ? new Date().toISOString() : null);

/** ponte_wa_ritira: il pari di ManyChat arriva dopo la promozione, si toglie il +1 (una volta). */
function ritira(u, riga) {
  if (!riga.promosso_il) return false;
  const p = righe("whatsapp_messages").find((m) => m.id === riga.duplicato_di && m.user_id === u && m.canale === "manychat");
  if (!p) return false;
  const n = cliente(riga);
  const x = righe("whatsapp_contacts").filter((c) => c.user_id === u && (c.phone_e164 === "+" + n || c.phone_e164 === n))
    .sort((p1, q) => (q.phone_e164 === "+" + n) - (p1.phone_e164 === "+" + n))[0];
  if (x) {
    x.unread_count = Math.max((x.unread_count ?? 0) - 1, 0);
    x.updated_at = new Date().toISOString();
    scritto("whatsapp_contacts", "update", ["unread_count", "updated_at"], "ponte_wa_ritira");
  }
  riga.promosso_il = null;
  scritto("whatsapp_messages", "update", ["promosso_il"], "ponte_wa_ritira");
  return true;
}

/** ponte_wa_promuovi: dopo l'attesa un'entrata solo del ponte diventa un'entrata vera. */
function promuovi(a) {
  const u = a.p_user_id;
  const attesaS = a.p_attesa_s ?? 120;
  const ora = Date.now();
  const cont = righe("whatsapp_contacts");
  const da = righe("whatsapp_messages")
    .filter((m) => m.user_id === u && m.canale === "baileys" && m.direction === "inbound" && !m.duplicato_di && !m.promosso_il && m.attesa_dal &&
      Date.parse(m.attesa_dal) >= ora - 86400e3 && Date.parse(m.attesa_dal) <= ora - attesaS * 1000)
    .sort((p, q) => (p.created_at < q.created_at ? -1 : 1)).slice(0, 500);
  const esito = { promosse: 0, saltate: 0 };
  for (const m of da) {
    const n = cifre(m.from_number);
    const x = cont.filter((c) => c.user_id === u && (c.phone_e164 === "+" + n || c.phone_e164 === n))
      .sort((p, q) => (q.phone_e164 === "+" + n) - (p.phone_e164 === "+" + n))[0];
    if (!x) continue;
    if (x.risposto_il && x.risposto_il >= m.created_at) {
      m.attesa_dal = null;
      scritto("whatsapp_messages", "update", ["attesa_dal"], "ponte_wa_promuovi");
      esito.saltate++;
      continue;
    }
    const piuRecente = !x.ultimo_in_entrata_il || m.created_at >= x.ultimo_in_entrata_il;
    x.unread_count = (x.unread_count ?? 0) + 1;
    if (piuRecente) { x.ultimo_in_entrata_anteprima = m.body.slice(0, 100); x.ultimo_in_entrata_il = m.created_at; }
    if (!x.last_message_at || m.created_at > x.last_message_at) x.last_message_at = m.created_at;
    x.updated_at = new Date().toISOString();
    scritto("whatsapp_contacts", "update", ["unread_count", "ultimo_in_entrata_anteprima", "ultimo_in_entrata_il", "last_message_at", "updated_at"], "ponte_wa_promuovi");
    m.promosso_il = new Date().toISOString();
    scritto("whatsapp_messages", "update", ["promosso_il"], "ponte_wa_promuovi");
    esito.promosse++;
  }
  return esito;
}

/** ponte_wa_scrivi: le righe, i pari delle già presenti, i contatti, D8, D9. */
function scrivi(a) {
  const u = a.p_user_id;
  const msg = righe("whatsapp_messages");
  const esito = { nuovi: 0, gia_presenti: 0, doppioni: 0, pari_persi: 0, contatti_nuovi: 0, risposto: 0 };
  const preso = (crm) => msg.some((m) => m.duplicato_di === crm);
  const mappa = new Map();
  for (const p of a.p_pari) {
    const c = msg.find((m) => m.id === p.crm && m.user_id === u && m.canale !== "baileys" && !m.duplicato_di && m.status !== "failed");
    if (c && !mappa.has(p.k)) mappa.set(p.k, p.crm);
  }
  const tentate = new Set();
  const inseriti = [];
  for (const r of [...a.p_righe].sort((x, y) => x.t - y.t || (x.k < y.k ? -1 : 1))) {
    if (msg.some((m) => m.wa_message_id === r.k)) { esito.gia_presenti++; continue; }
    let crm = mappa.get(r.k) ?? null;
    if (crm) { tentate.add(r.k); if (preso(crm)) { esito.pari_persi++; crm = null; } }
    const riga = {
      id: "b-" + (msg.length + 1) + "-0000-4000-8000-000000000000", user_id: u, wa_message_id: r.k,
      direction: r.d === "in" ? "inbound" : "outbound",
      from_number: r.d === "in" ? "+" + r.n : "baileys", to_number: r.d === "in" ? "baileys" : "+" + r.n,
      body: r.x.slice(0, 4000), media_type: r.m, status: r.d === "in" ? "delivered" : r.s,
      canale: "baileys", created_at: iso(r.t), raw_payload: {},
      ...(crm ? { duplicato_di: crm } : { attesa_dal: attesa(r, a.p_pari) }),
    };
    msg.push(riga);
    scritto("whatsapp_messages", "insert", Object.keys(riga).filter((k) => k !== "id"), "ponte_wa_scrivi");
    esito.nuovi++;
    if (crm) esito.doppioni++;
    inseriti.push({ riga, effetto: r.e && r.d === "out" && !crm && r.t >= Date.now() / 1000 - 7 * 86400 });
  }
  for (const [k, crm] of mappa) {
    if (tentate.has(k)) continue;
    const r = msg.find((m) => m.user_id === u && m.wa_message_id === k && m.canale === "baileys" && !m.duplicato_di);
    if (!r) continue;
    if (preso(crm)) { esito.pari_persi++; continue; }
    r.duplicato_di = crm;
    scritto("whatsapp_messages", "update", ["duplicato_di"], "ponte_wa_scrivi");
    esito.doppioni++;
    ritira(u, r);
  }
  const perNumero = new Map();
  for (const { riga, effetto } of inseriti) {
    const n = cliente(riga);
    const v = perNumero.get(n) ?? { ultimo: "", risposta: null };
    if (riga.created_at > v.ultimo) v.ultimo = riga.created_at;
    if (effetto && (!v.risposta || riga.created_at > v.risposta)) v.risposta = riga.created_at;
    perNumero.set(n, v);
  }
  const cont = righe("whatsapp_contacts");
  for (const [n, v] of perNumero) {
    const nome = (a.p_nomi[n] ?? "").slice(0, 80).trim() || null;
    const x = cont.filter((c) => c.user_id === u && (c.phone_e164 === "+" + n || c.phone_e164 === n))
      .sort((p, q) => (q.phone_e164 === "+" + n) - (p.phone_e164 === "+" + n))[0];
    if (x) {
      x.last_message_at = !x.last_message_at || v.ultimo > x.last_message_at ? v.ultimo : x.last_message_at;
      //  E7: il nome del profilo non si salva per un contatto del ponte senza scheda.
      x.display_name = x.origine === "baileys" && !x.lead_id ? x.display_name : (x.display_name ?? nome);
      if (v.risposta && (!x.risposto_il || v.risposta > x.risposto_il)) { x.risposto_il = v.risposta; esito.risposto++; }
      x.updated_at = new Date().toISOString();
      scritto("whatsapp_contacts", "update", ["last_message_at", "display_name", "risposto_il", "updated_at"], "ponte_wa_scrivi");
    } else {
      const nuovo = { user_id: u, phone_e164: "+" + n, display_name: null, last_message_at: v.ultimo, risposto_il: v.risposta, origine: "baileys" };
      cont.push({ ...nuovo, unread_count: 0 });
      scritto("whatsapp_contacts", "insert", Object.keys(nuovo), "ponte_wa_scrivi");
      esito.contatti_nuovi++;
      if (v.risposta) esito.risposto++;
    }
  }
  return esito;
}

export const supabaseAdmin = {
  from: (t) => tabella(t),
  rpc: async (fn, a) => {
    st().rpc.push({ fn, args: JSON.parse(JSON.stringify(a)) });
    const g = guasto(fn);
    if (g) return g;
    if (fn === "ponte_wa_candidati") return { data: candidati(a), error: null };
    if (fn === "ponte_wa_scrivi") return { data: scrivi(a), error: null };
    if (fn === "ponte_wa_promuovi") return { data: promuovi(a), error: null };
    return { data: null, error: { code: "42883", message: "function does not exist" } };
  },
};`;

/** Impacchetta la rotta vera con il router finto e il database finto.
 *  `carica()` ridà un modulo nuovo (gli avvisi «una volta per processo»
 *  ricominciano) e `chiudi()` cancella la cartella. */
export async function caricaRotta(radice) {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-rotta-"));
  const finta = join(cartella, "supabase-finto.js");
  writeFileSync(finta, MONDO_FINTO);
  const file = join(cartella, "rotta.cjs");
  await build({
    stdin: { contents: `export { Route } from "@/routes/api.public.ponte-whatsapp";`, resolveDir: radice, loader: "ts" },
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
          b.onLoad({ filter: /^router$/, namespace: "finto" }, () => ({
            contents: "export const createFileRoute = (path) => (options) => ({ path, options });",
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
      return richiedi(file).Route;
    },
    chiudi: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

/** Un mondo nuovo: `tab` sono le tabelle (copiate), `guasti` = { tabella o funzione: codice }. */
export function nuovoMondo(tab = {}, guasti = {}) {
  const m = { tab: structuredClone(tab), guasti, scritture: [], chiamate: [], rpc: [] };
  globalThis.__ponteMondo = m;
  return m;
}

/** Chiama `POST` con il token dato (o senza); cattura tutti i log. */
export async function chiama(POST, o) {
  //  `token: undefined` vuol dire «segreto assente», `chiave: undefined` «senza intestazione».
  const { corpo, flusso = null } = o;
  const chiave = "chiave" in o ? o.chiave : TOKEN;
  const token = "token" in o ? o.token : TOKEN;
  const livelli = ["log", "info", "warn", "error", "debug"];
  const veri = Object.fromEntries(livelli.map((k) => [k, console[k]]));
  const tokenVero = process.env.PONTE_WA_TOKEN;
  const log = [];
  for (const k of livelli) console[k] = (...a) => log.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  if (token === undefined) delete process.env.PONTE_WA_TOKEN;
  else process.env.PONTE_WA_TOKEN = token;
  try {
    const request = new Request(`https://sito.test${PERCORSO}`, {
      method: "POST",
      headers: chiave === undefined ? {} : { "x-hgl-token": chiave },
      body: flusso ?? (typeof corpo === "string" ? corpo : JSON.stringify(corpo)),
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
    return { r, json, log };
  } finally {
    for (const k of livelli) console[k] = veri[k];
    if (tokenVero === undefined) delete process.env.PONTE_WA_TOKEN;
    else process.env.PONTE_WA_TOKEN = tokenVero;
  }
}

/** Secondi UNIX di un'ora ISO. */
const s = (iso) => Math.floor(Date.parse(iso) / 1000);

export async function provePonteRotta(_mod, { c, gruppo, radice }) {
  const sorgente = readFileSync(join(radice, "src/routes/api.public.ponte-whatsapp.ts"), "utf8");
  const porte = readFileSync(join(radice, "src/crm/ponte/porte.server.ts"), "utf8");
  const albero = readFileSync(join(radice, "src/routeTree.gen.ts"), "utf8");
  const senzaCommenti = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  /* ═══ 1. IL SORGENTE DELLA ROTTA E L'ALBERO ═════════════════════════════ */
  gruppo("PONTE WHATSAPP · LA ROTTA · SORGENTE E ALBERO (compito T4)");
  {
    const codice = senzaCommenti(sorgente);
    c("la rotta è quella giusta", true, codice.includes(`createFileRoute("${PERCORSO}")`));
    c("risponde solo a POST", ["POST"], [...codice.matchAll(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*:/g)].map((x) => x[1]));
    c("legge il segreto PONTE_WA_TOKEN e nessun altro interruttore", ["PONTE_WA_TOKEN"], [...codice.matchAll(/process\.env\.(\w+)/g)].map((x) => x[1]));
    c("passa tutto a gestisciRichiesta con le porte vere", true, codice.includes("gestisciRichiesta(porteIngresso()"));
    //  + l'avviso push dei messaggi vivi (commessa 2026-10-30, p2-push-risposte).
    c("i soli import: router, ingresso, porte, avviso push", ["@/crm/ponte/ingresso", "@/crm/ponte/porte.server", "@/crm/push/invio.server", "@tanstack/react-router"],
      [...codice.matchAll(/from\s+"([^"]+)"/g)].map((x) => x[1]).sort());
    c("non legge il corpo da sé (lo fa gestisciRichiesta, dopo la chiave)", false, /\.(json|text|formData|arrayBuffer|blob)\s*\(|\.body\b/.test(codice));
    c("niente fetch, niente console (i log li fa porte.avviso)", [false, false], [/\bfetch\s*\(/.test(codice), /console\./.test(codice)]);
    c("routeTree.gen.ts importa la rotta", true,
      albero.includes("import { Route as ApiPublicPonteWhatsappRouteImport } from './routes/api.public.ponte-whatsapp'"));
    c("…con il suo percorso", true, albero.includes(`'${PERCORSO}'`));
    c("…registrata una volta sola fra i figli", 1, (albero.match(/ApiPublicPonteWhatsappRoute: ApiPublicPonteWhatsappRoute,/g) ?? []).length);
  }

  /* ═══ 2. IL SORGENTE DELLE PORTE ════════════════════════════════════════ */
  gruppo("PONTE WHATSAPP · LE PORTE VERE · SORGENTE (compito T4)");
  {
    const codice = senzaCommenti(porte);
    //  30/10 «tutte le chat»: ponte_wa_noti non è più chiamata dal TypeScript (D7 tolta; la funzione SQL
    //  resta nella migrazione 20261029120000, solo aggiuntiva, senza chiamanti); c'è ponte_wa_promuovi (D9).
    c("le funzioni SQL per nome, e nessun'altra", ["ponte_wa_candidati", "ponte_wa_promuovi", "ponte_wa_scrivi"],
      [...new Set([...codice.matchAll(/\.rpc(?:<.*?>)?\(\s*"(\w+)"/g)].map((x) => x[1]))].sort());
    c("ponte_wa_noti e ponte_wa_ritira non compaiono nel TypeScript delle porte (ritira la chiama solo l'SQL)", [false, false], [/ponte_wa_noti/.test(codice), /ponte_wa_ritira/.test(codice)]);
    c("le tabelle toccate: manychat_config, ponte_wa_stato, whatsapp_messages", ["manychat_config", "ponte_wa_stato", "whatsapp_messages"],
      [...new Set([...codice.matchAll(/\.from\(\s*"(\w+)"/g)].map((x) => x[1]))].sort());
    c("la chiave di servizio, con il cast come nelle altre porte", true,
      codice.includes('from "@/integrations/supabase/client.server"') && codice.includes("supabaseAdmin as unknown as"));
    c("mai il messaggio d'errore", false, /\.message\b/.test(codice));
    c("whatsapp_messages solo in lettura (nessuna scrittura diretta)", false,
      /from\(\s*"whatsapp_messages"\s*\)\s*\.(insert|update|upsert|delete)\(/.test(codice));
  }

  /* ═══ 3. LA ROTTA VERA, CON LE PORTE VERE E IL DATABASE FINTO ═══════════ */
  const fetchVero = globalThis.fetch;
  let esterne = 0;
  globalThis.fetch = () => {
    esterne++;
    throw new Error("la rotta non deve chiamare nessuno");
  };
  const rotta = await caricaRotta(radice);
  try {
    const ADESSO = Date.now();
    const iso = (deltaS) => new Date(ADESSO + deltaS * 1000).toISOString();
    const NOTO = "393330000101";
    const IGNOTO = "393330000199";
    const ALTRO_UTENTE = "99999999-1111-4222-8333-444444444444";
    const CRM_ID = "c0c0c0c0-1111-4222-8333-000000000001";
    const base = () => ({
      manychat_config: [{ id: 1, user_id: UTENTE }],
      whatsapp_contacts: [{ user_id: UTENTE, phone_e164: "+" + NOTO, display_name: null, unread_count: 2, last_message_at: iso(-3600) }],
      whatsapp_messages: [],
      crm_leads: [],
    });
    const msg = (o = {}) => ({ id: "3EB0AA01", numero: NOTO, dir: "in", ts: s(iso(-30)), testo: "Buongiorno, info sul servizio", tipo: "testo", ...o });
    const lotto = (messaggi, o = {}) => ({ v: 1, tipo: "lotto", origine: "vivo", messaggi, nomi: { [NOTO]: "Cliente Finta" }, ...o });
    const battito = { v: 1, tipo: "battito", stato: "collegato", collegato_dal: iso(-600), ultimo_messaggio_il: iso(-30), storico: { fatto: true, avanzamento: 100 }, in_coda: 0, scartati: 0, versione: "7.0.0-rc14" };

    gruppo("PONTE WHATSAPP · LA ROTTA · STATI HTTP (compito T4)");
    let Route = rotta.carica();
    c("le opzioni della rotta hanno solo POST", ["POST"], Object.keys(Route.options.server.handlers));
    let POST = Route.options.server.handlers.POST;
    {
      let m = nuovoMondo(base());
      let x = await chiama(POST, { corpo: lotto([msg()]), token: undefined });
      c("senza segreto: 503 non_configurato", [503, "non_configurato"], [x.r.status, x.json?.errore]);
      c("…e il database non si tocca", 0, m.chiamate.length + m.rpc.length);
      x = await chiama(POST, { corpo: lotto([msg()]), token: "corto", chiave: "corto" });
      c("segreto sotto 32 caratteri: 503", 503, x.r.status);
      x = await chiama(POST, { corpo: lotto([msg()]), chiave: "sbagliata" });
      c("chiave sbagliata: 401 non_autorizzato", [401, "non_autorizzato"], [x.r.status, x.json?.errore]);
      x = await chiama(POST, { corpo: lotto([msg()]), chiave: undefined });
      c("chiave assente: 401", 401, x.r.status);
      x = await chiama(POST, { corpo: "a".repeat(262145) });
      c("oltre 256 KB: 413 troppo_grande", [413, "troppo_grande"], [x.r.status, x.json?.errore]);
      x = await chiama(POST, { corpo: "{non è json" });
      c("JSON rotto: 400 corpo_non_valido", [400, "corpo_non_valido"], [x.r.status, x.json?.errore]);
      x = await chiama(POST, { corpo: { ...lotto([msg()]), v: 2 } });
      c("versione sbagliata: 400", 400, x.r.status);
      c("nessuna di queste risposte ha toccato il database", 0, m.chiamate.length + m.rpc.length);
      c("sempre JSON e no-store", ["application/json", "no-store"],
        [String(x.r.headers.get("content-type")).split(";")[0], x.r.headers.get("cache-control")]);

      m = nuovoMondo({ ...base(), manychat_config: [] });
      x = await chiama(POST, { corpo: lotto([msg()]) });
      c("senza riga in manychat_config: 503 non_configurato", [503, "non_configurato"], [x.r.status, x.json?.errore]);
      c("…e nessuna funzione chiamata", 0, m.rpc.length);
    }

    gruppo("PONTE WHATSAPP · LA ROTTA · IL LOTTO CON LE PORTE VERE (compito T4)");
    {
      const m = nuovoMondo({
        ...base(),
        whatsapp_messages: [
          //  Lo stesso messaggio già arrivato da ManyChat, 20 s dopo: è il pari.
          { id: CRM_ID, user_id: UTENTE, wa_message_id: "mc-1", direction: "inbound", from_number: "+" + NOTO, to_number: "manychat",
            body: "Ciao, sono qui", status: "delivered", canale: "manychat", created_at: iso(-100) },
        ],
      });
      const corpo = {
        ...lotto([
          msg(),
          msg({ id: "3EB0AA02", ts: s(iso(-120)), testo: "Ciao, sono qui" }),
          msg({ id: "3EB0AA03", numero: IGNOTO }),
        ]),
        user_id: ALTRO_UTENTE,
      };
      const x = await chiama(POST, { corpo });
      //  D7 tolta: anche il numero sconosciuto (IGNOTO) entra, non_noti è sempre vuoto.
      c("200 con i conteggi del §b2: tutte e tre scritte, anche la riga dello sconosciuto", { ok: true, ricevuti: 3, nuovi: 3, gia_presenti: 0, doppioni: 1, scartati: 0, fuori_rubrica: 0, non_noti: [] }, x.json);
      const utenti = [...new Set(m.rpc.map((r) => r.args.p_user_id))];
      c("ogni funzione riceve l'utente di manychat_config, non quello del corpo", [UTENTE], utenti);
      c("utente letto da manychat_config con id=1", true, m.chiamate.some((q) => q.tabella === "manychat_config" && q.azione === "select"));
      c("le funzioni nell'ordine: candidati, scrivi, poi il controllo tardivo (candidati) e la promozione", ["ponte_wa_candidati", "ponte_wa_scrivi", "ponte_wa_candidati", "ponte_wa_promuovi"], m.rpc.map((r) => r.fn));
      c("ponte_wa_candidati riceve p_righe {k,n,d,t}", ["k", "n", "d", "t"], Object.keys(m.rpc[0].args.p_righe[0]));
      c("ponte_wa_scrivi riceve p_righe, p_pari, p_nomi come da contratto", ["p_nomi", "p_pari", "p_righe", "p_user_id"], Object.keys(m.rpc[1].args).sort());
      c("…con le righe nell'ordine dei campi di RigaScrittura", ["k", "n", "d", "t", "x", "e", "m", "s"], Object.keys(m.rpc[1].args.p_righe[0]));
      c("…e il pari verso la riga ManyChat", [{ k: `bw:${NOTO}:3EB0AA02`, crm: CRM_ID }], m.rpc[1].args.p_pari);
      c("ponte_wa_promuovi riceve p_user_id e p_attesa_s = 120", [{ p_user_id: UTENTE, p_attesa_s: 120 }], [m.rpc[3].args]);
      const ponte = m.tab.whatsapp_messages.filter((r) => r.canale === "baileys");
      c("tre righe del ponte, una è il doppione", [3, 1], [ponte.length, ponte.filter((r) => r.duplicato_di === CRM_ID).length]);
      const ignoto = m.tab.whatsapp_contacts.find((r) => r.phone_e164 === "+" + IGNOTO);
      c("lo sconosciuto ha un contatto del ponte: senza scheda, 0 non letti, nessuna entrata, senza nome", [["baileys", undefined, 0, undefined, null]],
        [[ignoto?.origine, ignoto?.lead_id, ignoto?.unread_count, ignoto?.ultimo_in_entrata_il, ignoto?.display_name]]);
      c("…e la sua entrata viva senza pari aspetta (attesa_dal), quella col pari no", [true, false], [
        Boolean(ponte.find((r) => r.wa_message_id === `bw:${IGNOTO}:3EB0AA03`)?.attesa_dal),
        Boolean(ponte.find((r) => r.wa_message_id === `bw:${NOTO}:3EB0AA02`)?.attesa_dal),
      ]);
      c("subito dopo il lotto la promozione non promuove niente (120 secondi di attesa): i non letti di NOTO restano 2", 2, m.tab.whatsapp_contacts.find((r) => r.phone_e164 === "+" + NOTO)?.unread_count);
      c("il controllo tardivo legge whatsapp_messages (solo lettura)", true,
        m.chiamate.some((q) => q.tabella === "whatsapp_messages" && q.azione === "select"));
      c("nessuna scrittura diretta delle porte durante un lotto", [], m.scritture.filter((w) => w.via === "diretta"));

      const y = await chiama(POST, { corpo });
      c("lo stesso lotto di nuovo: niente di nuovo (idempotenza)", [0, 3], [y.json?.nuovi, y.json?.gia_presenti]);
      c("…e le righe del ponte restano tre", 3, m.tab.whatsapp_messages.filter((r) => r.canale === "baileys").length);

      const tutti = [...x.log, ...y.log];
      c("i log cominciano tutti con [ponte-wa]", true, tutti.length > 0 && tutti.every((l) => l.startsWith("[ponte-wa] ")));
      c("…e non contengono numeri, nomi, testi, id o uuid", false,
        tutti.some((l) => [NOTO, IGNOTO, "Cliente Finta", "Buongiorno", "3EB0AA", UTENTE, CRM_ID].some((v) => l.includes(v))));
    }

    gruppo("PONTE WHATSAPP · LA ROTTA · IL BATTITO (compito T4)");
    {
      const m = nuovoMondo({
        ...base(),
        whatsapp_messages: [
          //  Una riga del ponte arrivata prima che ManyChat scrivesse la sua: il battito la riabbina.
          { id: "b-0-0000-4000-8000-000000000000", user_id: UTENTE, wa_message_id: `bw:${NOTO}:3EB0BB01`, direction: "outbound",
            from_number: "baileys", to_number: "+" + NOTO, body: "A domani alle 10", media_type: null, status: "sent", canale: "baileys", created_at: iso(-300) },
          { id: CRM_ID, user_id: UTENTE, wa_message_id: "mc-2", direction: "outbound", from_number: "manychat", to_number: "+" + NOTO,
            body: "A domani alle 10", status: "sent", canale: "manychat", created_at: iso(-290) },
          //  Del ponte ma più vecchia di un'ora: il controllo tardivo non la riprende.
          { id: "b-9-0000-4000-8000-000000000000", user_id: UTENTE, wa_message_id: `bw:${NOTO}:3EB0BB09`, direction: "inbound",
            from_number: "+" + NOTO, to_number: "baileys", body: "vecchio", media_type: null, status: "delivered", canale: "baileys", created_at: iso(-7200) },
        ],
      });
      const x = await chiama(POST, { corpo: battito });
      c("200 con i riconciliati", { ok: true, riconciliati: 1 }, x.json);
      c("il doppione tardivo è segnato", CRM_ID, m.tab.whatsapp_messages[0].duplicato_di);
      const riga = m.tab.ponte_wa_stato?.[0] ?? {};
      c("una riga in ponte_wa_stato per l'utente", [1, UTENTE, "collegato"], [m.tab.ponte_wa_stato?.length, riga.user_id, riga.stato]);
      c("…con le colonne della tabella e basta", ["aggiornato_il", "collegato_dal", "contatori", "stato", "storico", "ultimo_messaggio_il", "user_id", "versione"], Object.keys(riga).sort());
      c("…storico e contatori ridotti a numeri", [{ fatto: 1, avanzamento: 100 }, { in_coda: 0, scartati: 0 }], [riga.storico, riga.contatori]);
      c("…aggiornato_il è adesso", true, Math.abs(Date.parse(riga.aggiornato_il) - Date.now()) < 60_000);
      c("…scritta con upsert su user_id", [{ tabella: "ponte_wa_stato", azione: "upsert" }],
        m.scritture.filter((w) => w.via === "diretta").map(({ tabella, azione }) => ({ tabella, azione })));
      const p = m.rpc.find((r) => r.fn === "ponte_wa_candidati");
      c("il controllo tardivo chiede solo le righe dell'ultima ora", [`bw:${NOTO}:3EB0BB01`], p?.args.p_righe.map((r) => r.k));
      c("…e le rilegge con n, d e t giusti", [{ k: `bw:${NOTO}:3EB0BB01`, n: NOTO, d: "out", t: s(iso(-300)) }], p?.args.p_righe);
      await chiama(POST, { corpo: { ...battito, stato: "fermo" } });
      c("un secondo battito aggiorna la stessa riga", [1, "fermo"], [m.tab.ponte_wa_stato.length, m.tab.ponte_wa_stato[0].stato]);
    }

    gruppo("PONTE WHATSAPP · LA ROTTA · LA DOMANDA «NOTI» DELLA CACHE SUL MAC (p3, D7 tolta il 30/10)");
    {
      const m = nuovoMondo(base());
      const x = await chiama(POST, { corpo: { v: 1, tipo: "noti", numeri: [NOTO, IGNOTO] } });
      c("noti → 200 con TUTTI i numeri chiesti (il CRM ora li accetta tutti)", [200, { ok: true, noti: [NOTO, IGNOTO] }], [x.r.status, x.json]);
      c("…nessuna funzione SQL e nessuna lettura del database", [[], []], [m.rpc.map((r) => r.fn), m.chiamate]);
      c("…e nessuna scrittura", [], m.scritture);
      c("…nel log solo il codice e i conteggi", ["[ponte-wa] noti chiesti=2 noti=2"], x.log);
    }

    gruppo("PONTE WHATSAPP · LA ROTTA · LA PROMOZIONE DELLE ENTRATE SOLO DEL PONTE (D9, 30/10)");
    {
      //  Un'entrata viva di uno sconosciuto, senza pari: dopo 120 secondi diventa vera; il pari di
      //  ManyChat che arriva dopo la ritira. Il tempo si sposta riscrivendo attesa_dal.
      Route = rotta.carica();
      POST = Route.options.server.handlers.POST;
      const m = nuovoMondo(base());
      const nuovoNumero = "393330000555";
      await chiama(POST, { corpo: lotto([msg({ id: "3EB0PR01", numero: nuovoNumero, testo: "Buongiorno, mi chiamo Anna Finta" })], { nomi: { [nuovoNumero]: "Profilo Finto" } }) });
      const contatto = () => m.tab.whatsapp_contacts.find((r) => r.phone_e164 === "+" + nuovoNumero);
      const riga = () => m.tab.whatsapp_messages.find((r) => r.wa_message_id === `bw:${nuovoNumero}:3EB0PR01`);
      c("entrata viva di uno sconosciuto: contatto del ponte a 0 non letti, riga in attesa", [0, true, null], [contatto()?.unread_count, Boolean(riga()?.attesa_dal), riga()?.promosso_il ?? null]);
      const b0 = await chiama(POST, { corpo: battito });
      c("un battito subito dopo: ancora niente (non sono passati 120 secondi)", [200, 0], [b0.r.status, contatto()?.unread_count]);
      riga().attesa_dal = new Date(Date.now() - 130_000).toISOString();
      const b1 = await chiama(POST, { corpo: battito });
      c("dopo 130 secondi il battito promuove: +1 non letti, entrata all'ora vera, anteprima", [200, 1, riga().created_at, "Buongiorno, mi chiamo Anna Finta"],
        [b1.r.status, contatto()?.unread_count, contatto()?.ultimo_in_entrata_il, contatto()?.ultimo_in_entrata_anteprima]);
      c("…nel log solo «promosse» col conteggio, nessun numero né testo", [true, false], [
        b1.log.includes("[ponte-wa] promosse n=1"),
        b1.log.some((l) => l.includes(nuovoNumero) || l.includes("Anna") || l.includes("Profilo")),
      ]);
      const b2 = await chiama(POST, { corpo: battito });
      c("un altro battito: non si conta due volte", [200, 1], [b2.r.status, contatto()?.unread_count]);
      c("…il contatto resta senza scheda e senza nome; la riga ha promosso_il", [undefined, null, true], [contatto()?.lead_id, contatto()?.display_name, Boolean(riga()?.promosso_il)]);
      //  Ora il pari di ManyChat: scritto dopo, con il suo +1; il controllo tardivo lo trova e ritira il +1 del ponte.
      m.tab.whatsapp_messages.push({ id: "mc-pr-1", user_id: UTENTE, wa_message_id: "mc-in:pr1", direction: "inbound", from_number: "+" + nuovoNumero,
        to_number: "manychat", body: "Buongiorno, mi chiamo Anna Finta", status: "delivered", canale: "manychat", created_at: iso(-25) });
      contatto().unread_count += 1;
      const b3 = await chiama(POST, { corpo: battito });
      c("il pari di ManyChat dopo la promozione: doppione, e i non letti tornano a 1 (non 2)", [200, "mc-pr-1", 1, true], [b3.r.status, riga().duplicato_di, contatto()?.unread_count, riga().promosso_il == null]);
      const b4 = await chiama(POST, { corpo: battito });
      c("un battito dopo: nessun secondo ritiro", [200, 1], [b4.r.status, contatto()?.unread_count]);
      c("la promozione scrive sui contatti solo le colonne di E3, mai scheda, id ManyChat, STOP, nome, risposto_il", [], (() => {
        const P = ["unread_count", "ultimo_in_entrata_anteprima", "ultimo_in_entrata_il", "last_message_at", "updated_at"];
        return m.scritture.filter((w) => w.tabella === "whatsapp_contacts" && (w.via === "ponte_wa_promuovi" || w.via === "ponte_wa_ritira") && !w.colonne.every((k) => P.includes(k)));
      })());
      c("…e nessuna scrittura diretta delle porte", [], m.scritture.filter((w) => w.via === "diretta" && w.tabella !== "ponte_wa_stato"));
    }

    gruppo("PONTE WHATSAPP · LA ROTTA · LA PROMOZIONE CHE NON C'È (migrazione non applicata)");
    {
      Route = rotta.carica();
      POST = Route.options.server.handlers.POST;
      const m = nuovoMondo(base(), { ponte_wa_promuovi: "PGRST202" });
      const a = await chiama(POST, { corpo: lotto([msg()]) });
      const b = await chiama(POST, { corpo: battito });
      c("ponte_wa_promuovi assente: il lotto e il battito vanno lo stesso (200)", [200, 1, 200], [a.r.status, a.json?.nuovi, b.r.status]);
      c("…con l'avviso funzioni_assenti una volta sola per processo", [1, 0], [a.log.filter((l) => l.includes("funzioni_assenti")).length, b.log.filter((l) => l.includes("funzioni_assenti")).length]);
      c("…e la riga è stata scritta (il ponte importa come prima)", 1, m.tab.whatsapp_messages.filter((r) => r.canale === "baileys").length);
    }

    gruppo("PONTE WHATSAPP · LA ROTTA · IL DATABASE CHE DICE DI NO (compito T4)");
    {
      Route = rotta.carica();
      POST = Route.options.server.handlers.POST;
      let m = nuovoMondo(base(), { ponte_wa_candidati: "PGRST202" });
      const a = await chiama(POST, { corpo: lotto([msg()]) });
      const b = await chiama(POST, { corpo: lotto([msg()]) });
      c("funzioni SQL assenti: 500 database", [500, "database", 500], [a.r.status, a.json?.errore, b.r.status]);
      c("…con l'avviso una volta sola per processo", [1, 0], [a.log.filter((l) => l.includes("funzioni_assenti")).length, b.log.filter((l) => l.includes("funzioni_assenti")).length]);

      for (const codice of ["42883", "42P01", "42703"]) {
        Route = rotta.carica();
        POST = Route.options.server.handlers.POST;
        const chi = codice === "42883" ? "ponte_wa_scrivi" : codice === "42P01" ? "ponte_wa_stato" : "whatsapp_messages";
        m = nuovoMondo(base(), { [chi]: codice });
        const corpo = codice === "42883" ? lotto([msg()]) : battito;
        const p = await chiama(POST, { corpo });
        const q = await chiama(POST, { corpo });
        const conta = (l) => l.filter((r) => r.includes("funzioni_assenti")).length;
        //  42703 sulla lettura del controllo tardivo: il battito è già scritto, quindi 200 (decisione 5 di T3).
        const atteso = codice === "42703" ? 200 : 500;
        c(`migrazione mancante (${codice} su ${chi}): ${atteso}, avviso una volta`, [atteso, atteso, 1, 0], [p.r.status, q.r.status, conta(p.log), conta(q.log)]);
      }

      Route = rotta.carica();
      POST = Route.options.server.handlers.POST;
      m = nuovoMondo(base(), { ponte_wa_candidati: "XX000" });
      const e1 = await chiama(POST, { corpo: lotto([msg()]) });
      const e2 = await chiama(POST, { corpo: lotto([msg()]) });
      c("un altro errore del database: 500 database ogni volta, avviso ogni volta", [500, 500, true, true],
        [e1.r.status, e2.r.status, e1.log.some((l) => l.includes("database")), e2.log.some((l) => l.includes("database"))]);
      c("il messaggio d'errore del database non arriva mai nei log né nella risposta", false,
        [...e1.log, ...e2.log, JSON.stringify(e1.json)].some((l) => l.includes("393330009999") || l.includes("Anna Finta")));
      c("e niente è stato scritto", 0, m.scritture.length);
    }
    c("la rotta non ha chiamato nessuno fuori dal database", 0, esterne);
  } finally {
    globalThis.fetch = fetchVero;
    delete globalThis.__ponteMondo;
    rotta.chiudi();
  }
}
