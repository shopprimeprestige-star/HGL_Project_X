/** ── STRIPE FINTO PER LE PROVE DEL RILASCIO 2 (T40) ────────────────────────
 *  Un `fetch` che risponde come l'API di Stripe (solo le chiamate che il codice del R2 userà), senza rete e senza chiavi vere:
 *      const stripe = stripeFinto();           // stripe.fetch si passa a `creaClient({chiave: CHIAVE_PROVA, fetch})`
 *  e, per il webhook, i corpi di prova firmati con una chiave di prova (`crypto.subtle`, MAI un vettore copiato dal web):
 *      const { corpo, intestazione } = await eventoFirmato(evento, { segreto: SEGRETO_PROVA, t });
 *
 *  Che cosa fa fedelmente (le prove di `finto-db-r2.mjs` lo controllano: se il finto sbaglia, mentono tutte le prove di T44/T51-T54):
 *   · ogni chiamata finisce in `chiamate` (metodo, percorso, query, corpo letto, `Idempotency-Key`); l'intestazione `Authorization` ci finisce
 *     MASCHERATA: nessuna prova può trovare lì la chiave, e nessun log di prova la riceve;
 *   · corpi `application/x-www-form-urlencoded` con la codifica a parentesi quadre, riletti in oggetti (`a[b][0]=x` → `{a:{b:["x"]}}`);
 *   · `Idempotency-Key`: stessa chiave e stesso corpo → la STESSA risposta (stessa sessione, stesso rimborso); stessa chiave con un corpo diverso →
 *     400 `idempotency_error` (come Stripe), che il codice non deve scambiare per un rifiuto vero;
 *   · l'elenco dei rimborsi pagina davvero: `limit` (default 10, massimo 100), `starting_after`, `has_more`, dal più recente;
 *   · un rimborso oltre il pagato → 400 `amount_too_large`; una sessione che non esiste → 404 `resource_missing`;
 *   · si può far FALLIRE una chiamata: `stripe.fallisci("POST /v1/refunds", { stato: 402, errore: { type: "card_error", code: "card_declined" } })`,
 *     oppure `{ rete: true }` (fetch che lancia) o `{ timeout: true }` (non risponde mai: finisce solo se il codice passa un `signal` e lo abortisce).
 *  ⚠️ Non c'è IVA, non c'è 3-D Secure, non ci sono i metodi ritardati: ciò che serve a provare il NOSTRO codice. */

/** Una chiave di PROVA, riconoscibile e inventata (costruita a pezzi: nel sorgente non c'è nessuna stringa che somigli a una chiave). */
export const CHIAVE_PROVA = ["sk", "test", "finta0000000000000000"].join("_");
/** Un segreto di webhook di PROVA, inventato. */
export const SEGRETO_PROVA = ["whsec", "finto0000000000000000"].join("_");
/** L'istante di partenza del finto (secondi Unix): 20/11/2026 ~12:00 UTC. */
export const T0 = Date.UTC(2026, 10, 20, 12, 0, 0) / 1000;

const codifica = new TextEncoder();
const esa = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** `a[b][0]=x&a[b][1]=y&c=z&e[]=1&e[]=2` → `{ a: { b: ["x","y"] }, c: "z", e: ["1","2"] }`. Le chiavi tutte numeriche diventano una lista. */
export function parsaForm(testo) {
  const radice = {};
  for (const coppia of String(testo ?? "").split("&")) {
    if (!coppia) continue;
    const i = coppia.indexOf("=");
    const chiave = decodeURIComponent((i < 0 ? coppia : coppia.slice(0, i)).replace(/\+/g, " "));
    const valore = i < 0 ? "" : decodeURIComponent(coppia.slice(i + 1).replace(/\+/g, " "));
    const parti = [...chiave.matchAll(/^[^[\]]+|\[([^[\]]*)\]/g)].map((m) => (m[1] !== undefined ? m[1] : m[0]));
    let ora = radice;
    parti.forEach((p, n) => {
      const ultimo = n === parti.length - 1;
      if (p === "") { ora.push(valore); return; } // `e[]=x`: si aggiunge in coda alla lista
      if (ultimo) ora[p] = valore;
      else ora = ora[p] ??= parti[n + 1] === "" ? [] : {};
    });
  }
  const rifinisci = (v) => {
    if (Array.isArray(v)) return v.map(rifinisci);
    if (!v || typeof v !== "object") return v;
    const chiavi = Object.keys(v);
    if (chiavi.length && chiavi.every((k) => /^\d+$/.test(k))) return chiavi.sort((a, b) => a - b).map((k) => rifinisci(v[k]));
    return Object.fromEntries(chiavi.map((k) => [k, rifinisci(v[k])]));
  };
  return rifinisci(radice);
}

