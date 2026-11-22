/** ── LA PAGINA «E-COMMERCE» NEL RILASCIO 2: SCHEDE NUOVE E SCHEDA «CASSA» (pagina-r2.ts) ──────
 *  Shop completo R2, T62 (PIANO-R2 §3.5, D56, D58, D59, D65). Modulo PURO (niente React, niente browser): riceve `fetch` e
 *  le «porte», così si prova con una porta finta e col server vero di T56 (prove/ecommerce/pagina-cassa.mjs).
 *
 *  Fa tre cose:
 *   1. Estende `leggiRicerca` di `pagina.ts` (che NON si tocca) con `?scheda=cassa|spedizioni|email`.
 *   2. Parla con le due rotte della scheda «Cassa»: `/api/crm/stripe` (T57: stato e «Prova adesso») e `/api/crm/negozio`
 *      (T56: `?cassa` e `interruttore_imposta`). Traduce le risposte in frasi e le COPIA campo per campo: quello che il
 *      server dicesse in più (una chiave sbadata, un testo di sistema) non arriva mai a schermo.
 *   3. Dà le frasi e gli elenchi fissi del pannello (metodi, eventi da spuntare in Stripe, perché un interruttore è spento).
 *
 *  ── IL CONTRATTO CON `/api/crm/stripe` (di T57, qui non esiste: lo verifica T68) ──
 *   GET   → `{ ok:true, collegato:boolean, modalita:"prova"|"reale"|null, ultimoWebhook?:{ tipo, ricevutoIl }|null }`
 *   POST `{ azione:"prova_adesso" }` → `{ ok:true, frase? }`; senza chiave 409 `{ ok:false, motivo, frase }`.
 *   La chiave non viaggia MAI: solo «prova» o «reale», letti dal prefisso.
 *  ⚠️ Nessun log da qui, mai. */
import { leggiRicerca, type RicercaEcommerce } from "./pagina";

/* ══ L'INDIRIZZO ═════════════════════════════════════════════════════════════ */

export const SCHEDE_R2 = ["cassa", "spedizioni", "email"] as const;
export type SchedaR2 = (typeof SCHEDE_R2)[number];
export type RicercaEstesa = RicercaEcommerce | { scheda: SchedaR2 };

/** Le schede nuove si leggono qui e non hanno altro nell'indirizzo; il resto lo legge `leggiRicerca` com'è sempre. */
export function leggiRicercaEstesa(raw: Record<string, unknown>): RicercaEstesa {
  const nuova = SCHEDE_R2.find((s) => s === raw.scheda);
  return nuova ? { scheda: nuova } : leggiRicerca(raw);
}

/* ══ GLI INDIRIZZI DELLE ROTTE ═══════════════════════════════════════════════ */

export const urlStripe = "/api/crm/stripe";
export const urlCassa = "/api/crm/negozio?cassa";
const urlNegozio = "/api/crm/negozio";

/** Come `fetchCRM`: stessa firma di `fetch`. */
export type FetchRotta = (url: string, init?: RequestInit) => Promise<Response>;

/* ══ LA CHIAMATA ═════════════════════════════════════════════════════════════ */

export type TipoErroreR2 =
  | "sessione" //    401
  | "permesso" //    403
  | "conflitto" //   409: un'altra persona ha cambiato l'interruttore (porta `valore`)
  | "rifiutato" //   400/409/422: il server ha detto no e ha una frase (porta le `condizioni` se le ha)
  | "valore" //      la richiesta non è partita: chiave o valore che la cassa non conosce
  | "server" //      500, o una risposta che non si capisce
  | "rete"; //       la richiesta non è arrivata

const FRASI: Record<TipoErroreR2, string> = {
  sessione: "La sessione è scaduta: rientra nel CRM.",
  permesso: "Il tuo utente non può gestire i pagamenti: chiedi a un amministratore.",
  conflitto:
    "Un'altra persona ha cambiato questo interruttore nel frattempo: ho aggiornato la schermata.",
  rifiutato: "Il server non ha accettato la richiesta: controlla e riprova.",
  valore: "La richiesta non è valida: ricarica la pagina e riprova.",
  server: "Qualcosa non ha funzionato: riprova tra un momento.",
  rete: "Non riesco a collegarmi al server: controlla la connessione e riprova.",
};
const FRASE_RETE_INCERTA =
  "Non so se la modifica sia stata salvata: controlla la connessione, ricarica la scheda e ricontrolla.";
