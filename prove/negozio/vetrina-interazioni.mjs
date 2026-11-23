/** ── VETRINA V1 · T105 · I RIDUTTORI PURI DELLE INTERAZIONI (D103) ──────────
 *  `src/shop/cms/vetrina-interazioni.ts`: funzioni senza schermo, senza rete e senza timer. Il tempo entra come parametro
 *  (`adesso` in millisecondi); i riduttori restituiscono STATI, mai frasi (i testi stanno in `src/landing/testi-shop.ts`).
 *  Qui si prova ogni transizione e ogni bordo; fuoco vero, Esc nel browser, `aria-live` e timer veri restano [M]/[T] (T103c, T106).
 *  Criteri: V1-T12 (parte logica), V1-S2, V1-S3, V1-T15 (offline, scheletri). */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Congela in profondità: un riduttore che modifica il suo ingresso lancia (siamo in modulo ES = strict). */
const gela = (o) => Object.freeze(o);

export async function prove(mod, { c, gruppo, radice }) {
  const V = mod["shop/cms/vetrina-interazioni"];
  gruppo("VETRINA V1 · T105 · RIDUTTORI PURI DELLE INTERAZIONI (23/11/2026)");

  // ── costanti ──
  c("le due soglie del piano: «Aggiunto» 2 s, scheletro dopo 300 ms", [2000, 300], [V.DURATA_AGGIUNTO_MS, V.RITARDO_SCHELETRO_MS]);

  // ── statoAggiunta: bottone «Aggiunto» per 2 s, poi di nuovo «Aggiungi» ──
  c("mai aggiunto (null) → aggiungi", "aggiungi", V.statoAggiunta(null, 5000));
  c("mai aggiunto (undefined) → aggiungi", "aggiungi", V.statoAggiunta(undefined, 5000));
  c("nell'istante dell'aggiunta → aggiunto", "aggiunto", V.statoAggiunta(1000, 1000));
  c("a metà strada (1 s) → aggiunto", "aggiunto", V.statoAggiunta(1000, 2000));
  c("1999 ms dopo → ancora aggiunto", "aggiunto", V.statoAggiunta(1000, 2999));
  c("esattamente 2000 ms dopo → di nuovo aggiungi (scade quando scatta il timer)", "aggiungi", V.statoAggiunta(1000, 3000));
  c("molto dopo → aggiungi", "aggiungi", V.statoAggiunta(1000, 90000));
  c("orologio che torna indietro (adesso prima dell'aggiunta) → aggiungi, non resta «Aggiunto» in eterno", "aggiungi", V.statoAggiunta(5000, 4000));
  c("un secondo clic riparte da capo: 1500 ms dopo il primo ma 500 dopo il secondo → aggiunto", "aggiunto", V.statoAggiunta(2500, 3000));
  c("istante non numerico (NaN) → aggiungi", ["aggiungi", "aggiungi"], [V.statoAggiunta(NaN, 100), V.statoAggiunta(100, NaN)]);
  c("lo stato è una parola neutra, non la frase del bottone", [], ["aggiungi", "aggiunto"].filter((s) => /\s|[A-Z]/.test(s)));

  // ── mostraScheletro: solo dopo 300 ms ──
  c("nessuna attesa in corso (null) → niente scheletro", false, V.mostraScheletro(null, 9999));
  c("attesa appena cominciata → niente scheletro (nessun lampo)", false, V.mostraScheletro(1000, 1000));
  c("299 ms → niente scheletro", false, V.mostraScheletro(1000, 1299));
  c("esattamente 300 ms → scheletro", true, V.mostraScheletro(1000, 1300));
  c("2 s → scheletro", true, V.mostraScheletro(1000, 3000));
  c("orologio indietro → niente scheletro", false, V.mostraScheletro(1000, 500));
  c("istante non numerico → niente scheletro", [false, false], [V.mostraScheletro(NaN, 100), V.mostraScheletro(100, NaN)]);

  // ── statoRete: striscia offline ──
  c("navigator.onLine true → online", "online", V.statoRete(true));
  c("navigator.onLine false → offline", "offline", V.statoRete(false));
  c("valore sconosciuto (server, null, undefined) → online: la striscia non compare a torto", ["online", "online"], [V.statoRete(null), V.statoRete(undefined)]);
  c("sequenza online → offline → online → offline segue l'ingresso senza memoria", ["online", "offline", "online", "offline"], [true, false, true, false].map(V.statoRete));

  // ── stepGalleria ──
  const g = (indice, totale) => gela({ indice, totale });
  const passo = (indice, totale, comando) => V.stepGalleria(g(indice, totale), comando);
  c("avanti dalla prima di 5 → seconda", { indice: 1, totale: 5 }, passo(0, 5, "avanti"));
  c("indietro dalla terza → seconda", { indice: 1, totale: 5 }, passo(2, 5, "indietro"));
  c("bordo: indietro dalla prima resta sulla prima (nessun giro)", { indice: 0, totale: 5 }, passo(0, 5, "indietro"));
  c("bordo: avanti dall'ultima resta sull'ultima (nessun giro)", { indice: 4, totale: 5 }, passo(4, 5, "avanti"));
  c("primo / ultimo", [0, 4], [passo(3, 5, "primo").indice, passo(1, 5, "ultimo").indice]);
  c("vai a una miniatura (3)", 3, passo(0, 5, { vai: 3 }).indice);
  c("vai oltre la fine → ultima; vai prima dell'inizio → prima", [4, 0], [passo(0, 5, { vai: 99 }).indice, passo(2, 5, { vai: -2 }).indice]);
  c("vai con numero non intero → la parte intera (2,7 → 2)", 2, passo(0, 5, { vai: 2.7 }).indice);
  c("vai con NaN o Infinity → resta dov'è", [3, 3], [passo(3, 5, { vai: NaN }).indice, passo(3, 5, { vai: Infinity }).indice]);
  c("comando sconosciuto → resta dov'è", 2, passo(2, 5, "salta").indice);
  c("UNA FOTO SOLA: nessun comando si muove (V1-S2)", [0, 0, 0, 0, 0], ["avanti", "indietro", "primo", "ultimo", { vai: 4 }].map((k) => passo(0, 1, k).indice));
  c("nessuna foto: indice 0, totale 0, nessun passo", [{ indice: 0, totale: 0 }, { indice: 0, totale: 0 }], [passo(0, 0, "avanti"), passo(3, 0, "ultimo")]);
  c("totale non valido (NaN, negativo, non intero) si legge come nessuna foto o come la parte intera", [0, 0, 2], [passo(0, NaN, "avanti").totale, passo(0, -3, "avanti").totale, passo(0, 2.9, "ultimo").totale]);
  c("indice fuori campo in ingresso (7 su 5) viene riportato dentro prima del passo: avanti → ultima", 4, passo(7, 5, "avanti").indice);
  c("indice negativo in ingresso (-3 su 5) → indietro resta sulla prima", 0, passo(-3, 5, "indietro").indice);
  const dentro = g(1, 5);
  const fuori = V.stepGalleria(dentro, "avanti");
  c("il riduttore non modifica lo stato in ingresso e ne restituisce uno nuovo", [1, true], [dentro.indice, fuori !== dentro]);

  // ── controlliGalleria: quali controlli si disegnano ──
  c("5 foto, prima: controlli sì, indietro no, avanti sì", { mostra: true, haPrecedente: false, haSuccessivo: true }, V.controlliGalleria(g(0, 5)));
  c("5 foto, a metà: indietro e avanti sì", { mostra: true, haPrecedente: true, haSuccessivo: true }, V.controlliGalleria(g(2, 5)));
  c("5 foto, ultima: indietro sì, avanti no", { mostra: true, haPrecedente: true, haSuccessivo: false }, V.controlliGalleria(g(4, 5)));
  c("2 foto: i controlli ci sono", true, V.controlliGalleria(g(0, 2)).mostra);
  c("UNA foto: nessun controllo (frecce, puntini, miniature) e nessun passo", { mostra: false, haPrecedente: false, haSuccessivo: false }, V.controlliGalleria(g(0, 1)));
  c("nessuna foto: nessun controllo", { mostra: false, haPrecedente: false, haSuccessivo: false }, V.controlliGalleria(g(0, 0)));
  c("coerenza: dove i controlli dicono «no» il passo non si muove (tutte le posizioni da 1 a 6 foto)", [], (() => {
    const male = [];
    for (let n = 0; n <= 6; n++) for (let i = 0; i < Math.max(n, 1); i++) {
      const k = V.controlliGalleria(g(i, n));
      if (!k.haSuccessivo && passo(i, n, "avanti").indice !== i) male.push(`avanti ${i}/${n}`);
      if (!k.haPrecedente && passo(i, n, "indietro").indice !== i) male.push(`indietro ${i}/${n}`);
      if (k.haSuccessivo && passo(i, n, "avanti").indice !== i + 1) male.push(`avanti-sì ${i}/${n}`);
      if (k.haPrecedente && passo(i, n, "indietro").indice !== i - 1) male.push(`indietro-sì ${i}/${n}`);
    }
    return male;
  })());

  // ── comandoDaTasto ──
  c("tasti della galleria: frecce, Home, End", ["avanti", "indietro", "primo", "ultimo"], ["ArrowRight", "ArrowLeft", "Home", "End"].map(V.comandoDaTasto));
  c("gli altri tasti non sono della galleria (Enter, Esc, Tab, lettere, frecce su/giù)", [null, null, null, null, null, null], ["Enter", "Escape", "Tab", "a", "ArrowUp", "ArrowDown"].map(V.comandoDaTasto));

  // ── foglio: aperto/chiuso e CHI lo ha aperto ──
  c("stato iniziale: chiuso, nessuno l'ha aperto, nessun fuoco da restituire", { aperto: false, apertoDa: null, fuocoA: null }, V.FOGLIO_CHIUSO);
  const aperto = V.foglio(V.FOGLIO_CHIUSO, { tipo: "apri", da: "bottone-filtri" });
  c("apri: aperto e ricorda chi l'ha aperto", { aperto: true, apertoDa: "bottone-filtri", fuocoA: null }, aperto);
  const chiuso = V.foglio(aperto, { tipo: "chiudi" });
  c("chiudi: chiuso, e il fuoco torna a chi l'aveva aperto", { aperto: false, apertoDa: null, fuocoA: "bottone-filtri" }, chiuso);
  c("riaprire da un altro bottone cancella il fuoco da restituire e ricorda il nuovo", { aperto: true, apertoDa: "bottone-menu", fuocoA: null }, V.foglio(chiuso, { tipo: "apri", da: "bottone-menu" }));
  c("apri mentre è già aperto: resta chi l'ha aperto per primo (il fuoco torna al vero bottone)", { aperto: true, apertoDa: "bottone-filtri", fuocoA: null }, V.foglio(aperto, { tipo: "apri", da: "altro" }));
  c("chiudi mentre è già chiuso: nessun cambiamento (stesso oggetto)", true, V.foglio(chiuso, { tipo: "chiudi" }) === chiuso);
  c("alterna da chiuso apre, da aperto chiude", [true, false], [V.foglio(V.FOGLIO_CHIUSO, { tipo: "alterna", da: "x" }).aperto, V.foglio(aperto, { tipo: "alterna", da: "x" }).aperto]);
  c("alterna da aperto chiude restituendo il fuoco a chi aveva aperto, non a chi alterna", "bottone-filtri", V.foglio(aperto, { tipo: "alterna", da: "x" }).fuocoA);
  c("apri senza dire chi (vuoto o mancante): si apre lo stesso, senza fuoco da restituire", [{ aperto: true, apertoDa: null, fuocoA: null }, { aperto: true, apertoDa: null, fuocoA: null }], [V.foglio(V.FOGLIO_CHIUSO, { tipo: "apri", da: "" }), V.foglio(V.FOGLIO_CHIUSO, { tipo: "apri" })]);
  c("chiudere un foglio aperto senza «chi» lascia fuocoA a null (nessun fuoco inventato)", { aperto: false, apertoDa: null, fuocoA: null }, V.foglio(V.foglio(V.FOGLIO_CHIUSO, { tipo: "apri" }), { tipo: "chiudi" }));
  c("azione sconosciuta → stesso stato", true, V.foglio(aperto, { tipo: "gira" }) === aperto);
  c("gli stati iniziali sono congelati (nessuno li sporca per sbaglio)", [true, true, true], [V.FOGLIO_CHIUSO, V.LIGHTBOX_CHIUSA, V.TENDINA_CHIUSA].map(Object.isFrozen));

  // ── lightbox: indice + chi l'ha aperta ──
  c("stato iniziale: chiusa, indice 0, totale 0", { aperto: false, apertoDa: null, fuocoA: null, indice: 0, totale: 0 }, V.LIGHTBOX_CHIUSA);
  const l1 = V.lightbox(V.LIGHTBOX_CHIUSA, { tipo: "apri", da: "diapositiva-3", indice: 2, totale: 5 });
  c("apri sulla terza di 5: aperta, indice 2, ricorda la diapositiva", { aperto: true, apertoDa: "diapositiva-3", fuocoA: null, indice: 2, totale: 5 }, l1);
  c("freccia avanti / indietro nella lightbox", [3, 1], [V.lightbox(l1, { tipo: "vai", comando: "avanti" }).indice, V.lightbox(l1, { tipo: "vai", comando: "indietro" }).indice]);
  c("bordo: dall'ultima, avanti non esce dalla lightbox né gira", { indice: 4, aperto: true }, (() => { const s = V.lightbox(V.lightbox(l1, { tipo: "vai", comando: "ultimo" }), { tipo: "vai", comando: "avanti" }); return { indice: s.indice, aperto: s.aperto }; })());
  c("bordo: dalla prima, indietro resta sulla prima", 0, V.lightbox(V.lightbox(l1, { tipo: "vai", comando: "primo" }), { tipo: "vai", comando: "indietro" }).indice);
  c("apri con indice fuori campo → portato dentro (9 su 5 → ultima; -1 → prima)", [4, 0], [V.lightbox(V.LIGHTBOX_CHIUSA, { tipo: "apri", da: "x", indice: 9, totale: 5 }).indice, V.lightbox(V.LIGHTBOX_CHIUSA, { tipo: "apri", da: "x", indice: -1, totale: 5 }).indice]);
  const l2 = V.lightbox(V.lightbox(l1, { tipo: "vai", comando: "avanti" }), { tipo: "chiudi" });
  c("chiudi: il fuoco torna alla diapositiva che l'ha aperta e l'indice resta (la galleria si riallinea)", { aperto: false, apertoDa: null, fuocoA: "diapositiva-3", indice: 3, totale: 5 }, l2);
  c("da chiusa, i passi non fanno niente (stesso oggetto)", true, V.lightbox(l2, { tipo: "vai", comando: "avanti" }) === l2);
  c("UNA foto sola: la lightbox si apre, ma nessun comando la muove (V1-S2)", [true, 0, 0, 0], (() => {
    const s = V.lightbox(V.LIGHTBOX_CHIUSA, { tipo: "apri", da: "d", indice: 0, totale: 1 });
    return [s.aperto, ...["avanti", "indietro", "ultimo"].map((k) => V.lightbox(s, { tipo: "vai", comando: k }).indice)];
  })());
  c("nessuna foto: la lightbox non si apre", false, V.lightbox(V.LIGHTBOX_CHIUSA, { tipo: "apri", da: "d", indice: 0, totale: 0 }).aperto);
  c("apri mentre è già aperta: resta com'è (stessa foto, stesso 'chi')", true, V.lightbox(l1, { tipo: "apri", da: "altro", indice: 4, totale: 5 }) === l1);
  c("chiudi da chiusa: stesso oggetto", true, V.lightbox(V.LIGHTBOX_CHIUSA, { tipo: "chiudi" }) === V.LIGHTBOX_CHIUSA);

  // ── voceEvidenziata: tendina della ricerca ──
  const T = (aperta, indice) => gela({ aperta, indice });
  const tasto = (stato, k, n) => V.voceEvidenziata(stato, k, n);
  c("stato iniziale: chiusa, nessuna voce", { aperta: false, indice: null }, V.TENDINA_CHIUSA);
  c("dopo una digitazione con 5 risultati: aperta, nessuna voce evidenziata", { aperta: true, indice: null }, V.tendinaDopoDigitazione(5));
  c("dopo una digitazione senza risultati: chiusa", { aperta: false, indice: null }, V.tendinaDopoDigitazione(0));
  c("freccia giù da chiusa con risultati: si apre sulla prima", { aperta: true, indice: 0, azione: "nessuna", gestito: true }, tasto(V.TENDINA_CHIUSA, "ArrowDown", 5));
  c("freccia su da chiusa con risultati: si apre sull'ultima", { aperta: true, indice: 4, azione: "nessuna", gestito: true }, tasto(V.TENDINA_CHIUSA, "ArrowUp", 5));
  c("giù da aperta senza voce → prima", 0, tasto(T(true, null), "ArrowDown", 5).indice);
  c("su da aperta senza voce → ultima", 4, tasto(T(true, null), "ArrowUp", 5).indice);
  c("giù: 0 → 1 → 2", [1, 2], [tasto(T(true, 0), "ArrowDown", 5).indice, tasto(T(true, 1), "ArrowDown", 5).indice]);
  c("su: 3 → 2", 2, tasto(T(true, 3), "ArrowUp", 5).indice);
  c("bordo: giù dall'ultima torna alla prima (giro)", 0, tasto(T(true, 4), "ArrowDown", 5).indice);
  c("bordo: su dalla prima va all'ultima (giro)", 4, tasto(T(true, 0), "ArrowUp", 5).indice);
  c("un solo risultato: giù e su restano sulla prima", [0, 0], [tasto(T(true, 0), "ArrowDown", 1).indice, tasto(T(true, 0), "ArrowUp", 1).indice]);
  c("nessun risultato: le frecce non fanno niente e non si prendono il tasto", { aperta: false, indice: null, azione: "nessuna", gestito: false }, tasto(V.TENDINA_CHIUSA, "ArrowDown", 0));
  c("Invio con una voce evidenziata: apri quella voce e chiudi la tendina", { aperta: false, indice: 2, azione: "apri", gestito: true }, tasto(T(true, 2), "Enter", 5));
  c("Invio senza voce evidenziata: cerca (vai a /shop/cerca) e chiudi", { aperta: false, indice: null, azione: "cerca", gestito: true }, tasto(T(true, null), "Enter", 5));
  c("Invio con la tendina chiusa: cerca", { aperta: false, indice: null, azione: "cerca", gestito: true }, tasto(V.TENDINA_CHIUSA, "Enter", 5));
  c("Invio senza risultati: cerca", "cerca", tasto(V.TENDINA_CHIUSA, "Enter", 0).azione);
  c("Esc con la tendina aperta: chiude, toglie la voce, si prende il tasto", { aperta: false, indice: null, azione: "chiudi", gestito: true }, tasto(T(true, 2), "Escape", 5));
  c("Esc con la tendina chiusa: niente, il tasto resta a chi sta sopra (campo, foglio)", { aperta: false, indice: null, azione: "nessuna", gestito: false }, tasto(V.TENDINA_CHIUSA, "Escape", 5));
  c("un altro tasto (lettera, Tab, Home): nessun cambiamento e non si prende il tasto", [true, true, true], ["a", "Tab", "Home"].map((k) => { const s = T(true, 2); const r = tasto(s, k, 5); return r.aperta === true && r.indice === 2 && r.azione === "nessuna" && r.gestito === false; }));
  c("la voce evidenziata fuori campo (i risultati sono calati da 5 a 3) viene tolta: Invio → cerca", { indice: null, azione: "cerca" }, (() => { const r = tasto(T(true, 4), "Enter", 3); return { indice: r.indice, azione: r.azione }; })());
  c("voce fuori campo + freccia giù → riparte dalla prima", 0, tasto(T(true, 4), "ArrowDown", 3).indice);
  c("risultati finiti (5 → 0) con tendina «aperta» nello stato: Esc non è gestito, è come chiusa", false, tasto(T(true, 1), "Escape", 0).gestito);
  c("totale non valido (NaN) si legge come zero risultati", "cerca", tasto(T(true, 0), "Enter", NaN).azione);
  c("percorso intero: digito → giù → giù → su → Invio apre la voce 0", { azione: "apri", indice: 0 }, (() => {
    let s = V.tendinaDopoDigitazione(5);
    for (const k of ["ArrowDown", "ArrowDown", "ArrowUp"]) { const r = tasto(s, k, 5); s = { aperta: r.aperta, indice: r.indice }; }
    const r = tasto(s, "Enter", 5);
    return { azione: r.azione, indice: r.indice };
  })());
  c("percorso con Esc: digito → giù → Esc → Esc: la prima chiude, la seconda lascia passare", [true, false], (() => {
    let r = tasto(V.tendinaDopoDigitazione(5), "ArrowDown", 5);
    r = tasto({ aperta: r.aperta, indice: r.indice }, "Escape", 5);
    const prima = r.gestito;
    r = tasto({ aperta: r.aperta, indice: r.indice }, "Escape", 5);
    return [prima, r.gestito];
  })());

  // ── il file: puro davvero, e senza frasi ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/vetrina-interazioni.ts"), "utf8");
  const senzaCommenti = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("nessun import: né React, né rete, né i testi (i riduttori non portano frasi)", [], senzaCommenti.match(/^\s*import\s.*$/gm) ?? []);
  c("niente tempo reale, timer, rete, schermo, caso: il tempo entra come parametro", [], ["Date", "setTimeout", "setInterval", "requestAnimationFrame", "performance", "fetch", "window", "document", "navigator", "localStorage", "Math.random", "console"].filter((k) => new RegExp(`(?<![\\w.])${k.replace(".", "\\.")}(?![\\w])`).test(senzaCommenti)));
  c("nessuna frase nel codice: nessuna stringa con spazi dentro", [], (senzaCommenti.match(/"[^"\n]*"/g) ?? []).filter((x) => /\s/.test(x.slice(1, -1))));
  const testi = readFileSync(join(radice, "src/landing/testi-shop.ts"), "utf8");
  c("le parole del bottone restano in testi-shop.ts (aggiungi → «Aggiungi al carrello», aggiunto → «Aggiunto»)", [true, true], [/aggiungi:\s*"Aggiungi al carrello"/.test(testi), /aggiunto:\s*"Aggiunto"/.test(testi)]);
}
