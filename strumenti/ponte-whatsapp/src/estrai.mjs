/** ── PONTE WHATSAPP · DA WAMessage A MessaggioPonte ─────────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T5 (PIANO §a6, §b2, §b4).
 *  PURO: niente disco, niente rete, niente Baileys (le forme dei messaggi sono
 *  quelle di `WAMessage` di Baileys 7, lette come oggetti semplici). Così si
 *  prova con fixture scritte a mano (`prove/ponte/servizio-estrai.mjs`).
 *
 *  Le forme di uscita sono quelle di `src/crm/ponte/tipi.ts`:
 *   - `MessaggioPonte` = { id, numero, dir, ts, testo, tipo, stato? }
 *   - i nomi vanno in `LottoPonte.nomi` (cifre → nome).
 *
 *  Regole fisse (§a6):
 *   - solo chat individuali (`@s.whatsapp.net` o `@lid` risolto); gruppi,
 *     stati, liste broadcast, canali e la chat con sé stessi si scartano;
 *   - un `@lid` si risolve, in ordine, con `key.remoteJidAlt` e con
 *     `risolviLid` (mappa `lid.json` + `getPNForLID`, la prepara T6);
 *     altrimenti si scarta `senza_numero`: un numero non si inventa mai;
 *   - l'orario è `messageTimestamp` in secondi UNIX, senza conversioni di fuso.
 *
 *  ⚠️ Qui passano testi e numeri dei clienti: nessun `console.*` in questo file.
 *   I motivi di scarto sono parole fisse, buone per i contatori dei log.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Copie dei limiti di `src/crm/ponte/tipi.ts` (`LIMITI`, `TS_MINIMO`): il
 *  servizio è JavaScript senza build e non importa il TypeScript del CRM. Le
 *  prove confrontano i valori. */
export const LIMITI_ESTRAZIONE = {
  testo: 4000,
  nome: 80,
  tsOltreMinuti: 10,
  tsMinimo: 1230768000,
};

/** I segnaposto dei media (§b4): le prime cinque etichette sono quelle di
 *  `ETICHETTE` in `src/crm/chatwa/media.ts`, così la chat le disegna uguali. */
export const SEGNAPOSTO = {
  foto: "📷 Foto",
  vocale: "🎤 Vocale",
  video: "🎥 Video",
  documento: "📎 Documento",
  sticker: "📎 Allegato",
  audio: "🎤 Vocale",
  posizione: "📍 Posizione",
  contatto: "👤 Contatto",
  altro: "📎 Allegato",
};

const ID_VALIDO = /^[A-Za-z0-9_.-]{1,128}$/;
const NUMERO_VALIDO = /^\d{8,15}$/;

/** Gli involucri che si aprono: dentro c'è un altro `message`. */
const INVOLUCRI = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
  "editedMessage",
  "groupMentionedMessage",
  "botInvokeMessage",
];

/** Chiavi di contorno che stanno accanto al contenuto vero e non lo sono. */
const CONTORNO = new Set(["messageContextInfo", "senderKeyDistributionMessage", "deviceSentMessage"]);

/** Contenuti che non sono messaggi da mostrare: tipo → motivo dello scarto. */
const NON_DA_MOSTRARE = {
  reactionMessage: "reazione",
  encReactionMessage: "reazione",
  pollCreationMessage: "sondaggio",
  pollCreationMessageV2: "sondaggio",
  pollCreationMessageV3: "sondaggio",
  pollUpdateMessage: "sondaggio",
  call: "chiamata",
  bcallMessage: "chiamata",
  callLogMesssage: "chiamata",
  scheduledCallCreationMessage: "chiamata",
  scheduledCallEditMessage: "chiamata",
  keepInChatMessage: "sistema",
  pinInChatMessage: "sistema",
  requestPhoneNumberMessage: "sistema",
};

/** `protocolMessage.type` (enum del proto): 0 REVOKE, 14 MESSAGE_EDIT. */
const PROTOCOLLO = { 0: "cancellazione", REVOKE: "cancellazione", 14: "modifica", MESSAGE_EDIT: "modifica" };

