/** ── FATTURE DALLA CHAT · T6 · `emettiRigaChat` ─────────────────────────────
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO §4, T6). Si prova
 *  `emissione-chat.server.ts` con PORTE FINTE in memoria (archivio, lucchetto,
 *  schede): nessun Supabase vero, nessuna rete. `emissione-chat.server.ts`
 *  importa `chat.server.ts` (bundlati insieme con esbuild, stesso schema già
 *  usato da `prove/fatture-dalla-chat/server.mjs`): l'`ErroreChat` creato
 *  dentro `chat.server.ts` e quello intercettato qui sono la STESSA classe,
 *  perché finiscono nello stesso bundle (nessun problema di `instanceof` fra
 *  moduli diversi). Dati di fantasia: nomi, CF, id, nessun dato vero. */
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOTTO_PROVA } from "./dati.mjs";
import { CF_PROVA, cfConControllo } from "../fatture-bulk/dati.mjs";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const L = LOTTO_PROVA;
const U = "utente-prova";
const T0 = Date.parse("2026-11-13T10:00:00.000Z");
//  La firma vera delle impostazioni (`firmaImpostazioni(AZIENDA)`, bulk/regole-lotto.ts) si calcola
//  dentro `prove()` (serve il bundle): qui un segnaposto, sovrascritto prima di usarlo.
let FIRMA = "f";

