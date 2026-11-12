/** ── FATTURE BULK · T0 · LE FONDAMENTA ─────────────────────────────────────
 *  (a) le chiavi del bulk non toccano la numerazione; (b) `idRigaDa`;
 *  (c) `origineBulk` è facoltativo e il resto non cambia; (d) i moduli del §3
 *  del piano esistono e sono impacchettati (così nessuno tocca più prove.mjs).
 *  ⚠️ Dati inventati (prove/fatture-bulk/dati.mjs). */
import { CF_PROVA, CF_STORTO, LOTTO_PROVA } from "./dati.mjs";

/** Il LIKE di Postgres con `\` come protezione, come lo scrive `leggiPrefisso`
 *  di archivio.ts: stessa regex di escape, poi `%` = qualunque cosa, `_` = un
 *  carattere. Qui lo si rifà per provarlo, non per usarlo. */
function comeLike(prefisso, { proteggi }) {
  const p = proteggi ? prefisso.replace(/[\\%_]/g, (ch) => `\\${ch}`) : prefisso;
  const lett = (ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === "\\") re += lett(p[++i] ?? "");
    else if (ch === "%") re += ".*";
    else if (ch === "_") re += ".";
    else re += lett(ch);
  }
  return new RegExp(`^${re}.*$`);
}

