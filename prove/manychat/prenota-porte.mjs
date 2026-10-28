/** ── PROVE: LE PORTE VERE E LO SCRIPT DEL TITOLARE (T6) ─────────────────────
 *
 *  Commessa 2026-10-27 (prenota in chat), compito T6.
 *   · `leggiPaginato` (`prenota-lettura.ts`, puro): pagine da 1000, tetto, mai
 *     un risultato parziale.
 *   · `portePrenota()` (`prenota.server.ts`): si impacchetta il file VERO con un
 *     Supabase finto che si comporta come PostgREST (filtri sui percorsi json,
 *     contenimento JSONB, `.range()`, al massimo 1000 righe per richiesta,
 *     chiave primaria su `app_config`, 23505) e che tiene il registro di ogni
 *     richiesta. NESSUNA chiamata al database vero, nessun `fetch`.
 *   · le regole del sorgente (sempre `user_id`, niente `select("*")`, niente
 *     `like`, niente `console.log`…) e `supabase/PRENOTA-CHAT.sql`.
 *
 *  Dati inventati: nessun nome né numero vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSync } from "esbuild";

const U = "00000000-0000-4000-8000-000000000001"; // l'installazione
const ALTRO = "00000000-0000-4000-8000-0000000000ff"; // un'altra installazione
const TEL = "393200000001";
const idLead = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// ═══════════════════════════════════════════════════════════════════════════
//  IL SUPABASE FINTO
// ═══════════════════════════════════════════════════════════════════════════

/** Il valore di una colonna o di un percorso json: `data->>x`, `data->a->>b`. */
const valore = (riga, colonna) => {
  const [testa, ...resto] = colonna.split("->");
  let v = riga[testa];
  for (const pezzo of resto) v = v == null ? undefined : v[pezzo.replace(/^>/, "")];
  return v === undefined ? null : v;
};

/** `@>` di JSONB: gli oggetti per chiave, gli array «ogni elemento cercato è
 *  contenuto in qualche elemento». */
const contiene = (h, n) => {
  if (Array.isArray(n)) return Array.isArray(h) && n.every((x) => h.some((y) => contiene(y, x)));
  if (n && typeof n === "object")
    return (
      !!h &&
      typeof h === "object" &&
      !Array.isArray(h) &&
      Object.entries(n).every(([k, v]) => k in h && contiene(h[k], v))
    );
  return h === n;
};

const copia = (x) => JSON.parse(JSON.stringify(x));

function creaDbFinto() {
  const tabelle = {
    app_config: [],
    crm_leads: [],
    crm_consultants: [],
    whatsapp_contacts: [],
    manychat_invii: [],
    manychat_config: [],
  };
  const registro = []; // ogni richiesta eseguita: { tabella, op, catena }
  const stato = {
    guasto: null, // (tabella, op, catena) => vero: la richiesta risponde con un errore
    prima: null, // (tabella, op, catena) => void: gira PRIMA di una scrittura
    persaDopo: null, // (tabella, op, catena) => vero: l'INSERT riesce, ma la risposta è un errore
    rpc: {}, // nome → risposta
    mescola: false,
    tick: 0,
  };
  const errore = (code) => ({
    data: null,
    error: { code, message: `dettaglio riservato ${TEL} Anna Rossi` },
  });

  const nuovo = (tabella, op, carico) => {
    const filtri = [];
    const catena = [];
    let ordine = null;
    let intervallo = null;
    let tetto = null;
    let restituisce = false;
    let singola = false;
    const reg = (nome, ...args) => catena.push([nome, ...args]);
    const q = {
      select(colonne) {
        reg("select", colonne);
        restituisce = true;
        return q;
      },
      eq(c, v) {
        reg("eq", c, v);
        filtri.push((r) => String(valore(r, c)) === String(v));
        return q;
      },
      in(c, v) {
        reg("in", c, v);
        filtri.push((r) => v.includes(valore(r, c)));
        return q;
      },
      gte(c, v) {
        reg("gte", c, v);
        filtri.push((r) => valore(r, c) !== null && String(valore(r, c)) >= v);
        return q;
      },
      lte(c, v) {
        reg("lte", c, v);
        filtri.push((r) => valore(r, c) !== null && String(valore(r, c)) <= v);
        return q;
      },
      is(c, v) {
        reg("is", c, v);
        filtri.push((r) => valore(r, c) === v);
        return q;
      },
      not(c, o, v) {
        reg("not", c, o, v);
        filtri.push((r) => valore(r, c) !== v);
        return q;
      },
      contains(c, v) {
        reg("contains", c, v);
        filtri.push((r) => contiene(valore(r, c), v));
        return q;
      },
      order(c, o) {
        reg("order", c, o);
        ordine = { c, su: !(o && o.ascending === false) };
        return q;
      },
      range(a, b) {
        reg("range", a, b);
        intervallo = [a, b];
        return q;
      },
      limit(n) {
        reg("limit", n);
        tetto = n;
        return q;
      },
      maybeSingle() {
        singola = true;
        return q;
      },
      then(ok, no) {
        return Promise.resolve(esegui()).then(ok, no);
      },
    };
    const esegui = () => {
      const righe = tabelle[tabella];
      const corrisponde = (r) => filtri.every((f) => f(r));
      registro.push({
        tabella,
        op,
        catena: catena.map((x) => [...x]),
        carico: copia(carico ?? null),
      });
      if (stato.guasto && stato.guasto(tabella, op, catena)) return errore("57014");
      if (op !== "select" && stato.prima) stato.prima(tabella, op, catena);
      if (op === "select") {
        let trovate = righe.filter(corrisponde);
        //  Senza un `.order()` fisso PostgREST non promette l'ordine: qui, a richiesta,
        //  cambia a ogni richiesta, così una lettura a pagine senza ordine perde righe.
        if (!ordine && stato.mescola) trovate = [...trovate].sort(() => Math.random() - 0.5);
        if (ordine)
          trovate = [...trovate].sort((a, b) => {
            const x = String(valore(a, ordine.c));
            const y = String(valore(b, ordine.c));
            return (x < y ? -1 : x > y ? 1 : 0) * (ordine.su ? 1 : -1);
          });
        //  PostgREST: mai più di 1000 righe per richiesta, anche con un range più largo.
        const da = intervallo ? intervallo[0] : 0;
        const quante = Math.min(
          1000,
          intervallo ? intervallo[1] - intervallo[0] + 1 : 1000,
          tetto ?? 1000,
        );
        trovate = trovate.slice(da, da + quante);
        if (singola) {
          if (trovate.length > 1) return errore("PGRST116");
          return { data: trovate[0] ? copia(trovate[0]) : null, error: null };
        }
        return { data: copia(trovate), error: null };
      }
      if (op === "insert") {
        if (tabella === "app_config" && righe.some((r) => r.key === carico.key))
          return { data: null, error: { code: "23505", message: "duplicato" } };
        righe.push(copia(carico));
        //  La richiesta riesce ma la risposta si perde (timeout dopo l'INSERT).
        if (stato.persaDopo && stato.persaDopo(tabella, op, catena)) return errore("57014");
        return { data: null, error: null };
      }
      if (op === "upsert") {
        const i = righe.findIndex((r) => r.key === carico.key);
        if (i >= 0) righe[i] = copia(carico);
        else righe.push(copia(carico));
        return { data: null, error: null };
      }
      if (op === "update") {
        const toccate = righe.filter(corrisponde);
        for (const r of toccate) {
          Object.assign(r, copia(carico));
          if (tabella === "crm_leads")
            r.updated_at = `2026-10-27T12:00:00.${String(++stato.tick).padStart(6, "0")}+00:00`;
        }
        return { data: restituisce ? copia(toccate) : null, error: null };
      }
      if (op === "delete") {
        const via = righe.filter(corrisponde);
        tabelle[tabella] = righe.filter((r) => !via.includes(r));
        return { data: restituisce ? copia(via) : null, error: null };
      }
      throw new Error(`op finta sconosciuta: ${op}`);
    };
    return q;
  };

  const client = {
    from: (tabella) => {
      if (!(tabella in tabelle)) throw new Error(`tabella finta sconosciuta: ${tabella}`);
      return {
        select: (colonne) => nuovo(tabella, "select").select(colonne),
        insert: (v) => nuovo(tabella, "insert", v),
        upsert: (v) => nuovo(tabella, "upsert", v),
        update: (v) => nuovo(tabella, "update", v),
        delete: () => nuovo(tabella, "delete"),
      };
    },
    rpc: (fn, args) => {
      registro.push({ tabella: null, op: "rpc", fn, args: copia(args) });
      return Promise.resolve(stato.rpc[fn] ?? { data: null, error: null });
    },
  };
  return { client, tabelle, registro, stato };
}

