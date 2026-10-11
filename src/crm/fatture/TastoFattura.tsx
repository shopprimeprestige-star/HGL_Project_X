/** ── IL PULSANTE «FATTURA» ─────────────────────────────────────────────────
 *  Apre la composizione (crm/fatture/FinestraFattura) sulla scheda di questo
 *  cliente.
 *
 *  ⚠️ NON COMPARE SOLO A POSA FATTA, e la differenza con «Riepilogo» qui
 *   accanto è il punto: il riepilogo è la prova di una consegna avvenuta,
 *   quindi prima della consegna non esiste. Una fattura invece nasce con
 *   l'INCASSO, e il primo incasso è l'acconto — cioè settimane prima che
 *   l'impianto sia addosso a qualcuno. Legarla alla posa vorrebbe dire non
 *   poter fatturare l'acconto, che è esattamente il caso più frequente.
 *  Compare quando c'è una cifra da fatturare: un prezzo, o dei soldi già
 *  entrati. Su un lead che non ha comprato niente non serve a nessuno.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { giaIncassato, nomeCompleto, prezzoVendita } from "../InstallationScheduleDialog";
import type { Lead } from "../types";
import { FinestraFattura } from "./FinestraFattura";

export function TastoFattura({
  lead,
  esteso,
  className,
}: {
  lead: Lead;
  esteso?: boolean;
  className?: string;
}) {
  const [aperta, setAperta] = useState(false);
  //  ⚠️ L'hook sta sopra l'uscita anticipata: questo pulsante finisce su righe
  //  di elenchi che si ridisegnano di continuo, e un hook saltato fra due
  //  disegni della stessa riga è una schermata bianca.
  const qualcosaDaFatturare = prezzoVendita(lead) > 0 || giaIncassato(lead) > 0;
  if (!qualcosaDaFatturare) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setAperta(true)}
        title="Prepara o emetti la fattura per questo cliente"
        aria-label={`Fattura per ${nomeCompleto(lead)}`}
        className={cn("h-7 shrink-0", esteso ? "px-2 text-[11.5px]" : "w-7 p-0", className)}
      >
        <Receipt className={cn("h-3.5 w-3.5", esteso && "mr-1")} />
        {esteso && "Fattura"}
      </Button>
      <FinestraFattura lead={lead} aperta={aperta} onCambio={setAperta} />
    </>
  );
}
