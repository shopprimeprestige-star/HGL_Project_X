/** ── LEGGERE LE FOTO DI RIFERIMENTO, UNA PER UNA ───────────────────────────
 *
 *  Prende le fotografie dei tagli scelte dal committente e ne ricava, per
 *  ciascuna, una SCHEDA: lati, lunghezza sopra, direzione, riga, texture,
 *  frangia, famiglia. Scrive tutto in `prove/tagli-letti.json`.
 *
 *  ── ⚠️ PERCHÉ UNA SCHEDA E NON UNA FRASE ─────────────────────────────────
 *  Serve a due cose diverse, e una frase ne farebbe bene solo una:
 *   · a TOGLIERE I DOPPIONI. Ventotto foto non sono ventotto tagli: alcune
 *     sono lo stesso taglio fotografato da un'altra parte. Due frasi scritte
 *     in libertà non si confrontano; due schede con gli stessi campi sì, e il
 *     confronto lo fa il codice invece dell'occhio — che su ventotto foto si
 *     stanca e sbaglia.
 *   · a REPLICARLO. La descrizione lunga finisce dentro al testo che genera
 *     l'immagine: «lati sfumati a pelle sopra l'orecchio» è un vincolo, una
 *     fotografia da sola è un suggerimento.
 *
 *  ⚠️ Costa un millesimo di un'immagine a foto: leggerle tutte vale meno di
 *   una singola generazione sbagliata.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARTELLA = process.argv[2] || join(process.env.HOME, "Desktop", "Imm");
const USCITA = join(radice, "prove", "tagli-letti.json");

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

const DOMANDA = `You are a master barber. Look ONLY at the haircut in this photo and fill in this JSON, nothing else:
{
 "lati": "skin-fade | high-fade | mid-fade | low-fade | tapered | scissor-cut-short | left-long",
 "sopra_cm": <number, hair length on top in centimetres>,
 "texture": "straight | wavy | curly | coily",
 "direzione": "back | side | forward | up | down | middle-part | none",
 "riga": "hard-line | soft-side-part | middle | none",
 "frangia": "none | short-fringe | full-fringe | long-fringe",
 "lunghezza": "buzz | short | medium | long",
 "famiglia": "corti | sfumati | classici | mossi | ricci | lunghi",
 "nome_it": "<two or three Italian words a barber would use, e.g. 'Sfumato con ciuffo'>",
 "descrizione_en": "<one dense sentence, max 55 words, specifying the cut to another barber: sides and back first, then top length and volume, styling direction, parting, texture, fringe. No face, no colour, no lighting, no background.>"
}
Reply with the JSON only, no markdown fence.`;

async function leggi(file) {
  const b64 = readFileSync(file).toString("base64");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHIAVE}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: DOMANDA },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
        ],
      }],
    }),
  });
  const b = await r.json();
  const c = b?.choices?.[0]?.message?.content;
  const testo = typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p?.text || "").join("") : "";
  const pulito = testo.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  return JSON.parse(pulito);
}

//  ⚠️ Si riparte da dove si era arrivati: se il credito finisce a metà, la
//   volta dopo non si ripaga quello che si è già letto.
const fatte = existsSync(USCITA) ? JSON.parse(readFileSync(USCITA, "utf8")) : {};
const file = readdirSync(CARTELLA).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();

for (const f of file) {
  if (fatte[f]) { console.log(`· ${f} … c'era già`); continue; }
  process.stdout.write(`· ${f} … `);
  try {
    fatte[f] = await leggi(join(CARTELLA, f));
    console.log(`${fatte[f].nome_it} (${fatte[f].famiglia})`);
  } catch (e) {
    console.log(`NO — ${String(e.message || e).slice(0, 120)}`);
  }
  writeFileSync(USCITA, JSON.stringify(fatte, null, 2));
}

console.log(`\n${Object.keys(fatte).length} schede in ${USCITA}`);
