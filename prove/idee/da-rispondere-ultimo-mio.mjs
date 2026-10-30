/** ── PROVE: «DA RISPONDERE» SOLO SE L'ULTIMO MESSAGGIO È DEL CLIENTE (30/10/2026) ──────────────
 *  Regole del titolare (commessa 2026-10-30-da-rispondere-ultimo-mio):
 *   1. Da rispondere = l'ultimo messaggio è del cliente. Se è mio, da QUALUNQUE canale (CRM, modello
 *      automatico ManyChat, inbox, telefono col ponte), NON lo è.
 *   4. Una chat non sta mai in Da rispondere e Da chiamare insieme: vince Da rispondere.
 *   5. Se l'ultimo è del cliente e mi dimentico di rispondere, RESTA in Da rispondere anche a
 *      finestra chiusa e dopo giorni: il tempo non la sposta in Da chiamare.
 *  Dati inventati (orari e numeri finti). */

export async function proveDaRispondereUltimoMio(mod, { c, gruppo, radice }) {
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

  // ── Sconosciuti: oltre 60 giorni di silenzio non sono «Da chiamare» ──
  gruppo("DA CHIAMARE: I NUMERI SENZA SCHEDA FERMI DA PIÙ DI 60 GIORNI RESTANO SOLO «SCONOSCIUTI»");
  const sc = (giorniFa, direzione = "outbound", extra = {}) => ({
    lead: null,
    finestra: { aperta: false },
    lastMessage: { direction: direzione, body: "ciao", created_at: fa(giorniFa * GIORNO) },
    ...extra,
  });
  const GG = D.GIORNI_SCONOSCIUTI_DA_CHIAMARE;
  c("la costante è 60", 60, GG);
  c("ultimo mio 59 giorni fa: da chiamare", "da_chiamare", D.statoChiamata(sc(59), ADESSO));
  c("ultimo mio esattamente 60 giorni fa: da chiamare (il bordo è dentro)", "da_chiamare", D.statoChiamata(sc(60), ADESSO));
  c("ultimo mio 60 giorni e 1 secondo fa: NON da chiamare", null,
    D.statoChiamata({ ...sc(60), lastMessage: { direction: "outbound", body: "x", created_at: fa(60 * GIORNO + 1000) } }, ADESSO));
  c("ultimo mio 200 giorni fa: NON da chiamare", null, D.statoChiamata(sc(200), ADESSO));
  c("vale per l'ultimo messaggio di qualunque direzione (cliente vecchio: nemmeno da chiamare)", null, D.statoChiamata(sc(200, "inbound"), ADESSO));
  c("l'età si legge anche dal contatto (ultimo_messaggio_il)", [null, "da_chiamare"],
    [D.statoChiamata({ lead: null, finestra: { aperta: false }, contact: { ultimo_messaggio_il: fa(90 * GIORNO), ultimo_messaggio_direzione: "outbound" } }, ADESSO),
     D.statoChiamata({ lead: null, finestra: { aperta: false }, contact: { ultimo_messaggio_il: fa(10 * GIORNO), ultimo_messaggio_direzione: "outbound" } }, ADESSO)]);
  c("con la scheda l'età non c'entra (stato richiamo vecchio di 200 giorni resta da chiamare)", "richiamo",
    D.statoChiamata({ lead: { data: { stato: "richiamo" } }, lastMessage: sc(200).lastMessage }, ADESSO));
  c("senza data sull'ultimo messaggio: come prima (da chiamare)", "da_chiamare", D.statoChiamata({ lead: null, finestra: { aperta: false } }, ADESSO));

  // ── Il giro attesa-da-chiamare: l'ultima parola del cliente non lo sposta ──
  gruppo("GIRO ATTESA → DA CHIAMARE: SE L'ULTIMO MESSAGGIO È DEL CLIENTE NON SI SPOSTA");
  const dati2 = { stato: "attesa_whatsapp", statoPrecedenteIl: fa(3 * GIORNO), statoDal: fa(3 * GIORNO) };
  const NUMERO = "393330000009";
  const nostro = (ms, extra = {}) => ({ direction: "outbound", created_at: fa(ms), canale: "manychat", body: "Ciao, sono Elisa", from_number: "manychat", to_number: NUMERO, ...extra });
  const suo = (ms, body = "Salve, quanto costa?", extra = {}) => ({ direction: "inbound", created_at: fa(ms), canale: "manychat", body, from_number: NUMERO, to_number: "manychat", ...extra });
  const patch = (contattoWa, messaggi = []) => A.patchDaChiamare(dati2, contattoWa, adesso, messaggi)?.stato ?? null;
  c("cliente ha scritto PRIMA dell'ingresso nello stato, nessun nostro messaggio nei 7 giorni, contatto dice «ultimo in entrata»: NON si sposta", null,
    patch({ ultimoInEntrataIl: fa(4 * GIORNO), ultimoMessaggioIl: fa(4 * GIORNO), ultimoMessaggioDirezione: "inbound" }));
  c("…stesso caso ma il contatto dice che l'ultimo è nostro: si sposta", "da_chiamare",
    patch({ ultimoInEntrataIl: fa(5 * GIORNO), ultimoMessaggioIl: fa(4 * GIORNO), ultimoMessaggioDirezione: "outbound" }));
  c("ultimo messaggio del cliente DOPO il nostro (nei messaggi caricati): non si sposta", null,
    patch({ ultimoInEntrataIl: fa(GIORNO), ultimoMessaggioIl: fa(GIORNO), ultimoMessaggioDirezione: "inbound" }, [nostro(2 * GIORNO), suo(GIORNO)]));
  c("ultimo dato del contatto in entrata e nostro messaggio più vecchio caricato: non si sposta", null,
    patch({ ultimoInEntrataIl: fa(2 * GIORNO), ultimoMessaggioIl: fa(2 * GIORNO), ultimoMessaggioDirezione: "inbound" }, [nostro(3 * GIORNO)]));
  c("l'eco di un nostro messaggio (stesso testo, 20 s dopo) non è il cliente: si sposta", "da_chiamare",
    patch({ ultimoInEntrataIl: fa(2 * GIORNO - 20_000), ultimoMessaggioIl: fa(2 * GIORNO - 20_000), ultimoMessaggioDirezione: "inbound" },
      [nostro(2 * GIORNO), suo(2 * GIORNO - 20_000, "Ciao, sono Elisa")]));
  c("un nostro invio NON partito (failed) non è una risposta: nessuna attesa da contare, non si sposta", null,
    patch({ ultimoInEntrataIl: fa(GIORNO), ultimoMessaggioIl: fa(GIORNO), ultimoMessaggioDirezione: "inbound" }, [nostro(2 * GIORNO, { status: "failed" }), suo(GIORNO)]));
  c("un failed recente non fa partire l'attesa di 10 ore: solo il messaggio partito conta", "da_chiamare",
    patch({ ultimoInEntrataIl: null, ultimoMessaggioDirezione: "outbound", ultimoMessaggioIl: fa(2 * GIORNO) }, [nostro(2 * GIORNO), nostro(ORA, { status: "failed" })]));
  c("senza i dati nuovi del contatto: vale la regola di prima (invariata)", "da_chiamare",
    patch({ ultimoInEntrataIl: fa(4 * GIORNO) }));

  // ── Il numeretto del menu con un database finto ──
  gruppo("MENU «DA RISPONDERE»: STESSA REGOLA DELLA PAGINA, ANCHE CON GLI INVII FALLITI E LA COLONNA MANCANTE");
  const M = mod["chatwa/menuDaRispondere"];
  const riga = (id, n, entrataFa, ultimoFa, dir, extra = {}) => ({
    id, phone_e164: `+3933300000${n}`, ultimo_in_entrata_il: fa(entrataFa), ultimo_in_entrata_anteprima: "Ciao", risposto_il: null,
    ultimo_messaggio_il: ultimoFa === null ? null : fa(ultimoFa), ultimo_messaggio_direzione: dir, ...extra,
  });
  /** Un database finto: registra cosa gli si chiede. `falliti` = invii nostri non partiti. */
  const finto = (righe, { falliti = [], senzaColonne = false, erroreFalliti = false } = {}) => {
    const visto = { colonne: [], richiesteFalliti: 0 };
    return {
      visto,
      porte: {
        contatti: async (colonne, da, a) => {
          visto.colonne.push(colonne);
          if (senzaColonne && /ultimo_messaggio/.test(colonne)) return { data: null, error: { code: "42703", message: "column does not exist" } };
          const tolte = righe.map((r) => (senzaColonne ? { ...r, ultimo_messaggio_il: undefined, ultimo_messaggio_direzione: undefined } : r));
          return { data: tolte.slice(da, a + 1), error: null };
        },
        fallitiDi: async () => {
          visto.richiesteFalliti++;
          return erroreFalliti ? null : falliti;
        },
      },
    };
  };
  const conta = async (righe, opz) => {
    const f = finto(righe, opz);
    return [await M.contaDalDatabase(f.porte, new Date(ADESSO)), f.visto];
  };
  {
    const aspetta = riga("a", "01", 2 * GIORNO, 2 * GIORNO, "inbound");
    const automatico = riga("b", "02", 2 * ORA, ORA, "outbound");
    const telefono = riga("c", "03", 3 * GIORNO, 2 * GIORNO, "outbound", { risposto_il: fa(9 * GIORNO) });
    const [n, visto] = await conta([aspetta, automatico, telefono]);
    c("menu: aspetta 1, automatico e telefono no", 1, n);
    c("menu: chiede le colonne dell'ultimo messaggio", true, /ultimo_messaggio_il,ultimo_messaggio_direzione/.test(visto.colonne[0]));
    c("menu: i due chiusi dall'ultimo messaggio fanno controllare i falliti (una richiesta)", 1, visto.richiesteFalliti);

    //  Il caso del revisore: il cliente scrive e il nostro invio FALLISCE (ManyChat lo registra come outbound).
    const fallito = riga("d", "04", 2 * GIORNO, GIORNO, "outbound");
    const falliti = [{ to_number: "+393330000004", created_at: fa(GIORNO) }];
    const [conFallito] = await conta([fallito], { falliti });
    const pagina = S.daRispondere({
      contatto: fallito, messaggi: [], adesso: ADESSO,
      ultimo: { direction: "outbound", created_at: fa(GIORNO), status: "failed" },
    }).attesa;
    c("invio FALLITO dopo il cliente: la pagina lo tiene in attesa e il menu lo conta (stessa risposta)", [true, 1], [pagina, conFallito]);
    const [conPartito] = await conta([fallito], { falliti: [] });
    const paginaPartito = S.daRispondere({ contatto: fallito, messaggi: [], adesso: ADESSO, ultimo: { direction: "outbound", created_at: fa(GIORNO), status: "sent" } }).attesa;
    c("lo stesso contatto con invio PARTITO: pagina e menu lo tolgono entrambi", [false, 0], [paginaPartito, conPartito]);
    const [altroFallito] = await conta([fallito], { falliti: [{ to_number: "+393330000004", created_at: fa(5 * GIORNO) }] });
    c("un fallito di un altro istante (non l'ultimo messaggio) non riapre la chat", 0, altroFallito);
    const [conFormaSenzaPiu] = await conta([fallito], { falliti: [{ to_number: "393330000004", created_at: fa(GIORNO) }] });
    c("il numero del fallito scritto senza «+» combacia lo stesso", 1, conFormaSenzaPiu);
    const [nessunChiuso, v2] = await conta([aspetta]);
    c("se nessuno è chiuso dall'ultimo messaggio non si chiede niente sui falliti", [1, 0], [nessunChiuso, v2.richiesteFalliti]);
    const [errore] = await conta([fallito], { erroreFalliti: true });
    c("se la lettura dei falliti non riesce il conto è «non so» (l'hook tiene il numero di prima)", null, errore);
  }
  {
    //  Colonna mancante: migrazione dell'ultimo messaggio non applicata.
    const [n, visto] = await conta([riga("a", "01", 2 * GIORNO, null, null), riga("b", "02", 2 * GIORNO, null, null, { risposto_il: fa(GIORNO) })], { senzaColonne: true });
    c("colonna mancante: si ripiega sulle colonne di prima e si conta (1 aspetta, 1 con risposto_il)", 1, n);
    c("…chiedendo prima le colonne nuove, poi quelle di base", [true, false], [/ultimo_messaggio/.test(visto.colonne[0]), /ultimo_messaggio/.test(visto.colonne[1])]);
    const errore = await M.contaDalDatabase({ contatti: async () => ({ data: null, error: { code: "08006", message: "rete" } }), fallitiDi: async () => [] }, new Date(ADESSO));
    c("un altro errore del database: «non so» (null), non zero", null, errore);
    const tanti = Array.from({ length: 1500 }, (_, i) => riga(`x${i}`, String(i % 90).padStart(2, "0"), GIORNO, GIORNO, "inbound"));
    const [nTanti] = await conta(tanti);
    c("più di 1000 contatti: si leggono tutte le pagine", 1500, nTanti);
  }
}
