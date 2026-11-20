/** ── FINTO CLIENT SUPABASE PER LE PROVE DEL NEGOZIO (T01) ──────────────────
 *  Un database in memoria con le tabelle del catalogo (S1) e le chiamate che il codice del negozio usa:
 *  `select` (con `eq/neq/in/is/or/order/limit/range/single/maybeSingle`), `insert`, `update`, `upsert`, `rpc`.
 *  Niente rete, niente chiavi. Serve a provare le SEQUENZE: ogni chiamata finisce in `registro`.
 *
 *  ⚠️ COSA IL FINTO NON CONTROLLA (si prova solo sul database vero, dopo S1): il trigger di pubblicazione
 *  (`shop_controlla_pubblicazione`), le chiavi esterne (REFERENCES), i NOT NULL, i tipi (integer a 32 bit, jsonb),
 *  i permessi e la protezione per riga, le viste `shop_v_*`. E lavora su UN SOLO FILO: non dimostra le corse fra
 *  due richieste vere (il blocco di riga `FOR UPDATE` si fida del SQL, non di questa prova).
 *
 *  Fedeltà che contano (le controlla `finto-db.mjs`: se il finto sbaglia, mentono tutte le prove):
 *   · le regole che nel database vere stanno nel SQL, qui ci sono: valori unici (sku, slug, id_codice…), CHECK su
 *     giacenza e prezzo, motivi dei movimenti. Un update che le viola non cambia niente e risponde con l'errore;
 *   · `update` risponde senza errore anche con 0 righe (come PostgREST);
 *   · le tre funzioni SQL di S1 (`shop_giacenza_muovi`, `shop_giacenza_imposta`, `shop_impostazione_imposta`) hanno la
 *     STESSA logica: giacenza mai sotto zero, movimento scritto insieme, confronto-e-scambio dell'interruttore.
 *     Ciò che restituiscono (come S1, e lo verifica `finto-db.mjs` leggendo il testo di S1): la giacenza di dopo (numero)
 *     e, per l'interruttore, `true` se ha cambiato e `false` se non ha fatto niente; gli errori sono `ERRORI_SQL`
 *     (messaggio + codice SQLSTATE, gli stessi del `RAISE EXCEPTION`); una funzione che non c'è dà PGRST202;
 *   · una tabella assente risponde 42P01 (o il codice che si sceglie), una colonna assente 42703 in lettura e PGRST204 in scrittura;
 *   · la cancellazione non esiste: nel negozio non si cancella, e chi ci prova lo scopre subito;
 *   · quello che non è previsto LANCIA (relazioni nella select, filtri strani): mai una risposta inventata.
 *   · le righe nuove prendono i DEFAULT di S1 (giacenza 0, attiva, stato «bozza»…) e `shop_media` ha i suoi CHECK;
 *  ⚠️ Dati sempre inventati (`dati.mjs`). */

