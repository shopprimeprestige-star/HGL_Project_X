/** ── PROVE: LE RISPOSTE NATIVE CHE NON ARRIVANO NEL CRM (30/10/2026, sera) ──────────────
 *
 *  Il titolare: «i miei messaggi dal WhatsApp nativo, testo e vocali, in alcune chat non compaiono».
 *  Due cause, ognuna riprodotta qui prima della correzione (systematic-debugging):
 *   1. una chat `@lid` che il ponte non sa ancora tradurre in numero veniva SCARTATA per sempre
 *      (`senza_numero`), anche se pochi istanti dopo WhatsApp dava la coppia lid/numero (rubrica,
 *      `contacts.upsert`, `chats.phoneNumberShare`) o `getPNForLID` la conosceva;
 *   2. una nostra uscita «nascosta» (invio ManyChat/modello senza testo) faceva da pari a QUALUNQUE
 *      uscita del CRM entro 120 s, anche PRIMA di lei: una risposta dell'inbox ManyChat poco dopo un
 *      messaggio automatico spariva come «doppione» e non spostava `risposto_il`.
 *  Socket, fila e orologio finti. Dati inventati (333 000…). */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const NOI = "393330009999";
const CLIENTE = "393330000001";
const LID = "98765432100001@lid";
const T0 = Date.UTC(2026, 9, 30, 12, 0, 0);
const TS = T0 / 1000 - 60;

