/** ── RIDIMENSIONARE LE FOTO NEL BROWSER, PRIMA DEL CARICAMENTO ──────────────
 *  Commessa 2026-11-20-shop-completo (T13, D4). Modulo PURO, tranne `disegnaMisure` che parla con una PORTA (il canvas
 *  vero lo mette la schermata): così si prova senza browser.
 *
 *  Le foto del catalogo sono QUADRATE (1:1) in tre misure (480, 960, 1600): il browser ritaglia un quadrato al centro (o
 *  dove il titolare indica) e ne ricava le misure, MAI ingrandendo. Al server arrivano solo le misure: l'originale non
 *  si conserva (D5, SPEC §6). Le frasi sono per il titolare, in italiano semplice (Design §4.10.3). */

/** I tre nomi dei file che il server si aspetta (`path480`, `path960`, `path1600`). */
export const NOMI_MISURE = [480, 960, 1600] as const;
/** Sotto questo lato la foto «può sembrare sfocata» (si avvisa, non si blocca). */
export const LATO_CONSIGLIATO = 1200;
export const LATO_CAMPIONE = 400;
export const MAX_FOTO_BYTE = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTE = 25 * 1024 * 1024;
export const MAX_VIDEO_SECONDI = 15;
/** Un lato oltre questo non è una foto vera (o il browser non la regge). shortcut: tetto fisso, da alzare se serve. */
const MAX_LATO_PX = 30_000;
export const MIME_FOTO = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MIME_VIDEO = ["video/mp4", "video/quicktime"] as const;

export interface Punto {
  x: number;
  y: number;
}
/** Il quadrato da ritagliare, in pixel della foto originale. */
export interface Ritaglio {
  x: number;
  y: number;
  lato: number;
}
/** Un file da produrre: `lato` pixel, che serve per i nomi in `per` (una foto piccola ne serve uno solo per più nomi). */
export interface Misura {
  lato: number;
  per: number[];
}
export interface Avviso {
  codice: "piccola" | "non_quadrata";
  frase: string;
}
export interface Piano {
  ritaglio: Ritaglio;
  misure: Misura[];
  avvisi: Avviso[];
}
export type EsitoPiano = { ok: true; piano: Piano } | { ok: false; frase: string };

const PUNTO_CENTRALE: Punto = { x: 0.5, y: 0.5 };
const intero = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0 && n <= MAX_LATO_PX;
/** Un valore 0-1 qualunque (storto, fuori scala) diventa 0-1; se non è un numero vale il centro. */
const frazione = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

/** Il quadrato più grande che sta nella foto, spostato dal punto (0 = a un bordo, 1 = all'altro, 0.5 = al centro). */
function ritagliaQuadrato(larghezza: number, altezza: number, punto?: Partial<Punto> | null): { ritaglio: Ritaglio; alCentro: boolean } {
  const lato = Math.min(larghezza, altezza);
  const px = frazione(punto?.x), py = frazione(punto?.y);
  return {
    ritaglio: { x: Math.round(px * (larghezza - lato)), y: Math.round(py * (altezza - lato)), lato },
    alCentro: px === PUNTO_CENTRALE.x && py === PUNTO_CENTRALE.y,
  };
}

/** I file da fare per i nomi dati: mai più grandi del quadrato; i nomi che non ci stanno condividono un file alla misura del quadrato. */
function misureDa(nomi: readonly number[], lato: number): Misura[] {
  const proprie = nomi.filter((n) => n <= lato).map((n) => ({ lato: n, per: [n] }));
  const troppo = nomi.filter((n) => n > lato);
  return troppo.length ? [...proprie, { lato, per: [...troppo] }] : proprie;
}

const NON_LEGGO = "Non riesco a leggere le misure della foto: provane un'altra.";
const piccola = (lato: number): Avviso => ({ codice: "piccola", frase: `La foto è piccola (${lato} px): sul sito può sembrare sfocata.` });

/** Il piano per una foto di prodotto: quale quadrato ritagliare, quali file fare, cosa dire al titolare. */
export function pianoFoto(larghezza: unknown, altezza: unknown, punto?: Partial<Punto> | null): EsitoPiano {
  if (!intero(larghezza) || !intero(altezza)) return { ok: false, frase: NON_LEGGO };
  const { ritaglio, alCentro } = ritagliaQuadrato(larghezza, altezza, punto);
  const avvisi: Avviso[] = [];
  if (ritaglio.lato < LATO_CONSIGLIATO) avvisi.push(piccola(ritaglio.lato));
  if (larghezza !== altezza)
    avvisi.push({ codice: "non_quadrata", frase: alCentro ? "La foto non è quadrata: la ritaglio al centro." : "La foto non è quadrata: la ritaglio dove hai indicato." });
  return { ok: true, piano: { ritaglio, misure: misureDa(NOMI_MISURE, ritaglio.lato), avvisi } };
}

