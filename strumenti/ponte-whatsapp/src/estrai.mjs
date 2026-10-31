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
 *   - l'orario è `messageTimestamp` in secondi UNIX, senza conversioni di fuso;
 *   - MAI scartare in silenzio un messaggio del cliente (commessa
 *     2026-10-30-messaggi-persi): un contenuto che non conosciamo diventa il
 *     segnaposto «📎 Allegato»; un messaggio che WhatsApp non ha saputo
 *     decifrare per questo Mac (stub CIPHERTEXT) dà `motivo: "non_decifrato"`
 *     con un `segnaposto` pronto, che `collega.mjs` scrive solo se il vero
 *     messaggio non arriva entro pochi minuti. Si scartano soltanto cose che
 *     non sono messaggi (reazioni, modifiche, cancellazioni, sondaggi,
 *     chiamate, album-contenitore, sistema).
 *
 *  ⚠️ Qui passano testi e numeri dei clienti: nessun `console.*` in questo file.
 *   I motivi di scarto sono parole fisse, buone per i contatori dei log.
 *  ───────────────────────────────────────────────────────────────────────── */

import { normalizzaMime } from "./firma.mjs";

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

/** Copie di `MARCA_MODELLO` e `MODELLO_NASCOSTO` di `src/crm/ponte/pari.ts`
 *  (le prove confrontano i valori): il testo dei modelli comincia con la
 *  marca, così l'abbinamento a un `[template:…]` del CRM vale solo per loro. */
export const MARCA_MODELLO = "📋 ";
export const MODELLO_NASCOSTO = "📋 Modello inviato (testo non visibile)";
/** Copia di `INVIO_NASCOSTO` di `pari.ts`: l'invio dall'API arrivato senza
 *  contenuto (`hosted_unavailable_fanout`). */
export const INVIO_NASCOSTO = "📋 Messaggio inviato da ManyChat (testo non visibile)";
/** Copia di `NON_DECIFRATO` di `pari.ts` (le prove confrontano i valori): una
 *  riga in entrata del ponte che dice «WhatsApp ha consegnato qualcosa che
 *  questo Mac non ha potuto leggere». Si abbina a qualunque entrata vicina. */
export const NON_DECIFRATO = "⚠️ Messaggio non leggibile dal ponte: aprilo sul telefono";
/** Il suffisso dell'id del segnaposto: se il vero messaggio arriva dopo
 *  (stesso id di WhatsApp) non trova la riga già occupata. */
export const SUFFISSO_NON_DECIFRATO = "-nd";
/** Il segno del messaggio finto fatto da `messaggioDaNodo`: un simbolo, che un
 *  `WAMessage` vero (decodificato dal proto) non può avere. */
const SEGNO_INVIO_NASCOSTO = Symbol("invio_nascosto");

/** `proto.WebMessageInfo.StubType.CIPHERTEXT` (il proto è un enum numerico). */
const STUB_CIPHERTEXT = 2;
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
  //  i figli di un album (foto/video) arrivano così: dentro c'è il media vero
  "associatedChildMessage",
];

/** Chiavi di contorno che stanno accanto al contenuto vero e non lo sono. */
const CONTORNO = new Set(["messageContextInfo", "senderKeyDistributionMessage", "fastRatchetKeySenderKeyDistributionMessage", "deviceSentMessage"]);

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
  //  l'intestazione di un album: i figli (foto, video) arrivano da soli
  albumMessage: "album",
  //  carichi cifrati di reazioni, voti e commenti; sincronizzazioni interne
  secretEncryptedMessage: "sistema",
  encCommentMessage: "sistema",
  encEventResponseMessage: "sistema",
  stickerSyncRmrMessage: "sistema",
  messageHistoryBundle: "sistema",
  messageHistoryNotice: "sistema",
  statusNotificationMessage: "sistema",
  limitSharingMessage: "sistema",
  pollResultSnapshotMessage: "sondaggio",
  pollCreationOptionImageMessage: "sondaggio",
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
/** Lo stesso convertitore, per chi legge altri campi interi del proto (peso, durata). */
export const interoDa = secondi;

