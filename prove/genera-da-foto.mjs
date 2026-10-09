/** ── IL CATALOGO NASCE DALLE FOTO SCELTE ───────────────────────────────────
 *
 *  Prende le schede lette da `leggi-tagli.mjs`, toglie i doppioni, e per ogni
 *  taglio rimasto genera l'esempio SUL NOSTRO VOLTO: stessa faccia, stessa
 *  posa frontale, stesso castano scuro. Alla fine scrive anche il pezzo di
 *  codice del catalogo, così le parole della pagina e le fotografie descrivono
 *  la stessa cosa invece di essere scritte due volte.
 *
 *  ── ⚠️ I DOPPIONI LI DECIDE LA SCHEDA, NON L'OCCHIO ──────────────────────
 *  Ventotto foto non sono ventotto tagli: parecchie sono lo stesso taglio
 *  fotografato in un altro posto. Guardarle a occhio, su ventotto, vuol dire
 *  stancarsi a metà e tenere due gemelli. Qui il confronto è fra CAMPI —
 *  lati, texture, direzione, lunghezza — e due schede uguali sono lo stesso
 *  taglio per definizione, non per impressione.
 *
 *  ── ⚠️ E IL COLORE È SEMPRE LO STESSO ────────────────────────────────────
 *  Castano scuro per tutti, anche quando la foto di riferimento è bionda o
 *  platino. In una griglia il colore è la cosa che l'occhio vede per prima:
 *  se cambia da un riquadro all'altro, si confrontano i colori e non i tagli —
 *  e i tagli sono l'unica ragione per cui la griglia esiste. Il colore lo
 *  sceglie la persona al passo dopo, sul suo viso.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARTELLA = process.argv[2] || join(process.env.HOME, "Desktop", "Imm");
const dove = join(radice, ".esempi-tmp");

rmSync(dove, { recursive: true, force: true });
mkdirSync(dove, { recursive: true });
execFileSync("npx", [
  "esbuild", "src/prova/tagli.ts", "--bundle", "--format=cjs",
  `--outfile=${join(dove, "tagli.cjs")}`, "--alias:@=./src", "--log-level=error",
], { cwd: radice, stdio: ["ignore", "ignore", "inherit"] });
const { costruisciPrompt } = createRequire(import.meta.url)(join(dove, "tagli.cjs"));

const env = Object.fromEntries(
  readFileSync(join(radice, ".env"), "utf8").split("\n").filter((r) => r.includes("=")).map((r) => {
    const i = r.indexOf("=");
    return [r.slice(0, i).trim(), r.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);
const cfg = await fetch(
  `${env.SUPABASE_URL}/rest/v1/app_config?key=eq.ai_config&select=value`,
  { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } },
).then((r) => r.json());
const CHIAVE = JSON.parse(cfg?.[0]?.value || "{}").apiKey || env.OPENROUTER_API_KEY;
if (!CHIAVE) { console.error("Nessuna chiave."); process.exit(1); }
const MODELLO = "google/gemini-3.1-flash-image";

/* ═══════════════════════════════════════════════════════════════════════════
   1. VIA I DOPPIONI
   ═════════════════════════════════════════════════════════════════════════ */

/** I lati si raggruppano: fra uno sfumato alto e uno medio, su un riquadro
 *  grande come un francobollo, non c'è differenza che una persona possa
 *  vedere. Fra uno sfumato e un taglio a forbice sì. */
const GRUPPO_LATI = {
  "skin-fade": "fade", "high-fade": "fade", "mid-fade": "fade",
  "low-fade": "morbido", tapered: "morbido",
  "scissor-cut-short": "forbici",
  "left-long": "lungo",
};

const firma = (s) => [
  GRUPPO_LATI[s.lati] || "morbido",
  s.texture,
  //  «Nessuna direzione» e «in avanti» sul riccio sono la stessa cosa: il
  //  riccio cade dove vuole, e nominare la differenza creerebbe due riquadri
  //  identici con due nomi diversi.
  s.direzione === "none" ? "forward" : s.direzione,
  s.lunghezza,
].join("|");

const FAMIGLIA = (s) => {
  if (s.lunghezza === "long") return "lunghi";
  if (s.texture === "curly" || s.texture === "coily") return "ricci";
  if ((GRUPPO_LATI[s.lati] || "") === "fade") return "sfumati";
  if (s.riga === "soft-side-part" || s.riga === "hard-line") return "classici";
  if (s.direzione === "back" && s.frangia === "none") return "classici";
  if (s.texture === "wavy") return "mossi";
  return "classici";
};

const senzaAccenti = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const chiaveDa = (nome, usate) => {
  let c = senzaAccenti(nome).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 28);
  let n = 2;
  while (usate.has(c)) { c = `${c}_${n}`; n += 1; }
  usate.add(c);
  return c;
};

