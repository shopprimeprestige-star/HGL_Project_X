/** ── LE FOTO `shop.*` SI RIDUCONO NEL BROWSER, PRIMA DI CARICARLE ────────────
 *  Commessa 2026-11-20-shop-completo, T81 (D99). Un'immagine da 6 MB nell'hero manderebbe a picco LCP e peso: l'editor della
 *  landing riduce le foto dei soli campi `shop.*` al lato massimo del campo, JPEG, MAI ingrandendo. Le altre chiavi (landing,
 *  recensioni, testi, video) non passano di qui. Il calcolo è PURO; il disegno vero (canvas) sta dietro una porta, come in
 *  `crm/negozio/ridimensiona.ts` (quel modulo ritaglia quadrati a tre misure fisse: qui serve un lato massimo per campo). */
import { MIME_FOTO } from "@/crm/negozio/ridimensiona";
import { leggiImmagine, type Immagine } from "@/crm/ecommerce/prodotti/media-browser";

/** Il limite di un campo: o un lato lungo massimo (la foto non si ritaglia), o una scatola fissa (si ritaglia al centro). */
export type Limite = { lato: number } | { larghezza: number; altezza: number };
export interface Rettangolo {
  x: number;
  y: number;
  larghezza: number;
  altezza: number;
}
export interface Piano {
  /** La parte della foto da disegnare, in pixel dell'originale. */
  ritaglio: Rettangolo;
  /** Le misure del file che si carica. */
  uscita: { larghezza: number; altezza: number };
}

const PREFISSO = "shop.";
/** I lati di D99. `condivisione` serve solo ai meta (1200 × 630). Ogni altra chiave `shop.*` (liberatoria, testi, video) resta com'è. */
const LATI: Record<string, Limite> = {
  heroFoto: { lato: 1100 },
  titolareFoto: { lato: 240 },
  pacco: { lato: 960 },
  coloriFoto: { lato: 960 },
  condivisione: { larghezza: 1200, altezza: 630 },
};
const POSTER = /^[A-Za-z]+Poster$/; // coloriPoster, curaPoster: 960
export const SFONDO = "#ffffff"; // il JPEG non ha trasparenza: un PNG trasparente verrebbe nero
export const TIPO_USCITA = "image/jpeg";
export const QUALITA = 0.8;

/** Il limite del campo, o `null` se la chiave non è una foto di `shop.*` da ridurre. */
export function latoMassimo(chiave: string): Limite | null {
  if (!chiave.startsWith(PREFISSO)) return null;
  const nome = chiave.slice(PREFISSO.length);
  if (Object.hasOwn(LATI, nome)) return LATI[nome];
  return POSTER.test(nome) ? { lato: 960 } : null;
}

const intero = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;
const almenoUno = (n: number) => Math.max(1, Math.round(n));

/** Cosa ritagliare e a che misura, senza mai ingrandire. Con misure illeggibili lancia: meglio nessuna foto che una 0×0. */
export function pianoRiduzione(limite: Limite, larghezza: unknown, altezza: unknown): Piano {
  if (!intero(larghezza) || !intero(altezza)) throw new Error("Non riesco a leggere le misure della foto: provane un'altra.");
  if ("lato" in limite) {
    const s = Math.min(1, limite.lato / Math.max(larghezza, altezza));
    return { ritaglio: { x: 0, y: 0, larghezza, altezza }, uscita: { larghezza: almenoUno(larghezza * s), altezza: almenoUno(altezza * s) } };
  }
  // scatola fissa: il rettangolo più grande con la stessa proporzione, al centro; poi scende, mai sale
  const largo = larghezza * limite.altezza > altezza * limite.larghezza; // la foto è più larga della scatola
  const l = largo ? almenoUno((altezza * limite.larghezza) / limite.altezza) : larghezza;
  const a = largo ? altezza : almenoUno((larghezza * limite.altezza) / limite.larghezza);
  const ritaglio = { x: Math.floor((larghezza - l) / 2), y: Math.floor((altezza - a) / 2), larghezza: l, altezza: a };
  return { ritaglio, uscita: l > limite.larghezza ? { larghezza: limite.larghezza, altezza: limite.altezza } : { larghezza: l, altezza: a } };
}

/** Il testo d'aiuto sotto il campo, o `null` se il campo non si riduce. Dice la cosa irreversibile: l'originale non resta. */
export function aiutoFotoShop(chiave: string): string | null {
  const l = latoMassimo(chiave);
  if (!l) return null;
  const misura = "lato" in l ? `lato lungo massimo ${l.lato} px` : `${l.larghezza} × ${l.altezza} px, ritagliata al centro`;
  return `La foto viene ridotta qui, prima di caricarla: ${misura}. Non la ingrandisco mai. L'originale non si salva e non si può recuperare: tienine una copia.`;
}

/** Ciò che serve dal browser: leggere la foto (con l'orientamento giusto) e disegnarla ritagliata e ridotta. */
export interface Porta {
  leggi(file: Blob): Promise<Pick<Immagine, "sorgente" | "larghezza" | "altezza" | "chiudi">>;
  disegna(sorgente: unknown, piano: Piano, sfondo: string, tipo: string, qualita: number): Promise<Blob | null>;
}

/** La porta vera: stessa lettura del CMS (`leggiImmagine`, con l'EXIF), il disegno su un canvas riempito di bianco. */
export const portaBrowser: Porta = {
  leggi: leggiImmagine,
  async disegna(sorgente, { ritaglio: r, uscita: u }, sfondo, tipo, qualita) {
    const canvas = document.createElement("canvas");
    canvas.width = u.larghezza;
    canvas.height = u.altezza;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Il browser non riesce a preparare la foto.");
    ctx.fillStyle = sfondo; // PRIMA il bianco, poi la foto
    ctx.fillRect(0, 0, u.larghezza, u.altezza);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sorgente as CanvasImageSource, r.x, r.y, r.larghezza, r.altezza, 0, 0, u.larghezza, u.altezza);
    return new Promise((ok) => canvas.toBlob(ok, tipo, qualita));
  },
};

/** Il file da caricare per il campo `chiave`: ridotto se è una foto di `shop.*`, lo STESSO file in ogni altro caso
 *  (altra chiave, video, GIF, SVG: non sono foto da ridurre). */
export async function riduciFotoShop(file: File, chiave: string, porta: Porta = portaBrowser): Promise<File> {
  const limite = latoMassimo(chiave);
  if (!limite || !(MIME_FOTO as readonly string[]).includes(file.type)) return file;
  const foto = await porta.leggi(file);
  try {
    const blob = await porta.disegna(foto.sorgente, pianoRiduzione(limite, foto.larghezza, foto.altezza), SFONDO, TIPO_USCITA, QUALITA);
    if (!blob) throw new Error("Non sono riuscito a preparare la foto: provane un'altra.");
    return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: TIPO_USCITA });
  } finally {
    foto.chiudi();
  }
}
