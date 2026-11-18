/** ── E-COMMERCE · T10 · LETTURA E AZIONI DAL BROWSER ───────────────────────
 *  `src/crm/ecommerce/client.ts` (puro: riceve `fetch` e le «porte» del browser) decide indirizzi, esiti, errori leggibili,
 *  rilettura ogni 30 s a scheda visibile, numeretto ogni 60 s. `useOrdini.ts` e `useOrdiniNuovi.ts` sono la colla React.
 *  Nessuna rete vera, nessun timer vero: risposte finte e orologio a mano. Dati inventati (`dati.mjs`). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rigaOrdineProva } from "./dati.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const ID = uuid(1);
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
const ordineServer = (n, extra = {}) => ({
  id: uuid(n), ref: `HG-P${n}`, creatoIl: "2026-11-17T10:00:00.000Z", nome: "Anna", cognome: "Esempio", email: "anna@example.com", telefono: "+39 300 000 0001",
  indirizzo: "Via Prova 1", citta: "Roma", cap: "00100", note: null, righe: [], righeTroncate: false, subtotale: 20, spedizione: 4.9, totale: 24.9,
  stato: "nuovo", statoGrezzo: "nuovo", leadId: null, senzaLead: false, pagatoIl: null, pagatoImporto: null, metodoPagamento: null, tracking: null, noteInterne: null, aggiornatoIl: null,
  ...extra,
});
const elencoOk = (ordini, extra = {}) => ({ ok: true, ordini, scartati: 0, troncato: false, migrazione: { pronta: true }, adesso: "2026-11-18T12:00:00.000Z", ...extra });
const vuota = () => {};

/** Orologio e porte del browser finti: tempo a mano, timer a mano, scheda che si nasconde e si mostra. */
function porteFinte() {
  const p = { t: 0, visibile: true, timer: new Map(), ascoltatori: new Set(), prossimo: 1, nImposta: 0 };
  const porte = {
    visibile: () => p.visibile,
    adesso: () => p.t,
    imposta: (fn, ms) => { const h = p.prossimo++; p.nImposta++; p.timer.set(h, { fn, quando: p.t + ms }); return h; },
    annulla: (h) => { p.timer.delete(h); },
    ascolta: (fn) => { p.ascoltatori.add(fn); return () => p.ascoltatori.delete(fn); },
  };
  /** Fa passare `ms` millisecondi facendo scattare, in ordine, i timer scaduti. */
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
  p.nascondi = () => { p.visibile = false; p.ascoltatori.forEach((f) => f()); };
  p.mostra = () => { p.visibile = true; p.ascoltatori.forEach((f) => f()); };
  return { porte, p };
}
/** Lascia girare le promesse già pronte (microcode) e un giro di macrocoda. */
const sfiata = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); };

