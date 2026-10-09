/** ── LEAD IMPORTATI · UNO ALLA VOLTA ────────────────────────────────────────
 *
 *  CHI APRE QUESTA PAGINA HA IL TELEFONO IN MANO.
 *  Non sta studiando un file: sta chiamando duecento persone una dopo l'altra.
 *  Il suo gesto è sempre lo stesso e si ripete tutto il giorno — prendo il
 *  prossimo, lo chiamo, segno com'è andata, passo al successivo. Tutto ciò che
 *  non serve a quel giro di quattro mosse gli costa uno scorrimento di pagina
 *  ogni volta, cioè duecento scorrimenti.
 *
 *  ── COS'ERA QUESTA PAGINA, E PERCHÉ È STATA RIFATTA ────────────────────────
 *  Era una schermata di IMPORTAZIONE: si caricava un file, si guardavano nove
 *  righe di diagnostica su come erano state lette le colonne, si scriveva in
 *  archivio, e lì finiva. Le persone appena importate non si potevano chiamare
 *  da qui: bisognava cambiare pagina. Prima del file c'erano due riquadri di
 *  rimando ad altre due schermate e un terzo rimando nel titolo — tre inviti ad
 *  andarsene, in cima alla pagina, prima di qualunque cosa da fare.
 *  Ciò che è rimasto è rimasto perché serve a chi chiama; il resto è uscito.
 *  L'inventario, voce per voce, sta in fondo a questo commento.
 *
 *  ── LA CODA SI CALCOLA, NON SI TIENE ──────────────────────────────────────
 *  Non esiste da nessuna parte una lista «i lead da chiamare»: c'è l'archivio,
 *  e chi è da chiamare si riconosce dai suoi campi (arrivato da una lista +
 *  stato di primo contatto + eventuale richiamo già scaduto). Il vantaggio è
 *  che segnare un esito basta e avanza: il lead esce dalla coda da solo, e il
 *  prossimo diventa il primo senza che nessuno debba «avanzare». Nessun elenco
 *  parallelo da tenere allineato, quindi nessun elenco che un giorno si scolla.
 *
 *  ── UNA VOCE DI MENU SOLA, E UN ATTREZZO DIETRO ───────────────────────────
 *  Nel menu c'erano DUE voci quasi omonime: «Lead importati» (l'ELENCO, su
 *  /CRM/avanzamento, crm/kpi/DaFareScheda.tsx) e «Lead importati · uno alla
 *  volta» (questa). Adesso ne resta una, questa, e si chiama «Lead importati».
 *  L'elenco NON è stato cancellato: è uscito dal menu (`nascosta: true` in
 *  crm/CRMSidebar.tsx) e si raggiunge dal pulsante «Elenco completo» qui nella
 *  testata. La divisione del lavoro è la stessa di prima —
 *   · l'ELENCO serve a GUARDARE: venti righe, filtri per stato e consulente,
 *     azioni di gruppo su una selezione, esportazione in CSV, e la lente «Tutta
 *     la coda», che è l'unico posto in cui si vede cosa è in ritardo su tutto
 *     l'archivio e non solo sulle liste importate;
 *   · questa è la POSTAZIONE: una persona alla volta, grande, col numero e i
 *     pulsanti d'esito sotto il pollice. Serve a TELEFONARE.
 *  — solo che adesso una si apre dall'altra invece che dal menu accanto.
 *
 *  ⚠️ COSA HA DOVUTO PRENDERSI QUESTA PAGINA PRIMA CHE L'ALTRA USCISSE dal
 *   menu: caricare il CSV con l'anteprima (il pannello «Carica una lista»),
 *   dividere le schede fra i consulenti («Assegna») e cercare in TUTTO
 *   l'archivio (il campo in cima). Erano i tre gesti che l'elenco sapeva fare e
 *   la coda no, ed erano tutti e tre già qui: se un giorno uno di questi tre
 *   pannelli sparisce da questa schermata, sparisce dal menu del CRM.
 *  Nessuna delle due possiede i dati: possiede i dati l'archivio, e tutte e due
 *  lo leggono con le stesse funzioni (crm/import-backup, crm/ui, crm/types).
 *
 *  ⚠️ IL RICONOSCIMENTO DEI FILE NON STA QUI. Intestazioni in italiano e in
 *  inglese, separatore, stati con un altro nome, chi è nuovo e chi era già in
 *  archivio: tutto `crm/import-backup`. Riscriverne un pezzo qui vorrebbe dire
 *  che un giorno l'anteprima dice una cosa e l'importazione ne fa un'altra.
 *
 *  ── INVENTARIO: COSA C'ERA, COSA NE È STATO ───────────────────────────────
 *   TENUTO, perché serve a chi chiama
 *    · caricamento del file (CSV e backup JSON) e anteprima prima di scrivere;
 *    · scrittura in archivio a blocchi di 50;
 *    · divisione delle schede fra i consulenti (è l'UNICO punto del CRM che la
 *      fa: `dividiLead` non è chiamata da nessun altro file);
 *    · i contatti di ritorno — chi era già in archivio e ricompare nella lista
 *      — con le loro note in scheda: non più in un elenco a parte che spariva
 *      al file successivo, ma IN CIMA ALLA CODA, perché sono le telefonate
 *      migliori della giornata.
 *   RIDOTTO, perché serviva ma non a quel prezzo
 *    · la tabella «come vengono lette le colonne» (9 righe × 3 colonne, con i
 *      valori più frequenti): è diventata una riga — quali colonne sono state
 *      capite, quali sono rimaste fuori. La domanda vera è una sola, «il
 *      telefono è stato capito?», e si legge in un secondo;
 *    · l'anteprima riga per riga: da 5 righe × 8 colonne a 3 × 5;
 *    · il riepilogo finale da sei punti (di cui due sempre a zero): una riga.
 *   USCITO, perché era rumore per chi chiama
 *    · i due riquadri di rimando in cima («vai a Lead importati», «vai a
 *      Impostazioni → Dati») e il terzo rimando nel titolo. Del secondo resta
 *      una riga dentro il pannello del file, dove la domanda nasce davvero;
 *    · la scheda separata «Colonne rimaste fuori» (ora è nella stessa riga);
 *    · `FinestraRiFissa`, la procedura guidata locale per rifissare un meet:
 *      erano 130 righe di codice MORTO. Esisteva «finché la finestra condivisa
 *      non riconosce questo stato», ma `appuntamento_rifissato` sta in
 *      QUANDO_PER_STATO da un pezzo, quindi `requiresAnyDialog` era già vero e
 *      quella finestra non si apriva mai. Ora la data la chiede sempre e solo
 *      QuickStatusDialog, come nel resto del CRM.
 *   NUOVO, perché era il gesto che mancava
 *    · la coda e la scheda del prossimo: numero, tentativi, note, cornetta,
 *      WhatsApp, esiti a un tocco, salta, apri scheda, scorciatoie da tastiera;
 *    · la ricerca in cima («/»): il cliente RICHIAMA, e va trovato e messo
 *      davanti in due secondi anche se non è in coda. Cerca in tutto
 *      l'archivio, per nome e per cifre del numero;
 *    · i quattro numeri della giornata: in coda, da provare, segnati, richiami
 *      scaduti. Hanno preso il posto dei tre riquadri che stavano in fondo.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  useCallback,
} from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ClipboardList,
  ChevronRight,
  Clock,
  Copy,
  FileSpreadsheet,
  MessageCircle,
  MoreHorizontal,
  Phone,
  PhoneCall,
  RotateCcw,
  PhoneIncoming,
  Search,
  SkipForward,
  Sparkles,
  StickyNote,
  Table2,
  Undo2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth, useConsulenteCollegato, usePuo } from "@/crm/AuthContext";
//  Il motivo per cui un permesso manca è scritto una volta sola, in
//  crm/permessi: qui serve al rifiuto dell'eliminazione, che è l'unico comando
//  di questa pagina il cui pulsante non lo disegna la pagina (vedi
//  `puoEliminare`) e che quindi deve spiegarsi a parole invece di sparire.
import { MOTIVO_PERMESSO } from "@/crm/permessi";
import { useCRM } from "@/crm/CRMContext";
//  Chi fa le consulenze si chiede lì, e solo lì: vedi la testata di quel file.
import { soloConsulenti } from "@/crm/chi-fa-la-consulenza";
//  I mestieri (setter / consulente) si leggono da un posto solo: sono spunte
//  sulla scheda del collaboratore, e questa è la funzione che le interpreta.
import { mestieriDi } from "@/crm/kpi-setter";
import { NuovaCosa, type NuovaCosaCampi } from "@/crm/dafare/NuovaCosa";
import { creaCosaDaFare, liberaAgendaDi } from "@/crm/dafare/crea-cosa";
import {
  LEAD_STATUS_LABEL,
  STATI_DA_CHIAMARE,
  eAppuntamento,
  eStatoDaChiamare,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "@/crm/types";
//  La finestra che chiede giorno, ora e importi è quella del resto del CRM: qui
//  si CHIAMA, non si riscrive. Due procedure che chiedono la stessa data
//  finiscono per non chiederla nello stesso modo.
import { QuickStatusDialog, requiresAnyDialog } from "@/crm/QuickStatusDialog";
//  Chi ha PRESO l'appuntamento: non è chi ha toccato lo stato per ultimo né
//  chi lo farà. Vedi crm/chi-ha-fissato.
import { chiHaFissato, esitoFissato, fissataDa } from "@/crm/chi-ha-fissato";
//  ── LA NAVIGAZIONE A TRE PORTE ──────────────────────────────────────────
//  Quale stanza sta dentro quale porta, che numero va sulla porta e dove si
//  entra premendola: tutto lì, provato, e con l'elenco che garantisce che
//  nessuna delle otto viste di prima si sia persa.
import {
  contoReparto,
  repartiDaMostrare,
  repartoDi,
  sottoViste,
  vistaDiIngresso,
  type Vista as VistaImporta,
} from "@/crm/importa/reparti";
import { useChiusura } from "@/crm/ChiusuraDialog";
//  Anche il selettore di stato è uno solo (crm/SelettoreStatoDialog): da lì
//  arrivano la griglia completa, le icone per stato e — soprattutto — la regola
//  su QUALI stati proporre a QUESTO lead, che è di crm/types e non si scavalca.
import { FinestraStati, ICONA_STATO, statiSelezionabili } from "@/crm/SelettoreStatoDialog";
import { LeadDialog } from "@/crm/LeadDialog";
import { buildWhatsAppLink, getWhatsAppMessageForStatus } from "@/crm/whatsapp";
import {
  AiutoScorciatoie,
  CLASSE_BADGE_STATO,
  Kpi,
  KpiRiga,
  Pagina,
  SCORCIATOIE_COMUNI,
  Scheda,
  Segmento,
  Titolo,
  Vuoto,
  classiStato,
  dataBreve,
  dettoIlInChiaro,
  etichettaStato,
  giorniDaOggi,
  //  Le due funzioni con cui tutto il CRM confronta quello che si scrive in un
  //  campo di ricerca con quello che c'è in archivio: `normalizza` toglie
  //  accenti e maiuscole, `soloCifre` riduce un telefono alle sue cifre. Fanno
  //  lo stesso lavoro di `ultimeCifre` in crm/MeetGiornalieri — che però taglia
  //  alle ultime cinque, perché lì serve a MOSTRARE mezzo numero e qui a
  //  CERCARLO tutto — e stanno già in crm/ui, che questa pagina importa.
  normalizza,
  oggiIso,
  prossimaAzione,
  soloCifre,
  soloData,
  useScorciatoie,
  type Scorciatoia,
} from "@/crm/ui";
import { Pannello } from "@/crm/ui/Finestra";
//  Le risposte del modulo: riconosciute e lette in un punto solo, vedi la
//  testata di crm/modulo-lead.
import { vociModulo } from "@/crm/modulo-lead";
import {
  dividiLead,
  noteDelLead,
  separaRitorni,
  traduciArchivio,
  traduciCsv,
  type ArchivioCrm,
  type EsitoTraduzione,
} from "@/crm/import-backup";
//  Il salto che dura: dove sta scritto, da quanto, e come si torna in coda. La
//  regola è tutta lì dentro — questa pagina la usa, non se ne fa una sua.
import { PATCH_RIENTRO, eDimenticato, eSaltato, patchSalto } from "@/crm/importa/saltati";
//  Chi è già stato in archivio e ricompare in una lista: quante volte, e le due
//  vie per deciderlo. Anche qui la regola sta tutta nel modulo.
import {
  daRifissare,
  eContattatoWhatsApp,
  repartoDelRitorno,
  eSiFaVivoLui,
  eDaDecidere,
  eRimandato,
  etichettaRicarico,
  messaggioRifissa,
  storiaDelRitorno,
  patchConferma,
  patchContattatoWhatsApp,
  patchWhatsappConfermato,
  patchWhatsappNonInviato,
  patchRimettiInCoda,
  patchVediDopo,
  righeRicarico,
  volteRicaricato,
} from "@/crm/importa/ricarico";
//  Chi si telefona oggi e chi aspetta la sua data: una regola sola.
import { daTelefonareOggi, promessaPerDopo } from "@/crm/importa/da-telefonare";
//  ⚠️ Chi fa che mestiere: serve al filtro «di chi» della scheda «Oggi», ed è
//   la STESSA mappa e lo stesso filtro di /CRM/dafare — le due schermate
//   mostrano la stessa giornata da due porte diverse.
import { mappaMestieri } from "@/crm/dafare/di-chi";
import { SchedaRimandati } from "@/crm/importa/SchedaRimandati";
//  Le due stanze del magazzino: le schede ferme da mesi e le schede doppie.
//  Le regole stanno nei moduli provati, qui si disegnano soltanto.
import { SchedaRipesca } from "@/crm/importa/SchedaRipesca";
import { SchedaDoppioni } from "@/crm/importa/SchedaDoppioni";
import { dormienti, patchRipescato } from "@/crm/importa/ripesca";
import { doppioniPerTelefono, patchAssorbita, patchNonDoppione, patchUnione } from "@/crm/doppioni";
import { SchedaSaltati } from "@/crm/importa/SchedaSaltati";
//  L'elenco intero delle liste caricate, e l'unico posto di questa pagina in cui
//  si lavora a gruppi: prendi venti righe, cambi loro lo stato in un gesto.
import { SchedaTutti } from "@/crm/importa/SchedaTutti";
//  La cornetta sta in un file suo perché adesso la usano in due — la scheda
//  del prossimo e le righe scadute — e quel riquadro col numero è l'unica cosa
//  che rende il tasto onesto su un computer (vedi crm/importa/chiamare).
import { TastoChiama } from "@/crm/importa/chiamare";
import { Testata } from "@/crm/importa/Testata";
import { SchedaOggi } from "@/crm/importa/SchedaOggi";
import {
  FETTE_TEMPO,
  NOME_FETTA_TEMPO,
  SPIEGA_FETTA_TEMPO,
  dentroLaFetta,
  giornoLocale,
  type FettaTempo,
} from "@/crm/quando-stato";
//  ⚠️ Il pannello che legge il CSV vive in un file suo da quando lo usano DUE
//   pagine: questa e la scheda «Importa lead». Vedi crm/importa/PannelloCarica.
import { PannelloCarica } from "@/crm/importa/PannelloCarica";
import { calcolaScadenze, contaInRitardo } from "@/crm/importa/scadenze";
//  Le note che il setter si scrive sono le STESSE di «Da fare oggi»: stessa
//  lista, stessa riga di `app_config`. Una nota scritta qui si vede là, e
//  viceversa — vedi la nota in cima a crm/importa/scadenze.
import {
  applicaGesto,
  caricaTask,
  nuovoTask,
  useAvvisiTask,
  type TaskManuale,
} from "@/crm/dafare/task-manuali";

//  Lo scheletro delle azioni di gruppo — scorri a lotti, conta com'è andata,
//  aggiorna il contatore — sta in crm/azioni-di-gruppo: da oggi lo usa anche
//  «Da fare oggi», e due copie dello stesso ciclo divergono al primo ritocco.
import { aLotti, type EsitoRiga } from "@/crm/azioni-di-gruppo";
//  Il tipo della modifica è quello di `updateLead`: le azioni di gruppo
//  passano le STESSE patch delle righe singole, non una seconda versione.
import type { Modifica } from "@/crm/patch-scheda";

export const Route = createFileRoute("/CRM/importa")({
  head: () => ({ meta: [{ title: "Lead importati — CRM" }] }),
  component: LeadImportatiUnoAllaVolta,
});

/** Che cosa vuol dire, a voce, ogni fetta della coda. Sul filtro c'è il nome
 *  dello stato, che è corto; qui c'è il perché si preme, che è la cosa che a
 *  chi impara il mestiere non gliela dice nessuno. */
const SPIEGA_FETTA: Partial<Record<LeadStatus, string>> = {
  da_contattare: "Non li ha mai chiamati nessuno: sono le prime chiamate",
  non_risponde: "Hanno squillato a vuoto: ritenti rapidi, uno dietro l'altro",
  segreteria: "Hai lasciato un messaggio e stai riprovando",
  richiamo: "Gliel'hai promesso tu: questi hanno la precedenza su tutto",
};

/** ── UN FILTRO DELLA CODA ──────────────────────────────────────────────────
 *  Leggero di proposito: le linguette qui sopra sono piene di colore perché
 *  scelgono QUALE elenco si guarda, questo sceglie una FETTA dello stesso
 *  elenco. Due file di bottoni identici si leggono come dieci scelte pari.
 *  ⚠️ `shrink-0`: la fila scorre in orizzontale, e senza questa riga su uno
 *   schermo stretto i bottoni si schiacciano fino a nascondere il numero —
 *   che è la sola cosa che si guarda davvero prima di premere.
 *  ⚠️ A ZERO NON SPARISCE, SI SPEGNE: una fila che si accorcia mentre lavori
 *   sposta i bottoni sotto il dito che stava già scendendo. */
function FiltroCoda({
  attivo,
  onClick,
  conteggio,
  classePunto,
  titolo,
  children,
}: {
  attivo?: boolean;
  onClick: () => void;
  conteggio: number;
  /** le classi di colore dello stato: le stesse della targhetta sulla riga del
   *  lead, così il filtro si riconosce dal colore prima che dalla parola */
  classePunto?: string;
  titolo?: string;
  children: ReactNode;
}) {
  const vuoto = conteggio === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title={titolo}
      aria-pressed={attivo}
      disabled={vuoto && !attivo}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition",
        attivo
          ? "border-foreground/35 bg-foreground/[0.06] font-semibold text-foreground"
          : "border-border bg-card font-medium text-muted-foreground hover:border-foreground/25 hover:text-foreground",
        vuoto &&
          !attivo &&
          "cursor-not-allowed opacity-45 hover:border-border hover:text-muted-foreground",
      )}
    >
      {classePunto && (
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full border", classePunto)}
          aria-hidden="true"
        />
      )}
      <span className="whitespace-nowrap">{children}</span>
      <span
        className={cn("tabular-nums", attivo ? "text-foreground/70" : "text-muted-foreground/70")}
      >
        {conteggio}
      </span>
    </button>
  );
}

/** ── IL FILTRO DEL TEMPO ───────────────────────────────────────────────────
 *  Gemello di `FiltroCoda` ma più piccolo e senza pallino: è la SECONDA
 *  domanda — prima quale stato, poi da quando — e la gerarchia si legge dalla
 *  misura. Stesse regole per il resto: scorre, non si stringe, a zero si
 *  spegne invece di sparire. */
function FiltroQuando({
  attivo,
  onClick,
  conteggio,
  titolo,
  children,
}: {
  attivo?: boolean;
  onClick: () => void;
  conteggio: number;
  titolo?: string;
  children: ReactNode;
}) {
  const vuoto = conteggio === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title={titolo}
      aria-pressed={attivo}
      disabled={vuoto && !attivo}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition",
        attivo
          ? "border-foreground/30 bg-foreground/[0.05] font-semibold text-foreground"
          : "border-border/70 bg-card font-medium text-muted-foreground hover:border-foreground/20 hover:text-foreground",
        vuoto &&
          !attivo &&
          "cursor-not-allowed opacity-45 hover:border-border/70 hover:text-muted-foreground",
      )}
    >
      <span className="whitespace-nowrap">{children}</span>
      <span
        className={cn("tabular-nums", attivo ? "text-foreground/70" : "text-muted-foreground/70")}
      >
        {conteggio}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. CHI È DA CHIAMARE, E IN CHE ORDINE
   ═════════════════════════════════════════════════════════════════════════ */

/** Gli stati in cui la PRIMA CHIAMATA è ancora aperta.
 *  ⚠️ L'elenco NON è più scritto qui: sta in crm/types (`STATI_DA_CHIAMARE`),
 *   perché alla domanda «quante me ne restano da telefonare» rispondono questa
 *   coda, il conteggio in cima E l'elenco completo — e finché la definizione
 *   viveva dentro questa pagina, l'elenco completo contava ogni scheda
 *   importata, i «non interessato» compresi. */
const STATI_DA_CHIAMARE_SET = new Set<LeadStatus>(STATI_DA_CHIAMARE);

/** Un lead è in coda se è arrivato da una lista e la sua prima chiamata è
 *  ancora aperta.
 *  ⚠️ IL RICHIAMO CONCORDATO PER GIOVEDÌ NON SI CHIAMA OGGI. È l'unica
 *  eccezione, ed è una promessa fatta al cliente: telefonare prima del giorno
 *  che ha chiesto lui è il modo più rapido per farsi dire di no. Quando il
 *  giorno arriva rientra da solo, e ci rientra in cima (vedi `ordinaCoda`). */
function eDaChiamare(l: Lead): boolean {
  const d = l.data;
  if (!d || !d.importato) return false;
  /*  ⚠️ LA REGOLA NON STA PIÙ QUI DENTRO: stava qui e in nessun altro posto,
      e gli altri due che rispondono alla stessa domanda — l'elenco «Da
      chiamare in lista» e il numero sulla sua linguetta — guardavano solo lo
      stato. La stessa persona spariva dalla coda e restava nell'elenco: da
      fuori sembrava che la data del richiamo non servisse a niente. Adesso è
      una sola, provata, in crm/importa/da-telefonare. */
  return daTelefonareOggi(d);
}

/** ── L'ORDINE DEL GIRO ─────────────────────────────────────────────────────
 *  Tre chiavi, in quest'ordine, e ognuna risponde a una domanda diversa:
 *   1. l'urgenza di `prossimaAzione` — la stessa che ordina tutte le code del
 *      CRM: prima le promesse scadute, poi quelle di oggi, poi chi non ha una
 *      data. Non se ne inventa una seconda qui, altrimenti la stessa lista
 *      avrebbe due «primi» a seconda della schermata da cui la si guarda;
 *   2. i tentativi già fatti — chi non ha mai squillato viene prima di chi ha
 *      già rifiutato tre volte di rispondere: la probabilità che risponda è più
 *      alta e la lista rende di più;
 *   3. la data di ingresso — un contatto invecchia male: dopo una settimana
 *      non si ricorda più di aver lasciato il numero. */
function ordinaCoda(leads: Lead[]): Lead[] {
  return [...leads]
    .map((l) => ({
      l,
      urgenza: prossimaAzione(l).urgenza,
      tentativi: Number(l.data?.noRispondeCount) || 0,
      entrato: String(l.data?.createdAt || ""),
    }))
    .sort(
      (a, b) =>
        a.urgenza - b.urgenza || a.tentativi - b.tentativi || a.entrato.localeCompare(b.entrato),
    )
    .map((x) => x.l);
}

/** ── GLI ESITI A UN TOCCO ──────────────────────────────────────────────────
 *  L'elenco è più lungo di quanti pulsanti si vedano: a schermo arrivano solo
 *  quelli che `statiSelezionabili` considera validi PER QUESTO lead, e la
 *  regola è di crm/types. È il modo per avere lo stesso pulsante al posto
 *  giusto in due situazioni opposte senza deciderlo qui:
 *   · su una riga di lista chi non risponde è «Non risponde» (e porta con sé il
 *     contatore dei tentativi);
 *   · su un contatto di ritorno, che è già una trattativa, lo stesso silenzio è
 *     «Irreperibile» — perché con quella persona ci si è già parlati.
 *  Non compaiono mai insieme: i due elenchi di types.ts sono disgiunti.
 *  L'ORDINE È QUELLO DELLA FREQUENZA, non quello della speranza: in una
 *  giornata al telefono «non risponde» si preme dieci volte più spesso di
 *  «appuntamento», e il pulsante più premuto sta dove cade il pollice. */
const ESITI_RAPIDI: LeadStatus[] = [
  "non_risponde",
  "irreperibile",
  "segreteria",
  "richiamo",
  "da_ricontattare",
  //  ⚠️ Richiesta del committente: lo stato serve «sia per il setter sui lead
  //   importati sia sui lead effettivi». Questa è la coda del setter, e
  //   «mi richiama lui» è una delle risposte che si sentono più spesso: senza
  //   un tasto suo finiva schiacciata su «Ricontatto fissato», cioè su un
  //   impegno nostro che nessuno aveva preso.
  "ci_ricontatta_lui",
  "appuntamento_fissato",
  "appuntamento_rifissato",
  "annullato",
];

/** ── CHE COSA SI SCRIVE QUANDO SI DÀ UN ESITO ──────────────────────────────
 *  Non è soltanto `{ stato }`: «non risponde» e «segreteria» fanno anche +1 al
 *  contatore dei tentativi, che è la SECONDA chiave di `ordinaCoda` — chi non ha
 *  mai squillato viene prima di chi ha già rifiutato tre volte di rispondere.
 *
 *  ⚠️ LA REGOLA STA QUI E NON DENTRO `segna`, PERCHÉ GLI ESITI SI DANNO DA DUE
 *   PORTE: una scheda per volta dal riquadro del prossimo, e a gruppi dalla
 *   vista «Tutti». Finché stava dentro `segna`, quaranta «Non risponde» segnati
 *   in un gesto lasciavano il contatore a zero, e il mattino dopo la coda li
 *   rimetteva davanti a chi era stato provato una volta sola: cioè si
 *   richiamavano per primi proprio quelli appena provati. Un contatore che vale
 *   solo se si passa dalla porta giusta è peggio di nessun contatore, perché
 *   l'ordine della coda sembra comunque motivato.
 *
 *  ⚠️ Nel cambio in massa una scheda che HA GIÀ quello stato non passa di qui:
 *   non si scrive niente e il contatore non sale. È voluto — «prendi i quaranta
 *   Non risponde e segnali Non risponde» non è un giro di telefonate, è un clic
 *   a vuoto — e il numero delle «già così» si legge nel messaggio di fine. */
