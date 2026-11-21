/** ── NEGOZIO · RILASCIO 2 · T40 · I CONTI DEGLI ORDINI VECCHI NON CAMBIANO ─────────────────────────────
 *  SPEC 8A n. 7: «ordini R1/R2 come prima, stesse cifre». La prova è una FOTOGRAFIA: le uscite di `panoramica`, `daLavorare`,
 *  `ordiniFermi`, `andamento`, `piuVenduti`, `raggruppaClienti`, `riacquisto` e `normalizzaTutti` (più `importoFuoriNorma`) su 40 ordini
 *  inventati (`_dati-r2.mjs`), prese dal codice di `src/crm/ecommerce/` così com'era al commit 46cf8d5, PRIMA che il Rilascio 2 lo toccasse.
 *  Sta in `_conti-oro.json`, in DUE forme: con le colonne di S4 ASSENTI (oggi) e con i loro default (la forma reale dopo la migrazione:
 *  `prova=false`, `rimborsato_cent=0`, `stato_pagamento` vuoto…). Il codice nuovo deve dare le stesse cifre in tutte e due.
 *
 *  Il confronto è «il vecchio è contenuto nel nuovo»: ogni campo che c'era c'è ancora ed è uguale; i campi NUOVI (T46 aggiunge `inAttesa`, `prova`…)
 *  sono ammessi. Una cifra cambiata, una riga in più o in meno, un ordine diverso nell'elenco: rosso.
 *
 *  ⚠️ COME NON SI AGGIORNA INSIEME AL CODICE
 *   · la fotografia non si rigenera con un interruttore: `HASH_ORO` qui sotto è l'impronta SHA-256 del file, scritta anche in Lavagna da T40;
 *     toccare il file senza toccare questa riga è rosso, e toccare questa riga è un file fuori dall'elenco del compito (il revisore respinge);
 *   · anche i dati di partenza hanno la loro impronta DENTRO la fotografia: cambiare un ordine inventato è rosso.
 *  ⚠️ COME SI RIFÀ (il revisore, da un checkout pulito di 46cf8d5 con questi file copiati sopra):
 *        node prove/negozio/conti-invariati.mjs > /tmp/oro.json && shasum -a 256 /tmp/oro.json
 *     Lo strumento IMPACCHETTA il codice di `src/crm/ecommerce/{ordine,conti}.ts` com'è sul disco, rifiuta di generare se quei file non sono
 *     identici a 46cf8d5 (`git diff`), e STAMPA: non scrive niente. Il fuso è fissato (Europe/Rome): periodi e giorni dell'andamento sono giorni locali. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ordiniR1R2, conDefaultS4, righeSporche, canonicoJson, PERIODI_FOTO, principaleFoto, ADESSO_FOTO, FUSO_FOTO } from "./_dati-r2.mjs";

const BASE = "46cf8d5";
/** L'impronta SHA-256 di `_conti-oro.json` (scritta anche in Lavagna). Non si cambia insieme al file. */
export const HASH_ORO = "a694a180508a6536986e221a581b8133a38b47ff2d7057edc3f2d1cb34213370";
const sha256 = (x) => createHash("sha256").update(x).digest("hex");

/** Esegue `f` con il fuso della fotografia e rimette quello di prima. */
function conFuso(f) {
  const prima = process.env.TZ;
  process.env.TZ = FUSO_FOTO;
  try { return f(); } finally { if (prima === undefined) delete process.env.TZ; else process.env.TZ = prima; }
}

