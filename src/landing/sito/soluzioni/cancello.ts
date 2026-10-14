/** ── IL CANCELLO DELLA PAGINA «TRE SOLUZIONI» ───────────────────────────────
 *  Una regola sola, pura, provata da sola (`prove/sito/soluzioni-regole.mjs`):
 *  la pagina va ai visitatori solo con il video del titolare, la sua copertina
 *  e la conferma che i sottotitoli sono impressi. Se manca anche una sola cosa,
 *  chi apre `/soluzioni` torna alla home (302). Il semaforo dell'editor del CRM
 *  usa le stesse funzioni: due regole non possono contraddirsi.
 *
 *  `urlMedia` vive qui, e `regole.ts` lo ripete verso l'esterno, per non fare un
 *  giro in tondo fra i due file: il cancello deve sapere quando un indirizzo
 *  vale, e la vista usa lo stesso giudizio.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LandingContent } from "@/landing/landing-content";

export type Mancante = "video" | "copertina" | "sottotitoli";

const PERCORSO_BUCKET = "/storage/v1/object/public/landing-media/";
/** Solo la Supabase finta del collaudo gira su http: tutto il resto deve essere https. */
const HOST_LOCALI = new Set(["127.0.0.1", "localhost"]);

function origineAmmessa(o: unknown): URL | null {
  if (typeof o !== "string") return null;
  try {
    const u = new URL(o);
    if (u.protocol === "https:" || (u.protocol === "http:" && HOST_LOCALI.has(u.hostname))) return u;
  } catch {
    // non è un indirizzo
  }
  return null;
}

/** Un indirizzo di un file del CRM passa solo se è un file del bucket `landing-media` del NOSTRO storage, in https.
 *  Si guarda l'indirizzo letto da `new URL` (origine e percorso già normalizzati), non l'inizio del testo:
 *  `…/landing-media/../anteprime/x.jpg` ha il prefisso giusto ma il browser lo apre in un altro bucket.
 *  Tutto il resto («javascript:», «data:», un altro sito, un altro bucket, `..`, `%2e`) vale «niente» (""). */
export function urlMedia(u: unknown, origineStorage: unknown): string {
  if (typeof u !== "string") return "";
  const t = u.trim();
  if (!t || /[\s\p{Cc}\\]/u.test(t) || /%2e|%2f|%5c/i.test(t) || t.includes("..")) return "";
  const origine = origineAmmessa(origineStorage);
  if (!origine) return "";
  try {
    const url = new URL(t);
    if (url.origin !== origine.origin || url.username || url.password) return "";
    if (!url.pathname.startsWith(PERCORSO_BUCKET) || url.pathname.length === PERCORSO_BUCKET.length) return "";
    return url.href;
  } catch {
    return "";
  }
}

/** Cosa manca perché la pagina vada online. Un indirizzo che `urlMedia` non lascia passare vale «manca». */
export function mancantiSoluzioni(c: LandingContent, origineStorage: string): Mancante[] {
  const m: Mancante[] = [];
  if (!urlMedia(c.media["v3.invisibleVideo"], origineStorage)) m.push("video");
  if (!urlMedia(c.media["v3.invisiblePoster"], origineStorage)) m.push("copertina");
  if (c.texts["v3.invisibleSottotitoli"] !== "1") m.push("sottotitoli");
  return m;
}

export function soluzioniPubblicabile(c: LandingContent, origineStorage: string): boolean {
  return mancantiSoluzioni(c, origineStorage).length === 0;
}

const COME_SI_DICE: Record<Mancante, string> = {
  video: "il video",
  copertina: "la copertina",
  sottotitoli: "la conferma dei sottotitoli",
};

/** La frase del semaforo nell'editor, e della riga tratteggiata dell'anteprima. */
export function fraseSemaforo(m: Mancante[]): string {
  if (m.length === 0) return "Pronta per andare online";
  const voci = m.map((x) => COME_SI_DICE[x]);
  const elenco = voci.length === 1 ? voci[0] : `${voci.slice(0, -1).join(", ")} e ${voci[voci.length - 1]}`;
  return `Non va online: manca ${elenco}`;
}
