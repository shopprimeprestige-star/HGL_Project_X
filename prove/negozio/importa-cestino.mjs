/** ── EDITOR PRODOTTI · E15 · L'IMPORT E IL CESTINO ───────────────────────────────
 *  Un prodotto del file il cui indirizzo esiste ma è `archiviato` (E14: il Cestino) non è «già presente»: è «Nel Cestino» e all'import TORNA IN BOZZA
 *  (stessa azione server «Rimetti in bozza»: `gruppo_stato` → bozza, a pezzi da 20), poi segue il percorso delle foto dei già presenti.
 *  Si prova: l'analisi separa archiviati e presenti; il flusso chiama `gruppo_stato` SOLO per gli archiviati, a pezzi da 20; il riepilogo conta
 *  giusto; un pezzo che fallisce non fa perdere gli altri e si riprova; i presenti non archiviati restano saltati; le frasi dei tre passi.
 *  Server finto scritto qui (dati inventati, nessuna rete). Nessuna migrazione, nessuna scrittura oltre alla bozza (D5). */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { trovaParoleVietate } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const pieni = (html) => (html.match(/bg-primary text-primary-foreground/g) ?? []).length;
const spento = (b) => b === undefined || /\sdisabled(=""|\s|>)/.test(b);
const tasto = (html, testo) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]).find((b) => leggibile(b).includes(testo));
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

