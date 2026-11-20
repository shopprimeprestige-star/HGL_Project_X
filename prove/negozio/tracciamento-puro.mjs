/** ── SHOP R1 · T24 · TRACCIAMENTO PURO: NOMI, EVENTI, HASH, PERMESSO ─────────────
 *  `src/lib/tracciamento/{nomi,eventi,hash,permesso}.ts`: niente rete, niente DOM, niente database.
 *  I vettori (hash, HMAC) sono calcolati FUORI dal codice con `shasum` e `openssl`: se il codice sbagliasse
 *  l'algoritmo, la prova non lo ripeterebbe uguale. Dati: tutti inventati (a@example.com, HG-001…). */

/** Come il confronto di seconda rete di `capi` (D17): minuscole, senza segni. */
const ridotto = (s) => String(s).normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
const VIETATI_RIDOTTI = ["purchase", "completepayment", "refund", "orderplaced", "paymentfailed", "placeanorder"];
const MIN = 60_000;

export async function prove(mod, { c, gruppo }) {
  const N = mod["lib/tracciamento/nomi"];
  const E = mod["lib/tracciamento/eventi"];
  const H = mod["lib/tracciamento/hash"];
  const P = mod["lib/tracciamento/permesso"];
  gruppo("SHOP R1 · T24 · TRACCIAMENTO PURO (20/11/2026)");
  c("i quattro moduli ci sono", [true, true, true, true], [!!N, !!E, !!H, !!P]);
  if (!N || !E || !H || !P) return;

  /* ── NOMI ── */
  const TUTTI = ["PageView", "ViewContent", "Search", "AddToCart", "RemoveFromCart", "ViewCart", "InitiateCheckout", "AddShippingInfo", "AddPaymentInfo", "Contact", "Subscribe", "Lead", "BookingDatePick", "BookingTimePick"];
  c("NOMI_EVENTO è l'elenco di NomeEvento del contratto (§3.4), nello stesso ordine", TUTTI, [...N.NOMI_EVENTO]);
  const mappa = (nome) => [N.MAPPA_NOMI[nome]?.meta, N.MAPPA_NOMI[nome]?.tiktok, N.MAPPA_NOMI[nome]?.ga4];
  c("AddToCart → AddToCart / AddToCart / add_to_cart", ["AddToCart", "AddToCart", "add_to_cart"], mappa("AddToCart"));
  c("PageView → PageView / PageView / page_view", ["PageView", "PageView", "page_view"], mappa("PageView"));
  c("ViewContent → ViewContent / ViewContent / view_item (la lista: view_item_list)", [["ViewContent", "ViewContent", "view_item"], "view_item_list"], [mappa("ViewContent"), N.MAPPA_NOMI.ViewContent.ga4Lista]);
  c("Search → Search / Search / search", ["Search", "Search", "search"], mappa("Search"));
  c("InitiateCheckout → InitiateCheckout / InitiateCheckout / begin_checkout", ["InitiateCheckout", "InitiateCheckout", "begin_checkout"], mappa("InitiateCheckout"));
  c("AddPaymentInfo → AddPaymentInfo / AddPaymentInfo / add_payment_info", ["AddPaymentInfo", "AddPaymentInfo", "add_payment_info"], mappa("AddPaymentInfo"));
  c("Lead → Lead / Lead / generate_lead", ["Lead", "Lead", "generate_lead"], mappa("Lead"));
  c("i nomi solo-Meta: RemoveFromCart, ViewCart, AddShippingInfo non vanno a TikTok (la tabella §1.9 ha «–»)", [null, null, null], ["RemoveFromCart", "ViewCart", "AddShippingInfo"].map((n) => N.MAPPA_NOMI[n].tiktok));
  c("ogni nome ha una mappa per Meta e per GA4", [], TUTTI.filter((n) => !N.MAPPA_NOMI[n]?.meta || !N.MAPPA_NOMI[n]?.ga4));
  c("NOMI_VIETATI = Purchase, CompletePayment, Refund, OrderPlaced, PaymentFailed", ["CompletePayment", "OrderPlaced", "PaymentFailed", "Purchase", "Refund"], [...N.NOMI_VIETATI].sort());
  c("NOMI_CAPI_ANONIMI = l'elenco di D17, nello stesso ordine", ["PageView", "ViewContent", "AddToCart", "Lead", "HighQualityVisit", "BookingDatePick", "BookingTimePick"], [...N.NOMI_CAPI_ANONIMI]);

  /* ── NESSUN NOME VIETATO NELLA LISTA DEI PERMESSI ── */
  c("NOMI_MITTENTE è contenuto in NOMI_EVENTO e non ha doppioni", [true, true], [N.NOMI_MITTENTE.every((n) => TUTTI.includes(n)), new Set(N.NOMI_MITTENTE).size === N.NOMI_MITTENTE.length]);
  c("NOMI_MITTENTE: nessun nome vietato, nemmeno ridotto a minuscole senza segni", [], N.NOMI_MITTENTE.filter((n) => N.NOMI_VIETATI.includes(n) || VIETATI_RIDOTTI.includes(ridotto(n))));
  c("NOMI_MITTENTE non ha `Lead`: il mittente del server non porta dati personali, il Lead passa da `capi` con i dati con hash", false, N.NOMI_MITTENTE.includes("Lead"));
  c("NOMI_CAPI_ANONIMI: nessun nome vietato, nemmeno ridotto", [], N.NOMI_CAPI_ANONIMI.filter((n) => N.NOMI_VIETATI.includes(n) || VIETATI_RIDOTTI.includes(ridotto(n))));
  c("nessun nome mandato alle piattaforme (Meta, TikTok, GA4) è un nome d'acquisto: nemmeno `purchase` di Google", [],
    TUTTI.flatMap((n) => Object.entries(N.MAPPA_NOMI[n]).map(([k, v]) => [n, k, v])).filter(([, , v]) => typeof v === "string" && VIETATI_RIDOTTI.includes(ridotto(v))));
  c("nomi_ammesso è esatto: maiuscole e spazi contano, i vietati e gli sconosciuti no", [true, false, false, false, false, false, false],
    ["AddToCart", "addtocart", " AddToCart", "Purchase", "PlaceAnOrder", "Lead", ""].map((n) => N.nomeAmmesso(n)));
  c("nomeAmmesso con valori non testo: no, non lancia", [false, false, false], [N.nomeAmmesso(null), N.nomeAmmesso(undefined), N.nomeAmmesso(42)]);

  /* ── EVENTI ── */
  const ctx = { eventId: "evt-1" };
  const carrello = E.costruisciEvento("AddToCart", { contentIds: ["HG-001"], contentType: "product", valueCent: 2890, numItems: 1 }, ctx);
  c("AddToCart → meta, tiktok e ga4 con gli stessi dati e `value` in euro (2890 cent → 28.9)",
    {
      meta: { nome: "AddToCart", eventId: "evt-1", parametri: { content_ids: ["HG-001"], content_type: "product", currency: "EUR", value: 28.9, num_items: 1 } },
      tiktok: { nome: "AddToCart", eventId: "evt-1", parametri: { contents: [{ content_id: "HG-001", content_type: "product" }], content_type: "product", currency: "EUR", value: 28.9 } },
      ga4: { nome: "add_to_cart", parametri: { currency: "EUR", value: 28.9, items: [{ item_id: "HG-001" }] } },
    }, carrello);
  c("lo stesso event_id arriva a Meta e a TikTok (deduplica browser/server)", [true], [carrello.meta.eventId === carrello.tiktok.eventId]);
  c("value: 1990 cent → 19.9, 0 → 0, 100 → 1 (nessun errore binario)", [19.9, 0, 1], [1990, 0, 100].map((v) => E.costruisciEvento("AddToCart", { contentIds: ["HG-001"], valueCent: v }, ctx).meta.parametri.value));
  c("value non valido (negativo, NaN, con decimali, testo, infinito): non si manda, e nemmeno `currency`", [false, false, false, false, false, false],
    [-5, NaN, 12.5, "2890", Infinity, null].map((v) => { const p = E.costruisciEvento("AddToCart", { contentIds: ["HG-001"], valueCent: v }, ctx).meta.parametri; return "value" in p || "currency" in p; }));
  c("num_items non valido (0, -1, 1.5, testo): non si manda", [false, false, false, false],
    [0, -1, 1.5, "2"].map((v) => "num_items" in E.costruisciEvento("AddToCart", { contentIds: ["HG-001"], numItems: v }, ctx).meta.parametri));
  const lista = E.costruisciEvento("ViewContent", { contentIds: ["HG-001", "HG-002"], contentType: "product_group", categoria: "stock" }, ctx);
  c("ViewContent di una lista → content_type product_group, GA4 view_item_list con il nome della lista",
    ["product_group", "product_group", "view_item_list", "stock"], [lista.meta.parametri.content_type, lista.tiktok.parametri.content_type, lista.ga4.nome, lista.ga4.parametri.item_list_name]);
  const scheda = E.costruisciEvento("ViewContent", { contentIds: ["HG-001"], contentType: "product", contentName: "Patch di prova", categoria: "stock", valueCent: 28900 }, ctx);
  c("ViewContent di una scheda → view_item, nome e categoria", ["ViewContent", "view_item", "Patch di prova", "stock", 289], [scheda.meta.nome, scheda.ga4.nome, scheda.meta.parametri.content_name, scheda.meta.parametri.content_category, scheda.meta.parametri.value]);
  c("ViewContent senza tipo → product (una scheda)", "product", E.costruisciEvento("ViewContent", { contentIds: ["HG-001"] }, ctx).meta.parametri.content_type);
  c("ViewContent con `content_ids` vuoti, assenti o solo vuoti: non si costruisce (null)", [null, null, null, null, null],
    [{ contentIds: [] }, {}, undefined, { contentIds: ["", "  "] }, { contentIds: [1, null, {}] }].map((d) => E.costruisciEvento("ViewContent", d, ctx)));
  c("contenutiVuoti: vero per le schede e il carrello senza prodotti, falso per PageView, Search, Contact", [true, true, true, false, false, false, false],
    [E.contenutiVuoti("ViewContent", { contentIds: [] }), E.contenutiVuoti("AddToCart", {}), E.contenutiVuoti("InitiateCheckout", { contentIds: [] }), E.contenutiVuoti("ViewContent", { contentIds: ["HG-001"] }), E.contenutiVuoti("PageView", {}), E.contenutiVuoti("Search", {}), E.contenutiVuoti("Contact", undefined)]);
  c("gli id con spazi si puliscono, i doppioni e i non-testo si tolgono, il tetto è 50", [["HG-001", "HG-002"], 50],
    [E.costruisciEvento("AddToCart", { contentIds: [" HG-001 ", "HG-002", "HG-001", 7, null] }, ctx).meta.parametri.content_ids,
      E.costruisciEvento("AddToCart", { contentIds: Array.from({ length: 80 }, (_, i) => `HG-${i}`) }, ctx).meta.parametri.content_ids.length]);
  const pv = E.costruisciEvento("PageView", undefined, ctx);
  c("PageView senza dati → i tre nomi e nessun parametro", [{ nome: "PageView", eventId: "evt-1", parametri: {} }, { nome: "PageView", eventId: "evt-1", parametri: {} }, { nome: "page_view", parametri: {} }], [pv.meta, pv.tiktok, pv.ga4]);
  const rm = E.costruisciEvento("RemoveFromCart", { contentIds: ["HG-001"] }, ctx);
  c("RemoveFromCart: va a Meta e GA4, non a TikTok", [true, false, true], [rm.meta?.nome === "RemoveFromCart", rm.tiktok !== null, rm.ga4?.nome === "remove_from_cart"]);
  const cerca = (s) => E.costruisciEvento("Search", { searchString: s }, ctx);
  c("Search → search_string / query / search_term", ["capelli", "capelli", "capelli"], [cerca("capelli").meta.parametri.search_string, cerca("capelli").tiktok.parametri.query, cerca("capelli").ga4.parametri.search_term]);
  c("Search: un testo che sembra un'email o un telefono non si manda (resta l'evento, senza testo)", [false, false, false, true],
    ["a@example.com", "339 123 4567", "3391234567", "colla"].map((s) => "search_string" in cerca(s).meta.parametri));
  c("Search: il testo si taglia a 100 segni", 100, cerca("x".repeat(300)).meta.parametri.search_string.length);
  c("Search con testo vuoto o non testo: nessun testo", [false, false, false], [cerca("   "), cerca(42), cerca(undefined)].map((e) => "search_string" in e.meta.parametri));
  c("un nome fuori dalla mappa non si costruisce: Purchase, purchase, CompletePayment, sconosciuto, vuoto → null", [null, null, null, null, null],
    ["Purchase", "purchase", "CompletePayment", "Foo", ""].map((n) => E.costruisciEvento(n, { contentIds: ["HG-001"], valueCent: 100 }, ctx)));
  c("senza `contesto` l'event_id si crea da solo ed è uguale per Meta e TikTok", [true, true], (() => { const e = E.costruisciEvento("PageView"); return [typeof e.meta.eventId === "string" && e.meta.eventId.length >= 16, e.meta.eventId === e.tiktok.eventId]; })());
  const ids = new Set(Array.from({ length: 200 }, () => E.creaEventId()));
  c("creaEventId: 200 id, tutti diversi, forma UUID, entro i 64 segni del mittente", [200, true, true], [ids.size, [...ids].every((i) => /^[0-9a-f-]{36}$/.test(i)), [...ids].every((i) => i.length <= 64)]);
  c("nessun parametro porta email, telefono o nome (scansione del JSON di un evento completo)", [], (() => {
    const e = JSON.stringify(E.costruisciEvento("AddToCart", { contentIds: ["HG-001"], contentName: "Patch di prova", categoria: "stock", valueCent: 100, numItems: 1 }, ctx));
    return ["email", "phone", "telefono", "\"em\"", "\"ph\"", "first_name", "fbp", "fbc", "ttclid"].filter((k) => e.includes(k));
  })());

  /* ── HASH ── */
  c("normalizzaEmail: spazi e maiuscole via", "a@example.com", H.normalizzaEmail("  A@Example.COM \n"));
  c("normalizzaEmail con valori non testo o senza chiocciola: stringa vuota", ["", "", "", ""], [H.normalizzaEmail(null), H.normalizzaEmail(undefined), H.normalizzaEmail(42), H.normalizzaEmail("non è un'email")]);
  const tel = [["339 123 4567", "393391234567"], ["3391234567", "393391234567"], ["+39 339 123 4567", "393391234567"], ["0039 339 123 4567", "393391234567"], ["393391234567", "393391234567"], ["(339) 123-4567", "393391234567"], ["06 1234 5678", "390612345678"], ["+44 7700 900123", "447700900123"], ["3912345678", "393912345678"]];
  for (const [i, o] of tel) c(`normalizzaTelefono(${JSON.stringify(i)}) → ${o}`, o, H.normalizzaTelefono(i));
  c("normalizzaTelefono: troppo corto, troppo lungo, senza cifre, non testo → stringa vuota", ["", "", "", "", ""], [H.normalizzaTelefono("12345"), H.normalizzaTelefono("1".repeat(20)), H.normalizzaTelefono("abc"), H.normalizzaTelefono(null), H.normalizzaTelefono(3391234567)]);
  c("sha256Hex(a@example.com) = vettore calcolato con shasum", "08168cd80dfd534ab0f10af10f1303fe00af2d43ab5c1432360d137f8197e17a", await H.sha256Hex("a@example.com"));
  c("sha256Hex del testo vuoto = vettore noto", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", await H.sha256Hex(""));
  c("sha256Hex di un segno non ASCII (UTF-8) = vettore calcolato con shasum", "97c916cd94785d7b9b52ae7013c267854f275691ddaae212bc1c07f639b8a0c7", await H.sha256Hex("è"));
  c("email sporca → normalizza → hash = lo stesso del vettore", "08168cd80dfd534ab0f10af10f1303fe00af2d43ab5c1432360d137f8197e17a", await H.sha256Hex(H.normalizzaEmail("  A@EXAMPLE.com ")));
  c("telefono → normalizza → hash = vettore calcolato con shasum", "1541fc7fae604dcce0c46f324ae8c867a8dae625553faa0bc23e04897658cac0", await H.sha256Hex(H.normalizzaTelefono("339 123 4567")));
  c("l'hash è esadecimale minuscolo di 64 segni", true, /^[0-9a-f]{64}$/.test(await H.sha256Hex("qualunque cosa")));

  /* ── PERMESSO ── */
  const SEGRETA = "chiave-di-prova";
  c("derivaChiave = HMAC-SHA256(chiave di servizio, «hgl-eventi-v1») in esadecimale (vettore calcolato con openssl)", "ce17aff8fcd363f744e057b486c958e071367a589f385e5e5b22fc3589f3e34e", await P.derivaChiave(SEGRETA));
  c("derivaChiave: chiavi diverse → derivate diverse; la derivata non è la chiave di servizio", [true, true], [(await P.derivaChiave("altra")) !== (await P.derivaChiave(SEGRETA)), (await P.derivaChiave(SEGRETA)) !== SEGRETA]);
  c("derivaChiave con chiave vuota o non testo: lancia (il Worker risponde 503 e non invia)", [true, true, true], await Promise.all(["", null, undefined].map((k) => P.derivaChiave(k).then(() => false, () => true))));
  const K = await P.derivaChiave(SEGRETA);
  const T0 = 1_800_000_000_000;
  const tok = await P.emettiPermesso(K, T0);
  c("il permesso ha solo segni da indirizzo (passa in un'intestazione o in un JSON senza escape)", true, /^[0-9A-Za-z._-]+$/.test(tok));
  c("permesso valido: subito, dopo 9 minuti, a 10 minuti esatti", [true, true, true], [await P.verificaPermesso(tok, K, T0), await P.verificaPermesso(tok, K, T0 + 9 * MIN), await P.verificaPermesso(tok, K, T0 + 10 * MIN)]);
  c("permesso scaduto: dopo 11 minuti, dopo un giorno", [false, false], [await P.verificaPermesso(tok, K, T0 + 11 * MIN), await P.verificaPermesso(tok, K, T0 + 24 * 60 * MIN)]);
  c("permesso firmato con un'altra chiave: no", false, await P.verificaPermesso(await P.emettiPermesso(await P.derivaChiave("altra"), T0), K, T0));
  c("permesso verificato con un'altra chiave: no", false, await P.verificaPermesso(tok, await P.derivaChiave("altra"), T0));
  // un carattere alterato, in ogni posizione, deve far cadere il permesso
  const alterati = [];
  for (let i = 0; i < tok.length; i++) {
    const ch = tok[i] === "a" ? "b" : "a";
    if (await P.verificaPermesso(tok.slice(0, i) + ch + tok.slice(i + 1), K, T0)) alterati.push(i);
  }
  c("un carattere alterato, in QUALUNQUE posizione, fa cadere il permesso", [], alterati);
  c("scadenza allungata a mano (firma vecchia, ora nuova): no", false, await P.verificaPermesso(`${T0 + 100 * MIN}.${tok.split(".").slice(1).join(".")}`, K, T0 + 50 * MIN));
  c("permesso troncato, allungato o con pezzi in più: no", [false, false, false], [await P.verificaPermesso(tok.slice(0, -1), K, T0), await P.verificaPermesso(tok + "0", K, T0), await P.verificaPermesso(tok + ".x", K, T0)]);
  const rotti = ["", " ", "abc", ".", "..", "1.2", "1.2.3.4", "NaN.00", `${tok} `, null, undefined, 42, {}, []];
  const esiti = [];
  for (const r of rotti) { try { esiti.push(await P.verificaPermesso(r, K, T0)); } catch (e) { esiti.push(`lancia: ${e}`); } }
  c("permessi rotti o di altro tipo: sempre «no», mai un'eccezione", rotti.map(() => false), esiti);
  c("chiave vuota o non testo nella verifica: «no», non lancia", [false, false, false], [await P.verificaPermesso(tok, "", T0), await P.verificaPermesso(tok, null, T0), await P.verificaPermesso(tok, undefined, T0)]);
  c("emettiPermesso con chiave vuota: lancia", true, await P.emettiPermesso("", T0).then(() => false, () => true));
  c("adesso non valido nella verifica (NaN, testo): «no»", [false, false], [await P.verificaPermesso(tok, K, NaN), await P.verificaPermesso(tok, K, "oggi")]);
  c("due permessi emessi in momenti diversi sono diversi, e ognuno scade a modo suo (a +12 min il primo è scaduto, il secondo no)", [true, false, true], await (async () => {
    const t2 = await P.emettiPermesso(K, T0 + 5 * MIN);
    return [t2 !== tok, await P.verificaPermesso(tok, K, T0 + 12 * MIN), await P.verificaPermesso(t2, K, T0 + 12 * MIN)];
  })());
  c("hmacHex è esportata (serve alla chiave d'anteprima di T07) ed è deterministica", [true, 64], await (async () => { const a = await P.hmacHex("k", "m"); return [a === (await P.hmacHex("k", "m")), a.length]; })());
}
