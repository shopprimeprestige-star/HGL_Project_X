import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Video } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "./AuthContext";
import { formatBookingPhrase } from "@/lib/date-format";

/**
 * Ascolta gli UPDATE su public_leads filtrati per consulente assegnato (= utente loggato)
 * e mostra una toast con suono quando `reminder_sent_at` viene impostato dal cron.
 */
type LeadReminderRow = {
  id: string;
  nome: string;
  cognome: string;
  meet_link: string | null;
  data_slot: string | null;
  ora_slot: string | null;
  reminder_sent_at: string | null;
  accepted_by_consultant_id: string | null;
};

function playReminderSound() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.25);
    o.type = "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    o.start();
    o.stop(ctx.currentTime + 0.65);
  } catch {
    // autoplay bloccato
  }
}

export function MeetReminderListener() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`meet-reminders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "public_leads",
          filter: `accepted_by_consultant_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as LeadReminderRow;
          const old = payload.old as Partial<LeadReminderRow>;
          // Trigger solo quando reminder_sent_at passa da null a valorizzato
          if (!row.reminder_sent_at || old.reminder_sent_at) return;
          playReminderSound();
          const when =
            row.data_slot && row.ora_slot
              ? formatBookingPhrase(row.data_slot, row.ora_slot).replace(/^per\s+/, "")
              : "fra 10 minuti";
          toast(`Meet con ${row.nome} ${row.cognome}`, {
            description: `Inizio ${when}. Preparati a entrare.`,
            duration: 30000,
            icon: <Video className="h-4 w-4 text-primary" />,
            action: row.meet_link
              ? {
                  label: "Apri Meet",
                  onClick: () => window.open(row.meet_link!, "_blank", "noopener"),
                }
              : {
                  label: "Vedi lead",
                  onClick: () => navigate({ to: "/CRM/trattative" }),
                },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  return null;
}
