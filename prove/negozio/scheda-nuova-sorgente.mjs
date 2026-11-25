/** ── EDITOR PRODOTTI · E9 · LA SCHEDA NUOVA E GLI INGRESSI DALL'ELENCO ───────────────────────────────────────
 *  `src/crm/ecommerce/prodotti/SchedaNuova.tsx` (la scheda vuota: non scrive finché non si preme «Salva bozza»), `scheda-nuova-puro.ts`
 *  (le sue regole senza schermo: proposte dal titolo, la richiesta `prodotto_crea`, la riprova su «duplicato», `parziale`) e
 *  `ElencoProdotti.tsx` («Aggiungi prodotto», «Importa», il bottone fisso sul telefono).
 *  ① il sorgente (niente rete diretta, parole vietate, tetto di righe, il controllo di `slug: slugDa(` e della riprova, spostato qui da
 *  `pagina-negozio.mjs`); ② le regole pure e la VERA `prodotto_crea` sul finto del database; ③ il disegno con `react-dom/server`
 *  (gli effetti e i clic veri non girano: `gestore()` chiama la funzione del clic con lo stato di partenza, cioè con la scheda vuota).
 *  Dati inventati, nessuna rete. */
import { build } from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tabelleProva, uuid } from "./dati.mjs";
import { trovaParoleVietate } from "./_dati-vetrina.mjs";
import { gestore, rendiComponente } from "./_rende.mjs";

const DIR = "src/crm/ecommerce/prodotti";
const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const conta = (html, re) => (html.match(re) ?? []).length;
const tasti = (html) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);
const PIENO = "bg-primary text-primary-foreground";

/** Il corpo di una funzione `function Nome(...) {` fino alla graffa che la chiude (conta le graffe). Lo stesso di `pagina-negozio.mjs`. */
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

