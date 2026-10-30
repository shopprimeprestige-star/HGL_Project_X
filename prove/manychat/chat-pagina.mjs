/** ── PROVE: CHAT WHATSAPP · I DATI E LE AZIONI DELLA PAGINA (T7) ─────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM), PIANO.md T7. Copre `useChatWa.ts`:
 *  il caricamento (non più i 2000 messaggi più VECCHI), «Da rispondere» dalla riga
 *  contatto, i non letti veri, l'invio con le frasi giuste, i modelli, «Fatto»,
 *  l'abbinamento, l'elimina chat, il timer dell'orologio.
 *
 *  ⚠️ NIENTE DI VERO: l'hook è quello vero, impacchettato con esbuild; React,
 *   Supabase, la rete, `sonner` e il CRM sono finti (qui sotto). Nessuna chiamata
 *   a internet, nessun numero vero. Telefoni e testi sono inventati.
 *  ⚠️ IL REACT FINTO è un piccolo esecutore di hook (useState/useEffect/useMemo/
 *   useRef/useCallback): rifà il rendering quando lo stato cambia ed esegue gli
 *   effetti solo se le dipendenze cambiano, come fa React. Basta per vedere se un
 *   effetto si rilancia quando non deve (il segna-letto, il timer).
 *  ⚠️ IL DATABASE FINTO sa filtrare, ordinare e limitare davvero (eq, or, order,
 *   limit), così «i 2000 più recenti» si prova con 2500 righe vere.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MIN = 60_000;
const ORA_MS = 60 * MIN;
const GIORNO = 24 * ORA_MS;
const T0 = Date.parse("2026-10-28T12:00:00Z");
const iso = (dopo) => new Date(T0 + dopo).toISOString();

const COLONNE_NUOVE = [
  "ultimo_in_entrata_il",
  "ultimo_in_entrata_anteprima",
  "risposto_il",
  "subscriber_id",
  //  p1-chat-veloce: l'ultimo messaggio salvato sul contatto.
  "ultimo_messaggio_il",
  "ultimo_messaggio_anteprima",
  "ultimo_messaggio_direzione",
];

/* ── I moduli finti, in un file ciascuno: leggono tutto da `globalThis.__T` ─── */
const FINTI = {
  react: `const R = () => globalThis.__T.R;
export const useState = (...a) => R().useState(...a);
export const useEffect = (...a) => R().useEffect(...a);
export const useMemo = (...a) => R().useMemo(...a);
export const useRef = (...a) => R().useRef(...a);
export const useCallback = (...a) => R().useCallback(...a);`,
  auth: `export const useAuth = () => ({ user: globalThis.__T.user });
export const fetchCRM = (url, init) => globalThis.fetch(url, init);`,
  crm: `export const useCRM = () => globalThis.__T.crm;`,
  client: `export const supabase = {
  from: (t) => globalThis.__T.db.from(t),
  rpc: (fn, args) => globalThis.__T.db.rpc(fn, args),
  //  La sessione la decide la prova (\`__T.auth\`): così si contano i rinnovi e si appendono.
  auth: {
    getSession: () => globalThis.__T.auth.getSession(),
    refreshSession: () => globalThis.__T.auth.refreshSession(),
  },
  realtime: { setAuth: async () => {} },
  channel: () => globalThis.__T.db.canale(),
  removeChannel: (c) => c?.chiudi?.(),
};`,
  sonner: `export const toast = {
  error: (m) => globalThis.__T.toasts.push({ tipo: "errore", m: String(m) }),
  success: (m) => globalThis.__T.toasts.push({ tipo: "ok", m: String(m) }),
};`,
  editor: `export const caricaModelliSalvati = async () => {};`,
  quick: `export const requiresAnyDialog = () => false;`,
  whatsapp: `export const getWhatsAppMessageForStatus = () => "";
export const segnapostiResidui = (t) => Array.from(new Set((t.match(/\\{\\{?[^{}]*\\}?\\}/g) ?? [])));`,
  //  La regola vera di `patchEsito` (contatore dei tentativi) è provata altrove; qui basta lo stato.
  esito: `export const patchEsito = (_d, stato) => ({ stato });`,
  invioPonte: `export const useInvioPonte = () => undefined;`,
  tipi: `export const LEAD_STATUS_LABEL = {};
export const eStatoDaChiamare = () => true;`,
};

/** ── Un piccolo esecutore di hook ─────────────────────────────────────────── */
function creaRuntime(hook, opz) {
  const slots = [];
  let idx = 0;
  let sporco = true;
  let coda = [];
  let ultimo;
  const stessi = (a, b) =>
    !!a && !!b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const R = {
    useState(init) {
      const k = idx++;
      if (!slots[k]) slots[k] = { v: typeof init === "function" ? init() : init };
      const s = slots[k];
      return [
        s.v,
        (n) => {
          const nv = typeof n === "function" ? n(s.v) : n;
          if (!Object.is(nv, s.v)) {
            s.v = nv;
            sporco = true;
          }
        },
      ];
    },
    useRef(init) {
      const k = idx++;
      if (!slots[k]) slots[k] = { current: init };
      return slots[k];
    },
    useMemo(f, deps) {
      const k = idx++;
      const s = slots[k];
      if (s && stessi(deps, s.deps)) return s.v;
      slots[k] = { v: f(), deps };
      return slots[k].v;
    },
    useCallback(f, deps) {
      return R.useMemo(() => f, deps);
    },
    useEffect(f, deps) {
      const k = idx++;
      if (slots[k] && stessi(deps, slots[k].deps)) return;
      coda.push({ k, f, deps });
    },
  };
  const render = () => {
    idx = 0;
    coda = [];
    ultimo = hook(opz);
    for (const e of coda) {
      slots[e.k]?.pulizia?.();
      slots[e.k] = { deps: e.deps, pulizia: e.f() };
    }
  };
  const assesta = async () => {
    for (let giro = 0; giro < 60; giro++) {
      while (sporco) {
        sporco = false;
        render();
      }
      await new Promise((r) => setImmediate(r));
      if (!sporco) return;
    }
    throw new Error("la pagina non si assesta (ciclo di rendering?)");
  };
  const smonta = () => {
    for (const s of slots) s?.pulizia?.();
  };
  return { R, api: () => ultimo, assesta, smonta };
}

/** ── Il database finto ────────────────────────────────────────────────────── */
/** p1-chat-veloce: le colonne che il database scrive da solo a ogni insert/update
 *  (`updated_at` dei contatti, `cambiato_il` dei messaggi, la migrazione nuova). */
const ORA_AUTO = { whatsapp_contacts: "updated_at", whatsapp_messages: "cambiato_il" };
function creaDb(tabelle) {
  //  I contatti già presenti hanno `updated_at` (default del database); i messaggi
  //  vecchi NO `cambiato_il` (la migrazione non riscrive le righe che ci sono).
  for (const r of tabelle.whatsapp_contacts ?? []) r.updated_at ??= r.created_at;
  /** Il trigger finto: ogni riga nuova o cambiata (anche toccata a mano da una
   *  prova) prende l'ora del database alla prima richiesta dopo. */
  const viste = new WeakMap();
  const impronta = (t, r) => {
    const { [ORA_AUTO[t]]: _, ...resto } = r;
    return JSON.stringify(resto);
  };
  const scatta = (t, primaVolta) => {
    if (!ORA_AUTO[t]) return;
    for (const r of db.tabelle[t] ?? []) {
      const ora = impronta(t, r);
      if (viste.get(r) === ora) continue;
      if (!primaVolta && !db.senzaCambiatoIl) r[ORA_AUTO[t]] = new Date(Date.now()).toISOString();
      if (!primaVolta && db.senzaCambiatoIl && t === "whatsapp_contacts")
        r.updated_at = new Date(Date.now()).toISOString();
      viste.set(r, ora);
    }
  };
  const db = {
    tabelle,
    log: [],
    rpcLog: [],
    gate: null, // promessa da aspettare prima di leggere i contatti
    rifiutaColonne: false, // un update con le colonne nuove dà 42703
    erroreLettura: false, // le letture di messaggi e contatti danno un errore (rete, RLS)
    falliscono: 0, // le prossime N letture di messaggi o contatti danno errore, poi tornano buone
    erroreUpdate: false, // ogni update dà un errore che non è «colonna mancante»
    congelaUpdate: false, // gli update vengono registrati ma non toccano le righe (come una RLS che non lascia passare)
    rpcRisposta: null, // (fn, args) => {data, error}
    cb: [], // realtime: { tabella, f }
    //  `evento`: come i payload di realtime-js ({ eventType, new, old }); senza, la callback riceve `undefined`.
    emetti(t, evento) {
      for (const x of db.cb) if (x.tabella === t) queueMicrotask(() => x.f(evento));
    },
    maxRighe: Infinity, // il tetto di righe per richiesta di PostgREST (1000 in produzione)
    senzaDuplicatoDi: false, // migrazione del ponte non applicata: filtrare `duplicato_di` dà 42703
    senzaCambiatoIl: false, // migrazione p1-chat-veloce non applicata: chiedere `cambiato_il` dà 42703
    canali: [],
    canale() {
      const ch = {
        on: (_t, cfg, f) => {
          db.cb.push({ tabella: cfg.table, f });
          return ch;
        },
        //  Come realtime-js: `removeChannel` richiama la callback con CLOSED.
        subscribe: (stato) => {
          ch.stato = stato;
          return ch;
        },
        chiudi: () => {
          ch.chiuso = true;
          ch.stato?.("CLOSED");
        },
      };
      db.canali.push(ch);
      return ch;
    },
    rpc: (fn, args) => {
      db.rpcLog.push({ fn, args });
      return Promise.resolve(
        db.rpcRisposta ? db.rpcRisposta(fn, args) : { data: true, error: null },
      );
    },
    from(t) {
      const q = {
        t,
        op: "select",
        eq: [],
        gte: [],
        cols: null,
        or: null,
        ord: null,
        lim: null,
        is: [],
        rng: null,
        vals: null,
        sel: false,
        single: false,
      };
      const b = {
        select: (cols) => {
          if (q.op === "select") q.cols = cols ?? "*";
          else q.sel = true;
          return b;
        },
        eq: (k, v) => (q.eq.push([k, v]), b),
        gte: (k, v) => (q.gte.push([k, v]), b),
        or: (s) => ((q.or = s), b),
        is: (k, v) => (q.is.push([k, v]), b),
        range: (da, a) => ((q.rng = [da, a]), b),
        order: (col, o) => ((q.ord = { col, asc: o.ascending }), b),
        limit: (n) => ((q.lim = n), b),
        update: (v) => ((q.op = "update"), (q.vals = v), b),
        delete: () => ((q.op = "delete"), b),
        maybeSingle: () => ((q.single = true), b),
        then: (ok, ko) => db.esegui(q).then(ok, ko),
      };
      return b;
    },
    async esegui(q) {
      for (const t of Object.keys(ORA_AUTO)) scatta(t, false);
      const voce = JSON.parse(JSON.stringify(q));
      db.log.push(voce);
      if (q.t === "whatsapp_contacts" && q.op === "select" && db.gate) await db.gate;
      const righe = db.tabelle[q.t] ?? [];
      const orFiltri = q.or ? q.or.split(",").map((p) => p.split(".eq.")) : null;
      const dentro = (r) =>
        q.eq.every(([k, v]) => String(r[k]) === v) &&
        q.gte.every(([k, v]) => r[k] != null && String(r[k]) >= v) &&
        (!orFiltri || orFiltri.some(([k, v]) => String(r[k]) === v));
      if (q.op === "select" && db.erroreLettura && q.t !== "whatsapp_settings")
        return { data: null, error: { code: "XX000", message: "rete giù" } };
      if (q.op === "select" && db.falliscono > 0 && q.t !== "whatsapp_settings") {
        db.falliscono--;
        return { data: null, error: { code: "PGRST301", message: "JWT expired" } };
      }
      if (q.op === "update" && db.erroreUpdate)
        return { data: null, error: { code: "XX000", message: "update rifiutato" } };
      if (
        q.op === "select" &&
        db.senzaCambiatoIl &&
        (/cambiato_il/.test(q.cols ?? "") || q.gte.some(([k]) => k === "cambiato_il"))
      )
        return { data: null, error: { code: "42703", message: "column cambiato_il does not exist" } };
      if (q.op === "select" && q.is.length && db.senzaDuplicatoDi)
        return { data: null, error: { code: "42703", message: "column duplicato_di does not exist" } };
      if (q.op === "select") {
        let out = righe.filter(dentro).filter((r) => q.is.every(([k]) => r[k] == null));
        if (q.ord) {
          const { col, asc } = q.ord;
          out = [...out].sort(
            (a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1),
          );
        }
        if (q.rng) out = out.slice(q.rng[0], q.rng[1] + 1);
        if (q.lim !== null) out = out.slice(0, q.lim);
        out = out.slice(0, db.maxRighe);
        voce.n = out.length; // quante righe ha risposto, per le prove
        out = out.map((r) => ({ ...r }));
        return { data: q.single ? (out[0] ?? null) : out, error: null };
      }
      if (q.op === "update") {
        if (
          db.rifiutaColonne &&
          Object.keys(q.vals).some((k) => COLONNE_NUOVE.includes(k) || k === "risposto_il")
        )
          return { data: null, error: { code: "42703", message: "column does not exist" } };
        const toccate = righe.filter(dentro);
        if (!db.congelaUpdate) {
          for (const r of toccate) Object.assign(r, q.vals);
          db.emetti(q.t);
        }
        return {
          data: q.sel ? (db.congelaUpdate ? [] : toccate.map((r) => ({ id: r.id }))) : null,
          error: null,
        };
      }
      db.tabelle[q.t] = righe.filter((r) => !dentro(r));
      db.emetti(q.t);
      return { data: null, error: null };
    },
  };
  for (const t of Object.keys(ORA_AUTO)) scatta(t, true);
  return db;
}

