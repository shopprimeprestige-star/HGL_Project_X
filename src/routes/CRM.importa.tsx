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
 *  crm/CRMSidebar.tsx) e si raggiunge dalla voce «Elenco completo» del menu
 *  «Altro» qui sopra la lista. La divisione del lavoro è la stessa di prima —
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
 *
 *  ── DAL 12/10/2026: UNA LISTA SOLA, «DA CHIAMARE» ─────────────────────────
 *  Richiesta del titolare: la setter capisce subito chi chiamare per primo e
 *  PERCHÉ. Tre porte e dieci sotto-schede sono diventate tre linguette (Da
 *  chiamare, In attesa, Fissati da me) e il menu «Altro»; le sei pastiglie di
 *  stato e le quattro di tempo sono diventate tre filtri (Annuncio, Risposta,
 *  Stato), scritti nell'indirizzo; ogni riga porta la targhetta del motivo. Le
 *  regole stanno in moduli provati — crm/importa/chi-chiamare (chi è in lista,
 *  l'ordine, il motivo, il verdetto), crm/importa/filtri-lista, crm/importa/
 *  reparti (le linguette) — e questa pagina le disegna e le collega: `eDaChiamare`,
 *  `ordinaCoda` e `patchEsito` non vivono più qui.
 *  ⚠️ NIENTE SI È TOLTO: Tutta la lista, Ripesca, Doppioni, Note e promemoria
 *   (la vecchia «Oggi») ed Elenco completo sono nel menu Altro; «Di ritorno» è
 *   la voce «Di ritorno» del filtro Stato, con i suoi due blocchi sotto la
 *   lista. Le scorciatoie 1…4, S, A e / funzionano come prima.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useRef, useState, type ReactNode, useCallback } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  MessageCircle,
  Phone,
  RotateCcw,
  SkipForward,
  Sparkles,
  Undo2,
  Upload,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth, useConsulenteCollegato, usePuo } from "@/crm/AuthContext";
//  Il motivo per cui un permesso manca è scritto una volta sola, in
//  crm/permessi: qui serve al rifiuto dell'eliminazione, che è l'unico comando
//  di questa pagina il cui pulsante non lo disegna la pagina (vedi
//  `puoEliminare`) e che quindi deve spiegarsi a parole invece di sparire.
import { MOTIVO_PERMESSO } from "@/crm/permessi";
import { useCRM } from "@/crm/CRMContext";
//  I mestieri (setter / consulente) si leggono da un posto solo: sono spunte
//  sulla scheda del collaboratore, e questa è la funzione che le interpreta.
import { mestieriDi } from "@/crm/kpi-setter";
import { NuovaCosa, type NuovaCosaCampi } from "@/crm/dafare/NuovaCosa";
import { creaCosaDaFare, liberaAgendaDi } from "@/crm/dafare/crea-cosa";
import {
  LEAD_STATUS_LABEL,
  ALL_LEAD_STATUSES,
  eAppuntamento,
  eStatoDaChiamare,
  type Lead,
  type LeadData,
  type LeadStatus,
  type RisposteModulo,
} from "@/crm/types";
//  La finestra che chiede giorno, ora e importi è quella del resto del CRM: qui
//  si CHIAMA, non si riscrive. Due procedure che chiedono la stessa data
//  finiscono per non chiederla nello stesso modo.
import { QuickStatusDialog, requiresAnyDialog } from "@/crm/QuickStatusDialog";
//  Chi ha PRESO l'appuntamento: non è chi ha toccato lo stato per ultimo né
//  chi lo farà. Vedi crm/chi-ha-fissato.
import { chiHaFissato, esitoFissato, fissataDa } from "@/crm/chi-ha-fissato";
//  ── TRE LINGUETTE E UN MENU «ALTRO» ─────────────────────────────────────
//  Quale stanza sta sotto quale linguetta, che numero va sulla linguetta e dove
//  si entra premendola: tutto lì, provato, e con l'elenco che garantisce che
//  nessuna delle dieci viste di prima si sia persa.
import {
  filtriLasciandoLaVoce,
  fuoriDallaLista,
  nessunRitornoInLista,
  type Vista as VistaImporta,
  type VoceAltro,
} from "@/crm/importa/reparti";
//  Da dove è entrato un lead: l'etichetta sulle righe e la voce «Lead da Google Sheets».
import { daGoogleSheets, origineInRiga } from "@/crm/importa/origine";
import { useChiusura } from "@/crm/ChiusuraDialog";
//  Anche il selettore di stato è uno solo (crm/SelettoreStatoDialog): da lì
//  arrivano la griglia completa, le icone per stato e — soprattutto — la regola
//  su QUALI stati proporre a QUESTO lead, che è di crm/types e non si scavalca.
import { FinestraStati, statiSelezionabili } from "@/crm/SelettoreStatoDialog";
import { LeadDialog } from "@/crm/LeadDialog";
import { patchWhatsappInviato } from "@/crm/importa/attesa-whatsapp";
import {
  AiutoScorciatoie,
  CLASSE_BADGE_STATO,
  Kpi,
  KpiRiga,
  Pagina,
  SCORCIATOIE_COMUNI,
  Scheda,
  Vuoto,
  classiStato,
  dataBreve,
  etichettaStato,
  giorniDaOggi,
  oggiIso,
  soloData,
  useScorciatoie,
  type Scorciatoia,
} from "@/crm/ui";
import { Pannello } from "@/crm/ui/Finestra";
//  Le risposte del modulo: riconosciute e lette in un punto solo, vedi la
//  testata di crm/modulo-lead.
import { moduloLetto, riassuntoModulo } from "@/crm/modulo-lead";
import {
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
  repartoDelRitorno,
  eSiFaVivoLui,
  eDaDecidere,
  eRimandato,
  patchConferma,
  patchContattatoWhatsApp,
  patchWhatsappConfermato,
  patchWhatsappNonInviato,
  patchRimettiInCoda,
  patchVediDopo,
} from "@/crm/importa/ricarico";
//  Chi si telefona oggi e chi aspetta la sua data: una regola sola.
import { daTelefonareOggi } from "@/crm/importa/da-telefonare";
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
import { SchedaOggi } from "@/crm/importa/SchedaOggi";
import { giornoLocale } from "@/crm/quando-stato";
//  ── CHI SI CHIAMA PER PRIMO, E PERCHÉ ─────────────────────────────────────
//  La regola «chi è in lista», l'ordine, il motivo da scrivere sulla targhetta
//  e il +1 ai tentativi stavano in questa pagina, senza prove: ora sono moduli
//  puri (chi-chiamare, filtri-lista) e la pagina li usa soltanto.
import {
  contaPromesse,
  inLista,
  listaDaChiamare,
  motivoChiamata,
  ordinaChiamate,
  dividiEsiti,
  patchEsito,
  tieniInTesta,
  type OpzioniChiamata,
} from "@/crm/importa/chi-chiamare";
import {
  applicaFiltri,
  etichettaAnnuncio,
  leggiRicercaImporta,
  opzioniFiltri,
  SENZA,
  type FiltriLista as FiltriListaRicerca,
} from "@/crm/importa/filtri-lista";
import { filtriAccesi, pulito } from "@/crm/importa/FiltriLista";
//  ── LA PAGINA SEMPLICE (commessa 2026-10-28) ───────────────────────────────
//  Intestazione, frase del giro, UN avviso, otto pillole, «Filtra» e «Altro»: le
//  regole sono moduli puri e provati (pillole-stato, coda-pagina, avvisi-pagina,
//  sezioni-altro); qui si collegano.
import { Intestazione } from "@/crm/importa/Intestazione";
import { FraseGiro } from "@/crm/importa/FraseGiro";
import { FasciaAvvisi } from "@/crm/importa/FasciaAvvisi";
import { BarraPillole } from "@/crm/importa/BarraPillole";
import { EtichetteAccese, PannelloFiltra } from "@/crm/importa/PannelloFiltra";
import { conStatoCanonico, numeroPillola, statoAlTocco } from "@/crm/importa/pillole-stato";
import { eFuoriCoda, righePagina } from "@/crm/importa/coda-pagina";
import { avvisiPagina, type VoceAvviso } from "@/crm/importa/avvisi-pagina";
import { sezioniAltro, type VoceAltro2 } from "@/crm/importa/sezioni-altro";
import { useIsMobile } from "@/hooks/use-mobile";
import { RigaChiamata } from "@/crm/importa/RigaChiamata";
import { temperaturaLead } from "@/crm/temperatura-lead";
import { StrisciaPosti } from "@/crm/StrisciaPosti";
import { MenuAltro } from "@/crm/importa/MenuAltro";
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
import { nomeDi } from "@/crm/importa/nome-lead";
import { SchedaProssimo } from "@/crm/importa/SchedaProssimo";
import { PannelloAssegna } from "@/crm/importa/PannelloAssegna";
import { RicercaContatto } from "@/crm/importa/RicercaContatto";
import { BloccoRitorno } from "@/crm/importa/BloccoRitorno";
import { SchedaGiorno } from "@/crm/importa/SchedaGiorno";
import { FinestraElimina } from "@/crm/importa/FinestraElimina";

