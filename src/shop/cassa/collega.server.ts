/** ── IL COLLEGAMENTO DELLE ROTTE DEL R2 (collega.server.ts) ──────────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T57 (PIANO-R2 §3.1, §3.2, §3.5, D45, D53, D59). Le rotte (`api.public.shop-cassa*`,
 *  `api.public.stripe-webhook`, `api.crm.stripe`, `api.crm.ordini`) restano sottili: qui si costruiscono le PORTE dei moduli già
 *  provati (cassa, webhook, rimborsi, email) a partire dall'ambiente del server.
 *
 *  Perché un file solo: sei rotte hanno bisogno della stessa chiave di Stripe e delle stesse porte dell'email, e `api.crm.ordini.ts`
 *  non può nominare `process.env` (la prova `prove/ecommerce/server.mjs` lo vieta nella rotta e nel suo modulo).
 *
 *  ⚠️ Nessun `process.env` letto quando il modulo si carica: ogni funzione lo legge al momento della chiamata (`ambiente` è il
 *   parametro che le prove sostituiscono). Le chiavi non entrano mai in una risposta né in un log: si copiano solo booleani e codici.
 *  ⚠️ Importabile senza il client del server: il database arriva come argomento. */
import { SITO } from "@/lib/sito";
import { codiceDi, tabellaAssente } from "../cms/cassa-sito";
import type { Cassa } from "../cms/cassa-sito";
import type { ClienteDb } from "../../crm/negozio/comune";
import { creaPorteEmail, resendConFetch, type PorteInvio } from "../email/invio.server";
import { intestazioneMittente } from "../email/tipi";
import { creaClientStripe, type ClientStripe } from "../stripe/client";
import { modalitaDellaChiave, type ModalitaStripe } from "../stripe/tipi";
import type { SpedizionePubblica } from "./spedizione";
import type { DbCassaServer, PorteCassaServer } from "./cassa.server";
import { attendiConTetto, type DbWebhook, type PorteWebhook } from "./webhook.server";

/** Le variabili d'ambiente come le vede il codice: nome → valore. */
export type Ambiente = Record<string, string | undefined>;

/** Un valore dell'ambiente: il testo senza spazi, oppure `undefined` se manca o è vuoto. */
const valore = (ambiente: Ambiente, nome: string): string | undefined => {
  const v = ambiente[nome];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};

/** `STRIPE_SECRET_KEY`, letta adesso. */
export function chiaveStripe(ambiente: Ambiente = process.env): string | undefined {
  return valore(ambiente, "STRIPE_SECRET_KEY");
}
/** `STRIPE_WEBHOOK_SECRET`, letto adesso. */
export function segretoWebhook(ambiente: Ambiente = process.env): string | undefined {
  return valore(ambiente, "STRIPE_WEBHOOK_SECRET");
}

/** Il client di Stripe con la chiave dell'ambiente di questa richiesta (senza chiave ogni chiamata risponde `chiave_mancante`, senza rete). */
export const clienteStripe = (
  ambiente: Ambiente = process.env,
  chiamata: typeof fetch = (url, opzioni) => fetch(url, opzioni),
): ClientStripe => creaClientStripe({ chiave: chiaveStripe(ambiente), fetch: chiamata });

