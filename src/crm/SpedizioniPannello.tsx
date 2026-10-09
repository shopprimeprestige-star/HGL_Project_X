/** ── DA SPEDIRE · A DOMICILIO ──────────────────────────────────────────────
 *
 *  DUE SCHEDE, UN DISEGNO SOLO
 *  Qui dentro stanno le due consegne che non sono una posa in sede: il pacco che
 *  parte e la posa che si fa a casa del cliente. Hanno la stessa riga a due
 *  livelli, gli stessi tre numeri dell'importo, lo stesso menu "…": chi sa
 *  lavorare una delle due sa già lavorare l'altra.
 *
 *  COSA CAMBIA FRA LE DUE, E PERCHÉ CAMBIA TUTTO
 *  Una SPEDIZIONE non occupa nessuno e non ha un'ora: sta fuori dall'agenda e
 *  dai conteggi del giorno, e la domanda che chiude la riga è "è partito?".
 *  Una posa A DOMICILIO occupa un tecnico per delle ore e HA un'ora: resta in
 *  agenda e nei conteggi come una posa in sede, e la domanda che chiude la riga
 *  è la stessa delle installazioni — "è fatta?". Per questo la riga del
 *  domicilio porta il giorno e l'ora, e quella del pacco no.
 *
 *  L'INDIRIZZO SI SCRIVE SULLA RIGA, SU TUTTE E DUE
 *  È l'unico dato che manca quasi sempre, e aprire una finestra per scrivere una
 *  via è il modo più lento di scriverla: qui il campo è già lì, aperto, e si
 *  salva uscendo dal campo o premendo Invio. Nessun pulsante "Salva" da cercare,
 *  nessuna finestra da chiudere. La conferma è il segno di spunta accanto al
 *  campo: finché non c'è, quello che si legge non è ancora scritto. Finché
 *  l'indirizzo manca, il comando che chiude la pratica resta spento — "Spedisci"
 *  di là, "Completa" di qua.
 *
 *  LA PRIORITÀ SI VEDE ANCHE QUI, E NON È UN DI PIÙ
 *  «Da anticipare» si mette dall'elenco delle pose, e queste due schede
 *  guardano le stesse pratiche da un'altra parte: un segno che c'è in una
 *  scheda e sparisce nell'altra non insegna «qui non ce n'è», insegna «quel
 *  dato non esiste» — e da quel momento nessuno lo cerca più in nessuna delle
 *  due. Per questo la riga porta il cartellino e il pulsante identici a quelli
 *  di «Installazioni», e le anticipate salgono in testa all'elenco delle
 *  aperte. ⚠️ «Salgono» vuol dire cose leggermente diverse nelle due schede, e
 *  la differenza è la stessa di sempre: un PACCO non ha un appuntamento, quindi
 *  sale sempre; una TRASFERTA GIÀ FISSATA no — resta al suo giorno, col
 *  cartellino, perché la sua posizione è ciò che dice quando partire. Il
 *  criterio sta scritto una volta sola, in crm/priorita.ts (`daAnticipare` e
 *  `inCimaAllElenco`), e ognuna delle due schede dice quale usa.
 *  Vedi crm/priorita.ts e crm/PrioritaPosa.tsx.
 *
 *  IL COSTO DEL VIAGGIO STA SOLO SUL DOMICILIO
 *  E si scrive allo stesso modo, sulla riga. ⚠️ È un COSTO: non entra nei tre
 *  numeri dell'importo, non si somma al saldo e non compare nel "da incassare"
 *  della scheda. Sta in `payment.costi`, con gli altri costi della pratica.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Consultant, Lead } from "./types";
import { useIndirizziSuggeriti } from "./indirizzo-suggerito";
import { Chip, Scheda, VuotoRiga, dataBreve, eur } from "./ui";
import {
  AzioniInstallazione,
  BadgeOggi,
  ImportoRiga,
  SegnoAccompagnatore,
  SegnoDriver,
  SegnoNote,
  TastoAltreAzioni,
  scriviSuWhatsApp,
  giornoISO,
  giorniDiAttesa,
  leggiEuro,
  nomeAccompagnatore,
  nomeCompleto,
  nomeDriver,
  nomeTecnico,
  posaCompletata,
  scriviEuro,
  senzaTecnico,
  totaleDaIncassare,
} from "./InstallationScheduleDialog";
//  L'icona «torna allo stato di prima» delle righe: è quella della pagina Oggi
//  (crm/MeetGiornalieri), con davanti la domanda sui soldi che qui serve e là
//  no. ⚠️ Quando quello che si disfa è la VENDITA si porta via anche la posa
//  programmata — giorno, ora, chi la esegue, driver — perché un intervento che
//  non esiste più non può restare a occupare un'agenda. Le due righe qui sotto
//  lo mostrano da sole: senza giorno tornano a dire «in attesa di una data» e
//  «tecnico da assegnare», che è il punto in cui quella pratica è davvero
//  tornata.
//  ⚠️ E QUANDO LO STATO CHE TORNA DICHIARA UN'ALTRA CONSEGNA — «Nel nostro
//  centro» su una posa a domicilio — LA RIGA ESCE DA QUESTA SCHEDA. Queste due
//  schede filtrano per MODO di consegna, non per stato: finché il ritorno
//  indietro scriveva il solo stato, la riga restava qui identica e il pulsante
//  sembrava non aver fatto niente. Quello che era stato scritto a mano —
//  indirizzo, tracciamento, costo del viaggio — non si cancella: cambia la
//  scheda in cui la riga si vede, non il lavoro che c'è dentro.
//  Vedi crm/TornaIndietroPosa e `consegnaDaAllineare` in crm/spedizione.
import { TornaIndietroPosa } from "./TornaIndietroPosa";
//  Il pulsante con dentro la miniatura delle foto del cliente: apre il
//  carosello (e, quando non c'è ancora niente, invita a caricare). Le due righe
//  di questa pagina lo portano come lo porta la riga delle installazioni — è la
//  stessa fila di segni accanto al nome. Vedi crm/portfolio/Visore.
import { SegnoMedia } from "./portfolio/Visore";
//  ── «DA ANTICIPARE», IDENTICO A COME SI VEDE IN «INSTALLAZIONI» ───────────
//  Stesso cartellino e stesso pulsante, importati e non ridisegnati: due
//  disegni della stessa cosa divergono al primo ritocco, e il giorno in cui il
//  viola di qua non è più il viola di là il segno smette di essere riconosciuto
//  a colpo d'occhio — che è l'unica cosa che gli si chiede.
//  `primaLeAnticipate` non riordina l'elenco: aggiunge uno strato sopra
//  l'ordine che queste due schede hanno già (vedi `ordinaSpedizioni` e
//  `ordinaDomicili`), e lo lascia intatto per tutto quello che non è in cima.
//  ⚠️ CHI SALE NON È LO STESSO NELLE DUE SCHEDE, e le due domande si importano
//  tutte e due apposta: `daAnticipare` per i pacchi (nessun appuntamento da
//  rispettare) e `inCimaAllElenco` per il domicilio (una trasferta già fissata
//  non si sposta — è la stessa regola di «Installazioni»).
import { daAnticipare, inCimaAllElenco, primaLeAnticipate } from "./priorita";
import { SegnoPriorita, TastoPriorita } from "./PrioritaPosa";
//  ── LA FATTURA, ANCHE DA QUI ──────────────────────────────────────────────
//   ⚠️ Mancava, ed è la segnalazione del committente: queste pratiche sono
//    VENDUTE — un pacco si spedisce dopo che è stato pagato — e la fattura è
//    la cosa che viene subito dopo. Chi lavora la coda dei pacchi (o quella
//    dei domicili) non deve cambiare pagina per emetterla: il pulsante decide
//    da sé quando comparire (serve una cifra da fatturare), ed è lo STESSO
//    componente dell'elenco delle pose e della scheda cliente — una seconda
//    versione qui vorrebbe dire due finestre della fattura da tenere allineate.
import { TastoFattura } from "./fatture/TastoFattura";
import {
  costoViaggio,
  haIndirizzo,
  indirizzoProposto,
  indirizzoScritto,
  ordinaSpedizioni,
  spedita,
  spedizioneDi,
  totaleCostiViaggio,
  useAzioniSpedizione,
} from "./spedizione";
import {
  ArrowUpToLine,
  Car,
  Check,
  CheckCircle2,
  House,
  MapPin,
  Package,
  PackageCheck,
  MessageCircle,
  Phone,
  Truck,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   1. I DUE ELENCHI — quelle che devono partire, quelle già partite
   ═════════════════════════════════════════════════════════════════════════ */

