import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** ── PROVE: WHATSAPP A TUTTI GLI IMPORTATI E AI LEAD DI RITORNO ─────────────
 *
 *  Commessa 2026-10-28 (`wa-tutti-importati`). Le regole nuove di
 *  `decidiLeadNuovi` (sequenze.ts): primo contatto a ogni importato «da
 *  contattare» non ancora contattato (senza finestra di 72 ore e senza
 *  consenso: decisione del titolare, restano STOP, revoca e numero valido) e
 *  messaggio di ritorno `hgl_ritorno` a ogni contatto il cui `ricarico` è
 *  salito. Funzioni pure: l'orologio entra come argomento. Dati inventati.
 *
 *  Martedì 27/10/2026 10:00 a Roma (+01:00, ora solare).
 *  `mod`: i moduli impacchettati. `aiuti`: `{ c, gruppo }`. */
export async function proveImportati(mod, { c, gruppo, radice }) {
  const S = mod["manychat/sequenze"];
  const t = (iso) => new Date(iso);
  const tel = (n) => `333 000 ${String(n).padStart(4, "0")}`;
  const t9 = (n) => `33000${String(n).padStart(4, "0")}`;
  const num = (n) => `39333000${String(n).padStart(4, "0")}`;
  const tipi = (r) => r.map((x) => x.tipo);
  const unica = (r) => (r.length === 1 ? r[0] : null);
  const consulenti = [
    {
      id: "cons-1",
      data: { nome: "Filippo Demo", attivo: true, faConsulente: true, faSetter: false },
    },
  ];
  const FRASE = "2026-10-20T00:00:00.000Z";
  const DAL = "2026-10-20T06:00:00.000Z";
  const TETTI = { ricontatti: 20, leadNuovi: 100, totale: 100 };
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
  const lead = (schede, adesso, extra) =>
    S.decidiLeadNuovi(schede, t(adesso), {
      consulenti,
      invii: [],
      tetti: TETTI,
      fraseModuloDal: FRASE,
      leadNuovoDal: DAL,
      ...extra,
    });
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
  const MAR10 = "2026-10-27T10:00:00+01:00";

  /* ════════════════════════════════════════════════════════════════════════
   *  COMMESSA 2026-10-28: WHATSAPP A TUTTI GLI IMPORTATI E AI LEAD DI RITORNO
   *  Nessun consenso richiesto (decisione del titolare: «rischio mio»), nessuna
   *  finestra di 72 ore. Restano STOP, revoca e numero valido.
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · TUTTI GLI IMPORTATI: PRIMO CONTATTO SENZA FINESTRA NÉ CONSENSO");
  {
    /** un importato qualunque: niente modulo Meta, niente data d'ingresso recente */
    const imp = (id, n, extra) => ({
      id,
      data: {
        nome: "Carla",
        telefono: tel(n),
        stato: "da_contattare",
        importato: true,
        createdAt: "2026-07-01T09:00:00.000Z",
        ...extra,
      },
    });
    const sec = (schede, adesso, extra) => lead(schede, adesso, { fraseModuloDal: null, ...extra });
    const d1 = unica(sec([imp("i-1", 1)], MAR10));
    c(
      "importato da contattare, vecchio di mesi, senza modulo né consenso → primo contatto n|tel9",
      ["invia", `n|${t9(1)}`, "primo_contatto"],
      [d1?.tipo, d1?.chiave, d1?.extra?.quale],
    );
    c(
      "…senza consenso scritto sulla scheda e senza data della frase: parte lo stesso",
      ["invia"],
      tipi(sec([imp("i-1", 1, { consensoModulo: undefined, okWhatsapp: undefined })], MAR10)),
    );
    c(
      "…«Lead nuovo» mai acceso (nessuna data) → niente, anche per gli importati",
      [],
      sec([imp("i-1", 1)], MAR10, { leadNuovoDal: null }),
    );
    c(
      "non importato, o con consulenza fissata, o con data di meet → niente",
      [[], [], []],
      [
        sec([imp("i-1", 1, { importato: false })], MAR10),
        sec([imp("i-1", 1, { dataMeeting: "2026-11-02" })], MAR10),
        sec([imp("i-1", 1, { dataMeeting: "2026-09-02", consulenteId: "cons-1" })], MAR10),
      ],
    );
    c(
      "stato diverso da «da contattare» (in chat, non risponde, segreteria) → niente",
      [[], [], []],
      ["gestire_in_chat", "non_risponde", "segreteria"].map((stato) =>
        sec([imp("i-1", 1, { stato })], MAR10),
      ),
    );
    //  Già in chat / già contattato.
    c(
      "già in chat: qualunque secondo stato del contatto (in attesa, ha risposto, contattato…) → niente",
      [[], [], [], []],
      ["in_attesa", "ha_risposto", "contattato", "non_ha_risposto"].map((stato) =>
        sec(
          [imp("i-1", 1, { contattoWa: { stato, il: "2026-09-01T09:00:00.000Z", da: "Giulia" } })],
          MAR10,
        ),
      ),
    );
    c(
      "già contattato: un invio arrivato a quel numero, di qualunque tipo (chat compresa), anche vecchio → niente",
      [[], [], []],
      ["chat", "ricontatto", "primo_contatto"].map((tipo) =>
        sec([imp("i-1", 1)], MAR10, {
          invii: [invio(1, tipo, "2026-09-01T09:00:00.000Z")],
        }),
      ),
    );
    c(
      "…un invio fallito o saltato non ha raggiunto nessuno: non conta come contatto",
      [["invia"], ["invia"]],
      ["fallito", "saltato"].map((stato) =>
        tipi(
          sec([imp("i-1", 1)], MAR10, {
            invii: [invio(1, "chat", "2026-09-01T09:00:00.000Z", { stato })],
          }),
        ),
      ),
    );
    c(
      "un invio a un ALTRO numero non conta",
      ["invia"],
      tipi(sec([imp("i-1", 1)], MAR10, { invii: [invio(2, "chat", "2026-10-27T08:00:00.000Z")] })),
    );
    c(
      "chiave n|tel9 già presa (inviata, prenotata, incerta o saltata) → niente, una volta sola per numero",
      [[], [], [], []],
      ["inviato", "prenotato", "incerto", "saltato"].map((stato) =>
        sec([imp("i-1", 1)], MAR10, {
          invii: [
            invio(1, "primo_contatto", "2026-10-27T07:00:00.000Z", { stato, chiave: `n|${t9(1)}` }),
          ],
        }),
      ),
    );
    //  Il fallito si ritenta UNA volta.
    const fallito = invio(1, "primo_contatto", "2026-10-27T07:00:00.000Z", {
      stato: "fallito",
      chiave: `n|${t9(1)}`,
    });
    const nonRaggiungibile = {
      stato: "non_raggiungibile",
      il: "2026-10-27T07:00:05.000Z",
      da: "automatico",
      motivo: "contatto ManyChat da collegare",
    };
    const ritenta = unica(
      sec([imp("i-1", 1, { contattoWa: nonRaggiungibile })], MAR10, { invii: [fallito] }),
    );
    c(
      "primo contatto fallito (es. «da collegare») → si ritenta con la chiave n|tel9|r",
      ["invia", `n|${t9(1)}|r`, "primo_contatto"],
      [ritenta?.tipo, ritenta?.chiave, ritenta?.extra?.quale],
    );
    c(
      "…anche se la scheda non ha segni del rifiuto",
      [`n|${t9(1)}|r`],
      [unica(sec([imp("i-1", 1)], MAR10, { invii: [fallito] }))?.chiave],
    );
    c(
      "…ma UNA volta sola: con n|tel9|r già presa (anche fallita) non si ritenta più",
      [],
      sec([imp("i-1", 1, { contattoWa: nonRaggiungibile })], MAR10, {
        invii: [fallito, { ...fallito, chiave: `n|${t9(1)}|r` }],
      }),
    );
    c(
      "…«non raggiungibile» senza un primo contatto fallito alle spalle non è un ritentativo → niente",
      [],
      sec([imp("i-1", 1, { contattoWa: nonRaggiungibile })], MAR10),
    );
    //  STOP, revoca, numero.
    c(
      "STOP → salta e lo dice; revoca di «Ok a WhatsApp» → salta; numero non valido → salta",
      [
        ["salta", true],
        ["salta", true],
        ["salta", true],
      ],
      [
        imp("i-1", 1, { contattoWa: { stato: "stop", il: "2026-09-01T09:00:00.000Z", da: "x" } }),
        imp("i-1", 1, { okWhatsapp: { si: false, il: "2026-09-01T09:00:00.000Z", da: "Giulia" } }),
        imp("i-1", 1, { telefono: "12" }),
      ].map((s, i) => {
        const x = unica(sec([s], MAR10));
        return [
          x?.tipo,
          new RegExp(["STOP", "revoca", "numero non valido"][i]).test(x?.motivo ?? ""),
        ];
      }),
    );
    c(
      "…un «Ok a WhatsApp» a sì sulla scheda non disturba: parte",
      ["invia"],
      tipi(
        sec(
          [
            imp("i-1", 1, {
              okWhatsapp: { si: true, il: "2026-09-01T09:00:00.000Z", da: "Giulia" },
            }),
          ],
          MAR10,
        ),
      ),
    );
    c(
      "nome mancante → salta (un modello col buco non parte)",
      ["salta", true],
      ((x) => [x?.tipo, /manca il nome/.test(x?.motivo ?? "")])(
        unica(sec([imp("i-1", 1, { nome: " " })], MAR10)),
      ),
    );
    //  Orario e tetti.
    c(
      "domenica a mezzogiorno → aspetta: parte alle 09:00 di lunedì 26 ottobre",
      ["aspetta", true],
      ((x) => [x?.tipo, /parte alle 09:00 di lunedì 26 ottobre/.test(x?.motivo ?? "")])(
        unica(sec([imp("i-1", 1)], "2026-10-25T12:00:00+01:00")),
      ),
    );
    c(
      "tetto dei lead nuovi di oggi raggiunto → aspetta; due primi contatti con tetto 2",
      ["aspetta", true],
      ((x) => [x?.tipo, /tetto dei lead nuovi/.test(x?.motivo ?? "")])(
        unica(
          sec([imp("i-9", 9)], MAR10, {
            tetti: { ricontatti: 20, leadNuovi: 2, totale: 100 },
            invii: righeOggi(2, "primo_contatto"),
          }),
        ),
      ),
    );
    const cento = Array.from({ length: 150 }, (_, i) =>
      imp(`i-${String(i).padStart(3, "0")}`, i + 100),
    );
    const dec = sec(cento, MAR10, { tetti: { ricontatti: 20, leadNuovi: 100, totale: 100 } });
    c(
      "150 importati: ne partono al massimo 70 (totale 100 meno la riserva 30), gli altri aspettano domani",
      [70, 80],
      [
        dec.filter((x) => x.tipo === "invia").length,
        dec.filter((x) => x.tipo === "aspetta").length,
      ],
    );
    //  Doppioni.
    c(
      "due schede con lo stesso telefono → UNA voce",
      1,
      sec([imp("i-1", 1), imp("i-2", 1)], MAR10).length,
    );
    const modulo = nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z");
    c(
      "lead del modulo Meta di oggi (stessa regola, stessa chiave n|tel9) → UNA decisione sola, nessun doppione",
      [1, `n|${t9(1)}`],
      ((r) => [r.length, r[0]?.chiave])(lead([modulo], MAR10)),
    );
    c(
      "…anche senza la data della frase (prima salta, ora parte) e fuori dalle 72 ore",
      [1, "invia"],
      ((r) => [r.length, r[0]?.tipo])(
        lead([nuovo("lead-1", 1, "2026-07-01T09:00:00.000Z")], MAR10, {
          fraseModuloDal: null,
          leadNuovoDal: "2026-07-01T00:00:00.000Z",
        }),
      ),
    );
    c(
      "…il richiamo a 24 ore del lead del modulo resta com'è (n| inviato ieri, nessuna risposta)",
      ["richiamo_24h"],
      ((r) => r.filter((x) => x.tipo === "invia").map((x) => x.extra.quale))(
        lead([nuovo("lead-1", 1, "2026-10-26T09:00:00.000Z")], "2026-10-27T10:30:00+01:00", {
          invii: [invio(1, "primo_contatto", "2026-10-26T09:00:30.000Z", { chiave: `n|${t9(1)}` })],
        }),
      ),
    );
  }

  gruppo("MANYCHAT · MESSAGGIO DI RITORNO (hgl_ritorno)");
  {
    const ULTIMO = "2026-10-27T08:00:00.000Z"; // 09:00 a Roma
    /** un contatto di ritorno: il suo `ricarico` è salito */
    const rit = (id, n, extra, ricarico) => ({
      id,
      data: {
        nome: "Dario",
        telefono: tel(n),
        stato: "da_ricontattare",
        importato: true,
        ricarico: { volte: 2, ultimo: ULTIMO, daDecidere: true, ...ricarico },
        ...extra,
      },
    });
    const sec = (schede, adesso, extra) => lead(schede, adesso, { fraseModuloDal: null, ...extra });
    const CH = `r|${t9(1)}|${ULTIMO}`;
    const d1 = unica(sec([rit("r-1", 1)], MAR10));
    c(
      "ritorno non contattato → messaggio di ritorno, chiave r|tel9|<istante del ritorno>, nessun consenso",
      ["invia", CH, "ritorno"],
      [d1?.tipo, d1?.chiave, d1?.extra?.quale],
    );
    c(
      "…parte appena entra (adesso = 1 minuto dopo il ritorno)",
      ["invia"],
      tipi(sec([rit("r-1", 1)], "2026-10-27T10:01:00+01:00")),
    );
    c(
      "…fuori orario (sabato sera) aspetta le 09:00 del lunedì",
      ["aspetta", true],
      ((x) => [x?.tipo, /parte alle 09:00 di lunedì 26 ottobre/.test(x?.motivo ?? "")])(
        unica(
          sec(
            [rit("r-1", 1, {}, { ultimo: "2026-10-24T19:00:00.000Z" })],
            "2026-10-24T21:00:00+02:00",
          ),
        ),
      ),
    );
    c(
      "…senza il campo ultimo (o illeggibile) non è un ritorno",
      [[], []],
      [
        sec(
          [rit("r-1", 1, { stato: "sta_valutando", importato: false }, { ultimo: undefined })],
          MAR10,
        ),
        sec(
          [rit("r-1", 1, { stato: "sta_valutando", importato: false }, { ultimo: "ieri" })],
          MAR10,
        ),
      ],
    );
    c(
      "clienti esclusi: chiusura vinta, venduto, acconto, acconto pagato",
      [[], [], [], [], ["invia"]],
      [
        sec([rit("r-1", 1, { stato: "posa_in_sede" })], MAR10),
        sec([rit("r-1", 1, { stato: "venduto" })], MAR10),
        sec([rit("r-1", 1, { stato: "acconto" })], MAR10),
        sec([rit("r-1", 1, { payment: { accontoPagato: 100 } })], MAR10),
        tipi(sec([rit("r-1", 1, { payment: { accontoPagato: 0 } })], MAR10)),
      ],
    );
    c(
      "meet futuro fissato → niente; meet di ieri → parte",
      [[], [], ["invia"]],
      [
        sec([rit("r-1", 1, { dataMeeting: "2026-10-29", oraMeeting: "16:00" })], MAR10),
        sec([rit("r-1", 1, { dataMeeting: "2026-10-27", oraMeeting: "18:00" })], MAR10),
        tipi(sec([rit("r-1", 1, { dataMeeting: "2026-10-26", oraMeeting: "16:00" })], MAR10)),
      ],
    );
    c(
      "già contattato DOPO il ritorno (invio arrivato di qualunque tipo) → niente; PRIMA del ritorno → parte",
      [[], [], ["invia"]],
      [
        sec([rit("r-1", 1)], MAR10, { invii: [invio(1, "chat", "2026-10-27T08:30:00.000Z")] }),
        sec([rit("r-1", 1)], MAR10, {
          invii: [invio(1, "ricontatto", "2026-10-27T08:30:00.000Z")],
        }),
        tipi(
          sec([rit("r-1", 1)], MAR10, {
            invii: [
              invio(1, "chat", "2026-10-26T08:30:00.000Z", {
                rispostaIl: "2026-10-26T08:40:00.000Z",
              }),
            ],
          }),
        ),
      ],
    );
    c(
      "…un invio fallito dopo il ritorno non ha raggiunto nessuno (la chiave però è presa: niente ritentativo)",
      [["invia"], []],
      [
        tipi(
          sec([rit("r-1", 1)], MAR10, {
            invii: [invio(1, "chat", "2026-10-27T08:30:00.000Z", { stato: "fallito" })],
          }),
        ),
        sec([rit("r-1", 1)], MAR10, {
          invii: [
            invio(1, "ritorno", "2026-10-27T08:30:00.000Z", { stato: "fallito", chiave: CH }),
          ],
        }),
      ],
    );
    c(
      "…mai due volte per lo stesso ritorno: chiave già presa in qualunque stato → niente",
      [[], [], []],
      ["inviato", "prenotato", "incerto"].map((stato) =>
        sec([rit("r-1", 1)], MAR10, {
          invii: [invio(1, "ritorno", "2026-10-27T08:30:00.000Z", { stato, chiave: CH })],
        }),
      ),
    );
    c(
      "…un NUOVO ritorno (ultimo più recente) riparte, con la sua chiave",
      [`r|${t9(1)}|2026-10-27T09:30:00.000Z`],
      [
        unica(
          sec(
            [rit("r-1", 1, {}, { ultimo: "2026-10-27T09:30:00.000Z" })],
            "2026-10-27T10:45:00+01:00",
            {
              invii: [invio(1, "ritorno", "2026-10-27T08:30:00.000Z", { chiave: CH })],
            },
          ),
        )?.chiave,
      ],
    );
    c(
      "secondo stato cambiato dopo il ritorno (risposta, cambio a mano) → niente; prima del ritorno → parte",
      [[], ["invia"]],
      [
        sec(
          [
            rit("r-1", 1, {
              contattoWa: { stato: "ha_risposto", il: "2026-10-27T08:30:00.000Z", da: "x" },
            }),
          ],
          MAR10,
        ),
        tipi(
          sec(
            [
              rit("r-1", 1, {
                contattoWa: { stato: "non_ha_risposto", il: "2026-10-26T08:30:00.000Z", da: "x" },
              }),
            ],
            MAR10,
          ),
        ),
      ],
    );
    c(
      "«Contatta su WhatsApp» premuto a mano dopo il ritorno (ricarico.whatsappIl) → niente",
      [],
      sec([rit("r-1", 1, {}, { whatsappIl: "2026-10-27T08:20:00.000Z" })], MAR10),
    );
    c(
      "STOP, revoca, numero non valido, nome mancante → salta",
      [
        ["salta", true],
        ["salta", true],
        ["salta", true],
        ["salta", true],
      ],
      [
        [
          rit("r-1", 1, { contattoWa: { stato: "stop", il: "2026-10-27T08:30:00.000Z", da: "x" } }),
          "STOP",
        ],
        [
          rit("r-1", 1, { okWhatsapp: { si: false, il: "2026-10-20T09:10:00.000Z", da: "G" } }),
          "revoca",
        ],
        [rit("r-1", 1, { telefono: "12" }), "numero non valido"],
        [rit("r-1", 1, { nome: "" }), "manca il nome"],
      ].map(([s, parola]) => {
        const x = unica(sec([s], MAR10));
        return [x?.tipo, new RegExp(parola).test(x?.motivo ?? "")];
      }),
    );
    c(
      "il freno «mai due senza risposta» non ferma il ritorno: ci ha scritto lui",
      ["invia"],
      tipi(
        sec([rit("r-1", 1)], MAR10, {
          invii: [invio(1, "ricontatto", "2026-10-25T08:30:00.000Z")],
        }),
      ),
    );
    c(
      "ritorno E importato mai contattato → UNA voce sola, il messaggio di ritorno",
      [1, "ritorno"],
      ((r) => [r.length, r[0]?.extra?.quale])(
        sec([rit("r-1", 1, { stato: "da_contattare" })], MAR10),
      ),
    );
    c(
      "lead del modulo di oggi che è anche un ritorno → UNA voce sola (il primo contatto del modulo)",
      [1, "primo_contatto"],
      ((r) => [r.length, r[0]?.extra?.quale])(
        lead(
          [
            nuovo("lead-1", 1, "2026-10-27T09:00:00.000Z", {
              ricarico: { volte: 2, ultimo: ULTIMO },
            }),
          ],
          MAR10,
        ),
      ),
    );
    c(
      "il ritorno conta nel tetto dei lead nuovi di oggi",
      ["aspetta"],
      tipi(
        sec([rit("r-1", 1)], MAR10, {
          tetti: { ricontatti: 20, leadNuovi: 2, totale: 100 },
          invii: righeOggi(1, "primo_contatto").concat(righeOggi(1, "ritorno")),
        }),
      ),
    );
    c(
      "i ritorni passano avanti agli importati mai contattati quando il tetto è stretto",
      [`r|${t9(1)}|${ULTIMO}`],
      [
        sec([imp0("i-1", 2), rit("r-9", 1)], MAR10, {
          tetti: { ricontatti: 20, leadNuovi: 1, totale: 100 },
        })
          .filter((x) => x.tipo === "invia")
          .map((x) => x.chiave)[0],
      ],
    );
    function imp0(id, n) {
      return {
        id,
        data: { nome: "Carla", telefono: tel(n), stato: "da_contattare", importato: true },
      };
    }
  }

  gruppo("MANYCHAT · MIGRAZIONE DEL RITORNO (TESTO)");
  {
    const percorso = join(radice, "supabase/migrations/20261028130000_manychat_ritorno.sql");
    c("la migrazione del ritorno esiste", true, existsSync(percorso));
    if (existsSync(percorso)) {
      const grezzo = readFileSync(percorso, "utf8");
      const sql = grezzo.replace(/--[^\n]*/g, "");
      const corpo = sql.slice(
        sql.indexOf("CREATE OR REPLACE FUNCTION public.manychat_prenota_giro("),
      );
      c(
        "il CHECK accetta 'ritorno' e si allarga una volta sola (già largo = niente)",
        [true, true],
        [/'ritorno'/.test(sql), /v_def LIKE '%''ritorno''%'/.test(sql)],
      );
      c(
        "tetto dei lead nuovi 100 (= totale), totale 100, riserva 30, ricontatti 20",
        [true, true, true, true],
        [
          /v_tetto_ln\s+constant int := 100;/.test(corpo),
          /v_tetto_tot\s+constant int := 100;/.test(corpo),
          /v_riserva\s+constant int := 30;/.test(corpo),
          /v_tetto_ric\s+constant int := 20;/.test(corpo),
        ],
      );
      c(
        "'ritorno' è un tipo valido, conta fra i lead nuovi e sotto la riserva, ma NON aspetta il ritmo",
        [true, true, true, true, false],
        [
          /v_tipo NOT IN \([^)]*'ritorno'/.test(corpo),
          /FILTER \(WHERE tipo IN \('primo_contatto', 'richiamo_24h', 'ritorno'\)\)/.test(corpo),
          /IF v_tipo IN \('primo_contatto', 'richiamo_24h', 'ritorno', 'ricontatto'\) THEN/.test(
            corpo,
          ),
          /IF v_tipo IN \('primo_contatto', 'richiamo_24h', 'ritorno'\) AND v_ln >= v_max_ln/.test(
            corpo,
          ),
          /IF v_tipo IN \('ricontatto', 'richiamo_24h'(, 'ritorno')?\)/.test(corpo) &&
            /IF v_tipo IN \('ricontatto', 'richiamo_24h', 'ritorno'\)/.test(corpo),
        ],
      );
      c(
        "niente DELETE, TRUNCATE, DROP TABLE o DROP COLUMN; un solo DROP (il vincolo, dentro EXECUTE)",
        [false, false, 1],
        [
          /\b(DELETE|TRUNCATE)\b/i.test(sql),
          /DROP (TABLE|COLUMN)/i.test(sql),
          (sql.match(/\bDROP\b/gi) ?? []).length,
        ],
      );
      c(
        "solo il server la chiama (REVOKE a PUBLIC, GRANT a service_role)",
        [true, true],
        [
          /REVOKE ALL ON FUNCTION public\.manychat_prenota_giro/.test(sql),
          /TO service_role/.test(sql),
        ],
      );
    }
  }
}
