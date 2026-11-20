/** ── IL VIDEO SENZA POSIZIONE (video-pulito.ts) ──────────────────────────────
 *  Commessa 2026-11-20-shop-completo, T16. Un video girato col telefono porta con sé dati nascosti: spesso le coordinate GPS
 *  (atomo «©xyz» in `udta` o in `meta`, pacchetti XMP in un `uuid`, tracce di metadati a tempo come `gpmd`). L'indirizzo dello studio NON deve
 *  mai comparire in vetrina, quindi il video non parte «così com'è»: si ricostruisce con una LISTA BIANCA.
 *
 *  ── LA LISTA BIANCA ─────────────────────────────────────────────────────────
 *  · A livello del file restano solo `ftyp`, `moov` e `mdat`. Tutto il resto (`free`, `skip`, `wide`, `uuid`, `XMP_`, gli sconosciuti) si scarta.
 *  · Dentro `moov` e i suoi contenitori restano solo i figli strutturali noti (vedi `CONTENITORI`). `udta`, `meta`, `uuid` e gli
 *    sconosciuti si scartano, a ogni livello.
 *  · Restano solo le tracce `vide` e `soun`. Le altre (`meta`, `mebx`, `text`, `gpmd`, `camm`, `sbtl`, `tmcd`…) si tolgono INTERE, e i loro
 *    byte si tolgono anche da `mdat` (le coordinate di una traccia GPS stanno lì). `mvhd.next_track_ID` si ricalcola; `tref` delle tracce
 *    rimaste si toglie se qualche traccia è sparita (non può più puntare al vuoto).
 *  · `stco`/`co64` si correggono: ogni offset si sposta di quanto si è spostato il suo `mdat`, meno i byte tolti prima di lui.
 *  Se qualcosa non si può fare con sicurezza (atomi che non tornano, tabelle di una traccia da togliere illeggibili o `stz2`, byte che si
 *  sovrappongono a una traccia che resta, file a pezzi `moof`, nessuna traccia video/audio) il file si RIFIUTA: la schermata dice
 *  `FRASE_VIDEO` e non carica niente.
 *
 *  Modulo PURO (nessuna libreria, nessun browser): si prova con un MP4 costruito in memoria (`prove/negozio/video-pulito.mjs`). */

export const FRASE_VIDEO = "Non riesco a preparare questo video: esportalo di nuovo dal telefono.";

class Illeggibile extends Error {}
const no = (): never => {
  throw new Illeggibile();
};

interface Atomo {
  tipo: string;
  inizio: number;
  testa: number;
  fine: number;
}

const testo4 = (b: Uint8Array, p: number): string => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
const vista = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

/** Gli atomi che stanno uno dopo l'altro fra `da` e `a`. Qualunque grandezza che non torna → illeggibile. */
function atomi(b: Uint8Array, da: number, a: number): Atomo[] {
  const dv = vista(b);
  const fuori: Atomo[] = [];
  let p = da;
  while (p < a) {
    if (a - p < 8) no();
    let grandezza = dv.getUint32(p);
    let testa = 8;
    if (grandezza === 1) {
      if (a - p < 16 || dv.getUint32(p + 8) !== 0) no(); // oltre 4 GB non è un video da 25 MB
      grandezza = dv.getUint32(p + 12);
      testa = 16;
    } else if (grandezza === 0) grandezza = a - p; // «fino alla fine del file»
    if (grandezza < testa || p + grandezza > a) no();
    fuori.push({ tipo: testo4(b, p + 4), inizio: p, testa, fine: p + grandezza });
    p += grandezza;
  }
  return fuori;
}

