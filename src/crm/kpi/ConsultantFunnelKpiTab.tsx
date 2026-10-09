// Tab "Funnel KPI" all'interno del dialog KPI consulente.
// Mostra Portatore / Pain / Urgenza filtrati sui SOLI lead assegnati al consulente.
// Niente CPL: il consulente non ha visibilità sulla spesa ads.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  aggregatePain,
  aggregatePortatore,
  aggregateUrgenza,
  buildCrmConvertedIndex,
  periodSinceUntil,
  type Period,
  type PublicLeadLite,
  type SegmentRow,
} from "./cvr-generale-utils";
import { useCRM } from "@/crm/CRMContext";
import { leadIsConverted } from "@/crm/lead-analytics";

const PERIODS: Period[] = [7, 14, 30, 90];

interface Props {
  consultantId: string;
}

export function ConsultantFunnelKpiTab({ consultantId }: Props) {
  const { leads: crmLeads } = useCRM();
  const [period, setPeriod] = useState<Period>(30);
  const [pubLeads, setPubLeads] = useState<PublicLeadLite[]>([]);
  const [loading, setLoading] = useState(true);

  const { since, until } = useMemo(() => periodSinceUntil(period), [period]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("public_leads")
      .select("id, created_at, status, email, telefono, portatore, disagio_score, urgenza, accepted_by_consultant_id, utm_source, fbclid, ttclid")
      .eq("accepted_by_consultant_id", consultantId)
      .gte("created_at", since.toISOString())
      .lte("created_at", until.toISOString())
      .limit(5000)
      .then(({ data }) => {
        if (!alive) return;
        setPubLeads((data ?? []) as PublicLeadLite[]);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [consultantId, since, until]);

  // Index conversioni CRM: solo lead di questo consulente
  const crmIndex = useMemo(
    () =>
      buildCrmConvertedIndex(
        crmLeads
          .filter((l) => l.data.consulenteId === consultantId)
          .map((l) => ({
            email: l.data.email ?? null,
            telefono: l.data.telefono ?? null,
            converted: leadIsConverted(l),
          })),
      ),
    [crmLeads, consultantId],
  );

  const stats = useMemo(() => {
    return {
      portatore: aggregatePortatore({ leads: pubLeads, crmIndex, totalSpend: 0 }),
      pain: aggregatePain({ leads: pubLeads, crmIndex, totalSpend: 0 }),
      urgenza: aggregateUrgenza({ leads: pubLeads, crmIndex, totalSpend: 0 }),
    };
  }, [pubLeads, crmIndex]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-semibold uppercase">Periodo</span>
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`h-7 px-2.5 text-[11.5px] font-medium border rounded-md transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white border-border hover:bg-secondary"
            }`}
          >
            {p}g
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {loading ? "Caricamento…" : `${pubLeads.length} lead nel periodo`}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
        </div>
      ) : pubLeads.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Nessun lead pubblico assegnato al consulente nel periodo selezionato.
        </p>
      ) : (
        <>
          <Block title="Portatore vs Non portatore" rows={stats.portatore} />
          <Block title="Lead Pain Score per fascia" rows={stats.pain} />
          <Block title="Urgenza (quando vuole partire)" rows={stats.urgenza} />
        </>
      )}
    </div>
  );
}

function Block({ title, rows }: { title: string; rows: SegmentRow[] }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="font-semibold text-xs mb-2">{title}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1.5">Risposta</th>
                <th className="text-right">Lead</th>
                <th className="text-right">Convertiti</th>
                <th className="text-right">CVR %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-1.5 font-medium">{r.label}</td>
                  <td className="text-right tabular-nums">{r.leads}</td>
                  <td className="text-right tabular-nums">{r.converted}</td>
                  <td className="text-right tabular-nums font-semibold">
                    {r.leads > 0 ? `${r.cvrPct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
