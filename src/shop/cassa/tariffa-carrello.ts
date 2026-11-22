/** ── LA TARIFFA DI SPEDIZIONE NEL CARRELLO: IL LETTORE (PURO) ────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T59 (PIANO-R2 D51). Nessun import del server: si prova con funzioni finte
 *  (il gancio `src/shop/useTariffa.ts` lo collega a `tariffaSpedizione` e a `cassaDelSito`). Il carrello (catalogo `cms`) mostra la cifra che dà il server:
 *  la STESSA funzione che legge la cassa (`tariffaSpedizione`), nessuna costante qui. Con la cassa vecchia il ripiego
 *  (490, D51) sta già dentro quella funzione: il carrello non ha un secondo ramo.
 *  Stati: `attesa` (non ancora letta), `ok` (c'è la cifra), `assente` (nessuna tariffa valida), `guasto` (il server non risponde
 *  o risponde storto). Senza cifra (`costoCent: null`) la pagina non mostra nessun totale.
 *  `chiusa`: tariffa assente E cassa `stripe` = la cassa nuova non si apre («Il negozio sta per aprire»).
 *  Memoria breve di 30 s (come il server); un guasto non si ricorda. Mai un'eccezione verso la pagina. */
import type { Cassa } from "../cms/cassa-sito";
import type { SpedizionePubblica } from "./spedizione";

export type TariffaCarrello =
  | { stato: "ok"; costoCent: number; chiusa: false }
  | { stato: "attesa" | "assente" | "guasto"; costoCent: null; chiusa: boolean };

const MEMORIA_MS = 30_000;

export interface PorteLettore {
  tariffa: () => Promise<SpedizionePubblica>;
  cassa: () => Promise<Cassa>;
  /** Millisecondi; le prove usano un orologio finto. */
  adesso: () => number;
}

/** Un lettore con la sua memoria: più letture entro 30 s fanno una chiamata sola. */
export function creaLettoreTariffa(porte: PorteLettore) {
  let voce: { t: number; p: Promise<TariffaCarrello> } | null = null;
  const leggiDavvero = async (): Promise<TariffaCarrello> => {
    let r: unknown;
    try {
      r = await porte.tariffa();
    } catch {
      return { stato: "guasto", costoCent: null, chiusa: false };
    }
    const x = r as { stato?: unknown; costoCent?: unknown } | null;
    if (x?.stato === "ok" && typeof x.costoCent === "number" && Number.isSafeInteger(x.costoCent) && x.costoCent >= 0)
      return { stato: "ok", costoCent: x.costoCent, chiusa: false };
    if (x?.stato !== "assente") return { stato: "guasto", costoCent: null, chiusa: false };
    // senza tariffa conta solo la cassa: con `stripe` non si apre, con la vecchia lavora (se non si sa, non si dice «chiusa»)
    const cassa = await porte.cassa().catch(() => "vecchia" as const);
    return { stato: "assente", costoCent: null, chiusa: cassa === "stripe" };
  };
  return {
    leggi(): Promise<TariffaCarrello> {
      const ora = porte.adesso();
      if (voce && ora >= voce.t && ora - voce.t < MEMORIA_MS) return voce.p;
      const nuova = { t: ora, p: leggiDavvero() };
      voce = nuova;
      // un guasto non resta in memoria: alla lettura dopo si riprova
      void nuova.p.then((x) => {
        if (x.stato === "guasto" && voce === nuova) voce = null;
      });
      return nuova.p;
    },
  };
}
