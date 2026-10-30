/** ── IL SERVIZIO DELLE RISPOSTE AI, SUL MAC DEL TITOLARE ─────────────────────
 *
 *  Ogni pochi secondi chiede al CRM se c'è una risposta da scrivere
 *  (POST /api/public/risposte-ai, chiave del ponte WhatsApp). Se c'è, la fa
 *  scrivere a Claude Haiku con l'abbonamento del Mac (`claude -p`, nessuno
 *  strumento, nessun file, nessuna impostazione), con le regole dello studio
 *  e i documenti di AIOS in `fonti.txt`, e la consegna. Il CRM la mette nella
 *  casella: non si invia niente da qui.
 *
 *  La chiave e l'indirizzo sono quelli del ponte WhatsApp
 *  (`~/Library/Application Support/HGL/ponte-wa/config.env`): nessun segreto
 *  nuovo. Nel log solo codici e durate: mai testi, nomi o numeri.
 *  ───────────────────────────────────────────────────────────────────────── */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  domanda,
  domandaRispiega,
  esitoClaude,
  istruzioni,
  istruzioniRispiega,
} from "./prompt.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const CONFIG_PONTE = join(homedir(), "Library/Application Support/HGL/ponte-wa/config.env");
const OGNI_MS = 3000;
const DOPO_ERRORE_MS = 15000;
const TEMPO_CLAUDE_MS = 90_000;

const log = (codice, extra = "") => console.log(`${new Date().toISOString()} ${codice}${extra}`);
const dormi = (ms) => new Promise((ok) => setTimeout(ok, ms));

function leggiConfig() {
  const righe = readFileSync(CONFIG_PONTE, "utf8").split("\n");
  const v = {};
  for (const r of righe) {
    const m = r.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) v[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const base = new URL(v.PONTE_URL);
  if (base.protocol !== "https:") throw new Error("indirizzo_non_https");
  return { url: `${base.origin}/api/public/risposte-ai`, token: v.PONTE_TOKEN ?? "" };
}

function leggiFonti() {
  let elenco = "";
  try {
    elenco = readFileSync(join(QUI, "..", "fonti.txt"), "utf8");
  } catch {
    return [];
  }
  const fonti = [];
  for (const riga of elenco.split("\n")) {
    const p = riga.trim();
    if (!p || p.startsWith("#")) continue;
    const percorso = p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
    try {
      fonti.push({
        nome: percorso.split("/").slice(-2).join("/"),
        testo: readFileSync(percorso, "utf8"),
      });
    } catch {
      log("fonte_mancante");
    }
  }
  return fonti;
}

async function chiama(cfg, corpo) {
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hgl-token": cfg.token },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error("http"), { stato: r.status, codice: json?.errore });
  return json;
}

/** Claude Haiku, da solo: nessuno strumento, nessun server MCP, nessuna
 *  impostazione o hook, in una cartella vuota (niente CLAUDE.md). */
function scrivi(sistema, richiesta) {
  return new Promise((ok) => {
    const vuota = mkdtempSync(join(tmpdir(), "risposte-ai-"));
    const fine = (esito) => {
      rmSync(vuota, { recursive: true, force: true });
      ok(esito);
    };
    let figlio;
    try {
      figlio = spawn(
        process.env.CLAUDE_BIN || "claude",
        [
          "-p",
          "--model",
          "haiku",
          "--tools",
          "",
          "--strict-mcp-config",
          "--setting-sources",
          "",
          "--no-session-persistence",
          "--output-format",
          "json",
          "--system-prompt",
          sistema,
        ],
        { cwd: vuota, stdio: ["pipe", "pipe", "pipe"] },
      );
    } catch {
      return fine({ errore: "claude_non_trovato" });
    }
    let out = "";
    let chiuso = false;
    const timer = setTimeout(() => {
      chiuso = true;
      figlio.kill("SIGKILL");
      fine({ errore: "tempo_scaduto" });
    }, TEMPO_CLAUDE_MS);
    figlio.stdout.on("data", (b) => (out += b));
    figlio.stderr.on("data", () => {});
    figlio.on("error", (e) => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(timer);
      fine({ errore: e?.code === "ENOENT" ? "claude_non_trovato" : "errore_claude" });
    });
    figlio.on("close", (codice) => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(timer);
      fine(esitoClaude(out, codice));
    });
    figlio.stdin.end(richiesta);
  });
}

async function giro(cfg) {
  const { lavoro } = await chiama(cfg, { azione: "prendi" });
  if (!lavoro) return false;
  const inizio = Date.now();
  //  «Rispiega con AI»: istruzioni sue, senza i documenti dell'azienda.
  const esito =
    lavoro.modo === "rispiega"
      ? await scrivi(istruzioniRispiega(), domandaRispiega(lavoro))
      : await scrivi(istruzioni(leggiFonti()), domanda(lavoro));
  if (esito.risposta)
    await chiama(cfg, { azione: "consegna", id: lavoro.id, risposta: esito.risposta });
  else await chiama(cfg, { azione: "fallita", id: lavoro.id, errore: esito.errore });
  log(
    esito.risposta ? "risposta_consegnata" : `risposta_fallita ${esito.errore}`,
    ` ms=${Date.now() - inizio}`,
  );
  return true;
}

async function main() {
  log("avvio");
  for (;;) {
    let cfg;
    try {
      cfg = leggiConfig();
    } catch {
      log("config_ponte_mancante");
      await dormi(60_000);
      continue;
    }
    try {
      //  Dopo un lavoro si richiede subito: ce ne possono essere altri in fila.
      const fatto = await giro(cfg);
      if (!fatto) await dormi(OGNI_MS);
    } catch (e) {
      log("errore_rete", e?.stato ? ` stato=${e.stato} ${e.codice ?? ""}` : "");
      await dormi(DOPO_ERRORE_MS);
    }
  }
}

main();