const DIR = "src/crm/ecommerce/prodotti/importa";
const nulla = () => {};
/** Il file di prova non ha la colonna del tipo: gli avvisi non c'entrano, si tolgono dalla frase. */
const senzaAvvisi = (t) => t.replace(/ · \d+ avvisi?$/, "");
const fileDa = (name, testo) => { const b = new TextEncoder().encode(testo); return { name, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
const csvDi = (handles) => `Handle,Title,Variant SKU,Variant Price\n${handles.map((h) => `${h},Titolo ${h},SKU-${h},9.90`).join("\n")}\n`;
const nome = (i) => `p-${String(i).padStart(2, "0")}`;
const variante = (n, o = {}) => ({ riga: n + 1, sku: `P-${n}`, nome: "Unica", opzioni: {}, prezzoCent: null, pesoG: null, gtin: null, costoCent: null, giacenza: 3, ...o });
const prod = (n) => ({ handle: `nuovo-${n}`, titolo: `Nuovo ${n}`, tipo: "cura", categorie: [], sku: `N-${n}`, prezzoCent: 1990, varianti: [variante(n)] });

/** Il server finto: la verifica dice lo stato di ogni indirizzo esistente; `gruppo_stato` registra ogni richiesta e rimette in bozza (come il vero). */
function serverFinto({ catalogo = [], guasti = {}, restano = {} } = {}) {
  const db = new Map(catalogo.map((p) => [p.slug, { id: `id-${p.slug}`, nome: p.slug, ...p }]));
  const log = [];
  let nGruppo = 0;
  const esegui = async (azione, dati = {}) => {
    log.push({ azione, dati });
    if (azione === "prodotti_importa_verifica")
      return { ok: true, dati: { presenti: [...db.values()].filter((p) => dati.slugs.includes(p.slug)).map((p) => ({ id: p.id, slug: p.slug, nome: p.nome, stato: p.stato })), skuUsati: [], categorie: [], costoDisponibile: true, importaDisponibile: true } };
    if (azione === "gruppo_stato") {
      nGruppo++;
      if (guasti[nGruppo]) return { ok: false, errore: { tipo: guasti[nGruppo], messaggio: "Non riesco a collegarmi al server." } };
      let bozze = 0;
      const fuori = [];
      for (const id of dati.ids) {
        const p = [...db.values()].find((x) => x.id === id);
        if (restano[id]) { fuori.push({ id, motivo: restano[id] }); continue; }
        if (p && p.stato !== "bozza") { p.stato = "bozza"; bozze++; }
      }
      return { ok: true, dati: { bozze, restano: fuori } };
    }
    if (azione === "prodotti_importa") return { ok: true, dati: { risultati: dati.prodotti.map((p) => ({ handle: p.handle, esito: "creato", prodottoId: `id-${p.handle}` })) } };
    return { ok: false, errore: { tipo: "valore", messaggio: "azione sconosciuta" } };
  };
  return { esegui, db, log, rimetti: () => log.filter((x) => x.azione === "gruppo_stato"), scritture: () => log.filter((x) => x.azione !== "prodotti_importa_verifica") };
}

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E15 · IMPORT E CESTINO: ANALISI, FLUSSO, RIEPILOGO, PASSI (28/11/2026)");
  const F = await carica(radice, `${DIR}/importa-flusso.ts`).catch((e) => ({ errore: String(e) }));
  c("importa-flusso.ts si compila e si carica", undefined, F.errore);
  if (F.errore) return;
  const Foto = await carica(radice, `${DIR}/importa-foto.ts`);

  // ════ L'ANALISI: archiviati separati dai presenti ════
  // 45 nel Cestino, 3 già presenti (bozza, pubblicato, bozza), 2 nuovi: il file ha 50 prodotti.
  const archiviati = Array.from({ length: 45 }, (_, i) => nome(i));
  const presenti = ["pres-bozza", "pres-pubblicato", "pres-altro"];
  const nuovi = ["nuovo-a", "nuovo-b"];
  const srv = serverFinto({ catalogo: [...archiviati.map((slug) => ({ slug, stato: "archiviato" })), { slug: "pres-bozza", stato: "bozza" }, { slug: "pres-pubblicato", stato: "pubblicato" }, { slug: "pres-altro", stato: "bozza" }] });
  const r = await F.analizzaFile(fileDa("catalogo.csv", csvDi([...archiviati, ...presenti, ...nuovi])), srv.esegui);
  const A = r.analisi;
  c("analisi riuscita", true, r.ok);
  c("dalCestino = i 45 archiviati (con id e nome per aprirli), giaPresenti = i 3 non archiviati, nuovi = 2", [45, ["id-p-00", "id-p-44"], ["pres-bozza", "pres-pubblicato", "pres-altro"], ["nuovo-a", "nuovo-b"]], [A.dalCestino.length, [A.dalCestino[0].prodottoId, A.dalCestino[44].prodottoId], A.giaPresenti.map((g) => g.handle), A.nuovi.map((p) => p.handle)]);
  c("la tabella: 45 «cestino» (con l'id per aprire il prodotto), 3 «presente», 2 «nuovo»", [45, 3, 2, true], [A.righe.filter((x) => x.esito === "cestino").length, A.righe.filter((x) => x.esito === "presente").length, A.righe.filter((x) => x.esito === "nuovo").length, A.righe.filter((x) => x.esito === "cestino").every((x) => x.prodottoId?.startsWith("id-p-"))]);
  c("riepilogo: «50 prodotti · 50 varianti · 2 nuovi · 45 dal Cestino (tornano in bozza) · 3 già presenti (saltati) · 0 errori»", "50 prodotti · 50 varianti · 2 nuovi · 45 dal Cestino (tornano in bozza) · 3 già presenti (saltati) · 0 errori", senzaAvvisi(F.fraseRiepilogo(A)));
  c("riepilogo con un solo prodotto nel Cestino: singolare", true, F.fraseRiepilogo({ ...A, dalCestino: A.dalCestino.slice(0, 1) }).includes("1 dal Cestino (torna in bozza)"));
  c("la verifica non scrive niente (nemmeno `gruppo_stato`): solo sola lettura", [], srv.scritture());
  // Il caso del titolare: tutti nel Cestino, nulla di nuovo.
  const srvTutti = serverFinto({ catalogo: archiviati.map((slug) => ({ slug, stato: "archiviato" })) });
  const rt = await F.analizzaFile(fileDa("catalogo.csv", csvDi(archiviati)), srvTutti.esegui);
  c("tutti archiviati: «nessun nuovo · 45 dal Cestino (tornano in bozza)», e NESSUN «già presente»", [true, 0, 45, "45 prodotti · 45 varianti · nessun nuovo · 45 dal Cestino (tornano in bozza) · 0 errori"], [rt.ok, rt.analisi.giaPresenti.length, rt.analisi.dalCestino.length, senzaAvvisi(F.fraseRiepilogo(rt.analisi))]);
  const srvSolo = serverFinto({ catalogo: [{ slug: "pres-bozza", stato: "bozza" }, { slug: "pres-pubblicato", stato: "pubblicato" }] });
  const rs = await F.analizzaFile(fileDa("catalogo.csv", csvDi(["pres-bozza", "pres-pubblicato"])), srvSolo.esegui);
  c("senza archiviati niente cambia: «2 già presenti (saltati)», nessun dal Cestino, esito «presente»", [0, 2, ["presente", "presente"], "2 prodotti · 2 varianti · nessun nuovo · 2 già presenti (saltati) · 0 errori"], [rs.analisi.dalCestino.length, rs.analisi.giaPresenti.length, rs.analisi.righe.map((x) => x.esito), senzaAvvisi(F.fraseRiepilogo(rs.analisi))]);

  // ════ IL FLUSSO: gruppo_stato bozza, solo per gli archiviati, a pezzi da 20 ════
  const nuoviP = [prod(1), prod(2)];
  const flusso = serverFinto({ catalogo: archiviati.map((slug) => ({ slug, stato: "archiviato" })) });
  const invia = (s) => (prodotti) => s.esegui("prodotti_importa", { prodotti });
  const rimetti = (s) => (ids) => s.esegui("gruppo_stato", { ids, stato: "bozza" });
  const s0 = F.avviaImporta(nuoviP, A.dalCestino);
  c("avviaImporta: 45 archiviati → 3 pezzi da 20, 20 e 5, tutti da fare; i gruppi dei nuovi sono come prima", [[20, 20, 5], ["da_fare", "da_fare", "da_fare"], 1], [s0.ripristino.map((p) => p.prodotti.length), s0.ripristino.map((p) => p.stato), s0.gruppi.length]);
  c("avviaImporta senza archiviati: nessun pezzo", 0, F.avviaImporta(nuoviP).ripristino.length);
  const fine = await F.eseguiGruppi(s0, invia(flusso), { rimetti: rimetti(flusso) });
  c("flusso: 3 richieste `gruppo_stato` con stato «bozza» (20, 20, 5), tutte con SOLO gli id dei 45 archiviati", [3, ["bozza", "bozza", "bozza"], [20, 20, 5], 45, true], [flusso.rimetti().length, flusso.rimetti().map((x) => x.dati.stato), flusso.rimetti().map((x) => x.dati.ids.length), new Set(flusso.rimetti().flatMap((x) => x.dati.ids)).size, flusso.rimetti().flatMap((x) => x.dati.ids).every((id) => id.startsWith("id-p-"))]);
  c("i pezzi vanno prima dei nuovi: l'ultimo `gruppo_stato` precede il primo `prodotti_importa`", true, flusso.log.findLastIndex((x) => x.azione === "gruppo_stato") < flusso.log.findIndex((x) => x.azione === "prodotti_importa"));
  c("nel database finto tornano in bozza tutti e 45; nessuna riga cancellata (45 + 2 nuovi non scritti dal finto)", [45, 45], [[...flusso.db.values()].filter((p) => p.stato === "bozza").length, flusso.db.size]);
  c("fine del flusso: nessun fermo, tutti i pezzi fatti, avanzamento 47 di 47 (45 + 2)", [null, ["fatto", "fatto", "fatto"], 47, 47, 100], [fine.fermo, fine.ripristino.map((p) => p.stato), F.avanzamento(fine).prodottiFatti, F.avanzamento(fine).prodottiTotali, F.avanzamento(fine).percento]);
  const rie = F.riepilogoFinale(A, fine);
  c("riepilogo: ripristinati 45, importati 2, saltati 3 (i presenti non archiviati), respinti 0", [45, 2, 3, 0, 0], [rie.ripristinati, rie.importati, rie.saltati, rie.respinti, rie.rimasti]);
  c("frase finale con «Rimessi in bozza dal Cestino 45», prima dei saltati", "Importati 2 prodotti (tutti in bozza). Rimessi in bozza dal Cestino 45. Saltati 3 già presenti. Respinti 0 con errori.", F.fraseFinale(rie));
  c("frase finale al singolare e senza archiviati (come prima)", ["Importati 2 prodotti (tutti in bozza). Saltati 3 già presenti. Respinti 0 con errori.", true], [F.fraseFinale({ ...rie, ripristinati: 0 }), F.fraseFinale({ ...rie, ripristinati: 1 }).includes("Rimesso in bozza dal Cestino 1.")]);
  // Solo prodotti dal Cestino, nessun nuovo (il caso del titolare)
  const f2 = serverFinto({ catalogo: archiviati.map((slug) => ({ slug, stato: "archiviato" })) });
  const fine2 = await F.eseguiGruppi(F.avviaImporta([], A.dalCestino), invia(f2), { rimetti: rimetti(f2) });
  c("senza nuovi: si rimettono in bozza lo stesso (3 richieste), nessun `prodotti_importa`, fine pulita", [3, 0, null, 45, 0], [f2.rimetti().length, f2.log.filter((x) => x.azione === "prodotti_importa").length, fine2.fermo, F.riepilogoFinale({ ...A, nuovi: [] }, fine2).ripristinati, F.riepilogoFinale({ ...A, nuovi: [] }, fine2).importati]);
  // I presenti NON archiviati: nessuna richiesta di stato, restano saltati
  const f3 = serverFinto({ catalogo: [{ slug: "pres-bozza", stato: "bozza" }] });
  const fine3 = await F.eseguiGruppi(F.avviaImporta([], rs.analisi.dalCestino), invia(f3), { rimetti: rimetti(f3) });
  const rie3 = F.riepilogoFinale(rs.analisi, fine3);
  c("solo presenti non archiviati: zero richieste, saltati 2, ripristinati 0", [0, 0, 2, 0], [f3.scritture().length, fine3.ripristino.length, rie3.saltati, rie3.ripristinati]);

  // ════ UN PEZZO CHE FALLISCE: gli altri non si perdono, si riprova ════
  const f4 = serverFinto({ catalogo: archiviati.map((slug) => ({ slug, stato: "archiviato" })), guasti: { 2: "rete" } });
  const parz = await F.eseguiGruppi(F.avviaImporta(nuoviP, A.dalCestino), invia(f4), { rimetti: rimetti(f4) });
  c("il secondo pezzo non va: fermo con la frase del server, primo pezzo fatto, secondo interrotto, terzo da fare", ["rete", "Non riesco a collegarmi al server.", ["fatto", "interrotto", "da_fare"]], [parz.fermo?.tipo, parz.fermo?.messaggio, parz.ripristino.map((p) => p.stato)]);
  c("…il primo pezzo resta rimesso in bozza (20 nel database), i nuovi NON sono partiti", [20, 0, 20], [[...f4.db.values()].filter((p) => p.stato === "bozza").length, f4.log.filter((x) => x.azione === "prodotti_importa").length, F.riepilogoFinale(A, parz).ripristinati]);
  c("…e i prodotti che mancano risultano «rimasti» (25 del Cestino + 2 nuovi), non respinti", [27, 0], [F.riepilogoFinale(A, parz).rimasti, F.riepilogoFinale(A, parz).respinti]);
  const ripreso = await F.eseguiGruppi(F.riprendi(parz), invia(f4), { rimetti: rimetti(f4) });
  c("«Riprendi»: il pezzo fatto NON si rimanda (+2 richieste: il pezzo da 20 e quello da 5), poi i nuovi; tutto finito", [4, null, 45, 2, ["fatto", "fatto", "fatto"]], [f4.rimetti().length, ripreso.fermo, F.riepilogoFinale(A, ripreso).ripristinati, F.riepilogoFinale(A, ripreso).importati, ripreso.ripristino.map((p) => p.stato)]);
  c("…e i due pezzi ripresi sono proprio il secondo e il terzo (ids diversi dal primo)", true, (() => { const l = f4.rimetti().map((x) => x.dati.ids); const primo = new Set(l[0]); return l.slice(1).flat().every((id) => !primo.has(id)); })());
  const f5 = serverFinto({ catalogo: archiviati.map((slug) => ({ slug, stato: "archiviato" })), guasti: { 1: "valore" } });
  const valore = await F.eseguiGruppi(F.avviaImporta(nuoviP, A.dalCestino), invia(f5), { rimetti: rimetti(f5) });
  c("anche un rifiuto del server («valore») ferma e si può riprovare: nessun prodotto perso, nessun nuovo partito", [true, "valore", false], [valore.ripristino[0].stato === "interrotto", valore.fermo?.tipo, valore.fermo?.incerto]);
  const f6 = serverFinto({ catalogo: archiviati.map((slug) => ({ slug, stato: "archiviato" })) });
  let k = 0;
  const interr = await F.eseguiGruppi(F.avviaImporta(nuoviP, A.dalCestino), invia(f6), { rimetti: rimetti(f6), interrompi: () => k++ >= 1 });
  c("«Interrompi» tra un pezzo e l'altro: 1 pezzo fatto, poi si ferma, e «Riprendi» fa gli altri", [1, "interrotto", 3], [f6.rimetti().length, interr.fermo?.tipo, (await F.eseguiGruppi(F.riprendi(interr), invia(f6), { rimetti: rimetti(f6) }), f6.rimetti().length)]);
  // Il server risponde «restano»: un prodotto che non è tornato in bozza è respinto, non conta come rimesso
  const f7 = serverFinto({ catalogo: archiviati.slice(0, 3).map((slug) => ({ slug, stato: "archiviato" })), restano: { "id-p-01": "Un'altra persona lo ha modificato." } });
  const fine7 = await F.eseguiGruppi(F.avviaImporta([], A.dalCestino.slice(0, 3)), invia(f7), { rimetti: rimetti(f7) });
  const rie7 = F.riepilogoFinale({ ...A, nuovi: [] }, fine7);
  c("un prodotto in «restano»: ripristinati 2, respinti 1 con la sua frase, e senza foto (non risulta tornato)", [2, 1, true, ["id-p-00", "id-p-02"]], [rie7.ripristinati, rie7.respinti, rie7.errori.some((e) => e.handle === "p-01" && /altra persona/.test(e.frase)), Foto.avviaFoto({ nuovi: [], giaPresenti: [], dalCestino: A.dalCestino.slice(0, 3), lettura: { prodotti: [], foto: new Map(A.dalCestino.map((g) => [g.handle, [{ url: "https://cdn.shopify.com/a.jpg", alt: "", posizione: 1, riga: 2 }]])) } }, fine7).prodotti.map((p) => p.prodottoId)]);
  const f8 = await F.eseguiGruppi(F.avviaImporta([], A.dalCestino.slice(0, 2)), invia(f7), { rimetti: async () => ({ ok: true, dati: { bozze: "boh" } }) });
  c("una risposta che non è nella forma del contratto non è un successo: fermo, nessun «rimesso»", [true, 0], [f8.fermo !== null && f8.ripristino[0].stato === "interrotto", F.riepilogoFinale({ ...A, nuovi: [] }, f8).ripristinati]);
  c("senza `rimetti` passato i pezzi non partono mai (nessuna chiamata a caso)", [0, "da_fare"], [f7.rimetti().length - 1 + 0, (await F.eseguiGruppi(F.avviaImporta([], A.dalCestino.slice(0, 2)), invia(f7), {})).ripristino[0].stato]);

  // ════ LA VERIFICA RIFATTA A «IMPORTA» E A «RIPRENDI»: chi non è più archiviato non si tocca ════
  const archiviatiDi = (n) => Array.from({ length: n }, (_, i) => ({ slug: nome(i), stato: "archiviato" }));
  const verificaSlugs = (sv) => sv.log.filter((x) => x.azione === "prodotti_importa_verifica").flatMap((x) => x.dati.slugs);
  // Dopo l'anteprima, da un'altra scheda: p-03 è rimesso in bozza, p-10 e p-44 pubblicati.
  const v1 = serverFinto({ catalogo: archiviatiDi(45) });
  v1.db.get("p-03").stato = "bozza"; v1.db.get("p-10").stato = "pubblicato"; v1.db.get("p-44").stato = "pubblicato";
  const inizioV = F.avviaImporta(nuoviP, A.dalCestino);
  const nPrima = v1.log.length;
  const ver = await F.riverificaCestino(A, inizioV, v1.esegui);
  c("a «Importa» si rifà la SOLA verifica: una richiesta di sola lettura (gli indirizzi dei 45, nessuno SKU), nessuna scrittura", [1, "prodotti_importa_verifica", 45, [], 0], [v1.log.length - nPrima, v1.log[nPrima].azione, v1.log[nPrima].dati.slugs.length, v1.log[nPrima].dati.skus, v1.scritture().length]);
  c("i 3 non più archiviati escono dai pezzi (42 → 20, 20, 2) e dal Cestino dell'analisi, ed entrano tra i già presenti (3 + 3)", [[20, 20, 2], 42, 6, ["p-03", "p-10", "p-44"], 2], [ver.stato.ripristino.map((p) => p.prodotti.length), ver.analisi.dalCestino.length, ver.analisi.giaPresenti.length, ver.analisi.giaPresenti.slice(3).map((g) => g.handle), ver.stato.gruppi.length + 1]);
  c("l'analisi di partenza non è modificata (copia, non cambio sul posto)", [45, 3], [A.dalCestino.length, A.giaPresenti.length]);
  const fineV = await F.eseguiGruppi(ver.stato, invia(v1), { rimetti: rimetti(v1) });
  const idsMandati = new Set(v1.rimetti().flatMap((x) => x.dati.ids));
  c("`gruppo_stato` parte solo per i 42 ancora archiviati: 3 richieste (20, 20, 2), mai per p-03, p-10, p-44; il pubblicato resta pubblicato", [[20, 20, 2], 42, false, "pubblicato", "bozza"], [v1.rimetti().map((x) => x.dati.ids.length), idsMandati.size, ["id-p-03", "id-p-10", "id-p-44"].some((id) => idsMandati.has(id)), v1.db.get("p-10").stato, v1.db.get("p-00").stato]);
  const rieV = F.riepilogoFinale(ver.analisi, fineV);
  c("riepilogo: tornati 42, saltati 6 (i 3 presenti e i 3 cambiati nel frattempo), importati 2, respinti 0", [42, 6, 2, 0], [rieV.ripristinati, rieV.saltati, rieV.importati, rieV.respinti]);
  const fotoV = Foto.avviaFoto({ ...ver.analisi, lettura: { prodotti: [], foto: new Map(A.dalCestino.map((g) => [g.handle, [{ url: "https://cdn.shopify.com/a.jpg", alt: "", posizione: 1, riga: 2 }]])) } }, fineV);
  c("le foto: partono per i 42 tornati e per i 3 cambiati nel frattempo (ora «già presenti»), 45 prodotti, senza doppioni", [45, true], [fotoV.prodotti.length, ["p-03", "p-10", "p-44"].every((h) => fotoV.prodotti.some((p) => p.handle === h))]);
  const v2 = serverFinto({ catalogo: archiviatiDi(45) });
  const uguale = await F.riverificaCestino(A, inizioV, v2.esegui);
  c("se nessuno è cambiato: stato e analisi restano gli stessi (stessi oggetti)", [true, true], [uguale.stato === inizioV, uguale.analisi === A]);
  c("senza pezzi (nessuno dal Cestino) non si chiama il server", [0, true], [await (async () => { const sv = serverFinto(); await F.riverificaCestino(A, F.avviaImporta(nuoviP), sv.esegui); return sv.log.length; })(), true]);
  // La verifica non arriva: niente scritto, si ferma con la frase, «Riprendi» riprova
  let rotta = true;
  const v3 = serverFinto({ catalogo: archiviatiDi(45) });
  const esegui3 = async (a, d) => (rotta && a === "prodotti_importa_verifica" ? { ok: false, errore: { tipo: "rete", messaggio: "Non riesco a collegarmi al server." } } : v3.esegui(a, d));
  const nonArriva = await F.riverificaCestino(A, inizioV, esegui3);
  const fermata = await F.eseguiGruppi(nonArriva.stato, invia(v3), { rimetti: rimetti(v3) });
  c("verifica che non arriva: fermo con la frase del server, nessuna scrittura, nessun pezzo né gruppo partito", [true, "rete", "Non riesco a collegarmi al server.", 0], [fermata.fermo !== null, fermata.fermo?.tipo, fermata.fermo?.messaggio, v3.scritture().length]);
  rotta = false;
  const ripresa = await F.riverificaCestino(A, F.riprendi(fermata), esegui3);
  const fineR = await F.eseguiGruppi(ripresa.stato, invia(v3), { rimetti: rimetti(v3) });
  c("«Riprendi»: rifà la verifica, poi i pezzi e i nuovi: 45 tornati, 2 importati, nessun fermo", [null, 45, 2], [fineR.fermo, F.riepilogoFinale(A, fineR).ripristinati, F.riepilogoFinale(A, fineR).importati]);
  const v4 = serverFinto({ catalogo: archiviatiDi(45), guasti: { 2: "rete" } });
  const cadePezzo = await F.eseguiGruppi((await F.riverificaCestino(A, inizioV, v4.esegui)).stato, invia(v4), { rimetti: rimetti(v4) });
  v4.db.get("p-44").stato = "pubblicato"; // mentre la finestra è ferma, qualcuno pubblica un prodotto dell'ultimo pezzo
  const nV = verificaSlugs(v4).length;
  const dopo = await F.riverificaCestino(A, F.riprendi(cadePezzo), v4.esegui);
  c("a «Riprendi» la verifica riguarda solo i pezzi ancora da fare (25, non i 20 già fatti) e il pubblicato nel frattempo non si tocca", [25, 24, ["fatto", "da_fare", "da_fare"]], [verificaSlugs(v4).length - nV, dopo.stato.ripristino.reduce((n, p) => n + (p.stato === "fatto" ? 0 : p.prodotti.length), 0), dopo.stato.ripristino.map((p) => p.stato)]);
  const dopoFine = await F.eseguiGruppi(dopo.stato, invia(v4), { rimetti: rimetti(v4) });
  c("…e completata la ripresa p-44 è ancora pubblicato, gli altri 44 sono in bozza", ["pubblicato", 44], [v4.db.get("p-44").stato, [...v4.db.values()].filter((p) => p.stato === "bozza").length]);

  // ════ LE FOTO: dal Cestino come i già presenti ════
  const conFoto = { nuovi: [], giaPresenti: [], dalCestino: A.dalCestino.slice(0, 3), lettura: { prodotti: [], foto: new Map(A.dalCestino.slice(0, 3).map((g) => [g.handle, [{ url: "https://cdn.shopify.com/a.jpg", alt: "", posizione: 1, riga: 2 }]])) } };
  c("anteprima: le foto dei prodotti dal Cestino si contano (3 foto)", 3, Foto.fotoPreviste(conFoto));
  const fp = Foto.avviaFoto(conFoto, fine2);
  c("dopo il rimettere in bozza le foto partono per gli stessi prodotti, come «già presenti» (si controlla se ne hanno già)", [3, [true, true, true], [false, false, false]], [fp.prodotti.length, fp.prodotti.map((p) => p.giaPresente), fp.prodotti.map((p) => p.controllato)]);
  c("un prodotto dal Cestino che era anche nell'elenco dei presenti non conta due volte", 3, Foto.avviaFoto({ ...conFoto, giaPresenti: A.dalCestino.slice(0, 1) }, fine2).prodotti.length);

  // ════ I TRE PASSI ════
  const resa = async (file, nomeC, props) => (await rendiComponente(radice, join(DIR, file), nomeC, props)).html;
  const p2 = (analisi) => resa("PassoControllo.tsx", "PassoControllo", { analisi, apriProdotto: nulla, cambiaFile: nulla, scaricaErrori: nulla, importa: nulla });
  const h2 = await p2(rt.analisi);
  c("passo 2, tutto nel Cestino: il riepilogo dice «45 dal Cestino (tornano in bozza)», nessun «già presenti»", [true, false], [leggibile(h2).includes("nessun nuovo · 45 dal Cestino (tornano in bozza) · 0 errori"), /già presenti/.test(leggibile(h2))]);
  c("passo 2: ogni riga dice «Nel Cestino» (stessa forma del distintivo «Già presente») col collegamento «Apri il prodotto»", [45, 45, 0], [(h2.match(/>Nel Cestino</g) ?? []).length, (h2.match(/Apri il prodotto<span class="sr-only"> Titolo p-\d\d<\/span>/g) ?? []).length, (h2.match(/>Già presente</g) ?? []).length]);

  c("passo 2: il tasto è acceso e dice «Importa 45 prodotti in bozza» (non «Carica N foto»), uno solo pieno, nessuna frase di tasto spento", [true, 1, false, false], [!spento(tasto(h2, "Importa 45 prodotti in bozza")), pieni(h2), /Carica \d+ foto/.test(leggibile(h2)), /Non c'è niente di nuovo da importare/.test(leggibile(h2))]);
  const hm = await p2(A);
  c("passo 2, misto: «Importa 47 prodotti in bozza» (2 nuovi + 45 dal Cestino), «Già presente» solo sui 3 presenti, «Nel Cestino» sui 45", [true, 3, 45], [leggibile(hm).includes("Importa 47 prodotti in bozza"), (hm.match(/>Già presente</g) ?? []).length, (hm.match(/>Nel Cestino</g) ?? []).length]);
  const classi = (t) => hm.match(new RegExp(`<span class="([^"]*)">${t}</span>`))?.[1];
  c("passo 2: il distintivo «Nel Cestino» ha le stesse classi del «Già presente»", [true, true], [!!classi("Nel Cestino"), classi("Nel Cestino") === classi("Già presente")]);
  c("passo 2: senza funzione per aprirlo, nessun collegamento falso", false, /Apri il prodotto/.test(await resa("PassoControllo.tsx", "PassoControllo", { analisi: rt.analisi, cambiaFile: nulla, scaricaErrori: nulla, importa: nulla })));
  const hs = await p2(rs.analisi);
  c("passo 2, solo presenti non archiviati: resta «Già presente», tasto spento con la frase, nessun «Nel Cestino»", [true, true, false], [(hs.match(/>Già presente</g) ?? []).length === 2, leggibile(hs).includes("Non c'è niente di nuovo da importare"), />Nel Cestino</.test(hs)]);
  const h3 = (stato, analisi = A, extra = {}) => resa("PassoImporta.tsx", "PassoImporta", { analisi, stato, inCorso: false, interrompi: nulla, riprendi: nulla, scaricaErrori: nulla, vaiAiProdotti: nulla, chiudi: nulla, ...extra });
  const hf = await h3(fine);
  c("passo 3, finito: la frase con «Rimessi in bozza dal Cestino 45», «Vai ai prodotti importati» pieno", [true, 1, true], [leggibile(hf).includes("Importati 2 prodotti (tutti in bozza). Rimessi in bozza dal Cestino 45. Saltati 3 già presenti. Respinti 0 con errori."), pieni(hf), leggibile(hf).includes("Vai ai prodotti importati")]);
  const hSolo = await h3(fine2, { ...A, nuovi: [] });
  c("passo 3, solo dal Cestino: la frase parte da «Rimessi in bozza dal Cestino 45» (mai «Importati 0»), il tasto pieno porta ai prodotti (non «Chiudi»)", [true, false, true, 1], [leggibile(hSolo).includes("Rimessi in bozza dal Cestino 45. Saltati 3 già presenti. Respinti 0 con errori."), /Importati 0/.test(leggibile(hSolo)), leggibile(hSolo).includes("Vai ai prodotti importati"), pieni(hSolo)]);
  c("fraseFinale con 0 importati e 45 tornati; con 1 solo tornato; con importati e tornati; senza tornati (come prima)", ["Rimessi in bozza dal Cestino 45. Saltati 3 già presenti. Respinti 0 con errori.", "Rimesso in bozza dal Cestino 1. Saltati 0 già presenti. Respinti 0 con errori.", "Importato 1 prodotto (in bozza). Rimessi in bozza dal Cestino 45. Saltati 0 già presenti. Respinti 0 con errori.", "Importati 0 prodotti (tutti in bozza). Saltati 0 già presenti. Respinti 0 con errori."], [F.fraseFinale({ importati: 0, ripristinati: 45, saltati: 3, respinti: 0 }), F.fraseFinale({ importati: 0, ripristinati: 1, saltati: 0, respinti: 0 }), F.fraseFinale({ importati: 1, ripristinati: 45, saltati: 0, respinti: 0 }), F.fraseFinale({ importati: 0, ripristinati: 0, saltati: 0, respinti: 0 })]);
  const annuncio = (h) => h.match(/<p class="sr-only" role="status">([^<]*)<\/p>/)?.[1];
  c("passo 3: la barra e l'annuncio per lo screen reader sono neutri («Fatti 45 di 45 prodotti»), non «Importati»", ["Fatti 45 di 45 prodotti", true, false], [annuncio(hSolo), /aria-label="Fatti 45 di 45 prodotti"/.test(hSolo), /Importati 45 di 45/.test(hSolo)]);
  const hCorso = await h3({ ...parz, fermo: null }, A, { inCorso: true });
  c("passo 3, in corso: il testo non dice «cinque alla volta» (i pezzi del Cestino sono da 20) e dice che i prodotti entrano a gruppi", [false, true], [/cinque alla volta/.test(leggibile(hCorso)), leggibile(hCorso).includes("i prodotti entrano a gruppi")]);
  const hp = await h3(parz);
  c("passo 3, pezzo fallito: «L'importazione si è fermata» con la frase del server, «Riprendi» (uno solo pieno), 20 di 47", [true, true, 1, true], [leggibile(hp).includes("L'importazione si è fermata") && leggibile(hp).includes("Non riesco a collegarmi al server."), leggibile(hp).includes("Riprendi"), pieni(hp), leggibile(hp).includes("20 di 47 prodotti")]);
  c("passo 3: nessuna parola vietata nel testo", [], trovaParoleVietate(leggibile(h2 + hm + hs + hf + hSolo + hp)));
  const p1 = await resa("PassoScegli.tsx", "PassoScegli", { leggo: false, scegli: nulla, scaricaModello: nulla });
  c("passo 1: «Un prodotto con un indirizzo già presente viene saltato… quelli nel Cestino tornano in bozza»", [true, true], [leggibile(p1).includes("Un prodotto con un indirizzo già presente viene saltato, mai aggiornato"), /quelli (che sono )?nel Cestino tornano in bozza/.test(leggibile(p1))]);

  // ════ IL SORGENTE: la finestra usa la stessa azione e gli stessi pezzi dell'elenco, non una copia ════
  const fin = senzaCommenti(readFileSync(join(radice, DIR, "FinestraImporta.tsx"), "utf8"));
  const flu = senzaCommenti(readFileSync(join(radice, DIR, "importa-flusso.ts"), "utf8"));
  const rip = senzaCommenti(readFileSync(join(radice, DIR, "importa-ripristino.ts"), "utf8"));
  c("la finestra manda `gruppo_stato` con stato «bozza» da negozio.esegui (nessun'altra rete)", [true, true], [/negozio\.esegui\(AZIONE_RIMETTI, \{ ids, stato: "bozza" \}\)/.test(fin), /AZIONE_RIMETTI = "gruppo_stato"/.test(flu)]);
  c("i pezzi da 20 sono quelli dell'elenco: `aGruppi` di elenco-puro, nessun 20 scritto qui", [true, false], [/aGruppi\(/.test(rip) && /elenco-puro/.test(rip), /\b20\b/.test(rip + flu)]);
  c("la finestra rifà la verifica in `manda` (quindi a «Importa» e a «Riprendi»), prima di eseguiGruppi, e scarta i risultati di un giro vecchio", [true, true], [/riverificaCestino\(analisi0, inizio0, negozio\.esegui\)/.test(fin) && fin.indexOf("riverificaCestino(") < fin.indexOf("eseguiGruppi(\n"), /riverificaCestino[\s\S]{0,120}if \(mio !== giro\.current\) return;/.test(fin)]);
}
