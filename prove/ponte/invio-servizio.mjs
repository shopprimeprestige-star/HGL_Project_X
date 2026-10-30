/** ── PROVE: INVIO A MANO DAL PONTE · il servizio sul Mac (compito T3) ──
 *
 *  Commessa 2026-10-30-ponte-invio-manuale. Prova `strumenti/ponte-whatsapp/`:
 *  `invio.mjs` (limiti locali, ciclo di richiesta, esito, riavvio a metà),
 *  `collega.mjs` (`jidDaNumero`, `inviaTesto`, `getMessage` in RAM),
 *  `config.mjs` (`INVII_ATTIVI`) e il battito. Tutto SENZA WhatsApp e senza
 *  rete: socket finto, `fetch` finto, cartella temporanea, orologio finto e
 *  attese che avanzano da sole (`pianifica` finto). Le guardie sul sorgente
 *  (un solo `sendMessage`, niente altro) stanno in `servizio-guardie.mjs`.
 *  Dati inventati: nessun numero né nome vero (prefisso 39 333 000…).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const T0 = Date.UTC(2026, 9, 30, 12, 0, 0);
const C1 = "393330000001";
const C2 = "393330000002";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";
const UB = "44444444-4444-4444-8444-444444444444";
const permessi = (p) => statSync(p).mode & 0o777;
const SEC = 1000;
const ORA = 3600 * SEC;

/** Un orologio finto, che avanza a mano e con le attese. */
function orologioFinto() {
  let t = T0;
  const o = () => t;
  o.vai = (ms) => (t += ms);
  o.a = (ms) => (t = T0 + ms);
  return o;
}

/** Una risposta HTTP finta, come la legge `spedisci`. */
const http = (stato, corpo) => ({ status: stato, text: async () => (corpo === undefined ? "" : JSON.stringify(corpo)) });
const vuota = http(200, { ok: true, invio: null, attendi_s: 0, limite: false });
const conInvio = (id, numero, testo, extra = {}) => http(200, { ok: true, invio: { id, numero, testo }, attendi_s: 0, limite: false, ...extra });
/** `fetch` che non risponde (rete assente). */
const RETE = "rete";

/** L'ambiente di una prova: cartella nuova, orologio e attese finte, `fetch` a copione. */
function ambiente(radice, creaInvii, base, { copione = {}, attivo = true, collegato = true, inviaTesto, casuale = () => 0, orologio = orologioFinto(), cartella } = {}) {
  const cart = cartella ?? mkdtempSync(join(base, "inv-"));
  const attese = [];
  const richieste = [];
  const registrate = [];
  const invii = [];
  /** `copione.prendi` / `copione.esito`: lista di risposte (l'ultima resta), o funzione */
  const prossima = (tipo, corpo) => {
    const s = copione[tipo];
    if (typeof s === "function") return s(corpo);
    const lista = s ?? [];
    return lista.length ? (lista.length > 1 ? lista.shift() : lista[0]) : tipo === "prendi" ? vuota : http(200, { ok: true, stato: "inviato" });
  };
  const fetchFinto = async (_url, init) => {
    const corpo = JSON.parse(init.body);
    richieste.push({ t: orologio(), tipo: corpo.tipo, corpo });
    const r = prossima(corpo.tipo, corpo);
    if (r === RETE) throw new Error("rete assente");
    return r;
  };
  const stato = { collegato };
  const inv = creaInvii({
    url: "https://crm.example.test/api/public/ponte-whatsapp",
    token: "t".repeat(40),
    cartella: cart,
    attivo,
    collegato: () => stato.collegato,
    inviaTesto:
      inviaTesto ??
      (async (numero, testo) => {
        invii.push({ t: orologio(), numero, testo });
        return { ok: true, id: `WA${invii.length}`, ts: Math.floor(orologio() / 1000) };
      }),
    registro: (codice, conteggi) => registrate.push({ codice, conteggi }),
    orologio,
    fetch: fetchFinto,
    casuale,
    //  le attese avanzano da sole: si ricorda quanto, si porta avanti l'orologio, si prosegue
    pianifica: (f, ms) => {
      attese.push(ms);
      orologio.vai(ms);
      setImmediate(f);
      return attese.length;
    },
  });
  return { inv, cart, attese, richieste, registrate, invii, stato, orologio, tipi: () => richieste.map((r) => r.tipo), codici: () => registrate.map((r) => r.codice) };
}

/** Baileys finto per `creaCollegamento`: registra le chiamate di `sendMessage`. */
function baileysFinto() {
  const sockets = [];
  const baileys = {
    Browsers: { macOS: (b) => ["Mac OS", b, "14.4.1"] },
    useMultiFileAuthState: async (cartella) => ({ state: { cartella }, saveCreds: async () => {} }),
    makeWASocket: (opzioni) => {
      const ascolti = new Map();
      const s = {
        opzioni,
        user: { id: "393330009999:3@s.whatsapp.net" },
        chiamate: [],
        esito: async (jid, contenuto) => ({ key: { id: `ID${s.chiamate.length - 1}`, remoteJid: jid, fromMe: true }, message: { conversation: contenuto.text }, messageTimestamp: 1792000000 + s.chiamate.length - 1 }),
        ev: { on: (nome, f) => ascolti.set(nome, [...(ascolti.get(nome) ?? []), f]) },
        ws: { on: () => {} },
        signalRepository: { lidMapping: { getPNForLID: async () => null } },
        end: () => {},
        sendMessage: async (jid, contenuto) => {
          s.chiamate.push([jid, contenuto]);
          return s.esito(jid, contenuto);
        },
        emetti: async (nome, dati) => {
          for (const f of ascolti.get(nome) ?? []) await f(dati);
        },
      };
      sockets.push(s);
      return s;
    },
  };
  return { baileys, sockets };
}