/** Il campione del colore: 1:1, un solo file da 400 px (o meno, se la foto è più piccola). */
export function pianoCampione(larghezza: unknown, altezza: unknown, punto?: Partial<Punto> | null): EsitoPiano {
  if (!intero(larghezza) || !intero(altezza)) return { ok: false, frase: NON_LEGGO };
  const { ritaglio } = ritagliaQuadrato(larghezza, altezza, punto);
  return { ok: true, piano: { ritaglio, misure: misureDa([LATO_CAMPIONE], ritaglio.lato), avvisi: ritaglio.lato < LATO_CAMPIONE ? [piccola(ritaglio.lato)] : [] } };
}

/* ── formato, peso, durata ────────────────────────────────────────────── */

export type TipoFile = "foto" | "video" | "copertina";
export type EsitoFile = { ok: true } | { ok: false; frase: string };

/** Il file si può caricare? (la copertina del video è una foto). */
export function controllaFile(f: { tipo: unknown; mime: unknown; byte: unknown; durataS?: unknown }): EsitoFile {
  const no = (frase: string): EsitoFile => ({ ok: false, frase });
  if (f.tipo !== "foto" && f.tipo !== "video" && f.tipo !== "copertina") return no("Non so che tipo di file sia: riprova.");
  const video = f.tipo === "video";
  const ammessi: readonly unknown[] = video ? MIME_VIDEO : MIME_FOTO;
  if (typeof f.mime !== "string" || !ammessi.includes(f.mime))
    return no(video ? "Questo tipo di file non va bene: per i video usa MP4 o MOV." : "Questo tipo di file non va bene: per le foto usa JPG, PNG, WebP o AVIF.");
  if (typeof f.byte !== "number" || !Number.isFinite(f.byte) || f.byte <= 0) return no("Non riesco a leggere il file: provane un altro.");
  if (f.byte > (video ? MAX_VIDEO_BYTE : MAX_FOTO_BYTE)) return no(video ? "Il video è troppo pesante: al massimo 25 MB." : "La foto è troppo pesante: al massimo 10 MB.");
  if (video) {
    if (typeof f.durataS !== "number" || !Number.isFinite(f.durataS) || f.durataS <= 0) return no("Non riesco a leggere la durata del video: provane un altro.");
    if (f.durataS > MAX_VIDEO_SECONDI) return no(`Il video è troppo lungo: al massimo ${MAX_VIDEO_SECONDI} secondi.`);
  }
  return { ok: true };
}

/* ── il disegno vero (dietro una porta) ───────────────────────────────── */

/** Ciò che serve dal browser: un riquadro quadrato di `lato` px su cui disegnare, e il file che ne esce. La schermata lo implementa con un `canvas`. */
export interface PortaCanvas {
  crea(lato: number): {
    /** `sfondo`: il colore con cui riempire il riquadro PRIMA di disegnare (il JPEG non ha trasparenza: un PNG trasparente verrebbe nero). */
    disegna(sorgente: unknown, ritaglio: Ritaglio, sfondo: string): void;
    aBlob(tipo: string, qualita: number): Promise<Blob | null>;
  };
}
export interface FileMisura extends Misura {
  blob: Blob;
}
/** shortcut: si scrive sempre JPEG (ogni browser sa farlo, il server lo ammette); WebP/AVIF peserebbero meno, ma non ovunque si possono scrivere. */
const TIPO_USCITA = "image/jpeg";
const QUALITA = 0.88;
const SFONDO = "#ffffff";

/** I file del piano, uno per misura, tutti dallo stesso quadrato della stessa foto. */
export async function disegnaMisure(sorgente: unknown, piano: Piano, porta: PortaCanvas): Promise<FileMisura[]> {
  const fuori: FileMisura[] = [];
  for (const m of piano.misure) {
    const canvas = porta.crea(m.lato);
    canvas.disegna(sorgente, piano.ritaglio, SFONDO);
    const blob = await canvas.aBlob(TIPO_USCITA, QUALITA);
    if (!blob) throw new Error("Non sono riuscito a preparare la foto: provane un'altra.");
    fuori.push({ ...m, blob });
  }
  return fuori;
}
