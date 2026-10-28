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
  auth: { getSession: async () => ({ data: { session: { access_token: "gettone-finto" } } }) },
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
function creaDb(tabelle) {
  const db = {
    tabelle,
    log: [],
    rpcLog: [],
    gate: null, // promessa da aspettare prima di leggere i contatti
    rifiutaColonne: false, // un update con le colonne nuove dà 42703
    erroreLettura: false, // le letture di messaggi e contatti danno un errore (rete, RLS)
    erroreUpdate: false, // ogni update dà un errore che non è «colonna mancante»
    congelaUpdate: false, // gli update vengono registrati ma non toccano le righe (come una RLS che non lascia passare)
    rpcRisposta: null, // (fn, args) => {data, error}
    cb: [], // realtime: { tabella, f }
    emetti(t) {
      for (const x of db.cb) if (x.tabella === t) queueMicrotask(x.f);
    },
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
        chiudi: () => ch.stato?.("CLOSED"),
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
        or: null,
        ord: null,
        lim: null,
        vals: null,
        sel: false,
        single: false,
      };
      const b = {
        select: () => {
          if (q.op === "select") q.op = "select";
          else q.sel = true;
          return b;
        },
        eq: (k, v) => (q.eq.push([k, v]), b),
        or: (s) => ((q.or = s), b),
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
      db.log.push(JSON.parse(JSON.stringify(q)));
      if (q.t === "whatsapp_contacts" && q.op === "select" && db.gate) await db.gate;
      const righe = db.tabelle[q.t] ?? [];
      const orFiltri = q.or ? q.or.split(",").map((p) => p.split(".eq.")) : null;
      const dentro = (r) =>
        q.eq.every(([k, v]) => String(r[k]) === v) &&
        (!orFiltri || orFiltri.some(([k, v]) => String(r[k]) === v));
      if (q.op === "select" && db.erroreLettura && q.t !== "whatsapp_settings")
        return { data: null, error: { code: "XX000", message: "rete giù" } };
      if (q.op === "update" && db.erroreUpdate)
        return { data: null, error: { code: "XX000", message: "update rifiutato" } };
      if (q.op === "select") {
        let out = righe.filter(dentro);
        if (q.ord) {
          const { col, asc } = q.ord;
          out = [...out].sort(
            (a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1),
          );
        }
        if (q.lim !== null) out = out.slice(0, q.lim);
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
      const T = {
        user: { id: U },
        crm: { leads: mondo.leads ?? [], consultants: [], updateLead: async () => {} },
        db,
        toasts: [],
        ora: T0,
        chiamate: [],
        timers: new Map(),
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
      const qMsg = p.db.log.find((q) => q.t === "whatsapp_messages" && q.op === "select");
      c(
        "i messaggi si leggono dal PIÙ NUOVO (order created_at DESC), limite 2000, filtrati per utente",
        [{ col: "created_at", asc: false }, 2000, [["user_id", U]]],
        [qMsg.ord, qMsg.lim, qMsg.eq],
      );
      const qCont = p.db.log.find((q) => q.t === "whatsapp_contacts" && q.op === "select");
      c(
        "i contatti si leggono tutti (nessun limite)",
        [null, [["user_id", U]]],
        [qCont.lim, qCont.eq],
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
        "in «Da rispondere» chi aspetta da più tempo sta sopra; chi ha avuto risposta no; lo STOP sì",
        [[P2, P1, P4]],
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
        "due timer: l'orologio (30 s) e il controllo dei messaggi nuovi (15 s)",
        [[15_000, 30_000]],
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
        "azzera anche ultimo_in_entrata_il e risposto_il, oltre a non letti e ultimo messaggio",
        [
          1,
          { unread_count: 0, last_message_at: null, ultimo_in_entrata_il: null, risposto_il: null },
        ],
        [azzera.length, azzera[0]?.vals],
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
            ["last_message_at", "risposto_il", "ultimo_in_entrata_il", "unread_count"],
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
