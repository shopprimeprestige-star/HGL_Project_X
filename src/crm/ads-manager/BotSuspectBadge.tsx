import { useState } from "react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { NotaFinestra, Pannello, VuotoFinestra } from "@/crm/ui/Finestra";
import { Loader2 } from "lucide-react";

interface BotSession {
  session_id: string;
  created_at: string;
  device: string | null;
  ip_hash: string | null;
}

/** Badge "Bot suspect" con popover che, al click, carica le ultime 3 sessioni
 *  bot per quell'ad_id da lp_events. RLS: solo admin autenticati possono leggere. */
export function BotSuspectBadge({
  adId,
  bots,
  totalSessions,
  botRate,
  sinceISO,
  untilISO,
}: {
  adId: string;
  bots: number;
  totalSessions: number;
  botRate: number;
  sinceISO: string;
  untilISO: string;
}) {
  const [data, setData] = useState<BotSession[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadDetails = async () => {
    if (data || loading) return;
    setLoading(true);
    setErr(null);
    try {
      // Prendi gli eventi più recenti dei bot, poi raggruppa per session_id
      // (una sessione può avere più eventi). Limit 30 eventi → max 3 sessioni distinte.
      const { data: rows, error } = await supabase
        .from("lp_events")
        .select("session_id, created_at, device, ip_hash")
        .eq("ad_id", adId)
        .eq("is_bot", true)
        .gte("created_at", sinceISO)
        .lte("created_at", untilISO)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const seen = new Set<string>();
      const unique: BotSession[] = [];
      for (const r of rows ?? []) {
        if (seen.has(r.session_id)) continue;
        seen.add(r.session_id);
        unique.push(r as BotSession);
        if (unique.length >= 3) break;
      }
      setData(unique);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover onOpenChange={(o) => { if (o) void loadDetails(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-destructive/15 text-destructive border border-destructive/40 hover:bg-destructive/20 cursor-pointer"
        >
          🤖 Bot suspect {botRate.toFixed(0)}%
        </button>
      </PopoverTrigger>
      <Pannello
        side="top"
        align="start"
        className="w-80"
        titolo="Traffico bot sospetto"
        contesto={`${bots} sessioni bot su ${totalSessions} (${botRate.toFixed(1)}%)`}
        onClick={(e) => e.stopPropagation()}
        classeCorpo="p-3 space-y-2"
      >
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
          Ultime 3 sessioni bot
        </div>
        {loading && (
          <div className="flex items-center gap-2 py-2 text-[11.5px] text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Caricamento…
          </div>
        )}
        {err && <div className="text-[11.5px] text-rose-700">Errore: {err}</div>}
        {data && data.length === 0 && (
          <VuotoFinestra testo="Nessun evento bot trovato nel periodo." />
        )}
        {data && data.length > 0 && (
          <ul className="space-y-1.5">
            {data.map((s) => (
              <li
                key={s.session_id}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
              >
                <div className="text-[10.5px] tabular-nums text-slate-500">
                  {new Date(s.created_at).toLocaleString("it-IT", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {s.device || "device?"}
                  </span>
                  <span className="truncate font-mono text-[10px] text-slate-500">
                    {s.ip_hash ? `ip:${s.ip_hash.slice(0, 12)}…` : "ip?"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <NotaFinestra tono="attenzione">
          Sopra il 30% di bot il targeting è probabilmente troppo ampio, o la piattaforma filtra
          poco.
        </NotaFinestra>
      </Pannello>
    </Popover>
  );
}
