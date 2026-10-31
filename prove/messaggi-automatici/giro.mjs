/** ── PROVE: IL GIRO E LE DECISIONI (le chiavi spente dentro la scelta) ──────
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T4. Un messaggio spento NON deve
 *  consumare tetti, posti o ritmo di uno acceso: per questo le chiavi spente (`messaggiSpenti`)
 *  entrano DENTRO la scelta (`decidiLeadNuovi`, `decidiGiornoMeet`, `decisioniDelGiro`), PRIMA di
 *  costruire i candidati e di contare `casi.emessi`, `leadNuoviOggi`, `totaleOggi`. Non si scartano
 *  dopo. Qui le funzioni pure e le due letture vere (`porte.server.ts` per il giro,
 *  `pannello.server.ts` per il riquadro) con un Supabase finto; le prove del giro intero (con
 *  l'esito `spento` della porta) sono in `prove/manychat/giro.mjs`.
 *
 *  Martedì 27/10/2026, 10:00 a Roma (+01:00, ora solare). Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function proveGiroMessaggi(mod, { c, gruppo, radice }) {
  const S = mod["manychat/sequenze"];
  const G = mod["manychat/giro"];
  const t = (iso) => new Date(iso);
  const tel = (n) => `333 000 ${String(n).padStart(4, "0")}`;
  const t9 = (n) => `33000${String(n).padStart(4, "0")}`;
  const num = (n) => `39333000${String(n).padStart(4, "0")}`;
  const consulenti = [
    {
      id: "cons-1",
      data: { nome: "Filippo Demo", attivo: true, faConsulente: true, faSetter: false },
    },
  ];
  const FRASE = "2026-10-20T00:00:00.000Z";
  const DAL = "2026-10-20T06:00:00.000Z";
  const CASI_DAL = "2026-10-20T00:00:00.000Z";
  const MAR10 = "2026-10-27T10:00:00+01:00";
  const PRIMO = "2026-10-27T08:00:00.000Z"; // 09:00 a Roma: un'ora prima di MAR10
  const ULTIMO = "2026-10-27T08:00:00.000Z"; // il ritorno di `rit`

  /* ── schede inventate ──────────────────────────────────────────────────── */
  /** un lead del modulo Meta, entrato all'istante `il`: ha diritto al primo contatto */
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
  /** chi ha appena ricevuto il primo contatto: aspetta i casi reali */
  const attesa = (id, n) => ({
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
    },
  });
  /** un importato qualunque, mai contattato: primo contatto dal ramo «importati» */
  const imp = (id, n) => ({
    id,
    data: {
      nome: "Carla",
      telefono: tel(n),
      stato: "da_contattare",
      importato: true,
      createdAt: "2026-07-01T09:00:00.000Z",
    },
  });
  /** un contatto di ritorno: il suo `ricarico` è salito */
  const rit = (id, n) => ({
    id,
    data: {
      nome: "Dario",
      telefono: tel(n),
      stato: "non_risponde",
      importato: true,
      ricarico: { volte: 2, ultimo: ULTIMO, daDecidere: true },
    },
  });
  const primo = (n, prenotatoIl = PRIMO) => ({
    telefono: num(n),
    tipo: "primo_contatto",
    stato: "inviato",
    prenotatoIl,
    chiave: `n|${t9(n)}`,
  });
  const oggi = (quanti) =>
    Array.from({ length: quanti }, (_, i) => ({
      telefono: `3933400${String(i).padStart(5, "0")}`,
      tipo: "primo_contatto",
      stato: "inviato",
      prenotatoIl: "2026-10-27T07:00:00.000Z",
      rispostaIl: "2026-10-27T07:05:00.000Z",
    }));
  const lead = (schede, adesso, extra) =>
    S.decidiLeadNuovi(schede, t(adesso), {
      consulenti,
      invii: [],
      tetti: { ricontatti: 20, leadNuovi: 100, totale: 100 },
      fraseModuloDal: FRASE,
      leadNuovoDal: DAL,
      casiRealiDal: CASI_DAL,
      ...extra,
    });
  /** [tipo, scheda, quale/motivo] di ogni decisione */
  const sintesi = (r) =>
    r.map((x) => [x.tipo, x.scheda.id, x.tipo === "invia" ? x.extra.quale : x.motivo]);
  const TETTO_LN = "tetto dei lead nuovi di oggi raggiunto: se ne parla domani";

  /* ════════════════════════════════════════════════════════════════════════
   *  UN MESSAGGIO SPENTO NON CONSUMA IL POSTO DI UNO ACCESO
   *  Ogni coppia: con TUTTO acceso parte il primo e l'altro aspetta (la prova che il tetto è
   *  davvero a un posto dalla fine); con il primo spento parte l'acceso e dello spento
   *  non resta traccia (né un «aspetta» né un «salta»).
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MESSAGGI AUTOMATICI · GIRO · CHI È SPENTO NON CONSUMA TETTI");

  //  casi reali (spento) davanti a un primo contatto (acceso): tetto dei lead nuovi 3, già 2 oggi.
  {
    const schede = [attesa("c-1", 1), nuovo("p-2", 2, "2026-10-27T08:30:00.000Z")];
    const extra = {
      tetti: { ricontatti: 20, leadNuovi: 3, totale: 100 },
      invii: [primo(1), ...oggi(1)],
    };
    c(
      "tutto acceso, un posto solo: i casi reali passano davanti, il primo contatto aspetta",
      [
        ["invia", "c-1", "casi_reali"],
        ["aspetta", "p-2", TETTO_LN],
      ],
      sintesi(lead(schede, MAR10, extra)),
    );
    c(
      "casi reali SPENTO: il posto resta al primo contatto, e dei casi reali non resta traccia",
      [["invia", "p-2", "primo_contatto"]],
      sintesi(lead(schede, MAR10, { ...extra, messaggiSpenti: ["casi_reali"] })),
    );
  }
  //  …e i casi reali spenti non fanno crescere `casi.emessi`: 3 candidati, 2 posti, il primo contatto parte.
  {
    const schede = [
      attesa("c-1", 1),
      attesa("c-2", 2),
      attesa("c-3", 3),
      nuovo("p-4", 4, "2026-10-27T08:30:00.000Z"),
    ];
    const extra = {
      tetti: { ricontatti: 20, leadNuovi: 5, totale: 100 },
      invii: [primo(1), primo(2), primo(3)],
    };
    c(
      "tutto acceso, tre in attesa dei casi reali e due posti: ne partono due, il primo contatto aspetta",
      [2, 1, 1],
      ((r) => [
        r.filter((x) => x.tipo === "invia" && x.extra.quale === "casi_reali").length,
        r.filter((x) => x.scheda.id.startsWith("c-") && x.tipo === "aspetta").length,
        r.filter((x) => x.scheda.id === "p-4" && x.tipo === "aspetta").length,
      ])(lead(schede, MAR10, extra)),
    );
    c(
      "casi reali SPENTO: il conteggio non cresce, il primo contatto parte e le tre schede non compaiono",
      [[["invia", "p-4", "primo_contatto"]], false],
      ((r) => [
        sintesi(r),
        r.some((x) => /casi reali/.test(x.tipo === "invia" ? x.extra.quale : x.motivo)),
      ])(lead(schede, MAR10, { ...extra, messaggiSpenti: ["casi_reali"] })),
    );
  }

  //  primo contatto (spento) davanti a un ritorno (acceso): un posto solo.
  {
    const schede = [nuovo("p-3", 3, "2026-10-27T08:30:00.000Z"), rit("r-5", 5)];
    const extra = { tetti: { ricontatti: 20, leadNuovi: 1, totale: 100 } };
    c(
      "tutto acceso, un posto solo: il primo contatto prende il posto, il ritorno aspetta",
      [
        ["invia", "p-3", "primo_contatto"],
        ["aspetta", "r-5", "ritorno: " + TETTO_LN],
      ],
      sintesi(lead(schede, MAR10, extra)),
    );
    c(
      "primo contatto SPENTO: parte il ritorno",
      [["invia", "r-5", "ritorno"]],
      sintesi(lead(schede, MAR10, { ...extra, messaggiSpenti: ["primo_contatto"] })),
    );
    //  (d) il lead che il primo contatto spento avrebbe preso NON passa dal ramo «importati»
    c(
      "…e il lead del modulo non esce lo stesso come «importato» con lo stesso messaggio",
      [],
      sintesi(lead([schede[0]], MAR10, { messaggiSpenti: ["primo_contatto"] })),
    );
    c(
      "…un importato qualunque (ramo «importati») con il primo contatto spento: niente",
      [],
      sintesi(lead([imp("i-6", 6)], MAR10, { messaggiSpenti: ["primo_contatto"] })),
    );
    c(
      "…con il primo contatto ACCESO lo stesso importato parte (la prova che prima sopra non è un vuoto)",
      [["invia", "i-6", "primo_contatto"]],
      sintesi(lead([imp("i-6", 6)], MAR10)),
    );
  }

  //  richiamo a 24 ore (spento) davanti a un ritorno (acceso).
  {
    const R = nuovo("r-4", 4, "2026-10-26T09:00:00.000Z");
    const schede = [R, rit("r-5", 5)];
    const extra = {
      tetti: { ricontatti: 20, leadNuovi: 1, totale: 100 },
      invii: [primo(4, "2026-10-26T09:00:30.000Z")],
    };
    const ADESSO = "2026-10-27T10:30:00+01:00";
    c(
      "tutto acceso, un posto solo: il richiamo prende il posto, il ritorno aspetta",
      [
        ["invia", "r-4", "richiamo_24h"],
        ["aspetta", "r-5", "ritorno: " + TETTO_LN],
      ],
      sintesi(lead(schede, ADESSO, extra)),
    );
    c(
      "richiamo SPENTO: parte il ritorno, del richiamo nessuna traccia",
      [["invia", "r-5", "ritorno"]],
      sintesi(lead(schede, ADESSO, { ...extra, messaggiSpenti: ["richiamo_24h"] })),
    );
    c(
      "richiamo spento NON spegne il primo contatto: lo stesso lead, già contattato, non riceve niente",
      [],
      sintesi(lead([R], ADESSO, { ...extra, messaggiSpenti: ["richiamo_24h"] })),
    );
  }

  //  ritorno (spento) davanti a un primo contatto da «importati» (acceso).
  {
    const schede = [rit("r-5", 5), imp("i-6", 6)];
    const extra = { tetti: { ricontatti: 20, leadNuovi: 1, totale: 100 } };
    c(
      "tutto acceso, un posto solo: il ritorno passa davanti, l'importato aspetta",
      [
        ["invia", "r-5", "ritorno"],
        ["aspetta", "i-6", "da contattare: " + TETTO_LN],
      ],
      sintesi(lead(schede, MAR10, extra)),
    );
    c(
      "ritorno SPENTO: parte l'importato",
      [["invia", "i-6", "primo_contatto"]],
      sintesi(lead(schede, MAR10, { ...extra, messaggiSpenti: ["ritorno"] })),
    );
    c(
      "…e il contatto di ritorno non scivola nel primo contatto degli importati (anche se è «da contattare»)",
      [],
      sintesi(
        lead(
          [
            {
              ...rit("r-7", 7),
              data: { ...rit("r-7", 7).data, stato: "da_contattare" },
            },
          ],
          MAR10,
          { messaggiSpenti: ["ritorno"] },
        ),
      ),
    );
  }

  //  il tetto del TOTALE (con la riserva per gli appuntamenti) vale allo stesso modo.
  {
    const schede = [attesa("c-1", 1), nuovo("p-2", 2, "2026-10-27T08:30:00.000Z")];
    //  totale 33 → 33 − 30 di riserva = 3 posti per i lead nuovi; 2 già partiti oggi (primo(1) + 1)
    const extra = {
      tetti: { ricontatti: 20, leadNuovi: 100, totale: 33 },
      invii: [primo(1), ...oggi(1)],
    };
    c(
      "tetto del totale a un posto dalla fine: tutto acceso, vincono i casi reali",
      [
        ["invia", "c-1", "casi_reali"],
        ["aspetta", "p-2", "tetto di messaggi di oggi raggiunto: se ne parla domani"],
      ],
      sintesi(lead(schede, MAR10, extra)),
    );
    c(
      "…con i casi reali spenti parte il primo contatto",
      [["invia", "p-2", "primo_contatto"]],
      sintesi(lead(schede, MAR10, { ...extra, messaggiSpenti: ["casi_reali"] })),
    );
  }

  /* ── il giorno del meet: la mattina (meet_oggi) e il giorno prima (meet_domani) ── */
  gruppo("MESSAGGI AUTOMATICI · GIRO · MEET: LA MATTINA E IL GIORNO PRIMA SPENTI");
  {
    const consenso = { si: true, il: "2026-10-01T09:00:00.000Z", da: "Giulia Demo" };
    const meet = (id, n, extra) => ({
      id,
      data: {
        nome: "Anna",
        cognome: "Prova",
        telefono: tel(n),
        consulenteId: "cons-1",
        okWhatsapp: consenso,
        stato: "appuntamento_fissato",
        dataMeeting: "2026-10-27",
        oraMeeting: "18:00",
        linkMeeting: "https://example.test/meetly/abc",
        ...extra,
      },
    });
    const meetDomani = (id, n) =>
      meet(id, n, {
        dataMeeting: "2026-10-28",
        oraMeeting: "15:00",
        fissatoIl: "2026-10-20T09:00:00.000Z", // da oltre 3 giorni: a pagamento, parte come modello
      });
    const giorno = (schede, extra) =>
      S.decidiGiornoMeet(schede, t(MAR10), {
        consulenti,
        invii: [],
        tetti: { ricontatti: 20, leadNuovi: 100, totale: 100 },
        fraseModuloDal: FRASE,
        ...extra,
      });
    //  Il messaggio all'ora (meet_adesso) ha la sua costante e un'altra via: qui si guarda la sola mattina.
    const mattina = (r) => sintesi(r).filter((x) => !/^messaggio all'ora/.test(x[2]));
    c(
      "la mattina del meet delle 18:00 (sono le 10:00) parte",
      [["invia", "o-1", "meet_oggi"]],
      mattina(giorno([meet("o-1", 1)])),
    );
    c(
      "meet_oggi SPENTO: nessuna decisione della mattina, né «invia» né «aspetta» né «salta»",
      [],
      mattina(giorno([meet("o-1", 1)], { messaggiSpenti: ["meet_oggi"] })),
    );
    c(
      "…lo spento di un altro messaggio non la tocca",
      [["invia", "o-1", "meet_oggi"]],
      mattina(giorno([meet("o-1", 1)], { messaggiSpenti: ["meet_domani", "casi_reali"] })),
    );

    //  l'insieme delle decisioni del giro (`decisioniDelGiro`)
    const dati = {
      consulenti,
      invii: [],
      tetti: { ricontatti: 20, leadNuovi: 100, totale: 100 },
      prossimoDopo: null,
      ultimeEntrate: {},
    };
    const scelta = (extra) => ({
      promemoria: false,
      ricontatti: false,
      leadNuovo: false,
      giornoMeet: true,
      statiAccesi: {},
      leadNuovoDal: null,
      ultimaAccensione: null,
      indirizzoSede: null,
      fraseModuloDal: FRASE,
      messaggiSpenti: [],
      ...extra,
    });
    const tipi = (voci) => voci.filter((v) => v.d.tipo === "invia").map((v) => v.tipo);
    const schede = [meet("o-1", 1), meetDomani("d-2", 2)];
    c(
      "giro: acceso «Giorno del meet»: partono la mattina e il giorno prima (a pagamento, fissato da oltre 3 giorni)",
      ["meet_oggi", "meet_domani"],
      tipi(G.decisioniDelGiro(schede, t(MAR10), dati, scelta())),
    );
    c(
      "giro: meet_domani SPENTO (la famiglia «giorno del meet» è accesa per la mattina): parte solo la mattina",
      ["meet_oggi"],
      tipi(G.decisioniDelGiro(schede, t(MAR10), dati, scelta({ messaggiSpenti: ["meet_domani"] }))),
    );
    c(
      "giro: meet_oggi SPENTO: parte solo il giorno prima",
      ["meet_domani"],
      tipi(G.decisioniDelGiro(schede, t(MAR10), dati, scelta({ messaggiSpenti: ["meet_oggi"] }))),
    );
    c(
      "giro: spenti tutti e due: nessuna voce del meet, nemmeno un «salta»",
      [],
      G.decisioniDelGiro(
        schede,
        t(MAR10),
        dati,
        scelta({ messaggiSpenti: ["meet_oggi", "meet_domani"] }),
      ).filter((v) => v.tipo === "meet_oggi" || v.tipo === "meet_domani"),
    );
  }

  /* ── le chiavi che stanno già «dentro» (stati, ricontatto fissato, promemoria) ── */
  gruppo("MESSAGGI AUTOMATICI · GIRO · RICONTATTI E STATI SPENTI NON SPOSTANO IL RITMO");
  {
    const consenso = { si: true, il: "2026-10-01T09:00:00.000Z", da: "Giulia Demo" };
    const ric = (id, n, stato) => ({
      id,
      data: {
        nome: "Anna",
        cognome: "Prova",
        telefono: tel(n),
        consulenteId: "cons-1",
        okWhatsapp: consenso,
        stato,
        dataRicontatto: "2026-10-27",
      },
    });
    const dati = {
      consulenti,
      invii: [],
      tetti: { ricontatti: 20, leadNuovi: 100, totale: 100 },
      prossimoDopo: null,
      ultimeEntrate: {},
    };
    const scelta = (extra) => ({
      promemoria: false,
      ricontatti: true,
      leadNuovo: false,
      giornoMeet: false,
      statiAccesi: { sta_valutando: "2026-10-20T06:00:00.000Z" },
      leadNuovoDal: null,
      ultimaAccensione: "2026-10-20T06:00:00.000Z",
      indirizzoSede: null,
      fraseModuloDal: FRASE,
      messaggiSpenti: [],
      ...extra,
    });
    const schede = [ric("a-1", 1, "sta_valutando"), ric("b-2", 2, "da_ricontattare")];
    const voci = (extra) =>
      G.decisioniDelGiro(schede, t(MAR10), dati, scelta(extra)).map((v) => [
        v.tipo,
        v.d.tipo,
        v.d.scheda.id,
      ]);
    c(
      "tutti e due i ricontatti accesi: due candidati (il giro ne manderà UNO, per il ritmo)",
      [
        ["ricontatto", "invia", "a-1"],
        ["ricontatto", "invia", "b-2"],
      ],
      voci({}),
    );
    c(
      "«In valutazione» spento (non è in statiAccesi): resta solo il ricontatto fissato, senza «aspetta» né «salta»",
      [["ricontatto", "invia", "b-2"]],
      voci({ statiAccesi: {} }),
    );
    c(
      "«Ricontatto fissato» spento: resta solo lo stato acceso",
      [["ricontatto", "invia", "a-1"]],
      voci({ ricontatti: false }),
    );
    c(
      "promemoria spento (`promemoria = false`): nessun promemoria dei 20 minuti prima",
      [],
      G.decisioniDelGiro(
        [
          {
            id: "m-1",
            data: {
              nome: "Anna",
              telefono: tel(1),
              consulenteId: "cons-1",
              okWhatsapp: consenso,
              stato: "appuntamento_fissato",
              dataMeeting: "2026-10-27",
              oraMeeting: "10:20",
              linkMeeting: "https://example.test/meetly/abc",
            },
          },
        ],
        t(MAR10),
        dati,
        scelta({ ricontatti: false, statiAccesi: {} }),
      ),
    );
  }

  /* ── la prova a secco vede tutto ── */
  gruppo("MESSAGGI AUTOMATICI · GIRO · LA PROVA A SECCO VEDE ANCHE I MESSAGGI SPENTI");
  {
    const cfg = {
      promemoria: false,
      ricontatti: false,
      leadNuovo: true,
      giornoMeet: true,
      leadNuovoDal: DAL,
      stati: {},
      indirizzoSede: null,
      ultimaAccensione: null,
      fraseModuloDal: FRASE,
      messaggiSpenti: ["primo_contatto", "meet_oggi", "meet_domani"],
    };
    c(
      "giro vero: la scelta porta le chiavi spente",
      ["primo_contatto", "meet_oggi", "meet_domani"],
      G.sceltaDaConfig(cfg, t(MAR10), false).messaggiSpenti,
    );
    c(
      "prova a secco: nessuna chiave spenta (come per gli interruttori)",
      [],
      G.sceltaDaConfig(cfg, t(MAR10), true).messaggiSpenti,
    );
    const { messaggiSpenti: _tolto, ...senza } = cfg;
    c(
      "configurazione senza `messaggiSpenti` (porte vecchie, prove vecchie): nessuna chiave spenta",
      [[], []],
      [
        G.sceltaDaConfig(senza, t(MAR10), false).messaggiSpenti,
        G.sceltaDaConfig(senza, t(MAR10), true).messaggiSpenti,
      ],
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  LE DUE LETTURE VERE DEL REGISTRO (con un Supabase finto)
   *  Le colonne vecchie di `manychat_config` (promemoria, ricontatti, lead_nuovo, giorno_meet,
   *  lead_nuovo_dal, stati) NON si leggono più: l'acceso/spento dei messaggi viene solo dal
   *  registro, per l'adattatore. Il resto (canale, generale, tetti, flussi…) resta lì.
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MESSAGGI AUTOMATICI · GIRO · LE LETTURE DEL GIRO E DEL RIQUADRO DAL REGISTRO");
  {
    const dir = mkdtempSync(join(tmpdir(), "giro-registro-"));
    try {
      const finta = join(dir, "supabase-finto.js");
      writeFileSync(
        finta,
        `const q = (t) => {
  const f = [];
  const o = {
    select: () => o,
    eq: (c, v) => (f.push((r) => String(r[c]) === String(v)), o),
    limit: () => o,
    maybeSingle: () => Promise.resolve(risposta(t, true, f)),
    then: (ok, no) => Promise.resolve(risposta(t, false, f)).then(ok, no),
  };
  return o;
};
const risposta = (t, una, f) => {
  globalThis.__letture.push(t);
  const e = globalThis.__errori[t];
  if (e) return { data: null, error: { code: e } };
  const righe = (globalThis.__tabelle[t] ?? []).filter((r) => f.every((x) => x(r)));
  return { data: una ? (righe[0] ?? null) : righe, error: null };
};
export const supabaseAdmin = { from: (t) => q(t) };
export const supabaseAdminDefault = supabaseAdmin;`,
      );
      const esbuild = createRequire(import.meta.url)("esbuild");
      const impacchetta = (entry, nome) => {
        const fuori = join(dir, nome);
        esbuild.buildSync({
          entryPoints: [join(radice, entry)],
          bundle: true,
          format: "cjs",
          platform: "node",
          outfile: fuori,
          logLevel: "error",
          loader: { ".tsx": "tsx" },
          alias: { "@/integrations/supabase/client.server": finta, "@": join(radice, "src") },
        });
        return createRequire(import.meta.url)(fuori);
      };
      const PS = impacchetta("src/crm/manychat/porte.server.ts", "porte.cjs");
      const PN = impacchetta("src/crm/manychat/pannello.server.ts", "pannello.cjs");
      const P = impacchetta("src/crm/manychat/pannello.ts", "pannello-puro.cjs");

      const D1 = "2026-10-21T08:00:00.000Z";
      const D2 = "2026-10-25T08:00:00.000Z"; // la più recente fra i quattro messaggi del «lead nuovo» accesi
      const D3 = "2026-10-26T08:00:00.000Z";
      const riga = (chiave, acceso, acceso_dal = null) => ({ chiave, acceso, acceso_dal });
      const REGISTRO = [
        riga("promemoria_meet", false),
        riga("ricontatto_fissato", true, D1),
        riga("primo_contatto", true, D1),
        riga("richiamo_24h", false),
        riga("ritorno", true, D2),
        riga("casi_reali", true, D1),
        riga("meet_oggi", true),
        riga("meet_domani", false),
        riga("stato:sta_valutando", false),
        riga("stato:non_risponde", true, D3),
      ];
      //  Le colonne VECCHIE dicono l'opposto, di proposito: devono essere ignorate.
      const CONFIG_DB = {
        id: 1,
        user_id: "u-1",
        canale: "manychat",
        acceso: true,
        promemoria: true,
        ricontatti: false,
        lead_nuovo: false,
        giorno_meet: false,
        lead_nuovo_dal: "2026-09-01T00:00:00.000Z",
        stati: { sta_valutando: "2026-09-01T00:00:00.000Z" },
        tetti: { ricontatti: 5 },
        flussi: { hgl_promemoria_meet: "content-1" },
        indirizzo_sede: "Via Prova 1",
        ultima_accensione: "2026-10-01T00:00:00.000Z",
        prima_accensione: "2026-09-01T00:00:00.000Z",
      };
      const imposta = (tabelle, errori = {}) => {
        globalThis.__tabelle = tabelle;
        globalThis.__errori = errori;
        globalThis.__letture = [];
      };
      const avvisi = [];
      const warnVero = console.warn;
      console.warn = (...a) => void avvisi.push(a.map(String).join(" "));
      try {
        // ── il giro (`porteGiro().leggiConfig`) ──
        imposta({ manychat_config: [CONFIG_DB], messaggi_automatici: REGISTRO });
        const g = await PS.porteGiro().leggiConfig();
        c(
          "giro: acceso/spento dei messaggi dal REGISTRO, le colonne vecchie ignorate",
          { promemoria: false, ricontatti: true, leadNuovo: true, giornoMeet: true },
          {
            promemoria: g.promemoria,
            ricontatti: g.ricontatti,
            leadNuovo: g.leadNuovo,
            giornoMeet: g.giornoMeet,
          },
        );
        c(
          "…«lead nuovo» parte dalla data PIÙ RECENTE fra i messaggi accesi della famiglia (D2), non da quella vecchia",
          D2,
          g.leadNuovoDal,
        );
        c(
          "…gli stati sono quelli accesi nel registro (non «In valutazione», spento lì anche se acceso nella vecchia colonna)",
          { non_risponde: D3 },
          g.stati,
        );
        c(
          "…le chiavi di famiglia spente vanno al giro (`messaggiSpenti`)",
          ["meet_domani", "richiamo_24h"],
          [...g.messaggiSpenti].sort(),
        );
        c(
          "…il resto resta letto da `manychat_config`: utente, canale, generale, tetti, flussi, sede",
          [
            "u-1",
            "manychat",
            true,
            { ricontatti: 5 },
            { hgl_promemoria_meet: "content-1" },
            "Via Prova 1",
          ],
          [g.userId, g.canale, g.acceso, g.tetti, g.flussi, g.indirizzoSede],
        );
        c(
          "…una lettura sola per tabella",
          [1, 1],
          [
            globalThis.__letture.filter((x) => x === "manychat_config").length,
            globalThis.__letture.filter((x) => x === "messaggi_automatici").length,
          ],
        );

        //  registro illeggibile: fail-closed, il giro non fa niente e lo dice col solo codice
        avvisi.length = 0;
        imposta(
          { manychat_config: [CONFIG_DB], messaggi_automatici: REGISTRO },
          { messaggi_automatici: "42P01" },
        );
        const gx = await PS.porteGiro().leggiConfig();
        c(
          "giro: registro illeggibile (tabella mancante) → tutto spento, ma il generale e il canale restano",
          [false, false, false, false, {}, null, true, "manychat"],
          [
            gx.promemoria,
            gx.ricontatti,
            gx.leadNuovo,
            gx.giornoMeet,
            gx.stati,
            gx.leadNuovoDal,
            gx.acceso,
            gx.canale,
          ],
        );
        c(
          "…e nei log c'è il codice dell'errore, senza utenti né testi",
          [true, false],
          [
            avvisi.some((x) => /registro_non_letto_42P01/.test(x)),
            avvisi.some((x) => /u-1|Via Prova/.test(x)),
          ],
        );
        imposta(
          { manychat_config: [CONFIG_DB], messaggi_automatici: REGISTRO },
          { messaggi_automatici: "XX000" },
        );
        const gy = await PS.porteGiro().leggiConfig();
        c(
          "giro: qualunque altro guasto del registro → tutto spento (nessuna eccezione, il giro ripassa fra un minuto)",
          [false, false, false, false],
          [gy.promemoria, gy.ricontatti, gy.leadNuovo, gy.giornoMeet],
        );
        //  registro vuoto (migrazione applicata ma righe mancanti): chiave sconosciuta = spenta
        imposta({ manychat_config: [CONFIG_DB], messaggi_automatici: [] });
        const gv = await PS.porteGiro().leggiConfig();
        c(
          "giro: registro vuoto → tutto spento",
          [false, false, false, false, {}],
          [gv.promemoria, gv.ricontatti, gv.leadNuovo, gv.giornoMeet, gv.stati],
        );
        //  senza riga di configurazione il giro non parte, e non legge neppure il registro
        imposta({ manychat_config: [], messaggi_automatici: REGISTRO });
        c(
          "giro: nessuna riga di configurazione → «senza_configurazione», come prima",
          { fermo: "senza_configurazione" },
          await PS.porteGiro().leggiConfig(),
        );

        // ── il riquadro (`leggiRigaConfig`) ──
        imposta({ manychat_config: [CONFIG_DB], messaggi_automatici: REGISTRO });
        const r = await PN.leggiRigaConfig();
        const cfg = P.configDaRiga(r.riga, r.sequenze);
        c(
          "riquadro: i vecchi interruttori mostrano il REGISTRO, non le colonne vecchie",
          {
            promemoria: false,
            ricontatti: true,
            leadNuovo: true,
            giornoMeet: true,
            leadNuovoDal: D2,
            stati: { non_risponde: D3 },
          },
          {
            promemoria: cfg.promemoria,
            ricontatti: cfg.ricontatti,
            leadNuovo: cfg.leadNuovo,
            giornoMeet: cfg.giornoMeet,
            leadNuovoDal: cfg.leadNuovoDal,
            stati: cfg.stati,
          },
        );
        c(
          "…il resto della riga è com'è (canale, generale, tetti, flussi, sede) e `sequenze` resta vero",
          [
            "manychat",
            true,
            { ricontatti: 5 },
            { hgl_promemoria_meet: "content-1" },
            "Via Prova 1",
            true,
            false,
          ],
          [cfg.canale, cfg.acceso, cfg.tetti, cfg.flussi, cfg.indirizzoSede, r.sequenze, r.manca],
        );
        c(
          "…la riga letta serve ancora ai comandi: l'utente e i controlli sono quelli di prima",
          ["u-1", undefined],
          [r.riga.user_id, r.riga.controlli],
        );
        imposta(
          { manychat_config: [CONFIG_DB], messaggi_automatici: REGISTRO },
          { messaggi_automatici: "PGRST205" },
        );
        const rx = await PN.leggiRigaConfig();
        const cx = P.configDaRiga(rx.riga, rx.sequenze);
        c(
          "riquadro: registro illeggibile → i vecchi interruttori si vedono spenti (mai accesi per sbaglio)",
          [false, false, false, false, {}, true],
          [cx.promemoria, cx.ricontatti, cx.leadNuovo, cx.giornoMeet, cx.stati, cx.acceso],
        );
        imposta({ manychat_config: [], messaggi_automatici: REGISTRO });
        const rn = await PN.leggiRigaConfig();
        c("riquadro: senza riga di configurazione resta senza riga", null, rn.riga);
      } finally {
        console.warn = warnVero;
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  RIACCESO: GLI ARRETRATI PARTONO (decisione del titolare, 31/10/2026: «anche gli arretrati»)
   *  Un lead (o un ritorno) arrivato MENTRE «Primo contatto» (o «Ritorno») era spento riceve il
   *  messaggio dopo la riaccensione, anche se è entrato prima della data di partenza. A scaglioni:
   *  il tetto dei lead nuovi, la fascia oraria e il massimo di invii per giro restano.
   *  `decidiImportatiERitorni` non guarda `leadNuovoDal`: questa prova lo inchioda.
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MESSAGGI AUTOMATICI · GIRO · RIACCESO: GLI ARRETRATI PARTONO, A SCAGLIONI");
  {
    //  Riacceso alle 09:30 a Roma di martedì (la data di partenza); ora sono le 10:00.
    const RIACCESO = "2026-10-27T08:30:00.000Z";
    //  Entrati domenica e lunedì, mentre il messaggio era spento: PRIMA della data di partenza.
    const ENTRATO = "2026-10-25T10:00:00.000Z";
    const arretrati = [
      nuovo("a-1", 1, "2026-10-25T10:00:00.000Z"),
      nuovo("a-2", 2, "2026-10-26T09:00:00.000Z"),
      nuovo("a-3", 3, "2026-10-26T15:00:00.000Z"),
    ];
    const riacceso = (schede, adesso, extra) =>
      lead(schede, adesso, { leadNuovoDal: RIACCESO, ...extra });

    c(
      "col primo contatto SPENTO il lead arrivato nel frattempo non parte (e non lascia traccia)",
      [],
      sintesi(riacceso([nuovo("a-1", 1, ENTRATO)], MAR10, { messaggiSpenti: ["primo_contatto"] })),
    );
    c(
      "RIACCESO: lo stesso lead, entrato PRIMA della data di partenza, riceve il primo contatto",
      [["invia", "a-1", "primo_contatto"]],
      sintesi(riacceso([nuovo("a-1", 1, ENTRATO)], MAR10)),
    );
    c(
      "…anche un lead importato vecchio, e anche uno entrato il giorno stesso della riaccensione",
      //  il più recente per primo: il lead di oggi, poi il vecchio importato
      [
        ["invia", "a-6", "primo_contatto"],
        ["invia", "i-5", "primo_contatto"],
      ],
      sintesi(riacceso([imp("i-5", 5), nuovo("a-6", 6, "2026-10-27T08:45:00.000Z")], MAR10)),
    );
    //  A scaglioni: tre arretrati, tetto dei lead nuovi a 2 → ne partono 2 (i più recenti), uno aspetta domani.
    c(
      "tre arretrati e il tetto dei lead nuovi a 2: ne partono 2 (prima i più recenti), il terzo aspetta domani",
      [
        ["invia", "a-3", "primo_contatto"],
        ["invia", "a-2", "primo_contatto"],
        ["aspetta", "a-1", `da contattare: ${TETTO_LN}`],
      ],
      sintesi(riacceso(arretrati, MAR10, { tetti: { ricontatti: 20, leadNuovi: 2, totale: 100 } })),
    );
    c(
      "…il tetto conta anche i primi contatti già partiti oggi (un posto solo: parte uno)",
      [1, 2],
      ((r) => [
        r.filter((x) => x.tipo === "invia").length,
        r.filter((x) => x.tipo === "aspetta").length,
      ])(
        riacceso(arretrati, MAR10, {
          tetti: { ricontatti: 20, leadNuovi: 3, totale: 100 },
          invii: oggi(2),
        }),
      ),
    );
    //  La fascia oraria: alle 21:00 non parte niente, tutti aspettano.
    c(
      "fuori dalla fascia (21:00) nessun arretrato parte: tutti aspettano",
      [0, 3],
      ((r) => [
        r.filter((x) => x.tipo === "invia").length,
        r.filter((x) => x.tipo === "aspetta").length,
      ])(riacceso(arretrati, "2026-10-27T21:00:00+01:00")),
    );
    //  Il ritmo: un giro non ne manda più di MAX_INVII_PER_GIRO, gli altri vanno ai giri dopo.
    c(
      "il giro ne manda al massimo 2 per volta (gli altri arretrati ai giri dopo)",
      2,
      G.MAX_INVII_PER_GIRO,
    );
    //  Il ritorno.
    c(
      "RITORNO spento: il contatto tornato nel frattempo non parte",
      [],
      sintesi(riacceso([rit("r-1", 7)], MAR10, { messaggiSpenti: ["ritorno"] })),
    );
    c(
      "RITORNO riacceso: parte anche il ritorno di prima della data, a scaglioni dentro il tetto",
      [["invia", "r-1", "ritorno"]],
      sintesi(riacceso([rit("r-1", 7)], MAR10)),
    );
    c(
      "…e con il tetto dei lead nuovi pieno aspetta domani",
      [["aspetta", "r-1", `ritorno: ${TETTO_LN}`]],
      sintesi(
        riacceso([rit("r-1", 7)], MAR10, {
          tetti: { ricontatti: 20, leadNuovi: 1, totale: 100 },
          invii: oggi(1),
        }),
      ),
    );
  }

  /* ── il sorgente: il giro passa la chiave a ogni invio e legge `spento` ── */
  gruppo("MESSAGGI AUTOMATICI · GIRO · IL SORGENTE");
  {
    const src = readFileSync(join(radice, "src/crm/manychat/giro.ts"), "utf8");
    const senzaCommenti = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    c(
      "il giro chiede la chiave del messaggio al catalogo e la passa a `inviaWhatsapp`",
      [true, true],
      [/chiaveDi\(/.test(senzaCommenti), /messaggio:\s*chiave/.test(senzaCommenti)],
    );
    c(
      "…una chiave mancante non manda mai (si salta con un codice, senza prenotare)",
      true,
      /chiave_mancante/.test(senzaCommenti),
    );
    c("…l'esito «spento» della porta è un caso a parte", true, /"spento"/.test(senzaCommenti));
  }
}
