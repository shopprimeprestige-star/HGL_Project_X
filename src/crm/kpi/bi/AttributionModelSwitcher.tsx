import { useMemo, useState } from "react";
import { applyAttributionModel, ATTRIBUTION_LABEL, CHANNEL_LABEL, CHANNELS, type AttributionModel, type JourneyLead } from "../journey/journey-utils";

const MODELS: AttributionModel[] = ["first_touch", "last_touch", "linear", "time_decay", "position_based"];

export function AttributionModelSwitcher({ leads }: { leads: JourneyLead[] }) {
  const [active, setActive] = useState<AttributionModel>("last_touch");
  const allResults = useMemo(() => {
    const out = {} as Record<AttributionModel, ReturnType<typeof applyAttributionModel>>;
    MODELS.forEach((m) => {
      out[m] = applyAttributionModel(leads, m);
    });
    return out;
  }, [leads]);

  const current = allResults[active];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Attribution Comparison Tool</h3>
      <div className="flex flex-wrap gap-1">
        {MODELS.map((m) => (
          <button
            key={m}
            onClick={() => setActive(m)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${active === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}
          >
            {ATTRIBUTION_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Canale</th>
              {MODELS.map((m) => (
                <th key={m} className={`text-right px-3 py-2 font-medium ${active === m ? "text-foreground" : ""}`}>
                  {m === "first_touch" ? "First" : m === "last_touch" ? "Last" : m === "linear" ? "Linear" : m === "time_decay" ? "Decay" : "Position"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CHANNELS.filter((c) => current[c].revenue > 0 || MODELS.some((m) => allResults[m][c].revenue > 0)).map((c) => (
              <tr key={c} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{CHANNEL_LABEL[c]}</td>
                {MODELS.map((m) => (
                  <td key={m} className={`text-right px-3 py-2 tabular-nums ${active === m ? "font-semibold bg-primary/5" : ""}`}>
                    €{allResults[m][c].revenue.toFixed(0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Cambiare modello mostra come il revenue si redistribuisce tra canali. Il modello più equo per multi-touch è Linear o Time-Decay.
      </p>
    </div>
  );
}
