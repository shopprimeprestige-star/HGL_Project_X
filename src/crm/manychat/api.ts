/** ── IL CLIENT DI MANYCHAT ─────────────────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). Scritto dal compito U1 (Dev B);
 *  le prove sono in `prove/manychat/api.mjs`, contro il ManyChat finto di
 *  `prove/manychat/finto.mjs`.
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
 *   2. `findByCustomField` sul campo `crm_telefono` (solo cifre). ⚠️ Vuole
 *      l'ID del campo (`field_id`, intero), non il nome: lo si chiede una volta
 *      a `getCustomFields` e lo si tiene per la vita del client.
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
export function creaClient(o: {
  chiave: string;
  fetch: FetchManychat;
  timeoutMs?: number;
}): ClientManychat {
  const timeoutMs = o.timeoutMs ?? TIMEOUT_CHIAMATA_MS;
  /** L'id del campo `crm_telefono`: `undefined` = non ancora chiesto. */
  let idTelefono: number | null | undefined;

  /** Una chiamata. Non lancia mai e non ritenta mai: ogni guasto è un risultato. */
  async function chiama(
    metodo: "GET" | "POST",
    percorso: string,
    o2: { query?: Record<string, string>; corpo?: unknown } = {},
  ): Promise<Grezza> {
    const url = `${BASE}${percorso}${o2.query ? `?${new URLSearchParams(o2.query)}` : ""}`;
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), timeoutMs);
    try {
      const res = await o.fetch(url, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${o.chiave}`,
          Accept: "application/json",
          ...(o2.corpo !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(o2.corpo !== undefined ? { body: JSON.stringify(o2.corpo) } : {}),
        signal: stop.signal,
      });
      let corpo: unknown = null;
      try {
        corpo = await res.json();
      } catch {
        //  Non era JSON: lo dirà `classifica` (200 → incerto, 4xx → blocco).
        if (stop.signal.aborted) return { errore: true, codice: "timeout" };
      }
      return { status: res.status, corpo };
    } catch {
      //  ⚠️ Del guasto si tiene solo il tipo: il messaggio potrebbe contenere
      //   l'intestazione con la chiave.
      return { errore: true, codice: stop.signal.aborted ? "timeout" : "rete" };
    } finally {
      clearTimeout(timer);
    }
  }

  const postCampi = (percorso: string, corpo: unknown) => chiama("POST", percorso, { corpo });

  async function leggiCampi(): Promise<RisultatoApi<{ id: number; nome: string }[]>> {
    const r = await chiama("GET", "/fb/page/getCustomFields");
    const base = esitoDi(r);
    if (base.esito !== "ok") return base;
    const elenco = datiDi(r);
    if (!Array.isArray(elenco)) return { ...base, esito: "incerto", codice: "forma" };
    return {
      ...base,
      dati: elenco
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({ id: Number(x.id), nome: String(x.name ?? "") })),
    };
  }

  /** L'id di `crm_telefono` (la ricerca per campo vuole l'id, non il nome). */
  async function idCampoTelefono(): Promise<RisultatoApi<number | null>> {
    if (idTelefono !== undefined) return { esito: "ok", dati: idTelefono };
    const campi = await leggiCampi();
    if (campi.esito !== "ok")
      return { esito: campi.esito, status: campi.status, codice: campi.codice };
    const trovato = campi.dati?.find((x) => x.nome === CAMPO_TELEFONO);
    idTelefono = trovato && Number.isSafeInteger(trovato.id) && trovato.id > 0 ? trovato.id : null;
    return { esito: "ok", dati: idTelefono };
  }

  return {
    async chiSei() {
      const r = await chiama("GET", "/fb/page/getInfo");
      const base = esitoDi(r);
      if (base.esito !== "ok") return base;
      const d = datiDi(r);
      if (!d || typeof d !== "object") return { ...base, esito: "incerto", codice: "forma" };
      return { ...base, dati: { isPro: (d as { is_pro?: unknown }).is_pro === true } };
    },

    async flussi() {
      const r = await chiama("GET", "/fb/page/getFlows");
      const base = esitoDi(r);
      if (base.esito !== "ok") return base;
      const elenco = (datiDi(r) as { flows?: unknown } | null)?.flows;
      if (!Array.isArray(elenco)) return { ...base, esito: "incerto", codice: "forma" };
      return {
        ...base,
        dati: elenco
          .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
          .map((x) => ({ ns: String(x.ns ?? ""), nome: String(x.name ?? "") })),
      };
    },

    async campi() {
      const c = await leggiCampi();
      return c.esito === "ok"
        ? { ...c, dati: (c.dati ?? []).map((x) => x.nome) }
        : { ...c, dati: undefined };
    },

    async trovaContatto(cifre) {
      //  Passo 2: per il campo `crm_telefono` (se in ManyChat il campo non c'è,
      //  si salta: la porta, scrivendolo, si accorgerà che manca).
      const id = await idCampoTelefono();
      if (id.esito !== "ok") return { esito: id.esito, status: id.status, codice: id.codice };
      if (id.dati) {
        const r = await chiama("GET", "/fb/subscriber/findByCustomField", {
          query: { field_id: String(id.dati), field_value: cifre },
        });
        if (r.status !== 404) {
          const base = esitoDi(r);
          if (base.esito !== "ok") return base;
          const primo = leggiContatto(datiDi(r));
          if (primo) return { ...base, dati: primo };
        }
      }
      //  Passo 3: il telefono di sistema.
      const r = await chiama("GET", "/fb/subscriber/findBySystemField", {
        query: { phone: `+${cifre}` },
      });
      if (r.status === 404) return { esito: "ok", status: 404, dati: null };
      const base = esitoDi(r);
      if (base.esito !== "ok") return base;
      return { ...base, dati: leggiContatto(datiDi(r)) };
    },

    async creaContatto(nome, cifre) {
      const primo = primoNome(nome);
      const r = await postCampi("/fb/subscriber/createSubscriber", {
        ...(primo ? { first_name: primo } : {}),
        whatsapp_phone: `+${cifre}`,
      });
      const base = esitoDi(r);
      //  Rifiutata (esiste già, permesso «import wa_id» negato…): non è un
      //  blocco di tutto, è questo contatto da collegare a mano. 401, 403 (chiave
      //  senza diritti, canale scollegato) e 429 sì: `non_recapitato` è uno stato
      //  chiuso, e la conferma non riparte nemmeno dopo che il titolare ha sistemato.
      if (base.esito === "blocco" && r.status !== undefined && ![401, 403, 429].includes(r.status))
        return { ...base, esito: "rifiuto_contatto" };
      if (base.esito !== "ok") return base;
      const contatto = leggiContatto(datiDi(r));
      //  Creato, ma non so chi: meglio dirlo incerto che inventare un id.
      if (!contatto) return { ...base, esito: "incerto", codice: "forma" };
      return { ...base, dati: contatto };
    },

    async scriviCampi(subscriberId, campi) {
      const voci = Object.entries(campi);
      if (voci.length > 20) return { esito: "blocco", codice: "troppi_campi" };
      if (voci.length === 0) return { esito: "ok" };
      const r = await postCampi("/fb/subscriber/setCustomFields", {
        subscriber_id: subscriberId,
        fields: voci.map(([field_name, field_value]) => ({ field_name, field_value })),
      });
      return esitoDi(r);
    },

    async aggiungiTag(subscriberId, tag) {
      const r = await postCampi("/fb/subscriber/addTagByName", {
        subscriber_id: subscriberId,
        tag_name: tag,
      });
      return esitoDi(r);
    },

    async mandaFlusso(subscriberId, flowNs) {
      const r = await postCampi("/fb/sending/sendFlow", {
        subscriber_id: subscriberId,
        flow_ns: flowNs,
      });
      return esitoDi(r);
    },

    async mandaTesto(subscriberId, testo) {
      //  shortcut: solo testo semplice sul canale WhatsApp; il formato è dalla
      //  documentazione di ManyChat e va confermato al collaudo vero.
      const r = await postCampi("/fb/sending/sendContent", {
        subscriber_id: subscriberId,
        data: {
          version: "v2",
          content: { type: "whatsapp", messages: [{ type: "text", text: testo }] },
        },
      });
      return esitoDi(r);
    },
  };
}

/** Classifica una risposta (o un errore di rete) in un `EsitoApi`. Guarda lo
 *  stato e la forma, non il testo. `status` assente = la chiamata non è
 *  arrivata (rete, timeout) → `incerto`. */
export function classifica(status: number | undefined, corpo: unknown, errore?: unknown): EsitoApi {
  if ((errore !== undefined && errore !== null) || status === undefined) return "incerto";
  //  5xx: ManyChat potrebbe aver fatto il lavoro prima di cadere.
  if (status >= 500) return "incerto";
  if (status >= 200 && status < 300) {
    const dichiarato = statoDichiarato(corpo);
    if (dichiarato === "success") return "ok";
    //  Un errore dichiarato con HTTP 200: ManyChat dice di non aver fatto niente.
    if (dichiarato === "error") return "blocco";
    return "incerto";
  }
  if (status >= 400) {
    //  I codici 304x di sendContent: contenuto non inviabile su quel canale,
    //  cioè questo contatto (da ManyChat, non è un testo ma un numero).
    const codice = codiceNumerico(corpo);
    if (codice !== undefined && codice >= 3040 && codice <= 3049) return "rifiuto_contatto";
    return "blocco";
  }
  return "incerto";
}

// ── dettagli ────────────────────────────────────────────────────────────────

const BASE = "https://api.manychat.com";
const CAMPO_TELEFONO = "crm_telefono";

/** Quello che una chiamata ha riportato, prima di classificarlo. */
interface Grezza {
  status?: number;
  corpo?: unknown;
  /** la chiamata non è arrivata in fondo */
  errore?: boolean;
  /** `timeout` o `rete`, solo se `errore` */
  codice?: string;
}

function statoDichiarato(corpo: unknown): "success" | "error" | null {
  const s = corpo && typeof corpo === "object" ? (corpo as { status?: unknown }).status : null;
  return s === "success" || s === "error" ? s : null;
}

function codiceNumerico(corpo: unknown): number | undefined {
  const c = corpo && typeof corpo === "object" ? (corpo as { code?: unknown }).code : undefined;
  return typeof c === "number" ? c : undefined;
}

const datiDi = (r: Grezza): unknown =>
  r.corpo && typeof r.corpo === "object" ? (r.corpo as { data?: unknown }).data : undefined;

/** L'esito di una chiamata, con un codice breve per i log (mai testi, mai la chiave). */
function esitoDi(r: Grezza): RisultatoApi<never> {
  const esito = classifica(r.status, r.corpo, r.errore ? true : undefined);
  if (r.errore) return { esito, codice: r.codice };
  const code = codiceNumerico(r.corpo);
  if (esito === "ok") return { esito, status: r.status };
  const forma = esito === "incerto" && (r.status ?? 0) < 500 ? "_forma" : "";
  return {
    esito,
    status: r.status,
    codice: `http_${r.status}${code !== undefined ? `_${code}` : ""}${forma}`,
  };
}

/** Un contatto dalla forma di ManyChat; `null` se non ha un id valido. */
function leggiContatto(x: unknown): ContattoManychat | null {
  //  `findByCustomField` risponde con un elenco, `findBySystemField` con un contatto.
  const o = Array.isArray(x) ? x.find((v) => leggiContatto(v)) : x;
  if (!o || typeof o !== "object") return null;
  const c = o as Record<string, unknown>;
  const id = Number(c.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const tel = typeof c.whatsapp_phone === "string" && c.whatsapp_phone ? c.whatsapp_phone : null;
  return {
    id,
    whatsappPhone: tel,
    optinWhatsapp: c.optin_whatsapp === true,
    subscribed: c.subscribed === true,
  };
}

/** Solo il nome: la prima parola, mai il cognome. */
const primoNome = (nome: string) =>
  String(nome ?? "")
    .trim()
    .split(/\s+/)[0]
    .slice(0, 60);
