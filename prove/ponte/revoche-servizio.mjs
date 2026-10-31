/** ── PROVE: LE REVOCHE DEL PONTE · IL SERVIZIO SUL MAC (commessa 2026-10-31, ponte-revoche) ──
 *
 *  Il titolare: «se elimino un messaggio da WhatsApp nativo, deve sparire anche dalla chat del
 *  CRM; solo quelli che elimino io, non quelli dei clienti». Qui si prova la parte sul Mac:
 *   1. `estrai.mjs` (`revocaDa`, `revocaDaAggiornamento`): una cancellazione per tutti si
 *      trasforma in una chiave `bw:<cifre>:<id>` SOLO se l'ha fatta il nostro numero
 *      (`key.fromMe === true` del messaggio che porta la cancellazione); quella di un cliente
 *      si ignora. Le due forme di Baileys: `messages.upsert` con `protocolMessage` REVOKE
 *      (l'id revocato sta in `protocolMessage.key.id`) e `messages.update` con
 *      `messageStubType` REVOKE (1) e l'id nella `key`;
 *   2. `revoche.mjs` (la coda in memoria che avvisa il CRM, con i ritentativi);
 *   3. `collega.mjs` e `index.mjs` (il collegamento) e le guardie: sul socket non entra niente di nuovo.
 *  Dati inventati: nessun numero né nome vero (prefisso 39 333 000…).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const NOI = "393330009999";
const CLIENTE = "393330000001";
const JID = `${CLIENTE}@s.whatsapp.net`;
const ADESSO = Date.UTC(2026, 10, 1, 9, 0, 0) / 1000;
const TS = ADESSO - 3600;
const PONTE = "https://ponte.prova.test/api/public/ponte-whatsapp";
const TOKEN = "t".repeat(40);
const CHIAVE = `bw:${CLIENTE}:3EB0AA01`;
const MIN = 60_000;
const ORA = 3_600_000;

/** La cancellazione per tutti come arriva in `messages.upsert`: il messaggio-contenitore ha la SUA
 *  `key` (`fromMe` = chi cancella, la chat), il messaggio cancellato sta in `protocolMessage.key`. */
function revoca(idRevocato, key = {}, protocollo = {}) {
  return {
    key: { remoteJid: JID, fromMe: true, id: "3EB0REV001", ...key },
    messageTimestamp: TS,
    message: { protocolMessage: { type: 0, key: { remoteJid: JID, fromMe: true, id: idRevocato }, ...protocollo } },
  };
}

/** La stessa cancellazione come la rilancia Baileys in `messages.update` (process-message.js, REVOKE):
 *  `key` = la `key` del contenitore con l'id del messaggio cancellato. */
function aggiornamento(idRevocato, key = {}, update = {}) {
  const k = { remoteJid: JID, fromMe: true, id: idRevocato, ...key };
  return { key: k, update: { message: null, messageStubType: 1, key: { ...k, id: "3EB0REV001" }, ...update } };
}

