/** ── LA SCHEDA «ORDINI» (ElencoOrdini.tsx) · SEGNAPOSTO DI T11 ──────────────────
 *  Commessa 2026-11-17-crm-ecommerce. T11 consegna il guscio della pagina e la Panoramica; l'elenco vero (ricerca, filtri,
 *  stato cambiabile, pagato, pannello di dettaglio) è T12 e sostituisce QUESTO file senza toccare il guscio.
 *
 *  Quello che T12 riceve già pronto, e deve rispettare:
 *   · `lettura.ordini` è LO STESSO elenco della Panoramica: il periodo si applica con `nelPeriodo(o, periodo)` di `conti.ts`,
 *     mai con `rangeMatch` sulle righe (un ordine fra mezzanotte e le 2 cadrebbe in due giorni diversi fra cifra e riga).
 *   · `stato` e `ordine` vengono dall'indirizzo (`?stato=`, `?ordine=`); `imposta` li cambia senza lasciare la scheda.
 *   · `migrazionePronta === false` = comandi spenti col motivo (la pagina ha già l'avviso fisso).
 *   · Per segnalare gli importi fuori norma nella riga: `importoFuoriNorma(o)` di `conti.ts`.
 *   · Le azioni passano da `useOrdini().esegui` e se ne legge l'esito (`conflitto`, `storico: false`, `migrazione`):
 *     il guscio lo chiama una volta sola e potrà passare anche `esegui`/`storico` quando T12 ne avrà bisogno. */
import { PackageSearch } from "lucide-react";
import { Vuoto, plurale } from "@/crm/ui";
import { nelPeriodo } from "./conti";
import type { Periodo } from "./conti";
import { ETICHETTA_STATO } from "./ordine";
import type { StatoOrdine } from "./ordine";
import type { StatoOrdini } from "./client";

export interface PropsElencoOrdini {
  lettura: Pick<StatoOrdini, "ordini">;
  periodo: Periodo;
  /** Dall'indirizzo: il filtro scelto con un clic sulla Panoramica. */
  stato?: StatoOrdine;
  /** Dall'indirizzo: l'ordine con il dettaglio aperto. */
  ordine?: string;
  /** `false` = mancano le colonne nuove del database: nessuna azione. `null` = non si è ancora letto. */
  migrazionePronta: boolean | null;
  /** Cambia stato e ordine nell'indirizzo, restando sulla scheda. */
  imposta?: (p: { stato?: StatoOrdine; ordine?: string }) => void;
}

export function ElencoOrdini({ lettura, periodo, stato }: PropsElencoOrdini) {
  const righe = lettura.ordini.filter(
    (o) => nelPeriodo(o, periodo) && (!stato || o.stato === stato),
  );
  return (
    <Vuoto
      icona={PackageSearch}
      titolo="L'elenco degli ordini arriva con il prossimo passo"
      testo={`Per ora la Panoramica è completa. In questo periodo ci sono ${plurale(righe.length, "ordine", "ordini")}${stato ? ` in stato «${ETICHETTA_STATO[stato]}»` : ""}.`}
    />
  );
}
