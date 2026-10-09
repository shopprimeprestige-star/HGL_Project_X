/** ── FATTURE FINTE, MA FATTE COME QUELLE VERE ──────────────────────────────
 *
 *  ⚠️ UN PDF COSTRUITO IN DUE RIGHE NON PROVA NIENTE, ed è la lezione che
 *  questo file esiste per non far ridimenticare. Per giorni il lettore ha
 *  passato ogni prova su file con UN flusso solo e un font normale, e non
 *  leggeva una parola da nessuna fattura vera. I generatori veri fanno tre
 *  cose che quei file non facevano:
 *   · posizionano ogni riga con `Tm`, non con `Td`;
 *   · scrivono in array `TJ` con la crenatura in mezzo alle parole;
 *   · incorporano i font RITAGLIATI, con una codifica loro e una tabella
 *     `/ToUnicode` a dire quale byte è quale lettera.
 *  Le fatture qui sotto le fanno tutte e tre. Chi ne aggiunge una, la faccia
 *  somigliare a un documento vero e non a un file di prova.
 *  ───────────────────────────────────────────────────────────────────────── */
import { deflateSync } from "node:zlib";

/** Un generatore di numeri prevedibile: le prove non devono cambiare esito
 *  fra un'esecuzione e l'altra. */
function caso(seme) {
  let s = seme;
  return (n) => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s % n;
  };
}

const proteggi = (t) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** La riga come la scrive un generatore vero: spezzata in frammenti con la
 *  crenatura in mezzo alle parole. */
function arrayTJ(riga, dado, codifica) {
  const pezzi = [];
  let i = 0;
  while (i < riga.length) {
    const n = 2 + dado(6);
    const grezzo = riga.slice(i, i + n);
    pezzi.push(`(${codifica ? codifica(grezzo) : proteggi(grezzo)})`);
    i += n;
    if (i < riga.length) pezzi.push(String([-12, -8, 5, 18, -20, 3][dado(6)]));
  }
  return `[${pezzi.join(" ")}] TJ`;
}

function componi(oggetti, coda = "<</Size 9 /Root 1 0 R>>") {
  let out = Buffer.from("%PDF-1.5\n", "latin1");
  for (const [n, corpo] of oggetti) {
    out = Buffer.concat([
      out,
      Buffer.from(`${n} 0 obj\n`, "latin1"),
      Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo, "latin1"),
      Buffer.from("\nendobj\n", "latin1"),
    ]);
  }
  const x = out.length;
  return Buffer.concat([out, Buffer.from(`trailer\n${coda}\nstartxref\n${x}\n%%EOF`, "latin1")]);
}

const flusso = (dizionario, dati) => {
  const z = deflateSync(Buffer.from(dati, "latin1"));
  return Buffer.concat([
    Buffer.from(`<<${dizionario} /Filter /FlateDecode /Length ${z.length}>>\nstream\n`, "latin1"),
    z,
    Buffer.from("\nendstream", "latin1"),
  ]);
};

/** Una fattura come la stampa un browser: `Tm` a ogni riga, array `TJ`. */
export function pdfStampato(righe, { seme = 7 } = {}) {
  const dado = caso(seme);
  let c = "BT\n/F1 11 Tf\n";
  let y = 780;
  for (const r of righe) {
    c += `1 0 0 1 40 ${y} Tm\n${arrayTJ(r, dado)}\n`;
    y -= 16;
  }
  c += "ET";
  return componi([
    [1, "<</Type /Catalog /Pages 2 0 R>>"],
    [2, "<</Type /Pages /Kids [3 0 R] /Count 1>>"],
    [
      3,
      "<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>",
    ],
    [4, flusso("", c)],
    [5, "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding>>"],
  ]);
}

/** ── LA PIÙ CATTIVA: FONT RITAGLIATO E OGGETTI DENTRO UN FLUSSO ───────────
 *  I byte non sono lettere — a ogni carattere usato si assegna un codice
 *  nuovo, come fa un vero sottoinsieme di font — e il dizionario del font non
 *  sta in chiaro nel file ma dentro un `/ObjStm`. Sono i due casi che, presi
 *  separatamente, hanno fatto uscire prima niente e poi spazzatura. */
export function pdfFontRitagliato(righe, { seme = 3 } = {}) {
  const dado = caso(seme);
  const codice = new Map();
  for (const r of righe) for (const ch of r) if (!codice.has(ch)) codice.set(ch, codice.size + 1);
  if (codice.size > 255) throw new Error("troppi caratteri diversi per un font a un byte");
  const scrivi = (s) =>
    [...s].map((ch) => `\\${codice.get(ch).toString(8).padStart(3, "0")}`).join("");

  let c = "BT\n/F1 11 Tf\n";
  let y = 780;
  for (const r of righe) {
    c += `1 0 0 1 40 ${y} Tm\n${arrayTJ(r, dado, scrivi)}\n`;
    y -= 16;
  }
  c += "ET";

  const esa = (n, cifre) => n.toString(16).padStart(cifre, "0").toUpperCase();
  const voci = [...codice.entries()]
    .map(([ch, v]) => `<${esa(v, 2)}> <${esa(ch.charCodeAt(0), 4)}>`)
    .join("\n");
  const cmap =
    "/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n" +
    "/CMapName /Adobe-Identity-UCS def\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n" +
    `${codice.size} beginbfchar\n${voci}\nendbfchar\nendcmap end end`;

  const dentro = [
    [1, "<</Type /Catalog /Pages 2 0 R>>"],
    [2, "<</Type /Pages /Kids [3 0 R] /Count 1>>"],
    [
      3,
      "<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>",
    ],
    [5, "<</Type /Font /Subtype /TrueType /BaseFont /ABCDEF+Arial /ToUnicode 6 0 R>>"],
  ];
  const testa = [];
  const corpi = [];
  let off = 0;
  for (const [n, t] of dentro) {
    testa.push(`${n} ${off}`);
    corpi.push(t);
    off += t.length + 1;
  }
  const intestazione = `${testa.join(" ")}\n`;
  return componi([
    [4, flusso("", c)],
    [6, flusso("", cmap)],
    [
      7,
      flusso(
        `/Type /ObjStm /N ${dentro.length} /First ${intestazione.length}`,
        intestazione + corpi.join(" "),
      ),
    ],
  ]);
}

/** Un PDF protetto: i flussi ci sono ma non si aprono. */
export const pdfProtetto = () =>
  componi([[1, "<</Type /Catalog>>"]], "<</Size 2 /Root 1 0 R /Encrypt 8 0 R>>");

/** La scansione: dentro non c'è nessun testo, solo un'immagine. */
export const pdfScansione = () =>
  componi([
    [1, "<</Type /Catalog /Pages 2 0 R>>"],
    [2, flusso("/Type /XObject /Subtype /Image /Width 4 /Height 4", "    ")],
  ]);