/** Le uscite delle funzioni dei conti su un elenco di righe di `shop_orders`. `O` = ordine.ts, `K` = conti.ts. */
export function fotografia({ O, K }, righe) {
  const { ordini, scartati } = O.normalizzaTutti(righe);
  const adesso = new Date(ADESSO_FOTO);
  const P = PERIODI_FOTO;
  const per = (f) => Object.fromEntries(Object.entries(P).map(([nome, p]) => [nome, f(p)]));
  const uscite = {
    normalizzaTutti: { ordini, scartati },
    nelPeriodo: per((p) => ordini.filter((o) => K.nelPeriodo(o, p)).map((o) => o.id)),
    panoramica: per((p) => K.panoramica(ordini, p)),
    daLavorare: K.daLavorare(ordini),
    ordiniFermi: { ore48: K.ordiniFermi(ordini, adesso).map((o) => o.id), ore24: K.ordiniFermi(ordini, adesso, 24).map((o) => o.id), ore0: K.ordiniFermi(ordini, adesso, 0).map((o) => o.id), ore720: K.ordiniFermi(ordini, adesso, 720).map((o) => o.id) },
    andamento: { novembre: K.andamento(ordini, P.novembre), settimana: K.andamento(ordini, P.settimana), tutto: K.andamento(ordini, P.tutto), capovolto: K.andamento(ordini, P.capovolto) },
    piuVenduti: { tutto: K.piuVenduti(ordini, P.tutto), novembre: K.piuVenduti(ordini, P.novembre), settimana: K.piuVenduti(ordini, P.settimana), tutto_primi3: K.piuVenduti(ordini, P.tutto, 3), vuoto: K.piuVenduti(ordini, P.vuoto) },
    raggruppaClienti: { semplice: K.raggruppaClienti(ordini), conPrincipale: K.raggruppaClienti(ordini, principaleFoto) },
    riacquisto: { tutto: K.riacquisto(ordini, P.tutto), novembre: K.riacquisto(ordini, P.novembre), settimana: K.riacquisto(ordini, P.settimana), vuoto: K.riacquisto(ordini, P.vuoto), conPrincipale: K.riacquisto(ordini, P.tutto, principaleFoto) },
    importoFuoriNorma: ordini.filter((o) => K.importoFuoriNorma(o)).map((o) => o.id),
    totaleCoerente: ordini.filter((o) => !O.totaleCoerente(o)).map((o) => o.id),
  };
  return JSON.parse(JSON.stringify(uscite)); // la forma del file: niente `undefined`, niente classi
}
/** I numeri non finiti sarebbero diventati `null` nel file: una fotografia con un NaN dentro non è una fotografia. */
function tutteFinite(x) {
  if (typeof x === "number") return Number.isFinite(x);
  if (Array.isArray(x)) return x.every(tutteFinite);
  if (x && typeof x === "object") return Object.values(x).every(tutteFinite);
  return true;
}

/** L'intero contenuto di `_conti-oro.json`, dal codice che gli viene passato. */
export function costruisciOro(mod) {
  return conFuso(() => {
    const assenti = ordiniR1R2();
    const s4 = assenti.map(conDefaultS4);
    const sporche = righeSporche();
    const forme = { colonne_assenti: fotografia(mod, assenti), default_s4: fotografia(mod, s4) };
    if (!tutteFinite(mod.O.normalizzaTutti(assenti).ordini) || !tutteFinite(mod.K.panoramica(mod.O.normalizzaTutti(assenti).ordini, PERIODI_FOTO.tutto))) throw new Error("un numero non finito nella fotografia");
    return {
      descrizione: `Fotografia dei conti dell'e-commerce al commit ${BASE}, PRIMA del Rilascio 2 (PIANO-R2, T40). Non si rigenera insieme al codice: vedi prove/negozio/conti-invariati.mjs.`,
      base: BASE,
      fuso: FUSO_FOTO,
      adesso: ADESSO_FOTO,
      ingressi: { colonne_assenti: sha256(canonicoJson(assenti)), default_s4: sha256(canonicoJson(s4)), righe_sporche: sha256(canonicoJson(sporche)) },
      forme,
      sporche: JSON.parse(JSON.stringify(mod.O.normalizzaTutti(sporche))),
    };
  });
}

