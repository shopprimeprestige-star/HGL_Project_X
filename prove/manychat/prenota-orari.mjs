/** ── PROVE: GLI ORARI (T2) ──────────────────────────────────────────────
 *
 *  Commessa 2026-10-27 (prenota in chat), PIANO.md T2 e D1, D5, D6, D10, D11.
 *  `prenota-orari.ts`: i giorni della finestra, i consulenti prenotabili, gli
 *  orari liberi di un consulente («uno per ora»), i 3 orari da proporre, il
 *  consulente per l'orario scelto, la verifica «è ancora libero?».
 *
 *  Date di riferimento (Roma): martedì 27/10/2026 è già l'ora solare (+01:00;
 *  il cambio è stato domenica 25/10). Mercoledì 28, giovedì 29, venerdì 30,
 *  sabato 31/10, domenica 1/11, lunedì 2/11. Il cambio all'ora legale del 2026
 *  è domenica 29 marzo (alle 02:00 Roma). Dati inventati: nessun numero né nome
 *  vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function proveDegliOrariPrenota(mod, { c, gruppo, radice }) {
  const O = mod["manychat/prenota-orari"];
  const t = (iso) => new Date(iso);

  /* ── persone e schede inventate ────────────────────────────────────────── */
  const SETTIMANA = [1, 2, 3, 4, 5];
  /** un consulente: lavora dal lunedì al venerdì, 09-13 e 14-19 (ore piene) */
  const cons = (id, nome, extra = {}, fasce) => ({
    id,
    user_id: "u-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    data: {
      nome,
      giorniLavorativi: SETTIMANA,
      fasceOrarie: fasce ?? [
        { inizio: "09:00", fine: "13:00" },
        { inizio: "14:00", fine: "19:00" },
      ],
      attivo: true,
      ...extra,
    },
  });
  const FIL = cons("c-fil", "Filippo", { priorita: 3 });
  const BEA = cons("c-bea", "Bea", { priorita: 1 });
  const CARLO = cons("c-carlo", "Carlo", { priorita: 2 });

  /** una consulenza fissata */
  const meet = (id, cid, giorno, ora, extra = {}) => ({
    id,
    data: {
      nome: "Anna",
      cognome: "Prova",
      stato: "appuntamento_fissato",
      consulenteId: cid,
      dataMeeting: giorno,
      oraMeeting: ora,
      durataMeeting: 60,
      ...extra,
    },
  });
  const blocco = (extra) => ({
    id: "b-1",
    quando: "data",
    attivo: true,
    creato: "2026-10-01T00:00:00.000Z",
    ...extra,
  });

  const ADESSO = t("2026-10-27T08:00:00.000Z"); // martedì 27/10, 09:00 a Roma
  const MIN = 60_000;
  const base = (consulente, giorno, extra = {}) => ({
    consulente,
    giorno,
    durata: 60,
    schede: [],
    blocchi: [],
    adesso: ADESSO,
    preavvisoOre: 3,
    ...extra,
  });
  const PIENO = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const liberi = (consulente, giorno, extra) => O.slotLiberiDelGiorno(base(consulente, giorno, extra));
  const senza = (elenco, ...ore) => elenco.filter((o) => !ore.includes(o));

  const prop = (consulenti, fascia, extra = {}) =>
    O.proponi({
      consulenti,
      fascia,
      giorniAvanti: 14,
      mostrati: [],
      schede: [],
      blocchi: [],
      adesso: ADESSO,
      preavvisoOre: 3,
      durata: 60,
      ...extra,
    });
  const og = (g, o) => ({ g, o });
  const ore = (r) => r.proposte.map((p) => `${p.g} ${p.o}`);
  const giorniDi = (r) => r.proposte.map((p) => p.g);
  /** quanti minuti passano da `adesso` all'orario proposto, contati sugli istanti veri
   *  (l'ora solare di fine ottobre è +01:00): non usa il modulo che si sta provando */
  const minutiVeri = (p, adesso = ADESSO) =>
    (new Date(`${p.g}T${p.o}:00+01:00`).getTime() - adesso.getTime()) / MIN;

  /* ════════════════════════════════════════════════════════════════════════
   *  I GIORNI DELLA FINESTRA
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("PRENOTA · GLI ORARI · I GIORNI (prenota-orari.ts)");

  const finestra = O.giorniFinestra(ADESSO, 14);
  c("14 giorni avanti = 15 giorni, oggi compreso", 15, finestra.length);
  c("il primo è oggi, l'ultimo oggi + 14", ["2026-10-27", "2026-11-10"], [finestra[0], finestra.at(-1)]);
  c("zero giorni avanti = solo oggi", ["2026-10-27"], O.giorniFinestra(ADESSO, 0));
  c(
    "attraversa il cambio all'ora solare senza saltare né ripetere",
    ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"],
    O.giorniFinestra(t("2026-10-23T08:00:00.000Z"), 3),
  );
  c(
    "attraversa fine anno",
    ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"],
    O.giorniFinestra(t("2026-12-30T12:00:00.000Z"), 3),
  );
  c(
    "febbraio bisestile",
    ["2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01"],
    O.giorniFinestra(t("2028-02-27T12:00:00.000Z"), 3),
  );
  c(
    "22:30 UTC di fine ottobre è ancora il 27 a Roma (+01:00)",
    ["2026-10-27", "2026-10-28"],
    O.giorniFinestra(t("2026-10-27T22:30:00.000Z"), 1),
  );
  c(
    "23:30 UTC di fine ottobre è già il 28 a Roma",
    ["2026-10-28", "2026-10-29"],
    O.giorniFinestra(t("2026-10-27T23:30:00.000Z"), 1),
  );
  c(
    "22:30 UTC in ora legale (24/10) è già il 25 a Roma",
    ["2026-10-25", "2026-10-26"],
    O.giorniFinestra(t("2026-10-24T22:30:00.000Z"), 1),
  );
  c(
    "vigilia del cambio all'ora legale: 23:30 UTC del 28/3 è il 29/3 a Roma",
    ["2026-03-29", "2026-03-30", "2026-03-31"],
    O.giorniFinestra(t("2026-03-28T23:30:00.000Z"), 2),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  I CONSULENTI PRENOTABILI (D6)
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("PRENOTA · GLI ORARI · I CONSULENTI (D6)");

  const ids = (l) => l.map((x) => x.id);
  c("ordine: priorità crescente", ["c-bea", "c-carlo", "c-fil"], ids(O.consulentiPrenotabili([FIL, CARLO, BEA])));
  c(
    "priorità assente = 1",
    ["x-senza", "c-carlo"],
    ids(O.consulentiPrenotabili([CARLO, cons("x-senza", "Zeno")])),
  );
  c(
    "a parità di priorità: nome alfabetico (maiuscole ininfluenti)",
    ["a-1", "b-1", "z-1"],
    ids(
      O.consulentiPrenotabili([
        cons("z-1", "Zeno", { priorita: 1 }),
        cons("a-1", "bea", { priorita: 1 }),
        cons("b-1", "Carlo", { priorita: 1 }),
      ]),
    ),
  );
  c(
    "a parità di priorità e di nome: l'id",
    ["id-1", "id-2"],
    ids(
      O.consulentiPrenotabili([
        cons("id-2", "Bea", { priorita: 1 }),
        cons("id-1", "Bea", { priorita: 1 }),
      ]),
    ),
  );
  c(
    "non attivo: fuori",
    ["c-bea"],
    ids(O.consulentiPrenotabili([BEA, cons("x-1", "Dino", { attivo: false })])),
  );
  c(
    "in attesa di approvazione o rifiutato: fuori",
    ["c-bea"],
    ids(
      O.consulentiPrenotabili([
        BEA,
        cons("x-1", "Dino", { approvalStatus: "pending" }),
        cons("x-2", "Elio", { approvalStatus: "rejected" }),
      ]),
    ),
  );
  c(
    "approvato o senza stato: dentro",
    ["c-bea", "x-1"],
    ids(O.consulentiPrenotabili([cons("x-1", "Dino", { approvalStatus: "approved", priorita: 2 }), BEA])),
  );
  const entrata = [FIL, BEA];
  O.consulentiPrenotabili(entrata);
  c("non cambia l'elenco che riceve", ["c-fil", "c-bea"], ids(entrata));
  c("elenco vuoto", [], O.consulentiPrenotabili([]));

  /* ════════════════════════════════════════════════════════════════════════
   *  GLI ORARI LIBERI DI UN CONSULENTE (D1, D5)
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("PRENOTA · GLI ORARI · LIBERI DI UN CONSULENTE (uno per ora)");

  const G = "2026-10-28"; // mercoledì
  c("agenda vuota: tutte le ore piene del suo orario", PIENO, liberi(FIL, G));
  c("sabato e domenica: non lavora", [[], []], [liberi(FIL, "2026-10-31"), liberi(FIL, "2026-11-01")]);
  c("giorno illeggibile: niente", [], liberi(FIL, "28/10/2026"));

  c(
    "una persona già alle 18:00: le 18:00 non si propongono",
    senza(PIENO, "18:00"),
    liberi(FIL, G, { schede: [meet("l-1", "c-fil", G, "18:00")] }),
  );
  c(
    "un secondo lead alla stessa ora (stato «insieme» dell'agenda) non cambia: resta occupata",
    senza(PIENO, "18:00"),
    liberi(FIL, G, { schede: [meet("l-1", "c-fil", G, "18:00"), meet("l-2", "c-fil", G, "18:00")] }),
  );
  c(
    "la prova non passa nessun «modo»: l'ora tenuta per uno solo, senza nessuno, è libera",
    true,
    liberi(FIL, G).includes("17:00"),
  );
  c(
    "una consulenza delle 17:30 copre le 17:00 e le 18:00",
    senza(PIENO, "17:00", "18:00"),
    liberi(FIL, G, { schede: [meet("l-1", "c-fil", G, "17:30")] }),
  );
  c(
    "una consulenza delle 16:00 (finisce alle 17:00 spaccate) toglie solo le 16:00",
    senza(PIENO, "16:00"),
    liberi(FIL, G, { schede: [meet("l-1", "c-fil", G, "16:00")] }),
  );
  c(
    "una consulenza lunga 2 ore alle 10:00 toglie le 10:00 e le 11:00",
    senza(PIENO, "10:00", "11:00"),
    liberi(FIL, G, { schede: [meet("l-1", "c-fil", G, "10:00", { durataMeeting: 120 })] }),
  );
  c(
    "la consulenza di un altro consulente non occupa Filippo",
    PIENO,
    liberi(FIL, G, { schede: [meet("l-1", "c-bea", G, "18:00")] }),
  );
  c(
    "la consulenza di un altro giorno non occupa",
    PIENO,
    liberi(FIL, G, { schede: [meet("l-1", "c-fil", "2026-10-29", "18:00")] }),
  );
  c(
    "il lead che sta prenotando (escludiLeadId) non occupa il suo stesso orario",
    PIENO,
    liberi(FIL, G, { schede: [meet("l-1", "c-fil", G, "18:00")], escludiLeadId: "l-1" }),
  );
  c(
    "escludiLeadId non libera il posto di un altro lead",
    senza(PIENO, "18:00"),
    liberi(FIL, G, { schede: [meet("l-1", "c-fil", G, "18:00")], escludiLeadId: "l-9" }),
  );
  c(
    "visita in sede alle 12:00: non si propone",
    senza(PIENO, "12:00"),
    liberi(FIL, G, {
      schede: [{ id: "s-1", data: { stato: "visita_in_sede", consulenteId: "c-fil", dataVieneInSede: G, oraVieneInSede: "12:00" } }],
    }),
  );
  const posa = (extra) => ({
    id: "p-1",
    data: {
      stato: "concluso",
      consulenteId: "c-fil",
      installazione: {
        dataInstallazione: G,
        orarioInstallazione: "15:00",
        durataInstallazione: 60,
        consulenteInstallazioneId: "c-fil",
        ...extra,
      },
    },
  });
  const conPosa = liberi(FIL, G, { schede: [posa()] });
  c("una posa fissata: le 15:00 non si propongono (anche se il cliente è «concluso»)", false, conPosa.includes("15:00"));
  c("una posa fissata: la mattina resta libera", true, conPosa.includes("10:00"));
  c(
    "la posa di un collega che non ci riguarda non occupa",
    PIENO,
    liberi(FIL, G, { schede: [posa({ consulenteInstallazioneId: "c-bea" })] }),
  );
  const manut = (stato, ora, cid = "c-fil") => ({
    id: "m-1",
    data: {
      stato: "concluso",
      consulenteId: "c-bea",
      manutenzione: { appuntamenti: [{ id: "ap-1", stato, data: G, ora, durata: 60, consulenteId: cid }] },
    },
  });
  c(
    "una manutenzione fissata alle 10:00 non si propone",
    false,
    liberi(FIL, G, { schede: [manut("fissata", "10:00")] }).includes("10:00"),
  );
  c(
    "un promemoria di manutenzione (da fissare) non occupa",
    PIENO,
    liberi(FIL, G, { schede: [manut("da_fissare", "10:00")] }),
  );
  c(
    "la manutenzione di un altro esecutore non occupa",
    PIENO,
    liberi(FIL, G, { schede: [manut("fissata", "10:00", "c-carlo")] }),
  );
  const conPausa = cons("c-p", "Pia", { pause: [{ giorno: 3, inizio: "14:00", fine: "15:00" }] });
  c("pausa del mercoledì 14-15: le 14:00 no", senza(PIENO, "14:00"), liberi(conPausa, G));
  const conPausaOggetto = cons("c-p", "Pia", { pause: { 3: [{ giorno: 3, inizio: "14:00", fine: "15:00" }] } });
  c("pausa nella seconda forma del database (oggetto per giorno)", senza(PIENO, "14:00"), liberi(conPausaOggetto, G));
  c(
    "indisponibilità 16-17: le 16:00 no",
    senza(PIENO, "16:00"),
    liberi(cons("c-i", "Ida", { indisponibilita: [{ data: G, inizio: "16:00", fine: "17:00" }] }), G),
  );
  c(
    "indisponibilità di tutto il giorno: niente",
    [],
    liberi(cons("c-i", "Ida", { indisponibilita: [{ data: G }] }), G),
  );

  /* stati che liberano lo slot */
  for (const stato of ["no_show", "da_spostare", "non_fatto", "annullato", "perdi_tempo", "irreperibile", "concluso", "sede_disdetta", "fissa_meet_dopo"]) {
    c(
      `stato «${stato}»: la data vecchia non occupa`,
      PIENO,
      liberi(FIL, G, { schede: [meet("l-1", "c-fil", G, "18:00", { stato })] }),
    );
  }
  c(
    "uno stato mai visto tiene l'orario (meglio un orario in meno che due clienti alla stessa ora)",
    senza(PIENO, "18:00"),
    liberi(FIL, G, { schede: [meet("l-1", "c-fil", G, "18:00", { stato: "stato_inventato" })] }),
  );

  /* blocchi della disponibilità (D5) */
  c(
    "chiusura del centro (blocco di data, tutto il giorno): niente",
    [],
    liberi(FIL, G, { blocchi: [blocco({ data: G })] }),
  );
  c(
    "blocco con orari 10-12: le 10:00 e le 11:00 no, le 12:00 sì",
    senza(PIENO, "10:00", "11:00"),
    liberi(FIL, G, { blocchi: [blocco({ data: G, inizio: "10:00", fine: "12:00" })] }),
  );
  c(
    "blocco che inizia a metà (10:30-11:30): toglie le 10:00 e le 11:00",
    senza(PIENO, "10:00", "11:00"),
    liberi(FIL, G, { blocchi: [blocco({ data: G, inizio: "10:30", fine: "11:30" })] }),
  );
  c(
    "blocco settimanale del mercoledì: niente",
    [],
    liberi(FIL, G, { blocchi: [blocco({ quando: "settimanale", dow: 3 })] }),
  );
  c(
    "blocco settimanale del mercoledì: giovedì è libero",
    PIENO,
    liberi(FIL, "2026-10-29", { blocchi: [blocco({ quando: "settimanale", dow: 3 })] }),
  );
  c(
    "blocco scaduto: non toglie niente",
    PIENO,
    liberi(FIL, G, { blocchi: [blocco({ data: G, scadenza: "2026-10-26" })] }),
  );
  c(
    "blocco spento a mano: non toglie niente",
    PIENO,
    liberi(FIL, G, { blocchi: [blocco({ data: G, attivo: false })] }),
  );
  c(
    "blocco con scadenza illeggibile: resta in piedi (prudenza)",
    [],
    liberi(FIL, G, { blocchi: [blocco({ data: G, scadenza: "boh" })] }),
  );
  c(
    "blocco di un altro consulente: non riguarda Filippo",
    PIENO,
    liberi(FIL, G, { blocchi: [blocco({ data: G, consulenteId: "c-bea" })] }),
  );
  c(
    "blocco proprio di Filippo: niente",
    [],
    liberi(FIL, G, { blocchi: [blocco({ data: G, consulenteId: "c-fil" })] }),
  );
  c(
    "«oggi» del blocco è il giorno di Roma: a Roma è già il 28, la scadenza del 27 è passata",
    true,
    liberi(FIL, G, {
      adesso: t("2026-10-27T23:30:00.000Z"),
      blocchi: [blocco({ quando: "settimanale", dow: 3, scadenza: "2026-10-27" })],
    }).includes("09:00"),
  );
  c(
    "...e alle 21:00 Roma del 27 la stessa scadenza vale ancora",
    [],
    liberi(FIL, G, {
      adesso: t("2026-10-27T20:00:00.000Z"),
      blocchi: [blocco({ quando: "settimanale", dow: 3, scadenza: "2026-10-27" })],
    }),
  );
  c(
    "oggiRoma passato dal chiamante vince su quello ricavato da adesso",
    PIENO,
    liberi(FIL, G, {
      oggiRoma: "2026-10-28",
      blocchi: [blocco({ data: G, scadenza: "2026-10-27" })],
    }),
  );

  /* preavviso, in ora di Roma */
  const OGGI28 = { giorno: G };
  c(
    "preavviso: alle 07:00 di Roma, 3 ore dopo = le 10:00 (comprese), le 09:00 no",
    senza(PIENO, "09:00"),
    liberi(FIL, OGGI28.giorno, { adesso: t("2026-10-28T06:00:00.000Z") }),
  );
  c(
    "preavviso: un minuto in più e anche le 10:00 saltano",
    senza(PIENO, "09:00", "10:00"),
    liberi(FIL, G, { adesso: t("2026-10-28T06:01:00.000Z") }),
  );
  c("preavviso: il giorno è passato", [], liberi(FIL, "2026-10-27", { adesso: t("2026-10-27T20:00:00.000Z") }));
  c(
    "preavviso di 1 ora (configurabile)",
    senza(PIENO, "09:00"),
    liberi(FIL, G, { adesso: t("2026-10-28T07:30:00.000Z"), preavvisoOre: 1 }),
  );
  c(
    "durata 30: ore e mezze (le 09:00 e le 09:30)",
    true,
    O.slotLiberiDelGiorno(base(FIL, G, { durata: 30 })).slice(0, 2).join() === "09:00,09:30",
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  PROPORRE (D10, D11, SPEC 3.2, 3.4)
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("PRENOTA · GLI ORARI · LE TRE PROPOSTE");

  const sera = prop([FIL], "sera");
  c(
    "«sera»: 3 orari su 3 giorni diversi, i più vicini, alle 17:00",
    ["2026-10-27 17:00", "2026-10-28 17:00", "2026-10-29 17:00"],
    ore(sera),
  );
  c("«sera»: tutti con inizio dalle 17:00", true, sera.proposte.every((p) => p.o >= "17:00"));
  c("«sera»: tutti ad almeno 3 ore da adesso (istanti veri)", true, sera.proposte.every((p) => minutiVeri(p) >= 180));
  c(
    "«sera»: fascia effettiva sera, nessun ripiego, non finiti",
    { fasciaEffettiva: "sera", ripiego: false, finiti: false },
    { fasciaEffettiva: sera.fasciaEffettiva, ripiego: sera.ripiego, finiti: sera.finiti },
  );
  const mattina = prop([FIL], "mattina");
  c(
    "«mattina»: dalle 08:00 alle 12:59; oggi solo le 12:00 (3 ore esatte)",
    ["2026-10-27 12:00", "2026-10-28 09:00", "2026-10-29 09:00"],
    ore(mattina),
  );
  c("«mattina»: inizio fra 08:00 e 12:59", true, mattina.proposte.every((p) => p.o >= "08:00" && p.o <= "12:59"));
  c("«mattina»: tutti ad almeno 3 ore da adesso", true, mattina.proposte.every((p) => minutiVeri(p) >= 180));
  c(
    "«pomeriggio»: 13:00-16:59",
    ["2026-10-27 14:00", "2026-10-28 14:00", "2026-10-29 14:00"],
    ore(prop([FIL], "pomeriggio")),
  );
  c(
    "le proposte sono in ordine di data e ora",
    ore(sera),
    [...ore(sera)].sort(),
  );
  c(
    "ogni orario proposto è libero per qualcuno (stessa regola di slotLiberiDelGiorno)",
    true,
    sera.proposte.every((p) => liberi(FIL, p.g).includes(p.o)),
  );

  /* gli estremi delle fasce, un orario alla volta */
  const unSlot = (ora) => {
    const [h, m] = ora.split(":").map(Number);
    const fine = `${String(Math.floor((h * 60 + m + 60) / 60)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return cons("c-u", "Uno", {}, [{ inizio: ora, fine }]);
  };
  const dove = (ora) => {
    const cercate = ["mattina", "pomeriggio", "sera"].filter((f) => {
      const r = prop([unSlot(ora)], f, { giorniAvanti: 1, adesso: t("2026-10-27T05:00:00.000Z") });
      return !r.ripiego && r.proposte.length > 0;
    });
    return cercate;
  };
  c("estremi: 07:59 non è in nessuna fascia", [], dove("07:59"));
  c("estremi: 08:00 è mattina", ["mattina"], dove("08:00"));
  c("estremi: 12:59 è ancora mattina", ["mattina"], dove("12:59"));
  c("estremi: 13:00 è pomeriggio", ["pomeriggio"], dove("13:00"));
  c("estremi: 16:59 è ancora pomeriggio", ["pomeriggio"], dove("16:59"));
  c("estremi: 17:00 è sera", ["sera"], dove("17:00"));
  c("estremi: 22:00 è sera", ["sera"], dove("22:00"));

  /* l'unione dei consulenti */
  c(
    "unisce i consulenti: se Filippo è pieno alle 17:00 di oggi ma Bea è libera, l'orario si propone",
    "2026-10-27 17:00",
    ore(
      prop([FIL, BEA], "sera", { schede: [meet("l-1", "c-fil", "2026-10-27", "17:00")] }),
    )[0],
  );
  c(
    "l'orario compare una volta sola anche se lo hanno liberi in due",
    ["2026-10-27 17:00", "2026-10-28 17:00", "2026-10-29 17:00"],
    ore(prop([FIL, BEA, CARLO], "sera")),
  );
  c(
    "se tutti i consulenti sono pieni alle 17:00 di oggi, oggi si propongono le 18:00",
    "2026-10-27 18:00",
    ore(
      prop([FIL, BEA], "sera", {
        schede: [meet("l-1", "c-fil", "2026-10-27", "17:00"), meet("l-2", "c-bea", "2026-10-27", "17:00")],
      }),
    )[0],
  );
  c(
    "consulenti non prenotabili (non attivi, in attesa) non danno orari",
    [],
    prop([cons("x", "Dino", { attivo: false }), cons("y", "Elio", { approvalStatus: "pending" })], "sera").proposte,
  );
  c(
    "una chiusura del centro toglie il giorno dalle proposte",
    ["2026-10-27 17:00", "2026-10-29 17:00", "2026-10-30 17:00"],
    ore(prop([FIL], "sera", { blocchi: [blocco({ data: "2026-10-28" })] })),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  «ALTRI»: PAGINE, MOSTRATI, GIORNI MAI PROPOSTI (D11)
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("PRENOTA · GLI ORARI · ALTRI (pagine senza ripetere)");

  const p1 = prop([FIL], "sera");
  const p2 = prop([FIL], "sera", { mostrati: p1.proposte });
  const p3 = prop([FIL], "sera", { mostrati: [...p1.proposte, ...p2.proposte] });
  c("pagina 2: giorni nuovi, in avanti", ["2026-10-30 17:00", "2026-11-02 17:00", "2026-11-03 17:00"], ore(p2));
  c("pagina 3: giorni ancora nuovi", ["2026-11-04 17:00", "2026-11-05 17:00", "2026-11-06 17:00"], ore(p3));
  const tutte = [...ore(p1), ...ore(p2), ...ore(p3)];
  c("nove orari diversi, nessuna ripetizione", 9, new Set(tutte).size);
  c("pagina 2 e 3: non finiti", [false, false], [p2.finiti, p3.finiti]);
  c("pagina 2: fascia effettiva ancora sera, nessun ripiego", ["sera", false], [p2.fasciaEffettiva, p2.ripiego]);

  const mostrati9 = [...p1.proposte, ...p2.proposte, ...p3.proposte];
  const p4 = prop([FIL], "sera", { mostrati: mostrati9 });
  c(
    "i giorni mai proposti vengono prima di quelli già proposti: la 4ª pagina ha 9 e 10 novembre e solo dopo il 27 ottobre alle 18:00",
    ["2026-10-27 18:00", "2026-11-09 17:00", "2026-11-10 17:00"],
    ore(p4),
  );
  c(
    "un solo orario mostrato (oggi 17:00): le tre proposte nuove sono su giorni nuovi, non sulle 18:00 di oggi",
    ["2026-10-28 17:00", "2026-10-29 17:00", "2026-10-30 17:00"],
    ore(prop([FIL], "sera", { mostrati: [og("2026-10-27", "17:00")] })),
  );
  const tuttiLiberiSera = [];
  for (const g of finestra) for (const o of liberi(FIL, g, {}).filter((x) => x >= "17:00")) tuttiLiberiSera.push(og(g, o));
  c("in tutta la finestra Filippo ha 22 orari di sera", 22, tuttiLiberiSera.length);
  const finita = prop([FIL], "sera", { mostrati: tuttiLiberiSera });
  c(
    "tutti gli orari già mostrati: finiti, nessuna proposta, nessun ripiego",
    { proposte: [], fasciaEffettiva: "sera", ripiego: false, finiti: true },
    finita,
  );
  const quasi = prop([FIL], "sera", { mostrati: tuttiLiberiSera.slice(0, -1) });
  c("ne resta uno: una proposta sola, e non finiti", [1, false], [quasi.proposte.length, quasi.finiti]);

  /* meno di 3 giorni: si completa con altri orari degli stessi giorni */
  const SOLO_LUNEDI = cons("c-lun", "Lia", { giorniLavorativi: [1] });
  const l1 = prop([SOLO_LUNEDI], "sera");
  c(
    "due soli giorni con posto: due orari e il terzo è un altro orario di uno dei due giorni",
    ["2026-11-02 17:00", "2026-11-02 18:00", "2026-11-09 17:00"],
    ore(l1),
  );
  c("...e non è «finiti»", false, l1.finiti);
  const l2 = prop([SOLO_LUNEDI], "sera", { mostrati: l1.proposte });
  c("pagina successiva: resta l'ultimo", ["2026-11-09 18:00"], ore(l2));
  c(
    "e poi finiti",
    { proposte: [], finiti: true },
    (({ proposte, finiti }) => ({ proposte, finiti }))(prop([SOLO_LUNEDI], "sera", { mostrati: [...l1.proposte, ...l2.proposte] })),
  );
  const unGiorno = cons("c-uno", "Uno", { giorniLavorativi: [2] });
  c(
    "un solo giorno con posto: tutti gli orari di quel giorno (anche solo 1)",
    ["2026-10-27 17:00", "2026-10-27 18:00"],
    ore(prop([unGiorno], "sera", { giorniAvanti: 3 })),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  RIPIEGO SU UN'ALTRA FASCIA (D10)
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("PRENOTA · GLI ORARI · FASCIA DI RIPIEGO (D10)");

  const SOLO_MATTINA = cons("c-m", "Mia", {}, [{ inizio: "09:00", fine: "13:00" }]);
  const MATTINA_E_POMERIGGIO = cons("c-mp", "Mara", {}, [{ inizio: "09:00", fine: "16:00" }]);
  const POMERIGGIO_E_SERA = cons("c-ps", "Pino", {}, [{ inizio: "14:00", fine: "19:00" }]);
  const MATTINA_E_SERA = cons("c-ms", "Sole", {}, [
    { inizio: "09:00", fine: "13:00" },
    { inizio: "17:00", fine: "19:00" },
  ]);
  const SOLO_SERA = cons("c-s", "Sara", {}, [{ inizio: "17:00", fine: "19:00" }]);
  const ripiego = (consulenti, fascia, extra) => {
    const r = prop(consulenti, fascia, extra);
    return [r.fasciaEffettiva, r.ripiego, r.proposte.length];
  };
  c("sera vuota, pomeriggio no, mattina sì: ripiego sulla mattina", ["mattina", true, 3], ripiego([SOLO_MATTINA], "sera"));
  c("sera vuota, pomeriggio sì: ripiego sul pomeriggio (prima della mattina)", ["pomeriggio", true, 3], ripiego([MATTINA_E_POMERIGGIO], "sera"));
  c("mattina vuota: prima il pomeriggio", ["pomeriggio", true, 3], ripiego([POMERIGGIO_E_SERA], "mattina"));
  c("mattina vuota, pomeriggio vuoto: poi la sera", ["sera", true, 3], ripiego([SOLO_SERA], "mattina"));
  c("pomeriggio vuoto: prima la sera (non la mattina)", ["sera", true, 3], ripiego([MATTINA_E_SERA], "pomeriggio"));
  c("pomeriggio e sera vuoti: poi la mattina", ["mattina", true, 3], ripiego([SOLO_MATTINA], "pomeriggio"));
  c("la fascia chiesta ha posto: nessun ripiego", ["sera", false, 3], ripiego([MATTINA_E_SERA], "sera"));
  c(
    "il ripiego rispetta i mostrati e li esclude",
    ["2026-10-28 09:00", "2026-10-29 09:00", "2026-10-30 09:00"],
    ore(prop([SOLO_MATTINA], "sera", { mostrati: [og("2026-10-27", "12:00")] })),
  );
  const nulla = prop([], "sera");
  c(
    "nessun consulente: niente proposte, finiti, fascia chiesta, nessun ripiego",
    { proposte: [], fasciaEffettiva: "sera", ripiego: false, finiti: true },
    nulla,
  );
  c(
    "niente in nessuna fascia (tutto chiuso): niente proposte",
    { proposte: [], fasciaEffettiva: "mattina", ripiego: false, finiti: true },
    prop([FIL], "mattina", { blocchi: [blocco({ quando: "settimanale", dow: 1 }), blocco({ id: "b-2", quando: "settimanale", dow: 2 }), blocco({ id: "b-3", quando: "settimanale", dow: 3 }), blocco({ id: "b-4", quando: "settimanale", dow: 4 }), blocco({ id: "b-5", quando: "settimanale", dow: 5 })] }),
  );
  c(
    "finestra troppo corta (solo oggi, ormai sera): la mattina è vuota e si ripiega",
    ["pomeriggio", true],
    (({ fasciaEffettiva, ripiego }) => [fasciaEffettiva, ripiego])(
      prop([FIL], "mattina", { giorniAvanti: 0, adesso: t("2026-10-27T10:00:00.000Z") }),
    ),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  ORARIO DI ROMA E NON DEL SERVER
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("PRENOTA · GLI ORARI · FUSI (Roma, mai il server)");

  const TUTTI = SETTIMANA.concat([0, 6]);
  const SEMPRE = cons("c-sempre", "Sempre", { giorniLavorativi: TUTTI });
  const notte = prop([SEMPRE], "mattina", { adesso: t("2026-10-27T23:30:00.000Z"), giorniAvanti: 3 });
  c(
    "23:30 UTC (a Roma già il 28, mezzanotte e mezza): la mattina parte dal 28",
    ["2026-10-28 09:00", "2026-10-29 09:00", "2026-10-30 09:00"],
    ore(notte),
  );
  c(
    "...e la sera di «oggi» (28) è proponibile",
    "2026-10-28 17:00",
    ore(prop([SEMPRE], "sera", { adesso: t("2026-10-27T23:30:00.000Z") }))[0],
  );
  c(
    "22:30 UTC = 23:30 a Roma del 27: oggi non ha più orari, si parte dal 28",
    ["2026-10-28 09:00", "2026-10-29 09:00", "2026-10-30 09:00"],
    ore(prop([SEMPRE], "mattina", { adesso: t("2026-10-27T22:30:00.000Z") })),
  );
  const marzo = prop([SEMPRE], "sera", { adesso: t("2026-03-28T23:30:00.000Z"), giorniAvanti: 3 });
  c(
    "vigilia del cambio d'ora: 23:30 UTC del 28/3 = 00:30 del 29/3 a Roma, la sera di domenica 29 c'è",
    ["2026-03-29 17:00", "2026-03-30 17:00", "2026-03-31 17:00"],
    ore(marzo),
  );
  c(
    "...e la mattina del 29/3 con 3 ore di preavviso parte dalle 09:00",
    "2026-03-29 09:00",
    ore(prop([SEMPRE], "mattina", { adesso: t("2026-03-28T23:30:00.000Z") }))[0],
  );
  c(
    "oggi pomeriggio: alle 14:30 di Roma (13:30 UTC) il primo orario di sera è alle 18:00 (17:00 è a 2,5 ore)",
    "2026-10-27 18:00",
    ore(prop([FIL], "sera", { adesso: t("2026-10-27T13:30:00.000Z") }))[0],
  );
  c(
    "...alle 14:00 di Roma (13:00 UTC) le 17:00 sono a 3 ore esatte e ci sono",
    "2026-10-27 17:00",
    ore(prop([FIL], "sera", { adesso: t("2026-10-27T13:00:00.000Z") }))[0],
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  IL CONSULENTE PER L'ORARIO SCELTO (D6)
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("PRENOTA · GLI ORARI · SCEGLIERE IL CONSULENTE (Filippo per primo)");

  const OR = "17:00";
  const scegli = (consulenti, extra = {}) =>
    O.scegliConsulente({
      consulenti,
      giorno: G,
      ora: OR,
      durata: 60,
      schede: [],
      blocchi: [],
      adesso: ADESSO,
      preavvisoOre: 3,
      preferito: "",
      ...extra,
    })?.id ?? null;
  const occupa = (...cids) => cids.map((cid, i) => meet(`o-${i}`, cid, G, OR));

  c("Filippo e un collega liberi: Filippo (anche con priorità peggiore)", "c-fil", scegli([BEA, CARLO, FIL]));
  c("Filippo pieno: il primo collega per priorità", "c-bea", scegli([FIL, CARLO, BEA], { schede: occupa("c-fil") }));
  c("Filippo e Bea pieni: Carlo", "c-carlo", scegli([FIL, CARLO, BEA], { schede: occupa("c-fil", "c-bea") }));
  c("tutti pieni: nessuno", null, scegli([FIL, CARLO, BEA], { schede: occupa("c-fil", "c-bea", "c-carlo") }));
  c(
    "due colleghi a pari priorità: l'ordine alfabetico",
    "c-bea",
    scegli([cons("c-zeno", "Zeno", { priorita: 1 }), cons("c-bea", "Bea", { priorita: 1 })]),
  );
  c(
    "Filippo non attivo: non entra",
    "c-bea",
    scegli([cons("c-fil", "Filippo", { attivo: false }), BEA]),
  );
  c(
    "Filippo in attesa di approvazione: non entra",
    "c-bea",
    scegli([cons("c-fil", "Filippo", { approvalStatus: "pending" }), BEA]),
  );
  c(
    "Filippo che non lavora quel giorno: il collega",
    "c-bea",
    scegli([cons("c-fil", "Filippo", { giorniLavorativi: [1] }), BEA]),
  );
  c(
    "Filippo con una chiusura sua: il collega",
    "c-bea",
    scegli([FIL, BEA], { blocchi: [blocco({ data: G, consulenteId: "c-fil" })] }),
  );
  c(
    "il nome si legge senza maiuscole e spazi attorno",
    "c-fil",
    scegli([BEA, cons("c-fil", "  FILIPPO ", { priorita: 5 })]),
  );
  c(
    "«Filippo Demo» (nome e cognome): è Filippo",
    "c-fil",
    scegli([BEA, cons("c-fil", "Filippo Demo", { priorita: 5 })]),
  );
  c(
    "«Filippone» non è Filippo",
    "c-bea",
    scegli([BEA, cons("c-fil", "Filippone", { priorita: 5 })]),
  );
  c(
    "due Filippo (attivi): nessuna preferenza, vale la priorità",
    "c-carlo",
    scegli([cons("c-fil2", "Filippo B", { priorita: 3 }), cons("c-fil1", "Filippo A", { priorita: 2 }), cons("c-carlo", "Carlo", { priorita: 1 })]),
  );
  c(
    "un secondo Filippo non attivo non toglie la preferenza al primo",
    "c-fil",
    scegli([BEA, cons("c-fil", "Filippo", { priorita: 5 }), cons("c-fil2", "Filippo", { attivo: false })]),
  );
  c("preferito per id: viene prima di Filippo", "c-carlo", scegli([FIL, BEA, CARLO], { preferito: "c-carlo" }));
  c(
    "preferito per id ma pieno: il primo per priorità (Filippo non conta più, il preferito è un altro)",
    "c-bea",
    scegli([FIL, BEA, CARLO], { preferito: "c-carlo", schede: occupa("c-carlo") }),
  );
  c(
    "preferito per id di uno non prenotabile: nessuna preferenza, vale la priorità",
    "c-bea",
    scegli([FIL, BEA, cons("c-x", "Xavier", { attivo: false })], { preferito: "c-x" }),
  );
  c(
    "preferito per id inesistente: nessuna preferenza, vale la priorità",
    "c-bea",
    scegli([FIL, BEA], { preferito: "non-c-e" }),
  );
  c(
    "preferito per id con due Filippo: l'id decide",
    "c-fil2",
    scegli([cons("c-fil1", "Filippo", {}), cons("c-fil2", "Filippo", {})], { preferito: "c-fil2" }),
  );
  c("nessun consulente: nessuno", null, scegli([]));
  c("fuori dall'orario di lavoro: nessuno", null, scegli([FIL, BEA], { ora: "21:00" }));
  c("meno di 3 ore: nessuno", null, scegli([FIL, BEA], { adesso: t("2026-10-28T13:01:00.000Z") }));
  c("proprio 3 ore: sì", "c-fil", scegli([FIL, BEA], { adesso: t("2026-10-28T13:00:00.000Z") }));
  c(
    "il lead che prenota non occupa: con escludiLeadId resta Filippo",
    "c-fil",
    scegli([FIL, BEA], { schede: [meet("l-me", "c-fil", G, OR)], escludiLeadId: "l-me" }),
  );
  c(
    "senza escludiLeadId la sua stessa scheda tiene l'ora e va a un collega",
    "c-bea",
    scegli([FIL, BEA], { schede: [meet("l-me", "c-fil", G, OR)] }),
  );

  /* ancoraLibero */
  const an = (consulente, extra = {}) => O.ancoraLibero({ ...base(consulente, G, extra), ora: OR });
  c("ancoraLibero: agenda vuota", true, an(FIL));
  c("ancoraLibero: preso da un altro lead", false, an(FIL, { schede: occupa("c-fil") }));
  c("ancoraLibero: preso da un lead che sono io (escludiLeadId)", true, an(FIL, { schede: [meet("l-me", "c-fil", G, OR)], escludiLeadId: "l-me" }));
  c("ancoraLibero: preso da un lead di un altro consulente non conta", true, an(FIL, { schede: occupa("c-bea") }));
  c("ancoraLibero: coperto da una consulenza delle 16:30", false, an(FIL, { schede: [meet("o-1", "c-fil", G, "16:30")] }));
  c("ancoraLibero: dentro una chiusura", false, an(FIL, { blocchi: [blocco({ data: G })] }));
  c("ancoraLibero: troppo vicino (meno di 3 ore)", false, an(FIL, { adesso: t("2026-10-28T13:30:00.000Z") }));
  c("ancoraLibero: ora che non è nella sua griglia", false, O.ancoraLibero({ ...base(FIL, G), ora: "17:30" }));
  c("ancoraLibero: giorno non lavorativo", false, O.ancoraLibero({ ...base(FIL, "2026-10-31"), ora: OR }));

  /* ════════════════════════════════════════════════════════════════════════
   *  PRESTAZIONI
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("PRENOTA · GLI ORARI · PRESTAZIONI (3.000 schede, 5 consulenti, 14 giorni)");

  const cinque = ["c-fil", "c-bea", "c-carlo", "c-dina", "c-enzo"].map((id, i) =>
    cons(id, id.slice(2), { priorita: i }),
  );
  const molte = [];
  for (let i = 0; i < 2600; i++) {
    // schede vecchie o lontane: ci sono ma non toccano la finestra
    molte.push(meet(`v-${i}`, cinque[i % 5].id, `2026-0${1 + (i % 9)}-${String(1 + (i % 27)).padStart(2, "0")}`, "10:00"));
  }
  const ORE_PIENE = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  for (let i = 0; i < 400; i++) {
    const g = finestra[i % finestra.length];
    molte.push(meet(`f-${i}`, cinque[(i * 3) % 5].id, g, ORE_PIENE[(i * 7) % ORE_PIENE.length]));
  }
  c("le schede finte sono 3.000, 400 nella finestra", [3000, 400], [molte.length, molte.filter((x) => x.id.startsWith("f-")).length]);
  const misura = (fascia, mostrati = []) => {
    let migliore = Infinity;
    let r;
    for (let k = 0; k < 3; k++) {
      const da = performance.now();
      r = prop(cinque, fascia, { schede: molte, mostrati });
      migliore = Math.min(migliore, performance.now() - da);
    }
    return { ms: migliore, r };
  };
  const lenta = misura("sera");
  console.log(`      (sera, miglior tempo su 3: ${lenta.ms.toFixed(1)} ms)`);
  c("proponi «sera» sotto i 400 ms", true, lenta.ms < 400);
  c("...e dà ancora tre proposte", 3, lenta.r.proposte.length);
  const lenta2 = misura("mattina", lenta.r.proposte);
  console.log(`      (mattina con mostrati, miglior tempo su 3: ${lenta2.ms.toFixed(1)} ms)`);
  c("proponi «mattina» con mostrati sotto i 400 ms", true, lenta2.ms < 400);
  const da0 = performance.now();
  for (let k = 0; k < 5; k++) O.scegliConsulente({ consulenti: cinque, giorno: G, ora: "17:00", durata: 60, schede: molte, blocchi: [], adesso: ADESSO, preavvisoOre: 3, preferito: "" });
  const scegliMs = (performance.now() - da0) / 5;
  console.log(`      (scegliConsulente, media su 5: ${scegliMs.toFixed(1)} ms)`);
  c("scegliConsulente sotto i 100 ms", true, scegliMs < 100);

  /* ════════════════════════════════════════════════════════════════════════
   *  IL FUSO DEL SERVER NON CAMBIA NIENTE
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("PRENOTA · GLI ORARI · LO STESSO RISULTATO CON ALTRI FUSI");

  const sorgente = readFileSync(join(radice, "src/crm/manychat/prenota-orari.ts"), "utf8");
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c(
    "il modulo non legge mai l'orologio o le date col fuso del server",
    [],
    [
      /toISOString\s*\(\s*\)\s*\.slice/,
      /\.getHours\s*\(/,
      /\.getDate\s*\(/,
      /\.getDay\s*\(/,
      /\.getMonth\s*\(/,
      /\.getFullYear\s*\(/,
      /toLocale\w*\s*\(/,
      /getTimezoneOffset/,
      /new Date\s*\(\s*\)/,
      /Date\.now\s*\(/,
    ]
      .filter((re) => re.test(codice))
      .map(String),
  );

  const dir = mkdtempSync(join(tmpdir(), "prova-orari-"));
  try {
    const fuori = join(dir, "orari.cjs");
    execFileSync(
      "npx",
      [
        "esbuild",
        "src/crm/manychat/prenota-orari.ts",
        "--bundle",
        "--format=cjs",
        `--outfile=${fuori}`,
        "--loader:.tsx=tsx",
        "--alias:@=./src",
        "--log-level=error",
      ],
      { cwd: radice, stdio: ["ignore", "ignore", "inherit"] },
    );
    const script = join(dir, "gira.cjs");
    writeFileSync(
      script,
      `const O = require(${JSON.stringify(fuori)});
const cons = (id, nome, extra) => ({ id, user_id: "u", created_at: "", updated_at: "", data: { nome, giorniLavorativi: [0,1,2,3,4,5,6], fasceOrarie: [{inizio:"09:00",fine:"13:00"},{inizio:"14:00",fine:"19:00"}], attivo: true, ...extra } });
const A = cons("a", "Filippo", { priorita: 2 }), B = cons("b", "Bea", { priorita: 1 });
const meet = (id, cid, g, o) => ({ id, data: { stato: "appuntamento_fissato", consulenteId: cid, dataMeeting: g, oraMeeting: o, durataMeeting: 60 } });
const risultato = {};
for (const [nome, iso] of [["notte", "2026-10-27T23:30:00.000Z"], ["marzo", "2026-03-28T23:30:00.000Z"], ["giorno", "2026-10-27T08:00:00.000Z"]]) {
  const adesso = new Date(iso);
  const schede = [meet("l1", "a", "2026-10-29", "17:00"), meet("l2", "b", "2026-10-29", "17:00")];
  const blocchi = [{ id: "b1", quando: "settimanale", dow: 3, scadenza: "2026-10-27", attivo: true, creato: "" }];
  risultato[nome] = {
    giorni: O.giorniFinestra(adesso, 5),
    sera: O.proponi({ consulenti: [A, B], fascia: "sera", giorniAvanti: 14, mostrati: [], schede, blocchi, adesso, preavvisoOre: 3, durata: 60 }),
    mattina: O.proponi({ consulenti: [A, B], fascia: "mattina", giorniAvanti: 14, mostrati: [], schede, blocchi, adesso, preavvisoOre: 3, durata: 60 }),
    mercoledi: O.slotLiberiDelGiorno({ consulente: A, giorno: "2026-10-28", durata: 60, schede, blocchi, adesso, preavvisoOre: 3 }),
    chi: O.scegliConsulente({ consulenti: [A, B], giorno: "2026-10-29", ora: "17:00", durata: 60, schede, blocchi, adesso, preavvisoOre: 3, preferito: "" })?.id ?? null,
  };
}
process.stdout.write(JSON.stringify(risultato));
`,
    );
    const gira = (tz) => JSON.parse(execFileSync("node", [script], { env: { ...process.env, TZ: tz }, encoding: "utf8" }));
    const utc = gira("UTC");
    const la = gira("America/Los_Angeles");
    const tokyo = gira("Asia/Tokyo");
    c("stesso risultato con TZ=UTC e TZ=America/Los_Angeles", utc, la);
    c("...e con TZ=Asia/Tokyo", utc, tokyo);
    c(
      "la notte del 27/10: la finestra parte dal 28 e il blocco scaduto il 27 non toglie il mercoledì",
      ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"],
      utc.notte.giorni,
    );
    c("...e il mercoledì 28 ha le ore della mattina (blocco scaduto)", true, utc.notte.mercoledi.includes("09:00"));
    c(
      "di giorno (27/10 alle 09:00) lo stesso blocco vale ancora e il mercoledì è chiuso",
      [],
      utc.giorno.mercoledi,
    );
    c("le 17:00 del 29/10 con tutti e due i consulenti pieni: nessuno", null, utc.giorno.chi);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
