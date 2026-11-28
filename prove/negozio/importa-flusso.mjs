/** ── EDITOR PRODOTTI · E10 · IL FLUSSO DELL'IMPORT (macchina a stati pura) ─────
 *  `src/crm/ecommerce/prodotti/importa/importa-flusso.ts`: gruppi (mai oltre 5 prodotti e 160 000 byte), anteprima dal file, avanzamento, ripresa
 *  dopo un errore, riepilogo e righe da correggere. Il server è uno STUB scritto qui secondo `import-contratto.ts` (il vero è E3): registra ogni
 *  richiesta e ogni scrittura. Dati inventati, nessuna rete. */
import { build } from "esbuild";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const byteDi = (azione, dati) => new TextEncoder().encode(JSON.stringify({ azione, ...dati })).length;

/** Un file come lo dà il browser; `lette` conta le volte che se ne leggono i byte (un file respinto non si deve leggere). */
const fileDa = (name, contenuto, size) => {
  const byte = typeof contenuto === "string" ? new TextEncoder().encode(contenuto) : contenuto;
  const f = { name, size: size ?? byte.length, lette: 0, arrayBuffer: async () => { f.lette++; return byte.buffer.slice(byte.byteOffset, byte.byteOffset + byte.length); } };
  return f;
};

/** Il server finto: rispetta `import-contratto.ts`. `db` = i prodotti scritti (sempre in bozza); `log` = ogni richiesta con la sua misura. */
function serverFinto({ presenti = [], skuUsati = [], categorie = [], importaDisponibile = true, rifiuta = {}, guasti = {} } = {}) {
  const db = new Map(presenti.map((p) => [p.slug, { ...p, stato: p.stato ?? "bozza" }]));
  const log = [];
  let chiamateImporta = 0;
  const esegui = async (azione, dati = {}) => {
    log.push({ azione, dati, byte: byteDi(azione, dati) });
    if (azione === "prodotti_importa_verifica") {
      if (guasti.verifica) return { ok: false, errore: { tipo: "rete", messaggio: "Non riesco a collegarmi al server." } };
      return { ok: true, dati: {
        presenti: [...db.values()].filter((p) => dati.slugs.includes(p.slug)).map((p) => ({ id: p.id ?? `id-${p.slug}`, slug: p.slug, nome: p.nome ?? p.slug, stato: p.stato })),
        skuUsati: skuUsati.filter((s) => dati.skus.includes(s.sku)),
        categorie, costoDisponibile: true, importaDisponibile,
      } };
    }
    if (azione !== "prodotti_importa") return { ok: false, errore: { tipo: "valore", messaggio: "azione sconosciuta" } };
    chiamateImporta++;
    const g = guasti[chiamateImporta];
    if (g && !g.dopoScrittura) return { ok: false, errore: { tipo: g.tipo, messaggio: g.messaggio ?? "Non riesco a collegarmi al server." } };
    const risultati = dati.prodotti.map((p) => {
      if (rifiuta[p.handle]) return { handle: p.handle, esito: "errore", errori: [{ riga: p.varianti[0].riga, handle: p.handle, frase: rifiuta[p.handle] }] };
      if (db.has(p.handle)) return { handle: p.handle, esito: "gia_presente", prodottoId: db.get(p.handle).id ?? `id-${p.handle}` };
      db.set(p.handle, { slug: p.handle, nome: p.titolo, stato: "bozza", id: `id-${p.handle}` });
      return { handle: p.handle, esito: "creato", prodottoId: `id-${p.handle}` };
    });
    if (g?.dopoScrittura) return { ok: false, errore: { tipo: g.tipo, messaggio: g.messaggio ?? "Non so se la modifica sia stata salvata." } };
    return { ok: true, dati: { risultati: guasti.risposta ? guasti.risposta(risultati) : risultati } };
  };
  return { esegui, db, log, richiesteImporta: () => log.filter((x) => x.azione === "prodotti_importa") };
}

