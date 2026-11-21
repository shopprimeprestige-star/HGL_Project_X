/** ── SHOP R1 · T32 fase 2 · punto 7 · NEL PACCHETTO DEL BROWSER NON C'È CODICE DEL SERVER ───────────────────
 *  Prova lo strumento `strumenti/controlla-bundle-browser.mjs` su cartelle FINTE (nessuna build qui: la corsa vera su `dist/client`
 *  si fa dopo `npx vite build`). Lo strumento deve dare 0 sul pulito, 1 con un modulo `.server`, `process.env.`, `cloudflare:workers`,
 *  una chiave di servizio in più di quelle del testo di aiuto, o il VALORE di un segreto locale; 2 se non c'è niente da controllare.
 *  Falsi positivi che NON devono scattare: `opzioni.server` (una proprietà), il testo di aiuto con i segnaposto. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T32 f2 · P.7 · IL PACCHETTO DEL BROWSER SENZA CODICE DEL SERVER (21/11/2026)");
  const strumento = join(radice, "strumenti/controlla-bundle-browser.mjs");
  c("lo strumento esiste", true, existsSync(strumento));
  if (!existsSync(strumento)) return;
  const base = mkdtempSync(join(tmpdir(), "bundle-"));
  const esito = (file) => {
    const dir = mkdtempSync(join(base, "c-"));
    mkdirSync(join(dir, "assets"));
    for (const [nome, testo] of Object.entries(file)) writeFileSync(join(dir, "assets", nome), testo);
    try {
      execFileSync("node", [strumento, dir], { stdio: ["ignore", "pipe", "pipe"] });
      return 0;
    } catch (e) {
      return e.status;
    }
  };
  try {
    const PULITO = { "index-a1.js": 'import{x}from"./chunk-b2.js";const o={server:1};if(o.server&&t.server){fetch("/_serverFn/abc")}', "stile.css": ".a{color:red}" };
    c("pacchetto pulito (anche con `opzioni.server` e `/_serverFn/`, che non sono moduli del server): esce 0", 0, esito(PULITO));
    c("cartella vuota: esce 2 (il controllo non vale)", 2, esito({}));
    c("un modulo `.server` importato dal browser: esce 1", 1, esito({ ...PULITO, "x.js": 'import{a}from"../integrations/supabase/client.server";' }));
    c("…anche con l'estensione e con gli apici singoli", [1, 1], [esito({ "x.js": "import{a}from'./prodotti.server.ts'" }), esito({ "x.js": "import(`./cassa.server`)" })]);
    c("un pezzo `.server` con l'impronta nel nome (`prodotti.server-Dk3jA9.js`), importato o come file: esce 1", [1, 1], [esito({ ...PULITO, "x.js": 'import{a}from"./prodotti.server-Dk3jA9.js"' }), esito({ ...PULITO, "prodotti.server-Dk3jA9.js": "export const a=1" })]);
    c("`process.env.` nel browser: esce 1", 1, esito({ ...PULITO, "x.js": "const k=process.env.SUPABASE_URL" }));
    c("`cloudflare:workers` nel browser: esce 1", 1, esito({ ...PULITO, "x.js": 'import{env}from"cloudflare:workers"' }));
    // senza il testo di aiuto accanto i nomi ammessi sono quelli di CLONARE.md: oltre quel numero è codice
    const molti = (t) => t.repeat(200);
    c("il nome della chiave di servizio nel codice (più volte di quante ne ha il testo di aiuto): esce 1", 1, esito({ ...PULITO, "x.js": molti('const k="SUPABASE_SERVICE_ROLE_KEY";') }));
    c("`service_role` nel codice (più volte di quante ne ha il testo di aiuto): esce 1", 1, esito({ ...PULITO, "x.js": molti('createClient(u,"service_role");') }));
    // il testo di aiuto: tante volte quante stanno in docs/CLONARE.md (i nomi, con segnaposto) è ammesso
    const aiuto = readFileSync(join(radice, "docs/CLONARE.md"), "utf8");
    c("il testo di aiuto `docs/CLONARE.md` com'è (nomi con segnaposto) nel browser: esce 0", 0, esito({ ...PULITO, "aiuto.js": `const t=${JSON.stringify(aiuto)}` }));
    c("…ma una menzione IN PIÙ della chiave di servizio accanto al testo di aiuto: esce 1", 1, esito({ ...PULITO, "aiuto.js": `const t=${JSON.stringify(aiuto)}`, "x.js": 'k="SUPABASE_SERVICE_ROLE_KEY"' }));
    // il valore di un segreto locale (letto da .env / .dev.vars, mai stampato)
    const valori = [];
    for (const f of [".env", ".dev.vars", ".env.local"]) {
      const p = join(radice, f);
      if (!existsSync(p)) continue;
      for (const riga of readFileSync(p, "utf8").split(/\r?\n/)) {
        const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(riga);
        const v = m?.[2].replace(/^["']|["']$/g, "") ?? "";
        if (m && !/^VITE_|PUBLISHABLE|ANON/.test(m[1]) && /(SERVICE|SECRET|PRIVATE|TOKEN|API_KEY)/.test(m[1]) && v.length >= 12) valori.push(v);
      }
    }
    c("il VALORE di un segreto locale dentro un file del browser: esce 1 (se non ci sono segreti locali, non c'è niente da provare)", valori.length ? 1 : "nessun segreto locale", valori.length ? esito({ ...PULITO, "x.js": `const k="${valori[0]}"` }) : "nessun segreto locale");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
