/** ── PROVA C4 · IL SALVATAGGIO DEL LEAD (client finto, nessuna rete) ───────
 *  `src/landing/booking/lead-comune.ts`: la richiesta nata una volta, i
 *  ritentativi, il Lead annunciato una sola volta, la funzione dell'orario.
 *  Il client Supabase è un finto che registra le chiamate: niente database.
 *  ───────────────────────────────────────────────────────────────────────── */
import { carica, leggi, nuovaProva } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("salvataggio del lead");

/* ── Un sessionStorage finto, e uno rotto ──────────────────────────────── */
function memoria(iniziale = {}) {
  const m = new Map(Object.entries(iniziale));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
function nuovaFinestra(storage = memoria()) {
  globalThis.window = { sessionStorage: storage, location: { pathname: "/protocol", search: "" } };
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: "prova" }, configurable: true });
  return storage;
}
nuovaFinestra();

const L = await carica("src/landing/booking/lead-comune.ts", "lead-comune");
const R = await carica("src/landing/sito/richiesta.ts", "richiesta-per-lead");
const T = await carica("src/landing/testi-sito.ts", "testi-per-lead");

/* ── Client finto ──────────────────────────────────────────────────────── */
function cliente(risposte = [], rispostaRpc = { data: "fissato", error: null }) {
  const chiamate = [];
  return {
    chiamate,
    from(tabella) {
      return {
        async insert(payload) {
          chiamate.push({ tabella, payload });
          const r = risposte.shift();
          if (r instanceof Error) throw r;
          return r ?? { error: null };
        },
      };
    },
    async rpc(nome, args) {
      chiamate.push({ rpc: nome, args });
      if (rispostaRpc instanceof Error) throw rispostaRpc;
      return rispostaRpc;
    },
  };
}
const errore = (code, message = "errore finto") => ({ error: { code, message } });

const dati = { nome: "Prova Uno", telefono: " 333 1234567 ", fascia: "sera", problema: "tenuta", problemaAltro: "", consensoWhatsapp: true };
const fonte = { utm_source: "prova", utm_campaign: "campagna-prova", fbclid: "fb-prova", external_id: "ext-1" };
const percorso = { touch_history: [], touch_count: 0, first_channel: null, last_channel: null, journey_type: "cold_direct", days_to_convert: 0, hours_to_convert: 0 };
const sito = { origine: "stock", punto: "barra", prodotto: "Protesi di prova" };

/* ── nuovaRichiesta ────────────────────────────────────────────────────── */
{
  const a = L.nuovaRichiesta();
  const b = L.nuovaRichiesta();
  vero("id: un UUID", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.id));
  c("chiave: 64 caratteri esadecimali", true, /^[0-9a-f]{64}$/.test(a.chiave));
  vero("eventId presente", typeof a.eventId === "string" && a.eventId.length > 5);
  c("tre valori diversi a ogni chiamata", [true, true, true], [a.id !== b.id, a.chiave !== b.chiave, a.eventId !== b.eventId]);
  vero("la chiave non è l'id né l'eventId", a.chiave !== a.id && !a.eventId.includes(a.chiave));
}

