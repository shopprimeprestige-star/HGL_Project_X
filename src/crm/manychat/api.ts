/** ── IL CLIENT DI MANYCHAT ─────────────────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). SCHELETRO del compito 1: ci
 *  sono solo le firme. Il compito U1 (Dev B) scrive i corpi e le prove in
 *  `prove/manychat/api.mjs` (con il ManyChat finto di `prove/manychat/finto.mjs`).
 *
 *  Modulo PURO nel senso che conta: niente `process.env`, niente `fetch` globale.
 *  La chiave e il `fetch` arrivano da fuori (`porta.server.ts`), così le prove
 *  passano un `fetch` finto che registra le chiamate.
 *
 *  ── L'API (swagger ufficiale, https://api.manychat.com/swagger) ───────────
 *   Base `https://api.manychat.com`, `Authorization: Bearer <chiave>`. Esiti
 *   `{"status":"success","data":…}` oppure `{"status":"error","message",
 *   "details":{"messages":[…]}}`.
 *   GET  /fb/page/getInfo · getFlows · getCustomFields
 *   GET  /fb/subscriber/findByCustomField · findBySystemField (solo `email` o `phone`)
 *   POST /fb/subscriber/createSubscriber · setCustomFields · addTagByName
 *   POST /fb/sending/sendFlow {subscriber_id, flow_ns} · sendContent
 *
 *  ── LA RICERCA DEL CONTATTO (4 passi, PIANO §0) ───────────────────────────
 *   1. il registro (`subscriber_id` già visto per quel numero: lo fa la porta)
 *   2. `findByCustomField` sul campo `crm_telefono` (solo cifre)
 *   3. `findBySystemField?phone=+<cifre>`
 *   4. `createSubscriber` col SOLO nome (`last_name` vuoto, mai il cognome) e
 *      `whatsapp_phone = +<cifre>`
 *
 *  ⚠️ UN ERRORE INCERTO NON SI RITENTA. Rete giù, 500, lentezza oltre 8 s:
 *   `incerto`, e nessuna seconda chiamata. Meglio un messaggio in meno che due
 *   uguali.
 *  ⚠️ LA CHIAVE NON COMPARE IN NESSUN ERRORE, né nei log. Si classifica
 *   guardando lo stato HTTP e la forma della risposta, mai il testo (che può
 *   cambiare).
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il tempo massimo di ogni chiamata. */
export const TIMEOUT_CHIAMATA_MS = 8000;

/** Com'è andata una chiamata, per chi decide cosa fare dopo. */
export type EsitoApi =
  | "ok"
  /** il numero non è su WhatsApp, o il contatto non si può creare: non si ritenta */
  | "rifiuto_contatto"
  /** chiave rifiutata, canale scollegato, modello in pausa, limite: si ferma tutto */
  | "blocco"
  /** rete, 5xx, timeout: non si sa se è partito */
  | "incerto";

/** Un `fetch` come quello di Node, ridotto a quel che serve. */
export type FetchManychat = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>;

/** Il contatto come lo vede il CRM (quel che serve da ManyChat). */
export interface ContattoManychat {
  id: number;
  whatsappPhone: string | null;
  optinWhatsapp: boolean;
  subscribed: boolean;
}

/** Il risultato di una chiamata: l'esito classificato e, se `ok`, i dati. */
export interface RisultatoApi<T = unknown> {
  esito: EsitoApi;
  /** lo stato HTTP, se la chiamata è arrivata in fondo */
  status?: number;
  dati?: T;
  /** un codice breve per i log: mai il testo di ManyChat, mai la chiave */
  codice?: string;
}

export interface ClientManychat {
  /** `getInfo`: la chiave è buona? `is_pro`? */
  chiSei(): Promise<RisultatoApi<{ isPro: boolean }>>;
  /** `getFlows`: i flussi (nome → `ns`) */
  flussi(): Promise<RisultatoApi<{ ns: string; nome: string }[]>>;
  /** `getCustomFields`: i nomi dei campi che esistono */
  campi(): Promise<RisultatoApi<string[]>>;
  /** passi 2 e 3 della ricerca; `dati` = `null` se non c'è */
  trovaContatto(cifre: string): Promise<RisultatoApi<ContattoManychat | null>>;
  /** passo 4: `first_name` = solo il nome, `last_name` vuoto */
  creaContatto(nome: string, cifre: string): Promise<RisultatoApi<ContattoManychat>>;
  /** `setCustomFields` (fino a 20 per chiamata, per `field_name`) */
  scriviCampi(subscriberId: number, campi: Record<string, string>): Promise<RisultatoApi>;
  aggiungiTag(subscriberId: number, tag: string): Promise<RisultatoApi>;
  /** `sendFlow`: l'invio vero di un modello */
  mandaFlusso(subscriberId: number, flowNs: string): Promise<RisultatoApi>;
  /** `sendContent`: testo libero, solo entro 24 ore dall'ultimo messaggio del cliente */
  mandaTesto(subscriberId: number, testo: string): Promise<RisultatoApi>;
}

/** Il client. `chiave` e `fetch` arrivano da fuori; `timeoutMs` di serie 8 s. */
export function creaClient(_o: {
  chiave: string;
  fetch: FetchManychat;
  timeoutMs?: number;
}): ClientManychat {
  throw new Error("manychat/api: creaClient non è ancora scritta (compito U1)");
}

/** Classifica una risposta (o un errore di rete) in un `EsitoApi`. Guarda lo
 *  stato e la forma, non il testo. `status` assente = la chiamata non è
 *  arrivata (rete, timeout) → `incerto`. */
export function classifica(
  _status: number | undefined,
  _corpo: unknown,
  _errore?: unknown,
): EsitoApi {
  throw new Error("manychat/api: classifica non è ancora scritta (compito U1)");
}
