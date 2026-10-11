#!/usr/bin/env node
/** ── ESPORTA TUTTO IN UNA CARTELLA SOLA ────────────────────────────────────
 *
 *  Richiesta del committente: «esporta tutto il programma così che posso
 *  importarlo su un'altra chat e database».
 *
 *  Dal gestionale i quattro pezzi si scaricano uno per uno (Impostazioni →
 *  Dati → «Porta via tutto»). Questo strumento fa la stessa cosa in un colpo e
 *  da riga di comando: un unico pacchetto, pronto da consegnare a un'altra
 *  persona, a un altro programma o a un'altra conversazione.
 *
 *  Dentro ci finisce:
 *    programma/sorgente-<commit>.zip   la sorgente versionata (git archive)
 *    dati/copia-completa.json          tutto l'archivio, nella stessa forma
 *                                      che «Carica una copia» sa rimettere dentro
 *    file/elenco-file.json             i file caricati, con un collegamento
 *    file/scarica-i-file.sh            due righe per scaricarli tutti
 *    COME-INSTALLARLO-ALTROVE.md       le istruzioni di installazione
 *    PER-UNA-NUOVA-CHAT.md             com'è fatto il programma, per chi lo
 *                                      prende in mano senza averlo mai visto
 *    LEGGIMI.txt                       che cos'è questo pacchetto, in dieci righe
 *
 *  ⚠️ LE SEZIONI NON SONO SCRITTE QUI: si leggono da crm/copia-sezioni, lo
 *   stesso elenco che usa il gestionale. Due elenchi in due posti sono due
 *   copie che un giorno contengono cose diverse, e la differenza si scopre il
 *   giorno in cui si rimette dentro un archivio.
 *  ⚠️ LE CREDENZIALI NON ESCONO: le colonne e le chiavi riservate si tolgono
 *   con le stesse regole del gestionale (`esportabile`). Questo pacchetto è
 *   fatto per essere consegnato a qualcun altro.
 *  ⚠️ I FILE VERI NON CI SONO DENTRO: le registrazioni da sole sono gigabyte.
 *   C'è l'elenco con i collegamenti e lo script che li scarica.
 *
 *  Uso:  npm run esporta
 *  ───────────────────────────────────────────────────────────────────────── */
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

/*  ── ⚠️ QUANTO VALGONO I COLLEGAMENTI AI FILE ─────────────────────────────
    Ogni collegamento firmato È un permesso: chi ce l'ha scarica quel file
    senza entrare da nessuna parte, finché non scade. Dentro ci sono le
    REGISTRAZIONI delle consulenze e i documenti dei clienti.
    Perciò il valore di serie è corto — due giorni, il tempo di consegnare il
    pacchetto — e si allunga solo chiedendolo: `npm run esporta -- --giorni=7`.
    Era una settimana per tutti, ed è la cosa che il controllo di sicurezza ha
    segnalato per prima. */
const GIORNI_MAX = 7;
const giorniChiesti = Number((process.argv.find((a) => a.startsWith("--giorni=")) || "").split("=")[1]);
const GIORNI = Math.min(GIORNI_MAX, Math.max(1, Number.isFinite(giorniChiesti) ? giorniChiesti : 2));
const DURATA_COLLEGAMENTI = GIORNI * 24 * 3600;

