/** ─────────────────────────────────────────────────────────────────────────
 *  LA PROCEDURA GUIDATA DELLA MANUTENZIONE — tre passi, e finisce
 *
 *  QUANDO SI APRE
 *  Nel momento peggiore per fare domande: il tecnico ha appena finito la posa,
 *  il cliente è ancora seduto lì, e fra due minuti se ne va. Da questo vincolo
 *  discende tutto il resto — tre passi e non sei, nessun campo obbligatorio da
 *  scrivere a mano, e una via d'uscita in due tocchi per chi non può decidere
 *  adesso («solo promemoria»).
 *
 *  L'ORDINE DELLE DOMANDE
 *  È lo stesso principio della programmazione della posa
 *  (crm/InstallationScheduleDialog): ogni campo sta DOPO ciò che serve a
 *  compilarlo. Prima CHE RITORNO È — un ciclo o un intervento e basta —, poi
 *  COME lo si fissa, e solo dentro quella scelta chi lo esegue, il giorno,
 *  l'ora e chi altro ci va, in quest'ordine: gli orari escono dall'agenda di una
 *  persona, quindi la persona va scelta prima; e se qualcuno è libero in quella
 *  fascia si può chiedere solo quando la fascia esiste.
 *
 *  ⚠️⚠️ DUE STRADE, E LA SCELTA VIENE PRIMA DELLA CADENZA ────────────────────
 *  Fino a ieri il primo passo chiedeva «ogni quanto torna», e quella domanda
 *  dava per scontata la risposta a una domanda che nessuno aveva fatto: che il
 *  cliente entrasse in un giro di ritorni. Il committente ne vuole anche uno
 *  SOLO — un intervento e basta, senza impegnare il cliente a niente — e le due
 *  cose non sono lo stesso gesto con un interruttore in fondo:
 *   · CICLO DI RITORNI → si sceglie ogni quanto torna, il numero resta scritto
 *     sulla sua scheda e quando questo ritorno viene segnato fatto il CRM mette
 *     da solo il promemoria del successivo. È il caso di chi ha appena preso
 *     l'impianto;
 *   · INTERVENTO SINGOLO → un ritorno e basta. Nessuna cadenza scritta, e
 *     segnandolo fatto non nasce niente dopo.
 *  Sono DUE VOCI in cima al primo passo, con le stesse parole del riepilogo, e
 *  la cadenza compare sotto SOLO se si è scelto il ciclo: chiederla prima
 *  significherebbe far scegliere ogni quanto torna a chi sta dicendo che non
 *  torna. Un interruttore nascosto in fondo, o una spunta «non ripetere», si
 *  legge come un dettaglio di ciò che si è appena deciso — e questa non è un
 *  dettaglio, è l'altra metà della decisione.
 *
 *  I PASSI SONO SEMPRE TRE, IN TUTTI E QUATTRO I CASI
 *  Un passo mostrato solo a volte fa ballare la scala in cima e i numeri «2 di
 *  3» diventano «2 di 4» sotto le mani: è l'errore già evitato nella
 *  programmazione della posa, dove il quarto passo cambia NOME e non esiste in
 *  due versioni. Qui il primo e il secondo cambiano CONTENUTO — con «intervento
 *  singolo» sotto le due voci non compare la cadenza, con «solo promemoria» non
 *  compaiono giorno, ora e squadra — ma restano due passi, sempre gli stessi.
 *
 *  ⚠️ COSA BLOCCA DAVVERO L'AGENDA, E COSA NO
 *  Un promemoria non toglie tempo a nessuno: è una data attesa, e basta. Un
 *  appuntamento fissato ha giorno, ora e persone, e da quel momento toglie
 *  tempo come qualunque altro impegno — anche fuori di qui, nell'agenda del
 *  mese e negli orari che si offrono a un altro cliente (booking-utils conta
 *  anche le manutenzioni). Gli orari proposti e la disponibilità di chi affianca
 *  e di chi guida escono tutti da `booking-utils`, con le stesse regole di ogni
 *  altra schermata: giorni lavorativi, fasce, pause, indisponibilità, impegni
 *  presi, tempo per la strada. Qui non se ne scrive una seconda.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Car,
  Check,
  Clock,
  Repeat,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { useCRM } from "../CRMContext";
import {
  STRADA_ACCOMPAGNATORE,
  STRADA_DRIVER,
  generateAvailability,
  liberoNellaFascia,
} from "../booking-utils";
//  ⚠️ CHI AFFIANCA E CHI GUIDA SI CHIEDONO A CHI LO SA GIÀ. Queste due funzioni
//  esistono per le pose e leggono le spunte «fa l'accompagnatore» e «fa il
//  driver»: è lo STESSO mestiere fatto in un altro momento della giornata.
//  Riscriverne qui una coppia gemella avrebbe prodotto due elenchi che un giorno
//  divergono — una persona scegliibile sulla posa e non sul ritorno, senza che
//  nessuno riesca a dire perché.
import { accompagnatoriPossibili, driverPossibili } from "../InstallationScheduleDialog";
//  L'unico lettore delle spunte dei mestieri: serve a dire perché una persona è
//  in elenco pur non facendo (più) il manutentore.
import { mestieriDi } from "../kpi-setter";
import type {
  AppuntamentoManutenzione,
  Lead,
  OrigineManutenzione,
  TipoManutenzione,
} from "../types";
import { posaFatta } from "../types";
import {
  CLASSE_AREA,
  CLASSE_CAMPO,
  CampoFinestra,
  DatoFinestra,
  Finestra,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
  VoceScelta,
  VuotoFinestra,
} from "../ui/Finestra";
import { useAzioniManutenzione } from "./azioni";
import {
  CADENZE_GIORNI,
  DURATA_MANUTENZIONE,
  //  Le due strade si chiamano allo stesso modo qui, nel riepilogo e sulla riga
  //  della lente: è la ragione per cui la costante esiste. Riscritte a mano in
  //  tre punti, alla prima riformulazione diventano tre scelte diverse per chi
  //  legge — ed è già successo, questa costante era esportata e non la usava
  //  nessuno.
  ETICHETTA_TIPO_MANUTENZIONE,
  cadenzaDi,
  dataProposta,
  nuovoId,
  oggiISO,
  piuGiorni,
  tipoDi,
} from "./regole";
import { SenzaManutentori, manutentoriPossibili } from "./squadra";

/** Quanti giorni di agenda si guardano in avanti dal giorno previsto. Sei
 *  settimane: se in sei settimane quella persona non ha un buco, il problema non
 *  è questa finestra. */
