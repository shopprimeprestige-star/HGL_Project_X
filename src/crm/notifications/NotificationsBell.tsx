/** ── LA CAMPANELLA ─────────────────────────────────────────────────────────
 *
 *  Prima leggeva solo la tabella `notifications`, cioè i quattro alert sulle
 *  campagne: tutto ciò che il motore produce durante la giornata (appuntamenti,
 *  installazioni, incassi) non compariva, e il numero rosso non contava mai
 *  quello che serve davvero. Adesso l'elenco è uno solo — `useAvvisi` unisce le
 *  due fonti — e ogni riga porta dove deve: alla scheda della trattativa se
 *  l'avviso ne riguarda una, alla pagina giusta negli altri casi.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pannello, VuotoFinestra } from "@/crm/ui/Finestra";
import { useRicerca } from "@/crm/ui";
import { cn } from "@/lib/utils";
import { AttivaNotifiche, useStatoAudio } from "./AttivaNotifiche";
import { usePermesso } from "./permesso";
import { useAvvisi, type Avviso } from "./useAvvisi";

/** Il colore della gravità sta nel pallino, non nello sfondo della riga:
 *  trenta righe con tre fondi diversi erano una coperta patchwork. */
const PUNTO: Record<string, string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

export function quandoBreve(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "ora";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  const g = Math.floor(h / 24);
  return `${g}g fa`;
}

export function NotificationsBell() {
  const { avvisi, nonLette, segnaLetta, segnaTutte } = useAvvisi();
  const { stato } = usePermesso();
  const audio = useStatoAudio();
  const ricerca = useRicerca();
  const navigate = useNavigate();
  const [aperta, setAperta] = useState(false);

  // Il blocco di attivazione occupa spazio: si mostra solo quando c'è davvero
  // qualcosa da sistemare, altrimenti diventa arredamento che si smette di
  // leggere.
  const daSistemare = stato !== "concesso" || audio !== "pronto";

  const apri = (a: Avviso) => {
    void segnaLetta(a);
    setAperta(false);
    // La scheda si apre SOPRA la pagina in cui si è: chi stava guardando
    // l'agenda non la perde.
    if (a.leadId) {
      ricerca.apriLead(a.leadId);
      return;
    }
    if (a.destinazione) void navigate({ to: a.destinazione });
  };

  return (
    <Popover open={aperta} onOpenChange={setAperta}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifiche">
          <Bell className="h-4 w-4" />
          {nonLette > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
              {nonLette > 9 ? "9+" : nonLette}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <Pannello
        align="end"
        className="w-[min(22rem,calc(100vw-1.5rem))] sm:w-[380px]"
        titolo="Notifiche"
        contesto={nonLette > 0 ? `${nonLette} da leggere` : "Tutte lette"}
        azioni={
          nonLette > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => void segnaTutte()}
            >
              <CheckCheck className="h-3 w-3" /> Segna tutte
            </Button>
          ) : undefined
        }
        senzaPadding
      >
        {daSistemare && (
          <div className="border-b border-slate-200 bg-slate-50 p-3">
            <AttivaNotifiche compatto />
          </div>
        )}

        <ScrollArea className="max-h-[min(60vh,420px)]">
          {avvisi.length === 0 ? (
            <div className="p-3">
              <VuotoFinestra testo="Nessuna notifica. Tutto sotto controllo." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 bg-white">
              {avvisi.slice(0, 40).map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => apri(a)}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        a.letta ? "bg-slate-300" : PUNTO[a.gravita],
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "text-[13px] leading-tight",
                            a.letta ? "font-medium text-slate-600" : "font-semibold text-slate-900",
                          )}
                        >
                          {a.titolo}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">
                          {quandoBreve(a.quando)}
                        </span>
                      </span>
                      {a.corpo && (
                        <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
                          {a.corpo}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-slate-400">{a.etichetta}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setAperta(false);
              void navigate({ to: "/CRM/notifiche" });
            }}
            className="flex w-full items-center justify-between text-[11.5px] font-semibold text-slate-700 hover:text-slate-900"
          >
            Storico completo e impostazioni
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Pannello>
    </Popover>
  );
}
