/** ── NEGOZIO · R2 · T61 · IL CLIENT DEGLI ORDINI DEL CRM, AZIONI NUOVE E DETTAGLIO ───────────────────────────
 *  `src/crm/ecommerce/client.ts` (indirizzo `?dettaglio=`, una funzione per ognuna delle otto azioni nuove, l'archivio del
 *  dettaglio) e `src/crm/ecommerce/useDettaglioOrdine.ts` (la colla React). PIANO-R2 §3.4, §6.1 T61; SPEC 7.4 n. 5; 8A n. 2, 6.
 *  Nessuna rete vera, nessun timer vero: risposte finte. Dati inventati (`@example.com`, UUID finti).
 *  Le funzioni di prima non cambiano: le prova `prove/ecommerce/client.mjs`, che resta com'è. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rigaOrdineProva } from "../ecommerce/dati.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const ID = uuid(1);
const risposta = (corpo, stato = 200) => new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status: stato });
/** Un `fetch` finto: risponde con la prossima voce della coda (l'ultima si ripete) e ricorda le chiamate. Una funzione riceve (url, init). */
function fetchFinto(...coda) {
  const chiamate = [];
  const f = async (url, init) => {
    chiamate.push({ url, init });
    const x = coda.length > 1 ? coda.shift() : coda[0];
    if (x instanceof Error) throw x;
    return typeof x === "function" ? x(url, init) : x.clone();
  };
  f.chiamate = chiamate;
  f.post = () => chiamate.filter((x) => x.init?.method === "POST");
  f.get = () => chiamate.filter((x) => x.init?.method !== "POST");
  return f;
}
/** Un fetch che resta in attesa finché non si risolve a mano. */
function fetchSospeso() {
  const chiamate = [];
  const f = (url, init) => new Promise((ok) => chiamate.push({ url, init, ok }));
  f.chiamate = chiamate;
  return f;
}
/** Lascia girare le promesse già pronte e un giro di macrocoda. */
const sfiata = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); };

const ordineServer = (n, extra = {}) => ({
  id: uuid(n), ref: `HG-P${n}`, creatoIl: "2026-11-21T10:00:00.000Z", nome: "Anna", cognome: "Esempio", email: "anna@example.com", telefono: "+39 300 000 0001",
  indirizzo: "Via Prova 1", citta: "Roma", cap: "00100", note: null, righe: [], righeTroncate: false, subtotale: 20, spedizione: 4.9, totale: 24.9,
  stato: "nuovo", statoGrezzo: "nuovo", leadId: null, senzaLead: false, pagatoIl: null, pagatoImporto: null, metodoPagamento: null, tracking: null, noteInterne: null, aggiornatoIl: null,
  ...extra,
});
const dettaglioOk = (n = 1, extra = {}) => ({
  ok: true,
  ordine: ordineServer(n),
  riservati: { fattura: { ragioneSociale: "Esempio Srl", partitaIva: "00000000000" }, consensi: { privacy: true } },
  rimborsi: [{ id: uuid(70), importoCent: 500, stato: "riuscito", motivo: "Prova", origine: "crm", chi: "Giulia Esempio", creatoIl: "2026-11-21T11:00:00.000Z", aggiornatoIl: "2026-11-21T11:00:00.000Z", stripeRimborsoId: "re_prova" }],
  email: [{ chiave: "conferma_ordine", stato: "inviata", il: "2026-11-21T10:05:00.000Z", codice: null }],
  storico: [{ id: uuid(80), creatoIl: "2026-11-21T10:00:00.000Z", tipo: "pagato", chi: "stripe", prima: {}, dopo: {} }],
  avvisi: ["Giacenza da verificare."],
  migrazione: { pronta: true, pagamenti: true },
  ...extra,
});
const azioneOk = (n = 1, extra = {}) => ({ ok: true, ordine: ordineServer(n, { stato: "spedito" }), storico: true, ...extra });

