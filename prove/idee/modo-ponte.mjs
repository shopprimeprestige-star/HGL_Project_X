/** ── PROVA: Conversazione.tsx, il ramo `modoPonte` (commessa 2026-11-13, T5→T7, filo C) ──
 *
 *  `Conversazione.tsx` non è una funzione pura (componente React, nessuna prova
 *  automatica lo copre: lo dice PIANO.md) e `prove/prove.mjs` è un file condiviso
 *  con gli altri fili in corso in parallelo nello stesso worktree — non lo tocco
 *  per non scrivere sopra il lavoro di qualcun altro. Questa prova si lancia da
 *  sola:
 *
 *    node prove/idee/modo-ponte.mjs
 *
 *  Stesso schema già in produzione per questo file (`prove/idee/rispiega.mjs`,
 *  `prove/idee/ai.mjs`): un controllo di testo sul sorgente, non sul disegno.
 *  Verifica il punto a rischio di regressione più alto della commessa: che
 *  senza `modoPonte` nessuna riga eseguita cambi (le condizioni restano quelle
 *  di oggi, solo con `!modoPonte &&` davanti, che a `undefined` vale sempre
 *  `true` e non cambia niente), e che con `modoPonte` il tocco lungo sulla
 *  bolla sia spento ovunque (punto 2 della revisione del piano v1).
 *  ⚠️ Nessun dato reale: solo testo del componente.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const leggi = (f) => readFileSync(join(radice, f), "utf8");
const senzaCommenti = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

let falliti = 0;
function c(descrizione, atteso, effettivo) {
  const ok = JSON.stringify(atteso) === JSON.stringify(effettivo);
  if (ok) {
    console.log(`✓ ${descrizione}`);
  } else {
    falliti++;
    console.error(
      `✗ ${descrizione}\n  atteso:   ${JSON.stringify(atteso)}\n  ottenuto: ${JSON.stringify(effettivo)}`,
    );
  }
}

const tipi = leggi("src/crm/chatwa/tipi.ts");
const conv = senzaCommenti(leggi("src/crm/chatwa/Conversazione.tsx"));

console.log("MODO PONTE · tipi.ts (T5)");
c(
  "WaContactRow guadagna ha_messaggio_ponte, facoltativo",
  true,
  /ha_messaggio_ponte\?:\s*boolean \| null;/.test(tipi),
);
c(
  "ConversazioneProps guadagna modoPonte, facoltativo (booleano, non obbligatorio)",
  true,
  /modoPonte\?:\s*boolean;/.test(tipi),
);

console.log("\nMODO PONTE · Conversazione.tsx (T7)");
c(
  "il componente legge modoPonte dalle sue props",
  true,
  /export function Conversazione\(\{[\s\S]{0,400}modoPonte[\s\S]{0,40}\}: ConversazioneProps\)/.test(
    conv,
  ),
);
c(
  "ogni bolla riceve rispiega={undefined} a modoPonte vero: !modoPonte è la PRIMA condizione, le altre tre restano identiche a prima",
  true,
  /rispiega=\{\s*!modoPonte && !ai\.attivo && !bolla && selezionabile\(m\)\s*\?\s*\{/.test(conv),
);
c(
  "il tasto flottante «Rispondi con AI» si spegne con !modoPonte davanti alla condizione di oggi",
  true,
  /\{!modoPonte && !ai\.attivo && messaggi\.some\(\(m\) => m\.body\?\.trim\(\)\) && \(/.test(conv),
);
c(
  "«Bozza AI pronta» si spegne con !modoPonte davanti alla condizione di oggi",
  true,
  /\{!modoPonte && !ai\.attivo && bozzaAi\.bozza\?\.risposta && \(/.test(conv),
);
c(
  "a modoPonte vero: niente BarraRispiega/BarraRispostaAi, niente Casella — solo la fascia fissa",
  true,
  /\{modoPonte \? \(/.test(conv) &&
    /Per rispondere usa WhatsApp sul telefono o la chat del CRM/.test(conv) &&
    /\) : ai\.attivo \? \(/.test(conv),
);
c(
  "la fascia fissa non legge api.ponte né alcuna eleggibilità (sola lettura incondizionata)",
  false,
  /modoPonte \? \([^)]*api\.ponte/.test(conv),
);
c(
  "a NON modoPonte: la Casella resta montata con le stesse props di prima (riga identica)",
  true,
  /<Casella api=\{api\} linkWa=\{nativo\?\.href\} onFissaAppuntamento=\{onFissaAppuntamento\} \/>/.test(
    conv,
  ),
);
c(
  "a NON modoPonte: le barre AI restano montate con le stesse props di prima (righe identiche)",
  true,
  /<BarraRispiega ai=\{ai\} messaggi=\{messaggi\} \/>/.test(conv) &&
    /<BarraRispostaAi ai=\{ai\} \/>/.test(conv),
);
c(
  "gli hook useRispostaAi/useBozzaAi restano chiamati sempre (niente hook condizionali)",
  true,
  /const ai = useRispostaAi\(\{/.test(conv) && /const bozzaAi = useBozzaAi\(\{/.test(conv),
);

if (falliti > 0) {
  console.error(`\n${falliti} prova/e fallite.`);
  process.exit(1);
}
console.log("\nTutte le prove sono passate.");
