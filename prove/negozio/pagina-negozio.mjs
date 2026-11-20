/** ── NEGOZIO · T14 · LA LINGUETTA «PRODOTTI» E L'ELENCO ─────────────────────
 *  `src/routes/CRM.ecommerce.tsx` aggiunge la linguetta «Prodotti» (`?scheda=prodotti`, `&id=…`); l'elenco sta in
 *  `src/crm/ecommerce/prodotti/ElencoProdotti.tsx`; le regole che si possono provare senza React (ordine, ricerca,
 *  chip di stato, SKU della copia, riepilogo delle azioni di gruppo) sono in `elenco-puro.ts`, compilato qui con esbuild.
 *  I cinque segnaposto (`SchedaProdotto`, `EditorVarianti`, `EditorMedia`, `Categorie`, `ApriShop`) devono ritornare
 *  `null` e portare in cima il contratto delle props per T15, T16 e T17.
 *  Il resto si prova sul SORGENTE (le schermate non si eseguono qui): nessuna lettura del CMS fuori dalla linguetta,
 *  nessuna cancellazione, nessun prezzo barrato, `CRMSidebar.tsx` e `permessi.ts` non toccati. Dati inventati. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";

/** Il commit da cui parte T14 (ramo `shop-r1-k` con T09, T10 e T13 approvati). */
const BASE = "860a5f0";
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const caricaTs = (percorso) =>
  import(`data:text/javascript;base64,${Buffer.from(transformSync(readFileSync(percorso, "utf8"), { loader: "ts", format: "esm" }).code).toString("base64")}`);
const caricaTsx = (percorso) =>
  import(`data:text/javascript;base64,${Buffer.from(transformSync(readFileSync(percorso, "utf8"), { loader: "tsx", format: "esm", jsx: "automatic" }).code).toString("base64")}`);

/** Il corpo di una funzione `function Nome(...) {` fino alla graffa che la chiude (conta le graffe). */
function corpoDi(src, nome) {
  const i = src.indexOf(`function ${nome}(`);
  if (i < 0) return null;
  const inizio = src.indexOf("{", src.indexOf(")", i));
  let n = 0;
  for (let k = inizio; k < src.length; k++) {
    if (src[k] === "{") n++;
    else if (src[k] === "}" && --n === 0) return src.slice(inizio, k + 1);
  }
  return null;
}

