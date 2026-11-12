/** ── FATTURE BULK · T11 · L'ORCHESTRAZIONE NEL BROWSER (parti senza React) ───
 *  `usa-lotto.ts` tiene tutto quello che decide fuori dall'hook: reducer, `chiamaRotta`,
 *  orchestratore con le sue porte. Qui la rotta è FINTA e parla il contratto di
 *  bulk/tipi.ts (la vera è T9); le attese non aspettano, si registrano; le immagini
 *  sono finte (la riduzione vera usa il canvas e si prova nel browser, T14).
 *  L'hook (useReducer, beforeunload) è colla e si prova nel browser.
 *  ⚠️ Nessun dato personale: file numerati, righe di fantasia. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TIPI = ["indirizzo", "tessera", "pagamento"];
const finto = (i, tipo = "image/png") => ({ type: tipo, size: 1000, nome: `f${i}` });
const elenco = (n) => Array.from({ length: n }, (_, i) => finto(i));
const fileLotto = (indice, stato = "salvato") => ({
  indice,
  stato,
  impronta: `h${indice}`,
  tipo: stato === "salvato" ? "" : TIPI[indice % 3],
});

export async function prove(mod, { c, gruppo, radice }) {
  const U = mod["fatture/bulk/usa-lotto"];

  /** La rotta finta: un lotto in memoria. `su(richiesta)` può rispondere al posto suo (ritorna undefined = come al solito). */
  function banco({
    salvati = [],
    letti = [],
    righe = [],
    su = () => undefined,
    emittente = "scheda-1",
    riduci,
  } = {}) {
    const lotto = "lotto-0001";
    const server = new Map([
      ...salvati.map((i) => [i, fileLotto(i)]),
      ...letti.map((i) => [i, fileLotto(i, "letto")]),
    ]);
    const righeServer = new Map();
    let esiste = salvati.length + letti.length > 0;
    let s = U.STATO_INIZIALE;
    const chiamate = [];
    const attese = [];
    let righeViste = righe;
    let inCorso = 0,
      massimo = 0;
    const fetchRotta = async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : null;
      chiamate.push({ url, body });
      inCorso++;
      massimo = Math.max(massimo, inCorso);
      try {
        await new Promise((r) => setImmediate(r));
        const custom = await su({ url, body });
        const r = custom ?? predefinita(url, body);
        return { ok: (r.stato ?? 200) < 400, status: r.stato ?? 200, json: async () => r.corpo };
      } finally {
        inCorso--;
      }
    };
    const predefinita = (url, body) => {
      if (!body) {
        if (url.includes("?lotto=")) {
          return {
            corpo: {
              testata: {
                lotto,
                creatoIl: "2026-11-12T10:00:00Z",
                descrizione: "",
                dataSeManca: "",
                firmaImpostazioni: "f",
              },
              file: [...server.values()],
              righe: [...righeServer.values()],
            },
          };
        }
        return { corpo: null };
      }
      switch (body.azione) {
        case "crea":
          esiste = true;
          return { corpo: { ok: true, azione: "crea", lotto } };
        case "file":
          server.set(body.indice, fileLotto(body.indice));
          return { corpo: { ok: true, azione: "file", esito: "salvato" } };
        case "leggi-gruppo": {
          const fs = [0, 1, 2]
            .map((k) => body.gruppo * 3 + k)
            .filter((i) => server.has(i))
            .map((i) => {
              const letto = fileLotto(i, "letto");
              server.set(i, letto);
              return letto;
            });
          return { corpo: { ok: true, azione: "leggi-gruppo", file: fs } };
        }
        case "rileggi":
          return {
            corpo: {
              ok: true,
              azione: "rileggi",
              file: body.indici.map((i) => fileLotto(i, "letto")),
            },
          };
        case "salva-riga": {
          const riga = {
            idRiga: body.idRiga,
            stato: "aperta",
            confermata: !!body.confermaRiga,
            confermeAvvisi: body.confermaAvvisi,
            modifiche: body.modifiche,
          };
          righeServer.set(body.idRiga, riga);
          return { corpo: { ok: true, azione: "salva-riga", riga, lottoChiuso: false } };
        }
        case "pulisci":
          return { corpo: { ok: true, azione: "pulisci", rimossi: 0 } };
        default:
          return { corpo: { ok: true, azione: body.azione } };
      }
    };
    const o = U.creaOrchestratore({
      fetchRotta,
      attendi: async (ms) => void attese.push(ms),
      riduci:
        riduci ??
        (async (f) => ({ dataUrl: `data:image/jpeg;base64,${f.nome}`, impronta: `h-${f.nome}` })),
      emittente,
      dispatch: (a) => {
        s = U.reducerLotto(s, a);
      },
      stato: () => s,
      righe: () => righeViste,
    });
    return {
      o,
      chiamate,
      attese,
      stato: () => s,
      server,
      righeServer,
      esiste: () => esiste,
      massimo: () => massimo,
      conRighe: (r) => {
        righeViste = r;
      },
      azioni: (nome) => chiamate.filter((x) => x.body?.azione === nome).map((x) => x.body),
      get: () => chiamate.filter((x) => !x.body),
    };
  }
  const riga = (idRiga, numero, extra = {}) => ({
    idRiga,
    numero,
    stato: "pronto",
    emettibile: false,
    motivi: [],
    scheda: null,
    campi: { data: "2026-11-01" },
    ...extra,
  });
  const codice = (e) => e?.codice;

  /* ── 1. FUNZIONI PURE ────────────────────────────────────────────────── */
  gruppo("BULK · T11 · PIANO DI CARICO E GRUPPI DA LEGGERE");
  c(
    "pianoDiCarico: i già salvati si saltano, gli indici restano quelli (mai rinumerati)",
    { carica: [1, 4, 5], giaSalvati: [0, 2, 3] },
    U.pianoDiCarico([0, 2, 3], [0, 1, 2, 3, 4, 5]),
  );
  c(
    "pianoDiCarico: ordinato e senza doppioni, anche se arriva in disordine",
    { carica: [0, 1, 2], giaSalvati: [] },
    U.pianoDiCarico([], [2, 0, 1, 1, 0]),
  );
  c(
    "pianoDiCarico: tutto salvato = niente da caricare",
    { carica: [], giaSalvati: [0, 1] },
    U.pianoDiCarico([0, 1, 7], [0, 1]),
  );
  c(
    "un file «caricando» non conta come salvato (si ritenta)",
    [0, 2],
    U.indiciSalvati([fileLotto(0), { ...fileLotto(1), stato: "caricando" }, fileLotto(2, "letto")]),
  );
  c(
    "gruppiDaLeggere: solo le terne con file mai letti",
    [1, 2],
    U.gruppiDaLeggere(
      [0, 1, 2]
        .map((i) => fileLotto(i, "letto"))
        .concat([3, 4, 5, 6, 7, 8].map((i) => fileLotto(i))),
    ),
  );
  c(
    "gruppiDaLeggere: un buco nella terna (file 4 non arrivato) → quel gruppo non si legge",
    [0, 2],
    U.gruppiDaLeggere([0, 1, 2, 3, 5, 6, 7, 8].map((i) => fileLotto(i))),
  );
  c(
    "gruppiDaLeggere: l'ultima terna può essere più corta (7 file)",
    [0, 1, 2],
    U.gruppiDaLeggere(Array.from({ length: 7 }, (_, i) => fileLotto(i))),
  );
  c(
    "gruppiDaLeggere: l'ultimo file mancante si riconosce dal totale scelto",
    [0],
    U.gruppiDaLeggere(
      Array.from({ length: 5 }, (_, i) => fileLotto(i)),
      new Set(),
      9,
    ).filter((g) => g === 0),
  );
  c(
    "gruppiDaLeggere: un file in errore = «Rileggi» esplicito, non si rilegge da soli",
    [0],
    U.gruppiDaLeggere(
      [0, 1, 2, 3, 4, 5].map((i) => (i === 4 ? fileLotto(i, "errore") : fileLotto(i))),
    ),
  );
  c(
    "gruppiDaLeggere: i gruppi da saltare",
    [0, 2],
    U.gruppiDaLeggere(
      Array.from({ length: 9 }, (_, i) => fileLotto(i)),
      new Set([1]),
    ),
  );
  c(
    "gruppiDaLeggere: un file ancora «caricando» blocca il suo gruppo",
    [1],
    U.gruppiDaLeggere(
      [0, 1, 2, 3, 4, 5].map((i) =>
        i === 1 ? { ...fileLotto(i), stato: "caricando" } : fileLotto(i),
      ),
    ),
  );
  c(
    "unisciFile: sostituisce per indice, non rinumera",
    [0, 1, 2],
    U.unisciFile([fileLotto(2), fileLotto(0)], [fileLotto(1), fileLotto(2, "letto")]).map(
      (f) => f.indice,
    ),
  );

  /* ── 2. LA CHIAMATA ALLA ROTTA ───────────────────────────────────────── */
  gruppo("BULK · T11 · GUASTI DI RETE E CODICI");
  const prendi = async (f) => {
    try {
      await f();
      return null;
    } catch (e) {
      return e;
    }
  };
  const rispondi =
    (stato, corpo, jsonRotto = false) =>
    async () => ({
      ok: stato < 400,
      status: stato,
      json: async () => {
        if (jsonRotto) throw new SyntaxError("x");
        return corpo;
      },
    });
  const richiesta = { azione: "annulla", lotto: "lotto-0001" };
  {
    const e = await prendi(() =>
      U.chiamaRotta(async () => {
        throw new TypeError("Failed to fetch");
      }, richiesta),
    );
    c(
      "fetch che non arriva (TypeError) → ErroreCoda(rete), non un «interno»",
      ["ErroreCoda", "rete"],
      [e?.name, e?.codice],
    );
    const e2 = await prendi(() => U.chiamaRotta(rispondi(502, null, true), richiesta));
    c("pagina di errore senza JSON, 502 → rete", "rete", codice(e2));
    const e3 = await prendi(() =>
      U.chiamaRotta(
        rispondi(429, { ok: false, codice: "limite", messaggio: "Troppe richieste." }),
        richiesta,
      ),
    );
    c(
      "il codice e la frase della rotta passano",
      ["limite", "Troppe richieste."],
      [e3?.codice, e3?.messaggio],
    );
    const e4 = await prendi(() => U.chiamaRotta(rispondi(402, null, true), richiesta));
    c("402 senza corpo → credito (il ripiego dello stato HTTP)", "credito", codice(e4));
    const e5 = await prendi(() => U.chiamaRotta(rispondi(200, null, true), richiesta));
    c(
      "200 con corpo illeggibile → interno (un nostro difetto, non si ripete)",
      "interno",
      codice(e5),
    );
    const ac = new AbortController();
    const abort = Object.assign(new Error("annullata"), { name: "AbortError" });
    ac.abort();
    const e6 = await prendi(() =>
      U.chiamaRotta(
        async () => {
          throw abort;
        },
        richiesta,
        ac.signal,
      ),
    );
    c("dopo «annulla» l'AbortError passa com'è (la coda lo riconosce dal segnale)", abort, e6);
    const ok = await U.chiamaRotta(rispondi(200, { ok: true, azione: "annulla" }), richiesta);
    c("risposta buona restituita com'è", { ok: true, azione: "annulla" }, ok);
    let visto;
    await U.chiamaRotta(async (url, init) => {
      visto = [url, init.method, JSON.parse(init.body)];
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }, richiesta);
    c("POST JSON alla rotta unica", ["/api/crm/fatture-bulk", "POST", richiesta], visto);
  }

  /* ── 3. CARICAMENTO ──────────────────────────────────────────────────── */
  gruppo("BULK · T11 · CARICA: SALTA I GIÀ SALVATI, MAI RINUMERARE");
  {
    const b = banco();
    await b.o.carica(elenco(6));
    c(
      "6 file: un lotto creato, 6 upload con gli indici 0..5 (le posizioni di caricamento)",
      [1, [0, 1, 2, 3, 4, 5]],
      [
        b.azioni("crea").length,
        b
          .azioni("file")
          .map((x) => x.indice)
          .sort(),
      ],
    );
    c(
      "l'impronta e il data URL dell'immagine ridotta vanno alla rotta",
      ["h-f2", "data:image/jpeg;base64,f2"],
      [
        b.azioni("file").find((x) => x.indice === 2).impronta,
        b.azioni("file").find((x) => x.indice === 2).dataUrl,
      ],
    );
    c(
      "finito: lo stato viene dal server (6 file, lotto noto), nessun lavoro in corso, nessun errore",
      [6, "lotto-0001", null, []],
      [b.stato().file.length, b.stato().lotto, b.stato().lavoro, b.stato().erroriCarico],
    );
    c("al massimo 3 upload insieme", true, b.massimo() <= 3);
  }
  {
    let ridotti = [];
    const b2 = banco({
      salvati: [0, 1, 2, 3],
      riduci: async (f) => {
        ridotti.push(f.nome);
        return { dataUrl: "data:image/jpeg;base64,x", impronta: "h" };
      },
    });
    await b2.o.apri("lotto-0001");
    await b2.o.carica(elenco(6));
    c(
      "ripresa: gli stessi 6 file, i 4 già salvati non si riaprono né si rimandano; nessun nuovo lotto",
      [["f4", "f5"], [4, 5], 0],
      [
        ridotti.sort(),
        b2
          .azioni("file")
          .map((x) => x.indice)
          .sort(),
        b2.azioni("crea").length,
      ],
    );
  }
  {
    const b = banco();
    const f = elenco(6);
    f[2] = finto(2, "application/pdf");
    await b.o.carica(f);
    c(
      "un file non valido ferma PRIMA di partire: nessuna chiamata, nessun buco nell'ordine",
      [0, [2]],
      [b.chiamate.length, b.stato().fileNonValidi.map((x) => x.indice)],
    );
    c("e dice che cosa fare", true, /PNG, JPG o WebP/.test(b.stato().fileNonValidi[0].motivo));
  }
  {
    const b = banco();
    await b.o.carica(elenco(601));
    c(
      "601 file: rifiutati con «troppi_file», nessuna chiamata",
      ["troppi_file", 0],
      [b.stato().errore?.codice, b.chiamate.length],
    );
    const v = banco();
    await v.o.carica([]);
    c("nessun file: avviso, nessuna chiamata", 0, v.chiamate.length);
  }
  {
    const b2 = banco({
      su: ({ body }) => {
        if (body?.azione === "file" && body.indice === 3) throw new TypeError("rete");
      },
    });
    await b2.o.carica(elenco(6));
    c(
      "un file che non arriva (rete) è ritentato con 2 s e 5 s, poi segnalato con il suo indice; gli altri arrivano",
      [[2000, 5000], [{ indice: 3, codice: "rete" }], [0, 1, 2, 4, 5]],
      [b2.attese, b2.stato().erroriCarico, [...b2.server.keys()].sort()],
    );
  }
  {
    const b = banco({
      riduci: async (f) => {
        if (f.nome === "f1")
          throw new Error("Non riesco ad aprire questa immagine: rifai lo screenshot.");
        return { dataUrl: "d", impronta: "h" };
      },
    });
    await b.o.carica(elenco(3));
    c(
      "immagine che non si apre: errore col suo messaggio, nessun upload di quel file, nessuna ripetizione a vuoto",
      [
        {
          indice: 1,
          codice: "file_non_valido",
          messaggio: "Non riesco ad aprire questa immagine: rifai lo screenshot.",
        },
        [0, 2],
        [],
      ],
      [
        b.stato().erroriCarico[0],
        b
          .azioni("file")
          .map((x) => x.indice)
          .sort(),
        b.attese,
      ],
    );
  }

  /* ── 4. LETTURA, RIPRESA, FRENO ──────────────────────────────────────── */
  gruppo("BULK · T11 · LEGGI: SOLO I GRUPPI NON LETTI, MAI RIPAGARE");
  {
    const b = banco();
    await b.o.carica(elenco(9));
    await b.o.leggi();
    c(
      "9 file = 3 gruppi, ognuno chiesto una volta, con la posizione (non l'idRiga)",
      [0, 1, 2],
      b
        .azioni("leggi-gruppo")
        .map((x) => x.gruppo)
        .sort(),
    );
    c(
      "tutti letti nello stato (dalla risposta della rotta)",
      [9, true],
      [b.stato().file.length, b.stato().file.every((f) => f.stato === "letto")],
    );
    await b.o.leggi();
    c(
      "rileggere lo stesso lotto: nessuna nuova richiesta (già letti)",
      3,
      b.azioni("leggi-gruppo").length,
    );
    c(
      "nessun lavoro in corso, nessuna fermata",
      [null, null],
      [b.stato().lavoro, b.stato().fermata],
    );
  }
  {
    const b = banco({ letti: [0, 1, 2], salvati: [3, 4, 5, 6, 7, 8] });
    await b.o.apri("lotto-0001");
    await b.o.riprendi();
    c(
      "ripresa dopo la chiusura: solo i gruppi non letti",
      [1, 2],
      b
        .azioni("leggi-gruppo")
        .map((x) => x.gruppo)
        .sort(),
    );
  }
  {
    // 3 guasti di rete sul gruppo 1: 3 tentativi, poi errore SUO; gli altri vanno.
    const b = banco({
      su: ({ body }) => {
        if (body?.azione === "leggi-gruppo" && body.gruppo === 1) throw new TypeError("rete");
      },
    });
    await b.o.carica(elenco(9));
    await b.o.leggi();
    c(
      "gruppo con rete caduta: 3 tentativi (2 s e 5 s), errore «rete» solo su quel gruppo",
      [3, [2000, 5000], { 1: "rete" }],
      [
        b.azioni("leggi-gruppo").filter((x) => x.gruppo === 1).length,
        b.attese,
        b.stato().erroriGruppo,
      ],
    );
    c(
      "gli altri due gruppi letti",
      [6, 0],
      [b.stato().file.filter((f) => f.stato === "letto").length, b.stato().fermata ? 1 : 0],
    );
    await b.o.leggi();
    c(
      "«riprendi»: il guasto di rete si ritenta (solo quel gruppo: altre 3 chiamate), perché non è stato pagato",
      5 + 3,
      b.azioni("leggi-gruppo").length,
    );
  }
  {
    const b = banco({
      su: ({ body }) =>
        body?.azione === "leggi-gruppo" && body.gruppo === 1
          ? { stato: 200, corpo: { ok: false, codice: "troncata", messaggio: "Troncata." } }
          : undefined,
    });
    await b.o.carica(elenco(9));
    await b.o.leggi();
    await b.o.leggi();
    c(
      "«troncata»: una sola richiesta, e «riprendi» non la ripaga (solo «Rileggi»)",
      [1, { 1: "troncata" }],
      [b.azioni("leggi-gruppo").filter((x) => x.gruppo === 1).length, b.stato().erroriGruppo],
    );
    await b.o.rileggi([3, 4, 5]);
    c(
      "«Rileggi» è un gesto esplicito: una chiamata `rileggi` con quei file, e l'errore del gruppo sparisce",
      [[{ azione: "rileggi", lotto: "lotto-0001", indici: [3, 4, 5] }], {}],
      [b.azioni("rileggi"), b.stato().erroriGruppo],
    );
  }
  {
    const b = banco({
      su: ({ body }) =>
        body?.azione === "leggi-gruppo"
          ? { stato: 402, corpo: { ok: false, codice: "credito", messaggio: "Credito finito." } }
          : undefined,
    });
    await b.o.carica(elenco(30));
    await b.o.leggi();
    c(
      "credito finito: si ferma subito (al più i 3 già partiti), codice del freno «credito»",
      ["freno", "credito", true],
      [b.stato().fermata?.per, b.stato().fermata?.codice, b.azioni("leggi-gruppo").length <= 3],
    );
  }
  {
    const b = banco({
      su: ({ body }) =>
        body?.azione === "leggi-gruppo"
          ? { stato: 200, corpo: { ok: false, codice: "illeggibile", messaggio: "x" } }
          : undefined,
    });
    await b.o.carica(elenco(45));
    await b.o.leggi();
    c(
      "cinque gruppi di fila falliti: il freno ferma la lettura (non 15 chiamate)",
      ["freno", true],
      [b.stato().fermata?.per, b.azioni("leggi-gruppo").length < 15],
    );
  }
  {
    let volte = 0;
    const b = banco({
      su: ({ body }) =>
        body?.azione === "leggi-gruppo" && body.gruppo === 0 && volte++ < 2
          ? { stato: 200, corpo: { ok: false, codice: "occupato", messaggio: "x" } }
          : undefined,
    });
    await b.o.carica(elenco(3));
    await b.o.leggi();
    c(
      "«occupato» gestito dalla coda: attese da 5 s, poi legge; nessun errore di gruppo, nessun freno",
      [[5000, 5000], {}, null, 3],
      [b.attese, b.stato().erroriGruppo, b.stato().fermata, b.azioni("leggi-gruppo").length],
    );
  }
  {
    const b = banco();
    await b.o.carica(elenco(9));
    let finito = false;
    const lavoro = b.o.leggi().then(() => (finito = true));
    await new Promise((r) => setImmediate(r));
    b.o.interrompi();
    await lavoro;
    c(
      "«Interrompi» durante la lettura: si ferma per annullamento, non per freno",
      true,
      b.stato().fermata === null || b.stato().fermata.per === "annullata",
    );
  }

  /* ── 5. IL REDUCER NON RICALCOLA ─────────────────────────────────────── */
  gruppo("BULK · T11 · IL REDUCER NON RICALCOLA MAI STATI");
  {
    const s0 = U.reducerLotto(U.STATO_INIZIALE, {
      tipo: "lotto",
      lotto: "lotto-0001",
      file: [fileLotto(0, "letto")],
      righe: [],
    });
    const dec = { idRiga: "0000-0001-0002", stato: "aperta", confermata: true };
    const s1 = U.reducerLotto(s0, { tipo: "riga", riga: dec });
    c(
      "una decisione si conserva com'è; nessun campo nuovo (niente stato, motivi, emettibile)",
      [dec, Object.keys(U.STATO_INIZIALE)],
      [s1.decisioni["0000-0001-0002"], Object.keys(s1)],
    );
    c("il reducer non muta lo stato precedente", [{}, 1], [s0.decisioni, s0.file.length]);
    const s2 = U.reducerLotto(s1, { tipo: "lotto", lotto: "lotto-0002", file: [] });
    c(
      "un altro lotto riparte da zero (decisioni, errori, riepilogo)",
      [{}, null],
      [s2.decisioni, s2.riepilogo],
    );
    const s3 = U.reducerLotto(
      U.reducerLotto(s1, { tipo: "gruppo_fallito", gruppo: 1, codice: "rete" }),
      { tipo: "lotto", lotto: "lotto-0001", file: [fileLotto(0)] },
    );
    c("lo stesso lotto riletto tiene gli errori di sessione", { 1: "rete" }, s3.erroriGruppo);
    const s4 = U.reducerLotto(s0, { tipo: "lavoro", cosa: "lettura", totale: 5 });
    const s5 = U.reducerLotto(U.reducerLotto(s4, { tipo: "avanza" }), { tipo: "avanza" });
    c("l'avanzamento conta", { cosa: "lettura", fatti: 2, totale: 5 }, s5.lavoro);
    c(
      "`lavoroInCorso` (per beforeunload): vero durante il lavoro, falso dopo",
      [true, false],
      [U.lavoroInCorso(s5), U.lavoroInCorso(U.reducerLotto(s5, { tipo: "libero" }))],
    );
  }
  {
    let chiamato = 0;
    const attesa = {
      righe: [{ idRiga: "A", numero: 1, stato: "pronto", emettibile: false }],
      fatti: { x: 1 },
      motiviLotto: [],
    };
    const valuta = (righe, ctx) => {
      chiamato++;
      valuta.visto = [righe, ctx];
      return attesa;
    };
    const stato = {
      file: [0, 1, 2].map((i) => ({ ...fileLotto(i, "letto"), tipo: TIPI[i] })),
      decisioni: {
        "0000-0001-0002": { idRiga: "0000-0001-0002", stato: "aperta", confermata: true },
      },
    };
    const r = U.valutaIlLotto(stato, { oggi: "2026-11-12" }, valuta);
    c(
      "valutaIlLotto: restituisce ESATTAMENTE quello che dà valutaLotto, chiamata una volta",
      [attesa, 1],
      [r, chiamato],
    );
    c(
      "passa un cliente ricomposto, tutti i file e le sue decisioni",
      ["0000-0001-0002", 3, true],
      [
        valuta.visto[0][0].gruppo.idRiga,
        valuta.visto[0][0].file.length,
        valuta.visto[0][0].decisioni.confermata,
      ],
    );
    chiamato = 0;
    U.valutaIlLotto(
      { file: [0, 1, 2].map((i) => fileLotto(i)), decisioni: {} },
      { oggi: "x" },
      valuta,
    );
    c("file non ancora letti (tipo vuoto): nessun cliente da valutare", [], valuta.visto[0]);
  }

  /* ── 6. AZIONI DI RIGA E CONFERME IN BLOCCO ──────────────────────────── */
  gruppo("BULK · T11 · AZIONI DI RIGA E «CONFERMA TUTTE»");
  {
    const b = banco({ salvati: [0, 1, 2] });
    await b.o.apri("lotto-0001");
    b.conRighe([
      riga("R1", 1),
      riga("R2", 2, { stato: "da_controllare" }),
      riga("R3", 3),
      riga("R4", 4, { stato: "emessa" }),
      riga("R5", 5, { stato: "confermata" }),
    ]);
    const n = await b.o.confermaTutteLePronte();
    c(
      "conferma tutte le pronte: solo quelle `pronto` (R1, R3), mai le da controllare, le emesse o le già confermate",
      [2, ["R1", "R3"], true],
      [
        n,
        b
          .azioni("salva-riga")
          .map((x) => x.idRiga)
          .sort(),
        b.azioni("salva-riga").every((x) => x.confermaRiga === true),
      ],
    );
    c(
      "la riga confermata finisce nello stato così come la rotta la restituisce",
      true,
      b.stato().decisioni.R1.confermata,
    );
    c("lavoro finito", null, b.stato().lavoro);
  }
  {
    const b = banco({ salvati: [0, 1, 2] });
    await b.o.apri("lotto-0001");
    const mot = (codice, gravita = "conferma") => ({ codice, gravita, testo: "t" });
    b.conRighe([
      riga("A", 1, { stato: "da_controllare", motivi: [mot("data_anteriore")] }),
      riga("B", 2, { stato: "da_controllare", motivi: [mot("data_anteriore", "blocca")] }),
      riga("C", 3, { stato: "da_controllare", motivi: [mot("importo_alto")] }),
      riga("D", 4, { stato: "emessa", motivi: [mot("data_anteriore")] }),
      riga("E", 5, {
        stato: "da_controllare",
        motivi: [mot("data_anteriore"), mot("oltre_12_giorni")],
      }),
    ]);
    const n = await b.o.confermaAvvisoPerTutte("data_anteriore");
    c(
      "«conferma questo avviso per tutte»: solo dove è un `conferma` e la riga è aperta (A, E), mai un `blocca`",
      [2, ["A", "E"], [["data_anteriore"], ["data_anteriore"]]],
      [
        n,
        b
          .azioni("salva-riga")
          .map((x) => x.idRiga)
          .sort(),
        b.azioni("salva-riga").map((x) => x.confermaAvvisi),
      ],
    );
    const prima = b.azioni("salva-riga").length;
    c(
      "un altro codice (importo_alto) non si conferma in blocco: nessuna chiamata",
      [0, prima],
      [await b.o.confermaAvvisoPerTutte("importo_alto"), b.azioni("salva-riga").length],
    );
    c("«oltre_12_giorni» sì", 1, await b.o.confermaAvvisoPerTutte("oltre_12_giorni"));
    const n2 = await b.o.confermaAvvisoPerTutte("data_anteriore");
    c("già dato: non si rimanda (A ed E ora hanno l'avviso)", 0, n2);
  }
  {
    // «ordine_diverso» (decisione del capo progetto): il titolare lo conferma con un tasto dopo aver visto le righe.
    const b = banco({ salvati: [0, 1, 2] });
    await b.o.apri("lotto-0001");
    const mot = (codice, gravita = "conferma") => ({ codice, gravita, testo: "t" });
    b.conRighe([
      riga("A", 1, { stato: "da_controllare", motivi: [mot("ordine_diverso")] }),
      riga("B", 2, { stato: "da_controllare", motivi: [mot("ordine_diverso", "blocca")] }),
      riga("C", 3, { stato: "da_controllare", motivi: [mot("persone_diverse", "blocca")] }),
      riga("D", 4, { stato: "emessa", motivi: [mot("ordine_diverso")] }),
      riga("E", 5, { stato: "da_controllare", motivi: [mot("ordine_diverso")] }),
    ]);
    const n = await b.o.confermaAvvisoPerTutte("ordine_diverso");
    c(
      "«ordine_diverso» in blocco: solo le righe aperte dove è un `conferma` (A, E), mai un `blocca`",
      [2, ["A", "E"]],
      [
        n,
        b
          .azioni("salva-riga")
          .map((x) => x.idRiga)
          .sort(),
      ],
    );
    c("`AVVISI_PER_TUTTE` ha ordine_diverso", true, U.AVVISI_PER_TUTTE.includes("ordine_diverso"));
  }
  {
    const b = banco({ salvati: [0, 1, 2] });
    await b.o.apri("lotto-0001");
    await b.o.salvaRiga("R1", { confermaAvvisi: ["importo_alto"] });
    await b.o.salvaRiga("R1", { confermaAvvisi: ["data_anteriore"] });
    c(
      "le conferme già date restano nell'elenco inviato (vale se la rotta unisce o sostituisce)",
      [["importo_alto", "data_anteriore"]],
      [b.azioni("salva-riga")[1].confermaAvvisi],
    );
    await b.o.salvaRiga("R1", { modifiche: { comune: "Roma" } });
    await b.o.salvaRiga("R1", { modifiche: { cap: "00100" } });
    c(
      "lo stesso per le modifiche",
      [{ comune: "Roma", cap: "00100" }],
      [b.azioni("salva-riga")[3].modifiche],
    );
    await b.o.salvaRiga("R1", { scarta: true });
    c(
      "scarta: chiede solo lo scarto",
      [true, undefined],
      [b.azioni("salva-riga")[4].scarta, b.azioni("salva-riga")[4].modifiche],
    );
  }
  {
    const b = banco({
      su: ({ body }) =>
        body?.azione === "salva-riga"
          ? { stato: 403, corpo: { ok: false, codice: "non_permesso", messaggio: "Non puoi." } }
          : undefined,
    });
    await b.o.apri("lotto-0001");
    const ok = await b.o.salvaRiga("R1", { confermaRiga: true });
    c(
      "salvataggio rifiutato: falso e l'errore è nello stato col suo codice",
      [false, "non_permesso"],
      [ok, b.stato().errore?.codice],
    );
  }

  /* ── 7. EMISSIONE SEQUENZIALE ────────────────────────────────────────── */
  gruppo("BULK · T11 · EMISSIONE: UNA ALLA VOLTA, PER DATA, CON RIEPILOGO");
  const pronteDaEmettere = () => [
    riga("R1", 1, { emettibile: true, campi: { data: "2026-11-03" } }),
    riga("R2", 2, { emettibile: true, campi: { data: "2026-11-01" } }),
    riga("R3", 3, { emettibile: true, campi: { data: "2026-11-01" } }),
    riga("R4", 4, { emettibile: false, campi: { data: "2026-11-01" } }),
    riga("R5", 5, { emettibile: true, stato: "emessa", campi: { data: "2026-11-01" } }),
  ];
  {
    let n = 100;
    let b;
    b = banco({
      salvati: [0, 1, 2],
      righe: pronteDaEmettere(),
      emittente: "scheda-xyz",
      su: ({ body }) => {
        if (body?.azione !== "emetti-riga") return undefined;
        if (body.idRiga === "R3")
          return {
            corpo: {
              ok: true,
              azione: "emetti-riga",
              esito: "saltata",
              motivi: [{ codice: "doppione", gravita: "blocca", testo: "Già fatturata." }],
            },
          };
        n++;
        b.righeServer.set(body.idRiga, {
          idRiga: body.idRiga,
          stato: "emessa",
          emessa: { id: `f${n}`, numero: n, data: "2026-11-12" },
        });
        return {
          corpo: {
            ok: true,
            azione: "emetti-riga",
            esito: "emessa",
            fattura: { id: `f${n}`, numero: n, data: "2026-11-12" },
            lottoChiuso: false,
            ...(body.idRiga === "R1" ? { saltoDiNumeri: { da: 102, a: 103 } } : {}),
          },
        };
      },
    });
    await b.o.apri("lotto-0001");
    const r = await b.o.emettiConfermate();
    const em = b.azioni("emetti-riga");
    c(
      "emette per data crescente, a parità l'ordine di caricamento: R2, R3, R1 (R4 non emettibile, R5 già emessa)",
      ["R2", "R3", "R1"],
      em.map((x) => x.idRiga),
    );
    c(
      "l'id della scheda va a ogni riga",
      true,
      em.every((x) => x.emittente === "scheda-xyz" && x.lotto === "lotto-0001"),
    );
    c("mai due emissioni insieme (i numeri crescono con le date)", 1, b.massimo());
    c(
      "riepilogo: 2 emesse con numero, 1 saltata col suo motivo (le altre proseguono), il salto di numeri registrato",
      [["R2", "R1"], [101, 102], ["R3"], "Già fatturata.", [{ da: 102, a: 103 }], undefined],
      [
        r.emesse.map((x) => x.idRiga),
        r.emesse.map((x) => x.numero),
        r.saltate.map((x) => x.idRiga),
        r.saltate[0].motivi[0].testo,
        r.saltiDiNumeri,
        r.fermata,
      ],
    );
    c(
      "il riepilogo resta nello stato; la riga emessa mostra solo il numero (stato ed emessa)",
      [
        true,
        { idRiga: "R2", stato: "emessa", emessa: { id: "f101", numero: 101, data: "2026-11-12" } },
      ],
      [!!b.stato().riepilogo, b.stato().decisioni.R2],
    );
    c(
      "a fine lavoro il lotto si rilegge dal server e il lavoro è finito",
      [1, null],
      [b.get().length - 1, b.stato().lavoro],
    );
  }
  {
    const b = banco({
      salvati: [0, 1, 2],
      righe: pronteDaEmettere(),
      su: ({ body }) => {
        if (body?.azione !== "emetti-riga") return undefined;
        if (body.idRiga === "R3")
          return {
            corpo: {
              ok: true,
              azione: "emetti-riga",
              esito: "ferma",
              codice: "impostazioni_cambiate",
              messaggio: "Le impostazioni sono cambiate.",
            },
          };
        return {
          corpo: {
            ok: true,
            azione: "emetti-riga",
            esito: "emessa",
            fattura: { id: "f", numero: 1, data: "2026-11-12" },
            lottoChiuso: false,
          },
        };
      },
    });
    await b.o.apri("lotto-0001");
    const r = await b.o.emettiConfermate();
    c(
      "`ferma` (errore di sistema): si ferma tutto, R1 non parte",
      [
        ["R2", "R3"],
        { codice: "impostazioni_cambiate", messaggio: "Le impostazioni sono cambiate." },
      ],
      [b.azioni("emetti-riga").map((x) => x.idRiga), r.fermata],
    );
  }
  {
    const b = banco({
      salvati: [0, 1, 2],
      righe: pronteDaEmettere(),
      su: ({ body }) => {
        if (body?.azione !== "emetti-riga") return undefined;
        if (body.idRiga === "R3") throw new TypeError("rete");
        return {
          corpo: {
            ok: true,
            azione: "emetti-riga",
            esito: "emessa",
            fattura: { id: "f", numero: 1, data: "2026-11-12" },
            lottoChiuso: false,
          },
        };
      },
    });
    await b.o.apri("lotto-0001");
    const r = await b.o.emettiConfermate();
    c(
      "rete caduta a metà: si ferma (non si ritenta alla cieca), codice «rete»; il lotto si rilegge per vedere cosa è stato emesso davvero",
      [["R2", "R3"], "rete", 2],
      [b.azioni("emetti-riga").map((x) => x.idRiga), r.fermata.codice, b.get().length],
    );
  }
  {
    const b = banco({
      salvati: [0, 1, 2],
      righe: pronteDaEmettere(),
      su: ({ body }) =>
        body?.azione === "emetti-riga"
          ? {
              corpo: {
                ok: false,
                codice: "emittente_occupato",
                messaggio: "Un'altra scheda sta emettendo.",
              },
            }
          : undefined,
    });
    await b.o.apri("lotto-0001");
    const r = await b.o.emettiConfermate();
    c(
      "emittente occupato: ferma alla prima, con la frase della rotta",
      [1, "emittente_occupato", "Un'altra scheda sta emettendo."],
      [b.azioni("emetti-riga").length, r.fermata.codice, r.fermata.messaggio],
    );
  }
  {
    const b = banco({
      salvati: [0, 1, 2],
      righe: pronteDaEmettere(),
      su: ({ body }) =>
        body?.azione === "emetti-riga"
          ? {
              corpo: {
                ok: true,
                azione: "emetti-riga",
                esito: "emessa",
                fattura: { id: "f", numero: 1, data: "2026-11-12" },
                lottoChiuso: body.idRiga === "R1",
              },
            }
          : undefined,
    });
    await b.o.apri("lotto-0001");
    const prima = b.get().length;
    await b.o.emettiConfermate();
    c(
      "ultima riga: lotto chiuso (eliminato dal server) → niente rilettura, stato `lottoChiuso`",
      [true, prima],
      [b.stato().lottoChiuso, b.get().length],
    );
  }
  {
    let b;
    b = banco({
      salvati: [0, 1, 2],
      righe: pronteDaEmettere(),
      su: ({ body }) => {
        if (body?.azione !== "emetti-riga") return undefined;
        b.o.interrompi();
        return {
          corpo: {
            ok: true,
            azione: "emetti-riga",
            esito: "emessa",
            fattura: { id: "f", numero: 1, data: "2026-11-12" },
            lottoChiuso: false,
          },
        };
      },
    });
    await b.o.apri("lotto-0001");
    const r = await b.o.emettiConfermate();
    c(
      "«Interrompi» durante l'emissione: la riga in corso finisce, le altre non partono",
      [["R2"], 1, "annullata"],
      [b.azioni("emetti-riga").map((x) => x.idRiga), r.emesse.length, b.stato().fermata?.per],
    );
  }
  {
    const b = banco({ salvati: [0, 1, 2], emittente: "scheda-uno" });
    await b.o.apri("lotto-0001");
    const ok = await b.o.prendiIlControllo();
    c(
      "«Prendi il controllo»: manda l'id di questa scheda",
      [true, [{ azione: "prendi-controllo", lotto: "lotto-0001", emittente: "scheda-uno" }]],
      [ok, b.azioni("prendi-controllo")],
    );
    const annullato = await b.o.annullaLotto();
    c("annulla il lotto: lo stato torna vuoto", [true, null], [annullato, b.stato().lotto]);
  }

  /* ── 8. APERTURA E PULIZIA ───────────────────────────────────────────── */
  gruppo("BULK · T11 · APERTURA, PULIZIA, LOTTI APERTI");
  {
    let rimossi = [2, 1, 0];
    const b = banco({
      salvati: [0, 1, 2],
      su: ({ body }) =>
        body?.azione === "pulisci"
          ? { corpo: { ok: true, azione: "pulisci", rimossi: rimossi.shift() } }
          : undefined,
    });
    await b.o.apri("lotto-0001");
    c(
      "dopo l'apertura parte `pulisci` (un lotto per chiamata, finché c'è da togliere): 3 chiamate",
      [1, 3],
      [b.get().length, b.azioni("pulisci").length],
    );
    c(
      "la prima chiamata è la lettura del lotto, poi la pulizia (un GET non cancella)",
      ["?lotto=lotto-0001", "pulisci"],
      [b.chiamate[0].url.replace("/api/crm/fatture-bulk", ""), b.chiamate[1].body.azione],
    );
    c(
      "lotto e testata nello stato",
      ["lotto-0001", 3],
      [b.stato().testata?.lotto, b.stato().file.length],
    );
  }
  {
    const b = banco({
      salvati: [0],
      su: ({ body }) => {
        if (body?.azione === "pulisci") throw new TypeError("rete");
      },
    });
    await b.o.apri("lotto-0001");
    c(
      "la pulizia che fallisce non disturba: nessun errore nello stato, 1 sola prova",
      [null, 1],
      [b.stato().errore, b.azioni("pulisci").length],
    );
  }
  {
    const b = banco({
      su: ({ url }) =>
        url.includes("lotto=")
          ? {
              stato: 404,
              corpo: { ok: false, codice: "non_trovato", messaggio: "Lotto non trovato." },
            }
          : undefined,
    });
    await b.o.apri("lotto-0001");
    c(
      "lotto che non c'è più: errore nello stato, lavoro finito, nessuna pulizia",
      ["non_trovato", null, 0],
      [b.stato().errore?.codice, b.stato().lavoro, b.azioni("pulisci").length],
    );
  }

  /* ── 9. DOPO LA REVISIONE ────────────────────────────────────────────── */
  gruppo("BULK · T11 · RIPRESA DOPO CREDITO/SESSIONE/PERMESSO, DOPPI AVVII, PULIZIA, DATI");
  // 1. Credito, sessione e permesso non hanno consumato AI: «Riprendi» li rilegge. Solo troncata e illeggibile no.
  for (const [stato, cod] of [
    [402, "credito"],
    [401, "non_autorizzato"],
    [403, "non_permesso"],
  ]) {
    let rotto = true;
    const b = banco({
      su: ({ body }) =>
        body?.azione === "leggi-gruppo" && rotto
          ? { stato, corpo: { ok: false, codice: cod, messaggio: "x" } }
          : undefined,
    });
    await b.o.carica(elenco(9));
    await b.o.leggi();
    const primo = b.stato().fermata?.codice;
    rotto = false;
    await b.o.riprendi();
    c(
      `«${cod}»: la coda si ferma, e dopo la ricarica «Riprendi» rilegge i gruppi falliti (nessuno li ha pagati)`,
      [cod, true, {}],
      [primo, b.stato().file.every((f) => f.stato === "letto"), b.stato().erroriGruppo],
    );
  }
  {
    const b = banco({
      su: ({ body }) =>
        body?.azione === "leggi-gruppo" && body.gruppo === 1
          ? { corpo: { ok: false, codice: "illeggibile", messaggio: "x" } }
          : undefined,
    });
    await b.o.carica(elenco(9));
    await b.o.leggi();
    await b.o.leggi();
    c(
      "«illeggibile»: una sola richiesta, «Riprendi» non la ripaga",
      1,
      b.azioni("leggi-gruppo").filter((x) => x.gruppo === 1).length,
    );
  }

  // 2. Un doppio clic non fa partire due lavori.
  {
    const b = banco();
    await b.o.carica(elenco(9));
    await Promise.all([b.o.leggi(), b.o.leggi()]);
    c(
      "due «leggi» insieme: una sola serie di richieste (3 gruppi, non 6)",
      3,
      b.azioni("leggi-gruppo").length,
    );
  }
  {
    const b = banco();
    await Promise.all([b.o.carica(elenco(6)), b.o.carica(elenco(6))]);
    c(
      "due «carica» insieme: un solo lotto creato, 6 upload",
      [1, 6],
      [b.azioni("crea").length, b.azioni("file").length],
    );
  }
  {
    const b = banco({
      salvati: [0, 1, 2],
      righe: pronteDaEmettere(),
      su: ({ body }) =>
        body?.azione === "emetti-riga"
          ? {
              corpo: {
                ok: true,
                azione: "emetti-riga",
                esito: "emessa",
                fattura: { id: "f", numero: 1, data: "2026-11-12" },
                lottoChiuso: false,
              },
            }
          : undefined,
    });
    await b.o.apri("lotto-0001");
    const [r1, r2] = await Promise.all([b.o.emettiConfermate(), b.o.emettiConfermate()]);
    c(
      "due «emetti» insieme (doppio clic): una sola serie di 3 emissioni, la seconda non fa niente",
      [3, 3, null],
      [b.azioni("emetti-riga").length, r1?.emesse.length, r2],
    );
  }
  {
    const b = banco({ salvati: [0, 1, 2] });
    await b.o.apri("lotto-0001");
    b.conRighe([riga("R1", 1), riga("R2", 2)]);
    const [n1, n2] = await Promise.all([b.o.confermaTutteLePronte(), b.o.confermaTutteLePronte()]);
    c(
      "due «conferma tutte» insieme: 2 salvataggi in tutto",
      [2, 0, 2],
      [n1, n2, b.azioni("salva-riga").length],
    );
    await b.o.carica(elenco(3));
    const durante = banco({ salvati: [0, 1, 2, 3, 4, 5] });
    await durante.o.apri("lotto-0001");
    await Promise.all([durante.o.leggi(), durante.o.rileggi([0, 1, 2])]);
    c("«rileggi» durante la lettura non parte", 0, durante.azioni("rileggi").length);
  }
  {
    // «Interrompi» ferma ancora la prima esecuzione quando la seconda è stata scartata.
    const b = banco();
    await b.o.carica(elenco(30));
    const primo = b.o.leggi();
    await b.o.leggi();
    b.o.interrompi();
    await primo;
    c(
      "«Interrompi» agisce sull'esecuzione in corso (non sulla scartata)",
      "annullata",
      b.stato().fermata?.per,
    );
  }

  // 3. La pulizia parte anche aprendo la pagina (elenco dei lotti), PRIMA dell'elenco: non toglie il lotto appena mostrato.
  {
    const b = banco({
      su: ({ url, body }) =>
        !body && !url.includes("lotto=")
          ? {
              corpo: [
                {
                  lotto: "lotto-0001",
                  creatoIl: "x",
                  file: 3,
                  letti: 0,
                  righeAperte: 0,
                  righeEmesse: 0,
                },
              ],
            }
          : undefined,
    });
    const elencoLotti = await b.o.lottiAperti();
    c(
      "all'apertura della pagina: prima la pulizia, poi l'elenco (un array senza `ok`)",
      ["pulisci", 1],
      [b.chiamate[0].body?.azione, elencoLotti.length],
    );
    c(
      "`pulisci` è esportata dall'orchestratore (T13 la può chiamare)",
      "function",
      typeof b.o.pulisci,
    );
    const vuoto = banco({
      su: ({ url, body }) => (!body && !url.includes("lotto=") ? { corpo: [] } : undefined),
    });
    c("nessun lotto aperto: lista vuota", [], await vuoto.o.lottiAperti());
  }

  // 4. D11a: dopo emissione o scarto, nello stato non resta la lettura (nome, CF, indirizzo).
  {
    const conLettura = (i) => ({
      ...fileLotto(i, "letto"),
      lettura: { tipo: "altro", incerti: [] },
    });
    let s = U.reducerLotto(U.STATO_INIZIALE, {
      tipo: "lotto",
      lotto: "lotto-0001",
      file: [0, 1, 2, 3, 4, 5].map(conLettura),
    });
    s = U.reducerLotto(s, {
      tipo: "riga",
      riga: {
        idRiga: "0000-0001-0002",
        stato: "emessa",
        emessa: { id: "f", numero: 1, data: "2026-11-12" },
      },
    });
    c(
      "riga emessa: la lettura dei suoi tre file sparisce dallo stato; impronta, stato e tipo restano; gli altri file no",
      [[false, false, false, true, true, true], "h1", "letto", "pagamento"],
      [s.file.map((f) => "lettura" in f), s.file[1].impronta, s.file[1].stato, s.file[2].tipo],
    );
    const sc = U.reducerLotto(
      U.reducerLotto(U.STATO_INIZIALE, {
        tipo: "lotto",
        lotto: "lotto-0001",
        file: [0, 1, 2].map(conLettura),
      }),
      { tipo: "riga", riga: { idRiga: "0000-0001-0002", stato: "scartata" } },
    );
    c(
      "riga scartata: lo stesso",
      [false, false, false],
      sc.file.map((f) => "lettura" in f),
    );
    const aperta = U.reducerLotto(
      U.reducerLotto(U.STATO_INIZIALE, {
        tipo: "lotto",
        lotto: "lotto-0001",
        file: [0, 1, 2].map(conLettura),
      }),
      { tipo: "riga", riga: { idRiga: "0000-0001-0002", stato: "aperta", confermata: true } },
    );
    c(
      "riga ancora aperta: la lettura resta (serve a mostrarla)",
      [true, true, true],
      aperta.file.map((f) => "lettura" in f),
    );
    const chiuso = U.reducerLotto(
      U.reducerLotto(U.STATO_INIZIALE, {
        tipo: "lotto",
        lotto: "lotto-0001",
        file: [0, 1, 2, 3, 4, 5].map(conLettura),
      }),
      {
        tipo: "riepilogo",
        riepilogo: { emesse: [], saltate: [], saltiDiNumeri: [] },
        lottoChiuso: true,
      },
    );
    c(
      "lotto chiuso: nessuna lettura in nessun file",
      [false, true],
      [chiuso.file.some((f) => "lettura" in f), chiuso.lottoChiuso],
    );
  }

  // 5. Rileggi senza lotto: errore nello stato, come le altre azioni.
  {
    const b = banco();
    let lanciato = false;
    await b.o.rileggi([0, 1, 2]).catch(() => (lanciato = true));
    c(
      "«rileggi» senza lotto: nessuna eccezione, errore nello stato, nessuna chiamata",
      [false, "non_trovato", 0],
      [lanciato, b.stato().errore?.codice, b.chiamate.length],
    );
  }

  // 6. Fine lettura: si riallinea al server (un gruppo letto mentre si interrompeva).
  {
    let b;
    b = banco({
      su: ({ body }) => {
        if (body?.azione !== "leggi-gruppo" || body.gruppo !== 1) return undefined;
        for (const i of [3, 4, 5]) b.server.set(i, fileLotto(i, "letto"));
        return { corpo: { ok: true, azione: "leggi-gruppo", file: [] } };
      },
    });
    await b.o.carica(elenco(9));
    await b.o.leggi();
    c(
      "a fine lettura lo stato viene dal server: il gruppo 1 risulta letto anche se la risposta era vuota",
      true,
      b
        .stato()
        .file.slice(3, 6)
        .every((f) => f.stato === "letto"),
    );
  }

  // 7. Due correzioni ravvicinate sulla stessa riga: una dopo l'altra, la seconda porta anche la prima.
  {
    const b = banco({ salvati: [0, 1, 2] });
    await b.o.apri("lotto-0001");
    const nPrima = b.chiamate.length;
    await Promise.all([
      b.o.salvaRiga("R1", { modifiche: { comune: "Roma" } }),
      b.o.salvaRiga("R1", { modifiche: { cap: "00100" } }),
    ]);
    const sr = b.azioni("salva-riga");
    c(
      "stessa riga: il secondo salvataggio porta anche la prima correzione",
      [{ comune: "Roma", cap: "00100" }, 2],
      [sr[1].modifiche, b.chiamate.length - nPrima],
    );
    c("e non partono insieme", 1, b.massimo());
    const altre = banco({ salvati: [0, 1, 2] });
    await altre.o.apri("lotto-0001");
    await Promise.all([
      altre.o.salvaRiga("R1", { confermaRiga: true }),
      altre.o.salvaRiga("R2", { confermaRiga: true }),
    ]);
    c("righe diverse: in parallelo", 2, altre.massimo());
  }

  /* ── 9. SOLO COME DEVE ESSERE ────────────────────────────────────────── */
  gruppo("BULK · T11 · SORGENTE");
  const src = readFileSync(join(radice, "src/crm/fatture/bulk/usa-lotto.ts"), "utf8");
  c(
    "usa-lotto.ts: nessun console, nessuna memoria del browser (le foto non si tengono), nessun fetch diretto",
    [false, false, false],
    [
      /console\./.test(src),
      /localStorage|sessionStorage|indexedDB/.test(src),
      /[^a-zA-Z.]fetch\(/.test(src),
    ],
  );
  c(
    "la sessione (fetchCRM) è caricata al primo uso, non in cima al file",
    [false, true],
    [/^import[^\n]*AuthContext/m.test(src), /import\("@\/crm\/AuthContext"\)/.test(src)],
  );
  c("c'è l'avviso alla chiusura della scheda durante il lavoro", true, /beforeunload/.test(src));
}
