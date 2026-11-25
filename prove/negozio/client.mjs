/** ── NEGOZIO · T13 · IL CLIENTE DEL CRM PER IL NEGOZIO ──────────────────────
 *  `src/crm/negozio/client.ts` (puro: riceve `fetch` e le «porte» del tempo) parla con `/api/crm/negozio` e
 *  `/api/crm/negozio-media` (contratto §3.3): indirizzi, frasi per ogni errore, rilettura, 409. Schema di
 *  `crm/ecommerce/client.ts`. Nessuna rete vera, nessun timer vero: risposte finte e un orologio a mano.
 *  Dati inventati. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ID = "00000000-0000-4000-8000-000000000200";
const risposta = (corpo, stato = 200) => new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status: stato });
/** Un `fetch` finto che risponde con la prossima voce della coda (una `Response`, una funzione o un errore) e ricorda le chiamate. */
function fetchFinto(...coda) {
  const chiamate = [];
  const f = async (url, init) => {
    chiamate.push({ url, init });
    const x = coda.length > 1 ? coda.shift() : coda[0];
    if (x instanceof Error) throw x;
    return typeof x === "function" ? x() : x.clone();
  };
  f.chiamate = chiamate;
  return f;
}
/** Un fetch che resta in attesa finché non si risolve a mano. */
function fetchSospeso() {
  const chiamate = [];
  const f = (url, init) => new Promise((ok) => chiamate.push({ url, init, ok }));
  f.chiamate = chiamate;
  return f;
}
const sfiata = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); };
const riga = (n, extra = {}) => ({ id: `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`, sku: `PROVA-00${n}`, slug: `prodotto-${n}`, nome: `Prodotto ${n}`, tipo: "cura", stato: "bozza", origine: null, prezzoCent: 2890, versione: "2026-11-20T10:00:00.000Z", haModifiche: false, motivo: null, ...extra });
const elenco = (...prodotti) => ({ ok: true, prodotti });
const oraDi = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

function porteFinte() {
  const p = { t: 1_000_000, visibile: true, timer: new Map(), ascoltatori: new Set(), prossimo: 1 };
  const porte = {
    visibile: () => p.visibile,
    adesso: () => p.t,
    imposta: (fn, ms) => { const h = p.prossimo++; p.timer.set(h, { fn, quando: p.t + ms }); return h; },
    annulla: (h) => { p.timer.delete(h); },
    ascolta: (fn) => { p.ascoltatori.add(fn); return () => p.ascoltatori.delete(fn); },
  };
  p.avanza = async (ms) => {
    const fine = p.t + ms;
    for (;;) {
      const scaduti = [...p.timer.entries()].filter(([, x]) => x.quando <= fine).sort((a, b) => a[1].quando - b[1].quando);
      if (!scaduti.length) break;
      const [h, x] = scaduti[0];
      p.timer.delete(h);
      p.t = Math.max(p.t, x.quando);
      x.fn();
      await sfiata();
    }
    p.t = fine;
  };
  return { porte, p };
}

