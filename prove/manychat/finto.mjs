/** ── IL MANYCHAT FINTO ──────────────────────────────────────────────────────
 *
 *  Commessa 2026-10-23. Le prove non chiamano mai ManyChat: gli passano questo
 *  `fetch`, che registra ogni chiamata (metodo, percorso, corpo) e risponde per
 *  copione. Dati tutti inventati; la chiave che si passa al client è una
 *  stringa finta.
 *
 *  ── COME SI USA ────────────────────────────────────────────────────────────
 *    const f = creaFinto();                 // copione di partenza: contatto trovato
 *    f.scenario("assente");                 // oppure: il contatto non c'è
 *    f.su("POST", "/fb/sending/sendFlow", esiti.nonAutorizzato());
 *    const client = creaClient({ chiave: "chiave-finta", fetch: f.fetch });
 *    …
 *    f.chiamate  // [{ metodo, percorso, query, corpo, intestazioni }]
 *
 *  ⚠️ I TESTI DI ERRORE DI MANYCHAT QUI SONO INVENTATI. La forma
 *   (`{status:"error", message, details}`) viene dallo swagger ufficiale, le
 *   frasi no: chi classifica gli errori deve guardare lo `status` HTTP e la
 *   forma, mai il testo. Al collaudo vero si confrontano con quelli reali.
 *  ⚠️ IL TEMPO È FINTO. `ritardoMs` non fa aspettare nessuno: fa avanzare
 *   `orologio.ms`, l'orologio che la prova passa anche al codice provato
 *   (`adesso()`). Una chiamata «lenta» (`esiti.lento()`) non risponde mai
 *   finché il codice non la interrompe col suo `AbortSignal`.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Un orologio che avanza solo quando glielo si dice. */
export function creaOrologio(inizio = Date.parse("2026-10-23T10:00:00+02:00")) {
  const o = {
    ms: inizio,
    adesso: () => new Date(o.ms),
    avanza: (ms) => {
      o.ms += ms;
    },
  };
  return o;
}

/** Le risposte pronte. Il copione le assegna a (metodo, percorso). */
export const esiti = {
  /** `{status:"success", data}` con HTTP 200 */
  successo: (data = {}) => ({ http: 200, corpo: { status: "success", data } }),
  /** `{status:"error", message}` con lo stato HTTP che si vuole */
  errore: (http, message = "errore finto") => ({
    http,
    corpo: { status: "error", message, details: { messages: [{ message }] } },
  }),
  nonAutorizzato: () => esiti.errore(401, "Unauthorized"),
  /** Il modello non è approvato o è in pausa (testo inventato, vedi sopra). */
  modelloRifiutato: () => esiti.errore(400, "Template is not approved"),
  errore500: () => esiti.errore(500, "Internal error"),
  /** La rete è giù: `fetch` lancia, come fa Node con un `TypeError`. */
  reteGiu: () => ({ lancia: new TypeError("fetch failed") }),
  /** Non risponde mai: finisce solo se il chiamante interrompe col suo segnale. */
  lento: () => ({ lento: true }),
};

/** Un contatto ManyChat inventato. */
export const contattoFinto = (extra = {}) => ({
  id: 1000001,
  first_name: "Maria",
  whatsapp_phone: "+393331234567",
  optin_whatsapp: true,
  subscribed: true,
  last_input_text: null,
  custom_fields: [],
  tags: [],
  ...extra,
});

const PERCORSI = {
  info: "/fb/page/getInfo",
  flussi: "/fb/page/getFlows",
  campi: "/fb/page/getCustomFields",
  perCampo: "/fb/subscriber/findByCustomField",
  perSistema: "/fb/subscriber/findBySystemField",
  crea: "/fb/subscriber/createSubscriber",
  scriviCampi: "/fb/subscriber/setCustomFields",
  tag: "/fb/subscriber/addTagByName",
  flusso: "/fb/sending/sendFlow",
  testo: "/fb/sending/sendContent",
};

