/** ── IL PROSPETTO F24 IN PAGINA ────────────────────────────────────────────
 *
 *  Le quattro caselle da ricopiare nell'home banking, con accanto cosa sono.
 *  Il perché questo NON è un modulo di pagamento — e non può esserlo — sta in
 *  `crm/contabilita-f24`, in due righe: una società con partita IVA non può
 *  pagare l'F24 su carta.
 *
 *  ⚠️ LA SCHEDA COMPARE ANCHE QUANDO NON C'È NIENTE DA VERSARE, e dice perché.
 *   Farla sparire lascerebbe chi la cerca a chiedersi se si è rotta qualcosa,
 *   proprio nel momento in cui la risposta è la più importante di tutte:
 *   «questo trimestre non devi niente».
 *  ───────────────────────────────────────────────────────────────────────── */
import { Copy, Landmark, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Scheda } from "./ui";
import { perchePerNiente, righeF24, totaleF24 } from "./contabilita-f24";
import type { ContoFiscale } from "./contabilita";
import type { Periodo } from "./contabilita-periodo";
import type { RegimeLiquidazione } from "./contabilita-scadenze";
import { costruisciFoglioF24 } from "./contabilita-f24-foglio";
import type { DatiAzienda } from "./fatture/tipi";

/** ── ⚠️ QUI I CENTESIMI CI VOGLIONO ──────────────────────────────────────
 *  Altrove in questa pagina gli importi si scrivono all'euro, ed è giusto: si
 *  guardano per capire un ordine di grandezza. Qui no — questi numeri si
 *  RICOPIANO in un modulo di pagamento, e «42 €» al posto di «42,24 €» è un
 *  versamento sbagliato, con la differenza che torna indietro come avviso
 *  bonario un anno dopo. */
const esatto = (n: number) =>
  `${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function ProspettoF24({
  conto,
  periodo,
  regime,
  azienda,
}: {
  conto: ContoFiscale;
  periodo: Periodo;
  regime: RegimeLiquidazione;
  azienda: DatiAzienda;
}) {
  const righe = righeF24(conto, periodo, regime);

  const copia = async () => {
    const testo = righe
      .map((r) => `${r.codice}\t${r.periodo}\t${r.anno}\t${r.importo.toFixed(2)}\t${r.cosa}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(testo);
      toast.success("Righe copiate", {
        description: "Codice tributo, periodo, anno e importo: incollali dove compili l'F24.",
      });
    } catch {
      //  Il permesso negato o un browser vecchio: si dice, invece di far
      //  credere che sia andata.
      toast.error("Non sono riuscito a copiare", {
        description: "Selezionale a mano dalla tabella qui sopra.",
      });
    }
  };

  /*  Il foglio lo COSTRUISCE una funzione pura (crm/contabilita-f24-foglio),
      che si può rendere in memoria e controllare; qui resta il gesto. */
  const stampa = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Il browser ha bloccato la finestra di stampa", {
        description: "Consenti le finestre a comparsa per questo sito e riprova.",
      });
      return;
    }
    w.document.write(
      costruisciFoglioF24(conto, periodo, regime, azienda, new Date().toISOString().slice(0, 10)),
    );
    w.document.close();
  };

  return (
    <Scheda
      titolo="F24 da compilare"
      nota="Le caselle da ricopiare nell'home banking o in Entratel. Una società con partita IVA non può pagarlo su carta"
      icona={Landmark}
      azioni={
        righe.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={stampa}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Stampa
            </Button>
            <Button variant="outline" size="sm" onClick={() => void copia()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copia le righe
            </Button>
          </>
        )
      }
      senzaPadding
    >
      {righe.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {perchePerNiente(conto, periodo, regime)}
        </p>
      ) : (
        <>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-1.5 text-left font-semibold">Codice tributo</th>
                <th className="py-1.5 text-left font-semibold">Rateaz./Trim.</th>
                <th className="py-1.5 text-left font-semibold">Anno</th>
                <th className="px-4 py-1.5 text-right font-semibold">Importo a debito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {righe.map((r) => (
                <tr key={r.codice}>
                  <td className="px-4 py-2">
                    <span className="font-semibold tabular-nums">{r.codice}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{r.cosa}</span>
                  </td>
                  <td className="py-2 tabular-nums">{r.periodo}</td>
                  <td className="py-2 tabular-nums">{r.anno}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {esatto(r.importo)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50">
                <td className="px-4 py-2 font-semibold" colSpan={3}>
                  In tutto
                </td>
                <td className="px-4 py-2 text-right text-[14px] font-bold tabular-nums">
                  {esatto(totaleF24(righe))}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Sezione <strong>Erario</strong>. I codici sono quelli ordinari e li conferma il
            commercialista: un codice sbagliato manda i soldi su un altro tributo, e recuperarli è
            un&apos;istanza. <strong>IRES e IRAP non sono qui</strong> — il loro F24 non è mai una
            riga sola: è il saldo dell&apos;anno scorso più due acconti calcolati su quanto si è
            pagato allora, numeri che stanno nella dichiarazione e che questo programma non ha.
          </p>
        </>
      )}
    </Scheda>
  );
}
