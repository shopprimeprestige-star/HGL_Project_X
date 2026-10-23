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
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSync } from "esbuild";

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
  const righe = (...esiti) => ({
    controllatoIl: ADESSO.toISOString(),
    righe: esiti.map((esito, i) => ({ id: `r${i}`, esito, testo: "x" })),
  });
  c(
    "collegamento: mai controllato",
    ["neutro", "Collegamento non ancora controllato"],
    ((t) => [t.tono, t.titolo])(V.titoloCollegamento(null)),
  );
  c(
    "collegamento: tutto ok → verde «Collegamento ok»",
    ["verde", "Collegamento ok"],
    ((t) => [t.tono, t.titolo])(V.titoloCollegamento(righe("ok", "ok"))),
  );
  c(
    "collegamento: un problema basta → rosso",
    ["rosso", "Collegamento: 1 problema"],
    ((t) => [t.tono, t.titolo])(V.titoloCollegamento(righe("ok", "errore", "da_verificare"))),
  );
  c(
    "collegamento: due problemi → plurale",
    "Collegamento: 2 problemi",
    V.titoloCollegamento(righe("errore", "errore")).titolo,
  );
  c(
    "collegamento: solo «da verificare» → ambra, mai «ok»",
    ["ambra", "Collegamento: 1 cosa da verificare"],
    ((t) => [t.tono, t.titolo])(V.titoloCollegamento(righe("ok", "da_verificare"))),
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
  void mod;
  await proveVistaComponenti(aiuti);
}
