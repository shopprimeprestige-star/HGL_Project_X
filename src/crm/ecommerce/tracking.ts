/** ── IL TRACKING DELLA SPEDIZIONE ───────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, Rilascio 2 (T47; PIANO-R2 D55, SPEC 8A n. 2). Modulo PURO: niente React, niente database.
 *
 *  Tre cose: l'elenco di partenza dei corrieri (SOLO i nomi), il numero di tracking valido, e il link che il cliente trova nella email.
 *  Il link NON si costruisce qui: la regola (modello `https://` con `{numero}`, il segnaposto mai nell'host) è `corriereLink` di T45
 *  (`src/shop/cassa/spedizione.ts`), una sola. Qui lo si chiama dopo aver controllato il numero. */
import { corriereLink } from "../../shop/cassa/spedizione";

/** I corrieri di partenza: gli STESSI sei nomi del seme di S5 (`shop_impostazioni.corrieri`), nello stesso ordine; una prova li confronta con la migrazione.
 *  Sono solo nomi: il modello del link lo scrive il titolare. L'elenco vero (modificabile) sta nel database; questo vale finché non si legge o se manca. */
export const CORRIERI_DI_PARTENZA: readonly string[] = [
  "BRT",
  "GLS",
  "SDA",
  "DHL",
  "UPS",
  "Poste Italiane",
];

/** Lunghezze ammesse del numero. shortcut: 5..40 per tutti i corrieri (i numeri veri sono 8-30 caratteri); stringere per corriere se serve. */
export const NUMERO_MIN = 5;
export const NUMERO_MAX = 40;
/** Lettere, cifre, spazio, punto, trattino, barra: niente tag, graffe, virgolette, `@`, `%`, caratteri di controllo. */
const NUMERO = /^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/;

/** Il numero scritto dall'operatore (spazi ai bordi esclusi) è un numero di tracking usabile? Mai un'eccezione. */
export function numeroValido(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const n = v.trim();
  return n.length >= NUMERO_MIN && n.length <= NUMERO_MAX && NUMERO.test(n);
}

/** L'indirizzo di tracciamento, o `null` se il numero non è valido o il corriere non ha un modello valido. `corrieri` = `[{nome, modello}]`. */
export function costruisciLink(corrieri: unknown, nome: unknown, numero: unknown): string | null {
  return numeroValido(numero)
    ? corriereLink(corrieri, nome, typeof numero === "string" ? numero.trim() : numero)
    : null;
}
