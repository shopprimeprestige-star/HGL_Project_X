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
const hdlr = (tipo) => box("hdlr", u32(0), u32(0), enc(tipo), new Uint8Array(13));
const tkhd = (id) => box("tkhd", u32(0), u32(0), u32(0), u32(id), new Uint8Array(68));
const mvhd = (prossima) => box("mvhd", new Uint8Array(96), u32(prossima));
const stsc1 = () => box("stsc", u32(0), u32(1), u32(1), u32(1), u32(1)); // un campione per chunk
const stszFisso = (misura, quanti) => box("stsz", u32(0), u32(misura), u32(quanti));
const trak = (tabelle, { extra = [], id = 1, tipo = "vide", senzaHdlr = false } = {}) =>
  box("trak", tkhd(id), ...extra, box("mdia", box("mdhd", new Uint8Array(24)), ...(senzaHdlr ? [] : [hdlr(tipo)]), box("minf", box("stbl", box("stsd", new Uint8Array(8)), ...tabelle))));

/** Costruisce il file; `opz.prima`: moov prima di mdat. Due giri: la grandezza non dipende dagli offset. */
function costruisci(opz = {}) {
  const giro = (o1, o2) => {
    const conMeta = opz.pulito !== true;
    const ftyp = box("ftyp", enc(opz.marca ?? "isom"), u32(512), enc(["heic", "avif"].includes(opz.marca) ? "mif1miaf" : "isomiso2mp41"));
    const tab = (o, misura) => [opz.co64 ? co64(...o) : stco(...o), stsc1(), stszFisso(misura, 1)];
    const moov = box("moov", mvhd(3),
      ...(conMeta ? [udtaGps(), metaGps()] : []),
      trak(tab([o1], 12), { id: 1, extra: conMeta ? [udtaGps()] : [] }),
      trak(tab([o2], 13), { id: 2, extra: conMeta ? [box("meta", u32(0), xyz())] : [] }));
    const mdat = box("mdat", PAYLOAD);
    const extra = opz.uuid ? [box("uuid", enc("XMP-FINTO-"), GPS)] : [];
    const pre = [ftyp, ...extra, ...(opz.liberi ? [box("free", GPS), box("wide", new Uint8Array(0)), box("skip", enc("zz"))] : [])];
    const f = opz.prima ? cat(...pre, moov, mdat) : cat(...pre, mdat, moov);
    return { file: f, inizioPayload: (opz.prima ? [...pre, moov] : pre).reduce((a, x) => a + x.length, 0) + 8 };
  };
  const g0 = giro(0, 0);
  return giro(g0.inizioPayload, g0.inizioPayload + 12);
}

