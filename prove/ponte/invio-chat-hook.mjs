/** ── PROVE: INVIO A MANO DAL PONTE · chat-hook (compito T6) ──
 *
 *  Commessa 2026-10-30-ponte-invio-manuale. I dati della chat: le parti pure di
 *  `src/crm/chatwa/invioPonte.ts` (chi può scrivere dal telefono, le bolle della
 *  coda, il conto dei messaggi restanti, ogni quanto si rilegge, la chiave del
 *  tentativo, la frase di un rifiuto) e il resto letto dal sorgente, come fa
 *  `banner.mjs`: `usaInvioPonte.ts`, `usaStatoPonte.ts`, `useChatWa.ts`.
 *  Dati inventati: nessun numero né nome vero, nessuna rete.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Parole che il titolare non deve mai leggere (le stesse delle frasi del ponte). */
const VIETATE = /\b(QR|Baileys|token|JID|LID|sessione|battito|server|database|API|socket|log|ponte)\b/i;

/** Il sorgente senza commenti: le prove sul testo non devono leggere la documentazione. */
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

export async function provePonteInvioChatHook(mod, { c, gruppo, radice }) {
  const P = mod["chatwa/invioPonte"];
  const T = mod["ponte/invio-tipi"];
  const L = T.LIMITI_INVIO;

  const ADESSO = new Date("2026-10-30T12:00:00.000Z");
  const SEC = 1000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const fa = (ms) => new Date(ADESSO.getTime() - ms).toISOString();
  const NUMERO = "393330000001";
  const ALTRO = "393330000002";

  const riga = (o = {}) => ({
    id: "11111111-1111-4111-8111-111111111111",
    chiave: "chiave-di-prova-0001",
    numero: NUMERO,
    testo: "Buongiorno",
    stato: "in_attesa",
    motivo: null,
    created_at: fa(5 * SEC),
    preso_il: null,
    inviato_il: null,
    wa_message_id: null,
    ...o,
  });
  const msg = (o = {}) => ({
    id: "m1",
    user_id: "u",
    lead_id: null,
    direction: "inbound",
    from_number: `+${NUMERO}`,
    to_number: "+390000000000",
    body: "Ciao",
    status: "received",
    wa_message_id: "wamid.1",
    error_message: null,
    created_at: fa(30 * HOUR),
    delivered_at: null,
    read_at: null,
    canale: "manychat",
    ...o,
  });
  const ponte = (o = {}) => ({
    stato: "collegato",
    aggiornato_il: fa(10 * SEC),
    storico: null,
    contatori: { invii_attivi: 1 },
    ...o,
  });

  /* ═══ unisciConCoda ═══ */
  gruppo("PONTE · INVIO A MANO · LA CODA NELLA CONVERSAZIONE (T4/T6)");
  const bolla = (o = {}) => ({
    id: "11111111-1111-4111-8111-111111111111",
    testo: "Buongiorno",
    fase: "in_attesa",
    quando: fa(5 * SEC),
    frase: "In invio dal telefono…",
    incerto: false,
    puoRiprovare: false,
    ...o,
  });
  const due = [msg({ id: "a", created_at: fa(3 * HOUR) }), msg({ id: "b", created_at: fa(1 * HOUR) })];
  c("coda vuota: gli stessi messaggi", due, P.unisciConCoda(due, []));
  const unito = P.unisciConCoda(due, [bolla()]);
  c("una bolla della coda dopo l'ultimo messaggio", ["a", "b", `${P.ID_CODA}${bolla().id}`], unito.map((m) => m.id));
  const fra = P.unisciConCoda(due, [bolla({ quando: fa(2 * HOUR) })]);
  c("una bolla fra due messaggi, per orario", ["a", `${P.ID_CODA}${bolla().id}`, "b"], fra.map((m) => m.id));
  const prima = P.unisciConCoda(due, [bolla({ quando: fa(4 * HOUR) })]);
  c("una bolla più vecchia di tutti va in testa", [`${P.ID_CODA}${bolla().id}`, "a", "b"], prima.map((m) => m.id));
  const copia = JSON.stringify(due);
  P.unisciConCoda(due, [bolla()]);
  c("non muta l'ingresso", copia, JSON.stringify(due));
  const stessa = P.unisciConCoda(due, [bolla({ quando: fa(1 * HOUR) })]);
  c("stesso orario di un messaggio: il messaggio vero resta prima", ["a", "b", `${P.ID_CODA}${bolla().id}`], stessa.map((m) => m.id));
  const doppia = P.unisciConCoda(due, [
    bolla({ id: "22222222-2222-4222-8222-222222222222", quando: fa(20 * SEC) }),
    bolla({ quando: fa(40 * SEC) }),
  ]);
  c("più bolle: per orario, anche se arrivano in disordine", [`${P.ID_CODA}11111111-1111-4111-8111-111111111111`, `${P.ID_CODA}22222222-2222-4222-8222-222222222222`], doppia.slice(2).map((m) => m.id));
  const sintetica = unito[2];
  c(
    "la riga della coda è un'uscita con il suo testo e senza id WhatsApp",
    ["outbound", "Buongiorno", null],
    [sintetica.direction, sintetica.body, sintetica.wa_message_id],
  );
  c("la riga della coda non conta come messaggio vero (canale ponte, mai «inbound»)", [true, true], [sintetica.id.startsWith(P.ID_CODA), sintetica.direction !== "inbound"]);
  c("data illeggibile: la bolla va in fondo, nessuna eccezione", ["a", "b", `${P.ID_CODA}${bolla().id}`], P.unisciConCoda(due, [bolla({ quando: "ieri" })]).map((m) => m.id));

  /* ═══ entrataDelCliente ═══ */
  gruppo("PONTE · INVIO A MANO · «HA GIÀ UNA CHAT» (T6)");
  c("un messaggio in entrata", true, P.entrataDelCliente([msg()], null));
  c("solo uscite: no", false, P.entrataDelCliente([msg({ direction: "outbound" })], null));
  c("entrata solo dal ponte (canale baileys): sì, ha già una chat", true, P.entrataDelCliente([msg({ canale: "baileys" })], null));
  c("nessun messaggio ma il contatto ha l'ultima entrata: sì", true, P.entrataDelCliente([], { ultimo_in_entrata_il: fa(40 * HOUR) }));
  c("nessun messaggio e il contatto senza entrata: no", false, P.entrataDelCliente([], { ultimo_in_entrata_il: null }));
  c("nessun contatto e nessun messaggio: no", false, P.entrataDelCliente([], null));

  /* ═══ restanti, coda aperta, prossima lettura ═══ */
  gruppo("PONTE · INVIO A MANO · I CONTI E LA CADENZA (T6)");
  const presa = (ms, o = {}) => riga({ stato: "inviato", preso_il: fa(ms), inviato_il: fa(ms), wa_message_id: "ABC", created_at: fa(ms + 30 * SEC), ...o });
  c("nessuna riga: restano 20", 20, P.restantiOggi([], ADESSO));
  c("tre prelievi nelle 24 ore: restano 17", 17, P.restantiOggi([presa(1 * HOUR), presa(5 * HOUR), presa(23 * HOUR)], ADESSO));
  c("un prelievo di 25 ore fa non conta", 20, P.restantiOggi([presa(25 * HOUR)], ADESSO));
  c("una riga mai presa (in attesa) non conta", 20, P.restantiOggi([riga()], ADESSO));
  c("non scende sotto zero", 0, P.restantiOggi(Array.from({ length: 25 }, (_, i) => presa(i * MIN + MIN)), ADESSO));
  c("il tetto è quello dei limiti", L.alGiorno, P.restantiOggi([], ADESSO));
  c("righe aperte: in attesa e in invio", 2, P.righeAperte([riga(), riga({ stato: "in_invio", preso_il: fa(10 * SEC) }), presa(1 * MIN)], ADESSO));
  c("una in attesa da 11 minuti si vede scaduta: non conta come aperta", 0, P.righeAperte([riga({ created_at: fa(11 * MIN) })], ADESSO));
  c("ogni 3 s con una riga in attesa", 3000, P.prossimaLettura([riga()], ADESSO));
  c("ogni 3 s con una riga in invio", 3000, P.prossimaLettura([riga({ stato: "in_invio", preso_il: fa(5 * SEC) })], ADESSO));
  c("ogni 3 s con un inviato ancora in vista", 3000, P.prossimaLettura([presa(20 * SEC)], ADESSO));
  c("ogni 30 s con un inviato ormai nascosto (oltre 90 s)", 30000, P.prossimaLettura([presa(100 * SEC)], ADESSO));
  c("ogni 30 s senza righe", 30000, P.prossimaLettura([], ADESSO));
  c("ogni 30 s con sole righe non inviate", 30000, P.prossimaLettura([riga({ stato: "non_inviato", motivo: "scaduto" })], ADESSO));

  /* ═══ fatti e «puo» ═══ */
  gruppo("PONTE · INVIO A MANO · CHI VEDE IL TASTO (T6)");
  const ingresso = (o = {}) => ({
    leggibile: true,
    numero: NUMERO,
    ponte: ponte(),
    messaggi: [msg()],
    contatto: null,
    stop: false,
    righe: [],
    adesso: ADESSO,
    ...o,
  });
  const puo = (o = {}) => P.puoScrivere(ingresso(o));
  c("tutto a posto: il tasto c'è", { ok: true }, puo());
  c("la coda non si è potuta leggere (tabella assente, errore): nessun tasto", false, puo({ leggibile: false }).ok);
  c("nessuna riga di stato del ponte: nessun tasto", { ok: false, motivo: "ponte_non_collegato" }, puo({ ponte: null }));
  c("ponte fermo da 4 minuti: nessun tasto", { ok: false, motivo: "ponte_non_collegato" }, puo({ ponte: ponte({ aggiornato_il: fa(4 * MIN) }) }));
  c("ponte scollegato: nessun tasto", { ok: false, motivo: "ponte_non_collegato" }, puo({ ponte: ponte({ stato: "attesa_qr" }) }));
  c("invii spenti sul Mac (contatori senza invii_attivi): nessun tasto", { ok: false, motivo: "invii_spenti" }, puo({ ponte: ponte({ contatori: {} }) }));
  c("ponte vecchio senza contatori: nessun tasto", { ok: false, motivo: "invii_spenti" }, puo({ ponte: ponte({ contatori: undefined }) }));
  c("invii_attivi=0: nessun tasto", { ok: false, motivo: "invii_spenti" }, puo({ ponte: ponte({ contatori: { invii_attivi: 0 } }) }));
  c("il cliente ha chiesto STOP: nessun tasto", { ok: false, motivo: "stop" }, puo({ stop: true }));
  c("il cliente non ha mai scritto: nessun tasto", { ok: false, motivo: "mai_scritto" }, puo({ messaggi: [msg({ direction: "outbound" })] }));
  c("numero non valido (chat senza numero): nessun tasto", { ok: false, motivo: "numero_non_valido" }, puo({ numero: null }));
  c(
    "20 prelievi nelle 24 ore: nessun tasto",
    { ok: false, motivo: "limite_giornaliero" },
    puo({ righe: Array.from({ length: 20 }, (_, i) => presa((i + 1) * HOUR, { numero: ALTRO })) }),
  );
  c(
    "19 prelievi nelle 24 ore: il tasto c'è",
    { ok: true },
    puo({ righe: Array.from({ length: 19 }, (_, i) => presa((i + 1) * HOUR, { numero: ALTRO })) }),
  );
  c(
    "tre messaggi già in coda (anche di altri clienti): nessun tasto",
    { ok: false, motivo: "coda_piena" },
    puo({ righe: [riga({ numero: ALTRO }), riga({ id: "2", numero: ALTRO }), riga({ id: "3" })] }),
  );
  const f = P.fattiDelBrowser(ingresso({ righe: [presa(1 * HOUR), riga()] }));
  c(
    "i fatti del browser hanno la forma di quelli del server",
    ["boolean", "boolean", "string", "string", "boolean", "number", "number"],
    [typeof f.entrata, typeof f.stop, typeof f.ponte_stato, typeof f.ponte_battito, typeof f.invii_attivi, typeof f.ultime24h, typeof f.in_coda],
  );
  c("…con i conti giusti (un prelievo, una in coda)", [1, 1, true, true], [f.ultime24h, f.in_coda, f.entrata, f.invii_attivi]);
  c("…e le chiavi sono quelle del contratto", Object.keys(f).sort(), ["entrata", "in_coda", "invii_attivi", "ponte_battito", "ponte_stato", "stop", "ultime24h"]);

  /* ═══ le bolle di una chat ═══ */
  gruppo("PONTE · INVIO A MANO · LE BOLLE DI UNA CHAT (T6)");
  const bolle = (righe, messaggi = [], adesso = ADESSO) => P.bolleDellaChat(righe, NUMERO, messaggi, adesso);
  c("solo le righe di questa chat", ["a"], bolle([riga({ id: "a" }), riga({ id: "b", numero: ALTRO })]).map((b) => b.id));
  const b1 = bolle([riga()])[0];
  c(
    "in attesa: la fase, la frase, il testo e l'orario",
    ["in_attesa", "In invio dal telefono…", "Buongiorno", riga().created_at, false, false],
    [b1.fase, b1.frase, b1.testo, b1.quando, b1.puoRiprovare, b1.incerto],
  );
  const scaduta = bolle([riga({ created_at: fa(11 * MIN) })])[0];
  c("in attesa da 11 minuti: si vede «non inviato», si può riprovare", ["non_inviato", true, false], [scaduta.fase, scaduta.puoRiprovare, scaduta.incerto]);
  const incerta = bolle([riga({ stato: "in_invio", preso_il: fa(4 * MIN) })])[0];
  c("in invio da 4 minuti: esito incerto, con la conferma", ["non_inviato", true, true], [incerta.fase, incerta.puoRiprovare, incerta.incerto]);
  const stop = bolle([riga({ stato: "non_inviato", motivo: "stop" })])[0];
  c("STOP: niente «Riprova»", [false, "Questo cliente ha chiesto di non essere più contattato."], [stop.puoRiprovare, stop.frase]);
  c("inviato e con la riga vera già in chat: la bolla della coda sparisce", [], bolle([presa(10 * SEC, { wa_message_id: "ABC" })], [msg({ wa_message_id: `bw:${NUMERO}:ABC`, direction: "outbound", canale: "baileys" })]));
  c("inviato ma la riga vera non è ancora arrivata: la bolla c'è", ["inviato"], bolle([presa(10 * SEC)]).map((b) => b.fase));
  c("inviato da più di 90 secondi: nascosta", [], bolle([presa(100 * SEC)]));
  c("ordinate per orario", ["x", "y"], bolle([riga({ id: "y", created_at: fa(2 * SEC) }), riga({ id: "x", created_at: fa(9 * SEC) })]).map((b) => b.id));
  const frasi = [...bolle([riga()]), scaduta, incerta, stop].map((b) => b.frase);
  c("nessuna frase ha parole tecniche", null, frasi.map((f) => f.match(VIETATE)?.[0] ?? null).find(Boolean) ?? null);
  c("il numero con il «+» e gli spazi si porta alle sole cifre", [true, "393330000001"], [P.numeroDellaChat("+39 333 000 0001") === NUMERO, P.numeroDellaChat("+393330000001")]);
  c("una chat senza numero valido non ha numero", null, P.numeroDellaChat("boh"));

  /* ═══ chiave del tentativo e risposta ═══ */
  gruppo("PONTE · INVIO A MANO · LA CHIAVE E LA RISPOSTA DEL SERVER (T6)");
  let n = 0;
  const genera = () => `k${String(++n).padStart(31, "0")}`;
  const k1 = P.chiaveDelTentativo(null, NUMERO, "ciao", genera);
  c("la chiave è di 32 caratteri, validi per la rotta", [32, true], [k1.chiave.length, /^[A-Za-z0-9_-]{8,64}$/.test(k1.chiave)]);
  const k2 = P.chiaveDelTentativo(k1, NUMERO, "ciao", genera);
  c("lo stesso tocco ripetuto (stesso numero e stesso testo): la STESSA chiave", [k1.chiave, 1], [k2.chiave, n]);
  const k3 = P.chiaveDelTentativo(k2, NUMERO, "ciao!", genera);
  c("un testo diverso: chiave nuova", true, k3.chiave !== k1.chiave);
  const k4 = P.chiaveDelTentativo(k3, ALTRO, "ciao!", genera);
  c("un altro cliente: chiave nuova", true, k4.chiave !== k3.chiave);
  const vera = P.nuovaChiave();
  c("la chiave vera: 32 caratteri senza trattini, diversa a ogni volta", [32, true, true], [vera.length, /^[0-9a-f]{32}$/.test(vera), vera !== P.nuovaChiave()]);
  c("risposta buona", { ok: true }, P.esitoRichiesta(200, { ok: true, id: "x", stato: "in_attesa" }));
  c("rifiuto con la frase del server", { ok: false, frase: "Hai già mandato 20 messaggi dal telefono nelle ultime 24 ore: riprova più tardi." }, P.esitoRichiesta(429, { ok: false, motivo: "limite_giornaliero", frase: "Hai già mandato 20 messaggi dal telefono nelle ultime 24 ore: riprova più tardi." }));
  const generiche = [P.esitoRichiesta(500, null), P.esitoRichiesta(503, { ok: false, motivo: "migrazione" }), P.esitoRichiesta(401, null), P.esitoRichiesta(403, { ok: false }), P.esitoRichiesta(200, "boh"), P.esitoRichiesta(200, { ok: false })];
  c("senza frase del server: una frase fissa, in italiano, senza gergo", [true, null], [generiche.every((g) => g.ok === false && g.frase.length > 8), generiche.map((g) => g.frase.match(VIETATE)?.[0] ?? null).find(Boolean) ?? null]);
  c("una frase del server troppo lunga o non testuale non passa", [true, true], [P.esitoRichiesta(409, { ok: false, frase: "x".repeat(500) }).frase.length <= 200, P.esitoRichiesta(409, { ok: false, frase: 42 }).frase.length > 8]);

  /* ═══ il sorgente: usaInvioPonte.ts, usaStatoPonte.ts, useChatWa.ts ═══ */
  gruppo("PONTE · INVIO A MANO · IL SORGENTE DEI DATI (T6)");
  const sorgente = (p) => readFileSync(join(radice, p), "utf8");
  const hook = senzaCommenti(sorgente("src/crm/chatwa/usaInvioPonte.ts"));
  c("legge solo la tabella della coda", [1, true], [(hook.match(/\.from\("/g) || []).length, hook.includes('.from("ponte_wa_invii")')]);
  c("…solo le righe dell'utente", true, hook.includes('.eq("user_id", userId)'));
  c("…con le colonne di RigaCoda, mai «*»", [true, false], [hook.includes('"id,chiave,numero,testo,stato,motivo,created_at,preso_il,inviato_il,wa_message_id"'), /select\(\s*["'`]\*/.test(hook)]);
  c("…solo le ultime 24 ore e con un tetto di righe", [true, true], [/\.gte\("created_at"/.test(hook), /\.limit\((\d+|MASSIMO_RIGHE)\)/.test(hook)]);
  c("la scrittura passa solo da /api/crm/ponte-invio (con la sessione del CRM)", [true, true, false], [hook.includes('fetchCRM("/api/crm/ponte-invio"'), hook.includes('azione: "accoda"') && hook.includes('azione: "riprova"'), /\.(insert|update|upsert|delete)\(/.test(hook)]);
  c("rilegge: subito, dopo ogni invio, al ritorno sulla pagina, a ogni nuova lettura della chat; mai a scheda nascosta; nessun tempo reale", [true, true, true, true, true, false], [
    hook.includes("prossimaLettura("),
    hook.includes("leggiRef.current"),
    hook.includes('"visibilitychange"'),
    /letture/.test(hook),
    hook.includes('=== "hidden"'),
    /channel\(|postgres_changes|subscribe\(/.test(hook),
  ]);
  c("errore o tabella assente: nessun errore a schermo (la lettura si inghiotte)", [true, false], [/catch\s*\{/.test(hook) || /catch\s*\(/.test(hook), /toast\.(error|warning)[\s\S]{0,40}letto/.test(hook)]);
  c("la chiave del tentativo si genera una volta e si riusa", [true, true], [hook.includes("chiaveDelTentativo("), hook.includes("tentativoRef")]);
  c("un invio alla volta (doppio tocco)", true, /inviandoRef/.test(hook));
  c("nei log non scrive niente", false, /console\.(log|warn|error|info|debug)/.test(hook));
  c("non nomina nulla del giro automatico", false, /manychat|promemoria|giro|daChiamare|daRispondere/i.test(hook));

  const stato = senzaCommenti(sorgente("src/crm/chatwa/usaStatoPonte.ts"));
  c("useRigaPonte è esportato e useStatoPonte lo riusa", [true, true], [/export function useRigaPonte\(/.test(stato), /useStatoPonte[\s\S]*useRigaPonte\(\)/.test(stato)]);
  c("una sola lettura di ponte_wa_stato, con le colonne e i contatori", [1, true], [(stato.match(/\.from\("ponte_wa_stato"\)/g) || []).length, stato.includes('.select("stato,aggiornato_il,storico,contatori")')]);
  c("la cadenza di un minuto non cambia", true, stato.includes("60_000"));
  const tipoAvviso = sorgente("src/crm/chatwa/avvisoPonte.ts");
  c("RigaStatoPonte guadagna i contatori (facoltativi)", true, /contatori\?: Record<string, number> \| null/.test(tipoAvviso));

  const chat = senzaCommenti(sorgente("src/crm/chatwa/useChatWa.ts"));
  c("useChatWa usa useInvioPonte una volta ed espone ponte", [1, true], [(chat.match(/useInvioPonte\(/g) || []).length, /^\s+ponte,\s*$/m.test(chat)]);
  c("…e non cambia messaggi: la coda non entra in api.messaggi", true, /messaggi: activeMessages,/.test(chat));
  for (const f of ["stato.ts", "daChiamare.ts", "eco.ts", "cercaChat.ts", "richiamo.ts"]) {
    const s = sorgente(`src/crm/chatwa/${f}`);
    c(`${f} non importa niente della coda`, false, /invioPonte|usaInvioPonte|invio-tipi|ponte\/invio/.test(s));
  }
  const daRisp = sorgente("src/crm/chatwa/useDaRispondere.ts");
  c("«Da rispondere» non conosce la coda", false, /invioPonte|usaInvioPonte|invio-tipi|ponte\/invio/.test(daRisp));
}
