/*  ── GLI EVENTI DEL WEBHOOK (R2 · T44 · D45, §3.2) ─────────────────────────────────────────────────
    `leggiEvento(json)` → la forma interna di un evento che il negozio gestisce, oppure `{ tipo: "sconosciuto" }`. NON lancia mai.
    Porta fuori solo ciò che serve a `shop_ordine_pagato`, `shop_ordine_chiudi`, alla riconciliazione dei rimborsi e agli avvisi: id dell'evento
    (la chiave di `shop_stripe_eventi`), modalità (`livemode`), l'ordine, la sessione, il pagamento, importo e valuta. MAI email, nome, telefono, indirizzo.
    Un evento senza `id` `evt_…` o senza `livemode` booleano non si gestisce (sconosciuto): non si indovina né la chiave di idempotenza né la modalità.
    Gli importi sono centesimi INTERI, altrimenti `null`: il «pagato» non si decide mai su un numero strano. */

export const EVENTI_SESSIONE = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
] as const;
export const EVENTI_RIMBORSO = ["charge.refunded", "refund.updated", "refund.failed"] as const;
export const EVENTO_CONTESTAZIONE = "charge.dispute.created" as const;

type Base = { id: string; livemode: boolean; creato: number | null };

export type EventoSessione = Base & {
  tipo: (typeof EVENTI_SESSIONE)[number];
  sessione: {
    id: string | null;
    /** `client_reference_id`, ripiego `metadata[ordine_id]`. */
    ordineId: string | null;
    /** `payment_status` di Stripe: `paid`, `unpaid` (metodo ritardato), `no_payment_required`. */
    pagamento: string | null;
    paymentIntent: string | null;
    importoCent: number | null;
    valuta: string | null;
  };
};
export type EventoRimborso = Base & { tipo: (typeof EVENTI_RIMBORSO)[number]; paymentIntent: string | null; ordineId: string | null };
export type EventoContestazione = Base & { tipo: typeof EVENTO_CONTESTAZIONE; paymentIntent: string | null; importoCent: number | null; motivo: string | null };
export type EventoSconosciuto = { tipo: "sconosciuto"; id: string | null; /** Il tipo di Stripe, solo se ha una forma sicura da mettere in un log. */ tipoStripe: string | null };
export type EventoLetto = EventoSessione | EventoRimborso | EventoContestazione | EventoSconosciuto;

const ID_EVENTO = /^evt_[A-Za-z0-9_]{1,200}$/;
const TIPO_SICURO = /^[a-z0-9_.]{1,100}$/;
const oggetto = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const testo = (v: unknown, max = 200): string | null => (typeof v === "string" && v !== "" && v.length <= max ? v : null);
const cent = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null);
/** Un id che può arrivare come testo o come oggetto espanso (`{id}`). */
const idDi = (v: unknown): string | null => testo(v) ?? testo(oggetto(v)?.id);
const ordineDa = (...candidati: unknown[]): string | null => {
  for (const c of candidati) {
    const t = testo(c, 100);
    if (t) return t;
  }
  return null;
};
const inElenco = <T extends string>(elenco: readonly T[], v: string): v is T => (elenco as readonly string[]).includes(v);

export function leggiEvento(json: unknown): EventoLetto {
  const sconosciuto = (e: Record<string, unknown> | null): EventoSconosciuto => {
    const id = testo(e?.id);
    const tipo = testo(e?.type);
    return { tipo: "sconosciuto", id: id && ID_EVENTO.test(id) ? id : null, tipoStripe: tipo && TIPO_SICURO.test(tipo) ? tipo : null };
  };
  try {
    const e = oggetto(json);
    const id = testo(e?.id);
    const tipo = testo(e?.type);
    if (!e || !id || !ID_EVENTO.test(id) || !tipo || typeof e.livemode !== "boolean") return sconosciuto(e);
    const base: Base = { id, livemode: e.livemode, creato: typeof e.created === "number" && Number.isSafeInteger(e.created) ? e.created : null };
    const o = oggetto(oggetto(e.data)?.object);

    if (inElenco(EVENTI_SESSIONE, tipo)) {
      if (!o || !testo(o.id)) return sconosciuto(e);
      const valuta = testo(o.currency, 10);
      return {
        ...base,
        tipo,
        sessione: {
          id: testo(o.id),
          ordineId: ordineDa(o.client_reference_id, oggetto(o.metadata)?.ordine_id),
          pagamento: testo(o.payment_status, 40),
          paymentIntent: idDi(o.payment_intent),
          importoCent: cent(o.amount_total),
          valuta: valuta ? valuta.toLowerCase() : null,
        },
      };
    }
    if (inElenco(EVENTI_RIMBORSO, tipo)) {
      if (!o) return sconosciuto(e);
      return { ...base, tipo, paymentIntent: idDi(o.payment_intent), ordineId: ordineDa(oggetto(o.metadata)?.ordine_id) };
    }
    if (tipo === EVENTO_CONTESTAZIONE) {
      if (!o) return sconosciuto(e);
      return { ...base, tipo, paymentIntent: idDi(o.payment_intent), importoCent: cent(o.amount), motivo: testo(o.reason, 60) };
    }
    return sconosciuto(e);
  } catch {
    return { tipo: "sconosciuto", id: null, tipoStripe: null };
  }
}