const MAX_FRASE = 300;
/** Oltre questo una richiesta senza risposta è «rete». */
const TETTO_RICHIESTA_MS = 20_000;

export interface RigaCassa {
  chiave: string;
  ok: boolean;
  frase: string;
}
export interface CondizioniCassa {
  puoAccendere: boolean;
  righe: RigaCassa[];
  avviso: string | null;
}
export type ErroreR2 = {
  ok: false;
  tipo: TipoErroreR2;
  messaggio: string;
  valore?: unknown;
  condizioni?: CondizioniCassa;
};
export type EsitoRotta = { ok: true; dati: Record<string, unknown> } | ErroreR2;

const eOggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const errore = (tipo: TipoErroreR2, messaggio = FRASI[tipo]): ErroreR2 => ({
  ok: false,
  tipo,
  messaggio,
});

/** Una richiesta: o il corpo di una risposta buona, o l'errore già in frasi. Non lancia mai. `scrive`: se la rete cade non si sa se è stato scritto. */
export async function chiamaRotta(
  f: FetchRotta,
  url: string,
  init: RequestInit = {},
  scrive = false,
): Promise<EsitoRotta> {
  let r: Response;
  try {
    const tetto =
      typeof AbortSignal.timeout === "function"
        ? { signal: AbortSignal.timeout(TETTO_RICHIESTA_MS) }
        : {};
    r = await f(url, { ...init, ...tetto });
  } catch {
    return errore("rete", scrive ? FRASE_RETE_INCERTA : FRASI.rete); // mai il testo del browser: può nominare l'indirizzo
  }
  let corpo: unknown = null;
  try {
    corpo = await r.json();
  } catch {
    // una pagina d'errore dell'hosting, un corpo vuoto: resta solo lo stato HTTP
  }
  const o = eOggetto(corpo) ? corpo : null;
  if (r.ok && o && o.ok === true) {
    const { ok: _ok, ...dati } = o;
    return { ok: true, dati };
  }
  //  Un 502/503/504 senza `motivo` (timeout dell'hosting) può arrivare DOPO la scrittura: com'è per la rete caduta.
  if (scrive && [502, 503, 504].includes(r.status) && typeof o?.motivo !== "string")
    return errore("rete", FRASE_RETE_INCERTA);
  if (r.status === 401) return errore("sessione");
  if (r.status === 403) return errore("permesso");
  const frase =
    typeof o?.frase === "string" && o.frase.trim() ? o.frase.trim().slice(0, MAX_FRASE) : null;
  if (r.status === 409 && o?.motivo === "conflitto") {
    const e = errore("conflitto", frase ?? FRASI.conflitto);
    if (o && "valore" in o) e.valore = o.valore;
    return e;
  }
  if ([400, 409, 422].includes(r.status) && frase) {
    const e = errore("rifiutato", frase);
    const cond = leggiCondizioni(o?.condizioni);
    if (cond) e.condizioni = cond;
    return e;
  }
  return errore("server", frase ?? FRASI.server);
}

/* ══ STRIPE: STATO E «PROVA ADESSO» ══════════════════════════════════════════ */

export interface StatoStripe {
  collegato: boolean;
  /** Dal prefisso della chiave, letto dal server. `null` se non collegato o se il server dice altro. */
  modalita: "prova" | "reale" | null;
  ultimoWebhook: { tipo: string; ricevutoIl: string } | null;
}

