/** ── PROVE: IL CONTROLLO IN PORTA (inviaWhatsapp) ──────────────────────────
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T3. Il controllo unico sta in testa a
 *  `inviaWhatsapp` (`manychat/porta.ts`), prima della scelta del canale:
 *   - ogni richiesta dichiara `messaggio`: una chiave del catalogo oppure «manuale»;
 *   - chiave del catalogo → si chiede `porte.interruttore(chiave)`: solo `true` lascia partire;
 *     falso, non vero, porta assente o che lancia = «spento» (fail-closed);
 *   - «manuale» → la porta dell'interruttore non si consulta mai;
 *   - qualunque altra cosa (assente, `null` da `chiaveDi`, chiave ignota) = «spento»: non si invia;
 *   - un messaggio spento NON tocca niente: né Meta, né ManyChat, né il registro `manychat_invii`
 *     (una riga «saltato» brucerebbe la chiave dell'evento), né `whatsapp_messages`.
 *  Il collegamento al database (`porta.server.ts`) si legge come testo.
 *
 *  Dati inventati. `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creaFinto, esiti, PERCORSI } from "../manychat/finto.mjs";

const NUMERO = "393331234567";
const MODELLO = "consulenza_conferma_presenza";
const FLUSSO = "content-finto-1";
const PARAMETRI = ["Maria", "domani", "10:00", "https://esempio.test/stanza?chi=p1"];
const CHIAVE_EVENTO = "c|k1|g1";

/** I 12 tipi del registro (`TipoInvio` di `crm/types.ts`). */
const TIPI = [
  "promemoria",
  "ricontatto",
  "conferma",
  "chat",
  "webinar",
  "prova",
  "primo_contatto",
  "richiamo_24h",
  "meet_oggi",
  "meet_domani",
  "meet_adesso",
  "promemoria_chiamata",
  "promemoria_sede",
  "ritorno",
  "casi_reali",
];