/** Il nome che si scrive nei messaggi. Il ripiego cambia con la frase, ed è per
 *  questo che è un argomento: da solo in un messaggio è «Il contatto» («Il
 *  contatto è stato messo da parte»), dentro un elenco di nomi è «senza nome»
 *  («Rossi, senza nome, Bianchi: sono rimaste com'erano»). La regola sotto è
 *  sempre la stessa — nome e cognome, e se non c'è né l'uno né l'altro si dice
 *  qualcosa invece di lasciare una frase che comincia con uno spazio. */
function nomeDi(l: Lead, ripiego = "Il contatto"): string {
  return `${l.data?.nome || ""} ${l.data?.cognome || ""}`.trim() || ripiego;
}

function patchEsito(l: Lead, stato: LeadStatus): Partial<LeadData> {
  const patch: Partial<LeadData> = { stato };
  //  `noRispondeCount` esisteva nel tipo, veniva importato dagli archivi e NON
  //  LO INCREMENTAVA NESSUNO: era un numero fermo a quello che diceva l'archivio
  //  di provenienza. Lo scrive questa pagina perché è qui che il fatto accade —
  //  si chiama e non risponde. La segreteria conta come tentativo: si è
  //  telefonato e non si è parlato con nessuno.
  if (stato === "non_risponde" || stato === "segreteria") {
    patch.noRispondeCount = (Number(l.data?.noRispondeCount) || 0) + 1;
  }
  return patch;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LA CORNETTA

   È in crm/importa/chiamare, con tutto il suo perché: da quando questa pagina
   ha una seconda scheda da cui si telefona (le scadenze), un tasto «Chiama»
   copiato sarebbe stato il primo dei due a tornare un tel: cieco che su un
   computer non fa niente.
   ═════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   3. LE NOTE DELLA SCHEDA

   Sono il motivo per cui una telefonata va diversamente dalle altre: «l'ultima
   volta ha detto di richiamarlo dopo le ferie» vale più di qualunque altro
   dato in pagina. Si vedono subito le due più recenti — la storia utile è
   quasi sempre lì — e le altre si aprono, senza cambiare pagina.
   ═════════════════════════════════════════════════════════════════════════ */

/** ── QUELLO CHE HA DETTO LUI, PRIMA DI COMPORRE IL NUMERO ──────────────────
 *  Le risposte date nel modulo dell'inserzione: come vive il problema, se ci
 *  conosce, la zona, e soprattutto QUANDO vuole essere chiamato.
 *  Sta qui e non solo nella scheda perché è qui che si alza la cornetta:
 *  chiamare alle dieci uno che ha scritto «sera» è il modo più veloce di
 *  bruciare un contatto pagato, e quell'informazione c'era già — sepolta in
 *  fondo alle note, dopo un «Dal modulo:».
 *  ⚠️ Niente riquadro quando non c'è niente: una lista caricata a mano non ha
 *   risposte, e un riquadro vuoto in cima alla scheda del prossimo è rumore su
 *   ogni singola telefonata. */
function VociModulo({ dati }: { dati?: Partial<LeadData> | null }) {
  const voci = useMemo(() => vociModulo(dati?.modulo), [dati]);
  if (!voci.length) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" />
        L'ha detto lui nel modulo
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {voci.map((v) => (
          <span
            key={v.campo}
            className="text-[12.5px] leading-snug"
            title={v.testo && v.testo !== v.valore ? v.testo : undefined}
          >
            <span className="text-muted-foreground">{v.titolo}: </span>
            <b
              className={cn(
                "font-semibold",
                v.tono === "buono" ? "text-emerald-700" : "text-foreground",
              )}
            >
              {v.valore}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}

function Note({ dati }: { dati?: Partial<LeadData> | null }) {
  const [tutte, setTutte] = useState(false);
  const note = useMemo(() => noteDelLead(dati), [dati]);
  //  Cambiando lead il riquadro riparte chiuso: restare aperto dal lead
  //  precedente fa credere che le note lunghe siano di questo.
  useEffect(() => setTutte(false), [dati]);

  if (!note.length) return null;
  const visibili = tutte ? note : note.slice(0, 2);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" />
        {note.length === 1 ? "1 nota in scheda" : `${note.length} note in scheda`}
      </div>
      <ul className={cn("space-y-1.5", tutte && "max-h-56 overflow-y-auto overscroll-contain")}>
        {visibili.map((n, i) => (
          <li key={i}>
            {(n.data || n.fonte) && (
              <span className="mr-1.5 text-[11px] font-medium text-muted-foreground">
                {n.data ?? n.fonte}
              </span>
            )}
            <span className="whitespace-pre-wrap break-words text-[12.5px] leading-snug">
              {n.testo}
            </span>
          </li>
        ))}
      </ul>
      {note.length > 2 && (
        <button
          type="button"
          onClick={() => setTutte((v) => !v)}
          className="mt-1.5 text-[11.5px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {tutte ? "Mostra solo le ultime due" : `Leggi tutte le ${note.length} note`}
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. LA SCHEDA DEL PROSSIMO — il cuore della pagina
   ═════════════════════════════════════════════════════════════════════════ */

/** Oltre questa soglia di tentativi a vuoto la domanda cambia: non è più «come
 *  lo raggiungo» ma «vale ancora la pena». Quattro è il numero che il committente
 *  usa a voce; sotto non si dice niente, perché un avviso che compare sempre
 *  smette di essere un avviso. */
const TENTATIVI_TROPPI = 4;

/** I colori del distintivo «che cos'era prima». Gli stessi toni del resto del
 *  CRM, e significano la stessa cosa: verde = è andata bene, ambra = c'è
 *  qualcosa in sospeso, grigio freddo = con noi non ha mai parlato davvero. */
function classiStoria(tono: "neutro" | "buono" | "attesa" | "freddo"): string {
  if (tono === "buono") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (tono === "attesa") return "border-amber-300 bg-amber-50 text-amber-800";
  if (tono === "freddo") return "border-slate-300 bg-slate-100 text-slate-600";
  return "border-border bg-muted text-muted-foreground";
}

function SchedaProssimo({
  lead,
  esiti,
  diRitorno,
  decisione,
  fuoriCoda,
  nomeConsulente,
  posizione,
  totale,
  onEsito,
  onAltri,
  onSalta,
  onApri,
}: {
  lead: Lead;
  /** gli esiti a un tocco, già filtrati sugli stati validi per questo lead.
   *  Arrivano dalla pagina e non si ricalcolano qui: le scorciatoie 1…9 devono
   *  puntare esattamente ai pulsanti che si vedono, e due elenchi calcolati in
   *  due punti diversi prima o poi si sfasano di una voce. */
  esiti: LeadStatus[];
  /** era già in archivio e il file appena caricato lo ha riportato a galla */
  diRitorno: boolean;
  /** ── LA DECISIONE SUL CONTATTO DI RITORNO ──────────────────────────────
   *  C'è solo quando la scheda aspetta di essere decisa: `null` per tutte le
   *  altre, che sono la stragrande maggioranza e non devono vedere niente.
   *  Le vie sono quelle chieste dal committente: «conferma e rimane così
   *  com'è», «lo sposta fra i da contattare e resetta lo stato», e — aggiunta
   *  dopo — «vedi dopo», che non decide niente e lo manda nella sua linguetta.
   *  ⚠️ La terza non è una scorciatoia per le altre due: è la risposta a «non
   *   lo so adesso», che prima non esisteva e si dava premendo «conferma». */
  decisione?: {
    onConferma: () => void;
    onRimetti: () => void;
    onVediDopo: () => void;
    /** Premuto il tasto di WhatsApp: la pagina ne prende nota e la scheda si
     *  sposta fra gli «Scritti su WhatsApp». Il messaggio si apre comunque. */
    onWhatsApp: () => void;
  } | null;
  /** ── QUESTO NON È IL PROSSIMO DELLA CODA ───────────────────────────────
   *  È qualcuno tirato su dalla ricerca che nella coda di oggi non c'è (ha già
   *  un esito, o una data futura, o non è mai arrivato da una lista). Chi
   *  guarda deve saperlo in una riga, perché tutto il resto della scheda è
   *  identico e senza quella riga si crede di stare avanzando nel giro: il
   *  «2 di 40 in coda» sotto il titolo direbbe una posizione che non esiste.
   *  `onTorna` è la via d'uscita che non scrive niente in archivio. */
  fuoriCoda?: { motivo: string; onTorna: () => void } | null;
  /** Il nome del consulente che segue questa scheda: entra nel messaggio di
   *  WhatsApp come firma. Vuoto = si firma con il solo nome della casa. */
  nomeConsulente?: string;
  posizione: number;
  totale: number;
  onEsito: (stato: LeadStatus) => void;
  onAltri: () => void;
  onSalta: () => void;
  onApri: () => void;
}) {
  const d = lead.data ?? ({} as LeadData);
  const nome = `${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome";
  const telefono = String(d.telefono || "");
  const tentativi = Number(d.noRispondeCount) || 0;

  const messaggio = useMemo(() => {
    try {
      return getWhatsAppMessageForStatus(lead);
    } catch {
      //  I modelli dei messaggi sono configurabili: uno rotto non deve
      //  impedire di telefonare, che è il lavoro vero di questa pagina.
      return "";
    }
  }, [lead]);
  const linkWhatsApp = telefono && messaggio ? buildWhatsAppLink(telefono, messaggio) : "";
  //  ── ⚠️ IL MESSAGGIO VA A TUTTI I CONTATTI DI RITORNO ────────────────
  //   Deciso col committente: prima usciva solo per chi aveva avuto un
  //   appuntamento; adesso anche a chi si era solo fatto vivo. Cambia la prima
  //   riga, non il resto — e a chi una consulenza non l'ha mai presa non si
  //   nomina nessuna data. La regola sta in `messaggioRifissa`.
  //   Si firma con il consulente della SCHEDA, non con chi sta al computer:
  //   è la persona che quel cliente ricorda di aver sentito.
  const messaggioRif = useMemo(
    () => messaggioRifissa(d, new Date(), nomeConsulente),
    [d, nomeConsulente],
  );
  const linkRifissa = telefono && messaggioRif ? buildWhatsAppLink(telefono, messaggioRif) : "";

  return (
    <Scheda
      titolo={fuoriCoda ? "Trovato con la ricerca" : "Il prossimo"}
      nota={fuoriCoda ? "fuori dalla coda di oggi" : `${posizione} di ${totale} in coda`}
      icona={fuoriCoda ? Search : Phone}
      azioni={
        <Button size="sm" variant="ghost" className="h-8 text-[12px]" onClick={onApri}>
          <User className="mr-1 h-3.5 w-3.5" /> Apri scheda
        </Button>
      }
    >
      <div className="space-y-3">
        {/*  Prima del nome, perché è la cornice in cui va letto tutto il
            resto: una riga, il tono informativo del CRM (cielo = «si sta
            lavorando adesso»), e il modo di tornare al giro. */}
        {fuoriCoda && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5">
            <p className="flex min-w-0 items-start gap-1.5 text-[12px] text-sky-900">
              <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {fuoriCoda.motivo}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 text-[11.5px] text-sky-900 hover:bg-sky-100"
              onClick={fuoriCoda.onTorna}
            >
              Torna alla coda
            </Button>
          </div>
        )}

        {/* ── CHI È ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[20px] font-semibold leading-tight">{nome}</h3>
              <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato))}>
                {etichettaStato(d.stato)}
              </span>
              {/*  Il contatto di ritorno si dichiara: cambia il tono della
                  telefonata (non ci si presenta da zero) e cambia gli esiti
                  possibili, che sono quelli di una trattativa. */}
              {(diRitorno || volteRicaricato(d) > 0) && (
                <span
                  className={cn(CLASSE_BADGE_STATO, "border-amber-300 bg-amber-50 text-amber-700")}
                  title="Era già in archivio ed è ricomparso in una lista importata"
                >
                  {/*  Il numero delle volte sta nel distintivo e non in una
                      riga a parte: è la prima cosa che cambia il tono della
                      telefonata — alla terza volta non si chiama come alla
                      prima. */}
                  <RotateCcw className="h-3 w-3 shrink-0" /> {etichettaRicarico(d) || "Di ritorno"}
                </span>
              )}
              {/*  ── ⚠️ E CHE COS'ERA PRIMA ─────────────────────────────────
                  Richiesta del committente: «sui lead di ritorno esca un
                  distintivo: se è stata fatta una consulenza, o se è solo
                  stato caricato, o se non risponde».
                  «Di ritorno» dice che è già passato di qui; questo dice COSA
                  è successo, e sono due telefonate diversissime. La regola sta
                  in `storiaDelRitorno` (crm/importa/ricarico), che legge lo
                  stato di ALLORA quando la scheda è stata rimessa in circolo —
                  altrimenti direbbe «mai chiamato» a chi la consulenza l'aveva
                  fatta. */}
              {(diRitorno || volteRicaricato(d) > 0) && (
                <span
                  className={cn(CLASSE_BADGE_STATO, classiStoria(storiaDelRitorno(d).tono))}
                  title={storiaDelRitorno(d).nota}
                >
                  {storiaDelRitorno(d).etichetta}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {[
                d.citta || null,
                d.fonte || null,
                d.createdAt ? `in lista dal ${dataBreve(d.createdAt)}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "nessun altro dato in scheda"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[17px] font-semibold tabular-nums tracking-wide">
              {telefono || "—"}
            </div>
            {tentativi > 0 && (
              <div
                className={cn(
                  "text-[11.5px]",
                  tentativi >= TENTATIVI_TROPPI
                    ? "font-medium text-rose-600"
                    : "text-muted-foreground",
                )}
              >
                {tentativi === 1 ? "1 tentativo a vuoto" : `${tentativi} tentativi a vuoto`}
              </div>
            )}
          </div>
        </div>

        {tentativi >= TENTATIVI_TROPPI && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-700">
            Ha già squillato a vuoto {tentativi} volte. Prima di riprovare, decidi: o si prova a un
            altro orario, o si chiude con «{LEAD_STATUS_LABEL.annullato}» e la lista smette di
            portarselo dietro.
          </p>
        )}

        {/* ── ⚠️ QUESTA PERSONA L'ABBIAMO GIÀ: DECIDI PRIMA DI CHIAMARE ───
            Richiesta del committente: il duplicato finisce qui dentro
            «mantenendo stato attuale, note e tutto», con due vie — conferma e
            resta com'è, oppure torna fra i da contattare con lo stato
            azzerato.
            Sta SOPRA il pulsante che telefona, e non in fondo alla scheda,
            perché è una decisione che cambia la telefonata: alla terza volta
            che una persona ricompare in una lista non si chiama come alla
            prima.
            ⚠️ LE RIGHE QUI DENTRO NON SI POSSONO MODIFICARE, ed è il modo in
             cui è stato chiesto. Non sono un campo protetto: non sono un campo
             affatto — si calcolano da `ricarico` ogni volta che si guardano
             (crm/importa/ricarico.ts), quindi non esiste nessun posto in cui
             riscriverle e non possono sfasarsi dal contatore. */}
        {decisione && (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-800">
              <RotateCcw className="h-3.5 w-3.5" /> Era già in archivio — decidi tu
            </div>
            <ul className="space-y-1">
              {righeRicarico(d).map((r, i) => (
                <li key={i} className="text-[12.5px] leading-snug text-amber-900">
                  {r}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 border-amber-300 bg-white text-[12.5px] hover:bg-amber-100"
                onClick={decisione.onConferma}
                title="Non cambia niente: stato, note, appuntamenti e storia restano quelli che sono. Esce solo da questa coda e torna dov'era"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" /> Conferma: lascialo com'è
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 border-amber-300 bg-white text-[12.5px] hover:bg-amber-100"
                onClick={decisione.onRimetti}
                title="Torna «Da contattare» in mezzo agli altri, con i tentativi a vuoto azzerati. Note, appuntamenti e storia NON si toccano"
              >
                <PhoneCall className="mr-1.5 h-3.5 w-3.5" /> Rimettilo fra i da contattare
              </Button>
              {/*  ── ⚠️ LA TERZA VIA: «NON LO SO ADESSO» ───────────────────
                  Richiesta del committente. Senza, la risposta onesta non
                  aveva un pulsante e si dava premendo «Conferma» — cioè si
                  lasciava tornare in circolo un duplicato che nessuno aveva
                  guardato, solo per togliersi il riquadro dagli occhi.
                  Sta per ultima e in tono più leggero delle altre due: è un
                  rinvio, non una decisione. */}
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-[12.5px] text-amber-900 hover:bg-amber-100"
                onClick={decisione.onVediDopo}
                title="Non decide niente: toglie questo riquadro dalla cima della coda e lo ritrovi nella linguetta «Vedi dopo», con le stesse scelte. Lo stato non si tocca e resta chiamabile come tutti gli altri"
              >
                <Clock className="mr-1.5 h-3.5 w-3.5" /> Vedi dopo
              </Button>
              {/*  ── ⚠️ E LA SCHEDA INTERA, DA QUI ─────────────────────────
                  Richiesta del committente: «sui lead di ritorno posso
                  cliccare e aprire la scheda lead». Decidere se una persona
                  torna in circolo guardando quattro righe è la ragione per cui
                  si preme «conferma» a caso: qui dentro c'è chi è, ma non
                  c'è la sua storia. Il pulsante in cima alla scheda esiste, ma
                  è lontano dalla domanda e non si collega a lei. */}
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-[12.5px] text-amber-900 hover:bg-amber-100"
                onClick={onApri}
                title="Apre la scheda intera: storia, note, appuntamenti e trattativa, per decidere sapendo"
              >
                <User className="mr-1.5 h-3.5 w-3.5" /> Apri la scheda
              </Button>
            </div>
            {/*  ── ⚠️ RIPRENDERE LA CONSULENZA CHE NON SI È FATTA ─────────
                Richiesta del committente: un pulsante che scrive su WhatsApp
                ricordando l'appuntamento che c'era, con la sua data, e chiede
                quando vuole rifissare.
                Compare solo per chi un appuntamento ce l'aveva davvero —
                fissato, rifissato, da riprogrammare, o cliente assente: a
                chiunque altro racconterebbe una cosa mai successa. Il testo lo
                compone `messaggioRifissa` (crm/importa/ricarico), che guarda
                anche lo stato di ALLORA: chi è stato rimesso fra i «da
                contattare» ha lo stato azzerato, ma l'appuntamento mancato è
                successo lo stesso. */}
            {linkRifissa && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9 w-full border-emerald-300 bg-white text-[12.5px] text-emerald-800 hover:bg-emerald-50"
              >
                {/*  ⚠️ PREMERE QUI NON SEGNA NIENTE: il clic dice soltanto
                    «apri WhatsApp». Al ritorno la pagina chiede se il
                    messaggio è partito davvero, e scrive solo il «sì» — vedi
                    la striscia in fondo. */}
                <a
                  href={linkRifissa}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => decisione.onWhatsApp()}
                >
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                  {daRifissare(d) && d.dataMeeting
                    ? `WhatsApp: «rifissiamo la consulenza del ${dataBreve(d.dataMeeting)}?»`
                    : "WhatsApp: «riprendiamo da dove eravamo rimasti»"}
                </a>
              </Button>
            )}
          </div>
        )}

        <VociModulo dati={d} />
        <Note dati={d} />

        {/* ── LE DUE VIE PER RAGGIUNGERLO ───────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <TastoChiama telefono={telefono} />
          {linkWhatsApp ? (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 flex-1 min-w-[9rem] text-[15px]"
            >
              <a href={linkWhatsApp} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          ) : (
            <Button
              size="lg"
              variant="outline"
              disabled
              className="h-12 flex-1 min-w-[9rem] text-[15px]"
              title="Serve un numero in scheda"
            >
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
            </Button>
          )}
        </div>

        {/* ── COM'È ANDATA ──────────────────────────────────────────────────
            Il numero sul pulsante è la scorciatoia da tastiera, e sta scritto
            SOPRA il pulsante e non dentro un manuale: una scorciatoia che non
            si vede non la usa nessuno. */}
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Com'è andata
          </div>
          <div className="flex flex-wrap gap-1.5">
            {esiti.map((s, i) => {
              const Icona = ICONA_STATO[s];
              return (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  className="h-10 text-[13px]"
                  onClick={() => onEsito(s)}
                >
                  {Icona && <Icona className="mr-1.5 h-3.5 w-3.5" />}
                  {LEAD_STATUS_LABEL[s]}
                  {i < 9 && (
                    <span className="ml-1.5 rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                  )}
                </Button>
              );
            })}
            <Button size="sm" variant="ghost" className="h-10 text-[13px]" onClick={onAltri}>
              <MoreHorizontal className="mr-1.5 h-3.5 w-3.5" /> Altro stato
            </Button>
            {/*  ⚠️ «Salta» NON È UN ESITO, ma non è più nemmeno gratis: scrive
                due campi sulla scheda (crm/importa/saltati.ts), quindi il gesto
                dura oltre la giornata e lo vede anche il collega. Serve a chi
                trova occupato e non vuole sporcare la scheda con un tentativo
                che non è stato un tentativo — lo stato non si tocca e i KPI non
                se ne accorgono. Il `title` lo dice prima di premere: qui il
                commento diceva ancora «non scrive niente», ed era la frase che
                faceva premere «Salta» credendo di rimandare di due minuti. */}
            <Button
              size="sm"
              variant="ghost"
              className="h-10 text-[13px]"
              onClick={onSalta}
              title="Mettilo da parte: esce dalla coda e finisce fra i «Lead saltati», anche domani e anche per gli altri. Non è un esito: lo stato resta com'è"
            >
              <SkipForward className="mr-1.5 h-3.5 w-3.5" /> Salta
              <span className="ml-1.5 rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                S
              </span>
            </Button>
          </div>
        </div>
      </div>
    </Scheda>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. CARICARE UNA LISTA — prima si guarda, poi si scrive

   Aprire un file NON tocca il database. Si legge, si mostra come è stato
   capito, e solo dopo compare il pulsante che scrive: un'importazione fatta al
   buio su ottocento schede non si annulla con un tasto, si annulla
   ricostruendo l'archivio.
   ═════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   6. DIVIDERE LE SCHEDE FRA I CONSULENTI

   Le schede appena importate arrivano senza padrone. A ogni scheda tocca chi
   ha meno carico in questa spartizione, a pari carico chi ha priorità più
   alta, e chi ha esaurito il massimo giornaliero viene saltato.
   Il carico storico NON entra nel conto: il massimo è giornaliero, e
   confrontarlo con le schede accumulate in mesi escluderebbe subito tutti.
   ⚠️ Questo è l'UNICO punto del CRM che chiama `dividiLead`. Se un giorno
   questa scheda sparisce, la spartizione automatica sparisce con lei.
   ═════════════════════════════════════════════════════════════════════════ */

function PannelloAssegna() {
  const { leads, consultants, reload, updateLead } = useCRM();
  const [lavoro, setLavoro] = useState<{ fatti: number; totale: number } | null>(null);

  const senzaConsulente = useMemo(() => leads.filter((l) => !l.data?.consulenteId), [leads]);
  const diLista = useMemo(
    () => senzaConsulente.filter((l) => l.data?.importato).length,
    [senzaConsulente],
  );
  /** ── SI SPARTISCE FRA CHI FA LE CONSULENZE ─────────────────────────────
   *  Questo pulsante scrive `consulenteId` su decine di schede in un colpo: è
   *  l'assegnazione più massiccia di tutto il CRM, e finché guardava l'anagrafica
   *  intera mandava schede da lavorare a driver e installatori — che per giunta,
   *  non avendo carico, il criterio «tocca a chi ha meno carico» sceglieva per
   *  primi. Il posto che dice chi fa consulenze è uno solo
   *  (crm/chi-fa-la-consulenza) ed è lo stesso di tutti gli elenchi; finché
   *  nessuno è segnato restituisce tutti, quindi il giorno del rilascio la
   *  spartizione è identica a quella di ieri.
   *  ⚠️ Qui NON si tiene dentro nessun «già assegnato»: si spartiscono per
   *  definizione le schede che un consulente non ce l'hanno. */
  const consulentiVeri = useMemo(() => soloConsulenti(consultants), [consultants]);
  const attivi = useMemo(
    () => consulentiVeri.filter((c) => c.data.attivo).length,
    [consulentiVeri],
  );

  const dividi = async () => {
    if (!senzaConsulente.length) {
      toast.message("Sono già tutte assegnate");
      return;
    }
    const quote = consulentiVeri.map((c) => ({
      id: c.id,
      nome: c.data.nome,
      attivo: !!c.data.attivo,
      max: c.data.maxCallGiorno ?? 10,
      priorita: c.data.priorita ?? 1,
    }));
    const { assegnazioni, nonAssegnati } = dividiLead(senzaConsulente, quote, {});
    if (!assegnazioni.length) {
      toast.error("Nessun consulente disponibile", {
        description:
          "Serve almeno un consulente attivo con un massimo giornaliero maggiore di zero.",
      });
      return;
    }
    setLavoro({ fatti: 0, totale: assegnazioni.length });
    let fatti = 0;
    for (const a of assegnazioni) {
      const l = senzaConsulente.find((x) => x.id === a.leadId);
      if (l) await updateLead(l.id, { consulenteId: a.consulenteId });
      fatti += 1;
      setLavoro({ fatti, totale: assegnazioni.length });
    }
    setLavoro(null);
    await reload();
    toast.success(`Assegnate ${assegnazioni.length} schede`, {
      description: nonAssegnati
        ? `${nonAssegnati} restano senza consulente: quote giornaliere esaurite.`
        : undefined,
    });
  };

  if (senzaConsulente.length === 0) {
    return (
      <Vuoto
        titolo="Tutte le schede hanno un consulente"
        testo="Non c'è niente da spartire: le schede senza padrone compaiono qui dopo un'importazione."
        icona={Users}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => void dividi()} disabled={!!lavoro}>
        {lavoro ? `Assegnazione… ${lavoro.fatti}/${lavoro.totale}` : "Dividi ora"}
      </Button>
      <p className="text-[12px] text-muted-foreground">
        {senzaConsulente.length} schede senza consulente
        {diLista > 0 && `, di cui ${diLista} arrivate da una lista`} · {attivi} consulenti attivi. A
        ogni scheda tocca chi ha meno carico; a pari carico, chi ha priorità più alta. Chi ha
        esaurito il massimo giornaliero viene saltato.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. LA RIGA IN CIMA — come sta la giornata, e chi ha appena richiamato

   Due mestieri diversi che stanno sulla stessa riga per la stessa ragione:
   sotto c'è il tasto Chiama, ed è lui il protagonista. Tutto ciò che si mette
   qui sopra spinge in basso la scheda del prossimo, cioè aggiunge uno
   scorrimento a duecento telefonate. Perciò niente riquadri e niente griglia:
   quattro numeri grandi con l'etichetta piccola sotto, e un campo.

   ⚠️ IL CONTATORE NON TIENE NIENTE DA PARTE. Ogni suo numero esce da quello
   che già comanda la pagina — la coda calcolata, `inFondo`, `segnate` — e non
   da un totale scritto da qualche parte che qualcuno debba ricordarsi di
   aggiornare dopo un esito. È tutta qui la ragione per cui si muove da solo a
   ogni esito e a ogni salto, senza ricaricare niente; un contatore fermo
   mentre si lavora è peggio di nessun contatore, perché lo si crede.
   ═════════════════════════════════════════════════════════════════════════ */

/*  ── DOV'È FINITA LA FILA DI CINQUE NUMERI ────────────────────────────────
    I cinque conteggi in riga (in coda · da provare · segnati · richiami scaduti
    · saltati) stavano qui, disegnati tutti uguali. Adesso sono in
    crm/importa/Testata, che li mette su tre livelli di lettura invece che su
    uno solo: il perché per esteso — e perché il protagonista è il numero delle
    promesse scadute — sta in cima a quel file.
    ⚠️ Il numero delle scadute NON si calcola più qui. Lo dà
     crm/importa/scadenze, cioè lo stesso conto della scheda «Oggi»: la fascia
     in cima e l'elenco che si apre premendola devono dire la stessa cifra.
     Il vecchio conto guardava solo la coda e ignorava i richiami concordati per
     un altro giorno — cioè taceva proprio le promesse che stavano per scadere. */

/** Quanti risultati si mostrano. Chi cerca sa già chi vuole — sta guardando il
 *  nome sul display del telefono che ha appena squillato: sei righe sono più
 *  che sufficienti a riconoscerlo, e oltre questa misura la ricerca diventa
 *  l'elenco che sta in /CRM/avanzamento. */
const RISULTATI_VISIBILI = 6;

/** Sotto tre cifre non è una ricerca per numero: un «33» da solo tirerebbe su
 *  mezzo archivio mentre si sta ancora scrivendo. */
const CIFRE_MINIME = 3;

/** Sotto questa lunghezza un campo «telefono» non è un numero, è quello che
 *  resta di un'importazione storta — un prefisso rimasto solo, uno zero. Serve
 *  al confronto all'incontrario qui sotto: senza questa guardia quel residuo
 *  combacerebbe con qualunque numero lungo che se lo porta dentro. */
const TELEFONO_PLAUSIBILE = 7;

/** ── DUE NUMERI COMBACIANO SE UNO STA DENTRO L'ALTRO, NEI DUE VERSI ────────
 *  ⚠️ Il verso che mancava era proprio quello che serve. Chi richiama lo si
 *  cerca copiando quello che il display del telefono ha appena scritto, e in
 *  Italia il display scrive «+39 333 1234567»: cercare `393331234567` dentro un
 *  archivio dove quel contatto è salvato come `333 1234567` non trovava niente,
 *  cioè falliva nel caso esatto per cui la ricerca è stata chiesta — e falliva
 *  in silenzio, dicendo «nessuno» di una persona che in archivio c'è.
 *  L'altro verso (il prefisso ce l'ha l'archivio e non chi cerca) funzionava
 *  già. Due `includes` invece di uno, e i sei modi di scrivere un numero
 *  smettono di contare. */
function numeroCombacia(inArchivio: string | null | undefined, cercate: string): boolean {
  const suo = soloCifre(inArchivio);
  if (suo.length < CIFRE_MINIME || cercate.length < CIFRE_MINIME) return false;
  return suo.includes(cercate) || (suo.length >= TELEFONO_PLAUSIBILE && cercate.includes(suo));
}

/** ── LA RICERCA ────────────────────────────────────────────────────────────
 *  Serve a UN caso, frequente e sempre lo stesso: il cliente RICHIAMA. Il
 *  telefono squilla mentre si sta chiamando qualcun altro, e quella persona va
 *  trovata e messa davanti in due secondi.
 *
 *  ⚠️ CERCA IN TUTTO L'ARCHIVIO, NON NELLA CODA. È la cosa più importante di
 *  questo pezzo. Chi richiama quasi sempre NON è in coda: è quello a cui hai
 *  segnato «non risponde» venti minuti fa, o quello con l'appuntamento fissato
 *  che vuole spostarlo. Una ricerca che guarda solo la coda fallisce
 *  esattamente nel caso per cui è stata chiesta, e fallisce in silenzio — dice
 *  «nessun risultato» di una persona che in archivio c'è.
 *
 *  Il numero si confronta a cifre nude: in archivio i telefoni arrivano dagli
 *  import scritti in sei modi diversi (+39, 0039, spazi, punti), e chi legge il
 *  display ne copia un settimo. Tre cifre sono il minimo perché un «33» da solo
 *  restituirebbe mezzo archivio. */
function RicercaContatto({
  leads,
  inCoda,
  campoRef,
  onScegli,
}: {
  leads: Lead[];
  /** gli id che stanno nella coda di oggi: il risultato lo dice, perché
   *  sceglierne uno che non c'è porta a una scheda diversa da quella attesa */
  inCoda: Set<string>;
  /** il campo lo mette a fuoco la scorciatoia «/» della pagina */
  campoRef: RefObject<HTMLInputElement | null>;
  onScegli: (l: Lead) => void;
}) {
  const [q, setQ] = useState("");

  /** ⚠️ La soglia («da qui in poi è una ricerca») e i risultati escono dallo
   *  STESSO calcolo. Tenerli separati — un `if` qui per filtrare e un altro giù
   *  per decidere se mostrare il riquadro — vuol dire che il giorno in cui una
   *  delle due cambia compare un riquadro vuoto, o peggio un riquadro che dice
   *  «nessuno» mentre i risultati ci sono. */
  const { attiva, righe } = useMemo(() => {
    const testo = normalizza(q).trim();
    const cifre = soloCifre(q);
    //  Sotto questa soglia non è una ricerca: è l'archivio intero che lampeggia
    //  sotto le dita mentre si scrive la prima lettera.
    if (testo.length < 2 && cifre.length < CIFRE_MINIME)
      return { attiva: false, righe: [] as Lead[] };
    const trovati = (leads ?? []).filter((l) => {
      const d = l?.data;
      if (!d) return false;
      if (numeroCombacia(d.telefono, cifre)) return true;
      return testo.length >= 2 && normalizza(`${d.nome || ""} ${d.cognome || ""}`).includes(testo);
    });
    //  Chi è già in coda viene prima: a parità di nome è quello che si sta
    //  lavorando oggi. Il resto dell'ordine resta quello dell'archivio.
    return {
      attiva: true,
      righe: trovati.sort((a, b) => Number(inCoda.has(b.id)) - Number(inCoda.has(a.id))),
    };
  }, [q, leads, inCoda]);

  /** Scelto: va davanti, il campo si svuota e si spegne. Il riquadro dei
   *  risultati non ha un suo «chiudi» perché non gli serve: esiste finché c'è
   *  qualcosa di scritto, e le tre strade per non avere più niente di scritto —
   *  sceglierne uno, la ✕, Esc — passano tutte da `setQ("")`, come il clic
   *  fuori (vedi l'`onBlur` del riquadro qui sotto). */
  const scegli = (l: Lead) => {
    onScegli(l);
    setQ("");
    campoRef.current?.blur();
  };

  return (
    <div
      className="w-full sm:w-72"
      //  ── IL CLIC FUORI CHIUDE ────────────────────────────────────────────
      //   ⚠️ I risultati galleggiano SOPRA la pagina (z-30) e vivevano finché
      //   c'era qualcosa di scritto: bastava scrivere due lettere e andare a
      //   premere «Chiama» perché restassero lì a coprire il nome e il tasto
      //   «Apri scheda» di chi si sta chiamando, senza un gesto ovvio per farli
      //   sparire (c'erano la ✕ e Esc, ma le dita provano prima il clic fuori).
      //   `onBlur` su un contenitore in React è `focusout`, che sale dai figli:
      //   se il fuoco è finito FUORI da questo riquadro la ricerca si svuota, e
      //   svuotandosi si chiude da sola. Un solo modo di sparire, quello di
      //   prima.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setQ("");
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={campoRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          //  Due tasti soli, e sono quelli che le dita premono da sole:
          //  Invio prende il primo risultato — il caso normale è che ce ne sia
          //  uno — ed Esc svuota. Esc arriva anche a `useScorciatoie`, che poi
          //  toglie il fuoco dal campo: le due cose insieme sono esattamente
          //  «lascia perdere, torna alla coda».
          onKeyDown={(e) => {
            if (e.key === "Enter" && righe[0]) {
              e.preventDefault();
              scegli(righe[0]);
            }
            if (e.key === "Escape") setQ("");
          }}
          placeholder="Ha richiamato? nome o numero  ( / )"
          aria-label="Cerca un contatto in tutto l'archivio"
          className="h-9 pl-8 pr-8 text-[13px]"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Cancella la ricerca"
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {attiva && (
        <div className="relative">
          {/*  I risultati galleggiano sopra la pagina invece di spingerla in
              giù: se aprissero spazio, il tasto Chiama scenderebbe di mezzo
              schermo a ogni lettera scritta. */}
          <div
            //  ⚠️ Premendo qui dentro il fuoco NON si sposta: se si spostasse,
            //   l'`onBlur` del riquadro svuoterebbe la ricerca e smonterebbe
            //   questa riga PRIMA che il clic le arrivi sopra. Su Safari e
            //   Firefox un pulsante premuto col mouse non prende nemmeno il
            //   fuoco, quindi lì il risultato scelto si perderebbe sempre — il
            //   guasto classico di ogni elenco che si apre sotto un campo.
            //   Il fuoco resta nel campo, il clic arriva, e a chiudere ci pensa
            //   `scegli` come prima.
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            {righe.length === 0 ? (
              //  Il silenzio non è una risposta: si dice che non c'è e si dice
              //  come si cerca, perché il dubbio vero è «l'avrò scritto giusto?».
              <p className="px-3 py-2.5 text-[12px] text-muted-foreground">
                Nessuno con «{q.trim()}». Prova col cognome, o con le ultime cifre del numero.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {righe.slice(0, RISULTATI_VISIBILI).map((l) => {
                  const d = l.data ?? ({} as LeadData);
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => scegli(l)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {`${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome"}
                          </span>
                          <span className="block truncate text-[11.5px] text-muted-foreground">
                            {d.telefono || "senza telefono"}
                            {/*  Tre risposte e non due: «non è in coda» su una
                                scheda messa da parte è vero e inutile: non dice
                                che c'è un modo di rimetterla dentro, e chi
                                cerca resta a chiedersi perché non la trova. */}
                            {inCoda.has(l.id)
                              ? " · in coda"
                              : eSaltato(l)
                                ? " · messo da parte"
                                : " · non è in coda"}
                          </span>
                        </span>
                        <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato))}>
                          {etichettaStato(d.stato)}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
                {righe.length > RISULTATI_VISIBILI && (
                  <li className="px-3 py-1.5 text-[11.5px] text-muted-foreground">
                    … e altri {righe.length - RISULTATI_VISIBILI}. Scrivi qualche lettera in più.
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. LA PAGINA
   ═════════════════════════════════════════════════════════════════════════ */

/** Quanti nomi si mostrano sotto la scheda del prossimo. Servono a sapere che
 *  la coda esiste e a saltare a uno preciso, non a essere letti: oltre cinque
 *  questa pagina ridiventa l'elenco che sta già in /CRM/avanzamento. */
const PROSSIMI_VISIBILI = 5;

/** Ogni quanto si riguarda l'orologio. Quindici secondi: è il passo di
 *  /CRM/dafare, e non trenta come il motore delle notifiche, perché qui c'è un
 *  conto alla rovescia scritto a schermo e un numero che scatta di mezzo minuto
 *  in mezzo minuto sembra un contatore rotto. Non un secondo, perché ridisegnare
 *  l'elenco sessanta volte al minuto non dice niente a nessuno. */
const PASSO_OROLOGIO_MS = 15_000;

const SCORCIATOIE: Scorciatoia[] = [
  ["1…9", "Segna l'esito"],
  //  La frase dice cosa succede DAVVERO adesso: prima il saltato tornava in
  //  fondo alla stessa coda, oggi esce dal giro e va nella sua scheda. Una
  //  scorciatoia che promette una cosa e ne fa un'altra è peggio che assente.
  ["S", "Mettilo da parte (esce dalla coda)"],
  ["A", "Apri la scheda del lead"],
  ...SCORCIATOIE_COMUNI,
];

function LeadImportatiUnoAllaVolta() {
  const { leads, consultants, updateLead, deleteLead } = useCRM();
  //  Il nome di chi sta lavorando, quando c'è: serve solo a firmare il salto,
  //  perché la stessa lista la girano in due e «l'ho messo da parte io» è
  //  un'informazione che cambia la telefonata.
  const { consulente, user } = useAuth();
  const puo = usePuo();
  //  Il permesso si chiede al COMANDO, non alla pagina: chi non può caricare
  //  una lista o assegnarla continua a vedere la sua coda e a telefonare, che è
  //  il motivo per cui apre questa schermata.
  const puoCaricare = puo("lead.crea");
  const puoAssegnare = puo("lead.assegna");
  /** ⚠️ QUESTO PERMESSO NON PUÒ NASCONDERE IL SUO PULSANTE, e va detto: il
   *  cestino sta su una riga d'elenco, e le righe le disegnano le schede
   *  (crm/importa/SchedaTutti, SchedaSaltati, SchedaOggi), non questa pagina.
   *  Gli altri due qui sopra spengono un tasto della testata perché quel tasto è
   *  scritto qui sotto; questo si controlla dov'è la scrittura — dentro
   *  `eliminaUno` e `eliminaMolti` — e quando manca lo dice con il motivo di
   *  `crm/permessi`. Un cestino che non fa niente si preme tre volte e poi si
   *  telefona per dire che la pagina è rotta. */
  const puoEliminare = puo("lead.elimina");

  /** I due pannelli di servizio nascono chiusi: chi arriva qui deve vedere una
   *  persona da chiamare, non un modulo da compilare. Si aprono quando servono
   *  — cioè una volta al giorno, non duecento. */
  const [caricaAperto, setCaricaAperto] = useState(false);
  const [assegnaAperto, setAssegnaAperto] = useState(false);
  const [aiutoAperto, setAiutoAperto] = useState(false);

  /** Gli id delle schede che il file appena letto ha riportato a galla. Vive
   *  quanto la sessione di lavoro su quel file: sono una coda di decisioni da
   *  prendere adesso, non un elenco da conservare. I lead, quelli, restano nel
   *  CRM come sempre — qui si tiene solo il fatto che sono ricomparsi.
   *
   *  UNA VOLTA DENTRO NON SI ESCE, fino al file successivo. Un contatto di
   *  ritorno a cui è stato segnato l'esito resta in coda, in fondo, con
   *  l'etichetta «già provato»: così l'elenco «Poi» racconta anche cosa quel
   *  file ha prodotto. Toglierlo appena segnato sarebbe più pulito da leggere e
   *  più pericoloso da usare — gli stati che aprono la finestra condivisa
   *  (giorno e ora) si possono ANNULLARE, e non c'è modo di saperlo da qui:
   *  chi annulla si ritroverebbe la persona sparita dalla coda senza averla
   *  lavorata, e senza un modo per farla tornare che ricaricare il file. */
  const [idRitorno, setIdRitorno] = useState<Set<string>>(new Set());

  /** ── DUE COSE DIVERSE CHE PRIMA ERANO UNA SOLA ─────────────────────────
   *  `inFondo` = «l'ho già toccato in QUESTO giro». Chi è già passato va in
   *  fondo, non fuori: «Non risponde» resta una riga da richiamare più tardi,
   *  non una riga chiusa. È giusto che viva in memoria e che muoia con la
   *  pagina, perché il giro è la passata di adesso: domani si ricomincia da
   *  capo, e infatti il tasto «Ricomincia il giro» non fa altro che svuotarlo.
   *
   *  ⚠️ IL SALTO NON STA PIÙ QUI. «Salta» era un ingresso in `inFondo` — cioè
   *   una decisione che si dimenticava al primo F5 e che il collega dall'altra
   *   postazione non vedeva. Adesso il salto si scrive sulla scheda
   *   (`crm/importa/saltati`), esce dalla coda ed entra nella vista «Lead
   *   saltati». Le due cose non vanno più rimescolate: un esito segnato manda
   *   in fondo al giro, un salto mette da parte la persona. */
  const [inFondo, setInFondo] = useState<Set<string>>(new Set());
  /** Quante ne ho segnate da quando ho aperto la pagina: è l'unico numero che
   *  dà il senso di avanzare quando la coda non cala (chi non risponde ci
   *  resta dentro). */
  const [segnate, setSegnate] = useState(0);
  /** Il lead scelto a mano dall'elenco «poi» o dalla ricerca: passa in testa.
   *  UNO SOLO, ed è voluto: «il prossimo» è una persona, e due meccanismi per
   *  scegliere chi sia — uno per l'elenco, uno per la ricerca — vorrebbero dire
   *  due schede che si contendono la testa della pagina. */
  const [forzato, setForzato] = useState<string | null>(null);

  /** ── LE QUATTRO VISTE ──────────────────────────────────────────────────
   *  La stessa pagina, gli stessi contatti, quattro domande diverse: «chi chiamo
   *  adesso», «cosa ho promesso e scade», «chi ho messo da parte», «fammi vedere
   *  tutta la lista». Stanno qui e non in quattro voci di menu — il perché è
   *  scritto in cima a crm/importa/SchedaSaltati.tsx e vale identico per le
   *  altre due.
   *  ⚠️ «TUTTI» È L'UNICA CHE NON GUARDA LA GIORNATA. Le altre tre mostrano per
   *   costruzione una fetta — la coda esclude chi ha già un esito, chi ha un
   *   appuntamento e chi è saltato — e quella fetta è giusta finché la domanda è
   *   «chi chiamo adesso». Quando la domanda diventa «quei venti che hanno detto
   *   di no, segnameli tutti insieme», nessuna delle tre sa rispondere: mostrano
   *   la coda di oggi, non la lista.
   *  Nasce sulla coda SEMPRE: chi apre questa pagina ha il telefono in mano. */
  //  Chi sta lavorando: serve alla lente «Fissati da me».
  const consulenteCollegato = useConsulenteCollegato();
  //  ⚠️ Il tipo è quello di `reparti.ts` e non un secondo elenco scritto qui:
  //   due elenchi di viste nello stesso file sono il modo di aggiungerne una e
  //   scoprire che non si può aprire.
  const [vista, setVista] = useState<VistaImporta>("coda");
  /*  ── ⚠️ CHI HO SISTEMATO ADESSO RESTA A SCHERMO ───────────────────────
      Segnalazione del committente: «quando clicco su un contatto, qualsiasi
      cosa faccio su quel contatto scompare; se metto appuntamento fissato e
      chiudo il popup deve rimanere lì, perché significa che devo selezionare
      altro».
      Gli id stanno QUI e non dentro l'elenco perché è questa pagina a sapere
      quando si cambia linguetta — ed è lì che si ricomincia da capo: la riga
      resta finché sei su quella scheda, non per sempre. La regola di che cosa
      si vede sta in crm/importa/elenco-stabile, dove si prova. */
  const [appenaSistemati, setAppenaSistemati] = useState<Set<string>>(new Set());
  const ricordaSistemato = useCallback((id?: string | null) => {
    const k = String(id || "");
    if (!k) return;
    setAppenaSistemati((p) => (p.has(k) ? p : new Set(p).add(k)));
  }, []);
  //  Cambiando linguetta l'elenco torna pulito: la difesa vale per il gesto in
  //  corso, non per sempre.
  useEffect(() => {
    setAppenaSistemati(new Set());
  }, [vista]);
  /** ── ⚠️ L'ULTIMO ESITO, PER POTERLO DISFARE ─────────────────────────────
   *  Richiesta del committente: «un pulsante per tornare indietro, se metto
   *  uno stato, e torna tutto come prima».
   *  Un esito si segna col telefono in mano e si sbaglia col telefono in mano:
   *  si preme «Non risponde» mentre la persona sta rispondendo. Finora
   *  l'unico rimedio era aprire la scheda e rimettere lo stato a mano — e
   *  intanto il tentativo era già contato e la persona era già scesa in fondo
   *  alla coda.
   *  Qui si tiene com'era PRIMA: lo stato, il contatore dei tentativi, la data
   *  da cui quello stato valeva, e se era già in fondo. «Come prima» vuol dire
   *  tutte e quattro. */
  const [ultimo, setUltimo] = useState<{
    id: string;
    nome: string;
    stato: LeadStatus;
    prima: Partial<LeadData>;
    eraInFondo: boolean;
  } | null>(null);
  /** ── ⚠️ QUALE FETTA DELLA CODA SI STA CHIAMANDO ─────────────────────────
   *  Richiesta del committente: la coda si apre già ottimizzata, ma un giro di
   *  telefonate non è mai tutto uguale. «Da contattare» sono le prime chiamate
   *  e si fanno col fiato lungo; «Non risponde» e «Segreteria» sono ritenti
   *  rapidi, venti numeri in dieci minuti, e si fanno in un momento morto;
   *  «Richiamo concordato» è una promessa e ha la precedenza su tutto.
   *  Mescolati costringono a cambiare testa a ogni scheda.
   *  ⚠️ «tutti» resta il valore di partenza, e deve restarlo: la coda ordinata
   *   è il lavoro giusto da fare: il filtro è per chi lo vuole spezzare, non
   *   una domanda da rispondere ogni mattina prima di cominciare. */
  const [fetta, setFetta] = useState<LeadStatus | "tutti">("tutti");
  /** ── ⚠️ DA QUANDO HA QUESTO STATO ───────────────────────────────────────
   *  Richiesta del committente: «se metto segreteria dev'essere categorizzato
   *  nel giorno corretto, e il giorno dopo devo poter filtrare per quando ho
   *  messo quello stato».
   *  È la seconda domanda di chi riprende un giro: non «chi è in segreteria»,
   *  ma «quali segreterie ho lasciato a metà ieri». Senza, l'unico modo era
   *  ricordarselo. */
  const [quando, setQuando] = useState<FettaTempo>("sempre");
  //  Il giorno di lavoro, non quello di Greenwich: vedi `giornoLocale`.
  const oggiQui = giornoLocale(new Date().toISOString());
  /** Vero mentre un rientro sta scrivendo in archivio: venti schede sono venti
   *  salvataggi, e nel frattempo i tasti non devono ripartire. */
  const [rientroInCorso, setRientroInCorso] = useState(false);
  /** Lo stesso, per il cambio di stato a gruppi. È un flag SUO e non quello del
   *  rientro: sono due scritture diverse in due schede diverse, e un flag solo
   *  spegnerebbe i tasti di una mentre lavora l'altra. */
  const [massaInCorso, setMassaInCorso] = useState(false);
  /** E ancora lo stesso, per l'eliminazione. Terzo flag e non il riuso di uno
   *  dei due: un'eliminazione in corso non deve spegnere il rientro dei saltati,
   *  che vive in un'altra scheda e non c'entra niente. Che POI, dentro la stessa
   *  scheda, i due tasti si spengano insieme è un'altra faccenda e si decide
   *  dove si passano le prop (vedi `inCorso` più sotto). */
  const [eliminazioneInCorso, setEliminazioneInCorso] = useState(false);
  /** ── QUANTO MANCA ──────────────────────────────────────────────────────
   *  Quante righe sono già state scritte durante un'azione di gruppo, nella
   *  stessa forma con cui `PannelloCarica` racconta l'importazione (`lavoro`,
   *  più su in questo file): si prende quella e non se ne inventa un'altra,
   *  perché è lo stesso fatto raccontato allo stesso modo — un numero che sale
   *  su un totale fermo.
   *  UNO SOLO per tutte e tre le azioni di gruppo: una sola può essere in corso
   *  (i flag qui sopra impediscono la seconda), e tre avanzamenti vorrebbero
   *  dire tre posti da spegnere alla fine invece di uno. `null` = non sta
   *  lavorando nessuno, ed è il segnale con cui la barra sparisce. */
  const [avanzamento, setAvanzamento] = useState<{ fatti: number; totale: number } | null>(null);

  /** ── LE NOTE SCRITTE A MANO ────────────────────────────────────────────
   *  Stanno sul server (`app_config`, chiave `crm_dafare_task`) e sono le
   *  STESSE di «Da fare oggi»: vedi crm/importa/scadenze. Si tengono qui in
   *  pagina, come fa /CRM/dafare, perché il gesto è «scrivi, spunta, butta» e
   *  ogni gesto rilegge dal server prima di riscrivere (`applicaGesto`) — è
   *  l'unica difesa contro due postazioni che si cancellano le note a vicenda. */
  const [task, setTask] = useState<TaskManuale[]>([]);
  const [taskInCaricamento, setTaskInCaricamento] = useState(true);
  const [taskInSalvataggio, setTaskInSalvataggio] = useState(false);
  /** L'orologio della pagina. UNO SOLO per tutte le righe: quaranta conti alla
   *  rovescia che leggono `Date.now()` ognuno per conto suo darebbero quaranta
   *  orari leggermente diversi sulla stessa schermata. Il passo è quello di
   *  /CRM/dafare, e per lo stesso motivo: un numero che scatta di trenta
   *  secondi in trenta sembra un contatore rotto. */
  const [adesso, setAdesso] = useState(() => Date.now());

  /** Il campo della ricerca, per la scorciatoia «/». Sta qui e non dentro
   *  RicercaContatto perché le scorciatoie della pagina le registra la pagina:
   *  «/» era già scritto in SCORCIATOIE_COMUNI («Vai alla ricerca») e in questa
   *  schermata non portava da nessuna parte, perché una ricerca non c'era. */
  const cercaRef = useRef<HTMLInputElement>(null);

  /** ── DA QUALE PORTA È ENTRATO L'ULTIMO ESITO ───────────────────────────
   *  `segna` sa se il gesto viene dal giro delle telefonate o dalla pastiglia di
   *  una riga d'elenco (è il suo terzo argomento, e lì c'è scritto perché la
   *  differenza conta). Solo che metà degli esiti non li scrive `segna`: li
   *  scrive una FINESTRA che si chiude dopo, e chi la chiude non vede più gli
   *  argomenti della chiamata che l'ha aperta. Qui si tiene l'ultima risposta.
   *  Un `useRef` e non uno `useState` per due motivi: non si disegna a schermo,
   *  quindi un ridisegno sarebbe sprecato; e serve LETTA AL MOMENTO DELLA
   *  CHIUSURA, non com'era al ridisegno in cui la finestra è stata montata.
   *  Vale perché le finestre sono modali e una per volta: mentre una è aperta
   *  nessun altro `segna` può partire, quindi quel valore è ancora suo. */
  const segnoDalGiro = useRef(true);

  /** Le due finestre condivise, una per volta. */
  const [quickLead, setQuickLead] = useState<Lead | null>(null);
  const [quickStato, setQuickStato] = useState<LeadStatus | null>(null);
  /** ── ⚠️ IL GIORNO APPENA FISSATO ────────────────────────────────────────
   *  Richiesta del committente: «se metto appuntamento fissato mi deve
   *  mostrare la lista di tutti i fissati del giorno».
   *  Chi fissa appuntamenti tutto il giorno ha bisogno di vedere COM'È MESSO
   *  quel giorno subito dopo averlo riempito di uno: è così che ci si accorge
   *  che giovedì ne ha già sette e mercoledì due, e la telefonata dopo si
   *  propone mercoledì. Prima bisognava aprire l'agenda, cioè cambiare pagina
   *  e perdere la coda.
   *  `null` = niente da mostrare. Si spegne da sé al prossimo esito. */
  const [giornoFissato, setGiornoFissato] = useState<string | null>(null);
  const [griglia, setGriglia] = useState<Lead | null>(null);
  const [scheda, setScheda] = useState<Lead | null>(null);

  /* ── L'OROLOGIO ─────────────────────────────────────────────────────────
     È ciò che fa salire in cima una riga quando il suo momento arriva, senza
     che nessuno tocchi niente: il calcolo è tutto in memoria, nessuna
     richiesta al server, nessun costo di rete. */
  useEffect(() => {
    const id = window.setInterval(() => setAdesso(Date.now()), PASSO_OROLOGIO_MS);
    return () => window.clearInterval(id);
  }, []);

  /* ── LE NOTE, DAL SERVER ────────────────────────────────────────────────
     ⚠️ LA RISPOSTA SI LEGGE. Una lettura fallita che finisse in una lista
      vuota sarebbe indistinguibile da «non hai ancora scritto niente», e la
      nota successiva scriverebbe sopra il lavoro dei colleghi. È la stessa
      disciplina — e le stesse parole — di /CRM/dafare. */
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const esito = await caricaTask();
      if (!vivo) return;
      setTaskInCaricamento(false);
      if (!esito.ok) {
        toast.error("Non riesco a leggere le tue note", { description: esito.errore });
        return;
      }
      setTask(esito.lista);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /* ── L'AVVISO QUANDO È IL MOMENTO ───────────────────────────────────────
     ⚠️ MANCAVA QUI, ED ERA LA MANCANZA PEGGIORE DELLE DUE PAGINE. Le note
      scritte a mano sono una lista sola con /CRM/dafare — stessa riga di
      `app_config` — e questa schermata le mostra e le scrive già (sotto-scheda
      «Oggi»); ma la scrittura nella campanella viveva solo là. Cioè: il setter
      passa la mattina QUI, si scrive «riprovare al fisso alle 18», e alle 18
      non suona niente perché la pagina che avvisa è quella che non ha aperta.
      La nota si vedeva in tutte e due, il promemoria arrivava in una.
      La regola non è ricopiata: è la stessa funzione (`useAvvisiTask`), stesse
      chiavi, stesse parole. Con le due schede aperte insieme non si sente due
      volte — il doppione lo ferma l'indice unico su (user_id, dedupe_key). */
  useAvvisiTask(task, adesso, user?.id);

  /** Un gesto solo per volta sulle note (aggiungi / spunta / elimina), e
   *  sempre per la stessa strada: rileggi dal server, applica, riscrivi. Vedi
   *  crm/dafare/task-manuali — passare la lista che sta a schermo cancella
   *  quello che i colleghi hanno scritto nel frattempo. */
  const gestoNota = async (gesto: Parameters<typeof applicaGesto>[0]) => {
    setTaskInSalvataggio(true);
    const esito = await applicaGesto(gesto);
    setTaskInSalvataggio(false);
    if (!esito.ok) {
      toast.error("Nota NON salvata", {
        description: esito.errore ?? "Sul server è rimasto tutto com'era. Riprova.",
      });
      //  Lo schermo NON cambia: una spunta che resta spuntata dopo un
      //  salvataggio fallito è una bugia che si scopre domani.
      return;
    }
    setTask(esito.lista);
  };

  /** ── LA FINESTRA DEI DETTAGLI ──────────────────────────────────────────
   *  La stessa di «Da fare oggi», e la stessa scrittura: le due pagine
   *  scrivono nella stessa lista, e due modi diversi di creare la stessa riga
   *  sono due formati destinati a divergere — con l'agenda bloccata da una
   *  parte e non dall'altra, senza che nessuno se ne accorga. */
  const [finestraCosa, setFinestraCosa] = useState(false);

  /** Le persone a cui si può dare una cosa da fare: setter e consulenti, come
   *  nel filtro di «Da fare oggi». */
  const personeTask = useMemo(
    () =>
      consultants
        .map((c) => ({
          id: c.id,
          nome: String(c.data?.nome ?? "").trim() || "Senza nome",
          m: mestieriDi(c.data),
        }))
        .filter((p) => p.m.faSetter || p.m.faConsulente)
        .map(({ id, nome }) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "it")),
    [consultants],
  );

  const creaCosaConDettagli = async (campi: NuovaCosaCampi) => {
    setTaskInSalvataggio(true);
    const esito = await creaCosaDaFare(
      campi,
      { id: consulente?.id || user?.id, nome: consulente?.nome || user?.email || "" },
      (g) => applicaGesto(g).then((r) => ({ ok: r.ok, errore: r.errore })),
    );
    setTaskInSalvataggio(false);
    if (!esito.ok) {
      toast.error("Nota NON salvata", {
        description: esito.errore ?? "Sul server è rimasto tutto com'era. Riprova.",
      });
      return;
    }
    const rilettura = await caricaTask();
    if (rilettura.ok) setTask(rilettura.lista);
    toast.success(
      esito.bloccata ? `Salvata, e l'agenda è bloccata dalle ${esito.task?.ora}` : "Salvata",
    );
    setFinestraCosa(false);
  };

  /** ── LA CODA ───────────────────────────────────────────────────────────
   *  Due sorgenti, un solo elenco senza doppioni:
   *   · i lead arrivati da una lista con la prima chiamata ancora aperta;
   *   · i contatti di ritorno del file appena letto, qualunque stato abbiano —
   *     il file ha appena rifatto il loro nome, e questo chiede una decisione.
   *  I secondi stanno in cima: è la telefonata che rende di più della giornata,
   *  perché con quella persona ci si è già parlati.
   *
   *  ⚠️ CHI È SALTATO NON È IN CODA, E VALE PER TUTTE E DUE LE SORGENTI —
   *   contatti di ritorno compresi. La tentazione era di fare un'eccezione («è
   *   ricomparso in una lista nuova, rimettiamocelo da soli»): sarebbe una
   *   scheda che rientra nel giro senza che nessuno l'abbia decisa, cioè
   *   esattamente il contrario di quello che il salto vuol dire. La regola resta
   *   una sola e si può raccontare in una frase — un saltato torna in coda
   *   quando qualcuno preme «Rimetti in coda» — e il fatto che sia ricomparso
   *   glielo scrive addosso la scheda dei saltati, che è dove va guardato. */
  const coda = useMemo(() => {
    const perId = new Map<string, Lead>();
    const ritorno: Lead[] = [];
    for (const l of leads ?? []) {
      if (!l?.data || eSaltato(l)) continue;
      /*  ── ⚠️ DUE MODI DI ESSERE «DI RITORNO», E UNO SOLO DURA ──────────
          `idRitorno` è il file appena letto IN QUESTA SCHERMATA: vive quanto
          la scheda del browser, e caricando da «Importa lead» non esiste
          proprio — era il buco per cui un duplicato non finiva da nessuna
          parte.
          `eDaDecidere` sta invece sulla scheda in archivio: ce lo scrive
          l'importazione, lo vede anche il collega, e resta finché qualcuno non
          preme uno dei due pulsanti. È la risposta alla domanda del committente
          «quando è duplicato dove va?»: va qui, in cima, e ci resta. */
      //  ⚠️ `eRimandato` esclude anche chi è di ritorno IN QUESTA schermata
      //   (`idRitorno`): premere «Vedi dopo» e ritrovarselo davanti un istante
      //   dopo, perché il file l'aveva riportato a galla, vorrebbe dire un
      //   pulsante che non fa niente.
      /*  ── ⚠️ CHI È STATO SCRITTO SU WHATSAPP ESCE DALLA CODA ──────────
          Segnalazione del committente: «una volta contattati su WhatsApp
          devono stare nel reparto contattati su WhatsApp».
          Qui c'era il difetto, e si vedeva solo subito dopo aver importato una
          lista — cioè proprio quando i contatti di ritorno si lavorano: questa
          riga escludeva chi era stato RIMANDATO ma non chi era stato SCRITTO,
          e `idRitorno` (il file appena letto in questa schermata) lo rimetteva
          in cima alla coda. La stessa persona stava in due posti, e si
          decideva due volte o nessuna.
          Le regole di fondo erano già giuste (vedi i tre predicati in
          crm/importa/ricarico, che si escludono a vicenda): era questa riga a
          scavalcarle. */
      /*  ⚠️ E CHI HA UNA PROMESSA PER UN ALTRO GIORNO NON STA IN CIMA ALLA
          CODA, nemmeno se è un contatto di ritorno: questo ramo non passava da
          `eDaChiamare`, quindi un ritorno a cui si era detto «ti richiamo fra
          due settimane» restava lì davanti tutti i giorni. Lo si ritrova nel
          reparto «Di ritorno», e il giorno della promessa torna in cima da sé. */
      if (promessaPerDopo(l.data)) continue;
      if ((idRitorno.has(l.id) && !eRimandato(l) && !eContattatoWhatsApp(l)) || eDaDecidere(l)) {
        ritorno.push(l);
        perId.set(l.id, l);
      }
    }
    const lista = ordinaCoda(
      (leads ?? []).filter((l) => l?.data && !eSaltato(l) && !perId.has(l.id) && eDaChiamare(l)),
    );
    return [...ordinaCoda(ritorno), ...lista];
  }, [leads, idRitorno]);

  /** ── I MESSI DA PARTE ──────────────────────────────────────────────────
   *  Si calcolano come la coda — si leggono dall'archivio, non si tengono in un
   *  elenco a parte — e per lo stesso motivo: un elenco parallelo sopravvive
   *  alle schede che lo compongono.
   *  ⚠️ NON si filtra per `eDaChiamare`: chi è stato saltato e nel frattempo ha
   *   preso un esito da un'altra pagina deve comunque comparire qui, altrimenti
   *   resterebbe con il salto addosso senza che nessuno possa più toglierglielo
   *   — invisibile qui, e per sempre fuori dalla coda. */
  const saltati = useMemo(() => (leads ?? []).filter((l) => l?.data && eSaltato(l)), [leads]);

  /** Chi fa che mestiere, per il filtro della scheda «Oggi». Si costruisce qui
   *  perché è la pagina ad avere i collaboratori, e con la funzione condivisa
   *  perché due letture delle stesse spunte finirebbero per non essere più la
   *  stessa lettura. */
  const mestieriDelCentro = useMemo(() => mappaMestieri(consultants), [consultants]);

  /** ── ⚠️ I «VEDI DOPO»: LE DECISIONI RIMANDATE ─────────────────────────
   *  Richiesta del committente: oltre a «conferma» e «rimettilo fra i da
   *  contattare», poter dire «vedi dopo» — e avere una scheda con tutti i
   *  rimandati, dove ci sono di nuovo le due opzioni.
   *  ⚠️ Rimandare NON toglie la persona dalla coda delle telefonate: toglie
   *   la DOMANDA dalla cima. Chi è qui dentro si chiama come tutti gli altri,
   *   al suo turno; quello che è stato messo da parte è il riquadro giallo.
   *  In ordine di rinvio, i più vecchi in cima: è l'ordine in cui vanno
   *   smaltiti, e se il più vecchio finisse in fondo resterebbe lì per sempre. */
  const rimandati = useMemo(
    () =>
      (leads ?? [])
        //  ⚠️ NON si filtra a mano: la destinazione la decide una funzione
        //   sola (vedi `repartoDelRitorno`). Qui c'era `eRimandato(l)` e basta,
        //   e per questo un rimandato messo da parte compariva in due elenchi
        //   mentre un «di ritorno» messo da parte non compariva in nessuno.
        .filter((l) => l?.data && repartoDelRitorno(l) === "rimandato")
        .sort((a, b) =>
          String(a.data?.ricarico?.rimandatoIl ?? "").localeCompare(
            String(b.data?.ricarico?.rimandatoIl ?? ""),
          ),
        ),
    [leads],
  );

  /** ── ⚠️ QUELLI A CUI HO SCRITTO SU WHATSAPP ───────────────────────────
   *  Richiesta del committente: «quando clicco contatta su WhatsApp ai lead
   *  duplicati importati, fai che si spostano dentro contattati su WhatsApp,
   *  aggiungi il loro filtro».
   *  Il messaggio partiva e non lasciava traccia: la scheda restava in cima
   *  alla coda come se nessuno avesse fatto niente, e il giorno dopo non si
   *  sapeva se era stato mandato. Con dieci duplicati diventa: o si riscrive a
   *  due persone, o non si riscrive a nessuna.
   *  I più vecchi in cima: sono quelli che aspettano da più tempo una risposta,
   *  e sono i primi da chiudere — in un modo o nell'altro. */
  const contattatiWa = useMemo(
    () =>
      (leads ?? [])
        //  Stessa regola, stessa funzione: vedi `rimandati` qui sopra.
        .filter((l) => l?.data && repartoDelRitorno(l) === "whatsapp")
        .sort((a, b) =>
          String(a.data?.ricarico?.whatsappIl ?? "").localeCompare(
            String(b.data?.ricarico?.whatsappIl ?? ""),
          ),
        ),
    [leads],
  );

  /** ── IL REPARTO «DI RITORNO» ───────────────────────────────────────────
   *  Richiesta del committente: «tutte le persone di ritorno stanno nel loro
   *  filtro».
   *  Finora i contatti di ritorno stavano SOLO in cima alla coda delle
   *  telefonate, mescolati alle prime chiamate: non si potevano contare, né
   *  lavorare tutti insieme, né ritrovare il giorno dopo. Adesso hanno la loro
   *  linguetta — e restano anche in cima alla coda, con una fascia che li
   *  richiama, perché è la telefonata che rende di più della giornata e
   *  nasconderla dentro un reparto vorrebbe dire non farla più.
   *  ⚠️ CHI È STATO SCRITTO O RIMANDATO NON È QUI: ha già il suo reparto. Una
   *   persona sta in un elenco solo — è tutta la richiesta. */
  const diRitorno = useMemo(
    () => ordinaCoda((leads ?? []).filter((l) => l?.data && repartoDelRitorno(l) === "ritorno")),
    [leads],
  );

  /** ── E CHI HA DETTO CHE RICHIAMA LUI ───────────────────────────────────
   *  Seconda metà della stessa richiesta: «di ritorno» non è solo chi
   *  ricompare in una lista, è anche chi si è fatto vivo e ha detto che
   *  richiama lui. Sta nello stesso reparto, in una fascia sua.
   *  ⚠️ IN UNA FASCIA A PARTE E NON MESCOLATO, perché non ha un `ricarico`: le
   *   due decisioni del contatto di ritorno («conferma» / «rimettilo fra i da
   *   contattare») su di lui non scriverebbero niente, e sarebbero due
   *   pulsanti che non fanno niente. Qui i gesti sono i suoi: aprire la scheda
   *   e vedere quando l'ha detto.
   *  ⚠️ Chi ha una promessa scaduta compare ANCHE in «Oggi»: quella è la
   *   linguetta dell'orologio, non un reparto, e serve proprio a non far
   *   scadere le promesse. */
  const siFannoViviLoro = useMemo(
    () =>
      (leads ?? [])
        .filter((l) => l?.data && !eSaltato(l) && eSiFaVivoLui(l))
        .sort((a, b) =>
          String(a.data?.ciRicontattaDettoIl ?? "").localeCompare(
            String(b.data?.ciRicontattaDettoIl ?? ""),
          ),
        ),
    [leads],
  );

  /** ── ⚠️ GLI APPUNTAMENTI CHE HO FISSATO IO ──────────────────────────────
   *  Richiesta del committente: «i lead che ha schedulato il setter deve avere
   *  sempre lì il filtro dei suoi lead che ha schedulato, che se vuole
   *  modificare qualcosa può farlo».
   *  Un setter passa la mattina a fissare appuntamenti e poi, nel pomeriggio,
   *  uno gli cambia l'ora. Finora non aveva nessun modo di ritrovarlo: la sua
   *  pagina è la coda di chiamata, e da lì quella persona era USCITA nel
   *  momento stesso in cui ha preso l'appuntamento. L'unica strada era la
   *  ricerca per nome — cioè ricordarselo.
   *  ⚠️ SI LEGGE `statoDa`, NON `consulenteId`: il secondo dice chi FARÀ la
   *   consulenza, che è quasi sempre un'altra persona. Il primo lo scrive
   *   `updateLead` a ogni cambio di stato (vedi crm/types).
   *  ⚠️ Le schede toccate prima che quel campo esistesse non compaiono, e non
   *   è una svista: dire «l'ha fissato lui» senza saperlo sarebbe peggio di
   *   non dirlo. Lo spiega la stanza vuota.
   *  ⚠️ Non si filtra per `importato`: un appuntamento preso su un contatto di
   *   ritorno è comunque un appuntamento che ha preso lui, e cercarlo qui è la
   *   prima cosa che farebbe. */
  /** Tutti gli appuntamenti di un giorno, di chiunque. ⚠️ DI CHIUNQUE e non
   *  solo i propri: la domanda è «quel giorno è pieno?», e un giorno è pieno
   *  anche degli appuntamenti degli altri — proporne un ottavo guardando solo
   *  i propri due è il modo di accorgersene quando il cliente è già in linea. */
  const delGiorno = useMemo(() => {
    if (!giornoFissato) return [] as Lead[];
    return (leads ?? [])
      .filter(
        (l) =>
          l?.data && eAppuntamento(l.data.stato) && soloData(l.data.dataMeeting) === giornoFissato,
      )
      .sort((a, b) => (a.data?.oraMeeting || "99:99").localeCompare(b.data?.oraMeeting || "99:99"));
  }, [leads, giornoFissato]);

  /*  ── ⚠️ RIFATTO: IL LAVORO DEL SETTER NON SPARISCE QUANDO VA MALE ──────
      Segnalazione del committente: «dopo che fissa le consulenze non può più
      vedere la lista di quello che ha fissato».
      Qui c'erano DUE condizioni e sbagliavano tutte e due:
       · `statoDa === io` — ma `statoDa` è «chi ha toccato lo stato per
         ultimo», quindi passava al consulente appena segnava l'esito;
       · `eAppuntamento(stato)` — quindi bastava un «non si è presentato» o un
         «venduto» e la riga usciva lo stesso.
      Il lavoro del setter è AVER FISSATO: come sia finita è una colonna
      (`esitoFissato`), non un motivo per cancellargliela. Adesso si legge
      `chiHaFissato`, che è scritto una volta sola e non si riscrive. */
  const miei = useMemo(() => {
    const io = consulenteCollegato?.id;
    if (!io) return [] as Lead[];
    return (leads ?? [])
      .filter((l) => l?.data && fissataDa(l.data, io))
      .sort((a, b) => {
        /*  ⚠️ PRIMA QUELLE CHE DEVONO ANCORA ARRIVARE, dalla più vicina: sono
            quelle su cui si può ancora fare qualcosa (un'ora da spostare, un
            promemoria da mandare). Le passate restano sotto, dalla più
            recente: sono lo storico del proprio lavoro, e si guardano
            dall'ultima. Ordinarle tutte insieme in avanti metteva in cima la
            consulenza di tre mesi fa. */
        const oggi = new Date().toISOString().slice(0, 10);
        const ga = soloData(a.data?.dataMeeting) || "9999-99-99";
        const gb = soloData(b.data?.dataMeeting) || "9999-99-99";
        const futA = ga >= oggi;
        const futB = gb >= oggi;
        if (futA !== futB) return futA ? -1 : 1;
        const ka = `${ga} ${a.data?.oraMeeting || "99:99"}`;
        const kb = `${gb} ${b.data?.oraMeeting || "99:99"}`;
        return futA ? ka.localeCompare(kb) : kb.localeCompare(ka);
      });
  }, [leads, consulenteCollegato?.id]);
  /** Com'è finito il lavoro del setter, in una riga. ⚠️ Serve perché l'elenco
   *  adesso tiene dentro anche le consulenze andate male: senza un riassunto,
   *  trenta righe miste si leggono come un elenco di cose storte. */
  const riassuntoMiei = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of miei) {
      const e = esitoFissato(l.data);
      c.set(e, (c.get(e) ?? 0) + 1);
    }
    return (["in piedi", "andata", "da recuperare", "persa"] as const)
      .filter((k) => c.get(k))
      .map((k) => `${c.get(k)} ${k}`)
      .join(" · ");
  }, [miei]);
  const saltatiFermi = useMemo(() => saltati.filter(eDimenticato).length, [saltati]);

  /** ── TUTTO QUELLO CHE È ARRIVATO DA UNA LISTA ──────────────────────────
   *  Nessun altro filtro: né lo stato, né il salto, né la coda del giorno. È
   *  l'unico elenco di questa pagina che non risponde a una domanda della
   *  giornata ma alla domanda «cos'ho importato», ed è quello su cui si lavora a
   *  gruppi (vedi crm/importa/SchedaTutti).
   *  ⚠️ SI CALCOLA UNA VOLTA SOLA e serve due posti — la scheda «Tutti» e il
   *   conto delle scadenze, che partiva dallo stesso identico filtro scritto
   *   un'altra volta poche righe più sotto. Due volte lo stesso filtro sono due
   *   idee di «lead importato» che un giorno divergono. */
  const importati = useMemo(() => (leads ?? []).filter((l) => l?.data?.importato), [leads]);
  /** Quante ne restano da telefonare, di tutte le liste caricate. È il numero
   *  che va sulla linguetta: «quanti ne ho importati» non è una domanda che
   *  qualcuno si fa col telefono in mano. La definizione è quella della coda
   *  (crm/types), non una seconda scritta qui. */
  //  ⚠️ Lo stesso conto della coda e dell'elenco: chi ha una promessa per un
  //   altro giorno non è «da chiamare» oggi (crm/importa/da-telefonare).
  const daChiamareInLista = useMemo(
    () => importati.filter((l) => daTelefonareOggi(l.data)),
    [importati],
  );

  /** Quanti ce n'è per ogni stato di prima chiamata. ⚠️ Si contano sulla CODA
   *  intera e non sulla fetta scelta: sono i numeri scritti sui filtri, e un
   *  filtro che mostra il conteggio di sé stesso direbbe sempre «tutti». */
  /*  ── ⚠️ OGNI FILA CONTA CON L'ALTRA GIÀ APPLICATA ─────────────────────
      I due filtri si incrociano — «le segreterie di ieri» — e i numeri devono
      dirlo: i conti degli STATI si fanno sulla fetta di tempo scelta, quelli
      del TEMPO sullo stato scelto. Contandoli sempre su tutta la coda si
      leggerebbe «Segreteria 12» e poi, premendolo, se ne troverebbero tre:
      un numero che si smentisce da solo al primo tocco non lo guarda più
      nessuno. */
  const contiFetta = useMemo(() => {
    const m = new Map<LeadStatus, number>();
    for (const l of coda) {
      if (!dentroLaFetta(l.data, quando, oggiQui)) continue;
      const st = l.data?.stato as LeadStatus | undefined;
      if (st) m.set(st, (m.get(st) ?? 0) + 1);
    }
    return m;
  }, [coda, quando, oggiQui]);

  const contiQuando = useMemo(() => {
    const perStato = fetta === "tutti" ? coda : coda.filter((l) => l.data?.stato === fetta);
    const m = new Map<FettaTempo, number>();
    for (const q of FETTE_TEMPO) {
      m.set(q, perStato.filter((l) => dentroLaFetta(l.data, q, oggiQui)).length);
    }
    return m;
  }, [coda, fetta, oggiQui]);

  /** La coda come la si sta guardando adesso. Da qui in giù comanda lei: la
   *  scheda grande, l'elenco «Poi», il conto di quel che resta. */
  const codaFetta = useMemo(
    () =>
      coda.filter(
        (l) =>
          (fetta === "tutti" || l.data?.stato === fetta) && dentroLaFetta(l.data, quando, oggiQui),
      ),
    [coda, fetta, quando, oggiQui],
  );

  /** L'ordine finale: chi è già passato in fondo, e il nome scelto a mano in
   *  testa a tutti. */
  const ordinata = useMemo(() => {
    const prima = codaFetta.filter((l) => !inFondo.has(l.id));
    const dopo = codaFetta.filter((l) => inFondo.has(l.id));
    const tutti = [...prima, ...dopo];
    if (!forzato) return tutti;
    const i = tutti.findIndex((l) => l.id === forzato);
    return i > 0 ? [tutti[i], ...tutti.slice(0, i), ...tutti.slice(i + 1)] : tutti;
  }, [codaFetta, inFondo, forzato]);

  /** Chi è in coda, per id: serve alla ricerca (che deve DIRE se il risultato
   *  è in coda o no) e a riconoscere il forzato che in coda non c'è. */
  const idInCoda = useMemo(() => new Set(coda.map((l) => l.id)), [coda]);

  /** ── IL CONTATTO TIRATO SU DALLA RICERCA ───────────────────────────────
   *  ⚠️ `forzato` da solo non basta a portare davanti chi non è in coda: fa
   *  scalare `ordinata`, e in `ordinata` c'è soltanto la coda. Chi richiama
   *  quasi sempre in coda NON c'è — gli è appena stato segnato un esito, o ha
   *  un appuntamento fissato — e senza questa riga sceglierlo dalla ricerca non
   *  faceva accadere niente: il caso per cui la ricerca esiste.
   *  Sta FUORI dalla coda e non dentro: infilarlo nell'elenco farebbe salire di
   *  uno «in coda» e «da provare», cioè un contatore che mente per un contatto
   *  che nella giornata non c'era. Qui la coda resta quella che è, e la scheda
   *  in cima dice a chiare lettere che si sta guardando altro. */
  const fuoriCoda = useMemo(
    () =>
      forzato && !idInCoda.has(forzato)
        ? ((leads ?? []).find((l) => l.id === forzato) ?? null)
        : null,
    [forzato, idInCoda, leads],
  );

  const prossimo = fuoriCoda ?? ordinata[0] ?? null;
  /** L'elenco «Poi». Di solito è la coda meno il primo, che sta già nella
   *  scheda grande; ma quando in testa c'è uno trovato con la ricerca la coda
   *  si mostra TUTTA — nessuno dei suoi è stato consumato dalla scheda sopra, e
   *  tagliarne uno lo farebbe sparire dalla vista senza che sia successo nulla. */
  const elencoPoi = fuoriCoda ? ordinata : ordinata.slice(1);
  const daFare = codaFetta.filter((l) => !inFondo.has(l.id)).length;
  /** Il giro è finito quando anche il primo è già passato: la coda non è vuota,
   *  ma non c'è più nessuno che non sia già stato provato oggi.
   *  Con una scheda fuori coda davanti l'annuncio si tace: si sta lavorando una
   *  telefonata che con il giro non c'entra, e «giro finito» lì in mezzo si
   *  legge come se riguardasse lei. */
  const giroFinito = !fuoriCoda && !!ordinata[0] && daFare === 0;

  /** ── LE SCADENZE ───────────────────────────────────────────────────────
   *  I richiami concordati con il cliente e le note che il setter si scrive,
   *  già divisi per momento. Il calcolo è di crm/importa/scadenze, che a sua
   *  volta si appoggia al motore di «Da fare oggi»: qui non c'è nessuna regola
   *  nuova su cosa sia «scaduto».
   *  SI CALCOLA UNA VOLTA SOLA e serve due posti — il numero grande della
   *  testata e la scheda «Oggi». Erano due conti separati nella prima stesura,
   *  ed è esattamente il modo in cui la fascia in cima e l'elenco che si apre
   *  premendola arrivano a dire due cifre diverse.
   *
   *  ⚠️ SI GUARDA L'ARCHIVIO DELLE LISTE, NON LA CODA. Il conto vecchio
   *   filtrava la coda, e la coda per costruzione ESCLUDE i richiami concordati
   *   per un altro giorno (`eDaChiamare`): il numero «richiami scaduti» quindi
   *   non poteva vedere una promessa se non il giorno stesso, e non poteva
   *   avvisare che stava per scadere. Qui si parte da tutti i lead importati e
   *   il resto lo fa la divisione in fasce. */
  const scadenze = useMemo(
    () => calcolaScadenze({ leads: importati, task, adesso }),
    [importati, task, adesso],
  );
  const scadute = useMemo(() => contaInRitardo(scadenze), [scadenze]);

  /** Quante righe ha ogni stanza: è l'unico dato che la barra delle tre porte
   *  deve sapere (vedi crm/importa/reparti). */
  /** ── IL MAGAZZINO: LE SCHEDE FERME E I DOPPIONI ────────────────────────
   *  Le due domande che nessuna schermata faceva. Le regole stanno nei moduli
   *  provati (`crm/importa/ripesca`, `crm/doppioni`): qui si leggono soltanto.
   *  ⚠️ SI GUARDA TUTTO L'ARCHIVIO, non la sola lista importata: una scheda
   *   ferma è ferma anche se è arrivata da un modulo del sito, e un doppione
   *   nasce quasi sempre fuori da un'importazione. */
  const fermi = useMemo(() => dormienti(leads ?? []), [leads]);
  const gruppiDoppi = useMemo(() => doppioniPerTelefono(leads ?? []), [leads]);

  /** «L'ho riscritta»: non cambia nessuno stato — scrivere non è avere una
   *  risposta — ma fa ripartire il conto del silenzio, se no la stessa persona
   *  torna in cima domani. */
  const segnaRipescato = async (l: Lead) => {
    await updateLead(l.id, (attuale) => patchRipescato(attuale, consulente?.nome));
  };
  const segnaRipescatiInBlocco = (righe: Lead[]) =>
    void inBloccoSuiRitorni(
      righe,
      (l) => patchRipescato(l.data, consulente?.nome),
      (n) => (n === 1 ? "1 scheda segnata come riscritta" : `${n} schede segnate come riscritte`),
      "Il segno non è stato scritto in archivio.",
    );

  /** ── UNIRE DUE SCHEDE ──────────────────────────────────────────────────
   *  Due scritture, in quest'ordine: prima la principale si prende quello che
   *  le manca, poi l'altra si segna come assorbita.
   *  ⚠️ L'ORDINE NON È INDIFFERENTE. Se si segnasse prima l'assorbita e la
   *   seconda scrittura fallisse, resterebbe una scheda «unita» dentro una che
   *   non ha mai ricevuto i suoi dati — cioè i dati persi davvero. Così, nel
   *   caso peggiore, si resta con due schede e un po' di campi copiati: il
   *   doppione ricompare e si riprova. */
  const unisciSchede = async (principale: Lead, assorbita: Lead) => {
    const patch = patchUnione(principale, assorbita);
    if (Object.keys(patch).length > 0 && !(await updateLead(principale.id, patch))) {
      toast.error("Non unite", {
        description: `I dati di ${nomeDi(assorbita)} non sono stati copiati: nessuna delle due schede è stata toccata.`,
      });
      return;
    }
    if (!(await updateLead(assorbita.id, patchAssorbita(principale, consulente?.nome)))) {
      toast.error("Unione a metà", {
        description: `I dati sono stati copiati su ${nomeDi(principale)}, ma la seconda scheda è ancora in archivio come prima: riprova.`,
      });
      return;
    }
    toast.success(`${nomeDi(assorbita)} unita in ${nomeDi(principale)}`, {
      description:
        "Niente è stato cancellato: la seconda scheda resta in archivio, messa da parte, con scritto dov'è andata.",
    });
  };

  /** «Non è la stessa persona»: si ricorda su tutte e due, perché la coppia si
   *  può ritrovare da una parte o dall'altra. */
  const segnaDiverse = async (a: Lead, b: Lead) => {
    const pa = patchNonDoppione(a, b);
    const pb = patchNonDoppione(b, a);
    const ok1 = Object.keys(pa).length === 0 || (await updateLead(a.id, pa));
    const ok2 = Object.keys(pb).length === 0 || (await updateLead(b.id, pb));
    if (!ok1 || !ok2) {
      toast.error("Non segnato", { description: "La coppia tornerà a comparire: riprova." });
      return;
    }
    toast.success("Segnate come due persone diverse", {
      description: "Questa coppia non comparirà più fra i doppioni.",
    });
  };

  const contiViste = useMemo(
    () => ({
      coda: coda.length,
      oggi: scadute,
      ritorno: diRitorno.length + siFannoViviLoro.length,
      tutti: daChiamareInLista.length,
      whatsapp: contattatiWa.length,
      rimandati: rimandati.length,
      saltati: saltati.length,
      miei: miei.length,
      //  Il magazzino: si contano qui perché il numero va sulla stanza. Sulla
      //  porta non si somma (vedi `nonSomma` in reparti.ts).
      ripesca: fermi.length,
      doppioni: gruppiDoppi.length,
    }),
    [
      coda.length,
      scadute,
      fermi.length,
      gruppiDoppi.length,
      diRitorno.length,
      siFannoViviLoro.length,
      daChiamareInLista.length,
      contattatiWa.length,
      rimandati.length,
      saltati.length,
      miei.length,
    ],
  );
  const repartoAperto = repartoDi(vista as VistaImporta);
  const repartiVisibili = useMemo(
    () => repartiDaMostrare(contiViste, vista as VistaImporta),
    [contiViste, vista],
  );
  const stanze = useMemo(
    () => sottoViste(repartoAperto, contiViste, vista as VistaImporta),
    [repartoAperto, contiViste, vista],
  );

  /** Passa al prossimo senza scrivere niente in archivio: chi ha già preso un
   *  esito scende in fondo al giro di adesso. Non c'entra col salto — vedi la
   *  nota su `inFondo`. */
  const mandaInFondo = (id: string) => {
    setForzato((f) => (f === id ? null : f));
    setInFondo((s) => {
      const n = new Set(s);
      n.add(id);
      return n;
    });
  };

  /** ── RIMETTERE IN CODA ─────────────────────────────────────────────────
   *  Una scheda o venti: è lo stesso gesto e la stessa funzione, perché due
   *  strade per togliere lo stesso campo sono due strade che un giorno lo
   *  tolgono in due modi diversi.
   *  ⚠️ SI CONTA QUANTE NE SONO TORNATE DAVVERO, e se qualcuna è rimasta
   *   indietro lo si dice con il suo numero. Un «rimesse in coda 20» dopo che
   *   il database ne ha rifiutate tre è la bugia più costosa che questa pagina
   *   possa dire: quelle tre persone non le richiama più nessuno. Le fallite
   *   restano nell'elenco e restano selezionate (la selezione della scheda si
   *   ricalcola sulle righe che ci sono), quindi si riprova senza ricercarle. */
  const rimettiInCoda = async (righe: Lead[]) => {
    if (righe.length === 0 || rientroInCorso) return;
    //  ⚠️ QUI IL TETTO DI 50 RIFIUTAVA DI SCRIVERE: «Troppe insieme, non ho
    //   scritto niente». Non c'è più, e il motivo che lo teneva in piedi —
    //   trecento salvataggi in fila sono un minuto di pagina ferma — adesso lo
    //   risolve `aLotti`, che scrive a lotti di venti e fra un lotto e l'altro
    //   fa salire `avanzamento`. Vedi la nota su `LOTTO`: un gesto vietato non
    //   sparisce, lo si rifà a mano cinquanta righe per volta — e a mano ci si
    //   perde il segno.
    setRientroInCorso(true);
    //  ── DUE CONTI, PERCHÉ SONO DUE DOMANDE DIVERSE ─────────────────────
    //   `fatte` = quante schede l'archivio ha davvero cambiato.
    //   `tornate` = quante di quelle ricompaiono nel giro delle telefonate.
    //   Non sono lo stesso numero, e crederlo è il modo più facile di perdere
    //   qualcuno: togliere il salto rimette in coda solo chi è ancora da prima
    //   chiamata (`eDaChiamare`). Chi nel frattempo ha preso un appuntamento,
    //   ha comprato, o ha un richiamo segnato per giovedì, esce dai saltati e in
    //   coda NON entra — sparisce da questa pagina. È giusto che sparisca, non è
    //   giusto tacerlo.
    let fatte = 0;
    let tornate = 0;
    let falliti = 0;
    try {
      const esito = await aLotti(
        righe,
        async (l) => {
          if (!(await updateLead(l.id, PATCH_RIENTRO))) return "fallita";
          //  Si guarda il lead com'è ADESSO: `PATCH_RIENTRO` tocca solo i due
          //  campi del salto, quindi né `importato` né lo stato cambiano sotto
          //  questa riga e la risposta resta quella buona anche dopo la
          //  scrittura.
          if (eDaChiamare(l)) tornate++;
          return "fatta";
        },
        (fatti, totale) => setAvanzamento({ fatti, totale }),
      );
      fatte = esito.fatte;
      falliti = esito.falliti.length;
    } finally {
      setRientroInCorso(false);
      //  L'avanzamento si spegne SEMPRE, anche se qualcosa è esploso a metà:
      //  una barra che resta a schermo su un lavoro finito è il modo più
      //  semplice per far credere che la pagina sia ancora occupata.
      setAvanzamento(null);
    }
    const fuoriGiro = fatte - tornate;
    if (tornate > 0) {
      toast.success(
        tornate === 1 ? "1 contatto di nuovo in coda" : `${tornate} contatti di nuovo in coda`,
      );
    }
    //  ⚠️ NON è un errore — il salto è stato tolto e la scheda è a posto — ma
    //   deve dirsi, e deve dire DOVE sono finiti: senza questa riga la persona
    //   uscirebbe dall'elenco dei saltati sotto gli occhi di chi ha premuto, non
    //   comparirebbe in coda, e l'unica spiegazione possibile sarebbe «si è
    //   perso qualcosa».
    if (fuoriGiro > 0) {
      toast.info(
        fuoriGiro === 1
          ? "1 non rientra nel giro di oggi"
          : `${fuoriGiro} non rientrano nel giro di oggi`,
        {
          description:
            "Il salto gliel'ho tolto, ma non sono più da prima chiamata: hanno già un esito, un appuntamento, o un richiamo segnato per un altro giorno. Li trovi nell'elenco completo, o cercandoli qui sopra per nome.",
        },
      );
    }
    if (falliti > 0) {
      toast.error(
        falliti === 1
          ? "1 contatto NON è tornato in coda"
          : `${falliti} contatti NON sono tornati in coda`,
        {
          description:
            "Le loro schede in archivio sono rimaste com'erano: sono ancora fra i saltati, già selezionati. Riprova.",
        },
      );
    }
  };

  /** ── CAMBIARE LO STATO A UN GRUPPO ─────────────────────────────────────
   *  La scrittura sta QUI e non nella scheda, come per il rientro dei saltati:
   *  la scheda sa disegnare un elenco e tenere una selezione, la pagina sa cosa
   *  sia `updateLead` e sa leggerne la risposta. QUALI stati si possano dare a
   *  un gruppo lo decide la scheda con le regole del CRM (`requiresAnyDialog`,
   *  `richiedeChiusura`) — vedi la sua intestazione.
   *
   *  ⚠️ QUI C'ERA IL TETTO DI 50, E SI RIFIUTAVA DI SCRIVERE. La ragione era
   *   giusta — cinquanta salvataggi uno dietro l'altro sono già qualche secondo
   *   di pagina ferma, trecento sarebbero un minuto in cui sembra tutto rotto —
   *   ma il rimedio era vietare il gesto proprio a chi ne aveva più bisogno.
   *   Adesso si scrive a lotti di venti con il contatore a schermo (`aLotti`,
   *   `avanzamento`): la pagina non si pianta e nessuno deve più selezionare a
   *   cinquanta per volta ricordandosi dov'era arrivato.
   *
   *  ⚠️ SI CONTANO TRE COSE DIVERSE, PERCHÉ SONO TRE FATTI DIVERSI:
   *   `fatte` = schede che l'archivio ha davvero cambiato;
   *   `gia` = schede che quello stato ce l'avevano già (nessuna scrittura: dare
   *     «Non interessato» a chi è già «Non interessato» non è un errore, ma
   *     contarlo fra i cambiati gonfierebbe il numero che si legge dopo);
   *   `falliti` = schede su cui non è stato scritto niente. Restituiti alla
   *     scheda, che li lascia SELEZIONATI: un «20 schede cambiate» dopo che il
   *     database ne ha rifiutate tre è la bugia più cara che questa pagina possa
   *     dire, perché quelle tre nessuno le rifà.
   *  Restituisce gli id rimasti com'erano. */
  const cambiaStatoInMassa = async (righe: Lead[], stato: LeadStatus): Promise<string[]> => {
    if (righe.length === 0 || massaInCorso) return [];
    setMassaInCorso(true);
    let fatte = 0;
    let gia = 0;
    let falliti: Lead[] = [];
    try {
      const esito = await aLotti(
        righe,
        async (l) => {
          if (l.data?.stato === stato) return "saltata";
          //  ⚠️ LA STESSA PATCH DELL'ESITO SINGOLO, non un `{ stato }` scritto
          //   qui: «Non risponde» dato a quaranta schede è quaranta telefonate
          //   andate a vuoto come le altre, e deve contarle. Vedi `patchEsito`.
          if (!(await updateLead(l.id, patchEsito(l, stato)))) return "fallita";
          return "fatta";
        },
        (fatti, totale) => setAvanzamento({ fatti, totale }),
      );
      fatte = esito.fatte;
      //  Le «già così» sono le righe che `aLotti` chiama saltate: nessuna
      //  scrittura è partita, e il messaggio di fine le racconta a parte.
      gia = esito.saltate;
      falliti = esito.falliti;
    } finally {
      setMassaInCorso(false);
      setAvanzamento(null);
    }
    if (fatte > 0) {
      toast.success(
        fatte === 1
          ? `1 scheda → ${LEAD_STATUS_LABEL[stato]}`
          : `${fatte} schede → ${LEAD_STATUS_LABEL[stato]}`,
        //  Le «già così» si dicono solo quando ci sono, e come nota: sono la
        //  differenza fra il numero che si è selezionato e il numero che si
        //  legge qui, e senza spiegazione quella differenza sembra una perdita.
        gia > 0
          ? {
              description:
                gia === 1
                  ? "Un'altra aveva già questo stato: l'ho lasciata com'era."
                  : `Altre ${gia} avevano già questo stato: le ho lasciate com'erano.`,
            }
          : undefined,
      );
      //  Sono esiti scritti da questa postazione come gli altri: il numero in
      //  cima deve contarli, o una mattinata passata a ripulire la lista si
      //  legge come una mattinata in cui non è successo niente.
      setSegnate((n) => n + fatte);
    } else if (gia > 0 && falliti.length === 0) {
      toast.message(
        gia === 1
          ? "Aveva già questo stato: non ho cambiato niente"
          : "Avevano già tutte questo stato: non ho cambiato niente",
      );
    }
    if (falliti.length > 0) {
      //  I primi nomi per esteso: «3 schede NON cambiate» manda a cercare quali,
      //  e chi cerca in un elenco di trecento righe non cerca.
      const nomi = falliti
        .slice(0, 3)
        .map((l) => nomeDi(l, "senza nome"))
        .join(", ");
      toast.error(
        falliti.length === 1
          ? "1 scheda NON è cambiata"
          : `${falliti.length} schede NON sono cambiate`,
        {
          description: `${nomi}${falliti.length > 3 ? ` e altre ${falliti.length - 3}` : ""}: in archivio sono rimaste com'erano, e restano selezionate. Riprova.`,
        },
      );
    }
    return falliti.map((l) => l.id);
  };

  /** ── DIMENTICARE UNA SCHEDA CHE NON C'È PIÙ ────────────────────────────
   *  Gli elenchi non hanno bisogno di niente: coda, importati, saltati e
   *  scadenze nascono tutti da `leads`, e `CRMContext` la riga eliminata la
   *  toglie di lì — spariscono da sole, e da sole si rifanno i numeri della
   *  testata. Restano i riferimenti che questa pagina tiene PER ID, e due dei
   *  quattro vanno azzerati a mano:
   *   · `forzato` è il nome tirato in testa dalla ricerca o dall'elenco «Poi».
   *     Se è quello appena eliminato, `fuoriCoda` diventa `null` e la scheda
   *     grande cambia persona in silenzio: nessun errore, ma nemmeno un perché.
   *     Azzerandolo la testa torna a essere `ordinata[0]`, cioè il prossimo da
   *     chiamare — che è esattamente quello che deve succedere;
   *   · `scheda` è la finestra del lead: lasciata aperta su una persona
   *     eliminata mostrerebbe dati che in archivio non ci sono più, con i suoi
   *     campi che scriverebbero sul nulla.
   *   · `inFondo` e `idRitorno` invece possono tenersi gli id morti senza far
   *     danno: nessuno li legge se non con `.has()` sulle righe che esistono, e
   *     muoiono con la pagina. È la stessa ragione per cui la selezione delle
   *     schede non ripulisce il suo `Set` (vedi crm/importa/selezione): togliere
   *     roba da un insieme che nessuno interroga è lavoro per niente. */
  const dimentica = (ids: string[]) => {
    const spariti = new Set(ids);
    setForzato((f) => (f && spariti.has(f) ? null : f));
    setScheda((s) => (s && spariti.has(s.id) ? null : s));
  };

  /** ── ELIMINARE UNA SCHEDA ──────────────────────────────────────────────
   *  ⚠️ NON C'È UN CESTINO, E NON C'È L'«ANNULLA» DEL SALTO. `salta` può
   *   permettersi il messaggio con il tasto per disfare perché il salto è un
   *   campo che si rimette a posto; qui la riga in archivio non esiste più e
   *   nessun tasto la riporta indietro. Per questo la domanda si fa PRIMA, con
   *   il nome della persona dentro, e la fa la riga (vedi le schede): chi arriva
   *   a questa funzione ha già confermato, e qui non si chiede più niente.
   *  Restituisce `true` solo se la riga è sparita davvero dall'archivio: chi
   *  chiama lo usa per decidere se togliere la riga dalla selezione o lasciarla.
   *  ⚠️ IL MESSAGGIO D'ERRORE NON SI SCRIVE QUI: quando l'archivio rifiuta lo
   *   dice `deleteLead`, che è l'unico a sapere COSA ha risposto il database
   *   (vedi crm/CRMContext). Due messaggi per lo stesso rifiuto sono uno che
   *   spiega e uno che disturba; e la riga intanto è ancora a schermo, col suo
   *   nome, quindi non si è perso niente. */
  const eliminaUno = async (l: Lead): Promise<boolean> => {
    if (!puoEliminare) {
      toast.error("Non puoi eliminare i lead", {
        description: MOTIVO_PERMESSO["lead.elimina"],
      });
      return false;
    }
    if (!(await deleteLead(l.id))) return false;
    dimentica([l.id]);
    toast.success(`${nomeDi(l)} non è più in archivio`, {
      description: "Eliminato per sempre: non c'è un cestino da cui ripescarlo.",
    });
    return true;
  };

  /** ── ELIMINARE UN GRUPPO ───────────────────────────────────────────────
   *  La stessa disciplina del cambio di stato a gruppi, e per gli stessi motivi:
   *  si scrive a lotti con il contatore a schermo (`aLotti`), si conta quante
   *  sono sparite DAVVERO, e si restituiscono gli id rimasti — che la scheda
   *  lascia selezionati, così si riprova senza doverli ritrovare uno per uno.
   *  ⚠️ LA CONFERMA NON SI CHIEDE QUI, e non si chiede due volte: la fa la barra
   *   della scheda, con il numero scritto per esteso e su un pulsante diverso da
   *   quello appena premuto — un'eliminazione non deve poter capitare per un
   *   doppio clic finito sullo stesso punto. Da qui in giù si scrive e basta.
   *  ⚠️ Il permesso si controlla PRIMA del ciclo e non riga per riga: rifiutare
   *   trecento volte la stessa cosa sono trecento messaggi identici per una
   *   risposta che si sapeva già alla prima. */
  const eliminaMolti = async (righe: Lead[]): Promise<string[]> => {
    if (righe.length === 0 || eliminazioneInCorso) return [];
    if (!puoEliminare) {
      toast.error("Non puoi eliminare i lead", {
        description: MOTIVO_PERMESSO["lead.elimina"],
      });
      return righe.map((l) => l.id);
    }
    setEliminazioneInCorso(true);
    let fatte = 0;
    let falliti: Lead[] = [];
    try {
      const esito = await aLotti(
        righe,
        async (l) => ((await deleteLead(l.id)) ? "fatta" : "fallita"),
        (fatti, totale) => setAvanzamento({ fatti, totale }),
      );
      fatte = esito.fatte;
      falliti = esito.falliti;
    } finally {
      setEliminazioneInCorso(false);
      setAvanzamento(null);
    }
    if (fatte > 0) {
      //  Si dimenticano solo quelle andate via davvero: le altre sono ancora
      //  in archivio, e se una di loro era il nome in testa alla coda deve
      //  restarci.
      const rimasti = new Set(falliti.map((l) => l.id));
      dimentica(righe.filter((l) => !rimasti.has(l.id)).map((l) => l.id));
      toast.success(fatte === 1 ? "1 scheda eliminata" : `${fatte} schede eliminate`, {
        description: "Non c'è un cestino: quello che è uscito non torna.",
      });
    }
    if (falliti.length > 0) {
      //  I primi nomi per esteso, come nel cambio di stato: «3 schede NON
      //  eliminate» manda a cercare quali, e in un elenco di trecento righe chi
      //  cerca non cerca.
      const nomi = falliti
        .slice(0, 3)
        .map((l) => nomeDi(l, "senza nome"))
        .join(", ");
      toast.error(
        falliti.length === 1
          ? "1 scheda NON è stata eliminata"
          : `${falliti.length} schede NON sono state eliminate`,
        {
          description: `${nomi}${falliti.length > 3 ? ` e altre ${falliti.length - 3}` : ""}: sono ancora in archivio e restano selezionate. Riprova.`,
        },
      );
    }
    return falliti.map((l) => l.id);
  };

  /** ── LE DUE VIE DEL CONTATTO DI RITORNO ────────────────────────────────
   *  Richiesta del committente: «posso cliccare su conferma e rimane così per
   *  com'è e torna tra i lead normali dove stava, oppure un pulsante che li
   *  sposta in da contattare in mezzo agli altri e resetta lo stato».
   *  Sono due scritture in archivio come tutte le altre, quindi possono
   *  fallire, e se falliscono lo si dice: senza il controllo la scheda
   *  resterebbe a schermo com'era e si premerebbe il tasto altre tre volte
   *  credendo che sia rotto (è la stessa lezione del salto, qui sotto).
   *  ⚠️ Nessuno dei due compone la modifica a mano: la fa il modulo
   *   (crm/importa/ricarico.ts), che è anche l'unico a sapere come si conta
   *   quante volte è successo. */
  const confermaRitorno = async (l: Lead) => {
    const chi = nomeDi(l);
    if (!(await updateLead(l.id, patchConferma(l.data)))) {
      toast.error("Non salvato", {
        description: `${chi} è rimasto in attesa di una decisione: la scheda in archivio non è cambiata. Riprova.`,
      });
      return;
    }
    toast.success(`${chi}: lasciato com'era`, {
      description: `Resta «${etichettaStato(l.data?.stato)}» con le sue note e i suoi appuntamenti. Esce da questa coda e torna dove stava.`,
    });
  };

  const rimettiFraIDaContattare = async (l: Lead) => {
    const chi = nomeDi(l);
    //  Lo stato di adesso si legge PRIMA della scrittura: dopo è già cambiato,
    //  e il messaggio racconterebbe la cosa sbagliata.
    const prima = etichettaStato(l.data?.stato);
    if (!(await updateLead(l.id, patchRimettiInCoda(l.data)))) {
      toast.error("Non salvato", {
        description: `${chi} è rimasto «${prima}»: la scheda in archivio non è cambiata. Riprova.`,
      });
      return;
    }
    toast.success(`${chi} è di nuovo da contattare`, {
      description: `Era «${prima}». Note, appuntamenti e storia non sono stati toccati: quante volte è ricomparso resta scritto sulla sua scheda.`,
    });
  };

  /** ── «VEDI DOPO»: LA TERZA VIA ────────────────────────────────────────
   *  Richiesta del committente. Le vie erano due e nessuna delle due era «non
   *  lo so»: la domanda arriva mentre si sta telefonando, e per togliersi il
   *  riquadro dagli occhi si finiva col premere «conferma» — cioè con una
   *  decisione presa per fretta.
   *  ⚠️ NON tocca lo stato e non toglie nessuno dalla coda: mette da parte la
   *   DOMANDA, non la persona. Chi è rimandato si chiama come tutti gli altri.
   *  ⚠️ Si scrive chi ha premuto: in postazione ci sono più persone, e chi
   *   trova la scheda domani deve sapere a chi chiedere. */
  const vediDopo = async (l: Lead) => {
    const chi = nomeDi(l);
    if (!(await updateLead(l.id, patchVediDopo(l.data, consulente?.nome)))) {
      toast.error("Non salvato", {
        description: `${chi} è rimasto in cima alla coda in attesa di una decisione: la scheda in archivio non è cambiata. Riprova.`,
      });
      return;
    }
    toast.success(`${chi}: lo vedi dopo`, {
      description:
        "Esce dalla cima della coda e lo ritrovi nella linguetta «Vedi dopo», con le stesse due scelte. Lo stato non è stato toccato e resta chiamabile come tutti gli altri.",
      action: { label: "Vai a «Vedi dopo»", onClick: () => setVista("rimandati") },
    });
  };

  /** ── «GLI HO SCRITTO»: IL MESSAGGIO LASCIA TRACCIA ───────────────────
   *  ⚠️ NON DECIDE NIENTE e non tocca lo stato del lead: scrivere non è avere
   *   una risposta. La domanda resta aperta e la scheda si sposta nella sua
   *   linguetta, dove la si chiude quando il cliente risponde.
   *  ⚠️ E NON DISTURBA: qui non si dice «salvato» con un avviso a schermo. Il
   *   gesto che la persona ha appena fatto è «apri WhatsApp», e in quel momento
   *   sta già guardando l'altra finestra; il segno si vede dove serve — la
   *   scheda esce dalla coda e compare nella linguetta, col suo numero. */
  /** ── ⚠️ PREMERE «WHATSAPP» NON VUOL DIRE AVER SCRITTO ─────────────────
   *  Segnalazione del committente: «se clicco WhatsApp sui lead importati
   *  cambia subito stato come fatto, ma se non mando il messaggio così è
   *  errato».
   *  Aveva ragione, ed era una mia scelta sbagliata: il segno si scriveva
   *  nell'istante del clic, per non perderlo quando la finestra di WhatsApp
   *  porta via il fuoco. Ma quel clic dice soltanto «apri WhatsApp»: in mezzo
   *  c'è una persona che può ripensarci, sbagliare chat o chiudere tutto — e
   *  intanto la scheda risultava contattata. Un archivio che dice «scritto» a
   *  chi non ha ricevuto niente è peggio di uno che non dice niente: quella
   *  persona non la richiama più nessuno.
   *  Adesso si CHIEDE, al ritorno. La domanda resta in pagina finché non le si
   *  risponde — non è un avviso che sparisce da solo mentre sei sull'altra
   *  finestra — e solo il «sì» scrive. */

  /** ── IL CHECK: «SÌ, GLIEL'HO MANDATO» ────────────────────────────────
   *  La scheda resta dov'è, in attesa di risposta: cambia solo che adesso lo
   *  sappiamo per certo. */
  const confermaWhatsApp = async (l: Lead) => {
    if (!(await updateLead(l.id, patchWhatsappConfermato(l.data, consulente?.nome)))) {
      toast.error("Non sono riuscito a segnarlo", {
        description: `La conferma su ${nomeDi(l)} non è stata scritta in archivio: riprova.`,
      });
      return;
    }
    toast.success("Segnato come mandato", {
      description: `${nomeDi(l)} resta in attesa di risposta.`,
    });
  };

  /* ═══════════════════════════════════════════════════════════════════════
     LE STESSE TRE DECISIONI, SU UN GRUPPO
     ─────────────────────────────────────────────────────────────────────────
     Misurato in archivio il 7/10/2026: sedici persone scritte su WhatsApp,
     tutte lo stesso giorno in cinquanta minuti, nessuna chiusa nove giorni
     dopo, quattordici su sedici mai confermate col ✓. Il reparto registrava un
     debito e non dava nessun modo di smaltirlo: ogni riga voleva i suoi tocchi,
     e sedici righe nessuno le fa.

     ⚠️ NON C'È NESSUNA DECISIONE NUOVA QUI DENTRO. Sono le stesse tre patch
      delle righe singole (`patchWhatsappConfermato`, `patchConferma`,
      `patchRimettiInCoda`): una seconda versione «di gruppo» si scosterebbe
      dalla prima al primo ritocco, e allora la stessa scheda finirebbe in due
      stati diversi a seconda di come la si è chiusa.
     ⚠️ SI SCRIVE A LOTTI con il contatore a schermo (`aLotti`), come tutte le
      altre azioni di gruppo di questa pagina, e le righe che NON si sono
      salvate restano selezionate: un «16 chiuse» dopo che il database ne ha
      rifiutate tre è la bugia più cara che questa pagina possa dire, perché
      quelle tre nessuno le rifà.
     ═══════════════════════════════════════════════════════════════════════ */
  const inBloccoSuiRitorni = async (
    righe: Lead[],
    patch: (l: Lead) => Modifica<LeadData>,
    riuscite: (n: number) => string,
    fallite: string,
  ): Promise<void> => {
    if (righe.length === 0 || massaInCorso) return;
    setMassaInCorso(true);
    let fatte = 0;
    let falliti: Lead[] = [];
    try {
      const esito = await aLotti(
        righe,
        async (l) => ((await updateLead(l.id, patch(l))) ? "fatta" : "fallita"),
        (fatti, totale) => setAvanzamento({ fatti, totale }),
      );
      fatte = esito.fatte;
      falliti = esito.falliti;
    } finally {
      setMassaInCorso(false);
      setAvanzamento(null);
    }
    if (fatte > 0) toast.success(riuscite(fatte));
    if (falliti.length > 0) {
      toast.error(
        falliti.length === 1 ? "1 scheda non salvata" : `${falliti.length} schede non salvate`,
        { description: `${fallite} Restano selezionate: riprova solo su quelle.` },
      );
    }
  };

  /** «Sì, questi messaggi sono partiti davvero»: il ✓ dato a un gruppo. */
  const confermaInviatiInBlocco = (righe: Lead[]) =>
    void inBloccoSuiRitorni(
      righe,
      (l) => patchWhatsappConfermato(l.data, consulente?.nome),
      (n) => (n === 1 ? "1 messaggio segnato come mandato" : `${n} messaggi segnati come mandati`),
      "La conferma non è stata scritta in archivio.",
    );

  /** «Chiudi, resta com'è»: la domanda si spegne, la scheda non si tocca. */
  const confermaInBlocco = (righe: Lead[]) =>
    void inBloccoSuiRitorni(
      righe,
      (l) => patchConferma(l.data),
      (n) => (n === 1 ? "1 scheda lasciata com'era" : `${n} schede lasciate com'erano`),
      "La decisione non è stata scritta in archivio.",
    );

  /** «Rimettili fra i da contattare»: lo stato riparte da capo. */
  const rimettiInBlocco = (righe: Lead[]) =>
    void inBloccoSuiRitorni(
      righe,
      (l) => patchRimettiInCoda(l.data),
      (n) => (n === 1 ? "1 scheda di nuovo da contattare" : `${n} schede di nuovo da contattare`),
      "Lo stato non è stato azzerato in archivio.",
    );

  /** ── LA X: «NO, NON L'HO MANDATO» ────────────────────────────────────
   *  Torna in coda com'era. ⚠️ Non si scrive un esito «no» accanto alla data:
   *  si toglie la data, perché dire «gli abbiamo scritto» sarebbe falso — il
   *  perché per esteso sta in `patchWhatsappNonInviato`. */
  const annullaWhatsApp = async (l: Lead) => {
    if (!(await updateLead(l.id, patchWhatsappNonInviato(l.data)))) {
      toast.error("Non sono riuscito a rimetterlo in coda", {
        description: `${nomeDi(l)} è rimasto fra gli scritti su WhatsApp: riprova.`,
      });
      return;
    }
    toast.success("Rimesso in coda", {
      description: `${nomeDi(l)} torna fra i contatti da decidere: nessuno resta ad aspettare una risposta che non può arrivare.`,
    });
  };

  /** Premuto «WhatsApp»: la scheda si sposta SUBITO fra gli scritti. Non dice
   *  che il messaggio è partito — quello lo conferma una persona da lì, col
   *  check — dice che è stato aperto, ed è l'unica cosa che il programma sa. */
  const segnaWhatsApp = async (l: Lead) => {
    if (!(await updateLead(l.id, patchContattatoWhatsApp(l.data, consulente?.nome)))) {
      //  Se non si è scritto lo si dice, ma senza fermare niente: WhatsApp si
      //  è aperto comunque, ed è la cosa che contava.
      toast.error("Non sono riuscito a spostarlo", {
        description: `${nomeDi(l)} è rimasto in coda: la scheda in archivio non è cambiata. Riprova dal suo tasto.`,
      });
      return;
    }
    toast.success("Spostato fra gli scritti su WhatsApp", {
      description: `Da lì confermi con ✓ se il messaggio è partito, o con ✗ se non l'hai mandato e ${nomeDi(l)} torna in coda.`,
    });
  };

  /** ── SALTARE: METTERE DA PARTE, PER DAVVERO ────────────────────────────
   *  Prima era un `Set` in memoria e si scordava tutto al primo ricaricamento.
   *  Adesso è una scrittura in archivio come le altre — quindi può fallire, e
   *  se fallisce lo si dice: senza questo controllo il contatto resterebbe a
   *  schermo com'era e si premerebbe «Salta» altre tre volte credendo che il
   *  tasto sia rotto.
   *  ⚠️ NIENTE `mandaInFondo` qui dentro: il saltato esce dalla coda del tutto
   *   (`coda` non lo prende più), e metterlo anche in fondo al giro vorrebbe
   *   dire che il giorno in cui rientra si ritroverebbe misteriosamente ultimo. */
  const salta = async (l: Lead) => {
    const chi = nomeDi(l);
    if (!(await updateLead(l.id, patchSalto(consulente?.nome)))) {
      toast.error("Salto NON salvato", {
        description: `${chi} è rimasto in coda: la scheda in archivio non è cambiata. Riprova.`,
      });
      return;
    }
    setForzato((f) => (f === l.id ? null : f));
    //  ── LA VIA DEL RITORNO STA NEL MESSAGGIO ──────────────────────────
    //   Il salto adesso DURA, quindi anche un salto premuto per sbaglio dura:
    //   rimediare non deve costare l'apertura di un'altra vista e una caccia
    //   al nome. Il tasto qui rimette la scheda esattamente com'era.
    toast.success(`${chi} messo da parte`, {
      description: "È uscito dalla coda: lo ritrovi in «Lead saltati», anche domani.",
      action: {
        label: "Annulla",
        onClick: () => void rimettiInCoda([l]),
      },
    });
  };

  //  La finestra delle tre chiusure vinte. A vendita REGISTRATA il contatto va
  //  in fondo al giro come dopo ogni altro esito: senza, resterebbe primo in
  //  coda (è ancora `importato` e la sua scheda è appena cambiata) e si
  //  riproporrebbe subito la persona a cui si è appena venduto.
  const chiusura = useChiusura((l) => {
    setSegnate((n) => n + 1);
    //  …e in fondo ci va solo se la vendita è stata segnata DAL GIRO: dalla
    //  pastiglia di una riga d'elenco non c'è nessun giro da far scorrere (vedi
    //  il terzo argomento di `segna`, qui sotto).
    if (segnoDalGiro.current) mandaInFondo(l.id);
  });

  /** ── SEGNARE L'ESITO ───────────────────────────────────────────────────
   *  Due strade, e la scelta non è di questa pagina: `requiresAnyDialog` dice
   *  se quello stato promette un momento (giorno e ora) o degli importi. Se sì,
   *  si apre la finestra condivisa; se no si scrive qui.
   *
   *  ⚠️ LA RISPOSTA DEL SERVER SI LEGGE, E ADESSO LA DANNO.
   *  `CRMContext.updateLead` restituisce `false` quando in archivio non è stato
   *  scritto niente — riga assente dall'elenco in memoria, oppure database che
   *  rifiuta — e qui si segnano duecento esiti al giorno: un `await` andato
   *  male non deve essere indistinguibile da uno andato bene.
   *
   *  ── IL TERZO ARGOMENTO: «QUESTO GESTO FA PARTE DEL GIRO?» ─────────────
   *  `mandaInFondo` vuol dire una cosa sola — «questo l'ho già toccato in questa
   *  passata di telefonate» — e da quando lo stato si cambia anche dalla
   *  pastiglia di una riga qualunque («Tutti», «Saltati») la stessa funzione
   *  serve due gesti che gesti uguali non sono:
   *   · DAL GIRO (la scheda del prossimo, le scorciatoie 1…9, la griglia degli
   *     altri stati, una riga scaduta di «Oggi») si è appena telefonato: la
   *     persona scende in fondo, «da provare adesso» cala di uno, e il nome
   *     tirato in testa a mano si libera. È il gesto per cui questa pagina
   *     esiste, e senza quel passaggio si riproporrebbe all'infinito la stessa
   *     scheda;
   *   · DA UN ELENCO no. Là si sta mettendo in ordine una lista — «questi venti
   *     hanno detto di no» — non si sta chiamando nessuno: far scendere «da
   *     provare adesso» perché qualcuno ha corretto uno stato racconta una
   *     giornata che non è successa, per giunta da una vista in cui la coda non
   *     si vede nemmeno. Ed è già la scelta di `cambiaStatoInMassa`, che in
   *     fondo non manda nessuno: due porte sullo stesso elenco che si
   *     comportassero in due modi diversi sarebbero la cosa più difficile da
   *     spiegare di questa schermata.
   *  Il valore va anche nel `ref` qui sopra, perché metà degli esiti li scrive
   *  una finestra che si chiude più tardi e lì gli argomenti di questa chiamata
   *  non ci sono più. */
  const segna = async (l: Lead, stato: LeadStatus, opzioni?: { dalGiro?: boolean }) => {
    //  Il valore di riposo è «sì»: i chiamanti storici sono tutti del giro, e un
    //  `segna(l, stato)` scritto domani da un pulsante della scheda grande deve
    //  comportarsi come gli altri senza doverselo ricordare.
    const dalGiro = opzioni?.dalGiro ?? true;
    segnoDalGiro.current = dalGiro;
    //  ⚠️ SOLO FUORI DAL GIRO: nella coda si lavora una persona alla volta e il
    //   senso del gesto è «passa alla prossima»; tenerla lì bloccherebbe le
    //   telefonate. Negli elenchi invece la riga deve restare dov'è.
    if (!dalGiro) ricordaSistemato(l.id);
    //  ── «HA COMPRATO» PASSA DALLA SUA FINESTRA ─────────────────────────
    //   Le tre chiusure vinte non le scrive questa pagina: le scrive
    //   ChiusuraDialog insieme all'acconto, al totale e al modo di consegna, in
    //   un salvataggio solo. Qui capitano davvero — un contatto di ritorno è
    //   una trattativa, e fra i suoi esiti rapidi c'è anche la vendita.
    //   ⚠️ Il ramo va PRIMA di `requiresAnyDialog` e non scrive niente da sé:
    //   uno stato scritto qui e i soldi scritti dopo sono due momenti, e in
    //   mezzo c'è un lead verde con la cassa vuota.
    //   Il giro in fondo alla coda lo fa `onSalvata` (vedi `useChiusura` qui
    //   sopra): solo a vendita registrata, perché una finestra annullata deve
    //   lasciare la persona dov'era — a differenza degli stati con una data,
    //   che se restassero primi si riproporrebbero all'infinito.
    if (chiusura.intercetta(l, stato)) return;
    if (requiresAnyDialog(stato)) {
      setQuickLead(l);
      setQuickStato(stato);
      return;
    }
    //  ── IL CONTATORE DEI TENTATIVI ─────────────────────────────────────
    //   Non si scrive qui: la forma della patch è di `patchEsito`, in cima al
    //   file, perché la stessa regola serve anche al cambio in massa. Vedi lì
    //   perché una regola scritta dentro questa funzione valeva solo per metà
    //   degli esiti che questa pagina segna.
    //  ⚠️ QUI SI RILEGGEVA LA RIGA DAL DATABASE PER CONTROLLARE, E QUEL
    //   CONTROLLO ACCUSAVA I SALVATAGGI RIUSCITI. Confrontava lo stato riletto
    //   con quello chiesto, ma fra i due c'è `applyAutoStatus` (crm/types), che
    //   lo stato può cambiarlo per conto suo: su una scheda con un acconto già
    //   incassato lo riporta ad «Acconto incassato», qualunque cosa si sia
    //   premuto. Il confronto falliva su una scrittura ANDATA A BUON FINE e
    //   diceva «Esito NON salvato» a chi aveva appena salvato — il peggior
    //   errore possibile in questa pagina, perché si riprova all'infinito. In
    //   più era una richiesta di rete in più ogni esito, duecento al giorno.
    //   Adesso la risposta la dà `updateLead`, che sa cos'ha scritto davvero.
    if (!(await updateLead(l.id, patchEsito(l, stato)))) {
      toast.error("Esito NON salvato", {
        description: "La scheda in archivio è rimasta com'era. Riprova.",
      });
      return;
    }
    //  ⚠️ Si fotografa com'era DOPO la scrittura riuscita e non prima: se la
    //   scrittura fallisce non c'è niente da disfare, e un tasto «torna
    //   indietro» che compare dopo un salvataggio mai avvenuto rimetterebbe a
    //   posto una cosa che non è mai cambiata.
    const disfa = {
      id: l.id,
      nome: nomeDi(l),
      stato,
      prima: {
        stato: l.data.stato,
        noRispondeCount: Number(l.data.noRispondeCount) || 0,
        //  ⚠️ Anche la data da cui valeva quello stato, o annullando si
        //   scriverebbe «in questo stato da oggi» su una scheda che ci stava
        //   da due settimane — e i filtri «da quando» direbbero il falso. È
        //   l'eccezione dichiarata in updateLead (crm/CRMContext).
        statoPrecedente: l.data.statoPrecedente,
        statoPrecedenteIl: l.data.statoPrecedenteIl,
        statoDa: l.data.statoDa,
      } as Partial<LeadData>,
      eraInFondo: inFondo.has(l.id),
    };
    toast.success(`${nomeDi(l)} → ${LEAD_STATUS_LABEL[stato]}`, {
      //  La via più rapida: il messaggio è già sotto gli occhi e il dito è
      //  ancora lì. Il pulsante in pagina resta per chi se ne accorge dopo.
      action: { label: "Annulla", onClick: () => void disfaUltimo(disfa) },
    });
    setUltimo(disfa);
    //  Un altro esito: il riquadro del giorno appena fissato non c'entra più.
    setGiornoFissato(null);
    setSegnate((n) => n + 1);
    if (dalGiro) mandaInFondo(l.id);
  };

  /** ── TORNA COM'ERA ────────────────────────────────────────────────────
   *  Rimette lo stato di prima, il contatore dei tentativi, la data da cui
   *  quello stato valeva e il posto in coda.
   *  ⚠️ IL CONTATORE DEI SEGNATI SCENDE. È il numero della giornata («segnati
   *   oggi»): lasciarlo su dopo un annullamento vorrebbe dire una giornata che
   *   racconta un esito che non esiste più. */
  const disfaUltimo = async (d: {
    id: string;
    nome: string;
    prima: Partial<LeadData>;
    eraInFondo: boolean;
  }) => {
    if (!(await updateLead(d.id, d.prima))) {
      toast.error("Non sono riuscito a tornare indietro", {
        description: "La scheda in archivio è rimasta com'è. Riprova.",
      });
      return;
    }
    if (!d.eraInFondo) {
      setInFondo((s) => {
        const n = new Set(s);
        n.delete(d.id);
        return n;
      });
    }
    setSegnate((n) => Math.max(0, n - 1));
    setUltimo(null);
    toast.success(`${d.nome}: tornato com'era`);
  };

  /** Gli esiti proposti al lead in testa: servono anche alle scorciatoie 1…9,
   *  che devono puntare esattamente ai pulsanti che si vedono. */
  const esitiProssimo = useMemo(() => {
    if (!prossimo) return [] as LeadStatus[];
    const validi = new Set(statiSelezionabili(prossimo.data ?? {}));
    return ESITI_RAPIDI.filter((s) => validi.has(s));
  }, [prossimo]);

  //  ⚠️ Gli hook stanno TUTTI sopra qualunque uscita anticipata: questo è
  //  l'ultimo, e sotto non c'è nessun `return` che lo salti.
  useScorciatoie(
    {
      s: () => prossimo && void salta(prossimo),
      a: () => prossimo && setScheda(prossimo),
      "?": () => setAiutoAperto((v) => !v),
      //  Il telefono squilla: una barra da premere invece di un campo da
      //  cercare col mouse. `useScorciatoie` tace già mentre si scrive dentro
      //  un campo, quindi la «s» di un cognome non fa più saltare nessuno.
      "/": () => cercaRef.current?.focus(),
      ...Object.fromEntries(
        esitiProssimo
          .slice(0, 9)
          .map((s, i) => [String(i + 1), () => prossimo && void segna(prossimo, s)]),
      ),
    },
    //  Con una finestra aperta i tasti appartengono a quella: un «1» premuto
    //  mentre si scrive l'ora di un appuntamento non deve segnare un esito.
    //  ⚠️ E con un'altra vista davanti i tasti non appartengono a nessuno: «il
    //   prossimo» non è a schermo, quindi un «1» o una «s» premuti lì
    //   scriverebbero su una persona che chi sta guardando non vede. Vale per i
    //   saltati e vale per le scadenze — dove per giunta c'è un campo di testo
    //   in cui si scrivono note, e una «s» battuta dentro non deve mettere da
    //   parte nessuno.
    //  ⚠️ LA FINESTRA DELLA CHIUSURA MANCAVA DA QUESTO ELENCO, e non è un caso
    //   di scuola: dalla coda si preme «Altri stati», si sceglie una chiusura
    //   vinta, la griglia si chiude (`setGriglia(null)`) e resta aperta solo
    //   quella dei soldi — che nessuna delle altre tre condizioni conosce. Da
    //   lì un «1» battuto per abitudine segnava «Non risponde» alla persona a
    //   cui si stava registrando la vendita: esito scritto, tentativo contato,
    //   coda che scorre. `useScorciatoie` tace dentro i campi di testo, ma il
    //   fuoco di un dialogo sta su un pulsante, che campo di testo non è.
    { bloccato: !!quickLead || !!griglia || !!scheda || chiusura.aperta || vista !== "coda" },
  );

  return (
    <Pagina>
      <Titolo
        //  ── UN NOME SOLO, PERCHÉ ADESSO LA SCHERMATA È UNA SOLA ──────────
        //   Era «Lead importati · uno alla volta» per distinguersi dall'ELENCO
        //   che stava nel menu accanto con lo stesso nome. Quell'elenco dal menu
        //   è uscito (crm/CRMSidebar.tsx): due voci quasi omonime volevano dire
        //   aprire ogni volta quella sbagliata, e il committente ne ha chiesta
        //   una. La coda finale non serve più a disambiguare niente, e il nome
        //   corto è quello che la gente dice a voce.
        testo="Lead importati"
        nota="Prendi il prossimo, chiamalo, segna com'è andata. Il seguente arriva da solo."
        icona={Phone}
        azioni={
          <>
            <AiutoScorciatoie voci={SCORCIATOIE} aperto={aiutoAperto} onCambia={setAiutoAperto} />
            {puoCaricare && (
              <Button
                size="sm"
                variant={caricaAperto ? "secondary" : "outline"}
                className="h-8 text-[12px]"
                onClick={() => setCaricaAperto((v) => !v)}
              >
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Carica una lista
              </Button>
            )}
            {puoAssegnare && (
              <Button
                size="sm"
                variant={assegnaAperto ? "secondary" : "outline"}
                className="h-8 text-[12px]"
                onClick={() => setAssegnaAperto((v) => !v)}
              >
                <Users className="mr-1 h-3.5 w-3.5" /> Assegna
              </Button>
            )}
            {/* ── LA PORTA DELL'ELENCO ────────────────────────────────────
                ⚠️ QUESTA RIGA È CIÒ CHE IMPEDISCE UNA PERDITA. Da quando
                 l'elenco (/CRM/avanzamento) è uscito dal menu, tre cose che
                 solo lui sa fare — i filtri, le azioni di gruppo su una
                 selezione di righe e l'esportazione in CSV — non hanno più
                 nessun altro ingresso: senza questo pulsante esisterebbero
                 ancora e non le troverebbe più nessuno, che è il modo più
                 silenzioso di cancellare una funzione.
                 Sta fra le azioni del titolo e non in fondo alla pagina
                 perché è un COMANDO della schermata, non una nota a piè di
                 pagina; ed è l'ultimo dei tre perché si preme una volta ogni
                 tanto, mentre gli altri due aprono il lavoro della mattina. */}
            <Button asChild size="sm" variant="ghost" className="h-8 text-[12px]">
              <Link
                to="/CRM/avanzamento"
                title="La stessa roba in tabella: filtri per stato e consulente, azioni su venti righe insieme, esportazione in CSV"
              >
                <Table2 className="mr-1 h-3.5 w-3.5" /> Elenco completo
              </Link>
            </Button>
          </>
        }
      />

      {/* ── LA TESTATA ────────────────────────────────────────────────────
          Il verdetto, la barra del giro, i numeri di contorno, la ricerca. Il
          disegno e il perché stanno in crm/importa/Testata; qui si passano solo
          i numeri, che questa pagina già aveva.
          ⚠️ SI DISEGNA SEMPRE, anche a giornata vuota. Prima i numeri
           comparivano solo se c'era qualcosa da raccontare, e la ricerca
           restava sola a scivolare a sinistra: un campo che cambia posto a
           seconda della giornata si cerca ogni volta. E soprattutto la fascia
           deve poter dire «sei in pari»: è la risposta più utile della
           giornata, e a schermo vuoto era l'unica che non si poteva leggere. */}
      <Testata
        scadute={scadute}
        daProvare={daFare}
        /*  ── ⚠️ I NUMERI PARLANO DELLA FETTA CHE SI STA CHIAMANDO ─────────
            Con un filtro acceso, «in coda» deve dire quanti ce n'è IN QUELLA
            fetta: mescolare il totale della coda con il residuo della fetta
            dava «66 di 70» mentre si chiamavano le cinque segreterie rimaste.
            Il totale vero non si perde — sta scritto sul filtro «Tutti», che è
            sempre a un colpo d'occhio. */
        inCoda={codaFetta.length}
        segnate={segnate}
        saltati={saltati.length}
        saltatiFermi={saltatiFermi}
        onVediScadute={() => setVista("oggi")}
        onVediSaltati={() => setVista("saltati")}
        ricerca={
          <RicercaContatto
            leads={leads ?? []}
            inCoda={idInCoda}
            campoRef={cercaRef}
            //  ⚠️ Si passa da `forzato`, lo stesso stato del clic su un nome
            //  dell'elenco «Poi». La ricerca non ha una sua idea di «chi è il
            //  prossimo»: ne esiste una sola in questa pagina.
            onScegli={(l) => {
              setForzato(l.id);
              //  Cercato da un'altra vista, si torna dove sta la scheda grande:
              //  altrimenti si preme un nome e non succede niente di visibile.
              setVista("coda");
            }}
          />
        }
      />

      {/* ── I DUE PANNELLI DI SERVIZIO ────────────────────────────────────
          Sopra la coda perché è lì che si va a cercarli subito dopo averli
          aperti, e chiusi per difetto perché il resto della giornata sono
          ingombro fra il setter e la persona da chiamare. */}
      {puoCaricare && caricaAperto && (
        <Scheda
          titolo="Carica una lista"
          nota="Sceglierla non scrive nulla: prima si guarda, poi si importa"
          icona={FileSpreadsheet}
          azioni={
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[12px]"
              onClick={() => setCaricaAperto(false)}
            >
              Chiudi
            </Button>
          }
        >
          <PannelloCarica
            onLetti={(ids) => {
              setIdRitorno(new Set(ids));
              //  Lista nuova, giro nuovo: chi era stato messo in fondo prima
              //  non deve restarci sotto quelli appena arrivati.
              setInFondo(new Set());
              setForzato(null);
            }}
          />
        </Scheda>
      )}

      {puoAssegnare && assegnaAperto && (
        <Scheda
          titolo="Dividi le schede fra i consulenti"
          nota="Le schede appena importate arrivano senza padrone"
          icona={Users}
          azioni={
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[12px]"
              onClick={() => setAssegnaAperto(false)}
            >
              Chiudi
            </Button>
          }
        >
          <PannelloAssegna />
        </Scheda>
      )}

      {/* ── LE TRE VISTE ──────────────────────────────────────────────────
          «Da chiamare» e «Oggi» ci sono SEMPRE; «Lead saltati» solo quando
          qualcuno è stato messo da parte — un pulsante fisso per una situazione
          che capita alcuni giorni è una riga di ingombro tutti gli altri. Il
          conto sta accanto al nome, dov'è sempre in questo CRM, perché è il
          numero che fa decidere se premere.

          ⚠️ «OGGI» COMPARIVA SOLO SE C'ERA GIÀ QUALCOSA DENTRO, e quella
           condizione si mordeva la coda: il campo per scriversi una nota vive
           DENTRO quella scheda, quindi a giornata pulita — nessuna scadenza,
           nessuna nota — il pulsante non c'era e la prima nota non si poteva
           scrivere da nessuna parte. Il caso in cui il difetto colpiva era
           esattamente quello in cui la funzione serve: si finisce il giro, si
           vuole appuntare «riprovare al fisso dopo le 18», e non c'è dove.
           Adesso la stanza vuota c'è e lo dice — `SchedaOggi` a zero righe
           mostra il suo «Niente in scadenza» con sopra il campo per scrivere,
           che è una risposta, mentre un pulsante che sparisce non lo è. */}
      {/*  ⚠️ LE LINGUETTE SI SPENGONO MENTRE UN LAVORO A LOTTI STA SCRIVENDO.
           Cambiare vista smonta la scheda che ha in corso l'operazione: i lotti
           proseguirebbero — vivono qui in pagina — ma la selezione morirebbe con
           il componente, e con lei la promessa che le righe rifiutate restino
           selezionate e sotto gli occhi. Sparirebbe anche il contatore, che sta
           nella barra di quella scheda: resterebbe una pagina che scrive in
           silenzio. Sono i pochi secondi di un lotto, e il gesto torna da solo
           appena `avanzamento` si spegne. */}
      {/* ── ⚠️ TRE PORTE, E LE STANZE DENTRO ─────────────────────────────
          Segnalazione del committente: «riorganizza tutto da 0, ora è troppo
          caotico e si perdono funzioni importanti».

          Qui c'erano OTTO linguette sulla stessa riga, tutte allo stesso
          livello. Ognuna nata da una richiesta vera, nessuna di troppo — ma
          messe in fila chiedevano di scegliere fra otto cose ogni volta che si
          alzavano gli occhi, e in mezzo a otto una si perde: è successo a
          «Fissati da me», che per mesi ha mostrato un quinto di quello che il
          setter aveva fissato senza che nessuno se ne accorgesse.

          Adesso la scelta è sempre fra TRE: la palla è mia (si telefona), la
          palla non è mia (si aspetta), il mio lavoro. Le otto viste non sono
          sparite: sono le stanze dentro la porta aperta, con lo stesso nome e
          gli stessi gesti di prima. Quale sta dove, e perché il numero sulla
          porta non è la somma delle sue stanze, sta in crm/importa/reparti —
          con le prove che nessuna delle otto si è persa per strada. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {repartiVisibili.map((r) => (
          <Segmento
            key={r.reparto}
            attivo={repartoAperto === r.reparto}
            onClick={() => setVista(vistaDiIngresso(r.reparto, contiViste, vista))}
            conteggio={contoReparto(r.reparto, contiViste)}
            disabilitato={!!avanzamento}
            titolo={r.titolo}
          >
            {r.nome}
          </Segmento>
        ))}
      </div>

      {/*  Le stanze della porta aperta. Una riga più leggera, e solo quando
          c'è più di una stanza da scegliere: con una sola, la linguetta
          direbbe dove sei a chi lo sa già. */}
      {stanze.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 border-l-2 border-border pl-2.5">
          {stanze.map((v) => (
            <button
              key={v.vista}
              type="button"
              disabled={!!avanzamento}
              onClick={() => setVista(v.vista)}
              title={v.titolo}
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px] transition disabled:opacity-40",
                vista === v.vista
                  ? "bg-foreground/10 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {v.nome}
              {contiViste[v.vista] ? (
                <span className="ml-1 tabular-nums opacity-70">{contiViste[v.vista]}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* ── ⚠️ LA CODA A FETTE ─────────────────────────────────────────────
          Richiesta del committente. Un giro di telefonate non è mai tutto
          uguale: le prime chiamate si fanno col fiato lungo, i ritenti di chi
          non ha risposto sono venti numeri in dieci minuti, un richiamo
          concordato è una promessa. Mescolati costringono a cambiare testa a
          ogni scheda.

          ⚠️ SONO FILTRI, NON LINGUETTE, e si vedono: le linguette qui sopra
           scelgono QUALE ELENCO si guarda e sono piene di colore; queste
           scelgono una FETTA di quell'elenco e restano leggere. Due file di
           bottoni identici, una sotto l'altra, si leggono come un unico
           blocco di dieci scelte tutte uguali.
          ⚠️ IL PALLINO COLORATO È QUELLO DELLO STATO — lo stesso che la riga
           del lead porta accanto al nome (`classiStato`) — perché su un
           telefono il filtro si riconosce prima dal colore che dalla parola.
          ⚠️ SCORRE IN ORIZZONTALE e i bottoni non si stringono: su uno schermo
           stretto cinque filtri a capo mangiano due righe sopra la persona da
           chiamare, che è l'unica cosa per cui si apre questa pagina.
          ⚠️ QUELLI A ZERO RESTANO, spenti: spariscono e la fila si accorcia,
           e il dito che stava andando su «Segreteria» preme «Richiamo». */}
      {/*  ── ⚠️ LA FASCIA DEI CONTATTI DI RITORNO ────────────────────────
           Richiesta del committente: «tutte le persone di ritorno stanno nel
           loro filtro». Il reparto c'è (la linguetta «Di ritorno»), ma i
           contatti di ritorno restano ANCHE in cima alla coda: è la telefonata
           che rende di più della giornata — con quella persona ci si è già
           parlati — e spostarla dentro un reparto vorrebbe dire non farla più.
           Questa riga è il compromesso: la coda resta com'era, e chi vuole
           lavorarli tutti insieme sa che esistono e con un clic ci va.
           ⚠️ Compare SOLO se ce n'è: una fascia che dice «zero» è una riga in
            meno per la persona da chiamare, che è l'unica cosa per cui si apre
            questa pagina. */}
      {vista === "coda" && diRitorno.length > 0 && (
        <button
          type="button"
          onClick={() => setVista("ritorno")}
          className="flex w-full items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-[12.5px] text-amber-900 transition hover:bg-amber-100"
          title="Apre il reparto «Di ritorno»: sono tutti qui, e da lì si lavorano uno dietro l'altro"
        >
          <RotateCcw className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <b>
              {diRitorno.length === 1
                ? "1 contatto di ritorno"
                : `${diRitorno.length} contatti di ritorno`}
            </b>{" "}
            in cima alla coda
            {siFannoViviLoro.length > 0
              ? `, più ${siFannoViviLoro.length} che si fanno vivi loro`
              : ""}
          </span>
          <span className="shrink-0 font-semibold underline underline-offset-2">Aprili tutti</span>
        </button>
      )}

      {vista === "coda" && coda.length > 0 && (
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FiltroCoda
            attivo={fetta === "tutti"}
            onClick={() => setFetta("tutti")}
            conteggio={coda.length}
            titolo="Tutta la coda, nell'ordine giusto"
          >
            Tutti
          </FiltroCoda>
          {STATI_DA_CHIAMARE.map((st) => (
            <FiltroCoda
              key={st}
              attivo={fetta === st}
              onClick={() => setFetta(st)}
              conteggio={contiFetta.get(st) ?? 0}
              classePunto={classiStato(st)}
              titolo={SPIEGA_FETTA[st] ?? LEAD_STATUS_LABEL[st]}
            >
              {LEAD_STATUS_LABEL[st]}
            </FiltroCoda>
          ))}
        </div>
      )}

      {/* ── ⚠️ COM'È MESSO QUEL GIORNO ─────────────────────────────────────
          Richiesta del committente: «se metto appuntamento fissato mi deve
          mostrare la lista di tutti i fissati del giorno».
          Chi fissa appuntamenti tutto il giorno deve vedere com'è messo quel
          giorno subito dopo averlo riempito di uno: è così che ci si accorge
          che giovedì ne ha già sette e mercoledì due, e alla telefonata dopo
          si propone mercoledì. Prima bisognava aprire l'agenda — cambiare
          pagina e perdere la coda.
          ⚠️ CI SONO TUTTI, NON SOLO I PROPRI: un giorno è pieno anche degli
           appuntamenti degli altri, e proporne un ottavo guardando solo i
           propri due vuol dire accorgersene col cliente in linea.
          ⚠️ Si chiude a mano e si spegne da sé al prossimo esito: è la
           risposta a un gesto appena fatto, non un pannello fisso. */}
      {giornoFissato && (
        <Scheda
          titolo={`Appuntamenti di ${dataBreve(giornoFissato)}`}
          nota={
            delGiorno.length === 1
              ? "Per ora ce n'è uno solo su quel giorno"
              : `${delGiorno.length} su quel giorno, in ordine di orario`
          }
          icona={CalendarClock}
          azioni={
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[12px]"
              onClick={() => setGiornoFissato(null)}
            >
              Chiudi
            </Button>
          }
          senzaPadding
        >
          <ul className="max-h-[40vh] divide-y divide-border overflow-y-auto">
            {delGiorno.map((l) => {
              const d = l.data ?? ({} as LeadData);
              const mio = !!consulenteCollegato?.id && d.statoDa === consulenteCollegato.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setScheda(l)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-muted/40"
                  >
                    <span className="w-12 shrink-0 text-[12.5px] font-semibold tabular-nums">
                      {d.oraMeeting || "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {nomeDi(l, "Senza nome")}
                      {/*  ⚠️ Si dice quali sono i tuoi: in mezzo a quelli di
                          tutti, riconoscere i propri a colpo d'occhio è il
                          motivo per cui si guarda questo elenco. */}
                      {mio && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">· tuo</span>
                      )}
                    </span>
                    {d.durataMeeting ? (
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">
                        {d.durataMeeting} min
                      </span>
                    ) : null}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Scheda>
      )}

      {/* ── ⚠️ TORNA INDIETRO ──────────────────────────────────────────────
          Richiesta del committente. Un esito si segna col telefono in mano e
          si sbaglia col telefono in mano: si preme «Non risponde» mentre la
          persona sta rispondendo. Il messaggio che compare ha già il suo
          «Annulla», ma dura pochi secondi ed è la via per chi se ne accorge
          subito; questa riga resta finché non si segna qualcos'altro, per chi
          se ne accorge dopo aver posato il telefono.
          ⚠️ Dice CHI e COSA: «torna indietro» da solo, su una schermata che
           nel frattempo mostra un'altra persona, non fa capire su chi si sta
           per scrivere. */}
      {vista === "coda" && ultimo && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <p className="min-w-0 text-[12.5px] text-muted-foreground">
            Ultimo esito: <span className="font-medium text-foreground">{ultimo.nome}</span> →{" "}
            {LEAD_STATUS_LABEL[ultimo.stato]}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 text-[12px]"
            onClick={() => void disfaUltimo(ultimo)}
          >
            <Undo2 className="mr-1 h-3.5 w-3.5" /> Torna indietro
          </Button>
        </div>
      )}

      {/* ── ⚠️ DA QUANDO ───────────────────────────────────────────────────
          Richiesta del committente: «il giorno dopo devo poter filtrare per
          quando ho messo quello stato». È la seconda domanda di chi riprende
          un giro — non «chi è in segreteria», ma «quali segreterie ho lasciato
          a metà ieri» — e senza restava affidata alla memoria.

          ⚠️ SECONDA FILA, PIÙ PICCOLA E SENZA PALLINI: sono due domande
           diverse in ordine — prima QUALE stato, poi DA QUANDO — e appiattirle
           in un'unica fila di nove bottoni tutti uguali vorrebbe dire nove
           scelte pari fra cui scegliere a caso. La gerarchia si legge dalla
           misura, non da un'etichetta che su un telefono ruberebbe mezza riga.
          ⚠️ COMPARE SOLO SE SERVE: con tutta la coda arrivata oggi, «oggi» e
           «sempre» darebbero lo stesso identico elenco, e un filtro che non
           filtra niente è una riga in più fra il setter e la persona da
           chiamare. */}
      {vista === "coda" && coda.length > 0 && (contiQuando.get("oggi") ?? 0) !== coda.length && (
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 pr-0.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
            Da quando
          </span>
          {FETTE_TEMPO.map((q) => (
            <FiltroQuando
              key={q}
              attivo={quando === q}
              onClick={() => setQuando(q)}
              conteggio={contiQuando.get(q) ?? 0}
              titolo={SPIEGA_FETTA_TEMPO[q]}
            >
              {NOME_FETTA_TEMPO[q]}
            </FiltroQuando>
          ))}
        </div>
      )}

      {/*  ── DOV'È FINITO IL RIQUADRO DEI SALTATI DIMENTICATI ──────────────
           Diceva «N contatti messi da parte da più di 3 giorni» e stava qui,
           sopra la scheda del prossimo: un riquadro fra il setter e la persona
           da chiamare, per un fatto che appartiene al riepilogo della giornata.
           È dentro la testata, sotto i numeri di contorno da cui nasce — stesso
           testo, stesso pulsante, stessa regola (compare solo quando c'è
           qualcuno fermo da troppo, così quando c'è vuol dire qualcosa). */}

      {/* ── IL GIRO ────────────────────────────────────────────────────────
          Da qui in giù comanda la vista: la persona da chiamare, le scadenze
          della giornata, o l'elenco di chi è stato messo da parte. Le finestre
          condivise, in fondo, restano fuori da tutte e tre — la scheda di un
          contatto si apre da ognuna, e un dialogo che vive dentro un ramo si
          chiude da solo quando il ramo cambia. */}
      <NuovaCosa
        aperta={finestraCosa}
        onCambio={setFinestraCosa}
        oggi={oggiIso(new Date(adesso))}
        adesso={adesso}
        persone={personeTask}
        io={
          consulente?.id
            ? { id: consulente.id, nome: consulente.nome || "Io" }
            : user?.id
              ? { id: user.id, nome: user.email || "Io" }
              : undefined
        }
        leads={leads}
        salvando={taskInSalvataggio}
        onCrea={(campi) => void creaCosaConDettagli(campi)}
      />

      {vista === "oggi" ? (
        <SchedaOggi
          voci={scadenze}
          //  ── ⚠️ IL FILTRO PER MESTIERE ─────────────────────────────────
          //   Segnalazione del committente: «ci sia filtro per setter e per
          //   consulenti, correggi perché ora mette tutto insieme». Qui dentro
          //   cadevano insieme le scadenze di tutti e l'unico modo di
          //   separarle era aprire «Da fare oggi».
          mestieri={mestieriDelCentro}
          occupato={taskInSalvataggio}
          caricando={taskInCaricamento}
          onAggiungi={({ testo, data, ora }) =>
            void gestoNota({
              tipo: "aggiungi",
              //  La forma della riga la decide `nuovoTask`, non questa pagina:
              //  id, data di ripiego («vuoto = oggi») e nome dell'autore devono
              //  essere gli stessi che scrive /CRM/dafare, o la stessa lista
              //  finisce con due formati dentro.
              task: nuovoTask({
                testo,
                data,
                ora,
                di: consulente?.id,
                diNome: consulente?.nome || "",
              }),
            })
          }
          onDettagli={() => setFinestraCosa(true)}
          onSpunta={(id, fatta) => void gestoNota({ tipo: "spunta", id, fatta })}
          onElimina={(id) => {
            //  ⚠️ Prima si libera l'agenda: una riga che bloccava un'ora,
            //   cancellata senza togliere il blocco, lascia il calendario
            //   chiuso per sempre su una cosa che non esiste più.
            void (async () => {
              const guasto = await liberaAgendaDi(task.find((x) => x.id === id));
              if (guasto) {
                toast.error("Non sono riuscito a liberare l'agenda", { description: guasto });
                return;
              }
              await gestoNota({ tipo: "elimina", id });
            })();
          }}
          //  ── I TRE GESTI DI UNA RIGA SCADUTA ────────────────────────────
          //   Nessuno dei tre è nuovo: portare in testa alla coda è `forzato`
          //   (lo stesso della ricerca e dell'elenco «Poi»), ridare una data è
          //   `segna(l, "richiamo")` — che passa per QuickStatusDialog, l'unico
          //   posto del CRM in cui si chiede un giorno e un'ora — e aprire la
          //   scheda è LeadDialog. Una scadenza si chiude con gli stessi gesti
          //   con cui si chiude una telefonata, altrimenti sarebbero due CRM.
          onChiama={(l) => {
            setForzato(l.id);
            setVista("coda");
          }}
          onRidaiData={(l) => void segna(l, "richiamo")}
          //  ── LA PASTIGLIA DI UNA RIGA SCADUTA ──────────────────────────
          //   Stessa pipeline degli altri esiti — chiusure vinte, finestra del
          //   giorno e dell'ora, scrittura diretta: `segna` è una sola, e qui
          //   si collega, non si riscrive.
          //   FA PARTE DEL GIRO (nessun `dalGiro: false`), a differenza di
          //   «Tutti» e «Saltati»: una scadenza si chiude telefonando, ed è
          //   esattamente quello che fa `onRidaiData` qui sopra da sempre. Due
          //   comandi della stessa riga che finissero uno dentro il giro e uno
          //   fuori sarebbero due modi diversi di chiudere la stessa telefonata.
          onStato={(l, s) => void segna(l, s)}
          //  Il cestino del lead. ⚠️ NON è `onElimina` qui sopra, che butta una
          //  NOTA scritta a mano: sono due gesti che non si somigliano nemmeno,
          //  e la scheda deve saperli distinguere a colpo d'occhio (vedi lì).
          onEliminaUno={eliminaUno}
          onApriLead={(l) => setScheda(l)}
        />
      ) : vista === "tutti" ? (
        <SchedaTutti
          importati={importati}
          //  Chi ho appena sistemato da qui: resta a schermo finché non cambio
          //  linguetta (vedi importa/elenco-stabile).
          restano={appenaSistemati}
          //  La coda la calcola questa pagina e non si ricalcola là dentro: la
          //  riga dice «in coda oggi» esattamente quando la coda lo prende.
          inCoda={idInCoda}
          //  ⚠️ UN INTERRUTTORE SOLO PER LA SCHEDA, DUE FLAG IN PAGINA. Da qui
          //   partono adesso DUE scritture di gruppo — cambio di stato ed
          //   eliminazione — e mentre una lavora l'altra non deve poter partire:
          //   sono le stesse righe, e la seconda scriverebbe su schede che la
          //   prima sta ancora toccando. In pagina restano due flag distinti
          //   perché il rientro dei saltati vive in un'altra scheda e non
          //   c'entra niente con questi due.
          inCorso={massaInCorso || eliminazioneInCorso}
          avanzamento={avanzamento}
          onCambiaStato={cambiaStatoInMassa}
          //  ── LA PASTIGLIA DI UNA RIGA ──────────────────────────────────
          //   La stessa pipeline degli esiti della coda: `segna` decide se lo
          //   stato scelto vuole una finestra (giorno, ora, importi) o si scrive
          //   e basta — qui non si sa nemmeno cosa sia `updateLead`.
          //   `dalGiro: false` perché questa è una LISTA, non il giro delle
          //   telefonate: correggere uno stato da qui non deve far calare «da
          //   provare adesso» né spostare il posto di nessuno in coda. Il perché
          //   per esteso è sopra `segna`.
          onStato={(l, s) => void segna(l, s, { dalGiro: false })}
          onEliminaUno={eliminaUno}
          onEliminaMolti={eliminaMolti}
          onApri={(l) => setScheda(l)}
        />
      ) : vista === "ripesca" ? (
        <SchedaRipesca
          leads={leads ?? []}
          onApri={(l) => setScheda(l)}
          onRipescato={(l) => void segnaRipescato(l)}
          onRipescatiInBlocco={segnaRipescatiInBlocco}
          nomeConsulente={(id) => mestieriDelCentro.get(String(id ?? ""))?.nome ?? ""}
        />
      ) : vista === "doppioni" ? (
        <SchedaDoppioni
          gruppi={gruppiDoppi}
          onApri={(l) => setScheda(l)}
          onUnisci={(principale, assorbita) => void unisciSchede(principale, assorbita)}
          onDiverse={(a, b) => void segnaDiverse(a, b)}
        />
      ) : vista === "miei" ? (
        /*  ── ⚠️ GLI APPUNTAMENTI CHE HO FISSATO IO ────────────────────────
            Un elenco e basta: qui non si segnano esiti, si va a CORREGGERE —
            l'ora che è cambiata, il giorno spostato — e la correzione si fa
            nella scheda del lead, che è l'unico posto in cui c'è tutto. Per
            questo ogni riga apre la scheda invece di offrire pastiglie: una
            seconda strada per cambiare un appuntamento vorrebbe dire due modi
            di scrivere la stessa cosa, e il secondo dimenticherebbe l'agenda. */
        <Scheda
          titolo="Fissati da me"
          nota={
            miei.length
              ? `${miei.length} ${miei.length === 1 ? "consulenza presa" : "consulenze prese"} · ${riassuntoMiei} · tocca un nome per aprirla`
              : "Le consulenze che hai preso tu"
          }
          icona={CalendarClock}
          senzaPadding
        >
          {miei.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
              {/*  ⚠️ Si dice PERCHÉ può essere vuoto: quelli fissati prima di
                  oggi non portano il nome di chi li ha presi, e senza questa
                  riga la stanza vuota si legge come «non ne hai fissato
                  nessuno» da chi ne ha fissati trenta ieri. */}
              Qui compaiono le consulenze che fissi tu — tutte, anche quelle già fatte o andate
              male: restano il tuo lavoro. Di quelle prese prima che il programma segnasse il nome
              di chi fissa non si sa a chi attribuirle, quindi non compaiono.
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
              {miei.map((l) => {
                const d = l.data ?? ({} as LeadData);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setScheda(l)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">
                          {nomeDi(l, "Senza nome")}
                        </span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">
                          {d.dataMeeting ? dataBreve(soloData(d.dataMeeting)) : "senza data"}
                          {d.oraMeeting ? ` · ${d.oraMeeting}` : ""}
                          {d.durataMeeting ? ` · ${d.durataMeeting} min` : ""}
                        </span>
                      </span>
                      {/*  ⚠️ «probabilmente tuo»: le schede di prima di questo
                          campo si attribuiscono da `statoDa`, che è un
                          indizio e non una firma. Dirlo costa tre parole e
                          evita di litigare su un conteggio. */}
                      {chiHaFissato(d).fonte === "dedotta" && (
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10.5px] text-muted-foreground">
                          probabilmente tuo
                        </span>
                      )}
                      <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato), "shrink-0")}>
                        {LEAD_STATUS_LABEL[d.stato]}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Scheda>
      ) : vista === "ritorno" ? (
        /*  ── IL REPARTO «DI RITORNO» ──────────────────────────────────────
            Richiesta del committente: «tutte le persone di ritorno stanno nel
            loro filtro». Due fasce, perché sono due famiglie con due gesti
            diversi: chi ricompare da una lista ha le DUE DECISIONI (conferma /
            rimettilo fra i da contattare), chi ha detto che richiama lui no —
            su di lui quelle due scritture non direbbero niente.
            ⚠️ L'elenco e i pulsanti sono gli stessi delle altre due linguette
             (SchedaRimandati): tre copie della stessa riga si scostano al
             primo ritocco, e la stessa persona si leggerebbe in tre modi a
             seconda di dove la guardi. */
        <div className="space-y-3">
          <SchedaRimandati
            rimandati={diRitorno}
            titolo="Di ritorno"
            nota={`${diRitorno.length === 1 ? "1 contatto" : `${diRitorno.length} contatti`} · ricomparsi in una lista e ancora da decidere · appena gli scrivi su WhatsApp si spostano nel loro reparto`}
            icona={RotateCcw}
            vuotoTitolo="Nessun contatto di ritorno da decidere"
            vuotoTesto="Qui finisce chi era già in archivio e ricompare in una lista importata. Appena ne arriva uno lo trovi qui, con le due scelte: confermarlo com'è, o rimetterlo fra i da contattare."
            onConferma={(l) => void confermaRitorno(l)}
            onRimetti={(l) => void rimettiFraIDaContattare(l)}
            onApri={(l) => setScheda(l)}
            nomeConsulente={(id) => mestieriDelCentro.get(String(id ?? ""))?.nome ?? ""}
            onWhatsApp={(l) => void segnaWhatsApp(l)}
          />
          {/*  ── CHI HA DETTO CHE RICHIAMA LUI ──────────────────────────────
               La seconda metà di «tutte le persone di ritorno». Qui non ci sono
               le due decisioni — non avrebbero niente da scrivere — ma c'è
               quello che serve: chi è, quando l'ha detto, e la sua scheda a un
               clic. ⚠️ Chi ha la promessa scaduta compare anche in «Oggi»: là
               è l'orologio, qui è il reparto. */}
          {siFannoViviLoro.length > 0 && (
            <Scheda>
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <PhoneIncoming className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">Si fanno vivi loro</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {siFannoViviLoro.length === 1
                      ? "1 persona ha detto"
                      : `${siFannoViviLoro.length} persone hanno detto`}{" "}
                    che richiamano loro · non chiamarli, aspettali — ma qui sai chi sono
                  </div>
                </div>
              </div>
              <ul className="divide-y">
                {siFannoViviLoro.map((l) => {
                  const d = l.data ?? {};
                  const quando = dettoIlInChiaro(d);
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setScheda(l)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium">
                            {`${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome"}
                          </span>
                          <span className="block truncate text-[11.5px] text-muted-foreground">
                            {[String(d.telefono || "") || "senza telefono", quando || null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato), "shrink-0")}>
                          {LEAD_STATUS_LABEL[d.stato]}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Scheda>
          )}
        </div>
      ) : vista === "whatsapp" ? (
        /*  Stesso elenco e stesse due decisioni dei rimandati: cambia solo
            quando ci si è finiti dentro. Vedi SchedaRimandati. */
        <SchedaRimandati
          //  I tre gesti di gruppo: è qui che il debito si smaltisce.
          inBlocco={{
            onConferma: confermaInBlocco,
            onRimetti: rimettiInBlocco,
            onInviati: confermaInviatiInBlocco,
          }}
          rimandati={contattatiWa}
          titolo="Scritti su WhatsApp"
          nota={`${contattatiWa.length === 1 ? "1 contatto" : `${contattatiWa.length} contatti`} · conferma con ✓ quelli mandati davvero, i più vecchi in cima`}
          icona={MessageCircle}
          vuotoTitolo="Nessuno in attesa di risposta"
          vuotoTesto="Qui finiscono i contatti di ritorno appena premi il tasto WhatsApp della loro riga. Da qui confermi con ✓ che il messaggio è partito davvero, oppure con ✗ che non l'hai mandato — e in quel caso tornano in coda com'erano."
          onConferma={(l) => void confermaRitorno(l)}
          onRimetti={(l) => void rimettiFraIDaContattare(l)}
          onApri={(l) => setScheda(l)}
          //  La firma del messaggio è il consulente della SCHEDA, non chi sta
          //  al computer: è la persona che quel cliente ricorda di aver sentito.
          nomeConsulente={(id) => mestieriDelCentro.get(String(id ?? ""))?.nome ?? ""}
          //  Riscrivere aggiorna la data: è quella che dice da quanto si aspetta.
          onWhatsApp={(l) => void segnaWhatsApp(l)}
          onInviato={(l) => void confermaWhatsApp(l)}
          onNonInviato={(l) => void annullaWhatsApp(l)}
        />
      ) : vista === "rimandati" ? (
        /*  ── ⚠️ LE DECISIONI RIMANDATE ────────────────────────────────────
            Richiesta del committente: «una scheda con tutti i vedi dopo, dove
            ho le due opzioni conferma o rimettilo tra i contattare».
            Le due scritture sono ESATTAMENTE quelle del riquadro giallo in
            cima alla coda — stesse funzioni, stessi messaggi — e non una
            seconda versione scritta qui: due idee di «conferma» nella stessa
            pagina sono il modo in cui una delle due, col tempo, smette di
            aggiornare qualcosa. */
        <SchedaRimandati
          //  Qui il ✓ non c'entra: nessuno di questi è stato scritto. Le altre
          //  due decisioni invece sono le stesse, e a gruppi servono uguale.
          inBlocco={{ onConferma: confermaInBlocco, onRimetti: rimettiInBlocco }}
          rimandati={rimandati}
          onConferma={(l) => void confermaRitorno(l)}
          onRimetti={(l) => void rimettiFraIDaContattare(l)}
          onApri={(l) => setScheda(l)}
          //  La firma del messaggio è il consulente della SCHEDA, non chi sta
          //  al computer: è la persona che quel cliente ricorda di aver sentito.
          nomeConsulente={(id) => mestieriDelCentro.get(String(id ?? ""))?.nome ?? ""}
          onWhatsApp={(l) => void segnaWhatsApp(l)}
        />
      ) : vista === "saltati" ? (
        <SchedaSaltati
          saltati={saltati}
          idRitorno={idRitorno}
          //  Come in «Tutti»: un interruttore solo per la scheda, perché anche
          //  qui partono due scritture di gruppo sulle stesse righe — il rientro
          //  in coda e l'eliminazione.
          inCorso={rientroInCorso || eliminazioneInCorso}
          //  ⚠️ IL CONTATORE VA PASSATO ANCHE QUI, e prima non lo era: da questa
          //   scheda partono le due scritture di gruppo più lunghe della pagina
          //   (rimettere in coda duecento saltati, buttarne duecento), e senza
          //   `avanzamento` restavano un tasto che dice «Elimino…» per un
          //   minuto — cioè la stessa pagina muta che il lotto doveva togliere
          //   di mezzo. In «Tutti» il conto si vedeva, qui no.
          avanzamento={avanzamento}
          //  La stessa domanda che filtra la coda, non una copia: la riga dice
          //  «questo non torna a telefono» esattamente quando la coda non lo
          //  prenderebbe.
          tornaInCoda={eDaChiamare}
          onRimetti={(righe) => void rimettiInCoda(righe)}
          //  Anche un messo da parte cambia stato dalla sua pastiglia, e vale
          //  quello che vale per «Tutti»: `dalGiro: false`. Qui è ancora più
          //  netto — un saltato IN CODA NON C'È per costruzione (vedi `coda`),
          //  quindi mandarlo in fondo al giro non sposterebbe niente e
          //  spegnerebbe soltanto il nome tirato in testa dalla ricerca.
          onStato={(l, s) => void segna(l, s, { dalGiro: false })}
          onEliminaUno={eliminaUno}
          onEliminaMolti={eliminaMolti}
          onApri={(l) => setScheda(l)}
        />
      ) : (
        <>
          {giroFinito && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[12.5px] text-emerald-800">
                <b>Giro finito.</b> Hai provato tutti i {coda.length} in coda
                {segnate > 0 && ` e ne hai segnati ${segnate}`}. Chi non ha risposto è ancora qui:
                ricomincia più tardi, a un'ora diversa.
                {/*  Il giro è finito per la coda, non per la giornata: i messi da
                parte non ci sono dentro, e un «finito» che li tace li lascia lì
                fino a quando non se ne ricorda qualcuno. */}
                {saltati.length > 0 &&
                  ` Restano ${saltati.length === 1 ? "1 contatto messo" : `${saltati.length} contatti messi`} da parte, fuori dalla coda.`}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 text-[12px]"
                onClick={() => {
                  setInFondo(new Set());
                  setForzato(null);
                }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Ricomincia il giro
              </Button>
            </div>
          )}

          {prossimo ? (
            <>
              <SchedaProssimo
                //  La chiave sull'id fa ripartire da zero lo stato interno della
                //  scheda (note aperte, riquadro del numero) quando cambia persona:
                //  le note del contatto precedente rimaste aperte su questo si
                //  leggono come se fossero sue.
                key={prossimo.id}
                lead={prossimo}
                esiti={esitiProssimo}
                diRitorno={idRitorno.has(prossimo.id)}
                nomeConsulente={
                  mestieriDelCentro.get(String(prossimo.data?.consulenteId ?? ""))?.nome ?? ""
                }
                //  Il riquadro con le due vie compare SOLO a chi aspetta una
                //  decisione: chi è stato già confermato resta di ritorno nel
                //  distintivo (è un'informazione utile al telefono) ma non
                //  chiede più niente.
                decisione={
                  eDaDecidere(prossimo)
                    ? {
                        onConferma: () => void confermaRitorno(prossimo),
                        onRimetti: () => void rimettiFraIDaContattare(prossimo),
                        onVediDopo: () => void vediDopo(prossimo),
                        onWhatsApp: () => void segnaWhatsApp(prossimo),
                      }
                    : null
                }
                //  La riga che spiega cosa si sta guardando. Si costruisce qui
                //  perché è la pagina a sapere PERCHÉ questa persona è davanti:
                //  non è il suo turno, è stata cercata.
                fuoriCoda={
                  fuoriCoda
                    ? {
                        //  Se in coda non c'è perché qualcuno l'ha messo da parte,
                        //  quella è LA cosa da sapere prima di comporre il numero:
                        //  «adesso è Da contattare» da solo farebbe credere a una
                        //  scheda mai lavorata, e il collega che l'ha saltata
                        //  stamattina l'ha fatto per un motivo.
                        motivo: eSaltato(fuoriCoda)
                          ? `L'hai trovato cercando: è fra i «Lead saltati»${fuoriCoda.data?.saltatoDa ? `, messo da parte da ${fuoriCoda.data.saltatoDa}` : ""}, quindi in coda non c'è. Chiamarlo e segnare un esito da qui si può; per rimetterlo nel giro degli altri serve «Rimetti in coda».`
                          : `Non è nella coda di oggi: l'hai trovato cercando, e adesso è «${etichettaStato(fuoriCoda.data?.stato)}». Segnare un esito qui vale come in qualunque altra pagina.`,
                        onTorna: () => setForzato(null),
                      }
                    : null
                }
                //  Quanti ne ho già toccati in questo giro, più questo: è il numero
                //  che avanza mentre la coda resta ferma (chi non risponde ci
                //  rimane dentro, ed è giusto così).
                posizione={Math.min(codaFetta.length - daFare + 1, codaFetta.length)}
                totale={codaFetta.length}
                onEsito={(s) => void segna(prossimo, s)}
                onAltri={() => setGriglia(prossimo)}
                onSalta={() => void salta(prossimo)}
                onApri={() => setScheda(prossimo)}
              />

              {/* ── POI ─────────────────────────────────────────────────────────
              Non è un elenco da leggere: è la prova che la coda esiste e la
              scorciatoia per saltare a un nome preciso (capita: il cliente
              richiama mentre stai chiamando un altro). */}
              {elencoPoi.length > 0 && (
                <Scheda
                  titolo={fuoriCoda ? "La coda, intanto" : "Poi"}
                  nota={`${daFare} ancora da provare in questo giro · ${codaFetta.length} in coda${
                    fetta === "tutti" ? "" : ` · «${LEAD_STATUS_LABEL[fetta]}»`
                  }${quando === "sempre" ? "" : ` · ${NOME_FETTA_TEMPO[quando].toLowerCase()}`}`}
                  senzaPadding
                >
                  <ul className="divide-y divide-border">
                    {elencoPoi.slice(0, PROSSIMI_VISIBILI).map((l) => {
                      const d = l.data ?? ({} as LeadData);
                      const azione = prossimaAzione(l);
                      return (
                        <li key={l.id}>
                          <button
                            type="button"
                            onClick={() => setForzato(l.id)}
                            className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent/60"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium">
                                {`${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome"}
                                {idRitorno.has(l.id) && (
                                  <RotateCcw className="ml-1.5 inline h-3 w-3 -translate-y-px text-amber-600" />
                                )}
                              </span>
                              <span className="block truncate text-[11.5px] text-muted-foreground">
                                {d.telefono || "senza telefono"}
                                {azione.quando ? ` · ${azione.cosa} ${azione.quando}` : ""}
                                {inFondo.has(l.id) ? " · già provato" : ""}
                              </span>
                            </span>
                            <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato))}>
                              {etichettaStato(d.stato)}
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {/*  ⚠️ Qui c'era scritto «…è in Lead importati», e da quando
                      questa schermata SI CHIAMA «Lead importati» quella frase
                      mandava a cercare nel menu una voce che è questa. Adesso
                      dice cos'è quel posto — una tabella — invece di come si
                      chiamava. */}
                  {elencoPoi.length > PROSSIMI_VISIBILI && (
                    <p className="border-t border-border px-4 py-2 text-[11.5px] text-muted-foreground">
                      … e altri {elencoPoi.length - PROSSIMI_VISIBILI}. Per vederli tutti in
                      tabella, con i filtri e le azioni di gruppo, c'è{" "}
                      <Link
                        to="/CRM/avanzamento"
                        className="font-medium text-foreground underline underline-offset-2"
                      >
                        l'elenco completo
                      </Link>
                      .
                    </p>
                  )}
                </Scheda>
              )}
            </>
          ) : (fetta !== "tutti" || quando !== "sempre") && coda.length > 0 ? (
            /*  ── ⚠️ LA FETTA FINITA NON È LA CODA FINITA ──────────────────
                Chiamando solo «Segreteria» si arriva in fondo a quella fetta
                mentre in coda ci sono ancora settanta persone. «Nessuno da
                chiamare» lì in mezzo è la frase che fa chiudere la pagina a
                metà mattina.
                ⚠️ E il filtro NON si spegne da solo: tornare a «Tutti» senza
                 che nessuno l'abbia chiesto rimette davanti una prima chiamata
                 a chi si era messo a fare ritenti, cioè cambia lavoro sotto le
                 mani. Si dice che è finita QUELLA, e il ritorno è un tasto. */
            <Vuoto
              titolo={
                fetta !== "tutti"
                  ? `Finito «${LEAD_STATUS_LABEL[fetta]}»${quando === "sempre" ? "" : ` di ${NOME_FETTA_TEMPO[quando].toLowerCase()}`}`
                  : `Niente da chiamare ${NOME_FETTA_TEMPO[quando].toLowerCase()}`
              }
              testo={`In coda restano ${coda.length === 1 ? "ancora un contatto" : `ancora ${coda.length} contatti`}. Togli i filtri per continuare il giro.`}
              icona={Sparkles}
              azione={
                <Button
                  size="sm"
                  onClick={() => {
                    setFetta("tutti");
                    setQuando("sempre");
                  }}
                >
                  Vedi tutta la coda
                </Button>
              }
            />
          ) : (
            <Vuoto
              titolo={segnate > 0 ? "Coda finita" : "Nessuno da chiamare"}
              /*  ⚠️ A CODA VUOTA I SALTATI SONO L'UNICO LAVORO RIMASTO, e
                  questa schermata era l'ultimo punto in cui potevano sparire
                  dagli occhi: «Nessuno da chiamare» con cinque persone messe da
                  parte è una frase falsa, e chi la legge chiude la pagina. */
              testo={
                saltati.length > 0
                  ? `${segnate > 0 ? `Hai segnato ${segnate} esiti. ` : ""}In coda non c'è più nessuno, ma ${
                      saltati.length === 1
                        ? "un contatto è stato messo da parte"
                        : `${saltati.length} contatti sono stati messi da parte`
                    }: finché nessuno li rimette in coda, non li chiama nessuno.`
                  : segnate > 0
                    ? `Hai segnato ${segnate} esiti. Carica un'altra lista quando vuoi ricominciare.`
                    : "Qui compaiono i contatti arrivati da una lista con la prima chiamata ancora aperta, e chi era già in archivio e ricompare nel file che carichi."
              }
              icona={saltati.length > 0 ? SkipForward : Sparkles}
              azione={
                saltati.length > 0 ? (
                  <Button size="sm" onClick={() => setVista("saltati")}>
                    <SkipForward className="mr-1.5 h-3.5 w-3.5" /> Vedi i saltati
                  </Button>
                ) : puoCaricare ? (
                  <Button size="sm" onClick={() => setCaricaAperto(true)}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" /> Carica una lista
                  </Button>
                ) : undefined
              }
            />
          )}
        </>
      )}

      {/*  ── DOV'È FINITA LA FILA DI RIQUADRI CHE STAVA QUI ────────────────
           I tre KPI in fondo alla pagina dicevano gli stessi tre numeri che ora
           stanno in cima («In coda», «Da provare adesso», «Segnati oggi qui»).
           Lasciarli avrebbe voluto dire scrivere due volte la stessa giornata
           in due posti diversi — e prima o poi due posti che dicono lo stesso
           numero diventano due posti che ne dicono due. Sono saliti in cima
           perché lì li si legge PRIMA di telefonare, e sono dimagriti perché
           in cima lo spazio è dell'unica cosa che conta: la persona da
           chiamare. Il quarto numero, i richiami scaduti, qui non c'era. */}

      {/* ── LE FINESTRE CONDIVISE ─────────────────────────────────────────
          Una per volta e nessuna scritta qui: giorno e ora e importi li chiede
          QuickStatusDialog, l'elenco completo degli stati la griglia di
          SelettoreStatoDialog, la scheda intera LeadDialog. */}
      <QuickStatusDialog
        open={!!quickLead && !!quickStato}
        onOpenChange={(v) => {
          if (v) return;
          const id = quickLead?.id;
          setQuickLead(null);
          setQuickStato(null);
          //  ⚠️ Si va in fondo anche se la finestra è stata annullata, e la
          //  scelta è voluta: gli stati che passano di qui promettono una data,
          //  e un «richiamo oggi alle 18» salvato correttamente resterebbe
          //  primo in coda — cioè si riproporrebbe subito la stessa persona,
          //  all'infinito. Annullare e ritrovarselo più tardi costa un clic sul
          //  suo nome nell'elenco «Poi»; il giro infinito costa la giornata.
          //  ⚠️ …ma solo se l'esito veniva DAL GIRO. Aperta dalla pastiglia di
          //   una riga di «Tutti» o «Saltati», questa finestra non ha nessun
          //   giro da far scorrere: mandare in fondo di là vuol dire far calare
          //   «da provare adesso» per una scheda che nessuno ha chiamato, e
          //   farlo pure quando la finestra è stata annullata, cioè quando non
          //   è successo proprio niente. Vedi il terzo argomento di `segna`.
          if (id && segnoDalGiro.current) mandaInFondo(id);
        }}
        //  ⚠️ SENZA QUESTA RIGA IL CONTATORE «SEGNATI» NON CONTAVA GLI
        //   APPUNTAMENTI. Metà degli esiti rapidi — richiamo, ricontatto,
        //   appuntamento fissato e rifissato — non li scrive `segna`: promette
        //   un momento, quindi passa di qui, e questa pagina vedeva solo la
        //   finestra che si chiude, uguale identica sia che si salvi sia che si
        //   annulli. Risultato: chi fissava dieci appuntamenti leggeva «segnati
        //   0», cioè l'unico numero che dà il senso di avanzare diceva che la
        //   mattinata migliore della settimana non era successa.
        //  ⚠️ E il giorno appena promesso apre la lista di quel giorno: vedi
        //   `giornoFissato`. Solo per gli appuntamenti — un richiamo non
        //   riempie nessuna agenda, e mostrarne l'elenco sarebbe rumore.
        onSalvato={(info) => {
          setSegnate((n) => n + 1);
          if (info?.giorno && eAppuntamento(info.stato)) setGiornoFissato(info.giorno);
        }}
        lead={quickLead}
        newStatus={quickStato}
      />

      {chiusura.finestra}

      <FinestraStati
        aperta={!!griglia}
        onChiudi={() => setGriglia(null)}
        stato={griglia?.data?.stato}
        opzioni={griglia ? statiSelezionabili(griglia.data ?? {}) : []}
        contesto={
          griglia
            ? `${griglia.data?.nome ?? ""} ${griglia.data?.cognome ?? ""} · adesso: ${etichettaStato(griglia.data?.stato)}`.trim()
            : undefined
        }
        onScegli={(s) => {
          const l = griglia;
          //  Prima si chiude, poi si sceglie: quasi sempre lo stato scelto apre
          //  una SECONDA finestra, e due dialoghi aperti insieme si rubano il
          //  fuoco e lasciano due veli sovrapposti.
          setGriglia(null);
          if (l) void segna(l, s);
        }}
      />

      {/*  ── ⚠️ QUI C'ERA LA STRISCIA «L'HAI MANDATO DAVVERO?» ────────────
           Chiedeva in fondo alla pagina, al ritorno da WhatsApp, e finché non
           le si rispondeva la scheda restava in cima alla coda.
           Il committente l'ha spostata dove il lavoro si guarda: «quando
           clicco contatta su WhatsApp spostalo su contattati su WhatsApp, e lì
           posso cliccare un check se è stato contattato oppure una X se non ho
           inviato il messaggio». È meglio per un motivo che si vede solo in
           postazione: fra il clic e la risposta possono passare dieci minuti e
           tre telefonate, e una domanda che ti aspetta in fondo allo schermo
           mentre stai parlando con qualcun altro è una domanda a cui si
           risponde a caso. Adesso la scheda si sposta subito — il lavoro fatto
           si vede — e la conferma si dà dalla sua linguetta, quando si guarda
           chi aspetta risposta. */}

      <LeadDialog open={!!scheda} onOpenChange={(v) => !v && setScheda(null)} lead={scheda} />
    </Pagina>
  );
}
