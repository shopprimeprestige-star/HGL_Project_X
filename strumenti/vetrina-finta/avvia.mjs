#!/usr/bin/env node
/** ── VETRINA FINTA · IL LANCIATORE SICURO (T75, D91) ────────────────────────────
 *  Uso:  node strumenti/vetrina-finta/avvia.mjs <scenario> [--wrangler] [--porta-app N]
 *        scenari: completo · vuoto · pochi · guasto · vecchio · stress
 *
 *  Avvia il finto Supabase (`server.mjs`, solo su 127.0.0.1) e poi l'app (`vite dev`, o `wrangler dev --local`).
 *  ⚠️ La salvaguardia sta QUI, dove l'app parte, perché il `.env` del progetto punta al database vero e la shell
 *  può avere variabili vere. Il lanciatore non può far parlare l'app con altro che il finto:
 *    1. SI FERMA se trova un `.env*` o un `.dev.vars*` nella cartella dell'app o in quella dello strumento
 *       (vite e wrangler li leggono da soli: l'unico modo sicuro è non farli esistere). Fa eccezione `.env.example`, che è nel
 *       repository e contiene solo i nomi;
 *    2. costruisce l'ambiente dell'app A ELENCO CHIUSO: `PATH`, `HOME`, `NODE_*` dalla shell, più le sole variabili che il codice
 *       legge, tutte finte. Il resto della shell (chiavi vere incluse) NON passa;
 *    3. prima di partire RIVERIFICA l'ambiente costruito: nessuna variabile fuori elenco, ogni URL è `http://127.0.0.1|localhost:<porta del
 *       finto>`, ogni chiave è quella finta, nessun valore somiglia a un indirizzo o a una chiave di Supabase.
 *  Se una di queste non torna, lancia `ErroreSalvaguardia` e l'app NON parte. I messaggi dicono il NOME della variabile, mai il valore. */
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHIAVE_FINTA, SCENARI } from "./dati.mjs";
import { avviaFinto } from "./server.mjs";

const CARTELLA_STRUMENTO = dirname(fileURLToPath(import.meta.url));
const RADICE_APP = resolve(CARTELLA_STRUMENTO, "..", "..");

export class ErroreSalvaguardia extends Error {
  constructor(messaggio) {
    super(messaggio);
    this.name = "ErroreSalvaguardia";
  }
}

/* ── 1 · i file che portano segreti ─────────────────────────────────────────── */

/** `.env`, `.env.local`, `.env.production`, `.dev.vars`, `.dev.vars.prod`…: tutto ciò che vite e wrangler leggono da soli. `.env.example` no. */
export const eFileSegreto = (nome) => {
  // macOS non distingue maiuscole e minuscole: `.ENV` è un `.env` per Vite.
  const n = nome.toLowerCase();
  return (n.startsWith(".env") && n !== ".env.example") || n.startsWith(".dev.vars");
};

/** I nomi dei file segreti trovati nelle cartelle date (`cartella/nome`); vuoto = via libera. */
export function trovaFileSegreti(cartelle) {
  return cartelle.flatMap((c) => (existsSync(c) ? readdirSync(c).filter(eFileSegreto).map((n) => join(c, n)) : []));
}

/* ── 2 · l'ambiente a elenco chiuso ─────────────────────────────────────────── */

const FORZA_CATALOGO = "cms";
const FORZA_CASSA = "vecchia";
/** Le variabili d'ambiente che il codice legge (PIANO-V1 fatto 17), tutte finte. */
const VARIABILI_URL = ["SUPABASE_URL", "VITE_SUPABASE_URL"];
const VARIABILI_CHIAVE = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"];
const VARIABILI_FORZA = { SHOP_CATALOGO_FORZA: FORZA_CATALOGO, SHOP_CASSA_FORZA: FORZA_CASSA };
const EREDITATE = ["PATH", "HOME"];
/** Un valore che somiglia a Supabase o a una sua chiave (JWT, `sb_secret_…`): non deve stare in nessuna variabile. */
const SOMIGLIA_A_VERO = /supabase\.(co|in|net)|eyJ[A-Za-z0-9_-]{8,}\.|sb_(secret|publishable)_/i;

/** L'ambiente dell'app: SOLO ciò che è nominato qui. `ereditato` è l'ambiente della shell (`process.env`). */
export function costruisciAmbiente(ereditato, urlFinto) {
  const env = {};
  for (const [nome, valore] of Object.entries(ereditato)) {
    if ((EREDITATE.includes(nome) || nome.startsWith("NODE_")) && typeof valore === "string") env[nome] = valore;
  }
  for (const nome of VARIABILI_URL) env[nome] = urlFinto;
  for (const nome of VARIABILI_CHIAVE) env[nome] = CHIAVE_FINTA;
  return Object.assign(env, VARIABILI_FORZA);
}

