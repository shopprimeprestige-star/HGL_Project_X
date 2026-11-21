/** ── NEGOZIO · RILASCIO 2 · T44 · IL CLIENT HTTP DI STRIPE (senza SDK) E LA SESSIONE DI CASSA ─────────────
 *  `src/shop/stripe/{tipi,client,sessione}.ts` (D45, D47), sempre contro il finto `_stripe-finto.mjs`: nessuna rete, nessuna chiave vera.
 *   · ogni chiamata porta `Authorization: Bearer`, `Stripe-Version` e (le POST che creano) l'`Idempotency-Key`; corpi `application/x-www-form-urlencoded`
 *     con le parentesi quadre; tetto di 10 s con `AbortController`;
 *   · gli errori escono come `{codice}` (da `error.code`/`error.type`), MAI col `message` di Stripe; timeout e rete hanno il loro codice;
 *     l'errore di idempotenza è distinto da un rifiuto vero (D47: non chiude l'ordine);
 *   · `corpoSessione` è puro: importi interi, nessuna immagine, spedizione `fixed_amount`, `expires_at` da `scade_il` (stesso valore a ogni chiamata),
 *     `client_reference_id`, `payment_intent_data[metadata]`, niente dati del cliente oltre l'email, valori codificati (un `&` o `[` non inietta parametri);
 *   · prova di sorgente: nessuna stringa che somigli a una chiave in `src/` e `supabase/`; le chiavi lette solo a richiesta. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { stripeFinto, parsaForm, CHIAVE_PROVA } from "./_stripe-finto.mjs";
import { uuid } from "./dati.mjs";

const SEGNO_DI_STRIPE = "messaggio di Stripe"; // il `message` del finto: non deve comparire mai nei risultati
/** Una chiave a pezzi: nel sorgente di una prova non c'è nulla che somigli a una chiave. */
const chiave = (...p) => p.join("_");
const ESTENSIONI_TESTO = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".sql", ".md", ".toml", ".jsonc", ".html", ".css", ".txt", ".yml", ".yaml"]);
/** ⚠️ Più stretta di quella del piano (`(sk|rk|whsec)_[A-Za-z0-9]{16,}`), che NON vede `sk_test_…`: dopo `sk_` c'è `test_`, con il trattino basso. */
const SOMIGLIA_A_UNA_CHIAVE = /(?:(?:sk|rk)_(?:test|live)|whsec)_[A-Za-z0-9]{16,}/;

/** Tutti i file di testo sotto `dir` (senza node_modules né cartelle nascoste). */
function files(dir) {
  const fuori = [];
  const giro = (d) => {
    for (const nome of readdirSync(d)) {
      if (nome === "node_modules" || nome.startsWith(".")) continue;
      const p = join(d, nome);
      const s = statSync(p);
      if (s.isDirectory()) giro(p);
      else if (s.size < 3_000_000 && ESTENSIONI_TESTO.has(extname(nome))) fuori.push(p);
    }
  };
  if (existsSync(dir)) giro(dir);
  return fuori;
}

