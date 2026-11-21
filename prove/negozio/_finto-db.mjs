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
 *   · la cancellazione non esiste: nel negozio non si cancella, e chi ci prova lo scopre subito. UNICA eccezione (T09):
 *     `shop_prodotti_categorie` (il legame prodotto-categoria, nessun dato storico), e solo con almeno un filtro;
 *   · quello che non è previsto LANCIA (relazioni nella select, filtri strani): mai una risposta inventata.
 *   · le righe nuove prendono i DEFAULT di S1 (giacenza 0, attiva, stato «bozza»…) e `shop_media` ha i suoi CHECK;
 *  ⚠️ Dati sempre inventati (`dati.mjs`).
 *
 *  ── RILASCIO 2 (PIANO-R2, T40) ─────────────────────────────────────────────────────────────────────────────────
 *  Il finto conosce anche le funzioni SQL di S4 (pagamenti), S5 (spedizioni) e S6 (email) e le tabelle chiuse dei soldi.
 *  ⚠️ Le funzioni SQL VERE le scrivono T41-T43 DOPO questo file: la STESSA logica è garantita da un solo elenco di scenari,
 *  `_scenari-soldi.json`, eseguito sia qui (`finto-db-r2.mjs`) sia a mano nei file `prove/sql/*.sql` (marcatori `-- SCENARIO:`).
 *  Se un'uscita del SQL differisce da questo finto, uno dei due sbaglia: si decide guardando lo scenario, mai ritoccando uno
 *  dei due per far tornare i conti. I NOMI (funzioni, parametri `p_…`, forme delle risposte, nomi degli errori) sono il contratto
 *  per T41-T43 e sono scritti accanto a ogni funzione nel corpo di `fintoDb` (blocco «RILASCIO 2»); l'elenco è `FUNZIONI_R2`.
 *  Ogni funzione è una TRANSAZIONE: se risponde con un errore, niente di ciò che ha scritto resta (come un `RAISE EXCEPTION`).
 *  Le tabelle dei soldi (`CHIUSE`) non si scrivono da fuori: solo le funzioni le toccano, come `REVOKE ALL … FROM service_role`. */

import { createHash } from "node:crypto";

