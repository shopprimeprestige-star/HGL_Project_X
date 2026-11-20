/** ── SHOP R1 · T26 · LE PAGINE AMMESSE AI PIXEL E AL BANNER (D14, D15) ───────────────
 *  `src/lib/tracciamento/ammesse.ts`: una funzione sola per pixel, banner e provider. L'elenco è delle pagine
 *  AMMESSE (per schema di percorso), non di quelle escluse: una pagina nuova non traccia finché non la si aggiunge.
 *  E l'indirizzo che esce verso le piattaforme è RICOSTRUITO, mai copiato. Dati: percorsi e codici inventati. */

export async function prove(mod, { c, gruppo }) {
  const A = mod["lib/tracciamento/ammesse"];
  gruppo("SHOP R1 · T26 · PAGINE AMMESSE, BANNER, INDIRIZZI PULITI (20/11/2026)");
  c("il modulo c'è", true, !!A);
  if (!A) return;
  const { percorsoAmmesso: ok, bannerAmmesso: banner, urlPulito, referrerPulito, queryPulita } = A;

  /* ── la tabella di casi del piano: [percorso, ricerca, inCornice, atteso] ── */
  const tabella = [
    ["/", "", false, true],
    ["/shop", "", false, true],
    ["/shop/prodotto/lace-front", "", false, true],
    ["/shop/prodotto/x", "?anteprima=abc", false, false],
    ["/shop/prodotto/x", "?utm_source=meta&fbclid=1", false, true],
    ["/shop/c/patch", "", false, true],
    ["/shop/ordine/HG-1", "?t=abc", false, false],
    ["/shop/ordine", "", false, false],
    ["/shop/ordine/HG-1", "", false, false],
    ["/shop/checkout", "", false, true],
    ["/shop/qualcosa-di-nuovo", "", false, false],
    ["/SHOP/", "", false, true],
    ["/nuova", "", false, true],
    ["/invisible-derm", "?watch=ABC", false, false],
    ["/invisible-derm", "?modifica", false, false],
    ["/CRM/ecommerce", "", false, false],
    ["/preventivo", "?sess=1", false, false],
    ["/meetly/x", "", false, false],
    ["/media/ABC", "", false, false],
    ["/shop", "", true, false],
    ["/", "", true, false],
    ["/nuova", "", true, false],
    ["/blog/articolo", "?t=1", false, false],
    ["/privacy-policy", "", false, true],
    // le altre pagine ammesse di D14
    ["/shop/cerca", "", false, true],
    ["/shop/carrello", "", false, true],
    ["/shop/spedizioni-e-resi", "", false, true],
    ["/shop/garanzia", "", false, true],
    ["/shop/assistenza", "", false, true],
    ["/shop/domande", "", false, true],
    ["/invisible-derm", "", false, true],
    ["/invisible-derm-v1", "", false, true],
    ["/blog", "", false, true],
    ["/blog/articolo", "", false, true],
    ["/cookie-policy", "", false, true],
    ["/termini-e-condizioni", "", false, true],
    ["/Shop/Carrello/", "", false, true],
    // le pagine escluse «sempre» di D14
    ["/CRM", "", false, false],
    ["/crm/leads", "", false, false],
    ["/preventivo/abc", "", false, false],
    ["/meetly", "", false, false],
    ["/videochiamata/abcdef-ghi", "", false, false],
    ["/invito/xyz", "", false, false],
    ["/presenta/x", "", false, false],
    ["/consulente/registrati", "", false, false],
    ["/slide", "", false, false],
    ["/webinar/x", "", false, false],
    ["/percorso", "", false, false],
    ["/prova-capelli", "", false, false],
    ["/regia/x", "", false, false],
    ["/chat", "", false, false],
    ["/api/public/evento", "", false, false],
    // la lista è BIANCA: qualunque chiave sconosciuta esclude la pagina (revisione di sicurezza)
    ["/shop", "?ref_code=X", false, false],
    ["/shop", "?qualcosa=Y", false, false],
    ["/shop", "?utm_source=meta&qualcosa=Y", false, false],
    ["/shop/prodotto/x", "?fbclid=1&invito=Z", false, false],
    ["/shop/cerca", "?q=capelli", false, false],
    ["/shop", "?=x", false, false],
    ["/shop", "?UTM_SOURCE=meta", false, true],
    ["/shop", "?gad_source=1&gclid=abc&gad_campaignid=9", false, true],
    ["/shop", "?utm_source=a&utm_medium=b&fbclid=1&gclid=2&gbraid=3&wbraid=4&ttclid=5&ad_id=6&adset_id=7&campaign_id=8&ad_name=9&creative=10&creative_name=11", false, true],
    ["/shop", "?utm_source=a&utm_medium=b", true, false],
    ["/shop?ref_code=X", "", false, false],
    ["/shop?utm_source=a", "", false, true],
    // schemi: troppo o troppo poco, segni strani
    ["/shop/prodotto", "", false, false],
    ["/shop/prodotto/", "", false, false],
    ["/shop/prodotto/a/b", "", false, false],
    ["/shop/c", "", false, false],
    ["/shop/c/a/b", "", false, false],
    ["/shop//carrello", "", false, false],
    ["/shop/prodotto/%2e%2e", "", false, false],
    ["/shop/prodotto/../ordine/x", "", false, false],
    ["/shop/prodotto/a b", "", false, false],
    ["/blog/a/b", "", false, false],
    ["/shop/carrello/extra", "", false, false],
    ["shop", "", false, false],
    ["", "", false, false],
  ];
  for (const [p, q, f, atteso] of tabella) {
    c(`percorsoAmmesso(${JSON.stringify(p)}, ${JSON.stringify(q)}, cornice=${f}) → ${atteso ? "sì" : "no"}`, atteso, ok(p, q, f));
    c(`bannerAmmesso(${JSON.stringify(p)}, ${JSON.stringify(q)}, cornice=${f}, admin=no) → ${atteso ? "sì" : "no"}  (stessa regola dei pixel)`, atteso, banner(p, q, f, false));
  }
  c("il banner non compare a un amministratore riconosciuto, in nessuna pagina ammessa", [], tabella.filter(([p, q, f, a]) => a && banner(p, q, f, true)).map((r) => r[0]));
  c("percorsoAmmesso e bannerAmmesso (admin no) danno la stessa risposta su tutta la tabella", [], tabella.filter(([p, q, f]) => ok(p, q, f) !== banner(p, q, f, false)));

  /* ── le query: ognuna delle chiavi vietate fa cadere la pagina, in qualunque scrittura ── */
  const VIETATE = ["anteprima", "t", "watch", "modifica", "sess", "code", "codice", "token", "key", "embed"];
  c("ogni chiave vietata, anche da sola e senza valore, esclude la pagina", [], VIETATE.filter((k) => ok("/shop", `?${k}`, false) || ok("/shop", `?${k}=1`, false)));
  c("…anche scritta in maiuscolo o dopo altre chiavi", [], VIETATE.filter((k) => ok("/shop", `?${k.toUpperCase()}=1`, false) || ok("/shop", `?utm_source=a&${k}=1&fbclid=2`, false)));
  c("la ricerca senza «?» davanti vale uguale; una chiave ammessa non esclude, una sconosciuta sì (anche «q»)", [true, false, false, true], [ok("/shop", "utm_source=a", false), ok("/shop", "t=1", false), ok("/shop/cerca", "?q=capelli", false), ok("/shop", "gclid=1&utm_term=x", false)]);
  c("una chiave vietata scritta dentro il percorso (dopo un «?») esclude la pagina", [false, true], [ok("/shop?t=1", "", false), ok("/shop?utm_source=a", "", false)]);
  c("il frammento (#…) non conta", true, ok("/shop#t=1", "", false));
  c("valori non testo: no, nessuna eccezione", [false, false, false, false], [ok(null, "", false), ok(undefined, "", false), ok(42, "", false), ok({}, "", false)]);
  c("ricerca non testo: si ignora, il percorso decide", [true, true], [ok("/shop", null, false), ok("/shop", undefined, false)]);
  c("elenchi esportati: 10 chiavi vietate note, le ammesse comprendono fbclid, gclid, ttclid, ad_id, gad_source", [10, true], [A.CHIAVI_QUERY_VIETATE.length, ["fbclid", "gclid", "ttclid", "ad_id", "campaign_id", "gad_source"].every((k) => A.CHIAVI_QUERY_AMMESSE.includes(k))]);
  c("lista bianca: ogni chiave ammessa dà una pagina ammessa, ogni chiave inventata no (anche vicina a una ammessa)", [[], []],
    [A.CHIAVI_QUERY_AMMESSE.filter((k) => !ok("/shop", `?${k}=1`, false)), ["utm", "fbclid2", "xgclid", "gclid_", "fb", "ttclid ", "_utm_source", "ref", "code2", "id", "email", "telefono", "nome", "utm"].filter((k) => ok("/shop", `?${k}=1`, false))]);
  c("nessuna chiave è insieme vietata e ammessa", [], A.CHIAVI_QUERY_VIETATE.filter((k) => A.CHIAVI_QUERY_AMMESSE.includes(k)));

  /* ── urlPulito ── */
  const O = "https://sito.test";
  c("urlPulito: via `t`, resta il resto ammesso (il caso del piano)", "https://sito.test/shop/prodotto/x?utm_source=meta&fbclid=9", urlPulito(O, "/shop/prodotto/x", "?utm_source=meta&t=SEGRETO&fbclid=9"));
  c("urlPulito: nessuna chiave ammessa → nessun «?»", "https://sito.test/shop", urlPulito(O, "/shop", "?q=ciao&t=SEGRETO"));
  c("urlPulito: tutte le chiavi ammesse restano, nell'ordine in cui arrivano", "https://sito.test/shop?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=d&utm_content=e&fbclid=1&gclid=2&gbraid=3&wbraid=4&ttclid=5&ad_id=6&adset_id=7&campaign_id=8&ad_name=9&creative=10&creative_name=11",
    urlPulito(O, "/shop", "?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=d&utm_content=e&fbclid=1&gclid=2&gbraid=3&wbraid=4&ttclid=5&ad_id=6&adset_id=7&campaign_id=8&ad_name=9&creative=10&creative_name=11"));
  c("urlPulito: maiuscole e barra finale del percorso si normalizzano; la radice resta «/»", ["https://sito.test/shop", "https://sito.test/", "https://sito.test/shop/c/patch"], [urlPulito(O, "/SHOP/", ""), urlPulito(O, "/", ""), urlPulito(O, "/Shop/C/Patch/", "")]);
  c("urlPulito: l'origine perde la barra finale; il frammento non esce", ["https://sito.test/shop", "https://sito.test/shop"], [urlPulito("https://sito.test/", "/shop", ""), urlPulito(O, "/shop#t=1", "")]);
  c("urlPulito: una email, un telefono o un codice in una chiave non ammessa non esce mai", false, /@|339|SEGRETO|ciao/.test(urlPulito(O, "/shop", "?email=a@example.com&telefono=3391234567&token=SEGRETO&q=ciao&utm_source=a")));
  c("urlPulito: una chiave ammessa col valore enorme si taglia a 200 segni", 200, urlPulito(O, "/shop", `?utm_source=${"x".repeat(900)}`).split("utm_source=")[1].length);
  c("urlPulito: la chiave in maiuscolo si scrive minuscola", "https://sito.test/shop?utm_source=Meta", urlPulito(O, "/shop", "?UTM_SOURCE=Meta"));
  c("urlPulito: origine che non è un'origine (percorso dentro, altro schema, vuoto, non testo) → stringa vuota", ["", "", "", "", ""],
    [urlPulito("https://sito.test/dentro", "/shop", ""), urlPulito("javascript:alert(1)", "/shop", ""), urlPulito("", "/shop", ""), urlPulito(null, "/shop", ""), urlPulito("ftp://sito.test", "/shop", "")]);
  c("urlPulito: percorso non testo → stringa vuota", ["", ""], [urlPulito(O, null, ""), urlPulito(O, 42, "")]);
  c("urlPulito: valore con segni da codificare resta codificato (nessuna iniezione di «&» e «#»)", "https://sito.test/shop?utm_source=a%26t%3D1%23x", urlPulito(O, "/shop", "?utm_source=a%26t%3D1%23x"));

  /* ── queryPulita (quella che il browser manda al mittente, D16) ── */
  c("queryPulita: solo le chiavi ammesse, senza «?»", ["utm_source=meta&fbclid=9", "", ""], [queryPulita("?utm_source=meta&t=SEGRETO&fbclid=9"), queryPulita("?t=SEGRETO"), queryPulita(null)]);

  /* ── referrerPulito ── */
  c("referrerPulito: dal sito stesso, solo l'origine (niente percorso né query: il caso del piano)", "https://sito.test", referrerPulito("https://sito.test/preventivo?sess=ABC", O));
  c("referrerPulito: da un altro sito, solo la sua origine", ["https://www.google.com", "https://l.facebook.com"], [referrerPulito("https://www.google.com/search?q=colla+patch", O), referrerPulito("https://l.facebook.com/l.php?u=x&h=y", O)]);
  c("referrerPulito: vuoto, rotto, non http, non testo → stringa vuota", ["", "", "", "", ""], [referrerPulito("", O), referrerPulito("non è un indirizzo", O), referrerPulito("javascript:alert(1)", O), referrerPulito(null, O), referrerPulito("android-app://com.x/y", O)]);
  c("referrerPulito: nessuna parte dell'indirizzo oltre l'origine, nemmeno nome utente e porta di servizio", "https://sito.test", referrerPulito("https://utente:pw@sito.test/shop?t=1#x", O));
}
