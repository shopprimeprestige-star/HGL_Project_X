/** ── NEGOZIO · T06 · «PRIMA DI PUBBLICARE» ─────────────────────────────────
 *  `src/shop/cms/pubblicazione.ts`: `controllaPubblicazione(prodotto, varianti, media, categorie, contesto)` →
 *  `{ bloccanti: [{campo, frase}], informativi: [{campo, frase}] }`. La stessa funzione serve al pannello in
 *  tempo reale e al server (che rifiuta con le stesse frasi). `skuLibero(sku, tuttiGliSku, escludi)`.
 *  Dati inventati (`PROVA-…`), nessun cliente. */

export async function prove(mod, { c, gruppo }) {
  const P = mod["shop/cms/pubblicazione"];
  gruppo("NEGOZIO · PRIMA DI PUBBLICARE: BLOCCANTI E INFORMATIVI (20/11/2026)");

  // ── un prodotto completo, in camelCase (come `modello.ts`) ──
  const prodotto = (extra = {}) => ({
    id: "p1", sku: "PROVA-001", nome: "Prodotto di prova", prezzoCent: 2890,
    rigaPresentazione: "Per sciogliere i nodi.", descrizioneBreve: "Una descrizione breve inventata.", descrizioneLunga: null, perChi: null,
    caratteristiche: [{ etichetta: "Formato", valore: "100 ml", stato: "confermato", fonte: "prova" }],
    passi: [], confezione: [], avvertenze: [], faq: [],
    canali: { sito: true, meta: false, google: false, tiktok: false },
    seoTitolo: null, seoDescrizione: null, ...extra,
  });
  const variante = (extra = {}) => ({ sku: "PROVA-001", nome: "Unica", prezzoCent: null, attiva: true, ...extra });
  const media = (extra = {}) => ({
    id: "m1", slot: "principale", tipo: "foto", alt: "Foto di prova", muto: false, sottotitoliOk: false,
    ritraePersone: false, liberatoriaOk: false, rimossoIl: null, pathCopertina: null, ...extra,
  });
  const contesto = (extra = {}) => ({ spedizioneImpostata: true, tuttiGliSku: [], ...extra });
  const vai = (o = {}) =>
    P.controllaPubblicazione(o.prodotto ?? prodotto(), o.varianti ?? [variante()], o.media ?? [media()], o.categorie ?? [{ id: "k1" }], o.contesto ?? contesto());
  const campi = (r) => r.bloccanti.map((b) => b.campo);
  const frasi = (r) => r.bloccanti.map((b) => b.frase);

  // ── tutto a posto ──
  c("tutto a posto → nessun bloccante, nessun informativo", { bloccanti: [], informativi: [] }, vai());

  // ── foto principale ──
  const senzaFoto = vai({ media: [] });
  c("senza foto principale → rifiutato con la frase esatta", ["fotoPrincipale", "Manca la foto principale: il prodotto resta in bozza."], [campi(senzaFoto)[0], frasi(senzaFoto)[0]]);
  c("con sole foto 2-5, senza la principale → rifiutato", ["fotoPrincipale"], campi(vai({ media: [media({ slot: "foto2" })] })));
  c("la principale tolta (rimosso_il) non vale", ["fotoPrincipale"], campi(vai({ media: [media({ rimossoIl: "2026-11-20T10:00:00Z" })] })));
  c("un video nello slot principale non è una foto", ["fotoPrincipale"], campi(vai({ media: [media({ tipo: "video", muto: true })] })));

  c("la principale con persone SENZA liberatoria non esce, quindi non vale (come il trigger di S1)", [["fotoPrincipale"], "Manca la foto principale: il prodotto resta in bozza."],
    ((r) => [campi(r), frasi(r)[0]])(vai({ media: [media({ ritraePersone: true, liberatoriaOk: false })] })));
  c("la principale con persone e liberatoria vale", [], campi(vai({ media: [media({ ritraePersone: true, liberatoriaOk: true })] })));
  c("con la principale senza liberatoria ma un'altra principale in regola → passa", [], campi(vai({ media: [media({ ritraePersone: true }), media({ id: "m2", ritraePersone: false })] })));

  // ── testo alternativo ──
  const dueSenzaAlt = vai({ media: [media(), media({ id: "m2", slot: "foto2", alt: "" }), media({ id: "m3", slot: "foto3", alt: "   " })] });
  c("due foto senza alt → «Manca il testo alternativo di 2 foto.»", [["alt"], ["Manca il testo alternativo di 2 foto."]], [campi(dueSenzaAlt), frasi(dueSenzaAlt)]);
  c("la principale senza alt conta (1 foto)", ["Manca il testo alternativo di 1 foto."], frasi(vai({ media: [media({ alt: "" })] })));
  c("una foto tolta senza alt non conta", [], campi(vai({ media: [media(), media({ id: "m2", slot: "foto2", alt: "", rimossoIl: "2026-11-20T10:00:00Z" })] })));
  c("un video muto senza alt non è una foto: non conta", [], campi(vai({ media: [media(), media({ id: "m2", slot: "video", tipo: "video", alt: "", muto: true })] })));

  // ── prezzo ──
  const prezzo0 = vai({ prodotto: prodotto({ prezzoCent: 0 }) });
  c("prodotto a 0 e variante senza prezzo → rifiutato (campo prezzo)", ["prezzo"], campi(prezzo0));
  c("prodotto a 0 ma ogni variante attiva ha il suo prezzo → passa", [], campi(vai({ prodotto: prodotto({ prezzoCent: 0 }), varianti: [variante({ prezzoCent: 1500 })] })));
  const unaVuota = vai({ varianti: [variante({ prezzoCent: 1500 }), variante({ sku: "PROVA-001-B", nome: "Nera", prezzoCent: 0 })] });
  c("una sola variante attiva a 0 su due → rifiutato, e la frase la nomina", [["prezzo"], true], [campi(unaVuota), /Nera/.test(frasi(unaVuota)[0])]);
  c("una variante NON attiva a 0 non blocca", [], campi(vai({ varianti: [variante(), variante({ sku: "PROVA-001-B", prezzoCent: 0, attiva: false })] })));
  c("prezzo negativo o non intero → rifiutato", ["prezzo", "prezzo"], [campi(vai({ varianti: [variante({ prezzoCent: -5 })] }))[0], campi(vai({ varianti: [variante({ prezzoCent: 12.5 })] }))[0]]);

  // ── varianti attive ──
  const nessunaAttiva = vai({ varianti: [variante({ attiva: false })] });
  c("nessuna variante attiva → rifiutato (campo varianti)", ["varianti"], campi(nessunaAttiva));
  c("nessuna variante in assoluto → rifiutato (campo varianti)", ["varianti"], campi(vai({ varianti: [] })));

  // ── SKU ──
  const altro = [{ sku: "PROVA-002", prodottoId: "p2" }, { sku: "PROVA-002-A", prodottoId: "p2" }, { sku: "PROVA-001", prodottoId: "p1" }];
  c("SKU di una variante già usato da una variante di un ALTRO prodotto → rifiutato", ["sku"],
    campi(vai({ varianti: [variante({ sku: "PROVA-002-A" })], contesto: contesto({ tuttiGliSku: altro }) })));
  c("SKU del prodotto già usato da un altro prodotto → rifiutato", ["sku"],
    campi(vai({ prodotto: prodotto({ sku: "PROVA-002" }), varianti: [variante({ sku: "PROVA-001" })], contesto: contesto({ tuttiGliSku: altro }) })));
  c("SKU del prodotto già usato da una VARIANTE di un altro prodotto → rifiutato", ["sku"],
    campi(vai({ prodotto: prodotto({ sku: "PROVA-002-A" }), varianti: [variante({ sku: "PROVA-001" })], contesto: contesto({ tuttiGliSku: altro }) })));
  c("i propri SKU (prodotto e sua variante uguali, come nelle 33 migrate) non sono «già usati»", [],
    campi(vai({ contesto: contesto({ tuttiGliSku: altro }) })));
  c("due varianti dello stesso prodotto con lo stesso SKU → rifiutato", ["sku"], campi(vai({ varianti: [variante({ sku: "PROVA-001-A" }), variante({ sku: "PROVA-001-A", nome: "Due" })] })));
  const senzaSku = vai({ varianti: [variante({ sku: "" })] });
  c("variante senza SKU → rifiutato (e la frase la nomina)", [["sku"], true], [campi(senzaSku), /Unica/.test(frasi(senzaSku)[0])]);
  c("SKU storto (minuscolo, spazi) → rifiutato", ["sku"], campi(vai({ varianti: [variante({ sku: "prova 1" })] })));
  c("prodotto senza SKU → rifiutato", ["sku"], campi(vai({ prodotto: prodotto({ sku: "" }) })));
  c("anche una variante non attiva ha lo SKU unico", ["sku"], campi(vai({ varianti: [variante(), variante({ sku: "PROVA-002-A", attiva: false })], contesto: contesto({ tuttiGliSku: altro }) })));
  c("skuLibero: libero, usato da altri, usato da me", [true, false, true], [P.skuLibero("PROVA-009", altro, "p1"), P.skuLibero("PROVA-002", altro, "p1"), P.skuLibero("PROVA-001", altro, "p1")]);
  c("skuLibero: senza dire chi sono, uno SKU usato non è libero", false, P.skuLibero("PROVA-001", altro));

  // ── categoria, descrizione breve ──
  c("nessuna categoria → rifiutato", ["categoria"], campi(vai({ categorie: [] })));
  c("descrizione breve vuota o di soli spazi → rifiutato", [["descrizioneBreve"], ["descrizioneBreve"]], [campi(vai({ prodotto: prodotto({ descrizioneBreve: "" }) })), campi(vai({ prodotto: prodotto({ descrizioneBreve: "  \n " }) }))]);

  // ── video ──
  const parlato = media({ id: "m9", slot: "video", tipo: "video", alt: "", muto: false, sottotitoliOk: false });
  c("video parlato senza sottotitoli → bloccante (campo video)", ["video"], campi(vai({ media: [media(), parlato] })));
  c("video parlato con i sottotitoli impressi → passa", [], campi(vai({ media: [media(), { ...parlato, sottotitoliOk: true }] })));
  c("video muto → passa", [], campi(vai({ media: [media(), { ...parlato, muto: true }] })));
  c("video parlato tolto → non conta", [], campi(vai({ media: [media(), { ...parlato, rimossoIl: "2026-11-20T10:00:00Z" }] })));

  const conCopertina = { ...parlato, sottotitoliOk: true, pathCopertina: "prova/copertina.webp" };
  const senzaCop = vai({ media: [media(), { ...parlato, sottotitoliOk: true }] });
  c("video senza copertina → informativo (non blocca)", [[], [{ campo: "video", frase: "Manca la copertina del video." }]], [campi(senzaCop), senzaCop.informativi]);
  c("video con copertina → nessun informativo", [], vai({ media: [media(), conCopertina] }).informativi);
  c("due video senza copertina → una frase sola, col numero", ["Mancano le copertine di 2 video."],
    vai({ media: [media(), { ...parlato, sottotitoliOk: true }, { ...parlato, id: "m10", sottotitoliOk: true }] }).informativi.map((i) => i.frase));
  c("video tolto senza copertina → niente", [], vai({ media: [media(), { ...parlato, rimossoIl: "2026-11-20T10:00:00Z" }] }).informativi);

  // ── canali ──
  const nessunCanale = { sito: false, meta: false, google: false, tiktok: false };
  c("nessun canale acceso → bloccante (campo canali)", ["canali"], campi(vai({ prodotto: prodotto({ canali: nessunCanale }) })));
  c("basta un canale (solo Meta) → passa", [], campi(vai({ prodotto: prodotto({ canali: { ...nessunCanale, meta: true } }) })));

  // ── spedizione ──
  c("spedizioneImpostata: null → non blocca (non ancora valutabile nel R1)", [], campi(vai({ contesto: contesto({ spedizioneImpostata: null }) })));
  const senzaSped = vai({ contesto: contesto({ spedizioneImpostata: false }) });
  c("spedizioneImpostata: false → blocca (campo spedizione)", ["spedizione"], campi(senzaSped));
  c("…con una frase per il titolare", true, /spedizione/i.test(frasi(senzaSped)[0]));

  // ── più cose insieme ──
  const tutto = vai({ media: [], varianti: [], categorie: [], prodotto: prodotto({ descrizioneBreve: "", canali: nessunCanale }), contesto: contesto({ spedizioneImpostata: false }) });
  c("molte cose mancanti: le dice tutte, una volta sola ciascuna", ["fotoPrincipale", "varianti", "categoria", "descrizioneBreve", "canali", "spedizione"], campi(tutto));
  c("ogni bloccante ha un campo e una frase non vuoti", [], tutto.bloccanti.filter((b) => !b.campo || !b.frase));

  // ── informativi ──
  const conDaConfermare = vai({ prodotto: prodotto({ caratteristiche: [
    { etichetta: "Formato", valore: "100 ml", stato: "confermato", fonte: "prova" },
    { etichetta: "Spessore", valore: "0,03 mm", stato: "da_confermare", fonte: null },
    { etichetta: "Base", valore: "Lace", stato: "da_confermare", fonte: null }] }) });
  c("righe da_confermare → informativi, non bloccano, una per riga, con la frase del piano", [[], ["La riga “Spessore” è da confermare: resta nascosta nella scheda.", "La riga “Base” è da confermare: resta nascosta nella scheda."]],
    [campi(conDaConfermare), conDaConfermare.informativi.map((i) => i.frase)]);
  const parola = vai({ prodotto: prodotto({ descrizioneBreve: "Una patch invisibile." }) });
  c("parola da non usare → informativo, non blocca, con la frase del piano", [[], [{ campo: "descrizioneBreve", frase: "Il testo contiene “invisibile”: è una parola da non usare. Controlla." }]], [campi(parola), parola.informativi]);
  const sparse = vai({ prodotto: prodotto({ nome: "Kit premium", rigaPresentazione: "Qualità premium", perChi: "Per chi vuole il best seller", passi: ["Applica", "Risultato garantito"], faq: [{ d: "Dura?", r: "È definitivo." }], seoTitolo: "Premium", seoDescrizione: "Ricrescita" }) });
  c("le parole si cercano in nome, riga, per chi, passi, faq e SEO (campo per campo, senza ripetere la stessa frase)", ["nome", "rigaPresentazione", "perChi", "passi", "faq", "seoTitolo", "seoDescrizione"], sparse.informativi.map((i) => i.campo).filter((x, k, a) => a.indexOf(x) === k));
  c("la stessa parola due volte nello stesso campo → un solo informativo", 1, vai({ prodotto: prodotto({ descrizioneBreve: "premium e premium" }) }).informativi.length);
  const blocco = vai({ prodotto: prodotto({ descrizioneBreve: "Invisible Derm da 3.900 €" }) });
  c("un testo con cifra vicina a «Invisible Derm» non si pubblica (bloccante sul campo del testo)", ["descrizioneBreve"], campi(blocco));
  const lungo = vai({ prodotto: prodotto({ seoTitolo: "x".repeat(61), seoDescrizione: "y".repeat(156) }) });
  c("SEO oltre 60 e 155 → due informativi, non bloccano", [[], ["seoTitolo", "seoDescrizione"]], [campi(lungo), lungo.informativi.map((i) => i.campo)]);
  c("SEO a 60 e 155 esatti → niente", [], vai({ prodotto: prodotto({ seoTitolo: "x".repeat(60), seoDescrizione: "y".repeat(155) }) }).informativi);
  const nonQuadrata = vai({ contesto: contesto({ mediaNonQuadrati: ["m1"] }) });
  c("foto non quadrata (dal contesto) → informativo", [[], ["media"]], [campi(nonQuadrata), nonQuadrata.informativi.map((i) => i.campo)]);
  c("foto non quadrata ma tolta → niente", [], vai({ media: [media(), media({ id: "m2", slot: "foto2", rimossoIl: "2026-11-20T10:00:00Z" })], contesto: contesto({ mediaNonQuadrati: ["m2"] }) }).informativi);
  const persone = vai({ media: [media(), media({ id: "m2", slot: "foto2", ritraePersone: true, liberatoriaOk: false })] });
  c("foto con persone senza liberatoria → informativo (non esce)", [[], ["media"], true], [campi(persone), persone.informativi.map((i) => i.campo), /non esce/.test(persone.informativi[0].frase)]);
  c("foto con persone e liberatoria → niente", [], vai({ media: [media(), media({ id: "m2", slot: "foto2", ritraePersone: true, liberatoriaOk: true })] }).informativi);

  // ── la funzione non cambia quello che riceve e non lancia ──
  const p = Object.freeze(prodotto()), vs = Object.freeze([Object.freeze(variante())]), ms = Object.freeze([Object.freeze(media())]);
  c("non tocca quello che riceve (dati congelati)", true, P.controllaPubblicazione(p, vs, ms, [{ id: "k1" }], contesto()).bloccanti.length === 0);
  c("senza dati (null, liste mancanti) non lancia: dice cosa manca", [true, true], (() => {
    const r = P.controllaPubblicazione(prodotto({ caratteristiche: null, passi: undefined, faq: null, canali: null }), null, undefined, null, contesto());
    return [r.bloccanti.length > 0, r.bloccanti.every((b) => b.campo && b.frase)];
  })());
}
