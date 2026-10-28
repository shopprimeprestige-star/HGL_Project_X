/** ── PROVE: IL GIRO A ORARIO ───────────────────────────────────────────────
 *
 *  File d'area della commessa 2026-10-23 (ManyChat), compito 3 (Dev C). Il
 *  giro vero (`giro.ts`) con il ManyChat finto (`finto.mjs`) e un DATABASE
 *  FINTO in memoria che si comporta come le funzioni SQL di M2:
 *  `manychat_prenota_giro` (ripete lo STESSO ORDINE dell'SQL: riga del giro,
 *  prenotato > 10' → incerto, tetti, STOP, pausa, ritmo in lettura,
 *  inserimento, solo alla fine il posto del ritmo), il lucchetto,
 *  `manychat_giro_annulla` e `contatto_wa_aggiorna` (con le sue guardie).
 *  Il testo SQL vero lo legge `migrazioni.mjs`: qui si prova il giro.
 *
 *  Il tempo è finto: `ritardoMs` del finto fa avanzare l'orologio che il giro
 *  legge da `adesso()`. Dati inventati: nessun numero né nome vero.
 *
 *  Venerdì 23/10/2026, ora legale: le 15:06 a Roma sono le 13:06Z. Un meet
 *  alle 15:30 vuole il promemoria alle 15:05 (si accetta fino alle 15:15).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo }`. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creaFinto, creaOrologio, esiti, PERCORSI } from "./finto.mjs";

const CHIAVE = "chiave-finta-0000";
const ADESSO = Date.parse("2026-10-23T13:06:00Z");
const MIN = 60_000;
const TIPI9 = [
  "promemoria",
  "ricontatto",
  "primo_contatto",
  "richiamo_24h",
  "ritorno",
  "meet_oggi",
  "meet_domani",
  "meet_adesso",
  "promemoria_chiamata",
  "promemoria_sede",
];
const GIORNO = 86_400_000;
const U = "u-1";
const NS_PROM = "content-prom-1";
const NS_RIC = "content-ric-1";

export async function proveGiro(mod, { c, gruppo, radice }) {
  const G = mod["manychat/giro"];
  const A = mod["manychat/api"];
  const CT = mod["manychat/contatto"];

  /* ── il mondo finto ───────────────────────────────────────────────────── */
  const consenso = { si: true, il: "2026-10-01T09:00:00.000Z", da: "Giulia Demo" };
  const tel = (n) => `333 000 000${n}`;
  const cifre = (n) => `39333000000${n}`;
  const scheda = (id, n, extra) => ({
    id,
    userId: U,
    data: {
      nome: "Anna",
      cognome: "Prova",
      telefono: tel(n),
      consulenteId: "cons-1",
      okWhatsapp: consenso,
      ...extra,
    },
  });
  const meet = (id, n, extra) =>
    scheda(id, n, {
      stato: "appuntamento_fissato",
      dataMeeting: "2026-10-23",
      oraMeeting: "15:30",
      linkMeeting: "https://example.test/meetly/abc",
      ...extra,
    });
  const ric = (id, n, extra) =>
    scheda(id, n, { stato: "da_ricontattare", dataRicontatto: "2026-10-23", ...extra });
  const CONSULENTI = [
    {
      id: "cons-1",
      data: { nome: "Giulia Demo", attivo: true, faConsulente: true, faSetter: false },
    },
  ];
  const CONFIG = {
    userId: U,
    canale: "manychat",
    acceso: true,
    promemoria: true,
    ricontatti: true,
    //  le colonne di S2: spente di serie (il giro di prima resta identico)
    leadNuovo: false,
    giornoMeet: false,
    leadNuovoDal: null,
    stati: {},
    indirizzoSede: null,
    fraseModuloDal: null,
    tetti: {},
    flussi: { hgl_promemoria_meet: NS_PROM, hgl_ricontatto_consulenza: NS_RIC },
    primaAccensione: new Date(ADESSO - 30 * GIORNO).toISOString(),
    ultimaAccensione: new Date(ADESSO - 3 * GIORNO).toISOString(),
  };
  const giornoRoma = (ms) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date(ms));

  function mondo(o = {}) {
    const f =
      o.finto ??
      creaFinto({ orologio: creaOrologio(ADESSO), ritardoMs: o.ritardoMs ?? 0 }).su(
        "GET",
        PERCORSI.campi,
        esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]),
      );
    const orologio = f.orologio;
    const m = {
      f,
      orologio,
      config: { ...CONFIG, ...(o.config ?? {}) },
      giro: {
        lucchetto: null,
        di: null,
        prossimo: o.prossimo ?? null,
        falliti: o.falliti ?? 0,
        stato: o.stato ?? {},
        ultimoGiroIl: null,
      },
      invii: o.invii ?? [],
      schede: o.schede ?? [],
      stop: new Set(o.stop ?? []),
      messaggi: [],
      contattoLog: [],
      avvisi: [],
      eventi: [],
      spenti: [],
      annullati: [],
      fermoConfig: o.fermoConfig ?? null,
      /** per le prove: cosa succede subito dopo una prenotazione riuscita */
      dopoPrenota: o.dopoPrenota ?? null,
      /** per le prove: cosa succede quando parte sendFlow */
      dopoFlusso: o.dopoFlusso ?? null,
    };
    let nRiga = 0;
    const iso = (ms) => new Date(ms).toISOString();

    /** `manychat_prenota_giro`, passo per passo come l'SQL. */
    function prenotaModello(userId, p, tetti, intervallo) {
      m.eventi.push("prenota");
      if (o.guastoPrenota) throw { code: "XX000", message: `db giù per ${cifre(1)} Anna` };
      const ora = orologio.ms;
      //  1. (la riga del giro è bloccata) prenotato da più di 10' → incerto
      for (const r of m.invii)
        if (r.userId === userId && r.stato === "prenotato" && r.prenotatoMs < ora - 10 * MIN) {
          r.stato = "incerto";
          r.motivo ??= "prenotato_scaduto";
        }
      //  2. i tetti di oggi (Roma)
      const oggi = giornoRoma(ora);
      const contano = m.invii.filter(
        (r) =>
          r.userId === userId &&
          TIPI9.includes(r.tipo) &&
          ["prenotato", "inviato", "incerto"].includes(r.stato) &&
          giornoRoma(r.prenotatoMs) === oggi,
      );
      const abbassa = (v, costante) =>
        typeof v === "number" && v >= 0 ? Math.min(costante, v) : costante;
      let maxRic = abbassa(tetti.ricontatti, 20);
      const maxLn = abbassa(tetti.leadNuovi, 100);
      const maxTot = abbassa(tetti.totale, 100);
      //  la riserva di 30 posti per gli appuntamenti (S2)
      const riservato = ["primo_contatto", "richiamo_24h", "ritorno", "ricontatto"].includes(
        p.tipo,
      );
      const limite = riservato ? Math.max(0, maxTot - 30) : maxTot;
      const prima = m.config.primaAccensione ? Date.parse(m.config.primaAccensione) : ora;
      if (ora < prima + 7 * GIORNO) maxRic = Math.min(maxRic, 10);
      if (contano.length >= limite) return { motivo: "tetto_totale" };
      if (
        p.tipo === "ricontatto" &&
        contano.filter((r) => r.tipo === "ricontatto").length >= maxRic
      )
        return { motivo: "tetto_ricontatti" };
      if (
        ["primo_contatto", "richiamo_24h", "ritorno"].includes(p.tipo) &&
        contano.filter((r) => ["primo_contatto", "richiamo_24h", "ritorno"].includes(r.tipo))
          .length >= maxLn
      )
        return { motivo: "tetto_lead_nuovi" };
      //  3. STOP
      if (m.stop.has(p.telefono)) return { motivo: "stop" };
      //  4. pausa per contatto (mai saltato o fallito)
      if (
        m.invii.some(
          (r) =>
            r.userId === userId &&
            r.telefono === p.telefono &&
            ["prenotato", "inviato", "incerto"].includes(r.stato) &&
            (r.inviatoMs ?? r.prenotatoMs) > ora - 120_000,
        )
      )
        return { motivo: "pausa_contatto" };
      //  5. il ritmo, solo in lettura
      const COL_RITMO = ["ricontatto", "richiamo_24h"];
      if (COL_RITMO.includes(p.tipo) && m.giro.prossimo !== null && m.giro.prossimo > ora)
        return { motivo: "ritmo" };
      //  6. l'inserimento: la chiave unica è l'ultimo cancello
      if (p.chiave && m.invii.some((r) => r.chiave === p.chiave)) return { motivo: "gia_preso" };
      const riga = {
        id: `inv${++nRiga + m.invii.length}`,
        userId,
        leadId: p.leadId,
        tipo: p.tipo,
        chiave: p.chiave ?? null,
        telefono: p.telefono,
        stato: "prenotato",
        prenotatoMs: ora,
        flowNs: p.flowNs,
      };
      m.invii.push(riga);
      //  7. SOLO ORA il posto del ritmo
      const i = Math.max(27, Math.min(33, intervallo));
      //  S2: il ritmo lo prendono solo ricontatto e richiamo_24h
      if (COL_RITMO.includes(p.tipo)) m.giro.prossimo = ora + i * MIN;
      m.dopoPrenota?.(m, riga);
      return { id: riga.id };
    }

    /** `contatto_wa_aggiorna`, con le sue due guardie. */
    function aggiornaContattoModello(userId, leadId, cambio, seInvio) {
      const s = m.schede.find((x) => x.id === leadId && x.userId === userId);
      if (!s) return false;
      const prima = s.data.contattoWa;
      if (prima?.stato === "stop" && cambio.patch.da === "automatico") return false;
      if (seInvio !== undefined && seInvio !== null) {
        if ((prima?.invioId ?? "") !== seInvio) return false;
        if (cambio.patch.stato === "non_ha_risposto" && prima?.stato !== "in_attesa") return false;
      }
      s.data.contattoWa = CT.applicaCambio(prima, cambio);
      m.contattoLog.push({ leadId, stato: cambio.patch.stato });
      return true;
    }

    /** Le porte del giro. Più giri insieme = più `porte` sullo stesso mondo. */
    m.porte = () => {
      const di = Symbol("giro");
      const fetchSpia = async (url, init) => {
        const percorso = new URL(String(url)).pathname;
        m.eventi.push(`mc:${percorso}`);
        if (percorso === PERCORSI.flusso) m.dopoFlusso?.(m);
        return f.fetch(url, init);
      };
      const client = () =>
        o.senzaClient ? null : A.creaClient({ chiave: CHIAVE, fetch: fetchSpia, timeoutMs: 25 });
      let clientUnico;
      return {
        adesso: () => orologio.adesso(),
        caso: () => o.caso ?? 0.5,
        avviso: (x) => m.avvisi.push(x),
        prendiLucchetto: async () => {
          if (o.senzaMigrazione) return "senza_migrazione";
          if (m.giro.lucchetto !== null && m.giro.lucchetto > orologio.ms && !o.nessunLucchetto)
            return "occupato";
          m.giro.lucchetto = orologio.ms + 120_000;
          m.giro.di = di;
          m.eventi.push("lucchetto+");
          return "preso";
        },
        lasciaLucchetto: async () => {
          if (m.giro.di === di) {
            m.giro.lucchetto = null;
            m.giro.di = null;
            m.eventi.push("lucchetto-");
          }
        },
        leggiConfig: async () => m.fermoConfig ?? m.config,
        leggiGiro: async () => ({
          prossimoRicontattoDopo:
            m.giro.prossimo === null || o.snapshotVecchio ? null : iso(m.giro.prossimo),
          falliti: m.giro.falliti,
          stato: JSON.parse(JSON.stringify(m.giro.stato)),
        }),
        chiaveManychat: () => !o.senzaChiave,
        consulenti: async () => CONSULENTI,
        schede: async () =>
          m.schede
            .filter((s) => s.userId === U)
            .map((s) => structuredClone({ id: s.id, data: s.data })),
        schedeInAttesa: async () =>
          m.schede
            .filter((s) => s.data.contattoWa?.stato === "in_attesa")
            .map((s) => structuredClone({ id: s.id, data: s.data })),
        scheda: async (userId, id) => {
          if (o.guastoRilettura) throw { code: "XX004", message: `dato ${cifre(1)}` };
          const s = m.schede.find((x) => x.id === id && x.userId === userId);
          return s ? structuredClone({ id: s.id, data: s.data }) : null;
        },
        invii: async (userId, dal) =>
          m.invii
            .filter(
              (r) => !o.snapshotVecchio && r.userId === userId && r.prenotatoMs >= dal.getTime(),
            )
            .map((r) => ({
              telefono: r.telefono,
              tipo: r.tipo,
              stato: r.stato,
              prenotatoIl: iso(r.prenotatoMs),
              rispostaIl: r.rispostaIl ?? null,
              sbloccatoIl: r.sbloccatoIl ?? null,
              chiave: r.chiave,
            })),
        prenota: async (...a) => prenotaModello(...a),
        annulla: async (userId, id, motivo) => {
          m.annullati.push({ id, motivo });
          const r = m.invii.find((x) => x.id === id && x.userId === userId);
          if (r && ["prenotato", "fallito"].includes(r.stato)) {
            r.stato = "saltato";
            r.chiave = null;
            r.motivo = motivo;
          }
        },
        aggiornaContatto: async (...a) => aggiornaContattoModello(...a),
        porta: (userId, config) => {
          clientUnico ??= client();
          return {
            adesso: () => orologio.adesso(),
            client: () => clientUnico,
            flusso: async (modello) => config.flussi[modello] ?? null,
            prenota: async () => {
              throw new Error("la porta non deve prenotare da sola: lo fa il giro");
            },
            esito: async (id, patch) => {
              const r = m.invii.find((x) => x.id === id && x.userId === userId);
              if (!r || r.stato !== "prenotato") return;
              if ("stato" in patch) r.stato = patch.stato;
              if ("motivo" in patch) r.motivo = patch.motivo;
              if ("subscriber_id" in patch) r.subscriber_id = patch.subscriber_id;
              if ("inviato_il" in patch) r.inviatoMs = Date.parse(patch.inviato_il);
            },
            subscriberNoto: async (telefono) => {
              const r = [...m.invii]
                .reverse()
                .find((x) => x.telefono === telefono && x.subscriber_id);
              return r ? Number(r.subscriber_id) : null;
            },
            registra: async (x) => void m.messaggi.push(x),
            cloud: async () => {
              throw new Error("il giro non usa mai il Cloud");
            },
          };
        },
        spegni: async (motivo) => {
          m.config.acceso = false;
          m.spenti.push(motivo);
        },
        scriviGiro: async ({ ultimoGiroIl, falliti, stato }) => {
          m.giro.ultimoGiroIl = ultimoGiroIl.toISOString();
          m.giro.falliti = falliti;
          m.giro.stato = JSON.parse(JSON.stringify(stato));
        },
      };
    };
    m.giroOra = (prova = false) => G.giroManychat(m.porte(), { prova });
    m.riga = (tipo) => m.invii.filter((r) => r.tipo === tipo);
    m.flussi = () => f.chiamate.filter((x) => x.percorso === PERCORSI.flusso);
    return m;
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  LA CHIAVE DEL GIRO
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · LA CHIAVE DELLA ROTTA");
  {
    const PUB = "chiave-pubblicabile-finta";
    const ANON = "chiave-anon-finta";
    const v = (a, p = PUB, n = ANON) => G.chiaveGiroValida(a, p, n);
    c("Bearer <pubblicabile> passa", true, v(`Bearer ${PUB}`));
    c("Bearer <anon> passa", true, v(`Bearer ${ANON}`));
    c(
      "…con uno spazio finale o iniziale passa (trim)",
      [true, true],
      [v(`Bearer ${PUB} `), v(`  Bearer ${ANON}`)],
    );
    c("…anche se la chiave del Worker ha lo spazio in fondo", true, v(`Bearer ${PUB}`, `${PUB} `));
    c(
      "una stringa più lunga che CONTIENE la chiave non passa (niente includes)",
      [false, false, false],
      [v(`Bearer ${PUB}xyz`), v(`xx Bearer ${PUB}`), v(`Bearer ${PUB} ${ANON}`)],
    );
    c("senza «Bearer» non passa", false, v(PUB));
    c(
      "intestazione assente o vuota non passa",
      [false, false, false],
      [v(null), v(undefined), v("")],
    );
    c(
      "chiavi del Worker mancanti: «Bearer undefined» e «Bearer » non passano",
      [false, false],
      [v("Bearer undefined", undefined, undefined), v("Bearer ", "", "")],
    );
    c("una chiave sbagliata non passa", false, v("Bearer un-altra-chiave"));
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  I FERMI: il giro non fa niente e lo dice
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · QUANDO NON FA NIENTE");
  {
    let m = mondo({ schede: [meet("s1", 1)], senzaMigrazione: true });
    let e = await m.giroOra();
    c(
      "M2 non applicata → «senza_migrazione», nessuna chiamata",
      ["senza_migrazione", 0],
      [e.fermo, m.f.chiamate.length],
    );

    m = mondo({ schede: [meet("s1", 1)], fermoConfig: { fermo: "senza_migrazione" } });
    e = await m.giroOra();
    c(
      "M1 non applicata → «senza_migrazione», lucchetto lasciato",
      ["senza_migrazione", "lucchetto-"],
      [e.fermo, m.eventi.at(-1)],
    );

    m = mondo({ fermoConfig: { fermo: "senza_configurazione" } });
    c(
      "manychat_config senza user_id → «senza_configurazione»",
      "senza_configurazione",
      (await m.giroOra()).fermo,
    );

    m = mondo({ schede: [meet("s1", 1)], config: { canale: "cloud" } });
    e = await m.giroOra();
    c(
      "canale cloud → il giro di ManyChat non fa niente",
      ["canale", 0],
      [e.fermo, m.f.chiamate.length],
    );

    m = mondo({ schede: [meet("s1", 1)], config: { acceso: false } });
    e = await m.giroOra();
    c(
      "interruttore spento → nessuna chiamata, nessuna prenotazione",
      ["spento", 0, 0],
      [e.fermo, m.f.chiamate.length, m.invii.length],
    );
    c("…ma l'ora dell'ultimo giro si scrive (il cron gira)", true, m.giro.ultimoGiroIl !== null);

    m = mondo({ schede: [meet("s1", 1)], config: { promemoria: false, ricontatti: false } });
    c(
      "generale acceso ma i due interruttori spenti → «spento»",
      "spento",
      (await m.giroOra()).fermo,
    );

    m = mondo({ schede: [meet("s1", 1)], senzaChiave: true });
    e = await m.giroOra();
    c(
      "manca MANYCHAT_API_KEY → «senza_chiave», niente prenotato",
      ["senza_chiave", 0],
      [e.fermo, m.invii.length],
    );

    m = mondo({ schede: [meet("s1", 1)] });
    m.giro.lucchetto = ADESSO + 60_000;
    e = await m.giroOra();
    c(
      "lucchetto preso da un altro giro → esce subito",
      ["lucchetto", 0, 0],
      [e.fermo, m.f.chiamate.length, m.invii.length],
    );
    m.giro.lucchetto = ADESSO - 1;
    e = await m.giroOra();
    c(
      "lucchetto scaduto (il giro era morto) → si riprende e lavora",
      [undefined, 1],
      [e.fermo, e.promemoriInviati],
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  L'INVIO: prenotazione prima della chiamata, ordine, tag, secondo stato
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · UN PROMEMORIA, PASSO PER PASSO");
  {
    const m = mondo({ schede: [meet("s1", 1)] });
    const e = await m.giroOra();
    c(
      "un promemoria alle 15:06 per il meet delle 15:30 → inviato",
      [1, 0, 0],
      [e.promemoriInviati, e.ricontattiInviati, e.incerti],
    );
    const primaDiMc = m.eventi.indexOf("prenota") < m.eventi.findIndex((x) => x.startsWith("mc:"));
    c(
      "LA PRENOTAZIONE VIENE PRIMA DI OGNI CHIAMATA A MANYCHAT",
      true,
      primaDiMc && m.eventi.indexOf("prenota") > -1,
    );
    c("…e dopo il lucchetto", true, m.eventi.indexOf("lucchetto+") < m.eventi.indexOf("prenota"));
    const percorsi = m.f.percorsi();
    c(
      "l'ordine delle chiamate: contatto, campi, tag, sendFlow",
      [PERCORSI.campi, PERCORSI.perCampo, PERCORSI.scriviCampi, PERCORSI.tag, PERCORSI.flusso],
      percorsi,
    );
    const tag = m.f.chiamate.find((x) => x.percorso === PERCORSI.tag);
    c("il tag è «crm-promemoria»", "crm-promemoria", tag.corpo.tag_name);
    const campi = m.f.chiamate.find((x) => x.percorso === PERCORSI.scriviCampi).corpo;
    const nomiCampi = campi.fields.map((x) => x.field_name);
    const valoriCampi = Object.fromEntries(campi.fields.map((x) => [x.field_name, x.field_value]));
    c(
      "i campi: i quattro parametri del modello, nell'ordine di {{1}}…{{4}}",
      ["Anna", "15:30", "https://example.test/meetly/abc", "Giulia Demo"],
      [
        valoriCampi.crm_v1,
        valoriCampi.crm_v2,
        valoriCampi.crm_v3?.replace(/^https:\/\/[^/]+/, "https://example.test").split("?")[0],
        valoriCampi.crm_v4,
      ],
    );
    c(
      "…più crm_invio_id, crm_lead_id, crm_telefono",
      true,
      ["crm_invio_id", "crm_lead_id", "crm_telefono"].every((n) => nomiCampi.includes(n)),
    );
    c("sendFlow parte col flusso del promemoria", NS_PROM, m.flussi()[0].corpo.flow_ns);
    const riga = m.invii[0];
    c(
      "il registro: tipo promemoria, chiave p|tel9|data+ora, stato inviato",
      ["promemoria", `p|${cifre(1).slice(-9)}|2026-10-23T15:30`, "inviato"],
      [riga.tipo, riga.chiave, riga.stato],
    );
    const ct = m.schede[0].data.contattoWa;
    c(
      "il secondo stato: «In attesa», da automatico, sull'invio giusto",
      ["in_attesa", "automatico", riga.id],
      [ct.stato, ct.da, ct.invioId],
    );
    c(
      "…che scade all'ora del meet (15:30 Roma = 13:30Z)",
      "2026-10-23T13:30:00.000Z",
      ct.scadeRisposta,
    );
    c("…con una voce in storia", 1, ct.storia.length);
    c(
      "la riga in whatsapp_messages la scrive la porta, con la scheda",
      [1, "s1"],
      [m.messaggi.length, m.messaggi[0].leadId],
    );
    c(
      "il ritmo: il promemoria NON sposta più prossimo_ricontatto_dopo (S2, scelta del revisore)",
      null,
      m.giro.prossimo,
    );
    c(
      "lo stato per il riquadro: ultimo invio, oggi 1 promemoria",
      [new Date(ADESSO).toISOString(), 1, 0],
      [m.giro.stato.ultimoInvioIl, m.giro.stato.oggi.promemoria, m.giro.stato.oggi.ricontatti],
    );
    c(
      "falliti di fila a zero, ora del giro scritta, lucchetto lasciato",
      [0, true, null],
      [m.giro.falliti, !!m.giro.ultimoGiroIl, m.giro.lucchetto],
    );

    const dopo = await m.giroOra();
    c(
      "un secondo giro subito dopo: niente di nuovo (la chiave c'è già)",
      [0, 1],
      [dopo.promemoriInviati, m.flussi().length],
    );
  }

  gruppo("MANYCHAT · GIRO · UN RICONTATTO, E IL RITMO");
  {
    const m = mondo({ schede: [ric("r1", 2)], caso: 0 });
    const e = await m.giroOra();
    c(
      "un ricontatto di oggi alle 15:06 → inviato col flusso del ricontatto",
      [1, NS_RIC],
      [e.ricontattiInviati, m.flussi()[0].corpo.flow_ns],
    );
    c(
      "il tag è «crm-ricontatto»",
      "crm-ricontatto",
      m.f.chiamate.find((x) => x.percorso === PERCORSI.tag).corpo.tag_name,
    );
    c("chiave r|tel9|data", `r|${cifre(2).slice(-9)}|2026-10-23`, m.invii[0].chiave);
    const ct = m.schede[0].data.contattoWa;
    c(
      "«In attesa» con scadenza 24 h dopo (sabato 15:06 Roma = 13:06Z)",
      "2026-10-24T13:06:00.000Z",
      ct.scadeRisposta,
    );
    c(
      "intervallo con caso 0 → 27 minuti",
      new Date(ADESSO + 27 * MIN).toISOString(),
      new Date(m.giro.prossimo).toISOString(),
    );
    const m2 = mondo({ schede: [ric("r1", 2)], caso: 0.999 });
    await m2.giroOra();
    c(
      "intervallo con caso 0.999 → 33 minuti",
      new Date(ADESSO + 33 * MIN).toISOString(),
      new Date(m2.giro.prossimo).toISOString(),
    );
    const m3 = mondo({ schede: [ric("r1", 2)], caso: 99 });
    await m3.giroOra();
    c(
      "un caso fuori misura non esce da 27-33",
      new Date(ADESSO + 33 * MIN).toISOString(),
      new Date(m3.giro.prossimo).toISOString(),
    );

    //  Subito dopo un ricontatto, un altro è rifiutato dal ritmo (e non è un errore).
    const m4 = mondo({ schede: [ric("r1", 2), ric("r2", 3)] });
    const e4 = await m4.giroOra();
    c(
      "due ricontatti pronti: ne parte UNO per giro",
      [1, 1],
      [e4.ricontattiInviati, m4.flussi().length],
    );
    c(
      "…e il secondo non viene nemmeno prenotato",
      1,
      m4.eventi.filter((x) => x === "prenota").length,
    );
    m4.orologio.avanza(5 * MIN);
    const e5 = await m4.giroOra();
    c(
      "5 minuti dopo il secondo aspetta il ritmo: nessun invio, nessun errore, nessun blocco",
      [0, 0, false, 0],
      [e5.ricontattiInviati, e5.incerti, !!e5.spento, m4.spenti.length],
    );
    m4.orologio.avanza(30 * MIN);
    const e6 = await m4.giroOra();
    c("dopo 35 minuti tocca al secondo", 1, e6.ricontattiInviati);
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  AL MASSIMO 2 INVII PER GIRO
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · MAI PIÙ DI 2 INVII PER GIRO");
  {
    let m = mondo({ schede: [meet("s1", 1), meet("s2", 2), meet("s3", 3), meet("s4", 4)] });
    let e = await m.giroOra();
    c("4 promemoria pronti: ne partono 2", [2, 2], [e.promemoriInviati, m.flussi().length]);
    e = await m.giroOra();
    c("al giro dopo gli altri 2", [2, 4], [e.promemoriInviati, m.flussi().length]);

    m = mondo({ schede: [meet("s1", 1), meet("s2", 2), ric("r1", 3)] });
    e = await m.giroOra();
    c(
      "2 promemoria + 1 ricontatto: prima i promemoria, il ricontatto aspetta",
      [2, 0],
      [e.promemoriInviati, e.ricontattiInviati],
    );

    m = mondo({ schede: [meet("s1", 1), ric("r1", 3), ric("r2", 4)] });
    e = await m.giroOra();
    c(
      "1 promemoria + 2 ricontatti: partono il promemoria e UN ricontatto (il promemoria non prende più il ritmo)",
      [1, 1, 2],
      [e.promemoriInviati, e.ricontattiInviati, m.flussi().length],
    );
    m = mondo({ schede: [meet("s1", 1, { stato: "venduto" }), ric("r1", 3), ric("r2", 4)] });
    e = await m.giroOra();
    c(
      "senza promemoria: 2 ricontatti pronti → ne parte UNO (mai due ricontatti per giro)",
      [0, 1, 1],
      [e.promemoriInviati, e.ricontattiInviati, m.flussi().length],
    );

    //  Dopo 20 secondi dall'inizio non se ne apre un altro: ogni chiamata dura 5 s,
    //  un invio ne fa 5 (contatto 2, campi, tag, flusso) → 25 s.
    m = mondo({ schede: [meet("s1", 1), meet("s2", 2)], ritardoMs: 5000 });
    e = await m.giroOra();
    c(
      "ManyChat lento (5 s a chiamata): dopo 20 s non ne apre un altro",
      [1, 1],
      [e.promemoriInviati, m.flussi().length],
    );
    m = mondo({ schede: [meet("s1", 1), meet("s2", 2)], ritardoMs: 3000 });
    e = await m.giroOra();
    c(
      "ManyChat a 3 s a chiamata: il secondo parte (15 s < 20 s) e il giro finisce prima dei 45 s",
      [2, true],
      [e.promemoriInviati, m.orologio.ms - ADESSO < 45_000],
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  DUE GIRI INSIEME → UN INVIO
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · DUE GIRI INSIEME, UN SOLO INVIO");
  {
    let m = mondo({ schede: [meet("s1", 1)] });
    let [a, b] = await Promise.all([m.giroOra(), m.giroOra()]);
    c(
      "col lucchetto: uno lavora, l'altro esce",
      [1, "lucchetto", 1],
      [
        a.promemoriInviati + b.promemoriInviati,
        [a, b].find((x) => x.fermo)?.fermo,
        m.flussi().length,
      ],
    );

    //  Senza lucchetto (scaduto per sbaglio): la chiave unica regge da sola.
    m = mondo({ schede: [meet("s1", 1)], nessunLucchetto: true });
    [a, b] = await Promise.all([m.giroOra(), m.giroOra()]);
    c(
      "senza lucchetto: la chiave unica fa passare un solo invio",
      [1, 1, 1],
      [a.promemoriInviati + b.promemoriInviati, m.flussi().length, m.invii.length],
    );

    //  Due schede con lo stesso telefono: un solo promemoria e un solo ricontatto.
    m = mondo({ schede: [meet("s1", 1), meet("s2", 1)] });
    await m.giroOra();
    c("due schede con lo stesso telefono e lo stesso meet → un invio", 1, m.flussi().length);
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  ERRORI: falliti di fila, blocco, incerto, lento
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · ERRORI, BLOCCHI, ESITI INCERTI");
  {
    //  Chiave rifiutata → spento subito, col motivo.
    let m = mondo({ schede: [meet("s1", 1)] });
    m.f.su("POST", PERCORSI.flusso, esiti.nonAutorizzato());
    let e = await m.giroOra();
    c(
      "401 su sendFlow → interruttore spento col motivo",
      [true, 1, false],
      [e.spento, m.spenti.length, m.config.acceso],
    );
    c(
      "…il motivo è in chiaro e senza numero né chiave",
      true,
      /rifiutato/.test(m.spenti[0]) && !/3330|chiave-finta/.test(m.spenti[0]),
    );
    c("…e il giro dopo non fa niente (spento)", "spento", (await m.giroOra()).fermo);

    //  Rete giù su sendFlow → incerto; due di fila → spento.
    m = mondo({ schede: [meet("s1", 1), meet("s2", 2)] });
    m.f.su("POST", PERCORSI.flusso, esiti.reteGiu());
    e = await m.giroOra();
    c(
      "rete giù su sendFlow → «incerto», la riga resta «prenotato»",
      [1, "prenotato", 1],
      [e.incerti, m.invii[0].stato, m.flussi().length],
    );
    c("…e il giro non ne apre un altro (ce n'era un secondo pronto)", 1, m.invii.length);
    c(
      "…il secondo stato della scheda non si tocca (non si sa com'è andata)",
      undefined,
      m.schede[0].data.contattoWa,
    );
    c("…un fallito di fila, non ancora spento", [1, true], [m.giro.falliti, m.config.acceso]);
    m.orologio.avanza(3 * MIN);
    e = await m.giroOra();
    c(
      "secondo incerto di fila → SPENTO col motivo",
      [true, false, 0],
      [e.spento, m.config.acceso, m.giro.falliti],
    );
    c(
      "…il motivo dice «2 invii falliti di fila»",
      true,
      /2 invii falliti di fila/.test(m.spenti[0]),
    );
    c(
      "…e la riga del primo non è stata rimandata (una sola chiamata a sendFlow per scheda)",
      [1, 1],
      [
        m.invii.filter((r) => r.leadId === "s1").length,
        m.invii.filter((r) => r.leadId === "s2").length,
      ],
    );

    //  Un 4xx diverso da 401/403/429 è quasi sempre UN contatto: non spegne al primo.
    m = mondo({ schede: [meet("s1", 1), meet("s2", 2)] });
    m.f.su("POST", PERCORSI.flusso, esiti.modelloRifiutato());
    e = await m.giroOra();
    c(
      "400 su sendFlow (un contatto rotto) → NON spegne al primo: un fallito di fila",
      [false, true, 1],
      [!!e.spento, m.config.acceso, m.giro.falliti],
    );
    c(
      "…la riga è «fallito» con la chiave (non si rimanda) e il motivo è un codice",
      ["fallito", true],
      [m.invii[0].stato, /http_400/.test(JSON.stringify(m.giro.stato.problemi))],
    );
    m.orologio.avanza(3 * MIN);
    e = await m.giroOra();
    c(
      "…al secondo di fila SÌ: spento col motivo dei 2 falliti",
      [true, false, true],
      [e.spento, m.config.acceso, /2 invii falliti di fila/.test(m.spenti[0])],
    );
    for (const [http, nome] of [
      [401, "401"],
      [403, "403"],
      [429, "429"],
    ]) {
      m = mondo({ schede: [meet("s1", 1)] });
      m.f.su("POST", PERCORSI.flusso, esiti.errore(http));
      e = await m.giroOra();
      c(`${nome} su sendFlow → spegne subito`, [true, false], [e.spento, m.config.acceso]);
    }
    m = mondo({ schede: [meet("s1", 1)], guastoPrenota: true });
    e = await m.giroOra();
    c(
      "registro che non risponde → spegne subito (blocco di configurazione)",
      [true, false],
      [e.spento, m.config.acceso],
    );
    c(
      "bloccoImmediato: 401, 403, 429, nessun codice e codici nostri sì; 400, 404, 422 no",
      [true, true, true, true, true, false, false, false],
      [
        G.bloccoImmediato("http_401"),
        G.bloccoImmediato("http_403_3001"),
        G.bloccoImmediato("http_429"),
        G.bloccoImmediato(undefined),
        G.bloccoImmediato("registro"),
        G.bloccoImmediato("http_400"),
        G.bloccoImmediato("http_404"),
        G.bloccoImmediato("http_422_2002"),
      ],
    );

    //  La rilettura della scheda dà errore: la riga si annulla, il giro si ferma, niente si spegne.
    m = mondo({ schede: [meet("s1", 1), meet("s2", 2)], guastoRilettura: true });
    e = await m.giroOra();
    c(
      "rilettura in errore → nessuna chiamata a ManyChat, riga «saltato» senza chiave",
      [0, "saltato", null],
      [m.f.chiamate.length, m.invii[0].stato, m.invii[0].chiave],
    );
    c(
      "…il giro si ferma lì (una sola prenotazione) e non spegne niente",
      [1, true, false],
      [m.invii.length, m.config.acceso, !!e.spento],
    );
    c(
      "…l'avviso porta il codice, mai il numero",
      [true, false],
      [/XX004/.test(m.avvisi.join(" ")), m.avvisi.join(" ").includes("3930")],
    );

    //  Un invio che va bene azzera i falliti.
    m = mondo({ schede: [meet("s1", 1)], falliti: 1 });
    await m.giroOra();
    c("un invio riuscito azzera i falliti di fila", 0, m.giro.falliti);

    //  Il contatto non risponde PRIMA dell'invio: certo che non è partito niente.
    m = mondo({ schede: [meet("s1", 1)] });
    m.f.su("GET", PERCORSI.perCampo, esiti.reteGiu());
    e = await m.giroOra();
    c(
      "la ricerca del contatto non risponde → niente sendFlow, niente «incerto»",
      [0, 0, true],
      [m.flussi().length, e.incerti, m.config.acceso],
    );
    c(
      "…la riga perde la chiave (saltato) e conta un fallito",
      ["saltato", null, 1],
      [m.invii[0].stato, m.invii[0].chiave, m.giro.falliti],
    );
    c(
      "…il giro dopo riprova e ce la fa",
      1,
      (
        await (async () => {
          m.f.su(
            "GET",
            PERCORSI.perCampo,
            esiti.successo([
              {
                id: 1000001,
                first_name: "Anna",
                whatsapp_phone: "+393330000001",
                optin_whatsapp: true,
                subscribed: true,
                custom_fields: [],
                tags: [],
              },
            ]),
          );
          m.orologio.avanza(3 * MIN);
          return m.giroOra();
        })()
      ).promemoriInviati,
    );
    c("…e i falliti tornano a zero", 0, m.giro.falliti);

    //  ManyChat lento oltre il tempo → prenotato, poi incerto dopo 10', nessun nuovo invio.
    m = mondo({ schede: [meet("s1", 1), meet("s2", 2), meet("s3", 3, { oraMeeting: "15:40" })] });
    m.f.su("POST", PERCORSI.flusso, esiti.lento());
    e = await m.giroOra();
    c(
      "sendFlow lento oltre il tempo → incerto, riga «prenotato», nessun secondo invio",
      [1, "prenotato", 1],
      [e.incerti, m.invii[0].stato, m.invii.length],
    );
    m.f.su("POST", PERCORSI.flusso, esiti.successo({}));
    m.orologio.avanza(11 * MIN);
    await m.giroOra();
    c(
      "…dopo 10' diventa «incerto» (alla prenotazione dopo) e non si rimanda mai",
      ["incerto", 1],
      [m.invii[0].stato, m.invii.filter((r) => r.leadId === "s1").length],
    );

    //  Il contatto è da collegare / il numero non è su WhatsApp.
    m = mondo({ schede: [meet("s1", 1)] });
    m.f.scenario("assente");
    m.f.su("POST", PERCORSI.campi.replace("getCustomFields", "x"), esiti.successo({}));
    m.f.su("POST", PERCORSI.crea, esiti.errore(400, "Subscriber already exists"));
    e = await m.giroOra();
    c(
      "contatto non creabile → «Non raggiungibile» con il motivo, nessun blocco",
      [true, "non_raggiungibile", "contatto ManyChat da collegare", true],
      [
        e.saltati === 1,
        m.schede[0].data.contattoWa?.stato,
        m.schede[0].data.contattoWa?.motivo,
        m.config.acceso,
      ],
    );
    c(
      "…la riga resta «fallito» con la chiave (un rifiuto vero non si riprova)",
      ["fallito", true],
      [m.invii[0].stato, !!m.invii[0].chiave],
    );
    c(
      "…compare fra gli ultimi problemi (nome abbreviato)",
      ["Anna P.", "promemoria"],
      [m.giro.stato.problemi[0]?.nome, m.giro.stato.problemi[0]?.tipo],
    );
    m.orologio.avanza(3 * MIN);
    const flussiPrima = m.flussi().length;
    await m.giroOra();
    c("…e il giro dopo non ci riprova", [flussiPrima, 1], [m.flussi().length, m.invii.length]);
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  FRENI: tetti, ritmo, pausa, STOP, scheda cambiata
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · TETTI, PAUSA, STOP E SCHEDA CAMBIATA");
  {
    const riga = (n, tipo, extra) => ({
      id: `v${n}`,
      userId: U,
      leadId: null,
      tipo,
      chiave: `x|${n}`,
      telefono: `3930000${String(n).padStart(5, "0")}`,
      stato: "inviato",
      prenotatoMs: ADESSO - 60 * MIN,
      ...extra,
    });
    //  Tetto totale: 150 messaggi automatici oggi (era 40, S2; 100 fino al 28/10).
    let m = mondo({
      schede: [meet("s1", 1)],
      invii: Array.from({ length: 150 }, (_, i) => riga(i, i % 2 ? "ricontatto" : "promemoria")),
    });
    let e = await m.giroOra();
    c(
      "150 messaggi oggi → il 151° non parte (tetto totale)",
      [0, 0],
      [e.promemoriInviati, m.flussi().length],
    );
    c(
      "…lo dice fra i problemi («tetto…»), senza spegnere nulla",
      [true, true],
      [/tetto/.test(m.giro.stato.problemi[0]?.motivo ?? ""), m.config.acceso],
    );

    //  Il tetto vero lo decide l'SQL, anche se il giro aveva un registro vecchio.
    m = mondo({
      schede: [meet("s1", 1)],
      invii: Array.from({ length: 100 }, (_, i) => riga(i, "promemoria")),
      snapshotVecchio: true,
    });
    e = await m.giroOra();
    c(
      "registro letto vecchio: la prenotazione rifiuta lo stesso (tetto_totale) e non chiama ManyChat",
      [0, 0, true],
      [e.promemoriInviati, m.f.chiamate.length, /Tetto/.test(m.giro.stato.nota ?? "")],
    );
    m = mondo({ schede: [ric("r1", 3)], prossimo: ADESSO + 10 * MIN, snapshotVecchio: true });
    e = await m.giroOra();
    c(
      "ritmo non passato per l'SQL, anche se il giro non lo sapeva → nessun invio, nessun errore",
      [0, 0, true],
      [e.ricontattiInviati, m.flussi().length, m.config.acceso],
    );
    c("…e il rifiuto non consuma il posto del ritmo", ADESSO + 10 * MIN, m.giro.prossimo);

    //  Il decisore puro legge gli stessi conteggi: il tetto è già visto prima della prenotazione.
    //  Tetto dei ricontatti: 20 (riquadro a 500).
    m = mondo({
      schede: [ric("r1", 9)],
      config: { tetti: { ricontatti: 500 } },
      invii: Array.from({ length: 20 }, (_, i) =>
        riga(i, "ricontatto", { prenotatoMs: ADESSO - (60 + i) * MIN }),
      ),
      prossimo: ADESSO - MIN,
    });
    e = await m.giroOra();
    c(
      "20 ricontatti oggi (riquadro a 500 → vale 20) → il 21° non parte",
      [0, 0],
      [e.ricontattiInviati, m.flussi().length],
    );

    //  Prima settimana: 10 ricontatti, decisa dall'SQL da prima_accensione.
    m = mondo({
      schede: [ric("r1", 9)],
      config: { primaAccensione: new Date(ADESSO - 3 * GIORNO).toISOString() },
      invii: Array.from({ length: 10 }, (_, i) =>
        riga(i, "ricontatto", { prenotatoMs: ADESSO - (60 + i) * MIN }),
      ),
    });
    e = await m.giroOra();
    c("prima settimana: l'11° ricontatto di oggi non parte", 0, e.ricontattiInviati);
    m = mondo({
      schede: [ric("r1", 9)],
      config: { primaAccensione: new Date(ADESSO - 3 * GIORNO).toISOString() },
      invii: Array.from({ length: 9 }, (_, i) =>
        riga(i, "ricontatto", { prenotatoMs: ADESSO - (60 + i) * MIN }),
      ),
    });
    c("…il 10° sì", 1, (await m.giroOra()).ricontattiInviati);

    //  I promemoria contano nel totale ma non nel tetto dei ricontatti.
    m = mondo({
      schede: [ric("r1", 9)],
      invii: Array.from({ length: 10 }, (_, i) =>
        riga(i, "promemoria", { prenotatoMs: ADESSO - (60 + i) * MIN }),
      ),
      config: { primaAccensione: new Date(ADESSO - 3 * GIORNO).toISOString() },
    });
    c(
      "10 promemoria oggi non riempiono il tetto dei ricontatti",
      1,
      (await m.giroOra()).ricontattiInviati,
    );

    //  Pausa per contatto: un invio allo stesso telefono due minuti fa → si passa al prossimo.
    m = mondo({
      schede: [meet("s1", 1), meet("s2", 2)],
      invii: [
        riga(1, "conferma", { telefono: cifre(1), prenotatoMs: ADESSO - 60_000, chiave: "c|k|g" }),
      ],
    });
    e = await m.giroOra();
    c(
      "pausa per contatto sul primo → parte il secondo, il primo aspetta",
      [1, "s2"],
      [e.promemoriInviati, m.invii.at(-1).leadId],
    );
    c(
      "…la pausa non spegne niente e non conta come errore",
      [true, 0],
      [m.config.acceso, m.giro.falliti],
    );

    //  Una riga «saltato» o «fallito» recente non mette in pausa.
    m = mondo({
      schede: [meet("s1", 1)],
      invii: [
        riga(1, "chat", {
          telefono: cifre(1),
          stato: "saltato",
          chiave: null,
          prenotatoMs: ADESSO - 30_000,
        }),
      ],
    });
    c(
      "un «saltato» di 30 s fa non mette in pausa il telefono",
      1,
      (await m.giroOra()).promemoriInviati,
    );

    //  STOP in whatsapp_contacts ma non sulla scheda.
    m = mondo({ schede: [meet("s1", 1), meet("s2", 2)], stop: [cifre(1)] });
    e = await m.giroOra();
    c(
      "numero in STOP (rubrica): non parte, la scheda va in STOP, parte il secondo",
      [1, "stop", "s2"],
      [e.promemoriInviati, m.schede[0].data.contattoWa?.stato, m.invii.at(-1).leadId],
    );
    const righeDopoStop = m.invii.length;
    m.orologio.avanza(3 * MIN);
    await m.giroOra();
    c(
      "…il giro dopo non ci riprova (la scheda dice STOP: nessuna nuova prenotazione per lei)",
      0,
      m.invii.slice(righeDopoStop).filter((r) => r.leadId === "s1").length,
    );

    //  Scheda cambiata fra la prenotazione e la chiamata.
    m = mondo({
      schede: [meet("s1", 1)],
      dopoPrenota: (mm) => {
        mm.schede[0].data.oraMeeting = "17:00";
      },
    });
    e = await m.giroOra();
    c(
      "meet spostato dopo la prenotazione → nessuna chiamata a ManyChat",
      [0, 1],
      [m.f.chiamate.length, e.saltati],
    );
    c(
      "…la riga diventa «saltato», SENZA chiave, con il motivo",
      ["saltato", null, "scheda_cambiata"],
      [m.invii[0].stato, m.invii[0].chiave, m.invii[0].motivo],
    );
    m.dopoPrenota = null;
    m.schede[0].data.oraMeeting = "15:30";
    m.orologio.avanza(3 * MIN);
    c(
      "…e il recupero col meet vero trova la chiave libera",
      1,
      (await m.giroOra()).promemoriInviati,
    );

    m = mondo({
      schede: [meet("s1", 1)],
      dopoPrenota: (mm) => {
        mm.schede[0].data.okWhatsapp = { si: false };
      },
    });
    e = await m.giroOra();
    c(
      "consenso revocato dopo la prenotazione → non parte",
      [0, "saltato"],
      [m.f.chiamate.length, m.invii[0].stato],
    );

    //  STOP messo da una persona mentre ManyChat lavora: «In attesa» non lo copre.
    m = mondo({
      schede: [meet("s1", 1)],
      dopoFlusso: (mm) => {
        mm.schede[0].data.contattoWa = {
          stato: "stop",
          il: new Date(ADESSO).toISOString(),
          da: "Sara Demo",
          storia: [],
        };
      },
    });
    e = await m.giroOra();
    c(
      "STOP messo a mano durante l'invio → il messaggio è partito ma lo STOP resta",
      [1, "stop"],
      [e.promemoriInviati, m.schede[0].data.contattoWa.stato],
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  FLUSSO MANCANTE, SCADENZE, PROBLEMI
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · FLUSSO MANCANTE, «NON HA RISPOSTO», PROBLEMI");
  {
    let m = mondo({ schede: [meet("s1", 1)], config: { flussi: {} } });
    let e = await m.giroOra();
    c(
      "nessun flusso collegato → nessuna prenotazione, nessuna chiamata, la nota lo dice",
      [0, 0, true],
      [m.invii.length, m.f.chiamate.length, /flusso/.test(m.giro.stato.nota ?? "")],
    );
    c("…e non spegne l'interruttore (è una configurazione, non un blocco)", true, m.config.acceso);
    m = mondo({
      schede: [meet("s1", 1), ric("r1", 2)],
      config: { flussi: { hgl_promemoria_meet: NS_PROM } },
    });
    e = await m.giroOra();
    c(
      "manca solo il flusso del ricontatto → il promemoria parte lo stesso",
      [1, 0],
      [e.promemoriInviati, e.ricontattiInviati],
    );

    //  «Non ha risposto» sulle schede scadute.
    const inAttesa = (id, n, scade, invioId) =>
      scheda(id, n, {
        stato: "da_ricontattare",
        contattoWa: {
          stato: "in_attesa",
          il: new Date(ADESSO - 25 * 3600_000).toISOString(),
          da: "automatico",
          motivo: "ricontatto",
          scadeRisposta: scade,
          invioId,
          storia: [],
        },
      });
    m = mondo({
      schede: [
        inAttesa("a1", 5, new Date(ADESSO - MIN).toISOString(), "inv-x"),
        inAttesa("a2", 6, new Date(ADESSO + 60 * MIN).toISOString(), "inv-y"),
      ],
      config: { acceso: true },
    });
    e = await m.giroOra();
    c(
      "un'attesa scaduta → «Non ha risposto» nella storia; quella non scaduta resta",
      [1, "non_ha_risposto", "in_attesa"],
      [e.scadute, m.schede[0].data.contattoWa.stato, m.schede[1].data.contattoWa.stato],
    );
    c(
      "…con la scadenza come ora, firmato dall'automatico",
      [new Date(ADESSO - MIN).toISOString(), "automatico"],
      [m.schede[0].data.contattoWa.il, m.schede[0].data.contattoWa.da],
    );
    e = await m.giroOra();
    c(
      "…al giro dopo non lo riscrive (una sola voce)",
      [0, 1],
      [e.scadute, m.schede[0].data.contattoWa.storia.length],
    );
    m = mondo({ schede: [inAttesa("a1", 5, new Date(ADESSO - MIN).toISOString(), "inv-x")] });
    m.schede[0].data.contattoWa.invioId = "inv-nuovo";
    // la scheda letta dal giro ha già l'invio nuovo: si applica a quello. Qui simulo la gara: cambia fra lettura e scrittura.
    const portePiene = m.porte();
    const originale = portePiene.schedeInAttesa;
    portePiene.schedeInAttesa = async () => {
      const lette = await originale();
      m.schede[0].data.contattoWa.invioId = "inv-altro"; // un nuovo invio arriva dopo la lettura
      return lette;
    };
    e = await G.giroManychat(portePiene, { prova: false });
    c(
      "l'invio è cambiato fra lettura e scrittura → «Non ha risposto» NON si scrive",
      [0, "in_attesa"],
      [e.scadute, m.schede[0].data.contattoWa.stato],
    );

    //  I problemi: una volta sola per scheda e motivo.
    m = mondo({ schede: [meet("s1", 1, { okWhatsapp: { si: false } })] });
    await m.giroOra();
    await m.giroOra();
    await m.giroOra();
    c(
      "consenso revocato: il problema è scritto UNA volta sola in tre giri",
      [1, "Anna P.", "promemoria", "manca il consenso WhatsApp"],
      [
        m.giro.stato.problemi.length,
        m.giro.stato.problemi[0]?.nome,
        m.giro.stato.problemi[0]?.tipo,
        m.giro.stato.problemi[0]?.motivo,
      ],
    );
    m = mondo({
      schede: Array.from({ length: 25 }, (_, i) =>
        meet(`s${i}`, i % 10, {
          okWhatsapp: undefined,
          telefono: `333 000 ${String(i).padStart(4, "0")}`,
        }),
      ),
    });
    await m.giroOra();
    c("al massimo 20 problemi", true, m.giro.stato.problemi.length <= 20);
    m = mondo({
      schede: [
        meet("s1", 1, {
          contattoWa: {
            stato: "stop",
            il: "2026-10-22T10:00:00.000Z",
            da: "Sara Demo",
            storia: [],
          },
        }),
      ],
    });
    await m.giroOra();
    c("STOP non è un problema da mostrare", 0, m.giro.stato.problemi.length);
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  LA PROVA A SECCO
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · PROVA A SECCO: ZERO CHIAMATE, ZERO SCRITTURE");
  {
    const schede = [
      meet("s1", 1),
      meet("s2", 2, { okWhatsapp: { si: false } }),
      ric("r1", 3),
      inAttesaScaduta(),
    ];
    function inAttesaScaduta() {
      return scheda("a1", 5, {
        stato: "da_ricontattare",
        contattoWa: {
          stato: "in_attesa",
          il: new Date(ADESSO - 25 * 3600_000).toISOString(),
          da: "automatico",
          scadeRisposta: new Date(ADESSO - MIN).toISOString(),
          invioId: "inv-x",
          storia: [],
        },
      });
    }
    const m = mondo({ schede, config: { acceso: false } });
    const prima = JSON.stringify([m.invii, m.schede, m.giro, m.config]);
    const e = await m.giroOra(true);
    c("zero chiamate a ManyChat", 0, m.f.chiamate.length);
    c(
      "zero scritture: registro, schede, giro e configurazione identici",
      prima,
      JSON.stringify([m.invii, m.schede, m.giro, m.config]),
    );
    c(
      "nessun lucchetto, nessuna prenotazione",
      [false, false],
      [m.eventi.includes("lucchetto+"), m.eventi.includes("prenota")],
    );
    c(
      "…nemmeno il tentativo di scrivere un contatto o un messaggio",
      [0, 0, 0],
      [m.contattoLog.length, m.messaggi.length, m.spenti.length],
    );
    c("serve anche con l'interruttore spento (si vede PRIMA di accendere)", undefined, e.fermo);
    const righe = e.righe;
    c(
      "le righe: chi scriverebbe, chi aspetta, chi si salta e perché (nome abbreviato)",
      [
        { nome: "Anna P.", tipo: "promemoria", esito: "scriverebbe" },
        {
          nome: "Anna P.",
          tipo: "promemoria",
          esito: "salta",
          motivo: "manca il consenso WhatsApp",
        },
        { nome: "Anna P.", tipo: "ricontatto", esito: "scriverebbe" },
      ],
      righe
        .filter((r) => ["promemoria", "ricontatto"].includes(r.tipo))
        .map((r) => ({
          nome: r.nome,
          tipo: r.tipo,
          esito: r.esito,
          ...(r.esito === "salta" ? { motivo: r.motivo } : {}),
        })),
    );
    c("le righe non contengono mai il telefono", false, /333000|3930/.test(JSON.stringify(e)));

    //  Anche con la chiave mancante e senza lucchetto libero: la prova non dipende da niente.
    const m2 = mondo({ schede, senzaChiave: true });
    m2.giro.lucchetto = ADESSO + 60_000;
    c(
      "la prova a secco non guarda lucchetto né chiave",
      true,
      (await m2.giroOra(true)).righe.length > 0,
    );

    //  Col canale ancora `cloud` la prova mostra cosa farebbe, il giro vero no.
    const mc = mondo({ schede, config: { canale: "cloud" } });
    const ec = await mc.giroOra(true);
    c(
      "prova a secco col canale cloud: mostra le righe, senza chiamate né scritture",
      [true, 0],
      [ec.righe?.length > 0 && !ec.fermo, mc.f.chiamate.length],
    );
    c(
      "…il giro VERO col canale cloud continua a non fare niente",
      ["canale", 0],
      [(await mc.giroOra()).fermo, mc.f.chiamate.length],
    );

    //  Un ricontatto che ha già il ritmo davanti: la prova lo dice.
    const m3 = mondo({ schede: [ric("r1", 3)], prossimo: ADESSO + 10 * MIN });
    const e3 = await m3.giroOra(true);
    c(
      "prova con il ritmo non ancora passato → «aspetta»",
      ["aspetta", true],
      [e3.righe[0].esito, /ritmo/.test(e3.righe[0].motivo)],
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  I TIPI NUOVI (commessa 2026-10-25, S2): sequenze, stati, ritmo, riserva
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · SEQUENZE E MESSAGGI PER STATO");
  {
    const NS = {
      hgl_primo_contatto: "content-n1",
      hgl_richiamo_24h: "content-n2",
      hgl_meet_oggi: "content-m1",
      hgl_meet_adesso: "content-m2",
      hgl_meet_domani: "content-m3",
      hgl_non_risponde: "content-s1",
      hgl_cliente_assente: "content-s2",
      hgl_promemoria_sede: "content-s3",
      hgl_richiamo_concordato: "content-s4",
    };
    const FRASE = "2026-10-01T00:00:00.000Z";
    const accesa = {
      leadNuovo: true,
      giornoMeet: true,
      leadNuovoDal: "2026-10-20T00:00:00.000Z",
      fraseModuloDal: FRASE,
      indirizzoSede: "Via Prova 1, Roma",
      flussi: { ...CONFIG.flussi, ...NS },
    };
    //  un lead del modulo Meta, entrato oggi alle 14:00 Roma (12:00Z)
    const lead = (id, n, extra) =>
      scheda(id, n, {
        okWhatsapp: undefined,
        stato: "da_contattare",
        consulenteId: undefined,
        consensoModulo: { whatsapp: true, il: "2026-10-23T09:00:00.000Z", via: "modulo_meta" },
        origineIngresso: { via: "google_sheets", foglio: "Lead", il: "2026-10-23T11:00:00.000Z" },
        ...extra,
      });
    const riga = (n, tipo, extra) => ({
      id: `v${n}`,
      userId: U,
      leadId: null,
      tipo,
      chiave: `x|${n}|${tipo}`,
      telefono: `3930000${String(n).padStart(5, "0")}`,
      stato: "inviato",
      prenotatoMs: ADESSO - 60 * MIN,
      ...extra,
    });

    //  primo contatto: flusso, tag, variabile, secondo stato, e il ritmo non si muove
    let m = mondo({ schede: [lead("n1", 1)], config: accesa });
    let e = await m.giroOra();
    c(
      "primo contatto: inviato col suo flusso, il suo tag e il solo nome",
      [1, "content-n1", "crm-primo-contatto", "Anna"],
      [
        e.nuoviInviati,
        m.flussi()[0]?.corpo.flow_ns,
        m.f.chiamate.find((x) => x.percorso === PERCORSI.tag)?.corpo.tag_name,
        m.f.chiamate
          .find((x) => x.percorso === PERCORSI.scriviCampi)
          ?.corpo.fields.find((x) => x.field_name === "crm_v1")?.field_value,
      ],
    );
    c(
      "…registro: tipo primo_contatto, chiave n|tel9; «In attesa»; il ritmo NON si sposta",
      ["primo_contatto", `n|${cifre(1).slice(-9)}`, "in_attesa", null],
      [m.invii[0].tipo, m.invii[0].chiave, m.schede[0].data.contattoWa.stato, m.giro.prossimo],
    );
    //  senza il suo interruttore o senza la data della frase: niente
    m = mondo({ schede: [lead("n1", 1)], config: { ...accesa, leadNuovo: false } });
    c("«Lead nuovo» spento → zero invii", 0, (await m.giroOra()).nuoviInviati);
    m = mondo({ schede: [lead("n1", 1)], config: { ...accesa, fraseModuloDal: null } });
    c(
      //  dal 28/10 ogni lead «da contattare» mai scritto riceve il primo contatto (decisione
      //  del titolare): senza la data della frase parte lo stesso, una volta sola.
      "senza la data della frase: parte lo stesso (tutti i «da contattare», 28/10)",
      1,
      (await m.giroOra()).nuoviInviati,
    );
    //  flusso mancante di un tipo: si ferma solo quello
    m = mondo({
      schede: [lead("n1", 1), meet("s1", 2)],
      config: { ...accesa, flussi: { ...accesa.flussi, hgl_primo_contatto: undefined } },
    });
    e = await m.giroOra();
    c(
      "manca il flusso del primo contatto → parte il promemoria, la nota lo dice",
      [1, 0, true],
      [e.promemoriInviati, e.nuoviInviati, /hgl_primo_contatto/.test(m.giro.stato.nota ?? "")],
    );

    //  meet alle 15:30: all'ora esatta col link; la mattina
    const alle = (hm) => Date.parse(`2026-10-23T${hm}:00+02:00`);
    m = mondo({ schede: [meet("s1", 1, { oraMeeting: "15:06" })], config: accesa });
    e = await m.giroOra();
    c(
      "all'ora esatta (15:06 = inizio del meet) parte meet_adesso, senza ritmo e «Contattato» senza scadenza",
      [1, "meet_adesso", "contattato", undefined, null],
      [
        e.nuoviInviati + e.promemoriInviati,
        m.invii.at(-1).tipo,
        m.schede[0].data.contattoWa.stato,
        m.schede[0].data.contattoWa.scadeRisposta,
        m.giro.prossimo,
      ],
    );
    m = mondo({ schede: [meet("s1", 1, { oraMeeting: "18:00" })], config: accesa });
    e = await m.giroOra();
    c(
      "mattina del meet delle 18:00 (sono le 15:06, dopo le 9:00): meet_oggi con nome, ora, consulente",
      [1, "meet_oggi", "crm-meet-oggi", ["Anna", "18:00", "Giulia Demo"]],
      [
        e.nuoviInviati,
        m.invii.at(-1).tipo,
        m.f.chiamate.find((x) => x.percorso === PERCORSI.tag)?.corpo.tag_name,
        ["crm_v1", "crm_v2", "crm_v3"].map(
          (k) =>
            m.f.chiamate
              .find((x) => x.percorso === PERCORSI.scriviCampi)
              .corpo.fields.find((x) => x.field_name === k)?.field_value,
        ),
      ],
    );

    //  l'ordine e il limite di 2
    m = mondo({
      schede: [
        meet("a", 1, { oraMeeting: "15:06" }),
        meet("b", 2, { oraMeeting: "15:25" }),
        lead("n1", 3),
      ],
      config: accesa,
    });
    e = await m.giroOra();
    c(
      "ordine: meet_adesso prima del promemoria; mai più di 2 per giro (il primo contatto aspetta)",
      ["meet_adesso", "promemoria", 2],
      [m.invii[0]?.tipo, m.invii[1]?.tipo, m.invii.length],
    );

    //  ── 24 ore prima: il meet è sabato 24/10 alle 15:06, sono le 15:06 di venerdì ──
    const domani = (id, n, extra) =>
      meet(id, n, {
        dataMeeting: "2026-10-24",
        oraMeeting: "15:06",
        fissatoIl: "2026-10-20T09:00:00.000Z",
        ...extra,
      });
    m = mondo({ schede: [domani("d1", 1)], config: accesa });
    e = await m.giroOra();
    c(
      "24 ore prima (sabato 15:06, sono le 15:06 di venerdì): meet_domani col suo flusso e il suo tag",
      [1, "meet_domani", "content-m3", "crm-meet-domani"],
      [
        e.nuoviInviati,
        m.invii.at(-1)?.tipo,
        m.flussi()[0]?.corpo.flow_ns,
        m.f.chiamate.find((x) => x.percorso === PERCORSI.tag)?.corpo.tag_name,
      ],
    );
    c(
      "…variabili nell'ordine del modello: nome, giorno in italiano, ora, consulente",
      ["Anna", "sabato 24 ottobre", "15:06", "Giulia Demo"],
      ["crm_v1", "crm_v2", "crm_v3", "crm_v4"].map(
        (k) =>
          m.f.chiamate
            .find((x) => x.percorso === PERCORSI.scriviCampi)
            .corpo.fields.find((x) => x.field_name === k)?.field_value,
      ),
    );
    c(
      "…registro: chiave d|tel9|AAAA-MM-GGTHH:MM; «In attesa» fino all'inizio del meet; il ritmo NON si sposta",
      [`d|${cifre(1).slice(-9)}|2026-10-24T15:06`, "in_attesa", "2026-10-24T13:06:00.000Z", null],
      [
        m.invii.at(-1)?.chiave,
        m.schede[0].data.contattoWa.stato,
        m.schede[0].data.contattoWa.scadeRisposta,
        m.giro.prossimo,
      ],
    );
    c(
      "…un secondo giro non lo rimanda (stessa chiave)",
      0,
      await (async () => {
        m.orologio.avanza(5 * MIN);
        const n0 = m.invii.length;
        await m.giroOra();
        return m.invii.length - n0;
      })(),
    );
    m = mondo({ schede: [domani("d1", 1)], config: { ...accesa, giornoMeet: false } });
    c("«Giorno del meet» spento → zero invii", 0, (await m.giroOra()).nuoviInviati);
    m = mondo({ schede: [domani("d1", 1)], config: accesa });
    const eProva = await m.giroOra(true);
    c(
      "prova a secco: la riga è meet_domani «scriverebbe» e non scrive niente",
      [["meet_domani", "scriverebbe"], 0, 0],
      [
        eProva.righe.filter((r) => r.tipo === "meet_domani").map((r) => [r.tipo, r.esito])[0],
        m.invii.length,
        m.f.chiamate.length,
      ],
    );
    m = mondo({
      schede: [domani("d1", 1)],
      config: { ...accesa, flussi: { ...accesa.flussi, hgl_meet_domani: undefined } },
    });
    e = await m.giroOra();
    c(
      "manca il flusso 24 ore prima → ferma solo quello, la nota dice il modello",
      [0, true],
      [e.nuoviInviati, /hgl_meet_domani/.test(m.giro.stato.nota ?? "")],
    );
    m = mondo({
      schede: [domani("d1", 1, { oraMeeting: "14:30", fissatoIl: "2026-10-23T12:45:00.000Z" })],
      config: accesa,
    });
    c(
      "fissata meno di 24 ore prima (la finestra è aperta, ma l'ha fissata 23 h 45' prima) → zero invii: c'è la conferma",
      0,
      (await m.giroOra()).nuoviInviati,
    );
    m = mondo({
      schede: [
        domani("d1", 1, { contattoWa: { stato: "stop", il: "2026-10-22T08:00:00.000Z", da: "x" } }),
      ],
      config: accesa,
    });
    c("STOP → zero invii", 0, (await m.giroOra()).nuoviInviati);
    //  il freno non lo ferma: un ricontatto di un'ora fa senza risposta, allo stesso numero
    m = mondo({
      schede: [domani("d1", 1)],
      config: accesa,
      invii: [riga(1, "ricontatto", { telefono: cifre(1), prenotatoMs: ADESSO - 60 * MIN })],
    });
    c("non è frenato da «mai due senza risposta»", 1, (await m.giroOra()).nuoviInviati);
    //  l'ordine: dopo meet_oggi, prima del primo contatto (e al massimo 2 per giro)
    m = mondo({
      schede: [domani("d1", 1), meet("o1", 2, { oraMeeting: "18:00" }), lead("n1", 3)],
      config: accesa,
    });
    await m.giroOra();
    c(
      "ordine: meet_oggi, poi meet_domani; il primo contatto aspetta (mai più di 2 per giro)",
      ["meet_oggi", "meet_domani", 2],
      [m.invii[0]?.tipo, m.invii[1]?.tipo, m.invii.length],
    );

    //  ritmo: ricontatto dovuto parte entro un'ora anche con un primo contatto ogni 15'
    m = mondo({ schede: [ric("r1", 9)], config: accesa });
    const invia15 = [];
    for (let k = 0; k < 4; k++) {
      m.schede.push(lead(`n${k}`, 1 + k));
      m.orologio.avanza(15 * MIN);
      await m.giroOra();
    }
    c(
      "un primo contatto ogni 15' per un'ora: il ricontatto dovuto parte lo stesso (ritmo solo per ricontatto e richiamo)",
      [4, 1],
      [m.riga("primo_contatto").length, m.riga("ricontatto").length],
    );
    void invia15;

    //  uno solo fra richiamo e ricontatto, per giro
    m = mondo({
      schede: [ric("r1", 9), ric("r2", 8)],
      config: accesa,
    });
    e = await m.giroOra();
    c("due ricontatti pronti: ne parte uno (stesso ritmo)", 1, e.ricontattiInviati);

    //  messaggi per stato
    const evento = (stato, n, extra) =>
      scheda(`e${n}`, n, {
        stato,
        consulenteId: "cons-1",
        statoDal: new Date(ADESSO - 60 * MIN).toISOString(),
        ...extra,
      });
    m = mondo({
      schede: [evento("non_risponde", 5, { consulenteId: undefined, importato: true })],
      config: { ...accesa, stati: { non_risponde: "2026-10-20T00:00:00.000Z" } },
    });
    e = await m.giroOra();
    c(
      "«Non risponde» (a evento, anche importati): ricontatto col flusso e il tag della tabella",
      [1, "ricontatto", "content-s1", "crm-stato-non-risponde"],
      [
        e.ricontattiInviati,
        m.invii.at(-1).tipo,
        m.flussi()[0]?.corpo.flow_ns,
        m.f.chiamate.find((x) => x.percorso === PERCORSI.tag)?.corpo.tag_name,
      ],
    );
    m = mondo({
      schede: [evento("non_risponde", 5, { consulenteId: undefined })],
      config: { ...accesa, stati: {} },
    });
    c("stato non acceso → zero invii", 0, (await m.giroOra()).ricontattiInviati);
    m = mondo({
      schede: [evento("non_risponde", 5, { consulenteId: undefined })],
      config: {
        ...accesa,
        stati: { non_risponde: "2026-10-20T00:00:00.000Z" },
        flussi: { ...accesa.flussi, hgl_non_risponde: undefined },
      },
    });
    e = await m.giroOra();
    c(
      "flusso di quello stato mancante → ferma solo quello, nota con il modello",
      [0, true],
      [e.ricontattiInviati, /hgl_non_risponde/.test(m.giro.stato.nota ?? "")],
    );

    //  la chiamata concordata alle 15:30 → 15:00-15:20: sono le 15:06
    m = mondo({
      schede: [
        scheda("c1", 6, {
          stato: "richiamo",
          dataRicontatto: "2026-10-23",
          oraRicontatto: "15:20",
        }),
      ],
      config: { ...accesa, stati: { richiamo: "2026-10-20T00:00:00.000Z" } },
    });
    e = await m.giroOra();
    c(
      "promemoria della chiamata (15:20): tipo promemoria_chiamata, «In attesa» fino all'ora, ritmo intatto",
      ["promemoria_chiamata", "in_attesa", "2026-10-23T13:20:00.000Z", null],
      [
        m.invii.at(-1)?.tipo,
        m.schede[0].data.contattoWa?.stato,
        m.schede[0].data.contattoWa?.scadeRisposta,
        m.giro.prossimo,
      ],
    );

    //  tetti nuovi
    m = mondo({
      schede: [lead("n1", 1)],
      config: { ...accesa, tetti: { leadNuovi: 30 } },
      invii: Array.from({ length: 30 }, (_, i) =>
        riga(i, i % 2 ? "richiamo_24h" : "primo_contatto"),
      ),
    });
    e = await m.giroOra();
    c(
      "31° lead nuovo con il riquadro a 30 → non parte (il riquadro può abbassare)",
      0,
      e.nuoviInviati,
    );
    m = mondo({
      schede: [lead("n1", 1)],
      config: accesa,
      invii: Array.from({ length: 70 }, (_, i) =>
        riga(i, i % 2 ? "richiamo_24h" : "primo_contatto"),
      ),
    });
    e = await m.giroOra();
    c("71° lead nuovo → non parte (tetto 100 meno la riserva di 30)", 0, e.nuoviInviati);
    m = mondo({
      schede: [lead("n1", 1), meet("s1", 2, { oraMeeting: "15:06" })],
      config: { ...accesa, tetti: { totale: 40 } },
      invii: Array.from({ length: 10 }, (_, i) => riga(i, "primo_contatto")),
    });
    e = await m.giroOra();
    c(
      "totale abbassato a 40, 10 primi contatti già partiti: il primo contatto salta, il meet_adesso parte (riserva)",
      [1, "meet_adesso"],
      [e.nuoviInviati, m.invii.at(-1).tipo],
    );

    //  ── il richiamo a 24 ore, da capo a fondo ──
    //  il primo contatto è partito ieri alle 14:06 Roma: oggi alle 15:06 è l'ora del richiamo
    const primoDiIeri = (n) => ({
      id: `p${n}`,
      userId: U,
      leadId: `n${n}`,
      tipo: "primo_contatto",
      chiave: `n|${cifre(n).slice(-9)}`,
      telefono: cifre(n),
      stato: "inviato",
      prenotatoMs: ADESSO - 25 * 3600_000,
    });
    const leadDiIeri = (id, n, extra) =>
      lead(id, n, {
        origineIngresso: { via: "google_sheets", foglio: "Lead", il: "2026-10-22T11:00:00.000Z" },
        consensoModulo: { whatsapp: true, il: "2026-10-22T09:00:00.000Z", via: "modulo_meta" },
        ...extra,
      });
    m = mondo({ schede: [leadDiIeri("n1", 1)], config: accesa, invii: [primoDiIeri(1)] });
    e = await m.giroOra();
    const campiRic = m.f.chiamate.find((x) => x.percorso === PERCORSI.scriviCampi)?.corpo.fields;
    c(
      "richiamo a 24 h: flusso, tag, chiave n24|tel9, variabile nome, tipo nel registro",
      [1, "content-n2", "crm-richiamo", `n24|${cifre(1).slice(-9)}`, "richiamo_24h", "Anna"],
      [
        e.nuoviInviati,
        m.flussi()[0]?.corpo.flow_ns,
        m.f.chiamate.find((x) => x.percorso === PERCORSI.tag)?.corpo.tag_name,
        m.invii.at(-1)?.chiave,
        m.invii.at(-1)?.tipo,
        campiRic?.find((x) => x.field_name === "crm_v1")?.field_value,
      ],
    );
    c(
      "…«In attesa» per 24 ore (sabato 15:06 Roma) e il richiamo PRENDE il ritmo (30 minuti)",
      ["in_attesa", "2026-10-24T13:06:00.000Z", new Date(ADESSO + 30 * MIN).toISOString()],
      [
        m.schede[0].data.contattoWa.stato,
        m.schede[0].data.contattoWa.scadeRisposta,
        new Date(m.giro.prossimo).toISOString(),
      ],
    );
    c(
      "…dopo il richiamo nessun terzo messaggio, nemmeno al giro dopo",
      0,
      await (async () => {
        m.orologio.avanza(40 * MIN);
        const n0 = m.invii.length;
        await m.giroOra();
        return m.invii.length - n0;
      })(),
    );
    //  un ricontatto e un richiamo pronti insieme: parte UNO (il ricontatto), il richiamo al giro del ritmo
    m = mondo({
      schede: [leadDiIeri("n1", 1), ric("r1", 9)],
      config: accesa,
      invii: [primoDiIeri(1)],
    });
    e = await m.giroOra();
    c(
      "ricontatto e richiamo pronti insieme: ne parte uno solo, il ricontatto",
      [1, 0, "ricontatto"],
      [e.ricontattiInviati, e.nuoviInviati, m.invii.at(-1).tipo],
    );
    m.orologio.avanza(31 * MIN);
    e = await m.giroOra();
    c(
      "…passato il ritmo (31') tocca al richiamo: nessuno dei due resta indietro",
      [1, "richiamo_24h"],
      [e.nuoviInviati, m.invii.at(-1).tipo],
    );

    //  ── il promemoria in sede, da capo a fondo ──
    const sede = (id, n, extra) =>
      scheda(id, n, {
        stato: "viene_in_sede",
        consulenteId: undefined,
        dataVieneInSede: "2026-10-24",
        oraVieneInSede: "11:00",
        statoDal: "2026-10-20T10:00:00.000Z",
        ...extra,
      });
    m = mondo({
      schede: [sede("sd1", 3)],
      config: { ...accesa, stati: { viene_in_sede: "2026-10-20T00:00:00.000Z" } },
    });
    e = await m.giroOra();
    const campiSede = Object.fromEntries(
      (m.f.chiamate.find((x) => x.percorso === PERCORSI.scriviCampi)?.corpo.fields ?? []).map(
        (x) => [x.field_name, x.field_value],
      ),
    );
    c(
      "promemoria in sede (appuntamento domani 11:00): flusso, tag, chiave sd|tel9|giorno, tipo",
      [
        1,
        "content-s3",
        "crm-stato-sede",
        `sd|${cifre(3).slice(-9)}|2026-10-24T11:00`,
        "promemoria_sede",
      ],
      [
        e.nuoviInviati,
        m.flussi()[0]?.corpo.flow_ns,
        m.f.chiamate.find((x) => x.percorso === PERCORSI.tag)?.corpo.tag_name,
        m.invii.at(-1)?.chiave,
        m.invii.at(-1)?.tipo,
      ],
    );
    c(
      "…le quattro variabili nell'ordine: nome, giorno, ora, indirizzo",
      ["Anna", "sabato 24 ottobre", "11:00", "Via Prova 1, Roma"],
      [campiSede.crm_v1, campiSede.crm_v2, campiSede.crm_v3, campiSede.crm_v4],
    );
    c(
      "…«In attesa» fino all'appuntamento (11:00 Roma = 09:00Z) e il ritmo resta intatto",
      ["in_attesa", "2026-10-24T09:00:00.000Z", null],
      [
        m.schede[0].data.contattoWa.stato,
        m.schede[0].data.contattoWa.scadeRisposta,
        m.giro.prossimo,
      ],
    );
    m = mondo({
      schede: [sede("sd1", 3)],
      config: {
        ...accesa,
        indirizzoSede: null,
        stati: { viene_in_sede: "2026-10-20T00:00:00.000Z" },
      },
    });
    c(
      "senza l'indirizzo della sede il promemoria in sede non parte",
      0,
      (await m.giroOra()).nuoviInviati,
    );

    //  ── STOP vale per ogni tipo ──
    const stop = { stato: "stop", il: FRASE, da: "x", storia: [] };
    m = mondo({
      schede: [
        lead("n1", 1, { contattoWa: stop }),
        meet("s1", 2, { oraMeeting: "15:06", contattoWa: stop }),
        meet("s2", 3, { oraMeeting: "15:25", contattoWa: stop }),
        ric("r1", 4, { contattoWa: stop }),
        scheda("e1", 5, {
          stato: "non_risponde",
          consulenteId: undefined,
          statoDal: new Date(ADESSO - 60 * MIN).toISOString(),
          contattoWa: stop,
        }),
        sede("sd1", 6, { contattoWa: stop }),
        leadDiIeri("n9", 7, { contattoWa: stop }),
      ],
      config: {
        ...accesa,
        stati: {
          non_risponde: "2026-10-20T00:00:00.000Z",
          viene_in_sede: "2026-10-20T00:00:00.000Z",
        },
      },
      invii: [primoDiIeri(7)],
    });
    m.schede[6].data.contattoWa = stop;
    e = await m.giroOra();
    c(
      "STOP sulla scheda, per ogni tipo: nessuna prenotazione, nessuna chiamata a ManyChat",
      [0, 0, 1, 0],
      [
        e.nuoviInviati + e.promemoriInviati + e.ricontattiInviati,
        m.f.chiamate.length,
        m.invii.length,
        m.flussi().length,
      ],
    );
    //  STOP in rubrica (non sulla scheda): la prenotazione lo ferma anche per i tipi nuovi
    m = mondo({
      schede: [lead("n1", 1), meet("s1", 2, { oraMeeting: "15:06" })],
      config: accesa,
      stop: [cifre(1), cifre(2)],
    });
    e = await m.giroOra();
    c(
      "STOP in rubrica: né il primo contatto né l'ora esatta partono, e le schede vanno in STOP",
      [0, 0, "stop", "stop"],
      [
        e.nuoviInviati,
        m.flussi().length,
        m.schede[0].data.contattoWa?.stato,
        m.schede[1].data.contattoWa?.stato,
      ],
    );

    //  ── «manca il consenso» degli importati non riempie i problemi ──
    m = mondo({
      schede: [
        scheda("i1", 7, {
          stato: "non_risponde",
          okWhatsapp: undefined,
          consulenteId: undefined,
          importato: true,
          statoDal: new Date(ADESSO - 60 * MIN).toISOString(),
        }),
        scheda("i2", 8, {
          stato: "non_risponde",
          nome: "",
          consulenteId: undefined,
          importato: true,
          statoDal: new Date(ADESSO - 60 * MIN).toISOString(),
        }),
      ],
      config: { ...accesa, stati: { non_risponde: "2026-10-20T00:00:00.000Z" } },
    });
    await m.giroOra();
    c(
      "importato senza consenso: non è un problema da mostrare; un guasto vero (nome mancante) sì",
      [["manca il nome"]],
      [m.giro.stato.problemi.map((p) => p.motivo)],
    );

    //  STOP e prova a secco con i tipi nuovi
    m = mondo({
      schede: [lead("n1", 1, { contattoWa: { stato: "stop", il: FRASE, da: "x", storia: [] } })],
      config: accesa,
    });
    c("STOP → nessun invio di nessun tipo", 0, (await m.giroOra()).nuoviInviati);
    m = mondo({ schede: [lead("n1", 1)], config: { ...accesa, leadNuovo: false } });
    const prima = JSON.stringify([m.invii, m.schede, m.giro]);
    const secco = await m.giroOra(true);
    c(
      "prova a secco: il primo contatto si vede anche con l'interruttore spento, zero chiamate e scritture",
      [["primo_contatto", "scriverebbe"], 0, prima],
      [
        [secco.righe[0]?.tipo, secco.righe[0]?.esito],
        m.f.chiamate.length,
        JSON.stringify([m.invii, m.schede, m.giro]),
      ],
    );
    void alle;
  }

  gruppo("MANYCHAT · GIRO · TIPO ALLA PORTA E ROTTA DEL CRON");
  {
    const porta = readFileSync(join(radice, "src/crm/manychat/porta.ts"), "utf8");
    const giroSrc = readFileSync(join(radice, "src/crm/manychat/giro.ts"), "utf8");
    const hook = readFileSync(join(radice, "src/routes/hooks/manychat-giro.ts"), "utf8");
    c(
      "la porta conosce tutti i 12 tipi (TipoInvioPorta = TipoInvio)",
      true,
      /export type TipoInvioPorta = TipoInvio;/.test(porta),
    );
    c(
      "il giro dice alla porta il tipo vero, niente più «ricontatto» di ripiego",
      [true, false],
      [/tipo: cand\.tipo,\s*chiave,/.test(giroSrc), /tipo: "ricontatto",\s*chiave,/.test(giroSrc)],
    );
    c(
      "il cron restituisce anche nuoviInviati (solo conteggi)",
      true,
      /nuoviInviati: e\.nuoviInviati/.test(hook),
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  LE LETTURE DI `schede()`: PostgREST taglia a 1000 in silenzio
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · LE LETTURE DELLE SCHEDE NON PERDONO QUELLE DI OGGI");
  {
    //  Si impacchetta `porte.server.ts` vero, con un Supabase finto che si comporta
    //  come PostgREST: filtri sui percorsi json, e al massimo 1000 righe per richiesta.
    const dir = mkdtempSync(join(tmpdir(), "giro-schede-"));
    const finta = join(dir, "supabase-finto.js");
    writeFileSync(
      finta,
      `const valore = (riga, colonna) => {
  const [testa, ...resto] = colonna.split("->");
  let v = riga[testa];
  for (const pezzo of resto) v = v == null ? undefined : v[pezzo.replace(/^>/, "")];
  return v === undefined ? null : v;
};
export const supabaseAdmin = {
  from: () => {
    const filtri = [];
    let tetto = 1000;
    let ordina = false;
    const q = {
      select: () => q,
      eq: (c, v) => (filtri.push((r) => String(valore(r, c)) === String(v)), q),
      in: (c, v) => (filtri.push((r) => v.includes(valore(r, c))), q),
      gte: (c, v) => (filtri.push((r) => valore(r, c) !== null && String(valore(r, c)) >= v), q),
      lte: (c, v) => (filtri.push((r) => valore(r, c) !== null && String(valore(r, c)) <= v), q),
      not: (c) => (filtri.push((r) => valore(r, c) !== null), q),
      is: (c) => (filtri.push((r) => valore(r, c) === null), q),
      order: () => ((ordina = true), q),
      limit: (n) => ((tetto = Math.min(n, 1000)), q),
      then: (ok, no) =>
        Promise.resolve({ data: globalThis.__righe.filter((r) => filtri.every((f) => f(r))).sort((a, b) => (ordina ? String(a.id).localeCompare(String(b.id)) : 0)).slice(0, tetto), error: null }).then(ok, no),
    };
    return q;
  },
};
export const supabaseAdminDefault = supabaseAdmin;`,
    );
    const esbuild = createRequire(import.meta.url)("esbuild");
    const fuori = join(dir, "porte.cjs");
    await esbuild.build({
      entryPoints: [join(radice, "src/crm/manychat/porte.server.ts")],
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: fuori,
      logLevel: "error",
      loader: { ".tsx": "tsx" },
      alias: { "@/integrations/supabase/client.server": finta, "@": join(radice, "src") },
    });
    const PS = createRequire(import.meta.url)(fuori);
    const riga = (id, data) => ({ id, user_id: U, data });
    const vecchia = (i) =>
      riga(`v${i}`, {
        stato: "non_risponde",
        statoDal: "2026-09-15T10:00:00.000Z",
        dataRicontatto: "2026-09-15",
      });
    const vecchieRic = (i) =>
      riga(`d${i}`, { stato: "da_ricontattare", dataRicontatto: "2026-09-10" });
    globalThis.__righe = [
      ...Array.from({ length: 1200 }, (_, i) => vecchia(i)),
      ...Array.from({ length: 1200 }, (_, i) => vecchieRic(i)),
      riga("recente", {
        stato: "non_risponde",
        statoDal: "2026-10-23T12:46:00.000Z",
      }),
      riga("oggi", { stato: "da_ricontattare", dataRicontatto: "2026-10-23" }),
      riga("ieri", { stato: "sta_valutando", dataRicontatto: "2026-10-22" }),
      riga("callback", { stato: "da_ricontattare", callbackAt: "2026-10-23T09:00:00.000Z" }),
    ];
    const letto = await PS.porteGiro().schede(U, "2026-10-23", {
      leadNuoviDal: null,
      stati: { non_risponde: "2026-09-01T00:00:00.000Z" },
    });
    const ids = letto.map((x) => x.id);
    c(
      "1200 «Non risponde» vecchie + 1 di 20 minuti fa: la recente c'è, le vecchie no",
      [true, false],
      [ids.includes("recente"), ids.some((i) => i.startsWith("v"))],
    );
    c(
      "1200 ricontatti vecchi + oggi, ieri e il vecchio callbackAt: ci sono tutti e tre, i vecchi no",
      [true, true, true, false],
      [
        ids.includes("oggi"),
        ids.includes("ieri"),
        ids.includes("callback"),
        ids.some((i) => i.startsWith("d")),
      ],
    );
    //  Commessa 2026-10-28: gli importati «da contattare» e i ritorni, con letture limitate.
    globalThis.__righe = [
      ...Array.from({ length: 1500 }, (_, i) =>
        riga(`m${String(i).padStart(4, "0")}`, { importato: true, stato: "da_contattare" }),
      ),
      riga("scritto", {
        importato: true,
        stato: "da_contattare",
        contattoWa: { stato: "in_attesa" },
      }),
      riga("irraggiungibile", {
        importato: true,
        stato: "da_contattare",
        contattoWa: { stato: "non_raggiungibile" },
      }),
      riga("in-chat", { importato: true, stato: "gestire_in_chat" }),
      riga("non-importato", { stato: "da_contattare" }),
      riga("ritorno", {
        stato: "da_ricontattare",
        ricarico: { volte: 2, ultimo: "2026-10-27T08:00:00.000Z" },
      }),
      riga("senza-ricarico", { stato: "da_ricontattare" }),
    ];
    const conRitorni = await PS.porteGiro().schede(U, "2026-10-23", {
      leadNuoviDal: null,
      importatiERitorni: true,
      stati: {},
    });
    const idsR = conRitorni.map((x) => x.id);
    c(
      "importati: 1500 «da contattare» letti tutti (oltre le 1000 righe di PostgREST), senza doppioni",
      [1500, true],
      [idsR.filter((i) => i.startsWith("m")).length, new Set(idsR).size === idsR.length],
    );
    c(
      "…il già scritto e l'in chat restano fuori; il non importato «da contattare» (dal 28/10), il «non raggiungibile» e il ritorno entrano",
      [false, false, true, true, true, false],
      [
        idsR.includes("scritto"),
        idsR.includes("in-chat"),
        idsR.includes("non-importato"),
        idsR.includes("irraggiungibile"),
        idsR.includes("ritorno"),
        idsR.includes("senza-ricarico"),
      ],
    );
    const senzaR = await PS.porteGiro().schede(U, "2026-10-23", {
      leadNuoviDal: null,
      importatiERitorni: false,
      stati: {},
    });
    c("«Lead nuovo» spento: nessuna lettura di importati né di ritorni", 0, senzaR.length);
    delete globalThis.__righe;
    const server = readFileSync(join(radice, "src/crm/manychat/pannello.server.ts"), "utf8");
    c(
      "la prova a secco del riquadro legge le schede con la STESSA funzione del giro",
      true,
      /porteGiro\(\)\.schede\(/.test(server),
    );
    rmSync(dir, { recursive: true, force: true });
    delete globalThis.__righe;
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  IMPORTATI E RITORNI (commessa 2026-10-28)
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · IMPORTATI MAI CONTATTATI E MESSAGGIO DI RITORNO");
  {
    const accesa = {
      leadNuovo: true,
      leadNuovoDal: "2026-10-20T00:00:00.000Z",
      fraseModuloDal: null,
      flussi: { ...CONFIG.flussi, hgl_primo_contatto: "content-n1", hgl_ritorno: "content-rit" },
    };
    /** un importato di mesi fa: né modulo né consenso */
    const importato = (id, n, extra) =>
      scheda(id, n, {
        okWhatsapp: undefined,
        consulenteId: undefined,
        stato: "da_contattare",
        importato: true,
        createdAt: "2026-06-01T10:00:00.000Z",
        ...extra,
      });
    /** un contatto di ritorno: il ricarico è salito oggi alle 14:00 Roma */
    const ritorno = (id, n, extra) =>
      importato(id, n, {
        stato: "non_risponde",
        ricarico: { volte: 2, ultimo: "2026-10-23T12:00:00.000Z", daDecidere: true },
        ...extra,
      });
    const v1 = (m) =>
      m.f.chiamate
        .find((x) => x.percorso === PERCORSI.scriviCampi)
        ?.corpo.fields.find((x) => x.field_name === "crm_v1")?.field_value;
    const tag = (m) => m.f.chiamate.find((x) => x.percorso === PERCORSI.tag)?.corpo.tag_name;

    let m = mondo({ schede: [ritorno("r1", 1)], config: accesa });
    let e = await m.giroOra();
    c(
      "ritorno: inviato col flusso hgl_ritorno, il tag crm-ritorno e il solo nome",
      [1, "content-rit", "crm-ritorno", "Anna"],
      [e.nuoviInviati, m.flussi()[0]?.corpo.flow_ns, tag(m), v1(m)],
    );
    c(
      "…registro: tipo ritorno, chiave r|tel9|<istante del ritorno>; «In attesa»; il ritmo non si sposta",
      ["ritorno", `r|${cifre(1).slice(-9)}|2026-10-23T12:00:00.000Z`, "in_attesa", null],
      [m.invii[0].tipo, m.invii[0].chiave, m.schede[0].data.contattoWa.stato, m.giro.prossimo],
    );
    c("…conta come lead nuovo di oggi nel riquadro", 1, m.giro.stato.oggi.leadNuovi);
    e = await m.giroOra();
    c("…un secondo giro non lo rimanda (stesso ritorno)", [0, 1], [e.nuoviInviati, m.invii.length]);

    m = mondo({ schede: [importato("i1", 2)], config: accesa });
    e = await m.giroOra();
    c(
      "importato di mesi fa, senza consenso né modulo: primo contatto col suo flusso e tag",
      [1, "content-n1", "crm-primo-contatto", `n|${cifre(2).slice(-9)}`],
      [e.nuoviInviati, m.flussi()[0]?.corpo.flow_ns, tag(m), m.invii[0]?.chiave],
    );
    m = mondo({
      schede: [
        importato("i1", 2, { stato: "gestire_in_chat" }),
        importato("i2", 3, {
          contattoWa: { stato: "contattato", il: "2026-10-01T10:00:00.000Z", da: "x" },
        }),
        importato("i3", 4),
      ],
      invii: [
        {
          id: "vecchio",
          userId: U,
          leadId: null,
          tipo: "chat",
          chiave: null,
          telefono: cifre(4),
          stato: "inviato",
          prenotatoMs: ADESSO - 3 * GIORNO,
        },
      ],
      config: accesa,
    });
    e = await m.giroOra();
    c(
      "già in chat, già scritto o con una chat a mano nel registro → niente",
      [0, 1],
      [e.nuoviInviati, m.invii.length],
    );
    m = mondo({
      schede: [
        importato("i1", 2, {
          contattoWa: { stato: "stop", il: "2026-10-01T10:00:00.000Z", da: "x" },
        }),
        importato("i2", 3, { okWhatsapp: { si: false, il: "2026-10-01T10:00:00.000Z", da: "G" } }),
        ritorno("r1", 4, { telefono: "12" }),
      ],
      config: accesa,
    });
    e = await m.giroOra();
    c(
      "STOP, revoca e numero non valido: zero invii, e non sono problemi del riquadro",
      [0, 0],
      [e.nuoviInviati, m.giro.stato.problemi.length],
    );
    m = mondo({
      schede: [ritorno("r1", 1)],
      config: { ...accesa, flussi: { ...accesa.flussi, hgl_ritorno: undefined } },
    });
    e = await m.giroOra();
    c(
      "senza il flusso hgl_ritorno il messaggio non parte e la nota lo dice",
      [0, true],
      [e.nuoviInviati, /hgl_ritorno/.test(m.giro.stato.nota ?? "")],
    );
    m = mondo({
      schede: [ritorno("r1", 1), importato("i1", 2)],
      config: { ...accesa, leadNuovo: false },
    });
    c("«Lead nuovo» spento → né importati né ritorni", 0, (await m.giroOra()).nuoviInviati);

    //  Il giro manda al massimo due messaggi alla volta: gli altri aspettano il giro dopo.
    m = mondo({
      schede: [ritorno("r1", 1), ritorno("r2", 2), importato("i1", 3), importato("i2", 4)],
      config: accesa,
    });
    e = await m.giroOra();
    c(
      "quattro candidati: due per giro, prima i ritorni",
      [2, ["ritorno", "ritorno"]],
      [e.nuoviInviati, m.invii.map((x) => x.tipo)],
    );
    e = await m.giroOra();
    c("…al giro dopo partono gli altri due", [2, 4], [e.nuoviInviati, m.invii.length]);

    //  Il tetto: i ritorni contano fra i lead nuovi e rispettano la riserva (100 - 30 = 70).
    m = mondo({
      schede: [ritorno("r1", 1)],
      config: accesa,
      invii: Array.from({ length: 70 }, (_, i) => ({
        id: `p${i}`,
        userId: U,
        leadId: null,
        tipo: "primo_contatto",
        chiave: `x|${i}`,
        telefono: `3930000${String(i).padStart(5, "0")}`,
        stato: "inviato",
        prenotatoMs: ADESSO - 10 * MIN,
        rispostaMs: ADESSO - 5 * MIN,
      })),
    });
    e = await m.giroOra();
    c("70 lead nuovi già partiti oggi → il ritorno aspetta domani", 0, e.nuoviInviati);

    //  La prova a secco mostra i candidati nuovi con il loro motivo.
    m = mondo({
      schede: [ritorno("r1", 1), importato("i1", 2)],
      config: { ...CONFIG, flussi: CONFIG.flussi },
    });
    e = await m.giroOra(true);
    c(
      "prova a secco: il ritorno e l'importato compaiono, con il loro tipo e il loro motivo",
      [
        { tipo: "ritorno", esito: "scriverebbe", motivo: "messaggio di ritorno" },
        { tipo: "primo_contatto", esito: "scriverebbe", motivo: "primo contatto" },
      ],
      e.righe.map(({ tipo, esito, motivo }) => ({ tipo, esito, motivo })),
    );
    c(
      "ambitoDi: con «Lead nuovo» acceso il giro chiede anche importati e ritorni, spento no",
      [true, false],
      [
        G.ambitoDi(G.sceltaDaConfig({ ...CONFIG, ...accesa }, new Date(ADESSO), false))
          .importatiERitorni,
        G.ambitoDi(G.sceltaDaConfig({ ...CONFIG, leadNuovo: false }, new Date(ADESSO), false))
          .importatiERitorni,
      ],
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
   *  I LOG: SOLO CODICI
   * ════════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · GIRO · NEI LOG SOLO CODICI");
  {
    const m = mondo({ schede: [meet("s1", 1)], guastoPrenota: true });
    const e = await m.giroOra();
    c(
      "il database guasto in prenotazione non fa lanciare il giro: nessun invio, nessun blocco finto",
      [0, 0],
      [e.promemoriInviati, m.f.chiamate.length],
    );
    const tutto = JSON.stringify([m.avvisi, m.giro.stato, m.spenti, e]);
    c(
      "avvisi, stato, motivi di spegnimento: niente telefono, nome intero o chiave",
      false,
      /3930000|333 000|Anna Prova|chiave-finta|giù per/.test(tutto),
    );
    c(
      "…lo stato porta solo il nome abbreviato",
      true,
      !/Prova/.test(JSON.stringify(m.giro.stato.problemi)) ||
        /Anna P\./.test(JSON.stringify(m.giro.stato.problemi)),
    );

    const m2 = mondo({ schede: [meet("s1", 1)] });
    m2.f.su("POST", PERCORSI.flusso, esiti.errore500());
    const e2 = await m2.giroOra();
    c(
      "500 su sendFlow → incerto, e il testo di ManyChat non entra in nessun avviso",
      [1, false],
      [
        e2.incerti,
        /Internal|errore finto/.test(JSON.stringify([m2.avvisi, m2.giro.stato, m2.spenti])),
      ],
    );

    c(
      "nomeAbbreviato: «Mario R.», senza cognome solo il nome, vuoto «senza nome»",
      ["Mario R.", "Mario", "senza nome"],
      [
        G.nomeAbbreviato({ nome: "Mario Rossi", cognome: "rossi" }),
        G.nomeAbbreviato({ nome: "Mario" }),
        G.nomeAbbreviato({}),
      ],
    );
  }
}