export async function provePonteInvioServizio(mod, { c, gruppo, radice }) {
  gruppo("PONTE · INVIO A MANO · IL SERVIZIO SUL MAC (T3)");
  const src = (f) => pathToFileURL(join(radice, "strumenti/ponte-whatsapp/src", f)).href;
  const V = await import(src("invio.mjs"));
  const K = await import(src("collega.mjs"));
  const Cfg = await import(src("config.mjs"));
  const I = await import(src("index.mjs"));
  const L = await import(src("lotti.mjs"));
  const TI = mod["ponte/invio-tipi"];
  const base = mkdtempSync(join(tmpdir(), "ponte-invio-"));
  const amb = (o) => ambiente(radice, V.creaInvii, base, o);

  try {
    // ── 1. Configurazione: INVII_ATTIVI, di serie spento ─────────────────
    const token = "k".repeat(40);
    const conf = (extra = "") => Cfg.analizzaConfig(`PONTE_URL=https://a.test\nPONTE_TOKEN=${token}\n${extra}`);
    c("config: INVII_ATTIVI di serie 0 (spento)", 0, conf().config.invii);
    c("config: INVII_ATTIVI=1 acceso, =0 spento", [1, 0], [conf("INVII_ATTIVI=1").config.invii, conf("INVII_ATTIVI=0").config.invii]);
    c("config: INVII_ATTIVI=2, =si, =-1 → valore_non_valido", ["valore_non_valido", "valore_non_valido", "valore_non_valido"], ["INVII_ATTIVI=2", "INVII_ATTIVI=si", "INVII_ATTIVI=-1"].map((r) => conf(r).errore));

    // ── 2. L'indirizzo del cliente: solo da un numero già validato ────────
    c("jidDaNumero: 393330000001 → …@s.whatsapp.net", `${C1}@s.whatsapp.net`, K.jidDaNumero(C1));
    c(
      "jidDaNumero: @lid, gruppo, +39…, 7 e 16 cifre, ../, vuoto, non-stringhe → null",
      Array(10).fill(null),
      [`${C1}@lid`, "120363000000000000@g.us", `+${C1}`, "1234567", "1234567890123456", "../../etc", "", null, undefined, 393330000001].map(K.jidDaNumero),
    );

    // ── 3. I limiti locali sono quelli del server ────────────────────────
    const lim = TI.LIMITI_INVIO;
    c(
      "LIMITI_PONTE = LIMITI_INVIO (caratteri, intervallo, al giorno, ore)",
      { caratteri: lim.caratteri, intervalloS: lim.intervalloS, alGiorno: lim.alGiorno, giornoOre: lim.giornoOre },
      { caratteri: V.LIMITI_PONTE.caratteri, intervalloS: V.LIMITI_PONTE.intervalloS, alGiorno: V.LIMITI_PONTE.alGiorno, giornoOre: V.LIMITI_PONTE.giornoOre },
    );

    // ── 4. puoPartire: 20 s (più jitter), 20 in 24 ore ───────────────────
    const ADESSO = T0;
    const dopo = (s, jitterMs = 0) => V.puoPartire({ adesso: ADESSO, presi: [ADESSO - s * SEC], jitterMs });
    c("puoPartire: nessun invio prima → via libera", { ok: true }, V.puoPartire({ adesso: ADESSO, presi: [] }));
    c("puoPartire: 19 s dopo l'ultimo → no, mancano 1000 ms", { ok: false, aspettaMs: 1000, perche: "intervallo" }, dopo(19));
    c("puoPartire: 20 s dopo l'ultimo → sì", { ok: true }, dopo(20));
    c("puoPartire: con 3 s di ritardo casuale, 22 s no e 23 s sì", [false, true], [dopo(22, 3000).ok, dopo(23, 3000).ok]);
    c("puoPartire: il ritardo casuale non va oltre 5 s (limite del ciclo)", true, V.RITARDO_MASSIMO_MS <= 5000);
    const piuVecchiaTraCent = Array.from({ length: 20 }, (_, i) => ADESSO - (24 * 3600 - 100 - i) * SEC);
    c("puoPartire: 19 invii nelle 24 ore → il 20° sì", { ok: true }, V.puoPartire({ adesso: ADESSO, presi: Array.from({ length: 19 }, (_, i) => ADESSO - (3600 + i) * SEC) }));
    c("puoPartire: 20 invii nelle 24 ore → il 21° no, aspetta che il più vecchio esca (100 s)", { ok: false, aspettaMs: 100 * SEC, perche: "giorno" }, V.puoPartire({ adesso: ADESSO, presi: piuVecchiaTraCent }));
    const dentro = V.puoPartire({ adesso: ADESSO, presi: Array.from({ length: 20 }, (_, i) => ADESSO - (23 * 3600 + i * 10) * SEC) });
    c("puoPartire: 20 invii, il più vecchio di 23 h e 200 s → sì quando esce (tra 1 h − 200 s)", { ok: false, aspettaMs: ORA - 190 * SEC, perche: "giorno" }, dentro);
    c("puoPartire: 20 invii di cui il più vecchio di 24 h e 1 s → è già uscito, sì", { ok: true }, V.puoPartire({ adesso: ADESSO, presi: [ADESSO - 24 * ORA - SEC, ...Array.from({ length: 19 }, (_, i) => ADESSO - (3600 + i) * SEC)] }));
    c("puoPartire: orologio indietro (invio nel futuro) → conta ancora, aspetta al più intervallo + ritardo", { ok: false, aspettaMs: 20_000, perche: "intervallo" }, V.puoPartire({ adesso: ADESSO, presi: [ADESSO + 2 * ORA] }));

    // ── 5. inviaTesto e getMessage, con un socket finto ──────────────────
    {
      const { baileys, sockets } = baileysFinto();
      const dir5 = mkdtempSync(join(base, "col-"));
      const attese5 = [];
      const col = K.creaCollegamento({
        baileys,
        percorsi: { auth: join(dir5, "auth"), lid: join(dir5, "lid.json") },
        fila: { aggiungi: () => ({ piena: false, accettati: 0 }) },
        qr: { mostra: async () => {}, togli: () => {}, notifica: async () => {} },
        registro: () => {},
        orologio: () => T0,
        pianifica: (f, ms) => (attese5.push({ f, ms }), attese5.length),
        annulla: () => {},
      });
      c("inviaTesto prima del collegamento → non_collegato, zero chiamate", { ok: false, motivo: "non_collegato" }, await col.inviaTesto(C1, "Ciao"));
      await col.avvia();
      const s = sockets[0];
      c("inviaTesto con il socket ancora senza «open» → non_collegato", { ok: false, motivo: "non_collegato" }, await col.inviaTesto(C1, "Ciao"));
      c("zero chiamate a sendMessage finora", 0, s.chiamate.length);
      await s.emetti("connection.update", { connection: "open" });
      const r1 = await col.inviaTesto(C1, "Ciao, a domani");
      c("inviaTesto collegato → una sola sendMessage, al JID, con solo {text}", [[[`${C1}@s.whatsapp.net`, { text: "Ciao, a domani" }]], 1], [s.chiamate, s.chiamate.length]);
      c("inviaTesto: ok con l'id di WhatsApp e l'ora vera in secondi", { ok: true, id: "ID0", ts: 1792000000 }, r1);
      c("inviaTesto: numero non valido o testo vuoto → rifiutato senza chiamare", [{ ok: false, motivo: "numero_non_valido" }, { ok: false, motivo: "numero_non_valido" }, { ok: false, motivo: "testo_non_valido" }, 1], [await col.inviaTesto(`${C1}@lid`, "x"), await col.inviaTesto("../etc", "x"), await col.inviaTesto(C1, ""), s.chiamate.length]);
      c("getMessage: dopo l'invio restituisce il contenuto di QUEL messaggio", { conversation: "Ciao, a domani" }, await s.opzioni.getMessage({ id: "ID0", remoteJid: `${C1}@s.whatsapp.net`, fromMe: true }));
      const chiaveGiusta = { id: "ID0", remoteJid: `${C1}@s.whatsapp.net`, fromMe: true };
      c("getMessage: stesso id ma un altro destinatario → undefined", undefined, await s.opzioni.getMessage({ ...chiaveGiusta, remoteJid: `${C2}@s.whatsapp.net` }));
      c("getMessage: fromMe falso o assente → undefined", [undefined, undefined], [await s.opzioni.getMessage({ ...chiaveGiusta, fromMe: false }), await s.opzioni.getMessage({ id: "ID0", remoteJid: chiaveGiusta.remoteJid })]);
      c("getMessage: senza remoteJid, gruppo o @lid sconosciuto → undefined", [undefined, undefined, undefined], [await s.opzioni.getMessage({ id: "ID0", fromMe: true }), await s.opzioni.getMessage({ ...chiaveGiusta, remoteJid: "120363000000000000@g.us" }), await s.opzioni.getMessage({ ...chiaveGiusta, remoteJid: "999@lid" })]);
      c("getMessage: lo stesso destinatario con il dispositivo (…:7@) → il messaggio", { conversation: "Ciao, a domani" }, await s.opzioni.getMessage({ ...chiaveGiusta, remoteJid: `${C1}:7@s.whatsapp.net` }));
      c("getMessage: un id sconosciuto → undefined", [undefined, undefined, undefined], [await s.opzioni.getMessage({ id: "SCONOSCIUTO" }), await s.opzioni.getMessage({}), await s.opzioni.getMessage(undefined)]);

      //  l'eccezione e il tempo scaduto sono «non so se è partito»: mai un ritentativo da soli
      const prima = s.esito;
      s.esito = async () => {
        throw new Error("socket chiuso a metà");
      };
      c("inviaTesto: eccezione durante l'invio → esito_incerto", { ok: false, motivo: "esito_incerto" }, await col.inviaTesto(C1, "Secondo"));
      c("inviaTesto: dopo l'eccezione una sola chiamata in più (nessun ritentativo)", 2, s.chiamate.length);
      s.esito = () => new Promise(() => {});
      const inCorso = col.inviaTesto(C1, "Terzo");
      await new Promise((ok) => setImmediate(ok));
      const scadenza = attese5.at(-1);
      c("inviaTesto: attesa massima di 30 s", 30_000, scadenza.ms);
      scadenza.f();
      c("inviaTesto: tempo scaduto → esito_incerto", { ok: false, motivo: "esito_incerto" }, await inCorso);
      s.esito = async () => ({ key: {}, message: {} });
      c("inviaTesto: risposta senza id → esito_incerto (non si inventa un id)", { ok: false, motivo: "esito_incerto" }, await col.inviaTesto(C1, "Quarto"));
      s.esito = prima;

      //  la memoria è solo in RAM e tiene gli ultimi 50
      for (let i = 0; i < 51; i++) await col.inviaTesto(C1, `messaggio ${i}`);
      const ids = s.chiamate.map((_, i) => `ID${i}`);
      const presenti = [];
      for (const id of ids) if (await s.opzioni.getMessage({ id, remoteJid: `${C1}@s.whatsapp.net`, fromMe: true })) presenti.push(id);
      c("getMessage: ricorda al più gli ultimi 50 inviati (il più vecchio non c'è più)", [50, false, true], [presenti.length, presenti.includes("ID0"), presenti.includes(ids.at(-1))]);
      const file5 = readdirSync(dir5, { recursive: true }).map(String);
      c("getMessage: la memoria non scrive niente su disco", [], file5.filter((f) => /msg|messaggi|ricord|inviat/i.test(f)));

      //  dopo ferma() non si invia più
      col.ferma();
      c("inviaTesto dopo ferma() → non_collegato", { ok: false, motivo: "non_collegato" }, await col.inviaTesto(C1, "Dopo"));
    }

    // ── 6. Il ciclo: quando chiede, quando invia, quando si ferma ────────
    {
      const a = amb({ attivo: false });
      await a.inv.sveglia();
      c("INVII_ATTIVI=0 → nessuna richiesta, anche con il battito che dice «ce n'è»", [0, false], [a.richieste.length, a.inv.dopoBattito({ ok: true, riconciliati: 0, invii_in_attesa: 5 })]);
    }
    {
      const a = amb({ collegato: false });
      await a.inv.sveglia();
      c("non collegato → nessuna richiesta", [0, false], [a.richieste.length, a.inv.dopoBattito({ ok: true, invii_in_attesa: 2 })]);
    }
    {
      const a = amb();
      const mai = [a.inv.dopoBattito({ ok: true, riconciliati: 0, invii_in_attesa: 0 }), a.inv.dopoBattito({ ok: true, riconciliati: 0 }), a.inv.dopoBattito(null), a.inv.dopoBattito({ invii_in_attesa: "3" }), a.inv.dopoBattito({ invii_in_attesa: -1 })];
      await new Promise((ok) => setImmediate(ok));
      c("battito con invii_in_attesa = 0, assente, storto → nessun prendi", [Array(5).fill(false), 0], [mai, a.richieste.length]);
      const si = a.inv.dopoBattito({ ok: true, riconciliati: 0, invii_in_attesa: 1 });
      await a.inv.sveglia();
      c("battito con invii_in_attesa > 0 → un prendi, poi si ferma (coda vuota)", [true, ["prendi"]], [si, a.tipi()]);
    }
    {
      //  il giro intero: prendi → un solo invio → esito col wa_id → di nuovo prendi → vuoto
      const a = amb({ copione: { prendi: [conInvio(U1, C1, "Ciao Anna, ti aspetto domani"), vuota] } });
      await a.inv.sveglia();
      c("giro: prendi, esito, prendi", ["prendi", "esito", "prendi"], a.tipi());
      c("giro: un solo invio, col numero e il testo del server", [{ numero: C1, testo: "Ciao Anna, ti aspetto domani" }], a.invii.map(({ numero, testo }) => ({ numero, testo })));
      const e = a.richieste.find((r) => r.tipo === "esito").corpo;
      c("giro: l'esito è inviato, con id, wa_id e ora vera (secondi)", { v: 1, tipo: "esito", id: U1, esito: "inviato", wa_id: "WA1", ts: Math.floor(a.invii[0].t / 1000) }, e);
      c("giro: la richiesta prendi ha la forma del contratto", { v: 1, tipo: "prendi" }, a.richieste[0].corpo);
      c("giro: a fine giro in-corso/ ed esiti/ sono vuote", [[], []], [readdirSync(join(a.cart, "in-corso")), readdirSync(join(a.cart, "esiti"))]);
      c("giro: cartelle 700, storico.json 600", [0o700, 0o700, 0o700, 0o600], [permessi(a.cart), permessi(join(a.cart, "in-corso")), permessi(join(a.cart, "esiti")), permessi(join(a.cart, "storico.json"))]);
      c("giro: contatori per il battito", { invii_attivi: 1, invii_ok: 1, invii_ko: 0 }, a.inv.contatori());
      c("giro: nel registro i codici dei passi", true, ["invio_preso", "invio_inviato"].every((k) => a.codici().includes(k)));
    }
    {
      //  prendi con invio:null e attendi_s: si aspetta quanto dice il server (mai meno di 3 s)
      const a = amb({ copione: { prendi: [http(200, { ok: true, invio: null, attendi_s: 30, limite: false }), http(200, { ok: true, invio: null, attendi_s: 1, limite: false }), vuota] } });
      await a.inv.sveglia();
      c("attendi_s:30 → richiede dopo 30 s; attendi_s:1 → non meno di 3 s; attendi_s:0 → si ferma", [[30_000, 3000], 3], [a.attese, a.richieste.length]);
      const b = amb({ copione: { prendi: [http(200, { ok: true, invio: null, attendi_s: 3600, limite: true }), vuota] } });
      await b.inv.sveglia();
      c("limite del server (tetto giornaliero) → si ferma, ci riprova al battito dopo", [1, true], [b.richieste.length, b.codici().includes("invio_limite")]);
    }
    {
      //  una sola sveglia alla volta (massimo un invio in volo)
      const a = amb({ copione: { prendi: [conInvio(U1, C1, "Uno"), vuota] } });
      const p1 = a.inv.sveglia();
      const p2 = a.inv.sveglia();
      await Promise.all([p1, p2]);
      c("due sveglie insieme → un solo ciclo (un invio, due prendi: quello dell'invio e quello vuoto)", [2, 1], [a.tipi().filter((t) => t === "prendi").length, a.invii.length]);
    }

    // ── 7. Esito perso: si ritenta l'esito, MAI l'invio ──────────────────
    {
      const a = amb({ copione: { prendi: [conInvio(U1, C1, "Ciao"), vuota], esito: [http(500, { ok: false }), RETE, http(401, { ok: false }), http(503, { ok: false }), http(200, { ok: true, stato: "inviato" })] } });
      await a.inv.sveglia();
      c("esito: 500, rete, 401, 503 → si ritenta con 5 s, 15 s, 60 s, 5 min", [5000, 15_000, 60_000, 300_000], a.attese);
      c("esito ritentato: l'invio non si ripete (una sola sendMessage)", [1, 5], [a.invii.length, a.tipi().filter((t) => t === "esito").length]);
      c("esito ritentato: stesso corpo ogni volta, poi il file si cancella", [1, []], [new Set(a.richieste.filter((r) => r.tipo === "esito").map((r) => JSON.stringify(r.corpo))).size, readdirSync(join(a.cart, "esiti"))]);
      c("esito ritentato: il registro lo dice con un codice", true, a.codici().includes("invio_esito_riprova"));
    }
    {
      const a = amb({ copione: { prendi: [conInvio(U1, C1, "Ciao"), vuota], esito: [http(500, { ok: false }), http(500, { ok: false }), http(500, { ok: false }), http(500, { ok: false }), http(500, { ok: false }), http(200, { ok: true })] } });
      await a.inv.sveglia();
      c("esito: dopo il quarto tentativo l'attesa resta di 5 minuti (tetto)", [5000, 15_000, 60_000, 300_000, 300_000], a.attese);
    }
    for (const stato of [404, 400, 409]) {
      const a = amb({ copione: { prendi: [conInvio(U1, C1, "Ciao"), vuota], esito: [http(stato, { ok: false, errore: "x" })] } });
      await a.inv.sveglia();
      c(`esito ${stato} (definitivo) → una sola richiesta, il file si cancella, niente ritentativi`, [1, [], 1], [a.tipi().filter((t) => t === "esito").length, readdirSync(join(a.cart, "esiti")), a.invii.length]);
    }

    // ── 8. I codici del prendi: nessun martellamento ─────────────────────
    const conGuasti = (stati, extra = {}) => amb({ copione: { prendi: [...stati, vuota] }, ...extra });
    {
      const a = conGuasti([http(429, {}), http(500, {}), http(502, {})]);
      await a.inv.sveglia();
      c("prendi 429, 500, 502 → attese dei lotti: 5 s, 15 s, 60 s", [5000, 15_000, 60_000], a.attese);
      c("prendi 5xx: nel registro il codice dell'occupato, non quello del «non pronto»", [true, false], [a.codici().includes("invio_server_occupato"), a.codici().includes("invio_server_non_pronto")]);
    }
    {
      const a = conGuasti([RETE, http(500, {}), http(500, {}), http(500, {}), http(500, {}), http(500, {})]);
      await a.inv.sveglia();
      c("prendi con la rete assente, poi 5xx: 5 s, 15 s, 60 s, 5 min, e resta a 5 min", [5000, 15_000, 60_000, 300_000, 300_000, 300_000], a.attese);
    }
    for (const stato of [400, 404, 503]) {
      const a = conGuasti([http(stato, { ok: false })]);
      await a.inv.sveglia();
      c(`prendi ${stato} → pausa di 5 minuti e un solo codice nel registro`, [[300_000], ["invio_server_non_pronto"]], [a.attese, a.codici().filter((k) => k.startsWith("invio_server") || k === "invio_non_autorizzato")]);
    }
    {
      const a = conGuasti([http(401, { ok: false, errore: "non_autorizzato" })]);
      await a.inv.sveglia();
      c("prendi 401 → pausa di 5 minuti, invio_server_non_pronto e invio_non_autorizzato", [[300_000], ["invio_server_non_pronto", "invio_non_autorizzato"]], [a.attese, a.codici().filter((k) => k.startsWith("invio_server") || k === "invio_non_autorizzato")]);
    }
    {
      //  qualunque sia la serie di risposte, mai due richieste a meno di 3 s
      const serie = [http(500, {}), http(400, {}), http(200, { ok: true, invio: null, attendi_s: 1, limite: false }), http(429, {}), http(200, { ok: true, invio: null, attendi_s: 1, limite: false }), RETE];
      const a = conGuasti(serie);
      await a.inv.sveglia();
      const t = a.richieste.map((r) => r.t);
      const minimo = Math.min(...t.slice(1).map((x, i) => x - t[i]));
      c("mai due prendi a meno di 3 s, comunque rispondano", [true, 7], [minimo >= 3000, a.richieste.length]);
      const b = amb({ copione: { prendi: [http(200, { ok: true, invio: null, attendi_s: 0 }), vuota] } });
      await b.inv.sveglia();
      const t0 = b.richieste.at(-1).t;
      b.inv.dopoBattito({ invii_in_attesa: 1 });
      await b.inv.sveglia();
      c("una sveglia subito dopo un'altra aspetta comunque i 3 s", true, b.richieste.at(-1).t - t0 >= 3000);
    }
    {
      const a = amb({ copione: { prendi: [http(200, "storta"), http(200, { ok: true, invio: 7, attendi_s: 0 }), vuota] } });
      await a.inv.sveglia();
      c("risposta 200 con corpo storto → si tratta come un guasto (5 s, 15 s), non come coda vuota", [5000, 15_000], a.attese);
    }

    // ── 9. L'invio vero: validazioni, punti di codice, limiti ────────────
    {
      const emoji = "😀".repeat(2000);
      const a = amb({ copione: { prendi: [conInvio(U1, C1, emoji), vuota] } });
      await a.inv.sveglia();
      c("2000 emoji (4000 unità UTF-16) → inviato, non rifiutato", [1, "inviato"], [a.invii.length, a.richieste.find((r) => r.tipo === "esito").corpo.esito]);
    }
    {
      const casi = [
        ["2001 punti di codice", conInvio(U1, C1, "😀".repeat(2001)), "testo_non_valido"],
        ["testo di soli spazi", conInvio(U1, C1, "   \n "), "testo_non_valido"],
        ["testo che non è una stringa", http(200, { ok: true, invio: { id: U1, numero: C1, testo: 5 }, attendi_s: 0, limite: false }), "testo_non_valido"],
        ["numero di 7 cifre", conInvio(U1, "1234567", "Ciao"), "numero_non_valido"],
        ["numero con @lid", conInvio(U1, `${C1}@lid`, "Ciao"), "numero_non_valido"],
        ["numero con ../", conInvio(U1, "../../x", "Ciao"), "numero_non_valido"],
      ];
      for (const [nome, risposta, motivo] of casi) {
        const a = amb({ copione: { prendi: [risposta, vuota] } });
        await a.inv.sveglia();
        const e = a.richieste.find((r) => r.tipo === "esito")?.corpo;
        c(`${nome} → errore ${motivo} senza inviare e senza consumare il conto`, [0, { v: 1, tipo: "esito", id: U1, esito: "errore", motivo }, 0], [a.invii.length, e, existsSync(join(a.cart, "storico.json")) ? JSON.parse(readFileSync(join(a.cart, "storico.json"), "utf8")).length : 0]);
      }
      const b = amb({ copione: { prendi: [conInvio("../../etc/passwd", C1, "Ciao"), conInvio(U2, C1, "Valido"), vuota] } });
      await b.inv.sveglia();
      c("un id che non è un uuid non diventa mai un nome di file né un esito: si ignora", [1, ["Valido"]], [b.tipi().filter((t) => t === "esito").length, b.invii.map((x) => x.testo)]);
      c("…e fuori dalla cartella degli invii non si è scritto niente", [], readdirSync(base).filter((n) => n === "passwd" || n === "etc"));
    }
    {
      //  l'invio risponde «non collegato» / «non so»: l'esito dice la verità, senza rimandare
      const b = amb({ copione: { prendi: [conInvio(U1, C1, "Ciao"), vuota] }, inviaTesto: async () => ({ ok: false, motivo: "non_collegato" }) });
      await b.inv.sveglia();
      c("inviaTesto risponde non_collegato → esito errore non_collegato", "non_collegato", b.richieste.find((r) => r.tipo === "esito").corpo.motivo);
      const cx = amb({ copione: { prendi: [conInvio(U1, C1, "Ciao"), vuota] }, inviaTesto: async () => ({ ok: false, motivo: "esito_incerto" }) });
      await cx.inv.sveglia();
      c("inviaTesto risponde esito_incerto → esito errore esito_incerto (non si rimanda)", ["esito_incerto", 1], [cx.richieste.find((r) => r.tipo === "esito").corpo.motivo, cx.tipi().filter((t) => t === "prendi").length - 1]);
      const ex = amb({ copione: { prendi: [conInvio(U1, C1, "Ciao"), vuota] }, inviaTesto: async () => { throw new Error("boom"); } });
      await ex.inv.sveglia();
      c("inviaTesto che lancia → esito errore esito_incerto, nessuna eccezione fuori", "esito_incerto", ex.richieste.find((r) => r.tipo === "esito").corpo.motivo);
    }
    {
      //  due prelievi ravvicinati: il secondo non parte prima dei 20 s (più il ritardo casuale)
      const a = amb({ casuale: () => 0.5, copione: { prendi: [conInvio(U1, C1, "Uno"), conInvio(U2, C2, "Due"), vuota] } });
      await a.inv.sveglia();
      const [p, s] = a.invii;
      c("due prelievi in fila: il secondo invio ≥ 20 s dopo il primo (e ≤ 25 s)", [true, true], [s.t - p.t >= 20_000, s.t - p.t <= 25_000]);
      c("…con il ritardo casuale: 20 s + 2,5 s (casuale 0,5)", 22_500, s.t - p.t);
      c("…e il prelievo non si chiede finché non si può partire (nessun prendi nei 22,5 s)", true, a.richieste.filter((r) => r.tipo === "prendi").every((r, i, l) => i === 0 || r.t - l[i - 1].t >= 3000));
      const stor = JSON.parse(readFileSync(join(a.cart, "storico.json"), "utf8"));
      c("storico.json: gli orari di tutti e due i tentativi", [p.t, s.t], stor);
    }
    {
      //  un riprova (stessa riga, nuovo prelievo) conta come un invio nel conto locale
      const a = amb({ casuale: () => 0, copione: { prendi: [conInvio(U1, C1, "Ciao"), conInvio(U1, C1, "Ciao"), vuota] } });
      await a.inv.sveglia();
      c("riprova: lo stesso id preso due volte → due invii veri", [2, 2], [a.invii.length, a.tipi().filter((t) => t === "esito").length]);
      c("riprova: nel conto locale i tentativi sono due e il secondo rispetta i 20 s", [2, true], [JSON.parse(readFileSync(join(a.cart, "storico.json"), "utf8")).length, a.invii[1].t - a.invii[0].t >= 20_000]);
      const sicuro = amb({ cartella: a.cart, orologio: a.orologio });
      c("riprova: il conto sopravvive a un riavvio (un'altra istanza sulla stessa cartella)", 2, sicuro.inv.presi().length);
    }
    {
      //  20 nelle ultime 24 ore: il 21° non si chiede nemmeno
      const cart = mkdtempSync(join(base, "tetto-"));
      const orologio = orologioFinto();
      const prima = Array.from({ length: 19 }, (_, i) => T0 - (2 * 3600 + i * 60) * SEC);
      writeFileSync(join(cart, "storico.json"), JSON.stringify(prima));
      const a = amb({ cartella: cart, orologio, copione: { prendi: [conInvio(U1, C1, "Il ventesimo"), conInvio(U2, C1, "Il ventunesimo"), vuota] } });
      await a.inv.sveglia();
      c("19 già fatti: il 20° parte, il 21° non viene nemmeno chiesto", [["Il ventesimo"], ["prendi", "esito"], true], [a.invii.map((x) => x.testo), a.tipi(), a.codici().includes("invio_limite")]);
      const cart2 = mkdtempSync(join(base, "tetto2-"));
      writeFileSync(join(cart2, "storico.json"), JSON.stringify(Array.from({ length: 20 }, (_, i) => T0 - (3600 + i) * SEC)));
      const b = amb({ cartella: cart2, copione: { prendi: [conInvio(U3, C1, "No, non ancora"), vuota] } });
      await b.inv.sveglia();
      c("20 già fatti nelle ultime 24 ore → nessuna richiesta", [0, 0], [b.richieste.length, b.invii.length]);
      b.orologio.vai(24 * ORA);
      b.inv.dopoBattito({ invii_in_attesa: 1 });
      await b.inv.sveglia();
      c("…passate le 24 ore dal più vecchio, il battito dopo lo fa ripartire", 1, b.invii.length);
    }
    {
      const cart = mkdtempSync(join(base, "storico-"));
      writeFileSync(join(cart, "storico.json"), "non è json");
      const a = amb({ cartella: cart });
      c("storico.json rotto → si riparte vuoto (non si ferma il ponte)", 0, a.inv.presi().length);
      writeFileSync(join(cart, "storico.json"), JSON.stringify([T0 - 5 * SEC, "x", null, T0 - 30 * ORA]));
      const b = amb({ cartella: cart });
      c("storico.json con voci strane → restano solo gli orari validi delle ultime 24 ore", [T0 - 5 * SEC], b.inv.presi());
    }

    // ── 10. Riavvio a metà: mai rimandare ────────────────────────────────
    {
      const cart = mkdtempSync(join(base, "riavvio-"));
      mkdirSync(join(cart, "in-corso"), { recursive: true });
      mkdirSync(join(cart, "esiti"), { recursive: true });
      writeFileSync(join(cart, "in-corso", `${U2}.json`), JSON.stringify({ id: U2, preso_il: T0 - 60_000 }));
      writeFileSync(join(cart, "esiti", `${U3}.json`), JSON.stringify({ id: U3, esito: "inviato", wa_id: "WA9", ts: 1792000000 }));
      writeFileSync(join(cart, "esiti", `${UB}.json`), "non è json");
      writeFileSync(join(cart, "in-corso", "x.json"), "{}");
      const a = amb({ cartella: cart, collegato: false, copione: { prendi: [conInvio(U1, C1, "Non deve partire")] } });
      await a.inv.avvia();
      const esiti = a.richieste.filter((r) => r.tipo === "esito").map((r) => r.corpo);
      c("riavvio: un in-corso senza esito → esito errore esito_incerto", { v: 1, tipo: "esito", id: U2, esito: "errore", motivo: "esito_incerto" }, esiti.find((e) => e.id === U2));
      c("riavvio: un esito rimasto su disco si rispedisce com'era", { v: 1, tipo: "esito", id: U3, esito: "inviato", wa_id: "WA9", ts: 1792000000 }, esiti.find((e) => e.id === U3));
      c("riavvio: ZERO invii (sendMessage mai richiamata), anche con un prendi pronto", [0, false], [a.invii.length, a.tipi().includes("prendi")]);
      c("riavvio: file illeggibili o con nome strano si tolgono, le cartelle restano vuote", [[], []], [readdirSync(join(cart, "in-corso")).filter((f) => f !== "x.json"), readdirSync(join(cart, "esiti"))]);
    }
    {
      //  in-corso e esito dello stesso invio (caduto fra le due scritture): vale l'esito
      const cart = mkdtempSync(join(base, "riavvio2-"));
      mkdirSync(join(cart, "in-corso"), { recursive: true });
      mkdirSync(join(cart, "esiti"), { recursive: true });
      writeFileSync(join(cart, "in-corso", `${U1}.json`), JSON.stringify({ id: U1, preso_il: T0 }));
      writeFileSync(join(cart, "esiti", `${U1}.json`), JSON.stringify({ id: U1, esito: "inviato", wa_id: "WA1", ts: 1792000000 }));
      const a = amb({ cartella: cart, collegato: false });
      await a.inv.avvia();
      c("riavvio: in-corso e esito dello stesso invio → si riporta l'esito vero (inviato)", [1, "inviato"], [a.tipi().length, a.richieste[0].corpo.esito]);
    }
    {
      //  durante l'invio, sul disco ci sono SOLO id e orari (mai testo né numero)
      let visto = null;
      const cart = mkdtempSync(join(base, "disco-"));
      const a = amb({
        cartella: cart,
        copione: { prendi: [conInvio(U1, C1, "Testo riservato del cliente"), vuota] },
        inviaTesto: async () => {
          visto = ["in-corso", "esiti"].flatMap((d) => readdirSync(join(cart, d)).map((f) => readFileSync(join(cart, d, f), "utf8"))).join("\n") + readFileSync(join(cart, "storico.json"), "utf8");
          return { ok: true, id: "WA1", ts: 1792000000 };
        },
      });
      await a.inv.sveglia();
      c("sul disco, durante l'invio: l'in-corso c'è, e non ha testo né numero", [true, false, false], [visto.includes(U1), visto.includes("riservato"), visto.includes(C1)]);
    }

    // ── 11. Registro e fermata ───────────────────────────────────────────
    {
      const a = amb({ copione: { prendi: [conInvio(U1, C1, "Segreto del cliente 12345"), http(500, {}), conInvio(U2, C2, "Altro testo"), vuota], esito: [http(500, {}), http(200, { ok: true })] } });
      await a.inv.sveglia();
      const righe = a.registrate;
      c("registro: solo codici [a-z_] con contatori numerici", true, righe.length > 0 && righe.every((r) => /^[a-z_]+$/.test(r.codice) && Object.entries(r.conteggi ?? {}).every(([k, v]) => /^[a-z_]+$/.test(k) && Number.isFinite(v))));
      const tutto = JSON.stringify(righe);
      c("registro: nessun testo, numero o id del messaggio", [], [C1, C2, "Segreto", "Altro testo", U1, U2, "WA1"].filter((x) => tutto.includes(x)));
    }
    {
      const a = amb({ copione: { prendi: [http(500, {})] } });
      const p = a.inv.sveglia();
      await new Promise((ok) => setImmediate(ok));
      const f = a.inv.ferma();
      await Promise.all([p, f]);
      const n = a.richieste.length;
      await a.inv.sveglia();
      c("ferma(): il ciclo esce e non richiede più niente", [true, n], [a.richieste.length >= 1, a.richieste.length]);
    }

    // ── 12. Il battito dichiara gli invii ────────────────────────────────
    {
      const ist = { stato: "collegato", collegato_dal: null, ultimo_messaggio_il: null, storico: { fatto: true, avanzamento: 100 }, estrazione: {}, diagnosi: {} };
      const filaC = { in_coda: 0, lotti_storico: 0, lotti_vivo: 0, scartati: 0, non_noti_scaduti: 0, divisi: 0, piena: false };
      const b = I.corpoBattito(ist, filaC, { invii: { invii_attivi: 1, invii_ok: 3, invii_ko: 1 } });
      c("battito: invii_attivi, invii_ok, invii_ko nei contatori", { invii_attivi: 1, invii_ok: 3, invii_ko: 1 }, { invii_attivi: b.contatori.invii_attivi, invii_ok: b.contatori.invii_ok, invii_ko: b.contatori.invii_ko });
      const senza = I.corpoBattito(ist, filaC, {});
      c("battito senza invii: i tre contatori ci sono, a zero (ponte vecchio = spento)", [0, 0, 0], [senza.contatori.invii_attivi, senza.contatori.invii_ok, senza.contatori.invii_ko]);
      c("battito: al più 18 contatori (il CRM ne tiene 20 con in_coda e scartati)", true, Object.keys(b.contatori).length <= 18 && Object.keys(b.contatori).length + 2 <= 20);
      c("battito: tutti i contatori sono numeri con chiave [a-z_]", true, Object.entries(b.contatori).every(([k, v]) => /^[a-z_]+$/.test(k) && Number.isFinite(v)));
    }

    // ── 13. Un solo posto per scrivere ai clienti ────────────────────────
    {
      const sorgente = readFileSync(join(radice, "strumenti/ponte-whatsapp/src/invio.mjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      c("invio.mjs non tocca WhatsApp: niente sendMessage, niente socket, niente Baileys", [], ["sendMessage", "sock.", "baileys", "makeWASocket", "console", "homedir"].filter((x) => sorgente.includes(x)));
      c("invio.mjs usa la stessa spedizione dei lotti (stesso token e redirect vietati)", true, sorgente.includes("spedisci") && typeof L.spedisci === "function");
      void existsSync;
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
