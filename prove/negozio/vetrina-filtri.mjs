/** ── VETRINA V1 · T77 · I FILTRI DELLA CATEGORIA (D80) ────────────────────────
 *  `src/shop/cms/vetrina-filtri.ts`: funzioni pure, senza schermo e senza rete. Dati inventati (`_dati-vetrina.mjs`).
 *  Si prova: i gruppi nascono solo dalle opzioni che esistono davvero nelle varianti; un prodotto passa se UNA variante soddisfa
 *  TUTTI i gruppi insieme (e, con «Disponibile», è disponibile); l'indirizzo è rotondo (scrivi → leggi → scrivi, uguale) e con le
 *  chiavi in ordine fisso; un valore sconosciuto si ignora senza errore, qualunque forma abbia l'ingresso.
 *  Criterio: V1-C2 (solo filtri che esistono nei prodotti pubblicati; stato nell'indirizzo). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGO, CATALOGO_SENZA_FOTO } from "./_dati-vetrina.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const F = mod["shop/cms/vetrina-filtri"];
  gruppo("VETRINA V1 · T77 · FILTRI DELLA CATEGORIA (23/11/2026)");

  const slugs = (lista) => lista.map((p) => p.slug);
  const dellaCategoria = (slug, lista = CATALOGO) => lista.filter((p) => p.categorie.some((x) => x.slug === slug));
  const PATCH = dellaCategoria("patch-pronte");
  const CURA = dellaCategoria("cura");
  const per = (slug) => CATALOGO.find((p) => p.slug === slug);
  const chiavi = (gruppi) => gruppi.map((g) => g.chiave);
  const valoriDi = (gruppi, chiave) => gruppi.find((g) => g.chiave === chiave)?.valori.map((v) => v.chiave);
  /** Un prodotto di prova con le sole varianti date: `[{ Colore: "Nero", … }, disponibile]`. Le `opzioni` del prodotto seguono le varianti. */
  const conVarianti = (slug, varianti) => {
    const p = structuredClone(per("patch-prova-beta"));
    p.slug = slug;
    p.varianti = varianti.map(([opzioni, disponibile = true], i) => ({ sku: `${slug}-${i}`, nome: Object.values(opzioni).join(" / "), opzioni, prezzoCent: 1000, disponibile }));
    const nomi = [...new Set(varianti.flatMap(([o]) => Object.keys(o)))];
    p.opzioni = nomi.map((nome) => ({ nome, valori: [...new Set(varianti.flatMap(([o]) => (o[nome] === undefined ? [] : [o[nome]])))].map((valore) => ({ valore, campione: null })) }));
    return p;
  };

  // ── i gruppi nascono solo da opzioni che esistono ──
  const gPatch = F.gruppiDaProdotti(PATCH);
  c("patch: colore, lunghezza, misura e «Disponibile», in quest'ordine", ["colore", "lunghezza", "misura", "disp"], chiavi(gPatch));
  c("patch: i valori del colore, nell'ordine in cui compaiono", ["nero", "castano", "biondo", "unico"], valoriDi(gPatch, "colore"));
  c("patch: lunghezza e misura", [["corta", "media"], ["piccola", "grande", "media"]], [valoriDi(gPatch, "lunghezza"), valoriDi(gPatch, "misura")]);
  c("l'etichetta è quella dei dati (con le maiuscole), la chiave è minuscola senza accenti", ["Colore", "Nero"], [gPatch[0].nome, gPatch[0].valori[0].valore]);
  c("«Colore» è a campioni, gli altri a pillole, «Disponibile» è un interruttore senza valori", ["campioni", "pillole", "pillole", "interruttore", []], [gPatch[0].tipo, gPatch[1].tipo, gPatch[2].tipo, gPatch[3].tipo, gPatch[3].valori]);
  c("«Disponibile» ha l'etichetta del testo del documento", "Disponibile", gPatch[3].nome);
  const gCura = F.gruppiDaProdotti(CURA);
  c("cura: niente colore e niente lunghezza (nessuno li usa), solo misura e «Disponibile»", ["misura", "disp"], chiavi(gCura));
  c("cura: valori con spazi diventano chiavi senza spazi («250 ml» → «250-ml»), etichetta intatta", [["250-ml", "500-ml", "piccola", "grande"], "250 ml"], [valoriDi(gCura, "misura"), gCura[0].valori[0].valore]);
  c("«Base» non c'è finché nessuno la usa", false, chiavi(gPatch).includes("base"));
  c("nessun prodotto → nessun gruppo", [], F.gruppiDaProdotti([]));
  c("prodotti senza opzioni (balsamo, kit) → nessun gruppo di opzione, e niente «Disponibile» se sono tutti disponibili",
    [], F.gruppiDaProdotti([per("balsamo-prova"), per("kit-prova")]));
  c("«Disponibile» solo se ci sono davvero varianti disponibili E non disponibili (patch: sì; tutte disponibili: no; tutte esaurite: no)",
    [true, false, false], [chiavi(gPatch).includes("disp"), chiavi(F.gruppiDaProdotti([per("patch-prova-alfa"), per("patch-prova-beta")])).includes("disp"), chiavi(F.gruppiDaProdotti([per("patch-prova-epsilon")])).includes("disp")]);

  const ghost = structuredClone(per("patch-prova-alfa"));
  ghost.opzioni = [...ghost.opzioni, { nome: "Base", valori: [{ valore: "Lace", campione: null }] }];
  c("un'opzione scritta nel prodotto ma che nessuna variante usa non fa un gruppo", ["colore"], chiavi(F.gruppiDaProdotti([ghost])));
  const conBase = conVarianti("con-base", [[{ Colore: "Nero", Base: "Lace" }], [{ Colore: "Nero", Base: "Skin" }, false]]);
  c("«Base» compare solo se qualcuno la usa, dopo la misura", ["colore", "base", "disp"], chiavi(F.gruppiDaProdotti([conBase])));
  c("le opzioni non previste vengono dopo quelle note, in ordine alfabetico, a prescindere dall'ordine dei prodotti", ["colore", "lunghezza", "taglia", "tessitura", "disp"],
    chiavi(F.gruppiDaProdotti([conVarianti("x", [[{ Tessitura: "A", Taglia: "S", Lunghezza: "30", Colore: "Nero" }, false], [{ Tessitura: "B", Taglia: "M", Lunghezza: "30", Colore: "Nero" }]])])));
  const collisioni = conVarianti("coll", [[{ Disp: "sì", Colore: "Nero" }], [{ "…": "x", Colore: "Biondo" }, false]]);
  c("un'opzione che si chiamerebbe «disp» o che non ha lettere né cifre non diventa un gruppo (non si potrebbe scrivere nell'indirizzo)", ["colore", "disp"], chiavi(F.gruppiDaProdotti([collisioni])));
  const doppi = conVarianti("doppi", [[{ Colore: "Biondo" }], [{ colore: " BIONDO " }], [{ Colore: "Perlé" }]]);
  c("lo stesso valore scritto in due modi (maiuscole, spazi) è un valore solo, con la prima etichetta", [["biondo", "perle"], "Biondo"], [valoriDi(F.gruppiDaProdotti([doppi]), "colore"), F.gruppiDaProdotti([doppi])[0].valori[0].valore]);
  c("l'ordine dei gruppi non dipende dall'ordine dei prodotti", chiavi(gPatch), chiavi(F.gruppiDaProdotti([...PATCH].reverse())));

  // ── i campioni del colore ──
  const campioni = gPatch[0].valori.map((v) => v.campione);
  c("il campione del colore c'è dove c'è la foto, le pillole non ne hanno", [true, true, true, true, [null, null]],
    [...campioni.map((x) => typeof x?.w480 === "string"), [gPatch[1].valori[0].campione, gPatch[2].valori[0].campione]]);
  c("senza foto dei campioni, nessun campione (si userà la lettera)", true, F.gruppiDaProdotti(dellaCategoria("patch-pronte", CATALOGO_SENZA_FOTO))[0].valori.every((v) => v.campione === null));

  // ── applicare i filtri: una variante, tutti i gruppi insieme ──
  const nessuno = F.FILTRI_VUOTI;
  c("nessun filtro: tutti i prodotti, nello stesso ordine, in una lista nuova", [slugs(PATCH), false], [slugs(F.applicaFiltri(PATCH, nessuno)), F.applicaFiltri(PATCH, nessuno) === PATCH]);
  const stato = (valori = {}, disponibile = false) => ({ valori, disponibile });
  c("colore Nero: chi ha una variante nera (alfa, beta, gamma), non delta, non epsilon, non il kit", ["patch-prova-alfa", "patch-prova-beta", "patch-prova-gamma"], slugs(F.applicaFiltri(PATCH, stato({ colore: ["nero"] }))));
  c("due valori dello stesso gruppo = «o»: nero o biondo", ["patch-prova-alfa", "patch-prova-beta", "patch-prova-gamma"], slugs(F.applicaFiltri(PATCH, stato({ colore: ["biondo", "nero"] }))));
  c("gruppi diversi = «e»: nero e lunghezza corta → beta e gamma (alfa non ha lunghezze)", ["patch-prova-beta", "patch-prova-gamma"], slugs(F.applicaFiltri(PATCH, stato({ colore: ["nero"], lunghezza: ["corta"] }))));
  const incrocio = conVarianti("incrocio", [[{ Colore: "Nero", Lunghezza: "Corta" }], [{ Colore: "Castano", Lunghezza: "Media" }]]);
  c("COMBINAZIONI PER VARIANTE: nero + media non c'è come variante, anche se il nero e la media esistono separati → fuori", [[], ["incrocio"], ["incrocio"]],
    [F.applicaFiltri([incrocio], stato({ colore: ["nero"], lunghezza: ["media"] })), slugs(F.applicaFiltri([incrocio], stato({ colore: ["nero"], lunghezza: ["corta"] }))), slugs(F.applicaFiltri([incrocio], stato({ colore: ["castano", "nero"], lunghezza: ["media"] })))]);
  const g = per("patch-prova-gamma");
  // gamma: la prima variante (nero, corta, piccola) e la sesta (castano, corta, grande) sono esaurite
  c("«Disponibile» guarda la variante giusta: nero + corta + piccola esiste ma è esaurita → fuori con «Disponibile», dentro senza",
    [["patch-prova-gamma"], []], [slugs(F.applicaFiltri([g], stato({ colore: ["nero"], lunghezza: ["corta"], misura: ["piccola"] }))), F.applicaFiltri([g], stato({ colore: ["nero"], lunghezza: ["corta"], misura: ["piccola"] }, true))]);
  c("«Disponibile» da solo: fuori chi ha tutte le varianti esaurite (epsilon)", ["patch-prova-alfa", "patch-prova-beta", "patch-prova-gamma", "patch-prova-delta", "kit-prova"], slugs(F.applicaFiltri(PATCH, stato({}, true))));
  c("«Disponibile» + un colore: nero disponibile esiste in alfa, beta, gamma (nelle altre varianti nere)", ["patch-prova-alfa", "patch-prova-beta", "patch-prova-gamma"], slugs(F.applicaFiltri(PATCH, stato({ colore: ["nero"] }, true))));
  c("un prodotto senza quell'opzione non passa un filtro su quell'opzione (il kit non ha il colore)", false, slugs(F.applicaFiltri(PATCH, stato({ colore: ["nero", "castano", "biondo", "unico"] }))).includes("kit-prova"));
  c("Invisible Derm (varianti mai disponibili) non passa «Disponibile»", false, slugs(F.applicaFiltri(CURA, stato({}, true))).includes("invisible-derm-prova"));
  c("un prodotto senza varianti passa senza filtri e non passa con un filtro", [1, 0], [F.applicaFiltri([{ ...per("balsamo-prova"), varianti: [] }], nessuno).length, F.applicaFiltri([{ ...per("balsamo-prova"), varianti: [] }], stato({ misura: ["m"] })).length]);
  c("un gruppo con nome come una proprietà degli oggetti («constructor») non rompe niente", [0, 1], [F.applicaFiltri([per("balsamo-prova")], stato({ constructor: ["x"] })).length, F.applicaFiltri([per("balsamo-prova")], stato({})).length]);
  c("nessun ordinamento: l'ordine dei prodotti in ingresso resta (anche rovesciato)", ["patch-prova-gamma", "patch-prova-beta", "patch-prova-alfa"], slugs(F.applicaFiltri([...PATCH].reverse(), stato({ colore: ["nero"] }))));
  c("conteggio = quanti prodotti passano", [6, 3, 2, 0], [F.conteggio(PATCH, nessuno), F.conteggio(PATCH, stato({ colore: ["nero"] })), F.conteggio(PATCH, stato({ colore: ["nero"], lunghezza: ["corta"] })), F.conteggio([], stato({ colore: ["nero"] }))]);
  const congelati = structuredClone(PATCH).map((p) => Object.freeze(p));
  const statoGelato = Object.freeze(stato(Object.freeze({ colore: Object.freeze(["nero"]) })));
  c("non modifica né i prodotti né lo stato (congelati: se scrivesse, lancerebbe)", 3, F.applicaFiltri(Object.freeze(congelati), statoGelato).length);

  // ── l'indirizzo: leggere ──
  const leggi = (sp, gruppi = gPatch) => F.leggiFiltri(sp, gruppi);
  c("indirizzo vuoto → nessun filtro", { valori: {}, disponibile: false }, leggi(""));
  c("colori separati da virgola, misura, disponibile", { valori: { colore: ["castano", "nero"], misura: ["piccola"] }, disponibile: true }, leggi("?colore=nero,castano&misura=piccola&disp=1"));
  c("il «?» iniziale è facoltativo", leggi("?colore=nero"), leggi("colore=nero"));
  c("legge anche un URLSearchParams", { valori: { colore: ["nero"] }, disponibile: false }, leggi(new URLSearchParams("colore=nero")));
  c("legge anche l'oggetto del router (numeri e booleani compresi)", [{ valori: { colore: ["castano", "nero"] }, disponibile: true }, { valori: {}, disponibile: true }, { valori: {}, disponibile: true }],
    [leggi({ colore: "nero,castano", disp: 1 }), leggi({ disp: true }), leggi({ disp: "1" })]);
  c("lo stesso parametro ripetuto (?colore=a&colore=b) vale come lista; anche una lista nell'oggetto", [{ valori: { colore: ["castano", "nero"] }, disponibile: false }, { valori: { colore: ["castano", "nero"] }, disponibile: false }],
    [leggi("colore=nero&colore=castano"), leggi({ colore: ["nero", "castano"] })]);
  c("maiuscole, accenti e spazi nei valori non contano (?colore=NERO, Càstano)", { valori: { colore: ["castano", "nero"] }, disponibile: false }, leggi("colore=NERO,%20C%C3%A0stano"));
  c("nessun doppione: nero,nero,Nero → nero", ["nero"], leggi("colore=nero,nero,Nero").valori.colore);
  c("VALORI SCONOSCIUTI IGNORATI: verde non c'è, il nero sì", { valori: { colore: ["nero"] }, disponibile: false }, leggi("colore=verde,nero"));
  c("un gruppo di soli valori sconosciuti sparisce del tutto (nessuna chiave vuota)", { valori: {}, disponibile: false }, leggi("colore=verde&misura=enorme"));
  c("parametri sconosciuti (taglia, utm, x) ignorati", { valori: { colore: ["nero"] }, disponibile: false }, leggi("taglia=xl&utm_source=a&colore=nero&x=1"));
  c("«disp» con un valore strano non accende niente", [false, false, false, false], ["0", "no", "", "boh"].map((v) => leggi(`disp=${v}`).disponibile));
  c("«disp» chiesto dove non esiste (nessuna variante esaurita) si ignora", false, leggi("disp=1", F.gruppiDaProdotti([per("patch-prova-alfa")])).disponibile);
  c("valori vuoti e virgole in fila (colore=,,) → niente", { valori: {}, disponibile: false }, leggi("colore=,,&misura="));
  c("codifica rotta (%E0%A4%A) non lancia", { valori: {}, disponibile: false }, leggi("colore=%E0%A4%A"));
  c("chiavi come proprietà degli oggetti (constructor, __proto__, toString) non lanciano e non si leggono",
    { valori: {}, disponibile: false }, leggi("constructor=x&__proto__=y&toString=1&hasOwnProperty=2"));
  c("ingressi strani (null, undefined, numero, lista) → nessun filtro, nessun errore", [true, true, true, true],
    [null, undefined, 42, []].map((x) => JSON.stringify(leggi(x)) === JSON.stringify({ valori: {}, disponibile: false })));
  c("senza gruppi (la categoria non ha opzioni) ogni parametro è ignorato", { valori: {}, disponibile: false }, leggi("colore=nero&disp=1", []));
  c("un valore con accento e un altro con spazi si leggono per chiave (perlé, 250 ml)", [{ finitura: ["perle"] }, { misura: ["250-ml"] }],
    [leggi("finitura=Perl%C3%A9", F.gruppiDaProdotti([conVarianti("p", [[{ Finitura: "Perlé" }]])])).valori, leggi("misura=250%20ml", gCura).valori]);
  c("i valori nello stato sono in ordine alfabetico qualunque sia l'ordine nell'indirizzo", leggi("colore=nero,biondo,castano").valori, leggi("colore=castano,nero,biondo").valori);

  // ── l'indirizzo: scrivere ──
  c("stato vuoto → nessun indirizzo (stringa vuota)", "", F.scriviFiltri(nessuno));
  c("chiavi in ordine fisso: colore, lunghezza, misura, poi le altre, «disp» per ultima", "colore=castano,nero&lunghezza=corta&misura=piccola&disp=1",
    F.scriviFiltri({ disponibile: true, valori: { misura: ["piccola"], lunghezza: ["corta"], colore: ["nero", "castano"] } }));
  c("ordine fisso anche per i gruppi non previsti (base, poi alfabetico)", "colore=nero&base=lace&taglia=s&tessitura=a", F.scriviFiltri({ disponibile: false, valori: { tessitura: ["a"], taglia: ["s"], base: ["lace"], colore: ["nero"] } }));
  c("niente codifica: sono lettere, cifre e trattini (la virgola resta virgola)", "misura=250-ml,500-ml", F.scriviFiltri({ disponibile: false, valori: { misura: ["500-ml", "250-ml"] } }));
  c("un gruppo senza valori non si scrive", "disp=1", F.scriviFiltri({ disponibile: true, valori: { colore: [], misura: [] } }));
  c("uno stato scritto a mano in modo disordinato si scrive pulito (maiuscole, doppioni, vuoti)", "colore=biondo,nero", F.scriviFiltri({ disponibile: false, valori: { Colore: ["Nero", "nero", " ", "BIONDO"] } }));
  c("ingressi strani non lanciano", ["", ""], [F.scriviFiltri(null), F.scriviFiltri({})]);

  // ── INDIRIZZO ROTONDO ──
  c("rotondo: scrivi → leggi → scrivi è uguale (e leggi(scrivi(s)) è s)", true, (() => {
    const colori = ["nero", "castano", "biondo", "unico"], misure = ["piccola", "grande", "media"];
    let tutti = true, n = 0;
    for (let a = 0; a < 16; a++) for (let b = 0; b < 8; b++) for (const d of [false, true]) {
      const s = { valori: {}, disponibile: d };
      const cs = colori.filter((_, i) => a & (1 << i)), ms = misure.filter((_, i) => b & (1 << i));
      if (cs.length) s.valori.colore = cs.sort();
      if (ms.length) s.valori.misura = ms.sort();
      const url = F.scriviFiltri(s), letto = leggi(url);
      if (JSON.stringify(letto) !== JSON.stringify(s) || F.scriviFiltri(letto) !== url) tutti = false;
      n++;
    }
    return tutti && n === 256;
  })());
  c("rotondo con tutti e quattro i gruppi e una virgola nel valore («2,5»)", true, (() => {
    const gg = F.gruppiDaProdotti([conVarianti("r", [[{ Colore: "Nero", Lunghezza: "2,5", Base: "Lace", Taglia: "S" }], [{ Colore: "Biondo", Lunghezza: "30", Base: "Skin", Taglia: "M" }, false]])]);
    const s = leggi("taglia=m,s&base=skin&lunghezza=2-5&colore=nero&disp=1", gg);
    const url = F.scriviFiltri(s);
    return url === "colore=nero&lunghezza=2-5&base=skin&taglia=m,s&disp=1" && F.scriviFiltri(leggi(url, gg)) === url && Object.keys(s.valori).length === 4;
  })());
  c("ricaricare dà la stessa pagina: indirizzi con parametri in ordine diverso → lo stesso indirizzo scritto",
    F.scriviFiltri(leggi("disp=1&misura=piccola&colore=nero")), F.scriviFiltri(leggi("colore=nero&disp=1&misura=piccola")));
  c("l'indirizzo scritto si legge anche con la forma del router (oggetto fatto con URLSearchParams)", leggi("colore=nero,castano&disp=1"), leggi(Object.fromEntries(new URLSearchParams(F.scriviFiltri(leggi("colore=nero,castano&disp=1"))))));

  // ── chip e conteggio dei filtri ──
  const s3 = leggi("colore=castano,nero&misura=piccola&disp=1");
  const chip = F.chipAttivi(gPatch, s3);
  c("chip: uno per ogni valore scelto, nell'ordine dei gruppi e dei valori, «Disponibile» per ultimo",
    [["colore", "nero", "Nero"], ["colore", "castano", "Castano"], ["misura", "piccola", "Piccola"], ["disp", null, "Disponibile"]], chip.map((x) => [x.gruppo, x.valore, x.etichetta]));
  c("nessun filtro → nessun chip; stato con valori che il gruppo non ha → nessun chip per quelli", [[], ["nero"]],
    [F.chipAttivi(gPatch, nessuno), F.chipAttivi(gPatch, stato({ colore: ["verde", "nero"] })).map((x) => x.valore)]);
  c("filtriAttivi = numero dei chip (serve a «Filtra (n)»)", [4, 0, 1], [F.filtriAttivi(s3), F.filtriAttivi(nessuno), F.filtriAttivi(stato({}, true))]);
  c("togliere un chip toglie solo quel valore", { valori: { colore: ["castano"], misura: ["piccola"] }, disponibile: true }, F.togliFiltro(s3, chip[0]));
  c("togliere l'ultimo valore di un gruppo toglie il gruppo", { valori: { colore: ["castano", "nero"] }, disponibile: true }, F.togliFiltro(s3, chip[2]));
  c("togliere «Disponibile» lo spegne", { valori: { colore: ["castano", "nero"], misura: ["piccola"] }, disponibile: false }, F.togliFiltro(s3, chip[3]));
  c("togliere tutti i chip uno a uno riporta a nessun filtro (e a un indirizzo vuoto)", "", F.scriviFiltri(chip.reduce((st, x) => F.togliFiltro(st, x), s3)));
  c("togliere un chip non cambia lo stato di partenza", { valori: { colore: ["castano", "nero"], misura: ["piccola"] }, disponibile: true }, s3);

  // ── un'opzione chiamata come una proprietà degli oggetti («constructor») non rompe chip e «togli» ──
  const ggC = F.gruppiDaProdotti([conVarianti("c", [[{ Constructor: "A", Colore: "Nero" }], [{ Constructor: "B", Colore: "Biondo" }, false]])]);
  c("«Constructor» è un gruppo come gli altri (chiave minuscola)", ["colore", "constructor", "disp"], chiavi(ggC));
  c("chip con uno stato che NON ha quel gruppo: nessun errore, solo i chip che ci sono", ["nero"], F.chipAttivi(ggC, stato({ colore: ["nero"] })).map((x) => x.valore));
  c("chip e filtro con il gruppo «constructor» scelto", [["colore", "nero"], ["constructor", "a"]], F.chipAttivi(ggC, leggi("constructor=a&colore=nero", ggC)).map((x) => [x.gruppo, x.valore]));
  c("«togli» un chip di un gruppo che lo stato non ha: nessun errore, stato com'era", stato({ colore: ["nero"] }), F.togliFiltro(stato({ colore: ["nero"] }), { gruppo: "constructor", valore: "a", etichetta: "A" }));
  c("«togli» il chip «constructor» quando c'è", { valori: { colore: ["nero"] }, disponibile: false }, F.togliFiltro(leggi("constructor=a&colore=nero", ggC), { gruppo: "constructor", valore: "a", etichetta: "A" }));

  // ── il sorgente: niente rete, niente schermo, niente orologio ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/vetrina-filtri.ts"), "utf8");
  const senzaCommenti = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("il modulo è puro: niente window, document, fetch, Date, Math.random, console, storage", [], senzaCommenti.match(/\b(window|document|fetch|localStorage|sessionStorage|navigator|Date|console)\b|Math\.random/g) ?? []);
  c("importa solo i tipi del modello e i testi dello shop", [], (senzaCommenti.match(/^\s*import\s.*$/gm) ?? []).filter((r) => !/from "\.\/modello"/.test(r) && !/from "@\/landing\/testi-shop"/.test(r)));
}
