/** ── IL LETTORE DEI FILE CSV (EDITOR PRODOTTI · E2a) ────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, SPEC §6.1. Scritto a mano, nessun pacchetto: da byte a righe di celle, e basta.
 *  Le colonne, i prezzi e le regole dei prodotti stanno altrove (E2b): qui si legge SOLO il file.
 *
 *  Il file viene da fuori, quindi si tratta come ostile:
 *   - i limiti (2 MB, Excel, 5000 righe) si guardano PRIMA di leggere: `controllaFile` sul `File` prima di `arrayBuffer()`,
 *     `leggiCsv` ripete gli stessi controlli sui byte (chi lo chiama non deve ricordarseli);
 *   - lettura lineare: si scorre il testo una volta, le celle si tagliano con `slice` (mai `+=` carattere per carattere);
 *   - virgolette non chiuse: errore con il numero di riga, non un file intero trasformato in una cella;
 *   - NUL, caratteri di controllo e di direzione del testo (bidi) tolti dalle celle, con un avviso;
 *   - nessun oggetto con chiavi scelte dal file: l'esito è fatto di array. */

export const MAX_BYTE = 2 * 1024 * 1024;
/** Righe di dati (l'intestazione non conta). */
export const MAX_RIGHE = 5000;
/** Il tetto di una cella per i prodotti: lo applica E2b, riga per riga, con la frase giusta. Qui è solo la misura. */
export const MAX_CELLA = 6000;
/** Una cella oltre questo non è un testo: è un file rotto (di solito virgolette mai chiuse). shortcut: tetto fisso, da alzare se serve. */
export const MAX_CELLA_LETTURA = 50_000;

export type EsitoCsv =
  | { ok: true; record: string[][]; separatore: "," | ";"; codifica: "utf-8" | "windows-1252"; avvisi: string[] }
  | { ok: false; frase: string };

const FRASE_EXCEL = "Questo è un file Excel, non un CSV: in Excel scegli «Salva con nome» e poi «CSV UTF-8», poi riprova.";
const FRASE_GRANDE = "Il file è troppo grande: il limite è 2 MB. Dividilo in più file.";
const FRASE_VUOTO = "Il file è vuoto.";

/** Caratteri che non sono testo: NUL, controlli (tranne tab e a capo), DEL, C1, e quelli che girano il verso della scrittura. */
// eslint-disable-next-line no-control-regex
const INVISIBILI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩]/g;
/** Quello che resta di un carattere non letto: il segno «�» di UTF-8 e i cinque byte che Windows-1252 non definisce. */
const ROTTI = /[�\u0081\u008D\u008F\u0090\u009D]/g;

/** Si chiama sul `File` PRIMA di `arrayBuffer()`: un file enorme o un Excel non si legge nemmeno. */
export function controllaFile(file: { name: string; size: number }): { ok: true } | { ok: false; frase: string } {
  const nome = String(file.name ?? "").toLowerCase();
  if (nome.endsWith(".xlsx") || nome.endsWith(".xls") || nome.endsWith(".xlsm")) return { ok: false, frase: FRASE_EXCEL };
  if (!nome.endsWith(".csv")) return { ok: false, frase: "Scegli un file con estensione .csv." };
  if (!(file.size > 0)) return { ok: false, frase: FRASE_VUOTO };
  if (file.size > MAX_BYTE) return { ok: false, frase: FRASE_GRANDE };
  return { ok: true };
}

const ecc = (frase: string): EsitoCsv => ({ ok: false, frase });

/** Dai byte del file alle righe di celle. Le righe vuote restano (`[""]`): il numero di riga di Excel è la posizione + 1. */
export function leggiCsv(byte: Uint8Array): EsitoCsv {
  if (byte.length === 0) return ecc(FRASE_VUOTO);
  if (byte.length > MAX_BYTE) return ecc(FRASE_GRANDE);
  // «PK\x03\x04» è uno zip, cioè un .xlsx; «D0 CF 11 E0» è il vecchio .xls.
  if (byte.length >= 4 && ((byte[0] === 0x50 && byte[1] === 0x4b && byte[2] === 0x03 && byte[3] === 0x04) || (byte[0] === 0xd0 && byte[1] === 0xcf && byte[2] === 0x11 && byte[3] === 0xe0))) return ecc(FRASE_EXCEL);
  if (byte.length >= 2 && ((byte[0] === 0xff && byte[1] === 0xfe) || (byte[0] === 0xfe && byte[1] === 0xff))) return ecc("Il file è salvato in UTF-16: in Excel scegli «CSV UTF-8» e riprova.");

  const avvisi: string[] = [];
  let codifica: "utf-8" | "windows-1252" = "utf-8";
  let testo: string;
  try {
    testo = new TextDecoder("utf-8", { fatal: true }).decode(byte);
  } catch {
    codifica = "windows-1252";
    // I cinque byte che Windows-1252 non definisce non si leggono: diventano «�», così si contano come caratteri rotti.
    testo = new TextDecoder("windows-1252").decode(byte).replace(/[\u0081\u008D\u008F\u0090\u009D]/g, "\uFFFD");
  }
  if (testo.charCodeAt(0) === 0xfeff) testo = testo.slice(1);

  const rotti = testo.match(ROTTI)?.length ?? 0;
  if (rotti > 0) avvisi.push(`${rotti === 1 ? "C'è 1 carattere che non riesco a leggere" : `Ci sono ${rotti} caratteri che non riesco a leggere`} (accenti o simboli): controlla i testi dopo l'anteprima.`);
  const pulito = testo.replace(INVISIBILI, "");
  const tolti = testo.length - pulito.length;
  if (tolti > 0) avvisi.push(`Ho tolto ${tolti} ${tolti === 1 ? "carattere invisibile o di controllo" : "caratteri invisibili o di controllo"} dalle celle, per sicurezza.`);

  const separatore = riconosciSeparatore(pulito);
  const lette = leggiRighe(pulito, separatore === ";" ? 59 : 44);
  if (!lette.ok) return lette;
  return { ok: true, record: lette.record, separatore, codifica, avvisi };
}

