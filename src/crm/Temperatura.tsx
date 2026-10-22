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

/** Dal rosso al blu, in sei passi; i tre di sempre restano uguali.
 *  ⚠️ MEDIO NON È AMBRA (capo progetto, 14/10, nota del revisore): nel CRM
 *   l'ambra vuol dire «in sospeso» e il Chip di stato ha già un pallino ambra.
 *   Pallino arancio chiaro, parola in grigio scuro (lo dice anche DESIGN.md).
 *  Caldissimo, Fuochino e Freddissimo (modulo «589€», 20/10/2026) si
 *  aggiungono ai lati e in mezzo senza cambiare i tre di prima.
 *  I testi 700/600 stanno sopra 4,5:1 sul fondo chiaro del CRM. */
const STILE: Record<Exclude<LivelloTemperatura, "nessuna">, { pallino: string; testo: string }> = {
  //  Il modulo «22-ott» (22/10/2026): Bollente rosso pieno, Tiepido giallo
  //  scuro (non ambra: l'ambra è «in sospeso»), Gelido grigio chiaro.
  bollente: { pallino: "bg-red-600", testo: "text-red-700" },
  tiepido: { pallino: "bg-yellow-400", testo: "text-yellow-800" },
  gelido: { pallino: "bg-slate-300", testo: "text-slate-500" },
  trapianto: { pallino: "bg-violet-400", testo: "text-violet-700" },
  caldissimo: { pallino: "bg-red-600", testo: "text-red-700" },
  caldo: { pallino: "bg-orange-600", testo: "text-orange-700" },
  fuochino: { pallino: "bg-orange-400", testo: "text-orange-800" },
  medio: { pallino: "bg-orange-300", testo: "text-slate-700" },
  freddo: { pallino: "bg-slate-400", testo: "text-slate-600" },
  freddissimo: { pallino: "bg-sky-600", testo: "text-sky-800" },
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
    //  Il testo intero al passaggio del mouse: sul monitor la riga si accorcia
    //  e la seconda risposta breve resta tagliata (revisione finale).
    //  ⚠️ PALLINO E PAROLA NON SI TAGLIANO MAI. Sul monitor la riga di «Oggi»
    //   accorcia per prima la temperatura (`shrink-[100] truncate`), e con il
    //   testo tutto in una riga cadeva proprio la parola: restava «Cal…», e sul
    //   computer il livello non si leggeva (sul telefono andava a capo e si
    //   vedeva). Segnalazione del titolare, 20/10/2026. Adesso si accorciano
    //   solo le risposte brevi.
    <span
      //  ⚠️ NIENTE `min-w-0` QUI: il minimo del contenitore deve restare pallino +
      //   parola (le risposte brevi hanno `min-w-0` e possono sparire). Con
      //   `min-w-0` la riga di «Oggi» lo schiacciava a zero (revisione 20/10).
      className={cn("inline-flex max-w-full items-baseline", p.className)}
      title={[t.parola, ...brevi].join(" · ")}
    >
      <PallinoTemperatura t={t} className="shrink-0 whitespace-nowrap" />
      {brevi.length > 0 && <span className="min-w-0 truncate">{` · ${brevi.join(" · ")}`}</span>}
    </span>
  );
}