const riga = (id, extra = {}) => ({
  id, sku: id.toUpperCase(), slug: id, nome: id, tipo: "patch", stato: "bozza", origine: null, prezzoCent: 0, versione: "2026-11-20T10:00:00.000Z", haModifiche: false, motivo: null, ...extra,
});

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · T14 · LINGUETTA «PRODOTTI» E ELENCO (20/11/2026)");
  const dir = join(radice, "src/crm/ecommerce/prodotti");
  const pagina = join(radice, "src/routes/CRM.ecommerce.tsx");
  const puroPath = join(dir, "elenco-puro.ts");

  // ── le regole pure ──
  const P = existsSync(puroPath) ? await caricaTs(puroPath) : {};
  const ok = (f) => typeof f === "function";
  c("elenco-puro.ts esporta le funzioni che l'elenco usa", true, ["cercaRighe", "ordinaRighe", "chipProdotto", "proponiSkuCopia", "riepilogoGruppo", "riepilogoDuplica", "prezzoDaCent"].every((n) => ok(P[n])) && P.MAX_GRUPPO === 20);

  if (ok(P.cercaRighe)) {
    const r = [riga("a1", { nome: "Patch Rosa", sku: "HG-T01" }), riga("a2", { nome: "Cura notte", sku: "HG-C02" }), riga("a3", { nome: "Kit ROSA", sku: "HG-K03" })];
    c("cerca per nome, senza badare alle maiuscole né agli spazi attorno", ["a1", "a3"], P.cercaRighe(r, "  rosa ").map((x) => x.id));
    c("cerca per SKU", ["a2"], P.cercaRighe(r, "hg-c02").map((x) => x.id));
    c("ricerca vuota: tutte, nello stesso ordine", ["a1", "a2", "a3"], P.cercaRighe(r, "   ").map((x) => x.id));
    c("nessuna corrispondenza: elenco vuoto", [], P.cercaRighe(r, "zzz"));
  }
  if (ok(P.ordinaRighe)) {
    const r = [riga("b", { nome: "Zeta", prezzoCent: 3000, stato: "archiviato" }), riga("a", { nome: "alfa", prezzoCent: 1000, stato: "pubblicato" }), riga("c", { nome: "Beta 10", prezzoCent: 2000, stato: "bozza" }), riga("d", { nome: "Beta 2", prezzoCent: 2000, stato: "bozza" })];
    const copia = JSON.stringify(r);
    c("per nome: ordine italiano senza badare alle maiuscole, numeri «naturali» (2 prima di 10)", ["a", "d", "c", "b"], P.ordinaRighe(r, "nome", "su").map((x) => x.id));
    c("per nome, al contrario", ["b", "c", "d", "a"], P.ordinaRighe(r, "nome", "giu").map((x) => x.id));
    c("per prezzo crescente: a parità decide il nome (sempre lo stesso ordine)", ["a", "d", "c", "b"], P.ordinaRighe(r, "prezzo", "su").map((x) => x.id));
    c("per stato: pubblicati, bozze, archiviati", ["a", "d", "c", "b"], P.ordinaRighe(r, "stato", "su").map((x) => x.id));
    c("non cambia l'elenco che riceve", copia, JSON.stringify(r));
    c("una colonna che non esiste: l'elenco com'è (nessun errore)", ["b", "a", "c", "d"], P.ordinaRighe(r, "boh", "su").map((x) => x.id));
  }
  if (ok(P.chipProdotto)) {
    const chip = (x) => P.chipProdotto(riga("x", x));
    c("pubblicato e a posto: «Pubblicato», nessuna ragione", ["Pubblicato", "ok", null], [chip({ stato: "pubblicato" }).etichetta, chip({ stato: "pubblicato" }).tono, chip({ stato: "pubblicato" }).ragione]);
    c("bozza con un motivo: «Bozza» e la PRIMA ragione scritta", ["Bozza", "Manca la foto principale."], [chip({ motivo: "Manca la foto principale." }).etichetta, chip({ motivo: "Manca la foto principale." }).ragione]);
    c("pubblicato ma non più a posto: resta «Pubblicato», con la ragione e tono di attenzione", ["Pubblicato", "attenzione", "Manca il prezzo."], [chip({ stato: "pubblicato", motivo: "Manca il prezzo." }).etichetta, chip({ stato: "pubblicato", motivo: "Manca il prezzo." }).tono, chip({ stato: "pubblicato", motivo: "Manca il prezzo." }).ragione]);
    c("archiviato: «Archiviato», spento, nessuna ragione (non c'è niente da sistemare)", ["Archiviato", "spento", null], [chip({ stato: "archiviato", motivo: "x" }).etichetta, chip({ stato: "archiviato", motivo: "x" }).tono, chip({ stato: "archiviato", motivo: "x" }).ragione]);
    c("vecchio catalogo: «Vecchio catalogo», senza ragione", ["Vecchio catalogo", null], [chip({ origine: "codice", motivo: "x" }).etichetta, chip({ origine: "codice", motivo: "x" }).ragione]);
    c("modifiche non pubblicate: il chip lo dice", true, chip({ stato: "pubblicato", haModifiche: true }).modifiche === true && chip({ stato: "pubblicato" }).modifiche === false);
  }
  if (ok(P.proponiSkuCopia)) {
    const reSku = /^[A-Z0-9][A-Z0-9._-]{1,39}$/;
    c("lo SKU della copia: quello vecchio più «-COPIA»", "HG-T01-COPIA", P.proponiSkuCopia("HG-T01", []));
    c("se è occupato aggiunge un numero", "HG-T01-COPIA2", P.proponiSkuCopia("HG-T01", ["HG-T01-COPIA"]));
    c("…e va avanti finché trova un posto libero", "HG-T01-COPIA4", P.proponiSkuCopia("HG-T01", new Set(["HG-T01-COPIA", "HG-T01-COPIA2", "HG-T01-COPIA3"])));
    const lungo = P.proponiSkuCopia("A".repeat(40), ["A".repeat(34) + "-COPIA"]);
    c("con uno SKU di 40 segni la copia resta di 40 al massimo e valida (la regola di modello.ts)", [true, true], [lungo.length <= 40, reSku.test(lungo)]);
    c("la copia non è mai uguale all'originale né a uno occupato", true, lungo !== "A".repeat(40) && lungo !== "A".repeat(34) + "-COPIA");
  }
  if (ok(P.riepilogoGruppo)) {
    const nomi = { a: "Patch Rosa", b: "Cura notte", c: "Kit" };
    const r = P.riepilogoGruppo("pubblicato", ["a", "b", "c"], { pubblicati: 1, restano: [{ id: "b", motivo: "Manca la foto principale." }, { id: "c", motivo: "Manca il prezzo." }] }, nomi);
    c("pubblicazione di gruppo: dice quanti sono usciti e chi è rimasto fuori, con il perché", [1, [["Cura notte", "Manca la foto principale."], ["Kit", "Manca il prezzo."]]], [r.cambiati, r.fuori.map((x) => [x.nome, x.motivo])]);
    c("…la frase parla di «1 prodotto pubblicato» e di quanti sono rimasti fuori", [true, true], [/1 prodotto pubblicato/i.test(r.riga), /2/.test(r.riga) && /fuori/i.test(r.riga)]);
    const tutti = P.riepilogoGruppo("bozza", ["a", "b"], { bozze: 2, restano: [] }, nomi);
    c("tutti in bozza: «2 prodotti messi in bozza», nessuno fuori", [2, [], true], [tutti.cambiati, tutti.fuori, /2 prodotti messi in bozza/i.test(tutti.riga)]);
    const gia = P.riepilogoGruppo("bozza", ["a", "b", "c"], { bozze: 1, restano: [] }, nomi);
    c("chi era già in bozza non è «rimasto fuori»: la frase lo dice a parte", [true, 0], [/già/i.test(gia.riga), gia.fuori.length]);
    const storta = P.riepilogoGruppo("pubblicato", ["a"], { restano: "boh" }, nomi);
    c("una risposta storta non rompe il riepilogo: 0 cambiati, nessuno fuori", [0, []], [storta.cambiati, storta.fuori]);
    const senzaNome = P.riepilogoGruppo("pubblicato", ["zz"], { pubblicati: 0, restano: [{ id: "zz", motivo: "Manca il prezzo." }] }, nomi);
    c("un id senza nome noto resta leggibile (mai «undefined»)", false, /undefined/.test(JSON.stringify(senzaNome)));
  }
  if (ok(P.riepilogoDuplica)) {
    const r = P.riepilogoDuplica([{ id: "a", ok: true }, { id: "b", ok: false, frase: "Lo SKU è già usato." }], { a: "Patch", b: "Cura" });
    c("duplica: quanti sono stati copiati e chi è rimasto fuori con la frase del server", [1, [["Cura", "Lo SKU è già usato."]]], [r.cambiati, r.fuori.map((x) => [x.nome, x.motivo])]);
    c("…e la frase dice «1 prodotto duplicato»", true, /1 prodotto duplicato/i.test(r.riga));
  }
  if (ok(P.prezzoDaCent)) {
    c("prezzo: da centesimi a euro all'italiana, mai con decimali persi", ["€ 12,90", "€ 0,00", "€ 12.345,67"], [P.prezzoDaCent(1290), P.prezzoDaCent(0), P.prezzoDaCent(1234567)]);
    c("un numero storto non diventa «NaN»", "€ 0,00", P.prezzoDaCent(Number.NaN));
  }

  // ── la pagina: la linguetta e le letture ──
  const testoPagina = existsSync(pagina) ? readFileSync(pagina, "utf8") : "";
  const pg = senzaCommenti(testoPagina);
  c("CRM.ecommerce.tsx ha la linguetta «Prodotti» con `scheda: \"prodotti\"`", true, /titolo:\s*"Prodotti"/.test(pg) && /scheda:\s*"prodotti"/.test(pg));
  c("le linguette Panoramica e Ordini ci sono ancora, come prima", true, /scheda:\s*undefined,\s*titolo:\s*"Panoramica"/.test(pg) && /scheda:\s*"ordini",\s*titolo:\s*"Ordini"/.test(pg));
  c("la Panoramica e l'elenco degli ordini sono ancora disegnati come prima", true, /<Panoramica\s+lettura=\{lettura\}\s+periodo=\{periodo\}\s+adesso=\{adesso\}\s+apriStato=\{apriStato\}/.test(pg) && /<ElencoOrdini\b/.test(pg));
  c("l'indirizzo ammette `?scheda=prodotti` e `&id=` (validateSearch)", true, /"prodotti"/.test(pg) && /validateSearch/.test(pg) && /\bid\b/.test(pg));
  c("importa i quattro componenti dei compiti seguenti con i loro nomi (T15, T17 sostituiscono solo i file)", true,
    ["ElencoProdotti", "SchedaProdotto", "Categorie", "ApriShop"].every((n) => new RegExp(`import\\s*\\{\\s*${n}\\s*\\}\\s*from\\s*"@/crm/ecommerce/prodotti/${n}"`).test(pg)));
  const usi = pg.match(/\buseNegozio\(/g) ?? [];
  c("`useNegozio()` si chiama UNA volta sola (un archivio, una rilettura)", 1, usi.length);
  const corpoPagina = corpoDi(pg, "PaginaEcommerce") ?? "";
  c("…e NON nel guscio della pagina: Panoramica e Ordini non leggono mai il CMS", [false, true], [/\buseNegozio\(/.test(corpoPagina), /\buseNegozio\(/.test(corpoDi(pg, "LinguettaProdotti") ?? "")]);
  c("la linguetta dei prodotti si disegna SOLO con `scheda === \"prodotti\"`", true, /scheda\s*===\s*"prodotti"[\s\S]{0,300}<LinguettaProdotti\b/.test(corpoPagina));
  const iBloccato = corpoPagina.indexOf("if (bloccato && lettura.errore)");
  const iProdotti = corpoPagina.indexOf("<LinguettaProdotti");
  c("chi non ha il permesso (o la sessione) vede solo la frase: la linguetta viene DOPO quel `return`", true, iBloccato >= 0 && iProdotti > iBloccato);
  c("la barra del periodo e gli avvisi degli ordini stanno solo nell'altro ramo: la linguetta dei prodotti viene prima, e non li ha", true,
    /scheda\s*===\s*"prodotti"\s*\?\s*\([\s\S]*?<LinguettaProdotti\b[\s\S]*?\)\s*:\s*\(\s*<>[\s\S]*?<DateRangeFilter\b/.test(corpoPagina) && !/<LinguettaProdotti\b[^>]*\/>[\s\S]{0,80}DateRangeFilter/.test(corpoPagina.slice(0, corpoPagina.indexOf("<DateRangeFilter"))));
  c("nessuna riga «console.»: i prodotti non si scrivono nel log", false, /console\./.test(pg));

  // ── il perimetro del compito ──
  let toccati = null;
  try {
    toccati = [
      ...execFileSync("git", ["-C", radice, "diff", "--name-only", BASE], { encoding: "utf8" }).split("\n"),
      ...execFileSync("git", ["-C", radice, "ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\n"),
    ].filter(Boolean);
  } catch {
    toccati = []; // shortcut: il commit di partenza non c'è (repository nuovo): non si può confrontare; si toglie quando BASE non serve più
  }
  c("`CRMSidebar.tsx`, `permessi.ts` e `routeTree.gen.ts` non sono nel diff", [], toccati.filter((f) => /CRMSidebar\.tsx$|crm\/permessi\.ts$|routeTree\.gen\.ts$/.test(f)));
  c("nel diff non c'è nessun file dei compiti di T09, T10 e T13 (client, server, rotte)", [], toccati.filter((f) => /^src\/crm\/negozio\/|^src\/routes\/api\./.test(f)));

  // ── i cinque segnaposto ──
  const FIRME = {
    SchedaProdotto: "T15", EditorVarianti: "T15", EditorMedia: "T16", Categorie: "T17", ApriShop: "T17",
  };
  const PROPS_DI_ESEMPIO = {
    SchedaProdotto: { id: "p1", negozio: {}, apri: () => {} },
    EditorVarianti: { prodotto: { id: "p1", sku: "HG-T01", nome: "Patch", prezzoCent: 1000, pubblicato: false }, varianti: [], esegui: async () => ({ ok: true, dati: {} }), aggiorna: async () => {} },
    EditorMedia: { prodotto: { id: "p1", nome: "Patch", pubblicato: false }, media: [], esegui: async () => ({ ok: true, dati: {} }), aggiorna: async () => {} },
    Categorie: { categorie: () => Promise.resolve({ ok: true, dati: {} }), esegui: async () => ({ ok: true, dati: {} }) },
    ApriShop: { interruttori: () => Promise.resolve({ ok: true, dati: {} }), esegui: async () => ({ ok: true, dati: {} }) },
  };
  for (const [nome, compito] of Object.entries(FIRME)) {
    const p = join(dir, `${nome}.tsx`);
    const esiste = existsSync(p);
    const testo = esiste ? readFileSync(p, "utf8") : "";
    c(`${nome}.tsx esiste ed esporta \`${nome}\` con la firma finale`, true, esiste && new RegExp(`export function ${nome}\\(`).test(testo));
    //  T15 ha riempito SchedaProdotto ed EditorVarianti: «ritorna null» e «nessun import» valgono solo per i segnaposto che restano (T16, T17).
    //  La firma di quei due la controlla `scheda-sorgente.mjs`.
    const m = esiste && compito !== "T15" ? await caricaTsx(p).catch(() => ({})) : {};
    if (compito !== "T15")
    c(`${nome} ritorna null (segnaposto: lo riempie ${compito})`, null, typeof m[nome] === "function" ? m[nome](PROPS_DI_ESEMPIO[nome]) : "non è una funzione");
    const testa = testo.slice(0, testo.indexOf("*/") + 2);
    c(`${nome}: in cima c'è il commento con le props pensate per ${compito}`, [true, true], [new RegExp(compito).test(testa), /props/i.test(testa) && /export interface Props/.test(testo)]);
    if (compito !== "T15")
    c(`${nome}: nessun import di React o di moduli del CRM (un segnaposto non porta pesi)`, false, /^\s*import\s+(?!type\b)/m.test(senzaCommenti(testo)));
  }

  // ── l'elenco ──
  const elencoPath = join(dir, "ElencoProdotti.tsx");
  const testoElenco = existsSync(elencoPath) ? readFileSync(elencoPath, "utf8") : "";
  const el = senzaCommenti(testoElenco);
  c("ElencoProdotti.tsx esiste ed esporta `ElencoProdotti`", true, /export function ElencoProdotti\(/.test(el));
  c("i cinque segmenti del Design (Tutti, Pubblicati, Bozze, Da sistemare, Vecchio catalogo) si leggono dal client", true,
    /SEGMENTI\.map/.test(el) && /ETICHETTE_SEGMENTO\[/.test(el));
  c("…e le etichette sono quelle del Design, nell'ordine", ["Tutti", "Pubblicati", "Bozze", "Da sistemare", "Vecchio catalogo"], P.ETICHETTE_SEGMENTO && ["tutti", "pubblicati", "bozze", "da_sistemare", "vecchio_catalogo"].map((k) => P.ETICHETTE_SEGMENTO[k]));
  c("stato vuoto con la frase del Design", true, el.includes("Non c'è ancora nessun prodotto."));
  c("errore con «Riprova»", true, el.includes("Riprova") && /aggiorna/.test(el));
  c("scheletri mentre si legge (`role=\"status\"`, `aria-busy`)", true, /role="status"/.test(el) && /aria-busy/.test(el) && /animate-pulse/.test(el));
  c("database non pronto (S1 mancante) o cancello: un messaggio chiaro, non un errore generico", true, /"migrazione"/.test(el) && /"cancello"/.test(el));
  c("sul telefono: card al posto della tabella e tasto fisso «Nuovo prodotto»", true, /md:hidden/.test(el) && /hidden md:/.test(el) && /fixed/.test(el) && el.includes("Nuovo prodotto"));
  c("la giacenza si cambia dalla riga con `giacenza_imposta`", true, /"giacenza_imposta"/.test(el));
  c("le azioni di gruppo usano `gruppo_stato`, `prodotto_duplica`, e il vecchio catalogo `prodotto_adotta`; il nuovo `prodotto_crea`", true,
    ["gruppo_stato", "prodotto_duplica", "prodotto_adotta", "prodotto_crea"].every((a) => el.includes(`"${a}"`)));
  c("i canali S M G T ci sono", true, ["S", "M", "G", "T"].every((l) => new RegExp(`["'>]${l}["'<]`).test(el)) && /canali/.test(el));
  c("nessuna cancellazione, nessun prezzo barrato, nessuna stella, nessun «best seller»", false, /\bdelete\b|Elimina|compareAt|barrato|sconto|rating|reviews|stelle|best.?seller/i.test(el));
  c("le colonne si ordinano (`aria-sort`) e le caselle hanno un nome per chi non vede", true, /aria-sort/.test(el) && /aria-label/.test(el));
  c("nessun log: i prodotti non vanno in console", false, /console\./.test(el));
}
