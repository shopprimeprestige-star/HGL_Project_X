/** ── DA FARE OGGI ──────────────────────────────────────────────────────────
 *  Indirizzo: /CRM/dafare.
 *
 *  A COSA SERVE
 *  È la prima schermata del mattino e l'ultima delle sei di sera: raccoglie in
 *  un posto solo tutto ciò che va fatto OGGI, da qualunque parte arrivi.
 *   · i ricontatti fissati per oggi;
 *   · le consulenze da fissare e da rifissare;
 *   · le trattative che si stanno lavorando in chat;
 *   · le chiamate che il setter deve rifare;
 *   · e le cose che uno si scrive a mano, che non nascono da nessun lead.
 *  Le regole di chi entra e chi no stanno tutte in crm/dafare/righe.tsx, che è
 *  una funzione pura: qui si disegna soltanto.
 *
 *  ── PERCHÉ NON È UN DOPPIONE DELLE PAGINE CHE CI SONO GIÀ ─────────────────
 *  L'agenda (/CRM/agenda) risponde a «com'è fatta la giornata», la coda
 *  (/CRM/avanzamento) a «cosa è rimasto indietro», l'elenco lead a «dov'è
 *  questa persona». Nessuna delle tre risponde a «e adesso cosa faccio»: per
 *  saperlo bisognava aprirle tutte e tre e tenere a mente. Qui c'è UNA lista di
 *  gesti, ordinata per orologio.
 *  Le righe NON sono una seconda verità: sono le stesse schede, lette con le
 *  stesse funzioni condivise (stato, pastiglia, colori, importi). Non si scrive
 *  niente sui lead da questa pagina — si apre la scheda vera, che è l'unico
 *  posto in cui un lead si modifica.
 *
 *  ── E GLI AVVISI? SI USA IL MOTORE CHE C'È, NON UN SECONDO ────────────────
 *  Il CRM ha già un motore di notifiche (crm/notifications/): calcola gli
 *  eventi, li raggruppa, li fa suonare una volta sola, li mette in coda se il
 *  permesso non c'è ancora. Le righe che nascono da un lead sono GIÀ coperte da
 *  lui — «appuntamento fra 15 minuti», «appuntamento in partenza», «richiamo
 *  scaduto» — e questa pagina non le riannuncia: userebbe una seconda voce per
 *  dire la stessa cosa, e si finirebbe per spegnerle entrambe.
 *
 *  Le cose scritte a mano il motore ancora non le conosce (il suo calcolo legge
 *  solo i lead). Finché non le conosce, questa pagina scrive l'avviso nella
 *  STESSA tabella `notifications` da cui pesca la campanella, con la stessa
 *  disciplina di `dedupe_key` — cioè entra nella strada esistente, non ne apre
 *  una nuova. Quello che manca è il riquadro di sistema e il suono, che vivono
 *  nel motore: la modifica è di due righe ed è scritta per intero nella voce
 *  «serve da altri» del resoconto.
 *
 *  ── LE TRE DOMANDE DEL «QUANDO», E LA RISPOSTA DI QUESTA PAGINA ───────────
 *  Da quando una cosa scritta a mano può avere un GIORNO e un'ORA, tre domande
 *  decidono se questa lista si può guardare o no. Le regole stanno in
 *  crm/dafare/task-manuali.tsx (sono di dominio, non di disegno); qui c'è quello
 *  che se ne vede:
 *
 *   · UNA COSA PER DOMANI NON SI VEDE OGGI. La pagina si chiama «Da fare oggi».
 *     Ma non sparisce di nascosto: scrivendola la pagina conferma per esteso
 *     dove va a finire, e l'interruttore «Nei prossimi giorni» — con il suo
 *     conteggio — la fa riapparire in un clic.
 *   · UNA SCADUTA E NON FATTA VA IN CIMA, non «indietro». È il primo gruppo,
 *     «Rimasto indietro», con la sua data vera e da quanto è lì. Nessuno la
 *     sposta a oggi di nascosto: la data che qualcuno aveva scelto è la sola
 *     prova che quella cosa è in ritardo.
 *     Dentro quel gruppo — e dentro l'arretrato dei lead — si comincia dalle
 *     più VICINE a oggi: sono quelle che una telefonata recupera ancora, mentre
 *     una promessa di tre settimane fa non si recupera, si rifà da capo. Il
 *     verso si gira in un clic dalla striscia in testa al mucchio, resta girato
 *     domani, e vale anche per la scheda «Oggi» della coda del setter: è lo
 *     stesso arretrato guardato da un'altra finestra. Tutto il perché — e
 *     perché è una parola e non una freccia — sta in crm/dafare/arretrati.
 *   · SPUNTATA RESTA BARRATA FINO A STASERA, poi esce dall'elenco (e resta un
 *     mese nell'archivio). Vedere quello che si è fatto è metà del motivo per
 *     cui si tiene una lista — ma solo il giorno in cui lo si è fatto.
 *
 *  Le tre risposte reggono insieme per una quarta regola, che è di questa
 *  pagina: nessun gruppo che mescola più giornate mostra più di TETTO_GRUPPO
 *  righe senza dire quante ne sta tenendo da parte. Un elenco che nasconde le
 *  scadute mente; uno che le accumula diventa illeggibile e si smette di
 *  aprirlo, che è lo stesso danno con un'aria più onesta.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
//  ⚠️ `ChevronDown` era USATO e non importato: `vite build` non fa il
//   controllo dei tipi, quindi il difetto non si vedeva in compilazione e
//   arrivava a schermo come React #130 — la pagina bianca sul clic di
//   «Domani». Chi tocca questo elenco lo tenga in ordine alfabetico.
import {
  CalendarDays,
  ChevronDown,
  CircleCheckBig,
  History,
  Info,
  ListChecks,
  ListTodo,
  Plus,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Finestra } from "@/crm/ui/Finestra";
//  ⚠️ `supabase` e `useRef` sono usciti di qui insieme alla scrittura nella
//   campanella: adesso vive in crm/dafare/task-manuali (`useAvvisiTask`), che è
//   l'unico file che la fa per tutte e due le pagine. Se tornano, sta tornando
//   anche la copia.
import { useAuth, useConsulenteCollegato } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { QuickStatusDialog, requiresAnyDialog } from "@/crm/QuickStatusDialog";
import { LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "@/crm/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pillola } from "@/crm/ui/Finestra";
import {
  BarraAzioni,
  Badge,
  Kpi,
  KpiRiga,
  Pagina,
  Scheda,
  Segmento,
  SepBarra,
  Titolo,
  Vuoto,
  oggiIso,
  useRicerca,
} from "@/crm/ui";
import {
  FASCE,
  FASCE_ARRETRATE,
  META_RIGA,
  NOTA_FASCIA,
  TIPI_RIGA,
  TITOLO_FASCIA,
  costruisciRighe,
  fasciaDi,
  ordinaRighe,
  type Fascia,
  type RigaDaFare,
  type TipoRiga,
} from "@/crm/dafare/righe";
//  ⚠️ Anche `MINIMO_PER_ORDINARE` viene da lì: era scritto qui e nella scheda
//  «Oggi» della coda, con lo stesso valore e due commenti gemelli. Il verso, le
//  parole e la soglia sono lo stesso comando visto da due pagine.
import {
  MINIMO_PER_ORDINARE,
  ScambiaVerso,
  ordinaArretrati,
  useVersoArretrati,
} from "@/crm/dafare/arretrati";
import {
  applicaGesto,
  caricaTask,
  nuovoTask,
  useAvvisiTask,
  type TaskManuale,
} from "@/crm/dafare/task-manuali";
import { distanzaInChiaro, fraGiorni, quandoInChiaro } from "@/crm/dafare/quando";
import { VoceDaFare } from "@/crm/dafare/VoceDaFare";
import { NuovaCosa, type NuovaCosaCampi } from "@/crm/dafare/NuovaCosa";
import { padroneDelTask } from "@/crm/dafare/task-manuali";
import { creaCosaDaFare, liberaAgendaDi } from "@/crm/dafare/crea-cosa";
import { FiltroDiChi } from "@/crm/dafare/FiltroDiChi";
//  ⚠️ La domanda «di chi è questa riga» se la fanno DUE schermate — questa e la
//   linguetta «Oggi» dei lead importati — e la risposta sta in un file solo:
//   due filtri scritti in due punti diversi col tempo contano cose diverse.
import {
  contaDiChi,
  mappaMestieri,
  personeDelFiltro,
  rigaDiChi,
  rigaPassaChi,
  type MappaMestieri,
} from "@/crm/dafare/di-chi";
//  ── LA SELEZIONE A GRUPPI È QUELLA DEI LEAD IMPORTATI ─────────────────────
//   Stesso gesto (clic sulla riga, Maiusc+clic per il blocco), stesso codice:
//   `useSelezioneRighe` è uscito da lì apposta per non essere ricopiato, e da
//   oggi non parla più di schede ma di qualunque riga con un id — vedi la nota
//   in cima a crm/importa/selezione.
import { TETTO_SELEZIONE, testoSelezionaTutti, useSelezioneRighe } from "@/crm/importa/selezione";
//  Gli stati che si possono dare a venti righe insieme: quelli che non aprono
//  una finestra a chiedere una data o degli importi. La domanda si fa a chi
//  possiede le finestre, non a un elenco ricopiato qui.
import { richiedeChiusura } from "@/crm/ChiusuraDialog";
import { PastigliaStato, statiSelezionabili } from "@/crm/SelettoreStatoDialog";
import { SELECTABLE_LEAD_STATUSES } from "@/crm/types";
import { BarraSelezione } from "@/crm/ui";
import { AvvisoScadenza } from "@/crm/contabilita-AvvisoScadenza";
//  Lo scheletro delle azioni di gruppo: lo stesso dei lead importati.
import { aLotti } from "@/crm/azioni-di-gruppo";

export const Route = createFileRoute("/CRM/dafare")({
  component: DaFareOggiPage,
});

/** ── OGNI QUANTO SI RIGUARDA L'OROLOGIO ────────────────────────────────────
 *  Quindici secondi. Non trenta come il motore delle notifiche: là il calcolo
 *  ha finestre di minuti e mezzo minuto va benissimo, qui c'è un conto alla
 *  rovescia scritto a schermo, e un numero che scatta di trenta secondi in
 *  trenta sembra un contatore rotto. Non un secondo, perché ridisegnare
 *  quaranta righe sessanta volte al minuto non aggiunge un'informazione a
 *  nessuno. Il calcolo è tutto in memoria: nessuna query, nessun costo di rete. */
