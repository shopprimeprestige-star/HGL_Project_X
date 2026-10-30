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
 *  MESSAGGI PERSI (commessa 2026-10-30-messaggi-persi). Baileys non sa
 *  «andare a prendere» i messaggi arrivati mentre il ponte era spento: li
 *  riceve da solo alla riconnessione (coda offline di WhatsApp, evento
 *  `messages.upsert` di tipo `append`, che qui passa come gli altri). I buchi
 *  veri sono altri e qui sono chiusi:
 *   · alla (ri)connessione Baileys tiene gli eventi in un buffer fino a 30 s
 *     (`CB:ib,,offline`) ma ha già confermato i messaggi a WhatsApp: fermare il
 *     socket in quella finestra li perde → `ferma()` aspetta lo scarico;
 *   · un messaggio non decifrabile (stub CIPHERTEXT) non ha testo: si scrive un
 *     segnaposto solo se il vero non arriva entro `ATTESA_NON_DECIFRATO_MS`
 *     (Baileys lo chiede al telefono, che di solito risponde in pochi secondi).
 *  ⚠️ UN SOLO PUNTO D'INVIO (commessa 2026-10-30-ponte-invio-manuale, T3).
 *   Il ponte nasce di sola lettura; adesso c'è UNA SOLA scrittura verso i
 *   clienti: `inviaTesto`, che manda un testo a mano a un numero già validato
 *   (`^\d{8,15}$`, JID `<cifre>@s.whatsapp.net`), con `{ text }` e nient'altro
 *   (niente citazioni, menzioni, media, anteprime). Il resto del socket resta
 *   di sola lettura: si chiamano soltanto `ev.on`, `ws.on` (ascolto dei nodi
 *   ricevuti), `end` e `signalRepository.lidMapping.getPNForLID`; mai una
 *   conferma di lettura, una presenza, un logout, un controllo `onWhatsApp`.
 *   Il socket si chiama sempre `sock` quando lo si usa (la guardia delle prove
 *   cerca le chiamate `sock.…(`); l'elenco ammesso e l'unicità dell'invio li
 *   controlla `prove/ponte/servizio-guardie.mjs`.
 *  ⚠️ Qui passano numeri, nomi e testi: nessun `console`, e al registro solo
 *   codici fissi e contatori.
 *  ───────────────────────────────────────────────────────────────────────── */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { aggiornaMappaLid, cifreDaJid, leggiMessaggio, messaggioDaNodo, nonDisponibile, nomiDaContatti, risolutoreLid, tipoGrezzo } from "./estrai.mjs";
import { codiceChiusura, decidi, STORIA_VUOTA } from "./riconnessione.mjs";

const muto = () => undefined;

/** Il JID del cliente da un numero di sole cifre (8-15), altrimenti null: un
 *  gruppo, un `@lid`, un `+39…` o un percorso non diventano mai un indirizzo. */
export function jidDaNumero(numero) {
  return typeof numero === "string" && /^\d{8,15}$/.test(numero) ? `${numero}@s.whatsapp.net` : null;
}

/** Quanto si aspetta il vero messaggio prima di scrivere il segnaposto «non
 *  leggibile» (il telefono risponde alla richiesta di Baileys in pochi secondi). */
export const ATTESA_NON_DECIFRATO_MS = 120_000;
/** Quanto aspetta `ferma()` che Baileys scarichi il buffer della connessione (30 s
 *  al massimo per lui; qui meno, perché launchd ci chiude dopo 20 s). */
export const ATTESA_SCARICO_MS = 6000;
/** Segnaposto in attesa al più; oltre, si scrivono subito (mai buttati). */
const MAX_NON_DECIFRATI = 200;
/** Quanto si aspetta Baileys dopo l'invio, poi «non so se è partito». */
const TEMPO_INVIO_MS = 30_000;
/** Messaggi inviati tenuti in RAM per `getMessage` (mai su disco né nei log). */
const MEMORIA_INVIATI = 50;

