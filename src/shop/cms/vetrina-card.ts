/** ── VETRINA V1 · T76 · LA CARD LEGGERA (D79, D86; criteri V1-C1, V1-T6) ───────
 *  Modulo PURO: niente React, niente rete. Dal prodotto del server (`ProdottoPubblico`) ai soli campi che servono a disegnare una
 *  card (home, categoria, ricerca, «Ti serve anche»): è anche l'elenco «leggero» della ricerca (D79) e dei loader. Non copia la
 *  riga: la card si COSTRUISCE campo per campo, così una descrizione, una FAQ o il prezzo di una variante non possono arrivarci.
 *  ⚠️ Invisible Derm non ha mai un prezzo (D39): `prezzoCent` è `null` e `prezziDiversi` falso anche se il dato arrivasse con una
 *   cifra per errore (lo riconosce `eInvisibleDerm`, o il server con `acquistabile: false`). Il bottone è «scopri», mai «aggiungi».
 *  ⚠️ I testi (bottoni, «{n} colori», «Pronta consegna») stanno in `src/landing/testi-shop.ts`: qui solo stati e il testo del badge. */
import { TESTI_PROVVISORI, TESTI_SHOP, riempi } from "@/landing/testi-shop";
import type { ProdottoPubblico } from "./modello";
import { eInvisibleDerm } from "./pubblico";
import { filtraConfermati, type TestiConfermati } from "./testi-confermati";

/** Le sole misure che la card usa (480 e 960: `FotoShop` con uso «card» non chiede la 1600). */
export type FotoCard = { w480: string; w960: string };

export interface CardLeggera {
  slug: string;
  nome: string;
  /** La riga di presentazione, o `null`. */
  riga: string | null;
  /** Il prezzo più basso fra le varianti attive, in centesimi. `null` = nessun prezzo da mostrare (Invisible Derm, dato mancante). */
  prezzoCent: number | null;
  /** Le varianti costano cifre diverse: chi disegna può dirlo («da …»), la card non scrive la parola. */
  prezziDiversi: boolean;
  /** La foto principale, o `null`: senza foto la card non ha un riquadro da riempire. */
  foto: FotoCard | null;
  /** La descrizione della foto (dal CMS); `null` se non c'è la foto. */
  fotoAlt: string | null;
  /** Quanti valori ha l'opzione «Colore» (0 se non c'è). */
  nColori: number;
  /** Ci sono scelte da fare (almeno un'opzione, o più di una variante): il bottone porta alla scheda. */
  conVarianti: boolean;
  /** Un clic basta per metterla nel carrello: una sola variante, senza opzioni, disponibile e con un prezzo (come `daAggiungereDalCard`). */
  aggiungibile: boolean;
  /** Almeno una variante attiva è disponibile (e il prodotto si vende). */
  disponibile: boolean;
  senzaPrezzo: boolean;
  /** Gli SKU delle varianti attive, nell'ordine del server (la ricerca li cerca). */
  skuVarianti: string[];
}

export type AzioneCard = "scegli" | "aggiungi" | "scopri";

const prezzoValido = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;
const testoPulito = (t: unknown): string | null => (typeof t === "string" && t.trim() !== "" ? t.trim() : null);

/** Il prodotto del server → la card. Mai un errore per un dato mancante: un valore che non c'è diventa «niente» (null, 0, falso). */
export function cardDaPubblico(p: ProdottoPubblico): CardLeggera {
  const varianti = Array.isArray(p.varianti) ? p.varianti : [];
  const opzioni = Array.isArray(p.opzioni) ? p.opzioni : [];
  const senzaPrezzo = eInvisibleDerm(p.nome, p.slug) || p.acquistabile !== true || !prezzoValido(p.prezzoDaCent);
  const prezzi = new Set(varianti.map((v) => v.prezzoCent).filter(prezzoValido));
  const principale = (Array.isArray(p.media) ? p.media : []).find((m) => m.slot === "principale" && m.src);
  const unica = varianti.length === 1 ? varianti[0] : null;
  return {
    slug: p.slug,
    nome: p.nome,
    riga: testoPulito(p.rigaPresentazione),
    prezzoCent: senzaPrezzo ? null : (p.prezzoDaCent as number),
    prezziDiversi: !senzaPrezzo && prezzi.size > 1,
    foto: principale?.src ? { w480: principale.src.w480, w960: principale.src.w960 } : null,
    fotoAlt: principale?.src ? principale.alt : null,
    nColori: opzioni.find((o) => o.nome.trim().toLowerCase() === "colore")?.valori.length ?? 0,
    conVarianti: opzioni.length > 0 || varianti.length > 1,
    aggiungibile: !senzaPrezzo && opzioni.length === 0 && unica !== null && unica.disponibile === true && prezzoValido(unica.prezzoCent),
    disponibile: !senzaPrezzo && varianti.some((v) => v.disponibile === true),
    senzaPrezzo,
    skuVarianti: varianti.map((v) => v.sku),
  };
}

/** Il bottone della card. Senza prezzo vince su tutto («scopri»: Invisible Derm); poi «aggiungi» (un clic); il resto va alla scheda («scegli»,
 *  anche per un prodotto senza scelte ma esaurito: la scheda dice «Esaurito»). */
export function azioneCard(c: Pick<CardLeggera, "senzaPrezzo" | "aggiungibile">): AzioneCard {
  return c.senzaPrezzo ? "scopri" : c.aggiungibile ? "aggiungi" : "scegli";
}

/** L'elenco leggero: una card per prodotto, nell'ordine ricevuto. Salta (senza lanciare) ciò che non ha nome o indirizzo. */
export function soloLeggere(prodotti: readonly ProdottoPubblico[]): CardLeggera[] {
  if (!Array.isArray(prodotti)) return [];
  return prodotti.filter((p) => !!p && typeof p.slug === "string" && typeof p.nome === "string").map(cardDaPubblico);
}

/** «{n} colori» solo da 2 colori in su (mai «1 colori»); il testo è la costante del copy. */
export function etichettaColori(n: number): string | null {
  return Number.isInteger(n) && n >= 2 ? riempi(TESTI_PROVVISORI.card.nColori, { n }) : null;
}

/** D86: il badge «Pronta consegna» c'è solo se il titolare ha confermato la voce **e** la variante (scelta, o almeno una attiva nella card) è
 *  disponibile. Il testo del titolare serve solo da interruttore: sul badge va la costante del copy. */
export function badgeProntaConsegna(testi: Partial<Record<keyof TestiConfermati, unknown>> | null | undefined, disponibile: unknown): string | null {
  return disponibile === true && filtraConfermati(testi).pronta_consegna !== null ? TESTI_SHOP.card.prontaConsegna : null;
}