/** Dalla riga d'intestazione: più punti e virgola che virgole (fuori dalle virgolette) → «;». Nel dubbio, la virgola. */
function riconosciSeparatore(t: string): "," | ";" {
  let virgole = 0;
  let puntiVirgola = 0;
  let dentro = false;
  for (let i = 0; i < t.length; i++) {
    const k = t.charCodeAt(i);
    if (k === 34) dentro = !dentro;
    else if (dentro) continue;
    else if (k === 44) virgole++;
    else if (k === 59) puntiVirgola++;
    else if (k === 10 || k === 13) break;
  }
  return puntiVirgola > virgole ? ";" : ",";
}

function leggiRighe(t: string, sep: number): { ok: true; record: string[][] } | { ok: false; frase: string } {
  const n = t.length;
  const record: string[][] = [];
  let riga: string[] = [];
  let vuote = 0; // righe vuote in attesa: se il file finisce così non sono prodotti, e non si tengono in memoria
  let i = 0;
  const troppe = ecc(`Il file ha troppe righe: il limite è ${MAX_RIGHE} (intestazione esclusa). Dividilo in più file.`);
  /** Chiude la riga in corso; `false` se si sfora il limite. */
  const chiudiRiga = (): boolean => {
    if (riga.length === 1 && riga[0] === "") vuote++;
    else {
      for (; vuote > 0; vuote--) record.push([""]);
      record.push(riga);
    }
    riga = [];
    return record.length <= MAX_RIGHE + 1;
  };
  while (i < n) {
    // ── una cella ──
    let cella: string;
    if (t.charCodeAt(i) === 34) {
      const rigaDiInizio = record.length + 1;
      i++;
      const pezzi: string[] = [];
      let da = i;
      let lunghezza = 0;
      for (;;) {
        const q = t.indexOf('"', i);
        if (q < 0) return ecc(`Alla riga ${rigaDiInizio} c'è una virgoletta aperta e mai chiusa: controlla il file.`);
        lunghezza += q - da;
        if (lunghezza > MAX_CELLA_LETTURA) return ecc(`La cella alla riga ${rigaDiInizio} è lunghissima (oltre ${MAX_CELLA_LETTURA} caratteri): di solito è una virgoletta mai chiusa. Controlla il file.`);
        if (t.charCodeAt(q + 1) === 34) {
          pezzi.push(t.slice(da, q + 1)); // «""» dentro le virgolette è una virgoletta sola
          i = q + 2;
          da = i;
          continue;
        }
        pezzi.push(t.slice(da, q));
        i = q + 1;
        break;
      }
      // Dopo la virgoletta di chiusura Excel tollera altro testo fino al separatore: lo si accoda com'è.
      const coda = i;
      while (i < n) {
        const k = t.charCodeAt(i);
        if (k === sep || k === 10 || k === 13) break;
        i++;
      }
      if (i > coda) pezzi.push(t.slice(coda, i));
      cella = pezzi.length === 1 ? pezzi[0] : pezzi.join("");
    } else {
      const da = i;
      while (i < n) {
        const k = t.charCodeAt(i);
        if (k === sep || k === 10 || k === 13) break;
        i++;
      }
      cella = t.slice(da, i);
    }
    if (cella.length > MAX_CELLA_LETTURA) return ecc(`Una cella alla riga ${record.length + 1} è lunghissima (oltre ${MAX_CELLA_LETTURA} caratteri): controlla il file.`);
    riga.push(cella);

    // ── dopo la cella: fine file, separatore o a capo ──
    if (i >= n) break;
    const k = t.charCodeAt(i);
    if (k === sep) {
      i++;
      if (i >= n) riga.push(""); // il file finisce subito dopo un separatore: c'è una cella vuota
      continue;
    }
    i += k === 13 && t.charCodeAt(i + 1) === 10 ? 2 : 1;
    if (!chiudiRiga()) return troppe;
  }
  if (riga.length > 0 && !chiudiRiga()) return troppe; // l'ultima riga senza a capo in fondo
  return { ok: true, record };
}
