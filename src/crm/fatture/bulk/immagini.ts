/** ── FATTURE BULK · IMMAGINI NEL BROWSER (immagini.ts) ─────────────────────
 *  Commessa 2026-11-12-fatture-bulk, T8 (PIANO §5). Prima di mandare uno
 *  screenshot al server lo si controlla, se ne prende l'impronta e lo si riduce.
 *  Un file alla volta, per non tenere 300 immagini in memoria.
 *
 *  ── PERCHÉ SI RIDUCE E PERCHÉ L'IMPRONTA È DELL'ORIGINALE ────────────────
 *  Uno screenshot di telefono è 1170×2532 px e qualche MB; mandarne 600 sono
 *  gigabyte, e il modello non legge meglio un'immagine più grande. Il lato lungo
 *  scende a 2000 px (JPEG) e basta. L'impronta (SHA-256) è calcolata sui byte
 *  ORIGINALI, prima della riduzione: lo stesso screenshot caricato due volte dà
 *  la stessa impronta anche se la riduzione cambiasse un giorno, ed è così che
 *  si riconosce un pagamento già fatturato (T4) senza rileggere l'immagine.
 *  L'impronta non rivela niente dello screenshot.
 *
 *  Le parti pure (`controllaFile`, `misureRidotte`, `improntaSha256`) si provano in
 *  Node (prove/fatture-bulk/coda.mjs). La riduzione vera usa canvas e si prova nel
 *  browser (T14): soprattutto se i testi piccoli di un'app bancaria restano leggibili
 *  a 2000 px, o se serve di più (limite scritto qui sotto, una costante sola). */

/** Lato lungo massimo dopo la riduzione. ⚠️ Da confermare con uno screenshot di un'app bancaria vera
 *  (T14): se i testi piccoli diventano illeggibili si cambia questa costante, non altro. */
export const LATO_MASSIMO_PX = 2000;
/** Peso massimo del file originale. */
export const PESO_MASSIMO_BYTE = 15 * 1024 * 1024;
const QUALITA_JPEG = 0.85;
const TIPI_AMMESSI = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export type EsitoControlloFile = { ok: true } | { ok: false; motivo: string };

/** PNG/JPG/WebP, non vuoto, fino a 15 MB. Il motivo è una frase che dice cosa fare. */
export function controllaFile(file: { type: string; size: number }): EsitoControlloFile {
  if (!TIPI_AMMESSI.includes(file.type)) {
    return { ok: false, motivo: "Questo file non è un'immagine PNG, JPG o WebP: carica gli screenshot come immagini." };
  }
  if (!(file.size > 0)) return { ok: false, motivo: "Il file è vuoto: rifai lo screenshot." };
  if (file.size > PESO_MASSIMO_BYTE) {
    return { ok: false, motivo: "Il file pesa più di 15 MB: rifai lo screenshot o riducilo." };
  }
  return { ok: true };
}

/** Le misure dopo la riduzione: lato lungo al massimo `LATO_MASSIMO_PX`, proporzioni tenute, mai ingrandita. */
export function misureRidotte(larghezza: number, altezza: number): { larghezza: number; altezza: number } {
  const scala = Math.min(1, LATO_MASSIMO_PX / Math.max(larghezza, altezza));
  return { larghezza: Math.max(1, Math.round(larghezza * scala)), altezza: Math.max(1, Math.round(altezza * scala)) };
}

/** SHA-256 in esadecimale minuscolo (64 caratteri). */
export async function improntaSha256(dati: ArrayBuffer): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", dati));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ImmagineRidotta {
  /** JPEG, lato lungo al massimo 2000 px. */
  dataUrl: string;
  /** SHA-256 esadecimale dell'ORIGINALE. */
  impronta: string;
}

/** Impronta dell'originale, poi riduzione. Lancia un `Error` con una frase italiana se l'immagine non si apre. */
export async function riduciImmagine(file: File): Promise<ImmagineRidotta> {
  const impronta = await improntaSha256(await file.arrayBuffer());
  let bitmap: ImageBitmap;
  try {
    // Rispetta l'orientamento scritto nel file (default "from-image"): uno screenshot di telefono non è mai ruotato, una foto sì.
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Non riesco ad aprire questa immagine: rifai lo screenshot.");
  }
  try {
    const { larghezza, altezza } = misureRidotte(bitmap.width, bitmap.height);
    const tela = document.createElement("canvas");
    tela.width = larghezza;
    tela.height = altezza;
    const ctx = tela.getContext("2d");
    if (!ctx) throw new Error("Il browser non riesce a ridurre l'immagine.");
    // Un PNG con sfondo trasparente diventerebbe nero in JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, larghezza, altezza);
    ctx.drawImage(bitmap, 0, 0, larghezza, altezza);
    const dataUrl = tela.toDataURL("image/jpeg", QUALITA_JPEG);
    // Libera subito la memoria del canvas: con 300 immagini di fila si sente.
    tela.width = tela.height = 0;
    if (!dataUrl.startsWith("data:image/jpeg")) throw new Error("Il browser non riesce a ridurre l'immagine.");
    return { dataUrl, impronta };
  } finally {
    bitmap.close();
  }
}
