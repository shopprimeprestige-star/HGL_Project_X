/** ── E-COMMERCE · T8 · LE AZIONI SULL'ORDINE ───────────────────────────────
 *  `src/crm/ecommerce/azioni.ts` riceve l'ordine com'è e la richiesta della pagina e restituisce
 *  la patch da scrivere su `shop_orders`, le condizioni di concorrenza e l'evento per lo storico,
 *  oppure un errore leggibile. Dati inventati (`dati.mjs`): nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rigaOrdineProva } from "./dati.mjs";

const ID = "00000000-0000-4000-8000-000000000001";
const ADESSO = new Date("2026-11-18T12:00:00.000Z");
const LISTA_BIANCA = ["status", "pagato_il", "pagato_importo", "metodo_pagamento", "tracking", "note_interne", "lead_id", "senza_lead", "aggiornato_il"];

/** Congela in profondità: se il modulo prova a scrivere sull'ordine in ingresso, lancia. */
function congela(o) {
  Object.values(o).forEach((v) => v && typeof v === "object" && !Object.isFrozen(v) && congela(v));
  return Object.freeze(o);
}

export async function prove(mod, { c, gruppo, radice }) {
  const A = mod["ecommerce/azioni"];
  const { normalizzaOrdine } = mod["ecommerce/ordine"];
  const ordine = (extra = {}) => congela(normalizzaOrdine(rigaOrdineProva(extra)));
  const pagato = (extra = {}) => ordine({ pagato_il: "2026-11-17T15:00:00Z", pagato_importo: 24.9, metodo_pagamento: "bonifico", ...extra });
  const va = (a, o = ordine()) => A.costruisciAzione(a, o, ADESSO);
  const src = readFileSync(join(radice, "src/crm/ecommerce/azioni.ts"), "utf8");
  const chiavi = (r) => Object.keys(r.patch).sort();

  gruppo("E-COMMERCE · AZIONI SULL'ORDINE (18/11/2026)");

  //  ── cambio di stato ──
  const STATI = ["nuovo", "in_preparazione", "spedito", "consegnato", "annullato"];
  let ok = true;
  const sbagliati = [];
  for (const da of STATI) for (const a of STATI) {
    const r = va({ azione: "stato", ordineId: ID, da, a }, ordine({ status: da }));
    if (da === a ? !(r.ok === false && r.motivo === "nessun_cambio") : !(r.ok && r.patch.status === a && r.evento.tipo === "stato")) { ok = false; sbagliati.push(`${da}→${a}`); }
  }
  c("stato: ogni passaggio tra due stati diversi vale (anche all'indietro e verso annullato)", [true, []], [ok, sbagliati]);
  const st = va({ azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
  c("stato: patch con status e aggiornato_il", [["aggiornato_il", "status"], "spedito", ADESSO.toISOString()], [chiavi(st), st.patch.status, st.patch.aggiornato_il]);
  c("stato: condizione = lo stato visto", { status: "nuovo" }, st.condizioni);
  c("stato: evento con ordine, riferimento, prima e dopo", { order_id: ID, order_ref: "HG-PROVA1", tipo: "stato", prima: { stato: "nuovo" }, dopo: { stato: "spedito" } }, st.evento);
  c("stato: stesso stato → nessun_cambio", [false, "nessun_cambio"], (({ ok, motivo }) => [ok, motivo])(va({ azione: "stato", ordineId: ID, da: "nuovo", a: "nuovo" })));
  c("stato: «da» diverso da quello vero → conflitto", [false, "conflitto"], (({ ok, motivo }) => [ok, motivo])(va({ azione: "stato", ordineId: ID, da: "spedito", a: "consegnato" })));
  c("stato: «a» fuori elenco → valore", [false, "valore"], (({ ok, motivo }) => [ok, motivo])(va({ azione: "stato", ordineId: ID, da: "nuovo", a: "rimborsato" })));
  c("stato: «da» fuori elenco o mancante → valore", ["valore", "valore"], [va({ azione: "stato", ordineId: ID, da: "boh", a: "spedito" }), va({ azione: "stato", ordineId: ID, a: "spedito" })].map((r) => r.motivo));
  c("stato: la condizione segue il testo vero in tabella (stato sconosciuto letto come «nuovo»)", { status: "boh" },
    va({ azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }, ordine({ status: "boh" })).condizioni);
  c("stato: l'errore è un testo leggibile, in italiano", true, typeof va({ azione: "stato", ordineId: ID, da: "nuovo", a: "x" }).errore === "string" && va({ azione: "stato", ordineId: ID, da: "nuovo", a: "x" }).errore.length > 10);

  //  ── segna pagato ──
  const pg = va({ azione: "pagato", ordineId: ID, metodo: "bonifico" });
  c("pagato: importo di partenza = totale; data = adesso", [24.9, "bonifico", ADESSO.toISOString()], [pg.patch.pagato_importo, pg.patch.metodo_pagamento, pg.patch.pagato_il]);
  c("pagato: patch con le quattro chiavi", ["aggiornato_il", "metodo_pagamento", "pagato_importo", "pagato_il"].sort(), chiavi(pg));
  c("pagato: condizione = non ancora pagato", { pagato_il: null }, pg.condizioni);
  c("pagato: evento con prima vuoto e dopo pieno", [{ pagato_il: null, pagato_importo: null, metodo_pagamento: null }, { pagato_il: ADESSO.toISOString(), pagato_importo: 24.9, metodo_pagamento: "bonifico" }, "pagato"],
    [pg.evento.prima, pg.evento.dopo, pg.evento.tipo]);
  const pg2 = va({ azione: "pagato", ordineId: ID, metodo: "contanti", importo: 10.005, data: "2026-11-17T08:30:00Z" });
  c("pagato: importo e data scelti; importo al centesimo; data come ISO", [10.01, "2026-11-17T08:30:00.000Z"], [pg2.patch.pagato_importo, pg2.patch.pagato_il]);
  c("pagato: importo come testo con la virgola", 12.5, va({ azione: "pagato", ordineId: ID, metodo: "carta", importo: "12,50" }).patch.pagato_importo);
  c("pagato: importo vuoto = quello di partenza", 24.9, va({ azione: "pagato", ordineId: ID, metodo: "carta", importo: "" }).patch.pagato_importo);
  c("pagato: importo 0 e 100000 validi", [0, 100000], [0, 100000].map((importo) => va({ azione: "pagato", ordineId: ID, metodo: "altro", importo }).patch?.pagato_importo));
  c("pagato: ogni metodo dell'elenco vale", [true, true, true, true], ["bonifico", "contanti", "carta", "altro"].map((metodo) => va({ azione: "pagato", ordineId: ID, metodo }).ok));
  const val = (extra, o) => va({ azione: "pagato", ordineId: ID, metodo: "bonifico", ...extra }, o);
  for (const [nome, extra, o] of [
    ["metodo fuori elenco", { metodo: "baratto" }],
    ["metodo mancante", { metodo: undefined }],
    ["importo negativo", { importo: -1 }],
    ["importo NaN", { importo: NaN }],
    ["importo Infinity", { importo: Infinity }],
    ["importo enorme", { importo: 100000.01 }],
    ["importo 1e308", { importo: 1e308 }],
    ["importo non numero", { importo: "tanto" }],
    ["importo oggetto", { importo: {} }],
    ["data futura", { data: "2026-11-19T00:00:00Z" }],
    ["data illeggibile", { data: "ieri" }],
    ["data non testo", { data: 5 }],
    ["totale dell'ordine negativo e importo non dato", {}, ordine({ total: -50 })],
    ["totale dell'ordine enorme e importo non dato", {}, ordine({ total: 5e6 })],
  ]) {
    const r = val(extra, o);
    c(`pagato: ${nome} → valore`, [false, "valore"], [r.ok, r.motivo]);
  }
  c("pagato: con totale enorme basta dare l'importo", 90, val({ importo: 90 }, ordine({ total: 5e6 })).patch?.pagato_importo);
  c("pagato: data di pochi secondi nel futuro (orologio del browser) accettata", true, val({ data: "2026-11-18T12:00:20Z" }).ok);
  c("pagato: già pagato → conflitto", [false, "conflitto"], (({ ok, motivo }) => [ok, motivo])(val({}, pagato())));
  c("pagato: ordine annullato si può segnare pagato (D7)", true, val({}, ordine({ status: "annullato" })).ok);

  //  ── pagamento annullato ──
  const an = va({ azione: "pagamento_annullato", ordineId: ID }, pagato());
  c("pagamento annullato: azzera i tre campi", [null, null, null, ["aggiornato_il", "metodo_pagamento", "pagato_importo", "pagato_il"].sort()], [an.patch.pagato_il, an.patch.pagato_importo, an.patch.metodo_pagamento, chiavi(an)]);
  c("pagamento annullato: l'evento conserva metodo, importo e data", { pagato_il: "2026-11-17T15:00:00Z", pagato_importo: 24.9, metodo_pagamento: "bonifico" }, an.evento.prima);
  c("pagamento annullato: dopo vuoto, tipo e condizione", [{ pagato_il: null, pagato_importo: null, metodo_pagamento: null }, "pagamento_annullato", { pagato_il: "2026-11-17T15:00:00Z" }], [an.evento.dopo, an.evento.tipo, an.condizioni]);
  c("pagamento annullato: senza importo scritto l'evento conserva quello che contava (il totale)", 24.9, va({ azione: "pagamento_annullato", ordineId: ID }, ordine({ pagato_il: "2026-11-17T15:00:00Z" })).evento.prima.pagato_importo);
  const np = va({ azione: "pagamento_annullato", ordineId: ID });
  c("pagamento annullato: su ordine non pagato → errore", [false, "conflitto"], [np.ok, np.motivo]);

  //  ── tracking e nota interna ──
  const tr = va({ azione: "tracking", ordineId: ID, valore: "  TRK 123  " });
  c("tracking: scritto senza spazi ai bordi", [["aggiornato_il", "tracking"], "TRK 123", { tracking: null }], [chiavi(tr), tr.patch.tracking, tr.condizioni]);
  c("tracking: evento", { order_id: ID, order_ref: "HG-PROVA1", tipo: "tracking", prima: { tracking: null }, dopo: { tracking: "TRK 123" } }, tr.evento);
  c("tracking: vuoto cancella il numero (null) se c'era", [null, { tracking: "TRK1" }], (({ patch, condizioni }) => [patch.tracking, condizioni])(va({ azione: "tracking", ordineId: ID, valore: "   " }, ordine({ tracking: "TRK1" }))));
  c("tracking: vuoto quando non c'è → nessun_cambio", "nessun_cambio", va({ azione: "tracking", ordineId: ID, valore: "" }).motivo);
  c("tracking: uguale a quello che c'è → nessun_cambio", "nessun_cambio", va({ azione: "tracking", ordineId: ID, valore: "TRK1 " }, ordine({ tracking: "TRK1" })).motivo);
  c("tracking: 120 caratteri sì, 121 no", [true, "valore"], [va({ azione: "tracking", ordineId: ID, valore: "x".repeat(120) }).ok, va({ azione: "tracking", ordineId: ID, valore: "x".repeat(121) }).motivo]);
  c("tracking: non testo → valore", ["valore", "valore", "valore"], [5, null, undefined].map((valore) => va({ azione: "tracking", ordineId: ID, valore }).motivo));
  c("tracking: a capo e carattere nullo → valore (il nullo farebbe fallire il database)", ["valore", "valore"], ["AB\nCD", "AB\u0000CD"].map((valore) => va({ azione: "tracking", ordineId: ID, valore }).motivo));
  c("tracking: testo da 5 MB → valore, senza eccezioni", "valore", va({ azione: "tracking", ordineId: ID, valore: "x".repeat(5_000_000) }).motivo);

  const nt = va({ azione: "nota_interna", ordineId: ID, valore: "chiamare prima\nsecondo piano" });
  c("nota: scritta con gli a capo, evento con la nota", [["aggiornato_il", "note_interne"], "chiamare prima\nsecondo piano", "nota_interna", { note_interne: null }, { note_interne: "chiamare prima\nsecondo piano" }],
    [chiavi(nt), nt.patch.note_interne, nt.evento.tipo, nt.evento.prima, nt.evento.dopo]);
  c("nota: vuota cancella la nota", [null, { note_interne: "vecchia" }], (({ patch, condizioni }) => [patch.note_interne, condizioni])(va({ azione: "nota_interna", ordineId: ID, valore: "" }, ordine({ note_interne: "vecchia" }))));
  c("nota: 2000 caratteri sì, 2001 no", [true, "valore"], [va({ azione: "nota_interna", ordineId: ID, valore: "x".repeat(2000) }).ok, va({ azione: "nota_interna", ordineId: ID, valore: "x".repeat(2001) }).motivo]);
  c("nota: carattere nullo → valore; non testo → valore", ["valore", "valore"], ["a\u0000b", 42].map((valore) => va({ azione: "nota_interna", ordineId: ID, valore }).motivo));
  c("nota: uguale → nessun_cambio", "nessun_cambio", va({ azione: "nota_interna", ordineId: ID, valore: "vecchia" }, ordine({ note_interne: "vecchia" })).motivo);

  //  ── identificazione e azioni sconosciute ──
  for (const [nome, ordineId] of [["non UUID", "HG-PROVA1"], ["l'order_ref", "HG-PROVA1"], ["vuoto", ""], ["mancante", undefined], ["numero", 7], ["UUID con coda", `${ID}; drop`]]) {
    const r = va({ azione: "tracking", ordineId, valore: "X" });
    c(`ordineId ${nome} → valore`, [false, "valore"], [r.ok, r.motivo]);
  }
  c("ordineId UUID di un altro ordine → valore (non si scrive sull'ordine sbagliato)", "valore", va({ azione: "tracking", ordineId: "00000000-0000-4000-8000-000000000002", valore: "X" }).motivo);
  c("eUuid: maiuscole sì, testo no", [true, true, false, false], [A.eUuid(ID), A.eUuid(ID.toUpperCase()), A.eUuid("abc"), A.eUuid(null)]);
  for (const azione of ["elimina", "cancella", "delete", "rimuovi", "collega", "scollega", "senza_lead", "", "__proto__"]) {
    const r = va({ azione, ordineId: ID });
    c(`azione «${azione}» → azione_sconosciuta`, [false, "azione_sconosciuta"], [r.ok, r.motivo]);
  }
  c("richiesta non oggetto → valore, nessuna eccezione", ["valore", "valore", "valore", "valore"], [null, undefined, "stato", [1]].map((a) => va(a).motivo));
  c("azione non testo → azione_sconosciuta", "azione_sconosciuta", va({ azione: { x: 1 }, ordineId: ID }).motivo);
  c("D11: nessun nome esportato contiene elimina/cancella/delete/remove/rimuovi", [], Object.keys(A).filter((k) => /elimin|cancell|delete|remove|rimuov/i.test(k)));
  c("D11: nessuna istruzione di cancellazione nel sorgente (commenti tolti)", false, /\b(delete|DELETE|\.remove\()/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));

  //  ── regole che valgono per ogni azione ──
  const richieste = [
    { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" },
    { azione: "pagato", ordineId: ID, metodo: "carta" },
    { azione: "tracking", ordineId: ID, valore: "T1" },
    { azione: "nota_interna", ordineId: ID, valore: "n" },
  ];
  const tutte = [...richieste.map((r) => va(r)), va({ azione: "pagamento_annullato", ordineId: ID }, pagato())];
  c("ogni azione riuscita ha aggiornato_il = adesso", [true, true, true, true, true], tutte.map((r) => r.ok && r.patch.aggiornato_il === ADESSO.toISOString()));
  c("ogni patch usa solo chiavi della lista bianca", [], tutte.flatMap((r) => Object.keys(r.patch).filter((k) => !LISTA_BIANCA.includes(k))));
  c("la lista bianca esportata è quella del piano", [...LISTA_BIANCA].sort(), [...A.CHIAVI_PATCH].sort());
  c("ogni condizione parla di colonne della lista bianca", [], tutte.flatMap((r) => Object.keys(r.condizioni).filter((k) => !LISTA_BIANCA.includes(k))));
  c("ogni evento ha tipo, ordine e riferimento", [true, true, true, true, true], tutte.map((r) => typeof r.evento.tipo === "string" && r.evento.order_id === ID && r.evento.order_ref === "HG-PROVA1"));
  c("campi in più nella richiesta non entrano nella patch (nome, totale, righe, lead_id)", [["aggiornato_il", "tracking"], false],
    (() => { const r = va({ azione: "tracking", ordineId: ID, valore: "T", nome: "X", total: 1, items: [], lead_id: ID, status: "annullato" }); return [chiavi(r), "status" in r.patch]; })());
  c("l'ordine in ingresso non viene mutato (congelato: scrivere lancerebbe)", true, (() => {
    try { [...richieste.map((r) => va(r)), va({ azione: "pagamento_annullato", ordineId: ID }, pagato())]; return true; } catch { return false; }
  })());
  c("nessuna eccezione con richieste strane", true, (() => {
    try { for (const a of [{}, { azione: "stato" }, { azione: "pagato" }, { azione: "stato", ordineId: ID, da: {}, a: [] }, Object.create(null)]) va(a); return true; } catch { return false; }
  })());
  c("modulo puro: nessun import di React, Supabase o rete", false, /from\s+["'](react|@supabase|@\/integrations)|fetch\(|supabase/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
  c("nessuna chiave o segreto nel sorgente", false, /service_role|eyJ[A-Za-z0-9_-]{20,}|sk_live/.test(src));
}
