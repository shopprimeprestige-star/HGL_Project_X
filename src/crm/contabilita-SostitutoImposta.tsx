/** ── SOSTITUTO D'IMPOSTA: LE RITENUTE DA VERSARE ───────────────────────────
 *  Compare solo se in questo periodo è stata trattenuta almeno una ritenuta.
 *  Chi non paga professionisti non deve vedere una scheda che gli parla di un
 *  adempimento che non lo riguarda.
 *
 *  ⚠️ SONO VERSAMENTI MENSILI, uno per mese, con scadenze diverse — non un
 *   totale trimestrale. Sommarli in una riga sola farebbe fare un F24 unico
 *   fuori tempo per due terzi dell'importo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { UserCheck } from "lucide-react";
import { Scheda, dataBreve } from "./ui";
import {
  CODICE_RITENUTA,
  adempimentiAnnuali,
  totaleRitenute,
  versamentiRitenuta,
} from "./contabilita-ritenute";
import type { FatturaFornitore } from "./contabilita-fornitori";

const esatto = (n: number) =>
  `${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function SostitutoImposta({
  fornitori,
  anno,
}: {
  fornitori: FatturaFornitore[];
  anno: number;
}) {
  const versamenti = versamentiRitenuta(fornitori);
  if (versamenti.length === 0) return null;

  return (
    <Scheda
      titolo="Ritenute d'acconto da versare"
      nota="Hai trattenuto del denaro per conto dello Stato: da qui in poi sei sostituto d'imposta"
      icona={UserCheck}
      senzaPadding
    >
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-[10.5px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-1.5 text-left font-semibold">Codice</th>
            <th className="py-1.5 text-left font-semibold">Mese</th>
            <th className="py-1.5 text-left font-semibold">Entro</th>
            <th className="px-4 py-1.5 text-right font-semibold">Importo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {versamenti.map((v) => (
            <tr key={v.mese}>
              <td className="px-4 py-2 font-semibold tabular-nums">{CODICE_RITENUTA}</td>
              <td className="py-2">
                {v.mese}
                <span className="block text-[11.5px] text-muted-foreground">
                  {v.chi.slice(0, 3).join(", ")}
                  {v.chi.length > 3 ? ` e altri ${v.chi.length - 3}` : ""}
                </span>
              </td>
              <td className="py-2 font-medium tabular-nums">{dataBreve(v.entro)}</td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">
                {esatto(v.importo)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td className="px-4 py-2 font-semibold" colSpan={3}>
              Trattenuto nel periodo
            </td>
            <td className="px-4 py-2 text-right text-[14px] font-bold tabular-nums">
              {esatto(totaleRitenute(versamenti))}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="border-t border-border px-4 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        {/*  ⚠️ Le due cose che si scoprono quando è tardi: nessuno le collega
            alla parcella pagata dieci mesi prima. */}
        <p className="mb-1.5">
          <strong>Un versamento per mese</strong>, non uno solo per il trimestre: le scadenze sono
          diverse. Codice tributo {CODICE_RITENUTA} (lavoro autonomo) — per le provvigioni degli
          agenti è il 1038. Il mese è quello in cui hai <em>pagato</em> il professionista: qui è
          usata la data della fattura, se l&apos;hai saldata dopo sposta.
        </p>
        {adempimentiAnnuali(anno).map((a) => (
          <p key={a.cosa} className="mt-1">
            <strong>{a.cosa}</strong> — entro il {dataBreve(a.entro)}. {a.perche}
          </p>
        ))}
        <p className="mt-1.5">
          La ritenuta <strong>non abbassa il costo</strong>: il professionista quel denaro lo ha
          guadagnato tutto. Cambia solo quanto esce dal conto verso di lui.
        </p>
      </div>
    </Scheda>
  );
}
