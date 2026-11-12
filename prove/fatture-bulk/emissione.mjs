/** ── FATTURE BULK · T7 · EMISSIONE SICURA ──────────────────────────────────
 *  Archivio protetto (lettura paginata per chiave, cancellazione per prefisso), emissione di una riga
 *  (numeri senza buchi né sovrascritture), ordine e fatti sulle date, lucchetto/reclamo/emittente.
 *  ⚠️ NIENTE rete e niente database vero: un finto client Supabase in memoria che parla come
 *   PostgREST (tetto di 1000 righe, `23505` sul doppione, ordine per chiave), con i punti dove
 *   iniettare una gara. La prova sul database vero è T15 (prove/manuali). Dati di fantasia. */
import { CF_PROVA, LOTTO_PROVA } from "./dati.mjs";

const L = LOTTO_PROVA;

/* ── dati ─────────────────────────────────────────────────────────────── */
function emessa(numero, extra = {}) {
  const anno = extra.anno ?? 2026;
  const serie = extra.serie ?? "";
  return {
    id: `${anno}-${String(numero).padStart(4, "0")}`,
    stato: "emessa",
    numero,
    anno,
    serie,
    data: `${anno}-10-01`,
    dataPagamento: `${anno}-10-01`,
    tipo: "unica",
    leadId: `altra-${numero}`,
    leadNome: "Anna Esempio",
    preventivoRef: "",
    cliente: {
      azienda: false,
      denominazione: "",
      nome: "Anna",
      cognome: "Esempio",
      codiceFiscale: CF_PROVA,
      partitaIva: "",
      indirizzo: "Via Prova 1",
      civico: "",
      cap: "00100",
      comune: "Roma",
      provincia: "RM",
      nazione: "IT",
      codiceDestinatario: "0000000",
      pec: "",
    },
    righe: [
      {
        descrizione: "Fornitura impianto capillare",
        quantita: 1,
        prezzoUnitario: 100,
        aliquota: 22,
      },
    ],
    causale: "",
    imponibile: 100,
    imposta: 22,
    totale: 122,
    creataIl: "2026-10-01T00:00:00Z",
    emessaIl: "2026-10-01T00:00:00Z",
    ...extra,
  };
}
const chiaveDi = (f) => `fattura:${f.id}${f.serie ? `-${f.serie}` : ""}`;
/** Una fattura del bulk, ancora da emettere (bozza con la sua origine). */
const daBulk = (riga, extra = {}) => ({
  ...emessa(0, { leadId: `bulk:${L}:${riga}`, leadNome: "Bruno Fantasia" }),
  stato: "bozza",
  numero: 0,
  id: `bozza:bulk:${L}:${riga}`,
  origineBulk: { lotto: L, riga, impronte: [riga.padEnd(64, "0")] },
  ...extra,
});

/* ── il finto client Supabase ─────────────────────────────────────────── */
const lett = (ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function comeLike(p) {
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === "\\") re += lett(p[++i] ?? "");
    else if (ch === "%") re += ".*";
    else if (ch === "_") re += ".";
    else re += lett(ch);
  }
  return new RegExp(`^${re}$`, "s");
}

/** `righe`: [[key, value]]. `tetto`: righe per risposta (PostgREST: 1000). `hook`:
 *  dopoPagina(n, m, righe) · rifiutaInsert(key) → errore | null · rispostaPersa(key) → bool
 *  (l'inserimento riesce ma la risposta è un errore) · dopoInsert(key, m). */
function clienteFinto({ righe = [], tetto = 1000, hook = {} } = {}) {
  const m = new Map(righe);
  const reg = { sottorichieste: 0, like: [], pagine: [], insert: 0, cancellate: [] };

  function costruisci(op, valori) {
    const q = { filtri: [], lim: Infinity };
    const aggiungi = (f) => {
      q.filtri.push(f);
      return q;
    };
    q.eq = (k, v) => aggiungi((r) => r[k] === v);
    q.like = (k, p) => {
      const re = comeLike(p);
      reg.like.push(p);
      return aggiungi((r) => re.test(r[k]));
    };
    q.gt = (k, v) => aggiungi((r) => r[k] > v);
    q.in = (k, v) => aggiungi((r) => v.includes(r[k]));
    q.order = () => q;
    q.limit = (n) => {
      q.lim = n;
      return q;
    };
    q.select = () => q;
    const esegui = () => {
      reg.sottorichieste++;
      const trovate = [...m]
        .map(([key, value]) => ({ key, value }))
        .filter((r) => q.filtri.every((f) => f(r)))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      if (op === "select") {
        const pagina = trovate.slice(0, Math.min(q.lim, tetto));
        reg.pagine.push(pagina.length);
        hook.dopoPagina?.(reg.pagine.length, m, pagina);
        return { data: pagina, error: null };
      }
      if (op === "update") for (const r of trovate) m.set(r.key, valori.value);
      if (op === "delete")
        for (const r of trovate) {
          m.delete(r.key);
          reg.cancellate.push(r.key);
        }
      return { data: trovate.map((r) => ({ key: r.key })), error: null };
    };
    q.maybeSingle = async () => {
      const r = esegui();
      return { data: r.data[0] ?? null, error: r.error };
    };
    q.then = (ok, ko) => Promise.resolve(esegui()).then(ok, ko);
    return q;
  }

  const client = {
    from: (t) => {
      if (t !== "app_config") throw new Error(`tabella inattesa: ${t}`);
      return {
        select: () => costruisci("select"),
        update: (v) => costruisci("update", v),
        delete: () => costruisci("delete"),
        insert: async ({ key, value }) => {
          reg.sottorichieste++;
          reg.insert++;
          const rifiuto = hook.rifiutaInsert?.(key);
          if (rifiuto) return { error: rifiuto };
          if (m.has(key))
            return {
              error: {
                code: "23505",
                message: 'duplicate key value violates unique constraint "app_config_pkey"',
              },
            };
          m.set(key, value);
          hook.dopoInsert?.(key, m);
          if (hook.rispostaPersa?.(key)) return { error: { message: "rete caduta" } };
          return { error: null };
        },
      };
    },
  };
  return { client, m, reg };
}

const emesseDa = (m) =>
  [...m].filter(([k]) => k.startsWith("fattura:")).map(([, v]) => JSON.parse(v));
