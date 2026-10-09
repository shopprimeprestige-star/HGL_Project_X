/** ── RIFARE TUTTO IL CATALOGO CON IL SISTEMA CHE FUNZIONA ──────────────────
 *
 *  ── ⚠️ IL DIFETTO: DUE STRADE DIVERSE PER LA STESSA COSA ─────────────────
 *  Le fotografie del catalogo erano state generate quando il testo era ancora
 *  a metà: senza la lettura del taglio a parole, senza il vincolo sulla
 *  sfumatura da vedere di fronte, senza il controllo finale che confronta il
 *  risultato con la foto. Quelle tre cose sono arrivate dopo, una alla volta,
 *  correggendo la pagina — cioè la strada che percorre il CLIENTE.
 *  Risultato: chi caricava una sua foto otteneva una copia migliore di quella
 *  che gli mostravamo in vetrina. Se n'è accorto il committente guardando, non
 *  una prova: nessuna prova può dire «questa foto somiglia meno di quell'altra».
 *
 *  ⚠️ LA REGOLA CHE NE ESCE: gli esempi si rifanno ogni volta che cambia il
 *   testo che li genera. Costano una manciata di euro; una vetrina che mostra
 *   una qualità più bassa di quella vera costa molto di più.
 *
 *  Si lancia con `node prove/rifai-catalogo.mjs`. Cancella e rigenera TUTTO —
 *  a differenza degli altri script, qui il «c'era già» sarebbe il difetto.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARTELLA = join(process.env.HOME, "Desktop", "Imm");
const dove = join(radice, ".esempi-tmp");
const soloQuesti = process.argv.slice(2).filter((a) => !a.startsWith("-"));

rmSync(dove, { recursive: true, force: true });
mkdirSync(dove, { recursive: true });
execFileSync("npx", [
  "esbuild", "src/prova/tagli.ts", "--bundle", "--format=cjs",
  `--outfile=${join(dove, "tagli.cjs")}`, "--alias:@=./src", "--log-level=error",
], { cwd: radice, stdio: ["ignore", "ignore", "inherit"] });
const { TAGLI, costruisciPrompt } = createRequire(import.meta.url)(join(dove, "tagli.cjs"));

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
    if (!url) throw new Error(JSON.stringify(b?.error || b?.choices?.[0] || b).slice(0, 260));
    return url;
  }
  const c = b?.choices?.[0]?.message?.content;
  return (typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p?.text || "").join("") : "").trim();
}

/** ── DA QUALE FOTO VIENE OGNI TAGLIO ───────────────────────────────────────
 *  Sta scritto qui e non nel catalogo perché è una cosa di CANTIERE: al sito
 *  non serve sapere da dove viene un esempio, a chi lo rifà sì. */
const DA_FOTO = {
  sfumato_mosso_voluminoso: "IMG_3327.JPG", sfumato_all_indietro: "IMG_3328.JPG",
  sfumato_laterale_lungo: "IMG_3331.JPG", sfumato_laterale_mosso: "IMG_3336.JPG",
  sfumato_textured_crop: "IMG_3350.JPG", sfumato_mosso: "IMG_3351.JPG",
  sfumatura_alta_strutturata: "IMG_3357.JPG", ricci_naturali_scalati: "IMG_3367.JPG",
  wavy_lunghezza_media: "IMG_3369.JPG", sfumato_riccio_corto: "IMG_3370.JPG",
  classico_pettinato_indietro: "IMG_3371.JPG", capelli_mossi_lunghi: "IMG_3373.JPG",
  capelli_lunghi_pettinati_all: "IMG_3374.JPG", capelli_mossi_naturali: "IMG_3375.JPG",
  riccio_naturale: "IMG_3380.JPG", sfumato_riccio_indietro: "IMG_3382.JPG",
  corto_mosso: "IMG_3383.JPG", wavy_con_frangia: "IMG_3387.JPG",
  ricci_naturali: "IMG_3388.JPG", capelli_mossi_lunghi_2: "IMG_3391.JPG",
  ricci_morbidi: "IMG_3368.JPG", sfumato_con_frangia: "IMG_3385.JPG",
  lungo_mosso_di_lato: "IMG_3390.JPG", ricci_sfumatura_netta: "IMG_3392.JPG",
  mosso_alzato: "IMG_3395.JPG", mosso_indietro: "IMG_3396.JPG",
  mosso_in_avanti: "IMG_3398.JPG", mosso_con_volume: "IMG_3399.JPG",
};

const LETTURA =
  "Describe ONLY the haircut in this photo, in one dense English sentence of at most 60 words, as "
  + "a barber would specify it to another barber. Cover, in this order: length and finish at the "
  + "sides and back (fade, undercut, tapered, left long), length and volume on top, styling "
  + "direction, parting, texture, and fringe. Do not mention the person, their face, their build, "
  + "the colour of the hair, the lighting or the background. Reply with the description only.";

const POSA = `
Keep the pose EXACTLY as in image 1: perfectly frontal, head facing the camera straight on, both ears equally visible, eyes looking into the lens, shoulders square. Do not rotate, tilt or turn the head. Same framing, same background, same lighting as image 1.`;

const cartella = join(radice, "public", "tagli");
const comeFile = (n) => join(cartella, `${n}.jpg`);
const dataUrl = (p) => `data:image/jpeg;base64,${readFileSync(p).toString("base64")}`;
const base = dataUrl(comeFile("_persona"));

let rifatti = 0;
for (const t of TAGLI) {
  if (soloQuesti.length && !soloQuesti.includes(t.chiave)) continue;
  const foto = DA_FOTO[t.chiave];
  process.stdout.write(`· ${t.nome.padEnd(28)} ${foto ? `← ${foto}` : "(descritto a parole)"} … `);
  try {
    //  ⚠️ La descrizione si rilegge dalla foto OGNI VOLTA e non si prende da
    //   `inglese`: quella nel catalogo è la stessa cosa, ma se un giorno
    //   qualcuno la ritocca a mano la fotografia deve seguire il testo che c'è
    //   davvero, non quello di ieri.
    const rif = foto ? dataUrl(join(CARTELLA, foto)) : "";
    const testo = foto
      ? costruisciPrompt({
          taglio: "", taglioDaFoto: true,
          descrizioneTaglio: await chiedi("google/gemini-2.5-flash", LETTURA, [rif], 300),
          colore: "castano_scuro", calvo: true,
        }) + POSA
      : costruisciPrompt({ taglio: t.chiave, colore: "castano_scuro", calvo: true }) + POSA;

    const url = await chiedi("google/gemini-3.1-flash-image", testo, foto ? [base, rif] : [base]);
    writeFileSync(comeFile(t.chiave), Buffer.from(url.split(",")[1], "base64"));
    rifatti += 1;
    console.log("fatto");
  } catch (e) {
    //  ⚠️ Il vecchio file NON si cancella prima: se la generazione fallisce,
    //   in vetrina resta quello di ieri invece di un buco.
    console.log(`NO — ${String(e.message || e).slice(0, 140)}`);
  }
}

rmSync(dove, { recursive: true, force: true });
console.log(`\n${rifatti} fotografie rifatte.`);
