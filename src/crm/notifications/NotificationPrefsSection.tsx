import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bell, Save } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AttivaNotifiche } from "./AttivaNotifiche";
import { useNotificationPrefs, DEFAULT_PREFS } from "./usePrefs";

const KIND_LABELS: Record<string, string> = {
  cpl_over_budget: "CPL fuori budget",
  no_lead_24h: "Nessun lead 24h",
  lps_below_threshold: "LPS basso",
  creative_degraded: "Creative in degrado",
};

export function NotificationPrefsSection() {
  const { prefs, save, loading } = useNotificationPrefs();
  const [local, setLocal] = useState(prefs);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(prefs);
  }, [prefs]);

  const toggleMute = (kind: string) => {
    setLocal((p) => ({
      ...p,
      muted_kinds: p.muted_kinds.includes(kind)
        ? p.muted_kinds.filter((k) => k !== kind)
        : [...p.muted_kinds, kind],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(local);
      toast.success("Preferenze notifiche salvate");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-xs text-muted-foreground">Caricamento…</div>;

  return (
    <div className="border-t pt-4 space-y-4">
      <div>
        <Label className="flex items-center gap-1.5">
          <Bell className="h-4 w-4 text-primary" />
          Preferenze notifiche
        </Label>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Silenzia i tipi che non ti interessano e personalizza le soglie degli alert.
        </p>
      </div>

      {/* Il permesso del browser si concede da un clic e da nessun altro posto:
          qui c'è lo stesso riquadro della pagina Notifiche, perché è in
          impostazioni che lo si va a cercare. */}
      <AttivaNotifiche />

      <Link
        to="/CRM/notifiche"
        className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-foreground underline-offset-2 hover:underline"
      >
        Scegli cosa notificare, con quale suono
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>

      <div className="space-y-2">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Alert campagne
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(KIND_LABELS).map(([kind, label]) => {
            const muted = local.muted_kinds.includes(kind);
            return (
              <label
                key={kind}
                className="flex items-center gap-2 p-2 rounded-md border bg-background hover:border-primary/40 cursor-pointer text-sm"
              >
                <Checkbox checked={!muted} onCheckedChange={() => toggleMute(kind)} />
                <span className={`truncate ${muted ? "line-through text-muted-foreground" : ""}`}>
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-[11px]">LPS soglia minima</Label>
          <Input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={local.lps_min_threshold}
            onChange={(e) => setLocal((p) => ({ ...p, lps_min_threshold: Number(e.target.value) }))}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Default 4 (su 10)</p>
        </div>
        <div>
          <Label className="text-[11px]">CPL sopra budget %</Label>
          <Input
            type="number"
            min={0}
            max={500}
            step={5}
            value={local.cpl_over_budget_pct}
            onChange={(e) =>
              setLocal((p) => ({ ...p, cpl_over_budget_pct: Number(e.target.value) }))
            }
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Default 30%</p>
        </div>
        <div>
          <Label className="text-[11px]">No-lead ore</Label>
          <Input
            type="number"
            min={1}
            max={168}
            value={local.no_lead_hours}
            onChange={(e) => setLocal((p) => ({ ...p, no_lead_hours: Number(e.target.value) }))}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Default 24h</p>
        </div>
      </div>

      <div className="space-y-2 p-3 rounded-md bg-muted/30 border">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Email per notifiche critiche</Label>
            <p className="text-[11px] text-muted-foreground">
              Ricevi via mail le notifiche di gravità critica (no-lead 24h, creative degradata).
            </p>
          </div>
          <Switch
            checked={local.email_critical_enabled}
            onCheckedChange={(v) => setLocal((p) => ({ ...p, email_critical_enabled: v }))}
          />
        </div>
        {local.email_critical_enabled && (
          <Input
            type="email"
            placeholder="tu@azienda.it"
            value={local.email_target ?? ""}
            onChange={(e) => setLocal((p) => ({ ...p, email_target: e.target.value || null }))}
          />
        )}
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
        <Save className="h-4 w-4 mr-1" />
        {saving ? "Salvataggio…" : "Salva preferenze notifiche"}
      </Button>
    </div>
  );
}
