/** ── PROVE: «PROPONI ORARI» CON LA DURATA SCELTA (commessa 2026-10-30) ─────
 *  Richiesta del titolare: gli orari proposti nella chat devono essere quelli
 *  davvero liberi nel calendario dei consulenti, per TUTTA la durata scelta
 *  (predefinita 45 minuti), ogni mezz'ora. Calendari finti, motore vero
 *  (`slotDelGiorno` passando da `giornoDellaSquadra`). */

const LUNEDI = "2026-11-02"; // lunedì (dow 1)

const consulente = (id, nome, fasce, extra = {}) => ({
  id,
  data: {
    nome,
    attivo: true,
    giorniLavorativi: [1, 2, 3, 4, 5],
    fasceOrarie: fasce,
    pause: [],
    indisponibilita: [],
    ...extra,
  },
});
const scheda = (id, data) => ({
  id,
  data: { nome: "Cliente", cognome: id, stato: "consulenza_fissata", ...data },
});
const ore = (g) => g.fasce.map((f) => f.ora);

export function proveOrariDurata(mod, { c, gruppo }) {
  const W = mod["wa-orari"];
  const G = mod["giorni-liberi"];

  gruppo("PROPONI ORARI: LA DURATA (predefinita, scelte rapide, valore libero)");
  c("predefinita 45 minuti, passo di mezz'ora", [45, 30], [W.DURATA_ORARI, W.PASSO_ORARI]);
  c("scelte rapide 30, 45, 60, 90", [30, 45, 60, 90], W.DURATE_RAPIDE);
  c(
    "un valore libero si accetta fra 15 e 180 minuti, intero",
    [50, 15, 180, 40, null, null, null, null],
    [
      W.durataValida("50"),
      W.durataValida(15),
      W.durataValida(180),
      W.durataValida(" 40 "),
      W.durataValida(10),
      W.durataValida(200),
      W.durataValida("tre"),
      W.durataValida(""),
    ],
  );
  c(
    "la durata salvata: valida si tiene, storta o assente torna a 45",
    [60, 50, 45, 45, 45],
    [
      W.leggiDurata("60"),
      W.leggiDurata("50"),
      W.leggiDurata(null),
      W.leggiDurata("0"),
      W.leggiDurata("ciao"),
    ],
  );
  c(
    "la durata detta a parole",
    [
      "30 minuti",
      "45 minuti",
      "un'ora",
      "un'ora e mezza",
      "2 ore",
      "un'ora e 15 minuti",
      "2 ore e mezza",
    ],
    [30, 45, 60, 90, 120, 75, 150].map((m) => W.durataParlata(m)),
  );

  gruppo("PROPONI ORARI: IL MESSAGGIO DICE LA DURATA SCELTA");
  const oggi = "2026-10-28";
  c(
    "un orario, 45 minuti",
    "Gentile Mario, per la consulenza gratuita online di 45 minuti avrei libero oggi, mercoledì 28 ottobre, alle 15:00.\n\nLe va bene?",
    W.messaggioOrari([{ data: oggi, ora: "15:00" }], oggi, "Mario Esempio", null, 45),
  );
  c(
    "più orari, un'ora e mezza",
    "Per la consulenza gratuita online di un'ora e mezza avrei liberi questi orari:\n\nDomani, giovedì 29 ottobre: alle 10:00 o alle 15:30\n\nQuale preferisce?",
    W.messaggioOrari(
      [
        { data: "2026-10-29", ora: "15:30" },
        { data: "2026-10-29", ora: "10:00" },
      ],
      oggi,
      "",
      null,
      90,
    ),
  );
  c(
    "col consulente: «Filippo è disponibile per la consulenza gratuita online di un'ora …»",
    "Gentile Anna, Filippo è disponibile per la consulenza gratuita online di un'ora domani, giovedì 29 ottobre, alle 10:00.\n\nLe va bene?",
    W.messaggioOrari(
      [{ data: "2026-10-29", ora: "10:00", chi: "c1" }],
      oggi,
      "anna",
      "Filippo Rossi",
      60,
    ),
  );
  c(
    "senza durata il testo resta quello di prima",
    "Gentile Mario, per la consulenza gratuita online avrei libero oggi, mercoledì 28 ottobre, alle 15:00.\n\nLe va bene?",
    W.messaggioOrari([{ data: oggi, ora: "15:00" }], oggi, "Mario"),
  );

  gruppo("PROPONI ORARI: IMPEGNO A METÀ FASCIA (libera per tutta la durata)");
  //  Anna lavora 9–13; una visita in sede (impegno esclusivo) dalle 10:15 alle 11:15.
  const anna = consulente("c1", "Anna", [{ inizio: "09:00", fine: "13:00" }]);
  const sede = scheda("s1", {
    consulenteId: "c1",
    dataVieneInSede: LUNEDI,
    oraVieneInSede: "10:15",
    durataVieneInSede: 60,
  });
  const metà = (durata, passo) =>
    G.giornoDellaSquadra({ data: LUNEDI, persone: [anna], leads: [sede], durata, passo });
  c(
    "prima (60 minuti ogni ora, come Slot liberi): solo 9:00 e 12:00, e 11:30 non c'era",
    ["09:00", "12:00"],
    ore(metà(60, 60)),
  );
  c(
    "adesso, 45 minuti ogni mezz'ora: 9:30 finisce alle 10:15 giusto in tempo; 10:00–11:00 toccano la visita",
    ["09:00", "09:30", "11:30", "12:00"],
    ore(metà(45, 30)),
  );
  c(
    "un'ora e mezza: solo dove ci sta tutta (9:00 no, finirebbe alle 10:30)",
    ["11:30"],
    ore(metà(90, 30)),
  );
  //  Una consulenza alle 10:00 (si sta in tre insieme): a 10:00 c'è posto, a 9:30 e 10:30 no.
  const consulenza = scheda("m1", {
    consulenteId: "c1",
    dataMeeting: LUNEDI,
    oraMeeting: "10:00",
    durataMeeting: 60,
  });
  const conMeet = G.giornoDellaSquadra({
    data: LUNEDI,
    persone: [anna],
    leads: [consulenza],
    durata: 45,
    passo: 30,
  });
  c(
    "consulenza delle 10:00: le 10:00 restano (stessa consulenza, 2 posti), 9:30 e 10:30 no",
    [["09:00", "10:00", "11:00", "11:30", "12:00"], 2],
    [ore(conMeet), conMeet.fasce.find((f) => f.ora === "10:00")?.posti],
  );
  c(
    "una consulenza annullata non tiene il posto",
    ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"],
    ore(
      G.giornoDellaSquadra({
        data: LUNEDI,
        persone: [anna],
        leads: [{ ...consulenza, data: { ...consulenza.data, stato: "annullato" } }],
        durata: 45,
        passo: 30,
      }),
    ),
  );
  c(
    "una pausa 12:30–13:30 in una giornata 9–18: 13:30 torna proponibile",
    ["11:00", "11:30", "13:30", "14:00"],
    ore(
      G.giornoDellaSquadra({
        data: LUNEDI,
        persone: [
          consulente("c1", "Anna", [{ inizio: "09:00", fine: "18:00" }], {
            pause: [{ giorno: 1, inizio: "12:30", fine: "13:30" }],
          }),
        ],
        leads: [],
        durata: 60,
        passo: 30,
        dopo: 11 * 60,
      }),
    ).slice(0, 4),
  );
  c(
    "un'ora tenuta per una persona sola, già presa: le 10:00 non si offrono",
    false,
    ore(
      G.giornoDellaSquadra({
        data: LUNEDI,
        persone: [anna],
        leads: [consulenza],
        durata: 45,
        passo: 30,
        modi: new Map([["10:00", "solo"]]),
      }),
    ).includes("10:00"),
  );

  gruppo("PROPONI ORARI: FINE GIORNATA");
  const tardi = consulente("c1", "Anna", [{ inizio: "14:00", fine: "18:30" }]);
  const fine = (durata, passo) =>
    ore(G.giornoDellaSquadra({ data: LUNEDI, persone: [tardi], leads: [], durata, passo })).at(-1);
  c(
    "ultimo orario: 45 min → 17:30 (finisce 18:15), 60 → 17:30, 90 → 17:00, 30 → 18:00",
    ["17:30", "17:30", "17:00", "18:00"],
    [fine(45, 30), fine(60, 30), fine(90, 30), fine(30, 30)],
  );
  c(
    "prima (60 ogni ora) l'ultimo era 17:00: la mezz'ora 17:30–18:30 non si proponeva",
    "17:00",
    fine(60, 60),
  );
  c(
    "oggi: niente orari già iniziati",
    ["16:30", "17:00", "17:30"],
    ore(
      G.giornoDellaSquadra({
        data: LUNEDI,
        persone: [tardi],
        leads: [],
        durata: 45,
        passo: 30,
        dopo: 16 * 60 + 10,
      }),
    ),
  );

  gruppo("PROPONI ORARI: DUE CONSULENTI");
  //  Anna 9–12 con un'indisponibilità 9:00–11:00; Bruno 10–12 libero.
  const a2 = consulente("c1", "Anna", [{ inizio: "09:00", fine: "12:00" }], {
    indisponibilita: [{ data: LUNEDI, inizio: "09:00", fine: "11:00" }],
  });
  const b2 = consulente("c2", "Bruno", [{ inizio: "10:00", fine: "12:00" }]);
  const due = G.giornoDellaSquadra({
    data: LUNEDI,
    persone: [a2, b2],
    leads: [],
    durata: 45,
    passo: 30,
  });
  c("«Tutti»: le ore di chiunque possa farla", ["10:00", "10:30", "11:00"], ore(due));
  c(
    "alle 10:00 e 10:30 solo Bruno; alle 11:00 tutti e due",
    [["c2"], ["c2"], ["c1", "c2"]],
    due.fasce.map((f) => f.chi.map((x) => x.id).sort()),
  );
  c("il ritaglio di Anna: solo le 11:00", ["11:00"], ore(W.giornoDi(due, "c1")));
  c(
    "un orario scelto per Anna ma libero solo per Bruno si toglie prima del messaggio",
    [
      { data: LUNEDI, ora: "11:00", chi: "c1" },
      { data: LUNEDI, ora: "10:00", chi: "tutti" },
    ],
    W.scelteAncoraLibere(
      [
        { data: LUNEDI, ora: "10:30", chi: "c1" },
        { data: LUNEDI, ora: "11:00", chi: "c1" },
        { data: LUNEDI, ora: "10:00", chi: "tutti" },
      ],
      [due],
      "2026-11-01",
    ),
  );

  gruppo("PROPONI ORARI: SLOT LIBERI RESTA COM'ERA, E LE SUE ORE CI SONO TUTTE");
  const settimana = [anna, b2];
  const leads = [sede, consulenza];
  const slotLiberi = G.giornoDellaSquadra({ data: LUNEDI, persone: settimana, leads, durata: 60 });
  c(
    "senza passo il passo è la durata (Slot liberi: ogni ora, 60 minuti)",
    ore(G.giornoDellaSquadra({ data: LUNEDI, persone: settimana, leads, durata: 60, passo: 60 })),
    ore(slotLiberi),
  );
  const proponi = ore(
    G.giornoDellaSquadra({ data: LUNEDI, persone: settimana, leads, durata: 60, passo: 30 }),
  );
  c(
    "con la stessa durata, ogni ora di Slot liberi è anche in Proponi orari",
    true,
    ore(slotLiberi).every((o) => proponi.includes(o)),
  );
}