/* ── conservaRichiesta / richiestaConservata ───────────────────────────── */
{
  const s = nuovaFinestra();
  c("niente conservato → null", null, L.richiestaConservata());
  const r = L.nuovaRichiesta();
  L.conservaRichiesta(r, "da_inviare");
  const letta = L.richiestaConservata();
  c("conservata e riletta", [r.id, r.chiave, r.eventId, "da_inviare"], [letta?.id, letta?.chiave, letta?.eventId, letta?.stato]);
  vero("sta in sessionStorage con la chiave del piano", s._m.has("hgl_richiesta_sito_v1"));
  L.conservaRichiesta(r, "salvato");
  c("lo stato si aggiorna", "salvato", L.richiestaConservata()?.stato);
  L.dimenticaRichiesta();
  c("dimenticata", null, L.richiestaConservata());
  for (const rotto of ["{non json", "null", "[]", "42", '{"id":1}', '{"id":"a","chiave":"b","eventId":"c","stato":"boh"}']) {
    nuovaFinestra(memoria({ hgl_richiesta_sito_v1: rotto }));
    c(`dati rotti (${rotto}) → null, nessuna eccezione`, null, L.richiestaConservata());
  }
  //  Memoria bloccata (Safari privato): la pagina non si rompe.
  nuovaFinestra({ getItem() { throw new Error("bloccata"); }, setItem() { throw new Error("bloccata"); }, removeItem() { throw new Error("bloccata"); } });
  c("sessionStorage che lancia → null", null, L.richiestaConservata());
  let lancia = false;
  try { L.conservaRichiesta(r, "da_inviare"); L.dimenticaRichiesta(); } catch { lancia = true; }
  c("sessionStorage che lancia → nessuna eccezione in scrittura", false, lancia);
  vero("mai in localStorage", !/localStorage/.test(leggi("src/landing/booking/lead-comune.ts").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")));
  nuovaFinestra();
}

/* ── impronta ──────────────────────────────────────────────────────────── */
c("impronta(\"abc\") = SHA-256 noto", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", await L.impronta("abc"));

/* ── payloadBase ───────────────────────────────────────────────────────── */
{
  const p = L.payloadBase({ nome: "Prova Uno", telefono: " 333 1234567 " }, fonte, percorso, "evt-1");
  c("nome e cognome separati come oggi", ["Prova", "Uno"], [p.nome, p.cognome]);
  c("un solo nome → cognome «—»", "—", L.payloadBase({ nome: "Prova", telefono: "333 1234567" }, fonte, percorso, "e").cognome);
  c("telefono pulito dagli spazi ai bordi", "333 1234567", p.telefono);
  c("email e città «—» come oggi", ["—", "—"], [p.email, p.citta]);
  c("senza orario, senza punteggio, senza urgenza", [null, null, null, null], [p.data_slot, p.ora_slot, p.disagio_score, p.urgenza]);
  c("event_id = quello della richiesta", "evt-1", p.event_id);
  c("fonte e UTM seguono il lead", ["prova", "campagna-prova", "fb-prova"], [p.utm_source, p.utm_campaign, p.fbclid]);
  c("pain_points parte vuoto", [], p.pain_points);
}

/* ── costruisciPayload: pieno, senza consenso, riserva ─────────────────── */
const richiesta = { id: "11111111-2222-4333-8444-555555555555", chiave: "k".repeat(64), eventId: "evt-fisso" };
const { pieno, senzaConsenso, riserva } = L.costruisciPayload({ dati, richiesta, hash: "h".repeat(64), sito, fonte, percorso });
{
  c("pieno: id e impronta (mai la chiave)", [richiesta.id, "h".repeat(64), false], [pieno.id, pieno.chiave_orario_hash, JSON.stringify(pieno).includes(richiesta.chiave)]);
  c("pieno: colonne del sito", ["stock", "barra", "Tenuta: si stacca presto", null, "sera", "Protesi di prova"], [pieno.origine, pieno.punto_ingresso, pieno.problema_principale, pieno.problema_altro, pieno.fascia_oraria, pieno.prodotto_stock]);
  c("pieno: pain_points = solo l'etichetta", ["Tenuta: si stacca presto"], pieno.pain_points);
  c("pieno: consenso spuntato", [true, T.VERSIONE_CONSENSO_WA], [pieno.consenso_whatsapp, pieno.consenso_whatsapp_versione]);
  c("senza consenso: stesso payload meno le due chiavi", true, !("consenso_whatsapp" in senzaConsenso) && !("consenso_whatsapp_versione" in senzaConsenso) && senzaConsenso.fascia_oraria === "sera" && senzaConsenso.id === richiesta.id);
  c("riserva: stesso id e stesso event_id", [richiesta.id, "evt-fisso"], [riserva.id, riserva.event_id]);
  c("riserva: nessuna colonna nuova", [], ["origine", "punto_ingresso", "problema_principale", "problema_altro", "fascia_oraria", "prodotto_stock", "chiave_orario_hash", "consenso_whatsapp", "consenso_whatsapp_versione"].filter((k) => k in riserva));
  c("riserva: tutto in pain_points", ["Problema: Tenuta: si stacca presto", "Provenienza: stock", "Ingresso: barra", "Protesi: Protesi di prova", "Richiamo: sera"], riserva.pain_points);
  c("tutti e tre: stesso event_id", [true, true], [pieno.event_id === "evt-fisso", senzaConsenso.event_id === "evt-fisso"]);
  const senza = L.costruisciPayload({ dati: { ...dati, consensoWhatsapp: false }, richiesta, hash: "h", sito, fonte, percorso });
  c("casella non spuntata: nessuna chiave consenso nel pieno", [], ["consenso_whatsapp", "consenso_whatsapp_versione"].filter((k) => k in senza.pieno));
}

/* ── Deriva: il modulo corto = il modulo lungo, salvo le differenze ───── */
{
  const sorgente = leggi("src/landing/booking/BookingFunnel.tsx");
  const m = sorgente.match(/const insertPayload: Record<string, unknown> = \{([\s\S]*?)\n    \};/);
  vero("trovo insertPayload in BookingFunnel.tsx", !!m);
  const chiaviFunnel = new Set([...(m ? m[1] : "").matchAll(/^      ([a-z_]+)\s*[:,]/gm)].map((x) => x[1]));
  vero("insertPayload: ho letto una trentina di chiavi", chiaviFunnel.size >= 30);
  const ammesse = new Set(R.DIFFERENZE_AMMESSE);
  const fuoriElenco = (a, b) => [...new Set([...[...a].filter((k) => !b.has(k)), ...[...b].filter((k) => !a.has(k))])].filter((k) => !ammesse.has(k)).sort();
  const chiaviModulo = new Set(Object.keys(pieno));
  c("oggi: nessuna differenza fuori dall'elenco", [], fuoriElenco(chiaviModulo, chiaviFunnel));
  const conConsenso = new Set([...chiaviFunnel, "consenso_whatsapp", "consenso_whatsapp_versione"]);
  c("dopo l'aggiunta del consenso nell'altro ramo (simulata): nessuna differenza", [], fuoriElenco(chiaviModulo, conConsenso));
  //  La prova deve accorgersi di una deriva vera.
  c("se il modulo lungo prende una chiave nuova, la prova la vede", ["chiave_nuova"], fuoriElenco(chiaviModulo, new Set([...chiaviFunnel, "chiave_nuova"])));
  c("se il modulo corto prende una chiave nuova, la prova la vede", ["extra"], fuoriElenco(new Set([...chiaviModulo, "extra"]), chiaviFunnel));
  //  Lo stesso evento «Lead» verso Meta.
  c("custom event del Lead = quello del modulo lungo", sorgente.match(/leadInviato:\s*"([^"]+)"/)?.[1], "Lead_Prenotazione_Inviato");
  vero("il modulo lungo manda ancora content_name «booking_lead»", /content_name:\s*"booking_lead"/.test(sorgente));
}

/* ── Landing «Tre soluzioni»: lo stesso lead di oggi, con il motivo (G3) ── */
{
  const sol = (interesse) => ({ origine: "consulenza", punto: "soluzioni", ...(interesse ? { interesse } : {}) });
  const base = { ...dati, problema: null, consensoWhatsapp: false };
  const costruisci = (sito, d = base) => L.costruisciPayload({ dati: d, richiesta, hash: "h".repeat(64), sito, fonte, percorso });
  const protocol = costruisci({ origine: "consulenza", punto: "protocol" });
  for (const i of ["trapianto", "invisible-derm", "non-so"]) {
    const p = costruisci(sol(i));
    const etichetta = R.ETICHETTE_INTERESSE[i];
    c(`${i}: punto_ingresso «soluzioni» e origine «consulenza»`, ["soluzioni", "consulenza"], [p.pieno.punto_ingresso, p.pieno.origine]);
    c(`${i}: le colonne sono quelle del lead di oggi (stesse chiavi del modulo corto del Protocol)`, Object.keys(protocol.pieno).sort(), Object.keys(p.pieno).sort());
    c(`${i}: nessuna colonna «interesse»: il motivo sta in pain_points`, [false, false, false], [("interesse" in p.pieno), ("interesse" in p.senzaConsenso), ("interesse" in p.riserva)]);
    c(`${i}: pain_points con le colonne, la riga una volta sola`, [`Interesse: ${etichetta}`], p.pieno.pain_points);
    c(`${i}: anche senza il consenso`, [`Interesse: ${etichetta}`], p.senzaConsenso.pain_points);
    c(`${i}: nella riserva la riga c'è una volta, in fondo`, [1, `Interesse: ${etichetta}`, "Ingresso: soluzioni"], [p.riserva.pain_points.filter((x) => x.startsWith("Interesse:")).length, p.riserva.pain_points.at(-1), p.riserva.pain_points.find((x) => x.startsWith("Ingresso:"))]);
    c(`${i}: la riserva non ha colonne nuove`, [], ["origine", "punto_ingresso", "problema_principale", "problema_altro", "fascia_oraria", "prodotto_stock", "chiave_orario_hash", "interesse"].filter((k) => k in p.riserva));
  }
  //  Senza interesse il lead è quello di oggi, identico, salvo il punto d'origine.
  const senza = costruisci(sol());
  c("senza interesse: stesso payload di prima (con «soluzioni» al posto di «protocol»)", JSON.stringify({ ...protocol.pieno, punto_ingresso: "soluzioni" }), JSON.stringify(senza.pieno));
  c("senza interesse: pain_points vuoto come oggi (nessun problema scelto)", [], senza.pieno.pain_points);
  c("senza interesse, la riserva è quella di oggi", JSON.stringify({ ...protocol.riserva, pain_points: protocol.riserva.pain_points.map((x) => x.replace("protocol", "soluzioni")) }), JSON.stringify(senza.riserva));
  //  Un modulo di oggi (stock, con problema): il payload non cambia di un byte passando dal nuovo codice.
  const oggi = L.costruisciPayload({ dati, richiesta, hash: "h".repeat(64), sito, fonte, percorso });
  c("modulo di oggi (shop): pain_points identici", ["Tenuta: si stacca presto"], oggi.pieno.pain_points);
  c("modulo di oggi (shop): riserva identica", ["Problema: Tenuta: si stacca presto", "Provenienza: stock", "Ingresso: barra", "Protesi: Protesi di prova", "Richiamo: sera"], oggi.riserva.pain_points);
  //  Deriva: le chiavi del lead da /soluzioni = quelle del modulo lungo, salvo le differenze ammesse (senza toccare l'elenco).
  const sorgente = leggi("src/landing/booking/BookingFunnel.tsx");
  const m = sorgente.match(/const insertPayload: Record<string, unknown> = \{([\s\S]*?)\n    \};/);
  const chiaviFunnel = new Set([...(m ? m[1] : "").matchAll(/^      ([a-z_]+)\s*[:,]/gm)].map((x) => x[1]));
  const ammesse = new Set(R.DIFFERENZE_AMMESSE);
  const chiaviSol = new Set(Object.keys(costruisci(sol("trapianto")).pieno));
  const fuori = [...new Set([...[...chiaviSol].filter((k) => !chiaviFunnel.has(k)), ...[...chiaviFunnel].filter((k) => !chiaviSol.has(k))])].filter((k) => !ammesse.has(k)).sort();
  c("deriva: il lead da /soluzioni non ha chiavi fuori dall'elenco delle differenze ammesse", [], fuori);
  c("DIFFERENZE_AMMESSE non è stato toccato (10 voci)", 10, R.DIFFERENZE_AMMESSE.length);
  //  Il motivo non è mai un dato personale: né il nome né il telefono finiscono nella riga.
  vero("nella riga dell'interesse non c'è né il nome né il telefono", !JSON.stringify(costruisci(sol("trapianto")).pieno.pain_points).match(/Prova|333/));
}

/* ── inviaRichiesta ────────────────────────────────────────────────────── */
{
  const cl = cliente([{ error: null }]);
  c("inserimento ok → salvato", "salvato", await L.inviaRichiesta(cl, [pieno, senzaConsenso, riserva]));
  c("…con una sola chiamata", 1, cl.chiamate.length);
  c("…sulla tabella public_leads, payload pieno", ["public_leads", pieno], [cl.chiamate[0].tabella, cl.chiamate[0].payload]);
}
{
  const cl = cliente([errore("PGRST204"), { error: null }]);
  c("PGRST204 sul consenso → senza consenso", "salvato_senza_consenso", await L.inviaRichiesta(cl, [pieno, senzaConsenso, riserva]));
  c("…due chiamate, la seconda senza consenso e con le colonne del sito", [2, false, "sera"], [cl.chiamate.length, "consenso_whatsapp" in cl.chiamate[1].payload, cl.chiamate[1].payload.fascia_oraria]);
}
{
  const cl = cliente([errore("PGRST204"), errore("42703"), { error: null }]);
  c("PGRST204 anche lì → riserva", "salvato_riserva", await L.inviaRichiesta(cl, [pieno, senzaConsenso, riserva]));
  c("…tre chiamate, l'ultima con le sole chiavi di oggi", [3, false], [cl.chiamate.length, "fascia_oraria" in cl.chiamate[2].payload]);
}
{
  const cl = cliente([errore("23514"), errore("PGRST204"), errore("PGRST204")]);
  const r = await L.inviaRichiesta(cl, [pieno, senzaConsenso, riserva]);
  c("la riserva fallisce → errore, mai una 4ª chiamata", [true, 3], [typeof r === "object" && "errore" in r, cl.chiamate.length]);
}
{
  const cl = cliente([errore("PGRST204"), { error: null }]);
  const nessunConsenso = L.costruisciPayload({ dati: { ...dati, consensoWhatsapp: false }, richiesta, hash: "h", sito, fonte, percorso });
  c("casella non spuntata: salta il 1° ritentativo, passa alla riserva", "salvato_riserva", await L.inviaRichiesta(cl, [nessunConsenso.pieno, nessunConsenso.senzaConsenso, nessunConsenso.riserva]));
  c("…due chiamate in tutto (la stessa richiesta non va due volte)", [2, "pain_points"], [cl.chiamate.length, "pain_points" in cl.chiamate[1].payload && "fascia_oraria" in cl.chiamate[1].payload ? "colonne" : "pain_points"]);
}
{
  const cl = cliente([errore("42501", "nessun permesso")]);
  const r = await L.inviaRichiesta(cl, [pieno, senzaConsenso, riserva]);
  c("errore che non si ritenta → messaggio e una sola chiamata", [{ errore: "nessun permesso" }, 1], [r, cl.chiamate.length]);
}
{
  const cl = cliente([new TypeError("Failed to fetch")]);
  const r = await L.inviaRichiesta(cl, [pieno, senzaConsenso, riserva]);
  c("rete caduta (eccezione) → errore, nessuna eccezione fuori", [true, 1], [typeof r === "object" && "errore" in r, cl.chiamate.length]);
}
{
  const cl = cliente([errore("23505")]);
  c("23505 al primo tentativo → già salvato", "salvato", await L.inviaRichiesta(cl, [pieno, senzaConsenso, riserva]));
}
{
  const cl = cliente([errore("PGRST204"), errore("23505")]);
  c("23505 al secondo tentativo → già salvato, senza consenso", "salvato_senza_consenso", await L.inviaRichiesta(cl, [pieno, senzaConsenso, riserva]));
}
{
  const cl = cliente([errore("PGRST204"), errore("PGRST204"), errore("23505")]);
  c("23505 al terzo tentativo → già salvato, riserva", "salvato_riserva", await L.inviaRichiesta(cl, [pieno, senzaConsenso, riserva]));
}

/* ── Rete caduta, poi nuovo tocco: un solo Lead, con l'eventId giusto ──── */
{
  nuovaFinestra();
  L.chiamate.firePixel.length = 0;
  L.chiamate.fireCapi.length = 0;
  L.chiamate.trackEvent.length = 0;
  const r = L.nuovaRichiesta();
  L.conservaRichiesta(r, "da_inviare");
  const { pieno: p1, senzaConsenso: p2, riserva: p3 } = L.costruisciPayload({ dati, richiesta: r, hash: await L.impronta(r.chiave), sito, fonte, percorso });
  const cl = cliente([new TypeError("Failed to fetch"), errore("23505")]);
  const primo = await L.inviaRichiesta(cl, [p1, p2, p3]);
  c("1° tocco: la risposta si perde → errore", true, typeof primo === "object" && "errore" in primo);
  const secondo = await L.inviaRichiesta(cl, [p1, p2, p3]);
  c("2° tocco: 23505 → salvato", "salvato", secondo);
  c("stesso id in tutti i tentativi", [r.id, r.id], cl.chiamate.map((x) => x.payload.id));
  c("stesso event_id in tutti i tentativi", [r.eventId, r.eventId], cl.chiamate.map((x) => x.payload.event_id));
  const a1 = L.annunciaLead(r.eventId, { nome: "Prova Uno", telefono: "333 1234567" });
  const a2 = L.annunciaLead(r.eventId, { nome: "Prova Uno", telefono: "333 1234567" });
  c("annunciaLead: il primo parte, il secondo no", [true, false], [a1, a2]);
  c("Pixel: una sola chiamata «Lead» con l'eventId del payload", [1, "Lead", r.eventId], [L.chiamate.firePixel.length, L.chiamate.firePixel[0]?.[0], L.chiamate.firePixel[0]?.[2]]);
  c("Pixel: stesso content_name del modulo lungo", "booking_lead", L.chiamate.firePixel[0]?.[1]?.content_name);
  c("CAPI: una sola chiamata con lo stesso eventId", [1, "Lead", r.eventId, "booking_lead"], [L.chiamate.fireCapi.length, L.chiamate.fireCapi[0]?.[0], L.chiamate.fireCapi[0]?.[1], L.chiamate.fireCapi[0]?.[3]?.content_name]);
  c("CAPI: telefono con +39, come il modulo lungo (impronta delle sole cifre)", "+39 3331234567", L.chiamate.fireCapi[0]?.[2]?.phone);
  const lead = L.chiamate.trackEvent.filter((x) => x[0] === "Lead");
  c("trackEvent «Lead» passo 6, una volta, con event_id", [1, 6, r.eventId], [lead.length, lead[0]?.[1], lead[0]?.[2]?.event_id]);
  //  Nemmeno dopo una ricarica (stessa scheda) il Lead riparte.
  c("dopo una ricarica nella stessa scheda: ancora no", false, L.annunciaLead(r.eventId, { nome: "Prova Uno", telefono: "333 1234567" }));
  //  La chiave non esce mai dalla richiesta.
  const tutto = JSON.stringify([L.chiamate.trackEvent, L.chiamate.firePixel, L.chiamate.fireCapi]);
  vero("la chiave non compare in nessuna chiamata di tracciamento", !tutto.includes(r.chiave) && !tutto.includes(p1.chiave_orario_hash));
  vero("nome e telefono arrivano solo a CAPI (come oggi), mai a trackEvent né Pixel", !JSON.stringify([L.chiamate.trackEvent, L.chiamate.firePixel]).match(/Prova|333 1234567|3331234567/));
  vero("la chiave non è nemmeno nel payload «riserva» né nel «senza consenso»", !JSON.stringify([p2, p3]).includes(r.chiave) && !JSON.stringify(p1).includes(r.chiave));
}

/* ── Ricarica vera: un modulo nuovo (memoria vuota) non rilancia il Lead ── */
{
  const L2 = await carica("src/landing/booking/lead-comune.ts", "lead-comune-ricaricato");
  const salvata = L.richiestaConservata();
  vero("la richiesta annunciata è ancora in sessionStorage, col segno", salvata?.annunciato === true);
  c("modulo ricaricato: il Lead non riparte", [false, 0], [L2.annunciaLead(salvata.eventId, { nome: "Prova Uno", telefono: "333 1234567" }), L2.chiamate.firePixel.length]);
  L.dimenticaRichiesta();
}
//  Browser che non sa calcolare l'impronta: il lead si salva lo stesso, senza il campo.
{
  const senzaHash = L.costruisciPayload({ dati, richiesta, hash: null, sito, fonte, percorso });
  c("hash nullo → nessuna chiave chiave_orario_hash, il resto resta", [false, "sera"], ["chiave_orario_hash" in senzaHash.pieno, senzaHash.pieno.fascia_oraria]);
}

/* ── fissaOrario ───────────────────────────────────────────────────────── */
{
  const cl = cliente([], { data: "fissato", error: null });
  c("fissato", "fissato", await L.fissaOrario(cl, richiesta.id, richiesta.chiave, "2026-10-20", "10:30"));
  c("…una chiamata rpc con i quattro argomenti", [{ rpc: "fissa_orario_lead_sito", args: { p_id: richiesta.id, p_chiave: richiesta.chiave, p_data: "2026-10-20", p_ora: "10:30" } }], cl.chiamate);
}
c("occupato", "occupato", await L.fissaOrario(cliente([], { data: "occupato", error: null }), "i", "k", "2026-10-20", "10:30"));
c("non_valido", "non_valido", await L.fissaOrario(cliente([], { data: "non_valido", error: null }), "i", "k", "2026-10-20", "10:30"));
c("risposta strana → non_valido (il visitatore legge la frase chiara)", "non_valido", await L.fissaOrario(cliente([], { data: "boh", error: null }), "i", "k", "2026-10-20", "10:30"));
c("funzione assente (PGRST202) → non_disponibile", "non_disponibile", await L.fissaOrario(cliente([], { data: null, error: { code: "PGRST202", message: "x" } }), "i", "k", "2026-10-20", "10:30"));
c("funzione assente (42883) → non_disponibile", "non_disponibile", await L.fissaOrario(cliente([], { data: null, error: { code: "42883", message: "x" } }), "i", "k", "2026-10-20", "10:30"));
c("rete caduta → non_disponibile", "non_disponibile", await L.fissaOrario(cliente([], new TypeError("Failed to fetch")), "i", "k", "2026-10-20", "10:30"));

finisci();
