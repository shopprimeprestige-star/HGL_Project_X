/** ── EDITOR PRODOTTI · E3 · L'IMPORT SULLA ROTTA `/api/crm/negozio` ───────────────────────────────────────────────────
 *  PIANO §1.4: l'import è il quinto modulo dello smistamento (`smista.server.ts`), con l'elenco suo (`AZIONI_IMPORT_ROTTA`) escluso da
 *  `AZIONI_NEGOZIO`, così `rotte.mjs` (che prova la guardia solo sulle azioni di `AZIONI_NEGOZIO`) resta com'è. Per questo la prova
 *  «guardia negata o che lancia → zero chiamate al database» per ENTRAMBE le azioni dell'import si rifà qui, passando dallo smistamento.
 *  Dati inventati, database finto, nessuna rete. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tabelleProva, uuid } from "./dati.mjs";
import { guardiaOk, guardiaNo, post, get, leggi } from "./_server.mjs";

const togliCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const byte = (o) => new TextEncoder().encode(typeof o === "string" ? o : JSON.stringify(o)).length;

export async function prove(mod, { c, gruppo, radice }) {
  const S = mod["negozio/smista.server"];
  const I = mod["negozio/import.server"];
  const P = mod["negozio/prodotti.server"], G = mod["negozio/giacenza.server"], K = mod["negozio/categorie.server"], N = mod["negozio/interruttori.server"], E = mod["negozio/spedizioni.server"];
  gruppo("EDITOR PRODOTTI · E3 · L'IMPORT SULLA ROTTA (25/11/2026)");
  c("lo smistamento esporta `AZIONI_IMPORT_ROTTA`: le due azioni dell'import, le stesse del modulo", [["prodotti_importa_verifica", "prodotti_importa"], true], [[...(S.AZIONI_IMPORT_ROTTA ?? [])], JSON.stringify(S.AZIONI_IMPORT_ROTTA) === JSON.stringify(I?.AZIONI_IMPORT)]);
  if (!S.AZIONI_IMPORT_ROTTA) return;

  const ambiente = (opz = {}) => {
    const db = opz.db ?? fintoDb({ tabelle: tabelleProva(), ...(opz.finto ?? {}) });
    const conta = { guardia: 0, log: [] };
    const d = {
      guardia: async (r) => { conta.guardia++; return (opz.guardia ?? guardiaOk("Giulia Esempio"))(r); },
      db, adesso: () => new Date("2026-11-25T10:00:00.000Z"), log: (x) => conta.log.push(x),
      chiaveServizio: () => "chiave-di-prova", fattiEsterni: () => ({ bannerPresente: true }),
    };
    return { db, d, conta, log: conta.log };
  };
  const POST = async (corpo, opz) => { const a = ambiente(opz); return { ...a, ...(await leggi(await S.gestisciPOST(post(corpo), a.d))) }; };
  const GET = async (q, opz) => { const a = ambiente(opz); return { ...a, ...(await leggi(await S.gestisciGET(get(q), a.d))) }; };
  const variante = (riga, sku, extra = {}) => ({ riga, sku, nome: "Unica", opzioni: {}, prezzoCent: null, pesoG: null, gtin: null, costoCent: null, giacenza: 0, ...extra });
  const prodotto = (n, extra = {}) => ({ handle: `rotta-${n}`, titolo: `Prodotto da rotta ${n}`, tipo: "cura", categorie: [], sku: `ROT-${n}`, prezzoCent: 1990, varianti: [variante(2, `ROT-${n}`)], ...extra });

  // ── la guardia: una volta, per prima, su ENTRAMBE le azioni ──
  const corpi = { prodotti_importa_verifica: { slugs: ["prodotto-di-prova"], skus: ["PROVA-001"] }, prodotti_importa: { prodotti: [prodotto(1)] } };
  for (const stato of [401, 403]) {
    const esiti = [];
    for (const azione of S.AZIONI_IMPORT_ROTTA) { const r = await POST({ azione, ...corpi[azione] }, { guardia: guardiaNo(stato) }); esiti.push([r.stato, r.db.chiamate, r.conta.guardia, r.log.length]); }
    c(`guardia negata (${stato}) su prodotti_importa_verifica e prodotti_importa: risposta della guardia, ZERO chiamate al database, guardia chiamata una volta`, [[stato, 0, 1, 0], [stato, 0, 1, 0]], esiti);
  }
  const esitiLancia = [];
  for (const azione of S.AZIONI_IMPORT_ROTTA) {
    const r = await POST({ azione, ...corpi[azione] }, { guardia: async () => { throw new Error("rete caduta con dati veri"); } });
    esitiLancia.push([r.stato, r.corpo.motivo, r.db.chiamate, r.log, /rete|dati/.test(JSON.stringify(r.corpo))]);
  }
  c("guardia che lancia, su entrambe le azioni: 500 «interno» in JSON, database mai toccato, nel log solo il nome del tipo", [[500, "interno", 0, ["eccezione Error"], false], [500, "interno", 0, ["eccezione Error"], false]], esitiLancia);

  // ── l'elenco di sempre non cambia ──
  const unione = [...P.AZIONI_PRODOTTI, ...G.AZIONI_GIACENZA, ...K.AZIONI_CATEGORIE, ...N.AZIONI_INTERRUTTORI];
  c("AZIONI_NEGOZIO resta l'unione dei quattro moduli di prima: nessuna azione dell'import ci entra (rotte.mjs resta com'è)", [[...unione].sort(), []], [[...S.AZIONI_NEGOZIO].sort(), S.AZIONI_NEGOZIO.filter((a) => S.AZIONI_IMPORT_ROTTA.includes(a))]);
  c("AZIONI_SPEDIZIONI_ROTTA non cambia, e le azioni dell'import non stanno in nessun altro modulo", [[...E.AZIONI_SPEDIZIONI], []], [[...S.AZIONI_SPEDIZIONI_ROTTA], S.AZIONI_IMPORT_ROTTA.filter((a) => [...unione, ...E.AZIONI_SPEDIZIONI].includes(a))]);

  // ── le azioni arrivano al modulo dell'import (e le altre non ci vanno) ──
  const v = await POST({ azione: "prodotti_importa_verifica", slugs: ["prodotto-di-prova"], skus: ["PROVA-001-A"] });
  c("verifica dalla rotta: arriva al modulo dell'import, una sola guardia, nessuna scrittura", [200, true, 1, 1, 1, 0], [v.stato, v.corpo.ok, v.conta.guardia, v.corpo.presenti?.length, v.corpo.skuUsati?.length, v.db.scritture.length]);
  const m = await POST({ azione: "prodotti_importa", prodotti: [prodotto(2, { categorie: ["categoria-prova"], varianti: [variante(2, "ROT-2", { giacenza: 4 })] })] });
  const creato = m.db.tabelle.shop_prodotti.find((r) => r.slug === "rotta-2");
  c("import dalla rotta: il prodotto entra in bozza, la giacenza è un carico col nome della guardia", [200, ["creato"], "bozza", [4], ["Giulia Esempio"], 1], [
    m.stato, m.corpo.risultati?.map((r) => r.esito), creato?.stato, m.db.tabelle.shop_giacenza_movimenti.map((x) => x.delta), m.db.tabelle.shop_giacenza_movimenti.map((x) => x.chi), m.conta.guardia,
  ]);
  const g = await POST({ azione: "giacenza_muovi", varianteId: uuid(0x300), delta: 1, motivo: "carico" });
  c("le azioni degli altri moduli vanno ancora ai loro moduli (giacenza_muovi passa dalla funzione SQL, non dall'import)", [200, ["shop_giacenza_muovi"]], [g.stato, g.db.registro.filter((q) => q.op === "rpc").map((q) => q.nome)]);
  const proto = [];
  for (const azione of ["constructor", "__proto__", "toString", "hasOwnProperty"]) { const r = await POST({ azione }); proto.push([r.stato, r.db.scritture.length]); }
  c("nomi di azione che l'oggetto eredita (constructor, __proto__, toString…) → 400, mai l'import, niente scritto", [[400, 0], [400, 0], [400, 0], [400, 0]], proto);
  const lettura = await GET("prodotti_importa_verifica");
  c("l'import non ha letture: GET ?prodotti_importa_verifica → 400, niente scritto", [400, 0], [lettura.stato, lettura.db.scritture.length]);

  // ── il tetto del corpo: 200 000 byte, anche dallo smistamento ──
  const grande = (n) => prodotto(n, {
    descrizioneBreve: "Testo di prova per la descrizione breve. ".repeat(10).trim().slice(0, 300),
    descrizioneLunga: "Una riga di descrizione inventata per misurare la richiesta. ".repeat(100).slice(0, 5000).trim(),
    seoDescrizione: "Descrizione per i motori di ricerca, inventata. ".repeat(12).slice(0, 500).trim(),
    varianti: Array.from({ length: 50 }, (_, k) => variante(2 + k, `RG-${n}-${k}`, { nome: `Variante numero ${k} del prodotto ${n}`, opzioni: { Colore: `Colore ${k}`, Misura: `Misura ${k}` }, giacenza: 1, costoCent: 100 + k, gtin: "8012345678905", pesoG: 100 })),
  });
  const gruppo75 = Array.from({ length: 5 }, (_, i) => grande(10 + i));
  const peso = byte({ azione: "prodotti_importa", prodotti: gruppo75 });
  const g75 = await POST({ azione: "prodotti_importa", prodotti: gruppo75 });
  c(`un gruppo di 5 prodotti da ~75 KB (${peso} byte) passa dallo smistamento e dal modulo`, [true, 200, ["creato", "creato", "creato", "creato", "creato"]], [peso > 70_000 && peso < 100_000, g75.stato, g75.corpo.risultati?.map((r) => r.esito)]);
  const pad = (n) => JSON.stringify({ azione: "prodotti_importa", prodotti: [], x: "a".repeat(n) });
  const n0 = 200_000 - byte(pad(0));
  const sopra = await POST(pad(n0 + 1));
  c("oltre 200 000 byte → 413 dallo smistamento, database mai toccato", [413, 0], [sopra.stato, sopra.db.chiamate]);

  // ── il sorgente ──
  const sm = togliCommenti(readFileSync(join(radice, "src/crm/negozio/smista.server.ts"), "utf8"));
  c("smista.server.ts: il modulo `importa` è registrato, l'elenco suo è escluso da AZIONI_NEGOZIO, si cerca ancora con Object.hasOwn", [true, true, true, true], [
    /from "\.\/import\.server"/.test(sm), /AZIONI_IMPORT_ROTTA/.test(sm), /AZIONI_IMPORT\b[\s\S]{0,200}includes\(a\)|includes\(a\)[\s\S]{0,200}AZIONI_IMPORT\b/.test(sm), sm.includes("Object.hasOwn"),
  ]);
  c("smista.server.ts: nessun `delete`, niente process.env", [false, false], [/\bdelete\b/i.test(sm), /process\.env/.test(sm)]);
}
