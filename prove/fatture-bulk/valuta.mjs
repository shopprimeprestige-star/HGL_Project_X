/** ── FATTURE BULK · T10 · L'ASSEMBLATORE (valutaRiga / valutaLotto) ────────
 *  Compone T2 (raggruppa), T3 (regole di riga), T4 (doppioni e schede), T5 (importo → fattura,
 *  regole di lotto), T7 (ordine delle date) e `problemiXml`. Le prove sono contro la SPEC:
 *  ogni riga è in UNO stato fra pronto / da controllare / errore, e «pronto» c'è solo se
 *  `problemiXml` non ha bloccanti su quella fattura.
 *  ⚠️ Dati inventati: nomi di fantasia, CF col controllo calcolato (dati.mjs), P.IVA con cifra
 *   di controllo calcolata qui. Nessun dato vero. */
import { CF_PROVA, CF_STORTO, LOTTO_PROVA, cfConControllo } from "./dati.mjs";

const OGGI = "2026-11-12";

function pivaConControllo(dieci) {
  let s = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(dieci[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    s += d;
  }
  return dieci + String((10 - (s % 10)) % 10);
}
const PIVA = pivaConControllo("1234567001");
const AZIENDA = {
  denominazione: "ESEMPIO CAPELLI S.R.L.",
  partitaIva: PIVA,
  codiceFiscale: PIVA,
  regimeFiscale: "RF01",
  indirizzo: "Via dei Ciliegi",
  civico: "5",
  cap: "20100",
  comune: "Milano",
  provincia: "MI",
  nazione: "IT",
  reaUfficio: "",
  reaNumero: "",
  pec: "esempio@pec.example",
  iban: "IT60X0542811101000000123456",
  aliquotaPredefinita: 22,
  primoNumero: 1,
  annoNumerazione: 2026,
  serie: "",
};

function congela(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) congela(v);
  }
  return o;
}
const sigle = (motivi) => motivi.map((m) => `${m.codice}:${m.gravita}`);
const ha = (r, codice, gravita) =>
  r.motivi.some((m) => m.codice === codice && (!gravita || m.gravita === gravita));

/* ── le tre letture di un cliente perfetto ─────────────────────────────── */
const lInd = (x = {}) => ({
  tipo: "indirizzo",
  indirizzo: "Via dei Tigli 4",
  cap: "20100",
  comune: "Milano",
  provincia: "MI",
  telefono: "331234567",
  nome: "Mario",
  cognome: "Rossi",
  indirizzoDiSpedizione: false,
  incerti: [],
  ...x,
});
const lTes = (x = {}) => ({
  tipo: "tessera",
  nome: "Mario",
  cognome: "Rossi",
  codiceFiscale: CF_PROVA,
  cfLetto: CF_PROVA,
  incerti: [],
  ...x,
});
const lPag = (x = {}) => ({
  tipo: "pagamento",
  importo: 120,
  importoAltro: null,
  valuta: "EUR",
  esito: "completato",
  data: "2026-11-10",
  meseGiorno: "",
  dataTesto: "10/11/2026",
  annoVisibile: true,
  formatoAmbiguo: false,
  modo: "pos",
  modoIncerto: false,
  riferimento: "ABC123456",
  paganteCognome: "Rossi",
  incerti: [],
  ...x,
});

/** I tre file di un cliente (k = posizione), nell'ordine dato; `null` al posto di una lettura = file mancante. */
const fileDi = (
  k,
  { ind = lInd(), tes = lTes(), pag = lPag() } = {},
  ordine = ["indirizzo", "tessera", "pagamento"],
) =>
  ordine.flatMap((t, j) => {
    const l = { indirizzo: ind, tessera: tes, pagamento: pag }[t];
    return l === null
      ? []
      : [{ indice: 3 * k + j, stato: "letto", impronta: `imp-${3 * k + j}`, tipo: t, lettura: l }];
  });

const lotto = (x = {}) => ({
  lotto: LOTTO_PROVA,
  creatoIl: "2026-11-12T08:00:00.000Z",
  descrizione: "",
  dataSeManca: "",
  firmaImpostazioni: "f",
  ...x,
});
const ctx = (x = {}) => ({
  lotto: lotto(),
  azienda: AZIENDA,
  oggi: OGGI,
  emesse: [],
  bozze: [],
  schede: [],
  impronteAltriLotti: [],
  ...x,
});