/** Si copiano solo i campi noti; `null` se la risposta non dice nemmeno se Stripe è collegato. */
export function leggiStripe(dati: unknown): StatoStripe | null {
  if (!eOggetto(dati) || typeof dati.collegato !== "boolean") return null;
  const modalita =
    dati.collegato && (dati.modalita === "prova" || dati.modalita === "reale")
      ? dati.modalita
      : null;
  const w = dati.ultimoWebhook;
  const ultimoWebhook =
    eOggetto(w) &&
    typeof w.tipo === "string" &&
    /^[a-z_.]{1,80}$/.test(w.tipo) &&
    typeof w.ricevutoIl === "string" &&
    Number.isFinite(Date.parse(w.ricevutoIl))
      ? { tipo: w.tipo, ricevutoIl: w.ricevutoIl }
      : null;
  return { collegato: dati.collegato, modalita, ultimoWebhook };
}

/** Il nastro «PROVA: nessun pagamento è reale» (D58): solo se Stripe è collegato e dice «prova». Nel dubbio (non letto) non si mostra. */
export const mostraNastro = (stripe: StatoStripe | null | undefined): boolean =>
  stripe?.collegato === true && stripe.modalita === "prova";

export async function caricaStripe(
  f: FetchRotta,
): Promise<{ ok: true; stripe: StatoStripe } | ErroreR2> {
  const r = await chiamaRotta(f, urlStripe);
  if (!r.ok) return r;
  const stripe = leggiStripe(r.dati);
  return stripe ? { ok: true, stripe } : errore("server");
}

/** «Prova adesso»: una lettura innocua a Stripe, lato server. Se Stripe non è collegato il server risponde 409 con la sua frase. */
export async function provaAdesso(f: FetchRotta): Promise<{ ok: true; frase: string } | ErroreR2> {
  const r = await chiamaRotta(f, urlStripe, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ azione: "prova_adesso" }),
  });
  if (!r.ok) return r;
  const frase =
    typeof r.dati.frase === "string" && r.dati.frase.trim()
      ? r.dati.frase.trim().slice(0, MAX_FRASE)
      : "Stripe risponde: il collegamento funziona.";
  return { ok: true, frase };
}

/* ══ LA CASSA: INTERRUTTORI E CONDIZIONI (T56) ═══════════════════════════════ */

export const METODI_PAGAMENTO = [
  { chiave: "carta", etichetta: "Carta" },
  { chiave: "apple_pay", etichetta: "Apple Pay" },
  { chiave: "google_pay", etichetta: "Google Pay" },
  { chiave: "paypal", etichetta: "PayPal" },
  { chiave: "klarna", etichetta: "Klarna" },
] as const;
const CHIAVI_METODI: readonly string[] = METODI_PAGAMENTO.map((m) => m.chiave);
const eMetodo = (v: unknown): v is string => typeof v === "string" && CHIAVI_METODI.includes(v);

export interface StatoCassa {
  /** `null` = il seme non c'è (migrazione S4 non applicata). */
  valore: "vecchia" | "stripe" | null;
  sicuro: boolean;
  metodi: string[];
  puoAccendere: boolean;
  righe: RigaCassa[];
  avviso: string | null;
  puoAccendereSicuro: boolean;
}

function leggiCondizioni(v: unknown): CondizioniCassa | null {
  if (!eOggetto(v) || !Array.isArray(v.righe)) return null;
  const righe = v.righe.flatMap((x): RigaCassa[] =>
    eOggetto(x) &&
    typeof x.chiave === "string" &&
    typeof x.ok === "boolean" &&
    typeof x.frase === "string"
      ? [{ chiave: x.chiave, ok: x.ok, frase: x.frase.slice(0, MAX_FRASE) }]
      : [],
  );
  return {
    puoAccendere: v.puoAccendere === true && righe.length > 0,
    righe,
    avviso: typeof v.avviso === "string" ? v.avviso.slice(0, MAX_FRASE) : null,
  };
}