const schede = JSON.parse(readFileSync(join(radice, "prove", "tagli-letti.json"), "utf8"));
const viste = new Map();
for (const [file, s] of Object.entries(schede)) {
  const f = firma(s);
  //  ⚠️ Fra due gemelli tiene il PRIMO, e non è indifferente: le foto sono
  //   ordinate per nome, cioè per come le ha salvate il committente, e la
  //   prima di una serie è quasi sempre quella che aveva in mente.
  if (!viste.has(f)) viste.set(f, { file, ...s });
}
const usate = new Set();
const tagli = [...viste.values()].map((s) => ({
  ...s,
  famiglia: FAMIGLIA(s),
  chiave: chiaveDa(s.nome_it, usate),
}));

console.log(`${Object.keys(schede).length} foto → ${tagli.length} tagli veri\n`);
for (const t of tagli) console.log(`· ${t.chiave.padEnd(30)} ${t.famiglia.padEnd(10)} ← ${t.file}`);

/* ═══════════════════════════════════════════════════════════════════════════
   2. LE FOTOGRAFIE
   ═════════════════════════════════════════════════════════════════════════ */

async function chiedi(testo, immagini) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHIAVE}` },
    body: JSON.stringify({
      model: MODELLO,
      modalities: ["image", "text"],
      max_tokens: 8000,
      messages: [{
        role: "user",
        content: [{ type: "text", text: testo }, ...immagini.map((u) => ({ type: "image_url", image_url: { url: u } }))],
      }],
    }),
  });
  const b = await r.json();
  const url = b?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error(JSON.stringify(b?.error || b?.choices?.[0] || b).slice(0, 300));
  return url;
}

const cartella = join(radice, "public", "tagli");
mkdirSync(cartella, { recursive: true });
const comeFile = (n) => join(cartella, `${n}.jpg`);
const dataUrl = (p) => `data:image/jpeg;base64,${readFileSync(p).toString("base64")}`;
const base = dataUrl(comeFile("_persona"));

for (const t of tagli) {
  if (existsSync(comeFile(t.chiave))) { console.log(`· ${t.chiave} … c'era già`); continue; }
  process.stdout.write(`· ${t.chiave} … `);
  try {
    //  ⚠️ Lo stesso testo della pagina — con la descrizione LETTA dalla foto —
    //   più la foto di riferimento e la posa ripetuta in fondo. È la stessa
    //   strada che percorre un cliente quando carica un taglio suo: se le
    //   fotografie del catalogo escono bene, quella strada funziona.
    const testo = `${costruisciPrompt({
      taglio: "",
      taglioDaFoto: true,
      descrizioneTaglio: t.descrizione_en,
      colore: "castano_scuro",
      calvo: true,
    })}
Keep the pose EXACTLY as in image 1: perfectly frontal, head facing the camera straight on, both ears equally visible, eyes looking into the lens, shoulders square. Do not rotate, tilt or turn the head. Same framing, same background, same lighting as image 1.`;
    const url = await chiedi(testo, [base, dataUrl(join(CARTELLA, t.file))]);
    writeFileSync(comeFile(t.chiave), Buffer.from(url.split(",")[1], "base64"));
    console.log("fatto");
  } catch (e) {
    console.log(`NO — ${String(e.message || e).slice(0, 160)}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. IL CATALOGO, SCRITTO DA SOLO
   ═════════════════════════════════════════════════════════════════════════ */

const righe = tagli.map((t) => `  {
    chiave: ${JSON.stringify(t.chiave)},
    famiglia: ${JSON.stringify(t.famiglia)},
    nome: ${JSON.stringify(t.nome_it)},
    descrizione: ${JSON.stringify(descrizioneIt(t))},
    inglese:
      ${JSON.stringify(t.descrizione_en)},
  },`).join("\n");

function descrizioneIt(t) {
  const lati = {
    fade: "Lati sfumati", morbido: "Lati sfoltiti", forbici: "Lati corti a forbice", lungo: "Lati lunghi",
  }[GRUPPO_LATI[t.lati] || "morbido"];
  const testa = { straight: "liscio", wavy: "mosso", curly: "riccio", coily: "riccissimo" }[t.texture] || "";
  const dove = {
    back: "portato indietro", side: "portato di lato", forward: "portato in avanti",
    up: "alzato", down: "che cade", "middle-part": "con la riga in mezzo", none: "naturale",
  }[t.direzione] || "";
  const fr = t.frangia && t.frangia !== "none" ? ", con la frangia" : "";
  return `${lati}, sopra ${testa} ${dove}${fr}.`;
}

writeFileSync(join(radice, "prove", "catalogo.txt"), righe);
rmSync(dove, { recursive: true, force: true });
console.log(`\nIl catalogo da incollare sta in prove/catalogo.txt`);
