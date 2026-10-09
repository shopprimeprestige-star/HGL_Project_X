/** ── UN'ALTRA FATTURA PER LO STESSO CLIENTE ────────────────────────────────
 *
 *  Richiesta del committente: da una fattura in elenco si deve poter fare la
 *  SECONDA verso quel cliente, con l'importo scritto a mano e il modo in cui ha
 *  pagato; premendo di nuovo, la terza.
 *
 *  ── PERCHÉ PARTE DA UNA FATTURA E NON DALLA SCHEDA ────────────────────────
 *  Perché quello che serve è già tutto lì: nome, indirizzo, codice fiscale,
 *  codice destinatario. Ricompilarli da capo per la seconda fattura dello
 *  stesso cliente è il lavoro che questa finestra esiste per togliere — e ogni
 *  ricompilazione è un'occasione per scrivere un codice fiscale diverso dal
 *  primo, cioè due fatture allo stesso cliente intestate a due persone.
 *  ⚠️ IL CLIENTE SI COPIA E NON SI TOCCA: qui non si correggono i suoi dati.
 *   Se sono sbagliati vanno corretti dove si scrivono, altrimenti la prima
 *   fattura resta sbagliata e la seconda no, e nessuno capisce quale vale.
 *
 *  ── ⚠️ SI EMETTE, NON SI ABBOZZA ──────────────────────────────────────────
 *  Le fatture nate dal preventivo sono bozze perché a quel punto nessuno ha
 *  ancora pagato. Qui è il contrario: la si fa PERCHÉ il cliente ha pagato
 *  qualcos'altro, e la data dell'incasso si scrive in questa stessa finestra.
 *  Prende numero e data subito.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { leggiEuro, scriviEuro } from "@/crm/euro";
//  Che cosa chiedere per il modo di incasso scelto, e dove si trova.
import { modoDi } from "./modi-di-incasso";
//  Il blocco «come ha pagato» è uno solo, per tutte le finestre delle fatture.
import { SceltaModoIncasso } from "./SceltaModoIncasso";
import { eur } from "@/crm/ui";
import {
  CampoFinestra,
  Finestra,
  KpiFinestra,
  NotaFinestra,
  SezioneFinestra,
} from "@/crm/ui/Finestra";
import { emetti } from "./archivio";
import { contoDaLordo } from "./conti";
import { nomeCliente } from "./documento";
import {
  comeBozza,
  METODI_PAGAMENTO,
  type DatiAzienda,
  type Fattura,
  type MetodoPagamento,
} from "./tipi";

const oggiISO = () => new Date().toISOString().slice(0, 10);

export function FinestraAltraFattura({
  origine,
  azienda,
  aperta,
  onCambio,
  onFatta,
}: {
  /** La fattura da cui si copia il cliente. */
  origine: Fattura;
  azienda: DatiAzienda;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  onFatta: () => void;
}) {
  const [testo, setTesto] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [metodo, setMetodo] = useState<MetodoPagamento>("bonifico");
  const [riferimento, setRiferimento] = useState("");
  const modoScelto = modoDi(metodo);
  const [giorno, setGiorno] = useState(oggiISO());
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    if (!aperta) return;
    //  ⚠️ L'IMPORTO NASCE VUOTO, e non copiato dalla fattura di partenza: una
    //   cifra già scritta si conferma senza guardarla, e questa finestra
    //   EMETTE — cioè brucia un numero di una serie fiscale. Il gesto più
    //   veloce, aprire e confermare, non deve poter produrre una fattura
    //   sbagliata.
    setTesto("");
    setDescrizione("");
    setMetodo("bonifico");
    setGiorno(oggiISO());
    setInCorso(false);
  }, [aperta]);

  const lordo = Math.max(0, leggiEuro(testo));
  //  Stessa aliquota della fattura da cui si parte: è lo stesso cliente e lo
  //  stesso tipo di operazione. Il conto lo fa `contoDaLordo`, come ovunque.
  const aliquota = origine.righe[0]?.aliquota ?? azienda.aliquotaPredefinita ?? 22;
  const conto = contoDaLordo(lordo, Number(aliquota) || 0);
  const puo = lordo > 0 && !!giorno && !inCorso;

  const conferma = async () => {
    if (!puo) return;
    setInCorso(true);
    const testoDescrizione = descrizione.trim() || origine.righe[0]?.descrizione || "Prestazione";
    const nuova: Fattura = {
      //  ⚠️ NUMERO, DATA E ID SI TOLGONO: copiati da un'altra fattura direbbero
      //   che questa è quella, e glieli riassegna `emetti`. Quella spoliazione
      //   è la stessa che subisce una fattura eliminata quando torna bozza, e
      //   per questo sta scritta in un posto solo — `comeBozza` in tipi.ts.
      //   Due copie di «cosa vuol dire non essere ancora emessa» prima o poi
      //   divergono, e quella dimenticata si porta addosso un numero già usato.
      ...comeBozza(origine),
      //  L'anno lo decide il giorno dichiarato e non l'orologio: un incasso del
      //  30 dicembre fatturato il 3 gennaio resta una fattura dell'anno vecchio.
      anno: Number(giorno.slice(0, 4)) || new Date().getFullYear(),
      //  ⚠️ NON è un acconto: quel segno dice «al saldo questo imponibile è
      //   già fatturato, non rifatturarlo». Su una fattura a sé stante
      //   mentirebbe, e al saldo qualcuno scalerebbe due volte lo stesso
      //   imponibile.
      tipo: "unica",
      righe: [
        {
          descrizione: testoDescrizione,
          quantita: 1,
          prezzoUnitario: conto.imponibile,
          aliquota: conto.aliquota,
        },
      ],
      causale: testoDescrizione,
      imponibile: conto.imponibile,
      imposta: conto.imposta,
      totale: conto.totale,
      metodoPagamento: metodo,
      riferimentoPagamento: riferimento.trim(),
      creataIl: new Date().toISOString(),
      emessaIl: "",
    };
    const esito = await emetti(nuova, azienda, giorno);
    setInCorso(false);
    if (!esito.ok || !esito.fattura) {
      toast.error("La fattura NON è stata emessa", { description: esito.errore });
      return;
    }
    onCambio(false);
    toast.success(`Fattura ${esito.fattura.anno}/${esito.fattura.numero} emessa`, {
      description: `${nomeCliente(nuova)} · ${eur(conto.totale)} · ${
        METODI_PAGAMENTO.find((m) => m.chiave === metodo)?.titolo
      }`,
    });
    onFatta();
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      titolo="Un'altra fattura per questo cliente"
      contesto={`${nomeCliente(origine)} · prende numero e data subito`}
      icona={FilePlus2}
      larghezza="sm"
      classeCorpo="space-y-3"
      azioni={
        <>
          <Button variant="outline" onClick={() => onCambio(false)} disabled={inCorso}>
            Annulla
          </Button>
          <Button onClick={() => void conferma()} disabled={!puo}>
            {inCorso ? "Emetto…" : "Emetti"}
          </Button>
        </>
      }
    >
      <SezioneFinestra titolo="Quanto ha pagato" nota="La cifra incassata, IVA compresa">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-slate-500">€</span>
          <Input
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            aria-label="Importo incassato in euro"
            className="h-10 flex-1 text-[16px] font-semibold tabular-nums"
          />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <KpiFinestra etichetta="Imponibile" valore={eur(conto.imponibile)} />
          <KpiFinestra etichetta={`IVA ${conto.aliquota}%`} valore={eur(conto.imposta)} />
          <KpiFinestra etichetta="Totale" valore={eur(conto.totale)} forte />
        </div>
      </SezioneFinestra>

      {/* ── COME HA PAGATO ───────────────────────────────────────────────
          Tre pastiglie e non una tendina: sono tre, si scelgono col pollice, e
          una tendina per tre voci è un tocco in più per niente.
          ⚠️ NON È UN DETTAGLIO DI COMODO: finisce nell'XML come
           ModalitaPagamento (MP01/MP05/MP08). Dichiarare «bonifico» su un
           incasso in contanti è una cosa falsa dentro un documento fiscale, e
           i gestionali ci riconciliano gli estratti conto. */}
      <SezioneFinestra
        titolo="Come ha pagato"
        nota="Finisce nella fattura, non è solo una nota"
        classeCorpo="p-3"
      >
        <SceltaModoIncasso
          metodo={metodo}
          onMetodo={setMetodo}
          riferimento={riferimento}
          onRiferimento={setRiferimento}
          titolo="Modo di incasso"
          className="border-0 bg-transparent p-0"
        />
      </SezioneFinestra>

      <div className="grid gap-2 sm:grid-cols-2">
        <CampoFinestra
          etichetta="Giorno dell'incasso"
          nota="È la data della fattura, e da qui esce l'anno della numerazione"
        >
          <Input
            type="date"
            value={giorno}
            max={oggiISO()}
            onChange={(e) => setGiorno(e.target.value)}
          />
        </CampoFinestra>
        <CampoFinestra
          etichetta="Descrizione"
          nota={`Vuoto = «${origine.righe[0]?.descrizione || "Prestazione"}»`}
        >
          <Input
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder={origine.righe[0]?.descrizione || "Prestazione"}
          />
        </CampoFinestra>
      </div>

      <NotaFinestra>
        I dati del cliente si copiano da {nomeCliente(origine)} e non si toccano qui: se sono da
        correggere si correggono dove si scrivono, altrimenti due fatture allo stesso cliente
        finiscono intestate a due persone diverse.
      </NotaFinestra>
    </Finestra>
  );
}