/** Rifà i conti sull'ambiente già costruito. Lancia `ErroreSalvaguardia` (con il NOME, mai il valore) alla prima cosa che non torna. */
export function verificaAmbiente(env, { porta } = {}) {
  const ammesse = new Set([...EREDITATE, ...VARIABILI_URL, ...VARIABILI_CHIAVE, ...Object.keys(VARIABILI_FORZA)]);
  for (const nome of Object.keys(env)) {
    if (!ammesse.has(nome) && !nome.startsWith("NODE_")) throw new ErroreSalvaguardia(`variabile fuori dall'elenco chiuso: ${nome}`);
  }
  for (const [nome, valore] of Object.entries(env)) {
    if (typeof valore !== "string") throw new ErroreSalvaguardia(`${nome} non è un testo`);
    if (SOMIGLIA_A_VERO.test(valore)) throw new ErroreSalvaguardia(`${nome} somiglia a un indirizzo o a una chiave di Supabase`);
  }
  for (const nome of VARIABILI_URL) {
    let u;
    try { u = new URL(env[nome] ?? ""); } catch { throw new ErroreSalvaguardia(`${nome} manca o non è un indirizzo`); }
    if (u.protocol !== "http:") throw new ErroreSalvaguardia(`${nome} non è http locale`);
    if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") throw new ErroreSalvaguardia(`${nome} non è un indirizzo locale`);
    if (u.username || u.password) throw new ErroreSalvaguardia(`${nome} contiene un accesso`);
    if (porta !== undefined && u.port !== String(porta)) throw new ErroreSalvaguardia(`${nome} non punta alla porta del finto`);
  }
  for (const nome of VARIABILI_CHIAVE) {
    if (env[nome] !== CHIAVE_FINTA) throw new ErroreSalvaguardia(`${nome} non è la chiave finta`);
  }
  for (const [nome, atteso] of Object.entries(VARIABILI_FORZA)) {
    if (env[nome] !== atteso) throw new ErroreSalvaguardia(`${nome} non ha il valore atteso`);
  }
}

/* ── 3 · il lancio ──────────────────────────────────────────────────────────── */

/** Il comando che avvia l'app: `vite dev` (o `wrangler dev --local` con le stesse variabili date a `--var`). */
export function comandoApp(radice, env, { wrangler, portaApp }) {
  if (!wrangler) return [process.execPath, join(radice, "node_modules", "vite", "bin", "vite.js"), "dev", "--host", "127.0.0.1", "--port", String(portaApp)];
  const variabili = Object.entries(env).filter(([n]) => !EREDITATE.includes(n) && !n.startsWith("NODE_")).flatMap(([n, v]) => ["--var", `${n}:${v}`]);
  return [process.execPath, join(radice, "node_modules", "wrangler", "bin", "wrangler.js"), "dev", "--local", "--ip", "127.0.0.1", "--port", String(portaApp), ...variabili];
}

/** Controlla, avvia il finto, costruisce e verifica l'ambiente, lancia l'app. `{ finto, figlio, ambiente, chiudi }`.
 *  `comando` (solo per le prove) sostituisce il comando dell'app: l'ambiente resta quello a elenco chiuso. `costruisci`: idem, per provare
 *  che la verifica sta fra chi costruisce e chi lancia. */
export async function avvia({
  scenario, radice = RADICE_APP, wrangler = false, portaApp = 5199, comando, ereditato = process.env, costruisci = costruisciAmbiente, stdio = "inherit",
}) {
  if (!SCENARI.includes(scenario)) throw new ErroreSalvaguardia(`scenario sconosciuto: ammessi ${SCENARI.join(", ")}`);
  const segreti = trovaFileSegreti([radice, CARTELLA_STRUMENTO]);
  if (segreti.length) {
    throw new ErroreSalvaguardia(`trovato ${segreti.join(", ")}: il lanciatore non parte con un .env* o un .dev.vars* (vite e wrangler li leggono da soli). Usa un worktree senza .env.`);
  }
  const finto = await avviaFinto({ scenario });
  try {
    const ambiente = costruisci(ereditato, finto.url);
    verificaAmbiente(ambiente, { porta: finto.porta });
    const [programma, ...argomenti] = comando ?? comandoApp(radice, ambiente, { wrangler, portaApp });
    const figlio = spawn(programma, argomenti, { cwd: radice, env: ambiente, stdio });
    const chiudi = async () => { figlio.kill(); await finto.chiudi(); };
    figlio.once("exit", () => { finto.chiudi(); });
    return { finto, figlio, ambiente, chiudi };
  } catch (e) {
    await finto.chiudi();
    throw e;
  }
}

/* ── dalla riga di comando ──────────────────────────────────────────────────── */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argomenti = process.argv.slice(2);
  const scenario = argomenti.find((a) => !a.startsWith("--"));
  const iPorta = argomenti.indexOf("--porta-app");
  const portaApp = iPorta >= 0 ? Number(argomenti[iPorta + 1]) : 5199;
  if (!scenario || !Number.isInteger(portaApp)) {
    console.error(`Uso: node strumenti/vetrina-finta/avvia.mjs <${SCENARI.join("|")}> [--wrangler] [--porta-app N]`);
    process.exit(2);
  }
  try {
    const { finto, figlio, chiudi } = await avvia({ scenario, wrangler: argomenti.includes("--wrangler"), portaApp });
    console.log(`Vetrina finta · scenario «${scenario}» · finto Supabase ${finto.url} · app http://127.0.0.1:${portaApp}`);
    console.log(`PID del lanciatore ${process.pid}, dell'app ${figlio.pid}. Per chiudere: kill ${process.pid}`);
    const esci = () => chiudi().finally(() => process.exit(0));
    process.once("SIGINT", esci);
    process.once("SIGTERM", esci);
    figlio.once("exit", (codice) => process.exit(codice ?? 0));
  } catch (e) {
    console.error(e instanceof ErroreSalvaguardia ? `RIFIUTATO: ${e.message}` : e);
    process.exit(1);
  }
}
