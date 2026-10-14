/** ── LA PAGINA /soluzioni · «TRE SOLUZIONI» (landing v3) ────────────────────────────────────────────
 *  Compone: testata, tavola delle tre soluzioni con la spiegazione che si apre sul posto, foglio del modulo,
 *  footer minimo, banner dei cookie e barra verso le patch. Riceve solo la `VistaSoluzioni` già filtrata dal
 *  server (mai il contenuto grezzo del CRM) e se la spiegazione è già aperta (`?apri=invisible-derm`).
 *
 *  Non ci sono, di proposito: menu, WhatsApp, numero cliccabile, StickyHeader, BarraConsulenza, MediaSlot,
 *  PlaceholderBox, pop-up d'uscita. Le uniche uscite sono il modulo (che resta sulla pagina) e /shop.
 *
 *  ⚠️ La radice è un <div> con `lang="it"` e la classe del tema, e dentro il solo <main> con testata e tavola:
 *   il footer deve restare fuori da <main> (altrimenti non è più il piè di pagina). La barra va per ultima,
 *   come `BarraConsulenza`: lo spazio che riserva in fondo sta dove sta lei. */
import { useCallback, useRef, useState } from "react";
import { ScriptOnce } from "@tanstack/react-router";
import { CookieBanner } from "@/components/landing/CookieBanner";
import { usaTracciamentoPagina } from "@/landing/sito/traccia";
import type { Interesse, VistaSoluzioni } from "./ponte";
import { BarraPatch, FoglioModulo, FooterMinimo } from "./ponte-ui";
import { SpiegazioneInvisible, usaSpiegazione } from "./SpiegazioneInvisible";
import { INTER, STILE_NOTTE } from "./stile";
import { ID_CELLA, TavolaSoluzioni } from "./TavolaSoluzioni";
import { Testata, type AlPrenotare } from "./Testata";

/** Con `?apri` il server disegna il pannello già aperto; questo porta la cella 03 in cima prima del primo disegno
 *  (scorrimento, non spostamento: nessun salto dopo il caricamento). Il fuoco non si muove. */
const PORTA_LA_CELLA_IN_CIMA = `(function(){var e=document.getElementById(${JSON.stringify(ID_CELLA)});if(e)e.scrollIntoView({block:"start"})})()`;

/** Le visite si contano solo sul sito: l'anteprima del CRM non sporca i numeri. */
function Tracciamento() {
  usaTracciamentoPagina("/soluzioni");
  return null;
}

export function PaginaSoluzioni({ vista, apriDalServer }: { vista: VistaSoluzioni; apriDalServer: boolean }) {
  const spiegazione = usaSpiegazione(apriDalServer);
  const [foglio, setFoglio] = useState<{ aperto: boolean; interesse: Interesse }>({ aperto: false, interesse: "non-so" });
  //  A chiusura il fuoco torna al bottone che ha aperto il foglio.
  const rientro = useRef<HTMLElement | null>(null);

  const prenota = useCallback<AlPrenotare>((interesse, da) => {
    rientro.current = da;
    setFoglio({ aperto: true, interesse });
  }, []);
  const chiudiFoglio = useCallback(() => setFoglio((f) => ({ ...f, aperto: false })), []);

  return (
    <div lang="it" className={`tema-soluzioni ${INTER} min-h-screen overflow-x-clip text-white`} style={STILE_NOTTE}>
      {vista.anteprima ? null : <Tracciamento />}
      <main>
        <Testata ritratto={vista.ritratto} onPrenota={prenota} />
        <TavolaSoluzioni
          miniature={vista.miniature}
          aperta={spiegazione.aperta}
          onAlterna={spiegazione.alterna}
          onPrenota={prenota}
          bottoneRef={spiegazione.bottoneRef}
          cellaRef={spiegazione.cellaRef}
        >
          <SpiegazioneInvisible stato={spiegazione} vista={vista} onPrenota={prenota} priorita={apriDalServer} />
        </TavolaSoluzioni>
        {apriDalServer ? <ScriptOnce>{PORTA_LA_CELLA_IN_CIMA}</ScriptOnce> : null}
        <div aria-hidden="true" className="h-10 lg:h-14" />
      </main>
      <FooterMinimo />
      <CookieBanner />
      <FoglioModulo aperto={foglio.aperto} interesse={foglio.interesse} onChiudi={chiudiFoglio} rientro={rientro} />
      <BarraPatch />
    </div>
  );
}
