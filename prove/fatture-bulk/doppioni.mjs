/** ── FATTURE BULK · T4 · DOPPIONI E SCHEDE ─────────────────────────────────
 *  `trovaDoppioni` (tabella 2.7 di NOTE-FISCALI), `impronteGiaViste`,
 *  `abbinaScheda` (SPEC §5). Funzioni pure: ogni prova controlla anche che
 *  l'input, congelato, non venga mutato.
 *  ⚠️ Dati inventati: nomi di fantasia, CF col controllo calcolato (dati.mjs). */
import { CF_PROVA, cfConControllo } from "./dati.mjs";

const CF_ALTRO = cfConControllo("VRDLCU85M41F205");
const CF_TERZO = cfConControllo("GLLNNA90C41L219");
/** Nome e cognome di un'altra persona: i fixtures di «un'altra riga» non devono sembrare omonimi. */
const ALTRA = { nome: "Marco", cognome: "Bianchi", codiceFiscale: CF_ALTRO };

/** Congela in profondità: una funzione che prova a scrivere lancia. */
function congela(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) congela(v);
  }
  return o;
}

const campi = (extra = {}) => ({
  nome: "Lucia", cognome: "Verdi", codiceFiscale: CF_PROVA, indirizzo: "Via dei Tigli 4", cap: "20100",
  comune: "Milano", provincia: "MI", importo: 104, data: "2026-11-03", modo: "pos", riferimento: "", ...extra,
});
const riga = (extra = {}) => ({
  idRiga: "0003-0004-0005", numero: 2, campi: campi(), improntaPagamento: "imp-pag-riga", riferimento: "", ...extra,
});
const fattura = (extra = {}) => ({
  id: "2026-0007", stato: "emessa", numero: 7, anno: 2026, serie: "", data: "2026-11-03", dataPagamento: "2026-11-03",
  tipo: "unica", leadId: "lead-1", leadNome: "", preventivoRef: "", causale: "", righe: [], imponibile: 85.25,
  imposta: 18.75, totale: 104, creataIl: "", emessaIl: "",
  cliente: { azienda: false, nome: "Lucia", cognome: "Verdi", codiceFiscale: CF_PROVA, denominazione: "", partitaIva: "",
    indirizzo: "", civico: "", cap: "", comune: "", provincia: "", nazione: "IT", codiceDestinatario: "0000000", pec: "" },
  ...extra,
});
const altraPersona = { ...fattura().cliente, codiceFiscale: CF_ALTRO, nome: "Marco", cognome: "Bianchi" };
/** Una bozza di un'ALTRA persona, salvo diversa indicazione. */
const bozza = (extra = {}) => fattura({ id: "bozza:lead-9", stato: "bozza", numero: 0, anno: 2026, data: "", dataPagamento: "", leadId: "lead-9", cliente: altraPersona, ...extra });
const fonti = (extra = {}) => ({ emesse: [], bozze: [], altreRighe: [], altriLotti: [], ...extra });
const sigle = (motivi) => motivi.map((m) => `${m.codice}:${m.gravita}`);