/** `WebMessageInfo.status` → stato del §b2. Lo 0 (ERROR) NON diventa `failed`:
 *  è anche il valore di serie del proto quando lo stato non è scritto, e un
 *  `failed` sbagliato toglierebbe al messaggio la possibilità di avere un pari. */
const STATI = { 3: "delivered", 4: "read", 5: "read", DELIVERY_ACK: "delivered", READ: "read", PLAYED: "read" };

const scarto = (motivo) => ({ ok: false, scarto: true, motivo });
const testoPieno = (x) => (typeof x === "string" && x.trim() !== "" ? x.trim() : "");

/** Taglia a `n` unità senza lasciare mezza coppia surrogata in fondo. */
function taglia(testo, n) {
  if (testo.length <= n) return testo;
  const t = testo.slice(0, n);
  return /[\ud800-\udbff]$/.test(t) ? t.slice(0, -1) : t;
}

/** Le cifre di un JID personale (`393…@s.whatsapp.net`, anche `393…:12@…`),
 *  oppure null: un `@lid`, un gruppo o altro non sono un numero. */
export function cifreDaJid(jid) {
  if (typeof jid !== "string") return null;
  const [utente, server] = jid.split("@");
  if (server !== "s.whatsapp.net" && server !== "c.us") return null;
  const n = (utente ?? "").split(":")[0];
  return NUMERO_VALIDO.test(n) ? n : null;
}

/** La parte utente di un `@lid`, senza dispositivo (`123:3@lid` → `123`). */
function utenteLid(jid) {
  if (typeof jid !== "string" || !jid.endsWith("@lid")) return null;
  const u = jid.slice(0, -4).split(":")[0];
  return /^\d+$/.test(u) ? u : null;
}

/** Quello che restituisce un risolutore (un JID o già le cifre) → cifre o null. */
function comeNumero(x) {
  if (typeof x !== "string") return null;
  if (x.includes("@")) return cifreDaJid(x);
  return NUMERO_VALIDO.test(x) ? x : null;
}

/** Aggiunge alla mappa LID → cifre le voci `{ lid, pn }` di `lidPnMappings`
 *  (storico) e di `lid-mapping.update`. Restituisce una mappa nuova; le voci
 *  senza cifre si ignorano. La salva su disco T6 (`lid.json`). */
export function aggiornaMappaLid(mappa, voci) {
  const nuova = { ...(mappa ?? {}) };
  for (const v of Array.isArray(voci) ? voci : []) {
    const lid = utenteLid(v?.lid);
    const pn = comeNumero(v?.pn);
    if (lid && pn) nuova[lid] = pn;
  }
  return nuova;
}

/** Un `risolviLid` che legge la mappa; `altro` (facoltativo) è il ripiego
 *  sincrono di T6 (ad esempio una cache di `getPNForLID`). */
export function risolutoreLid(mappa, altro) {
  return (jid) => {
    const u = utenteLid(jid);
    if (u && mappa?.[u]) return mappa[u];
    return typeof altro === "function" ? altro(jid) : null;
  };
}

/** Il numero del cliente di una chat, oppure il motivo per cui non c'è. */
function numeroDellaChat(key, risolviLid) {
  const jid = key?.remoteJid;
  if (typeof jid !== "string" || !jid.includes("@")) return { motivo: "senza_numero" };
  if (jid === "status@broadcast") return { motivo: "stato_whatsapp" };
  const server = jid.split("@")[1];
  if (server === "g.us") return { motivo: "gruppo" };
  if (server === "broadcast") return { motivo: "broadcast" };
  if (server === "newsletter") return { motivo: "canale" };
  if (server === "lid") {
    const n = comeNumero(key.remoteJidAlt) ?? (typeof risolviLid === "function" ? comeNumero(risolviLid(jid)) : null);
    return n ? { numero: n } : { motivo: "senza_numero" };
  }
  const n = cifreDaJid(jid);
  return n ? { numero: n } : { motivo: "senza_numero" };
}

