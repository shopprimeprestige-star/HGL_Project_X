#!/usr/bin/env node
/** ── NEL PACCHETTO DEL BROWSER NON DEVE ESSERCI CODICE DEL SERVER (nota di T22, T32 fase 2, punto 7) ──────────
 *  Si lancia DOPO `npx vite build`:   node strumenti/controlla-bundle-browser.mjs [cartella]   (predefinita: dist/client)
 *  Esce con 1 se in un file del browser (.js, .mjs, .css, .html, .json, .map) trova:
 *   · un nome di file `.server` (es. `client.server`, `prodotti.server`) o `*.server.ts`;
 *   · `process.env.` o `cloudflare:workers`; oppure i nomi delle chiavi del server (`SUPABASE_SERVICE`, `service_role`, `OPENROUTER_API_KEY`,
 *     `CRM_ADMIN_EMAIL`) più volte di quante stanno nel testo di aiuto `docs/CLONARE.md` (che per scelta va nella pagina delle Impostazioni);
 *   · il VALORE di un segreto presente in `.env`, `.dev.vars` o `.env.local` (chiavi il cui nome contiene SERVICE, SECRET,
 *     PRIVATE o TOKEN, o che finiscono per API_KEY; lunghezza ≥ 12). I valori NON si stampano mai: solo il nome della variabile.
 *  La chiave PUBBLICA (`VITE_SUPABASE_PUBLISHABLE_KEY`, anon) può stare nel browser: non si cerca.
 *  Solo lettura: non scrive niente. Nessuna rete. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const radice = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cartella = resolve(process.argv[2] ?? join(radice, "dist/client"));

/** Codice del server: NON ammesso in nessun modo. Il nome di file `.server` si cerca fra apici o dopo una barra (un modulo importato),
 *  non come proprietà (`opzioni.server` dei pacchetti è un'altra cosa). */
export const SEGNI_CODICE = [
  ["nome di file .server", /["'`\/][\w$.-]*\.server(?:-[\w-]+)?(?:\.[cm]?[jt]sx?)?["'`]/],
  ["process.env", /process\.env\./],
  ["cloudflare:workers", /cloudflare:workers/],
];
/** I NOMI delle variabili segrete. Il testo di aiuto `docs/CLONARE.md` (scritto con segnaposto, mai valori) finisce per scelta nella
 *  pagina delle Impostazioni: quei nomi sono ammessi tante volte quante compaiono in quel file, non una di più. Un nome in più = codice. */
export const SEGNI_NOMI = [
  ["SUPABASE_SERVICE", /SUPABASE_SERVICE/g],
  ["service_role", /service_role|SERVICE_ROLE/gi],
  ["OPENROUTER_API_KEY", /OPENROUTER_API_KEY/g],
  ["CRM_ADMIN_EMAIL", /CRM_ADMIN_EMAIL/g],
];

const ESTENSIONI = /\.(m?js|cjs|css|html|json|map|txt)$/i;
const ELENCO = [];
function visita(dir) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    const st = statSync(p);
    if (st.isDirectory()) visita(p);
    else if (ESTENSIONI.test(nome)) ELENCO.push(p);
  }
}

/** I valori dei segreti del server, letti dai file locali (mai stampati). */
function segretiLocali() {
  const out = [];
  for (const f of [".env", ".dev.vars", ".env.local"]) {
    const p = join(radice, f);
    if (!existsSync(p)) continue;
    for (const riga of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(riga);
      if (!m) continue;
      const [, nome, grezzo] = m;
      const valore = grezzo.replace(/^["']|["']$/g, "");
      if (/^VITE_/.test(nome) || /PUBLISHABLE|ANON/.test(nome)) continue;
      if (!/(SERVICE|SECRET|PRIVATE|TOKEN|API_KEY)/.test(nome)) continue;
      if (valore.length >= 12) out.push([nome, valore]);
    }
  }
  return out;
}

if (!existsSync(cartella)) {
  console.error(`Cartella non trovata: ${cartella}. Lancia prima «npx vite build».`);
  process.exit(2);
}
visita(cartella);
if (ELENCO.length === 0) {
  console.error(`Nessun file da controllare in ${cartella}: il controllo non vale (build mancante?).`);
  process.exit(2);
}
const segreti = segretiLocali();
const trovati = [];
const conta = (testo, re) => (testo.match(re) ?? []).length;
const aiuto = existsSync(join(radice, "docs/CLONARE.md")) ? readFileSync(join(radice, "docs/CLONARE.md"), "utf8") : "";
const totali = Object.fromEntries(SEGNI_NOMI.map(([n]) => [n, 0]));
for (const p of ELENCO) {
  const testo = readFileSync(p, "utf8");
  if (/\.server(?:-[\w-]+)?\.[cm]?jsx?$/.test(p)) trovati.push({ file: relative(radice, p), segno: "file .server nel browser", contesto: "(nome del file)" });
  for (const [nome, re] of SEGNI_CODICE) {
    const m = re.exec(testo);
    if (m) trovati.push({ file: relative(radice, p), segno: nome, contesto: testo.slice(Math.max(0, m.index - 30), m.index + 50).replace(/\s+/g, " ") });
  }
  for (const [nome, re] of SEGNI_NOMI) totali[nome] += conta(testo, re);
  for (const [nome, valore] of segreti) if (testo.includes(valore)) trovati.push({ file: relative(radice, p), segno: `VALORE di ${nome}`, contesto: "(valore non stampato)" });
}
for (const [nome, re] of SEGNI_NOMI) {
  const ammessi = conta(aiuto, re);
  if (totali[nome] > ammessi) trovati.push({ file: "(bundle)", segno: `nome ${nome}`, contesto: `${totali[nome]} volte nel browser, ${ammessi} nel testo di aiuto docs/CLONARE.md` });
}
console.log(`Controllati ${ELENCO.length} file in ${relative(radice, cartella) || "."}; segreti locali cercati per valore: ${segreti.map(([n]) => n).join(", ") || "nessuno"}.`);
if (trovati.length === 0) {
  console.log("OK: nel pacchetto del browser non c'è codice del server né segreti.");
} else {
  console.log(`TROVATI ${trovati.length} segni del server nel browser:`);
  for (const t of trovati.slice(0, 40)) console.log(`  ${t.segno}  ${t.file}  «…${t.contesto}…»`);
  process.exit(1);
}
