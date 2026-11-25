/** ── VETRINA V1 · T76 · LA VETRINA DELLA HOME E L'HERO (D78, D96; criteri V1-H2) ─
 *  Modulo PURO: niente React, niente rete. Dice QUALI prodotti vanno in «Da qui si parte», in quante colonne, e come è fatto l'hero.
 *  Scostamento dalla SPEC dichiarato (D78): la SPEC vuole «l'ordine scelto dal titolare nel CMS»; finché nel CMS non c'è il campo,
 *  si mostrano le patch in ordine alfabetico del nome, al massimo 6. Un ordine deciso e detto batte uno casuale. */
import { cardDaPubblico, type CardLeggera } from "./vetrina-card";
import type { ProdottoPubblico } from "./modello";

/** Quante card al massimo nella vetrina della home. */
export const MAX_VETRINA = 6;

/** Alfabetico all'italiana: senza badare a maiuscole e accenti, i numeri come numeri («Patch 2» prima di «Patch 10»). */
const ordineNomi = new Intl.Collator("it", { sensitivity: "base", numeric: true });
const prima = (a: CardLeggera, b: CardLeggera) => ordineNomi.compare(a.nome, b.nome) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

/** Le card della vetrina: le **patch** (mai Invisible Derm, mai cura o kit) con foto e prezzo, in ordine alfabetico del nome, le prime 6.
 *  Con meno di 2 → `null`: la vetrina non si monta e i due bottoni dell'hero portano alle categorie. Una patch tutta esaurita resta
 *  (D78 dice «patch pubblicate»): la sua card porta alla scheda. */
export function scegliVetrina(prodotti: readonly ProdottoPubblico[]): CardLeggera[] | null {
  if (!Array.isArray(prodotti)) return null;
  const card = prodotti
    .filter((p) => !!p && typeof p.slug === "string" && typeof p.nome === "string" && p.tipo === "patch")
    .map(cardDaPubblico)
    .filter((k) => !k.senzaPrezzo && k.foto !== null)
    .sort(prima)
    .slice(0, MAX_VETRINA);
  return card.length < 2 ? null : card;
}

/** Colonne della griglia: 2 sul telefono; sul computer 4 prodotti = 4 colonne, 5-6 = 3 (e 2 o 3 prodotti = tante colonne quanti sono).
 *  `null` = la vetrina non si monta (meno di 2) o il numero non è un conteggio. */
export function colonneVetrina(n: number): { telefono: 2; computer: 2 | 3 | 4 } | null {
  if (!Number.isInteger(n) || n < 2) return null;
  return { telefono: 2, computer: n <= 4 ? (n as 2 | 3 | 4) : 3 };
}

/** Un testo vero: scritto, non di soli spazi, senza segnaposto `{{…}}`. */
const vero = (t: unknown): t is string => typeof t === "string" && t.trim() !== "" && !t.includes("{{");

export interface PianoHero {
  /** Senza foto dell'hero: una colonna centrata. */
  colonne: 1 | 2;
  /** Il ritratto tondo con il nome: serve la foto **e** il nome confermato. */
  ritratto: boolean;
  /** Il nome da scrivere accanto al ritratto (`firmatario` confermato), `null` quando il ritratto non c'è. */
  nome: string | null;
}

/** D96: l'hero. Un nome non confermato non si mostra mai: senza foto del titolare o senza firmatario spariscono ritratto e nome
 *  (resta la riga dello studio, che sta nei testi). */
export function pianoHero(dati?: { heroFoto?: unknown; titolareFoto?: unknown; firmatario?: unknown } | null): PianoHero {
  const ritratto = vero(dati?.titolareFoto) && vero(dati?.firmatario);
  return {
    colonne: vero(dati?.heroFoto) ? 2 : 1,
    ritratto,
    nome: ritratto ? (dati!.firmatario as string).trim() : null,
  };
}
