/*  ── IL CLIENT HTTP DI STRIPE, SENZA SDK (R2 · T44 · D45, D46, D47) ─────────────────────────────────
    `creaClientStripe({ chiave, fetch })` (nel piano `creaClient`: rinominato perché la scansione «nessun invio salta l'helper» di R1, `prove/messaggi-automatici/scansione.mjs`, prende `creaClient(` per il client di ManyChat) → le sole chiamate che il negozio usa. Le dipendenze sono PORTE: la chiave (letta da chi chiama al momento
    della richiesta, mai a livello di modulo) e `fetch` (il vero in produzione, il finto nelle prove).

    · ogni chiamata porta `Authorization: Bearer`, `Stripe-Version` e, per le POST che CREANO (sessione, rimborso), l'`Idempotency-Key` (obbligatoria:
      senza non si parte); corpi `application/x-www-form-urlencoded` con le parentesi quadre (`a[b][0]=x`), ogni segno codificato;
    · tetto di 10 s con `AbortController`;
    · MAI un'eccezione e MAI il `message` di Stripe (può contenere dati del cliente): un errore è `{ codice, stato?, ritentabile }` (vedi `ErroreStripe`);
      l'errore di idempotenza (`idempotenza`) è distinto da un rifiuto vero, e con timeout e rete è ritentabile: l'ordine NON si chiude (D47);
    · la chiave non finisce in nessun risultato e non viene mai scritta in un log. */
import {
  TIMEOUT_STRIPE_MS,
  URL_BASE_STRIPE,
  VERSIONE_API_STRIPE,
  type CampiForm,
  type CampiValore,
  type ErroreStripe,
  type EsitoStripe,
  type ModalitaStripe,
  type PagamentoStripe,
  type RimborsoStripe,
  type SessioneStripe,
  modalitaDellaChiave,
} from "./tipi";

/** Quante pagine di rimborsi si leggono al massimo (100 l'una): oltre, l'elenco esce `troncato`. */
const MAX_PAGINE_RIMBORSI = 5;

/** Un oggetto annidato → `a[b][0]=x&c=y`. Chiavi e valori codificati: un `&`, un `[` o un `=` in un nome non inventano parametri. `null`/`undefined` saltati; un numero non finito lancia. */
export function codificaForm(campi: CampiForm): string {
  const coppie: string[] = [];
  const giro = (valore: CampiValore, percorso: string) => {
    if (valore === null || valore === undefined) return;
    if (Array.isArray(valore)) return valore.forEach((v, i) => giro(v, `${percorso}[${i}]`));
    if (typeof valore === "object") {
      for (const [k, v] of Object.entries(valore)) giro(v, percorso ? `${percorso}[${encodeURIComponent(k)}]` : encodeURIComponent(k));
      return;
    }
    if (typeof valore === "number" && !Number.isFinite(valore)) throw new RangeError("numero_non_valido");
    coppie.push(`${percorso}=${encodeURIComponent(String(valore))}`);
  };
  giro(campi, "");
  return coppie.join("&");
}

const testo = (v: unknown): string | null => (typeof v === "string" ? v : null);
const intero = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);
const oggetto = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
/** Un id di Stripe (`cs_…`, `pi_…`): solo lettere, cifre e trattino basso. Va nell'indirizzo: mai un segno che cambi il percorso. */
const ID_VALIDO = /^[A-Za-z0-9_]{1,200}$/;
/** Un codice di errore che si può riportare: breve e senza segni strani (un `code` che non lo rispetta si ignora e vale il tipo). */
const CODICE_VALIDO = /^[A-Za-z0-9_.-]{1,64}$/;

function metadati(v: unknown): Record<string, string> {
  const m = oggetto(v);
  const fuori: Record<string, string> = {};
  if (m) for (const [k, x] of Object.entries(m)) if (typeof x === "string") fuori[k] = x;
  return fuori;
}

function leggiSessione_(j: Record<string, unknown>): SessioneStripe | null {
  const id = testo(j.id);
  if (!id) return null;
  const pi = j.payment_intent;
  return {
    id,
    url: testo(j.url),
    status: testo(j.status) ?? "",
    payment_status: testo(j.payment_status) ?? "",
    payment_intent: testo(pi) ?? testo(oggetto(pi)?.id),
    expires_at: intero(j.expires_at),
    livemode: j.livemode === true,
    amount_total: intero(j.amount_total),
    currency: testo(j.currency),
    client_reference_id: testo(j.client_reference_id),
  };
}