/** Apre gli involucri (anche uno dentro l'altro, al più 5 livelli). Se si passa
 *  `visti` (una lista), ci si scrivono i nomi degli involucri attraversati. */
function apri(message, visti) {
  let m = message;
  for (let i = 0; i < 5 && m && typeof m === "object"; i++) {
    const inv = INVOLUCRI.find((k) => m[k]?.message);
    if (!inv) break;
    visti?.push(inv);
    m = m[inv].message;
  }
  return m;
}

/** La durata di un vocale come « m:ss» (con lo spazio davanti), oppure vuota se
 *  manca o non è credibile (zero, negativa, oltre 999:59). Mai un dato del mittente tale e quale. */
function durataVocale(seconds) {
  const n = secondi(seconds);
  if (n === null || n < 1 || n > 59_999) return "";
  return ` ${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

/** Il nome di un file senza i caratteri che girano il testo (U+202A–202E, U+2066–2069): «fattura‮fdp.exe» non si spaccia per un pdf. */
const senzaBidi = (x) => (typeof x === "string" ? x.replace(/[\u202a-\u202e\u2066-\u2069]/g, "") : x);
const conDidascalia = (base, didascalia) => (testoPieno(didascalia) ? `${base}: ${testoPieno(didascalia)}` : base);

/** Il testo leggibile di un `TemplateMessage` (anche quello dentro un
 *  `highlyStructuredMessage.hydratedHsm` o un `fourRowTemplate`). Mai il
 *  nome del modello né i parametri da soli: non sono il messaggio. */
function testoModello(v, livello = 0) {
  if (!v || typeof v !== "object" || livello > 3) return "";
  const h = v.hydratedTemplate ?? {};
  const q = v.hydratedFourRowTemplate ?? {};
  const i = v.interactiveMessageTemplate ?? {};
  const pieno = [h.hydratedContentText, q.hydratedContentText, i.body?.text, h.hydratedTitleText, q.hydratedTitleText, i.header?.title].map(testoPieno).find(Boolean);
  return pieno ?? testoStrutturato(v.fourRowTemplate?.content, livello + 1);
}

/** `highlyStructuredMessage`: leggibile solo se porta il modello idratato. */
const testoStrutturato = (v, livello = 0) => testoModello(v?.hydratedHsm, livello + 1);

/** I modelli (gli invii automatici escono così dal nostro numero): il testo
 *  con la marca, o il segnaposto se non c'è niente di leggibile. */
const MODELLI = {
  templateMessage: (v) => testoModello(v),
  highlyStructuredMessage: (v) => testoStrutturato(v),
  interactiveMessage: (v) => [v?.body?.text, v?.header?.title].map(testoPieno).find(Boolean) ?? "",
  buttonsMessage: (v) => [v?.contentText, v?.text].map(testoPieno).find(Boolean) ?? "",
  listMessage: (v) => [v?.description, v?.title].map(testoPieno).find(Boolean) ?? "",
  placeholderMessage: () => "",
};

/** Testo delle risposte ai bottoni e alle liste (le scrive il cliente): il
 *  primo testo pieno, se c'è. */
function testoInterattivo(tipo, v) {
  const candidati = {
    buttonsResponseMessage: [v?.selectedDisplayText],
    templateButtonReplyMessage: [v?.selectedDisplayText],
    listResponseMessage: [v?.title, v?.singleSelectReply?.selectedRowId],
    interactiveResponseMessage: [v?.body?.text],
  }[tipo];
  if (!candidati) return null;
  return candidati.map(testoPieno).find(Boolean) ?? "";
}

/** Le chiavi di contenuto di un `message` già aperto (senza il contorno). */
const chiaviContenuto = (m) => Object.keys(m).filter((k) => !CONTORNO.has(k) && m[k] != null);

/** Un nome qualunque (tipo del proto, attributo di un nodo) → codice per il
 *  log e il battito: parole minuscole separate da `_`, niente cifre né
 *  simboli, al più 40 caratteri (`extendedTextMessage` → `extended_text_message`). */
export function codice(x) {
  if (typeof x !== "string") return "sconosciuto";
  const c = x
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")
    .slice(0, 40)
    .replace(/^_+|_+$/g, "");
  return c || "sconosciuto";
}

/** Diagnosi: il tipo grezzo di un `WAMessage` (la prima chiave di contenuto
 *  dopo gli involucri), come codice. `stub` = messaggio di sistema o non
 *  decifrato; `vuoto` = niente contenuto. Mai il testo. */
export function tipoGrezzo(wamsg) {
  if (!wamsg || typeof wamsg !== "object") return "vuoto";
  if (wamsg[SEGNO_INVIO_NASCOSTO]) return "invio_nascosto";
  if (wamsg.messageStubType) return "stub";
  const m = apri(wamsg.message);
  if (!m || typeof m !== "object") return "vuoto";
  const chiavi = chiaviContenuto(m);
  return chiavi.length ? codice(chiavi[0]) : "vuoto";
}

/** Diagnosi: il tipo di `<unavailable type="…">` di un nodo `message` grezzo
 *  (WhatsApp non ha mandato il contenuto a questo dispositivo), come codice;
 *  `senza_tipo` se manca; null se il nodo ha il suo contenuto. Baileys 7
 *  scarta `hosted_unavailable_fanout` senza emettere niente. */
export function nonDisponibile(nodo) {
  const figli = Array.isArray(nodo?.content) ? nodo.content : [];
  const u = figli.find((f) => f?.tag === "unavailable");
  if (!u) return null;
  return typeof u.attrs?.type === "string" ? codice(u.attrs.type) : "senza_tipo";
}

/** La parte utente di un JID personale (anche `@hosted`, `@hosted.lid`), senza
 *  dispositivo, oppure null. */
function utenteDi(jid) {
  if (typeof jid !== "string") return null;
  const [utente, server] = jid.split("@");
  if (!["s.whatsapp.net", "c.us", "lid", "hosted", "hosted.lid"].includes(server)) return null;
  const u = (utente ?? "").split(":")[0];
  return /^\d+$/.test(u) ? u : null;
}

/** Da un nodo `message` grezzo con `<unavailable type="hosted_unavailable_fanout">`
 *  (un invio fatto dall'API, che Baileys scarta senza emettere niente) a un
 *  `WAMessage` finto da passare a `leggiMessaggio`: `{ wamsg }` oppure
 *  `{ motivo }`. Si leggono SOLO `id`, `from`, `recipient`, `recipient_pn` e
 *  `t`, come fa Baileys (`decodeMessageNode`): il mittente
 *  deve essere il nostro numero (o il nostro LID) e il destinatario è il
 *  cliente. Il testo non c'è e non si inventa: `leggiMessaggio` mette
 *  `INVIO_NASCOSTO`. `opzioni`: `proprioNumero` (JID o cifre), `proprioLid` (JID). */
export function messaggioDaNodo(nodo, opzioni = {}) {
  if (nonDisponibile(nodo) !== "hosted_unavailable_fanout") return { motivo: "non_ospitato" };
  const a = nodo.attrs ?? {};
  if (typeof a.from === "string" && a.from.endsWith("@g.us")) return { motivo: "gruppo" };
  const noi = [comeNumero(opzioni.proprioNumero ?? null), utenteDi(opzioni.proprioLid)].filter(Boolean);
  const mittente = utenteDi(a.from);
  if (!mittente || !noi.includes(mittente) || typeof a.recipient !== "string") return { motivo: "fanout_non_nostro" };
  const key = { remoteJid: a.recipient, fromMe: true, id: a.id };
  if (typeof a.recipient_pn === "string") key.remoteJidAlt = a.recipient_pn;
  return { wamsg: { key, messageTimestamp: a.t, [SEGNO_INVIO_NASCOSTO]: true } };
}

/** Il contenuto: `{ tipo, testo }` oppure `{ motivo }`. */
function contenuto(message) {
  const m = apri(message);
  if (!m || typeof m !== "object") return { motivo: "vuoto" };
  const chiavi = chiaviContenuto(m);
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
      //  «🎤 Vocale 0:12»: il vocale non si scarica, il segnaposto dice quanto dura
      return v?.ptt ? { tipo: "vocale", testo: `${SEGNAPOSTO.vocale}${durataVocale(v?.seconds)}` } : { tipo: "audio", testo: `${SEGNAPOSTO.audio}${durataVocale(v?.seconds)}` };
    case "videoMessage":
    case "ptvMessage":
      return { tipo: "video", testo: conDidascalia(SEGNAPOSTO.video, v?.caption) };
    case "documentMessage": {
      // «📎 Documento: <nome file>», poi la didascalia se c'è
      const conNome = conDidascalia(SEGNAPOSTO.documento, senzaBidi(v?.fileName ?? v?.title));
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
      if (MODELLI[tipo]) {
        const t = MODELLI[tipo](v);
        return t ? { tipo: "testo", testo: `${MARCA_MODELLO}${t}` } : { tipo: "altro", testo: MODELLO_NASCOSTO };
      }
      const t = testoInterattivo(tipo, v);
      //  Un tipo che non conosciamo (prodotto, ordine, evento, invito…) è quasi
      //  sempre qualcosa che il cliente ha mandato davvero: si mostra il segnaposto,
      //  non si butta. Le cose che NON sono messaggi stanno in `NON_DA_MOSTRARE`.
      //  Vale anche per un contenuto NOSTRO (`fromMe`) che non conosciamo, e per lo storico: una
      //  riga in uscita «📎 Allegato» è voluta (la chat deve mostrare che qualcosa è partito).
      //  Il tipo resta nel conteggio `tipi` della diagnosi (`tipoGrezzo`).
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
 *  messaggi `in` (in un `out` sarebbe il nostro). Con `motivo` `non_decifrato`
 *  c'è anche `segnaposto: { messaggio, nome?, idVero }`: la riga da scrivere se
 *  il messaggio vero non arriva (id = quello di WhatsApp + `-nd`). */
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
  if (wamsg.messageStubType) {
    //  Non decifrato (CIPHERTEXT): WhatsApp ha consegnato qualcosa a questo Mac
    //  che non si legge (sessione da rifare, annuncio «click to WhatsApp» senza
    //  contenuto). Baileys chiede il testo al telefono; se il telefono non
    //  risponde il messaggio non arriva mai. Qui si prepara il segnaposto.
    const cifrato = !key.fromMe && (wamsg.messageStubType === STUB_CIPHERTEXT || wamsg.messageStubType === "CIPHERTEXT");
    const ts = secondi(wamsg.messageTimestamp);
    const valido = typeof key.id === "string" && ID_VALIDO.test(key.id) && key.id.length + SUFFISSO_NON_DECIFRATO.length <= 128 && ts !== null && ts >= LIMITI_ESTRAZIONE.tsMinimo && ts <= adesso + LIMITI_ESTRAZIONE.tsOltreMinuti * 60 && !(typeof dal === "number" && ts < dal);
    if (!cifrato || !valido) return scarto("sistema");
    const messaggio = { id: `${key.id}${SUFFISSO_NON_DECIFRATO}`, numero: chat.numero, dir: "in", ts, testo: NON_DECIFRATO, tipo: "altro" };
    const nome = taglia(testoPieno(wamsg.pushName), LIMITI_ESTRAZIONE.nome);
    return { ok: false, scarto: true, motivo: "non_decifrato", segnaposto: nome ? { messaggio, nome, idVero: key.id } : { messaggio, idVero: key.id } };
  }
  if (typeof key.id !== "string" || !ID_VALIDO.test(key.id)) return scarto("id_non_valido");
  const cosa = wamsg[SEGNO_INVIO_NASCOSTO] ? { tipo: "altro", testo: INVIO_NASCOSTO } : contenuto(wamsg.message);
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

/** ── LE REVOCHE (commessa 2026-10-31, ponte-revoche) ─────────────────────────
 *  Un messaggio NOSTRO «eliminato per tutti» dal telefono deve sparire anche dalla chat del CRM;
 *  quello di un cliente no (richiesta del titolare). La cancellazione arriva in due forme, che
 *  Baileys rc14 emette per lo stesso fatto (`process-message.js`, caso REVOKE):
 *   · `messages.upsert`: il contenitore ha un `protocolMessage` REVOKE e la SUA `key`; il messaggio
 *     cancellato sta in `protocolMessage.key.id`;
 *   · `messages.update`: `key` = quella del contenitore con l'id del messaggio cancellato, e
 *     `update.messageStubType` REVOKE (1).
 *  Decide `key.fromMe === true` del CONTENITORE (cioè: l'ha fatta il nostro numero). La `key` dentro
 *  il `protocolMessage` ha il punto di vista di chi manda e non si usa. Il numero e il LID si ricavano
 *  come per ogni messaggio (`numeroDellaChat`), la chiave è quella di `chiaveMessaggio` (`bw:<cifre>:<id>`).
 *  Uscita: `{ ok: true, chiave }` oppure `{ ok: false, motivo }` (`non_revoca` = non è una cancellazione,
 *  `revoca_del_cliente`, `id_non_valido`, i motivi della chat, `se_stesso`). Non lancia mai. */
function chiaveDiRevoca(key, idRevocato, { proprioNumero, risolviLid } = {}) {
  if (key?.fromMe !== true) return { ok: false, motivo: "revoca_del_cliente" };
  if (typeof idRevocato !== "string" || !ID_VALIDO.test(idRevocato)) return { ok: false, motivo: "id_non_valido" };
  const chat = numeroDellaChat(key, risolviLid);
  if (chat.motivo) return { ok: false, motivo: chat.motivo };
  if (chat.numero === comeNumero(proprioNumero ?? null)) return { ok: false, motivo: "se_stesso" };
  return { ok: true, chiave: `bw:${chat.numero}:${idRevocato}` };
}

/** La forma `messages.upsert` (vedi sopra). */
export function revocaDa(wamsg, opzioni = {}) {
  const m = wamsg && typeof wamsg === "object" ? apri(wamsg.message) : null;
  const p = m && typeof m === "object" ? m.protocolMessage : null;
  if (!p || typeof p !== "object" || PROTOCOLLO[p.type] !== "cancellazione") return { ok: false, motivo: "non_revoca" };
  return chiaveDiRevoca(wamsg.key, p.key?.id, opzioni);
}

/** La forma `messages.update` (vedi sopra). */
export function revocaDaAggiornamento(voce, opzioni = {}) {
  const stub = voce?.update?.messageStubType;
  if (stub !== 1 && stub !== "REVOKE") return { ok: false, motivo: "non_revoca" };
  return chiaveDiRevoca(voce.key, voce.key?.id, opzioni);
}

/** Il tipo del messaggio (`leggiMessaggio`) → categoria dei media e chiave del proto che li porta
 *  (PIANO a.1). Il vocale e l'audio sono la stessa categoria. Sticker, posizioni, contatti e il
 *  videomessaggio rotondo (`ptvMessage`) non ci sono: restano segnaposto. */
const MEDIA_DEL_TIPO = {
  foto: ["foto", "imageMessage"],
  vocale: ["audio", "audioMessage"],
  audio: ["audio", "audioMessage"],
  video: ["video", "videoMessage"],
  documento: ["documento", "documentMessage"],
};

/** Il nome di un documento come arriva al catalogo e alla chat: via i caratteri di controllo, gli
 *  invisibili che girano il testo (U+202A–202E, U+2066–2069: «fattura‮fdp.exe» non si spaccia per un
 *  pdf), le barre `/` e `\`; spazi attorno tolti, al più 120 caratteri. Vuoto → null. */
function nomeDocumento(x) {
  if (typeof x !== "string") return null;
  const pulito = x.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069/\\]/g, "").trim();
  return taglia(pulito, 120) || null;
}

/** La miniatura JPEG di WhatsApp in base64, solo se è un JPEG piccolo (≤ 12.000 caratteri base64, come il
 *  CHECK della tabella), altrimenti null. */
function miniaturaDa(x) {
  if (!(x instanceof Uint8Array) || x.length < 4 || x.length > 9000 || x[0] !== 0xff || x[1] !== 0xd8 || x[2] !== 0xff) return null;
  return Buffer.from(x).toString("base64");
}

/** I dati di un media utili a ridisegnare la bolla e a decidere il permesso: nessun segreto qui dentro
 *  (la `mediaKey` e il `directPath` restano nel messaggio). Le voci che mancano non compaiono. */
function dettagliDi(categoria, media) {
  const d = {};
  const mime = normalizzaMime(categoria, media.mimetype);
  if (mime) d.mime = mime;
  const byte = interoDa(media.fileLength);
  if (byte !== null && byte > 0) d.byte = byte;
  if (categoria === "documento") {
    const nome = nomeDocumento(media.fileName) ?? nomeDocumento(media.title);
    if (nome) d.nome = nome;
  }
  if (categoria === "audio" || categoria === "video") {
    const durata = interoDa(media.seconds);
    if (durata !== null && durata > 0) d.durata_s = durata;
  }
  if (categoria === "foto" || categoria === "video") {
    const larghezza = interoDa(media.width);
    const altezza = interoDa(media.height);
    if (larghezza !== null && larghezza > 0) d.larghezza = larghezza;
    if (altezza !== null && altezza > 0) d.altezza = altezza;
  }
  if (categoria !== "audio") {
    const miniatura = miniaturaDa(media.jpegThumbnail);
    if (miniatura) d.miniatura = miniatura;
  }
  return d;
}

/** Da un `WAMessage` con un media vero (foto, audio/vocale, video, documento) a
 *  `{ chiave, ts, categoria, media, dettagli }` per il catalogo e la coda, oppure null. Passa da
 *  `leggiMessaggio` (stesse regole di chat, numero, orario e taglio), quindi la chiave `bw:<numero>:<id>`
 *  è quella con cui la riga di testo entra nel CRM. `media` è il messaggio del proto (`imageMessage`…)
 *  com'è: NON è controllato qui (origine, tipo e peso li controlla `immagini.mjs`, prima di ogni richiesta);
 *  `dettagli` = `{ mime?, byte?, nome?, durata_s?, larghezza?, altezza?, miniatura? }`, con il `mime`
 *  già normalizzato (assente se non è nell'elenco della categoria).
 *  Non si scarica: «visualizza una volta» (involucro `viewOnce*` o flag `viewOnce`) e un documento il cui
 *  mime non è un documento ammesso: un `documentMessage` con mime immagine è un SEGNAPOSTO, non una foto
 *  (la chiave di decifratura dipende dal tipo del messaggio, `document`, non dal mime). */
export function mediaDa(wamsg, opzioni = {}) {
  const r = leggiMessaggio(wamsg, opzioni);
  if (!r.ok) return null;
  const voce = MEDIA_DEL_TIPO[r.messaggio.tipo];
  if (!voce) return null;
  const [categoria, chiaveProto] = voce;
  const visti = [];
  const media = apri(wamsg.message, visti)?.[chiaveProto];
  if (!media || typeof media !== "object" || media.viewOnce === true || visti.some((k) => k.startsWith("viewOnce"))) return null;
  const dettagli = dettagliDi(categoria, media);
  if (categoria === "documento" && !dettagli.mime) return null;
  return { chiave: `bw:${r.messaggio.numero}:${r.messaggio.id}`, ts: r.messaggio.ts, categoria, media, dettagli };
}

/** Da un `WAMessage` con una foto vera a `{ chiave, ts, immagine }` per `immagini.mjs`, oppure null:
 *  `mediaDa` ristretta alle foto (stesse regole di sempre). `immagine` è l'`imageMessage` com'è. */
export function immagineDa(wamsg, opzioni = {}) {
  const m = mediaDa(wamsg, opzioni);
  return m?.categoria === "foto" ? { chiave: m.chiave, ts: m.ts, immagine: m.media } : null;
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
