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
import { Footer } from "@/components/landing/Footer";
import { BarraPatch } from "./BarraPatch";
import { FoglioModulo } from "./FoglioModulo";
import type { Interesse, VistaSoluzioni } from "./regole";
import { SpiegazioneInvisible, usaSpiegazione } from "./SpiegazioneInvisible";
import { ID_CELLA, TavolaSoluzioni } from "./TavolaSoluzioni";
import { Testata, type AlPrenotare } from "./Testata";

/** Con `?apri` il server disegna il pannello già aperto; questo porta la cella 03 in cima prima del primo disegno
 *  (scorrimento, non spostamento: nessun salto dopo il caricamento). Il fuoco non si muove.
 *  ⚠️ Scrive anche `#invisible-derm` nell'indirizzo: dopo l'idratazione il router rimette la pagina in cima (`scrollTo(0)`) se
 *  non c'è nessuna ancora; con l'ancora, invece, fa lui lo `scrollIntoView` della cella. Stessa ancora di quando si apre col tocco. */
const PORTA_LA_CELLA_IN_CIMA = `(function(){var h=${JSON.stringify(`#${ID_CELLA}`)};try{if(location.hash!==h)history.replaceState(history.state,"",location.pathname+location.search+h)}catch(x){}var e=document.getElementById(${JSON.stringify(ID_CELLA)});if(e)e.scrollIntoView({block:"start"})})()`;

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
    <div lang="it" className="tema-soluzioni sol-fondo-notte min-h-screen overflow-x-clip">
      {vista.anteprima ? null : <Tracciamento />}
      <main>
        <Testata ritratto={vista.ritratto} onPrenota={prenota} />
        <TavolaSoluzioni
          miniature={vista.miniature}
          aperta={spiegazione.aperta}
          onAlterna={spiegazione.alterna}
          onPrenota={prenota}
          cellaRef={spiegazione.cellaRef}
        >
          <SpiegazioneInvisible stato={spiegazione} vista={vista} onPrenota={prenota} priorita={apriDalServer} />
        </TavolaSoluzioni>
        {apriDalServer ? <ScriptOnce>{PORTA_LA_CELLA_IN_CIMA}</ScriptOnce> : null}
        <div aria-hidden="true" className="h-10 lg:h-14" />
      </main>
      <Footer variante="minimo" />
      <CookieBanner variante="compatto" />
      <FoglioModulo aperto={foglio.aperto} interesse={foglio.interesse} onChiudi={chiudiFoglio} rientro={rientro} />
      <BarraPatch />
    </div>
  );
}
