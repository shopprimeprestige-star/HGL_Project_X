/** ── NEGOZIO · T10 · LE ROTTE DEL CMS E LO SMISTAMENTO ─────────────────────
 *  `src/routes/api.crm.negozio.ts` e `api.crm.negozio-media.ts` sono sottili (come `api.crm.ordini.ts`): collegano le porte e basta.
 *  Lo smistamento delle azioni (T08 prodotti, T09 giacenza/categorie/interruttori) è in `src/crm/negozio/smista.server.ts`,
 *  che si prova qui con i moduli veri e il finto database. Le rotte si provano sul SORGENTE (guardia, nessuna cancellazione,
 *  nessuna intestazione CORS, nessun log con oggetti). Dati inventati. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tabelleProva, uuid } from "./dati.mjs";
import { guardiaOk, guardiaNo, post, get, leggi } from "./_server.mjs";

const togliCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

export async function prove(mod, { c, gruppo, radice }) {
  const S = mod["negozio/smista.server"];
  const P = mod["negozio/prodotti.server"], G = mod["negozio/giacenza.server"], K = mod["negozio/categorie.server"], I = mod["negozio/interruttori.server"];
  gruppo("NEGOZIO · LE ROTTE DEL CMS E LO SMISTAMENTO (20/11/2026)");
  const V5 = uuid(0x300);

  /** Un ambiente: database finto, guardia che conta le chiamate, log. */
  const ambiente = (opz = {}) => {
    const db = opz.db ?? fintoDb({ tabelle: tabelleProva() });
    const conta = { guardia: 0, log: [] };
    const d = {
      guardia: async (r) => { conta.guardia++; return (opz.guardia ?? guardiaOk())(r); },
      db, adesso: () => new Date("2026-11-20T12:00:00.000Z"), log: (x) => conta.log.push(x),
      chiaveServizio: () => "chiave-di-prova", fattiEsterni: () => ({ bannerPresente: true }),
    };
    return { db, d, conta, log: conta.log };
  };
  const POST = async (corpo, opz) => { const a = ambiente(opz); return { ...a, ...(await leggi(await S.gestisciPOST(post(corpo), a.d))) }; };
  const GET = async (q, opz) => { const a = ambiente(opz); return { ...a, ...(await leggi(await S.gestisciGET(get(q), a.d))) }; };

  // ── la guardia: una volta, per prima, per ogni strada ──
  const tutteLeAzioni = [...P.AZIONI_PRODOTTI, ...G.AZIONI_GIACENZA, ...K.AZIONI_CATEGORIE, ...I.AZIONI_INTERRUTTORI];
  const letture = ["prodotti", `prodotto=${V5}`, "categorie", "interruttori", "boh"];
  for (const stato of [401, 403]) {
    const esiti = [];
    for (const azione of tutteLeAzioni) { const r = await POST({ azione }, { guardia: guardiaNo(stato) }); esiti.push([r.stato, r.db.chiamate, r.conta.guardia, r.log.length]); }
    for (const q of letture) { const r = await GET(q, { guardia: guardiaNo(stato) }); esiti.push([r.stato, r.db.chiamate, r.conta.guardia, 0]); }
    c(`guardia negata (${stato}) su ognuna delle ${tutteLeAzioni.length} azioni e delle ${letture.length} letture: risposta della guardia, ZERO chiamate al database`, true, esiti.every(([s, ch, g]) => s === stato && ch === 0 && g === 1));
  }
  const gl = await POST({ azione: "giacenza_muovi", varianteId: V5, delta: 1, motivo: "carico" });
  c("la guardia è chiamata UNA volta sola per richiesta (i moduli non la rifanno), e l'azione riesce", [1, 200, true], [gl.conta.guardia, gl.stato, gl.corpo.ok]);
  const gv = await GET("categorie");
  c("…anche in lettura", [1, true], [gv.conta.guardia, gv.corpo.ok]);
  const guardiaCheLancia = await POST({ azione: "giacenza_muovi" }, { guardia: async () => { throw new Error("rete caduta con dati veri"); } });
  c("guardia che lancia → 500 «interno» in JSON, database mai toccato, nel log solo il nome del tipo", [500, "interno", 0, ["eccezione Error"], false], [guardiaCheLancia.stato, guardiaCheLancia.corpo.motivo, guardiaCheLancia.db.chiamate, guardiaCheLancia.log, /rete|dati/.test(JSON.stringify(guardiaCheLancia.corpo))]);

  // ── ogni azione arriva al suo modulo ──
  const contate = new Map();
  for (const a of tutteLeAzioni) contate.set(a, (contate.get(a) ?? 0) + 1);
  c("nessuna azione compare in due moduli (lo smistamento sarebbe ambiguo)", [], [...contate].filter(([, n]) => n > 1).map(([a]) => a));
  c("l'elenco di S.AZIONI_NEGOZIO è l'unione esatta degli elenchi dei moduli", [...tutteLeAzioni].sort(), [...S.AZIONI_NEGOZIO].sort());
  const proprie = { prodotti: P.AZIONI_PRODOTTI, giacenza: G.AZIONI_GIACENZA, categorie: K.AZIONI_CATEGORIE, interruttori: I.AZIONI_INTERRUTTORI };
  for (const [modulo, elenco] of Object.entries(proprie)) {
    const sbagliate = [];
    for (const azione of elenco) {
      const r = await POST({ azione });
      const frase = String(r.corpo.frase);
      // un corpo vuoto: il modulo giusto lo rifiuta per i campi mancanti; il «non esiste» è la risposta di chi non la conosce
      if (r.corpo.motivo === "azione_sconosciuta" || frase === "Questa azione non esiste.") sbagliate.push(azione);
    }
    c(`le azioni di ${modulo} (${elenco.length}) sono tutte riconosciute dal loro modulo`, [], sbagliate);
  }
  const g1 = await POST({ azione: "giacenza_muovi", varianteId: V5, delta: 3, motivo: "carico" });
  c("giacenza_muovi: passa dal modulo della giacenza (la funzione SQL, non una scrittura)", [200, 8, ["shop_giacenza_muovi"]], [g1.stato, g1.corpo.giacenza, g1.db.registro.filter((q) => q.op === "rpc").map((q) => q.nome)]);
  const k1 = await POST({ azione: "categoria_salva", nome: "Dallo smistamento" });
  c("categoria_salva: crea la categoria", [true, 2], [k1.corpo.ok, k1.db.tabelle.shop_categorie.length]);
  const i1 = await POST({ azione: "interruttore_imposta", chiave: "giacenza_bassa", valore: 4, atteso: 3 });
  c("interruttore_imposta: cambia l'interruttore", [true, 4], [i1.corpo.ok, i1.db.tabelle.shop_impostazioni.find((r) => r.chiave === "giacenza_bassa").valore]);
  const p1 = await GET("prodotti");
  c("GET ?prodotti → il modulo dei prodotti", [200, true], [p1.stato, p1.corpo.ok]);
  const k2 = await GET("categorie");
  c("GET ?categorie → il modulo delle categorie", [true, 1], [k2.corpo.ok, k2.corpo.categorie?.length]);
  const i2 = await GET("interruttori");
  c("GET ?interruttori → il modulo degli interruttori", [true, "codice"], [i2.corpo.ok, i2.corpo.interruttori?.catalogo_sito?.valore]);
  const nl = await GET("boh");
  c("GET che non so leggere → 400, niente di scritto", [400, false, 0], [nl.stato, nl.corpo.ok, nl.db.scritture.length]);

  // ── azioni che non esistono: elenco chiuso, non un oggetto che eredita ──
  for (const strana of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf", "prototype", "", " giacenza_muovi", "GIACENZA_MUOVI", "giacenza_muovi\u0000", null, 5, true, ["giacenza_muovi"], { x: 1 }]) {
    const r = await POST({ azione: strana, varianteId: V5, delta: 1, motivo: "carico" });
    c(`azione ${JSON.stringify(strana)} → 400, database mai toccato`, [400, false, 0], [r.stato, r.corpo.ok, r.db.chiamate]);
  }
  for (const corpo of ["{non json", "[]", "null", "5", "\"giacenza_muovi\"", ""]) {
    const r = await POST(corpo);
    c(`corpo ${JSON.stringify(corpo).slice(0, 20)} → 400, database mai toccato`, [400, 0], [r.stato, r.db.chiamate]);
  }
  const enorme = await POST(JSON.stringify({ azione: "giacenza_muovi", nota: "x".repeat(150_000) }));
  c("corpo di 150 mila segni → rifiutato, database mai toccato", [true, 0], [enorme.stato === 400 || enorme.stato === 413, enorme.db.chiamate]);
  const intest = new Request("https://sito.test/api/crm/negozio", { method: "POST", headers: { "content-type": "application/json", "content-length": "999999" }, body: "{}" });
  const a413 = ambiente();
  c("content-length dichiarato enorme → 413 prima di leggere, database mai toccato", [413, 0], [(await S.gestisciPOST(intest, a413.d)).status, a413.db.chiamate]);

  // ── il corpo si legge a pezzi e ci si ferma al tetto (anche senza Content-Length) ──
  const flusso = (dimensionePezzo, contatore) => new ReadableStream({
    pull(ctrl) { contatore.letti++; ctrl.enqueue(new TextEncoder().encode("x".repeat(dimensionePezzo))); if (contatore.letti > 20000) ctrl.close(); },
  });
  const richiestaFlusso = (contatore, extra = {}) => new Request("https://sito.test/api/crm/negozio", { method: "POST", headers: { "content-type": "application/json", ...extra }, body: flusso(1000, contatore), duplex: "half" });
  for (const [nome, gestore, tetto] of [["smistamento (tetto 100 mila)", (r, a) => S.gestisciPOST(r, a.d), 100_000], ["giacenza (tetto 20 mila)", (r, a) => G.gestisciPOST(r, a.d), 20_000], ["categorie (tetto 20 mila)", (r, a) => K.gestisciPOST(r, a.d), 20_000]]) {
    const cont = { letti: 0 }, a = ambiente();
    const r = await leggi(await gestore(richiestaFlusso(cont), a));
    c(`corpo senza Content-Length che non finisce mai, ${nome}: rifiutato (413) e si smette di leggere poco oltre il tetto`, [413, false, true, 0], [r.stato, r.corpo.ok, cont.letti <= tetto / 1000 + 5, a.db.chiamate]);
  }
  {
    const cont = { letti: 0 }, a = ambiente();
    const r = await S.gestisciPOST(richiestaFlusso(cont, { "content-length": "999999" }), a.d);
    c("Content-Length oltre il tetto: 413 senza leggere il corpo (al più il primo pezzo che il flusso prepara da sé)", [413, true], [r.status, cont.letti <= 2]);
  }

  // ── la guardia viene PRIMA di leggere il corpo: con la guardia negata il flusso non si tocca ──
  for (const stato of [401, 403]) {
    const cont = { letti: 0 }, a = ambiente({ guardia: guardiaNo(stato) });
    const r = await S.gestisciPOST(richiestaFlusso(cont), a.d);
    c(`guardia negata (${stato}) con un corpo che non finisce mai: risposta della guardia e il corpo NON si legge (al più il primo pezzo che il flusso prepara da sé)`, [stato, true, 0], [r.status, cont.letti <= 2, a.db.chiamate]);
  }

  // ── le rotte, sul sorgente ──
  const dir = join(radice, "src/routes");
  const rotte = { "api.crm.negozio.ts": "/api/crm/negozio", "api.crm.negozio-media.ts": "/api/crm/negozio-media" };
  for (const [file, percorso] of Object.entries(rotte)) {
    const grezzo = readFileSync(join(dir, file), "utf8");
    const t = togliCommenti(grezzo);
    c(`${file}: è la rotta ${percorso}`, true, t.includes(`createFileRoute("${percorso}")`));
    c(`${file}: la guardia è guardiaCRM con il permesso «pagamenti»`, true, /guardiaCRM\(request, \{\}, "pagamenti"/.test(t));
    c(`${file}: ogni gestore è una sola chiamata al modulo (nessuna logica nella rotta, la guardia è la prima cosa che il modulo fa)`, true,
      [...t.matchAll(/(GET|POST): \(\{ request \}\) => (\w+)\(request, dipendenze\)/g)].length === (file === "api.crm.negozio.ts" ? 2 : 1) && (t.match(/(GET|POST):/g) ?? []).length === (file === "api.crm.negozio.ts" ? 2 : 1));
    c(`${file}: nessuna cancellazione, nessuna scrittura diretta, nessuna lettura (tutto sta nei moduli)`, [], [".delete(", ".insert(", ".update(", ".upsert(", ".rpc(", ".from(\"shop"].filter((x) => t.includes(x)));
    c(`${file}: nessuna intestazione CORS`, false, /Access-Control|cors/i.test(t));
    c(`${file}: nessun console.log, e il log scrive solo il codice (mai un oggetto)`, [false, true], [/console\.log\(/.test(t), /log: \(codice\) => console\.warn\(`\[negozio(-media)?\] \$\{codice\}`\)/.test(t)]);
    c(`${file}: nessuna chiave scritta nel codice`, false, /eyJ[A-Za-z0-9_-]{20,}|sk_(live|test)_|service_role_key\s*[:=]\s*["'`]/i.test(t));
    c(`${file}: usa il client di servizio del server`, true, t.includes("supabaseAdmin"));
  }
  const rn = togliCommenti(readFileSync(join(dir, "api.crm.negozio.ts"), "utf8"));
  c("api.crm.negozio.ts: la chiave dell'anteprima si legge dall'ambiente del Worker, mai scritta", true, rn.includes("process.env.SUPABASE_SERVICE_ROLE_KEY"));
  c("api.crm.negozio.ts: i fatti del R2 (pagamento, spedizione e resi, email, M2) non vengono dichiarati veri dalla rotta", false, /(pagamentoIncassa|spedizioneResi|emailConferma|migrazioneOrdini)\s*:\s*true/.test(rn));
  c("api.crm.negozio.ts: l'errore della guardia porta la forma che il client si aspetta (extra prodotti: [])", true, /extra: \{ prodotti: \[\] \}/.test(rn));
  const rm = togliCommenti(readFileSync(join(dir, "api.crm.negozio-media.ts"), "utf8"));
  c("api.crm.negozio-media.ts: il permesso si chiede allo Storage con createSignedUploadUrl (solo caricamento, mai una lettura firmata)", [true, false], [rm.includes("createSignedUploadUrl"), /createSignedUrl\(|download\(/.test(rm)]);
  c("api.crm.negozio-media.ts: createSignedUploadUrl senza opzioni e MAI con upsert: un file che c'è già non si sovrascrive", [1, false], [[...rm.matchAll(/createSignedUploadUrl\(path\)/g)].length, /upsert/i.test(rm)]);
  c("api.crm.negozio-media.ts: se lo Storage risponde con un errore, la porta lancia (il modulo risponde 500 senza ripetere nulla)", true, /throw new Error/.test(rm));
  const sm = togliCommenti(readFileSync(join(radice, "src/crm/negozio/smista.server.ts"), "utf8"));
  c("smista.server.ts: l'azione si cerca con Object.hasOwn, non con `in` né con un oggetto che eredita", [true, false], [sm.includes("Object.hasOwn"), /\bin\s+(perAzione|SMISTA|AZIONI)/.test(sm)]);
  c("smista.server.ts: importabile senza ambiente (niente process.env, niente client del server)", [false, false], [/process\.env/.test(sm), /client\.server/.test(sm)]);
}