export async function prove(mod, { c, gruppo }) {
  const V = mod["fatture/bulk/valuta"];
  const T2 = mod["fatture/bulk/raggruppa"];
  const T4 = mod["fatture/bulk/doppioni-e-schede"];
  const F = mod["fatture/bulk/da-importo-a-fattura"];
  const X = mod["fatture/xml"];
  const CFM = mod["codice-fiscale"];

  /** Le righe di un insieme di file, come le avrebbe ricomposte T2. */
  const righeDa = (file, decisioni = {}) =>
    T2.ricomponi(file.map((f) => ({ indice: f.indice, tipo: f.tipo }))).map((g) => ({
      gruppo: g,
      file,
      ...(decisioni[g.idRiga] ? { decisioni: decisioni[g.idRiga] } : {}),
    }));
  /** Una riga sola (il cliente 0), valutata da sola. */
  const una = (parti = {}, cx = ctx(), decisioni, ordine) => {
    const file = fileDi(0, parti, ordine);
    const [r] = righeDa(file, decisioni ? { "0000-0001-0002": decisioni } : {});
    return V.valutaRiga(r, cx);
  };
  const ID0 = "0000-0001-0002";
  const aperta = (x = {}) => ({ idRiga: ID0, stato: "aperta", ...x });
  /** Conferma tutto quello che si può confermare (per codice) e la riga: lo stato in cui la persona ha detto «sì» a tutto. */
  const confermaTutto = (parti, cx, ordine) => {
    const r0 = una(parti, cx, undefined, ordine);
    return una(
      parti,
      cx,
      aperta({
        confermata: true,
        confermeAvvisi: r0.motivi.filter((m) => m.gravita === "conferma").map((m) => m.codice),
      }),
      ordine,
    );
  };
  /** Un'emessa finta, ma vera: costruita con la stessa funzione fiscale. */
  const emessa = ({
    numero = 5,
    data = "2026-11-11",
    serie = "",
    campi: ca = {},
    origine,
    riferimento = "",
  } = {}) => ({
    ...F.fatturaDaRiga({
      campi: {
        nome: "Anna",
        cognome: "Neri",
        codiceFiscale: cfConControllo("NRENNA90C41L219"),
        indirizzo: "Via Prova 1",
        cap: "00100",
        comune: "Roma",
        provincia: "RM",
        importo: 80,
        data,
        modo: "bonifico",
        riferimento,
        ...ca,
      },
      azienda: { ...AZIENDA, serie },
      lotto: origine?.lotto ?? "lotto-vecchio",
      idRiga: origine?.riga ?? "0000-0001-0002",
      descrizione: "",
      leadId: null,
      numeroProvvisorio: numero,
      impronte: origine?.impronte ?? ["vecchia-1"],
      adesso: "2026-11-12T10:00:00.000Z",
    }),
    stato: "emessa",
    numero,
    anno: Number(data.slice(0, 4)),
    serie,
    id: `${data.slice(0, 4)}-${String(numero).padStart(4, "0")}`,
  });

  gruppo("BULK · T10 · LA RIGA PERFETTA");
  const r0 = una();
  c(
    "stato «pronto» e non emettibile finché la persona non la conferma",
    ["pronto", false],
    [r0.stato, r0.emettibile],
  );
  c(
    "nessun motivo che blocchi o chieda conferma",
    [],
    r0.motivi.filter((m) => m.gravita !== "avviso"),
  );
  c(
    "i campi effettivi, nell'ordine di CampiRiga",
    {
      nome: "Mario",
      cognome: "Rossi",
      codiceFiscale: CF_PROVA,
      indirizzo: "Via dei Tigli 4",
      cap: "20100",
      comune: "Milano",
      provincia: "MI",
      importo: 120,
      data: "2026-11-10",
      modo: "pos",
      riferimento: "ABC123456",
    },
    r0.campi,
  );
  c("idRiga e numero vengono dal gruppo", [ID0, 1], [r0.idRiga, r0.numero]);
  c(
    "la fattura simulata: data = data del pagamento, tipo unica, totale = pagato",
    ["2026-11-10", "unica", 120],
    [r0.fattura?.data, r0.fattura?.tipo, r0.fattura?.totale],
  );
  c(
    "imponibile + IVA = totale al centesimo",
    12000,
    Math.round((r0.fattura.imponibile + r0.fattura.imposta) * 100),
  );
  c(
    "origineBulk: lotto, riga e la SOLA impronta del pagamento (non tessera né indirizzo)",
    [LOTTO_PROVA, ID0, ["imp-2"]],
    [r0.fattura.origineBulk.lotto, r0.fattura.origineBulk.riga, r0.fattura.origineBulk.impronte],
  );
  c("senza scheda: leadId sintetico mai vuoto", `bulk:${LOTTO_PROVA}:${ID0}`, r0.fattura.leadId);
  c("senza scheda abbinata: scheda null", null, r0.scheda);
  c(
    "totale nel file e ultimo giorno utile (data + 12)",
    [120, "2026-11-22"],
    [r0.totaleNelFile, r0.ultimoGiornoUtile],
  );
  c(
    "la simulata non ha bloccanti di problemiXml (è quello che la fa «pronta»)",
    [],
    X.problemiXml(r0.fattura, AZIENDA).bloccanti,
  );
  const rc = una({}, ctx(), aperta({ confermata: true }));
  c("confermata: stato «confermata», emettibile", ["confermata", true], [rc.stato, rc.emettibile]);
  c(
    "confermata ma con una riga ancora da controllare non è emettibile",
    [false, "da_controllare"],
    ((r) => [r.emettibile, r.stato])(
      una({ ind: lInd({ cap: "" }) }, ctx(), aperta({ confermata: true })),
    ),
  );

  gruppo("BULK · T10 · SPEC 6.4 · IL CAP MANCANTE SI CORREGGE NELLA RIGA");
  const senzaCap = una({ ind: lInd({ cap: "" }) });
  c(
    "senza CAP: da controllare, «cap_mancante» che blocca, nessuna conferma lo libera",
    ["da_controllare", true],
    [senzaCap.stato, ha(senzaCap, "cap_mancante", "blocca")],
  );
  c(
    "… e anche confermandola non è emettibile",
    false,
    confermaTutto({ ind: lInd({ cap: "" }) }).emettibile,
  );
  const corretta = una({ ind: lInd({ cap: "" }) }, ctx(), aperta({ modifiche: { cap: "20100" } }));
  c(
    "scrivo il CAP nella riga → pronto, senza ricaricare",
    ["pronto", "20100"],
    [corretta.stato, corretta.campi.cap],
  );
  c("la fattura simulata ha il CAP corretto", "20100", corretta.fattura.cliente.cap);
  c(
    "la modifica vince sulla lettura, anche per il CF (la riga con CF invalido torna pronta se ne scrivo uno buono)",
    "pronto",
    una(
      { tes: lTes({ codiceFiscale: "", cfLetto: CF_STORTO }) },
      ctx(),
      aperta({ modifiche: { codiceFiscale: CF_PROVA } }),
    ).stato,
  );
  c(
    "il CF letto male resta indicato (cf_non_valido) finché non lo si corregge",
    true,
    ha(una({ tes: lTes({ codiceFiscale: "", cfLetto: CF_STORTO }) }), "cf_non_valido", "blocca"),
  );
  c(
    "l'importo scritto a mano come testo («104,00») è letto con leggiEuro",
    104,
    una({}, ctx(), aperta({ modifiche: { importo: "104,00" } })).campi.importo,
  );
  c(
    "l'importo svuotato = mancante",
    ["importo_mancante", null],
    ((r) => [r.motivi.find((m) => m.codice === "importo_mancante")?.codice, r.campi.importo])(
      una({}, ctx(), aperta({ modifiche: { importo: "" } })),
    ),
  );
  const congelata = congela({ idRiga: ID0, stato: "aperta", modifiche: { cap: "20100" } });
  c(
    "le decisioni (congelate) non vengono mutate",
    "pronto",
    una({ ind: lInd({ cap: "" }) }, ctx(), congelata).stato,
  );

  gruppo(
    "BULK · T10 · UNA PROVA PER OGNI REGOLA DI problemiXml: UNA RIGA CON QUEL BLOCCANTE NON È MAI PRONTA",
  );
  const cfOmocodico = cfConControllo("RSSMRA80A01H50M"); // cifra finale «1» scritta «M»: valido per il carattere di controllo, ma xml.ts lo rifiuta (NOTE 5.3)
  const mutazioni = [
    // CHI EMETTE (il centro)
    ["ragione sociale del centro", {}, { denominazione: "" }],
    ["partita IVA del centro", {}, { partitaIva: "123" }],
    ["codice fiscale del centro", {}, { codiceFiscale: "ABC" }],
    ["CAP del centro", {}, { cap: "12" }],
    ["indirizzo del centro", {}, { indirizzo: "" }],
    ["comune del centro", {}, { comune: "" }],
    ["REA a metà", {}, { reaUfficio: "MI", reaNumero: "" }],
    // CHI RICEVE
    ["cliente senza codice fiscale", { tes: lTes({ codiceFiscale: "", cfLetto: "" }) }],
    [
      "cliente con 11 cifre al posto del CF",
      { tes: lTes({ codiceFiscale: "", cfLetto: "12345678901" }) },
    ],
    [
      "codice fiscale che non passa il controllo",
      { tes: lTes({ codiceFiscale: "", cfLetto: CF_STORTO }) },
    ],
    [
      "codice fiscale omocodico (xml.ts lo rifiuta)",
      { tes: lTes({ codiceFiscale: cfOmocodico, cfLetto: cfOmocodico }) },
    ],
    [
      "cliente senza nome né cognome",
      { tes: lTes({ nome: "", cognome: "" }), ind: lInd({ nome: "", cognome: "" }) },
    ],
    // Solo le regole di riga: problemiXml vuole almeno uno dei due, quindi qui non scatta (e la riga è bloccata lo stesso).
    ["cliente senza nome", { tes: lTes({ nome: "" }) }, undefined, true],
    [
      "cliente senza cognome",
      { tes: lTes({ cognome: "" }), ind: lInd({ cognome: "" }) },
      undefined,
      true,
    ],
    ["indirizzo del cliente", { ind: lInd({ indirizzo: "" }) }],
    ["comune del cliente", { ind: lInd({ comune: "" }) }],
    ["CAP del cliente vuoto", { ind: lInd({ cap: "" }) }],
    ["CAP del cliente di 4 cifre", { ind: lInd({ cap: "1234" }) }],
    // IL DOCUMENTO
    ["data mancante", { pag: lPag({ data: "" }) }],
    ["data nel futuro", { pag: lPag({ data: "2026-11-13" }) }],
    ["data che non esiste", { pag: lPag({ data: "2027-02-29" }) }],
    ["importo zero", { pag: lPag({ importo: 0 }) }],
    ["importo mancante", { pag: lPag({ importo: null }) }],
    ["importo con più di due decimali", { pag: lPag({ importo: 10.005 }) }],
  ];
  for (const [nome, parti, az, soloRegoleDiRiga] of mutazioni) {
    const cx = ctx(az ? { azienda: { ...AZIENDA, ...az } } : {});
    const r = confermaTutto(parti, cx);
    c(
      `${nome}: mai pronta, mai emettibile, nemmeno con tutto confermato`,
      [false, true],
      [r.emettibile, r.stato !== "pronto" && r.stato !== "confermata"],
    );
    // La prova vale solo se la regola di problemiXml scatta davvero: dove la fattura simulata esiste, ha un bloccante.
    if (r.fattura && !soloRegoleDiRiga)
      c(
        `${nome}: problemiXml ha davvero un bloccante`,
        true,
        X.problemiXml(r.fattura, az ? { ...AZIENDA, ...az } : AZIENDA).bloccanti.length > 0,
      );
  }
  const omo = una({ tes: lTes({ codiceFiscale: cfOmocodico, cfLetto: cfOmocodico }) });
  c(
    "omocodico: solo xml.ts lo ferma, e la riga lo dice col limite noto",
    [true, true],
    [
      ha(omo, "xml_cf_omocodico", "blocca"),
      /omocodi/i.test(omo.motivi.find((m) => m.codice === "xml_cf_omocodico")?.testo ?? ""),
    ],
  );
  c(
    "… senza ripetere il CF nel testo dei motivi (nessun dato di persona)",
    false,
    omo.motivi.some((m) => m.testo.includes(cfOmocodico)),
  );
  c(
    "una riga già bloccata dalle regole di riga non ripete il bloccante di problemiXml",
    false,
    senzaCap.motivi.some((m) => m.codice.startsWith("xml_")),
  );
  c(
    "l'azienda a posto non genera motivi del centro",
    false,
    r0.motivi.some((m) => ["azienda_xml", "azienda_incompleta"].includes(m.codice)),
  );

  gruppo("BULK · T10 · AVVISO DEL CENTESIMO: UNO SOLO, NON DUE (problemiXml + avvisoTotaleXml)");
  const r104 = una({ pag: lPag({ importo: 104 }) });
  c("104,00 pagato: il file dirà 104,01", [104, 104.01], [r104.fattura.totale, r104.totaleNelFile]);
  c(
    "un solo avviso, quello del totale nel file",
    ["totale_xml_diverso:avviso"],
    sigle(r104.motivi.filter((m) => m.gravita === "avviso" && /totale/i.test(m.testo))),
  );
  c("… ed è solo un avviso: la riga resta pronta", "pronto", r104.stato);
  c(
    "nessun motivo ripete «il totale in archivio» di problemiXml",
    false,
    r104.motivi.some((m) => /totale in archivio/i.test(m.testo)),
  );

  gruppo("BULK · T10 · NOMI DIVERSI TRA LE TRE IMMAGINI = MAI PRONTA");
  const cognomi = una({ ind: lInd({ cognome: "Bianchi" }) });
  c(
    "cognome dell'indirizzo ≠ tessera → blocca, non pronta",
    [true, "da_controllare"],
    [ha(cognomi, "persone_diverse", "blocca"), cognomi.stato],
  );
  c(
    "… nemmeno con tutto confermato",
    false,
    confermaTutto({ ind: lInd({ cognome: "Bianchi" }) }).emettibile,
  );
  const pagante = una({ pag: lPag({ paganteCognome: "Neri" }) });
  c(
    "pagante con un altro cognome → conferma: da controllare finché non la si conferma",
    [true, "da_controllare", false],
    [ha(pagante, "pagante_diverso", "conferma"), pagante.stato, pagante.emettibile],
  );
  c(
    "… confermato per codice e riga confermata → emettibile",
    true,
    confermaTutto({ pag: lPag({ paganteCognome: "Neri" }) }).emettibile,
  );
  c(
    "il CF non combacia col nome → conferma",
    true,
    ha(
      una({ tes: lTes({ nome: "Anna" }), ind: lInd({ nome: "Anna" }) }),
      "cf_non_combacia",
      "conferma",
    ),
  );
  c(
    "scorrimento: pagamento, tessera, indirizzo (ordine diverso) → conferma, mai «pronto» da solo",
    ["da_controllare", true],
    ((r) => [r.stato, ha(r, "ordine_diverso", "conferma")])(
      una({}, ctx(), undefined, ["pagamento", "tessera", "indirizzo"]),
    ),
  );
  c(
    "… e letto lo stesso: i campi sono quelli giusti",
    "20100",
    una({}, ctx(), undefined, ["pagamento", "tessera", "indirizzo"]).campi.cap,
  );
  c(
    "indirizzo di spedizione → conferma",
    true,
    ha(una({ ind: lInd({ indirizzoDiSpedizione: true }) }), "indirizzo_di_spedizione", "conferma"),
  );
  c(
    "campo obbligatorio letto con incertezza → conferma (D7)",
    true,
    ha(una({ ind: lInd({ incerti: ["cap"] }) }), "incerto_cap", "conferma"),
  );
  c(
    "… ma se la persona corregge il CAP il dubbio sparisce",
    false,
    ha(
      una({ ind: lInd({ incerti: ["cap"] }) }, ctx(), aperta({ modifiche: { cap: "20121" } })),
      "incerto_cap",
    ),
  );

  gruppo("BULK · T10 · MODIFICARE UNA RIGA CONFERMATA TOGLIE LA CONFERMA");
  const dec = congela(
    aperta({ confermata: true, confermeAvvisi: ["importo_alto"], modifiche: { cap: "20100" } }),
  );
  const dopo = V.conModifiche(dec, { importo: 12000 });
  c(
    "la riga non è più confermata, la modifica c'è, le altre ci sono ancora",
    [false, { cap: "20100", importo: 12000 }],
    [dopo.confermata, dopo.modifiche],
  );
  c(
    "le decisioni di partenza non sono mutate (sono congelate)",
    [true, { cap: "20100" }],
    [dec.confermata, dec.modifiche],
  );
  c(
    "anche le conferme dei singoli motivi si svuotano (come fa il server): niente conferme passate in silenzio",
    [[], false],
    [dopo.confermeAvvisi, dopo.confermata],
  );
  c(
    "senza la conferma di «importo_alto» la riga torna da controllare e non è emettibile",
    [false, "da_controllare", true],
    ((r) => [r.emettibile, r.stato, ha(r, "importo_alto", "conferma")])(una({}, ctx(), dopo)),
  );
  c(
    "riconfermando motivo e riga si può emettere",
    true,
    una({}, ctx(), { ...dopo, confermata: true, confermeAvvisi: ["importo_alto"] }).emettibile,
  );
  // Il caso concreto: la persona conferma il doppione della fattura A, poi corregge il CF e ne esce un doppione con la fattura B.
  const fatturaA = emessa({
    numero: 3,
    data: "2026-11-10",
    campi: { nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA, importo: 120 },
  });
  const cfB = cfConControllo("VRDLCU85M41F205");
  const fatturaB = emessa({
    numero: 4,
    data: "2026-11-10",
    campi: { nome: "Luca", cognome: "Verdi", codiceFiscale: cfB, importo: 120 },
  });
  const cxAB = ctx({ emesse: [fatturaA, fatturaB] });
  const confA = aperta({ confermata: true, confermeAvvisi: ["doppione_pagamento"] });
  c("doppione confermato per la fattura A: emettibile", true, una({}, cxAB, confA).emettibile);
  const cambiaCf = V.conModifiche(confA, { codiceFiscale: cfB, nome: "Luca", cognome: "Verdi" });
  c(
    "cambio il CF e riconfermo la riga: è un doppione della fattura B e RICOMPARE da confermare (nessuna conferma passata)",
    [false, true],
    ((r) => [r.emettibile, ha(r, "doppione_pagamento", "conferma")])(
      una({}, cxAB, { ...cambiaCf, confermata: true }),
    ),
  );
  c(
    "senza decisioni di partenza: crea la decisione",
    [ID0, "aperta", false, { cap: "1" }],
    ((d) => [d.idRiga, d.stato, d.confermata, d.modifiche])(
      V.conModifiche(undefined, { cap: "1" }, ID0),
    ),
  );

  gruppo("BULK · T10 · DOPPIONI · NON CONTRO SE STESSA, SOLO RIGHE APERTE");
  const rifDoppio = (x = {}) => lPag({ riferimento: "CRO 1234567890", ...x });
  const dueRighe = (decisioni = {}, cx = ctx(), parti1 = {}, parti2 = {}) => {
    const file = [
      ...fileDi(0, { pag: rifDoppio(), ...parti1 }),
      ...fileDi(1, {
        ind: lInd({ nome: "Anna", cognome: "Neri" }),
        tes: lTes({
          nome: "Anna",
          cognome: "Neri",
          codiceFiscale: cfConControllo("NRENNA90C41L219"),
          cfLetto: cfConControllo("NRENNA90C41L219"),
        }),
        pag: rifDoppio({ paganteCognome: "Neri", data: "2026-11-09" }),
        ...parti2,
      }),
    ];
    return V.valutaLotto(righeDa(file, decisioni), cx);
  };
  const ID1 = "0003-0004-0005";
  const due = dueRighe();
  c(
    "stesso riferimento in due righe: tutte e due «doppione_riferimento» che blocca",
    [true, true],
    [
      ha(due.righe[0], "doppione_riferimento", "blocca"),
      ha(due.righe[1], "doppione_riferimento", "blocca"),
    ],
  );
  c(
    "il motivo dice quale riga («riga 2», dal numero della riga)",
    [true, true],
    [
      /riga 2/.test(due.righe[0].motivi.find((m) => m.codice === "doppione_riferimento").testo),
      /riga 1/.test(due.righe[1].motivi.find((m) => m.codice === "doppione_riferimento").testo),
    ],
  );
  const unaScartata = dueRighe({ [ID1]: { idRiga: ID1, stato: "scartata" } });
  c(
    "scartata una, l'altra non è più bloccata",
    [false, "scartata"],
    [ha(unaScartata.righe[0], "doppione_riferimento"), unaScartata.righe[1].stato],
  );
  c(
    "una riga scartata non ha motivi né fattura",
    [[], undefined],
    [unaScartata.righe[1].motivi, unaScartata.righe[1].fattura],
  );
  // Una riga già emessa: sta fra le emesse (origineBulk), non fra le righe aperte.
  const gia = emessa({
    numero: 7,
    data: "2026-11-10",
    campi: { nome: "Anna", cognome: "Neri", importo: 120 },
    riferimento: "CRO 1234567890",
    origine: { lotto: LOTTO_PROVA, riga: ID1, impronte: ["imp-5"] },
  });
  const unaEmessa = dueRighe(
    {
      [ID1]: {
        idRiga: ID1,
        stato: "emessa",
        emessa: { id: gia.id, numero: 7, data: "2026-11-10" },
      },
    },
    ctx({ emesse: [gia] }),
  );
  c(
    "una riga già emessa: stato «emessa», niente motivi, non emettibile di nuovo",
    ["emessa", [], false],
    [unaEmessa.righe[1].stato, unaEmessa.righe[1].motivi, unaEmessa.righe[1].emettibile],
  );
  c(
    "… e mostra i campi della fattura emessa (le letture sono state svuotate)",
    ["Anna", "Neri"],
    [unaEmessa.righe[1].campi.nome, unaEmessa.righe[1].campi.cognome],
  );
  c(
    "l'altra riga è bloccata dalla FATTURA emessa (stesso riferimento), con il numero",
    [true, true],
    [
      ha(unaEmessa.righe[0], "doppione_riferimento", "blocca"),
      /2026\/0007/.test(
        unaEmessa.righe[0].motivi.find((m) => m.codice === "doppione_riferimento").testo,
      ),
    ],
  );
  // Risposta persa dopo la scrittura: la fattura c'è, ma le decisioni dicono ancora «aperta». Non è un doppione di se stessa.
  const persa = emessa({
    numero: 8,
    data: "2026-11-10",
    campi: { importo: 120, nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA },
    riferimento: "ABC123456",
    origine: { lotto: LOTTO_PROVA, riga: ID0, impronte: ["imp-2"] },
  });
  const rp = una({}, ctx({ emesse: [persa] }));
  c(
    "fattura già scritta ma riga ancora «aperta»: nessun doppione di se stessa",
    [],
    rp.motivi.filter((m) => m.codice.startsWith("doppione_")),
  );
  c("… e lo stato resta «pronto» (l'emissione la ritrova con cercaPerOrigine)", "pronto", rp.stato);
  c(
    "lo stesso riferimento su una fattura di un ALTRO lotto invece sì",
    ["doppione_riferimento:blocca"],
    sigle(
      una(
        {},
        ctx({
          emesse: [
            emessa({
              riferimento: "ABC123456",
              origine: { lotto: "lotto-altro", riga: ID0, impronte: [] },
            }),
          ],
        }),
      ).motivi.filter((m) => m.codice === "doppione_riferimento"),
    ),
  );
  c(
    "stesso screenshot del pagamento in una fattura emessa (anche a lotto cancellato) → blocca",
    true,
    ha(
      una(
        {},
        ctx({
          emesse: [
            emessa({
              origine: { lotto: "lotto-chiuso", riga: "0000-0001-0002", impronte: ["imp-2"] },
            }),
          ],
        }),
      ),
      "doppione_screenshot",
      "blocca",
    ),
  );
  c(
    "la sola impronta di tessera o indirizzo nelle emesse NON blocca (si ricaricano per un secondo pagamento)",
    false,
    ha(
      una(
        {},
        ctx({
          emesse: [
            emessa({ origine: { lotto: "lotto-chiuso", riga: "x", impronte: ["imp-0", "imp-1"] } }),
          ],
        }),
      ),
      "doppione_screenshot",
    ),
  );
  c(
    "impronte dei pagamenti di altri lotti aperti → blocca",
    true,
    ha(una({}, ctx({ impronteAltriLotti: ["imp-2"] })), "doppione_screenshot", "blocca"),
  );
  c(
    "impronteGiaViste sulle fatture del bulk contiene solo il pagamento, non tessera e indirizzo",
    ["imp-2"],
    [...T4.impronteGiaViste({ emesse: [r0.fattura], bozze: [], altreRighe: [], altriLotti: [] })],
  );
  const stessoPagamento = una(
    {},
    ctx({
      emesse: [
        emessa({
          numero: 3,
          data: "2026-11-10",
          campi: { importo: 120, nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA },
        }),
      ],
    }),
  );
  c(
    "stesso CF + totale + data di una emessa → «sembra già fatturata», conferma",
    [true, "da_controllare"],
    [ha(stessoPagamento, "doppione_pagamento", "conferma"), stessoPagamento.stato],
  );
  c(
    "… con «Confermo comunque» (per codice) e riga confermata si emette",
    true,
    confermaTutto(
      {},
      ctx({
        emesse: [
          emessa({
            numero: 3,
            data: "2026-11-10",
            campi: { importo: 120, nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA },
          }),
        ],
      }),
    ).emettibile,
  );
  const conBozza = una(
    {},
    ctx({
      schede: [
        { id: "s1", nome: "Mario", cognome: "Rossi", codiceFiscale: CF_PROVA, telefono: "" },
      ],
      bozze: [{ ...emessa(), id: "bozza:s1", stato: "bozza", numero: 0, data: "", leadId: "s1" }],
    }),
  );
  c(
    "bozza aperta della scheda abbinata → avviso (usa il numero e lo schedaId della riga)",
    [true, "pronto"],
    [ha(conBozza, "bozza_aperta", "avviso"), conBozza.stato],
  );

  gruppo("BULK · T10 · RIFERIMENTI GENERICI NON VALGONO PER I DOPPIONI");
  for (const generico of [
    "BONIFICO",
    "Bonifico",
    "PAGAMENTO",
    "RICARICA",
    "RICARICA 2026",
    "Bonifico istantaneo",
    "POS",
    "CARTA",
    "ABCDEF",
  ])
    c(
      `«${generico}» in due righe: nessun doppione`,
      false,
      dueRighe(
        {},
        ctx(),
        { pag: lPag({ riferimento: generico }) },
        { pag: lPag({ riferimento: generico, paganteCognome: "Neri", data: "2026-11-09" }) },
      ).righe.some((r) => ha(r, "doppione_riferimento")),
    );
  for (const vero of ["CRO 1234567890", "CRO1234567890", "TXN-ABC123", "0123456789"])
    c(
      `«${vero}» è un riferimento vero: blocca`,
      true,
      dueRighe(
        {},
        ctx(),
        { pag: lPag({ riferimento: vero }) },
        { pag: lPag({ riferimento: vero, paganteCognome: "Neri", data: "2026-11-09" }) },
      ).righe.every((r) => ha(r, "doppione_riferimento", "blocca")),
    );
  c(
    "riferimento generico anche su una fattura emessa: nessun blocco",
    false,
    ha(
      una(
        { pag: lPag({ riferimento: "BONIFICO" }) },
        ctx({ emesse: [emessa({ riferimento: "BONIFICO" })] }),
      ),
      "doppione_riferimento",
    ),
  );
  c(
    "il riferimento generico resta nella fattura (è quello che dice lo screenshot)",
    "BONIFICO",
    una({ pag: lPag({ riferimento: "BONIFICO" }) }).fattura.riferimentoPagamento,
  );

  gruppo("BULK · T10 · ABBINAMENTO ALLA SCHEDA");
  const schedaCf = {
    id: "s-cf",
    nome: "Mario",
    cognome: "Rossi",
    codiceFiscale: CF_PROVA,
    telefono: "",
  };
  const abbCf = una({}, ctx({ schede: [schedaCf] }));
  c(
    "per codice fiscale: scheda collegata, leadId = id scheda, nessun motivo in più",
    ["s-cf", "s-cf", "pronto"],
    [abbCf.scheda, abbCf.fattura.leadId, abbCf.stato],
  );
  const madre = {
    id: "madre",
    nome: "Anna",
    cognome: "Rossi",
    codiceFiscale: "",
    telefono: "331234567",
  };
  const abbTel = una({}, ctx({ schede: [madre] }));
  c(
    "telefono + cognome ma NOME non compatibile (madre e figlia): collegata, da confermare",
    ["madre", true, "da_controllare"],
    [abbTel.scheda, ha(abbTel, "scheda_telefono_nome_diverso", "conferma"), abbTel.stato],
  );
  const abbNome = una(
    { ind: lInd({ telefono: "" }) },
    ctx({
      schede: [{ id: "s-n", nome: "Mario", cognome: "Rossi", codiceFiscale: "", telefono: "" }],
    }),
  );
  c(
    "solo per nome e cognome: collegata, da confermare",
    ["s-n", true],
    [abbNome.scheda, ha(abbNome, "scheda_solo_nome", "conferma")],
  );
  const abbCfDiv = una(
    {},
    ctx({
      schede: [
        {
          ...schedaCf,
          id: "s-div",
          codiceFiscale: cfConControllo("VRDLCU85M41F205"),
          telefono: "331234567",
        },
      ],
    }),
  );
  c(
    "scheda con un CF diverso: collegata ma da confermare",
    [true, "da_controllare"],
    [ha(abbCfDiv, "scheda_cf_diverso", "conferma"), abbCfDiv.stato],
  );
  c(
    "omonimi (due schede): nessuna scheda, la fattura resta senza",
    [null, `bulk:${LOTTO_PROVA}:${ID0}`],
    ((r) => [r.scheda, r.fattura.leadId])(
      una(
        { ind: lInd({ telefono: "" }), tes: lTes({ codiceFiscale: CF_PROVA }) },
        ctx({
          schede: [
            { id: "a", nome: "Mario", cognome: "Rossi", codiceFiscale: "", telefono: "" },
            { id: "b", nome: "Mario", cognome: "Rossi", codiceFiscale: "", telefono: "" },
          ],
        }),
      ),
    ),
  );
  const schedaScelta = {
    id: "s-scelta",
    nome: "Mario",
    cognome: "Rossi",
    codiceFiscale: "",
    telefono: "",
  };
  const manuale = una(
    {},
    ctx({ schede: [schedaCf, schedaScelta] }),
    aperta({ scheda: "s-scelta" }),
  );
  c(
    "scheda scelta a mano (esiste, senza CF): vince sull'abbinamento, senza motivi di abbinamento",
    ["s-scelta", "s-scelta", false],
    [
      manuale.scheda,
      manuale.fattura.leadId,
      manuale.motivi.some((m) => m.codice.startsWith("scheda_")),
    ],
  );
  const inesistente = una(
    {},
    ctx({ schede: [schedaCf] }),
    aperta({ scheda: "id-che-non-esiste", confermata: true }),
  );
  c(
    "scheda scelta a mano che non esiste più → blocca «scheda_non_trovata», non emettibile",
    [true, false, "da_controllare"],
    [ha(inesistente, "scheda_non_trovata", "blocca"), inesistente.emettibile, inesistente.stato],
  );
  const cfAltro = una(
    {},
    ctx({ schede: [{ ...schedaScelta, codiceFiscale: cfConControllo("VRDLCU85M41F205") }] }),
    aperta({ scheda: "s-scelta" }),
  );
  c(
    "scheda scelta a mano con un CF di un'altra persona → conferma «scheda_cf_diverso»",
    [true, "da_controllare"],
    [ha(cfAltro, "scheda_cf_diverso", "conferma"), cfAltro.stato],
  );
  c(
    "… confermata per codice si emette",
    true,
    una(
      {},
      ctx({ schede: [{ ...schedaScelta, codiceFiscale: cfConControllo("VRDLCU85M41F205") }] }),
      aperta({ scheda: "s-scelta", confermata: true, confermeAvvisi: ["scheda_cf_diverso"] }),
    ).emettibile,
  );
  c(
    "scheda scelta a mano con lo stesso CF → nessun motivo",
    [],
    una(
      {},
      ctx({ schede: [{ ...schedaScelta, codiceFiscale: CF_PROVA }] }),
      aperta({ scheda: "s-scelta" }),
    ).motivi.filter((m) => m.codice.startsWith("scheda_")),
  );
  const nessuna = una({}, ctx({ schede: [schedaCf] }), aperta({ scheda: null }));
  c(
    "«nessuna» a mano: nessuna scheda, anche se il CF ne avrebbe una",
    [null, `bulk:${LOTTO_PROVA}:${ID0}`],
    [nessuna.scheda, nessuna.fattura.leadId],
  );
  const schedeOrig = congela([schedaCf]);
  c(
    "le schede passate (congelate) non vengono mutate",
    "pronto",
    una({}, ctx({ schede: schedeOrig })).stato,
  );

  gruppo("BULK · T10 · IL LOTTO DEL CENTRO: controllaLotto IN ANTEPRIMA E PRIMA DI OGNI EMISSIONE");
  for (const [nome, az, codice] of [
    ["aliquota 0 (bollo non gestito)", { aliquotaPredefinita: 0 }, "aliquota_zero_bollo"],
    ["RF19 con aliquota 22", { regimeFiscale: "RF19" }, "regime_aliquota"],
    ["RF01 con aliquota 0", { aliquotaPredefinita: 0 }, "regime_aliquota"],
    ["centro incompleto", { denominazione: "" }, "azienda_incompleta"],
  ]) {
    const cx = ctx({ azienda: { ...AZIENDA, ...az } });
    const r = confermaTutto({}, cx);
    c(
      `${nome}: la riga porta il motivo «${codice}» (blocca) e non è emettibile`,
      [true, false],
      [ha(r, codice, "blocca"), r.emettibile],
    );
  }
  const aliq0 = una({}, ctx({ azienda: { ...AZIENDA, aliquotaPredefinita: 0 } }));
  c(
    "aliquota 0: nessuna fattura simulata (non si può) e nessun errore lanciato",
    undefined,
    aliq0.fattura,
  );
  // Il centro cambia fra l'anteprima e l'emissione: la stessa riga, valutata di nuovo con l'azienda riletta, si ferma.
  const prima = confermaTutto({}, ctx());
  const poi = confermaTutto({}, ctx({ azienda: { ...AZIENDA, regimeFiscale: "RF19" } }));
  c(
    "prima emettibile, dopo il cambio di regime nel centro no",
    [true, false],
    [prima.emettibile, poi.emettibile],
  );
  const lotA0 = V.valutaLotto(
    righeDa(fileDi(0)),
    ctx({ azienda: { ...AZIENDA, aliquotaPredefinita: 0 } }),
  );
  c(
    "valutaLotto: i motivi del lotto stanno anche a parte, una volta sola",
    [true, true],
    [
      lotA0.motiviLotto.some((m) => m.codice === "aliquota_zero_bollo"),
      lotA0.motiviLotto.filter((m) => m.codice === "aliquota_zero_bollo").length === 1,
    ],
  );
  c(
    "valutaLotto con il centro a posto: nessun motivo di lotto",
    [],
    V.valutaLotto(righeDa(fileDi(0)), ctx()).motiviLotto,
  );
  const descr = V.valutaLotto(
    righeDa(fileDi(0)),
    ctx({ lotto: lotto({ descrizione: "Capelli per tutti" }) }),
  );
  c(
    "descrizione scelta fuori dall'elenco pronto → motivo di lotto che blocca e righe non emettibili",
    [true, false],
    [
      descr.motiviLotto.some(
        (m) => m.codice === "descrizione_non_ammessa" && m.gravita === "blocca",
      ),
      descr.righe[0].emettibile,
    ],
  );
  const descrOk = una(
    {},
    ctx({ lotto: lotto({ descrizione: mod["fatture/descrizioni"].DESCRIZIONI[0] }) }),
  );
  c(
    "la descrizione dell'elenco va bene e finisce nella riga della fattura",
    mod["fatture/descrizioni"].DESCRIZIONI[0],
    descrOk.fattura.righe[0].descrizione,
  );

  gruppo("BULK · T10 · DATA ANTERIORE ALL'ULTIMA EMESSA (esitoOrdineDate, serie del centro)");
  const nuova = ctx({ emesse: [emessa({ numero: 5, data: "2026-11-11" })] });
  const ant = una({}, nuova);
  c(
    "data del pagamento più vecchia dell'ultima emessa → «data_anteriore», conferma (mai blocca)",
    ["data_anteriore:conferma", "da_controllare"],
    [sigle(ant.motivi.filter((m) => m.codice === "data_anteriore"))[0], ant.stato],
  );
  c(
    "il motivo guarda il campo data e cita il numero della fattura più recente",
    ["data", true],
    [
      ant.motivi.find((m) => m.codice === "data_anteriore").campo,
      /n\. 5/.test(ant.motivi.find((m) => m.codice === "data_anteriore").testo),
    ],
  );
  c("confermata per codice e riga → emettibile", true, confermaTutto({}, nuova).emettibile);
  const cambiata = ctx({ emesse: [emessa({ numero: 9, data: "2026-11-12" })] });
  const confDec = aperta({ confermata: true, confermeAvvisi: ["data_anteriore"] });
  c(
    "la conferma per codice vale anche se l'ultima emessa cambia (numero 5 → 9, data 11 → 12)",
    [true, true],
    [una({}, nuova, confDec).emettibile, una({}, cambiata, confDec).emettibile],
  );
  c("senza emesse in archivio non c'è niente di anteriore", false, ha(una(), "data_anteriore"));
  const serieA = { ...AZIENDA, serie: "A" };
  c(
    "serie diversa dalla mia: le emesse della serie B non contano",
    false,
    ha(
      una(
        {},
        ctx({ azienda: serieA, emesse: [emessa({ numero: 5, data: "2026-11-11", serie: "B" })] }),
      ),
      "data_anteriore",
    ),
  );
  c(
    "… quelle della mia serie sì",
    true,
    ha(
      una(
        {},
        ctx({ azienda: serieA, emesse: [emessa({ numero: 5, data: "2026-11-11", serie: "A" })] }),
      ),
      "data_anteriore",
    ),
  );
  c(
    "un'altra anno non conta: la numerazione riparte",
    false,
    ha(una({}, ctx({ emesse: [emessa({ numero: 5, data: "2025-12-31" })] })), "data_anteriore"),
  );

  gruppo("BULK · T10 · LA DATA: ANNO PROPOSTO, CAMPO DI RISERVA, FUTURO");
  const senzaAnno = una({ pag: lPag({ data: "", meseGiorno: "11-05", annoVisibile: false }) });
  c(
    "senza anno nello screenshot: proposto il più recente non futuro, da confermare",
    ["2026-11-05", true, "da_controllare"],
    [senzaAnno.campi.data, ha(senzaAnno, "anno_proposto", "conferma"), senzaAnno.stato],
  );
  c("la fattura simulata usa quella data", "2026-11-05", senzaAnno.fattura.data);
  c(
    "gennaio quando oggi è novembre: dell'anno in corso; dicembre: dell'anno scorso",
    ["2026-01-20", "2025-12-20"],
    [
      una({ pag: lPag({ data: "", meseGiorno: "01-20" }) }).campi.data,
      una({ pag: lPag({ data: "", meseGiorno: "12-20" }) }).campi.data,
    ],
  );
  const riserva = ctx({ lotto: lotto({ dataSeManca: "2026-11-01" }) });
  const conRiserva = una({ pag: lPag({ data: "", meseGiorno: "", dataTesto: "" }) }, riserva);
  c(
    "nessuna data nello screenshot ma c'è il campo di riserva: la usa, sempre da confermare (D16)",
    ["2026-11-01", true, "da_controllare"],
    [conRiserva.campi.data, ha(conRiserva, "data_di_riserva", "conferma"), conRiserva.stato],
  );
  c(
    "… confermata per codice si emette",
    true,
    confermaTutto({ pag: lPag({ data: "", meseGiorno: "", dataTesto: "" }) }, riserva).emettibile,
  );
  c(
    "la riserva non prende il posto di una data scritta a mano",
    ["2026-11-02", false],
    ((r) => [r.campi.data, ha(r, "data_di_riserva")])(
      una(
        { pag: lPag({ data: "", meseGiorno: "" }) },
        riserva,
        aperta({ modifiche: { data: "2026-11-02" } }),
      ),
    ),
  );
  c(
    "la riserva non prende il posto di una data letta",
    ["2026-11-10", false],
    ((r) => [r.campi.data, ha(r, "data_di_riserva")])(una({}, riserva)),
  );
  c(
    "senza data e senza riserva: «data_mancante» che blocca",
    true,
    ha(una({ pag: lPag({ data: "", meseGiorno: "" }) }), "data_mancante", "blocca"),
  );
  c(
    "data nel futuro → blocca",
    true,
    ha(una({ pag: lPag({ data: "2026-11-13" }) }), "data_futura", "blocca"),
  );
  c(
    "più di 12 giorni dal pagamento → conferma con l'ultimo giorno utile",
    [true, "da_controllare"],
    ((r) => [ha(r, "oltre_12_giorni", "conferma"), r.stato])(
      una({ pag: lPag({ data: "2026-10-20" }) }),
    ),
  );
  c(
    "anno diverso dal corrente → conferma",
    true,
    ha(una({ pag: lPag({ data: "2025-12-20" }) }), "anno_diverso", "conferma"),
  );

  gruppo("BULK · T10 · ESITO VUOTO NON BLOCCA, «NON COMPLETATO» SÌ; MODO E VALUTA");
  c(
    "esito «» (lo screenshot non lo dice): la riga resta pronta",
    "pronto",
    una({ pag: lPag({ esito: "" }) }).stato,
  );
  c(
    "esito non_completato → blocca",
    true,
    ha(una({ pag: lPag({ esito: "non_completato" }) }), "pagamento_non_completato", "blocca"),
  );
  c(
    "PayPal → blocca, mai un bonifico di ripiego",
    [true, undefined],
    ((r) => [ha(r, "modo_non_ammesso", "blocca"), r.fattura])(
      una({ pag: lPag({ modo: "paypal" }) }),
    ),
  );
  c(
    "modo scelto a mano dopo PayPal → pronta",
    ["pronto", "bonifico"],
    ((r) => [r.stato, r.fattura.metodoPagamento])(
      una({ pag: lPag({ modo: "paypal" }) }, ctx(), aperta({ modifiche: { modo: "bonifico" } })),
    ),
  );
  c(
    "modo incerto (POS o carta) → conferma",
    true,
    ha(una({ pag: lPag({ modoIncerto: true }) }), "modo_incerto", "conferma"),
  );
  c(
    "valuta non euro → blocca",
    true,
    ha(una({ pag: lPag({ valuta: "USD" }) }), "valuta_non_euro", "blocca"),
  );

  gruppo("BULK · T10 · GRUPPO INCOMPLETO, LETTURA FALLITA, FILE NON ANCORA LETTI = ERRORE");
  const senzaPag = una({ pag: null });
  c(
    "manca il pagamento → errore «gruppo_incompleto», nessuna fattura",
    ["errore", true, undefined],
    [senzaPag.stato, ha(senzaPag, "gruppo_incompleto", "blocca"), senzaPag.fattura],
  );
  c(
    "… mai emettibile, nemmeno confermata",
    false,
    una({ pag: null }, ctx(), aperta({ confermata: true })).emettibile,
  );
  const fileFallito = fileDi(0, { pag: null });
  fileFallito.push({ indice: 2, stato: "errore", impronta: "imp-2", tipo: "", errore: "timeout" });
  const [rigaFallita] = righeDa(fileFallito);
  const fallita = V.valutaRiga(rigaFallita, ctx());
  c(
    "un file la cui lettura è fallita: errore «lettura_fallita» (si può rileggere), non «manca il pagamento»",
    ["errore", ["lettura_fallita"]],
    [fallita.stato, fallita.motivi.map((m) => m.codice)],
  );
  const fileAttesa = fileDi(0, { pag: null });
  fileAttesa.push({ indice: 2, stato: "salvato", impronta: "imp-2", tipo: "" });
  const attesa = V.valutaRiga(righeDa(fileAttesa)[0], ctx());
  c(
    "un file non ancora letto: errore «in_attesa_lettura»",
    ["errore", ["in_attesa_lettura"]],
    [attesa.stato, attesa.motivi.map((m) => m.codice)],
  );
  c(
    "nessun testo cita dati di persona",
    false,
    [senzaPag, fallita, attesa].some((r) =>
      r.motivi.some((m) => /Rossi|Mario|Milano/.test(m.testo)),
    ),
  );
  const copia = fileDi(0);
  copia[2] = { indice: 2, stato: "letto", impronta: "imp-2", tipo: "pagamento", copiaDi: 5 };
  const lcopia = [...copia, ...fileDi(1, { pag: lPag({ riferimento: "ZZZ999888" }) })];
  const rcopia = V.valutaRiga(righeDa(lcopia)[0], ctx());
  c("un file «copiaDi» legge la lettura dell'originale", "ZZZ999888", rcopia.campi.riferimento);
  c(
    "… e mantiene la propria impronta per i doppioni",
    ["imp-2"],
    rcopia.fattura.origineBulk.impronte,
  );

  gruppo("BULK · T10 · DETERMINISMO E INPUT NON MUTATO");
  const fileCg = congela([...fileDi(0), ...fileDi(1, { ind: lInd({ cognome: "Neri" }) })]);
  const righeCg = congela(righeDa(fileCg));
  const cxCg = congela(ctx({ emesse: [emessa()], schede: [schedaCf] }));
  const v1 = V.valutaLotto(righeCg, cxCg);
  const v2 = V.valutaLotto(righeCg, cxCg);
  c(
    "due valutazioni degli stessi ingressi (congelati) danno lo stesso risultato",
    JSON.stringify(v1),
    JSON.stringify(v2),
  );
  c(
    "valutaRiga di una riga == la stessa riga dentro valutaLotto (senza altre righe di mezzo)",
    JSON.stringify(V.valutaRiga(righeCg[0], cxCg, V.righePerDoppioni(righeCg, cxCg))),
    JSON.stringify(v1.righe[0]),
  );
  c(
    "… e ogni riga ha UNO stato fra quelli ammessi e una frase per ogni motivo",
    true,
    v1.righe.every(
      (r) =>
        ["pronto", "da_controllare", "errore", "confermata", "emessa", "scartata"].includes(
          r.stato,
        ) && r.motivi.every((m) => m.testo.length > 10),
    ),
  );
  c(
    "nessun log di dati: i motivi non contengono il CF né il cognome del cliente",
    false,
    v1.righe.some((r) => r.motivi.some((m) => m.testo.includes(CF_PROVA))),
  );

  gruppo("BULK · T10 · SPEC 6.5 · 100 RIGHE, 94 PRONTE, 6 DA CONTROLLARE");
  const COGN = [
    "Ros",
    "Ver",
    "Bian",
    "Ner",
    "Gial",
    "Bru",
    "Mar",
    "Cos",
    "Fer",
    "Gall",
    "Pell",
    "Sant",
    "Mont",
    "Lomb",
    "Barb",
    "Giord",
    "Rizz",
    "Ferr",
    "Colomb",
    "Vill",
  ];
  const SUFF = ["i", "ini", "oni", "etti", "ucci", "ari", "ani", "elli", "ano", "one"];
  const NOMI = [
    "Luca",
    "Anna",
    "Marco",
    "Giulia",
    "Paolo",
    "Sara",
    "Elena",
    "Davide",
    "Chiara",
    "Matteo",
  ];
  const MESI = "ABCDEHLMPRST";
  /** Il cliente k: nome, cognome e CF coerenti fra loro (il CF è calcolato dal nome, quindi torna). */
  const persona = (k) => {
    const cognome = COGN[Math.floor(k / 10)] + SUFF[k % 10];
    const nome = NOMI[(k * 7) % 10];
    const yy = String(50 + (k % 40)).padStart(2, "0");
    const gg = String(1 + (k % 28)).padStart(2, "0");
    const cf = cfConControllo(
      `${CFM.codiceCognome(cognome)}${CFM.codiceNome(nome)}${yy}${MESI[k % 12]}${gg}H501`,
    );
    return { nome, cognome, cf };
  };
  const modoDi = (k) => ["pos", "bonifico", "contanti"][k % 3];
  /** Le tre letture del cliente k: tutto a posto, salvo i ritocchi. */
  const clienteK = (k, ritocchi = {}) => {
    const p = persona(k);
    return {
      ind: lInd({
        nome: p.nome,
        cognome: p.cognome,
        telefono: String(300000000 + k * 7919).slice(0, 9),
        indirizzo: `Via Esempio ${k + 1}`,
        cap: String(20000 + k).padStart(5, "0"),
        ...ritocchi.ind,
      }),
      tes: lTes({
        nome: p.nome,
        cognome: p.cognome,
        codiceFiscale: p.cf,
        cfLetto: p.cf,
        ...ritocchi.tes,
      }),
      pag: lPag({
        importo: 80 + k * 3.5,
        data: `2026-11-${String(1 + (k % 12)).padStart(2, "0")}`,
        modo: modoDi(k),
        riferimento: modoDi(k) === "contanti" ? "" : `CRO ${1000000000 + k}`,
        paganteCognome: p.cognome,
        dataTesto: "",
        ...ritocchi.pag,
      }),
    };
  };
  /** `ritocchi[k]` = difetti del cliente k; `per` = ritocchi per TUTTI i clienti (per esempio una data comune). */
  const costruisci = (n, ritocchi = {}, per = {}) =>
    Array.from({ length: n }, (_, k) =>
      fileDi(
        k,
        clienteK(k, {
          ind: { ...per.ind, ...ritocchi[k]?.ind },
          tes: { ...per.tes, ...ritocchi[k]?.tes },
          pag: { ...per.pag, ...ritocchi[k]?.pag },
        }),
      ),
    ).flat();
  const DIFETTI = {
    2: { ind: { cap: "" } },
    16: { tes: { codiceFiscale: "", cfLetto: CF_STORTO } },
    27: { pag: { importo: null } },
    40: { pag: { modo: "paypal" } },
    54: { pag: { data: "2026-11-13" } },
    76: { pag: { paganteCognome: "Neri" } },
  };
  const fileA = congela(costruisci(100, DIFETTI));
  const cxA = congela(ctx());
  const t0 = Date.now();
  const lotA = V.valutaLotto(righeDa(fileA), cxA);
  const ms = Date.now() - t0;
  const conta = (lotto_, stato) => lotto_.righe.filter((r) => r.stato === stato).length;
  c(
    "300 file → 100 righe nell'ordine di caricamento",
    [100, true],
    [lotA.righe.length, lotA.righe.every((r, i) => r.numero === i + 1)],
  );
  c(
    "94 pronte, 6 da controllare, nessun errore",
    [94, 6, 0],
    [conta(lotA, "pronto"), conta(lotA, "da_controllare"), conta(lotA, "errore")],
  );
  c(
    "le 6 da controllare sono proprio quelle con il difetto",
    [2, 16, 27, 40, 54, 76],
    lotA.righe.map((r, i) => (r.stato === "da_controllare" ? i : -1)).filter((i) => i >= 0),
  );
  c(
    "nessuna pronta ha un bloccante di problemiXml sulla fattura simulata",
    true,
    lotA.righe
      .filter((r) => r.stato === "pronto")
      .every((r) => X.problemiXml(r.fattura, AZIENDA).bloccanti.length === 0),
  );
  c(
    "tutti i CF di prova tornano con nome e cognome (nessun «cf_non_combacia»)",
    false,
    lotA.righe.some((r) => ha(r, "cf_non_combacia")),
  );
  const decisioniConferma = Object.fromEntries(
    lotA.righe
      .filter((r) => r.stato === "pronto")
      .map((r) => [r.idRiga, { idRiga: r.idRiga, stato: "aperta", confermata: true }]),
  );
  const lotA2 = V.valutaLotto(righeDa(fileA, decisioniConferma), cxA);
  c(
    "«conferma tutte le pronte (94)» → 94 emettibili",
    [94, 94, 0],
    [
      lotA2.righe.filter((r) => r.emettibile).length,
      conta(lotA2, "confermata"),
      lotA2.righe.filter((r) => r.emettibile && r.stato !== "confermata").length,
    ],
  );
  c(
    "le 6 non confermate non sono toccate: restano «da controllare», non emettibili",
    [6, 6],
    [lotA2.righe.filter((r) => !r.emettibile).length, conta(lotA2, "da_controllare")],
  );
  c(
    "totali delle emettibili: imponibile + IVA = totale al centesimo, per tutte",
    true,
    lotA2.righe
      .filter((r) => r.emettibile)
      .every(
        (r) =>
          Math.round((r.fattura.imponibile + r.fattura.imposta) * 100) ===
            Math.round(r.fattura.totale * 100) &&
          Math.round(r.fattura.totale * 100) === Math.round(r.campi.importo * 100),
      ),
  );
  c(
    "la data di ogni fattura è quella del pagamento",
    true,
    lotA2.righe.filter((r) => r.emettibile).every((r) => r.fattura.data === r.campi.data),
  );
  c(
    "fatti sulle date: nessuna emessa in archivio, date estreme del lotto",
    [null, "2026-11-01", "2026-11-13"],
    [lotA.fatti.ultimaEmessa, lotA.fatti.dataMinima, lotA.fatti.dataMassima],
  );
  c("abbastanza veloce (100 righe, sotto i 5 secondi)", true, ms < 5000);
  c("input (300 file congelati) non mutato", true, Object.isFrozen(fileA[0]));
  // La stessa lotto con ogni riga valutata DA SOLA (come farà il server con le altre righe): stessi risultati senza doppioni.
  const righeA = righeDa(fileA);
  const altreA = V.righePerDoppioni(righeA, cxA);
  c(
    "valutaRiga con le altre righe == valutaLotto (le 100 righe)",
    true,
    righeA.every(
      (r, i) => JSON.stringify(V.valutaRiga(r, cxA, altreA)) === JSON.stringify(lotA.righe[i]),
    ),
  );

  gruppo("BULK · T10 · 301 FILE: LA RIGA IN PIÙ È «GRUPPO INCOMPLETO»");
  const file301 = [
    ...costruisci(100),
    {
      indice: 300,
      stato: "letto",
      impronta: "imp-300",
      tipo: "pagamento",
      lettura: lPag({ riferimento: "ZZ990011" }),
    },
  ];
  const lot301 = V.valutaLotto(righeDa(file301), ctx());
  c(
    "101 righe: 100 pronte e l'ultima in errore, incompleta",
    [101, 100, "errore", true],
    [
      lot301.righe.length,
      conta(lot301, "pronto"),
      lot301.righe[100].stato,
      ha(lot301.righe[100], "gruppo_incompleto", "blocca"),
    ],
  );

  gruppo(
    "BULK · T10 · SCORRIMENTO: UN FILE MANCANTE NON RIOVINA I CLIENTI DOPO (e nessuna «pronta» ha persone diverse)",
  );
  const filePieno = costruisci(100);
  const mancante = filePieno.filter((f) => f.indice !== 3 * 49); // manca l'indirizzo del cliente 49; gli indici NON si rinumerano
  const lotM = V.valutaLotto(righeDa(mancante), ctx());
  c("299 file → ancora 100 righe", 100, lotM.righe.length);
  c(
    "le prime 49 sono pronte come prima",
    true,
    lotM.righe.slice(0, 49).every((r) => r.stato === "pronto"),
  );
  c(
    "le 51 dopo il punto: nessuna pronta, nessuna emettibile nemmeno confermata",
    [0, 0],
    [
      lotM.righe.slice(49).filter((r) => r.stato === "pronto").length,
      V.valutaLotto(
        righeDa(
          mancante,
          Object.fromEntries(
            lotM.righe.map((r) => [
              r.idRiga,
              { idRiga: r.idRiga, stato: "aperta", confermata: true },
            ]),
          ),
        ),
        ctx(),
      )
        .righe.slice(49)
        .filter((r) => r.emettibile).length,
    ],
  );
  c(
    "sono 'ricomposta' e 'ordine diverso': due conferme, e la persona è diversa (blocca)",
    [true, true, true],
    [
      lotM.righe.slice(49, 99).every((r) => ha(r, "ricomposta", "conferma")),
      lotM.righe.slice(49, 99).every((r) => ha(r, "ordine_diverso", "conferma")),
      lotM.righe.slice(49, 99).every((r) => ha(r, "persone_diverse", "blocca")),
    ],
  );
  c(
    "l'ultima, con tessera e pagamento senza indirizzo, è un errore",
    "errore",
    lotM.righe[99].stato,
  );
  // Il file in più è stato caricato in posizione 30: i file dopo hanno (da subito, già al caricamento) un indice più alto di uno.
  const strayFile = [
    ...filePieno.filter((f) => f.indice <= 29),
    {
      indice: 30,
      stato: "letto",
      impronta: "imp-x",
      tipo: "altro",
      lettura: { tipo: "altro", incerti: [] },
    },
    ...filePieno.filter((f) => f.indice > 29).map((f) => ({ ...f, indice: f.indice + 1 })),
  ];
  const lotS = V.valutaLotto(righeDa(strayFile), ctx());
  c(
    "uno screenshot estraneo in mezzo: le righe dopo non sono mai «pronte» (ricomposta + ordine diverso + pagante diverso da confermare)",
    true,
    lotS.righe.slice(10).every((r) => r.stato !== "pronto" && r.stato !== "confermata"),
  );
  c(
    "… e quelle prima restano pronte",
    true,
    lotS.righe.slice(0, 10).every((r) => r.stato === "pronto"),
  );

  gruppo("BULK · T10 · DOPPIONI NEL LOTTO DI 300 FILE");
  const RIF_DOPPIO = "CRO 5550001111";
  const doppioni = {
    9: { pag: { riferimento: RIF_DOPPIO } },
    19: { pag: { riferimento: RIF_DOPPIO } },
  };
  const fileD = costruisci(100, doppioni, { pag: { data: "2026-11-12" } });
  const emesseD = [
    // cliente 29: stesso CF, stesso totale, stessa data di una fattura già emessa
    emessa({
      numero: 1,
      data: "2026-11-12",
      campi: {
        nome: persona(29).nome,
        cognome: persona(29).cognome,
        codiceFiscale: persona(29).cf,
        importo: 80 + 29 * 3.5,
      },
    }),
    // cliente 39: lo stesso screenshot del pagamento è già in una fattura di un lotto cancellato
    emessa({
      numero: 2,
      data: "2026-11-01",
      origine: { lotto: "lotto-chiuso", riga: "x", impronte: [`imp-${3 * 39 + 2}`] },
    }),
  ];
  const lotD = V.valutaLotto(righeDa(fileD), ctx({ emesse: emesseD }));
  c(
    "riferimento uguale nelle righe 10 e 20: tutte e due bloccate, con il numero dell'altra",
    [true, true, true, true],
    [
      ha(lotD.righe[9], "doppione_riferimento", "blocca"),
      ha(lotD.righe[19], "doppione_riferimento", "blocca"),
      /riga 20/.test(lotD.righe[9].motivi.find((m) => m.codice === "doppione_riferimento").testo),
      /riga 10/.test(lotD.righe[19].motivi.find((m) => m.codice === "doppione_riferimento").testo),
    ],
  );
  c(
    "riga 30: sembra già fatturata (conferma); riga 40: stesso screenshot (blocca)",
    [true, true],
    [
      ha(lotD.righe[29], "doppione_pagamento", "conferma"),
      ha(lotD.righe[39], "doppione_screenshot", "blocca"),
    ],
  );
  c(
    "le altre 96 righe sono pronte",
    [96, [9, 19, 29, 39]],
    [
      conta(lotD, "pronto"),
      lotD.righe.map((r, i) => (r.stato === "pronto" ? -1 : i)).filter((i) => i >= 0),
    ],
  );
  const sc = V.valutaLotto(
    righeDa(fileD, {
      [lotD.righe[19].idRiga]: { idRiga: lotD.righe[19].idRiga, stato: "scartata" },
    }),
    ctx({ emesse: emesseD }),
  );
  c(
    "scartata la riga 20, la riga 10 si libera",
    [false, "scartata"],
    [ha(sc.righe[9], "doppione_riferimento"), sc.righe[19].stato],
  );
  c(
    "quanto alle date: nessuna emessa più recente → nessuna riga con data anteriore",
    [],
    lotD.fatti.righeDataAnteriore.slice(0, 0),
  );
  const conRecente = V.valutaLotto(
    righeDa(costruisci(3)),
    ctx({ emesse: [emessa({ numero: 9, data: "2026-11-11" })] }),
  );
  c(
    "fatti sulle date con una emessa del 11/11: ultima emessa e righe con data anteriore",
    [9, "2026-11-11", ["0000-0001-0002"]],
    [
      conRecente.fatti.ultimaEmessa.numero,
      conRecente.fatti.ultimaEmessa.data,
      conRecente.fatti.righeDataAnteriore.filter((id) => id === "0000-0001-0002"),
    ],
  );

  gruppo("BULK · T10 · IL CASO GRANDE: 200 CLIENTI (600 FILE) E 1.500 FATTURE GIÀ EMESSE");
  const emesseMolte = Array.from({ length: 1500 }, (_, i) =>
    emessa({
      numero: i + 1,
      data: "2026-10-01",
      campi: {
        nome: "Zeta",
        cognome: `Altro${i}`,
        codiceFiscale: cfConControllo("LTRZTA90C41L219"),
        importo: 50 + (i % 40),
      },
      riferimento: `OLD${100000 + i}`,
    }),
  );
  const t1 = Date.now();
  const lotG = V.valutaLotto(righeDa(costruisci(200)), ctx({ emesse: emesseMolte }));
  const msG = Date.now() - t1;
  c("200 righe valutate", 200, lotG.righe.length);
  c(
    "nessuna riga è bloccata dalle emesse vecchie (riferimenti diversi, altro CF)",
    0,
    lotG.righe.filter((r) => ha(r, "doppione_riferimento") || ha(r, "doppione_screenshot")).length,
  );
  c(
    "sono pronte salvo quelle che chiedono conferma (CF e data già usati: avvisi, non blocchi)",
    true,
    lotG.righe.every((r) => r.stato === "pronto" || r.stato === "da_controllare"),
  );
  c("abbastanza veloce (sotto i 30 secondi)", true, msG < 30000);

  gruppo("BULK · T10 · valutaRigaNelLotto: L'ENTRATA DEL SERVER VEDE SEMPRE I DOPPIONI FRA RIGHE");
  const fileDoppie = [
    ...fileDi(0, { pag: lPag({ riferimento: "CRO 1234567890" }) }),
    ...fileDi(1, {
      ind: lInd({ nome: "Anna", cognome: "Neri" }),
      tes: lTes({
        nome: "Anna",
        cognome: "Neri",
        codiceFiscale: cfConControllo("NRENNA90C41L219"),
        cfLetto: cfConControllo("NRENNA90C41L219"),
      }),
      pag: lPag({ riferimento: "CRO 1234567890", paganteCognome: "Neri", data: "2026-11-09" }),
    }),
  ];
  const righeDoppie = righeDa(fileDoppie);
  const solo = V.valutaRigaNelLotto(righeDoppie[0].gruppo.idRiga, righeDoppie, ctx());
  c(
    "una riga sola, valutata nel lotto: vede il CRO uguale di un'altra riga",
    [true, false],
    [ha(solo, "doppione_riferimento", "blocca"), solo.emettibile],
  );
  c(
    "… e coincide con quella calcolata da valutaLotto",
    JSON.stringify(V.valutaLotto(righeDoppie, ctx()).righe[0]),
    JSON.stringify(solo),
  );
  const fileImp = [...fileDi(0), ...fileDi(1, { pag: lPag({ riferimento: "ALTRO 99887766" }) })];
  fileImp[5] = { ...fileImp[5], impronta: "imp-2" };
  const soloImp = V.valutaRigaNelLotto(righeDa(fileImp)[0].gruppo.idRiga, righeDa(fileImp), ctx());
  c(
    "… e anche lo stesso screenshot del pagamento in un'altra riga",
    true,
    ha(soloImp, "doppione_screenshot", "blocca"),
  );
  c(
    "un id che non è nel lotto è un errore, non un risultato",
    true,
    (() => {
      try {
        V.valutaRigaNelLotto("9999", righeDoppie, ctx());
        return false;
      } catch {
        return true;
      }
    })(),
  );

  gruppo(
    "BULK · T10 · APPENA PASSATA LA MEZZANOTTE: UN MOTIVO CHE LO DICE (OGGI() di xml.ts è in UTC)",
  );
  // Per T3 la data di oggi (italiana) va bene; xml.ts guarda l'orologio UTC e la vede nel futuro. Si simula con un «oggi» lontano.
  const mezzanotte = una(
    { pag: lPag({ data: "2098-12-31" }) },
    ctx({ oggi: "2099-01-01" }),
    aperta({ confermata: true, confermeAvvisi: ["anno_diverso"] }),
  );
  c(
    "data = oggi per l'Italia ma futura per xml.ts: motivo dedicato, non «data nel futuro»",
    [true, false, false],
    [
      ha(mezzanotte, "xml_dopo_mezzanotte", "blocca"),
      ha(mezzanotte, "xml_bloccante"),
      mezzanotte.emettibile,
    ],
  );
  c(
    "il testo parla di mezzanotte e dice di riprovare",
    true,
    /mezzanotte/.test(
      mezzanotte.motivi.find((m) => m.codice === "xml_dopo_mezzanotte")?.testo ?? "",
    ) &&
      /riprova/i.test(
        mezzanotte.motivi.find((m) => m.codice === "xml_dopo_mezzanotte")?.testo ?? "",
      ),
  );
  c(
    "una data VERAMENTE futura resta «data_futura» (regola di riga), senza il motivo della mezzanotte",
    [true, false],
    ((r) => [ha(r, "data_futura", "blocca"), ha(r, "xml_dopo_mezzanotte")])(
      una({ pag: lPag({ data: "2026-11-13" }) }),
    ),
  );
}