function baileysFinto(getPN = async () => null) {
  const sockets = [];
  return {
    sockets,
    baileys: {
      Browsers: { macOS: (b) => ["Mac OS", b, "14.4.1"] },
      useMultiFileAuthState: async (cartella) => ({ state: { cartella }, saveCreds: async () => {} }),
      makeWASocket: () => {
        const ascolti = new Map();
        const s = {
          user: { id: `${NOI}:3@s.whatsapp.net` },
          ev: { on: (nome, f) => ascolti.set(nome, [...(ascolti.get(nome) ?? []), f]) },
          ws: { on: () => {} },
          signalRepository: { lidMapping: { getPNForLID: (lid) => getPN(lid) } },
          end: () => {},
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

export async function provePonteLidEPari(mod, { c, gruppo, radice }) {
  const src = join(radice, "strumenti/ponte-whatsapp/src");
  const K = await import(pathToFileURL(join(src, "collega.mjs")).href);
  const P = mod["ponte/pari"];

  /* ── 2. IL PARI «NASCOSTO»: CAUSA ESAMINATA, NON UN GUASTO DA CORREGGERE ──────────────
   *  Ipotesi: la risposta umana dell'inbox ManyChat (riga nascosta) viene inghiottita come pari di
   *  un messaggio automatico vicino. Il ponte però può vedere l'invio automatico ANCHE 40 s dopo
   *  la riga del CRM (il flusso parte dopo la chiamata all'API: prova 4j di pari.mjs), quindi una
   *  finestra asimmetrica romperebbe l'abbinamento vero e farebbe passare gli automatici per
   *  risposte umane. L'abbinamento è uno a uno: l'inghiottimento avviene solo se la riga nascosta
   *  dell'automatico non c'è. Queste prove lo fissano. */
  gruppo("RISPOSTE NATIVE · 2. UN INVIO NASCOSTO È PARI A UNA SOLA RIGA DEL CRM (uno a uno)");
  {
    const t = Math.floor(T0 / 1000);
    const iso = (sec) => new Date((t + sec) * 1000).toISOString();
    const nascosta = (k, sec) => ({ k, n: CLIENTE, d: "out", t: t + sec, x: P.INVIO_NASCOSTO, m: null });
    const crm = { k: "bw:x", id: "crm-1", created_at: iso(0), direction: "outbound", body: "[template:conferma_meet]", canale: "manychat" };
    const cand = (k) => ({ ...crm, k });
    const pari = (righe) => P.abbinaPari(righe, righe.map((r) => cand(r.k))).map((p) => p.k);
    c("l'invio automatico (+3 s) e la risposta umana (+60 s) con UNA riga del CRM: pari solo al più vicino, l'altra resta visibile (e conta come risposta)", ["bw:a"], pari([nascosta("bw:a", 3), nascosta("bw:b", 60)]));
    c("l'ordine di arrivo non cambia l'esito", ["bw:a"], pari([nascosta("bw:b", 60), nascosta("bw:a", 3)]));
    c("la sola risposta umana, senza la riga nascosta dell'automatico: è l'unico caso in cui viene assorbita (limite noto)", ["bw:b"], pari([nascosta("bw:b", 60)]));
  }

  /* ── 1. LA CHAT @lid NON SI SCARTA PER SEMPRE ──────────────────────────────────────── */
  gruppo("RISPOSTE NATIVE · 1. UNA CHAT @lid NON TRADOTTA NON SI PERDE");
  const base = mkdtempSync(join(tmpdir(), "ponte-lid-"));
  let n = 0;
  const ambiente = async (getPN) => {
    const { baileys, sockets } = baileysFinto(getPN);
    const scritti = [];
    const log = [];
    const timer = [];
    const annullati = new Set();
    const col = K.creaCollegamento({
      baileys,
      percorsi: { auth: join(base, `auth${n}`), lid: join(base, `lid${n++}.json`) },
      fila: { aggiungi: (origine, messaggi, nomi) => (scritti.push({ origine, messaggi, nomi }), { piena: false, accettati: messaggi.length }) },
      qr: { mostra: async () => {}, togli: () => {}, notifica: async () => {} },
      registro: (codice, conteggi) => log.push({ codice, conteggi }),
      orologio: () => T0,
      casuale: () => 0.5,
      pianifica: (f, ms) => (timer.push({ f, ms }), timer.length),
      annulla: (id) => void annullati.add(id),
    });
    await col.avvia();
    await sockets[0].emetti("connection.update", { connection: "open" });
    return { col, s: sockets[0], scritti, log, timer, annullati };
  };
  const mia = (testo, id = "3EB0LID01") => ({ key: { remoteJid: LID, fromMe: true, id }, messageTimestamp: TS, message: { conversation: testo } });
  const vocale = (id = "3EB0LID02") => ({ key: { remoteJid: LID, fromMe: true, id }, messageTimestamp: TS, message: { audioMessage: { ptt: true } } });
  const visti = (a) => a.scritti.flatMap((x) => x.messaggi.map((m) => [x.origine, m.numero, m.dir, m.testo]));

  {
    const a = await ambiente();
    await a.s.emetti("messages.upsert", { type: "notify", messages: [mia("Certo, ti aspetto"), vocale()] });
    c("chat @lid senza traduzione: niente in fila subito", 0, a.scritti.length);
    c("…ma non è più silenzio: un avviso nel log col solo codice e i conteggi (mai il lid)", [{ codice: "lid_non_risolto", conteggi: { chat: 1, messaggi: 2 } }], a.log.filter((x) => x.codice === "lid_non_risolto"));
    await a.s.emetti("contacts.upsert", [{ id: LID, phoneNumber: `${CLIENTE}@s.whatsapp.net`, name: "Cliente Prova" }]);
    c("arriva la coppia dalla rubrica (contacts.upsert): testo e vocale entrano in fila, uscita viva, col numero vero",
      [["vivo", CLIENTE, "out", "Certo, ti aspetto"], ["vivo", CLIENTE, "out", "🎤 Vocale"]], visti(a));
    await a.s.emetti("contacts.upsert", [{ id: LID, phoneNumber: `${CLIENTE}@s.whatsapp.net` }]);
    c("la stessa coppia ripetuta non rimanda i messaggi", 2, visti(a).length);
  }
  {
    const a = await ambiente();
    await a.s.emetti("messages.upsert", { type: "notify", messages: [mia("Va bene")] });
    await a.s.emetti("contacts.update", [{ id: `${CLIENTE}@s.whatsapp.net`, lid: LID }]);
    c("la coppia può arrivare dal lato del numero (id numero + campo lid)", [["vivo", CLIENTE, "out", "Va bene"]], visti(a));
  }
  {
    const a = await ambiente();
    await a.s.emetti("messages.upsert", { type: "notify", messages: [mia("Ok")] });
    await a.s.emetti("chats.phoneNumberShare", { lid: LID, jid: `${CLIENTE}@s.whatsapp.net` });
    c("chats.phoneNumberShare: il cliente ha condiviso il numero → il messaggio entra", [["vivo", CLIENTE, "out", "Ok"]], visti(a));
  }
  {
    let pronto = false;
    const a = await ambiente(async () => (pronto ? `${CLIENTE}@s.whatsapp.net` : null));
    await a.s.emetti("messages.upsert", { type: "notify", messages: [mia("Dopo")] });
    const ripresa = a.timer.find((t) => t.ms === K.RIPROVA_LID_MS);
    c("senza traduzione si pianifica una nuova prova (getPNForLID)", true, Boolean(ripresa));
    pronto = true;
    await ripresa?.f();
    c("alla nuova prova Baileys conosce il numero: il messaggio entra", [["vivo", CLIENTE, "out", "Dopo"]], visti(a));
    c("…e il lid risolto non lascia nessun'altra prova pianificata", 1, a.timer.filter((t) => t.ms === K.RIPROVA_LID_MS).length);
  }
  {
    //  lo storico resta storico (non diventa «vivo»: non sposterebbe risposto_il)
    const a = await ambiente();
    await a.s.emetti("messaging-history.set", { messages: [mia("Vecchio")], contacts: [], progress: 100, syncType: 2 });
    await a.s.emetti("chats.phoneNumberShare", { lid: LID, jid: `${CLIENTE}@s.whatsapp.net` });
    c("un messaggio dello storico recuperato dopo resta «storico»", [["storico", CLIENTE, "out", "Vecchio"]], visti(a));
  }
  {
    //  il tetto: non si accumula senza fine
    const a = await ambiente();
    const tanti = Array.from({ length: K.MAX_LID_MESSAGGI + 50 }, (_, i) => mia(`m${i}`, `3EB0T${i}`));
    await a.s.emetti("messages.upsert", { type: "notify", messages: tanti });
    await a.s.emetti("chats.phoneNumberShare", { lid: LID, jid: `${CLIENTE}@s.whatsapp.net` });
    c("oltre il tetto i messaggi in più si contano nel log (non spariscono in silenzio)", [K.MAX_LID_MESSAGGI, true], [visti(a).length, a.log.some((x) => x.codice === "lid_scartato" && x.conteggi?.messaggi === 50)]);
  }
}