export async function prove(mod, { c, gruppo, radice }) {
  const K = mod["ecommerce/client"];
  const Z = mod["ecommerce/azioni"];
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
  const corpoDi = (chiamata) => JSON.parse(chiamata.init.body);
  const porteMute = { visibile: () => true, adesso: () => 0, imposta: () => 0, annulla: () => {}, ascolta: () => () => {} };
  /** Tutte le prove sulle funzioni nuove: se il modulo non le ha ancora, ogni prova è rossa per la ragione giusta (la funzione manca) e non si ferma tutto. */
  const ha = (nome) => typeof K[nome] === "function";
  const provaCon = async (nome, fn) => {
    try {
      await fn();
    } catch (e) {
      c(`${nome}: nessuna eccezione`, "nessuna", String(e?.message ?? e).slice(0, 120));
    }
  };

  gruppo("NEGOZIO R2 · IL CLIENT DEGLI ORDINI DEL CRM (T61)");

  // ══ l'indirizzo del dettaglio ═══════════════════════════════════════════════════════════════════════════
  c("dettaglio: l'indirizzo è ?dettaglio=<uuid>", `/api/crm/ordini?dettaglio=${ID}`, ha("urlDettaglio") ? K.urlDettaglio(ID) : "manca urlDettaglio");
  c("dettaglio: un id che non è UUID non diventa un indirizzo", [null, null, null], ha("urlDettaglio") ? [K.urlDettaglio("1; drop"), K.urlDettaglio(""), K.urlDettaglio(`${ID}&x=1`)] : "manca urlDettaglio");

  // ══ la lettura del dettaglio ════════════════════════════════════════════════════════════════════════════
  await provaCon("leggiDettaglio", async () => {
    const f = fetchFinto(risposta(dettaglioOk()));
    const r = await K.leggiDettaglio(f, ID);
    c("leggiDettaglio: una sola richiesta GET sull'indirizzo del dettaglio", [[`/api/crm/ordini?dettaglio=${ID}`], [undefined]], [f.chiamate.map((x) => x.url), f.chiamate.map((x) => x.init?.method)]);
    c(
      "leggiDettaglio: ordine, riservati, rimborsi, email, storico, avvisi, migrazione dalla risposta",
      [true, ID, "Esempio Srl", 1, "riuscito", 1, "conferma_ordine", 1, ["Giacenza da verificare."], true, true],
      [r.ok, r.dettaglio?.ordine?.id, r.dettaglio?.riservati?.fattura?.ragioneSociale, r.dettaglio?.rimborsi?.length, r.dettaglio?.rimborsi?.[0]?.stato, r.dettaglio?.email?.length, r.dettaglio?.email?.[0]?.chiave, r.dettaglio?.storico?.length, r.dettaglio?.avvisi, r.dettaglio?.migrazione?.pronta, r.dettaglio?.migrazione?.pagamenti],
    );
    // Sezioni che il server non ha potuto leggere: `null` resta `null` (non «nessun rimborso»), e il resto si vede lo stesso.
    const r2 = await K.leggiDettaglio(fetchFinto(risposta(dettaglioOk(1, { riservati: null, rimborsi: null, storico: null }))), ID);
    c("leggiDettaglio: riservati, rimborsi e storico `null` restano `null` (mai «vuoto»)", [true, null, null, null], [r2.ok, r2.dettaglio?.riservati, r2.dettaglio?.rimborsi, r2.dettaglio?.storico]);
    const r3 = await K.leggiDettaglio(fetchFinto(risposta({ ok: true, ordine: ordineServer(1) })), ID);
    c("leggiDettaglio: campi assenti → valori prudenti (email e avvisi vuoti, migrazione non pronta)", [true, [], [], false, false], [r3.ok, r3.dettaglio?.email, r3.dettaglio?.avvisi, r3.dettaglio?.migrazione?.pronta, r3.dettaglio?.migrazione?.pagamenti]);
    const r4 = await K.leggiDettaglio(fetchFinto(risposta(dettaglioOk(1, { avvisi: ["ok", 5, null, { x: 1 }], email: "no", rimborsi: "no" }))), ID);
    c("leggiDettaglio: avvisi non testuali scartati; email e rimborsi non elenco → vuoto e `null`", [true, ["ok"], [], null], [r4.ok, r4.dettaglio?.avvisi, r4.dettaglio?.email, r4.dettaglio?.rimborsi]);
    const senzaOrdine = await K.leggiDettaglio(fetchFinto(risposta({ ok: true, rimborsi: [] })), ID);
    c("leggiDettaglio: risposta senza ordine → errore del server, non un successo", [false, "server"], [senzaOrdine.ok, senzaOrdine.errore?.tipo]);
    const altro = await K.leggiDettaglio(fetchFinto(risposta(dettaglioOk(2))), ID);
    c("leggiDettaglio: l'ordine della risposta non è quello chiesto → errore, non si mostra l'ordine sbagliato", [false, "server"], [altro.ok, altro.errore?.tipo]);
    const g = fetchFinto(risposta(dettaglioOk()));
    const cattivo = await K.leggiDettaglio(g, "non-uuid");
    c("leggiDettaglio: id non UUID → errore «valore» senza fare richieste", [false, "valore", 0], [cattivo.ok, cattivo.errore?.tipo, g.chiamate.length]);
    const caso = async (stato, corpo) => (await K.leggiDettaglio(fetchFinto(risposta(corpo, stato)), ID)).errore;
    c(
      "leggiDettaglio: 401, 403, 404, 500 e rete si distinguono",
      ["sessione", "permesso", "non_trovato", "server", "rete"],
      [(await caso(401, { ok: false })).tipo, (await caso(403, { ok: false })).tipo, (await caso(404, { ok: false, error: "non_trovato", messaggio: "Ordine non trovato." })).tipo, (await caso(500, "<html>no</html>")).tipo, (await K.leggiDettaglio(fetchFinto(new TypeError("Failed to fetch 3331234567")), ID)).errore.tipo],
    );
  });

  // ══ le otto azioni nuove: una funzione ciascuna, il corpo è esattamente quello atteso ═══════════════════
  const azioni = [
    ["spedisci", { ordineId: ID, corriere: "BRT", numero: "123456789012", senzaTracking: false }, { azione: "spedisci", ordineId: ID, corriere: "BRT", numero: "123456789012", senzaTracking: false }],
    ["spedisci", { ordineId: ID, corriere: "BRT", senzaTracking: true }, { azione: "spedisci", ordineId: ID, corriere: "BRT", senzaTracking: true }],
    ["annulla", { ordineId: ID, motivo: "Il cliente ha cambiato idea", rimborso: "ora", rimettiInMagazzino: true, chiaveRichiesta: uuid(0xc1) }, { azione: "annulla", ordineId: ID, motivo: "Il cliente ha cambiato idea", rimborso: "ora", rimettiInMagazzino: true, chiaveRichiesta: uuid(0xc1) }],
    ["annulla", { ordineId: ID, motivo: "Doppio ordine", rimborso: "nessuno", rimettiInMagazzino: false }, { azione: "annulla", ordineId: ID, motivo: "Doppio ordine", rimborso: "nessuno", rimettiInMagazzino: false }],
    ["rimborso", { ordineId: ID, importoCent: 1250, motivo: "Pezzo rovinato", chiaveRichiesta: uuid(0xc2), conferma: true }, { azione: "rimborso", ordineId: ID, importoCent: 1250, motivo: "Pezzo rovinato", chiaveRichiesta: uuid(0xc2), conferma: true }],
    ["riconcilia", { ordineId: ID }, { azione: "riconcilia", ordineId: ID }],
    ["fatturaEmessa", { ordineId: ID, nota: "Fattura 12/2026" }, { azione: "fattura_emessa", ordineId: ID, nota: "Fattura 12/2026" }],
    ["emailInvia", { ordineId: ID, chiave: "spedito" }, { azione: "email_invia", ordineId: ID, chiave: "spedito" }],
    ["giacenzaVerificata", { ordineId: ID }, { azione: "giacenza_verificata", ordineId: ID }],
    ["correggiStato", { ordineId: ID, da: "spedito", a: "nuovo", motivo: "Pacco tornato indietro" }, { azione: "correggi_stato", ordineId: ID, da: "spedito", a: "nuovo", motivo: "Pacco tornato indietro" }],
  ];
  for (const [nome, dati, atteso] of azioni) {
    await provaCon(`azione ${atteso.azione} (${nome})`, async () => {
      const f = fetchFinto(risposta(azioneOk()));
      const r = ha(nome) ? await K[nome](f, dati) : { ok: "manca la funzione" };
      const p = f.post();
      c(`${nome}: una sola POST sulla rotta degli ordini, col corpo esatto`, [1, "/api/crm/ordini", "application/json", atteso], [p.length, p[0]?.url, p[0]?.init?.headers?.["Content-Type"], p[0] && corpoDi(p[0])]);
      c(`${nome}: l'ordine nuovo arriva alla pagina`, [true, false, "spedito"], [r.ok, r.nessunCambio, r.ordine?.stato]);
    });
  }
  // Ogni azione nuova che il client sa fare è un'azione che `costruisciAzione` conosce (il corpo non inventa nomi).
  c(
    "i nomi delle azioni nuove sono quelli di azioni.ts (nessun nome inventato)",
    "tutti noti",
    azioni.every(([, , atteso]) => Z.costruisciAzione({ ...atteso }, mod["ecommerce/ordine"].normalizzaOrdine(rigaOrdineProva({ id: ID })), new Date("2026-11-21T12:00:00.000Z"), {})?.motivo !== "azione_sconosciuta") ? "tutti noti" : "uno sconosciuto",
  );

  await provaCon("azioni: id non UUID", async () => {
    for (const [nome, dati] of azioni) {
      const f = fetchFinto(risposta(azioneOk()));
      const r = ha(nome) ? await K[nome](f, { ...dati, ordineId: "1; drop" }) : { ok: "manca la funzione" };
      c(`${nome}: id non UUID → «valore» e nessuna richiesta`, [false, "valore", 0], [r.ok, r.errore?.tipo, f.chiamate.length]);
    }
  });

  await provaCon("rimborso: conferma", async () => {
    for (const conferma of [undefined, false, "true", 1]) {
      const f = fetchFinto(risposta(azioneOk()));
      const r = ha("rimborso") ? await K.rimborso(f, { ordineId: ID, importoCent: 100, motivo: "x", chiaveRichiesta: uuid(0xc2), conferma }) : { ok: "manca la funzione" };
      c(`rimborso: senza la conferma esplicita (${JSON.stringify(conferma)}) non parte nulla`, [false, "valore", 0], [r.ok, r.errore?.tipo, f.chiamate.length]);
    }
  });

  await provaCon("azioni: esito della risposta", async () => {
    const r = await K.rimborso(
      fetchFinto(risposta(azioneOk(1, { effetti: [{ tipo: "rimborso", esito: "in_corso", frase: "Rimborso in corso: non ripetere." }, { tipo: "x", esito: "boh", frase: 5 }], email: { chiave: "rimborso", stato: "inviata", frase: "Email inviata." }, avvisi: ["Pagato dopo la scadenza."] }))),
      { ordineId: ID, importoCent: 100, motivo: "x", chiaveRichiesta: uuid(0xc2), conferma: true },
    );
    c(
      "esito: effetti (voce per voce), email e avvisi arrivano; una voce sporca è scartata",
      [true, [{ tipo: "rimborso", esito: "in_corso", frase: "Rimborso in corso: non ripetere." }], { chiave: "rimborso", stato: "inviata", frase: "Email inviata." }, ["Pagato dopo la scadenza."]],
      [r.ok, r.effetti, r.email, r.avvisi],
    );
    const s = await K.spedisci(fetchFinto(risposta(azioneOk())), { ordineId: ID, corriere: "BRT", senzaTracking: true });
    c("esito: senza effetti, email e avvisi → vuoti, non `undefined`", [[], null, []], [s.effetti, s.email, s.avvisi]);
    const n = await K.riconcilia(fetchFinto(risposta({ ok: false, error: "nessun_cambio", messaggio: "Niente da fare." })), { ordineId: ID });
    c("esito: «nessun_cambio» (200, ok:false) = niente da fare, non un errore", [true, true], [n.ok, n.nessunCambio]);
    const manca = await K.riconcilia(fetchFinto(risposta({ ok: true, storico: true })), { ordineId: ID });
    c("esito: ok senza l'ordine → errore del server", [false, "server"], [manca.ok, manca.errore?.tipo]);
    const storicoNo = await K.riconcilia(fetchFinto(risposta(azioneOk(1, { storico: false }))), { ordineId: ID });
    c("esito: `storico:false` arriva alla pagina", false, storicoNo.storico);
    // Gli errori d'azione: la frase della rotta si mostra (è scritta dal server, senza dati del cliente).
    const caso = async (stato, corpo) => (await K.annulla(fetchFinto(risposta(corpo, stato)), { ordineId: ID, motivo: "x", rimborso: "nessuno", rimettiInMagazzino: false })).errore;
    const e1 = await caso(409, { ok: false, error: "conflitto", messaggio: "Esiste un rimborso: l'ordine non si può riattivare." });
    const e2 = await caso(409, { ok: false, error: "migrazione", messaggio: "Mancano gli aggiornamenti del database per i pagamenti." });
    const e3 = await caso(409, { ok: false, error: "valore", messaggio: "Il rimborso è oltre il pagato." });
    const e4 = await caso(502, { ok: false, error: "interno", messaggio: "Non sono riuscito a riattivare l'ordine: è rimasto annullato." });
    c("errori d'azione: conflitto, migrazione, valore e guasto con la frase della rotta", [["conflitto", true], ["migrazione", true], ["valore", true], ["server", true]], [
      [e1.tipo, /non si può riattivare/.test(e1.messaggio)],
      [e2.tipo, /pagamenti/.test(e2.messaggio)],
      [e3.tipo, /oltre il pagato/.test(e3.messaggio)],
      [e4.tipo, /rimasto annullato/.test(e4.messaggio)],
    ]);
    const rete = await K.rimborso(fetchFinto(new TypeError("rete 3331234567")), { ordineId: ID, importoCent: 100, motivo: "x", chiaveRichiesta: uuid(0xc2), conferma: true });
    c("errori d'azione: rete assente → «rete», con la frase «non so se è stato salvato», senza il testo del browser", [false, "rete", true, false], [rete.ok, rete.errore.tipo, /non so se|ricontrolla|controlla/i.test(rete.errore.messaggio), /3331234567/.test(rete.errore.messaggio)]);
  });

  // ══ la chiave della richiesta: una per apertura del dialogo, riusata nei nuovi invii ════════════════════
  await provaCon("chiaveRichiesta", async () => {
    let n = 0;
    const f = fetchFinto(risposta(azioneOk()));
    const archivio = K.creaArchivioDettaglio({ fetch: f, permesso: () => true, generaChiave: () => uuid(0x1000 + ++n) });
    await archivio.apri(ID);
    const d1 = archivio.apriDialogo();
    c("chiave: il dialogo ha una chiave UUID subito, prima di ogni invio", true, Z.eUuid(d1.chiaveRichiesta));
    await d1.rimborso({ importoCent: 100, motivo: "Prima prova", conferma: true });
    await d1.rimborso({ importoCent: 100, motivo: "Prima prova", conferma: true });
    await d1.annulla({ motivo: "Altro", rimborso: "ora", rimettiInMagazzino: true });
    const p = f.post().map(corpoDi);
    c("chiave: tra tre invii dello stesso dialogo la chiave non cambia (rimborso, rimborso, annulla)", [3, [d1.chiaveRichiesta], ID], [p.length, [...new Set(p.map((x) => x.chiaveRichiesta))], p[0]?.ordineId]);
    const d2 = archivio.apriDialogo();
    await d2.rimborso({ importoCent: 100, motivo: "Seconda prova", conferma: true });
    const q = f.post().map(corpoDi);
    c("chiave: al dialogo successivo la chiave cambia", [true, d2.chiaveRichiesta], [d2.chiaveRichiesta !== d1.chiaveRichiesta, q[3]?.chiaveRichiesta]);
    // Anche un invio riuscito non fa girare la chiave: se l'utente preme di nuovo nello stesso dialogo è la STESSA richiesta.
    c("chiave: la chiave del dialogo si legge due volte uguale", true, d1.chiaveRichiesta === d1.chiaveRichiesta && d1.chiaveRichiesta === p[0].chiaveRichiesta);
    // Il generatore vero: UUID diversi uno dall'altro.
    const v = K.creaArchivioDettaglio({ fetch: fetchFinto(risposta(azioneOk())), permesso: () => true });
    const a = v.apriDialogo().chiaveRichiesta;
    const b = v.apriDialogo().chiaveRichiesta;
    c("chiave: il generatore vero dà UUID validi e diversi", [true, true, true], [Z.eUuid(a), Z.eUuid(b), a !== b]);
  });

  // ══ un 409 non genera un secondo invio ══════════════════════════════════════════════════════════════════
  await provaCon("409", async () => {
    const f = fetchFinto((url, init) => (init?.method === "POST" ? risposta({ ok: false, error: "conflitto", messaggio: "L'ordine è stato modificato da qualcun altro nel frattempo: ricarica e riprova." }, 409) : risposta(dettaglioOk())));
    const archivio = K.creaArchivioDettaglio({ fetch: f, permesso: () => true });
    await archivio.apri(ID);
    const r = await archivio.spedisci({ corriere: "BRT", senzaTracking: true });
    await sfiata();
    c("409: la risposta è «conflitto» con la frase della rotta", [false, "conflitto"], [r.ok, r.errore?.tipo]);
    c("409: una sola POST, nessun secondo invio (neanche dopo un po')", 1, f.post().length);
    c("409: il dettaglio si rilegge da solo (GET), per mostrare com'è ora", true, f.get().length >= 2);
    const d = archivio.apriDialogo();
    await d.rimborso({ importoCent: 100, motivo: "x", conferma: true });
    await sfiata();
    c("409: anche dal dialogo del rimborso una POST sola per clic", 2, f.post().length);
  });

  // ══ l'archivio del dettaglio: si legge solo quando il pannello è aperto ═════════════════════════════════
  await provaCon("archivio: lettura", async () => {
    const f = fetchFinto(risposta(dettaglioOk()));
    const archivio = K.creaArchivioDettaglio({ fetch: f, permesso: () => true });
    c("archivio: appena creato non ha letto niente e non ha un ordine", [0, null, null, false], [f.chiamate.length, archivio.stato().ordineId, archivio.stato().dettaglio, archivio.stato().inCaricamento]);
    await archivio.apri(ID);
    const s = archivio.stato();
    c("archivio: dopo `apri` una sola lettura e il dettaglio è nello stato", [1, ID, ID, false, null], [f.chiamate.length, s.ordineId, s.dettaglio?.ordine?.id, s.inCaricamento, s.errore]);
    archivio.chiudi();
    c("archivio: `chiudi` toglie dalla memoria anche i dati riservati", [null, null, null], [archivio.stato().ordineId, archivio.stato().dettaglio, archivio.stato().errore]);
    c("archivio: `chiudi` non fa richieste", 1, f.chiamate.length);
    const ascoltati = [];
    const smetti = archivio.iscrivi(() => ascoltati.push(1));
    await archivio.apri(ID);
    smetti();
    const n = ascoltati.length;
    await archivio.apri(ID);
    c("archivio: chi si disiscrive non sente più i cambiamenti", [true, n], [n > 0, ascoltati.length]);
  });

  await provaCon("archivio: la lista non legge il dettaglio", async () => {
    // L'archivio degli ordini di sempre, avviato, legge SOLO l'elenco: mai `?dettaglio=`.
    const f = fetchFinto(risposta({ ok: true, ordini: [ordineServer(1)], scartati: 0, troncato: false, migrazione: { pronta: true }, adesso: "2026-11-21T12:00:00.000Z" }));
    const lista = K.creaArchivioOrdini({ fetch: f, porte: porteMute });
    const ferma = lista.avvia();
    await sfiata();
    await lista.esegui({ azione: "nota_interna", ordineId: ID, valore: "ciao" });
    ferma();
    c("lista: all'apertura (e dopo un'azione) non si legge nessun dettaglio", [true, 0], [f.chiamate.length >= 1, f.chiamate.filter((x) => /dettaglio=/.test(x.url)).length]);
  });

  await provaCon("archivio: due pannelli di seguito", async () => {
    // La lettura del primo ordine arriva DOPO l'apertura del secondo: non deve prendere il posto.
    const f = fetchSospeso();
    const archivio = K.creaArchivioDettaglio({ fetch: f, permesso: () => true });
    const A = archivio.apri(uuid(1));
    const B = archivio.apri(uuid(2));
    f.chiamate[1].ok(risposta(dettaglioOk(2)));
    await B;
    f.chiamate[0].ok(risposta(dettaglioOk(1)));
    await A;
    c("archivio: la risposta in ritardo del primo ordine non sostituisce il secondo", [uuid(2), uuid(2)], [archivio.stato().ordineId, archivio.stato().dettaglio?.ordine?.id]);
    archivio.chiudi();
    const g = fetchSospeso();
    const a2 = K.creaArchivioDettaglio({ fetch: g, permesso: () => true });
    const p = a2.apri(ID);
    a2.chiudi();
    g.chiamate[0].ok(risposta(dettaglioOk(1)));
    await p;
    c("archivio: una lettura che finisce dopo `chiudi` non rimette i dati in memoria", [null, null], [a2.stato().ordineId, a2.stato().dettaglio]);
  });

  await provaCon("archivio: errori di lettura", async () => {
    const f = fetchFinto(risposta(dettaglioOk()), risposta({ ok: false, error: "interno", messaggio: "Il database non ha risposto." }, 500));
    const archivio = K.creaArchivioDettaglio({ fetch: f, permesso: () => true });
    await archivio.apri(ID);
    await archivio.ricarica();
    c("archivio: una lettura che fallisce tiene il dettaglio dell'ultima buona e mostra l'errore", [ID, "server"], [archivio.stato().dettaglio?.ordine?.id, archivio.stato().errore?.tipo]);
    const g = fetchFinto(risposta(dettaglioOk()), risposta({ ok: false }, 403));
    const a2 = K.creaArchivioDettaglio({ fetch: g, permesso: () => true });
    await a2.apri(ID);
    await a2.ricarica();
    c("archivio: il permesso tolto (403) svuota i dati riservati dallo stato", [null, "permesso"], [a2.stato().dettaglio, a2.stato().errore?.tipo]);
    const h = fetchFinto(risposta({ ok: false, error: "non_trovato", messaggio: "Ordine non trovato." }, 404));
    const a3 = K.creaArchivioDettaglio({ fetch: h, permesso: () => true });
    await a3.apri(ID);
    c("archivio: ordine non trovato → errore «non_trovato», niente dati", [null, "non_trovato"], [a3.stato().dettaglio, a3.stato().errore?.tipo]);
    const k = fetchFinto(risposta(dettaglioOk()));
    const a4 = K.creaArchivioDettaglio({ fetch: k, permesso: () => true });
    await a4.apri("non-uuid");
    c("archivio: apri con un id non UUID → errore «valore», nessuna richiesta", [0, "valore"], [k.chiamate.length, a4.stato().errore?.tipo]);
  });

  // ══ il permesso: se la porta dice no, nessuna chiamata ══════════════════════════════════════════════════
  await provaCon("archivio: permesso", async () => {
    const f = fetchFinto(risposta(dettaglioOk()));
    const archivio = K.creaArchivioDettaglio({ fetch: f, permesso: () => false });
    await archivio.apri(ID);
    c("permesso negato: `apri` non fa nessuna richiesta, errore «permesso», nessun dato", [0, "permesso", null], [f.chiamate.length, archivio.stato().errore?.tipo, archivio.stato().dettaglio]);
    await archivio.ricarica();
    const risultati = [
      await archivio.spedisci({ corriere: "BRT", senzaTracking: true }),
      await archivio.riconcilia(),
      await archivio.fatturaEmessa({ nota: "x" }),
      await archivio.emailInvia({ chiave: "spedito" }),
      await archivio.giacenzaVerificata(),
      await archivio.correggiStato({ da: "spedito", a: "nuovo", motivo: "x" }),
      await archivio.apriDialogo().rimborso({ importoCent: 100, motivo: "x", conferma: true }),
      await archivio.apriDialogo().annulla({ motivo: "x", rimborso: "nessuno", rimettiInMagazzino: false }),
    ];
    c("permesso negato: nessuna delle otto azioni, né `ricarica`, fa una richiesta", [0, Array(8).fill("permesso")], [f.chiamate.length, risultati.map((r) => r.errore?.tipo)]);
    // Il permesso si legge a ogni chiamata (non una volta sola alla creazione): chi lo perde a metà non fa più nulla.
    let consentito = true;
    const g = fetchFinto(risposta(dettaglioOk()), risposta(azioneOk()));
    const a2 = K.creaArchivioDettaglio({ fetch: g, permesso: () => consentito });
    await a2.apri(ID);
    consentito = false;
    const r = await a2.riconcilia();
    c("permesso tolto a metà: la prossima azione non parte", [1, "permesso"], [g.chiamate.length, r.errore?.tipo]);
  });

  await provaCon("archivio: un invio alla volta", async () => {
    const f = fetchFinto(risposta(dettaglioOk()), (url, init) => (init?.method === "POST" ? new Promise((ok) => setTimeout(() => ok(risposta(azioneOk())), 5)) : risposta(dettaglioOk())));
    const archivio = K.creaArchivioDettaglio({ fetch: f, permesso: () => true });
    await archivio.apri(ID);
    const prima = archivio.riconcilia();
    const seconda = await archivio.riconcilia();
    await prima;
    c("un invio alla volta: il secondo, mentre il primo è in corso, non parte (una POST sola)", [1, false, "valore"], [f.post().length, seconda.ok, seconda.errore?.tipo]);
    const terza = await archivio.riconcilia();
    c("un invio alla volta: finito il primo se ne può fare un altro", [true, 2], [terza.ok, f.post().length]);
  });

  await provaCon("archivio: dopo un'azione riuscita", async () => {
    const nuovo = ordineServer(1, { stato: "spedito", corriere: "BRT" });
    const f = fetchFinto(risposta(dettaglioOk()), (url, init) => (init?.method === "POST" ? risposta({ ok: true, ordine: nuovo, storico: true }) : risposta(dettaglioOk(1, { ordine: nuovo }))));
    const archivio = K.creaArchivioDettaglio({ fetch: f, permesso: () => true });
    await archivio.apri(ID);
    const r = await archivio.spedisci({ corriere: "BRT", senzaTracking: true });
    await sfiata();
    c("dopo l'azione: il dettaglio ha l'ordine nuovo e viene riletto (rimborsi, email, storico)", [true, "spedito", true], [r.ok, archivio.stato().dettaglio?.ordine?.stato, f.get().length >= 2]);
  });

  // ══ le funzioni di prima non cambiano ═══════════════════════════════════════════════════════════════════
  c("funzioni di prima: ci sono ancora tutte", "tutte", ["urlElenco", "urlConta", "urlStorico", "urlLead", "leggiElenco", "leggiConta", "leggiStorico", "eseguiAzione", "applicaOrdine", "oraHHmm", "creaLettore", "creaArchivioOrdini", "avviaConta", "porteBrowser"].every((n) => typeof K[n] === "function") ? "tutte" : "ne manca una");
  c("funzioni di prima: l'indirizzo dell'elenco, del numeretto e dello storico sono quelli di sempre", ["/api/crm/ordini", "/api/crm/ordini?conta=1", `/api/crm/ordini?storico=${ID}`], [K.urlElenco(), K.urlConta(), K.urlStorico(ID)]);

  // ══ sul sorgente ════════════════════════════════════════════════════════════════════════════════════════
  const client = senzaCommenti(leggi("src/crm/ecommerce/client.ts"));
  c("client.ts: nessun `console.*` (gli ordini hanno nome, telefono e indirizzo)", false, /\bconsole\./.test(client));
  c("client.ts: nessun nuovo accesso al browser fuori dalle porte (`window`, `localStorage`, `sessionStorage`)", false, /\blocalStorage\b|\bsessionStorage\b/.test(client));
  c("client.ts: nessun ritentativo automatico di una POST (`retry`, `riprova` non compaiono)", false, /\bretry\b|\briprova\w*\(/i.test(client));

  const fileHook = "src/crm/ecommerce/useDettaglioOrdine.ts";
  c("useDettaglioOrdine.ts esiste", true, existsSync(join(radice, fileHook)));
  if (existsSync(join(radice, fileHook))) {
    const h = senzaCommenti(leggi(fileHook));
    c("hook: nessun `console.*`, nessun `fetch(` diretto (passa da fetchCRM e dall'archivio)", [false, false, true], [/\bconsole\./.test(h), /(^|[^\w.])fetch\(/.test(h), /fetchCRM/.test(h)]);
    c("hook: legge solo se c'è un ordine e il permesso (`apri` dentro un `if`), altrimenti `chiudi`", [true, true], [/if\s*\(\s*ordineId\s*&&\s*attivo\s*\)\s*\{?\s*(void\s+)?archivio\.apri\(/.test(h), /archivio\.chiudi\(/.test(h)]);
    c("hook: l'effetto dipende da ordine e permesso; al cambio si richiude", [true, true], [/\[\s*archivio\s*,\s*ordineId\s*,\s*attivo\s*\]/.test(h), /return\s*\(\)\s*=>\s*archivio\.chiudi\(\)/.test(h)]);
    c("hook: nessuna lettura all'apertura della lista (non importa `useOrdini`)", false, /useOrdini\b/.test(h));
    c("hook: il permesso si legge a ogni chiamata (un riferimento, non il valore di un solo giro)", true, /useRef\(/.test(h) && /permesso:\s*\(\)\s*=>/.test(h));
  }
}