const SENZA_ID = new Set(["shop_impostazioni", "shop_prodotti_categorie"]);
const UNICI = {
  shop_impostazioni: [["chiave"]],
  shop_categorie: [["slug"]],
  shop_prodotti: [["sku"], ["slug"], ["id_codice"]],
  shop_prodotti_categorie: [["prodotto_id", "categoria_id"]],
  shop_varianti: [["sku"]],
};
export const MOTIVI = ["carico", "rettifica", "reso", "ordine", "annullo_ordine", "migrazione"];
export const SLOT = ["principale", "foto2", "foto3", "foto4", "foto5", "scala", "video", "confezione", "campione"];
const SOTTO_RUOLI = ["retro_base", "macro_attaccatura", "colore_luce", "altro"];
/** Gli errori delle funzioni SQL di S1: messaggio del `RAISE EXCEPTION`, codice SQLSTATE e il suo nome in `USING ERRCODE`. */
export const ERRORI_SQL = {
  giacenza_delta_vuoto: { code: "22023", errcode: "invalid_parameter_value" },
  variante_inesistente: { code: "P0002", errcode: "no_data_found" },
  giacenza_negativa: { code: "23514", errcode: "check_violation" },
};
/** Come S1 scrive «chi»: vuoto → «sconosciuto», al massimo 80 segni. */
const chiDi = (chi) => (typeof chi === "string" && chi.trim() ? chi.trim() : "sconosciuto").slice(0, 80);
/** Uguaglianza fra valori JSON come jsonb: l'ordine delle chiavi non conta. */
const canonico = (v) => (Array.isArray(v) ? v.map(canonico) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonico(v[k])])) : v);
const nonNeg = (v) => v == null || v >= 0;
const pieno = (v) => typeof v === "string" && v.trim() !== ""; // btrim(x) <> ''
const tipoJson = (v, tipo) => v == null || (tipo === "array" ? Array.isArray(v) : v !== null && typeof v === "object" && !Array.isArray(v)); // jsonb_typeof
const CHECK = {
  shop_categorie: (r) => pieno(r.slug) && pieno(r.nome) && ["categoria", "collezione"].includes(r.tipo),
  shop_prodotti: (r) =>
    nonNeg(r.prezzo_cent) && (r.stato == null || ["bozza", "pubblicato", "archiviato"].includes(r.stato)) &&
    pieno(r.sku) && pieno(r.slug) && pieno(r.nome) && ["patch", "cura", "kit"].includes(r.tipo) &&
    (r.origine == null || r.origine === "codice") && tipoJson(r.caratteristiche, "array") && tipoJson(r.contenuto, "oggetto") &&
    tipoJson(r.canali, "oggetto") && tipoJson(r.bozza_modifiche, "oggetto"),
  shop_varianti: (r) => nonNeg(r.giacenza) && nonNeg(r.prezzo_cent) && pieno(r.sku) && tipoJson(r.opzioni, "oggetto"),
  shop_giacenza_movimenti: (r) => r.motivo == null || MOTIVI.includes(r.motivo),
  shop_media: (r) =>
    SLOT.includes(r.slot) &&
    (r.sotto_ruolo == null || SOTTO_RUOLI.includes(r.sotto_ruolo)) &&
    ["foto", "video"].includes(r.tipo) &&
    nonNeg(r.durata_s) &&
    (r.prodotto_id != null) !== (r.categoria_id != null) &&
    (r.variante_id == null || r.slot === "campione"),
};
const ERR = (code, message) => ({ code, message, details: null, hint: null });
const uguali = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

/** I DEFAULT di S1 (solo quelli che servono ai conti). `adesso` serve per i timestamp. */
const DEFAULT = (t, adesso) =>
  ({
    shop_impostazioni: { aggiornato_il: adesso() },
    shop_categorie: { tipo: "categoria", ordine: 0, visibile: false, creato_il: adesso(), aggiornato_il: adesso() },
    shop_prodotti: { stato: "bozza", prezzo_cent: 0, caratteristiche: [], contenuto: {}, box_consulenza: false, canali: {}, creato_il: adesso(), aggiornato_il: adesso() },
    shop_varianti: { nome: "", opzioni: {}, giacenza: 0, attiva: true, ordine: 0, creato_il: adesso(), aggiornato_il: adesso() },
    shop_media: { tipo: "foto", sottotitoli_ok: false, muto: false, ritrae_persone: false, liberatoria_ok: false, ordine: 0, creato_il: adesso() },
    shop_giacenza_movimenti: { creato_il: adesso() },
    shop_storico: { creato_il: adesso() },
  })[t] ?? {};

/** `a.eq.1,b.in.(x,y)` → [["a","eq","1"], ["b","in","(x,y)"]]: la virgola dentro le parentesi non spezza. */
function pezziOr(testo) {
  const pezzi = [];
  let tratto = "";
  let prof = 0;
  for (const ch of testo) {
    if (ch === "(") prof++;
    if (ch === ")") prof--;
    if (ch === "," && prof === 0) { pezzi.push(tratto); tratto = ""; } else tratto += ch;
  }
  pezzi.push(tratto);
  return pezzi.map((p) => { const [col, op, ...resto] = p.split("."); return [col, op, resto.join(".")]; });
}
const testoDi = (v) => (v == null ? null : String(v));
function valutaOr(riga, testo) {
  return pezziOr(testo).some(([col, op, v]) => {
    if (op === "is") return v === "null" ? riga[col] == null : testoDi(riga[col]) === v;
    if (op === "eq") return testoDi(riga[col]) === v;
    if (op === "neq") return testoDi(riga[col]) !== v;
    if (op === "in") return v.replace(/^\(|\)$/g, "").split(",").includes(testoDi(riga[col]));
    throw new Error(`or non previsto nel finto: ${col}.${op}`);
  });
}
function passa(riga, filtri) {
  return filtri.every(([tipo, col, val]) => {
    if (tipo === "eq") return val != null && riga[col] === val; // `= NULL` non trova mai niente
    if (tipo === "neq") return riga[col] !== val;
    if (tipo === "is") return val === null ? riga[col] == null : riga[col] === val;
    if (tipo === "in") return val.includes(riga[col]);
    if (tipo === "or") return valutaOr(riga, col);
    throw new Error(`filtro non previsto: ${tipo}`);
  });
}
/** Postgres: crescente = i vuoti in fondo, decrescente = i vuoti in cima. */
function confronta(a, b, asc) {
  if (a == null || b == null) return a == null && b == null ? 0 : (a == null ? 1 : -1) * (asc ? 1 : -1);
  return (a > b ? 1 : a < b ? -1 : 0) * (asc ? 1 : -1);
}

