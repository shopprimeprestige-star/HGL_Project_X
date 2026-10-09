/** ── QUALE RISPOSTA COMPRA ─────────────────────────────────────────────────
 *
 *  Richiesta del committente: «voglio che sulla scheda lead ci siano tutte le
 *  risposte che danno nel questionario, in modo che dopo aggiungi su KPI il
 *  tasso di CVR in base alle risposte».
 *
 *  Le risposte al questionario dell'inserzione arrivano dentro la scheda del
 *  lead all'importazione (crm/modulo-lead). Qui si guarda l'altra metà della
 *  stessa cosa: di tutti quelli che hanno risposto «sto valutando sul serio»,
 *  quanti hanno poi comprato? E di quelli che «si stanno solo informando»?
 *  È il numero che cambia una giornata di lavoro, perché dice a chi telefonare
 *  per primo — e, prima ancora, dice quale domanda vale la pena fare nel
 *  modulo: una domanda le cui risposte convertono tutte uguale non sta
 *  selezionando niente e sta solo allungando il modulo.
 *
 *  ── STA ACCANTO A «COME RISPONDONO AL FORM», NON DENTRO ──────────────────
 *  Quella conta le risposte lasciate sulla landing (`public_leads`), questa
 *  conta le SCHEDE del CRM. Sono due popolazioni diverse e i totali non
 *  coincidono: è scritto in fondo a tutte e due. Il resto — la soglia sotto la
 *  quale una percentuale non si mostra, il grassetto sulla riga che converte
 *  di più, la definizione di «cliente» — è identico di proposito: due riquadri
 *  accanto che contassero in due modi diversi farebbero dubitare di entrambi.
 *
 *  ⚠️ LE LINGUETTE NON SONO SCRITTE QUI: sono le domande trovate nei dati. Un
 *   modulo nuovo compare da solo, senza pubblicare niente.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { useCRM } from "@/crm/CRMContext";
import { cn } from "@/lib/utils";
import { Scheda, Segmento, VuotoRiga } from "@/crm/ui";
import { leadIsConverted } from "@/crm/lead-analytics";
import type { FiltroPeriodo } from "@/crm/kpi-calcoli";
import { VOLUME_MINIMO_LPS } from "./soglie";
import { domandeDeiLead, rispostaMigliore } from "./risposte-lead";

/** Percentuali a un decimale, come nella scheda accanto. */
const pct = (n: number) => `${n.toFixed(1)}%`;

export function RisposteAdsScheda({ dentro }: { dentro: FiltroPeriodo }) {
  const { leads } = useCRM();
  const [scelta, setScelta] = useState<string | null>(null);

  //  Solo le schede del periodo, e solo quelle che hanno risposto a qualcosa:
  //  tenere dentro anche chi non ha mai visto un questionario abbasserebbe
  //  ogni percentuale senza che nessuna riga lo spieghi.
  const conRisposte = useMemo(
    () => leads.filter((l) => dentro(l.data.createdAt) && (l.data.modulo?.risposte?.length ?? 0) > 0),
    [leads, dentro],
  );

  const domande = useMemo(() => domandeDeiLead(conRisposte, leadIsConverted), [conRisposte]);
  //  La domanda scelta, o la più risposta: è quella che regge il conto.
  const attiva = useMemo(
    () => domande.find((d) => d.domanda === scelta) ?? domande[0],
    [domande, scelta],
  );
  const migliore = useMemo(() => rispostaMigliore(attiva, VOLUME_MINIMO_LPS), [attiva]);
  const clienti = attiva?.clienti ?? 0;

  return (
    <Scheda
      titolo="Quale risposta compra"
      nota={
        conRisposte.length
          ? `${conRisposte.length} ${conRisposte.length === 1 ? "scheda" : "schede"} con questionario nel periodo · ${clienti} ${clienti === 1 ? "diventata cliente" : "diventate clienti"}`
          : "Nessuna scheda con questionario nel periodo"
      }
      azioni={
        domande.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {domande.map((d) => (
              <Segmento
                key={d.domanda}
                attivo={attiva?.domanda === d.domanda}
                onClick={() => setScelta(d.domanda)}
              >
                {/*  Il titolo per esteso nel suggerimento: le domande di un
                    modulo sono lunghe una riga e qui sono accorciate. */}
                <span title={d.domanda}>{d.titolo}</span>
              </Segmento>
            ))}
          </div>
        ) : undefined
      }
      senzaPadding
    >
      {!attiva ? (
        <VuotoRiga testo="Nessuna risposta al questionario nel periodo scelto. Le risposte arrivano con le liste importate dalle inserzioni." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium" title={attiva.domanda}>
                  {attiva.titolo}
                </th>
                <th className="px-3 py-2 text-right font-medium">Lead</th>
                <th className="px-3 py-2 text-right font-medium">Clienti</th>
                <th className="px-3 py-2 text-right font-medium">Conversione</th>
              </tr>
            </thead>
            <tbody>
              {attiva.righe.map((r) => {
                const misurabile = r.lead >= VOLUME_MINIMO_LPS;
                return (
                  <tr key={r.risposta} className="border-b border-border last:border-0">
                    <td className="max-w-[280px] truncate px-3 py-2 font-medium" title={r.risposta}>
                      {r.risposta}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.lead}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.clienti}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        r.risposta === migliore && "font-semibold",
                        !misurabile && "text-muted-foreground",
                      )}
                      title={
                        misurabile
                          ? `${r.clienti} su ${r.lead} lead${r.risposta === migliore ? " · è la risposta che converte di più nel periodo" : ""}`
                          : `Meno di ${VOLUME_MINIMO_LPS} lead: la percentuale non è misurata`
                      }
                    >
                      {misurabile ? `${pct(r.cvrPct)} · ${r.clienti} su ${r.lead}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1.5 border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          Le risposte date al <strong>questionario dell'inserzione</strong>, come sono arrivate con
          la lista. Si contano le <strong>schede del CRM</strong>, quindi i totali non coincidono
          con «Come rispondono al form» qui sopra, che conta le risposte lasciate sulla landing: sono
          due popolazioni diverse e non devono combaciare.
        </p>
        <p>
          Una scheda conta come cliente con la stessa regola del resto del CRM. La percentuale
          compare da {VOLUME_MINIMO_LPS} lead in su: sotto, una persona sola la sposta di venti
          punti. Le schede senza questionario restano fuori dal conto.
        </p>
      </div>
    </Scheda>
  );
}
