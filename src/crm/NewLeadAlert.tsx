import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Ascolta in realtime l'arrivo di nuovi lead pubblici dalla landing
 * e mostra un toast + suono. Da montare una sola volta nel layout CRM.
 */
export function NewLeadAlert() {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Suono semplice generato via WebAudio (no asset)
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
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        o.start();
        o.stop(ctx.currentTime + 0.45);
        // secondo bip
        setTimeout(() => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.frequency.value = 1320;
          o2.type = "sine";
          g2.gain.setValueAtTime(0.0001, ctx.currentTime);
          g2.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
          g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
          o2.start();
          o2.stop(ctx.currentTime + 0.45);
        }, 200);
      } catch {
        // browser blocca autoplay finché non c'è interazione: silenzio
      }
    };

    const channel = supabase
      .channel("new-public-leads")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "public_leads",
        },
        (payload) => {
          const row = payload.new as {
            nome?: string;
            cognome?: string;
            citta?: string;
            telefono?: string;
          };
          playSound();
          toast(
            `🔔 Nuovo lead: ${row.nome ?? ""} ${row.cognome ?? ""}`.trim(),
            {
              description: `${row.citta ?? ""} · ${row.telefono ?? ""}`,
              duration: 15000,
              action: {
                label: "Vedi",
                onClick: () => navigate({ to: "/CRM/nuovi-contatti" }),
              },
              icon: <Bell className="h-4 w-4 text-amber-500" />,
            },
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [navigate]);

  return <audio ref={audioRef} preload="auto" />;
}
