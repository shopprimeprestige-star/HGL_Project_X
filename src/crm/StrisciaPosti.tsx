/** ── LA STRISCIA DEI POSTI LIBERI ──────────────────────────────────────────
 *
 *  Richiesta del titolare (14/10/2026): la setter ha il telefono in mano e il
 *  cliente chiede «quando?». Una riga sola con i posti dei prossimi 7 giorni
 *  lavorativi; un tocco su un giorno, o su «Tutti gli orari», porta a Slot
 *  liberi, che fa già il 14 e il 30 giorni.
 *
 *  ⚠️ STESSO NUMERO DI SLOT LIBERI, PER COSTRUZIONE. Stesso aggancio
 *   (`useGiorniLiberi`, tutta la squadra), stesse regole (`strisciaPosti` su
 *   `riassumiGiorno`). Si calcolano 14 giorni di calendario e se ne mostrano
 *   al massimo 7 lavorativi: i giorni di chiusura non compaiono. La striscia
 *   non mostra un totale, perché Slot liberi conta giorni di calendario e il
 *   totale sarebbe diverso; il numero di ogni giorno no.
 *  ⚠️ SOLO A CHI HA `agenda` (lo decide chi la monta: vedi crm/vista-oggi).
 *   Senza, le ore tenute per una persona sola non arrivano e i numeri
 *   sarebbero più alti del vero.
 *  ⚠️ UNA RIGA SOLA ANCHE SUL TELEFONO: scorre in orizzontale, non va a capo.
 *   «pieno» è scritto in rosso CON la parola, non solo col colore.
 *  ⚠️ GLI HOOK IN CIMA, il `return null` (squadra vuota) dopo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Fragment, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { strisciaPosti } from "@/crm/slot-liberi";
import { useGiorniLiberi } from "@/crm/useGiorniLiberi";

const TOCCO =
  "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StrisciaPosti(p: { className?: string }) {
  const { squadra, giorni } = useGiorniLiberi({ quanti: 14 });
  const striscia = useMemo(
    () => strisciaPosti(giorni, { max: 7, oggi: giorni[0]?.data }),
    [giorni],
  );
  if (squadra.length === 0) return null;
  return (
    <nav
      aria-label="Posti liberi nei prossimi giorni"
      className={cn("flex items-center overflow-x-auto whitespace-nowrap text-[12px]", p.className)}
    >
      <span className="shrink-0 pr-1.5 font-semibold text-foreground">Posti liberi</span>
      {striscia.length === 0 && (
        <span className="shrink-0 px-1.5 text-muted-foreground">
          nessun giorno di lavoro nelle prossime due settimane
        </span>
      )}
      {striscia.map((g, i) => (
        <Fragment key={g.data}>
          {i > 0 && (
            <span aria-hidden="true" className="shrink-0 text-muted-foreground/60">
              ·
            </span>
          )}
          <Link
            to="/CRM/slot-liberi"
            className={TOCCO}
            aria-label={`${g.etichetta}: ${g.pieno ? "pieno" : `${g.posti} ${g.posti === 1 ? "posto libero" : "posti liberi"}`}`}
          >
            <span className="text-muted-foreground">{g.etichetta}</span>
            <span
              className={
                g.pieno ? "font-medium text-rose-600" : "font-semibold tabular-nums text-foreground"
              }
            >
              {g.pieno ? "pieno" : g.posti}
            </span>
          </Link>
        </Fragment>
      ))}
      <Link to="/CRM/slot-liberi" className={cn(TOCCO, "ml-auto pl-3 font-medium text-primary")}>
        Tutti gli orari
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </nav>
  );
}
