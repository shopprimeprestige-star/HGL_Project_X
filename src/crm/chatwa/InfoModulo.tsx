/** ── COM'È MESSO IL CLIENTE, DALLA CHAT ─────────────────────────────────────
 *  Richiesta del titolare (28/10/2026): «su WhatsApp dice se è gelido, caldo
 *  ecc., e cliccando sull'icona info mostra tutte le risposte alle domande».
 *  La temperatura è la stessa di Oggi, Lead importati e della scheda
 *  (crm/temperatura-lead); le risposte quelle della scheda (`vociModulo`).
 *  Solo testo React: le risposte vengono da un modulo, mai HTML. */
import { useState } from "react";
import { ClipboardList, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Finestra } from "@/crm/ui/Finestra";
import { PallinoTemperatura } from "@/crm/Temperatura";
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
  const voci = vociModulo(modulo);
  const t = temperaturaLead(modulo, dati.qualifica);
  const conTemperatura = t.livello !== "nessuna" && mostraTemperatura(dati.stato);
  const ritorno = ritornoInChat(dati);
  if (voci.length === 0 && !conTemperatura && !telefono && !ritorno) return null;
  const d = t.termometro;
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
        <Finestra
          aperta
          onCambio={setAperta}
          icona={ClipboardList}
          titolo="Quello che ha detto nel modulo"
          contesto={nome}
          larghezza="sm"
        >
          <div className="space-y-3 p-4 text-[13px]">
            {telefono && (
              <p className="font-mono text-[12.5px] text-muted-foreground">{telefono}</p>
            )}
            {/*  Di ritorno: qui per intero, con la data (sul telefono il tooltip non c'è). */}
            {ritorno && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                <p className="font-medium">{ritorno.completa}</p>
                <p className="mt-0.5 text-[12px]">{ritorno.titolo}</p>
              </div>
            )}
            {conTemperatura && (
              <div className="space-y-1.5">
                <p className="text-slate-700">
                  <PallinoTemperatura t={t} />
                  {t.perche && <span className="text-muted-foreground"> — {t.perche}</span>}
                </p>
                {d && (
                  <>
                    <p className="text-[12.5px] text-slate-700">{d.motivazione}</p>
                    <p className="text-[12.5px] font-medium text-foreground">
                      Da fare: <span className="font-normal">{d.azione_consigliata}</span>
                    </p>
                  </>
                )}
              </div>
            )}
            {voci.length > 0 ? (
              <dl className="divide-y divide-border rounded-lg border border-border">
                {voci.map((v) => (
                  <div key={v.campo} className="px-3 py-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {v.titolo}
                    </dt>
                    <dd className="mt-0.5 whitespace-normal text-foreground" title={v.testo}>
                      {v.valore}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground">Nessuna risposta al modulo.</p>
            )}
          </div>
        </Finestra>
      )}
    </>
  );
}
