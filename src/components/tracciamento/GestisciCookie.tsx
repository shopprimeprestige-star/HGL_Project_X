/*  ── IL LINK «GESTISCI COOKIE» DEL PIÈ DI PAGINA ───────────────────────────────────
    Shop R1 · T27 · PIANO D15. Riapre la scelta (il banner lo disegna il provider). Dove il banner non può comparire
    (pagine non ammesse) il link non c'è: un pulsante che non fa niente è peggio di nessun pulsante.
    ⚠️ Un amministratore riconosciuto non vede il banner: per lui il link non fa niente (non si traccia e non c'è niente da scegliere). */
import { useRouterState } from "@tanstack/react-router";
import { bannerAmmesso } from "@/lib/tracciamento/ammesse";
import { EVENTO_APRI_COOKIE } from "./controllo";
import { TESTI } from "./testi-cookie";

const STILE_PIEDE =
  "inline-flex min-h-11 items-center underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function GestisciCookie({ className = STILE_PIEDE }: { className?: string }) {
  const percorso = useRouterState({ select: (s) => s.location.pathname });
  const ricerca = useRouterState({ select: (s) => s.location.searchStr });
  if (!bannerAmmesso(percorso, ricerca, false, false)) return null;
  return (
    <button type="button" data-gestisci-cookie className={`cursor-pointer ${className}`} onClick={() => window.dispatchEvent(new Event(EVENTO_APRI_COOKIE))}>
      {TESTI.gestisci}
    </button>
  );
}
