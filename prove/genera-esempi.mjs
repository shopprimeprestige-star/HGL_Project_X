/** ── LE FOTO D'ESEMPIO DEI TAGLI, GENERATE UNA VOLTA SOLA ──────────────────
 *
 *  Si lancia a mano — `node prove/genera-esempi.mjs` — e scrive otto immagini
 *  in `public/tagli/`. Da lì le serve il sito come qualunque altro file: niente
 *  chiamate al modello quando una persona apre la pagina, niente attesa,
 *  niente spesa per ogni visita.
 *
 *  ── ⚠️ PERCHÉ NON SONO OTTO FOTOGRAFIE SCARICATE ─────────────────────────
 *  Una foto di un taglio è la foto della testa di QUALCUNO. Metterla nel sito
 *  di un centro tricologico accanto a «guardati così» è un guaio legale e una
 *  scorrettezza. Queste facce non esistono: sono generate, e sono nostre.
 *
 *  ── ⚠️ E SONO OTTO VOLTE LA STESSA PERSONA ───────────────────────────────
 *  Prima si genera UN ritratto, poi lo si modifica otto volte cambiando solo i
 *  capelli — con lo stesso identico testo che usa la pagina vera. Otto facce
 *  diverse avrebbero fatto confrontare le facce invece dei tagli, che è
 *  esattamente quello che non deve succedere quando si sceglie.
 *  ⚠️ E siccome usa lo stesso `costruisciPrompt` della pagina, questo file è
 *   anche la prova più onesta che esista: se le otto immagini escono bene, la
 *   pagina funziona; se escono storte, si vede qui prima che lo veda un
 *   cliente.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const dove = join(radice, ".esempi-tmp");

//  Si compila il modulo dei tagli e lo si usa: il testo deve essere LO STESSO
//  della pagina, non una copia che diverge al primo ritocco.
rmSync(dove, { recursive: true, force: true });
mkdirSync(dove, { recursive: true });
execFileSync("npx", [
  "esbuild", "src/prova/tagli.ts", "--bundle", "--format=cjs",
  `--outfile=${join(dove, "tagli.cjs")}`, "--alias:@=./src", "--log-level=error",
], { cwd: radice, stdio: ["ignore", "ignore", "inherit"] });
const { TAGLI, costruisciPrompt } = createRequire(import.meta.url)(join(dove, "tagli.cjs"));

//  La chiave sta dove la mette il gestionale: nelle impostazioni.
const env = Object.fromEntries(
  (await import("node:fs")).readFileSync(join(radice, ".env"), "utf8")
    .split("\n").filter((r) => r.includes("=")).map((r) => {
      const i = r.indexOf("=");
      return [r.slice(0, i).trim(), r.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);
const cfg = await fetch(
  `${env.SUPABASE_URL}/rest/v1/app_config?key=eq.ai_config&select=value`,
  { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } },
).then((r) => r.json());
const CHIAVE = JSON.parse(cfg?.[0]?.value || "{}").apiKey || env.OPENROUTER_API_KEY;
if (!CHIAVE) {
  console.error("Nessuna chiave: impostala dal gestionale, Impostazioni → Intelligenza artificiale.");
  process.exit(1);
}

const modelli = await fetch("https://openrouter.ai/api/v1/models").then((r) => r.json());
const disponibili = (modelli.data || [])
  .filter((m) => (m.architecture?.output_modalities || []).includes("image"))
  .map((m) => m.id).filter((id) => !id.startsWith("openrouter/auto"));
const PREFERITI = ["google/gemini-3.1-flash-image", "google/gemini-2.5-flash-image", "google/gemini-3-pro-image"];
const MODELLO = PREFERITI.find((p) => disponibili.some((d) => d.startsWith(p)))
  ? disponibili.find((d) => PREFERITI.some((p) => d.startsWith(p)))
  : disponibili[0];
console.log(`Modello: ${MODELLO}`);

async function chiedi(testo, immagini = []) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHIAVE}` },
    body: JSON.stringify({
      model: MODELLO,
      modalities: ["image", "text"],
      //  Lo stesso tetto della pagina: senza, OpenRouter riserva il credito
      //  per 57.000 token prima ancora di cominciare, e con pochi spiccioli sul
      //  conto rifiuta una richiesta che ne userebbe duemila.
      max_tokens: 8000,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: testo },
          ...immagini.map((u) => ({ type: "image_url", image_url: { url: u } })),
        ],
      }],
    }),
  });
  const b = await r.json();
  const url = b?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error(JSON.stringify(b?.error || b?.choices?.[0] || b).slice(0, 400));
  return url;
}

const salva = (nome, dataUrl) => {
  const b64 = dataUrl.split(",")[1];
  const cartella = join(radice, "public", "tagli");
  mkdirSync(cartella, { recursive: true });
  const file = join(cartella, `${nome}.jpg`);
  writeFileSync(file, Buffer.from(b64, "base64"));
  return file;
};

//  ⚠️ IL RITRATTO DI PARTENZA È RASATO, non con i capelli: da una testa quasi
//   rasata si può andare in tutte le direzioni, da una pettinata resta sempre
//   l'ombra del taglio di prima.
//  ⚠️ Si rigenera SOLO quello che manca. Ogni immagine costa, e rifare otto
//   volte una cosa che c'è già è denaro buttato — soprattutto quando si torna
//   qui dopo che tre erano fallite per credito esaurito.
const { existsSync, readFileSync: leggi } = await import("node:fs");
const giaFatto = (nome) => existsSync(join(radice, "public", "tagli", `${nome}.jpg`));
const rileggi = (nome) =>
  `data:image/jpeg;base64,${leggi(join(radice, "public", "tagli", `${nome}.jpg`)).toString("base64")}`;

/** ── ⚠️ IL VOLTO DI PARTENZA DECIDE TUTTO ────────────────────────────────
 *  Sono ventitré riquadri con la stessa faccia: se quella faccia è storta, lo
 *  è ventitré volte, e chi guarda la griglia non sta scegliendo un taglio — sta
 *  guardando un uomo che non gli piace. Serve un viso ben proporzionato,
 *  simmetrico, sui trentacinque anni: abbastanza giovane da far vedere il
 *  taglio, abbastanza adulto da somigliare a chi arriva qui.
 *  ⚠️ E FRONTALE, DICHIARATO DUE VOLTE. Basta che una foto sia di tre quarti
 *   perché nella griglia si legga come «un altro»: l'occhio confronta le pose
 *   prima dei capelli, e il confronto fra i tagli — l'unica cosa per cui la
 *   griglia esiste — non si fa più. */
