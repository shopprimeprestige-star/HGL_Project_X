/** ── FATTURE BULK · T3 · REGOLE DI RIGA ────────────────────────────────────
 *  `esaminaRiga`, `statoDi`, `oggiItaliano`, `proponiData` (PIANO §5 T3, D7, D15, D16).
 *  Una prova per codice, positiva e negativa. Si parte da una riga PERFETTA (nessun
 *  motivo) e si cambia una cosa alla volta: quel che compare è solo quella.
 *  ⚠️ Dati inventati: «Mario Rossi» e un codice fiscale con controllo calcolato
 *  (prove/fatture-bulk/dati.mjs), nessuna persona vera. */
import { CF_PROVA, CF_STORTO, cfConControllo } from "./dati.mjs";

const OGGI = "2026-11-12";

const campiBase = () => ({
  nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA, indirizzo: "Via Prova 1", cap: "00100", comune: "Roma",
  provincia: "RM", importo: 120, data: "2026-11-10", modo: "pos", riferimento: "ABC123456",
});
const ctxBase = () => ({
  oggi: OGGI,
  gruppo: { ricomposta: false, ordineDiverso: false, incompleta: false, mancano: [] },
  indirizzo: { tipo: "indirizzo", indirizzo: "Via Prova 1", cap: "00100", comune: "Roma", provincia: "RM", telefono: "123456789",
    nome: "Mario", cognome: "Rossi", indirizzoDiSpedizione: false, incerti: [] },
  tessera: { tipo: "tessera", nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA, cfLetto: CF_PROVA, incerti: [] },
  pagamento: { tipo: "pagamento", importo: 120, importoAltro: null, valuta: "EUR", esito: "completato", data: "2026-11-10", meseGiorno: "",
    dataTesto: "10/11/2026", annoVisibile: true, formatoAmbiguo: false, modo: "pos", modoIncerto: false, riferimento: "ABC123456",
    paganteCognome: "Rossi", incerti: [] },
  dataDaRiserva: false,
});

/** Applica le modifiche (sopra la base) e dà i motivi come «codice:gravità», in ordine. */
function esame(R, modCampi = {}, modCtx = {}) {
  const ctx = ctxBase();
  for (const [k, v] of Object.entries(modCtx)) {
    if (v && typeof v === "object" && !Array.isArray(v) && ctx[k] && typeof ctx[k] === "object") ctx[k] = { ...ctx[k], ...v };
    else ctx[k] = v;
  }
  return R.esaminaRiga({ ...campiBase(), ...modCampi }, ctx);
}
const codici = (motivi) => motivi.map((m) => `${m.codice}:${m.gravita}`);