/**
 * @param {object} o
 * @param {Record<string, object[]>} [o.tabelle]  righe di partenza (forma del database), vedi `tabelleProva()` in dati.mjs
 * @param {boolean|string[]} [o.mancante]  S1 NON applicata: `true` = nessuna tabella e nessuna funzione; elenco = solo quelle tabelle
 * @param {string} [o.codiceMancante]  codice dell'errore di tabella assente (default «42P01»; PostgREST dà anche «PGRST205»)
 * @param {Record<string, string[]>} [o.senzaColonne]  tabella → colonne che nel database non ci sono (migrazione non applicata)
 * @param {Record<string, object|function>} [o.errori]  «tabella.operazione» o «rpc.funzione» → `{ error }` o `{ lancia }` (anche funzione che lo decide)
 * @param {Record<string, function>} [o.prima]  stesse chiavi → funzione `(tabelle, query)` eseguita subito PRIMA (simula un altro che scrive)
 * @param {() => string} [o.adesso]  l'ora dei movimenti e dello storico (ISO)
 */
export function fintoDb({ tabelle = {}, mancante = false, codiceMancante = "42P01", senzaColonne = {}, errori = {}, prima = {}, adesso = () => "2026-11-20T12:00:00.000Z" } = {}) {
  const dati = Object.fromEntries(Object.entries(tabelle).map(([t, righe]) => [t, structuredClone(righe)]));
  const registro = [];
  let seq = 0;
  const manca = (t) => mancante === true || (Array.isArray(mancante) && mancante.includes(t));
  const righe = (t) => (dati[t] ??= []);
  const colonneNonCi = (t, cols) => (senzaColonne[t] ?? []).filter((c) => cols.includes(c));

  /** Le regole che nel database stanno nel SQL. Restituisce l'errore, o null se la riga può stare lì. */
  function controlla(t, riga, altre) {
    if (CHECK[t] && !CHECK[t](riga)) return ERR("23514", `new row for relation "${t}" violates check constraint`);
    for (const colonne of UNICI[t] ?? []) {
      if (colonne.some((c) => riga[c] == null)) continue;
      if (altre.some((a) => colonne.every((c) => a[c] === riga[c]))) return ERR("23505", `duplicate key value violates unique constraint on ${t}(${colonne.join(",")})`);
    }
    return null;
  }
  function inserisci(t, nuove) {
    const messe = [];
    for (const n of nuove) {
      const riga = { ...(SENZA_ID.has(t) ? {} : { id: `r-${++seq}` }), ...DEFAULT(t, adesso), ...Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined)) };
      const err = controlla(t, riga, [...righe(t), ...messe]);
      if (err) return { err };
      messe.push(riga);
    }
    righe(t).push(...messe);
    return { messe };
  }
  function aggiorna(t, toccate, patch) {
    const altre = (r) => righe(t).filter((x) => x !== r && !toccate.includes(x));
    const prove = toccate.map((r) => ({ r, nuova: { ...r, ...patch } }));
    for (const { r, nuova } of prove) {
      const err = controlla(t, nuova, [...altre(r), ...prove.filter((p) => p.r !== r).map((p) => p.nuova)]);
      if (err) return { err };
    }
    toccate.forEach((r) => Object.assign(r, patch));
    return { toccate };
  }

  /* ── le tre funzioni SQL di S1 (stessa logica, stesso ordine dei controlli) ── */
  const sql = (nome) => ({ error: ERR(ERRORI_SQL[nome].code, nome) });
  function muovi(variante, delta, motivo, nota, chi, ordineRef) {
    if (delta != null && !Number.isInteger(delta)) return { error: ERR("22P02", `invalid input syntax for type integer: "${delta}"`) };
    if (delta == null) return sql("giacenza_delta_vuoto");
    const v = righe("shop_varianti").find((x) => x.id === variante);
    if (!v) return sql("variante_inesistente");
    if (v.giacenza + delta < 0) return sql("giacenza_negativa");
    if (delta === 0) return { data: v.giacenza }; // niente movimento, niente scrittura
    if (!MOTIVI.includes(motivo)) return { error: ERR("23514", "new row for relation \"shop_giacenza_movimenti\" violates check constraint") };
    v.giacenza += delta;
    v.aggiornato_il = adesso();
    righe("shop_giacenza_movimenti").push({ id: `r-${++seq}`, variante_id: variante, delta, giacenza_dopo: v.giacenza, motivo, nota: nota ?? null, chi: chiDi(chi), ordine_ref: ordineRef ?? null, creato_il: adesso() });
    return { data: v.giacenza, scrisse: true };
  }
  const funzioni = {
    shop_giacenza_muovi: (a) => muovi(a.p_variante, a.p_delta, a.p_motivo, a.p_nota, a.p_chi, a.p_ordine_ref),
    shop_giacenza_imposta(a) {
      const v = righe("shop_varianti").find((x) => x.id === a.p_variante);
      if (!v) return sql("variante_inesistente");
      if (a.p_nuovo == null || a.p_nuovo < 0) return sql("giacenza_negativa");
      return muovi(a.p_variante, a.p_nuovo - v.giacenza, a.p_motivo, null, a.p_chi, null);
    },
    shop_impostazione_imposta(a) {
      if (a.p_atteso == null || a.p_nuovo == null || uguali(a.p_atteso, a.p_nuovo)) return { data: false };
      const r = righe("shop_impostazioni").find((x) => x.chiave === a.p_chiave);
      if (!r || !uguali(r.valore, a.p_atteso)) return { data: false };
      const chi = chiDi(a.p_chi);
      r.valore = a.p_nuovo;
      r.aggiornato_il = adesso();
      r.aggiornato_da = chi;
      righe("shop_storico").push({ id: `r-${++seq}`, entita: "impostazione", entita_id: a.p_chiave, campo: "valore", prima: a.p_atteso, dopo: a.p_nuovo, chi, creato_il: adesso() });
      return { data: true, scrisse: true };
    },
  };

  /** Ciò che il codice si aspetta di aspettare: `then` esegue, una volta sola, e registra. */
  function eseguibile(q, corpo) {
    const richiesta = {
      then(ok, ko) {
        return (async () => {
          registro.push(q);
          const hook = prima[q.chiave];
          if (hook) hook(dati, q);
          const err = typeof errori[q.chiave] === "function" ? errori[q.chiave](q) : errori[q.chiave];
          if (err?.lancia) throw err.lancia;
          if (err?.error) return { data: null, error: err.error, count: null };
          const r = corpo();
          q.scrisse = Boolean(r.scrisse) && !r.error;
          return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
        })().then(ok, ko);
      },
    };
    return richiesta;
  }

  const db = {
    tabelle: dati,
    registro,
    get chiamate() { return registro.length; },
    get scritture() { return registro.filter((x) => x.scrisse); },

    rpc(nome, args = {}) {
      const q = { chiave: `rpc.${nome}`, tab: null, op: "rpc", nome, args, scrisse: false };
      return eseguibile(q, () => {
        if (mancante === true || !funzioni[nome]) return { error: ERR("PGRST202", `Could not find the function public.${nome} in the schema cache`) };
        return funzioni[nome](args);
      });
    },

    from(tab) {
      const q = { tab, op: "select", cols: "*", opzioni: undefined, filtri: [], ordine: [], range: null, limite: null, patch: null, righe: null, conflitto: null, ignora: false, indietro: null, singolo: null, scrisse: false };
      const b = {
        select(cols = "*", opzioni) {
          if (q.op === "select") { q.cols = cols; q.opzioni = opzioni; } else q.indietro = cols;
          return b;
        },
        insert(r) { q.op = "insert"; q.righe = Array.isArray(r) ? r : [r]; return b; },
        update(p) { q.op = "update"; q.patch = p; return b; },
        upsert(r, o = {}) { q.op = "upsert"; q.righe = Array.isArray(r) ? r : [r]; q.conflitto = o.onConflict ?? null; q.ignora = Boolean(o.ignoreDuplicates); return b; },
        delete() { throw new Error("il finto non cancella: nel negozio non si cancella mai (stato, rimosso_il)"); },
        eq(col, val) { q.filtri.push(["eq", col, val]); return b; },
        neq(col, val) { q.filtri.push(["neq", col, val]); return b; },
        is(col, val) { q.filtri.push(["is", col, val]); return b; },
        in(col, val) { q.filtri.push(["in", col, val]); return b; },
        or(testo) { q.filtri.push(["or", testo, null]); return b; },
        order(col, o) { q.ordine.push([col, o?.ascending !== false]); return b; },
        range(da, a) { q.range = [da, a]; return b; },
        limit(n) { q.limite = n; return b; },
        single() { q.singolo = "single"; return b; },
        maybeSingle() { q.singolo = "maybe"; return b; },
        then(ok, ko) { return esegui().then(ok, ko); },
      };
      /** La chiave («tabella.operazione») si fissa all'esecuzione, quando l'operazione è quella finale. */
      function esegui() {
        q.chiave = `${tab}.${q.op}`;
        return eseguibile(q, () => corpoQuery(q));
      }
      return b;
    },
  };

  /** Il lavoro vero di una `from(...)`. */
  function corpoQuery(q) {
    const t = q.tab;
    if (manca(t)) return { error: ERR(codiceMancante, `Could not find the table 'public.${t}'`) };
    const proiezione = (r) => {
      const cols = q.op === "select" ? q.cols : q.indietro;
      if (cols == null || cols.trim() === "*") return structuredClone(r);
      return Object.fromEntries(cols.split(",").map((c) => c.trim()).map((c) => [c, structuredClone(r[c] ?? null)]));
    };
    const colsChieste = q.op === "select" ? q.cols : q.indietro;
    if (colsChieste && colsChieste.includes("(")) throw new Error("select con relazioni non previsto nel finto: si leggono le tabelle una per volta");
    const risposta = (rs) => {
      const lista = rs.map(proiezione);
      if (!q.singolo) return { data: lista };
      if (lista.length === 1) return { data: lista[0] };
      if (q.singolo === "maybe" && lista.length === 0) return { data: null };
      return { error: ERR("PGRST116", "JSON object requested, multiple (or no) rows returned") };
    };
    
    if (q.op === "select") {
      const chieste = q.cols.trim() === "*" ? [] : q.cols.split(",").map((c) => c.trim());
      if (colonneNonCi(t, [...chieste, ...q.filtri.filter(([ti]) => ti !== "or").map(([, c]) => c)]).length) return { error: ERR("42703", "column does not exist") };
      let trovate = righe(t).filter((r) => passa(r, q.filtri));
      for (const [col, asc] of [...q.ordine].reverse()) trovate = [...trovate].sort((a, b) => confronta(a[col], b[col], asc));
      const conta = trovate.length;
      if (q.range) trovate = trovate.slice(q.range[0], q.range[1] + 1);
      if (q.limite != null) trovate = trovate.slice(0, q.limite);
      if (q.opzioni?.head) return { data: null, count: conta };
      return { ...risposta(trovate), count: q.opzioni?.count ? conta : null };
    }

    const chiaviScritte = q.op === "update" ? Object.keys(q.patch) : q.righe.flatMap((r) => Object.keys(r));
    if (colonneNonCi(t, chiaviScritte).length) return { error: ERR("PGRST204", "Could not find the column in the schema cache") };

    if (q.op === "insert") {
      const { err, messe } = inserisci(t, q.righe);
      return err ? { error: err } : { ...(q.indietro ? risposta(messe) : {}), scrisse: messe.length > 0 };
    }
    if (q.op === "update") {
      const { err, toccate } = aggiorna(t, righe(t).filter((r) => passa(r, q.filtri)), q.patch);
      return err ? { error: err } : { ...(q.indietro ? risposta(toccate) : {}), scrisse: toccate.length > 0 };
    }
    // upsert: per ogni riga, se la chiave c'è già si aggiorna (o si lascia stare), altrimenti si inserisce
    const colonne = q.conflitto ? q.conflitto.split(",").map((c) => c.trim()) : [SENZA_ID.has(t) ? "chiave" : "id"];
    const risultato = [];
    let scrisse = false;
    for (const nuova of q.righe) {
      const esiste = righe(t).find((r) => colonne.every((c) => r[c] === nuova[c]));
      if (esiste && q.ignora) { risultato.push(esiste); continue; }
      const { err, toccate, messe } = esiste ? aggiorna(t, [esiste], nuova) : inserisci(t, [nuova]);
      if (err) return { error: err };
      risultato.push(...(toccate ?? messe));
      scrisse = true;
    }
    return { ...(q.indietro ? risposta(risultato) : {}), scrisse };
  }

  return db;
}