const variante = (n, o = {}) => ({ riga: n + 1, sku: `P-${n}`, nome: "Unica", opzioni: {}, prezzoCent: null, pesoG: null, gtin: null, costoCent: null, giacenza: 3, ...o });
const prod = (n, o = {}) => ({ handle: `prodotto-${n}`, titolo: `Prodotto ${n}`, tipo: "cura", categorie: [], sku: `P-${n}`, prezzoCent: 1990, varianti: [variante(n)], ...o });
/** Un prodotto grosso di proposito: 50 varianti con nomi da 400 «€» (3 byte l'uno): molti byte, pochi caratteri. */
const grosso = (n, lung = 400) => prod(n, { varianti: Array.from({ length: 50 }, (_, i) => variante(n * 100 + i, { sku: `G${n}-${i}`, nome: "€".repeat(lung) })) });
const serie = (n, da = 1) => Array.from({ length: n }, (_, i) => prod(da + i));

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E10 · IMPORT: GRUPPI, ANTEPRIMA, AVANZAMENTO, RIPRESA, RIEPILOGO (25/11/2026)");
  const F = await carica(radice, "src/crm/ecommerce/prodotti/importa/importa-flusso.ts").catch((e) => ({ errore: String(e) }));
  c("importa-flusso.ts si compila e si carica", undefined, F.errore);
  if (F.errore) return;
  const Mo = await carica(radice, "src/crm/negozio/csv-modello.ts");
  const Er = await carica(radice, "src/crm/negozio/csv-errori.ts");
  const Lt = await carica(radice, "src/crm/negozio/csv-lettore.ts");
  const dim = (gruppi) => gruppi.map((g) => g.length);

  // ════ I GRUPPI: mai oltre 5 prodotti e 160 000 byte ════
  c("12 prodotti → gruppi da 5, 5 e 2, nello stesso ordine, nessuno perso o doppio", [[5, 5, 2], serie(12).map((p) => p.handle)], [dim(F.dividiInGruppi(serie(12)).gruppi), F.dividiInGruppi(serie(12)).gruppi.flat().map((p) => p.handle)]);
  c("6 prodotti → 5 e 1 (mai 6 insieme); 5 → un gruppo; 0 → nessuno", [[5, 1], [5], []], [dim(F.dividiInGruppi(serie(6)).gruppi), dim(F.dividiInGruppi(serie(5)).gruppi), dim(F.dividiInGruppi([]).gruppi)]);
  const sette = Array.from({ length: 7 }, (_, i) => grosso(i + 1));
  const tre = JSON.stringify({ azione: "prodotti_importa", prodotti: sette.slice(0, 3) });
  const g7 = F.dividiInGruppi(sette);
  c("la misura è in BYTE: tre prodotti grossi sono sotto 160 000 caratteri ma sopra 160 000 byte", [true, true], [tre.length < 160_000, new TextEncoder().encode(tre).length > 160_000]);
  c("sette prodotti grossi → gruppi da 2, 2, 2 e 1; ogni richiesta vera sta sotto gli 160 000 byte", [[2, 2, 2, 1], true, true], [dim(g7.gruppi), g7.gruppi.every((g) => byteDi("prodotti_importa", { prodotti: g }) <= 160_000), F.misuraRichiesta(g7.gruppi[0]) === byteDi("prodotti_importa", { prodotti: g7.gruppi[0] })]);
  const enorme = prod(9, { varianti: Array.from({ length: 50 }, (_, i) => variante(900 + i, { sku: `E-${i}`, nome: "€".repeat(1200) })) });
  const g8 = F.dividiInGruppi([prod(1), enorme, prod(2)]);
  c("un prodotto da solo oltre 160 000 byte non parte: lo si dice a parte, gli altri vanno", [[2], ["prodotto-9"]], [dim(g8.gruppi), g8.troppoGrandi.map((p) => p.handle)]);

  // ════ L'AVANZAMENTO E IL GIRO COMPLETO ════
  let s = F.avviaImporta(serie(12));
  c("all'inizio: 3 gruppi da fare, 0 su 12, niente fermo", [3, 0, 12, 0, null, 0], [s.gruppi.length, F.avanzamento(s).prodottiFatti, F.avanzamento(s).prodottiTotali, F.avanzamento(s).percento, s.fermo, F.prossimoGruppo(s)]);
  const srv = serverFinto();
  const aggiornamenti = [];
  s = await F.eseguiGruppi(s, (prodotti) => srv.esegui("prodotti_importa", { prodotti }), { aggiorna: (x) => aggiornamenti.push(F.avanzamento(x).percento) });
  c("giro completo: 3 richieste (5, 5, 2 prodotti), tutte sotto 5 prodotti e 200 000 byte", [[5, 5, 2], true], [srv.richiesteImporta().map((r) => r.dati.prodotti.length), srv.richiesteImporta().every((r) => r.dati.prodotti.length <= 5 && r.byte <= 160_000)]);
  c("la barra sale a ogni gruppo e arriva a 100 solo alla fine (41, 83, 100)", [41, 83, 100], aggiornamenti);
  c("nel server ci sono 12 prodotti, tutti in bozza, nessuno doppio", [12, ["bozza"]], [srv.db.size, [...new Set([...srv.db.values()].map((p) => p.stato))]]);
  c("nessuna richiesta porta un campo «stato»: l'import non lo scrive mai", false, srv.log.some((r) => JSON.stringify(r.dati).includes('"stato"')));
  c("finito: nessun gruppo da fare, nessun fermo", [null, null], [F.prossimoGruppo(s), s.fermo]);

  // ════ LA RIPRESA: dopo un errore di rete a metà non si rimanda ciò che è già entrato ════
  const rete = serverFinto({ guasti: { 2: { tipo: "rete" } } }); // la seconda richiesta non arriva al server
  let r1 = await F.eseguiGruppi(F.avviaImporta(serie(12)), (prodotti) => rete.esegui("prodotti_importa", { prodotti }), {});
  c("errore di rete al secondo gruppo: ci si ferma lì, con la frase del server", [1, "rete", "Non riesco a collegarmi al server.", 2, 1], [r1.gruppi.filter((g) => g.stato === "fatto").length, r1.fermo?.tipo, r1.fermo?.messaggio, rete.richiesteImporta().length, F.prossimoGruppo(r1)]);
  c("…e il secondo gruppo risulta «interrotto», il terzo da fare, il primo fatto", ["fatto", "interrotto", "da_fare"], r1.gruppi.map((g) => g.stato));
  c("senza «Riprendi» non riparte niente da solo", 2, rete.richiesteImporta().length);
  r1 = F.riprendi(r1);
  c("«Riprendi» toglie il fermo e rimette in coda solo il gruppo interrotto", [null, ["fatto", "da_fare", "da_fare"], 1], [r1.fermo, r1.gruppi.map((g) => g.stato), F.prossimoGruppo(r1)]);
  r1 = await F.eseguiGruppi(r1, (prodotti) => rete.esegui("prodotti_importa", { prodotti }), {});
  const mandati = rete.richiesteImporta().flatMap((r) => r.dati.prodotti.map((p) => p.handle));
  c("dopo la ripresa: il primo gruppo è partito UNA volta sola (mai rimandato)", [1, 1, 1, 1, 1], ["prodotto-1", "prodotto-2", "prodotto-3", "prodotto-4", "prodotto-5"].map((h) => mandati.filter((x) => x === h).length));
  c("…e il server ha tutti i 12 prodotti, senza doppioni", [12, 12, null], [rete.db.size, F.riepilogoFinale({ nuovi: serie(12), giaPresenti: [], errori: [], nProdottiConErrori: 0 }, r1).importati, r1.fermo]);

  // errore dopo la scrittura (la risposta si perde): il gruppo si rimanda, il server dice «già presente», nessun doppione
  const perso = serverFinto({ guasti: { 2: { tipo: "rete", dopoScrittura: true } } });
  let r2 = await F.eseguiGruppi(F.avviaImporta(serie(12)), (prodotti) => perso.esegui("prodotti_importa", { prodotti }), {});
  c("risposta persa dopo la scrittura: si ferma, e dice che non sa se è entrato", [true, true], [r2.fermo?.incerto, /Non so se/.test(r2.fermo?.messaggio ?? "")]);
  r2 = await F.eseguiGruppi(F.riprendi(r2), (prodotti) => perso.esegui("prodotti_importa", { prodotti }), {});
  const rie2 = F.riepilogoFinale({ nuovi: serie(12), giaPresenti: [], errori: [], nProdottiConErrori: 0 }, r2);
  c("rimandato il gruppo già scritto: 12 prodotti nel server, nessun doppione; 5 risultano «già presenti» e il totale torna", [12, 7, 5, 12], [perso.db.size, rie2.importati, rie2.saltati, rie2.importati + rie2.saltati]);

  // errori che non si riprovano da soli
  const negato = serverFinto({ guasti: { 1: { tipo: "permesso", messaggio: "Il tuo utente non può gestire il negozio: chiedi a un amministratore." } } });
  const r3 = await F.eseguiGruppi(F.avviaImporta(serie(12)), (prodotti) => negato.esegui("prodotti_importa", { prodotti }), {});
  c("permesso negato: UNA richiesta sola, ci si ferma con la frase; nessun tentativo da soli", [1, "permesso", false], [negato.richiesteImporta().length, r3.fermo?.tipo, r3.fermo?.incerto]);
  const r4 = await F.eseguiGruppi(F.avviaImporta(serie(12)), async () => ({ ok: true, dati: { risultati: "non so" } }), {});
  c("una risposta che non è nella forma del contratto NON è un successo: ci si ferma", [true, 0], [r4.fermo !== null, r4.gruppi.filter((g) => g.stato === "fatto").length]);
  const r5 = await F.eseguiGruppi(F.avviaImporta(serie(5)), async () => ({ ok: true, dati: { risultati: [{ handle: "prodotto-1", esito: "creato" }, { handle: "x", esito: "creato" }] } }), {});
  const rie5 = F.riepilogoFinale({ nuovi: serie(5), giaPresenti: [], errori: [], nProdottiConErrori: 0 }, r5);
  c("un prodotto senza risposta del server è respinto (non importato per sbaglio); uno sconosciuto si ignora", [1, 0, 4], [rie5.importati, rie5.saltati, rie5.respinti]);

  // note del revisore: esito sconosciuto e errori che non passano riprovando
  const boh = serverFinto({ guasti: { risposta: (ris) => ris.map((x, k) => (k === 0 ? { handle: x.handle, esito: "boh" } : x)) } });
  const aBoh = (await F.analizzaFile(fileDa("modello-prodotti.csv", Mo.costruisciModello()), boh.esegui)).analisi;
  const stBoh = await F.eseguiGruppi(F.avviaImporta(aBoh.nuovi), (prodotti) => boh.esegui("prodotti_importa", { prodotti }), {});
  const rieBoh = F.riepilogoFinale(aBoh, stBoh);
  const csvBoh = Lt.leggiCsv(new TextEncoder().encode(F.csvDaCorreggere(aBoh, rieBoh)));
  c("un esito sconosciuto («boh») è «senza risposta»: respinto, con la frase, e la sua riga è nel CSV da correggere", [1, 1, true, ["shampoo-delicato-esempio"]], [rieBoh.importati, rieBoh.respinti, rieBoh.errori.some((e) => /non ha risposto/.test(e.frase) && e.handle === "shampoo-delicato-esempio"), csvBoh.record.slice(1).map((x) => x[0])]);
  const nonValido = serverFinto({ guasti: { 1: { tipo: "valore", messaggio: "La richiesta è troppo grande per il server." } } });
  const stNv = await F.eseguiGruppi(F.avviaImporta(serie(12)), (prodotti) => nonValido.esegui("prodotti_importa", { prodotti }), {});
  const rieNv = F.riepilogoFinale({ nuovi: serie(12), giaPresenti: [], errori: [], nProdottiConErrori: 0 }, stNv);
  c("errore non transitorio (413/400): il gruppo non si riprova, i suoi 5 prodotti sono respinti con la frase del server e si va avanti", [3, null, 7, 5, true], [nonValido.richiesteImporta().length, stNv.fermo, rieNv.importati, rieNv.respinti, rieNv.errori.every((e) => /troppo grande per il server/.test(e.frase))]);
  c("…e nessun prodotto del gruppo rifiutato è nel server; gli altri 7 sì", [7, false], [nonValido.db.size, nonValido.db.has("prodotto-1")]);

  // «Interrompi»: si ferma dopo il gruppo in corso, «Riprendi» finisce
  const srv6 = serverFinto();
  let vuole = false;
  let r6 = await F.eseguiGruppi(F.avviaImporta(serie(12)), (prodotti) => { vuole = true; return srv6.esegui("prodotti_importa", { prodotti }); }, { interrompi: () => vuole });
  c("«Interrompi»: finisce il gruppo in corso, poi si ferma (1 gruppo, 5 prodotti), senza errore", [1, 5, "interrotto"], [srv6.richiesteImporta().length, F.avanzamento(r6).prodottiFatti, r6.fermo?.tipo]);
  vuole = false;
  r6 = await F.eseguiGruppi(F.riprendi(r6), (prodotti) => srv6.esegui("prodotti_importa", { prodotti }), {});
  c("…e «Riprendi» fa gli altri due, senza rimandare il primo", [3, 12, null], [srv6.richiesteImporta().length, srv6.db.size, r6.fermo]);

  // ════ L'ANTEPRIMA DAL FILE (criteri 5, 6, 7) ════
  const modello = Mo.costruisciModello();
  const s1 = serverFinto();
  const a1 = await F.analizzaFile(fileDa("modello-prodotti.csv", modello), s1.esegui);
  c("il file modello: «2 prodotti · 5 varianti · 2 nuovi · 0 errori»", [true, "2 prodotti · 5 varianti · 2 nuovi · 0 errori"], [a1.ok, a1.ok && F.fraseRiepilogo(a1.analisi)]);
  c("prima di «Importa» il server non riceve NESSUNA scrittura: solo la verifica, e il database è vuoto", [["prodotti_importa_verifica"], 0], [s1.log.map((x) => x.azione), s1.db.size]);
  c("la verifica manda solo indirizzi e SKU (non il file, non i testi)", [["slugs", "skus"], 2, 5], [Object.keys(s1.log[0].dati), s1.log[0].dati.slugs.length, s1.log[0].dati.skus.length]);
  c("la tabella ha 2 righe «nuovo» col titolo, il tipo e il prezzo in centesimi (il primo prezzo)", [["nuovo", "nuovo"], ["Shampoo delicato (esempio)", "Parrucca di esempio"], 1490], [a1.analisi.righe.map((r) => r.esito), a1.analisi.righe.map((r) => r.titolo), a1.analisi.righe[0].prezzoCent]);
  c("giacenza totale e numero di varianti per riga", [[10, 6], [1, 4]], [a1.analisi.righe.map((r) => r.giacenza), a1.analisi.righe.map((r) => r.varianti)]);
  c("importaDisponibile resta vero e i nuovi sono 2", [true, 2], [a1.analisi.importaDisponibile, a1.analisi.nuovi.length]);

  // percorso felice fino in fondo, poi lo stesso file due volte
  let st = F.avviaImporta(a1.analisi.nuovi);
  st = await F.eseguiGruppi(st, (prodotti) => s1.esegui("prodotti_importa", { prodotti }), {});
  const fin1 = F.riepilogoFinale(a1.analisi, st);
  c("importato: «Importati 2 prodotti (tutti in bozza). Saltati 0 già presenti. Respinti 0 con errori.»", [2, 0, 0, "Importati 2 prodotti (tutti in bozza). Saltati 0 già presenti. Respinti 0 con errori."], [fin1.importati, fin1.saltati, fin1.respinti, F.fraseFinale(fin1)]);
  c("nel server: 2 prodotti, in bozza", [2, ["bozza"]], [s1.db.size, [...new Set([...s1.db.values()].map((p) => p.stato))]]);
  const a2 = await F.analizzaFile(fileDa("modello-prodotti.csv", modello), s1.esegui);
  c("lo stesso file una seconda volta: «2 già presenti (saltati)», nessun nuovo, nessun errore", [true, "2 prodotti · 5 varianti · nessun nuovo · 2 già presenti (saltati) · 0 errori", 0, 2], [a2.ok, a2.ok && F.fraseRiepilogo(a2.analisi), a2.analisi.nuovi.length, a2.analisi.giaPresenti.length]);
  c("…con l'esito «presente» e l'id per aprire il prodotto", [["presente", "presente"], ["id-shampoo-delicato-esempio", "id-parrucca-esempio"]], [a2.analisi.righe.map((r) => r.esito), a2.analisi.righe.map((r) => r.prodottoId)]);
  const rie2b = F.riepilogoFinale(a2.analisi, F.avviaImporta(a2.analisi.nuovi));
  c("e non parte nessuna richiesta di import: 2 saltati, 0 importati", [2, 0, 0, 0], [rie2b.saltati, rie2b.importati, s1.richiesteImporta().length - 1, F.avviaImporta(a2.analisi.nuovi).gruppi.length]);

  // il file con tutti i difetti del criterio 6
  const INT = ["Handle", "Title", "Body (HTML)", "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value", "Option4 Name", "Variant SKU", "Variant Price", "Variant Inventory Qty", "Categories"];
  const r = (o) => INT.map((h) => o[h] ?? "");
  const cattivo = Er.scriviCsv([INT,
    r({ Handle: "ok-uno", Title: "Siero uno", "Variant SKU": "OK-1", "Variant Price": "19,90", "Variant Inventory Qty": "4", Categories: "Cura capelli" }),
    r({ Handle: "prezzo-brutto", Title: "Prezzo brutto", "Variant SKU": "PB-1", "Variant Price": "abc" }),
    r({ Handle: "doppio-a", Title: "Doppio A", "Variant SKU": "DUP-1", "Variant Price": "5" }),
    r({ Handle: "doppio-b", Title: "Doppio B", "Variant SKU": "DUP-1", "Variant Price": "5" }),
    r({ Handle: "sku-altrui", Title: "Sku altrui", "Variant SKU": "HG-T01", "Variant Price": "5" }),
    r({ Handle: "quattro-opzioni", Title: "Quattro opzioni", "Option1 Name": "A", "Option1 Value": "1", "Option2 Name": "B", "Option2 Value": "1", "Option3 Name": "C", "Option3 Value": "1", "Option4 Name": "D", "Variant SKU": "QO-1", "Variant Price": "5" }),
    r({ Handle: "sconto", Title: "Parrucca sconto del 20%", "Variant SKU": "SC-1", "Variant Price": "5" }),
    r({ Handle: "senza-titolo", "Variant SKU": "ST-1", "Variant Price": "5" }),
    r({ Handle: "Con Maiuscole", Title: "Con maiuscole", "Variant SKU": "CM-1", "Variant Price": "5" }),
    r({ Handle: "troppo-lungo", Title: "Troppo lungo", "Body (HTML)": "x".repeat(6001), "Variant SKU": "TL-1", "Variant Price": "5" }),
    r({ Handle: "gia-qui", Title: "Già qui", "Variant SKU": "GQ-1", "Variant Price": "5" }),
  ], ",", false);
  const s7 = serverFinto({ presenti: [{ slug: "gia-qui", nome: "Già qui", id: "id-gia-qui" }], skuUsati: [{ sku: "HG-T01", prodottoId: "id-lace", prodottoNome: "Lace Front Swiss + PU", comeVariante: false }], categorie: [{ id: "c1", slug: "cura-capelli", nome: "Cura capelli" }] });
  const a7 = await F.analizzaFile(fileDa("difetti.csv", cattivo), s7.esegui);
  const A7 = a7.analisi;
  c("file con i difetti: nuovi = quelli senza errori (ok-uno, doppio-a, con-maiuscole), già presente = gia-qui", [true, ["ok-uno", "doppio-a", "con-maiuscole"], ["gia-qui"]], [a7.ok, A7.nuovi.map((p) => p.handle), A7.giaPresenti.map((p) => p.handle)]);
  c("la categoria esiste (la porta la verifica): il prodotto la ha, senza avviso «non esiste»", [["cura-capelli"], false], [A7.nuovi[0].categorie, A7.avvisi.some((x) => /non esiste/.test(x.frase))]);
  const righeErr = [...new Set(A7.errori.map((e) => e.riga))].sort((x, y) => x - y);
  c("errori su ogni riga sbagliata, col numero di riga di Excel (3, 5, 6, 7, 8, 9, 11); 7 prodotti con errori", [[3, 5, 6, 7, 8, 9, 11], 7], [righeErr, A7.nProdottiConErrori]);
  c("SKU di un altro prodotto: la frase dice quale prodotto lo usa", true, A7.errori.some((e) => e.riga === 6 && /Lace Front Swiss \+ PU/.test(e.frase)));
  c("SKU scritto due volte nel file: lo dice con le due righe", true, A7.errori.some((e) => e.riga === 5 && /righe 4 e 5/.test(e.frase)));
  c("riepilogo: «11 prodotti · 11 varianti · 3 nuovi · 1 già presente (saltato) · 7 con errori · N avvisi»", true, /^11 prodotti · 11 varianti · 3 nuovi · 1 già presente \(saltato\) · 7 con errori · \d+ avvisi?$/.test(F.fraseRiepilogo(A7)));
  c("la tabella: 11 righe (3 nuovo, 1 presente, 7 errore) e il filtro «solo errori» ne tiene 7", [11, 3, 1, 7, 7], [A7.righe.length, A7.righe.filter((x) => x.esito === "nuovo").length, A7.righe.filter((x) => x.esito === "presente").length, A7.righe.filter((x) => x.esito === "errore").length, F.soloErrori(A7.righe).length]);
  c("la verifica non ha scritto niente", [0, 0], [s7.richiesteImporta().length, [...s7.db.keys()].filter((k) => k !== "gia-qui").length]);
  // importa i 3 buoni: uno viene respinto dal server (una corsa fra due persone)
  const s7b = serverFinto({ presenti: [{ slug: "gia-qui", id: "id-gia-qui" }], rifiuta: { "con-maiuscole": "Lo SKU CM-1 è già usato dal prodotto «Altro»." } });
  const st7 = await F.eseguiGruppi(F.avviaImporta(A7.nuovi), (prodotti) => s7b.esegui("prodotti_importa", { prodotti }), {});
  const fin7 = F.riepilogoFinale(A7, st7);
  c("riepilogo finale: importati 2, saltati 1, respinti 8 (7 del controllo + 1 del server)", [2, 1, 8, "Importati 2 prodotti (tutti in bozza). Saltato 1 già presente. Respinti 8 con errori."], [fin7.importati, fin7.saltati, fin7.respinti, F.fraseFinale(fin7)]);
  const csv7 = Lt.leggiCsv(new TextEncoder().encode(F.csvDaCorreggere(A7, fin7)));
  c("«Scarica le righe da correggere»: l'intestazione con «Errore» e solo le 8 righe respinte (anche quella respinta dal server, che non ha righeProdotto)", [true, "Errore", ["prezzo-brutto", "doppio-b", "sku-altrui", "quattro-opzioni", "sconto", "senza-titolo", "Con Maiuscole", "troppo-lungo"]], [csv7.ok, csv7.record[0].at(-1), csv7.record.slice(1).map((x) => x[0])]);

  // ════ I LIMITI: il file si respinge PRIMA di leggerlo, senza nemmeno chiamare il server ════
  const prima = async (file) => { const sv = serverFinto(); const x = await F.analizzaFile(file, sv.esegui); return { x, sv, file }; };
  const xl = await prima(fileDa("catalogo.xlsx", "PK\x03\x04qualcosa"));
  c("un .xlsx è respinto con «Salva da Excel come CSV UTF-8», senza leggerlo e senza il server", [false, true, 0, 0], [xl.x.ok, /CSV UTF-8/.test(xl.x.frase), xl.file.lette, xl.sv.log.length]);
  const grande = await prima(fileDa("grande.csv", "Handle,Title\n", 2 * 1024 * 1024 + 1));
  c("oltre 2 MB: respinto dalla dimensione del File, senza leggere i byte", [false, true, 0, 0], [grande.x.ok, /2 MB/.test(grande.x.frase), grande.file.lette, grande.sv.log.length]);
  const molte = await prima(fileDa("righe.csv", `Handle,Title,Variant SKU\n${Array.from({ length: 5001 }, (_, i) => `h${i},T${i},S${i}`).join("\n")}\n`));
  c("oltre 5000 righe: respinto con la frase del limite, senza il server", [false, true, 0], [molte.x.ok, /5000|5\.000/.test(molte.x.frase), molte.sv.log.length]);
  const troppi = await prima(fileDa("trecentouno.csv", `Handle,Title,Variant SKU\n${Array.from({ length: 301 }, (_, i) => `h${i},T${i},S${i}`).join("\n")}\n`));
  c("301 prodotti: respinto con «il massimo è 300», senza il server", [false, true, 0], [troppi.x.ok, /300/.test(troppi.x.frase ?? ""), troppi.sv.log.length]);
  const vuoto = await prima(fileDa("vuoto.csv", ""));
  c("un file vuoto è respinto", [false, 0], [vuoto.x.ok, vuoto.sv.log.length]);
  const senzaCol = await prima(fileDa("sbagliato.csv", "Nome,Prezzo\nA,1\n"));
  c("senza le colonne Handle e Title: respinto, la frase dice cosa manca, il server non si chiama", [false, true, 0], [senzaCol.x.ok, /manca la colonna/.test(senzaCol.x.frase ?? ""), senzaCol.sv.log.length]);

  // ════ LA VERIFICA: a pezzi, e se manca la migrazione ════
  const righeMolte = [["Handle", "Title", "Option1 Name", "Option1 Value", "Variant SKU", "Variant Price"], ...Array.from({ length: 60 }, (_, i) => Array.from({ length: 10 }, (_, k) => [`prod-${i}`, k === 0 ? `Prodotto ${i}` : "", k === 0 ? "Misura" : "", `M${k}`, `S${i}-${k}`, "5"])).flat()];
  const sv9 = serverFinto();
  const a9 = await F.analizzaFile(fileDa("seicento.csv", Er.scriviCsv(righeMolte, ",", false)), sv9.esegui);
  c("600 SKU: la verifica parte a pezzi da al massimo 400 SKU e 300 indirizzi; gli indirizzi nel primo pezzo", [true, 2, true, true], [a9.ok, sv9.log.length, sv9.log.every((x) => x.dati.skus.length <= 400 && x.dati.slugs.length <= 300), sv9.log[0].dati.slugs.length === 60 && sv9.log[1].dati.slugs.length === 0]);
  c("…e i 60 prodotti, 600 varianti, sono tutti letti", [60, 60], [a9.analisi?.nuovi.length, a9.analisi?.righe.length]);
  const sv10 = serverFinto({ importaDisponibile: false });
  const a10 = await F.analizzaFile(fileDa("modello-prodotti.csv", modello), sv10.esegui);
  c("importaDisponibile:false → l'anteprima c'è, ma il tasto resta spento con la frase", [true, false, "Per importare serve un aggiornamento del database."], [a10.ok, a10.analisi.importaDisponibile, F.FRASE_NON_DISPONIBILE]);
  const sv11 = serverFinto({ guasti: { verifica: true } });
  const a11 = await F.analizzaFile(fileDa("modello-prodotti.csv", modello), sv11.esegui);
  c("se la verifica non arriva: nessuna anteprima, la frase del server, nessuna scrittura", [false, "Non riesco a collegarmi al server.", 0], [a11.ok, a11.frase, sv11.richiesteImporta().length]);
  const sv12b = { esegui: async () => ({ ok: true, dati: { presenti: [], skuUsati: [], categorie: [], costoDisponibile: true } }) };
  const a12b = await F.analizzaFile(fileDa("modello-prodotti.csv", modello), sv12b.esegui);
  c("una verifica senza importaDisponibile booleano non dà anteprima", false, a12b.ok);
  const sv12 = { esegui: async () => ({ ok: true, dati: { presenti: "no" } }) };
  const a12 = await F.analizzaFile(fileDa("modello-prodotti.csv", modello), sv12.esegui);
  c("una verifica che non è nella forma del contratto non produce un'anteprima", [false, true], [a12.ok, typeof a12.frase === "string" && a12.frase.length > 10]);
  const pv = await F.analizzaFile(fileDa("excel.csv", Er.scriviCsv(Lt.leggiCsv(new TextEncoder().encode(modello)).record, ";", false)), serverFinto().esegui);
  c("un file di Excel italiano (punto e virgola) dà lo stesso riepilogo", "2 prodotti · 5 varianti · 2 nuovi · 0 errori", pv.ok && F.fraseRiepilogo(pv.analisi));
}
