import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSync } from "esbuild";

/** Impacchetta un modulo `.ts` puro in una cartella temporanea e lo carica. */
function carica(radice, relativo) {
  const dove = mkdtempSync(join(tmpdir(), "casi-reali-"));
  try {
    const fuori = join(dove, "modulo.cjs");
    buildSync({
      entryPoints: [join(radice, relativo)],
      bundle: true,
      format: "cjs",
      outfile: fuori,
      alias: { "@": join(radice, "src") },
      logLevel: "error",
    });
    return createRequire(import.meta.url)(fuori);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}

/** ── PROVE: IL SECONDO MESSAGGIO «CASI REALI» ───────────────────────────────
 *
 *  Commessa 2026-10-28 (`wa-casi-reali`), parte A. Dopo il primo contatto
 *  ARRIVATO a un numero, il giro manda UNA volta `hgl_casi_reali` (chiave
 *  `casi|tel9`, tipo `casi_reali`): non prima di 2 minuti, fra le 9 e le 20 da
 *  lunedì a sabato, solo se il cliente non ha risposto, non ha un appuntamento e
 *  non ha detto STOP; solo per i primi contatti partiti dalla pubblicazione in
 *  poi. Funzioni pure: l'orologio entra come argomento. Qui le regole pure, i
 *  testi e le liste; il giro vero è in `giro.mjs`, la migrazione in fondo.
 *  Dati inventati. Martedì 27/10/2026 10:00 a Roma (+01:00, ora solare).
 *
 *  Parte B (anteprima dei link, canale Cloud): in coda a questo file. */
export async function proveCasiReali(mod, { c, gruppo, radice }) {
  const S = mod["manychat/sequenze"];
  const R = mod["manychat/regole"];
  const T = mod["manychat/testi"];
  const G = mod["manychat/giro"];
  const W = mod["wa-meta-templates"];
  const P = mod["manychat/porta"];

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
  const DAL = "2026-10-20T06:00:00.000Z";
  /** da quando valgono i primi contatti (nelle prove: prima di tutto) */
  const CASI_DAL = "2026-10-20T00:00:00.000Z";
  const TETTI = { ricontatti: 20, leadNuovi: 100, totale: 100 };
  const MAR10 = "2026-10-27T10:00:00+01:00";
  /** il primo contatto è partito alle 09:00 Roma (08:00Z): un'ora prima di MAR10 */
  const PRIMO = "2026-10-27T08:00:00.000Z";

  /** una scheda che ha appena ricevuto il primo contatto: «Attesa WhatsApp», secondo stato «In attesa» */
  const attesa = (id, n, extra) => ({
    id,
    data: {
      nome: "Anna",
      cognome: "Prova",
      telefono: tel(n),
      stato: "attesa_whatsapp",
      importato: true,
      contattoWa: {
        stato: "in_attesa",
        il: PRIMO,
        da: "automatico",
        motivo: "primo_contatto",
        scadeRisposta: "2026-10-28T08:00:00.000Z",
        invioId: "inv-1",
        storia: [],
      },
      ...extra,
    },
  });
  const primo = (n, extra) => ({
    telefono: num(n),
    tipo: "primo_contatto",
    stato: "inviato",
    prenotatoIl: PRIMO,
    chiave: `n|${t9(n)}`,
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
  const lead = (schede, adesso, extra) =>
    S.decidiLeadNuovi(schede, t(adesso), {
      consulenti,
      invii: [primo(1)],
      tetti: TETTI,
      fraseModuloDal: null,
      leadNuovoDal: DAL,
      casiRealiDal: CASI_DAL,
      ...extra,
    });
  const dec = (r) => ((x) => [x?.tipo, x?.chiave, x?.extra?.quale])(unica(r));

  /* ════════════════════════════════════════════════════════════════════════
   *  QUANDO PARTE
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · CASI REALI: QUANDO PARTE");
  c(
    "un'ora dopo il primo contatto, senza risposta → invia casi|tel9 (tipo casi_reali)",
    ["invia", `casi|${t9(1)}`, "casi_reali"],
    dec(lead([attesa("s-1", 1)], MAR10)),
  );
  c(
    "…la scheda è quella giusta",
    "s-1",
    unica(lead([attesa("s-1", 1)], MAR10))?.scheda.id,
  );
  c(
    "…vale anche il primo contatto ritentato (chiave n|tel9|r)",
    ["invia"],
    tipi(lead([attesa("s-1", 1)], MAR10, { invii: [primo(1, { chiave: `n|${t9(1)}|r` })] })),
  );
  c(
    "…il numero scritto in modo diverso (prefisso +39, spazi) è lo stesso numero",
    ["invia"],
    tipi(
      lead([attesa("s-1", 1, { telefono: `+39 ${tel(1)}` })], MAR10, {
        invii: [primo(1)],
      }),
    ),
  );

  //  La pausa di 120 s per contatto: il casi non prima di 2 minuti dal primo.
  const primoRecente = (secondi) =>
    primo(1, { prenotatoIl: new Date(t(MAR10).getTime() - secondi * 1000).toISOString() });
  const recente = (secondi) => lead([attesa("s-1", 1)], MAR10, { invii: [primoRecente(secondi)] });
  c(
    "30 secondi dopo il primo → aspetta (pausa per contatto), 119 s aspetta ancora",
    [
      ["aspetta", true],
      ["aspetta", true],
    ],
    [30, 119].map((s) => ((x) => [x?.tipo, /pausa/.test(x?.motivo ?? "")])(unica(recente(s)))),
  );
  c("…a 120 s esatti parte", ["invia"], tipi(recente(120)));
  c(
    "…e il motivo dell'attesa porta il prefisso «casi reali: » (non è un problema del riquadro)",
    true,
    unica(recente(30))?.motivo.startsWith(S.PREFISSO_CASI),
  );

  //  La fascia oraria: 9-20, lunedì-sabato (ora di Roma).
  const sabSera = primo(1, { prenotatoIl: "2026-10-24T17:50:00.000Z" }); // sabato 19:50 (+02:00)
  const scadeLun = "2026-10-26T17:50:00.000Z";
  const schedaSab = attesa("s-1", 1, {
    contattoWa: {
      stato: "in_attesa",
      il: sabSera.prenotatoIl,
      da: "automatico",
      motivo: "primo_contatto",
      scadeRisposta: scadeLun,
      invioId: "inv-1",
      storia: [],
    },
  });
  const sab = (adesso) => unica(lead([schedaSab], adesso, { invii: [sabSera] }));
  c(
    "primo partito sabato alle 19:50: la domenica a mezzogiorno aspetta, parte alle 09:00 di lunedì",
    ["aspetta", "casi reali: parte alle 09:00 di lunedì 26 ottobre"],
    ((x) => [x?.tipo, x?.motivo])(sab("2026-10-25T12:00:00+01:00")),
  );
  c(
    "…lunedì alle 08:59 aspetta, alle 09:00 parte (entro la scadenza della risposta)",
    ["aspetta", "invia"],
    [sab("2026-10-26T08:59:00+01:00")?.tipo, sab("2026-10-26T09:00:00+01:00")?.tipo],
  );
  const sera = primo(1, { prenotatoIl: "2026-10-27T18:50:00.000Z" }); // 19:50
  c(
    "alle 19:59 parte, alle 20:00 no: aspetta le 09:00 del giorno dopo",
    [
      ["invia", undefined],
      ["aspetta", "casi reali: parte alle 09:00 di mercoledì 28 ottobre"],
    ],
    ["2026-10-27T19:59:00+01:00", "2026-10-27T20:00:00+01:00"].map((a) =>
      ((x) => [x?.tipo, x?.tipo === "aspetta" ? x.motivo : undefined])(
        unica(
          lead(
            [
              attesa("s-1", 1, {
                contattoWa: {
                  stato: "in_attesa",
                  il: sera.prenotatoIl,
                  da: "automatico",
                  motivo: "primo_contatto",
                  scadeRisposta: "2026-10-28T18:50:00.000Z",
                  invioId: "inv-1",
                  storia: [],
                },
              }),
            ],
            a,
            { invii: [sera] },
          ),
        ),
      ),
    ),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  CHI NON LO RICEVE
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · CASI REALI: CHI NON LO RICEVE");
  const niente = (nome, schede, extra, adesso = MAR10) =>
    c(nome, [], lead(schede, adesso, extra));

  niente("«Lead nuovo» mai acceso (nessuna data) → niente", [attesa("s-1", 1)], {
    leadNuovoDal: null,
  });
  niente(
    "primo contatto non ARRIVATO (fallito, saltato, prenotato, incerto) → niente",
    [attesa("s-1", 1)],
    { invii: ["fallito", "saltato", "prenotato", "incerto"].map((stato) => primo(1, { stato })) },
  );
  niente(
    "il primo contatto è partito PRIMA della pubblicazione → niente (nessun recupero dei vecchi)",
    [attesa("s-1", 1)],
    { casiRealiDal: "2026-10-27T08:00:01.000Z" },
  );
  c(
    "…dalla pubblicazione in poi (stesso istante compreso) parte",
    ["invia"],
    tipi(lead([attesa("s-1", 1)], MAR10, { casiRealiDal: PRIMO })),
  );
  c(
    "…senza una data passata a mano vale la costante CASI_REALI_DAL (una data vera, non prima del 28/10/2026)",
    [true, true],
    [
      Number.isFinite(Date.parse(S.CASI_REALI_DAL)),
      Date.parse(S.CASI_REALI_DAL) >= Date.parse("2026-10-28T00:00:00+01:00"),
    ],
  );
  c(
    "…e con la costante un primo contatto del 27/10 non lo riceve",
    [],
    lead([attesa("s-1", 1)], MAR10, { casiRealiDal: undefined }),
  );
  niente("la chiave casi|tel9 c'è già nel registro (in qualunque stato) → una volta sola", [attesa("s-1", 1)], {
    invii: [
      primo(1),
      { telefono: num(1), tipo: "casi_reali", stato: "fallito", prenotatoIl: PRIMO, chiave: `casi|${t9(1)}` },
    ],
  });
  niente(
    "un primo contatto di un altro numero non fa partire questo",
    [attesa("s-1", 1)],
    { invii: [primo(2)] },
  );
  niente(
    "è un messaggio di ritorno o un richiamo, non un primo contatto → niente",
    [attesa("s-1", 1)],
    {
      invii: [
        primo(1, { tipo: "ritorno", chiave: `r|${t9(1)}|2026-10-27T08:00:00.000Z` }),
        primo(1, { tipo: "richiamo_24h", chiave: `n24|${t9(1)}` }),
      ],
    },
  );
  niente("la scheda del numero non c'è tra quelle lette → niente", [attesa("s-9", 9)]);

  //  Ha risposto.
  niente("«Ha risposto» sulla scheda → niente", [
    attesa("s-1", 1, {
      contattoWa: { stato: "ha_risposto", il: "2026-10-27T08:30:00.000Z", da: "automatico", storia: [] },
    }),
  ]);
  niente("risposta registrata sul primo contatto → niente", [attesa("s-1", 1)], {
    invii: [primo(1, { rispostaIl: "2026-10-27T08:10:00.000Z" })],
  });
  niente("cambio a mano (Contattato) → niente: c'è già una persona che scrive", [
    attesa("s-1", 1, {
      contattoWa: { stato: "contattato", il: "2026-10-27T08:30:00.000Z", da: "Giulia", storia: [] },
    }),
  ]);
  niente("senza secondo stato «In attesa» dopo il primo contatto → niente", [
    attesa("s-1", 1, { contattoWa: undefined }),
  ]);
  niente(
    "se dopo il primo contatto è partito un altro messaggio automatico → niente",
    [attesa("s-1", 1)],
    {
      invii: [
        primo(1),
        { telefono: num(1), tipo: "ricontatto", stato: "inviato", prenotatoIl: "2026-10-27T08:20:00.000Z" },
      ],
    },
  );
  niente(
    "scaduta l'attesa della risposta (è l'ora del richiamo) → niente",
    [attesa("s-1", 1)],
    {},
    "2026-10-28T10:00:00+01:00",
  );

  //  Appuntamento.
  niente("la scheda ha una data di meet → niente", [attesa("s-1", 1, { dataMeeting: "2026-10-30" })]);
  niente("la scheda è in stato appuntamento → niente", [
    attesa("s-1", 1, { stato: "appuntamento_fissato" }),
  ]);

  //  STOP e revoca: si dicono, non sono problemi.
  const stop = unica(
    lead([
      attesa("s-1", 1, {
        contattoWa: { stato: "stop", il: "2026-10-27T08:30:00.000Z", da: "automatico", storia: [] },
      }),
    ], MAR10),
  );
  c(
    "STOP → non parte (salta, col prefisso dei casi reali)",
    ["salta", "casi reali: STOP"],
    [stop?.tipo, stop?.motivo],
  );
  const revoca = unica(
    lead([attesa("s-1", 1, { okWhatsapp: { si: false, il: "2026-10-27T08:30:00.000Z", da: "G" } })], MAR10),
  );
  c(
    "revoca di «Ok a WhatsApp» → non parte",
    ["salta", "casi reali: revoca di «Ok a WhatsApp»"],
    [revoca?.tipo, revoca?.motivo],
  );
  c(
    "senza il nome sulla scheda → salta (col prefisso dei casi reali), non parte",
    ["salta", "casi reali: manca il nome"],
    ((x) => [x?.tipo, x?.motivo])(unica(lead([attesa("s-1", 1, { nome: "" })], MAR10))),
  );

  //  Due schede con lo stesso numero: una sola voce.
  c(
    "due schede con lo stesso numero fanno UNA voce (vince l'id più basso)",
    ["s-0"],
    lead([attesa("s-1", 1), attesa("s-0", 1)], MAR10).map((x) => x.scheda.id),
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  I TETTI E LA PRIORITÀ
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · CASI REALI: TETTI E PRIORITÀ");
  const motivo1 = (r) => ((x) => [x?.tipo, x?.motivo])(unica(r));
  c(
    "conta fra i lead nuovi: 3 su 3 già partiti oggi → aspetta domani",
    ["aspetta", "casi reali: tetto dei lead nuovi di oggi raggiunto: se ne parla domani"],
    motivo1(
      lead([attesa("s-1", 1)], MAR10, {
        tetti: { ...TETTI, leadNuovi: 3 },
        invii: [primo(1), ...righeOggi(2, "primo_contatto"), ...righeOggi(0, "casi_reali")],
      }),
    ),
  );
  c(
    "…i casi reali già partiti oggi contano come lead nuovi (2 + 1 primo = 3)",
    ["aspetta"],
    tipi(
      lead([attesa("s-1", 1)], MAR10, {
        tetti: { ...TETTI, leadNuovi: 3 },
        invii: [primo(1), ...righeOggi(2, "casi_reali")],
      }),
    ),
  );
  c(
    "conta nel totale e sotto la riserva per gli appuntamenti (100 − 30 = 70)",
    [
      ["aspetta", "casi reali: tetto di messaggi di oggi raggiunto: se ne parla domani"],
      ["invia"],
    ],
    [
      motivo1(lead([attesa("s-1", 1)], MAR10, { invii: [primo(1), ...righeOggi(70, "promemoria")] })),
      tipi(lead([attesa("s-1", 1)], MAR10, { invii: [primo(1), ...righeOggi(68, "promemoria")] })),
    ],
  );
  c(
    "…e i casi reali già partiti pesano nel totale",
    ["aspetta"],
    tipi(lead([attesa("s-1", 1)], MAR10, { invii: [primo(1), ...righeOggi(69, "casi_reali")] })),
  );
  //  Priorità: chi ha già ricevuto il primo passa davanti a un primo contatto nuovo.
  const nuovo = (id, n) => ({
    id,
    data: {
      nome: "Carla",
      telefono: tel(n),
      stato: "da_contattare",
      importato: true,
      createdAt: "2026-07-01T09:00:00.000Z",
    },
  });
  const duo = lead([nuovo("n-1", 2), attesa("s-1", 1)], MAR10, {
    tetti: { ...TETTI, leadNuovi: 2 },
    invii: [primo(1), ...righeOggi(0, "primo_contatto")],
  });
  c(
    "con un solo posto rimasto: il casi reali parte, il primo contatto nuovo aspetta",
    [
      ["invia", "casi_reali"],
      ["aspetta", "primo_contatto"],
    ],
    duo.map((x) => [x.tipo, x.tipo === "invia" ? x.extra.quale : "primo_contatto"]),
  );
  c(
    "…il casi reali è il primo della lista",
    `casi|${t9(1)}`,
    duo[0]?.chiave,
  );
  const ord = G.ORDINE_GIRO;
  c(
    "nel giro viene dopo i messaggi degli appuntamenti e prima del ritorno e del primo contatto",
    [true, true, true],
    [
      ord.indexOf("casi_reali") > ord.indexOf("promemoria_sede"),
      ord.indexOf("casi_reali") < ord.indexOf("ritorno"),
      ord.indexOf("casi_reali") < ord.indexOf("primo_contatto"),
    ],
  );
  //  Il richiamo dopo 24 ore non si accorge del casi reali: la sequenza del modulo prosegue.
  const modulo = (id, n, il) => ({
    id,
    data: {
      nome: "Anna",
      telefono: tel(n),
      stato: "attesa_whatsapp",
      importato: true,
      consensoModulo: { whatsapp: true, il, via: "modulo_meta", fonte: "google_sheets" },
      origineIngresso: { via: "google_sheets", foglio: "Lead HGL", il },
    },
  });
  const richiamo = lead(
    [modulo("m-1", 1, "2026-10-27T08:00:00.000Z")],
    "2026-10-28T10:00:00+01:00",
    {
      fraseModuloDal: "2026-10-20T00:00:00.000Z",
      invii: [
        primo(1),
        {
          telefono: num(1),
          tipo: "casi_reali",
          stato: "inviato",
          prenotatoIl: "2026-10-27T08:03:00.000Z",
          chiave: `casi|${t9(1)}`,
        },
      ],
    },
  );
  c(
    "dopo primo e casi reali il richiamo a 24 ore parte lo stesso (n24|tel9)",
    ["invia", `n24|${t9(1)}`],
    [richiamo[0]?.tipo, richiamo[0]?.chiave],
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  REGOLE, TESTI, MODELLO E LISTE
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · CASI REALI: TIPO, CAMPI, MODELLO, LISTE");
  c(
    "regole: è un messaggio automatico, conta nei tetti, non è di servizio né col ritmo",
    [true, true, false, false],
    [
      R.TIPI_AUTOMATICI.includes("casi_reali"),
      R.TIPI_NEI_TETTI.includes("casi_reali"),
      R.TIPI_SENZA_FRENO.includes("casi_reali"),
      R.TIPI_COL_RITMO.includes("casi_reali"),
    ],
  );
  c(
    "campi: solo il nome (crm_v1), come il primo contatto",
    [{ tipo: "campi", campi: { crm_nome: "Anna" } }, "salta"],
    [T.campiCasiReali({ nome: "Anna", cognome: "Prova" }), T.campiCasiReali({ nome: "" }).tipo],
  );
  c(
    "giro: modello hgl_casi_reali e tag crm-casi-reali",
    { modello: "hgl_casi_reali", tag: "crm-casi-reali" },
    G.MODELLI_SEQUENZE.casi_reali,
  );
  const modello = W.MODELLI_MANYCHAT.find((m) => m.name === "hgl_casi_reali");
  c(
    "il modello è fra quelli di ManyChat (MARKETING, una variabile: il nome) e dice di che cosa si tratta",
    [true, "MARKETING", 1, true, true],
    [
      !!modello,
      modello?.category,
      modello?.params?.length,
      /casi reali/.test(modello?.body ?? ""),
      /Invisible Derm Protocol/.test(modello?.body ?? ""),
    ],
  );
  c(
    "…e non è in META_TEMPLATES (quella lista è dei modelli della Cloud API)",
    false,
    W.META_TEMPLATES.some((m) => m.name === "hgl_casi_reali"),
  );

  const V = carica(radice, "src/crm/manychat/vista-pannello.ts");
  const PN = carica(radice, "src/crm/manychat/pannello.ts");
  c(
    "riquadro: la riga «Lead nuovo: casi reali» c'è, dopo il messaggio di ritorno",
    [true, true],
    [
      V.MODELLI_FLUSSO_SEQUENZE.some(
        (m) => m.modello === "hgl_casi_reali" && m.etichetta === "Lead nuovo: casi reali",
      ),
      V.MODELLI_FLUSSO_SEQUENZE.findIndex((m) => m.modello === "hgl_casi_reali") ===
        V.MODELLI_FLUSSO_SEQUENZE.findIndex((m) => m.modello === "hgl_ritorno") + 1,
    ],
  );
  c(
    "…e il tipo ha la sua parola nei problemi e nella prova a secco",
    "casi reali",
    V.ETICHETTA_TIPO.casi_reali,
  );
  const giornata = [
    { lead_id: "x", tipo: "primo_contatto", stato: "inviato", motivo: null, prenotato_il: "2026-10-26T08:00:00.000Z", risposta_il: null },
    { lead_id: "x", tipo: "casi_reali", stato: "inviato", motivo: null, prenotato_il: "2026-10-26T08:03:00.000Z", risposta_il: null },
    { lead_id: "y", tipo: "casi_reali", stato: "fallito", motivo: null, prenotato_il: "2026-10-26T08:03:00.000Z", risposta_il: null },
  ];
  const sg = PN.costruisciStato(
    {
      config: null,
      sequenze: true,
      giro: null,
      invii: giornata,
      problemi: [],
      ultimoInvioIl: null,
      nomi: {},
    },
    new Date("2026-10-26T10:00:00Z"),
  );
  c(
    "il conteggio di oggi: i casi reali contano fra i lead nuovi e nel totale (i falliti no)",
    [2, 2],
    [sg.giro.oggi.leadNuovi, sg.giro.oggi.totale],
  );

  /* ════════════════════════════════════════════════════════════════════════
   *  LA MIGRAZIONE (TESTO)
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · CASI REALI: LA MIGRAZIONE (TESTO)");
  {
    const percorso = join(radice, "supabase/migrations/20261028190000_manychat_casi_reali.sql");
    c("la migrazione esiste col nome della commessa", true, existsSync(percorso));
    if (existsSync(percorso)) {
      const grezzo = readFileSync(percorso, "utf8");
      const sql = grezzo.replace(/--[^\n]*/g, "");
      const corpo = sql.slice(
        sql.indexOf("CREATE OR REPLACE FUNCTION public.manychat_prenota_giro("),
      );
      c(
        "il CHECK accetta 'casi_reali' e si allarga una volta sola (già largo = niente)",
        [true, true, true],
        [
          /'casi_reali'/.test(sql),
          /v_def LIKE '%''casi_reali''%'/.test(sql),
          // l'elenco largo porta ancora tutti i tipi di prima
          ["promemoria", "ricontatto", "conferma", "chat", "webinar", "prova", "primo_contatto",
            "richiamo_24h", "meet_oggi", "meet_domani", "meet_adesso", "promemoria_chiamata",
            "promemoria_sede", "ritorno"].every((x) => sql.includes(`''${x}''`) || sql.includes(`'${x}'`)),
        ],
      );
      c(
        "tetti uguali a prima: lead nuovi 150, totale 150, riserva 30, ricontatti 20",
        [true, true, true, true],
        [
          /v_tetto_ln\s+constant int := 150;/.test(corpo),
          /v_tetto_tot\s+constant int := 150;/.test(corpo),
          /v_riserva\s+constant int := 30;/.test(corpo),
          /v_tetto_ric\s+constant int := 20;/.test(corpo),
        ],
      );
      c(
        "'casi_reali' è un tipo valido, conta fra i lead nuovi e nel totale, sta sotto la riserva, NON aspetta il ritmo",
        [true, true, true, true, true, false],
        [
          /v_tipo NOT IN \([^)]*'casi_reali'/.test(corpo),
          /FILTER \(WHERE tipo IN \('primo_contatto', 'richiamo_24h', 'ritorno', 'casi_reali'\)\)/.test(corpo),
          /AND tipo IN \([^)]*'casi_reali'[^)]*\)\s*AND stato IN/.test(corpo),
          /IF v_tipo IN \('primo_contatto', 'richiamo_24h', 'ritorno', 'casi_reali', 'ricontatto'\) THEN/.test(corpo),
          /IF v_tipo IN \('primo_contatto', 'richiamo_24h', 'ritorno', 'casi_reali'\) AND v_ln >= v_max_ln/.test(corpo),
          /IF v_tipo IN \('ricontatto', 'richiamo_24h'[^)]*'casi_reali'/.test(corpo),
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
      //  Tutto il resto della funzione è identico all'ultima versione (tetto 150).
      const ultima = readFileSync(
        join(radice, "supabase/migrations/20261028150000_manychat_tetto_150.sql"),
        "utf8",
      ).replace(/--[^\n]*/g, "");
      const corpoUltima = ultima.slice(
        ultima.indexOf("CREATE OR REPLACE FUNCTION public.manychat_prenota_giro("),
      );
      const cifraTipi = (s) =>
        s
          .replace(/'casi_reali',\s*/g, "")
          .replace(/,\s*'casi_reali'/g, "")
          .replace(/\s+/g, " ");
      c(
        "la funzione è una copia dell'ultima (tetto 150) a parte il tipo nuovo",
        cifraTipi(corpoUltima),
        cifraTipi(corpo),
      );
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  PARTE B · ANTEPRIMA DEI LINK (CANALE CLOUD)
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("WHATSAPP · ANTEPRIMA DEI LINK NEGLI INVII A MANO (canale Cloud)");
  {
    const testo = (body) => P.corpoGraph({ a: "+393331234567", testo: body }).text;
    c(
      "testo senza link: preview_url resta falso",
      { preview_url: false, body: "Buongiorno Maria" },
      testo("Buongiorno Maria"),
    );
    c(
      "testo col link della pagina dei media: preview_url vero",
      { preview_url: true, body: "Ecco i casi: https://hair-genius-hub.hair/media/336A-7DUU-4RDM grazie" },
      testo("Ecco i casi: https://hair-genius-hub.hair/media/336A-7DUU-4RDM grazie"),
    );
    c(
      "…vale per http e https, in qualunque punto del testo, anche a capo e con maiuscole",
      [true, true, true, true],
      [
        "http://esempio.test/a",
        "x\nhttps://esempio.test/a?b=1#c\ny",
        "HTTPS://ESEMPIO.TEST",
        "https://esempio.test",
      ].map((s) => testo(s).preview_url),
    );
    c(
      "…non vale per chi nomina un dominio senza protocollo o scrive «http» e basta",
      [false, false, false],
      ["vedi hair-genius-hub.hair/media/abc", "il protocollo http è vecchio", "https:// vuoto"].map(
        (s) => testo(s).preview_url,
      ),
    );
    c(
      "un modello (template) non cambia: nessun testo, nessun preview_url",
      undefined,
      P.corpoGraph({ a: "+393331234567", modello: "ciao", parametri: ["https://x.it"] }).text,
    );
  }
}
