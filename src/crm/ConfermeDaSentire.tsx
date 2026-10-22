/** ── «DA SENTIRE»: CHI NON HA CONFERMATO LA CONSULENZA ──────────────────────
 *
 *  Commessa 2026-10-22. Dopo la prenotazione parte un WhatsApp «risponda SÌ
 *  per confermare». Qui, in cima a «Oggi», le consulenze delle prossime 48
 *  ore il cui cliente non ha confermato, dalla più vicina, con il perché in
 *  una frase, il tasto Chiama e il tasto «Confermato a voce».
 *  Le regole (chi c'è, in che ordine, che frase) sono in crm/promemoria e
 *  sono provate; qui si disegnano.
 *
 *  ⚠️ NESSUNA SCATOLA VUOTA: senza nessuno da sentire la striscia non c'è.
 *  ⚠️ IL TESTO DEL CLIENTE («ha risposto: …») È TESTO SEMPLICE, mai HTML.
 *  ⚠️ COLORE E PAROLA INSIEME: la targhetta dice CONFERMATO / NON HA
 *   CONFERMATO per esteso; il colore aiuta, non basta.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Phone, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLASSE_BADGE_STATO } from "@/crm/ui";
import type { Lead, LeadData } from "@/crm/types";
import { daSentire, linkChiamata, quandoDetto, statoConferma } from "@/crm/promemoria/conferma";

export function ConfermeDaSentire({
  leads,
  onConfermaAVoce,
  className,
}: {
  leads: Lead[];
  /** «Confermato a voce»; senza, il tasto non c'è */
  onConfermaAVoce?: (l: Lead) => void;
  className?: string;
}) {
  const adesso = new Date();
  const righe = daSentire(leads, adesso);
  if (righe.length === 0) return null;
  return (
    <section
      aria-labelledby="da-sentire-titolo"
      className={cn("rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2.5", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h2
          id="da-sentire-titolo"
          className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-wide text-amber-900"
        >
          Da sentire · {righe.length}
        </h2>
        <span className="text-[11.5px] text-muted-foreground">
          consulenze delle prossime 48 ore senza conferma su WhatsApp
        </span>
      </div>
      <ul className="mt-1.5 divide-y divide-amber-200/70">
        {righe.map((l) => {
          const s = statoConferma(l.data, adesso);
          const nome = `${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim() || "Senza nome";
          const tel = linkChiamata(l.data.telefono);
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
              <span className="w-[9.5rem] shrink-0 text-[12.5px] font-medium tabular-nums text-foreground">
                {quandoDetto(l.data, adesso)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{nome}</span>
                <span className="block text-[12px] text-muted-foreground">
                  {s.tipo === "nonConfermato" ? s.nota : ""}
                </span>
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {tel && (
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <a href={tel} aria-label={`Chiama ${nome}`}>
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      Chiama
                    </a>
                  </Button>
                )}
                {onConfermaAVoce && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    aria-label={`Segna confermato a voce: ${nome}`}
                    onClick={() => onConfermaAVoce(l)}
                  >
                    <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                    Confermato a voce
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** La targhetta sulla riga della consulenza in «La giornata». Niente se non
 *  c'è mai stato un messaggio automatico (appuntamenti di prima, funzione
 *  spenta). */
export function TargaConferma({ dati, className }: { dati: LeadData; className?: string }) {
  const s = statoConferma(dati, new Date());
  if (s.tipo === "nessuno") return null;
  if (s.tipo === "inviato")
    return (
      <span className={cn("shrink-0 text-muted-foreground", className)}>
        messaggio inviato, attende risposta
      </span>
    );
  if (s.tipo === "confermato")
    return (
      <span
        className={cn(
          CLASSE_BADGE_STATO,
          "shrink-0 border-emerald-300 bg-emerald-50 font-semibold text-emerald-800",
          className,
        )}
      >
        CONFERMATO
        <span className="font-normal">{s.via === "voce" ? "a voce" : "WhatsApp"}</span>
      </span>
    );
  return (
    <span
      title={s.nota}
      className={cn(
        CLASSE_BADGE_STATO,
        "shrink-0 border-amber-300 bg-amber-50 font-semibold text-amber-800",
        className,
      )}
    >
      NON HA CONFERMATO
    </span>
  );
}
