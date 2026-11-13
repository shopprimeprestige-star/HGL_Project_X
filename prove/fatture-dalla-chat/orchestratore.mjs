/** ── FATTURE DALLA CHAT · T7 · L'ORCHESTRAZIONE NEL BROWSER (usa-lotto-chat.ts) ──
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO §4, T7). Stesso schema di
 *  `prove/fatture-bulk/carico.mjs`: la rotta è FINTA e parla il contratto di
 *  `dalla-chat/tipi.ts` (la vera, T5, è già approvata — qui non si rifà, si
 *  prova solo l'orchestrazione: coda, avanzamento, ripresa, «occupato»,
 *  annullamento); le attese non aspettano, si registrano.
 *  `usa-lotto-chat.ts` non è nell'elenco `MODULI` di `prove/prove.mjs` (lo
 *  scrive il solo T0): si impacchetta QUI con `esbuild`, stesso schema già
 *  usato da T1-T5 per i loro file.
 *  ⚠️ Nessun dato personale: id di fantasia, nessun numero o CF vero. */
import { createRequire } from "node:module";
import { join } from "node:path";
import { LOTTO_PROVA, SCHEDA_PROVA, SCHEDA_PROVA_ALTRA } from "./dati.mjs";

const L = LOTTO_PROVA;
const S1 = SCHEDA_PROVA;
const S2 = SCHEDA_PROVA_ALTRA;

/** Una terza scheda di fantasia (UUID v4 valido), per i gruppi con 3+ clienti. */
const S3 = "c2d3e4f5-0617-4829-8abc-def123456789";

function rigaVuota(idRiga) {
  return { idRiga, scheda: idRiga, stato: "aperta" };
}

