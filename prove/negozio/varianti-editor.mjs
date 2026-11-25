/** ── EDITOR PRODOTTI · E8 · LE VARIANTI IN STILE SHOPIFY ────────────────────────────────────────────────────────────
 *  `src/crm/ecommerce/prodotti/EditorVarianti.tsx` e i suoi pezzi in `scheda/` (TabellaVarianti, OpzioniVarianti, AzioniDiTutte, varianti-puro,
 *  varianti-azioni). Quattro livelli: il SORGENTE (firma di T14/T15 invariata, props nuove solo opzionali, nessuna cancellazione, nessuna rete),
 *  le REGOLE PURE (testi di una riga, errori a parole, cosa mandare al server), le SCRITTURE contro il server vero e il database finto
 *  (genera su un prodotto semplice a 19,90, «Imposta il prezzo di tutte», stock, salvataggio di una riga, giro di andata e ritorno del criterio 2)
 *  e il DISEGNO (react-dom/server: tabella a 6 righe, «Prezzo di base», limiti, Unica spenta in una riga chiusa, costo spento).
 *  Gli effetti e gli stati non girano in `react-dom/server`: i clic si provano con le funzioni di scrittura, che sono le stesse del componente.
 *  Dati inventati, nessuna rete, nessuna chiave. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSync } from "esbuild";
import { fintoDb } from "./_finto-db.mjs";
import { tabelleProva, uuid } from "./dati.mjs";
import { rendiComponente } from "./_rende.mjs";

const ADESSO = new Date("2026-11-25T12:00:00.000Z");
const CAT = uuid(0x100);
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const conta = (html, re) => (html.match(re) ?? []).length;
const caricaBundle = (percorso, radice) => {
  const r = buildSync({ entryPoints: [percorso], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E8 · LE VARIANTI IN STILE SHOPIFY (25/11/2026)");
  const dir = join(radice, "src/crm/ecommerce/prodotti");
  const FILE = {
    EditorVarianti: join(dir, "EditorVarianti.tsx"),
    TabellaVarianti: join(dir, "scheda/TabellaVarianti.tsx"),
    OpzioniVarianti: join(dir, "scheda/OpzioniVarianti.tsx"),
    AzioniDiTutte: join(dir, "scheda/AzioniDiTutte.tsx"),
    "varianti-puro": join(dir, "scheda/varianti-puro.ts"),
    "varianti-azioni": join(dir, "scheda/varianti-azioni.ts"),
  };
  c("i sei file esistono", Object.keys(FILE).map(() => true), Object.values(FILE).map((p) => existsSync(p)));
  if (!Object.values(FILE).every((p) => existsSync(p))) return;
  const src = Object.fromEntries(Object.entries(FILE).map(([n, p]) => [n, readFileSync(p, "utf8")]));
  const cod = Object.fromEntries(Object.entries(src).map(([n, s]) => [n, senzaCommenti(s)]));

  // ════ IL SORGENTE ════
  for (const [nome, k] of Object.entries(cod)) {
    for (const vietato of [/compareAt/i, /prezzo\s+barrato/i, /\brating\b/i, /best\s*seller/i, /\bstelle\b/i, /sconto/i, /\bdelete\b/, /Elimina/, /parseFloat/, /\*\s*100\b/])
      c(`${nome}: nessuna occorrenza di ${vietato}`, false, vietato.test(k));
    c(`${nome}: nessuna rete (fetch, XMLHttpRequest)`, false, /\bfetch\(|XMLHttpRequest/.test(k));
    c(`${nome}: non importa dal server né il database`, false, /from\s+["'][^"']*(\.server|supabase)["']/.test(k));
    c(`${nome}: nessuna ombra, nessuno scorrimento orizzontale, nessun colore scritto a mano`, [false, false, false], [/\bshadow(-|\b)/.test(k), /overflow-x/.test(k), /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(/.test(k.replace(/&#\d+;|&#x[0-9a-f]+;/gi, ""))]);
  }
  for (const nome of ["TabellaVarianti", "OpzioniVarianti", "AzioniDiTutte", "varianti-puro", "varianti-azioni"])
    c(`${nome}: file nuovo sotto le 450 righe`, true, src[nome].split("\n").length < 450);
  c("EditorVarianti.tsx non cresce: sotto le 450 righe (era 565)", true, src.EditorVarianti.split("\n").length < 450);
  c("TabellaVarianti, OpzioniVarianti e AzioniDiTutte non scrivono mai (nessun `esegui`): sono solo presentazione", false, ["TabellaVarianti", "OpzioniVarianti", "AzioniDiTutte"].some((n) => /\besegui\b/.test(cod[n])));

  // la firma di T14/T15 è invariata; le props nuove sono tutte opzionali
  const ev = src.EditorVarianti;
  const props = /export interface PropsEditorVarianti \{[\s\S]*?\n\}/.exec(ev)?.[0] ?? "";
  c("firma: `export function EditorVarianti(` e `export interface PropsEditorVarianti`", [true, true], [/export function EditorVarianti\(/.test(ev), /export interface PropsEditorVarianti/.test(ev)]);
  c("props di T14/T15 invariate: prodotto {id, sku, nome, slug, prezzoCent, pubblicato, versione}, varianti, esegui, aggiorna",
    [true, true, true, true, true, true, true, true, true, true, true],
    ["id: string;", "sku: string;", "nome: string;", "slug: string;", "prezzoCent: number;", "pubblicato: boolean;", "versione: string;", "varianti: Variante[];", 'esegui: Negozio["esegui"];', "aggiorna: () => Promise<void>;", "prodotto: {"].map((x) => props.includes(x)));
  c("props nuove SOLO opzionali: `costi?`, `costoDisponibile?`, `prezzoBase?`", [true, true, true], [/\bcosti\?:/.test(props), /\bcostoDisponibile\?:/.test(props), /\bprezzoBase\?:/.test(props)]);
  c("EditorVarianti: campi alti 44 px sul telefono (`h-11`) e nessun `fetch(`", [true, false], [/(min-h-11|h-11)/.test(cod.EditorVarianti), /\bfetch\(/.test(cod.EditorVarianti)]);

  // mai cancellare: le sole azioni che il codice manda sono queste quattro, e nessun testo promette di togliere una variante
  const azioni = new Set(Object.values(cod).flatMap((k) => [...k.matchAll(/esegui\(\s*"([a-z_]+)"/g)].map((m) => m[1])));
  c("le sole azioni mandate sono varianti_genera, variante_salva, variante_attiva, giacenza_imposta (nessuna cancellazione)", ["giacenza_imposta", "variante_attiva", "variante_salva", "varianti_genera"], [...azioni].sort());
  c("la tabella è a contenitore (`@container`) e ogni riga diventa scheda sul telefono", true, /@container/.test(cod.TabellaVarianti) && /@\[43rem\]:grid-cols-\[var\(--col\)\]/.test(cod.TabellaVarianti));
  c("l'Invio aggiunge il valore (`Enter` con `preventDefault`)", true, /key !== "Enter"[\s\S]{0,120}preventDefault/.test(cod.OpzioniVarianti));

  // ════ LE REGOLE PURE ════
  const P = await caricaBundle(FILE["varianti-puro"], radice);
  const A = await caricaBundle(FILE["varianti-azioni"], radice);
  const variante = (o) => ({ id: "v1", prodottoId: "p", sku: "HG-T01-NE-S", nome: "Nero / S", opzioni: { Colore: "Nero", Misura: "S" }, prezzoCent: null, giacenza: 0, pesoG: null, attiva: true, gtin: null, ordine: 1, ...o });
  const COME = { senzaPrezzo: false, costoDisponibile: true };

  const salvata = variante({ prezzoCent: 2250, giacenza: 4, pesoG: 120, gtin: "8012345678905" });
  const b = P.rigaDa(salvata, 1040);
  c("rigaDa: i testi come li scrive il titolare (19,90, costo 10,40, peso, barcode)", { prezzo: "22,50", giacenza: "4", sku: "HG-T01-NE-S", gtin: "8012345678905", peso: "120", costo: "10,40" }, b);
  c("rigaDa: prezzo vuoto = `null` = vuoto; costo assente = vuoto; costo 0 = «0,00»", ["", "", "0,00"], [P.rigaDa(variante(), null).prezzo, P.rigaDa(variante(), undefined).costo, P.rigaDa(variante(), 0).costo]);
  c("nessun cambio → nessun lavoro", { campi: null, giacenza: null }, P.lavoroRiga(salvata, b, b, COME));
  const l = P.lavoroRiga(salvata, b, { ...b, prezzo: "19,90", sku: "HG-T01-X", gtin: "", peso: "", costo: "9,50", giacenza: "10" }, COME);
  c("lavoroRiga: prezzo e costo in centesimi interi, barcode e peso vuoti = `null`, SKU come scritto", { prezzoCent: 1990, sku: "HG-T01-X", gtin: null, pesoG: null, costoCent: 950 }, l?.campi);
  c("lavoroRiga: la giacenza NON è un campo della variante: è un movimento (da 4 a 10 = carico, valore 10)", [false, { valore: 10, motivo: "carico" }], [l && "giacenza" in l.campi, l?.giacenza]);
  c("…meno pezzi = rettifica", { valore: 1, motivo: "rettifica" }, P.lavoroRiga(salvata, b, { ...b, giacenza: "1" }, COME)?.giacenza);
  c("prezzo svuotato → `prezzoCent: null` (torna a valere il prezzo di base)", { prezzoCent: null }, P.lavoroRiga(salvata, b, { ...b, prezzo: "" }, COME)?.campi);
  c("costo con migrazione assente: non si manda mai", null, P.lavoroRiga(salvata, b, { ...b, costo: "9,50" }, { ...COME, costoDisponibile: false })?.campi);
  c("Invisible Derm (senza prezzo): il prezzo non si manda mai", null, P.lavoroRiga(salvata, b, { ...b, prezzo: "19,90" }, { ...COME, senzaPrezzo: true })?.campi);
  c("righe con un errore di forma non mandano niente (`null`)", [null, null, null, null], [
    P.lavoroRiga(salvata, b, { ...b, prezzo: "19,9,0" }, COME), P.lavoroRiga(salvata, b, { ...b, peso: "12,5" }, COME), P.lavoroRiga(salvata, b, { ...b, giacenza: "-1" }, COME), P.lavoroRiga(salvata, b, { ...b, costo: "abc" }, COME)]);
  const er = P.erroriRiga({ prezzo: "abc", giacenza: "1,5", sku: " ", gtin: "1".repeat(21), peso: "2000000", costo: "-4" }, true);
  c("erroriRiga: ogni errore è una frase, un campo per volta", ["prezzo", "giacenza", "sku", "gtin", "peso", "costo"], Object.keys(er));
  c("…le frasi parlano di euro, pezzi, SKU, barcode, grammi e costo", [true, true, true, true, true, true], [/euro/.test(er.prezzo), /pezzi/.test(er.giacenza), /SKU/.test(er.sku), /barcode/i.test(er.gtin), /grammi/.test(er.peso), /costo/i.test(er.costo)]);
  c("costo storto con la colonna assente non è un errore (la colonna è spenta)", {}, P.erroriRiga({ ...b, costo: "abc" }, false));
  c("prezzoEffettivo: la riga vuota vale il prezzo di base, la riga col prezzo il suo", [1990, 2250], [P.prezzoEffettivo(variante(), 1990), P.prezzoEffettivo(variante({ prezzoCent: 2250 }), 1990)]);
  const unica = (o) => variante({ id: "u", sku: "HG-T01", nome: "Unica", opzioni: {}, ...o });
  const sei = Array.from({ length: 6 }, (_, i) => variante({ id: `r${i}`, sku: `HG-T01-${i}`, opzioni: { Colore: `C${i % 3}`, Misura: `M${i % 2}` } }));
  const d = P.dividiRighe([unica({ attiva: false }), ...sei], "HG-T01");
  c("dividiRighe: l'Unica spenta sta da parte (riga chiusa), le 6 righe in tabella", [6, "u"], [d.righe.length, d.unicaSpenta?.id]);
  c("dividiRighe: l'Unica ancora accesa resta in tabella (si può spegnere)", [7, null], ((x) => [x.righe.length, x.unicaSpenta])(P.dividiRighe([unica(), ...sei], "HG-T01")));
  c("dividiRighe: prodotto semplice (solo l'Unica) → nessuna tabella", [0, null], ((x) => [x.righe.length, x.unicaSpenta])(P.dividiRighe([unica()], "HG-T01")));
  const o = { nome: "Colore", valori: ["Nero"], bozza: "" };
  c("valoriCompleti: il valore in scrittura conta subito, senza doppioni (anche con altre maiuscole)", [["Nero", "Biondo", "Castano"], ["Nero"], ["Nero"]],
    [P.valoriCompleti({ ...o, bozza: "Biondo, Castano , nero" }), P.valoriCompleti({ ...o, bozza: "NERO" }), P.valoriCompleti({ ...o, bozza: " , " })]);
  c("valoriDa: virgola o a capo, senza vuoti", ["a", "b", "c"], P.valoriDa("a, b\n c,,"));

  // ════ LE SCRITTURE: server vero, database finto ════
  const S = mod["negozio/prodotti.server"];
  const G = mod["negozio/giacenza.server"];
  const richiesta = (url, corpo) => new Request(`https://crm.example.com/api/crm/negozio${url}`, corpo === undefined ? { method: "GET" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const porte = (db) => ({ guardia: async () => ({ ok: true, nome: "Giulia Esempio" }), db, adesso: () => ADESSO, log: () => {}, chiaveServizio: () => "chiave-di-prova" });
  /** `esegui` come lo dà `useNegozio`: stessa forma di risposta, ma contro il server vero. `guasto(n, azione)` può far fallire la n-esima chiamata. */
  const ponte = (db, guasto) => {
    const chiamate = [];
    const esegui = async (azione, dati) => {
      chiamate.push([azione, dati]);
      const g = guasto?.(chiamate.length, azione);
      if (g) return { ok: false, errore: g };
      const m = azione.startsWith("giacenza_") ? G : S;
      const r = await m.gestisciPOST(richiesta("", { azione, ...dati }), porte(db));
      const j = await r.json();
      if (r.ok && j.ok) { const { ok: _ok, ...resto } = j; return { ok: true, dati: resto }; }
      return { ok: false, errore: { tipo: j.motivo === "migrazione" ? "migrazione" : "server", messaggio: j.frase ?? "Errore." } };
    };
    return { esegui, chiamate };
  };
  const scheda = async (db, id) => (await (await S.gestisciGET(richiesta(`?prodotto=${id}`), porte(db))).json());
  const tab = () => { const t = tabelleProva(); t.shop_varianti.forEach((v) => { v.costo_cent = null; }); return t; };
  const COLORI = ["Nero", "Biondo", "Castano"];
  const OPZIONI = [{ nome: "Colore", valori: COLORI }, { nome: "Misura", valori: ["S", "M"] }];

  /** Un prodotto semplice a 19,90 con la variante «Unica» (10 pezzi, costo 10,40), creato col server. */
  const semplice = async (extra = {}, conCosto = true) => {
    const db = fintoDb({ tabelle: tab(), ...extra });
    const p = ponte(db);
    const r = await p.esegui("prodotto_crea", { nome: "Spray Prova", tipo: "cura", sku: "HG-E08", slug: "spray-prova", campi: { prezzoCent: 1990, descrizioneBreve: "Una descrizione breve inventata." }, categorie: [CAT], variante: conCosto ? { giacenza: 10, costoCent: 1040 } : { giacenza: 10 } });
    return { db, id: r.dati?.prodotto?.id, p };
  };
  /** Il finto dà alle righe nuove id come «r-7»; il database vero un uuid, e la giacenza lo vuole: si rimettono a posto le variantI nate dopo. */
  const conUuid = (db) => righe(db, "shop_varianti").filter((v) => /^r-/.test(v.id)).forEach((v, k) => { v.id = uuid(0x500 + k); });
  const righe = (db, t) => db.tabelle[t];

  {
    const { db, id, p } = await semplice();
    const prima = await scheda(db, id);
    const u = prima.varianti[0];
    c("prodotto semplice: una variante «Unica», prezzo del prodotto 19,90, prezzo della variante vuoto", [1, "Unica", 1990, null], [prima.varianti.length, u?.nome, prima.prodotto.prezzoCent, u?.prezzoCent]);
    const e = await A.generaVarianti(p.esegui, id, OPZIONI, u);
    conUuid(db);
    const dopo = await scheda(db, id);
    const nuove = dopo.varianti.filter((v) => Object.keys(v.opzioni).length);
    c("varianti_genera su un semplice a 19,90 → 6 righe nuove", [6, "ok"], [nuove.length, e?.tono]);
    c("…le righe nuove hanno il prezzo VUOTO (nessuna scrittura automatica del prezzo su 6 righe)", [true, 6], [nuove.every((v) => v.prezzoCent === null), righe(db, "shop_varianti").filter((v) => v.prodotto_id === id && v.sku !== "HG-E08" && v.prezzo_cent == null).length]);
    c("…il prezzo EFFETTIVO di ogni riga è 19,90 (quello di base del prodotto)", [1990, 1990, 1990, 1990, 1990, 1990], nuove.map((v) => P.prezzoEffettivo(v, dopo.prodotto.prezzoCent)));
    c("…il prezzo di base del prodotto non è cambiato", 1990, righe(db, "shop_prodotti").find((x) => x.id === id).prezzo_cent);
    c("…la variante «Unica» si è spenta (non cancellata): c'è ancora, con i suoi 10 pezzi", [false, 10, 7], [dopo.varianti.find((v) => v.nome === "Unica").attiva, dopo.varianti.find((v) => v.nome === "Unica").giacenza, dopo.varianti.length]);
    c("…la frase lo dice: variante unica spenta e prezzo vuoto = prezzo di base", [true, true], [/variante unica è stata spenta/.test(e.testo), /vale il prezzo di base/.test(e.testo)]);
    c("…generare di nuovo non crea niente e non spegne niente (le varianti ci sono già)", [0, "ok"], await (async () => { const f = await A.generaVarianti(p.esegui, id, OPZIONI, null); return [(await scheda(db, id)).varianti.length - 7, f.tono]; })());

    // ── la tabella disegnata con quei dati ──
    const props = (varianti, extra = {}) => ({ prodotto: { id, sku: "HG-E08", nome: "Spray Prova", slug: "spray-prova", prezzoCent: dopo.prodotto.prezzoCent, pubblicato: false, versione: dopo.versione }, varianti, esegui: async () => ({ ok: true, dati: {} }), aggiorna: async () => {}, ...extra });
    const vedi = async (pr) => (await rendiComponente(radice, FILE.EditorVarianti, "EditorVarianti", pr)).html;
    const fetchVero = globalThis.fetch;
    let reti = 0;
    globalThis.fetch = () => { reti++; return Promise.reject(new Error("rete vietata")); };
    try {
      const html = await vedi(props(dopo.varianti, { costi: dopo.costi, costoDisponibile: dopo.costoDisponibile }));
      const t = leggibile(html);
      c("tabella: 6 righe (una per combinazione), la Unica spenta NON è fra le righe", 6, conta(html, /data-variante=/g));
      c("tabella: le intestazioni Variante · Prezzo · Giacenza · SKU · Barcode · Peso · Costo · Attiva", [true, true, true, true, true, true, true, true], ["Variante", "Prezzo", "Giacenza", "SKU", "Barcode", "Peso (g)", "Costo", "Attiva"].map((x) => new RegExp(`<span>${x.replace(/[()]/g, "\\$&")}</span>`).test(html)));
      c("tabella: 6 caselle per ogni colonna (prezzo, giacenza, SKU, barcode, peso, costo)", [6, 6, 6, 6, 6, 6], ["Prezzo", "Giacenza", "SKU", "Barcode", "Peso \\(g\\)", "Costo"].map((x) => conta(html, new RegExp(`aria-label="${x}, `, "g"))));
      c("tabella: 6 interruttori «Attiva» e 6 caselle per scegliere", [6, 6], [conta(html, /aria-label="Variante [^"]* attiva"/g) - 1, conta(html, /aria-label="Scegli /g)]);
      c("il campo «Prezzo di base» c'è, col prezzo del prodotto (19,90), in sola lettura finché il guscio non lo lega", [true, true, true], [t.includes("Prezzo di base (per le righe senza prezzo)"), /id="prezzo-base"[^>]*value="19,90"|value="19,90"[^>]*id="prezzo-base"/.test(html), /<input[^>]*id="prezzo-base"[^>]*readOnly=""|<input[^>]*readOnly=""[^>]*id="prezzo-base"/.test(html)]);
      c("le righe senza prezzo mostrano 19,90 in grigio (segnaposto) e «del prodotto» sotto, su ognuna", [6, 6], [conta(html, /<input[^>]*aria-label="Prezzo, [^>]*placeholder="19,90"/g), conta(html, />del prodotto</g)]);
      c("«Imposta il prezzo di tutte» e «Imposta lo stock di tutte» ci sono", [true, true], [t.includes("Imposta il prezzo di tutte"), t.includes("Imposta lo stock di tutte")]);
      c("la Unica spenta sta in UNA riga chiusa (`details` senza `open`) con la frase e il tasto per riattivarla", [1, false, true, true], [conta(html, /<details/g), /<details[^>]* open/.test(html), t.includes("Variante unica del prodotto senza opzioni (spenta)"), t.includes("Ha ancora 10 pezzi in magazzino")]);
      c("nessun tasto che toglie una variante: solo l'interruttore «Attiva»", false, /aria-label="[^"]*(Elimina|Cancella|Rimuovi|Togli la variante)/i.test(html) || /<button[^>]*>[^<]*(Elimina|Cancella|Rimuovi la variante)/i.test(html));
      c("…e la schermata lo dice: «Le varianti non si cancellano: si disattivano»", true, t.includes("Le varianti non si cancellano: si disattivano."));
      c("le opzioni ci sono, scritte come etichette, con la frase «Scrivi un valore e premi Invio.»", [true, true, true], [t.includes("Scrivi un valore e premi Invio."), COLORI.every((x) => html.includes(`aria-label="Togli il valore ${x}"`)), /aria-label="Togli il valore S"/.test(html)]);
      c("un valore che ha già delle varianti non si toglie da qui (casella spenta)", true, /<button[^>]*aria-label="Togli il valore Nero"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-label="Togli il valore Nero"/.test(html));
      c("riga sul telefono: etichette sopra le caselle (visibili) e, nella tabella larga, solo per chi legge lo schermo", true, /<span class="[^"]*@\[43rem\]:sr-only[^"]*">Prezzo<\/span>/.test(html));
      c("tutte le caselle di una riga hanno un nome che dice quale riga è", [true], [/aria-label="Giacenza, [A-Za-z]+ \/ [SM]"/.test(html) || /aria-label="Giacenza, /.test(html)]);

      // senza `costi` la colonna del costo non c'è; con la colonna spenta c'è con la sua frase
      const senza = await vedi(props(dopo.varianti));
      c("senza la prop `costi` la colonna Costo non c'è (props vecchie: tutto come prima)", [false, false], [/aria-label="Costo, /.test(senza), /<span>Costo<\/span>/.test(senza)]);
      const spento = await vedi(props(dopo.varianti, { costi: {}, costoDisponibile: false }));
      c("con `costoDisponibile:false` le 6 caselle del costo sono spente e la frase dice perché", [6, true], [conta(spento, /<input[^>]*aria-label="Costo, [^>]*disabled=""/g) + conta(spento, /<input[^>]*disabled=""[^>]*aria-label="Costo, /g), leggibile(spento).includes("Per il costo serve un aggiornamento del database.")]);
      const conCosto = await vedi(props(dopo.varianti, { costi: { [dopo.varianti[1].id]: 1040 }, costoDisponibile: true }));
      c("il costo si legge in euro (1040 → 10,40) nella sua riga", true, /value="10,40"/.test(conCosto));

      // il prezzo di base legato al guscio: un campo che scrive, col suo tasto
      let scritto = null;
      const legato = await vedi(props(dopo.varianti, { prezzoBase: { testo: "24,00", cambia: (x) => { scritto = x; }, azione: "<TASTO-DEL-GUSCIO>" } }));
      c("con `prezzoBase` il campo si può scrivere (non è in sola lettura), mostra il testo del guscio e il suo tasto", [true, false, true], [/value="24,00"/.test(legato), /<input[^>]*id="prezzo-base"[^>]*readOnly=""/.test(legato), legato.includes("&lt;TASTO-DEL-GUSCIO&gt;")]);
      c("…e un prezzo di base a zero con righe vuote lo dice a parole (il prodotto non si pubblica)", true, leggibile(await vedi(props(dopo.varianti, { prodotto: { ...props([]).prodotto, prezzoCent: 0 } }))).includes("Il prezzo di base è zero e alcune righe hanno il prezzo vuoto"));

      // Invisible Derm: senza prezzo pubblico, niente colonna del prezzo e niente prezzo di base
      const derm = await vedi(props(dopo.varianti, { prodotto: { ...props([]).prodotto, nome: "Invisible Derm Patch", slug: "invisible-derm-patch" } }));
      c("Invisible Derm: nessuna colonna Prezzo, nessun «Prezzo di base», nessun «Imposta il prezzo»", [false, false, false], [/aria-label="Prezzo, /.test(derm), leggibile(derm).includes("Prezzo di base"), leggibile(derm).includes("Imposta il prezzo")]);

      // prodotto semplice: nessuna tabella, l'invito ad aggiungere le opzioni
      const sem = await vedi(props([{ ...u, attiva: true }]));
      c("prodotto semplice: «Aggiungi opzioni come colore o misura», nessuna tabella, nessun «Prezzo di base»", [true, 0, false], [leggibile(sem).includes("Aggiungi opzioni come colore o misura"), conta(sem, /data-variante=/g), leggibile(sem).includes("Prezzo di base")]);
      c("…e il tasto per aprirle (alto 44 px sul telefono)", true, /<button[^>]*class="[^"]*h-11[^"]*"[^>]*>Aggiungi opzioni<\/button>/.test(sem));
      c("prodotto senza nessuna variante: resta il tasto per aggiungere la variante unica", true, leggibile(await vedi(props([]))).includes("aggiungi la variante unica"));

      // i limiti: tasto spento con la frase del perché
      const spentoCon = (h, nome) => new RegExp(`<button[^>]*disabled=""[^>]*>${nome}</button>|<button[^>]*>[^<]*</button>`).test(h) && new RegExp(`<button(?:(?!</button>)[^>])*disabled=""(?:(?!</button>)[^>])*>(?:(?!</button>).)*${nome}`).test(h);
      const quattro = [variante({ opzioni: { Colore: "Nero", Misura: "S", Lunghezza: "30", Base: "Liscia" } })];
      const h4 = await vedi(props(quattro));
      c("4 opzioni: «Crea le varianti» spento e la frase «al massimo 3 opzioni»", [true, true], [spentoCon(h4, "Crea le varianti"), leggibile(h4).includes("Si possono usare al massimo 3 opzioni")]);
      const cinquantasei = [...Array.from({ length: 8 }, (_, i) => variante({ id: `a${i}`, sku: `X-A${i}`, opzioni: { Colore: `C${i}`, Misura: "M0" } })), ...Array.from({ length: 6 }, (_, i) => variante({ id: `b${i}`, sku: `X-B${i}`, opzioni: { Colore: "C0", Misura: `M${i + 1}` } }))];
      const h56 = await vedi(props(cinquantasei));
      c("56 combinazioni: «Crea le varianti» spento e la frase «il massimo è 50»", [true, true], [spentoCon(h56, "Crea le varianti"), /56 varianti: il massimo è 50/.test(leggibile(h56))]);
      c("sempre scritto: «Al massimo 3 opzioni e 50 combinazioni.»", true, leggibile(h56).includes("Al massimo 3 opzioni e 50 combinazioni."));
      const tre = [variante({ opzioni: { Colore: "Nero", Misura: "S", Lunghezza: "30" } })];
      const h3 = await vedi(props(tre));
      c("3 opzioni: «Aggiungi un'opzione» spento, con «Hai già 3 opzioni: è il massimo»", [true, true], [spentoCon(h3, "Aggiungi un'opzione") || spentoCon(h3, "Aggiungi un&#x27;opzione"), leggibile(h3).includes("Hai già 3 opzioni: è il massimo.")]);
      const h2 = await vedi(props([variante({ opzioni: { Colore: "Nero" } })]));
      c("2 opzioni o meno: «Aggiungi un'opzione» acceso", false, spentoCon(h2, "Aggiungi un'opzione") || spentoCon(h2, "Aggiungi un&#x27;opzione"));
      // prodotto pubblicato: lo dice la riga in cima
      c("prodotto pubblicato: «ogni cambio qui si applica subito»", true, leggibile(await vedi(props(dopo.varianti, { prodotto: { ...props([]).prodotto, pubblicato: true } }))).includes("Il prodotto è sul sito: ogni cambio qui si applica subito."));
      c("durante il disegno nessuna chiamata di rete", 0, reti);
    } finally {
      globalThis.fetch = fetchVero;
    }

    // ── «Imposta il prezzo di tutte» scrive su OGNI riga ──
    const ids = nuove.map((v) => v.id);
    const scrittureProdotto = db.registro.filter((q) => q.scrisse && q.tab === "shop_prodotti").length;
    const ep = await A.impostaPrezzoDiTutte(p.esegui, id, nuove, "22,50");
    const dopoPrezzo = await scheda(db, id);
    c("«Imposta il prezzo di tutte» (22,50): ok, e OGNI riga ha ora il suo prezzo (2250)", ["ok", [2250, 2250, 2250, 2250, 2250, 2250]], [ep?.tono, ids.map((i) => dopoPrezzo.varianti.find((v) => v.id === i).prezzoCent)]);
    c("…il prezzo di base del prodotto resta 19,90 e la Unica spenta non è stata toccata", [1990, null], [dopoPrezzo.prodotto.prezzoCent, dopoPrezzo.varianti.find((v) => v.nome === "Unica").prezzoCent]);
    c("…una riga alla volta: 6 scritture di variante, nessuna sul prodotto", [6, 0], [righe(db, "shop_storico").filter((x) => x.campo === "prezzoCent").length, db.registro.filter((q) => q.scrisse && q.tab === "shop_prodotti").length - scrittureProdotto]);
    const sub = await A.impostaPrezzoDiTutte(p.esegui, id, nuove.slice(0, 2), "30,00");
    const dopoSub = await scheda(db, id);
    c("sulle sole righe scelte (2): 3000 su quelle due, le altre 4 restano 2250", [true, [3000, 3000, 2250, 2250, 2250, 2250]], [sub?.tono === "ok" && /2 righe/.test(sub.testo), ids.map((i) => dopoSub.varianti.find((v) => v.id === i).prezzoCent)]);
    for (const [nome, t] of [["vuoto", ""], ["zero", "0"], ["testo", "abc"], ["tre decimali", "1,999"], ["negativo", "-3"]]) {
      const prima = db.scritture.length;
      const x = await A.impostaPrezzoDiTutte(p.esegui, id, nuove, t);
      c(`prezzo di tutte «${nome}» → una frase, nessuna scrittura`, ["errore", prima], [x?.tono, db.scritture.length]);
    }

    // ── «Imposta lo stock di tutte»: movimenti registrati, motivo scelto ──
    const movPrima = righe(db, "shop_giacenza_movimenti").length;
    const es = await A.impostaStockDiTutte(p.esegui, nuove, "7", "carico");
    const dopoStock = await scheda(db, id);
    c("«Imposta lo stock di tutte» (7, carico): ok, ogni riga ha 7 pezzi", ["ok", [7, 7, 7, 7, 7, 7]], [es?.tono, ids.map((i) => dopoStock.varianti.find((v) => v.id === i).giacenza)]);
    c("…sei movimenti nuovi, col motivo scelto, +7 e il nome di chi chiama (mai una scrittura diretta della giacenza)", [6, true, true], [righe(db, "shop_giacenza_movimenti").length - movPrima, righe(db, "shop_giacenza_movimenti").slice(movPrima).every((m) => m.motivo === "carico" && m.delta === 7 && m.chi === "Giulia Esempio"), db.registro.filter((q) => q.scrisse && q.tab === "shop_varianti" && q.dati && "giacenza" in q.dati).length === 0]);
    for (const [nome, t] of [["negativo", "-1"], ["con la virgola", "1,5"], ["testo", "tanti"], ["oltre il tetto", "2000000"]]) {
      const x = await A.impostaStockDiTutte(p.esegui, nuove, t, "rettifica");
      c(`stock di tutte «${nome}» → una frase`, "errore", x?.tono);
    }

    // ── una riga: salvare tutti i campi cambiati, e ricaricare mostra gli stessi valori (criterio 2) ──
    const v0 = dopoStock.varianti.find((v) => v.id === ids[0]);
    const base0 = P.rigaDa(v0, dopoStock.costi[v0.id]);
    const nuovo0 = { prezzo: "21,00", giacenza: "3", sku: "HG-E08-NE-S", gtin: "8012345678905", peso: "85", costo: "9,90" };
    const lavoro = P.lavoroRiga(v0, base0, nuovo0, COME);
    const s1 = await A.salvaRighe(p.esegui, id, [{ v: v0, lavoro }], false);
    const dopoRiga = await scheda(db, id);
    const v0d = dopoRiga.varianti.find((v) => v.id === ids[0]);
    c("salvaRighe: prezzo, giacenza (via movimento), SKU, barcode, peso e costo scritti; «Salvata 1 riga.»", [{ prezzoCent: 2100, giacenza: 3, sku: "HG-E08-NE-S", gtin: "8012345678905", pesoG: 85 }, 990, "Salvata 1 riga.", [ids[0]]],
      [{ prezzoCent: v0d.prezzoCent, giacenza: v0d.giacenza, sku: v0d.sku, gtin: v0d.gtin, pesoG: v0d.pesoG }, dopoRiga.costi[ids[0]], s1.esito.testo, s1.fatte]);
    c("ricaricata la scheda, i testi della riga sono quelli scritti (andata e ritorno)", nuovo0, P.rigaDa(v0d, dopoRiga.costi[ids[0]]));
    c("…le altre 5 righe non sono state toccate (prezzo 2250 o 3000, stock 7)", true, ids.slice(1).every((i) => dopoRiga.varianti.find((v) => v.id === i).giacenza === 7));
    c("…il costo non esce nella variante letta (sta solo in `costi`)", false, JSON.stringify(dopoRiga.varianti).includes("costo"));
    const sPub = await A.salvaRighe(p.esegui, id, [{ v: v0d, lavoro: P.lavoroRiga(v0d, P.rigaDa(v0d, dopoRiga.costi[ids[0]]), { ...nuovo0, peso: "90" }, COME) }], true);
    c("su un prodotto pubblicato la frase dice che si vede già sul sito", "Salvata 1 riga: si vede già sul sito.", sPub.esito.testo);
    const sDue = await A.salvaRighe(p.esegui, id, ids.slice(1, 3).map((i) => ({ v: dopoRiga.varianti.find((v) => v.id === i), lavoro: { campi: { pesoG: 50 }, giacenza: null } })), false);
    c("più righe: «Salvate 2 righe.»", "Salvate 2 righe.", sDue.esito.testo);
    // SKU di un'altra variante: il server rifiuta, la frase arriva alla schermata e la riga resta fra le «rimaste fuori»
    const dup = await A.salvaRighe(p.esegui, id, [{ v: dopoRiga.varianti.find((v) => v.id === ids[1]), lavoro: { campi: { sku: "HG-E08-NE-S" }, giacenza: null } }], false);
    c("uno SKU già usato → errore col nome della riga e la frase del server, la riga non risulta salvata", [["errore"], [], true], [[dup.esito.tono], dup.fatte, /già usato/.test(dup.esito.testo)]);

    // ── mai cancellare: nessuna riga sparisce, nemmeno spegnendo ──
    const righePrima = righe(db, "shop_varianti").length;
    const spegni = await p.esegui("variante_attiva", { prodottoId: id, varianteId: ids[5], attiva: false });
    c("spegnere una variante la disattiva e basta: le righe del database restano tutte", [true, righePrima, false], [spegni.ok, righe(db, "shop_varianti").length, righe(db, "shop_varianti").find((v) => v.id === ids[5]).attiva]);
    c("in tutto il giro nessuna richiesta di cancellazione al database", 0, db.registro.filter((q) => /delete|remove/i.test(q.op ?? "")).length);
    c("in tutto il giro nessun'azione fuori dalle quattro attese (più la creazione del prodotto)", [], [...new Set(p.chiamate.map((x) => x[0]))].filter((a) => !["prodotto_crea", "varianti_genera", "variante_salva", "variante_attiva", "giacenza_imposta"].includes(a)));
  }

  // ── un guasto a metà: ci si ferma e si dice quali righe sono rimaste fuori ──
  {
    const { db, id, p } = await semplice();
    await A.generaVarianti(p.esegui, id, OPZIONI, null);
    conUuid(db);
    const nuove = (await scheda(db, id)).varianti.filter((v) => Object.keys(v.opzioni).length);
    const inizio = p.chiamate.length;
    const guasto = ponte(db, (n) => (n - inizio === 3 ? { tipo: "sessione", messaggio: "La sessione è scaduta: accedi di nuovo." } : null));
    guasto.chiamate.push(...p.chiamate);
    const x = await A.impostaPrezzoDiTutte(guasto.esegui, id, nuove, "19,90");
    const quante = righe(db, "shop_varianti").filter((v) => v.prodotto_id === id && v.prezzo_cent === 1990).length;
    c("sessione scaduta alla terza riga: ci si ferma (2 scritte), l'esito è un errore con «Fatto per 2 righe su 6»", [2, "errore", true], [quante, x.tono, x.testo.startsWith("Fatto per 2 righe su 6. Rimaste fuori:")]);
    c("…le altre quattro sono nominate (la terza col suo errore, le ultime tre «non l'ho provata»)", [1, 3], [(x.testo.match(/La sessione è scaduta/g) ?? []).length, (x.testo.match(/non l'ho provata/g) ?? []).length]);
    // un errore del server (non di sessione) NON ferma le altre righe
    const g2 = ponte(db, (n) => (n - 0 === 2 ? { tipo: "valore", messaggio: "Prezzo non valido." } : null));
    const y = await A.impostaStockDiTutte(g2.esegui, nuove, "4", "rettifica");
    c("un errore su una riga (non di sessione) non ferma le altre: 5 su 6, la riga dice perché", [true, true], [/^Fatto per 5 righe su 6\./.test(y.testo), /Prezzo non valido/.test(y.testo)]);
  }

  // ── il costo senza migrazione: la colonna è spenta e il server lo ribadisce ──
  {
    const { db, id, p } = await semplice({ senzaColonne: { shop_varianti: ["costo_cent"] } }, false);
    c("senza la migrazione del costo il prodotto semplice si crea lo stesso (senza costo)", true, !!id);
    const sc = await scheda(db, id);
    c("…la scheda dice `costoDisponibile:false` e `costi` vuoto: l'editor spegne la colonna", [false, {}], [sc.costoDisponibile, sc.costi]);
    const v = sc.varianti[0];
    const base = P.rigaDa(v, undefined);
    c("…e `lavoroRiga` con la colonna spenta non manda il costo nemmeno se è scritto", { campi: null, giacenza: null }, P.lavoroRiga(v, base, { ...base, costo: "9,90" }, { senzaPrezzo: false, costoDisponibile: false }));
    const diretto = await p.esegui("variante_salva", { prodottoId: id, variante: { id: v.id, costoCent: 990 } });
    c("…se qualcuno lo mandasse lo stesso, il server dice «Per il costo serve un aggiornamento del database»", [false, "migrazione", true], [diretto.ok, diretto.errore?.tipo, /Per il costo serve un aggiornamento del database/.test(diretto.errore?.messaggio ?? "")]);
  }
}