const MARCHE_MP4 = ["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "mp71", "avc1", "M4V ", "dash"];

/** Il tipo del file dalla FIRMA (l'atomo `ftyp` all'inizio), mai da ciò che dice il browser. `null` = non è un MP4 né un MOV. */
export function tipoDaFirma(b: Uint8Array): "video/mp4" | "video/quicktime" | null {
  if (!(b instanceof Uint8Array) || b.length < 16) return null;
  const dv = vista(b);
  const grandezza = dv.getUint32(0);
  if (testo4(b, 4) !== "ftyp" || grandezza < 16 || grandezza > b.length) return null;
  const marche = [testo4(b, 8)];
  for (let p = 16; p + 4 <= grandezza; p += 4) marche.push(testo4(b, p));
  if (marche[0] === "qt  ") return "video/quicktime";
  return marche.some((m) => MARCHE_MP4.includes(m)) ? "video/mp4" : null;
}

const unisci = (parti: Uint8Array[]): Uint8Array => {
  const fuori = new Uint8Array(parti.reduce((n, x) => n + x.length, 0));
  let k = 0;
  for (const x of parti) {
    fuori.set(x, k);
    k += x.length;
  }
  return fuori;
};
const conTesta = (tipo: string, corpo: Uint8Array): Uint8Array => {
  const t = new Uint8Array(8);
  vista(t).setUint32(0, 8 + corpo.length);
  for (let i = 0; i < 4; i++) t[4 + i] = tipo.charCodeAt(i);
  return unisci([t, corpo]);
};

/** Per ogni contenitore, i soli figli che restano. Un figlio che compare anche qui come contenitore si ricostruisce con la stessa regola. */
const CONTENITORI: Record<string, string[]> = {
  moov: ["mvhd", "trak", "mvex"],
  trak: ["tkhd", "edts", "tref", "mdia"],
  edts: ["elst"],
  mdia: ["mdhd", "hdlr", "minf"],
  minf: ["vmhd", "smhd", "hdlr", "dinf", "stbl"],
  dinf: ["dref"],
  stbl: ["stsd", "stts", "stss", "ctts", "stsc", "stsz", "stz2", "stco", "co64", "sgpd", "sbgp"],
};
const A_LIVELLO_FILE = ["ftyp", "moov", "mdat"];
const TRACCE_TENUTE = ["vide", "soun"];

const figlio = (b: Uint8Array, a: Atomo, tipo: string): Atomo | undefined => atomi(b, a.inizio + a.testa, a.fine).find((f) => f.tipo === tipo);
const percorso = (b: Uint8Array, a: Atomo, ...tipi: string[]): Atomo | undefined => tipi.reduce<Atomo | undefined>((x, t) => (x ? figlio(b, x, t) : undefined), a);
const corpoDi = (a: Atomo): number => a.inizio + a.testa;

interface Pezzo {
  inizio: number;
  fine: number;
}
interface Traccia {
  atomo: Atomo;
  id: number;
  tiene: boolean;
}

function leggiTraccia(b: Uint8Array, atomo: Atomo): Traccia {
  const tkhd = figlio(b, atomo, "tkhd");
  const hdlr = percorso(b, atomo, "mdia", "hdlr");
  if (!tkhd || !hdlr) no();
  const t = tkhd as Atomo, h = hdlr as Atomo;
  const v1 = b[corpoDi(t)] === 1;
  if (t.fine - corpoDi(t) < (v1 ? 24 : 16) || h.fine - corpoDi(h) < 12) no();
  return { atomo, id: vista(b).getUint32(corpoDi(t) + (v1 ? 20 : 12)), tiene: TRACCE_TENUTE.includes(testo4(b, corpoDi(h) + 8)) };
}

/** Dove stanno i byte dei campioni di una traccia (un pezzo per ogni «chunk»), come offset dall'inizio del FILE. Illeggibile = si rifiuta. */
function pezziDi(b: Uint8Array, traccia: Atomo): Pezzo[] {
  const stbl = percorso(b, traccia, "mdia", "minf", "stbl");
  if (!stbl) no();
  const f = atomi(b, corpoDi(stbl as Atomo), (stbl as Atomo).fine);
  const tab = f.find((x) => x.tipo === "stco" || x.tipo === "co64");
  const stsc = f.find((x) => x.tipo === "stsc");
  const stsz = f.find((x) => x.tipo === "stsz"); // `stz2` (misure compatte): non si sa leggere → si rifiuta
  if (!tab || !stsc || !stsz) no();
  const dv = vista(b);
  const T = tab as Atomo, C = stsc as Atomo, Z = stsz as Atomo;
  const largo = T.tipo === "co64" ? 8 : 4;
  if (T.fine - corpoDi(T) < 8 || C.fine - corpoDi(C) < 8 || Z.fine - corpoDi(Z) < 12) no();
  const nChunk = dv.getUint32(corpoDi(T) + 4);
  if (nChunk > (T.fine - corpoDi(T) - 8) / largo) no();
  const nVoci = dv.getUint32(corpoDi(C) + 4);
  if (nVoci < 1 || nVoci > (C.fine - corpoDi(C) - 8) / 12) no();
  const misuraFissa = dv.getUint32(corpoDi(Z) + 4);
  const nCampioni = dv.getUint32(corpoDi(Z) + 8);
  if (misuraFissa === 0 && nCampioni > (Z.fine - corpoDi(Z) - 12) / 4) no();
  const pezzi: Pezzo[] = [];
  let voce = 0;
  let campione = 0;
  for (let i = 1; i <= nChunk; i++) {
    while (voce + 1 < nVoci && dv.getUint32(corpoDi(C) + 8 + (voce + 1) * 12) <= i) voce++;
    const quanti = dv.getUint32(corpoDi(C) + 8 + voce * 12 + 4);
    if (campione + quanti > nCampioni) no();
    let lunghezza = 0;
    for (let k = 0; k < quanti; k++) lunghezza += misuraFissa || dv.getUint32(corpoDi(Z) + 12 + (campione + k) * 4);
    campione += quanti;
    const p = corpoDi(T) + 8 + (i - 1) * largo;
    const inizio = largo === 4 ? dv.getUint32(p) : dv.getUint32(p) * 2 ** 32 + dv.getUint32(p + 4);
    pezzi.push({ inizio, fine: inizio + lunghezza });
  }
  return pezzi;
}

/** `a` ricostruito con la lista bianca; le tracce in `fuori` (per posizione nel file) non ci sono più. */
function ricostruisci(b: Uint8Array, a: Atomo, fuori: Set<number>, senzaTref: boolean): Uint8Array {
  const parti: Uint8Array[] = [];
  for (const f of atomi(b, corpoDi(a), a.fine)) {
    if (!CONTENITORI[a.tipo].includes(f.tipo) || fuori.has(f.inizio) || (senzaTref && f.tipo === "tref")) continue;
    parti.push(CONTENITORI[f.tipo] ? ricostruisci(b, f, fuori, senzaTref) : b.subarray(f.inizio, f.fine));
  }
  return conTesta(a.tipo, unisci(parti));
}

interface Mdat {
  inizio: number;
  fine: number;
  nuovoInizio: number;
  /** I pezzi tolti da questo `mdat`, in ordine. */
  tolti: Pezzo[];
}

/** Il nuovo posto di un offset: dove si è spostato il suo `mdat`, meno i byte tolti prima di lui. */
function nuovoOffset(mdat: Mdat[], vecchio: number): number {
  const m = mdat.find((x) => vecchio >= x.inizio && vecchio < x.fine);
  if (!m) return no();
  return m.nuovoInizio + (vecchio - m.inizio) - m.tolti.filter((t) => t.fine <= vecchio).reduce((n, t) => n + (t.fine - t.inizio), 0);
}

function correggiOffset(moov: Uint8Array, mdat: Mdat[]): void {
  const dv = vista(moov);
  const radice = atomi(moov, 0, moov.length)[0];
  for (const trak of atomi(moov, corpoDi(radice), radice.fine).filter((x) => x.tipo === "trak")) {
    const stbl = percorso(moov, trak, "mdia", "minf", "stbl");
    if (!stbl) continue;
    for (const t of atomi(moov, corpoDi(stbl), stbl.fine)) {
      if (t.tipo !== "stco" && t.tipo !== "co64") continue;
      const largo = t.tipo === "co64" ? 8 : 4;
      const da = corpoDi(t);
      if (t.fine - da < 8) no();
      const n = dv.getUint32(da + 4);
      if (n > (t.fine - da - 8) / largo) no();
      for (let k = 0; k < n; k++) {
        const p = da + 8 + k * largo;
        const vecchio = largo === 4 ? dv.getUint32(p) : dv.getUint32(p) * 2 ** 32 + dv.getUint32(p + 4);
        const nuovo = nuovoOffset(mdat, vecchio);
        if (largo === 4 && nuovo > 0xffffffff) no();
        if (largo === 4) dv.setUint32(p, nuovo);
        else {
          dv.setUint32(p, Math.floor(nuovo / 2 ** 32));
          dv.setUint32(p + 4, nuovo >>> 0);
        }
      }
    }
  }
}

/** Dopo aver tolto delle tracce, `mvhd.next_track_ID` non deve puntare a numeri di tracce che non ci sono più. */
function prossimaTraccia(moov: Uint8Array, id: number): void {
  const radice = atomi(moov, 0, moov.length)[0];
  const mvhd = figlio(moov, radice, "mvhd");
  if (!mvhd) return no();
  const p = corpoDi(mvhd) + (moov[corpoDi(mvhd)] === 1 ? 108 : 96);
  if (mvhd.fine - p < 4) no();
  vista(moov).setUint32(p, id);
}

export type EsitoVideo = { ok: true; dati: Uint8Array; mime: "video/mp4" | "video/quicktime"; tolti: number } | { ok: false; frase: string };

const sovrapposti = (a: Pezzo[], b: Pezzo[]): boolean => a.some((x) => b.some((y) => x.inizio < y.fine && y.inizio < x.fine));

/** Il video senza dati nascosti. Non lancia mai: se non riesce, `{ ok: false, frase }` e il video NON si carica. */
export function pulisciVideo(b: Uint8Array): EsitoVideo {
  try {
    if (!(b instanceof Uint8Array)) no();
    const alto = atomi(b, 0, b.length);
    if (alto[0]?.tipo !== "ftyp") no();
    const mime = tipoDaFirma(b);
    const moov = alto.filter((a) => a.tipo === "moov");
    const mdat = alto.filter((a) => a.tipo === "mdat");
    if (!mime || moov.length !== 1 || mdat.length === 0 || alto.some((a) => a.tipo === "moof")) no();

    //  Le tracce: restano video e audio; le altre vanno via intere, con i loro byte.
    const tracce = atomi(b, corpoDi(moov[0]), moov[0].fine).filter((a) => a.tipo === "trak").map((a) => leggiTraccia(b, a));
    const tenute = tracce.filter((t) => t.tiene);
    const tolte = tracce.filter((t) => !t.tiene);
    if (tenute.length === 0) no();
    const pezziTolti = tolte.flatMap((t) => pezziDi(b, t.atomo)).sort((x, y) => x.inizio - y.inizio);
    if (pezziTolti.some((x, i) => x.fine <= x.inizio || (i > 0 && x.inizio < pezziTolti[i - 1].fine))) no();
    if (pezziTolti.length && sovrapposti(tenute.flatMap((t) => pezziDi(b, t.atomo)), pezziTolti)) no();
    if (pezziTolti.some((x) => !mdat.some((m) => x.inizio >= corpoDi(m) && x.fine <= m.fine))) no();

    const nuovoMoov = ricostruisci(b, moov[0], new Set(tolte.map((t) => t.atomo.inizio)), tolte.length > 0);
    if (tolte.length) prossimaTraccia(nuovoMoov, Math.max(...tenute.map((t) => t.id)) + 1);

    //  Il nuovo posto di ogni cosa: prima le lunghezze, poi gli offset.
    const mdatNuovi: Mdat[] = [];
    let p = 0;
    for (const a of alto) {
      if (!A_LIVELLO_FILE.includes(a.tipo)) continue;
      if (a.tipo === "mdat") {
        const tolti = pezziTolti.filter((x) => x.inizio >= corpoDi(a) && x.fine <= a.fine);
        mdatNuovi.push({ inizio: a.inizio, fine: a.fine, nuovoInizio: p, tolti });
        p += a.fine - a.inizio - tolti.reduce((n, t) => n + (t.fine - t.inizio), 0);
      } else p += a.tipo === "moov" ? nuovoMoov.length : a.fine - a.inizio;
    }
    correggiOffset(nuovoMoov, mdatNuovi); // `nuovoMoov` è una copia nostra: l'originale non si tocca

    const parti: Uint8Array[] = [];
    let k = 0;
    for (const a of alto) {
      if (!A_LIVELLO_FILE.includes(a.tipo)) continue;
      if (a.tipo === "moov") parti.push(nuovoMoov);
      else if (a.tipo === "mdat") {
        const m = mdatNuovi[k++];
        const testa = b.slice(a.inizio, corpoDi(a));
        const grandezza = vista(b).getUint32(a.inizio);
        const nuova = m.fine - m.inizio - m.tolti.reduce((n, t) => n + (t.fine - t.inizio), 0);
        if (grandezza === 1) vista(testa).setUint32(12, nuova);
        else if (grandezza !== 0) vista(testa).setUint32(0, nuova);
        const pezzi: Uint8Array[] = [testa];
        let da = corpoDi(a);
        for (const t of m.tolti) {
          pezzi.push(b.subarray(da, t.inizio));
          da = t.fine;
        }
        pezzi.push(b.subarray(da, a.fine));
        parti.push(unisci(pezzi));
      } else parti.push(b.subarray(a.inizio, a.fine));
    }
    const dati = unisci(parti);
    return { ok: true, dati, mime: mime as "video/mp4" | "video/quicktime", tolti: b.length - dati.length };
  } catch {
    return { ok: false, frase: FRASE_VIDEO };
  }
}
