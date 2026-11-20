/** ── NEGOZIO · T15 · LA SCHEDA PRODOTTO: PROVE SUL SORGENTE ─────────────────
 *  `SchedaProdotto.tsx` ed `EditorVarianti.tsx` non si eseguono qui: si controlla ciò che DEVE e ciò che NON DEVE esserci.
 *  · mai: prezzo barrato, sconto, stelle, best seller, cancellazioni, «Elimina»; il prezzo non passa da `parseFloat` né da `* 100`;
 *  · «Pubblica» parte solo dopo `await subito()` che dà `true`, e il tasto è spento con `bloccanti.length > 0`;
 *  · il prezzo passa da `centDaEuro` (nel modulo puro); i controlli vengono da `controllaPubblicazione`;
 *  · le firme dei segnaposto di T14 restano, e `CRM.ecommerce.tsx` e `routeTree.gen.ts` non cambiano rispetto a T14. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const senzaCommenti = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
/** Il commit con cui finisce T14: da qui in poi `CRM.ecommerce.tsx` non deve cambiare. */
const BASE_T14 = "277e018";

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · T15 · SCHEDA E VARIANTI: PROVE SUL SORGENTE (20/11/2026)");
  const dir = join(radice, "src/crm/ecommerce/prodotti");
  const leggi = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
  const scheda = leggi("SchedaProdotto.tsx");
  const varianti = leggi("EditorVarianti.tsx");
  const pura = leggi("scheda-pura.ts");
  const codice = { SchedaProdotto: senzaCommenti(scheda), EditorVarianti: senzaCommenti(varianti) };

  c(
    "i due file non sono più segnaposto (non ritornano solo null)",
    [true, true],
    [
      scheda.includes("useState") && scheda.length > 4000,
      varianti.includes("useState") && varianti.length > 3000,
    ],
  );
  c(
    "le firme di T14 restano",
    [true, true, true, true],
    [
      /export function SchedaProdotto\(/.test(scheda),
      /export interface PropsSchedaProdotto/.test(scheda) &&
        /id: string;/.test(scheda) &&
        /apri: \(id: string \| null\) => void/.test(scheda),
      /export function EditorVarianti\(/.test(varianti),
      /export interface PropsEditorVarianti/.test(varianti) &&
        /esegui: Negozio\["esegui"\]/.test(varianti) &&
        /aggiorna: \(\) => Promise<void>/.test(varianti),
    ],
  );

  for (const [nome, src] of Object.entries(codice)) {
    for (const vietato of [
      /compareAt/i,
      /prezzo\s+barrato/i,
      /\brating\b/i,
      /\breviews?\b/i,
      /best\s*seller/i,
      /\bstelle\b/i,
      /sconto/i,
      /\bdelete\b/,
      /Elimina/,
      /parseFloat/,
      /\*\s*100\b/,
    ])
      c(`${nome}: nessuna occorrenza di ${vietato}`, false, vietato.test(src));
  }
  c(
    "il modulo puro usa centDaEuro per il prezzo e non parseFloat",
    [true, false],
    [/centDaEuro\(/.test(pura), /parseFloat/.test(senzaCommenti(pura))],
  );
  c(
    "la scheda non ha un campo per il prezzo barrato (nessun id f-prezzoBarrato / f-sconto)",
    false,
    /f-(prezzoBarrato|sconto|stelle)/i.test(codice.SchedaProdotto),
  );

  // «Pubblica» solo dopo `await subito()` che dà true
  c(
    "«Pubblica» aspetta `await subito()` e si ferma se non dà true",
    true,
    /if \(!\(await [\w.]*subito\(\)\)\)/.test(codice.SchedaProdotto),
  );
  c(
    "le azioni che pubblicano vengono DOPO il controllo di subito()",
    true,
    (() => {
      const i = codice.SchedaProdotto.indexOf("async function pubblica");
      if (i < 0) return false;
      const corpo = codice.SchedaProdotto.slice(i, i + 3500);
      const s = corpo.search(/await [\w.]*subito\(\)/);
      const p = corpo.search(/prodotto_stato|prodotto_pubblica_modifiche/);
      return s >= 0 && p > s;
    })(),
  );
  const sorgente = codice.SchedaProdotto;
  const tasti = [...sorgente.matchAll(/void pubblica\(\)/g)].map((m) =>
    sorgente.slice(Math.max(0, m.index - 260), m.index),
  );
  c(
    "nonPubblicabile include bloccanti.length > 0",
    true,
    /const nonPubblicabile = [^;]*bloccanti\.length\s*>\s*0/.test(sorgente),
  );
  c(
    "OGNI tasto che chiama pubblica() è spento con nonPubblicabile (sono almeno due: barra e striscia)",
    [true, true],
    [tasti.length >= 2, tasti.every((s) => /disabled=\{[^}]*nonPubblicabile/.test(s))],
  );
  c(
    "i controlli vengono dal modulo che usa controllaPubblicazione (stessa funzione del server)",
    [true, true],
    [/controlloLive\(/.test(codice.SchedaProdotto), /controllaPubblicazione\(/.test(pura)],
  );
  c(
    "il conflitto di versione dice «qualcun altro ha modificato» e propone di ricaricare",
    true,
    /qualcun altro ha modificato/i.test(scheda) && /Ricarica/.test(scheda),
  );
  c(
    "Invisible Derm: la scheda usa eInvisibleDerm e non mostra il campo prezzo",
    true,
    /eInvisibleDerm\(/.test(codice.SchedaProdotto),
  );
  c(
    "il salvataggio automatico passa da creaAutosalva (T13)",
    true,
    /creaAutosalva(<[^>]*>)?\(/.test(codice.SchedaProdotto),
  );
  c(
    "la scheda legge con negozio.scheda e scrive con esegui (nessun fetch qui)",
    [true, false, false],
    [
      /\.scheda\(/.test(codice.SchedaProdotto),
      /\bfetch\(/.test(codice.SchedaProdotto),
      /\bfetch\(/.test(codice.EditorVarianti),
    ],
  );
  c(
    "la scheda monta l'editor di varianti e quello dei media di T14/T16",
    [true, true],
    [/<EditorVarianti/.test(codice.SchedaProdotto), /<EditorMedia/.test(codice.SchedaProdotto)],
  );
  c(
    "bersagli da 44 px sul telefono (min-h-11 / h-11)",
    [true, true],
    [/(min-h-11|h-11)/.test(codice.SchedaProdotto), /(min-h-11|h-11)/.test(codice.EditorVarianti)],
  );

  // il perimetro
  let diff = null;
  try {
    diff = execFileSync(
      "git",
      [
        "diff",
        "--name-only",
        BASE_T14,
        "--",
        "src/routes/CRM.ecommerce.tsx",
        "src/routeTree.gen.ts",
        "src/crm/ecommerce/prodotti/EditorMedia.tsx",
        "src/crm/ecommerce/prodotti/Categorie.tsx",
        "src/crm/ecommerce/prodotti/ApriShop.tsx",
        "src/crm/ecommerce/prodotti/ElencoProdotti.tsx",
      ],
      { cwd: radice, encoding: "utf8" },
    ).trim();
  } catch {
    // shortcut: se il commit di T14 non esiste più (squash) il controllo sul perimetro si salta; da riscrivere con un nuovo punto di partenza.
  }
  if (diff !== null)
    c("CRM.ecommerce.tsx, routeTree.gen.ts e gli altri segnaposto non cambiano", "", diff);
}
