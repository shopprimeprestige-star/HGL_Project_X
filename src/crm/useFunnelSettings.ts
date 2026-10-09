// Hook unificato per gestire le impostazioni funnel (slot, blocchi, mode).
// Tutte le mutation passano da `update(patch)` che fa upsert + toast + refresh locale.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SlotsMode = "daily" | "weekly";
export type WeeklySlots = Record<string, string[]>; // "0"..."6" → ["09:00","10:00"]

export interface FunnelSettings {
  time_slots: string[];
  slots_mode: SlotsMode;
  weekly_slots: WeeklySlots;
  blocked_weekdays: number[];
  blocked_dates: string[];
  blocked_slots: Record<string, string[]>; // "YYYY-MM-DD" → ["10:00"]
}

function buildDefaultSlots(): string[] {
  const out: string[] = [];
  for (let h = 9; h <= 21; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 21) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  out.push("21:30");
  return Array.from(new Set(out)).sort();
}
export const DEFAULT_SLOTS = buildDefaultSlots();

const DEFAULTS: FunnelSettings = {
  time_slots: DEFAULT_SLOTS,
  slots_mode: "daily",
  weekly_slots: {},
  blocked_weekdays: [0],
  blocked_dates: [],
  blocked_slots: {},
};

export function useFunnelSettings(userId: string) {
  const [settings, setSettings] = useState<FunnelSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("funnel_settings")
        .select("time_slots,slots_mode,weekly_slots,blocked_weekdays,blocked_dates,blocked_slots")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setSettings({
          time_slots: Array.isArray(data.time_slots) && data.time_slots.length > 0 ? data.time_slots : DEFAULT_SLOTS,
          slots_mode: (data.slots_mode === "weekly" ? "weekly" : "daily") as SlotsMode,
          weekly_slots: (data.weekly_slots ?? {}) as WeeklySlots,
          blocked_weekdays: Array.isArray(data.blocked_weekdays) ? data.blocked_weekdays : [0],
          blocked_dates: Array.isArray(data.blocked_dates) ? data.blocked_dates : [],
          blocked_slots: (data.blocked_slots ?? {}) as Record<string, string[]>,
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const update = useCallback(
    async (patch: Partial<FunnelSettings>) => {
      setSaving(true);
      const next = { ...settings, ...patch };
      /*  ── ⚠️ SI SCRIVE LA RIGA INTERA, NON SOLO QUELLO CHE CAMBIA ────────
          `upsert` con le sole modifiche diventa un INSERT quando la riga di
          quel consulente non esiste ancora — ed è il caso della PRIMA volta
          che uno imposta le sue disponibilità. Le colonne `time_slots`,
          `blocked_weekdays`, `blocked_dates`, `blocked_slots` e
          `weekly_slots` sono NOT NULL e senza valore di serie: l'inserimento
          veniva rifiutato dal database e la schermata mostrava l'errore del
          driver, con le disponibilità che non si salvavano.
          Mandando `next` — quello che c'è più quello che cambia — l'inserimento
          è completo e l'aggiornamento resta identico a prima.
          (Trovato rigenerando i tipi: prima la riga passava da un cast e
          nessuno poteva accorgersene.) */
      const { error } = await supabase
        .from("funnel_settings")
        .upsert({ ...next, user_id: userId }, { onConflict: "user_id" });
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return false;
      }
      setSettings(next);
      toast.success("Disponibilità aggiornata");
      return true;
    },
    [settings, userId],
  );

  return { settings, loading, saving, update };
}

/** Restituisce gli slot attivi per un dato giorno (considerando mode + blocchi). */
export function slotsForDate(settings: FunnelSettings, isoDate: string): string[] {
  const d = new Date(isoDate + "T00:00:00");
  const dow = d.getDay();
  if (settings.blocked_weekdays.includes(dow)) return [];
  if (settings.blocked_dates.includes(isoDate)) return [];
  const base = settings.slots_mode === "weekly"
    ? settings.weekly_slots[String(dow)] ?? []
    : settings.time_slots;
  const blockedForDay = settings.blocked_slots[isoDate] ?? [];
  return base.filter((s) => !blockedForDay.includes(s));
}

/** Status per un giorno del calendario. */
export type DayStatus = "full" | "partial" | "blocked" | "empty";
export function dayStatus(settings: FunnelSettings, isoDate: string): DayStatus {
  const d = new Date(isoDate + "T00:00:00");
  const dow = d.getDay();
  if (settings.blocked_weekdays.includes(dow) || settings.blocked_dates.includes(isoDate)) return "blocked";
  const base = settings.slots_mode === "weekly"
    ? settings.weekly_slots[String(dow)] ?? []
    : settings.time_slots;
  if (base.length === 0) return "empty";
  const blocked = (settings.blocked_slots[isoDate] ?? []).length;
  if (blocked === 0) return "full";
  if (blocked >= base.length) return "blocked";
  return "partial";
}