function leggiRimborso_(j: unknown): RimborsoStripe | null {
  const r = oggetto(j);
  const id = testo(r?.id);
  const amount = intero(r?.amount);
  if (!r || !id || amount === null) return null;
  const pi = r.payment_intent;
  return { id, amount, status: testo(r.status) ?? "", payment_intent: testo(pi) ?? testo(oggetto(pi)?.id), metadata: metadati(r.metadata), created: intero(r.created) };
}

export type PortaStripe = {
  /** La chiave segreta di API, letta da chi chiama al momento della richiesta. Vuota o mancante: ogni chiamata risponde `chiave_mancante`. */
  chiave: string | null | undefined;
  fetch: typeof fetch;
  /** Il tetto di tempo (default 10 s): solo le prove lo accorciano. */
  timeoutMs?: number;
  /** La versione dell'API (default `VERSIONE_API_STRIPE`). */
  versione?: string;
};

export type ClientStripe = ReturnType<typeof creaClientStripe>;

export function creaClientStripe(porta: PortaStripe) {
  const { fetch: chiama } = porta;
  const timeoutMs = porta.timeoutMs ?? TIMEOUT_STRIPE_MS;
  const versione = porta.versione ?? VERSIONE_API_STRIPE;
  const chiave = typeof porta.chiave === "string" ? porta.chiave : "";

  const errore = (codice: string, ritentabile: boolean, stato?: number): { ok: false; errore: ErroreStripe } => ({
    ok: false,
    errore: stato === undefined ? { codice, ritentabile } : { codice, stato, ritentabile },
  });

  /** Una chiamata: `percorso` con la query già dentro, `campi` solo per le POST. Restituisce il JSON (oggetto) o l'errore. */
  async function richiesta(metodo: "GET" | "POST", percorso: string, campi?: CampiForm, idempotenza?: string): Promise<EsitoStripe<Record<string, unknown>>> {
    if (!chiave) return errore("chiave_mancante", false);
    const intestazioni: Record<string, string> = { Authorization: `Bearer ${chiave}`, "Stripe-Version": versione };
    if (metodo === "POST") intestazioni["Content-Type"] = "application/x-www-form-urlencoded";
    if (idempotenza) intestazioni["Idempotency-Key"] = idempotenza;
    let corpo: string | undefined;
    try {
      corpo = metodo === "POST" ? codificaForm(campi ?? {}) : undefined;
    } catch {
      return errore("parametro_non_valido", false);
    }

    const stop = new AbortController();
    const orologio = setTimeout(() => stop.abort(), timeoutMs);
    try {
      let risposta: Response;
      try {
        risposta = await chiama(`${URL_BASE_STRIPE}${percorso}`, { method: metodo, headers: intestazioni, body: corpo, signal: stop.signal });
      } catch (e) {
        return stop.signal.aborted || (e as { name?: string } | null)?.name === "AbortError" ? errore("timeout", true) : errore("rete", true);
      }
      let json: unknown = null;
      try {
        json = await risposta.json();
      } catch {
        // non è JSON (pagina d'errore di un intermediario): si decide dallo stato
        return stop.signal.aborted ? errore("timeout", true) : errore("risposta_non_valida", risposta.status >= 500, risposta.status);
      }
      const corpoJson = oggetto(json);
      if (!risposta.ok) {
        const e = oggetto(corpoJson?.error);
        const tipo = testo(e?.type);
        const code = testo(e?.code);
        const stato = risposta.status;
        if (tipo === "idempotency_error") return errore("idempotenza", true, stato);
        if (stato === 401) return errore("chiave_rifiutata", false, stato);
        const codice = (code && CODICE_VALIDO.test(code) ? code : null) ?? (tipo && CODICE_VALIDO.test(tipo) ? tipo : null) ?? `http_${stato}`;
        return errore(codice, stato >= 500 || stato === 429 || stato === 409, stato); // niente `message`: mai
      }
      if (!corpoJson) return errore("risposta_non_valida", false, risposta.status);
      return { ok: true, dati: corpoJson };
    } finally {
      clearTimeout(orologio);
    }
  }

  const conId = <T>(id: unknown, f: (id: string) => Promise<EsitoStripe<T>>): Promise<EsitoStripe<T>> =>
    typeof id === "string" && ID_VALIDO.test(id) ? f(id) : Promise.resolve(errore("id_non_valido", false));

  const comeSessione = (r: EsitoStripe<Record<string, unknown>>): EsitoStripe<SessioneStripe> => {
    if (!r.ok) return r;
    const s = leggiSessione_(r.dati);
    return s ? { ok: true, dati: s } : errore("risposta_non_valida", false);
  };

  return {
    /** Crea la sessione di Checkout. `campi` = l'uscita di `corpoSessione`. L'`Idempotency-Key` è obbligatoria (`sessione-<ordine>-<firma>-r<n>`). */
    async creaSessione(campi: CampiForm, chiaveIdempotenza: string): Promise<EsitoStripe<SessioneStripe>> {
      if (!chiaveIdempotenza) return errore("chiave_idempotenza_mancante", false);
      return comeSessione(await richiesta("POST", "/v1/checkout/sessions", campi, chiaveIdempotenza));
    },
    leggiSessione: (id: string) => conId(id, async (i) => comeSessione(await richiesta("GET", `/v1/checkout/sessions/${i}`))),
    /** Fa scadere una sessione ancora aperta. Già scaduta o pagata: rifiuto vero di Stripe (non ritentabile). */
    scadiSessione: (id: string) => conId(id, async (i) => comeSessione(await richiesta("POST", `/v1/checkout/sessions/${i}/expire`, {}))),

    /** Crea un rimborso: `campi` = `{ payment_intent, amount?, metadata? }`. L'`Idempotency-Key` è obbligatoria (= l'id della riga di `shop_rimborsi`). */
    async creaRimborso(campi: CampiForm, chiaveIdempotenza: string): Promise<EsitoStripe<RimborsoStripe>> {
      if (!chiaveIdempotenza) return errore("chiave_idempotenza_mancante", false);
      const r = await richiesta("POST", "/v1/refunds", campi, chiaveIdempotenza);
      if (!r.ok) return r;
      const rimborso = leggiRimborso_(r.dati);
      return rimborso ? { ok: true, dati: rimborso } : errore("risposta_non_valida", false);
    },
    /** TUTTI i rimborsi di un pagamento (D46): pagine da 100 con `starting_after`, fino a 5 pagine; `troncato` se ce ne sono ancora. Un guasto a metà è un errore, mai un elenco parziale. */
    elencaRimborsi: (paymentIntent: string) =>
      conId(paymentIntent, async (pi): Promise<EsitoStripe<{ rimborsi: RimborsoStripe[]; troncato: boolean }>> => {
        const rimborsi: RimborsoStripe[] = [];
        let dopo: string | null = null;
        for (let pagina = 0; pagina < MAX_PAGINE_RIMBORSI; pagina++) {
          const r = await richiesta("GET", `/v1/refunds?payment_intent=${pi}&limit=100${dopo ? `&starting_after=${encodeURIComponent(dopo)}` : ""}`);
          if (!r.ok) return r;
          const dati = Array.isArray(r.dati.data) ? r.dati.data : null;
          if (!dati) return errore("risposta_non_valida", false);
          for (const x of dati) {
            const rimborso = leggiRimborso_(x);
            if (rimborso) rimborsi.push(rimborso);
          }
          const ultimo = dati.length ? testo(oggetto(dati[dati.length - 1])?.id) : null;
          if (r.dati.has_more !== true) return { ok: true, dati: { rimborsi, troncato: false } };
          if (!ultimo) return errore("risposta_non_valida", false);
          dopo = ultimo;
        }
        return { ok: true, dati: { rimborsi, troncato: true } };
      }),

    /** Il pagamento con il metodo usato (`latest_charge` espanso). Per il CRM: best effort, un errore non blocca il «pagato». */
    leggiPagamento: (id: string) =>
      conId(id, async (i): Promise<EsitoStripe<PagamentoStripe>> => {
        const r = await richiesta("GET", `/v1/payment_intents/${i}?expand[]=latest_charge`);
        if (!r.ok) return r;
        const pid = testo(r.dati.id);
        if (!pid) return errore("risposta_non_valida", false);
        const carica = oggetto(r.dati.latest_charge);
        return {
          ok: true,
          dati: {
            id: pid,
            status: testo(r.dati.status) ?? "",
            amount: intero(r.dati.amount),
            currency: testo(r.dati.currency),
            metodo: testo(oggetto(carica?.payment_method_details)?.type),
            metadata: metadati(r.dati.metadata),
          },
        };
      }),

    /** «Prova adesso» del CRM: una lettura innocua. Dice se la chiave vale e se è di prova o reale (dal prefisso: la chiave non esce). */
    async sonda(): Promise<EsitoStripe<{ modalita: ModalitaStripe | null }>> {
      const r = await richiesta("GET", "/v1/checkout/sessions?limit=1");
      return r.ok ? { ok: true, dati: { modalita: modalitaDellaChiave(chiave) } } : r;
    },
  };
}
