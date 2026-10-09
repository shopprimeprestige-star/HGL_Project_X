/** ── MENSILE O TRIMESTRALE: UNA SOLA COPIA DI QUESTA RISPOSTA ──────────────
 *
 *  Da come si liquida l'IVA dipendono TUTTE le date del calendario fiscale.
 *  È un'opzione che si esercita in dichiarazione, quindi il programma non può
 *  dedurla: la legge da `app_config` e la ricorda.
 *
 *  ── ⚠️ PERCHÉ NON SE LA LEGGE OGNUNO PER CONTO SUO ────────────────────────
 *  Perché è quello che succedeva, e in tre posti diversi: la pagina della
 *  contabilità, il conto alla rovescia nel menu, la striscia dentro «Da fare
 *  oggi». Tre letture, tre ripieghi scritti a mano, e — soprattutto — nessuno
 *  che si accorgesse del cambiamento: si passava a «mensile» sulla pagina e il
 *  menu continuava a contare i giorni verso la scadenza trimestrale fino al
 *  ricaricamento. Due date diverse per la stessa scadenza, nello stesso
 *  momento, sullo stesso schermo.
 *  Qui la risposta è una: chi la cambia la cambia per tutti, subito.
 *
 *  ⚠️ IL RIPIEGO È TRIMESTRALE, e sta scritto UNA volta. È il caso di questa
 *   società e di quasi tutte le piccole; mostrare per sbaglio le dodici
 *   scadenze mensili farebbe credere di essere in ritardo undici volte l'anno.
 *   Vale anche quando la lettura fallisce: meglio la data giusta per quasi
 *   sempre che nessuna data.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";
import { archivio } from "./fatture/archivio";
import type { RegimeLiquidazione } from "./contabilita-scadenze";

export const CHIAVE_LIQUIDAZIONE = "contabilita_liquidazione";

let valore: RegimeLiquidazione = "trimestrale";
let letta = false;
let inCorso: Promise<void> | null = null;
const ascoltatori = new Set<() => void>();

const avvisa = () => {
  for (const f of ascoltatori) f();
};

/** ⚠️ UNA LETTURA SOLA anche se la chiedono in tre nello stesso istante: le
 *  tre schermate si montano insieme all'apertura del CRM, e senza questa
 *  guardia partirebbero tre richieste identiche a ogni cambio di pagina. */
async function carica(): Promise<void> {
  if (letta) return;
  inCorso ??= archivio
    .leggi(CHIAVE_LIQUIDAZIONE)
    .then((v) => {
      valore = v === "mensile" ? "mensile" : "trimestrale";
    })
    .catch(() => {
      //  Vedi il ripiego in testa al file.
    })
    .finally(() => {
      letta = true;
      inCorso = null;
      avvisa();
    });
  await inCorso;
}

/** ── IL REGIME, SENZA GANCIO ──────────────────────────────────────────────
 *  Lo stesso valore che legge `useLiquidazione`, per chi non è un componente:
 *  il motore delle notifiche calcola le scadenze fiscali dentro una funzione
 *  pura, e lì un hook non si può chiamare.
 *  ⚠️ Non aspetta la lettura: se il valore non è ancora arrivato torna il
 *   ripiego («trimestrale»), e alla lettura successiva sarà quello giusto. Su
 *   un avviso che si ripete ogni giorno un giro con il ripiego non cambia
 *   niente; aspettare invece bloccherebbe il motore all'avvio. */
export function regimeLiquidazione(): RegimeLiquidazione {
  void carica();
  return valore;
}

export function useLiquidazione(): {
  regime: RegimeLiquidazione;
  cambia: (r: RegimeLiquidazione) => Promise<string | null>;
} {
  const [regime, setRegime] = useState<RegimeLiquidazione>(valore);
  useEffect(() => {
    const suCambio = () => setRegime(valore);
    ascoltatori.add(suCambio);
    void carica().then(suCambio);
    return () => {
      ascoltatori.delete(suCambio);
    };
  }, []);

  const cambia = useCallback(async (r: RegimeLiquidazione) => {
    //  ⚠️ Prima a schermo, poi in archivio: la scelta si vede subito ovunque,
    //   e se la scrittura fallisce lo dice chi ha chiamato. Il contrario —
    //   aspettare il server per cambiare un interruttore — fa premere due volte.
    valore = r;
    letta = true;
    avvisa();
    return archivio.scrivi(CHIAVE_LIQUIDAZIONE, r);
  }, []);

  return { regime, cambia };
}
