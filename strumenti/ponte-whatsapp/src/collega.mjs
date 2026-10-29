/** ── PONTE WHATSAPP · IL COLLEGAMENTO (socket Baileys ed eventi) ────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T6 (PIANO §a3, §a4, §a6).
 *  Crea il socket, ascolta gli eventi e li passa alle parti pure di T5:
 *    connection.update        → QR, stato, riconnessione (`riconnessione.mjs`)
 *    creds.update             → `saveCreds` di `useMultiFileAuthState`
 *    messaging-history.set    → `estrai.mjs` → `fila.aggiungi("storico", …)`
 *    messaging-history.status → storico completo
 *    messages.upsert          → `estrai.mjs` → `fila.aggiungi("vivo", …)`
 *    lid-mapping.update       → mappa LID → numero, salvata in `lid.json`
 *
 *  Baileys NON si importa qui: arriva da `index.mjs` come parametro
 *  (`{ makeWASocket, useMultiFileAuthState, Browsers }`), così le prove usano
 *  un socket finto, senza rete e senza WhatsApp.
 *
 *    ws «CB:message»         → i nodi senza contenuto (`<unavailable>`) si
 *                               contano; `hosted_unavailable_fanout` uscito da
 *                               noi (invio dell'API, che Baileys scarta) →
 *                               `estrai.mjs` → «📋 Messaggio inviato da
 *                               ManyChat (testo non visibile)» → fila vivo
 *
 *  ⚠️ SOLA LETTURA. Il socket si chiama sempre `sock` quando lo si usa (la
 *   guardia delle prove cerca le chiamate `sock.…(`). Si chiamano soltanto
 *   `ev.on`, `ws.on` (ascolto dei nodi ricevuti), `end` e
 *   `signalRepository.lidMapping.getPNForLID` (legge le chiavi locali): mai un
 *   invio, una conferma di lettura, una presenza, un logout. Lo controlla
 *   `prove/ponte/servizio-guardie.mjs` con una lista bianca.
 *  ⚠️ Qui passano numeri, nomi e testi: nessun `console`, e al registro solo
 *   codici fissi e contatori.
 *  ───────────────────────────────────────────────────────────────────────── */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { aggiornaMappaLid, cifreDaJid, leggiMessaggio, messaggioDaNodo, nonDisponibile, nomiDaContatti, risolutoreLid, tipoGrezzo } from "./estrai.mjs";
import { codiceChiusura, decidi, STORIA_VUOTA } from "./riconnessione.mjs";

const muto = () => undefined;

/** Il logger di Baileys: non scrive niente, mai (i suoi oggetti contengono
 *  JID, chiavi e messaggi). Forma di `ILogger` più `fatal`. */
export const LOGGER_MUTO = {
  level: "silent",
  child: () => LOGGER_MUTO,
  trace: muto,
  debug: muto,
  info: muto,
  warn: muto,
  error: muto,
  fatal: muto,
};

/** La mappa di `lid.json`: `{ "<lid>": "<cifre>" }`; un file rotto vale vuoto. */
function leggiMappa(percorso) {
  try {
    const m = JSON.parse(readFileSync(percorso, "utf8"));
    if (!m || typeof m !== "object" || Array.isArray(m)) return {};
    return Object.fromEntries(Object.entries(m).filter(([k, v]) => /^\d+$/.test(k) && typeof v === "string" && /^\d{8,15}$/.test(v)));
  } catch {
    return {};
  }
}

/** Scrittura atomica con permessi 600. */
function scriviMappa(percorso, mappa) {
  const temporaneo = `${percorso}.tmp-${process.pid}`;
  writeFileSync(temporaneo, JSON.stringify(mappa), { mode: 0o600 });
  renameSync(temporaneo, percorso);
}

const iso = (ms) => new Date(ms).toISOString();

/** Voci al più per mappa di diagnosi: oltre, tutto in `altri` (i tipi del
 *  proto sono un elenco chiuso, ma un nodo strano non deve gonfiare il log). */
const MAX_VOCI = 40;
function conta(mappa, chiave) {
  const k = chiave in mappa || Object.keys(mappa).length < MAX_VOCI ? chiave : "altri";
  mappa[k] = (mappa[k] ?? 0) + 1;
}

