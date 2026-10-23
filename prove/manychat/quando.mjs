/** ── PROVE: CHI TOCCA ADESSO, TETTI E RITMO ───────────────────────────────
 *
 *  File d'area della commessa 2026-10-23 (ManyChat), compito 2 (Dev A).
 *  Le regole di `quando.ts`: il promemoria 25' prima del meet (finestra
 *  −30'…−15'), la coda dei ricontatti (9-20, lunedì-sabato, ora di Roma,
 *  recupero una volta sola), i tetti, il ritmo di 27-33'. Tutte funzioni
 *  pure: l'orologio e il numero a caso entrano come argomenti.
 *
 *  Date di riferimento (Roma): fino a sabato 24 ottobre 2026 è ora legale
 *  (+02:00); domenica 25 ottobre alle 03:00 torna l'ora solare (+01:00).
 *  Venerdì 23/10, sabato 24/10, domenica 25/10, lunedì 26/10.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo }`. */
export async function proveQuando(mod, { c, gruppo }) {
  const Q = mod["manychat/quando"];

  const t = (iso) => new Date(iso);
  const MIN = 60_000;
  const dopo = (base, min) => new Date(t(base).getTime() + min * MIN);

  /* ── persone e schede inventate ────────────────────────────────────────── */
  const consulenti = [
    {
      id: "cons-1",
      data: { nome: "Giulia Demo", attivo: true, faConsulente: true, faSetter: false },
    },
    { id: "set-1", data: { nome: "Sara Demo", attivo: true, faConsulente: false, faSetter: true } },
  ];
  const consenso = { si: true, il: "2026-10-01T09:00:00.000Z", da: "Giulia Demo" };
  const tel = (n) => `333 000 ${String(n).padStart(4, "0")}`;
  /** il «telefono9» che sta nelle chiavi, per la scheda n */
  const t9 = (n) => `33000${String(n).padStart(4, "0")}`;

  const riga = (id, n, extra) => ({
    id,
    data: {
      nome: "Anna",
      cognome: "Prova",
      telefono: tel(n),
      consulenteId: "cons-1",
      okWhatsapp: consenso,
      ...extra,
    },
  });
  const meet = (id, n, giorno, ora, extra) =>
    riga(id, n, {
      stato: "appuntamento_fissato",
      dataMeeting: giorno,
      oraMeeting: ora,
      linkMeeting: "https://example.test/meetly/abc123",
      ...extra,
    });
  const ricontatto = (id, n, giorno, extra) =>
    riga(id, n, { stato: "da_ricontattare", dataRicontatto: giorno, ...extra });

  const tipi = (r) => r.map((x) => x.tipo);
  const unica = (r) => (r.length === 1 ? r[0] : null);

  /* ════════════════════════════════════════════════════════════════════════
   *  TETTI E RITMO
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · TETTI E RITMO (quando.ts)");

  c(
    "le costanti: 20 ricontatti, 40 in tutto, 10 la prima settimana, 27-33', pausa 120 s",
    [20, 40, 10, 27, 33, 120],
    [
      Q.TETTO_RICONTATTI,
      Q.TETTO_TOTALE,
      Q.TETTO_PRIMA_SETTIMANA,
      Q.RITMO_MIN,
      Q.RITMO_MAX,
      Q.PAUSA_CONTATTO_S,
    ],
  );

  const OGGI = t("2026-10-23T08:00:00.000Z");
  const giorniFa = (n) => new Date(OGGI.getTime() - n * 86_400_000).toISOString();
  c(
    "riquadro a 500 → si applica 20 / 40",
    { ricontatti: 20, totale: 40 },
    Q.tettiDelGiorno({ ricontatti: 500, totale: 500 }, giorniFa(30), OGGI),
  );
  c(
    "riquadro che abbassa → vale il riquadro",
    { ricontatti: 5, totale: 12 },
    Q.tettiDelGiorno({ ricontatti: 5, totale: 12 }, giorniFa(30), OGGI),
  );
  c(
    "riquadro vuoto o null → le costanti",
    [
      { ricontatti: 20, totale: 40 },
      { ricontatti: 20, totale: 40 },
    ],
    [Q.tettiDelGiorno({}, giorniFa(30), OGGI), Q.tettiDelGiorno(null, giorniFa(30), OGGI)],
  );
  c(
    "valori strani nel riquadro (testo, NaN, negativo, decimale)",
    { ricontatti: 0, totale: 7 },
    Q.tettiDelGiorno({ ricontatti: -3, totale: 7.9 }, giorniFa(30), OGGI),
  );
  c(
    "…testo e NaN non abbassano e non alzano: valgono le costanti",
    { ricontatti: 20, totale: 40 },
    Q.tettiDelGiorno({ ricontatti: "mille", totale: Number.NaN }, giorniFa(30), OGGI),
  );
  c(
    "prima settimana (acceso 3 giorni fa) → 10 ricontatti",
    { ricontatti: 10, totale: 40 },
    Q.tettiDelGiorno({ ricontatti: 500, totale: 500 }, giorniFa(3), OGGI),
  );
  c(
    "…il riquadro più basso di 10 vince anche nella prima settimana",
    3,
    Q.tettiDelGiorno({ ricontatti: 3 }, giorniFa(3), OGGI).ricontatti,
  );
  c(
    "esattamente 7 giorni dopo la prima accensione → torna 20 (come l'SQL: now < prima + 7 giorni)",
    [10, 20],
    [
      Q.tettiDelGiorno(null, new Date(OGGI.getTime() - 7 * 86_400_000 + MIN).toISOString(), OGGI)
        .ricontatti,
      Q.tettiDelGiorno(null, giorniFa(7), OGGI).ricontatti,
    ],
  );
  c(
    "mai acceso o data illeggibile → prudenza: valgono i 10",
    [10, 10, 10],
    [
      Q.tettiDelGiorno(null, null, OGGI).ricontatti,
      Q.tettiDelGiorno(null, undefined, OGGI).ricontatti,
      Q.tettiDelGiorno(null, "boh", OGGI).ricontatti,
    ],
  );

  c(
    "intervallo: 0 → 27, quasi 1 → 33, 1 → 33",
    [27, 33, 33],
    [Q.intervalloRicontatto(0), Q.intervalloRicontatto(0.999), Q.intervalloRicontatto(1)],
  );
  c(
    "intervallo: 0.5 → 30 (deterministico dato il seme)",
    [30, 30],
    [Q.intervalloRicontatto(0.5), Q.intervalloRicontatto(0.5)],
  );
  c(
    "intervallo: fuori misura (−1, 7, NaN) resta fra 27 e 33",
    true,
    [-1, 7, Number.NaN, Infinity].every(
      (x) => Q.intervalloRicontatto(x) >= 27 && Q.intervalloRicontatto(x) <= 33,
    ),
  );
  const visti = new Set();
  for (let i = 0; i < 1000; i++) visti.add(Q.intervalloRicontatto(i / 1000));
  c(
    "intervallo: escono tutti i sette valori 27…33, solo interi",
    [27, 28, 29, 30, 31, 32, 33],
    [...visti].sort((a, b) => a - b),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  PROMEMORIA 25'
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · IL PROMEMORIA 25' PRIMA DEL MEET");

  const TETTI = { ricontatti: 20, totale: 40 };
  const ctxP = (extra) => ({ consulenti, invii: [], tetti: TETTI, ...extra });
  const M = "2026-10-23T15:30:00+02:00";
  const m1530 = meet("lead-m", 1, "2026-10-23", "15:30");
  const decidi = (schede, adesso, extra) => Q.decidiPromemoria(schede, t(adesso), ctxP(extra));

  const a = (adesso) => decidi([m1530], adesso);
  c("meet 15:30, ore 14:59 (−31') → aspetta", ["aspetta"], tipi(a("2026-10-23T14:59:00+02:00")));
  c(
    "ore 15:04 (−26') → aspetta: il bersaglio è −25'",
    ["aspetta"],
    tipi(a("2026-10-23T15:04:00+02:00")),
  );
  const alle1505 = unica(a("2026-10-23T15:05:00+02:00"));
  c("ore 15:05 (−25') → invia", "invia", alle1505?.tipo);
  c("…con la chiave p|tel9|AAAA-MM-GGTHH:MM", `p|${t9(1)}|2026-10-23T15:30`, alle1505?.chiave);
  c(
    "…e l'inizio del meet come istante vero",
    t(M).toISOString(),
    alle1505?.extra.inizioMeet.toISOString(),
  );
  c("…la scheda è quella giusta", "lead-m", alle1505?.scheda.id);
  c(
    "ore 15:15 (−15', ultimo minuto utile) → invia",
    ["invia"],
    tipi(a("2026-10-23T15:15:00+02:00")),
  );
  const tardi = unica(a("2026-10-23T15:20:00+02:00"));
  c(
    "giro fermo fino alle 15:20 (−10') → saltato: giro in ritardo",
    ["salta", true],
    [tardi?.tipo, /ritardo/.test(tardi?.motivo ?? "")],
  );
  c("ore 15:16 (−14') → già in ritardo", ["salta"], tipi(a("2026-10-23T15:16:00+02:00")));
  c(
    "meet già iniziato (15:30 e 15:31) → niente, nessun messaggio",
    [[], []],
    [a("2026-10-23T15:30:00+02:00"), a("2026-10-23T15:31:00+02:00")],
  );
  c(
    "meet di un altro giorno → niente",
    [],
    decidi([meet("x", 1, "2026-10-24", "15:30")], "2026-10-23T15:05:00+02:00"),
  );

  //  Meet spostato.
  const spostato = meet("lead-m", 1, "2026-10-23", "17:00");
  c(
    "meet spostato alle 17:00: alle 15:05 non parte niente",
    ["aspetta"],
    tipi(decidi([spostato], "2026-10-23T15:05:00+02:00")),
  );
  const alle1635 = unica(decidi([spostato], "2026-10-23T16:35:00+02:00"));
  c(
    "…un solo promemoria, alle 16:35, con la chiave nuova",
    ["invia", `p|${t9(1)}|2026-10-23T17:00`],
    [alle1635?.tipo, alle1635?.chiave],
  );
  const primo = {
    telefono: "39333000" + "0001",
    tipo: "promemoria",
    stato: "inviato",
    prenotatoIl: "2026-10-23T13:05:00.000Z",
    chiave: `p|${t9(1)}|2026-10-23T15:30`,
    rispostaIl: "2026-10-23T13:08:00.000Z",
  };
  c(
    "…se il vecchio promemoria era già partito (e ha avuto risposta), il nuovo orario ha il suo",
    ["invia"],
    tipi(decidi([spostato], "2026-10-23T16:35:00+02:00", { invii: [primo] })),
  );
  c(
    "lo stesso promemoria già partito non riparte (stessa chiave) né fa rumore",
    [],
    decidi([m1530], "2026-10-23T15:06:00+02:00", {
      invii: [{ ...primo, chiave: `p|${t9(1)}|2026-10-23T15:30`, rispostaIl: null }],
    }),
  );
  c(
    "…una riga fallita con quella chiave non conta: si può riprovare",
    ["invia"],
    tipi(
      decidi([m1530], "2026-10-23T15:06:00+02:00", {
        invii: [{ ...primo, stato: "fallito", rispostaIl: null }],
      }),
    ),
  );

  //  Meet annullato, sede, importati.
  const conStato = (stato, extra) => meet("lead-m", 1, "2026-10-23", "15:30", { stato, ...extra });
  c(
    "appuntamento rifissato → vale come fissato",
    ["invia"],
    tipi(decidi([conStato("appuntamento_rifissato")], "2026-10-23T15:05:00+02:00")),
  );
  c(
    "meet annullato, perso, in valutazione, visita in sede → niente",
    [[], [], [], []],
    ["annullato", "perso", "sta_valutando", "viene_in_sede"].map((s) =>
      decidi([conStato(s)], "2026-10-23T15:05:00+02:00"),
    ),
  );
  c(
    "senza consulente (lead da lista) → niente",
    [],
    decidi(
      [meet("x", 1, "2026-10-23", "15:30", { consulenteId: null, importato: true })],
      "2026-10-23T15:05:00+02:00",
    ),
  );
  c(
    "senza data o ora illeggibile → niente",
    [[], []],
    [
      decidi([meet("x", 1, "", "15:30")], "2026-10-23T15:05:00+02:00"),
      decidi([meet("x", 1, "2026-10-23", "tardi")], "2026-10-23T15:05:00+02:00"),
    ],
  );

  //  Chi non può ricevere: salta col motivo, e il motivo si legge.
  const motivo = (r) => (r.length === 1 && r[0].tipo === "salta" ? r[0].motivo : null);
  c(
    "senza consenso → saltato: «manca il consenso WhatsApp»",
    "manca il consenso WhatsApp",
    motivo(
      decidi(
        [meet("x", 1, "2026-10-23", "15:30", { okWhatsapp: undefined })],
        "2026-10-23T15:05:00+02:00",
      ),
    ),
  );
  c(
    "con la casella del modulo basta",
    ["invia"],
    tipi(
      decidi(
        [
          meet("x", 1, "2026-10-23", "15:30", {
            okWhatsapp: undefined,
            consensoModulo: { whatsapp: true },
          }),
        ],
        "2026-10-23T15:05:00+02:00",
      ),
    ),
  );
  c(
    "scheda in STOP → saltato",
    "STOP",
    motivo(
      decidi(
        [
          meet("x", 1, "2026-10-23", "15:30", {
            contattoWa: {
              stato: "stop",
              il: "2026-10-22T10:00:00.000Z",
              da: "automatico",
              storia: [],
            },
          }),
        ],
        "2026-10-23T15:05:00+02:00",
      ),
    ),
  );
  c(
    "numero che non è un cellulare → saltato",
    "numero non valido",
    motivo(
      decidi(
        [meet("x", 1, "2026-10-23", "15:30", { telefono: "06 1234567" })],
        "2026-10-23T15:05:00+02:00",
      ),
    ),
  );
  c(
    "senza link del meet → saltato (un modello col buco non parte)",
    true,
    /link/.test(
      motivo(
        decidi(
          [meet("x", 1, "2026-10-23", "15:30", { linkMeeting: "" })],
          "2026-10-23T15:05:00+02:00",
        ),
      ) ?? "",
    ),
  );
  c(
    "consulente che non esiste fra i consulenti → saltato",
    true,
    /consulente/.test(
      motivo(
        decidi(
          [meet("x", 1, "2026-10-23", "15:30", { consulenteId: "fantasma" })],
          "2026-10-23T15:05:00+02:00",
        ),
      ) ?? "",
    ),
  );
  c(
    "senza nome → saltato",
    true,
    /nome/.test(
      motivo(
        decidi([meet("x", 1, "2026-10-23", "15:30", { nome: " " })], "2026-10-23T15:05:00+02:00"),
      ) ?? "",
    ),
  );

  //  Doppioni e freni.
  c(
    "due schede con lo stesso telefono e lo stesso meet → UN promemoria",
    ["lead-a"],
    decidi(
      [meet("lead-b", 1, "2026-10-23", "15:30"), meet("lead-a", 1, "2026-10-23", "15:30")],
      "2026-10-23T15:05:00+02:00",
    ).map((x) => x.scheda.id),
  );
  c(
    "due telefoni diversi allo stesso orario → due, in ordine di meet e poi di scheda",
    ["lead-1", "lead-2"],
    decidi(
      [meet("lead-2", 2, "2026-10-23", "15:30"), meet("lead-1", 1, "2026-10-23", "15:30")],
      "2026-10-23T15:05:00+02:00",
    ).map((x) => x.scheda.id),
  );
  const giaTre = ["10:00", "11:00", "12:00"].map((h) => ({
    telefono: "39333000" + "0001",
    tipo: "promemoria",
    stato: "inviato",
    prenotatoIl: "2026-10-23T07:00:00.000Z",
    chiave: `p|${t9(1)}|2026-10-23T${h}`,
    rispostaIl: "2026-10-23T07:10:00.000Z",
  }));
  c(
    "già tre promemoria a quel numero per quel giorno di meet → il quarto è saltato",
    true,
    /3/.test(motivo(decidi([m1530], "2026-10-23T15:05:00+02:00", { invii: giaTre })) ?? ""),
  );
  c(
    "…tre di un ALTRO giorno di meet non contano",
    ["invia"],
    tipi(
      decidi([m1530], "2026-10-23T15:05:00+02:00", {
        invii: giaTre.map((i) => ({ ...i, chiave: i.chiave.replace("2026-10-23", "2026-10-22") })),
      }),
    ),
  );

  const conferma = {
    telefono: "39333000" + "0001",
    tipo: "conferma",
    stato: "inviato",
    prenotatoIl: "2026-10-22T09:00:00.000Z",
  };
  c(
    "conferma senza risposta e poi promemoria allo stesso telefono → saltato (il freno vale anche per il promemoria)",
    "aspetta ancora una risposta",
    motivo(decidi([m1530], "2026-10-23T15:05:00+02:00", { invii: [conferma] })),
  );
  c(
    "…con l'interruttore di regola spento il promemoria parte (cambiare idea è una riga)",
    ["invia"],
    tipi(
      decidi([m1530], "2026-10-23T15:05:00+02:00", {
        invii: [conferma],
        frenoAnchePerPromemoria: false,
      }),
    ),
  );
  c(
    "…con la risposta alla conferma (il SÌ) parte anche col freno acceso",
    ["invia"],
    tipi(
      decidi([m1530], "2026-10-23T15:05:00+02:00", {
        invii: [{ ...conferma, rispostaIl: "2026-10-22T09:30:00.000Z" }],
      }),
    ),
  );
  c(
    "…o con un cambio a mano sulla scheda dopo la conferma",
    ["invia"],
    tipi(
      decidi(
        [
          meet("lead-m", 1, "2026-10-23", "15:30", {
            contattoWa: {
              stato: "contattato",
              il: "2026-10-22T12:00:00.000Z",
              da: "Giulia Demo",
              sbloccatoIl: "2026-10-22T12:00:00.000Z",
              storia: [],
            },
          }),
        ],
        "2026-10-23T15:05:00+02:00",
        { invii: [conferma] },
      ),
    ),
  );
  const chat = { telefono: "39333000" + "0001", tipo: "chat", stato: "inviato" };
  c(
    "pausa per contatto: un invio a quel telefono 60 s fa → aspetta",
    ["aspetta"],
    tipi(
      decidi([m1530], "2026-10-23T15:05:00+02:00", {
        invii: [{ ...chat, prenotatoIl: "2026-10-23T13:04:00.000Z" }],
      }),
    ),
  );
  c(
    "…130 s fa → passa",
    ["invia"],
    tipi(
      decidi([m1530], "2026-10-23T15:05:00+02:00", {
        invii: [{ ...chat, prenotatoIl: "2026-10-23T13:02:50.000Z" }],
      }),
    ),
  );
  c(
    "…un invio SALTATO o FALLITO non mette in pausa",
    ["invia"],
    tipi(
      decidi([m1530], "2026-10-23T15:05:00+02:00", {
        invii: [{ ...chat, stato: "saltato", prenotatoIl: "2026-10-23T13:04:30.000Z" }],
      }),
    ),
  );

  //  Tetto: i promemoria contano nel totale e passano finché il totale non è pieno.
  const oggiRighe = (n, tipo, stato = "inviato") =>
    Array.from({ length: n }, (_, i) => ({
      telefono: `3933400${String(i).padStart(5, "0")}`,
      tipo,
      stato,
      prenotatoIl: "2026-10-23T07:00:00.000Z",
      rispostaIl: "2026-10-23T07:05:00.000Z",
    }));
  c(
    "39 messaggi oggi → il promemoria passa",
    ["invia"],
    tipi(
      decidi([m1530], "2026-10-23T15:05:00+02:00", {
        invii: [...oggiRighe(20, "ricontatto"), ...oggiRighe(19, "promemoria")],
      }),
    ),
  );
  c(
    "40 messaggi oggi (ricontatti + promemoria) → tetto raggiunto",
    true,
    /tetto/.test(
      motivo(
        decidi([m1530], "2026-10-23T15:05:00+02:00", {
          invii: [...oggiRighe(20, "ricontatto"), ...oggiRighe(20, "promemoria")],
        }),
      ) ?? "",
    ),
  );
  c(
    "…i messaggi di ieri non contano",
    ["invia"],
    tipi(
      decidi([m1530], "2026-10-23T15:05:00+02:00", {
        invii: oggiRighe(40, "promemoria").map((i) => ({
          ...i,
          prenotatoIl: "2026-10-22T07:00:00.000Z",
        })),
      }),
    ),
  );
  c(
    "…conferme e chat non contano nel tetto dei promemoria",
    ["invia"],
    tipi(
      decidi([m1530], "2026-10-23T15:05:00+02:00", {
        invii: [...oggiRighe(30, "conferma"), ...oggiRighe(30, "chat")],
      }),
    ),
  );

  //  Cambio dell'ora: domenica 25/10 il meet delle 15:30 è già in ora solare (+01:00).
  const dom = meet("lead-d", 1, "2026-10-25", "15:30");
  c(
    "25/10 (ora solare): meet 15:30 → alle 15:05 invia, alle 15:04 aspetta",
    [["aspetta"], ["invia"]],
    [
      tipi(decidi([dom], "2026-10-25T15:04:00+01:00")),
      tipi(decidi([dom], "2026-10-25T15:05:00+01:00")),
    ],
  );
  c(
    "…14:05 a Greenwich è le 15:05 di Roma in ora solare → invia",
    ["invia"],
    tipi(decidi([dom], "2026-10-25T14:05:00Z")),
  );
  c(
    "26/10 mattina: meet alle 09:00 (CET) → promemoria alle 08:35, e a 08:46 è in ritardo",
    [["invia"], ["salta"]],
    [
      tipi(decidi([meet("lead-l", 1, "2026-10-26", "09:00")], "2026-10-26T08:35:00+01:00")),
      tipi(decidi([meet("lead-l", 1, "2026-10-26", "09:00")], "2026-10-26T08:46:00+01:00")),
    ],
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  RICONTATTI
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · LA CODA DEI RICONTATTI");

  const ACCESO = "2026-10-20T06:00:00.000Z";
  const ctxR = (extra) => ({ consulenti, invii: [], tetti: TETTI, prossimoDopo: null, ...extra });
  const coda = (schede, adesso, extra, acceso = ACCESO) =>
    Q.codaRicontatti(schede, t(adesso), acceso, ctxR(extra));
  const VEN10 = "2026-10-23T10:00:00+02:00";

  const r1 = unica(coda([ricontatto("l-1", 1, "2026-10-23")], VEN10));
  c("ricontatto di oggi, senza ora, alle 10:00 → invia", "invia", r1?.tipo);
  c("…chiave r|tel9|AAAA-MM-GG", `r|${t9(1)}|2026-10-23`, r1?.chiave);
  c("…col giorno e senza recupero", { giorno: "2026-10-23", recupero: false }, r1?.extra);
  c("ricontatto di domani → niente", [], coda([ricontatto("l-1", 1, "2026-10-24")], VEN10));
  c("senza data → niente", [], coda([ricontatto("l-1", 1, undefined)], VEN10));
  c("data scritta male → niente", [], coda([ricontatto("l-1", 1, "domani")], VEN10));
  c(
    "data inesistente (30 febbraio) → niente",
    [],
    coda([ricontatto("l-1", 1, "2026-02-30")], VEN10),
  );

  //  L'ora, se c'è.
  c(
    "con oraRicontatto 11:00, alle 10:00 → aspetta",
    ["aspetta"],
    tipi(coda([ricontatto("l-1", 1, "2026-10-23", { oraRicontatto: "11:00" })], VEN10)),
  );
  c(
    "…alle 11:00 → invia",
    ["invia"],
    tipi(
      coda(
        [ricontatto("l-1", 1, "2026-10-23", { oraRicontatto: "11:00" })],
        "2026-10-23T11:00:00+02:00",
      ),
    ),
  );
  c(
    "oraRicontatto prima delle 9 (07:30): non parte comunque prima delle 9",
    ["aspetta", "invia"],
    [
      tipi(
        coda(
          [ricontatto("l-1", 1, "2026-10-23", { oraRicontatto: "07:30" })],
          "2026-10-23T08:59:00+02:00",
        ),
      )[0],
      tipi(
        coda(
          [ricontatto("l-1", 1, "2026-10-23", { oraRicontatto: "07:30" })],
          "2026-10-23T09:00:00+02:00",
        ),
      )[0],
    ],
  );
  c(
    "oraRicontatto illeggibile → come se non ci fosse",
    ["invia"],
    tipi(coda([ricontatto("l-1", 1, "2026-10-23", { oraRicontatto: "dopo pranzo" })], VEN10)),
  );

  //  callbackAt come ripiego (il giorno di Roma).
  c(
    "senza dataRicontatto, vale il giorno di callbackAt (a Roma: 22:30Z di giovedì è già venerdì)",
    [`r|${t9(1)}|2026-10-23`],
    coda(
      [riga("l-1", 1, { stato: "da_ricontattare", callbackAt: "2026-10-22T22:30:00.000Z" })],
      VEN10,
    ).map((x) => x.chiave),
  );
  c(
    "dataRicontatto batte callbackAt",
    [`r|${t9(1)}|2026-10-23`],
    coda(
      [
        riga("l-1", 1, {
          stato: "da_ricontattare",
          dataRicontatto: "2026-10-23",
          callbackAt: "2026-10-20T10:00:00.000Z",
        }),
      ],
      VEN10,
    ).map((x) => x.chiave),
  );
  c(
    "callbackAt rotto → niente",
    [],
    coda([riga("l-1", 1, { stato: "da_ricontattare", callbackAt: "ieri" })], VEN10),
  );

  //  Chi è un lead del consulente.
  c(
    "stato «ricontatto fissato», «in valutazione», «fissa meet dopo» → tutti e tre",
    [true, true, true],
    ["da_ricontattare", "sta_valutando", "fissa_meet_dopo"].map(
      (stato) =>
        coda([riga("l-1", 1, { stato, dataRicontatto: "2026-10-23" })], VEN10).length === 1,
    ),
  );
  c(
    "richiamo, ci ricontatta lui → mai",
    [[], []],
    ["richiamo", "ci_ricontatta_lui"].map((stato) =>
      coda([riga("l-1", 1, { stato, dataRicontatto: "2026-10-23" })], VEN10),
    ),
  );
  c(
    "lead del setter → niente",
    [],
    coda([ricontatto("l-1", 1, "2026-10-23", { consulenteId: "set-1" })], VEN10),
  );
  c(
    "lead importato → niente",
    [],
    coda([ricontatto("l-1", 1, "2026-10-23", { importato: true, consulenteId: null })], VEN10),
  );

  //  Recupero: il giorno lavorativo dopo, una volta sola.
  const rec = unica(coda([ricontatto("l-1", 1, "2026-10-22")], VEN10));
  c(
    "ieri non è partito → oggi si recupera, e lo dice",
    ["invia", `r|${t9(1)}|2026-10-22`, { giorno: "2026-10-22", recupero: true }],
    [rec?.tipo, rec?.chiave, rec?.extra],
  );
  c(
    "l'altro ieri → perso: resta al consulente",
    [],
    coda([ricontatto("l-1", 1, "2026-10-21")], VEN10),
  );
  c(
    "già partito ieri (stessa chiave inviata) → non si recupera",
    [],
    coda([ricontatto("l-1", 1, "2026-10-22")], VEN10, {
      invii: [
        {
          telefono: "39333000" + "0001",
          tipo: "ricontatto",
          stato: "inviato",
          prenotatoIl: "2026-10-22T08:00:00.000Z",
          chiave: `r|${t9(1)}|2026-10-22`,
        },
      ],
    }),
  );
  c(
    "…ma se la riga di ieri era FALLITA o SALTATA, il recupero c'è",
    ["invia"],
    tipi(
      coda([ricontatto("l-1", 1, "2026-10-22")], VEN10, {
        invii: [
          {
            telefono: "39333000" + "0001",
            tipo: "ricontatto",
            stato: "saltato",
            prenotatoIl: "2026-10-22T08:00:00.000Z",
            chiave: `r|${t9(1)}|2026-10-22`,
          },
        ],
      }),
    ),
  );
  c(
    "sabato non partito → lunedì 26/10 (la domenica non conta)",
    ["invia", true],
    (() => {
      const x = unica(coda([ricontatto("l-1", 1, "2026-10-24")], "2026-10-26T10:00:00+01:00"));
      return [x?.tipo, x?.extra.recupero];
    })(),
  );
  c(
    "venerdì non partito → sabato 24/10 si recupera",
    ["invia"],
    tipi(coda([ricontatto("l-1", 1, "2026-10-23")], "2026-10-24T10:00:00+02:00")),
  );
  c(
    "venerdì non partito → lunedì è tardi: perso",
    [],
    coda([ricontatto("l-1", 1, "2026-10-23")], "2026-10-26T10:00:00+01:00"),
  );
  c(
    "data di domenica 25/10 → lunedì 26/10 si recupera",
    ["invia", `r|${t9(1)}|2026-10-25`],
    (() => {
      const x = unica(coda([ricontatto("l-1", 1, "2026-10-25")], "2026-10-26T10:00:00+01:00"));
      return [x?.tipo, x?.chiave];
    })(),
  );

  //  Mai una data precedente all'ultima accensione.
  c(
    "data precedente all'ultima accensione → mai (nemmeno il recupero)",
    [],
    coda([ricontatto("l-1", 1, "2026-10-22")], VEN10, {}, "2026-10-23T06:00:00.000Z"),
  );
  c(
    "…la data DEL GIORNO dell'accensione parte",
    ["invia"],
    tipi(coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {}, "2026-10-23T07:30:00.000Z")),
  );
  c(
    "…spegni e riaccendi: le date del buco non partono",
    [],
    coda(
      [ricontatto("l-1", 1, "2026-10-21")],
      "2026-10-22T10:00:00+02:00",
      {},
      "2026-10-22T07:00:00.000Z",
    ),
  );
  c(
    "mai acceso (ultimaAccensione vuota) → solo il giorno stesso, mai il recupero",
    [["invia"], []],
    [
      tipi(Q.codaRicontatti([ricontatto("l-1", 1, "2026-10-23")], t(VEN10), null, ctxR())),
      Q.codaRicontatti([ricontatto("l-1", 1, "2026-10-22")], t(VEN10), null, ctxR()),
    ],
  );

  //  Orario: 9-20, lunedì-sabato, ora di Roma (anche col cambio dell'ora).
  const ora = (adesso) => tipi(coda([ricontatto("l-1", 1, adesso.slice(0, 10))], adesso));
  c(
    "sabato 24/10 (ora legale): 08:59 aspetta, 09:00 invia, 19:59 invia, 20:00 aspetta",
    [["aspetta"], ["invia"], ["invia"], ["aspetta"]],
    [
      ora("2026-10-24T08:59:00+02:00"),
      ora("2026-10-24T09:00:00+02:00"),
      ora("2026-10-24T19:59:00+02:00"),
      ora("2026-10-24T20:00:00+02:00"),
    ],
  );
  c(
    "lunedì 26/10 (ora solare): 08:59 aspetta, 09:00 invia, 19:59 invia, 20:00 aspetta",
    [["aspetta"], ["invia"], ["invia"], ["aspetta"]],
    [
      ora("2026-10-26T08:59:00+01:00"),
      ora("2026-10-26T09:00:00+01:00"),
      ora("2026-10-26T19:59:00+01:00"),
      ora("2026-10-26T20:00:00+01:00"),
    ],
  );
  const domenica = coda([ricontatto("l-1", 1, "2026-10-25")], "2026-10-25T12:00:00+01:00");
  c(
    "domenica 25/10 a mezzogiorno → niente ricontatti, e dice perché",
    ["aspetta", true],
    [domenica[0]?.tipo, /domenica/.test(domenica[0]?.motivo ?? "")],
  );
  c(
    "…e a mezzanotte e mezza del 26/10 (ora solare) è lunedì ma fuori orario",
    ["aspetta"],
    tipi(coda([ricontatto("l-1", 1, "2026-10-26")], "2026-10-26T00:30:00+01:00")),
  );
  c(
    "il giorno è quello di Roma, non di Greenwich: 23/10 23:30 a Roma = 21:30Z, ancora venerdì",
    ["aspetta"],
    tipi(coda([ricontatto("l-1", 1, "2026-10-23")], "2026-10-23T21:30:00Z")),
  );

  //  Due schede con lo stesso numero.
  const doppie = coda(
    [ricontatto("l-b", 1, "2026-10-23"), ricontatto("l-a", 1, "2026-10-23")],
    VEN10,
  );
  c(
    "due schede con lo stesso telefono → UNA voce (la prima per scheda)",
    [["l-a"], ["invia"]],
    [doppie.map((x) => x.scheda.id), tipi(doppie)],
  );
  const doppieGiorni = coda(
    [ricontatto("l-oggi", 1, "2026-10-23"), ricontatto("l-ieri", 1, "2026-10-22")],
    VEN10,
  );
  c(
    "…una di ieri e una di oggi, stesso numero → una sola, il recupero per primo",
    ["l-ieri"],
    doppieGiorni.map((x) => x.scheda.id),
  );
  c(
    "…ma se una non ha il consenso e l'altra sì, parte quella col consenso",
    ["invia", "salta"],
    tipi(
      coda(
        [
          ricontatto("l-a", 1, "2026-10-23", { okWhatsapp: undefined }),
          ricontatto("l-b", 1, "2026-10-23"),
        ],
        VEN10,
      ),
    ),
  );

  //  Chi non può ricevere.
  const m2 = (extra) => motivo(coda([ricontatto("l-1", 1, "2026-10-23", extra)], VEN10));
  c("senza consenso → saltato", "manca il consenso WhatsApp", m2({ okWhatsapp: undefined }));
  c(
    "STOP sulla scheda → saltato",
    "STOP",
    m2({
      contattoWa: { stato: "stop", il: "2026-10-20T10:00:00.000Z", da: "automatico", storia: [] },
    }),
  );
  c("numero non valido → saltato", "numero non valido", m2({ telefono: "12" }));
  c(
    "senza nome → saltato (un modello col buco non parte)",
    true,
    /nome/.test(m2({ nome: "" }) ?? ""),
  );

  //  Freno per telefono.
  const confermaSenza = {
    telefono: "39333000" + "0001",
    tipo: "conferma",
    stato: "inviato",
    prenotatoIl: "2026-10-22T09:00:00.000Z",
  };
  c(
    "conferma senza risposta e poi ricontatto allo stesso telefono → saltato",
    "aspetta ancora una risposta",
    motivo(coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, { invii: [confermaSenza] })),
  );
  c(
    "…con la risposta alla conferma → parte",
    ["invia"],
    tipi(
      coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        invii: [{ ...confermaSenza, rispostaIl: "2026-10-22T09:20:00.000Z" }],
      }),
    ),
  );
  c(
    "…l'invio senza risposta è di un ALTRO numero → parte",
    ["invia"],
    tipi(
      coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        invii: [{ ...confermaSenza, telefono: "393330000002" }],
      }),
    ),
  );
  c(
    "il freno per il ricontatto non dipende dall'interruttore del promemoria",
    "aspetta ancora una risposta",
    motivo(
      coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        invii: [confermaSenza],
        frenoAnchePerPromemoria: false,
      }),
    ),
  );

  //  Tetti.
  const righeOggi = (n, tipo, extra) =>
    Array.from({ length: n }, (_, i) => ({
      telefono: `3933400${String(i).padStart(5, "0")}`,
      tipo,
      stato: "inviato",
      prenotatoIl: "2026-10-23T06:10:00.000Z",
      rispostaIl: "2026-10-23T06:20:00.000Z",
      ...extra,
    }));
  const tetti10 = Q.tettiDelGiorno({ ricontatti: 500, totale: 500 }, giorniFa(3), OGGI);
  c(
    "prima settimana, 10 ricontatti già fatti oggi → l'11° slitta a domani",
    ["aspetta", true],
    (() => {
      const x = coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        tetti: tetti10,
        invii: righeOggi(10, "ricontatto"),
      });
      return [x[0]?.tipo, /tetto/.test(x[0]?.motivo ?? "")];
    })(),
  );
  c(
    "…dopo uno spegni-accendi (ultima accensione di stamattina, prima accensione di 3 giorni fa) è uguale",
    ["aspetta"],
    tipi(
      Q.codaRicontatti(
        [ricontatto("l-1", 1, "2026-10-23")],
        t(VEN10),
        "2026-10-23T06:30:00.000Z",
        ctxR({
          tetti: Q.tettiDelGiorno(null, giorniFa(3), OGGI),
          invii: righeOggi(10, "ricontatto"),
        }),
      ),
    ),
  );
  c(
    "…il 10° passa",
    ["invia"],
    tipi(
      coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        tetti: tetti10,
        invii: righeOggi(9, "ricontatto"),
      }),
    ),
  );
  const tetti20 = Q.tettiDelGiorno({ ricontatti: 500, totale: 500 }, giorniFa(30), OGGI);
  c(
    "il 20° passa, il 21° → domani",
    [["invia"], ["aspetta"]],
    [
      tipi(
        coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
          tetti: tetti20,
          invii: righeOggi(19, "ricontatto"),
        }),
      ),
      tipi(
        coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
          tetti: tetti20,
          invii: righeOggi(20, "ricontatto"),
        }),
      ),
    ],
  );
  c(
    "15 ricontatti + 25 promemoria = 40 in tutto → il totale ferma i ricontatti anche sotto il loro tetto",
    ["aspetta"],
    tipi(
      coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        tetti: { ricontatti: 25, totale: 40 },
        invii: [...righeOggi(15, "ricontatto"), ...righeOggi(25, "promemoria")],
      }),
    ),
  );
  c(
    "i messaggi di ieri e quelli falliti o saltati non contano",
    ["invia"],
    tipi(
      coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        tetti: tetti10,
        invii: [
          ...righeOggi(10, "ricontatto", { prenotatoIl: "2026-10-22T07:00:00.000Z" }),
          ...righeOggi(10, "ricontatto", { stato: "fallito" }),
          ...righeOggi(10, "ricontatto", { stato: "saltato" }),
        ],
      }),
    ),
  );
  c(
    "…un invio di 00:30 di Roma (22:30Z del giorno prima) è di OGGI",
    ["aspetta"],
    tipi(
      coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        tetti: tetti10,
        invii: righeOggi(10, "ricontatto", { prenotatoIl: "2026-10-22T22:30:00.000Z" }),
      }),
    ),
  );
  c(
    "…uno delle 23:30 di Roma di ieri (21:30Z) no",
    ["invia"],
    tipi(
      coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        tetti: tetti10,
        invii: righeOggi(10, "ricontatto", { prenotatoIl: "2026-10-22T21:30:00.000Z" }),
      }),
    ),
  );

  //  Ritmo e pausa.
  c(
    "il ritmo non è ancora scaduto → aspetta, e dice quando",
    ["aspetta", true],
    (() => {
      const x = coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        prossimoDopo: t("2026-10-23T10:20:00+02:00"),
      });
      return [x[0]?.tipo, /10:20/.test(x[0]?.motivo ?? "")];
    })(),
  );
  c(
    "…scaduto (anche al secondo giusto) → invia",
    ["invia", "invia"],
    [
      tipi(coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, { prossimoDopo: t(VEN10) }))[0],
      tipi(
        coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
          prossimoDopo: t("2026-10-23T09:00:00+02:00"),
        }),
      )[0],
    ],
  );
  c(
    "pausa per contatto: invio a quel numero 60 s fa → aspetta",
    ["aspetta"],
    tipi(
      coda([ricontatto("l-1", 1, "2026-10-23")], VEN10, {
        invii: [
          {
            telefono: "393330000001",
            tipo: "chat",
            stato: "inviato",
            prenotatoIl: "2026-10-23T07:59:00.000Z",
          },
        ],
      }),
    ),
  );

  //  Ordine.
  const ordinati = coda(
    [
      ricontatto("l-d", 4, "2026-10-23"),
      ricontatto("l-c", 3, "2026-10-23", { oraRicontatto: "10:00" }),
      ricontatto("l-b", 2, "2026-10-23", { oraRicontatto: "09:30" }),
      ricontatto("l-a", 1, "2026-10-22"),
    ],
    VEN10,
  );
  c(
    "l'ordine: prima il recupero, poi chi ha l'ora (la più vecchia), poi gli altri",
    ["l-a", "l-b", "l-c", "l-d"],
    ordinati.map((x) => x.scheda.id),
  );
  c("…e chi tocca adesso è in testa", "invia", ordinati[0]?.tipo);

  /* ── la giornata intera, minuto per minuto (SPEC §11.3) ───────────────── */
  gruppo("MANYCHAT · UNA GIORNATA DI RICONTATTI, MINUTO PER MINUTO");

  /** Fa girare il giro ogni minuto da `da` a `a` (ISO con offset): a ogni
   *  tick prende il primo «invia», lo registra e sposta il ritmo, proprio come
   *  farà il giro vero. `semi` = i numeri a caso, in ordine. */
  const giornata = ({
    schede,
    da,
    a,
    semi,
    tetti = TETTI,
    acceso = ACCESO,
    invii: inviiDiPartenza = [],
  }) => {
    const invii = [...inviiDiPartenza];
    const spedite = [];
    let prossimoDopo = null;
    let k = 0;
    for (let ms = t(da).getTime(); ms <= t(a).getTime(); ms += MIN) {
      const adesso = new Date(ms);
      const r = Q.codaRicontatti(schede, adesso, acceso, {
        consulenti,
        invii,
        tetti,
        prossimoDopo,
      });
      const primo = r.find((x) => x.tipo === "invia");
      if (!primo) continue;
      spedite.push(adesso.toISOString());
      invii.push({
        telefono: `39${primo.chiave.split("|")[1]}`,
        tipo: "ricontatto",
        stato: "inviato",
        prenotatoIl: adesso.toISOString(),
        chiave: primo.chiave,
      });
      prossimoDopo = dopo(adesso, Q.intervalloRicontatto(semi[k++ % semi.length]));
    }
    return spedite;
  };
  const sei = [1, 2, 3, 4, 5, 6].map((n) => ricontatto(`g-${n}`, n, "2026-10-24"));
  const sabato = giornata({
    schede: sei,
    da: "2026-10-24T00:00:00+02:00",
    a: "2026-10-24T23:59:00+02:00",
    semi: [0, 0.99, 0.5, 0.2, 0.7, 0.4],
  });
  c("sabato 24/10: sei ricontatti → sei invii, il primo alle 09:00", 6, sabato.length);
  c(
    "…alle 09:00, +27', +33', +30', +28', +31' (ora di Roma)",
    ["09:00", "09:27", "10:00", "10:30", "10:58", "11:29"],
    sabato.map((s) => new Date(new Date(s).getTime() + 2 * 3_600_000).toISOString().slice(11, 16)),
  );
  const distanze = sabato.slice(1).map((s, i) => (new Date(s) - new Date(sabato[i])) / MIN);
  c(
    "…ogni intervallo fra 27 e 33 minuti",
    true,
    distanze.every((d) => d >= 27 && d <= 33),
  );
  const domenicaSim = giornata({
    schede: [ricontatto("g-1", 1, "2026-10-25")],
    da: "2026-10-25T00:00:00+01:00",
    a: "2026-10-25T23:59:00+01:00",
    semi: [0.5],
  });
  c("domenica 25/10 (cambio dell'ora) → zero invii", 0, domenicaSim.length);
  const lunedi = giornata({
    schede: [ricontatto("g-1", 1, "2026-10-25"), ricontatto("g-2", 2, "2026-10-26")],
    da: "2026-10-26T00:00:00+01:00",
    a: "2026-10-26T23:59:00+01:00",
    semi: [0.5],
    acceso: "2026-10-24T06:00:00.000Z",
  });
  c(
    "lunedì 26/10 (ora solare): recupero della domenica + il nuovo, il primo alle 09:00 locali (08:00Z)",
    [2, "2026-10-26T08:00:00.000Z", "2026-10-26T08:30:00.000Z"],
    [lunedi.length, lunedi[0], lunedi[1]],
  );
  const venticinque = Array.from({ length: 25 }, (_, i) =>
    ricontatto(`g-${i + 1}`, i + 1, "2026-10-26"),
  );
  const tettoVent = giornata({
    schede: venticinque,
    da: "2026-10-26T00:00:00+01:00",
    a: "2026-10-26T23:59:00+01:00",
    semi: [0.5],
    tetti: tetti20,
    acceso: "2026-10-20T06:00:00.000Z",
  });
  c(
    "25 ricontatti nello stesso giorno, tetto 20 → 20 invii, tutti dentro le 20:00",
    [20, true],
    [tettoVent.length, tettoVent.every((s) => s < "2026-10-26T19:00:00.000Z")],
  );
  const tettoPrima = giornata({
    schede: venticinque,
    da: "2026-10-26T00:00:00+01:00",
    a: "2026-10-26T23:59:00+01:00",
    semi: [0.5],
    tetti: tetti10,
  });
  c("prima settimana, tetto 10 → 10 invii e gli altri aspettano domani", 10, tettoPrima.length);
}
