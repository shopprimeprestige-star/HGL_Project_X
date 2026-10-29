/** ── L'AVVISO «IL PONTE È FERMO» (la fascia in cima alla chat) ──────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T8. Una fascia sottile
 *  sotto l'intestazione della chat, SOLO se qualcosa non va: con il ponte
 *  collegato, o senza ponte, non c'è e la pagina resta quella di sempre.
 *  La regola e le frasi stanno in ./avvisoPonte; la lettura in ./usaStatoPonte.
 *  Non si può chiudere: sparisce da sola quando il ponte riparte.
 *  Il significato non sta nel solo colore: c'è sempre un'icona diversa e la frase.
 *  `role="status"` perché non è un'emergenza della pagina ma un'informazione che
 *  cambia nel tempo. */
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvvisoPonte, GravitaPonte } from "./avvisoPonte";
import { useStatoPonte } from "./usaStatoPonte";

const STILE: Record<Exclude<GravitaPonte, "nessuna">, string> = {
  grave: "border-red-200 bg-red-50 text-red-900",
  attenzione: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-border bg-muted text-foreground",
};

/** Solo il disegno: la prova lo mostra con avvisi finti. */
export function FasciaPonte({ avviso }: { avviso: AvvisoPonte }) {
  if (!avviso.mostra || avviso.gravita === "nessuna") return null;
  const Icona = avviso.gravita === "info" ? Info : AlertTriangle;
  return (
    <div
      role="status"
      data-gravita={avviso.gravita}
      className={cn(
        "flex shrink-0 items-start gap-2 border-b px-3 py-2 text-[13px] leading-snug md:px-4",
        STILE[avviso.gravita],
      )}
    >
      <Icona className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-pretty">{avviso.frase}</p>
    </div>
  );
}

export function StatoPonte() {
  return <FasciaPonte avviso={useStatoPonte()} />;
}
