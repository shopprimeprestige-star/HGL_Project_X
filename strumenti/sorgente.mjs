#!/usr/bin/env node
/** ── LA SORGENTE DEL PROGRAMMA, SCARICABILE DAL GESTIONALE ─────────────────
 *
 *  Richiesta del committente: «fai che posso scaricare tutto il sito, i lead,
 *  il funzionamento, il software Meetly, tutto il database e il sito web, per
 *  clonarlo e installarlo su un altro database/hosting: il 100% di tutto,
 *  proprio la sorgente di tutto».
 *
 *  ── PERCHÉ SERVE QUESTO PEZZO ────────────────────────────────────────────
 *  I DATI il gestionale li sa già dare (Impostazioni → Dati → «Scarica una
 *  copia»). Il PROGRAMMA no, e non può: quello che gira su Cloudflare è la
 *  COSTRUZIONE — pezzi di codice rimpiccioliti, con i nomi accorciati, senza
 *  commenti — non il programma leggibile. Da lì non si torna indietro, quindi
 *  nessun pulsante dentro al sito potrà mai tirare fuori la sorgente da solo:
 *  bisogna depositarcela quando la si ha in mano, cioè QUI, nel momento in cui
 *  si pubblica.
 *
 *  Questo strumento prende la sorgente vera — `git archive`, cioè esattamente
 *  i file versionati, com'erano nel momento della pubblicazione — e la
 *  deposita in un contenitore PRIVATO accanto alle copie dei dati. Il
 *  gestionale poi la consegna a chi ha il permesso (api.crm.sorgente).
 *
 *  ⚠️ `git archive` E NON UNA COPIA DELLA CARTELLA. Prende solo ciò che è
 *   versionato: niente `node_modules` (300 MB che si riscaricano da soli),
 *   niente `dist`, niente `.storico-assets` — e soprattutto NIENTE `.env`, che
 *   non è versionato apposta. Una sorgente con dentro le chiavi del database
 *   sarebbe una fuga di dati travestita da copia di sicurezza.
 *  ⚠️ SE QUESTO PASSO FALLISCE, LA PUBBLICAZIONE VA AVANTI LO STESSO. Un
 *   deposito non riuscito è una copia in meno, non un sito che non si
 *   aggiorna: si avvisa e si tira dritto.
 *  ⚠️ SE NE TENGONO POCHE (`QUANTE`): sono 6 MB l'una e servono a portarsi via
 *   il programma, non a fare la storia di ogni pubblicazione — quella sta in
 *   git.
 *
 *  Uso:  node strumenti/sorgente.mjs        (lo chiama anche `npm run pubblica`)
 *  ───────────────────────────────────────────────────────────────────────── */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CONTENITORE = "sorgente";
const QUANTE = 5;
const CHIAVE_ULTIMA = "sorgente_ultima";

/** Le chiavi del database stanno in `.env`, che non è versionato. */
function ambiente() {
  const out = {};
  if (!existsSync(".env")) return out;
  for (const riga of readFileSync(".env", "utf8").split("\n")) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();

export async function depositaSorgente() {
  const env = ambiente();
  const url = (env.SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    console.warn("→ sorgente NON depositata: mancano SUPABASE_URL o la chiave di servizio in .env");
    return null;
  }

  const commit = git(["rev-parse", "--short", "HEAD"]);
  const ramo = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  /*  ── ⚠️ QUELLO CHE NON È STATO SALVATO IN GIT NON C'È DENTRO ──────────
      Trovato scaricando l'archivio e confrontandolo: la pubblicazione si fa
      PRIMA del salvataggio in git, quindi l'archivio depositato era di un
      commit indietro — gli mancava proprio il lavoro appena pubblicato.
      Non si può archiviare il non salvato (un archivio che non corrisponde a
      nessuna versione è peggio di uno vecchio), ma TACERLO sì che è un
      guaio: chi scarica si ritrova un programma che non è quello online e non
      ha modo di accorgersene. Quindi si dice, e si dice cosa fare. */
  const sporco = git(["status", "--porcelain"]).split("\n").filter(Boolean).length;
  if (sporco)
    console.warn(
      `→ ⚠️  ${sporco} file modificati e non salvati in git: NON finiscono nell'archivio.\n` +
        "   L'archivio corrisponde all'ultimo commit. Salva e rilancia `npm run sorgente` per depositare anche questi.",
    );
  //  ⚠️ L'archivio si fa da HEAD, cioè dal commit: quello che non è stato
  //   ancora salvato in git NON ci finisce dentro, ed è giusto così — la
  //   sorgente depositata deve corrispondere a una versione che esiste.
  const zip = execFileSync("git", ["archive", "--format=zip", "HEAD"], {
    maxBuffer: 256 * 1024 * 1024,
  });
  const quando = new Date();
  const stampa = quando.toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const nome = `sorgente-${stampa}-${commit}.zip`;

  const chiama = (percorso, opzioni = {}) =>
    fetch(`${url}/storage/v1/${percorso}`, {
      ...opzioni,
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        ...(opzioni.headers || {}),
      },
    });

  //  Il contenitore è PRIVATO: la sorgente si consegna solo a chi entra nel
  //  gestionale, con un collegamento che scade.
  await chiama("bucket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: CONTENITORE, id: CONTENITORE, public: false }),
  }).catch(() => {});

  const su = await chiama(`object/${CONTENITORE}/${nome}`, {
    method: "POST",
    headers: { "Content-Type": "application/zip", "x-upsert": "true" },
    body: zip,
  });
  if (!su.ok) {
    console.warn(`→ sorgente NON depositata: ${su.status} ${await su.text().catch(() => "")}`);
    return null;
  }

  //  La riga che dice QUAL È L'ULTIMA: il gestionale la legge senza dover
  //  elencare il contenitore (una lettura invece di una ricerca).
  await fetch(`${url}/rest/v1/app_config`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      key: CHIAVE_ULTIMA,
      value: JSON.stringify({ nome, byte: zip.length, commit, ramo, quando: quando.toISOString() }),
      updated_at: quando.toISOString(),
    }),
  }).catch(() => {});

  //  Si tengono le ultime: 6 MB l'una, e la storia vera sta in git.
  try {
    const elenco = await chiama(`object/list/${CONTENITORE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 100, sortBy: { column: "name", order: "desc" } }),
    }).then((r) => (r.ok ? r.json() : []));
    const vecchie = (Array.isArray(elenco) ? elenco : [])
      .map((o) => String(o?.name || ""))
      .filter((n) => n.startsWith("sorgente-"))
      .sort()
      .reverse()
      .slice(QUANTE);
    if (vecchie.length)
      await chiama(`object/${CONTENITORE}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: vecchie }),
      });
    console.log(
      `→ sorgente depositata: ${nome} (${Math.round(zip.length / 1024)} KB)` +
        (vecchie.length ? ` · tolte le ${vecchie.length} più vecchie` : ""),
    );
  } catch {
    console.log(`→ sorgente depositata: ${nome} (${Math.round(zip.length / 1024)} KB)`);
  }
  return nome;
}

//  Eseguito da solo: `node strumenti/sorgente.mjs`
//  ⚠️ Il confronto passa da `resolve`: chiamandolo con un percorso relativo
//   (`node strumenti/sorgente.mjs`) `process.argv[1]` è relativo, il confronto
//   con l'indirizzo del modulo non torna mai, e il programma finiva senza fare
//   niente e senza dire niente.
if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  depositaSorgente().catch((e) => {
    console.warn("→ sorgente NON depositata:", e?.message || e);
  });
}