// ═══════════════════════════════════════════════════════════════════════════
//  IL FILE VERO, IMPACCHETTATO CON IL SUPABASE FINTO
// ═══════════════════════════════════════════════════════════════════════════

function impacchetta(radice) {
  const dir = mkdtempSync(join(tmpdir(), "prenota-porte-"));
  const adminFinto = join(dir, "admin-finto.js");
  const clientFinto = join(dir, "client-finto.js");
  //  Il client di servizio rimanda al finto del momento; quello del browser NON
  //  deve servire (se qualcuno lo usasse, qui lancia).
  writeFileSync(
    adminFinto,
    `export const supabaseAdmin = {
  from: (...a) => globalThis.__supabaseFinto.from(...a),
  rpc: (...a) => globalThis.__supabaseFinto.rpc(...a),
};
export const supabaseAdminDefault = supabaseAdmin;`,
  );
  writeFileSync(
    clientFinto,
    `export const supabase = new Proxy({}, { get() { throw new Error("client del browser usato dal server"); } });`,
  );
  const fuori = join(dir, "porte.cjs");
  buildSync({
    entryPoints: [join(radice, "src/crm/manychat/prenota.server.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: fuori,
    logLevel: "error",
    loader: { ".tsx": "tsx" },
    alias: {
      "@/integrations/supabase/client.server": adminFinto,
      "@/integrations/supabase/client": clientFinto,
      "@": join(radice, "src"),
    },
  });
  const modulo = createRequire(import.meta.url)(fuori);
  return { modulo, pulisci: () => rmSync(dir, { recursive: true, force: true }) };
}

const lead = (id, utente, data, updated = "2026-10-27T10:00:00.000000+00:00") => ({
  id,
  user_id: utente,
  data,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: updated,
});
const config = (key, value) => ({ key, value, updated_at: "2026-10-27T10:00:00+00:00" });
const aspetta = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Cattura ciò che una promessa lancia (o `undefined` se riesce). */
const lanciato = async (f) => {
  try {
    await f();
    return undefined;
  } catch (e) {
    return e;
  }
};

export async function proveDellePortePrenota(mod, aiuti) {
  const { c, gruppo, radice } = aiuti;
  const { leggiPaginato } = mod["manychat/prenota-lettura"];
  const { leggiConfigPrenota } = mod["manychat/prenota-tipi"];

  // ═════════════════════════════════════════════════════════════════════════
  gruppo("PRENOTA · LA LETTURA A PAGINE (compito 6)");
  {
    //  Un archivio finto di N righe: `leggiPagina(da, a)` come `.range()`.
    const archivio = (n, { guastaPagina = -1 } = {}) => {
      const chiamate = [];
      const leggi = async (da, a) => {
        chiamate.push([da, a]);
        if (chiamate.length - 1 === guastaPagina) throw { code: "57014" };
        const righe = [];
        for (let i = da; i <= Math.min(a, n - 1); i++) righe.push(i);
        return righe;
      };
      return { leggi, chiamate };
    };

    let a = archivio(2300);
    let letto = await leggiPaginato(a.leggi, 5);
    c(
      "2.300 righe: tre pagine",
      [
        [0, 999],
        [1000, 1999],
        [2000, 2999],
      ],
      a.chiamate,
    );
    c("e tutte, nell'ordine", 2300, letto.length);
    c(
      "senza ripetizioni né buchi",
      true,
      letto.every((v, i) => v === i),
    );

    a = archivio(0);
    c("nessuna riga: lista vuota", [], await leggiPaginato(a.leggi, 5));
    c("e una sola richiesta", 1, a.chiamate.length);

    a = archivio(999);
    letto = await leggiPaginato(a.leggi, 5);
    c("999 righe: una pagina sola", [1, 999], [a.chiamate.length, letto.length]);

    a = archivio(1000);
    letto = await leggiPaginato(a.leggi, 5);
    c(
      "1.000 righe: una pagina piena NON è un errore, si legge la successiva",
      [2, 1000],
      [a.chiamate.length, letto.length],
    );

    a = archivio(4999);
    letto = await leggiPaginato(a.leggi, 5);
    c("4.999 righe: cinque pagine, tutte", [5, 4999], [a.chiamate.length, letto.length]);

    a = archivio(6200);
    let e = await lanciato(() => leggiPaginato(a.leggi, 5));
    c("oltre le 5.000 righe: lancia", { code: "oltre_il_tetto" }, e);
    c("senza leggere la sesta pagina", 5, a.chiamate.length);

    a = archivio(5000);
    e = await lanciato(() => leggiPaginato(a.leggi, 5));
    c("esattamente 5.000: lancia (shortcut dichiarato, mai un'agenda monca)", true, !!e);

    a = archivio(3000, { guastaPagina: 1 });
    e = await lanciato(() => leggiPaginato(a.leggi, 5));
    c("una pagina che fallisce: lancia il suo errore", { code: "57014" }, e);
    c("e non legge oltre", 2, a.chiamate.length);

    a = archivio(1500);
    c(
      "con tetto 1: 1.500 righe lanciano",
      true,
      !!(await lanciato(() => leggiPaginato(a.leggi, 1))),
    );
    a = archivio(700);
    c("con tetto 1: 700 righe si leggono", 700, (await leggiPaginato(a.leggi, 1)).length);
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppo("PRENOTA · LE PORTE: IL SORGENTE (compito 6)");
  const sorgente = readFileSync(join(radice, "src/crm/manychat/prenota.server.ts"), "utf8");
  {
    //  ogni lettura delle tabelle dell'installazione porta `user_id` nella stessa catena
    for (const t of ["crm_leads", "crm_consultants", "whatsapp_contacts", "manychat_invii"]) {
      const re = new RegExp(`\\.from\\("${t}"\\)`, "g");
      const senza = [];
      let quante = 0;
      for (let m; (m = re.exec(sorgente)); ) {
        quante++;
        const finePunto = sorgente.indexOf(";", m.index);
        const prossimo = sorgente.indexOf(".from(", m.index + 1);
        const fine = Math.min(...[finePunto, prossimo].filter((x) => x > 0));
        if (!/\.eq\("user_id"/.test(sorgente.slice(m.index, fine))) senza.push(m.index);
      }
      c(`${t}: c'è almeno una lettura`, true, quante > 0);
      c(`${t}: ogni catena ha .eq("user_id"`, [], senza);
    }
    c("niente fetch(", false, /\bfetch\(/.test(sorgente));
    c("niente console.log / console.info", false, /console\.(log|info|debug)\(/.test(sorgente));
    c(
      "l'unico log è un avviso con il solo codice",
      ['console.warn("[manychat-prenota]", codice)'],
      sorgente.match(/console\.warn\([^)]*\)/g),
    );
    c('niente select("*")', false, /select(<[^>]*>)?\(\s*["'`]\*["'`]/.test(sorgente));
    c(
      "le colonne della scheda sono scritte",
      true,
      /COLONNE_LEAD = "id, user_id, data, created_at, updated_at"/.test(sorgente),
    );
    c(
      "importa il client di servizio",
      true,
      /from "@\/integrations\/supabase\/client\.server"/.test(sorgente),
    );
    c(
      "e non il client del browser",
      false,
      /from "@\/integrations\/supabase\/client"/.test(sorgente),
    );
    c("niente modiFascia", false, /modiFascia/.test(sorgente));
    c("niente like(, né ilike(", false, /\bi?like\(/i.test(sorgente));
    c(
      "la fascia si controlla con Object.hasOwn, non con `in`",
      [true, false],
      [/Object\.hasOwn\(FASCE, r\.fascia\)/.test(sorgente), /\bin FASCE\b/.test(sorgente)],
    );
    c("niente .or( con testo libero", false, /\.or\(/.test(sorgente));
    c(
      "il commento dice che app_config non ha user_id",
      true,
      /`app_config` NON ha `user_id`/.test(sorgente) &&
        /RLS è «authenticated vede tutto»/.test(sorgente),
    );
    c("l'agenda ha il tetto di 5 pagine", true, /PAGINE_MAX = 5/.test(sorgente));
    c(
      "le letture a pagine hanno ordine fisso per id e range",
      true,
      /\.order\("id"\)\s*\.range\(da, a\)/.test(sorgente),
    );
    c(
      "il filtro delle manutenzioni è sulle sole fissate",
      true,
      /contains\("data", \{ manutenzione: \{ appuntamenti: \[\{ stato: "fissata" \}\] \} \}\)/.test(
        sorgente,
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppo("PRENOTA · LO SCRIPT DEL TITOLARE (compito 6)");
  {
    const sql = readFileSync(join(radice, "supabase/PRENOTA-CHAT.sql"), "utf8");
    const righe = sql.split("\n");
    const attive = righe.filter((l) => !l.trim().startsWith("--"));
    c("nello script niente LIKE (starts_with)", false, /\bLIKE\b/i.test(sql));
    c("niente DROP, DELETE, TRUNCATE, ALTER", false, /\b(DROP|DELETE|TRUNCATE|ALTER)\b/i.test(sql));
    c(
      "nessun comando che scrive è attivo (se lo lanci tutto, cambia niente)",
      false,
      attive.some((l) => /\b(INSERT|UPDATE|CREATE|GRANT|UPSERT)\b/i.test(l)),
    );
    c('c\'è la riga spenta ("acceso":false)', true, /"acceso":false/.test(sql));
    c("dice che NON è una migrazione", true, /NON è una migrazione/.test(sql));
    //  I due JSON, come li legge la rotta
    const json = [...sql.matchAll(/'(\{"v":1,[^']*\})'/g)].map((m) => m[1]);
    c("due JSON: accendi e spegni", 2, json.length);
    c(
      "il JSON di accensione si legge e dà acceso, con i valori predefiniti",
      { acceso: true, consulenteId: "", preavvisoOre: 3, giorniAvanti: 14, durataMin: 60 },
      leggiConfigPrenota(json.find((j) => j.includes('"acceso":true'))),
    );
    c(
      "il JSON di spegnimento dà spenta",
      null,
      leggiConfigPrenota(json.find((j) => j.includes('"acceso":false'))),
    );
    c(
      "la chiave è prenota_chat, in tutte e due le righe",
      2,
      (sql.match(/'prenota_chat',/g) ?? []).length,
    );
    //  la query dell'elenco: per il marcatore, non per fissatoDa
    const q5 = sql.slice(sql.indexOf("-- 5 ·"), sql.indexOf("-- 6 ·"));
    c(
      "l'elenco cerca prenotatoChat",
      true,
      /prenotatoChat/.test(q5) && /FROM public\.crm_leads/.test(q5),
    );
    c("e non per fissatoDa", false, /WHERE[^;]*fissatoDa/.test(q5));
    c(
      "c'è il controllo (select della riga)",
      true,
      /SELECT key, value, updated_at FROM public\.app_config WHERE key = 'prenota_chat'/.test(sql),
    );
    c("c'è la ricerca dell'id di Filippo", true, /FROM public\.crm_consultants/.test(sql));
    //  nessuna migrazione, nessuno schema toccato
    const migrazioni = readdirSync(join(radice, "supabase/migrations"));
    c(
      "nessun file di migrazione con «prenota» nel nome",
      [],
      migrazioni.filter((n) => /prenota/i.test(n)),
    );
    c(
      "nessuna migrazione scrive la chiave prenota_chat",
      [],
      migrazioni.filter((n) =>
        /prenota_chat/.test(readFileSync(join(radice, "supabase/migrations", n), "utf8")),
      ),
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Da qui in poi: il file vero, con il Supabase finto.
  // ═════════════════════════════════════════════════════════════════════════
  const { modulo, pulisci } = impacchetta(radice);
  const originaleFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("fetch: le porte non escono dal database");
  };
  try {
    /** Un database nuovo e le porte che ci parlano. */
    const mondo = () => {
      const db = creaDbFinto();
      globalThis.__supabaseFinto = db.client;
      return { db, porte: modulo.portePrenota() };
    };
    const selezioniLeads = (db) =>
      db.registro.filter((r) => r.tabella === "crm_leads" && r.op === "select");
    const filtroDi = (richiesta, nome, colonna) =>
      richiesta.catena.filter((x) => x[0] === nome && (colonna === undefined || x[1] === colonna));

    // ───────────────────────────────────────────────────────────────────────
    gruppo("PRENOTA · LE PORTE: L'AGENDA (compito 6)");
    {
      const { db, porte } = mondo();
      const L = db.tabelle.crm_leads;
      const meeting = (giorno) => ({
        stato: "appuntamento_fissato",
        dataMeeting: giorno,
        oraMeeting: "17:00",
      });
      //  2.300 consulenze nella finestra (tre pagine) + 1.500 fuori
      for (let i = 1; i <= 2300; i++) L.push(lead(idLead(i), U, meeting("2026-10-28")));
      for (let i = 1; i <= 1500; i++) L.push(lead(idLead(100000 + i), U, meeting("2026-09-01")));
      //  1.200 con una manutenzione fissata (due pagine) + 2.500 solo storiche o da fissare
      const manut = (stati) => ({
        manutenzione: {
          appuntamenti: stati.map((stato, k) => ({ id: `m${k}`, stato, data: "2026-10-30" })),
        },
      });
      for (let i = 1; i <= 1200; i++)
        L.push(lead(idLead(200000 + i), U, manut(["fatta", "fissata"])));
      for (let i = 1; i <= 2500; i++)
        L.push(lead(idLead(300000 + i), U, manut(i % 2 ? ["fatta"] : ["da_fissare", "saltata"])));
      L.push(lead(idLead(900001), U, { stato: "viene_in_sede", dataVieneInSede: "2026-10-29" }));
      L.push(lead(idLead(900002), U, { installazione: { dataInstallazione: "2026-10-31" } }));
      //  una scheda che compare in due letture (consulenza + manutenzione): una volta sola
      L.push(lead(idLead(900003), U, { ...meeting("2026-10-27"), ...manut(["fissata"]) }));
      //  un'altra installazione, con un impegno nella finestra
      L.push(lead(idLead(900004), ALTRO, meeting("2026-10-28")));
      L.push(lead(idLead(900005), ALTRO, manut(["fissata"])));
      //  ai bordi della finestra
      L.push(lead(idLead(900006), U, meeting("2026-10-26")));
      L.push(lead(idLead(900007), U, meeting("2026-11-11")));
      L.push(lead(idLead(900008), U, meeting("2026-10-25")));
      L.push(lead(idLead(900009), U, meeting("2026-11-12")));
      db.stato.mescola = true;

      const agenda = await porte.schedeAgenda(U, "2026-10-26", "2026-11-11");
      const ids = agenda.map((s) => s.id);
      const attesi = [
        ...Array.from({ length: 2300 }, (_, i) => idLead(i + 1)),
        ...Array.from({ length: 1200 }, (_, i) => idLead(200000 + i + 1)),
        idLead(900001),
        idLead(900002),
        idLead(900003),
        idLead(900006),
        idLead(900007),
      ];
      c("tutte le schede della finestra: 3.505", 3505, ids.length);
      c("nessuna ripetizione", ids.length, new Set(ids).size);
      c(
        "esattamente quelle attese (nessun buco con le pagine)",
        [...attesi].sort(),
        [...ids].sort(),
      );
      c(
        "nessuna scheda di un'altra installazione",
        false,
        ids.includes(idLead(900004)) || ids.includes(idLead(900005)),
      );
      c(
        "le manutenzioni solo fatte o da fissare non entrano",
        false,
        ids.includes(idLead(300001)) || ids.includes(idLead(300002)),
      );
      c(
        "i bordi della finestra sono compresi, fuori no",
        [true, true, false, false],
        [idLead(900006), idLead(900007), idLead(900008), idLead(900009)].map((i) =>
          ids.includes(i),
        ),
      );
      c(
        "la scheda è intera (id, user_id, data, updated_at)",
        ["id", "user_id", "data", "created_at", "updated_at"],
        Object.keys(agenda[0]),
      );

      const letture = selezioniLeads(db);
      c(
        "sette richieste: 3 pagine di consulenze, 1 sede, 1 posa, 2 di manutenzioni",
        7,
        letture.length,
      );
      c(
        "ogni richiesta ha .eq(user_id)",
        true,
        letture.every(
          (r) =>
            filtroDi(r, "eq", "user_id").length === 1 && filtroDi(r, "eq", "user_id")[0][2] === U,
        ),
      );
      c(
        'ogni richiesta ha .order("id") PRIMA di .range()',
        true,
        letture.every((r) => {
          const nomi = r.catena.map((x) => x[0]);
          const o = r.catena.find((x) => x[0] === "order");
          return o && o[1] === "id" && nomi.indexOf("order") < nomi.indexOf("range");
        }),
      );
      c(
        "e nessuna .limit() che taglia a mille",
        false,
        letture.some((r) => filtroDi(r, "limit").length > 0),
      );
      c(
        "nessun select(*)",
        true,
        letture.every((r) => !/\*/.test(filtroDi(r, "select")[0][1])),
      );
      const dellePagine = (campo) =>
        letture
          .filter((r) => r.catena.some((x) => x[1] === campo))
          .map((r) => filtroDi(r, "range")[0].slice(1));
      c(
        "consulenze: range 0-999, 1000-1999, 2000-2999",
        [
          [0, 999],
          [1000, 1999],
          [2000, 2999],
        ],
        dellePagine("data->>dataMeeting"),
      );
      c(
        "manutenzioni: due pagine",
        [
          [0, 999],
          [1000, 1999],
        ],
        dellePagine("data"),
      );
      const soloFissate = [
        "contains",
        "data",
        { manutenzione: { appuntamenti: [{ stato: "fissata" }] } },
      ];
      c(
        "il filtro è il contenimento sulle sole fissate (una per pagina)",
        [soloFissate, soloFissate],
        letture.flatMap((r) => filtroDi(r, "contains")),
      );
      c(
        "limiti di data sulle altre tre letture",
        ["data->>dataMeeting", "data->>dataVieneInSede", "data->installazione->>dataInstallazione"],
        [
          "data->>dataMeeting",
          "data->>dataVieneInSede",
          "data->installazione->>dataInstallazione",
        ].filter((col) =>
          letture.some(
            (r) => filtroDi(r, "gte", col).length === 1 && filtroDi(r, "lte", col).length === 1,
          ),
        ),
      );
    }
    {
      //  Oltre il tetto: errore, mai un'agenda monca
      const { db, porte } = mondo();
      for (let i = 1; i <= 5001; i++)
        db.tabelle.crm_leads.push(
          lead(idLead(i), U, { stato: "appuntamento_fissato", dataMeeting: "2026-10-28" }),
        );
      const e = await lanciato(() => porte.schedeAgenda(U, "2026-10-26", "2026-11-11"));
      c("oltre 5.000 consulenze nella finestra: lancia", { code: "oltre_il_tetto" }, e);
      c(
        "e non legge la sesta pagina",
        5,
        selezioniLeads(db).filter((r) => filtroDi(r, "gte", "data->>dataMeeting").length > 0)
          .length,
      );
    }
    {
      //  Una pagina che fallisce: nessun risultato parziale
      const { db, porte } = mondo();
      for (let i = 1; i <= 10; i++)
        db.tabelle.crm_leads.push(
          lead(idLead(i), U, { stato: "appuntamento_fissato", dataMeeting: "2026-10-28" }),
        );
      db.stato.guasto = (t, op, catena) =>
        t === "crm_leads" && catena.some((x) => x[1] === "data->>dataVieneInSede");
      const e = await lanciato(() => porte.schedeAgenda(U, "2026-10-26", "2026-11-11"));
      c("una lettura che fallisce: l'agenda non torna", { code: "57014" }, e);
    }

    // ───────────────────────────────────────────────────────────────────────
    gruppo("PRENOTA · LE PORTE: LA SCHEDA (compito 6)");
    {
      const { db, porte } = mondo();
      db.tabelle.crm_leads.push(lead(idLead(1), U, { nome: "Anna", stato: "da_contattare" }, "T1"));
      db.tabelle.crm_leads.push(
        lead(idLead(2), ALTRO, { nome: "Bea", stato: "da_contattare" }, "T1"),
      );
      const s = await porte.scheda(U, idLead(1));
      c("legge la scheda con updated_at", ["Anna", "T1"], [s.data.nome, s.updated_at]);
      c("la scheda di un'altra installazione non esiste", null, await porte.scheda(U, idLead(2)));
      c("una scheda che non c'è", null, await porte.scheda(U, idLead(77)));

      //  scrittura condizionata
      const nuovaData = { nome: "Anna", stato: "appuntamento_fissato" };
      c(
        "scrive se updated_at è quello visto",
        "ok",
        await porte.scriviScheda(U, idLead(1), "T1", nuovaData),
      );
      const w = db.registro.filter((r) => r.op === "update")[0];
      c(
        "l'UPDATE ha id, user_id e updated_at visto",
        [
          ["eq", "id", idLead(1)],
          ["eq", "user_id", U],
          ["eq", "updated_at", "T1"],
        ],
        w.catena.filter((x) => x[0] === "eq"),
      );
      c(
        "e chiede le righe scritte (select id)",
        [["select", "id"]],
        w.catena.filter((x) => x[0] === "select"),
      );
      c("il carico è solo `data`", { data: nuovaData }, w.carico);
      c("la scheda è cambiata", "appuntamento_fissato", db.tabelle.crm_leads[0].data.stato);
      const nuovoVisto = db.tabelle.crm_leads[0].updated_at;
      c("il database ha mosso updated_at da solo", true, nuovoVisto !== "T1");
      //  stesso valore visto di prima: qualcuno è arrivato prima
      c(
        "con updated_at vecchio: cambiata",
        "cambiata",
        await porte.scriviScheda(U, idLead(1), "T1", { nome: "X" }),
      );
      c("e non ha scritto niente", "appuntamento_fissato", db.tabelle.crm_leads[0].data.stato);
      c(
        "un'altra installazione non si scrive",
        "cambiata",
        await porte.scriviScheda(U, idLead(2), "T1", { nome: "X" }),
      );
      c("e resta intatta", "Bea", db.tabelle.crm_leads[1].data.nome);
      c(
        "con visto null: cambiata (non si scrive alla cieca)",
        "cambiata",
        await porte.scriviScheda(U, idLead(1), null, { nome: "X" }),
      );
      c("e non ha scritto", "Anna", db.tabelle.crm_leads[0].data.nome);
    }

    // ───────────────────────────────────────────────────────────────────────
    gruppo("PRENOTA · LE PORTE: CONSULENTI, BLOCCHI, CONFIGURAZIONE (compito 6)");
    {
      const { db, porte } = mondo();
      db.tabelle.crm_consultants.push(
        { id: "c1", user_id: U, data: { nome: "Filippo" }, created_at: "x", updated_at: "y" },
        { id: "c2", user_id: ALTRO, data: { nome: "Estraneo" }, created_at: "x", updated_at: "y" },
      );
      c(
        "i consulenti dell'installazione, non quelli degli altri",
        ["c1"],
        (await porte.consulenti(U)).map((x) => x.id),
      );

      c("config: senza riga è spenta", null, await porte.config());
      db.tabelle.app_config.push(config("prenota_chat", "non è json"));
      c("config: riga illeggibile è spenta", null, await porte.config());
      db.tabelle.app_config[0].value = '{"v":1,"acceso":false}';
      c("config: acceso:false è spenta", null, await porte.config());
      db.tabelle.app_config[0].value =
        '{"v":1,"acceso":true,"consulenteId":" c1 ","preavvisoOre":5,"giorniAvanti":99,"durataMin":60}';
      c(
        "config: accesa, con i numeri fuori scala al predefinito",
        { acceso: true, consulenteId: "c1", preavvisoOre: 5, giorniAvanti: 14, durataMin: 60 },
        await porte.config(),
      );
      c(
        "config legge la chiave prenota_chat",
        [["eq", "key", "prenota_chat"]],
        db.registro.at(-1).catena.filter((x) => x[0] === "eq"),
      );

      c("blocchi: senza riga, nessuno", [], await porte.blocchi());
      db.tabelle.app_config.push(
        config(
          "crm_blocchi_disponibilita",
          JSON.stringify({
            v: 1,
            blocchi: [
              {
                id: "b1",
                quando: "data",
                data: "2026-10-30",
                consulenteId: "c1",
                motivo: "chiuso",
              },
            ],
          }),
        ),
      );
      const b = await porte.blocchi();
      c(
        "blocchi: legge la riga crm_blocchi_disponibilita",
        [1, "2026-10-30", "c1"],
        [b.length, b[0].data, b[0].consulenteId],
      );
      db.tabelle.app_config.find((r) => r.key === "crm_blocchi_disponibilita").value = "{{{";
      c("blocchi: riga illeggibile = nessun blocco (come il browser)", [], await porte.blocchi());
    }

    // ───────────────────────────────────────────────────────────────────────
    gruppo("PRENOTA · LE PORTE: LE SCHEDE DEL NUMERO (compito 6)");
    {
      const { db, porte } = mondo();
      const L = db.tabelle.crm_leads;
      const ieri = new Date(Date.now() - 24 * 3600e3).toISOString();
      const vecchio = new Date(Date.now() - 10 * 24 * 3600e3).toISOString();
      L.push(lead(idLead(1), U, { nome: "A", telefono: "+39 320 0000001" })); // l'id nel corpo
      L.push(lead(idLead(2), U, { nome: "B", telefono: "3200000001" })); // da whatsapp_contacts (+cifre)
      L.push(lead(idLead(3), U, { nome: "C", telefono: "320 000 0001" })); // da un invio recente
      L.push(lead(idLead(4), U, { nome: "D", telefono: "3200000001" })); // da un invio di 10 giorni fa
      L.push(lead(idLead(5), U, { nome: "E", telefono: "3200000002" })); // id nel corpo, altro telefono
      L.push(lead(idLead(6), ALTRO, { nome: "F", telefono: "3200000001" })); // altra installazione
      L.push(lead(idLead(7), U, { nome: "G", telefono: "3200000009" })); // contatto che punta a un altro telefono
      L.push(lead(idLead(8), U, { nome: "H", telefono: "+393200000001" })); // contatto scritto senza «+»
      db.tabelle.whatsapp_contacts.push(
        { id: "w1", user_id: U, phone_e164: "+" + TEL, lead_id: idLead(2), non_scrivere_dal: null },
        { id: "w2", user_id: U, phone_e164: TEL, lead_id: idLead(8), non_scrivere_dal: null },
        {
          id: "w3",
          user_id: ALTRO,
          phone_e164: "+" + TEL,
          lead_id: idLead(6),
          non_scrivere_dal: null,
        },
        {
          id: "w4",
          user_id: U,
          phone_e164: "+393200000009",
          lead_id: idLead(7),
          non_scrivere_dal: null,
        },
      );
      db.tabelle.manychat_invii.push(
        { id: "i1", user_id: U, lead_id: idLead(3), telefono: TEL, prenotato_il: ieri },
        { id: "i2", user_id: U, lead_id: idLead(4), telefono: TEL, prenotato_il: vecchio },
        { id: "i3", user_id: ALTRO, lead_id: idLead(6), telefono: TEL, prenotato_il: ieri },
        { id: "i4", user_id: U, lead_id: idLead(3), telefono: TEL, prenotato_il: ieri },
      );
      const ids = async (corpoId) =>
        (await porte.schedeDelNumero(U, TEL, corpoId)).map((s) => s.id).sort();
      c(
        "trovate: id del corpo, contatto (con e senza «+»), invio recente — una volta sola",
        [idLead(1), idLead(2), idLead(3), idLead(8)].sort(),
        await ids(idLead(1)),
      );
      c(
        "la scheda di un'altra installazione non entra, nemmeno se c'è il suo id nel corpo",
        false,
        (await ids(idLead(6))).includes(idLead(6)),
      );
      c(
        "un id che ha un altro telefono non entra",
        false,
        (await ids(idLead(5))).includes(idLead(5)),
      );
      c("l'invio di dieci giorni fa non vale", false, (await ids(idLead(1))).includes(idLead(4)));
      c(
        "un id che non è un uuid si ignora, senza errori",
        [idLead(2), idLead(3), idLead(8)].sort(),
        await ids("x'; DROP TABLE crm_leads;--"),
      );

      const prima = db.registro.length;
      const r = db.registro.slice(prima - 0);
      void r;
      db.registro.length = 0;
      await ids(idLead(1));
      const per = (tabella) => db.registro.filter((x) => x.tabella === tabella);
      c(
        "whatsapp_contacts: user_id e i due formati",
        [
          ["eq", "user_id", U],
          ["in", "phone_e164", ["+" + TEL, TEL]],
        ],
        per("whatsapp_contacts")[0].catena.filter((x) => x[0] === "eq" || x[0] === "in"),
      );
      c(
        "manychat_invii: user_id, telefono, ultimi sette giorni",
        ["eq:user_id", "eq:telefono", "gte:prenotato_il"],
        per("manychat_invii")[0]
          .catena.filter((x) => ["eq", "gte"].includes(x[0]))
          .map((x) => `${x[0]}:${x[1]}`),
      );
      c(
        "crm_leads: UNA lettura per tutti gli id, con user_id",
        [1, "eq:user_id", true],
        [
          per("crm_leads").length,
          `eq:${per("crm_leads")[0].catena.find((x) => x[0] === "in" || x[0] === "eq")[1]}`.replace(
            "eq:id",
            "x",
          ),
          per("crm_leads")[0].catena.some((x) => x[0] === "eq" && x[1] === "user_id" && x[2] === U),
        ],
      );

      db.registro.length = 0;
      c(
        "un telefono che non sono cifre: nessuna scheda",
        [],
        await porte.schedeDelNumero(U, "3200000001'; --", idLead(1)),
      );
      c("e nessuna richiesta al database", 0, db.registro.length);
      c("nessun candidato: nessuna scheda", [], await porte.schedeDelNumero(U, "393200000077", ""));
      c(
        "e nessuna lettura di crm_leads",
        0,
        db.registro.filter((x) => x.tabella === "crm_leads").length,
      );
    }

    // ───────────────────────────────────────────────────────────────────────
    gruppo("PRENOTA · LE PORTE: STOP, SECONDO STATO, UTENTE (compito 6)");
    {
      const { db, porte } = mondo();
      const TEL2 = "393200000002";
      db.tabelle.whatsapp_contacts.push(
        {
          id: "w1",
          user_id: U,
          phone_e164: "+" + TEL,
          lead_id: null,
          non_scrivere_dal: "2026-10-01T00:00:00Z",
        },
        {
          id: "w2",
          user_id: U,
          phone_e164: TEL2,
          lead_id: null,
          non_scrivere_dal: "2026-10-02T00:00:00Z",
        },
        {
          id: "w3",
          user_id: U,
          phone_e164: "+393200000003",
          lead_id: null,
          non_scrivere_dal: null,
        },
        {
          id: "w4",
          user_id: ALTRO,
          phone_e164: "+393200000004",
          lead_id: null,
          non_scrivere_dal: "2026-10-01T00:00:00Z",
        },
      );
      c("STOP: numero con «+»", true, await porte.nonScrivere(U, TEL));
      c("STOP: numero senza «+»", true, await porte.nonScrivere(U, TEL2));
      c("contatto senza STOP", false, await porte.nonScrivere(U, "393200000003"));
      c("numero sconosciuto", false, await porte.nonScrivere(U, "393200000099"));
      c(
        "lo STOP di un'altra installazione non conta",
        false,
        await porte.nonScrivere(U, "393200000004"),
      );

      c(
        "utente: senza riga di configurazione",
        { userId: null, motivo: "non_configurato" },
        await porte.utente(),
      );
      db.tabelle.manychat_config.push({ id: 1, user_id: U });
      c("utente: l'installazione della configurazione", { userId: U }, await porte.utente());

      db.tabelle.crm_leads.push(
        lead(idLead(1), U, {
          nome: "A",
          contattoWa: { stato: "in_attesa", il: "x", da: "automatico", storia: [] },
        }),
      );
      db.tabelle.crm_leads.push(
        lead(idLead(2), ALTRO, {
          nome: "B",
          contattoWa: { stato: "ha_risposto", il: "x", da: "automatico", storia: [] },
        }),
      );
      c(
        "secondo stato della scheda",
        "in_attesa",
        (await porte.statoSecondo(U, idLead(1))).contattoWa.stato,
      );
      c("di un'altra installazione: nessuno", null, await porte.statoSecondo(U, idLead(2)));
      db.stato.rpc.contatto_wa_aggiorna = { data: true, error: null };
      const cambio = {
        patch: { stato: "da_ricontattare", il: "2026-10-27T10:00:00.000Z", da: "automatico" },
        voce: { stato: "da_ricontattare", il: "2026-10-27T10:00:00.000Z", da: "automatico" },
      };
      c(
        "scriviContatto: passa dalla funzione SQL, vero se ha scritto",
        true,
        await porte.scriviContatto(U, idLead(1), cambio),
      );
      const rpc = db.registro.find((x) => x.op === "rpc");
      c(
        "e con user_id e id della scheda",
        ["contatto_wa_aggiorna", U, idLead(1)],
        [rpc.fn, rpc.args.p_user_id, rpc.args.p_id],
      );
      db.stato.rpc.contatto_wa_aggiorna = { data: false, error: null };
      c(
        "scriviContatto: falso se la funzione non ha scritto (STOP)",
        false,
        await porte.scriviContatto(U, idLead(1), cambio),
      );
    }

    // ───────────────────────────────────────────────────────────────────────
    gruppo("PRENOTA · LE PORTE: PROPOSTA E STANZA (compito 6)");
    {
      const { db, porte } = mondo();
      const riga = {
        v: 1,
        il: "2026-10-27T10:00:00.000Z",
        fascia: "sera",
        fasciaChiesta: "sera",
        pagina: 1,
        proposte: [{ g: "2026-10-28", o: "18:00" }],
        mostrati: [{ g: "2026-10-28", o: "18:00" }],
      };
      const k = "prenota_chat:0123456789abcdef0123456789abcdef";
      c("proposta: senza riga", null, await porte.proposta(k));
      await porte.scriviProposta(k, riga);
      c("proposta: scritta e riletta uguale", riga, await porte.proposta(k));
      c(
        "la riga di proposta è una sola per chiave, JSON, con updated_at",
        [1, "string", true],
        [
          db.tabelle.app_config.filter((r) => r.key === k).length,
          typeof db.tabelle.app_config[0].value,
          !Number.isNaN(Date.parse(db.tabelle.app_config[0].updated_at)),
        ],
      );
      await porte.scriviProposta(k, { ...riga, pagina: 2 });
      c(
        "riscritta: sempre una riga sola",
        [1, 2],
        [db.tabelle.app_config.length, (await porte.proposta(k)).pagina],
      );
      for (const [nome, v] of [
        ["testo non json", "ciao"],
        ["un numero", "5"],
        ["senza versione", JSON.stringify({ ...riga, v: 2 })],
        ["fascia inventata", JSON.stringify({ ...riga, fascia: "notte" })],
        ["fascia «toString» (non è una fascia)", JSON.stringify({ ...riga, fascia: "toString" })],
        ["fascia chiesta «constructor»", JSON.stringify({ ...riga, fasciaChiesta: "constructor" })],
        ["pagina 4", JSON.stringify({ ...riga, pagina: 4 })],
        ["proposte non lista", JSON.stringify({ ...riga, proposte: "x" })],
        ["un orario senza ora", JSON.stringify({ ...riga, mostrati: [{ g: "2026-10-28" }] })],
      ]) {
        db.tabelle.app_config[0].value = v;
        c(`proposta storta (${nome}): nessuna proposta aperta`, null, await porte.proposta(k));
      }

      //  il contatore: una riga sua, separata dalla proposta
      const kn = k + ":n";
      c("contatore: senza riga", null, await porte.contatore(kn));
      await porte.scriviContatore(kn, { ora: "2026-10-27T11", n: 3 });
      c("contatore: scritto e riletto", { ora: "2026-10-27T11", n: 3 }, await porte.contatore(kn));
      await porte.scriviContatore(kn, { ora: "2026-10-27T11", n: 4 });
      c(
        "contatore: riga sola, e la proposta non si tocca",
        [1, 1, 2],
        [
          db.tabelle.app_config.filter((r) => r.key === kn).length,
          db.tabelle.app_config.filter((r) => r.key === k).length,
          db.tabelle.app_config.length,
        ],
      );
      for (const [nome, v] of [
        ["testo non json", "ciao"],
        ["senza ora", JSON.stringify({ n: 1 })],
        ["n non numero", JSON.stringify({ ora: "x", n: "uno" })],
        ["un numero", "5"],
      ]) {
        db.tabelle.app_config.find((r) => r.key === kn).value = v;
        c(`contatore storto (${nome}): riparte da zero`, null, await porte.contatore(kn));
      }

      //  stanza
      c("stanza: riga che non c'è", null, await porte.stanza.leggi("meet:x"));
      await porte.stanza.scrivi("meet:x", '{"code":"abc"}');
      c("stanza: scritta e riletta", '{"code":"abc"}', await porte.stanza.leggi("meet:x"));
      await porte.stanza.scrivi("meet:x", '{"code":"def"}');
      c(
        "stanza: riscritta (upsert), riga unica",
        [1, '{"code":"def"}'],
        [
          db.tabelle.app_config.filter((r) => r.key === "meet:x").length,
          await porte.stanza.leggi("meet:x"),
        ],
      );
      await porte.stanza.elimina("meet:x");
      c("stanza: eliminata", null, await porte.stanza.leggi("meet:x"));
      c(
        "stanza: eliminare ciò che non c'è non lancia",
        undefined,
        await lanciato(() => porte.stanza.elimina("meet:non-c-e")),
      );
      c(
        "l'eliminazione è per chiave esatta",
        [["eq", "key", "meet:non-c-e"]],
        db.registro.filter((r) => r.op === "delete").at(-1).catena,
      );
    }

    // ───────────────────────────────────────────────────────────────────────
    gruppo("PRENOTA · IL LUCCHETTO (compito 6)");
    {
      const K = "prenota_chat_lock:lead:" + idLead(1);
      const riga = (db, k = K) => db.tabelle.app_config.find((r) => r.key === k);

      // libero → preso
      let { db, porte } = mondo();
      const prima = Date.now();
      c("libero: si prende", true, await porte.lucchetto.prendi(K, "a", 20000));
      const v = JSON.parse(riga(db).value);
      c(
        "la riga porta {di, fino}",
        ["a", true],
        [v.di, Math.abs(Date.parse(v.fino) - (prima + 20000)) < 5000],
      );
      c(
        "è un INSERT (non un upsert)",
        ["insert"],
        db.registro
          .filter((r) => r.tabella === "app_config")
          .map((r) => r.op)
          .slice(0, 1),
      );

      // occupato (non scaduto)
      c("occupato da un altro: no", false, await porte.lucchetto.prendi(K, "b", 20000));
      c("e la riga è ancora quella di «a»", "a", JSON.parse(riga(db).value).di);
      c(
        "nemmeno lo stesso `di` lo riprende (non è rientrante)",
        false,
        await porte.lucchetto.prendi(K, "a", 20000),
      );

      // rilascio con il valore esatto
      db.registro.length = 0;
      const scritto = riga(db).value;
      await porte.lucchetto.lascia(K, "a");
      const del = db.registro.find((r) => r.op === "delete");
      c(
        "lascia: DELETE con key e valore ESATTO, mai un LIKE",
        [
          ["eq", "key", K],
          ["eq", "value", scritto],
        ],
        del.catena,
      );
      c("e la riga non c'è più", undefined, riga(db));
      c("si può riprendere", true, await porte.lucchetto.prendi(K, "b", 20000));

      // scaduto → ripreso con UPDATE sul valore letto
      ({ db, porte } = mondo());
      const scaduto = JSON.stringify({
        di: "morto",
        fino: new Date(Date.now() - 1000).toISOString(),
      });
      db.tabelle.app_config.push(config(K, scaduto));
      c("scaduto: si riprende", true, await porte.lucchetto.prendi(K, "a", 20000));
      const upd = db.registro.find((r) => r.op === "update");
      c(
        "con UPDATE sul valore letto",
        [
          ["eq", "key", K],
          ["eq", "value", scaduto],
        ],
        upd.catena.filter((x) => x[0] === "eq"),
      );
      c("ora è di «a»", "a", JSON.parse(riga(db).value).di);

      // non ancora scaduto (di poco)
      ({ db, porte } = mondo());
      db.tabelle.app_config.push(
        config(K, JSON.stringify({ di: "vivo", fino: new Date(Date.now() + 3000).toISOString() })),
      );
      c("non ancora scaduto: occupato", false, await porte.lucchetto.prendi(K, "a", 20000));
      c("e nessun UPDATE", 0, db.registro.filter((r) => r.op === "update").length);

      // valore illeggibile = scaduto
      ({ db, porte } = mondo());
      db.tabelle.app_config.push(config(K, "non json"));
      c("riga illeggibile: si riprende", true, await porte.lucchetto.prendi(K, "a", 20000));
      ({ db, porte } = mondo());
      db.tabelle.app_config.push(config(K, JSON.stringify({ di: "x" })));
      c("riga senza `fino`: si riprende", true, await porte.lucchetto.prendi(K, "a", 20000));

      // scaduto, ma un altro lo riprende un attimo prima: l'UPDATE non scrive niente
      ({ db, porte } = mondo());
      db.tabelle.app_config.push(config(K, scaduto));
      const dellAltro = JSON.stringify({
        di: "altro",
        fino: new Date(Date.now() + 20000).toISOString(),
      });
      db.stato.prima = (t, op) => {
        if (t === "app_config" && op === "update") riga(db, K).value = dellAltro;
      };
      c(
        "ripreso da un altro nel frattempo: occupato",
        false,
        await porte.lucchetto.prendi(K, "a", 20000),
      );
      c("e il lucchetto dell'altro non si tocca", dellAltro, riga(db, K).value);

      // due insieme: uno solo
      ({ db, porte } = mondo());
      const porte2 = modulo.portePrenota();
      let esiti = await Promise.all([
        porte.lucchetto.prendi(K, "a", 20000),
        porte2.lucchetto.prendi(K, "b", 20000),
      ]);
      c("due insieme sul libero: uno solo lo prende", [false, true], [...esiti].sort());
      ({ db, porte } = mondo());
      const porte3 = modulo.portePrenota();
      db.tabelle.app_config.push(config(K, scaduto));
      esiti = await Promise.all([
        porte.lucchetto.prendi(K, "a", 20000),
        porte3.lucchetto.prendi(K, "b", 20000),
      ]);
      c("due insieme sullo scaduto: uno solo lo riprende", [false, true], [...esiti].sort());
      c(
        "e la riga ha un solo proprietario",
        1,
        db.tabelle.app_config.filter((r) => r.key === K).length,
      );

      // il lucchetto di un altro non si rilascia
      ({ db, porte } = mondo());
      await porte.lucchetto.prendi(K, "a", 20000);
      riga(db).value = dellAltro; // scaduto e ripreso da un altro
      await porte.lucchetto.lascia(K, "a");
      c("lascia dopo che l'ha ripreso un altro: la sua riga resta", dellAltro, riga(db)?.value);
      db.registro.length = 0;
      await porte.lucchetto.lascia(K, "mai-preso");
      c("lascia di ciò che non ha preso: nessuna richiesta", 0, db.registro.length);

      // l'INSERT riesce e la risposta si perde: `prendi` lancia, ma `lascia` toglie la riga
      ({ db, porte } = mondo());
      db.stato.persaDopo = (t, op) => t === "app_config" && op === "insert";
      c("risposta persa dopo l'INSERT: prendi lancia", "57014", (await lanciato(() => porte.lucchetto.prendi(K, "a", 20000)))?.code);
      c("…ma la riga c'è (era scritta davvero)", "a", JSON.parse(riga(db).value).di);
      db.stato.persaDopo = null;
      await porte.lucchetto.lascia(K, "a");
      c("…e lascia la toglie, col valore esatto", undefined, riga(db));
      // occupato da un altro: nulla da rilasciare, e la riga dell'altro non si tocca
      ({ db, porte } = mondo());
      db.tabelle.app_config.push(config(K, dellAltro));
      c("occupato: prendi dice no", false, await porte.lucchetto.prendi(K, "a", 20000));
      db.registro.length = 0;
      await porte.lucchetto.lascia(K, "a");
      c("…lascia non fa nessuna richiesta (non l'ha preso)", [0, dellAltro], [db.registro.length, riga(db).value]);

      // chiavi diverse, lucchetti diversi (lead / consulente+giorno)
      ({ db, porte } = mondo());
      const K2 = "prenota_chat_lock:c1:2026-10-28";
      c(
        "lead e consulente+giorno sono lucchetti separati",
        [true, true],
        [await porte.lucchetto.prendi(K, "a", 20000), await porte.lucchetto.prendi(K2, "a", 20000)],
      );
      await porte.lucchetto.lascia(K2, "a");
      await porte.lucchetto.lascia(K, "a");
      c("rilasciati tutti e due: nessuna riga lucchetto", [], db.tabelle.app_config);

      // errore del database
      ({ db, porte } = mondo());
      db.stato.guasto = (t, op) => op === "insert";
      c(
        "errore diverso da 23505: lancia solo il codice",
        { code: "57014" },
        await lanciato(() => porte.lucchetto.prendi(K, "a", 20000)),
      );
    }

    // ───────────────────────────────────────────────────────────────────────
    gruppo("PRENOTA · LE PORTE: ERRORI E LOG (compito 6)");
    {
      const { db, porte } = mondo();
      db.tabelle.manychat_config.push({ id: 1, user_id: U });
      db.tabelle.crm_leads.push(lead(idLead(1), U, { nome: "Anna", telefono: TEL }));
      await porte.lucchetto.prendi("prenota_chat_lock:lead:x", "a", 20000);
      db.stato.guasto = () => true; // da qui il database dice sempre no
      const prove = {
        config: () => porte.config(),
        utente: () => porte.utente(),
        consulenti: () => porte.consulenti(U),
        schedeAgenda: () => porte.schedeAgenda(U, "2026-10-26", "2026-11-11"),
        blocchi: () => porte.blocchi(),
        schedeDelNumero: () => porte.schedeDelNumero(U, TEL, idLead(1)),
        scheda: () => porte.scheda(U, idLead(1)),
        scriviScheda: () => porte.scriviScheda(U, idLead(1), "T1", { nome: "X" }),
        proposta: () => porte.proposta("prenota_chat:abc"),
        scriviProposta: () => porte.scriviProposta("prenota_chat:abc", {}),
        contatore: () => porte.contatore("prenota_chat:abc:n"),
        scriviContatore: () => porte.scriviContatore("prenota_chat:abc:n", { ora: "x", n: 1 }),
        "stanza.leggi": () => porte.stanza.leggi("meet:x"),
        "stanza.scrivi": () => porte.stanza.scrivi("meet:x", "{}"),
        "stanza.elimina": () => porte.stanza.elimina("meet:x"),
        "lucchetto.prendi": () => porte.lucchetto.prendi("prenota_chat_lock:lead:y", "a", 20000),
        "lucchetto.lascia": () => porte.lucchetto.lascia("prenota_chat_lock:lead:x", "a"),
        nonScrivere: () => porte.nonScrivere(U, TEL),
        statoSecondo: () => porte.statoSecondo(U, idLead(1)),
      };
      for (const [nome, f] of Object.entries(prove)) {
        const e = await lanciato(f);
        const testo = JSON.stringify(e);
        c(
          `${nome}: lancia solo {code}, mai il messaggio né dati`,
          [["code"], false, false],
          [
            Object.keys(e ?? {}),
            testo.includes(TEL) || testo.includes("Anna"),
            /dettaglio|riservato/.test(testo),
          ],
        );
      }
    }
    {
      //  l'avviso scrive solo il codice; l'attesa passa davvero dal tempo
      const { porte } = mondo();
      const righe = [];
      const warn = console.warn;
      console.warn = (...a) => righe.push(a);
      try {
        porte.avviso("preso");
      } finally {
        console.warn = warn;
      }
      c("avviso: tag e codice, nient'altro", [["[manychat-prenota]", "preso"]], righe);
      const t0 = Date.now();
      await porte.attesa(30);
      c("attesa: passa il tempo chiesto", true, Date.now() - t0 >= 25);
      c("adesso è un'ora vera", true, Math.abs(porte.adesso().getTime() - Date.now()) < 2000);
    }
  } finally {
    globalThis.fetch = originaleFetch;
    delete globalThis.__supabaseFinto;
    pulisci();
  }
}
