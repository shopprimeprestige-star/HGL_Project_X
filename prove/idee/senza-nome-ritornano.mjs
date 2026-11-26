/** ── PROVE: «NON INTERESSATO» NON TORNA IN LAVORAZIONE DA SOLO (26/11/2026) ──
 *  Segnalazione del titolare: «i contatti senza nome, anche se metto non
 *  interessato, dopo un po' ritornano continuamente». Due cause, entrambe
 *  indipendenti dal nome (il contatto si riconosce dal numero):
 *   1. il ritorno (foglio Meta, file, giro del server) spostava chi era «Non
 *      interessato» in «Attesa WhatsApp»;
 *   2. l'esito «Non interessato» non spegneva la domanda «di ritorno»
 *      (`ricarico.daDecidere`), e la coda lo riproponeva comunque.
 *  Regola: il no messo a mano resta; se riscrive davvero, si segnala come per
 *  gli altri stati chiusi (la scheda resta com'è, `daDecidere` acceso).
 *  Dati inventati: nessun numero né nome vero. */
export function proveSenzaNomeRitornano(mod, { c, gruppo }) {
  const RIC = mod["importa/ricarico"];
  const CH = mod["importa/chi-chiamare"];
  const BK = mod["import-backup"];
  const ORA = new Date("2026-11-26T10:00:00Z");
  const TEL = "+393330000009";
  /** un contatto senza nome e senza cognome, con il solo numero */
  const senzaNome = (stato, altro = {}) => ({ nome: "", cognome: "", telefono: TEL, stato, importato: true, ...altro });

  gruppo("SENZA NOME · IL NUMERO LO RICONOSCE ANCHE SENZA NOME");
  const archivio = [{ id: "a1", data: senzaNome("annullato") }];
  const arrivo = [{ nome: "", cognome: "", telefono: "0039 333 000 0009" }];
  c("la riga senza nome con lo stesso numero è un ritorno (non una scheda nuova)", [1, 0], ((e) => [e.ritorni.length, e.nuovi.length])(BK.separaRitorni(arrivo, archivio)));

  gruppo("SENZA NOME · IL RITORNO NON TOCCA UN «NON INTERESSATO»");
  const p = RIC.patchRicarico(senzaNome("annullato"), "Foglio", ORA);
  c("lo stato non si riscrive", undefined, p.stato);
  c("non si inventa un «prima»", [undefined, undefined], [p.statoPrecedente, p.ricarico?.inAttesaIl]);
  c("si segnala come per gli altri stati chiusi: contatore e domanda aperta", [1, true], [p.ricarico?.volte, p.ricarico?.daDecidere]);
  c("anche il secondo ritorno lascia lo stato com'è", undefined, RIC.patchRicarico({ ...senzaNome("annullato"), ...p }, "Foglio", new Date("2026-11-27T10:00:00Z")).stato);

  gruppo("SENZA NOME · IL GIRO DEL SERVER NON LO SPOSTA");
  const vecchio = senzaNome("annullato", {
    statoPrecedenteIl: "2026-10-20T09:00:00Z",
    ricarico: { volte: 1, ultimo: "2026-10-25T09:00:00Z", daDecidere: true, statoAllora: "annullato" },
  });
  c("tornato prima del 30/10 e rimasto «Non interessato»: resta", null, RIC.patchRitornoRimastoIndietro(vecchio, ORA));

  gruppo("SENZA NOME · IL NO DATO DALLA CODA TOGLIE LA DOMANDA DI RITORNO");
  const tornato = senzaNome("non_risponde", {
    ricarico: { volte: 1, ultimo: "2026-11-25T09:00:00Z", daDecidere: true, statoAllora: "non_risponde" },
  });
  const lead = (d) => ({ id: "x1", data: d });
  c("prima del no è in lista (di ritorno)", true, CH.inLista(lead(tornato), ORA));
  const dopoNo = { ...tornato, ...CH.patchEsito(tornato, "annullato") };
  c("dopo «Non interessato» non è più in lista", false, CH.inLista(lead(dopoNo), ORA));
  c("lo stato è «Non interessato»", "annullato", dopoNo.stato);
  c("la storia del ritorno resta (contatore)", 1, dopoNo.ricarico?.volte);
  c("«Vedi dopo» e «Contatta su WhatsApp» spenti insieme alla domanda", [undefined, undefined], [dopoNo.ricarico?.rimandatoIl, dopoNo.ricarico?.whatsappIl]);
  const nr = { ...tornato, ...CH.patchEsito(tornato, "non_risponde") };
  c("gli altri esiti non cambiano: «Non risponde» lascia la domanda aperta", true, nr.ricarico?.daDecidere);
  c("un esito su chi non è di ritorno non inventa un ricarico", false, "ricarico" in CH.patchEsito(senzaNome("da_contattare"), "annullato"));

  gruppo("SENZA NOME · SE RISCRIVE DAVVERO SI SEGNALA, NON SI SPOSTA");
  const poi = { ...dopoNo, ...RIC.patchRicarico(dopoNo, "Foglio", ORA) };
  c("lo stato resta «Non interessato»", "annullato", poi.stato);
  c("la domanda si riapre (è in lista come un appuntamento che torna)", true, CH.inLista(lead(poi), ORA));
  c("e il contatore sale a 2", 2, poi.ricarico?.volte);
}