/** Il copione di partenza: ManyChat Pro, contatto trovato per `crm_telefono`,
 *  tutto il resto accettato. */
function copioneDi(nome) {
  const base = {
    [`GET ${PERCORSI.info}`]: esiti.successo({ is_pro: true, name: "Pagina finta" }),
    [`GET ${PERCORSI.flussi}`]: esiti.successo({
      flows: [{ ns: "content-finto-1", name: "CRM · Conferma consulenza" }],
    }),
    [`GET ${PERCORSI.campi}`]: esiti.successo([{ name: "crm_v1", type: "text" }]),
    [`POST ${PERCORSI.scriviCampi}`]: esiti.successo({}),
    [`POST ${PERCORSI.tag}`]: esiti.successo({}),
    [`POST ${PERCORSI.flusso}`]: esiti.successo({}),
    [`POST ${PERCORSI.testo}`]: esiti.successo({}),
  };
  if (nome === "assente") {
    return {
      ...base,
      [`GET ${PERCORSI.perCampo}`]: esiti.successo(null),
      [`GET ${PERCORSI.perSistema}`]: esiti.successo(null),
      [`POST ${PERCORSI.crea}`]: esiti.successo(contattoFinto()),
    };
  }
  return {
    ...base,
    [`GET ${PERCORSI.perCampo}`]: esiti.successo([contattoFinto()]),
    [`GET ${PERCORSI.perSistema}`]: esiti.successo(contattoFinto()),
    [`POST ${PERCORSI.crea}`]: esiti.successo(contattoFinto()),
  };
}

/** @param {{ orologio?: ReturnType<typeof creaOrologio>, ritardoMs?: number }} [o] */
export function creaFinto(o = {}) {
  const orologio = o.orologio ?? creaOrologio();
  let ritardoMs = o.ritardoMs ?? 0;
  let copione = copioneDi("trovato");
  /** @type {{metodo:string, percorso:string, query:Record<string,string>, corpo:any, intestazioni:Record<string,string>}[]} */
  const chiamate = [];

  async function fetchFinto(url, init = {}) {
    const u = new URL(String(url));
    const metodo = String(init.method ?? "GET").toUpperCase();
    chiamate.push({
      metodo,
      percorso: u.pathname,
      query: Object.fromEntries(u.searchParams),
      corpo: init.body ? JSON.parse(String(init.body)) : null,
      intestazioni: Object.fromEntries(
        Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]),
      ),
    });
    const esito = copione[`${metodo} ${u.pathname}`] ?? esiti.errore(404, "rotta non nel copione");
    if (esito.lancia) throw esito.lancia;
    if (esito.lento) {
      //  Aspetta finché il chiamante non interrompe; senza segnale, non finisce.
      await new Promise((_, rifiuta) => {
        const segnale = init.signal;
        const fine = () => rifiuta(Object.assign(new Error("interrotta"), { name: "AbortError" }));
        if (segnale?.aborted) fine();
        else segnale?.addEventListener("abort", fine, { once: true });
      });
    }
    orologio.avanza(ritardoMs);
    return new Response(JSON.stringify(esito.corpo), {
      status: esito.http,
      headers: { "content-type": "application/json" },
    });
  }

  return {
    fetch: fetchFinto,
    chiamate,
    orologio,
    /** Rimette il copione di partenza: "trovato" (di serie) o "assente". */
    scenario(nome) {
      copione = copioneDi(nome);
      return this;
    },
    /** Cambia la risposta di UNA rotta, per questa e le prossime chiamate. */
    su(metodo, percorso, esito) {
      copione[`${metodo.toUpperCase()} ${percorso}`] = esito;
      return this;
    },
    /** Quanto «dura» ogni chiamata sull'orologio finto. */
    ritardo(ms) {
      ritardoMs = ms;
      return this;
    },
    svuota() {
      chiamate.length = 0;
    },
    /** I percorsi chiamati, in ordine: quello che serve per dire «prima i campi, poi sendFlow». */
    percorsi: () => chiamate.map((x) => x.percorso),
  };
}

export { PERCORSI };
