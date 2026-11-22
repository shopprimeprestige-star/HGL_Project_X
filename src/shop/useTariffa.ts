/** ── IL GANCIO DEL CARRELLO PER LA TARIFFA DEL SERVER ───────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T59 (PIANO-R2 D51). Collega il lettore puro (`cassa/tariffa-carrello.ts`, provato)
 *  alla funzione del server `tariffaSpedizione` (la stessa della cassa) e a `cassaDelSito`. Sta qui, accanto a
 *  `useRivalidaCarrello`, perché in `cassa/` le prove impacchettano ogni `.ts` e il server non si impacchetta. */
import { useEffect, useState } from "react";
import { cassaDelSito } from "@/shop/cms/cassa-sito.functions";
import { tariffaSpedizione } from "@/shop/cassa/tariffe.functions";
import { creaLettoreTariffa, type TariffaCarrello } from "@/shop/cassa/tariffa-carrello";

const ATTESA: TariffaCarrello = { stato: "attesa", costoCent: null, chiusa: false };

const lettore = creaLettoreTariffa({
  tariffa: () => tariffaSpedizione(),
  cassa: () => cassaDelSito(),
  adesso: () => Date.now(),
});

/** `attiva` = il catalogo è `cms`: con `codice` non si legge niente e il carrello resta quello di oggi. */
export function useTariffa(attiva: boolean): TariffaCarrello {
  const [tariffa, setTariffa] = useState<TariffaCarrello>(ATTESA);
  useEffect(() => {
    if (!attiva) return;
    let vivo = true;
    void lettore.leggi().then((x) => vivo && setTariffa(x));
    return () => {
      vivo = false;
    };
  }, [attiva]);
  return tariffa;
}