export async function prove(_mod, { c, gruppo, radice }) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const impacchettato = esbuild.buildSync({
    entryPoints: [join(radice, "src/crm/fatture/dalla-chat/usa-lotto-chat.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  }).outputFiles[0].text;
  const U = await import(
    `data:text/javascript;base64,${Buffer.from(impacchettato).toString("base64")}`
  );

  /* ══ 1. LE FUNZIONI PURE ═══════════════════════════════════════════════ */
  gruppo("DALLA CHAT · T7 · clientiDaCercare (ripresa, chiuse, da saltare)");
  {
    const righe = [
      { idRiga: S1, scheda: S1, stato: "aperta", chat: { letta: true, motivi: [] } },
      { idRiga: S2, scheda: S2, stato: "aperta" },
      {
        idRiga: S3,
        scheda: S3,
        stato: "emessa",
        emessa: { id: "x", numero: 1, data: "2026-11-01" },
      },
    ];
    c(
      "una riga con la chat già letta non si ricerca di nuovo (ripresa dopo ricaricamento)",
      [S2],
      U.clientiDaCercare(righe, [S1, S2]),
    );
    c(
      "una riga chiusa (emessa/scartata) non si ricerca mai",
      [S2],
      U.clientiDaCercare(righe, [S2, S3]),
    );
    c(
      "un cliente ancora senza riga (appena spuntato) si ricerca",
      ["nuovo-id"],
      U.clientiDaCercare(righe, ["nuovo-id"]),
    );
    c(
      "daSaltare (fallito in modo definitivo in questa sessione) esclude",
      [],
      U.clientiDaCercare(righe, [S2], new Set([S2])),
    );
    c("niente doppioni nell'elenco in ingresso", [S2], U.clientiDaCercare(righe, [S2, S2, S2]));
  }

  gruppo("DALLA CHAT · T7 · schedaVuota e lavoroInCorso");
  {
    c(
      "schedaVuota: nessun nome/cognome/CF, nessun importo noto, mai un lancio",
      { id: "x", nome: "", cognome: "", codiceFiscale: "", telefono: "", importoScheda: null },
      U.schedaVuota("x"),
    );
    c(
      "lavoroInCorso: vero durante il lavoro, falso dopo",
      [true, false],
      [
        U.lavoroInCorso({ ...U.STATO_INIZIALE, lavoro: { cosa: "ricerca", fatti: 0, totale: 1 } }),
        U.lavoroInCorso(U.STATO_INIZIALE),
      ],
    );
  }

  /* ══ 2. IL REDUCER ═══════════════════════════════════════════════════════ */
  gruppo("DALLA CHAT · T7 · il reducer non ricalcola mai niente");
  {
    const s0 = U.reducerLottoChat(U.STATO_INIZIALE, {
      tipo: "lotto",
      lotto: L,
      testata: {
        lotto: L,
        creatoIl: "x",
        descrizione: "",
        dataSeManca: "",
        firmaImpostazioni: "f",
      },
      righe: [rigaVuota(S1)],
    });
    c("la riga arriva com'è, nessun campo calcolato", [rigaVuota(S1)], s0.righe);
    const s1 = U.reducerLottoChat(s0, {
      tipo: "riga",
      riga: { idRiga: S1, stato: "emessa", emessa: { id: "f1", numero: 1, data: "2026-11-01" } },
    });
    c(
      "una patch parziale si FONDE con la riga esistente: scheda non sparisce",
      {
        idRiga: S1,
        scheda: S1,
        stato: "emessa",
        emessa: { id: "f1", numero: 1, data: "2026-11-01" },
      },
      s1.righe[0],
    );
    const s2 = U.reducerLottoChat(s1, {
      tipo: "riga",
      riga: { idRiga: S2, scheda: S2, stato: "aperta" },
    });
    c(
      "una riga nuova (idRiga non visto) si aggiunge",
      [S1, S2],
      s2.righe.map((r) => r.idRiga),
    );
    const s3 = U.reducerLottoChat(s2, { tipo: "lotto", lotto: "altro-lotto", righe: [] });
    c("un altro lotto riparte da zero", [], s3.righe);
    const s4 = U.reducerLottoChat(
      U.reducerLottoChat(s0, { tipo: "riga_fallita", idRiga: S1, codice: "rete" }),
      { tipo: "lotto", lotto: L, righe: [rigaVuota(S1)] },
    );
    c("lo stesso lotto riletto tiene gli errori di sessione", { [S1]: "rete" }, s4.erroriRiga);
    const s5 = U.reducerLottoChat(s4, { tipo: "righe_ripartite", idRighe: [S1] });
    c("righe_ripartite toglie l'errore della riga", {}, s5.erroriRiga);
    const s6 = U.reducerLottoChat(U.STATO_INIZIALE, { tipo: "lavoro", cosa: "ricerca", totale: 3 });
    const s7 = U.reducerLottoChat(U.reducerLottoChat(s6, { tipo: "avanza" }), { tipo: "avanza" });
    c("l'avanzamento conta", { cosa: "ricerca", fatti: 2, totale: 3 }, s7.lavoro);
    c(
      "`azzera` riporta allo stato iniziale",
      U.STATO_INIZIALE,
      U.reducerLottoChat(s7, { tipo: "azzera" }),
    );
  }

  /* ══ 3. L'ORCHESTRATORE, CON LA ROTTA FINTA ═══════════════════════════ */
  function banco({ su = () => undefined, emittente = "scheda-1", riduci } = {}) {
    const server = new Map();
    const testata = {
      lotto: L,
      creatoIl: "2026-11-13T10:00:00Z",
      descrizione: "",
      dataSeManca: "",
      firmaImpostazioni: "f",
    };
    let esiste = false;
    let numeroProssimo = 1;
    let s = U.STATO_INIZIALE;
    const chiamate = [];
    const attese = [];
    let righeViste = [];
    let inCorso = 0,
      massimo = 0;
    const fetchRotta = async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : null;
      chiamate.push({ url, body });
      inCorso++;
      massimo = Math.max(massimo, inCorso);
      try {
        // Ogni chiamata passa dall'event loop: concorrenza vera da osservare (`massimo`).
        await new Promise((r) => setImmediate(r));
        const custom = await su({ url, body, server });
        const r = custom ?? predefinita(url, body);
        return { ok: (r.stato ?? 200) < 400, status: r.stato ?? 200, json: async () => r.corpo };
      } finally {
        inCorso--;
      }
    };
    const predefinita = (url, body) => {
      if (!body) {
        if (url.includes("?lotto=")) {
          return { corpo: { testata, righe: [...server.values()] } };
        }
        return { corpo: [] };
      }
      switch (body.azione) {
        case "crea":
          esiste = true;
          return { corpo: { ok: true, azione: "crea", lotto: L } };
        case "aggiungi-cliente": {
          const g = server.get(body.schedaId) ?? rigaVuota(body.schedaId);
          server.set(body.schedaId, g);
          return { corpo: { ok: true, azione: "aggiungi-cliente", riga: g } };
        }
        case "cerca-chat": {
          const r = server.get(body.idRiga) ?? rigaVuota(body.idRiga);
          const aggiornata = { ...r, chat: { letta: true, motivi: [], segnaposto: false } };
          server.set(body.idRiga, aggiornata);
          return { corpo: { ok: true, azione: "cerca-chat", riga: aggiornata } };
        }
        case "rileggi-chat": {
          const r = server.get(body.idRiga) ?? rigaVuota(body.idRiga);
          const aggiornata = { ...r, chat: { letta: true, motivi: [], segnaposto: false } };
          server.set(body.idRiga, aggiornata);
          return { corpo: { ok: true, azione: "rileggi-chat", riga: aggiornata } };
        }
        case "carica-pagamento": {
          const r = server.get(body.idRiga) ?? rigaVuota(body.idRiga);
          const aggiornata = { ...r, pagamento: { stato: "salvato", impronta: "imp-1" } };
          server.set(body.idRiga, aggiornata);
          return { corpo: { ok: true, azione: "carica-pagamento", riga: aggiornata } };
        }
        case "leggi-pagamento": {
          const r = server.get(body.idRiga) ?? rigaVuota(body.idRiga);
          const aggiornata = {
            ...r,
            pagamento: {
              ...r.pagamento,
              stato: "letto",
              lettura: { tipo: "pagamento", importo: 100 },
            },
          };
          server.set(body.idRiga, aggiornata);
          return { corpo: { ok: true, azione: "leggi-pagamento", riga: aggiornata } };
        }
        case "scrivi-pagamento": {
          // Stessa forma del server vero (T11.2): zero controllo di CONTENUTO qui (la rotta
          // finta non è `pagamentoManualeValido`), basta a provare l'orchestrazione.
          const r = server.get(body.idRiga) ?? rigaVuota(body.idRiga);
          const aggiornata = {
            ...r,
            pagamento: {
              stato: "letto",
              impronta: "",
              lettura: {
                tipo: "pagamento",
                importo: body.importo,
                data: body.data,
                modo: body.modo,
                riferimento: body.riferimento,
              },
            },
          };
          server.set(body.idRiga, aggiornata);
          return { corpo: { ok: true, azione: "scrivi-pagamento", riga: aggiornata } };
        }
        case "salva-riga": {
          const r = server.get(body.idRiga) ?? rigaVuota(body.idRiga);
          const aggiornata = { ...r };
          if (body.modifiche && Object.keys(body.modifiche).length)
            aggiornata.modifiche = { ...r.modifiche, ...body.modifiche };
          if (body.confermaRiga !== undefined) aggiornata.confermata = body.confermaRiga;
          // Il server vero SOSTITUISCE confermeAvvisi (non unisce): stessa semantica qui.
          if (body.confermaAvvisi !== undefined)
            aggiornata.confermeAvvisi = [...new Set(body.confermaAvvisi)];
          if (body.scarta) aggiornata.stato = "scartata";
          server.set(body.idRiga, aggiornata);
          return {
            corpo: { ok: true, azione: "salva-riga", riga: aggiornata, lottoChiuso: false },
          };
        }
        case "emetti-riga": {
          const r = server.get(body.idRiga);
          if (!r) return { corpo: { ok: false, codice: "non_trovato", messaggio: "x" } };
          const numero = numeroProssimo++;
          const fattura = { id: `fatt-${numero}`, numero, data: "2026-11-05" };
          server.set(body.idRiga, { ...r, stato: "emessa", emessa: fattura });
          return {
            corpo: {
              ok: true,
              azione: "emetti-riga",
              esito: "emessa",
              fattura,
              lottoChiuso: false,
            },
          };
        }
        case "prendi-controllo":
        case "annulla":
          return { corpo: { ok: true, azione: body.azione } };
        case "pulisci":
          return { corpo: { ok: true, azione: "pulisci", rimossi: 0 } };
        default:
          return { corpo: { ok: true, azione: body.azione } };
      }
    };
    const o = U.creaOrchestratoreChat({
      fetchRotta,
      attendi: async (ms) => void attese.push(ms),
      riduci:
        riduci ??
        (async (f) => ({ dataUrl: `data:image/jpeg;base64,${f.nome}`, impronta: `h-${f.nome}` })),
      emittente,
      dispatch: (a) => {
        s = U.reducerLottoChat(s, a);
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
      esiste: () => esiste,
      massimo: () => massimo,
      conRighe: (r) => void (righeViste = r),
      azioni: (nome) => chiamate.filter((x) => x.body?.azione === nome).map((x) => x.body),
      get: () => chiamate.filter((x) => !x.body),
    };
  }

  /* ── crea + apri ────────────────────────────────────────────────────── */
  gruppo("DALLA CHAT · T7 · crea e apri");
  {
    const b = banco();
    const lotto = await b.o.crea("prova");
    c(
      "crea torna il lotto e lo apre subito (testata già nello stato)",
      [L, L],
      [lotto, b.stato().lotto],
    );
  }
  {
    const b = banco();
    b.server.set(S1, rigaVuota(S1));
    await b.o.apri(L);
    c(
      "apri rilegge dal server: la riga c'è già",
      [S1],
      b.stato().righe.map((r) => r.idRiga),
    );
  }

  /* ── aggiungiCliente ───────────────────────────────────────────────── */
  gruppo("DALLA CHAT · T7 · aggiungiCliente");
  {
    const b = banco();
    await b.o.crea("prova");
    const ok = await b.o.aggiungiCliente(S1);
    c(
      "la riga nasce con la scheda già scritta, nello stesso colpo",
      [true, S1],
      [ok, b.stato().righe.find((r) => r.idRiga === S1)?.scheda],
    );
  }

  /* ── cercaNelleChat: avanzamento, aggiungi-cliente solo se manca, parallelismo ── */
  gruppo("DALLA CHAT · T7 · cercaNelleChat");
  {
    const b = banco();
    // S1 è già una riga sul server (es. spuntata e aggiunta in una sessione precedente): la
    // ripresa non deve richiamare «aggiungi-cliente» per lei, solo per S2/S3 che sono nuovi.
    b.server.set(S1, rigaVuota(S1));
    await b.o.apri(L);
    let massimoVisto = 0;
    const lavoro = b.o.cercaNelleChat([S1, S2, S3]).then(() => {
      massimoVisto = b.massimo();
    });
    await lavoro;
    c(
      "aggiungi-cliente chiamato solo per i clienti nuovi (S2, S3), non per S1 già presente",
      [S2, S3].sort(),
      b
        .azioni("aggiungi-cliente")
        .map((x) => x.schedaId)
        .sort(),
    );
    c(
      "cerca-chat chiamato per tutti e tre i clienti scelti",
      [S1, S2, S3].sort(),
      b
        .azioni("cerca-chat")
        .map((x) => x.idRiga)
        .sort(),
    );
    c(
      "le tre righe risultano tutte con la chat letta",
      [true, true, true],
      [S1, S2, S3].map((id) => !!b.server.get(id)?.chat?.letta),
    );
    c(
      "al massimo 2 richieste insieme (IN_PARALLELO più basso che nella bulk)",
      true,
      b.massimo() <= 2,
    );
    c("lavoro libero a fine operazione", null, b.stato().lavoro);
  }
  {
    // Ripresa dopo un ricaricamento: una riga già letta non si ripaga.
    const b = banco();
    b.server.set(S1, { ...rigaVuota(S1), chat: { letta: true, motivi: [], segnaposto: false } });
    await b.o.apri(L);
    await b.o.cercaNelleChat([S1, S2]);
    c(
      "la riga già letta non chiama cerca-chat di nuovo; solo S2 viene cercato",
      [S2],
      b.azioni("cerca-chat").map((x) => x.idRiga),
    );
  }
  {
    // «Occupato»: gestito dalla coda (eseguiCoda), non conta come errore né come freno.
    let volte = 0;
    const b = banco({
      su: ({ body }) =>
        body?.azione === "cerca-chat" && body.idRiga === S1 && volte++ < 2
          ? { stato: 200, corpo: { ok: false, codice: "occupato", messaggio: "x" } }
          : undefined,
    });
    await b.o.crea("prova");
    await b.o.cercaNelleChat([S1]);
    c(
      "«occupato» due volte poi letta: nessun errore di riga, nessun freno, tre tentativi in tutto",
      [{}, null, 3],
      [b.stato().erroriRiga, b.stato().fermata, b.azioni("cerca-chat").length],
    );
  }
  {
    // «troncata»/«illeggibile»: non si ripetono da soli (si riprendono solo con rileggiChat).
    const b = banco({
      su: ({ body }) =>
        body?.azione === "cerca-chat" && body.idRiga === S1
          ? { stato: 200, corpo: { ok: false, codice: "illeggibile", messaggio: "x" } }
          : undefined,
    });
    await b.o.crea("prova");
    await b.o.cercaNelleChat([S1]);
    c("prima volta: fallita, registrata", "illeggibile", b.stato().erroriRiga[S1]);
    await b.o.cercaNelleChat([S1]);
    c(
      "«Riprendi» (nuovo cercaNelleChat) NON la ripete da sola: zero chiamate in più",
      1,
      b.azioni("cerca-chat").length,
    );
  }
  {
    // 5 falliti di fila: il freno ferma la ricerca.
    const b = banco({
      su: ({ body }) =>
        body?.azione === "cerca-chat"
          ? { stato: 200, corpo: { ok: false, codice: "rete", messaggio: "x" } }
          : undefined,
    });
    await b.o.crea("prova");
    const dieci = Array.from({ length: 10 }, (_, i) => `id-${i}`);
    // id finti (non UUID validi) non interessano qui: la rotta finta non valida il formato.
    await b.o.cercaNelleChat(dieci);
    c(
      "cinque falliti di fila: il freno ferma (non tutti e dieci clienti tentati)",
      ["freno", true],
      [b.stato().fermata?.per, b.azioni("aggiungi-cliente").length < 10],
    );
  }
  {
    // Annullamento («Interrompi») a metà ricerca.
    const b = banco();
    await b.o.crea("prova");
    let finito = false;
    const lavoro = b.o.cercaNelleChat([S1, S2, S3]).then(() => (finito = true));
    await new Promise((r) => setImmediate(r));
    b.o.interrompi();
    await lavoro;
    c(
      "«Interrompi» ferma per annullamento, non per freno",
      true,
      finito && (b.stato().fermata === null || b.stato().fermata.per === "annullata"),
    );
  }

  /* ── caricaPagamento / leggiPagamento ──────────────────────────────── */
  gruppo("DALLA CHAT · T7 · caricaPagamento e leggiPagamento");
  {
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    const nonValido = { type: "application/pdf", size: 100, nome: "x" };
    const rifiutato = await b.o.caricaPagamento(S1, nonValido);
    c(
      "un file non immagine è rifiutato PRIMA di qualunque chiamata: nessun upload partito",
      [false, "file_non_valido", 0],
      [rifiutato, b.stato().errore?.codice, b.azioni("carica-pagamento").length],
    );
  }
  {
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    const buono = { type: "image/png", size: 1000, nome: "f1" };
    const ok = await b.o.caricaPagamento(S1, buono);
    const riga = b.stato().righe.find((r) => r.idRiga === S1);
    c(
      "carica-pagamento poi leggi-pagamento, in sequenza: la riga finisce con la lettura",
      [true, "letto", 1, 1],
      [
        ok,
        riga.pagamento.stato,
        b.azioni("carica-pagamento").length,
        b.azioni("leggi-pagamento").length,
      ],
    );
  }
  {
    // «Occupato» sul caricamento (corsa fra due schede sulla stessa riga): eredita il ritentativo.
    let volte = 0;
    const b = banco({
      su: ({ body }) =>
        body?.azione === "carica-pagamento" && volte++ === 0
          ? { stato: 200, corpo: { ok: false, codice: "occupato", messaggio: "x" } }
          : undefined,
    });
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    const ok = await b.o.caricaPagamento(S1, { type: "image/png", size: 1000, nome: "f1" });
    c("occupato la prima volta, poi va: nessun errore finale", true, ok);
  }
  {
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    const ok = await b.o.leggiPagamento(S1);
    c(
      "leggiPagamento da sola: una sola chiamata",
      [true, 1],
      [ok, b.azioni("leggi-pagamento").length],
    );
  }

  /* ── corpoPagamentoManuale (T17, SPEC §9.3 passo 7/§9.7 criterio 3) ─── */
  gruppo(
    "DALLA CHAT · T17 · corpoPagamentoManuale (dai CampiRiga già mostrati, nessun campo nuovo)",
  );
  {
    c(
      "i 4 campi completi (importo già numero, come dopo leggiImportoScritto) → il corpo esatto per scrivi-pagamento",
      { importo: 45.5, data: "2026-11-10", modo: "bonifico", riferimento: "CRO123" },
      U.corpoPagamentoManuale({
        importo: 45.5,
        data: "2026-11-10",
        modo: "bonifico",
        riferimento: "CRO123",
      }),
    );
    c(
      "il riferimento vuoto non blocca: resta l'unico campo facoltativo",
      { importo: 10, data: "2026-11-10", modo: "contanti", riferimento: "" },
      U.corpoPagamentoManuale({
        importo: 10,
        data: "2026-11-10",
        modo: "contanti",
        riferimento: "",
      }),
    );
    c(
      "importo null/0/negativo, data vuota, modo vuoto → null (uno dei 3 campi obbligatori manca)",
      [null, null, null, null, null],
      [
        U.corpoPagamentoManuale({
          importo: null,
          data: "2026-11-10",
          modo: "bonifico",
          riferimento: "",
        }),
        U.corpoPagamentoManuale({
          importo: 0,
          data: "2026-11-10",
          modo: "bonifico",
          riferimento: "",
        }),
        U.corpoPagamentoManuale({
          importo: -5,
          data: "2026-11-10",
          modo: "bonifico",
          riferimento: "",
        }),
        U.corpoPagamentoManuale({ importo: 10, data: "", modo: "bonifico", riferimento: "" }),
        U.corpoPagamentoManuale({ importo: 10, data: "2026-11-10", modo: "", riferimento: "" }),
      ],
    );
  }

  /* ── corpoPagamentoDaBozze (correzione del DA RIFARE: NIENTE gara con l'onBlur asincrono) ── */
  gruppo(
    "DALLA CHAT · T17 (correzione) · corpoPagamentoDaBozze legge le BOZZE, mai i CampiRiga vecchi",
  );
  {
    const leggiImportoFinto = (s) => {
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) ? { ok: true, valore: n } : { ok: false, messaggio: "x" };
    };
    c(
      "4 bozze complete → lo stesso corpo di corpoPagamentoManuale",
      { importo: 45.5, data: "2026-11-10", modo: "bonifico", riferimento: "CRO123" },
      U.corpoPagamentoDaBozze(
        { importoTesto: "45,5", data: "2026-11-10", modo: "bonifico", riferimento: "CRO123" },
        leggiImportoFinto,
      ),
    );
    c(
      // Lo scenario ESATTO del DA RIFARE: il titolare scrive il CRO e clicca subito. `riga.campi`
      // (qui simulato con un ipotetico valore «vecchio», mai passato a questa funzione) non
      // interviene: la funzione non accetta `CampiRiga` come input, SOLO le bozze — la gara non
      // può esistere per costruzione, non per tempismo fortunato.
      "la bozza appena scritta (non ancora salvata lato server) è quella che parte, non un valore «vecchio» di CampiRiga",
      "CRO-APPENA-SCRITTO",
      U.corpoPagamentoDaBozze(
        {
          importoTesto: "10",
          data: "2026-11-10",
          modo: "bonifico",
          riferimento: "CRO-APPENA-SCRITTO",
        },
        leggiImportoFinto,
      )?.riferimento,
    );
    c(
      "importo scritto male (testo non numerico) → null, stesso cancello di corpoPagamentoManuale",
      null,
      U.corpoPagamentoDaBozze(
        { importoTesto: "abc", data: "2026-11-10", modo: "bonifico", riferimento: "" },
        leggiImportoFinto,
      ),
    );
  }

  /* ── la conversione con la virgola arriva dallo stesso convertitore della bulk (leggiImportoScritto) ── */
  gruppo("DALLA CHAT · T17 · 45,50 scritto a mano → 45.5 nel corpo della richiesta (integrazione)");
  {
    const esbuildBulk = createRequire(import.meta.url)("esbuild");
    const impacchettatoBulk = esbuildBulk.buildSync({
      entryPoints: [join(radice, "src/crm/fatture/bulk/PannelloRigaBulk.tsx")],
      bundle: true,
      format: "esm",
      platform: "node",
      write: false,
      logLevel: "silent",
      jsx: "automatic",
      loader: { ".tsx": "tsx" },
      alias: { "@": join(radice, "src") },
      nodePaths: [join(radice, "node_modules")],
    }).outputFiles[0].text;
    const B = await import(
      `data:text/javascript;base64,${Buffer.from(impacchettatoBulk).toString("base64")}`
    );
    const letto = B.leggiImportoScritto("45,50");
    c(
      "leggiImportoScritto('45,50') legge 45.5, non una stringa",
      [true, 45.5],
      [letto.ok, letto.valore],
    );
    c(
      "quel valore, nei CampiRiga, produce il corpo giusto per scrivi-pagamento",
      { importo: 45.5, data: "2026-11-10", modo: "bonifico", riferimento: "CRO123" },
      U.corpoPagamentoManuale({
        importo: letto.valore,
        data: "2026-11-10",
        modo: "bonifico",
        riferimento: "CRO123",
      }),
    );
    c(
      // Stesso giro, ma con la funzione VERA usata dal pannello (`corpoPagamentoDaBozze` +
      // `leggiImportoScritto` reale, non finta): «45,50» scritto nel campo (bozza) → 45.5 spedito.
      "la stessa conversione passando per corpoPagamentoDaBozze (quella usata davvero dal pannello)",
      { importo: 45.5, data: "2026-11-10", modo: "bonifico", riferimento: "CRO123" },
      U.corpoPagamentoDaBozze(
        { importoTesto: "45,50", data: "2026-11-10", modo: "bonifico", riferimento: "CRO123" },
        B.leggiImportoScritto,
      ),
    );
  }

  /* ── scriviPagamento (T17): una sola chiamata, il corpo giusto, la riga si aggiorna ── */
  gruppo("DALLA CHAT · T17 · scriviPagamento: chiama la rotta e aggiorna la riga (si sblocca)");
  {
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    const corpo = { importo: 45.5, data: "2026-11-10", modo: "bonifico", riferimento: "CRO123" };
    const ok = await b.o.scriviPagamento(S1, corpo);
    const riga = b.stato().righe.find((r) => r.idRiga === S1);
    c(
      "una sola chiamata scrivi-pagamento, col lotto/idRiga/i 4 campi esatti",
      [true, 1, { lotto: L, idRiga: S1, ...corpo }],
      [
        ok,
        b.azioni("scrivi-pagamento").length,
        (() => {
          const { azione, ...resto } = b.azioni("scrivi-pagamento")[0];
          return resto;
        })(),
      ],
    );
    c(
      "la riga torna con `pagamento.lettura` presente: si sblocca (zero tocchi a valuta-chat.ts)",
      true,
      !!riga.pagamento?.lettura,
    );
  }
  {
    // Doppio tocco sul tasto «Salva pagamento», prima che il primo finisca: nessuna seconda chiamata.
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    const corpo = { importo: 10, data: "2026-11-10", modo: "contanti", riferimento: "" };
    const [ok1, ok2] = await Promise.all([
      b.o.scriviPagamento(S1, corpo),
      b.o.scriviPagamento(S1, corpo),
    ]);
    c(
      "doppio invio concorrente: solo uno dei due parte davvero (guardia sul tasto/sull'orchestratore)",
      [true, 1],
      [ok1 === true || ok2 === true, b.azioni("scrivi-pagamento").length],
    );
  }
  {
    // La rotta finta risponde `richiesta_non_valida` (es. data del 31 febbraio): nessuna riga
    // aggiornata, l'errore resta visibile (`stato.errore`), mostrato in modo onesto dall'avviso già esistente.
    const b = banco({
      su: ({ body }) =>
        body?.azione === "scrivi-pagamento"
          ? {
              stato: 400,
              corpo: {
                ok: false,
                codice: "richiesta_non_valida",
                messaggio: "Richiesta non valida.",
              },
            }
          : undefined,
    });
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    const ok = await b.o.scriviPagamento(S1, {
      importo: 10,
      data: "2026-02-31",
      modo: "bonifico",
      riferimento: "",
    });
    c(
      // Stesso schema di OGNI altra azione di questo hook (caricaPagamento, leggi-pagamento…):
      // `unaVolta` non porta il messaggio del server nell'errore, usa `fraseDi(codice)` (bulk/
      // usa-lotto.ts) — per `richiesta_non_valida` non c'è una frase propria, quindi il fallback
      // generico. Non è un buco di questo compito: non è mai swallowed (lo stato.errore si popola
      // sempre), è lo stesso comportamento di sempre per questo codice su questa rotta.
      "richiesta_non_valida: nessun blocco silenzioso, l'errore arriva allo stato (stesso fallback generico di ogni altra azione di questo hook)",
      [false, "richiesta_non_valida", "Qualcosa non ha funzionato: riprova."],
      [ok, b.stato().errore?.codice, b.stato().errore?.messaggio],
    );
  }

  /* ── scrivere un campo e cliccare SUBITO «Salva pagamento»: non si pestano (collaudo c6bd1e2) ── */
  gruppo(
    "DALLA CHAT · T17 (correzione) · salvaRiga (il campo) e scriviPagamento in parallelo, stessa riga: nessuno dei due si perde",
  );
  {
    // Lo scenario esatto del collaudo: il titolare scrive il CRO (→ `salva-riga` parte
    // sull'onBlur) e clicca SUBITO «Salva pagamento» (→ `scriviPagamento`), senza aspettare che
    // il primo torni. `salva-riga` scrive `chat_fatture_r` (via `salvaRiga`, la coda PER RIGA di
    // questo hook); `scriviPagamento` scrive `chat_fatture_p` (via `unaVolta`, lo slot globale di
    // lavoro) — chiavi diverse, nessuna delle due deve bloccare o scartare l'altra.
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    const corpo = { importo: 45.5, data: "2026-11-10", modo: "bonifico", riferimento: "CRO-X" };
    const [okCampo, okPagamento] = await Promise.all([
      b.o.salvaRiga(S1, { modifiche: { riferimento: "CRO-X" } }),
      b.o.scriviPagamento(S1, corpo),
    ]);
    const riga = b.stato().righe.find((r) => r.idRiga === S1);
    c(
      "entrambi riescono: nessuno dei due viene scartato o bloccato dall'altro",
      [true, true],
      [okCampo, okPagamento],
    );
    c(
      "il campo (modifiche.riferimento) e il pagamento (pagamento.lettura) arrivano ENTRAMBI sulla riga finale",
      ["CRO-X", true],
      [riga.modifiche?.riferimento, !!riga.pagamento?.lettura],
    );
    c(
      "una chiamata sola per ciascuna azione: nessuna ripetuta, nessuna persa",
      [1, 1],
      [b.azioni("salva-riga").length, b.azioni("scrivi-pagamento").length],
    );
  }
  {
    // Stesso scenario, ma lo «stato.lavoro» globale è già occupato da un'altra riga che sta
    // caricando/leggendo un bonifico (`cosa:"pagamento"` di un'ALTRA riga): `scriviPagamento`
    // su QUESTA riga deve aspettare in coda, non sparire — stesso schema di «occupato» di
    // `caricaPagamento`/`leggiPagamento` (eredita i ritentativi di `eseguiCoda`).
    let primaVolta = true;
    const b = banco({
      su: ({ body }) =>
        body?.azione === "scrivi-pagamento" && primaVolta
          ? ((primaVolta = false),
            { stato: 200, corpo: { ok: false, codice: "occupato", messaggio: "x" } })
          : undefined,
    });
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    const ok = await b.o.scriviPagamento(S1, {
      importo: 10,
      data: "2026-11-10",
      modo: "contanti",
      riferimento: "",
    });
    c(
      "«occupato» (lotto impegnato altrove) non perde il clic: si ritenta da sola e arriva comunque",
      true,
      ok,
    );
  }

  /* ── rileggiChat ───────────────────────────────────────────────────── */
  gruppo("DALLA CHAT · T7 · rileggiChat (gesto esplicito, mai saltato)");
  {
    const b = banco({
      su: ({ body }) =>
        body?.azione === "cerca-chat"
          ? { stato: 200, corpo: { ok: false, codice: "illeggibile", messaggio: "x" } }
          : undefined,
    });
    await b.o.crea("prova");
    await b.o.cercaNelleChat([S1]);
    c(
      "prima la ricerca normale fallisce in modo definitivo",
      "illeggibile",
      b.stato().erroriRiga[S1],
    );
    const b2 = { ...b };
    const ok = await b.o.rileggiChat(S1);
    c(
      "«Rileggi» la riprende comunque (non è cercaNelleChat, non salta mai)",
      [true, undefined],
      [ok, b.stato().erroriRiga[S1]],
    );
  }

  /* ── salvaRiga ─────────────────────────────────────────────────────── */
  gruppo("DALLA CHAT · T7 · salvaRiga: modifiche e confermeAvvisi si uniscono");
  {
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    await b.o.salvaRiga(S1, { modifiche: { comune: "Roma" } });
    await b.o.salvaRiga(S1, { modifiche: { cap: "00100" } });
    const riga = b.stato().righe.find((r) => r.idRiga === S1);
    c(
      "le modifiche di due salvataggi successivi si uniscono (non si perde la prima)",
      { comune: "Roma", cap: "00100" },
      riga.modifiche,
    );
    await b.o.salvaRiga(S1, { confermaAvvisi: ["data_anteriore"] });
    await b.o.salvaRiga(S1, { confermaAvvisi: ["oltre_12_giorni"] });
    const riga2 = b.stato().righe.find((r) => r.idRiga === S1);
    c(
      "le conferme di avviso si uniscono (il server sostituisce, quindi il client manda sempre l'unione)",
      ["data_anteriore", "oltre_12_giorni"],
      riga2.confermeAvvisi,
    );
  }

  /* ── confermaTutteLePronte / confermaAvvisoPerTutte ───────────────── */
  gruppo("DALLA CHAT · T7 · conferme in blocco");
  {
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    await b.o.aggiungiCliente(S2);
    b.conRighe([
      {
        idRiga: S1,
        numero: 1,
        stato: "pronto",
        emettibile: false,
        motivi: [],
        scheda: S1,
        campi: { data: "2026-11-01" },
      },
      {
        idRiga: S2,
        numero: 2,
        stato: "da_controllare",
        emettibile: false,
        motivi: [],
        scheda: S2,
        campi: { data: "2026-11-01" },
      },
    ]);
    const n = await b.o.confermaTutteLePronte();
    c(
      "conferma solo le righe «pronto»: una sola chiamata salva-riga, S1",
      [1, [S1]],
      [n, b.azioni("salva-riga").map((x) => x.idRiga)],
    );
  }
  {
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    b.conRighe([
      {
        idRiga: S1,
        numero: 1,
        stato: "da_controllare",
        emettibile: false,
        motivi: [{ codice: "data_anteriore", gravita: "conferma", testo: "x" }],
        scheda: S1,
        campi: { data: "2026-11-01" },
      },
    ]);
    const n = await b.o.confermaAvvisoPerTutte("data_anteriore");
    c("conferma l'avviso consentito per tutte le righe che lo portano", 1, n);
    const n2 = await b.o.confermaAvvisoPerTutte("un_codice_qualsiasi");
    c("un codice fuori da AVVISI_PER_TUTTE non fa niente", 0, n2);
  }

  /* ── emettiConfermate ──────────────────────────────────────────────── */
  gruppo("DALLA CHAT · T7 · emettiConfermate");
  {
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    await b.o.aggiungiCliente(S2);
    b.conRighe([
      {
        idRiga: S2,
        numero: 2,
        stato: "confermata",
        emettibile: true,
        motivi: [],
        scheda: S2,
        campi: { data: "2026-11-02" },
      },
      {
        idRiga: S1,
        numero: 1,
        stato: "confermata",
        emettibile: true,
        motivi: [],
        scheda: S1,
        campi: { data: "2026-11-01" },
      },
    ]);
    const riepilogo = await b.o.emettiConfermate();
    c(
      "emette in ordine di DATA (non di spunta): S1 prima di S2",
      [S1, S2],
      b.azioni("emetti-riga").map((x) => x.idRiga),
    );
    c("il riepilogo riporta le due emesse", 2, riepilogo.emesse.length);
    const riga1 = b.stato().righe.find((r) => r.idRiga === S1);
    c(
      "dopo l'emissione la riga resta COMPLETA (scheda non sparisce, patch parziale si fonde)",
      [S1, "emessa"],
      [riga1.scheda, riga1.stato],
    );
  }
  {
    const b = banco({
      su: ({ body }) =>
        body?.azione === "emetti-riga" && body.idRiga === S2
          ? {
              stato: 200,
              corpo: {
                ok: true,
                azione: "emetti-riga",
                esito: "saltata",
                motivi: [{ codice: "cf_mancante", gravita: "blocca", testo: "x" }],
              },
            }
          : undefined,
    });
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    await b.o.aggiungiCliente(S2);
    b.conRighe([
      {
        idRiga: S1,
        numero: 1,
        stato: "confermata",
        emettibile: true,
        motivi: [],
        scheda: S1,
        campi: { data: "2026-11-01" },
      },
      {
        idRiga: S2,
        numero: 2,
        stato: "confermata",
        emettibile: true,
        motivi: [],
        scheda: S2,
        campi: { data: "2026-11-02" },
      },
    ]);
    const riepilogo = await b.o.emettiConfermate();
    c(
      "una riga saltata non ferma le altre",
      [1, 1],
      [riepilogo.emesse.length, riepilogo.saltate.length],
    );
  }
  {
    const b = banco({
      su: ({ body }) =>
        body?.azione === "emetti-riga"
          ? {
              stato: 200,
              corpo: {
                ok: true,
                azione: "emetti-riga",
                esito: "ferma",
                codice: "impostazioni_cambiate",
                messaggio: "x",
              },
            }
          : undefined,
    });
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    await b.o.aggiungiCliente(S2);
    b.conRighe([
      {
        idRiga: S1,
        numero: 1,
        stato: "confermata",
        emettibile: true,
        motivi: [],
        scheda: S1,
        campi: { data: "2026-11-01" },
      },
      {
        idRiga: S2,
        numero: 2,
        stato: "confermata",
        emettibile: true,
        motivi: [],
        scheda: S2,
        campi: { data: "2026-11-02" },
      },
    ]);
    const riepilogo = await b.o.emettiConfermate();
    c(
      "«ferma»: si ferma TUTTO, la seconda riga non viene nemmeno tentata",
      ["impostazioni_cambiate", 1],
      [riepilogo.fermata?.codice, b.azioni("emetti-riga").length],
    );
  }
  {
    const b = banco();
    await b.o.crea("prova");
    await b.o.aggiungiCliente(S1);
    await b.o.aggiungiCliente(S2);
    await b.o.aggiungiCliente(S3);
    b.conRighe(
      [S1, S2, S3].map((id, i) => ({
        idRiga: id,
        numero: i + 1,
        stato: "confermata",
        emettibile: true,
        motivi: [],
        scheda: id,
        campi: { data: `2026-11-0${i + 1}` },
      })),
    );
    let finito = false;
    const lavoro = b.o.emettiConfermate().then(() => (finito = true));
    await new Promise((r) => setImmediate(r));
    b.o.interrompi();
    await lavoro;
    c(
      "«Interrompi» durante l'emissione: si ferma per annullamento, non emette tutto",
      true,
      finito && b.azioni("emetti-riga").length < 3,
    );
  }

  /* ── prendiIlControllo / annullaLotto ──────────────────────────────── */
  gruppo("DALLA CHAT · T7 · prendiIlControllo e annullaLotto");
  {
    const b = banco();
    await b.o.crea("prova");
    const ok = await b.o.prendiIlControllo();
    c(
      "prendi-controllo manda l'emittente della scheda",
      [true, "scheda-1"],
      [ok, b.azioni("prendi-controllo")[0]?.emittente],
    );
  }
  {
    const b = banco();
    await b.o.crea("prova");
    const ok = await b.o.annullaLotto();
    c("annulla il lotto: lo stato torna vuoto", [true, null], [ok, b.stato().lotto]);
  }

  /* ── codice d'errore: niente intestazione CORS, e «beforeunload» c'è ── */
  gruppo("DALLA CHAT · T7 · sorgente");
  {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(join(radice, "src/crm/fatture/dalla-chat/usa-lotto-chat.ts"), "utf8");
    c("c'è l'avviso alla chiusura della scheda durante il lavoro", true, /beforeunload/.test(src));
    c(
      "nessun dato personale nei commenti o nel codice (grep manuale: niente CF/telefono di fantasia)",
      false,
      /\d{11}|\d{9,}/.test(src.replace(/9d2e|3f2a9c1e/g, "")),
    );
  }
}
