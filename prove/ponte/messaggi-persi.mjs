/** ── PROVE: I MESSAGGI CHE «SEMBRANO PERSI» (commessa 2026-10-30-messaggi-persi) ──
 *
 *  Il titolare (30/10/2026): «qui sembra che si è perso qualche messaggio».
 *  Ogni gruppo qui sotto riproduce UNA causa trovata e prova la correzione;
 *  le prove nascono dal guasto (prima della correzione fallivano, vedi la
 *  LAVAGNA della commessa).
 *   1. il ponte buttava ogni contenuto che non conosceva (`tipo_sconosciuto`);
 *   2. il ponte buttava il messaggio che WhatsApp non gli aveva saputo
 *      decifrare (stub CIPHERTEXT, «sistema»): nessuna traccia, nessun avviso;
 *   3. fermando il ponte subito dopo la connessione, i messaggi arrivati a
 *      ponte spento (già confermati a WhatsApp, ancora nel buffer di Baileys)
 *      andavano persi;
 *   4. la diagnosi per fonte (strumenti/diagnosi-fonti.sql) è di sola lettura.
 *  Tutto senza WhatsApp e senza rete: socket finto, fila finta, orologio e
 *  attese finti. Dati inventati: nessun numero né nome vero (prefisso 39 333 000…).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const NOI = "393330009999";
const CLIENTE = "393330000001";
const JID = `${CLIENTE}@s.whatsapp.net`;
const T0 = Date.UTC(2026, 9, 29, 12, 0, 0);
const TS = T0 / 1000 - 60;

/** Un `WAMessage` finto di Baileys 7. */
function wa(message, key = {}, altro = {}) {
  return { key: { remoteJid: JID, fromMe: false, id: "3EB0AA01", ...key }, messageTimestamp: TS, message, ...altro };
}

/** Lo stub CIPHERTEXT che Baileys emette quando non riesce a decifrare (decode-wa-message.js). */
const cifrato = (id = "3EB0CC01", altro = {}) => wa(undefined, { id }, { messageStubType: 2, messageStubParameters: ["Message absent from node"], pushName: "Cliente Prova", ...altro });

/** Baileys finto: eventi emessi a mano, `end` contato. */
function baileysFinto() {
  const sockets = [];
  return {
    sockets,
    baileys: {
      Browsers: { macOS: (b) => ["Mac OS", b, "14.4.1"] },
      useMultiFileAuthState: async (cartella) => ({ state: { cartella }, saveCreds: async () => {} }),
      makeWASocket: () => {
        const ascolti = new Map();
        const s = {
          chiuso: 0,
          user: { id: `${NOI}:3@s.whatsapp.net` },
          ev: { on: (nome, f) => ascolti.set(nome, [...(ascolti.get(nome) ?? []), f]) },
          ws: { on: () => {} },
          signalRepository: { lidMapping: { getPNForLID: async () => null } },
          end: () => void s.chiuso++,
          emetti: async (nome, dati) => {
            for (const f of ascolti.get(nome) ?? []) await f(dati);
          },
        };
        sockets.push(s);
        return s;
      },
    },
  };
}

