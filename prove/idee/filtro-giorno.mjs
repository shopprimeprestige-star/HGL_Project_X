/** ── PROVE: IL FILTRO PER GIORNO DENTRO OGNI FILTRO DELLA CHAT (09/11/2026) ──────────────────
 *  Regole in src/crm/chatwa/giorno.ts (data per filtro, fuso di Roma, settimana lun-dom) e filtri.ts
 *  (il campo interno `giorno`, i conteggi). Il disegno è in RigaGiorno.tsx e ElencoChat.tsx.
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

  gruppo("FILTRO GIORNO: GLI INTERVALLI (lunedì-domenica)");
  const lun = quando("2026-11-09T10:00:00Z");
  c("oggi", { da: "2026-11-09", a: "2026-11-09" }, G.intervalloGiorno("oggi", lun));
  c("ieri", { da: "2026-11-08", a: "2026-11-08" }, G.intervalloGiorno("ieri", lun));
  c("domani", { da: "2026-11-10", a: "2026-11-10" }, G.intervalloGiorno("domani", lun));
  c("questa settimana di lunedì: lun 9 - dom 15", { da: "2026-11-09", a: "2026-11-15" }, G.intervalloGiorno("questa-settimana", lun));
  c("prossima settimana di lunedì: lun 16 - dom 22", { da: "2026-11-16", a: "2026-11-22" }, G.intervalloGiorno("prossima-settimana", lun));
  const dom = quando("2026-11-15T12:00:00Z");
  c("di domenica la settimana è ancora quella (lun 9 - dom 15)", { da: "2026-11-09", a: "2026-11-15" }, G.intervalloGiorno("questa-settimana", dom));
  c("di domenica «domani» è già la settimana dopo", { da: "2026-11-16", a: "2026-11-16" }, G.intervalloGiorno("domani", dom));
  c("di domenica la prossima è lun 16 - dom 22", { da: "2026-11-16", a: "2026-11-22" }, G.intervalloGiorno("prossima-settimana", dom));
  const domNotte = quando("2026-11-15T23:30:00Z"); //  lunedì 16 alle 00:30 a Roma
  c("domenica 23:30 UTC è lunedì a Roma: la settimana cambia", { da: "2026-11-16", a: "2026-11-22" }, G.intervalloGiorno("questa-settimana", domNotte));
  const mer = quando("2026-12-30T09:00:00Z"); //  mercoledì, a cavallo dell'anno
  c("settimana a cavallo dell'anno", { da: "2026-12-28", a: "2027-01-03" }, G.intervalloGiorno("questa-settimana", mer));
  c("…e la prossima è tutta nel nuovo anno", { da: "2027-01-04", a: "2027-01-10" }, G.intervalloGiorno("prossima-settimana", mer));
  c("«Tutti» non ha intervallo", null, G.intervalloGiorno("", lun));
  c("un valore sconosciuto non ha intervallo", null, G.intervalloGiorno("tra-un-mese", lun));

  gruppo("FILTRO GIORNO: «IN QUALE GIORNO CADE»");
  c("lo stesso giorno è «oggi»", true, G.inGiorno("2026-11-09", "oggi", lun));
  c("il giorno prima è «ieri», non «oggi»", [true, false], [G.inGiorno("2026-11-08", "ieri", lun), G.inGiorno("2026-11-08", "oggi", lun)]);
  c("il giorno dopo è «domani»", true, G.inGiorno("2026-11-10", "domani", lun));
  c("domenica 15 è ancora questa settimana, lunedì 16 no", [true, false], [G.inGiorno("2026-11-15", "questa-settimana", lun), G.inGiorno("2026-11-16", "questa-settimana", lun)]);
  c("lunedì 16 è la prossima settimana, lunedì 23 no", [true, false], [G.inGiorno("2026-11-16", "prossima-settimana", lun), G.inGiorno("2026-11-23", "prossima-settimana", lun)]);
  c("domenica 8 non è questa settimana (è la scorsa)", false, G.inGiorno("2026-11-08", "questa-settimana", lun));
  c("senza giorno non cade in nessun segmento", [false, false, false, false, false], ["ieri", "oggi", "domani", "questa-settimana", "prossima-settimana"].map((s) => G.inGiorno("", s, lun)));
  c("«Tutti» fa passare anche chi non ha giorno", true, G.inGiorno("", "", lun));

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
  c("Da chiamare: il giorno dell'ultimo messaggio", "2026-11-09", giornoDi(tutte, con({ coda: "da-chiamare" })));
  c("Con stelle: il giorno dell'ultimo messaggio", "2026-11-09", giornoDi(tutte, con({ stelle: true })));
  c("Finestra: il giorno dell'ultimo messaggio", "2026-11-09", giornoDi(tutte, con({ finestra: "aperta" })));
  c("Acconto: il giorno dell'ultimo messaggio", "2026-11-09", giornoDi(tutte, con({ acconto: true })));
  c("Tipo: il giorno dell'ultimo messaggio", "2026-11-09", giornoDi(tutte, con({ tipo: "con-scheda" })));
  c("Attesa WhatsApp (non ha data): l'ultimo messaggio", "2026-11-09", giornoDi(chat({ stato: "attesa_whatsapp", ultimo: "2026-11-09T09:00:00Z", ricontatto: "2026-11-20" }), con({ fase: "attesa-whatsapp" })));
  c("stato senza data (Segreteria): l'ultimo messaggio", "2026-11-09", giornoDi(chat({ stato: "segreteria", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "stato:segreteria" })));
  c("In sospeso, stato a data: il suo ricontatto", "2026-11-12", giornoDi(chat({ stato: "sta_valutando", ricontatto: "2026-11-12", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "sospeso-clienti" })));
  c("In sospeso, stato senza data: l'ultimo messaggio", "2026-11-09", giornoDi(chat({ stato: "attesa_whatsapp", ultimo: "2026-11-09T09:00:00Z" }), con({ fase: "sospeso-clienti" })));

  gruppo("FILTRO GIORNO: DICE A PAROLE QUALE DATA GUARDA");
  c("Ricontatti", "il giorno del ricontatto", G.descriviDataFiltro(con({ ricontatti: true })));
  c("Per ora no", "il giorno del ricontatto", G.descriviDataFiltro(con({ fase: "per-ora-no" })));
  c("stato con la consulenza", "il giorno della consulenza", G.descriviDataFiltro(con({ fase: "stato:appuntamento_fissato" })));
  c("stato in sede", "il giorno della visita in sede", G.descriviDataFiltro(con({ fase: "stato:viene_in_sede" })));
  c("stato a data", "il giorno del ricontatto", G.descriviDataFiltro(con({ fase: "stato:sta_valutando" })));
  c("stato senza data", "il giorno dell'ultimo messaggio", G.descriviDataFiltro(con({ fase: "stato:segreteria" })));
  c("Da rispondere e gli altri", "il giorno dell'ultimo messaggio", G.descriviDataFiltro(con({ coda: "da-rispondere" })));
  c("sulla riga: consulenza, sede e arrivo sì; ricontatto e messaggio no (li mostra già la riga)", ["Consulenza ven 13 nov", "In sede sab 14 nov", "Arrivato dom 1 nov", null, null], [
    G.giornoUsatoSullaRiga(chat({ stato: "appuntamento_fissato", meeting: "2026-11-13" }), con({ fase: "stato:appuntamento_fissato" })),
    G.giornoUsatoSullaRiga(chat({ stato: "viene_in_sede", sede: "2026-11-14" }), con({ fase: "stato:viene_in_sede" })),
    G.giornoUsatoSullaRiga(chat({ arrivo: "2026-11-01T09:00:00Z" }), con({ coda: "da-rispondere" })),
    G.giornoUsatoSullaRiga(tutte, con({ ricontatti: true })),
    G.giornoUsatoSullaRiga(tutte, con({ coda: "da-rispondere" })),
  ]);
  c("giornoBreve: giorno della settimana, numero, mese (senza lingua del server)", ["lun 9 nov", "gio 31 dic", ""], [G.giornoBreve("2026-11-09"), G.giornoBreve("2026-12-31"), G.giornoBreve("2026-02-30")]);

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
    chat({ attesa: true, ultimo: msg("2026-11-13"), stato: "sta_valutando" }), //  questa settimana
    chat({ attesa: true, ultimo: msg("2026-11-17"), stato: "sta_valutando" }), //  prossima
    chat({ attesa: true, ultimo: msg("2026-10-01"), stato: "sta_valutando" }), //  vecchia
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
  c("Da rispondere + Oggi: solo quelli che hanno scritto oggi", [1, 2], ix(elenco({ ...daRisp, giorno: "oggi" })));
  c("Da rispondere + Ieri", [0], ix(elenco({ ...daRisp, giorno: "ieri" })));
  c("Da rispondere + Domani", [3], ix(elenco({ ...daRisp, giorno: "domani" })));
  c("Da rispondere + Questa settimana (lun 9 - dom 15)", [1, 2, 3, 4], ix(elenco({ ...daRisp, giorno: "questa-settimana" })));
  c("Da rispondere + Prossima settimana", [5], ix(elenco({ ...daRisp, giorno: "prossima-settimana" })));
  c("chi non ha una data resta fuori da ogni giorno, ma è in «Tutti»", [false, true], [
    ["ieri", "oggi", "domani", "questa-settimana", "prossima-settimana"].some((g) => elenco({ ...daRisp, giorno: g }).includes(mondo[7])),
    elenco(daRisp).includes(mondo[7]),
  ]);
  c("si somma al consulente (E)", [1], ix(elenco({ ...daRisp, giorno: "oggi", consulente: "luca" })));
  c("In valutazione + Oggi usa il RICONTATTO (non l'ultimo messaggio)", [9], ix(elenco(con({ fase: "stato:sta_valutando", giorno: "oggi" }))));
  c("In valutazione + Domani", [8], ix(elenco(con({ fase: "stato:sta_valutando", giorno: "domani" }))));
  c("Ricontatti usa il ricontatto, e convive con Esito/Data esistenti", [8, 9], ix(elenco(con({ ricontatti: true, io: "luca", giorno: "questa-settimana", rData: "con" }))));
  c("Ricontatti + giorno + Senza data: nessuno (senza data non cade in un giorno)", [], ix(elenco(con({ ricontatti: true, io: "luca", giorno: "oggi", rData: "senza" }))));
  c("senza «adesso» il giorno non filtra (non si sa che giorno è)", ix(elenco(daRisp)), ix(mondo.filter((x) => F.passaFiltri(x, { ...daRisp, giorno: "oggi" }, stelle0))));
  c("spostando l'ora, il giorno si sposta con lei (domani diventa oggi)", [3], ix(elenco({ ...daRisp, giorno: "oggi" }, quando("2026-11-10T09:00:00Z"))));

  const SEGMENTI = ["", "ieri", "oggi", "domani", "questa-settimana", "prossima-settimana"];
  const conta = (f, g) => F.contaGiorno(mondo, f, stelle0, adesso, g);
  c("ogni segmento conta ESATTAMENTE le chat che l'elenco mostrerebbe", true, SEGMENTI.every((g) => conta(daRisp, g) === elenco({ ...daRisp, giorno: g }).length));
  c("…anche con un altro filtro acceso, il consulente e Ricontatti", true, [con({ fase: "stato:sta_valutando" }), con({ coda: "da-rispondere", consulente: "luca" }), con({ ricontatti: true, io: "luca" })].every((f) => SEGMENTI.every((g) => conta(f, g) === elenco({ ...f, giorno: g }).length)));
  c("i numeri dei segmenti: Tutti 8, Ieri 1, Oggi 2, Domani 1, Settimana 4, Prossima 1", [8, 1, 2, 1, 4, 1], [conta(daRisp, ""), conta(daRisp, "ieri"), conta(daRisp, "oggi"), conta(daRisp, "domani"), conta(daRisp, "questa-settimana"), conta(daRisp, "prossima-settimana")]);
  c("il conto di un segmento ignora il giorno già scelto (è «cosa vedresti se lo tocchi»)", conta({ ...daRisp, giorno: "ieri" }, "oggi"), conta(daRisp, "oggi"));
  c("contaVoce del consulente tiene conto del giorno scelto", 1, F.contaVoce(mondo, { ...daRisp, giorno: "oggi" }, stelle0, "consulente", "luca", adesso));
  c("contaVoce di un'altra voce parte da zero: il giorno non si porta dietro", mondo.filter((x) => F.passaFiltri(x, con({ fase: "stato:sta_valutando" }), stelle0)).length, F.contaVoce(mondo, { ...daRisp, giorno: "oggi" }, stelle0, "fase", "stato:sta_valutando", adesso));

  gruppo("FILTRO GIORNO: CAMPO INTERNO (non conta sul tasto «Filtri», si azzera col filtro)");
  c("il campo c'è ed è vuoto di partenza", "", V.giorno);
  c("non conta sul tasto «Filtri»", 1, F.contaAccesi(con({ coda: "da-rispondere", giorno: "oggi" })));
  c("da solo non accende niente", 0, F.contaAccesi(con({ giorno: "oggi" })));
  c("toccare un altro filtro azzera il giorno", "", F.commuta(con({ coda: "da-rispondere", giorno: "oggi" }), "fase", "per-ora-no").giorno);
  c("…e anche toccare un altro valore dello stesso gruppo", "", F.commuta(con({ coda: "da-rispondere", giorno: "oggi" }), "coda", "da-chiamare").giorno);
  c("spegnere il filtro (toccarlo di nuovo) azzera il giorno", "", F.commuta(con({ coda: "da-rispondere", giorno: "oggi" }), "coda", "da-rispondere").giorno);
  c("togli() del filtro principale azzera il giorno", "", F.togli(con({ stelle: true, giorno: "domani" }), "stelle").giorno);
  c("spegnere «Ricontatti» azzera esito, data e giorno", ["", "", ""], ((f) => [f.rEsito, f.rData, f.giorno])(F.togli(con({ ricontatti: true, rEsito: "piu_avanti", rData: "con", giorno: "oggi" }), "ricontatti")));
  c("scegliere un consulente NON toglie il giorno", "oggi", F.commuta(con({ coda: "da-rispondere", giorno: "oggi" }), "consulente", "luca").giorno);
  c("togliere il consulente NON toglie il giorno", "oggi", F.togli(con({ coda: "da-rispondere", giorno: "oggi", consulente: "luca" }), "consulente").giorno);
  c("togliere Esito o Data di Ricontatti NON toglie il giorno", ["oggi", "oggi"], [F.togli(con({ ricontatti: true, rEsito: "piu_avanti", giorno: "oggi" }), "rEsito").giorno, F.togli(con({ ricontatti: true, rData: "con", giorno: "oggi" }), "rData").giorno]);
  c("togli(\"giorno\") toglie solo il giorno", { ...con({ coda: "da-rispondere" }) }, F.togli(con({ coda: "da-rispondere", giorno: "oggi" }), "giorno"));
  c("«Azzera» (FILTRI_VUOTI) lo azzera", "", V.giorno);
  c("l'etichetta con la ✕ c'è e si toglie col suo campo", [{ campo: "coda", etichetta: "Da rispondere" }, { campo: "giorno", etichetta: "Questa settimana" }], F.etichetteAccese(con({ coda: "da-rispondere", giorno: "questa-settimana" }), () => ""));
  c("senza giorno nessuna etichetta in più", [{ campo: "coda", etichetta: "Da rispondere" }], F.etichetteAccese(con({ coda: "da-rispondere" }), () => ""));

  gruppo("FILTRO GIORNO: DAL DISPOSITIVO SI RILEGGE SOLO QUELLO CHE SI CONOSCE");
  const rileggi = (o, cons = null) => F.leggiFiltri(JSON.stringify(o), cons);
  c("un giorno valido con un filtro acceso si rilegge", "domani", rileggi({ coda: "da-rispondere", giorno: "domani" }).giorno);
  c("tutti i segmenti si rileggono", true, SEGMENTI.slice(1).every((g) => rileggi({ stelle: true, giorno: g }).giorno === g));
  c("un valore sconosciuto è vuoto", "", rileggi({ coda: "da-rispondere", giorno: "tra-un-mese" }).giorno);
  c("un numero, un oggetto, null: vuoto", ["", "", ""], [rileggi({ stelle: true, giorno: 3 }).giorno, rileggi({ stelle: true, giorno: {} }).giorno, rileggi({ stelle: true, giorno: null }).giorno]);
  c("un giorno senza filtro acceso non resta di nascosto", "", rileggi({ giorno: "oggi" }).giorno);
  c("…nemmeno col solo consulente salvato", "", rileggi({ giorno: "oggi" }, "luca").giorno);
  c("più filtri salvati: ne resta uno e il giorno va con lui", ["fase", "oggi"], ((f) => [f.fase ? "fase" : "?", f.giorno])(rileggi({ coda: "da-rispondere", fase: "per-ora-no", giorno: "oggi" })));
  c("con Ricontatti il giorno convive con esito e data", ["oggi", "piu_avanti", "con"], ((f) => [f.giorno, f.rEsito, f.rData])(rileggi({ ricontatti: true, rEsito: "piu_avanti", rData: "con", giorno: "oggi" })));
  c("scrivi + rileggi: il giorno resta", "ieri", F.leggiFiltri(F.scriviFiltriSessione(con({ finestra: "chiusa", giorno: "ieri" })), null).giorno);
  c("testo rotto: tutto spento, nessun errore", "", F.leggiFiltri("{rotto", null).giorno);
  c("soloUno non muta l'ingresso e tiene il giorno col filtro scelto", "oggi", F.soloUno(con({ acconto: true, giorno: "oggi" })).giorno);

  // ── Il disegno e i paletti ───────────────────────────────────────────────────────────────────
  gruppo("FILTRO GIORNO: L'INTERFACCIA (fila a segmenti, scorrevole, coerente con le altre)");
  const riga = senzaCommenti(leggi("src/crm/chatwa/RigaGiorno.tsx"));
  const elencoSrc = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  const filtriSrc = senzaCommenti(leggi("src/crm/chatwa/filtri.ts"));
  const rigaChat = senzaCommenti(leggi("src/crm/chatwa/RigaChat.tsx"));
  c("i segmenti sono quelli della spec, in ordine", ["Tutti", "Ieri", "Oggi", "Domani", "Questa settimana", "Prossima settimana"], G.SEGMENTI_GIORNO.map((s) => s.nome));
  c("«Tutti» vale vuoto, gli altri hanno un valore ciascuno", ["", "ieri", "oggi", "domani", "questa-settimana", "prossima-settimana"], G.SEGMENTI_GIORNO.map((s) => s.v));
  c("la fila è un gruppo con nome e ogni segmento è aria-pressed", true, /role="group"/.test(riga) && /aria-label="Giorno/.test(riga) && /aria-pressed=\{/.test(riga));
  c("scorre di lato su telefono (overflow-x-auto) e la pagina no", true, /overflow-x-auto/.test(riga) && /overscroll-x-contain/.test(riga) && /min-w-0/.test(riga));
  c("i segmenti non si schiacciano né vanno a capo", true, /shrink-0/.test(riga) && /whitespace-nowrap/.test(riga));
  c("ogni segmento mostra il suo numero (dal conto condiviso, non calcolato qui)", true, /conta\(/.test(riga) && !/passaFiltri|filter\(/.test(riga));
  c("ritoccare il segmento acceso torna a «Tutti»", true, /acceso\s*\?\s*""\s*:/.test(riga));
  c("tocco da 44 px sul telefono come le altre righe", true, /after:-inset-y-/.test(riga) || /h-11/.test(riga));
  c("la pagina la disegna con un filtro acceso (non con la sola riga «Tutte»), a caricamento finito", true, /<RigaGiorno/.test(elencoSrc) && /!caricamento\s*&&\s*!soloRiga/.test(elencoSrc));
  c("sta vicino alla Data di Ricontatti, fuori dall'elenco (resta con zero risultati)", true, elencoSrc.indexOf("<RigaGiorno") > elencoSrc.indexOf("<RigaDataRicontatti") && elencoSrc.indexOf("<RigaGiorno") < elencoSrc.indexOf("trovate.length === 0"));
  c("i numeri della fila usano contaGiorno e l'elenco la stessa passaFiltri, con la stessa ora", true, /contaGiorno\(/.test(elencoSrc) && /passaFiltri\(c, filtri, stelleDi, adessoData\)/.test(elencoSrc));
  c("il giorno è nel salvataggio della vista (si torna in cima se cambia)", true, /JSON\.stringify\(\[filtri,/.test(elencoSrc));
  c("la riga mostra la data usata solo quando non c'è già (consulenza, sede, arrivo)", true, /giornoUsato/.test(rigaChat) && /giornoUsato/.test(elencoSrc));
  c("passaFiltro (cercaChat.ts) non è toccata: non sa niente del giorno", false, /giorno/i.test(senzaCommenti(leggi("src/crm/chatwa/cercaChat.ts"))));
  c("la logica del giorno non legge l'orologio (niente Date.now / new Date() senza argomenti)", false, /Date\.now\(|new Date\(\)/.test(senzaCommenti(leggi("src/crm/chatwa/giorno.ts"))));
  c("nessun database: giorno.ts non importa Supabase", false, /supabase/i.test(senzaCommenti(leggi("src/crm/chatwa/giorno.ts"))));
  c("niente emoji nei file nuovi", true, ![riga, senzaCommenti(leggi("src/crm/chatwa/giorno.ts"))].some((t) => /\p{Extended_Pictographic}/u.test(t)));
  c("il campo è dichiarato in FiltriChat ed è interno come rEsito/rData", true, /giorno: GiornoChat/.test(filtriSrc) && /CAMPI_INTERNI = \["io", "rEsito", "rData", "giorno"\]/.test(filtriSrc));
}
