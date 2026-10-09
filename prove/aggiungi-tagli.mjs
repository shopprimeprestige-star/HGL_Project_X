/** ── I TAGLI CHE IL RAGGRUPPAMENTO AVEVA MANGIATO ──────────────────────────
 *
 *  ── ⚠️ IL DIFETTO: HO TOLTO TROPPO ───────────────────────────────────────
 *  `genera-da-foto.mjs` toglie i doppioni confrontando quattro campi — lati,
 *  texture, direzione, lunghezza. Su ventotto foto ne ha tenute venti, e su
 *  otto ha detto «questo l'ho già». Ma «già» secondo QUEI quattro campi: due
 *  mossi medi portati in avanti possono avere una frangia che cade in due modi
 *  diversi, un'onda più larga, una riga che non c'è. Chi ha scelto quelle foto
 *  le ha scelte perché sono diverse — e infatti se ne è accorto subito.
 *  Qui si rimettono, una per una, con un nome che dice in cosa si distinguono.
 *
 *  ⚠️ NON RIGENERA NIENTE DI ESISTENTE: le venti fotografie già fatte restano
 *   com'erano, con le loro chiavi. Cambiarle vorrebbe dire ributtare via
 *   dieci euro di generazioni per riottenere le stesse immagini.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARTELLA = join(process.env.HOME, "Desktop", "Imm");
const dove = join(radice, ".esempi-tmp");

/** ⚠️ Il nome lo scelgo io e non il modello: deve dire IN COSA si distingue da
 *  quello che gli somiglia, altrimenti in griglia si leggono due riquadri con
 *  la stessa etichetta e sembra un errore. */
const DA_AGGIUNGERE = [
  { file: "IMG_3368.JPG", chiave: "ricci_morbidi", famiglia: "ricci", nome: "Ricci morbidi" },
  { file: "IMG_3385.JPG", chiave: "sfumato_con_frangia", famiglia: "sfumati", nome: "Sfumato con frangia" },
  { file: "IMG_3390.JPG", chiave: "lungo_mosso_di_lato", famiglia: "lunghi", nome: "Lungo mosso di lato" },
  { file: "IMG_3392.JPG", chiave: "ricci_sfumatura_netta", famiglia: "ricci", nome: "Ricci con sfumatura netta" },
  { file: "IMG_3395.JPG", chiave: "mosso_alzato", famiglia: "mossi", nome: "Mosso alzato" },
  { file: "IMG_3396.JPG", chiave: "mosso_indietro", famiglia: "mossi", nome: "Mosso indietro" },
  { file: "IMG_3398.JPG", chiave: "mosso_in_avanti", famiglia: "mossi", nome: "Mosso in avanti" },
  { file: "IMG_3399.JPG", chiave: "mosso_con_volume", famiglia: "mossi", nome: "Mosso con volume" },
];

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

async function chiedi(modello, testo, immagini, tetto = 8000) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHIAVE}` },
    body: JSON.stringify({
      model: modello,
      ...(modello.includes("image") ? { modalities: ["image", "text"] } : {}),
      max_tokens: tetto,
      messages: [{
        role: "user",
        content: [{ type: "text", text: testo }, ...immagini.map((u) => ({ type: "image_url", image_url: { url: u } }))],
      }],
    }),
  });
  const b = await r.json();
  if (modello.includes("image")) {
    const url = b?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error(JSON.stringify(b?.error || b?.choices?.[0] || b).slice(0, 300));
    return url;
  }
  const c = b?.choices?.[0]?.message?.content;
  return (typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p?.text || "").join("") : "").trim();
}

const cartella = join(radice, "public", "tagli");
const comeFile = (n) => join(cartella, `${n}.jpg`);
const dataUrl = (p) => `data:image/jpeg;base64,${readFileSync(p).toString("base64")}`;
const base = dataUrl(comeFile("_persona"));

const LETTURA =
  "Describe ONLY the haircut in this photo, in one dense English sentence of at most 60 words, as "
  + "a barber would specify it to another barber. Cover, in this order: length and finish at the "
  + "sides and back (fade, undercut, tapered, left long), length and volume on top, styling "
  + "direction, parting, texture, and fringe. Do not mention the person, their face, their build, "
  + "the colour of the hair, the lighting or the background. Reply with the description only.";

const righe = [];
for (const t of DA_AGGIUNGERE) {
  process.stdout.write(`· ${t.nome} … `);
  try {
    const rif = dataUrl(join(CARTELLA, t.file));
    const descrizione = await chiedi("google/gemini-2.5-flash", LETTURA, [rif], 300);
    if (!existsSync(comeFile(t.chiave))) {
      //  ⚠️ E l'ultima riga chiede di CONFRONTARE, non solo di copiare: è
      //   l'istruzione che pesa di più, e «guarda se è uguale» ottiene un
      //   risultato diverso da «fallo uguale» — la prima costringe a
      //   ricontrollare, la seconda si accontenta della somiglianza.
      const testo = `${costruisciPrompt({
        taglio: "", taglioDaFoto: true, descrizioneTaglio: descrizione,
        colore: "castano_scuro", calvo: true,
      })}
Before finishing, compare your result with the haircut reference image: the length at the sides, the shape of the outline, the direction of the styling, the texture and the way the front hair falls must MATCH it. If anything differs, correct it.
Keep the pose EXACTLY as in image 1: perfectly frontal, head facing the camera straight on, both ears equally visible, eyes looking into the lens, shoulders square. Do not rotate, tilt or turn the head. Same framing, same background, same lighting as image 1.`;
      writeFileSync(comeFile(t.chiave), Buffer.from((await chiedi("google/gemini-3.1-flash-image", testo, [base, rif])).split(",")[1], "base64"));
    }
    righe.push(`  {
    chiave: ${JSON.stringify(t.chiave)},
    famiglia: ${JSON.stringify(t.famiglia)},
    nome: ${JSON.stringify(t.nome)},
    descrizione: ${JSON.stringify(`Come nella foto ${t.file.replace(".JPG", "")}, riprodotto sul nostro modello.`)},
    inglese:
      ${JSON.stringify(descrizione)},
  },`);
    console.log("fatto");
  } catch (e) {
    console.log(`NO — ${String(e.message || e).slice(0, 160)}`);
  }
}

writeFileSync(join(radice, "prove", "catalogo-aggiunte.txt"), righe.join("\n"));
rmSync(dove, { recursive: true, force: true });
console.log(`\n${righe.length} voci in prove/catalogo-aggiunte.txt`);
