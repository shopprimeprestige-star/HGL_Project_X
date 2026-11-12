/** ── FATTURE BULK · T6 · emettiSu NON SOVRASCRIVE PIÙ ─────────────────────
 *  Commit separato (il capo progetto lo riporta al titolare): `emettiSu` scrive
 *  con un inserimento che FALLISCE se la chiave esiste, e su conflitto rilegge,
 *  ricalcola il numero e riprova UNA volta. Protegge i quattro emettitori
 *  esistenti (FinestraAltraFattura, FinestraIncassoFattura, CRM.fatture, server).
 *  In più `comeBozza` toglie `origineBulk` (decisione del capo progetto).
 *  ⚠️ Archivio finto in memoria con la gara iniettabile; dati di fantasia. */
import { CF_PROVA, LOTTO_PROVA } from "./dati.mjs";

/** Una fattura EMESSA già in archivio (come la scriverebbe `emettiSu`). */
function emessa(numero, extra = {}) {
  const anno = extra.anno ?? 2026;
  const serie = extra.serie ?? "";
  return {
    id: `${anno}-${String(numero).padStart(4, "0")}`, stato: "emessa", numero, anno, serie,
    data: `${anno}-10-01`, dataPagamento: `${anno}-10-01`, tipo: "unica",
    leadId: `altra-${numero}`, leadNome: "Anna Esempio", preventivoRef: "",
    cliente: { azienda: false, denominazione: "", nome: "Anna", cognome: "Esempio", codiceFiscale: CF_PROVA, partitaIva: "",
      indirizzo: "Via Prova 1", civico: "", cap: "00100", comune: "Roma", provincia: "RM", nazione: "IT", codiceDestinatario: "0000000", pec: "" },
    righe: [{ descrizione: "Fornitura impianto capillare", quantita: 1, prezzoUnitario: 100, aliquota: 22 }],
    causale: "", imponibile: 100, imposta: 22, totale: 122, creataIl: "2026-10-01T00:00:00Z", emessaIl: "2026-10-01T00:00:00Z",
    ...extra,
  };
}

const chiaveDi = (f) => `fattura:${f.id}${f.serie ? `-${f.serie}` : ""}`;

/** La fattura da emettere (una bozza di un cliente di fantasia). */
const daEmettere = (extra = {}) => ({ ...emessa(0, { leadId: "lead-nuovo", leadNome: "Bruno Fantasia" }), stato: "bozza", numero: 0, id: "bozza:lead-nuovo", ...extra });

/** Archivio in memoria. `conCrea:false` = l'archivio di prima (solo `scrivi`).
 *  `dopoLettura`: coda di funzioni lanciate DOPO che chi numera ha letto le emesse e
 *  PRIMA che scriva — è la gara fra due emettitori. `rifiuta(chiave)` → messaggio d'errore. */
function archivioFinto({ conCrea = true, dopoLettura = [], rifiuta = () => null } = {}) {
  const m = new Map();
  const log = [];
  const a = {
    m, log,
    leggi: async (k) => m.get(k) ?? null,
    leggiPrefisso: async (p) => {
      const righe = [...m].filter(([k]) => k.startsWith(p)).map(([key, value]) => ({ key, value }));
      if (p === "fattura:") dopoLettura.shift()?.(a);
      return righe;
    },
    scrivi: async (k, v) => {
      const e = rifiuta(k);
      if (e) return e;
      log.push(["scrivi", k]);
      m.set(k, v);
      return null;
    },
    elimina: async (k) => { log.push(["elimina", k]); m.delete(k); return null; },
  };
  if (conCrea)
    a.creaSeAssente = async (k, v) => {
      const e = rifiuta(k);
      if (e) return { stato: "errore", errore: e };
      if (m.has(k)) { log.push(["esiste", k]); return { stato: "esiste" }; }
      log.push(["crea", k]);
      m.set(k, v);
      return { stato: "creata" };
    };
  return a;
}

/** Un altro emettitore che, nello stesso istante, prende il numero `n`. */
const concorrente = (n, extra = {}) => (a) => {
  const f = emessa(n, { leadId: `concorrente-${n}`, ...extra });
  a.m.set(chiaveDi(f), JSON.stringify(f));
};

