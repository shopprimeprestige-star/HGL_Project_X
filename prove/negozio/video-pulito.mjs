/** ── NEGOZIO · T16 · IL VIDEO SI PULISCE PRIMA DI PARTIRE ───────────────────
 *  `src/crm/ecommerce/prodotti/video-pulito.ts`: un video girato col telefono porta con sé i metadati (coordinate GPS nell'atomo
 *  «©xyz» dentro `udta` o `meta`): la posizione dello studio NON deve finire in vetrina. Il modulo legge gli atomi MP4/MOV,
 *  toglie `udta` e `meta` (in `moov`, in ogni `trak`, e `meta`/`udta`/`uuid`/`XMP_` a livello del file) e, se i dati si sono spostati,
 *  corregge gli offset di `stco` e `co64`. Se non riesce, il video NON si carica. Il tipo del file si legge dalla firma (`ftyp`).
 *  Qui un MP4 minimo costruito in memoria. Dati inventati (le coordinate sono finte). */
import { build } from "esbuild";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

const enc = (s) => Uint8Array.from([...s].map((ch) => ch.charCodeAt(0) & 0xff));
const u32 = (n) => Uint8Array.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u64 = (n) => Uint8Array.from([...u32(Math.floor(n / 2 ** 32)), ...u32(n >>> 0)]);
const cat = (...p) => { const o = new Uint8Array(p.reduce((a, x) => a + x.length, 0)); let k = 0; for (const x of p) { o.set(x, k); k += x.length; } return o; };
const box = (tipo, ...corpo) => { const c = cat(...corpo); return cat(u32(8 + c.length), enc(tipo), c); };
const tipo4 = (t) => (t === "©xyz" ? Uint8Array.from([0xa9, 0x78, 0x79, 0x7a]) : enc(t));
const boxR = (t, ...corpo) => { const c = cat(...corpo); return cat(u32(8 + c.length), tipo4(t), c); };
const GPS = enc("+41.9028+012.4964/"); // coordinate FINTE
const xyz = () => boxR("©xyz", u32(0), GPS);
const udtaGps = () => box("udta", xyz());
const metaGps = () => box("meta", u32(0), box("hdlr", new Uint8Array(24)), box("ilst", enc("com.apple.quicktime.location.ISO6709 "), GPS));
const PAYLOAD = enc("PRIMO-CHUNK!SECONDO-CHUNK"); // 11 + 14
const stco = (...off) => box("stco", u32(0), u32(off.length), ...off.map(u32));
const co64 = (...off) => box("co64", u32(0), u32(off.length), ...off.map(u64));
const trak = (stbl, extra = []) => box("trak", box("tkhd", new Uint8Array(84)), ...extra, box("mdia", box("mdhd", new Uint8Array(24)), box("hdlr", new Uint8Array(24)), box("minf", box("stbl", box("stsd", new Uint8Array(8)), stbl))));

