/** ── NEGOZIO · T45 · LA SPEDIZIONE (PURA) ──────────────────────────────────
 *  `src/shop/cassa/spedizione.ts`: `tariffaAttiva`, `costoSpedizione`, `tempiStimati`, `corriereLink`,
 *  `leggiSpedizione` (D62: il pubblico non vede corriere, tempi e frase se la tariffa non è confermata).
 *  Dati inventati. Nessun accesso al database. */

export async function prove(mod, { c, gruppo }) {
  gruppo("NEGOZIO · LA SPEDIZIONE (21/11/2026, T45)");
  const S = mod["shop/cassa/spedizione"];
  if (!S) return c("il modulo src/shop/cassa/spedizione.ts esiste", true, false);

  const t = (extra = {}) => ({ id: "t1", paese: "IT", nome: "Tracciata", corriere: "BRT", costo_cent: 490, gratis_da_cent: null, giorni_min: null, giorni_max: null, attiva: true, provvisoria: false, confermata_il: "2026-11-22T10:00:00Z", ...extra });
  const ADESSO = Date.parse("2026-11-23T10:00:00Z");

  // ── tariffaAttiva ──
  c("nessuna tariffa (elenco vuoto, null, non un elenco) → null", [null, null, null, null], [[], null, undefined, "IT"].map((x) => S.tariffaAttiva(x, "IT")));
  c("una tariffa attiva per l'Italia → quella", "t1", S.tariffaAttiva([t()], "IT")?.id);
  c("tariffa non attiva → null", null, S.tariffaAttiva([t({ attiva: false })], "IT"));
  c("tariffa di un altro paese → null", null, S.tariffaAttiva([t({ paese: "FR" })], "IT"));
  c("paese scritto «it » → riconosciuto", "t1", S.tariffaAttiva([t()], " it ")?.id);
  c("due tariffe attive per l'Italia → la prima per ordine, mai due", "a", S.tariffaAttiva([t({ id: "a" }), t({ id: "b" })], "IT")?.id);
  c("la prima è spenta → la seconda attiva", "b", S.tariffaAttiva([t({ id: "a", attiva: false }), t({ id: "b" })], "IT")?.id);
  c("elementi storti nell'elenco (null, testo, numero) non fanno scoppiare nulla", "b", S.tariffaAttiva([null, "x", 3, t({ id: "b" })], "IT")?.id);
  c("`attiva` testo «true» non vale (serve il booleano)", null, S.tariffaAttiva([t({ attiva: "true" })], "IT"));

  // ── costoSpedizione ──
  c("senza tariffa → null (la cassa non si apre)", [null, null], [S.costoSpedizione(null, 5000), S.costoSpedizione(undefined, 5000)]);
  c("tariffa 490, nessuna soglia → 490", 490, S.costoSpedizione(t(), 5000));
  c("soglia vuota (null, undefined, «», 0) → mai gratis, nemmeno con un carrello enorme", [490, 490, 490, 490], [null, undefined, "", 0].map((g) => S.costoSpedizione(t({ gratis_da_cent: g }), 9_000_000)));
  c("soglia 5900 e subtotale 5900 → gratis (la funzione c'è, la schermata non la usa)", 0, S.costoSpedizione(t({ gratis_da_cent: 5900 }), 5900));
  c("soglia 5900 e subtotale 5899 → 490", 490, S.costoSpedizione(t({ gratis_da_cent: 5900 }), 5899));
  c("soglia 5900 e subtotale 12000 → gratis", 0, S.costoSpedizione(t({ gratis_da_cent: 5900 }), 12000));
  c("subtotale storto (NaN, testo, negativo, decimale) → mai gratis per sbaglio", [490, 490, 490, 490], [NaN, "6000", -1, 5900.5].map((s) => S.costoSpedizione(t({ gratis_da_cent: 5900 }), s)));
  c("costo 0 (spedizione offerta dal titolare) → 0", 0, S.costoSpedizione(t({ costo_cent: 0 }), 100));
  c("costo storto (negativo, decimale, testo, null) → null (meglio non aprire che far pagare a caso)", [null, null, null, null], [-1, 4.9, "490", null].map((x) => S.costoSpedizione(t({ costo_cent: x }), 100)));

  // ── tempiStimati ──
  c("2-4 giorni → la frase", "Consegna in 2-4 giorni lavorativi dopo la preparazione", S.tempiStimati(t({ giorni_min: 2, giorni_max: 4 })));
  c("un solo limite (solo min, solo max) → nessuna frase", [null, null], [S.tempiStimati(t({ giorni_min: 2 })), S.tempiStimati(t({ giorni_max: 4 }))]);
  c("nessun limite, o niente tariffa → nessuna frase", [null, null], [S.tempiStimati(t()), S.tempiStimati(null)]);
  c("min maggiore di max → nessuna frase", null, S.tempiStimati(t({ giorni_min: 5, giorni_max: 2 })));
  c("limiti storti (testo, decimali, negativi, oltre 60) → nessuna frase", Array(4).fill(null), [["2", "4"], [1.5, 3], [-1, 3], [1, 61]].map(([a, b]) => S.tempiStimati(t({ giorni_min: a, giorni_max: b }))));
  c("min uguale a max → «Consegna in 3 giorni…», con 1 al singolare", ["Consegna in 3 giorni lavorativi dopo la preparazione", "Consegna in 1 giorno lavorativo dopo la preparazione"], [S.tempiStimati(t({ giorni_min: 3, giorni_max: 3 })), S.tempiStimati(t({ giorni_min: 1, giorni_max: 1 }))]);

  // ── corriereLink ──
  const CORRIERI = [{ nome: "BRT", modello: "https://esempio.test/seguimi?codice={numero}" }, { nome: "Vuoto", modello: "" }, { nome: "Storto", modello: "javascript:alert({numero})" }, { nome: "Http", modello: "http://esempio.test/{numero}" }, { nome: "SenzaSegnaposto", modello: "https://esempio.test/fisso" }, { nome: "Nullo", modello: null }];
  c("modello giusto → l'indirizzo con il numero", "https://esempio.test/seguimi?codice=ABC123", S.corriereLink(CORRIERI, "BRT", "ABC123"));
  c("nome del corriere con maiuscole e spazi diversi → trovato", "https://esempio.test/seguimi?codice=1", S.corriereLink(CORRIERI, "  brt ", "1"));
  c("modello vuoto o nullo → null", [null, null], [S.corriereLink(CORRIERI, "Vuoto", "1"), S.corriereLink(CORRIERI, "Nullo", "1")]);
  c("modello con javascript:, con http:// o senza {numero} → null", [null, null, null], ["Storto", "Http", "SenzaSegnaposto"].map((n) => S.corriereLink(CORRIERI, n, "1")));
  c("corriere sconosciuto, elenco storto → null", [null, null, null], [S.corriereLink(CORRIERI, "Nessuno", "1"), S.corriereLink(null, "BRT", "1"), S.corriereLink("BRT", "BRT", "1")]);
  c("numero con spazi e & → codificato, non spezza l'indirizzo", "https://esempio.test/seguimi?codice=AB%20C%26x%3D1%23z", S.corriereLink(CORRIERI, "BRT", "AB C&x=1#z"));
  c("numero con / e ? → codificati", "https://esempio.test/seguimi?codice=a%2Fb%3Fc", S.corriereLink(CORRIERI, "BRT", "a/b?c"));
  c("il numero non può portare «$&» o un altro {numero} dentro il modello", "https://esempio.test/seguimi?codice=%24%26%7Bnumero%7D", S.corriereLink(CORRIERI, "BRT", "$&{numero}"));
  c("numero vuoto, di spazi, non testo o oltre 120 caratteri → null", [null, null, null, null], ["", "   ", 123, "x".repeat(121)].map((n) => S.corriereLink(CORRIERI, "BRT", n)));
  c("il segnaposto non può stare nel nome dell'host (si dirotterebbe il link)", [null, null], ["https://{numero}.esempio.test/", "https://esempio.test@{numero}/"].map((m) => S.corriereLink([{ nome: "X", modello: m }], "X", "evil")));
  c("modello con spazi o a capo → null", [null, null], ["https://esempio.test/ {numero}", "https://esempio.test/\n{numero}"].map((m) => S.corriereLink([{ nome: "X", modello: m }], "X", "1")));
  c("il risultato è sempre un https:// valido, mai altro", [], ["1", "a b", "ö", "../x", "\u0000"].map((n) => S.corriereLink(CORRIERI, "BRT", n)).filter((u) => u !== null && !/^https:\/\/esempio\.test\/seguimi\?codice=[A-Za-z0-9%._~!*'()-]+$/.test(u)));

  // ── leggiSpedizione (D62) ──
  const PROIBITE = ["provvisoria", "confermata_il", "id", "nome", "gratis_da_cent", "attiva", "paese", "creato_il", "aggiornato_il"];
  const piena = S.leggiSpedizione(t({ giorni_min: 2, giorni_max: 4 }), ADESSO);
  c("nessuna tariffa (null, undefined, non un oggetto) → {stato:\"assente\"}", Array(4).fill({ stato: "assente" }), [null, undefined, "x", 7].map((r) => S.leggiSpedizione(r, ADESSO)));
  c("tariffa confermata con tempi 2-4 → tutto, con la frase", { stato: "ok", costoCent: 490, confermata: true, corriere: "BRT", tempi: { min: 2, max: 4 }, frase: "Consegna in 2-4 giorni lavorativi dopo la preparazione" }, piena);
  c("la risposta ha solo queste sei chiavi: nessuna trapela", ["confermata", "corriere", "costoCent", "frase", "stato", "tempi"], Object.keys(piena).sort());
  const prov = S.leggiSpedizione(t({ provvisoria: true, confermata_il: null, giorni_min: 2, giorni_max: 4 }), ADESSO);
  c("tariffa NON confermata (provvisoria): corriere, tempi e frase sono null, il costo c'è", { stato: "ok", costoCent: 490, confermata: false, corriere: null, tempi: null, frase: null }, prov);
  c("confermata_il vuoto = non confermata, anche con provvisoria false", [false, null, null, null], ((r) => [r.confermata, r.corriere, r.tempi, r.frase])(S.leggiSpedizione(t({ confermata_il: null, giorni_min: 2, giorni_max: 4 }), ADESSO)));
  c("provvisoria true con confermata_il scritta (dato incoerente) → non confermata", false, S.leggiSpedizione(t({ provvisoria: true }), ADESSO).confermata);
  c("confermata_il nel futuro o illeggibile → non confermata", [false, false, false], [t({ confermata_il: "2027-01-01T00:00:00Z" }), t({ confermata_il: "ieri" }), t({ confermata_il: 12345 })].map((r) => S.leggiSpedizione(r, ADESSO).confermata));
  const unlimite = S.leggiSpedizione(t({ giorni_min: 2 }), ADESSO);
  c("confermata con un solo limite dei tempi → tempi null e nessuna frase", [true, null, null], [unlimite.confermata, unlimite.tempi, unlimite.frase]);
  c("confermata ma senza corriere scritto (vuoto, spazi, null) → corriere null", [null, null, null], ["", "   ", null].map((x) => S.leggiSpedizione(t({ corriere: x }), ADESSO).corriere));
  c("tariffa spenta → assente", { stato: "assente" }, S.leggiSpedizione(t({ attiva: false }), ADESSO));
  c("costo storto → assente (non si inventa un prezzo)", Array(3).fill({ stato: "assente" }), [-5, 1.5, null].map((x) => S.leggiSpedizione(t({ costo_cent: x }), ADESSO)));
  c("costo 0 con tariffa confermata → ok con costoCent 0", 0, S.leggiSpedizione(t({ costo_cent: 0 }), ADESSO).costoCent);
  c("senza il secondo argomento usa l'ora vera: confermata ieri → confermata", true, S.leggiSpedizione(t({ confermata_il: new Date(Date.now() - 86_400_000).toISOString() })).confermata);
  c("accetta anche l'ora come Date", true, S.leggiSpedizione(t(), new Date(ADESSO)).confermata);
  c("nel testo della risposta non compaiono i campi interni (JSON)", [], PROIBITE.filter((k) => JSON.stringify([piena, prov]).includes(`"${k}"`)));
  c("la riga che entra non viene modificata", true, (() => { const r = t({ giorni_min: 2, giorni_max: 4 }); const prima = JSON.stringify(r); S.leggiSpedizione(r, ADESSO); S.costoSpedizione(r, 100); S.tempiStimati(r); return JSON.stringify(r) === prima; })());
}