/** Gli stati che hanno un pulsante nella fila della lista da chiamare. */
const STATI_DELLA_CODA = new Set<LeadStatus>([
  "da_contattare",
  "non_risponde",
  "segreteria",
  "attesa_whatsapp",
  "da_chiamare",
  "richiamo",
  "ci_ricontatta_lui",
]);

export const Route = createFileRoute("/CRM/importa")({
  head: () => ({ meta: [{ title: "Lead importati — CRM" }] }),
  //  ⚠️ I FILTRI STANNO NELL'INDIRIZZO (come i periodi dei KPI): restano dopo
  //   una ricarica, si possono mandare a un collega e il tasto Indietro
  //   funziona. `leggiRicercaImporta` scarta tutto ciò che non conosce, e ogni
  //   parametro è facoltativo: i collegamenti di prima restano validi.
  //  ⚠️ Dal 28/10/2026 le pillole sono otto: i valori vecchi di `?stato=`
  //   (nonRisponde, segreteria, ritentare) diventano «Non ha risposto» PRIMA di
  //   arrivare alla pagina, e nessun collegamento salvato si rompe.
  validateSearch: (raw: Record<string, unknown>) => conStatoCanonico(leggiRicercaImporta(raw)),
  component: LeadImportatiUnoAllaVolta,
});

/* ═══════════════════════════════════════════════════════════════════════════
   1. CHI È DA CHIAMARE, E IN CHE ORDINE

   Non sta più qui: è in crm/importa/chi-chiamare (la lista, l'ordine, il motivo
   di ogni riga, il verdetto) e crm/importa/filtri-lista (Annuncio, Risposta,
   Stato). Qui restano gli esiti a un tocco e il disegno.
   ═════════════════════════════════════════════════════════════════════════ */

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
  //  Richiesta del titolare (20/10/2026): sta nel menu «Altro» della scheda.
  "attesa_whatsapp",
  "da_chiamare",
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

/*  ── CHE COSA SI SCRIVE QUANDO SI DÀ UN ESITO ──────────────────────────────
 *  Sta in crm/importa/chi-chiamare (`patchEsito`), con il suo perché e le sue
 *  prove: «non risponde» e «segreteria» fanno anche +1 al contatore dei
 *  tentativi, una delle chiavi dell'ordine della lista.
 *  ⚠️ Nel cambio in massa una scheda che HA GIÀ quello stato non passa di lì:
 *   non si scrive niente e il contatore non sale. È voluto — «prendi i quaranta
 *   Non risponde e segnali Non risponde» non è un giro di telefonate, è un clic
 *   a vuoto — e il numero delle «già così» si legge nel messaggio di fine. */
/** «Annuncio · Gruppo» di una scheda, già scritto. Vuoto per le liste caricate a
 *  mano (nessun annuncio): meglio niente che «Liste senza annuncio» su ogni riga. */
