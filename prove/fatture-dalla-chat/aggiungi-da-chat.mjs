/** ── FATTURE DALLA CHAT · T11.4 · LA RIGA CREATA O TROVATA AL VOLO ──────────
 *  Commessa 2026-11-13-fatture-dalla-chat (SPEC §9.3 passo 4, §10; PIANO
 *  §3bis, T11.4). `aggiungi-da-chat {schedaId}`, SENZA `lotto`: il titolare
 *  arriva dalla chat, non ha ancora scelto o creato un caricamento. Il
 *  server trova il lotto «dalla chat» aperto più di recente, o ne crea uno;
 *  la stessa scheda passata due volte non duplica la riga. PORTE FINTE. */
import { createRequire } from "node:module";
import { join } from "node:path";
import { SCHEDA_PROVA, SCHEDA_PROVA_ALTRA } from "./dati.mjs";

async function impacchetta(radice, percorsoRelativo) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const risultato = esbuild.buildSync({
    entryPoints: [join(radice, percorsoRelativo)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const testo = risultato.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(testo).toString("base64")}`);
}

const U = "utente-prova";
const T0 = Date.parse("2026-11-13T10:00:00.000Z");

const AZIENDA_PROVA = {
  denominazione: "Prova S.r.l.",
  partitaIva: "12345670017",
  codiceFiscale: "12345670017",
  regimeFiscale: "RF01",
  indirizzo: "Via Prova 1",
  civico: "1",
  cap: "20100",
  comune: "Milano",
  provincia: "MI",
  nazione: "IT",
  reaUfficio: "",
  reaNumero: "",
  pec: "x@pec.it",
  iban: "IT60X0000000000000000000000",
  aliquotaPredefinita: 22,
  primoNumero: 1,
  annoNumerazione: 2026,
  serie: "",
};

function mondo() {
  const m = new Map();
  const reg = { scritte: [] }; // ⚠️ ogni scrittura, non solo lo stato finale (atomicità).
  const w = { m, reg, ora: T0, n: 0, schede: new Map() };
  w.id = () => `00000000-0000-4000-8000-${String(++w.n).padStart(12, "0")}`;
  const archivio = {
    leggi: async (k) => m.get(k) ?? null,
    leggiPrefisso: async (p) =>
      [...m].filter(([k]) => k.startsWith(p)).map(([key, value]) => ({ key, value })),
    leggiPrefissoPerChiave: async (p) =>
      [...m].filter(([k]) => k.startsWith(p)).map(([key, value]) => ({ key, value })),
    leggiMolte: async (ks) => ks.filter((k) => m.has(k)).map((k) => ({ key: k, value: m.get(k) })),
    scrivi: async (k, v) => {
      m.set(k, v);
      reg.scritte.push({ k, v });
      return null;
    },
    elimina: async (k) => {
      m.delete(k);
      return null;
    },
    creaSeAssente: async (k, v) => {
      if (m.has(k)) return { stato: "esiste" };
      m.set(k, v);
      reg.scritte.push({ k, v });
      return { stato: "creata" };
    },
    eliminaPerPrefisso: async (p) => {
      for (const k of [...m.keys()]) if (k.startsWith(p)) m.delete(k);
      return null;
    },
  };
  const lucchetto = {
    leggi: async (k) => m.get(k) ?? null,
    creaSeAssente: async (k, v) => {
      if (m.has(k)) return false;
      m.set(k, v);
      return true;
    },
    sostituisciSe: async (k, a, n) => {
      if (m.get(k) !== a) return false;
      m.set(k, n);
      reg.scritte.push({ k, v: n });
      return true;
    },
    eliminaSe: async (k, a) => {
      if (m.get(k) !== a) return false;
      m.delete(k);
      return true;
    },
  };
  const bucket = {
    carica: async () => null,
    scarica: async () => null,
    elenca: async () => [],
    rimuovi: async () => null,
    firma: async () => "https://firmato.example/x",
  };
  const raccolta = {
    messaggi: async () => [],
    mediaPonte: async () => [],
    firmaPonte: async () => null,
    scaricaPonte: async () => null,
    scaricaManyChat: async () => null,
  };
  const ai = async () => ({ testo: '{"tessere":[],"indirizzi":[]}', fine: "stop" });
  w.porte = {
    archivio,
    lucchetto,
    bucket,
    raccolta,
    ai,
    adesso: () => w.ora,
    id: w.id,
    log: () => {},
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
    payment: {
      accontoPagato: 100,
      statoPagamento: "acconto_ricevuto",
      dataPagamento: "2026-11-01",
    },
    codiceFiscale: "",
    ...extra,
  });
}

const dip = (w) => ({
  guardia: async () => ({ ok: true, utente: U }),
  porte: () => w.porte,
  emettiRiga: async () => ({ ok: true, esito: "ferma", codice: "interno", messaggio: "finto" }),
});
const richiesta = (metodo, corpo) =>
  new Request("http://localhost/api/crm/fatture-chat", {
    method: metodo,
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });

/** Scrive a mano l'azienda nel registro, come già fanno le prove di T5 per «crea». */
function conAzienda(w) {
  w.m.set("fattura_azienda", JSON.stringify(AZIENDA_PROVA));
  return w;
}

export async function prove(_mod, { c, gruppo, radice }) {
  const CS = await impacchetta(radice, "src/crm/fatture/dalla-chat/chat.server.ts");

  gruppo("DALLA CHAT · T11.4 · nessun lotto aperto → ne crea uno, poi la riga");
  {
    const w = conAzienda(mondo());
    aggiungiScheda(w, SCHEDA_PROVA);
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-da-chat", schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo = await r.json();
    c(
      "ok: true, azione aggiungi-da-chat",
      true,
      corpo.ok === true && corpo.azione === "aggiungi-da-chat",
    );
    c("torna un lotto", true, typeof corpo.lotto === "string" && corpo.lotto.length > 0);
    c("la riga è per la scheda scelta", SCHEDA_PROVA, corpo.riga?.idRiga);
    c("la riga ha scheda scritta (mai assente)", SCHEDA_PROVA, corpo.riga?.scheda);
    const testata = JSON.parse(w.m.get(`chat_fatture_t:${corpo.lotto}`));
    c(
      "descrizione del lotto creato al volo: VUOTA (mai chiesta al titolare, mai un testo non ammesso)",
      "",
      testata.descrizione,
    );
  }

  gruppo(
    "DALLA CHAT · T11.4 · un lotto già aperto → la riga entra in quello (non ne crea un secondo)",
  );
  {
    const w = conAzienda(mondo());
    aggiungiScheda(w, SCHEDA_PROVA);
    const r1 = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-da-chat", schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo1 = await r1.json();
    const lottiAperti = [...w.m.keys()].filter((k) => k.startsWith("chat_fatture_t:"));
    c("un solo lotto dopo la prima chiamata", 1, lottiAperti.length);

    aggiungiScheda(w, SCHEDA_PROVA_ALTRA);
    const r2 = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-da-chat", schedaId: SCHEDA_PROVA_ALTRA }),
      dip(w),
    );
    const corpo2 = await r2.json();
    c("stesso lotto (non ne crea un secondo)", corpo1.lotto, corpo2.lotto);
    const lottiDopo = [...w.m.keys()].filter((k) => k.startsWith("chat_fatture_t:"));
    c("ancora un solo lotto dopo la seconda chiamata", 1, lottiDopo.length);
  }

  gruppo("DALLA CHAT · T11.4 · due lotti aperti insieme → sceglie il più RECENTE (creatoIl)");
  {
    const w = conAzienda(mondo());
    w.m.set(
      "chat_fatture_t:lotto-vecchio1",
      JSON.stringify({
        lotto: "lotto-vecchio1",
        creatoIl: "2026-11-10T08:00:00.000Z",
        descrizione: "",
        dataSeManca: "",
        firmaImpostazioni: "f",
      }),
    );
    w.m.set(
      "chat_fatture_t:lotto-recente1",
      JSON.stringify({
        lotto: "lotto-recente1",
        creatoIl: "2026-11-12T08:00:00.000Z",
        descrizione: "",
        dataSeManca: "",
        firmaImpostazioni: "f",
      }),
    );
    aggiungiScheda(w, SCHEDA_PROVA);
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-da-chat", schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo = await r.json();
    c("sceglie il lotto più recente, non il più vecchio", "lotto-recente1", corpo.lotto);
  }

  gruppo(
    "DALLA CHAT · T11.4 · la stessa scheda due volte → torna la riga già esistente, non una seconda",
  );
  {
    const w = conAzienda(mondo());
    aggiungiScheda(w, SCHEDA_PROVA);
    const r1 = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-da-chat", schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo1 = await r1.json();
    const scrittePrima = w.reg.scritte.length;
    const r2 = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-da-chat", schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo2 = await r2.json();
    c("stessa riga (stesso idRiga)", corpo1.riga.idRiga, corpo2.riga.idRiga);
    c("stesso lotto", corpo1.lotto, corpo2.lotto);
    c(
      "il secondo «Usa per fattura» non scrive nulla di nuovo (nessuna seconda riga creata)",
      scrittePrima,
      w.reg.scritte.length,
    );
    const righe = [...w.m.keys()].filter((k) => k.startsWith(`chat_fatture_r:${corpo1.lotto}:`));
    c("una sola riga per quella scheda", 1, righe.length);
  }

  gruppo(
    "DALLA CHAT · T11.4 · la scrittura è ATOMICA: la riga nasce SEMPRE con `scheda` già scritto",
  );
  {
    const w = conAzienda(mondo());
    aggiungiScheda(w, SCHEDA_PROVA);
    await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-da-chat", schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const scrittureRiga = w.reg.scritte.filter(({ k }) => k.startsWith("chat_fatture_r:"));
    c("esattamente UNA scrittura per la riga (mai insert+update)", 1, scrittureRiga.length);
    const valore = JSON.parse(scrittureRiga[0].v);
    c("quella scrittura ha già `scheda` (nessun istante senza)", SCHEDA_PROVA, valore.scheda);
  }

  gruppo("DALLA CHAT · T11.4 · scheda inesistente → richiesta_non_valida, zero lotti creati");
  {
    const w = conAzienda(mondo());
    const r = await CS.gestisciPOSTChat(
      richiesta("POST", { azione: "aggiungi-da-chat", schedaId: SCHEDA_PROVA }),
      dip(w),
    );
    const corpo = await r.json();
    c(
      "richiesta_non_valida (scheda non trovata)",
      true,
      corpo.ok === false && corpo.codice === "richiesta_non_valida",
    );
    const lotti = [...w.m.keys()].filter((k) => k.startsWith("chat_fatture_t:"));
    c("nessun lotto creato a vuoto", 0, lotti.length);
  }
}
