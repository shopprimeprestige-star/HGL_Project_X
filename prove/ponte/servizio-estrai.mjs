/** ── PROVE: IL SERVIZIO SUL MAC: DA WAMessage A MessaggioPonte ──
 *
 *  File d'area della commessa 2026-10-29-ponte-whatsapp-baileys, compito T5.
 *  Prova `strumenti/ponte-whatsapp/src/estrai.mjs` (PIANO §a6, §b2, §b4) con
 *  `WAMessage` scritti a mano: nessuna rete, nessun Baileys vero.
 *  I contratti stanno in `src/crm/ponte/tipi.ts` (`mod["ponte/tipi"]`).
 *  Dati inventati: nessun numero né nome vero (prefisso 39 333 000…).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const NOI = "393330009999";
const CLIENTE = "393330000001";
const JID = `${CLIENTE}@s.whatsapp.net`;
/** 29/10/2026 12:00 UTC, in secondi: l'«adesso» finto delle prove. */
const ADESSO = Date.UTC(2026, 9, 29, 12, 0, 0) / 1000;
const TS = ADESSO - 3600;

/** Un `WAMessage` finto: le chiavi come le dà Baileys 7. */
function wa(message, key = {}, altro = {}) {
  return { key: { remoteJid: JID, fromMe: false, id: "3EB0AA01", ...key }, messageTimestamp: TS, message, ...altro };
}

/** `Long` di protobufjs: `{ low, high, unsigned }` con `toNumber()`. */
function long(n) {
  return { low: n >>> 0, high: Math.floor(n / 2 ** 32), unsigned: true, toNumber: () => n };
}

