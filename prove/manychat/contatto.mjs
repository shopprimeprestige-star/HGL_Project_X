/** ── PROVE: IL SECONDO STATO, «STATO DEL CONTATTO» ───────────────────────────
 *
 *  Commessa 2026-10-23 (ManyChat), compito 1. Le regole di `contatto.ts`:
 *  dopo un invio si aspetta, una risposta chiude l'attesa, il tempo scaduto
 *  vale «Non ha risposto», STOP non si toglie da soli, un cambio a mano vale
 *  sempre. Tutte funzioni pure: l'orologio entra come argomento.
 *
 *  Date di riferimento (Roma): sabato 17 ottobre 2026 è ancora ora legale
 *  (+02:00); domenica 25 ottobre alle 03:00 torna l'ora solare (+01:00).
 *  Dati inventati, nessun numero né nome vero. */
export async function proveContatto(mod, { c, gruppo }) {
  const K = mod["manychat/contatto"];
  const roma = (iso) => new Date(iso);
  const iso = (d) => (d ? d.toISOString() : d);

  gruppo("MANYCHAT · IL SECONDO STATO");

  /* ── etichette ─────────────────────────────────────────────────────────── */
  c(
    "i sette valori hanno la loro etichetta",
    [
      "Contattato",
      "In attesa",
      "Ha risposto",
      "Non ha risposto",
      "Da ricontattare",
      "Non scrivere (STOP)",
      "Non raggiungibile",
    ],
    K.STATI_CONTATTO.map((s) => K.ETICHETTE_CONTATTO[s]),
  );
  c(
    "…e un tono ciascuno (colore e parola vanno insieme)",
    true,
    K.STATI_CONTATTO.every((s) => typeof K.TONI_CONTATTO[s] === "string"),
  );

  /* ── invio → In attesa ─────────────────────────────────────────────────── */
  const sab = roma("2026-10-17T11:00:00+02:00");
  let ric = K.dopoInvio(undefined, { tipo: "ricontatto", inviatoIl: sab, invioId: "inv-1" });
  let sc = K.applicaCambio(undefined, ric);
  c(
    "invio del ricontatto → In attesa, in automatico, col suo invio",
    ["in_attesa", "automatico", "ricontatto", "inv-1", 1],
    [sc.stato, sc.da, sc.motivo, sc.invioId, sc.storia.length],
  );
  c(
    "sabato 11:00 → scade lunedì 11:00 (la domenica slitta)",
    "2026-10-19T09:00:00.000Z",
    sc.scadeRisposta,
  );
  c(
    "venerdì 11:00 → scade sabato 11:00",
    "2026-10-17T09:00:00.000Z",
    K.applicaCambio(
      undefined,
      K.dopoInvio(undefined, {
        tipo: "ricontatto",
        inviatoIl: roma("2026-10-16T11:00:00+02:00"),
        invioId: "inv-x",
      }),
    ).scadeRisposta,
  );
  c(
    "domenica 11:00 → scade lunedì 11:00 (già lunedì, non slitta oltre)",
    "2026-10-19T09:00:00.000Z",
    K.applicaCambio(
      undefined,
      K.dopoInvio(undefined, {
        tipo: "ricontatto",
        inviatoIl: roma("2026-10-18T11:00:00+02:00"),
        invioId: "inv-x",
      }),
    ).scadeRisposta,
  );
  c(
    "sabato 24/10 11:00 (ora legale) → lunedì 26/10 11:00 (ora solare): resta l'ora di Roma",
    "2026-10-26T10:00:00.000Z",
    K.applicaCambio(
      undefined,
      K.dopoInvio(undefined, {
        tipo: "ricontatto",
        inviatoIl: roma("2026-10-24T11:00:00+02:00"),
        invioId: "inv-x",
      }),
    ).scadeRisposta,
  );
  c(
    "i secondi dell'invio non si perdono",
    "2026-10-17T09:00:30.000Z",
    iso(K.scadenzaRicontatto(roma("2026-10-16T11:00:30+02:00"))),
  );

  //  ── Commessa 2026-10-25: i tipi nuovi.
  const dopo = (i, prima) => K.applicaCambio(prima, K.dopoInvio(prima, i));
  const sabInvio = roma("2026-10-24T11:00:00+02:00");
  for (const tipo of ["primo_contatto", "richiamo_24h"]) {
    const x = dopo({ tipo, inviatoIl: sabInvio, invioId: "inv-n" });
    c(
      `${tipo} → In attesa, scade come il ricontatto (sabato → lunedì alla stessa ora di Roma)`,
      ["in_attesa", "automatico", tipo, "inv-n", "2026-10-26T10:00:00.000Z"],
      [x.stato, x.da, x.motivo, x.invioId, x.scadeRisposta],
    );
  }
  for (const tipo of ["promemoria", "meet_oggi", "promemoria_chiamata", "promemoria_sede"]) {
    const x = dopo({
      tipo,
      inviatoIl: roma("2026-10-27T09:00:00+01:00"),
      inizioMeet: roma("2026-10-27T18:00:00+01:00"),
      invioId: "inv-m",
    });
    c(
      `${tipo} → In attesa, scade all'inizio dell'appuntamento`,
      ["in_attesa", tipo, "2026-10-27T17:00:00.000Z"],
      [x.stato, x.motivo, x.scadeRisposta],
    );
  }
  const adesso = dopo({
    tipo: "meet_adesso",
    inviatoIl: roma("2026-10-27T18:00:30+01:00"),
    invioId: "inv-a",
  });
  c(
    "meet_adesso → «Contattato», SENZA scadenza (chi è entrato nel meet non diventa «Non ha risposto»)",
    ["contattato", "meet_adesso", "inv-a", false],
    [adesso.stato, adesso.motivo, adesso.invioId, "scadeRisposta" in adesso],
  );
  c(
    "…e non scade mai: un giorno dopo è ancora «Contattato»",
    "contattato",
    K.statoContattoEffettivo({ contattoWa: adesso }, roma("2026-10-29T18:00:00+01:00")),
  );
  const attesaPrima = dopo({
    tipo: "meet_oggi",
    inviatoIl: roma("2026-10-27T09:00:00+01:00"),
    inizioMeet: roma("2026-10-27T18:00:00+01:00"),
    invioId: "inv-o",
  });
  const dopoAdesso = dopo(
    { tipo: "meet_adesso", inviatoIl: roma("2026-10-27T18:00:30+01:00"), invioId: "inv-a" },
    attesaPrima,
  );
  c(
    "…sopra una mattina «In attesa» toglie la scadenza vecchia e tiene la storia",
    ["contattato", false, 2],
    [dopoAdesso.stato, "scadeRisposta" in dopoAdesso, dopoAdesso.storia.length],
  );
  c(
    "STOP resta appiccicoso anche per i tipi nuovi: nessun cambio",
    [null, null, null],
    [
      K.dopoInvio(
        { stato: "stop", il: "2026-10-27T08:00:00.000Z", da: "automatico", storia: [] },
        { tipo: "meet_adesso", inviatoIl: sabInvio, invioId: "i" },
      ),
      K.dopoInvio(
        { stato: "stop", il: "2026-10-27T08:00:00.000Z", da: "automatico", storia: [] },
        { tipo: "primo_contatto", inviatoIl: sabInvio, invioId: "i" },
      ),
      K.dopoInvio(
        { stato: "stop", il: "2026-10-27T08:00:00.000Z", da: "automatico", storia: [] },
        { tipo: "meet_oggi", inviatoIl: sabInvio, inizioMeet: sabInvio, invioId: "i" },
      ),
    ],
  );

  c(
    "un nuovo invio porta il suo id e sostituisce quello vecchio",
    "inv-9",
    K.applicaCambio(sc, K.dopoInvio(sc, { tipo: "ricontatto", inviatoIl: sab, invioId: "inv-9" }))
      .invioId,
  );

  /* ── 24 ore senza risposta → Non ha risposto ───────────────────────────── */
  const prima = { contattoWa: sc };
  c(
    "lunedì alle 10:59 è ancora In attesa",
    "in_attesa",
    K.statoContattoEffettivo(prima, roma("2026-10-19T10:59:59+02:00")),
  );
  c(
    "sabato → lunedì 11:00: allo scadere è Non ha risposto",
    "non_ha_risposto",
    K.statoContattoEffettivo(prima, roma("2026-10-19T11:00:00+02:00")),
  );
  c(
    "la domenica in mezzo è ancora In attesa (non scade di domenica)",
    "in_attesa",
    K.statoContattoEffettivo(prima, roma("2026-10-18T11:30:00+02:00")),
  );
  c(
    "senza secondo stato: niente",
    null,
    K.statoContattoEffettivo({}, roma("2026-10-19T12:00:00+02:00")),
  );
  c(
    "scheda vuota o mancante: niente",
    [null, null],
    [K.statoContattoEffettivo(undefined, new Date()), K.statoContattoEffettivo(null, new Date())],
  );
  c(
    "lo stato di sempre non c'entra",
    "in_attesa",
    K.statoContattoEffettivo(
      { stato: "annullato", contattoWa: sc },
      roma("2026-10-17T12:00:00+02:00"),
    ),
  );
  c(
    "una scadenza illeggibile non scade mai da sola",
    "in_attesa",
    K.statoContattoEffettivo(
      { contattoWa: { ...sc, scadeRisposta: "boh" } },
      roma("2030-01-01T00:00:00Z"),
    ),
  );

  //  La storia lo registra al giro successivo: dopoScadenza.
  const tardi = roma("2026-10-19T12:00:00+02:00");
  const scad = K.dopoScadenza(sc, tardi);
  const dopoScad = K.applicaCambio(sc, scad);
  c(
    "il giro registra «Non ha risposto» alla scadenza, con il motivo dell'invio",
    ["non_ha_risposto", "2026-10-19T09:00:00.000Z", "automatico", "ricontatto", 2],
    [dopoScad.stato, dopoScad.il, dopoScad.da, dopoScad.motivo, dopoScad.storia.length],
  );
  c(
    "…e la scadenza non resta più scritta (non è più in attesa)",
    undefined,
    dopoScad.scadeRisposta,
  );
  c("…l'invio resta quello (serve a `p_se_invio`)", "inv-1", dopoScad.invioId);
  c("registrata una volta sola", null, K.dopoScadenza(dopoScad, tardi));
  c(
    "prima della scadenza non registra niente",
    null,
    K.dopoScadenza(sc, roma("2026-10-19T10:59:00+02:00")),
  );
  c("senza secondo stato non registra niente", null, K.dopoScadenza(undefined, tardi));

  /* ── il promemoria scade all'ora del meet ──────────────────────────────── */
  const meet = roma("2026-10-20T15:30:00+02:00");
  const prom = K.applicaCambio(
    undefined,
    K.dopoInvio(undefined, {
      tipo: "promemoria",
      inviatoIl: roma("2026-10-20T15:05:00+02:00"),
      inizioMeet: meet,
      invioId: "inv-2",
    }),
  );
  c(
    "promemoria → In attesa fino all'inizio del meet",
    ["in_attesa", "promemoria", "2026-10-20T13:30:00.000Z"],
    [prom.stato, prom.motivo, prom.scadeRisposta],
  );
  c(
    "alle 15:29 è ancora In attesa",
    "in_attesa",
    K.statoContattoEffettivo({ contattoWa: prom }, roma("2026-10-20T15:29:59+02:00")),
  );
  c(
    "all'ora del meet è Non ha risposto",
    "non_ha_risposto",
    K.statoContattoEffettivo({ contattoWa: prom }, meet),
  );

  /* ── la risposta → Ha risposto ─────────────────────────────────────────── */
  const il = roma("2026-10-18T09:00:00+02:00");
  const ris = K.applicaCambio(sc, K.dopoRisposta(sc, "Sì grazie, va bene giovedì", il));
  c(
    "risposta → Ha risposto, in automatico, con l'anteprima nella storia",
    ["ha_risposto", "automatico", "Sì grazie, va bene giovedì", 2],
    [ris.stato, ris.da, ris.storia[0].anteprima, ris.storia.length],
  );
  c(
    "…la scadenza si toglie, e dopo non diventa mai Non ha risposto",
    ["ha_risposto", undefined],
    [
      K.statoContattoEffettivo({ contattoWa: ris }, roma("2027-01-01T00:00:00Z")),
      ris.scadeRisposta,
    ],
  );
  const lungo = "x".repeat(200);
  c(
    "anteprima: al massimo 80 caratteri",
    80,
    K.applicaCambio(sc, K.dopoRisposta(sc, lungo, il)).storia[0].anteprima.length,
  );
  c(
    "…80 esatti restano interi",
    80,
    K.applicaCambio(sc, K.dopoRisposta(sc, "y".repeat(80), il)).storia[0].anteprima.length,
  );
  const conEmoji = K.applicaCambio(sc, K.dopoRisposta(sc, `${"a".repeat(79)}👍👍`, il)).storia[0]
    .anteprima;
  c(
    "…un'emoji a cavallo del limite non si spezza",
    [true, true],
    [conEmoji.length <= 80, !/[\uD800-\uDBFF]$/.test(conEmoji)],
  );
  //  Un'emoji composta (uomo, donna, bambino: tre emoji unite) resta intera o non c'è.
  const famiglia = "👨‍👩‍👧";
  const conFamiglia = K.applicaCambio(sc, K.dopoRisposta(sc, `${"a".repeat(78)}${famiglia}`, il))
    .storia[0].anteprima;
  c(
    "…un'emoji composta a cavallo del limite non si spezza",
    ["a".repeat(78), true],
    [conFamiglia, conFamiglia.length <= 80],
  );
  c(
    "…se ci sta tutta, resta intera",
    "a".repeat(70) + famiglia,
    K.applicaCambio(sc, K.dopoRisposta(sc, "a".repeat(70) + famiglia, il)).storia[0].anteprima,
  );
  c(
    "…a-capo e spazi doppi diventano uno spazio",
    "Sì, ok",
    K.applicaCambio(sc, K.dopoRisposta(sc, "  Sì,\n\n ok ", il)).storia[0].anteprima,
  );
  const vuota = K.applicaCambio(sc, K.dopoRisposta(sc, "", il));
  c(
    "risposta senza testo (una foto): Ha risposto, senza anteprima",
    ["ha_risposto", undefined],
    [vuota.stato, vuota.storia[0].anteprima],
  );
  c(
    "risposta a chi non aveva ricevuto niente (Default Reply): Ha risposto",
    "ha_risposto",
    K.applicaCambio(undefined, K.dopoRisposta(undefined, "Buongiorno", il)).stato,
  );
  c(
    "risposta dopo il «Non ha risposto»: torna Ha risposto",
    "ha_risposto",
    K.applicaCambio(dopoScad, K.dopoRisposta(dopoScad, "Scusate, rispondo ora", il)).stato,
  );

  /* ── STOP ──────────────────────────────────────────────────────────────── */
  for (const t of [
    "STOP",
    "Basta!",
    "cancellatemi",
    "Cancellatemi dalla lista, grazie",
    "Non scrivete più",
    "non scrivermi piu",
    "Non mi scrivete più",
    "non mi scrivere più",
    "Non mi scrivi più, grazie",
    "Non mi contattate più",
    "non mi contattare piu",
    "Non mi mandate più niente",
    "Toglietemi dalla lista",
    "Non voglio più messaggi",
  ]) {
    c(`«${t}» è uno STOP`, true, K.eStop(t));
  }
  for (const t of [
    "Sì grazie",
    "ok",
    "Va bene, a giovedì",
    "non ho capito",
    "",
    null,
    "Posso spostare l'appuntamento?",
    "Mi scrivete domani?",
    "Non mi è arrivato il link",
    "Mi contattate voi alle 15?",
    //  Le quattro del revisore: parlano di un appuntamento, non sono un addio.
    "Scusi, cancellami l'appuntamento di domani",
    "puoi cancellarmi la prenotazione?",
    "non contattatemi prima delle 18",
    "toglietemi una curiosità: è doloroso?",
    "Cancellatemi la consulenza di giovedì",
    "Non contattatemi in orario di lavoro",
  ]) {
    c(`«${t ?? "(niente)"}» non è uno STOP`, false, K.eStop(t));
  }
  for (const t of [
    "cancellatemi",
    "Cancellami, grazie",
    "non contattatemi",
    "Non contattatemi più",
    "toglietemi",
    "Cancellarmi dalla vostra lista per favore",
    "non scrivetemi più",
    "STOP",
  ]) {
    c(`«${t}» resta uno STOP (nessun appuntamento nel testo)`, true, K.eStop(t));
  }
  const stop = K.applicaCambio(sc, K.dopoRisposta(sc, "STOP", il));
  c(
    "STOP → Non scrivere, senza tenere il testo",
    ["stop", "stop", "automatico", undefined],
    [stop.stato, stop.motivo, stop.da, stop.storia[0].anteprima],
  );
  c(
    "«cancellatemi» → Non scrivere",
    "stop",
    K.applicaCambio(undefined, K.dopoRisposta(undefined, "Cancellatemi per favore", il)).stato,
  );
  c("STOP già in corso: nessun cambio doppio", null, K.dopoRisposta(stop, "stop", il));
  c(
    "dopo STOP, un messaggio qualsiasi non lo toglie",
    null,
    K.dopoRisposta(stop, "Ciao, scusate", il),
  );
  c(
    "dopo STOP, un nuovo invio automatico non lo toglie",
    null,
    K.dopoInvio(stop, { tipo: "ricontatto", inviatoIl: il, invioId: "inv-x" }),
  );
  c("dopo STOP, un rifiuto non lo toglie", null, K.dopoRifiuto(stop, "numero non su WhatsApp", il));
  c("dopo STOP, la scadenza non lo tocca", null, K.dopoScadenza(stop, tardi));

  /* ── rifiuto → Non raggiungibile ───────────────────────────────────────── */
  const rif = K.applicaCambio(undefined, K.dopoRifiuto(undefined, "numero non su WhatsApp", il));
  c(
    "invio rifiutato → Non raggiungibile, col motivo",
    ["non_raggiungibile", "numero non su WhatsApp", "automatico"],
    [rif.stato, rif.motivo, rif.da],
  );

  /* ── un cambio a mano vale sempre, e sblocca ───────────────────────────── */
  const mano = roma("2026-10-20T12:00:00+02:00");
  const bloccato = { ...sc, sbloccatoIl: "2026-10-01T08:00:00.000Z" };
  const aMano = (prima, nuovo, chi = "Mario", puoTogliereStop = false) =>
    K.cambioAMano(prima, nuovo, chi, mano, puoTogliereStop);
  for (const nuovo of ["contattato", "ha_risposto", "da_ricontattare"]) {
    const r = aMano(bloccato, nuovo);
    const dopo = K.applicaCambio(bloccato, r.cambio);
    c(
      `a mano «${K.ETICHETTE_CONTATTO[nuovo]}» sblocca il freno «mai due volte senza risposta»`,
      [true, nuovo, "Mario", mano.toISOString()],
      [r.ok, dopo.stato, dopo.da, dopo.sbloccatoIl],
    );
  }
  for (const nuovo of ["in_attesa", "non_ha_risposto", "non_raggiungibile"]) {
    const dopo = K.applicaCambio(bloccato, aMano(bloccato, nuovo).cambio);
    c(
      `a mano «${K.ETICHETTE_CONTATTO[nuovo]}» vale ma NON sblocca`,
      [nuovo, "2026-10-01T08:00:00.000Z"],
      [dopo.stato, dopo.sbloccatoIl],
    );
  }
  const unaMano = K.applicaCambio(bloccato, aMano(bloccato, "contattato").cambio);
  c(
    "il cambio a mano entra nella storia col nome di chi l'ha fatto",
    [["contattato", "Mario", mano.toISOString()], 2],
    [[unaMano.storia[0].stato, unaMano.storia[0].da, unaMano.storia[0].il], unaMano.storia.length],
  );
  c(
    "…tiene l'invio precedente quando il cambio non ne porta uno",
    "inv-1",
    K.applicaCambio(bloccato, aMano(bloccato, "da_ricontattare", "Anna").cambio).invioId,
  );
  c(
    "una scheda mai toccata si può segnare a mano",
    ["contattato", "Anna"],
    (() => {
      const d = K.applicaCambio(undefined, aMano(undefined, "contattato", "Anna").cambio);
      return [d.stato, d.da];
    })(),
  );

  /* ── STOP: lo si mette in due, lo si toglie in uno ─────────────────────── */
  const rMetti = aMano(sc, "stop", "Giulia");
  c(
    "a mano STOP lo può mettere chiunque, e va scritto anche sul numero",
    [true, true, false],
    [rMetti.ok, rMetti.mettiStop, rMetti.togliStop],
  );
  const rNo = aMano(stop, "contattato", "Giulia", false);
  c(
    "togliere STOP senza permesso → errore, nessun cambio",
    [false, "solo_titolare_toglie_stop", undefined],
    [rNo.ok, rNo.errore, rNo.cambio],
  );
  c("…il messaggio dice a chi chiedere", true, /impostazioni/.test(rNo.messaggio));
  const rSi = aMano(stop, "contattato", "Titolare", true);
  const dopoSi = K.applicaCambio(stop, rSi.cambio);
  c(
    "togliere STOP col permesso: ok, va azzerato il numero, e sblocca",
    [true, true, false, "contattato", mano.toISOString()],
    [rSi.ok, rSi.togliStop, rSi.mettiStop, dopoSi.stato, dopoSi.sbloccatoIl],
  );
  c(
    "da STOP a STOP col permesso non è «togliere»",
    [true, false],
    (() => {
      const r = aMano(stop, "stop", "Titolare", true);
      return [r.ok, r.togliStop];
    })(),
  );
  c(
    "senza permesso, STOP → STOP passa (non toglie niente)",
    true,
    aMano(stop, "stop", "Giulia", false).ok,
  );

  /* ── la storia: al massimo 20, la più nuova in testa ───────────────────── */
  let s = undefined;
  for (let i = 0; i < 25; i++)
    s = K.applicaCambio(
      s,
      K.cambioAMano(
        s,
        i % 2 ? "contattato" : "da_ricontattare",
        `Persona ${i}`,
        new Date(Date.parse("2026-10-20T08:00:00Z") + i * 60_000),
        true,
      ).cambio,
    );
  c(
    "storia tagliata a 20",
    [20, "Persona 24", "Persona 5"],
    [s.storia.length, s.storia[0].da, s.storia[19].da],
  );
  c("…lo stato corrente è l'ultimo cambio", ["da_ricontattare", "Persona 24"], [s.stato, s.da]);
  c("il tetto è una costante, non un numero sparso", 20, K.MAX_STORIA);
  const congelato = Object.freeze({ ...sc, storia: Object.freeze([...sc.storia]) });
  c(
    "applicaCambio non cambia la scheda di partenza",
    "in_attesa",
    (() => {
      K.applicaCambio(congelato, K.dopoRisposta(congelato, "ok", il));
      return congelato.stato;
    })(),
  );

  /* ── filtro uguale dappertutto ─────────────────────────────────────────── */
  const schede = [
    { id: "a", data: { contattoWa: ris } },
    { id: "b", data: { contattoWa: sc } },
    { id: "c", data: { contattoWa: stop } },
    { id: "d", data: {} },
    { id: "e", data: { contattoWa: dopoScad } },
    { id: "f", data: { contattoWa: { ...sc, storia: [] } } },
  ];
  const ids = (f, adesso) => K.filtraPerContatto(schede, f, adesso).map((x) => x.id);
  c("filtro per «Ha risposto»", ["a"], ids("ha_risposto", tardi));
  c(
    "filtro «In attesa» prima della scadenza",
    ["b", "f"],
    ids("in_attesa", roma("2026-10-18T12:00:00+02:00")),
  );
  c(
    "filtro «Non ha risposto» conta anche chi è scaduto senza registrazione",
    ["b", "e", "f"],
    ids("non_ha_risposto", tardi),
  );
  c("…e allora «In attesa» non li mostra più", [], ids("in_attesa", tardi));
  c("filtro «Non scrivere (STOP)»", ["c"], ids("stop", tardi));
  c("filtro «nessuno»: schede senza secondo stato", ["d"], ids("nessuno", tardi));
  c("filtro «tutti»: nessun filtro", ["a", "b", "c", "d", "e", "f"], ids("tutti", tardi));
  c("filtro non riconosciuto: nessun filtro", ["a", "b", "c", "d", "e", "f"], ids("boh", tardi));

  /* ── l'ora di Roma → un istante ────────────────────────────────────────── */
  c(
    "istanteDiRoma: ora legale",
    "2026-10-20T13:30:00.000Z",
    iso(K.istanteDiRoma("2026-10-20", "15:30")),
  );
  c(
    "istanteDiRoma: ora solare",
    "2026-10-26T10:30:00.000Z",
    iso(K.istanteDiRoma("2026-10-26", "11:30")),
  );
  c(
    "istanteDiRoma: un'ora scritta con una cifra",
    "2026-10-20T07:05:00.000Z",
    iso(K.istanteDiRoma("2026-10-20", "9:05")),
  );
  c(
    "istanteDiRoma: la notte del cambio, prima (01:30 è ancora ora legale)",
    "2026-10-24T23:30:00.000Z",
    iso(K.istanteDiRoma("2026-10-25", "01:30")),
  );
  c(
    "istanteDiRoma: 02:30 del 25/10 esiste due volte, vale la prima",
    "2026-10-25T00:30:00.000Z",
    iso(K.istanteDiRoma("2026-10-25", "02:30")),
  );
  c(
    "istanteDiRoma: 02:30 del 29/03 non esiste, vale la prima ora dopo il salto",
    "2026-03-29T01:30:00.000Z",
    iso(K.istanteDiRoma("2026-03-29", "02:30")),
  );
  c(
    "istanteDiRoma: dati illeggibili → niente",
    [null, null, null],
    [
      K.istanteDiRoma("2026-13-40", "10:00"),
      K.istanteDiRoma("2026-10-20", "25:00"),
      K.istanteDiRoma("", ""),
    ],
  );
}
