/** Il tipo dell'archivio che `CRM.ecommerce.tsx` crea con `useNegozio()` e passa a tutte le schermate dei prodotti. */
import type { useNegozio } from "@/crm/negozio/useNegozio";

export type Negozio = ReturnType<typeof useNegozio>;