/** `messageTimestamp` (numero, `Long` di protobufjs, bigint o stringa) →
 *  secondi interi, oppure null. Nessuna conversione di fuso: è già UTC. */
function secondi(x) {
  let n = null;
  if (typeof x === "number") n = x;
  else if (typeof x === "bigint") n = Number(x);
  else if (typeof x === "string" && /^-?\d+$/.test(x)) n = Number(x);
  else if (x && typeof x === "object") {
    if (typeof x.toNumber === "function") n = x.toNumber();
    else if (typeof x.low === "number" && typeof x.high === "number") n = x.high * 2 ** 32 + (x.low >>> 0);
  }
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Apre gli involucri (anche uno dentro l'altro, al più 5 livelli). */
function apri(message) {
  let m = message;
  for (let i = 0; i < 5 && m && typeof m === "object"; i++) {
    const inv = INVOLUCRI.find((k) => m[k]?.message);
    if (!inv) break;
    m = m[inv].message;
  }
  return m;
}

const conDidascalia = (base, didascalia) => (testoPieno(didascalia) ? `${base}: ${testoPieno(didascalia)}` : base);

/** Testo dei modelli e delle risposte ai bottoni (gli invii automatici
 *  escono così dal nostro numero): il primo testo pieno, se c'è. */
function testoInterattivo(tipo, v) {
  const candidati = {
    templateMessage: [v?.hydratedTemplate?.hydratedContentText, v?.hydratedFourRowTemplate?.hydratedContentText],
    buttonsMessage: [v?.contentText, v?.text],
    interactiveMessage: [v?.body?.text],
    listMessage: [v?.description, v?.title],
    buttonsResponseMessage: [v?.selectedDisplayText],
    templateButtonReplyMessage: [v?.selectedDisplayText],
    listResponseMessage: [v?.title, v?.singleSelectReply?.selectedRowId],
    interactiveResponseMessage: [v?.body?.text],
  }[tipo];
  if (!candidati) return null;
  return candidati.map(testoPieno).find(Boolean) ?? "";
}

/** Il contenuto: `{ tipo, testo }` oppure `{ motivo }`. */
function contenuto(message) {
  const m = apri(message);
  if (!m || typeof m !== "object") return { motivo: "vuoto" };
  const chiavi = Object.keys(m).filter((k) => !CONTORNO.has(k) && m[k] != null);
  if (chiavi.length === 0) return { motivo: Object.keys(m).length ? "sistema" : "vuoto" };
  const tipo = chiavi[0];
  const v = m[tipo];

  if (tipo === "protocolMessage") return { motivo: PROTOCOLLO[v?.type] ?? "protocollo" };
  if (NON_DA_MOSTRARE[tipo]) return { motivo: NON_DA_MOSTRARE[tipo] };

  switch (tipo) {
    case "conversation":
      return testoPieno(v) ? { tipo: "testo", testo: testoPieno(v) } : { motivo: "vuoto" };
    case "extendedTextMessage":
      return testoPieno(v?.text) ? { tipo: "testo", testo: testoPieno(v.text) } : { motivo: "vuoto" };
    case "imageMessage":
      return { tipo: "foto", testo: conDidascalia(SEGNAPOSTO.foto, v?.caption) };
    case "audioMessage":
      return v?.ptt ? { tipo: "vocale", testo: SEGNAPOSTO.vocale } : { tipo: "audio", testo: SEGNAPOSTO.audio };
    case "videoMessage":
    case "ptvMessage":
      return { tipo: "video", testo: conDidascalia(SEGNAPOSTO.video, v?.caption) };
    case "documentMessage": {
      // «📎 Documento: <nome file>», poi la didascalia se c'è
      const conNome = conDidascalia(SEGNAPOSTO.documento, v?.fileName ?? v?.title);
      return { tipo: "documento", testo: conDidascalia(conNome, v?.caption) };
    }
    case "stickerMessage":
    case "lottieStickerMessage":
      return { tipo: "sticker", testo: SEGNAPOSTO.sticker };
    case "locationMessage":
    case "liveLocationMessage":
      return { tipo: "posizione", testo: SEGNAPOSTO.posizione };
    case "contactMessage":
    case "contactsArrayMessage":
      return { tipo: "contatto", testo: SEGNAPOSTO.contatto };
    default: {
      const t = testoInterattivo(tipo, v);
      if (t === null) return { motivo: "tipo_sconosciuto" };
      return t ? { tipo: "testo", testo: t } : { tipo: "altro", testo: SEGNAPOSTO.altro };
    }
  }
}

/** Da un `WAMessage` di Baileys a un `MessaggioPonte` (§b2).
 *
 *  `opzioni`:
 *   - `proprioNumero`: cifre (o JID) del nostro numero, per scartare la chat
 *     con sé stessi;
 *   - `risolviLid(jid)`: sincrono, restituisce un JID o le cifre, o null;
 *   - `adesso`: secondi UNIX (di serie l'orologio), per il limite +10 minuti;
 *   - `dal`: secondi UNIX, taglio di `STORICO_GIORNI` (assente = tutto).
 *
 *  Uscita: `{ ok: true, messaggio, nome? }` oppure
 *  `{ ok: false, scarto: true, motivo }`. `nome` è il `pushName` dei soli
 *  messaggi `in` (in un `out` sarebbe il nostro). */
export function leggiMessaggio(wamsg, opzioni = {}) {
  if (!wamsg || typeof wamsg !== "object") return scarto("vuoto");
  const { proprioNumero, risolviLid, dal } = opzioni;
  const adesso = opzioni.adesso ?? Math.floor(Date.now() / 1000);
  const key = wamsg.key ?? {};

  // 1. di chi è la chat
  const chat = numeroDellaChat(key, risolviLid);
  if (chat.motivo) return scarto(chat.motivo);
  const noi = comeNumero(proprioNumero ?? null);
  if (noi && chat.numero === noi) return scarto("se_stesso");

  // 2. che cosa c'è dentro
  if (wamsg.messageStubType) return scarto("sistema");
  if (typeof key.id !== "string" || !ID_VALIDO.test(key.id)) return scarto("id_non_valido");
  const cosa = contenuto(wamsg.message);
  if (cosa.motivo) return scarto(cosa.motivo);

  // 3. quando
  const ts = secondi(wamsg.messageTimestamp);
  if (ts === null || ts < LIMITI_ESTRAZIONE.tsMinimo) return scarto("orario_non_valido");
  if (ts > adesso + LIMITI_ESTRAZIONE.tsOltreMinuti * 60) return scarto("orario_futuro");
  if (typeof dal === "number" && ts < dal) return scarto("troppo_vecchio");

  const dir = key.fromMe ? "out" : "in";
  const messaggio = { id: key.id, numero: chat.numero, dir, ts, testo: taglia(cosa.testo, LIMITI_ESTRAZIONE.testo), tipo: cosa.tipo };
  if (dir === "out") messaggio.stato = STATI[wamsg.status] ?? "sent";

  const nome = dir === "in" ? taglia(testoPieno(wamsg.pushName), LIMITI_ESTRAZIONE.nome) : "";
  return nome ? { ok: true, messaggio, nome } : { ok: true, messaggio };
}

/** I nomi dai contatti dello storico (`messaging-history.set` → `contacts`):
 *  cifre → `name` (rubrica) o, se manca, `notify` (il nome che il cliente si
 *  è dato). I `@lid` passano da `risolviLid`; gruppi e altro si saltano. */
export function nomiDaContatti(contatti, risolviLid) {
  const nomi = {};
  for (const ct of Array.isArray(contatti) ? contatti : []) {
    const id = ct?.id;
    const n = cifreDaJid(id) ?? (utenteLid(id) && typeof risolviLid === "function" ? comeNumero(risolviLid(id)) : null);
    const nome = taglia(testoPieno(ct?.name) || testoPieno(ct?.notify), LIMITI_ESTRAZIONE.nome);
    if (n && nome) nomi[n] = nome;
  }
  return nomi;
}
