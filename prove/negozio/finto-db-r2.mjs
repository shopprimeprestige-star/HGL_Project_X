/** ── NEGOZIO · RILASCIO 2 · T40 · LA PROVA DEI FINTI (database di S4/S5/S6 e Stripe) ───────────────────
 *  Tutte le prove del R2 parlano con `_finto-db.mjs` e con `_stripe-finto.mjs`: se un finto sbaglia, mentono tutte.
 *  Qui si controlla che facciano ciò che fanno il database vero e Stripe, e si esegue l'ELENCO UNICO degli scenari dei soldi
 *  (`_scenari-soldi.json`, PIANO-R2 §4 e consiglio C1) che i file `prove/sql/*.sql` rifanno sul Postgres vero.
 *  Quando quei file esistono (T41-T43), si controlla anche che i marcatori `-- SCENARIO: <nome>` coincidano con l'elenco.
 *  ⚠️ Un finto che «copia» il SQL non prova il SQL: per questo lo scenario è scritto una volta sola, qui, e il SQL lo deve rifare. */
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb, CHIUSE, COLONNE_S4, ERRORI_SQL_R2, FUNZIONI_R2 } from "./_finto-db.mjs";
import { ordiniR1R2, conDefaultS4, righeSporche, partenzaDa, tariffaSeme, modelliEmailSeme, sessioneStripeProva, rimborsoStripeProva, eventoStripeProva } from "./_dati-r2.mjs";
import { stripeFinto, parsaForm, firmaStripe, eventoFirmato, CHIAVE_PROVA, SEGRETO_PROVA, T0 } from "./_stripe-finto.mjs";

// ── gli scenari: lettura, esecuzione, confronto ──────────────────────────────

/** I nomi dei marcatori `-- SCENARIO: nome` di un file SQL. */
export const marcatoriSql = (testo) => [...String(testo).matchAll(/^[ \t]*--[ \t]*SCENARIO:[ \t]*([a-z0-9_]+)[ \t]*$/gim)].map((m) => m[1]);

/** Confronto per sottoinsieme: gli oggetti hanno almeno le chiavi attese, le liste sono uguali per lunghezza e per elemento; `null` = null o assente. */
export function contiene(atteso, letto) {
  if (atteso === null) return letto === null || letto === undefined;
  if (Array.isArray(atteso)) return Array.isArray(letto) && letto.length === atteso.length && atteso.every((a, i) => contiene(a, letto[i]));
  if (typeof atteso === "object") return letto !== null && typeof letto === "object" && !Array.isArray(letto) && Object.keys(atteso).every((k) => contiene(atteso[k], letto[k]));
  if (typeof atteso === "number" && typeof letto === "number") return Math.abs(atteso - letto) < 0.005;
  return atteso === letto;
}
/** Sostituisce i valori «$nome» (cose salvate da un passo precedente), anche dentro oggetti e liste. */
const sostituisci = (v, salvati) => (typeof v === "string" && v.startsWith("$") && v.slice(1) in salvati ? salvati[v.slice(1)] : Array.isArray(v) ? v.map((x) => sostituisci(x, salvati)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sostituisci(x, salvati)])) : v);

export function leggiScenari(radice) {
  return JSON.parse(readFileSync(join(radice, "prove/negozio/_scenari-soldi.json"), "utf8"));
}