export async function prove(mod, { c, gruppo, radice }) {
  const K = mod["ecommerce/client"];
  const src = (f) => readFileSync(join(radice, "src/crm/ecommerce", f), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");

  gruppo("E-COMMERCE · CLIENTE DELLA ROTTA ORDINI (18/11/2026)");

  //  ── gli indirizzi ──
  c("indirizzi: elenco e numeretto", ["/api/crm/ordini", "/api/crm/ordini?conta=1"], [K.urlElenco(), K.urlConta()]);
  c("indirizzi: storico di un ordine", `/api/crm/ordini?storico=${ID}`, K.urlStorico(ID));
  c("indirizzi: storico con un id che non è UUID → nessun indirizzo", [null, null, null], [K.urlStorico("1; drop"), K.urlStorico(""), K.urlStorico(`${ID}&x=1`)]);
  c("indirizzi: schede (1-20 UUID, separati da virgola)", `/api/crm/ordini?lead=${uuid(2)},${uuid(3)}`, K.urlLead([uuid(2), uuid(3)]));
  c("indirizzi: schede vuote, 21, non UUID o con la virgola dentro → nessun indirizzo", [null, null, null, null], [
    K.urlLead([]),
    K.urlLead(Array.from({ length: 21 }, (_, i) => uuid(i + 1))),
    K.urlLead([uuid(2), "x"]),
    K.urlLead([`${uuid(2)},${uuid(3)}`]),
  ]);

  //  ── lettura dell'elenco ──
  {
    const f = fetchFinto(risposta(elencoOk([ordineServer(1), ordineServer(2)], { scartati: 2, troncato: true, migrazione: { pronta: false } })));
    const r = await K.leggiElenco(f);
    c("elenco: ordini, scartati, troncato, migrazione, ora del server", [true, 2, 2, true, false, "2026-11-18T12:00:00.000Z"], [r.ok, r.ordini.length, r.scartati, r.troncato, r.migrazionePronta, r.adesso]);
    c("elenco: una sola richiesta, GET, sull'indirizzo dell'elenco", [["/api/crm/ordini"], [undefined]], [f.chiamate.map((x) => x.url), f.chiamate.map((x) => x.init?.method)]);
  }
  {
    const r = await K.leggiElenco(fetchFinto(risposta({ ok: true, ordini: [], migrazione: {} })));
    c("elenco: campi mancanti → valori prudenti (0 scartati, non troncato, migrazione non pronta)", [true, 0, false, false], [r.ok, r.scartati, r.troncato, r.migrazionePronta]);
  }
  {
    const f = fetchFinto(risposta({ ok: true, ordini: "ciao" }));
    const r = await K.leggiElenco(f);
    c("elenco: risposta senza elenco → errore del server, non un'eccezione", [false, "server"], [r.ok, r.errore?.tipo]);
  }
  {
    const r = await K.leggiElenco(fetchFinto(new TypeError("Failed to fetch dal numero 3331234567")));
    c("rete assente → errore «rete», mai un'eccezione", [false, "rete"], [r.ok, r.errore?.tipo]);
    c("rete assente: il messaggio è nostro, non quello del browser", true, !/Failed|3331234567/.test(r.errore.messaggio) && r.errore.messaggio.length > 10);
  }

  //  ── gli errori, uno per uno ──
  {
    const caso = async (stato, corpo) => (await K.leggiElenco(fetchFinto(risposta(corpo, stato)))).errore;
    const e401 = await caso(401, { ok: false, error: "auth", reason: "Serve l'accesso al CRM: rientra col tuo PIN.", ordini: [] });
    const e403 = await caso(403, { ok: false, error: "permesso", permesso: "pagamenti", reason: "Non hai il permesso.", ordini: [] });
    const e500 = await caso(500, { ok: false, error: "interno", messaggio: "Il database non ha risposto: riprova tra un momento." });
    const e502 = await caso(502, "<html>Bad gateway</html>");
    const e409 = await caso(409, { ok: false, error: "migrazione", messaggio: "Mancano gli aggiornamenti del database: applica il file ecommerce_ordini.sql dal SQL Editor." });
    c("401 → «sessione» (rientra), non «permesso»", "sessione", e401.tipo);
    c("403 → «permesso» (chiedi a un amministratore), non «sessione»", "permesso", e403.tipo);
    c("401 e 403 hanno frasi diverse e leggibili", true, e401.messaggio !== e403.messaggio && /rientra|accedi|sessione/i.test(e401.messaggio) && /permess|amministrator/i.test(e403.messaggio));
    c("500 → «server», con la frase della rotta", ["server", "Il database non ha risposto: riprova tra un momento."], [e500.tipo, e500.messaggio]);
    c("502 con una pagina HTML → «server» con frase nostra, senza l'HTML", ["server", false], [e502.tipo, /html|gateway/i.test(e502.messaggio)]);
    c("409 migrazione → «migrazione» con la frase della rotta", ["migrazione", true], [e409.tipo, /ecommerce_ordini\.sql/.test(e409.messaggio)]);
    c("ogni errore ha un messaggio non vuoto", true, [e401, e403, e500, e502, e409].every((e) => typeof e.messaggio === "string" && e.messaggio.trim().length > 0));
    const lungo = await caso(400, { ok: false, error: "valore", messaggio: "x".repeat(5000) });
    c("messaggio della rotta oltre 300 caratteri → tagliato", true, lungo.messaggio.length <= 300);
    const senza = await caso(400, { ok: false, error: "valore" });
    c("rotta senza messaggio → frase nostra", ["valore", true], [senza.tipo, senza.messaggio.length > 10]);
  }

  //  ── il numeretto ──
  {
    const f = fetchFinto(risposta({ ok: true, nuovi: 3 }));
    const r = await K.leggiConta(f);
    c("conta: legge i nuovi dall'indirizzo ?conta=1", [{ ok: true, nuovi: 3 }, ["/api/crm/ordini?conta=1"]], [r, f.chiamate.map((x) => x.url)]);
    const cattive = [];
    for (const nuovi of [-1, 1.5, "3", null, NaN, undefined, 1e12]) cattive.push((await K.leggiConta(fetchFinto(risposta({ ok: true, nuovi })))).ok);
    c("conta: un numero strano (negativo, decimale, testo, assente, enorme) non è un risultato", [false, false, false, false, false, false, false], cattive);
    c("conta: ok:false o rete assente non lanciano", [false, false], [(await K.leggiConta(fetchFinto(risposta({ ok: false })))).ok, (await K.leggiConta(fetchFinto(new TypeError("x")))).ok]);
  }

  //  ── lo storico ──
  {
    const eventi = [{ id: uuid(9), creatoIl: "2026-11-18T09:00:00Z", tipo: "stato", chi: "Giulia Esempio", prima: { status: "nuovo" }, dopo: { status: "spedito" } }];
    const f = fetchFinto(risposta({ ok: true, eventi, migrazione: { pronta: true } }));
    const r = await K.leggiStorico(f, ID);
    c("storico: eventi e migrazione", [true, eventi, true, [`/api/crm/ordini?storico=${ID}`]], [r.ok, r.eventi, r.migrazionePronta, f.chiamate.map((x) => x.url)]);
    const g = fetchFinto(risposta({ ok: true }));
    const cattivo = await K.leggiStorico(g, "non-uuid");
    c("storico: id non UUID → errore «valore» senza fare richieste", [false, "valore", 0], [cattivo.ok, cattivo.errore?.tipo, g.chiamate.length]);
    const senzaElenco = await K.leggiStorico(fetchFinto(risposta({ ok: true, migrazione: { pronta: false } })), ID);
    c("storico: senza elenco di eventi → vuoto e migrazione non pronta", [true, [], false], [senzaElenco.ok, senzaElenco.eventi, senzaElenco.migrazionePronta]);
  }

  //  ── le azioni ──
  const AZIONE = { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" };
  {
    const f = fetchFinto(risposta({ ok: true, ordine: ordineServer(1, { stato: "spedito" }), storico: true }));
    const r = await K.eseguiAzione(f, AZIONE);
    c("azione: POST con l'azione nel corpo JSON", ["POST", "application/json", AZIONE, "/api/crm/ordini"], [f.chiamate[0].init.method, f.chiamate[0].init.headers["Content-Type"], JSON.parse(f.chiamate[0].init.body), f.chiamate[0].url]);
    c("azione: ordine nuovo e storico dalla risposta", [true, false, "spedito", true], [r.ok, r.nessunCambio, r.ordine?.stato, r.storico]);
    const senzaStorico = await K.eseguiAzione(fetchFinto(risposta({ ok: true, ordine: ordineServer(1), storico: false })), AZIONE);
    c("azione: storico:false arriva alla pagina (dovrà avvisare)", false, senzaStorico.storico);
    const mancante = await K.eseguiAzione(fetchFinto(risposta({ ok: true, storico: true })), AZIONE);
    c("azione: ok senza l'ordine → errore del server, non un successo", [false, "server"], [mancante.ok, mancante.errore?.tipo]);
  }
  {
    const r = await K.eseguiAzione(fetchFinto(risposta({ ok: false, error: "nessun_cambio", messaggio: "L'ordine è già in questo stato." })), AZIONE);
    c("«nessun_cambio» (200, ok:false) = niente da fare, NON un errore", [true, true, null, undefined], [r.ok, r.nessunCambio, r.ordine ?? null, r.errore]);
  }
  {
    const conflitto = await K.eseguiAzione(fetchFinto(risposta({ ok: false, error: "conflitto", messaggio: "L'ordine è stato modificato da qualcun altro nel frattempo: ricarica e riprova." }, 409)), AZIONE);
    c("azione: 409 conflitto → errore «conflitto» con la frase della rotta", [false, "conflitto", true], [conflitto.ok, conflitto.errore.tipo, /qualcun altro/.test(conflitto.errore.messaggio)]);
    const migr = await K.eseguiAzione(fetchFinto(risposta({ ok: false, error: "migrazione", messaggio: "Mancano gli aggiornamenti del database." }, 409)), AZIONE);
    const nonTrovato = await K.eseguiAzione(fetchFinto(risposta({ ok: false, error: "non_trovato", messaggio: "Ordine non trovato." }, 404)), AZIONE);
    const valore = await K.eseguiAzione(fetchFinto(risposta({ ok: false, error: "valore", messaggio: "Il tracking è troppo lungo." }, 400)), AZIONE);
    const interno = await K.eseguiAzione(fetchFinto(risposta({ ok: false, error: "interno", messaggio: "Il database non ha risposto." }, 500)), AZIONE);
    c("azione: migrazione, non trovato, valore, server si distinguono", ["migrazione", "non_trovato", "valore", "server"], [migr.errore.tipo, nonTrovato.errore.tipo, valore.errore.tipo, interno.errore.tipo]);
    const rete = await K.eseguiAzione(fetchFinto(new TypeError("rete")), AZIONE);
    c("azione: rete assente → «rete» (e la pagina non sa se ha scritto: dice di ricontrollare)", [false, "rete", true], [rete.ok, rete.errore.tipo, /controlla|ricontrolla|aggiorna/i.test(rete.errore.messaggio)]);
  }

  //  ── sostituire un ordine nell'elenco ──
  {
    const a = [ordineServer(1), ordineServer(2), ordineServer(3)];
    const n = ordineServer(2, { stato: "spedito" });
    const b = K.applicaOrdine(a, n);
    c("applicaOrdine: sostituisce solo quello, stessa posizione", [["HG-P1", "HG-P2", "HG-P3"], ["nuovo", "spedito", "nuovo"]], [b.map((x) => x.ref), b.map((x) => x.stato)]);
    c("applicaOrdine: l'elenco di partenza non cambia", "nuovo", a[1].stato);
    c("applicaOrdine: ordine non presente → stessa referenza (la rilettura lo porterà)", true, K.applicaOrdine(a, ordineServer(9)) === a);
  }

  //  ── l'ora ──
  c("oraHHmm: ore e minuti a due cifre, in ora locale", "09:05", K.oraHHmm(new Date(2026, 10, 18, 9, 5, 59).getTime()));
  c("oraHHmm: mezzanotte", "00:00", K.oraHHmm(new Date(2026, 10, 18, 0, 0, 0).getTime()));

  //  ── il lettore: rilettura periodica, a scheda visibile, senza sovrapporsi ──
  c("intervalli: elenco 30 s, numeretto 60 s", [30_000, 60_000], [K.RILEGGI_ORDINI_MS, K.RILEGGI_NUOVI_MS]);
  {
    const { porte, p } = porteFinte();
    let letture = 0, inAttesa = null;
    const leggi = () => { letture++; return new Promise((r) => { inAttesa = r; }); };
    const l = K.creaLettore({ ogniMs: 30_000, leggi, porte });
    l.avvia();
    c("lettore: all'avvio legge subito (scheda visibile)", 1, letture);
    await p.avanza(60_000);
    p.mostra(); await sfiata();
    c("lettore: con una lettura ancora in corso un segnale di ritorno non ne fa partire un'altra", 1, letture);
    const x = l.aggiorna();
    c("lettore: «Aggiorna» durante una lettura in corso la riusa", 1, letture);
    inAttesa(); await x; await sfiata();
    await p.avanza(29_000);
    c("lettore: finita la lettura, la prossima non arriva prima di 30 s", 1, letture);
    await p.avanza(1_000);
    c("lettore: ...e arriva dopo 30 s", 2, letture);
    inAttesa();
    l.ferma();
  }
  {
    const { porte, p } = porteFinte();
    let letture = 0;
    const l = K.creaLettore({ ogniMs: 30_000, leggi: async () => { letture++; }, porte });
    l.avvia(); await sfiata();
    await p.avanza(30_000);
    await p.avanza(30_000);
    c("lettore: ogni 30 s a scheda visibile", 3, letture);
    p.visibile = false;
    await p.avanza(30_000);
    c("lettore: scheda nascosta → nessuna lettura", 3, letture);
    await p.avanza(300_000);
    c("lettore: scheda nascosta a lungo → ancora nessuna, e nessun timer acceso", [3, 0], [letture, p.timer.size]);
    p.mostra(); await sfiata();
    c("lettore: tornando sulla scheda rilegge subito", 4, letture);
    c("lettore: e il giro riparte (un timer acceso)", 1, p.timer.size);
    await p.avanza(30_000);
    c("lettore: dopo il ritorno, di nuovo ogni 30 s", 5, letture);
    p.mostra(); await sfiata();
    c("lettore: un segnale di ritorno a meno di 5 s dall'ultima lettura non ne fa un'altra", 5, letture);
    c("lettore: ...e il giro resta acceso", 1, p.timer.size);
    //  «Aggiorna» a mano ignora la scheda nascosta (chi preme sta guardando)
    p.visibile = false;
    await l.aggiorna();
    c("lettore: «Aggiorna» legge anche se la scheda risulta nascosta", 6, letture);
    l.ferma();
    p.visibile = true;
    p.ascoltatori.forEach((f) => f());
    await p.avanza(300_000);
    c("lettore: fermato → niente timer, niente ascoltatori, niente letture", [6, 0, 0], [letture, p.timer.size, p.ascoltatori.size]);
  }
  {
    //  scheda nascosta all'apertura: nessuna richiesta; arriva quando si mostra
    const { porte, p } = porteFinte();
    p.visibile = false;
    let letture = 0;
    const l = K.creaLettore({ ogniMs: 60_000, leggi: async () => { letture++; }, porte });
    l.avvia(); await p.avanza(120_000);
    c("lettore: aperto a scheda nascosta → nessuna richiesta", 0, letture);
    p.mostra(); await sfiata();
    c("lettore: ...la prima arriva quando la scheda si mostra", 1, letture);
    l.ferma();
  }
  {
    //  una lettura che lancia non ferma il giro
    const { porte, p } = porteFinte();
    let letture = 0;
    const l = K.creaLettore({ ogniMs: 30_000, leggi: async () => { letture++; throw new Error("dati personali: Anna 3331234567"); }, porte });
    l.avvia(); await sfiata();
    await p.avanza(30_000);
    c("lettore: se la lettura lancia, il giro continua e l'errore non esce", 2, letture);
    l.ferma();
  }

  //  ── le porte del browser ──
  {
    const ascoltati = [];
    const doc = { visibilityState: "visible", addEventListener: (n) => ascoltati.push(`+d:${n}`), removeEventListener: (n) => ascoltati.push(`-d:${n}`) };
    const win = { addEventListener: (n) => ascoltati.push(`+w:${n}`), removeEventListener: (n) => ascoltati.push(`-w:${n}`) };
    const porte = K.porteBrowser(doc, win);
    const off = porte.ascolta(vuota);
    off();
    c("porteBrowser: ascolta visibilitychange, pageshow e online, e li toglie", [["+d:visibilitychange", "+w:pageshow", "+w:online"], ["-d:visibilitychange", "-w:pageshow", "-w:online"]], [ascoltati.slice(0, 3), ascoltati.slice(3)]);
    c("porteBrowser: visibile segue visibilityState", [true, false], [porte.visibile(), ((doc.visibilityState = "hidden"), porte.visibile())]);
    const h = porte.imposta(() => { throw new Error("non deve partire"); }, 60_000);
    porte.annulla(h);
    c("porteBrowser: adesso è un numero (ms) e imposta/annulla non lanciano", "number", typeof porte.adesso());
  }

  //  ── l'archivio degli ordini (stato letto dalla pagina) ──
  {
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta(elencoOk([ordineServer(1), ordineServer(2)])));
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    const s0 = a.stato();
    c("archivio: all'inizio sta caricando, senza ordini né errori", [true, [], null, null, false], [s0.inCaricamento, s0.ordini, s0.errore, s0.ultimoAggiornamento, s0.caricato]);
    p.t = 5_000;
    await a.aggiorna();
    const s1 = a.stato();
    c("archivio: dopo la lettura ci sono gli ordini, ora di aggiornamento, niente errore", [false, true, 2, 5_000, null, false], [s1.inCaricamento, s1.caricato, s1.ordini.length, s1.ultimoAggiornamento, s1.errore, s1.inAggiornamento]);
    c("archivio: troncato, scartati e migrazione sono esposti", [false, 0, true], [s1.troncato, s1.scartati, s1.migrazionePronta]);
    await a.aggiorna();
    c("archivio: lo stato non cambia tra due letture dell'archivio → stessa referenza", true, a.stato() === a.stato());
  }
  {
    //  una lettura fallita dopo una buona: i dati restano, l'errore si vede
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta(elencoOk([ordineServer(1)])), new TypeError("rete"), risposta(elencoOk([ordineServer(1), ordineServer(2)])));
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    p.t = 1_000; await a.aggiorna();
    p.t = 2_000; await a.aggiorna();
    const s = a.stato();
    c("archivio: lettura fallita dopo una buona → ordini e ora restano, errore «rete»", [1, 1_000, "rete", true, false], [s.ordini.length, s.ultimoAggiornamento, s.errore?.tipo, s.caricato, s.inCaricamento]);
    p.t = 3_000; await a.aggiorna();
    const t = a.stato();
    c("archivio: la lettura successiva riuscita toglie l'errore", [2, 3_000, null], [t.ordini.length, t.ultimoAggiornamento, t.errore]);
  }
  {
    //  la primissima lettura fallisce: nessun dato, errore, non più «in caricamento»
    const { porte } = porteFinte();
    const a = K.creaArchivioOrdini({ fetch: fetchFinto(risposta({ ok: false, error: "permesso", reason: "no", ordini: [] }, 403)), porte });
    await a.aggiorna();
    const s = a.stato();
    c("archivio: prima lettura vietata → nessun dato, errore «permesso», non in caricamento", [false, "permesso", [], false], [s.caricato, s.errore?.tipo, s.ordini, s.inCaricamento]);
  }
  {
    const { porte } = porteFinte();
    const f = fetchSospeso();
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    const x = a.aggiorna(), y = a.aggiorna();
    c("archivio: due «Aggiorna» insieme → una richiesta sola", 1, f.chiamate.length);
    f.chiamate[0].ok(risposta(elencoOk([ordineServer(1)])));
    await Promise.all([x, y]);
    c("archivio: ...e a fine lettura lo stato è aggiornato", 1, a.stato().ordini.length);
  }
  {
    //  l'azione riuscita aggiorna UN ordine senza rileggere tutto
    const { porte } = porteFinte();
    const f = fetchFinto(
      risposta(elencoOk([ordineServer(1), ordineServer(2)])),
      risposta({ ok: true, ordine: ordineServer(2, { stato: "spedito" }), storico: true }),
    );
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    await a.aggiorna();
    const avvisi = [];
    a.iscrivi(() => avvisi.push(1));
    const r = await a.esegui({ azione: "stato", ordineId: uuid(2), da: "nuovo", a: "spedito" });
    await sfiata();
    c("archivio: azione riuscita → l'ordine cambia nell'elenco, gli altri no", [true, ["nuovo", "spedito"]], [r.ok, a.stato().ordini.map((o) => o.stato)]);
    c("archivio: ...senza rileggere l'elenco (1 lettura + 1 azione)", ["GET", "POST"], f.chiamate.map((x) => x.init?.method ?? "GET"));
    c("archivio: chi ascolta viene avvisato", true, avvisi.length >= 1);
  }
  {
    const { porte } = porteFinte();
    const f = fetchFinto(
      risposta(elencoOk([ordineServer(1)])),
      risposta({ ok: false, error: "nessun_cambio", messaggio: "già così" }),
    );
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    await a.aggiorna();
    const prima = a.stato();
    const r = await a.esegui({ azione: "stato", ordineId: ID, da: "nuovo", a: "nuovo" });
    c("archivio: nessun_cambio → nessun errore, stato intatto, nessuna rilettura", [true, true, true, 2], [r.ok, r.nessunCambio, a.stato() === prima, f.chiamate.length]);
  }
  {
    //  conflitto: l'errore va alla pagina e l'elenco si rilegge da solo
    const { porte } = porteFinte();
    const f = fetchFinto(
      risposta(elencoOk([ordineServer(1)])),
      risposta({ ok: false, error: "conflitto", messaggio: "modificato da qualcun altro" }, 409),
      risposta(elencoOk([ordineServer(1, { stato: "in_preparazione" })])),
    );
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    await a.aggiorna();
    const r = await a.esegui({ azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
    await sfiata();
    c("archivio: conflitto → errore alla pagina e rilettura automatica dell'elenco", [false, "conflitto", ["GET", "POST", "GET"], "in_preparazione"], [r.ok, r.errore.tipo, f.chiamate.map((x) => x.init?.method ?? "GET"), a.stato().ordini[0].stato]);
  }
  {
    //  una rilettura partita PRIMA dell'azione e arrivata DOPO non riporta indietro l'ordine
    const { porte } = porteFinte();
    const letture = [];
    const azioni = [];
    const f = (url, init) => new Promise((ok) => (init?.method === "POST" ? azioni : letture).push(ok));
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    const prima = a.aggiorna();
    letture.shift()(risposta(elencoOk([ordineServer(1)])));
    await prima;
    const vecchia = a.aggiorna();                              // la rilettura parte (vedrebbe «nuovo»)
    const azione = a.esegui({ azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
    azioni.shift()(risposta({ ok: true, ordine: ordineServer(1, { stato: "spedito" }), storico: true }));
    await azione;
    letture.shift()(risposta(elencoOk([ordineServer(1)])));    // arriva ora, con lo stato vecchio
    await sfiata();
    c("archivio: ...e mentre si rilegge si vede già l'ordine nuovo, mai quello vecchio", "spedito", a.stato().ordini[0].stato);
    letture.shift()(risposta(elencoOk([ordineServer(1, { stato: "spedito" })]))); // la rilettura fatta dopo l'azione
    await vecchia;
    c("archivio: una rilettura vecchia, arrivata dopo l'azione, non riporta indietro l'ordine", "spedito", a.stato().ordini[0].stato);
    c("archivio: ...e non resta in «aggiornamento»", false, a.stato().inAggiornamento);
  }
  {
    //  storico passa dalla stessa fetch
    const { porte } = porteFinte();
    const f = fetchFinto(risposta({ ok: true, eventi: [], migrazione: { pronta: true } }));
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    const r = await a.storico(ID);
    c("archivio: storico(id) legge lo storico dell'ordine", [true, [`/api/crm/ordini?storico=${ID}`]], [r.ok, f.chiamate.map((x) => x.url)]);
  }
  {
    //  avvia/ferma: legge subito e poi ogni 30 s; fermo non legge più
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta(elencoOk([ordineServer(1)])));
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    const ferma = a.avvia();
    await sfiata();
    await p.avanza(30_000);
    c("archivio: avviato legge subito e ogni 30 s", 2, f.chiamate.length);
    ferma();
    await p.avanza(120_000);
    c("archivio: fermato non legge più", 2, f.chiamate.length);
  }

  //  ── il numeretto: useOrdiniNuovi(attivo) ──
  {
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta({ ok: true, nuovi: 4 }));
    const visti = [];
    const ferma = K.avviaConta({ attivo: false, fetch: f, porte, alCambio: (n) => visti.push(n) });
    await p.avanza(300_000);
    ferma();
    c("useOrdiniNuovi(false): nessuna richiesta, nessun timer, nessun ascoltatore", [0, 0, 0, 0, 0], [f.chiamate.length, p.nImposta, p.ascoltatori.size, visti.length, p.timer.size]);
  }
  {
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta({ ok: true, nuovi: 4 }), risposta({ ok: true, nuovi: 5 }), new TypeError("rete"), risposta({ ok: false }), risposta({ ok: true, nuovi: 2 }));
    const visti = [];
    const ferma = K.avviaConta({ attivo: true, fetch: f, porte, alCambio: (n) => visti.push(n) });
    await sfiata();
    c("numeretto: all'apertura chiede ?conta=1 e riporta il valore", [["/api/crm/ordini?conta=1"], [4]], [f.chiamate.map((x) => x.url), visti]);
    await p.avanza(59_000);
    c("numeretto: prima dei 60 s non richiede", 1, f.chiamate.length);
    await p.avanza(1_000);
    c("numeretto: ogni 60 s", [2, [4, 5]], [f.chiamate.length, visti]);
    await p.avanza(60_000);
    await p.avanza(60_000);
    c("numeretto: rete assente o ok:false → tiene l'ultimo valore buono, non azzera", [4, [4, 5]], [f.chiamate.length, visti]);
    await p.avanza(60_000);
    c("numeretto: la lettura buona dopo i guasti aggiorna", [4, 5, 2], visti);
    await p.avanza(10_000); // passato il minimo fra due letture: il segnale «nascosta» non deve comunque leggere
    const n = f.chiamate.length;
    p.nascondi();
    await p.avanza(600_000);
    c("numeretto: a scheda nascosta non chiede mai", n, f.chiamate.length);
    ferma();
    p.mostra(); await p.avanza(600_000);
    c("numeretto: fermato (voce non visibile) non chiede più", n, f.chiamate.length);
  }

  //  ── note del revisore T10 (18/11/2026) ──
  //  1. Una richiesta che non risponde mai non deve bloccare il giro: tetto di 20 s con AbortSignal.timeout
  {
    const originale = AbortSignal.timeout;
    const ctrls = [];
    const tetti = [];
    AbortSignal.timeout = (ms) => { tetti.push(ms); const k = new AbortController(); ctrls.push(k); return k.signal; };
    try {
      const visti = [];
      const appeso = (url, init) => new Promise((_, no) => {
        visti.push(init?.signal);
        init.signal.addEventListener("abort", () => no(new DOMException("tempo scaduto", "TimeoutError")));
      });
      const { porte } = porteFinte();
      const a = K.creaArchivioOrdini({ fetch: appeso, porte });
      const x = a.aggiorna();
      await sfiata();
      c("tetto: la lettura parte con un tetto di 20 s (segnale passato a fetch)", [[20_000], true, true], [tetti, visti[0] === ctrls[0].signal, a.stato().inAggiornamento]);
      ctrls[0].abort();
      await x;
      const s = a.stato();
      c("tetto: scaduto il tempo → errore «rete», non più in aggiornamento, non in caricamento", ["rete", false, false], [s.errore?.tipo, s.inAggiornamento, s.inCaricamento]);
      const y = a.aggiorna();
      await sfiata();
      c("tetto: dopo il tempo scaduto «Aggiorna» parte di nuovo (la lettura non resta appesa)", 2, visti.length);
      ctrls[1].abort();
      await y;
      //  anche l'azione ha il tetto, e il messaggio dice che non si sa se è stata salvata
      const azioneInVolo = K.eseguiAzione(appeso, AZIONE);
      await sfiata();
      ctrls[2].abort();
      const az = await azioneInVolo;
      c("tetto: azione senza risposta → «rete» con la frase «non so se è stata salvata»", [false, "rete", true, 3], [az.ok, az.errore?.tipo, /Non so se/.test(az.errore?.messaggio ?? ""), visti.length]);
    } finally {
      AbortSignal.timeout = originale;
    }
  }
  //  2. Lettura scartata → si rilegge da soli; su conflitto non si riusa una lettura partita prima della modifica
  {
    const { porte } = porteFinte();
    const letture = [];
    const azioni = [];
    const f = (url, init) => new Promise((ok) => (init?.method === "POST" ? azioni : letture).push(ok));
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    const prima = a.aggiorna();                                  // la PRIMISSIMA lettura è in corso
    const azione = a.esegui({ azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
    azioni.shift()(risposta({ ok: true, ordine: ordineServer(1, { stato: "spedito" }), storico: true }));
    await azione;
    letture.shift()(risposta(elencoOk([ordineServer(1)])));      // risposta vecchia: si scarta
    await sfiata();
    c("scarto: la lettura scartata ne fa partire subito un'altra", 1, letture.length);
    letture.shift()(risposta(elencoOk([ordineServer(1, { stato: "spedito" })])));
    await prima;
    const s = a.stato();
    c("scarto: la prima lettura non resta «in caricamento» in attesa del timer", [true, false, "spedito"], [s.caricato, s.inCaricamento, s.ordini[0]?.stato]);
  }
  {
    const { porte } = porteFinte();
    const letture = [];
    const azioni = [];
    const f = (url, init) => new Promise((ok) => (init?.method === "POST" ? azioni : letture).push(ok));
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    const prima = a.aggiorna();
    letture.shift()(risposta(elencoOk([ordineServer(1)])));
    await prima;
    const inVolo = a.aggiorna();                                  // lettura partita PRIMA della modifica dell'altro…
    const azione = a.esegui({ azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
    azioni.shift()(risposta({ ok: false, error: "conflitto", messaggio: "modificato da qualcun altro" }, 409));
    await azione;
    letture.shift()(risposta(elencoOk([ordineServer(1)])));       // …e arriva col dato vecchio
    await sfiata();
    c("conflitto: la lettura già in volo non basta, ne parte una nuova", 1, letture.length);
    letture.shift()(risposta(elencoOk([ordineServer(1, { stato: "in_preparazione" })])));
    await inVolo;
    c("conflitto: alla fine l'elenco è quello nuovo", "in_preparazione", a.stato().ordini[0].stato);
  }
  //  3. Permesso tolto o sessione finita: gli ordini non restano a schermo
  for (const [stato, tipo] of [[403, "permesso"], [401, "sessione"]]) {
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta(elencoOk([ordineServer(1)])), risposta({ ok: false, error: tipo === "permesso" ? "permesso" : "auth", ordini: [] }, stato));
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    p.t = 1_000; await a.aggiorna();
    await a.aggiorna();
    const s = a.stato();
    c(`${tipo}: dopo una lettura buona gli ordini spariscono (niente nome/telefono a schermo)`, [tipo, [], false, null, 0, false], [s.errore?.tipo, s.ordini, s.caricato, s.ultimoAggiornamento, s.scartati, s.troncato]);
  }
  //  4. useOrdiniNuovi con attivo falso restituisce null (sul testo: il valore tenuto non esce)
  c("useOrdiniNuovi: con attivo falso restituisce null, non l'ultimo numero", true, /attivo\s*\?\s*nuovi\s*:\s*null/.test(src("useOrdiniNuovi.ts")));
  //  5. 403 e 401 finale: il giro non si riarma; riparte con «Aggiorna» o tornando sulla scheda
  {
    const { porte, p } = porteFinte();
    let n = 0;
    const l = K.creaLettore({ ogniMs: 30_000, leggi: async () => { n++; return false; }, porte });
    l.avvia(); await sfiata();
    await p.avanza(300_000);
    c("lettore: se `leggi` dice «non riarmare» nessun timer e nessuna nuova richiesta", [1, 0], [n, p.timer.size]);
    p.mostra(); await sfiata();
    c("lettore: tornando sulla scheda (dopo più di 5 s) riparte", 2, n);
    p.mostra(); await sfiata();
    c("lettore: un segnale a meno di 5 s non arma il timer di un giro sospeso", [2, 0], [n, p.timer.size]);
    await l.aggiorna();
    c("lettore: «Aggiorna» legge anche a giro sospeso", 3, n);
    l.ferma();
  }
  for (const [stato, tipo] of [[403, "permesso"], [401, "sessione"]]) {
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta({ ok: false, error: tipo === "permesso" ? "permesso" : "auth", ordini: [] }, stato));
    const a = K.creaArchivioOrdini({ fetch: f, porte });
    const ferma = a.avvia(); await sfiata();
    await p.avanza(300_000);
    c(`archivio: ${tipo} → una richiesta sola in 5 minuti (non si insiste)`, [1, 0], [f.chiamate.length, p.timer.size]);
    p.mostra(); await sfiata();
    c(`archivio: ${tipo} → tornando sulla scheda ci riprova una volta`, 2, f.chiamate.length);
    await a.aggiorna();
    c(`archivio: ${tipo} → «Aggiorna» ci riprova`, 3, f.chiamate.length);
    ferma();
    const g = fetchFinto(risposta({ ok: false, error: "permesso" }, 403));
    const visti = [];
    const fermaConta = K.avviaConta({ attivo: true, fetch: g, porte: porteFinte().porte, alCambio: (x) => visti.push(x) });
    await sfiata();
    fermaConta();
  }
  {
    //  il numeretto: 403 → una richiesta e basta; un guasto di rete invece continua
    const { porte, p } = porteFinte();
    const f = fetchFinto(risposta({ ok: false, error: "permesso" }, 403));
    const ferma = K.avviaConta({ attivo: true, fetch: f, porte, alCambio: vuota });
    await sfiata();
    await p.avanza(600_000);
    c("numeretto: 403 → una richiesta sola, nessun timer acceso", [1, 0], [f.chiamate.length, p.timer.size]);
    ferma();
  }

  //  ── sul testo ──
  {
    const client = src("client.ts"), ordini = src("useOrdini.ts"), nuovi = src("useOrdiniNuovi.ts");
    const tutto = { "client.ts": client, "useOrdini.ts": ordini, "useOrdiniNuovi.ts": nuovi };
    c("testo: intervalli scritti una volta sola, 30 000 e 60 000", [true, true], [/export const RILEGGI_ORDINI_MS\s*=\s*30_000\b/.test(client), /export const RILEGGI_NUOVI_MS\s*=\s*60_000\b/.test(client)]);
    c("testo: useOrdini usa RILEGGI_ORDINI_MS e useOrdiniNuovi RILEGGI_NUOVI_MS (o l'archivio che li porta)", [true, true], [/RILEGGI_ORDINI_MS/.test(client) && /creaArchivioOrdini/.test(ordini), /avviaConta/.test(nuovi) && /RILEGGI_NUOVI_MS/.test(client)]);
    c("testo: nessun console.* nei tre file (niente log, niente dati personali)", [false, false, false], Object.values(tutto).map((t) => /\bconsole\./.test(senzaCommenti(t))));
    c("testo: i due hook parlano con la rotta solo attraverso fetchCRM", [true, true, false, false], [/fetchCRM/.test(ordini), /fetchCRM/.test(nuovi), /\bfetch\(/.test(senzaCommenti(ordini)), /\bfetch\(/.test(senzaCommenti(nuovi))]);
    c("testo: nessun accesso diretto a Supabase, né a localStorage, nei tre file", [false, false, false], Object.values(tutto).map((t) => /supabase|localStorage|sessionStorage/i.test(senzaCommenti(t))));
    c("testo: nessuna azione di cancellazione (D11)", [false, false, false], Object.values(tutto).map((t) => /elimin|cancell|delete/i.test(t)));
    c("testo: l'indirizzo della rotta è scritto una volta sola, in client.ts", [1, 0, 0], [(senzaCommenti(client).match(/\/api\/crm\/ordini/g) ?? []).length, (ordini.match(/\/api\/crm\/ordini/g) ?? []).length, (nuovi.match(/\/api\/crm\/ordini/g) ?? []).length]);
    c("testo: il fuso/ora non è fissato nel cliente (ora del browser)", false, /timeZone/.test(client));
    c("testo: la richiesta ha il tetto di 20 s (AbortSignal.timeout)", [true, true], [/AbortSignal\.timeout\(\s*TETTO_RICHIESTA_MS\s*\)/.test(client), /TETTO_RICHIESTA_MS\s*=\s*20_000/.test(client)]);
    c("testo: nessun setInterval (i timer sono a catena, uno alla volta)", false, /setInterval/.test(senzaCommenti(client)));
  }
}
