/** ── IL VIDEO SENZA POSIZIONE (video-pulito.ts) ──────────────────────────────
 *  Commessa 2026-11-20-shop-completo, T16. Un video girato col telefono porta con sé i metadati: spesso le coordinate GPS
 *  (atomo «©xyz» dentro `moov/udta`, oppure `moov/meta`). L'indirizzo dello studio NON deve mai comparire in vetrina, quindi il video
 *  non parte «così com'è»: si leggono gli atomi MP4/MOV, si tolgono `udta` e `meta` da `moov` e da ogni `trak` (e, a livello del file,
 *  `meta`, `udta`, `uuid` e `XMP_`, dove stanno i pacchetti XMP), e si corregge lo spostamento dei dati in `stco` e `co64`.
 *  Se il file non si può analizzare NON si carica: la schermata dice `FRASE_VIDEO`.
 *
 *  Modulo PURO (nessuna libreria, nessun browser): si prova con un MP4 costruito in memoria (`prove/negozio/video-pulito.mjs`).
 *  ── Come si tengono giusti gli offset ───────────────────────────────────────
 *  `stco`/`co64` dicono dove sta ogni blocco di campioni, come byte dall'inizio del FILE. Togliere atomi PRIMA di `mdat` sposta i dati:
 *  per ogni `mdat` si calcola di quanto si è spostato e si aggiunge a ogni offset che cade dentro di lui. Se `moov` sta dopo `mdat` lo
 *  spostamento è zero e gli offset non cambiano. Un offset che non cade in nessun `mdat` (dati altrove) non si può correggere: si rifiuta.
 *  shortcut: le tracce di metadati a tempo (handler `meta`/`mebx`, per esempio camere sportive) non si toccano, e i file a pezzi (`moof`) si
 *  rifiutano; da estendere se un telefono del titolare ne produce. */

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

/** `moov` o `trak` senza `udta` e `meta`; in `moov` anche i `trak` sono ripuliti. Il resto si copia byte per byte. */
function senzaMetadati(b: Uint8Array, a: Atomo, scendi: boolean): Uint8Array {
  const parti: Uint8Array[] = [];
  for (const f of atomi(b, a.inizio + a.testa, a.fine)) {
    if (f.tipo === "udta" || f.tipo === "meta") continue;
    parti.push(scendi && f.tipo === "trak" ? senzaMetadati(b, f, false) : b.subarray(f.inizio, f.fine));
  }
  return conTesta(a.tipo, unisci(parti));
}

const figliDi = (b: Uint8Array, a: Atomo, tipo: string): Atomo[] => atomi(b, a.inizio + a.testa, a.fine).filter((f) => f.tipo === tipo);

/** Aggiunge a ogni offset di `stco`/`co64` lo spostamento del `mdat` in cui cade. Modifica `moov` sul posto. */
function correggiOffset(moov: Uint8Array, mdat: { inizio: number; fine: number; delta: number }[]): void {
  const dv = vista(moov);
  const radice = atomi(moov, 0, moov.length)[0];
  for (const trak of figliDi(moov, radice, "trak"))
    for (const mdia of figliDi(moov, trak, "mdia"))
      for (const minf of figliDi(moov, mdia, "minf"))
        for (const stbl of figliDi(moov, minf, "stbl"))
          for (const t of atomi(moov, stbl.inizio + stbl.testa, stbl.fine)) {
            if (t.tipo !== "stco" && t.tipo !== "co64") continue;
            const largo = t.tipo === "co64" ? 8 : 4;
            const da = t.inizio + t.testa;
            if (t.fine - da < 8) no();
            const n = dv.getUint32(da + 4);
            if (n > (t.fine - da - 8) / largo) no();
            for (let k = 0; k < n; k++) {
              const p = da + 8 + k * largo;
              const vecchio = largo === 4 ? dv.getUint32(p) : dv.getUint32(p) * 2 ** 32 + dv.getUint32(p + 4);
              const m = mdat.find((x) => vecchio >= x.inizio && vecchio < x.fine);
              if (!m) no();
              const nuovo = vecchio + (m as { delta: number }).delta;
              if (nuovo < 0 || (largo === 4 && nuovo > 0xffffffff)) no();
              if (largo === 4) dv.setUint32(p, nuovo);
              else {
                dv.setUint32(p, Math.floor(nuovo / 2 ** 32));
                dv.setUint32(p + 4, nuovo >>> 0);
              }
            }
          }
}

/** Atomi che a livello del file portano metadati (`XMP_` e `uuid` ospitano i pacchetti XMP). */
const TOGLI_NEL_FILE = ["meta", "udta", "uuid", "XMP_"];

export type EsitoVideo = { ok: true; dati: Uint8Array; mime: "video/mp4" | "video/quicktime"; tolti: number } | { ok: false; frase: string };

/** Il video senza metadati di posizione. Non lancia mai: se non riesce, `{ ok: false, frase }` e il video NON si carica. */
export function pulisciVideo(b: Uint8Array): EsitoVideo {
  try {
    if (!(b instanceof Uint8Array)) no();
    const alto = atomi(b, 0, b.length);
    if (alto[0]?.tipo !== "ftyp") no();
    const mime = tipoDaFirma(b);
    const moov = alto.filter((a) => a.tipo === "moov");
    const mdat = alto.filter((a) => a.tipo === "mdat");
    if (!mime || moov.length !== 1 || mdat.length === 0 || alto.some((a) => a.tipo === "moof")) no();
    const nuovoMoov = senzaMetadati(b, moov[0], true);
    const parti: Uint8Array[] = [];
    const spostati: { inizio: number; fine: number; delta: number }[] = [];
    let p = 0;
    for (const a of alto) {
      if (TOGLI_NEL_FILE.includes(a.tipo)) continue;
      if (a.tipo === "mdat") spostati.push({ inizio: a.inizio, fine: a.fine, delta: p - a.inizio });
      const parte = a.tipo === "moov" ? nuovoMoov : b.subarray(a.inizio, a.fine);
      parti.push(parte);
      p += parte.length;
    }
    correggiOffset(nuovoMoov, spostati); // `nuovoMoov` è una copia nostra: l'originale non si tocca
    const dati = unisci(parti);
    return { ok: true, dati, mime: mime as "video/mp4" | "video/quicktime", tolti: b.length - dati.length };
  } catch {
    return { ok: false, frase: FRASE_VIDEO };
  }
}
