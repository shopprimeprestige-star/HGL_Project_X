/** ── FasciaFiducia · VETRINA V1 · T91 ─────────────────────────────────────────
 *  La fascia di fiducia della home: studio, spedizione, reso, consulenza, a pillole (documento §4.2.5: sull'hero blueprint sono quelle scure).
 *  Il disegno e la regola «meno di due voci = non si monta» sono di `BloccoFiducia` (T85, `montaFascia` di T76): qui non c'è nessuna frase.
 *  `vociDellaFascia` dà le voci VERE della home partendo dal contenuto dello shop: un testo svuotato nel CRM resta svuoto (V1-T16),
 *  mai il testo di partenza (`vociFiducia` tratta `null` come «non scritto», perciò si passa `""`). */
import { BloccoFiducia } from "@/components/shop/BloccoFiducia";
import type { SpedizionePubblica } from "@/shop/cassa/spedizione";
import { confermatiDa, testiDi } from "@/shop/cms/vetrina-contenuto";
import { vociFiducia, type VoceFiducia } from "@/shop/cms/vetrina-fiducia";

export function vociDellaFascia(contenuto?: unknown, tariffa?: SpedizionePubblica | null): VoceFiducia[] {
  const t = testiDi(contenuto);
  return vociFiducia({
    tariffa,
    testi: confermatiDa(contenuto),
    fascia: { studio: t["shop.fascia.studio"] ?? "", consulenza: t["shop.fascia.consulenza"] ?? "" },
  });
}

export function FasciaFiducia({
  voci,
  scuro = true,
  className = "",
}: {
  voci?: readonly VoceFiducia[];
  /** Sul blueprint (di norma) le pillole sono scure; `false` sui fondi chiari. */
  scuro?: boolean;
  className?: string;
}) {
  return <BloccoFiducia voci={voci ?? []} tipo="fascia" scuro={scuro} className={className} />;
}
