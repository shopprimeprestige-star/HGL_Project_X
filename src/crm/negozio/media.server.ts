/** ── I PERMESSI DI CARICAMENTO DEL CMS (media.server.ts) ────────────────────
 *  Commessa 2026-11-20-shop-completo (T09), PIANO §3.3 e D4.
 *
 *  POST { tipo: "foto" | "video" | "copertina", mime, peso } → `{ ok, bucket: "shop-media", path, token, url }`
 *  Un permesso FIRMATO per caricare UN file: il browser del CRM lo usa con `uploadToSignedUrl`. Per una foto si chiede
 *  un permesso per ogni misura (480, 960, 1600); poi `media_registra` (T08) scrive i percorsi.
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · Il percorso lo decide QUI: `<tipo>/<12 segni sorteggiati>.<estensione>`. Mai il nome del file, mai l'id o lo SKU del
 *    prodotto, mai un percorso suggerito dal client. Il bucket è pubblico (si legge dall'indirizzo): un indirizzo che non
 *    si indovina è ciò che tiene nascoste le bozze (60 bit).
 *  · Solo permessi di CARICAMENTO: questo modulo non legge e non scrive il database, e non firma mai una lettura.
 *  · Mime ammessi: jpeg, png, webp, avif (foto e copertina); mp4 e quicktime (video: l'iPhone registra così).
 *    Peso: 10 MB per foto e copertina, 25 MB per il video. Sono dichiarati dal client: li RIVERIFICA il bucket (S1: 25 MB e
 *    gli stessi sei tipi), quindi un client bugiardo viene respinto dallo Storage al caricamento.
 *  · Nei log solo codici: il token non finisce mai in un log. */
import { gestisci, leggiCorpo, rifiuta, type Porte } from "./comune";

export const BUCKET_SHOP = "shop-media";
export const MAX_FOTO = 10 * 1024 * 1024;
export const MAX_VIDEO = 25 * 1024 * 1024;
/** Base32 senza `0 1 8 9`: 32 segni, quindi un byte casuale ne sceglie uno senza distorsioni (256 = 8 × 32). */
const ALFABETO = "abcdefghijklmnopqrstuvwxyz234567";
const LUNGHEZZA = 12;

const FOTO = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } as const;
const VIDEO = { "video/mp4": "mp4", "video/quicktime": "mov" } as const;
const TIPI: Record<string, { mime: Record<string, string>; max: number; frase: string }> = {
  foto: { mime: FOTO, max: MAX_FOTO, frase: "La foto deve essere JPEG, PNG, WebP o AVIF e pesare al massimo 10 MB." },
  copertina: { mime: FOTO, max: MAX_FOTO, frase: "La copertina deve essere JPEG, PNG, WebP o AVIF e pesare al massimo 10 MB." },
  video: { mime: VIDEO, max: MAX_VIDEO, frase: "Il video deve essere MP4 o MOV e pesare al massimo 25 MB." },
};

/** Un percorso fatto da questo modulo: chi lo riceve da un client (T08, `media_registra`) può controllarlo con questo. */
export const percorsoShopValido = (p: unknown): p is string => typeof p === "string" && /^(foto|video|copertina)\/[a-z2-7]{12}\.(jpg|png|webp|avif|mp4|mov)$/.test(p);

export interface PorteMedia extends Porte {
  /** Il permesso firmato per caricare UN file (con Supabase: `storage.from(bucket).createSignedUploadUrl(path)`); lancia se non riesce. */
  storage: { creaPermesso(bucket: string, path: string): Promise<{ token: string; url: string }> };
  /** Byte casuali sicuri (di norma `crypto.getRandomValues`); la porta c'è per provare il sorteggio. */
  caso?: (n: number) => Uint8Array;
}

const casoVero = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
const sorteggia = (caso: (n: number) => Uint8Array): string =>
  Array.from(caso(LUNGHEZZA), (b) => ALFABETO[b % ALFABETO.length]).join("");

export async function permessoCaricamento(corpo: Record<string, unknown>, d: PorteMedia): Promise<Record<string, unknown>> {
  const tipo = typeof corpo.tipo === "string" && Object.hasOwn(TIPI, corpo.tipo) ? TIPI[corpo.tipo] : null;
  if (!tipo || typeof corpo.tipo !== "string") throw rifiuta("valore", 400, "Il tipo di file deve essere foto, video o copertina.");
  const estensione = typeof corpo.mime === "string" && Object.hasOwn(tipo.mime, corpo.mime) ? tipo.mime[corpo.mime] : null;
  if (!estensione) throw rifiuta("valore", 400, tipo.frase);
  const peso = corpo.peso;
  if (typeof peso !== "number" || !Number.isSafeInteger(peso) || peso <= 0 || peso > tipo.max) throw rifiuta("valore", 400, tipo.frase);

  const path = `${corpo.tipo}/${sorteggia(d.caso ?? casoVero)}.${estensione}`;
  let permesso: { token: string; url: string };
  try {
    permesso = await d.storage.creaPermesso(BUCKET_SHOP, path);
  } catch {
    d.log("permesso eccezione"); // mai il messaggio: potrebbe contenere il token
    throw rifiuta("interno", 500, "Non riesco a preparare il caricamento: riprova tra un momento.");
  }
  if (typeof permesso?.token !== "string" || !permesso.token || typeof permesso.url !== "string" || !permesso.url) {
    d.log("permesso vuoto");
    throw rifiuta("interno", 500, "Non riesco a preparare il caricamento: riprova tra un momento.");
  }
  return { bucket: BUCKET_SHOP, path, token: permesso.token, url: permesso.url };
}

export const gestisciPOST = (request: Request, d: PorteMedia): Promise<Response> =>
  gestisci(request, d, async () => permessoCaricamento(await leggiCorpo(request), d));