const GIORNI_AVANTI = 42;

/** ── SI PUÒ ANCHE ANTICIPARE DI QUALCHE GIORNO ────────────────────────────
 *  La cadenza è un intorno, non una scadenza: «ogni due o quattro settimane».
 *  Partire esattamente dal giorno previsto avrebbe nascosto i tre giorni prima —
 *  cioè avrebbe fatto spostare in avanti un cliente che poteva venire il giovedì
 *  perché il venerdì era pieno. Indietro non si va mai oltre oggi.
 *  ⚠️ Non vale per l'intervento singolo: lì non c'è nessun giorno previsto da
 *  anticipare, si parte da oggi e basta. */
const GIORNI_PRIMA = 3;

const PASSI = [
  { titolo: "Che ritorno è", nota: "Un ciclo che si ripete, oppure un intervento e basta" },
  { titolo: "Come lo fissiamo", nota: "Giorno, ora e chi ci va — oppure solo un promemoria" },
  { titolo: "Riepilogo", nota: "Cosa si è deciso, e che cosa succede dopo" },
];
const ULTIMO_PASSO = PASSI.length - 1;
const ICONE_PASSO = [Repeat, CalendarClock, CalendarCheck];

/** La scala dei passi. Stessa forma e stesse regole di quella della posa: dove
 *  si è, cosa si è già deciso, dove si può tornare — e non si salta avanti a un
 *  passo che dipende da uno vuoto. Sul telefono resta scritto solo il passo
 *  corrente, ma i numeri restano tutti: «2 di 3» è ciò che dice quanto manca. */
