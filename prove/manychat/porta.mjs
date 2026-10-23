/** ── PROVE: LA PORTA UNICA DEGLI INVII ─────────────────────────────────────
 *
 *  File d'area della commessa 2026-10-23 (ManyChat), compito U1 (Dev B). Si
 *  collega da `prove/manychat.mjs`. Tutto con il ManyChat finto (`finto.mjs`) e
 *  un registro finto che si comporta come `manychat_prenota_porta` di M1
 *  (STOP, pausa di 120 s su prenotato/inviato/incerto, chiave unica): il SQL
 *  vero lo legge `migrazioni.mjs`.
 *
 *  Tre blocchi:
 *   1. la porta: Cloud identica a oggi, ManyChat (campi, flusso, pausa, esiti);
 *   2. la TRADUZIONE degli esiti per il giro della conferma del 22/10
 *      (PIANO §1e c): una riga della tabella, un caso;
 *   3. il giro: 2 conferme per giro e 20 s col canale ManyChat, 15 col Cloud,
 *      5 prenotazioni insieme in 3 giri, cambio di canale.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs` (chiave
 *  `"manychat/<nome>"`). `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creaFinto, creaOrologio, esiti, PERCORSI } from "./finto.mjs";

const CHIAVE = "chiave-finta-0000";
const NUMERO = "393331234567";
const FLUSSO = "content-finto-1";
const MODELLO = "consulenza_conferma_presenza";
const PARAMETRI = ["Maria", "domani", "10:00", "https://esempio.test/stanza?chi=p1"];

const roma = (g, hm) => new Date(Date.parse(`${g}T${hm}:00Z`) - 2 * 3600_000);

export async function provePorta(mod, { c, gruppo, radice }) {
  const P = mod["manychat/porta"];
  const A = mod["manychat/api"];
  const PR = mod["promemoria/pronto"];
  const G = mod["promemoria/giro"];
  const CF = mod["promemoria/conferma"];
  const NOME_MODELLO = mod["promemoria/invio"].NOME_MODELLO;

  /** Il finto con il campo `crm_telefono` (serve il suo id per cercare). */
  const nuovoFinto = (o = {}) =>
    creaFinto(o).su(
      "GET",
      PERCORSI.campi,
      esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]),
    );

  /** Le porte della porta: ManyChat finto + registro finto (modello di M1). */
  function creaPorte(o = {}) {
    const f = o.finto ?? nuovoFinto();
    const orologio = f.orologio;
    const eventi = [];
    const righe = [];
    const messaggi = [];
    const stop = new Set(o.stop ?? []);
    const flussi = o.flussi ?? { [MODELLO]: FLUSSO, hgl_prova: FLUSSO };
    const fetchSpia = (url, init) => {
      eventi.push(new URL(String(url)).pathname);
      return f.fetch(url, init);
    };
    const creaClient = () =>
      o.senzaChiave
        ? null
        : A.creaClient({ chiave: CHIAVE, fetch: fetchSpia, timeoutMs: o.timeoutMs ?? 25 });
    let client = creaClient();
    const cloud = [];
    const porte = {
      adesso: () => orologio.adesso(),
      client: () => client,
      flusso: async (modello) => flussi[modello] ?? null,
      prenota: async (p) => {
        eventi.push("prenota");
        if (o.registroGuasto) throw new Error("db giù");
        //  Lo stesso ordine di M1: STOP, pausa, chiave.
        if (stop.has(p.telefono)) return { motivo: "stop" };
        const adesso = orologio.ms;
        const conta = ["prenotato", "inviato", "incerto"];
        if (
          righe.some(
            (r) =>
              r.telefono === p.telefono &&
              conta.includes(r.stato) &&
              adesso - r.prenotatoMs < 120_000,
          )
        )
          return { motivo: "pausa_contatto" };
        if (p.chiave && righe.some((r) => r.chiave === p.chiave)) return { motivo: "gia_preso" };
        if (o.motivoStrano) return { motivo: o.motivoStrano };
        const riga = {
          id: `inv${righe.length + 1}`,
          ...p,
          stato: "prenotato",
          prenotatoMs: adesso,
        };
        righe.push(riga);
        return { id: riga.id };
      },
      esito: async (id, patch) => {
        eventi.push("esito");
        if (o.esitoGuasto) throw new Error("db giù");
        const r = righe.find((x) => x.id === id);
        if (r && r.stato === "prenotato") Object.assign(r, patch);
      },
      subscriberNoto: async (telefono) =>
        [...righe].reverse().find((r) => r.telefono === telefono && r.subscriber_id)
          ?.subscriber_id ?? null,
      registra: async (m) => {
        eventi.push("registra");
        messaggi.push(m);
      },
      cloud: async (corpo) => {
        cloud.push(corpo);
        if (o.cloudRete) throw new TypeError("fetch failed");
        return o.cloudRisposta ?? { status: 200, corpo: { messages: [{ id: "wamid.1" }] } };
      },
    };
    //  In produzione le porte nascono a ogni giro: il client riparte senza l'id del campo.
    const nuovoGiro = () => {
      client = creaClient();
    };
    return { porte, f, orologio, eventi, righe, messaggi, cloud, nuovoGiro };
  }
  const invia = (x, r) =>
    P.inviaWhatsapp(x.porte, { canale: "manychat", a: `+${NUMERO}`, tipo: "conferma", ...r });
  const conferma = {
    modello: MODELLO,
    parametri: PARAMETRI,
    nome: "Maria Rossi",
    leadId: "00000000-0000-4000-8000-000000000001",
    chiave: "c|k1|g1",
  };

  /* ── 1. LA PORTA ──────────────────────────────────────────────────────── */

  gruppo("PORTA UNICA · CANALE CLOUD: IL CORPO GRAPH È QUELLO DI OGGI");
  {
    //  Il codice di prima, copiato com'era (api.whatsapp-send e hooks/promemoria-whatsapp).
    const normalizePhone = (p) => {
      const digits = p.replace(/[^\d+]/g, "");
      return digits.startsWith("+") ? digits : `+${digits}`;
    };
    const vecchioSend = (body) => {
      const to = normalizePhone(body.to);
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/^\+/, ""),
      };
      if (body.templateName) {
        payload.type = "template";
        const template = { name: body.templateName, language: { code: body.templateLang || "it" } };
        const params = body.templateParams;
        if (Array.isArray(params) && params.length > 0)
          template.components = [
            {
              type: "body",
              parameters: params.map((text) => ({ type: "text", text: String(text ?? "") })),
            },
          ];
        payload.template = template;
      } else {
        payload.type = "text";
        payload.text = { preview_url: false, body: body.body };
      }
      return payload;
    };
    const vecchioHook = (numero, parametri) => ({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: numero,
      type: "template",
      template: {
        name: "consulenza_conferma_presenza",
        language: { code: "it" },
        components: [
          { type: "body", parameters: parametri.map((text) => ({ type: "text", text })) },
        ],
      },
    });
    const casi = [
      [
        "modello con 3 parametri",
        {
          to: "+39 333 123 4567",
          templateName: "avviso_webinar",
          templateParams: ["Maria", "Tre strade", "https://x.it/w/abc"],
        },
      ],
      ["modello senza parametri", { to: "393331234567", templateName: "ciao", templateLang: "en" }],
      [
        "modello con un parametro vuoto e uno nullo",
        { to: "(+39)333-1234567", templateName: "ciao", templateParams: ["", null, "x"] },
      ],
      ["testo libero", { to: "+393331234567", body: "Buongiorno Maria" }],
      ["numero con il +", { to: "+393331234567", body: "x" }],
    ];
    for (const [nome, b] of casi) {
      const x = creaPorte();
      const r = await P.inviaWhatsapp(x.porte, {
        canale: "cloud",
        a: b.to,
        testo: b.templateName ? undefined : b.body,
        modello: b.templateName,
        lingua: b.templateLang,
        parametri: b.templateParams,
        tipo: "chat",
      });
      c(`${nome}: stesso corpo di api.whatsapp-send`, vecchioSend(b), x.cloud[0]);
      c(
        `${nome}: esito ok con stato e corpo, nessun contatto con ManyChat`,
        [true, 200, 0],
        [r.esito === "ok", r.status, x.f.chiamate.length],
      );
    }
    const x = creaPorte();
    await P.inviaWhatsapp(x.porte, {
      canale: "cloud",
      a: NUMERO,
      modello: MODELLO,
      lingua: "it",
      parametri: PARAMETRI,
      tipo: "conferma",
    });
    c(
      "la conferma del 22/10: stesso corpo di hooks/promemoria-whatsapp",
      vecchioHook(NUMERO, PARAMETRI),
      x.cloud[0],
    );
    c(
      "col canale cloud la porta non prenota e non scrive nel registro ManyChat",
      [[], []],
      [x.eventi, x.righe],
    );
    const giu = creaPorte({ cloudRete: true });
    const r = await P.inviaWhatsapp(giu.porte, {
      canale: "cloud",
      a: NUMERO,
      modello: MODELLO,
      parametri: PARAMETRI,
      tipo: "conferma",
    });
    c(
      "rete giù: rete, e il giro la legge come prima",
      [true, { rete: true }],
      [r.rete, P.rispostaPerConferma(r)],
    );
    const rifiuto = creaPorte({ cloudRisposta: { status: 400, corpo: { error: { code: 190 } } } });
    const rr = await P.inviaWhatsapp(rifiuto.porte, {
      canale: "cloud",
      a: NUMERO,
      modello: MODELLO,
      parametri: PARAMETRI,
      tipo: "conferma",
    });
    c(
      "rifiuto di Meta: stato e corpo intatti, senza il campo manychat",
      { status: 400, corpo: { error: { code: 190 } } },
      P.rispostaPerConferma(rr),
    );
  }

  gruppo("PORTA UNICA · CANALE MANYCHAT: LA CATENA");
  {
    //  Modello mappato: prenotazione, contatto, SOLO i parametri nei campi crm_v*, sendFlow.
    const x = creaPorte();
    const r = await invia(x, conferma);
    c("modello mappato: ok, con l'id del registro", ["ok", "inv1"], [r.esito, r.invioId]);
    c(
      "prima la prenotazione, poi il contatto, i campi, il flusso, poi l'esito",
      [
        "prenota",
        PERCORSI.campi,
        PERCORSI.perCampo,
        PERCORSI.scriviCampi,
        PERCORSI.flusso,
        "esito",
        "registra",
      ],
      x.eventi,
    );
    const campi = x.f.chiamate.find((q) => q.percorso === PERCORSI.scriviCampi).corpo;
    c(
      "i campi: i quattro parametri del modello, più chi siamo (id dell'invio, scheda, telefono)",
      {
        crm_v1: "Maria",
        crm_v2: "domani",
        crm_v3: "10:00",
        crm_v4: PARAMETRI[3],
        crm_invio_id: "inv1",
        crm_lead_id: conferma.leadId,
        crm_telefono: NUMERO,
      },
      Object.fromEntries(campi.fields.map((q) => [q.field_name, q.field_value])),
    );
    c("…e nessun campo di troppo (niente crm_nome, note, cognome)", 7, campi.fields.length);
    c(
      "sendFlow col flusso mappato di quel modello",
      { subscriber_id: 1000001, flow_ns: FLUSSO },
      x.f.chiamate.at(-1).corpo,
    );
    c(
      "registro: inviato, col contatto ManyChat come TESTO (la colonna è text)",
      ["inviato", "1000001"],
      [x.righe[0].stato, x.righe[0].subscriber_id],
    );
    c(
      "whatsapp_messages: sent, id mc:…, nessun testo né nome nel corpo",
      ["sent", "mc:inv1", `[template:${MODELLO}]`, "+393331234567"],
      [x.messaggi[0].stato, x.messaggi[0].waId, x.messaggi[0].corpo, x.messaggi[0].a],
    );
    c(
      "…il registro e la riga di whatsapp_messages non portano nome, link né cognome",
      false,
      /Maria|Rossi|stanza/.test(JSON.stringify([x.righe, x.messaggi])),
    );
    c(
      "la chiave di ManyChat non compare da nessuna parte nel risultato",
      false,
      JSON.stringify([r, x.righe, x.messaggi]).includes(CHIAVE),
    );
  }
  {
    //  Modello non mappato: nessuna chiamata (né a ManyChat né al registro).
    const x = creaPorte({ flussi: {} });
    const r = await invia(x, conferma);
    c(
      "modello non mappato → flusso_mancante, nessuna chiamata",
      ["flusso_mancante", 0, [], 0],
      [r.esito, x.f.chiamate.length, x.eventi, x.righe.length],
    );
  }
  {
    //  Testo libero: sendContent, senza flusso e senza i campi del modello.
    const x = creaPorte();
    const r = await invia(x, { testo: "Buongiorno", tipo: "chat", leadId: null });
    c(
      "testo → sendContent",
      ["ok", [PERCORSI.campi, PERCORSI.perCampo, PERCORSI.testo]],
      [r.esito, x.f.percorsi()],
    );
    c(
      "…il testo libero è registrato com'è, senza flusso",
      [null, "Buongiorno"],
      [x.righe[0].flowNs, x.messaggi[0].corpo],
    );
    const vuota = creaPorte();
    c(
      "né testo né modello → blocco, nessuna chiamata",
      ["blocco", 0],
      await invia(vuota, { tipo: "chat" }).then((q) => [q.esito, vuota.f.chiamate.length]),
    );
  }
  {
    //  Contatto assente: creato col solo nome.
    const x = creaPorte({
      finto: nuovoFinto()
        .scenario("assente")
        .su(
          "GET",
          PERCORSI.campi,
          esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]),
        ),
    });
    const r = await invia(x, conferma);
    c(
      "contatto assente → creato col solo nome, poi i campi e il flusso",
      [
        "ok",
        [
          PERCORSI.campi,
          PERCORSI.perCampo,
          PERCORSI.perSistema,
          PERCORSI.crea,
          PERCORSI.scriviCampi,
          PERCORSI.flusso,
        ],
      ],
      [r.esito, x.f.percorsi()],
    );
    c(
      "…first_name = Maria (mai il cognome), numero col +",
      { first_name: "Maria", whatsapp_phone: `+${NUMERO}` },
      x.f.chiamate.find((q) => q.percorso === PERCORSI.crea).corpo,
    );
    //  Creazione rifiutata: da collegare, non è un blocco.
    const n = creaPorte({
      finto: nuovoFinto()
        .scenario("assente")
        .su(
          "GET",
          PERCORSI.campi,
          esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]),
        )
        .su("POST", PERCORSI.crea, esiti.errore(400)),
    });
    const q = await invia(n, conferma);
    c(
      "creazione rifiutata → da_collegare, nessun sendFlow",
      ["da_collegare", false],
      [q.esito, n.f.percorsi().includes(PERCORSI.flusso)],
    );
    c(
      "…riga del registro «fallito» e messaggio «failed»",
      [["fallito", "da_collegare"], "failed"],
      [[n.righe[0].stato, n.righe[0].motivo], n.messaggi[0].stato],
    );
    //  Il contatto già noto al registro: nessuna ricerca.
    const k = creaPorte();
    await invia(k, conferma);
    k.orologio.avanza(130_000);
    k.f.svuota();
    const seconda = await invia(k, { ...conferma, chiave: "c|k1|g2" });
    c(
      "contatto già noto al registro: solo i campi e il flusso",
      ["ok", [PERCORSI.scriviCampi, PERCORSI.flusso]],
      [seconda.esito, k.f.percorsi()],
    );
  }

  gruppo("PORTA UNICA · PAUSA PER CONTATTO, STOP, CHIAVE UNICA");
  {
    const x = creaPorte();
    const primo = await invia(x, conferma);
    x.orologio.avanza(30_000 - (x.orologio.ms - Date.parse("2026-10-23T10:00:00+02:00")));
    x.f.svuota();
    const secondo = await invia(x, { ...conferma, chiave: "c|k1|g2" });
    c(
      "due invii allo stesso telefono a 30 s → il secondo riprova_fra_poco",
      ["ok", "riprova_fra_poco"],
      [primo.esito, secondo.esito],
    );
    c("…senza nemmeno toccare ManyChat", 0, x.f.chiamate.length);
    const altro = await invia(x, { ...conferma, a: "393339876543", chiave: "c|k2|g1" });
    c("un altro telefono, nello stesso momento, passa", "ok", altro.esito);
    x.orologio.avanza(100_000);
    const dopo = await invia(x, { ...conferma, chiave: "c|k1|g3" });
    c("passati 130 s lo stesso telefono può di nuovo", "ok", dopo.esito);
    const stessa = await invia(x, { ...conferma, a: "393331112222", chiave: "c|k9|g1" });
    x.orologio.avanza(130_000);
    const doppia = await invia(x, { ...conferma, a: "393331112222", chiave: "c|k9|g1" });
    c("la stessa chiave due volte → gia_preso", ["ok", "gia_preso"], [stessa.esito, doppia.esito]);
  }
  {
    for (const motivo of ["dati_mancanti", "manca_riga_giro", "motivo_nuovo"]) {
      const m = creaPorte({ motivoStrano: motivo });
      const q = await invia(m, conferma);
      c(
        `registro che risponde «${motivo}» → blocco (non un riprova), ManyChat non viene toccato`,
        ["blocco", motivo, 0],
        [q.esito, q.codice, m.f.chiamate.length],
      );
    }
    const x = creaPorte({ stop: [NUMERO] });
    const r = await invia(x, conferma);
    c(
      "numero in STOP → stop, nessuna chiamata a ManyChat, nessuna riga",
      ["stop", 0, 0],
      [r.esito, x.f.chiamate.length, x.righe.length],
    );
    //  Incerto e blocco pesano diversamente sulla pausa.
    const i = creaPorte({ finto: nuovoFinto().su("POST", PERCORSI.flusso, esiti.reteGiu()) });
    c("sendFlow con la rete giù → incerto", "incerto", (await invia(i, conferma)).esito);
    i.orologio.avanza(30_000);
    c(
      "…e per 120 s il telefono resta in pausa (la riga incerta conta)",
      "riprova_fra_poco",
      (await invia(i, { ...conferma, chiave: "c|k1|g2" })).esito,
    );
    const b = creaPorte({
      finto: nuovoFinto().su("POST", PERCORSI.flusso, esiti.nonAutorizzato()),
    });
    c("sendFlow con la chiave rifiutata → blocco", "blocco", (await invia(b, conferma)).esito);
    b.orologio.avanza(30_000);
    b.f.su("POST", PERCORSI.flusso, esiti.successo({}));
    c(
      "…un rifiuto non tiene in pausa il telefono: al tentativo dopo passa",
      "ok",
      (await invia(b, { ...conferma, chiave: "c|k1|g2" })).esito,
    );
  }

  gruppo("PORTA UNICA · ERRORI: BLOCCO, INCERTO, NIENTE DI RITENTATO");
  {
    const casi = [
      [
        "chiave rifiutata (401)",
        (f) => f.su("POST", PERCORSI.flusso, esiti.nonAutorizzato()),
        "blocco",
        "fallito",
      ],
      [
        "modello rifiutato (400)",
        (f) => f.su("POST", PERCORSI.flusso, esiti.modelloRifiutato()),
        "blocco",
        "fallito",
      ],
      ["rete giù", (f) => f.su("POST", PERCORSI.flusso, esiti.reteGiu()), "incerto", "prenotato"],
      ["500", (f) => f.su("POST", PERCORSI.flusso, esiti.errore500()), "incerto", "prenotato"],
      [
        "lentezza oltre il tempo",
        (f) => f.su("POST", PERCORSI.flusso, esiti.lento()),
        "incerto",
        "prenotato",
      ],
    ];
    for (const [nome, copione, esito, riga] of casi) {
      const f = nuovoFinto();
      copione(f);
      const x = creaPorte({ finto: f });
      const r = await invia(x, conferma);
      c(`${nome}: ${esito}`, esito, r.esito);
      c(
        `${nome}: il flusso si chiama UNA volta (mai una seconda)`,
        1,
        f.percorsi().filter((p) => p === PERCORSI.flusso).length,
      );
      c(`${nome}: la riga del registro resta «${riga}»`, riga, x.righe[0].stato);
    }
    //  Prima dell'invio.
    //  ⚠️ Prima di sendFlow nulla è partito: un guasto qui è un blocco col suo
    //   codice e la riga «fallito» (la conferma non si perde, il telefono non resta
    //   in pausa). `incerto` vero è solo quello di sendFlow/sendContent (sopra).
    const assente = () =>
      nuovoFinto()
        .scenario("assente")
        .su(
          "GET",
          PERCORSI.campi,
          esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]),
        );
    const prima = [
      ["ricerca (rete giù)", () => nuovoFinto().su("GET", PERCORSI.perCampo, esiti.reteGiu())],
      ["ricerca (lentezza)", () => nuovoFinto().su("GET", PERCORSI.perCampo, esiti.lento())],
      [
        "creazione del contatto (500)",
        () => assente().su("POST", PERCORSI.crea, esiti.errore500()),
      ],
      [
        "scrittura dei campi (500)",
        () => nuovoFinto().su("POST", PERCORSI.scriviCampi, esiti.errore500()),
      ],
      [
        "scrittura dei campi (rete giù)",
        () => nuovoFinto().su("POST", PERCORSI.scriviCampi, esiti.reteGiu()),
      ],
    ];
    for (const [nome, crea] of prima) {
      const l = creaPorte({ finto: crea() });
      const r = await invia(l, conferma);
      c(
        `${nome} che non risponde → blocco «non_risponde_prima_invio», sendFlow mai chiamato`,
        ["blocco", "non_risponde_prima_invio", false],
        [r.esito, r.codice, l.f.percorsi().includes(PERCORSI.flusso)],
      );
      c(
        `${nome}: la riga si chiude «fallito» (non resta prenotata, non diventa incerta)`,
        ["fallito", "non_risponde_prima_invio"],
        [l.righe[0].stato, l.righe[0].motivo],
      );
      l.orologio.avanza(30_000);
      l.f.su(
        "GET",
        PERCORSI.perCampo,
        esiti.successo([{ id: 1000001, optin_whatsapp: true, subscribed: true }]),
      );
      l.f.su("POST", PERCORSI.scriviCampi, esiti.successo({}));
      c(
        `${nome}: il telefono non resta in pausa, al tentativo dopo passa`,
        "ok",
        (await invia(l, { ...conferma, chiave: "c|k1|g2" })).esito,
      );
    }
    c(
      "sendFlow incerto resta incerto (è l'unico vero)",
      "incerto",
      (
        await invia(
          creaPorte({ finto: nuovoFinto().su("POST", PERCORSI.flusso, esiti.errore500()) }),
          conferma,
        )
      ).esito,
    );
    const s = creaPorte({
      finto: nuovoFinto().su("POST", PERCORSI.scriviCampi, esiti.nonAutorizzato()),
    });
    c(
      "scrittura dei campi rifiutata → blocco, e il flusso non parte",
      ["blocco", false],
      await invia(s, conferma).then((r) => [r.esito, s.f.percorsi().includes(PERCORSI.flusso)]),
    );
    //  Testo oltre le 24 ore: il codice numerico di ManyChat, non il testo.
    const t = creaPorte({
      finto: nuovoFinto().su("POST", PERCORSI.testo, {
        http: 400,
        corpo: { status: "error", message: "x", code: 3011 },
      }),
    });
    const rt = await invia(t, { testo: "ciao", tipo: "chat", leadId: null });
    c(
      "testo oltre le 24 ore → blocco col codice fuori_24h",
      ["blocco", "fuori_24h"],
      [rt.esito, rt.codice],
    );
    //  Guasti attorno all'invio.
    const senza = creaPorte({ senzaChiave: true });
    c(
      "senza la chiave di ManyChat → blocco, nessuna prenotazione",
      ["blocco", "manca_chiave", []],
      await invia(senza, conferma).then((r) => [r.esito, r.codice, senza.eventi]),
    );
    const reg = creaPorte({ registroGuasto: true });
    c(
      "registro che non risponde → blocco, ManyChat non viene toccato",
      ["blocco", 0],
      await invia(reg, conferma).then((r) => [r.esito, reg.f.chiamate.length]),
    );
    const es = creaPorte({ esitoGuasto: true });
    c(
      "registro che non risponde DOPO l'invio → l'esito resta ok (è partito)",
      "ok",
      (await invia(es, conferma)).esito,
    );
    c(
      "più di 4 parametri → blocco, nessuna chiamata",
      ["blocco", 0],
      await invia(creaPorte(), { ...conferma, parametri: ["1", "2", "3", "4", "5"] }).then((r) => [
        r.esito,
        0,
      ]),
    );
    c(
      "parametri che non sono un elenco → blocco, nessuna eccezione",
      "blocco",
      (await invia(creaPorte(), { ...conferma, parametri: "boh" })).esito,
    );
    c(
      "numero troppo corto → rifiuto del contatto",
      "rifiuto_contatto",
      (await invia(creaPorte(), { ...conferma, a: "12" })).esito,
    );
  }

  gruppo("PORTA UNICA · LA CHAT: GLI ESITI DIVENTANO UNA RISPOSTA PER LA SETTER");
  {
    const rc = (esito, extra = {}) => P.rispostaChat({ esito, ...extra });
    c(
      "ok → 200 con l'id del messaggio",
      { status: 200, corpo: { ok: true, waMessageId: "mc:inv7" } },
      rc("ok", { invioId: "inv7" }),
    );
    c(
      "chat verso un numero in STOP → 403 con la frase per la setter",
      [403, "Questo numero ha chiesto di non ricevere messaggi"],
      ((q) => [q.status, q.corpo.message])(rc("stop")),
    );
    c(
      "pausa per contatto → 429 «riprova fra un minuto»",
      [429, "riprova_fra_poco", true],
      ((q) => [q.status, q.corpo.error, /minuto/.test(q.corpo.message)])(rc("riprova_fra_poco")),
    );
    c("gia_preso → la stessa risposta", 429, rc("gia_preso").status);
    c(
      "da collegare → 422 con la frase",
      [422, true],
      ((q) => [q.status, /da collegare/.test(q.corpo.message)])(rc("da_collegare")),
    );
    c("numero non su WhatsApp → 422", 422, rc("rifiuto_contatto").status);
    c("flusso mancante → 400", 400, rc("flusso_mancante").status);
    c(
      "ManyChat non risponde prima dell'invio → 503, «il messaggio non è partito, riprova»",
      [503, "ManyChat non risponde: il messaggio non è partito, riprova."],
      ((q) => [q.status, q.corpo.message])(rc("blocco", { codice: "non_risponde_prima_invio" })),
    );
    c(
      "troppe variabili → 400 con la frase giusta (non «ManyChat ha rifiutato»)",
      [400, true],
      ((q) => [q.status, /troppe variabili/.test(q.corpo.message)])(
        rc("blocco", { codice: "troppi_parametri" }),
      ),
    );
    c(
      "incerto → 504, dice di controllare in ManyChat",
      [504, true],
      ((q) => [q.status, /ManyChat/.test(q.corpo.message)])(rc("incerto")),
    );
    c(
      "blocco → 502 wa_api_error",
      [502, "wa_api_error", "manychat_rifiutato"],
      ((q) => [q.status, q.corpo.error, q.corpo.category])(rc("blocco")),
    );
    c(
      "oltre le 24 ore → la stessa categoria della Cloud (il webinar la conta a parte)",
      "outside_24h_window",
      rc("blocco", { codice: "fuori_24h" }).corpo.category,
    );
    c("manca la chiave → 503", 503, rc("blocco", { codice: "manca_chiave" }).status);
    c(
      "nessuna risposta porta la chiave o il numero",
      false,
      /chiave-finta|3331234567/.test(
        JSON.stringify(["ok", "stop", "blocco", "incerto"].map((e) => rc(e))),
      ),
    );
  }

  /* ── 2. LA TRADUZIONE PER IL GIRO DELLA CONFERMA (PIANO §1e c) ─────────── */

  gruppo("CONFERMA SU MANYCHAT · LA TABELLA DI TRADUZIONE, RIGA PER RIGA");
  {
    const t = (manychat, extra = {}) => PR.esitoInvio({ manychat, ...extra });
    const cl = (e) => (e.tipo === "rifiuto" ? `${e.errore.tipo}/${e.errore.codice}` : e.tipo);
    c(
      "ok → inviato, con l'id del messaggio",
      { tipo: "ok", waId: "mc:inv1" },
      t("ok", { waId: "mc:inv1" }),
    );
    c("riprova_fra_poco → riprova", "riprova", cl(t("riprova_fra_poco")));
    c("gia_preso → riprova", "riprova", cl(t("gia_preso")));
    c("stop → rifiuto del cliente «disiscritto»", "cliente/disiscritto", cl(t("stop")));
    c(
      "da_collegare → rifiuto del cliente «da_collegare»",
      "cliente/da_collegare",
      cl(t("da_collegare")),
    );
    c(
      "rifiuto_contatto → rifiuto del cliente «non_recapitato» (numero non su WhatsApp)",
      "cliente/non_recapitato",
      cl(t("rifiuto_contatto")),
    );
    c("flusso_mancante → blocco tecnico", "tecnico/manca_flusso", cl(t("flusso_mancante")));
    c("blocco → blocco tecnico", "tecnico/manychat_rifiuta", cl(t("blocco")));
    c("incerto → incerto (come la rete)", "incerto", cl(t("incerto")));
    c("un esito che non conosco → incerto, MAI ok", "incerto", cl(t("boh")));
    //  Il campo manychat si legge PRIMA di status, corpo e rete.
    c(
      "manychat batte status e corpo (un 200 con l'id non rende ok uno stop)",
      "cliente/disiscritto",
      cl(t("stop", { status: 200, corpo: { messages: [{ id: "x" }] } })),
    );
    c("manychat batte rete", "riprova", cl(t("gia_preso", { rete: true })));
    //  Col canale cloud il campo non c'è e la classificazione è quella di sempre.
    const cloud = [
      [{ status: 200, corpo: { messages: [{ id: "wamid.X" }] } }, "ok"],
      [{ rete: true }, "incerto"],
      [{ status: 503, corpo: { error: { code: 2 } } }, "incerto"],
      [{ status: 400, corpo: { error: { code: 190 } } }, "tecnico/token_scaduto"],
      [{ status: 400, corpo: { error: { code: 131026 } } }, "cliente/non_recapitato"],
      [{ status: 200, corpo: {} }, "incerto"],
    ];
    for (const [r, atteso] of cloud)
      c(`cloud ${JSON.stringify(r).slice(0, 48)} → ${atteso}`, atteso, cl(PR.esitoInvio(r)));
    //  «incerto» solo per rete giù, timeout e 5xx: passando dalla porta vera.
    const viaPorta = async (copione) => {
      const f = nuovoFinto();
      copione(f);
      const x = creaPorte({ finto: f });
      return cl(PR.esitoInvio(P.rispostaPerConferma(await invia(x, conferma))));
    };
    c(
      "rete giù → incerto",
      "incerto",
      await viaPorta((f) => f.su("POST", PERCORSI.flusso, esiti.reteGiu())),
    );
    c(
      "timeout → incerto",
      "incerto",
      await viaPorta((f) => f.su("POST", PERCORSI.flusso, esiti.lento())),
    );
    c(
      "500 → incerto",
      "incerto",
      await viaPorta((f) => f.su("POST", PERCORSI.flusso, esiti.errore500())),
    );
    c(
      "401 NON è incerto: è un blocco tecnico",
      "tecnico/manychat_rifiuta",
      await viaPorta((f) => f.su("POST", PERCORSI.flusso, esiti.nonAutorizzato())),
    );
    c(
      "modello rifiutato (400) NON è incerto",
      "tecnico/manychat_rifiuta",
      await viaPorta((f) => f.su("POST", PERCORSI.flusso, esiti.modelloRifiutato())),
    );
    c(
      "contatto non creabile → rifiuto del cliente «da collegare»",
      "cliente/da_collegare",
      await viaPorta((f) =>
        f
          .scenario("assente")
          .su(
            "GET",
            PERCORSI.campi,
            esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]),
          )
          .su("POST", PERCORSI.crea, esiti.errore(400)),
      ),
    );
    //  Le frasi del riquadro per i blocchi nuovi.
    for (const b of ["manca_chiave_manychat", "manca_flusso", "manychat_rifiuta"])
      c(
        `«${b}» ha la sua frase in italiano, senza chiavi`,
        true,
        PR.FRASI_BLOCCO[b]?.length > 30 && !/chiave-finta|Bearer/.test(PR.FRASI_BLOCCO[b]),
      );
    //  Cosa serve per essere «pronti».
    const ok = {
      acceso: true,
      migrazione: true,
      haChiavi: false,
      haWaba: false,
      haAppSecret: false,
      mode: "sandbox",
      modello: { trovato: true, stato: "APPROVED" },
    };
    c(
      "ManyChat: non servono token, App Secret né modalità live",
      true,
      PR.valutaPronto({ ...ok, canale: "manychat", haChiaveManychat: true }).pronto,
    );
    c(
      "ManyChat senza la chiave → manca_chiave_manychat",
      "manca_chiave_manychat",
      PR.valutaPronto({ ...ok, canale: "manychat", haChiaveManychat: false }).blocco,
    );
    c(
      "ManyChat senza il flusso → manca_flusso",
      "manca_flusso",
      PR.valutaPronto({
        ...ok,
        canale: "manychat",
        haChiaveManychat: true,
        modello: { trovato: false },
      }).blocco,
    );
    c(
      "ManyChat spento → spento (viene prima)",
      "spento",
      PR.valutaPronto({ ...ok, canale: "manychat", acceso: false }).blocco,
    );
    c(
      "cloud senza chiavi → mancano_chiavi, come prima",
      "mancano_chiavi",
      PR.valutaPronto({ ...ok, canale: "cloud" }).blocco,
    );
    c("canale assente = cloud, come prima", "mancano_chiavi", PR.valutaPronto({ ...ok }).blocco);
  }

  /* ── 3. IL GIRO DELLA CONFERMA ────────────────────────────────────────── */

  const INIZIO = roma("2026-10-22", "15:00");
  const vecchia = new Date(INIZIO.getTime() - 3600_000).toISOString();
  const LINK = "https://esempio.test/meetly/abc?chi=p1";
  const scheda = (id, d = {}) => ({
    id,
    updated_at: vecchia,
    data: {
      nome: "Mario",
      telefono: "339 1234567",
      stato: "appuntamento_fissato",
      dataMeeting: "2026-10-23",
      oraMeeting: "10:00",
      ...d,
    },
  });
  /** Il telefono della scheda n: tutti diversi. */
  const tel = (n) => `339 123 45${String(n).padStart(2, "0")}`;

  /** Il giro con il database finto (come proveDelGiroDelPromemoria), l'orologio
   *  condiviso col ManyChat finto e la porta VERA (`inviaWhatsapp`) in mezzo. */
  function giroFinto(o = {}) {
    const f = o.finto ?? nuovoFinto(o.ritardoMs ? { ritardoMs: o.ritardoMs } : {});
    if (o.scenario)
      f.scenario(o.scenario).su(
        "GET",
        PERCORSI.campi,
        esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]),
      );
    const x = creaPorte({ finto: f, flussi: o.flussi });
    f.orologio.ms = INIZIO.getTime();
    const db = new Map(
      (o.schede ?? [scheda("s1")]).map((s) => [s.id, JSON.parse(JSON.stringify(s))]),
    );
    const log = [];
    const inizi = [];
    let stato = null;
    let config = o.config === undefined ? { acceso: true, avvio: "fatto" } : o.config;
    let canale = o.canale;
    const porte = {
      adesso: () => f.orologio.adesso(),
      leggiConfig: async () => config,
      scriviConfig: async (q) => {
        config = q;
      },
      leggiStato: async () => stato,
      scriviStato: async (q) => {
        stato = q;
      },
      provaMigrazione: async () => true,
      impostazioni: async () => [
        {
          userId: "u1",
          haChiavi: true,
          haWaba: true,
          haAppSecret: true,
          mode: "live",
          canale,
          haChiaveManychat: true,
        },
      ],
      schede: async () =>
        [...db.values()].map((s) => ({ ...JSON.parse(JSON.stringify(s)), link: LINK })),
      numeriStop: async () => [],
      aggancia: async (id, chiave, pezzo) => {
        const s = db.get(id);
        const p = s.data.promemoria ?? {};
        if ((p.chiave ?? "") === chiave && (p.stato ?? "") !== "") return false;
        s.data.promemoria = { ...p, ...pezzo, chiave };
        return true;
      },
      aggiorna: async (id, pezzo, seChiave) => {
        const s = db.get(id);
        const p = s.data.promemoria ?? {};
        if (seChiave != null && p.chiave !== seChiave) return false;
        s.data.promemoria = { ...p, ...pezzo };
        return true;
      },
      controllaModello: async () => ({ trovato: true, stato: "APPROVED" }),
      //  Come in hooks/promemoria-whatsapp: la porta vera, poi la forma che il giro legge.
      invia: async (imp, numero, parametri, contesto) => {
        inizi.push(f.orologio.ms - giroInizio);
        log.push(`invia:${numero}`);
        if (o.invia) return o.invia(numero);
        return P.rispostaPerConferma(
          await P.inviaWhatsapp(x.porte, {
            canale: imp.canale ?? "cloud",
            a: numero,
            modello: NOME_MODELLO,
            lingua: "it",
            parametri,
            nome: parametri[0],
            leadId: contesto?.leadId ?? null,
            tipo: "conferma",
            chiave: contesto ? `c|${contesto.chiave}|${contesto.giro}` : undefined,
          }),
        );
      },
      registraInvio: async () => {},
    };
    let giroInizio = f.orologio.ms;
    return {
      porte,
      f,
      x,
      db,
      log,
      inizi,
      get stato() {
        return stato;
      },
      get config() {
        return config;
      },
      cambiaCanale: (n) => {
        canale = n;
      },
      /** Un giro; poi l'orologio va avanti di 2 minuti, come il cron. */
      async giro(prova = false) {
        giroInizio = f.orologio.ms;
        inizi.length = 0;
        x.nuovoGiro();
        const r = await G.giroPromemoria(porte, { prova });
        const durata = f.orologio.ms - giroInizio;
        f.orologio.avanza(130_000);
        return { ...r, durata, inizi: [...inizi] };
      },
      segno: (id = "s1") => db.get(id).data.promemoria ?? null,
    };
  }
  const flussoOk = { [NOME_MODELLO]: FLUSSO };

  gruppo("CONFERMA SU MANYCHAT · OGNI ESITO DELLA PORTA NEL GIRO");
  {
    //  Ogni riga della tabella: cosa resta sulla scheda e cosa fa il giro.
    const due = [scheda("s1"), scheda("s2", { telefono: "333 000 1111" })];
    const caso = async (manychat, extra = {}) => {
      const g = giroFinto({
        canale: "manychat",
        schede: due,
        flussi: flussoOk,
        invia: (n) =>
          n.endsWith("1234567") ? { manychat, ...extra } : { manychat: "ok", waId: "mc:ok2" },
      });
      const r = await g.giro();
      return { g, r };
    };
    {
      const { g, r } = await caso("ok", { waId: "mc:inv9" });
      c(
        "ok → segno «inviato» con l'id",
        ["inviato", "mc:inv9", 2],
        [g.segno().stato, g.segno().waMessageId, r.inviati],
      );
    }
    for (const m of ["riprova_fra_poco", "gia_preso"]) {
      const { g, r } = await caso(m);
      c(`${m} → segno tolto, la chiave pure`, [null, null], [g.segno().stato, g.segno().chiave]);
      c(
        `${m} → nessun blocco, nessun riquadro rosso`,
        [true, undefined, null],
        [g.stato.pronto, g.stato.blocco, g.stato.riprovaDopo],
      );
      c(
        `${m} → il giro passa alla scheda dopo (s2 inviata)`,
        [2, "inviato", 1],
        [g.log.filter((x) => x.startsWith("invia")).length, g.segno("s2").stato, r.inviati],
      );
      c(`${m} → il conto dei messaggi della scheda si riabbassa`, 0, g.segno().volte);
    }
    {
      const { g } = await caso("stop");
      c(
        "stop → non_recapitato, motivo «disiscritto»",
        ["non_recapitato", "disiscritto"],
        [g.segno().stato, g.segno().motivo],
      );
      c(
        "…la setter legge la frase giusta",
        true,
        /non ricevere messaggi/.test(
          CF.statoConferma({ ...g.db.get("s1").data, dataMeeting: "2026-10-23" }, INIZIO).nota,
        ),
      );
      c("…e gli altri partono", "inviato", g.segno("s2").stato);
    }
    {
      const { g } = await caso("da_collegare");
      c(
        "da_collegare → non_recapitato, motivo «da_collegare»",
        ["non_recapitato", "da_collegare"],
        [g.segno().stato, g.segno().motivo],
      );
      c(
        "…la scheda compare in «Da sentire» con «contatto ManyChat da collegare»",
        [true, true],
        [
          CF.daSentire([{ id: "s1", data: g.db.get("s1").data }], INIZIO).length === 1,
          /contatto ManyChat da collegare/.test(CF.statoConferma(g.db.get("s1").data, INIZIO).nota),
        ],
      );
      c("…e gli altri partono", "inviato", g.segno("s2").stato);
    }
    {
      const { g } = await caso("rifiuto_contatto");
      c(
        "rifiuto_contatto → non_recapitato, «il numero non è su WhatsApp»",
        ["non_recapitato", true],
        [
          g.segno().stato,
          /non è su WhatsApp/.test(CF.statoConferma(g.db.get("s1").data, INIZIO).nota),
        ],
      );
      c("…e gli altri partono", "inviato", g.segno("s2").stato);
    }
    for (const [m, blocco] of [
      ["flusso_mancante", "manca_flusso"],
      ["blocco", "manychat_rifiuta"],
    ]) {
      const { g } = await caso(m);
      c(
        `${m} → il giro si ferma col motivo «${blocco}»`,
        [false, blocco, true, 1],
        [
          g.stato.pronto,
          g.stato.blocco,
          !!g.stato.riprovaDopo,
          g.log.filter((x) => x.startsWith("invia")).length,
        ],
      );
      c(
        `${m} → segno tolto (si riprova), conto abbassato`,
        [null, 0],
        [g.segno().stato, g.segno().volte],
      );
      c(
        `${m} → la scheda compare in «Da sentire» con «WhatsApp in passaggio a ManyChat»`,
        [true, "conferma non partita: WhatsApp in passaggio a ManyChat"],
        [
          CF.daSentire([{ id: "s1", data: g.db.get("s1").data }], INIZIO).length === 1,
          CF.statoConferma(g.db.get("s1").data, INIZIO).nota,
        ],
      );
      //  Il canale torna a posto: lo stesso appuntamento riparte da solo.
      const dopo = giroFinto({
        canale: "manychat",
        schede: [{ ...scheda("s1"), data: { ...g.db.get("s1").data } }],
        flussi: flussoOk,
      });
      await dopo.giro();
      c(
        `${m} → appena il canale è a posto parte la conferma, e la frase sparisce`,
        ["inviato", null],
        [dopo.segno().stato, dopo.segno().motivo],
      );
    }
    {
      const { g } = await caso("incerto");
      c(
        "incerto → il segno RESTA (in_invio), il giro si ferma e aspetta",
        ["in_invio", "meta_incerto", true, 1],
        [
          g.segno().stato,
          g.stato.blocco,
          !!g.stato.riprovaDopo,
          g.log.filter((x) => x.startsWith("invia")).length,
        ],
      );
      const dopo = giroFinto({
        canale: "manychat",
        schede: [{ ...scheda("s1"), data: { ...g.db.get("s1").data } }],
        flussi: flussoOk,
      });
      dopo.f.orologio.avanza(11 * 60_000);
      await dopo.giro();
      c(
        "…passati 10 minuti diventa «incerto» e non si rimanda mai",
        ["incerto", 0],
        [dopo.segno().stato, dopo.log.filter((x) => x.startsWith("invia")).length],
      );
    }
    {
      //  Nel giro: segno tolto col motivo «canale», in «Da sentire», niente «meta_incerto».
      const g = giroFinto({
        canale: "manychat",
        flussi: { [NOME_MODELLO]: FLUSSO },
        finto: nuovoFinto().su("GET", PERCORSI.perCampo, esiti.reteGiu()),
      });
      await g.giro();
      c(
        "nel giro: blocco tecnico (non «meta_incerto»), segno tolto con motivo «canale»",
        ["manychat_rifiuta", null, "canale"],
        [g.stato.blocco, g.segno().stato, g.segno().motivo],
      );
      c(
        "…la scheda è in «Da sentire» e il registro non ha righe «incerto»",
        [1, 0],
        [
          CF.daSentire([{ id: "s1", data: g.db.get("s1").data }], INIZIO).length,
          g.x.righe.filter((r) => r.stato === "incerto" || r.stato === "prenotato").length,
        ],
      );
    }
    {
      const { g } = await caso("boh");
      c(
        "un esito sconosciuto → incerto, mai «inviato»",
        ["in_invio", "meta_incerto"],
        [g.segno().stato, g.stato.blocco],
      );
    }
  }

  gruppo("CONFERMA SU MANYCHAT · 2 PER GIRO E 20 SECONDI");
  {
    //  5 prenotazioni insieme, il ManyChat finto a 3 s per chiamata, contatti NUOVI (il caso peggiore).
    const cinque = Array.from({ length: 5 }, (_, i) =>
      scheda(`p${i + 1}`, { telefono: tel(i + 1) }),
    );
    const g = giroFinto({
      canale: "manychat",
      schede: cinque,
      flussi: flussoOk,
      ritardoMs: 3000,
      scenario: "assente",
    });
    const giri = [];
    for (let i = 0; i < 3; i++) giri.push(await g.giro());
    c(
      "5 prenotazioni insieme, 3 s per chiamata → 2 + 2 + 1 conferme in 3 giri",
      [2, 2, 1],
      giri.map((r) => r.inviati),
    );
    c(
      "…tutte e cinque «inviato»",
      5,
      cinque.filter((s) => g.segno(s.id)?.stato === "inviato").length,
    );
    c(
      "…ZERO «incerto» (né sul segno né nel registro)",
      [0, 0],
      [
        cinque.filter((s) => g.segno(s.id)?.stato === "incerto").length,
        g.x.righe.filter((r) => r.stato === "incerto" || r.stato === "prenotato").length,
      ],
    );
    c(
      "…e il flusso è partito cinque volte, non una di più",
      5,
      g.f.percorsi().filter((p) => p === PERCORSI.flusso).length,
    );
    c(
      "…nessun giro è andato oltre i 20 s di invii nuovi",
      true,
      giri.every((r) => r.inizi.every((ms) => ms < 20_000)),
    );
    c(
      "…e nessun giro è durato più dei 45 s che il cron aspetta",
      true,
      giri.every((r) => r.durata < 45_000),
    );
    c(
      "…il riquadro non è mai diventato rosso",
      [true, undefined],
      [g.stato.pronto, g.stato.blocco],
    );
    c(
      "…il giro lo dice: gli altri aspettano il giro dopo",
      [3, 1, 0],
      giri.map((r) => r.inAttesa),
    );
    c(
      "registro: cinque righe «inviato», una per telefono",
      [5, 5],
      [
        g.x.righe.filter((r) => r.stato === "inviato").length,
        new Set(g.x.righe.map((r) => r.telefono)).size,
      ],
    );
  }
  {
    //  Il caso «contatto già in ManyChat»: meno chiamate, stessi giri.
    const cinque = Array.from({ length: 5 }, (_, i) =>
      scheda(`p${i + 1}`, { telefono: tel(i + 1) }),
    );
    const g = giroFinto({ canale: "manychat", schede: cinque, flussi: flussoOk, ritardoMs: 3000 });
    const giri = [await g.giro(), await g.giro(), await g.giro()];
    c(
      "contatti già in ManyChat: ancora 2 + 2 + 1, zero incerto",
      [[2, 2, 1], 0],
      [giri.map((r) => r.inviati), g.x.righe.filter((r) => r.stato !== "inviato").length],
    );
  }
  {
    //  ManyChat velocissimo: il tempo non c'entra, lo ferma il tetto di 2 per giro.
    const cinque = Array.from({ length: 5 }, (_, i) =>
      scheda(`p${i + 1}`, { telefono: tel(i + 1) }),
    );
    const g = giroFinto({ canale: "manychat", schede: cinque, flussi: flussoOk });
    const giri = [await g.giro(), await g.giro(), await g.giro()];
    c(
      "ManyChat veloce (0 s a chiamata): lo ferma il tetto, 2 + 2 + 1",
      [2, 2, 1],
      giri.map((r) => r.inviati),
    );
  }
  {
    //  Chiamate lente: dopo 20 s non se ne apre un'altra.
    const cinque = Array.from({ length: 5 }, (_, i) =>
      scheda(`p${i + 1}`, { telefono: tel(i + 1) }),
    );
    const g = giroFinto({ canale: "manychat", schede: cinque, flussi: flussoOk, ritardoMs: 6000 });
    const r = await g.giro();
    c(
      "chiamate da 6 s: la prima finisce a 24 s, la seconda non si apre",
      [1, 4, 24_000],
      [r.inviati, r.inAttesa, r.durata],
    );
    c(
      "…e il flusso è partito una volta sola",
      1,
      g.f.percorsi().filter((p) => p === PERCORSI.flusso).length,
    );
    c("…la seconda scheda non ha nessun segno (al giro dopo)", null, g.segno("p2"));
    const seguenti = [r.inviati];
    for (let i = 0; i < 4; i++) seguenti.push((await g.giro()).inviati);
    c(
      "…e in cinque giri partono tutte, mai una due volte",
      [[1, 1, 1, 1, 1], 5],
      [seguenti, g.f.percorsi().filter((p) => p === PERCORSI.flusso).length],
    );
  }
  {
    //  Col canale cloud: 15 per giro, senza limite di tempo, come oggi.
    const venti = Array.from({ length: 20 }, (_, i) => scheda(`t${i}`, { telefono: tel(i + 1) }));
    const g = giroFinto({ canale: "cloud", schede: venti, ritardoMs: 0 });
    g.f.orologio.ms = INIZIO.getTime();
    const r = await g.giro();
    c("canale cloud: 15 per giro, il resto al giro dopo", [15, 5], [r.inviati, r.inAttesa]);
    const senza = giroFinto({ schede: venti });
    const r2 = await senza.giro();
    c(
      "canale assente (come prima del 23/10): 15 e 5, identico",
      [15, 5],
      [r2.inviati, r2.inAttesa],
    );
    //  Anche con il tempo che passa: col cloud non c'è il limite dei 20 s.
    const lento = giroFinto({ canale: "cloud", schede: venti });
    const orig = lento.porte.invia;
    lento.porte.invia = async (...a) => {
      lento.f.orologio.avanza(5000);
      return orig(...a);
    };
    const r3 = await lento.giro();
    c("cloud: 5 s a messaggio non fermano il giro (nessun limite di tempo)", 15, r3.inviati);
    c(
      "cloud: nessuna chiamata a ManyChat, il corpo Graph di sempre",
      [0, "consulenza_conferma_presenza"],
      [lento.f.chiamate.length, lento.x.cloud[0].template.name],
    );
  }

  gruppo("CONFERMA SU MANYCHAT · CAMBIO DI CANALE, `avvio` NON SI TOCCA");
  {
    const g = giroFinto({ canale: "cloud", schede: [scheda("s1")], flussi: flussoOk });
    await g.giro();
    c("giro sul cloud: s1 inviata", ["inviato", "fatto"], [g.segno().stato, g.config.avvio]);
    g.cambiaCanale("manychat");
    g.db.set("s2", scheda("s2", { telefono: "333 000 1111" }));
    const r = await g.giro();
    c("passato a ManyChat: avvio resta «fatto»", "fatto", g.config.avvio);
    c(
      "…s1 non si rimanda, s2 parte da ManyChat (id mc:…)",
      [1, true],
      [r.inviati, g.segno("s2").waMessageId.startsWith("mc:")],
    );
    c(
      "…ManyChat ha ricevuto una sola conferma (quella di s2)",
      1,
      g.f.percorsi().filter((p) => p === PERCORSI.flusso).length,
    );
    //  La prima accensione: preesistenti, nessuna chiamata, avvio → fatto.
    const n = giroFinto({
      canale: "manychat",
      config: { acceso: true, avvio: "da_fare" },
      schede: [scheda("s1")],
      flussi: flussoOk,
    });
    const q = await n.giro();
    c(
      "primo giro dopo l'accensione, su ManyChat: preesistente, zero chiamate",
      ["preesistente", 0, 0, "fatto"],
      [n.segno().stato, q.inviati, n.f.chiamate.length, n.config.avvio],
    );
    //  Il giro non scrive mai il canale né l'avvio per conto suo.
    c(
      "con il canale ManyChat la configurazione scritta resta quella di prima, tranne `avvio` al primo giro",
      { acceso: true, avvio: "fatto" },
      n.config,
    );
  }

  gruppo("CONFERMA SU MANYCHAT · LA STRISCIA «DA SENTIRE» E LE FRASI");
  {
    const K = "2026-10-23T10:00|391234567";
    const base = {
      nome: "Mario",
      telefono: "339 1234567",
      stato: "appuntamento_fissato",
      dataMeeting: "2026-10-23",
      oraMeeting: "10:00",
    };
    const d = (p) => ({ ...base, promemoria: p });
    const nota = (p) => CF.statoConferma(d(p), INIZIO);
    c(
      "chiave c'è, stato vuoto, motivo «canale» → non confermato, con la frase",
      { tipo: "nonConfermato", nota: "conferma non partita: WhatsApp in passaggio a ManyChat" },
      nota({ chiave: K, stato: null, motivo: "canale" }),
    );
    c(
      "…appuntamento spostato: la frase tace",
      { tipo: "nessuno" },
      CF.statoConferma(
        { ...d({ chiave: K, stato: null, motivo: "canale" }), oraMeeting: "11:00" },
        INIZIO,
      ),
    );
    c(
      "…appuntamento già iniziato: tace",
      { tipo: "nessuno" },
      CF.statoConferma(
        d({ chiave: K, stato: null, motivo: "canale" }),
        roma("2026-10-23", "11:00"),
      ),
    );
    c(
      "…lo stato vuoto SENZA il motivo «canale» resta com'era (nessuno)",
      { tipo: "nessuno" },
      nota({ chiave: K, stato: null, volte: 0 }),
    );
    c(
      "…la chiave tolta (segno del Cloud) resta com'era (nessuno)",
      { tipo: "nessuno" },
      nota({ chiave: null, stato: null, motivo: "canale" }),
    );
    c(
      "…«inviato» e «preesistente» come prima",
      [{ tipo: "inviato" }, { tipo: "nessuno" }],
      [
        nota({ chiave: K, stato: "inviato", inviatoIl: INIZIO.toISOString() }),
        nota({ chiave: K, stato: "preesistente" }),
      ],
    );
    c(
      "compare fra le consulenze «Da sentire» delle prossime 48 ore",
      1,
      CF.daSentire([{ id: "s1", data: d({ chiave: K, stato: null, motivo: "canale" }) }], INIZIO)
        .length,
    );
    c(
      "…e non fra quelle già confermate",
      0,
      CF.daSentire(
        [
          {
            id: "s1",
            data: d({
              chiave: K,
              stato: "inviato",
              confermatoIl: INIZIO.toISOString(),
              inviatoIl: INIZIO.toISOString(),
            }),
          },
        ],
        INIZIO,
      ).length,
    );
  }

  gruppo("PORTA UNICA · LE RETI DI SICUREZZA NEL CODICE");
  {
    const leggi = (f) => readFileSync(join(radice, f), "utf8");
    const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const api = senzaCommenti(leggi("src/crm/manychat/api.ts"));
    const porta = senzaCommenti(leggi("src/crm/manychat/porta.ts"));
    const server = senzaCommenti(leggi("src/crm/manychat/porta.server.ts"));
    const hook = senzaCommenti(leggi("src/routes/hooks/promemoria-whatsapp.ts"));
    const invio = senzaCommenti(leggi("src/routes/api.whatsapp-send.ts"));
    const diagnosi = senzaCommenti(leggi("src/routes/api.whatsapp-diagnose.ts"));
    c(
      "api.ts e porta.ts non toccano né process.env né il fetch globale",
      false,
      /process\.env|globalThis|(?<![.\w])fetch\(/.test(api + porta),
    );
    c(
      "la chiave di ManyChat si legge in un posto solo: porta.server.ts",
      [true, false],
      [
        /MANYCHAT_API_KEY/.test(server),
        /MANYCHAT_API_KEY/.test(api + porta + hook + invio + diagnosi),
      ],
    );
    c(
      "nessuna chiave scritta nel codice (bearer, token o chiavi lunghe)",
      false,
      /Bearer [A-Za-z0-9]{12,}|[A-Za-z0-9]{40,}/.test(api + porta + server),
    );
    c(
      "nei log solo codici: nessun console.* che stampi corpo, numero o chiave",
      false,
      /console\.\w+\([^)]*(corpo|testo|numero|chiave|\bbody\b|\bto\b)/.test(api + porta + server),
    );
    c(
      "la conferma passa dalla porta, con il tipo «conferma»",
      true,
      /inviaWhatsapp\(/.test(hook) &&
        /tipo: "conferma"/.test(hook) &&
        /rispostaPerConferma\(/.test(hook),
    );
    c(
      "…e il controllo del modello, col canale ManyChat, guarda il flusso",
      true,
      /canale === "manychat"[\s\S]{0,200}flussi\.get/.test(hook),
    );
    c(
      "…la riga di whatsapp_messages col canale ManyChat la scrive la porta, non il giro",
      true,
      /canale === "manychat"\) return;/.test(hook),
    );
    c(
      "la chat passa dalla porta col canale ManyChat e risponde con rispostaChat",
      true,
      /canale\.canale === "manychat"/.test(invio) &&
        /rispostaChat\(/.test(invio) &&
        /tipo: "chat"/.test(invio),
    );
    c(
      "…il canale si legge PRIMA delle chiavi Cloud, e un guasto non ripiega sul Cloud",
      true,
      invio.indexOf("leggiCanale(") < invio.indexOf("whatsapp_settings") &&
        /canale_non_leggibile/.test(invio),
    );
    c(
      "…il corpo Graph lo scrive corpoGraph, non una copia",
      [true, false],
      [/corpoGraph\(/.test(invio), /messaging_product/.test(invio)],
    );
    c(
      "la diagnosi, col canale ManyChat, risponde prima di chiamare Graph",
      true,
      diagnosi.indexOf('canale.canale === "manychat"') > 0 &&
        diagnosi.indexOf('canale.canale === "manychat"') < diagnosi.indexOf("graph.facebook.com"),
    );
    c(
      "senza la migrazione M1 il canale è «cloud»",
      true,
      /mancaTabella\(error\)\) return \{ canale: "cloud"/.test(server),
    );
  }
}