const letta = (a, k) => (a.m.has(k) ? JSON.parse(a.m.get(k)) : null);
/** Senza il momento dell'emissione (cambia a ogni chiamata). */
const senzaOra = (f) => { const { emessaIl, ...resto } = f; return resto; };

export async function prove(mod, { c, gruppo }) {
  const AR = mod["fatture/archivio"];
  const FT = mod["fatture/tipi"];
  const azienda = { ...FT.AZIENDA_VUOTA, annoNumerazione: 2026, primoNumero: 1, serie: "" };
  const partenza = (a) => { for (const n of [1, 2]) { const f = emessa(n); a.m.set(chiaveDi(f), JSON.stringify(f)); } };

  gruppo("BULK · T6 · LA CHIAVE DELLA FATTURA EMESSA");
  c("senza sezionale: fattura:<anno>-<numero>", "fattura:2026-0007", AR.chiaveEmessa({ id: "2026-0007", serie: "" }));
  c("con sezionale: …-A", "fattura:2026-0007-A", AR.chiaveEmessa({ id: "2026-0007", serie: "A" }));

  gruppo("BULK · T6 · SENZA CONFLITTO NIENTE CAMBIA");
  const nuovo = archivioFinto(); partenza(nuovo);
  const vecchio = archivioFinto({ conCrea: false }); partenza(vecchio);
  const rNuovo = await AR.emettiSu(nuovo, daEmettere(), azienda, "2026-11-05");
  const rVecchio = await AR.emettiSu(vecchio, daEmettere(), azienda, "2026-11-05");
  c("emette il numero successivo", [true, 3, "2026-0003"], [rNuovo.ok, rNuovo.fattura?.numero, rNuovo.fattura?.id]);
  c("stessa fattura di prima (archivio senza inserimento protetto), a parte l'ora",
    senzaOra(rVecchio.fattura), senzaOra(rNuovo.fattura));
  c("data e data pagamento = quella passata, mai «oggi»", ["2026-11-05", "2026-11-05"],
    [rNuovo.fattura.data, rNuovo.fattura.dataPagamento]);
  c("scritta sotto la chiave giusta, uguale a quanto restituito", rNuovo.fattura, letta(nuovo, "fattura:2026-0003"));
  c("con l'inserimento che non sovrascrive (una sola volta)", [["crea", "fattura:2026-0003"]],
    nuovo.log.filter(([t]) => t === "crea" || t === "scrivi"));
  c("l'archivio di prima continua a usare «scrivi»", [["scrivi", "fattura:2026-0003"]],
    vecchio.log.filter(([t]) => t === "crea" || t === "scrivi"));

  gruppo("BULK · T6 · LA BOZZA: PRIMA LA FATTURA, POI LA BOZZA");
  const conBozza = archivioFinto(); partenza(conBozza);
  const bozza = daEmettere();
  conBozza.m.set(AR.chiaveBozza("lead-nuovo"), JSON.stringify(bozza));
  const rB = await AR.emettiSu(conBozza, bozza, azienda, "2026-11-05");
  c("a emissione riuscita la bozza di quel cliente sparisce", [true, false], [rB.ok, conBozza.m.has(AR.chiaveBozza("lead-nuovo"))]);
  c("l'ordine è fattura e poi bozza", ["crea", "elimina"],
    conBozza.log.filter(([t]) => t === "crea" || t === "elimina").map(([t]) => t));
  const altraBozza = archivioFinto(); partenza(altraBozza);
  altraBozza.m.set(AR.chiaveBozza("lead-altro"), "{}");
  await AR.emettiSu(altraBozza, daEmettere(), azienda, "2026-11-05");
  c("la bozza di un altro cliente non si tocca", true, altraBozza.m.has(AR.chiaveBozza("lead-altro")));

  gruppo("BULK · T6 · DUE EMISSIONI CHE CALCOLANO LO STESSO NUMERO");
  const gara = archivioFinto({ dopoLettura: [concorrente(3)] }); partenza(gara);
  const prima = gara.m.get("fattura:2026-0003") ?? null;
  c("(prima della gara il numero 3 è libero)", null, prima);
  const rG = await AR.emettiSu(gara, daEmettere(), azienda, "2026-11-05");
  c("la seconda riprova e prende il numero dopo", [true, 4], [rG.ok, rG.fattura?.numero]);
  c("la PRIMA resta intatta (è dell'altro emettitore, non cancellata)", "concorrente-3", letta(gara, "fattura:2026-0003")?.leadId);
  c("la seconda è sotto la chiave 0004", "lead-nuovo", letta(gara, "fattura:2026-0004")?.leadId);
  c("due tentativi: il primo respinto, il secondo riuscito", ["esiste", "crea"],
    gara.log.filter(([t]) => t === "esiste" || t === "crea").map(([t]) => t));
  c("in tutto quattro fatture, nessun numero ripetuto", ["2026-0001", "2026-0002", "2026-0003", "2026-0004"],
    [...gara.m.keys()].filter((k) => k.startsWith("fattura:")).map((k) => k.slice(8)).sort());

  // La regressione evitata: il vecchio comportamento (solo «scrivi» = upsert) cancellava la prima.
  const garaVecchia = archivioFinto({ conCrea: false, dopoLettura: [concorrente(3)] }); partenza(garaVecchia);
  await AR.emettiSu(garaVecchia, daEmettere(), azienda, "2026-11-05");
  c("(difetto di prima, solo per i finti senza inserimento protetto: la 3 dell'altro è persa)",
    "lead-nuovo", letta(garaVecchia, "fattura:2026-0003")?.leadId);

  gruppo("BULK · T6 · CONFLITTO DUE VOLTE = ERRORE, NESSUNA SCRITTURA, BOZZA INTATTA");
  const doppia = archivioFinto({ dopoLettura: [concorrente(3), concorrente(4)] }); partenza(doppia);
  doppia.m.set(AR.chiaveBozza("lead-nuovo"), JSON.stringify(daEmettere()));
  const rD = await AR.emettiSu(doppia, daEmettere(), azienda, "2026-11-05");
  c("restituisce un errore leggibile", [false, true], [rD.ok, typeof rD.errore === "string" && rD.errore.length > 10]);
  c("nessuna fattura nostra scritta", 0,
    [...doppia.m.values()].filter((v) => v.includes("lead-nuovo") && v.includes('"stato":"emessa"')).length);
  c("le due dell'altro emettitore intatte", ["concorrente-3", "concorrente-4"],
    [letta(doppia, "fattura:2026-0003")?.leadId, letta(doppia, "fattura:2026-0004")?.leadId]);
  c("la bozza c'è ancora", true, doppia.m.has(AR.chiaveBozza("lead-nuovo")));
  c("niente terzo tentativo (due inserimenti respinti, nessuno riuscito)", 0,
    doppia.log.filter(([t]) => t === "crea").length);

  gruppo("BULK · T6 · SCRITTURA FALLITA");
  const guasto = archivioFinto({ rifiuta: (k) => (k.startsWith("fattura:") ? "rete caduta" : null) }); partenza(guasto);
  guasto.m.set(AR.chiaveBozza("lead-nuovo"), JSON.stringify(daEmettere()));
  const rF = await AR.emettiSu(guasto, daEmettere(), azienda, "2026-11-05");
  c("errore passato com'è, senza ripetere", [false, "rete caduta"], [rF.ok, rF.errore]);
  c("bozza intatta, nessun numero consumato", [true, 2],
    [guasto.m.has(AR.chiaveBozza("lead-nuovo")), [...guasto.m.keys()].filter((k) => k.startsWith("fattura:")).length]);
  const guastoVecchio = archivioFinto({ conCrea: false, rifiuta: (k) => (k.startsWith("fattura:") ? "rete caduta" : null) }); partenza(guastoVecchio);
  guastoVecchio.m.set(AR.chiaveBozza("lead-nuovo"), JSON.stringify(daEmettere()));
  const rFV = await AR.emettiSu(guastoVecchio, daEmettere(), azienda, "2026-11-05");
  c("lo stesso con l'archivio di prima", [false, "rete caduta", true], [rFV.ok, rFV.errore, guastoVecchio.m.has(AR.chiaveBozza("lead-nuovo"))]);
  const illeggibile = archivioFinto();
  illeggibile.leggiPrefisso = async () => { throw new Error("archivio giù"); };
  const rI = await AR.emettiSu(illeggibile, daEmettere(), azienda, "2026-11-05");
  c("archivio non leggibile = non si numera, niente scritto", [false, 0], [rI.ok, illeggibile.log.filter(([t]) => t === "crea").length]);

  gruppo("BULK · T6 · ANNO E SEZIONALE");
  const sez = archivioFinto();
  const sezionale = { ...azienda, serie: "A" };
  for (const n of [1, 2]) { const f = emessa(n, { serie: "A" }); sez.m.set(chiaveDi(f), JSON.stringify(f)); }
  const rS = await AR.emettiSu(sez, daEmettere(), sezionale, "2026-11-05");
  c("con sezionale: chiave e numero della serie", [true, "fattura:2026-0003-A"], [rS.ok, [...sez.m.keys()].find((k) => k.includes("0003"))]);
  const gS = archivioFinto({ dopoLettura: [concorrente(3, { serie: "A" })] });
  for (const n of [1, 2]) { const f = emessa(n, { serie: "A" }); gS.m.set(chiaveDi(f), JSON.stringify(f)); }
  const rGS = await AR.emettiSu(gS, daEmettere(), sezionale, "2026-11-05");
  c("anche col sezionale la gara si risolve sul numero dopo", [true, 4, "concorrente-3"],
    [rGS.ok, rGS.fattura?.numero, letta(gS, "fattura:2026-0003-A")?.leadId]);
  const anno = archivioFinto(); partenza(anno);
  const rA = await AR.emettiSu(anno, daEmettere(), azienda, "2027-01-03");
  c("incasso del nuovo anno: la numerazione riparte da 1", [1, "fattura:2027-0001"], [rA.fattura?.numero, [...anno.m.keys()].find((k) => k.includes("2027"))]);

  gruppo("BULK · T6 · archivioSu: L'INSERIMENTO CHE FALLISCE SE ESISTE");
  const chiamate = [];
  const clienteFinto = (risposta) => ({
    from: (t) => ({
      insert: async (v) => { chiamate.push([t, v]); return { error: risposta }; },
    }),
  });
  const provaCrea = (risposta) => AR.archivioSu(clienteFinto(risposta)).creaSeAssente("k1", "v1");
  c("riuscito = creata", { stato: "creata" }, await provaCrea(null));
  c("codice 23505 di Postgres = esiste", { stato: "esiste" }, await provaCrea({ code: "23505", message: "duplicate key value violates unique constraint" }));
  c("anche solo il messaggio «duplicate key» = esiste", { stato: "esiste" }, await provaCrea({ message: "duplicate key value violates unique constraint \"app_config_pkey\"" }));
  c("un altro errore resta un errore (mai scambiato per «esiste»)", { stato: "errore", errore: "permission denied" },
    await provaCrea({ code: "42501", message: "permission denied" }));
  c("scrive su app_config con chiave e valore, nient'altro", [["app_config", { key: "k1", value: "v1" }]], chiamate.slice(0, 1));

  gruppo("BULK · T6 · comeBozza TOGLIE origineBulk");
  const bulk = emessa(9, { origineBulk: { lotto: LOTTO_PROVA, riga: "0000-0001-0002", impronte: ["a".repeat(64)], riferimento: "CRO123456" } });
  const b = FT.comeBozza(bulk);
  c("la bozza non ha più la chiave", false, "origineBulk" in b);
  c("nemmeno una volta scritta e riletta", false, JSON.stringify(b).includes("origineBulk"));
  c("l'originale non è toccato", LOTTO_PROVA, bulk.origineBulk.lotto);
  c("il resto è quello di sempre", ["bozza", 0, "", "bozza:altra-9", "Anna", 100], [b.stato, b.numero, b.data, b.id, b.cliente.nome, b.righe[0].prezzoUnitario]);
  c("una fattura senza origine resta senza", false, "origineBulk" in FT.comeBozza(emessa(1)));
}
