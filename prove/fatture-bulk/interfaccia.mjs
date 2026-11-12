/** ── FATTURE BULK · T13 · L'INTERFACCIA (prove di sorgente) ────────────────
 *  I componenti sono React e qui non si disegnano (l'aspetto si prova nel browser, T14).
 *  Si guarda il CODICE: l'interfaccia non deve rifare i conti né toccare l'emissione di
 *  oggi, e non deve far uscire dati personali. Commenti e righe di commento non contano. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

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
  // «Una cosa per richiesta» è una funzione pura (cambio-riga.ts): si impacchetta e si prova davvero.
  const esbuild = createRequire(import.meta.url)("esbuild");
  const impacchettato = esbuild.buildSync({
    entryPoints: [join(radice, "src/crm/fatture/bulk/cambio-riga.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  }).outputFiles[0].text;
  const { controllaCambio } = await import(
    `data:text/javascript;base64,${Buffer.from(impacchettato).toString("base64")}`
  );
  c(
    "una cosa per richiesta: ognuna da sola va bene",
    [null, null, null, null, null, null],
    [
      controllaCambio({ modifiche: { cap: "00100" } }),
      controllaCambio({ scheda: null }),
      controllaCambio({ confermaRiga: false }),
      controllaCambio({ confermaAvvisi: ["importo_alto"] }),
      controllaCambio({ scarta: true }),
      controllaCambio({ modifiche: {}, confermaAvvisi: [] }),
    ],
  );
  c(
    "il caso misto (correzione + conferma, scheda + conferma, avvisi + riga, scarto + correzione) è rifiutato",
    [true, true, true, true],
    [
      controllaCambio({ modifiche: { importo: 104 }, confermaRiga: true }),
      controllaCambio({ scheda: "x", confermaRiga: true }),
      controllaCambio({ confermaAvvisi: ["a"], confermaRiga: true }),
      controllaCambio({ scarta: true, modifiche: { cap: "1" } }),
    ].map((x) => typeof x === "string" && x.length > 0),
  );
  c(
    "il pannello chiama controllaCambio prima di ogni salvataggio",
    true,
    /controllaCambio\(cambio\)/.test(pann) && /throw new Error\(problema\)/.test(pann),
  );
  const ant = codice("AnteprimaBulk");
  c(
    "l'ingrandimento non usa l'indirizzo scaduto dell'immagine: chiede un indirizzo nuovo al clic",
    [false, true],
    [/<a\s[^>]*href=/.test(ant), /ingrandisci\(/.test(ant) && /window\.open\(/.test(ant)],
  );
  const fin2 = codice("RiepilogoEmissioneBulk");
  c(
    "riepilogo finale: dice che l'ultima riga può essere incerta e non dice più «rimaste come prima»",
    [true, false],
    [
      /L'ultima riga può risultare incerta/.test(fin2) && /AVVISO_ULTIMA_RIGA\}/.test(fin2),
      /rimaste come prima/.test(fin2),
    ],
  );
  c(
    "i campi di testo del pannello non si disabilitano durante il salvataggio",
    false,
    /<CampoTesto[^>]*disabilitato/.test(pann.replace(/\n/g, " ")),
  );
  c(
    "il riquadro «in corso» non compare a lotto chiuso",
    true,
    /inMemoria && !aperta && !stato\.lottoChiuso/.test(fin),
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