export async function provePonteMessaggiPersi(mod, { c, gruppo, radice }) {
  const src = join(radice, "strumenti/ponte-whatsapp/src");
  const E = await import(pathToFileURL(join(src, "estrai.mjs")).href);
  const K = await import(pathToFileURL(join(src, "collega.mjs")).href);
  const P = mod["ponte/pari"];
  const T = mod["ponte/tipi"];
  const opz = { proprioNumero: NOI, adesso: T0 / 1000, risolviLid: () => null };
  const leggi = (m, o = {}) => E.leggiMessaggio(m, { ...opz, ...o });
  const solo = (m, o) => {
    const r = leggi(m, o);
    return r.ok ? { testo: r.messaggio.testo, tipo: r.messaggio.tipo } : { scarto: r.motivo };
  };

  gruppo("MESSAGGI PERSI · 1. IL PONTE NON BUTTA UN CONTENUTO CHE NON CONOSCE");
  const ALLEGATO = "📎 Allegato";
  for (const tipo of ["productMessage", "orderMessage", "eventMessage", "groupInviteMessage", "paymentInviteMessage", "commentMessage", "stickerPackMessage", "tipoDelDomani"]) {
    c(`${tipo} del cliente → segnaposto, non scartato`, { testo: ALLEGATO, tipo: "altro" }, solo(wa({ [tipo]: { x: 1 } })));
  }
  c("l'intestazione di un album non è un messaggio (i figli arrivano da soli)", { scarto: "album" }, solo(wa({ albumMessage: { expectedImageCount: 2 } })));
  c("un figlio d'album (associatedChildMessage) si apre: dentro c'è la foto", { testo: "📷 Foto: prima", tipo: "foto" }, solo(wa({ associatedChildMessage: { message: { imageMessage: { caption: "prima" } } } })));
  c("un figlio d'album con il video", { testo: "🎥 Video", tipo: "video" }, solo(wa({ associatedChildMessage: { message: { videoMessage: {} } } })));
  c("i carichi interni non sono messaggi", [{ scarto: "sistema" }, { scarto: "sistema" }, { scarto: "sondaggio" }], [solo(wa({ secretEncryptedMessage: {} })), solo(wa({ messageHistoryBundle: {} })), solo(wa({ pollResultSnapshotMessage: {} }))]);
  c("reazioni, modifiche, cancellazioni restano scartate", [{ scarto: "reazione" }, { scarto: "cancellazione" }], [solo(wa({ reactionMessage: {} })), solo(wa({ protocolMessage: { type: 0 } }))]);
  c("la chiave di distribuzione (anche fast ratchet) da sola non è un messaggio", { scarto: "sistema" }, solo(wa({ fastRatchetKeySenderKeyDistributionMessage: {} })));

  gruppo("MESSAGGI PERSI · 2. IL MESSAGGIO NON DECIFRATO NON SPARISCE");
  c("il segnaposto è copiato da pari.ts", P.NON_DECIFRATO, E.NON_DECIFRATO);
  const nd = leggi(cifrato());
  c("stub CIPHERTEXT in entrata → scarto «non_decifrato» (non più «sistema»)", ["non_decifrato", false], [nd.motivo, nd.ok]);
  c(
    "…con il segnaposto pronto: id vero + «-nd», in entrata, orario vero, nome del cliente",
    { messaggio: { id: "3EB0CC01-nd", numero: CLIENTE, dir: "in", ts: TS, testo: E.NON_DECIFRATO, tipo: "altro" }, nome: "Cliente Prova", idVero: "3EB0CC01" },
    nd.segnaposto,
  );
  c("lo stub con il nome dell'enum (CIPHERTEXT) vale uguale", "non_decifrato", leggi(cifrato("3EB0CC02", { messageStubType: "CIPHERTEXT" })).motivo);
  c("uno stub nostro (fromMe) o di sistema (altro tipo) resta «sistema»", ["sistema", "sistema"], [leggi(wa(undefined, { fromMe: true, id: "3EB0CC03" }, { messageStubType: 2 })).motivo, leggi(wa(undefined, { id: "3EB0CC04" }, { messageStubType: 20 })).motivo]);
  c("uno stub senza orario valido o con id non valido resta «sistema»", ["sistema", "sistema"], [leggi(cifrato("3EB0CC05", { messageTimestamp: undefined })).motivo, leggi(cifrato("a b")).motivo]);
  c("il segnaposto rientra nei limiti del CRM (id, testo, tipo)", true, /^[A-Za-z0-9_.-]{1,128}$/.test(nd.segnaposto.messaggio.id) && T.TIPI_CONTENUTO.includes(nd.segnaposto.messaggio.tipo) && nd.segnaposto.messaggio.testo.length <= T.LIMITI.testo);

  //  Il collegamento: aspetta il vero messaggio, poi scrive il segnaposto.
  const base = mkdtempSync(join(tmpdir(), "ponte-messaggi-persi-"));
  const ambiente = async () => {
    const { baileys, sockets } = baileysFinto();
    const scritti = [];
    const timer = [];
    const annullati = new Set();
    const col = K.creaCollegamento({
      baileys,
      percorsi: { auth: join(base, "auth"), lid: join(base, "lid.json") },
      fila: { aggiungi: (origine, messaggi, nomi) => (scritti.push({ origine, messaggi, nomi }), { piena: false, accettati: messaggi.length }) },
      qr: { mostra: async () => {}, togli: () => {}, notifica: async () => {} },
      registro: () => {},
      orologio: () => T0,
      casuale: () => 0.5,
      pianifica: (f, ms) => (timer.push({ f, ms }), timer.length),
      annulla: (id) => void annullati.add(id),
    });
    return { col, sockets, scritti, timer, annullati, daFare: () => timer.filter((_, i) => !annullati.has(i + 1)) };
  };

  {
    //  il vero arriva dopo 20 s (Baileys l'ha chiesto al telefono): niente segnaposto
    const a = await ambiente();
    await a.col.avvia();
    const s = a.sockets[0];
    await s.emetti("connection.update", { connection: "open" });
    await s.emetti("messages.upsert", { type: "notify", messages: [cifrato("3EB0DD01")] });
    c("stub in arrivo: niente in fila subito (si aspetta il vero)", [0, 1], [a.scritti.length, a.daFare().length]);
    c("l'attesa è di 2 minuti", K.ATTESA_NON_DECIFRATO_MS, a.timer.find((t) => t.ms === K.ATTESA_NON_DECIFRATO_MS)?.ms);
    await s.emetti("messages.upsert", { type: "notify", messages: [wa({ conversation: "Sì, vengo" }, { id: "3EB0DD01" })] });
    c("arriva il vero (stesso id): in fila il solo testo vero, senza «-nd»", [["3EB0DD01", "Sì, vengo"]], a.scritti.flatMap((x) => x.messaggi.map((m) => [m.id, m.testo])));
    c("…e il segnaposto non verrà mai scritto (timer annullato)", [0, 1], [a.daFare().length, a.col.istantanea().estrazione.non_decifrati_arrivati]);
  }
  {
    //  il vero non arriva mai: dopo 2 minuti il cliente c'è comunque
    const a = await ambiente();
    await a.col.avvia();
    const s = a.sockets[0];
    await s.emetti("connection.update", { connection: "open" });
    await s.emetti("messages.upsert", { type: "append", messages: [cifrato("3EB0DD02"), cifrato("3EB0DD02")] });
    c("lo stesso stub due volte → una sola attesa", 1, a.daFare().length);
    const t = a.daFare()[0];
    t.f();
    c(
      "dopo 2 minuti senza il vero → in fila il segnaposto, in entrata, col nome",
      [[{ id: "3EB0DD02-nd", numero: CLIENTE, dir: "in", ts: TS, testo: E.NON_DECIFRATO, tipo: "altro" }], { [CLIENTE]: "Cliente Prova" }, "vivo"],
      [a.scritti[0]?.messaggi, a.scritti[0]?.nomi, a.scritti[0]?.origine],
    );
    c("contato nella diagnosi (scarto e segnaposti scritti)", [2, 1], [a.col.istantanea().diagnosi.scarti.non_decifrato, a.col.istantanea().estrazione.non_decifrati]);
  }
  {
    //  lo storico non fa segnaposto: i messaggi vecchi non si «inventano»
    const a = await ambiente();
    await a.col.avvia();
    const s = a.sockets[0];
    await s.emetti("messaging-history.set", { messages: [cifrato("3EB0DD03")], progress: 50 });
    c("stub nello storico → nessun segnaposto, nessuna attesa", [0, 0], [a.scritti.length, a.daFare().length]);
  }
  {
    //  il ponte si ferma con un segnaposto in attesa: non si perde, va subito in fila
    const a = await ambiente();
    await a.col.avvia();
    const s = a.sockets[0];
    await s.emetti("messages.upsert", { type: "notify", messages: [cifrato("3EB0DD04")] });
    await a.col.ferma();
    c("ferma() con un segnaposto in attesa → lo scrive subito in fila", ["3EB0DD04-nd"], a.scritti.flatMap((x) => x.messaggi.map((m) => m.id)));
  }

  gruppo("MESSAGGI PERSI · 3. FERMARE IL PONTE NON PERDE IL BUFFER DI BAILEYS");
  {
    //  Baileys tiene i messaggi arrivati a ponte spento nel buffer fino a
    //  `receivedPendingNotifications` (max 30 s) e li ha già confermati a WhatsApp.
    const a = await ambiente();
    await a.col.avvia();
    const s = a.sockets[0];
    await s.emetti("connection.update", { connection: "open" });
    c("collegato ma buffer non ancora scaricato", "collegato", a.col.istantanea().stato);
    const fermata = a.col.ferma();
    await new Promise((ok) => setImmediate(ok));
    c("ferma(): il socket NON si chiude finché il buffer non è scaricato", 0, s.chiuso);
    c("…aspetta al massimo 6 s", K.ATTESA_SCARICO_MS, a.timer.at(-1).ms);
    //  Baileys scarica il buffer: arrivano i messaggi del periodo di spegnimento
    await s.emetti("messages.upsert", { type: "append", messages: [wa({ conversation: "scritto a ponte spento" }, { id: "3EB0EE01" }), wa({ imageMessage: {} }, { id: "3EB0EE02" })] });
    c("i messaggi del buffer arrivano durante l'attesa e vanno in fila", [["3EB0EE01", "in"], ["3EB0EE02", "in"]], a.scritti.flatMap((x) => x.messaggi.map((m) => [m.id, m.dir])));
    c("il socket è ancora aperto (manca la notifica di Baileys)", 0, s.chiuso);
    await s.emetti("connection.update", { receivedPendingNotifications: true });
    await fermata;
    c("scaricato il buffer, ferma() chiude il socket e lo stato è fermo", [1, "fermo"], [s.chiuso, a.col.istantanea().stato]);
    await s.emetti("messages.upsert", { type: "notify", messages: [wa({ conversation: "dopo" }, { id: "3EB0EE03" })] });
    c("dopo la chiusura gli eventi non contano più", 1, a.scritti.length);
  }
  {
    //  Baileys non scarica mai: dopo 6 s ci si ferma lo stesso
    const a = await ambiente();
    await a.col.avvia();
    const s = a.sockets[0];
    await s.emetti("connection.update", { connection: "open" });
    const fermata = a.col.ferma();
    await new Promise((ok) => setImmediate(ok));
    a.timer.at(-1).f();
    await fermata;
    c("senza scarico, scaduti i 6 s il socket si chiude comunque", [1, "fermo"], [s.chiuso, a.col.istantanea().stato]);
  }
  {
    //  già scaricato, oppure non collegato: nessuna attesa, come prima
    const a = await ambiente();
    await a.col.avvia();
    const s = a.sockets[0];
    await s.emetti("connection.update", { connection: "open" });
    await s.emetti("connection.update", { receivedPendingNotifications: true });
    const prima = a.timer.length;
    await a.col.ferma();
    c("buffer già scaricato → chiude subito, nessuna attesa", [1, prima], [s.chiuso, a.timer.length]);
    const b = await ambiente();
    await b.col.avvia();
    b.col.ferma();
    c("non collegato → chiude subito (sincrono)", [1, "fermo"], [b.sockets[0].chiuso, b.col.istantanea().stato]);
  }
  {
    //  il socket si chiude mentre si aspetta: ci si ferma, niente riconnessione
    const a = await ambiente();
    await a.col.avvia();
    const s = a.sockets[0];
    await s.emetti("connection.update", { connection: "open" });
    const fermata = a.col.ferma();
    await new Promise((ok) => setImmediate(ok));
    await s.emetti("connection.update", { connection: "close", lastDisconnect: { error: { output: { statusCode: 408 } } } });
    await fermata;
    c("chiusura di rete durante l'attesa → si ferma, nessun socket nuovo", 1, a.sockets.length);
  }
  {
    //  la coda offline di WhatsApp arriva come `append`: passa come gli altri
    const a = await ambiente();
    await a.col.avvia();
    const s = a.sockets[0];
    await s.emetti("messages.upsert", { type: "append", messages: [wa({ conversation: "arrivato mentre il ponte era spento" }, { id: "3EB0EE10" })] });
    c("coda offline (messages.upsert append) → in fila come un vivo", [["vivo", "3EB0EE10"]], a.scritti.map((x) => [x.origine, x.messaggi[0].id]));
  }

  gruppo("MESSAGGI PERSI · 4. IL SEGNAPOSTO NON LASCIA UN DOPPIONE IN CHAT");
  const BASE = 1761730000;
  const iso = (sec) => new Date(sec * 1000).toISOString();
  const crm = (o) => ({ id: o.id, direction: o.dir ?? "inbound", from_number: (o.dir ?? "inbound") === "inbound" ? "+393330000001" : "manychat", to_number: (o.dir ?? "inbound") === "inbound" ? "manychat" : "+393330000001", body: o.body ?? null, canale: "manychat", status: "delivered", duplicato_di: null, created_at: iso(o.t) });
  const riga = (o) => ({ k: T.chiaveMessaggio(CLIENTE, o.id), n: CLIENTE, d: o.d ?? "in", t: o.t, x: o.x, m: o.m ?? null });
  const abbina = (righe, tabella) => {
    const candidati = [];
    for (const r of righe) {
      for (const x of tabella) {
        if (P.ammessoCome(x, { k: r.k, n: r.n, d: r.d, t: r.t })) candidati.push({ k: r.k, id: x.id, created_at: x.created_at, direction: x.direction, body: x.body, canale: x.canale });
      }
    }
    return P.abbinaPari(righe, candidati).map((p) => `${p.k.split(":")[2]}=${p.crm}`).sort();
  };
  c("ManyChat ha il testo vero a +3 s: il segnaposto è il suo pari (nascosto)", ["x-nd=c1"], abbina([riga({ id: "x-nd", t: BASE, x: P.NON_DECIFRATO })], [crm({ id: "c1", t: BASE + 3, body: "Ci sono domani" })]));
  c("ManyChat non ha niente: il segnaposto resta visibile", [], abbina([riga({ id: "x-nd", t: BASE, x: P.NON_DECIFRATO })], []));
  c("un'uscita del CRM vicina non è il suo pari", [], abbina([riga({ id: "x-nd", t: BASE, x: P.NON_DECIFRATO })], [crm({ id: "c1", dir: "outbound", t: BASE + 3, body: "Ok, vi aspetto" })]));
  c("un'entrata a 3 minuti non basta (finestra di 2)", [], abbina([riga({ id: "x-nd", t: BASE, x: P.NON_DECIFRATO })], [crm({ id: "c1", t: BASE + 150, body: "Ci sono domani" })]));
  c("un messaggio vero uguale non viene sostituito: due «Ok» veri e un solo Ok di ManyChat → uno visibile", ["a=c1"], abbina([riga({ id: "a", t: BASE, x: "Ok" }), riga({ id: "b", t: BASE + 40, x: "Ok" })], [crm({ id: "c1", t: BASE + 2, body: "Ok" })]));

  gruppo("MESSAGGI PERSI · 5. LA DIAGNOSI PER FONTE È DI SOLA LETTURA");
  const sql = readFileSync(join(radice, "strumenti/diagnosi-fonti.sql"), "utf8");
  const codice = sql.replace(/--.*$/gm, "");
  c("solo SELECT/WITH: nessuna istruzione che scrive", [], ["insert", "update", "delete", "drop", "alter", "create", "truncate", "grant", "copy"].filter((k) => new RegExp(`\\b${k}\\b`, "i").test(codice)));
  c("parte da una finestra modificabile in testa", true, /params AS/i.test(codice));
  rmSync(base, { recursive: true, force: true });
}