export async function provePonteRevocheServizio(mod, { c, gruppo, radice }) {
  const E = await import(pathToFileURL(join(radice, "strumenti/ponte-whatsapp/src/estrai.mjs")).href);
  const T = mod["ponte/tipi"];
  const opz = { proprioNumero: NOI, risolviLid: () => null };
  const dal = (m, o = {}) => E.revocaDa(m, { ...opz, ...o });
  const dalUpdate = (m, o = {}) => E.revocaDaAggiornamento(m, { ...opz, ...o });
  const BUONA = { ok: true, chiave: T.chiaveMessaggio(CLIENTE, "3EB0AA01") };

  // ── 1. L'estrazione ────────────────────────────────────────────────────
  gruppo("PONTE WHATSAPP · REVOCHE · ESTRAZIONE (messages.upsert e messages.update)");
  c("upsert: cancellazione per tutti di un NOSTRO messaggio → la chiave bw:<cifre>:<id>", BUONA, dal(revoca("3EB0AA01")));
  c("…la chiave è quella del contratto (tipi.ts), con l'id del messaggio CANCELLATO e non quello del contenitore", "bw:393330000001:3EB0AA01", dal(revoca("3EB0AA01")).chiave);
  c("upsert: il tipo col nome dell'enum (REVOKE) vale come 0", BUONA, dal(revoca("3EB0AA01", {}, { type: "REVOKE" })));
  c("upsert: dentro un involucro effimero si legge lo stesso", BUONA, dal({ ...revoca("3EB0AA01"), message: { ephemeralMessage: { message: revoca("3EB0AA01").message } } }));
  c("upsert: ts e pushName del contenitore non contano (nessuna chiave in più nell'esito)", ["chiave", "ok"], Object.keys(dal({ ...revoca("3EB0AA01"), pushName: "Qualcuno" })).sort());

  //  Solo quelli che cancelliamo noi.
  c("upsert: la cancellazione di un CLIENTE (fromMe falso) si ignora", { ok: false, motivo: "revoca_del_cliente" }, dal(revoca("3EB0AA01", { fromMe: false })));
  c("upsert: fromMe assente → del cliente, nel dubbio non si nasconde niente", { ok: false, motivo: "revoca_del_cliente" }, dal(revoca("3EB0AA01", { fromMe: undefined })));
  c("upsert: fromMe come testo «true» o numero 1 non vale (solo il booleano vero)", [{ ok: false, motivo: "revoca_del_cliente" }, { ok: false, motivo: "revoca_del_cliente" }], [dal(revoca("3EB0AA01", { fromMe: "true" })), dal(revoca("3EB0AA01", { fromMe: 1 }))]);
  c("upsert: decide la key del CONTENITORE: quella dentro il protocolMessage ha il punto di vista dell'altro lato e non conta", [BUONA, { ok: false, motivo: "revoca_del_cliente" }], [dal(revoca("3EB0AA01", {}, { key: { id: "3EB0AA01", fromMe: false } })), dal(revoca("3EB0AA01", { fromMe: false }, { key: { id: "3EB0AA01", fromMe: true } }))]);

  //  Quello che non è una cancellazione.
  const NON = { ok: false, motivo: "non_revoca" };
  c("upsert: una modifica (type 14), un messaggio effimero (3), un testo, una foto → non è una cancellazione", [NON, NON, NON, NON], [dal(revoca("X", {}, { type: 14 })), dal(revoca("X", {}, { type: 3 })), dal({ key: { remoteJid: JID, fromMe: true, id: "A1" }, message: { conversation: "ciao" } }), dal({ key: { remoteJid: JID, fromMe: true, id: "A2" }, message: { imageMessage: {} } })]);
  c("upsert: oggetti storti non lanciano mai", [NON, NON, NON, NON, NON], [dal(null), dal(undefined), dal("x"), dal({}), dal({ key: {}, message: null })]);
  c("upsert: type assente o strano non è una cancellazione quando il resto non torna", NON, dal(revoca("X", {}, { type: "ALTRO" })));

  //  L'id e la chat.
  const ID = { ok: false, motivo: "id_non_valido" };
  c("upsert: id mancante, vuoto, con simboli o troppo lungo → id_non_valido", [ID, ID, ID, ID, ID], [
    dal({ ...revoca("X"), message: { protocolMessage: { type: 0, key: {} } } }),
    dal({ ...revoca("X"), message: { protocolMessage: { type: 0 } } }),
    dal(revoca("")),
    dal(revoca("3EB0:AA/01")),
    dal(revoca("A".repeat(129))),
  ]);
  c("upsert: l'id al limite (128 caratteri) passa", true, dal(revoca("A".repeat(128))).ok);
  c("upsert: gruppo, stato, lista broadcast, canale → scartati col motivo della chat", ["gruppo", "stato_whatsapp", "broadcast", "canale"], [
    dal(revoca("A1", { remoteJid: "120363000000000001@g.us" })).motivo,
    dal(revoca("A1", { remoteJid: "status@broadcast" })).motivo,
    dal(revoca("A1", { remoteJid: "12345@broadcast" })).motivo,
    dal(revoca("A1", { remoteJid: "120363@newsletter" })).motivo,
  ]);
  c("upsert: la chat con sé stessi → se_stesso", { ok: false, motivo: "se_stesso" }, dal(revoca("A1", { remoteJid: `${NOI}@s.whatsapp.net` })));
  c("upsert: il JID col dispositivo (…:12@s.whatsapp.net) dà le stesse cifre", BUONA, dal(revoca("3EB0AA01", { remoteJid: `${CLIENTE}:12@s.whatsapp.net` })));
  // LID: stessa regola dei messaggi normali (remoteJidAlt, poi risolviLid), mai un numero inventato.
  c("upsert: un @lid si risolve con remoteJidAlt", BUONA, dal(revoca("3EB0AA01", { remoteJid: "555@lid", remoteJidAlt: JID })));
  c("upsert: un @lid si risolve con la mappa (risolviLid)", BUONA, dal(revoca("3EB0AA01", { remoteJid: "555@lid" }), { risolviLid: (j) => (j === "555@lid" ? CLIENTE : null) }));
  c("upsert: un @lid che non si risolve → senza_numero (mai un numero inventato)", { ok: false, motivo: "senza_numero" }, dal(revoca("3EB0AA01", { remoteJid: "555@lid" })));

  //  messages.update.
  c("update: messageStubType REVOKE (1) con l'id nella key → la stessa chiave", BUONA, dalUpdate(aggiornamento("3EB0AA01")));
  c("update: messageStubType col nome (REVOKE) vale come 1", BUONA, dalUpdate(aggiornamento("3EB0AA01", {}, { messageStubType: "REVOKE" })));
  c("update: la chiave dei due percorsi è identica (la coda non la manda due volte)", dal(revoca("3EB0AA01")).chiave, dalUpdate(aggiornamento("3EB0AA01")).chiave);
  c("update: di un CLIENTE (fromMe falso o assente) si ignora", [{ ok: false, motivo: "revoca_del_cliente" }, { ok: false, motivo: "revoca_del_cliente" }], [dalUpdate(aggiornamento("3EB0AA01", { fromMe: false })), dalUpdate(aggiornamento("3EB0AA01", { fromMe: undefined }))]);
  c("update: un aggiornamento di stato (letto, consegnato) o altri stub non è una cancellazione", [NON, NON, NON, NON], [
    dalUpdate({ key: { remoteJid: JID, fromMe: true, id: "A1" }, update: { status: 4 } }),
    dalUpdate({ key: { remoteJid: JID, fromMe: true, id: "A1" }, update: { messageStubType: 2 } }),
    dalUpdate({ key: { remoteJid: JID, fromMe: true, id: "A1" }, update: { messageStubType: 0 } }),
    dalUpdate({ key: { remoteJid: JID, fromMe: true, id: "A1" }, update: {} }),
  ]);
  c("update: oggetti storti non lanciano mai", [NON, NON, NON, NON], [dalUpdate(null), dalUpdate(undefined), dalUpdate({}), dalUpdate({ key: null, update: null })]);
  c("update: id non valido, gruppo, sé stessi, @lid non risolto", ["id_non_valido", "gruppo", "se_stesso", "senza_numero"], [
    dalUpdate(aggiornamento("A:1")).motivo,
    dalUpdate(aggiornamento("A1", { remoteJid: "120363000000000001@g.us" })).motivo,
    dalUpdate(aggiornamento("A1", { remoteJid: `${NOI}@s.whatsapp.net` })).motivo,
    dalUpdate(aggiornamento("A1", { remoteJid: "555@lid" })).motivo,
  ]);
  c("update: @lid risolto con remoteJidAlt", BUONA, dalUpdate(aggiornamento("3EB0AA01", { remoteJid: "555@lid", remoteJidAlt: JID })));

  //  L'estrazione dei messaggi di sempre non cambia: la cancellazione resta uno scarto, mai un messaggio.
  const Lm = E.leggiMessaggio(revoca("3EB0AA01"), { ...opz, adesso: ADESSO });
  c("leggiMessaggio: la cancellazione resta uno scarto «cancellazione» (nessuna riga di testo)", { ok: false, scarto: true, motivo: "cancellazione" }, Lm);

  // ── 2. La coda che avvisa il CRM (revoche.mjs) ─────────────────────────
  gruppo("PONTE WHATSAPP · REVOCHE · LA CODA SUL MAC (ritentativi, un passo alla volta)");
  const R = await import(pathToFileURL(join(radice, "strumenti/ponte-whatsapp/src/revoche.mjs")).href);

  /** Una coda con orologio, timer e rete finti. `risposte`: funzione (richiesta, n) → { stato, corpo } o lancia. */
  function monta(risposte = () => ({ stato: 200, corpo: { ok: true, trovate: 1, marcate: 1 } }), extra = {}) {
    let adesso = 1_000_000;
    const timer = [];
    const richieste = [];
    const log = [];
    const violazioni = [];
    const registro = (codice, conteggi = {}) => {
      if (!/^[a-z_]+$/.test(String(codice)) || Object.entries(conteggi).some(([k, v]) => !/^[a-z_]+$/.test(k) || typeof v !== "number")) violazioni.push(String(codice));
      log.push([codice, conteggi]);
    };
    const spedisci = async (r) => {
      richieste.push({ ...r, quando: adesso });
      return risposte(r, richieste.length);
    };
    const q = R.creaRevoche({ url: PONTE, token: TOKEN, registro, spedisci, orologio: () => adesso, pianifica: (f, ms) => { const t = { f, a: adesso + ms, vivo: true }; timer.push(t); return t; }, annulla: (t) => { if (t) t.vivo = false; }, ...extra });
    /** fa passare `ms` e lancia i timer scaduti, uno alla volta, aspettando ciascuno */
    const avanza = async (ms = 0) => {
      adesso += ms;
      for (let giri = 0; giri < 50; giri++) {
        const t = timer.filter((x) => x.vivo && x.a <= adesso).sort((x, y) => x.a - y.a)[0];
        if (!t) return;
        t.vivo = false;
        await t.f();
      }
    };
    return { q, richieste, log, violazioni, avanza, timer, ora: () => adesso };
  }

  {
    const m = monta();
    c("accoda: una chiave valida entra e NON parte da sola prima del timer", [{ ok: true }, 0], [m.q.accoda(CHIAVE), m.richieste.length]);
    await m.avanza(0);
    c("…alla prima sveglia parte UNA richiesta con url e token, corpo {v:1, tipo:'revoca', chiave}", [1, PONTE, TOKEN, { v: 1, tipo: "revoca", chiave: CHIAVE }], [m.richieste.length, m.richieste[0]?.url, m.richieste[0]?.token, m.richieste[0]?.corpo]);
    c("…il corpo ha solo v, tipo, chiave", ["chiave", "tipo", "v"], Object.keys(m.richieste[0]?.corpo ?? {}).sort());
  }
  {
    const m = monta();
    for (const k of [null, undefined, 5, "", "393330000001:3EB0", "bw:123:ABC", "bw:393330000001:", "bw:39333000000a:X1", "bw:393330000001:X:Y", `bw:${CLIENTE}:${"A".repeat(129)}`, "bw:393330000001:X Y", "BW:393330000001:X1"])
      m.q.accoda(k);
    await m.avanza(10 * ORA);
    c("accoda: chiavi storte (non bw:<8-15 cifre>:<id>) → rifiutate e mai spedite", [0, 0], [m.richieste.length, m.q.contatori().in_coda]);
    c("…il motivo è chiave_non_valida", { ok: false, motivo: "chiave_non_valida" }, m.q.accoda("storta"));
  }
  {
    //  I quattro passaggi: subito, +5 minuti, +30 minuti, +2 ore (il messaggio originale può essere ancora in fila sul Mac, o il pari di ManyChat arrivare dopo).
    const m = monta();
    m.q.accoda(CHIAVE);
    await m.avanza(0);
    const dopo = [];
    for (const attesa of [5 * MIN, 30 * MIN, 2 * ORA]) {
      await m.avanza(attesa - 1);
      dopo.push(m.richieste.length);
      await m.avanza(1);
      dopo.push(m.richieste.length);
    }
    c("passaggi: la 2ª richiesta dopo 5 minuti, la 3ª dopo altri 30, la 4ª dopo altre 2 ore (mai prima)", [1, 2, 2, 3, 3, 4], dopo);
    await m.avanza(24 * ORA);
    const k = m.q.contatori();
    c("…dopo il quarto passaggio la voce esce: 4 richieste in tutto, coda vuota, 1 fatta", [4, 0, 1, 0], [m.richieste.length, k.in_coda, k.fatte, k.senza_riga]);
    c("…ogni passaggio porta la stessa chiave", [CHIAVE], [...new Set(m.richieste.map((r) => r.corpo.chiave))]);
    c("…nessun timer resta acceso a coda vuota", 0, m.timer.filter((t) => t.vivo).length);
  }
  {
    const m = monta(() => ({ stato: 200, corpo: { ok: true, trovate: 0, marcate: 0 } }));
    m.q.accoda(CHIAVE);
    for (const s of [0, 5 * MIN, 30 * MIN, 2 * ORA]) await m.avanza(s);
    c("riga mai trovata in nessun passaggio → senza_riga (e non fatta)", [0, 1, 4], [m.q.contatori().fatte, m.q.contatori().senza_riga, m.richieste.length]);
  }
  {
    //  La riga compare al secondo passaggio (il messaggio arriva sul CRM dopo la prima richiesta).
    const m = monta((r, n) => ({ stato: 200, corpo: { ok: true, trovate: n >= 2 ? 1 : 0, marcate: n === 2 ? 1 : 0 } }));
    m.q.accoda(CHIAVE);
    for (const s of [0, 5 * MIN, 30 * MIN, 2 * ORA]) await m.avanza(s);
    c("riga trovata solo da un passaggio in poi → fatta, non senza_riga", [1, 0], [m.q.contatori().fatte, m.q.contatori().senza_riga]);
  }
  {
    const m = monta();
    c("accoda due volte la stessa chiave → una sola voce (la seconda non riparte da capo)", [true, true, 1], [m.q.accoda(CHIAVE).ok, m.q.accoda(CHIAVE).ok, m.q.contatori().in_coda]);
    await m.avanza(0);
    await m.avanza(MIN);
    m.q.accoda(CHIAVE);
    await m.avanza(5 * MIN);
    c("…e dopo il primo passaggio un nuovo accoda non ne fa un altro subito", 2, m.richieste.length);
  }
  {
    //  Errori del CRM.
    const m400 = monta(() => ({ stato: 400, corpo: { ok: false, errore: "corpo_non_valido" } }));
    m400.q.accoda(CHIAVE);
    await m400.avanza(0);
    await m400.avanza(24 * ORA);
    c("400 (il CRM la rifiuta) → scartata, mai ritentata", [1, 0, 1], [m400.richieste.length, m400.q.contatori().in_coda, m400.q.contatori().scartate]);

    const guasti = [null, 500, 503, 401, 429, 502];
    for (const stato of guasti) {
      let n = 0;
      const m = monta(() => (++n <= 2 ? { stato, corpo: null } : { stato: 200, corpo: { ok: true, trovate: 1, marcate: 1 } }));
      m.q.accoda(CHIAVE);
      await m.avanza(0);
      const dopoPrima = m.richieste.length;
      await m.avanza(29_999);
      const prima30 = m.richieste.length;
      await m.avanza(1);
      const dopo30 = m.richieste.length;
      c(`guasto (${stato ?? "rete"}): il ritentativo non è subito, ma dopo 30 s; il passaggio NON avanza`, [1, 1, 2], [dopoPrima, prima30, dopo30]);
    }
    //  L'attesa cresce (30 s, 2 min, 10 min, 30 min) e poi resta a 30 min; il 200 azzera i tentativi e il passaggio avanza.
    let n = 0;
    const m = monta(() => (++n <= 5 ? { stato: 500, corpo: null } : { stato: 200, corpo: { ok: true, trovate: 1, marcate: 1 } }));
    m.q.accoda(CHIAVE);
    const istanti = [];
    await m.avanza(0);
    for (let i = 0; i < 5; i++) {
      const prima = m.ora();
      for (let t = 0; t < 100 && m.richieste.length === i + 1; t++) await m.avanza(30_000);
      istanti.push(Math.round((m.ora() - prima) / MIN * 2) / 2);
    }
    c("guasti ripetuti: l'attesa cresce 0,5 → 2 → 10 → 30 minuti e poi resta a 30", [0.5, 2, 10, 30, 30], istanti);
    c("…tutte le richieste fallite portano ancora il PRIMO passaggio (stessa chiave, nessun contatore avanzato)", 6, m.richieste.length);
    //  una eccezione di spedisci vale come rete
    const e = monta(async () => { throw new Error("rete a pezzi"); });
    e.q.accoda(CHIAVE);
    await e.avanza(0);
    c("spedisci che lancia → come la rete, la voce resta e non si perde il timer", [1, 1], [e.q.contatori().in_coda, e.timer.filter((t) => t.vivo).length]);
  }
  {
    //  Dopo 24 ore di guasti la voce scade.
    const m = monta(() => ({ stato: 500, corpo: null }));
    m.q.accoda(CHIAVE);
    for (let i = 0; i < 80; i++) await m.avanza(30 * MIN);
    c("24 ore di guasti → la voce scade (non resta per sempre)", [0, 1], [m.q.contatori().in_coda, m.q.contatori().scadute]);
  }
  {
    //  Una richiesta alla volta e tetto della coda.
    const sbloccare = [];
    const m = monta(() => new Promise((ok) => sbloccare.push(() => ok({ stato: 200, corpo: { ok: true, trovate: 1, marcate: 1 } }))));
    m.q.accoda(CHIAVE);
    m.q.accoda(`bw:${CLIENTE}:3EB0AA02`);
    const giro = m.avanza(0);
    await new Promise((ok) => setImmediate(ok));
    c("una richiesta alla volta: la seconda aspetta la risposta della prima", 1, m.richieste.length);
    sbloccare.shift()();
    await new Promise((ok) => setImmediate(ok));
    c("…poi parte la seconda", [2, "3EB0AA02"], [m.richieste.length, m.richieste[1]?.corpo.chiave.split(":")[2]]);
    while (sbloccare.length) {
      sbloccare.shift()();
      await new Promise((ok) => setImmediate(ok));
    }
    await giro;
  }
  {
    const m = monta();
    const esiti = [];
    for (let i = 0; i < 205; i++) esiti.push(m.q.accoda(`bw:${CLIENTE}:ID${i}`).ok);
    c("coda piena: 200 voci entrano, le altre no (e si contano)", [200, 5, 200, 5], [esiti.filter(Boolean).length, esiti.filter((x) => !x).length, m.q.contatori().in_coda, m.q.contatori().coda_piena]);
    c("…il motivo è coda_piena", { ok: false, motivo: "coda_piena" }, m.q.accoda(`bw:${CLIENTE}:ALTRO`));
  }
  {
    //  Ferma.
    const m = monta();
    m.q.accoda(CHIAVE);
    await m.q.ferma();
    await m.avanza(24 * ORA);
    c("ferma(): non parte più niente, nessun timer, e accoda risponde fermo", [0, 0, { ok: false, motivo: "fermo" }], [m.richieste.length, m.timer.filter((t) => t.vivo).length, m.q.accoda(`bw:${CLIENTE}:3EB0AA09`)]);
    const lenta = monta(() => new Promise((ok) => setTimeout(() => ok({ stato: 200, corpo: { ok: true, trovate: 1, marcate: 1 } }), 20)));
    lenta.q.accoda(CHIAVE);
    const giro = lenta.avanza(0);
    await new Promise((ok) => setImmediate(ok));
    await lenta.q.ferma();
    c("ferma() aspetta la richiesta in volo", 1, lenta.richieste.length);
    await giro;
  }
  {
    //  La risposta del CRM è letta con prudenza.
    const m = monta(() => ({ stato: 200, corpo: { ok: true, trovate: "molte", marcate: -3 } }));
    m.q.accoda(CHIAVE);
    await m.avanza(0);
    const r = m.log.find(([x]) => x === "revoca_inviata");
    c("200 con numeri storti → i conteggi nel log valgono 0, mai testo", [true, 0, 0], [!!r, r?.[1].trovate, r?.[1].marcate]);
    const vuoto = monta(() => ({ stato: 200, corpo: null }));
    vuoto.q.accoda(CHIAVE);
    await vuoto.avanza(0);
    c("200 senza corpo leggibile → conta come passaggio fatto con 0 righe", 1, vuoto.q.contatori().in_coda);
  }
  {
    //  Il registro: solo codici e numeri, mai la chiave né il numero del cliente.
    const m = monta();
    m.q.accoda(CHIAVE);
    m.q.accoda("storta");
    for (const s of [0, 5 * MIN, 30 * MIN, 2 * ORA]) await m.avanza(s);
    const testo = JSON.stringify(m.log);
    c("registro: solo codici fissi e numeri (nessuna violazione)", [], m.violazioni);
    c("registro: né la chiave, né le cifre del cliente, né l'id WhatsApp, né il token", [false, false, false, false], [testo.includes("bw:"), testo.includes(CLIENTE), testo.includes("3EB0AA01"), testo.includes(TOKEN)]);
    c("registro: i codici sono revoca_inviata (con http, trovate, marcate, passo) e basta", true, m.log.length > 0 && m.log.every(([x]) => ["revoca_inviata", "revoca_non_arrivata", "revoca_rifiutata", "revoca_scaduta", "revoca_senza_riga"].includes(x)));
  }
  {
    //  Il file non scrive su disco, non apre la rete da solo, non stampa.
    const sorgente = readFileSync(join(radice, "strumenti/ponte-whatsapp/src/revoche.mjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    c("revoche.mjs: niente disco, niente console, niente fetch (la rete arriva solo da lotti.mjs/spedisci), niente socket", [false, false, false, false], [/node:fs|writeFile|appendFile/.test(sorgente), /console\./.test(sorgente), /\bfetch\s*\(/.test(sorgente), /\bsock\b|\.ev\.|sendMessage/.test(sorgente)]);
    c("revoche.mjs: usa `spedisci` di lotti.mjs di serie", true, /import \{ spedisci as spedisciVero \} from "\.\/lotti\.mjs"/.test(sorgente));
  }

  // ── 3. Il collegamento: dove la revoca entra in coda ───────────────────
  gruppo("PONTE WHATSAPP · REVOCHE · COLLEGAMENTO (collega.mjs, index.mjs) E SOCKET");
  const src = join(radice, "strumenti/ponte-whatsapp/src");
  const K = await import(pathToFileURL(join(src, "collega.mjs")).href);
  const L = await import(pathToFileURL(join(src, "lotti.mjs")).href);
  const X = await import(pathToFileURL(join(src, "index.mjs")).href);
  const base = mkdtempSync(join(tmpdir(), "ponte-revoche-"));
  let n = 0;

  /** Baileys finto: registra le proprietà del socket toccate e gli eventi ascoltati. */
  function baileysFinto() {
    const socket = [];
    const baileys = {
      Browsers: { macOS: (b) => ["Mac OS", b, "14.4.1"] },
      useMultiFileAuthState: async (cartella) => ({ state: { cartella }, saveCreds: async () => {} }),
      makeWASocket: () => {
        const ascolti = new Map();
        const toccate = new Set();
        const s = {
          user: { id: `${NOI}:3@s.whatsapp.net` },
          ev: { on: (nome, f) => ascolti.set(nome, [...(ascolti.get(nome) ?? []), f]) },
          ws: { on: () => {} },
          signalRepository: { lidMapping: { getPNForLID: async () => null } },
          end: () => {},
        };
        const visto = new Proxy(s, { get: (t, k) => (toccate.add(String(k)), t[k]) });
        socket.push({ toccate, eventi: () => [...ascolti.keys()].sort(), emetti: async (nome, dati) => { for (const f of ascolti.get(nome) ?? []) await f(dati); } });
        return visto;
      },
    };
    return { baileys, socket };
  }

  async function collega(conRevoche = true) {
    const dir = join(base, `s${n++}`);
    mkdirSync(dir, { mode: 0o700 });
    const fila = L.creaFila({ cartella: join(dir, "fila"), orologio: () => ADESSO * 1000 });
    const accodate = [];
    const revoche = { accoda: (k) => (accodate.push(k), { ok: true }), ferma: async () => {}, contatori: () => ({}) };
    const log = [];
    const f = baileysFinto();
    const col = K.creaCollegamento({
      baileys: f.baileys,
      percorsi: { auth: join(dir, "auth"), lid: join(dir, "lid.json") },
      fila,
      qr: { mostra: async () => {}, togli: () => {}, notifica: async () => {} },
      registro: (codice, conteggi = {}) => log.push([codice, conteggi]),
      ...(conRevoche ? { revoche } : {}),
      orologio: () => ADESSO * 1000,
      casuale: () => 0.5,
      pianifica: () => {},
      annulla: () => {},
    });
    await col.avvia();
    const s = f.socket[0];
    await s.emetti("connection.update", { connection: "open" });
    const righe = () => {
      const d = join(dir, "fila", "vivo");
      return existsSync(d) ? readdirSync(d).flatMap((x) => JSON.parse(readFileSync(join(d, x), "utf8")).lotto.messaggi) : [];
    };
    return { col, s, accodate, righe, log };
  }

  try {
    {
      const x = await collega();
      await x.s.emetti("messages.upsert", { type: "notify", messages: [revoca("3EB0AA01")] });
      c("upsert: la revoca di un nostro messaggio entra in coda con la sua chiave", [CHIAVE], x.accodate);
      c("…e NON diventa una riga di testo nella fila (resta uno scarto «cancellazione»)", [[], 1], [x.righe(), x.col.istantanea().diagnosi.scarti.cancellazione]);
      await x.s.emetti("messages.upsert", { type: "notify", messages: [revoca("3EB0AA02", { fromMe: false })] });
      c("upsert: la revoca di un cliente NON entra in coda e si conta come scarto", [[CHIAVE], 1], [x.accodate, x.col.istantanea().diagnosi.scarti.revoca_del_cliente]);
      await x.s.emetti("messages.update", [aggiornamento("3EB0AA03")]);
      c("update: la revoca di un nostro messaggio entra in coda", [CHIAVE, `bw:${CLIENTE}:3EB0AA03`], x.accodate);
      await x.s.emetti("messages.update", [aggiornamento("3EB0AA04", { fromMe: false }), { key: { remoteJid: JID, fromMe: true, id: "3EB0AA05" }, update: { status: 4 } }]);
      c("update: quella di un cliente e i semplici cambi di stato non entrano né fanno rumore", [2, 2], [x.accodate.length, x.col.istantanea().diagnosi.scarti.revoca_del_cliente]);
      await x.s.emetti("messages.update", [aggiornamento("3EB0AA06"), aggiornamento("3EB0AA07")]);
      c("update: una lista con più revoche le accoda tutte", 4, x.accodate.length);
      await x.s.emetti("messages.upsert", { type: "notify", messages: [{ key: { remoteJid: JID, fromMe: false, id: "M1" }, messageTimestamp: TS, message: { conversation: "ciao" }, pushName: "Cliente Finto" }] });
      c("un messaggio normale entra in fila come prima e non tocca la coda delle revoche", [1, 4], [x.righe().length, x.accodate.length]);
      await x.s.emetti("messages.update", null);
      await x.s.emetti("messages.update", [null, {}, { key: null }]);
      c("update storti non lanciano e non fanno entrare nulla", 4, x.accodate.length);
    }
    {
      const x = await collega(false);
      await x.s.emetti("messages.upsert", { type: "notify", messages: [revoca("3EB0AA01")] });
      await x.s.emetti("messages.update", [aggiornamento("3EB0AA01")]);
      c("senza la coda delle revoche (--senza-invio) il collegamento va avanti come prima", [[], 1], [x.righe(), x.col.istantanea().diagnosi.scarti.cancellazione]);
    }
    {
      //  Sul socket non entra niente di nuovo: stesse proprietà toccate, un solo evento in più da ascoltare (messages.update).
      const con = await collega(true);
      const senza = await collega(false);
      c("le proprietà del socket toccate sono le STESSE con e senza revoche", [...senza.s.toccate].sort(), [...con.s.toccate].sort());
      c("…e sono solo ev, ws, user, signalRepository, end", [], [...con.s.toccate].filter((k) => !["ev", "ws", "user", "signalRepository", "end"].includes(k)));
      c("l'unico evento in più che si ascolta è messages.update", ["messages.update"], con.s.eventi().filter((e) => !senza.s.eventi().includes(e)));
      c("…e senza la coda delle revoche si ascoltano gli eventi di prima", true, !senza.s.eventi().includes("messages.update") || senza.s.eventi().length === con.s.eventi().length);
    }

    // ── 4. index.mjs: accensione e spegnimento ──────────────────────────
    {
      const index = readFileSync(join(src, "index.mjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      const collegaSrc = readFileSync(join(src, "collega.mjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      c("index.mjs: la coda delle revoche si crea solo senza --senza-invio, con url e token", true, /if\s*\(\s*!senzaInvio\s*\)\s*revoche\s*=\s*creaRevoche\(\{\s*url,\s*token,\s*registro\s*\}\)/.test(index));
      c("index.mjs: la coda si passa al collegamento e allo stop si ferma", [true, true], [/revoche,\s*\n/.test(index) || /\brevoche\b[^\n]*\n[^\n]*identita/.test(index) || /creaCollegamento\(\{[\s\S]*?\brevoche\b[\s\S]*?\}\);/.test(index), /revoche\?\.ferma\(\)/.test(index)]);
      c("index.mjs: la riga `revoche` del registro nasce dai contatori (solo numeri) e si scrive quando cambia", true, /registro\("revoche",\s*\w+\)/.test(index) && /revoche\.contatori\(\)/.test(index));
      c("collega.mjs: la revoca si legge con revocaDa e revocaDaAggiornamento di estrai.mjs", [true, true], [(collegaSrc.match(/\brevocaDa\b/g) ?? []).length >= 2, (collegaSrc.match(/\brevocaDaAggiornamento\b/g) ?? []).length >= 2]);
      c("collega.mjs: una sola chiamata che accoda (revoche.accoda), dentro un try", [1, true], [(collegaSrc.match(/revoche\.accoda\(/g) ?? []).length, /try\s*\{[^}]*revoche\.accoda\(/.test(collegaSrc)]);
      c("collega.mjs: nessuna chiamata nuova sul socket (niente sock.… oltre a quelle di prima)", [], [...collegaSrc.matchAll(/\bsock\.(\w+)/g)].map((m) => m[1]).filter((k) => !["signalRepository", "sendMessage", "ws", "ev"].includes(k)));
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
