import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

/** Schede CRM accessibili. Le voci della sidebar leggono questa lista. */
export const ALL_SCHEMES = [
  "dashboard",
  "nuovi",
  "leads",
  "pipeline",
  "sede",
  "installazioni",
  "installazioni_oggi",
  "consulenti",
  "kpi",
  "performance",
  "ads",
  "agenda",
  "impostazioni",
] as const;
export type SchemeKey = (typeof ALL_SCHEMES)[number];

export const SCHEME_LABEL: Record<SchemeKey, string> = {
  dashboard: "Dashboard",
  nuovi: "Nuovi Lead",
  leads: "Leads",
  pipeline: "Pipeline",
  sede: "Viene in Sede",
  installazioni: "Installazioni",
  installazioni_oggi: "Installazioni Oggi",
  //  La CHIAVE resta `consulenti` — sta scritta in user_settings.scheme_access
  //  di ogni account già configurato, e rinominarla toglierebbe la scheda a
  //  tutti insieme. Cambia solo l'etichetta, che è l'unica cosa che si legge
  //  (routes/CRM.impostazioni.tsx), e dice il nome della sezione nel menu.
  consulenti: "Collaboratori",
  kpi: "KPI",
  performance: "LP Performance",
  ads: "Ads",
  agenda: "Agenda",
  impostazioni: "Impostazioni",
};

/** Permessi che l'admin può assegnare a un consulente. */
export interface ConsultantPermissionsExtra {
  canAcceptLeads: boolean;
}

export const DEFAULT_CONSULTANT_PERMISSIONS: ConsultantPermissionsExtra = {
  canAcceptLeads: true,
};

/** Schede di default per nuovi account: solo dashboard e impostazioni base. */
const DEFAULT_NEW_USER_SCHEMES: SchemeKey[] = ["dashboard"];

interface UserSettingsRow {
  user_id: string;
  is_admin: boolean;
  scheme_access: SchemeKey[];
  display_name: string | null;
  can_accept_leads?: boolean;
  created_at?: string;
}

interface UserSettingsContextValue {
  isAdmin: boolean;
  schemes: SchemeKey[];
  displayName: string | null;
  loading: boolean;
  /** True se l'utente può vedere la scheda. Admin vede tutto. */
  canAccess: (scheme: string) => boolean;
  /** True se l'utente può accettare/rifiutare lead in arrivo. Default: admin sì, altri sì se hanno scheda 'nuovi'. */
  canAcceptLeads: boolean;
  /** Lista di tutti gli utenti del sistema (solo admin). */
  allUsers: UserSettingsRow[];
  refreshUsers: () => Promise<void>;
  updateUser: (
    userId: string,
    patch: Partial<
      Pick<UserSettingsRow, "is_admin" | "scheme_access" | "display_name" | "can_accept_leads">
    >,
  ) => Promise<void>;
}

const Ctx = createContext<UserSettingsContextValue | null>(null);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [row, setRow] = useState<UserSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<UserSettingsRow[]>([]);

  const ensureRow = useCallback(async () => {
    if (!user) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Conta quanti record esistono: il primo utente diventa admin di default.
    const { count } = await supabase
      .from("user_settings")
      .select("user_id", { count: "exact", head: true });
    const isFirstUser = (count ?? 0) === 0;

    const { data: existing } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      setRow(existing as unknown as UserSettingsRow);
      setLoading(false);
      return;
    }

    // Auto-crea il record con permessi base (o admin se primo utente)
    const initial = {
      user_id: user.id,
      is_admin: isFirstUser,
      scheme_access: isFirstUser
        ? (ALL_SCHEMES as readonly SchemeKey[]).slice()
        : DEFAULT_NEW_USER_SCHEMES,
      display_name: user.email ?? null,
    };
    const { data: inserted } = await supabase
      .from("user_settings")
      .insert(initial)
      .select()
      .single();
    setRow((inserted as unknown as UserSettingsRow) ?? initial);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void ensureRow();
  }, [ensureRow]);

  const refreshUsers = useCallback(async () => {
    if (!row?.is_admin) return;
    const { data } = await supabase.from("user_settings").select("*").order("created_at", {
      ascending: false,
    });
    setAllUsers((data as unknown as UserSettingsRow[]) ?? []);
  }, [row?.is_admin]);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  const updateUser: UserSettingsContextValue["updateUser"] = async (userId, patch) => {
    const { error } = await supabase.from("user_settings").update(patch).eq("user_id", userId);
    if (error) throw error;
    if (userId === user?.id) {
      await ensureRow();
    }
    await refreshUsers();
  };

  const value = useMemo<UserSettingsContextValue>(() => {
    const isAdmin = row?.is_admin ?? false;
    const schemes = row?.scheme_access ?? DEFAULT_NEW_USER_SCHEMES;
    // Admin sempre abilitato; per gli altri, di default true a meno che l'admin
    // non abbia disattivato il flag dalla pagina Impostazioni.
    const canAcceptLeads = isAdmin || (row?.can_accept_leads ?? true);
    return {
      isAdmin,
      schemes,
      displayName: row?.display_name ?? null,
      loading,
      canAccess: (scheme: string) =>
        isAdmin ? true : (schemes as string[]).includes(scheme),
      canAcceptLeads,
      allUsers,
      refreshUsers,
      updateUser,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, loading, allUsers]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUserSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUserSettings must be inside UserSettingsProvider");
  return ctx;
}
