/** ── PROVE: IL FILTRO PER GIORNO DENTRO OGNI FILTRO DELLA CHAT (09/11/2026, rifatto il 16/11/2026) ──
 *  Regole in src/crm/chatwa/giorno.ts (data per filtro, fuso di Roma; Tutti · Scaduti · Ieri · Oggi ·
 *  Domani · Prossimi giorni · Senza data) e filtri.ts (il campo interno `giorno`, i conteggi). Il
 *  disegno è in RigaGiorno.tsx e ElencoChat.tsx.
 *  L'ora «adesso» è sempre un parametro: ogni prova la fissa, niente orologio vero.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveFiltroGiorno(mod, { c, gruppo, radice }) {
  const G = mod["chatwa/giorno"];
  const F = mod["chatwa/filtri"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const V = F.FILTRI_VUOTI;
  const con = (patch) => ({ ...V, ...patch });
  const quando = (iso) => new Date(iso);

  // ── Giorni e settimane, a Roma ───────────────────────────────────────────────────────────────
  gruppo("FILTRO GIORNO: AGGIUNGERE GIORNI (mesi, anni, bisestile)");
  c("+1 a fine anno", "2027-01-01", G.aggiungiGiorni("2026-12-31", 1));
  c("-1 a inizio anno", "2025-12-31", G.aggiungiGiorni("2026-01-01", -1));
  c("febbraio bisestile", "2028-02-29", G.aggiungiGiorni("2028-02-28", 1));
  c("febbraio non bisestile", "2027-03-01", G.aggiungiGiorni("2027-02-28", 1));
  c("+7 attraversa il mese", "2026-12-03", G.aggiungiGiorni("2026-11-26", 7));

  gruppo("FILTRO GIORNO: IL GIORNO DI ROMA (non quello del server)");
  //  9/11/2026 è un lunedì; a novembre Roma è UTC+1.
  c("mezzogiorno di lunedì", "2026-11-09", G.giornoDiRoma(quando("2026-11-09T11:00:00Z")));
  c("22:59:59Z è ancora lunedì a Roma", "2026-11-09", G.giornoDiRoma(quando("2026-11-09T22:59:59Z")));
  c("23:00:00Z è già martedì a Roma", "2026-11-10", G.giornoDiRoma(quando("2026-11-09T23:00:00Z")));
  c("23:30Z di domenica è lunedì a Roma", "2026-11-09", G.giornoDiRoma(quando("2026-11-08T23:30:00Z")));
  //  Estate: UTC+2 (il 15/7/2026 è un mercoledì).
  c("estate 21:59Z = 23:59 a Roma", "2026-07-15", G.giornoDiRoma(quando("2026-07-15T21:59:00Z")));
  c("estate 22:00Z = mezzanotte a Roma", "2026-07-16", G.giornoDiRoma(quando("2026-07-15T22:00:00Z")));
  //  Cambio dell'ora legale: il 25/10/2026 alle 03:00 (01:00Z) si torna indietro.
  c("notte del cambio: 22:30Z del 24/10 è il 25 a Roma", "2026-10-25", G.giornoDiRoma(quando("2026-10-24T22:30:00Z")));
  c("…e 22:30Z del 25/10 è ancora il 25 (ora solare)", "2026-10-25", G.giornoDiRoma(quando("2026-10-25T22:30:00Z")));
  c("…e 23:30Z del 25/10 è il 26", "2026-10-26", G.giornoDiRoma(quando("2026-10-25T23:30:00Z")));
  c("un istante che non è una data non ha giorno", "", G.giornoDiRoma(quando("non-una-data")));

  gruppo("FILTRO GIORNO: GLI INTERVALLI (scaduti e prossimi giorni sono aperti, senza limite)");
  const lun = quando("2026-11-09T10:00:00Z"); //  lunedì 9/11/2026, le 11:00 a Roma
  c("oggi", { da: "2026-11-09", a: "2026-11-09" }, G.intervalloGiorno("oggi", lun));
  c("ieri", { da: "2026-11-08", a: "2026-11-08" }, G.intervalloGiorno("ieri", lun));
  c("domani", { da: "2026-11-10", a: "2026-11-10" }, G.intervalloGiorno("domani", lun));
  c("scaduti: nessun limite inferiore, fino a due giorni fa (ieri è un segmento suo)", { da: null, a: "2026-11-07" }, G.intervalloGiorno("scaduti", lun));
  c("prossimi giorni: da dopodomani, nessun limite superiore (domani è un segmento suo)", { da: "2026-11-11", a: null }, G.intervalloGiorno("prossimi-giorni", lun));
  c("«Tutti» non ha intervallo", null, G.intervalloGiorno("", lun));
  c("«Senza data» non è un intervallo di calendario", null, G.intervalloGiorno("senza-data", lun));
  c("un valore sconosciuto non ha intervallo", null, G.intervalloGiorno("tra-un-mese", lun));

  gruppo("FILTRO GIORNO: «IN QUALE GIORNO CADE»");
  c("lo stesso giorno è «oggi»", true, G.inGiorno("2026-11-09", "oggi", lun));
  c("il giorno dopo è «domani»", true, G.inGiorno("2026-11-10", "domani", lun));
  c("«Tutti» fa passare anche chi non ha giorno", true, G.inGiorno("", "", lun));

  gruppo("FILTRO GIORNO: I CONFINI ESATTI DI «SCADUTI» E «PROSSIMI GIORNI» (ANALISI D5)");
  c("oggi-1 è «Ieri», non «Scaduti»", [true, false], [G.inGiorno("2026-11-08", "ieri", lun), G.inGiorno("2026-11-08", "scaduti", lun)]);
  c("oggi-2 è «Scaduti», non «Ieri»", [false, true], [G.inGiorno("2026-11-07", "ieri", lun), G.inGiorno("2026-11-07", "scaduti", lun)]);
  c("un arretrato di 6 mesi è ancora «Scaduti»: nessun limite inferiore", true, G.inGiorno("2026-05-09", "scaduti", lun));
  c("oggi stesso non è «Scaduti»", false, G.inGiorno("2026-11-09", "scaduti", lun));
  c("oggi+1 è «Domani», non «Prossimi giorni»", [true, false], [G.inGiorno("2026-11-10", "domani", lun), G.inGiorno("2026-11-10", "prossimi-giorni", lun)]);
  c("oggi+2 è «Prossimi giorni», non «Domani»", [false, true], [G.inGiorno("2026-11-11", "domani", lun), G.inGiorno("2026-11-11", "prossimi-giorni", lun)]);
  c("una data di 6 mesi avanti è ancora «Prossimi giorni»: nessun limite superiore", true, G.inGiorno("2027-05-09", "prossimi-giorni", lun));

  gruppo("FILTRO GIORNO: «SENZA DATA» NON È UN GIORNO DEL CALENDARIO");
  c("senza giorno passa SOLO «Tutti» e «Senza data», nessun altro segmento (nemmeno «Scaduti»)", [true, false, false, false, false, false, true], ["", "scaduti", "ieri", "oggi", "domani", "prossimi-giorni", "senza-data"].map((s) => G.inGiorno("", s, lun)));
  c("con un giorno vero non passa «Senza data»", false, G.inGiorno("2026-11-09", "senza-data", lun));

  // ── Quale data per quale filtro ──────────────────────────────────────────────────────────────
  let n = 0;
  const chat = (o = {}) => {
    n++;
    return {
      phone: `+39333444${String(n).padStart(4, "0")}`,
      lead: o.senzaScheda
        ? null
        : {
            created_at: o.created_at,
            data: {
              stato: o.stato ?? "da_contattare",
              consulenteId: o.consulente ?? null,
              dataRicontatto: o.ricontatto,
              dataMeeting: o.meeting,
              dataVieneInSede: o.sede,
              createdAt: o.arrivo,
              payment: o.acconto ? { accontoPagato: o.acconto } : null,
            },
          },
      lastMessage: o.ultimo ? { created_at: o.ultimo, direction: o.direzione ?? "inbound", status: "received" } : null,
      contact: o.contatto ?? null,
      finestra: o.aperta === undefined ? null : { aperta: o.aperta },
      daRispondere: { attesa: o.attesa === true },
    };
  };
  const giornoDi = (ch, f) => G.dataPerGiorno(ch, f);

  gruppo("FILTRO GIORNO: LA DATA GIUSTA PER OGNI FILTRO");
  //  Una chat con TUTTE le date diverse: si vede subito quale viene scelta.
  const tutte = chat({
    stato: "sta_valutando",
    ricontatto: "2026-11-12",
    meeting: "2026-11-13",
    sede: "2026-11-14",
    ultimo: "2026-11-09T09:00:00Z",
    arrivo: "2026-11-01T09:00:00Z",
    acconto: 100,
    attesa: true,
    aperta: true,
  });
  c("Ricontatti: il giorno del ricontatto", "2026-11-12", giornoDi(tutte, con({ ricontatti: true })));
  c("stato a data (In valutazione): il giorno del ricontatto", "2026-11-12", giornoDi(tutte, con({ fase: "stato:sta_valutando" })));
  c("Per ora no: il giorno del ricontatto", "2026-12-01", giornoDi(chat({ stato: "per_ora_no", ricontatto: "2026-12-01", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "per-ora-no" })));
  c("stato con la consulenza (Appuntamento fissato): il giorno della consulenza", "2026-11-13", giornoDi(chat({ stato: "appuntamento_fissato", meeting: "2026-11-13", ricontatto: "2026-11-12", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "stato:appuntamento_fissato" })));
  c("Appuntamento rifissato: idem", "2026-11-13", giornoDi(chat({ stato: "appuntamento_rifissato", meeting: "2026-11-13", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "stato:appuntamento_rifissato" })));
  c("Da riprogrammare: la nuova data della consulenza", "2026-11-17", giornoDi(chat({ stato: "da_spostare", meeting: "2026-11-17", ricontatto: "2026-11-10" }), con({ fase: "stato:da_spostare" })));
  c("Appuntamento in sede: il giorno della visita in sede", "2026-11-14", giornoDi(chat({ stato: "viene_in_sede", sede: "2026-11-14", meeting: "2026-11-13", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "stato:viene_in_sede" })));
  c("Da rispondere: il giorno dell'ultimo messaggio", "2026-11-09", giornoDi(tutte, con({ coda: "da-rispondere" })));
  c("Da chiamare, stato con una regola: la data di quella regola (16/11/2026)", "2026-11-12", giornoDi(tutte, con({ coda: "da-chiamare" })));
  //  Revisione 16/11/2026 (decisione del capo progetto): una data di richiamo/ricontatto scritta vince
  //  sempre sul ripiego dell'ultimo messaggio, anche per gli stati senza regola.
  c("Da chiamare, stato senza regola (Non risponde) ma con un richiamo scritto: il richiamo", "2026-11-20", giornoDi(chat({ stato: "non_risponde", ultimo: "2026-11-09T09:00:00Z", ricontatto: "2026-11-20" }), con({ coda: "da-chiamare" })));
  c("Da chiamare, stato senza regola e senza richiamo scritto: l'ultimo messaggio", "2026-11-09", giornoDi(chat({ stato: "non_risponde", ultimo: "2026-11-09T09:00:00Z" }), con({ coda: "da-chiamare" })));
  c("Con stelle: il giorno dell'ultimo messaggio", "2026-11-09", giornoDi(tutte, con({ stelle: true })));
  c("Finestra: il giorno dell'ultimo messaggio", "2026-11-09", giornoDi(tutte, con({ finestra: "aperta" })));
  c("Acconto: il giorno dell'ultimo messaggio", "2026-11-09", giornoDi(tutte, con({ acconto: true })));
  c("Tipo: il giorno dell'ultimo messaggio", "2026-11-09", giornoDi(tutte, con({ tipo: "con-scheda" })));
  c("Attesa WhatsApp (nessuna regola) con un ricontatto scritto: il ricontatto vince", "2026-11-20", giornoDi(chat({ stato: "attesa_whatsapp", ultimo: "2026-11-09T09:00:00Z", ricontatto: "2026-11-20" }), con({ fase: "attesa-whatsapp" })));
  c("Attesa WhatsApp senza ricontatto: l'ultimo messaggio", "2026-11-09", giornoDi(chat({ stato: "attesa_whatsapp", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "attesa-whatsapp" })));
  c("stato senza data (Segreteria): l'ultimo messaggio", "2026-11-09", giornoDi(chat({ stato: "segreteria", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "stato:segreteria" })));
  c("In sospeso, stato a data: il suo ricontatto", "2026-11-12", giornoDi(chat({ stato: "sta_valutando", ricontatto: "2026-11-12", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "sospeso-clienti" })));
  c("In sospeso, stato senza data: l'ultimo messaggio", "2026-11-09", giornoDi(chat({ stato: "attesa_whatsapp", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "sospeso-clienti" })));

  gruppo("FILTRO GIORNO: DICE A PAROLE QUALE DATA GUARDA");
  c("Ricontatti: dice anche la consulenza dei da riprogrammare", "il giorno del ricontatto, o il giorno della consulenza se il lead è da riprogrammare", G.descriviDataFiltro(con({ ricontatti: true })));
  c("Da chiamare: la data scritta, se no l'ultimo messaggio (revisione 16/11/2026)", "il giorno del ricontatto se è scritto, se no il giorno dell'ultimo messaggio", G.descriviDataFiltro(con({ coda: "da-chiamare" })));
  c("Per ora no", "il giorno del ricontatto", G.descriviDataFiltro(con({ fase: "per-ora-no" })));
  c("stato con la consulenza", "il giorno della consulenza", G.descriviDataFiltro(con({ fase: "stato:appuntamento_fissato" })));
  c("stato in sede", "il giorno della visita in sede", G.descriviDataFiltro(con({ fase: "stato:viene_in_sede" })));
  c("stato a data", "il giorno del ricontatto", G.descriviDataFiltro(con({ fase: "stato:sta_valutando" })));
  c("stato senza regola: la data scritta, se no l'ultimo messaggio", "il giorno del ricontatto se è scritto, se no il giorno dell'ultimo messaggio", G.descriviDataFiltro(con({ fase: "stato:segreteria" })));
  c("Da rispondere e gli altri", "il giorno dell'ultimo messaggio", G.descriviDataFiltro(con({ coda: "da-rispondere" })));
  c("sulla riga: consulenza, sede e arrivo sì; ricontatto e messaggio no (li mostra già la riga)", ["Consulenza ven 13 nov", "In sede sab 14 nov", "Arrivato dom 1 nov", null, null], [
    G.giornoUsatoSullaRiga(chat({ stato: "appuntamento_fissato", meeting: "2026-11-13" }), con({ fase: "stato:appuntamento_fissato" })),
    G.giornoUsatoSullaRiga(chat({ stato: "viene_in_sede", sede: "2026-11-14" }), con({ fase: "stato:viene_in_sede" })),
    G.giornoUsatoSullaRiga(chat({ arrivo: "2026-11-01T09:00:00Z" }), con({ coda: "da-rispondere" })),
    G.giornoUsatoSullaRiga(tutte, con({ ricontatti: true })),
    G.giornoUsatoSullaRiga(tutte, con({ coda: "da-rispondere" })),
  ]);
  c("giornoBreve: giorno della settimana, numero, mese (senza lingua del server)", ["lun 9 nov", "gio 31 dic", ""], [G.giornoBreve("2026-11-09"), G.giornoBreve("2026-12-31"), G.giornoBreve("2026-02-30")]);

  gruppo("FILTRO GIORNO: UNA REGOLA SOLA, LO STATO VERO DEL LEAD (16/11/2026, D1 e D2)");
  {
    const ora = quando("2026-11-16T09:00:00Z"); //  lunedì 16/11/2026 a Roma
    const passa = (ch, f, g) => G.passaGiorno(ch, { ...f, giorno: g }, ora);
    const daSpostare = chat({ stato: "da_spostare", meeting: "2026-11-16", ultimo: "2026-11-01T09:00:00Z" });
    c("D1: Da riprogrammare dentro Ricontatti guarda la consulenza rifissata (dataMeeting)", ["2026-11-16", "consulenza"], [giornoDi(daSpostare, con({ ricontatti: true })), G.fonteDellaData(daSpostare, con({ ricontatti: true }))]);
    c("…e passa «Oggi», non «Senza data»", [true, false], [passa(daSpostare, con({ ricontatti: true }), "oggi"), passa(daSpostare, con({ ricontatti: true }), "senza-data")]);
    const richiamo = chat({ stato: "richiamo", ricontatto: "2026-11-16", ultimo: "2026-11-10T09:00:00Z" });
    c("Da chiamare: un Richiamo con la data di oggi passa «Oggi» (data del richiamo, non del messaggio)", [true, false], [passa(richiamo, con({ coda: "da-chiamare" }), "oggi"), passa(richiamo, con({ coda: "da-chiamare" }), "scaduti")]);
    const nonRisponde = chat({ stato: "non_risponde", ultimo: "2026-11-13T09:00:00Z" });
    c("Da chiamare: Non risponde con l'ultimo messaggio di 3 giorni fa passa «Scaduti» (sull'ultimo messaggio)", [true, "messaggio"], [passa(nonRisponde, con({ coda: "da-chiamare" }), "scaduti"), G.fonteDellaData(nonRisponde, con({ coda: "da-chiamare" }))]);
    const daContattare = chat({ stato: "da_contattare", ultimo: "2026-11-16T08:00:00Z" });
    c("Ricontatti: Da contattare (nessuna regola) resta «Senza data», mai un giorno dall'ultimo messaggio", ["", true, false], [giornoDi(daContattare, con({ ricontatti: true })), passa(daContattare, con({ ricontatti: true }), "senza-data"), passa(daContattare, con({ ricontatti: true }), "oggi")]);
    c("senza coda nel filtro (chi non la passa) vale come prima: ultimo messaggio", "2026-11-13", G.dataPerGiorno(nonRisponde, { fase: null, ricontatti: false }));

    //  Revisione, punto 1: un «Da contattare» con il ricontatto scritto (domani) dentro Ricontatti sta
    //  in «Domani», come dice la sua pastiglia, non in «Senza data».
    const daContattareConData = chat({ stato: "da_contattare", ricontatto: "2026-11-17", ultimo: "2026-11-16T08:00:00Z", consulente: "luca" });
    c("revisione 1: Ricontatti, Da contattare con ricontatto domani: «Domani», fonte ricontatto, non «Senza data»", ["2026-11-17", "ricontatto", true, false],
      [giornoDi(daContattareConData, con({ ricontatti: true })), G.fonteDellaData(daContattareConData, con({ ricontatti: true })), passa(daContattareConData, con({ ricontatti: true }), "domani"), passa(daContattareConData, con({ ricontatti: true }), "senza-data")]);
    c("revisione 1: …anche nell'elenco vero (passaFiltri con Ricontatti di «luca»)", [true, false],
      [F.passaFiltri(daContattareConData, con({ ricontatti: true, io: "luca", giorno: "domani" }), () => 0, ora), F.passaFiltri(daContattareConData, con({ ricontatti: true, io: "luca", giorno: "senza-data" }), () => 0, ora)]);

    //  Revisione, punto 3: un «Non risponde» con il richiamo fissato a venerdì (e l'ultimo messaggio di
    //  giorni fa) sta in «Prossimi giorni», non in «Scaduti»; fissato a domani sta in «Domani».
    const nrVenerdi = chat({ stato: "non_risponde", ricontatto: "2026-11-20", ultimo: "2026-11-10T09:00:00Z" });
    const nrDomani = chat({ stato: "non_risponde", ricontatto: "2026-11-17", ultimo: "2026-11-10T09:00:00Z" });
    c("revisione 3: Non risponde con richiamo venerdì: «Prossimi giorni», non «Scaduti» (Da chiamare)", [true, false, "ricontatto"],
      [passa(nrVenerdi, con({ coda: "da-chiamare" }), "prossimi-giorni"), passa(nrVenerdi, con({ coda: "da-chiamare" }), "scaduti"), G.fonteDellaData(nrVenerdi, con({ coda: "da-chiamare" }))]);
    c("revisione 3: Non risponde con richiamo domani: «Domani» (Da chiamare e fase Non risponde)", [true, true],
      [passa(nrDomani, con({ coda: "da-chiamare" }), "domani"), passa(nrDomani, con({ fase: "stato:non_risponde" }), "domani")]);
    c("revisione 3: la riga dice da dove viene il giorno quando la pastiglia del richiamo non c'è (stato senza regola)", "Richiamo mar 17 nov", G.giornoUsatoSullaRiga(nrDomani, con({ coda: "da-chiamare" })));
    c("revisione 3: senza nessuna data scritta resta il ripiego sull'ultimo messaggio", ["2026-11-13", "messaggio"], [giornoDi(nonRisponde, con({ coda: "da-chiamare" })), G.fonteDellaData(nonRisponde, con({ coda: "da-chiamare" }))]);
    c("revisione 3: dentro Ricontatti, senza data scritta, nessun ripiego (resta «Senza data»)", "", giornoDi(daContattare, con({ ricontatti: true })));
  }

  gruppo("FILTRO GIORNO: SENZA DATA, FUORI DA OGNI GIORNO");
  c("Ricontatti senza giorno di ricontatto: nessuna data (niente ripiego sull'ultimo messaggio)", "", giornoDi(chat({ stato: "sta_valutando", ultimo: "2026-11-09T09:00:00Z" }), con({ ricontatti: true })));
  c("Appuntamento fissato senza data: nessuna data", "", giornoDi(chat({ stato: "appuntamento_fissato", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "stato:appuntamento_fissato" })));
  c("data scritta male: nessuna data", "", giornoDi(chat({ stato: "sta_valutando", ricontatto: "2026-13-45" }), con({ ricontatti: true })));
  c("data a metà: nessuna data", "", giornoDi(chat({ stato: "sta_valutando", ricontatto: "2026-11" }), con({ ricontatti: true })));
  c("nessun messaggio e nessun arrivo: nessuna data", "", giornoDi(chat({}), con({ coda: "da-rispondere" })));
  c("senza scheda e senza messaggi: nessuna data", "", giornoDi(chat({ senzaScheda: true }), con({ tipo: "senza-scheda" })));

  gruppo("FILTRO GIORNO: ULTIMO MESSAGGIO, POI ARRIVO DEL LEAD");
  c("l'ultimo messaggio vince sull'arrivo", "2026-11-09", giornoDi(chat({ ultimo: "2026-11-09T09:00:00Z", arrivo: "2026-11-01T09:00:00Z" }), con({ coda: "da-rispondere" })));
  c("senza messaggi: l'arrivo del lead (data.createdAt)", "2026-11-01", giornoDi(chat({ arrivo: "2026-11-01T09:00:00Z", created_at: "2026-10-01T09:00:00Z" }), con({ coda: "da-rispondere" })));
  c("senza createdAt: created_at della riga", "2026-10-01", giornoDi(chat({ created_at: "2026-10-01T09:00:00Z" }), con({ coda: "da-rispondere" })));
  c("l'ultimo messaggio è il giorno di ROMA: 23:30Z = il giorno dopo", "2026-11-10", giornoDi(chat({ ultimo: "2026-11-09T23:30:00Z" }), con({ coda: "da-rispondere" })));
  c("l'ultimo messaggio può stare sul contatto (chat vecchie, fuori dai letti)", "2026-11-05", giornoDi(chat({ contatto: { ultimo_messaggio_il: "2026-11-05T10:00:00Z" } }), con({ coda: "da-rispondere" })));
  c("è la stessa ora che ordina l'elenco (quandoUltimo)", true, ((x) => G.dataPerGiorno(x, con({ coda: "da-rispondere" })) === G.giornoDiRoma(new Date(mod["chatwa/ordineWhatsapp"].quandoUltimo(x))))(chat({ ultimo: "2026-11-07T08:00:00Z", contatto: { ultimo_messaggio_il: "2026-11-08T08:00:00Z" } })));
  c("la fonte dice da dove viene la data", ["ricontatto", "consulenza", "sede", "messaggio", "arrivo", null], [
    G.fonteDellaData(tutte, con({ ricontatti: true })),
    G.fonteDellaData(chat({ stato: "appuntamento_fissato", meeting: "2026-11-13" }), con({ fase: "stato:appuntamento_fissato" })),
    G.fonteDellaData(chat({ stato: "viene_in_sede", sede: "2026-11-14" }), con({ fase: "stato:viene_in_sede" })),
    G.fonteDellaData(tutte, con({ coda: "da-rispondere" })),
    G.fonteDellaData(chat({ arrivo: "2026-11-01T09:00:00Z" }), con({ coda: "da-rispondere" })),
    G.fonteDellaData(chat({}), con({ coda: "da-rispondere" })),
  ]);

  // ── Il filtro nel motore: passaFiltri, conteggi, reset ────────────────────────────────────────
  gruppo("FILTRO GIORNO: SI SOMMA AL FILTRO ACCESO (E) E SI CONTA COME L'ELENCO");
  //  «adesso» = lunedì 9/11/2026, 10:00 Roma. Tutti da rispondere, con ultimi messaggi su giorni diversi.
  const adesso = quando("2026-11-09T09:00:00Z");
  const msg = (g) => `${g}T10:00:00Z`;
  const mondo = [
    chat({ attesa: true, ultimo: msg("2026-11-08"), stato: "attesa_whatsapp", consulente: "luca" }), //  ieri
    chat({ attesa: true, ultimo: msg("2026-11-09"), stato: "attesa_whatsapp", consulente: "luca" }), //  oggi
    chat({ attesa: true, ultimo: msg("2026-11-09"), stato: "sta_valutando", consulente: "anna" }), //  oggi
    chat({ attesa: true, ultimo: msg("2026-11-10"), stato: "attesa_whatsapp", consulente: "luca" }), //  domani (dato di prova)
    chat({ attesa: true, ultimo: msg("2026-11-13"), stato: "sta_valutando" }), //  prossimi giorni
    chat({ attesa: true, ultimo: msg("2026-11-17"), stato: "sta_valutando" }), //  prossimi giorni
    chat({ attesa: true, ultimo: msg("2026-10-01"), stato: "sta_valutando" }), //  scaduti (vecchia)
    chat({ attesa: true, stato: "sta_valutando" }), //  senza data
    chat({ attesa: false, ultimo: msg("2026-11-09"), stato: "sta_valutando", ricontatto: "2026-11-10", consulente: "luca" }),
    chat({ attesa: false, ultimo: msg("2026-11-01"), stato: "sta_valutando", ricontatto: "2026-11-09", consulente: "luca" }),
    chat({ attesa: false, ultimo: msg("2026-11-01"), stato: "in_attesa_acconto", ricontatto: "2026-11-16", consulente: "luca" }),
    chat({ attesa: false, ultimo: msg("2026-11-01"), stato: "in_attesa_acconto", consulente: "luca" }), //  senza data di ricontatto
  ];
  const stelle0 = () => 0;
  const elenco = (f, ora = adesso) => mondo.filter((x) => F.passaFiltri(x, f, stelle0, ora));
  const ix = (righe) => righe.map((x) => mondo.indexOf(x));
  const daRisp = con({ coda: "da-rispondere" });
  c("giorno spento: l'elenco è quello di prima (Tutti)", ix(mondo.filter((x) => x.daRispondere.attesa)), ix(elenco(daRisp)));
  c("Da rispondere + Scaduti: solo quello fermo da mesi", [6], ix(elenco({ ...daRisp, giorno: "scaduti" })));
  c("Da rispondere + Ieri", [0], ix(elenco({ ...daRisp, giorno: "ieri" })));
  c("Da rispondere + Oggi: solo quelli che hanno scritto oggi", [1, 2], ix(elenco({ ...daRisp, giorno: "oggi" })));
  c("Da rispondere + Domani", [3], ix(elenco({ ...daRisp, giorno: "domani" })));
  c("Da rispondere + Prossimi giorni: oltre domani, senza limite", [4, 5], ix(elenco({ ...daRisp, giorno: "prossimi-giorni" })));
  c("Da rispondere + Senza data", [7], ix(elenco({ ...daRisp, giorno: "senza-data" })));
  c("chi non ha una data passa SOLO «Tutti» e «Senza data», nessun altro segmento (nemmeno «Scaduti»)", [true, false, false, false, false, false, true], ["", "scaduti", "ieri", "oggi", "domani", "prossimi-giorni", "senza-data"].map((g) => elenco({ ...daRisp, giorno: g }).includes(mondo[7])));
  c("si somma al consulente (E)", [1], ix(elenco({ ...daRisp, giorno: "oggi", consulente: "luca" })));
  c("In valutazione + Oggi usa il RICONTATTO (non l'ultimo messaggio)", [9], ix(elenco(con({ fase: "stato:sta_valutando", giorno: "oggi" }))));
  c("In valutazione + Domani", [8], ix(elenco(con({ fase: "stato:sta_valutando", giorno: "domani" }))));
  c("Ricontatti usa il ricontatto (oltre i 2 giorni = Prossimi giorni)", [10], ix(elenco(con({ ricontatti: true, io: "luca", giorno: "prossimi-giorni" }))));
  //  D4 dell'analisi risolto (16/11/2026): senza più un secondo controllo «Con/Senza data» indipendente
  //  dalla fila dei giorni, «Senza data» dentro Ricontatti è solo un segmento di quella fila: non può
  //  più contraddirsi con un giorno specifico (prima: scegliere i due insieme dava sempre zero, senza dirlo).
  c("Ricontatti + Senza data: chi non ha un ricontatto, nessun doppio controllo che si annulla", [11], ix(elenco(con({ ricontatti: true, io: "luca", giorno: "senza-data" }))));
  c("senza «adesso» il giorno non filtra (non si sa che giorno è)", ix(elenco(daRisp)), ix(mondo.filter((x) => F.passaFiltri(x, { ...daRisp, giorno: "oggi" }, stelle0))));
  c("spostando l'ora, il giorno si sposta con lei (domani diventa oggi)", [3], ix(elenco({ ...daRisp, giorno: "oggi" }, quando("2026-11-10T09:00:00Z"))));

  const SEGMENTI = ["", "scaduti", "ieri", "oggi", "domani", "prossimi-giorni", "senza-data"];
  const conta = (f, g) => F.contaGiorno(mondo, f, stelle0, adesso, g);
  c("ogni segmento conta ESATTAMENTE le chat che l'elenco mostrerebbe", true, SEGMENTI.every((g) => conta(daRisp, g) === elenco({ ...daRisp, giorno: g }).length));
  c("…anche con un altro filtro acceso, il consulente e Ricontatti", true, [con({ fase: "stato:sta_valutando" }), con({ coda: "da-rispondere", consulente: "luca" }), con({ ricontatti: true, io: "luca" })].every((f) => SEGMENTI.every((g) => conta(f, g) === elenco({ ...f, giorno: g }).length)));
  c("i numeri dei segmenti: Tutti 8, Scaduti 1, Ieri 1, Oggi 2, Domani 1, Prossimi giorni 2, Senza data 1", [8, 1, 1, 2, 1, 2, 1], [conta(daRisp, ""), conta(daRisp, "scaduti"), conta(daRisp, "ieri"), conta(daRisp, "oggi"), conta(daRisp, "domani"), conta(daRisp, "prossimi-giorni"), conta(daRisp, "senza-data")]);
  c("il conto di un segmento ignora il giorno già scelto (è «cosa vedresti se lo tocchi»)", conta({ ...daRisp, giorno: "ieri" }, "oggi"), conta(daRisp, "oggi"));
  c("contaVoce del consulente tiene conto del giorno scelto", 1, F.contaVoce(mondo, { ...daRisp, giorno: "oggi" }, stelle0, "consulente", "luca", adesso));
  c("contaVoce di un'altra voce parte da zero: il giorno non si porta dietro", mondo.filter((x) => F.passaFiltri(x, con({ fase: "stato:sta_valutando" }), stelle0)).length, F.contaVoce(mondo, { ...daRisp, giorno: "oggi" }, stelle0, "fase", "stato:sta_valutando", adesso));

  gruppo("FILTRO GIORNO: «DA CHIAMARE» CON LA FILA GENERICA (16/11/2026, Compito 4, corregge D2/D3)");
  //  Tolto «Quando richiamare» (una fila sua, un secondo «Oggi», un secondo conteggio): «Da chiamare»
  //  usa ORA la stessa fila generica di ogni altro filtro, con la stessa garanzia di sempre (il numero
  //  del segmento è esattamente quello che l'elenco mostrerebbe).
  const daChiamare = con({ coda: "da-chiamare" });
  const mondoChiamare = [
    chat({ stato: "richiamo", ricontatto: "2026-11-09" }), //  oggi (sul richiamo)
    chat({ stato: "ci_ricontatta_lui", ricontatto: "2026-11-10" }), //  domani (sul richiamo)
    chat({ stato: "richiamo", ricontatto: "2026-10-01" }), //  scaduti (sul richiamo)
    chat({ stato: "non_risponde", ultimo: msg("2026-11-09") }), //  oggi (sull'ultimo messaggio: nessuna regola)
    chat({ stato: "segreteria", ultimo: msg("2026-10-01") }), //  scaduti (sull'ultimo messaggio)
    chat({ stato: "da_chiamare" }), //  senza data (nessuna regola, nessun messaggio)
    chat({ stato: "richiamo" }), //  senza data (regola c'è, manca il valore)
  ];
  const elencoChiamare = (f, ora = adesso) => mondoChiamare.filter((x) => F.passaFiltri(x, f, stelle0, ora));
  c("ogni segmento, dentro «Da chiamare», conta ESATTAMENTE le chat che l'elenco mostrerebbe", true,
    SEGMENTI.every((g) => F.contaGiorno(mondoChiamare, daChiamare, stelle0, adesso, g) === elencoChiamare({ ...daChiamare, giorno: g }).length));
  c("Richiamo e Ci ricontatta lui leggono la data del richiamo (Oggi/Domani/Scaduti)", [true, true, true], [
    elencoChiamare({ ...daChiamare, giorno: "oggi" }).includes(mondoChiamare[0]),
    elencoChiamare({ ...daChiamare, giorno: "domani" }).includes(mondoChiamare[1]),
    elencoChiamare({ ...daChiamare, giorno: "scaduti" }).includes(mondoChiamare[2]),
  ]);
  c("gli stati senza regola (Non risponde, Segreteria) cadono sull'ultimo messaggio, non su una data di richiamo inesistente", [true, true], [
    elencoChiamare({ ...daChiamare, giorno: "oggi" }).includes(mondoChiamare[3]),
    elencoChiamare({ ...daChiamare, giorno: "scaduti" }).includes(mondoChiamare[4]),
  ]);
  c("chi non ha né richiamo né messaggio resta «Senza data» (anche con la regola, se manca il valore)", 2, elencoChiamare({ ...daChiamare, giorno: "senza-data" }).length);

  //  Revisione, punto 2: con un chip dello stato acceso (es. «Non risponde») i numeri della fila contano
  //  solo le chat di quel chip, come l'elenco (chatDaChiamare(…, sottoAttivo)).
  const D = mod["chatwa/daChiamare"];
  const contaChip = (sotto, g) => F.contaGiorno(D.delSottofiltro(mondoChiamare, sotto), daChiamare, stelle0, adesso, g);
  const elencoChip = (sotto, g) => D.chatDaChiamare(elencoChiamare({ ...daChiamare, giorno: g }), sotto);
  c("revisione 2: chip «Non risponde» acceso, ogni segmento conta ESATTAMENTE le chat che l'elenco mostra", true,
    ["non_risponde", "segreteria", "richiamo", "da_chiamare", "tutti"].every((sotto) => SEGMENTI.every((g) => contaChip(sotto, g) === elencoChip(sotto, g).length)));
  c("revisione 2: chip «Non risponde», «Oggi» = 1 (senza chip sarebbe 2: anche il Richiamo di oggi)", [1, 2],
    [contaChip("non_risponde", "oggi"), contaChip("tutti", "oggi")]);
  {
    const elencoSrc = readFileSync(join(radice, "src/crm/chatwa/ElencoChat.tsx"), "utf8");
    c("revisione 2: ElencoChat passa alla fila dei giorni solo le chat del chip scelto", true, /delSottofiltro\([^)]*sottoAttivo\)/.test(elencoSrc));
  }

  gruppo("FILTRO GIORNO: CAMPO INTERNO (non conta sul tasto «Filtri», si azzera col filtro)");
  c("il campo c'è ed è vuoto di partenza", "", V.giorno);
  c("non conta sul tasto «Filtri»", 1, F.contaAccesi(con({ coda: "da-rispondere", giorno: "oggi" })));
  c("da solo non accende niente", 0, F.contaAccesi(con({ giorno: "oggi" })));
  c("toccare un altro filtro azzera il giorno", "", F.commuta(con({ coda: "da-rispondere", giorno: "oggi" }), "fase", "per-ora-no").giorno);
  c("…e anche toccare un altro valore dello stesso gruppo", "", F.commuta(con({ coda: "da-rispondere", giorno: "oggi" }), "coda", "da-chiamare").giorno);
  c("spegnere il filtro (toccarlo di nuovo) azzera il giorno", "", F.commuta(con({ coda: "da-rispondere", giorno: "oggi" }), "coda", "da-rispondere").giorno);
  c("togli() del filtro principale azzera il giorno", "", F.togli(con({ stelle: true, giorno: "domani" }), "stelle").giorno);
  c("spegnere «Ricontatti» azzera esito e giorno", ["", ""], ((f) => [f.rEsito, f.giorno])(F.togli(con({ ricontatti: true, rEsito: "piu_avanti", giorno: "oggi" }), "ricontatti")));
  c("scegliere un consulente NON toglie il giorno", "oggi", F.commuta(con({ coda: "da-rispondere", giorno: "oggi" }), "consulente", "luca").giorno);
  c("togliere il consulente NON toglie il giorno", "oggi", F.togli(con({ coda: "da-rispondere", giorno: "oggi", consulente: "luca" }), "consulente").giorno);
  c("togliere l'Esito di Ricontatti NON toglie il giorno", "oggi", F.togli(con({ ricontatti: true, rEsito: "piu_avanti", giorno: "oggi" }), "rEsito").giorno);
  c("togli(\"giorno\") toglie solo il giorno", { ...con({ coda: "da-rispondere" }) }, F.togli(con({ coda: "da-rispondere", giorno: "oggi" }), "giorno"));
  c("«Azzera» (FILTRI_VUOTI) lo azzera", "", V.giorno);
  c("l'etichetta con la ✕ c'è e si toglie col suo campo", [{ campo: "coda", etichetta: "Da rispondere" }, { campo: "giorno", etichetta: "Prossimi giorni" }], F.etichetteAccese(con({ coda: "da-rispondere", giorno: "prossimi-giorni" }), () => ""));
  c("senza giorno nessuna etichetta in più", [{ campo: "coda", etichetta: "Da rispondere" }], F.etichetteAccese(con({ coda: "da-rispondere" }), () => ""));

  gruppo("FILTRO GIORNO: LE SEZIONI PER GIORNO, PRONTE PER L'ELENCO A GRUPPI (Compito 1, perGiorno)");
  {
    //  Lo stesso mondo di «Da rispondere» di sopra, ma solo le chat che passerebbero davvero quel
    //  filtro (`perGiorno` riceve un elenco GIÀ filtrato: non filtra lei stessa).
    const soloAttesa = mondo.filter((x) => x.daRispondere.attesa);
    const sezioni = (f, elenco = soloAttesa) => G.perGiorno(elenco, f, adesso).map((s) => ({ giorno: s.giorno, ix: ix(s.chats) }));
    c("raggruppa nell'ordine del calendario, senza riordinare dentro ogni sezione", [
      { giorno: "scaduti", ix: [6] },
      { giorno: "ieri", ix: [0] },
      { giorno: "oggi", ix: [1, 2] },
      { giorno: "domani", ix: [3] },
      { giorno: "prossimi-giorni", ix: [4, 5] },
      { giorno: "senza-data", ix: [7] },
    ], sezioni(daRisp));
    c("ogni chat sta in una sezione sola: nessuna persa, nessuna doppia", true,
      G.perGiorno(soloAttesa, daRisp, adesso).flatMap((s) => s.chats).length === soloAttesa.length);
    c("le sezioni vuote non compaiono", false, sezioni(daRisp).some((s) => s.ix.length === 0));
    c("un elenco vuoto dà zero sezioni", [], G.perGiorno([], daRisp, adesso));
    //  Due chat che cadono nella stessa sezione, inserite in un ordine qualunque: l'ordine di chi
    //  chiama non si tocca (dentro «Da chiamare» è «per stato e cambio di stato», qui basta provare
    //  che non viene risistemato).
    const dueOggi = [mondo[2], mondo[1]]; //  ordine invertito rispetto a sopra
    c("l'ordine dentro la sezione è quello di chi chiama, non un nuovo ordinamento", [2, 1], ix(G.perGiorno(dueOggi, daRisp, adesso).find((s) => s.giorno === "oggi").chats));
    //  Solo «ieri» e «prossimi giorni» presenti, in input nell'ordine sbagliato: l'uscita segue
    //  SEMPRE il calendario (ieri prima), non l'ordine con cui sono arrivate.
    const invertito = [mondo[4], mondo[0]]; //  prossimi-giorni, poi ieri
    c("l'ordine delle SEZIONI è sempre quello del calendario, non quello dell'input", ["ieri", "prossimi-giorni"], G.perGiorno(invertito, daRisp, adesso).map((s) => s.giorno));
  }

  gruppo("FILTRO GIORNO: LA FILA CORTA PER I FILTRI «A MESSAGGIO» (Compito 3, 17/11/2026)");
  c("i segmenti sono Tutti/Oggi/Ieri/Più vecchi, in ordine", ["Tutti", "Oggi", "Ieri", "Più vecchi"], G.SEGMENTI_FILA_CORTA.map((s) => s.nome));
  c("…con gli stessi valori di sempre: «Più vecchi» è «scaduti», nessun valore nuovo", ["", "oggi", "ieri", "scaduti"], G.SEGMENTI_FILA_CORTA.map((s) => s.v));
  c("Da rispondere, Con stelle, Sconosciuti, Clienti, Finestra, Acconto, Con scheda sono «a messaggio»", true,
    [con({ coda: "da-rispondere" }), con({ stelle: true }), con({ tipo: "senza-scheda" }), con({ tipo: "cliente" }), con({ finestra: "aperta" }), con({ acconto: true }), con({ tipo: "con-scheda" })].every((f) => G.eFiltroAMessaggio(f)));
  c("Ricontatti, Da chiamare e ogni fase sono «a richiamo», non «a messaggio»", false,
    [con({ ricontatti: true }), con({ coda: "da-chiamare" }), con({ fase: "per-ora-no" }), con({ fase: "sospeso-clienti" }), con({ fase: "stato:segreteria" })].some((f) => G.eFiltroAMessaggio(f)));
  c("i valori fuori dalla fila corta (Domani, Prossimi giorni, Senza data) tornano a «Tutti»", ["", "", ""], ["domani", "prossimi-giorni", "senza-data"].map((g) => G.giornoNellaFilaCorta(g)));
  c("i valori già nella fila corta restano com'erano", ["", "oggi", "ieri", "scaduti"], ["", "oggi", "ieri", "scaduti"].map((g) => G.giornoNellaFilaCorta(g)));
  c("un valore sconosciuto torna a «Tutti», non un errore", "", G.giornoNellaFilaCorta("tra-un-mese"));
  c("filtriValidi riporta a «Tutti» un giorno fuori dalla fila corta (Da rispondere + Domani, salvato prima del Compito 3)", "", F.filtriValidi(con({ coda: "da-rispondere", giorno: "domani" }), new Set()).giorno);
  c("…ma un giorno già nella fila corta resta (Da rispondere + Oggi)", "oggi", F.filtriValidi(con({ coda: "da-rispondere", giorno: "oggi" }), new Set()).giorno);
  c("…e un filtro «a richiamo» (Da chiamare) con Domani non si tocca: la fila lì è completa", "domani", F.filtriValidi(con({ coda: "da-chiamare", giorno: "domani" }), new Set()).giorno);

  gruppo("FILTRO GIORNO: IL RIEPILOGO NON RIPETE LA PILLOLA (Compito 4, 17/11/2026, soloPillolaAccesa)");
  c("solo una pillola accesa (Da rispondere): il riepilogo non si mostrerebbe", true, F.soloPillolaAccesa(con({ coda: "da-rispondere" })));
  c("Ricontatti da solo è anche lui una pillola", true, F.soloPillolaAccesa(con({ ricontatti: true })));
  c("un filtro del pannello (Attesa WhatsApp, non in VOCI_RIGA): il riepilogo si mostra", false, F.soloPillolaAccesa(con({ fase: "attesa-whatsapp" })));
  c("uno stato da «Altri stati» (non in VOCI_RIGA): il riepilogo si mostra", false, F.soloPillolaAccesa(con({ fase: "stato:appuntamento_fissato" })));
  c("pillola + consulente: il riepilogo si mostra (il consulente non è una pillola)", false, F.soloPillolaAccesa({ ...con({ coda: "da-rispondere" }), consulente: "luca" }));
  c("nessun filtro acceso: non è «solo una pillola» (non c'è nessuna pillola)", false, F.soloPillolaAccesa(V));
  c("il giorno (interno) non conta: pillola + un giorno scelto resta «solo pillola»", true, F.soloPillolaAccesa(con({ coda: "da-rispondere", giorno: "oggi" })));
  c("l'Esito di Ricontatti (interno) non conta: Ricontatti + un esito resta «solo pillola»", true, F.soloPillolaAccesa(con({ ricontatti: true, rEsito: "piu_avanti" })));

  gruppo("FILTRO GIORNO: DAL DISPOSITIVO SI RILEGGE SOLO QUELLO CHE SI CONOSCE");
  const rileggi = (o, cons = null) => F.leggiFiltri(JSON.stringify(o), cons);
  c("un giorno valido con un filtro acceso si rilegge", "domani", rileggi({ coda: "da-rispondere", giorno: "domani" }).giorno);
  c("tutti i segmenti si rileggono", true, SEGMENTI.slice(1).every((g) => rileggi({ stelle: true, giorno: g }).giorno === g));
  c("un valore sconosciuto è vuoto", "", rileggi({ coda: "da-rispondere", giorno: "tra-un-mese" }).giorno);
  //  Rischio del piano (Compito 1): chi ha una sessione vecchia con «Questa/Prossima settimana» o la
  //  vecchia «Con/Senza data» di Ricontatti torna a «Tutti», senza errori: lo stesso meccanismo che già
  //  ignora un valore sconosciuto, non una migrazione.
  c("un valore vecchio («questa-settimana»/«prossima-settimana»), salvato prima del 16/11, torna a «Tutti»", ["", ""], ["questa-settimana", "prossima-settimana"].map((g) => rileggi({ coda: "da-rispondere", giorno: g }).giorno));
  c("giornoValido scarta i vecchi valori di settimana", [false, false], ["questa-settimana", "prossima-settimana"].map((g) => G.giornoValido(g)));
  c("un numero, un oggetto, null: vuoto", ["", "", ""], [rileggi({ stelle: true, giorno: 3 }).giorno, rileggi({ stelle: true, giorno: {} }).giorno, rileggi({ stelle: true, giorno: null }).giorno]);
  c("un giorno senza filtro acceso non resta di nascosto", "", rileggi({ giorno: "oggi" }).giorno);
  c("…nemmeno col solo consulente salvato", "", rileggi({ giorno: "oggi" }, "luca").giorno);
  c("più filtri salvati: ne resta uno e il giorno va con lui", ["fase", "oggi"], ((f) => [f.fase ? "fase" : "?", f.giorno])(rileggi({ coda: "da-rispondere", fase: "per-ora-no", giorno: "oggi" })));
  c("con Ricontatti il giorno convive con l'esito", ["oggi", "piu_avanti"], ((f) => [f.giorno, f.rEsito])(rileggi({ ricontatti: true, rEsito: "piu_avanti", giorno: "oggi" })));
  c("scrivi + rileggi: il giorno resta", "ieri", F.leggiFiltri(F.scriviFiltriSessione(con({ finestra: "chiusa", giorno: "ieri" })), null).giorno);
  c("testo rotto: tutto spento, nessun errore", "", F.leggiFiltri("{rotto", null).giorno);
  c("soloUno non muta l'ingresso e tiene il giorno col filtro scelto", "oggi", F.soloUno(con({ acconto: true, giorno: "oggi" })).giorno);

  // ── Il disegno e i paletti ───────────────────────────────────────────────────────────────────
  gruppo("FILTRO GIORNO: L'INTERFACCIA (fila a segmenti, a capo su più righe, coerente con le altre)");
  const riga = senzaCommenti(leggi("src/crm/chatwa/RigaGiorno.tsx"));
  const elencoSrc = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  const filtriSrc = senzaCommenti(leggi("src/crm/chatwa/filtri.ts"));
  const rigaChat = senzaCommenti(leggi("src/crm/chatwa/RigaChat.tsx"));
  c("i segmenti sono quelli della spec, in ordine", ["Tutti", "Scaduti", "Ieri", "Oggi", "Domani", "Prossimi giorni", "Senza data"], G.SEGMENTI_GIORNO.map((s) => s.nome));
  c("«Tutti» vale vuoto, gli altri hanno un valore ciascuno", ["", "scaduti", "ieri", "oggi", "domani", "prossimi-giorni", "senza-data"], G.SEGMENTI_GIORNO.map((s) => s.v));
  c("la fila è un gruppo con nome e ogni segmento è aria-pressed", true, /role="group"/.test(riga) && /aria-label="Giorno/.test(riga) && /aria-pressed=\{/.test(riga));
  //  Seconda revisione (17/11/2026, titolare dal telefono): niente più scorrimento di lato (a 375 px
  //  tagliava «Prossimi giorni»/«Senza data» fuori dalla vista) — i segmenti vanno a capo, TUTTI
  //  sempre in vista, con `flex-wrap`.
  c("i segmenti vanno a capo su più righe (flex-wrap), non scorrono più di lato", true, /flex-wrap/.test(riga) && !/overflow-x-auto/.test(riga));
  c("ogni segmento non si rompe a metà (il suo testo resta su una riga)", true, /shrink-0/.test(riga) && /whitespace-nowrap/.test(riga));
  c("ogni segmento mostra il suo numero (dal conto condiviso, non calcolato qui)", true, /conta\(/.test(riga) && !/passaFiltri|filter\(/.test(riga));
  c("ritoccare il segmento acceso torna a «Tutti»", true, /acceso\s*\?\s*""\s*:/.test(riga));
  c("tocco da 44 px sul telefono (h-11) su ogni segmento, più piccolo solo col mouse", true, /h-11/.test(riga) && /lg:pointer-fine:h-8/.test(riga));
  c("il segmento acceso resta ben distinto: pieno primario, come le pillole sopra", true, /bg-primary text-primary-foreground/.test(riga));
  c("la pagina la disegna con un filtro acceso (non con la sola riga «Tutte»), a caricamento finito", true, /<RigaGiorno/.test(elencoSrc) && /!caricamento\s*&&\s*!soloRiga/.test(elencoSrc));
  //  Compito 2 (17/11/2026): sale sopra l'elenco, fuori dall'area che scorre — subito dopo le pillole
  //  (e dopo «Stato della chiamata» in «Da chiamare»), prima dell'area con `overflow-y-auto`. Le barre
  //  incollate (Esito, prossimo meet, prossimo ricontatto) restano DENTRO quell'area, in cima.
  c("sale sopra l'elenco, dopo le pillole e lo «Stato della chiamata», fuori dall'area che scorre", true,
    elencoSrc.indexOf("<RigaGiorno") > elencoSrc.indexOf('aria-label="Filtri rapidi"') &&
    elencoSrc.indexOf("<RigaGiorno") > elencoSrc.indexOf('aria-label="Stato della chiamata"') &&
    elencoSrc.indexOf("<RigaGiorno") < elencoSrc.indexOf("overflow-y-auto"));
  c("le barre incollate (Esito, prossimo meet, prossimo ricontatto) restano in cima all'elenco, DENTRO l'area che scorre", true,
    elencoSrc.indexOf("sticky top-0") > elencoSrc.indexOf("overflow-y-auto") && elencoSrc.indexOf("sticky top-0") < elencoSrc.indexOf("trovate.length === 0"));
  c("i numeri della fila usano contaGiorno e l'elenco la stessa passaFiltri, con la stessa ora", true, /contaGiorno\(/.test(elencoSrc) && /passaFiltri\(c, filtri, stelleDi, adessoData\)/.test(elencoSrc));
  c("il giorno è nel salvataggio della vista (si torna in cima se cambia)", true, /JSON\.stringify\(\[filtri,/.test(elencoSrc));
  c("la riga mostra la data usata solo quando non c'è già (consulenza, sede, arrivo)", true, /giornoUsato/.test(rigaChat) && /giornoUsato/.test(elencoSrc));
  c("passaFiltro (cercaChat.ts) non è toccata: non sa niente del giorno", false, /giorno/i.test(senzaCommenti(leggi("src/crm/chatwa/cercaChat.ts"))));
  c("la logica del giorno non legge l'orologio (niente Date.now / new Date() senza argomenti)", false, /Date\.now\(|new Date\(\)/.test(senzaCommenti(leggi("src/crm/chatwa/giorno.ts"))));
  c("nessun database: giorno.ts non importa Supabase", false, /supabase/i.test(senzaCommenti(leggi("src/crm/chatwa/giorno.ts"))));
  c("niente emoji nei file nuovi", true, ![riga, senzaCommenti(leggi("src/crm/chatwa/giorno.ts"))].some((t) => /\p{Extended_Pictographic}/u.test(t)));
  c("il campo è dichiarato in FiltriChat ed è interno come rEsito", true, /giorno: GiornoChat/.test(filtriSrc) && /CAMPI_INTERNI = \["io", "rEsito", "giorno"\]/.test(filtriSrc));

  gruppo("FILTRO GIORNO: L'ETICHETTA DAVANTI ALLA FILA, E LA FILA CORTA (Compito 3, nel disegno)");
  c("RigaGiorno riceve e mostra l'etichetta", true, /etichetta/.test(riga) && /\{etichetta\}/.test(riga));
  c("senza `segmenti` mostra i sette di sempre (il valore di default è SEGMENTI_GIORNO)", true, /segmenti\s*=\s*SEGMENTI_GIORNO/.test(riga));
  //  Seconda revisione (17/11/2026): «Scadenza:» (non più «Da richiamare») per i filtri a richiamo,
  //  con i due punti — parole al posto della sola icona (tolta dal disegno).
  c("ElencoChat passa «Ultimo messaggio:» o «Scadenza:», e la fila corta solo per i filtri «a messaggio»", true,
    /etichetta=\{filaCorta \? "Ultimo messaggio:" : "Scadenza:"\}/.test(elencoSrc) &&
    /segmenti=\{filaCorta \? SEGMENTI_FILA_CORTA : undefined\}/.test(elencoSrc) &&
    /const filaCorta = eFiltroAMessaggio\(filtri\)/.test(elencoSrc));

  gruppo("FILTRO GIORNO: L'ELENCO A GRUPPI PER GIORNO, NEL DISEGNO (Compito 1)");
  c("ElencoChat raggruppa con perGiorno solo con «Da chiamare»/«Ricontatti» e il giorno su «Tutti»", true,
    /const gruppoGiorni = filtri\.giorno === "" && \(filtri\.coda === "da-chiamare" \|\| filtri\.ricontatti\)/.test(elencoSrc) &&
    /perGiorno\(elencoDaChiamare, filtri, adessoData\)/.test(elencoSrc) &&
    /perGiorno\(ricPrincipali, filtri, adessoData\)/.test(elencoSrc));
  c("ogni sezione è un <section> con aria-labelledby e un titolo (h2) col numero", true,
    /<section key=\{g\.giorno\} aria-labelledby=\{`titolo-giorno-\$\{g\.giorno\}`\}>/.test(elencoSrc) &&
    /<h2[^>]*id=\{`titolo-giorno-\$\{g\.giorno\}`\}/.test(elencoSrc) &&
    /\{nomeGiorno\(g\.giorno\)\}/.test(elencoSrc));
  c("il numero della sezione è «tabular-nums» (si legge bene anche quando cresce)", true, /tabular-nums font-normal/.test(elencoSrc));
  c("il caricamento a pezzi (`visti`) si applica anche ai gruppi, con lo stesso tagliaSezioni", true, /tagliaSezioni\(visti, \.\.\.gruppi\.map/.test(elencoSrc));
  c("con un giorno specifico scelto (non «Tutti») non si raggruppa: resta la sezione sola di oggi", true, (() => {
    const F2 = con({ coda: "da-chiamare", giorno: "oggi" });
    return /gruppoGiorni && filtri\.coda === "da-chiamare"/.test(elencoSrc) && F2.giorno !== "";
  })());

  gruppo("FILTRO GIORNO: IL RIEPILOGO NON SI RIPETE, NEL DISEGNO (Compito 4)");
  c("ElencoChat nasconde il riepilogo quando l'unico acceso è una pillola", true, /accesi > 0 && !soloPillolaAccesa\(filtri\) && \(/.test(elencoSrc));

  gruppo("FILTRO GIORNO: LA RICERCA NON FA DIVERGERE LA FILA DALLE SEZIONI (revisione 17/11/2026)");
  {
    //  Guasto segnalato dal revisore: senza applicare la ricerca alla base di `contaGiorno`, il
    //  numero sulla fila (RigaGiorno) e il numero dell'intestazione di sezione (perGiorno, che
    //  parte da un elenco GIÀ passato per `combaciaRicerca`) potevano dire cose diverse.
    const { combaciaRicerca } = mod["chatwa/cercaChat"];
    const ora = quando("2026-11-16T09:00:00Z"); //  lunedì 16/11/2026 a Roma
    const daChiamareOra = con({ coda: "da-chiamare" });
    //  Tre «Non risponde» con l'ultimo messaggio di oggi (nessuna regola di data: dataEFonte cade
    //  sull'ultimo messaggio): tutti nello stesso segmento «Oggi».
    const tre = [
      chat({ stato: "non_risponde", ultimo: "2026-11-16T08:00:00Z" }),
      chat({ stato: "non_risponde", ultimo: "2026-11-16T08:00:00Z" }),
      chat({ stato: "non_risponde", ultimo: "2026-11-16T08:00:00Z" }),
    ];
    //  Una ricerca che combacia con una sola delle tre (le ultime cifre del suo numero).
    const soloUna = tre[1].phone.slice(-4);
    c("la ricerca inventata combacia con una sola delle tre chat", 1, tre.filter((c) => combaciaRicerca(c, soloUna)).length);
    //  Come fa ElencoChat.tsx dopo la correzione: la base di `contaGiorno` passa anche da
    //  `combaciaRicerca`, la stessa che filtra `trovate` (e quindi le sezioni raggruppate).
    const baseConRicerca = tre.filter((c) => combaciaRicerca(c, soloUna));
    const numeroFila = F.contaGiorno(baseConRicerca, daChiamareOra, stelle0, ora, "oggi");
    const numeroSezione = G.perGiorno(baseConRicerca, daChiamareOra, ora).find((s) => s.giorno === "oggi")?.chats.length ?? 0;
    c("con la ricerca attiva, il numero della fila e quello della sezione coincidono (e sono 1, non 3)", [1, 1], [numeroFila, numeroSezione]);
    //  Il guasto che si corregge: SENZA applicare la ricerca alla base della fila, il numero
    //  resterebbe 3 (tutte e tre), diverso da quello della sezione raggruppata (1).
    const numeroFilaSenzaCorrezione = F.contaGiorno(tre, daChiamareOra, stelle0, ora, "oggi");
    c("senza la correzione, il numero della fila (tutte e tre) sarebbe diverso da quello della sezione", true, numeroFilaSenzaCorrezione !== numeroSezione);
    //  Nel sorgente: la base passata a `contaGiorno` è filtrata con `combaciaRicerca(c, ricerca)`,
    //  la stessa funzione e lo stesso `ricerca` che filtrano `trovate` (riga 257).
    c("ElencoChat applica combaciaRicerca alla base dei numeri della fila", true, /\)\.filter\(\(c\) => combaciaRicerca\(c, ricerca\)\)/.test(elencoSrc));
  }

  gruppo("FILTRO GIORNO: LE SEZIONI RAGGRUPPATE HANNO L'ARIA-LABEL DELLA VISTA PIATTA (revisione 17/11/2026)");
  c("il <ul> di ogni sezione ha l'aria-label di «Da chiamare» o di «Ricontatti», come la vista piatta", true,
    /<ul\s*\n\s*aria-label=\{\s*\n\s*filtri\.coda === "da-chiamare"\s*\n\s*\? "Chat da chiamare, per stato"\s*\n\s*: "Ricontatti, dal lead più recente; in cima quelli in priorità"/.test(elencoSrc));
}