export async function provePonteServizioEstrai(mod, { c, gruppo, radice }) {
  const E = await import(pathToFileURL(join(radice, "strumenti/ponte-whatsapp/src/estrai.mjs")).href);
  const T = mod["ponte/tipi"];
  const opz = { proprioNumero: NOI, adesso: ADESSO, risolviLid: () => null };
  const leggi = (m, o = {}) => E.leggiMessaggio(m, { ...opz, ...o });
  const solo = (m, o) => {
    const r = leggi(m, o);
    return r.ok ? { testo: r.messaggio.testo, tipo: r.messaggio.tipo } : { scarto: r.motivo };
  };

  gruppo("PONTE WHATSAPP · IL SERVIZIO: ESTRAZIONE (compito T5)");
  c("i limiti copiati nel servizio sono quelli di tipi.ts", [T.LIMITI.testo, T.LIMITI.nome, T.LIMITI.tsOltreMinuti, T.TS_MINIMO], [E.LIMITI_ESTRAZIONE.testo, E.LIMITI_ESTRAZIONE.nome, E.LIMITI_ESTRAZIONE.tsOltreMinuti, E.LIMITI_ESTRAZIONE.tsMinimo]);

  //  Il testo, nelle due forme.
  const t = leggi(wa({ conversation: "Ciao, avete posto sabato?" }, {}, { pushName: "Cliente Prova" }));
  c("testo semplice → MessaggioPonte del §b2", { ok: true, messaggio: { id: "3EB0AA01", numero: CLIENTE, dir: "in", ts: TS, testo: "Ciao, avete posto sabato?", tipo: "testo" }, nome: "Cliente Prova" }, t);
  c("il messaggio ha solo i campi di MessaggioPonte", true, Object.keys(t.messaggio ?? {}).every((k) => ["id", "numero", "dir", "ts", "testo", "tipo", "stato"].includes(k)));
  c("extendedTextMessage", { testo: "Sì, alle 10", tipo: "testo" }, solo(wa({ extendedTextMessage: { text: "Sì, alle 10", contextInfo: { stanzaId: "X" } } })));
  c("testo di soli spazi → scartato", { scarto: "vuoto" }, solo(wa({ conversation: "   " })));
  c("testo oltre 4000 caratteri → tagliato a 4000", T.LIMITI.testo, leggi(wa({ conversation: "a".repeat(5000) }))?.messaggio?.testo.length);
  c("il taglio non lascia mezza coppia surrogata", false, /[\ud800-\udbff]$/.test(leggi(wa({ conversation: "a".repeat(3999) + "😀😀" }))?.messaggio?.testo));
  c("le chiavi di contorno (messageContextInfo) non contano", { testo: "Ok", tipo: "testo" }, solo(wa({ messageContextInfo: { deviceListMetadata: {} }, conversation: "Ok" })));

  //  I media diventano segnaposto (§b4).
  c("foto senza didascalia", { testo: "📷 Foto", tipo: "foto" }, solo(wa({ imageMessage: { mimetype: "image/jpeg", url: "https://mmg.whatsapp.net/x" } })));
  c("foto con didascalia", { testo: "📷 Foto: il mio colore", tipo: "foto" }, solo(wa({ imageMessage: { caption: "il mio colore" } })));
  c("vocale (ptt)", { testo: "🎤 Vocale", tipo: "vocale" }, solo(wa({ audioMessage: { ptt: true, seconds: 7 } })));
  c("audio non vocale", { testo: "🎤 Vocale", tipo: "audio" }, solo(wa({ audioMessage: { ptt: false } })));
  c("video con didascalia", { testo: "🎥 Video: prima e dopo", tipo: "video" }, solo(wa({ videoMessage: { caption: "prima e dopo" } })));
  c("gif → video", { testo: "🎥 Video", tipo: "video" }, solo(wa({ videoMessage: { gifPlayback: true } })));
  c("documento con nome", { testo: "📎 Documento: listino.pdf", tipo: "documento" }, solo(wa({ documentMessage: { fileName: "listino.pdf", mimetype: "application/pdf" } })));
  c("documento senza nome", { testo: "📎 Documento", tipo: "documento" }, solo(wa({ documentMessage: {} })));
  c("documento con didascalia (involucro)", { testo: "📎 Documento: listino.pdf: ecco i prezzi", tipo: "documento" }, solo(wa({ documentWithCaptionMessage: { message: { documentMessage: { fileName: "listino.pdf", caption: "ecco i prezzi" } } } })));
  c("sticker", { testo: "📎 Allegato", tipo: "sticker" }, solo(wa({ stickerMessage: { isAnimated: false } })));
  c("posizione", { testo: "📍 Posizione", tipo: "posizione" }, solo(wa({ locationMessage: { degreesLatitude: 45, degreesLongitude: 9 } })));
  c("posizione in tempo reale", { testo: "📍 Posizione", tipo: "posizione" }, solo(wa({ liveLocationMessage: {} })));
  c("contatto", { testo: "👤 Contatto", tipo: "contatto" }, solo(wa({ contactMessage: { displayName: "X", vcard: "BEGIN:VCARD" } })));
  c("più contatti", { testo: "👤 Contatto", tipo: "contatto" }, solo(wa({ contactsArrayMessage: { contacts: [] } })));
  c("un modello con bottoni porta il suo testo", { testo: "Ti aspettiamo domani", tipo: "testo" }, solo(wa({ templateMessage: { hydratedTemplate: { hydratedContentText: "Ti aspettiamo domani" } } })));
  c("risposta a un bottone porta il testo scelto", { testo: "Confermo", tipo: "testo" }, solo(wa({ buttonsResponseMessage: { selectedDisplayText: "Confermo" } })));
  c("messaggio interattivo senza testo → altro", { testo: "📎 Allegato", tipo: "altro" }, solo(wa({ interactiveMessage: {} })));
  c("tipo che non conosciamo → scartato, mai inventato", { scarto: "tipo_sconosciuto" }, solo(wa({ nuovoTipoDelDomani: {} })));

  //  Le etichette sono quelle che la chat sa già disegnare (media.ts).
  const media = readFileSync(join(radice, "src/crm/chatwa/media.ts"), "utf8");
  const blocco = media.match(/const ETICHETTE[^{]*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  const etichette = Object.fromEntries([...blocco.matchAll(/(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
  c(
    "segnaposto uguali a ETICHETTE di media.ts",
    [etichette.immagine, etichette.audio, etichette.video, etichette.documento, etichette.allegato],
    [E.SEGNAPOSTO.foto, E.SEGNAPOSTO.vocale, E.SEGNAPOSTO.video, E.SEGNAPOSTO.documento, E.SEGNAPOSTO.sticker],
  );
  c("ETICHETTE di media.ts lette davvero (5 voci)", 5, Object.keys(etichette).length);
  c("ogni tipo del ponte è un TipoContenuto", true, Object.keys(E.SEGNAPOSTO).every((x) => T.TIPI_CONTENUTO.includes(x)));

  //  Gli involucri si aprono.
  c("effimero aperto", { testo: "Ci vediamo", tipo: "testo" }, solo(wa({ ephemeralMessage: { message: { conversation: "Ci vediamo" } } })));
  c("visualizza una volta aperto", { testo: "📷 Foto", tipo: "foto" }, solo(wa({ viewOnceMessage: { message: { imageMessage: {} } } })));
  c("visualizza una volta v2 dentro effimero", { testo: "🎥 Video", tipo: "video" }, solo(wa({ ephemeralMessage: { message: { viewOnceMessageV2: { message: { videoMessage: {} } } } } })));

  //  L'orario: numero, Long, stringa; niente fusi.
  c("messageTimestamp come numero", TS, leggi(wa({ conversation: "x" }))?.messaggio?.ts);
  c("messageTimestamp come Long", TS, leggi(wa({ conversation: "x" }, {}, { messageTimestamp: long(TS) }))?.messaggio?.ts);
  c("messageTimestamp come Long senza toNumber", TS, leggi(wa({ conversation: "x" }, {}, { messageTimestamp: { low: TS, high: 0, unsigned: true } }))?.messaggio?.ts);
  c("messageTimestamp come stringa di cifre", TS, leggi(wa({ conversation: "x" }, {}, { messageTimestamp: String(TS) }))?.messaggio?.ts);
  const oraLegale = Date.UTC(2026, 9, 25, 1, 0, 0) / 1000;
  c("cambio dell'ora legale (25/10/2026 01:00 UTC): stesso numero", oraLegale, leggi(wa({ conversation: "x" }, {}, { messageTimestamp: oraLegale }))?.messaggio?.ts);
  c("ts negativo → scartato", { scarto: "orario_non_valido" }, solo(wa({ conversation: "x" }, {}, { messageTimestamp: -5 })));
  c("ts assente → scartato", { scarto: "orario_non_valido" }, solo(wa({ conversation: "x" }, {}, { messageTimestamp: undefined })));
  c("ts prima del 2009 → scartato", { scarto: "orario_non_valido" }, solo(wa({ conversation: "x" }, {}, { messageTimestamp: T.TS_MINIMO - 1 })));
  c("ts nel futuro oltre 10 minuti → scartato", { scarto: "orario_futuro" }, solo(wa({ conversation: "x" }, {}, { messageTimestamp: ADESSO + 11 * 60 })));
  c("ts nel futuro entro 10 minuti → passa", "testo", solo(wa({ conversation: "x" }, {}, { messageTimestamp: ADESSO + 9 * 60 })).tipo);
  c("STORICO_GIORNI: prima del taglio → scartato", { scarto: "troppo_vecchio" }, solo(wa({ conversation: "x" }), { dal: TS + 1 }));
  c("STORICO_GIORNI = 0 (dal assente): tutto passa", "testo", solo(wa({ conversation: "x" }, {}, { messageTimestamp: T.TS_MINIMO + 10 })).tipo);

  //  La direzione e lo stato.
  const fuori = leggi(wa({ conversation: "Grazie a lei" }, { fromMe: true }, { pushName: "Noi", status: 4 }));
  c("fromMe → out, stato read, nessun nome (il nome è il nostro)", { dir: "out", stato: "read", nome: undefined }, { dir: fuori.messaggio?.dir, stato: fuori.messaggio?.stato, nome: fuori.nome });
  c("stato 3 → delivered", "delivered", leggi(wa({ conversation: "x" }, { fromMe: true }, { status: 3 }))?.messaggio?.stato);
  c("stato 0 (default del proto, non sappiamo) → sent", "sent", leggi(wa({ conversation: "x" }, { fromMe: true }, { status: 0 }))?.messaggio?.stato);
  c("stato assente → sent", "sent", leggi(wa({ conversation: "x" }, { fromMe: true }))?.messaggio?.stato);
  c("un messaggio in non porta stato", false, "stato" in (leggi(wa({ conversation: "x" }, {}, { status: 3 })).messaggio ?? { stato: 1 }));
  c("pushName oltre 80 caratteri → tagliato", 80, leggi(wa({ conversation: "x" }, {}, { pushName: "N".repeat(120) })).nome?.length);

  //  Il numero: JID pieno, dispositivo, @lid.
  c("JID con suffisso di dispositivo (:12) ripulito", CLIENTE, leggi(wa({ conversation: "x" }, { remoteJid: `${CLIENTE}:12@s.whatsapp.net` }))?.messaggio?.numero);
  const lid = "123456789012345@lid";
  c("@lid risolto con remoteJidAlt", CLIENTE, leggi(wa({ conversation: "x" }, { remoteJid: lid, remoteJidAlt: `${CLIENTE}@s.whatsapp.net` }))?.messaggio?.numero);
  const mappa = E.aggiornaMappaLid({}, [{ lid: "123456789012345:3@lid", pn: `${CLIENTE}:3@s.whatsapp.net` }]);
  c("la mappa LID→numero tiene solo le cifre", { "123456789012345": CLIENTE }, mappa);
  c("@lid risolto con la mappa", CLIENTE, leggi(wa({ conversation: "x" }, { remoteJid: lid }), { risolviLid: E.risolutoreLid(mappa) })?.messaggio?.numero);
  c("@lid non risolvibile → scartato senza_numero", { scarto: "senza_numero" }, solo(wa({ conversation: "x" }, { remoteJid: lid })));
  c("risolviLid che restituisce spazzatura → senza_numero", { scarto: "senza_numero" }, solo(wa({ conversation: "x" }, { remoteJid: lid }), { risolviLid: () => "abc@lid" }));
  c("la mappa ignora voci senza cifre", {}, E.aggiornaMappaLid({}, [{ lid: "x@lid", pn: "pippo" }, null, { lid: "1@lid" }]));
  c("numero troppo corto → senza_numero", { scarto: "senza_numero" }, solo(wa({ conversation: "x" }, { remoteJid: "1234@s.whatsapp.net" })));

  //  Solo chat individuali.
  c("gruppo @g.us → scartato", { scarto: "gruppo" }, solo(wa({ conversation: "x" }, { remoteJid: "120363000000000001@g.us", participant: JID })));
  c("status@broadcast → scartato", { scarto: "stato_whatsapp" }, solo(wa({ conversation: "x" }, { remoteJid: "status@broadcast" })));
  c("lista @broadcast → scartata", { scarto: "broadcast" }, solo(wa({ conversation: "x" }, { remoteJid: "1700000000@broadcast" })));
  c("canale @newsletter → scartato", { scarto: "canale" }, solo(wa({ conversation: "x" }, { remoteJid: "120363000000000002@newsletter" })));
  c("chat con sé stessi → scartata", { scarto: "se_stesso" }, solo(wa({ conversation: "x" }, { remoteJid: `${NOI}:4@s.whatsapp.net`, fromMe: true })));
  c("remoteJid assente → scartato", { scarto: "senza_numero" }, solo(wa({ conversation: "x" }, { remoteJid: undefined })));
  c("id non valido → scartato", { scarto: "id_non_valido" }, solo(wa({ conversation: "x" }, { id: "a b" })));
  c("id oltre 128 caratteri → scartato", { scarto: "id_non_valido" }, solo(wa({ conversation: "x" }, { id: "A".repeat(129) })));

  //  Quello che non è un messaggio da mostrare.
  c("message assente → scartato", { scarto: "vuoto" }, solo(wa(undefined)));
  c("reazione → scartata", { scarto: "reazione" }, solo(wa({ reactionMessage: { text: "❤️", key: {} } })));
  c("modifica → scartata", { scarto: "modifica" }, solo(wa({ editedMessage: { message: { protocolMessage: { type: 14, editedMessage: { conversation: "nuovo" } } } } })));
  c("cancellazione per tutti → scartata", { scarto: "cancellazione" }, solo(wa({ protocolMessage: { type: 0, key: {} } })));
  c("cancellazione col nome dell'enum → scartata", { scarto: "cancellazione" }, solo(wa({ protocolMessage: { type: "REVOKE" } })));
  c("impostazione dei messaggi effimeri → scartata", { scarto: "protocollo" }, solo(wa({ protocolMessage: { type: 3 } })));
  c("sondaggio → scartato", { scarto: "sondaggio" }, solo(wa({ pollCreationMessageV3: { name: "?" } })));
  c("chiamata → scartata", { scarto: "chiamata" }, solo(wa({ callLogMesssage: {} })));
  c("messaggio di sistema (messageStubType) → scartato", { scarto: "sistema" }, solo(wa(undefined, {}, { messageStubType: 20 })));
  c("sistema anche con un message accanto", { scarto: "sistema" }, solo(wa({ conversation: "x" }, {}, { messageStubType: 1 })));
  c("chiave di sola distribuzione → scartata", { scarto: "sistema" }, solo(wa({ senderKeyDistributionMessage: {} })));
  c("un argomento non oggetto non fa cadere niente", { ok: false, scarto: true, motivo: "vuoto" }, E.leggiMessaggio(null, opz));

  //  I nomi dei contatti dello storico.
  const nomi = E.nomiDaContatti(
    [
      { id: JID, notify: "Cliente Prova" },
      { id: "393330000002@s.whatsapp.net", name: "Seconda Prova", notify: "SP" },
      { id: "123456789012345@lid", notify: "Da Lid" },
      { id: "120363000000000001@g.us", subject: "Gruppo" },
      { id: "393330000003@s.whatsapp.net" },
    ],
    E.risolutoreLid({ "123456789012345": "393330000004" }),
  );
  c("nomi dai contatti dello storico (name prima di notify, lid risolti, niente gruppi)", { [CLIENTE]: "Cliente Prova", "393330000002": "Seconda Prova", "393330000004": "Da Lid" }, nomi);

  //  Le cifre del JID, la regola unica.
  c("cifreDaJid", [CLIENTE, CLIENTE, null, null], [E.cifreDaJid(JID), E.cifreDaJid(`${CLIENTE}:7@s.whatsapp.net`), E.cifreDaJid("123@lid"), E.cifreDaJid(undefined)]);
}
