/** ── FATTURE DALLA CHAT · T12 · ABBINAMENTO PER NUMERO DI TELEFONO ──────────
 *  PIANO §2bis/§4 (T12), SPEC §9.3 passo 4, §9.7 criterio 2: dato il numero
 *  della chat aperta e le schede (`crm_leads`), quante schede combaciano sulle
 *  ultime 9 cifre. Puro, client: nessun accesso a Supabase, nessuna scelta
 *  automatica quando sono più di una (decide il titolare, come già deciso
 *  per `abbinaScheda` nella bulk e per la Via 1 di questa stessa commessa).
 *
 *  `abbinamento-numero.ts` non è ancora nell'elenco `MODULI` di prove/prove.mjs
 *  (resta di T0): per non toccare quel file si impacchetta QUI con esbuild,
 *  stesso schema già usato da `prove/fatture-dalla-chat/candidati.mjs` (T1). */
import { createRequire } from "node:module";
import { join } from "node:path";

async function impacchetta(radice, percorso) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const testo = esbuild.buildSync({
    entryPoints: [join(radice, percorso)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  }).outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(testo).toString("base64")}`);
}

const scheda = (id, nome, cognome, telefono) => ({
  id,
  user_id: "u1",
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
  data: { nome, cognome, telefono, stato: "nuovo" },
});

export async function prove(_mod, { c, gruppo, radice }) {
  const K = await impacchetta(radice, "src/crm/fatture/dalla-chat/abbinamento-numero.ts");

  const mario = scheda("lead-mario", "Mario", "Rossi", "+39 333 000 1111");
  const anna = scheda("lead-anna", "Anna", "Bianchi", "348 222 3333");
  const leads = [mario, anna];

  gruppo("DALLA CHAT · T12 · schedePerNumero: zero, una, N schede");
  c(
    "zero schede per un numero che non combacia con nessuna",
    [],
    K.schedePerNumero(leads, "320 999 8888"),
  );
  c(
    "una sola scheda per un numero che combacia esattamente",
    [mario],
    K.schedePerNumero(leads, "+39 333 000 1111"),
  );
  c(
    "lo stesso numero scritto senza «+39» e senza spazi trova la stessa scheda",
    [mario],
    K.schedePerNumero(leads, "3330001111"),
  );
  c(
    "un prefisso diverso ma le stesse ultime 9 cifre combacia comunque (ultime 9 cifre, non il numero intero)",
    [mario],
    K.schedePerNumero(leads, "0039 333 000 1111"),
  );

  gruppo(
    "DALLA CHAT · T12 · più schede con lo stesso numero (madre/figlia): nessuna scelta automatica",
  );
  const madre = scheda("lead-madre", "Giulia", "Verdi", "347 555 2222");
  const figlia = scheda("lead-figlia", "Sara", "Verdi", "347 555 2222");
  const famiglia = [madre, figlia, mario];
  c(
    "due schede con lo stesso numero → tornano ENTRAMBE, nell'ordine dato, nessuna preferita",
    [madre, figlia],
    K.schedePerNumero(famiglia, "347 555 2222"),
  );

  gruppo("DALLA CHAT · T12 · casi limite");
  c("numero vuoto → nessuna scheda (mai «combacia con tutte»)", [], K.schedePerNumero(leads, ""));
  c(
    "numero troppo corto (meno di 9 cifre) → nessuna scheda, non un abbinamento per difetto",
    [],
    K.schedePerNumero(leads, "12345"),
  );
  c("elenco di schede vuoto → nessuna scheda", [], K.schedePerNumero([], "+39 333 000 1111"));
  c(
    "una scheda senza telefono (dato mancante) non combacia con nessun numero",
    [],
    K.schedePerNumero([scheda("lead-senza-tel", "Bruno", "Neri", "")], "+39 333 000 1111"),
  );

  gruppo("DALLA CHAT · T12 · nessuna logica di confronto reimportata/duplicata da altrove");
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(
    join(radice, "src/crm/fatture/dalla-chat/abbinamento-numero.ts"),
    "utf8",
  );
  const righeImport = src.split("\n").filter((riga) => /^\s*import\b/.test(riga));
  c(
    "il file è puro: la sola riga import è il tipo Lead, nessuna riga importa Supabase o un file .server",
    [true, false, false],
    [
      righeImport.every((r) => /from ["']\.\.\/\.\.\/types["']/.test(r)),
      righeImport.some((r) => /supabase/i.test(r)),
      righeImport.some((r) => /\.server["']/.test(r)),
    ],
  );
}
