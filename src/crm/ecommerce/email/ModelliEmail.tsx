/** ── LA SCHEDA «EMAIL»: SEGNAPOSTO (ModelliEmail.tsx) ─────────────────────────────────────────
 *  Shop completo R2, T62. Tiene il posto della linguetta «Email»: la sostituisce T66 (modelli, approvazione, interruttore) tenendo
 *  nome e props. Non legge niente e non scrive niente.
 *  Props: `fetch` è la `fetchCRM` della pagina (T66 la usa per `/api/crm/negozio-email?modelli`, permesso `impostazioni`).
 *  `onNegato`: T66 lo chiama se il server rifiuta (403) e la pagina toglie la linguetta, perché il permesso lo decide il server. */
import { Mail } from "lucide-react";
import { Vuoto } from "@/crm/ui";
import type { FetchRotta } from "@/crm/ecommerce/pagina-r2";

export function ModelliEmail(_props: { fetch: FetchRotta; onNegato?: () => void }) {
  return (
    <Vuoto
      icona={Mail}
      titolo="I testi delle email arrivano con il prossimo aggiornamento"
      testo="Qui si leggeranno e si approveranno le email ai clienti (conferma d'ordine e le altre)."
    />
  );
}
