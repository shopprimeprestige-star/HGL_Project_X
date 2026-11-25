/** ── EDITOR PRODOTTI · E10 · LA FINESTRA DELL'IMPORT: SORGENTE E DISEGNO ─────────
 *  `src/crm/ecommerce/prodotti/importa/` (FinestraImporta, PassoScegli, PassoControllo, PassoImporta, importa-flusso, importa-analisi). Sorgente: niente `fetch(`
 *  diretto, niente `innerHTML`, niente archivio del browser (il file vive in memoria), nessuna parola vietata, sotto le 450 righe, la rete passa da
 *  `negozio.esegui`. Disegno con `rendiComponente` (react-dom/server): i tre passi con i dati veri dell'anteprima e un solo tasto pieno per passo.
 *  Gli effetti e i clic non girano in `react-dom/server`: gli spostamenti fra gli stati si provano in `importa-flusso.mjs` con le funzioni pure.
 *  Dati inventati, nessuna rete. */
import { build } from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { trovaParoleVietate } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const pieni = (html) => (html.match(/bg-primary text-primary-foreground/g) ?? []).length;
const conta = (html, re) => (html.match(re) ?? []).length;
/** Il tasto con quel testo: il suo marchio, per vedere se è spento. */
/** Un tasto che non c'è conta come spento: «acceso» richiede di averlo trovato. */
const spento = (b) => b === undefined || /\sdisabled(=""|\s|>)/.test(b);
const tasto = (html, testo) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]).find((b) => leggibile(b).includes(testo));