const SENZA_ID = new Set([
  "shop_impostazioni", "shop_prodotti_categorie",
  "shop_stripe_sessioni", "shop_stripe_eventi", "shop_limiti", "shop_email_modelli", "shop_ordini_riservati", // R2: la chiave primaria è una colonna loro
]);
/** Le tabelle dei soldi di S4: nessuna scrittura da fuori (REVOKE ALL FROM service_role); si scrive solo con le funzioni. Si legge. */
export const CHIUSE = new Set(["shop_rimborsi", "shop_stripe_eventi", "shop_stripe_sessioni", "shop_ordini_riservati", "shop_limiti"]);
/** Le colonne che S4 aggiunge a `shop_orders` e il valore che hanno su una riga VECCHIA dopo la migrazione (default costante o vuoto). */
export const COLONNE_S4 = {
  stato_pagamento: null, stripe_sessione_id: null, stripe_pagamento_id: null, metodo_dettaglio: null, prova: false, canale: null,
  totale_cent: null, rimborsato_cent: 0, chiave_pubblica_hash: null, firma_tentativo: null, scade_il: null, riprova_n: 0,
  provincia: null, nazione: null, giacenza_da_verificare: false, giacenza_scalata_il: null, giacenza_rimessa_il: null,
  spedito_il: null, corriere: null, tracking_url: null, senza_tracking: null, annullo_motivo: null, annullato_il: null,
  fattura_richiesta: false, fattura_emessa_il: null, fattura_nota: null, email_inviate: {}, avvisi: [],
};
/** Le funzioni di R2 e la migrazione di ognuna (i parametri e le risposte sono scritti accanto a ciascuna, nel corpo di `fintoDb`). */
export const FUNZIONI_R2 = {
  S4: ["shop_ordine_crea", "shop_ordine_sessione_registra", "shop_ordine_pagato", "shop_ordine_chiudi", "shop_ordine_riapri", "shop_stripe_evento_registra", "shop_stripe_evento_chiudi",
    "shop_rimborso_prenota", "shop_rimborso_riconcilia", "shop_ordine_giacenza_rimetti", "shop_limite_consuma", "shop_cassa_righe"],
  S5: ["shop_tariffa_imposta"],
  S6: ["shop_email_modello_salva", "shop_email_modello_approva", "shop_email_modello_acceso", "shop_email_prenota", "shop_email_esito"],
};
export const STATI_PAGAMENTO = ["in_attesa", "pagato", "fallito", "scaduto", "rimborsato_in_parte", "rimborsato", "da_incassare"];
export const CHIAVI_EMAIL = ["conferma_ordine", "spedito", "pagamento_non_riuscito", "rimborso", "annullato"];
const UNICI = {
  shop_orders: [["id"], ["stripe_sessione_id"]],
  shop_stripe_sessioni: [["sessione_id"]],
  shop_stripe_eventi: [["id"]],
  shop_limiti: [["chiave"]],
  shop_email_modelli: [["chiave"]],
  shop_ordini_riservati: [["ordine_id"]],
  shop_rimborsi: [["chiave_richiesta"], ["stripe_rimborso_id"]],
  shop_impostazioni: [["chiave"]],
  shop_categorie: [["slug"]],
  shop_prodotti: [["sku"], ["slug"], ["id_codice"]],
  shop_prodotti_categorie: [["prodotto_id", "categoria_id"]],
  shop_varianti: [["sku"]],
};
/** Gli indici unici PARZIALI: valgono solo per le righe che passano la condizione. */
const UNICI_SE = {
  shop_orders: [{ colonne: ["order_ref"], se: (r) => r.canale === "sito" }], // nessuna riga vecchia ha `canale`: non può fallire
  shop_spedizioni_tariffe: [{ colonne: ["paese"], se: (r) => r.attiva === true }],
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
/** Gli errori delle funzioni di R2 (S4/S5/S6): separati da `ERRORI_SQL`, che `finto-db.mjs` rilegge dal testo di S1. */
export const ERRORI_SQL_R2 = {
  ordine_non_trovato: { code: "P0002", errcode: "no_data_found" },
  ordine_non_valido: { code: "22023", errcode: "invalid_parameter_value" },
  parametro_non_valido: { code: "22023", errcode: "invalid_parameter_value" },
  ordine_non_riapribile: { code: "55000", errcode: "object_not_in_prerequisite_state" },
  ordine_non_pagato: { code: "55000", errcode: "object_not_in_prerequisite_state" },
  stato_non_valido: { code: "22023", errcode: "invalid_parameter_value" },
  rimborso_importo_non_valido: { code: "22023", errcode: "invalid_parameter_value" },
  rimborso_oltre_pagato: { code: "23514", errcode: "check_violation" },
  limite_non_valido: { code: "22023", errcode: "invalid_parameter_value" },
  tariffa_inesistente: { code: "P0002", errcode: "no_data_found" },
  tariffa_campo_non_valido: { code: "22023", errcode: "invalid_parameter_value" },
  modello_non_trovato: { code: "P0002", errcode: "no_data_found" },
  modello_non_approvato: { code: "55000", errcode: "object_not_in_prerequisite_state" },
  modello_con_segnaposto: { code: "23514", errcode: "check_violation" },
  email_stato_non_valido: { code: "22023", errcode: "invalid_parameter_value" },
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
  shop_orders: (r) => r.stato_pagamento == null || r.stato_pagamento === "" || STATI_PAGAMENTO.includes(r.stato_pagamento),
  shop_rimborsi: (r) => Number.isInteger(r.importo_cent) && r.importo_cent > 0 && pieno(r.motivo) && ["richiesto", "riuscito", "fallito"].includes(r.stato) && ["crm", "stripe"].includes(r.origine),
  shop_spedizioni_tariffe: (r) => r.paese === "IT" && pieno(r.nome) && Number.isInteger(r.costo_cent) && r.costo_cent >= 0 && nonNeg(r.gratis_da_cent) && nonNeg(r.giorni_min) && nonNeg(r.giorni_max),
  shop_email_modelli: (r) => CHIAVI_EMAIL.includes(r.chiave),
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
    shop_media: { tipo: "foto", sottotitoli_ok: false, muto: false, ritrae_persone: false, liberatoria_ok: false, ordine: 0, rimosso_il: null, creato_il: adesso() },
    shop_giacenza_movimenti: { creato_il: adesso() },
    shop_storico: { creato_il: adesso() },
    shop_order_eventi: { created_at: adesso() },
    shop_orders: structuredClone(COLONNE_S4),
    shop_rimborsi: { origine: "crm", stato: "richiesto", creato_il: adesso(), aggiornato_il: adesso() },
    shop_stripe_sessioni: { creata_il: adesso(), stato: "aperta" },
    shop_spedizioni_tariffe: { paese: "IT", attiva: true, provvisoria: false, creato_il: adesso(), aggiornato_il: adesso() },
    shop_email_modelli: { acceso: false, approvato_da: null, approvato_il: null, approvato_hash: null, aggiornato_il: adesso() },
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
    for (const { colonne, se } of UNICI_SE[t] ?? []) {
      if (!se(riga) || colonne.some((c) => riga[c] == null)) continue;
      if (altre.some((a) => se(a) && colonne.every((c) => a[c] === riga[c]))) return ERR("23505", `duplicate key value violates unique constraint on ${t}(${colonne.join(",")}) WHERE …`);
    }
    return null;
  }
  function inserisci(t, nuove) {
    const messe = [];
    for (const n of nuove) {
      const riga = { ...(SENZA_ID.has(t) ? {} : { id: `r-${++seq}` }), ...DEFAULT(t, adesso), ...Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined)) };
      for (const c of senzaColonne[t] ?? []) if (!(c in n)) delete riga[c]; // migrazione non applicata: la colonna non c'è nemmeno di default
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

  /* ══ RILASCIO 2 · le funzioni SQL di S4, S5, S6 (stessa logica del SQL che scriveranno T41-T43) ══════════════════════════
   *  Ognuna è una transazione (`transazione`): un errore annulla tutto ciò che ha scritto. Quello che il SQL farà con
   *  `FOR UPDATE` qui è sequenziale: «due insieme» = una dopo l'altra, e la seconda trova lo stato lasciato dalla prima. */
  class ErroreSql {
    constructor(error) { this.error = error; }
  }
  const lancia = (nome) => { throw new ErroreSql(ERR(ERRORI_SQL_R2[nome].code, nome)); };
  const ins = (t, r) => { const x = inserisci(t, [r]); if (x.err) throw new ErroreSql(x.err); return x.messe[0]; };
  const mod = (t, riga, patch) => { const x = aggiorna(t, [riga], patch); if (x.err) throw new ErroreSql(x.err); return riga; };
  const ms = (iso) => Date.parse(iso);
  const ordineDi = (id) => righe("shop_orders").find((o) => o.id === id);
  const tocca = (o, patch) => mod("shop_orders", o, { ...patch, aggiornato_il: adesso() });
  const storico = (entita, id, campo, prima, dopo, chi) => ins("shop_storico", { entita, entita_id: String(id), campo, prima, dopo, chi: chiDi(chi) });
  const evento = (o, tipo, chi, prima = null, dopo = null) => ins("shop_order_eventi", { order_id: o.id, order_ref: o.order_ref ?? null, tipo, chi: chiDi(chi), prima, dopo });
  /** Un avviso sull'ordine; lo stesso (codice, riferimento) non si scrive due volte: lo stesso evento ripetuto da Stripe non lo moltiplica. */
  const avviso = (o, codice, gravita, rif = null) => {
    const lista = Array.isArray(o.avvisi) ? o.avvisi : [];
    if (lista.some((x) => x.codice === codice && (x.rif ?? null) === rif)) return;
    tocca(o, { avvisi: [...lista, { codice, gravita, rif, il: adesso() }] });
  };
  const pagatoCent = (o) => Math.round(Number(o.pagato_importo ?? 0) * 100);
  const sommaCent = (xs) => xs.reduce((s, r) => s + r.importo_cent, 0);
  /** L'impronta di un modello email: sha256 esadecimale di «oggetto, a capo, testo» (il SQL: `encode(sha256(convert_to(oggetto || E'\n' || testo, 'UTF8')), 'hex')`). */
  const improntaModello = (m) => createHash("sha256").update(`${m.oggetto ?? ""}\n${m.testo ?? ""}`, "utf8").digest("hex");

  /** Le funzioni di R2: la migrazione a cui appartengono, i parametri (nomi `p_…` del SQL) e ciò che rispondono.
   *  Risposte come PostgREST: `jsonb` → oggetto, `boolean` → true/false, `text` → stringa. Gli errori sono `ERRORI_SQL`. */
  const R2 = {
    /* ── S4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
     * shop_ordine_crea(p_ordine jsonb, p_riservati jsonb) → jsonb {esito: 'creato'|'esistente', id}
     *    ordine e riservati in UNA transazione; forza status='nuovo', stato_pagamento='in_attesa', canale='sito', rimborsato_cent=0, niente pagato_il.
     *    Stesso id due volte → una riga ('esistente'). order_ref unico fra le righe canale='sito' (23505). */
    shop_ordine_crea: ["S4", (a) => {
      const o = a.p_ordine;
      if (!o || typeof o !== "object" || typeof o.id !== "string" || !o.id) lancia("ordine_non_valido");
      if (ordineDi(o.id)) return { data: { esito: "esistente", id: o.id } };
      const riga = ins("shop_orders", { created_at: adesso(), ...o, status: "nuovo", stato_pagamento: "in_attesa", canale: "sito", pagato_il: null, pagato_importo: null, rimborsato_cent: 0 });
      const { fattura = null, attribuzione = null, consensi = null, ip = null, user_agent = null } = a.p_riservati ?? {};
      ins("shop_ordini_riservati", { ordine_id: riga.id, fattura, attribuzione, consensi, ip, user_agent });
      evento(riga, "creato", "cassa");
      return { data: { esito: "creato", id: riga.id } };
    }],
    /* shop_ordine_sessione_registra(p_ordine uuid, p_sessione text) → jsonb {esito: 'registrata'|'gia_registrata'}
     *    registra la sessione fra quelle dell'ordine e, se l'ordine è `in_attesa`, la fa diventare la corrente (`stripe_sessione_id`). */
    shop_ordine_sessione_registra: ["S4", (a) => {
      const o = ordineDi(a.p_ordine) ?? lancia("ordine_non_trovato");
      if (typeof a.p_sessione !== "string" || !a.p_sessione) lancia("parametro_non_valido");
      const gia = righe("shop_stripe_sessioni").find((s) => s.sessione_id === a.p_sessione);
      if (gia && gia.ordine_id !== o.id) throw new ErroreSql(ERR("23505", "duplicate key value violates unique constraint on shop_stripe_sessioni(sessione_id)"));
      if (!gia) ins("shop_stripe_sessioni", { sessione_id: a.p_sessione, ordine_id: o.id, scade_il: o.scade_il ?? null });
      if (o.stato_pagamento === "in_attesa") tocca(o, { stripe_sessione_id: a.p_sessione });
      return { data: { esito: gia ? "gia_registrata" : "registrata" } };
    }],
    /* shop_ordine_pagato(p_ordine uuid, p_sessione text, p_importo_cent int, p_valuta text, p_metodo text, p_pagamento_id text)
     *    → jsonb {esito: 'pagato_ora'|'gia_pagato'|'doppio_pagamento'|'importo_diverso'|'sessione_sconosciuta'|'non_trovato', giacenza_da_verificare?}
     *    D44: l'unico punto in cui un ordine diventa pagato. Sessione fra quelle dell'ordine (se no avviso `sessione_sconosciuta`, nessun cambio);
     *    già pagato da un'altra sessione → avviso `doppio_pagamento`; importo ≠ totale_cent o valuta ≠ eur → NON paga, avviso (`importo_diverso`/`valuta_diversa`);
     *    giacenza scalata riga per riga (sotto-blocco: una riga che non basta o uno SKU che non si risolve → `giacenza_da_verificare`, ordine pagato lo stesso);
     *    ordine già `annullato` → pagato, avviso `pagato_dopo_annullo`, giacenza NON toccata e da verificare (§8). */
    shop_ordine_pagato: ["S4", (a) => {
      const o = ordineDi(a.p_ordine);
      if (!o) return { data: { esito: "non_trovato" } };
      const chi = "stripe";
      const sess = righe("shop_stripe_sessioni").find((s) => s.sessione_id === a.p_sessione && s.ordine_id === o.id);
      if (!sess) {
        avviso(o, "sessione_sconosciuta", "rosso", a.p_sessione ?? null);
        evento(o, "sessione_sconosciuta", chi, null, { sessione: a.p_sessione ?? null });
        return { data: { esito: "sessione_sconosciuta" } };
      }
      if (["pagato", "rimborsato_in_parte", "rimborsato"].includes(o.stato_pagamento)) {
        if (sess.stato === "pagata") return { data: { esito: "gia_pagato" } };
        if (sess.stato !== "doppia") {
          mod("shop_stripe_sessioni", sess, { stato: "doppia" });
          avviso(o, "doppio_pagamento", "rosso", sess.sessione_id);
          evento(o, "doppio_pagamento", chi, null, { sessione: sess.sessione_id, importo_cent: a.p_importo_cent ?? null });
        }
        return { data: { esito: "doppio_pagamento" } };
      }
      if (a.p_importo_cent !== o.totale_cent || String(a.p_valuta ?? "").toLowerCase() !== "eur") {
        const codice = a.p_importo_cent !== o.totale_cent ? "importo_diverso" : "valuta_diversa";
        avviso(o, codice, "rosso", sess.sessione_id);
        evento(o, codice, chi, { totale_cent: o.totale_cent }, { importo_cent: a.p_importo_cent ?? null, valuta: a.p_valuta ?? null });
        return { data: { esito: "importo_diverso" } };
      }
      const annullato = o.status === "annullato";
      let daVerificare = annullato;
      let scalate = 0;
      if (!annullato) {
        for (const it of Array.isArray(o.items) ? o.items : []) {
          const v = righe("shop_varianti").find((x) => x.sku === it?.product_id);
          if (!v || !Number.isInteger(it?.qty) || it.qty < 1) { daVerificare = true; continue; }
          if (muovi(v.id, -it.qty, "ordine", null, chi, o.order_ref).error) daVerificare = true;
          else scalate++;
        }
      }
      const prima = o.stato_pagamento;
      tocca(o, {
        stato_pagamento: "pagato", pagato_il: adesso(), pagato_importo: a.p_importo_cent / 100, metodo_pagamento: "stripe",
        metodo_dettaglio: a.p_metodo ?? null, stripe_sessione_id: sess.sessione_id, giacenza_da_verificare: daVerificare || o.giacenza_da_verificare === true,
        ...(a.p_pagamento_id ? { stripe_pagamento_id: a.p_pagamento_id } : {}), ...(scalate ? { giacenza_scalata_il: adesso() } : {}),
      });
      mod("shop_stripe_sessioni", sess, { stato: "pagata" });
      if (annullato) avviso(o, "pagato_dopo_annullo", "rosso", sess.sessione_id);
      else if (daVerificare) avviso(o, "giacenza_da_verificare", "arancio", sess.sessione_id);
      evento(o, "pagato", chi, { stato_pagamento: prima }, { stato_pagamento: "pagato", importo_cent: a.p_importo_cent, sessione: sess.sessione_id });
      return { data: { esito: "pagato_ora", giacenza_da_verificare: daVerificare } };
    }],
    /* shop_ordine_chiudi(p_ordine uuid, p_sessione text, p_stato text) → jsonb {esito: 'chiuso'|'ignorato'|'non_trovato'}
     *    p_stato ∈ fallito|scaduto, SOLO da `in_attesa`, e solo se la sessione è la corrente (l'evento tardivo di una sessione sostituita non chiude
     *    l'ordine che ha già una sessione nuova); `p_sessione` vuota = chiusura decisa dalla cassa (Stripe ha rifiutato la creazione). */
    shop_ordine_chiudi: ["S4", (a) => {
      if (!["fallito", "scaduto"].includes(a.p_stato)) lancia("stato_non_valido");
      const o = ordineDi(a.p_ordine);
      if (!o) return { data: { esito: "non_trovato" } };
      const sess = a.p_sessione ? righe("shop_stripe_sessioni").find((s) => s.sessione_id === a.p_sessione && s.ordine_id === o.id) : null;
      if (sess && sess.stato === "aperta") mod("shop_stripe_sessioni", sess, { stato: a.p_stato === "fallito" ? "fallita" : "scaduta" });
      if (o.stato_pagamento !== "in_attesa" || (a.p_sessione && o.stripe_sessione_id && a.p_sessione !== o.stripe_sessione_id)) return { data: { esito: "ignorato" } };
      tocca(o, { stato_pagamento: a.p_stato });
      evento(o, a.p_stato, "stripe", { stato_pagamento: "in_attesa" }, { stato_pagamento: a.p_stato });
      return { data: { esito: "chiuso" } };
    }],
    /* shop_ordine_riapri(p_ordine uuid, p_nuova_scade timestamptz) → jsonb {esito: 'riaperto', n} | {esito: 'riprova_in_corso'}
     *    D66: solo da `fallito`/`scaduto` → `in_attesa`, riprova_n + 1, nuovo scade_il. Già `in_attesa` (il secondo clic) → 'riprova_in_corso', niente cambia.
     *    Da `pagato`, `rimborsato*`, `da_incassare` o vuoto → errore `ordine_non_riapribile`. */
    shop_ordine_riapri: ["S4", (a) => {
      const o = ordineDi(a.p_ordine) ?? lancia("ordine_non_trovato");
      if (!Number.isFinite(ms(a.p_nuova_scade))) lancia("parametro_non_valido");
      if (o.stato_pagamento === "in_attesa") return { data: { esito: "riprova_in_corso" } };
      if (!["fallito", "scaduto"].includes(o.stato_pagamento)) lancia("ordine_non_riapribile");
      const n = (o.riprova_n ?? 0) + 1;
      tocca(o, { stato_pagamento: "in_attesa", riprova_n: n, scade_il: a.p_nuova_scade });
      evento(o, "riaperto", "cassa", { stato_pagamento: o.stato_pagamento }, { riprova_n: n });
      return { data: { esito: "riaperto", n } };
    }],
    /* shop_stripe_evento_registra(p_id text, p_tipo text, p_ordine uuid) → text 'nuovo'|'gia_elaborato'|'da_rielaborare'
     * shop_stripe_evento_chiudi(p_id text, p_esito text) → boolean (true se l'evento c'era) */
    shop_stripe_evento_registra: ["S4", (a) => {
      if (typeof a.p_id !== "string" || !a.p_id) lancia("parametro_non_valido");
      const e = righe("shop_stripe_eventi").find((x) => x.id === a.p_id);
      if (!e) { ins("shop_stripe_eventi", { id: a.p_id, tipo: a.p_tipo ?? null, ricevuto_il: adesso(), elaborato_il: null, esito: null, ordine_id: a.p_ordine ?? null }); return { data: "nuovo" }; }
      return { data: e.elaborato_il ? "gia_elaborato" : "da_rielaborare" };
    }],
    shop_stripe_evento_chiudi: ["S4", (a) => {
      const e = righe("shop_stripe_eventi").find((x) => x.id === a.p_id);
      if (!e) return { data: false };
      mod("shop_stripe_eventi", e, { elaborato_il: adesso(), esito: a.p_esito ?? null });
      return { data: true };
    }],
    /* shop_rimborso_prenota(p_ordine uuid, p_importo_cent int, p_motivo text, p_chiave text, p_chi text) → jsonb {esito: 'prenotato'|'esistente', id}
     *    sotto blocco: massimo = pagato − (rimborsi `richiesto` + `riuscito`); oltre → errore `rimborso_oltre_pagato`; stessa `chiave_richiesta` → la riga che c'è. */
    shop_rimborso_prenota: ["S4", (a) => {
      const o = ordineDi(a.p_ordine) ?? lancia("ordine_non_trovato");
      if (!Number.isInteger(a.p_importo_cent) || a.p_importo_cent <= 0 || !pieno(a.p_motivo) || !pieno(a.p_chiave)) lancia("rimborso_importo_non_valido");
      const gia = righe("shop_rimborsi").find((r) => r.chiave_richiesta === a.p_chiave);
      if (gia) return { data: { esito: "esistente", id: gia.id } };
      if (!["pagato", "rimborsato_in_parte", "rimborsato"].includes(o.stato_pagamento)) lancia("ordine_non_pagato");
      const impegnato = sommaCent(righe("shop_rimborsi").filter((r) => r.ordine_id === o.id && ["richiesto", "riuscito"].includes(r.stato)));
      if (a.p_importo_cent > pagatoCent(o) - impegnato) lancia("rimborso_oltre_pagato");
      const r = ins("shop_rimborsi", { ordine_id: o.id, importo_cent: a.p_importo_cent, motivo: a.p_motivo, stato: "richiesto", chiave_richiesta: a.p_chiave, origine: "crm", chi: chiDi(a.p_chi), stripe_rimborso_id: null });
      evento(o, "rimborso_richiesto", a.p_chi, null, { importo_cent: a.p_importo_cent, riga: r.id });
      return { data: { esito: "prenotato", id: r.id } };
    }],
    /* shop_rimborso_riconcilia(p_ordine uuid, p_rimborsi jsonb, p_chiudi_orfane boolean) → jsonb {rimborsato_cent, stato_pagamento}
     *    D46: p_rimborsi = l'ELENCO di Stripe [{id, amount, status, metadata:{riga_id}}]. Una riga si aggancia per `stripe_rimborso_id` o per `metadata.riga_id`;
     *    un rimborso che non conosciamo (fatto dal pannello Stripe) diventa una riga con origine 'stripe'. rimborsato_cent = somma dei `riuscito`;
     *    stato → rimborsato_in_parte / rimborsato / (tornato) pagato. Con p_chiudi_orfane: le righe `richiesto` senza rimborso su Stripe da più di 10 minuti → `fallito`. */
    shop_rimborso_riconcilia: ["S4", (a) => {
      const o = ordineDi(a.p_ordine) ?? lancia("ordine_non_trovato");
      if (!Array.isArray(a.p_rimborsi)) lancia("parametro_non_valido");
      const stato = (s) => (s === "succeeded" ? "riuscito" : s === "failed" || s === "canceled" ? "fallito" : "richiesto");
      const agganciate = new Set();
      for (const s of a.p_rimborsi) {
        if (!s || typeof s.id !== "string" || !Number.isInteger(s.amount) || s.amount <= 0) continue;
        const riga = righe("shop_rimborsi").find((r) => r.ordine_id === o.id && (r.stripe_rimborso_id === s.id || (s.metadata?.riga_id && r.id === s.metadata.riga_id)));
        if (riga) { agganciate.add(riga.id); mod("shop_rimborsi", riga, { stripe_rimborso_id: s.id, stato: stato(s.status), aggiornato_il: adesso() }); }
        else ins("shop_rimborsi", { ordine_id: o.id, importo_cent: s.amount, motivo: "Rimborso fatto dal pannello di Stripe", stato: stato(s.status), chiave_richiesta: null, stripe_rimborso_id: s.id, origine: "stripe", chi: "stripe" });
      }
      if (a.p_chiudi_orfane === true) {
        for (const r of righe("shop_rimborsi").filter((x) => x.ordine_id === o.id && x.stato === "richiesto" && !x.stripe_rimborso_id && !agganciate.has(x.id) && ms(adesso()) - ms(x.creato_il) > 10 * 60_000)) mod("shop_rimborsi", r, { stato: "fallito", aggiornato_il: adesso() });
      }
      const rimborsato = sommaCent(righe("shop_rimborsi").filter((r) => r.ordine_id === o.id && r.stato === "riuscito"));
      const nuovo = !["pagato", "rimborsato_in_parte", "rimborsato"].includes(o.stato_pagamento) ? o.stato_pagamento : rimborsato >= pagatoCent(o) && rimborsato > 0 ? "rimborsato" : rimborsato > 0 ? "rimborsato_in_parte" : "pagato";
      if (o.rimborsato_cent !== rimborsato || o.stato_pagamento !== nuovo) tocca(o, { rimborsato_cent: rimborsato, stato_pagamento: nuovo });
      return { data: { rimborsato_cent: rimborsato, stato_pagamento: nuovo } };
    }],
    /* shop_ordine_giacenza_rimetti(p_ordine uuid, p_chi text) → jsonb {esito: 'rimessa'|'gia_rimessa', pezzi}
     *    rimette SOLO ciò che i movimenti dell'ordine (ordine_ref, motivo 'ordine') dicono di aver tolto; idempotente per `giacenza_rimessa_il`. */
    shop_ordine_giacenza_rimetti: ["S4", (a) => {
      const o = ordineDi(a.p_ordine) ?? lancia("ordine_non_trovato");
      if (o.giacenza_rimessa_il) return { data: { esito: "gia_rimessa", pezzi: 0 } };
      const per = new Map();
      for (const m of righe("shop_giacenza_movimenti").filter((x) => x.ordine_ref === o.order_ref && x.motivo === "ordine")) per.set(m.variante_id, (per.get(m.variante_id) ?? 0) - m.delta);
      let pezzi = 0;
      for (const [variante, qty] of per) {
        if (qty <= 0) continue;
        const r = muovi(variante, qty, "annullo_ordine", null, a.p_chi, o.order_ref);
        if (r.error) throw new ErroreSql(r.error);
        pezzi += qty;
      }
      tocca(o, { giacenza_rimessa_il: adesso() });
      evento(o, "giacenza_rimessa", a.p_chi, null, { pezzi });
      return { data: { esito: "rimessa", pezzi } };
    }],
    /* shop_limite_consuma(p_chiave text, p_finestra_s int, p_max int) → boolean
     *    una riga per chiave; finestra scaduta → riparte da 1 (INSERT … ON CONFLICT DO UPDATE, nessun DELETE); oltre il massimo → false. */
    shop_limite_consuma: ["S4", (a) => {
      if (typeof a.p_chiave !== "string" || !a.p_chiave || !Number.isInteger(a.p_finestra_s) || a.p_finestra_s <= 0 || !Number.isInteger(a.p_max) || a.p_max <= 0) lancia("limite_non_valido");
      const r = righe("shop_limiti").find((x) => x.chiave === a.p_chiave);
      if (!r) { ins("shop_limiti", { chiave: a.p_chiave, finestra_inizio: adesso(), conteggio: 1 }); return { data: true }; }
      if (ms(adesso()) - ms(r.finestra_inizio) >= a.p_finestra_s * 1000) { mod("shop_limiti", r, { finestra_inizio: adesso(), conteggio: 1 }); return { data: true }; }
      if (r.conteggio >= a.p_max) return { data: false };
      mod("shop_limiti", r, { conteggio: r.conteggio + 1 });
      return { data: true };
    }],
    /* shop_cassa_righe(p_skus text[]) → jsonb [{sku, slug, nome, nome_variante, prezzo_cent, attiva, pubblicato, giacenza}] (SKU di VARIANTE, nell'ordine chiesto; quelli che non ci sono mancano)
     *    L'UNICA lettura della giacenza fuori dal CRM. `prezzo_cent` = prezzo effettivo (la variante, o in mancanza il prodotto). */
    shop_cassa_righe: ["S4", (a) => {
      if (!Array.isArray(a.p_skus)) lancia("parametro_non_valido");
      const fuori = [];
      for (const sku of [...new Set(a.p_skus)]) {
        const v = righe("shop_varianti").find((x) => x.sku === sku);
        if (!v) continue;
        const p = righe("shop_prodotti").find((x) => x.id === v.prodotto_id);
        fuori.push({ sku, slug: p?.slug ?? null, nome: p?.nome ?? null, nome_variante: v.nome ?? null, prezzo_cent: v.prezzo_cent ?? p?.prezzo_cent ?? null, attiva: v.attiva === true, pubblicato: p?.stato === "pubblicato", giacenza: v.giacenza });
      }
      return { data: fuori };
    }],
    /* ── S5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
     * shop_tariffa_imposta(p_id uuid, p_atteso timestamptz, p_campi jsonb, p_conferma boolean, p_chi text) → boolean
     *    confronto-e-scambio su `aggiornato_il`: valore visto vecchio → false, niente scritto. Campi ammessi: nome, corriere, costo_cent, gratis_da_cent,
     *    giorni_min, giorni_max, attiva (altri → errore `tariffa_campo_non_valido`). `p_conferma` → confermata_il = adesso e provvisoria = false.
     *    Una riga di `shop_storico` (entita 'tariffa') per campo cambiato. Nessuna modifica e nessuna conferma → false. */
    shop_tariffa_imposta: ["S5", (a) => {
      const t = righe("shop_spedizioni_tariffe").find((x) => x.id === a.p_id) ?? lancia("tariffa_inesistente");
      const campi = a.p_campi ?? {};
      if (Object.keys(campi).some((k) => !["nome", "corriere", "costo_cent", "gratis_da_cent", "giorni_min", "giorni_max", "attiva"].includes(k))) lancia("tariffa_campo_non_valido");
      if (ms(a.p_atteso) !== ms(t.aggiornato_il)) return { data: false };
      const cambi = Object.entries(campi).filter(([k, v]) => !uguali(t[k] ?? null, v ?? null));
      if (!cambi.length && a.p_conferma !== true) return { data: false };
      const prima = Object.fromEntries(cambi.map(([k]) => [k, t[k] ?? null]));
      mod("shop_spedizioni_tariffe", t, { ...Object.fromEntries(cambi), ...(a.p_conferma === true ? { confermata_il: adesso(), provvisoria: false } : {}), aggiornato_il: adesso() });
      for (const [k, v] of cambi) storico("tariffa", t.id, k, prima[k], v, a.p_chi);
      if (a.p_conferma === true) storico("tariffa", t.id, "confermata", null, true, a.p_chi);
      return { data: true };
    }],
    /* ── S6 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
     * shop_email_modello_salva(p_chiave text, p_atteso timestamptz, p_oggetto text, p_testo text, p_chi text) → boolean
     *    CAS su `aggiornato_il`; salvare SPEGNE il modello e TOGLIE l'approvazione. Riga di storico (entita 'email').
     * shop_email_modello_approva(p_chiave text, p_impronta text, p_chi text) → boolean
     *    l'impronta è quella del testo che l'approvatore ha visto (sha256 di «oggetto \n testo»); se il testo nel frattempo è cambiato → false.
     * shop_email_modello_acceso(p_chiave text, p_acceso boolean, p_chi text) → boolean (true se è cambiato)
     *    accendere: il DATABASE rifiuta se non è approvato (`modello_non_approvato`) o se ha un `{{` (`modello_con_segnaposto`), anche se approvato. Spegnere sempre. */
    shop_email_modello_salva: ["S6", (a) => {
      const m = righe("shop_email_modelli").find((x) => x.chiave === a.p_chiave) ?? lancia("modello_non_trovato");
      if (ms(a.p_atteso) !== ms(m.aggiornato_il)) return { data: false };
      const prima = { oggetto: m.oggetto, testo: m.testo, acceso: m.acceso };
      mod("shop_email_modelli", m, { oggetto: a.p_oggetto ?? "", testo: a.p_testo ?? "", acceso: false, approvato_da: null, approvato_il: null, approvato_hash: null, aggiornato_il: adesso() });
      storico("email", m.chiave, "testo", prima, { oggetto: m.oggetto, testo: m.testo, acceso: false }, a.p_chi);
      return { data: true };
    }],
    shop_email_modello_approva: ["S6", (a) => {
      const m = righe("shop_email_modelli").find((x) => x.chiave === a.p_chiave) ?? lancia("modello_non_trovato");
      if (a.p_impronta !== improntaModello(m)) return { data: false };
      mod("shop_email_modelli", m, { approvato_da: chiDi(a.p_chi), approvato_il: adesso(), approvato_hash: a.p_impronta, aggiornato_il: adesso() });
      storico("email", m.chiave, "approvato", null, { hash: a.p_impronta }, a.p_chi);
      return { data: true };
    }],
    shop_email_modello_acceso: ["S6", (a) => {
      const m = righe("shop_email_modelli").find((x) => x.chiave === a.p_chiave) ?? lancia("modello_non_trovato");
      if (a.p_acceso === true) {
        if (!m.approvato_hash || m.approvato_hash !== improntaModello(m)) lancia("modello_non_approvato");
        if (`${m.oggetto ?? ""}${m.testo ?? ""}`.includes("{{")) lancia("modello_con_segnaposto");
      }
      if (m.acceso === (a.p_acceso === true)) return { data: false };
      mod("shop_email_modelli", m, { acceso: a.p_acceso === true, aggiornato_il: adesso() });
      storico("email", m.chiave, "acceso", !(a.p_acceso === true), a.p_acceso === true, a.p_chi);
      return { data: true };
    }],
    /* shop_email_prenota(p_ordine uuid, p_chiave text) → boolean
     *    vero solo se non è già `inviata` e non è `in_invio` da meno di 5 minuti (oltre, si riprenota); dopo `errore` si può riprenotare. Scrive `in_invio`.
     * shop_email_esito(p_ordine uuid, p_chiave text, p_stato text, p_codice text) → boolean
     *    p_stato ∈ inviata|errore; `email_inviate[chiave] = {stato, il, codice}`. Riga di storico (entita 'email', id = ordine). */
    shop_email_prenota: ["S6", (a) => {
      const o = ordineDi(a.p_ordine) ?? lancia("ordine_non_trovato");
      if (typeof a.p_chiave !== "string" || !a.p_chiave) lancia("parametro_non_valido");
      const e = (o.email_inviate ?? {})[a.p_chiave];
      if (e?.stato === "inviata") return { data: false };
      if (e?.stato === "in_invio" && ms(adesso()) - ms(e.il) < 5 * 60_000) return { data: false };
      tocca(o, { email_inviate: { ...(o.email_inviate ?? {}), [a.p_chiave]: { stato: "in_invio", il: adesso(), codice: null } } });
      return { data: true };
    }],
    shop_email_esito: ["S6", (a) => {
      const o = ordineDi(a.p_ordine) ?? lancia("ordine_non_trovato");
      if (!["inviata", "errore"].includes(a.p_stato)) lancia("email_stato_non_valido");
      tocca(o, { email_inviate: { ...(o.email_inviate ?? {}), [a.p_chiave]: { stato: a.p_stato, il: adesso(), codice: a.p_codice ?? null } } });
      storico("email", o.id, a.p_chiave, null, { stato: a.p_stato, codice: a.p_codice ?? null }, "sistema");
      return { data: true };
    }],
  };
  /** A quale migrazione appartiene ogni funzione, e quale tabella dice che è applicata. */
  const GUIDA = { S4: "shop_stripe_sessioni", S5: "shop_spedizioni_tariffe", S6: "shop_email_modelli" };
  const applicata = (m) => !manca(GUIDA[m]) && !(m === "S4" && (senzaColonne.shop_orders ?? []).includes("stato_pagamento"));
  const ripristina = (copia) => { for (const k of Object.keys(dati)) delete dati[k]; Object.assign(dati, copia); };
  /** Una funzione di R2 come una transazione: errore → tutto annullato; `scrisse` = lo stato è cambiato davvero. */
  function transazione(f, args) {
    const prima = JSON.stringify(dati);
    const copia = structuredClone(dati);
    try {
      const r = f(args);
      if (r.error) { ripristina(copia); return r; }
      return { ...r, scrisse: JSON.stringify(dati) !== prima };
    } catch (e) {
      ripristina(copia);
      if (e instanceof ErroreSql) return { error: e.error };
      throw e;
    }
  }

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
        const r2 = R2[nome];
        if (mancante === true || (!funzioni[nome] && !r2) || (r2 && !applicata(r2[0]))) return { error: ERR("PGRST202", `Could not find the function public.${nome} in the schema cache`) };
        return r2 ? transazione(r2[1], args) : funzioni[nome](args);
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
        delete() {
          if (tab !== "shop_prodotti_categorie") throw new Error("il finto non cancella: nel negozio non si cancella mai (stato, rimosso_il)");
          q.op = "delete";
          return b;
        },
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
    if (CHIUSE.has(t) && q.op !== "select") return { error: ERR("42501", `permission denied for table ${t}`) }; // REVOKE ALL FROM service_role: si scrive solo con le funzioni
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

    if (q.op === "delete") {
      if (!q.filtri.length) throw new Error("delete senza filtri: il finto non cancella una tabella intera");
      const tolte = righe(t).filter((r) => passa(r, q.filtri));
      dati[t] = righe(t).filter((r) => !tolte.includes(r));
      return { ...(q.indietro ? risposta(tolte) : {}), scrisse: tolte.length > 0 };
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
