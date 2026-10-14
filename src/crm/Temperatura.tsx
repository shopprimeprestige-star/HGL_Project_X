/** ── IL PALLINO DELLA TEMPERATURA ──────────────────────────────────────────
 *
 *  Richiesta del titolare (14/10/2026): com'è messo il cliente si legge dalla
 *  riga, in «Oggi», in Lead importati e nella scheda. La regola è una sola
 *  (crm/temperatura-lead); qui c'è solo il disegno.
 *
 *  ⚠️ IL COLORE AIUTA, LA PAROLA RESTA. Chi non distingue i colori legge
 *   «Caldo»: il pallino è `aria-hidden`, la parola è sempre scritta. Quando lo
 *   spazio è una riga sola (la fascia POI) resta solo il pallino, e la parola
 *   va nel suggerimento e nel testo per il lettore di schermo.
 *  ⚠️ «NESSUNA» NON SI SCRIVE. Venti righe con «nessuna risposta» sono rumore:
 *   senza risposte di temperatura il componente non disegna niente.
 *  ⚠️ `moduloLetto` legge anche le note: in «Oggi» la riga si ridisegna a ogni
 *   scatto dell'orologio, quindi la temperatura si calcola in `useMemo` sui
 *   dati del lead, una volta per versione della scheda. L'hook sta in prima
 *   riga e il `return null` dopo (React #310, già successo in produzione).
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  temperaturaDi,
  type LivelloTemperatura,
  type TemperaturaLead,
} from "@/crm/temperatura-lead";
import type { LeadData } from "@/crm/types";

/** Rosso-arancio, ambra, grigio-azzurro: i tre colori della SPEC, niente altro.
 *  I testi 700/600 stanno sopra 4,5:1 sul fondo chiaro del CRM. */
const STILE: Record<Exclude<LivelloTemperatura, "nessuna">, { pallino: string; testo: string }> = {
  caldo: { pallino: "bg-orange-600", testo: "text-orange-700" },
  medio: { pallino: "bg-amber-500", testo: "text-amber-700" },
  freddo: { pallino: "bg-slate-400", testo: "text-slate-600" },
};

/** Solo disegno, nessun hook. `null` quando il livello è «nessuna». */
export function PallinoTemperatura(p: {
  t: TemperaturaLead;
  soloPallino?: boolean;
  className?: string;
}) {
  const { t } = p;
  if (t.livello === "nessuna") return null;
  const stile = STILE[t.livello];
  //  In linea col testo (non flex): così gli spazi e i « · » della riga restano
  //  testo vero, e la riga si taglia con i puntini come le altre.
  const pallino = (
    <span
      aria-hidden="true"
      className={cn("inline-block h-2 w-2 rounded-full align-middle", stile.pallino)}
    />
  );
  if (p.soloPallino)
    return (
      <span className={p.className} title={t.perche ? `${t.parola} · ${t.perche}` : t.parola}>
        {pallino}
        <span className="sr-only">{t.parola}</span>
      </span>
    );
  return (
    <span className={cn("font-medium", stile.testo, p.className)}>
      {pallino}
      <span className="ml-1">{t.parola}</span>
    </span>
  );
}

/** Per le righe: pallino + parola + al massimo `max` risposte brevi, separate
 *  da « · ». Niente quando il lead non ha detto niente sulla temperatura. */
export function TemperaturaRiga(p: {
  dati: Partial<LeadData>;
  max?: number;
  soloPallino?: boolean;
  className?: string;
}) {
  const max = p.max ?? 2;
  const { t, brevi } = useMemo(() => temperaturaDi(p.dati, max), [p.dati, max]);
  if (t.livello === "nessuna") return null;
  if (p.soloPallino) return <PallinoTemperatura t={t} soloPallino className={p.className} />;
  return (
    <span className={p.className}>
      <PallinoTemperatura t={t} />
      {brevi.map((b) => (
        <span key={b}>
          {" · "}
          {b}
        </span>
      ))}
    </span>
  );
}