const PASSO_OROLOGIO_MS = 15_000;

/** ── QUANTE RIGHE SI VEDONO DI UN MUCCHIO ──────────────────────────────────
 *  Tre gruppi su sette possono crescere senza limite: «Rimasto indietro»,
 *  l'arretrato dei lead e «Nei prossimi giorni». Gli altri quattro sono la
 *  giornata, e la giornata ha le ore che ha; il passato e il futuro no.
 *  È la terza risposta alla domanda che regge tutta la pagina: un elenco che
 *  nasconde le scadute mente, uno che le accumula diventa illeggibile. Si
 *  mostrano quindi le prime cinque e le altre stanno dietro un pulsante che
 *  DICE quante sono. Nascondere si può, non dire quanto no.
 *  ⚠️ QUI C'ERA SCRITTO «le prime cinque, che per come sono ordinate sono le
 *   più vecchie, cioè quelle che contano»: non è più vero, e per fortuna. Nei
 *   due mucchi arretrati le prime cinque sono adesso quelle più VICINE a oggi —
 *   cioè quelle che una telefonata recupera ancora — e chi vuole le più vecchie
 *   gira il verso dalla striscia in testa al mucchio (crm/dafare/arretrati).
 *   Il tetto regge meglio di prima proprio per questo: le cinque righe che si
 *   vedono cambiano tutti i giorni, invece di essere per sempre le stesse
 *   cinque di quaranta giorni fa, che nessuno chiamerà mai e che rendevano il
 *   pulsante «mostra anche le altre» l'unico modo di vedere del lavoro vero.
 *  Cinque e non dieci perché sopra cinque righe il gruppo comincia a spingere
 *  fuori schermo «Adesso», che è il motivo per cui si apre questa pagina. */
const TETTO_GRUPPO = 5;

/** I gruppi che mescolano più giornate, e gli unici a cui si applica il tetto:
 *  accorciare «Stamattina» nasconderebbe lavoro di oggi, che è precisamente
 *  quello che nessun filtro di questa pagina deve poter fare senza dirlo.
 *  ⚠️ Sono tre e non due: «Nei prossimi giorni» si accorcia come gli altri, ma
 *   NON è arretrato (vedi `FASCE_ARRETRATE` in crm/dafare/righe) e non porta il
 *   comando del verso — il futuro si legge dal giorno più vicino, sempre. */
const GRUPPI_CON_TETTO: Fascia[] = ["daIeri", "arretrato", "piuAvanti"];

/** Il nome da mettere nel messaggio di conferma: quello che la persona legge
 *  sulla riga che ha appena toccato, non l'id. */
const nomeRiga = (l: Lead): string =>
  `${l.data?.nome ?? ""} ${l.data?.cognome ?? ""}`.trim() || l.data?.telefono || "Contatto";

/** «lunedì 18 agosto»: una data ISO in una conferma non conferma niente. */
const dataLunga = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
};