/** Il collegamento a WhatsApp.
 *
 *  `opzioni`:
 *   - `baileys`: `{ makeWASocket, useMultiFileAuthState, Browsers }`;
 *   - `percorsi`: `{ auth, lid }` (cartella delle chiavi e `lid.json`);
 *   - `fila`: quella di `creaFila` (`lotti.mjs`);
 *   - `qr`: quello di `creaQr` (`qr.mjs`);
 *   - `registro(codice, conteggi)`: il log (solo codici e numeri);
 *   - `storicoDal`: secondi UNIX del taglio di STORICO_GIORNI (assente = tutto);
 *   - `avvisa()`: chiamato a ogni cambiamento (stato.json, giro d'invio);
 *   - `orologio`, `casuale`, `pianifica`, `annulla`: li sostituiscono le prove.
 *
 *  Uscita: `{ avvia, ferma, istantanea }`. `istantanea()` = solo stato e
 *  numeri: `{ stato, collegato_dal, ultimo_messaggio_il, storico, estrazione,
 *  diagnosi }`; `diagnosi` = `{ scarti, tipi, nodi }` (motivo, `in_`/`out_` +
 *  tipo di Baileys, tipo di `<unavailable>` → quante volte). */
export function creaCollegamento({
  baileys,
  percorsi,
  fila,
  qr,
  registro = () => {},
  storicoDal,
  avvisa = () => {},
  orologio = Date.now,
  casuale = Math.random,
  pianifica = setTimeout,
  annulla = clearTimeout,
}) {
  let mappa = leggiMappa(percorsi.lid);
  let sock = null;
  let generazione = 0;
  let storia = { ...STORIA_VUOTA };
  let attesa = null;
  let fermato = false;
  let proprioNumero = null;
  let proprioLid = null;
  const stato = {
    stato: "in_collegamento",
    collegato_dal: null,
    ultimo_messaggio_il: null,
    // con una sessione già salvata lo storico è già arrivato una volta
    storico: existsSync(`${percorsi.auth}/creds.json`) ? { fatto: true, avanzamento: 100 } : { fatto: false, avanzamento: 0 },
  };
  const estrazione = { letti: 0, validi: 0, chat: 0, lid_risolti: 0, lid_errori: 0, storico_rifiutati: 0, invii_nascosti: 0 };
  /** guasto 2: perché si scarta, che cosa arriva, che cosa arriva senza contenuto */
  const diagnosi = { scarti: {}, tipi: {}, nodi: {} };
  /** i numeri visti, solo in memoria e solo per contarli (`--senza-invio`) */
  const chatViste = new Set();

  function cambia(campi) {
    Object.assign(stato, campi);
    avvisa();
  }

  function aggiornaLid(voci) {
    const nuova = aggiornaMappaLid(mappa, voci);
    if (Object.keys(nuova).length === Object.keys(mappa).length && Object.entries(nuova).every(([k, v]) => mappa[k] === v)) return;
    mappa = nuova;
    try {
      scriviMappa(percorsi.lid, mappa);
    } catch {
      registro("lid_non_scritto");
    }
  }

  /** `getPNForLID` è asincrono e `estrai.mjs` vuole un risolutore sincrono:
   *  prima di estrarre si risolvono qui i `@lid` che mancano, e il risultato
   *  entra nella mappa (e in `lid.json`). Impara anche le coppie che il
   *  messaggio porta già (`remoteJid` @lid + `remoteJidAlt` numero). */
  async function preparaLid(sock, messaggi) {
    const imparate = [];
    const mancanti = new Set();
    const risolvi = risolutoreLid(mappa);
    for (const m of messaggi) {
      const jid = m?.key?.remoteJid;
      if (typeof jid !== "string" || !jid.endsWith("@lid")) continue;
      if (cifreDaJid(m.key.remoteJidAlt)) imparate.push({ lid: jid, pn: m.key.remoteJidAlt });
      else if (!risolvi(jid)) mancanti.add(jid);
    }
    const repo = sock?.signalRepository?.lidMapping;
    if (mancanti.size && typeof repo?.getPNForLID === "function") {
      for (const lid of mancanti) {
        try {
          const pn = await sock.signalRepository.lidMapping.getPNForLID(lid);
          if (pn) {
            imparate.push({ lid, pn });
            estrazione.lid_risolti++;
          }
        } catch {
          estrazione.lid_errori++;
        }
      }
    }
    if (imparate.length) aggiornaLid(imparate);
  }

  /** WAMessage[] → `{ messaggi, nomi }` validi, contando gli scarti per motivo. */
  function estrai(lista, dal) {
    const risolviLid = risolutoreLid(mappa);
    const messaggi = [];
    const nomi = {};
    let ultimo = 0;
    for (const m of lista) {
      estrazione.letti++;
      conta(diagnosi.tipi, `${m?.key?.fromMe ? "out" : "in"}_${tipoGrezzo(m)}`);
      const r = leggiMessaggio(m, { proprioNumero, risolviLid, adesso: Math.floor(orologio() / 1000), dal });
      if (!r.ok) {
        conta(diagnosi.scarti, r.motivo);
        continue;
      }
      estrazione.validi++;
      chatViste.add(r.messaggio.numero);
      estrazione.chat = chatViste.size;
      messaggi.push(r.messaggio);
      if (r.nome && !nomi[r.messaggio.numero]) nomi[r.messaggio.numero] = r.nome;
      if (r.messaggio.ts > ultimo) ultimo = r.messaggio.ts;
    }
    if (ultimo && (!stato.ultimo_messaggio_il || ultimo * 1000 > Date.parse(stato.ultimo_messaggio_il))) stato.ultimo_messaggio_il = iso(ultimo * 1000);
    return { messaggi, nomi };
  }

  /** Mette in fila e dice quanti sono rimasti fuori (fila piena). */
  function metti(origine, messaggi, nomi) {
    if (!messaggi.length) return;
    const r = fila.aggiungi(origine, messaggi, nomi);
    if (r.piena) {
      estrazione.storico_rifiutati += messaggi.length - r.accettati;
      registro("coda_piena", { rifiutati: messaggi.length - r.accettati });
    }
  }

  /** Avvolge un ascolto: ignora i socket vecchi e non lascia scappare errori. */
  function ascolta(sock, g, nome, f) {
    sock.ev.on(nome, async (dati) => {
      if (g !== generazione || fermato) return;
      try {
        await f(dati);
      } catch {
        registro("evento_fallito", { [nome.replace(/[^a-z]/g, "_")]: 1 });
      }
    });
  }

  /** Ascolta i nodi `message` grezzi (sola lettura, guasto 2). L'ascolto non
   *  lancia mai: un errore qui dentro cadrebbe dentro Baileys. Restituisce la
   *  promessa (l'`EventEmitter` la ignora, le prove la aspettano). */
  function ascoltaNodi(sock, g, f) {
    if (typeof sock.ws?.on !== "function") return registro("nodi_non_ascoltati");
    sock.ws.on("CB:message", async (nodo) => {
      if (g !== generazione || fermato) return;
      try {
        await f(nodo);
      } catch {
        registro("nodo_fallito");
      }
    });
  }

  function sposta_auth() {
    const quando = iso(orologio()).slice(0, 19).replace(/:/g, "-");
    let dest = `${percorsi.auth}.scollegato-${quando}`;
    for (let i = 2; existsSync(dest); i++) dest = `${percorsi.auth}.scollegato-${quando}-${i}`;
    if (existsSync(percorsi.auth)) renameSync(percorsi.auth, dest);
    mkdirSync(percorsi.auth, { recursive: true, mode: 0o700 });
    rmSync(percorsi.lid, { force: true });
    mappa = {};
  }

  function riprova(ms) {
    if (fermato) return;
    attesa = pianifica(() => {
      attesa = null;
      return apri();
    }, ms);
  }

  async function chiusura(dati) {
    const codice = codiceChiusura(dati?.lastDisconnect);
    const d = decidi(codice, storia, casuale);
    storia = d.storia;
    registro("chiusura", { codice: codice ?? 0, attesa_s: Math.round(d.attesaMs / 1000) });
    if (d.scollega) {
      try {
        sposta_auth();
      } catch {
        registro("auth_non_spostata");
      }
    }
    cambia({ stato: d.stato, collegato_dal: null });
    if (d.notifica) await qr.notifica(d.stato);
    riprova(d.attesaMs);
  }

  async function apri() {
    if (fermato) return;
    const g = ++generazione;
    try {
      mkdirSync(percorsi.auth, { recursive: true, mode: 0o700 });
      const { state, saveCreds } = await baileys.useMultiFileAuthState(percorsi.auth);
      if (g !== generazione || fermato) return;
      const questo = baileys.makeWASocket({
        auth: state,
        browser: baileys.Browsers.macOS("Desktop"),
        syncFullHistory: true,
        markOnlineOnConnect: false,
        logger: LOGGER_MUTO,
        getMessage: async () => undefined,
      });
      sock = questo;

      ascolta(questo, g, "creds.update", () => saveCreds());

      ascolta(questo, g, "connection.update", async (u) => {
        if (u?.qr) {
          stato.storico = { fatto: false, avanzamento: 0 };
          cambia({ stato: "attesa_qr" });
          await qr.mostra(u.qr);
        }
        if (u?.connection === "open") {
          storia = { ...STORIA_VUOTA };
          proprioNumero = cifreDaJid(questo.user?.id);
          proprioLid = typeof questo.user?.lid === "string" ? questo.user.lid : null;
          qr.togli();
          registro("collegato");
          cambia({ stato: "collegato", collegato_dal: iso(orologio()) });
        } else if (u?.connection === "close") {
          generazione++; // da qui gli eventi di questo socket non contano più
          await chiusura(u);
        }
      });

      ascolta(questo, g, "messaging-history.set", async (h) => {
        const lista = Array.isArray(h?.messages) ? h.messages : [];
        if (Array.isArray(h?.lidPnMappings)) aggiornaLid(h.lidPnMappings);
        await preparaLid(questo, lista);
        const { messaggi, nomi } = estrai(lista, storicoDal);
        // il nome della rubrica (o quello dei contatti dello storico) vince sul pushName
        const tutti = { ...nomi, ...nomiDaContatti(h?.contacts, risolutoreLid(mappa)) };
        metti("storico", messaggi, tutti);
        if (Number.isFinite(h?.progress)) stato.storico = { fatto: h.progress >= 100, avanzamento: Math.max(0, Math.min(100, Math.round(h.progress))) };
        registro("storico", { letti: lista.length, validi: messaggi.length });
        avvisa();
      });

      ascolta(questo, g, "messaging-history.status", (st) => {
        if (st?.status === "complete") cambia({ storico: { fatto: true, avanzamento: 100 } });
      });

      ascolta(questo, g, "messages.upsert", async (u) => {
        const lista = Array.isArray(u?.messages) ? u.messages : [];
        await preparaLid(questo, lista);
        const { messaggi, nomi } = estrai(lista);
        metti("vivo", messaggi, nomi);
        avvisa();
      });

      ascolta(questo, g, "lid-mapping.update", (voce) => aggiornaLid(Array.isArray(voce) ? voce : [voce]));

      ascoltaNodi(questo, g, async (nodo) => {
        const tipo = nonDisponibile(nodo);
        if (!tipo) return;
        conta(diagnosi.nodi, tipo);
        if (tipo !== "hosted_unavailable_fanout") return;
        const n = messaggioDaNodo(nodo, { proprioNumero, proprioLid });
        if (n.motivo) {
          conta(diagnosi.scarti, n.motivo);
          return;
        }
        await preparaLid(questo, [n.wamsg]);
        const { messaggi } = estrai([n.wamsg]);
        estrazione.invii_nascosti += messaggi.length;
        metti("vivo", messaggi, {});
        avvisa();
      });
    } catch {
      // chiavi illeggibili, Baileys che non parte: si riprova come per la rete
      registro("apertura_fallita");
      if (g !== generazione) return;
      const d = decidi(null, storia, casuale);
      storia = d.storia;
      cambia({ stato: d.stato });
      riprova(d.attesaMs);
    }
  }

  return {
    avvia: () => apri(),
    /** Chiude il socket e non riconnette più (SIGTERM). Non scollega il
     *  dispositivo: la sessione resta valida per il prossimo avvio. */
    ferma() {
      fermato = true;
      if (attesa) annulla(attesa);
      attesa = null;
      try {
        sock?.end(undefined);
      } catch {
        registro("chiusura_fallita");
      }
      stato.stato = "fermo";
    },
    istantanea: () => ({
      ...stato,
      storico: { ...stato.storico },
      estrazione: { ...estrazione },
      diagnosi: { scarti: { ...diagnosi.scarti }, tipi: { ...diagnosi.tipi }, nodi: { ...diagnosi.nodi } },
    }),
  };
}