const ADESSO = new Date("2026-11-25T12:00:00.000Z");
const CAT = uuid(0x100);
const PRODOTTI_DI_PARTENZA = tabelleProva().shop_prodotti.length;

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E9 · SCHEDA NUOVA E INGRESSI DALL'ELENCO (25/11/2026)");
  const file = { scheda: join(radice, DIR, "SchedaNuova.tsx"), puro: join(radice, DIR, "scheda-nuova-puro.ts"), elenco: join(radice, DIR, "ElencoProdotti.tsx") };
  c("SchedaNuova.tsx e scheda-nuova-puro.ts esistono", [true, true], [existsSync(file.scheda), existsSync(file.puro)]);
  const sorgente = Object.fromEntries(Object.entries(file).map(([k, p]) => [k, existsSync(p) ? readFileSync(p, "utf8") : ""]));
  const { scheda, puro, elenco } = sorgente;
  const k = { scheda: senzaCommenti(scheda), puro: senzaCommenti(puro), elenco: senzaCommenti(elenco) };

  // ════ ① IL SORGENTE ════
  for (const nome of ["scheda", "puro"]) {
    const s = sorgente[nome];
    const etichetta = nome === "scheda" ? "SchedaNuova.tsx" : "scheda-nuova-puro.ts";
    c(`${etichetta}: sotto le 450 righe`, true, s.split("\n").length > 1 && s.split("\n").length < 450);
    c(`${etichetta}: nessun fetch( diretto, nessun fetchCRM, nessun XMLHttpRequest`, false, /\bfetch\(|fetchCRM|XMLHttpRequest|sendBeacon/.test(k[nome]));
    c(`${etichetta}: nessun innerHTML, nessun console, nessun localStorage/sessionStorage`, false, /innerHTML|outerHTML|dangerouslySetInnerHTML|console\.|localStorage|sessionStorage/.test(k[nome]));
    for (const vietato of [/compareAt/i, /prezzo\s+barrato/i, /\brating\b/i, /best\s*seller/i, /\bstelle\b/i, /sconto/i, /\bdelete\b/, /Elimina/, /parseFloat/, /\*\s*100\b/])
      c(`${etichetta}: nessuna occorrenza di ${vietato}`, false, vietato.test(k[nome]));
  }
  // il controllo che stava in `pagina-negozio.mjs` (riga 233), spostato INTERO: la stessa regex, ora sul codice che crea il prodotto
  // (la logica sta in `scheda-nuova-puro.ts`, `creaBozza`, per poterla provare contro il server vero)
  c("«prodotto_crea» riceve l'indirizzo (`slug: slugDa(`) e, se è «duplicato», riprova UNA volta con nome e SKU",
    true, /slug:\s*slugDa\(/.test(puro) && /"duplicato"[\s\S]{0,160}slugDa\(`\$\{[^}]*\}\s+\$\{[^}]*\}`\)/.test(corpoDi(puro, "creaBozza") ?? ""));
  c("«prodotto_crea» sta in `creaBozza` (la richiesta e la sua riprova), non nella scheda né nell'elenco", [2, 0, 0], [conta(corpoDi(k.puro, "creaBozza") ?? "", /"prodotto_crea"/g), conta(k.scheda, /"prodotto_crea"/g), conta(k.elenco, /"prodotto_crea"/g)]);
  c("la scheda nuova passa da `creaBozza(negozio.esegui, …)`: nessun'altra scrittura", [true, 1], [/creaBozza\(negozio\.esegui,/.test(k.scheda), conta(k.scheda, /negozio\.esegui/g)]);
  /** Il testo di ogni `useEffect(…)`: dalla parentesi che si apre a quella che la chiude. */
  const effetti = [...k.scheda.matchAll(/useEffect\(/g)].map((m) => { let n = 0, i = m.index + 10; for (; i < k.scheda.length; i++) { if (k.scheda[i] === "(") n++; else if (k.scheda[i] === ")" && n-- === 0) break; } return k.scheda.slice(m.index, i); });
  c("all'apertura la scheda LEGGE soltanto le categorie: negli effetti nessuna scrittura (né creaBozza né esegui)", [true, 0], [/= negozio\.categorie;/.test(k.scheda) && effetti.some((e) => /leggiCategorie\(\)/.test(e)), effetti.filter((e) => /creaBozza|esegui/.test(e)).length]);
  c("la scheda nuova usa i riquadri di `scheda/` (titolo, foto, prezzo, giacenza, spedizione, SEO, colonna laterale) e il kit polaris",
    [true, true, true, true, true, true, true, true],
    ["RiquadroTitolo", "RiquadroFoto", "RiquadroPrezzo", "RiquadroGiacenza", "RiquadroSpedizione", "RiquadroSeo", "ColonnaLaterale", "PaginaScheda"].map((n) => new RegExp(`import[^;]*\\b${n}\\b[^;]*from "\\./scheda/`).test(scheda)));
  c("le proposte dal titolo passano da `applicaCambio` (SKU e indirizzo seguono il titolo finché non li cambi a mano)", true, /applicaCambio\(/.test(k.scheda) && /slugDa\(/.test(k.puro) && /propostaSku\(/.test(k.puro));
  c("il tasto «Salva bozza» è uno solo per schermata: pieno dal computer, in una barra fissa sul telefono", [true, true], [/md:hidden/.test(scheda) && /fixed inset-x-0 bottom-0/.test(scheda), /hidden md:/.test(scheda)]);
  c("niente avviso del browser sul testo non salvato (beforeunload, popstate): la scheda vuota non ha nulla da perdere di nascosto", false, /beforeunload|popstate|onbeforeunload|history\./.test(k.scheda));

  // ════ ② LE REGOLE PURE ════
  if (!existsSync(file.puro)) return;
  const P = await carica(radice, `${DIR}/scheda-nuova-puro.ts`);
  const V = P.moduloVuoto();
  c("la scheda vuota: tutto vuoto, tipo patch, quattro canali (sito acceso, gli altri spenti)", [true, "patch", { sito: true, meta: false, google: false, tiktok: false }],
    [Object.entries(V).filter(([x]) => !["tipo", "canali", "caratteristiche", "faq", "boxConsulenza"].includes(x)).every(([, v]) => v === ""), V.tipo, V.canali]);
  c("proposta dello SKU: maiuscolo, a trattini, accenti tolti, al massimo 40 segni, mai un trattino in fondo",
    ["LACE-FRONT-SWISS-PU", "CREME-HYDRATANTE", "", true, false],
    [P.propostaSku("Lace Front Swiss + PU"), P.propostaSku("Crème Hydratante"), P.propostaSku("!!!"), P.propostaSku("Un nome davvero molto ma molto lungo per un prodotto di prova").length <= 40, /-$/.test(P.propostaSku("Un nome davvero molto ma molto lungo per un prodotto di prova"))]);
  {
    const a = P.applicaCambio(V, { nome: "Spray Prova" });
    c("scrivendo il titolo si propongono SKU e indirizzo", ["SPRAY-PROVA", "spray-prova", "Spray Prova"], [a.sku, a.slug, a.nome]);
    const b = P.applicaCambio(a, { nome: "Spray Prova Plus" });
    c("…e continuano a seguire il titolo finché non li cambi", ["SPRAY-PROVA-PLUS", "spray-prova-plus"], [b.sku, b.slug]);
    const d = P.applicaCambio(b, { sku: "HG-C01" });
    const e = P.applicaCambio(d, { nome: "Spray Notte" });
    c("lo SKU scritto a mano non si tocca più; l'indirizzo, se non l'hai cambiato, segue ancora", ["HG-C01", "spray-notte"], [e.sku, e.slug]);
    const f = P.applicaCambio(e, { slug: "mio-indirizzo" });
    const g = P.applicaCambio(f, { nome: "Altro" });
    c("anche l'indirizzo scritto a mano resta com'è", ["HG-C01", "mio-indirizzo", "Altro"], [g.sku, g.slug, g.nome]);
    c("cambiare un altro campo non tocca SKU e indirizzo", [a.sku, a.slug], [P.applicaCambio(a, { descrizioneBreve: "x" }).sku, P.applicaCambio(a, { descrizioneBreve: "x" }).slug]);
    c("un titolo cancellato cancella le proposte (ma non quelle scritte a mano)", ["", "", "HG-C01"], [P.applicaCambio(a, { nome: "" }).sku, P.applicaCambio(a, { nome: "" }).slug, P.applicaCambio(d, { nome: "" }).sku]);
  }

  const buono = (extra = {}) => ({ modulo: { ...P.applicaCambio(V, { nome: "Spray Prova" }), descrizioneBreve: "Una descrizione breve inventata.", prezzo: "19,90", pesoG: "120", gtin: "8012345678905", ...(extra.modulo ?? {}) }, quantita: "10", costo: "10,40", costoDisponibile: true, categorie: [CAT], ...Object.fromEntries(Object.entries(extra).filter(([x]) => x !== "modulo")) });
  {
    const v = P.controllaBozza({ modulo: V, quantita: "", costo: "", costoDisponibile: true, categorie: [] });
    c("la scheda vuota non si salva: un solo errore (il titolo), niente richiesta; SKU e indirizzo vuoti si propongono dal titolo", [false, ["nome"]], [v.ok, Object.keys(v.errori?.campi ?? {})]);
    const r = P.controllaBozza(buono());
    c("la richiesta: nome, tipo, SKU e indirizzo in cima; categorie; variante con SOLO giacenza e costo", [true, "Spray Prova", "patch", "SPRAY-PROVA", "spray-prova", [CAT], ["costoCent", "giacenza"]],
      [r.ok, r.richiesta?.nome, r.richiesta?.tipo, r.richiesta?.sku, r.richiesta?.slug, r.richiesta?.categorie, Object.keys(r.richiesta?.variante ?? {}).sort()]);
    c("…prezzo (in centesimi, da «19,90»), peso, barcode e descrizioni vanno in `campi`; giacenza 10 e costo 1040 nella variante", [1990, 120, "8012345678905", "Una descrizione breve inventata.", 10, 1040],
      [r.richiesta?.campi?.prezzoCent, r.richiesta?.campi?.pesoG, r.richiesta?.campi?.gtin, r.richiesta?.campi?.descrizioneBreve, r.richiesta?.variante?.giacenza, r.richiesta?.variante?.costoCent]);
    c("…`campi` non porta le chiavi che il server rifiuta (nome, tipo, SKU, indirizzo, prodotto collegato, immagine di condivisione, stato)", [], ["nome", "tipo", "sku", "slug", "correlatoId", "seoMediaId", "stato"].filter((x) => x in (r.richiesta?.campi ?? {})));
    c("…i canali sono SEMPRE i quattro interruttori, uguali a ciò che si vede", { sito: true, meta: false, google: false, tiktok: false }, r.richiesta?.campi?.canali);
    const r2 = P.controllaBozza(buono({ modulo: { canali: { sito: false, meta: true, google: false, tiktok: true } } }));
    c("…anche con altri canali accesi: mandati tutti e quattro, come mostrati", { sito: false, meta: true, google: false, tiktok: true }, r2.richiesta?.campi?.canali);
    const r3 = P.controllaBozza(buono({ quantita: "", costo: "", modulo: { prezzo: "" } }));
    c("giacenza vuota = 0, costo vuoto = nessun costo, prezzo vuoto = 0 (è una bozza)", [true, 0, false, 0], [r3.ok, r3.richiesta?.variante?.giacenza, "costoCent" in (r3.richiesta?.variante ?? {}), r3.richiesta?.campi?.prezzoCent]);
    const dermis = P.controllaBozza(buono({ modulo: { nome: "Invisible Derm Solvente", sku: "HG-DERM", slug: "invisible-derm-solvente" } }));
    c("Invisible Derm: il prezzo scritto prima non parte (nello shop non ha un prezzo)", [true, 0], [dermis.ok, dermis.richiesta?.campi?.prezzoCent]);
    c("costo con il campo spento (database senza migrazione): non parte nemmeno se scritto", false, "costoCent" in (P.controllaBozza(buono({ costoDisponibile: false })).richiesta?.variante ?? {}));
    const storte = [
      ["prezzo con tre decimali", { modulo: { prezzo: "19,999" } }, "campi", "prezzo"],
      ["giacenza «1e3»", { quantita: "1e3" }, "quantita"],
      ["giacenza «10,5»", { quantita: "10,5" }, "quantita"],
      ["giacenza negativa", { quantita: "-3" }, "quantita"],
      ["costo «abc»", { costo: "abc" }, "costo"],
      ["peso con la virgola", { modulo: { pesoG: "12,5" } }, "campi", "pesoG"],
      ["SKU con lo spazio", { modulo: { sku: "HG 01" } }, "campi", "sku"],
      ["indirizzo con le maiuscole", { modulo: { slug: "Spray Prova" } }, "campi", "slug"],
      ["testo che non si può scrivere (uno sconto)", { modulo: { descrizioneBreve: "Sconto del 20% solo oggi" } }, "campi", "descrizioneBreve"],
    ];
    for (const [nome, extra, dove, campo] of storte) {
      const v = P.controllaBozza(buono(extra));
      c(`${nome} → non parte, l'errore sta accanto al campo`, [false, true], [v.ok, dove === "campi" ? !!v.errori?.campi?.[campo] : !!v.errori?.[dove]]);
    }
  }

  // ── la VERA `prodotto_crea` sul finto del database ──
  const S = mod["negozio/prodotti.server"];
  const tab = (...mut) => { const t = tabelleProva(); t.shop_varianti.forEach((v) => { v.costo_cent = null; }); mut.forEach((m) => m(t)); return t; };
  const dip = (db) => ({ guardia: async () => ({ ok: true, nome: "Giulia Esempio" }), db, adesso: () => ADESSO, log: () => {}, chiaveServizio: () => "chiave-di-prova" });
  /** Un «esegui» che parla col VERO server dei prodotti e registra le richieste, come fa `negozio.esegui` (stessa forma dell'esito). */
  const finto = (db) => {
    const chiamate = [];
    const esegui = async (azione, dati = {}) => {
      chiamate.push({ azione, dati: structuredClone(dati) });
      const r = await S.gestisciPOST(new Request("https://crm.example.com/api/crm/negozio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...dati, azione }) }), dip(db));
      const j = await r.json();
      const { ok, ...resto } = j;
      const TIPO = { duplicato: "duplicato", migrazione: "migrazione", valore: "valore" };
      return r.ok && ok ? { ok: true, dati: resto } : { ok: false, errore: { tipo: TIPO[j.motivo] ?? "server", messaggio: j.frase ?? "errore" } };
    };
    return { chiamate, esegui };
  };
  const nuoviDi = (db, sku) => db.tabelle.shop_prodotti.filter((p) => p.sku === sku);
  {
    const db = fintoDb({ tabelle: tab() });
    const { chiamate, esegui } = finto(db);
    const e = await P.creaBozza(esegui, buono());
    const p = nuoviDi(db, "SPRAY-PROVA")[0];
    const vs = db.tabelle.shop_varianti.filter((v) => v.prodotto_id === p?.id);
    const mov = db.tabelle.shop_giacenza_movimenti;
    c("«Salva bozza» = UNA sola prodotto_crea, e il prodotto nasce in bozza", [1, "prodotto_crea", "creato", true, "bozza", 1990], [chiamate.length, chiamate[0]?.azione, e.tipo, typeof e.id === "string" && e.id === p?.id, p?.stato, p?.prezzo_cent]);
    c("…con la variante «Unica» (SKU del prodotto, prezzo vuoto, costo 1040), il carico +10 col nome di chi chiama e la categoria legata", [1, "Unica", "SPRAY-PROVA", null, 1040, 1, 10, "carico", "Giulia Esempio", [CAT]],
      [vs.length, vs[0]?.nome, vs[0]?.sku, vs[0]?.prezzo_cent, vs[0]?.costo_cent, mov.length, mov[0]?.delta, mov[0]?.motivo, mov[0]?.chi, db.tabelle.shop_prodotti_categorie.filter((x) => x.prodotto_id === p?.id).map((x) => x.categoria_id)]);
    c("…peso, barcode, descrizione e indirizzo stanno sul prodotto; i CANALI con tutti e quattro gli interruttori come mostrati", ["spray-prova", 120, "8012345678905", { sito: true, meta: false, google: false, tiktok: false }],
      [p?.slug, p?.peso_g, p?.gtin, p?.canali]);
    c("…nessuna parziale: `mancanti` vuoto", [], e.mancanti);
  }
  {
    // indirizzo già usato (due prodotti con lo stesso nome): UNA riprova, cambiando solo l'indirizzo
    const db = fintoDb({ tabelle: tab() });
    const { chiamate, esegui } = finto(db);
    const e = await P.creaBozza(esegui, buono({ modulo: { nome: "Prodotto di prova", slug: "prodotto-di-prova", sku: "HG-N02" } }));
    const [a, b] = chiamate;
    c("indirizzo già usato → 2 richieste: la seconda cambia SOLO l'indirizzo (nome e SKU), e il prodotto nasce una volta sola",
      [2, true, "prodotto-di-prova-hg-n02", "creato", 1], [chiamate.length, JSON.stringify({ ...a?.dati, slug: 0 }) === JSON.stringify({ ...b?.dati, slug: 0 }), b?.dati?.slug, e.tipo, nuoviDi(db, "HG-N02").length]);
    // …se l'indirizzo l'hai scritto TU non si cambia di nascosto
    const db2 = fintoDb({ tabelle: tab() });
    const f2 = finto(db2);
    const e2 = await P.creaBozza(f2.esegui, buono({ modulo: { sku: "HG-N03", slug: "prodotto-di-prova", nome: "Spray Prova" } }));
    c("indirizzo scelto a mano e già usato → UNA richiesta, errore accanto all'indirizzo, nessuna riga nuova", [1, "errori", true, 0], [f2.chiamate.length, e2.tipo, !!e2.errori?.campi?.slug, nuoviDi(db2, "HG-N03").length]);
    // …e se anche la riprova trova l'indirizzo occupato
    const db3 = fintoDb({ tabelle: tab((t) => t.shop_prodotti.push({ ...t.shop_prodotti[0], id: uuid(0x777), sku: "ALTRO-1", slug: "prodotto-di-prova-hg-n04" })) });
    const f3 = finto(db3);
    const e3 = await P.creaBozza(f3.esegui, buono({ modulo: { nome: "Prodotto di prova", slug: "prodotto-di-prova", sku: "HG-N04" } }));
    c("anche la riprova trova l'indirizzo occupato → si ferma a 2 richieste, errore accanto all'indirizzo, nessuna riga nuova", [2, "errori", true, 0], [f3.chiamate.length, e3.tipo, !!e3.errori?.campi?.slug, nuoviDi(db3, "HG-N04").length]);
  }
  {
    // SKU già usato: la frase lo nomina → NON si cambia l'indirizzo, si dice dove
    const db = fintoDb({ tabelle: tab() });
    const { chiamate, esegui } = finto(db);
    const e = await P.creaBozza(esegui, buono({ modulo: { sku: "PROVA-001" } }));
    c("SKU già usato → UNA richiesta (nessuna riprova), errore accanto allo SKU con la frase del server, nessuna riga nuova",
      [1, "errori", "Lo SKU “PROVA-001” è già usato da un altro prodotto.", false, PRODOTTI_DI_PARTENZA], [chiamate.length, e.tipo, e.errori?.campi?.sku, !!e.errori?.campi?.slug, db.tabelle.shop_prodotti.length]);
    // lo SKU di una VARIANTE di un altro prodotto è un SKU già usato come lo SKU di un prodotto
    const db2 = fintoDb({ tabelle: tab() });
    const f2 = finto(db2);
    const e2 = await P.creaBozza(f2.esegui, buono({ modulo: { sku: "PROVA-001-A" } }));
    c("SKU di una variante di un altro prodotto → errore accanto allo SKU, nessuna riga nuova", [1, "errori", true], [f2.chiamate.length, e2.tipo, !!e2.errori?.campi?.sku]);
  }
  {
    // costo con la migrazione non applicata: niente prodotto, il campo si spegne e lo dice a parole
    const db = fintoDb({ tabelle: tab(), senzaColonne: { shop_varianti: ["costo_cent"] } });
    const { chiamate, esegui } = finto(db);
    const e = await P.creaBozza(esegui, buono());
    c("costo senza la migrazione → nessun prodotto, esito «costo_spento» con la frase del server", [1, "costo_spento", true, PRODOTTI_DI_PARTENZA], [chiamate.length, e.tipo, /costo/i.test(e.frase ?? ""), db.tabelle.shop_prodotti.length]);
    const e2 = await P.creaBozza(esegui, buono({ costo: "", costoDisponibile: false }));
    c("…senza costo la stessa scheda si salva", ["creato", 1], [e2.tipo, nuoviDi(db, "SPRAY-PROVA").length]);
  }
  {
    // `parziale`: il prodotto c'è anche se un passo dopo è fallito → si apre comunque, senza rifare «Salva bozza»
    const chiamate = [];
    const esegui = async (azione, dati) => { chiamate.push(azione); return { ok: true, dati: { prodotto: { id: "id-nuovo" }, parziale: ["giacenza", "categorie"] } }; };
    const e = await P.creaBozza(esegui, buono());
    c("`dati.parziale` → «creato» con l'id e i passi mancati; UNA sola richiesta (non si rifà «Salva bozza»)", [1, "creato", "id-nuovo", ["giacenza", "categorie"]], [chiamate.length, e.tipo, e.id, e.mancanti]);
    c("…la frase per il banner nomina i passi mancati", [true, true, false], [/scorte/.test(P.fraseMancanti(["giacenza"])), /categorie/.test(P.fraseMancanti(["variante", "categorie"])), /\bparziale\b|giacenza\b.*giacenza/.test(P.fraseMancanti(["giacenza"]))]);
    const senzaId = await P.creaBozza(async () => ({ ok: true, dati: {} }), buono());
    c("risposta senza id → «creato» con id nullo (la scheda dice di cercarlo nell'elenco, non di riprovare)", ["creato", null], [senzaId.tipo, senzaId.id]);
    const permesso = await P.creaBozza(async () => ({ ok: false, errore: { tipo: "permesso", messaggio: "Il tuo utente non può gestire il negozio: chiedi a un amministratore." } }), buono());
    c("un altro errore del server → «fermo» con la sua frase", ["fermo", "Il tuo utente non può gestire il negozio: chiedi a un amministratore."], [permesso.tipo, permesso.frase]);
    const nessuna = [];
    await P.creaBozza(async (...a) => { nessuna.push(a); return { ok: true, dati: {} }; }, { modulo: V, quantita: "", costo: "", costoDisponibile: true, categorie: [] });
    c("la scheda vuota non chiama il server", 0, nessuna.length);
  }
  c("le categorie lette dal server: solo id e nome validi, il resto si scarta", [[{ id: "a", nome: "A" }], []], [P.elencoCategorie([{ id: "a", nome: "A", x: 1 }, { id: 3, nome: "B" }, null, { id: "c" }]), P.elencoCategorie("no")]);
  c("l'errore da mettere a fuoco: il primo campo con un errore, poi la quantità, poi il costo", ["f-nome", "f-giacenza", "f-costo", null],
    [P.primoCampoDaSistemare({ campi: { nome: "x", sku: "y" }, quantita: "q" }), P.primoCampoDaSistemare({ campi: {}, quantita: "q", costo: "c" }), P.primoCampoDaSistemare({ campi: {}, costo: "c" }), P.primoCampoDaSistemare({ campi: {} })]);

  // ════ ③ IL DISEGNO ════
  if (!existsSync(file.scheda)) return;
  const registro = [];
  const negozioFinto = { esegui: async (...a) => (registro.push(["esegui", ...a]), { ok: true, dati: {} }), categorie: async () => (registro.push(["categorie"]), { ok: true, dati: { categorie: [] } }) };
  const aperture = [];
  const { html, pagina } = await rendiComponente(radice, join(DIR, "SchedaNuova.tsx"), "SchedaNuova", { negozio: negozioFinto, apri: (id) => aperture.push(id), torna: () => aperture.push("torna") });
  const t = leggibile(html);
  c("aprendo la scheda nuova il registro non ha scritture (e nessuna chiamata)", 0, registro.length);
  c("la scheda ha: titolo, foto che chiede «Salva bozza», prezzo, giacenza iniziale, spedizione, indirizzo e la colonna laterale in bozza",
    [true, true, true, true, true, true, true, true, true],
    ["Nuovo prodotto", "Premi Salva bozza per aggiungere le foto.", "Prezzo (euro)", "Quantità iniziale", "Peso (grammi)", "Indirizzo", "Dove si vede", "Organizzazione", "Bozza"].map((s) => t.includes(s)));
  c("i campi chiesti dalla SPEC ci sono: Titolo, Descrizione breve, Descrizione, SKU, Barcode, Costo, Tipo, Categorie", [true, true, true, true, true, true, true, true],
    ["Titolo", "Descrizione breve", "Descrizione", "SKU", "Barcode (GTIN)", "Costo per articolo (euro)", "Tipo", "Categorie e collezioni"].map((s) => t.includes(s)));
  c("sulla scheda nuova non ci sono «Prima di pubblicare», «Pubblica», «Varianti» né le foto vere (non c'è ancora un prodotto)", [false, false, false], [t.includes("Prima di pubblicare"), tasti(html).some((b) => /^Pubblica$/.test(leggibile(b))), t.includes("Varianti")]);
  const bottoni = tasti(html);
  const pieni = bottoni.filter((b) => b.includes(PIENO));
  c("un solo tasto pieno per schermata: due «Salva bozza» (uno dal computer, uno nella barra del telefono), mai insieme", [2, true, true], [pieni.length, pieni.every((b) => leggibile(b).includes("Salva bozza")), pieni.some((b) => /\bhidden\b[^"]*md:inline-flex|hidden md:/.test(b)) && /<div class="fixed inset-x-0 bottom-0[^"]*md:hidden"[^>]*>[\s\S]*Salva bozza/.test(html)]);
  c("c'è «← Prodotti» per tornare all'elenco, di contorno", true, bottoni.some((b) => leggibile(b).includes("Prodotti") && !b.includes(PIENO)));
  c("nessuna parola vietata nel testo della scheda", [], trovaParoleVietate(t));
  c("l'ancora di salvataggio dice la verità: non è salvato finché non si preme «Salva bozza»", true, /non (è|e') ancora salvato|non nasce niente|non è salvato/i.test(t));
  const aFuoco = [];
  globalThis.document = { getElementById: (id) => ({ focus: () => aFuoco.push(id) }) };
  try { await gestore(pagina, "button", "Salva bozza")(); } finally { delete globalThis.document; }
  c("«Salva bozza» sulla scheda vuota non scrive niente e porta il cursore sul titolo che manca", [0, ["f-nome"]], [registro.filter((r) => r[0] === "esegui").length, aFuoco]);

  // ════ ④ L'ELENCO ════
  const nuovoSrc = k.elenco;
  c("l'elenco non conosce più la finestra con le tre domande, né «Nuovo prodotto»", [false, false, false, false], [/FinestraNuovo/.test(elenco), /Nuovo prodotto/.test(elenco), /Crea il prodotto/.test(elenco), /\bTIPI\b/.test(nuovoSrc)]);
  c("«Aggiungi prodotto» apre la scheda nuova (senza scrivere) e «Importa» apre la finestra dell'import",
    [true, true, true], [/<SchedaNuova\b/.test(nuovoSrc) && /setNuovo\(true\)/.test(nuovoSrc), /<FinestraImporta\b[\s\S]*?aperta=\{importa\}/.test(nuovoSrc), /setImporta\(true\)/.test(nuovoSrc)]);
  c("il telefono ha il suo tasto fisso «Aggiungi prodotto»", true, /fixed inset-x-4[^"]*md:hidden[\s\S]{0,400}Aggiungi prodotto/.test(elenco));
  c("l'import: la finestra riceve un `negozio` il cui `esegui` NON rilegge l'elenco (`eseguiAzione`), e l'elenco si rilegge UNA volta, alla chiusura",
    [true, true, true], [/eseguiAzione\(fetchCRM, azione, dati\)/.test(nuovoSrc), /negozio=\{negozioImporta\}/.test(nuovoSrc), /const chiudiImporta = \(\) => \{[^}]*setImporta\(false\)[^}]*aggiorna\(\)/.test(nuovoSrc)]);
  c("l'elenco non scrive direttamente: nessun fetch( (la rete passa da eseguiAzione e negozio)", false, /\bfetch\(/.test(nuovoSrc));
  c("«Vai ai prodotti importati» chiude e rilegge; un prodotto aperto dall'import rilegge prima di aprirlo", [true, true], [/vaiAiProdotti=\{chiudiImporta\}/.test(nuovoSrc), /apriProdotto=\{\(id\) => \{[^}]*aggiorna\(\)[^}]*apri\(id\)/.test(nuovoSrc)]);

  const righe = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, sku: `HG-${i}`, slug: `p-${i}`, nome: `Prodotto ${i}`, tipo: "cura", stato: "bozza", origine: null, prezzoCent: 1990, versione: "v", haModifiche: false, motivo: null, canali: { sito: true, meta: false, google: false, tiktok: false }, giacenza: 3 }));
  const reg2 = [];
  const negozioElenco = (prodotti) => ({ prodotti, caricato: true, inCaricamento: false, errore: null, troncato: false, ultimoAggiornamento: 1, inAggiornamento: false, filtri: {}, aggiorna: async () => { reg2.push("aggiorna"); }, impostaFiltri: async () => {}, esegui: async (...a) => (reg2.push(a), { ok: true, dati: {} }), categorie: async () => ({ ok: true, dati: { categorie: [] } }), scheda: async () => ({ ok: false }), interruttori: async () => ({ ok: false }) });
  const finti = { "@/crm/AuthContext": `export const fetchCRM = async () => { throw new Error("rete non prevista"); };` };
  for (const [nome, n] of [["senza prodotti", 0], ["con 3 prodotti", 3]]) {
    const r = await rendiComponente(radice, join(DIR, "ElencoProdotti.tsx"), "ElencoProdotti", { negozio: negozioElenco(righe(n)), apri: () => {} }, { finti });
    const tt = leggibile(r.html);
    const bt = tasti(r.html);
    c(`elenco ${nome}: «Aggiungi prodotto» (pieno) e «Importa» (di contorno) ci sono, non c'è più «Nuovo prodotto»`, [true, true, false, false],
      [bt.some((b) => leggibile(b).includes("Aggiungi prodotto") && b.includes(PIENO)), bt.some((b) => leggibile(b).includes("Importa") && !b.includes(PIENO)), tt.includes("Nuovo prodotto"), bt.filter((b) => leggibile(b).includes("Importa")).some((b) => b.includes(PIENO))]);
    c(`elenco ${nome}: il tasto fisso del telefono dice «Aggiungi prodotto»`, true, /<div class="fixed inset-x-4[^"]*md:hidden"[^>]*><button[^>]*>[\s\S]*?Aggiungi prodotto/.test(r.html));
    c(`elenco ${nome}: il registro del finto non ha scritture dal solo disegno`, 0, reg2.length);
    if (n === 0) c("elenco vuoto: la frase parla di «Aggiungi prodotto» e di «Importa»", [true, true], [/Aggiungi prodotto/.test(tt.slice(tt.indexOf("Non c'è ancora nessun prodotto."))), /Importa/.test(tt.slice(tt.indexOf("Non c'è ancora nessun prodotto.")))]);
    c(`elenco ${nome}: nessuna parola vietata`, [], trovaParoleVietate(tt));
  }
}