/** Costruisce il file; `opz.prima`: moov prima di mdat. Due giri: la grandezza non dipende dagli offset. */
function costruisci(opz = {}) {
  const giro = (o1, o2) => {
    const conMeta = opz.pulito !== true;
    const ftyp = box("ftyp", enc(opz.marca ?? "isom"), u32(512), enc(["heic", "avif"].includes(opz.marca) ? "mif1miaf" : "isomiso2mp41"));
    const tab = (o) => (opz.co64 ? co64(...o) : stco(...o));
    const moov = box("moov", box("mvhd", new Uint8Array(100)),
      ...(conMeta ? [udtaGps(), metaGps()] : []),
      trak(tab([o1]), conMeta ? [udtaGps()] : []),
      trak(tab([o2]), conMeta ? [box("meta", u32(0), xyz())] : []));
    const mdat = box("mdat", PAYLOAD);
    const extra = opz.uuid ? [box("uuid", enc("XMP-FINTO-"), GPS)] : [];
    const pre = [ftyp, ...extra];
    const f = opz.prima ? cat(...pre, moov, mdat) : cat(...pre, mdat, moov);
    return { file: f, inizioPayload: (opz.prima ? [...pre, moov] : pre).reduce((a, x) => a + x.length, 0) + 8 };
  };
  const g0 = giro(0, 0);
  return giro(g0.inizioPayload, g0.inizioPayload + 12);
}
const trova = (file, seq) => { for (let i = 0; i + seq.length <= file.length; i++) if (seq.every((b, k) => file[i + k] === b)) return i; return -1; };
const XYZ = [0xa9, 0x78, 0x79, 0x7a];
/** Legge tutti gli offset di stco/co64 (cerca l'atomo e legge la tabella). */
function offsets(file) {
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const fuori = [];
  for (const [t, larg] of [["stco", 4], ["co64", 8]]) {
    for (let i = 0; i + 16 <= file.length; i++) {
      if (String.fromCharCode(...file.slice(i, i + 4)) !== t) continue;
      const n = dv.getUint32(i + 8);
      if (n > 8) continue;
      for (let k = 0; k < n; k++) fuori.push(larg === 4 ? dv.getUint32(i + 12 + 4 * k) : Number(dv.getBigUint64(i + 12 + 8 * k)));
    }
  }
  return fuori;
}
const testo = (b) => Buffer.from(b).toString("latin1");

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · T16 · IL VIDEO SENZA POSIZIONE (20/11/2026)");
  const V = await carica(radice, "src/crm/ecommerce/prodotti/video-pulito.ts").catch((e) => ({ errore: String(e) }));
  c("video-pulito.ts si compila e si carica", undefined, V.errore);
  if (V.errore) return;
  const FRASE = "Non riesco a preparare questo video: esportalo di nuovo dal telefono.";
  c("la frase di chi non si può preparare", FRASE, V.FRASE_VIDEO);

  // ── la firma ──
  c("il tipo si legge dalla firma `ftyp`: isom/mp42 = MP4, `qt  ` = MOV", ["video/mp4", "video/mp4", "video/quicktime"], [V.tipoDaFirma(costruisci({ prima: true }).file), V.tipoDaFirma(costruisci({ marca: "mp42" }).file), V.tipoDaFirma(costruisci({ marca: "qt  " }).file)]);
  c("una marca che non è un video (heic, avif) o un file senza `ftyp` non ha tipo", [null, null, null, null, null], [V.tipoDaFirma(costruisci({ marca: "heic" }).file), V.tipoDaFirma(costruisci({ marca: "avif" }).file), V.tipoDaFirma(enc("RIFF....AVI LIST")), V.tipoDaFirma(new Uint8Array(0)), V.tipoDaFirma(Uint8Array.from([0, 0, 0, 20, 102, 116, 121]))]);
  c("la firma non dipende da ciò che dice il browser: guarda solo i byte (`.type` non esiste nella funzione)", false, /\.type\b/.test(V.tipoDaFirma.toString()));

  // ── moov PRIMA di mdat: si tolgono gli atomi, gli offset si correggono ──
  const a = costruisci({ prima: true });
  c("il file di prova ha la posizione (©xyz) e `udta` e `meta` PRIMA della pulizia", [true, true, true], [trova(a.file, XYZ) >= 0, trova(a.file, [...enc("udta")]) >= 0, trova(a.file, [...enc("meta")]) >= 0]);
  const ra = V.pulisciVideo(a.file);
  c("pulizia riuscita, tipo MP4", [true, "video/mp4"], [ra.ok, ra.mime]);
  if (ra.ok) {
    c("…`©xyz` non c'è più, né `udta`, né `meta`, né le coordinate (nemmeno in chiaro)", [-1, -1, -1, -1], [trova(ra.dati, XYZ), trova(ra.dati, [...enc("udta")]), trova(ra.dati, [...enc("meta")]), trova(ra.dati, [...GPS])]);
    c("…il file è più corto, e la sua grandezza dichiarata da `ftyp` e `moov` torna", true, ra.dati.length < a.file.length && ra.tolti === a.file.length - ra.dati.length);
    const off = offsets(ra.dati);
    c("…gli offset tornano: ognuno punta ai suoi byte dentro `mdat` (PRIMO-CHUNK! e SECONDO-CHUNK)", ["PRIMO-CHUNK!", "SECONDO-CHUNK"], off.map((o, i) => testo(ra.dati.slice(o, o + (i ? 13 : 12)))));
    c("…la lunghezza del file e quella dei suoi atomi tornano (la somma delle grandezze dei blocchi del file è la lunghezza)", true, (() => { const dv = new DataView(ra.dati.buffer); let p = 0; while (p < ra.dati.length) { const s = dv.getUint32(p); if (s < 8) return false; p += s; } return p === ra.dati.length; })());
    c("…i dati del video (mdat) sono identici byte per byte", true, trova(ra.dati, [...PAYLOAD]) >= 0);
    const due = V.pulisciVideo(ra.dati);
    c("pulire un file già pulito non cambia niente (stessi byte)", [true, 0], [due.ok && due.dati.length === ra.dati.length && due.dati.every((b, i) => b === ra.dati[i]), due.tolti]);
  }

  // ── moov DOPO mdat: i dati non si spostano, gli offset restano ──
  const d = costruisci({ prima: false });
  const rd = V.pulisciVideo(d.file);
  c("moov dopo mdat: pulizia riuscita senza ©xyz", [true, -1], [rd.ok, rd.ok ? trova(rd.dati, XYZ) : 0]);
  if (rd.ok) c("…gli offset sono GLI STESSI e puntano ancora ai loro byte", [offsets(d.file), ["PRIMO-CHUNK!", "SECONDO-CHUNK"]], [offsets(rd.dati), offsets(rd.dati).map((o, i) => testo(rd.dati.slice(o, o + (i ? 13 : 12))))]);

  // ── 64 bit, atomi a livello del file, file già pulito ──
  const q = costruisci({ prima: true, co64: true });
  const rq = V.pulisciVideo(q.file);
  c("co64 (offset a 64 bit): corretti come stco", rq.ok && rq.dati.length < q.file.length ? ["PRIMO-CHUNK!", "SECONDO-CHUNK"] : "no", rq.ok ? offsets(rq.dati).map((o, i) => testo(rq.dati.slice(o, o + (i ? 13 : 12)))) : "no");
  const u = costruisci({ prima: true, uuid: true });
  const ru = V.pulisciVideo(u.file);
  c("un atomo `uuid` a livello del file (dove stanno i pacchetti XMP) si toglie, e gli offset si correggono lo stesso", ru.ok ? [-1, ["PRIMO-CHUNK!", "SECONDO-CHUNK"]] : "no", ru.ok ? [trova(ru.dati, [...GPS]), offsets(ru.dati).map((o, i) => testo(ru.dati.slice(o, o + (i ? 13 : 12))))] : "no");
  const p = costruisci({ prima: true, pulito: true });
  const rp = V.pulisciVideo(p.file);
  c("un file senza metadati torna identico", [true, 0], [rp.ok && rp.dati.length === p.file.length && rp.dati.every((b, i) => b === p.file[i]), rp.ok ? rp.tolti : -1]);
  c("la copia non è lo stesso oggetto dell'originale (l'originale non si tocca)", true, rp.ok && rp.dati !== p.file && a.file.length === costruisci({ prima: true }).file.length);

  // ── se non si può analizzare, NON si carica ──
  const no = (nome, bytes) => { const r = V.pulisciVideo(bytes); c(`non analizzabile — ${nome}: rifiutato con la frase, nessun dato`, [false, FRASE, undefined], [r.ok, r.frase, r.dati]); };
  no("vuoto", new Uint8Array(0));
  no("non è un video", enc("questo non è un video, è solo testo lungo abbastanza"));
  no("tagliato a metà", a.file.slice(0, a.file.length - 40));
  no("tagliato dentro l'intestazione", a.file.slice(0, 13));
  no("manca `moov`", cat(box("ftyp", enc("isom"), u32(0), enc("isom")), box("mdat", PAYLOAD)));
  no("due `moov`", cat(a.file, box("moov", box("mvhd", new Uint8Array(100)))));
  no("manca `mdat`", cat(box("ftyp", enc("isom"), u32(0), enc("isom")), box("moov", box("mvhd", new Uint8Array(100)))));
  no("senza `ftyp` all'inizio", a.file.slice(a.file.length - 40));
  const storto = new Uint8Array(a.file); storto.set(u32(0x7fffffff), 0);
  no("la grandezza di un atomo supera il file", storto);
  const piccolo = new Uint8Array(a.file); piccolo.set(u32(3), 0);
  no("un atomo dichiara meno di 8 byte", piccolo);
  no("a pezzi (fMP4 con `moof`): gli offset non sono quelli di stco", cat(a.file, box("moof", box("mfhd", new Uint8Array(8)))));
  const fuori = costruisci({ prima: true });
  const dvf = new DataView(fuori.file.buffer);
  dvf.setUint32(trova(fuori.file, [0, 0, 0, 20, ...enc("stco")]) + 16, 7); // il primo offset: 7, dentro `ftyp`
  no("un offset che non cade dentro `mdat` (dati altrove: non si può correggere)", fuori.file);
  const grande = costruisci({ prima: true });
  const dvg = new DataView(grande.file.buffer);
  dvg.setUint32(trova(grande.file, [0, 0, 0, 20, ...enc("stco")]) + 12, 0x7fffffff); // quante voci: più di quante ne stanno
  no("una tabella di offset più lunga dell'atomo", grande.file);
  let lanciato = false;
  try { V.pulisciVideo(null); V.pulisciVideo(undefined); V.pulisciVideo("testo"); } catch { lanciato = true; }
  c("qualunque cosa gli si dia, non lancia mai: risponde con la frase", false, lanciato);
  c("la frase non contiene mai un percorso, un nome o un numero di byte", false, /\d|\/|\.mp4|\.mov/i.test(FRASE));
}
