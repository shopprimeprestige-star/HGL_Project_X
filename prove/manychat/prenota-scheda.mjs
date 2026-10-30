/** ── PROVE: LA SCHEDA (T4) ──────────────────────────────────────────────
 *
 *  Commessa 2026-10-27 (prenota in chat), compito T4. Funzioni pure sulla
 *  scheda (`prenota-scheda.ts`): chi può prenotare, che cosa scrive la
 *  prenotazione (replica di `updateLead` del browser), come si disfa.
 *
 *  Riferimento: martedì 27/10/2026 14:42Z = 15:42 a Roma (ora solare: il
 *  25/10 si è tornati indietro). Dati inventati: nessun nome né numero vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { deepStrictEqual } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Uguaglianza vera: distingue una chiave assente da una chiave con `undefined`. */
const identiche = (a, b) => {
  try {
    deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
};
const copia = (x) => JSON.parse(JSON.stringify(x));

/** Il sorgente senza commenti (i commenti nominano mezzo mondo: contano le righe di codice). */
const senzaCommenti = (testo) =>
  testo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** I file `.ts`/`.tsx` sotto una cartella (per il grep dei consumatori). */
function sorgenti(cartella, fuori = []) {
  for (const nome of readdirSync(cartella)) {
    const p = join(cartella, nome);
    if (statSync(p).isDirectory()) sorgenti(p, fuori);
    else if (/\.tsx?$/.test(nome)) fuori.push(p);
  }
  return fuori;
}

export async function proveDellaSchedaPrenota(mod, { c, gruppo, radice }) {
  const S = mod["manychat/prenota-scheda"];
  const TIPI = mod["manychat/prenota-tipi"];
  const CONTATTO = mod["manychat/contatto"];
  const FISSA = mod["chi-ha-fissato"];
  const DAL = mod["stato-dal"];
  const TY = mod["types"];
  const BK = mod["booking-utils"];

  const ADESSO = new Date("2026-10-27T14:42:00Z");
  const ISO = ADESSO.toISOString();
  const LINK = "https://hair-genius-hub.hair/meetly/bcd-fghj-kmn";
  const P = {
    consulenteId: "cons-filippo",
    giorno: "2026-10-29",
    ora: "18:00",
    durata: 60,
    link: LINK,
    adesso: ADESSO,
    nomeConsulente: "Filippo Demo",
  };
  const RIGA = "27/10 15:42 · Ha prenotato il cliente dalla chat WhatsApp: gio 29/10 18:00 con Filippo";

  /** una scheda inventata in uno stato */
  const sc = (stato, extra = {}) => ({
    nome: "Anna",
    cognome: "Demo",
    telefono: "333 000 0001",
    stato,
    createdAt: "2026-10-01T09:00:00.000Z",
    ...extra,
  });

  const PRENOTABILI = [
    "da_contattare",
    "non_risponde",
    "segreteria",
    "attesa_whatsapp",
    "richiamo",
    "ci_ricontatta_lui",
    "da_ricontattare",
    "gestire_in_chat",
    "fissa_meet_dopo",
    "no_show",
    "non_fatto",
    "da_spostare",
  ];

  // ── 1. CHI PUÒ PRENOTARE ────────────────────────────────────────────────
  gruppo("PRENOTA · SCHEDA · CHI PUÒ PRENOTARE (lista chiusa)");
  c("sono 12 gli stati prenotabili", 12, PRENOTABILI.length);
  for (const stato of PRENOTABILI) {
    c(`«${stato}» può prenotare`, { ok: true }, S.puoPrenotare(sc(stato), ADESSO));
    // La data del richiamo sta in dataRicontatto/oraRicontatto (quando-per-stato):
    // non è un appuntamento e non deve bloccare niente.
    c(
      `«${stato}» con data di richiamo: può prenotare`,
      { ok: true },
      S.puoPrenotare(sc(stato, { dataRicontatto: "2026-10-30", oraRicontatto: "10:00" }), ADESSO),
    );
  }
  // `sta_valutando` ha già fatto la consulenza (D15): fuori, anche con la data di richiamo.
  c("«sta_valutando» non prenota", { ok: false, motivo: "stato" }, S.puoPrenotare(sc("sta_valutando"), ADESSO));
  c(
    "«sta_valutando» con dataRicontatto: non prenota",
    { ok: false, motivo: "stato" },
    S.puoPrenotare(sc("sta_valutando", { dataRicontatto: "2026-10-30", oraRicontatto: "10:00" }), ADESSO),
  );
  // I nomi degli stati prenotabili sono quelli veri del CRM.
  for (const stato of PRENOTABILI)
    c(`«${stato}» esiste in LEAD_STATUS_LABEL`, true, typeof TY.LEAD_STATUS_LABEL[stato] === "string");

  const NO = [
    ["venduto", "cliente"],
    ["posa_in_sede", "cliente"],
    ["posa_a_domicilio", "cliente"],
    ["posa_da_spedire", "cliente"],
    ["acconto", "cliente"],
    ["annullato", "chiuso"],
    ["perdi_tempo", "chiuso"],
    ["concluso", "chiuso"],
    ["ripensamento", "chiuso"],
    // I nomi della SPEC che in LeadStatus non esistono (oggi «annullato» e «perdi_tempo»): fail-closed.
    ["non_interessato", "stato"],
    ["perso", "stato"],
    ["in_attesa_acconto", "stato"],
    ["irreperibile", "stato"],
    ["viene_in_sede", "stato"],
    ["sede_disdetta", "stato"],
    ["fatto", "stato"],
    ["appuntamento_fissato", "stato"], // senza data: non è prenotabile per lo stato
    ["appuntamento_rifissato", "stato"],
    ["stato_inventato_dal_futuro", "stato"],
    ["", "stato"],
  ];
  for (const [stato, motivo] of NO)
    c(`«${stato || "(vuoto)"}» non prenota (${motivo})`, { ok: false, motivo }, S.puoPrenotare(sc(stato), ADESSO));
  c("stato assente: no (fail-closed)", { ok: false, motivo: "stato" }, S.puoPrenotare({ nome: "Anna" }, ADESSO));
  c(
    "acconto già pagato su uno stato prenotabile: cliente",
    { ok: false, motivo: "cliente" },
    S.puoPrenotare(sc("da_contattare", { payment: { accontoPagato: 100 } }), ADESSO),
  );
  c(
    "acconto a zero: non è un cliente",
    { ok: true },
    S.puoPrenotare(sc("da_contattare", { payment: { accontoPagato: 0 } }), ADESSO),
  );
  c(
    "venduto con consulenza futura: prima di tutto è un cliente",
    { ok: false, motivo: "cliente" },
    S.puoPrenotare(sc("venduto", { dataMeeting: "2026-10-29", oraMeeting: "18:00", consulenteId: "c" }), ADESSO),
  );
  c(
    "il nome e il numero non sono condizioni (D13): senza nome si prenota",
    { ok: true },
    S.puoPrenotare({ stato: "da_contattare" }, ADESSO),
  );

  // ── 2. APPUNTAMENTO FUTURO ──────────────────────────────────────────────
  gruppo("PRENOTA · SCHEDA · APPUNTAMENTO FUTURO (ora di Roma)");
  const conMeet = (stato, g, o, extra = {}) => sc(stato, { dataMeeting: g, oraMeeting: o, consulenteId: "c1", ...extra });
  c("fissato giovedì 18:00: futuro", true, S.appuntamentoFuturo(conMeet("appuntamento_fissato", "2026-10-29", "18:00"), ADESSO));
  c(
    "fissato oggi alle 15:43 (un minuto dopo): futuro",
    true,
    S.appuntamentoFuturo(conMeet("appuntamento_fissato", "2026-10-27", "15:43"), ADESSO),
  );
  c(
    "fissato oggi alle 15:42 (adesso): non è futuro",
    false,
    S.appuntamentoFuturo(conMeet("appuntamento_fissato", "2026-10-27", "15:42"), ADESSO),
  );
  c("fissato ieri: passato", false, S.appuntamentoFuturo(conMeet("appuntamento_fissato", "2026-10-26", "18:00"), ADESSO));
  // 16:30Z = 17:30 a Roma: le 18:00 sono ancora davanti; 17:30Z = 18:30: già passate.
  c(
    "fuso: 17:30 a Roma, le 18:00 sono future",
    true,
    S.appuntamentoFuturo(conMeet("appuntamento_fissato", "2026-10-29", "18:00"), new Date("2026-10-29T16:30:00Z")),
  );
  c(
    "fuso: 18:30 a Roma, le 18:00 sono passate",
    false,
    S.appuntamentoFuturo(conMeet("appuntamento_fissato", "2026-10-29", "18:00"), new Date("2026-10-29T17:30:00Z")),
  );
  // Vale a prescindere dallo stato: se lo stato tiene lo slot, la data conta.
  c("«richiamo» con data di consulenza futura: futuro", true, S.appuntamentoFuturo(conMeet("richiamo", "2026-10-29", "18:00"), ADESSO));
  c(
    "«richiamo» con consulenza futura: puoPrenotare dice futuro",
    { ok: false, motivo: "futuro" },
    S.puoPrenotare(conMeet("richiamo", "2026-10-29", "18:00"), ADESSO),
  );
  c(
    "appuntamento_fissato con data futura: futuro",
    { ok: false, motivo: "futuro" },
    S.puoPrenotare(conMeet("appuntamento_fissato", "2026-10-29", "18:00"), ADESSO),
  );
  // Gli stati che liberano lo slot ricordano una data vecchia: non è un impegno.
  for (const stato of ["no_show", "da_spostare", "non_fatto", "fissa_meet_dopo", "annullato"]) {
    c(`«${stato}» con data futura rimasta: non tiene lo slot`, false, S.appuntamentoFuturo(conMeet(stato, "2026-10-29", "18:00"), ADESSO));
    c(`«${stato}» tiene lo slot, come dice booking-utils`, false, BK.tieneLoSlot(stato));
  }
  c(
    "«no_show» con data futura rimasta: prenotabile",
    { ok: true },
    S.puoPrenotare(conMeet("no_show", "2026-10-29", "18:00"), ADESSO),
  );
  c("senza ora: non è un appuntamento", false, S.appuntamentoFuturo(sc("appuntamento_fissato", { dataMeeting: "2026-10-29" }), ADESSO));
  c("senza data: non è un appuntamento", false, S.appuntamentoFuturo(sc("appuntamento_fissato", { oraMeeting: "18:00" }), ADESSO));
  c("data illeggibile: non è futuro", false, S.appuntamentoFuturo(conMeet("appuntamento_fissato", "boh", "xx"), ADESSO));
  c("scheda vuota", false, S.appuntamentoFuturo({}, ADESSO));

  // ── 3. DA PRENOTARE: LA REPLICA DI updateLead ───────────────────────────
  gruppo("PRENOTA · SCHEDA · COSA SCRIVE LA PRENOTAZIONE (replica di updateLead)");
  /** Quello che fa `updateLead` (CRMContext) per questo salvataggio, rifatto con
   *  le STESSE funzioni del browser: se qualcuno cambia una regola là, questa
   *  prova non combacia più. */
  const comeIlBrowser = (prima, stato = "appuntamento_fissato") => {
    const patch = {
      stato,
      consulenteId: P.consulenteId,
      dataMeeting: P.giorno,
      oraMeeting: P.ora,
      durataMeeting: P.durata,
      linkMeeting: P.link,
    };
    let merged = TY.applyAutoStatus({ ...prima, ...patch }, { statoScelto: true });
    merged = DAL.statoDalDopo(prima, merged, ADESSO, false, undefined);
    if (merged.stato !== prima.stato) {
      merged = { ...merged, statoPrecedente: prima.stato, statoPrecedenteIl: ISO };
      // `statoDa` NON si scrive: il browser ci mette chi lavora, qui non c'è nessuno.
    }
    merged = { ...merged, ...FISSA.patchChiFissa({ prima, statoNuovo: merged.stato, chi: TIPI.FISSATO_DA_CHAT, ora: ADESSO }) };
    if (prima.stato === "da_contattare" && merged.stato !== "da_contattare" && !merged.firstContactAt) {
      merged = { ...merged, firstContactAt: ISO };
    }
    return merged;
  };
  /** Quello che la chat aggiunge e il browser no. */
  const soloChat = (note) => ({ prenotatoChat: { il: ISO, g: P.giorno, o: P.ora }, note });

  for (const stato of PRENOTABILI) {
    const prima = sc(stato, { note: "Vuole sapere il prezzo." });
    const scritta = S.daPrenotare(prima, P);
    const atteso = { ...comeIlBrowser(prima), ...soloChat(`Vuole sapere il prezzo.\n${RIGA}`) };
    c(`da «${stato}»: identica al browser + marcatore + nota`, true, identiche(scritta, atteso));
    c(`da «${stato}»: stato «Appuntamento fissato»`, "appuntamento_fissato", scritta.stato);
    c(`da «${stato}»: statoPrecedente`, stato, scritta.statoPrecedente);
    c(`da «${stato}»: non scrive statoDa`, false, "statoDa" in scritta);
  }
  {
    const prima = sc("da_contattare");
    const s = S.daPrenotare(prima, P);
    c("consulente", "cons-filippo", s.consulenteId);
    c("giorno e ora", "2026-10-29 18:00", `${s.dataMeeting} ${s.oraMeeting}`);
    c("durata 60", 60, s.durataMeeting);
    c("link della stanza", LINK, s.linkMeeting);
    c("statoDal = adesso", ISO, s.statoDal);
    c("statoPrecedenteIl = adesso", ISO, s.statoPrecedenteIl);
    c("da «Da contattare»: firstContactAt = adesso", ISO, s.firstContactAt);
    c("fissatoDa «cliente-chat» (la scheda non l'aveva)", "cliente-chat", s.fissatoDa);
    c("fissatoIl = adesso", ISO, s.fissatoIl);
    c("marcatore prenotatoChat", { il: ISO, g: "2026-10-29", o: "18:00" }, s.prenotatoChat);
    c("nota su scheda senza note: solo la riga", RIGA, s.note);
    c("la scheda di partenza non è toccata", true, identiche(prima, sc("da_contattare")));
    c("risultato: tiene lo slot", true, BK.tieneLoSlot(s.stato));
    c("risultato: è un appuntamento futuro", true, S.appuntamentoFuturo(s, ADESSO));
    c("risultato: ora non è più prenotabile (futuro)", { ok: false, motivo: "futuro" }, S.puoPrenotare(s, ADESSO));
    // Un secondo stato di partenza diverso da «Da contattare»: firstContactAt non si inventa.
    const s2 = S.daPrenotare(sc("non_risponde"), P);
    c("da altro stato: nessun firstContactAt", false, "firstContactAt" in s2);
    const s3 = S.daPrenotare(sc("da_contattare", { firstContactAt: "2026-10-02T08:00:00.000Z" }), P);
    c("firstContactAt già c'è: resta il primo", "2026-10-02T08:00:00.000Z", s3.firstContactAt);
  }
  // Ciò che il browser scrive e la chat NO, con la ragione:
  {
    const s = S.daPrenotare(sc("da_contattare"), P);
    const NON_SCRITTI = {
      statoDa: "il browser ci mette l'id di chi lavora; qui non lavora nessuno",
      adsPurchaseIl: "non è una vendita (solo al passaggio a uno stato vinto)",
      convertedAt: "non è una vendita",
      ciRicontattaDettoIl: "solo se lo stato scelto è «Ci ricontatta lui»",
      contattoWa: "lo scrive solo il server con la funzione SQL (updateLead lo scarta)",
      promemoria: "non lo tocca il salvataggio",
      payment: "applyAutoStatus non cambia niente su una scheda senza acconto né spedizione",
      installazione: "non lo tocca il salvataggio",
      dataRicontatto: "il browser NON la cancella passando ad «Appuntamento fissato»",
      oraRicontatto: "idem",
    };
    for (const [campo, ragione] of Object.entries(NON_SCRITTI))
      c(`non scrive «${campo}» (${ragione})`, false, campo in s);
    // Il biglietto di anteprima del link non è replicabile dal server (SPEC 8): nessun campo.
  }

  // Parità con applyAutoStatus: su una scheda prenotabile non cambia niente.
  for (const stato of PRENOTABILI) {
    const s = S.daPrenotare(sc(stato, { dataRicontatto: "2026-10-30" }), P);
    c(`applyAutoStatus non cambia la scheda scritta («${stato}»)`, true, identiche(TY.applyAutoStatus(s, { statoScelto: true }), s));
  }

  // Note: più righe, a-capo.
  c("nota con note vecchie: riga in fondo", `Prima riga.\n${RIGA}`, S.daPrenotare(sc("da_contattare", { note: "Prima riga." }), P).note);

  // I campi che la prenotazione non tocca restano identici (confronto campo per campo).
  {
    const ricca = sc("da_ricontattare", {
      email: "anna@example.invalid",
      citta: "Torino",
      note: "Chiamare dopo le 18.",
      dataRicontatto: "2026-10-30",
      oraRicontatto: "10:00",
      contattoWa: { stato: "ha_risposto", il: "2026-10-27T14:30:00.000Z", da: "automatico", storia: [] },
      promemoria: { x: 1 },
      payment: { prezzoTotale: 0, accontoPagato: 0 },
      installazione: { dataInstallazione: "" },
      okWhatsapp: { si: true, il: "2026-10-01T09:00:00.000Z", da: "Filippo Demo" },
    });
    const s = S.daPrenotare(ricca, P);
    const TOCCATI = new Set([
      "stato", "consulenteId", "dataMeeting", "oraMeeting", "durataMeeting", "linkMeeting",
      "statoPrecedente", "statoPrecedenteIl", "statoDal", "firstContactAt", "fissatoDa", "fissatoIl",
      "prenotatoChat", "note",
    ]);
    for (const k of Object.keys(ricca).filter((x) => !TOCCATI.has(x)))
      c(`campo non toccato «${k}»: identico`, true, identiche(s[k], ricca[k]));
    const nuovi = Object.keys(s).filter((k) => !(k in ricca));
    c("i campi nuovi sono solo quelli concordati", true, nuovi.every((k) => TOCCATI.has(k)));
    c("dataRicontatto/oraRicontatto identiche dopo prenota", "2026-10-30 10:00", `${s.dataRicontatto} ${s.oraRicontatto}`);
  }

  // Conferma sul sorgente del browser: updateLead NON cancella il richiamo.
  {
    const ctx = readFileSync(join(radice, "src/crm/CRMContext.tsx"), "utf8");
    const da = ctx.indexOf("const updateLead = async");
    const a = ctx.indexOf("void curaLaStanza(current.data, updatedLead)", da);
    const corpo = ctx.slice(da, a);
    c("updateLead: trovato nel sorgente", true, da > 0 && a > da);
    c("updateLead non azzera dataRicontatto/oraRicontatto", false, /(dataRicontatto|oraRicontatto)\s*[:=]/.test(corpo));
    c("updateLead scrive statoDa solo con un consulente collegato", true, /consulenteCollegato\?\.id\s*\?\s*\{\s*statoDa/.test(corpo));
    c("updateLead usa patchChiFissa", true, corpo.includes("patchChiFissa("));
    c("updateLead scrive firstContactAt una volta sola", true, /!merged\.firstContactAt/.test(corpo));
  }

  // ── 4. RIPRENOTAZIONI ───────────────────────────────────────────────────
  gruppo("PRENOTA · SCHEDA · RIPRENOTAZIONE (fissatoDa della setter)");
  for (const stato of ["fissa_meet_dopo", "no_show", "da_spostare"]) {
    const prima = sc(stato, {
      fissatoDa: "set-sara",
      fissatoIl: "2026-10-05T10:00:00.000Z",
      statoDa: "cons-altro",
      statoPrecedente: "appuntamento_fissato",
      statoPrecedenteIl: "2026-10-12T09:00:00.000Z",
      statoDal: "2026-10-12T09:00:00.000Z",
      dataMeeting: "2026-10-12",
      oraMeeting: "17:00",
      durataMeeting: 45,
      linkMeeting: "https://hair-genius-hub.hair/meetly/vecchio-codice-xyz",
      consulenteId: "cons-altro",
      dataRicontatto: "2026-10-28",
      oraRicontatto: "09:00",
      note: "Non si è presentata.",
      firstContactAt: "2026-10-02T08:00:00.000Z",
    });
    const dopo = S.daPrenotare(prima, P);
    c(`${stato}: fissatoDa resta della setter`, "set-sara", dopo.fissatoDa);
    c(`${stato}: fissatoIl resta quello di prima`, "2026-10-05T10:00:00.000Z", dopo.fissatoIl);
    c(`${stato}: statoDa resta quello di prima (non si riscrive)`, "cons-altro", dopo.statoDa);
    c(`${stato}: statoPrecedente = lo stato di prima`, stato, dopo.statoPrecedente);
    c(`${stato}: firstContactAt non cambia`, "2026-10-02T08:00:00.000Z", dopo.firstContactAt);
    c(`${stato}: il richiamo resta identico`, "2026-10-28 09:00", `${dopo.dataRicontatto} ${dopo.oraRicontatto}`);
    c(`${stato}: presaDallaChat`, true, S.presaDallaChat(dopo));
    c(`${stato}: la data vecchia è sostituita`, "2026-10-29 18:00 60", `${dopo.dataMeeting} ${dopo.oraMeeting} ${dopo.durataMeeting}`);
    const disfatta = S.daDisfare(dopo, dopo, prima);
    c(`${stato}: daDisfare ripristina ESATTAMENTE la scheda di prima`, true, identiche(disfatta, prima));
    c(`${stato}: dopo il disfa non è presa dalla chat`, false, S.presaDallaChat(disfatta));
    c(`${stato}: dopo il disfa non c'è prenotatoChat`, false, "prenotatoChat" in disfatta);
  }
  // Disfare anche una prenotazione da scheda nuova: sparisce tutto quello che era nostro.
  for (const stato of PRENOTABILI) {
    const prima = stato === "da_contattare" ? sc(stato) : sc(stato, { note: "Nota." });
    const dopo = S.daPrenotare(prima, P);
    c(`daDisfare da «${stato}»: scheda identica a prima (profonda)`, true, identiche(S.daDisfare(dopo, dopo, prima), prima));
  }

  // ── 5. DISFARE: SOLO SE NESSUNO HA TOCCATO ──────────────────────────────
  gruppo("PRENOTA · SCHEDA · DISFARE (mai alla cieca)");
  {
    const prima = sc("da_ricontattare", { note: "Nota.", fissatoDa: "set-sara", fissatoIl: "2026-10-05T10:00:00.000Z" });
    const scritto = S.daPrenotare(prima, P);
    const fotoScritto = copia(scritto);
    const fotoPrima = copia(prima);
    const tocca = (modifica) => S.daDisfare({ ...scritto, ...modifica }, scritto, prima);
    c("nessuno ha toccato: si disfa", true, identiche(tocca({}), prima));
    c("la setter cambia la data: null", null, tocca({ dataMeeting: "2026-10-30" }));
    c("la setter cambia l'ora: null", null, tocca({ oraMeeting: "19:00" }));
    c("la setter cambia il consulente: null", null, tocca({ consulenteId: "cons-altro" }));
    c("la setter cambia il link: null", null, tocca({ linkMeeting: "https://hair-genius-hub.hair/meetly/altro" }));
    c("la setter cambia lo stato: null", null, tocca({ stato: "no_show" }));
    c("la setter cambia la durata: null", null, tocca({ durataMeeting: 90 }));
    c("cambia statoDal: null", null, tocca({ statoDal: "2026-10-27T15:00:00.000Z" }));
    c("cambia il marcatore: null", null, tocca({ prenotatoChat: { il: ISO, g: "2026-10-30", o: "18:00" } }));
    c("marcatore sparito: null", null, S.daDisfare((({ prenotatoChat: _x, ...r }) => r)(scritto), scritto, prima));
    // Il database (JSONB) riordina le chiavi di un oggetto: non è una modifica.
    {
      const { il, g, o } = scritto.prenotatoChat;
      c("chiavi del marcatore in ordine diverso: si disfa", true, identiche(tocca({ prenotatoChat: { o, il, g } }), prima));
    }
    // Ciò che NON è nostro non impedisce il disfa e non si perde.
    {
      const cw = { stato: "ha_risposto", il: "2026-10-27T15:00:00.000Z", da: "automatico", storia: [] };
      const r = tocca({ contattoWa: cw, citta: "Torino" });
      c("risposta arrivata nel frattempo: si disfa e resta", true, identiche(r, { ...prima, contattoWa: cw, citta: "Torino" }));
    }
    {
      const r = tocca({ note: `${scritto.note}\nNota della setter.` });
      c("nota aggiunta dopo da un'altra persona: resta, la nostra riga va", true, identiche(r, { ...prima, note: "Nota.\nNota della setter." }));
    }
    {
      const r = tocca({ note: "Riscritta da zero dalla setter." });
      c("note riscritte da un'altra persona: non si toccano", "Riscritta da zero dalla setter.", r.note);
    }
    // fissatoDa/fissatoIl: nelle riprenotazioni non sono nostri e non servono alla guardia.
    c("la guardia non guarda fissatoDa", true, identiche(tocca({ fissatoDa: "set-altra" }), { ...prima, fissatoDa: "set-altra" }));
    c("daDisfare non modifica gli argomenti", true, identiche(scritto, fotoScritto) && identiche(prima, fotoPrima));
  }
  {
    // Un fissatoDa scritto da noi si toglie solo se prima non c'era.
    const prima = sc("da_contattare");
    const scritto = S.daPrenotare(prima, P);
    const r = S.daDisfare(scritto, scritto, prima);
    c("fissatoDa nostro: tolto", false, "fissatoDa" in r);
    c("fissatoIl nostro: tolto", false, "fissatoIl" in r);
  }

  // ── 6. È STATA LA CHAT? ─────────────────────────────────────────────────
  gruppo("PRENOTA · SCHEDA · PRESA DALLA CHAT");
  {
    const dopo = S.daPrenotare(sc("da_contattare"), P);
    c("subito dopo la prenotazione: sì", true, S.presaDallaChat(dopo));
    c("la setter sposta l'ora: non più", false, S.presaDallaChat({ ...dopo, oraMeeting: "19:00" }));
    c("la setter sposta il giorno: non più", false, S.presaDallaChat({ ...dopo, dataMeeting: "2026-10-30" }));
    c("scheda senza marcatore: no", false, S.presaDallaChat(sc("appuntamento_fissato", { dataMeeting: "2026-10-29", oraMeeting: "18:00" })));
    c("scheda vuota: no", false, S.presaDallaChat({}));
    c("marcatore mezzo vuoto: no", false, S.presaDallaChat({ ...dopo, prenotatoChat: { il: ISO } }));
    c("spostata e rimessa com'era: sì", true, S.presaDallaChat({ ...dopo, oraMeeting: "19:00", ...{ oraMeeting: dopo.oraMeeting } }));
  }

  // ── 7. SALVATAGGIO «COME IL BROWSER» ────────────────────────────────────
  gruppo("PRENOTA · SCHEDA · IL MARCATORE SOPRAVVIVE AL SALVATAGGIO DEL BROWSER");
  {
    // updateLead: { ...current.data, ...patch } (patch senza contattoWa)
    const come = (current, patch) => {
      const { contattoWa: _scartato, ...resto } = patch;
      return { ...current, ...resto };
    };
    const dopo = S.daPrenotare(sc("da_contattare", { note: "Nota." }), P);
    // 1. la setter scrive una nota: patch di un campo
    let m = come(dopo, { note: `${dopo.note}\nAltro.` });
    c("patch di un campo: il marcatore resta", true, identiche(m.prenotatoChat, dopo.prenotatoChat));
    c("patch di un campo: presaDallaChat", true, S.presaDallaChat(m));
    // 2. LeadDialog salva il MODULO INTERO, aperto PRIMA della prenotazione (non ha il marcatore)
    const moduloVecchio = sc("da_contattare", { note: "Nota.", nome: "Anna", telefono: "333 000 0001" });
    m = come(dopo, moduloVecchio);
    c("modulo intero vecchio: il marcatore non si perde", true, identiche(m.prenotatoChat, dopo.prenotatoChat));
    c("(il modulo vecchio riporta lo stato indietro: è il difetto che updateLead rilegge per evitare, non nostro)", "da_contattare", m.stato);
    // 3. modulo aperto DOPO la prenotazione (ha tutto, marcatore compreso)
    m = come(dopo, { ...dopo, citta: "Torino" });
    c("modulo intero aggiornato: il marcatore resta", true, identiche(m.prenotatoChat, dopo.prenotatoChat));
    c("modulo intero aggiornato: ancora presa dalla chat", true, S.presaDallaChat(m));
    // 4. la setter sposta l'ora dal browser
    m = come(dopo, { oraMeeting: "19:00" });
    c("sposta l'ora: il marcatore resta ma non combacia più", "presente|no", `${m.prenotatoChat ? "presente" : "perso"}|${S.presaDallaChat(m) ? "sì" : "no"}`);
    // 5. e si può ancora disfare quello che la chat aveva scritto? No: la scheda è cambiata.
    c("dopo lo spostamento daDisfare non tocca", null, S.daDisfare(m, dopo, sc("da_contattare", { note: "Nota." })));
    // 6. sequenza vera: prenota -> la setter salva un campo -> secondo tocco riconosce la chat
    m = come(dopo, { email: "anna@example.invalid" });
    c("secondo tocco dopo un salvataggio: conferma della chat", true, S.appuntamentoFuturo(m, ADESSO) && S.presaDallaChat(m));
  }

  // ── 8. LA NOTA ──────────────────────────────────────────────────────────
  gruppo("PRENOTA · SCHEDA · NOTA (ora di Roma)");
  c("senza note: la riga", "Riga.", S.conNota(undefined, "Riga."));
  c("note vuote: la riga", "Riga.", S.conNota("", "Riga."));
  c("note di soli spazi: la riga", "Riga.", S.conNota("  \n ", "Riga."));
  c("con note: a-capo e la riga in fondo", "Vecchia.\nRiga.", S.conNota("Vecchia.", "Riga."));
  c("note che finiscono con a-capo: niente riga vuota", "Vecchia.\nRiga.", S.conNota("Vecchia.\n", "Riga."));
  c("note su più righe", "A\nB\nRiga.", S.conNota("A\nB", "Riga."));
  const notaA = (adesso, g = "2026-10-29", o = "18:00", nome = "Filippo Demo") =>
    S.daPrenotare(sc("da_contattare"), { ...P, adesso, giorno: g, ora: o, nomeConsulente: nome }).note;
  c("riga di esempio della SPEC", RIGA, notaA(ADESSO));
  // Cambio dell'ora solare (domenica 25/10/2026 alle 03:00 → 02:00): 02:30 esiste due volte.
  c("25/10 02:30 prima volta (00:30Z, ora legale)", "25/10 02:30 · Ha prenotato il cliente dalla chat WhatsApp: gio 29/10 18:00 con Filippo", notaA(new Date("2026-10-25T00:30:00Z")));
  c("25/10 02:30 seconda volta (01:30Z, ora solare)", "25/10 02:30 · Ha prenotato il cliente dalla chat WhatsApp: gio 29/10 18:00 con Filippo", notaA(new Date("2026-10-25T01:30:00Z")));
  c("mezzanotte e mezza di Roma, ma per UTC è ancora il 24", "25/10 00:30 · Ha prenotato il cliente dalla chat WhatsApp: gio 29/10 18:00 con Filippo", notaA(new Date("2026-10-24T22:30:00Z")));
  c("cambio di marzo: 28/03/2027 00:30 solare", "28/03 00:30 · Ha prenotato il cliente dalla chat WhatsApp: gio 29/10 18:00 con Filippo", notaA(new Date("2027-03-27T23:30:00Z")));
  c("cambio di marzo: 28/03/2027 03:00 legale", "28/03 03:00 · Ha prenotato il cliente dalla chat WhatsApp: gio 29/10 18:00 con Filippo", notaA(new Date("2027-03-28T01:00:00Z")));
  c("giorno della settimana dell'appuntamento: sabato", true, notaA(ADESSO, "2026-10-31", "09:00").includes("sab 31/10 09:00"));
  c("giorno della settimana: domenica", true, notaA(ADESSO, "2026-11-01", "09:00").includes("dom 01/11 09:00"));
  c("giorno della settimana: lunedì", true, notaA(ADESSO, "2026-11-02", "09:00").includes("lun 02/11 09:00"));
  c("solo il nome di battesimo del consulente", true, notaA(ADESSO, "2026-10-29", "18:00", "Filippo Rossi Demo").endsWith("con Filippo"));
  c("consulente senza nome: niente «con»", "27/10 15:42 · Ha prenotato il cliente dalla chat WhatsApp: gio 29/10 18:00", notaA(ADESSO, "2026-10-29", "18:00", ""));
  c("consulente di soli spazi: niente «con»", false, notaA(ADESSO, "2026-10-29", "18:00", "   ").includes("con"));
  c("la nota non contiene il link", false, notaA(ADESSO).includes("meetly"));

  // ── 9. SECONDO STATO ────────────────────────────────────────────────────
  gruppo("PRENOTA · SCHEDA · «DA RICONTATTARE» (secondo stato)");
  for (const motivo of TIPI.MOTIVI_CONTATTO) {
    const cambio = S.cambioRicontatto(motivo, ADESSO);
    c(`${motivo}: patch`, { stato: "da_ricontattare", il: ISO, da: "automatico", motivo }, cambio.patch);
    c(`${motivo}: voce di storia`, { stato: "da_ricontattare", il: ISO, da: "automatico", motivo }, cambio.voce);
    const dopo = CONTATTO.applicaCambio(undefined, cambio);
    c(`${motivo}: applicato dà «da_ricontattare»`, "da_ricontattare|automatico|1", `${dopo.stato}|${dopo.da}|${dopo.storia.length}`);
    c(`${motivo}: il motivo è in lista chiusa`, true, TIPI.MOTIVI_CONTATTO.includes(cambio.patch.motivo));
  }
  c("non sblocca il freno «mai due volte senza risposta»", false, "sbloccatoIl" in S.cambioRicontatto("prenota_errore", ADESSO).patch);

  // ── 10. I CONSUMATORI DI fissatoDa ──────────────────────────────────────
  gruppo("PRENOTA · SCHEDA · CHI LEGGE fissatoDa (grep su src, routes comprese)");
  {
    const NOMI = /\b(fissatoDa|fissatoIl|chiHaFissato|fissataDa|patchChiFissa|FISSATO_DA_CHAT)\b/;
    // Ogni file che nomina il campo o le sue funzioni, con che cosa ne fa. Se ne
    // compare uno nuovo la prova fallisce: va esaminato prima di aggiungerlo qui.
    const ESAMINATI = {
      "src/crm/CRMContext.tsx": "updateLead scrive fissatoDa con patchChiFissa: la chat fa lo stesso (daPrenotare)",
      "src/crm/MeetGiornalieri.tsx": "«Fissati da me»: fissataDa(l.data, io); «cliente-chat» non è l'id di nessuno",
      "src/crm/chi-ha-fissato.ts": "le funzioni stesse",
      "src/crm/cruscotto-wa/calcolo.ts": "Cruscotto WhatsApp (p4): legge solo fissatoIl per contare le prenotazioni, non scrive niente",
      "src/crm/cruscotto-wa/leggi.server.ts": "Cruscotto WhatsApp (p4): seleziona fissatoIl dalla scheda, sola lettura",
      "src/crm/manychat/prenota-scheda.ts": "la chat (T4)",
      "src/crm/manychat/prenota-tipi.ts": "la costante FISSATO_DA_CHAT (T0)",
      "src/crm/manychat/sequenze.ts": "usa solo fissatoIl (freno 24 ore del promemoria)",
      "src/crm/types.ts": "i tipi",
      "src/routes/CRM.importa.tsx": "elenco «Fissati da me» e avviso «dedotta»: confronta l'id col collaboratore collegato",
    };
    const trovati = sorgenti(join(radice, "src"))
      .filter((f) => NOMI.test(senzaCommenti(readFileSync(f, "utf8"))))
      .map((f) => f.slice(radice.length + 1))
      .sort();
    c("i file che nominano fissatoDa sono tutti esaminati", Object.keys(ESAMINATI).sort(), trovati);
    const kpi = readFileSync(join(radice, "src/routes/api.aios.kpi.ts"), "utf8");
    const feed = readFileSync(join(radice, "src/crm/kpi/aios-feed.ts"), "utf8");
    c("api.aios.kpi.ts non nomina fissatoDa né le sue funzioni", false, NOMI.test(senzaCommenti(kpi)));
    c("api.aios.kpi.ts non legge chi ha fissato (nemmeno statoDa)", false, /\bstatoDa\b/.test(senzaCommenti(kpi)));
    c("il feed dei KPI non nomina fissatoDa", false, NOMI.test(senzaCommenti(feed)));
    c("il feed dei KPI legge firstContactAt (che la chat scrive come il browser)", true, /firstContactAt/.test(feed));
    // Dal lato dei lettori: un id che non è di nessuno non rompe gli elenchi.
    const dopo = S.daPrenotare(sc("da_contattare"), P);
    c("chiHaFissato: «cliente-chat», certa", { id: "cliente-chat", fonte: "certa", quando: ISO }, FISSA.chiHaFissato(dopo));
    c("«Fissati da me» di una setter: non c'è", false, FISSA.fissataDa(dopo, "set-sara"));
    c("«Fissati da me» di nessuno: non c'è", false, FISSA.fissataDa(dopo, ""));
    c("esito: in piedi", "in piedi", FISSA.esitoFissato(dopo));
    // La sequenza dei promemoria legge fissatoIl (freno 24 ore): è adesso, come per ogni appuntamento preso oggi.
    c("fissatoIl è un ISO leggibile", true, Number.isFinite(Date.parse(dopo.fissatoIl)));
  }

  // ── 11. PURA ────────────────────────────────────────────────────────────
  gruppo("PRENOTA · SCHEDA · MODULO PURO");
  {
    const src = readFileSync(join(radice, "src/crm/manychat/prenota-scheda.ts"), "utf8");
    const codice = senzaCommenti(src);
    c("nessun fetch", false, /\bfetch\s*\(/.test(codice));
    c("nessun database", false, /supabase/i.test(codice));
    c("nessun orologio nascosto (new Date() / Date.now)", false, /new Date\(\s*\)|Date\.now\(/.test(codice));
    c("nessun console.log", false, /console\./.test(codice));
  }
}