const VOLTO =
  "Photorealistic studio portrait photograph of a handsome 35-year-old European man with a "
  + "well-structured, symmetrical face and balanced proportions: defined jawline, straight nose, "
  + "high cheekbones, clear eyes. PERFECTLY FRONTAL: head facing the camera straight on, both "
  + "ears equally visible, eyes level and looking directly into the lens, shoulders square to the "
  + "camera. Head and shoulders framing, plain neutral dark grey background, soft even studio "
  + "lighting, short dark brown well-groomed beard, natural skin texture with visible pores and "
  + "fine lines, plain dark crew-neck t-shirt, calm neutral expression. Closely shaved head with "
  + "very little hair. Sharp focus, realistic photograph, no text, no watermark, square format.";

console.log("Genero il ritratto di partenza…");
const base = giaFatto("_persona") ? rileggi("_persona") : await chiedi(VOLTO);
if (!giaFatto("_persona")) salva("_persona", base);

for (const t of TAGLI) {
  if (giaFatto(t.chiave)) { console.log(`· ${t.nome} … c'era già`); continue; }
  process.stdout.write(`· ${t.nome} … `);
  try {
    //  Lo STESSO testo della pagina, con lo stesso colore per tutti: quello che
    //  deve cambiare da un riquadro all'altro è il taglio e nient'altro.
    //  ⚠️ Alla fine si ripete la posa. È l'ultima riga, quella che pesa di
    //   più, ed è l'unica cosa che tiene ventitré foto confrontabili fra loro:
    //   basta che una giri la testa perché sembri un'altra persona.
    const testo = `${costruisciPrompt({ taglio: t.chiave, colore: "castano_scuro", calvo: true })}
Keep the pose EXACTLY as in image 1: perfectly frontal, head facing the camera straight on, both ears equally visible, eyes looking into the lens, shoulders square. Do not rotate, tilt or turn the head. Same framing, same background, same lighting.`;
    salva(t.chiave, await chiedi(testo, [base]));
    console.log("fatto");
  } catch (e) {
    console.log(`NO — ${String(e.message || e).slice(0, 200)}`);
  }
}

rmSync(dove, { recursive: true, force: true });
console.log("\nLe immagini stanno in public/tagli/");