export async function prove(mod, { c, gruppo }) {
  const R = mod["fatture/bulk/regole-riga"];
  const e = (modCampi, modCtx) => codici(esame(R, modCampi, modCtx));
  const ha = (lista, codice, gravita) => lista.includes(`${codice}:${gravita}`);

  gruppo("BULK · T3 · LA RIGA PERFETTA");
  c("nessun motivo: la riga è pronta", [], e());
  c("… e lo stato dice «pronto», emettibile solo se confermata", [{ stato: "pronto", emettibile: false }, { stato: "pronto", emettibile: true }],
    [R.statoDi([], [], false), R.statoDi([], [], true)]);

  gruppo("BULK · T3 · OBBLIGATORI MANCANTI (blocca)");
  for (const [campo, codice] of [["nome", "nome_mancante"], ["cognome", "cognome_mancante"], ["indirizzo", "indirizzo_mancante"],
    ["cap", "cap_mancante"], ["comune", "comune_mancante"], ["provincia", "provincia_mancante"], ["data", "data_mancante"],
    ["codiceFiscale", "cf_mancante"], ["modo", "modo_mancante"]]) {
    const ctxSenza = campo === "codiceFiscale" ? { tessera: { cfLetto: "", codiceFiscale: "" } } : {};
    c(`${campo} vuoto → ${codice} (blocca)`, [`${codice}:blocca`], e({ [campo]: "" }, ctxSenza).filter((x) => x.startsWith(codice)));
    c(`${campo} fatto solo di spazi → vuoto`, true, ha(e({ [campo]: "   " }, ctxSenza), codice, "blocca"));
  }
  c("importo mancante (null) → importo_mancante", ["importo_mancante:blocca"], e({ importo: null }));
  c("importo NaN o infinito (lettura rotta) → importo_mancante, mai una cifra", [["importo_mancante:blocca"], ["importo_mancante:blocca"]], [e({ importo: NaN }), e({ importo: Infinity })]);
  c("ogni motivo obbligatorio nomina il campo da correggere", ["nome", "cognome", "indirizzo", "cap", "comune", "provincia", "data", "importo"],
    ["nome", "cognome", "indirizzo", "cap", "comune", "provincia", "data", "importo"].map((k) =>
      esame(R, { [k]: k === "importo" ? null : "" }).find((m) => m.codice.endsWith("_mancante"))?.campo));
  c("una riga con tutto mancante non perde nessun obbligatorio", 10,
    esame(R, { nome: "", cognome: "", codiceFiscale: "", indirizzo: "", cap: "", comune: "", provincia: "", importo: null, data: "", modo: "" },
      { tessera: { cfLetto: "", codiceFiscale: "", nome: "", cognome: "" }, indirizzo: { cognome: "" }, pagamento: { modo: "", paganteCognome: "" } })
      .filter((m) => m.gravita === "blocca").length);

  gruppo("BULK · T3 · CODICE FISCALE");
  c("CF con il controllo sbagliato → cf_non_valido (blocca)", ["cf_non_valido:blocca"], e({ codiceFiscale: CF_STORTO }));
  c("CF vuoto ma l'AI aveva letto qualcosa di storto → cf_non_valido, non «mancante»", ["cf_non_valido:blocca"],
    e({ codiceFiscale: "" }, { tessera: { codiceFiscale: "", cfLetto: CF_STORTO } }));
  c("CF scritto in minuscolo e con spazi, ma giusto → passa", [], e({ codiceFiscale: ` ${CF_PROVA.toLowerCase()} ` }));
  c("11 cifre (una partita IVA) → cf_partita_iva, con la frase «16»", [true, true],
    (() => { const m = esame(R, { codiceFiscale: "12345678901" }); return [codici(m).join() === "cf_partita_iva:blocca", /16/.test(m[0].testo)]; })());
  c("11 cifre solo nella lettura (campo vuoto) → cf_partita_iva", ["cf_partita_iva:blocca"],
    e({ codiceFiscale: "" }, { tessera: { codiceFiscale: "", cfLetto: "12345678901" } }));
  c("un CF omocodico valido non è scartato qui", [], e({ codiceFiscale: cfConControllo("RSSMRA80A01H50L") }));
  c("CF valido ma di altro nome → cf_non_combacia (conferma)", ["cf_non_combacia:conferma"], e({ nome: "Luigi" }));
  c("CF valido, nome troppo corto per dirlo → cf_non_verificabile (avviso)", ["cf_non_verificabile:avviso"], e({ nome: "M" }));
  c("CF non valido: il confronto con il nome non parte (un solo motivo)", ["cf_non_valido:blocca"], e({ codiceFiscale: CF_STORTO, nome: "Luigi" }));

  gruppo("BULK · T3 · INDIRIZZO");
  c("CAP di 4 cifre → indirizzo_estero (blocca)", ["indirizzo_estero:blocca"], e({ cap: "1234" }));
  c("CAP con lettere (UK) → indirizzo_estero", ["indirizzo_estero:blocca"], e({ cap: "SW1A 1AA" }));
  c("CAP di 6 cifre → indirizzo_estero", ["indirizzo_estero:blocca"], e({ cap: "123456" }));
  c("CAP di 5 cifre → passa (anche 00010 con gli zeri)", [], e({ cap: "00010" }));
  c("un indirizzo estero non diventa mai «IT»: resta bloccato anche con tutto il resto a posto", true, ha(e({ cap: "1011 AB", comune: "Amsterdam", provincia: "" }), "indirizzo_estero", "blocca"));
  c("provincia in minuscolo → provincia_non_valida", ["provincia_non_valida:blocca"], e({ provincia: "rm" }));
  c("provincia di 3 lettere → provincia_non_valida", ["provincia_non_valida:blocca"], e({ provincia: "ROM" }));
  c("provincia di 2 lettere → passa", [], e({ provincia: "MI" }));
  c("indirizzo di spedizione → conferma (residenza?)", ["indirizzo_di_spedizione:conferma"], e({}, { indirizzo: { indirizzoDiSpedizione: true } }));

  gruppo("BULK · T3 · IMPORTO");
  c("importo 0 → importo_non_valido", ["importo_non_valido:blocca"], e({ importo: 0 }));
  c("importo negativo → importo_non_valido", ["importo_non_valido:blocca"], e({ importo: -10 }));
  c("più di 2 decimali → importo_non_valido", ["importo_non_valido:blocca"], e({ importo: 10.005 }));
  c("1.235,50 (centesimi) passa; 0,1+0,2 (errore di virgola mobile) non è «3 decimali»", [[], []],
    [e({ importo: 1235.5 }), e({ importo: 0.1 + 0.2 }).filter((x) => x.startsWith("importo_non_valido"))]);
  c("importo oltre 10.000 → importo_alto (conferma); esattamente 10.000 no", [["importo_alto:conferma"], []], [e({ importo: 10_000.01 }), e({ importo: 10_000 })]);
  c("importo sotto 5 → importo_basso (avviso); esattamente 5 no", [["importo_basso:avviso"], []], [e({ importo: 4.99 }), e({ importo: 5 })]);
  c("due cifre nello screenshot → due_importi (conferma)", ["due_importi:conferma"], e({}, { pagamento: { importoAltro: 117.5 } }));
  c("… ma se la persona ha scelto l'altra cifra, il dubbio è risolto", [], e({ importo: 117.5 }, { pagamento: { importoAltro: 117.5 } }));
  c("la seconda cifra uguale alla prima non è un dubbio", [], e({}, { pagamento: { importoAltro: 120 } }));
  c("valuta diversa da EUR → valuta_non_euro (blocca)", ["valuta_non_euro:blocca"], e({}, { pagamento: { valuta: "USD" } }));
  c("valuta «€» o vuota (non letta) → passa", [[], []], [e({}, { pagamento: { valuta: "€" } }), e({}, { pagamento: { valuta: "" } })]);
  c("pagamento non completato (annullato, in attesa, rimborsato) → blocca", ["pagamento_non_completato:blocca"], e({}, { pagamento: { esito: "non_completato" } }));

  gruppo("BULK · T3 · COME HA PAGATO");
  c("PayPal → modo_non_ammesso (blocca), mai un bonifico di ripiego", [["modo_non_ammesso:blocca"], true],
    (() => { const m = esame(R, { modo: "" }, { pagamento: { modo: "paypal" } }); return [codici(m), /PayPal/.test(m[0].testo)]; })());
  c("Satispay → modo_non_ammesso", ["modo_non_ammesso:blocca"], e({ modo: "" }, { pagamento: { modo: "satispay" } }));
  c("«altro» → modo_non_ammesso", ["modo_non_ammesso:blocca"], e({ modo: "" }, { pagamento: { modo: "altro" } }));
  c("modo non letto → modo_mancante (blocca)", ["modo_mancante:blocca"], e({ modo: "" }, { pagamento: { modo: "" } }));
  c("PayPal ma la persona ha scelto il modo a mano → passa (decide lei)", [], e({ modo: "carta" }, { pagamento: { modo: "paypal" } }));
  c("POS/carta incerto → modo_incerto (conferma)", ["modo_incerto:conferma"], e({}, { pagamento: { modoIncerto: true } }));
  c("… se la persona ha cambiato il modo, l'incertezza non conta più", [], e({ modo: "carta" }, { pagamento: { modoIncerto: true } }));
  c("bonifico e contanti passano", [[], []], [e({ modo: "bonifico" }), e({ modo: "contanti" })]);

  gruppo("BULK · T3 · DATA");
  c("29/02/2028 esiste", [], e({ data: "2028-02-29" }, { oggi: "2028-03-01" }));
  c("29/02/2027 non esiste → data_non_valida (blocca)", ["data_non_valida:blocca"], e({ data: "2027-02-29" }));
  c("31/04 non esiste", ["data_non_valida:blocca"], e({ data: "2026-04-31" }));
  c("testo che non è una data → data_non_valida", ["data_non_valida:blocca"], e({ data: "10/11/2026" }));
  c("data nel futuro → data_futura (blocca)", ["data_futura:blocca"], e({ data: "2026-11-13" }));
  c("la data di oggi non è futura", [], e({ data: OGGI }));
  c("pagamento di oggi visto alle 00:30 italiane (23:30 UTC di ieri) non è futuro: oggi è quello italiano",
    [[], "2026-11-13"], (() => { const oggi = R.oggiItaliano(new Date("2026-11-12T23:30:00Z")); return [e({ data: oggi }, { oggi }), oggi]; })());
  c("oggiItaliano: ora legale (22:30 UTC di luglio = 00:30 del giorno dopo) e ora solare (22:30 UTC di novembre = 23:30 dello stesso giorno)",
    ["2026-07-13", "2026-11-12"], [R.oggiItaliano(new Date("2026-07-12T22:30:00Z")), R.oggiItaliano(new Date("2026-11-12T22:30:00Z"))]);
  c("12 giorni dal pagamento: ancora in tempo", [], e({ data: "2026-10-31" }));
  const treDici = esame(R, { data: "2026-10-30" });
  c("13 giorni → oltre_12_giorni (conferma), con l'ultimo giorno utile", [["oltre_12_giorni:conferma"], true],
    [codici(treDici), /11\/11\/2026/.test(treDici[0].testo)]);
  c("anno diverso dal corrente → anno_diverso (conferma) [e oltre i 12 giorni]", ["anno_diverso:conferma", "oltre_12_giorni:conferma"], e({ data: "2025-12-20" }));
  c("a cavallo d'anno: 31/12 vista l'1/1 non è anno diverso se l'anno è lo stesso", [], e({ data: "2026-01-01" }, { oggi: "2026-01-05" }));
  c("anno mancante: la data proposta è il più recente non futuro → anno_proposto (conferma)", ["anno_proposto:conferma"],
    e({ data: "2026-11-05" }, { pagamento: { data: "", meseGiorno: "11-05", annoVisibile: false } }));
  c("… se la persona la cambia, non è più «proposta»", [], e({ data: "2026-11-06" }, { pagamento: { data: "", meseGiorno: "11-05", annoVisibile: false } }));
  c("proponiData: il più recente che non sia nel futuro", ["2026-11-05", "2025-12-20", "2026-11-12", "2024-02-29", "", "", ""],
    [R.proponiData("11-05", OGGI), R.proponiData("12-20", OGGI), R.proponiData("11-12", OGGI), R.proponiData("02-29", OGGI), R.proponiData("02-30", OGGI), R.proponiData("", OGGI), R.proponiData("13-01", OGGI)]);
  c("formato ambiguo (03/04: giorno/mese o mese/giorno?) → data_ambigua (conferma)", ["data_ambigua:conferma"], e({}, { pagamento: { formatoAmbiguo: true } }));
  c("… ma se la persona ha corretto la data, no", [], e({ data: "2026-11-11" }, { pagamento: { formatoAmbiguo: true } }));
  c("data presa dal campo di riserva → data_di_riserva (conferma), mai pronta da sola", [["data_di_riserva:conferma"], "da_controllare"],
    (() => { const m = esame(R, {}, { dataDaRiserva: true }); return [codici(m), R.statoDi(m, [], true).stato]; })());
  c("data di riserva ma senza data: prima manca la data (blocca)", ["data_mancante:blocca"], e({ data: "" }, { dataDaRiserva: true }));
  c("la data anteriore all'ultima emessa NON è qui (è esitoOrdineDate, T7)", true,
    !codici(esame(R, { data: "2026-11-01" }, { oggi: "2026-11-02" })).some((x) => x.startsWith("data_anteriore")));

  gruppo("BULK · T3 · LE PERSONE DEI TRE SCREENSHOT");
  c("cognome dell'indirizzo diverso dalla tessera → persone_diverse (blocca)", ["persone_diverse:blocca"], e({}, { indirizzo: { cognome: "Bianchi" } }));
  c("stesso cognome con maiuscole, accenti e apostrofi diversi → passa", [], e({ cognome: "D'Angelo" }, { indirizzo: { cognome: "DANGELO" }, tessera: { cognome: "D'Angelo" }, pagamento: { paganteCognome: "d’angelo" } }).filter((x) => !x.startsWith("cf_")));
  c("«Rossi» e «Rossi Bianchi» sono compatibili; «Rossi» e «Rossini» no", [[], ["persone_diverse:blocca"]],
    [e({}, { indirizzo: { cognome: "Rossi Bianchi" } }), e({}, { indirizzo: { cognome: "Rossini" } })]);
  c("cognome dell'indirizzo non letto → niente da confrontare", [], e({}, { indirizzo: { cognome: "" } }));
  c("pagante con un altro cognome → pagante_diverso (conferma)", ["pagante_diverso:conferma"], e({}, { pagamento: { paganteCognome: "Verdi" } }));
  c("pagante non letto → nessun motivo (comparirebbe quasi sempre)", [], e({}, { pagamento: { paganteCognome: "" } }));

  gruppo("BULK · T3 · CARATTERI E LUNGHEZZE (R14)");
  c("«D'Angelo», «Niccolò», «Sant'Elia» passano", [[], [], []],
    [e({ cognome: "D'Angelo" }, { indirizzo: { cognome: "D'Angelo" }, tessera: { cognome: "D'Angelo" } }).filter((x) => x.startsWith("caratteri")),
      e({ nome: "Niccolò" }).filter((x) => x.startsWith("caratteri")),
      e({ comune: "Sant'Elia" }).filter((x) => x.startsWith("caratteri"))]);
  c("«Łukasz» → caratteri_nome (conferma): il file toglierebbe la lettera", ["caratteri_nome:conferma"], e({ nome: "Łukasz" }).filter((x) => x.startsWith("caratteri")));
  c("il motivo non riporta il nome della persona", false, /Łukasz|ukasz/.test(esame(R, { nome: "Łukasz" }).map((m) => m.testo).join(" ")));
  c("61 caratteri nell'indirizzo → troppo_lungo_indirizzo (conferma); 60 passa", [["troppo_lungo_indirizzo:conferma"], []],
    [e({ indirizzo: "Via ".padEnd(61, "x") }), e({ indirizzo: "Via ".padEnd(60, "x") })]);

  gruppo("BULK · T3 · IL GRUPPO");
  c("ricomposta → conferma", ["ricomposta:conferma"], e({}, { gruppo: { ricomposta: true } }));
  c("ordine diverso → solo un avviso: la riga resta pronta", [["ordine_diverso:avviso"], "pronto"],
    (() => { const m = esame(R, {}, { gruppo: { ordineDiverso: true } }); return [codici(m), R.statoDi(m, [], false).stato]; })());
  const inc = esame(R, {}, { gruppo: { incompleta: true, mancano: ["pagamento"] } });
  c("gruppo incompleto → blocca e strutturale, e la riga è in «errore»", [["gruppo_incompleto:blocca"], true, "errore", false],
    [codici(inc), inc[0].strutturale, R.statoDi(inc, [], true).stato, R.statoDi(inc, ["gruppo_incompleto"], true).emettibile]);
  c("il motivo dice cosa manca", true, /pagamento/.test(inc[0].testo));
  c("… anche con due tipi mancanti li nomina entrambi", [true, true],
    (() => { const t = esame(R, {}, { gruppo: { incompleta: true, mancano: ["indirizzo", "tessera"] } })[0].testo; return [/indirizzo/.test(t), /tessera/.test(t)]; })());

  gruppo("BULK · T3 · CAMPI INCERTI (D7)");
  c("campo obbligatorio incerto e non corretto → incerto_<campo> (conferma)", ["incerto_cap:conferma"], e({}, { indirizzo: { incerti: ["cap"] } }));
  c("… tre campi incerti = tre motivi distinti (si confermano uno per uno)", ["incerto_nome:conferma", "incerto_cognome:conferma", "incerto_importo:conferma"].sort(),
    e({}, { tessera: { incerti: ["nome", "cognome"] }, pagamento: { incerti: ["importo"] } }).sort());
  c("… se la persona ha corretto il campo, l'incertezza è risolta", [], e({ cap: "00118" }, { indirizzo: { incerti: ["cap"] } }));
  c("un campo incerto che non è obbligatorio (riferimento) non dà motivi", [], e({}, { pagamento: { incerti: ["riferimento", "valuta"] } }));
  c("incerto e vuoto: resta solo il «mancante»", ["cap_mancante:blocca"], e({ cap: "" }, { indirizzo: { incerti: ["cap"], cap: "" } }));
  c("CF incerto ma giusto → incerto_codiceFiscale (conferma)", ["incerto_codiceFiscale:conferma"], e({}, { tessera: { incerti: ["codiceFiscale"] } }));

  gruppo("BULK · T3 · STATO E CONFERMA");
  const conf = esame(R, {}, { gruppo: { ricomposta: true } });
  c("un «conferma» non confermato → da controllare e non emettibile", [{ stato: "da_controllare", emettibile: false }], [R.statoDi(conf, [], true)]);
  c("confermato per codice (e riga confermata) → emettibile", [{ stato: "pronto", emettibile: true }], [R.statoDi(conf, ["ricomposta"], true)]);
  c("confermato ma la riga non è confermata → pronto, non emettibile", { stato: "pronto", emettibile: false }, R.statoDi(conf, ["ricomposta"], false));
  c("la conferma di un altro codice non libera questo", { stato: "da_controllare", emettibile: false }, R.statoDi(conf, ["data_di_riserva"], true));
  const bl = esame(R, { cap: "" });
  c("un «blocca» non si libera mai, nemmeno con il suo codice nelle conferme", [{ stato: "da_controllare", emettibile: false }],
    [R.statoDi(bl, ["cap_mancante"], true)]);
  const misti = esame(R, { cap: "" }, { gruppo: { ricomposta: true } });
  c("blocca + conferma: serve prima correggere; poi confermare", [false, false],
    [R.statoDi(misti, ["ricomposta"], true).emettibile, R.statoDi(misti, [], true).emettibile]);
  c("gli avvisi non fermano niente", { stato: "pronto", emettibile: true }, R.statoDi(esame(R, { importo: 4 }), [], true));
  c("data di riserva: confermata → pronta; altrimenti no", ["da_controllare", "pronto"],
    (() => { const m = esame(R, {}, { dataDaRiserva: true }); return [R.statoDi(m, [], true).stato, R.statoDi(m, ["data_di_riserva"], true).stato]; })());

  gruppo("BULK · T3 · TESTI E INPUT");
  const tutti = esame(R, { nome: "", cap: "12", provincia: "x", importo: 3, data: "2025-01-01", modo: "", codiceFiscale: "12345678901" },
    { gruppo: { ricomposta: true, ordineDiverso: true }, pagamento: { formatoAmbiguo: true, importoAltro: 2, valuta: "USD", esito: "non_completato", modo: "paypal" }, indirizzo: { indirizzoDiSpedizione: true, cognome: "Verdi" } });
  c("ogni motivo ha codice, gravità e una frase che finisce con il punto", true,
    tutti.length > 10 && tutti.every((m) => m.codice && ["blocca", "conferma", "avviso"].includes(m.gravita) && m.testo.length > 20 && /[.?]$/.test(m.testo)));
  c("i codici sono tutti diversi (la conferma è per codice)", tutti.length, new Set(tutti.map((m) => m.codice)).size);
  c("nessun testo contiene dati di persona (nome, CF, indirizzo)", false,
    tutti.some((m) => /Rossi|Mario|Via Prova|Roma/.test(m.testo)));
  const campi = Object.freeze({ ...campiBase() });
  c("non muta l'input (congelato)", true, (() => { try { R.esaminaRiga(campi, Object.freeze({ ...ctxBase() })); return true; } catch { return false; } })());
  c("stesso input, stesso output", codici(esame(R, { cap: "" })), codici(esame(R, { cap: "" })));
}
