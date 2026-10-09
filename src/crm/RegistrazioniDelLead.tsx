/** ── LE REGISTRAZIONI, DENTRO LA SCHEDA DEL CLIENTE ────────────────────────
 *
 *  Segnalazione del committente: «ora non salva le registrazioni delle
 *  consulenze dentro al CRM».
 *
 *  Si salvavano (in archivio c'erano dodici schede e i video nella Storage), ma
 *  dal CRM ci si arrivava per una strada sola: il menu «…» della riga di un
 *  PREVENTIVO. Una consulenza senza preventivo — e sono tante — restava senza
 *  nessun filo, e la scheda del cliente prometteva l'opposto per iscritto:
 *  «Preventivo, slide e registrazione restano legati a questo lead».
 *  Adesso la promessa è mantenuta qui.
 *
 *  ⚠️ UNA SOLA LETTURA, E SOLO QUANDO LA SCHEDA SI APRE. L'elenco completo
 *   arriva in una richiesta e si filtra qui con la regola provata
 *   (crm/registrazioni-del-lead): due richieste — una per il lead e una per il
 *   preventivo — sarebbero il doppio del traffico per la stessa risposta.
 *  ⚠️ SE L'ARCHIVIO NON RISPONDE, LA SEZIONE NON COMPARE. Un riquadro che dice
 *   «non riesco a leggere» in mezzo alla scheda di un cliente è rumore: chi
 *   apre la scheda sta facendo altro, e le registrazioni restano dove sono
 *   sempre state (pannello del presentatore, menu dei preventivi).
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SezioneFinestra } from "@/crm/ui/Finestra";
import { dataBreve } from "@/crm/ui";
import type { Lead } from "@/crm/types";
import { fetchCRM } from "./AuthContext";
import {
  durataLeggibile,
  registrazioniDelLead,
  type RegistrazioneArchivio,
  type RegistrazioneDelLead,
} from "./registrazioni-del-lead";

export function RegistrazioniDelLead({ lead }: { lead: Lead }) {
  const [sue, setSue] = useState<RegistrazioneDelLead[]>([]);
  const idLead = String(lead?.id ?? "");
  const rifPreventivo = String(lead?.data?.quoteRef ?? "");

  useEffect(() => {
    if (!idLead) return;
    let vivo = true;
    void (async () => {
      try {
        const j = (await (await fetchCRM("/api/presenter/recordings")).json()) as {
          recordings?: RegistrazioneArchivio[];
        };
        if (!vivo) return;
        setSue(
          registrazioniDelLead(j?.recordings ?? [], {
            leadId: idLead,
            quoteRefs: [rifPreventivo],
          }),
        );
      } catch {
        /* archivio non raggiungibile: la sezione resta com'era */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [idLead, rifPreventivo]);

  //  Niente registrazioni = niente sezione: in una scheda già lunga, un
  //  riquadro vuoto che dice «non c'è niente» si legge una volta sola e poi dà
  //  fastidio per sempre.
  if (!sue.length) return null;

  return (
    <SezioneFinestra
      titolo={sue.length === 1 ? "Registrazione della consulenza" : `Registrazioni (${sue.length})`}
      nota="Il video della videoconsulenza fatta a questa persona"
      icona={Video}
      classeCorpo="divide-y divide-white/[0.06]"
    >
      {sue.map((r) => (
        <div
          key={r.id || r.url}
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-white/90">
              {dataBreve(r.date)}
              <span className="text-white/45"> · {durataLeggibile(r.duration)}</span>
            </p>
            <p className="mt-0.5 text-[11.5px] text-white/40">
              {r.presenterName || "Consulenza"}
              {/*  Da quale filo è arrivata: sulle registrazioni di prima è il
                  numero del preventivo, e dirlo evita la domanda «perché questa
                  sta qui?» su una scheda con due trattative. */}
              {r.filo === "preventivo" && r.quoteRef ? ` · preventivo ${r.quoteRef}` : ""}
            </p>
          </div>
          {/*  ⚠️ `noopener`: il video sta in un indirizzo firmato dell'archivio,
              e una scheda aperta senza questo può tornare indietro a toccare
              quella del CRM. */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => window.open(r.url, "_blank", "noopener")}
          >
            <Video className="mr-1.5 h-4 w-4" /> Guarda
          </Button>
        </div>
      ))}
    </SezioneFinestra>
  );
}