export async function prove(mod, { c, gruppo, radice }) {
  const K = mod["negozio/client"];
  const SRV = mod["negozio/prodotti.server"];
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
  gruppo("NEGOZIO · IL CLIENTE DEL CRM (20/11/2026)");

  // ── gli indirizzi ──
  c("indirizzi: elenco, scheda, categorie, interruttori", ["/api/crm/negozio?prodotti", `/api/crm/negozio?prodotto=${ID}`, "/api/crm/negozio?categorie", "/api/crm/negozio?interruttori"], [K.urlProdotti(), K.urlProdotto(ID), K.urlCategorie(), K.urlInterruttori()]);
  c("indirizzi: elenco con filtri (la ricerca si codifica)", ["/api/crm/negozio?prodotti&segmento=bozze", "/api/crm/negozio?prodotti&q=lace%20front%26x", "/api/crm/negozio?prodotti&segmento=pubblicati&categoria=abc-1&q=ok"],
    [K.urlProdotti({ segmento: "bozze" }), K.urlProdotti({ q: "lace front&x" }), K.urlProdotti({ segmento: "pubblicati", categoria: "abc-1", q: "ok" })]);
  c("indirizzi: «tutti» è il segmento di partenza e non si scrive; ricerca vuota o di soli spazi nemmeno", ["/api/crm/negozio?prodotti", "/api/crm/negozio?prodotti"], [K.urlProdotti({ segmento: "tutti", q: "  " }), K.urlProdotti({})]);
  c("indirizzi: segmento che non esiste o categoria storta → nessun indirizzo", [null, null], [K.urlProdotti({ segmento: "boh" }), K.urlProdotti({ categoria: "a/b" })]);
  c("indirizzi: scheda con un id che non è un id → nessun indirizzo", [null, null, null], [K.urlProdotto("1; drop"), K.urlProdotto(""), K.urlProdotto(`${ID}&x=1`)]);

  // ── lettura dell'elenco ──
  {
    const f = fetchFinto(risposta(elenco(riga(1), riga(2))));
    const r = await K.leggiElenco(f, { segmento: "bozze" });
    c("elenco: le righe, una sola richiesta GET sull'indirizzo giusto", [true, 2, ["/api/crm/negozio?prodotti&segmento=bozze"], [undefined]], [r.ok, r.prodotti.length, f.chiamate.map((x) => x.url), f.chiamate.map((x) => x.init?.method)]);
    const storto = await K.leggiElenco(fetchFinto(risposta({ ok: true })));
    c("elenco: `troncato` arriva, e se manca vale falso", [true, false], [(await K.leggiElenco(fetchFinto(risposta({ ok: true, prodotti: [], troncato: true })))).troncato, (await K.leggiElenco(fetchFinto(risposta(elenco())))).troncato]);
    c("risposta buona ma senza l'elenco → errore «server», non un elenco vuoto", [false, "server"], [storto.ok, storto.errore.tipo]);
    const nessun = fetchFinto(risposta(elenco()));
    c("filtro storto: non parte nessuna richiesta", [false, "valore", 0], await (async () => { const r2 = await K.leggiElenco(nessun, { segmento: "boh" }); return [r2.ok, r2.errore.tipo, nessun.chiamate.length]; })());
    const sc = await K.leggiScheda(fetchFinto(risposta({ ok: true, prodotto: { id: ID }, versione: "v1", varianti: [], media: [], controllo: { bloccanti: [], informativi: [] }, storico: [] })), ID);
    c("scheda: il prodotto e il resto, senza il `ok`", [true, "v1", false], [sc.ok, sc.scheda.versione, "ok" in sc.scheda]);
    const no = fetchFinto(risposta({}));
    c("scheda con un id che non è un id: nessuna richiesta", [false, 0], [(await K.leggiScheda(no, "x/y")).ok, no.chiamate.length]);
    c("scheda: risposta senza prodotto → «server»", "server", (await K.leggiScheda(fetchFinto(risposta({ ok: true })), ID)).errore.tipo);
    const cat = await K.leggiCategorie(fetchFinto(risposta({ ok: true, categorie: [{ id: "c" }] })));
    const int = await K.leggiInterruttori(fetchFinto(risposta({ ok: true, interruttori: { catalogo_sito: "codice" }, condizioni: { puoAprire: false, righe: [] } })));
    c("categorie e interruttori: la risposta passa com'è, senza il `ok` (la forma è di T09)", [true, [{ id: "c" }], true, { catalogo_sito: "codice" }, false], [cat.ok, cat.dati.categorie, int.ok, int.dati.interruttori, "ok" in int.dati]);
    c("…e una risposta che non è un oggetto buono → «server»", ["server", "server"], [(await K.leggiCategorie(fetchFinto(risposta("[]")))).errore.tipo, (await K.leggiInterruttori(fetchFinto(risposta({ ok: false }, 200)))).errore.tipo]);
  }

  // ── gli errori hanno la loro frase ──
  {
    const errore = async (stato, corpo) => (await K.leggiElenco(fetchFinto(risposta(corpo, stato)))).errore;
    const e401 = await errore(401, { ok: false });
    const e403 = await errore(403, { ok: false, prodotti: [] });
    c("401 → «sessione» (rientra), 403 → «permesso» (chiedi a un amministratore); le frasi sono nostre", [["sessione", "permesso"], true, true], [[e401.tipo, e403.tipo], /sessione è scaduta/.test(e401.messaggio), /amministratore/.test(e403.messaggio)]);
    const eRete = (await K.leggiElenco(fetchFinto(new TypeError("Failed to fetch https://crm.example.com/api con Anna")))).errore;
    c("la rete che cade → «rete», con la nostra frase (mai il testo del browser)", ["rete", false], [eRete.tipo, /Anna|Failed/.test(eRete.messaggio)]);
    const eNonJson = await errore(500, "<html>Bad gateway</html>");
    c("una pagina d'errore dell'hosting (non JSON) → «server», frase nostra", ["server", false], [eNonJson.tipo, /html|gateway/i.test(eNonJson.messaggio)]);
    const m = await errore(409, { ok: false, motivo: "migrazione", frase: "Mancano gli aggiornamenti del database del catalogo: chiedi a chi gestisce il database di applicarli." });
    c("409 «migrazione» → la frase del server", ["migrazione", "Mancano gli aggiornamenti del database del catalogo: chiedi a chi gestisce il database di applicarli."], [m.tipo, m.messaggio]);
    const cf = await errore(409, { ok: false, motivo: "conflitto", frase: "Un'altra persona ha modificato questo prodotto." });
    const du = await errore(409, { ok: false, motivo: "duplicato", frase: "Questo SKU è già usato." });
    c("409 «conflitto» e «duplicato» sono due cose diverse", [["conflitto", "duplicato"], "Questo SKU è già usato."], [[cf.tipo, du.tipo], du.messaggio]);
    const np = await errore(422, { ok: false, motivo: "non_pubblicabile", frase: FRASE, bloccanti: [{ campo: "fotoPrincipale", frase: FRASE }] });
    c("422 «non_pubblicabile»: la frase e i bloccanti (il pannello li usa)", ["non_pubblicabile", FRASE, [{ campo: "fotoPrincipale", frase: FRASE }]], [np.tipo, np.messaggio, np.bloccanti]);
    c("503 «chiave», 404, 400 e un `motivo` che non conosciamo → ognuno col suo tipo, o «server»", ["chiave", "non_trovato", "valore", "server"],
      [(await errore(503, { ok: false, motivo: "chiave", frase: "Manca la chiave." })).tipo, (await errore(404, { ok: false, motivo: "non_trovato", frase: "Prodotto non trovato." })).tipo, (await errore(400, { ok: false, motivo: "valore", frase: "Il prezzo non è valido." })).tipo, (await errore(500, { ok: false, motivo: "interno", frase: "Qualcosa non ha funzionato." })).tipo]);
    c("una frase del server troppo lunga si taglia (300); una frase vuota → la nostra", [300, true], [(await errore(400, { ok: false, motivo: "valore", frase: "x".repeat(900) })).messaggio.length, (await errore(400, { ok: false, motivo: "valore", frase: "  " })).messaggio.length > 10]);
    c("sulle 401 e 403 il server non decide la frase (potrebbe contenere altro)", false, /segreto/.test((await errore(403, { ok: false, motivo: "valore", frase: "segreto del server" })).messaggio));
  }

  // ── le azioni ──
  {
    const nomi = [...K.AZIONI_NEGOZIO];
    c("le azioni del server dei prodotti (T08) ci sono tutte", [], [...SRV.AZIONI_PRODOTTI].filter((a) => !nomi.includes(a)));
    const esportate = ["negozio/giacenza.server:AZIONI_GIACENZA", "negozio/categorie.server:AZIONI_CATEGORIE", "negozio/interruttori.server:AZIONI_INTERRUTTORI"].flatMap((x) => { const [m, n] = x.split(":"); return mod[m]?.[n] ? [...mod[m][n]] : []; });
    c("…e quelle esportate dai server di T09 (giacenza, categorie, interruttori), quando ci sono nel ramo", [], esportate.filter((a) => !nomi.includes(a)));
    c("…più quelle di giacenza, categorie e interruttori del contratto §3.3", [], ["giacenza_muovi", "giacenza_imposta", "categoria_salva", "categoria_ordina", "categoria_visibile", "interruttore_imposta", "prodotto_categorie"].filter((a) => !nomi.includes(a)));
    const f = fetchFinto(risposta({ ok: true, versione: "v2", storico: true }));
    const r = await K.eseguiAzione(f, "prodotto_salva", { prodottoId: ID, versione: "v1", campi: { nome: "Nuovo" } });
    c("azione: POST JSON sull'indirizzo, col nome dell'azione e i dati", ["/api/crm/negozio", "POST", "application/json", { azione: "prodotto_salva", prodottoId: ID, versione: "v1", campi: { nome: "Nuovo" } }],
      [f.chiamate[0].url, f.chiamate[0].init.method, f.chiamate[0].init.headers["Content-Type"], JSON.parse(f.chiamate[0].init.body)]);
    c("azione riuscita: `ok`, e i dati della risposta (senza il `ok`)", [true, { versione: "v2", storico: true }], [r.ok, r.dati]);
    const f2 = fetchFinto(risposta({ ok: true }));
    await K.eseguiAzione(f2, "prodotto_stato", { azione: "prodotto_crea", prodottoId: ID, stato: "bozza" });
    c("i dati non possono cambiare il nome dell'azione", "prodotto_stato", JSON.parse(f2.chiamate[0].init.body).azione);
    const f3 = fetchFinto(risposta({ ok: true }));
    const sconosciuta = await K.eseguiAzione(f3, "elimina_tutto", {});
    c("un'azione che non esiste non parte nemmeno", [false, "valore", 0], [sconosciuta.ok, sconosciuta.errore.tipo, f3.chiamate.length]);
    const nonSalvata = await K.eseguiAzione(fetchFinto(risposta({ ok: false, motivo: "conflitto", frase: "Un'altra persona ha modificato questo prodotto." }, 409)), "prodotto_salva", { prodottoId: ID, versione: "v1" });
    c("409 su un'azione: errore «conflitto» con la frase del server", [false, "conflitto", "Un'altra persona ha modificato questo prodotto."], [nonSalvata.ok, nonSalvata.errore.tipo, nonSalvata.errore.messaggio]);
    const bloccata = await K.eseguiAzione(fetchFinto(risposta({ ok: false, motivo: "non_pubblicabile", frase: FRASE, bloccanti: [{ campo: "fotoPrincipale", frase: FRASE }] }, 422)), "prodotto_stato", { prodottoId: ID, stato: "pubblicato" });
    c("pubblicare senza foto: l'errore porta la frase e l'elenco dei bloccanti", ["non_pubblicabile", FRASE, 1], [bloccata.errore.tipo, bloccata.errore.messaggio, bloccata.errore.bloccanti.length]);
    // la versione: le azioni che modificano ciò che la scheda ha visto la vogliono sempre (T09: categoria_salva con id, categoria_visibile, prodotto_categorie)
    const fv = fetchFinto(risposta({ ok: true }));
    const senzaV = [
      await K.eseguiAzione(fv, "prodotto_salva", { prodottoId: ID, campi: {} }),
      await K.eseguiAzione(fv, "categoria_salva", { id: ID, nome: "Patch" }),
      await K.eseguiAzione(fv, "categoria_visibile", { id: ID, visibile: true }),
      await K.eseguiAzione(fv, "prodotto_categorie", { prodottoId: ID, categorie: [] }),
      await K.eseguiAzione(fv, "categoria_salva", { id: ID, nome: "Patch", versione: "" }),
      await K.eseguiAzione(fv, "categoria_visibile", { id: ID, visibile: true, versione: 5 }),
    ];
    c("senza `versione` (o con una che non è testo) queste azioni non partono: «valore» con la frase, nessuna richiesta", [Array(6).fill("valore"), 0, true], [senzaV.map((x) => x.errore?.tipo), fv.chiamate.length, /versione/.test(senzaV[0].errore.messaggio)]);
    const conV = fetchFinto(risposta({ ok: true }));
    await K.eseguiAzione(conV, "categoria_salva", { nome: "Nuova categoria" });
    await K.eseguiAzione(conV, "categoria_visibile", { id: ID, visibile: true, versione: "2026-11-20T10:00:00+00:00" });
    await K.eseguiAzione(conV, "giacenza_muovi", { varianteId: ID, delta: 1, motivo: "carico" });
    c("una categoria NUOVA (senza id) non ha versione e parte; con la versione parte; la giacenza non la vuole", 3, conV.chiamate.length);
    const cancello = await K.eseguiAzione(fetchFinto(risposta({ ok: false, motivo: "cancello", frase: "Lo shop non si può ancora aprire. Manca la cassa.", condizioni: { puoAprire: false, righe: [{ chiave: "cassa", ok: false }] } }, 409)), "interruttore_imposta", { chiave: "catalogo_sito", atteso: "codice", nuovo: "cms" });
    c("aprire lo shop con le condizioni non vere: errore «cancello» con la frase e le righe delle condizioni", ["cancello", "Lo shop non si può ancora aprire. Manca la cassa.", false], [cancello.errore.tipo, cancello.errore.messaggio, cancello.errore.condizioni?.puoAprire]);
    const ar = fetchFinto(risposta(elenco(riga(1))), risposta({ ok: false, motivo: "cancello", frase: "Lo shop non si può ancora aprire.", condizioni: { puoAprire: false } }, 409), risposta(elenco(riga(1))));
    const arch = K.creaArchivioNegozio({ fetch: ar, porte: porteFinte().porte });
    arch.avvia(); await sfiata();
    const rc = await arch.esegui("interruttore_imposta", { chiave: "catalogo_sito", atteso: "codice", nuovo: "cms" });
    await sfiata();
    c("…e l'archivio, dopo un rifiuto del cancello, rilegge (le condizioni possono essere cambiate)", [false, "cancello", 3], [rc.ok, rc.errore.tipo, ar.chiamate.length]);
    // i motivi di T09: ognuno ha il suo tipo, senza finire tutti in «server»
    {
      const e = async (stato, motivo, extra = {}, azione = "categoria_salva") => (await K.eseguiAzione(fetchFinto(risposta({ ok: false, motivo, ...extra }, stato)), azione, { nome: "Capelli" })).errore;
      const slug = await e(409, "slug_occupato", { frase: "Questo indirizzo è già usato da un'altra categoria." });
      c("T09 «slug_occupato» (409) → «duplicato», con la frase del server", ["duplicato", "Questo indirizzo è già usato da un'altra categoria."], [slug.tipo, slug.messaggio]);
      const nuovi = ["slug_bloccato", "giacenza_negativa", "variante_inesistente", "categoria_inesistente", "categoria_mancante"];
      const tipi = [];
      const frasi = [];
      for (const m of nuovi) {
        const x = await e(409, m); // il server non manda la frase: vale la nostra
        tipi.push(x.tipo); frasi.push(x.messaggio);
      }
      c("T09 slug_bloccato, giacenza_negativa, variante_inesistente, categoria_inesistente, categoria_mancante: ognuno il suo tipo", nuovi, tipi);
      c("…ognuno con una frase nostra, diversa dalle altre e non quella generica «server»", [5, true], [new Set(frasi).size, frasi.every((f) => f.length > 20 && !/Qualcosa non ha funzionato/.test(f))]);
      const serv = await e(500, "interno", { frase: "Il database non ha risposto: riprova tra un momento." });
      c("T09 «interno» resta «server»", "server", serv.tipo);
      const cf = await e(409, "conflitto", { frase: "Questo interruttore è stato cambiato.", valore: "cms" }, "interruttore_imposta");
      c("conflitto sull'interruttore: conserva il `valore` attuale (la schermata lo rilegge senza chiamare)", ["conflitto", "cms"], [cf.tipo, cf.valore]);
      const senzaV = await e(409, "conflitto", { frase: "Modificato da altri." }, "prodotto_salva");
      c("un conflitto senza `valore` non ne inventa uno", [false], [Object.hasOwn(senzaV, "valore")]);
      // rilettura: se l'elenco non è più quello che la pagina credeva
      for (const m of ["variante_inesistente", "categoria_inesistente", "giacenza_negativa", "slug_bloccato"]) {
        const ar = fetchFinto(risposta(elenco(riga(1))), risposta({ ok: false, motivo: m, frase: "x" }, 409), risposta(elenco(riga(1))));
        const arch = K.creaArchivioNegozio({ fetch: ar, porte: porteFinte().porte });
        arch.avvia(); await sfiata();
        await arch.esegui("giacenza_muovi", { varianteId: ID, delta: 1, motivo: "carico" });
        await sfiata();
        c(`«${m}»: l'archivio rilegge l'elenco`, 3, ar.chiamate.length);
      }
    }
    // «categoria_foto» (T09 + D36): la foto in tre misure; il client non fa partire una richiesta che il server rifiuterebbe di sicuro
    {
      const FOTO = { categoriaId: ID, path480: "foto/a1.jpg", path960: "foto/a2.jpg", path1600: "foto/a3.jpg", alt: "Una foto" };
      const V = "2026-11-20T10:00:00+00:00";
      const f = fetchFinto(risposta({ ok: true }));
      const senza = await K.eseguiAzione(f, "categoria_foto", FOTO);
      c("categoria_foto senza `versione`: non parte, errore «valore»", [false, "valore", 0], [senza.ok, senza.errore.tipo, f.chiamate.length]);
      const con = await K.eseguiAzione(f, "categoria_foto", { ...FOTO, versione: V });
      c("categoria_foto con `categoriaId`, tre misure, `alt` e `versione`: parte come POST, col nome dell'azione", [true, 1, "categoria_foto"], [con.ok, f.chiamate.length, JSON.parse(f.chiamate[0].init.body).azione]);
      const corpo = JSON.parse(f.chiamate[0].init.body);
      c("…e il corpo porta le tre misure e l'alt come sono", [FOTO.path480, FOTO.path960, FOTO.path1600, FOTO.alt, ID], [corpo.path480, corpo.path960, corpo.path1600, corpo.alt, corpo.categoriaId]);
      c("…ed è nell'elenco delle azioni", true, K.AZIONI_NEGOZIO.includes("categoria_foto"));
      // la forma vecchia (una sola misura, `id`) o incompleta non parte: il server la rifiuterebbe
      const g = fetchFinto(risposta({ ok: true }));
      const storte = {
        "con `id` al posto di `categoriaId`": (({ categoriaId, ...r }) => ({ ...r, id: categoriaId }))(FOTO),
        "con la sola `path` (una misura)": { categoriaId: ID, path: "foto/x.jpg", alt: "Una foto" },
        "senza `path480`": { ...FOTO, path480: undefined },
        "senza `path960`": { ...FOTO, path960: "" },
        "senza `path1600`": { ...FOTO, path1600: 5 },
        "senza `alt`": { ...FOTO, alt: "   " },
        "con `categoriaId` non valido": { ...FOTO, categoriaId: "../x" },
      };
      for (const [nome, dati] of Object.entries(storte)) {
        const r = await K.eseguiAzione(g, "categoria_foto", { ...dati, versione: V });
        c(`categoria_foto ${nome}: non parte, errore «valore»`, [false, "valore"], [r.ok, r.errore?.tipo]);
      }
      c("…nessuna delle storte ha chiamato il server", 0, g.chiamate.length);
    }
    // 502/503/504 senza `motivo` (timeout dell'hosting) su un'azione: può aver scritto, come la rete caduta
    {
      const t = [];
      for (const st of [502, 503, 504]) t.push((await K.eseguiAzione(fetchFinto(risposta("<html>Gateway Timeout</html>", st)), "prodotto_salva", { prodottoId: ID, versione: "v1" })).errore);
      c("502, 503 e 504 non JSON su un'azione: «non so se è stata salvata»", [[true, true, true], false], [t.map((x) => /Non so se la modifica sia stata salvata/.test(x.messaggio)), t.some((x) => /html|gateway/i.test(x.messaggio))]);
      const x500 = (await K.eseguiAzione(fetchFinto(risposta("<html>boom</html>", 500)), "prodotto_salva", { prodottoId: ID, versione: "v1" })).errore;
      c("un 500 non JSON resta «server» (il server non ha scritto)", [ "server", false], [x500.tipo, /Non so se/.test(x500.messaggio)]);
      const c503 = (await K.eseguiAzione(fetchFinto(risposta({ ok: false, motivo: "chiave", frase: "Manca la chiave." }, 503)), "anteprima_chiave", { prodottoId: ID })).errore;
      c("un 503 col suo `motivo` (chiave) resta «chiave»", ["chiave", "Manca la chiave."], [c503.tipo, c503.messaggio]);
      c("una LETTURA con 504 non dice «non so se è stata salvata» (non scrive niente)", false, /Non so se/.test((await K.leggiElenco(fetchFinto(risposta("<html>", 504)))).errore.messaggio));
    }
    const rete = await K.eseguiAzione(fetchFinto(new TypeError("Failed to fetch")), "prodotto_salva", { prodottoId: ID, versione: "v1" });
    c("rete caduta durante un'azione: non si sa se è stata salvata, e lo dice", ["rete", true], [rete.errore.tipo, /Non so se la modifica sia stata salvata/.test(rete.errore.messaggio)]);
    c("un'azione riuscita che porta un avviso (liberatoria revocata) lo lascia passare", [true, true, "x"], await (async () => {
      const a = await K.eseguiAzione(fetchFinto(risposta({ ok: true, avviso: "x", tornatoInBozza: true })), "media_rimuovi", { mediaId: ID, liberatoriaRevocata: true });
      return [a.ok, a.dati.tornatoInBozza, a.dati.avviso];
    })());
    c("risposta 200 senza `ok:true` → «server», mai un finto successo", [false, "server"], ((a) => [a.ok, a.errore.tipo])(await K.eseguiAzione(fetchFinto(risposta({ ok: false })), "prodotto_salva", { versione: "v1" })));
  }

  // ── il permesso di caricamento e il caricamento ──
  {
    const buono = { ok: true, bucket: "shop-media", path: "p/aB3xK9mQ2zLw-480.jpg", token: "gettone-di-prova", url: "https://storage.example.com/object/upload/sign/shop-media/p/aB3xK9mQ2zLw-480.jpg?token=gettone-di-prova" };
    const f = fetchFinto(risposta(buono));
    const r = await K.chiediPermesso(f, { tipo: "foto", mime: "image/jpeg", peso: 180_000 });
    c("permesso: POST su /api/crm/negozio-media con tipo, mime e peso", ["/api/crm/negozio-media", "POST", { tipo: "foto", mime: "image/jpeg", peso: 180000 }, true, "shop-media"], [f.chiamate[0].url, f.chiamate[0].init.method, JSON.parse(f.chiamate[0].init.body), r.ok, r.permesso.bucket]);
    const f2 = fetchFinto(risposta({ ok: true, bucket: "shop-media" }));
    c("permesso incompleto (senza indirizzo o gettone) → «server»", "server", (await K.chiediPermesso(f2, { tipo: "foto", mime: "image/jpeg", peso: 1 })).errore.tipo);
    const f3 = fetchFinto(risposta({}));
    c("tipo o peso storti: non parte nessuna richiesta", [false, 0], [(await K.chiediPermesso(f3, { tipo: "pdf", mime: "x", peso: 1 })).ok, f3.chiamate.length]);
    c("permesso negato dal server (mime non ammesso): la frase del server", [false, "valore", "Questo tipo di file non è ammesso."], ((r2) => [r2.ok, r2.errore.tipo, r2.errore.messaggio])(await K.chiediPermesso(fetchFinto(risposta({ ok: false, motivo: "valore", frase: "Questo tipo di file non è ammesso." }, 400)), { tipo: "foto", mime: "application/pdf", peso: 5 })));

    c("l'indirizzo firmato deve essere https: (http, altri schemi, testo storto → «server»)", [true, "server", "server", "server"], [
      (await K.chiediPermesso(fetchFinto(risposta(buono)), { tipo: "foto", mime: "image/jpeg", peso: 1 })).ok,
      ...(await Promise.all(["http://storage.example.com/x?token=t", "javascript:alert(1)", "non un indirizzo"].map(async (url) => (await K.chiediPermesso(fetchFinto(risposta({ ...buono, url })), { tipo: "foto", mime: "image/jpeg", peso: 1 })).errore?.tipo))),
    ]);
    const nudoHttp = fetchFinto(risposta("", 200));
    const noHttp = await K.caricaConPermesso(nudoHttp, { ...buono, url: "http://storage.example.com/x" }, new Blob(["x"]));
    c("…e il caricamento non parte verso un indirizzo non https:", [false, 0], [noHttp.ok, nudoHttp.chiamate.length]);
    const blob = new Blob(["contenuto finto"], { type: "image/jpeg" });
    const nudo = fetchFinto(risposta("", 200));
    const up = await K.caricaConPermesso(nudo, buono, blob);
    c("caricamento: PUT all'indirizzo firmato, col file nel corpo (multipart), senza il gettone del CRM", [true, buono.url, "PUT", true, false], [up.ok, nudo.chiamate[0].url, nudo.chiamate[0].init.method, nudo.chiamate[0].init.body instanceof FormData, "Authorization" in (nudo.chiamate[0].init.headers ?? {})]);
    c("caricamento fallito (403, rete): errore con la frase, mai il testo del browser", [false, "rete", false], await (async () => {
      const a = await K.caricaConPermesso(fetchFinto(new TypeError("Failed to fetch gettone-di-prova")), buono, blob);
      return [a.ok, a.errore.tipo, /gettone|Failed/.test(a.errore.messaggio)];
    })());
    c("…con un 403 dal bucket: «server» e frase nostra", [false, "server"], ((a) => [a.ok, a.errore.tipo])(await K.caricaConPermesso(fetchFinto(risposta("no", 403)), buono, blob)));
  }

  // ── l'archivio: quel che la pagina legge ──
  {
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta(elenco(riga(1), riga(2))));
    const a = K.creaArchivioNegozio({ fetch: f, porte });
    c("prima della lettura: in caricamento, niente prodotti", [true, false, []], [a.stato().inCaricamento, a.stato().caricato, a.stato().prodotti]);
    const ferma = a.avvia();
    await sfiata();
    c("dopo la lettura: i prodotti, caricato, l'ora dell'ultima lettura buona (e non troncato)", [2, true, false, null, p.t, false], [a.stato().prodotti.length, a.stato().caricato, a.stato().inCaricamento, a.stato().errore, a.stato().ultimoAggiornamento, a.stato().troncato]);
    await p.avanza(30_000);
    c("si rilegge da sola ogni 30 s a scheda visibile", 2, f.chiamate.length);
    ferma();
  }
  {
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta(elenco(riga(1))), new TypeError("rete"));
    const a = K.creaArchivioNegozio({ fetch: f, porte });
    const ferma = a.avvia();
    await sfiata();
    const quando = p.t;
    await p.avanza(30_000);
    c("lettura fallita: l'elenco di prima RESTA, con l'ora di quella lettura e l'errore accanto", [1, "rete", quando, true], [a.stato().prodotti.length, a.stato().errore?.tipo, a.stato().ultimoAggiornamento, a.stato().caricato]);
    ferma();
  }
  {
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta(elenco(riga(1))), risposta({ ok: false, prodotti: [] }, 403));
    const a = K.creaArchivioNegozio({ fetch: f, porte });
    const ferma = a.avvia();
    await sfiata();
    await p.avanza(30_000);
    c("risposta 403: non mostra NIENTE in memoria (elenco vuoto, non caricato, nessuna ora)", [0, false, null, "permesso"], [a.stato().prodotti.length, a.stato().caricato, a.stato().ultimoAggiornamento, a.stato().errore?.tipo]);
    const n = f.chiamate.length;
    await p.avanza(120_000);
    c("…e non insiste ogni 30 s (accesso negato)", n, f.chiamate.length);
    ferma();
    const g = K.creaArchivioNegozio({ fetch: fetchFinto(risposta(elenco(riga(1))), risposta({ ok: false }, 401)), porte: porteFinte().porte });
    g.avvia(); await sfiata(); await g.aggiorna();
    c("risposta 401: stessa cosa (sessione scaduta)", [0, "sessione"], [g.stato().prodotti.length, g.stato().errore?.tipo]);
  }
  {
    // una lettura partita PRIMA di un'azione e arrivata DOPO si scarta e si rilegge
    const { porte } = porteFinte();
    const f = fetchSospeso();
    const a = K.creaArchivioNegozio({ fetch: f, porte });
    a.avvia();
    await sfiata();
    const vecchia = f.chiamate[0];
    const azione = a.esegui("prodotto_stato", { prodottoId: ID, stato: "pubblicato" });
    await sfiata();
    const post = f.chiamate[1];
    post.ok(risposta({ ok: true, cambiato: true }));
    await azione;
    vecchia.ok(risposta(elenco(riga(1, { stato: "bozza" }))));
    await sfiata();
    c("dopo l'azione la lettura vecchia viene scartata e ne parte una nuova", [true, "GET"], [f.chiamate.length >= 3, f.chiamate[2]?.init?.method ?? "GET"]);
    f.chiamate[2].ok(risposta(elenco(riga(1, { stato: "pubblicato" }))));
    await sfiata();
    c("a schermo resta lo stato NUOVO (la risposta più vecchia non lo riporta indietro)", "pubblicato", a.stato().prodotti[0]?.stato);
  }
  {
    const { porte } = porteFinte();
    const f = fetchFinto(risposta(elenco(riga(1))), risposta({ ok: true }), risposta(elenco(riga(1, { stato: "pubblicato" }))));
    const a = K.creaArchivioNegozio({ fetch: f, porte });
    a.avvia(); await sfiata();
    const r = await a.esegui("prodotto_stato", { prodottoId: ID, stato: "pubblicato" });
    await sfiata();
    c("azione riuscita: si rilegge l'elenco (stato e motivo possono essere cambiati) e il risultato arriva alla pagina", [true, 3, "pubblicato"], [r.ok, f.chiamate.length, a.stato().prodotti[0].stato]);
    const g = fetchFinto(risposta(elenco(riga(1))), risposta({ ok: false, motivo: "conflitto", frase: "Un'altra persona ha modificato questo prodotto." }, 409), risposta(elenco(riga(1, { nome: "Cambiato da altri" }))));
    const b = K.creaArchivioNegozio({ fetch: g, porte: porteFinte().porte });
    b.avvia(); await sfiata();
    const r2 = await b.esegui("prodotto_salva", { prodottoId: ID, versione: "v1", campi: { nome: "x" } });
    await sfiata();
    c("409: l'errore arriva alla pagina, e l'elenco si rilegge da solo (qualcuno ha cambiato)", [false, "conflitto", 3, "Cambiato da altri"], [r2.ok, r2.errore.tipo, g.chiamate.length, b.stato().prodotti[0].nome]);
    const h = fetchFinto(risposta(elenco(riga(1))), risposta({ ok: false, motivo: "valore", frase: "Il prezzo non è valido." }, 400));
    const d = K.creaArchivioNegozio({ fetch: h, porte: porteFinte().porte });
    d.avvia(); await sfiata();
    await d.esegui("prodotto_salva", { prodottoId: ID, versione: "v1", campi: { prezzoCent: -1 } });
    await sfiata();
    c("un errore di valore NON fa rileggere (non è cambiato niente)", 2, h.chiamate.length);
  }
  {
    const { porte } = porteFinte();
    const f = fetchFinto(risposta(elenco(riga(1))), risposta(elenco(riga(2, { stato: "pubblicato" }))));
    const a = K.creaArchivioNegozio({ fetch: f, porte });
    a.avvia(); await sfiata();
    await a.impostaFiltri({ segmento: "pubblicati", q: "lace" });
    c("cambiare i filtri rilegge subito, con l'indirizzo nuovo", ["/api/crm/negozio?prodotti", "/api/crm/negozio?prodotti&segmento=pubblicati&q=lace", ["PROVA-002"]], [f.chiamate[0].url, f.chiamate[1].url, a.stato().prodotti.map((x) => x.sku)]);
  }

  // ── il sorgente ──
  {
    const src = senzaCommenti(readFileSync(join(radice, "src/crm/negozio/client.ts"), "utf8"));
    c("il sorgente: nessun console, nessun accesso diretto a document/window/localStorage, nessuna chiave", [false, false, false], [/console\./.test(src), /\b(document|window|localStorage)\b/.test(src), /service_role|SUPABASE_|sk_(live|test)/.test(src)]);
    c("il sorgente: non importa il server (nel browser non deve finirci)", false, /\.server["']/.test(src));
  }
}
const FRASE = "Manca la foto principale: il prodotto resta in bozza.";
