/** ── SCHELETRI DI CARICAMENTO (V1 · T83, documento §4.7) ──────────────────────
 *  Si disegna prima il vero (sul server): gli scheletri servono solo alla navigazione dopo il primo caricamento e al cambio dei filtri,
 *  e compaiono solo dopo 300 ms (prima si tiene la vista vecchia: un'attesa breve non deve lampeggiare). La regola è di `vetrina-interazioni`
 *  (`mostraScheletro`, `RITARDO_SCHELETRO_MS`); qui c'è il timer. Lo scheletro ha la forma di ciò che arriva (foto 1:1, due righe, prezzo,
 *  bottone), è azzurro tenue e respira piano (stili `shop-scheletro` / `shop-respiro`: fermi con `prefers-reduced-motion`). Mai grigio. */
import { useEffect, useState, type ReactNode } from "react";
import { TESTI_SHOP } from "@/landing/testi-shop";
import { RITARDO_SCHELETRO_MS, mostraScheletro } from "@/shop/cms/vetrina-interazioni";

/** L'istante da segnare quando scatta il timer. `setTimeout` può scattare 1 ms PRIMA del confronto con l'orologio: così lo stato porta sempre
 *  a un istante che basta (T105: allo scatto si cambia uno stato, non ci si limita a ridisegnare). */
export function istanteDelTimer(inizio: number, adesso: number): number {
  return Math.max(adesso, inizio + RITARDO_SCHELETRO_MS);
}

/** Vero quando l'attesa dura da almeno 300 ms. Sul server e al primo disegno è falso: si vede la pagina vera. */
function useScheletro(inAttesa: boolean): boolean {
  const [attesa, setAttesa] = useState<{ inizio: number; ora: number } | null>(null);
  useEffect(() => {
    if (!inAttesa) {
      setAttesa(null);
      return;
    }
    const inizio = Date.now();
    setAttesa({ inizio, ora: inizio });
    const timer = setTimeout(() => setAttesa({ inizio, ora: istanteDelTimer(inizio, Date.now()) }), RITARDO_SCHELETRO_MS);
    return () => clearTimeout(timer);
  }, [inAttesa]);
  return inAttesa && attesa !== null && mostraScheletro(attesa.inizio, attesa.ora);
}

/** Un blocco azzurro tenue che respira. */
const BLOCCO = "shop-scheletro shop-respiro";

function CardScheletro() {
  return (
    <div data-scheletro-card aria-hidden="true" className="overflow-hidden rounded-[14px] border border-ink/10 bg-white">
      <div className={`${BLOCCO} aspect-square w-full`} />
      <div className="space-y-3 p-3">
        <div className="space-y-2">
          <div data-scheletro-riga className={`${BLOCCO} h-4 w-4/5 rounded`} />
          <div data-scheletro-riga className={`${BLOCCO} h-4 w-3/5 rounded`} />
        </div>
        <div data-scheletro-prezzo className={`${BLOCCO} h-5 w-1/4 rounded`} />
        <div className={`${BLOCCO} h-11 w-full rounded-md`} />
      </div>
    </div>
  );
}

/** Le carte di scheletro in griglia. `className` dà la griglia della pagina (di norma la stessa dei prodotti). L'annuncio per chi non vede sta in una regione `status`. */
export function GrigliaScheletri({ quanti = 4, className = "grid grid-cols-2 gap-4 lg:grid-cols-4" }: { quanti?: number; className?: string }) {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        {TESTI_SHOP.microtesti.attesaPagina}
      </p>
      <div className={className}>
        {Array.from({ length: quanti }, (_, i) => (
          <CardScheletro key={i} />
        ))}
      </div>
    </div>
  );
}

/** `inAttesa` = la pagina sta cambiando (navigazione, filtri). Prima dei 300 ms mostra `children` (la vista vecchia), poi lo scheletro. */
export function Scheletro({ inAttesa, quanti, className, children }: { inAttesa: boolean; quanti?: number; className?: string; children?: ReactNode }) {
  return useScheletro(inAttesa) ? <GrigliaScheletri quanti={quanti} className={className} /> : <>{children}</>;
}
