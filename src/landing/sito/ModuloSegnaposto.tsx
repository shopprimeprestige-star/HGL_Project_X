/** ── SEGNAPOSTO DEL MODULO CORTO · PROVVISORIO ──────────────────────────────
 *  Qui va `ModuloCorto` (compito C5, `src/landing/booking/ModuloCorto.tsx`).
 *  Stesso nome, stesse proprietà del contratto: quando C5 è dentro basta
 *  cambiare il percorso dell'import in `PaginaProtocol.tsx` e cancellare
 *  questo file.
 *
 *  Tiene al suo posto quello che il resto della pagina si aspetta dal
 *  modulo: l'ancora `#modulo` (a cui scendono i bottoni) e la marcatura
 *  `data-barra-nascondi="vista"` (la barra della consulenza si nasconde
 *  mentre il modulo è sullo schermo, così non lo copre).
 *  Non salva niente e non è un modulo: non va mai pubblicato così.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Provenienza, PuntoIngresso } from "@/landing/consulenza/regole";

export type PuntoSito = PuntoIngresso | "protocol" | "catalogo" | "blog";

export interface ModuloCortoProps {
  origine: Provenienza;
  punto: PuntoSito;
  problemaObbligatorio: boolean;
  titolo: string;
  variant?: "light" | "dark";
  onInviato?: () => void;
}

export function ModuloCorto({ titolo, variant = "dark", origine, punto, problemaObbligatorio }: ModuloCortoProps) {
  const scuro = variant === "dark";
  return (
    <div id="modulo" data-barra-nascondi="vista" className="scroll-mt-6">
      <h2 className={`text-2xl md:text-3xl font-bold tracking-tight text-balance ${scuro ? "text-white" : "text-ink"}`}>
        {titolo}
      </h2>
      <div
        data-segnaposto="modulo-corto"
        data-origine={origine}
        data-punto={punto}
        data-problema-obbligatorio={String(problemaObbligatorio)}
        className={`mt-6 rounded-md border border-dashed p-6 text-base ${
          scuro ? "border-white/40 text-white/80" : "border-ink/40 text-ink-muted"
        }`}
      >
        SEGNAPOSTO · qui va il modulo corto (compito C5). Non ancora collegato.
      </div>
    </div>
  );
}