const DIR = "src/crm/ecommerce/prodotti/importa";
const FILE = ["FinestraImporta.tsx", "PassoScegli.tsx", "PassoControllo.tsx", "PassoImporta.tsx", "importa-flusso.ts", "importa-analisi.ts"];
const variante = (n, o = {}) => ({ riga: n + 1, sku: `P-${n}`, nome: "Unica", opzioni: {}, prezzoCent: null, pesoG: null, gtin: null, costoCent: null, giacenza: 3, ...o });
const prod = (n) => ({ handle: `prodotto-${n}`, titolo: `Prodotto ${n}`, tipo: "cura", categorie: [], sku: `P-${n}`, prezzoCent: 1990, varianti: [variante(n)] });

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E10 · FINESTRA DELL'IMPORT: SORGENTE E DISEGNO (25/11/2026)");
  const percorso = (f) => join(radice, DIR, f);
  c("i sei file dell'import esistono", FILE.map(() => true), FILE.map((f) => existsSync(percorso(f))));
  if (!FILE.every((f) => existsSync(percorso(f)))) return;
  const src = Object.fromEntries(FILE.map((f) => [f, readFileSync(percorso(f), "utf8")]));

  // ════ IL SORGENTE ════
  for (const [nome, s] of Object.entries(src)) {
    const k = senzaCommenti(s);
    c(`${nome}: sotto le 450 righe`, true, s.split("\n").length < 450);
    c(`${nome}: nessun fetch( diretto, nessun XMLHttpRequest, nessuna WebSocket`, false, /\bfetch\(|XMLHttpRequest|new WebSocket|sendBeacon|fetchCRM/.test(k));
    c(`${nome}: nessun innerHTML, outerHTML, dangerouslySetInnerHTML, insertAdjacentHTML, document.write`, false, /innerHTML|outerHTML|dangerouslySetInnerHTML|insertAdjacentHTML|document\.write/.test(k));
    c(`${nome}: il file non va in nessun archivio del browser (localStorage, sessionStorage, IndexedDB, Cache)`, false, /localStorage|sessionStorage|indexedDB|\bcaches\b|FileReader|showSaveFilePicker/.test(k));
    c(`${nome}: nessun eval, nessun new Function, nessun console, nessun @shopify`, false, /\beval\(|new Function|console\.|@shopify/.test(k));
    for (const vietato of [/compareAt/i, /prezzo\s+barrato/i, /\brating\b/i, /best\s*seller/i, /\bstelle\b/i, /sconto/i, /\bdelete\b/, /Elimina/, /parseFloat/, /\*\s*100\b/])
      c(`${nome}: nessuna occorrenza di ${vietato}`, false, vietato.test(k));
    c(`${nome}: nessuna ombra scritta a mano, nessun colore scritto a mano`, false, /\bshadow-/.test(k) || /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(/.test(k.replace(/&#\d+;|&#x[0-9a-f]+;/gi, "")));
  }
  const fl = senzaCommenti(src["importa-flusso.ts"] + src["importa-analisi.ts"]);
  c("importa-flusso.ts è puro: niente React, niente DOM, niente rete", false, /from "react|\bdocument\b|\bwindow\b|\bnavigator\b|\bfetch\b/.test(fl));
  c("i gruppi usano i limiti del contratto (5 prodotti, 80 000 byte), non numeri scritti qui", [true, true], [/LIMITI\.prodottiPerRichiesta/.test(fl), /LIMITI\.byteClient/.test(fl)]);
  const contratto = readFileSync(join(radice, "src/crm/negozio/import-contratto.ts"), "utf8");
  c("…e il contratto dice davvero 5 e 80 000", [true, true], [/prodottiPerRichiesta: 5\b/.test(contratto), /byteClient: 80_000\b/.test(contratto)]);
  c("la misura è in byte (TextEncoder), non in caratteri", true, /new TextEncoder\(\)\.encode\(JSON\.stringify\(\{ azione: AZIONE_IMPORTA/.test(fl));
  const client = readFileSync(join(radice, "src/crm/negozio/client.ts"), "utf8");
  c("le due azioni sono quelle che il client del negozio conosce", [true, true, true, true], [/AZIONE_VERIFICA = "prodotti_importa_verifica"/.test(fl), /AZIONE_IMPORTA = "prodotti_importa"/.test(fl), /"prodotti_importa_verifica"/.test(client), /"prodotti_importa",/.test(client)]);
  const fin = senzaCommenti(src["FinestraImporta.tsx"]);
  c("la rete passa da negozio.esegui (verifica e import), una volta ciascuna", [true, true, 2], [/analizzaFile\(file, negozio\.esegui\)/.test(fin), /negozio\.esegui\(AZIONE_IMPORTA, \{ prodotti \}\)/.test(fin), conta(fin, /negozio\.esegui/g)]);
  c("la finestra non si chiude mentre i gruppi partono (onOpenChange guarda `occupata`)", true, /onOpenChange=\{\(v\) => !v && !occupata && chiudi\(\)\}/.test(fin));
  c("«Riprendi» non rimanda i gruppi fatti: passa da riprendi() della macchina", true, /manda\(fase\.analisi, riprendi\(fase\.stato\)\)/.test(fin));
  c("i risultati in ritardo di un giro vecchio si scartano", true, (fin.match(/mio === giro\.current|mio !== giro\.current/g) ?? []).length >= 3);
  c("i tre passi non toccano la rete né l'archivio: niente esegui, niente negozio", [false, false, false], ["PassoScegli.tsx", "PassoControllo.tsx", "PassoImporta.tsx"].map((f) => /\besegui\b|\bnegozio\.|\buseNegozio|\bNegozio\b/.test(senzaCommenti(src[f]))));
  c("i passi usano il kit di stile della scheda (polaris) e i tasti da 44 px sul telefono", [true, true, true], ["PassoScegli.tsx", "PassoControllo.tsx", "PassoImporta.tsx"].map((f) => /from "\.\.\/scheda\/polaris"/.test(src[f]) && /CLASSI_TASTO/.test(src[f])));
  c("il filtro «solo gli errori» usa la funzione della macchina", true, /soloErr \? soloErrori\(righe\) : righe/.test(senzaCommenti(src["PassoControllo.tsx"])));
  c("le cifre in colonna sono tabulari (la tabella si legge in verticale)", true, /tabular-nums/.test(src["PassoControllo.tsx"]));

  // ════ IL DISEGNO ════
  const F = await carica(radice, `${DIR}/importa-flusso.ts`);
  const Mo = await carica(radice, "src/crm/negozio/csv-modello.ts");
  const Er = await carica(radice, "src/crm/negozio/csv-errori.ts");
  const fileDa = (name, testo) => { const b = new TextEncoder().encode(testo); return { name, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
  const verifica = (presenti = [], importaDisponibile = true) => async (azione, dati) => ({ ok: true, dati: { presenti: presenti.filter((p) => dati.slugs.includes(p.slug)), skuUsati: azione === "prodotti_importa_verifica" && dati.skus.includes("HG-T01") ? [{ sku: "HG-T01", prodottoId: "x", prodottoNome: "Lace Front Swiss + PU", comeVariante: false }] : [], categorie: [], costoDisponibile: true, importaDisponibile } });
  const analizza = async (nome, testo, presenti, disp) => (await F.analizzaFile(fileDa(nome, testo), verifica(presenti, disp))).analisi;
  const modello = Mo.costruisciModello();
  const aOk = await analizza("modello-prodotti.csv", modello);
  const INT = ["Handle", "Title", "Variant SKU", "Variant Price"];
  const difetti = Er.scriviCsv([INT, ["buono", "Buono", "B-1", "5"], ["prezzo-brutto", "Prezzo brutto", "PB-1", "abc"], ["sku-altrui", "Sku altrui", "HG-T01", "5"], ["gia-qui", "Già qui", "GQ-1", "5"], ["altro", "Altro", "AL-1", "7,50"]], ",", false);
  const aMisto = await analizza("difetti.csv", difetti, [{ id: "id-gia-qui", slug: "gia-qui", nome: "Già qui", stato: "bozza" }]);
  const aTuttiPresenti = await analizza("modello-prodotti.csv", modello, [{ id: "a", slug: "shampoo-delicato-esempio", nome: "A", stato: "bozza" }, { id: "b", slug: "parrucca-esempio", nome: "B", stato: "bozza" }]);
  const aSpento = await analizza("modello-prodotti.csv", modello, [], false);
  const nulla = () => {};
  const resa = async (file, nome, props) => (await rendiComponente(radice, join(DIR, file), nome, props)).html;

  // ── Passo 1 ──
  const p1 = await resa("PassoScegli.tsx", "PassoScegli", { leggo: false, scegli: nulla, scaricaModello: nulla });
  c("passo 1: il campo è un file .csv, nascosto (il tasto lo apre)", [true, true], [/<input[^>]*type="file"[^>]*accept="\.csv,text\/csv"/.test(p1) || /<input[^>]*accept="\.csv,text\/csv"[^>]*type="file"/.test(p1), /<input[^>]*class="sr-only"/.test(p1)]);
  c("passo 1: «Scegli il file» (tasto pieno, uno solo), «Scarica il file modello» e «Cosa leggo e cosa ignoro»", [1, true, true, true], [pieni(p1), leggibile(p1).includes("Scegli il file"), leggibile(p1).includes("Scarica il file modello"), leggibile(p1).includes("Cosa leggo e cosa ignoro")]);
  c("passo 1: il riquadro si apre e si chiude (aria-expanded) ed è aperto all'inizio", true, /aria-expanded="true"/.test(p1));
  c("passo 1: dice cosa si legge, cosa si ignora (foto, Published, Compare At Price) e i limiti (2 MB, 5000 righe, 300 prodotti)", [true, true, true, true, true, true], ["Leggo", "Ignoro", "Foto e video", "2 MB, 5000 righe e 300 prodotti", "CSV UTF-8", "viene saltato, mai aggiornato"].map((t) => leggibile(p1).includes(t)));
  c("passo 1: il file non viene salvato, si dice", true, /non viene salvato/.test(leggibile(p1)));
  c("passo 1: i tasti sono alti 44 px sul telefono (h-11) e 36 sul computer (md:h-9)", true, conta(p1, /h-11 text-\[13px\] md:h-9/g) >= 2);
  const p1l = await resa("PassoScegli.tsx", "PassoScegli", { leggo: true, scegli: nulla, scaricaModello: nulla });
  c("passo 1, mentre legge: il tasto è spento e lo dice a parole; la zona è occupata (aria-busy)", [true, true, true], [spento(tasto(p1l, "Leggo il file")), leggibile(p1l).includes("Non viene scritto niente"), /aria-busy="true"/.test(p1l)]);
  const p1e = await resa("PassoScegli.tsx", "PassoScegli", { leggo: false, errore: "Il file è troppo grande: il limite è 2 MB. Dividilo in più file.", scegli: nulla, scaricaModello: nulla });
  c("passo 1, file respinto: la frase sta in un avviso (role=alert) con titolo", [true, true], [/role="alert"[^>]*>[\s\S]*Il file è troppo grande/.test(p1e), leggibile(p1e).includes("Questo file non va")]);

  // ── Passo 2 ──
  const p2 = (analisi, extra = {}) => resa("PassoControllo.tsx", "PassoControllo", { analisi, apriProdotto: nulla, cambiaFile: nulla, scaricaErrori: nulla, importa: nulla, ...extra });
  const h2 = await p2(aOk);
  c("passo 2, il modello: «2 prodotti · 5 varianti · 2 nuovi · 0 errori»", true, leggibile(h2).includes("2 prodotti · 5 varianti · 2 nuovi · 0 errori"));
  c("passo 2: la tabella ha le 7 colonne (con scope) e le 2 righe, prezzo e giacenza in colonna tabulare", [7, 3, true, true], [conta(h2, /<th scope="col"/g), conta(h2, /<tr\b/g), leggibile(h2).includes("14,90 €") && leggibile(h2).includes("199,00 €"), /tabular-nums/.test(h2)]);
  c("passo 2: esito scritto «Nuovo» (non solo colore), nessun errore → nessun filtro e nessun «righe da correggere»", [2, false, false], [conta(h2, />\s*<svg[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>\s*Nuovo/g), /Mostra solo gli errori/.test(h2), /Scarica le righe da correggere/.test(h2)]);
  c("passo 2: «Importa 2 prodotti in bozza» acceso, uno solo pieno, nessuna frase di tasto spento", [true, 1, false], [!spento(tasto(h2, "Importa 2 prodotti in bozza")), pieni(h2), /perche-spento/.test(h2)]);
  c("passo 2: dice che non è stato scritto niente", true, /Non è stato scritto niente/.test(leggibile(h2)));
  c("passo 2: le colonne che si ignorano sono elencate una volta sola", 1, conta(leggibile(h2), /Colonne che ignoro:/g));
  const hm = await p2(aMisto);
  c("passo 2, file con errori: «Errori (2)» con la riga e la frase (riga 3 prezzo, riga 4 SKU di un altro prodotto)", [true, true, true], [leggibile(hm).includes("Errori (2)"), /Riga 3 \(handle `prezzo-brutto`\)[^.]*«abc»/.test(leggibile(hm)), /Riga 4 \(handle `sku-altrui`\)[^.]*HG-T01[^.]*«Lace Front Swiss \+ PU»/.test(leggibile(hm))]);
  c("passo 2: il filtro «Mostra solo gli errori» (casella con etichetta) e «Scarica le righe da correggere» ci sono", [true, true, true], [/<label[^>]*>\s*<input[^>]*type="checkbox"[\s\S]*?Mostra solo gli errori/.test(hm), leggibile(hm).includes("Scarica le righe da correggere"), leggibile(hm).includes("Un prodotto con un errore non entra")]);
  c("passo 2: «Importa 2 prodotti in bozza» (i buoni), «Già presente» col collegamento per aprire il prodotto", [true, true, true], [leggibile(hm).includes("Importa 2 prodotti in bozza"), leggibile(hm).includes("Già presente"), /Apri il prodotto<span class="sr-only"> Già qui<\/span>/.test(hm)]);
  c("passo 2: senza la funzione per aprirlo, nessun collegamento falso", false, /Apri il prodotto/.test(await p2(aMisto, { apriProdotto: undefined })));
  const hs = await p2(aSpento);
  c("passo 2, importaDisponibile:false: tasto spento con la frase, legata al tasto (aria-describedby)", [true, true, true], [spento(tasto(hs, "Importa 2 prodotti in bozza")), leggibile(hs).includes("Per importare serve un aggiornamento del database."), /aria-describedby="perche-spento"/.test(hs) && /id="perche-spento"/.test(hs)]);
  const hp = await p2(aTuttiPresenti);
  c("passo 2, file già importato: «nessun nuovo · 2 già presenti (saltati)», tasto spento con la frase", [true, true, true], [leggibile(hp).includes("2 prodotti · 5 varianti · nessun nuovo · 2 già presenti (saltati) · 0 errori"), spento(tasto(hp, "Importa 0 prodotti in bozza")), leggibile(hp).includes("Non c'è niente di nuovo da importare")]);
  const tanti = { ...aMisto, errori: Array.from({ length: 150 }, (_, i) => ({ riga: i + 2, handle: `p-${i}`, frase: `Frase ${i}.` })) };
  const ht = await p2(tanti);
  c("passo 2, 150 errori: se ne scrivono 100 e si dice degli altri 50", [100, true], [conta(ht.slice(ht.indexOf("Errori ("), ht.indexOf("Prodotti del file")), /<li class="break-words">Riga \d+/g), leggibile(ht).includes("…e altri 50 errori")]);
  const hav = await p2({ ...aOk, avvisi: [{ riga: 0, frase: "2 immagini non importate: le foto si caricano a mano dalla scheda del prodotto." }, { riga: 5, handle: "x", frase: "Il tipo è sconosciuto." }] });
  c("passo 2: gli avvisi stanno in un riquadro apribile e non bloccano (tasto acceso)", [true, true, true], [/<details[^>]*>\s*<summary/.test(hav), leggibile(hav).includes("Avvisi (2): non bloccano"), !spento(tasto(hav, "Importa 2 prodotti in bozza"))]);
  c("passo 2: nessuna parola vietata nel testo (modello, errori, spento, già presenti)", [], trovaParoleVietate(leggibile(h2 + hm + hs + hp)));

  // ── Passo 3 ──
  const srv = (guasto) => { let n = 0; return async (prodotti) => { n++; return guasto?.(n) ?? { ok: true, dati: { risultati: prodotti.map((p) => ({ handle: p.handle, esito: "creato", prodottoId: `id-${p.handle}` })) } }; }; };
  const a12 = { ...aOk, nuovi: Array.from({ length: 12 }, (_, i) => prod(i + 1)), giaPresenti: [], errori: [], nProdottiConErrori: 0 };
  const p3 = (stato, inCorso, analisi = a12, extra = {}) => resa("PassoImporta.tsx", "PassoImporta", { analisi, stato, inCorso, interrompi: nulla, riprendi: nulla, scaricaErrori: nulla, vaiAiProdotti: nulla, chiudi: nulla, ...extra });
  const dopoUno = await F.eseguiGruppi(F.avviaImporta(a12.nuovi), srv(), { interrompi: (() => { let k = 0; return () => k++ >= 1; })() });
  const hc = await p3({ ...dopoUno, fermo: null }, true);
  c("passo 3, in corso: barra al 41 %, «5 di 12 prodotti · gruppo 2 di 3», «Interrompi», niente «Riprendi»", [true, true, true, false], [/role="progressbar"[^>]*aria-valuenow="41"/.test(hc), leggibile(hc).includes("5 di 12 prodotti · gruppo 2 di 3"), leggibile(hc).includes("Interrompi"), /Riprendi/.test(hc)]);
  c("passo 3, in corso: la barra ha nome, minimo e massimo; si ferma con motion-reduce; dice di non chiudere", [true, true, true], [/aria-label="Importati 5 di 12 prodotti"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"|aria-valuemin="0"[^>]*aria-valuemax="100"/.test(hc) && /aria-label="Importati 5 di 12 prodotti"/.test(hc), /motion-reduce:transition-none/.test(hc) && /motion-reduce:animate-none/.test(hc), leggibile(hc).includes("Non chiudere la finestra")]);
  c("passo 3, in corso: nessun tasto pieno (solo «Interrompi» di contorno)", 0, pieni(hc));
  const ferma = await F.eseguiGruppi(F.avviaImporta(a12.nuovi), srv((n) => (n === 2 ? { ok: false, errore: { tipo: "rete", messaggio: "Non riesco a collegarmi al server: controlla la connessione e riprova." } } : null)));
  const hf = await p3(ferma, false);
  c("passo 3, fermo per un errore di rete: la frase, «Riprendi» (uno solo pieno), «Chiudi», niente doppioni, e come ripartire", [true, true, 1, true, true, true], [leggibile(hf).includes("Non riesco a collegarmi al server: controlla la connessione e riprova."), leggibile(hf).includes("L'importazione si è fermata"), pieni(hf), leggibile(hf).includes("senza doppioni"), leggibile(hf).includes("Se chiudi, puoi ricaricare lo stesso file"), /role="alert"/.test(hf)]);
  const hi = await p3(F.sospendi(dopoUno), false);
  c("passo 3, interrotto da chi usa: «Importazione interrotta» come avviso, «Riprendi» acceso, 5 di 12", [true, true, true], [leggibile(hi).includes("Importazione interrotta"), !/role="alert"/.test(hi), leggibile(hi).includes("5 di 12 prodotti")]);
  const finito = await F.eseguiGruppi(F.avviaImporta(a12.nuovi), srv());
  const hz = await p3(finito, false);
  c("passo 3, finito: «Importati 12 prodotti (tutti in bozza). Saltati 0 già presenti. Respinti 0 con errori.», barra al 100, «Vai ai prodotti importati» pieno, nessun «righe da correggere»", [true, true, 1, true, false], [leggibile(hz).includes("Importati 12 prodotti (tutti in bozza). Saltati 0 già presenti. Respinti 0 con errori."), /aria-valuenow="100"/.test(hz), pieni(hz), leggibile(hz).includes("Vai ai prodotti importati"), /righe da correggere/.test(hz)]);
  c("passo 3, finito: dice che sono in bozza e senza foto, da controllare prima di pubblicare", true, /in bozza e senza foto/.test(leggibile(hz)));
  const conErr = { ...aMisto, nuovi: aMisto.nuovi };
  const sErr = await F.eseguiGruppi(F.avviaImporta(conErr.nuovi), srv());
  const hr = await p3(sErr, false, conErr);
  c("passo 3, con respinti: «Scarica le righe da correggere» e «Respinti 2 con errori» (i due del controllo)", [true, true], [leggibile(hr).includes("Scarica le righe da correggere"), leggibile(hr).includes("Respinti 2 con errori")]);
  const soloSaltati = { ...aTuttiPresenti, nuovi: [] };
  const hs0 = await p3(F.avviaImporta([]), false, soloSaltati);
  c("passo 3, niente importato: il tasto pieno è «Chiudi», non «Vai ai prodotti importati»", [1, true, false], [pieni(hs0), leggibile(hs0).includes("Chiudi"), /Vai ai prodotti importati/.test(hs0)]);
  c("passo 3: nessuna parola vietata nel testo", [], trovaParoleVietate(leggibile(hc + hf + hi + hz + hr + hs0)));
}
