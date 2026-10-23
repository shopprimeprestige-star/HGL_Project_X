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
import { creaFinto, creaOrologio, esiti, PERCORSI } from "./finto.mjs";

const CHIAVE = "chiave-finta-0000";
const ADESSO = Date.parse("2026-10-23T13:06:00Z");
const MIN = 60_000;
const GIORNO = 86_400_000;
const U = "u-1";
const NS_PROM = "content-prom-1";
const NS_RIC = "content-ric-1";

export async function proveGiro(mod, { c, gruppo }) {
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
          ["promemoria", "ricontatto"].includes(r.tipo) &&
          ["prenotato", "inviato", "incerto"].includes(r.stato) &&
          giornoRoma(r.prenotatoMs) === oggi,
      );
      const abbassa = (v, costante) =>
        typeof v === "number" && v >= 0 ? Math.min(costante, v) : costante;
      let maxRic = abbassa(tetti.ricontatti, 20);
      const maxTot = abbassa(tetti.totale, 40);
      const prima = m.config.primaAccensione ? Date.parse(m.config.primaAccensione) : ora;
      if (ora < prima + 7 * GIORNO) maxRic = Math.min(maxRic, 10);
      if (contano.length >= maxTot) return { motivo: "tetto_totale" };
      if (
        p.tipo === "ricontatto" &&
        contano.filter((r) => r.tipo === "ricontatto").length >= maxRic
      )
        return { motivo: "tetto_ricontatti" };
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
      if (p.tipo === "ricontatto" && m.giro.prossimo !== null && m.giro.prossimo > ora)
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
      if (p.tipo === "ricontatto") m.giro.prossimo = ora + i * MIN;
      else m.giro.prossimo = Math.max(m.giro.prossimo ?? ora, ora + i * MIN);
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
      "il ritmo: il promemoria sposta prossimo_ricontatto_dopo di 27-33 minuti (qui 30)",
      new Date(ADESSO + 30 * MIN).toISOString(),
      new Date(m.giro.prossimo).toISOString(),
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
      "1 promemoria + 2 ricontatti: parte il promemoria; il ricontatto aspetta il ritmo, che il promemoria ha già preso",
      [1, 0, 1],
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
    //  Tetto totale: 40 messaggi automatici oggi.
    let m = mondo({
      schede: [meet("s1", 1)],
      invii: Array.from({ length: 40 }, (_, i) => riga(i, i % 2 ? "ricontatto" : "promemoria")),
    });
    let e = await m.giroOra();
    c(
      "40 messaggi oggi → il 41° non parte (tetto totale)",
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
      invii: Array.from({ length: 40 }, (_, i) => riga(i, "promemoria")),
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
        delete mm.schede[0].data.okWhatsapp;
      },
    });
    e = await m.giroOra();
    c(
      "consenso tolto dopo la prenotazione → non parte",
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
    m = mondo({ schede: [meet("s1", 1, { okWhatsapp: undefined })] });
    await m.giroOra();
    await m.giroOra();
    await m.giroOra();
    c(
      "senza consenso: il problema è scritto UNA volta sola in tre giri",
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
      meet("s2", 2, { okWhatsapp: undefined }),
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
      righe.map((r) => ({
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