const caricaEmesse = (m, n, extra = (i) => ({})) => {
  for (let i = 1; i <= n; i++) {
    const f = emessa(i, extra(i));
    m.set(chiaveDi(f), JSON.stringify(f));
  }
};
/** Un altro emettitore prende il numero `n` mentre noi stiamo leggendo. */
const gara =
  (n, extra = {}) =>
  (m) => {
    const f = emessa(n, { leadId: `concorrente-${n}`, ...extra });
    m.set(chiaveDi(f), JSON.stringify(f));
  };

/* ── un finto per i lucchetti ─────────────────────────────────────────── */
function portaFinta() {
  const m = new Map();
  return {
    m,
    leggi: async (k) => m.get(k) ?? null,
    creaSeAssente: async (k, v) => {
      if (m.has(k)) return false;
      m.set(k, v);
      return true;
    },
    sostituisciSe: async (k, atteso, nuovo) => {
      if (m.get(k) !== atteso) return false;
      m.set(k, nuovo);
      return true;
    },
    eliminaSe: async (k, atteso) => {
      if (m.get(k) !== atteso) return false;
      m.delete(k);
      return true;
    },
  };
}

export async function prove(mod, { c, gruppo }) {
  const AR = mod["fatture/archivio"];
  const FT = mod["fatture/tipi"];
  const EB = mod["fatture/bulk/emissione-bulk"];
  const LK = mod["fatture/bulk/lucchetto.server"];
  const azienda = { ...FT.AZIENDA_VUOTA, annoNumerazione: 2026, primoNumero: 1, serie: "" };
  const nuovoArchivio = (opz) => {
    const f = clienteFinto(opz);
    return { ...f, archivio: EB.archivioProtettoSu(f.client) };
  };

  /* ═════════════ 1. L'ARCHIVIO PROTETTO ═════════════ */
  gruppo("BULK · T7 · LETTURA PAGINATA PER CHIAVE");
  {
    const f = clienteFinto();
    caricaEmesse(f.m, 1500);
    const a = EB.archivioProtettoSu(f.client);
    const r = await a.leggiPrefissoPerChiave("fattura:");
    c(
      "1.500 emesse → tutte e 1.500, una volta sola",
      [1500, 1500],
      [r.length, new Set(r.map((x) => x.key)).size],
    );
    c(
      "in ordine di chiave",
      true,
      r.every((x, i) => i === 0 || r[i - 1].key < x.key),
    );
    c(
      "pagine da 1000 e 500: due sottorichieste",
      [[1000, 500], 2],
      [f.reg.pagine, f.reg.sottorichieste],
    );
    c(
      "il numero giusto con più di 1000 emesse (la lettura di prima si fermava a 1000)",
      [true, 1501],
      await (async () => {
        const n = await AR.prossimoNumeroSu(
          { ...a, leggiPrefisso: a.leggiPrefissoPerChiave },
          azienda,
          2026,
        );
        return [n.ok, n.numero];
      })(),
    );

    c(
      "anche `leggiPrefisso` (il nome di sempre) è paginato nell'archivio protetto",
      1500,
      (await a.leggiPrefisso("fattura:")).length,
    );

    const f1000 = clienteFinto();
    caricaEmesse(f1000.m, 1000);
    const r1000 = await EB.archivioProtettoSu(f1000.client).leggiPrefissoPerChiave("fattura:");
    c(
      "esattamente 1000: una seconda pagina vuota chiude (non si può sapere prima)",
      [1000, [1000, 0]],
      [r1000.length, f1000.reg.pagine],
    );

    const fv = clienteFinto();
    const rv = await EB.archivioProtettoSu(fv.client).leggiPrefissoPerChiave("fattura:");
    c("nessuna emessa → lista vuota, una sottorichiesta", [[], 1], [rv, fv.reg.sottorichieste]);

    const fp = clienteFinto({
      righe: [
        ["bulk_fatture_f:x:0001", "1"],
        ["bulkXfatture_f:x:0001", "2"],
        ["fattura_bozza:z", "3"],
      ],
    });
    const rp = await EB.archivioProtettoSu(fp.client).leggiPrefissoPerChiave("bulk_fatture_f:x:");
    c(
      "il «_» del prefisso non è un jolly: «bulkXfatture_f» non entra",
      ["bulk_fatture_f:x:0001"],
      rp.map((x) => x.key),
    );
    c("il LIKE inviato ha il «_» protetto", ["bulk\\_fatture\\_f:x:%"], fp.reg.like);

    const fg = clienteFinto({
      hook: {
        dopoPagina: (n) => {
          if (n === 1) throw new Error("rete caduta a metà");
        },
      },
    });
    caricaEmesse(fg.m, 1500);
    let errore = "";
    try {
      await EB.archivioProtettoSu(fg.client).leggiPrefissoPerChiave("fattura:");
    } catch (e) {
      errore = e.message;
    }
    c(
      "(una pagina che fallisce a metà non si scambia per «finito»: l'errore sale)",
      "rete caduta a metà",
      errore,
    );
  }

  gruppo("BULK · T7 · INSERIMENTI MENTRE SI LEGGE: NIENTE SALTI NÉ DOPPIONI");
  {
    // 2.500 righe «fattura:2026-0001…2500». Alla prima pagina arrivano una chiave PRIMA del cursore e
    // una DOPO; alla seconda ne sparisce una già letta e una ancora da leggere. Con l'offset
    // (`range`) la riga 1001 sarebbe stata saltata o letta due volte.
    const f = clienteFinto({
      hook: {
        dopoPagina: (n, m) => {
          if (n === 1) {
            m.set("fattura:2026-0000", "{}");
            m.set("fattura:2026-9999", "{}");
          }
          if (n === 2) {
            m.delete("fattura:2026-0500");
            m.delete("fattura:2026-2000");
          }
        },
      },
    });
    caricaEmesse(f.m, 2500);
    const iniziali = [...f.m.keys()].filter(
      (k) => k !== "fattura:2026-0000" && k !== "fattura:2026-9999",
    );
    const r = await EB.archivioProtettoSu(f.client).leggiPrefissoPerChiave("fattura:");
    const chiavi = r.map((x) => x.key);
    c("nessuna chiave letta due volte", chiavi.length, new Set(chiavi).size);
    c(
      "tutte quelle che c'erano all'inizio e non sono state tolte prima di leggerle",
      [],
      iniziali.filter((k) => k !== "fattura:2026-2000" && !chiavi.includes(k)),
    );
    c(
      "quella nata dopo il cursore è stata vista, quella nata prima no (era già passata)",
      [true, false],
      [chiavi.includes("fattura:2026-9999"), chiavi.includes("fattura:2026-0000")],
    );
  }

  gruppo("BULK · T7 · leggiMolte E eliminaPerPrefisso");
  {
    const f = clienteFinto();
    for (let i = 0; i < 250; i++)
      f.m.set(`bulk_fatture_f:${L}:${String(i).padStart(4, "0")}`, String(i));
    const a = EB.archivioProtettoSu(f.client);
    const chiavi = [...f.m.keys()];
    const molte = await a.leggiMolte([...chiavi, "bulk_fatture_f:non-esiste:0000"]);
    c(
      "251 chiavi (una non c'è) → 250 righe, a gruppi di 50 = 6 sottorichieste",
      [250, 6],
      [molte.length, f.reg.sottorichieste],
    );
    c(
      "nessuna chiave → nessuna sottorichiesta",
      [[], 6],
      [await a.leggiMolte([]), f.reg.sottorichieste],
    );
  }
  {
    const f = clienteFinto({
      righe: [
        [`bulk_fatture_f:${L}:0001`, "a"],
        [`bulk_fatture_f:${L}:0002`, "b"],
        [`bulk_fatture_r:${L}:0001`, "c"],
        [`bulk_fatture_f:${L}x:0001`, "altro lotto"],
        [`bulkXfatture_f:${L}:0001`, "jolly"],
        ["fattura:2026-0001", "emessa"],
        ["fattura_azienda", "azienda"],
        ["bulk_fatture_lock", "lucchetto"],
      ],
    });
    const a = EB.archivioProtettoSu(f.client);
    c(
      "cancella per prefisso in UNA sottorichiesta",
      [null, 1],
      [await a.eliminaPerPrefisso(`bulk_fatture_f:${L}:`), f.reg.sottorichieste],
    );
    c(
      "tolti solo i due file di quel lotto",
      [`bulk_fatture_f:${L}:0001`, `bulk_fatture_f:${L}:0002`],
      f.reg.cancellate.sort(),
    );
    c(
      "restano: le righe, l'altro lotto, il «jolly», le fatture, l'azienda, il lucchetto",
      6,
      f.m.size,
    );
    for (const vietato of [
      "fattura:",
      "fattura_azienda",
      "",
      "bulk_fatture_",
      "bulk",
      "bulk_fattur",
    ]) {
      const g = clienteFinto({
        righe: [
          ["fattura:2026-0001", "x"],
          ["bulk_fatture_lock", "y"],
        ],
      });
      const e = await EB.archivioProtettoSu(g.client).eliminaPerPrefisso(vietato);
      c(
        `prefisso «${vietato}» rifiutato: niente cancellato, niente chiamate`,
        [true, 2, 0],
        [typeof e === "string" && e.length > 10, g.m.size, g.reg.sottorichieste],
      );
    }
  }

  /* ═════════════ 2. EMETTERE UNA RIGA ═════════════ */
  gruppo("BULK · T7 · L'ORDINE: PER DATA, A PARITÀ COME CARICATE");
  {
    const righe = [
      { numero: 1, data: "2026-11-09" },
      { numero: 2, data: "2026-11-03" },
      { numero: 3, data: "2026-11-09" },
      { numero: 4, data: "" },
      { numero: 5, data: "2026-11-01" },
    ];
    const congelate = righe.map((r) => Object.freeze({ ...r }));
    c(
      "data crescente; stessa data = ordine di caricamento; senza data in fondo",
      [5, 2, 1, 3, 4],
      EB.ordineEmissione(congelate).map((r) => r.numero),
    );
    c(
      "non muta l'input",
      [1, 2, 3, 4, 5],
      congelate.map((r) => r.numero),
    );
  }

  gruppo("BULK · T7 · UN LOTTO DI 5 CON LE DATE IN DISORDINE");
  {
    const { archivio, m } = nuovoArchivio();
    const righe = [
      ["0000-0001-0002", "2026-11-09"],
      ["0003-0004-0005", "2026-11-03"],
      ["0006-0007-0008", "2026-11-09"],
      ["0009-0010-0011", "2026-11-05"],
      ["0012-0013-0014", "2026-11-01"],
    ].map(([riga, data], i) => ({ numero: i + 1, riga, data }));
    const esiti = [];
    for (const r of EB.ordineEmissione(righe)) {
      esiti.push(await EB.emettiProtettoSu(archivio, daBulk(r.riga), azienda, r.data));
    }
    const ok = esiti.filter((e) => e.ok);
    c("tutte emesse", 5, ok.length);
    c(
      "numeri contigui 1…5",
      [1, 2, 3, 4, 5],
      ok.map((e) => e.fattura.numero),
    );
    c(
      "nell'ordine delle date (poi del caricamento)",
      ["2026-11-01", "2026-11-03", "2026-11-05", "2026-11-09", "2026-11-09"],
      ok.map((e) => e.fattura.data),
    );
    c(
      "a parità di data prima la caricata prima",
      ["0000-0001-0002", "0006-0007-0008"],
      ok.filter((e) => e.fattura.data === "2026-11-09").map((e) => e.fattura.origineBulk.riga),
    );
    c(
      "numeri e date vanno nello stesso verso",
      true,
      ok.every(
        (e, i) =>
          i === 0 ||
          (e.fattura.numero > ok[i - 1].fattura.numero && e.fattura.data >= ok[i - 1].fattura.data),
      ),
    );
    c(
      "nessun salto segnalato (nessun «precedente» passato)",
      [null, null, null, null, null],
      ok.map((e) => e.salto),
    );
    c(
      "data fattura = data pagamento, mai «oggi»",
      true,
      ok.every((e) => e.fattura.data === e.fattura.dataPagamento),
    );
    c("5 chiavi sotto «fattura:», nessuna sovrascritta", 5, emesseDa(m).length);
  }

  gruppo("BULK · T7 · NUMERO DI PARTENZA, ANNI, SEZIONALE");
  {
    const { archivio } = nuovoArchivio();
    const r = await EB.emettiProtettoSu(
      archivio,
      daBulk("0000"),
      { ...azienda, primoNumero: 37, annoNumerazione: 2026 },
      "2026-11-05",
    );
    c("primoNumero 37 con annoNumerazione uguale → parte da 37", 37, r.fattura?.numero);
  }
  {
    const { archivio } = nuovoArchivio();
    const r = await EB.emettiProtettoSu(
      archivio,
      daBulk("0000"),
      { ...azienda, primoNumero: 37, annoNumerazione: 2025 },
      "2026-11-05",
    );
    c("con annoNumerazione di un altro anno → parte da 1", 1, r.fattura?.numero);
  }
  {
    const { archivio, m } = nuovoArchivio();
    caricaEmesse(m, 4);
    const vecchio = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-12-30");
    const nuovo = await EB.emettiProtettoSu(archivio, daBulk("0003"), azienda, "2027-01-03");
    const ancoraVecchio = await EB.emettiProtettoSu(
      archivio,
      daBulk("0006"),
      azienda,
      "2026-12-31",
    );
    c(
      "incasso di fine anno: continua la serie vecchia",
      [5, "2026-0005"],
      [vecchio.fattura?.numero, vecchio.fattura?.id],
    );
    c(
      "incasso del nuovo anno: riparte da 1",
      [1, "2027-0001"],
      [nuovo.fattura?.numero, nuovo.fattura?.id],
    );
    c(
      "e uno vecchio emesso dopo continua quello vecchio",
      [6, "2026-0006"],
      [ancoraVecchio.fattura?.numero, ancoraVecchio.fattura?.id],
    );
  }
  {
    const { archivio, m } = nuovoArchivio();
    caricaEmesse(m, 5);
    const a1 = await EB.emettiProtettoSu(
      archivio,
      daBulk("0000"),
      { ...azienda, serie: "A" },
      "2026-11-05",
    );
    const a2 = await EB.emettiProtettoSu(
      archivio,
      daBulk("0003"),
      { ...azienda, serie: "A" },
      "2026-11-06",
    );
    c(
      "serie A: numerazione sua, parte da 1 anche se la serie senza sezionale è a 5",
      [
        [1, "fattura:2026-0001-A"],
        [2, "fattura:2026-0002-A"],
      ],
      [a1, a2].map((e) => [e.fattura?.numero, AR.chiaveEmessa(e.fattura)]),
    );
    c("la serie senza sezionale non si è mossa", 5, emesseDa(m).filter((f) => !f.serie).length);
  }

  gruppo("BULK · T7 · DATA ANTERIORE ALL'ULTIMA EMESSA: «CONFERMA», MAI «BLOCCA»");
  {
    c("la gravità è una costante sola, e vale «conferma»", "conferma", EB.GRAVITA_DATA_ANTERIORE);
    const { archivio, m } = nuovoArchivio();
    caricaEmesse(m, 9);
    const f10 = emessa(10, { data: "2026-11-10", dataPagamento: "2026-11-10" });
    m.set(chiaveDi(f10), JSON.stringify(f10));
    const emesse = emesseDa(m);
    const mo = EB.esitoOrdineDate("2026-11-01", emesse, "");
    c(
      "data anteriore → un motivo «data_anteriore» di gravità «conferma» sul campo data",
      ["data_anteriore", "conferma", "data"],
      [mo?.codice, mo?.gravita, mo?.campo],
    );
    c(
      "il testo dice quale fattura, la sua data, la data di questa e l'ultimo giorno utile",
      [true, true, true, true],
      [
        /n\. 10/.test(mo.testo),
        /10\/11\/2026/.test(mo.testo),
        /01\/11\/2026/.test(mo.testo),
        /13\/11\/2026/.test(mo.testo),
      ],
    );
    c(
      "il testo dice che oltre i 12 giorni il commercialista non ha ancora risposto",
      true,
      /commercialista non ha ancora risposto/.test(mo.testo),
    );
    c(
      "stessa data dell'ultima, o più recente → nessun motivo",
      [null, null],
      [EB.esitoOrdineDate("2026-11-10", emesse, ""), EB.esitoOrdineDate("2026-11-12", emesse, "")],
    );
    c(
      "un altro anno non conta (la numerazione riparte)",
      null,
      EB.esitoOrdineDate("2027-01-02", emesse, ""),
    );
    c(
      "un'altra serie non conta se si dice la serie",
      null,
      EB.esitoOrdineDate("2026-11-01", emesse, "A"),
    );
    c("archivio vuoto → nessun motivo", null, EB.esitoOrdineDate("2026-11-01", [], ""));
    c(
      "data non valida → nessun motivo (se ne occupa un altro controllo)",
      null,
      EB.esitoOrdineDate("", emesse, ""),
    );
    // Dopo la conferma si emette: numero più alto, data più vecchia.
    const r = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-01");
    c(
      "emessa con numero più alto e data più vecchia",
      [true, 11, "2026-11-01"],
      [r.ok, r.fattura?.numero, r.fattura?.data],
    );
    c("la data non è stata cambiata", "2026-11-01", r.fattura?.dataPagamento);
    // Una riga saltata e corretta dopo resta emettibile.
    const dopo = await EB.emettiProtettoSu(archivio, daBulk("0003"), azienda, "2026-10-20");
    c(
      "una riga sistemata dopo, con data ancora più vecchia, si emette lo stesso",
      [true, 12],
      [dopo.ok, dopo.fattura?.numero],
    );
  }

  gruppo("BULK · T7 · DUE EMETTITORI SULLO STESSO NUMERO");
  {
    const { archivio, m } = nuovoArchivio({
      hook: {
        dopoPagina: (n, mm) => {
          if (n === 1) gara(3)(mm);
        },
      },
    });
    caricaEmesse(m, 2);
    const r = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c("la seconda riprova col numero dopo", [true, 4], [r.ok, r.fattura?.numero]);
    c("la prima è intatta", "concorrente-3", JSON.parse(m.get("fattura:2026-0003")).leadId);
    c(
      "la nostra è sotto la 4, con la sua origine",
      [L, "0000"],
      [
        JSON.parse(m.get("fattura:2026-0004")).origineBulk.lotto,
        JSON.parse(m.get("fattura:2026-0004")).origineBulk.riga,
      ],
    );
  }
  {
    const { archivio, m, reg } = nuovoArchivio({
      hook: {
        dopoPagina: (n, mm) => {
          if (n === 1) gara(3)(mm);
          if (n === 2) gara(4)(mm);
        },
      },
    });
    caricaEmesse(m, 2);
    const r = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c("conflitto due volte → errore «conflitto»", [false, "conflitto"], [r.ok, r.codice]);
    c(
      "niente scritto da noi, le due dell'altro intatte",
      [4, 0],
      [emesseDa(m).length, emesseDa(m).filter((f) => f.origineBulk).length],
    );
    c("e il lotto si ferma", "ferma", EB.decidiDopoEsito(r));
  }

  gruppo("BULK · T7 · SCRITTURA FALLITA: NESSUN NUMERO CONSUMATO, RIPRESA SENZA DOPPIONI");
  {
    let emissioni = 0;
    const { archivio, m } = nuovoArchivio({
      hook: {
        rifiutaInsert: (k) =>
          k.startsWith("fattura:") && ++emissioni === 3 ? { message: "rete caduta" } : null,
      },
    });
    const esiti = [];
    for (const [riga, data] of [
      ["0000", "2026-11-01"],
      ["0003", "2026-11-02"],
      ["0006", "2026-11-03"],
      ["0009", "2026-11-04"],
    ]) {
      esiti.push(await EB.emettiProtettoSu(archivio, daBulk(riga), azienda, data));
      if (EB.decidiDopoEsito(esiti[esiti.length - 1]) === "ferma") break; // come farà emetti-riga: si ferma
    }
    c(
      "la terza fallisce con «scrittura_fallita» e il lotto si ferma",
      [false, "scrittura_fallita", "ferma"],
      [esiti[2].ok, esiti[2].codice, EB.decidiDopoEsito(esiti[2])],
    );
    c(
      "le prime due sono emesse, 1 e 2; la quarta non è nemmeno partita",
      [1, 2, 3],
      [esiti[0].fattura?.numero, esiti[1].fattura?.numero, esiti.length],
    );
    // La ripresa: stessa riga, stesso numero libero (nessun buco), nessun doppione.
    const ripresa = await EB.emettiProtettoSu(archivio, daBulk("0006"), azienda, "2026-11-03");
    c(
      "alla ripresa la stessa riga prende il 3 (nessun numero consumato)",
      [true, 3],
      [ripresa.ok, ripresa.fattura?.numero],
    );
    c(
      "tre fatture, numeri 1-3, nessun doppione",
      [1, 2, 3],
      emesseDa(m)
        .map((f) => f.numero)
        .sort(),
    );
  }
  {
    const { archivio, m } = nuovoArchivio({
      hook: { rispostaPersa: (k) => k.startsWith("fattura:") },
    });
    const primo = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c(
      "risposta persa dopo una scrittura riuscita: per il codice è un errore di scrittura",
      [false, "scrittura_fallita"],
      [primo.ok, primo.codice],
    );
    // La ripresa: prima si cerca per origine. La fattura c'è: non si emette di nuovo.
    const gia = EB.cercaPerOrigine(emesseDa(m), L, "0000");
    c(
      "…ma cercaPerOrigine la trova: la ripresa NON emette una seconda volta",
      [true, 1],
      [gia?.origineBulk?.riga === "0000", gia?.numero],
    );
    const secondo = gia
      ? null
      : await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c(
      "una sola fattura per quella riga",
      [1, null],
      [emesseDa(m).filter((f) => f.origineBulk?.riga === "0000").length, secondo],
    );
  }

  gruppo("BULK · T7 · IL «PRECEDENTE + 1»: UN SALTO SI REGISTRA, NON FERMA");
  {
    const { archivio, m } = nuovoArchivio();
    const r1 = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-01", null);
    const r2 = await EB.emettiProtettoSu(
      archivio,
      daBulk("0003"),
      azienda,
      "2026-11-02",
      r1.fattura.numero,
    );
    // Qualcuno emette in mezzo (due fatture).
    gara(3)(m);
    gara(4)(m);
    const r3 = await EB.emettiProtettoSu(
      archivio,
      daBulk("0006"),
      azienda,
      "2026-11-03",
      r2.fattura.numero,
    );
    const r4 = await EB.emettiProtettoSu(
      archivio,
      daBulk("0009"),
      azienda,
      "2026-11-04",
      r3.fattura.numero,
    );
    c("primo: nessun «precedente» → nessun salto", [1, null], [r1.fattura.numero, r1.salto]);
    c("secondo: precedente 1 → 2, nessun salto", [2, null], [r2.fattura.numero, r2.salto]);
    c(
      "terzo: precedente 2, numero 5 → salto dal 3 al 4 (li hanno emessi altri)",
      [true, 5, { da: 3, a: 4 }],
      [r3.ok, r3.fattura?.numero, r3.salto],
    );
    c("il salto NON ferma", "prosegui", EB.decidiDopoEsito(r3));
    c(
      "quarto: ricomincia dal nuovo precedente, nessun salto",
      [6, null],
      [r4.fattura.numero, r4.salto],
    );
    c(
      "nessun buco nell'archivio: 1…6",
      [1, 2, 3, 4, 5, 6],
      emesseDa(m)
        .map((f) => f.numero)
        .sort(),
    );
  }

  gruppo("BULK · T7 · RILETTURA DOPO LA SCRITTURA");
  {
    // Un emettitore vecchio con l'upsert riscrive la nostra chiave subito dopo il nostro inserimento.
    const altra = emessa(1, {
      leadId: "scheda-vera",
      origineBulk: { lotto: "altro-lotto", riga: "0000", impronte: [] },
    });
    const { archivio } = nuovoArchivio({
      hook: { dopoInsert: (k, mm) => mm.set(k, JSON.stringify(altra)) },
    });
    const r = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c(
      "la chiave contiene un'altra origine → «altra_origine» e il lotto si ferma",
      [false, "altra_origine", "ferma"],
      [r.ok, r.codice, EB.decidiDopoEsito(r)],
    );
  }
  {
    const { archivio } = nuovoArchivio({
      hook: {
        dopoInsert: (k, mm) => mm.set(k, JSON.stringify(emessa(1, { leadId: "scheda-vera" }))),
      },
    });
    const r = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c(
      "la chiave contiene una fattura senza origine → «altra_origine»",
      [false, "altra_origine"],
      [r.ok, r.codice],
    );
  }
  {
    const { archivio } = nuovoArchivio({ hook: { dopoInsert: (k, mm) => mm.delete(k) } });
    const r = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c("la chiave è sparita → «altra_origine»", [false, "altra_origine"], [r.ok, r.codice]);
  }
  {
    const { archivio } = nuovoArchivio({
      hook: { dopoInsert: (k, mm) => mm.set(k, "{ non json") },
    });
    const r = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c(
      "la chiave contiene testo illeggibile → «altra_origine»",
      [false, "altra_origine"],
      [r.ok, r.codice],
    );
  }
  {
    const { archivio, m, reg } = nuovoArchivio();
    const r = await EB.emettiProtettoSu(
      archivio,
      { ...daBulk("0000"), origineBulk: undefined },
      azienda,
      "2026-11-05",
    );
    c(
      "senza origineBulk non si emette (non si potrebbe rileggere): niente scritto",
      [false, "scrittura_fallita", 0, 0],
      [r.ok, r.codice, m.size, reg.sottorichieste],
    );
  }

  gruppo("BULK · T7 · LA LETTURA FALLITA NON SI NUMERA");
  {
    const { archivio, m } = nuovoArchivio({
      hook: {
        dopoPagina: () => {
          throw new Error("archivio giù");
        },
      },
    });
    const r = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c(
      "se le emesse non si leggono: «lettura_fallita», niente scritto, il lotto si ferma",
      [false, "lettura_fallita", 0, "ferma"],
      [r.ok, r.codice, m.size, EB.decidiDopoEsito(r)],
    );
  }

  gruppo("BULK · T7 · LE BOZZE NON SI TOCCANO");
  {
    const { archivio, m, reg } = nuovoArchivio();
    const bozza = JSON.stringify({ ...daBulk("0000") });
    const chiaveBozza = AR.chiaveBozza(`bulk:${L}:0000`);
    m.set(chiaveBozza, bozza);
    m.set(AR.chiaveBozza("scheda-del-cliente"), "{}");
    const r = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c("emessa", true, r.ok);
    c(
      "la bozza della stessa scheda è intatta, e così l'altra",
      [bozza, "{}"],
      [m.get(chiaveBozza), m.get(AR.chiaveBozza("scheda-del-cliente"))],
    );
    c("nessuna cancellazione è partita", [], reg.cancellate);
  }
  {
    // Anche quando il cliente ha una scheda vera (leadId della scheda): la sua bozza resta.
    const { archivio, m } = nuovoArchivio();
    m.set(AR.chiaveBozza("scheda-7"), "{ la bozza che qualcuno sta preparando }");
    await EB.emettiProtettoSu(
      archivio,
      daBulk("0000", { leadId: "scheda-7" }),
      azienda,
      "2026-11-05",
    );
    c(
      "bozza della scheda abbinata intatta",
      "{ la bozza che qualcuno sta preparando }",
      m.get(AR.chiaveBozza("scheda-7")),
    );
  }

  gruppo("BULK · T7 · CON 1.500 FATTURE GIÀ IN ARCHIVIO");
  {
    const { archivio, m, reg } = nuovoArchivio();
    caricaEmesse(m, 1500);
    const r = await EB.emettiProtettoSu(archivio, daBulk("0000"), azienda, "2026-11-05");
    c("numero 1501 (non 1001)", [true, 1501], [r.ok, r.fattura?.numero]);
    c("sottorichieste per riga: 2 pagine + 1 inserimento + 1 rilettura", 4, reg.sottorichieste);
  }

  gruppo("BULK · T7 · DOPO L'ESITO");
  {
    const ok = { ok: true, fattura: emessa(1), salto: { da: 2, a: 3 } };
    c("riuscita (anche con un salto) → prosegui", "prosegui", EB.decidiDopoEsito(ok));
    c(
      "riga non emettibile → salta",
      "salta",
      EB.decidiDopoEsito({ ok: false, codice: "non_emettibile" }),
    );
    c(
      "ogni errore di sistema → ferma",
      ["ferma", "ferma", "ferma", "ferma"],
      ["conflitto", "lettura_fallita", "scrittura_fallita", "altra_origine"].map((codice) =>
        EB.decidiDopoEsito({ ok: false, codice, errore: "x" }),
      ),
    );
  }

  gruppo("BULK · T7 · cercaPerOrigine");
  {
    const a = emessa(4, { origineBulk: { lotto: L, riga: "0000", impronte: [] } });
    const b = emessa(5, { origineBulk: { lotto: "altro-lotto", riga: "0000", impronte: [] } });
    const d = emessa(6, { origineBulk: { lotto: L, riga: "0000", impronte: [] } });
    const emesse = [d, emessa(1), b, a];
    c(
      "trova lotto + riga (e se sono due, la prima per numero)",
      4,
      EB.cercaPerOrigine(emesse, L, "0000")?.numero,
    );
    c(
      "stessa riga di un altro lotto: è di un altro",
      5,
      EB.cercaPerOrigine(emesse, "altro-lotto", "0000")?.numero,
    );
    c("riga che non c'è → null", null, EB.cercaPerOrigine(emesse, L, "0003"));
    c("archivio senza origini → null", null, EB.cercaPerOrigine([emessa(1)], L, "0000"));
  }

  gruppo("BULK · T7 · I FATTI SULLE DATE (D1b)");
  {
    const emesse = [
      emessa(9, { data: "2026-11-03", dataPagamento: "2026-11-03" }),
      emessa(10, { data: "2026-11-10", dataPagamento: "2026-11-10" }),
      emessa(50, { serie: "A", data: "2026-12-01", dataPagamento: "2026-12-01" }),
      emessa(99, { anno: 2025, data: "2025-12-31", dataPagamento: "2025-12-31" }),
    ];
    const righe = [
      { idRiga: "a", data: "2026-11-01" },
      { idRiga: "b", data: "2026-11-10" },
      { idRiga: "c", data: "2026-11-12" },
      { idRiga: "d", data: "" },
      { idRiga: "e", data: "2026-10-01" },
    ];
    c(
      "ultima emessa della serie, date estreme, righe con data anteriore, righe oltre il termine",
      {
        ultimaEmessa: { id: "2026-0010", numero: 10, data: "2026-11-10" },
        dataMinima: "2026-10-01",
        dataMassima: "2026-11-12",
        righeDataAnteriore: ["a", "e"],
        righeOltreTermine: ["e"],
      },
      EB.fattiSulleDate(righe, emesse, azienda, "2026-11-13"),
    );
    c(
      "un giorno dopo, scatta anche «a» (1/11 + 12 giorni = 13/11)",
      ["a", "e"],
      EB.fattiSulleDate(righe, emesse, azienda, "2026-11-14").righeOltreTermine,
    );
    c(
      "con il sezionale A guarda la sua serie",
      { id: "2026-0050", numero: 50, data: "2026-12-01" },
      EB.fattiSulleDate(righe, emesse, { ...azienda, serie: "A" }, "2026-11-13").ultimaEmessa,
    );
    const vuoto = EB.fattiSulleDate(righe, [], azienda, "2026-11-13");
    c(
      "archivio vuoto: nessuna ultima, nessuna riga con data anteriore",
      [null, []],
      [vuoto.ultimaEmessa, vuoto.righeDataAnteriore],
    );
    const senza = EB.fattiSulleDate([{ idRiga: "d", data: "" }], emesse, azienda, "2026-11-13");
    c(
      "nessuna data nel lotto → date estreme vuote",
      ["", "", [], []],
      [senza.dataMinima, senza.dataMassima, senza.righeDataAnteriore, senza.righeOltreTermine],
    );
  }

  /* ═════════════ 3. LUCCHETTO, RECLAMO, EMITTENTE ═════════════ */
  const T0 = Date.parse("2026-11-12T10:00:00.000Z");
  const K = "bulk_fatture_lock";
  gruppo("BULK · T7 · LUCCHETTO: GLI STESSI CASI DI QUELLO ESISTENTE");
  {
    const p = portaFinta();
    c("presa su chiave assente", { ok: true }, await LK.prendi(p, K, "A", 60_000, T0));
    c(
      "scritta con id e scadenza",
      [{ id: "A", fino: new Date(T0 + 60_000).toISOString() }],
      [JSON.parse(p.m.get(K))],
    );
    c(
      "occupato da un altro vivo: dice quanto manca",
      { ok: false, scadeFraMs: 50_000 },
      await LK.prendi(p, K, "B", 60_000, T0 + 10_000),
    );
    c(
      "scaduto: lo riprende un altro",
      { ok: true },
      await LK.prendi(p, K, "B", 60_000, T0 + 60_001),
    );
    c("…e adesso è di B", "B", JSON.parse(p.m.get(K)).id);
    c(
      "rilascio di chi non è il proprietario: non toglie niente",
      true,
      (await LK.rilascia(p, K, "A"), p.m.has(K)),
    );
    await LK.rilascia(p, K, "B");
    c("rilascio del proprietario: la chiave sparisce", false, p.m.has(K));
    c(
      "e un altro può prenderla subito",
      { ok: true },
      await LK.prendi(p, K, "C", 60_000, T0 + 61_000),
    );
  }
  {
    const p = portaFinta();
    p.m.set(K, "{ non json");
    c(
      "contenuto illeggibile = scaduto: si riprende",
      [{ ok: true }, "A"],
      [await LK.prendi(p, K, "A", 60_000, T0), JSON.parse(p.m.get(K)).id],
    );
    p.m.set(K, JSON.stringify({ id: "X", fino: "non una data" }));
    c("scadenza illeggibile = scaduto", { ok: true }, await LK.prendi(p, K, "B", 60_000, T0));
  }
  {
    const p = portaFinta();
    const [a, b] = await Promise.all([
      LK.prendi(p, K, "A", 60_000, T0),
      LK.prendi(p, K, "B", 60_000, T0),
    ]);
    c(
      "due che prendono la stessa chiave ASSENTE insieme: ne vince uno",
      1,
      [a, b].filter((e) => e.ok).length,
    );
  }
  {
    const p = portaFinta();
    p.m.set(K, JSON.stringify({ id: "vecchio", fino: new Date(T0 - 1000).toISOString() }));
    const [a, b, d] = await Promise.all([
      LK.prendi(p, K, "A", 60_000, T0),
      LK.prendi(p, K, "B", 60_000, T0),
      LK.prendi(p, K, "C", 60_000, T0),
    ]);
    c(
      "tre che riprendono la stessa chiave SCADUTA insieme (compare-and-swap): ne vince uno",
      1,
      [a, b, d].filter((e) => e.ok).length,
    );
    c(
      "chi ha perso sa che è occupato",
      true,
      [a, b, d].filter((e) => !e.ok).every((e) => e.scadeFraMs === 60_000),
    );
    const vincitore = JSON.parse(p.m.get(K)).id;
    c("la chiave è del vincitore", [a, b, d][["A", "B", "C"].indexOf(vincitore)].ok, true);
  }

  gruppo("BULK · T7 · RECLAMO DI LETTURA (stessa meccanica, scadenza 90 s)");
  {
    const p = portaFinta();
    const R = "bulk_fatture_c:lotto-0123abcd:3";
    c(
      "la prima scheda prende il reclamo",
      { ok: true },
      await LK.prendi(p, R, "scheda-1", 90_000, T0),
    );
    c(
      "la seconda, 80 s dopo, trova la lettura ancora in corso (il reclamo dura più della richiesta)",
      { ok: false, scadeFraMs: 10_000 },
      await LK.prendi(p, R, "scheda-2", 90_000, T0 + 80_000),
    );
    c(
      "dopo la scadenza (la prima scheda è morta) lo riprende",
      { ok: true },
      await LK.prendi(p, R, "scheda-2", 90_000, T0 + 90_001),
    );
    await LK.rilascia(p, R, "scheda-2");
    c("rilasciato a fine lettura: sparisce", false, p.m.has(R));
  }

  gruppo("BULK · T7 · EMITTENTE: STESSO ID RINNOVA, ALTRO ID FINCHÉ VIVO NO");
  {
    const p = portaFinta();
    const E = "bulk_fatture_e:lotto-0123abcd";
    const D = 120_000;
    c("la scheda 1 diventa emittente", { ok: true }, await LK.prendi(p, E, "scheda-1", D, T0));
    c(
      "la scheda 2 è rifiutata e sa quanto aspettare",
      { ok: false, scadeFraMs: D - 30_000 },
      await LK.prendi(p, E, "scheda-2", D, T0 + 30_000),
    );
    c(
      "la scheda 1 che torna (stesso id, anche solo ricaricando la funzione) rinnova",
      { ok: true },
      await LK.prendi(p, E, "scheda-1", D, T0 + 40_000),
    );
    c(
      "…e la scadenza è slittata",
      new Date(T0 + 40_000 + D).toISOString(),
      JSON.parse(p.m.get(E)).fino,
    );
    c(
      "rinnovo esplicito a ogni riga, registrando l'ultimo numero emesso",
      { ok: true },
      await LK.rinnova(p, E, "scheda-1", D, T0 + 50_000, { anno: 2026, serie: "", numero: 12 }),
    );
    c(
      "il «precedente» è 12 per 2026 senza serie",
      12,
      await LK.leggiPrecedente(p, E, "scheda-1", 2026, ""),
    );
    c(
      "per un'altra serie o un altro anno non c'è",
      [null, null],
      [
        await LK.leggiPrecedente(p, E, "scheda-1", 2026, "A"),
        await LK.leggiPrecedente(p, E, "scheda-1", 2025, ""),
      ],
    );
    c("per un'altra scheda non c'è", null, await LK.leggiPrecedente(p, E, "scheda-2", 2026, ""));
    await LK.rinnova(p, E, "scheda-1", D, T0 + 60_000, { anno: 2026, serie: "", numero: 13 });
    await LK.rinnova(p, E, "scheda-1", D, T0 + 61_000, { anno: 2026, serie: "A", numero: 4 });
    c(
      "si aggiorna e le serie stanno insieme",
      [13, 4],
      [
        await LK.leggiPrecedente(p, E, "scheda-1", 2026, ""),
        await LK.leggiPrecedente(p, E, "scheda-1", 2026, "A"),
      ],
    );
    c(
      "un rinnovo senza numero lo conserva",
      13,
      (await LK.rinnova(p, E, "scheda-1", D, T0 + 62_000),
      await LK.leggiPrecedente(p, E, "scheda-1", 2026, "")),
    );
    c(
      "la scheda 2 non può rinnovare quello che non è suo",
      false,
      (await LK.rinnova(p, E, "scheda-2", D, T0 + 63_000, { anno: 2026, serie: "", numero: 99 }))
        .ok,
    );
    c("e non ha toccato il «precedente»", 13, await LK.leggiPrecedente(p, E, "scheda-1", 2026, ""));

    // «Prendi il controllo»: si prende anche se vivo e il «precedente» si azzera.
    c(
      "«Prendi il controllo» riesce anche se la 1 è viva",
      true,
      await LK.prendiIlControllo(p, E, "scheda-2", D, T0 + 64_000),
    );
    c(
      "la 2 è l'emittente e non ha un «precedente»",
      [null, "scheda-2"],
      [await LK.leggiPrecedente(p, E, "scheda-2", 2026, ""), JSON.parse(p.m.get(E)).id],
    );
    c("la 1 non vede più il suo", null, await LK.leggiPrecedente(p, E, "scheda-1", 2026, ""));
    c(
      "e la 1 non può più rinnovare: sa di aver perso il controllo",
      false,
      (await LK.rinnova(p, E, "scheda-1", D, T0 + 65_000)).ok,
    );
    const q = portaFinta();
    c(
      "«Prendi il controllo» su chiave assente la crea",
      [true, "scheda-3"],
      [await LK.prendiIlControllo(q, E, "scheda-3", D, T0), JSON.parse(q.m.get(E)).id],
    );
    // Scaduto e ripreso dallo stesso id: il «precedente» non si porta dietro (è un'altra esecuzione).
    await LK.rinnova(q, E, "scheda-3", D, T0, { anno: 2026, serie: "", numero: 7 });
    c(
      "scaduto e ripreso: il «precedente» riparte da zero (stessa scheda, nuova esecuzione)",
      [{ ok: true }, null],
      [
        await LK.prendi(q, E, "scheda-3", D, T0 + D + 1),
        await LK.leggiPrecedente(q, E, "scheda-3", 2026, ""),
      ],
    );
  }

  gruppo("BULK · T7 · LA PORTA VERA (client Supabase finto) FA GLI STESSI GIRI");
  {
    const f = clienteFinto();
    const porta = LK.portaLucchettoSu(f.client);
    c("assente → presa", { ok: true }, await LK.prendi(porta, K, "A", 60_000, T0));
    c(
      "occupato",
      { ok: false, scadeFraMs: 50_000 },
      await LK.prendi(porta, K, "B", 60_000, T0 + 10_000),
    );
    c(
      "scaduto → ripreso col confronto sul valore",
      { ok: true },
      await LK.prendi(porta, K, "B", 60_000, T0 + 70_000),
    );
    await LK.rilascia(porta, K, "A");
    c("rilascio di un altro: la chiave c'è ancora", true, f.m.has(K));
    await LK.rilascia(porta, K, "B");
    c("rilascio del proprietario: sparisce", false, f.m.has(K));
    c(
      "l'inserimento doppio dà falso, non un errore",
      [true, false],
      [await porta.creaSeAssente(K, "1"), await porta.creaSeAssente(K, "2")],
    );
    c(
      "sostituisciSe con valore diverso dall'atteso: falso e niente cambia",
      [false, "1"],
      [await porta.sostituisciSe(K, "altro", "3"), f.m.get(K)],
    );
    c(
      "eliminaSe con valore diverso: falso e la chiave resta",
      [false, true],
      [await porta.eliminaSe(K, "altro"), f.m.has(K)],
    );
    const g = clienteFinto({
      hook: { rifiutaInsert: () => ({ code: "42501", message: "permission denied" }) },
    });
    let errore = "";
    try {
      await LK.portaLucchettoSu(g.client).creaSeAssente(K, "x");
    } catch (e) {
      errore = e.message;
    }
    c("un errore vero NON passa per «occupato»: sale", "permission denied", errore);
  }

  gruppo("BULK · T7 · ARCHIVIO: NESSUN console.* E NESSUNA CHIAVE");
  {
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "crm",
      "fatture",
      "bulk",
    );
    for (const nome of ["emissione-bulk.ts", "lucchetto.server.ts"]) {
      const src = readFileSync(join(dir, nome), "utf8");
      c(`${nome}: nessun console.*`, false, /console\./.test(src));
      c(
        `${nome}: nessuna chiave o segreto scritto`,
        false,
        /service_role|eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}/.test(src),
      );
    }
  }
}
