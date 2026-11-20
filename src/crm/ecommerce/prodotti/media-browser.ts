/** ── FOTO E VIDEO: LA PARTE CHE PARLA COL BROWSER (media-browser.ts) ─────────
 *  Commessa 2026-11-20-shop-completo, T16. Le «porte» vere per `ridimensiona.ts` (T13): leggere una foto con la sua
 *  ORIENTAMENTO (EXIF), disegnarla su un riquadro quadrato RIEMPITO DI BIANCO (il JPEG non ha trasparenza: un PNG trasparente
 *  verrebbe nero), misurare un video e prenderne un fotogramma. Niente rete, niente React. Si prova in un Chrome vero
 *  (vedi la voce in LAVAGNA): le prove di `prove.mjs` non hanno un canvas.
 *  ⚠️ Nessun log da qui: i file sono del titolare. */
import type { PortaCanvas } from "@/crm/negozio/ridimensiona";

export interface Immagine {
  sorgente: CanvasImageSource;
  /** Larghezza e altezza DOPO l'orientamento: una foto scattata in piedi dal telefono è più alta che larga. */
  larghezza: number;
  altezza: number;
  chiudi(): void;
}

/** shortcut: se `createImageBitmap` non accetta l'opzione (Safari vecchi) si passa da un `<img>`, che ruota da sé; da togliere quando non servono più. */
async function daElemento(file: Blob): Promise<Immagine> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      sorgente: img,
      larghezza: img.naturalWidth,
      altezza: img.naturalHeight,
      chiudi: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Non riesco a leggere la foto: provane un'altra.");
  }
}

export async function leggiImmagine(file: Blob): Promise<Immagine> {
  if (typeof createImageBitmap !== "function") return daElemento(file);
  try {
    const b = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { sorgente: b, larghezza: b.width, altezza: b.height, chiudi: () => b.close() };
  } catch {
    return daElemento(file);
  }
}

export const portaCanvas: PortaCanvas = {
  crea(lato) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = lato;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Il browser non riesce a preparare la foto.");
    return {
      disegna(sorgente, r, sfondo) {
        ctx.fillStyle = sfondo; // PRIMA il bianco, poi la foto
        ctx.fillRect(0, 0, lato, lato);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(sorgente as CanvasImageSource, r.x, r.y, r.lato, r.lato, 0, 0, lato, lato);
      },
      aBlob: (tipo, qualita) => new Promise((ok) => canvas.toBlob(ok, tipo, qualita)),
    };
  },
};

const ATTESA_VIDEO_MS = 10_000;
const aspetta = (el: HTMLVideoElement, evento: string): Promise<void> =>
  new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error("timeout")), ATTESA_VIDEO_MS);
    el.addEventListener(
      evento,
      () => {
        clearTimeout(t);
        ok();
      },
      { once: true },
    );
    el.addEventListener(
      "error",
      () => {
        clearTimeout(t);
        no(new Error("video"));
      },
      { once: true },
    );
  });

/** La durata misurata nel browser e il fotogramma a `secondo` (di norma 1) come JPEG. La copertina può mancare (`null`): il video si carica lo stesso. */
export async function leggiVideo(
  file: Blob,
  secondo = 1,
): Promise<{ durataS: number; copertina: Blob | null }> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "metadata";
  try {
    v.src = url;
    await aspetta(v, "loadedmetadata");
    const durataS = v.duration;
    if (!Number.isFinite(durataS) || durataS <= 0) throw new Error("durata");
    let copertina: Blob | null = null;
    try {
      v.currentTime = Math.min(secondo, durataS / 2);
      await aspetta(v, "seeked");
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext("2d")?.drawImage(v, 0, 0);
      copertina = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
    } catch {
      copertina = null;
    }
    return { durataS, copertina };
  } catch {
    throw new Error("Non riesco a leggere il video: provane un altro.");
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}
