/** ── «INSTALLAZIONE» DALLA CHAT (30/10/2026) ──────────────────────────────────
 *  Richiesta del titolare: «dalla chat ci sia un pulsante per gestire installazione, saldo e tutto».
 *  Un tasto solo, accanto allo stato, che apre una finestra con le cose che si fanno più spesso. Ogni
 *  voce apre una finestra del CRM che esiste già (o scrive con la stessa azione della pagina
 *  Installazioni): qui non c'è nessun calcolo, nessuna scrittura e nessuna finestra copiata.
 *   · Programma la posa    → InstallationScheduleDialog (giorno, ora, installatore)
 *   · Registra un incasso  → FinestraIncasso (saldo; con IVA e metodo, come in Installazioni)
 *   · Anticipa / Togli     → useAzioniPriorita (scrive `installazione.priorita` sulla scheda: la pagina
 *                            Installazioni lo vede subito, ed è lo stesso «Anticipa»)
 *   · Scheda del cliente   → la scheda della chat (onApriScheda)
 *   · Altre azioni         → FinestraAzioniPosa (conto, posa eseguita, materiale, consegna…)
 *  Sta nella riga delle pastiglie e non accanto a «Chiama»: la prima riga a 375 px ha già quattro
 *  tasti da 44 px e il nome non deve ridursi a due lettere. */
import { useState } from "react";
import {
  ArrowUpToLine,
  CalendarClock,
  MoreHorizontal,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Finestra, VoceScelta } from "@/crm/ui/Finestra";
import {
  FinestraAzioniPosa,
  FinestraIncasso,
  InstallationScheduleDialog,
  nomeCompleto,
  posaCompletata,
  saldoAllaConsegna,
} from "@/crm/InstallationScheduleDialog";
import { inPriorita, useAzioniPriorita } from "@/crm/priorita";
import { usePuo } from "@/crm/AuthContext";
import { eur } from "@/crm/ui";
import type { Lead } from "@/crm/types";
import { puoAnticipare } from "./accontiInCima";

export function GestioneInstallazione({
  lead,
  onApriScheda,
}: {
  lead: Lead;
  onApriScheda: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [programma, setProgramma] = useState(false);
  const [incasso, setIncasso] = useState(false);
  const [altre, setAltre] = useState(false);
  const { metti, togli } = useAzioniPriorita();
  //  Gli stessi permessi delle pagine: posa e priorità con «installazioni», incassi con «pagamenti».
  //  Senza nessuno dei due il tasto non c'è (revisione di sicurezza, 31/10/2026).
  const puo = usePuo();
  const puoPosa = puo("installazioni");
  const puoIncassi = puo("pagamenti");

  const completata = posaCompletata(lead);
  const senzaData = !lead.data.installazione?.dataInstallazione;
  const inCima = inPriorita(lead) && !completata;
  const resta = saldoAllaConsegna(lead);
  //  Ogni voce chiude il menu e poi apre la sua finestra, come fa FinestraAzioniPosa: due finestre
  //  aperte insieme lasciano la pagina non cliccabile.
  const fai = (azione: () => void) => {
    setMenu(false);
    azione();
  };

  if (!puoPosa && !puoIncassi) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setMenu(true)}
        aria-haspopup="dialog"
        aria-label={`Installazione di ${nomeCompleto(lead)}: gestisci posa, incasso e priorità`}
        title="Gestisci posa, incasso e priorità"
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] font-medium md:h-7",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          inCima
            ? "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100"
            : "border-border bg-background text-foreground hover:bg-muted",
        )}
      >
        {inCima ? (
          <ArrowUpToLine aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Wrench aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        )}
        Installazione
      </button>

      <Finestra
        aperta={menu}
        onCambio={setMenu}
        larghezza="sm"
        icona={Wrench}
        titolo="Installazione"
        contesto={nomeCompleto(lead)}
        classeCorpo="space-y-1.5"
      >
        {puoPosa && !completata && (
          <VoceScelta
            className="min-h-11"
            icona={CalendarClock}
            titolo={senzaData ? "Programma la posa" : "Riprogramma la posa"}
            nota="Giorno, ora, installatore e note"
            onClick={() => fai(() => setProgramma(true))}
          />
        )}
        {puoIncassi && (
          <VoceScelta
            className="min-h-11"
            icona={Wallet}
            titolo="Registra un incasso"
            nota={resta > 0 ? `Mancano ${eur(resta)}` : "Saldo o acconto, con IVA e metodo"}
            onClick={() => fai(() => setIncasso(true))}
          />
        )}
        {puoPosa &&
          puoAnticipare(lead) &&
          (inCima ? (
            <VoceScelta
              className="min-h-11"
              icona={ArrowUpToLine}
              titolo="Togli la priorità"
              nota="Torna nel suo turno, anche in Installazioni"
              onClick={() => fai(() => void togli(lead))}
            />
          ) : (
            <VoceScelta
              className="min-h-11"
              icona={ArrowUpToLine}
              titolo="Anticipa la posa"
              nota="La porta in cima, qui e in Installazioni"
              onClick={() => fai(() => void metti(lead, ""))}
            />
          ))}
        <VoceScelta
          className="min-h-11"
          icona={UserRound}
          titolo="Scheda del cliente"
          nota="Anagrafica, importi, storico"
          onClick={() => fai(onApriScheda)}
        />
        {puoPosa && (
          <VoceScelta
            className="min-h-11"
            icona={MoreHorizontal}
            titolo="Altre azioni"
            nota="Conto, posa eseguita, materiale, consegna"
            onClick={() => fai(() => setAltre(true))}
          />
        )}
      </Finestra>

      {puoPosa && (
        <InstallationScheduleDialog lead={lead} open={programma} onOpenChange={setProgramma} />
      )}
      {puoIncassi && <FinestraIncasso lead={lead} aperta={incasso} onCambio={setIncasso} />}
      {puoPosa && (
        <FinestraAzioniPosa
          lead={lead}
          aperta={altre}
          onCambio={setAltre}
          onApri={() => onApriScheda()}
          onProgramma={() => setProgramma(true)}
        />
      )}
    </>
  );
}
