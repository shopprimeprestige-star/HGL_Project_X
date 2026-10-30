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
  c("vocale (ptt) con la durata", { testo: "🎤 Vocale 0:07", tipo: "vocale" }, solo(wa({ audioMessage: { ptt: true, seconds: 7 } })));
  c("vocale senza durata", { testo: "🎤 Vocale", tipo: "vocale" }, solo(wa({ audioMessage: { ptt: true } })));
  c("audio non vocale", { testo: "🎤 Vocale", tipo: "audio" }, solo(wa({ audioMessage: { ptt: false } })));
  //  La durata del vocale (T6, 30/10): «🎤 Vocale 0:12». Il vocale NON si scarica: è solo il segnaposto.
  const vocale = (seconds, extra = {}) => solo(wa({ audioMessage: { ptt: true, seconds, ...extra } })).testo;
  c("vocale di 12 secondi → «🎤 Vocale 0:12»", "🎤 Vocale 0:12", vocale(12));
  c("vocale di 75 secondi → 1:15; di 60 → 1:00; di 59 → 0:59", ["🎤 Vocale 1:15", "🎤 Vocale 1:00", "🎤 Vocale 0:59"], [vocale(75), vocale(60), vocale(59)]);
  c("vocale di un'ora → 60:00; di 3725 secondi → 62:05; di 59999 → 999:59", ["🎤 Vocale 60:00", "🎤 Vocale 62:05", "🎤 Vocale 999:59"], [vocale(3600), vocale(3725), vocale(59999)]);
  c("durata come Long, come stringa di cifre, con decimali", ["🎤 Vocale 0:12", "🎤 Vocale 0:12", "🎤 Vocale 0:12"], [vocale(long(12)), vocale("12"), vocale(12.9)]);
  c("durata assente, zero, negativa, enorme, non numerica → solo «🎤 Vocale»", Array(8).fill("🎤 Vocale"), [vocale(undefined), vocale(0), vocale(-3), vocale(60000), vocale("abc"), vocale(Number.NaN), vocale({}), vocale(null)]);
  c("anche l'audio non vocale porta la durata", { testo: "🎤 Vocale 0:30", tipo: "audio" }, solo(wa({ audioMessage: { ptt: false, seconds: 30 } })));
  c("vocale dentro un effimero: la durata c'è", "🎤 Vocale 0:05", solo(wa({ ephemeralMessage: { message: { audioMessage: { ptt: true, seconds: 5 } } } })).testo);
  const anteprima = mod["chatwa/media"]?.mediaInAnteprima;
  c("la chat riconosce il vocale con la durata (anteprima: icona e «Vocale 0:12»)", [{ tipo: "audio", testo: "Vocale 0:12" }, { tipo: "audio", testo: "Vocale" }], [anteprima?.(vocale(12)), anteprima?.(vocale(undefined))]);
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
  //  I modelli (guasto 2): il testo con la marca «📋 », così la chat li
  //  riconosce e l'abbinamento a un `[template:…]` del CRM vale solo per loro.
  const P = mod["ponte/pari"];
  c("marca e segnaposto dei modelli copiati da pari.ts", [P.MARCA_MODELLO, P.MODELLO_NASCOSTO], [E.MARCA_MODELLO, E.MODELLO_NASCOSTO]);
  const MN = "📋 Modello inviato (testo non visibile)";
  c("il segnaposto del modello è quello chiesto dal titolare", MN, E.MODELLO_NASCOSTO);
  c("modello con bottoni (hydratedTemplate)", { testo: "📋 Ti aspettiamo domani", tipo: "testo" }, solo(wa({ templateMessage: { hydratedTemplate: { hydratedContentText: "Ti aspettiamo domani" } } })));
  c("modello a quattro righe (hydratedFourRowTemplate)", { testo: "📋 Promemoria: domani alle 10", tipo: "testo" }, solo(wa({ templateMessage: { hydratedFourRowTemplate: { hydratedTitleText: "Titolo", hydratedContentText: "Promemoria: domani alle 10" } } })));
  c("modello interattivo (interactiveMessageTemplate.body.text)", { testo: "📋 Confermi l'appuntamento?", tipo: "testo" }, solo(wa({ templateMessage: { interactiveMessageTemplate: { header: { title: "HGL" }, body: { text: "Confermi l'appuntamento?" } } } })));
  c("modello: solo il titolo → il titolo", { testo: "📋 Solo titolo", tipo: "testo" }, solo(wa({ templateMessage: { hydratedTemplate: { hydratedTitleText: "Solo titolo" } } })));
  c("modello dentro un modello strutturato (fourRowTemplate.content.hydratedHsm)", { testo: "📋 Dentro", tipo: "testo" }, solo(wa({ templateMessage: { fourRowTemplate: { content: { hydratedHsm: { hydratedTemplate: { hydratedContentText: "Dentro" } } } } } })));
  c("modello senza testo leggibile → segnaposto del modello", { testo: MN, tipo: "altro" }, solo(wa({ templateMessage: { hydratedTemplate: {} } }, { fromMe: true })));
  c("interactiveMessage (body.text)", { testo: "📋 Scegli un orario", tipo: "testo" }, solo(wa({ interactiveMessage: { body: { text: "Scegli un orario" }, footer: { text: "HGL" } } })));
  c("interactiveMessage senza testo → segnaposto del modello", { testo: MN, tipo: "altro" }, solo(wa({ interactiveMessage: {} })));
  c("buttonsMessage (contentText)", { testo: "📋 Vuoi confermare?", tipo: "testo" }, solo(wa({ buttonsMessage: { contentText: "Vuoi confermare?", footerText: "HGL" } })));
  c("listMessage (description, poi title)", [{ testo: "📋 Gli orari liberi", tipo: "testo" }, { testo: "📋 Orari", tipo: "testo" }], [solo(wa({ listMessage: { title: "Orari", description: "Gli orari liberi" } })), solo(wa({ listMessage: { title: "Orari" } }))]);
  c("highlyStructuredMessage con hydratedHsm leggibile", { testo: "📋 Ciao, ti aspettiamo", tipo: "testo" }, solo(wa({ highlyStructuredMessage: { namespace: "x", elementName: "promemoria_1", params: ["Maria"], hydratedHsm: { hydratedTemplate: { hydratedContentText: "Ciao, ti aspettiamo" } } } })));
  c("highlyStructuredMessage senza testo leggibile → segnaposto (mai il nome del modello né i parametri)", { testo: MN, tipo: "altro" }, solo(wa({ highlyStructuredMessage: { namespace: "x", elementName: "promemoria_1", params: ["Maria"] } }, { fromMe: true })));
  c("placeholderMessage (nascosto ai dispositivi collegati) → segnaposto del modello", { testo: MN, tipo: "altro" }, solo(wa({ placeholderMessage: { type: 0 } }, { fromMe: true })));
  c("un modello uscito è out come gli altri", ["out", "sent"], [leggi(wa({ placeholderMessage: { type: 0 } }, { fromMe: true })).messaggio?.dir, leggi(wa({ placeholderMessage: { type: 0 } }, { fromMe: true })).messaggio?.stato]);
  c("risposta a un bottone porta il testo scelto, senza marca", { testo: "Confermo", tipo: "testo" }, solo(wa({ buttonsResponseMessage: { selectedDisplayText: "Confermo" } })));
  c("risposta a una lista senza marca", { testo: "Sabato", tipo: "testo" }, solo(wa({ listResponseMessage: { title: "Sabato" } })));
  c("tipo che non conosciamo → segnaposto «Allegato», mai buttato (messaggi persi 30/10)", { testo: "📎 Allegato", tipo: "altro" }, solo(wa({ nuovoTipoDelDomani: {} })));

  //  Le immagini da scaricare (T6): `immagineDa` dà chiave, orario e `imageMessage`; la validazione dell'origine è di immagini.mjs.
  const IMG = { mimetype: "image/jpeg", mediaKey: new Uint8Array(32), directPath: "/v/t62/x.enc", url: "https://mmg.whatsapp.net/v/t62/x.enc", fileLength: 4000 };
  const daFoto = (m, o = {}, k = {}, altro = {}) => E.immagineDa(wa(m, k, altro), { ...opz, ...o });
  const f1 = daFoto({ imageMessage: IMG });
  c("immagineDa: chiave bw:<cifre>:<id>, orario del messaggio, e l'imageMessage così com'è", ["bw:393330000001:3EB0AA01", TS, true], [f1?.chiave, f1?.ts, f1?.immagine === IMG]);
  c("immagineDa: la chiave è quella del contratto (tipi.ts)", T.chiaveMessaggio(CLIENTE, "3EB0AA01"), f1?.chiave);
  c("immagineDa: coincide con il messaggio che leggiMessaggio manda al CRM", [leggi(wa({ imageMessage: IMG })).messaggio.id, leggi(wa({ imageMessage: IMG })).messaggio.numero], [f1.chiave.split(":")[2], f1.chiave.split(":")[1]]);
  c("immagineDa: anche una foto mandata da noi (fromMe)", "bw:393330000001:3EB0AA01", daFoto({ imageMessage: IMG }, {}, { fromMe: true })?.chiave);
  c("immagineDa: dentro un messaggio effimero", true, daFoto({ ephemeralMessage: { message: { imageMessage: IMG } } })?.immagine === IMG);
  c("immagineDa: dentro un album (figlio)", true, daFoto({ associatedChildMessage: { message: { imageMessage: IMG } } })?.immagine === IMG);
  c("immagineDa: chat con un LID risolto → le cifre del numero", `bw:${CLIENTE}:3EB0AA01`, daFoto({ imageMessage: IMG }, { risolviLid: () => CLIENTE }, { remoteJid: "555@lid" })?.chiave);
  c("immagineDa: LID non risolto → niente (come leggiMessaggio)", null, daFoto({ imageMessage: IMG }, {}, { remoteJid: "555@lid" }));
  c("immagineDa: gruppo, stato, se stessi → niente", [null, null, null], [daFoto({ imageMessage: IMG }, {}, { remoteJid: "120363000000000000@g.us" }), daFoto({ imageMessage: IMG }, {}, { remoteJid: "status@broadcast" }), daFoto({ imageMessage: IMG }, {}, { remoteJid: `${NOI}@s.whatsapp.net` })]);
  c("immagineDa: «visualizza una volta» NON si scarica (v1, v2, v2 extension, flag, dentro un effimero)", [null, null, null, null, null], [daFoto({ viewOnceMessage: { message: { imageMessage: IMG } } }), daFoto({ viewOnceMessageV2: { message: { imageMessage: IMG } } }), daFoto({ viewOnceMessageV2Extension: { message: { imageMessage: IMG } } }), daFoto({ imageMessage: { ...IMG, viewOnce: true } }), daFoto({ ephemeralMessage: { message: { viewOnceMessageV2: { message: { imageMessage: IMG } } } } })]);
  c("immagineDa: video, sticker, vocale, documento, testo → niente", [null, null, null, null, null], [daFoto({ videoMessage: {} }), daFoto({ stickerMessage: {} }), daFoto({ audioMessage: { ptt: true } }), daFoto({ documentMessage: {} }), daFoto({ conversation: "ciao" })]);
  c("immagineDa: messaggio non decifrato, senza orario, senza id, vuoto → niente", [null, null, null, null], [E.immagineDa(wa(null, {}, { messageStubType: 2 }), opz), daFoto({ imageMessage: IMG }, {}, {}, { messageTimestamp: undefined }), E.immagineDa({ key: { remoteJid: JID, id: "a b" }, messageTimestamp: TS, message: { imageMessage: IMG } }, opz), E.immagineDa(null, opz)]);
  c("immagineDa: più vecchio del taglio STORICO_GIORNI → niente", null, daFoto({ imageMessage: IMG }, { dal: TS + 1 }));
  c("immagineDa: un url ostile passa così com'è (lo ferma validaOrigine, non l'estrazione)", "http://127.0.0.1/x", daFoto({ imageMessage: { ...IMG, url: "http://127.0.0.1/x" } })?.immagine.url);
  c("la foto resta «📷 Foto» per il CRM (il segnaposto non cambia)", { testo: "📷 Foto", tipo: "foto" }, solo(wa({ imageMessage: IMG })));

  //  Le etichette sono quelle che la chat sa già disegnare (media.ts).
  const media = readFileSync(join(radice, "src/crm/chatwa/media.ts"), "utf8");
  const blocco = media.match(/const ETICHETTE[^{]*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  const etichette = Object.fromEntries([...blocco.matchAll(/(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
  c(
    "segnaposto uguali a ETICHETTE di media.ts (la chat toglie l'emoja davanti)",
    [etichette.immagine, etichette.audio, etichette.video, etichette.documento, etichette.allegato],
    [E.SEGNAPOSTO.foto, E.SEGNAPOSTO.vocale, E.SEGNAPOSTO.video, E.SEGNAPOSTO.documento, E.SEGNAPOSTO.sticker]
      .map((t) => t.replace(/^\p{Extended_Pictographic}\uFE0F?\s+/u, "")),
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

  //  Diagnosi (guasto 2): il tipo grezzo di Baileys e i nodi senza contenuto,
  //  solo come codici [a-z_] buoni per il log e il battito.
  c(
    "codice: camelCase → parole minuscole con _, cifre e simboli via",
    ["extended_text_message", "poll_creation_message_v", "hosted_unavailable_fanout", "sconosciuto", "sconosciuto"],
    [E.codice("extendedTextMessage"), E.codice("pollCreationMessageV3"), E.codice("hosted_unavailable_fanout"), E.codice(""), E.codice(null)],
  );
  c("codice: al più 40 caratteri", true, E.codice("a".repeat(100)).length <= 40);
  c(
    "tipoGrezzo: il tipo dopo gli involucri, senza il contorno",
    ["conversation", "template_message", "placeholder_message", "stub", "vuoto", "vuoto"],
    [
      E.tipoGrezzo(wa({ messageContextInfo: {}, conversation: "x" })),
      E.tipoGrezzo(wa({ ephemeralMessage: { message: { templateMessage: {} } } })),
      E.tipoGrezzo(wa({ placeholderMessage: { type: 0 } })),
      E.tipoGrezzo(wa(undefined, {}, { messageStubType: 2 })),
      E.tipoGrezzo(wa(undefined)),
      E.tipoGrezzo(null),
    ],
  );
  const nodo = (figli) => ({ tag: "message", attrs: { id: "3EB0AA09", from: `${NOI}@s.whatsapp.net`, recipient: JID, t: String(TS) }, content: figli });
  c(
    "nonDisponibile: il tipo di <unavailable>, oppure null",
    ["hosted_unavailable_fanout", "view_once_unavailable_fanout", "senza_tipo", null, null, null],
    [
      E.nonDisponibile(nodo([{ tag: "unavailable", attrs: { type: "hosted_unavailable_fanout" } }])),
      E.nonDisponibile(nodo([{ tag: "unavailable", attrs: { type: "view_once_unavailable_fanout" } }])),
      E.nonDisponibile(nodo([{ tag: "unavailable", attrs: {} }])),
      E.nonDisponibile(nodo([{ tag: "enc", attrs: { type: "msg" } }])),
      E.nonDisponibile(nodo(new Uint8Array(3))),
      E.nonDisponibile(undefined),
    ],
  );

  //  L'invio fatto dall'API (ManyChat) che arriva senza contenuto (guasto 2):
  //  dal nodo grezzo solo id, destinatario e orario, mai altro.
  c("il segnaposto dell'invio nascosto è copiato da pari.ts", P.INVIO_NASCOSTO, E.INVIO_NASCOSTO);
  c("il segnaposto dell'invio nascosto è quello chiesto dal titolare", "📋 Messaggio inviato da ManyChat (testo non visibile)", E.INVIO_NASCOSTO);
  const LID_NOI = "88880000000001";
  const ospitato = [{ tag: "unavailable", attrs: { type: "hosted_unavailable_fanout" } }];
  const nodoOsp = (attrs, figli = ospitato) => ({ tag: "message", attrs: { id: "3EB0FF01", from: `${NOI}:99@s.whatsapp.net`, recipient: JID, t: String(TS), type: "text", ...attrs }, content: figli });
  const dalNodo = (n, o = {}) => {
    const d = E.messaggioDaNodo(n, { proprioNumero: NOI, proprioLid: `${LID_NOI}:0@lid`, ...o });
    if (d.motivo) return { scarto: d.motivo };
    const r = leggi(d.wamsg);
    return r.ok ? r.messaggio : { scarto: r.motivo };
  };
  c(
    "nodo ospitato uscito da noi → MessaggioPonte out con il segnaposto",
    { id: "3EB0FF01", numero: CLIENTE, dir: "out", ts: TS, testo: E.INVIO_NASCOSTO, tipo: "altro", stato: "sent" },
    dalNodo(nodoOsp({})),
  );
  c("mittente @hosted o @lid nostro → è nostro", [CLIENTE, CLIENTE], [dalNodo(nodoOsp({ from: `${NOI}:99@hosted` })).numero, dalNodo(nodoOsp({ from: `${LID_NOI}:99@hosted.lid` })).numero]);
  c("destinatario @lid con recipient_pn → il numero", CLIENTE, dalNodo(nodoOsp({ recipient: "123456789012345@lid", recipient_pn: JID })).numero);
  c("destinatario @lid risolto con la mappa", CLIENTE, (() => {
    const d = E.messaggioDaNodo(nodoOsp({ recipient: "123456789012345@lid" }), { proprioNumero: NOI });
    return E.leggiMessaggio(d.wamsg, { ...opz, risolviLid: E.risolutoreLid({ "123456789012345": CLIENTE }) }).messaggio?.numero;
  })());
  c("destinatario @lid sconosciuto → senza_numero (mai inventato)", { scarto: "senza_numero" }, dalNodo(nodoOsp({ recipient: "123456789012345@lid" })));
  c("nodo ospitato di un altro (non da noi) → scartato", { scarto: "fanout_non_nostro" }, dalNodo(nodoOsp({ from: JID, recipient: undefined })));
  c("nodo ospitato senza destinatario → scartato", { scarto: "fanout_non_nostro" }, dalNodo(nodoOsp({ recipient: undefined })));
  c("nodo ospitato in un gruppo → scartato", { scarto: "gruppo" }, dalNodo(nodoOsp({ from: "120363000000000001@g.us", participant: `${NOI}@s.whatsapp.net`, recipient: undefined })));
  c("nodo con altro <unavailable> (view once) → non è un invio nascosto", { scarto: "non_ospitato" }, dalNodo(nodoOsp({}, [{ tag: "unavailable", attrs: { type: "view_once_unavailable_fanout" } }])));
  c("nodo con il contenuto (enc) → non è un invio nascosto", { scarto: "non_ospitato" }, dalNodo(nodoOsp({}, [{ tag: "enc", attrs: {} }])));
  c("nodo ospitato senza orario → orario_non_valido", { scarto: "orario_non_valido" }, dalNodo(nodoOsp({ t: undefined })));
  c("nodo ospitato con id non valido → id_non_valido", { scarto: "id_non_valido" }, dalNodo(nodoOsp({ id: "a b" })));
  c("nodo senza attrs o non oggetto → non_ospitato, nessun errore", [{ scarto: "non_ospitato" }, { scarto: "fanout_non_nostro" }], [dalNodo(null), dalNodo({ tag: "message", content: ospitato })]);
  c("il messaggio finto del nodo non ha testo né message", [undefined, "invio_nascosto"], [E.messaggioDaNodo(nodoOsp({}), { proprioNumero: NOI }).wamsg.message, E.tipoGrezzo(E.messaggioDaNodo(nodoOsp({}), { proprioNumero: NOI }).wamsg)]);
  c("un WAMessage vero senza message resta vuoto (il segno non si può falsificare dal proto)", { scarto: "vuoto" }, solo(wa(undefined, {}, { invioNascosto: true })));

  //  Le cifre del JID, la regola unica.
  c("cifreDaJid", [CLIENTE, CLIENTE, null, null], [E.cifreDaJid(JID), E.cifreDaJid(`${CLIENTE}:7@s.whatsapp.net`), E.cifreDaJid("123@lid"), E.cifreDaJid(undefined)]);
}