/** Esegue uno scenario sul finto. Restituisce una lista di `{ etichetta, atteso, letto }`: se la cosa è andata come previsto `letto` è uguale ad `atteso`. */
export async function eseguiScenario(sc, adesso0) {
  let ora = adesso0;
  const db = fintoDb({ tabelle: partenzaDa(sc.partenza, () => ora), adesso: () => ora });
  const salvati = {};
  const esiti = [];
  const metti = (etichetta, atteso, letto, ok) => esiti.push({ etichetta: `${sc.nome} · ${etichetta}`, atteso, letto: ok ? atteso : letto });
  let n = 0;
  for (const p of sc.passi) {
    if (p.adesso && !p.rpc && !p.insert) { ora = p.adesso; continue; }
    n++;
    if (p.insert) {
      const r = await db.from(p.insert.tabella).insert(p.insert.riga);
      if (p.errore_codice) metti(`${n}) insert in ${p.insert.tabella} → errore ${p.errore_codice}`, p.errore_codice, r.error?.code ?? null, r.error?.code === p.errore_codice);
      else metti(`${n}) insert in ${p.insert.tabella}: passa`, null, r.error, r.error === null);
      continue;
    }
    const args = sostituisci(p.args, salvati);
    const r = await db.rpc(p.rpc, args);
    if (p.errore || p.errore_codice) {
      if (p.errore) metti(`${n}) ${p.rpc} → errore «${p.errore}»`, p.errore, r.error?.message ?? null, r.error?.message === p.errore);
      if (p.errore && ERRORI_SQL_R2[p.errore]) metti(`${n}) ${p.rpc} → SQLSTATE ${ERRORI_SQL_R2[p.errore].code}`, ERRORI_SQL_R2[p.errore].code, r.error?.code ?? null, r.error?.code === ERRORI_SQL_R2[p.errore].code);
      if (p.errore_codice) metti(`${n}) ${p.rpc} → SQLSTATE ${p.errore_codice}`, p.errore_codice, r.error?.code ?? null, r.error?.code === p.errore_codice);
    } else {
      const atteso = sostituisci(p.atteso, salvati);
      const letto = r.error ? { errore: r.error.message } : r.data;
      metti(`${n}) ${p.rpc}`, atteso, letto, contiene(atteso, letto));
    }
    for (const [nome, percorso] of Object.entries(p.salva ?? {})) salvati[nome] = r.data?.[percorso];
  }
  const dove = (righe, filtro) => righe.filter((r) => Object.entries(filtro ?? {}).every(([k, v]) => (v === null ? r[k] == null : r[k] === v)));
  for (const k of sc.controlli) {
    if (k.ordine) {
      const o = db.tabelle.shop_orders.find((x) => x.id === k.ordine);
      const volte = (o?.avvisi ?? []).filter((a) => a.codice === k.avviso).length;
      metti(`avviso «${k.avviso}» ×${k.volte ?? 1}`, k.volte ?? 1, volte, volte === (k.volte ?? 1));
    } else if (k.conta !== undefined) {
      const trovate = dove(db.tabelle[k.tabella] ?? [], k.dove).length;
      metti(`${k.tabella} ${JSON.stringify(k.dove)}: ${k.conta} righe`, k.conta, trovate, trovate === k.conta);
    } else {
      const trovate = dove(db.tabelle[k.tabella] ?? [], k.dove);
      const atteso = sostituisci(k.atteso, salvati);
      const letto = trovate.length === 1 ? trovate[0] : { righe: trovate.length };
      const ok = trovate.length === 1 && contiene(atteso, trovate[0]);
      metti(`${k.tabella} ${JSON.stringify(k.dove)}`, atteso, ok ? atteso : Object.fromEntries(Object.keys(atteso).map((c) => [c, letto[c]])), ok);
    }
  }
  return esiti;
}