function ambiente() {
  const out = {};
  if (!existsSync(".env")) return out;
  for (const riga of readFileSync(".env", "utf8").split("\n")) {
    const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** L'elenco delle sezioni sta in TypeScript: lo si impacchetta al volo, come
 *  fanno le prove (prove/prove.mjs), così non si scrive due volte. */
function leggiSezioni() {
  const dove = join(tmpdir(), `copia-sezioni-${Date.now()}.cjs`);
  execFileSync("npx", ["esbuild", "src/crm/copia-sezioni.ts", "--bundle", "--platform=node", "--format=cjs", `--outfile=${dove}`], { stdio: "pipe" });
  const mod = createRequire(import.meta.url)(dove);
  rmSync(dove, { force: true });
  return mod;
}

const chiediDb = async (url, key, percorso) =>
  fetch(`${url}/rest/v1/${percorso}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });

/** Una tabella INTERA, a pagine. ⚠️ Senza pagine PostgREST si ferma a mille
 *  righe e sembra andata bene: una copia che si ferma a mille righe è peggio di
 *  nessuna copia, perché uno ci conta sopra. */
async function leggiTutto(url, key, tabella, colonne, ordine) {
  const PAGINA = 1000;
  const fuori = [];
  for (let da = 0; da < 200000; da += PAGINA) {
    const r = await chiediDb(url, key, `${tabella}?select=${encodeURIComponent(colonne)}&order=${encodeURIComponent(ordine)}.asc&limit=${PAGINA}&offset=${da}`);
    if (!r.ok) throw new Error(`${tabella}: ${r.status} ${await r.text().catch(() => "")}`);
    const parte = await r.json();
    fuori.push(...parte);
    if (parte.length < PAGINA) break;
  }
  return fuori;
}

const senzaColonne = (riga, riservate) => {
  if (!riservate?.length) return riga;
  const c = { ...riga };
  for (const k of riservate) delete c[k];
  return c;
};

async function esporta() {
  const env = ambiente();
  const url = (env.SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("mancano SUPABASE_URL o la chiave di servizio in .env");

  const { SEZIONI, FUORI, esportabile } = leggiSezioni();
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const oggi = new Date();
  const stampa = oggi.toISOString().slice(0, 10);
  const base = join(homedir(), "Downloads", `hair-genius-tutto-${stampa}`);
  for (const c of ["programma", "dati", "file"]) mkdirSync(join(base, c), { recursive: true });

  //  ── 1. IL PROGRAMMA ────────────────────────────────────────────────────
  const sporco = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).split("\n").filter(Boolean).length;
  if (sporco) console.warn(`→ ⚠️  ${sporco} file non salvati in git: NON finiscono nella sorgente esportata.`);
  const zip = execFileSync("git", ["archive", "--format=zip", "HEAD"], { maxBuffer: 256 * 1024 * 1024 });
  writeFileSync(join(base, "programma", `sorgente-${commit}.zip`), zip);
  console.log(`→ programma: sorgente-${commit}.zip (${Math.round(zip.length / 1024)} KB)`);

  //  ── 2. I DATI ──────────────────────────────────────────────────────────
  const dati = {};
  const riepilogo = [];
  for (const s of SEZIONI) {
    try {
      const righe = await leggiTutto(url, key, s.tabella, "*", s.chiave);
      dati[s.campo] = righe.map((r) => senzaColonne(r, s.colonneRiservate));
      riepilogo.push({ campo: s.campo, etichetta: s.etichetta, righe: righe.length, nota: s.nota });
    } catch (e) {
      dati[s.campo] = [];
      riepilogo.push({ campo: s.campo, etichetta: s.etichetta, righe: 0, problema: String(e?.message || e) });
    }
  }
  const tutteLeConfig = await leggiTutto(url, key, "app_config", "key,value", "key").catch(() => []);
  dati.impostazioni = tutteLeConfig.filter((r) => esportabile(String(r.key ?? "")));
  riepilogo.push({
    campo: "impostazioni",
    etichetta: "Impostazioni CRM e Meetly",
    righe: dati.impostazioni.length,
    nota: "senza PIN, token e chiavi",
  });
  const copia = {
    versione: 3,
    esportatoIl: oggi.toISOString(),
    ...dati,
    riepilogo,
    fuori: FUORI,
    conteggi: Object.fromEntries(riepilogo.map((v) => [v.campo, v.righe])),
  };
  writeFileSync(join(base, "dati", "copia-completa.json"), JSON.stringify(copia, null, 2));
  const totale = riepilogo.reduce((t, v) => t + v.righe, 0);
  console.log(`→ dati: ${riepilogo.length} sezioni, ${totale} righe`);

  //  ── 3. I FILE CARICATI ─────────────────────────────────────────────────
  const CONTENITORI = ["registrazioni", "media", "anteprime", "documenti", "prova-capelli", "copie"];
  const elenco = {};
  let quantiFile = 0;
  let byteFile = 0;
  for (const c of CONTENITORI) {
    const dentro = [];
    const cerca = async (prefisso, profondita) => {
      if (profondita > 3) return;
      for (let da = 0; ; da += 100) {
        const r = await fetch(`${url}/storage/v1/object/list/${c}`, {
          method: "POST",
          headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: prefisso, limit: 100, offset: da }),
        });
        if (!r.ok) return;
        const parte = await r.json();
        if (!Array.isArray(parte) || !parte.length) return;
        for (const o of parte) {
          const nome = String(o?.name || "");
          if (!nome) continue;
          const percorso = prefisso ? `${prefisso}/${nome}` : nome;
          if (!o.id) await cerca(percorso, profondita + 1);
          else dentro.push({ percorso, byte: Number(o.metadata?.size || 0), quando: o.updated_at || "" });
        }
        if (parte.length < 100) return;
      }
    };
    await cerca("", 0).catch(() => {});
    if (!dentro.length) continue;
    //  Il collegamento si firma per una settimana: il tempo di consegnare il
    //  pacchetto e di scaricarlo dall'altra parte.
    const firmati = [];
    for (const f of dentro) {
      const r = await fetch(`${url}/storage/v1/object/sign/${c}/${f.percorso}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: DURATA_COLLEGAMENTI }),
      });
      const j = r.ok ? await r.json() : {};
      firmati.push({ ...f, url: j?.signedURL ? `${url}/storage/v1${j.signedURL}` : "" });
    }
    quantiFile += firmati.length;
    byteFile += firmati.reduce((t, f) => t + f.byte, 0);
    elenco[c] = firmati;
  }
  writeFileSync(
    join(base, "file", "elenco-file.json"),
    JSON.stringify(
      {
        //  ⚠️ Scritto DENTRO il file, non solo nel foglio: questo elenco può
        //   essere inoltrato da solo, e chi se lo ritrova in mano deve sapere
        //   che cosa sta tenendo.
        attenzione:
          "Ogni collegamento qui dentro apre il file SENZA password, fino alla scadenza. Dentro ci sono registrazioni di consulenze e documenti di clienti: non mandare questo file su canali che non controlli.",
        quando: oggi.toISOString(),
        scadenza: `${GIORNI} giorni`,
        quanti: quantiFile,
        byte: byteFile,
        contenitori: elenco,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(base, "file", "scarica-i-file.sh"),
    `#!/bin/sh\n# Scarica tutti i file elencati in elenco-file.json dentro ./scaricati/\n# I collegamenti scadono 7 giorni dopo l'esportazione.\njq -r '.contenitori | to_entries[] | .key as $c | .value[] | [$c + "/" + .percorso, .url] | @tsv' elenco-file.json |\\\n  while IFS="\\t" read -r p u; do\n    [ -z "$u" ] && continue\n    mkdir -p "scaricati/$(dirname "$p")"\n    curl -sL "$u" -o "scaricati/$p"\n  done\n`,
  );
  console.log(`→ file: ${quantiFile} file elencati (${Math.round(byteFile / 1048576)} MB), collegamenti validi ${GIORNI} giorni`);

  //  ── 4. I FOGLI ─────────────────────────────────────────────────────────
  copyFileSync("docs/CLONARE.md", join(base, "COME-INSTALLARLO-ALTROVE.md"));
  if (existsSync("docs/PER-UNA-NUOVA-CHAT.md")) copyFileSync("docs/PER-UNA-NUOVA-CHAT.md", join(base, "PER-UNA-NUOVA-CHAT.md"));
  writeFileSync(
    join(base, "LEGGIMI.txt"),
    [
      `PACCHETTO COMPLETO — Hair Genius Labs (CRM + Meetly)`,
      `esportato il ${oggi.toLocaleString("it-IT")} · versione del programma: ${commit}`,
      ``,
      `  programma/sorgente-${commit}.zip   il programma, leggibile e completo`,
      `  dati/copia-completa.json           ${totale} righe, ${riepilogo.length} sezioni`,
      `  file/elenco-file.json              ${quantiFile} file caricati, con i collegamenti (7 giorni)`,
      `  file/scarica-i-file.sh             li scarica tutti`,
      `  COME-INSTALLARLO-ALTROVE.md        installazione, passo per passo`,
      `  PER-UNA-NUOVA-CHAT.md              com'è fatto dentro, per chi lo prende in mano`,
      ``,
      `NON c'è dentro, apposta: nessun PIN, token, chiave o password. Si rifanno`,
      `sul sistema nuovo (è scritto nelle istruzioni).`,
      ``,
      `⚠️ MA DENTRO CI SONO I DATI DELLE PERSONE. Nomi, telefoni e indirizzi dei`,
      `   clienti (${(dati.leads || []).length} schede), i preventivi, le fatture — e ${quantiFile} collegamenti che`,
      `   aprono registrazioni e documenti SENZA password per ${GIORNI} giorni.`,
      `   Trattalo come tratteresti l'archivio di carta del centro: consegnalo a`,
      `   mano o su un canale tuo, e cancellalo quando non serve più.`,
      ``,
      `Per rimettere i dati: gestionale nuovo → Impostazioni → Dati → «Carica una`,
      `copia» → scegli dati/copia-completa.json. Prima falla girare in prova.`,
    ].join("\n"),
  );

  //  ── 5. UN FILE SOLO DA CONSEGNARE ──────────────────────────────────────
  const unico = `${base}.zip`;
  rmSync(unico, { force: true });
  execFileSync("zip", ["-qr", unico, base.split("/").pop()], { cwd: join(homedir(), "Downloads") });
  //  Solo il proprietario può leggerlo: su un computer condiviso è l'unica
  //  riga che impedisce a un altro utente di aprirlo.
  for (const f of [unico, join(base, "dati", "copia-completa.json"), join(base, "file", "elenco-file.json")]) {
    try { chmodSync(f, 0o600); } catch { /* su qualche filesystem non si può */ }
  }
  console.log(`\n✓ pronto: ${unico}`);
  console.log(`  (la cartella aperta sta in ${base})`);
  console.log(
    `\n⚠️  Dentro ci sono i dati delle persone (${(dati.leads || []).length} schede) e ${quantiFile} collegamenti che aprono\n` +
      `   registrazioni e documenti senza password per ${GIORNI} giorni. Consegnalo a mano, e cancellalo quando non serve più.`,
  );
  return unico;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  esporta().catch((e) => {
    console.error("✖ esportazione non riuscita:", e?.message || e);
    process.exit(1);
  });
}