export function SpedizioniPannello({
  spedizioni,
  onApri,
}: {
  spedizioni: Lead[];
  onApri: (l: Lead) => void;
}) {
  const ordinate = ordinaSpedizioni(spedizioni);
  //  ⚠️ LE ANTICIPATE SALGONO SOLO FRA I PACCHI ANCORA FERMI, e la ragione è la
  //  stessa per cui «Spedite» esiste come sezione separata: quell'elenco non è
  //  una coda di lavoro, è il posto in cui si risponde a "dov'è il mio pacco?".
  //  Riordinarlo per priorità vorrebbe dire spostare righe che nessuno deve più
  //  lavorare, e far perdere il pacco che si sta cercando.
  const daFare = primaLeAnticipate(ordinate.filter((l) => !spedita(l)));
  const fatte = ordinate.filter((l) => spedita(l));
  const senzaIndirizzo = daFare.filter((l) => !haIndirizzo(l)).length;
  //  Il conteggio in testa alla scheda è ciò che spiega l'ordine: senza, le
  //  righe in cima sembrano capitate lì da sole e il primo sospetto è che
  //  l'ordinamento sia rotto.
  const anticipate = daFare.filter((l) => daAnticipare(l)).length;
  const totale = totaleDaIncassare(daFare);

  return (
    <>
      <Scheda
        icona={Package}
        titolo="Da spedire"
        nota={
          daFare.length === 0
            ? "Nessun pacco in attesa"
            : `${daFare.length} ${daFare.length === 1 ? "pacco" : "pacchi"} in attesa · ${
                totale > 0 ? `${eur(totale)} da incassare` : "niente da incassare"
              }`
        }
        azioni={
          senzaIndirizzo > 0 || anticipate > 0 ? (
            <>
              {/*  Il viola è lo stesso di «Installazioni» apposta: il segno si
                  riconosce prima di leggerlo, e cambiarlo qui vorrebbe dire
                  insegnarlo due volte. */}
              {anticipate > 0 && (
                <Chip
                  tono="neutro"
                  icona={ArrowUpToLine}
                  className="border-violet-300 bg-violet-50 text-violet-700"
                  title="Messe in cima a mano, dal pulsante ↑ della riga. Si tolgono dallo stesso pulsante"
                >
                  {anticipate} da anticipare
                </Chip>
              )}
              {senzaIndirizzo > 0 && (
                <Chip tono="in_sospeso" punto>
                  {senzaIndirizzo} senza indirizzo
                </Chip>
              )}
            </>
          ) : undefined
        }
        senzaPadding
        classeCorpo="divide-y divide-border"
      >
        {daFare.length === 0 ? (
          <VuotoRiga testo="Nessuna pratica da spedire: si segnano dal menu «…» di una riga delle installazioni." />
        ) : (
          daFare.map((l) => <RigaSpedizione key={l.id} lead={l} onApri={onApri} />)
        )}
      </Scheda>

      {/*  Le spedite restano sotto, non spariscono: è dove si guarda quando il
          cliente chiama e chiede dov'è il pacco. */}
      {fatte.length > 0 && (
        <Scheda
          icona={PackageCheck}
          titolo="Spedite"
          nota={`${fatte.length} ${fatte.length === 1 ? "pacco partito" : "pacchi partiti"}`}
          senzaPadding
          classeCorpo="divide-y divide-border"
        >
          {fatte.map((l) => (
            <RigaSpedizione key={l.id} lead={l} onApri={onApri} />
          ))}
        </Scheda>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1 bis. A DOMICILIO — le pose che si fanno a casa del cliente
   ═════════════════════════════════════════════════════════════════════════ */

/** ── L'ORDINE DI LAVORO DEL DOMICILIO ─────────────────────────────────────
 *  Prima quelle ancora da fare, e fra queste prima quelle SENZA INDIRIZZO:
 *  sono ferme per un dato mancante, e finché manca non si può nemmeno chiudere
 *  la pratica. Poi per giorno, dal più vicino; chi non ha ancora una data va in
 *  fondo alle aperte, perché il suo passo successivo è programmarla. Le fatte
 *  restano in coda, dalla più recente.
 *
 *  ⚠️ "Fatta" è `posaCompletata`, la stessa definizione dell'elenco pose e
 *  dell'archivio: una seconda regola scritta qui avrebbe fatto risultare una
 *  posa chiusa di là e aperta di qua. */
function ordinaDomicili(items: Lead[]): Lead[] {
  return [...items].sort((a, b) => {
    const fa = posaCompletata(a);
    const fb = posaCompletata(b);
    if (fa !== fb) return fa ? 1 : -1;
    const ga = a.data.installazione?.dataInstallazione || "";
    const gb = b.data.installazione?.dataInstallazione || "";
    if (!fa) {
      const ia = haIndirizzo(a) ? 1 : 0;
      const ib = haIndirizzo(b) ? 1 : 0;
      if (ia !== ib) return ia - ib;
      //  Senza data in fondo alle aperte: "" ordinato come stringa finirebbe in
      //  cima, cioè prima della posa di stamattina.
      if (!ga !== !gb) return ga ? -1 : 1;
      return (
        ga.localeCompare(gb) ||
        String(a.data.cognome || "").localeCompare(String(b.data.cognome || ""))
      );
    }
    return gb.localeCompare(ga);
  });
}

/** Le pose a domicilio, con lo stesso disegno dei pacchi: quelle da fare sopra,
 *  quelle già fatte sotto — dove si guarda quando il cliente richiama. */
export function DomicilioPannello({
  domicili,
  consulenti,
  onApri,
  onProgramma,
}: {
  domicili: Lead[];
  consulenti: Consultant[];
  onApri: (l: Lead) => void;
  onProgramma: (l: Lead) => void;
}) {
  const ordinate = ordinaDomicili(domicili);
  //  ⚠️ LE ANTICIPATE PASSANO DAVANTI ANCHE A CHI NON HA L'INDIRIZZO, e questo
  //  scavalca la prima regola di `ordinaDomicili`. È voluto: «senza indirizzo
  //  in cima» è un criterio che la pagina applica da sola a tutte le righe,
  //  «Da anticipare» è una persona che ha deciso su UNA riga dopo aver parlato
  //  col cliente. Una decisione presa a mano non può essere ribaltata da un
  //  automatismo, altrimenti il pulsante «Anticipa» a volte funziona e a volte
  //  no — e un comando che obbedisce a intermittenza smette di essere usato.
  //  Sotto le anticipate l'ordine di lavoro resta esattamente quello di prima.
  //
  //  ⚠️ MA SALGONO SOLO LE TRASFERTE SENZA UN GIORNO — `inCimaAllElenco`, la
  //  stessa domanda dell'elenco delle installazioni, e non `daAnticipare`. Una
  //  posa a domicilio GIÀ FISSATA è un appuntamento con una persona: la sua
  //  posizione fra le altre è ciò che dice quando bisogna partire, e portarla
  //  in testa metteva la trasferta del mese prossimo sopra quella di domani
  //  proprio nella scheda con cui le trasferte si preparano. Era anche la
  //  stessa riga che si comportava in due modi in due lenti della stessa
  //  pagina: di là restava nella sua giornata, di qua saliva. Il cartellino
  //  viola resta comunque sulla riga, al suo posto nell'ordine — che è tutto
  //  quello che serve quando il giorno c'è già.
  const daFare = primaLeAnticipate(
    ordinate.filter((l) => !posaCompletata(l)),
    inCimaAllElenco,
  );
  const fatte = ordinate.filter((l) => posaCompletata(l));
  const senzaIndirizzo = daFare.filter((l) => !haIndirizzo(l)).length;
  //  Il chip conta CHI È SALITO DAVVERO, non chi porta il segno: contare anche
  //  le trasferte già fissate avrebbe promesso in testa righe che stanno a metà
  //  elenco, ed è esattamente il modo in cui una pastiglia smette di spiegare
  //  l'ordine e comincia a farlo sembrare rotto.
  const anticipate = daFare.filter((l) => inCimaAllElenco(l)).length;
  const totale = totaleDaIncassare(daFare);
  //  ⚠️ Il viaggio si dice SEPARATO dal "da incassare", e con la parola che lo
  //  qualifica: due cifre in euro affiancate senza aggettivo si leggono tutte e
  //  due come denaro che entra, e questa è un'uscita.
  const viaggi = totaleCostiViaggio(daFare);

  return (
    <>
      <Scheda
        icona={House}
        titolo="A domicilio"
        nota={
          daFare.length === 0
            ? "Nessuna posa a domicilio in attesa"
            : `${daFare.length} ${daFare.length === 1 ? "posa" : "pose"} a casa del cliente · ${
                totale > 0 ? `${eur(totale)} da incassare` : "niente da incassare"
              }${viaggi > 0 ? ` · ${eur(viaggi)} di viaggio, che è un costo` : ""}`
        }
        azioni={
          senzaIndirizzo > 0 || anticipate > 0 ? (
            <>
              {anticipate > 0 && (
                <Chip
                  tono="neutro"
                  icona={ArrowUpToLine}
                  className="border-violet-300 bg-violet-50 text-violet-700"
                  title="Messe in cima a mano, dal pulsante ↑ della riga. Si tolgono dallo stesso pulsante"
                >
                  {anticipate} da anticipare
                </Chip>
              )}
              {senzaIndirizzo > 0 && (
                <Chip tono="in_sospeso" punto>
                  {senzaIndirizzo} senza indirizzo
                </Chip>
              )}
            </>
          ) : undefined
        }
        senzaPadding
        classeCorpo="divide-y divide-border"
      >
        {daFare.length === 0 ? (
          <VuotoRiga testo="Nessuna posa a domicilio: si segnano dal menu «…» di una riga delle installazioni." />
        ) : (
          daFare.map((l) => (
            <RigaDomicilio
              key={l.id}
              lead={l}
              tecnico={nomeTecnico(l, consulenti)}
              //  Il nome si risolve QUI, dove l'elenco dei consulenti c'è già:
              //  la riga riceve una stringa e non cerca nessuno, esattamente
              //  come fa da sempre per il tecnico.
              driver={nomeDriver(l, consulenti)}
              //  Chi affianca esce dalla stessa porta e nello stesso punto: su
              //  una posa a domicilio sapere che vanno in due a lavorare (e non
              //  solo che qualcuno guida) è metà del motivo per cui si guarda
              //  questa lente prima di preparare le trasferte.
              accompagnatore={nomeAccompagnatore(l, consulenti)}
              onApri={onApri}
              onProgramma={onProgramma}
            />
          ))
        )}
      </Scheda>

      {fatte.length > 0 && (
        <Scheda
          icona={CheckCircle2}
          titolo="Fatte"
          nota={`${fatte.length} ${fatte.length === 1 ? "posa completata" : "pose completate"}`}
          senzaPadding
          classeCorpo="divide-y divide-border"
        >
          {fatte.map((l) => (
            <RigaDomicilio
              key={l.id}
              lead={l}
              tecnico={nomeTecnico(l, consulenti)}
              driver={nomeDriver(l, consulenti)}
              //  Anche sulle pose già fatte: chi c'era è un dato che resta, e
              //  una riga d'archivio che perde metà della squadra racconta un
              //  lavoro fatto da meno persone di quelle che ci sono andate.
              accompagnatore={nomeAccompagnatore(l, consulenti)}
              onApri={onApri}
              onProgramma={onProgramma}
            />
          ))}
        </Scheda>
      )}
    </>
  );
}

/** La riga di una posa a domicilio. Due livelli come quella dei pacchi, ma il
 *  primo porta QUANDO e CHI CI VA — perché questa è una posa a tutti gli
 *  effetti, occupa un tecnico e sta in agenda — e il secondo porta i due dati
 *  che una posa in sede non ha: l'indirizzo e il costo del viaggio. */
function RigaDomicilio({
  lead,
  tecnico,
  driver,
  accompagnatore,
  onApri,
  onProgramma,
}: {
  lead: Lead;
  tecnico: string;
  /** il nome di chi dà il passaggio, "" se ci va da solo */
  driver: string;
  /** il nome di chi va a posare INSIEME all'installatore, "" se posa da solo.
   *  ⚠️ Mestiere diverso dal driver e persona diversa: si mostrano tutti e due
   *  quando ci sono tutti e due, altrimenti la riga dice che escono in due
   *  mentre a uscire sono in tre. */
  accompagnatore: string;
  onApri: (l: Lead) => void;
  onProgramma: (l: Lead) => void;
}) {
  const inst = lead.data.installazione;
  const giorno = inst?.dataInstallazione || "";
  const conData = !!giorno;
  const fatta = posaCompletata(lead);
  const oggi = conData && giorno === giornoISO();
  const attesa = giorniDiAttesa(lead);
  const dove = indirizzoScritto(lead);
  const daAssegnare = senzaTecnico(lead) && !fatta;

  //  Le stesse parole della riga delle installazioni: il giorno e l'ora se ci
  //  sono, altrimenti da quanto tempo la pratica aspetta una data.
  const quando = conData
    ? `${dataBreve(giorno)} · ${inst?.orarioInstallazione || "orario da fissare"}`
    : attesa === null
      ? "in attesa di una data"
      : attesa === 0
        ? "in attesa da oggi"
        : `in attesa da ${attesa} ${attesa === 1 ? "giorno" : "giorni"}`;
  const quandoManca = (!conData || !inst?.orarioInstallazione) && !fatta;

  return (
    <div className="px-3 py-2">
      {/* CHI · QUANDO · CHI CI VA · QUANTO RESTA */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-[11rem]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onApri(lead)}
              className="truncate text-[13px] font-semibold leading-tight hover:underline"
            >
              {nomeCompleto(lead)}
            </button>
            {oggi && <BadgeOggi />}
            {/*  IL CARTELLINO DELLA PRIORITÀ, nello stesso posto della riga di
                «Installazioni»: subito dopo il nome, prima di ogni altro segno.
                ⚠️ Qui accanto c'è già il giorno della posa, due centimetri più
                sotto: è esattamente il posto in cui le due date si possono
                confondere, ed è il motivo per cui quella desiderata si scrive
                sempre col verbo — «vorrebbe il 20 gen». Vedi crm/PrioritaPosa. */}
            <SegnoPriorita lead={lead} />
            {fatta && (
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                aria-label="Eseguita"
              />
            )}
            {/*  Le stesse note dell'elenco pose: qui valgono doppio, perché
                quello che è stato detto a voce ("cane in giardino", "citofono a
                nome della figlia") è ciò che fa suonare al campanello giusto. */}
            <SegnoNote lead={lead} />
            {/*  IL SEGNO DEL DRIVER, come nell'elenco delle pose. Qui serve più
                che altrove: una posa a domicilio con un driver è una macchina in
                meno per tutto il resto della giornata, e questa lente è proprio
                quella che si guarda per preparare le trasferte. Senza, il segno
                si vedeva in «Installazioni» e spariva passando ad «A domicilio»
                — cioè proprio dove quelle pose vivono. */}
            <SegnoDriver nome={driver} />
            {/*  E IL SEGNO DI CHI AFFIANCA, accanto a quello del driver: su una
                trasferta è l'altra metà della squadra che esce, e senza si
                preparava la giornata credendo di avere libera un'agenda che
                quel pomeriggio era già impegnata sulla stessa posa. */}
            <SegnoAccompagnatore nome={accompagnatore} />
            {/*  IL PORTAFOGLIO DEL CLIENTE, identico alla riga delle pose in
                sede. È il punto in cui il segno vale di più: una posa a
                domicilio la fa un installatore che non ha visto il cliente in
                consulenza, e le foto sono l'unico modo che ha di sapere da
                dove si parte prima di suonare al campanello. */}
            <SegnoMedia lead={lead} />
          </div>
          <div className="truncate text-[11.5px] leading-snug text-muted-foreground">
            <span
              className={cn(
                "font-medium tabular-nums",
                quandoManca ? "text-amber-700" : "text-foreground",
              )}
            >
              {quando}
            </span>
            {" · "}
            <span className={cn(daAssegnare && "text-amber-700")}>
              {daAssegnare ? "installatore da assegnare" : tecnico}
            </span>
            {!fatta && !dove && <span className="text-amber-700"> · manca l&apos;indirizzo</span>}
          </div>
        </div>

        <ImportoRiga lead={lead} />

        {/*  Gli stessi comandi delle installazioni — Programma se la data non
            c'è, Completa se c'è, telefono, menu "…" — con una regola in più:
            senza indirizzo "Completa" resta spento, come "Spedisci" di là.
            Il motivo è scritto per essere letto in tutti e due i posti in cui
            compare (il pulsante e la voce del menu «…»), quindi non dice "qui
            sotto": dentro la finestra del menu non ci sarebbe niente, sotto. */}
        {/*  Il ritorno indietro sta a SINISTRA del comando principale e dentro
            lo stesso gruppo: è un rimedio, non un'azione della giornata, e
            messo dopo "Completa" verrebbe premuto per sbaglio da chi cerca il
            menu «…». Compare solo dove c'è davvero uno stato a cui tornare.
            ⚠️ Su una posa a domicilio è il gesto che ne toglie anche il giorno
            e chi ci va: se la vendita si disfa, la riga qui sopra torna «in
            attesa di una data» e la trasferta non è più in programma per
            nessuno. E se lo stato che torna è «Nel nostro centro», la riga
            sparisce da questa scheda: quella pratica non è più una consegna a
            casa del cliente, e lasciarla qui vorrebbe dire preparare una
            trasferta che nessuno ha più chiesto. L'indirizzo e il costo del
            viaggio non si cancellano, ma i due campi qui sotto sono l'unico
            posto in cui si leggono: uscita di qui, il viaggio resta a carico
            della vendita (il margine lo sottrae comunque) senza che si veda più.
            Il messaggio del gesto lo dice — vedi `raccontaConsegna` in
            crm/TornaIndietroPosa. */}
        <div className="flex shrink-0 items-center gap-1">
          {/*  ── ANTICIPA ────────────────────────────────────────────────────
              Per primo nel gruppo, come nell'elenco delle pose: è il comando
              più lontano da quello principale perché non tocca la pratica —
              cambia solo dove si legge, e si disfa dallo stesso pulsante.
              ⚠️ STA QUI E NON SOLO IN «Installazioni» perché queste pose a
              domicilio si lavorano DA QUESTA SCHEDA: un pulsante che esiste
              nell'elenco generale e sparisce nella lente in cui si passa la
              giornata costringe a cambiare pagina per un gesto da un tocco —
              e un gesto che costa un cambio di pagina non si fa. */}
          <TastoPriorita lead={lead} />
          <TornaIndietroPosa lead={lead} />
          {/*  Vedi la nota sull'import: una posa a domicilio è venduta, e la
              fattura si emette da dove si sta lavorando. */}
          <TastoFattura lead={lead} />
          <AzioniInstallazione
            lead={lead}
            onApri={onApri}
            onProgramma={onProgramma}
            bloccata={dove ? undefined : "Manca l'indirizzo: scrivilo sulla riga, sotto il nome"}
          />
        </div>
      </div>

      {/* DOVE · QUANTO COSTA ANDARCI — si scrivono qui, senza aprire niente */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <CampoIndirizzo lead={lead} etichetta="Indirizzo del cliente" />
        <CampoCostoViaggio lead={lead} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LA RIGA — due livelli: chi/quanto sopra, dove/tracciamento sotto
   ═════════════════════════════════════════════════════════════════════════ */

function RigaSpedizione({ lead, onApri }: { lead: Lead; onApri: (l: Lead) => void }) {
  const { segnaSpedito } = useAzioniSpedizione();
  const sped = spedizioneDi(lead);
  const partito = sped.spedito;
  //  "Ha l'indirizzo" vuol dire una cosa sola in tutta la pagina: che è SCRITTO.
  //  La città proposta nel campo non basta a far partire un pacco.
  const dove = indirizzoScritto(lead);

  return (
    <div className="px-3 py-2">
      {/* CHI · QUANTO RESTA · È PARTITO */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-[11rem]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onApri(lead)}
              className="truncate text-[13px] font-semibold leading-tight hover:underline"
            >
              {nomeCompleto(lead)}
            </button>
            {partito && <PackageCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
            {/*  ⚠️ QUI «FINITO» VUOL DIRE PARTITO, non «posa fatta»: un pacco
                spedito non è `posaCompletata` — nessuno gli ha installato
                niente — quindi il cartellino da solo sarebbe rimasto acceso
                sotto «Spedite», su righe per cui non c'è più niente da
                anticipare. La domanda che chiude la riga la passa la scheda,
                perché è la scheda a sapere qual è. */}
            <SegnoPriorita lead={lead} chiusa={partito} />
            {/*  Le stesse note dell'elenco pose: qui servono soprattutto per
                l'indirizzo detto a voce ("lasciare dal vicino", "citofono a
                nome della figlia"), che è l'unica cosa che fa tornare indietro
                un pacco. */}
            <SegnoNote lead={lead} />
            {/*  IL PORTAFOGLIO DEL CLIENTE. Sta anche qui — e non solo dove
                c'è una posa — perché un segno che compare in una scheda e
                sparisce nell'altra insegna che il dato non c'è: chi passa da
                «Installazioni» a «Da spedire» smetterebbe di cercarlo. Su un
                pacco le foto sono per lo più quelle mandate dal cliente per
                scegliere il colore, ed è l'unico posto da cui si riguardano
                prima di far partire il materiale. */}
            <SegnoMedia lead={lead} />
          </div>
          {/*  Il giorno della partenza NON si scrive qui: sta nel campo della
              data, sotto, dove si può anche correggere. Scriverlo in tutti e due
              i posti sarebbe lo stesso dato detto due volte a un centimetro di
              distanza. */}
          <div
            className={cn(
              "truncate text-[11.5px] leading-snug",
              !partito && !dove ? "text-amber-700" : "text-muted-foreground",
            )}
          >
            {partito ? "Partito" : dove ? "Pronto da spedire" : "Manca l'indirizzo"}
            {lead.data.telefono ? ` · ${lead.data.telefono}` : ""}
          </div>
        </div>

        <ImportoRiga lead={lead} />

        <div className="flex shrink-0 items-center gap-1">
          {/*  Stessa posizione della riga del domicilio: prima del comando
              principale, che qui è "Spedisci" invece di "Completa".
              ⚠️ Qui il pacco cambia le cose: finché deve ancora partire, uno
              stato che dichiara un'altra consegna porta la riga fuori da questa
              scheda (indirizzo e tracciamento restano scritti, e il messaggio
              lo dice). Se invece è GIÀ PARTITO non si muove niente: una
              spedizione avvenuta è un fatto, e questa è l'unica pagina da cui
              si può ancora rispondere al cliente che chiede dov'è. */}
          {/*  «Anticipa» per primo, come nelle altre due righe. Su un pacco
              vuol dire «imballalo e mandalo prima degli altri»: non c'è nessuna
              agenda da spostare, ed è proprio il caso in cui il gesto costa
              meno e serve di più. Sparisce a pacco partito, insieme al
              cartellino: lasciare il pulsante senza il segno — o il segno senza
              il pulsante — è il modo di ritrovarsi righe in cima che nessuno
              sa più togliere. */}
          <TastoPriorita lead={lead} chiusa={partito} />
          <TornaIndietroPosa lead={lead} />
          {partito ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-emerald-500/40 text-[11.5px] text-emerald-700"
              onClick={() => void segnaSpedito(lead, false)}
              title="Segna che non è ancora partito"
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Spedito
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-[11.5px]"
              onClick={() => void segnaSpedito(lead, true)}
              disabled={!dove}
              title={
                dove
                  ? "Segna il pacco come partito, con la data di oggi"
                  : "Conferma prima l'indirizzo qui sotto"
              }
            >
              <Truck className="mr-1 h-3.5 w-3.5" /> Spedisci
            </Button>
          )}
          {lead.data.telefono && (
            <Button asChild size="sm" variant="outline" className="h-7 w-7 p-0" title="Chiama">
              <a href={`tel:${lead.data.telefono}`} aria-label={`Chiama ${nomeCompleto(lead)}`}>
                <Phone className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {/*  Anche qui accanto alla cornetta, come sulle righe delle pose: è
               lo stesso gesto e deve stare nello stesso posto, o su due schede
               della stessa pagina lo si cerca in due punti diversi.
               È `scriviSuWhatsApp`, la stessa funzione della voce nel menu «…»
               che questa riga monta già: nessun secondo testo da mantenere. */}
          {lead.data.telefono && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => scriviSuWhatsApp(lead)}
              title="Scrivi su WhatsApp"
              aria-label={`Scrivi su WhatsApp a ${nomeCompleto(lead)}`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          {/*  La fattura: solo l'icona, come nell'elenco delle pose. Con la
              parola sarebbero tre pulsanti di testo per riga a contendersi
              l'attenzione con «Spedisci», che qui è il comando della
              giornata. */}
          <TastoFattura lead={lead} />
          {/*  Lo stesso menu delle installazioni: da lì si riporta la pratica
              fra le pose, si apre la scheda, si scrive al cliente. Niente
              "Programma": una spedizione non ha un orario. */}
          <TastoAltreAzioni lead={lead} onApri={onApri} />
        </div>
      </div>

      {/* DOVE — si scrive qui, senza aprire niente. Il giorno della partenza
          compare solo dopo, quando c'è qualcosa da correggere. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <CampoIndirizzo lead={lead} />
        {partito && <CampoDataSpedizione lead={lead} />}
        <CampoTracking lead={lead} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. I CAMPI CHE SI SCRIVONO SUL POSTO
   ═════════════════════════════════════════════════════════════════════════ */

/** L'indirizzo. Si salva uscendo dal campo o con Invio; la spunta verde dice
 *  che quello che si legge è anche quello che è scritto nella scheda.
 *
 *  IL RIPIEGO SULLA CITTÀ
 *  Se non è mai stato scritto un indirizzo si parte dalla città della scheda:
 *  è l'unico pezzo che l'archivio importato porta con sé, e ricopiarla a mano
 *  su duecento righe sarebbe lavoro inventato. Finché non si conferma resta un
 *  suggerimento: la spunta non c'è, il segno resta ambra e "Spedisci" è spento.
 *  Confermarla costa un tocco nel campo e un Invio. */
function CampoIndirizzo({ lead, etichetta }: { lead: Lead; etichetta?: string }) {
  const { salvaIndirizzo } = useAzioniSpedizione();
  const salvatoInScheda = indirizzoScritto(lead);
  const proposto = indirizzoProposto(lead);
  const [testo, setTesto] = useState(proposto);

  //  Se il dato cambia da fuori (un altro utente, un altro pannello) il campo
  //  si riallinea: mostrare a video una via diversa da quella salvata è il modo
  //  più sicuro di spedire nel posto sbagliato.
  useEffect(() => {
    setTesto(proposto);
  }, [proposto]);

  const pulito = testo.trim();
  const allineato = !!pulito && pulito === salvatoInScheda.trim();
  const salva = () => {
    if (pulito === salvatoInScheda.trim()) return;
    void salvaIndirizzo(lead, pulito);
  };

  /*  ── ⚠️ IL SUGGERIMENTO SERVE QUI PIÙ CHE ALTROVE ─────────────────────
      Su una fattura un indirizzo sbagliato lo scarta lo SDI e se ne riparla.
      Qui invece parte un PACCO: un civico o un CAP storto non danno nessun
      errore, danno una consegna che non arriva, un cliente che chiama e una
      spedizione da rifare a spese nostre.
      ⚠️ Il comportamento — l'attesa, l'annullamento, il non ricercare quello
       che si è appena scelto — sta nel gancio condiviso, lo stesso della
       fattura e del preventivo. Qui c'è solo il disegno, e il salvataggio,
       che in questo campo avviene uscendo. */
  const { suggerimenti, aperto, cercando, riapri, chiudi, scritto, scelto } = useIndirizziSuggeriti(
    testo,
    lead.data?.citta,
  );

  return (
    <label className="relative flex min-w-0 flex-1 basis-[16rem] items-center gap-1.5">
      {/*  Il colore è un segnale, non una decorazione: ambra finché quello che
          si legge non è anche quello che è scritto in scheda — sia che il campo
          sia vuoto, sia che porti la città proposta o una correzione non ancora
          salvata. */}
      <MapPin
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          allineato ? "text-muted-foreground" : "text-amber-600",
        )}
      />
      <span className="sr-only">
        {etichetta || "Indirizzo di spedizione"} di {nomeCompleto(lead)}
      </span>
      <span className="relative min-w-0 flex-1">
        <Input
          value={testo}
          onChange={(e) => {
            scritto();
            setTesto(e.target.value);
          }}
          onFocus={riapri}
          //  ⚠️ Il salvataggio resta sull'uscita dal campo, com'era. Scegliendo
          //   un suggerimento il fuoco NON si perde (`preventDefault` sul
          //   mousedown), quindi lì si salva a mano: senza, l'indirizzo scelto
          //   sarebbe rimasto a schermo e non in scheda — cioè la spunta verde
          //   assente su un campo che sembra pieno.
          onBlur={() => {
            window.setTimeout(chiudi, 150);
            salva();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder="Via, civico, CAP, città"
          autoComplete="off"
          className={cn(
            "h-7 w-full min-w-0 rounded-md border-border bg-card text-[12px]",
            !pulito && "border-amber-500/40",
          )}
        />
        {cercando && !aperto && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            cerco…
          </span>
        )}
        {aperto && suggerimenti.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full min-w-[16rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggerimenti.map((sg, i) => (
              <li key={`${sg.esteso}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    scelto(sg);
                    setTesto(sg.esteso);
                    //  ⚠️ Si salva SUBITO e con il valore scelto, non con
                    //   `salva()`: quella funzione legge `testo`, che in questo
                    //   istante è ancora quello di prima.
                    if (sg.esteso.trim() !== salvatoInScheda.trim()) {
                      void salvaIndirizzo(lead, sg.esteso.trim());
                    }
                  }}
                  className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-[12px] transition hover:bg-slate-50"
                >
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {[sg.indirizzo, sg.civico].filter(Boolean).join(" ")}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {[sg.cap, sg.comune, sg.provincia && `(${sg.provincia})`]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </span>
      {/*  Spunta = scritto nella scheda. È l'unica conferma: una notifica per
          ogni civico corretto sarebbe rumore continuo. */}
      <Check
        className={cn(
          "h-3.5 w-3.5 shrink-0 text-emerald-600 transition-opacity",
          allineato ? "opacity-100" : "opacity-0",
        )}
      />
    </label>
  );
}

/** Il giorno in cui il pacco è partito. "Spedisci" ci mette oggi da solo —
 *  chiederlo sarebbe una finestra per scrivere la risposta di quasi sempre — ma
 *  chi registra stamattina la spedizione di ieri sera deve poterlo correggere,
 *  e questo è l'unico posto in cui quella data si legge. Qui il campo `date` va
 *  bene: le date non hanno la virgola, il problema dei campi numerici. */
function CampoDataSpedizione({ lead }: { lead: Lead }) {
  const { cambiaDataSpedizione } = useAzioniSpedizione();
  const data = spedizioneDi(lead).dataSpedizione;

  return (
    <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
      <PackageCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      <span className="sr-only">Giorno della spedizione</span>
      <input
        type="date"
        value={data}
        onChange={(e) => void cambiaDataSpedizione(lead, e.target.value)}
        className="h-7 rounded-md border border-border bg-card px-1.5 text-[12px] tabular-nums text-foreground outline-none"
      />
    </label>
  );
}

/** ── QUANTO COSTA ANDARCI ─────────────────────────────────────────────────
 *  Benzina, pedaggi, ore di strada. Si scrive sulla riga come l'indirizzo e si
 *  salva uscendo dal campo o con Invio; la spunta verde dice che è scritto.
 *
 *  ⚠️ CAMPO DI TESTO, MAI `type="number"`
 *  In italiano i decimali si scrivono con la virgola e le migliaia col punto
 *  (1.250,50): un campo numerico la virgola la rifiuta, sul telefono apre una
 *  tastiera senza, e con la rotellina cambia il valore mentre si scorre la
 *  pagina. La lettura la fa leggiEuro, la stessa di tutti gli importi del CRM.
 *
 *  ⚠️ QUESTO NUMERO NON È UN INCASSO. Non entra nei tre numeri accanto (già
 *  versato · totale · resta), non si somma al saldo e non tocca la cassa: va
 *  fra i COSTI della pratica, quelli che il netto sottrae. Per questo il campo
 *  sta qui in fondo e non dentro il blocco dell'importo — vicino ai soldi che
 *  entrano si leggerebbe come soldi che entrano. */
function CampoCostoViaggio({ lead }: { lead: Lead }) {
  const { salvaCostoViaggio } = useAzioniSpedizione();
  const salvato = costoViaggio(lead);
  const [testo, setTesto] = useState(() => (salvato > 0 ? scriviEuro(salvato) : ""));

  //  Se il dato cambia da fuori il campo si riallinea: mostrare una cifra
  //  diversa da quella salvata è il modo più silenzioso di sbagliare un costo.
  useEffect(() => {
    setTesto(salvato > 0 ? scriviEuro(salvato) : "");
  }, [salvato]);

  const scritto = Math.max(0, leggiEuro(testo));
  const allineato = scritto > 0 && scritto === salvato;
  const salva = () => {
    if (scritto === salvato) return;
    void salvaCostoViaggio(lead, scritto);
  };

  return (
    <label
      className="flex shrink-0 items-center gap-1.5"
      title="Costo del viaggio: è un'uscita della pratica, non si incassa dal cliente"
    >
      <Car
        className={cn("h-3.5 w-3.5 shrink-0", allineato ? "text-muted-foreground" : "opacity-60")}
      />
      <span className="sr-only">Costo del viaggio in euro per {nomeCompleto(lead)}</span>
      <span className="text-[12px] text-muted-foreground">€</span>
      <Input
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        onBlur={salva}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        inputMode="decimal"
        placeholder="Viaggio"
        className="h-7 w-[7.5rem] rounded-md border-border bg-card text-[12px] tabular-nums"
      />
      <Check
        className={cn(
          "h-3.5 w-3.5 shrink-0 text-emerald-600 transition-opacity",
          allineato ? "opacity-100" : "opacity-0",
        )}
      />
    </label>
  );
}

/** Il codice di tracciamento: facoltativo, si incolla e basta. */
function CampoTracking({ lead }: { lead: Lead }) {
  const { salvaTracking } = useAzioniSpedizione();
  const salvatoInScheda = spedizioneDi(lead).tracking;
  const [testo, setTesto] = useState(salvatoInScheda);

  useEffect(() => {
    setTesto(salvatoInScheda);
  }, [salvatoInScheda]);

  const salva = () => {
    if (testo.trim() === salvatoInScheda.trim()) return;
    void salvaTracking(lead, testo.trim());
  };

  return (
    <label className="flex shrink-0 items-center gap-1.5">
      <Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="sr-only">Codice di tracciamento</span>
      <Input
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        onBlur={salva}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="Tracciamento"
        className="h-7 w-[10.5rem] rounded-md border-border bg-card text-[12px]"
      />
    </label>
  );
}
