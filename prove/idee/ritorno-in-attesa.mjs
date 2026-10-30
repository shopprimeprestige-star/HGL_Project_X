/** ── PROVE: CHI TORNA VA IN «ATTESA WHATSAPP» (30/10/2026) ─────────────────
 *
 *  Richiesta del titolare: quando un lead ricompare (modulo, foglio, file), lo
 *  stato diventa da solo «Attesa WhatsApp», qualunque fosse; lo stato di prima
 *  resta in `statoPrecedente`/`statoPrecedenteIl` e si legge sotto lo stato
 *  («prima: Non interessato»). Non si spostano appuntamenti, acconti e vendite.
 *  Chi era già tornato e non è mai stato toccato lo sposta il giro del server.
 *  Dati inventati: nessun numero né nome vero.
 *  `mod`: i moduli impacchettati. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveRitornoInAttesa(mod, { c, gruppo, radice }) {
  const RIC = mod["importa/ricarico"];
  const R = mod["chatwa/ritorno"];
  const ORA = new Date("2026-10-30T10:00:00Z");
  const ISO = ORA.toISOString();
  const scheda = (stato, altro = {}) => ({
    nome: "Ada",
    telefono: "+393330000001",
    stato,
    note: "nota vecchia",
    ...altro,
  });

  gruppo("RITORNO · LO STATO DIVENTA «ATTESA WHATSAPP»");
  for (const stato of ["annullato", "da_ricontattare", "sta_valutando", "non_risponde", "da_contattare", "perdi_tempo", "no_show"]) {
    const p = RIC.patchRicarico(scheda(stato), "Lista.csv", ORA);
    c(`«${stato}» → attesa_whatsapp, con lo stato di prima e l'ora`, ["attesa_whatsapp", stato, ISO, ISO, ISO], [p.stato, p.statoPrecedente, p.statoPrecedenteIl, p.statoDal, p.ricarico?.inAttesaIl]);
  }
  const p1 = RIC.patchRicarico(scheda("annullato"), "Lista.csv", ORA);
  c("le note e il resto della scheda non si toccano", ["ricarico", "stato", "statoDal", "statoPrecedente", "statoPrecedenteIl"], Object.keys(p1).sort());
  c("statoAllora resta lo stato di quando è tornato", "annullato", p1.ricarico.statoAllora);

  gruppo("RITORNO · IL SECONDO RITORNO NON CANCELLA IL «PRIMA»");
  //  Revisione 30/10: tornava una seconda volta e `statoAllora` diventava
  //  «attesa_whatsapp», `inAttesaIl` spariva: niente «prima» e hgl_ritorno a chi
  //  era «In valutazione».
  const val1 = { ...scheda("sta_valutando"), ...RIC.patchRicarico(scheda("sta_valutando"), "L", ORA) };
  const ORA2 = new Date("2026-10-31T10:00:00Z");
  const p2 = RIC.patchRicarico(val1, "L2", ORA2);
  const val2 = { ...val1, ...p2 };
  c("secondo ritorno in Attesa WhatsApp: statoAllora, inAttesaIl e statoPrecedente restano quelli di prima", ["sta_valutando", ISO, "sta_valutando", 2], [val2.ricarico.statoAllora, val2.ricarico.inAttesaIl, val2.statoPrecedente, val2.ricarico.volte]);
  c("…lo stato non si riscrive (è già Attesa WhatsApp)", false, "stato" in p2);
  c("…e il «prima» si vede ancora", "In valutazione", R.primaDelRitorno(val2));
  const dc = { ...val1, stato: "da_chiamare", statoPrecedente: "attesa_whatsapp", statoPrecedenteIl: "2026-10-30T20:00:00Z" };
  const p3 = RIC.patchRicarico(dc, "L3", ORA2);
  const dc2 = { ...dc, ...p3 };
  c("secondo ritorno da «Da chiamare»: torna in Attesa WhatsApp ma tiene lo stato di prima originale", ["attesa_whatsapp", "attesa_whatsapp", "sta_valutando", ISO, ORA2.toISOString()], [dc2.stato, dc2.statoPrecedente, dc2.ricarico.statoAllora, dc2.ricarico.inAttesaIl, dc2.statoPrecedenteIl]);
  c("…e il «prima» resta «In valutazione»", "In valutazione", R.primaDelRitorno(dc2));

  gruppo("RITORNO · LE ECCEZIONI RESTANO DOVE SONO");
  for (const stato of ["appuntamento_fissato", "appuntamento_rifissato", "viene_in_sede", "acconto", "in_attesa_acconto", "posa_in_sede", "posa_a_domicilio", "posa_da_spedire", "venduto"]) {
    const p = RIC.patchRicarico(scheda(stato), "Lista.csv", ORA);
    c(`«${stato}» non si sposta`, [undefined, undefined, undefined], [p.stato, p.statoPrecedente, p.ricarico?.inAttesaIl]);
  }
  c("acconto pagato (qualunque stato) non si sposta", undefined, RIC.patchRicarico(scheda("sta_valutando", { payment: { accontoPagato: 200 } }), "L", ORA).stato);
  c("già in Attesa WhatsApp: niente cambio di stato (e niente nuovo «prima»)", [undefined, undefined], ((p) => [p.stato, p.statoPrecedente])(RIC.patchRicarico(scheda("attesa_whatsapp"), "L", ORA)));
  c("l'elenco delle eccezioni è scritto in un posto solo", true, ["appuntamento_fissato", "appuntamento_rifissato", "viene_in_sede", "acconto", "in_attesa_acconto", "venduto"].every((s) => RIC.STATI_CHE_RESTANO_AL_RITORNO.includes(s)));

  gruppo("RITORNO · «PRIMA: …» SOTTO LO STATO");
  const dopo = { ...scheda("annullato"), ...p1 };
  c("dopo il ritorno: prima = Non interessato (etichetta del CRM)", "Non interessato", R.primaDelRitorno(dopo));
  c("anche dopo il passaggio automatico a Da chiamare", "Non interessato", R.primaDelRitorno({ ...dopo, stato: "da_chiamare", statoPrecedente: "attesa_whatsapp" }));
  c("se la setter cambia stato a mano, il «prima» sparisce", null, R.primaDelRitorno({ ...dopo, stato: "appuntamento_fissato" }));
  c("una scheda non di ritorno: niente", null, R.primaDelRitorno(scheda("attesa_whatsapp")));
  c("un appuntamento che non si è mosso: niente «prima»", null, R.primaDelRitorno({ ...scheda("appuntamento_fissato"), ...RIC.patchRicarico(scheda("appuntamento_fissato"), "L", ORA) }));
  c("la storia del ritorno racconta lo stato di prima, non «mai chiamato»", "Aveva detto di no", RIC.storiaDelRitorno(dopo).etichetta);

  gruppo("RITORNO · CHI ERA GIÀ TORNATO (GIRO DEL SERVER)");
  const vecchio = (stato, altro = {}, ric = {}) =>
    scheda(stato, { statoPrecedenteIl: "2026-10-20T09:00:00Z", ricarico: { volte: 1, ultimo: "2026-10-25T09:00:00Z", daDecidere: true, statoAllora: stato, ...ric }, ...altro });
  const g = RIC.patchRitornoRimastoIndietro(vecchio("annullato"), ORA);
  c("tornato e rimasto «Non interessato» → Attesa WhatsApp", ["attesa_whatsapp", "annullato", ISO, ISO], [g?.stato, g?.statoPrecedente, g?.statoPrecedenteIl, g?.ricarico?.inAttesaIl]);
  c("il ricarico resta intero (volte, statoAllora)", [1, "annullato", "2026-10-25T09:00:00Z"], [g?.ricarico?.volte, g?.ricarico?.statoAllora, g?.ricarico?.ultimo]);
  c("stato cambiato a mano DOPO il ritorno: non si tocca", null, RIC.patchRitornoRimastoIndietro(vecchio("annullato", { statoPrecedenteIl: "2026-10-26T09:00:00Z" }), ORA));
  c("…anche se la data è in statoDal", null, RIC.patchRitornoRimastoIndietro(vecchio("annullato", { statoDal: "2026-10-26T09:00:00Z" }), ORA));
  c("stato diverso da quello di quando è tornato: non si tocca", null, RIC.patchRitornoRimastoIndietro(vecchio("annullato", {}, { statoAllora: "non_risponde" }), ORA));
  c("scheda vecchia senza statoAllora: non si inventa", null, RIC.patchRitornoRimastoIndietro(vecchio("annullato", {}, { statoAllora: undefined }), ORA));
  c("già spostato una volta: mai due", null, RIC.patchRitornoRimastoIndietro(vecchio("annullato", {}, { inAttesaIl: "2026-10-29T09:00:00Z" }), ORA));
  c("appuntamento: resta", null, RIC.patchRitornoRimastoIndietro(vecchio("appuntamento_fissato"), ORA));
  c("acconto pagato: resta", null, RIC.patchRitornoRimastoIndietro(vecchio("sta_valutando", { payment: { accontoPagato: 50 } }), ORA));
  c("non di ritorno: niente", null, RIC.patchRitornoRimastoIndietro(scheda("annullato"), ORA));
  //  Revisione 30/10: le decisioni già prese non si toccano, né STOP e revoca.
  const confermato = vecchio("annullato");
  Object.assign(confermato, RIC.patchConferma(confermato));
  c("«Conferma» già premuto (daDecidere tolto): resta", null, RIC.patchRitornoRimastoIndietro(confermato, ORA));
  c("«Vedi dopo»: resta", null, RIC.patchRitornoRimastoIndietro(vecchio("annullato", {}, { rimandatoIl: "2026-10-26T09:00:00Z" }), ORA));
  c("«Contatta su WhatsApp»: resta", null, RIC.patchRitornoRimastoIndietro(vecchio("annullato", {}, { whatsappIl: "2026-10-26T09:00:00Z" }), ORA));
  c("messo da parte: resta", null, RIC.patchRitornoRimastoIndietro(vecchio("annullato", { saltatoIl: "2026-10-26T09:00:00Z" }), ORA));
  c("STOP sul contatto: resta", null, RIC.patchRitornoRimastoIndietro(vecchio("annullato", { contattoWa: { stato: "stop" } }), ORA));
  c("revoca di «Ok a WhatsApp»: resta", null, RIC.patchRitornoRimastoIndietro(vecchio("annullato", { okWhatsapp: { si: false } }), ORA));
  c("…e con «Ok a WhatsApp» dato si sposta", "attesa_whatsapp", RIC.patchRitornoRimastoIndietro(vecchio("annullato", { okWhatsapp: { si: true } }), ORA)?.stato);
  c("già in Attesa WhatsApp: niente", null, RIC.patchRitornoRimastoIndietro(vecchio("attesa_whatsapp"), ORA));

  const hook = readFileSync(join(radice, "src/routes/hooks/attesa-da-chiamare.ts"), "utf8");
  c("il giro del server lo fa, a pagine e solo se la scheda non è cambiata", true,
    /giroRitorniRimastiIndietro/.test(hook) && /patchRitornoRimastoIndietro\(/.test(hook) &&
    /data->ricarico->>ultimo/.test(hook) && /\.range\(da, da \+ PAGINA - 1\)/.test(hook));
  c("…e parte nello stesso POST del cron, prima del giro «Da chiamare»", true,
    /const rimasti = await giroRitorniRimastiIndietro\(adesso\)/.test(hook) &&
    hook.indexOf("giroRitorniRimastiIndietro(adesso)") < hook.indexOf("giroAttesaDaChiamare(adesso))"));

  gruppo("RITORNO · «PRIMA: …» NEI PUNTI DOVE SI VEDE LO STATO");
  const leggi = (f) => readFileSync(join(radice, "src", f), "utf8");
  for (const f of [
    "crm/chatwa/RigaChat.tsx",
    "crm/importa/SchedaProssimo.tsx",
    "crm/importa/SchedaTutti.tsx",
    "crm/importa/BloccoRitorno.tsx",
    "crm/dafare/VoceDaFare.tsx",
    "crm/LeadDialog.tsx",
  ])
    c(`${f}: mostra «prima: …» sotto lo stato`, true, /<PrimaDelRitorno\b/.test(leggi(f)));
  const comp = leggi("crm/importa/PrimaDelRitorno.tsx");
  c("il componente usa la regola provata e l'icona del ritorno", true, /primaDelRitorno\(/.test(comp) && /Undo2/.test(comp) && /prima: /.test(comp));
}
