/** ── QUANDO ARRIVANO I SOLDI ───────────────────────────────────────────────
 *
 *  Una finestra, due momenti in cui si apre:
 *   · EMETTI — la fattura è ancora una bozza e il pagamento è arrivato: le si
 *     assegnano numero e data e si registra tutto in un colpo;
 *   · INCASSA — la fattura era già stata emessa (dal preventivo, prima del
 *     bonifico) e adesso i soldi ci sono: si registra solo il quando.
 *
 *  ⚠️ È UNA FINESTRA SOLA E NON DUE, e non per risparmiare codice: le domande
 *   sono le stesse — quando è arrivato, quanto, e come gli arriva l'impianto —
 *   e due finestre gemelle divergono al primo ritocco. Il giorno in cui una
 *   delle due smette di aggiornare lo stato del cliente, quale delle due sia
 *   dipende da dove si è premuto.
 *
 *  In tutti e due i casi si dichiarano TRE cose in un gesto solo:
 *   1 · il giorno in cui il pagamento è stato ricevuto — finisce sul foglio
 *       («Pagamento ricevuto il 28 agosto 2026») e chiude la partita;
 *   2 · lo stato dell'ordine, che passa a «acconto incassato»;
 *   3 · come arriva l'impianto: da noi, a casa sua, o per posta.
 *
 *  ── ⚠️ PERCHÉ LE TRE COSE STANNO INSIEME ─────────────────────────────────
 *  Perché succedono nello stesso istante e nella vita reale sono un solo
 *  fatto: «il bonifico è arrivato». Separandole si ottiene esattamente quello
 *  che succedeva prima — la fattura risultava incassata e la scheda del cliente
 *  restava «in attesa acconto», oppure il contrario. Due verità sullo stesso
 *  cliente in due schermate diverse, e chi lo chiama al telefono non sa a quale
 *  credere.
 *
 *  ⚠️ LA DATA NON SI TOCCA SULLA FATTURA GIÀ EMESSA. Numero, data del documento
 *   e importi restano quelli: questo scrive solo `dataPagamento`, che è un
 *   fatto successivo. Cambiare la data di una fattura emessa vorrebbe dire
 *   riscrivere un documento che è già in una serie.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, CalendarClock, FileCheck2, House, Truck, Wallet, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCRM } from "../CRMContext";
import { eur } from "../ui";
import {
  CLASSE_CAMPO,
  Finestra,
  KpiFinestra,
  NotaFinestra,
  SezioneFinestra,
  VoceScelta,
} from "../ui/Finestra";
import { Input } from "@/components/ui/input";
import { giornoISO, leggiEuro, scriviEuro } from "../InstallationScheduleDialog";
import { contoDaLordo } from "./conti";
import { emetti } from "./archivio";
//  Il blocco «come ha pagato», lo stesso delle altre finestre delle fatture.
import { SceltaModoIncasso } from "./SceltaModoIncasso";
import type { MetodoPagamento } from "./modi-di-incasso";
import { MODO_CONSEGNA_DA_STATO, type Lead, type LeadStatus } from "../types";
import { nomeCliente } from "./documento";
import type { DatiAzienda, Fattura } from "./tipi";

/** Le tre chiusure vinte, dette come le direbbe chi è al telefono. L'elenco
 *  degli stati non è riscritto qui: si legge da `MODO_CONSEGNA_DA_STATO`
 *  (crm/types), che è l'unico posto in cui uno stato sa come si consegna. */
const CONSEGNE: { stato: LeadStatus; titolo: string; nota: string; icona: typeof Wrench }[] = [
  {
    stato: "posa_in_sede",
    titolo: "Viene da noi",
    nota: "Si posa nel nostro centro: entra in agenda con installatore e orario",
    icona: Wrench,
  },
  {
    stato: "posa_a_domicilio",
    titolo: "Andiamo da lui",
    nota: "Posa a domicilio: occupa un installatore per delle ore e serve l'indirizzo",
    icona: House,
  },
  {
    stato: "posa_da_spedire",
    titolo: "Si spedisce",
    nota: "Va nella scheda «Da spedire», dove si scrive l'indirizzo",
    icona: Truck,
  },
];