export async function proveChatPagina(_mod, { c, gruppo, radice }) {
  const dir = mkdtempSync(join(tmpdir(), "chat-pagina-"));
  const esbuild = createRequire(import.meta.url)("esbuild");
  const richiedi = createRequire(import.meta.url);
  const originali = {
    fetch: globalThis.fetch,
    now: Date.now,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    confirm: globalThis.confirm,
    warn: console.warn,
  };
  try {
    /* ── Impacchetto l'hook vero con i moduli finti ───────────────────────── */
    const alias = {};
    const scrivi = (nome, testo) => {
      const f = join(dir, `${nome}.js`);
      writeFileSync(f, testo);
      return f;
    };
    alias["react"] = scrivi("react", FINTI.react);
    alias["sonner"] = scrivi("sonner", FINTI.sonner);
    alias["@/crm/AuthContext"] = scrivi("auth", FINTI.auth);
    alias["@/crm/CRMContext"] = scrivi("crm", FINTI.crm);
    alias["@/integrations/supabase/client"] = scrivi("client", FINTI.client);
    alias["@/crm/EditorMessaggi"] = scrivi("editor", FINTI.editor);
    alias["@/crm/QuickStatusDialog"] = scrivi("quick", FINTI.quick);
    alias["@/crm/whatsapp"] = scrivi("whatsapp", FINTI.whatsapp);
    alias["@/crm/types"] = scrivi("tipi", FINTI.tipi);
    alias["@/crm/importa/chi-chiamare"] = scrivi("esito", FINTI.esito);
    //  L'invio dal telefono (commessa 2026-10-30-ponte-invio-manuale) ha le sue prove
    //  (prove/ponte/invio-chat-hook.mjs): qui la pagina è quella di prima, senza `ponte`.
    alias["@/crm/chatwa/usaInvioPonte"] = scrivi("invio-ponte", FINTI.invioPonte);
    alias["@"] = join(radice, "src");
    const fuori = join(dir, "hook.cjs");
    await esbuild.build({
      entryPoints: [join(radice, "src/crm/chatwa/useChatWa.ts")],
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: fuori,
      logLevel: "error",
      alias,
    });
    const { useChatWa } = richiedi(fuori);

    /* ── Il mondo di una prova ────────────────────────────────────────────── */
    const U = "utente-pagina-1";
    const msg = (id, direzione, numero, testo, dopo, extra = {}) => ({
      id,
      user_id: U,
      lead_id: null,
      direction: direzione,
      from_number: direzione === "inbound" ? numero : "phone-number-id",
      to_number: direzione === "inbound" ? "phone-number-id" : numero,
      body: testo,
      status: "received",
      wa_message_id: null,
      error_message: null,
      created_at: iso(dopo),
      delivered_at: null,
      read_at: null,
      ...extra,
    });
    const contatto = (id, tel, extra = {}) => ({
      id,
      user_id: U,
      phone_e164: tel,
      lead_id: null,
      display_name: null,
      last_message_at: null,
      unread_count: 0,
      created_at: iso(-30 * GIORNO),
      ...extra,
    });
    const scheda = (id, tel, nome = "Mario") => ({
      id,
      user_id: U,
      data: { nome, cognome: "Rossi", telefono: tel, stato: "nuovo" },
      created_at: iso(-GIORNO),
      updated_at: iso(-GIORNO),
    });
    const risposta = (stato, corpo) => new Response(JSON.stringify(corpo), { status: stato });
    const canaleManychat = {
      canale: "manychat",
      modelliConFlusso: ["hgl_primo_contatto"],
      chiaveManychat: true,
      migrazione: true,
    };

    /** Monta la pagina. `mondo`: { messaggi, contatti, leads, impostazioni, canale, invio } */
    const monta = async (mondo = {}) => {
      const db = creaDb({
        whatsapp_messages: mondo.messaggi ?? [],
        whatsapp_contacts: mondo.contatti ?? [],
        whatsapp_settings: mondo.impostazioni ?? [],
      });
      if (mondo.gate) db.gate = mondo.gate;
      if (mondo.maxRighe) db.maxRighe = mondo.maxRighe;
      if (mondo.senzaDuplicatoDi) db.senzaDuplicatoDi = true;
      if (mondo.senzaCambiatoIl) db.senzaCambiatoIl = true;
      const T = {
        user: { id: U },
        crm: { leads: mondo.leads ?? [], consultants: [], updateLead: async () => {} },
        db,
        toasts: [],
        ora: T0,
        chiamate: [],
        timers: new Map(),
        auth: {
          sessioni: 0,
          rinnovi: 0,
          getSession: async () => {
            T.auth.sessioni++;
            return { data: { session: { access_token: "gettone-finto" } } };
          },
          refreshSession: async () => {
            T.auth.rinnovi++;
            return { data: { session: { access_token: "gettone-nuovo" } }, error: null };
          },
        },
      };
      let nTimer = 0;
      Date.now = () => T.ora;
      globalThis.setInterval = (f, ms) => {
        T.timers.set(++nTimer, { f, ms });
        return nTimer;
      };
      globalThis.clearInterval = (id) => T.timers.delete(id);
      globalThis.confirm = () => (mondo.confirm === undefined ? true : mondo.confirm);
      globalThis.fetch = async (url, init) => {
        T.chiamate.push({ url: String(url), init });
        if (String(url).startsWith("/api/crm/whatsapp-canale")) {
          return mondo.canale === undefined
            ? risposta(200, { ok: true, ...canaleManychat })
            : mondo.canale();
        }
        if (String(url).startsWith("/api/whatsapp-send")) return T.invio(JSON.parse(init.body));
        throw new Error(`rete non prevista: ${url}`);
      };
      T.invio = mondo.invio ?? (async () => risposta(200, { ok: true }));
      globalThis.__T = T;
      const rt = creaRuntime(useChatWa, {
        intercettaChiusura: () => false,
        apriStatoRapido: () => {},
      });
      T.R = rt.R;
      await rt.assesta();
      return {
        T,
        db,
        api: rt.api,
        assesta: rt.assesta,
        smonta: rt.smonta,
        scatta: async () => {
          for (const t of [...T.timers.values()]) t.f();
          await rt.assesta();
        },
        invii: () => T.chiamate.filter((x) => x.url.startsWith("/api/whatsapp-send")),
        corpo: (i = 0) =>
          JSON.parse(T.chiamate.filter((x) => x.url.startsWith("/api/whatsapp-send"))[i].init.body),
        scritture: (tabella) => db.log.filter((q) => q.t === tabella && q.op !== "select"),
        fraseUltima: () => T.toasts.at(-1)?.m ?? null,
      };
    };
    const fine = (p) => p.smonta();
    /** Esito di una promessa: "ok" oppure il messaggio con cui è stata rifiutata. */
    const esito = (promessa) =>
      promessa.then(
        () => "ok",
        (e) => `lancia: ${e.message}`,
      );
    const telefoni = (lista) => lista.map((x) => x.phone);

    const P1 = "+393331110001";
    const P2 = "+393332220002";
    const P3 = "+393333330003";
    const P4 = "+393334440004";

    /* ════════════════════════════════════════════════════════════════════════
     *  1 · IL CARICAMENTO: i 2000 PIÙ RECENTI, e la chat aperta si legge intera
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · CARICAMENTO (2500 messaggi finti)");
    {
      const numeri = [P1, P2, P3, P4, "+393335550005"];
      const messaggi = [];
      // 2500 messaggi in entrata, a giro sui 5 numeri, uno al minuto: i più nuovi in fondo.
      for (let i = 0; i < 2500; i++)
        messaggi.push(
          msg(
            `m${String(i).padStart(4, "0")}`,
            "inbound",
            numeri[i % 5],
            `testo ${i}`,
            -(2600 - i) * MIN,
          ),
        );
      // Una chat vecchissima, più vecchia di tutti i 2500: non può stare fra i recenti.
      const OLD = "+393339990001";
      for (let i = 0; i < 3; i++)
        messaggi.push(msg(`vecchio${i}`, "inbound", OLD, `vecchio ${i}`, -300 * GIORNO + i * MIN));
      const p = await monta({
        messaggi,
        contatti: [
          contatto("c-old", OLD, { last_message_at: iso(-300 * GIORNO) }),
          contatto("c-1", P1),
        ],
      });
      const lettureMsg = p.db.log.filter(
        (q) => q.t === "whatsapp_messages" && q.op === "select" && !q.or && q.lim !== 1,
      );
      const qMsg = lettureMsg[0];
      c(
        "i messaggi si leggono dal PIÙ NUOVO (order created_at DESC), filtrati per utente: prima 300 (pagina subito), poi 2000",
        [{ col: "created_at", asc: false }, [["user_id", U]], [300, 2000], { col: "created_at", asc: false }],
        [qMsg.ord, qMsg.eq, lettureMsg.map((q) => q.lim), lettureMsg[1].ord],
      );
      c(
        "p1-chat-veloce: senza `raw_payload` (il carico grosso sul telefono), con `cambiato_il`",
        [false, true, false],
        [/raw_payload/.test(qMsg.cols), /cambiato_il/.test(qMsg.cols), qMsg.cols === "*"],
      );
      c(
        "dopo i 2000 l'elenco ha la chat più recente e l'ultimo messaggio giusto",
        "m2499",
        p.api().chats.find((x) => x.phone === "+393335550005")?.lastMessage?.id,
      );
      const qCont = p.db.log.find((q) => q.t === "whatsapp_contacts" && q.op === "select");
      c(
        "i contatti si leggono tutti, a pagine di 1000 per id (T7 ponte)",
        [null, [["user_id", U]], { col: "id", asc: true }, [0, 999]],
        [qCont.lim, qCont.eq, qCont.ord, qCont.rng],
      );

      p.api().apri(P1);
      await p.assesta();
      const m1 = p.api().messaggi;
      const ids = m1.map((m) => m.id);
      c(
        "chat aperta: i suoi 500 messaggi, senza doppioni (i recenti + quelli letti alla chat), dal più vecchio",
        [500, 500, true, "m2495", "m0000"],
        [
          m1.length,
          new Set(ids).size,
          ids.every((x, i) => i === 0 || ids[i - 1] < x),
          ids.at(-1),
          ids[0],
        ],
      );
      const qChat = p.db.log
        .filter((q) => q.t === "whatsapp_messages" && q.op === "select" && q.or)
        .at(-1);
      c(
        "la lettura della chat: user_id, i due formati del numero (con e senza +), DESC, limite 500",
        [
          [["user_id", U]],
          "from_number.eq.+393331110001,to_number.eq.+393331110001,from_number.eq.393331110001,to_number.eq.393331110001",
          { col: "created_at", asc: false },
          500,
        ],
        [qChat.eq, qChat.or, qChat.ord, qChat.lim],
      );
      fine(p);

      const p2 = await monta({
        messaggi,
        contatti: [contatto("c-old", OLD, { last_message_at: iso(-300 * GIORNO) })],
      });
      c(
        "chat vecchissima: non sta fra i recenti, ma c'è nell'elenco (dal contatto) con zero messaggi",
        [true, 0],
        [telefoni(p2.api().chats).includes(OLD), p2.api().messaggi.length],
      );
      p2.api().apri(OLD);
      await p2.assesta();
      c(
        "aprendola si leggono i suoi 3 messaggi vecchi, dal più vecchio",
        ["vecchio 0", "vecchio 1", "vecchio 2"],
        p2.api().messaggi.map((m) => m.body),
      );
      fine(p2);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  2 · «DA RISPONDERE» DALLA RIGA CONTATTO
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · «DA RISPONDERE» (dalla riga contatto, senza messaggi)");
    {
      const p = await monta({
        contatti: [
          contatto("c1", P1, {
            ultimo_in_entrata_il: iso(-3 * ORA_MS),
            ultimo_in_entrata_anteprima: "Ciao, sono Anna",
          }),
          contatto("c2", P2, {
            ultimo_in_entrata_il: iso(-2 * GIORNO),
            risposto_il: iso(-3 * GIORNO),
            ultimo_in_entrata_anteprima: "Ancora qui",
          }),
          contatto("c3", P3, { ultimo_in_entrata_il: iso(-ORA_MS), risposto_il: iso(-30 * MIN) }),
          contatto("c4", P4, {
            ultimo_in_entrata_il: iso(-10 * MIN),
            non_scrivere_dal: iso(-GIORNO),
          }),
        ],
      });
      c(
        "in «Da rispondere» come su WhatsApp l'ultima che si è mossa sta sopra; chi ha avuto risposta no; lo STOP sì",
        [[P4, P1, P2]],
        [telefoni(p.api().daRispondere)],
      );
      const per = (tel) => p.api().chats.find((x) => x.phone === tel);
      c(
        "i dati della riga: dal, anteprima, attesa",
        [
          true,
          iso(-3 * ORA_MS),
          "Ciao, sono Anna",
          false,
          { attesa: false, vecchia: false, dal: null, anteprima: null },
        ],
        [
          per(P1).daRispondere.attesa,
          per(P1).daRispondere.dal,
          per(P1).daRispondere.anteprima,
          per(P3).daRispondere.attesa,
          (({ attesa, vecchia, dal, anteprima }) => ({ attesa, vecchia, dal, anteprima }))(
            per(P3).daRispondere,
          ),
        ],
      );
      c(
        "la chat con STOP lo dice (stop: true) e le altre no",
        [true, false, false],
        [per(P4).stop, per(P1).stop, per(P2).stop],
      );
      c(
        "finestra di 24 ore: aperta per chi ha scritto 3 ore fa (21 ore), chiusa per chi ha scritto 2 giorni fa",
        [
          true,
          "Puoi scrivere libero ancora per 21 ore",
          false,
          "Finestra di 24 ore chiusa: puoi mandare solo un modello approvato",
        ],
        [
          per(P1).finestra.aperta,
          per(P1).finestra.frase,
          per(P2).finestra.aperta,
          per(P2).finestra.frase,
        ],
      );
      p.api().apri(P2);
      await p.assesta();
      const s2 = p.api().stato;
      p.api().apri(P4);
      await p.assesta();
      const s4 = p.api().stato;
      p.api().apri(P1);
      await p.assesta();
      c(
        "la casella: finestra chiusa → solo modelli, STOP → stop, finestra aperta → libera",
        ["solo_modelli", "stop", "libera"],
        [s2, s4, p.api().stato],
      );
      fine(p);

      // Il ripiego: colonne ASSENTI (prima della migrazione), si guarda ai messaggi.
      const q = await monta({
        contatti: [contatto("c1", P1), contatto("c2", P2), contatto("c3", P3)],
        messaggi: [
          msg("a1", "inbound", P1, "ciao due giorni fa", -2 * GIORNO),
          msg("b1", "inbound", P2, "ciao nove giorni fa", -9 * GIORNO),
          msg("c1a", "inbound", P3, "domanda", -3 * ORA_MS),
          msg("c1b", "outbound", P3, "risposta", -2 * ORA_MS),
        ],
      });
      const perq = (tel) => q.api().chats.find((x) => x.phone === tel);
      c(
        "colonne assenti: ultimo messaggio del cliente degli ultimi 7 giorni senza risposta → in attesa",
        [[P1], true],
        [telefoni(q.api().daRispondere), perq(P1).daRispondere.attesa],
      );
      c(
        "colonne assenti: oltre 7 giorni NON è in elenco, ma resta segnata (attesa falsa, dal valorizzato) per la riga «da più di 7 giorni»",
        [false, true, iso(-9 * GIORNO), []],
        [
          perq(P2).daRispondere.attesa,
          perq(P2).daRispondere.vecchia,
          perq(P2).daRispondere.dal,
          telefoni(q.api().daRispondere).filter((t) => t === P2),
        ],
      );
      c(
        "colonne assenti: se c'è una risposta dopo, non è in attesa e non è «vecchia»",
        [false, false],
        [perq(P3).daRispondere.attesa, perq(P3).daRispondere.vecchia],
      );
      fine(q);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  3 · NON LETTI VERI, SEGNA-LETTO, TIMER
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · NON LETTI VERI (aprire non risponde)");
    {
      const p = await monta({
        contatti: [
          contatto("c1", P1, {
            unread_count: 3,
            ultimo_in_entrata_il: iso(-3 * ORA_MS),
            ultimo_in_entrata_anteprima: "tre",
          }),
        ],
        messaggi: [
          msg("x1", "inbound", P1, "uno", -3 * ORA_MS - 2 * MIN),
          msg("x2", "inbound", P1, "due", -3 * ORA_MS - MIN),
          msg("x3", "inbound", P1, "tre", -3 * ORA_MS),
        ],
      });
      c("il pallino conta 3, non 1", [3], [p.api().chats[0].unread]);
      p.api().apri(P1);
      await p.assesta();
      const u = p.scritture("whatsapp_contacts");
      c(
        "aprendo la chat si azzerano i non letti (una scrittura) e SOLO quelli: mai risposto_il",
        [
          1,
          { unread_count: 0 },
          [
            ["user_id", U],
            ["phone_e164", P1],
          ],
        ],
        [u.length, u[0]?.vals, u[0]?.eq],
      );
      c(
        "dopo l'apertura i non letti sono 0 ma la chat resta in «Da rispondere»",
        [0, [P1]],
        [p.api().chats[0].unread, telefoni(p.api().daRispondere)],
      );
      c(
        "tre timer: controllo dei messaggi nuovi (15 s), battito anti-congelamento (20 s), orologio (30 s)",
        [[15_000, 20_000, 30_000]],
        [[...p.T.timers.values()].map((t) => t.ms).sort((x, y) => x - y)],
      );
      // Passa mezz'ora in giri da 30 secondi: l'elenco si ricalcola ma il segna-letto NON si rilancia.
      for (let i = 0; i < 4; i++) {
        p.T.ora += 30_000;
        await p.scatta();
      }
      c(
        "i giri del timer non rilanciano il segna-letto",
        [1],
        [p.scritture("whatsapp_contacts").length],
      );
      p.T.ora += 2 * ORA_MS;
      await p.scatta();
      c(
        "il timer aggiorna le frasi: dopo 2 ore e 2 minuti la finestra dice 18 ore",
        ["Puoi scrivere libero ancora per 18 ore"],
        [p.api().attiva.finestra.frase],
      );
      p.smonta();
      c("smontando la pagina il timer si ferma", [0], [p.T.timers.size]);

      // Se l'azzeramento non va a segno (RLS, rete) il timer non deve martellare il database.
      const z = await monta({
        contatti: [contatto("c1", P1, { unread_count: 3, ultimo_in_entrata_il: iso(-ORA_MS) })],
      });
      z.db.congelaUpdate = true;
      z.api().apri(P1);
      await z.assesta();
      for (let i = 0; i < 4; i++) {
        z.T.ora += 30_000;
        await z.scatta();
      }
      c(
        "azzeramento che non va a segno: il timer dell'orologio non lo ripete (una sola scrittura)",
        [1],
        [z.scritture("whatsapp_contacts").length],
      );
      fine(z);

      // Arriva un altro messaggio mentre la chat è aperta: si rimette a zero ancora una volta.
      const q = await monta({
        contatti: [contatto("c1", P1, { unread_count: 0, ultimo_in_entrata_il: iso(-MIN) })],
      });
      q.api().apri(P1);
      await q.assesta();
      c(
        "chat aperta con zero non letti: nessuna scrittura",
        [0],
        [q.scritture("whatsapp_contacts").length],
      );
      q.db.tabelle.whatsapp_contacts[0].unread_count = 1;
      q.db.emetti("whatsapp_contacts");
      await q.assesta();
      c(
        "un messaggio nuovo a chat aperta si segna letto una volta",
        [1, 0],
        [q.scritture("whatsapp_contacts").length, q.api().chats[0].unread],
      );
      fine(q);

      // Aprire per id del contatto (T11 apre con ?chat=<uuid>).
      const r = await monta({ contatti: [contatto("uuid-1", P1)] });
      r.api().apri("uuid-1");
      await r.assesta();
      c("apri(id del contatto) apre la chat di quel contatto", [P1], [r.api().attiva?.phone]);
      fine(r);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  4 · L'INVIO
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · INVIO DEL TESTO");
    {
      const base = () => ({
        contatti: [
          contatto("c1", P1, {
            lead_id: "lead-1",
            ultimo_in_entrata_il: iso(-3 * ORA_MS),
            ultimo_in_entrata_anteprima: "ciao",
          }),
        ],
        leads: [scheda("lead-1", "3331110001")],
      });
      // La rotta vera scrive risposto_il con l'ora del database (qui: l'ora finta).
      const serverCheScrive = (p) => async () => {
        p.db.tabelle.whatsapp_contacts[0].risposto_il = new Date(p.T.ora).toISOString();
        return risposta(200, { ok: true, waMessageId: "mc:1" });
      };

      // a) Invio ok col canale ManyChat e SENZA chiavi Meta.
      {
        const p = await monta(base());
        p.T.invio = serverCheScrive(p);
        p.api().apri(P1);
        await p.assesta();
        p.api().setBozza("Buongiorno Anna");
        await p.assesta();
        await p.api().invia();
        await p.assesta();
        c(
          "canale ManyChat senza chiavi Meta: la casella è libera e l'invio parte (mai «Configura prima le credenziali»)",
          [1, 0],
          [p.invii().length, p.T.toasts.filter((t) => /Configura/.test(t.m)).length],
        );
        c(
          "il corpo dell'invio: numero, testo senza spazi ai bordi, scheda; testo libero (nessun modello)",
          [{ to: P1, body: "Buongiorno Anna", leadId: "lead-1" }],
          [p.corpo()],
        );
        c(
          "intestazioni: JSON e gettone della sessione",
          ["application/json", "Bearer gettone-finto"],
          [p.invii()[0].init.headers["Content-Type"], p.invii()[0].init.headers.Authorization],
        );
        c(
          "invio ok: la bozza si svuota e il cliente esce da «Da rispondere»",
          ["", []],
          [p.api().bozza, telefoni(p.api().daRispondere)],
        );
        // Il cliente riscrive dopo: rientra (l'uscita ottimistica non resta appesa).
        p.db.tabelle.whatsapp_contacts[0].ultimo_in_entrata_il = new Date(
          p.T.ora + 5 * MIN,
        ).toISOString();
        p.db.emetti("whatsapp_contacts");
        await p.assesta();
        c(
          "se il cliente riscrive rientra in «Da rispondere»",
          [[P1]],
          [telefoni(p.api().daRispondere)],
        );
        fine(p);
      }

      // b) L'uscita è subito, senza aspettare la ricarica (ottimistica).
      {
        const p = await monta(base());
        p.api().apri(P1);
        await p.assesta();
        p.api().setBozza("Ciao");
        await p.assesta();
        let apri;
        p.T.invio = async () => {
          p.db.tabelle.whatsapp_contacts[0].risposto_il = new Date(p.T.ora).toISOString();
          p.db.gate = new Promise((r) => (apri = r)); // la ricarica dei contatti resta in attesa
          return risposta(200, { ok: true });
        };
        const invio = p.api().invia();
        await p.assesta();
        c(
          "mentre la ricarica non è ancora tornata il cliente è già fuori da «Da rispondere»",
          [[]],
          [telefoni(p.api().daRispondere)],
        );
        p.db.gate = null;
        apri();
        await invio;
        await p.assesta();
        c(
          "a ricarica finita resta fuori (il database conferma)",
          [[]],
          [telefoni(p.api().daRispondere)],
        );
        fine(p);
      }

      // b2) Il browser è indietro rispetto al database: l'uscita vale lo stesso.
      {
        const p = await monta({
          contatti: [contatto("c1", P1, { ultimo_in_entrata_il: iso(5 * MIN) })],
        });
        p.api().apri(P1);
        await p.assesta();
        p.api().setBozza("Ciao");
        await p.assesta();
        let apri;
        p.T.invio = async () => {
          p.db.gate = new Promise((r) => (apri = r));
          return risposta(200, { ok: true });
        };
        const invio = p.api().invia();
        await p.assesta();
        c(
          "orologio del browser 5 minuti indietro: il cliente esce comunque (come greatest(now(), ultimo messaggio) del database)",
          [[]],
          [telefoni(p.api().daRispondere)],
        );
        p.db.gate = null;
        apri();
        await invio;
        fine(p);
      }

      // c) Doppio clic: una sola chiamata.
      {
        const p = await monta(base());
        p.T.invio = serverCheScrive(p);
        p.api().apri(P1);
        await p.assesta();
        p.api().setBozza("Doppio");
        await p.assesta();
        const invia = p.api().invia;
        await Promise.all([invia(), invia()]);
        await p.assesta();
        c(
          "due invii nello stesso istante (doppio clic, Invio ripetuto): una chiamata sola",
          [1],
          [p.invii().length],
        );
        fine(p);
      }

      // d) 429: «Un attimo, riprova», bozza intatta.
      {
        const p = await monta(base());
        p.T.invio = async () =>
          risposta(429, {
            error: "riprova_fra_poco",
            message: "Riprova fra un minuto: a questo numero è appena partito un messaggio.",
          });
        p.api().apri(P1);
        await p.assesta();
        p.api().setBozza("Ci sei?");
        await p.assesta();
        await p.api().invia();
        await p.assesta();
        c(
          "429 sul testo libero: «Un attimo, riprova», bozza intatta, ancora in «Da rispondere»",
          ["Un attimo, riprova", "Ci sei?", [P1]],
          [p.fraseUltima(), p.api().bozza, telefoni(p.api().daRispondere)],
        );
        fine(p);
      }

      // e) Fuori dalle 24 ore secondo il server: casella ai modelli, bozza intatta.
      {
        const p = await monta(base());
        p.T.invio = async () =>
          risposta(502, {
            error: "wa_api_error",
            category: "outside_24h_window",
            message:
              "Fuori dalle 24 ore dall'ultimo messaggio del cliente serve un modello approvato.",
          });
        p.api().apri(P1);
        await p.assesta();
        c("prima del rifiuto la casella è libera", ["libera"], [p.api().stato]);
        p.api().setBozza("Testo lungo da non perdere");
        await p.assesta();
        await p.api().invia();
        await p.assesta();
        c(
          "outside_24h_window: frase chiara, bozza intatta, casella ai modelli per quella chat",
          [
            "Sono passate più di 24 ore: scegli un modello",
            "Testo lungo da non perdere",
            { [P1]: true },
            "solo_modelli",
          ],
          [p.fraseUltima(), p.api().bozza, p.api().forzaModelli, p.api().stato],
        );
        // Un messaggio nuovo del cliente: la finestra è aperta davvero, la chat torna libera.
        p.db.tabelle.whatsapp_contacts[0].ultimo_in_entrata_il = new Date(
          p.T.ora - MIN,
        ).toISOString();
        p.db.emetti("whatsapp_contacts");
        await p.assesta();
        c(
          "se il cliente riscrive, il «solo modelli» forzato cade",
          [{}, "libera"],
          [p.api().forzaModelli, p.api().stato],
        );
        fine(p);
      }

      // f) Errori: mai un messaggio tecnico.
      {
        const casi = [
          [
            "messaggio del server: si mostra quello",
            async () =>
              risposta(502, {
                error: "wa_api_error",
                message: "ManyChat ha rifiutato il messaggio: controlla il collegamento.",
              }),
            "ManyChat ha rifiutato il messaggio: controlla il collegamento.",
          ],
          [
            "risposta senza messaggio",
            async () => risposta(500, { error: "boom" }),
            "Invio non riuscito, riprova",
          ],
          [
            "risposta che non è JSON (pagina d'errore)",
            async () => new Response("<html>Bad gateway</html>", { status: 502 }),
            "Invio non riuscito, riprova",
          ],
          [
            "rete caduta",
            async () => {
              throw new TypeError("Failed to fetch");
            },
            "Invio non riuscito, riprova",
          ],
        ];
        for (const [nome, invio, atteso] of casi) {
          const p = await monta(base());
          p.T.invio = invio;
          p.api().apri(P1);
          await p.assesta();
          p.api().setBozza("Prova");
          await p.assesta();
          await p.api().invia();
          await p.assesta();
          c(
            `${nome}: a schermo «${atteso}», nessun «HTTP», bozza intatta, inviando spento`,
            [atteso, false, "Prova", false],
            [p.fraseUltima(), /HTTP/.test(p.fraseUltima() ?? ""), p.api().bozza, p.api().inviando],
          );
          fine(p);
        }
      }

      // g) Canale cloud: blocca solo se mancano le chiavi Meta. Canale non leggibile: non blocca.
      {
        const cloud = () =>
          risposta(200, {
            ok: true,
            canale: "cloud",
            modelliConFlusso: [],
            chiaveManychat: false,
            migrazione: true,
          });
        const p = await monta({ ...base(), canale: cloud });
        p.api().apri(P1);
        await p.assesta();
        c("canale cloud senza chiavi Meta: stato «configura»", ["configura"], [p.api().stato]);
        p.api().setBozza("Ciao");
        await p.assesta();
        await p.api().invia();
        c(
          "canale cloud senza chiavi: «Configura prima le credenziali…», nessuna chiamata",
          ["Configura prima le credenziali WhatsApp in Impostazioni → WhatsApp", 0, "Ciao"],
          [p.fraseUltima(), p.invii().length, p.api().bozza],
        );
        fine(p);

        const q = await monta({
          ...base(),
          canale: cloud,
          impostazioni: [{ user_id: U, phone_number_id: "123", access_token: "tok" }],
        });
        q.api().apri(P1);
        await q.assesta();
        c("canale cloud con le chiavi Meta: libera", ["libera"], [q.api().stato]);
        fine(q);

        for (const [nome, canale] of [
          ["403", () => risposta(403, { error: "permesso" })],
          ["503", () => risposta(503, { error: "canale_non_leggibile" })],
          [
            "rete",
            () => {
              throw new Error("rete");
            },
          ],
        ]) {
          const r = await monta({ ...base(), canale });
          r.T.invio = async () => {
            r.db.tabelle.whatsapp_contacts[0].risposto_il = new Date(r.T.ora).toISOString();
            return risposta(200, { ok: true });
          };
          r.api().apri(P1);
          await r.assesta();
          r.api().setBozza("Ciao");
          await r.assesta();
          const statoPrima = r.api().stato;
          await r.api().invia();
          c(
            `canale non leggibile (${nome}): la casella non si blocca e l'invio parte (decide il server)`,
            [null, "libera", 1],
            [r.api().canale, statoPrima, r.invii().length],
          );
          fine(r);
        }
      }

      // h) Segnaposto nella bozza: si chiede conferma, "no" = niente invio.
      {
        const p = await monta({ ...base(), confirm: false });
        p.api().apri(P1);
        await p.assesta();
        p.api().setBozza("Ciao {nome}");
        await p.assesta();
        c("segnaposto nella bozza", [["{nome}"]], [p.api().residuiBozza]);
        await p.api().invia();
        c(
          "conferma negata: nessun invio, bozza intatta",
          [0, "Ciao {nome}"],
          [p.invii().length, p.api().bozza],
        );
        fine(p);
      }
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  5 · I MODELLI
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · INVIO DI UN MODELLO");
    {
      const base = () => ({
        contatti: [
          contatto("c1", P1, { lead_id: "lead-1", ultimo_in_entrata_il: iso(-2 * GIORNO) }),
        ],
        leads: [scheda("lead-1", "3331110001")],
      });
      const p = await monta(base());
      p.T.invio = async () => {
        p.db.tabelle.whatsapp_contacts[0].risposto_il = new Date(p.T.ora).toISOString();
        return risposta(200, { ok: true });
      };
      p.api().apri(P1);
      await p.assesta();
      p.api().setBozza("bozza di testo che resta");
      await p.assesta();
      const eOk = await esito(
        p
          .api()
          .inviaModello({ nome: "hgl_primo_contatto", lingua: "it", parametri: ["Anna", "Luca"] }),
      );
      await p.assesta();
      c("modello partito: non lancia", ["ok"], [eOk]);
      c(
        "il modello va alla stessa rotta con nome, lingua e parametri (e nessun testo libero)",
        [
          {
            to: P1,
            templateName: "hgl_primo_contatto",
            templateLang: "it",
            templateParams: ["Anna", "Luca"],
            leadId: "lead-1",
          },
        ],
        [p.corpo()],
      );
      c(
        "modello partito: il cliente esce da «Da rispondere», la bozza di testo non si tocca",
        [[], "bozza di testo che resta"],
        [telefoni(p.api().daRispondere), p.api().bozza],
      );
      fine(p);

      const q = await monta(base());
      q.T.invio = async () =>
        risposta(429, {
          error: "riprova_fra_poco",
          message: "Riprova fra un minuto: a questo numero è appena partito un messaggio.",
        });
      q.api().apri(P1);
      await q.assesta();
      const e429 = await esito(
        q.api().inviaModello({ nome: "hgl_primo_contatto", lingua: "it", parametri: [] }),
      );
      c(
        "modello bloccato dalla pausa (429): «Un attimo, riprova», LANCIA (la casella resta sull'anteprima), il cliente resta in attesa",
        ["Un attimo, riprova", "lancia: invio non riuscito", [P1]],
        [q.fraseUltima(), e429, telefoni(q.api().daRispondere)],
      );
      fine(q);

      const r = await monta(base());
      r.T.invio = async () => risposta(502, { error: "wa_api_error", message: "" });
      r.api().apri(P1);
      await r.assesta();
      const eRif = await esito(r.api().inviaModello({ nome: "x", lingua: "it", parametri: [] }));
      c(
        "modello rifiutato senza frase: «Invio non riuscito, riprova» e lancia",
        ["Invio non riuscito, riprova", "lancia: invio non riuscito"],
        [r.fraseUltima(), eRif],
      );
      fine(r);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  6 · «RISPOSTO / FATTO»
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · «FATTO» (rpc whatsapp_segna_fatto)");
    {
      const base = () => ({
        contatti: [contatto("c1", P1, { ultimo_in_entrata_il: iso(-3 * ORA_MS) })],
      });
      const comeIlDatabase = (p) => (fn) => {
        p.db.tabelle.whatsapp_contacts[0].risposto_il = new Date(p.T.ora).toISOString();
        return { data: true, error: null };
      };

      const p = await monta(base());
      p.db.rpcRisposta = comeIlDatabase(p);
      p.api().apri(P1);
      await p.assesta();
      await p.api().segnaFatto();
      await p.assesta();
      c(
        "chiama la funzione del database col numero della chat",
        [[{ fn: "whatsapp_segna_fatto", args: { p_phone: P1 } }]],
        [p.db.rpcLog],
      );
      c(
        "«Fatto»: il cliente esce, non si manda niente, non si scrive risposto_il dal browser",
        [[], 0, 0],
        [
          telefoni(p.api().daRispondere),
          p.invii().length,
          p.scritture("whatsapp_contacts").filter((q) => "risposto_il" in q.vals).length,
        ],
      );
      // Se il cliente riscrive, rientra.
      p.db.tabelle.whatsapp_contacts[0].ultimo_in_entrata_il = new Date(
        p.T.ora + MIN,
      ).toISOString();
      p.db.emetti("whatsapp_contacts");
      await p.assesta();
      c("dopo «Fatto», se il cliente riscrive rientra", [[P1]], [telefoni(p.api().daRispondere)]);
      fine(p);

      // Esce subito, anche prima che la ricarica torni.
      const g = await monta(base());
      g.db.rpcRisposta = comeIlDatabase(g);
      g.api().apri(P1);
      await g.assesta();
      let apri;
      g.db.gate = new Promise((r) => (apri = r));
      const fatto = g.api().segnaFatto();
      await g.assesta();
      c("«Fatto» esce subito, senza aspettare la ricarica", [[]], [telefoni(g.api().daRispondere)]);
      g.db.gate = null;
      apri();
      await fatto;
      fine(g);

      for (const codice of ["42883", "PGRST202"]) {
        const q = await monta(base());
        q.db.rpcRisposta = () => ({
          data: null,
          error: { code: codice, message: "function does not exist" },
        });
        q.api().apri(P1);
        await q.assesta();
        await q.api().segnaFatto();
        await q.assesta();
        c(
          `funzione mancante (${codice}): «Manca l'aggiornamento del database», la chat resta in attesa`,
          ["Manca l'aggiornamento del database: avvisa il titolare", [P1]],
          [q.fraseUltima(), telefoni(q.api().daRispondere)],
        );
        fine(q);
      }

      const r = await monta(base());
      r.db.rpcRisposta = () => ({ data: null, error: { code: "XX000", message: "boom segreto" } });
      r.api().apri(P1);
      await r.assesta();
      await r.api().segnaFatto();
      await r.assesta();
      c(
        "altro errore: frase chiara, nessun testo tecnico, resta in attesa",
        ["Non sono riuscito a segnare «Fatto», riprova", [P1]],
        [r.fraseUltima(), telefoni(r.api().daRispondere)],
      );
      fine(r);

      const s = await monta(base());
      s.db.rpcRisposta = () => ({ data: false, error: null });
      s.api().apri(P1);
      await s.assesta();
      await s.api().segnaFatto();
      await s.assesta();
      c(
        "la funzione non ha toccato nessuna riga (false): non si dice «fatto» e resta in attesa",
        [true, [P1]],
        [s.T.toasts.at(-1).tipo === "errore", telefoni(s.api().daRispondere)],
      );
      fine(s);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  7 · LE SCHEDE E L'ABBINAMENTO
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · SCHEDE E «ABBINA»");
    {
      const p = await monta({
        contatti: [
          contatto("c1", P1),
          contatto("c2", P2),
          contatto("c3", P3),
          contatto("c4", P4, { lead_id: "lead-x" }),
        ],
        leads: [
          scheda("lead-a", "333 111 0001", "Anna"),
          scheda("lead-b", "3332220002", "Berta"),
          scheda("lead-b2", "+39 333 222 0002", "Berta bis"),
          scheda("lead-x", "3339999999", "Xena"),
        ],
      });
      const per = (tel) => p.api().chats.find((x) => x.phone === tel);
      c(
        "una sola scheda con quel numero: collegata",
        [true, "lead-a", false, false],
        [per(P1).lead?.id === "lead-a", per(P1).leadId, per(P1).senzaScheda, per(P1).schedaAmbigua],
      );
      c(
        "due schede con lo stesso numero: non sceglie (ambigua, nessuna scheda)",
        [null, true, false],
        [per(P2).lead, per(P2).schedaAmbigua, per(P2).senzaScheda],
      );
      c(
        "nessuna scheda: «Numero senza scheda»",
        [null, null, true, false],
        [per(P3).lead, per(P3).leadId, per(P3).senzaScheda, per(P3).schedaAmbigua],
      );
      c(
        "scheda già scelta sul contatto (lead_id): vince, anche se il numero è diverso",
        [true, false],
        [per(P4).lead?.id === "lead-x", per(P4).senzaScheda],
      );

      p.api().apri(P3);
      await p.assesta();
      const eAltra = await esito(p.api().abbina("lead-a", P1));
      c(
        "abbina con il numero di un'altra chat (finestra vecchia): non scrive niente, frase d'errore, la promessa è RIFIUTATA",
        [0, "errore", "lancia: abbinamento non riuscito"],
        [
          p.scritture("whatsapp_contacts").filter((q) => q.vals && "lead_id" in q.vals).length,
          p.T.toasts.at(-1)?.tipo,
          eAltra,
        ],
      );
      const eOk = await esito(p.api().abbina("lead-a", "+39 333 333 0003"));
      await p.assesta();
      c("abbinamento riuscito: la promessa si risolve", ["ok"], [eOk]);
      const u = p.scritture("whatsapp_contacts").filter((q) => q.vals && "lead_id" in q.vals);
      c(
        "abbina: scrive lead_id sul contatto per id (e utente)",
        [
          1,
          { lead_id: "lead-a" },
          [
            ["id", "c3"],
            ["user_id", U],
          ],
        ],
        [u.length, u[0]?.vals, u[0]?.eq],
      );
      c(
        "dopo l'abbinamento la chat ha la scheda",
        [false, "lead-a"],
        [per(P3).senzaScheda, per(P3).leadId],
      );
      fine(p);

      // La RLS non lascia passare l'update: nessun errore dal database, ma nessuna riga toccata.
      const rls = await monta({ contatti: [contatto("c3", P3)] });
      rls.db.congelaUpdate = true;
      rls.api().apri(P3);
      await rls.assesta();
      const eRls = await esito(rls.api().abbina("lead-a"));
      c(
        "update che non tocca righe (RLS): non si dice «abbinata», frase d'errore, promessa RIFIUTATA, un solo toast",
        ["errore", "Abbinamento non riuscito, riprova", "lancia: abbinamento non riuscito", 1],
        [rls.T.toasts.at(-1)?.tipo, rls.fraseUltima(), eRls, rls.T.toasts.length],
      );
      fine(rls);

      // Errore del database sull'update: stessa cosa.
      const err = await monta({ contatti: [contatto("c3", P3)] });
      err.api().apri(P3);
      await err.assesta();
      err.db.erroreUpdate = true;
      const eErr = await esito(err.api().abbina("lead-a"));
      c(
        "errore del database sull'abbinamento: frase chiara e promessa RIFIUTATA",
        ["Abbinamento non riuscito, riprova", "lancia: abbinamento non riuscito"],
        [err.fraseUltima(), eErr],
      );
      fine(err);

      // Nessuna riga toccata (RLS) o nessun contatto: non si dice «abbinata».
      const q = await monta({
        contatti: [contatto("c3", P3)],
        messaggi: [msg("z", "inbound", P3, "solo storico", -MIN)],
      });
      q.db.tabelle.whatsapp_contacts = [];
      q.db.emetti("whatsapp_contacts");
      await q.assesta();
      q.api().apri(P3);
      await q.assesta();
      const eSenza = await esito(q.api().abbina("lead-a"));
      c(
        "chat senza riga contatto: nessun abbinamento finto, una frase chiara, promessa RIFIUTATA",
        ["errore", "lancia: abbinamento non riuscito"],
        [q.T.toasts.at(-1)?.tipo, eSenza],
      );
      fine(q);
    }

    gruppo("CHAT WHATSAPP · PAGINA · RICERCA");
    {
      const p = await monta({
        contatti: [contatto("c1", P1, { display_name: "Giulia Verdi" }), contatto("c2", P2)],
        leads: [scheda("lead-b", "3339990000", "Berta")],
      });
      p.api().setRicerca("giuLIA");
      await p.assesta();
      c(
        "la ricerca guarda anche il nome WhatsApp del contatto (numeri senza scheda)",
        [[P1]],
        [telefoni(p.api().visibili)],
      );
      p.api().setRicerca("2220002");
      await p.assesta();
      c("e sempre il numero", [[P2]], [telefoni(p.api().visibili)]);
      fine(p);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  8 · ELIMINA CHAT (D19)
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · ELIMINA CHAT (D19)");
    {
      const base = () => ({
        contatti: [
          contatto("c1", P1, {
            unread_count: 2,
            last_message_at: iso(-3 * ORA_MS),
            ultimo_in_entrata_il: iso(-3 * ORA_MS),
            ultimo_messaggio_il: iso(-2 * ORA_MS),
            ultimo_messaggio_anteprima: "due",
            ultimo_messaggio_direzione: "outbound",
          }),
        ],
        messaggi: [
          msg("e1", "inbound", P1, "uno", -3 * ORA_MS),
          msg("e2", "outbound", P1, "due", -2 * ORA_MS),
          msg("e3", "inbound", "+393338880008", "altra chat", -ORA_MS),
        ],
      });
      const p = await monta(base());
      p.api().apri(P1);
      await p.assesta();
      await p.api().elimina();
      await p.assesta();
      const d = p.scritture("whatsapp_messages")[0];
      c(
        "cancella i messaggi della chat (i due formati del numero), utente",
        [
          [["user_id", U]],
          "from_number.eq.+393331110001,to_number.eq.+393331110001,from_number.eq.393331110001,to_number.eq.393331110001",
        ],
        [d.eq, d.or],
      );
      const azzera = p
        .scritture("whatsapp_contacts")
        .filter((q) => q.vals && "last_message_at" in q.vals);
      c(
        "azzera anche ultimo_in_entrata_il, risposto_il e l'ultimo messaggio salvato (p1-chat-veloce), oltre a non letti e ultimo messaggio",
        [
          1,
          {
            unread_count: 0,
            last_message_at: null,
            ultimo_in_entrata_il: null,
            risposto_il: null,
            ultimo_messaggio_il: null,
            ultimo_messaggio_anteprima: null,
            ultimo_messaggio_direzione: null,
          },
        ],
        [azzera.length, azzera[0]?.vals],
      );
      const rimasto = p.db.tabelle.whatsapp_contacts.find((x) => x.phone_e164 === P1);
      c(
        "p1-chat-veloce: sul contatto della chat eliminata non resta l'anteprima (la riga non mostra un messaggio cancellato)",
        [null, null, null],
        [rimasto?.ultimo_messaggio_il, rimasto?.ultimo_messaggio_anteprima, rimasto?.ultimo_messaggio_direzione],
      );
      c(
        "la chat eliminata non è più in «Da rispondere», la chat aperta si chiude, l'altra chat (senza colonne) resta com'è",
        [["+393338880008"], null, ["e3"]],
        [
          telefoni(p.api().daRispondere),
          p.api().attiva,
          p.db.tabelle.whatsapp_messages.map((m) => m.id),
        ],
      );
      c("elimina ok: «Chat eliminata»", ["Chat eliminata"], [p.fraseUltima()]);
      fine(p);

      // Colonne assenti: si riprova col solo set di prima, senza errori a schermo.
      const q = await monta(base());
      q.db.rifiutaColonne = true;
      q.api().apri(P1);
      await q.assesta();
      await q.api().elimina();
      await q.assesta();
      const tentativi = q
        .scritture("whatsapp_contacts")
        .filter((x) => x.vals && "last_message_at" in x.vals)
        .map((x) => Object.keys(x.vals).sort());
      c(
        "colonne mancanti: il primo tentativo dà 42703, si riprova col solo set di prima",
        [
          [
            [
              "last_message_at",
              "risposto_il",
              "ultimo_in_entrata_il",
              "ultimo_messaggio_anteprima",
              "ultimo_messaggio_direzione",
              "ultimo_messaggio_il",
              "unread_count",
            ],
            ["last_message_at", "unread_count"],
          ],
          "Chat eliminata",
        ],
        [tentativi, q.fraseUltima()],
      );
      fine(q);

      // L'azzeramento del contatto fallisce: un solo esito, quello d'errore.
      const f = await monta(base());
      f.api().apri(P1);
      await f.assesta();
      f.db.erroreUpdate = true;
      await f.api().elimina();
      await f.assesta();
      c(
        "azzeramento del contatto fallito: toast d'errore e NIENTE «Chat eliminata»",
        [["errore"], false],
        [
          f.T.toasts.map((t) => t.tipo).filter((t, i, tutti) => i > 0 || t),
          f.T.toasts.some((t) => t.m === "Chat eliminata"),
        ],
      );
      fine(f);

      // Conferma negata: niente.
      const r = await monta({ ...base(), confirm: false });
      r.api().apri(P1);
      await r.assesta();
      await r.api().elimina();
      c(
        "conferma negata: non si cancella niente e non si azzera il contatto",
        [0, 0],
        [
          r.scritture("whatsapp_messages").length,
          r.scritture("whatsapp_contacts").filter((x) => "last_message_at" in x.vals).length,
        ],
      );
      fine(r);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  8b · RICARICHE: niente spinner, niente elenco svuotato, niente bozza persa
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · RICARICHE E BOZZA");
    {
      const base = () => ({
        contatti: [contatto("c1", P1, { ultimo_in_entrata_il: iso(-3 * ORA_MS) })],
      });

      // Lo spinner c'è solo al primo caricamento.
      let apri;
      const p = await monta({ ...base(), gate: new Promise((r) => (apri = r)) });
      c("primo caricamento in corso: «caricamento» vero", [true], [p.api().caricamento]);
      p.db.gate = null;
      apri();
      await p.assesta();
      c("primo caricamento finito: falso", [false], [p.api().caricamento]);
      let apri2;
      p.db.gate = new Promise((r) => (apri2 = r));
      p.db.tabelle.whatsapp_contacts[0].unread_count = 2;
      p.db.emetti("whatsapp_contacts");
      await p.assesta();
      c(
        "una ricarica (realtime) in corso NON riaccende lo spinner e l'elenco resta",
        [false, [P1]],
        [p.api().caricamento, telefoni(p.api().daRispondere)],
      );
      p.db.gate = null;
      apri2();
      await p.assesta();
      c("e a ricarica finita i dati nuovi ci sono", [2], [p.api().chats[0].unread]);

      // Errore di lettura: si tengono i dati di prima.
      p.db.erroreLettura = true;
      p.db.emetti("whatsapp_contacts");
      await p.assesta();
      c(
        "ricarica con errore di lettura: l'elenco e «Da rispondere» NON si svuotano",
        [1, [P1]],
        [p.api().chats.length, telefoni(p.api().daRispondere)],
      );
      p.db.erroreLettura = false;
      p.db.tabelle.whatsapp_contacts.push(contatto("c2", P2));
      p.db.emetti("whatsapp_contacts");
      await p.assesta();
      c("passato l'errore la ricarica successiva aggiorna", [2], [p.api().chats.length]);
      fine(p);

      // La bozza scritta durante l'invio non si cancella.
      const q = await monta(base());
      q.api().apri(P1);
      await q.assesta();
      q.api().setBozza("primo");
      await q.assesta();
      q.T.invio = async () => {
        q.api().setBozza("secondo, scritto mentre partiva il primo");
        await q.assesta();
        return risposta(200, { ok: true });
      };
      await q.api().invia();
      await q.assesta();
      c(
        "bozza cambiata durante l'invio: la nuova resta",
        ["secondo, scritto mentre partiva il primo"],
        [q.api().bozza],
      );
      fine(q);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  8b · IL PONTE WHATSAPP (commessa 2026-10-29, T7): contatti a pagine,
     *       doppioni nascosti, storico che non riavvia la lettura
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · PONTE: CONTATTI A PAGINE");
    {
      const numero = (i) => `+39333${String(1000000 + i)}`;
      const tanti = (n) => Array.from({ length: n }, (_, i) => contatto(`c${String(i).padStart(5, "0")}`, numero(i)));
      const richiesteContatti = (p) => p.db.log.filter((q) => q.t === "whatsapp_contacts" && q.op === "select" && q.rng);

      const a = await monta({ contatti: tanti(2500), maxRighe: 1000 });
      c(
        "2500 contatti (il database ne dà 1000 a richiesta): li legge tutti, in 3 pagine",
        [2500, [[0, 999], [1000, 1999], [2000, 2999]], null],
        [a.api().chats.length, richiesteContatti(a).map((q) => q.rng), a.api().erroreLettura],
      );
      fine(a);

      const b = await monta({ contatti: tanti(5300), maxRighe: 1000 });
      c(
        "5300 contatti: si ferma a 5 pagine (5000 chat) e lo dice in pagina, non in silenzio",
        [5000, 5, true],
        [b.api().chats.length, richiesteContatti(b).length, /5000/.test(b.api().erroreLettura ?? "")],
      );
      fine(b);

      const d = await monta({ contatti: tanti(999), maxRighe: 1000 });
      c(
        "999 contatti: una pagina sola, nessun avviso",
        [1, null],
        [richiesteContatti(d).length, d.api().erroreLettura],
      );
      fine(d);

      const e = await monta({ contatti: tanti(1500), maxRighe: 1000 });
      e.db.falliscono = 0;
      c("1500 contatti: 2 pagine, tutti", [1500, 2], [e.api().chats.length, richiesteContatti(e).length]);
      fine(e);
    }

    gruppo("CHAT WHATSAPP · PAGINA · PONTE: I DOPPIONI NON ENTRANO NEI 2000");
    {
      const numeri = [P1, P2, P3, P4, "+393335550005"];
      //  1999 messaggi veri (uno al minuto) e, un secondo dopo ciascuno, il suo doppione del ponte; più uno vecchissimo: 3999 righe, 2000 vere.
      const righe = [];
      for (let i = 0; i < 1999; i++) {
        const n = numeri[i % 5];
        righe.push(msg(`v${String(i).padStart(4, "0")}`, "inbound", n, `testo ${i}`, -(2100 - i) * MIN));
        righe.push(
          msg(`d${String(i).padStart(4, "0")}`, "inbound", n, `testo ${i}`, -(2100 - i) * MIN + 1000, {
            canale: "baileys",
            duplicato_di: `v${String(i).padStart(4, "0")}`,
          }),
        );
      }
      // Un messaggio ManyChat di un'altra chat, più vecchio di tutti: senza il filtro i doppioni lo spingono fuori dai 2000.
      const OLD = "+393339990001";
      righe.push(msg("vecchio", "inbound", OLD, "ciao dal giro", -200 * GIORNO));
      const richiesteMsg = (p) => p.db.log.filter((q) => q.t === "whatsapp_messages" && q.op === "select" && q.lim === 2000);

      const p = await monta({ messaggi: righe, contatti: [] });
      const q = richiesteMsg(p)[0];
      c(
        "la lettura chiede `duplicato_di` vuoto e ottiene 2000 righe (tutte vere)",
        [[["duplicato_di", null]], 2000],
        [q.is, q.n],
      );
      const ultimi = p.api().chats.map((x) => x.lastMessage?.id ?? "");
      c(
        "nessuna anteprima è un doppione; il messaggio ManyChat più vecchio non si è perso",
        [true, true],
        [ultimi.every((x) => !x.startsWith("d")), ultimi.includes("vecchio") || p.api().chats.some((x) => x.phone === OLD)],
      );
      p.api().apri(P1);
      await p.assesta();
      const aperta = p.api().messaggi;
      c(
        "la conversazione non mostra doppioni, e le righe vere restano tutte (400 su 5 numeri)",
        [400, true, true],
        [aperta.length, aperta.every((x) => !x.duplicato_di), aperta.every((x) => x.canale !== "baileys")],
      );
      c(
        "anche la lettura della chat aperta e il controllo dei 15 s chiedono `duplicato_di` vuoto",
        [true, true],
        [
          p.db.log.filter((x) => x.t === "whatsapp_messages" && x.or).every((x) => x.is.length === 1),
          p.db.log.filter((x) => x.t === "whatsapp_messages" && x.lim === 1).every((x) => x.is.length === 1),
        ],
      );
      fine(p);

      //  Migrazione non ancora applicata: il filtro dà 42703, si rilegge senza filtro e si scarta in codice.
      const r = await monta({ messaggi: righe, contatti: [], senzaDuplicatoDi: true });
      const rm = r.db.log.filter((x) => x.t === "whatsapp_messages" && x.op === "select" && !x.or && x.lim !== 1);
      c(
        "errore 42703: rilegge senza filtro (stessa richiesta, niente `is`), nessun errore in pagina",
        [[1, 0], null],
        [rm.slice(0, 2).map((x) => x.is.length), r.api().erroreLettura],
      );
      c(
        "…e i doppioni si scartano in codice (nessuna anteprima è un doppione)",
        true,
        r.api().chats.every((x) => !(x.lastMessage?.id ?? "").startsWith("d")) && r.api().chats.length > 0,
      );
      r.api().apri(P1);
      await r.assesta();
      c("…né nella conversazione aperta", true, r.api().messaggi.length > 0 && r.api().messaggi.every((x) => !x.duplicato_di));
      fine(r);
    }

    gruppo("CHAT WHATSAPP · PAGINA · PONTE: LO STORICO NON RIAVVIA LA LETTURA");
    {
      //  p1-chat-veloce: una «lettura» è anche quella a pezzi (non più solo i 2000).
      const letture = (p) => p.db.log.filter((q) => q.t === "whatsapp_messages" && q.op === "select" && !q.or && q.lim !== 1).length;
      const mondo = () => ({
        messaggi: [msg("m1", "inbound", P1, "ciao", -5 * MIN, { canale: "manychat" })],
        contatti: [contatto("c1", P1, { last_message_at: iso(-5 * MIN), updated_at: iso(-5 * MIN), ultimo_in_entrata_il: iso(-5 * MIN) })],
      });
      const riga = (id, dopo, extra = {}) => msg(id, "inbound", P1, "storico", dopo, extra);
      const ins = (r) => ({ eventType: "INSERT", new: r, old: {} });
      const upd = (nuovo, vecchio) => ({ eventType: "UPDATE", new: nuovo, old: vecchio });

      const p = await monta(mondo());
      const prima = letture(p);
      //  500 eventi di storico in un secondo: messaggi del ponte vecchi e contatti che cambiano solo ora/nome.
      for (let i = 0; i < 250; i++) {
        p.db.emetti("whatsapp_messages", ins(riga(`s${i}`, -(3 + i) * ORA_MS, { canale: "baileys" })));
        const vecchio = p.db.tabelle.whatsapp_contacts[0];
        p.db.emetti(
          "whatsapp_contacts",
          upd({ ...vecchio, last_message_at: iso(-i), display_name: "Nome", updated_at: iso(-i) }, vecchio),
        );
      }
      await p.assesta();
      c("500 eventi di storico (250 messaggi + 250 contatti): nessuna lettura", prima, letture(p));

      const conta = async (nome, evento, tabella, attese) => {
        const n0 = letture(p);
        p.db.emetti(tabella, evento);
        await p.assesta();
        c(nome, attese, letture(p) - n0);
      };
      const cont = () => ({ ...p.db.tabelle.whatsapp_contacts[0] });
      await conta("un messaggio vivo del ponte (recente): una lettura", ins(riga("v1", -MIN, { canale: "baileys" })), "whatsapp_messages", 1);
      await conta("un messaggio di ManyChat, anche vecchio: una lettura", ins(riga("v2", -5 * ORA_MS, { canale: "manychat" })), "whatsapp_messages", 1);
      await conta("un messaggio senza canale (Cloud): una lettura", ins(riga("v3", -5 * ORA_MS)), "whatsapp_messages", 1);
      await conta("un messaggio del ponte che cambia (UPDATE): una lettura", upd(riga("v1", -5 * ORA_MS, { canale: "baileys" }), riga("v1", -5 * ORA_MS, { canale: "baileys" })), "whatsapp_messages", 1);
      await conta("un contatto con `unread_count` diverso: una lettura", upd({ ...cont(), unread_count: 3 }, cont()), "whatsapp_contacts", 1);
      await conta("un contatto con `risposto_il` diverso: una lettura", upd({ ...cont(), risposto_il: iso(0) }, cont()), "whatsapp_contacts", 1);
      await conta("un contatto con `ultimo_in_entrata_il` diverso: una lettura", upd({ ...cont(), ultimo_in_entrata_il: iso(-1) }, cont()), "whatsapp_contacts", 1);
      await conta("un contatto con `non_scrivere_dal` diverso: una lettura", upd({ ...cont(), non_scrivere_dal: iso(0) }, cont()), "whatsapp_contacts", 1);
      await conta("un contatto con `lead_id` diverso: una lettura", upd({ ...cont(), lead_id: "l1" }, cont()), "whatsapp_contacts", 1);
      await conta("un contatto cancellato: una lettura", { eventType: "DELETE", new: {}, old: cont() }, "whatsapp_contacts", 1);
      await conta("un evento senza dati (come i vecchi): una lettura", undefined, "whatsapp_contacts", 1);
      await conta("un UPDATE senza il vecchio valore (tabella senza REPLICA IDENTITY FULL): una lettura", upd({ ...cont(), updated_at: iso(-1) }, { id: "c1" }), "whatsapp_contacts", 1);
      fine(p);
    }

    gruppo("CHAT WHATSAPP · PAGINA · PONTE: UN MESSAGGIO VIVO ARRIVATO IN RITARDO NON SI PERDE");
    {
      //  Il Mac era spento: il messaggio è di 3 ore fa ma il ponte lo scrive adesso. Per il tempo reale è «storico»
      //  (non rilegge); lo prende il controllo dei 15 s, perché il contatto ha `updated_at` nuovo.
      const letture = (p) => p.db.log.filter((q) => q.t === "whatsapp_messages" && q.op === "select" && !q.or && q.lim !== 1).length;
      const p = await monta({
        messaggi: [msg("m1", "outbound", P1, "ciao", -6 * ORA_MS, { canale: "manychat" })],
        contatti: [contatto("c1", P1, { last_message_at: iso(-6 * ORA_MS), updated_at: iso(-6 * ORA_MS) })],
      });
      c("prima: la chat ha solo il suo messaggio", ["m1"], [p.api().chats[0].lastMessage.id]);
      const n0 = letture(p);
      const tardo = msg("tardo", "inbound", P1, "ho letto solo ora", -3 * ORA_MS, { canale: "baileys" });
      p.db.tabelle.whatsapp_messages.push(tardo);
      const vecchio = { ...p.db.tabelle.whatsapp_contacts[0] };
      Object.assign(p.db.tabelle.whatsapp_contacts[0], { last_message_at: iso(-3 * ORA_MS), updated_at: iso(0) });
      p.db.emetti("whatsapp_messages", { eventType: "INSERT", new: tardo, old: {} });
      p.db.emetti("whatsapp_contacts", { eventType: "UPDATE", new: { ...p.db.tabelle.whatsapp_contacts[0] }, old: vecchio });
      await p.assesta();
      c("il tempo reale lo tratta da storico: nessuna lettura", [n0, "m1"], [letture(p), p.api().chats[0].lastMessage.id]);

      p.T.ora += 15_000;
      await p.scatta(); // scatta il controllo dei 15 s
      await p.assesta();
      c("il controllo dei 15 s lo trova: una lettura in più e il messaggio c'è", [n0 + 1, "tardo"], [letture(p), p.api().chats[0].lastMessage.id]);
      c(
        "…ed è solo da vedere: la chat NON entra in «Da rispondere» (storia col ponte = niente attesa)",
        [false, false],
        [p.api().chats[0].daRispondere.attesa, p.api().daRispondere.length > 0],
      );
      fine(p);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  8c · p1-chat-veloce (30/10/2026): LE LETTURE A PEZZI E L'ANTEPRIMA
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · LETTURE A PEZZI (p1-chat-veloce)");
    {
      const selMsg = (p) => p.db.log.filter((q) => q.t === "whatsapp_messages" && q.op === "select" && !q.or && q.lim !== 1);
      const selCont = (p) => p.db.log.filter((q) => q.t === "whatsapp_contacts" && q.op === "select");
      const mondo = () => ({
        messaggi: [
          msg("m1", "inbound", P1, "ciao", -2 * ORA_MS),
          msg("m2", "outbound", P1, "buongiorno", -ORA_MS),
          msg("m3", "inbound", P2, "salve", -30 * MIN),
        ],
        contatti: [
          contatto("c1", P1, { updated_at: iso(-ORA_MS) }),
          contatto("c2", P2, { updated_at: iso(-30 * MIN) }),
        ],
      });

      const p = await monta(mondo());
      const m0 = selMsg(p).length;
      const c0 = selCont(p).length;
      p.T.ora += 5 * MIN;
      p.db.tabelle.whatsapp_messages.push(msg("m4", "inbound", P2, "ci sono", 0, { created_at: new Date(p.T.ora).toISOString() }));
      p.db.tabelle.whatsapp_contacts[1].unread_count = 1;
      p.db.emetti("whatsapp_messages", { eventType: "INSERT", new: { id: "m4" }, old: {} });
      await p.assesta();
      const qm = selMsg(p).slice(m0);
      const qc = selCont(p).slice(c0);
      c(
        "un evento: UNA lettura dei messaggi a pezzi (gte cambiato_il, al più 500) e UNA dei contatti (gte updated_at), niente 2000 né pagine",
        [1, "cambiato_il", 500, 1, "updated_at", null],
        [qm.length, qm[0]?.gte[0]?.[0], qm[0]?.lim, qc.length, qc[0]?.gte[0]?.[0], qc[0]?.rng],
      );
      c(
        "il cursore dei messaggi: il più recente già visto meno 2 minuti (righe vecchie: created_at)",
        new Date(T0 - 30 * MIN - 2 * MIN).toISOString(),
        qm[0]?.gte[0]?.[1],
      );
      c(
        "le righe lette a pezzi sono poche (solo il nuovo/cambiato)",
        [1, 1],
        [qm[0]?.n, qc[0]?.n],
      );
      c(
        "il messaggio nuovo e il non letto ci sono, la chat di prima è rimasta",
        ["m4", 1, "m2"],
        [
          p.api().chats.find((x) => x.phone === P2)?.lastMessage?.id,
          p.api().chats.find((x) => x.phone === P2)?.unread,
          p.api().chats.find((x) => x.phone === P1)?.lastMessage?.id,
        ],
      );
      p.api().apri(P1);
      await p.assesta();
      c("la chat aperta ha ancora tutti i suoi messaggi", ["m1", "m2"], p.api().messaggi.map((x) => x.id));
      const chatPrima = p.db.log.filter((q) => q.t === "whatsapp_messages" && q.or).length;

      // Un messaggio che CAMBIA (spunte): arriva con la lettura a pezzi.
      p.T.ora += MIN;
      p.db.tabelle.whatsapp_messages.find((x) => x.id === "m2").status = "read";
      p.db.emetti("whatsapp_messages", { eventType: "UPDATE", new: { id: "m2" }, old: { id: "m2" } });
      await p.assesta();
      c("un messaggio cambiato (letto): lo stato nuovo arriva", "read", p.api().messaggi.find((x) => x.id === "m2")?.status);
      c(
        "…e la chat aperta NON si rilegge intera a ogni evento",
        chatPrima,
        p.db.log.filter((q) => q.t === "whatsapp_messages" && q.or).length,
      );

      // Un doppione marcato dopo dal ponte: sparisce.
      p.T.ora += MIN;
      p.db.tabelle.whatsapp_messages.find((x) => x.id === "m1").duplicato_di = "m-crm";
      p.db.emetti("whatsapp_messages", { eventType: "UPDATE", new: { id: "m1" }, old: { id: "m1" } });
      await p.assesta();
      c("una riga marcata doppione dopo: esce dalla chat", ["m2"], p.api().messaggi.map((x) => x.id));

      // Una cancellazione (DELETE): la lettura a pezzi non la vede, la toglie l'evento.
      const via = p.db.tabelle.whatsapp_messages.find((x) => x.id === "m2");
      p.db.tabelle.whatsapp_messages = p.db.tabelle.whatsapp_messages.filter((x) => x.id !== "m2");
      p.db.emetti("whatsapp_messages", { eventType: "DELETE", new: {}, old: via });
      await p.assesta();
      c("messaggio cancellato altrove: sparisce subito", [], p.api().messaggi.map((x) => x.id));
      const cv = p.db.tabelle.whatsapp_contacts.find((x) => x.id === "c2");
      p.db.tabelle.whatsapp_contacts = p.db.tabelle.whatsapp_contacts.filter((x) => x.id !== "c2");
      p.db.emetti("whatsapp_contacts", { eventType: "DELETE", new: {}, old: cv });
      await p.assesta();
      c("contatto cancellato altrove: esce dai contatti", false, p.api().chats.some((x) => x.contact?.id === "c2"));

      // «Aggiorna»: tutto da capo (2000 messaggi, contatti a pagine).
      const m1 = selMsg(p).length;
      const c1 = selCont(p).length;
      await p.api().aggiorna();
      await p.assesta();
      c(
        "«Aggiorna»: lettura completa (2000 messaggi, contatti a pagine dal primo)",
        [2000, [0, 999]],
        [selMsg(p).slice(m1).find((q) => q.lim === 2000)?.lim, selCont(p).slice(c1).find((q) => q.rng)?.rng],
      );
      fine(p);

      // Tante righe cambiate insieme (storico importato): oltre 500 si rilegge tutto.
      const q = await monta(mondo());
      const qm0 = selMsg(q).length;
      q.T.ora += MIN;
      for (let i = 0; i < 520; i++)
        q.db.tabelle.whatsapp_messages.push(msg(`s${i}`, "inbound", P3, `storico ${i}`, -10 * GIORNO + i * MIN));
      q.db.emetti("whatsapp_messages", undefined);
      await q.assesta();
      c(
        "520 righe nuove insieme: la lettura a pezzi è piena, si rilegge tutto (2000)",
        [500, 2000],
        selMsg(q).slice(qm0).map((x) => x.lim),
      );
      c("…e lo storico c'è", true, q.api().chats.some((x) => x.phone === P3));
      fine(q);

      // Migrazione non applicata (`cambiato_il` manca): si legge come prima, senza errori.
      const r = await monta({ ...mondo(), senzaCambiatoIl: true });
      c("senza migrazione: la pagina si carica, nessun errore", [true, null], [r.api().chats.length === 2, r.api().erroreLettura]);
      const rm0 = selMsg(r).length;
      r.T.ora += MIN;
      r.db.tabelle.whatsapp_messages.push(msg("m9", "inbound", P1, "nuovo", 0, { created_at: new Date(r.T.ora).toISOString() }));
      r.db.emetti("whatsapp_messages", undefined);
      await r.assesta();
      const dopo = selMsg(r).slice(rm0);
      c(
        "…un evento: la lettura a pezzi dà 42703, si ripiega sui recenti con tutte le colonne (`*`)",
        [true, "*", "m9", null],
        [dopo.some((x) => x.gte.length), dopo.at(-1)?.cols, r.api().chats.find((x) => x.phone === P1)?.lastMessage?.id, r.api().erroreLettura],
      );
      fine(r);
    }

    gruppo("CHAT WHATSAPP · PAGINA · ANTEPRIMA DAL CONTATTO (p1-chat-veloce)");
    {
      const OLD = "+393339990001";
      const p = await monta({
        messaggi: [msg("m1", "inbound", P1, "recente", -ORA_MS)],
        contatti: [
          contatto("c1", P1),
          contatto("c-old", OLD, {
            last_message_at: iso(-300 * GIORNO),
            ultimo_messaggio_il: iso(-10 * MIN),
            ultimo_messaggio_anteprima: "[template:hgl_ritorno]",
            ultimo_messaggio_direzione: "outbound",
          }),
        ],
      });
      c(
        "una chat senza messaggi letti ma con l'ultimo salvato sul contatto sale in cima per quell'ora",
        [OLD, P1],
        telefoni(p.api().chats),
      );
      fine(p);
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  9 · IL SORGENTE: niente rete a caso, niente dati nei log
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · IL SORGENTE");
    {
      const { readFileSync } = await import("node:fs");
      const src = readFileSync(join(radice, "src/crm/chatwa/useChatWa.ts"), "utf8");
      const senza = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      c(
        "nessun console.* nell'hook (numeri e testi non vanno nei log)",
        [0],
        [(senza.match(/console\./g) ?? []).length],
      );
      c(
        "le funzioni di stato.ts non sono copiate: l'hook le importa",
        [true, true, true],
        [
          /from "\.\/stato"/.test(senza),
          /schedaUnica/.test(senza) && !/function schedaUnica/.test(senza),
          !/function phonesMatch/.test(senza),
        ],
      );
      const leggi = (f) =>
        readFileSync(join(radice, f), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
      const pagina = leggi("src/crm/chatwa/PaginaChat.tsx");
      c(
        "l'intestazione non guarda le chiavi Meta (hasConfig) ma lo stato della casella: niente falso allarme su ManyChat",
        [false, 2],
        [/hasConfig/.test(pagina), (pagina.match(/api\.stato === "configura"/g) ?? []).length],
      );
      //  Sul telefono il `title` non si vede: l'ora dell'ultima lettura sta scritta nel tasto.
      const tasto = pagina.slice(pagina.indexOf("<RefreshCw"));
      const corpoTasto = tasto.slice(0, tasto.indexOf("</Button>"));
      c(
        "il tasto «Aggiorna» porta scritto «Aggiornato hh:mm» (non solo nel title, che sul telefono non si vede)",
        [true, true],
        [
          /Aggiornato \$\{oraBreve\(api\.aggiornatoIl\)\}/.test(corpoTasto),
          /api\.aggiornatoIl/.test(corpoTasto),
        ],
      );
      const abbinaScheda = leggi("src/crm/chatwa/AbbinaScheda.tsx");
      const prima = abbinaScheda.slice(abbinaScheda.indexOf("const conferma"));
      const dopoCatch = prima.slice(prima.indexOf("catch"), prima.indexOf("};"));
      c(
        "AbbinaScheda: chiude solo dopo l'await riuscito e il catch non dà un secondo avviso",
        [true, false, false],
        [
          /await api\.abbina\([^)]*\);\s*onChiudi\(\)/.test(prima),
          /setErrore\(\s*"/.test(dopoCatch),
          /toast/.test(dopoCatch),
        ],
      );
      const riga = leggi("src/crm/chatwa/RigaChat.tsx");
      c(
        "p1-chat-veloce: l'anteprima della riga è il più recente fra il letto e quello salvato sul contatto",
        [true, false],
        [/const last = ultimoDellaChat\(c\.lastMessage, c\.contact\);/.test(riga), /const last = c\.lastMessage;/.test(riga)],
      );
      c(
        "«Fatto» passa dalla rpc, non da una scrittura di risposto_il",
        [true],
        [/chiamaFunzione\(\s*"whatsapp_segna_fatto"/.test(senza)],
      );
    }

    /* ── IL CANALE IN TEMPO REALE CADE: si riapre UNA volta, non in giro ─── */
    gruppo("CHAT WHATSAPP · PAGINA · CANALE CHE CADE");
    {
      const attese = [];
      const setTimeoutVero = globalThis.setTimeout;
      globalThis.setTimeout = (f, ms) => {
        if (ms === 5_000) {
          attese.push(f);
          return attese.length;
        }
        return setTimeoutVero(f, ms);
      };
      try {
        const p = await monta({ messaggi: [] });
        const primo = p.db.canali.at(-1);
        primo.stato("CHANNEL_ERROR");
        c("errore del canale → una riapertura in attesa", 1, attese.length);
        attese.shift()();
        await p.assesta();
        await p.assesta();
        c(
          "riaperto un canale nuovo; la chiusura del vecchio (CLOSED) NON programma un'altra riapertura",
          [true, 0],
          [p.db.canali.at(-1) !== primo, attese.length],
        );
        p.smonta();
        c("smontando, la chiusura del canale non riapre niente", 0, attese.length);
      } finally {
        globalThis.setTimeout = setTimeoutVero;
      }
    }

    /* ════════════════════════════════════════════════════════════════════════
     *  10 · IL TELEFONO CHE TORNA (29/10/2026): sessione scaduta, pausa lunga,
     *       richieste appese, «Aggiorna». Timer, pagina e finestra sono finti.
     * ════════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · PAGINA · TELEFONO IN SOTTOFONDO E «AGGIORNA»");
    {
      const veri = {
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
        document: Object.getOwnPropertyDescriptor(globalThis, "document"),
        window: Object.getOwnPropertyDescriptor(globalThis, "window"),
      };
      //  I timer a scadenza si scatenano a mano: `scadono(ms)` fa partire quelli di quella durata.
      const attese = new Map();
      let nAttesa = 0;
      globalThis.setTimeout = (f, ms) => {
        attese.set(++nAttesa, { f, ms });
        return nAttesa;
      };
      globalThis.clearTimeout = (id) => attese.delete(id);
      const scadono = (ms) => {
        for (const [id, t] of [...attese]) {
          if (t.ms !== ms) continue;
          attese.delete(id);
          t.f();
        }
      };
      //  Una pagina e una finestra finte, con il conto degli ascoltatori.
      const ascolta = () => {
        const l = new Map();
        return {
          l,
          addEventListener: (tipo, f) => l.set(tipo, [...(l.get(tipo) ?? []), f]),
          removeEventListener: (tipo, f) =>
            l.set(
              tipo,
              (l.get(tipo) ?? []).filter((g) => g !== f),
            ),
          lancia: (tipo) => (l.get(tipo) ?? []).forEach((f) => f()),
          quanti: () => [...l.values()].reduce((n, x) => n + x.length, 0),
        };
      };
      const doc = { visibilityState: "visible", ...ascolta() };
      const win = ascolta();
      Object.defineProperty(globalThis, "document", {
        value: doc,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "window", {
        value: win,
        configurable: true,
        writable: true,
      });
      const letture = (p) =>
        p.db.log.filter((q) => q.t === "whatsapp_messages" && q.op === "select" && q.lim === 2000)
          .length;
      const vivi = (p) => p.db.canali.filter((x) => !x.chiuso).length;
      const base = () => ({
        contatti: [contatto("c1", P1, { ultimo_in_entrata_il: iso(-3 * ORA_MS) })],
      });
      try {
        // ── Errore che PERSISTE: un solo rinnovo, due letture, errore in pagina.
        {
          const p = await monta(base());
          c(
            "pagina aperta: niente errore, ora dell'ultima lettura segnata",
            [null, T0],
            [p.api().erroreLettura, p.api().aggiornatoIl],
          );
          const prima = letture(p);
          p.db.erroreLettura = true;
          p.T.ora += 2 * MIN;
          p.db.emetti("whatsapp_contacts");
          await p.assesta();
          c(
            "lettura in errore: UN rinnovo della sessione, DUE letture, errore mostrato, dati di prima tenuti",
            [1, 2, true, 1, T0],
            [
              p.T.auth.rinnovi,
              letture(p) - prima,
              typeof p.api().erroreLettura === "string" && p.api().erroreLettura.length > 0,
              p.api().chats.length,
              p.api().aggiornatoIl,
            ],
          );
          // Passano 15 s: il controllo vede l'errore e fa UNA ricarica, senza un altro rinnovo.
          const dopo = letture(p);
          p.T.ora += 15_000;
          for (const t of [...p.T.timers.values()].filter((t) => t.ms === 15_000)) t.f();
          await p.assesta();
          await p.assesta();
          c(
            "15 s dopo, errore ancora lì: una sola lettura in più, nessun rinnovo nuovo (al massimo uno al minuto)",
            [1, 1],
            [letture(p) - dopo, p.T.auth.rinnovi],
          );
          fine(p);
        }

        // ── Errore che PASSA al secondo tentativo (sessione rinnovata): niente errore.
        {
          const p = await monta(base());
          p.T.ora += 2 * MIN;
          p.db.falliscono = 1;
          p.db.tabelle.whatsapp_contacts.push(contatto("c2", P2));
          p.db.emetti("whatsapp_contacts");
          await p.assesta();
          c(
            "prima lettura respinta (gettone scaduto), rinnovo, seconda buona: niente errore, ora aggiornata, dati nuovi",
            [1, null, T0 + 2 * MIN, 2],
            [p.T.auth.rinnovi, p.api().erroreLettura, p.api().aggiornatoIl, p.api().chats.length],
          );
          fine(p);
        }

        // ── Ritorno dopo una pausa lunga: canale riaperto da capo, UNO solo vivo.
        {
          const p = await monta(base());
          await p.assesta();
          const primo = p.db.canali.at(-1);
          // Un ritento dei 5 s era già in attesa quando il telefono è andato in tasca.
          primo.stato("CHANNEL_ERROR");
          c(
            "canale caduto: un ritento dei 5 s in attesa",
            1,
            [...attese.values()].filter((t) => t.ms === 5_000).length,
          );
          p.T.ora += 10 * MIN;
          doc.lancia("visibilitychange");
          await p.assesta();
          await p.assesta();
          c(
            "tornato dopo 10 min: vecchio canale chiuso, un canale vivo, ritento dei 5 s annullato, sessione rinnovata",
            [true, 1, 0, 1],
            [
              primo.chiuso === true,
              vivi(p),
              [...attese.values()].filter((t) => t.ms === 5_000).length,
              p.T.auth.rinnovi,
            ],
          );
          fine(p);
        }

        // ── `pageshow` e `focus` insieme (l'app riaperta li manda entrambi): UNA riapertura.
        {
          const p = await monta(base());
          await p.assesta();
          const canaliPrima = p.db.canali.length;
          p.T.ora += 5 * MIN;
          win.lancia("pageshow");
          win.lancia("focus");
          await p.assesta();
          await p.assesta();
          c(
            "pageshow + focus dopo 5 min: un solo canale nuovo, uno solo vivo, un solo rinnovo",
            [1, 1, 1],
            [p.db.canali.length - canaliPrima, vivi(p), p.T.auth.rinnovi],
          );
          fine(p);
        }

        // ── Due riaperture in volo insieme: quella superata non apre un secondo canale.
        {
          const p = await monta(base());
          await p.assesta();
          let sblocca;
          const ferma = new Promise((r) => (sblocca = r));
          const sessioneVera = p.T.auth.getSession;
          p.T.auth.getSession = async () => {
            await ferma;
            return sessioneVera();
          };
          p.db.canali.at(-1).stato("TIMED_OUT");
          scadono(5_000); // il ritento parte e resta ad aspettare la sessione
          const az = p.api().aggiorna(); // e intanto il titolare tocca «Aggiorna»
          await p.assesta();
          sblocca();
          await az;
          await p.assesta();
          await p.assesta();
          c("ritento dei 5 s e «Aggiorna» insieme: resta UN canale vivo", [1], [vivi(p)]);
          fine(p);
        }

        // ── Il tasto «Aggiorna».
        {
          const p = await monta(base());
          await p.assesta();
          const primo = p.db.canali.at(-1);
          const prima = letture(p);
          p.T.ora += 30_000;
          p.db.tabelle.whatsapp_contacts.push(contatto("c2", P2));
          await p.api().aggiorna();
          await p.assesta();
          c(
            "«Aggiorna»: sessione rinnovata, canale riaperto (uno vivo), tutto riletto, ora nuova, tasto libero",
            [1, true, 1, 1, 2, T0 + 30_000, false],
            [
              p.T.auth.rinnovi,
              primo.chiuso === true,
              vivi(p),
              letture(p) - prima,
              p.api().chats.length,
              p.api().aggiornatoIl,
              p.api().aggiornando,
            ],
          );
          fine(p);
        }

        // ── Rinnovo della sessione APPESO: dopo 10 s si va avanti, il tasto si libera.
        {
          const p = await monta(base());
          await p.assesta();
          p.T.auth.refreshSession = () => new Promise(() => {});
          const az = p.api().aggiorna();
          await p.assesta();
          c("rinnovo appeso: il tasto aspetta", [true], [p.api().aggiornando]);
          scadono(10_000);
          //  Senza tetto `az` non finirebbe mai: si guarda se è finita, non la si aspetta.
          const finita = await Promise.race([
            az.then(() => "finita"),
            p.assesta().then(() => "appesa"),
          ]);
          await p.assesta();
          c(
            "dopo 10 s il rinnovo si abbandona: «Aggiorna» finisce, tasto di nuovo libero, niente errore",
            ["finita", false, null],
            [finita, p.api().aggiornando, p.api().erroreLettura],
          );
          fine(p);
        }

        // ── Lettura APPESA: dopo 10 s errore in pagina; dopo 30 s non blocca più le ricariche.
        {
          const p = await monta(base());
          await p.assesta();
          p.T.ora += 2 * MIN;
          p.db.gate = new Promise(() => {}); // i contatti non rispondono più
          p.db.emetti("whatsapp_contacts");
          await p.assesta();
          const appese = letture(p);
          p.db.emetti("whatsapp_contacts"); // un altro messaggio mentre la prima è appesa
          await p.assesta();
          c("con una ricarica appesa la successiva aspetta in fila", [appese], [letture(p)]);
          scadono(10_000); // la prima lettura scade → rinnovo → seconda lettura (appesa anche lei)
          await p.assesta();
          scadono(10_000);
          await p.assesta();
          c(
            "dopo i due tetti da 10 s: errore mostrato in pagina",
            [true],
            [typeof p.api().erroreLettura === "string"],
          );
          // La fila riparte: e se anche questa resta appesa, dopo 30 s non tiene ferme le altre.
          const ora = letture(p);
          p.T.ora += 31_000;
          p.db.emetti("whatsapp_contacts");
          await p.assesta();
          c(
            "ricarica rimasta appesa da più di 30 s: la nuova parte lo stesso",
            [true],
            [letture(p) > ora],
          );
          p.db.gate = null;
          for (let i = 0; i < 4; i++) {
            scadono(10_000);
            await p.assesta();
          }
          fine(p);
        }

        // ── Pulizia: niente timer, niente canali, niente ascoltatori.
        {
          const p = await monta(base());
          await p.assesta();
          p.db.canali.at(-1).stato("CLOSED"); // un ritento in attesa al momento dello smontaggio
          c(
            "prima di smontare: ascoltatori su pagina e finestra",
            [true],
            [doc.quanti() + win.quanti() > 0],
          );
          p.smonta();
          await p.assesta().catch(() => {});
          c(
            "smontata: zero timer (intervalli e attese), zero canali vivi, zero ascoltatori",
            [0, 0, 0, 0],
            [p.T.timers.size, attese.size, vivi(p), doc.quanti() + win.quanti()],
          );
        }
      } finally {
        globalThis.setTimeout = veri.setTimeout;
        globalThis.clearTimeout = veri.clearTimeout;
        if (veri.document) Object.defineProperty(globalThis, "document", veri.document);
        else delete globalThis.document;
        if (veri.window) Object.defineProperty(globalThis, "window", veri.window);
        else delete globalThis.window;
      }
    }
  } finally {
    globalThis.fetch = originali.fetch;
    Date.now = originali.now;
    globalThis.setInterval = originali.setInterval;
    globalThis.clearInterval = originali.clearInterval;
    globalThis.confirm = originali.confirm;
    console.warn = originali.warn;
    delete globalThis.__T;
    rmSync(dir, { recursive: true, force: true });
  }
}