/** Un video con una traccia di coordinate (`gpmd`), atomi sconosciuti dappertutto e `uuid` con le coordinate. `ordine`: come stanno i pezzi in mdat. */
const VA = enc("VIDEO-AAAA"), VB = enc("VIDEO-BBBB");
function costruisciGps({ prima = true, ordine = "gps-prima", tipoGps = "gpmd", senzaStsz = false, sovrapposta = false, soloGps = false } = {}) {
  const pezzi = ordine === "gps-prima" ? [GPS, VA, VB] : ordine === "in-mezzo" ? [VA, GPS, VB] : [VA, VB, GPS];
  const giro = (inizio) => {
    const pos = (k) => inizio + pezzi.slice(0, k).reduce((n, x) => n + x.length, 0);
    const oA = pos(pezzi.indexOf(VA)), oB = pos(pezzi.indexOf(VB)), oG = sovrapposta ? oA : pos(pezzi.indexOf(GPS));
    const video = trak([stco(oA, oB), stsc1(), stszFisso(10, 2), box("sdtp", new Uint8Array(4))], { id: 1, extra: [box("uuid", enc("UUID-IN-TRAK-"), GPS)] });
    const gps = trak([stco(oG), stsc1(), senzaStsz ? box("stz2", new Uint8Array(12)) : stszFisso(18, 1)], { id: 2, tipo: tipoGps });
    const moov = box("moov", mvhd(3), box("uuid", enc("UUID-IN-MOOV-"), GPS), box("xxxx", GPS), ...(soloGps ? [gps] : [video, gps]));
    const mdat = box("mdat", ...pezzi);
    const ftyp = box("ftyp", enc("isom"), u32(512), enc("isomiso2mp41"));
    const alto = [ftyp, box("free", GPS), box("wide", new Uint8Array(0)), box("uuid", enc("XMP-FINTO-"), GPS), box("skip", GPS)];
    const f = prima ? cat(...alto, moov, mdat) : cat(...alto, mdat, moov);
    return { file: f, dati: alto.reduce((n, x) => n + x.length, 0) + (prima ? moov.length : 0) + 8 };
  };
  const g0 = giro(0);
  return giro(g0.dati).file;
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

  // ── la LISTA BIANCA: una traccia di coordinate, atomi sconosciuti, uuid ──
  const letti = (f, n = 2) => offsets(f).slice(0, n).map((o, i) => testo(f.slice(o, o + 10)));
  for (const [nome, opz] of [["moov prima di mdat, coordinate PRIMA del video", { prima: true, ordine: "gps-prima" }], ["moov prima, coordinate IN MEZZO ai due pezzi di video", { prima: true, ordine: "in-mezzo" }], ["moov dopo mdat, coordinate in fondo", { prima: false, ordine: "gps-dopo" }], ["moov dopo mdat, coordinate in mezzo", { prima: false, ordine: "in-mezzo" }]]) {
    const g = costruisciGps(opz);
    const r = V.pulisciVideo(g);
    c(`${nome}: pulizia riuscita`, true, r.ok);
    if (!r.ok) continue;
    c("…le coordinate non ci sono più, in nessun posto (né uuid, né xxxx, né free, né la traccia gpmd, né i suoi byte in mdat)", [-1, -1, -1, -1], [trova(r.dati, [...GPS]), trova(r.dati, [...enc("gpmd")]), trova(r.dati, [...enc("uuid")]), trova(r.dati, [...enc("XMP-")])]);
    c("…restano solo `ftyp`, `moov`, `mdat` a livello del file (niente free, wide, skip)", ["ftyp", "mdat", "moov"], (() => { const dv = new DataView(r.dati.buffer); const t = []; let q = 0; while (q < r.dati.length) { const sz = dv.getUint32(q); t.push(testo(r.dati.slice(q + 4, q + 8))); q += sz; } return t.sort(); })());
    c("…i byte del video sono intatti e di fila: il `mdat` ora contiene solo VIDEO-AAAAVIDEO-BBBB", true, trova(r.dati, [...enc("VIDEO-AAAAVIDEO-BBBB")]) >= 0);
    c("…gli offset tornano: puntano ai due pezzi del video", ["VIDEO-AAAA", "VIDEO-BBBB"], letti(r.dati));
    c("…una sola traccia (la traccia gpmd è sparita intera), e `next_track_ID` è 2", [1, 2], [r.dati.join(",").split(enc("trak").join(",")).length - 1, new DataView(r.dati.buffer).getUint32(trova(r.dati, [...enc("mvhd")]) + 4 + 96)]);
    c("…le tabelle restano, l'atomo sconosciuto `sdtp` (non è nella lista) no", [true, -1], [trova(r.dati, [...enc("stsz")]) >= 0, trova(r.dati, [...enc("sdtp")])]);
    c("…i file sono più corti di quanto tolto, e la somma delle grandezze torna", true, r.tolti === g.length - r.dati.length && (() => { const dv = new DataView(r.dati.buffer); let q = 0; while (q < r.dati.length) { q += dv.getUint32(q); } return q === r.dati.length; })());
  }
  const gtx = costruisciGps({ prima: true });
  const rtx = V.pulisciVideo(gtx);
  c("pulire il risultato ancora una volta non cambia niente (è già nella lista bianca)", true, rtx.ok && (() => { const di = V.pulisciVideo(rtx.dati); return di.ok && di.dati.length === rtx.dati.length && di.dati.every((x, i) => x === rtx.dati[i]); })());
  for (const tipo of ["meta", "mebx", "text", "camm", "sbtl", "subt", "tmcd"]) {
    const r = V.pulisciVideo(costruisciGps({ tipoGps: tipo, ordine: "in-mezzo" }));
    c(`una traccia «${tipo}» si toglie intera, con i suoi byte`, [true, -1, ["VIDEO-AAAA", "VIDEO-BBBB"]], r.ok ? [true, trova(r.dati, [...GPS]), letti(r.dati)] : [false]);
  }
  const rsn = V.pulisciVideo(costruisciGps({ tipoGps: "soun", ordine: "in-mezzo" }));
  c("una traccia audio (`soun`) resta, con i suoi byte", rsn.ok ? [true, true] : "no", rsn.ok ? [true, trova(rsn.dati, [...GPS]) >= 0] : "no");
  const rif = (nome, bytes) => { const r = V.pulisciVideo(bytes); c(`${nome}: rifiutato con la frase, nessun dato`, [false, FRASE, undefined], [r.ok, r.frase, r.dati]); };
  rif("la traccia da togliere ha le misure compatte (`stz2`): non so dove stanno i suoi byte", costruisciGps({ senzaStsz: true }));
  rif("i byte della traccia da togliere si sovrappongono a quelli di una traccia che resta", costruisciGps({ sovrapposta: true }));
  rif("nessuna traccia video o audio (solo coordinate)", costruisciGps({ soloGps: true }));
  rif("una traccia senza `hdlr`: non so cos'è, non la tengo né la tolgo", costruisci({ prima: true }).file.length ? (() => { const f = costruisci({ prima: true }); const i = trova(f, [...enc("hdlr")]); const g = new Uint8Array(f); for (const k of [0, 1, 2, 3]) g[i + k] = "xxxx".charCodeAt(k); return g; })() : null);
  const conLiberi = V.pulisciVideo(costruisci({ prima: true, liberi: true }).file);
  const senzaLiberi = V.pulisciVideo(costruisci({ prima: true }).file);
  c("`free`, `wide`, `skip` a livello del file si scartano, e gli offset si correggono: stesso risultato che senza", true, conLiberi.ok && senzaLiberi.ok && conLiberi.dati.length === senzaLiberi.dati.length && conLiberi.dati.every((x, i) => x === senzaLiberi.dati[i]) && trova(conLiberi.dati, [...GPS]) === -1);

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