/** I secondi UNIX di `messageTimestamp` (numero o Long), o null. */
function secondiDi(x) {
  const n = typeof x?.toNumber === "function" ? x.toNumber() : Number(x);
  return Number.isInteger(n) && n > 0 ? n : null;
}

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
 *   - `identita`: `Chrome` (di serie) o `Desktop`, da IDENTITA di config.env: il
 *     nome con cui il ponte si presenta al telefono (conta al QR nuovo);
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
  identita = "Chrome",
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
  /** vero solo dopo l'attesa dello scarico in `ferma()`: da qui gli eventi non contano più */
  let spento = false;
  /** Baileys ha scaricato il buffer di questa connessione (`receivedPendingNotifications`) */
  let scaricato = false;
  let sbloccaScarico = null;
  /** gli ascolti in corso (per non chiudere il socket a metà di un messaggio) */
  const inCorso = new Set();
  /** `numero:idVero` → { timer, riga, nomi }: segnaposto in attesa del messaggio vero */
  const nonDecifrati = new Map();
  let proprioNumero = null;
  let proprioLid = null;
  /** gli ultimi messaggi inviati da noi, per `key.id`: `{ numero, message }`, solo in RAM */
  const inviati = new Map();
  const stato = {
    stato: "in_collegamento",
    collegato_dal: null,
    ultimo_messaggio_il: null,
    // con una sessione già salvata lo storico è già arrivato una volta
    storico: existsSync(`${percorsi.auth}/creds.json`) ? { fatto: true, avanzamento: 100 } : { fatto: false, avanzamento: 0 },
  };
  const estrazione = { letti: 0, validi: 0, chat: 0, lid_risolti: 0, lid_errori: 0, storico_rifiutati: 0, invii_nascosti: 0, non_decifrati: 0, non_decifrati_arrivati: 0 };
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

  /** Un messaggio non decifrabile: il segnaposto si scrive tra `ATTESA_NON_DECIFRATO_MS`
   *  se il vero (stesso id di WhatsApp) non è arrivato. Mai buttato: con troppi in
   *  attesa si scrive subito. Non lancia. */
  function aspettaVero({ messaggio, nome, idVero }) {
    const k = `${messaggio.numero}:${idVero}`;
    if (nonDecifrati.has(k)) return;
    const scrivi = () => {
      nonDecifrati.delete(k);
      try {
        estrazione.non_decifrati++;
        metti("vivo", [messaggio], nome ? { [messaggio.numero]: nome } : {});
        avvisa();
      } catch {
        registro("evento_fallito", { non_decifrato: 1 });
      }
    };
    if (nonDecifrati.size >= MAX_NON_DECIFRATI) return scrivi();
    nonDecifrati.set(k, { timer: pianifica(scrivi, ATTESA_NON_DECIFRATO_MS), scrivi });
  }

  /** Il messaggio vero è arrivato: il segnaposto non serve più. */
  function veroArrivato(messaggio) {
    const k = `${messaggio.numero}:${messaggio.id}`;
    const voce = nonDecifrati.get(k);
    if (!voce) return;
    annulla(voce.timer);
    nonDecifrati.delete(k);
    estrazione.non_decifrati_arrivati++;
    conta(diagnosi.scarti, "non_decifrato_arrivato"); // nel log: quanti stub si sono risolti da soli
  }

  /** WAMessage[] → `{ messaggi, nomi }` validi, contando gli scarti per motivo.
   *  `vivo`: i non decifrati dei messaggi in arrivo ora aspettano il vero. */
  function estrai(lista, dal, vivo = false) {
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
        if (vivo && r.segnaposto) aspettaVero(r.segnaposto);
        continue;
      }
      if (nonDecifrati.size) veroArrivato(r.messaggio);
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

  /** Avvolge un ascolto: ignora i socket vecchi e non lascia scappare errori.
   *  Tiene il conto degli ascolti in corso, così `ferma()` non chiude a metà. */
  function ascolta(sock, g, nome, f) {
    sock.ev.on(nome, async (dati) => {
      if (g !== generazione || spento) return;
      const corsa = (async () => {
        try {
          await f(dati);
        } catch {
          registro("evento_fallito", { [nome.replace(/[^a-z]/g, "_")]: 1 });
        }
      })();
      inCorso.add(corsa);
      try {
        await corsa;
      } finally {
        inCorso.delete(corsa);
      }
    });
  }

  /** Ascolta i nodi `message` grezzi (sola lettura, guasto 2). L'ascolto non
   *  lancia mai: un errore qui dentro cadrebbe dentro Baileys. Restituisce la
   *  promessa (l'`EventEmitter` la ignora, le prove la aspettano). */
  function ascoltaNodi(sock, g, f) {
    if (typeof sock.ws?.on !== "function") return registro("nodi_non_ascoltati");
    sock.ws.on("CB:message", async (nodo) => {
      if (g !== generazione || spento) return;
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
      //  Errore 428 al primo collegamento (29/10/2026): la versione di WhatsApp Web
      //  dentro Baileys era vecchia e il server chiudeva prima del QR. Si chiede la
      //  versione attuale; se la richiesta fallisce si usa quella di Baileys.
      let versione;
      if (typeof baileys.fetchLatestWaWebVersion === "function") {
        try {
          const r = await baileys.fetchLatestWaWebVersion({});
          if (Array.isArray(r?.version)) versione = r.version;
        } catch {
          versione = undefined;
        }
      }
      if (g !== generazione || fermato) return;
      const questo = baileys.makeWASocket({
        ...(versione ? { version: versione } : {}),
        auth: state,
        browser: baileys.Browsers.macOS(identita),
        syncFullHistory: true,
        //  Tutte le chat (30/10/2026): il default di Baileys scarta la sincronizzazione FULL
        //  (`syncType !== FULL`), l'unica che porta lo storico di TUTTE le chat. Si accetta ogni
        //  tipo; la coda del Mac regge anche un FULL molto più grande del primo giro (lotti.mjs).
        //  L'identità è quella di IDENTITA in config.env (di serie «Mac Chrome»; «Desktop» è
        //  l'ipotesi del README di Baileys per ricevere più storico: se dà 428 si torna a Chrome).
        shouldSyncHistoryMessage: () => true,
        markOnlineOnConnect: false,
        logger: LOGGER_MUTO,
        //  Baileys lo chiede per rimandare un messaggio che il destinatario non
        //  ha saputo decifrare: si rende solo ciò che abbiamo inviato noi.
        //  Solo per la stessa chat e solo per un messaggio NOSTRO: stesso id con un
        //  altro destinatario (o `fromMe` falso) non rende niente.
        getMessage: async (chiave) => {
          const voce = inviati.get(chiave?.id);
          if (!voce || chiave?.fromMe !== true) return undefined;
          const numero = cifreDaJid(chiave.remoteJid) ?? risolutoreLid(mappa)(chiave.remoteJid);
          return numero === voce.numero ? voce.message : undefined;
        },
      });
      sock = questo;
      scaricato = false;

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
          sbloccaScarico?.(); // chiuso: non c'è più niente da aspettare
          await chiusura(u);
        }
        //  Baileys ha consegnato tutto quello che aveva in buffer dalla connessione.
        if (u?.receivedPendingNotifications === true) {
          scaricato = true;
          sbloccaScarico?.();
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
        //  `tipo` = syncType del telefono (un numero: 2 = FULL); se non è un numero non si scrive
        registro("storico", { letti: lista.length, validi: messaggi.length, ...(Number.isFinite(h?.syncType) ? { tipo: h.syncType } : {}) });
        avvisa();
      });

      ascolta(questo, g, "messaging-history.status", (st) => {
        if (st?.status === "complete") cambia({ storico: { fatto: true, avanzamento: 100 } });
      });

      ascolta(questo, g, "messages.upsert", async (u) => {
        const lista = Array.isArray(u?.messages) ? u.messages : [];
        await preparaLid(questo, lista);
        const { messaggi, nomi } = estrai(lista, undefined, true);
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

  /** Manda un testo a mano al cliente. Non lancia mai. Risultato: `{ ok:true,
   *  id, ts }`, oppure `{ ok:false, motivo }` con `numero_non_valido`,
   *  `testo_non_valido`, `non_collegato` (certo: non è partito) o
   *  `esito_incerto` (eccezione, 30 s senza risposta, nessun id: forse è
   *  partito; non si riprova mai da soli). */
  async function inviaTesto(numero, testo) {
    const jid = jidDaNumero(numero);
    if (!jid) return { ok: false, motivo: "numero_non_valido" };
    if (typeof testo !== "string" || !testo) return { ok: false, motivo: "testo_non_valido" };
    if (stato.stato !== "collegato" || !sock || fermato) return { ok: false, motivo: "non_collegato" };
    let tempo = null;
    try {
      const scaduto = new Promise((_, no) => {
        tempo = pianifica(() => no(new Error("tempo")), TEMPO_INVIO_MS);
      });
      const r = await Promise.race([sock.sendMessage(jid, { text: testo }), scaduto]);
      const id = r?.key?.id;
      if (typeof id !== "string" || !id) return { ok: false, motivo: "esito_incerto" };
      inviati.set(id, { numero, message: r.message ?? { conversation: testo } });
      if (inviati.size > MEMORIA_INVIATI) inviati.delete(inviati.keys().next().value);
      return { ok: true, id, ts: secondiDi(r.messageTimestamp) ?? Math.floor(orologio() / 1000) };
    } catch {
      return { ok: false, motivo: "esito_incerto" };
    } finally {
      if (tempo !== null) annulla(tempo);
    }
  }

  return {
    avvia: () => apri(),
    inviaTesto,
    /** Chiude il socket e non riconnette più (SIGTERM). Non scollega il
     *  dispositivo: la sessione resta valida per il prossimo avvio. Subito
     *  `fermato` (niente invii, niente riconnessioni); il socket si chiude
     *  però solo dopo lo scarico del buffer di Baileys (al massimo
     *  `ATTESA_SCARICO_MS`) e dopo gli ascolti in corso: i messaggi arrivati
     *  mentre il ponte era spento sono già confermati a WhatsApp e, chiusi
     *  prima, andrebbero persi. I segnaposto «non leggibile» ancora in attesa
     *  si scrivono subito in fila. Senza aspetti (non collegato) è sincrona. */
    async ferma() {
      fermato = true;
      if (attesa) annulla(attesa);
      attesa = null;
      if (sock && stato.stato === "collegato" && !scaricato) {
        await new Promise((ok) => {
          const t = pianifica(ok, ATTESA_SCARICO_MS);
          sbloccaScarico = () => {
            annulla(t);
            ok();
          };
        });
        sbloccaScarico = null;
      }
      if (inCorso.size) await Promise.allSettled([...inCorso]);
      spento = true;
      for (const [, voce] of [...nonDecifrati]) {
        annulla(voce.timer);
        voce.scrivi();
      }
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