/** L'indirizzo di chi chiama: quello che mette Cloudflare, poi (per le prove locali) il primo di `x-forwarded-for`. Mai `Host` o `Origin`. */
const ipDi = (richiesta: Request): string =>
  richiesta.headers.get("cf-connecting-ip") || (richiesta.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();

/* ══ LA CASSA ═══════════════════════════════════════════════════════════════ */

/** La cassa è aperta? Servono la cassa effettiva `stripe`, una chiave di API di Stripe (di prova o reale) e il segreto del webhook:
 *  senza il segreto i pagamenti non si registrerebbero. Le chiavi si guardano prima (senza toccare il database); una lettura che lancia = chiusa. */
export async function aperturaCassa(
  cassa: () => Promise<Cassa> | Cassa,
  ambiente: Ambiente = process.env,
): Promise<{ aperta: boolean; motivo?: string }> {
  if (modalitaDellaChiave(chiaveStripe(ambiente)) === null || !segretoWebhook(ambiente)) return { aperta: false, motivo: "chiavi" };
  try {
    return (await cassa()) === "stripe" ? { aperta: true } : { aperta: false, motivo: "cassa_vecchia" };
  } catch {
    return { aperta: false, motivo: "cassa_guasta" };
  }
}

export interface OpzioniPorteCassa {
  db: DbCassaServer;
  richiesta: Request;
  /** La cassa effettiva adesso (`cassaEffettivaDelServer`). */
  cassa: () => Promise<Cassa> | Cassa;
  /** `tariffaSpedizione` di T50: la stessa cifra del carrello. */
  tariffa: () => Promise<SpedizionePubblica>;
  /** Solo CODICI. */
  log: (codice: string) => void;
  ambiente?: Ambiente;
}

/** Le porte di `gestisciCassa`, `gestisciPermesso` e `riprovaPagamento` (T51). `sito` è la costante `SITO`. */
export function porteCassa(o: OpzioniPorteCassa): PorteCassaServer {
  const ambiente = o.ambiente ?? process.env;
  return {
    db: o.db,
    stripe: clienteStripe(ambiente),
    adesso: () => Date.now(),
    log: o.log,
    chiaveServizio: valore(ambiente, "SUPABASE_SERVICE_ROLE_KEY"),
    sito: SITO,
    ip: ipDi(o.richiesta),
    userAgent: o.richiesta.headers.get("user-agent"),
    cassaAperta: () => aperturaCassa(o.cassa, ambiente),
    tariffa: o.tariffa,
    // Un ordine nato con una chiave di prova porta `prova = true` (D58); nel dubbio (chiave non riconosciuta) vale «prova»: la cassa però è chiusa.
    prova: modalitaDellaChiave(chiaveStripe(ambiente)) !== "reale",
  };
}

/* ══ L'EMAIL ════════════════════════════════════════════════════════════════ */

/** Le porte di `inviaEmail` (T54): Resend, il mittente da `SHOP_EMAIL_INDIRIZZO`, la chiave di servizio e `SITO`. Senza chiave l'invio dice `non_configurata`. */
export const porteInvio = (db: ClienteDb, log: (codice: string) => void, ambiente: Ambiente = process.env): PorteInvio => ({
  db,
  resend: resendConFetch(valore(ambiente, "RESEND_API_KEY")),
  mittente: () => intestazioneMittente(valore(ambiente, "SHOP_EMAIL_INDIRIZZO")),
  chiaveServizio: valore(ambiente, "SUPABASE_SERVICE_ROLE_KEY"),
  sito: SITO,
  adesso: () => new Date(),
  log,
});

/* ══ IL WEBHOOK ═════════════════════════════════════════════════════════════ */

/** Come si fa lavorare qualcosa DOPO la risposta: `waitUntil` di Cloudflare se c'è; altrimenti il ripiego che aspetta al massimo 8 secondi. Non lancia mai. */
export async function dopoLaRisposta(): Promise<PorteWebhook["dopoRisposta"]> {
  try {
    // shortcut: il nome del modulo è in una variabile perché fuori da Cloudflare (prove, sviluppo locale) non esiste; non verificato su un Worker vero, quando si collauda con Stripe CLI controllare che la conferma parta anche con la risposta già inviata.
    const nome = "cloudflare:workers";
    const m = (await import(/* @vite-ignore */ nome)) as { waitUntil?: (p: Promise<unknown>) => void };
    const attendi = m.waitUntil;
    if (typeof attendi === "function") return (promessa) => attendi.call(m, promessa.catch(() => undefined));
  } catch {
    /* fuori da Cloudflare */
  }
  return (promessa) => attendiConTetto(promessa);
}

export interface OpzioniPorteWebhook {
  db: DbWebhook & ClienteDb;
  log: (codice: string) => void;
  ambiente?: Ambiente;
}

/** Le porte di `gestisciWebhook` (T52): il segreto si legge a ogni richiesta, Stripe e l'email con le chiavi di adesso. */
export async function porteWebhook(o: OpzioniPorteWebhook): Promise<PorteWebhook> {
  const ambiente = o.ambiente ?? process.env;
  return {
    db: o.db,
    stripe: clienteStripe(ambiente),
    segreto: () => segretoWebhook(ambiente),
    adesso: () => Date.now(),
    log: o.log,
    email: creaPorteEmail(porteInvio(o.db, o.log, ambiente)),
    dopoRisposta: await dopoLaRisposta(),
  };
}

/* ══ LO STATO DI STRIPE PER IL CRM (D59) ════════════════════════════════════ */

export interface StatoStripe {
  /** C'è una chiave nell'ambiente del server. */
  collegato: boolean;
  /** Dal prefisso della chiave (la chiave non esce): `null` se non c'è o non è una chiave di API. */
  modalita: ModalitaStripe | null;
  /** L'ultimo evento di Stripe registrato dal webhook (solo tipo e istante), `null` se nessuno o se non si può leggere. */
  ultimoWebhook: { tipo: string; il: string } | null;
}

interface DbEventi {
  from(tabella: string): {
    select(colonne: string): {
      order(colonna: string, opzioni: { ascending: boolean }): {
        limit(n: number): PromiseLike<{ data: unknown; error: { code?: unknown } | null }>;
      };
    };
  };
}

/** `{collegato, modalita, ultimoWebhook}`: nessuna chiamata a Stripe, mai la chiave. Una tabella assente o un guasto → `ultimoWebhook: null`. */
export async function statoStripe(o: {
  db: DbEventi;
  ambiente?: Ambiente;
  log?: (codice: string) => void;
}): Promise<StatoStripe> {
  const ambiente = o.ambiente ?? process.env;
  const chiave = chiaveStripe(ambiente);
  let ultimoWebhook: StatoStripe["ultimoWebhook"] = null;
  try {
    const r = await o.db.from("shop_stripe_eventi").select("tipo, ricevuto_il").order("ricevuto_il", { ascending: false }).limit(1);
    if (r.error) {
      if (!tabellaAssente(r.error)) o.log?.(`ultimo_webhook ${codiceDi(r.error)}`);
    } else {
      const riga = Array.isArray(r.data) ? (r.data[0] as { tipo?: unknown; ricevuto_il?: unknown } | undefined) : undefined;
      if (typeof riga?.tipo === "string" && typeof riga.ricevuto_il === "string") ultimoWebhook = { tipo: riga.tipo, il: riga.ricevuto_il };
    }
  } catch {
    o.log?.("ultimo_webhook eccezione");
  }
  return { collegato: chiave !== undefined, modalita: modalitaDellaChiave(chiave), ultimoWebhook };
}

const FRASI_PROVA = {
  non_collegato: "Stripe non è collegato: manca la chiave fra le variabili del sito.",
  rifiutata: "Stripe ha rifiutato la chiave: controlla che sia quella giusta e che non sia scaduta.",
  guasto: "Non riesco a parlare con Stripe adesso: riprova tra un momento.",
} as const;

/** «Prova adesso»: UNA lettura innocua (`GET /v1/checkout/sessions?limit=1`). Dice se la chiave vale e se è di prova o reale. */
export async function provaStripe(o: {
  ambiente?: Ambiente;
  chiamata?: typeof fetch;
  log?: (codice: string) => void;
}): Promise<{ stato: number; corpo: Record<string, unknown> }> {
  const ambiente = o.ambiente ?? process.env;
  const modalita = modalitaDellaChiave(chiaveStripe(ambiente));
  if (chiaveStripe(ambiente) === undefined)
    return { stato: 409, corpo: { ok: false, collegato: false, modalita: null, motivo: "non_collegato", frase: FRASI_PROVA.non_collegato } };
  const r = await clienteStripe(ambiente, o.chiamata).sonda();
  if (r.ok) return { stato: 200, corpo: { ok: true, collegato: true, modalita: r.dati.modalita } };
  o.log?.(`prova stripe ${String(r.errore.codice).replace(/[^A-Za-z0-9_]/g, "").slice(0, 28) || "ignoto"}`);
  const rifiutata = r.errore.codice === "chiave_rifiutata" || r.errore.stato === 401 || r.errore.stato === 403;
  return rifiutata
    ? { stato: 409, corpo: { ok: false, collegato: false, modalita, motivo: "rifiutata", frase: FRASI_PROVA.rifiutata } }
    : { stato: 502, corpo: { ok: false, collegato: true, modalita, motivo: "guasto", frase: FRASI_PROVA.guasto } };
}