/** Dalla risposta di `GET ?cassa` allo stato della schermata. Solo i campi noti; i valori che non si capiscono valgono «spento». */
export function leggiCassa(dati: unknown): StatoCassa | null {
  if (!eOggetto(dati) || !eOggetto(dati.interruttori)) return null;
  const val = (k: string): unknown =>
    eOggetto(dati.interruttori) && eOggetto(dati.interruttori[k])
      ? (dati.interruttori[k] as Record<string, unknown>).valore
      : null;
  const valore =
    val("cassa_sito") === "vecchia" || val("cassa_sito") === "stripe"
      ? (val("cassa_sito") as "vecchia" | "stripe")
      : null;
  const metodiLetti = val("metodi_pagamento");
  const cond = leggiCondizioni(dati.condizioni) ?? { puoAccendere: false, righe: [], avviso: null };
  return {
    valore,
    sicuro: val("pagamento_sicuro") === true,
    metodi: CHIAVI_METODI.filter((m) => Array.isArray(metodiLetti) && metodiLetti.includes(m)),
    puoAccendere: valore !== null && cond.puoAccendere,
    righe: cond.righe,
    avviso: cond.avviso,
    puoAccendereSicuro: dati.puoAccendereSicuro === true,
  };
}

export async function caricaCassa(
  f: FetchRotta,
): Promise<{ ok: true; cassa: StatoCassa } | ErroreR2> {
  const r = await chiamaRotta(f, urlCassa);
  if (!r.ok) return r;
  const cassa = leggiCassa(r.dati);
  return cassa ? { ok: true, cassa } : errore("server");
}

/** Le tre cose che la scheda «Cassa» sa girare, col tipo di valore giusto. Qualunque altra cosa non parte (zero richieste). */
const VALIDI: Record<string, (v: unknown) => boolean> = {
  cassa_sito: (v) => v === "vecchia" || v === "stripe",
  pagamento_sicuro: (v) => typeof v === "boolean",
  metodi_pagamento: (v) => Array.isArray(v) && v.every(eMetodo) && new Set(v).size === v.length,
};

/** Un cambio di interruttore. `atteso` è quello che la schermata aveva davanti: se il server ne ha un altro risponde «conflitto» col valore vero. */
export async function impostaCassa(
  f: FetchRotta,
  chiave: string,
  valore: unknown,
  atteso: unknown,
): Promise<EsitoRotta> {
  const valido = VALIDI[chiave];
  if (!valido || !valido(valore) || !valido(atteso)) return errore("valore");
  return chiamaRotta(
    f,
    urlNegozio,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione: "interruttore_imposta", chiave, valore, atteso }),
    },
    true,
  );
}

/* ══ LE FRASI E GLI ELENCHI FISSI ════════════════════════════════════════════ */

/** I metodi dopo aver acceso o spento `metodo`: sempre nell'ordine fisso e senza doppioni. */
export const metodiDopoCambio = (
  metodi: readonly string[],
  metodo: string,
  attivo: boolean,
): string[] => CHIAVI_METODI.filter((m) => (m === metodo ? attivo : metodi.includes(m)));

/** L'indirizzo che il titolare incolla in Stripe. Senza dominio (disegno sul server) resta vuoto: non se ne inventa uno. */
export const indirizzoWebhook = (origine: string): string =>
  origine.trim() ? `${origine.trim().replace(/\/+$/, "")}/api/public/stripe-webhook` : "";

/** Gli eventi che il webhook gestisce (`src/shop/stripe/eventi.ts`): quelli che il titolare spunta nel pannello di Stripe. */
export const EVENTI_STRIPE = [
  "charge.dispute.created",
  "charge.refunded",
  "checkout.session.async_payment_failed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed",
  "checkout.session.expired",
  "refund.failed",
  "refund.updated",
] as const;

export const FRASE_SENZA_SEMI =
  "Mancano gli aggiornamenti del database dei pagamenti (migrazione S4): chiedi a chi gestisce il database di applicarli.";
export const FRASE_SICURO =
  "Si accende solo dopo un pagamento reale che sia stato rimborsato per intero: finché non c'è, il sito non può dirlo.";

/** Perché l'interruttore «Stripe» è spento: le frasi del server, una per ogni condizione che manca. Vuoto = si può girare. */
export function motivoStripeSpento(cassa: StatoCassa): string[] {
  if (cassa.valore === null) return [FRASE_SENZA_SEMI];
  if (cassa.valore === "stripe" || cassa.puoAccendere) return [];
  const mancano = cassa.righe.filter((r) => !r.ok).map((r) => r.frase);
  return mancano.length
    ? mancano
    : [cassa.avviso ?? "Non riesco a controllare le condizioni ora: riprova tra un momento."];
}
