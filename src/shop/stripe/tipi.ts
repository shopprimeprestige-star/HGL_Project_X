/*  ── STRIPE SENZA SDK · TIPI E COSTANTI (R2 · T44 · D45, D47) ───────────────────────────────────────
    Solo ciò che il codice del negozio usa di Stripe, con i nomi dei campi di Stripe (i rimborsi vanno tali e quali a `shop_rimborso_riconcilia`).
    Nessuna chiave qui dentro: le chiavi arrivano come argomento da chi le legge, al momento della richiesta.

    ⚠️ VERSIONE DELL'API: scelta tra le versioni stabili documentate di Stripe, NON letta dal conto del titolare (dubbio aperto in Lavagna:
       va confermata sul conto di prova prima del collaudo). Si manda in `Stripe-Version` a ogni chiamata, così il comportamento
       non cambia quando Stripe aggiorna la versione predefinita del conto. Una prova ne controlla la presenza. */

export const VERSIONE_API_STRIPE = "2025-09-30.clover";

/** Il tetto di tempo di ogni chiamata a Stripe (la cassa risponde al cliente: non si aspetta oltre). */
export const TIMEOUT_STRIPE_MS = 10_000;

export const URL_BASE_STRIPE = "https://api.stripe.com";

/** I prefissi che dicono se una chiave è di prova o reale (anche le chiavi ristrette `rk_`). Il segreto del webhook e le chiavi `pk_` non sono chiavi di API. */
export const PREFISSI_CHIAVE = {
  prova: ["sk_test_", "rk_test_"],
  reale: ["sk_live_", "rk_live_"],
} as const;

export type ModalitaStripe = "prova" | "reale";

/** «prova» o «reale» dal prefisso della chiave, `null` se non è una chiave di API. Non ripete mai la chiave. */
export function modalitaDellaChiave(chiave: unknown): ModalitaStripe | null {
  if (typeof chiave !== "string") return null;
  if (PREFISSI_CHIAVE.prova.some((p) => chiave.startsWith(p) && chiave.length > p.length)) return "prova";
  if (PREFISSI_CHIAVE.reale.some((p) => chiave.startsWith(p) && chiave.length > p.length)) return "reale";
  return null;
}

/** Un errore di Stripe o della rete: SOLO un codice, mai il `message` (può contenere dati del cliente). */
export type ErroreStripe = {
  /** `error.code` o `error.type` di Stripe, oppure uno nostro: `timeout`, `rete`, `idempotenza`, `chiave_rifiutata`, `chiave_mancante`, `risposta_non_valida`, `id_non_valido`, `chiave_idempotenza_mancante`. */
  codice: string;
  /** Lo stato HTTP, se c'è stata una risposta. */
  stato?: number;
  /** Ritentare ha senso (timeout, rete, 5xx, 429, idempotenza): NON è un rifiuto vero di Stripe. */
  ritentabile: boolean;
};

export type EsitoStripe<T> = { ok: true; dati: T } | { ok: false; errore: ErroreStripe };

/** Una sessione di Checkout, ritagliata (campi come li chiama Stripe). */
export type SessioneStripe = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired" | string;
  payment_status: "paid" | "unpaid" | "no_payment_required" | string;
  payment_intent: string | null;
  expires_at: number | null;
  livemode: boolean;
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
};

/** Un rimborso, ritagliato: è la forma che `shop_rimborso_riconcilia(p_rimborsi)` si aspetta (`id`, `amount`, `status`, `metadata`). */
export type RimborsoStripe = {
  id: string;
  amount: number;
  status: "pending" | "requires_action" | "succeeded" | "failed" | "canceled" | string;
  payment_intent: string | null;
  metadata: Record<string, string>;
  created: number | null;
};

/** Un pagamento (payment intent) con il metodo di pagamento letto dall'addebito (`latest_charge` espanso). */
export type PagamentoStripe = {
  id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  /** Il tipo di metodo usato (`card`, `paypal`, `klarna`…), `null` se non si legge. */
  metodo: string | null;
  metadata: Record<string, string>;
};

/** I campi di una richiesta: oggetti annidati e liste, che il client codifica in `application/x-www-form-urlencoded` con le parentesi quadre. */
export type CampiForm = { [chiave: string]: CampiValore };
export type CampiValore = string | number | boolean | null | undefined | CampiValore[] | CampiForm;
