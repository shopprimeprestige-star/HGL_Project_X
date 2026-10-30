/** ── PROVE: INVIO A MANO DAL PONTE · LO SCHELETRO (compito T0) ──
 *
 *  Commessa 2026-10-30-ponte-invio-manuale. Congela i contratti di
 *  `src/crm/ponte/invio-tipi.ts` (valori, liste chiuse, campi delle forme) e
 *  controlla il collegamento in `prove.mjs` e `ponte.mjs`. Se un compito li
 *  cambia senza passare dalla LAVAGNA, qui si vede.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** I campi di un'interfaccia (o i metodi), letti dal sorgente, in ordine. */
function campi(sorgente, nome) {
  const m = sorgente.match(new RegExp(`export interface ${nome} \\{([\\s\\S]*?)\\n\\}`));
  if (!m) return null;
  const corpo = m[1].replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return [...corpo.matchAll(/^\s{2}(\w+)\??[:(]/gm)].map((x) => x[1]);
}

export async function provePonteInvioScheletro(mod, { c, gruppo, radice }) {
  gruppo("PONTE · INVIO A MANO · LO SCHELETRO (compito T0)");
  const T = mod["ponte/invio-tipi"];
  const I = mod["ponte/invio"];
  c(
    "i limiti dell'invio (D5): una costante sola",
    { caratteri: 2000, intervalloS: 20, alGiorno: 20, scadenzaMin: 10, incertoMin: 3, inCodaMax: 3, chiaveMin: 8, chiaveMax: 64, ponteFrescoMs: 180_000, nascostoDopoS: 90, giornoOre: 24, retentionGiorni: 30 },
    T.LIMITI_INVIO,
  );
  c("stati della coda: lista chiusa", ["in_attesa", "in_invio", "inviato", "non_inviato"], [...T.STATI_CODA]);
  c(
    "motivi di una riga non inviata: lista chiusa, solo [a-z_]",
    ["mai_scritto", "stop", "scaduto", "non_collegato", "numero_non_valido", "testo_non_valido", "limite_ponte", "esito_incerto", "errore_invio"],
    [...T.MOTIVI_INVIO],
  );
  c(
    "motivi di rifiuto immediato: lista chiusa",
    ["testo_vuoto", "testo_lungo", "numero_non_valido", "ponte_non_collegato", "invii_spenti", "mai_scritto", "stop", "limite_giornaliero", "coda_piena", "non_autorizzato", "non_riprovabile"],
    [...T.MOTIVI_RIFIUTO],
  );
  c("…tutte parole minuscole con _", true, [...T.MOTIVI_INVIO, ...T.MOTIVI_RIFIUTO].every((x) => /^[a-z_]+$/.test(x)));

  //  Le forme, campo per campo e in ordine.
  const src = readFileSync(join(radice, "src/crm/ponte/invio-tipi.ts"), "utf8");
  const forme = {
    RigaCoda: ["id", "chiave", "numero", "testo", "stato", "motivo", "created_at", "preso_il", "inviato_il", "wa_message_id"],
    FattiInvio: ["entrata", "stop", "ponte_stato", "ponte_battito", "invii_attivi", "ultime24h", "in_coda"],
    EsitoPrendi: ["invio", "attendi_s", "limite", "scaduti", "incerti", "respinti"],
    EsitoEsitoSql: ["ok", "stato", "nuovo"],
    CorpoPrendi: ["v", "tipo"],
    CorpoEsito: ["v", "tipo", "id", "esito", "wa_id", "ts", "motivo"],
    RispostaPrendi: ["ok", "invio", "attendi_s", "limite"],
    RispostaEsito: ["ok", "stato"],
    PorteInvio: ["utente", "fatti", "accoda", "riga", "riprova", "prendi", "esito", "inviatiDalCrm", "inAttesa", "avviso"],
    BollaCoda: ["id", "testo", "fase", "quando", "frase", "incerto", "puoRiprovare"],
    ApiPonteInvio: ["puo", "coda", "restanti", "inviando", "invia", "riprova"],
  };
  for (const [nome, attesi] of Object.entries(forme)) c(`forma congelata: ${nome}`, attesi, campi(src, nome));
  c("RispostaBattito di tipi.ts non cambia (il campo nuovo sta in RispostaBattitoInvii)", ["ok", "riconciliati"], campi(readFileSync(join(radice, "src/crm/ponte/tipi.ts"), "utf8"), "RispostaBattito"));
  c("RispostaBattitoInvii = RispostaBattito + invii_in_attesa", true, /export type RispostaBattitoInvii = RispostaBattito & \{ invii_in_attesa: number \};/.test(src));
  c("RichiestaBrowser: accoda e riprova", true, /azione: "accoda"; numero: string; testo: string; chiave: string/.test(src) && /azione: "riprova"; id: string; confermaIncerto\?: boolean/.test(src));
  c("codici dei log dell'invio: lista chiusa", ["invio_accodato", "invio_prelevato", "invio_esito", "invio_rifiutato", "invio_database", "invio_migrazione"], [...src.match(/export type CodiceAvvisoInvio =([\s\S]*?);/)[1].matchAll(/"(\w+)"/g)].map((x) => x[1]));
  c("la chat: ChatWaApi guadagna `ponte?` e BollaProps `coda?` (facoltativi)", [true, true], [
    /ponte\?: ApiPonteInvio;/.test(readFileSync(join(radice, "src/crm/chatwa/tipi.ts"), "utf8")),
    /coda\?: BollaCoda & \{ onRiprova: \(\) => void \};/.test(readFileSync(join(radice, "src/crm/chatwa/tipi.ts"), "utf8")),
  ]);

  //  ponteFrescoMs è la stessa soglia dell'avviso «il ponte è fermo».
  const esbuild = createRequire(import.meta.url)("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "ponte-invio-sk-"));
  try {
    const fuori = join(dir, "avvisoPonte.cjs");
    await esbuild.build({
      entryPoints: [join(radice, "src/crm/chatwa/avvisoPonte.ts")],
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: fuori,
      logLevel: "error",
      alias: { "@": join(radice, "src") },
    });
    const A = createRequire(import.meta.url)(fuori);
    c("ponteFrescoMs === SOGLIA_BATTITO_MS di avvisoPonte", A.SOGLIA_BATTITO_MS, T.LIMITI_INVIO.ponteFrescoMs);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  //  Le regole pure: le firme ci sono (i corpi li prova invio-regole.mjs).
  const funzioni = ["normalizzaNumero", "ponteCollegato", "controllaAccodamento", "fraseMotivo", "statoVisibile", "puoRiprovare", "vistaCoda", "leggiRichiestaBrowser", "leggiPrendi", "leggiEsito"];
  c("invio.ts espone le funzioni del §3.2", funzioni.map(() => "function"), funzioni.map((f) => typeof I[f]));

  //  Il collegamento in prove.mjs e ponte.mjs.
  const pr = readFileSync(join(radice, "prove/prove.mjs"), "utf8");
  c("prove.mjs impacchetta ponte/invio-tipi e ponte/invio", [true, true], ['"ponte/invio-tipi"', '"ponte/invio"'].map((x) => pr.includes(x)));
  c("prove.mjs impacchetta (quando esistono) ponte/invio-giro e chatwa/invioPonte", true, /\.\.\.\["ponte\/invio-giro", "chatwa\/invioPonte"\]\.filter\(\(m\) => existsSync/.test(pr));
  c("il filtro delle «ultime» migrazioni esclude ponte_invio_manuale", true, /const ultime = readdirSync\(cartella\)\.filter\([^\n]*!n\.includes\("ponte_invio_manuale"\)/.test(pr));
  const pm = readFileSync(join(radice, "prove/ponte.mjs"), "utf8");
  const sette = ["scheletro", "regole", "migrazione", "rotta", "servizio", "chat-ui", "chat-hook"];
  c("ci sono i sette file di prova nuovi", sette.map(() => true), sette.map((x) => existsSync(join(radice, `prove/ponte/invio-${x}.mjs`))));
  c("ponte.mjs li importa e li chiama tutti e sette", sette.map(() => true), sette.map((x) => pm.includes(`./ponte/invio-${x}.mjs`)));
  c("la prova della migrazione del ponte ignora ponte_invio_manuale", true, /!n\.includes\("ponte_invio_manuale"\)/.test(readFileSync(join(radice, "prove/ponte/migrazione.mjs"), "utf8")));
}
