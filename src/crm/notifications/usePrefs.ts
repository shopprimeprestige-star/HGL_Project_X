import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../AuthContext";

export interface NotificationPrefs {
  muted_kinds: string[];
  lps_min_threshold: number;
  cpl_over_budget_pct: number;
  no_lead_hours: number;
  email_target: string | null;
  email_critical_enabled: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  muted_kinds: [],
  lps_min_threshold: 4,
  cpl_over_budget_pct: 30,
  no_lead_hours: 24,
  email_target: null,
  email_critical_enabled: false,
};

export function useNotificationPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notification_prefs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setPrefs({
        muted_kinds: data.muted_kinds || [],
        lps_min_threshold: Number(data.lps_min_threshold) || 4,
        cpl_over_budget_pct: Number(data.cpl_over_budget_pct) || 30,
        no_lead_hours: Number(data.no_lead_hours) || 24,
        email_target: data.email_target,
        email_critical_enabled: !!data.email_critical_enabled,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (next: NotificationPrefs) => {
      if (!user) return;
      const { error } = await supabase
        .from("notification_prefs")
        .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
      if (error) throw error;
      setPrefs(next);
    },
    [user],
  );

  return { prefs, setPrefs, save, loading, reload: load };
}

/** Versione async standalone, per gli edge runner. */
export async function fetchPrefs(userId: string): Promise<NotificationPrefs> {
  const { data } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT_PREFS;
  return {
    muted_kinds: data.muted_kinds || [],
    lps_min_threshold: Number(data.lps_min_threshold) || 4,
    cpl_over_budget_pct: Number(data.cpl_over_budget_pct) || 30,
    no_lead_hours: Number(data.no_lead_hours) || 24,
    email_target: data.email_target,
    email_critical_enabled: !!data.email_critical_enabled,
  };
}
