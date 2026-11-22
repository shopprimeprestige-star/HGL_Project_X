/** ── LA SCHEDA «SPEDIZIONI»: SEGNAPOSTO (ElencoTariffe.tsx) ───────────────────────────────────
 *  Shop completo R2, T62. Tiene il posto della linguetta «Spedizioni»: la sostituisce T65 (tariffe, corrieri, conferma) tenendo
 *  nome e props. Non legge niente e non scrive niente: dice onestamente che arriva dopo.
 *  Props: `fetch` è la `fetchCRM` della pagina (T65 la usa per `/api/crm/negozio?spedizioni`). */
import { Truck } from "lucide-react";
import { Vuoto } from "@/crm/ui";
import type { FetchRotta } from "@/crm/ecommerce/pagina-r2";

export function ElencoTariffe(_props: { fetch: FetchRotta }) {
  return (
    <Vuoto
      icona={Truck}
      titolo="Le tariffe di spedizione arrivano con il prossimo aggiornamento"
      testo="Qui si sceglieranno corrieri, costi e soglia di spedizione gratuita. Finché non ci sono, la cassa Stripe non si può accendere: serve una tariffa attiva."
    />
  );
}
