/** ── VETRINA V1 · T78 · LA GALLERIA DELLA SCHEDA (parte pura) ────────────────
 *  Cosa deve valere (SPEC §4.5.4 n. 1, V1-S2):
 *   · l'ordine è fisso: principale, foto di scala (SEMPRE la seconda), foto 2-5, video. La confezione non è della galleria
 *     (ha il suo blocco «Nella confezione»), il campione è la pallina di una variante;
 *   · un video senza copertina non si mostra (né il file senza copertina, né la copertina senza file);
 *   · una foto vale solo con le tre misure; con UNA foto sola non ci sono frecce, puntini né miniature.
 *  ⚠️ «Una foto = nessun controllo» ha UNA sola fonte: `controlliGalleria` di `vetrina-interazioni.ts` (T105). Qui si usa, non si riscrive.
 *  Nessun React, nessuna rete: la prova lo gira senza browser. Il disegno è `src/components/shop/scheda/GalleriaProdotto.tsx` (T86). */
import { TESTI_PROVVISORI, riempi } from "@/landing/testi-shop";
import type { ProdottoPubblico, Slot, SrcFoto } from "./modello";
import { controlliGalleria } from "./vetrina-interazioni";

type Media = ProdottoPubblico["media"][number];

/** Una diapositiva pronta da disegnare: la foto con le sue tre misure, o il video con la sua copertina (sempre tutte e due). */
export type Diapositiva =
  | { tipo: "foto"; id: string; slot: Slot; alt: string; src: SrcFoto }
  | { tipo: "video"; id: string; alt: string; video: string; copertina: string; testoParlato: string | null; muto: boolean };

/** Il posto di ogni slot. Le foto 2-5 stanno TUTTE nello stesso posto: fra loro conta `ordine` (poi `id`), perché il CRM le riordina cambiando solo quello. */
const POSTO: Partial<Record<Slot, number>> = { principale: 0, scala: 1, foto2: 2, foto3: 2, foto4: 2, foto5: 2, video: 3 };

const scritto = (x: unknown): x is string => typeof x === "string" && x.trim() !== "";
const prima = (a: Media, b: Media) => (POSTO[a.slot] ?? 0) - (POSTO[b.slot] ?? 0) || a.ordine - b.ordine || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** I media del prodotto → le diapositive, nell'ordine della galleria. Un solo media per slot (il primo per `ordine` e `id`); l'ordine di arrivo non conta. */
export function ordinaGalleria(media: readonly Media[] | null | undefined): Diapositiva[] {
  const visti = new Set<string>();
  return [...(Array.isArray(media) ? (media as readonly Media[]) : [])]
    .filter((m) => POSTO[m.slot] !== undefined)
    .sort(prima)
    .flatMap((m): Diapositiva[] => {
      if (visti.has(m.slot)) return [];
      if (m.slot === "video") {
        if (!scritto(m.video) || !scritto(m.copertina)) return [];
        visti.add(m.slot);
        return [{ tipo: "video", id: m.id, alt: m.alt, video: m.video, copertina: m.copertina, testoParlato: m.testoParlato, muto: m.muto }];
      }
      if (!m.src || !m.src.w480 || !m.src.w960 || !m.src.w1600) return [];
      visti.add(m.slot);
      return [{ tipo: "foto", id: m.id, slot: m.slot, alt: m.alt, src: m.src }];
    });
}

/** «Foto 2 di 5» per il lettore di schermo. `i` si ferma dentro l'elenco; senza diapositive, niente.
 *  shortcut: il video usa la stessa frase (il documento non ne dà una per il video), da cambiare quando il copywriter la scrive: `ruolo` è già qui. */
export function etichettaDiapositiva(i: number, n: number, _ruolo: "foto" | "video"): string {
  if (!(n > 0)) return "";
  const posto = Math.min(Math.max(Math.trunc(i) || 0, 0), Math.trunc(n) - 1) + 1;
  return riempi(TESTI_PROVVISORI.galleria.numero, { n: posto, m: Math.trunc(n) });
}

/** Quali controlli si disegnano con `n` diapositive: tutti o nessuno, come dice `controlliGalleria` (con una foto sola, nessuno). */
export function controlli(n: number): { frecce: boolean; puntini: boolean; miniature: boolean } {
  const { mostra } = controlliGalleria({ indice: 0, totale: n });
  return { frecce: mostra, puntini: mostra, miniature: mostra };
}
