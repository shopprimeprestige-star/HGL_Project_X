/** ── PROVE: IL RIQUADRO E IL CAMBIO A MANO ───────────────────────
 *
 *  File d'area della commessa 2026-10-23 (ManyChat).
 *
 *  ⚠️ DUE COMPITI, UN FILE (PIANO §5, compiti 4 e 5):
 *   · compito 5 (Dev D): `proveVistaComponenti`, qui sotto. Prova le frasi e le
 *     scelte dei componenti (`src/crm/manychat/vista-pannello.ts`, puro). Il
 *     modulo non è in `MODULI` di `prove/prove.mjs` (che non si tocca): lo
 *     impacchetta questo file, con esbuild, in una cartella temporanea.
 *   · compito 4 (Dev B): le prove delle rotte (chiave rifiutata, tetti alzati,
 *     STOP a mano, …) vanno in `provePannello`, sotto la chiamata alla mia.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs` (chiave
 *  `"manychat/<nome>"`). `aiuti`: `{ c, gruppo, radice }`, gli stessi di
 *  `prove.mjs` (`c(nome, atteso, letto)`). */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSync } from "esbuild";
import { creaFinto, esiti, PERCORSI } from "./finto.mjs";

/** Impacchetta un modulo `.ts` puro in una cartella temporanea e lo carica. */
function carica(radice, relativo) {
  const dove = mkdtempSync(join(tmpdir(), "pannello-"));
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

const ADESSO = new Date("2026-10-23T13:00:00Z"); // 15:00 a Roma (ora legale)
const iso = (s) => new Date(s).toISOString();

/** Una scheda col secondo stato. */
const scheda = (id, contattoWa) => ({ id, data: { nome: id, contattoWa } });
const voce = (stato, il, da = "automatico", extra = {}) => ({ stato, il, da, ...extra });
const cw = (stato, il, extra = {}, storia) => ({
  stato,
  il,
  da: "automatico",
  ...extra,
  storia: storia ?? [
    voce(stato, il, extra.da ?? "automatico", extra.motivo ? { motivo: extra.motivo } : {}),
  ],
});

export async function proveVistaComponenti(aiuti) {
  const { c, gruppo, radice } = aiuti;
  gruppo("MANYCHAT · COMPONENTI (vista-pannello)");
  const V = carica(radice, "src/crm/manychat/vista-pannello.ts");

  // ── ore e giorni (sempre Roma) ────────────────────────────────────────
  c(
    "quandoBreve: ora legale (13:05Z → 15:05)",
    "23/10 15:05",
    V.quandoBreve("2026-10-23T13:05:00Z"),
  );
  c(
    "quandoBreve: ora solare (26/10, 14:09Z → 15:09)",
    "26/10 15:09",
    V.quandoBreve("2026-10-26T14:09:00Z"),
  );
  c("quandoBreve: data illeggibile → vuoto", "", V.quandoBreve("ieri"));
  c(
    "giornoBreve e oraBreve",
    ["23/10", "15:05"],
    [V.giornoBreve("2026-10-23T13:05:00Z"), V.oraBreve("2026-10-23T13:05:00Z")],
  );

  // ── errori in chiaro ──────────────────────────────────────────────────
  c("errore: il server non risponde (0)", V.FRASE_RETE, V.fraseErrore(0));
  c("errore 401: rientra", "Serve l'accesso al CRM: rientra e riprova.", V.fraseErrore(401, "boh"));
  c(
    "errore 403: vale la frase del server",
    "Solo il titolare.",
    V.fraseErrore(403, "Solo il titolare."),
  );
  c("errore 403 senza frase: ce n'è una nostra", true, /permesso/.test(V.fraseErrore(403)));
  c(
    "errore: una frase del server di 300 lettere non si mostra",
    "Non salvato.",
    V.fraseErrore(400, "x".repeat(300)),
  );
  c("errore 500: mai il corpo grezzo se manca", true, /problema/.test(V.fraseErrore(500)));

  // ── la pastiglia ──────────────────────────────────────────────────────
  const nessuno = V.vistaContatto({}, ADESSO);
  c(
    "senza secondo stato: «Non segnato», tono neutro",
    [null, "Non segnato", "neutro"],
    [nessuno.stato, nessuno.etichetta, nessuno.tono],
  );
  const tonoDi = (stato) =>
    V.vistaContatto({ contattoWa: cw(stato, iso("2026-10-23T08:00:00Z")) }, ADESSO).tono;
  c(
    "ogni stato ha etichetta e un tono del CRM (colore E parola)",
    [
      ["neutro", "Contattato"],
      ["da_lavorare", "In attesa"],
      ["vinta", "Ha risposto"],
      ["in_sospeso", "Non ha risposto"],
      ["in_sospeso", "Da ricontattare"],
      ["persa", "Non scrivere (STOP)"],
      ["persa", "Non raggiungibile"],
    ],
    [
      "contattato",
      "in_attesa",
      "ha_risposto",
      "non_ha_risposto",
      "da_ricontattare",
      "stop",
      "non_raggiungibile",
    ].map((s) => [
      tonoDi(s),
      V.vistaContatto({ contattoWa: cw(s, iso("2026-10-23T08:00:00Z")) }, ADESSO).etichetta,
    ]),
  );
  const scaduta = V.vistaContatto(
    {
      contattoWa: cw("in_attesa", iso("2026-10-22T10:00:00Z"), {
        scadeRisposta: iso("2026-10-23T10:00:00Z"),
        motivo: "ricontatto",
      }),
    },
    ADESSO,
  );
  c(
    "«In attesa» a scadenza passata si vede «Non ha risposto» (e lo dice)",
    ["non_ha_risposto", true],
    [scaduta.stato, scaduta.scaduta],
  );
  const attesa = V.vistaContatto(
    {
      contattoWa: cw("in_attesa", iso("2026-10-23T12:00:00Z"), {
        scadeRisposta: iso("2026-10-24T12:00:00Z"),
        motivo: "ricontatto",
      }),
    },
    ADESSO,
  );
  c(
    "«In attesa» dentro i tempi resta «In attesa»",
    ["in_attesa", false],
    [attesa.stato, attesa.scaduta],
  );

  // ── le scelte della finestra ──────────────────────────────────────────
  const scelte = (d, puo) => V.sceltePerContatto(d, ADESSO, puo);
  const tutte = scelte({}, false);
  c(
    "sette scelte, nell'ordine di STATI_CONTATTO",
    [
      "contattato",
      "in_attesa",
      "ha_risposto",
      "non_ha_risposto",
      "da_ricontattare",
      "stop",
      "non_raggiungibile",
    ],
    tutte.map((s) => s.stato),
  );
  c(
    "senza secondo stato: tutte abilitate, nessuna attuale",
    [7, 0],
    [tutte.filter((s) => s.abilitata).length, tutte.filter((s) => s.attuale).length],
  );
  c(
    "solo STOP chiede conferma (poi lo toglie solo il titolare)",
    ["stop"],
    tutte.filter((s) => s.chiedeConferma).map((s) => s.stato),
  );
  const inStop = { contattoWa: cw("stop", iso("2026-10-23T08:00:00Z"), { motivo: "stop" }) };
  const stopSenza = scelte(inStop, false);
  c(
    "in STOP senza «impostazioni»: tutte chiuse tranne STOP, con la frase",
    [1, true],
    [
      stopSenza.filter((s) => s.abilitata).length,
      stopSenza.filter((s) => !s.abilitata).every((s) => /impostazioni/.test(s.perche)),
    ],
  );
  const stopCon = scelte(inStop, true);
  c(
    "in STOP col permesso: tutte abilitate; STOP è l'attuale e non chiede conferma",
    [7, "stop", false],
    [
      stopCon.filter((s) => s.abilitata).length,
      stopCon.find((s) => s.attuale).stato,
      stopCon.find((s) => s.stato === "stop").chiedeConferma,
    ],
  );
  c(
    "fuori da STOP anche chi non ha il permesso può mettere STOP",
    true,
    scelte({ contattoWa: cw("contattato", iso("2026-10-23T08:00:00Z")) }, false).find(
      (s) => s.stato === "stop",
    ).abilitata,
  );

  // ── la storia ─────────────────────────────────────────────────────────
  c(
    "storia: invio del promemoria",
    "In attesa · promemoria automatico, 23/10 15:05",
    V.fraseVoceStoria(
      voce("in_attesa", "2026-10-23T13:05:00Z", "automatico", { motivo: "promemoria" }),
    ),
  );
  c(
    "storia: invio del ricontatto",
    "In attesa · ricontatto automatico, 23/10 15:05",
    V.fraseVoceStoria(
      voce("in_attesa", "2026-10-23T13:05:00Z", "automatico", { motivo: "ricontatto" }),
    ),
  );
  c(
    "storia: risposta con l'anteprima",
    "Ha risposto · 23/10 15:09 · “ok ci sono”",
    V.fraseVoceStoria(
      voce("ha_risposto", "2026-10-23T13:09:00Z", "automatico", { anteprima: "ok ci sono" }),
    ),
  );
  c(
    "storia: cambio a mano col nome",
    "Contattato · a mano da Mario, 23/10 15:05",
    V.fraseVoceStoria(voce("contattato", "2026-10-23T13:05:00Z", "Mario")),
  );
  c(
    "storia: STOP scritto dal cliente",
    "Non scrivere (STOP) · ha scritto STOP, 23/10 15:05",
    V.fraseVoceStoria(voce("stop", "2026-10-23T13:05:00Z", "automatico", { motivo: "stop" })),
  );
  c(
    "storia: numero non raggiungibile col motivo",
    "Non raggiungibile · numero non su WhatsApp, 23/10 15:05",
    V.fraseVoceStoria(
      voce("non_raggiungibile", "2026-10-23T13:05:00Z", "automatico", {
        motivo: "numero non su WhatsApp",
      }),
    ),
  );
  c(
    "storia: l'anteprima è testo semplice (nessun HTML interpretato qui)",
    "Ha risposto · 23/10 15:09 · “<b>ciao</b>”",
    V.fraseVoceStoria(
      voce("ha_risposto", "2026-10-23T13:09:00Z", "automatico", { anteprima: "<b>ciao</b>" }),
    ),
  );

  // ── «Ok a WhatsApp» ───────────────────────────────────────────────────
  c(
    "nuovoOkWhatsapp: chi, quando",
    { si: true, il: "2026-10-23T13:00:00.000Z", da: "Mario" },
    V.nuovoOkWhatsapp(true, "  Mario ", ADESSO),
  );
  c(
    "nuovoOkWhatsapp: senza nome → «sconosciuto» (come il secondo stato)",
    "sconosciuto",
    V.nuovoOkWhatsapp(true, "  ", ADESSO).da,
  );
  c(
    "Ok acceso: «Chiesto a voce da Mario, 23/10»",
    [true, "Chiesto a voce da Mario, 23/10"],
    (({ acceso, riga }) => [acceso, riga])(
      V.vistaOkWhatsapp({ si: true, il: "2026-10-23T13:00:00Z", da: "Mario" }),
    ),
  );
  c(
    "Ok tolto: si sa chi e quando",
    [false, "Tolto da Anna, 24/10"],
    (({ acceso, riga }) => [acceso, riga])(
      V.vistaOkWhatsapp({ si: false, il: "2026-10-24T09:00:00Z", da: "Anna" }),
    ),
  );
  const mai = V.vistaOkWhatsapp(undefined);
  c(
    "Ok mai chiesto: lo dice e spiega cosa non parte",
    [false, true],
    [mai.acceso, /non partono/.test(mai.riga)],
  );
  c(
    "Ok: consenso del modulo, interruttore comunque spento",
    [false, true, "Il cliente ha già dato il consenso nel modulo"],
    (({ acceso, dalModulo, riga }) => [acceso, dalModulo, riga])(
      V.vistaOkWhatsapp(null, { whatsapp: true }),
    ),
  );

  // ── «Oggi»: chi ha risposto e chi no al ricontatto automatico ─────────
  const ieri = "2026-10-22T09:00:00Z";
  const rispostaRic = scheda("Sara", {
    ...cw("ha_risposto", "2026-10-23T11:30:00Z", {}, [
      voce("ha_risposto", "2026-10-23T11:30:00Z", "automatico", {
        anteprima: "va bene, mi chiami",
      }),
      voce("in_attesa", ieri, "automatico", { motivo: "ricontatto" }),
    ]),
  });
  const rispostaPromemoria = scheda("Luca", {
    ...cw("ha_risposto", "2026-10-23T11:30:00Z", {}, [
      voce("ha_risposto", "2026-10-23T11:30:00Z", "automatico", { anteprima: "ok ci sono" }),
      voce("in_attesa", ieri, "automatico", { motivo: "promemoria" }),
    ]),
  });
  const rispostaTardiva = scheda("Gina", {
    ...cw("ha_risposto", "2026-10-23T12:00:00Z", {}, [
      voce("ha_risposto", "2026-10-23T12:00:00Z", "automatico"),
      voce("non_ha_risposto", "2026-10-23T09:00:00Z", "automatico", { motivo: "ricontatto" }),
      voce("in_attesa", ieri, "automatico", { motivo: "ricontatto" }),
    ]),
  });
  const rispostaAMano = scheda("Pino", {
    stato: "ha_risposto",
    il: "2026-10-23T11:30:00Z",
    da: "Mario",
    storia: [
      voce("ha_risposto", "2026-10-23T11:30:00Z", "Mario"),
      voce("in_attesa", ieri, "automatico", { motivo: "ricontatto" }),
    ],
  });
  const nessunaRisposta = scheda(
    "Rita",
    cw("in_attesa", "2026-10-22T10:00:00Z", {
      scadeRisposta: "2026-10-23T10:00:00Z",
      motivo: "ricontatto",
    }),
  );
  const nessunaRispostaScritta = scheda(
    "Elia",
    cw("non_ha_risposto", "2026-10-23T10:30:00Z", { motivo: "ricontatto" }),
  );
  const nessunaAMano = scheda("Dora", {
    stato: "non_ha_risposto",
    il: "2026-10-23T10:00:00Z",
    da: "Mario",
    storia: [],
  });
  const nessunaPromemoria = scheda(
    "Ugo",
    cw("in_attesa", "2026-10-22T10:00:00Z", {
      scadeRisposta: "2026-10-23T10:00:00Z",
      motivo: "promemoria",
    }),
  );
  const vecchia = scheda(
    "Olga",
    cw("non_ha_risposto", "2026-10-15T10:00:00Z", { motivo: "ricontatto" }),
  );
  const senza = scheda("Zeno", undefined);
  const r = V.righeRisposteOggi(
    [
      rispostaPromemoria,
      nessunaPromemoria,
      rispostaAMano,
      nessunaAMano,
      vecchia,
      senza,
      nessunaRisposta,
      rispostaRic,
      rispostaTardiva,
      nessunaRispostaScritta,
    ],
    ADESSO,
  );
  c(
    "«Hanno risposto»: solo al ricontatto automatico, dal più recente (anche la risposta tardiva)",
    ["Gina", "Sara"],
    r.risposto.map((x) => x.scheda.id),
  );
  c(
    "…con l'anteprima della risposta",
    ["va bene, mi chiami"],
    r.risposto.filter((x) => x.anteprima).map((x) => x.anteprima),
  );
  c(
    "«Non hanno risposto»: scaduta l'attesa o scritto dal giro, dal più recente; mai a mano, mai il promemoria, mai oltre 3 giorni",
    ["Elia", "Rita"],
    r.nonRisposto.map((x) => x.scheda.id),
  );
  c(
    "striscia vuota se non c'è nessuno",
    [[], []],
    ((v) => [v.risposto, v.nonRisposto])(V.righeRisposteOggi([senza], ADESSO)),
  );

  // ── il riquadro ───────────────────────────────────────────────────────
  const stato = (mod = {}) => ({
    adesso: ADESSO.toISOString(),
    migrazione: true,
    chiavePresente: true,
    segretoRitornoPresente: true,
    config: {
      canale: "manychat",
      acceso: true,
      promemoria: true,
      ricontatti: true,
      tetti: {},
      flussi: {},
      primaAccensione: "2026-09-01T08:00:00Z",
      ultimaAccensione: "2026-09-01T08:00:00Z",
      fermatoMotivo: null,
      ...(mod.config ?? {}),
    },
    giro: {
      ultimoGiroIl: "2026-10-23T12:58:00Z",
      ultimaRispostaIl: "2026-10-23T12:00:00Z",
      ultimoInvioIl: "2026-10-23T12:30:00Z",
      prossimoRicontattoDopo: "2026-10-23T13:30:00Z",
      oggi: { promemoria: 6, ricontatti: 9, risposte: 5 },
      problemi: [],
      ...(mod.giro ?? {}),
    },
    collegamento: null,
    ...(mod.radice ?? {}),
  });
  const riga = (mod) => V.rigaStatoRiquadro(stato(mod), ADESSO);
  c(
    "riga di stato: «Attivo · ultimo giro alle … · oggi … · prossimo ricontatto verso le …»",
    {
      tono: "verde",
      parola: "Attivo",
      frase:
        "Attivo · ultimo giro alle 14:58 · oggi 6 promemoria, 9 ricontatti, 5 risposte · prossimo ricontatto verso le 15:30",
    },
    riga(),
  );
  c(
    "riga: singolari («1 ricontatto», «1 risposta»)",
    true,
    /oggi 1 promemoria, 1 ricontatto, 1 risposta ·/.test(
      riga({ giro: { oggi: { promemoria: 1, ricontatti: 1, risposte: 1 } } }).frase,
    ),
  );
  c(
    "riga: ricontatti spenti → niente «prossimo ricontatto»",
    false,
    /prossimo/.test(riga({ config: { ricontatti: false } }).frase),
  );
  c(
    "riga: manca il database → rosso",
    ["rosso", "Manca l'aggiornamento del database: il giro non manda niente."],
    ((x) => [x.tono, x.frase])(riga({ radice: { migrazione: false } })),
  );
  c(
    "riga: manca la chiave → rosso",
    ["rosso", "Manca la chiave di ManyChat."],
    ((x) => [x.tono, x.frase])(riga({ radice: { chiavePresente: false } })),
  );
  c(
    "riga: fermato dal sistema → rosso col motivo",
    ["rosso", "Fermato: 2 invii falliti di fila"],
    ((x) => [x.tono, x.frase])(riga({ config: { fermatoMotivo: "2 invii falliti di fila" } })),
  );
  c(
    "riga: spento di serie → neutro, «nessun messaggio parte»",
    ["neutro", "Spento: nessun messaggio parte."],
    ((x) => [x.tono, x.frase])(riga({ config: { acceso: false } })),
  );
  c(
    "riga: acceso ma sotto-interruttori spenti → ambra",
    "ambra",
    riga({ config: { promemoria: false, ricontatti: false } }).tono,
  );
  c(
    "riga: tetto dei ricontatti raggiunto → ambra, slittano a domani",
    ["ambra", true],
    ((x) => [x.tono, /Tetto di oggi raggiunto: 20 ricontatti su 20.*domani/.test(x.frase)])(
      riga({ giro: { oggi: { promemoria: 0, ricontatti: 20, risposte: 0 } } }),
    ),
  );
  c(
    "riga: tetto abbassato nel riquadro vale",
    true,
    /su 5\./.test(
      riga({
        config: { tetti: { ricontatti: 5 } },
        giro: { oggi: { promemoria: 0, ricontatti: 5, risposte: 0 } },
      }).frase,
    ),
  );
  c(
    "riga: prima settimana, il 10° ricontatto chiude la giornata",
    true,
    /su 10\./.test(
      riga({
        config: { primaAccensione: "2026-10-20T08:00:00Z" },
        giro: { oggi: { promemoria: 0, ricontatti: 10, risposte: 0 } },
      }).frase,
    ),
  );
  c(
    "riga: tetto totale raggiunto",
    true,
    /40 messaggi su 40/.test(
      riga({
        config: { ricontatti: false },
        giro: { oggi: { promemoria: 40, ricontatti: 0, risposte: 0 } },
      }).frase,
    ),
  );
  c(
    "riga: nessuna risposta da 48 ore (si manda ma non torna niente) → ambra",
    ["ambra", "Nessuna risposta da ManyChat da 48 ore: controlla il flusso delle risposte."],
    ((x) => [x.tono, x.frase])(riga({ giro: { ultimaRispostaIl: "2026-10-20T12:00:00Z" } })),
  );
  c(
    "riga: nessuna risposta ma nessun invio recente → niente allarme",
    "verde",
    riga({ giro: { ultimaRispostaIl: null, ultimoInvioIl: "2026-10-19T12:00:00Z" } }).tono,
  );
  c(
    "riga: acceso da poco (< 48 ore) → niente allarme sulle risposte",
    "verde",
    riga({ config: { primaAccensione: "2026-10-22T20:00:00Z" }, giro: { ultimaRispostaIl: null } })
      .tono,
  );

  // ── l'allarme «nessun giro da 5 minuti» ───────────────────────────────
  const giroAlle = (hhmm) =>
    V.allarmeGiro({ ultimoGiroIl: `2026-10-23T${hhmm}:00Z` }, true, ADESSO);
  c("allarme: giro di 4 minuti fa → niente", null, giroAlle("12:56"));
  c("allarme: esattamente 5 minuti → niente", null, giroAlle("12:55"));
  c(
    "allarme: 6 minuti → rosso, con l'ora dell'ultimo giro",
    ["rosso", true],
    ((a) => [a.tono, /^Nessun giro da più di 5 minuti \(l'ultimo: 23\/10 14:54\)/.test(a.frase)])(
      giroAlle("12:54"),
    ),
  );
  c(
    "allarme: giro mai partito e interruttore acceso → rosso",
    "rosso",
    V.allarmeGiro({ ultimoGiroIl: null }, true, ADESSO).tono,
  );
  c(
    "allarme: giro mai partito e tutto spento → ambra (solo da sapere)",
    "ambra",
    V.allarmeGiro({ ultimoGiroIl: null }, false, ADESSO).tono,
  );

  // ── i tetti: si possono solo abbassare ────────────────────────────────
  c(
    "tetti effettivi: di serie 20 e 40",
    { ricontatti: 20, totale: 40, primaSettimana: false },
    V.tettiEffettivi({}, "2026-09-01T08:00:00Z", ADESSO),
  );
  c(
    "tetti effettivi: il riquadro a 500 vale le costanti",
    [20, 40],
    ((t) => [t.ricontatti, t.totale])(
      V.tettiEffettivi({ ricontatti: 500, totale: 900 }, "2026-09-01T08:00:00Z", ADESSO),
    ),
  );
  c(
    "tetti effettivi: abbassati",
    [5, 12],
    ((t) => [t.ricontatti, t.totale])(
      V.tettiEffettivi({ ricontatti: 5, totale: 12 }, "2026-09-01T08:00:00Z", ADESSO),
    ),
  );
  c(
    "tetti effettivi: prima settimana → 10 ricontatti",
    [10, true],
    ((t) => [t.ricontatti, t.primaSettimana])(V.tettiEffettivi({}, "2026-10-20T08:00:00Z", ADESSO)),
  );
  c(
    "tetti effettivi: dopo 7 giorni esatti la settimana è finita",
    [20, false],
    ((t) => [t.ricontatti, t.primaSettimana])(V.tettiEffettivi({}, "2026-10-16T13:00:00Z", ADESSO)),
  );
  c("tetto scritto: 12 su max 20 → ok", { ok: true, valore: 12 }, V.leggiTetto("12", 20));
  c(
    "tetto scritto: 21 su max 20 → no, «puoi solo abbassarlo»",
    [false, "Al massimo 20: puoi solo abbassarlo."],
    ((x) => [x.ok, x.errore])(V.leggiTetto("21", 20)),
  );
  c("tetto scritto: 0 → no", false, V.leggiTetto("0", 20).ok);
  c(
    "tetto scritto: «abc», «1,5», «-3», vuoto → no",
    [false, false, false, false],
    ["abc", "1,5", "-3", ""].map((t) => V.leggiTetto(t, 20).ok),
  );
  c(
    "tetto scritto: con gli spazi intorno si legge",
    { ok: true, valore: 20 },
    V.leggiTetto(" 20 ", 20),
  );

  // ── i flussi ──────────────────────────────────────────────────────────
  c(
    "flussi proposti: conferma, promemoria, ricontatto",
    ["consulenza_conferma_presenza", "hgl_promemoria_meet", "hgl_ricontatto_consulenza"],
    V.MODELLI_FLUSSO.map((m) => m.modello),
  );
  c(
    "ns: valido, tolto gli spazi ai bordi",
    { ok: true, valore: "content2026abc" },
    V.leggiNs("  content2026abc "),
  );
  c("ns: vuoto = toglie il flusso", { ok: true, valore: "" }, V.leggiNs(""));
  c("ns: con spazi in mezzo → no", false, V.leggiNs("content 2026").ok);
  c("ns: troppo lungo → no", false, V.leggiNs("a".repeat(121)).ok);

  // ── il «Collegamento ok» ──────────────────────────────────────────────
  //  Le righe obbligatorie sono UNA per id di V.ID_COLLEGAMENTO; due le scrive
  //  il browser (segreto e ultima risposta), le altre arrivano dal server.
  const CTX = { segretoRitornoPresente: true, ultimaRispostaIl: "2026-10-23T13:09:00Z" };
  const DAL_SERVER = V.ID_COLLEGAMENTO.filter(
    (id) => id !== "segreto_ritorno" && id !== "ultima_risposta",
  );
  const coll = (esiti = {}, senza = []) => ({
    controllatoIl: ADESSO.toISOString(),
    righe: DAL_SERVER.filter((id) => !senza.includes(id)).map((id) => ({
      id,
      esito: esiti[id] ?? "ok",
      testo: "x",
    })),
  });
  const titolo = (cc, ctx = CTX) => ((t) => [t.tono, t.titolo])(V.titoloCollegamento(cc, ctx));
  c(
    "collegamento: gli id obbligatori (chiave, Pro, un flusso per modello, campi, segreto, ultima risposta, creazione)",
    [
      "chiave",
      "is_pro",
      "flusso:consulenza_conferma_presenza",
      "flusso:hgl_promemoria_meet",
      "flusso:hgl_ricontatto_consulenza",
      "campi_crm",
      "segreto_ritorno",
      "ultima_risposta",
      "creazione_contatti",
    ],
    V.ID_COLLEGAMENTO,
  );
  c(
    "collegamento: mai controllato → neutro",
    ["neutro", "Collegamento non ancora controllato"],
    titolo(null),
  );
  c(
    "collegamento: mai controllato, ma l'ultima risposta e il segreto si vedono già",
    [
      ["segreto_ritorno", "ok", "Segreto del ritorno presente"],
      ["ultima_risposta", "ok", "Ultima risposta ricevuta: 23/10 15:09"],
    ],
    V.righeCollegamento(null, CTX).map((r) => [r.id, r.esito, r.testo]),
  );
  c(
    "collegamento: «ultima risposta» mai arrivata → «mai», da verificare",
    ["da_verificare", "Ultima risposta ricevuta: mai"],
    ((r) => [r.esito, r.testo])(
      V.righeCollegamento(null, { ...CTX, ultimaRispostaIl: null }).find(
        (x) => x.id === "ultima_risposta",
      ),
    ),
  );
  c(
    "collegamento: tutto ok e segreto presente → verde «Collegamento ok»",
    ["verde", "Collegamento ok"],
    titolo(coll()),
  );
  //  ⚠️ PROVA DEL REVISORE (1): il segreto del ritorno manca → mai verde, e lo
  //   dice, anche se il server manda tutte le sue righe «ok» (o dimentica quella).
  c(
    "collegamento: segreto del ritorno assente → NON verde (rosso, 1 problema)",
    ["rosso", "Collegamento: 1 problema"],
    titolo(coll(), { ...CTX, segretoRitornoPresente: false }),
  );
  c(
    "collegamento: segreto assente anche prima della prima prova → rosso",
    ["rosso", "Collegamento: 1 problema"],
    titolo(null, { ...CTX, segretoRitornoPresente: false }),
  );
  //  ⚠️ PROVA DEL REVISORE (2): il server dimentica una riga obbligatoria →
  //   quella riga è «da verificare» e il titolo non è verde.
  const senzaCampi = V.righeCollegamento(coll({}, ["campi_crm"]), CTX).find(
    (r) => r.id === "campi_crm",
  );
  c(
    "collegamento: riga obbligatoria mancante → «da verificare», con la frase",
    ["da_verificare", "Non controllato: i campi crm_* del contatto"],
    [senzaCampi.esito, senzaCampi.testo],
  );
  c(
    "collegamento: riga obbligatoria mancante → NON verde (ambra)",
    ["ambra", "Collegamento: 1 cosa da verificare"],
    titolo(coll({}, ["campi_crm"])),
  );
  c(
    "collegamento: manca un flusso → «Non controllato: il flusso …»",
    "Non controllato: il flusso «Promemoria 25 minuti prima del meet»",
    V.righeCollegamento(coll({}, ["flusso:hgl_promemoria_meet"]), CTX).find(
      (r) => r.id === "flusso:hgl_promemoria_meet",
    ).testo,
  );
  c(
    "collegamento: le righe del server non possono dire «ok» per il segreto",
    "errore",
    V.righeCollegamento(
      {
        controllatoIl: ADESSO.toISOString(),
        righe: [{ id: "segreto_ritorno", esito: "ok", testo: "x" }],
      },
      { ...CTX, segretoRitornoPresente: false },
    ).find((r) => r.id === "segreto_ritorno").esito,
  );
  c(
    "collegamento: un problema basta → rosso",
    ["rosso", "Collegamento: 1 problema"],
    titolo(coll({ is_pro: "errore", creazione_contatti: "da_verificare" })),
  );
  c(
    "collegamento: due problemi → plurale",
    "Collegamento: 2 problemi",
    titolo(coll({ is_pro: "errore", chiave: "errore" }))[1],
  );
  c(
    "collegamento: solo «da verificare» → ambra, mai «ok»",
    ["ambra", "Collegamento: 1 cosa da verificare"],
    titolo(coll({ creazione_contatti: "da_verificare" })),
  );
  c(
    "collegamento: una riga in più del server si mostra in coda",
    "extra",
    V.righeCollegamento(
      {
        controllatoIl: ADESSO.toISOString(),
        righe: [...coll().righe, { id: "extra", esito: "ok", testo: "y" }],
      },
      CTX,
    ).at(-1).id,
  );
  c(
    "collegamento: ogni esito ha la sua parola",
    ["ok", "problema", "da verificare"],
    [V.PAROLA_ESITO.ok, V.PAROLA_ESITO.errore, V.PAROLA_ESITO.da_verificare],
  );

  // ── i problemi del giro ───────────────────────────────────────────────
  const problemi = Array.from({ length: 25 }, (_, i) => ({
    il: new Date(Date.parse("2026-10-23T08:00:00Z") + i * 60_000).toISOString(),
    nome: `Mario R.${i}`,
    tipo: "ricontatto",
    motivo: "manca il consenso WhatsApp",
  }));
  const rp = V.righeProblemi({ problemi });
  c(
    "problemi: al massimo 20, il più recente in cima",
    [20, "Mario R.24 · ricontatto · manca il consenso WhatsApp"],
    [rp.length, rp[0].testo],
  );
  c(
    "problemi: nessun numero di telefono nelle righe",
    false,
    rp.some((x) => /\d{8,}/.test(x.testo)),
  );
  c("problemi: senza problemi, elenco vuoto", [], V.righeProblemi({ problemi: [] }));
}

export async function provePannello(mod, aiuti) {
  await proveVistaComponenti(aiuti);
  await proveMontaggio(mod, aiuti);
  await proveRotte(mod, aiuti);
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  COMPITO 4 (Dev B): LE ROTTE DEL RIQUADRO E DEL CAMBIO A MANO
 *
 *  La logica sta in `src/crm/manychat/pannello.ts` (pura, porte iniettate); le
 *  rotte `api.crm.manychat.ts` e `api.crm.contatto-wa.ts` e il collegamento al
 *  database (`pannello.server.ts`) sono sottili. Qui si prova la logica con un
 *  ManyChat finto che registra ogni chiamata, e le rotte si leggono come testo
 *  (le guardie). Dati tutti inventati.
 * ═══════════════════════════════════════════════════════════════════════════ */
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const LEAD = "33333333-3333-4333-8333-333333333333";
const MIN = 60_000;

async function proveRotte(mod, { c, gruppo, radice }) {
  const P = carica(radice, "src/crm/manychat/pannello.ts");
  const A = mod["manychat/api"];
  const nuovoClient = (f) => A.creaClient({ chiave: "chiave-finta", fetch: f.fetch });
  const letto = (relativo) => readFileSync(join(radice, relativo), "utf8");

  /* ── la configurazione e i comandi ─────────────────────────────────────── */
  gruppo("MANYCHAT · RIQUADRO · CONFIGURAZIONE (pannello.ts)");

  const vuota = P.configDaRiga(null);
  c(
    "senza riga: canale cloud, tutto spento, niente fermo",
    ["cloud", false, false, false, {}, {}, null, null, null],
    [
      vuota.canale,
      vuota.acceso,
      vuota.promemoria,
      vuota.ricontatti,
      vuota.tetti,
      vuota.flussi,
      vuota.primaAccensione,
      vuota.ultimaAccensione,
      vuota.fermatoMotivo,
    ],
  );
  const riga = (extra = {}) => ({
    user_id: UUID_A,
    canale: "manychat",
    acceso: false,
    promemoria: false,
    ricontatti: false,
    tetti: {},
    flussi: {},
    prima_accensione: null,
    ultima_accensione: null,
    fermato_motivo: null,
    controlli: null,
    ...extra,
  });
  const dalDb = P.configDaRiga(
    riga({
      canale: "boh",
      acceso: true,
      tetti: { ricontatti: 500, totale: "tanti", altro: 3 },
      flussi: { a: " ns-a ", b: "", c: 7 },
    }),
  );
  c(
    "dal database: canale strano → cloud; tetti e flussi ripuliti (mai sopra le costanti)",
    ["cloud", true, { ricontatti: 20 }, { a: "ns-a" }],
    [dalDb.canale, dalDb.acceso, dalDb.tetti, dalDb.flussi],
  );

  // ── leggere un comando ────────────────────────────────────────────────
  const ok = (body) => P.leggiComando(body);
  c(
    "comando: un interruttore alla volta, solo booleani",
    [true, false, false],
    [
      ok({ interruttori: { acceso: true } }).ok,
      ok({ interruttori: { acceso: "si" } }).ok,
      ok({ interruttori: {} }).ok,
    ],
  );
  c(
    "comando: due comandi insieme → rifiutato (ne accetta uno per volta)",
    false,
    ok({ canale: "cloud", tetti: { totale: 3 } }).ok,
  );
  c(
    "comando: corpo non oggetto o vuoto → rifiutato",
    [false, false, false, false],
    [ok(null).ok, ok("ciao").ok, ok([]).ok, ok({}).ok],
  );
  c(
    "comando: canale solo cloud o manychat",
    [true, true, false],
    [ok({ canale: "cloud" }).ok, ok({ canale: "manychat" }).ok, ok({ canale: "baileys" }).ok],
  );
  c(
    "comando: tetti interi da 1; zero, negativi, decimali, testo → rifiutati",
    [true, false, false, false, false, false],
    [
      ok({ tetti: { ricontatti: 5 } }).ok,
      ok({ tetti: { ricontatti: 0 } }).ok,
      ok({ tetti: { ricontatti: -2 } }).ok,
      ok({ tetti: { totale: 2.5 } }).ok,
      ok({ tetti: { totale: "10" } }).ok,
      ok({ tetti: {} }).ok,
    ],
  );
  c(
    "comando: flusso con identificativo vero, vuoto (lo toglie), o con spazi/caratteri strani (rifiutato)",
    [true, true, false, false, false, false],
    [
      ok({ flussi: { hgl_promemoria_meet: "content20261001_123" } }).ok,
      ok({ flussi: { hgl_promemoria_meet: "" } }).ok,
      ok({ flussi: { hgl_promemoria_meet: "content 1" } }).ok,
      ok({ flussi: { hgl_promemoria_meet: "x".repeat(121) } }).ok,
      ok({ flussi: { "nome strano!": "ns" } }).ok,
      ok({ flussi: { a: 5 } }).ok,
    ],
  );
  c(
    "comando: le azioni note (e il telefono della prova di creazione è obbligatorio)",
    [true, true, true, false, false],
    [
      ok({ azione: "prova_a_secco" }).ok,
      ok({ azione: "prova_collegamento" }).ok,
      ok({ azione: "prova_creazione_contatto", telefono: "+39 333 000 0001" }).ok,
      ok({ azione: "prova_creazione_contatto" }).ok,
      ok({ azione: "manda_tutto" }).ok,
    ],
  );

  // ── cosa si scrive ────────────────────────────────────────────────────
  const T0 = new Date("2026-10-23T08:00:00.000Z");
  const cfg = (body, prima = null, adesso = T0) =>
    P.patchDaComando(prima, ok(body).comando, adesso);
  const acc = cfg({ interruttori: { acceso: true } });
  c(
    "prima accensione: scrive prima e ultima accensione, toglie il fermo",
    [T0.toISOString(), T0.toISOString(), true, null],
    [acc.prima_accensione, acc.ultima_accensione, acc.acceso, acc.fermato_motivo],
  );
  const già = cfg(
    { interruttori: { acceso: true } },
    riga({
      acceso: true,
      prima_accensione: "2026-10-01T08:00:00Z",
      ultima_accensione: "2026-10-10T08:00:00Z",
    }),
  );
  c("già acceso: riaccendere non scrive niente (non sposta le date)", {}, già);
  const riacc = cfg(
    { interruttori: { acceso: true } },
    riga({
      acceso: false,
      prima_accensione: "2026-10-01T08:00:00Z",
      ultima_accensione: "2026-10-10T08:00:00Z",
      fermato_motivo: "2 invii falliti di fila",
    }),
  );
  c(
    "riaccendere dopo un fermo: la prima accensione NON si sposta (la settimana a 10 non riparte), l'ultima sì, il fermo sparisce",
    ["2026-10-01T08:00:00Z", T0.toISOString(), null],
    [
      riacc.prima_accensione ?? "2026-10-01T08:00:00Z",
      riacc.ultima_accensione,
      riacc.fermato_motivo,
    ],
  );
  c("…la prima accensione non è nemmeno nella scrittura", false, "prima_accensione" in riacc);
  const spegni = cfg({ interruttori: { acceso: false } }, riga({ acceso: true }));
  c("spegnere: solo il booleano", { acceso: false }, spegni);
  const ricOn = cfg({ interruttori: { ricontatti: true } }, riga({ acceso: true }));
  c(
    "accendere i ricontatti: ultima accensione (le date passate non partono) e prima accensione",
    [true, T0.toISOString(), T0.toISOString()],
    [ricOn.ricontatti, ricOn.ultima_accensione, ricOn.prima_accensione],
  );
  const memOn = cfg(
    { interruttori: { promemoria: true } },
    riga({ acceso: true, ultima_accensione: "2026-10-10T08:00:00Z" }),
  );
  c(
    "accendere il promemoria NON sposta l'ultima accensione dei ricontatti",
    [true, false],
    [memOn.promemoria, "ultima_accensione" in memOn],
  );

  c(
    "tetti alzati a 500 → riportati alle costanti 20 e 40",
    { ricontatti: 20, totale: 40 },
    cfg({ tetti: { ricontatti: 500, totale: 500 } }).tetti,
  );
  c(
    "tetti abbassati: valgono; l'altro resta com'era",
    { ricontatti: 4, totale: 30 },
    cfg({ tetti: { ricontatti: 4 } }, riga({ tetti: { totale: 30 } })).tetti,
  );
  c(
    "flussi: si fondono con quelli che c'erano; il vuoto toglie",
    { consulenza_conferma_presenza: "ns-conf", hgl_ricontatto_consulenza: "ns-ric" },
    cfg(
      { flussi: { hgl_promemoria_meet: "", hgl_ricontatto_consulenza: "ns-ric" } },
      riga({
        flussi: { consulenza_conferma_presenza: "ns-conf", hgl_promemoria_meet: "ns-vecchio" },
      }),
    ).flussi,
  );
  c("canale: si scrive il canale e basta", { canale: "cloud" }, cfg({ canale: "cloud" }));

  /* ── lo stato per il riquadro ──────────────────────────────────────────── */
  gruppo("MANYCHAT · RIQUADRO · STATO (pannello.ts)");
  const adesso = new Date("2026-10-23T13:00:00.000Z"); // 15:00 a Roma
  const inv = (extra) => ({
    lead_id: LEAD,
    tipo: "ricontatto",
    stato: "inviato",
    motivo: null,
    prenotato_il: "2026-10-23T09:00:00.000Z",
    risposta_il: null,
    ...extra,
  });
  const base = {
    migrazione: true,
    chiave: true,
    segreto: true,
    config: riga({ acceso: true, ricontatti: true, prima_accensione: "2026-10-20T08:00:00Z" }),
    giro: {
      ultimo_giro_il: "2026-10-23T12:59:00.000Z",
      ultima_risposta_il: "2026-10-23T11:00:00.000Z",
      prossimo_ricontatto_dopo: "2026-10-23T13:20:00.000Z",
      stato: {},
    },
    invii: [],
    problemi: [],
    ultimoInvioIl: "2026-10-23T12:00:00.000Z",
    nomi: { [LEAD]: { nome: "Mario", cognome: "Rossi" } },
  };
  const s0 = P.costruisciStato(base, adesso);
  c(
    "stato: ora del server, ambiente, giro",
    [
      adesso.toISOString(),
      true,
      true,
      true,
      "2026-10-23T12:59:00.000Z",
      "2026-10-23T11:00:00.000Z",
      "2026-10-23T12:00:00.000Z",
      "2026-10-23T13:20:00.000Z",
    ],
    [
      s0.adesso,
      s0.migrazione,
      s0.chiavePresente,
      s0.segretoRitornoPresente,
      s0.giro.ultimoGiroIl,
      s0.giro.ultimaRispostaIl,
      s0.giro.ultimoInvioIl,
      s0.giro.prossimoRicontattoDopo,
    ],
  );
  c(
    "stato: senza chiave né segreto lo dice, e non inventa un collegamento",
    [false, false, null],
    ((s) => [s.chiavePresente, s.segretoRitornoPresente, s.collegamento])(
      P.costruisciStato({ ...base, chiave: false, segreto: false }, adesso),
    ),
  );
  c(
    "stato: senza la migrazione → migrazione falsa, config di serie",
    [false, "cloud", false],
    ((s) => [s.migrazione, s.config.canale, s.config.acceso])(
      P.costruisciStato({ ...base, migrazione: false, config: null, giro: null }, adesso),
    ),
  );
  const giornata = [
    inv({ tipo: "promemoria", prenotato_il: "2026-10-23T07:30:00.000Z" }),
    inv({ tipo: "promemoria", stato: "incerto", prenotato_il: "2026-10-23T08:30:00.000Z" }),
    inv({ tipo: "promemoria", stato: "fallito", prenotato_il: "2026-10-23T08:40:00.000Z" }),
    inv({ tipo: "ricontatto", risposta_il: "2026-10-23T10:00:00.000Z" }),
    inv({ tipo: "ricontatto", prenotato_il: "2026-10-23T10:30:00.000Z", risposta_il: null }),
    inv({ tipo: "conferma", prenotato_il: "2026-10-23T10:31:00.000Z" }),
    // ieri sera a Roma (22:30 del 22/10 = 20:30Z) e a cavallo della mezzanotte
    inv({ tipo: "ricontatto", prenotato_il: "2026-10-22T20:30:00.000Z" }),
    // 00:10 del 23/10 a Roma = 22:10Z del 22/10: è già OGGI per Roma
    inv({ tipo: "promemoria", prenotato_il: "2026-10-22T22:10:00.000Z" }),
  ];
  const sg = P.costruisciStato({ ...base, invii: giornata }, adesso);
  c(
    "oggi (giorno di Roma): promemoria e ricontatti partiti (non i falliti, non la conferma), risposte ricevute",
    { promemoria: 3, ricontatti: 2, risposte: 1 },
    sg.giro.oggi,
  );

  const rotti = [
    inv({ stato: "fallito", motivo: "rifiuto_contatto", prenotato_il: "2026-10-23T09:00:00.000Z" }),
    inv({
      stato: "incerto",
      motivo: "prenotato_scaduto",
      prenotato_il: "2026-10-23T10:00:00.000Z",
    }),
    inv({
      lead_id: null,
      tipo: "conferma",
      stato: "saltato",
      motivo: "chiamami al 333 1234567 o 3331234567",
      prenotato_il: "2026-10-23T11:00:00.000Z",
    }),
  ];
  const sp = P.costruisciStato({ ...base, problemi: rotti }, adesso).giro.problemi;
  c(
    "problemi: il più recente in cima, nome abbreviato («Mario R.»), «Contatto» se la scheda non c'è",
    ["Contatto", "Mario R.", "Mario R."],
    sp.map((x) => x.nome),
  );
  c(
    "problemi: nessuna sequenza di sei o più cifre (un motivo non porta mai un telefono)",
    false,
    sp.some((x) => /\d{6,}/.test(x.motivo)),
  );
  c(
    "problemi: un codice del registro diventa una frase",
    true,
    sp.some((x) => /interrott|incerto/i.test(x.motivo)),
  );
  const molti = Array.from({ length: 30 }, (_, i) =>
    inv({
      stato: "fallito",
      motivo: "x",
      prenotato_il: new Date(Date.parse("2026-10-23T06:00:00Z") + i * MIN).toISOString(),
    }),
  );
  c(
    "problemi: al massimo 20",
    20,
    P.costruisciStato({ ...base, problemi: molti }, adesso).giro.problemi.length,
  );
  const dalGiro = P.costruisciStato(
    {
      ...base,
      giro: {
        ...base.giro,
        stato: {
          problemi: [
            {
              il: "2026-10-23T12:00:00.000Z",
              nome: "Anna Bianchi 3331234567",
              tipo: "ricontatto",
              motivo: "manca il consenso WhatsApp",
            },
            { il: "boh", nome: 5, tipo: "x" },
          ],
        },
      },
    },
    adesso,
  ).giro.problemi;
  c(
    "problemi: quelli che scrive il giro in `stato.problemi` si mostrano (il numero tolto, le righe rotte scartate)",
    [1, "manca il consenso WhatsApp", false],
    [dalGiro.length, dalGiro[0]?.motivo, /\d{6,}/.test(dalGiro[0]?.nome ?? "")],
  );
  c(
    "abbreviaNome: «Mario R.», solo nome, nessun nome",
    ["Mario R.", "Mario", "Contatto", "Anna D."],
    [
      P.abbreviaNome("Mario", "Rossi"),
      P.abbreviaNome("Mario", ""),
      P.abbreviaNome("", ""),
      P.abbreviaNome("Anna", "de Maria"),
    ],
  );

  const salvato = {
    controllatoIl: "2026-10-23T12:00:00.000Z",
    righe: [{ id: "chiave", esito: "ok", testo: "ok" }],
  };
  const conCreazione = P.costruisciStato(
    {
      ...base,
      config: riga({
        controlli: {
          collegamento: salvato,
          creazione: { esito: "ok", il: "2026-10-23T12:05:00.000Z" },
        },
      }),
    },
    adesso,
  ).collegamento;
  c(
    "l'ultimo collegamento salvato si riporta (senza chiamare nessuno) con la riga della creazione aggiornata",
    ["2026-10-23T12:00:00.000Z", ["chiave", "creazione_contatti"], "ok"],
    [
      conCreazione?.controllatoIl,
      conCreazione?.righe.map((r) => r.id),
      conCreazione?.righe[1].esito,
    ],
  );

  /* ── LA PROVA DI COLLEGAMENTO ──────────────────────────────────────────── */
  gruppo("MANYCHAT · RIQUADRO · PROVA DI COLLEGAMENTO");
  const CAMPI_TUTTI = [
    "crm_v1",
    "crm_v2",
    "crm_v3",
    "crm_v4",
    "crm_invio_id",
    "crm_lead_id",
    "crm_telefono",
    "crm_nome",
    "crm_ora_meet",
    "crm_link_meet",
    "crm_consulente",
  ];
  const FLUSSI_TUTTI = [
    { ns: "ns-conf", name: "CRM · Conferma consulenza" },
    { ns: "ns-mem", name: "CRM · Promemoria meet" },
    { ns: "ns-ric", name: "CRM · Ricontatto" },
  ];
  const FLUSSI_CONF = {
    consulenza_conferma_presenza: "ns-conf",
    hgl_promemoria_meet: "ns-mem",
    hgl_ricontatto_consulenza: "ns-ric",
  };
  const ingresso = (extra = {}) => ({
    canale: "manychat",
    interruttori: { promemoria: true, ricontatti: true },
    flussi: FLUSSI_CONF,
    creazione: { esito: "ok", il: "2026-10-23T12:05:00.000Z" },
    adesso,
    ...extra,
  });
  const sano = () =>
    creaFinto()
      .su("GET", PERCORSI.flussi, esiti.successo({ flows: FLUSSI_TUTTI }))
      .su(
        "GET",
        PERCORSI.campi,
        esiti.successo(CAMPI_TUTTI.map((name) => ({ name, id: 1, type: "text" }))),
      );
  const righeDi = (r) => Object.fromEntries(r.righe.map((x) => [x.id, x.esito]));
  const nessunInvio = (f) =>
    f.chiamate.every(
      (x) =>
        x.metodo === "GET" ||
        ![
          PERCORSI.flusso,
          PERCORSI.testo,
          PERCORSI.scriviCampi,
          PERCORSI.tag,
          PERCORSI.crea,
        ].includes(x.percorso),
    );

  const f1 = sano();
  const col1 = await P.statoCollegamento(nuovoClient(f1), ingresso());
  c(
    "tutto a posto: ogni riga ok",
    true,
    col1.righe.length > 5 && col1.righe.every((r) => r.esito === "ok"),
  );
  c(
    "tutto a posto: l'ora del controllo è quella data; solo letture (nessun sendFlow, nessun campo scritto)",
    [adesso.toISOString(), true],
    [col1.controllatoIl, nessunInvio(f1)],
  );
  c(
    "…ci sono le righe obbligatorie del server, con gli id del contratto (chiave, is_pro, un flusso per modello, campi_crm, creazione_contatti)",
    [
      "chiave",
      "is_pro",
      "flusso:consulenza_conferma_presenza",
      "flusso:hgl_promemoria_meet",
      "flusso:hgl_ricontatto_consulenza",
      "campi_crm",
      "creazione_contatti",
    ],
    col1.righe.map((r) => r.id),
  );
  c(
    "…ogni riga ha una frase in chiaro, mai l'identificativo grezzo né la chiave",
    false,
    col1.righe.some((r) => !r.testo || /chiave-finta|Bearer/.test(r.testo)),
  );

  const fSenza = sano();
  const colSenza = await P.statoCollegamento(null, ingresso());
  c(
    "nessuna chiave: riga rossa «chiave», le altre righe del server ci sono lo stesso («da verificare»)",
    ["errore", "da_verificare", "da_verificare", "da_verificare"],
    [
      righeDi(colSenza).chiave,
      righeDi(colSenza).is_pro,
      righeDi(colSenza).campi_crm,
      righeDi(colSenza)["flusso:hgl_promemoria_meet"],
    ],
  );
  c("…nessuna chiamata a ManyChat", 0, fSenza.chiamate.length);

  const f401 = sano().su("GET", PERCORSI.info, esiti.nonAutorizzato());
  const col401 = await P.statoCollegamento(nuovoClient(f401), ingresso());
  c(
    "chiave rifiutata: riga rossa, si ferma lì (nessun'altra chiamata) e niente invii",
    ["errore", 1, true],
    [righeDi(col401).chiave, f401.chiamate.length, nessunInvio(f401)],
  );
  const fRete = sano().su("GET", PERCORSI.info, esiti.reteGiu());
  c(
    "ManyChat non risponde: «da verificare», non un falso errore",
    "da_verificare",
    righeDi(await P.statoCollegamento(nuovoClient(fRete), ingresso())).chiave,
  );

  const fNoPro = sano().su("GET", PERCORSI.info, esiti.successo({ is_pro: false }));
  const colNoPro = await P.statoCollegamento(nuovoClient(fNoPro), ingresso());
  c(
    "is_pro falso: riga rossa «Pro», la chiave resta ok",
    ["ok", "errore", true],
    [righeDi(colNoPro).chiave, righeDi(colNoPro).is_pro, nessunInvio(fNoPro)],
  );

  const fFlusso = sano().su(
    "GET",
    PERCORSI.flussi,
    esiti.successo({ flows: FLUSSI_TUTTI.filter((x) => x.ns !== "ns-mem") }),
  );
  const colFlusso = await P.statoCollegamento(nuovoClient(fFlusso), ingresso());
  c(
    "flusso che non esiste in ManyChat: riga rossa solo per quello",
    ["errore", "ok", "ok"],
    [
      righeDi(colFlusso)["flusso:hgl_promemoria_meet"],
      righeDi(colFlusso)["flusso:consulenza_conferma_presenza"],
      righeDi(colFlusso)["flusso:hgl_ricontatto_consulenza"],
    ],
  );
  c("…e nessun invio", true, nessunInvio(fFlusso));

  const colNonCollegato = await P.statoCollegamento(
    nuovoClient(sano()),
    ingresso({ flussi: { consulenza_conferma_presenza: "ns-conf" } }),
  );
  c(
    "flusso non ancora scelto: rosso se il suo interruttore è acceso, «da verificare» se è spento",
    ["errore", "errore"],
    [
      righeDi(colNonCollegato)["flusso:hgl_promemoria_meet"],
      righeDi(colNonCollegato)["flusso:hgl_ricontatto_consulenza"],
    ],
  );
  const colSpento = await P.statoCollegamento(
    nuovoClient(sano()),
    ingresso({
      flussi: { consulenza_conferma_presenza: "ns-conf" },
      interruttori: { promemoria: false, ricontatti: false },
    }),
  );
  c(
    "…interruttori spenti: «da verificare»",
    ["da_verificare", "da_verificare"],
    [
      righeDi(colSpento)["flusso:hgl_promemoria_meet"],
      righeDi(colSpento)["flusso:hgl_ricontatto_consulenza"],
    ],
  );
  const colCloud = await P.statoCollegamento(
    nuovoClient(sano()),
    ingresso({ canale: "cloud", flussi: {} }),
  );
  c(
    "canale cloud e conferma senza flusso: non è un errore (la conferma passa dalla Cloud API)",
    "da_verificare",
    righeDi(colCloud)["flusso:consulenza_conferma_presenza"],
  );
  const colManychatSenzaConferma = await P.statoCollegamento(
    nuovoClient(sano()),
    ingresso({ flussi: { hgl_promemoria_meet: "ns-mem", hgl_ricontatto_consulenza: "ns-ric" } }),
  );
  c(
    "canale ManyChat e conferma senza flusso: rosso (la conferma già in produzione si fermerebbe)",
    "errore",
    righeDi(colManychatSenzaConferma)["flusso:consulenza_conferma_presenza"],
  );

  const fCampo = sano().su(
    "GET",
    PERCORSI.campi,
    esiti.successo(
      CAMPI_TUTTI.filter((n) => n !== "crm_invio_id").map((name) => ({ name, id: 1 })),
    ),
  );
  const colCampo = await P.statoCollegamento(nuovoClient(fCampo), ingresso());
  c(
    "campo crm_* mancante: riga rossa che lo nomina",
    ["errore", true],
    [
      righeDi(colCampo).campi_crm,
      /crm_invio_id/.test(colCampo.righe.find((r) => r.id === "campi_crm").testo),
    ],
  );
  c("…e nessun invio", true, nessunInvio(fCampo));

  const colCreazione = async (creazione) =>
    righeDi(await P.statoCollegamento(nuovoClient(sano()), ingresso({ creazione })))
      .creazione_contatti;
  c(
    "creazione contatti: mai provata «da verificare», riuscita «ok», negata rossa",
    ["da_verificare", "ok", "errore"],
    [
      await colCreazione(null),
      await colCreazione({ esito: "ok", il: "2026-10-23T12:05:00.000Z" }),
      await colCreazione({ esito: "negata", il: "2026-10-23T12:05:00.000Z" }),
    ],
  );

  // ── il contratto con il browser: ogni riga obbligatoria, in ogni caso ──
  const Vc = carica(radice, "src/crm/manychat/vista-pannello.ts");
  const obbligatorieDelServer = Vc.ID_COLLEGAMENTO.filter(
    (id) => id !== "segreto_ritorno" && id !== "ultima_risposta",
  );
  const casi = {
    "tutto a posto": await P.statoCollegamento(nuovoClient(sano()), ingresso()),
    "nessuna chiave": colSenza,
    "chiave rifiutata": col401,
    "ManyChat non risponde": await P.statoCollegamento(nuovoClient(fRete), ingresso()),
    "flussi illeggibili": await P.statoCollegamento(
      nuovoClient(sano().su("GET", PERCORSI.flussi, esiti.errore500())),
      ingresso(),
    ),
    "campi illeggibili": await P.statoCollegamento(
      nuovoClient(sano().su("GET", PERCORSI.campi, esiti.errore500())),
      ingresso(),
    ),
  };
  for (const [nome, col] of Object.entries(casi)) {
    const ids = col.righe.map((r) => r.id);
    c(
      `contratto, «${nome}»: ci sono tutti gli id obbligatori del server, una volta sola`,
      [[], []],
      [
        obbligatorieDelServer.filter((id) => !ids.includes(id)),
        ids.filter((id, k) => ids.indexOf(id) !== k),
      ],
    );
  }
  c(
    "…e il server NON manda le due righe che compone il browser (segreto_ritorno, ultima_risposta)",
    false,
    Object.values(casi).some((col) =>
      col.righe.some((r) => r.id === "segreto_ritorno" || r.id === "ultima_risposta"),
    ),
  );
  c(
    "…con quelle del server il browser mostra «Collegamento ok» solo se tutto è ok",
    ["verde", "rosso"],
    [
      Vc.titoloCollegamento(casi["tutto a posto"], {
        segretoRitornoPresente: true,
        ultimaRispostaIl: "2026-10-23T11:00:00.000Z",
      }).tono,
      Vc.titoloCollegamento(casi["tutto a posto"], {
        segretoRitornoPresente: false,
        ultimaRispostaIl: "2026-10-23T11:00:00.000Z",
      }).tono,
    ],
  );
  for (const [nome, d] of Object.entries({
    "segreto presente": { ...base, segreto: true },
    "segreto assente": { ...base, segreto: false },
    "senza migrazione": { ...base, migrazione: false, config: null, giro: null },
  })) {
    c(
      `stato, «${nome}»: segretoRitornoPresente è sempre un booleano`,
      "boolean",
      typeof P.costruisciStato(d, adesso).segretoRitornoPresente,
    );
  }

  /* ── LA PROVA CREAZIONE CONTATTO ───────────────────────────────────────── */
  gruppo("MANYCHAT · RIQUADRO · PROVA CREAZIONE CONTATTO");
  const NUM = "+39 333 000 0001";
  const soloQuesti = (f, percorsi) =>
    f.chiamate.every((x) => percorsi.some((p) => p === `${x.metodo} ${x.percorso}`));
  const LEGGE_E_CREA = [
    `GET ${PERCORSI.campi}`,
    `GET ${PERCORSI.perCampo}`,
    `GET ${PERCORSI.perSistema}`,
    `POST ${PERCORSI.crea}`,
  ];

  const fNuovo = creaFinto().scenario("assente");
  const crea = await P.provaCreazione(nuovoClient(fNuovo), NUM);
  const post = fNuovo.chiamate.filter((x) => x.metodo === "POST");
  c(
    "contatto assente: lo crea (un solo POST: createSubscriber) col solo nome «Prova» e il numero in forma internazionale",
    [200, "ok", 1, PERCORSI.crea, "Prova", "+393330000001", false],
    [
      crea.stato,
      crea.risposta?.esito,
      post.length,
      post[0]?.percorso,
      post[0]?.corpo?.first_name,
      post[0]?.corpo?.whatsapp_phone,
      "last_name" in (post[0]?.corpo ?? {}),
    ],
  );
  c(
    "…la creazione riuscita si registra («ok»); nessun messaggio, nessun campo scritto",
    ["ok", true],
    [crea.registra, soloQuesti(fNuovo, LEGGE_E_CREA)],
  );
  c(
    "…la risposta non riporta il numero intero",
    false,
    /393330000001|333 000 0001|3330000001/.test(JSON.stringify(crea.risposta)),
  );

  const fEsiste = creaFinto();
  const esiste = await P.provaCreazione(nuovoClient(fEsiste), NUM);
  c(
    "contatto già in ManyChat: non ne crea un altro (nessun POST) e non conta come «creazione provata»",
    [200, "ok", 0, null],
    [
      esiste.stato,
      esiste.risposta?.esito,
      fEsiste.chiamate.filter((x) => x.metodo === "POST").length,
      esiste.registra,
    ],
  );

  const fNega = creaFinto()
    .scenario("assente")
    .su("POST", PERCORSI.crea, esiti.errore(400, "permesso negato"));
  const nega = await P.provaCreazione(nuovoClient(fNega), NUM);
  c(
    "creazione negata da ManyChat: esito «negata», lo dice con il permesso da chiedere al supporto, e si registra",
    ["negata", true, "negata"],
    [nega.risposta?.esito, /supporto/i.test(nega.risposta?.messaggio ?? ""), nega.registra],
  );
  const f401c = creaFinto().su("GET", PERCORSI.campi, esiti.nonAutorizzato());
  const chiaveNo = await P.provaCreazione(nuovoClient(f401c), NUM);
  c(
    "chiave rifiutata: esito «errore», non si registra",
    ["errore", null],
    [chiaveNo.risposta?.esito, chiaveNo.registra],
  );
  const fIncerta = creaFinto().scenario("assente").su("POST", PERCORSI.crea, esiti.errore500());
  const incerta = await P.provaCreazione(nuovoClient(fIncerta), NUM);
  c(
    "esito incerto (500): «errore», non si registra e non si ritenta",
    ["errore", null, 1],
    [
      incerta.risposta?.esito,
      incerta.registra,
      fIncerta.chiamate.filter((x) => x.percorso === PERCORSI.crea).length,
    ],
  );
  const senzaChiave = await P.provaCreazione(null, NUM);
  c(
    "nessuna chiave: «errore» che lo dice",
    ["errore", true],
    [senzaChiave.risposta?.esito, /chiave/i.test(senzaChiave.risposta?.messaggio ?? "")],
  );
  const fBrutto = creaFinto();
  const numeri = await Promise.all(
    ["", "ciao", "123", "+39 02 1234567", "0039 333 000 0001", 5].map((t) =>
      P.provaCreazione(nuovoClient(fBrutto), t),
    ),
  );
  c(
    "numero che non è un cellulare: 400 con una frase, nessuna chiamata (solo il 0039 buono passa)",
    [400, 400, 400, 400, 200, 400],
    numeri.map((x) => x.stato),
  );

  /* ── LA PROVA A SECCO ──────────────────────────────────────────────────── */
  gruppo("MANYCHAT · RIQUADRO · PROVA A SECCO");
  const consulenti = [
    {
      id: "cons-1",
      data: { nome: "Giulia Demo", attivo: true, faConsulente: true, faSetter: false },
    },
  ];
  const consenso = { si: true, il: "2026-10-01T09:00:00.000Z", da: "Giulia Demo" };
  const sched = (id, n, extra) => ({
    id,
    data: {
      nome: "Anna",
      cognome: "Prova",
      telefono: `333 000 ${String(n).padStart(4, "0")}`,
      consulenteId: "cons-1",
      okWhatsapp: consenso,
      ...extra,
    },
  });
  const meet = (id, n, ora, extra) =>
    sched(id, n, {
      stato: "appuntamento_fissato",
      dataMeeting: "2026-10-23",
      oraMeeting: ora,
      linkMeeting: "https://example.test/meetly/abc123",
      ...extra,
    });
  const ric = (id, n, extra) =>
    sched(id, n, { stato: "da_ricontattare", dataRicontatto: "2026-10-23", ...extra });
  const ora1506 = new Date("2026-10-23T13:06:00.000Z"); // 15:06 a Roma
  const secco = (schede, extra = {}) =>
    P.provaASecco(
      {
        config: P.configDaRiga(riga({ acceso: true, ricontatti: true, promemoria: true })),
        schede,
        consulenti,
        invii: [],
        prossimoDopo: null,
        ...extra,
      },
      ora1506,
    );

  const s1 = secco([meet("m1", 1, "15:30"), ric("r1", 2), ric("r2", 3)]);
  const dettagli = (s) => s.righe.map((r) => [r.tipo, r.esito]);
  c(
    "meet alle 15:30 alle 15:06 → scriverebbe; il primo ricontatto scriverebbe, il secondo aspetta (uno alla volta)",
    [
      ["promemoria", "scriverebbe"],
      ["ricontatto", "scriverebbe"],
      ["ricontatto", "aspetta"],
    ],
    dettagli(s1),
  );
  c(
    "…con il perché in chiaro e il nome abbreviato",
    [true, "Anna P."],
    [s1.righe.every((r) => r.motivo.length > 3), s1.righe[0].nome],
  );
  c("…l'ora è quella data", ora1506.toISOString(), s1.adesso);
  c("…mai il telefono nelle righe", false, /\d{6,}/.test(JSON.stringify(s1)));
  const s2 = secco([meet("m1", 1, "15:30", { okWhatsapp: undefined })]);
  c(
    "senza consenso: «salta» col motivo",
    [["promemoria", "salta"], true],
    [dettagli(s2)[0], /consenso/.test(s2.righe[0].motivo)],
  );
  const s3 = secco([meet("m1", 1, "15:25"), meet("m2", 2, "15:26"), meet("m3", 3, "15:27")]);
  c(
    "al massimo 2 invii per giro: il terzo aspetta il giro dopo",
    ["scriverebbe", "scriverebbe", "aspetta"],
    s3.righe.map((r) => r.esito),
  );
  const s4 = secco([meet("m1", 1, "18:00")]);
  c(
    "meet lontano: aspetta, e dice a che ora parte",
    ["aspetta", true],
    [s4.righe[0].esito, /17:35/.test(s4.righe[0].motivo)],
  );
  c("nessuno da toccare: elenco vuoto", [], secco([sched("x", 9, { stato: "nuovo_lead" })]).righe);
  const s5 = secco([ric("r1", 2)], { prossimoDopo: new Date("2026-10-23T13:30:00.000Z") });
  c(
    "ritmo dei ricontatti non ancora passato: aspetta",
    ["aspetta", true],
    [s5.righe[0].esito, /ritmo/.test(s5.righe[0].motivo)],
  );
  const sorgente = letto("src/crm/manychat/pannello.ts");
  c(
    "la logica è pura: né il database né fetch entrano in pannello.ts (la prova a secco non può scrivere né chiamare)",
    [false, false],
    [
      /supabase/i.test(sorgente.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")),
      /\bfetch\(/.test(sorgente),
    ],
  );

  /* ── IL CAMBIO A MANO DEL SECONDO STATO ────────────────────────────────── */
  gruppo("MANYCHAT · CAMBIO A MANO DEL CONTATTO (contatto-wa)");
  const adessoC = new Date("2026-10-23T13:00:00.000Z");
  const lc = (b) => P.leggiCambioContatto(b);
  c(
    "corpo: serve un id scheda vero e uno dei sette stati",
    [true, false, false, false, false],
    [
      lc({ leadId: LEAD, stato: "contattato" }).ok,
      lc({ leadId: "1; drop table", stato: "contattato" }).ok,
      lc({ leadId: LEAD, stato: "boh" }).ok,
      lc({ leadId: LEAD }).ok,
      lc(null).ok,
    ],
  );
  c(
    "corpo: chi cambia e l'installazione non si leggono dal browser (le chiavi in più si ignorano)",
    { ok: true, leadId: LEAD, stato: "contattato" },
    lc({ leadId: LEAD, stato: "contattato", chi: "Falso", userId: UUID_B }),
  );

  /** Un database finto che registra l'ordine delle scritture. */
  function porteFinte({ scheda, esito = "ok", dopo, bloccoCade = false }) {
    const log = [];
    return {
      log,
      porte: {
        leggiScheda: async (id) => {
          log.push(["leggi", id]);
          return scheda;
        },
        scriviBlocco: async (userId, cifre, dal) => {
          log.push(["blocco", userId, cifre, dal ? dal.toISOString() : null]);
          if (bloccoCade) throw { code: "XX000" };
        },
        aggiorna: async (userId, id, cambio) => {
          log.push(["aggiorna", userId, id, cambio.patch.stato, cambio.patch.da]);
          return esito;
        },
        rileggi: async () => dopo ?? null,
        avviso: (m) => log.push(["avviso", m]),
      },
    };
  }
  const scritture = (log) => log.filter(([k]) => k === "blocco" || k === "aggiorna");
  const chiama = (porte, extra = {}) =>
    P.cambioContatto(porte, {
      userId: UUID_A,
      leadId: LEAD,
      stato: "contattato",
      chi: "Mario",
      puoTogliereStop: false,
      adesso: adessoC,
      ...extra,
    });

  const altro = porteFinte({ scheda: { user_id: UUID_B, data: { telefono: "333 000 0001" } } });
  const rAltro = await chiama(altro.porte);
  c(
    "scheda di un'altra installazione → 403 e NESSUNA scrittura (né blocco né stato)",
    [403, 0],
    [rAltro.stato, scritture(altro.log).length],
  );
  c(
    "…la risposta non rivela di chi è la scheda",
    false,
    JSON.stringify(rAltro.corpo).includes(UUID_B),
  );
  const manca = porteFinte({ scheda: null });
  const rManca = await chiama(manca.porte);
  c(
    "scheda inesistente → 404, nessuna scrittura",
    [404, 0],
    [rManca.stato, scritture(manca.log).length],
  );

  const normale = porteFinte({
    scheda: { user_id: UUID_A, data: { telefono: "333 000 0001" } },
    dopo: { stato: "contattato", il: adessoC.toISOString(), da: "Mario", storia: [] },
  });
  const rNorm = await chiama(normale.porte);
  c(
    "cambio normale: 200 col secondo stato com'è dopo, scritto da «Mario», il numero NON si tocca",
    [200, "contattato", [["aggiorna", UUID_A, LEAD, "contattato", "Mario"]]],
    [rNorm.stato, rNorm.corpo.contattoWa?.stato, scritture(normale.log)],
  );

  const mettiStop = porteFinte({
    scheda: { user_id: UUID_A, data: { telefono: "333 000 0001" } },
    dopo: { stato: "stop", il: adessoC.toISOString(), da: "Mario", storia: [] },
  });
  const rStop = await chiama(mettiStop.porte, { stato: "stop" });
  c(
    "STOP a mano: prima il blocco del numero (cifre con il 39, data di adesso), poi lo stato",
    [
      200,
      [
        ["blocco", UUID_A, "393330000001", adessoC.toISOString()],
        ["aggiorna", UUID_A, LEAD, "stop", "Mario"],
      ],
    ],
    [rStop.stato, scritture(mettiStop.log)],
  );
  const stopSenzaNumero = porteFinte({
    scheda: { user_id: UUID_A, data: { telefono: "boh" } },
    dopo: { stato: "stop", il: adessoC.toISOString(), da: "Mario", storia: [] },
  });
  const rStop2 = await chiama(stopSenzaNumero.porte, { stato: "stop" });
  c(
    "STOP a mano su una scheda senza numero valido: lo stato si scrive, nessun blocco da scrivere",
    [200, ["aggiorna"]],
    [rStop2.stato, scritture(stopSenzaNumero.log).map(([k]) => k)],
  );

  const inStop = {
    user_id: UUID_A,
    data: {
      telefono: "333 000 0001",
      contattoWa: { stato: "stop", il: "2026-10-22T10:00:00.000Z", da: "automatico", storia: [] },
    },
  };
  const togliSenza = porteFinte({ scheda: inStop });
  const rSenza = await chiama(togliSenza.porte, { stato: "contattato", puoTogliereStop: false });
  c(
    "togliere STOP senza «impostazioni» → 403 con la frase, nessuna scrittura",
    [403, "solo_titolare_toglie_stop", 0],
    [rSenza.stato, rSenza.corpo.codice, scritture(togliSenza.log).length],
  );
  const togliCon = porteFinte({
    scheda: inStop,
    dopo: { stato: "contattato", il: adessoC.toISOString(), da: "Titolare", storia: [] },
  });
  const rCon = await chiama(togliCon.porte, {
    stato: "contattato",
    puoTogliereStop: true,
    chi: "Titolare",
  });
  c(
    "togliere STOP col permesso: prima si salva lo stato, SOLO dopo si azzera il blocco del numero",
    [
      200,
      [
        ["aggiorna", UUID_A, LEAD, "contattato", "Titolare"],
        ["blocco", UUID_A, "393330000001", null],
      ],
    ],
    [rCon.stato, scritture(togliCon.log)],
  );
  for (const [esitoDb, atteso] of [
    ["manca_migrazione", 503],
    ["nessuna_riga", 409],
  ]) {
    const nonSalvato = porteFinte({ scheda: inStop, esito: esitoDb });
    const r = await chiama(nonSalvato.porte, {
      stato: "contattato",
      puoTogliereStop: true,
      chi: "Titolare",
    });
    c(
      `togliere STOP e lo stato NON si salva (${esitoDb}): ${atteso} e il numero resta bloccato (nessuna scrittura del blocco)`,
      [atteso, ["aggiorna"]],
      [r.stato, scritture(nonSalvato.log).map(([k]) => k)],
    );
  }
  const bloccoCade = porteFinte({
    scheda: inStop,
    dopo: { stato: "contattato", il: adessoC.toISOString(), da: "Titolare", storia: [] },
    bloccoCade: true,
  });
  const rCade = await chiama(bloccoCade.porte, {
    stato: "contattato",
    puoTogliereStop: true,
    chi: "Titolare",
  });
  c(
    "togliere STOP e l'azzeramento cade: lo stato è salvato, il numero resta bloccato (guasto sicuro), lo dice e nei log c'è solo un codice",
    [200, true, ["blocco_non_tolto:XX000"]],
    [
      rCade.stato,
      /ancora bloccato/.test(rCade.corpo.avviso ?? ""),
      bloccoCade.log.filter(([k]) => k === "avviso").map(([, m]) => m),
    ],
  );
  const restaStop = porteFinte({
    scheda: inStop,
    dopo: { stato: "stop", il: adessoC.toISOString(), da: "Mario", storia: [] },
  });
  const rResta = await chiama(restaStop.porte, { stato: "stop", puoTogliereStop: false });
  c(
    "già in STOP e si sceglie ancora STOP: nessun permesso speciale, il blocco si riscrive",
    [200, "blocco"],
    [rResta.stato, scritture(restaStop.log)[0]?.[0]],
  );

  const sparita = porteFinte({
    scheda: { user_id: UUID_A, data: { telefono: "333 000 0001" } },
    esito: "nessuna_riga",
  });
  const rSparita = await chiama(sparita.porte);
  c("la scheda è cambiata mentre si salvava → 409", 409, rSparita.stato);
  const senzaM2 = porteFinte({
    scheda: { user_id: UUID_A, data: { telefono: "333 000 0001" } },
    esito: "manca_migrazione",
  });
  const rM2 = await chiama(senzaM2.porte);
  c(
    "funzione del database assente → 503 «manca l'aggiornamento del database»",
    [503, true],
    [rM2.stato, /aggiornamento del database/.test(rM2.corpo.error)],
  );
  const senzaLettura = porteFinte({
    scheda: { user_id: UUID_A, data: { telefono: "333 000 0001" } },
    dopo: null,
  });
  const rFallback = await chiama(senzaLettura.porte, { stato: "ha_risposto" });
  c(
    "se la rilettura non dà niente, la risposta usa la stessa fusione del database (voce in testa, sblocco)",
    [200, "ha_risposto", "Mario", true],
    [
      rFallback.stato,
      rFallback.corpo.contattoWa?.stato,
      rFallback.corpo.contattoWa?.da,
      !!rFallback.corpo.contattoWa?.sbloccatoIl,
    ],
  );

  /* ── LE GUARDIE DELLE ROTTE (lette come testo) ─────────────────────────── */
  gruppo("MANYCHAT · RIQUADRO · LE ROTTE");
  const rotta = letto("src/routes/api.crm.manychat.ts");
  const rottaC = letto("src/routes/api.crm.contatto-wa.ts");
  const guardie = (t, permesso) =>
    (t.match(new RegExp(`guardiaCRM\\(request, cors, ${permesso}\\)`, "g")) ?? []).length;
  c(
    "api.crm.manychat: GET e POST dietro guardiaCRM(«impostazioni»), e solo quello",
    [2, 2],
    [guardie(rotta, '"impostazioni"'), (rotta.match(/guardiaCRM\(/g) ?? []).length],
  );
  c(
    "api.crm.contatto-wa: POST dietro guardiaCRM(null) (basta essere dentro: il permesso fine lo decide cambioAMano)",
    [1, 1],
    [guardie(rottaC, "null"), (rottaC.match(/guardiaCRM\(/g) ?? []).length],
  );
  c(
    "contatto-wa: il permesso di togliere STOP è quello «impostazioni» della sessione, non un valore fisso",
    [true, false],
    [
      /puoTogliereStop:\s*g\.chi\.accesso\.puo\("impostazioni"\)/.test(rottaC),
      /puoTogliereStop:\s*(true|false)\b/.test(rottaC),
    ],
  );
  c(
    "api.crm.manychat: GET e POST rifiutano (403) la configurazione di un'altra installazione, prima di scrivere",
    [2, 2],
    [
      (
        rotta.match(
          /if \(configDiAltraInstallazione\(cfg\.riga, [\w.]+\)\)\s*return json\(\{ error: FRASE_ALTRA \}, 403\)/g,
        ) ?? []
      ).length,
      (rotta.match(/configDiAltraInstallazione\(/g) ?? []).length,
    ],
  );
  c(
    "…la POST controlla PRIMA di ogni scrittura (scriviConfig, salvaControlli)",
    true,
    rotta.indexOf("configDiAltraInstallazione(cfg.riga, userId)") <
      Math.min(rotta.indexOf("await scriviConfig("), rotta.indexOf("await salvaControlli(")),
  );
  c(
    "configDiAltraInstallazione: stessa installazione, nessuna riga, riga mai scritta → no; un altro user_id → sì",
    [false, false, false, true],
    [
      P.configDiAltraInstallazione({ user_id: UUID_A }, UUID_A),
      P.configDiAltraInstallazione(null, UUID_A),
      P.configDiAltraInstallazione({ user_id: null }, UUID_A),
      P.configDiAltraInstallazione({ user_id: UUID_B }, UUID_A),
    ],
  );
  const contesto = letto("src/crm/CRMContext.tsx");
  c(
    "updateLead scarta `contattoWa` dalla modifica con la destrutturazione (non delete), e non tocca `promemoria`",
    [true, false, false],
    [
      /const \{ contattoWa: _soloServer, \.\.\.patch \} = risolviModifica\(modifica, current\.data\)/.test(
        contesto,
      ),
      /delete patch\./.test(contesto),
      /promemoria: _/.test(contesto),
    ],
  );
  c(
    "tutte e due ripartono se manca il titolare dei dati (adminUserId)",
    [true, true],
    [/!g\.chi\.adminUserId/.test(rotta), /!g\.chi\.adminUserId/.test(rottaC)],
  );
  c(
    "il browser non sceglie né il nome di chi cambia né l'installazione: la rotta usa quelli della sessione",
    [true, true, false],
    [
      /g\.chi\.nome/.test(rottaC),
      /g\.chi\.adminUserId/.test(rottaC),
      /body\.(chi|userId|nome)\b/.test(rottaC),
    ],
  );
  c(
    "nessun console.log nelle rotte né nella logica (nei log solo codici)",
    false,
    [
      rotta,
      rottaC,
      letto("src/crm/manychat/pannello.ts"),
      letto("src/crm/manychat/pannello.server.ts"),
    ].some((t) => /console\.log/.test(t)),
  );
  c(
    "la chiave di ManyChat si legge solo dal server (mai in una risposta): nessuna risposta serializza `process.env`",
    false,
    /JSON\.stringify\([^)]*process\.env/.test(rotta),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  COMPITO 6 (Dev D): IL MONTAGGIO NELLE SCHERMATE
 *
 *  Quello che si può provare senza browser: la tabella di «Oggi» e che le tre
 *  liste, la scheda e le Impostazioni usino davvero i pezzi giusti (lettura dei
 *  sorgenti, come fanno le altre prove di struttura). Il resto, con Chrome vero,
 *  è in LAVAGNA.
 * ═════════════════════════════════════════════════════════════════════════ */
async function proveMontaggio(mod, { c, gruppo, radice }) {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  gruppo("MANYCHAT · MONTAGGIO NELLE SCHERMATE");
  c(
    "pastiglia: con la finestra aperta i tasti non arrivano alle scorciatoie della pagina",
    true,
    /onKeyDown=\{\(e\) => e\.stopPropagation\(\)\}/.test(leggi("src/crm/manychat/PastigliaContatto.tsx")),
  );
  const VO = mod["vista-oggi"];
  c(
    "«Oggi»: la striscia delle risposte la vede chi fa consulenze",
    true,
    VO.vistaOggi(() => true).risposteOggi,
  );
  c("«Oggi»: …e non chi non ha nessun permesso", false, VO.vistaOggi(() => false).risposteOggi);
  for (const f of [
    "src/routes/CRM.trattative.tsx",
    "src/crm/importa/SchedaTutti.tsx",
    "src/routes/CRM.index.tsx",
  ])
    c(
      `${f}: il filtro per secondo stato usa filtraPerContatto`,
      true,
      /filtraPerContatto\(/.test(leggi(f)),
    );
  const scheda = leggi("src/crm/LeadDialog.tsx");
  c(
    "scheda: «Ok a WhatsApp» salva SOLO la chiave okWhatsapp con updateLead",
    true,
    /updateLead\(lead\.id, \{ okWhatsapp: nuovoOk \}\)/.test(scheda),
  );
  c("scheda: la pastiglia del contatto è montata", true, /<PastigliaContattoLead/.test(scheda));
  c(
    "Impostazioni: il riquadro ManyChat è montato una volta",
    1,
    (leggi("src/routes/CRM.impostazioni.tsx").match(/<ManychatPannello \/>/g) ?? []).length,
  );
  c(
    "il contratto della rotta del contatto dichiara `avviso`",
    true,
    /avviso\?: string/.test(leggi("src/crm/manychat/client-crm.ts")),
  );
  c(
    "la pastiglia mostra l'avviso della rotta",
    true,
    /r\.dati\.avviso/.test(leggi("src/crm/manychat/PastigliaContatto.tsx")),
  );
  c(
    "la finestra della pastiglia non fa arrivare i clic alla riga",
    true,
    /className="contents"\s+onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(
      leggi("src/crm/manychat/PastigliaContatto.tsx"),
    ),
  );
}