export async function provePortaMessaggi(mod, { c, gruppo, radice }) {
  const P = mod["manychat/porta"];
  const A = mod["manychat/api"];
  const CAT = mod["messaggi-automatici/catalogo"];

  /** Le porte della porta, TUTTE con un contatore: la prova dice quali sono state toccate. */
  function creaPorte(o = {}) {
    const f = creaFinto().su(
      "GET",
      PERCORSI.campi,
      esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]),
    );
    const conteggi = {};
    const cloud = [];
    const registrate = [];
    const prenotate = [];
    const interrogate = [];
    const conta = (nome) => (conteggi[nome] = (conteggi[nome] ?? 0) + 1);
    const client = A.creaClient({ chiave: "chiave-finta-0000", fetch: f.fetch, timeoutMs: 25 });
    const porte = {
      adesso: () => f.orologio.adesso(),
      client: () => {
        conta("client");
        return client;
      },
      flusso: async () => {
        conta("flusso");
        return FLUSSO;
      },
      prenota: async (p) => {
        conta("prenota");
        prenotate.push(p);
        return { id: `inv${prenotate.length}` };
      },
      esito: async () => {
        conta("esito");
      },
      subscriberNoto: async () => {
        conta("subscriberNoto");
        return null;
      },
      registra: async (m) => {
        conta("registra");
        registrate.push(m);
      },
      cloud: async (corpo) => {
        conta("cloud");
        cloud.push(corpo);
        return { status: 200, corpo: { messages: [{ id: "wamid.1" }] } };
      },
      ultimaEntrata: async () => {
        conta("ultimaEntrata");
        return null;
      },
      modelliUtility: async () => {
        conta("modelliUtility");
        return false;
      },
    };
    if ("interruttore" in o)
      if (o.interruttore !== undefined)
        porte.interruttore = (chiave) => {
          interrogate.push(chiave);
          return o.interruttore(chiave);
        };
    /** Quante volte è stata toccata una porta QUALSIASI tranne `interruttore`. */
    const toccate = () =>
      Object.values(conteggi).reduce((a, b) => a + b, 0) + f.chiamate.length + cloud.length;
    return { porte, f, cloud, registrate, prenotate, interrogate, conteggi, toccate };
  }

  const richiesta = (canale, tipo, messaggio, extra = {}) => ({
    canale,
    a: `+${NUMERO}`,
    modello: MODELLO,
    parametri: PARAMETRI,
    nome: "Maria Rossi",
    leadId: "00000000-0000-4000-8000-000000000001",
    chiave: CHIAVE_EVENTO,
    tipo,
    messaggio,
    ...extra,
  });

  const spento = (r) => r.esito === "spento";

  /* ── 1. MESSAGGIO SPENTO: nessuna porta toccata, nessuna riga ─────────── */

  gruppo("CONTROLLO IN PORTA · SPENTO: ZERO CHIAMATE, PER OGNI CHIAVE E PER I DUE CANALI");
  {
    const chiavi = CAT.CHIAVI_MESSAGGI;
    c("le chiavi del catalogo sono 25", 25, chiavi.length);
    for (const canale of ["cloud", "manychat"]) {
      const sporche = [];
      const codici = [];
      for (const chiave of chiavi) {
        const x = creaPorte({ interruttore: async () => false });
        const r = await P.inviaWhatsapp(x.porte, richiesta(canale, "ricontatto", chiave));
        if (!spento(r) || x.toccate() !== 0 || x.registrate.length || x.prenotate.length)
          sporche.push(chiave);
        if (x.interrogate.length !== 1 || x.interrogate[0] !== chiave) sporche.push(`${chiave}!`);
        codici.push(r.codice);
        if (r.invioId !== undefined || r.status !== undefined || r.rete !== undefined)
          sporche.push(`${chiave}?`);
      }
      c(
        `${canale}: interruttore falso → «spento» per tutte le 25 chiavi, nessuna porta toccata`,
        [],
        sporche,
      );
      c(
        `${canale}: il codice nei log è interruttore_spento_<chiave> (mai numeri né testi)`,
        chiavi.map((k) => `interruttore_spento_${k}`),
        codici,
      );
    }

    //  Tutti i tipi di invio, con la chiave giusta per ognuno (come la ricava il giro).
    for (const canale of ["cloud", "manychat"]) {
      const sporche = [];
      for (const tipo of TIPI) {
        const x = creaPorte({ interruttore: async () => false });
        const r = await P.inviaWhatsapp(x.porte, richiesta(canale, tipo, "primo_contatto"));
        if (!spento(r) || x.toccate() !== 0) sporche.push(tipo);
      }
      c(`${canale}: spento per ognuno dei ${TIPI.length} tipi, nessuna porta toccata`, [], sporche);
    }

    //  Il caso che conta di più: la riga di `manychat_invii` NON nasce (bruciava la chiave dell'evento).
    const x = creaPorte({ interruttore: async () => false });
    await P.inviaWhatsapp(x.porte, richiesta("manychat", "meet_domani", "meet_domani"));
    c(
      "spento: nessuna prenotazione, nessun esito, nessuna riga in whatsapp_messages, nessuna chiamata a ManyChat",
      [0, 0, 0, 0, 0],
      [
        x.conteggi.prenota ?? 0,
        x.conteggi.esito ?? 0,
        x.registrate.length,
        x.f.chiamate.length,
        x.conteggi.client ?? 0,
      ],
    );
    //  E riacceso, con la STESSA chiave unica, parte: la chiave non è stata bruciata.
    const stessa = creaPorte({ interruttore: async () => true });
    const rr = await P.inviaWhatsapp(
      stessa.porte,
      richiesta("manychat", "meet_domani", "meet_domani"),
    );
    c(
      "riacceso, la stessa chiave dell'evento parte (prenotata una volta sola)",
      ["ok", 1, CHIAVE_EVENTO],
      [rr.esito, stessa.prenotate.length, stessa.prenotate[0]?.chiave],
    );

    //  Il controllo viene PRIMA di ogni validazione e di ogni lettura: un numero storto o troppi
    //  parametri non cambiano la risposta, e il modello nuovo (`modelliUtility`) non si interroga.
    const storto = creaPorte({ interruttore: async () => false });
    const r1 = await P.inviaWhatsapp(
      storto.porte,
      richiesta("manychat", "ricontatto", "ricontatto_fissato", {
        a: "12",
        parametri: ["a", "b", "c", "d", "e"],
      }),
    );
    c(
      "il controllo viene prima della validazione (numero e parametri non contano)",
      true,
      spento(r1),
    );
    const testo = creaPorte({ interruttore: async () => false });
    const r2 = await P.inviaWhatsapp(testo.porte, {
      canale: "manychat",
      a: `+${NUMERO}`,
      testo: "Buongiorno",
      tipo: "chat",
      messaggio: "prenota_chat",
    });
    c("anche il testo libero, senza modello, è fermato", [true, 0], [spento(r2), testo.toccate()]);
  }

  /* ── 2. IL CONTROLLO NON SI PUÒ SALTARE: guasti, assenza, valori strani ─ */

  gruppo("CONTROLLO IN PORTA · FAIL-CLOSED: GUASTO, ASSENTE, NON VERO = NON SI INVIA");
  {
    const varianti = [
      [
        "lancia in modo sincrono",
        () => {
          throw new Error("db giù");
        },
      ],
      [
        "rifiuta la promessa",
        async () => {
          throw new Error("db giù");
        },
      ],
      ["risponde undefined", async () => undefined],
      ["risponde null", async () => null],
      ["risponde la stringa «true»", async () => "true"],
      ["risponde 1", async () => 1],
      ["risponde un oggetto", async () => ({ acceso: true })],
    ];
    for (const canale of ["cloud", "manychat"]) {
      for (const [nome, f] of varianti) {
        const x = creaPorte({ interruttore: f });
        const r = await P.inviaWhatsapp(
          x.porte,
          richiesta(canale, "ricontatto", "ricontatto_fissato"),
        );
        c(
          `${canale}: l'interruttore ${nome} → «spento», niente parte`,
          [true, 0],
          [spento(r), x.toccate()],
        );
      }
      const senza = creaPorte({});
      const r = await P.inviaWhatsapp(
        senza.porte,
        richiesta(canale, "ricontatto", "ricontatto_fissato"),
      );
      c(
        `${canale}: porta dell'interruttore ASSENTE con una chiave → «spento»`,
        [true, 0],
        [spento(r), senza.toccate()],
      );
    }
    const guasto = creaPorte({
      interruttore: async () => {
        throw new Error("db giù");
      },
    });
    const rg = await P.inviaWhatsapp(
      guasto.porte,
      richiesta("cloud", "ricontatto", "ricontatto_fissato"),
    );
    c(
      "un guasto del controllo ha un codice suo (non quello di «spento»)",
      "interruttore_non_leggibile",
      rg.codice,
    );
    c("il codice non contiene testi dell'errore", false, /db giù/.test(JSON.stringify(rg)));
  }

  gruppo("CONTROLLO IN PORTA · SENZA UNA CHIAVE VALIDA NON SI INVIA");
  {
    const nonValidi = [
      ["assente", undefined],
      ["null (chiaveDi: «nessuna chiave»)", null],
      ["stringa vuota", ""],
      ["chiave che non è nel catalogo", "messaggio_inventato"],
      ["«Manuale» con la maiuscola", "Manuale"],
      ["«manuale » con lo spazio", "manuale "],
      ["un numero", 7],
      ["un oggetto", { chiave: "primo_contatto" }],
      ["un elenco", ["primo_contatto"]],
      ["un tipo di invio al posto della chiave", "ricontatto"],
    ];
    for (const canale of ["cloud", "manychat"]) {
      for (const [nome, valore] of nonValidi) {
        //  Anche con l'interruttore SEMPRE vero: la chiave manca, non si invia.
        const x = creaPorte({ interruttore: async () => true });
        const r = await P.inviaWhatsapp(x.porte, richiesta(canale, "ricontatto", valore));
        c(
          `${canale}: messaggio ${nome} → «spento», niente parte, l'interruttore non è consultato`,
          [true, 0, 0, "messaggio_non_valido"],
          [spento(r), x.toccate(), x.interrogate.length, r.codice],
        );
      }
    }
    //  Una richiesta senza il campo `messaggio` (chiamante vecchio) non passa.
    const x = creaPorte({ interruttore: async () => true });
    const { messaggio: _tolto, ...senzaCampo } = richiesta(
      "manychat",
      "conferma",
      "conferma_consulenza",
    );
    const r = await P.inviaWhatsapp(x.porte, senzaCampo);
    c("richiesta senza il campo `messaggio`: non parte", [true, 0], [spento(r), x.toccate()]);
  }

  /* ── 3. «MANUALE»: la porta dell'interruttore non si consulta ─────────── */

  gruppo("CONTROLLO IN PORTA · «MANUALE» NON PASSA DALL'INTERRUTTORE");
  {
    for (const canale of ["cloud", "manychat"]) {
      //  Interruttore falso, che lancia, assente: il messaggio a mano parte lo stesso.
      const varianti = [
        ["falso", { interruttore: async () => false }],
        [
          "che lancia",
          {
            interruttore: async () => {
              throw new Error("db giù");
            },
          },
        ],
        ["assente", {}],
      ];
      for (const [nome, o] of varianti) {
        const x = creaPorte(o);
        const r = await P.inviaWhatsapp(x.porte, richiesta(canale, "chat", "manuale"));
        c(
          `${canale}: «manuale» con l'interruttore ${nome} → parte (ok)`,
          ["ok", 0],
          [r.esito, x.interrogate.length],
        );
      }
    }
    const x = creaPorte({ interruttore: async () => false });
    await P.inviaWhatsapp(x.porte, richiesta("manychat", "chat", "manuale"));
    c(
      "manuale su ManyChat: prenotato e inviato come sempre (una prenotazione, il flusso)",
      [1, true],
      [x.prenotate.length, x.f.chiamate.some((q) => q.percorso === "/fb/sending/sendFlow")],
    );
  }

  /* ── 4. ACCESO: tutto com'era prima ─────────────────────────────────── */

  gruppo("CONTROLLO IN PORTA · ACCESO: IL CORPO E LE CHIAMATE SONO QUELLI DI PRIMA");
  {
    //  Il corpo Graph con l'interruttore vero è identico a quello di `corpoGraph` (e a quello di «manuale»).
    const richiestaCloud = richiesta("cloud", "conferma", "conferma_consulenza", { lingua: "it" });
    const acceso = creaPorte({ interruttore: async () => true });
    const r = await P.inviaWhatsapp(acceso.porte, richiestaCloud);
    const atteso = P.corpoGraph({
      a: richiestaCloud.a,
      modello: MODELLO,
      lingua: "it",
      parametri: PARAMETRI,
    });
    c("cloud, acceso: esito ok con stato e corpo di Graph", ["ok", 200], [r.esito, r.status]);
    c("cloud, acceso: il corpo Graph è identico a prima", [atteso], acceso.cloud);
    const aMano = creaPorte({});
    await P.inviaWhatsapp(aMano.porte, { ...richiestaCloud, messaggio: "manuale" });
    c("cloud: acceso e «manuale» mandano lo stesso identico corpo", aMano.cloud, acceso.cloud);
    c(
      "cloud, acceso: l'interruttore è chiesto una volta, con la chiave dichiarata",
      ["conferma_consulenza"],
      acceso.interrogate,
    );

    //  ManyChat: la stessa catena di chiamate con interruttore vero e con «manuale».
    const m1 = creaPorte({ interruttore: async () => true });
    const rm = await P.inviaWhatsapp(
      m1.porte,
      richiesta("manychat", "conferma", "conferma_consulenza"),
    );
    const m2 = creaPorte({});
    await P.inviaWhatsapp(m2.porte, richiesta("manychat", "conferma", "manuale"));
    c("manychat, acceso: esito ok", "ok", rm.esito);
    c(
      "manychat, acceso: le stesse chiamate a ManyChat di «manuale»",
      m2.f.chiamate.map((q) => `${q.metodo} ${q.percorso}`),
      m1.f.chiamate.map((q) => `${q.metodo} ${q.percorso}`),
    );
    c(
      "manychat, acceso: una sola prenotazione e una riga in whatsapp_messages",
      [1, 1],
      [m1.prenotate.length, m1.registrate.length],
    );

    //  Una chiave per volta: l'interruttore riceve esattamente quella dichiarata.
    const chiavi = CAT.CHIAVI_MESSAGGI.filter((k) => k !== "prenota_chat");
    const viste = [];
    for (const k of chiavi) {
      const y = creaPorte({ interruttore: async (chiave) => (viste.push(chiave), true) });
      await P.inviaWhatsapp(y.porte, richiesta("cloud", "ricontatto", k));
    }
    c("acceso: l'interruttore riceve la chiave dichiarata, mai un tipo", chiavi, viste);

    //  Si legge a ogni invio, non una volta per vita delle porte: spegnere vale subito.
    let acc = true;
    const z = creaPorte({ interruttore: async () => acc });
    const primo = await P.inviaWhatsapp(
      z.porte,
      richiesta("cloud", "ricontatto", "ricontatto_fissato"),
    );
    acc = false;
    const secondo = await P.inviaWhatsapp(
      z.porte,
      richiesta("cloud", "ricontatto", "ricontatto_fissato"),
    );
    c(
      "spento fra un invio e l'altro: il secondo si ferma",
      ["ok", "spento", 1],
      [primo.esito, secondo.esito, z.cloud.length],
    );
  }

  /* ── 5. COME LO LEGGONO CHAT E CONFERMA ──────────────────────────────── */

  gruppo("CONTROLLO IN PORTA · L'ESITO «SPENTO» NON È MAI UN INVIO NÉ UN GUASTO DI CANALE");
  {
    const x = creaPorte({ interruttore: async () => false });
    const r = await P.inviaWhatsapp(
      x.porte,
      richiesta("manychat", "conferma", "conferma_consulenza"),
    );
    c(
      "il risultato è solo {esito, codice}: niente id di invio, niente stato Graph, niente rete",
      ["spento", "interruttore_spento_conferma_consulenza", ["codice", "esito"]],
      [r.esito, r.codice, Object.keys(r).sort()],
    );
    c(
      "per la conferma resta un esito del canale (manychat: «spento»), non una risposta Graph",
      { manychat: "spento" },
      P.rispostaPerConferma(r),
    );
    const chat = P.rispostaChat(r);
    c(
      "per la chat: 409 con un'etichetta e una frase per la setter",
      [409, "spento", true],
      [
        chat.status,
        chat.corpo.error,
        typeof chat.corpo.message === "string" && chat.corpo.message.length > 10,
      ],
    );
    c(
      "la frase per la setter non contiene la chiave tecnica né la parola «errore»",
      false,
      /interruttore_spento|errore/i.test(String(chat.corpo.message)),
    );
  }

  /* ── 6. IL SORGENTE: il controllo è in testa, il collegamento è chiuso ─ */

  gruppo("CONTROLLO IN PORTA · NEL SORGENTE");
  {
    const porta = readFileSync(join(radice, "src/crm/manychat/porta.ts"), "utf8");
    const server = readFileSync(join(radice, "src/crm/manychat/porta.server.ts"), "utf8");
    const inizio = porta.indexOf("export async function inviaWhatsapp(");
    const corpo = porta.slice(inizio, porta.indexOf("\n}\n", inizio));
    const posGate = corpo.search(/interruttore|controllaInterruttore|controlla/);
    c(
      "inviaWhatsapp: il controllo viene PRIMA di viaCloud e viaManychat",
      true,
      posGate >= 0 &&
        posGate < corpo.indexOf("viaCloud(") &&
        posGate < corpo.indexOf("viaManychat("),
    );
    c(
      "RichiestaInvio: `messaggio` è obbligatorio (senza «?»)",
      true,
      /interface RichiestaInvio[\s\S]*?\n {2}messaggio: MessaggioDiInvio;/.test(porta),
    );
    c(
      "PortePorta: `interruttore` è una porta obbligatoria",
      true,
      /interface PortePorta[\s\S]*?\n {2}interruttore\(chiave: ChiaveMessaggio\): Promise<boolean>;/.test(
        porta,
      ),
    );
    c("EsitoPorta ha l'esito «spento»", true, /\|\s*"spento"/.test(porta));
    c(
      "porta.ts non conosce la rete né il database per l'interruttore",
      false,
      /@\/integrations|process\.env\.[A-Z]/.test(porta),
    );
    c(
      "il database dell'interruttore: la tabella chiusa messaggi_automatici, colonna acceso",
      true,
      /from\("messaggi_automatici"\)[\s\S]{0,200}acceso/.test(server),
    );
    c(
      "porta.server: solo `acceso === true` apre (nessun «truthy»)",
      true,
      /acceso === true/.test(server),
    );
    c(
      "porta.server: un errore del database chiude (false), la tabella mancante compresa",
      true,
      /if \(error\)[\s\S]{0,300}return false/.test(server),
    );
    c(
      "porta.server: l'interruttore non è memorizzato (si rilegge a ogni invio)",
      false,
      /interruttori?\s*(\?\?=|=\s*new Map)/.test(server),
    );
    c(
      "porta.server: nessuna scrittura sul registro dei messaggi automatici",
      false,
      /messaggi_automatici[^;]{0,120}(insert|update|upsert|delete|rpc)/i.test(server),
    );
  }
}