function annuncioScritto(l: Lead): string {
  const e = etichettaAnnuncio(l.data?.tracking);
  return [e.annuncio, e.chiaveGruppo === SENZA ? null : e.gruppo].filter(Boolean).join(" · ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LA CORNETTA

   È in crm/importa/chiamare, con tutto il suo perché: da quando questa pagina
   ha una seconda scheda da cui si telefona (le scadenze), un tasto «Chiama»
   copiato sarebbe stato il primo dei due a tornare un tel: cieco che su un
   computer non fa niente.
   ═════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   5. CARICARE UNA LISTA — prima si guarda, poi si scrive

   Aprire un file NON tocca il database. Si legge, si mostra come è stato
   capito, e solo dopo compare il pulsante che scrive: un'importazione fatta al
   buio su ottocento schede non si annulla con un tasto, si annulla
   ricostruendo l'archivio.
   ═════════════════════════════════════════════════════════════════════════ */

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
  ["1…4", "Segna l'esito (gli altri sono in «Altro»)"],
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
  /** Il pannello aperto ora: «Filtra» o «Altro», o nessuno. Un foglio (telefono)
   *  non ferma le scorciatoie da solo: lo stato entra in `bloccato`. */
  const [pannello, setPannello] = useState<"filtra" | "altro" | null>(null);
  /** Solo telefono: il campo Cerca è aperto sotto l'intestazione. Finché lo è,
   *  i tasti 1…4, S e A non segnano niente. */
  const [ricercaAperta, setRicercaAperta] = useState(false);
  const telefono = useIsMobile();

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
  /** Chi è mostrato nella scheda grande adesso: resta in cima finché la setter
   *  non fa un gesto. Vedi `tieniInTesta` in importa/chi-chiamare. */
  const [fermo, setFermo] = useState<string | null>(null);

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
  /** Lo stato con cui aprire «Tutti» da un pulsante «Già lavorati». */
  const [statoTutti, setStatoTutti] = useState<LeadStatus | null>(null);
  /** «Tutta la lista» è stata aperta dalla voce «Lead da Google Sheets»: parte
   *  sulla lente «Tutti» (è un archivio di arrivi, non la lista di oggi). */
  const [daVoceFoglio, setDaVoceFoglio] = useState(false);
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
  /** ── ⚠️ I FILTRI DELLA LISTA STANNO NELL'INDIRIZZO ─────────────────────
   *  Richiesta del committente: la coda si apre già ottimizzata, ma un giro di
   *  telefonate non è mai tutto uguale — le prime chiamate si fanno col fiato
   *  lungo, i ritenti sono venti numeri in dieci minuti, una promessa ha la
   *  precedenza su tutto — e «da quando ho messo quello stato» è la seconda
   *  domanda di chi riprende un giro il giorno dopo.
   *  Erano due file di pastiglie (sei di stato, quattro di tempo) valide solo
   *  nella coda. Adesso sono TRE filtri — Annuncio, Risposta, Stato (il tempo è
   *  dentro Stato) — e vivono nell'indirizzo: restano dopo una ricarica, si
   *  mandano a un collega, e il tasto Indietro non si riempie (si scrive con
   *  `replace`). Le regole sono di crm/importa/filtri-lista.
   *  ⚠️ «Nessun filtro» resta il valore di partenza, e deve restarlo: la lista
   *   ordinata è il lavoro giusto da fare; il filtro è per chi vuole spezzarlo. */
  const filtri = Route.useSearch();
  const navigate = useNavigate({ from: "/CRM/importa" });
  const cambiaFiltri = useCallback(
    (f: FiltriListaRicerca) => {
      setFermo(null);
      void navigate({ search: f as never, replace: true });
    },
    [navigate],
  );
  /** ── LE DUE VOCI CHE APRONO «TUTTA LA LISTA» (menu Altro) ─────────────────
   *  «Lead da Google Sheets» la apre con Origine = Google Sheets e sulla lente
   *  «Tutti»; «Tutta la lista» toglie quell'Origine: così il tasto Altro dice
   *  sempre quale delle due si sta guardando. Il resto dell'indirizzo (annuncio,
   *  risposte) si tiene com'è, e una voce di Altro che non c'entra col foglio
   *  non tocca niente. */
  const senzaOrigine = (): FiltriListaRicerca => {
    const resto = { ...filtri };
    delete resto.origine;
    return resto;
  };
  const apriVoceFiltrata = (v: VoceAltro) => {
    if (!v.vista) return;
    setStatoTutti(null);
    setDaVoceFoglio(true);
    setVista(v.vista);
    cambiaFiltri({ ...senzaOrigine(), ...v.filtro });
  };
  const apriDalMenuAltro = (v: VistaImporta) => {
    //  ⚠️ L'Origine si toglie PRIMA di spegnere la voce: dopo, l'effetto sulla
    //   vista troverebbe la voce già spenta e lascerebbe il filtro acceso
    //   (Lead da Google Sheets › Doppioni › Da chiamare: revisione del 2° giro).
    if (filtri.origine === "google_sheets" && (v === "tutti" || daVoceFoglio))
      cambiaFiltri(senzaOrigine());
    setDaVoceFoglio(false);
    setVista(v);
  };
  /** ── UNA VOCE DEL MENU «ALTRO» ──────────────────────────────────────────
   *  Le voci arrivano da `sezioniAltro`; ognuna ha un'azione e qui si collega ai
   *  gesti che già c'erano: aprire una vista, aprire «Tutta la lista» filtrata
   *  (Google Sheets, o uno stato «Già lavorati»), aprire un pannello. L'Elenco
   *  completo è un collegamento vero nel menu e non passa da qui. */
  const apriVoceAltro = (v: VoceAltro2) => {
    const a = v.azione;
    if ("href" in a) return;
    if ("pannello" in a) {
      if (a.pannello === "carica") setCaricaAperto(true);
      else if (a.pannello === "assegna") setAssegnaAperto(true);
      else setAiutoAperto(true);
      return;
    }
    if (a.statoTutti) {
      //  Un pulsante «Già lavorati»: «Tutta la lista» già filtrata su quello stato.
      const st = a.statoTutti;
      esciDalFoglio();
      setStatoTutti(st);
      setVista("tutti");
      return;
    }
    if (a.filtro) {
      apriVoceFiltrata({ vista: a.vista, nome: v.nome, titolo: v.titolo, filtro: a.filtro });
      return;
    }
    //  Una vista senza filtri: «Tutta la lista» si apre intera, senza lo stato
    //  rimasto da un «Già lavorati».
    setStatoTutti(null);
    apriDalMenuAltro(a.vista);
  };
  /** Si lascia «Tutta la lista» aperta dalla voce del foglio: l'Origine che la
   *  voce aveva messo si toglie e la voce non è più aperta (vedi
   *  `filtriLasciandoLaVoce`). */
  const esciDalFoglio = () => {
    setDaVoceFoglio(false);
    const dopo = filtriLasciandoLaVoce(filtri, daVoceFoglio);
    if (dopo !== filtri) cambiaFiltri(dopo);
  };
  //  ⚠️ UN POSTO SOLO PER TUTTE LE STRADE: linguette, stanze, ricerca, note
  //   scadute… ogni `setVista` che porta fuori da «Tutta la lista» passa di qui.
  //   Lo «Già lavorati» resta su «tutti» e chiama `esciDalFoglio` da sé.
  useEffect(() => {
    if (daVoceFoglio && vista !== "tutti") esciDalFoglio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, daVoceFoglio]);
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
  /** La scheda della coda per cui si sta chiedendo «eliminare?». */
  const [daEliminare, setDaEliminare] = useState<Lead | null>(null);
  const [eliminoDaEliminare, setEliminoDaEliminare] = useState(false);
  //  Se intanto il lead sparisce (eliminato da un collega, aggiornamento in
  //  tempo reale) la domanda si chiude: non deve ricomparire sul prossimo.
  useEffect(() => {
    if (daEliminare && !leads.some((l) => l.id === daEliminare.id)) setDaEliminare(null);
  }, [daEliminare, leads]);
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

  /** ── LA LISTA «DA CHIAMARE» ────────────────────────────────────────────
   *  Si calcola, non si tiene: non esiste da nessuna parte un elenco «i lead da
   *  chiamare», c'è l'archivio e chi è da chiamare si riconosce dai suoi campi.
   *  Due sorgenti, un solo elenco senza doppioni, già in ordine di «chi chiamare
   *  adesso»: promessa → di ritorno → nuovo → è la sua ora → prima chiamata →
   *  ritento (la regola e l'ordine sono di crm/importa/chi-chiamare, provati).
   *   · i lead arrivati da una lista con la prima chiamata ancora aperta;
   *   · i contatti di ritorno, qualunque stato abbiano — il file ha appena
   *     rifatto il loro nome, e questo chiede una decisione.
   *
   *  ⚠️ CHI È SALTATO NON È IN LISTA, e vale per tutte e due le sorgenti,
   *   contatti di ritorno compresi: un saltato torna quando qualcuno preme
   *   «Rimetti in coda», non da solo perché è ricomparso in un file.
   *  ⚠️ CHI È STATO SCRITTO SU WHATSAPP O RIMANDATO («Vedi dopo») ESCE DALLA
   *   LISTA, e chi ha una promessa per un altro giorno non ci entra nemmeno se
   *   è di ritorno: lo si ritrova nel suo reparto, e il giorno della promessa
   *   rientra da sé in cima. Sono le regole di prima, spostate in `inLista`.
   *  ⚠️ `moduloLetto` SI CALCOLA UNA VOLTA PER LEAD, non a ogni disegno né a ogni
   *   confronto dell'ordinamento: legge anche le note, e su mille lead con un
   *   orologio che scatta ogni quindici secondi sarebbe lavoro buttato.
   *  ⚠️ L'ORDINE SI RIFÀ SUL MINUTO, non sui quindici secondi dell'orologio: una
   *   lista che si riordina sotto il dito mentre si sta per premere un nome è il
   *   contrario di una lista in cui ci si orienta. */
  const minuto = Math.floor(adesso / 60_000);
  const adessoOrdine = useMemo(() => new Date(minuto * 60_000), [minuto]);
  const moduliPerDati = useMemo(() => {
    const m = new WeakMap<object, RisposteModulo | undefined>();
    for (const l of leads ?? []) if (l?.data) m.set(l.data, moduloLetto(l.data));
    return m;
  }, [leads]);
  const moduloDi = useCallback(
    (d: Partial<LeadData>) => (moduliPerDati.has(d) ? moduliPerDati.get(d) : moduloLetto(d)),
    [moduliPerDati],
  );
  const opzioniChiamata = useMemo<OpzioniChiamata>(
    () => ({ idRitorno, moduloDi }),
    [idRitorno, moduloDi],
  );
  /** ── LISTA E CODA, DUE INSIEMI (28/10/2026) ─────────────────────────────
   *  `lista` = la regola di sempre (`inLista`), «Attesa WhatsApp» compreso: da lì
   *  nascono le righe dei filtri e i numeri delle pillole. `coda` = la lista senza
   *  chi sta ancora aspettando la risposta su WhatsApp: quelli da chiamare adesso.
   *  Vedi crm/importa/coda-pagina. */
  const { lista, coda } = useMemo(
    () => righePagina(leads ?? [], adessoOrdine, opzioniChiamata),
    [leads, adessoOrdine, opzioniChiamata],
  );
  /** Le righe con il loro motivo: è su queste che lavorano i filtri e i conti.
   *  `inCoda` dice di ognuna se è anche in coda: senza una pillola scelta le righe
   *  fuori coda non ci sono (crm/importa/filtri-lista). */
  const righeLista = useMemo(() => {
    const idCoda = new Set(coda.map((l) => l.id));
    return lista.map((lead) => {
      const perche = motivoChiamata(lead, adessoOrdine, opzioniChiamata);
      return {
        id: lead.id,
        data: lead.data,
        motivo: perche.motivo,
        perche,
        modulo: moduloDi(lead.data),
        lead,
        inCoda: idCoda.has(lead.id),
      };
    });
  }, [lista, coda, adessoOrdine, opzioniChiamata, moduloDi]);

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
   *  lavorare tutti insieme, né ritrovare il giorno dopo. Adesso hanno la voce
   *  «Di ritorno» del filtro Stato — e restano anche in cima alla lista, con la
   *  targhetta DI RITORNO e una fascia che li richiama, perché è la telefonata
   *  che rende di più della giornata e nasconderla dentro un filtro vorrebbe
   *  dire non farla più.
   *  ⚠️ CHI È STATO SCRITTO O RIMANDATO NON È QUI: ha già il suo reparto. Una
   *   persona sta in un elenco solo — è tutta la richiesta. */
  const diRitorno = useMemo(
    () =>
      ordinaChiamate(
        (leads ?? []).filter((l) => l?.data && repartoDelRitorno(l) === "ritorno"),
        adessoOrdine,
        opzioniChiamata,
      ),
    [leads, adessoOrdine, opzioniChiamata],
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
   *  ⚠️ Chi ha una promessa scaduta compare ANCHE in «Altro → Note e
   *   promemoria» (la vecchia «Oggi»): quella è la scheda dell'orologio, non un
   *   reparto, e serve proprio a non far scadere le promesse. */
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

  /** Chi di ritorno NON è già nella lista «Da chiamare»: è l'unico a stare nel blocco
   *  sotto, con lo Stato «Di ritorno». Gli altri sono già nella scheda grande o nel
   *  «Poi», con le stesse decisioni: ripeterli li farebbe sembrare due persone. */
  const diRitornoFuori = useMemo(
    () => fuoriDallaLista(diRitorno, new Set(lista.map((l) => l.id))),
    [diRitorno, lista],
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
  /** Quanti sono arrivati dal foglio Google (accanto alla voce di Altro, e per
   *  sapere se il menu Origine ha qualcosa da scegliere). */
  const nDalFoglio = useMemo(
    () => importati.filter((l) => daGoogleSheets(l.data)).length,
    [importati],
  );
  /** ── GLI STATI GIÀ LAVORATI, PER I PULSANTI IN CIMA (20/10/2026) ───────
   *  Tutti gli stati presenti fra i lead importati che NON sono della lista da
   *  chiamare (quelli hanno i loro pulsanti sopra), nell'ordine canonico. */
  const statiGiaLavorati = useMemo(() => {
    const conti = new Map<LeadStatus, number>();
    for (const l of importati) {
      const st = l.data?.stato as LeadStatus | undefined;
      if (st) conti.set(st, (conti.get(st) ?? 0) + 1);
    }
    return ALL_LEAD_STATUSES.filter(
      (st) => !STATI_DELLA_CODA.has(st) && (conti.get(st) ?? 0) > 0,
    ).map((st) => ({ stato: st, n: conti.get(st) ?? 0 }));
  }, [importati]);
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

  /** ── I FILTRI APPLICATI ────────────────────────────────────────────────
   *  Annuncio, Risposta e Stato si applicano alle righe della lista (regole e
   *  conti in crm/importa/filtri-lista). I numeri accanto alle voci dei menu
   *  sono quelli che escono premendole: `opzioniFiltri` conta ogni voce con gli
   *  ALTRI filtri già accesi. */
  const opzioni = useMemo(
    () => opzioniFiltri(righeLista, filtri, oggiQui),
    [righeLista, filtri, oggiQui],
  );
  const righeFiltrate = useMemo(
    () => applicaFiltri(righeLista, filtri, oggiQui),
    [righeLista, filtri, oggiQui],
  );
  const nFiltri = filtriAccesi(filtri);

  /** La lista come la si sta guardando adesso. Da qui in giù comanda lei: la
   *  scheda grande, l'elenco «Poi», il conto di quel che resta. */
  const codaFetta = useMemo(() => righeFiltrate.map((r) => r.lead), [righeFiltrate]);

  /** L'ordine finale: chi è già passato in fondo, e il nome scelto a mano in
   *  testa a tutti. */
  const ordinata = useMemo(() => {
    const prima = codaFetta.filter((l) => !inFondo.has(l.id));
    const dopo = codaFetta.filter((l) => inFondo.has(l.id));
    const tutti = [...prima, ...dopo];
    if (!forzato) return tieniInTesta(tutti, fermo);
    const i = tutti.findIndex((l) => l.id === forzato);
    return i > 0 ? [tutti[i], ...tutti.slice(0, i), ...tutti.slice(i + 1)] : tutti;
  }, [codaFetta, inFondo, forzato, fermo]);
  //  Chi arriva in cima ci resta: si ferma qui e lo libera solo un gesto.
  useEffect(() => {
    if (forzato) return;
    const testa = ordinata[0]?.id ?? null;
    if (testa !== fermo) setFermo(testa);
  }, [ordinata, forzato, fermo]);

  /** Chi è in coda, per id: serve alla ricerca (che deve DIRE se il risultato
   *  è in coda o no) e a riconoscere il forzato che in coda non c'è. */
  const idInCoda = useMemo(() => new Set(coda.map((l) => l.id)), [coda]);
  /** Perché ognuno è in lista (la targhetta), per id. */
  const percheDi = useMemo(() => new Map(righeLista.map((r) => [r.id, r.perche])), [righeLista]);
  /** Chi si vede con i filtri di adesso. */
  const idVisibili = useMemo(() => new Set(codaFetta.map((l) => l.id)), [codaFetta]);

  /** ── PORTARE UN NOME DAVANTI ───────────────────────────────────────────
   *  Dalla ricerca e dalle note scadute: `forzato` fa scalare `ordinata`, e in
   *  `ordinata` ci sono solo le righe che passano i filtri. Un nome che è in
   *  lista ma è tenuto fuori dai filtri accesi non farebbe accadere niente di
   *  visibile — il caso per cui la ricerca esiste. Allora i filtri si
   *  azzerano: chi cerca un nome vuole quel nome, non «quel nome, se passa». */
  const portaInTesta = (l: Lead) => {
    if (idInCoda.has(l.id) && !idVisibili.has(l.id)) {
      cambiaFiltri({});
      //  Il cambio si dice: chi stava facendo ritenti si ritrova la lista intera.
      toast.info(`Filtri azzerati per mostrare ${nomeDi(l, "il contatto")}`);
    }
    setForzato(l.id);
    setVista("coda");
  };

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
  //  ⚠️ Fuori coda = portato in testa a mano, non in coda E non fra le righe che si
  //   vedono (`eFuoriCoda`): con la pillola «Attesa WhatsApp» accesa un nome
  //   cliccato nel «Poi» è fuori coda ma si vede, e non è «trovato con la ricerca».
  const fuoriCoda = useMemo(
    () =>
      forzato && eFuoriCoda(forzato, idInCoda, idVisibili)
        ? ((leads ?? []).find((l) => l.id === forzato) ?? null)
        : null,
    [forzato, idInCoda, idVisibili, leads],
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
  /** Le note e i richiami scaduti di «Note e promemoria» (dentro Altro). Hanno il
   *  loro numero e NON sono il verdetto in testata: questo conto include le note
   *  che il setter si scrive, i saltati e l'ora; il verdetto conta solo le
   *  promesse della lista (`contaPromesse`), le stesse righe dello Stato
   *  «Promesse». */
  const noteScadute = useMemo(() => contaInRitardo(scadenze), [scadenze]);
  /** Il verdetto in testata: quante promesse ci sono nella lista e quante già
   *  scadute. Premendolo si apre lo Stato «Promesse» con esattamente quelle. */
  const promesse = useMemo(
    () => contaPromesse(leads ?? [], adessoOrdine, opzioniChiamata),
    [leads, adessoOrdine, opzioniChiamata],
  );

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
      oggi: noteScadute,
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
      noteScadute,
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
  /** Le voci del menu «Altro»: In attesa, Fissati da me, Già lavorati, Liste,
   *  Strumenti (crm/importa/sezioni-altro). */
  const sezioni = useMemo(
    () => sezioniAltro({ giaLavorati: statiGiaLavorati }),
    [statiGiaLavorati],
  );
  /** ── LE COSE DA GUARDARE, IN UNA FASCIA SOLA ───────────────────────────
   *  «Di ritorno» ha lo stesso numero della sua pillola (senza altri filtri):
   *  `numeroPillola` è la funzione che la scrive. */
  const nRitorni = useMemo(
    () => numeroPillola("ritorno", opzioniFiltri(righeLista, {}, oggiQui).stato, diRitornoFuori.length),
    [righeLista, oggiQui, diRitornoFuori.length],
  );
  const voci = useMemo(
    () =>
      avvisiPagina({
        scaduti: promesse.scadute,
        scadutiTutte: promesse.tutte,
        daParte: saltatiFermi,
        daParteTutti: saltati.length,
        ritorni: nRitorni,
      }),
    [promesse.scadute, promesse.tutte, saltatiFermi, saltati.length, nRitorni],
  );
  /** Il giro intero (non la fetta dei filtri): il numero della frase è quello
   *  di «Tutta la coda». */
  const daProvareInCoda = useMemo(
    () => coda.filter((l) => !inFondo.has(l.id)).length,
    [coda, inFondo],
  );

  /** Passa al prossimo senza scrivere niente in archivio: chi ha già preso un
   *  esito scende in fondo al giro di adesso. Non c'entra col salto — vedi la
   *  nota su `inFondo`. */
  const mandaInFondo = (id: string) => {
    setForzato((f) => (f === id ? null : f));
    //  Chi scende in fondo non resta fermo in cima: senza questa riga la
    //  finestra rapida annullata o la vendita registrata riproponevano la
    //  stessa persona all'infinito (vedi `tieniInTesta`).
    setFermo((f) => (f === id ? null : f));
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
  /** Questa scheda, tolto il salto, torna nella lista «Da chiamare»? La domanda
   *  è della lista (`inLista`), non una seconda scritta qui: la riga dei saltati
   *  dice «non torna a telefono» esattamente quando la lista non la prenderebbe.
   *  Si guarda la scheda COME SARÀ senza il salto (`PATCH_RIENTRO` tocca solo i
   *  due campi del salto, quindi né `importato` né lo stato cambiano). */
  const tornaAlTelefono = (l: Lead) =>
    inLista({ id: l.id, data: { ...l.data, ...PATCH_RIENTRO } }, new Date(), { idRitorno });

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
          if (tornaAlTelefono(l)) tornate++;
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
          if (!(await updateLead(l.id, patchEsito(l.data, stato)))) return "fallita";
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
    setFermo(null);
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

  /** ── IL MESSAGGIO MANDATO DALLA SCHEDA GRANDE ───────────────────────────
   *  Segna l'ora: il lead entra in «Attesa WhatsApp» e ci resta finché lo stato
   *  non cambia. WhatsApp si apre comunque; se la scrittura fallisce lo si dice. */
  const segnaWhatsappInviato = async (l: Lead) => {
    if (!(await updateLead(l.id, patchWhatsappInviato(l.data)))) {
      toast.error("Messaggio non segnato", {
        description: `WhatsApp si è aperto, ma ${nomeDi(l)} non è finito in «Attesa WhatsApp». Riprova dal tasto.`,
      });
      return;
    }
    toast.success("In attesa su WhatsApp", {
      description: `${nomeDi(l)} esce da «Attesa WhatsApp» appena segni un esito.`,
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
    setFermo(null);
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
   *   · DAL GIRO (la scheda del prossimo, le scorciatoie 1…4, la griglia degli
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
    if (!(await updateLead(l.id, patchEsito(l.data, stato)))) {
      toast.error("Esito NON salvato", {
        description: "La scheda in archivio è rimasta com'era. Riprova.",
      });
      return;
    }
    setFermo(null);
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
        statoDal: l.data.statoDal,
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
    if (!(await updateLead(d.id, d.prima, { annulla: true }))) {
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

  /** Gli esiti proposti al lead in testa: servono anche alle scorciatoie 1…4,
   *  che devono puntare esattamente ai pulsanti che si vedono. */
  const esitiProssimo = useMemo(() => {
    if (!prossimo) return [] as LeadStatus[];
    const validi = new Set(statiSelezionabili(prossimo.data ?? {}));
    return ESITI_RAPIDI.filter((s) => validi.has(s));
  }, [prossimo]);
  /** I quattro in vista (tasti 1…4) e gli altri nel menu «Altro». */
  const esitiDivisi = useMemo(() => dividiEsiti(esitiProssimo), [esitiProssimo]);

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
      "/": () => {
        //  Sul telefono il campo sta chiuso dietro l'icona: si apre, poi si mette a fuoco.
        if (telefono) setRicercaAperta(true);
        window.setTimeout(() => cercaRef.current?.focus(), 0);
      },
      ...Object.fromEntries(
        esitiDivisi.inVista
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
    //  ⚠️ Anche la domanda «Eliminare questo lead?»: un «1» lì sotto segnava un
    //   esito alla persona che si stava eliminando (revisione del 22/10/2026).
    {
      bloccato:
        !!quickLead ||
        !!griglia ||
        !!scheda ||
        chiusura.aperta ||
        !!daEliminare ||
        //  ⚠️ Un foglio che sale dal basso (Filtra, Altro) e il campo Cerca aperto
        //   sul telefono non fermano i tasti da soli: li ferma questa riga.
        pannello !== null ||
        ricercaAperta ||
        vista !== "coda",
    },
  );

  /** Quanti nomi sotto la scheda del prossimo: cinque sul computer, tre sul telefono. */
  const prossimiVisibili = telefono ? 3 : PROSSIMI_VISIBILI;
  /** «Ultimo esito: … → Torna indietro»: la riga che disfa l'ultimo esito. */
  const ultimoEsito =
    vista === "coda" && ultimo ? (
      <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-1">
        <p className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
          Ultimo esito: <span className="font-medium text-foreground">{ultimo.nome}</span> →{" "}
          {LEAD_STATUS_LABEL[ultimo.stato]}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-11 shrink-0 px-2.5 text-[12px] md:h-7"
          onClick={() => void disfaUltimo(ultimo)}
        >
          <Undo2 className="mr-1 h-3.5 w-3.5" /> Torna indietro
        </Button>
      </div>
    ) : null;

  /** ── SOTTO LA LISTA, CON LO STATO «DI RITORNO» ─────────────────────────
   *  Le due fasce (chi ricompare da una lista, chi richiama lui): vedi BloccoRitorno. */
  const bloccoRitorno = (
    <BloccoRitorno
      diRitornoFuori={diRitornoFuori}
      diRitorno={diRitorno}
      siFannoViviLoro={siFannoViviLoro}
      confermaRitorno={confermaRitorno}
      rimettiFraIDaContattare={rimettiFraIDaContattare}
      setScheda={setScheda}
      mestieriDelCentro={mestieriDelCentro}
      segnaWhatsApp={segnaWhatsApp}
    />
  );

  return (
    <Pagina
      //  Sul telefono la barra degli esiti è fissa in basso: la pagina le lascia il posto.
      className={vista === "coda" && prossimo ? "pb-[calc(var(--barra-esiti,16px)+1rem)] md:pb-6" : undefined}
    >
      {/* ── L'INTESTAZIONE: TITOLO, CERCA, ALTRO ───────────────────────────
          Una riga sola. Cerca sta sempre fuori dal menu: il cliente richiama, e
          va trovato nei secondi in cui il telefono squilla. Le linguette, la fila
          «Già lavorati», «Carica una lista», «Assegna» e le scorciatoie sono in
          «Altro»: niente si è tolto, si è spostato (crm/importa/sezioni-altro).
          ⚠️ Il tasto delle scorciatoie è nascosto (`!hidden`) e resta solo il suo
           pannello, che si apre da «Altro» e con «?». */}
      <AiutoScorciatoie
        voci={SCORCIATOIE}
        aperto={aiutoAperto}
        onCambia={setAiutoAperto}
        className="!hidden"
      />
      <Intestazione
        ricercaAperta={ricercaAperta}
        onRicerca={setRicercaAperta}
        ricerca={
          <RicercaContatto
            leads={leads ?? []}
            inCoda={idInCoda}
            campoRef={cercaRef}
            //  ⚠️ Si passa da `forzato`, lo stesso stato del clic su un nome
            //  dell'elenco «Poi». La ricerca non ha una sua idea di «chi è il
            //  prossimo»: ne esiste una sola in questa pagina.
            onScegli={(l) => {
              //  Cercato da un'altra vista, si torna dove sta la scheda grande:
              //  altrimenti si preme un nome e non succede niente di visibile.
              //  E se i filtri lo tengono fuori, si azzerano (vedi `portaInTesta`).
              portaInTesta(l);
              setRicercaAperta(false);
            }}
          />
        }
        altro={
          <MenuAltro
            sezioni={sezioni}
            aperto={pannello === "altro"}
            onCambio={(a) => setPannello(a ? "altro" : null)}
            vista={vista}
            conti={contiViste}
            origine={filtri.origine}
            nGoogleSheets={nDalFoglio}
            permessi={{ "lead.crea": puoCaricare, "lead.assegna": puoAssegnare }}
            onVoce={apriVoceAltro}
            disabilitato={!!avanzamento}
          />
        }
      />

      {/* ── LA FRASE DEL GIRO ─────────────────────────────────────────────
          «74 da chiamare oggi · 12 fatti», con la coda INTERA (non la fetta dei
          filtri): il numero è quello di «Tutta la coda». A giornata vuota dice
          «Sei in pari». */}
      <FraseGiro daProvare={daProvareInCoda} fatti={coda.length - daProvareInCoda} />

      {/* ── UN SOLO AVVISO ────────────────────────────────────────────────
          Richiami scaduti, messi da parte da più di 3 giorni, ritorni da
          decidere: una fascia sola, ogni voce apre la sua lista. Senza voci non
          c'è. (Prima erano tre avvisi in tre posti.) */}
      <FasciaAvvisi
        voci={voci}
        disabilitato={!!avanzamento}
        onApri={(v: VoceAvviso) => {
          if ("vista" in v.apre) setVista(v.apre.vista);
          else {
            setVista("coda");
            cambiaFiltri({ stato: v.apre.stato });
          }
        }}
      />

      {/* ── LE PILLOLE DI STATO E «FILTRA» ───────────────────────────────
          Otto pillole nell'ordine in cui il lead cammina, col numero che esce
          toccandole; a destra «Filtra» (Annuncio, Risposta, Origine, Quando).
          ⚠️ COMPARE ANCHE A LISTA VUOTA: un indirizzo con una pillola o un annuncio
           che non ha più nessuno deve poter essere spento. Da un'altra vista,
           toccare una pillola riporta alla coda. */}
      {importati.length > 0 && (
        <div className="space-y-2">
          <BarraPillole
            scelto={vista === "coda" ? filtri.stato : undefined}
            statoOpzioni={opzioni.stato}
            ritorniFuoriLista={diRitornoFuori.length}
            accesi={vista === "coda" ? nFiltri : 0}
            disabilitato={!!avanzamento}
            onTocca={(id) => {
              if (vista !== "coda") setVista("coda");
              cambiaFiltri(
                pulito({ ...(vista === "coda" ? filtri : {}), stato: statoAlTocco(id, vista === "coda" ? filtri.stato : undefined) }),
              );
            }}
            onAzzera={() => cambiaFiltri({})}
            filtra={
              <PannelloFiltra
                filtri={vista === "coda" ? filtri : {}}
                opzioni={opzioni}
                //  Il menu Origine sta nella lista; in «Tutta la lista» ce n'è già uno suo.
                conOrigine={nDalFoglio > 0 && vista === "coda"}
                aperto={pannello === "filtra"}
                onCambio={(a) => setPannello(a ? "filtra" : null)}
                onCambia={(f) => {
                  if (vista !== "coda") setVista("coda");
                  cambiaFiltri(f);
                }}
                disabilitato={!!avanzamento}
              />
            }
          />
          {vista === "coda" && (
            <EtichetteAccese
              filtri={filtri}
              opzioni={opzioni}
              onCambia={cambiaFiltri}
              disabilitato={!!avanzamento}
            />
          )}
        </div>
      )}

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

      {/*  Com'è messo il giorno appena riempito: vedi SchedaGiorno. */}
      {giornoFissato && (
        <SchedaGiorno
          giornoFissato={giornoFissato}
          delGiorno={delGiorno}
          consulenteCollegato={consulenteCollegato}
          setGiornoFissato={setGiornoFissato}
          setScheda={setScheda}
        />
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
          onChiama={(l) => portaInTesta(l)}
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
          //  Aperta da un pulsante «Già lavorati»: si riapre filtrata su quello stato.
          key={`${statoTutti ?? "tutti"}${daVoceFoglio ? "·foglio" : ""}`}
          statoIniziale={statoTutti}
          tuttiIniziale={daVoceFoglio}
          nDalFoglio={nDalFoglio}
          importati={importati}
          moduloDi={moduloDi}
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
          tornaInCoda={tornaAlTelefono}
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

          {/*  ── ⚠️ TORNA INDIETRO ───────────────────────────────────────────
              Richiesta del committente. Un esito si segna col telefono in mano e
              si sbaglia col telefono in mano: si preme «Non risponde» mentre la
              persona sta rispondendo. Il messaggio che compare ha già il suo
              «Annulla», ma dura pochi secondi ed è la via per chi se ne accorge
              subito; questa riga resta finché non si segna qualcos'altro, per chi
              se ne accorge dopo aver posato il telefono.
              ⚠️ Dice CHI e COSA: «torna indietro» da solo, su una schermata che
               nel frattempo mostra un'altra persona, non fa capire su chi si sta
               per scrivere.
              Sta SOTTO la scheda del prossimo (e sopra la barra fissa del
              telefono, che le lascia il posto); a coda finita, al suo posto. */}
          {!prossimo && ultimoEsito}

          {prossimo ? (
            <>
              <SchedaProssimo
                //  La chiave sull'id fa ripartire da zero lo stato interno della
                //  scheda (note aperte, riquadro del numero) quando cambia persona:
                //  le note del contatto precedente rimaste aperte su questo si
                //  leggono come se fossero sue.
                key={prossimo.id}
                lead={prossimo}
                //  Chi è stato tirato su dalla ricerca senza essere in lista non ha
                //  un motivo, e non se ne inventa uno.
                motivo={percheDi.get(prossimo.id) ?? null}
                modulo={moduloDi(prossimo.data)}
                annuncio={annuncioScritto(prossimo)}
                origine={origineInRiga(prossimo.data)}
                esiti={esitiDivisi.inVista}
                esitiAltri={esitiDivisi.inAltro}
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
                doveSono={filtri.stato === "whatsapp" ? "in attesa su WhatsApp" : undefined}
                //  «Ultimo esito → Torna indietro» sta dentro la barra degli esiti:
                //  sul telefono si legge sopra i pollici, non sotto la piega.
                sopraLaBarra={ultimoEsito}
                onEsito={(s) => void segna(prossimo, s)}
                onAltri={() => setGriglia(prossimo)}
                onSalta={() => void salta(prossimo)}
                onApri={() => setScheda(prossimo)}
                onWhatsAppInviato={() => void segnaWhatsappInviato(prossimo)}
                onElimina={puoEliminare ? () => setDaEliminare(prossimo) : undefined}
              />

              {daEliminare && (
                <FinestraElimina
                  daEliminare={daEliminare}
                  eliminoDaEliminare={eliminoDaEliminare}
                  setDaEliminare={setDaEliminare}
                  setEliminoDaEliminare={setEliminoDaEliminare}
                  eliminaUno={eliminaUno}
                />
              )}

              {/* ── I POSTI LIBERI, UNA RIGA SOLA ─────────────────────────────────
                  Richiesta del titolare (14/10/2026): è qui che la setter ha il
                  telefono in mano e il cliente chiede «quando?». Sotto la scheda
                  del prossimo, piccola; un tocco porta a Slot liberi.
                  ⚠️ Solo a chi ha `agenda`: senza, le ore tenute per una persona
                   sola non arrivano e i numeri sarebbero più alti del vero. */}
              {puo("agenda") && <StrisciaPosti className="px-1" />}

              {/* ── POI ─────────────────────────────────────────────────────────
              Non è un elenco da leggere: è la prova che la coda esiste e la
              scorciatoia per saltare a un nome preciso (capita: il cliente
              richiama mentre stai chiamando un altro). */}
              {elencoPoi.length > 0 && (
                <Scheda
                  titolo={fuoriCoda ? "La coda, intanto" : "Poi"}
                  nota={`${daFare} ancora da provare in questo giro · ${codaFetta.length} in lista${
                    nFiltri > 0
                      ? ` · ${nFiltri === 1 ? "1 filtro acceso" : `${nFiltri} filtri accesi`}`
                      : ""
                  }`}
                  senzaPadding
                >
                  <ul className="divide-y divide-border">
                    {elencoPoi.slice(0, prossimiVisibili).map((l, i) => {
                      const perche = percheDi.get(l.id);
                      if (!perche) return null;
                      return (
                        <RigaChiamata
                          key={l.id}
                          lead={l}
                          motivo={perche}
                          //  Il modulo è già in cache (moduliPerDati): costo nullo.
                          temperatura={temperaturaLead(moduloDi(l.data), l.data.qualifica)}
                          riassunto={riassuntoModulo(moduloDi(l.data))}
                          annuncio={annuncioScritto(l)}
                          origine={origineInRiga(l.data)}
                          //  Il numero 1 è la scheda grande: l'elenco comincia da 2.
                          posizione={i + (fuoriCoda ? 1 : 2)}
                          giaProvato={inFondo.has(l.id)}
                          diRitorno={idRitorno.has(l.id)}
                          onScegli={() => setForzato(l.id)}
                        />
                      );
                    })}
                  </ul>
                  {/*  ⚠️ Qui c'era scritto «…è in Lead importati», e da quando
                      questa schermata SI CHIAMA «Lead importati» quella frase
                      mandava a cercare nel menu una voce che è questa. Adesso
                      dice cos'è quel posto — una tabella — invece di come si
                      chiamava. */}
                  {elencoPoi.length > prossimiVisibili && (
                    <p className="border-t border-border px-4 py-2 text-[11.5px] text-muted-foreground">
                      … e altri {elencoPoi.length - prossimiVisibili}. Per vederli tutti in
                      tabella, con i filtri e le azioni di gruppo, c'è{" "}
                      <Link
                        to="/CRM/avanzamento"
                        className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-2 md:min-h-0"
                      >
                        l'elenco completo
                      </Link>
                      .
                    </p>
                  )}
                </Scheda>
              )}
            </>
          ) : nessunRitornoInLista(filtri.stato, diRitornoFuori.length, siFannoViviLoro.length) ? (
            /*  Con lo Stato «Di ritorno» e nessuna riga in lista, i blocchi sotto
                hanno le persone: una riga, non «Nessuno con questi filtri». I
                saltati restano a un clic anche da qui. */
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-[12.5px] text-muted-foreground">
              <p>
                {nessunRitornoInLista(filtri.stato, diRitornoFuori.length, siFannoViviLoro.length)}
              </p>
              {saltati.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setVista("saltati")}>
                  <SkipForward className="mr-1.5 h-3.5 w-3.5" /> Vedi i saltati ({saltati.length})
                </Button>
              )}
            </div>
          ) : nFiltri > 0 && coda.length > 0 ? (
            /*  ── ⚠️ LA FETTA FINITA NON È LA LISTA FINITA ─────────────────
                Chiamando solo «Da ritentare» si arriva in fondo a quella fetta
                mentre in lista ci sono ancora settanta persone. «Nessuno da
                chiamare» lì in mezzo è la frase che fa chiudere la pagina a
                metà mattina.
                ⚠️ E il filtro NON si spegne da solo: tornare a «Tutti» senza
                 che nessuno l'abbia chiesto rimette davanti una prima chiamata
                 a chi si era messo a fare ritenti, cioè cambia lavoro sotto le
                 mani. Si dice che non c'è nessuno CON QUESTI FILTRI, e il
                 ritorno è un tasto. */
            <Vuoto
              titolo="Nessuno con questi filtri"
              testo={`In lista restano ${coda.length === 1 ? "ancora un contatto" : `ancora ${coda.length} contatti`}. Togli i filtri per continuare il giro.`}
              icona={Sparkles}
              azione={
                <Button size="sm" onClick={() => cambiaFiltri({})}>
                  Azzera filtri
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

          {/*  Con lo Stato su «Di ritorno» restano sotto i due blocchi di prima. */}
          {filtri.stato === "ritorno" && bloccoRitorno}
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
