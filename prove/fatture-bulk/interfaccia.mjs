/** ── FATTURE BULK · T13 · L'INTERFACCIA (prove di sorgente) ────────────────
 *  I componenti sono React e qui non si disegnano (l'aspetto si prova nel browser, T14).
 *  Si guarda il CODICE: l'interfaccia non deve rifare i conti né toccare l'emissione di
 *  oggi, e non deve far uscire dati personali. Commenti e righe di commento non contano. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = ["FinestraBulk", "AnteprimaBulk", "PannelloRigaBulk", "RiepilogoEmissioneBulk"];

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("BULK · T13 · INTERFACCIA · SOLO MOSTRA, NON DECIDE");
  const codice = (nome) =>
    readFileSync(join(radice, `src/crm/fatture/bulk/${nome}.tsx`), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  for (const nome of FILE) {
    const src = codice(nome);
    c(
      `${nome}: non importa problemiXml, conti, emetti, né valutaRiga; niente console, localStorage, sessionStorage`,
      [false, false, false, false, false, false, false],
      [
        /\bproblemiXml\b/.test(src),
        /\bcontoDaLordo\b|\baliquotaPredefinita\b/.test(src),
        /\bemetti(Su|ProtettoSu)?\s*\(/.test(src),
        /\bvalutaRiga\b|\bvalutaLotto\b|\bstatoDi\b|\besaminaRiga\b/.test(src),
        /console\./.test(src),
        /localStorage/.test(src),
        /sessionStorage/.test(src),
      ],
    );
    c(
      `${nome}: nessuna chiamata diretta a fetch (si passa da useLotto / fetchCRM)`,
      false,
      /(^|[^.\w])fetch\(/.test(src),
    );
  }
  const fin = codice("FinestraBulk");
  c(
    "la descrizione è solo DESCRIZIONI[0], senza campo libero né scelta",
    [true, false],
    [/DESCRIZIONI\[0\]/.test(fin), /DESCRIZIONI\.map|DESCRIZIONI\.length|<select/.test(fin)],
  );
  const pann = codice("PannelloRigaBulk");
  c(
    "il pannello manda una cosa sola per richiesta: mai una correzione insieme a una conferma",
    false,
    /salva\(\{[^}]*modifiche[^}]*conferma(Riga|Avvisi)|salva\(\{[^}]*conferma(Riga|Avvisi)[^}]*modifiche/.test(
      pann,
    ),
  );
  const pagina = readFileSync(join(radice, "src/routes/CRM.fatture.tsx"), "utf8");
  c(
    "la pagina Fatture: il comando e il componente compaiono solo con il permesso «pagamenti»",
    [true, true],
    [
      /usePuo\(\)\("pagamenti"\)/.test(pagina),
      /\{puoBulk && \(\s*<CaricaInBloccoFatture/.test(pagina),
    ],
  );
}
