/** ── VETRINA V1 · T79 · IL CARRELLO NUOVO: RIGHE, AVVISI, RIEPILOGO, BARRA, CARRELLO VUOTO (D89) ─────────
 *  `src/shop/cms/vetrina-carrello.ts`: funzioni pure. Si prova soprattutto la finestra dei prezzi chiusa (V1-T9, V1-K3):
 *   · con `stato:"controllo"` NESSUNA cifra (la memoria del browser può essere stata alterata): prezzi e totale «…»;
 *   · con `stato:"ok"` la cifra è quella del server (le righe sono quelle dopo `replaceLines`, riscritte da `ripulisciRighe`);
 *   · con `non_verificabile` «—», mai un numero;
 *   · le righe del catalogo vecchio e quelle di Invisible Derm non si vedono mai e si tolgono con la frase di R2.
 *  Il motore è lo stesso di oggi: la prova usa `rivalida`/`ripulisciRighe`/`totaleDaRighe` veri (shop/cms/cassa e carrello).
 *  Criteri: V1-K1…K5, V1-T9. Dati: `_dati-vetrina.mjs` (inventati). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARRELLO_MISTO, CARRELLO_NUOVO, CARRELLO_VECCHIO, TARIFFA_CARRELLO_ASSENTE, TARIFFA_CARRELLO_OK, righeServerDi, trovaParoleVietate } from "./_dati-vetrina.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const V = mod["shop/cms/vetrina-carrello"];
  const CASSA = mod["shop/cms/cassa"];
  const CARR = mod["shop/cms/carrello"];
  gruppo("VETRINA V1 · T79 · CARRELLO: RIGHE, AVVISI, RIEPILOGO, BARRA, VUOTO (23/11/2026)");
  c("il modulo c'è", true, !!V && !!CASSA && !!CARR);
  if (!V || !CASSA || !CARR) return;
  const { righeVista, testoPrezzo, riepilogo, avvisiRiga, fraseRipulite, barraCarrello, ingressiCarrelloVuoto } = V;

  const sorgenteCarrello = readFileSync(join(radice, "src/shop/cms/vetrina-carrello.ts"), "utf8");
  // gli slug cercati nel sorgente sono quelli del CODICE (i commenti li possono citare)
  const dopo = CARRELLO_NUOVO; // due righe: alfa (1 pezzo) e beta (2 pezzi), con i prezzi del catalogo di prova
  const P0 = dopo[0].snap.prezzoCent;
  const P1 = dopo[1].snap.prezzoCent;
  const TOTALE_NUOVO = P0 * dopo[0].qty + P1 * dopo[1].qty;
  const skuDi = (righe) => righe.filter((l) => l.sku).map((l) => l.sku);
  const nomi = (v) => v.righe.map((r) => r.sku);
  const eur = (cent) => `${(cent / 100).toFixed(2).replace(".", ",")} €`;

  /* Il carrello com'è nella memoria del browser DOPO che qualcuno ha cambiato i prezzi a mano: 13,57 € invece di 289 € e 339 €. */
  const ALTERATO = 1357;
  const alterato = dopo.map((l) => ({ ...l, snap: { ...l.snap, prezzoCent: ALTERATO } }));
  /* …e quello che dice il server per le stesse righe (righeServerDi: i prezzi del catalogo). `rivalida` è il motore vero di oggi. */
  const porte = (extra = {}) => ({ modo: "cms", chiediRighe: async (skus) => righeServerDi(skus), sonda: async () => true, modalitaCerta: async () => "cms", ...extra });
  const esitoServer = await CASSA.rivalida(porte(), alterato);
  c("il motore di oggi riscrive i prezzi alterati con quelli del server", [P0, P1], esitoServer.righe.map((l) => l.snap.prezzoCent));

  // ── V1-T9: prezzo di riga e totale dal server, anche con la memoria del browser alterata ──
  const incontrollo = righeVista(alterato, "controllo");
  c("controllo + memoria alterata: tutte le righe ci sono, senza cifra («…»)", [2, ["attesa", "attesa"], ["attesa", "attesa"], "attesa"],
    [incontrollo.righe.length, incontrollo.righe.map((r) => r.riga.tipo), incontrollo.righe.map((r) => r.unitario.tipo), incontrollo.totale.tipo]);
  const testoControllo = JSON.stringify(incontrollo);
  c("controllo + memoria alterata: la cifra alterata NON compare da nessuna parte (né 1357 né 2714, né in euro)", [],
    [`${ALTERATO}`, `${ALTERATO * 2}`, "13,57", "27,14", "13.57"].filter((x) => testoControllo.includes(x)));
  c("controllo: il testo dei prezzi è «…» ovunque", ["…", "…", "…", "…", "…"], [...incontrollo.righe.flatMap((r) => [testoPrezzo(r.riga, eur), testoPrezzo(r.unitario, eur)]), testoPrezzo(incontrollo.totale, eur)].slice(0, 5));

  const ok = righeVista(esitoServer.righe, "ok");
  c("ok: prezzo unitario e di riga dal server (centesimi)", [[P0, P1], [P0 * dopo[0].qty, P1 * dopo[1].qty]], [ok.righe.map((r) => r.unitario.cent), ok.righe.map((r) => r.riga.cent)]);
  c("ok: il totale è la somma dei centesimi del server", { tipo: "cifra", cent: TOTALE_NUOVO }, ok.totale);
  c("ok: lo stesso totale del motore di oggi (`totaleDaRighe`, in euro)", CARR.totaleDaRighe(esitoServer.righe), ok.totale.cent / 100);
  c("ok: il testo è quello del formattatore dato", ["289,00 €", eur(P1 * 2), eur(TOTALE_NUOVO)], [testoPrezzo(ok.righe[0].riga, eur), testoPrezzo(ok.righe[1].riga, eur), testoPrezzo(ok.totale, eur)]);
  c("ok: nome, variante, indirizzo, quantità e chiave della riga", { key: dopo[0].key, sku: dopo[0].sku, nome: "Patch di prova Alfa", varianteNome: dopo[0].snap.varianteNome, slug: "patch-prova-alfa", qty: 1 },
    (({ key, sku, nome, varianteNome, slug, qty }) => ({ key, sku, nome, varianteNome, slug, qty }))(ok.righe[0]));
  c("ok: la foto della riga è quella del catalogo (480 px per l'elenco)", dopo[0].snap.foto.w480, ok.righe[0].foto.w480);
  c("ok: nessuna riga nascosta e nessuna frase", [0, null], [ok.nascoste, ok.frase]);
  c("l'ordine delle righe è quello del carrello", skuDi(dopo), nomi(ok));

  // ── non verificabile: «—», mai un numero ──
  const nv = righeVista(alterato, "non_verificabile");
  c("non verificabile + memoria alterata: righe visibili, prezzi e totale «—»", [2, ["assente", "assente"], "assente", "—", "—"],
    [nv.righe.length, nv.righe.map((r) => r.riga.tipo), nv.totale.tipo, testoPrezzo(nv.righe[0].riga, eur), testoPrezzo(nv.totale, eur)]);
  c("non verificabile: la cifra alterata non compare", [], [`${ALTERATO}`, "13,57"].filter((x) => JSON.stringify(nv).includes(x)));
  c("uno stato sconosciuto non mostra mai un prezzo (chiuso, mai aperto)", ["assente", "assente"], [righeVista(dopo, "boh").totale.tipo, righeVista(dopo, undefined).righe[0].riga.tipo]);

  // ── righe vecchie e Invisible Derm: mai viste, tolte con la frase ──
  const misto = righeVista(CARRELLO_MISTO, "controllo");
  c("misto in controllo: si vede solo la riga nuova, le altre due sono nascoste", [[CARRELLO_MISTO[0].sku], 2], [nomi(misto), misto.nascoste]);
  c("misto in controllo: c'è la frase di R2 («alcuni prodotti non sono più disponibili»)", CASSA.MSG_RIMOSSE, misto.frase);
  c("misto in controllo: nemmeno una traccia di riga vecchia o di Invisible Derm, né della sua cifra (123,00 €)", [],
    ["prodotto-vecchio", "INV-DERM", "Invisible", "12300", "123,00"].filter((x) => JSON.stringify(misto).includes(x)));
  c("solo righe vecchie: nessuna riga, due nascoste, la frase", [0, 2, CASSA.MSG_RIMOSSE], (({ righe, nascoste, frase }) => [righe.length, nascoste, frase])(righeVista(CARRELLO_VECCHIO, "controllo")));
  c("solo righe vecchie con il server non raggiungibile: nascoste ma NESSUNA frase (non sono state tolte, sono ancora nel carrello)", [0, 2, null],
    (({ righe, nascoste, frase }) => [righe.length, nascoste, frase])(righeVista(CARRELLO_VECCHIO, "non_verificabile")));
  /* Con il motore vero: il carrello misto, passato dal server, perde le due righe e la frase la dà fraseRipulite sul conto di `rimosse`. */
  const ripulito = await CASSA.rivalida(porte(), CARRELLO_MISTO);
  c("motore vero: le righe vecchie e Invisible Derm sono tolte (2)", [[CARRELLO_MISTO[0].sku], 2], [skuDi(ripulito.righe), ripulito.rimosse]);
  c("motore vero + vista: nessuna riga nascosta, la frase viene dalle righe tolte", [1, 0, CASSA.MSG_RIMOSSE], [righeVista(ripulito.righe, "ok").righe.length, righeVista(ripulito.righe, "ok").nascoste, fraseRipulite(ripulito.rimosse)]);
  c("Invisible Derm con un prezzo nella memoria: mai visto, mai nel totale, anche con «ok» e le righe non ancora ripulite",
    [[CARRELLO_MISTO[0].sku], P0], (({ righe, totale }) => [righe.map((r) => r.sku), totale.cent])(righeVista(CARRELLO_MISTO, "ok")));
  c("le righe del catalogo vecchio e di Invisible Derm non entrano nel totale nemmeno con «ok»", P0, righeVista([...CARRELLO_VECCHIO, ...CARRELLO_MISTO], "ok").totale.cent);

  // ── memoria del browser sporca: niente eccezioni, niente pagina bianca (V1-K3) ──
  const SPORCHE = [
    null, undefined, 5, "x", [], {}, { sku: "A-B", qty: 1, key: "k" }, { sku: "A-B", qty: 1, key: "k", snap: null },
    { ...dopo[0], qty: 0 }, { ...dopo[0], qty: -2 }, { ...dopo[0], qty: 1.5 }, { ...dopo[0], qty: "3" }, { ...dopo[0], qty: NaN },
    { ...dopo[0], snap: { ...dopo[0].snap, nome: 7 } }, { ...dopo[0], snap: { ...dopo[0].snap, slug: null } },
    { ...dopo[0], sku: undefined }, { ...dopo[0], sku: "" }, { ...dopo[0], key: undefined },
  ];
  let lanciato = null;
  let sporca = null;
  try {
    sporca = righeVista(SPORCHE, "ok");
  } catch (e) {
    lanciato = String(e);
  }
  c("righe di forma sbagliata nella memoria: nessuna eccezione, nessuna riga inventata", [null, 0, SPORCHE.length], [lanciato, sporca?.righe.length, sporca?.nascoste]);
  c("una riga del catalogo vecchio con uno snap (rovinata o copiata) non si vede e non entra nel totale", [0, "assente-o-zero"],
    (({ righe, totale }) => [righe.length, totale.cent === 0 ? "assente-o-zero" : totale])(righeVista([{ productId: "prodotto-vecchio-1", qty: 1, key: "prodotto-vecchio-1", snap: dopo[0].snap }], "ok")));
  c("elenco non valido (null, testo, oggetto) → carrello senza righe, senza lanciare", [0, 0, 0], [null, "x", {}].map((l) => righeVista(l, "ok").righe.length));
  c("prezzo della riga rovinato (stringa, negativo, con virgola) con «ok»: la riga c'è, il suo prezzo e il totale sono «—»", [["assente", "assente"], "assente"],
    (({ righe, totale }) => [righe.map((r) => r.riga.tipo), totale.tipo])(righeVista([{ ...dopo[0], snap: { ...dopo[0].snap, prezzoCent: "9" } }, { ...dopo[1], snap: { ...dopo[1].snap, prezzoCent: -5 } }], "ok")));
  c("quantità enorme: il totale resta un intero sicuro o «—», mai un numero sbagliato", "assente", righeVista([{ ...dopo[0], qty: Number.MAX_SAFE_INTEGER }], "ok").totale.tipo);
  const prima = JSON.stringify([alterato, CARRELLO_MISTO]);
  righeVista(alterato, "controllo"); righeVista(CARRELLO_MISTO, "ok"); avvisiRiga(alterato, []);
  c("la vista e gli avvisi non modificano le righe d'ingresso", prima, JSON.stringify([alterato, CARRELLO_MISTO]));

  // ── fraseRipulite ──
  c("fraseRipulite: nessuna riga tolta → niente frase", [null, null, null, null], [0, -1, NaN, undefined].map((n) => fraseRipulite(n)));
  c("fraseRipulite: una o più → la frase di R2, la stessa (singolare e plurale)", [CASSA.MSG_RIMOSSE, CASSA.MSG_RIMOSSE], [fraseRipulite(1), fraseRipulite(5)]);
  c("la frase dice «alcuni prodotti non sono più disponibili» (V1-K3), non è un errore", [true, false], [/alcuni prodotti non sono più disponibili/i.test(fraseRipulite(2)), /errore|impossibile|fallit/i.test(fraseRipulite(2))]);

  // ── riepilogo: prodotti · spedizione · totale (V1-K4) ──
  const OK = TARIFFA_CARRELLO_OK; // 490
  const att = { stato: "attesa", costoCent: null, chiusa: false };
  const guasto = { stato: "guasto", costoCent: null, chiusa: false };
  const r1 = riepilogo(ok, OK);
  c("riepilogo con tutto dal server: prodotti, spedizione e totale in centesimi", [{ tipo: "cifra", cent: TOTALE_NUOVO }, { tipo: "cifra", cent: 490 }, { tipo: "cifra", cent: TOTALE_NUOVO + 490 }], [r1.prodotti, r1.spedizione, r1.totale]);
  c("la spedizione del riepilogo è la tariffa del server, nessuna soglia di gratuità (nemmeno con un totale enorme)", 490, riepilogo(righeVista([{ ...dopo[0], qty: 99, snap: { ...dopo[0].snap, prezzoCent: 99900 } }], "ok"), OK).spedizione.cent);
  const r2 = riepilogo(incontrollo, OK);
  c("in controllo: prodotti e totale «…», la spedizione (che viene dal server) c'è", ["attesa", "cifra", "attesa"], [r2.prodotti.tipo, r2.spedizione.tipo, r2.totale.tipo]);
  c("in controllo: nessuna cifra alterata nel riepilogo", [], [`${ALTERATO}`, `${ALTERATO + 490}`].filter((x) => JSON.stringify(r2).includes(x)));
  const r3 = riepilogo(ok, att);
  c("tariffa non ancora letta: spedizione e totale «…»", ["attesa", "attesa"], [r3.spedizione.tipo, r3.totale.tipo]);
  const r4 = riepilogo(ok, TARIFFA_CARRELLO_ASSENTE);
  c("tariffa assente: spedizione e totale «—» (mai un totale senza spedizione)", ["assente", "assente"], [r4.spedizione.tipo, r4.totale.tipo]);
  c("tariffa in guasto: spedizione e totale «—»", ["assente", "assente"], [riepilogo(ok, guasto).spedizione.tipo, riepilogo(ok, guasto).totale.tipo]);
  c("tariffa con una cifra storta (negativa, con virgola, testo): «—»", ["assente", "assente", "assente"], [-5, 4.9, "490"].map((x) => riepilogo(ok, { stato: "ok", costoCent: x, chiusa: false }).spedizione.tipo));
  const r5 = riepilogo(nv, OK);
  c("non verificabile: prodotti e totale «—»", ["assente", "assente"], [r5.prodotti.tipo, r5.totale.tipo]);
  c("in controllo con tariffa assente il totale è «—» (non «…» per sempre)", "assente", riepilogo(incontrollo, TARIFFA_CARRELLO_ASSENTE).totale.tipo);
  c("mai «da calcolare» in nessun caso del riepilogo", [], [r1, r2, r3, r4, r5].filter((r) => /calcolare/i.test(JSON.stringify(r)) || /calcolare/i.test(["prodotti", "spedizione", "totale"].map((k) => testoPrezzo(r[k], eur)).join())));
  c("tariffa mancante o sconosciuta: «—», senza lanciare", ["assente", "assente"], [riepilogo(ok, undefined), riepilogo(ok, null)].map((r) => r.spedizione.tipo));

  // ── avvisiRiga: cosa dire riga per riga quando il server ha cambiato il carrello ──
  const A = avvisiRiga(dopo, [dopo[0]]);
  c("una riga tolta (con il suo nome): avviso inline con il nome, nessuna frase generale", [[{ key: dopo[1].key, tipo: "tolta", testo: "“Patch di prova Beta” non è più disponibile. L'abbiamo tolto dal carrello." }], 0], [A.avvisi, A.ripulite]);
  const Q = avvisiRiga([{ ...dopo[0], qty: 5 }], [{ ...dopo[0], qty: 3 }]);
  c("quantità portata a quanto c'è: avviso inline con il numero (V1-K2)", [[{ key: dopo[0].key, tipo: "quantita", testo: "Di questo prodotto ne abbiamo 3. Abbiamo portato la quantità a 3." }], 0], [Q.avvisi, Q.ripulite]);
  const O = avvisiRiga(CARRELLO_MISTO, [CARRELLO_MISTO[0]]);
  c("righe vecchie e Invisible Derm tolte: nessun avviso con il nome, vanno nella frase generale (2)", [[], 2], [O.avvisi, O.ripulite]);
  c("niente è cambiato (o la quantità è salita): nessun avviso", [{ avvisi: [], ripulite: 0 }, { avvisi: [], ripulite: 0 }], [avvisiRiga(dopo, dopo), avvisiRiga([{ ...dopo[0], qty: 1 }], [{ ...dopo[0], qty: 4 }])]);
  c("una riga nata dopo (non c'era prima) non genera avvisi", { avvisi: [], ripulite: 0 }, avvisiRiga([], dopo));
  const NOME_CATTIVO = "{n} <b>x</b> mario@esempio.it";
  c("un nome strano nella riga tolta resta testo: il segnaposto dentro il nome non si reinterpreta", "“{n} <b>x</b> mario@esempio.it” non è più disponibile. L'abbiamo tolto dal carrello.",
    avvisiRiga([{ ...dopo[0], snap: { ...dopo[0].snap, nome: NOME_CATTIVO } }], []).avvisi[0]?.testo);
  c("righe tolte senza nome utile (vuoto, numero): frase generale, mai «undefined»", [[], 2], (({ avvisi, ripulite }) => [avvisi, ripulite])(avvisiRiga([{ ...dopo[0], snap: { ...dopo[0].snap, nome: "" } }, { ...dopo[1], snap: { ...dopo[1].snap, nome: 3 } }], [])));
  c("elenchi non validi → nessun avviso, senza lanciare", { avvisi: [], ripulite: 0 }, avvisiRiga(null, "x"));
  c("gli avvisi non contengono mai «undefined» né «NaN»", [], [A, Q, O].filter((x) => /undefined|NaN/.test(JSON.stringify(x))));

  // ── barra fissa «Totale · Vai alla cassa» (V1-K1) ──
  c("con righe e il bottone del riepilogo non a schermo: la barra c'è", { visibile: true, inert: false }, (({ visibile, inert }) => ({ visibile, inert }))(barraCarrello({ righe: 2, nascondiConBottone: false })));
  c("con il bottone del riepilogo a schermo la barra sparisce e porta `inert`", { visibile: false, inert: true }, (({ visibile, inert }) => ({ visibile, inert }))(barraCarrello({ righe: 2, nascondiConBottone: true })));
  c("senza righe nessuna barra (carrello vuoto: V1-K5)", [false, true], [barraCarrello({ righe: 0, nascondiConBottone: false }).visibile, barraCarrello({ righe: 0, nascondiConBottone: false }).inert]);
  c("visibile e `inert` non sono mai uguali (una barra nascosta non si raggiunge con Tab)", [], [0, 1, 3].flatMap((n) => [true, false, undefined, "sì"].map((b) => barraCarrello({ righe: n, nascondiConBottone: b }))).filter((x) => x.visibile === x.inert));
  c("se non si sa se il bottone è a schermo (dato mancante) la barra con righe c'è", true, barraCarrello({ righe: 1 }).visibile);
  c("righe non valide (NaN, negativo, testo): nessuna barra", [false, false, false], [NaN, -1, "2"].map((n) => barraCarrello({ righe: n, nascondiConBottone: false }).visibile));
  c("la barra porta alla cassa di oggi: /shop/checkout (V1-K6)", "/shop/checkout", barraCarrello({ righe: 1, nascondiConBottone: false }).href);
  c("ingresso mancante o nullo → nessuna barra, senza lanciare", [false, false], [barraCarrello(undefined).visibile, barraCarrello(null).visibile]);

  // ── carrello vuoto: due ingressi e il link alla consulenza (V1-K5) ──
  const vuoto = ingressiCarrelloVuoto();
  c("vuoto: titolo e testo del documento", ["Il carrello è vuoto.", "Da qui puoi partire: scegli una patch o qualcosa per tenerla bene."], [vuoto.titolo, vuoto.testo]);
  c("vuoto: due ingressi, [Patch pronte] pieno e (Cura e manutenzione) contorno, in quest'ordine", [["Patch pronte", "pieno"], ["Cura e manutenzione", "contorno"]], vuoto.ingressi.map((i) => [i.testo, i.aspetto]));
  c("vuoto: un solo bottone pieno", 1, vuoto.ingressi.filter((i) => i.aspetto === "pieno").length);
  c("vuoto: i due ingressi portano a pagine dello shop che esistono nel documento (categorie di §3.4)", [true, true], vuoto.ingressi.map((i) => /^\/shop\/c\/[a-z0-9-]+$/.test(i.href)));
  c("vuoto: la patch pronta va alla categoria «patch-pronte»", "/shop/c/patch-pronte", vuoto.ingressi[0].href);
  /* I link vengono dalle categorie di testi-shop.ts (§3.4), non sono ripetuti nel modulo. */
  const testiSrc = readFileSync(join(radice, "src/landing/testi-shop.ts"), "utf8");
  const categorieSrc = testiSrc.slice(testiSrc.indexOf("const CATEGORIE"), testiSrc.indexOf("/** Tutti i testi che vengono dal documento"));
  const slugDoc = [...categorieSrc.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]);
  const nomiDoc = [...categorieSrc.matchAll(/nome: "([^"]+)"/g)].map((m) => m[1]);
  c("vuoto: le categorie del documento sono sei e la prima ha il nome del bottone «Patch pronte»", [6, "Patch pronte"], [slugDoc.length, nomiDoc[0]]);
  c("vuoto: i due link sono /shop/c/ + lo slug della categoria del documento (la «patch pronte» per nome, la cura la seconda)", [`/shop/c/${slugDoc[nomiDoc.indexOf("Patch pronte")]}`, `/shop/c/${slugDoc[1]}`], vuoto.ingressi.map((i) => i.href));
  c("vuoto: gli slug delle categorie non sono ripetuti nel sorgente del modulo", [], slugDoc.filter((sl) => sorgenteCarrello.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").includes(sl)));
  c("vuoto: il link alla consulenza è una voce di testo che apre il flusso (non un indirizzo)", { testo: "Non sai cosa scegliere? Consulenza gratuita", azione: "consulenza" }, vuoto.consulenza);
  c("vuoto: ogni chiamata dà oggetti nuovi (modificarli non guasta la prossima)", true, ingressiCarrelloVuoto() !== vuoto && ingressiCarrelloVuoto().ingressi[0] !== vuoto.ingressi[0]);
  c("vuoto: nessuna parola vietata, nessun «{{»", [], trovaParoleVietate(JSON.stringify(vuoto)));
  c("con righe NON c'è nessun invito alla consulenza: la vista e la barra non ne portano il testo", [], [JSON.stringify(ok), JSON.stringify(barraCarrello({ righe: 2, nascondiConBottone: false })), JSON.stringify(r1)].filter((t) => /consulenza/i.test(t)));

  // ── il sorgente: pura, e nessuna lettura di prezzi dalla memoria del browser (V1-T9) ──
  const sorgente = sorgenteCarrello;
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("nessun DOM, nessuna memoria del browser, nessuna rete, nessun orologio, nessun React", [], ["window", "document", "localStorage", "sessionStorage", "fetch(", "Date", "Math.random", "setTimeout", "react", "from \"@/shop/CartContext\""].filter((p) => codice.includes(p)));
  c("nessun import dei server (le funzioni del server non entrano in un modulo puro)", [], [...codice.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).filter((m) => /functions|\.server/.test(m)));
  c("nessuna cifra scritta a mano nel sorgente (la tariffa e i prezzi vengono dal server)", [], codice.match(/\b(490|4,90|4\.9|59)\b/g) ?? []);
}
