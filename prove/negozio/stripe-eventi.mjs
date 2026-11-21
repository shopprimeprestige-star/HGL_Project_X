/** ── NEGOZIO · RILASCIO 2 · T44 · LA LETTURA DEGLI EVENTI DEL WEBHOOK ─────────────────────────────────
 *  `src/shop/stripe/eventi.ts`: `leggiEvento(json)` → una forma interna tipata (`tipo` = il tipo di Stripe) oppure `{tipo:"sconosciuto"}`.
 *  Non lancia MAI (il webhook risponde 200 a ciò che non gestisce, 400/500 solo per firma e database). Porta fuori solo ciò che serve a
 *  `shop_ordine_pagato`, `shop_ordine_chiudi` e alla riconciliazione dei rimborsi: nessun dato del cliente (email, telefono, indirizzo, nome).
 *  Gli eventi sono inventati (`_dati-r2.mjs`), nella forma dei documenti di Stripe. */
import { eventoStripeProva, sessioneStripeProva, rimborsoStripeProva } from "./_dati-r2.mjs";
import { uuid } from "./dati.mjs";

export async function prove(mod, { c, gruppo }) {
  const E = mod["shop/stripe/eventi"];
  gruppo("SHOP R2 · T44 · EVENTI DEL WEBHOOK STRIPE (21/11/2026)");
  c("il modulo c'è", true, !!E);
  if (!E) return;
  const { leggiEvento: leggi } = E;
  const ORDINE = uuid(0x6001);

  /* ── le quattro sessioni ── */
  const pagata = sessioneStripeProva({ status: "complete", payment_status: "paid", payment_intent: "pi_prova0000000001" });
  const completato = leggi(eventoStripeProva("checkout.session.completed", pagata));
  c("checkout.session.completed (paid)", { tipo: "checkout.session.completed", id: "evt_prova0000000001", livemode: false, creato: 1795260000 }, { tipo: completato.tipo, id: completato.id, livemode: completato.livemode, creato: completato.creato });
  c("la sessione: id, ordine, stato di pagamento, payment_intent, importo e valuta", { id: "cs_test_prova0000000001", ordineId: ORDINE, pagamento: "paid", paymentIntent: "pi_prova0000000001", importoCent: 2890, valuta: "eur" },
    { id: completato.sessione?.id, ordineId: completato.sessione?.ordineId, pagamento: completato.sessione?.pagamento, paymentIntent: completato.sessione?.paymentIntent, importoCent: completato.sessione?.importoCent, valuta: completato.sessione?.valuta });
  const inCorso = leggi(eventoStripeProva("checkout.session.completed", sessioneStripeProva({ payment_status: "unpaid", status: "complete" })));
  c("completed con payment_status unpaid (metodo ritardato) → pagamento 'unpaid'", "unpaid", inCorso.sessione?.pagamento);
  for (const t of ["checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"]) {
    const e = leggi(eventoStripeProva(t, sessioneStripeProva()));
    c(`${t} → letto`, [t, ORDINE], [e.tipo, e.sessione?.ordineId]);
  }
  c("l'ordine si trova da client_reference_id", ORDINE, leggi(eventoStripeProva("checkout.session.expired", sessioneStripeProva({ client_reference_id: ORDINE, metadata: {} }))).sessione?.ordineId);
  c("ripiego: metadata[ordine_id] se manca client_reference_id", ORDINE, leggi(eventoStripeProva("checkout.session.expired", sessioneStripeProva({ client_reference_id: null, metadata: { ordine_id: ORDINE } }))).sessione?.ordineId);
  c("senza nessuno dei due → ordineId null (il webhook scrive l'avviso)", null, leggi(eventoStripeProva("checkout.session.expired", sessioneStripeProva({ client_reference_id: null, metadata: {} }))).sessione?.ordineId);
  c("payment_intent espanso (oggetto) → l'id", "pi_espanso", leggi(eventoStripeProva("checkout.session.completed", sessioneStripeProva({ payment_intent: { id: "pi_espanso" } }))).sessione?.paymentIntent);
  c("payment_intent assente → null", null, leggi(eventoStripeProva("checkout.session.expired", sessioneStripeProva({ payment_intent: null }))).sessione?.paymentIntent);
  c("importo non intero (12.5) → null (mai pagare sulla parola)", null, leggi(eventoStripeProva("checkout.session.completed", sessioneStripeProva({ amount_total: 12.5 }))).sessione?.importoCent);
  c("importo scritto come testo → null", null, leggi(eventoStripeProva("checkout.session.completed", sessioneStripeProva({ amount_total: "2890" }))).sessione?.importoCent);
  c("importo negativo → null", null, leggi(eventoStripeProva("checkout.session.completed", sessioneStripeProva({ amount_total: -5 }))).sessione?.importoCent);
  c("valuta in maiuscolo → minuscola", "eur", leggi(eventoStripeProva("checkout.session.completed", sessioneStripeProva({ currency: "EUR" }))).sessione?.valuta);
  c("livemode vero resta vero", true, leggi(eventoStripeProva("checkout.session.completed", pagata, { livemode: true })).livemode);

  /* ── nessun dato del cliente esce ── */
  const conDati = sessioneStripeProva({
    status: "complete", payment_status: "paid", payment_intent: "pi_prova0000000001",
    customer_email: "mario.rossi@esempio.test", customer_details: { email: "mario.rossi@esempio.test", name: "Mario Rossi", phone: "+393391234567", address: { line1: "Via Roma 1", city: "Roma", postal_code: "00100" } },
    shipping_details: { name: "Mario Rossi", address: { line1: "Via Roma 1", city: "Roma" } }, url: "https://checkout.stripe.com/c/pay/x",
  });
  const senzaDati = JSON.stringify(leggi(eventoStripeProva("checkout.session.completed", conDati)));
  c("nessun dato del cliente nell'uscita (email, nome, telefono, indirizzo)", false, /mario|rossi|esempio\.test|3391234567|Via Roma|Roma|00100|checkout\.stripe/i.test(senzaDati));

  /* ── rimborsi e contestazioni ── */
  const charge = { id: "ch_prova0000000001", object: "charge", payment_intent: "pi_prova0000000001", amount: 2890, amount_refunded: 1000, metadata: { ordine_id: ORDINE } };
  const cr = leggi(eventoStripeProva("charge.refunded", charge));
  c("charge.refunded → pagamento e ordine (dai metadata del pagamento)", ["charge.refunded", "pi_prova0000000001", ORDINE], [cr.tipo, cr.paymentIntent, cr.ordineId]);
  const ru = leggi(eventoStripeProva("refund.updated", rimborsoStripeProva()));
  c("refund.updated → pagamento", ["refund.updated", "pi_prova0000000001", null], [ru.tipo, ru.paymentIntent, ru.ordineId]);
  const rf = leggi(eventoStripeProva("refund.failed", rimborsoStripeProva({ status: "failed", metadata: { ordine_id: ORDINE, riga_id: uuid(0x7001) } })));
  c("refund.failed → pagamento e ordine dai metadata del rimborso", ["refund.failed", ORDINE], [rf.tipo, rf.ordineId]);
  c("charge.refunded senza payment_intent → paymentIntent null (il webhook scrive l'avviso)", null, leggi(eventoStripeProva("charge.refunded", { ...charge, payment_intent: null })).paymentIntent);
  const disputa = leggi(eventoStripeProva("charge.dispute.created", { id: "dp_prova0000000001", object: "dispute", payment_intent: "pi_prova0000000001", charge: "ch_prova0000000001", amount: 2890, reason: "fraudulent", currency: "eur" }));
  c("charge.dispute.created → pagamento, importo, motivo", ["charge.dispute.created", "pi_prova0000000001", 2890, "fraudulent"], [disputa.tipo, disputa.paymentIntent, disputa.importoCent, disputa.motivo]);

  /* ── ciò che non si gestisce: sconosciuto, non un errore ── */
  const altro = leggi(eventoStripeProva("payment_intent.created", { id: "pi_x", object: "payment_intent" }));
  c("un tipo che non gestiamo → sconosciuto, con id e tipo per il log", ["sconosciuto", "evt_prova0000000001", "payment_intent.created"], [altro.tipo, altro.id, altro.tipoStripe]);
  const strani = [
    undefined, null, 0, 1, "testo", true, [], [1], {}, { id: 1 }, { id: "evt_1", type: 5 },
    { id: "evt_prova0000000001", type: "checkout.session.completed" },
    { id: "evt_prova0000000001", type: "checkout.session.completed", livemode: false, data: null },
    { id: "evt_prova0000000001", type: "checkout.session.completed", livemode: false, data: { object: null } },
    { id: "evt_prova0000000001", type: "checkout.session.completed", livemode: false, data: { object: "stringa" } },
    { id: "evt_prova0000000001", type: "checkout.session.completed", livemode: false, data: { object: {} } },
    { id: "evt_prova0000000001", type: "charge.refunded", livemode: false, data: { object: [] } },
    { id: "evt_prova0000000001", type: "refund.updated", livemode: false, data: { object: null } },
  ];
  let lanciato = null;
  const letti = [];
  try { for (const x of strani) letti.push(leggi(x)); } catch (e) { lanciato = String(e); }
  c("ingressi strani: non lancia mai", null, lanciato);
  c("ingressi strani: sempre sconosciuto", strani.map(() => "sconosciuto"), letti.map((e) => e.tipo));
  c("senza id di evento valido (evt_…) → sconosciuto (l'idempotenza non avrebbe la chiave)", "sconosciuto", leggi({ ...eventoStripeProva("checkout.session.completed", pagata), id: "ciao" }).tipo);
  c("id di evento enorme → sconosciuto", "sconosciuto", leggi({ ...eventoStripeProva("checkout.session.completed", pagata), id: `evt_${"a".repeat(500)}` }).tipo);
  c("livemode che non è booleano → sconosciuto (la modalità non si indovina)", "sconosciuto", leggi(eventoStripeProva("checkout.session.completed", pagata, { livemode: "false" })).tipo);
  c("tipo di Stripe che sembra un'iniezione non finisce nell'uscita", "sconosciuto", leggi(eventoStripeProva("<script>x</script>", {})).tipo);
  c("e il tipoStripe strano non è riportato", null, leggi(eventoStripeProva("<script>x</script>", {})).tipoStripe);
  /* il JSON dei documenti reali ha molti campi in più: un evento con campi inattesi si legge lo stesso */
  c("campi in più di Stripe: ignorati", "checkout.session.completed", leggi({ ...eventoStripeProva("checkout.session.completed", { ...pagata, nuovo_campo_2027: { x: 1 } }), api_version: "2099-01-01", pending_webhooks: 1, request: { id: null } }).tipo);
}