// ── il confronto: il vecchio è contenuto nel nuovo ──
/** La prima differenza fra ciò che c'era (`atteso`) e ciò che c'è (`letto`): il percorso e i due valori, o `null` se il vecchio è tutto lì. */
export function primaDifferenza(atteso, letto, percorso = "") {
  if (atteso === null || typeof atteso !== "object") return Object.is(atteso, letto) || (typeof atteso === "number" && typeof letto === "number" && Math.abs(atteso - letto) < 1e-9) ? null : `${percorso || "·"}: era ${JSON.stringify(atteso)}, ora ${JSON.stringify(letto)}`;
  if (Array.isArray(atteso)) {
    if (!Array.isArray(letto)) return `${percorso}: era una lista, ora ${JSON.stringify(letto)?.slice(0, 60)}`;
    if (letto.length !== atteso.length) return `${percorso}: erano ${atteso.length} elementi, ora ${letto.length}`;
    for (let i = 0; i < atteso.length; i++) { const d = primaDifferenza(atteso[i], letto[i], `${percorso}[${i}]`); if (d) return d; }
    return null;
  }
  if (letto === null || typeof letto !== "object" || Array.isArray(letto)) return `${percorso}: era un oggetto, ora ${JSON.stringify(letto)?.slice(0, 60)}`;
  for (const k of Object.keys(atteso)) { const d = primaDifferenza(atteso[k], letto[k], `${percorso}.${k}`); if (d) return d; }
  return null;
}

export async function prove(mod, { c, gruppo, radice }) {
  const oro = JSON.parse(readFileSync(join(radice, "prove/negozio/_conti-oro.json"), "utf8"));
  const O = mod["ecommerce/ordine"];
  const K = mod["ecommerce/conti"];

  gruppo("NEGOZIO R2 · I CONTI DEGLI ORDINI VECCHI NON CAMBIANO (fotografia di 46cf8d5)");

  // ── il file e i dati sono quelli fotografati ──
  c("la fotografia è quella di T40: l'impronta del file è `HASH_ORO` (la stessa scritta in Lavagna)", HASH_ORO, sha256(readFileSync(join(radice, "prove/negozio/_conti-oro.json"))));
  c("la fotografia dichiara da dove viene: commit 46cf8d5 e fuso Europe/Rome", [BASE, FUSO_FOTO], [oro.base, oro.fuso]);
  const assenti = ordiniR1R2();
  const s4 = assenti.map(conDefaultS4);
  c("i dati di partenza non sono cambiati (impronte dei 40 ordini nelle due forme e delle righe sporche)", oro.ingressi, { colonne_assenti: sha256(canonicoJson(assenti)), default_s4: sha256(canonicoJson(s4)), righe_sporche: sha256(canonicoJson(righeSporche())) });
  c("40 ordini, la seconda forma ha le colonne di S4 e la prima no", [40, false, true], [assenti.length, "stato_pagamento" in assenti[0], s4.every((r) => r.stato_pagamento === null && r.prova === false && r.rimborsato_cent === 0)]);
  const dettaglio = oro.forme.colonne_assenti;
  c("le due forme della fotografia sono IDENTICHE (il codice di 46cf8d5 ignorava le colonne che non conosce): le cifre dopo la migrazione sono quelle di oggi", null, primaDifferenza(oro.forme.colonne_assenti, oro.forme.default_s4) ?? primaDifferenza(oro.forme.default_s4, oro.forme.colonne_assenti));
  // la fotografia non è vuota: dentro ci sono i casi che il codice nuovo potrebbe rompere
  c("la fotografia contiene i casi veri: ordini di ogni stato, incassati e no, importi anomali, fermi, clienti che tornano, righe scartate",
    [40, 0, true, true, true, true, true, true, 8],
    [dettaglio.normalizzaTutti.ordini.length, dettaglio.normalizzaTutti.scartati, dettaglio.panoramica.tutto.incassato.n > 5 && dettaglio.panoramica.tutto.daIncassare.n > 5, dettaglio.panoramica.tutto.annullatiPagati > 0,
      dettaglio.panoramica.tutto.importiAnomali >= 3, dettaglio.ordiniFermi.ore48.length > 0 && dettaglio.daLavorare > 0, dettaglio.riacquisto.tutto.tornati > 0 && dettaglio.raggruppaClienti.semplice.length < 40, dettaglio.piuVenduti.tutto.length === 6, oro.sporche.scartati]);
  c("l'andamento di novembre ha un elemento per giorno (30) e i più venduti sono al massimo 10", [30, true], [dettaglio.andamento.novembre.length, dettaglio.piuVenduti.tutto.length <= 10]);

  // ── il codice di oggi dà le stesse cifre, in tutte e due le forme ──
  const oggi = conFuso(() => ({ colonne_assenti: fotografia({ O, K }, assenti), default_s4: fotografia({ O, K }, s4), sporche: JSON.parse(JSON.stringify(O.normalizzaTutti(righeSporche()))) }));
  for (const forma of ["colonne_assenti", "default_s4"]) {
    for (const sezione of Object.keys(oro.forme[forma])) c(`${forma}: ${sezione}`, null, primaDifferenza(oro.forme[forma][sezione], oggi[forma][sezione]));
  }
  c("le righe che non si leggono sono ancora scartate e contate (8), la buona resta", null, primaDifferenza(oro.sporche, oggi.sporche));

  // ── la prova di questa prova: se una cifra cambia, il confronto se ne accorge ──
  const copia = structuredClone(oro.forme.colonne_assenti);
  copia.panoramica.tutto.incassato.importo += 0.01;
  c("un centesimo di «Incassato» in più è visto", true, primaDifferenza(oro.forme.colonne_assenti, copia) !== null);
  const meno = structuredClone(oro.forme.colonne_assenti);
  meno.normalizzaTutti.ordini.pop();
  c("un ordine in meno è visto", true, primaDifferenza(oro.forme.colonne_assenti, meno) !== null);
  const scambiati = structuredClone(oro.forme.colonne_assenti);
  scambiati.ordiniFermi.ore48.reverse();
  c("un elenco in un altro ordine è visto", true, primaDifferenza(oro.forme.colonne_assenti, scambiati) !== null);
  const mancante = structuredClone(oro.forme.colonne_assenti);
  delete mancante.panoramica.tutto.perStato;
  c("un campo che sparisce è visto; un campo NUOVO (come `inAttesa` di T46) è ammesso", [true, null], [primaDifferenza(oro.forme.colonne_assenti, mancante) !== null, primaDifferenza(oro.forme.colonne_assenti, { ...structuredClone(oro.forme.colonne_assenti), extra: 1, panoramica: Object.fromEntries(Object.entries(oro.forme.colonne_assenti.panoramica).map(([k, v]) => [k, { ...v, inAttesa: { n: 0 } }])) })]);
}

