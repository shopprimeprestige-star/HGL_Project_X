/** ── FINTO CLIENT SUPABASE PER LE PROVE DELLA ROTTA ORDINI (T9) ───────────
 *  Un database in memoria con le sole due tabelle dell'e-commerce e le sole chiamate che la rotta usa
 *  (`select`, `eq`, `is`, `in`, `or`, `order`, `range`, `limit`, `update`, `insert`). Niente rete, niente chiavi.
 *  Serve a provare le SEQUENZE: ogni chiamata finisce in `registro`, le scritture anche in `scritture`.
 *
 *  Due fedeltà che contano:
 *   · le colonne data si confrontano al MICROSECONDO, come fa Postgres (`.eq("pagato_il", …)` con un valore
 *     passato per `new Date()` non combacia: è il caso dell'obbligo 1 di T8);
 *   · `update` risponde senza errore anche con 0 righe (come PostgREST): il 409 lo decide il chiamante.
 *  ⚠️ Dati sempre inventati. */

const DATE = new Set(["pagato_il", "aggiornato_il", "created_at"]);
const NUOVE = ["lead_id", "senza_lead", "pagato_il", "pagato_importo", "metodo_pagamento", "tracking", "note_interne", "aggiornato_il"];

/** «2026-11-17T15:00:00.123456+00:00» → microsecondi dall'epoca (BigInt-free: ms * 1000 + resto). */
function micro(v) {
  const m = /^(.*?T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(.*)$/.exec(String(v).replace(" ", "T"));
  if (!m) return NaN;
  const ms = Date.parse(`${m[1]}${m[3]}`);
  return ms * 1000 + Number((m[2] ?? "").padEnd(6, "0").slice(0, 6));
}
const uguale = (col, a, b) => (DATE.has(col) && a != null && b != null ? micro(a) === micro(b) : a === b);

/** Una condizione di `.or("col.is.null,col.eq.")`. */
function valutaOr(riga, testo) {
  return testo.split(",").some((p) => {
    const [col, op, ...resto] = p.split(".");
    const v = resto.join(".");
    if (op === "is" && v === "null") return riga[col] == null;
    if (op === "eq") return uguale(col, riga[col], v);
    throw new Error(`or non previsto nel finto: ${p}`);
  });
}

function passa(riga, filtri) {
  return filtri.every(([tipo, col, val]) => {
    if (tipo === "eq") return uguale(col, riga[col], val);
    if (tipo === "is") return val === null ? riga[col] == null : riga[col] === val;
    if (tipo === "in") return val.includes(riga[col]);
    if (tipo === "or") return valutaOr(riga, col);
    throw new Error(`filtro non previsto: ${tipo}`);
  });
}

/**
 * @param {object} o
 * @param {object[]} [o.ordini]  righe di shop_orders (forma del database)
 * @param {object[]} [o.eventi]  righe di shop_order_eventi
 * @param {boolean}  [o.mancante] la migrazione M1 NON è applicata: le colonne nuove e la tabella eventi non esistono
 * @param {Record<string, object|function>} [o.errori] «tabella.operazione» → `{ error }` o `{ lancia }` (anche funzione che lo decide)
 * @param {Record<string, function>} [o.prima] «tabella.operazione» → funzione eseguita subito PRIMA (simula un altro utente che scrive)
 */
export function fintoDb({ ordini = [], eventi = [], mancante = false, errori = {}, prima = {} } = {}) {
  const tabelle = { shop_orders: ordini.map((r) => ({ ...r })), shop_order_eventi: eventi.map((r) => ({ ...r })) };
  const registro = [];
  const db = {
    tabelle,
    registro,
    get chiamate() { return registro.length; },
    get scritture() { return registro.filter((r) => r.op === "update" || r.op === "insert" || r.op === "delete"); },
    from(tab) {
      const q = { tab, op: "select", cols: "*", opzioni: undefined, filtri: [], ordine: [], range: null, limite: null, patch: null, riga: null, chiestiIndietro: null };
      registro.push(q);
      const b = {
        select(cols = "*", opzioni) {
          if (q.op === "update" || q.op === "insert") q.chiestiIndietro = cols;
          else { q.cols = cols; q.opzioni = opzioni; }
          return b;
        },
        update(patch) { q.op = "update"; q.patch = patch; return b; },
        insert(riga) { q.op = "insert"; q.riga = riga; return b; },
        delete() { q.op = "delete"; return b; },
        eq(col, val) { q.filtri.push(["eq", col, val]); return b; },
        is(col, val) { q.filtri.push(["is", col, val]); return b; },
        in(col, val) { q.filtri.push(["in", col, val]); return b; },
        or(testo) { q.filtri.push(["or", testo, null]); return b; },
        order(col, o) { q.ordine.push([col, o?.ascending !== false]); return b; },
        range(da, a) { q.range = [da, a]; return b; },
        limit(n) { q.limite = n; return b; },
        then(ok, ko) { return esegui().then(ok, ko); },
      };
      async function esegui() {
        const chiave = `${tab}.${q.op}`;
        const hook = prima[chiave];
        if (hook) hook(tabelle, q);
        const err = typeof errori[chiave] === "function" ? errori[chiave](q) : errori[chiave];
        if (err?.lancia) throw err.lancia;
        if (err?.error) return { data: null, error: err.error, count: null };

        const mancaTabella = mancante && tab === "shop_order_eventi";
        const mancaColonna = mancante && (NUOVE.some((c) => q.cols.includes(c)) || q.filtri.some(([, c]) => NUOVE.includes(c)));
        if (mancaTabella) return { data: null, error: { code: "42P01", message: "relation does not exist", details: null }, count: null };
        if (mancaColonna) return { data: null, error: { code: "42703", message: "column does not exist", details: null }, count: null };

        const righe = tabelle[tab];
        if (q.op === "insert") { righe.push({ id: `ev-${righe.length + 1}`, ...q.riga }); return { data: null, error: null, count: null }; }
        if (q.op === "update") {
          const toccate = righe.filter((r) => passa(r, q.filtri));
          toccate.forEach((r) => Object.assign(r, q.patch));
          // come PostgREST: 200 anche con 0 righe; le righe tornano solo se si chiede `.select(...)`
          return { data: q.chiestiIndietro ? toccate.map((r) => ({ id: r.id })) : null, error: null, count: null };
        }
        if (q.op === "delete") throw new Error("il finto non cancella: la rotta non deve mai chiamare delete");
        let trovate = righe.filter((r) => passa(r, q.filtri));
        for (const [col, asc] of [...q.ordine].reverse()) trovate = [...trovate].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
        const conta = trovate.length;
        if (q.range) trovate = trovate.slice(q.range[0], q.range[1] + 1);
        if (q.limite != null) trovate = trovate.slice(0, q.limite);
        if (q.opzioni?.head) return { data: null, error: null, count: conta };
        return { data: trovate.map((r) => ({ ...r })), error: null, count: q.opzioni?.count ? conta : null };
      }
      return b;
    },
  };
  return db;
}
