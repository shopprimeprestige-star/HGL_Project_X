/** ── BloccoFiducia · VETRINA V1 · T85 ─────────────────────────────────────────
 *  Le voci di fiducia VERE (`vociFiducia`, D87) disegnate in due modi:
 *   · `blocco` (di norma): la riga sotto il bottone di scheda e carrello: spedizione, reso, pagamenti, WhatsApp. Zero voci = non si monta.
 *   · `fascia`: la fascia di home e categoria: studio, spedizione, reso, consulenza, a pillole. Meno di due voci = non si monta.
 *  Quali voci e se si monta lo decidono `montaBlocco` e `montaFascia` (T76); qui nessuna frase: il testo è quello della voce.
 *  `scuro`: sul fondo blueprint (hero, fascia della categoria) le pillole sono quelle chiare del documento (§4.2.5). */
import { CreditCard, MessageCircle, RotateCcw, Truck, type LucideIcon } from "lucide-react";
import {
  montaBlocco,
  montaFascia,
  type IdVoceFiducia,
  type VoceFiducia,
} from "@/shop/cms/vetrina-fiducia";

const ICONE: Partial<Record<IdVoceFiducia, LucideIcon>> = {
  spedizione: Truck,
  reso: RotateCcw,
  pagamenti: CreditCard,
  whatsapp: MessageCircle,
};

export function BloccoFiducia({
  voci,
  tipo = "blocco",
  scuro = false,
  className = "",
}: {
  voci: readonly VoceFiducia[];
  tipo?: "blocco" | "fascia";
  scuro?: boolean;
  className?: string;
}) {
  const scelte = tipo === "fascia" ? montaFascia(voci) : montaBlocco(voci);
  if (!scelte) return null;

  if (tipo === "fascia") {
    const pillola = scuro
      ? "border-white/20 bg-white/5 text-white"
      : "border-ink/15 bg-white text-[#0A1430]";
    return (
      <ul role="list" className={`flex flex-wrap gap-2 ${className}`}>
        {scelte.map((v) => (
          <li key={v.id} className={`rounded-full border px-3 py-1.5 text-sm ${pillola}`}>
            {v.testo}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      role="list"
      className={`flex flex-col gap-2 text-sm ${scuro ? "text-white/80" : "text-ink-muted"} ${className}`}
    >
      {scelte.map((v) => {
        const Icona = ICONE[v.id];
        return (
          <li key={v.id} className="flex items-start gap-2">
            {Icona && <Icona aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{v.testo}</span>
          </li>
        );
      })}
    </ul>
  );
}