// ── lo strumento: `node prove/negozio/conti-invariati.mjs > oro.json` ──
async function genera() {
  const radice = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const git = (...a) => execFileSync("git", ["-C", radice, ...a], { encoding: "utf8" });
  try { git("rev-parse", "--verify", `${BASE}^{commit}`); } catch { throw new Error(`il commit ${BASE} non c'è in questo repository: la fotografia si prende da lì`); }
  if (git("status", "--porcelain", "--", "src/crm/ecommerce").trim() || git("diff", "--name-only", BASE, "--", "src/crm/ecommerce").trim()) {
    throw new Error(`src/crm/ecommerce non è com'era a ${BASE}: la fotografia si prende SOLO dal codice di prima del Rilascio 2`);
  }
  const { build } = await import("esbuild");
  const cartella = mkdtempSync(join(tmpdir(), "conti-oro-"));
  try {
    for (const nome of ["ordine", "conti"]) {
      await build({ entryPoints: [join(radice, "src/crm/ecommerce", `${nome}.ts`)], bundle: true, format: "cjs", platform: "node", outfile: join(cartella, `${nome}.cjs`), logLevel: "error", alias: { "@": join(radice, "src") } });
    }
    const chiedi = createRequire(import.meta.url);
    const oro = costruisciOro({ O: chiedi(join(cartella, "ordine.cjs")), K: chiedi(join(cartella, "conti.cjs")) });
    process.stdout.write(`${JSON.stringify(oro, null, 2)}\n`);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  genera().catch((e) => { console.error(e.message); process.exit(1); });
}
