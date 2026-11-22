/** Blocchi della landing /invisible-derm usati dalle due pagine (`invisible-derm` e `invisible-derm-v1`) e dallo shop.
 *  Spostati di peso dalle pagine (T73, 23/11/2026): il testo è identico a prima, la landing non cambia
 *  (la prova `prove/negozio/blocchi-istantanea.mjs` confronta con l'istantanea del commit 99d94d3).
 *  `Cta` e `Bottone` restano nelle pagine: dipendono dal contesto del popup di prenotazione. */
import React from "react";
import { Check, Ruler } from "lucide-react";
import { COSE } from "@/landing/testi-invisible-derm";

export function Pillola({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
      <Check className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden="true" />
      {children}
    </span>
  );
}

export const SEZIONE = "px-6 lg:px-10 max-w-7xl mx-auto py-16 sm:py-20 lg:py-28";
export const H2 = "mt-4 text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] text-balance";

export function Testata({ id, sopratitolo, children, centrato = true, scuro = false }: { id: string; sopratitolo: string; children: React.ReactNode; centrato?: boolean; scuro?: boolean }) {
  return (
    <div className={centrato ? "mx-auto max-w-3xl text-center" : ""}>
      <div className="eyebrow">{sopratitolo}</div>
      <h2 id={id} className={`${H2} ${scuro ? "text-white" : "text-ink"}`}>
        {children}
      </h2>
    </div>
  );
}

export function Pilastro({ n, Icon, titolo, testo, kicker, didascalia, media, className = "" }: { n: string; Icon: typeof Ruler; titolo: string; testo: string; kicker?: string; didascalia?: string; media?: React.ReactNode; className?: string }) {
  return (
    <div className={`ng-pillar p-7 ${className}`}>
      {media ? (
        <div className="-mx-7 -mt-7 mb-6 [&>div]:rounded-none">{media}</div>
      ) : (
        <>
          <span className="ng-pillar__num">{n}</span>
          <div className="ng-pillar__icon mb-6">
            <Icon className="relative z-10 h-6 w-6" strokeWidth={2} />
          </div>
        </>
      )}
      <h3 className="text-lg font-bold tracking-tight text-ink">{titolo}</h3>
      {media && kicker && <div className="ng-pillar__kicker mt-3">{kicker}</div>}
      <p className="mt-3 text-base leading-relaxed text-ink-muted">{testo}</p>
      {media && didascalia && <p className="mt-3 text-sm text-ink-muted">{didascalia}</p>}
    </div>
  );
}

export function Trascrizione({ testo }: { testo: string }) {
  if (!testo) return null;
  return (
    <details className="mt-3 text-sm text-ink-muted">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold underline underline-offset-4">{COSE.linkTrascrizione}</summary>
      <p className="mt-2 whitespace-pre-line leading-relaxed">{testo}</p>
    </details>
  );
}