function DaFareOggiPage() {
  const { leads, updateLead, consultants } = useCRM();
  const { user } = useAuth();
  const consulente = useConsulenteCollegato();
  const ricerca = useRicerca();

  //  ⚠️ TUTTI GLI HOOK PRIMA DI QUALUNQUE `return`. In questa pagina è
  //  particolarmente facile sbagliare, perché ci sono tre stati di caricamento
  //  che verrebbe naturale intercettare in cima: React 310 non si vede in
  //  sviluppo e in produzione è la schermata bianca.
  const [task, setTask] = useState<TaskManuale[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testoNuovo, setTestoNuovo] = useState("");
  /** ⚠️ Vuoto vuol dire OGGI, e non si mette la data di oggi qui dentro alla
   *  partenza: questa pagina resta aperta tutto il giorno e qualcuno la lascia
   *  aperta anche la notte. Con la data congelata al montaggio, alle 00:05 il
   *  campo avrebbe continuato a dire ieri e la riga scritta subito dopo sarebbe
   *  nata già in ritardo. Vuoto = «quello che è oggi adesso», calcolato
   *  dall'orologio della pagina. */
  const [dataNuova, setDataNuova] = useState("");
  const [oraNuova, setOraNuova] = useState("");
  const [tipiSpenti, setTipiSpenti] = useState<TipoRiga[]>([]);
  const [conArretrato, setConArretrato] = useState(false);
  const [conProssimi, setConProssimi] = useState(false);
  /** L'anteprima di domani parte CHIUSA: la pagina si chiama «Da fare oggi», e
   *  chi la apre alle nove del mattino deve trovare la sua giornata, non quella
   *  dopo. Aperta resta finché non si cambia pagina. */
  const [apriDomani, setApriDomani] = useState(false);
  const [soloMie, setSoloMie] = useState(false);
  /** Il foglio dei filtri: solo sotto i 1024 punti. */
  const [foglioFiltri, setFoglioFiltri] = useState(false);
  /** Quanti filtri non si vedono dalla riga in cima: è il numero sul pulsante,
   *  ed è l'unica difesa contro il guardare una giornata parziale credendola
   *  intera. I sette tipi NON contano: sono in vista. */
  const filtriInPiu = (conArretrato ? 1 : 0) + (conProssimi ? 1 : 0) + (soloMie ? 1 : 0);
  /** ── DI CHI SONO LE COSE DA FARE ────────────────────────────────────────
   *  «» = di tutti. Altrimenti: `ruolo:setter`, `ruolo:consulente`, `nessuno`,
   *  oppure l'id di una persona.
   *  L'appartenenza si legge dal CONSULENTE ASSEGNATO alla scheda
   *  (`consulenteId`), che è il campo che esiste da sempre e vale anche su
   *  tutto l'archivio. Non da «chi ha impostato la cosa da fare»: quel dato il
   *  CRM non lo salva — nessun campo dice chi ha messo un lead in «da
   *  richiamare» — e inventarlo adesso avrebbe lasciato il filtro vuoto su
   *  tutto quello che è già stato lavorato.
   *  Le righe scritte a mano non hanno un lead: per loro vale chi le ha
   *  scritte (`task.di`), che è la cosa più vicina a «di chi è». */
  const [chi, setChi] = useState("");
  /** I gruppi di cui si è chiesto di vedere TUTTE le righe: il rimasto indietro
   *  si mostra accorciato finché non lo si apre (vedi `TETTO_GRUPPO`). */
  const [gruppiAperti, setGruppiAperti] = useState<Fascia[]>([]);
  /** Il verso con cui si leggono i due mucchi arretrati. Non è uno stato di
   *  questa pagina: sta nel browser e vale anche per la scheda «Oggi» della
   *  coda del setter — è lo stesso arretrato guardato da un'altra finestra
   *  (crm/dafare/arretrati). Qui serve solo a ordinare; il comando lo disegna
   *  `ScambiaVerso`, che legge lo stesso verso e quindi non può contraddire
   *  quello che si vede. */
  const [verso] = useVersoArretrati();
  const [adesso, setAdesso] = useState(() => Date.now());

  //  Il giorno di lavoro, ricavato dall'orologio della pagina e non da un
  //  `new Date()` sparso: a mezzanotte deve cambiare tutto insieme — i gruppi,
  //  i conteggi e il campo della data — altrimenti per qualche secondo la
  //  pagina dice due giorni diversi in due punti diversi.
  const oggi = oggiIso(new Date(adesso));

  /* ── L'OROLOGIO ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const id = window.setInterval(() => setAdesso(Date.now()), PASSO_OROLOGIO_MS);
    return () => window.clearInterval(id);
  }, []);

  /* ── LE COSE SCRITTE A MANO ───────────────────────────────────────────── */
  const rileggi = useCallback(async () => {
    setCaricando(true);
    const esito = await caricaTask();
    setCaricando(false);
    //  La risposta si LEGGE. Una lettura fallita che finisse in una lista vuota
    //  sarebbe indistinguibile da «non hai ancora scritto niente», e chi scrive
    //  la riga successiva sovrascriverebbe il lavoro di tutti.
    if (!esito.ok) {
      toast.error("Non riesco a leggere le cose da fare", { description: esito.errore });
      return;
    }
    setTask(esito.lista);
  }, []);

  useEffect(() => {
    void rileggi();
  }, [rileggi]);

  const gesto = useCallback(
    async (azione: Parameters<typeof applicaGesto>[0], successo?: string) => {
      setSalvando(true);
      const esito = await applicaGesto(azione);
      setSalvando(false);
      if (!esito.ok) {
        toast.error("Non sono riuscito a salvare", { description: esito.errore });
        //  Lo schermo NON cambia: una spunta che resta spuntata dopo un
        //  salvataggio fallito è una bugia che si scopre domani, quando la cosa
        //  da fare ricompare come se nessuno l'avesse mai toccata.
        return;
      }
      setTask(esito.lista);
      if (successo) toast.success(successo);
    },
    [],
  );

  const aggiungi = useCallback(() => {
    const testo = testoNuovo.trim();
    if (!testo) return;
    const giorno = dataNuova || oggi;
    void gesto(
      {
        tipo: "aggiungi",
        task: nuovoTask({
          testo,
          data: giorno,
          ora: oraNuova,
          //  Chi ha scritto la riga: l'id del consulente collegato col PIN,
          //  altrimenti quello dell'utente Supabase. La lista è una sola per
          //  tutto il centro (vedi crm/dafare/task-manuali.tsx), quindi il nome
          //  accanto alla riga è l'unica cosa che dice di chi è la palla.
          di: consulente?.id || user?.id,
          diNome: consulente?.nome || user?.email || "",
        }),
      },
      //  ⚠️ LA CONFERMA SI DICE SOLO QUANDO LA RIGA NON SI VEDE. Una cosa
      //   scritta per oggi compare sotto gli occhi: il toast sarebbe rumore.
      //   Una scritta per giovedì finisce in un gruppo chiuso, cioè sparisce
      //   dallo schermo un istante dopo essere stata scritta — e una riga che
      //   sparisce senza una parola si legge come «non ha salvato», che è il
      //   modo più veloce di far scrivere la stessa cosa due volte.
      giorno === oggi ? undefined : `Salvata per ${quandoInChiaro(giorno, oraNuova)}`,
    );
    setTestoNuovo("");
    setDataNuova("");
    setOraNuova("");
  }, [testoNuovo, dataNuova, oraNuova, oggi, consulente, user, gesto]);

  /** ── LA FINESTRA DEI DETTAGLI ──────────────────────────────────────────
   *  La riga veloce qui sopra resta la strada normale — si scrive e si batte
   *  invio. Questa si apre solo quando serve dire a chi tocca, per quale
   *  cliente, o che quella cosa si prende un pezzo di giornata. */
  const [finestraAperta, setFinestraAperta] = useState(false);

  const creaConDettagli = useCallback(
    async (campi: NuovaCosaCampi) => {
      /** ⚠️ La creazione sta in `crm/dafare/crea-cosa`, condivisa con la coda
       *  del setter: da quando una riga può bloccare un'ora di agenda il gesto
       *  ha due passi che devono andare insieme, e due copie divergono al primo
       *  ritocco — con il risultato che da una pagina l'agenda si blocca e
       *  dall'altra no, senza che nessuno lo sappia. */
      setSalvando(true);
      const esito = await creaCosaDaFare(
        campi,
        {
          id: consulente?.id || user?.id,
          nome: consulente?.nome || user?.email || "",
        },
        (g) => applicaGesto(g).then((r) => ({ ok: r.ok, errore: r.errore })),
      );
      setSalvando(false);
      if (!esito.ok) {
        toast.error("Non sono riuscito a salvare", { description: esito.errore });
        return;
      }
      const nuova = await caricaTask();
      if (nuova.ok) setTask(nuova.lista);
      const t = esito.task;
      if (esito.bloccata) toast.success(`Salvata, e l'agenda è bloccata dalle ${t?.ora}`);
      else if (t && t.data !== oggi) toast.success(`Salvata per ${quandoInChiaro(t.data, t.ora || "")}`);
      setFinestraAperta(false);
    },
    [consulente, user, oggi],
  );

  /** Sposta una riga scritta a mano. È il gesto che tiene pulito «Rimasto
   *  indietro» senza cancellare niente: vedi la nota in cima a
   *  crm/dafare/task-manuali.tsx. */
  const sposta = useCallback(
    (id: string, data: string, ora: string) =>
      void gesto(
        { tipo: "sposta", id, data, ora },
        data === oggi ? "Spostata a oggi" : `Spostata a ${quandoInChiaro(data, ora)}`,
      ),
    [gesto, oggi],
  );

  /* ── L'AVVISO QUANDO È IL MOMENTO ─────────────────────────────────────── */
  //  ⚠️ QUARANTA RIGHE DI SCRITTURA NELLA CAMPANELLA STAVANO QUI, e il posto
  //   era sbagliato: le note scritte a mano sono una lista sola e da quando le
  //   mostra e le scrive anche la coda del setter (routes/CRM.importa.tsx), chi
  //   passa la mattina al telefono sta sull'altra pagina — cioè su quella che
  //   non avvisava. Adesso la scrittura è UNA, in crm/dafare/task-manuali, e le
  //   due schermate la chiamano allo stesso modo: copiarla di là avrebbe voluto
  //   dire due `dedupe_key` destinate a divergere, e il doppione nella
  //   campanella è il modo più veloce per far spegnere le notifiche.
  useAvvisiTask(task, adesso, user?.id);

  /* ── LE RIGHE ─────────────────────────────────────────────────────────── */
  const righe = useMemo(
    () => costruisciRighe({ leads, task, ora: new Date(adesso) }),
    [leads, task, adesso],
  );

  /** Ogni riga con la sua fascia, calcolata una volta sola: senza, la fascia
   *  veniva ricalcolata dentro tre conteggi diversi e bastava che due usassero
   *  un «adesso» leggermente diverso per far dire alla pagina due verità. */
  const conFascia = useMemo(
    () => righe.map((r) => ({ riga: r, fascia: fasciaDi(r, adesso, oggi) })),
    [righe, adesso, oggi],
  );

  /** Chi sono io, per la lente «solo le mie»: il consulente collegato col PIN,
   *  altrimenti l'utente Supabase. È lo stesso identificativo che si scrive
   *  sulla riga quando la si crea, quindi il confronto è fra due cose uguali. */
  const io = consulente?.id || user?.id || "";

  /* ── LE TRE LENTI ──────────────────────────────────────────────────────
     Sono funzioni separate perché ogni conteggio ne applica DUE e ignora la
     terza: il numero accanto a un filtro deve dire quante righe si
     otterrebbero premendolo, e quindi non può essere calcolato con quel
     filtro già acceso. Era già la regola dei filtri per tipo; adesso vale
     anche per «anche l'arretrato», che prima si premeva alla cieca. */
  const passaTipo = useCallback((r: RigaDaFare) => !tipiSpenti.includes(r.tipo), [tipiSpenti]);

  const passaMomento = useCallback(
    (f: Fascia) => (f !== "arretrato" || conArretrato) && (f !== "piuAvanti" || conProssimi),
    [conArretrato, conProssimi],
  );

  //  La lente vale SOLO sulle righe scritte a mano: un lead non è «di
  //  qualcuno» in questa pagina — chi è libero lo chiama — e filtrarlo con lo
  //  stesso interruttore farebbe sparire mezza giornata senza spiegazione.
  const passaMie = useCallback(
    //  ⚠️ «Le mie» vuol dire assegnate a me, non scritte da me: vedi
    //   `padroneDelTask`. Senza, una riga data a un collega restava fra le mie
    //   e la sua non compariva fra le sue.
    (r: RigaDaFare) =>
      !soloMie || r.tipo !== "task" || (!!io && !!r.task && padroneDelTask(r.task) === io),
    [soloMie, io],
  );

  /** Chi fa che mestiere, letto una volta sola. La stessa persona può essere
   *  tutt'e due: chi fissa gli appuntamenti la mattina e fa le consulenze il
   *  pomeriggio deve comparire in tutti e due gli elenchi, non in uno scelto
   *  da noi. */
  const mestieri = useMemo<MappaMestieri>(() => mappaMestieri(consultants), [consultants]);

  /** Il nome di chi segue una scheda. ⚠️ Si appoggia alla mappa che c'è già:
   *  un secondo elenco dei consulenti in questa pagina vorrebbe dire due
   *  risposte alla stessa domanda il giorno che una delle due dimentica un
   *  ripiego. */
  const nomeConsulente = useCallback(
    (id?: string | null) => (id ? (mestieri.get(id)?.nome ?? "") : ""),
    [mestieri],
  );

  /** Le persone da offrire nel menu, in ordine alfabetico.
   *  ⚠️ CI SONO TUTTI, e prima no: si scartava chi non aveva spuntato nessuno
   *   dei due mestieri. Sembrava una pulizia — «un nome che non può avere
   *   niente da fare» — e invece era la causa della segnalazione del
   *   committente («mette tutto insieme»): una persona che lavora davvero, ma
   *   la cui scheda non dice che mestiere fa, non aveva NESSUN modo di essere
   *   isolata. Le sue cose da fare esistevano solo dentro il mucchio.
   *   Una tessera a zero si spegne da sola e non dà fastidio; una persona che
   *   manca dall'elenco non si può cercare. */
  const personeFiltro = useMemo(() => personeDelFiltro(mestieri), [mestieri]);

  /** Di chi è questa riga: il consulente assegnato alla scheda, oppure — per
   *  le cose scritte a mano, che una scheda non ce l'hanno — chi l'ha scritta. */
  const diChi = useCallback((r: RigaDaFare) => rigaDiChi(r), []);

  const passaChi = useCallback(
    (r: RigaDaFare) => rigaPassaChi(r, chi, mestieri),
    [chi, mestieri],
  );

  /** ── QUANTE NE HA CIASCUNO ──────────────────────────────────────────────
   *  Il numero su ogni tessera del filtro. Si calcola con gli ALTRI filtri
   *  accesi ma non con questo: il numero accanto a una scelta deve dire quante
   *  righe si otterrebbero premendola, e con il filtro già applicato direbbe
   *  sempre «tutte» o «zero».
   *  ⚠️ Chi fa tutti e due i mestieri conta in tutti e due i gruppi, e i due
   *   numeri quindi non si sommano al totale. È giusto così: «Setter» risponde
   *   a «quanto lavoro c'è sui contatti dei setter», non a una spartizione. */
  const conteggiChi = useMemo(
    () =>
      contaDiChi(
        conFascia
          .filter(
            ({ riga, fascia }) =>
              !riga.fatta && passaTipo(riga) && passaMomento(fascia) && passaMie(riga),
          )
          .map(({ riga }) => riga),
        mestieri,
      ),
    [conFascia, passaTipo, passaMomento, passaMie, mestieri],
  );

  const perTipo = useMemo(() => {
    const conto = {} as Record<TipoRiga, number>;
    for (const t of TIPI_RIGA) conto[t] = 0;
    for (const { riga, fascia } of conFascia) {
      if (riga.fatta || !passaMomento(fascia) || !passaMie(riga) || !passaChi(riga)) continue;
      conto[riga.tipo] += 1;
    }
    return conto;
  }, [conFascia, passaMomento, passaMie, passaChi]);

  /** Quante righe stanno DIETRO ai due interruttori del momento. È il numero
   *  che rende onesto il fatto di nasconderle: «Anche l'arretrato» senza un
   *  conteggio accanto è un interruttore che si preme per scoprire se c'era
   *  qualcosa, e nove volte su dieci non lo si preme. */
  const nascoste = useMemo(() => {
    let arretrato = 0;
    let prossimi = 0;
    let mie = 0;
    for (const { riga, fascia } of conFascia) {
      if (riga.tipo === "task" && !!io && !!riga.task && padroneDelTask(riga.task) === io && !riga.fatta) mie += 1;
      if (riga.fatta || !passaTipo(riga) || !passaMie(riga) || !passaChi(riga)) continue;
      if (fascia === "arretrato") arretrato += 1;
      if (fascia === "piuAvanti") prossimi += 1;
    }
    return { arretrato, prossimi, mie };
  }, [conFascia, io, passaTipo, passaMie, passaChi]);

  const visibili = useMemo(
    () =>
      conFascia
        .filter(
          ({ riga, fascia }) =>
            passaTipo(riga) && passaMomento(fascia) && passaMie(riga) && passaChi(riga),
        )
        .map(({ riga }) => riga),
    [conFascia, passaTipo, passaMomento, passaMie, passaChi],
  );

  const gruppi = useMemo(() => {
    const mappa = {} as Record<Fascia, RigaDaFare[]>;
    for (const f of FASCE) mappa[f] = [];
    for (const { riga, fascia } of conFascia) {
      if (!passaTipo(riga) || !passaMomento(fascia) || !passaMie(riga) || !passaChi(riga)) continue;
      mappa[fascia].push(riga);
    }
    //  I quattro gruppi della giornata e «Nei prossimi giorni» si leggono
    //  dall'inizio alla fine, che è `ordinaRighe`. I due mucchi arretrati
    //  seguono il verso scelto da chi guarda: di partenza dai più vicini a
    //  oggi, perché sono quelli che una telefonata recupera ancora — il perché
    //  per esteso, e quando serve l'altro verso, stanno in crm/dafare/arretrati.
    for (const f of FASCE) {
      mappa[f] = FASCE_ARRETRATE.includes(f)
        ? ordinaArretrati(mappa[f], verso)
        : ordinaRighe(mappa[f]);
    }
    return mappa;
  }, [conFascia, passaTipo, passaMomento, passaMie, passaChi, verso]);

  /** ⚠️ I NUMERI IN CIMA NON SEGUONO GLI INTERRUTTORI DEL MOMENTO, e non è una
   *  svista: un KPI che cala quando si spegne una lente non misura il lavoro,
   *  misura la lente. «Rimasto indietro» dice quanto è rimasto indietro anche
   *  quando l'arretrato è nascosto — è precisamente il numero che non deve
   *  potersi far sparire. I filtri per tipo e «solo le mie» invece li seguono:
   *  quelli dicono di CHE lavoro si sta parlando, non se guardarlo. */
  const numeri = useMemo(() => {
    let adessoN = 0;
    let giornata = 0;
    let indietro = 0;
    let fatte = 0;
    for (const { riga, fascia } of conFascia) {
      if (!passaTipo(riga) || !passaMie(riga) || !passaChi(riga)) continue;
      if (riga.fatta) {
        fatte += 1;
        continue;
      }
      if (fascia === "adesso") adessoN += 1;
      if (riga.giorno === oggi) giornata += 1;
      if (riga.giorno < oggi) indietro += 1;
    }
    return { adesso: adessoN, giornata, indietro, fatte };
  }, [conFascia, oggi, passaTipo, passaMie, passaChi]);

  /** ── QUELLO CHE SI VEDE DAVVERO, GRUPPO PER GRUPPO ────────────────────
   *  `gruppi` è tutto; questo è la fetta che sta a schermo, dopo il taglio dei
   *  mucchi accorciati («Mostra anche le altre 12»).
   *  ⚠️ ESISTE PER MAIUSC+CLIC, e non è un dettaglio di comodo: il blocco «da
   *   qui a lì» si calcola sull'elenco NELL'ORDINE IN CUI SI VEDE. Calcolandolo
   *   su `gruppi` interi, un Maiusc su un mucchio accorciato avrebbe preso anche
   *   le righe nascoste sotto il pulsante — cioè selezionato in silenzio schede
   *   che chi ha premuto non ha mai visto, per poi cambiare loro lo stato. */
  const mostrati = useMemo(() => {
    const m = {} as Record<Fascia, RigaDaFare[]>;
    for (const f of FASCE) {
      const tutte = gruppi[f];
      const conTetto = GRUPPI_CON_TETTO.includes(f) && tutte.length > TETTO_GRUPPO;
      m[f] = conTetto && !gruppiAperti.includes(f) ? tutte.slice(0, TETTO_GRUPPO) : tutte;
    }
    return m;
  }, [gruppi, gruppiAperti]);

  /** Le righe che si possono prendere a gruppi: quelle che vengono da una
   *  scheda e non sono già spuntate.
   *  ⚠️ LE RIGHE SCRITTE A MANO RESTANO FUORI, e non è una dimenticanza: dietro
   *   non c'è nessun cliente e nessuno stato da cambiare. Un quadratino su di
   *   loro si spunterebbe e poi il menu di gruppo non avrebbe niente da fare —
   *   il modo più rapido di far credere che la funzione sia rotta. Si spuntano
   *   e si spostano una per volta, con i comandi che hanno già. */
  const selezionabili = useMemo(
    () => FASCE.flatMap((f) => mostrati[f]).filter((r) => r.lead && !r.fatta),
    [mostrati],
  );

  const {
    selezione,
    selezionati,
    quante,
    tuttiSelezionati,
    tettoStretto,
    scegli,
    selezionaTutti,
    azzera,
    tieniSolo,
  } = useSelezioneRighe(selezionabili);

  /** ── GLI STATI CHE SI POSSONO DARE A VENTI RIGHE INSIEME ────────────────
   *  L'intersezione fra ciò che si può dare in massa — quelli che non aprono una
   *  finestra a chiedere un giorno, un'ora o degli importi — e ciò che ognuna
   *  delle schede scelte può davvero diventare.
   *  ⚠️ È LA STESSA REGOLA DEI LEAD IMPORTATI, e le due domande si fanno a chi
   *   possiede le finestre (`requiresAnyDialog`, `richiedeChiusura`) invece di
   *   ricopiarne l'elenco: il giorno in cui uno stato comincerà a chiedere un
   *   dato in più sparirà da tutti e due i menu da solo.
   *  Gli altri non sono irraggiungibili: si danno a UNA riga per volta, dalla
   *  pastiglia dello stato dentro il pulsante dei cursori, dove la finestra si
   *  apre per quella persona sola. */
  const statiProponibili = useMemo(() => {
    if (selezionati.length === 0) return [] as LeadStatus[];
    return SELECTABLE_LEAD_STATUSES.filter(
      (st) =>
        !requiresAnyDialog(st) &&
        !richiedeChiusura(st) &&
        selezionati.every((r) => statiSelezionabili(r.lead?.data ?? {}).includes(st)),
    );
  }, [selezionati]);

  /** Lo stato scelto dal menu di gruppo e non ancora confermato: finché è qui
   *  non è stato scritto niente da nessuna parte. */
  const [propostoGruppo, setPropostoGruppo] = useState<LeadStatus | null>(null);

  /** A che punto è un cambio di stato in massa: `null` = nessuno in corso.
   *  Senza un conto a schermo, trecento salvataggi sono una pagina che sembra
   *  bloccata — è la stessa disciplina dei lead importati. */
  const [avanzamento, setAvanzamento] = useState<{ fatti: number; totale: number } | null>(null);

  /** Prende (o lascia) una riga. `blocco` è vero quando c'era il Maiusc: prende
   *  tutto da qui all'ultima riga toccata, NELL'ORDINE IN CUI SI VEDE.
   *  ⚠️ Il blocco prende e basta, non toglie: Maiusc su venti righe che ne
   *   deseleziona diciannove fa perdere in un colpo il lavoro appena fatto, e
   *   chi lo subisce non capisce nemmeno cos'è successo. Per togliere c'è il
   *   clic singolo, oppure la X della barra in basso. */
  const scegliRiga = useCallback(
    (id: string, blocco: boolean) => {
      if (avanzamento) return;
      scegli(id, blocco);
    },
    [scegli, avanzamento],
  );

  /** Cambia lo stato alle righe scelte, a lotti.
   *  ⚠️ CHI NON È CAMBIATO RESTA SELEZIONATO. È quello che permette di riprovare
   *   senza ricercare a mano le righe rimaste indietro — ed è anche il segno,
   *   oltre al messaggio, che qualcosa non è andato. */
  const cambiaStatoInMassa = useCallback(
    async (stato: LeadStatus) => {
      const scelte = selezionati.filter((r) => r.lead);
      if (scelte.length === 0 || avanzamento) return;
      const esito = await aLotti(
        scelte,
        async (r) => {
          const lead = r.lead!;
          //  Già in quello stato: non c'è niente da scrivere. Non è un errore e
          //  non è lavoro svolto — vedi `EsitoRiga`.
          if (lead.data?.stato === stato) return "saltata";
          return (await updateLead(lead.id, { stato })) ? "fatta" : "fallita";
        },
        (fatti, totale) => setAvanzamento({ fatti, totale }),
      );
      setAvanzamento(null);
      tieniSolo(esito.falliti.map((r) => r.id));
      if (esito.falliti.length > 0) {
        toast.error(
          `${esito.falliti.length} ${esito.falliti.length === 1 ? "riga" : "righe"} NON salvate`,
          {
            description:
              "Sono rimaste selezionate e com'erano: riprova. Le altre sono state cambiate.",
          },
        );
        return;
      }
      toast.success(
        `${esito.fatte} ${esito.fatte === 1 ? "scheda" : "schede"} → ${LEAD_STATUS_LABEL[stato]}`,
        {
          description:
            esito.saltate > 0
              ? `${esito.saltate} ${esito.saltate === 1 ? "era già" : "erano già"} in quello stato.`
              : undefined,
        },
      );
    },
    [selezionati, avanzamento, updateLead, tieniSolo],
  );

  const apriLead = useCallback((id: string) => ricerca.apriLead(id), [ricerca]);

  /** ── QUELLO CHE C'È DOMANI ───────────────────────────────────────────────
   *  Le stesse righe di questa pagina, filtrate sul giorno dopo. Passano anche
   *  di qui i filtri per tipo e per persona — chi ha acceso «solo i miei
   *  setter» non vuole vedere domani il lavoro di tutti — ma NON quelli del
   *  momento: «anche l'arretrato» e «nei prossimi giorni» parlano di oggi.
   *  Le spuntate non ci sono: domani non si è ancora fatto niente. */
  const giornoDomani = useMemo(
    () =>
      new Date(`${fraGiorni(1)}T12:00:00`).toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [],
  );
  const domani = useMemo(() => {
    const g = fraGiorni(1);
    return ordinaRighe(
      righe.filter((r) => !r.fatta && r.giorno === g && passaTipo(r) && passaChi(r)),
    );
  }, [righe, passaTipo, passaChi]);

  /* ── I TRE GESTI SULLE RIGHE CHE VENGONO DA UNA SCHEDA ──────────────────
     Questa pagina non scriveva niente sui lead, e la regola resta buona per il
     TESTO delle righe: la verità sta nella scheda e si legge da lì. Ma non
     poter mai AGIRE costringeva ad aprire la scheda intera, fare il gesto,
     chiuderla e ritrovare il punto della lista, trenta volte al giorno — e una
     lista di cose da fare da cui non si può fare niente è un elenco, non uno
     strumento di lavoro.
     Le scritture stanno qui e non nel componente della riga: qui si sa se sono
     andate a buon fine, e qui c'è già la pipeline del CRM per gli stati che
     chiedono una data o dei soldi. */
  const [quickLead, setQuickLead] = useState<Lead | null>(null);
  const [quickStato, setQuickStato] = useState<LeadStatus | null>(null);

  /** L'esito scelto dalla griglia condivisa. Gli stati che promettono una data
   *  o toccano i soldi NON si scrivono da qui: passano da QuickStatusDialog,
   *  che è la stessa finestra del resto del CRM — un secondo modulo scritto in
   *  questa pagina darebbe le stesse informazioni con regole leggermente
   *  diverse, e le due versioni divergerebbero al primo cambio. */
  const cambiaStato = useCallback(
    async (lead: Lead, stato: LeadStatus) => {
      if (requiresAnyDialog(stato)) {
        setQuickLead(lead);
        setQuickStato(stato);
        return;
      }
      if (!(await updateLead(lead.id, { stato }))) {
        toast.error("Esito NON salvato", {
          description: "La scheda in archivio è rimasta com'era. Riprova.",
        });
        return;
      }
      toast.success(`${nomeRiga(lead)} → ${LEAD_STATUS_LABEL[stato]}`);
    },
    [updateLead],
  );

  /** Sposta il richiamo. Si scrive `dataRicontatto`, cioè lo stesso campo da
   *  cui questa pagina fa nascere la riga: spostare a domani vuol dire
   *  rivedersela domani, non farla sparire. */
  const cambiaQuando = useCallback(
    async (lead: Lead, data: string) => {
      if (!data) return;
      if (!(await updateLead(lead.id, { dataRicontatto: data }))) {
        toast.error("Data NON salvata", { description: "Riprova." });
        return;
      }
      toast.success(`${nomeRiga(lead)} · richiamo spostato`, {
        description: dataLunga(data),
      });
    },
    [updateLead],
  );

  /** ⚠️ LE NOTE SI ACCODANO, NON SI SOSTITUISCONO. Quello che c'è dentro
   *  `notePostCall` l'ha scritto qualcuno — magari un collega, magari un mese
   *  fa — ed è la memoria di quel cliente. Si aggiunge in fondo con la data,
   *  come si fa su un registro. */
  const aggiungiNota = useCallback(
    async (lead: Lead, testo: string) => {
      const pulito = testo.trim();
      if (!pulito) return;
      const gia = String(lead.data?.notePostCall ?? "").trim();
      const quando = new Date().toLocaleDateString("it-IT", {
        day: "numeric",
        month: "short",
      });
      const riga = `[${quando}] ${pulito}`;
      if (!(await updateLead(lead.id, { notePostCall: gia ? `${gia}\n${riga}` : riga }))) {
        toast.error("Nota NON salvata", { description: "Riprova." });
        return;
      }
      toast.success("Nota aggiunta alla scheda");
    },
    [updateLead],
  );

  const spunta = useCallback(
    (id: string, fatta: boolean) => void gesto({ tipo: "spunta", id, fatta }),
    [gesto],
  );

  const elimina = useCallback(
    (id: string) => {
      void (async () => {
        /** ── ⚠️ VIA LA RIGA, VIA IL BLOCCO ────────────────────────────────
         *  Il blocco dell'agenda nasce da questa riga e non ha vita propria:
         *  lasciandolo, il calendario resta chiuso per una cosa che non esiste
         *  più — e fra un mese nessuno saprà perché quel martedì alle 15 non
         *  si può prenotare.
         *  Si toglie PRIMA: se fallisce, la riga resta, e resta anche l'unico
         *  modo di ritrovare quel blocco. */
        const guasto = await liberaAgendaDi(task.find((x) => x.id === id));
        if (guasto) {
          toast.error("Non sono riuscito a liberare l'agenda", { description: guasto });
          return;
        }
        await gesto({ tipo: "elimina", id }, "Riga eliminata");
      })();
    },
    [gesto, task],
  );

  /** Apre o richiude un mucchio accorciato. Lo stato è per FASCIA e non per
   *  riga: «fammi vedere tutto l'arretrato» è una decisione che si prende una
   *  volta, e ricordarla per gruppo la fa durare quanto serve senza sopravvivere
   *  al cambio pagina — domani il mucchio è un altro. */
  const apriGruppo = useCallback(
    (f: Fascia) =>
      setGruppiAperti((prima) =>
        prima.includes(f) ? prima.filter((x) => x !== f) : [...prima, f],
      ),
    [],
  );

  const nienteDaFare = visibili.length === 0;

  /** ── ⚠️ SCRITTI UNA VOLTA, MOSTRATI IN DUE POSTI ────────────────────────
   *  Questa banda ha sette tipi di riga più due interruttori più il filtro
   *  della persona: sul monitor ci sta, sotto i 1024 punti — telefono e
   *  tablet — diventa tre righe sopra un elenco che spesso ne ha cinque.
   *  Fuori restano i SETTE TIPI, perché portano i conteggi e sono il modo in
   *  cui si guarda la giornata; il resto entra in un foglio.
   *  ⚠️ Una sola espressione, due contenitori: vedi la stessa nota nelle
   *   Installazioni e nei Preventivi. */
  const iTipiDiRiga = (
    <>
      {TIPI_RIGA.map((t) => (
        <Segmento
          key={t}
          attivo={!tipiSpenti.includes(t)}
          conteggio={perTipo[t]}
          titolo={META_RIGA[t].spiegazione}
          onClick={() =>
            setTipiSpenti((prima) =>
              prima.includes(t) ? prima.filter((x) => x !== t) : [...prima, t],
            )
          }
        >
          {META_RIGA[t].filtro}
        </Segmento>
      ))}
    </>
  );
  const gliAltriFiltri = (
    <>
      <SepBarra />
      {/*  ── I DUE INTERRUTTORI DEL MOMENTO, CON IL LORO NUMERO ──────────
            Il conteggio non è un ornamento: è la sola cosa che rende onesto il
            fatto di nascondere delle righe. Senza, «Anche l'arretrato» si preme
            per SCOPRIRE se c'era dell'arretrato, e nove volte su dieci non lo si
            preme — cioè la pagina tace su del lavoro esistente e nessuno lo sa.
            ⚠️ I due numeri NON cambiano quando si accende l'interruttore: sono
             calcolati ignorando il filtro che comandano (vedi `nascoste`),
             altrimenti direbbero «0» proprio quando le righe sono a schermo. */}
      <Segmento
        attivo={conArretrato}
        conteggio={nascoste.arretrato}
        titolo="Aggiunge le trattative rimaste aperte nei giorni scorsi. Spento di default: una lista di oggi che contiene anche ieri non è una lista di oggi."
        onClick={() => setConArretrato((v) => !v)}
      >
        Anche l&apos;arretrato
      </Segmento>
      {/*  ── DOVE VA A FINIRE UNA COSA SCRITTA PER DOMANI ────────────────
            Qui, e da nessun'altra parte. Una riga per domani NON si vede oggi —
            la pagina si chiama «Da fare oggi» — ma sparire in silenzio è
            un'altra cosa: chi ha appena scritto «lunedì ordinare le basi» deve
            poterla rivedere in un clic, con il numero che gli dice che c'è. */}
      <Segmento
        attivo={conProssimi}
        conteggio={nascoste.prossimi}
        titolo="Mostra le cose scritte a mano per un giorno che non è ancora arrivato. Spento di default: oggi non sono lavoro tuo."
        onClick={() => setConProssimi((v) => !v)}
      >
        Nei prossimi giorni
      </Segmento>
      {/*  ── LA LENTE, NON LA PARETE ─────────────────────────────────────
            La lista è UNA per tutto il centro (vedi crm/dafare/task-manuali):
            qui si può guardare solo la propria roba, non renderla privata. E
            vale solo sulle righe scritte a mano: un lead in questa pagina non è
            «di qualcuno» — lo chiama chi è libero — e spegnerlo con lo stesso
            interruttore farebbe sparire mezza giornata senza spiegazione.
            ⚠️ Senza un `io` l'interruttore non si disegna proprio: il confronto
             sarebbe con una stringa vuota, cioè spegnerebbe TUTTE le righe
             scritte a mano dicendo «solo le mie». Un comando che svuota la
             lista e dà la colpa a te è peggio di un comando che non c'è. */}
      {!!io && (
        <>
          <SepBarra />
          <Segmento
            attivo={soloMie}
            conteggio={nascoste.mie}
            titolo="Solo le cose scritte a mano da te. Le righe dei lead restano: un lead non è di nessuno, lo chiama chi è libero."
            onClick={() => setSoloMie((v) => !v)}
          >
            Solo le mie
          </Segmento>
        </>
      )}

      {/* ── DI CHI SONO ──────────────────────────────────────────────────
            Un menu solo, e non una pastiglia per persona: i nomi crescono con
            il centro, e dodici pastiglie in fila mangerebbero la barra e poi la
            pagina. Dentro, nell'ordine in cui si cercano: tutti, i due mestieri
            interi, poi le persone.
            ⚠️ L'appartenenza è il CONSULENTE ASSEGNATO alla scheda, non chi ha
             impostato la cosa da fare: quel dato il CRM non lo salva. La riga
             qui sotto lo dice a chi guarda, invece di lasciarglielo dedurre da
             un conteggio che non torna. */}
      <SepBarra />
      <FiltroDiChi valore={chi} persone={personeFiltro} conteggi={conteggiChi} onScegli={setChi} />

      {/* ── PRENDILE TUTTE ───────────────────────────────────────────────
            Richiesta del committente: «o con un clic che seleziona tutto,
            oppure con Maiusc+clic». Sono tutti e due, e questo è il primo — il
            secondo sta sulle righe, dove basta tenere premuto Maiusc.
            Sta in coda alla barra dei filtri e non sopra l'elenco perché
            prende quello che i filtri hanno lasciato: chi ha appena isolato
            «Non risponde · Marco» e preme qui prende quelli, che è tutto il
            senso di averli isolati.
            ⚠️ Il numero è SUL pulsante quando l'elenco supera un lotto: si
             preme sapendo quante se ne stanno prendendo, perché sopra le
             cinquanta la scrittura va a lotti e ci mette qualche secondo. */}
      {selezionabili.length > 0 && (
        <>
          <SepBarra />
          <Segmento
            attivo={tuttiSelezionati}
            onClick={selezionaTutti}
            titolo={
              tuttiSelezionati
                ? "Togli la selezione"
                : "Prendi tutte le righe che si vedono adesso. Per un blocco: clic sulla prima, Maiusc+clic sull'ultima"
            }
          >
            <ListChecks className="mr-1.5 h-3.5 w-3.5" />
            {testoSelezionaTutti(tuttiSelezionati, tettoStretto, quante)}
          </Segmento>
        </>
      )}
    </>
  );
  return (
    <Pagina>
      <Titolo
        testo="Da fare oggi"
        icona={ListTodo}
        nota={
          numeri.adesso > 0
            ? `${numeri.adesso} ${numeri.adesso === 1 ? "cosa" : "cose"} da fare adesso · ${numeri.giornata} in giornata`
            : `${numeri.giornata} ${numeri.giornata === 1 ? "cosa" : "cose"} in giornata`
        }
      />

      {/*  ── ⚠️ IL PROMEMORIA FISCALE STA QUI, NON IN UN AVVISO A COMPARSA ─
          Questa è la pagina che si apre la mattina e si tiene aperta: una
          scadenza scritta qui la si vede, una scritta in un avviso che passa
          dopo tre secondi la si vede solo se in quel momento si era davanti
          allo schermo. Non scrive niente nella lista: legge e disegna. */}
      <AvvisoScadenza />

      <KpiRiga colonne={4}>
        <Kpi
          etichetta="Adesso"
          valore={numeri.adesso}
          tono={numeri.adesso > 0 ? "in_sospeso" : "neutro"}
          icona={Sun}
          nota="Ha un'ora, ed è arrivata"
        />
        <Kpi etichetta="In giornata" valore={numeri.giornata} nota="Ancora da fare oggi" />
        <Kpi
          etichetta="Rimasto indietro"
          valore={numeri.indietro}
          tono={numeri.indietro > 0 ? "persa" : "neutro"}
          icona={History}
          //  Conta anche quello che gli interruttori stanno nascondendo: è il
          //  numero che non deve potersi far sparire spegnendo una lente.
          nota="Dei giorni scorsi, anche se nascosto"
        />
        <Kpi
          etichetta="Fatte oggi"
          valore={numeri.fatte}
          icona={CircleCheckBig}
          //  Prima diceva «Spuntate» e contava un mese di righe barrate: un
          //  numero che sale ogni giorno e non scende mai non è un risultato,
          //  è un archivio. Qui si vede la giornata, e domani riparte da zero.
          nota="Barrate qui sotto fino a stasera"
        />
      </KpiRiga>

      {/* ── SCRIVERE UNA COSA DA FARE ──────────────────────────────────────
          Il testo, QUANDO, e un pulsante.

          Il giorno prima non si chiedeva affatto — «la pagina si chiama oggi» —
          e l'intenzione era giusta: chiedere una data ovvia fa rinunciare a
          scrivere la riga. Sbagliato era il resto, cioè che una cosa da
          ricordare lunedì non si potesse scrivere per niente: chi doveva
          ricordarsela se la segnava altrove, ed è esattamente il foglietto che
          questa pagina esiste per eliminare.
          La soluzione non è un campo in più da compilare: il giorno è già
          pieno — «Oggi» acceso — e chi scrive di corsa continua a battere testo
          e invio come prima. «Domani» e la data sono lì accanto per chi ne ha
          bisogno, che è la stessa scorciatoia (stesse parole, stesso ordine) con
          cui si sposta un richiamo nella procedura del «quando».
          L'ora resta facoltativa: quasi tutto quello che si scrive a mano è «in
          giornata», e un orario finto farebbe suonare promemoria per cose che
          non hanno un momento. Chi la mette ottiene un conto alla rovescia e un
          avviso, identici a quelli di un richiamo fissato a un cliente. */}
      <Scheda
        titolo="Aggiungi una cosa da fare"
        nota="Resta visibile a tutto il centro, con il nome di chi l'ha scritta"
        icona={Plus}
      >
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            aggiungi();
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={testoNuovo}
              onChange={(e) => setTestoNuovo(e.target.value)}
              placeholder="Ordinare le basi · portare il POS alla posa · richiamare il fornitore"
              className="h-9 min-w-[16rem] flex-1 text-[13px]"
              maxLength={500}
            />
            <Button type="submit" size="sm" disabled={!testoNuovo.trim() || salvando}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Aggiungi
            </Button>
            {/*  ── ⚠️ I DETTAGLI STANNO DIETRO UN TASTO, NON IN QUESTA RIGA ──
                A chi tocca, per quale cliente, e se si prende un pezzo di
                giornata: tre cose vere e tre campi in più: messi qui
                trasformerebbero la riga veloce in un modulo da compilare, e
                una riga che costa un modulo non si scrive. Chi ha altro da
                dire apre la finestra; gli altri battono invio come sempre. */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setFinestraAperta(true)}
              title="Assegna a qualcuno, collega un cliente, blocca l'agenda"
            >
              <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
              Con dettagli
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-muted-foreground">quando</span>
            {/*  «Oggi» è una pillola e non un campo vuoto: acceso di default,
                dice qual è la scelta senza chiedere niente. */}
            <Pillola attiva={!dataNuova || dataNuova === oggi} onClick={() => setDataNuova("")}>
              Oggi
            </Pillola>
            <Pillola
              attiva={dataNuova === fraGiorni(1, new Date(adesso))}
              onClick={() => setDataNuova(fraGiorni(1, new Date(adesso)))}
            >
              Domani
            </Pillola>
            <Input
              type="date"
              value={dataNuova || oggi}
              //  Non si può scegliere un giorno passato: una cosa da fare per
              //  l'altro ieri nasce già in ritardo, e nove volte su dieci è un
              //  anno battuto male. Le righe vecchie restano leggibili — il
              //  limite è sul campo, non sul dato.
              min={oggi}
              onChange={(e) => setDataNuova(e.target.value)}
              className="h-9 w-[9.5rem] text-[13px] tabular-nums"
              aria-label="Giorno in cui ricordare questa cosa da fare"
            />
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              a che ora
              <Input
                type="time"
                value={oraNuova}
                onChange={(e) => setOraNuova(e.target.value)}
                className="h-9 w-[7.5rem] text-[13px] tabular-nums"
              />
            </label>
          </div>

          {/*  ── DOVE FINIRÀ, DETTO PRIMA DI PREMERE ──────────────────────
              Compare solo quando la riga NON è per oggi, cioè quando premendo
              «Aggiungi» sparirebbe dallo schermo. È la stessa riga di controllo
              che sta sotto la data del richiamo in scheda: una data in cifre si
              legge ma non si controlla, e «2026-09-08» e «2026-08-09» si
              somigliano abbastanza da passare inosservati. */}
          {!!dataNuova && dataNuova !== oggi && (
            <p className="text-[11.5px] text-muted-foreground">
              <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
              Finirà fra le cose di{" "}
              <span className="font-medium text-foreground">
                {quandoInChiaro(dataNuova, oraNuova) || dataNuova}
              </span>{" "}
              · {distanzaInChiaro(dataNuova, oggi)} —{" "}
              {/*  ⚠️ Le due date non finiscono nello stesso posto, e dirlo con
                  una frase sola sarebbe una bugia su metà dei casi: il futuro
                  sparisce dietro un interruttore, il passato nasce in cima fra i
                  ritardi. Il campo qui accanto ha `min={oggi}`, ma una data si
                  può anche battere a mano, e allora la riga di controllo deve
                  raccontare quello che succede davvero. */}
              {dataNuova > oggi
                ? "oggi non comparirà nell'elenco: la trovi accendendo «Nei prossimi giorni»."
                : "è un giorno già passato: comparirà subito in cima, fra le cose rimaste indietro."}
            </p>
          )}
        </form>
      </Scheda>

      {/* ── I FILTRI SONO LENTI, NON PARETI ────────────────────────────────
          Il tipo di gesto non divide la pagina in blocchi (la divisione è per
          momento della giornata, vedi crm/dafare/righe.tsx): qui si spegne
          quello che in questo momento non si sta lavorando. Un setter spegne
          tutto tranne «Chiamate da rifare» e ha la sua lista; alle 18 si
          riaccende tutto e si controlla cosa resta. */}
      {/* ── SUL MONITOR: LA BANDA COM'ERA ─────────────────────────────── */}
      <BarraAzioni className="hidden lg:flex">
        {iTipiDiRiga}
        {gliAltriFiltri}
      </BarraAzioni>

      {/* ── SOTTO I 1024: I TIPI SCORRONO, IL RESTO STA IN UN FOGLIO ───── */}
      <div className="flex flex-col gap-1.5 lg:hidden">
        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {iTipiDiRiga}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFoglioFiltri(true)}
            aria-label="Tutti i filtri"
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition",
              filtriInPiu > 0
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtri
            {filtriInPiu > 0 && <span className="tabular-nums">{filtriInPiu}</span>}
          </button>
          {/*  ── ⚠️ COSA SI STA GUARDANDO IN PIÙ, O IN MENO ────────────────
              Su questa pagina conta il doppio: «Anche l'arretrato» e «Nei
              prossimi giorni» AGGIUNGONO righe che di solito non ci sono, e
              «solo le mie» ne TOGLIE. Chiusi in un foglio, si resta con una
              giornata che non è la propria senza sapere perché. */}
          {conArretrato && (
            <button
              type="button"
              onClick={() => setConArretrato(false)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11.5px]"
            >
              con l&apos;arretrato <X className="h-3 w-3 opacity-60" />
            </button>
          )}
          {conProssimi && (
            <button
              type="button"
              onClick={() => setConProssimi(false)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11.5px]"
            >
              e i prossimi giorni <X className="h-3 w-3 opacity-60" />
            </button>
          )}
          {soloMie && (
            <button
              type="button"
              onClick={() => setSoloMie(false)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11.5px]"
            >
              solo le mie <X className="h-3 w-3 opacity-60" />
            </button>
          )}
        </div>
      </div>

      {foglioFiltri && (
        <Finestra
          aperta={foglioFiltri}
          onCambio={setFoglioFiltri}
          icona={SlidersHorizontal}
          titolo="Filtri"
          larghezza="md"
        >
          <div className="flex flex-wrap items-center gap-2">{gliAltriFiltri}</div>
        </Finestra>
      )}

      {/* ── DOMANI, IN UNA RIGA ──────────────────────────────────────────────
          Sta in CIMA e non in fondo, ed è la sola cosa di questa pagina che
          non riguarda oggi: serve a chi alle sei di sera decide se restare
          mezz'ora in più. Chiusa è una riga con un numero — «Domani · 7» — e
          non toglie spazio al lavoro di adesso; aperta è l'elenco, con le sue
          ore. Non entra nei conteggi di oggi e non si mescola ai gruppi: è
          un'anteprima, e una lista di oggi che contiene domani non è più una
          lista di oggi. */}
      {domani.length > 0 && (
        <div className="rounded-2xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setApriDomani((v) => !v)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/40"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-[13.5px] font-semibold text-foreground">Domani</span>
            <span className="truncate text-[12px] text-muted-foreground">{giornoDomani}</span>
            <Badge
              n={domani.length}
              urgenza="info"
              className="ml-auto"
              titolo="Cose da fare domani"
            />
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                apriDomani ? "rotate-180" : ""
              }`}
            />
          </button>
          {apriDomani && (
            <ul className="divide-y divide-border border-t border-border">
              {domani.map((r) => (
                <VoceDaFare
                  nomeConsulente={nomeConsulente}
                  key={r.id}
                  riga={r}
                  adesso={adesso}
                  onApriLead={apriLead}
                  onSpunta={spunta}
                  onElimina={elimina}
                  onSposta={sposta}
                  occupato={salvando}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <NuovaCosa
        aperta={finestraAperta}
        onCambio={setFinestraAperta}
        oggi={oggi}
        adesso={adesso}
        persone={personeFiltro}
        io={consulente?.id
          ? { id: consulente.id, nome: consulente.nome || "Io" }
          : user?.id
            ? { id: user.id, nome: user.email || "Io" }
            : undefined}
        leads={leads}
        salvando={salvando}
        onCrea={(campi) => void creaConDettagli(campi)}
      />

      {caricando && (
        <p className="px-1 text-[12px] text-muted-foreground">Sto leggendo le cose da fare…</p>
      )}

      {nienteDaFare && !caricando ? (
        <Vuoto
          titolo="Non c'è niente da fare, oggi"
          icona={CircleCheckBig}
          testo={
            righe.length > 0
              ? "Ci sono righe, ma i filtri qui sopra le stanno nascondendo tutte."
              : //  ⚠️ La pagina vuota deve dire DOVE guardare, non solo che qui
                //   non c'è niente: se ci sono cose scritte per i prossimi
                //   giorni, «non c'è niente da fare» da solo è falso in un modo
                //   che si scopre lunedì mattina.
                nascoste.prossimi > 0
                ? `Niente per oggi. Ci sono però ${nascoste.prossimi} ${
                    nascoste.prossimi === 1 ? "cosa scritta" : "cose scritte"
                  } per i prossimi giorni: accendi «Nei prossimi giorni» qui sopra.`
                : "Nessun ricontatto fissato, nessuna consulenza da fissare e nessuna riga scritta a mano. Se qualcosa è rimasto indietro nei giorni scorsi, accendi «Anche l'arretrato»."
          }
        />
      ) : (
        FASCE.filter((f) => gruppi[f].length > 0).map((f) => {
          const tutte = gruppi[f];
          const daFare = tutte.filter((r) => !r.fatta).length;
          //  Il mucchio si accorcia solo dove può crescere senza limite, e solo
          //  finché nessuno ha chiesto di vederlo tutto.
          const conTetto = GRUPPI_CON_TETTO.includes(f) && tutte.length > TETTO_GRUPPO;
          const tuttoAperto = gruppiAperti.includes(f);
          //  ⚠️ LA FETTA NON SI RICALCOLA QUI: è quella di `mostrati`, la stessa
          //   su cui Maiusc+clic calcola il blocco. Due conti dello stesso
          //   taglio, e un giorno il blocco prende una riga che a schermo non
          //   c'è (o ne salta una che c'è).
          const mostrate = mostrati[f];
          //  Il comando dell'ordine si disegna sul mucchio che governa, e solo
          //  se quel mucchio ha davvero un ordine: sotto due righe sarebbe un
          //  pulsante che non fa niente in mezzo a chi legge e il lavoro.
          const conOrdine = FASCE_ARRETRATE.includes(f) && tutte.length >= MINIMO_PER_ORDINARE;
          return (
            <Scheda
              key={f}
              titolo={TITOLO_FASCIA[f]}
              nota={NOTA_FASCIA[f]}
              //  Il conteggio sta nello slot delle azioni e non dentro il
              //  titolo: il titolo di <Scheda> è `truncate`, e un badge infilato
              //  lì dentro è la prima cosa che viene tagliata quando la finestra
              //  si stringe — cioè sul telefono, dove il numero serve di più.
              azioni={
                <Badge
                  n={daFare}
                  //  Rosso sui due mucchi arretrati, e l'elenco di quali siano
                  //  si CHIEDE invece di riscriverlo: era `f === "arretrato" ||
                  //  f === "daIeri"`, cioè una terza copia delle stesse due
                  //  fasce accanto a quella dell'ordinamento e a quella del
                  //  comando. Basta che le tre smettano di combaciare perché un
                  //  mucchio si tinga di rosso e non si possa girare.
                  urgenza={
                    f === "adesso" ? "oggi" : FASCE_ARRETRATE.includes(f) ? "ritardo" : "info"
                  }
                  titolo={`${daFare} da fare in questo gruppo`}
                />
              }
              senzaPadding
            >
              {/*  ── IL VERSO DELL'ARRETRATO ──────────────────────────────
                  In testa al mucchio che governa e subito sopra la sua prima
                  riga, non in cima alla pagina insieme alle lenti: le lenti
                  dicono CHE COSA guardare e valgono per tutto lo schermo,
                  questo dice da che parte si legge UN mucchio — «Adesso» e
                  «Stamattina» restano in ordine di orologio, perché una giornata
                  non si legge al contrario.
                  È la stessa striscia, con le stesse parole, che sta in testa a
                  «Promesse mancate» e «Dimenticate» nella scheda «Oggi» della
                  coda del setter: un comando solo, una preferenza sola, salvata
                  fra un giro e l'altro (crm/dafare/arretrati). */}
              {conOrdine && <ScambiaVerso />}

              {/*  ⚠️ `aria-live` solo su «Adesso»: è l'unico gruppo che cambia
                  da solo mentre si guarda lo schermo, ed è quello che non si può
                  perdere. Metterlo su tutti farebbe leggere l'intera pagina a
                  ogni scatto dell'orologio. */}
              <ul
                className="flex flex-col gap-1.5 p-2"
                aria-live={f === "adesso" ? "polite" : undefined}
              >
                {mostrate.map((r) => (
                  <VoceDaFare
                    nomeConsulente={nomeConsulente}
                    key={r.id}
                    riga={r}
                    adesso={adesso}
                    onApriLead={apriLead}
                    onSpunta={spunta}
                    onElimina={elimina}
                    onSposta={sposta}
                    occupato={salvando || !!avanzamento}
                    onStatoLead={(l, s) => void cambiaStato(l, s)}
                    onQuandoLead={(l, d) => void cambiaQuando(l, d)}
                    onNotaLead={(l, t) => void aggiungiNota(l, t)}
                    //  Il quadratino c'è solo dove c'è una scheda dietro e la
                    //  riga non è già fatta: è la stessa condizione con cui
                    //  `selezionabili` costruisce l'elenco, e le due devono
                    //  combaciare — un quadratino su una riga che il blocco non
                    //  conosce si spunta e non entra nel conto.
                    scelta={selezione.has(r.id)}
                    onScegli={r.lead && !r.fatta ? (blocco) => scegliRiga(r.id, blocco) : undefined}
                  />
                ))}
              </ul>

              {/*  Il pulsante dice il NUMERO di quelle che non si vedono: «Mostra
                  le altre» senza una cifra è di nuovo un interruttore da premere
                  al buio. Quando è tutto aperto si può richiudere, perché il
                  mucchio va guardato una volta e poi tolto di mezzo. */}
              {conTetto && (
                <button
                  type="button"
                  onClick={() => apriGruppo(f)}
                  className="w-full border-t border-border px-3 py-2 text-left text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  {tuttoAperto
                    ? `Mostra solo le prime ${TETTO_GRUPPO}`
                    : `Mostra anche le altre ${tutte.length - TETTO_GRUPPO}`}
                </button>
              )}
            </Scheda>
          );
        })
      )}

      {!nienteDaFare && (
        <p className="flex items-start gap-1.5 px-1 text-[11.5px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Passa il mouse su una riga — o tocca la «i» — per vedere note, preventivo e importo
            senza aprire la scheda. Il pulsante con i cursori cambia esito, sposta il richiamo e
            aggiunge una nota senza uscire da qui; il clic sul nome apre la scheda completa.
          </span>
        </p>
      )}

      {/* ── LA BARRA DELLE AZIONI DI GRUPPO ─────────────────────────────────
          Compare solo con qualcosa selezionato, sta appiccicata in basso e
          segue lo scorrimento: le righe scelte sono sparse in cinque mucchi, e
          un comando in cima alla pagina si perderebbe di vista proprio mentre lo
          si sta usando.
          ⚠️ SI CONFERMA PRIMA E SI LEGGE LA RISPOSTA DOPO — la stessa disciplina
           dei lead importati. Prima: la barra dice per esteso cosa sta per
           succedere e su quante schede, perché un menu che scrive su venti righe
           al primo clic è un menu che si apre per sbaglio. Dopo: chi ha fallito
           resta selezionato e a schermo, perché una riga che sparisce dopo un
           errore è una riga che nessuno rifà. */}
      <BarraSelezione
        conteggio={selezionati.length}
        onAnnulla={() => {
          setPropostoGruppo(null);
          azzera();
        }}
      >
        {avanzamento ? (
          //  Il lavoro lungo si racconta mentre succede: sopra il lotto la
          //  scrittura ci mette qualche secondo, e un'attesa muta è
          //  indistinguibile da una pagina bloccata.
          <span className="px-2 text-[12.5px] tabular-nums text-muted-foreground">
            sto salvando… {avanzamento.fatti}/{avanzamento.totale}
          </span>
        ) : propostoGruppo ? (
          <>
            <span className="px-2 text-[12.5px]">
              Metti <span className="font-semibold">{LEAD_STATUS_LABEL[propostoGruppo]}</span> su{" "}
              <span className="font-semibold tabular-nums">{selezionati.length}</span>{" "}
              {selezionati.length === 1 ? "scheda" : "schede"}
              {selezionati.length > TETTO_SELEZIONE ? " — ci vorrà qualche secondo" : ""}
            </span>
            <Button
              size="sm"
              className="h-8 text-[12.5px]"
              onClick={() => {
                const st = propostoGruppo;
                setPropostoGruppo(null);
                void cambiaStatoInMassa(st);
              }}
            >
              Conferma
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12.5px]"
              onClick={() => setPropostoGruppo(null)}
            >
              Lascia stare
            </Button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[12.5px]"
                disabled={statiProponibili.length === 0}
                title={
                  statiProponibili.length === 0
                    ? "Nessuno stato si può dare a tutte queste schede insieme"
                    : "Cambia l'esito a tutte le righe scelte"
                }
              >
                Cambia esito
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="max-h-[60vh] overflow-y-auto">
              <DropdownMenuLabel className="text-[11.5px] font-normal text-muted-foreground">
                {/*  ⚠️ SI PROPONGONO SOLO GLI STATI VALIDI PER TUTTE. Una
                     selezione può mescolare righe ancora da chiamare e righe già
                     diventate trattative, e i due elenchi di stati sono diversi.
                     Quando l'intersezione è vuota il menu lo DICE, invece di
                     aprirsi vuoto e sembrare rotto. */}
                {statiProponibili.length > 0
                  ? `Su ${selezionati.length} ${selezionati.length === 1 ? "scheda" : "schede"}`
                  : "Niente in comune fra queste schede"}
              </DropdownMenuLabel>
              {statiProponibili.map((st) => (
                <DropdownMenuItem key={st} onSelect={() => setPropostoGruppo(st)}>
                  {LEAD_STATUS_LABEL[st]}
                </DropdownMenuItem>
              ))}
              {statiProponibili.length === 0 && (
                <DropdownMenuItem disabled className="text-[12px]">
                  Togli qualche riga dalla selezione
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!avanzamento && !propostoGruppo && (
          //  Gli stati che chiedono un giorno o degli importi non sono spariti:
          //  si danno a una riga per volta, e la barra dice DOVE — altrimenti la
          //  loro assenza si legge come un difetto e si cambia pagina.
          <span className="hidden px-1 text-[11.5px] text-muted-foreground sm:inline">
            appuntamenti e incassi: dal pulsante sulla riga
          </span>
        )}
      </BarraSelezione>

      {/* ── LA FINESTRA CONDIVISA DEGLI ESITI ────────────────────────────────
          Non è di questa pagina: è quella di tutto il CRM, e chiede giorno,
          ora e importi con le stesse regole ovunque la si apra. Qui la si monta
          e basta — gli stati che ne hanno bisogno li decide `requiresAnyDialog`,
          non un elenco ricopiato. */}
      <QuickStatusDialog
        open={!!quickLead && !!quickStato}
        onOpenChange={(v) => {
          if (v) return;
          setQuickLead(null);
          setQuickStato(null);
        }}
        lead={quickLead}
        newStatus={quickStato}
      />
    </Pagina>
  );
}