export function FinestraIncassoFattura({
  fattura,
  lead,
  azienda,
  aperta,
  onCambio,
  onFatto,
}: {
  fattura: Fattura;
  /** I dati del centro: servono a numerare, quando si emette. */
  azienda: DatiAzienda;
  /** La scheda del cliente, se si è riusciti a trovarla. ⚠️ Può mancare: una
   *  fattura emessa dal preventivo non nasce da una scheda, e si aggancia per
   *  email — se quella persona nel CRM non c'è ancora, la fattura si incassa lo
   *  stesso e lo stato non si tocca. Meglio metà lavoro fatto che un pulsante
   *  che si rifiuta di funzionare. */
  lead: Lead | null;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  onFatto: (f: Fattura) => void;
}) {
  const { updateLead } = useCRM();
  const [data, setData] = useState(giornoISO());
  /*  ── ⚠️ COME HA PAGATO SI DICE QUI, perché è QUI che si sa ────────────
      Segnalazione del committente: «seleziono POS e sulla fattura esce
      pagamento tramite bonifico». Da questa finestra — quella che si apre
      quando i soldi arrivano, l'unica che si usa quando il cliente paga al
      POS davanti a te — il modo non si poteva dire: la fattura usciva senza,
      e «senza» vuol dire bonifico (è quello che il programma scriveva prima
      che il campo esistesse). Da lì l'IBAN e la parola «bonifico» su un
      incasso al POS.
      Si parte da quello che la bozza aveva già, se ce l'aveva. */
  const [metodo, setMetodo] = useState<MetodoPagamento>(fattura.metodoPagamento ?? "bonifico");
  const [riferimento, setRiferimento] = useState(fattura.riferimentoPagamento ?? "");
  const [consegna, setConsegna] = useState<LeadStatus | "">("");
  const [inCorso, setInCorso] = useState(false);
  /** ── HA PAGATO TUTTO O SOLO UNA PARTE? ─────────────────────────────────
   *  ⚠️ NON CAMBIA IL DOCUMENTO, cambia la SCHEDA. La fattura vale l'importo
   *   che ha: quello resta. Questa domanda dice se, dopo questo versamento, al
   *   cliente resta ancora qualcosa da dare — cioè se la pratica va alla
   *   consegna con un saldo da ritirare o con la cassa già chiusa.
   *   Sbagliarla non fa uscire una fattura sbagliata: fa uscire l'installatore
   *   convinto di dover ritirare dei soldi che sono già arrivati, o il
   *   contrario. */
  const [saldoPieno, setSaldoPieno] = useState(false);
  /** ── L'IMPORTO, CORREGGIBILE ───────────────────────────────────────────
   *  Richiesta del committente: registrando il pagamento si deve poter mettere
   *  la cifra giusta, perché quella che è arrivata non sempre è quella che era
   *  stata fatturata — un acconto concordato a voce, un bonifico arrotondato.
   *  ⚠️ SU UNA FATTURA GIÀ EMESSA CAMBIARE L'IMPORTO È UN'ALTRA COSA dal
   *   registrare una data: riscrive un documento che ha già un numero. Finché
   *   quella fattura non è uscita di qui è la stessa cosa che fa ogni
   *   gestionale prima di trasmettere; se è già stata mandata al
   *   commercialista, la differenza si sistema con una nota di credito. La
   *   finestra lo dice quando la cifra cambia davvero — vedi l'avviso in ambra.
   *  Su una BOZZA non è niente di tutto questo: il numero non c'è ancora. */
  const [testoImporto, setTestoImporto] = useState("");
  //  ⚠️ Emettere e incassare sono due gesti diversi: qui si emette solo se la
  //   fattura è ancora una bozza. Lo si ricava dallo stato invece di farselo
  //   dire, così non possono discordare.
  const daEmettere = fattura.stato !== "emessa";
  //  L'aliquota è quella con cui la fattura era stata composta, non quella di
  //  oggi nelle impostazioni: ricalcolarla con un'altra percentuale
  //  cambierebbe l'imposta di un documento che il cliente ha già in mano.
  const aliquota = Number(fattura.righe[0]?.aliquota ?? azienda.aliquotaPredefinita) || 0;
  const conto = contoDaLordo(leggiEuro(testoImporto), aliquota);
  const importoCambiato = Math.abs(conto.totale - fattura.totale) >= 0.01 && conto.totale > 0;

  useEffect(() => {
    if (!aperta) return;
    setData(fattura.dataPagamento || giornoISO());
    setSaldoPieno(false);
    setTestoImporto(scriviEuro(fattura.totale));
    //  Si riparte da come è già impostata la pratica, se lo è: chi ha già
    //  scelto «a domicilio» in fase di vendita non deve ridirlo.
    const attuale = lead?.data.stato ?? "";
    setConsegna(MODO_CONSEGNA_DA_STATO[attuale as LeadStatus] ? (attuale as LeadStatus) : "");
    setInCorso(false);
  }, [aperta, fattura, lead]);

  const conferma = async () => {
    if (inCorso || !data) return;
    setInCorso(true);

    //  ⚠️ PRIMA IL DOCUMENTO, POI LA SCHEDA. Se cade la rete in mezzo resta una
    //   fattura a posto e una scheda indietro — visibile e correggibile. Al
    //   contrario resterebbe una scheda che dice «ha pagato» e una fattura che
    //   dice di no, cioè la contraddizione peggiore delle due.
    //  ⚠️ IL DOCUMENTO SI RICOMPONE, NON SI RITOCCA A META'. Cambiando il
    //   totale cambiano imponibile, imposta e il prezzo unitario della riga: se
    //   se ne aggiornasse solo uno, l'XML uscirebbe con una somma che non torna
    //   e lo SDI lo scarterebbe — quel controllo lo fa da sé.
    //  ⚠️ E IL TIPO SEGUE LA RISPOSTA. La bozza nasce «unica» perché copre
    //   l'intero preventivo; se qui si dichiara che il cliente ha versato solo
    //   una parte, quel documento È una fattura di acconto e deve dirlo — al
    //   saldo servirà sapere che quell'imponibile è già stato fatturato, o lo si
    //   fattura due volte. Un tipo che resta «unica» su una fattura da cento
    //   euro a fronte di un ordine da duemila è la premessa di quell'errore.
    const tipo: Fattura["tipo"] = saldoPieno
      ? fattura.tipo === "acconto"
        ? "saldo"
        : "unica"
      : "acconto";

    const aggiornata: Fattura = {
      ...fattura,
      tipo,
      //  ⚠️ Anche il modo e il suo riferimento: sono i dati con cui si decide
      //   che cosa scrivere sul foglio e nel file dell'Agenzia (IBAN compreso).
      metodoPagamento: metodo,
      riferimentoPagamento: riferimento.trim(),
      ...(importoCambiato
        ? {
            imponibile: conto.imponibile,
            imposta: conto.imposta,
            totale: conto.totale,
            righe: fattura.righe.map((r, i) =>
              i === 0 ? { ...r, quantita: 1, prezzoUnitario: conto.imponibile } : r,
            ),
          }
        : {}),
    };

    if (daEmettere) {
      const esito = await emetti({ ...aggiornata, dataPagamento: data }, azienda, data);
      if (!esito.ok || !esito.fattura) {
        setInCorso(false);
        toast.error("Fattura NON emessa", {
          description: esito.errore ?? "Nessun numero è stato assegnato. Riprova.",
        });
        return;
      }
      onFatto(esito.fattura);
    } else {
      onFatto({ ...aggiornata, dataPagamento: data });
    }

    if (lead && consegna) {
      //  ⚠️ COSA SI SCRIVE IN CASSA. Con «ha saldato tutto» si porta il versato
      //   al prezzo pieno della pratica, così alla consegna non resta niente da
      //   ritirare; con l'acconto si somma quello che è appena arrivato a quello
      //   che c'era. Non si scrive mai MENO di quanto risultava prima: un
      //   versamento non fa tornare indietro la cassa.
      const gia = Number(lead.data.payment?.accontoPagato) || 0;
      const prezzo = Number(lead.data.payment?.prezzoFinaleVendita) || 0;
      const versato = saldoPieno
        ? Math.max(gia, prezzo, conto.totale)
        : Math.max(gia, conto.totale);
      const ok = await updateLead(lead.id, {
        stato: consegna,
        payment: {
          ...(lead.data.payment ?? {}),
          accontoPagato: versato,
          dataPagamento: data,
        },
      });
      if (!ok) {
        toast.warning("Incasso registrato, ma la scheda non si è aggiornata", {
          description: "Lo stato del cliente si può cambiare a mano dalla sua scheda.",
        });
      }
    }
    setInCorso(false);
    onCambio(false);
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      larghezza="sm"
      icona={daEmettere ? FileCheck2 : CalendarClock}
      titolo={daEmettere ? "Emetti la fattura" : "È arrivato il pagamento"}
      contesto={`${nomeCliente(fattura)} · ${eur(fattura.totale)}`}
      classeCorpo="space-y-3"
      azioni={
        <>
          <Button variant="outline" onClick={() => onCambio(false)} disabled={inCorso}>
            Annulla
          </Button>
          <Button
            onClick={() => void conferma()}
            disabled={inCorso || !data}
            className="sm:min-w-40"
          >
            {/*  ⚠️ IL PULSANTE DICE COSA STA PER FARE, e le due cose non sono
                la stessa: emettendo si assegna un numero dentro una serie —
                irreversibile — mentre registrando un incasso si scrive una
                data su un documento che esiste già. Un'etichetta sola per tutti
                e due i gesti farebbe premere il primo credendo di fare il
                secondo. */}
            {inCorso
              ? daEmettere
                ? "Emetto…"
                : "Registro…"
              : daEmettere
                ? "Emetti e registra"
                : "Registra l'incasso"}
          </Button>
        </>
      }
    >
      {/* ── QUANTO HA PAGATO ─────────────────────────────────────────────
          ⚠️ NON CAMBIA IL DOCUMENTO. La fattura vale l'importo che ha, e quello
           resta: questa domanda dice se al cliente resta ancora qualcosa da
           dare. Sbagliarla non fa uscire una fattura sbagliata — fa uscire
           l'installatore convinto di dover ritirare dei soldi che sono già
           arrivati, o il contrario. */}
      {lead && (
        <SezioneFinestra
          titolo="Cosa ha pagato"
          nota={`La fattura è di ${eur(fattura.totale)}: questo dice cosa resta sulla scheda`}
          classeCorpo="p-3 space-y-2"
        >
          <VoceScelta
            icona={Wallet}
            titolo="Un acconto"
            nota={`Alla consegna resta da ritirare il resto`}
            selezionata={!saldoPieno}
            onClick={() => setSaldoPieno(false)}
          />
          <VoceScelta
            icona={BadgeCheck}
            titolo="Ha saldato tutto"
            nota="Alla consegna non c'è più niente da incassare"
            selezionata={saldoPieno}
            onClick={() => setSaldoPieno(true)}
          />
        </SezioneFinestra>
      )}

      {/* ── QUANTO È ARRIVATO DAVVERO ─────────────────────────────────────
          La cifra che era stata fatturata non sempre è quella che arriva: un
          acconto concordato a voce, un bonifico arrotondato. Qui si corregge, e
          il documento si ricompone — imponibile, imposta e riga insieme.
          ⚠️ SI RICOMPONE, NON SI RITOCCA A METÀ: aggiornandone solo uno, l'XML
           uscirebbe con una somma che non torna, e lo SDI quel controllo lo fa
           da sé. */}
      {/*  ── COME HA PAGATO ───────────────────────────────────────────────
           Lo stesso blocco delle altre due finestre delle fatture, non una
           terza copia: tre copie della stessa domanda danno tre risposte
           diverse sullo stesso documento fiscale. */}
      <SezioneFinestra
        titolo="Come ha pagato"
        nota="Finisce sulla fattura e nel file per il commercialista"
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

      <SezioneFinestra
        titolo="Importo della fattura"
        nota={`Fatturati ${eur(fattura.totale)}: si corregge se è arrivato altro`}
        classeCorpo="p-3 space-y-2.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-slate-500">€</span>
          <Input
            value={testoImporto}
            onChange={(e) => setTestoImporto(e.target.value)}
            inputMode="decimal"
            aria-label="Importo della fattura"
            placeholder="0,00"
            className={cn(CLASSE_CAMPO, "h-10 flex-1 text-[16px] font-semibold tabular-nums")}
          />
          {importoCambiato && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTestoImporto(scriviEuro(fattura.totale))}
              className="h-9 shrink-0 border-slate-200 bg-white text-[12px] text-slate-700"
              title="Rimetti la cifra che era stata fatturata"
            >
              Rimetti {eur(fattura.totale)}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <KpiFinestra etichetta="Imponibile" valore={eur(conto.imponibile)} />
          <KpiFinestra etichetta={`IVA ${aliquota}%`} valore={eur(conto.imposta)} />
          <KpiFinestra etichetta="Totale" valore={eur(conto.totale)} forte />
        </div>

        {importoCambiato && !daEmettere && (
          //  ⚠️ L'unico avviso in ambra della finestra, e solo quando la cifra
          //   cambia DAVVERO su una fattura che ha già un numero: finché quel
          //   documento non è uscito di qui è la stessa cosa che fa ogni
          //   gestionale prima di trasmettere; se è già stato mandato al
          //   commercialista, la differenza si sistema con una nota di credito.
          <p className="text-[11.5px] leading-snug text-amber-700">
            Stai cambiando l&apos;importo di una fattura che ha già il numero{" "}
            <span className="font-semibold">
              {fattura.anno}/{fattura.numero}
            </span>
            : il documento viene rifatto con la cifra nuova. Se l&apos;avevi già mandata al
            commercialista, la differenza va sistemata con una nota di credito.
          </p>
        )}
      </SezioneFinestra>

      <SezioneFinestra
        titolo="Quando è arrivato"
        nota="Finisce sul foglio: «Pagamento ricevuto il…»"
        classeCorpo="p-3"
      >
        <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
          <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="date"
            value={data}
            max={giornoISO()}
            onChange={(e) => setData(e.target.value)}
            className="w-full bg-transparent text-[14px] tabular-nums text-slate-900 outline-none"
          />
        </span>
        {/*  ⚠️ Si dice che il documento NON si tocca: chi vede un campo data su
            una fattura emessa teme di starla ridatando, e non preme. */}
        <p className="mt-2 text-[11.5px] leading-snug text-slate-500">
          {daEmettere
            ? //  ⚠️ Emettendo, questa data È la data della fattura: per un
              //   documento immediato la data è quella dell'operazione, e
              //   l'operazione è l'incasso. Chi vede il bonifico venerdì ed
              //   emette lunedì mette venerdì.
              "È anche la data della fattura: si emette con la data dell'incasso, non con quella di oggi."
            : "Numero, data e importi della fattura non cambiano: qui si registra solo quando i soldi sono arrivati."}
        </p>
      </SezioneFinestra>

      {lead ? (
        <SezioneFinestra
          titolo="Come gli arriva l'impianto"
          nota="Lo stato del cliente passa a «acconto incassato» con questa consegna"
          classeCorpo="p-3 space-y-2"
        >
          {CONSEGNE.map((c) => (
            <VoceScelta
              key={c.stato}
              icona={c.icona}
              titolo={c.titolo}
              nota={c.nota}
              selezionata={consegna === c.stato}
              onClick={() => setConsegna(c.stato)}
            />
          ))}
          {!consegna && (
            <p className="text-[11.5px] leading-snug text-slate-500">
              Se non scegli, l&apos;incasso si registra lo stesso e la scheda resta com&apos;è.
            </p>
          )}
        </SezioneFinestra>
      ) : (
        //  ⚠️ Non è un errore: è la fattura di una persona che nel CRM non ha
        //   (ancora) una scheda. Si dice, invece di mostrare tre pulsanti che
        //   non farebbero niente.
        <NotaFinestra>
          Di questo cliente non ho trovato la scheda nel CRM, quindi si registra solo
          l&apos;incasso. Lo stato e la consegna si impostano dalla sua scheda, quando c&apos;è.
        </NotaFinestra>
      )}

      <NotaFinestra>
        Sul foglio della fattura comparirà{" "}
        <strong className={cn(!data && "opacity-40")}>
          «Pagamento ricevuto il{" "}
          {data
            ? new Date(`${data}T12:00:00`).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "…"}
          »
        </strong>
        .
      </NotaFinestra>
    </Finestra>
  );
}