function ScalaPassi({
  passo,
  massimo,
  onVai,
}: {
  passo: number;
  massimo: number;
  onVai: (i: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-0.5">
      {PASSI.map((p, i) => {
        const fatto = i < passo;
        const corrente = i === passo;
        const raggiungibile = i <= massimo;
        return (
          <li key={p.titolo} className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              disabled={!raggiungibile}
              onClick={() => onVai(i)}
              aria-current={corrente ? "step" : undefined}
              title={raggiungibile ? p.titolo : "Manca ancora qualcosa nei passi precedenti"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors",
                corrente
                  ? "border-slate-400 bg-slate-200/70 font-semibold text-slate-900"
                  : raggiungibile
                    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    : "cursor-not-allowed border-dashed border-slate-200 bg-white text-slate-400",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none",
                  fatto
                    ? "bg-emerald-600 text-white"
                    : corrente
                      ? "bg-slate-900 text-white"
                      : "bg-slate-200 text-slate-500",
                )}
              >
                {fatto ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn("truncate", !corrente && "hidden sm:inline")}>{p.titolo}</span>
            </button>
            {i < ULTIMO_PASSO && <span className="h-px w-2 shrink-0 bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}

/** `null` = non ha ancora scelto, e va tenuto distinto da «solo promemoria»:
 *  un interruttore spento si legge come «non ci ha pensato nessuno», e qui la
 *  differenza fra le due risposte è un posto in agenda. */
type Modo = "fissa" | "promemoria" | null;

/** Stessa disciplina per la prima domanda: `null` non è «ciclo», è «nessuno ha
 *  ancora risposto». Partire da "ciclo" avrebbe rimesso in piedi esattamente il
 *  problema che questa scelta risolve — una cadenza decisa senza che nessuno
 *  l'abbia chiesta. */
type Tipo = TipoManutenzione | null;

export function ManutenzioneDialog({
  lead,
  open,
  onOpenChange,
  /** La manutenzione da rifissare. Assente = se ne crea una nuova. È la stessa
   *  finestra perché è la stessa decisione: un promemoria che diventa
   *  appuntamento non è un gesto diverso dal fissarlo il primo giorno. */
  appuntamento,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appuntamento?: AppuntamentoManutenzione | null;
}) {
  const { consultants, leads: allLeads } = useCRM();
  const { salvaManutenzione } = useAzioniManutenzione();

  //  L'anagrafica letta DENTRO l'effetto che riempie i campi, senza metterla fra
  //  le sue dipendenze: com'è in InstallationScheduleDialog, e per lo stesso
  //  motivo. Se `consultants` fosse una dipendenza, ogni aggiornamento
  //  dell'elenco (arriva da Supabase, anche mentre la finestra è aperta)
  //  rifarebbe partire l'effetto e riazzererebbe giorno, ora e squadra sotto le
  //  mani di chi sta scegliendo.
  const consultantsRef = useRef(consultants);
  consultantsRef.current = consultants;

  const [passo, setPasso] = useState(0);
  const [tipo, setTipo] = useState<Tipo>(null);
  const [cadenza, setCadenza] = useState<number>(CADENZE_GIORNI[CADENZE_GIORNI.length - 1]);
  const [modo, setModo] = useState<Modo>(null);
  const [consulenteId, setConsulenteId] = useState("");
  const [accompagnatoreId, setAccompagnatoreId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [giorno, setGiorno] = useState("");
  const [ora, setOra] = useState("");
  const [note, setNote] = useState("");
  /*  ── QUANTO PAGA PER QUESTO RITORNO ────────────────────────────────────
      Richiesta del committente. Sta sull'APPUNTAMENTO e non sulla scheda del
      cliente perché il prezzo di una manutenzione cambia con quello che c'è
      da rifare: uno solo, scritto una volta, sarebbe sbagliato dalla seconda
      volta in poi. Stringa e non numero finché si digita — un campo numerico
      che rifiuta la virgola è il modo più rapido per far scrivere zero. */
  const [importo, setImporto] = useState("");
  const [salvataggio, setSalvataggio] = useState(false);

  useEffect(() => {
    if (!open || !lead) return;
    //  Si riparte sempre dal primo passo: riaprire su «Riepilogo» la scheda di
    //  un altro cliente mostrerebbe un riepilogo che non è stato deciso.
    setPasso(0);
    setSalvataggio(false);
    const cad = cadenzaDi(lead.data);
    setCadenza(cad);
    setNote(appuntamento?.note || "");
    setImporto(appuntamento?.importo != null ? String(appuntamento.importo) : "");
    /** ── IL RIPIEGO PASSA DALLO STESSO FILTRO DELL'ELENCO ──────────────────
     *  Chi è già SCRITTO su un ritorno resta scegliibile comunque — è la
     *  scappatoia di `manutentoriPossibili`, e serve a non svuotare il campo di
     *  un ritorno vecchio. Ma il RIPIEGO («di solito torna da chi gli ha
     *  posato») non è un dato scritto da nessuno: è solo un'abitudine, e vale
     *  finché quella persona le manutenzioni le fa davvero.
     *  ⚠️ Proposto senza controllo, quella scappatoia se lo tirava dentro
     *  l'elenco: il primo passo risultava già risposto con un nome che non è
     *  manutentore, `mancaManutentore` restava `null` (l'elenco non era più
     *  vuoto) e la schermata del vicolo cieco non compariva mai. Cioè il filtro
     *  appena messo non cambiava niente per i ritorni NUOVI, che sono tutti.
     *  Identico al ripiego dell'esecutore in InstallationScheduleDialog, dove
     *  questo stesso errore è già stato corretto — e deciso dalla STESSA
     *  funzione dell'elenco, non da una seconda lettura delle spunte. */
    const puoEseguire = manutentoriPossibili(consultantsRef.current).elenco;
    //  `null` e non solo `undefined`: i due campi da cui arrivano i candidati
    //  sono nullable in `LeadData`, e una scheda importata ce l'ha davvero a
    //  null. Restringere il tipo qui avrebbe spostato la nullità sul chiamante.
    const proposto = (...candidati: (string | null | undefined)[]): string =>
      candidati.find((id) => !!id && puoEseguire.some((c) => c.id === id)) ?? "";
    if (appuntamento) {
      //  Si sta rifissando: si riparte da com'era. La prima domanda ha già una
      //  risposta scritta sulla riga — o il ripiego "ciclo", che è ciò che dice
      //  ogni riga nata prima che questa scelta esistesse — e si mostra scelta,
      //  non da rifare: spostare un ritorno non è rimettere in discussione se il
      //  cliente sia dentro un giro.
      setTipo(tipoDi(appuntamento));
      //  Il modo lo dice lo stato — un promemoria che si apre da qui è quasi
      //  sempre un promemoria che sta per diventare appuntamento, ma la scelta
      //  resta di chi guarda.
      setModo(appuntamento.stato === "fissata" ? "fissa" : null);
      //  Quello SCRITTO sulla riga vince sempre e non si filtra: è la scappatoia
      //  di `manutentoriPossibili`, ed è ciò che permette di spostare un ritorno
      //  affidato a chi nel frattempo è stato spento. Gli altri due sono ripieghi
      //  (un promemoria non ha nessun esecutore scritto) e passano dal filtro.
      setConsulenteId(
        appuntamento.consulenteId ||
          proposto(lead.data.installazione?.consulenteInstallazioneId, lead.data.consulenteId),
      );
      setAccompagnatoreId(appuntamento.accompagnatoreId || "");
      setDriverId(appuntamento.driverId || "");
      setGiorno(appuntamento.stato === "fissata" ? appuntamento.data : "");
      setOra(appuntamento.ora || "");
      return;
    }
    setTipo(null);
    setModo(null);
    //  Chi ha posato è chi il cliente conosce: è il valore di partenza giusto,
    //  e resta cambiabile con un tocco.
    //  ⚠️ È solo una PROPOSTA: se quella persona non è segnata manutentore non
    //  viene proposta e il campo si presenta da scegliere — e se non c'è nessun
    //  manutentore resta vuoto, che è ciò che fa comparire `SenzaManutentori`
    //  invece di un nome scelto da nessuno. È voluto: la spunta del manutentore
    //  è sua e non si deduce da «ha posato».
    setConsulenteId(
      proposto(lead.data.installazione?.consulenteInstallazioneId, lead.data.consulenteId),
    );
    setAccompagnatoreId("");
    setDriverId("");
    setGiorno("");
    setOra("");
  }, [open, lead, appuntamento]);

  //  ── LA DATA PREVISTA ────────────────────────────────────────────────────
  //   Con un CICLO: ultimo ritorno (o giorno della posa) più la cadenza scelta
  //   ADESSO — cambia sotto le dita mentre si tocca una pastiglia, che è tutto
  //   il motivo per cui la cadenza sta al primo passo: si vede subito su che
  //   giorno si va a finire.
  //   Con un INTERVENTO SINGOLO non c'è niente da cui contare: la data attesa è
  //   «il prima possibile», cioè oggi, e poi sono gli orari liberi a dire
  //   quand'è davvero. Far comparire anche qui «ultimo ritorno + trenta giorni»
  //   avrebbe spinto un mese avanti un cliente che è passato oggi per un ritocco.
  const prevista = useMemo(() => {
    if (!lead) return "";
    if (tipo === "singolo") return oggiISO();
    return dataProposta(lead.data, cadenza);
  }, [lead, cadenza, tipo]);

  const consultant = useMemo(
    () => consultants.find((c) => c.id === consulenteId),
    [consultants, consulenteId],
  );

  //  ── CHI LO ESEGUE: SOLO I MANUTENTORI ───────────────────────────────────
  //   Prima qui c'erano tutti i consulenti attivi, e bastava aprire la finestra
  //   perché il primo nome dell'elenco si prendesse un'ora di agenda per un
  //   lavoro che magari non fa. La regola e la schermata del vicolo cieco stanno
  //   in ./squadra: chi è già scritto su questo ritorno resta in elenco anche se
  //   nel frattempo è stato spento o gli è stato tolto il mestiere.
  const { elenco: manutentori, manca: mancaManutentore } = useMemo(
    () => manutentoriPossibili(consultants, consulenteId),
    [consultants, consulenteId],
  );

  /** I giorni con almeno un orario libero, dal giorno previsto in poi.
   *  Tutto il conto lo fa `booking-utils`, che conosce giorni lavorativi,
   *  fasce, pause, indisponibilità, meeting, visite in sede, pose col tempo per
   *  la strada — e ora anche le manutenzioni già fissate. Qui non si filtra
   *  niente a mano: una seconda regola scritta di qua è il modo in cui due
   *  schermate finiscono per dire il contrario sullo stesso pomeriggio.
   *  ⚠️ NON si passa `excludeLeadId`: quella scorciatoia toglie di mezzo la
   *   trattativa INTERA, e qui sarebbe sbagliata — una manutenzione non deve
   *   accavallarsi nemmeno al meeting o alla posa di questo stesso cliente. Si
   *   passa invece l'id della SOLA manutenzione che si sta spostando: altrimenti
   *   sparirebbe dall'elenco proprio l'ora che ha adesso. */
  const giorniLiberi = useMemo(() => {
    if (!consultant || !prevista) return [];
    const oggi = oggiISO();
    const partenzaGrezza = piuGiorni(prevista, -GIORNI_PRIMA) || prevista;
    const partenza = partenzaGrezza < oggi ? oggi : partenzaGrezza;
    return generateAvailability(
      consultant,
      DURATA_MANUTENZIONE,
      allLeads,
      GIORNI_AVANTI,
      partenza,
      undefined,
      appuntamento?.id,
    );
  }, [consultant, prevista, allLeads, appuntamento?.id]);

  const giornoScelto = giorniLiberi.find((g) => g.date === giorno) || null;
  //  Un giorno già fissato può non essere più fra i liberi (è passato, o l'agenda
  //  è cambiata): resta comunque scelto, perché rifissare non deve cancellare
  //  quello che c'era.
  const giornoFuoriAgenda = !!giorno && !giorniLiberi.some((g) => g.date === giorno);
  const orariLiberi = giornoScelto?.slots ?? [];
  const orari = ora && !orariLiberi.includes(ora) ? [ora, ...orariLiberi] : orariLiberi;

  //  ── CHI ALTRO CI VA ─────────────────────────────────────────────────────
  //   Gli stessi due elenchi delle pose, con il manutentore al posto del
  //   posatore: nessuno affianca se stesso, e chi guida non è anche chi
  //   affianca — sono due mestieri e due persone, e sceglierne una sola per
  //   tutti e due i posti farebbe raccontare al riepilogo una squadra di tre
  //   dove sono in due.
  const elencoAccompagnatori = useMemo(
    () => accompagnatoriPossibili(consultants, accompagnatoreId, consulenteId, driverId),
    [consultants, accompagnatoreId, consulenteId, driverId],
  );
  const elencoDriver = useMemo(
    () => driverPossibili(consultants, driverId, consulenteId, accompagnatoreId),
    [consultants, driverId, consulenteId, accompagnatoreId],
  );

  /** Chi, in quella fascia, NON è libero.
   *  ⚠️ Si chiede a `liberoNellaFascia`, cioè alla STESSA funzione con cui
   *  l'agenda decide chi è occupato, e con lo STESSO margine con cui glielo
   *  toglie (STRADA_ACCOMPAGNATORE per chi affianca, STRADA_DRIVER per chi
   *  guida). Una seconda regola scritta qui sarebbe più permissiva o più severa
   *  di quella vera, e in tutti e due i casi questa finestra direbbe una cosa
   *  che nessun'altra schermata conferma.
   *  ⚠️ Si passa l'id della manutenzione che si sta spostando: altrimenti chi è
   *  già scritto su questo ritorno risulterebbe occupato da questo stesso
   *  ritorno, e non lo si potrebbe più confermare.
   *  ⚠️ Finché non ci sono giorno e ora l'insieme è VUOTO — e infatti queste due
   *  scelte compaiono solo dopo l'ora: la domanda «è libero in quella fascia?»
   *  senza una fascia non si può nemmeno fare. */
  const impegnati = useMemo(() => {
    const fuori = { accompagnatori: new Set<string>(), driver: new Set<string>() };
    if (!giorno || !ora) return fuori;
    for (const c of elencoAccompagnatori) {
      if (
        !liberoNellaFascia(
          c,
          giorno,
          ora,
          DURATA_MANUTENZIONE,
          allLeads,
          STRADA_ACCOMPAGNATORE,
          undefined,
          appuntamento?.id,
        )
      ) {
        fuori.accompagnatori.add(c.id);
      }
    }
    for (const c of elencoDriver) {
      if (
        !liberoNellaFascia(
          c,
          giorno,
          ora,
          DURATA_MANUTENZIONE,
          allLeads,
          STRADA_DRIVER,
          undefined,
          appuntamento?.id,
        )
      ) {
        fuori.driver.add(c.id);
      }
    }
    return fuori;
  }, [elencoAccompagnatori, elencoDriver, giorno, ora, allLeads, appuntamento?.id]);

  /** ── CHI È GIÀ SCELTO PUÒ DIVENTARE OCCUPATO ─────────────────────────────
   *  Stesso guaio della programmazione della posa, e stessa risposta: l'elenco
   *  qui sopra spegne le voci di chi non è libero, ma quella SELEZIONATA resta
   *  scelta — e deve restarlo, o tornare indietro a cambiare l'ora farebbe
   *  sparire il nome sotto le mani. Il pericolo è l'ordine: si sceglie chi
   *  affianca alle 10:00, si torna sull'ora, si sposta il ritorno alle 15:00, e
   *  in quella fascia quella persona è già in strada. Nessuno riapre il campo,
   *  quindi nessuno rilegge la voce. Da qui in poi è la stessa domanda fatta al
   *  momento giusto — «quello scelto, ADESSO, è libero?» — e la risposta ferma
   *  la scala dei passi. Fra perdere uno slot e mandare la stessa persona in due
   *  posti, si perde lo slot. */
  const accompagnatoreOccupato =
    !!accompagnatoreId && impegnati.accompagnatori.has(accompagnatoreId);
  const driverOccupato = !!driverId && impegnati.driver.has(driverId);

  /* ── DOVE SI PUÒ ARRIVARE ──────────────────────────────────────────────────
     Il primo passo si chiude quando si è detto CHE RITORNO È: la cadenza ha un
     valore di partenza e non blocca niente, ma «ciclo o intervento singolo» sì —
     è una domanda senza ripiego onesto, e senza risposta il riepilogo non
     saprebbe che cosa dire. Il secondo si chiude quando la scelta è stata FATTA:
     «solo promemoria» basta da sé, «fissiamo adesso» vuole persona, giorno e ora
     — un appuntamento senza ora è un promemoria che dichiara di non esserlo — e
     in più che chi si è scelto come squadra sia davvero libero in quella fascia.
     Una regola sola, che accende insieme la scala in cima e il pulsante
     «Avanti»: due copie divergono al primo ritocco. */
  const squadraLibera = !accompagnatoreOccupato && !driverOccupato;
  const secondoPassoChiuso =
    modo === "promemoria" ||
    (modo === "fissa" && !!consulenteId && !!giorno && !!ora && squadraLibera);
  const massimo = !tipo ? 0 : !modo ? 1 : secondoPassoChiuso ? ULTIMO_PASSO : 1;
  const passoAttivo = Math.min(passo, massimo);
  const ultimo = passoAttivo === ULTIMO_PASSO;

  const cliente = [lead?.data.nome, lead?.data.cognome].filter(Boolean).join(" ") || "—";
  const nomeConsulente = consultant?.data.nome || "—";
  const nomeDi = (id: string) => consultants.find((c) => c.id === id)?.data.nome || "";

  const salva = async () => {
    //  La virgola si accetta: si digita al volo, e un campo che la rifiuta fa
    //  scrivere zero. Sotto zero o non numerico = nessun prezzo, non un errore.
    const cifraImporto = Math.max(0, Number(String(importo).replace(",", ".")) || 0);
    if (!lead || !modo || !tipo) return;
    //  Le stesse condizioni della scala, ricontrollate qui: il salvataggio non
    //  si fida di una regola che vive a schermo — è la disciplina della
    //  programmazione della posa, e vale doppio quando in mezzo c'è un'agenda.
    if (modo === "fissa" && (!consulenteId || !giorno || !ora || !squadraLibera)) return;
    const origine: OrigineManutenzione =
      appuntamento?.origine ?? (lead.data.installazione && posaFatta(lead.data) ? "posa" : "mano");
    const app: AppuntamentoManutenzione =
      modo === "fissa"
        ? {
            id: appuntamento?.id ?? nuovoId(),
            stato: "fissata",
            data: giorno,
            ora,
            durata: DURATA_MANUTENZIONE,
            consulenteId,
            //  Si scrivono solo se ci sono: un campo vuoto sarebbe un
            //  accompagnatore che non esiste, e `fasciaDelRitorno` dovrebbe
            //  difendersi da un id vuoto invece che leggere un dato pulito.
            ...(accompagnatoreId ? { accompagnatoreId } : {}),
            ...(driverId ? { driverId } : {}),
            tipo,
            origine,
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(cifraImporto > 0 ? { importo: cifraImporto } : {}),
            creataIl: appuntamento?.creataIl ?? new Date().toISOString(),
          }
        : {
            id: appuntamento?.id ?? nuovoId(),
            stato: "da_fissare",
            data: prevista,
            tipo,
            origine,
            ...(note.trim() ? { note: note.trim() } : {}),
            //  Il prezzo invece RESTA anche tornando a promemoria: non è una
            //  cosa dell'appuntamento (l'ora, le persone) ma di quello che il
            //  cliente verrà a fare, e cancellarlo costringerebbe a
            //  riscriverlo ogni volta che si sposta una data.
            ...(cifraImporto > 0 ? { importo: cifraImporto } : {}),
            creataIl: appuntamento?.creataIl ?? new Date().toISOString(),
            //  Ora, persone e squadra si TOLGONO tornando a promemoria: lasciarle
            //  scritte vorrebbe dire una riga che dichiara un'ora e due
            //  accompagnatori e non è un appuntamento — la contraddizione che si
            //  scopre il giorno stesso, quando quelle agende risultano bloccate
            //  per qualcosa che nessuno ha fissato.
          };
    setSalvataggio(true);
    //  ⚠️ LA CADENZA SI SCRIVE SOLO PER IL CICLO. Un intervento singolo non
    //  scrive niente sulla scheda del cliente: è esattamente ciò che vuol dire
    //  «senza impegnarlo a un giro». E se una cadenza c'era già, resta dov'era —
    //  un ritorno fuori giro non riscrive il giro.
    const fatto = await salvaManutenzione(lead, app, tipo === "ciclo" ? cadenza : undefined);
    setSalvataggio(false);
    //  ⚠️ La finestra si chiude SOLO se ha salvato davvero: quello che è stato
    //   compilato resta lì, pronto per riprovare. L'errore lo dice l'azione.
    if (fatto) onOpenChange(false);
  };

  return (
    <Finestra
      aperta={open}
      onCambio={onOpenChange}
      titolo={appuntamento ? "Sposta la manutenzione" : "Fissa la manutenzione"}
      contesto={`${cliente} · passo ${passoAttivo + 1} di ${PASSI.length}: ${PASSI[passoAttivo].titolo}`}
      icona={Repeat}
      larghezza="md"
      classeCorpo="space-y-3"
      azioni={
        <>
          <Button
            variant="outline"
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            onClick={() => (passoAttivo === 0 ? onOpenChange(false) : setPasso(passoAttivo - 1))}
          >
            {passoAttivo === 0 ? (
              "Annulla"
            ) : (
              <>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Indietro
              </>
            )}
          </Button>
          {ultimo ? (
            <Button onClick={() => void salva()} disabled={!secondoPassoChiuso || salvataggio}>
              <Check className="mr-1 h-3.5 w-3.5" />
              {modo === "promemoria" ? "Metti il promemoria" : "Fissa"}
            </Button>
          ) : (
            <Button
              onClick={() => setPasso(passoAttivo + 1)}
              disabled={passoAttivo >= massimo}
              title={
                passoAttivo >= massimo
                  ? "Scegli prima quello che chiede questo passo"
                  : "Vai al passo successivo"
              }
            >
              Avanti <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </>
      }
    >
      <ScalaPassi passo={passoAttivo} massimo={massimo} onVai={setPasso} />

      <SezioneFinestra
        titolo={PASSI[passoAttivo].titolo}
        nota={PASSI[passoAttivo].nota}
        icona={ICONE_PASSO[passoAttivo]}
        classeCorpo="p-4 space-y-3"
      >
        {/* 1 · CHE RITORNO È — e solo dentro il ciclo, ogni quanto torna */}
        {passoAttivo === 0 && (
          <>
            {/*  Due voci e non un interruttore, per la stessa ragione del modo
                qui sotto e del driver nella posa: «un intervento e basta» è una
                risposta, non l'assenza di una risposta. Un interruttore «non
                ripetere» in fondo alla cadenza si legge come un dettaglio di una
                decisione già presa — e questa è l'altra metà della decisione. */}
            <div className="grid gap-1.5 sm:grid-cols-2">
              <VoceScelta
                selezionata={tipo === "ciclo"}
                icona={Repeat}
                titolo={ETICHETTA_TIPO_MANUTENZIONE.ciclo}
                nota="Torna ogni tot: la cadenza resta sulla sua scheda e il prossimo nasce da solo"
                onClick={() => setTipo("ciclo")}
              />
              <VoceScelta
                selezionata={tipo === "singolo"}
                icona={CalendarPlus}
                titolo={ETICHETTA_TIPO_MANUTENZIONE.singolo}
                nota="Un ritorno e basta: nessuna cadenza, e dopo non nasce niente"
                onClick={() => {
                  setTipo("singolo");
                  //  Il giorno previsto cambia (da «ultimo ritorno + cadenza» a
                  //  oggi): giorno e ora scelti sull'altro non valgono più.
                  setGiorno("");
                  setOra("");
                }}
              />
            </div>

            {/*  ⚠️ LA CADENZA COMPARE SOLO DENTRO IL CICLO. Chiederla prima, o
                anche solo mostrarla spenta accanto all'intervento singolo,
                rimetterebbe in piedi la domanda che questa scelta serve a non
                fare più: «ogni quanto torna» a chi ha appena detto che non
                torna. */}
            {tipo === "ciclo" && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Torna ogni
                  </span>
                  {CADENZE_GIORNI.map((g) => (
                    <Pillola
                      key={g}
                      attiva={cadenza === g}
                      onClick={() => {
                        setCadenza(g);
                        //  Cambiare cadenza sposta il giorno previsto: il giorno
                        //  e l'ora scelti su quello di prima non valgono più.
                        setGiorno("");
                        setOra("");
                      }}
                      className="px-2.5 py-1.5"
                    >
                      {g} giorni
                    </Pillola>
                  ))}
                </div>
                {/*  Le parole del cliente, non le nostre: in consulenza gli
                    abbiamo detto che dipende da quanto è acido il suo sudore, ed
                    è l'unica cosa che serve per scegliere fra quindici e trenta. */}
                <NotaFinestra tono="neutro" icona={Repeat}>
                  Dipende dal cliente, non dal prodotto: chi ha il sudore acido sta sui quindici
                  giorni, gli altri arrivano tranquillamente a trenta. Quello che scegli resta
                  scritto sulla sua scheda e vale anche per tutti i ritorni successivi.
                </NotaFinestra>
                <NotaFinestra tono="conferma" icona={CalendarClock}>
                  Con {cadenza} giorni il prossimo ritorno cade intorno al{" "}
                  <span className="font-semibold">{prevista ? formatDate(prevista) : "—"}</span>.
                </NotaFinestra>
              </>
            )}

            {tipo === "singolo" && (
              <NotaFinestra tono="neutro" icona={CalendarPlus}>
                Nessuna cadenza da scegliere e nessuna scritta sulla sua scheda: questo ritorno vale
                per sé. Quando lo segnerai fatto non nascerà il promemoria del successivo — se poi
                il cliente vuole entrare in un giro, si rifà questa procedura scegliendo{" "}
                <strong>Ciclo di ritorni</strong>.
              </NotaFinestra>
            )}
          </>
        )}

        {/* 2 · COME LO FISSIAMO — la scelta che decide se occupa un'agenda */}
        {passoAttivo === 1 && (
          <>
            {/*  Due voci e non un interruttore, per la stessa ragione del driver
                nella posa: «solo promemoria» è una risposta, non l'assenza di
                una risposta. E qui la differenza fra le due è un posto in
                calendario tenuto per mesi da un cliente che non ha confermato. */}
            <div className="grid gap-1.5 sm:grid-cols-2">
              <VoceScelta
                selezionata={modo === "fissa"}
                icona={CalendarCheck}
                titolo="Fissiamo giorno e ora"
                nota="Il cliente è qui e conferma: occupa l'agenda"
                onClick={() => setModo("fissa")}
              />
              <VoceScelta
                selezionata={modo === "promemoria"}
                icona={BellRing}
                titolo="Solo promemoria"
                nota="Lo richiamiamo verso quella data: nessuna agenda occupata"
                onClick={() => {
                  setModo("promemoria");
                  //  Giorno, ora e squadra si azzerano: restare scritti sotto una
                  //  scelta che li ignora è il modo in cui, tornando indietro due
                  //  volte, si salva un'ora che nessuno ha più confermato.
                  setGiorno("");
                  setOra("");
                  setAccompagnatoreId("");
                  setDriverId("");
                }}
              />
            </div>

            {modo === "promemoria" && (
              <NotaFinestra tono="neutro" icona={BellRing}>
                Resta in elenco come «da fissare» per il {prevista ? formatDate(prevista) : "—"}, e
                da lì si trasforma in appuntamento con un tocco quando il cliente conferma.
              </NotaFinestra>
            )}

            {modo === "fissa" && (
              <>
                {/*  CHI PRIMA DEL QUANDO: gli orari escono dall'agenda di questa
                    persona, e sceglierli prima di sapere di chi sono è l'errore
                    già corretto nella programmazione della posa. */}
                <CampoFinestra
                  etichetta="Chi lo esegue"
                  nota="Solo chi è segnato manutentore. Di partenza si propone chi ha fatto la posa, se fa anche le manutenzioni: è la persona che il cliente conosce."
                >
                  {mancaManutentore ? (
                    //  ⚠️ NON una scatola vuota: si dice che cosa manca e dove si
                    //  accende, e ci si porta. È la stessa schermata che le pose
                    //  mostrano quando non c'è nessun installatore.
                    <SenzaManutentori
                      manca={mancaManutentore}
                      primaDiAndare={() => onOpenChange(false)}
                    />
                  ) : (
                    <div className="grid gap-1.5">
                      {manutentori.map((c) => {
                        //  Chi non ha (più) il mestiere ma è già scritto su questo
                        //  ritorno va detto: il nome da solo non spiegherebbe
                        //  perché è in un elenco di manutentori. Si chiede a
                        //  `mestieriDi`, che è l'unico lettore delle spunte —
                        //  dedurlo dalla posizione in elenco avrebbe legato una
                        //  frase a schermo all'ordine di un array.
                        const senzaMestiere = !mestieriDi(c.data).faManutentore;
                        return (
                          <VoceScelta
                            key={c.id}
                            selezionata={consulenteId === c.id}
                            icona={UserRound}
                            titolo={c.data.nome}
                            nota={
                              senzaMestiere
                                ? "Non è più fra i manutentori: resta perché è già scritto su questo ritorno"
                                : c.data.attivo
                                  ? undefined
                                  : "Consulente disattivato"
                            }
                            onClick={() => {
                              //  Cambiare persona cambia l'agenda: giorno e ora
                              //  scelti su quella di prima non valgono più niente.
                              //  E si azzera anche la squadra, perché la sua
                              //  disponibilità era stata chiesta su un'altra
                              //  fascia — e perché il nuovo manutentore potrebbe
                              //  essere proprio chi era stato messo ad affiancarlo.
                              setConsulenteId(c.id);
                              setGiorno("");
                              setOra("");
                              setAccompagnatoreId("");
                              setDriverId("");
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </CampoFinestra>

                <CampoFinestra
                  etichetta="Che giorno"
                  nota={
                    tipo === "singolo"
                      ? "Giorni con almeno un orario libero, da oggi in poi: un intervento singolo non ha un giorno previsto."
                      : `Giorni con almeno un orario libero, a partire da qualche giorno prima del ${
                          prevista ? formatDate(prevista) : "giorno previsto"
                        }.`
                  }
                >
                  {giornoFuoriAgenda && (
                    <VoceScelta
                      selezionata
                      titolo={`${formatDate(giorno)} · giorno già fissato`}
                      nota="Non è fra i giorni liberi dell'agenda: resta valido finché non ne scegli un altro."
                    />
                  )}
                  {giorniLiberi.length === 0 ? (
                    <VuotoFinestra
                      testo={
                        consultant
                          ? "Nessun giorno libero nelle prossime sei settimane per questa persona. Scegline un'altra, oppure metti solo il promemoria."
                          : "Scegli prima chi lo esegue: gli orari escono dalla sua agenda."
                      }
                    />
                  ) : (
                    <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
                      {giorniLiberi.map((g) => (
                        <VoceScelta
                          key={g.date}
                          selezionata={giorno === g.date}
                          titolo={g.label}
                          //  Il giorno previsto si segna solo se ne esiste uno:
                          //  fra venti righe uguali è l'unica che dice «questo è
                          //  il giorno giusto». Sull'intervento singolo non c'è
                          //  nessun giorno giusto, e scriverlo su oggi sarebbe
                          //  un'indicazione inventata.
                          nota={
                            tipo === "ciclo" && g.date === prevista
                              ? "Il giorno previsto"
                              : undefined
                          }
                          coda={`${g.slots.length} ${g.slots.length === 1 ? "orario" : "orari"}`}
                          onClick={() => {
                            setGiorno(g.date);
                            setOra("");
                          }}
                        />
                      ))}
                    </div>
                  )}
                </CampoFinestra>

                {!!giorno && (
                  <CampoFinestra
                    etichetta="A che ora"
                    nota={`Agenda di ${nomeConsulente} · ${DURATA_MANUTENZIONE} minuti.`}
                  >
                    {orari.length === 0 ? (
                      <VuotoFinestra testo="In questo giorno non è rimasto nessun orario libero: scegline un altro." />
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {orari.map((s) => (
                          <Pillola
                            key={s}
                            attiva={ora === s}
                            onClick={() => setOra(s)}
                            className="px-2.5 py-1.5 font-mono"
                          >
                            {s}
                          </Pillola>
                        ))}
                      </div>
                    )}
                  </CampoFinestra>
                )}

                {/*  ── CHI ALTRO CI VA ────────────────────────────────────────
                    Sta DOPO l'ora e non prima, e non è una questione di ordine
                    estetico: «è libero in quella fascia?» senza una fascia non è
                    una domanda. Nella posa questa scelta cade al primo passo e
                    per rimediare serve un controllo in più al momento del
                    salvataggio; qui la si è messa dove la risposta esiste già.
                    Il caso normale della manutenzione è che non ci vada nessun
                    altro — si fa in sede — quindi «ci pensa lui» e «il cliente
                    viene da sé» sono già selezionate e non chiedono nessun tocco. */}
                {!!ora && (
                  <>
                    <CampoFinestra
                      etichetta="Chi lo affianca"
                      nota="Chi è segnato accompagnatore, lo stesso elenco delle pose. Quel giorno la sua agenda si blocca come per una posa: il ritorno più due ore prima e due dopo."
                    >
                      {elencoAccompagnatori.length === 0 ? (
                        <VuotoFinestra testo="Nessun accompagnatore in elenco: «Fa l'accompagnatore» si accende nella scheda del consulente, nella sezione «Che mestiere fa». Finché non c'è, il ritorno si fissa lo stesso: ci pensa il manutentore." />
                      ) : (
                        <div className="grid max-h-56 gap-1.5 overflow-y-auto pr-0.5">
                          {/*  «Ci pensa lui» è una VOCE e non l'assenza di una
                              scelta, come al passo del driver nella posa: serve
                              anche a tornare indietro, cioè a togliere una
                              persona già scritta senza doverne scegliere
                              un'altra. */}
                          <VoceScelta
                            selezionata={!accompagnatoreId}
                            icona={UserRound}
                            titolo="Ci pensa lui"
                            nota="Si blocca solo l'agenda di chi lo esegue"
                            onClick={() => setAccompagnatoreId("")}
                          />
                          {elencoAccompagnatori.map((c) => {
                            const impegnato = impegnati.accompagnatori.has(c.id);
                            return (
                              <VoceScelta
                                key={c.id}
                                selezionata={accompagnatoreId === c.id}
                                //  ⚠️ Occupato = non scegliibile: fra perdere uno
                                //  slot e mandare la stessa persona in due posti,
                                //  si perde lo slot.
                                disabilitata={impegnato && accompagnatoreId !== c.id}
                                onClick={() => setAccompagnatoreId(c.id)}
                                icona={UserPlus}
                                titolo={c.data.nome}
                                nota={
                                  impegnato
                                    ? //  ⚠️ NON «occupato» e basta: liberoNellaFascia
                                      //  dice no anche a chi quel giorno non lavora, è
                                      //  in pausa o in ferie, e si andrebbe a cercare
                                      //  un impegno che non esiste.
                                      "Non disponibile in quella fascia: un impegno più le due ore di strada, oppure quel giorno non lavora (orari, pause, ferie)"
                                    : !c.data.attivo
                                      ? "Consulente disattivato"
                                      : "Libero in quella fascia"
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                    </CampoFinestra>

                    <CampoFinestra
                      etichetta="Come arriva il cliente"
                      nota="Un driver serve solo se qualcuno va a PRENDERLO: la manutenzione si fa in sede, quindi il caso normale è che venga da sé. Scegliendone uno, quel giorno la sua agenda si blocca per il ritorno più tre ore prima e tre dopo."
                    >
                      {elencoDriver.length === 0 ? (
                        <VuotoFinestra testo="Nessun driver in elenco: «Fa il driver» si accende nella scheda del consulente, nella sezione «Che mestiere fa». Finché non c'è, il ritorno si fissa lo stesso: il cliente viene da sé." />
                      ) : (
                        <div className="grid max-h-56 gap-1.5 overflow-y-auto pr-0.5">
                          <VoceScelta
                            selezionata={!driverId}
                            icona={UserRound}
                            titolo="Viene da sé"
                            nota="Nessuna agenda in più occupata"
                            onClick={() => setDriverId("")}
                          />
                          {elencoDriver.map((c) => {
                            const impegnato = impegnati.driver.has(c.id);
                            return (
                              <VoceScelta
                                key={c.id}
                                selezionata={driverId === c.id}
                                disabilitata={impegnato && driverId !== c.id}
                                onClick={() => setDriverId(c.id)}
                                icona={Car}
                                titolo={c.data.nome}
                                nota={
                                  impegnato
                                    ? "Non disponibile in quella fascia: un impegno più le tre ore di strada, oppure quel giorno non lavora (orari, pause, ferie)"
                                    : !c.data.attivo
                                      ? "Consulente disattivato"
                                      : "Libero in quella fascia"
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                    </CampoFinestra>

                    {/*  ⚠️ Chi era stato scelto e adesso non è più libero non
                        sparisce: resta scelto e si dice perché non si può andare
                        avanti. Toglierlo da solo sarebbe un nome che scompare
                        sotto le mani senza che nessuno l'abbia deciso. */}
                    {!squadraLibera && (
                      <NotaFinestra tono="attenzione" icona={Users}>
                        {accompagnatoreOccupato && driverOccupato
                          ? "Chi affianca e chi porta il cliente non sono più liberi in questa fascia"
                          : accompagnatoreOccupato
                            ? `${nomeDi(accompagnatoreId) || "Chi affianca"} non è più libero in questa fascia`
                            : `${nomeDi(driverId) || "Il driver"} non è più libero in questa fascia`}
                        : è successo cambiando giorno o ora dopo averlo scelto. Scegline un altro,
                        oppure torna all&apos;orario di prima.
                      </NotaFinestra>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* 3 · RIEPILOGO — non chiede niente, dice cosa si è deciso */}
        {passoAttivo === 2 && (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <DatoFinestra etichetta="Cliente">{cliente}</DatoFinestra>
              {/*  ⚠️ LA PRIMA RIGA DEL RIEPILOGO CAMBIA CON LA STRADA SCELTA, e
                  non è un dettaglio di stile: «Torna ogni 30 giorni» su un
                  intervento singolo sarebbe una promessa che il CRM non
                  mantiene, e un riepilogo che tace sulla differenza fa firmare
                  al cliente una cosa per un'altra. */}
              {tipo === "ciclo" ? (
                <DatoFinestra etichetta="Torna ogni">{cadenza} giorni</DatoFinestra>
              ) : (
                <DatoFinestra etichetta="Che ritorno è">
                  {ETICHETTA_TIPO_MANUTENZIONE.singolo}
                </DatoFinestra>
              )}
              <DatoFinestra etichetta="Quando">
                {modo === "fissa"
                  ? `${formatDate(giorno)} alle ${ora}`
                  : prevista
                    ? `intorno al ${formatDate(prevista)}`
                    : "—"}
              </DatoFinestra>
              <DatoFinestra etichetta="Chi lo esegue">
                {modo === "fissa" ? nomeConsulente : "da decidere quando si fissa"}
              </DatoFinestra>
              {/*  Le due righe della squadra compaiono solo se c'è qualcuno: «Chi
                  lo affianca — nessuno» ripetuto su ogni ritorno è rumore fisso,
                  e il caso normale è proprio che non ci sia nessuno. */}
              {modo === "fissa" && !!accompagnatoreId && (
                <DatoFinestra etichetta="Chi lo affianca">
                  {nomeDi(accompagnatoreId) || "—"}
                </DatoFinestra>
              )}
              {modo === "fissa" && !!driverId && (
                <DatoFinestra etichetta="Va a prenderlo">{nomeDi(driverId) || "—"}</DatoFinestra>
              )}
            </div>

            {/*  ── IL PREZZO DEL RITORNO ──────────────────────────────────
                 Facoltativo: si può fissare un ritorno senza sapere ancora
                 quanto costerà, e obbligarlo vorrebbe dire numeri inventati.
                 Quando c'è, entra nel «Speso in tutto» del cliente — ma solo
                 a ritorno FATTO (vedi crm/acquisti.ts): un appuntamento in
                 programma è un incasso previsto, non speso. */}
            <CampoFinestra
              etichetta="Quanto paga per questo ritorno"
              nota="Facoltativo. Entra nel totale speso dal cliente quando il ritorno risulta fatto."
            >
              <Input
                value={importo}
                onChange={(e) => setImporto(e.target.value)}
                inputMode="decimal"
                placeholder="€"
                className={CLASSE_CAMPO}
              />
            </CampoFinestra>

            <CampoFinestra
              etichetta="Note per chi lo eseguirà"
              nota="Facoltative. Le legge chi apre la scheda del cliente e chi guarda la lente delle manutenzioni."
            >
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Es. porta il solvente, ha la base più larga"
                className={CLASSE_AREA}
              />
            </CampoFinestra>

            {modo === "fissa" ? (
              <NotaFinestra tono="conferma" icona={Clock}>
                Appuntamento fissato: {formatDate(giorno)} alle {ora}, {DURATA_MANUTENZIONE} minuti
                sull&apos;agenda di {nomeConsulente}
                {accompagnatoreId || driverId
                  ? //  Va detto QUI, dove si preme il pulsante: le agende che si
                    //  stanno per bloccare sono più di una, e sono di persone che
                    //  in questo momento non sono nella stanza.
                    ` · si blocca anche l'agenda di ${[nomeDi(accompagnatoreId), nomeDi(driverId)]
                      .filter(Boolean)
                      .join(" e ")}`
                  : ""}
                .
              </NotaFinestra>
            ) : (
              <NotaFinestra tono="neutro" icona={BellRing}>
                Nessuna agenda occupata. Il cliente resta in elenco come da fissare per il{" "}
                {prevista ? formatDate(prevista) : "—"}: si trasforma in appuntamento quando
                conferma.
              </NotaFinestra>
            )}

            {/*  ── CHE COSA SUCCEDE DOPO, DETTO PER INTERO ────────────────────
                È la sola differenza che il cliente si porta a casa, e il passo
                si chiama «Riepilogo» proprio perché deve dirla: con un ciclo il
                CRM continua da solo, con un intervento singolo si ferma qui. */}
            {tipo === "ciclo" ? (
              <NotaFinestra tono="neutro" icona={Repeat}>
                Ciclo di ritorni: sulla sua scheda resta scritto che torna ogni{" "}
                <strong>{cadenza} giorni</strong>, e quando segnerai questo come fatto il CRM
                metterà da solo il promemoria del successivo — senza occupare nessuna agenda finché
                non lo fissi.
              </NotaFinestra>
            ) : (
              <NotaFinestra tono="neutro" icona={CalendarPlus}>
                Intervento singolo: <strong>nessuna cadenza</strong> viene scritta sulla sua scheda
                e dopo questo non nasce nessun altro ritorno. Il cliente non è impegnato a niente.
              </NotaFinestra>
            )}
          </>
        )}
      </SezioneFinestra>
    </Finestra>
  );
}
