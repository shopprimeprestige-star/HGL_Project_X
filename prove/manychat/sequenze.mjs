/** ── PROVE: LE SEQUENZE: LEAD NUOVO E GIORNO DEL MEET ───────────────────────────────────────────────
 *
 *  Commessa 2026-10-25 (Sheets e sequenze WhatsApp), compito Q. Le regole di
 *  `sequenze.ts`: primo contatto subito (9-20, lun-sab, ora di Roma), richiamo a
 *  24 h con la sua unica eccezione al freno, mattina e ora esatta del giorno del
 *  meet, tetti con la riserva per gli appuntamenti, consenso del modulo legato
 *  alla frase. Tutte funzioni pure: l'orologio entra come argomento.
 *
 *  Date di riferimento (Roma): sabato 24 ottobre 2026 è ora legale (+02:00);
 *  domenica 25 ottobre alle 03:00 torna l'ora solare (+01:00). Martedì 27/10,
 *  mercoledì 28/10, lunedì 26/10. Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
export async function proveSequenze(mod, { c, gruppo }) {
  const S = mod["manychat/sequenze"];
  const Q = mod["manychat/quando"];
  const R = mod["manychat/regole"];
  const T = mod["manychat/testi"];

  const t = (iso) => new Date(iso);
  const MIN = 60_000;
  const tel = (n) => `333 000 ${String(n).padStart(4, "0")}`;
  const t9 = (n) => `33000${String(n).padStart(4, "0")}`;
  const num = (n) => `39333000${String(n).padStart(4, "0")}`;
  const tipi = (r) => r.map((x) => x.tipo);
  const motivi = (r) => r.map((x) => x.motivo);
  const unica = (r) => (r.length === 1 ? r[0] : null);

  const consulenti = [
    {
      id: "cons-1",
      data: { nome: "Filippo Demo", attivo: true, faConsulente: true, faSetter: false },
    },
  ];
  /** la frase del consenso è nel modulo dal 20/10; «Lead nuovo» acceso il 20/10 alle 08:00 (Roma) */
  const FRASE = "2026-10-20T00:00:00.000Z";
  const DAL = "2026-10-20T06:00:00.000Z";
  const TETTI = { ricontatti: 20, leadNuovi: 30, totale: 100 };

  /* ── schede inventate ──────────────────────────────────────────────────── */
  /** un lead arrivato dal foglio all'istante `il` (ISO), col modulo dello stesso istante */
  const nuovo = (id, n, il, extra) => ({
    id,
    data: {
      nome: "Anna",
      cognome: "Prova",
      telefono: tel(n),
      stato: "da_contattare",
      importato: true,
      consensoModulo: { whatsapp: true, il, via: "modulo_meta", fonte: "google_sheets" },
      origineIngresso: { via: "google_sheets", foglio: "Lead HGL", il },
      ...extra,
    },
  });
  const ctxL = (extra) => ({
    consulenti,
    invii: [],
    tetti: TETTI,
    fraseModuloDal: FRASE,
    leadNuovoDal: DAL,
    ...extra,
  });
  const lead = (schede, adesso, extra) => S.decidiLeadNuovi(schede, t(adesso), ctxL(extra));
  /** una riga del registro */
  const invio = (n, tipo, prenotatoIl, extra) => ({
    telefono: num(n),
    tipo,
    stato: "inviato",
    prenotatoIl,
    ...extra,
  });
  const righeOggi = (quanti, tipo, extra) =>
    Array.from({ length: quanti }, (_, i) => ({
      telefono: `3933400${String(i).padStart(5, "0")}`,
      tipo,
      stato: "inviato",
      prenotatoIl: "2026-10-27T07:00:00.000Z",
      rispostaIl: "2026-10-27T07:05:00.000Z",
      ...extra,
    }));

  /* ════════════════════════════════════════════════════════════════════════
   *  PRIMO CONTATTO
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · LEAD NUOVO: IL PRIMO CONTATTO (sequenze.ts)");

  // Martedì 27/10 alle 10:00 Roma (+01:00) = 09:00Z.
  const MAR10 = "2026-10-27T10:00:00+01:00";
  const arrivato10 = nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z");
  const subito = unica(lead([arrivato10], MAR10));
  c(
    "arrivato alle 10:00 di martedì → primo contatto subito, chiave n|tel9",
    ["invia", `n|${t9(1)}`, "primo_contatto"],
    [subito?.tipo, subito?.chiave, subito?.extra.quale],
  );
  c("…la scheda è quella giusta", "lead-1", subito?.scheda.id);

  //  Fuori orario.
  const sabato21 = nuovo("lead-1", 1, "2026-10-24T19:00:00.000Z"); // sabato 21:00 Roma (+02:00)
  const aSab = unica(lead([sabato21], "2026-10-24T21:00:00+02:00"));
  c(
    "arrivato sabato alle 21:00 → aspetta: parte alle 09:00 di lunedì 26 ottobre",
    ["aspetta", "parte alle 09:00 di lunedì 26 ottobre"],
    [aSab?.tipo, aSab?.motivo],
  );
  c(
    "…di domenica a mezzogiorno è ancora lunedì",
    ["aspetta", "parte alle 09:00 di lunedì 26 ottobre"],
    ((x) => [x?.tipo, x?.motivo])(unica(lead([sabato21], "2026-10-25T12:00:00+01:00"))),
  );
  c(
    "…lunedì alle 08:59 aspetta ancora, alle 09:00 (ora solare: 08:00Z) parte",
    [["aspetta"], ["invia"]],
    [
      tipi(lead([sabato21], "2026-10-26T08:59:00+01:00")),
      tipi(lead([sabato21], "2026-10-26T09:00:00+01:00")),
    ],
  );
  c(
    "martedì alle 07:00 → aspetta: parte alle 09:00 dello stesso giorno",
    ["aspetta", "parte alle 09:00 di martedì 27 ottobre"],
    ((x) => [x?.tipo, x?.motivo])(
      unica(lead([nuovo("lead-1", 1, "2026-10-27T05:30:00.000Z")], "2026-10-27T07:00:00+01:00")),
    ),
  );
  c(
    "alle 19:59 parte, alle 20:00 no (la finestra chiude alle 20:00 esclusa)",
    [["invia"], ["aspetta"]],
    [
      tipi(lead([nuovo("lead-1", 1, "2026-10-27T17:00:00.000Z")], "2026-10-27T19:59:00+01:00")),
      tipi(lead([nuovo("lead-1", 1, "2026-10-27T17:00:00.000Z")], "2026-10-27T20:00:00+01:00")),
    ],
  );

  //  Chi non è un lead nuovo.
  c(
    "arrivato PRIMA dell'ultima accensione di «Lead nuovo» → mai",
    [],
    lead([nuovo("lead-1", 1, "2026-10-20T05:00:00.000Z")], MAR10, {
      leadNuovoDal: "2026-10-27T08:00:00.000Z",
    }),
  );
  c(
    "interruttore mai acceso (nessuna data) → niente",
    [],
    lead([arrivato10], MAR10, { leadNuovoDal: null }),
  );
  c(
    "arrivato da più di 72 ore → mai",
    [],
    lead([nuovo("lead-1", 1, "2026-10-24T08:59:00.000Z")], MAR10),
  );
  c(
    "…a 71 ore è ancora buono",
    ["invia"],
    tipi(lead([nuovo("lead-1", 1, "2026-10-24T10:00:00.000Z")], MAR10)),
  );
  //  Una lista Meta di 4 giorni fa caricata oggi da file: entra oggi, ma il modulo è vecchio.
  const daFile = (il, extra) => ({
    id: "lead-1",
    data: {
      nome: "Anna",
      telefono: tel(1),
      stato: "da_contattare",
      importato: true,
      consensoModulo: { whatsapp: true, il, via: "modulo_meta", fonte: "csv_meta" },
      listaOrigine: { file: "lista_meta.csv", il: "2026-10-27T08:30:00.000Z", dataDalFile: true },
      ...extra,
    },
  });
  c(
    "modulo di 4 giorni fa caricato oggi da file → mai",
    [],
    lead([daFile("2026-10-23T09:00:00.000Z")], MAR10),
  );
  c(
    "…modulo di ieri caricato oggi da file (entra dopo l'accensione) → parte",
    ["invia"],
    tipi(lead([daFile("2026-10-26T09:00:00.000Z")], MAR10)),
  );
  c(
    "scheda senza modulo Meta (nemmeno «via») → non è un lead nuovo",
    [[], []],
    [
      lead(
        [
          nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", {
            consensoModulo: { whatsapp: true, il: "2026-10-27T09:00:00.000Z" },
          }),
        ],
        MAR10,
      ),
      lead([nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", { consensoModulo: undefined })], MAR10),
    ],
  );
  c(
    "stato «appuntamento fissato» o una data di meet → mai",
    [[], []],
    [
      lead(
        [nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", { stato: "appuntamento_fissato" })],
        MAR10,
      ),
      lead([nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", { dataMeeting: "2026-10-29" })], MAR10),
    ],
  );
  c(
    "«non risponde» e «segreteria» restano lead nuovi",
    [["invia"], ["invia"]],
    ["non_risponde", "segreteria"].map((stato) =>
      tipi(lead([nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", { stato })], MAR10)),
    ),
  );
  c(
    "ha già risposto (secondo stato «Ha risposto») → mai",
    [],
    lead(
      [
        nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", {
          contattoWa: { stato: "ha_risposto", il: "2026-10-27T09:05:00.000Z", da: "automatico" },
        }),
      ],
      MAR10,
    ),
  );
  const chat = (prenotatoIl) => invio(1, "chat", prenotatoIl);
  c(
    "la setter gli ha scritto a mano dopo l'ingresso → mai",
    [],
    lead([arrivato10], MAR10, { invii: [chat("2026-10-27T09:04:00.000Z")] }),
  );
  c(
    "…una chat di prima dell'ingresso non conta",
    ["invia"],
    tipi(lead([arrivato10], MAR10, { invii: [chat("2026-10-20T09:04:00.000Z")] })),
  );
  c(
    "il primo contatto parte una volta per numero: con n|tel9 già nel registro non c'è un secondo primo contatto",
    false,
    lead([arrivato10], "2026-10-27T10:30:00+01:00", {
      invii: [invio(1, "primo_contatto", "2026-10-27T09:00:30.000Z", { chiave: `n|${t9(1)}` })],
    }).some((x) => x.chiave === `n|${t9(1)}`),
  );

  //  Consenso: la frase nel modulo.
  c(
    "STOP → salta, e dice STOP",
    ["salta", "STOP"],
    ((x) => [x?.tipo, x?.motivo])(
      unica(
        lead(
          [
            nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", {
              contattoWa: { stato: "stop", il: "2026-10-27T09:05:00.000Z", da: "automatico" },
            }),
          ],
          MAR10,
        ),
      ),
    ),
  );
  c(
    "revoca («Ok a WhatsApp» spento) batte il modulo → salta",
    ["salta", "manca il consenso WhatsApp"],
    ((x) => [x?.tipo, x?.motivo])(
      unica(
        lead(
          [
            nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", {
              okWhatsapp: { si: false, il: "2026-10-27T09:10:00.000Z", da: "Giulia" },
            }),
          ],
          MAR10,
        ),
      ),
    ),
  );
  c(
    "frase non segnata (null) → il modulo non vale per nessuno",
    ["salta", "manca il consenso WhatsApp"],
    ((x) => [x?.tipo, x?.motivo])(unica(lead([arrivato10], MAR10, { fraseModuloDal: null }))),
  );
  c(
    "modulo del 19/10 con la frase del 20/10 → non vale; del 20/10 alle 00:00 (uguale) → vale",
    [["salta"], ["invia"]],
    [
      tipi(
        lead([nuovo("lead-1", 1, "2026-10-19T23:59:00.000Z")], "2026-10-19T23:59:30.000Z", {
          leadNuovoDal: "2026-10-19T00:00:00.000Z",
        }),
      ),
      tipi(
        lead([nuovo("lead-1", 1, "2026-10-20T00:00:00.000Z")], "2026-10-20T10:00:30.000Z", {
          leadNuovoDal: "2026-10-19T00:00:00.000Z",
        }),
      ),
    ],
  );
  const senzaData = nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", {
    consensoModulo: { whatsapp: true, il: null, via: "modulo_meta", fonte: "csv_meta" },
  });
  c(
    "CSV Meta senza data del modulo (il = null), caricato dopo la frase → nessun consenso, nessun invio",
    ["salta", "manca il consenso WhatsApp"],
    ((x) => [x?.tipo, x?.motivo])(unica(lead([senzaData], MAR10))),
  );
  c(
    "…un «Ok a WhatsApp» a voce non basta a far partire la sequenza (è per chi ha lasciato il numero nel modulo)",
    [],
    lead(
      [
        nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", {
          consensoModulo: { whatsapp: true, il: null, via: "modulo_meta", fonte: "csv_meta" },
          okWhatsapp: { si: true, il: "2026-10-27T09:10:00.000Z", da: "Giulia" },
        }),
      ],
      MAR10,
    ),
  );
  c(
    "numero non valido → salta; nome mancante → salta",
    [
      ["salta", "numero non valido"],
      ["salta", "manca il nome"],
    ],
    [
      nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", { telefono: "12" }),
      nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", { nome: "  " }),
    ].map((s) => ((x) => [x?.tipo, x?.motivo])(unica(lead([s], MAR10)))),
  );

  //  Freno, ritmo, pausa.
  const prima = invio(1, "ricontatto", "2026-10-26T09:00:00.000Z", {
    chiave: `r|${t9(1)}|2026-10-26`,
  });
  c(
    "il freno vale: un messaggio automatico di ieri senza risposta → salta",
    ["salta", "aspetta ancora una risposta"],
    ((x) => [x?.tipo, x?.motivo])(unica(lead([arrivato10], MAR10, { invii: [prima] }))),
  );
  c(
    "…con la risposta passa",
    ["invia"],
    tipi(
      lead([arrivato10], MAR10, { invii: [{ ...prima, rispostaIl: "2026-10-26T09:30:00.000Z" }] }),
    ),
  );
  c(
    "il ritmo di 27-33' NON lo aspetta: prossimo ricontatto fra 20 minuti, parte lo stesso",
    ["invia"],
    tipi(lead([arrivato10], MAR10, { prossimoDopo: new Date(t(MAR10).getTime() + 20 * MIN) })),
  );
  c(
    "pausa per contatto: un invio a questo numero 60 secondi fa → aspetta",
    ["aspetta"],
    tipi(
      lead([arrivato10], MAR10, {
        invii: [invio(1, "chat", "2026-10-27T08:59:00.000Z", { stato: "inviato" })].map((i) => ({
          ...i,
          prenotatoIl: "2026-10-27T08:59:30.000Z",
        })),
      }),
    ),
  );

  //  Tetti.
  const ventinove = righeOggi(29, "primo_contatto");
  c(
    "30 lead nuovi al giorno: il 30° passa, il 31° → domani",
    [["invia"], ["aspetta", "tetto dei lead nuovi di oggi raggiunto: se ne parla domani"]],
    [
      tipi(lead([arrivato10], MAR10, { invii: ventinove })),
      ((x) => [x?.tipo, x?.motivo])(
        unica(lead([arrivato10], MAR10, { invii: righeOggi(30, "primo_contatto") })),
      ),
    ],
  );
  c(
    "…richiami e primi contatti contano insieme, e quelli di ieri no",
    [["aspetta"], ["invia"]],
    [
      tipi(
        lead([arrivato10], MAR10, {
          invii: [...righeOggi(15, "primo_contatto"), ...righeOggi(15, "richiamo_24h")],
        }),
      ),
      tipi(
        lead([arrivato10], MAR10, {
          invii: righeOggi(40, "primo_contatto", { prenotatoIl: "2026-10-26T07:00:00.000Z" }),
        }),
      ),
    ],
  );
  c(
    "il riquadro a 500 vale 30 (tettiDelGiorno)",
    30,
    Q.tettiDelGiorno({ leadNuovi: 500, totale: 500 }, "2026-09-01T00:00:00.000Z", t(MAR10))
      .leadNuovi,
  );
  c(
    "il totale 100 conta gli otto tipi: 70 messaggi di oggi (riserva 30) fermano il primo contatto, 69 no",
    [["aspetta"], ["invia"]],
    [
      tipi(lead([arrivato10], MAR10, { invii: righeOggi(70, "meet_adesso") })),
      tipi(lead([arrivato10], MAR10, { invii: righeOggi(69, "meet_adesso") })),
    ],
  );
  c(
    "totale abbassato a 40: il primo contatto si ferma a 10 messaggi di oggi",
    [["invia"], ["aspetta"]],
    [
      tipi(
        lead([arrivato10], MAR10, {
          tetti: { ...TETTI, totale: 40 },
          invii: righeOggi(9, "ricontatto"),
        }),
      ),
      tipi(
        lead([arrivato10], MAR10, {
          tetti: { ...TETTI, totale: 40 },
          invii: righeOggi(10, "ricontatto"),
        }),
      ),
    ],
  );
  c(
    "conferme e chat non contano nel totale",
    ["invia"],
    tipi(
      lead([arrivato10], MAR10, {
        invii: [...righeOggi(80, "conferma"), ...righeOggi(80, "chat")],
      }),
    ),
  );

  //  Doppioni e ordine.
  const gemella = nuovo("lead-0", 1, "2026-10-27T09:00:00.000Z");
  c(
    "due schede con lo stesso telefono fanno UNA voce",
    1,
    lead([arrivato10, gemella], MAR10).length,
  );
  const vecchio = nuovo("lead-b", 2, "2026-10-26T09:00:00.000Z");
  c(
    "chi aspetta da più tempo tocca per primo",
    ["lead-b", "lead-1"],
    lead([arrivato10, vecchio], MAR10).map((x) => x.scheda.id),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  RICHIAMO A 24 ORE
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · LEAD NUOVO: IL RICHIAMO A 24 ORE");

  //  Il primo è partito martedì 27/10 alle 10:00 Roma (09:00Z), senza risposta.
  const primoMar = (extra) =>
    invio(1, "primo_contatto", "2026-10-27T09:00:00.000Z", { chiave: `n|${t9(1)}`, ...extra });
  const richiamo = (adesso, extra, scheda = arrivato10) =>
    lead([scheda], adesso, { invii: [primoMar()], ...extra });

  const mer10 = unica(richiamo("2026-10-28T10:00:00+01:00"));
  c(
    "24 ore dopo, senza risposta → richiamo, chiave n24|tel9",
    ["invia", `n24|${t9(1)}`, "richiamo_24h"],
    [mer10?.tipo, mer10?.chiave, mer10?.extra.quale],
  );
  c(
    "…un minuto prima aspetta e dice quando",
    ["aspetta", "richiamo: parte alle 10:00 di mercoledì 28 ottobre"],
    ((x) => [x?.tipo, x?.motivo])(unica(richiamo("2026-10-28T09:59:00+01:00"))),
  );
  c(
    "…il giorno stesso, dopo la prima mezz'ora, aspetta (non è mai un secondo messaggio ravvicinato)",
    ["aspetta"],
    tipi(richiamo("2026-10-27T10:30:00+01:00")),
  );
  c(
    "…ha risposto (risposta sul primo, o «Ha risposto» sulla scheda, o cambio a mano) → niente",
    [[], [], []],
    [
      richiamo("2026-10-28T10:00:00+01:00", {
        invii: [primoMar({ rispostaIl: "2026-10-27T15:00:00.000Z" })],
      }),
      richiamo(
        "2026-10-28T10:00:00+01:00",
        {},
        nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", {
          contattoWa: { stato: "ha_risposto", il: "2026-10-27T15:00:00.000Z", da: "automatico" },
        }),
      ),
      richiamo("2026-10-28T10:00:00+01:00", {
        invii: [primoMar({ sbloccatoIl: "2026-10-27T15:00:00.000Z" })],
      }),
    ],
  );
  c(
    "…meet fissato o stato che non è più «nuovo» → niente",
    [[], []],
    [
      richiamo(
        "2026-10-28T10:00:00+01:00",
        {},
        nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", { dataMeeting: "2026-10-30" }),
      ),
      richiamo(
        "2026-10-28T10:00:00+01:00",
        {},
        nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", { stato: "appuntamento_fissato" }),
      ),
    ],
  );
  c(
    "…STOP e revoca fermano anche il richiamo",
    [
      ["salta", "STOP"],
      ["salta", "manca il consenso WhatsApp"],
    ],
    [
      richiamo(
        "2026-10-28T10:00:00+01:00",
        {},
        nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", {
          contattoWa: { stato: "stop", il: "2026-10-27T15:00:00.000Z", da: "automatico" },
        }),
      ),
      richiamo(
        "2026-10-28T10:00:00+01:00",
        {},
        nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", {
          okWhatsapp: { si: false, il: "2026-10-27T15:00:00.000Z", da: "G" },
        }),
      ),
    ].map((r) => ((x) => [x?.tipo, x?.motivo])(unica(r))),
  );
  c(
    "primo contatto «incerto», «fallito» o «saltato» → il richiamo non parte",
    [false, false, false],
    ["incerto", "fallito", "saltato"].map((stato) =>
      richiamo("2026-10-28T10:00:00+01:00", { invii: [primoMar({ stato })] }).some(
        (x) => x.tipo === "invia",
      ),
    ),
  );
  c(
    "un altro messaggio automatico DOPO il primo (anche d'un altro tipo) → sequenza finita, nessun richiamo",
    [false, true],
    ((r) => [r.some((x) => x.tipo === "invia"), /sequenza finita/.test(motivi(r).join())])(
      richiamo("2026-10-28T10:00:00+01:00", {
        invii: [
          primoMar(),
          invio(1, "ricontatto", "2026-10-27T14:00:00.000Z", { chiave: `r|${t9(1)}|2026-10-27` }),
        ],
      }),
    ),
  );
  c(
    "…una chat a mano dopo il primo → niente",
    [],
    richiamo("2026-10-28T10:00:00+01:00", {
      invii: [primoMar(), chat("2026-10-27T14:00:00.000Z")],
    }),
  );
  c(
    "dopo il richiamo nessun terzo messaggio (la sequenza è chiusa) e il freno torna a valere",
    [[], true],
    [
      richiamo("2026-10-28T11:00:00+01:00", {
        invii: [
          primoMar(),
          invio(1, "richiamo_24h", "2026-10-28T09:00:00.000Z", { chiave: `n24|${t9(1)}` }),
        ],
      }),
      R.aspettaRisposta(
        num(1),
        [
          primoMar(),
          invio(1, "richiamo_24h", "2026-10-28T09:00:00.000Z", { chiave: `n24|${t9(1)}` }),
        ],
        undefined,
        t("2026-10-28T10:00:00+01:00"),
      ),
    ],
  );

  //  Sabato → lunedì, e il cambio dell'ora.
  const primoSab = (extra) =>
    invio(1, "primo_contatto", "2026-10-24T09:00:00.000Z", { chiave: `n|${t9(1)}`, ...extra }); // sabato 11:00 (+02:00)
  const schedaSab = nuovo("lead-1", 1, "2026-10-24T08:50:00.000Z");
  const ric = (adesso) => lead([schedaSab], adesso, { invii: [primoSab()] });
  c(
    "primo di sabato 11:00 → richiamo lunedì 11:00 (la domenica salta; ora solare dopo il cambio: 10:00Z)",
    [["aspetta"], ["aspetta"], ["aspetta"], ["invia"]],
    [
      tipi(ric("2026-10-25T11:00:00+01:00")),
      tipi(ric("2026-10-26T09:30:00+01:00")),
      tipi(ric("2026-10-26T10:59:00+01:00")),
      tipi(ric("2026-10-26T11:00:00+01:00")),
    ],
  );
  c(
    "…lunedì 11:00 sono 49 ore dopo il primo (24/10 09:00Z → 26/10 10:00Z)",
    49,
    (t("2026-10-26T10:00:00.000Z") - t("2026-10-24T09:00:00.000Z")) / 3_600_000,
  );
  c(
    "…la domenica non parte mai niente, nemmeno a mezzogiorno",
    "parte alle 11:00 di lunedì 26 ottobre",
    (unica(ric("2026-10-25T12:00:00+01:00"))?.motivo ?? "").replace("richiamo: ", ""),
  );

  //  Scadenza e fuori orario.
  c(
    "oltre bersaglio + 48 ore → «saltato: richiamo scaduto»",
    ["salta", "saltato: richiamo scaduto"],
    ((x) => [x?.tipo, x?.motivo])(unica(richiamo("2026-10-30T10:01:00+01:00"))),
  );
  c("…a 48 ore esatte è ancora buono", ["invia"], tipi(richiamo("2026-10-30T10:00:00+01:00")));
  c(
    "fuori orario (mercoledì 20:30) → aspetta alle 09:00 di giovedì, e giovedì alle 09:00 parte",
    [["aspetta", "richiamo: parte alle 09:00 di giovedì 29 ottobre"], ["invia"]],
    [
      ((x) => [x?.tipo, x?.motivo])(unica(richiamo("2026-10-28T20:30:00+01:00"))),
      tipi(richiamo("2026-10-29T09:00:00+01:00")),
    ],
  );
  c(
    "il richiamo aspetta il ritmo (e lo prende): prossimo fra 10 minuti → aspetta; già passato → invia",
    [["aspetta"], ["invia"]],
    [
      tipi(richiamo("2026-10-28T10:00:00+01:00", { prossimoDopo: t("2026-10-28T10:10:00+01:00") })),
      tipi(richiamo("2026-10-28T10:00:00+01:00", { prossimoDopo: t("2026-10-28T09:59:00+01:00") })),
    ],
  );
  c(
    "il richiamo conta nei 30 lead nuovi al giorno",
    ["aspetta"],
    tipi(
      richiamo("2026-10-28T10:00:00+01:00", {
        invii: [
          primoMar(),
          ...righeOggi(30, "richiamo_24h", { prenotatoIl: "2026-10-28T07:00:00.000Z" }),
        ],
      }),
    ),
  );
  c(
    "…e rispetta la pausa per contatto",
    ["aspetta"],
    tipi(
      richiamo("2026-10-28T10:00:00+01:00", {
        invii: [primoMar(), invio(1, "webinar", "2026-10-28T08:59:30.000Z")],
      }),
    ),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  GIORNO DEL MEET
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIORNO DEL MEET: LA MATTINA E L'ORA ESATTA");

  const okWa = { si: true, il: "2026-10-01T09:00:00.000Z", da: "Filippo Demo" };
  const meet = (id, n, ora, extra) => ({
    id,
    data: {
      nome: "Anna",
      cognome: "Prova",
      telefono: tel(n),
      consulenteId: "cons-1",
      okWhatsapp: okWa,
      stato: "appuntamento_fissato",
      dataMeeting: "2026-10-27",
      oraMeeting: ora,
      linkMeeting: "https://example.test/meetly/abc123",
      ...extra,
    },
  });
  const ctxM = (extra) => ({
    consulenti,
    invii: [],
    tetti: TETTI,
    fraseModuloDal: FRASE,
    ...extra,
  });
  const giorno = (schede, adesso, extra) => S.decidiGiornoMeet(schede, t(adesso), ctxM(extra));
  const alle = (hhmm, ymd = "2026-10-27") => `${ymd}T${hhmm}:00+01:00`;
  const m18 = meet("lead-m", 1, "18:00");
  const chiaveO = (ora, ymd = "2026-10-27") => `o|${t9(1)}|${ymd}T${ora}`;
  const chiaveA = (ora, ymd = "2026-10-27") => `a|${t9(1)}|${ymd}T${ora}`;
  const quali = (r) => r.filter((x) => x.tipo === "invia").map((x) => x.extra.quale);

  //  Meet delle 18:00.
  const mattina = giorno([m18], alle("09:00"));
  c(
    "meet 18:00, ore 09:00 → messaggio del mattino, chiave o|tel9|AAAA-MM-GGTHH:MM",
    [["invia", chiaveO("18:00"), "meet_oggi"], 1],
    [
      [mattina[0]?.tipo, mattina[0]?.chiave, mattina[0]?.extra.quale],
      mattina.filter((x) => x.tipo === "invia").length,
    ],
  );
  c(
    "…con l'inizio del meet come istante vero",
    t("2026-10-27T18:00:00+01:00").toISOString(),
    mattina[0]?.extra.inizioMeet.toISOString(),
  );
  c(
    "…alle 08:59 aspetta: parte alle 09:00",
    ["aspetta", "messaggio del mattino: parte alle 09:00"],
    ((x) => [x?.tipo, x?.motivo])(
      giorno([m18], alle("08:59")).find((x) => /mattino/.test(x.motivo ?? "")),
    ),
  );
  c(
    "…resta valido finché mancano 40 minuti (17:20) e poi salta: c'è già il promemoria",
    [["meet_oggi"], "saltato: c'è già il promemoria"],
    [
      quali(giorno([m18], alle("17:20"))),
      giorno([m18], alle("17:21")).find((x) => x.tipo === "salta")?.motivo,
    ],
  );
  c(
    "…già partito (stessa chiave) non riparte e non fa rumore sulla mattina",
    false,
    giorno([m18], alle("10:00"), {
      invii: [invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") })],
    }).some((x) => x.chiave === chiaveO("18:00") || /mattino|promemoria/.test(x.motivo ?? "")),
  );
  c(
    "il promemoria dei 25' parte alle 17:35 anche con la mattina senza risposta (nessun freno)",
    ["invia"],
    tipi(
      Q.decidiPromemoria([m18], t(alle("17:35")), {
        consulenti,
        invii: [invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") })],
        tetti: TETTI,
        fraseModuloDal: FRASE,
      }),
    ),
  );

  //  All'ora esatta.
  const sera = (hhmm, extra) =>
    giorno([m18], alle(hhmm), extra).filter(
      (x) =>
        /all'ora|ritardo|link|meet_adesso/.test(x.motivo ?? "") || x.extra?.quale === "meet_adesso",
    );
  const adesso1800 = giorno([m18], alle("18:00")).find((x) => x.extra?.quale === "meet_adesso");
  c(
    "meet 18:00, ore 18:00 → messaggio all'ora col link, chiave a|tel9|…",
    ["invia", chiaveA("18:00")],
    [adesso1800?.tipo, adesso1800?.chiave],
  );
  c(
    "…17:59 aspetta, 18:10 parte ancora, 18:11 → saltato: giro in ritardo, un'ora dopo non fa più rumore",
    [["aspetta"], ["invia"], ["salta", "saltato: giro in ritardo"], []],
    [
      tipi(
        sera("17:59", {
          invii: [invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") })],
        }),
      ),
      tipi(sera("18:10")),
      ((x) => [x?.tipo, x?.motivo])(unica(sera("18:11"))),
      giorno([m18], alle("19:01"), {
        invii: [invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") })],
      }),
    ],
  );
  c(
    "…senza link non parte (e lo dice), ma la mattina sì",
    [["salta", "manca il link del meet"], ["meet_oggi"]],
    ((r) => [
      [r.find((x) => x.tipo === "salta")?.tipo, r.find((x) => x.tipo === "salta")?.motivo],
      quali(giorno([meet("lead-m", 1, "18:00", { linkMeeting: "chiamo io" })], alle("09:00"))),
    ])(giorno([meet("lead-m", 1, "18:00", { linkMeeting: "chiamo io" })], alle("18:00"))),
  );
  c(
    "…già partito (stessa chiave) non riparte",
    [],
    giorno([m18], alle("18:02"), {
      invii: [
        invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") }),
        invio(1, "meet_adesso", "2026-10-27T17:00:30.000Z", { chiave: chiaveA("18:00") }),
      ],
    }),
  );

  //  Meet presto la mattina.
  const m0930 = meet("lead-m", 1, "09:30");
  c(
    "meet 09:30 → il messaggio del mattino parte dalle 07:30 (non prima), e fino alle 08:50",
    [
      ["aspetta", "messaggio del mattino: parte alle 07:30"],
      ["meet_oggi"],
      ["meet_oggi"],
      ["salta"],
    ],
    [
      ((x) => [x?.tipo, x?.motivo])(
        giorno([m0930], alle("07:29")).find((x) => /mattino/.test(x.motivo ?? "")),
      ),
      quali(giorno([m0930], alle("07:30"))),
      quali(giorno([m0930], alle("08:50"))),
      giorno([m0930], alle("08:51"))
        .filter((x) => x.tipo === "salta")
        .map((x) => x.tipo),
    ],
  );
  const m0800 = meet("lead-m", 1, "08:00");
  c(
    "meet 08:00 → niente messaggio del mattino, a nessuna ora (c'è già il promemoria)",
    [false, false, false],
    ["06:00", "07:30", "07:45"].map((o) => quali(giorno([m0800], alle(o))).includes("meet_oggi")),
  );
  c(
    "meet 10:00 → il mattino parte dalle 09:00 (non dalle 07:30) e fino alle 09:20",
    [["aspetta"], ["meet_oggi"], ["meet_oggi"], ["salta"]],
    [
      giorno([meet("lead-m", 1, "10:00")], alle("08:00"))
        .filter((x) => /mattino/.test(x.motivo ?? ""))
        .map((x) => x.tipo),
      quali(giorno([meet("lead-m", 1, "10:00")], alle("09:00"))),
      quali(giorno([meet("lead-m", 1, "10:00")], alle("09:20"))),
      giorno([meet("lead-m", 1, "10:00")], alle("09:21"))
        .filter((x) => x.tipo === "salta")
        .map((x) => x.tipo),
    ],
  );

  //  Salti.
  c(
    "la conferma del 22/10 è partita oggi (meet preso stamattina) → niente messaggio del mattino; quella di ieri non conta",
    [false, true],
    [
      quali(
        giorno([m18], alle("09:00"), { invii: [invio(1, "conferma", "2026-10-27T07:30:00.000Z")] }),
      ).includes("meet_oggi"),
      quali(
        giorno([m18], alle("09:00"), {
          invii: [
            invio(1, "conferma", "2026-10-26T07:30:00.000Z", {
              rispostaIl: "2026-10-26T07:40:00.000Z",
            }),
          ],
        }),
      ).includes("meet_oggi"),
    ],
  );
  const duePartiti = [
    invio(1, "meet_oggi", "2026-10-27T07:10:00.000Z", { chiave: chiaveO("16:00") }),
    invio(1, "meet_oggi", "2026-10-27T07:20:00.000Z", { chiave: chiaveO("17:00") }),
  ];
  c(
    "già 2 messaggi del mattino a questo numero oggi (meet spostato più volte) → il terzo no",
    false,
    quali(giorno([m18], alle("09:00"), { invii: duePartiti })).includes("meet_oggi"),
  );
  c(
    "meet spostato alle 19:00: chiavi nuove, vale l'ora nuova (mattina alle 09:00, ora esatta alle 19:00)",
    [
      [chiaveO("19:00"), "meet_oggi"],
      [chiaveA("19:00"), "meet_adesso"],
    ],
    [
      ((x) => [x?.chiave, x?.extra.quale])(
        giorno([meet("lead-m", 1, "19:00")], alle("09:00")).find((x) => x.tipo === "invia"),
      ),
      ((x) => [x?.chiave, x?.extra.quale])(
        giorno([meet("lead-m", 1, "19:00")], alle("19:00"), {
          invii: [invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") })],
        }).find((x) => x.tipo === "invia"),
      ),
    ],
  );
  c(
    "annullato (stato fuori da quelli di un appuntamento), di un altro giorno, importato, senza consulente → niente",
    [[], [], [], []],
    [
      giorno([meet("x", 1, "18:00", { stato: "annullato" })], alle("09:00")),
      giorno([meet("x", 1, "18:00", { dataMeeting: "2026-10-28" })], alle("09:00")),
      giorno([meet("x", 1, "18:00", { importato: true, consulenteId: undefined })], alle("09:00")),
      giorno([meet("x", 1, "18:00", { consulenteId: undefined })], alle("09:00")),
    ],
  );
  c(
    "meet già iniziato da più di un'ora → niente; la mattina di un meet già iniziato non parte",
    [[], false],
    [
      giorno([m18], alle("19:30"), {
        invii: [
          invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") }),
          invio(1, "meet_adesso", "2026-10-27T17:00:00.000Z", { chiave: chiaveA("18:00") }),
        ],
      }),
      quali(giorno([m18], alle("19:30"))).includes("meet_oggi"),
    ],
  );

  //  Freno: nessuno dei due è frenato, ma STOP e tetto valgono.
  const ricontattoSenzaRisposta = invio(1, "ricontatto", "2026-10-27T07:00:00.000Z", {
    chiave: `r|${t9(1)}|2026-10-27`,
  });
  c(
    "NON frenati: un ricontatto senza risposta non ferma né la mattina né l'ora esatta",
    [["meet_oggi"], ["meet_adesso"]],
    [
      quali(giorno([m18], alle("09:00"), { invii: [ricontattoSenzaRisposta] })),
      quali(
        giorno([m18], alle("18:00"), {
          invii: [
            ricontattoSenzaRisposta,
            invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") }),
          ],
        }),
      ),
    ],
  );
  c(
    "…ma STOP sì",
    [
      ["salta", "STOP"],
      ["salta", "STOP"],
    ],
    ["09:00", "18:00"].map((o) =>
      ((x) => [x?.tipo, x?.motivo])(
        unica(
          giorno(
            [
              meet("lead-m", 1, "18:00", {
                contattoWa: { stato: "stop", il: "2026-10-27T06:00:00.000Z", da: "automatico" },
              }),
            ],
            alle(o),
          ),
        ),
      ),
    ),
  );
  c(
    "…revoca, numero non valido, consulente mancante: salta, una sola voce",
    [["manca il consenso WhatsApp"], ["numero non valido"], ["consulente non trovato"]],
    [
      meet("lead-m", 1, "18:00", {
        okWhatsapp: { si: false, il: "2026-10-27T06:00:00.000Z", da: "G" },
      }),
      meet("lead-m", 1, "18:00", { telefono: "12" }),
      meet("lead-m", 1, "18:00", { consulenteId: "cons-9" }),
    ].map((s) => motivi(giorno([s], alle("09:00")))),
  );
  c(
    "…il consenso del modulo prima della frase non vale nemmeno qui; dopo sì",
    [["salta"], ["invia"]],
    [
      tipi(
        giorno(
          [
            meet("lead-m", 1, "18:00", {
              okWhatsapp: undefined,
              consensoModulo: {
                whatsapp: true,
                il: "2026-10-10T09:00:00.000Z",
                via: "modulo_meta",
              },
            }),
          ],
          alle("09:00"),
        ),
      ),
      tipi(
        giorno(
          [
            meet("lead-m", 1, "18:00", {
              okWhatsapp: undefined,
              consensoModulo: {
                whatsapp: true,
                il: "2026-10-26T09:00:00.000Z",
                via: "modulo_meta",
              },
            }),
          ],
          alle("09:00"),
        ),
      ).slice(0, 1),
    ],
  );
  const oraEsatta = (invii) =>
    giorno([m18], alle("18:00"), { invii }).find(
      (x) => x.extra?.quale === "meet_adesso" || /tetto/.test(x.motivo ?? ""),
    );
  c(
    "tetto totale 100: con 99 messaggi di oggi il messaggio all'ora parte, con 100 salta (la riserva non tocca gli appuntamenti)",
    ["invia", "salta"],
    [oraEsatta(righeOggi(99, "ricontatto"))?.tipo, oraEsatta(righeOggi(100, "ricontatto"))?.tipo],
  );
  c(
    "totale abbassato a 40: 10 primi contatti di oggi → l'11° non parte, il messaggio delle 18:00 col link sì",
    [["aspetta"], ["meet_adesso"]],
    [
      tipi(
        lead([arrivato10], alle("10:00"), {
          tetti: { ...TETTI, totale: 40 },
          invii: righeOggi(10, "primo_contatto"),
        }),
      ),
      quali(
        giorno([m18], alle("18:00"), {
          tetti: { ...TETTI, totale: 40 },
          invii: [
            ...righeOggi(10, "primo_contatto"),
            invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") }),
          ],
        }),
      ),
    ],
  );
  c(
    "pausa per contatto: un invio a questo numero 30 secondi fa → aspetta",
    [["aspetta"]],
    [
      tipi(
        giorno([m18], alle("18:00"), {
          invii: [
            invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") }),
            invio(1, "chat", "2026-10-27T16:59:45.000Z"),
          ],
        }),
      ),
    ],
  );
  c(
    "due schede, stesso telefono e stesso meet → una sola voce per messaggio",
    [1, 1],
    ((r) => [
      r.filter((x) => x.extra?.quale === "meet_oggi").length,
      r.filter((x) => x.extra?.quale === "meet_adesso").length,
    ])([
      ...giorno([m18, meet("lead-z", 1, "18:00")], alle("09:00")),
      ...giorno([m18, meet("lead-z", 1, "18:00")], alle("18:00")),
    ]),
  );

  //  Il freno degli ALTRI messaggi: la mattina e l'ora esatta smettono di frenare all'inizio del meet.
  gruppo("MANYCHAT · IL FRENO E I MESSAGGI DEL GIORNO DEL MEET");
  const oFermo = invio(1, "meet_oggi", "2026-10-27T08:00:00.000Z", { chiave: chiaveO("18:00") });
  const aFermo = invio(1, "meet_adesso", "2026-10-27T17:00:30.000Z", { chiave: chiaveA("18:00") });
  c(
    "mattina senza risposta: frena i ricontatti fino all'inizio del meet, non oltre",
    [true, false],
    [
      R.aspettaRisposta(num(1), [oFermo], undefined, t(alle("17:59"))),
      R.aspettaRisposta(num(1), [oFermo], undefined, t(alle("18:00"))),
    ],
  );
  c(
    "ora esatta senza risposta: non frena mai (la scrive a meet iniziato)",
    false,
    R.aspettaRisposta(num(1), [aFermo], undefined, t(alle("18:00"))),
  );
  c(
    "…lo stesso per chiamata concordata (ch|) e appuntamento in sede (sd|)",
    [true, false, true, false],
    [
      R.aspettaRisposta(
        num(1),
        [
          invio(1, "promemoria_chiamata", "2026-10-27T10:00:00.000Z", {
            chiave: `ch|${t9(1)}|2026-10-27T17:30`,
          }),
        ],
        undefined,
        t(alle("17:00")),
      ),
      R.aspettaRisposta(
        num(1),
        [
          invio(1, "promemoria_chiamata", "2026-10-27T10:00:00.000Z", {
            chiave: `ch|${t9(1)}|2026-10-27T17:30`,
          }),
        ],
        undefined,
        t(alle("17:30")),
      ),
      R.aspettaRisposta(
        num(1),
        [
          invio(1, "promemoria_sede", "2026-10-27T10:00:00.000Z", {
            chiave: `sd|${t9(1)}|2026-10-28T11:00`,
          }),
        ],
        undefined,
        t(alle("10:59", "2026-10-28")),
      ),
      R.aspettaRisposta(
        num(1),
        [
          invio(1, "promemoria_sede", "2026-10-27T10:00:00.000Z", {
            chiave: `sd|${t9(1)}|2026-10-28T11:00`,
          }),
        ],
        undefined,
        t(alle("11:00", "2026-10-28")),
      ),
    ],
  );
  const dueRicontatti = (adesso) =>
    Q.codaRicontatti(
      [
        {
          id: "lead-r",
          data: {
            nome: "Anna",
            telefono: tel(1),
            stato: "da_ricontattare",
            dataRicontatto: "2026-10-27",
            consulenteId: "cons-1",
            okWhatsapp: okWa,
          },
        },
      ],
      t(adesso),
      "2026-10-01T00:00:00.000Z",
      { consulenti, invii: [oFermo], tetti: TETTI },
    );
  c(
    "un ricontatto dopo la mattina senza risposta: prima dell'inizio del meet è frenato, dopo parte",
    [["salta"], ["invia"]],
    [tipi(dueRicontatti(alle("17:00"))), tipi(dueRicontatti(alle("18:00")))],
  );

  //  Cambio d'ora: domenica 25/10 alle 03:00 si torna indietro di un'ora.
  gruppo("MANYCHAT · CAMBIO D'ORA (25/10/2026)");
  const dom = "2026-10-25";
  const mDom = meet("lead-m", 1, "10:00", { dataMeeting: dom });
  c(
    "meet di domenica 25/10 alle 10:00 (ora solare, 09:00Z): mattina dalle 09:00 solari (08:00Z), non prima",
    [[], ["meet_oggi"]],
    [
      quali(giorno([mDom], "2026-10-25T07:59:00.000Z")),
      quali(giorno([mDom], "2026-10-25T08:00:00.000Z")),
    ],
  );
  c(
    "…e l'ora esatta alle 10:00 solari (09:00Z)",
    [["aspetta"], ["meet_adesso"]],
    [
      tipi(
        giorno([mDom], "2026-10-25T08:59:00.000Z", {
          invii: [
            invio(1, "meet_oggi", "2026-10-25T08:00:30.000Z", { chiave: chiaveO("10:00", dom) }),
          ],
        }),
      ),
      quali(
        giorno([mDom], "2026-10-25T09:00:00.000Z", {
          invii: [
            invio(1, "meet_oggi", "2026-10-25T08:00:30.000Z", { chiave: chiaveO("10:00", dom) }),
          ],
        }),
      ),
    ],
  );
  c(
    "sabato 24/10 (ora legale) alle 20:00 +02:00 = 18:00Z → fuori orario; lunedì 09:00 solare = 08:00Z",
    ["2026-10-26T08:00:00.000Z"],
    [S.primoIstanteUtile(t("2026-10-24T18:00:00.000Z")).toISOString()],
  );
  c(
    "primoIstanteUtile: dentro la finestra resta lo stesso istante; domenica e dopo le 20 → il giorno utile dopo",
    [
      "2026-10-27T09:00:00.000Z",
      "2026-10-26T08:00:00.000Z",
      "2026-10-28T08:00:00.000Z",
      "2026-10-27T08:00:00.000Z",
    ],
    [
      S.primoIstanteUtile(t("2026-10-27T09:00:00.000Z")).toISOString(),
      S.primoIstanteUtile(t("2026-10-25T11:00:00.000Z")).toISOString(),
      S.primoIstanteUtile(t("2026-10-27T19:30:00.000Z")).toISOString(),
      S.primoIstanteUtile(t("2026-10-27T04:00:00.000Z")).toISOString(),
    ],
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  VARIABILI DEI MODELLI (testi.ts) E COSTANTI
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · LE VARIABILI DELLE SEQUENZE (testi.ts)");
  const dati = meet("lead-m", 1, "9:30").data;
  const valori = (x) => Object.values(x.campi ?? {});
  c(
    "hgl_primo_contatto e hgl_richiamo_24h → crm_v1 il nome, e basta",
    [["Anna"], ["Anna"]],
    [valori(T.campiPrimoContatto(dati)), valori(T.campiRichiamo(dati))],
  );
  c(
    "hgl_meet_oggi → nome, ora, consulente (in questo ordine)",
    ["campi", ["Anna", "09:30", "Filippo Demo"]],
    ((x) => [x.tipo, valori(x)])(T.campiMeetOggi(dati, "Filippo Demo")),
  );
  c(
    "hgl_meet_adesso → nome, consulente, link (in questo ordine)",
    ["campi", ["Anna", "Filippo Demo", T.linkPerCliente(dati)]],
    ((x) => [x.tipo, valori(x)])(T.campiMeetAdesso(dati, "Filippo Demo")),
  );
  c(
    "…il link è quello del promemoria (stessa funzione), con l'id della scheda quello «per persona»",
    [true, true],
    [
      T.linkPerCliente(dati, "lead-m") ===
        T.campiMeetAdesso(dati, "Filippo Demo", "lead-m").campi.crm_link_meet,
      T.linkPerCliente(dati, "lead-m") ===
        T.campiPromemoria(dati, "Filippo Demo", "lead-m").campi.crm_link_meet,
    ],
  );
  c(
    "mai il cognome, in nessuna delle variabili",
    false,
    [
      T.campiPrimoContatto(dati),
      T.campiRichiamo(dati),
      T.campiMeetOggi(dati, "Filippo Demo"),
      T.campiMeetAdesso(dati, "Filippo Demo"),
    ].some((x) => valori(x).join(" ").includes("Prova")),
  );
  c(
    "una variabile vuota → salta, con il motivo (Meta rifiuta i buchi)",
    [
      "manca il nome",
      "manca il nome",
      "manca l'ora del meet",
      "manca il nome del consulente",
      "manca il link del meet",
      "manca il nome del consulente",
    ],
    [
      T.campiPrimoContatto({ ...dati, nome: " " }).motivo,
      T.campiRichiamo({ ...dati, nome: "" }).motivo,
      T.campiMeetOggi({ ...dati, oraMeeting: "boh" }, "Filippo Demo").motivo,
      T.campiMeetOggi(dati, "").motivo,
      T.campiMeetAdesso({ ...dati, linkMeeting: "chiamo io" }, "Filippo Demo").motivo,
      T.campiMeetAdesso(dati, null).motivo,
    ],
  );

  gruppo("MANYCHAT · COSTANTI E ELENCHI DELLE SEQUENZE");
  c(
    "tetti: 20 ricontatti, 30 lead nuovi, 100 in tutto, riserva 30",
    [20, 30, 100, 30],
    [Q.TETTO_RICONTATTI, Q.TETTO_LEAD_NUOVI, Q.TETTO_TOTALE, Q.RISERVA_APPUNTAMENTI],
  );
  c(
    "gli otto tipi nei tetti (la conferma no); il ritmo solo per ricontatto e richiamo",
    [
      [
        "promemoria",
        "ricontatto",
        "primo_contatto",
        "richiamo_24h",
        "meet_oggi",
        "meet_adesso",
        "promemoria_chiamata",
        "promemoria_sede",
      ],
      ["ricontatto", "richiamo_24h"],
    ],
    [R.TIPI_NEI_TETTI, R.TIPI_COL_RITMO],
  );
  c(
    "i cinque messaggi di appuntamento non sono frenati",
    ["promemoria", "meet_oggi", "meet_adesso", "promemoria_chiamata", "promemoria_sede"],
    R.TIPI_SENZA_FRENO,
  );
  c("stati del lead nuovo", ["da_contattare", "non_risponde", "segreteria"], S.STATI_LEAD_NUOVO);
}