export async function prove(mod, { c, gruppo, radice }) {
  const elenco = leggiScenari(radice);

  // ═════ 1 · l'elenco unico degli scenari dei soldi, eseguito sul finto ═════
  gruppo("NEGOZIO R2 · GLI SCENARI DEI SOLDI SUL FINTO (21/11/2026)");
  const nomi = elenco.scenari.map((s) => s.nome);
  c("l'elenco ha scenari, tutti con un nome unico, minuscolo con trattini bassi", [true, true], [nomi.length >= 30, new Set(nomi).size === nomi.length && nomi.every((n) => /^[a-z0-9_]+$/.test(n))]);
  c("ogni scenario ha un file SQL fra i tre di T41-T43 e almeno un passo", true, elenco.scenari.every((s) => ["shop-pagamenti.sql", "shop-spedizioni.sql", "shop-email.sql"].includes(s.file) && s.passi.length > 0));
  const usate = new Set(elenco.scenari.flatMap((s) => s.passi.map((p) => p.rpc).filter(Boolean)));
  const tutte = Object.values(FUNZIONI_R2).flat();
  c("ogni funzione di S4/S5/S6 sta in almeno uno scenario", [], tutte.filter((f) => !usate.has(f)));
  c("nessuno scenario nomina una funzione che il finto non ha", [], [...usate].filter((f) => !tutte.includes(f)));
  for (const sc of elenco.scenari) for (const e of await eseguiScenario(sc, elenco.adesso)) c(e.etichetta, e.atteso, e.letto);
  // I casi che il piano chiede per nome (T40, «Prova»), ritrovati nell'elenco
  const ha = (nome) => nomi.includes(nome);
  c("T40: i casi di §4 (pagato due volte, importo diverso, ultimo pezzo, rimborso oltre il pagato, sessione sostituita, doppio pagamento, riprova con due clic) ci sono tutti",
    [], ["pagato_due_volte", "importo_diverso", "ultimo_pezzo", "rimborso_oltre_pagato", "sessione_sostituita", "doppio_pagamento", "riprova_due_clic"].filter((n) => !ha(n)));
  c("T40: riapri da pagato, limite a finestra scaduta, email prenotata due volte, rimessa idempotente: ci sono", [], ["riapri_da_pagato", "limite_finestra", "email_prenota_una_volta", "rimessa_idempotente", "rimessa_solo_dai_movimenti"].filter((n) => !ha(n)));

  // ═════ 2 · i file SQL, quando ci sono, rifanno gli stessi scenari ═════
  gruppo("NEGOZIO R2 · I MARCATORI DEGLI SCENARI NEI FILE SQL");
  for (const file of ["shop-pagamenti.sql", "shop-spedizioni.sql", "shop-email.sql"]) {
    const percorso = join(radice, "prove/sql", file);
    const attesi = elenco.scenari.filter((s) => s.file === file).map((s) => s.nome);
    if (!existsSync(percorso)) {
      console.log(`  --  SALTATA: prove/sql/${file} non c'è ancora (lo scrive il compito della sua migrazione): ${attesi.length} scenari da rifare lì`);
      continue;
    }
    const trovati = marcatoriSql(readFileSync(percorso, "utf8"));
    c(`${file}: ogni scenario dell'elenco ha il suo marcatore`, [], attesi.filter((n) => !trovati.includes(n)));
    c(`${file}: nessun marcatore che l'elenco non conosce o che appartiene a un altro file`, [], trovati.filter((n) => !attesi.includes(n)));
    c(`${file}: nessun marcatore doppio`, trovati.length, new Set(trovati).size);
  }

  // ═════ 3 · il finto database: ciò che gli scenari non dicono ═════
  gruppo("NEGOZIO R2 · IL FINTO DATABASE: TABELLE CHIUSE, MIGRAZIONI ASSENTI, REGOLE");
  const w = fintoDb({ tabelle: partenzaDa({ varianti: [{ sku: "PROVA-V1", giacenza: 5 }], ordini: [{ id: "00000000-0000-4000-8000-000000006001", ref: "HG-S001", totale_cent: 2890, righe: [{ sku: "PROVA-V1", qty: 1 }], sessioni: ["cs_test_a"] }] }) });
  for (const t of CHIUSE) {
    const ins = await w.from(t).insert({ id: "x", chiave: "x" });
    const upd = await w.from(t).update({ chiave: "y" }).eq("chiave", "x");
    const ups = await w.from(t).upsert({ id: "x", chiave: "x" });
    const leggi = await w.from(t).select("*");
    c(`${t}: dal client nessuna scrittura (42501), la lettura sì`, ["42501", "42501", "42501", null], [ins.error?.code, upd.error?.code, ups.error?.code, leggi.error]);
  }
  c("le tabelle dei soldi sono cinque (S4) e nessuna è una tabella di R1", [5, true], [CHIUSE.size, ![...CHIUSE].some((t) => ["shop_orders", "shop_varianti", "shop_prodotti", "shop_storico"].includes(t))]);
  let lancio = null;
  try { w.from("shop_rimborsi").delete(); } catch (e) { lancio = e.message; }
  c("nessuna cancellazione nemmeno sulle tabelle nuove: il finto lancia", true, /non cancella/.test(lancio ?? ""));

  const senzaS4 = fintoDb({ mancante: ["shop_stripe_sessioni"] });
  c("S4 assente (tabella nuova mancante): le sue funzioni non ci sono (PGRST202), la lettura dà 42P01", ["PGRST202", "PGRST202", "42P01"], [(await senzaS4.rpc("shop_ordine_pagato", {})).error?.code, (await senzaS4.rpc("shop_limite_consuma", {})).error?.code, (await senzaS4.from("shop_stripe_sessioni").select("*")).error?.code]);
  c("S4 assente: S5 e S6 sono indipendenti (le loro funzioni rispondono)", [false, false], [(await senzaS4.rpc("shop_tariffa_imposta", { p_id: "x" })).error?.code === "PGRST202", (await senzaS4.rpc("shop_email_prenota", { p_ordine: "x", p_chiave: "y" })).error?.code === "PGRST202"]);
  const senzaColonne = fintoDb({ tabelle: partenzaDa({ ordini: [{ id: "o1", ref: "R", totale_cent: 1 }] }), senzaColonne: { shop_orders: ["stato_pagamento", "totale_cent"] } });
  c("colonne di S4 assenti su shop_orders: le funzioni non ci sono, leggerle dà 42703, scriverle PGRST204", ["PGRST202", "42703", "PGRST204"], [(await senzaColonne.rpc("shop_ordine_pagato", {})).error?.code, (await senzaColonne.from("shop_orders").select("stato_pagamento")).error?.code, (await senzaColonne.from("shop_orders").update({ totale_cent: 5 }).eq("id", "o1")).error?.code]);
  c("tutto assente (mancante: true): nessuna delle funzioni di R2 risponde", [], await (async () => { const t = fintoDb({ mancante: true }); const fuori = []; for (const f of tutte) if ((await t.rpc(f, {})).error?.code !== "PGRST202") fuori.push(f); return fuori; })());
  c("una funzione che non c'è, con tutto applicato, dà PGRST202", "PGRST202", (await w.rpc("shop_funzione_inventata", {})).error?.code);

  const r = fintoDb({ tabelle: { shop_orders: [] } });
  await r.from("shop_orders").insert({ id: "a", order_ref: "HG-1", canale: null });
  await r.from("shop_orders").insert({ id: "b", order_ref: "HG-1", canale: null });
  const sito1 = await r.from("shop_orders").insert({ id: "c", order_ref: "HG-2", canale: "sito" });
  const sito2 = await r.from("shop_orders").insert({ id: "d", order_ref: "HG-2", canale: "sito" });
  c("order_ref: unico solo dove canale='sito' (le righe vecchie con lo stesso riferimento passano)", [null, "23505", 3], [sito1.error, sito2.error?.code, r.tabelle.shop_orders.length]);
  c("stripe_sessione_id unico fra gli ordini (le righe vecchie, vuote, non confliggono)", ["23505", null], [await (async () => { await r.from("shop_orders").update({ stripe_sessione_id: "cs_1" }).eq("id", "a"); return (await r.from("shop_orders").update({ stripe_sessione_id: "cs_1" }).eq("id", "b")).error?.code; })(), (await r.from("shop_orders").update({ stripe_sessione_id: null }).eq("id", "b")).error]);
  c("stato_pagamento fuori dai sette valori: CHECK (23514); vuoto o uno dei sette passa", ["23514", null, null], [(await r.from("shop_orders").update({ stato_pagamento: "boh" }).eq("id", "a")).error?.code, (await r.from("shop_orders").update({ stato_pagamento: "pagato" }).eq("id", "a")).error, (await r.from("shop_orders").update({ stato_pagamento: null }).eq("id", "a")).error]);
  const dopoS4 = fintoDb({ tabelle: { shop_orders: [] } });
  const nuova = (await dopoS4.from("shop_orders").insert({ id: "n1", order_ref: "HG-9" }).select("*").single()).data;
  c("dopo S4 una riga vecchia nasce coi default di S4 (prova=false, rimborsato_cent=0, stato_pagamento vuoto, avvisi [])", [false, 0, null, [], {}], [nuova.prova, nuova.rimborsato_cent, nuova.stato_pagamento, nuova.avvisi, nuova.email_inviate]);
  c("le colonne di S4 sono 28 e la seconda forma della fotografia le porta tutte", [28, true], [Object.keys(COLONNE_S4).length, Object.keys(COLONNE_S4).every((k) => k in conDefaultS4({}))]);
  const reg = fintoDb({ tabelle: partenzaDa({ ordini: [{ id: "o1", ref: "R", totale_cent: 100 }] }) });
  await reg.rpc("shop_ordine_pagato", { p_ordine: "x" });
  await reg.rpc("shop_stripe_evento_registra", { p_id: "evt_1", p_tipo: "t", p_ordine: null });
  c("le chiamate rpc finiscono nel registro; `scritture` conta solo quelle che hanno scritto", [2, 1, "rpc.shop_stripe_evento_registra"], [reg.chiamate, reg.scritture.length, reg.registro[1].chiave]);
  const roll = await eseguiScenario({
    nome: "rollback", partenza: { ordini: [{ id: "00000000-0000-4000-8000-000000006001", ref: "HG-S001", totale_cent: 100, sessioni: ["cs_test_a"] }, { id: "00000000-0000-4000-8000-000000006002", ref: "HG-S002", totale_cent: 100, sessioni: [], campi: { stripe_sessione_id: "cs_test_x" } }] },
    passi: [{ rpc: "shop_ordine_sessione_registra", args: { p_ordine: "00000000-0000-4000-8000-000000006001", p_sessione: "cs_test_x" }, errore_codice: "23505" }],
    controlli: [{ tabella: "shop_stripe_sessioni", dove: { sessione_id: "cs_test_x" }, conta: 0 }, { tabella: "shop_stripe_sessioni", dove: {}, conta: 1 }],
  }, elenco.adesso);
  for (const e of roll) c(`transazione: ${e.etichetta.replace("rollback · ", "")} (la sessione scritta prima dell'errore non resta)`, e.atteso, e.letto);

  // ═════ 4 · i dati inventati ═════
  gruppo("NEGOZIO R2 · I DATI INVENTATI");
  const ordini = ordiniR1R2();
  c("40 ordini, id unici, ogni chiamata dà gli stessi dati (nessun caso, nessun orologio)", [40, 40, true], [ordini.length, new Set(ordini.map((o) => o.id)).size, JSON.stringify(ordini) === JSON.stringify(ordiniR1R2())]);
  const STATI = ["nuovo", "in_preparazione", "spedito", "consegnato", "annullato"];
  c("ogni stato ha ordini con e senza `pagato_il` (almeno 3 + 3)", [], STATI.filter((s) => ordini.filter((o) => o.status === s && o.pagato_il).length < 3 || ordini.filter((o) => o.status === s && !o.pagato_il).length < 3));
  c("tutto di fantasia: email @example.com, telefoni +39 300 000, nessun prefisso di chiave", [true, true], [ordini.every((o) => /@example\.com\s*$/i.test(o.email)), ordini.every((o) => /^(\+39 )?300 000 \d{4}$/.test(o.telefono))]);
  c("la seconda forma = la prima + le 28 colonne di S4 ai loro default; le colonne di prima non cambiano", [true, true], [ordini.every((o) => Object.keys(conDefaultS4(o)).length === Object.keys(o).length + 28), ordini.every((o) => Object.entries(o).every(([k, v]) => JSON.stringify(conDefaultS4(o)[k]) === JSON.stringify(v)))]);
  c("righe sporche: 8 da scartare e una buona", [8, true], [righeSporche().length - 1, righeSporche().at(-1).id === ordini[0].id]);
  c("semi di S5 e S6: tariffa 490 provvisoria; cinque modelli spenti, tutti col segnaposto, nessuno approvato", [490, true, 5, true], [tariffaSeme().costo_cent, tariffaSeme().provvisoria === true && tariffaSeme().attiva === true, modelliEmailSeme().length, modelliEmailSeme().every((m) => m.acceso === false && m.testo.includes("{{da confermare}}") && m.approvato_hash === null)]);
  const fonti = ["_finto-db.mjs", "_dati-r2.mjs", "_stripe-finto.mjs", "finto-db-r2.mjs", "conti-invariati.mjs", "_scenari-soldi.json", "_conti-oro.json"].filter((f) => existsSync(join(radice, "prove/negozio", f))).map((f) => readFileSync(join(radice, "prove/negozio", f), "utf8")).join("\n");
  c("nessuna stringa che somigli a una chiave (sk_/rk_/whsec_ + 16 segni) nei file dei finti, scenari e fotografia", false, /\b(sk|rk|whsec)_(test_|live_)?[A-Za-z0-9]{16,}/.test(fonti));
  c("la chiave e il segreto di prova sono riconoscibili come tali", [true, true], [/^sk_test_/.test(CHIAVE_PROVA), /^whsec_/.test(SEGRETO_PROVA)]);

  // ═════ 5 · Stripe finto ═════
  gruppo("NEGOZIO R2 · STRIPE FINTO (FIRME, SESSIONI, IDEMPOTENZA, RIMBORSI)");
  const intest = (extra = {}) => ({ authorization: `Bearer ${CHIAVE_PROVA}`, "content-type": "application/x-www-form-urlencoded", ...extra });
  const URL_API = "https://api.stripe.com";
  const corpoSessione = (extra = {}) => new URLSearchParams({
    mode: "payment", success_url: "https://sito.esempio/shop/ordine/HG-1?t=k", cancel_url: "https://sito.esempio/shop/checkout?annullato=1", client_reference_id: "ord-1",
    "metadata[ordine_id]": "ord-1", "line_items[0][price_data][currency]": "eur", "line_items[0][price_data][unit_amount]": "2890", "line_items[0][price_data][product_data][name]": "Crema & siero [prova]",
    "line_items[0][quantity]": "2", "shipping_options[0][shipping_rate_data][fixed_amount][amount]": "490", "shipping_options[0][shipping_rate_data][fixed_amount][currency]": "eur", expires_at: String(T0 + 1860), ...extra,
  }).toString();

  // firme: il vettore si calcola con un'altra strada (node:crypto), non con `crypto.subtle` come il finto
  const corpoTesto = JSON.stringify(eventoStripeProva("checkout.session.completed", sessioneStripeProva()));
  const attesa = createHmac("sha256", SEGRETO_PROVA).update(`${T0}.${corpoTesto}`).digest("hex");
  c("firmaStripe = HMAC-SHA256 di «t.corpo» col segreto (rifatto con node:crypto), nel formato t=…,v1=…", `t=${T0},v1=${attesa}`, await firmaStripe(corpoTesto, SEGRETO_PROVA, T0));
  const f1 = await eventoFirmato(eventoStripeProva("charge.refunded", {}), { t: T0 });
  const f2 = await eventoFirmato(eventoStripeProva("charge.refunded", {}), { t: T0, bom: true });
  c("eventoFirmato: il corpo è in byte; un BOM davanti ai byte cambia la firma", [true, true, true], [f1.corpo instanceof Uint8Array, f2.corpo[0] === 0xef && f2.corpo.length === f1.corpo.length + 3, f1.intestazione !== f2.intestazione]);
  c("un segreto diverso o un istante diverso danno una firma diversa", [true, true], [(await firmaStripe(corpoTesto, "altro", T0)) !== (await firmaStripe(corpoTesto, SEGRETO_PROVA, T0)), (await firmaStripe(corpoTesto, SEGRETO_PROVA, T0 + 1)) !== (await firmaStripe(corpoTesto, SEGRETO_PROVA, T0))]);

  // lettura dei corpi
  c("parsaForm: parentesi quadre, liste, virgolette codificate, `&` e `[` dentro un valore", { a: { b: ["x", "y"] }, e: ["1", "2"], nome: "Crema & siero [prova]", l: [{ p: { u: "5" } }] },
    parsaForm(new URLSearchParams([["a[b][0]", "x"], ["a[b][1]", "y"], ["e[]", "1"], ["e[]", "2"], ["nome", "Crema & siero [prova]"], ["l[0][p][u]", "5"]]).toString()));

  const s = stripeFinto();
  const crea = (extra = {}, chiave = "sessione-1-a-r0") => s.fetch(`${URL_API}/v1/checkout/sessions`, { method: "POST", headers: intest({ "idempotency-key": chiave, "stripe-version": "versione-di-prova" }), body: corpoSessione(extra) });
  const r1 = await crea();
  const sess1 = await r1.json();
  c("creare una sessione: 200, url di checkout.stripe.com, importo = righe + spedizione, id dell'ordine e scadenza riportati", [200, true, 2890 * 2 + 490, "ord-1", { ordine_id: "ord-1" }, T0 + 1860, "open", "unpaid"],
    [r1.status, sess1.url.startsWith("https://checkout.stripe.com/"), sess1.amount_total, sess1.client_reference_id, sess1.metadata, sess1.expires_at, sess1.status, sess1.payment_status]);
  const r2 = await crea();
  c("stessa chiave e stesso corpo: la STESSA sessione (e nessuna nuova)", [sess1.id, "true", 1], [(await r2.json()).id, r2.headers.get("idempotent-replayed"), s.sessioni().length]);
  const r3 = await crea({ client_reference_id: "ord-2" });
  c("stessa chiave con un corpo diverso: 400 `idempotency_error` (non un rifiuto vero), nessuna sessione in più", [400, "idempotency_error", 1], [r3.status, (await r3.json()).error.type, s.sessioni().length]);
  const sess4 = await (await crea({}, "sessione-1-a-r1")).json();
  c("chiave nuova: una sessione nuova", [true, 2], [sess4.id !== sess1.id, s.sessioni().length]);
  c("il registro porta chiave di idempotenza, versione e corpo riletto; l'intestazione Authorization è mascherata e la chiave non compare in nessun registro", [true, "versione-di-prova", "Crema & siero [prova]", "Bearer ***", false],
    [s.chiamate[0].chiaveIdempotenza === "sessione-1-a-r0", s.chiamate[0].versioneApi, s.chiamate[0].corpo.line_items[0].price_data.product_data.name, s.chiamate[0].intestazioni.authorization, JSON.stringify(s.chiamate).includes(CHIAVE_PROVA)]);
  const senzaChiave = await s.fetch(`${URL_API}/v1/checkout/sessions`, { method: "POST", headers: { authorization: "Bearer altra", "content-type": "application/x-www-form-urlencoded" }, body: corpoSessione() });
  c("chiave sbagliata → 401; corpo incompleto → 400; altro indirizzo → il finto lancia (nessuna rete vera)", [401, 400, true],
    [senzaChiave.status, (await s.fetch(`${URL_API}/v1/checkout/sessions`, { method: "POST", headers: intest(), body: "mode=payment" })).status, await s.fetch("https://example.com/x").then(() => false, () => true)]);
  c("leggere una sessione: la stessa; una che non esiste: 404 resource_missing", [sess1.id, 404, "resource_missing"], await (async () => {
    const x = await s.fetch(`${URL_API}/v1/checkout/sessions/${sess1.id}`, { headers: intest() });
    const y = await s.fetch(`${URL_API}/v1/checkout/sessions/cs_test_nonesiste`, { headers: intest() });
    return [(await x.json()).id, y.status, (await y.json()).error.code];
  })());
  const scad = await s.fetch(`${URL_API}/v1/checkout/sessions/${sess1.id}/expire`, { method: "POST", headers: intest() });
  const scad2 = await s.fetch(`${URL_API}/v1/checkout/sessions/${sess1.id}/expire`, { method: "POST", headers: intest() });
  c("far scadere una sessione aperta: expired; una già scaduta: 400", ["expired", 400], [(await scad.json()).status, scad2.status]);

  // pagamento e rimborsi
  const pagata = s.paga(sess4.id, { metodo: "card" });
  const pi = pagata.payment_intent;
  c("pagare la sessione: complete e paid, nasce il payment_intent", ["complete", "paid", true], [pagata.status, pagata.payment_status, /^pi_/.test(pi)]);
  const dettaglio = await (await s.fetch(`${URL_API}/v1/payment_intents/${pi}?expand[]=latest_charge`, { headers: intest() })).json();
  const dettaglioBreve = await (await s.fetch(`${URL_API}/v1/payment_intents/${pi}`, { headers: intest() })).json();
  c("payment_intent: con expand[]=latest_charge porta la carica e il metodo, senza expand solo l'id", ["card", "string"], [dettaglio.latest_charge.payment_method_details.type, typeof dettaglioBreve.latest_charge]);
  const rimb = (importo, chiave, extra = {}) => s.fetch(`${URL_API}/v1/refunds`, { method: "POST", headers: intest({ "idempotency-key": chiave }), body: new URLSearchParams({ payment_intent: pi, amount: String(importo), "metadata[riga_id]": chiave, ...extra }).toString() });
  const ra = await rimb(1000, "riga-1");
  const rb = await rimb(1000, "riga-1");
  c("rimborso: id re_, metadati riportati; la stessa chiave dà lo stesso rimborso (uno solo in elenco)", [200, true, { riga_id: "riga-1" }, true, 1], [ra.status, /^re_/.test((await ra.clone().json()).id), (await ra.clone().json()).metadata, (await ra.json()).id === (await rb.json()).id, s.rimborsi().length]);
  const troppo = await rimb(2890 * 2 + 490, "riga-2");
  c("rimborso oltre il pagato: 400 amount_too_large", [400, "amount_too_large"], [troppo.status, (await troppo.json()).error.code]);
  const pannello = s.rimborsaDalPannello(pi, 500);
  const lista = await (await s.fetch(`${URL_API}/v1/refunds?payment_intent=${pi}&limit=100`, { headers: intest() })).json();
  c("un rimborso fatto dal pannello Stripe si vede nell'elenco (senza i nostri metadati), dal più recente", [2, pannello.id, {}, false], [lista.data.length, lista.data[0].id, lista.data[0].metadata, lista.has_more]);

  // elenco con 150 rimborsi: due pagine
  const g = stripeFinto();
  const rg = await (await g.fetch(`${URL_API}/v1/checkout/sessions`, { method: "POST", headers: intest(), body: corpoSessione({ "line_items[0][price_data][unit_amount]": "100000" }) })).json();
  const pig = g.paga(rg.id).payment_intent;
  for (let i = 0; i < 150; i++) await g.fetch(`${URL_API}/v1/refunds`, { method: "POST", headers: intest({ "idempotency-key": `r-${i}` }), body: new URLSearchParams({ payment_intent: pig, amount: "1", "metadata[riga_id]": `r-${i}` }).toString() });
  const p10 = await (await g.fetch(`${URL_API}/v1/refunds?payment_intent=${pig}`, { headers: intest() })).json();
  const p100 = await (await g.fetch(`${URL_API}/v1/refunds?payment_intent=${pig}&limit=100`, { headers: intest() })).json();
  const pag2 = await (await g.fetch(`${URL_API}/v1/refunds?payment_intent=${pig}&limit=100&starting_after=${p100.data.at(-1).id}`, { headers: intest() })).json();
  c("elenco rimborsi: senza limit 10 e has_more; limit=100 → 100 e has_more; la seconda pagina → 50 e basta; nessun doppione", [10, true, 100, true, 50, false, 150], [p10.data.length, p10.has_more, p100.data.length, p100.has_more, pag2.data.length, pag2.has_more, new Set([...p100.data, ...pag2.data].map((x) => x.id)).size]);
  c("l'elenco filtra per payment_intent", 0, (await (await g.fetch(`${URL_API}/v1/refunds?payment_intent=pi_altro`, { headers: intest() })).json()).data.length);

  // guasti
  const h = stripeFinto();
  h.fallisci("POST /v1/refunds", { stato: 402, errore: { type: "card_error", code: "card_declined" } });
  const rifiuto = await h.fetch(`${URL_API}/v1/refunds`, { method: "POST", headers: intest(), body: "payment_intent=pi_1&amount=1" });
  const corpoRifiuto = await rifiuto.json();
  c("guasto programmato: 402 con type e code, e solo una volta (poi risponde come sempre)", [402, "card_error", "card_declined", 400], [rifiuto.status, corpoRifiuto.error.type, corpoRifiuto.error.code, (await h.fetch(`${URL_API}/v1/refunds`, { method: "POST", headers: intest(), body: "payment_intent=pi_1&amount=1" })).status]);
  h.fallisci("GET /v1/checkout/sessions", { rete: true });
  c("guasto di rete: il fetch lancia un TypeError come un fetch vero", "TypeError", await h.fetch(`${URL_API}/v1/checkout/sessions`, { headers: intest() }).then(() => "nessuno", (e) => e.name));
  h.fallisci("GET /v1/checkout/sessions", { timeout: true });
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 20);
  c("timeout: non risponde mai; finisce solo se il codice abortisce il suo signal (AbortError), e senza signal rifiuta lo stesso", ["AbortError", true], [
    await h.fetch(`${URL_API}/v1/checkout/sessions`, { headers: intest(), signal: ac.signal }).then(() => "nessuno", (e) => e.name),
    (h.fallisci("GET /v1/checkout/sessions", { timeout: true }), await h.fetch(`${URL_API}/v1/checkout/sessions`, { headers: intest() }).then(() => false, () => true))]);
  c("un guasto riguarda solo la chiamata dichiarata (le altre passano)", 200, (await h.fetch(`${URL_API}/v1/checkout/sessions?limit=1`, { headers: intest() })).status);
  c("le forme di Stripe inventate dei dati sono coerenti (sessione, rimborso, evento)", [true, true, "checkout.session.completed", true], [sessioneStripeProva().url.startsWith("https://checkout.stripe.com/"), /^re_/.test(rimborsoStripeProva().id), eventoStripeProva("checkout.session.completed", {}).type, eventoStripeProva("x", { a: 1 }).data.object.a === 1]);
}
