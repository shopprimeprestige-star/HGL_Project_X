/** ── GrigliaCard · VETRINA V1 · T85 ───────────────────────────────────────────
 *  Le card in griglia: 2 colonne sul telefono, 3 dal tablet, e `colonne` (2, 3 o 4) dal computer. Decide la pagina quante: la vetrina della
 *  home usa `colonneVetrina` di T76 (4 prodotti = 4 colonne, 5-6 = 3), la categoria 3 (4 sopra i 1536 px, con `className`).
 *  Senza card non disegna niente (la pagina mostra il suo stato vuoto). Solo la prima foto può essere `prima` (D98). */
import { CardProdotto, type PropsCard } from "@/components/shop/CardProdotto";
import type { CardLeggera } from "@/shop/cms/vetrina-card";

const COLONNE = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
} as const;

export function GrigliaCard({
  card,
  colonne = 3,
  testi,
  prima = false,
  livello,
  className = "",
}: {
  card: readonly CardLeggera[];
  colonne?: keyof typeof COLONNE;
  /** Per il badge «Pronta consegna» (D86). */
  testi?: PropsCard["testi"];
  /** La prima foto della griglia è sopra la piega: `eager` + priorità alta. */
  prima?: boolean;
  livello?: PropsCard["livello"];
  className?: string;
}) {
  if (!Array.isArray(card) || card.length === 0) return null;
  return (
    <ul
      role="list"
      className={`grid gap-3 sm:gap-4 ${COLONNE[colonne] ?? COLONNE[3]} ${className}`.trim()}
    >
      {card.map((c, i) => (
        <li key={c.slug} className="min-w-0">
          <CardProdotto card={c} testi={testi} prima={prima && i === 0} livello={livello} />
        </li>
      ))}
    </ul>
  );
}
