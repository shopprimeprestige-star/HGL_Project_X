/** ── LE VARIANTI DI UN PRODOTTO (EditorVarianti.tsx) · SEGNAPOSTO DI T14, LO RIEMPIE T15 ─────────
 *  Commessa 2026-11-20-shop-completo. Oggi non disegna niente. T15 SOSTITUISCE il contenuto (Design §4.10.4: opzioni,
 *  tabella delle combinazioni, prezzo vuoto = quello del prodotto, stock con motivo). Lo usa `SchedaProdotto` (T15).
 *
 *  ── LE PROPS (da tenere così) ────────────────────────────────────────────────
 *   · `prodotto`  `{ id, sku, nome, prezzoCent, pubblicato, versione }`: ciò che serve per le azioni `varianti_genera`,
 *                 `variante_salva`, `variante_attiva`, `giacenza_muovi` e `giacenza_imposta`. `pubblicato` accende la
 *                 frase «si applica subito» (D27).
 *   · `varianti`  le varianti lette con la scheda (`SchedaProdotto.varianti` del client).
 *   · `esegui`    `negozio.esegui`: l'esito (`ok`, o l'errore con `bloccanti`) lo legge chi lo chiama.
 *   · `aggiorna`  rilegge la scheda dopo ogni scrittura riuscita. */
import type { Variante } from "@/shop/cms/modello";
import type { Negozio } from "./tipi";

export interface PropsEditorVarianti {
  prodotto: {
    id: string;
    sku: string;
    nome: string;
    prezzoCent: number;
    pubblicato: boolean;
    versione: string;
  };
  varianti: Variante[];
  esegui: Negozio["esegui"];
  aggiorna: () => Promise<void>;
}

export function EditorVarianti(_props: PropsEditorVarianti): null {
  return null;
}
