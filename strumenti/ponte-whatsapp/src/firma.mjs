/** ── PONTE WHATSAPP · LA FIRMA DEI BYTE DEI MEDIA ────────────────────────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T5 (PIANO a.1, a.2, D2).
 *  PURO: niente disco, niente rete, nessuna dipendenza. Il mime di un media lo
 *  decidono i BYTE, non il mittente:
 *   · `normalizzaMime(categoria, dichiarato)`: il mime dichiarato dal mittente,
 *     ripulito (`audio/ogg; codecs=opus` → `audio/ogg`) e ammesso solo se sta
 *     nell'elenco della categoria. Si usa PRIMA del permesso;
 *   · `mimeDaByte(categoria, byte, { nome })`: il mime canonico che i primi byte
 *     dimostrano, solo se appartiene alla categoria. Si usa DOPO il download, e
 *     il PUT parte con questo `Content-Type`;
 *   · `categoriaDaMime(mime)`: la famiglia di un mime canonico (per confrontare
 *     dichiarato e byte: se le famiglie differiscono il file si scarta).
 *  La categoria viene dal tipo del messaggio (imageMessage, audioMessage…), mai
 *  dal mime. Fuori elenco (ZIP, eseguibili, HTML, SVG, XML, script, OLE, txt,
 *  csv…) → null: segnaposto, mai scaricati.
 *
 *  ⚠️ La tabella dei mime è una copia di quella di `media-tipi.ts` e della
 *  migrazione A (PIANO a.1): la prova di parità (T11) le confronta.
 *  ───────────────────────────────────────────────────────────────────────── */

const OOXML = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/** I mime canonici di ogni categoria (PIANO a.1). */
export const MIME_PER_CATEGORIA = {
  foto: ["image/jpeg", "image/png", "image/webp"],
  audio: ["audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/amr"],
  video: ["video/mp4", "video/3gpp", "video/quicktime", "video/webm"],
  documento: ["application/pdf", OOXML.docx, OOXML.xlsx, OOXML.pptx],
};

/** Come un mittente o un telefono può scrivere lo stesso tipo (minuscolo, senza parametri). */
const ALIAS = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "audio/opus": "audio/ogg",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/mp3": "audio/mpeg",
  "audio/x-mp3": "audio/mpeg",
  "audio/x-mpeg": "audio/mpeg",
  "audio/x-aac": "audio/aac",
  "video/3gp": "video/3gpp",
  "application/x-pdf": "application/pdf",
};

const MIME_DI_CATEGORIA = new Map(Object.entries(MIME_PER_CATEGORIA).flatMap(([cat, elenco]) => elenco.map((m) => [m, cat])));

/** La categoria di un mime canonico, oppure null. */
export function categoriaDaMime(mime) {
  return typeof mime === "string" ? (MIME_DI_CATEGORIA.get(mime) ?? null) : null;
}

/** Il mime dichiarato dal mittente → un mime canonico DELLA CATEGORIA, oppure null. */
export function normalizzaMime(categoria, dichiarato) {
  //  hasOwn: «constructor», «__proto__» esistono su ogni oggetto e non sono categorie né alias
  if (!Object.hasOwn(MIME_PER_CATEGORIA, categoria) || typeof dichiarato !== "string" || dichiarato.length > 200) return null;
  const t = dichiarato.split(";")[0].trim().toLowerCase();
  const m = Object.hasOwn(ALIAS, t) ? ALIAS[t] : t;
  return MIME_PER_CATEGORIA[categoria].includes(m) ? m : null;
}

const uguali = (b, da, testo) => {
  for (let i = 0; i < testo.length; i++) if (b[da + i] !== testo.charCodeAt(i)) return false;
  return true;
};
/** La marca di un `ftyp` a offset 4 (4 caratteri), oppure null. */
const marcaFtyp = (b) => (b.length >= 12 && uguali(b, 4, "ftyp") ? String.fromCharCode(b[8], b[9], b[10], b[11]) : null);

function foto(b) {
  //  come `tipoDaByte` di immagini.mjs
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && uguali(b, 1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (uguali(b, 0, "RIFF") && uguali(b, 8, "WEBP")) return "image/webp";
  return null;
}

//  Un vocale Android è spesso un mp4 con marca isom/mp42: dentro un `audioMessage` (la categoria viene dal
//  messaggio, non dai byte) vale come audio/mp4. Un video non passa di qui: ha la sua tabella.
const MARCHE_AUDIO = new Set(["M4A ", "M4B ", "M4P ", "isom", "mp42"]);
function audio(b) {
  if (b.length < 4) return null;
  if (uguali(b, 0, "OggS")) return "audio/ogg";
  if (uguali(b, 0, "#!AMR")) return "audio/amr";
  if (uguali(b, 0, "ID3")) return "audio/mpeg";
  if (MARCHE_AUDIO.has(marcaFtyp(b))) return "audio/mp4";
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) {
    //  ADTS = sincronia + "layer 00" (FF F1, FF F9); MPEG audio = sincronia + layer 01/10/11
    if ((b[1] & 0x06) === 0) return b[1] === 0xf1 || b[1] === 0xf9 ? "audio/aac" : null;
    return "audio/mpeg";
  }
  return null;
}

const MARCHE_MP4 = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash"]);
function video(b) {
  const marca = marcaFtyp(b);
  if (marca) {
    if (MARCHE_MP4.has(marca)) return "video/mp4";
    if (marca === "qt  ") return "video/quicktime";
    if (/^3g[ep]/.test(marca)) return "video/3gpp";
    return null;
  }
  //  EBML: webm solo se il DocType dice «webm» (un mkv ha altro)
  if (b.length >= 16 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    for (let i = 4; i + 4 <= Math.min(b.length, 64); i++) if (uguali(b, i, "webm")) return "video/webm";
  }
  return null;
}

function documento(b, nome) {
  //  PDF: «%PDF-» nei primi 1024 byte
  for (let i = 0; i + 5 <= Math.min(b.length, 1024 + 5); i++) if (uguali(b, i, "%PDF-")) return "application/pdf";
  //  OOXML: ZIP + estensione del nome; uno ZIP con altra estensione si scarta
  //  shortcut: non si guarda dentro lo ZIP ([Content_Types].xml), basta firma ZIP + estensione; si aggiunge se serve.
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && typeof nome === "string") {
    const estensione = /\.([A-Za-z0-9]{1,5})$/.exec(nome)?.[1]?.toLowerCase();
    return estensione && Object.hasOwn(OOXML, estensione) ? OOXML[estensione] : null;
  }
  return null;
}

const LETTORI = { foto, audio, video };

/** I primi byte di un media → il mime canonico, solo se appartiene alla `categoria`; altrimenti null.
 *  `byte`: Buffer o Uint8Array (anche solo la testa, almeno 1 KiB per i PDF). `opzioni.nome`: il nome
 *  del documento (serve per riconoscere docx/xlsx/pptx). Non lancia mai. */
export function mimeDaByte(categoria, byte, opzioni) {
  if (!(byte instanceof Uint8Array) || byte.length === 0) return null;
  if (categoria === "documento") return documento(byte, opzioni?.nome);
  return Object.hasOwn(LETTORI, categoria) ? (LETTORI[categoria](byte) ?? null) : null;
}
