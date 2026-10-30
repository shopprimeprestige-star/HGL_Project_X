/** ── COM'È MESSO IL CLIENTE, DALLA CHAT ─────────────────────────────────────
 *  Richiesta del titolare (28/10/2026): «su WhatsApp dice se è gelido, caldo
 *  ecc., e cliccando sull'icona info mostra tutte le risposte alle domande».
 *  La temperatura è la stessa di Oggi, Lead importati e della scheda
 *  (crm/temperatura-lead); le risposte quelle della scheda (`vociModulo`).
 *  Il pop-up è `FinestraRisposte` (crm/Temperatura), lo stesso che si apre
 *  toccando la temperatura in tutto il CRM (30/10/2026): scritto una volta. */
import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinestraRisposte } from "@/crm/Temperatura";
import { moduloLetto, vociModulo } from "@/crm/modulo-lead";
import { mostraTemperatura, temperaturaLead } from "@/crm/temperatura-lead";
import type { LeadData } from "@/crm/types";
import { ritornoInChat } from "./ritorno";

export function InfoModulo({
  dati,
  nome,
  telefono,
  compatto,
}: {
  dati: Partial<LeadData>;
  nome: string;
  /** Il numero, ripetuto anche qui insieme alle risposte. */
  telefono?: string;
  /** Nella seconda riga dell'intestazione: tasto piccolo con la scritta «Info». */
  compatto?: boolean;
}) {
  const [aperta, setAperta] = useState(false);
  const modulo = moduloLetto(dati);
  const t = temperaturaLead(modulo, dati.qualifica);
  const conTemperatura = t.livello !== "nessuna" && mostraTemperatura(dati.stato);
  const ritorno = ritornoInChat(dati);
  if (vociModulo(modulo).length === 0 && !conTemperatura && !telefono && !ritorno) return null;
  return (
    <>
      {compatto ? (
        <Button
          variant="outline"
          onClick={() => setAperta(true)}
          className="h-11 shrink-0 gap-1 rounded-full px-3 text-[12px] md:h-7"
          aria-label="Info: risposte del modulo e dettagli"
          title="Risposte del modulo e dettagli"
        >
          <Info className="h-3.5 w-3.5" /> Info
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setAperta(true)}
          className="h-11 w-11 md:h-9 md:w-9 shrink-0"
          aria-label="Risposte del modulo"
          title="Risposte del modulo"
        >
          <Info className="h-5 w-5 md:h-4 md:w-4" />
        </Button>
      )}
      {aperta && (
        <FinestraRisposte
          dati={dati}
          nome={nome}
          telefono={telefono}
          ritorno={ritorno}
          onChiudi={() => setAperta(false)}
        />
      )}
    </>
  );
}
