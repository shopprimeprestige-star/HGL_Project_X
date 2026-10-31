/** ── PROVE: I MESSAGGI PER STATO ───────────────────────────────────────────────
 *
 *  Commessa 2026-10-25 (Sheets e sequenze WhatsApp), compito T (piano §5g).
 *  La tabella stato → modello → variabili → quando (`stati.ts`), i messaggi a
 *  evento e a orario (`decidiPerStato`), quelli a data (`codaRicontatti` in
 *  `quando.ts`), `conStatoDal` e il suo uso in `updateLead` e nel portale dei
 *  consulenti. Tutte funzioni pure: l'orologio entra come argomento.
 *
 *  Date di riferimento (Roma): domenica 25/10/2026 è tornata l'ora solare
 *  (+01:00). Martedì 27/10, mercoledì 28/10, giovedì 29/10, sabato 31/10,
 *  domenica 1/11, lunedì 2/11. Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveStati(mod, { c, gruppo, radice }) {
  const T = mod["manychat/stati"];
  const Q = mod["manychat/quando"];
  const X = mod["manychat/testi"];
  const R = mod["manychat/regole"];
  const D = mod["stato-dal"];

  const t = (iso) => new Date(iso);
  const MIN = 60_000;
  const tel = (n) => `333 000 ${String(n).padStart(4, "0")}`;
  const t9 = (n) => `33000${String(n).padStart(4, "0")}`;
  const num = (n) => `39333000${String(n).padStart(4, "0")}`;
  const tipi = (r) => r.map((x) => x.tipo);
  const motivi = (r) => r.map((x) => x.motivo);
  const unica = (r) => (r.length === 1 ? r[0] : null);
  const leggi = (p) => readFileSync(join(radice, p), "utf8");

  const consulenti = [
    {
      id: "cons-1",
      data: { nome: "Filippo Demo", attivo: true, faConsulente: true, faSetter: false },
    },
    { id: "set-1", data: { nome: "Sara Demo", attivo: true, faConsulente: false, faSetter: true } },
  ];
  const FRASE = "2026-10-20T00:00:00.000Z";
  const ACCESO = "2026-10-20T06:00:00.000Z";
  const TETTI = { ricontatti: 20, leadNuovi: 30, totale: 100 };
  const okWa = { si: true, il: "2026-10-01T09:00:00.000Z", da: "Filippo Demo" };
  const STATI_TABELLA = Object.keys(T.TABELLA_STATI);
  const TUTTI_ACCESI = Object.fromEntries(STATI_TABELLA.map((s) => [s, ACCESO]));

  /** una scheda del consulente in uno stato, con la data in cui lo stato è stato messo */
  const sc = (id, n, stato, extra) => ({
    id,
    data: {
      nome: "Anna",
      cognome: "Prova",
      telefono: tel(n),
      stato,
      consulenteId: "cons-1",
      okWhatsapp: okWa,
      ...extra,
    },
  });
  const ctx = (extra) => ({
    consulenti,
    invii: [],
    tetti: TETTI,
    fraseModuloDal: FRASE,
    statiAccesi: TUTTI_ACCESI,
    indirizzoSede: "Via Esempio 1, Roma",
    prossimoDopo: null,
    ...extra,
  });
  const decidi = (schede, adesso, extra) => T.decidiPerStato(schede, t(adesso), ctx(extra));
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
   *  LA TABELLA
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · MESSAGGI PER STATO: LA TABELLA (stati.ts)");
  const TB = T.TABELLA_STATI;
  c(
    "«Ricontatto fissato», «In valutazione», «Lead in chat» → tutti hgl_ricontatto_consulenza, un solo tag",
    Array(3).fill(["hgl_ricontatto_consulenza", "crm-ricontatto", "a_data", "consulente"]),
    ["da_ricontattare", "sta_valutando", "gestire_in_chat"].map((s) => [
      TB[s].modello,
      TB[s].tag,
      TB[s].quando,
      TB[s].chi,
    ]),
  );
  c(
    "«Attesa acconto» è spenta (30/10/2026, PROMEMORIA_ACCONTO_ACCESO): nessuna riga, nessun messaggio automatico",
    [undefined, false],
    [TB.in_attesa_acconto, "in_attesa_acconto" in TB],
  );
  c(
    "«Cliente assente» = no_show + non_fatto; «Non risponde» e «Segreteria» condividono modello e codice evento",
    [true, true],
    [
      TB.no_show.modello === "hgl_cliente_assente" && TB.non_fatto === TB.no_show,
      TB.non_risponde.modello === "hgl_non_risponde" &&
        TB.segreteria.codice === TB.non_risponde.codice,
    ],
  );
  c(
    "modello e tag degli altri stati, come da piano §5g",
    [
      ["hgl_meet_da_fissare", "crm-stato-meet-da-fissare"],
      ["hgl_richiamo_concordato", "crm-stato-richiamo"],
      ["hgl_da_riprogrammare", "crm-stato-riprogrammare"],
      ["hgl_promemoria_sede", "crm-stato-sede"],
      ["hgl_sede_disdetta", "crm-stato-sede-disdetta"],
      ["hgl_ultimo_tentativo", "crm-stato-irreperibile"],
      ["hgl_non_risponde", "crm-stato-non-risponde"],
      ["hgl_cliente_assente", "crm-stato-assente"],
    ],
    [
      "fissa_meet_dopo",
      "richiamo",
      "da_spostare",
      "viene_in_sede",
      "sede_disdetta",
      "irreperibile",
      "segreteria",
      "no_show",
    ].map((s) => [TB[s].modello, TB[s].tag]),
  );
  c(
    "chi: «Non risponde», «Segreteria», «Irreperibile» anche per gli importati; in sede e disdetta per tutte le schede",
    ["tutti", "tutti", "tutti", "tutti", "tutti"],
    ["non_risponde", "segreteria", "irreperibile", "viene_in_sede", "sede_disdetta"].map(
      (s) => TB[s].chi,
    ),
  );
  c(
    "attese e finestre: 15' / 15' / 30' / 30' / 60' (72 h) / disdetta 15'",
    [
      [15, 48],
      [15, 48],
      [30, 48],
      [30, 48],
      [60, 72],
      [15, 48],
    ],
    ["non_risponde", "segreteria", "no_show", "da_spostare", "irreperibile", "sede_disdetta"].map(
      (s) => [TB[s].attesaMin, TB[s].entroOre],
    ),
  );
  c(
    "senza messaggio, per scelta: Da contattare, Ci ricontatta lui, Non interessato, Ripensamento, dopo la vendita",
    [undefined, undefined, undefined, undefined, undefined],
    ["da_contattare", "ci_ricontatta_lui", "annullato", "ripensamento", "perso"].map((s) => TB[s]),
  );
  const aData = STATI_TABELLA.filter((s) => TB[s].quando === "a_data");
  c(
    "STATI_RICONTATTO_AUTOMATICO (regole.ts) = gli stati «a data» della tabella",
    [...aData].sort(),
    [...R.STATI_RICONTATTO_AUTOMATICO].sort(),
  );
  //  La tabella del riquadro (vista-pannello.ts) dice gli stessi modelli.
  const vista = leggi("src/crm/manychat/vista-pannello.ts");
  const righeRiquadro = [
    ...vista.matchAll(
      /stato: "(\w+)",(?:\s*insieme: \[[^\]]*\],)?\s*(?:legatoA: "\w+",\s*)?etichetta: [^\n]+\n\s*modello: "(\w+)"/g,
    ),
  ].map((m) => [m[1], m[2]]);
  c(
    "il riquadro e la tabella dicono lo stesso modello per ogni stato (tranne «Attesa acconto», riga spenta il 30/10/2026)",
    true,
    righeRiquadro.length >= 12 &&
      righeRiquadro.every(([s, m]) => (s === "in_attesa_acconto" ? !TB[s] : TB[s]?.modello === m)),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  LE VARIABILI
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · MESSAGGI PER STATO: LE VARIABILI (testi.ts)");
  const dati = {
    nome: "Anna",
    cognome: "Prova",
    oraRicontatto: "17:30",
    dataVieneInSede: "2026-10-29",
    oraVieneInSede: "11:00",
  };
  const val = (stato, extra, consulente = "Filippo Demo", sede = "Via Esempio 1, Roma") =>
    ((x) => (x.tipo === "campi" ? Object.values(x.campi) : x.motivo))(
      X.campiPerStato(stato, { ...dati, ...extra }, consulente, sede),
    );
  c(
    "nome + consulente (nell'ordine del modello): i quattro ricontatti, meet da fissare, da riprogrammare",
    Array(6).fill(["Anna", "Filippo Demo"]),
    [
      "da_ricontattare",
      "sta_valutando",
      "in_attesa_acconto",
      "gestire_in_chat",
      "fissa_meet_dopo",
      "da_spostare",
    ].map((s) => val(s)),
  );
  c("richiamo concordato → nome, ora della chiamata", ["Anna", "17:30"], val("richiamo"));
  c(
    "non risponde, segreteria, cliente assente (no_show e non_fatto), disdetta, ultimo tentativo → solo il nome",
    Array(7).fill(["Anna"]),
    [
      "non_risponde",
      "segreteria",
      "no_show",
      "non_fatto",
      "sede_disdetta",
      "irreperibile",
      "non_risponde",
    ].map((s) => val(s)),
  );
  c(
    "appuntamento in sede → nome, giorno a parole, ora, indirizzo",
    ["Anna", "giovedì 29 ottobre", "11:00", "Via Esempio 1, Roma"],
    val("viene_in_sede"),
  );
  c(
    "mai il cognome",
    false,
    STATI_TABELLA.some((s) => [].concat(val(s)).join(" ").includes("Prova")),
  );
  c(
    "una variabile vuota → salta, col motivo (consulente, ora, indirizzo, nome)",
    [
      "manca il nome del consulente",
      "manca l'ora della chiamata",
      "manca l'indirizzo della sede",
      "manca l'ora dell'appuntamento in sede",
      "manca la data dell'appuntamento in sede",
      "manca il nome",
    ],
    [
      val("sta_valutando", {}, ""),
      val("richiamo", { oraRicontatto: "" }),
      val("viene_in_sede", {}, "Filippo Demo", "  "),
      val("viene_in_sede", { oraVieneInSede: "" }),
      val("viene_in_sede", { dataVieneInSede: "" }),
      val("irreperibile", { nome: " " }),
    ],
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  A DATA (codaRicontatti)
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · MESSAGGI PER STATO: A DATA");
  const MAR10 = "2026-10-27T10:00:00+01:00";
  const coda = (schede, adesso, extra, acceso = ACCESO) =>
    Q.codaRicontatti(schede, t(adesso), acceso, { ...ctx(), ...extra });
  const stato = (id, n, s, extra) => sc(id, n, s, { dataRicontatto: "2026-10-27", ...extra });
  c(
    "i tre stati col messaggio unico: lo stesso ricontatto, col consulente della scheda",
    Array(3).fill(["invia", "hgl_ricontatto_consulenza"]),
    ["da_ricontattare", "sta_valutando", "gestire_in_chat"].map((s) => {
      const x = unica(coda([stato("l-1", 1, s)], MAR10));
      return [x?.tipo, TB[x?.extra.stato]?.modello];
    }),
  );
  c(
    "«Attesa acconto» il giorno del ricontatto → niente (spenta il 30/10/2026), anche con l'interruttore acceso",
    [[], []],
    [
      coda([stato("l-1", 1, "in_attesa_acconto")], MAR10),
      coda([stato("l-1", 1, "in_attesa_acconto")], MAR10, {
        statiAccesi: { in_attesa_acconto: "2026-10-01T08:00:00.000Z" },
      }),
    ],
  );
  c(
    "…senza consulente assegnato (o di un altro ruolo, o un lead importato) → niente",
    [[], [], []],
    [
      coda([stato("l-1", 1, "gestire_in_chat", { consulenteId: null })], MAR10),
      coda([stato("l-1", 1, "gestire_in_chat", { consulenteId: "set-1" })], MAR10),
      coda([stato("l-1", 1, "gestire_in_chat", { importato: true, consulenteId: null })], MAR10),
    ],
  );
  c(
    "interruttore spento → niente; acceso dopo la data del ricontatto → mai",
    [[], []],
    [
      coda([stato("l-1", 1, "gestire_in_chat")], MAR10, { statiAccesi: {} }),
      coda([stato("l-1", 1, "gestire_in_chat", { dataRicontatto: "2026-10-22" })], MAR10, {
        statiAccesi: { gestire_in_chat: "2026-10-24T08:00:00.000Z" },
      }),
    ],
  );
  c(
    "«Ricontatto fissato» segue l'interruttore dei ricontatti (spento → niente)",
    [["invia"], []],
    [
      tipi(coda([stato("l-1", 1, "da_ricontattare")], MAR10)),
      coda([stato("l-1", 1, "da_ricontattare")], MAR10, { ricontattiAcceso: false }),
    ],
  );
  c(
    "due stati a data sullo stesso numero lo stesso giorno → una voce r|tel9|giorno",
    [[`r|${t9(1)}|2026-10-27`], 1],
    ((r) => [r.map((x) => x.chiave), r.length])(
      coda([stato("l-1", 1, "sta_valutando"), stato("l-2", 1, "gestire_in_chat")], MAR10),
    ),
  );
  c(
    "data di oggi → nel 9-20 col ritmo: alle 08:59 aspetta, a ritmo non passato aspetta, passato invia",
    [["aspetta"], ["aspetta"], ["invia"]],
    [
      tipi(coda([stato("l-1", 1, "sta_valutando")], "2026-10-27T08:59:00+01:00")),
      tipi(
        coda([stato("l-1", 1, "sta_valutando")], MAR10, {
          prossimoDopo: t("2026-10-27T10:20:00+01:00"),
        }),
      ),
      tipi(
        coda([stato("l-1", 1, "sta_valutando")], MAR10, {
          prossimoDopo: t("2026-10-27T09:50:00+01:00"),
        }),
      ),
    ],
  );
  c(
    "«Da riprogrammare» con la data → a data; senza → non è nella coda (lo fa l'evento dopo 30')",
    [["invia"], []],
    [
      tipi(coda([stato("l-1", 1, "da_spostare")], MAR10)),
      coda([sc("l-1", 1, "da_spostare")], MAR10),
    ],
  );
  c(
    "modulo prima della frase: parte lo stesso (consenso di tutti, 28/10)",
    ["invia", null],
    ((x) => [x?.tipo, x?.motivo])(
      unica(
        coda(
          [
            stato("l-1", 1, "sta_valutando", {
              okWhatsapp: undefined,
              consensoModulo: { whatsapp: true, il: "2026-10-10T09:00:00.000Z" },
            }),
          ],
          MAR10,
        ),
      ),
    ),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  A EVENTO
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · MESSAGGI PER STATO: A EVENTO");
  // Lo stato è stato messo martedì 27/10 alle 10:00 Roma (09:00Z).
  const E = "2026-10-27T09:00:00.000Z";
  const ev = (id, n, s, extra) => sc(id, n, s, { statoDal: E, ...extra });
  const chiaveEv = (cod, n, e = E) => `s|${cod}|${t9(n)}|${e}`;

  c(
    "interruttore spento → niente; acceso → il suo messaggio",
    [[], ["invia"]],
    [
      decidi([ev("l-1", 1, "non_risponde")], "2026-10-27T10:15:00+01:00", { statiAccesi: {} }),
      tipi(decidi([ev("l-1", 1, "non_risponde")], "2026-10-27T10:15:00+01:00")),
    ],
  );
  c(
    "…lo spegnimento è per stato: acceso «Segreteria», spento «Non risponde» → solo il primo",
    [[], ["invia"]],
    [
      decidi([ev("l-1", 1, "non_risponde")], "2026-10-27T10:15:00+01:00", {
        statiAccesi: { segreteria: ACCESO },
      }),
      tipi(
        decidi([ev("l-1", 1, "segreteria")], "2026-10-27T10:15:00+01:00", {
          statiAccesi: { segreteria: ACCESO },
        }),
      ),
    ],
  );
  const nr = (adesso, extra, scheda = ev("l-1", 1, "non_risponde")) =>
    decidi([scheda], adesso, extra);
  const x1015 = unica(nr("2026-10-27T10:15:00+01:00"));
  c(
    "«Non risponde» messo alle 10:00 → alle 10:14 aspetta, alle 10:15 parte (chiave s|nr|tel9|statoDal)",
    [["aspetta"], "invia", chiaveEv("nr", 1), "ricontatto", "non_risponde"],
    [
      tipi(nr("2026-10-27T10:14:00+01:00")),
      x1015?.tipo,
      x1015?.chiave,
      x1015?.extra.tipo,
      x1015?.extra.stato,
    ],
  );
  c(
    "…anche per i lead importati (senza consulente)",
    ["invia"],
    tipi(
      nr(
        "2026-10-27T10:15:00+01:00",
        {},
        ev("l-1", 1, "segreteria", { importato: true, consulenteId: null }),
      ),
    ),
  );
  c(
    "«Cliente assente» (no_show e non_fatto): 30' dopo; il lead importato resta fuori",
    [
      ["aspetta", "aspetta"],
      ["invia", "invia"],
      [[], []],
    ],
    [
      ["no_show", "non_fatto"].map(
        (s) => tipi(decidi([ev("l-1", 1, s)], "2026-10-27T10:29:00+01:00"))[0],
      ),
      ["no_show", "non_fatto"].map(
        (s) => tipi(decidi([ev("l-1", 1, s)], "2026-10-27T10:30:00+01:00"))[0],
      ),
      ["no_show", "non_fatto"].map((s) =>
        decidi(
          [ev("l-1", 1, s, { importato: true, consulenteId: null })],
          "2026-10-27T10:30:00+01:00",
        ),
      ),
    ],
  );
  c(
    "«Da riprogrammare» senza data → a evento dopo 30'; con la data non c'è (è a data)",
    [["aspetta"], ["invia"], []],
    [
      tipi(decidi([ev("l-1", 1, "da_spostare")], "2026-10-27T10:29:00+01:00")),
      tipi(decidi([ev("l-1", 1, "da_spostare")], "2026-10-27T10:30:00+01:00")),
      decidi(
        [ev("l-1", 1, "da_spostare", { dataRicontatto: "2026-10-30" })],
        "2026-10-27T10:30:00+01:00",
      ),
    ],
  );
  //  `dataRicontatto` non si azzera mai: una data vecchia non è la data di QUESTO stato.
  const vecchia = { dataRicontatto: "2026-10-10" };
  c(
    "«Da riprogrammare» con una data VECCHIA (di prima dello stato) → a evento: parte dopo 30' con la chiave s|rp|…",
    [["aspetta"], ["invia", chiaveEv("rp", 1)]],
    [
      tipi(decidi([ev("l-1", 1, "da_spostare", vecchia)], "2026-10-27T10:29:00+01:00")),
      ((x) => [x?.tipo, x?.chiave])(
        unica(decidi([ev("l-1", 1, "da_spostare", vecchia)], "2026-10-27T10:30:00+01:00")),
      ),
    ],
  );
  c(
    "…la stessa data vecchia NON entra nella coda a data; una data del giorno dello stato o futura sì",
    [[], ["invia"], ["invia"]],
    [
      Q.codaRicontatti(
        [ev("l-1", 1, "da_spostare", vecchia)],
        t("2026-10-27T10:30:00+01:00"),
        ACCESO,
        ctx(),
      ),
      tipi(
        Q.codaRicontatti(
          [ev("l-1", 1, "da_spostare", { dataRicontatto: "2026-10-27" })],
          t("2026-10-27T10:30:00+01:00"),
          ACCESO,
          ctx(),
        ),
      ),
      tipi(
        Q.codaRicontatti(
          [ev("l-1", 1, "da_spostare", { dataRicontatto: "2026-10-27" })],
          t("2026-10-27T15:00:00+01:00"),
          ACCESO,
          ctx(),
        ),
      ),
    ],
  );
  c(
    "…vale per ogni stato a data: «In valutazione» con la data di prima dello stato non parte il giorno di oggi",
    [],
    Q.codaRicontatti(
      [
        ev("l-1", 1, "sta_valutando", {
          dataRicontatto: "2026-10-26",
          statoDal: "2026-10-27T08:00:00.000Z",
        }),
      ],
      t("2026-10-27T10:30:00+01:00"),
      ACCESO,
      ctx(),
    ),
  );
  c(
    "disdetta della sede: 15' dopo, per tutte le schede (anche senza consulente)",
    [["aspetta"], ["invia"]],
    [
      tipi(
        decidi(
          [ev("l-1", 1, "sede_disdetta", { consulenteId: null })],
          "2026-10-27T10:14:00+01:00",
        ),
      ),
      tipi(
        decidi(
          [ev("l-1", 1, "sede_disdetta", { consulenteId: null })],
          "2026-10-27T10:15:00+01:00",
        ),
      ),
    ],
  );
  const irr = (adesso, extra) =>
    decidi([ev("l-1", 1, "irreperibile", { importato: true, consulenteId: null })], adesso, extra);
  c(
    "«Irreperibile»: 1 ora dopo, una volta per numero per sempre (chiave s|irr|tel9)",
    [["aspetta"], ["invia", `s|irr|${t9(1)}`]],
    [
      tipi(irr("2026-10-27T10:59:00+01:00")),
      ((x) => [x?.tipo, x?.chiave])(unica(irr("2026-10-27T11:00:00+01:00"))),
    ],
  );
  c(
    "…già partito una volta → mai più, anche con uno stato rimesso mesi dopo",
    [],
    decidi(
      [ev("l-1", 1, "irreperibile", { statoDal: "2027-03-01T09:00:00.000Z" })],
      "2027-03-01T11:00:00.000Z",
      {
        invii: [
          invio(1, "ricontatto", "2026-10-27T10:00:00.000Z", {
            chiave: `s|irr|${t9(1)}`,
            rispostaIl: "2026-10-27T11:00:00.000Z",
          }),
        ],
      },
    ),
  );
  c(
    "…entro 72 ore (poi tace); gli altri entro 48 (poi saltato, poi tace)",
    [["invia"], [], ["invia"], ["salta"], []],
    [
      tipi(irr("2026-10-30T09:00:00+01:00")),
      irr("2026-10-30T10:01:00+01:00").filter((x) => x.tipo === "invia"),
      tipi(nr("2026-10-29T10:00:00+01:00")),
      tipi(nr("2026-10-29T10:30:00+01:00")),
      nr("2026-10-29T11:01:00+01:00"),
    ],
  );
  c(
    "…l'evento scaduto lo dice: «saltato: messaggio scaduto»",
    "saltato: messaggio scaduto",
    unica(nr("2026-10-29T10:30:00+01:00"))?.motivo,
  );
  c(
    "scheda senza statoDal → mai; statoDal PRIMA dell'accensione dello stato → mai",
    [[], []],
    [
      decidi([sc("l-1", 1, "non_risponde")], "2026-10-27T10:15:00+01:00"),
      nr("2026-10-27T10:15:00+01:00", {
        statiAccesi: { non_risponde: "2026-10-27T09:30:00.000Z" },
      }),
    ],
  );
  c(
    "stato rimesso il giorno dopo = evento nuovo, ma non prima di 7 giorni dall'ultimo dello stesso modello",
    [["salta"], ["invia"]],
    [
      tipi(
        nr(
          "2026-10-28T10:15:00+01:00",
          {
            invii: [
              invio(1, "ricontatto", "2026-10-27T09:15:00.000Z", {
                chiave: chiaveEv("nr", 1),
                rispostaIl: "2026-10-27T12:00:00.000Z",
              }),
            ],
          },
          ev("l-1", 1, "non_risponde", { statoDal: "2026-10-28T09:00:00.000Z" }),
        ),
      ),
      tipi(
        nr(
          "2026-11-04T10:15:00+01:00",
          {
            invii: [
              invio(1, "ricontatto", "2026-10-27T09:15:00.000Z", {
                chiave: chiaveEv("nr", 1),
                rispostaIl: "2026-10-27T12:00:00.000Z",
              }),
            ],
          },
          ev("l-1", 1, "non_risponde", { statoDal: "2026-11-04T09:00:00.000Z" }),
        ),
      ),
    ],
  );
  c(
    "«Non risponde» → «Segreteria» lo stesso giorno = un solo messaggio",
    [["salta"], true],
    ((r) => [tipi(r), /uguale/.test(motivi(r).join())])(
      nr(
        "2026-10-27T11:15:00+01:00",
        {
          invii: [
            invio(1, "ricontatto", "2026-10-27T09:15:00.000Z", {
              chiave: chiaveEv("nr", 1),
              rispostaIl: "2026-10-27T09:40:00.000Z",
            }),
          ],
        },
        ev("l-1", 1, "segreteria", { statoDal: "2026-10-27T10:00:00.000Z" }),
      ),
    ),
  );
  c(
    "lo stesso evento già partito (stessa chiave) non riparte e non fa rumore",
    [],
    nr("2026-10-27T10:30:00+01:00", {
      invii: [
        invio(1, "ricontatto", "2026-10-27T09:16:00.000Z", {
          chiave: chiaveEv("nr", 1),
          rispostaIl: "2026-10-27T09:20:00.000Z",
        }),
      ],
    }),
  );
  //  Finestra, freno, tetti, ritmo, pausa.
  const sab = ev("l-1", 1, "non_risponde", { statoDal: "2026-10-31T18:50:00.000Z" }); // sabato 19:50 Roma
  c(
    "fuori orario: messo sabato alle 19:50 → aspetta lunedì alle 09:00 (non parte alle 20:05, né domenica)",
    ["aspetta", "parte alle 09:00 di lunedì 2 novembre"],
    ((x) => [x?.tipo, x?.motivo])(unica(nr("2026-10-31T20:05:00+01:00", {}, sab))),
  );
  c("…lunedì alle 09:00 parte", ["invia"], tipi(nr("2026-11-02T09:00:00+01:00", {}, sab)));
  const senzaRisposta = invio(1, "ricontatto", "2026-10-26T09:00:00.000Z", {
    chiave: `r|${t9(1)}|2026-10-26`,
  });
  c(
    "il freno vale: un messaggio automatico di ieri senza risposta → salta; con la risposta passa",
    [["salta", "aspetta ancora una risposta"], ["invia"]],
    [
      ((x) => [x?.tipo, x?.motivo])(
        unica(nr("2026-10-27T10:15:00+01:00", { invii: [senzaRisposta] })),
      ),
      tipi(
        nr("2026-10-27T10:15:00+01:00", {
          invii: [{ ...senzaRisposta, rispostaIl: "2026-10-26T10:00:00.000Z" }],
        }),
      ),
    ],
  );
  c(
    "lead nuovo in «Non risponde» col primo contatto senza risposta: frenato (il suo richiamo è un'altra cosa)",
    ["salta", "aspetta ancora una risposta"],
    ((x) => [x?.tipo, x?.motivo])(
      unica(
        nr("2026-10-27T10:15:00+01:00", {
          invii: [invio(1, "primo_contatto", "2026-10-27T08:30:00.000Z", { chiave: `n|${t9(1)}` })],
        }),
      ),
    ),
  );
  c(
    "tetto dei ricontatti (20), riserva sul totale (70), ritmo 27-33', pausa per contatto",
    [["aspetta"], ["aspetta"], ["aspetta"], ["aspetta"], ["invia"]],
    [
      tipi(nr("2026-10-27T10:15:00+01:00", { invii: righeOggi(20, "ricontatto") })),
      tipi(nr("2026-10-27T10:15:00+01:00", { invii: righeOggi(70, "meet_adesso") })),
      tipi(nr("2026-10-27T10:15:00+01:00", { prossimoDopo: t("2026-10-27T10:20:00+01:00") })),
      tipi(
        nr("2026-10-27T10:15:00+01:00", {
          invii: [invio(1, "webinar", "2026-10-27T09:14:30.000Z")],
        }),
      ),
      tipi(nr("2026-10-27T10:15:00+01:00", { invii: righeOggi(19, "ricontatto") })),
    ],
  );
  c(
    "STOP → salta «STOP»; revoca, numero non valido → salta; modulo precedente alla frase → parte (consenso di tutti)",
    [
      ["salta", "STOP"],
      ["salta", "manca il consenso WhatsApp"],
      ["salta", "numero non valido"],
      ["invia", null],
    ],
    [
      ev("l-1", 1, "non_risponde", { contattoWa: { stato: "stop", il: E, da: "automatico" } }),
      ev("l-1", 1, "non_risponde", { okWhatsapp: { si: false, il: E, da: "G" } }),
      ev("l-1", 1, "non_risponde", { telefono: "12" }),
      ev("l-1", 1, "non_risponde", {
        okWhatsapp: undefined,
        consensoModulo: { whatsapp: true, il: "2026-10-10T09:00:00.000Z" },
      }),
    ].map((s) => ((x) => [x?.tipo, x?.motivo])(unica(nr("2026-10-27T10:15:00+01:00", {}, s)))),
  );
  c(
    "…il consenso del modulo DOPO la frase basta",
    ["invia"],
    tipi(
      nr(
        "2026-10-27T10:15:00+01:00",
        {},
        ev("l-1", 1, "non_risponde", {
          okWhatsapp: undefined,
          consensoModulo: { whatsapp: true, il: "2026-10-25T09:00:00.000Z", via: "modulo_meta" },
        }),
      ),
    ),
  );
  c(
    "gli stati a data e quelli senza messaggio non entrano in decidiPerStato",
    [],
    decidi(
      [
        ev("l-1", 1, "sta_valutando", { dataRicontatto: E.slice(0, 10) }),
        ev("l-2", 2, "da_contattare"),
        ev("l-3", 3, "ci_ricontatta_lui"),
      ],
      "2026-10-27T11:00:00+01:00",
    ),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  A ORARIO
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · MESSAGGI PER STATO: A ORARIO");
  const call = (hm, extra) =>
    sc("l-1", 1, "richiamo", { dataRicontatto: "2026-10-27", oraRicontatto: hm, ...extra });
  const alle = (hm, g = "2026-10-27") => `${g}T${hm}:00+01:00`;
  const chiamata = (hm, adesso, extra, ctxExtra) =>
    decidi([call(hm, extra)], alle(adesso), ctxExtra);
  c(
    "richiamo concordato alle 17:30 → si scrive da 17:00 a 17:20: 16:59 aspetta, 17:00 e 17:20 partono, 17:21 saltato",
    [["aspetta"], ["invia"], ["invia"], ["salta", "saltato: giro in ritardo"]],
    [
      tipi(chiamata("17:30", "16:59")),
      tipi(chiamata("17:30", "17:00")),
      tipi(chiamata("17:30", "17:20")),
      ((x) => [x?.tipo, x?.motivo])(unica(chiamata("17:30", "17:21"))),
    ],
  );
  const ch = unica(chiamata("17:30", "17:05"));
  c(
    "…chiave ch|tel9|AAAA-MM-GGTHH:MM, tipo promemoria_chiamata, con l'ora della chiamata",
    [
      `ch|${t9(1)}|2026-10-27T17:30`,
      "promemoria_chiamata",
      "richiamo",
      t(alle("17:30")).toISOString(),
    ],
    [ch?.chiave, ch?.extra.tipo, ch?.extra.stato, ch?.extra.inizio.toISOString()],
  );
  c(
    "chiamata alle 09:00 → niente (la finestra 08:30-08:50 è fuori dal 9-20); alle 09:25 parte alle 09:00",
    [[], ["invia"]],
    [chiamata("09:00", "08:40"), tipi(chiamata("09:25", "09:00"))],
  );
  c(
    "senza ora, di domani, di domenica, passata → niente",
    [[], [], [], []],
    [
      chiamata("", "17:00"),
      decidi([call("17:30", { dataRicontatto: "2026-10-28" })], alle("17:00")),
      decidi([call("17:30", { dataRicontatto: "2026-11-01" })], alle("17:00", "2026-11-01")),
      chiamata("17:30", "17:31"),
    ],
  );
  c(
    "NON è frenato (nemmeno da un messaggio senza risposta) e non aspetta il ritmo; STOP vale",
    [["invia"], ["invia"], ["salta", "STOP"]],
    [
      tipi(chiamata("17:30", "17:05", {}, { invii: [senzaRisposta] })),
      tipi(chiamata("17:30", "17:05", {}, { prossimoDopo: t(alle("18:00")) })),
      ((x) => [x?.tipo, x?.motivo])(
        unica(
          chiamata("17:30", "17:05", { contattoWa: { stato: "stop", il: E, da: "automatico" } }),
        ),
      ),
    ],
  );
  c(
    "tetto totale intero (100: nessuna riserva per i messaggi d'appuntamento), acceso dopo la data → mai, importato → fuori",
    [["invia"], ["salta"], [], []],
    [
      tipi(chiamata("17:30", "17:05", {}, { invii: righeOggi(99, "meet_oggi") })),
      tipi(chiamata("17:30", "17:05", {}, { invii: righeOggi(100, "meet_oggi") })),
      chiamata("17:30", "17:05", {}, { statiAccesi: { richiamo: "2026-10-28T08:00:00.000Z" } }),
      chiamata("17:30", "17:05", { importato: true, consulenteId: null }),
    ],
  );

  //  In sede: appuntamento giovedì 29/10 alle 11:00.
  const sede = (extra) =>
    sc("l-1", 1, "viene_in_sede", {
      dataVieneInSede: "2026-10-29",
      oraVieneInSede: "11:00",
      ...extra,
    });
  const insede = (adesso, extra, ctxExtra, g = "2026-10-28") =>
    decidi([sede(extra)], alle(adesso, g), ctxExtra);
  c(
    "giovedì 11:00 → il giorno prima (mercoledì) nel 9-20: martedì niente, mercoledì 08:59 aspetta, 09:00 e 19:59 partono, 20:00 saltato",
    [[], ["aspetta"], ["invia"], ["invia"], ["salta"]],
    [
      insede("12:00", {}, {}, "2026-10-27"),
      tipi(insede("08:59")),
      tipi(insede("09:00")),
      tipi(insede("19:59")),
      tipi(insede("20:00")),
    ],
  );
  const sd = unica(insede("10:00"));
  c(
    "…chiave sd|tel9|AAAA-MM-GGTHH:MM, tipo promemoria_sede, con l'ora dell'appuntamento",
    [
      `sd|${t9(1)}|2026-10-29T11:00`,
      "promemoria_sede",
      t(alle("11:00", "2026-10-29")).toISOString(),
    ],
    [sd?.chiave, sd?.extra.tipo, sd?.extra.inizio.toISOString()],
  );
  c(
    "lunedì 2/11 → sabato 31/10 (la domenica non si scrive); domenica 1/11 niente",
    [["invia"], []],
    [
      tipi(decidi([sede({ dataVieneInSede: "2026-11-02" })], alle("10:00", "2026-10-31"))),
      decidi([sede({ dataVieneInSede: "2026-11-02" })], alle("10:00", "2026-11-01")),
    ],
  );
  c(
    "preso meno di 24 ore prima → niente; più di 24 ore prima → parte",
    [[], ["invia"]],
    [
      insede("10:00", { statoDal: alle("16:00", "2026-10-28") }),
      tipi(insede("10:00", { statoDal: alle("10:00", "2026-10-27") })),
    ],
  );
  c(
    "senza l'indirizzo nel riquadro → «manca l'indirizzo della sede»",
    ["salta", "manca l'indirizzo della sede"],
    ((x) => [x?.tipo, x?.motivo])(unica(insede("10:00", {}, { indirizzoSede: null }))),
  );
  c(
    "NON è frenato; vale per tutte le schede con l'appuntamento (anche importate, anche senza consulente); STOP vale",
    [["invia"], ["invia"], ["salta", "STOP"]],
    [
      tipi(insede("10:00", {}, { invii: [senzaRisposta] })),
      tipi(insede("10:00", { importato: true, consulenteId: null })),
      ((x) => [x?.tipo, x?.motivo])(
        unica(insede("10:00", { contattoWa: { stato: "stop", il: E, da: "automatico" } })),
      ),
    ],
  );
  c(
    "interruttore spento → niente; già partito (stessa chiave) → non riparte",
    [[], []],
    [
      insede("10:00", {}, { statiAccesi: {} }),
      insede(
        "10:00",
        {},
        {
          invii: [
            invio(1, "promemoria_sede", "2026-10-28T08:00:00.000Z", {
              chiave: `sd|${t9(1)}|2026-10-29T11:00`,
            }),
          ],
        },
      ),
    ],
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  statoDal · conStatoDal
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · statoDal (stato-dal.ts)");
  const ADESSO = t("2026-10-27T10:00:00+01:00");
  const prima = { stato: "da_contattare", nome: "Anna", statoDal: "2026-10-01T08:00:00.000Z" };
  c(
    "stato finale uguale (anche con «stato» dentro la patch, come salva LeadDialog) → statoDal invariato",
    ["2026-10-01T08:00:00.000Z", "2026-10-01T08:00:00.000Z"],
    [
      D.conStatoDal(prima, { ...prima, nome: "Anna B.", stato: "da_contattare" }, ADESSO).statoDal,
      D.conStatoDal(prima, prima, ADESSO).statoDal,
    ],
  );
  const stessa = { ...prima, note: "x" };
  c(
    "…e restituisce lo stesso oggetto",
    true,
    D.conStatoDal(prima, stessa, ADESSO) === stessa && stessa.statoDal === prima.statoDal,
  );
  c(
    "stato cambiato (o cambiato da applyAutoStatus: conta lo stato finale) → statoDal = adesso",
    "2026-10-27T09:00:00.000Z",
    D.conStatoDal(prima, { ...prima, stato: "non_risponde" }, ADESSO).statoDal,
  );
  c(
    "scheda senza stato prima → statoDal scritto; non tocca gli oggetti ricevuti",
    ["2026-10-27T09:00:00.000Z", "da_contattare", "2026-10-01T08:00:00.000Z"],
    ((dopo) => [
      D.conStatoDal(undefined, { stato: "irreperibile" }, ADESSO).statoDal,
      D.conStatoDal(prima, dopo, ADESSO) && prima.stato,
      prima.statoDal,
    ])({ ...prima, stato: "richiamo" }),
  );
  //  Le due strade che scrivono lo stato passano da conStatoDal, DOPO applyAutoStatus.
  const contesto = leggi("src/crm/CRMContext.tsx");
  const iAuto = contesto.indexOf("let merged = applyAutoStatus({ ...current.data, ...patchSenzaConto }");
  const iDal = contesto.indexOf(
    "merged = statoDalDopo(current.data, merged, new Date(), opzioni.annulla === true, patch.statoDal);",
  );
  c(
    "updateLead (CRMContext): statoDalDopo(prima, finale) subito dopo applyAutoStatus, una volta sola",
    [true, 1],
    [iAuto > 0 && iDal > iAuto, contesto.split("statoDalDopo(").length - 1],
  );
  const azione = leggi("src/routes/api.consulente.azione.ts");
  const iAuto2 = azione.indexOf("let aggiornato = applyAutoStatus({ ...attuale, ...patch }");
  const iDal2 = azione.indexOf("aggiornato = conStatoDal(attuale, aggiornato, new Date());");
  const iScrive = azione.indexOf(".update({ data: aggiornato as never })");
  c(
    "il portale dei consulenti (api.consulente.azione): conStatoDal dopo applyAutoStatus e prima del salvataggio",
    true,
    iAuto2 > 0 && iDal2 > iAuto2 && iScrive > iDal2,
  );
  //  «Annulla» (coda dei lead importati): si dichiara in modo ESPLICITO, e la scelta è una
  //  funzione pura che qui FACCIAMO GIRARE.
  const MODULO_INTERO = {
    ...prima,
    stato: "irreperibile",
    statoPrecedenteIl: "2026-10-20T08:00:00.000Z", // il modulo intero porta anche questo
  };
  c(
    "salvataggio normale (modulo intero di LeadDialog, con statoPrecedenteIl e il vecchio statoDal) con stato cambiato → statoDal = adesso",
    "2026-10-27T09:00:00.000Z",
    D.statoDalDopo(prima, MODULO_INTERO, ADESSO, false, prima.statoDal).statoDal,
  );
  c(
    "…e con lo stato uguale resta quello di prima",
    "2026-10-01T08:00:00.000Z",
    D.statoDalDopo(prima, { ...prima, nome: "B." }, ADESSO, false).statoDal,
  );
  c(
    "annulla → lo statoDal di prima che porta chi annulla, oppure nessuno (mai adesso)",
    ["2026-10-17T09:00:00.000Z", false],
    [
      D.statoDalDopo(
        { ...prima, stato: "irreperibile", statoDal: E },
        { ...prima, stato: "non_risponde", statoDal: E },
        ADESSO,
        true,
        "2026-10-17T09:00:00.000Z",
      ).statoDal,
      "statoDal" in
        D.statoDalDopo(
          { ...prima, stato: "irreperibile", statoDal: E },
          { ...prima, stato: "non_risponde", statoDal: E },
          ADESSO,
          true,
          undefined,
        ),
    ],
  );
  c(
    "…annullato un cambio vero: nessun messaggio a evento (statoDal vecchio o assente)",
    [[], []],
    [
      decidi(
        [ev("l-1", 1, "non_risponde", { statoDal: "2026-10-17T09:00:00.000Z" })],
        "2026-10-27T10:30:00+01:00",
      ),
      decidi([sc("l-1", 1, "non_risponde")], "2026-10-27T10:30:00+01:00"),
    ],
  );
  const importa = leggi("src/routes/CRM.importa.tsx");
  c(
    "solo disfaUltimo dichiara l'annullamento; disfa.prima porta lo statoDal di prima",
    [true, 1, true],
    [
      /updateLead\(d\.id, d\.prima, \{ annulla: true \}\)/.test(importa),
      importa.split("annulla: true").length - 1,
      /statoDa: l\.data\.statoDa,\s*statoDal: l\.data\.statoDal,\s*\} as Partial<LeadData>/.test(
        importa,
      ),
    ],
  );
  const stati = leggi("src/crm/manychat/stati.ts");
  c(
    "TIPI_SENZA_FRENO e TIPI_COL_RITMO sono la fonte unica: stati.ts li importa da regole.ts",
    [true, true],
    [
      /TIPI_SENZA_FRENO,[\s\S]*from "\.\/regole"/.test(stati),
      /TIPI_COL_RITMO,[\s\S]*from "\.\/regole"/.test(stati),
    ],
  );
  c(
    "MEMORIA_SALTI_MIN è una sola, esportata da sequenze.ts",
    [true, 1],
    [
      mod["manychat/sequenze"].MEMORIA_SALTI_MIN === 60,
      leggi("src/crm/manychat/stati.ts").split("MEMORIA_SALTI_MIN =").length -
        1 +
        (leggi("src/crm/manychat/sequenze.ts").split("MEMORIA_SALTI_MIN =").length - 1),
    ],
  );
  void MIN;
}