export async function prove(mod, { c, gruppo, radice }) {
  const T = mod["shop/stripe/tipi"];
  const K = mod["shop/stripe/client"];
  const S = mod["shop/stripe/sessione"];
  gruppo("SHOP R2 · T44 · CLIENT STRIPE E SESSIONE DI CASSA (21/11/2026)");
  c("i moduli ci sono (tipi, client, sessione)", true, !!(T && K && S));
  if (!(T && K && S)) return;
  const { creaClientStripe, codificaForm } = K;
  const { corpoSessione, chiaveSessione } = S;

  /* ── tipi: versione dell'API, tetto, prefissi ── */
  c("la versione dell'API è una costante datata (AAAA-MM-GG[.nome])", true, /^\d{4}-\d{2}-\d{2}(\.[a-z]+)?$/.test(T.VERSIONE_API_STRIPE));
  c("il tetto di tempo è 10 s", 10_000, T.TIMEOUT_STRIPE_MS);
  c("chiave di prova sk → prova", "prova", T.modalitaDellaChiave(chiave("sk", "test", "abc")));
  c("chiave di prova ristretta rk → prova", "prova", T.modalitaDellaChiave(chiave("rk", "test", "abc")));
  c("chiave reale sk → reale", "reale", T.modalitaDellaChiave(chiave("sk", "live", "abc")));
  c("chiave reale ristretta rk → reale", "reale", T.modalitaDellaChiave(chiave("rk", "live", "abc")));
  c("chiave pubblicabile (pk) → null", null, T.modalitaDellaChiave(chiave("pk", "test", "abc")));
  c("segreto del webhook → null", null, T.modalitaDellaChiave(chiave("whsec", "abc")));
  c("vuota, null, numero → null", [null, null, null], [T.modalitaDellaChiave(""), T.modalitaDellaChiave(null), T.modalitaDellaChiave(5)]);
  c("la modalità non ripete la chiave", false, JSON.stringify(T.modalitaDellaChiave(CHIAVE_PROVA)).includes("finta"));

  /* ── la codifica dei corpi ── */
  c("codificaForm: annidati e liste con l'indice", "a[b][0]=x&a[b][1]=y&c=z", codificaForm({ a: { b: ["x", "y"] }, c: "z" }));
  c("codificaForm: numeri e booleani come testo, null e undefined saltati", "n=5&v=true&f=false", codificaForm({ n: 5, v: true, f: false, nullo: null, vuoto: undefined }));
  const strano = "Tom & Jerry [x]=1 + 100% à ü €";
  const giro = parsaForm(codificaForm({ nome: strano, riga: [{ nome: strano }] }));
  c("un valore con & [ ] = + % e accenti torna uguale (nessuna iniezione)", { nome: strano, riga: [{ nome: strano }] }, giro);
  c("e il corpo ha solo i due parametri (nessun & non codificato)", 2, codificaForm({ nome: strano, riga: [{ nome: strano }] }).split("&").length);
  c("una CHIAVE con & viene codificata anch'essa", { "a&b": "1" }, parsaForm(codificaForm({ "a&b": "1" })));
  c("numero non finito → errore (mai «NaN» a Stripe)", true, (() => { try { codificaForm({ n: Number.NaN }); return false; } catch { return true; } })());

  /* ── il client contro il finto ── */
  const nuovo = (opz = {}) => {
    const stripe = stripeFinto();
    return { stripe, client: creaClientStripe({ chiave: CHIAVE_PROVA, fetch: stripe.fetch, ...opz }) };
  };
  const ordine = { id: uuid(0x6001), email: "cliente@esempio.test", scadeIl: "2026-11-20T12:31:00.000Z" };
  const righe = [
    { nome: "Prodotto di prova uno", variante: "Taglia M", qty: 2, prezzoCent: 1250 },
    { nome: "Prodotto di prova due", variante: null, qty: 1, prezzoCent: 2490 },
  ];
  const url = { successo: "https://sito.test/shop/ordine/HG-1?t=abc", annullo: "https://sito.test/shop/checkout?annullato=1" };
  const campi = corpoSessione(ordine, righe, { costoCent: 490 }, url);
  const TOTALE = 2 * 1250 + 2490 + 490;

  {
    const { stripe, client } = nuovo();
    const r = await client.creaSessione(campi, "sessione-a-1");
    c("creaSessione → ok con id e indirizzo di Stripe", { ok: true, id: true, url: true }, { ok: r.ok, id: /^cs_test_/.test(r.dati?.id ?? ""), url: (r.dati?.url ?? "").startsWith("https://checkout.stripe.com/") });
    c("la sessione dice il totale (righe + spedizione) in centesimi", TOTALE, r.dati?.amount_total);
    const ch = stripe.chiamate[0];
    c("POST /v1/checkout/sessions", ["POST", "/v1/checkout/sessions"], [ch.metodo, ch.percorso]);
    c("porta l'Idempotency-Key", "sessione-a-1", ch.chiaveIdempotenza);
    c("porta Stripe-Version = la costante", T.VERSIONE_API_STRIPE, ch.versioneApi);
    c("porta Authorization Bearer (il finto la accetta: niente 401)", true, r.ok);
    c("corpo form-urlencoded", "application/x-www-form-urlencoded", ch.intestazioni["content-type"]);
    c("il corpo arriva con le parentesi quadre", ["2", "1250", "payment"], [ch.corpo.line_items[0].quantity, ch.corpo.line_items[0].price_data.unit_amount, ch.corpo.mode]);
    c("la chiave non è in nessun registro del finto", false, JSON.stringify(stripe.chiamate).includes("finta0000"));
    c("la chiave non è nel risultato", false, JSON.stringify(r).includes("finta0000"));

    /* idempotenza: stessa chiave e stesso corpo → la stessa sessione; stessa chiave e corpo diverso → errore di idempotenza, NON un rifiuto */
    const ancora = await client.creaSessione(campi, "sessione-a-1");
    c("stessa chiave e stesso corpo → la stessa sessione", r.dati.id, ancora.dati?.id);
    c("due richieste uguali: una sola sessione nel finto", 1, stripe.sessioni().length);
    const diverso = await client.creaSessione({ ...campi, customer_email: "altro@esempio.test" }, "sessione-a-1");
    c("stessa chiave e corpo diverso → {codice:'idempotenza'}", "idempotenza", diverso.errore?.codice);
    c("l'errore di idempotenza si può ritentare (non è un rifiuto vero)", true, diverso.errore?.ritentabile);
    c("e non porta il messaggio di Stripe", false, JSON.stringify(diverso).includes(SEGNO_DI_STRIPE));

    /* senza chiave di idempotenza non si crea nulla */
    stripe.azzera();
    const senza = await client.creaSessione(campi, "");
    c("senza Idempotency-Key → errore, nessuna chiamata", ["chiave_idempotenza_mancante", 0], [senza.errore?.codice, stripe.chiamate.length]);
    const senza2 = await client.creaRimborso({ payment_intent: "pi_x", amount: 100 }, undefined);
    c("anche il rimborso senza Idempotency-Key → errore, nessuna chiamata", ["chiave_idempotenza_mancante", 0], [senza2.errore?.codice, stripe.chiamate.length]);
  }

  /* ── gli errori: codici, mai il messaggio ── */
  {
    const { stripe, client } = nuovo();
    stripe.fallisci("POST /v1/checkout/sessions", { stato: 402, errore: { type: "card_error", code: "card_declined" } });
    const r = await client.creaSessione(campi, "k-402");
    c("402 di Stripe → {codice:'card_declined'}", ["card_declined", 402, false], [r.errore?.codice, r.errore?.stato, r.errore?.ritentabile]);
    c("il risultato non contiene il messaggio di Stripe", false, JSON.stringify(r).includes(SEGNO_DI_STRIPE));
    c("l'errore ha solo codice, stato e ritentabile", ["codice", "ritentabile", "stato"], Object.keys(r.errore).sort());
    stripe.fallisci("POST /v1/checkout/sessions", { stato: 400, errore: { type: "invalid_request_error" } });
    const r2 = await client.creaSessione(campi, "k-400");
    c("400 senza `code` → il codice è il tipo", "invalid_request_error", r2.errore?.codice);
    stripe.fallisci("POST /v1/checkout/sessions", { stato: 500, errore: { type: "api_error" } });
    const r3 = await client.creaSessione(campi, "k-500");
    c("500 → ritentabile", true, r3.errore?.ritentabile);
    stripe.fallisci("POST /v1/checkout/sessions", { stato: 429, errore: { type: "invalid_request_error", code: "rate_limit" } });
    const r4 = await client.creaSessione(campi, "k-429");
    c("429 → ritentabile", true, r4.errore?.ritentabile);
    stripe.fallisci("POST /v1/checkout/sessions", { stato: 400, errore: { type: "invalid_request_error", code: "x".repeat(300) } });
    const r5 = await client.creaSessione(campi, "k-lungo");
    c("un `code` lungo o strano non passa com'è", "invalid_request_error", r5.errore?.codice);
    stripe.fallisci("POST /v1/checkout/sessions", { stato: 400, errore: { type: "invalid_request_error", code: "ciao <b>mondo</b>" } });
    const r6 = await client.creaSessione(campi, "k-html");
    c("un `code` con caratteri strani non passa com'è", "invalid_request_error", r6.errore?.codice);
  }
  {
    const stripe = stripeFinto();
    const client = creaClientStripe({ chiave: `${CHIAVE_PROVA}-sbagliata`, fetch: stripe.fetch });
    const r = await client.sonda();
    c("chiave rifiutata (401) → {codice:'chiave_rifiutata'}, non ritentabile", ["chiave_rifiutata", false], [r.errore?.codice, r.errore?.ritentabile]);
  }
  {
    const { stripe, client } = nuovo({ timeoutMs: 30 });
    stripe.fallisci("POST /v1/checkout/sessions", { timeout: true });
    const t0 = Date.now();
    const r = await client.creaSessione(campi, "k-timeout");
    c("un timeout → {codice:'timeout'}, ritentabile", ["timeout", true], [r.errore?.codice, r.errore?.ritentabile]);
    c("il timeout scatta in tempo (AbortController)", true, Date.now() - t0 < 2000);
    stripe.fallisci("GET /v1/checkout/sessions", { rete: true });
    const r2 = await client.sonda();
    c("la rete che cade → {codice:'rete'}, ritentabile", ["rete", true], [r2.errore?.codice, r2.errore?.ritentabile]);
    const r3 = await creaClientStripe({ chiave: CHIAVE_PROVA, fetch: async () => { throw "non è un Error"; } }).sonda();
    c("un fetch che lancia un testo → {codice:'rete'}", "rete", r3.errore?.codice);
    const r4 = await creaClientStripe({ chiave: CHIAVE_PROVA, fetch: async () => new Response("<html>bad gateway</html>", { status: 502 }) }).sonda();
    c("risposta non JSON → {codice:'risposta_non_valida'}, ritentabile se 5xx", ["risposta_non_valida", true], [r4.errore?.codice, r4.errore?.ritentabile]);
    const r5 = await creaClientStripe({ chiave: CHIAVE_PROVA, fetch: async () => new Response("[1,2]", { status: 200 }) }).sonda();
    c("risposta 200 che non è un oggetto → non ok", false, r5.ok);
  }
  {
    let chiamato = 0;
    const client = creaClientStripe({ chiave: "", fetch: async () => { chiamato++; return new Response("{}"); } });
    const r = await client.sonda();
    c("chiave mancante → {codice:'chiave_mancante'} e nessuna chiamata", ["chiave_mancante", 0], [r.errore?.codice, chiamato]);
    const r2 = await creaClientStripe({ chiave: undefined, fetch: async () => new Response("{}") }).creaSessione(campi, "k");
    c("chiave undefined → chiave_mancante, non lancia", "chiave_mancante", r2.errore?.codice);
  }

  /* ── le altre chiamate ── */
  {
    const { stripe, client } = nuovo();
    const s = (await client.creaSessione(campi, "k1")).dati;
    const letta = await client.leggiSessione(s.id);
    c("leggiSessione: aperta e non pagata", ["open", "unpaid", null], [letta.dati?.status, letta.dati?.payment_status, letta.dati?.payment_intent]);
    c("leggiSessione: GET senza Idempotency-Key", null, stripe.chiamateA("GET", `/v1/checkout/sessions/${s.id}`)[0].chiaveIdempotenza);
    c("leggiSessione: id d'altro tipo → id_non_valido, nessuna chiamata", ["id_non_valido", 0], await (async () => {
      stripe.azzera();
      const r = await client.leggiSessione("../../v1/refunds");
      return [r.errore?.codice, stripe.chiamate.length];
    })());
    c("leggiSessione: id vuoto → id_non_valido", "id_non_valido", (await client.leggiSessione("")).errore?.codice);
    c("leggiSessione: sessione sconosciuta → resource_missing", ["resource_missing", 404, false], await (async () => {
      const r = await client.leggiSessione("cs_test_nonesiste");
      return [r.errore?.codice, r.errore?.stato, r.errore?.ritentabile];
    })());
    const scaduta = await client.scadiSessione(s.id);
    c("scadiSessione: la sessione aperta scade", "expired", scaduta.dati?.status);
    c("scadiSessione: POST /expire", "POST", stripe.chiamateA("POST", `/v1/checkout/sessions/${s.id}/expire`)[0]?.metodo);
    const ancora = await client.scadiSessione(s.id);
    c("scadiSessione: già scaduta → rifiuto vero, non ritentabile", [false, false], [ancora.ok, ancora.errore?.ritentabile]);

    const pagata = stripe.paga((await client.creaSessione({ ...campi, expires_at: undefined }, "k2")).dati.id);
    const l2 = await client.leggiSessione(pagata.id);
    c("leggiSessione: pagata → paid, con il payment_intent", ["complete", "paid", true], [l2.dati?.status, l2.dati?.payment_status, /^pi_/.test(l2.dati?.payment_intent ?? "")]);
    const pi = l2.dati.payment_intent;
    const pag = await client.leggiPagamento(pi);
    c("leggiPagamento: importo, stato e metodo (latest_charge espanso)", [TOTALE, "succeeded", "card"], [pag.dati?.amount, pag.dati?.status, pag.dati?.metodo]);
    c("leggiPagamento: chiede expand[]=latest_charge", ["latest_charge"], [].concat(stripe.chiamateA("GET", `/v1/payment_intents/${pi}`)[0].query.expand));
    c("leggiPagamento: pagamento sconosciuto → resource_missing", "resource_missing", (await client.leggiPagamento("pi_nonesiste")).errore?.codice);
    c("leggiPagamento: id strano → id_non_valido", "id_non_valido", (await client.leggiPagamento("pi_x/../y")).errore?.codice);

    /* rimborsi */
    const rb = await client.creaRimborso({ payment_intent: pi, amount: 1000, metadata: { riga_id: uuid(0x7001), ordine_id: ordine.id } }, uuid(0x7001));
    c("creaRimborso: ok, importo e metadati", [1000, "succeeded", uuid(0x7001)], [rb.dati?.amount, rb.dati?.status, rb.dati?.metadata?.riga_id]);
    c("creaRimborso: l'Idempotency-Key è quella passata", uuid(0x7001), stripe.chiamateA("POST", "/v1/refunds")[0].chiaveIdempotenza);
    const rb2 = await client.creaRimborso({ payment_intent: pi, amount: 1000, metadata: { riga_id: uuid(0x7001), ordine_id: ordine.id } }, uuid(0x7001));
    c("creaRimborso ripetuto con la stessa chiave → lo stesso rimborso", [rb.dati?.id, 1], [rb2.dati?.id, stripe.rimborsi().length]);
    const troppo = await client.creaRimborso({ payment_intent: pi, amount: TOTALE }, "k-troppo");
    c("rimborso oltre il pagato → {codice:'amount_too_large'}, non ritentabile", ["amount_too_large", false], [troppo.errore?.codice, troppo.errore?.ritentabile]);
    c("elencaRimborsi: li vede (anche uno fatto dal pannello)", 2, await (async () => {
      stripe.rimborsaDalPannello(pi, 500);
      return (await client.elencaRimborsi(pi)).dati?.rimborsi.length;
    })());
  }
  {
    /* 150 rimborsi → due pagine; 600 → tetto di 5 pagine e `troncato` */
    const { stripe, client } = nuovo();
    const pagata = stripe.paga((await client.creaSessione(campi, "k-p")).dati.id);
    const pi = pagata.payment_intent;
    for (let i = 0; i < 100; i++) stripe.rimborsaDalPannello(pi, 1);
    stripe.azzera();
    const cento = await client.elencaRimborsi(pi);
    c("100 rimborsi → una pagina sola (limit=100)", [100, 1, false], [cento.dati?.rimborsi.length, stripe.chiamateA("GET", "/v1/refunds").length, cento.dati?.troncato]);
    c("la prima richiesta chiede limit=100 e il pagamento", ["100", pi], [stripe.chiamate[0].query.limit, stripe.chiamate[0].query.payment_intent]);
    for (let i = 0; i < 50; i++) stripe.rimborsaDalPannello(pi, 1);
    stripe.azzera();
    const centocinquanta = await client.elencaRimborsi(pi);
    const ids = centocinquanta.dati?.rimborsi.map((r) => r.id) ?? [];
    c("150 rimborsi → due pagine, tutti e 150, senza doppioni", [150, 2, 150, false], [ids.length, stripe.chiamateA("GET", "/v1/refunds").length, new Set(ids).size, centocinquanta.dati?.troncato]);
    c("la seconda pagina riparte dall'ultimo (starting_after)", ids[99], stripe.chiamate[1]?.query.starting_after);
    c("i rimborsi hanno la forma di Stripe che serve a shop_rimborso_riconcilia", ["id", "amount", "status", "metadata"], ["id", "amount", "status", "metadata"].filter((k) => k in (centocinquanta.dati?.rimborsi[0] ?? {})));
    for (let i = 0; i < 450; i++) stripe.rimborsaDalPannello(pi, 1);
    stripe.azzera();
    const seicento = await client.elencaRimborsi(pi);
    c("600 rimborsi → 5 pagine al massimo, `troncato`", [500, 5, true], [seicento.dati?.rimborsi.length, stripe.chiamateA("GET", "/v1/refunds").length, seicento.dati?.troncato]);
    stripe.fallisci("GET /v1/refunds", { stato: 500, errore: { type: "api_error" } });
    const guasto = await client.elencaRimborsi(pi);
    c("un guasto di Stripe → errore (mai un elenco parziale spacciato per intero)", [false, true], [guasto.ok, guasto.errore?.ritentabile]);
    stripe.azzera();
    c("paymentIntent strano → id_non_valido, nessuna chiamata", ["id_non_valido", 0], [(await client.elencaRimborsi("pi_x&limit=1")).errore?.codice, stripe.chiamate.length]);
  }
  {
    const { stripe, client } = nuovo();
    const r = await client.sonda();
    c("sonda: lettura innocua GET /v1/checkout/sessions?limit=1", [true, "GET", "1"], [r.ok, stripe.chiamate[0].metodo, stripe.chiamate[0].query.limit]);
    c("sonda: la modalità viene dal prefisso della chiave, mai la chiave", ["prova", false], [r.dati?.modalita, JSON.stringify(r).includes("finta")]);
  }

  /* ── corpoSessione: puro, D47 ── */
  const uno = corpoSessione(ordine, righe, { costoCent: 490 }, url);
  const due = corpoSessione(ordine, righe, { costoCent: 490 }, url);
  c("corpoSessione: due chiamate identiche → corpi identici", codificaForm(uno), codificaForm(due));
  c("mode payment, locale it, indirizzi di ritorno, email", ["payment", "it", url.successo, url.annullo, ordine.email], [uno.mode, uno.locale, uno.success_url, uno.cancel_url, uno.customer_email]);
  c("client_reference_id e metadata = id dell'ordine", [ordine.id, ordine.id], [uno.client_reference_id, uno.metadata.ordine_id]);
  c("payment_intent_data[metadata][ordine_id] (ripiego dei rimborsi)", ordine.id, uno.payment_intent_data.metadata.ordine_id);
  c("expires_at = scade_il dell'ordine in secondi", Date.parse(ordine.scadeIl) / 1000, uno.expires_at);
  c("expires_at non dipende dall'orologio (cambia solo con scade_il)", [uno.expires_at + 60], [corpoSessione({ ...ordine, scadeIl: "2026-11-20T12:32:00.000Z" }, righe, { costoCent: 490 }, url).expires_at]);
  c("una riga per riga d'ordine, importi interi in centesimi", [[2, 1250], [1, 2490]], uno.line_items.map((r) => [r.quantity, r.price_data.unit_amount]));
  c("tutti gli importi sono interi", true, uno.line_items.every((r) => Number.isInteger(r.price_data.unit_amount) && Number.isInteger(r.quantity)) && Number.isInteger(uno.shipping_options[0].shipping_rate_data.fixed_amount.amount));
  c("valuta eur", ["eur", "eur"], [uno.line_items[0].price_data.currency, uno.shipping_options[0].shipping_rate_data.fixed_amount.currency]);
  c("il nome è prodotto + variante (senza variante: il prodotto)", ["Prodotto di prova uno · Taglia M", "Prodotto di prova due"], uno.line_items.map((r) => r.price_data.product_data.name));
  c("nessuna immagine", false, /image/i.test(JSON.stringify(uno)));
  c("spedizione: shipping_options fixed_amount", ["fixed_amount", 490], [uno.shipping_options[0].shipping_rate_data.type, uno.shipping_options[0].shipping_rate_data.fixed_amount.amount]);
  c("spedizione gratuita (0) è ancora una shipping_option", 0, corpoSessione(ordine, righe, { costoCent: 0 }, url).shipping_options[0].shipping_rate_data.fixed_amount.amount);
  c("nessun metodo di pagamento elencato (decide il pannello Stripe)", false, /payment_method_types|payment_method_configuration/.test(JSON.stringify(uno)));
  c("nessun calcolo di IVA", false, /tax/i.test(JSON.stringify(uno)));
  const conAltro = corpoSessione({ ...ordine, telefono: "3391234567", nome: "Mario", cognome: "Rossi", indirizzo: "Via Roma 1", cf: "RSSMRA80A01H501U" }, righe, { costoCent: 490 }, url);
  c("nessun dato del cliente oltre l'email (telefono, nome, indirizzo, CF)", false, /3391234567|Mario|Rossi|Via Roma|RSSMRA/.test(JSON.stringify(conAltro)));
  const iniezione = corpoSessione(ordine, [{ nome: "Parrucca & line_items[0][quantity]=99 [x]", variante: "A=B&mode=subscription", qty: 1, prezzoCent: 5000 }], { costoCent: 0 }, url);
  const riletto = parsaForm(codificaForm(iniezione));
  c("un nome con & e [ non inietta parametri (mode e quantità restano)", ["payment", "1", "Parrucca & line_items[0][quantity]=99 [x] · A=B&mode=subscription"], [riletto.mode, riletto.line_items[0].quantity, riletto.line_items[0].price_data.product_data.name]);
  const rifiuta = (f) => { try { f(); return "non rifiuta"; } catch (e) { return e instanceof Error ? e.message : String(e); } };
  c("prezzo con decimali → rifiutato (mai arrotondato)", "riga_non_valida", rifiuta(() => corpoSessione(ordine, [{ ...righe[0], prezzoCent: 12.5 }], { costoCent: 490 }, url)));
  c("prezzo 0 → rifiutato", "riga_non_valida", rifiuta(() => corpoSessione(ordine, [{ ...righe[0], prezzoCent: 0 }], { costoCent: 490 }, url)));
  c("quantità 0 o con decimali → rifiutata", ["riga_non_valida", "riga_non_valida"], [rifiuta(() => corpoSessione(ordine, [{ ...righe[0], qty: 0 }], { costoCent: 490 }, url)), rifiuta(() => corpoSessione(ordine, [{ ...righe[0], qty: 1.5 }], { costoCent: 490 }, url))]);
  c("nessuna riga → rifiutato", "riga_non_valida", rifiuta(() => corpoSessione(ordine, [], { costoCent: 490 }, url)));
  c("spedizione negativa o con decimali → rifiutata", ["spedizione_non_valida", "spedizione_non_valida"], [rifiuta(() => corpoSessione(ordine, righe, { costoCent: -1 }, url)), rifiuta(() => corpoSessione(ordine, righe, { costoCent: 4.9 }, url))]);
  c("scade_il non valida → rifiutata", "scadenza_non_valida", rifiuta(() => corpoSessione({ ...ordine, scadeIl: "domani" }, righe, { costoCent: 490 }, url)));
  c("indirizzi di ritorno non https → rifiutati", "url_non_valido", rifiuta(() => corpoSessione(ordine, righe, { costoCent: 490 }, { ...url, successo: "javascript:alert(1)" })));
  c("senza email → il campo non c'è (Stripe la chiede in pagina)", false, "customer_email" in corpoSessione({ ...ordine, email: "" }, righe, { costoCent: 490 }, url));
  c("l'eccezione non porta i dati del cliente", false, /cliente@esempio/.test(rifiuta(() => corpoSessione(ordine, [], { costoCent: 490 }, url))));
  /* e la sessione di cui sopra è davvero accettata dal finto con l'expires_at dell'ordine */
  {
    const { client } = nuovo();
    const r = await client.creaSessione(campi, "k-exp");
    c("il finto la crea con expires_at = scade_il", Date.parse(ordine.scadeIl) / 1000, r.dati?.expires_at);
    c("e con client_reference_id = id ordine", ordine.id, r.dati?.client_reference_id);
  }

  /* la chiave di idempotenza della sessione (D47): sessione-<ordine>-<firma>-r<n> */
  c("chiaveSessione: sessione-<ordine>-<firma>-r<n>", `sessione-${ordine.id}-ab12-r0`, chiaveSessione(ordine.id, "ab12", 0));
  c("chiaveSessione: la riprova cambia la chiave", false, chiaveSessione(ordine.id, "ab12", 0) === chiaveSessione(ordine.id, "ab12", 1));
  c("chiaveSessione: uguale a ogni chiamata", chiaveSessione(ordine.id, "ab12", 3), chiaveSessione(ordine.id, "ab12", 3));
  c("chiaveSessione: caratteri strani → rifiutata", "chiave_non_valida", rifiuta(() => chiaveSessione(ordine.id, "a b&c", 0)));
  c("chiaveSessione: riprova negativa o con decimali → rifiutata", ["chiave_non_valida", "chiave_non_valida"], [rifiuta(() => chiaveSessione(ordine.id, "ab", -1)), rifiuta(() => chiaveSessione(ordine.id, "ab", 1.5))]);
  c("chiaveSessione: sta nei 255 segni di Stripe", true, chiaveSessione(ordine.id, "f".repeat(64), 99).length <= 255);

  /* ── prova di sorgente: nessuna chiave in src/ e supabase/, nessuna lettura a livello di modulo ── */
  const tutti = [...files(join(radice, "src")), ...files(join(radice, "supabase"))];
  c("(autoprova) il controllo vede una chiave finta e un segreto di webhook finto", [true, true, true], [SOMIGLIA_A_UNA_CHIAVE.test(chiave("sk", "test", "A".repeat(20))), SOMIGLIA_A_UNA_CHIAVE.test(chiave("rk", "live", "a1".repeat(10))), SOMIGLIA_A_UNA_CHIAVE.test(chiave("whsec", "b".repeat(20)))]);
  c("(autoprova) non scambia il prefisso nudo per una chiave", false, SOMIGLIA_A_UNA_CHIAVE.test(`${chiave("sk", "test", "")} e ${chiave("whsec", "")}`));
  c("ci sono molti file da guardare (la scansione guarda davvero)", true, tutti.length > 300);
  const trovati = tutti.filter((f) => SOMIGLIA_A_UNA_CHIAVE.test(readFileSync(f, "utf8"))).map((f) => f.slice(radice.length + 1));
  c("nessuna stringa che somigli a una chiave in src/ e supabase/", [], trovati);
  const aLivelloDiModulo = tutti
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => /^(export\s+)?(const|let|var)\s[^\n]*(process\.env|env)\W[^\n]*STRIPE_(SECRET_KEY|WEBHOOK_SECRET)/m.test(readFileSync(f, "utf8")))
    .map((f) => f.slice(radice.length + 1));
  c("le chiavi di Stripe non si leggono a livello di modulo (solo a richiesta)", [], aLivelloDiModulo);
  const dentroStripe = readdirSync(join(radice, "src/shop/stripe")).filter((f) => f.endsWith(".ts")).map((f) => [f, readFileSync(join(radice, "src/shop/stripe", f), "utf8")]);
  c("i moduli di src/shop/stripe non leggono l'ambiente (la chiave arriva come argomento)", [], dentroStripe.filter(([, t]) => /process\.env|import\.meta\.env|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/.test(t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))).map(([f]) => f));
  c("i moduli di src/shop/stripe non importano l'SDK né altri pacchetti", [], dentroStripe.filter(([, t]) => /from\s+["'](?!\.\/)[^"']+["']/.test(t)).map(([f]) => f));
  c("i moduli di src/shop/stripe non fanno console.log di errori (nessun log dei messaggi)", [], dentroStripe.filter(([, t]) => /console\.(log|error|warn|info)/.test(t)).map(([f]) => f));
}