async function impacchetta(percorsoRelativo) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const risultato = esbuild.buildSync({
    entryPoints: [join(RADICE, percorsoRelativo)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const testo = risultato.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(testo).toString("base64")}`);
}

/* ══ DATI DI FANTASIA ══════════════════════════════════════════════════════ */

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// CF di una «moglie» di fantasia (RSSMRA è Mario Rossi, già in CF_PROVA): un CF diverso, valido,
// per il caso «CF diverso dalla scheda».
const CF_DIVERSO = cfConControllo("RSSMRA75A01H501");

function pivaConControllo(dieci) {
  let s = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(dieci[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    s += d;
  }
  return dieci + String((10 - (s % 10)) % 10);
}
const PIVA = pivaConControllo("1234567001");
const AZIENDA = {
  denominazione: "ESEMPIO CAPELLI S.R.L.",
  partitaIva: PIVA,
  codiceFiscale: PIVA,
  regimeFiscale: "RF01",
  indirizzo: "Via dei Ciliegi",
  civico: "5",
  cap: "20100",
  comune: "Milano",
  provincia: "MI",
  nazione: "IT",
  reaUfficio: "",
  reaNumero: "",
  pec: "esempio@pec.example",
  iban: "IT60X0542811101000000123456",
  aliquotaPredefinita: 22,
  primoNumero: 1,
  annoNumerazione: 2026,
  serie: "",
};

function lTessera(x = {}) {
  return {
    tipo: "tessera",
    nome: "Mario",
    cognome: "Rossi",
    codiceFiscale: CF_PROVA,
    cfLetto: CF_PROVA,
    incerti: [],
    ...x,
  };
}
function lIndirizzo(x = {}) {
  return {
    tipo: "indirizzo",
    indirizzo: "Via dei Tigli 4",
    cap: "20100",
    comune: "Milano",
    provincia: "MI",
    telefono: "331234567",
    nome: "Mario",
    cognome: "Rossi",
    indirizzoDiSpedizione: false,
    incerti: [],
    ...x,
  };
}
function lPagamento(x = {}) {
  return {
    tipo: "pagamento",
    importo: 120,
    importoAltro: null,
    valuta: "EUR",
    esito: "completato",
    data: "2026-11-10",
    meseGiorno: "",
    dataTesto: "10/11/2026",
    annoVisibile: true,
    formatoAmbiguo: false,
    modo: "bonifico",
    modoIncerto: false,
    riferimento: "RIF123456",
    paganteCognome: "Rossi",
    incerti: [],
    ...x,
  };
}

/* ══ IL MONDO FINTO ════════════════════════════════════════════════════════
 *  Solo le porte che `emettiRigaChat` usa per davvero: `archivio`, `lucchetto`,
 *  `adesso`, `id`, `log`, `utente`, `schede`. `bucket`/`raccolta`/`ai` sono
 *  presenti ma minimi (una riga pronta, con pagamento già letto, non li usa:
 *  servono solo perché `PorteChat` li dichiara). */
function mondo() {
  const m = new Map();
  const bucket = new Map();
  const reg = { subs: 0, log: [], rimuovi: [], scritte: [] };
  const w = { m, bucket, reg, ora: T0, n: 0, schede: new Map() };
  w.id = () => uuid(++w.n);
  const sub = () => reg.subs++;
  const ordinate = (p) =>
    [...m]
      .filter(([k]) => k.startsWith(p))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => ({ key, value }));
  const archivio = {
    leggi: async (k) => {
      sub();
      return m.get(k) ?? null;
    },
    leggiPrefisso: async (p) => {
      sub();
      return ordinate(p);
    },
    leggiPrefissoPerChiave: async (p) => {
      sub();
      return ordinate(p);
    },
    leggiMolte: async (ks) => {
      sub();
      return ks.filter((k) => m.has(k)).map((k) => ({ key: k, value: m.get(k) }));
    },
    scrivi: async (k, v) => {
      sub();
      m.set(k, v);
      reg.scritte.push(k);
      return null;
    },
    elimina: async (k) => {
      sub();
      m.delete(k);
      return null;
    },
    creaSeAssente: async (k, v) => {
      sub();
      if (m.has(k)) return { stato: "esiste" };
      m.set(k, v);
      reg.scritte.push(k);
      return { stato: "creata" };
    },
    eliminaPerPrefisso: async (p) => {
      sub();
      for (const k of [...m.keys()]) if (k.startsWith(p)) m.delete(k);
      return null;
    },
  };
  const lucchetto = {
    leggi: async (k) => {
      sub();
      return m.get(k) ?? null;
    },
    creaSeAssente: async (k, v) => {
      sub();
      if (m.has(k)) return false;
      m.set(k, v);
      return true;
    },
    sostituisciSe: async (k, a, n) => {
      sub();
      if (m.get(k) !== a) return false;
      m.set(k, n);
      return true;
    },
    eliminaSe: async (k, a) => {
      sub();
      if (m.get(k) !== a) return false;
      m.delete(k);
      return true;
    },
  };
  const buck = {
    carica: async () => null,
    scarica: async () => null,
    elenca: async (cartella) => {
      const nomi = new Set();
      for (const p of bucket.keys()) if (p.startsWith(cartella)) nomi.add(p.slice(cartella.length));
      return [...nomi];
    },
    rimuovi: async (ps) => {
      reg.rimuovi.push(...ps);
      for (const p of ps) bucket.delete(p);
      return null;
    },
    firma: async () => null,
  };
  const raccolta = {
    messaggi: async () => [],
    mediaPonte: async () => [],
    firmaPonte: async () => null,
    scaricaPonte: async () => null,
    scaricaManyChat: async () => null,
  };
  w.porte = {
    archivio,
    lucchetto,
    bucket: buck,
    raccolta,
    ai: async () => ({ testo: "{}", fine: "stop" }),
    adesso: () => w.ora,
    id: w.id,
    log: (c) => reg.log.push(c),
    utente: U,
    schede: async () => [...w.schede.values()],
    scheda: async (id) => w.schede.get(id) ?? null,
  };
  return w;
}

function aggiungiScheda(w, id, extra = {}) {
  w.schede.set(id, {
    id,
    nome: "Mario",
    cognome: "Rossi",
    telefono: "+39 333 123 4567",
    codiceFiscale: "",
    payment: {
      accontoPagato: 120,
      statoPagamento: "pagato_interamente",
      dataPagamento: "2026-11-10",
    },
    ...extra,
  });
}

/** Scrive testata + riga (aperta, chat letta, pagamento letto, confermata) con lo STESSO formato di
 *  `chat.server.ts` (chiavi vere, impacchettate separatamente: nessun problema di `instanceof`, sono
 *  solo stringhe). */
function creaLottoConRiga(w, CH, lotto, idRiga, x = {}) {
  w.m.set(
    CH.chiaveTestata(lotto),
    JSON.stringify({
      lotto,
      creatoIl: "2026-11-13T08:00:00.000Z",
      descrizione: "",
      dataSeManca: "",
      firmaImpostazioni: x.firmaImpostazioni ?? FIRMA,
    }),
  );
  w.m.set(
    CH.chiaveRiga(lotto, idRiga),
    JSON.stringify({
      idRiga,
      scheda: idRiga,
      stato: "aperta",
      chat: {
        letta: true,
        tessera: lTessera(x.tessera),
        indirizzo: lIndirizzo(x.indirizzo),
        motivi: [],
        segnaposto: false,
      },
      confermata: x.confermata ?? true,
      confermeAvvisi: x.confermeAvvisi ?? [],
      ...x.riga,
    }),
  );
  if (x.senzaPagamento !== true) {
    w.m.set(
      CH.chiavePagamento(lotto, idRiga),
      JSON.stringify({
        stato: "letto",
        impronta: x.impronta ?? `imp-${idRiga}`,
        percorso: `${U}/chat/${lotto}/${idRiga}.jpg`,
        lettura: lPagamento(x.pagamento),
      }),
    );
  }
}

/** Una fattura «già emessa» finta (bulk o chat: `cercaPerOrigine`/`trovaDoppioni` non distinguono). */
function fatturaEmessa(x = {}) {
  return {
    id: x.id ?? "2026-0001",
    stato: "emessa",
    numero: x.numero ?? 1,
    anno: 2026,
    serie: "",
    data: x.data ?? "2026-11-01",
    dataPagamento: x.data ?? "2026-11-01",
    tipo: "unica",
    leadId: x.leadId ?? uuid(999),
    leadNome: "Altro Cliente",
    preventivoRef: "",
    cliente: {
      nome: x.nome ?? "Altro",
      cognome: x.cognome ?? "Cliente",
      codiceFiscale: x.cf ?? cfConControllo("ALTXXX80A01H501"),
      indirizzo: "Via X 1",
      cap: "20100",
      comune: "Milano",
      provincia: "MI",
    },
    righe: [],
    causale: "",
    imponibile: 100,
    imposta: 22,
    totale: x.totale ?? 122,
    creataIl: "2026-11-01T10:00:00.000Z",
    emessaIl: "2026-11-01T10:00:00.000Z",
    ...(x.origineBulk !== false
      ? {
          origineBulk: {
            lotto: x.origineLotto ?? "lotto-altro0000",
            riga: x.origineRiga ?? "0000",
            impronte: x.impronte ?? [],
            riferimento: x.riferimento,
          },
        }
      : {}),
  };
}

export async function prove(_mod, { c, gruppo, radice }) {
  const E = await impacchetta("src/crm/fatture/dalla-chat/emissione-chat.server.ts");
  const CH = await impacchetta("src/crm/fatture/dalla-chat/chiavi.ts");
  const RL = await impacchetta("src/crm/fatture/bulk/regole-lotto.ts");
  FIRMA = RL.firmaImpostazioni(AZIENDA);

  gruppo("DALLA CHAT · T6 · RICHIESTA NON VALIDA");
  {
    const w = mondo();
    for (const r of [
      { lotto: "", idRiga: uuid(1), emittente: "e1" },
      { lotto: L, idRiga: "non-un-uuid", emittente: "e1" },
      { lotto: L, idRiga: uuid(1), emittente: "" },
    ]) {
      const esito = await E.emettiRigaChat(w.porte, r);
      c(
        `richiesta malformata (${JSON.stringify(r)}) → ferma richiesta_non_valida, zero scritture`,
        true,
        esito.esito === "ferma" &&
          esito.codice === "richiesta_non_valida" &&
          w.reg.scritte.length === 0,
      );
    }
  }

  gruppo("DALLA CHAT · T6 · LOTTO SPARITO");
  {
    const w = mondo();
    const idRiga = uuid(2);
    const esito = await E.emettiRigaChat(w.porte, { lotto: L, idRiga, emittente: "e1" });
    c("lotto inesistente, nessuna fattura → ferma non_trovato", "non_trovato", esito.codice);

    // La fattura c'è già (ripresa dopo risposta persa, lotto già cancellato): idempotente.
    w.m.set(
      "fattura:2026-0005",
      JSON.stringify(
        fatturaEmessa({
          id: "2026-0005",
          numero: 5,
          leadId: idRiga,
          origineLotto: L,
          origineRiga: idRiga,
        }),
      ),
    );
    const esito2 = await E.emettiRigaChat(w.porte, { lotto: L, idRiga, emittente: "e1" });
    c(
      "fattura già scritta per questa riga, lotto sparito → emessa idempotente, lottoChiuso",
      { esito: "emessa", numero: 5, lottoChiuso: true },
      { esito: esito2.esito, numero: esito2.fattura?.numero, lottoChiuso: esito2.lottoChiuso },
    );
  }

  gruppo("DALLA CHAT · T6 · RIGA NON TROVATA / SCARTATA / NON CONFERMATA");
  {
    const w = mondo();
    const idRiga = uuid(3);
    w.m.set("fattura_azienda", JSON.stringify(AZIENDA));
    w.m.set(
      CH.chiaveTestata(L),
      JSON.stringify({
        lotto: L,
        creatoIl: "2026-11-13T08:00:00.000Z",
        descrizione: "",
        dataSeManca: "",
        firmaImpostazioni: FIRMA,
      }),
    );
    const altra = uuid(4);
    const esito = await E.emettiRigaChat(w.porte, { lotto: L, idRiga: altra, emittente: "e1" });
    c("riga non creata nel lotto → saltata", "saltata", esito.esito);

    aggiungiScheda(w, idRiga);
    w.m.set(
      CH.chiaveRiga(L, idRiga),
      JSON.stringify({ idRiga, scheda: idRiga, stato: "scartata" }),
    );
    const esitoScartata = await E.emettiRigaChat(w.porte, { lotto: L, idRiga, emittente: "e1" });
    c(
      "riga scartata → saltata, motivo riga_scartata",
      true,
      esitoScartata.esito === "saltata" &&
        esitoScartata.motivi.some((m) => m.codice === "riga_scartata"),
    );

    // Riga aperta ma senza bonifico e senza conferma: non emettibile.
    const idRiga2 = uuid(5);
    aggiungiScheda(w, idRiga2);
    creaLottoConRiga(w, CH, L, idRiga2, { senzaPagamento: true, confermata: false });
    const esitoNonPronta = await E.emettiRigaChat(w.porte, {
      lotto: L,
      idRiga: idRiga2,
      emittente: "e1",
    });
    c(
      "riga senza bonifico/non confermata → saltata (non emettibile)",
      "saltata",
      esitoNonPronta.esito,
    );
  }

  gruppo("DALLA CHAT · T6 · IMPOSTAZIONI CAMBIATE (centroOk) → ferma");
  {
    const w = mondo();
    const idRiga = uuid(6);
    aggiungiScheda(w, idRiga);
    creaLottoConRiga(w, CH, L, idRiga, { firmaImpostazioni: "f-vecchia" });
    w.m.set(
      "fattura_azienda",
      JSON.stringify({ ...AZIENDA, denominazione: "ESEMPIO CAPELLI S.R.L. — CAMBIATA" }),
    );
    const esito = await E.emettiRigaChat(w.porte, { lotto: L, idRiga, emittente: "e1" });
    c(
      "il centro è cambiato rispetto alla testata → ferma impostazioni_cambiate",
      {
        esito: "ferma",
        codice: "impostazioni_cambiate",
      },
      { esito: esito.esito, codice: esito.codice },
    );
    c(
      "zero fatture scritte",
      0,
      (await w.porte.archivio.leggiPrefissoPerChiave("fattura:")).length,
    );
  }

  gruppo("DALLA CHAT · T6 · DOPPIONE: STESSO SCREENSHOT GIÀ FATTURATO DALLA BULK");
  {
    const w = mondo();
    const idRiga = uuid(7);
    aggiungiScheda(w, idRiga);
    creaLottoConRiga(w, CH, L, idRiga, { impronta: "imp-condivisa" });
    w.m.set("fattura_azienda", JSON.stringify(AZIENDA));
    w.m.set(
      "fattura:2026-0010",
      JSON.stringify(
        fatturaEmessa({
          id: "2026-0010",
          numero: 10,
          origineLotto: "lotto-bulk-0000",
          origineRiga: "0000",
          impronte: ["imp-condivisa"],
        }),
      ),
    );
    const esito = await E.emettiRigaChat(w.porte, { lotto: L, idRiga, emittente: "e1" });
    c(
      "stesso screenshot (impronta) già usato da una fattura della bulk → saltata, doppione",
      true,
      esito.esito === "saltata" && esito.motivi.some((m) => m.codice === "doppione_screenshot"),
    );
  }

  gruppo("DALLA CHAT · T6 · CF DIVERSO DALLA SCHEDA (wiring del campo aggiunto da T6)");
  {
    const w = mondo();
    const idRiga = uuid(8);
    // Il CF già scritto sulla scheda è diverso da quello letto in chat (CF_PROVA).
    aggiungiScheda(w, idRiga, { codiceFiscale: CF_DIVERSO });
    creaLottoConRiga(w, CH, L, idRiga);
    w.m.set("fattura_azienda", JSON.stringify(AZIENDA));
    const esitoNonConfermato = await E.emettiRigaChat(w.porte, {
      lotto: L,
      idRiga,
      emittente: "e1",
    });
    c(
      "CF letto diverso da quello già sulla scheda, non confermato → saltata, motivo scheda_cf_diverso",
      true,
      esitoNonConfermato.esito === "saltata" &&
        esitoNonConfermato.motivi.some((m) => m.codice === "scheda_cf_diverso"),
    );
    // Confermato l'avviso: ora emette.
    w.m.set(
      CH.chiaveRiga(L, idRiga),
      JSON.stringify({
        idRiga,
        scheda: idRiga,
        stato: "aperta",
        chat: {
          letta: true,
          tessera: lTessera(),
          indirizzo: lIndirizzo(),
          motivi: [],
          segnaposto: false,
        },
        confermata: true,
        confermeAvvisi: ["scheda_cf_diverso"],
      }),
    );
    const esitoOk = await E.emettiRigaChat(w.porte, { lotto: L, idRiga, emittente: "e1" });
    c("confermato l'avviso → emessa", "emessa", esitoOk.esito);
  }

  gruppo("DALLA CHAT · T6 · 10 RIGHE PRONTE E CONFERMATE → 10 FATTURE, NUMERI CONSECUTIVI");
  {
    const w = mondo();
    w.m.set("fattura_azienda", JSON.stringify(AZIENDA));
    const righe = [];
    for (let i = 0; i < 10; i++) {
      const idRiga = uuid(100 + i);
      righe.push(idRiga);
      aggiungiScheda(w, idRiga);
      creaLottoConRiga(w, CH, L, idRiga, {
        impronta: `imp-lotto-${i}`,
        pagamento: {
          riferimento: `RIFLOTTO${1000 + i}`,
          data: `2026-11-${String(2 + i).padStart(2, "0")}`,
        },
      });
    }
    const numeri = [];
    for (const idRiga of righe) {
      const esito = await E.emettiRigaChat(w.porte, { lotto: L, idRiga, emittente: "e1" });
      if (esito.esito !== "emessa") {
        c(`riga ${idRiga} emessa`, "emessa", JSON.stringify(esito));
      } else {
        numeri.push(esito.fattura.numero);
      }
    }
    c("10 fatture, 10 numeri", 10, numeri.length);
    const ordinati = [...numeri].sort((a, b) => a - b);
    c(
      "numeri consecutivi da 1 a 10",
      Array.from({ length: 10 }, (_, i) => i + 1),
      ordinati,
    );
    const emesse = await w.porte.archivio.leggiPrefissoPerChiave("fattura:");
    c("10 fatture scritte in archivio", 10, emesse.length);
    c(
      "il lotto si è chiuso da solo: nessuna chiave chat_fatture_* resta",
      0,
      (await w.porte.archivio.leggiPrefissoPerChiave("chat_fatture_")).length,
    );

    // Ripetere l'emissione sull'ultima riga (risposta «persa»): una sola fattura, idempotente.
    const ultima = righe[righe.length - 1];
    const ripetuto = await E.emettiRigaChat(w.porte, { lotto: L, idRiga: ultima, emittente: "e1" });
    c(
      "stessa riga emessa due volte (lotto già chiuso) → idempotente, stesso numero, nessuna fattura in più",
      true,
      ripetuto.esito === "emessa" &&
        (await w.porte.archivio.leggiPrefissoPerChiave("fattura:")).length === 10,
    );
  }

  gruppo("DALLA CHAT · T6 · IDEMPOTENTE SENZA CHIUDERE IL LOTTO (due righe, una emessa)");
  {
    const w = mondo();
    w.m.set("fattura_azienda", JSON.stringify(AZIENDA));
    const idA = uuid(200);
    const idB = uuid(201);
    aggiungiScheda(w, idA);
    aggiungiScheda(w, idB);
    creaLottoConRiga(w, CH, L, idA, { impronta: "imp-a" });
    //  Stessa persona di fantasia (Mario Rossi, CF_PROVA) ma data e riferimento diversi: altrimenti
    //  `trovaDoppioni` vedrebbe «stesso CF + stesso importo + stessa data» (doppione_pagamento, non
    //  confermato) e bloccherebbe anche la prima riga.
    creaLottoConRiga(w, CH, L, idB, {
      impronta: "imp-b",
      pagamento: { riferimento: "RIFB000000", data: "2026-11-11" },
    });
    const prima = await E.emettiRigaChat(w.porte, { lotto: L, idRiga: idA, emittente: "e1" });
    c(
      "prima riga emessa, lotto NON chiuso (resta la seconda)",
      { esito: "emessa", lottoChiuso: false },
      {
        esito: prima.esito,
        lottoChiuso: prima.lottoChiuso,
      },
    );
    const scrittePrima = w.reg.scritte.length;
    const seconda = await E.emettiRigaChat(w.porte, { lotto: L, idRiga: idA, emittente: "e1" });
    c(
      "stessa riga emessa di nuovo (lotto ancora aperto) → stesso numero, stessa fattura, idempotente",
      prima.fattura.numero,
      seconda.fattura?.numero,
    );
    c(
      "nessuna seconda fattura in archivio",
      1,
      (await w.porte.archivio.leggiPrefissoPerChiave("fattura:")).length,
    );
  }

  gruppo("DALLA CHAT · T6 · LOCK GLOBALE CONDIVISO CON LA BULK");
  {
    const w = mondo();
    const idRiga = uuid(9);
    aggiungiScheda(w, idRiga);
    creaLottoConRiga(w, CH, L, idRiga);
    w.m.set("fattura_azienda", JSON.stringify(AZIENDA));
    // Qualcun altro (la bulk, o un'altra scheda) ha già il lucchetto globale.
    w.m.set(
      "bulk_fatture_lock",
      JSON.stringify({ id: "qualcun-altro", fino: new Date(T0 + 30_000).toISOString() }),
    );
    const esito = await E.emettiRigaChat(w.porte, { lotto: L, idRiga, emittente: "e1" });
    c(
      "lucchetto globale occupato (bulk o un'altra emissione) → ferma lucchetto_occupato",
      {
        esito: "ferma",
        codice: "lucchetto_occupato",
      },
      { esito: esito.esito, codice: esito.codice },
    );
  }

  radice; // non serve qui, come in altre prove di questa cartella
}
