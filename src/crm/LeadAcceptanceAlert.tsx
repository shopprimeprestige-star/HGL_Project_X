import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Check, X, Clock as ClockIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "./AuthContext";
import { useUserSettings } from "./UserSettingsContext";
import { Button } from "@/components/ui/button";
import { formatBookingPhrase } from "@/lib/date-format";

/**
 * Sistema di notifiche realtime + accettazione lead "race".
 *
 * - Tutti i consulenti loggati ricevono una notifica all'arrivo di un nuovo lead.
 * - Il primo che clicca "Accetta" si prende il lead (UPDATE atomico con WHERE accepted_at IS NULL).
 * - Gli altri vedono il lead come "preso da X" alla refresh successiva.
 * - L'admin può sempre assegnare manualmente, e può revocare il permesso ai consulenti.
 *
 * NB: i permessi sono salvati in user_settings come array `scheme_access` + flag `is_admin`.
 * Il flag `canAcceptLeads` è gestito tramite la pagina Impostazioni utente.
 */

type AcceptableLead = {
  id: string;
  nome: string;
  cognome: string;
  citta: string;
  telefono: string;
  data_slot: string | null;
  ora_slot: string | null;
};

export function LeadAcceptanceAlert() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, canAcceptLeads } = useUserSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeLead, setActiveLead] = useState<AcceptableLead | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Solo admin con permesso o consulenti con canAcceptLeads possono accettare
  const canAccept = isAdmin || canAcceptLeads;

  useEffect(() => {
    const playSound = () => {
      try {
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = 880;
        o.type = "sine";
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        o.start();
        o.stop(ctx.currentTime + 0.45);
      } catch {
        // browser silenzia autoplay
      }
    };

    const channel = supabase
      .channel("lead-acceptance-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "public_leads" },
        (payload) => {
          const row = payload.new as AcceptableLead & { accepted_at?: string | null };
          if (row.accepted_at) return;
          playSound();
          if (canAccept) {
            // Mostra dialog accept/reject in-app
            setActiveLead(row);
          } else {
            // Notifica passiva
            toast(`Nuovo lead: ${row.nome} ${row.cognome}`, {
              description: `${row.citta} · ${row.telefono}`,
              duration: 12000,
              icon: <Bell className="h-4 w-4 text-amber-500" />,
              action: {
                label: "Vedi",
                onClick: () => navigate({ to: "/CRM/nuovi-contatti" }),
              },
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canAccept, navigate]);

  const accept = async () => {
    if (!activeLead || !user) return;
    setAccepting(true);
    // UPDATE atomico: solo se nessuno l'ha ancora preso
    const { data, error } = await supabase
      .from("public_leads")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by_consultant_id: user.id,
      })
      .eq("id", activeLead.id)
      .is("accepted_at", null)
      .select("id");
    setAccepting(false);
    if (error) {
      toast.error("Errore: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.warning("Lead già preso da un altro consulente");
      setActiveLead(null);
      return;
    }
    toast.success("Lead preso in carico");
    setActiveLead(null);
    navigate({ to: "/CRM/nuovi-contatti" });
  };

  const reject = () => {
    setActiveLead(null);
    toast("Lead lasciato agli altri consulenti", { duration: 3000 });
  };

  return (
    <>
      <audio ref={audioRef} preload="auto" />
      {activeLead && (
        <div className="fixed bottom-6 right-6 z-[100] w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border bg-card text-card-foreground shadow-2xl ring-1 ring-brand/30 animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-brand/15 text-brand flex items-center justify-center flex-shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[0.65rem] uppercase tracking-wider font-bold text-brand">
                  Nuovo lead in arrivo
                </div>
                <div className="font-bold text-base mt-0.5 truncate">
                  {activeLead.nome} {activeLead.cognome}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {activeLead.citta} · {activeLead.telefono}
                </div>
                {activeLead.data_slot && activeLead.ora_slot && (
                  <div className="text-xs mt-1.5 flex items-center gap-1.5 font-medium">
                    <ClockIcon className="h-3 w-3" />
                    <span className="capitalize">
                      {formatBookingPhrase(activeLead.data_slot, activeLead.ora_slot).replace(
                        /^per\s+/,
                        "",
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={reject}
                className="flex-1"
                disabled={accepting}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Rifiuta
              </Button>
              <Button size="sm" onClick={accept} disabled={accepting} className="flex-1">
                <Check className="h-3.5 w-3.5 mr-1" />
                {accepting ? "..." : "Accetta"}
              </Button>
            </div>
            <p className="text-[0.65rem] text-center text-muted-foreground">
              Il primo consulente che accetta prende il lead.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
