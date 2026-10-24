/** ── LA PASTIGLIA DEL CONTATTO, ATTACCATA A UNA SCHEDA VERA ─────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 6. È `PastigliaContatto`
 *  con il nome del cliente e l'aggiornamento in memoria dell'elenco: quando il
 *  server ha scritto il cambio, la scheda nel CRM si aggiorna da sola e i
 *  filtri la vedono subito (`aggiornaContattoLocale`: non scrive niente).
 *  Le righe delle liste usano questa; il disegno e le regole sono nel componente
 *  di sotto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCRM } from "@/crm/CRMContext";
import type { ContattoWa, LeadData } from "../types";
import { PastigliaContatto } from "./PastigliaContatto";

export function PastigliaContattoLead({
  lead,
  compatta = true,
  adesso,
  className,
}: {
  lead: { id: string; data: Partial<LeadData> };
  compatta?: boolean;
  adesso?: Date;
  className?: string;
}) {
  const { aggiornaContattoLocale } = useCRM();
  return (
    <PastigliaContatto
      compatta={compatta}
      dati={lead.data}
      leadId={lead.id}
      contesto={`${lead.data.nome ?? ""} ${lead.data.cognome ?? ""}`.trim() || undefined}
      adesso={adesso}
      onCambiato={(c: ContattoWa) => aggiornaContattoLocale(lead.id, c)}
      className={className}
    />
  );
}
