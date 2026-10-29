/** ── UN SOLO AVVISO ────────────────────────────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». Una fascia ambra sottile con
 *  le cose da guardare, ognuna cliccabile col suo numero: «19 richiami scaduti ·
 *  8 messi da parte da più di 3 giorni · 36 ritorni da decidere». Senza voci non
 *  c'è la fascia. Sul telefono si chiude in «3 cose da guardare» e, aperta,
 *  elenca le STESSE voci.
 *  Le voci e i loro numeri sono di `avvisiPagina` (avvisi-pagina.ts, provato).
 *  ───────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { fraseAvvisi, type VoceAvviso } from "./avvisi-pagina";

export function FasciaAvvisi({
  voci,
  onApri,
  disabilitato,
}: {
  voci: VoceAvviso[];
  onApri: (v: VoceAvviso) => void;
  disabilitato?: boolean;
}) {
  const telefono = useIsMobile();
  const [aperta, setAperta] = useState(false);
  if (voci.length === 0) return null;
  const apri = (v: VoceAvviso) => {
    setAperta(false);
    onApri(v);
  };
  if (telefono) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 text-[13px] text-amber-900">
        <button
          type="button"
          aria-expanded={aperta}
          onClick={() => setAperta((v) => !v)}
          className="flex min-h-11 w-full items-center gap-2 px-3 text-left font-medium"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{fraseAvvisi(voci)}</span>
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 transition-transform", aperta && "rotate-90")}
            aria-hidden="true"
          />
        </button>
        {aperta && (
          <ul className="divide-y divide-amber-200 border-t border-amber-200">
            {voci.map((v) => (
              <li key={v.chiave}>
                <button
                  type="button"
                  disabled={disabilitato}
                  onClick={() => apri(v)}
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-left disabled:opacity-50"
                >
                  <span className="flex-1 underline underline-offset-2">{v.testo}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12.5px] text-amber-900">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {voci.map((v, i) => (
        <span key={v.chiave} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          <button
            type="button"
            disabled={disabilitato}
            onClick={() => apri(v)}
            className="font-medium underline underline-offset-2 hover:text-amber-950 disabled:opacity-50"
          >
            {v.testo}
          </button>
        </span>
      ))}
    </div>
  );
}
