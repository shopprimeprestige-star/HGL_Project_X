/** ── PROVE: «DA RISPONDERE» SOLO SE L'ULTIMO MESSAGGIO È DEL CLIENTE (30/10/2026) ──────────────
 *  Regole del titolare (commessa 2026-10-30-da-rispondere-ultimo-mio):
 *   1. Da rispondere = l'ultimo messaggio è del cliente. Se è mio, da QUALUNQUE canale (CRM, modello
 *      automatico ManyChat, inbox, telefono col ponte), NON lo è.
 *   4. Una chat non sta mai in Da rispondere e Da chiamare insieme: vince Da rispondere.
 *   5. Se l'ultimo è del cliente e mi dimentico di rispondere, RESTA in Da rispondere anche a
 *      finestra chiusa e dopo giorni: il tempo non la sposta in Da chiamare.
 *  Dati inventati (orari e numeri finti). */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveDaRispondereUltimoMio(mod, { c, gruppo, radice }) {
  gruppo("DA RISPONDERE: L'ULTIMO MESSAGGIO È DEL CLIENTE (qualunque canale chiude)");
  const S = mod["chatwa/stato"];
  const D = mod["chatwa/daChiamare"];
  const F = mod["chatwa/filtri"];
  const A = mod["importa/attesa-da-chiamare"];
  const ADESSO = Date.parse("2026-10-30T18:00:00Z");
  const ORA = 3_600_000;
  const GIORNO = 24 * ORA;
  const fa = (ms) => new Date(ADESSO - ms).toISOString();
  const dr = (contatto, extra = {}) => S.daRispondere({ contatto, messaggi: [], adesso: ADESSO, ...extra });
  /** Il contatto come lo lascia il database: l'ultimo messaggio sta in `ultimo_messaggio_*`. */
  const contatto = (entrataFa, ultimoFa, direzione, extra = {}) => ({
    ultimo_in_entrata_il: fa(entrataFa),
    ultimo_in_entrata_anteprima: "Buongiorno, vorrei info",
    ultimo_messaggio_il: fa(ultimoFa),
    ultimo_messaggio_direzione: direzione,
    ...extra,
  });

  // ── Regola 1: l'ultimo è mio → fuori, anche se `risposto_il` non è stato scritto ──
  c("modello automatico ManyChat dopo il cliente (risposto_il vuoto): NON in attesa", false,
    dr(contatto(2 * ORA, ORA, "outbound", { risposto_il: null })).attesa);
  c("risposta dal telefono 2 giorni fa (risposto_il fermo a prima, oltre i 7 giorni del ponte): NON in attesa", false,
    dr(contatto(3 * GIORNO, 2 * GIORNO, "outbound", { risposto_il: fa(5 * GIORNO) })).attesa);
  c("risposta dall'inbox di ManyChat letta in pagina (nessuna colonna sul contatto): NON in attesa", false,
    dr({ ultimo_in_entrata_il: fa(2 * ORA) }, { ultimo: { direction: "outbound", created_at: fa(ORA), status: "sent" } }).attesa);
  // ── il contrario e i bordi ──
  c("il cliente riscrive dopo il nostro modello: in attesa col suo orario", [true, fa(10 * 60_000)],
    ((r) => [r.attesa, r.dal])(dr(contatto(10 * 60_000, 10 * 60_000, "inbound"))));
  c("nostro messaggio PRIMA dell'ultima entrata: in attesa", true, dr(contatto(ORA, 2 * ORA, "outbound")).attesa);
  c("nostro messaggio nello stesso istante dell'entrata: in attesa (non è dopo)", true, dr(contatto(ORA, ORA, "outbound")).attesa);
  c("nostro messaggio NON partito (failed) letto in pagina: il cliente aspetta ancora", true,
    dr({ ultimo_in_entrata_il: fa(2 * ORA) }, { ultimo: { direction: "outbound", created_at: fa(ORA), status: "failed" } }).attesa);
  c("senza le colonne nuove (migrazione non applicata): come prima", true, dr({ ultimo_in_entrata_il: fa(2 * ORA) }).attesa);
  c("«Fatto» dopo il cliente: resta fuori (non cambia)", false, dr(contatto(2 * ORA, 2 * ORA, "inbound", { risposto_il: fa(ORA) })).attesa);
  // ── Ripiego sui messaggi (colonne d'entrata vuote): le righe del ponte restano solo da vedere (I3),
  //    la nostra uscita dal telefono la dice l'ultimo messaggio del contatto ──
  const m = (direction, ms, canale) => ({ direction, body: "ciao", created_at: fa(ms), canale });
  c("ripiego: cliente (ManyChat) poi uscita dal telefono, che il contatto registra come ultimo messaggio: NON in attesa", false,
    S.daRispondere({ contatto: { ultimo_messaggio_il: fa(ORA), ultimo_messaggio_direzione: "outbound" }, messaggi: [m("inbound", 2 * ORA, "manychat")], adesso: ADESSO }).attesa);
  c("ripiego: cliente poi il cliente di nuovo dopo la nostra uscita: in attesa", true,
    S.daRispondere({ contatto: { ultimo_messaggio_il: fa(ORA), ultimo_messaggio_direzione: "inbound" }, messaggi: [m("inbound", 3 * ORA, "manychat"), m("inbound", ORA, "manychat")], adesso: ADESSO }).attesa);
  c("ripiego: l'entrata del ponte da sola resta solo da vedere", false,
    S.daRispondere({ contatto: null, messaggi: [m("inbound", ORA, "baileys")], adesso: ADESSO }).attesa);
  // ── Il numerino del menu usa la stessa regola ──
  c("il conto del menu: 1 aspetta, 1 con modello automatico dopo, 1 con la nostra risposta dal telefono", 1,
    S.contaDaRispondere([
      contatto(2 * ORA, 2 * ORA, "inbound"),
      contatto(2 * ORA, ORA, "outbound"),
      contatto(3 * GIORNO, 2 * GIORNO, "outbound", { risposto_il: fa(9 * GIORNO) }),
    ], ADESSO));
  const hook = readFileSync(join(radice, "src/crm/chatwa/useDaRispondere.ts"), "utf8");
  c("il menu legge anche la direzione dell'ultimo messaggio (e ripiega se la colonna manca)", true,
    /ultimo_messaggio_il,ultimo_messaggio_direzione/.test(hook) && /colonnaMancante/.test(hook));

  // ── Regola 5: il tempo e la finestra non spostano niente ──
  gruppo("DA RISPONDERE: SE L'ULTIMO È DEL CLIENTE RESTA LÌ (finestra chiusa, giorni) E NON È MAI ANCHE «DA CHIAMARE»");
  c("cliente di 20 giorni fa, nessuna risposta: in attesa (nessun limite di età)", true, dr(contatto(20 * GIORNO, 20 * GIORNO, "inbound")).attesa);
  c("finestra di 24 ore chiusa e ultimo del cliente: la finestra non c'entra, in attesa", [false, true],
    ((f, r) => [f.aperta, r.attesa])(S.finestra24({ contatto: contatto(3 * GIORNO, 3 * GIORNO, "inbound"), messaggi: [], adesso: ADESSO }), dr(contatto(3 * GIORNO, 3 * GIORNO, "inbound"))));

  /** Una chat come la costruisce useChatWa: `daRispondere` calcolato dalla regola vera. */
  const chat = (o) => {
    const cont = o.contatto ?? null;
    const dRisp = o.contatto ? dr(o.contatto) : { attesa: false };
    return {
      phone: o.phone ?? "+393330000001",
      lead: o.stato ? { data: { stato: o.stato } } : null,
      contact: cont,
      lastMessage: null,
      finestra: { aperta: o.aperta ?? false },
      daRispondere: { attesa: dRisp.attesa },
    };
  };
  const solo = (coda) => ({ ...F.FILTRI_VUOTI, coda });
  const dueVolte = (ch) => F.passaFiltri(ch, solo("da-rispondere"), () => 0) && F.passaFiltri(ch, solo("da-chiamare"), () => 0);

  for (const stato of ["da_chiamare", "non_risponde", "segreteria", "richiamo", "ci_ricontatta_lui"]) {
    const aspetta = chat({ stato, contatto: contatto(2 * GIORNO, 2 * GIORNO, "inbound") });
    c(`lead «${stato}» con l'ultimo del cliente: solo Da rispondere`, [true, false],
      [F.passaFiltri(aspetta, solo("da-rispondere"), () => 0), F.passaFiltri(aspetta, solo("da-chiamare"), () => 0)]);
    const risposto = chat({ stato, contatto: contatto(2 * GIORNO, GIORNO, "outbound") });
    c(`lead «${stato}» con l'ultimo mio: solo Da chiamare (lo stato lo decide il setter)`, [false, true],
      [F.passaFiltri(risposto, solo("da-rispondere"), () => 0), F.passaFiltri(risposto, solo("da-chiamare"), () => 0)]);
  }
  const mondo = [];
  for (const stato of [null, "da_chiamare", "non_risponde", "in_valutazione", "attesa_whatsapp"])
    for (const aperta of [true, false])
      for (const [e, u, d] of [[2 * GIORNO, 2 * GIORNO, "inbound"], [2 * GIORNO, ORA, "outbound"], [20 * GIORNO, 20 * GIORNO, "inbound"]])
        mondo.push(chat({ stato, aperta, contatto: contatto(e, u, d) }));
  c("su 30 chat di ogni tipo nessuna è in Da rispondere E in Da chiamare", 0, mondo.filter(dueVolte).length);
  c("contaSottofiltri e chatDaChiamare non contano chi aspetta", [1, 1],
    [D.contaSottofiltri([chat({ stato: "richiamo", contatto: contatto(GIORNO, GIORNO, "inbound") }), chat({ stato: "richiamo", contatto: contatto(GIORNO, ORA, "outbound") })]).richiamo,
     D.chatDaChiamare([chat({ stato: "richiamo", contatto: contatto(GIORNO, GIORNO, "inbound") }), chat({ stato: "richiamo", contatto: contatto(GIORNO, ORA, "outbound") })], "tutti").length]);
  // ── Senza scheda: la finestra chiusa da sola non basta ──
  c("senza scheda, finestra chiusa, ultimo del cliente (in attesa): NON da chiamare, solo Da rispondere", [null, true],
    [D.statoChiamata(chat({ contatto: contatto(3 * GIORNO, 3 * GIORNO, "inbound") })), chat({ contatto: contatto(3 * GIORNO, 3 * GIORNO, "inbound") }).daRispondere.attesa]);
  c("senza scheda, finestra chiusa, ultimo del cliente ma già 'Fatto' (storico del ponte): NON da chiamare", null,
    D.statoChiamata(chat({ contatto: contatto(3 * GIORNO, 3 * GIORNO, "inbound", { risposto_il: fa(2 * GIORNO) }) })));
  c("senza scheda, finestra chiusa, ultimo MIO: da chiamare (richiesta del 30/10, resta)", "da_chiamare",
    D.statoChiamata(chat({ contatto: contatto(3 * GIORNO, 2 * GIORNO, "outbound") })));
  c("senza scheda, finestra chiusa, nessun dato sull'ultimo messaggio: come prima (da chiamare)", "da_chiamare",
    D.statoChiamata({ lead: null, finestra: { aperta: false } }));
  c("senza scheda, ultimo del cliente letto in pagina: NON da chiamare", null,
    D.statoChiamata({ lead: null, finestra: { aperta: false }, lastMessage: { direction: "inbound", body: "ciao", created_at: fa(5 * GIORNO) } }));

  // ── Il giro automatico (non toccato): cosa fa oggi ──
  const dati = { stato: "attesa_whatsapp", statoPrecedenteIl: fa(4 * GIORNO), statoDal: fa(4 * GIORNO) };
  const adesso = new Date(ADESSO);
  c("cron: il cliente ha scritto DOPO l'ingresso in attesa e nessuno ha risposto: lo stato NON cambia", null,
    A.patchDaChiamare(dati, { ultimoInEntrataIl: fa(2 * GIORNO) }, adesso, []));
  c("cron: ultimo messaggio nostro da più di 10 ore: lo stato diventa da_chiamare (regola 2, invariata)", "da_chiamare",
    A.patchDaChiamare(dati, { ultimoInEntrataIl: fa(3 * GIORNO) }, adesso, [{ direction: "outbound", created_at: fa(2 * GIORNO), canale: "manychat", body: "Ciao, sono Elisa" }])?.stato);
}
