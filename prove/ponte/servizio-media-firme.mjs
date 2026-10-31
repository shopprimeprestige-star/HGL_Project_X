/** ── PROVE: IL SERVIZIO SUL MAC: LA FIRMA DEI BYTE DEI MEDIA ──
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T5 (PIANO a.1, a.2, D2).
 *  Prova `strumenti/ponte-whatsapp/src/firma.mjs`: puro, nessun disco né rete.
 *  Il mime lo decidono i byte, mai il mittente: qui si provano i positivi e,
 *  soprattutto, i falsi (HTML chiamato .pdf, SVG dichiarato image/png, ZIP
 *  rinominato). Dati inventati: solo byte di intestazione.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Un file finto: l'intestazione + zeri fino a `n` byte. */
const file = (testa, n = 64) => {
  const b = Buffer.alloc(Math.max(n, testa.length));
  Buffer.from(testa).copy(b);
  return b;
};
/** `ftyp` a offset 4 con la marca data (4 caratteri). */
const ftyp = (marca) => file([0, 0, 0, 0x18, ...Buffer.from("ftyp"), ...Buffer.from(marca)]);
const testo = (s) => [...Buffer.from(s, "latin1")];

const OOXML = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export async function provePonteServizioMediaFirme(_mod, { c, gruppo, radice }) {
  const F = await import(pathToFileURL(join(radice, "strumenti/ponte-whatsapp/src/firma.mjs")).href);
  const da = (cat, b, nome) => F.mimeDaByte(cat, b, { nome });

  gruppo("PONTE WHATSAPP · IL SERVIZIO: FIRMA DEI BYTE DEI MEDIA (T5)");

  //  La tabella: identica a quella di PIANO a.1.
  c("mime canonici per categoria (PIANO a.1)", {
    foto: ["image/jpeg", "image/png", "image/webp"],
    audio: ["audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/amr"],
    video: ["video/mp4", "video/3gpp", "video/quicktime", "video/webm"],
    documento: ["application/pdf", OOXML.docx, OOXML.xlsx, OOXML.pptx],
  }, F.MIME_PER_CATEGORIA);
  c("categoriaDaMime: la famiglia di un mime canonico", ["foto", "audio", "video", "documento", null, null], ["image/png", "audio/amr", "video/webm", "application/pdf", "text/html", "image/svg+xml"].map(F.categoriaDaMime));

  //  Normalizzazione del dichiarato (D2): prima del permesso, una tabella sola.
  c("audio/ogg; codecs=opus → audio/ogg", "audio/ogg", F.normalizzaMime("audio", "audio/ogg; codecs=opus"));
  c("maiuscole, spazi e parametri si tolgono", "image/jpeg", F.normalizzaMime("foto", "  Image/JPEG ; q=1"));
  c("alias comuni (image/jpg, audio/x-m4a, audio/mp3, application/x-pdf)", ["image/jpeg", "audio/mp4", "audio/mpeg", "application/pdf"], [F.normalizzaMime("foto", "image/jpg"), F.normalizzaMime("audio", "audio/x-m4a"), F.normalizzaMime("audio", "audio/mp3"), F.normalizzaMime("documento", "application/x-pdf")]);
  c("un OOXML dichiarato resta com'è", OOXML.docx, F.normalizzaMime("documento", OOXML.docx));
  c("famiglia sbagliata per la categoria → null (video dichiarato su un audio)", [null, null, null], [F.normalizzaMime("audio", "video/mp4"), F.normalizzaMime("foto", "application/pdf"), F.normalizzaMime("documento", "image/jpeg")]);
  c("fuori elenco → null (svg, html, zip, exe, octet-stream, xml, doc OLE, txt, csv)", Array(9).fill(null), ["image/svg+xml", "text/html", "application/zip", "application/x-msdownload", "application/octet-stream", "application/xml", "application/msword", "text/plain", "text/csv"].map((m) => F.normalizzaMime("documento", m) ?? F.normalizzaMime("foto", m)));
  c("non è una stringa / vuoto / categoria sconosciuta → null", [null, null, null, null, null], [F.normalizzaMime("foto", undefined), F.normalizzaMime("foto", ""), F.normalizzaMime("foto", { toString: () => "image/png" }), F.normalizzaMime("sticker", "image/png"), F.normalizzaMime("foto", "image/png".repeat(500))]);

  //  Foto: come oggi (`tipoDaByte` di immagini.mjs).
  c("foto: jpeg, png, webp", ["image/jpeg", "image/png", "image/webp"], [da("foto", file([0xff, 0xd8, 0xff, 0xe0])), da("foto", file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), da("foto", file([...testo("RIFF"), 0, 0, 0, 0, ...testo("WEBP")]))]);
  c("foto: SVG dichiarato image/png → null", null, da("foto", file(testo('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))));
  c("foto: HTML, GIF, mp4, troppo corto → null", [null, null, null, null], [da("foto", file(testo("<html><body>"))), da("foto", file(testo("GIF89a"))), da("foto", ftyp("isom")), da("foto", Buffer.from([0xff, 0xd8, 0xff]))]);

  //  Audio.
  c("audio: OggS → ogg", "audio/ogg", da("audio", file(testo("OggS"))));
  c("audio: ftyp con marca audio (M4A, M4B) → mp4", ["audio/mp4", "audio/mp4"], [da("audio", ftyp("M4A ")), da("audio", ftyp("M4B "))]);
  c("audio: ID3 → mpeg; sync FF FB → mpeg", ["audio/mpeg", "audio/mpeg"], [da("audio", file(testo("ID3"))), da("audio", file([0xff, 0xfb, 0x90, 0x00]))]);
  c("audio: ADTS FF F1 / FF F9 → aac (non mpeg)", ["audio/aac", "audio/aac"], [da("audio", file([0xff, 0xf1, 0x50, 0x80])), da("audio", file([0xff, 0xf9, 0x50, 0x80]))]);
  c("audio: #!AMR → amr", "audio/amr", da("audio", file(testo("#!AMR\n"))));
  c("audio: un mp4 video (isom) o un html non è un audio → null", [null, null, null], [da("audio", ftyp("isom")), da("audio", file(testo("<html>"))), da("audio", file([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]))]);
  c("audio: jpeg, pdf → null", [null, null], [da("audio", file([0xff, 0xd8, 0xff, 0xe0])), da("audio", file(testo("%PDF-1.7")))]);

  //  Video.
  c("video: ftyp isom/mp42/avc1 → mp4", ["video/mp4", "video/mp4", "video/mp4"], ["isom", "mp42", "avc1"].map((m) => da("video", ftyp(m))));
  c("video: ftyp qt → quicktime; 3gp4 → 3gpp", ["video/quicktime", "video/3gpp"], [da("video", ftyp("qt  ")), da("video", ftyp("3gp4"))]);
  c("video: EBML con DocType webm → webm; mkv (matroska) → null", ["video/webm", null], [da("video", file([0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x82, 0x84, ...testo("webm")])), da("video", file([0x1a, 0x45, 0xdf, 0xa3, 0x88, 0x42, 0x82, 0x88, ...testo("matroska")]))]);
  c("video: ftyp con marca audio (M4A) o immagine (heic) → null", [null, null], [da("video", ftyp("M4A ")), da("video", ftyp("heic"))]);
  c("video: html, png, ogg → null", [null, null, null], [da("video", file(testo("<html>"))), da("video", file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), da("video", file(testo("OggS")))]);

  //  Documento.
  c("documento: %PDF- in testa → pdf", "application/pdf", da("documento", file(testo("%PDF-1.4\n")), "fattura.pdf"));
  c("documento: %PDF- entro i primi 1024 byte (intestazione con spazzatura prima)", "application/pdf", da("documento", file([...testo("zzzz\n".repeat(100)), ...testo("%PDF-1.4")], 2048), "a.pdf"));
  c("documento: %PDF- oltre i primi 1024 byte → null", null, da("documento", file([...Array(1030).fill(0x20), ...testo("%PDF-1.4")], 2048), "a.pdf"));
  c("documento: ZIP + estensione docx/xlsx/pptx → il tipo OOXML", [OOXML.docx, OOXML.xlsx, OOXML.pptx], ["a.docx", "b.XLSX", "c.pptx"].map((n) => da("documento", file([0x50, 0x4b, 0x03, 0x04]), n)));
  c("documento: ZIP rinominato (zip, exe, nessun nome, nome senza estensione) → null", [null, null, null, null], [da("documento", file([0x50, 0x4b, 0x03, 0x04]), "a.zip"), da("documento", file([0x50, 0x4b, 0x03, 0x04]), "a.exe"), da("documento", file([0x50, 0x4b, 0x03, 0x04])), da("documento", file([0x50, 0x4b, 0x03, 0x04]), "docx")]);
  c("documento: HTML chiamato .pdf → null", null, da("documento", file(testo("<html><script>alert(1)</script>")), "ricetta.pdf"));
  c("documento: SVG chiamato .docx, byte a caso chiamati .xlsx → null", [null, null], [da("documento", file(testo("<svg/>")), "a.docx"), da("documento", file([1, 2, 3, 4, 5, 6, 7, 8]), "b.xlsx")]);
  c("documento: OLE (.doc) e testo (.txt, .csv) restano fuori (D13)", [null, null, null], [da("documento", file([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), "a.doc"), da("documento", file(testo("a;b;c\n")), "a.csv"), da("documento", file(testo("ciao ciao ciao")), "a.txt")]);
  c("documento: un'immagine ricevuta come documento non è un documento", null, da("documento", file([0xff, 0xd8, 0xff, 0xe0]), "foto.pdf"));

  //  Casi limite: ingresso non valido, mai un'eccezione.
  c("non lancia: null, stringa, categoria sconosciuta, buffer vuoto", [null, null, null, null], [da("foto", null), da("foto", "ciao"), da("sticker", file([0xff, 0xd8, 0xff])), da("foto", Buffer.alloc(0))]);
  c("accetta anche un Uint8Array (non solo Buffer)", "image/jpeg", da("foto", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0])));
  c("un nome di documento non stringa non rompe", null, da("documento", file([0x50, 0x4b, 0x03, 0x04]), { x: 1 }));
}
