#!/usr/bin/env node
/** ── SCHEDA FINTA · IL LANCIATORE SICURO (E11, PIANO §6 livello 3) ───────────────────────────────────────────
 *  Uso:  node strumenti/scheda-finta/avvia.mjs [--porta N]        (porta di partenza: 5188)
 *
 *  Un solo processo Node: serve con vite la pagina dei prodotti del CRM (elenco, scheda, scheda nuova, finestra «Importa») e risponde a
 *  `/api/crm/negozio` con il SERVER VERO (`smista.server`, caricato con `ssrLoadModule`: nessun pacchetto in più) sopra il database finto
 *  `prove/negozio/_finto-db.mjs` con 33 bozze inventate (`dati.mjs`). Tutto in memoria: chiuso il processo, niente resta.
 *  ⚠️ Mai il database vero. Le salvaguardie stanno QUI, dove tutto parte (la prova è `prove/negozio/editor-invarianti.mjs`):
 *    1. SI FERMA se trova un `.env*` o un `.dev.vars*` nella cartella dell'app o in quella dello strumento (vite li leggerebbe da solo):
 *       la funzione che li cerca è quella della vetrina finta, non una copia;
 *    2. `envDir` di vite su una cartella vuota e `envPrefix` che non espone nessuna variabile della shell alla pagina;
 *    3. l'ambiente del processo si riduce a un elenco chiuso (PATH, HOME, TMPDIR, NODE_*…): ciò che la shell ha in più non arriva a nessun modulo;
 *    4. `@/crm/AuthContext` è SOSTITUITO da `auth-finto.ts` (non affiancato): la pagina non importa mai il client del database;
 *    5. ascolta solo su 127.0.0.1, `cacheDir` di vite dentro una cartella temporanea (la `.vite` condivisa non si tocca).
 *  Il lanciatore scrive con `process.stdout`: nei file nuovi della commessa non c'è nessun `console.`. */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ErroreSalvaguardia, trovaFileSegreti } from "../vetrina-finta/avvia.mjs";
import { fintoDb } from "../../prove/negozio/_finto-db.mjs";
import { PERSONA, seme } from "./dati.mjs";

export { ErroreSalvaguardia };
const CARTELLA = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(CARTELLA, "..", "..");
/** Le variabili che il processo tiene: il resto della shell (chiavi vere incluse) viene tolto prima di caricare qualsiasi modulo. */
const TENUTE = new Set(["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "TERM", "USER", "SHELL", "PWD", "TZ"]);

/** Un `Request` da quello di Node (il corpo si legge tutto: il server ha il suo tetto). */
async function richiestaDa(req, origine) {
  const pezzi = [];
  if (req.method !== "GET" && req.method !== "HEAD") for await (const p of req) pezzi.push(p);
  return new Request(new URL(req.originalUrl ?? req.url, origine), {
    method: req.method,
    headers: Object.fromEntries(Object.entries(req.headers).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))),
    body: pezzi.length ? Buffer.concat(pezzi) : undefined,
  });
}
async function scrivi(res, risposta) {
  res.statusCode = risposta.status;
  risposta.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await risposta.arrayBuffer()));
}

/** Controlla, prepara e avvia. `{ url, porta, db, chiudi }`. `radice` serve alle prove (una cartella con un `.env` deve essere rifiutata). */
export async function avvia({ radice = RADICE, porta = 5188 } = {}) {
  const segreti = trovaFileSegreti([radice, CARTELLA]);
  if (segreti.length) {
    throw new ErroreSalvaguardia(`trovato ${segreti.join(", ")}: la scheda finta non parte con un .env* o un .dev.vars* (vite li leggerebbe da solo). Usa un worktree senza .env.`);
  }
  for (const nome of Object.keys(process.env)) if (!TENUTE.has(nome) && !nome.startsWith("NODE_")) delete process.env[nome];
  const { createServer } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;
  const tailwind = (await import("@tailwindcss/vite")).default;

  const temporanea = mkdtempSync(join(tmpdir(), "scheda-finta-"));
  const vuota = join(temporanea, "senza-env");
  mkdirSync(vuota);
  const db = fintoDb({ tabelle: seme() });
  const dipendenze = {
    guardia: async () => ({ ok: true, nome: PERSONA }),
    db,
    adesso: () => new Date(),
    log: () => {},
    chiaveServizio: () => undefined,
    fattiEsterni: () => ({ bannerPresente: true }),
  };
  const rotte = {
    name: "scheda-finta-rotte",
    configureServer(server) {
      server.middlewares.use("/__scheda-finta/stato", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ prodotti: db.tabelle.shop_prodotti.length, scritture: db.scritture.length, chiamate: db.chiamate }));
      });
      server.middlewares.use("/api/crm/negozio", async (req, res) => {
        try {
          const { gestisciGET, gestisciPOST } = await server.ssrLoadModule("@/crm/negozio/smista.server");
          const richiesta = await richiestaDa(req, `http://127.0.0.1:${server.config.server.port}`);
          await scrivi(res, await (richiesta.method === "GET" ? gestisciGET : gestisciPOST)(richiesta, dipendenze));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, motivo: "interno" }));
        }
      });
    },
  };

  const server = await createServer({
    configFile: false,
    root: CARTELLA,
    envDir: vuota,
    envPrefix: "SCHEDA_FINTA_",
    cacheDir: join(temporanea, "vite"),
    logLevel: "warn",
    plugins: [react(), tailwind(), rotte],
    resolve: {
      alias: [
        { find: /^@\/crm\/AuthContext$/, replacement: join(CARTELLA, "auth-finto.ts") },
        { find: /^@\//, replacement: `${join(radice, "src")}/` },
      ],
      dedupe: ["react", "react-dom"],
    },
    server: { host: "127.0.0.1", port: porta, strictPort: porta !== 0, fs: { allow: [radice] } },
  });
  await server.listen();
  const scelta = server.httpServer.address().port;
  //  Vite chiude da sé alla SIGTERM e poi esce: la cartella temporanea si toglie anche all'uscita (sincrono), non solo da `chiudi`.
  const pulisci = () => rmSync(temporanea, { recursive: true, force: true });
  process.once("exit", pulisci);
  const chiudi = async () => {
    await server.close();
    pulisci();
  };
  return { url: `http://127.0.0.1:${scelta}`, porta: scelta, db, chiudi };
}

/* ── dalla riga di comando ──────────────────────────────────────────────────── */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argomenti = process.argv.slice(2);
  const iPorta = argomenti.indexOf("--porta");
  const porta = iPorta >= 0 ? Number(argomenti[iPorta + 1]) : 5188;
  if (!Number.isInteger(porta) || porta < 0) {
    process.stderr.write("Uso: node strumenti/scheda-finta/avvia.mjs [--porta N]\n");
    process.exit(2);
  }
  try {
    const { url, chiudi } = await avvia({ porta });
    process.stdout.write(`Scheda finta · 33 bozze di PROVA in memoria · ${url}\nPID ${process.pid}. Per chiudere: Ctrl-C oppure kill ${process.pid}\n`);
    const esci = () => chiudi().finally(() => process.exit(0));
    process.once("SIGINT", esci);
    process.once("SIGTERM", esci);
  } catch (e) {
    process.stderr.write(e instanceof ErroreSalvaguardia ? `RIFIUTATO: ${e.message}\n` : `${e?.stack ?? e}\n`);
    process.exit(1);
  }
}