export async function prove(mod, { c, gruppo }) {
  const K = mod["fatture/bulk/chiavi"];
  const FT = mod["fatture/tipi"];
  const L = LOTTO_PROVA;

  gruppo("BULK · T0 · I MODULI ESISTONO");
  const attesi = [
    "tipi", "chiavi", "lettura-bulk", "raggruppa", "regole-riga", "doppioni-e-schede", "regole-lotto",
    "da-importo-a-fattura", "valuta", "emissione-bulk", "lucchetto.server", "bulk.server", "emissione.server",
    "coda", "immagini", "usa-lotto",
  ];
  c("tutti i moduli puri e server del §3 sono impacchettati",
    attesi.map(() => "object"), attesi.map((m) => typeof mod[`fatture/bulk/${m}`]));
  c("le DESCRIZIONI stanno nel loro file: la prima è la predefinita", "Fornitura impianto capillare",
    mod["fatture/descrizioni"]?.DESCRIZIONI?.[0]);
  c("le DESCRIZIONI sono 4, nello stesso ordine di prima", 4, mod["fatture/descrizioni"]?.DESCRIZIONI?.length);

  gruppo("BULK · T0 · (a) LE CHIAVI NON ENTRANO NELLA NUMERAZIONE");
  const chiavi = [
    K.chiaveTestata(L), K.chiaveFile(L, 0), K.chiaveFile(L, 599), K.chiaveRiga(L, "0006-0007-0008"),
    K.chiaveReclamo(L, 3), K.chiaveEmittente(L), K.CHIAVE_LUCCHETTO,
  ];
  c("la forma di ogni chiave", [
    "bulk_fatture_t:lotto-0123abcd", "bulk_fatture_f:lotto-0123abcd:0000", "bulk_fatture_f:lotto-0123abcd:0599",
    "bulk_fatture_r:lotto-0123abcd:0006-0007-0008", "bulk_fatture_c:lotto-0123abcd:3", "bulk_fatture_e:lotto-0123abcd",
    "bulk_fatture_lock",
  ], chiavi);
  c("nessuna chiave inizia con «fattura»", [], chiavi.filter((k) => k.startsWith("fattura")));
  // Entrambi i modi di leggerli: protetti (come fa archivio.ts) e NON protetti (il caso del jolly `_`).
  for (const prefisso of ["fattura:", "fattura_bozza:", "fattura_azienda"])
    for (const proteggi of [true, false])
      c(`nessuna chiave rientra nel LIKE «${prefisso}%» (${proteggi ? "con" : "senza"} escape di «_»)`, [],
        chiavi.filter((k) => comeLike(prefisso, { proteggi }).test(k)));
  c("controprova: il LIKE di prova riconosce davvero una fattura e protegge «_»",
    [true, true, false, false],
    [comeLike("fattura:", { proteggi: true }).test("fattura:2026-0001"),
      comeLike("fattura_bozza:", { proteggi: true }).test("fattura_bozza:x"),
      comeLike("fattura_bozza:", { proteggi: true }).test("fatturaXbozza:x"),
      comeLike("fattura:", { proteggi: true }).test("bulk_fatture_t:x")]);
  const campioni = [K.chiaveFile(L, 4), K.chiaveRiga(L, "0001"), K.chiaveReclamo(L, 1)];
  c("ogni prefisso pesca solo la sua famiglia (file, righe, reclami)",
    [[true, false, false], [false, true, false], [false, false, true]],
    [K.prefissoFile(L), K.prefissoRighe(L), K.prefissoReclami(L)].map((p) =>
      campioni.map((k) => comeLike(p, { proteggi: true }).test(k))));
  c("un lotto non pesca i file di un altro con l'id che inizia uguale",
    false, comeLike(K.prefissoFile("lotto-0123abcd"), { proteggi: true }).test(K.chiaveFile("lotto-0123abcdef", 1)));
  c("il prefisso della testata e quelle delle famiglie iniziano tutti per «bulk_fatture_»", true,
    [K.PREFISSO_TESTATA, K.prefissoFile(L), K.prefissoRighe(L), K.prefissoReclami(L), K.chiaveEmittente(L), K.CHIAVE_LUCCHETTO]
      .every((k) => k.startsWith("bulk_fatture_")));
  c("lottoValido: id normali sì; vuoto, «:», «%», «_», spazi, troppo lungo no", [true, true, false, false, false, false, false, false, false],
    ["lotto-0123abcd", "3f2a9c1e-77b0-4c1d-9d2e-0a1b2c3d4e5f", "", "a:b", "a%", "a_b", "a b", "x".repeat(41), "../x"].map(K.lottoValido));

  gruppo("BULK · T0 · (b) idRigaDa");
  c("[8,6,7] → «0006-0007-0008»", "0006-0007-0008", K.idRigaDa([8, 6, 7]));
  c("ordine numerico, non alfabetico (2 prima di 10)", "0002-0010", K.idRigaDa([10, 2]));
  c("un solo file", "0042", K.idRigaDa([42]));
  c("doppioni tolti", "0001-0002", K.idRigaDa([2, 1, 2]));
  c("non muta l'input", [3, 1], (() => { const a = [3, 1]; K.idRigaDa(a); return a; })());
  c("indice non valido → errore (mai un id strano)", [true, true, true],
    [[], [-1], [1.5]].map((a) => { try { K.idRigaDa(a); return false; } catch { return true; } }));
  c("le costanti del piano", {
    MAX_FILE: 600, GIORNI_LOTTO_APERTO: 30, ERRORI_DI_FILA: 5, IN_PARALLELO: 3,
    TIMEOUT_AI_MS: 55000, SCADENZA_RECLAMO_MS: 90000, RIMUOVI_A_GRUPPI: 100,
    SCADENZA_EMITTENTE_MS: 120000, SCADENZA_LUCCHETTO_MS: 60000, MAX_SOTTORICHIESTE: 40, GIORNI_TERMINE_SDI: 12,
  }, {
    MAX_FILE: K.MAX_FILE, GIORNI_LOTTO_APERTO: K.GIORNI_LOTTO_APERTO, ERRORI_DI_FILA: K.ERRORI_DI_FILA,
    IN_PARALLELO: K.IN_PARALLELO, TIMEOUT_AI_MS: K.TIMEOUT_AI_MS, SCADENZA_RECLAMO_MS: K.SCADENZA_RECLAMO_MS,
    RIMUOVI_A_GRUPPI: K.RIMUOVI_A_GRUPPI, SCADENZA_EMITTENTE_MS: K.SCADENZA_EMITTENTE_MS,
    SCADENZA_LUCCHETTO_MS: K.SCADENZA_LUCCHETTO_MS, MAX_SOTTORICHIESTE: K.MAX_SOTTORICHIESTE,
    GIORNI_TERMINE_SDI: K.GIORNI_TERMINE_SDI,
  });
  c("il reclamo dura più della richiesta più lunga (altrimenti due schede leggerebbero insieme)", true,
    K.SCADENZA_RECLAMO_MS > K.TIMEOUT_AI_MS);
  c("cartella del bucket: <utente>/bulk/<lotto>/", "u1/bulk/lotto-0123abcd/", K.cartellaBucket("u1", L));

  gruppo("BULK · T0 · (c) UNA FATTURA SENZA origineBulk RESTA VALIDA");
  const vecchia = {
    id: "2026-0001", stato: "emessa", numero: 1, anno: 2026, serie: "", data: "2026-10-01", dataPagamento: "2026-10-01",
    tipo: "unica", leadId: "l1", leadNome: "Mario Fantasia", preventivoRef: "",
    cliente: { azienda: false, denominazione: "", nome: "Mario", cognome: "Fantasia", codiceFiscale: CF_PROVA, partitaIva: "",
      indirizzo: "Via Prova 1", civico: "", cap: "00100", comune: "Roma", provincia: "RM", nazione: "IT", codiceDestinatario: "0000000", pec: "" },
    righe: [{ descrizione: "Fornitura impianto capillare", quantita: 1, prezzoUnitario: 100, aliquota: 22 }],
    causale: "", imponibile: 100, imposta: 22, totale: 122, creataIl: "2026-10-01T00:00:00Z", emessaIl: "2026-10-01T00:00:00Z",
  };
  const bozza = FT.comeBozza(vecchia);
  c("rimessa in bozza, resta senza origineBulk (nessuna chiave nuova)", false, "origineBulk" in bozza);
  c("e il resto è quello di sempre", ["bozza:l1", "bozza", 0], [bozza.id, bozza.stato, bozza.numero]);
  const nuova = { ...vecchia, origineBulk: { lotto: L, riga: "0000-0001-0002", impronte: ["a".repeat(64)], riferimento: "CRO123456" } };
  c("con origineBulk la fattura si serializza e si rilegge uguale (solo hash, nessun percorso)", nuova,
    JSON.parse(JSON.stringify(nuova)));
  c("i dati di prova: CF valido ≠ CF storto, stessa lunghezza", [16, 16, true],
    [CF_PROVA.length, CF_STORTO.length, CF_PROVA !== CF_STORTO]);
}