export async function prove(mod, { c, gruppo }) {
  const D = mod["fatture/bulk/doppioni-e-schede"];

  gruppo("BULK · T4 · DOPPIONI · NIENTE DA SEGNALARE");
  c("nessuna fonte → nessun motivo", [], D.trovaDoppioni(riga(), fonti()));
  c("una fattura di un'altra persona, altro importo → nessun motivo", [],
    D.trovaDoppioni(riga(), fonti({ emesse: [fattura({ cliente: { ...fattura().cliente, codiceFiscale: CF_ALTRO, nome: "Marco", cognome: "Bianchi" }, totale: 50 })] })));
  c("la riga non si confronta con sé stessa", [],
    D.trovaDoppioni(riga(), fonti({ altreRighe: [riga()] })));

  gruppo("BULK · T4 · STESSO RIFERIMENTO (≥ 6 CARATTERI) = BLOCCA");
  const conRif = riga({ riferimento: "CRO 1234567890" });
  const m1 = D.trovaDoppioni(conRif, fonti({ emesse: [fattura({ riferimentoPagamento: "cro1234567890", totale: 70, data: "2026-10-01", cliente: { ...fattura().cliente, codiceFiscale: CF_ALTRO } })] }));
  c("su una emessa (maiuscole e spazi non contano) → blocca", ["doppione_riferimento:blocca"], sigle(m1));
  c("dice quale fattura", true, m1[0]?.testo.includes("2026/0007"));
  c("il campo da guardare è il riferimento", "riferimento", m1[0]?.campo);
  c("sulla emessa anche via origineBulk.riferimento", ["doppione_riferimento:blocca"],
    sigle(D.trovaDoppioni(conRif, fonti({ emesse: [fattura({ totale: 70, cliente: { ...fattura().cliente, codiceFiscale: CF_ALTRO }, origineBulk: { lotto: "lotto-vecchio", riga: "0000-0001-0002", impronte: [], riferimento: "CRO1234567890" } })] }))));
  const mb = D.trovaDoppioni(conRif, fonti({ bozze: [bozza({ riferimentoPagamento: "CRO1234567890" })] }));
  c("su una bozza (di un'altra persona) → blocca, e dice che è una bozza", [["doppione_riferimento:blocca"], true],
    [sigle(mb), mb[0]?.testo.toLowerCase().includes("bozza")]);
  const mr = D.trovaDoppioni(conRif, fonti({ altreRighe: [riga({ idRiga: "0006-0007-0008", numero: 3, riferimento: "CRO1234567890", improntaPagamento: "imp-x", campi: campi({ codiceFiscale: CF_ALTRO, nome: "Marco", cognome: "Bianchi", importo: 70 }) })] }));
  c("su un'altra riga del lotto → blocca, con il numero della riga", [["doppione_riferimento:blocca"], true],
    [sigle(mr), mr[0]?.testo.includes("riga 3")]);
  c("riferimento di 5 caratteri → troppo corto, non blocca", [],
    D.trovaDoppioni(riga({ riferimento: "AB123" }), fonti({ emesse: [fattura({ riferimentoPagamento: "AB123", totale: 70, cliente: { ...fattura().cliente, codiceFiscale: CF_ALTRO } })] })));
  c("riferimento diverso → non blocca", [],
    D.trovaDoppioni(riga({ riferimento: "CRO7654321" }), fonti({ emesse: [fattura({ riferimentoPagamento: "CRO1234567", totale: 70, cliente: { ...fattura().cliente, codiceFiscale: CF_ALTRO } })] })));
  c("riferimento vuoto da entrambe le parti → non blocca", [],
    D.trovaDoppioni(riga(), fonti({ emesse: [fattura({ riferimentoPagamento: "", totale: 70, cliente: { ...fattura().cliente, codiceFiscale: CF_ALTRO } })] })));

  gruppo("BULK · T4 · STESSO SCREENSHOT DEL PAGAMENTO (IMPRONTA) = BLOCCA");
  const altroPag = { totale: 70, data: "2026-10-01", cliente: { ...fattura().cliente, codiceFiscale: CF_ALTRO } };
  c("impronta in una fattura emessa (origineBulk.impronte) → blocca", ["doppione_screenshot:blocca"],
    sigle(D.trovaDoppioni(riga(), fonti({ emesse: [fattura({ ...altroPag, origineBulk: { lotto: "lotto-vecchio", riga: "0000-0001-0002", impronte: ["a", "imp-pag-riga", "c"] } })] }))));
  c("impronta in un'altra riga del lotto → blocca", ["doppione_screenshot:blocca"],
    sigle(D.trovaDoppioni(riga(), fonti({ altreRighe: [riga({ idRiga: "0006-0007-0008", numero: 3, improntaPagamento: "imp-pag-riga", campi: campi({ ...ALTRA, importo: 70, data: "2026-10-01" }) })] }))));
  c("impronta in un altro lotto aperto → blocca", ["doppione_screenshot:blocca"],
    sigle(D.trovaDoppioni(riga(), fonti({ altriLotti: ["zzz", "imp-pag-riga"] }))));
  c("impronta in una bozza con origineBulk → blocca", ["doppione_screenshot:blocca"],
    sigle(D.trovaDoppioni(riga(), fonti({ bozze: [bozza({ origineBulk: { lotto: "l", riga: "r", impronte: ["imp-pag-riga"] } })] }))));
  c("impronta diversa → non blocca", [],
    D.trovaDoppioni(riga(), fonti({ altriLotti: ["altra"], altreRighe: [riga({ idRiga: "0006-0007-0008", improntaPagamento: "altra-2", campi: campi({ ...ALTRA, importo: 70, data: "2026-10-01" }) })] })));
  c("impronta vuota (non calcolata) non è mai un doppione", [],
    D.trovaDoppioni(riga({ improntaPagamento: "" }), fonti({ altriLotti: [""], altreRighe: [riga({ idRiga: "0006-0007-0008", improntaPagamento: "", campi: campi({ ...ALTRA, importo: 70, data: "2026-10-01" }) })] })));
  const mi = D.trovaDoppioni(riga(), fonti({ altriLotti: ["imp-pag-riga"] }));
  c("il motivo parla dello screenshot e non indica un campo (è la riga intera)", [undefined, true], [mi[0]?.campo, mi[0]?.testo.includes("screenshot")]);

  gruppo("BULK · T4 · IMPRONTE GIÀ VISTE · E LO SCENARIO DELLA PULIZIA");
  const viste = D.impronteGiaViste(fonti({
    emesse: [fattura({ origineBulk: { lotto: "l1", riga: "r", impronte: ["e1", "e2"] } }), fattura({ id: "2026-0008" })],
    bozze: [bozza({ origineBulk: { lotto: "l2", riga: "r", impronte: ["b1"] } })],
    altreRighe: [riga({ improntaPagamento: "r1" }), riga({ improntaPagamento: "" })],
    altriLotti: ["l3", ""],
  }));
  c("raccoglie emesse, bozze, altre righe e altri lotti, senza vuoti", ["b1", "e1", "e2", "l3", "r1"], [...viste].sort());
  c("è un Set", true, viste instanceof Set);
  // Il lotto è stato chiuso e cancellato: restano solo le fatture. Ricomponendo gli stessi file, il
  // pagamento già fatturato non si emette due volte.
  const fatturaDelLotto = fattura({ origineBulk: { lotto: "lotto-chiuso", riga: "0003-0004-0005", impronte: ["imp-ind", "imp-tes", "imp-pag-riga"] } });
  c("lotto cancellato, stessi file ricaricati → il pagamento è bloccato (e sembra già fatturato)", ["doppione_screenshot:blocca", "doppione_pagamento:conferma"],
    sigle(D.trovaDoppioni(riga({ idRiga: "0000-0001-0002" }), fonti({ emesse: [fatturaDelLotto] }))));
  c("ricaricando solo tessera e indirizzo con un altro pagamento → nessun blocco", [],
    D.trovaDoppioni(riga({ idRiga: "0000-0001-0002", improntaPagamento: "imp-pag-nuovo", campi: campi({ importo: 90, data: "2026-11-10" }) }),
      fonti({ emesse: [{ ...fatturaDelLotto, totale: 104 }] })).filter((m) => m.gravita === "blocca"));

  gruppo("BULK · T4 · STESSO CF + STESSO TOTALE + STESSA DATA = CONFERMA");
  const uguale = fattura();
  const mc = D.trovaDoppioni(riga(), fonti({ emesse: [uguale] }));
  c("su una emessa → conferma, con il numero", [["doppione_pagamento:conferma"], true],
    [sigle(mc).filter((s) => s.startsWith("doppione_pagamento")), mc.find((m) => m.codice === "doppione_pagamento")?.testo.includes("già fatturata con la fattura 2026/0007")]);
  c("CF in minuscolo e con spazi → lo stesso", true,
    sigle(D.trovaDoppioni(riga({ campi: campi({ codiceFiscale: ` ${CF_PROVA.toLowerCase()} ` }) }), fonti({ emesse: [uguale] }))).includes("doppione_pagamento:conferma"));
  c("totale al centesimo (104 contro 104,00)", true,
    sigle(D.trovaDoppioni(riga({ campi: campi({ importo: 104.0 }) }), fonti({ emesse: [fattura({ totale: 104.0 })] }))).includes("doppione_pagamento:conferma"));
  c("totale diverso di un centesimo → non è un doppione", false,
    sigle(D.trovaDoppioni(riga({ campi: campi({ importo: 104.01 }) }), fonti({ emesse: [uguale] }))).includes("doppione_pagamento:conferma"));
  c("data diversa → non è un doppione", false,
    sigle(D.trovaDoppioni(riga({ campi: campi({ data: "2026-11-04" }) }), fonti({ emesse: [uguale] }))).includes("doppione_pagamento:conferma"));
  c("CF diverso → non è un doppione", false,
    sigle(D.trovaDoppioni(riga({ campi: campi({ codiceFiscale: CF_ALTRO }) }), fonti({ emesse: [uguale] }))).includes("doppione_pagamento:conferma"));
  c("CF vuoto (non valido) non si confronta", [],
    D.trovaDoppioni(riga({ campi: campi({ codiceFiscale: "" }) }), fonti({ emesse: [fattura({ cliente: { ...uguale.cliente, codiceFiscale: "" } })] })));
  c("importo mancante non si confronta", false,
    sigle(D.trovaDoppioni(riga({ campi: campi({ importo: null }) }), fonti({ emesse: [uguale] }))).includes("doppione_pagamento:conferma"));
  const mrg = D.trovaDoppioni(riga(), fonti({ altreRighe: [riga({ idRiga: "0006-0007-0008", numero: 3, improntaPagamento: "diversa" })] }));
  c("su un'altra riga del lotto → conferma, con il numero della riga", [["doppione_pagamento:conferma"], true],
    [sigle(mrg), mrg[0]?.testo.includes("riga 3")]);

  gruppo("BULK · T4 · STESSO CF, ALTRE FATTURE = AVVISO");
  const va = D.trovaDoppioni(riga(), fonti({ emesse: [
    fattura({ id: "2026-0003", numero: 3, data: "2026-09-01", totale: 500 }),
    fattura({ id: "2026-0005", numero: 5, data: "2026-10-12", totale: 1234.5 }),
    fattura({ id: "2025-0040", numero: 40, anno: 2025, data: "2025-12-30", totale: 80 }),
  ] }));
  c("tre fatture dello stesso CF, importi e date diversi → un avviso", ["stesso_cf_altre_fatture:avviso"], sigle(va));
  c("dice quante e l'ultima (per anno e numero), con data e importo", [true, true, true, true],
    [va[0]?.testo.includes("3 fatture"), va[0]?.testo.includes("2026/0005"), va[0]?.testo.includes("12/10/2026"), va[0]?.testo.includes("1234,50")]);
  c("una sola → «1 fattura»", true, D.trovaDoppioni(riga(), fonti({ emesse: [fattura({ totale: 500 })] }))[0]?.testo.includes("1 fattura"));
  c("CF diverso → niente avviso", [], D.trovaDoppioni(riga(), fonti({ emesse: [fattura({ totale: 500, cliente: { ...fattura().cliente, codiceFiscale: CF_ALTRO, nome: "Marco", cognome: "Bianchi" } })] })));
  const doppioE = D.trovaDoppioni(riga(), fonti({ emesse: [uguale] }));
  c("se è proprio un doppione non si aggiunge anche l'avviso «altre fatture»", ["doppione_pagamento:conferma"], sigle(doppioE));
  const doppioPiu = D.trovaDoppioni(riga(), fonti({ emesse: [uguale, fattura({ id: "2026-0003", numero: 3, data: "2026-09-01", totale: 500 })] }));
  c("doppione + un'altra fattura dello stesso CF → il doppione e l'avviso (che conta solo l'altra)", [["doppione_pagamento:conferma", "stesso_cf_altre_fatture:avviso"], true],
    [sigle(doppioPiu), doppioPiu[1]?.testo.includes("1 fattura")]);

  gruppo("BULK · T4 · DUE RIGHE DEL LOTTO · STESSO CF E STESSA DATA, IMPORTI DIVERSI = AVVISO");
  const alt = riga({ idRiga: "0006-0007-0008", numero: 3, improntaPagamento: "imp-2", campi: campi({ importo: 250 }) });
  c("avviso, con la riga", [["stesso_cf_stessa_data:avviso"], true],
    [sigle(D.trovaDoppioni(riga(), fonti({ altreRighe: [alt] }))), D.trovaDoppioni(riga(), fonti({ altreRighe: [alt] }))[0]?.testo.includes("riga 3")]);
  c("data diversa → niente", [], D.trovaDoppioni(riga(), fonti({ altreRighe: [{ ...alt, campi: campi({ importo: 250, data: "2026-11-09" }) }] })));

  gruppo("BULK · T4 · OMONIMI E CF CHE NON TORNA = CONFERMA");
  const omonimo = riga({ idRiga: "0006-0007-0008", numero: 3, improntaPagamento: "imp-3", campi: campi({ codiceFiscale: CF_ALTRO, importo: 40, data: "2026-09-02" }) });
  const mo = D.trovaDoppioni(riga(), fonti({ altreRighe: [omonimo] }));
  c("stesso nome e cognome, CF diverso → conferma, con la riga", [["omonimo_cf_diverso:conferma"], true],
    [sigle(mo), mo[0]?.testo.includes("riga 3")]);
  c("nome e cognome in maiuscolo e con accenti diversi → è lo stesso nome", ["omonimo_cf_diverso:conferma"],
    sigle(D.trovaDoppioni(riga({ campi: campi({ nome: "LUCÌA" }) }), fonti({ altreRighe: [omonimo] }))));
  c("CF diverso e nome diverso → due persone, niente", [], D.trovaDoppioni(riga(), fonti({ altreRighe: [{ ...omonimo, campi: { ...omonimo.campi, nome: "Marco", cognome: "Bianchi" } }] })));
  c("CF non valido (vuoto) su una delle due → niente da confrontare", [], D.trovaDoppioni(riga({ campi: campi({ codiceFiscale: "" }) }), fonti({ altreRighe: [omonimo] })));
  const mn = D.trovaDoppioni(riga(), fonti({ altreRighe: [{ ...omonimo, campi: { ...omonimo.campi, codiceFiscale: CF_PROVA, nome: "Lucio", cognome: "Verdini" } }] }));
  c("stesso CF, nome e cognome diversi (CF letto male?) → conferma", ["cf_nome_diverso:conferma"], sigle(mn).filter((s) => s.startsWith("cf_nome")));

  gruppo("BULK · T4 · BOZZA APERTA DELLA SCHEDA = AVVISO CON GLI IMPORTI");
  const bz = bozza({ totale: 2350, leadId: "scheda-77" });
  const mz = D.trovaDoppioni(riga({ schedaId: "scheda-77", campi: campi({ codiceFiscale: CF_ALTRO }) }), fonti({ bozze: [bz] }));
  c("bozza della stessa scheda → avviso con l'importo", [["bozza_aperta:avviso"], true],
    [sigle(mz), mz[0]?.testo.includes("2350,00")]);
  c("bozza con lo stesso CF (anche senza scheda) → avviso",
    ["bozza_aperta:avviso"],
    sigle(D.trovaDoppioni(riga(), fonti({ bozze: [bozza({ totale: 10, cliente: { ...fattura().cliente, codiceFiscale: CF_PROVA } })] }))));
  c("bozza di un'altra scheda e di un altro CF → niente", [],
    D.trovaDoppioni(riga({ schedaId: "scheda-1" }), fonti({ bozze: [bz] })));

  gruppo("BULK · T4 · ORDINE DEI MOTIVI E ASSENZA DI EFFETTI");
  const tutti = D.trovaDoppioni(riga({ riferimento: "CRO1234567" }), fonti({
    emesse: [fattura({ riferimentoPagamento: "CRO1234567" })],
    altreRighe: [alt, omonimo],
  }));
  const gr = tutti.map((m) => m.gravita);
  c("prima i blocca, poi i conferma, poi gli avvisi", [...gr].sort((a, b) => ({ blocca: 0, conferma: 1, avviso: 2 })[a] - ({ blocca: 0, conferma: 1, avviso: 2 })[b]), gr);
  c("stesso input, stesso risultato (determinismo)", tutti, D.trovaDoppioni(riga({ riferimento: "CRO1234567" }), fonti({
    emesse: [fattura({ riferimentoPagamento: "CRO1234567" })],
    altreRighe: [alt, omonimo],
  })));
  const fr = congela({ riga: riga({ riferimento: "CRO1234567" }), f: fonti({ emesse: [fattura({ riferimentoPagamento: "CRO1234567", origineBulk: { lotto: "l", riga: "r", impronte: ["x"] } })], bozze: [bozza()], altreRighe: [alt, omonimo], altriLotti: ["a"] }) });
  let lancio = "";
  try { D.trovaDoppioni(fr.riga, fr.f); D.impronteGiaViste(fr.f); } catch (e) { lancio = String(e); }
  c("input congelato: nessuna mutazione", "", lancio);

  gruppo("BULK · T4 · ABBINAMENTO ALLA SCHEDA · CF, TELEFONO, NOME");
  const sch = (id, nome, cognome, cf = "", telefono = "") => ({ id, nome, cognome, codiceFiscale: cf, telefono });
  const schede = [sch("s-nome", "Lucia", "Verdi"), sch("s-cf", "Luciana", "Verdi", CF_PROVA), sch("s-tel", "L.", "Verdi", "", "331234567"), sch("s-altra", "Marco", "Bianchi", CF_ALTRO, "339876543")];
  const tel = "331234567";
  const a1 = D.abbinaScheda(campi(), tel, schede);
  c("1. CF uguale → quella scheda, nessun motivo (anche se nome e telefono dicono altro)", ["s-cf", []], [a1.scheda?.id, a1.motivi]);
  c("CF in minuscolo e con spazi nel letto → lo stesso", "s-cf", D.abbinaScheda(campi({ codiceFiscale: ` ${CF_PROVA.toLowerCase()} ` }), "", schede).scheda?.id);
  const a2 = D.abbinaScheda(campi({ codiceFiscale: "" }), tel, schede);
  c("2. telefono + cognome → quella scheda, nessun motivo", ["s-tel", []], [a2.scheda?.id, a2.motivi]);
  c("telefono con prefisso e spazi: contano le ultime 9 cifre", "s-tel", D.abbinaScheda(campi({ codiceFiscale: "" }), "+39 33 1234 567", schede).scheda?.id);
  const a2b = D.abbinaScheda(campi({ codiceFiscale: "", nome: "Mario", cognome: "Neri" }), tel, schede);
  c("telefono uguale ma cognome diverso → non basta", [null, []], [a2b.scheda, a2b.motivi]);
  c("telefono troppo corto (meno di 9 cifre) → non si usa", "s-nome", D.abbinaScheda(campi({ codiceFiscale: "" }), "1234567", schede).scheda?.id);
  const a3 = D.abbinaScheda(campi({ codiceFiscale: "" }), "", schede.filter((s) => s.id !== "s-tel" && s.id !== "s-cf"));
  c("3. solo nome e cognome (una scheda) → collegata ma da confermare", ["s-nome", ["scheda_solo_nome:conferma"]], [a3.scheda?.id, sigle(a3.motivi)]);
  c("il motivo del solo nome dice «solo per il nome»", true, a3.motivi[0]?.testo.includes("solo per il nome"));
  c("nome e cognome con accenti, maiuscole, ordine invertito → lo stesso nome", "s-nome",
    D.abbinaScheda(campi({ codiceFiscale: "", nome: "LUCÌA", cognome: "verdi" }), "", [sch("s-nome", "Verdi", "Lucia")]).scheda?.id);
  c("4. omonimi (due schede con lo stesso nome) → nessuna scheda, nessun motivo", [null, []],
    ((r) => [r.scheda, r.motivi])(D.abbinaScheda(campi({ codiceFiscale: "" }), "", [sch("a", "Lucia", "Verdi"), sch("b", "Lucia", "Verdi")])));
  c("nessuna corrispondenza → senza scheda", [null, []], ((r) => [r.scheda, r.motivi])(D.abbinaScheda(campi({ codiceFiscale: CF_TERZO, nome: "Anna", cognome: "Gialli" }), "", schede)));
  c("nessuna scheda affatto → senza scheda", [null, []], ((r) => [r.scheda, r.motivi])(D.abbinaScheda(campi(), tel, [])));
  c("nome e cognome vuoti, niente CF né telefono → senza scheda", [null, []], ((r) => [r.scheda, r.motivi])(D.abbinaScheda(campi({ codiceFiscale: "", nome: "", cognome: "" }), "", [sch("v", "", "")])));
  c("due schede con lo stesso CF → nessuna per CF (ambiguo), si prosegue con gli altri criteri", "s-nome",
    D.abbinaScheda(campi(), "", [sch("x1", "Q", "W", CF_PROVA), sch("x2", "E", "R", CF_PROVA), sch("s-nome", "Lucia", "Verdi")]).scheda?.id + "");
  c("CF letto vuoto non si abbina alle schede senza CF", [null],
    [D.abbinaScheda(campi({ codiceFiscale: "", nome: "Anna", cognome: "Gialli" }), "", [sch("v", "Piero", "Rossi", "")]).scheda]);

  gruppo("BULK · T4 · ABBINAMENTO · LA SCHEDA CON UN CF DIVERSO = CONFERMA");
  const cfDiv = D.abbinaScheda(campi({ codiceFiscale: CF_PROVA }), "331234567", [sch("t", "L.", "Verdi", CF_ALTRO, "331234567")]);
  c("per telefono + cognome, ma il CF della scheda è diverso → collegata, da confermare", ["t", ["scheda_cf_diverso:conferma"]], [cfDiv.scheda?.id, sigle(cfDiv.motivi)]);
  c("il motivo guarda il campo CF", "codiceFiscale", cfDiv.motivi[0]?.campo);
  const cfDiv3 = D.abbinaScheda(campi({ codiceFiscale: CF_PROVA }), "", [sch("n", "Lucia", "Verdi", CF_ALTRO)]);
  c("per solo nome, e CF diverso → due motivi, in questo ordine", ["n", ["scheda_solo_nome:conferma", "scheda_cf_diverso:conferma"]], [cfDiv3.scheda?.id, sigle(cfDiv3.motivi)]);
  c("la scheda senza CF non genera il motivo del CF diverso", ["scheda_solo_nome:conferma"],
    sigle(D.abbinaScheda(campi({ codiceFiscale: CF_PROVA }), "", [sch("n", "Lucia", "Verdi", "")]).motivi));
  c("CF letto vuoto: nessun confronto, nessun motivo del CF", ["scheda_solo_nome:conferma"],
    sigle(D.abbinaScheda(campi({ codiceFiscale: "" }), "", [sch("n", "Lucia", "Verdi", CF_ALTRO)]).motivi));

  gruppo("BULK · T4 · ABBINAMENTO · ORDINE DELLE REGOLE E ASSENZA DI EFFETTI");
  const tutte = [sch("per-nome", "Lucia", "Verdi"), sch("per-tel", "L", "Verdi", "", tel), sch("per-cf", "Z", "Z", CF_PROVA)];
  c("con tutte e tre le prove vince il CF", "per-cf", D.abbinaScheda(campi(), tel, tutte).scheda?.id);
  c("senza CF vince il telefono sul nome", "per-tel", D.abbinaScheda(campi({ codiceFiscale: "" }), tel, tutte).scheda?.id);
  c("senza CF né telefono resta il nome", "per-nome", D.abbinaScheda(campi({ codiceFiscale: "" }), "", tutte).scheda?.id);
  c("l'ordine delle schede nell'elenco non cambia il risultato", "per-cf", D.abbinaScheda(campi(), tel, [...tutte].reverse()).scheda?.id);
  const cg = congela({ campi: campi(), schede: tutte });
  let l2 = "";
  try { D.abbinaScheda(cg.campi, tel, cg.schede); } catch (e) { l2 = String(e); }
  c("input congelato: nessuna mutazione", "", l2);
  c("la scheda restituita è quella dell'elenco (non una copia con altri campi)", true, D.abbinaScheda(campi(), tel, tutte).scheda === tutte[2]);
}