/** Il valore dell'intestazione `Stripe-Signature` per un corpo (stringa o byte): `t=<secondi>,v1=<HMAC-SHA256 di "t.corpo" in esadecimale>`. Con `crypto.subtle`. */
export async function firmaStripe(corpo, segreto, t) {
  const byte = typeof corpo === "string" ? codifica.encode(corpo) : corpo;
  const chiave = await crypto.subtle.importKey("raw", codifica.encode(segreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const messaggio = new Uint8Array([...codifica.encode(`${t}.`), ...byte]);
  return `t=${t},v1=${esa(await crypto.subtle.sign("HMAC", chiave, messaggio))}`;
}
/** Un evento pronto per il webhook: il corpo in BYTE (come lo legge `arrayBuffer()`) e l'intestazione firmata. `bom` mette un BOM davanti AI BYTE FIRMATI. */
export async function eventoFirmato(evento, { segreto = SEGRETO_PROVA, t = T0, bom = false } = {}) {
  const testo = JSON.stringify(evento);
  const corpo = bom ? new Uint8Array([0xef, 0xbb, 0xbf, ...codifica.encode(testo)]) : codifica.encode(testo);
  return { corpo, intestazione: await firmaStripe(corpo, segreto, t) };
}

const JSON_TIPO = { "content-type": "application/json", "request-id": "req_prova" };
const risposta = (stato, corpo, extra = {}) => new Response(JSON.stringify(corpo), { status: stato, headers: { ...JSON_TIPO, ...extra } });
const errore = (stato, type, code, extra = {}) => risposta(stato, { error: { type, ...(code ? { code } : {}), message: "messaggio di Stripe (non deve mai arrivare nei log del codice)" } }, extra);

/**
 * @param {object} [o]
 * @param {string} [o.chiave]    la chiave che il finto accetta (default `CHIAVE_PROVA`): un'altra → 401
 * @param {() => number} [o.adesso]  secondi Unix; i rimborsi e le sessioni portano questo istante
 * @param {"succeeded"|"pending"} [o.statoRimborso]  come nascono i rimborsi
 */
export function stripeFinto({ chiave = CHIAVE_PROVA, adesso = () => T0, statoRimborso = "succeeded" } = {}) {
  const chiamate = [];
  const sessioni = new Map();
  const pagamenti = new Map(); // payment_intent → { id, amount, rimborsato, metodo, sessione }
  const rimborsi = []; // in ordine di creazione
  const idem = new Map(); // «metodo percorso|chiave» → { corpo, risposta }
  const guasti = new Map(); // «METODO /percorso» → lista di descrittori da consumare
  let n = 0;

  const prossimo = (pre) => `${pre}${String(++n).padStart(16, "0")}`;

  function nuovaSessione(c) {
    const righe = Array.isArray(c.line_items) ? c.line_items : [];
    const spedizione = Number(c.shipping_options?.[0]?.shipping_rate_data?.fixed_amount?.amount ?? 0);
    const id = prossimo("cs_test_");
    const s = {
      id, object: "checkout.session", status: "open", payment_status: "unpaid", livemode: false, mode: c.mode, currency: "eur",
      amount_total: righe.reduce((t, r) => t + Number(r.price_data?.unit_amount ?? 0) * Number(r.quantity ?? 0), 0) + spedizione,
      client_reference_id: c.client_reference_id ?? null, customer_email: c.customer_email ?? null, payment_intent: null,
      expires_at: Number(c.expires_at ?? adesso() + 1800), url: `https://checkout.stripe.com/c/pay/${id}`, success_url: c.success_url, cancel_url: c.cancel_url,
      metadata: c.metadata ?? {}, payment_intent_metadata: c.payment_intent_data?.metadata ?? {},
    };
    sessioni.set(id, s);
    return s;
  }

  /** Il lavoro vero di una chiamata, DOPO guasti e idempotenza. */
  function gestisci(metodo, percorso, query, corpo) {
    let m;
    if (metodo === "POST" && percorso === "/v1/checkout/sessions") {
      if (corpo?.mode !== "payment" || !corpo?.success_url || !Array.isArray(corpo?.line_items) || !corpo.line_items.length) return errore(400, "invalid_request_error", "parameter_missing");
      return risposta(200, nuovaSessione(corpo));
    }
    if (metodo === "GET" && percorso === "/v1/checkout/sessions") {
      const limite = Math.min(100, Math.max(1, Number(query.limit ?? 10)));
      const tutte = [...sessioni.values()].reverse();
      return risposta(200, { object: "list", data: tutte.slice(0, limite), has_more: tutte.length > limite });
    }
    if ((m = percorso.match(/^\/v1\/checkout\/sessions\/([^/]+)(\/expire)?$/))) {
      const s = sessioni.get(m[1]);
      if (!s) return errore(404, "invalid_request_error", "resource_missing");
      if (metodo === "GET" && !m[2]) return risposta(200, s);
      if (metodo === "POST" && m[2]) {
        if (s.status !== "open") return errore(400, "invalid_request_error", null);
        s.status = "expired";
        return risposta(200, s);
      }
    }
    if (metodo === "POST" && percorso === "/v1/refunds") {
      const pi = pagamenti.get(corpo?.payment_intent);
      if (!pi) return errore(400, "invalid_request_error", "resource_missing");
      const importo = corpo.amount === undefined ? pi.amount - pi.rimborsato : Number(corpo.amount);
      if (!Number.isInteger(importo) || importo <= 0) return errore(400, "invalid_request_error", "parameter_invalid_integer");
      if (importo > pi.amount - pi.rimborsato) return errore(400, "invalid_request_error", "amount_too_large");
      return risposta(200, creaRimborso(pi, importo, corpo.metadata ?? {}));
    }
    if (metodo === "GET" && percorso === "/v1/refunds") {
      const limite = Math.min(100, Math.max(1, Number(query.limit ?? 10)));
      let lista = rimborsi.filter((r) => !query.payment_intent || r.payment_intent === query.payment_intent).reverse(); // dal più recente
      if (query.starting_after) {
        const i = lista.findIndex((r) => r.id === query.starting_after);
        if (i < 0) return errore(400, "invalid_request_error", "resource_missing");
        lista = lista.slice(i + 1);
      }
      return risposta(200, { object: "list", data: lista.slice(0, limite), has_more: lista.length > limite });
    }
    if (metodo === "GET" && (m = percorso.match(/^\/v1\/payment_intents\/([^/]+)$/))) {
      const pi = pagamenti.get(m[1]);
      if (!pi) return errore(404, "invalid_request_error", "resource_missing");
      const carica = { id: `ch_${pi.id.slice(3)}`, payment_method_details: { type: pi.metodo } };
      const espandi = [].concat(query.expand ?? []);
      return risposta(200, { id: pi.id, object: "payment_intent", amount: pi.amount, status: "succeeded", latest_charge: espandi.includes("latest_charge") ? carica : carica.id });
    }
    return errore(404, "invalid_request_error", "resource_missing");
  }
  function creaRimborso(pi, importo, metadata) {
    const r = { id: prossimo("re_"), object: "refund", amount: importo, currency: "eur", status: statoRimborso, payment_intent: pi.id, metadata, created: adesso() };
    rimborsi.push(r);
    if (statoRimborso === "succeeded") pi.rimborsato += importo;
    return r;
  }

  async function fetchFinto(url, init = {}) {
    const u = new URL(url);
    if (u.origin !== "https://api.stripe.com") throw new Error(`il finto Stripe risponde solo a https://api.stripe.com, non a ${u.origin}`);
    const metodo = String(init.method ?? "GET").toUpperCase();
    const intestazioni = Object.fromEntries([...new Headers(init.headers ?? {}).entries()]);
    const corpoGrezzo = typeof init.body === "string" ? init.body : init.body ? new URLSearchParams(init.body).toString() : "";
    const corpo = corpoGrezzo ? parsaForm(corpoGrezzo) : undefined;
    const query = parsaForm(u.search.slice(1));
    const chiave_ = `${metodo} ${u.pathname}`;
    const chiamata = {
      metodo, percorso: u.pathname, query, corpo, corpoGrezzo,
      intestazioni: { ...intestazioni, authorization: intestazioni.authorization ? "Bearer ***" : undefined }, // la chiave non resta in nessun registro
      chiaveIdempotenza: intestazioni["idempotency-key"] ?? null,
      versioneApi: intestazioni["stripe-version"] ?? null,
    };
    chiamate.push(chiamata);

    if (intestazioni.authorization !== `Bearer ${chiave}`) return errore(401, "invalid_request_error", null);

    const guasto = guasti.get(chiave_)?.shift() ?? null;
    if (guasto?.rete) throw new TypeError("fetch failed");
    if (guasto?.timeout) {
      await new Promise((_, rifiuta) => {
        if (!init.signal) return rifiuta(new Error("timeout (nessun signal passato)"));
        if (init.signal.aborted) return rifiuta(new DOMException("aborted", "AbortError"));
        init.signal.addEventListener("abort", () => rifiuta(new DOMException("aborted", "AbortError")), { once: true });
      });
    }
    if (guasto?.stato) return errore(guasto.stato, guasto.errore?.type ?? "api_error", guasto.errore?.code ?? null);

    // idempotenza (solo POST con la chiave)
    const k = chiamata.chiaveIdempotenza && metodo === "POST" ? `${u.pathname}|${chiamata.chiaveIdempotenza}` : null;
    const visto = k ? idem.get(k) : null;
    if (visto) {
      if (visto.corpo !== corpoGrezzo) return errore(400, "idempotency_error", null);
      return new Response(visto.testo, { status: visto.stato, headers: { ...JSON_TIPO, "idempotent-replayed": "true" } });
    }
    const r = gestisci(metodo, u.pathname, query, corpo);
    if (k && r.status < 500) idem.set(k, { corpo: corpoGrezzo, testo: await r.clone().text(), stato: r.status });
    return r;
  }

  return {
    fetch: fetchFinto,
    chiamate,
    /** Le chiamate a un metodo e un percorso (o un suo inizio). */
    chiamateA: (metodo, percorso) => chiamate.filter((c) => c.metodo === metodo && c.percorso.startsWith(percorso)),
    azzera: () => { chiamate.length = 0; },
    /** La prossima chiamata a «METODO /percorso» (esatto) fallisce così; con `volte` si ripete. */
    fallisci(chiaveChiamata, descrittore, volte = 1) {
      const lista = guasti.get(chiaveChiamata) ?? [];
      for (let i = 0; i < volte; i++) lista.push(descrittore);
      guasti.set(chiaveChiamata, lista);
    },
    sessione: (id) => sessioni.get(id),
    sessioni: () => [...sessioni.values()],
    rimborsi: () => [...rimborsi],
    /** Il cliente paga la sessione: diventa `complete` e `paid`, nasce il pagamento (payment_intent). Restituisce la sessione. */
    paga(idSessione, { metodo = "card" } = {}) {
      const s = sessioni.get(idSessione);
      if (!s || s.status !== "open") throw new Error("paga: la sessione non è aperta");
      const id = prossimo("pi_");
      pagamenti.set(id, { id, amount: s.amount_total, rimborsato: 0, metodo, sessione: s.id });
      Object.assign(s, { status: "complete", payment_status: "paid", payment_intent: id });
      return s;
    },
    /** Un rimborso fatto dal PANNELLO di Stripe (senza i nostri metadati). */
    rimborsaDalPannello(paymentIntent, importo) {
      const pi = pagamenti.get(paymentIntent);
      if (!pi) throw new Error("rimborsaDalPannello: pagamento sconosciuto");
      return creaRimborso(pi, importo, {});
    },
  };
}
