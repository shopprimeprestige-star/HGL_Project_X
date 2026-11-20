/** ── FOTO E VIDEO DI UN PRODOTTO (EditorMedia.tsx) · SEGNAPOSTO DI T14, LO RIEMPIE T16 ───────────
 *  Commessa 2026-11-20-shop-completo. Oggi non disegna niente. T16 SOSTITUISCE il contenuto (Design §4.10.3: griglia di
 *  slot fissi, ridimensionamento nel browser, caricamento con permesso firmato). Lo usa `SchedaProdotto` (T15).
 *
 *  ── LE PROPS (da tenere così) ────────────────────────────────────────────────
 *   · `prodotto`  `{ id, nome, pubblicato }`: il nome serve a precompilare la descrizione per chi non vede; `pubblicato`
 *                 accende «si applica subito».
 *   · `media`     i media letti con la scheda (`SchedaProdotto.media`), già senza quelli rimossi.
 *   · `esegui`    `negozio.esegui`: per `media_registra`, `media_ordina`, `media_alt`, `media_flag`, `media_rimuovi`.
 *   · `aggiorna`  rilegge la scheda dopo ogni scrittura riuscita.
 *  Il caricamento dei file NON passa da qui: T16 usa `chiediPermesso` e `caricaConPermesso` di `crm/negozio/client.ts`. */
import type { Media } from "@/shop/cms/modello";
import type { Negozio } from "./tipi";

export interface PropsEditorMedia {
  prodotto: { id: string; nome: string; pubblicato: boolean };
  media: Media[];
  esegui: Negozio["esegui"];
  aggiorna: () => Promise<void>;
}

export function EditorMedia(_props: PropsEditorMedia): null {
  return null;
}
