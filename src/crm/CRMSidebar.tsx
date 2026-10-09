/** ─────────────────────────────────────────────────────────────────────────
 *  CRMSidebar — la navigazione, ordinata sul FLUSSO DI LAVORO REALE
 *
 *  PERCHÉ È FATTA COSÌ
 *  La barra non è un indice del CRM: è la prima cosa che si guarda la mattina.
 *  Deve rispondere a «da dove comincio», non a «quali pagine esistono». Per
 *  questo il primo blocco ripercorre la giornata nell'ordine in cui accade —
 *  cosa devo fare oggi, chi è arrivato, cosa sta scadendo, chi viene in sede,
 *  chi devo installare, cosa devo ancora programmare — e tutto il resto sta
 *  sotto, dove si va quando si va a cercarlo.
 *
 *      Giornata     → il lavoro operativo: si apre più volte al giorno
 *      Strumenti    → i modi per lavorarlo (viste, chat, avvisi)
 *      Numeri       → come sta andando (fine giornata / fine settimana)
 *      Impostazioni → si tocca una volta ogni tanto
 *
 *  I BADGE
 *  Ogni voce operativa porta il suo numero, calcolato dai lead veri: il conto
 *  non si scrive mai qui a mano, si chiede alla stessa funzione che filtra la
 *  pagina — in ui.tsx per le voci dei lead, in `conteggiPose` più sotto per il
 *  gruppo delle pose — così menu e pagina non dicono due cifre. Il badge
 *  non compare mai a zero e il suo colore è l'URGENZA, non la categoria: rosa
 *  = c'è del ritardo dentro, ambra = è roba di oggi, grigio = è un conteggio.
 *  A barra chiusa il numero diventa un punto dello stesso colore: la cifra non
 *  ci starebbe, ma «qui c'è qualcosa, ed è rosso» deve restare visibile.
 *  Il numero è SEMPRE la giornata di oggi, mai la giornata più l'arretrato: un
 *  badge che somma le due cose dice ogni giorno la stessa cifra (l'archivio
 *  importato è di centinaia di schede) e si smette di guardarlo. L'arretrato
 *  sta nella frase al passaggio del mouse, che compare anche a badge spento.
 *  Il gruppo delle pose (Installazioni · Nel nostro centro · A domicilio · Da
 *  spedire · Con driver) legge quindi come una giornata sola: il primo numero è
 *  quante pose ci sono oggi, i tre sotto sono come si dividono, e «Da spedire»
 *  è l'unico che non ha una giornata — un pacco non ha un'ora, quindi lì il
 *  numero è la coda dei pacchi ancora fermi. Le pastiglie della pagina invece
 *  contano tutta la coda aperta: il badge è più piccolo di quello che si vede
 *  aprendo, e la frase del tooltip lo dice. Il criterio NON è ricopiato qui —
 *  si importa dalle stesse funzioni che filtrano quelle pagine (vedi
 *  `conteggiPose` più sotto), che è l'unico modo perché i due numeri restino
 *  parenti invece di diventare due opinioni.
 *
 *  TRE VOCI TOLTE, ZERO ROTTE ROTTE
 *  "Agenda", "Installazioni oggi" e l'elenco dei lead importati non sono più nel
 *  menu: la prima è coperta da Oggi (gli appuntamenti della giornata), la
 *  seconda è diventata il badge di Installazioni, il terzo è la tabella che
 *  stava accanto a una voce quasi omonima — due righe che cominciano con le
 *  stesse due parole si aprono a caso, e il committente ne ha chiesta una.
 *  Restano però nell'elenco qui sotto con `nascosta: true` — le rotte esistono
 *  ancora, i link salvati funzionano e la ricerca ⌘K continua a portarci,
 *  semplicemente non occupano più una riga di menu per un lavoro che si vede già
 *  altrove (o che si raggiunge da dentro la pagina che è rimasta).
 *  ⚠️ «Agenda posa» invece è STATA TOLTA DAVVERO, rotta compresa: non è
 *  nascosta, non è raggiungibile, e non va rimessa qui pensando di ritrovarla —
 *  la pagina /CRM/installazioni/agenda non esiste più. Il lavoro che ci si
 *  faceva (dare un giorno a chi ha pagato e aspetta) è la lente «Senza data»
 *  dentro Installazioni.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Calculator,
  Car,
  Euro,
  FileText,
  GitMerge,
  House,
  Inbox,
  ListChecks,
  Lock,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  Music2,
  PhoneCall,
  Search,
  Settings,
  Store,
  Sun,
  Ticket,
  TrendingDown,
  Upload,
  UserCheck,
  Users,
  Repeat,
  Truck,
  Wrench,
  CalendarPlus,
  Radio,
  Receipt,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, usePuo } from "./AuthContext";
import { useCRM } from "./CRMContext";
import { useUserSettings } from "./UserSettingsContext";
import {
  ETICHETTA_PERMESSO,
  MOTIVO_PERMESSO,
  PERMESSO_DI_SCHEDA,
  permessoDiPagina,
  type Permesso,
  paginaIniziale,
} from "@/crm/permessi";
import {
  Badge,
  PUNTO_BADGE,
  conteggiMenu,
  leadInstallazioniOggi,
  plurale,
  useRicerca,
  useTastoComando,
  Tasto,
  type ChiaveConteggio,
  type ChiaveConteggioPosa,
  type ContoBadge,
} from "./ui";
//  ── LE REGOLE DELLE LENTI SI IMPORTANO, NON SI RISCRIVONO ──────────────────
//   I badge del gruppo delle pose devono dire lo stesso numero delle pastiglie
//   di /CRM/installazioni, e l'unico modo perché due numeri non divergano mai è
//   che nascano dalla stessa riga di codice. Da qui si può: sono questi due file
//   a importare da ./ui, non il contrario, quindi il cerchio non si chiude —
//   ed è anche il motivo per cui questo conto non sta insieme agli altri dentro
//   conteggiMenu (vedi la nota su ChiaveConteggioPosa in ui.tsx).
import { aDomicilio, daSpedire, inNostroCentro, soloPose, spedita } from "./spedizione";
//  `conDriver` è l'unica porta da cui si legge «questa posa esce in due»: la
//  finestra, il segno sulle righe e la lente passano tutti di lì.
import { aspettaUnaData, conDriver } from "./InstallationScheduleDialog";
//  Il conto dei ritorni da seguire è quello della pagina, non un secondo
//  scritto qui: badge del menu e pastiglia della lente devono dire lo stesso.
import { quanteDaSeguire } from "./manutenzione/PannelloManutenzioni";
import type { Lead } from "./types";
//  ── IL NUMERO DI «DA FARE OGGI» LO CALCOLA LA PAGINA STESSA ────────────────
//   Non un secondo conto scritto qui: `costruisciRighe` è la funzione pura da
//   cui quella pagina fa nascere le sue righe, cose scritte a mano comprese, e
//   usarla è l'unico modo perché il badge e la pagina non dicano due cifre
//   diverse a due centimetri di distanza.
//   ⚠️ Le cose scritte a mano vivono in `app_config`, non nei lead: senza
//    leggerle il badge conterebbe meno righe di quelle che la pagina mostra —
//    ed è proprio il caso in cui uno smette di fidarsi del numero.
import { costruisciRighe } from "./dafare/righe";
import { toast } from "sonner";
import { caricaTask, type TaskManuale } from "./dafare/task-manuali";
import { useChiusure } from "./contabilita-chiusure";
import { useLiquidazione } from "./contabilita-liquidazione";
import { PREAVVISO_AVVISO, badgeScadenza, toccaAvvisare } from "./contabilita-scadenze";
//  ⚠️ La versione SCURA, non quella chiara: il CRM ha il fondo bianco, e il
//  marchio chiaro lì sopra si vedeva solo perché gli era stato messo dietro un
//  rettangolo bianco — cioè un rimedio che nascondeva il problema invece di
//  risolverlo. Il file scuro esisteva già in cartella.
import logoBrand from "@/assets/logo-hair-genius-dark.png";

export interface VoceMenu {
  /** nome corto, quello che si legge nella barra */
  titolo: string;
  /** nome esteso: tooltip a barra chiusa e testo cercabile da ⌘K */
  descrizione: string;
  url: string;
  icon: typeof Inbox;
  exact?: boolean;
  /** chiave usata in user_settings.scheme_access; se assente la voce è sempre visibile */
  scheme?: string;
  /** Il permesso della PERSONA che sta lavorando (vedi crm/permessi.ts). Le due
   *  cose convivono e servono entrambe: `scheme` dice che cosa quell'ACCOUNT
   *  vede, `permesso` che cosa quella PERSONA può fare. Quando manca si ricava
   *  dallo `scheme` (PERMESSO_DI_SCHEDA); dichiararlo qui serve alle voci in cui
   *  i due non coincidono — «Importa» sta fra le impostazioni ma è l'archivio. */
  permesso?: Permesso;
  /** parole con cui la pagina viene cercata da ⌘K anche se non sono nel nome
   *  (es. si scrive "fatturato" e si arriva ai KPI) */
  alias?: string;
  /** quale coda di lavoro accende il badge: il numero arriva da conteggiMenu
   *  (ui.tsx) per le voci dei lead, da conteggiPose (qui sotto) per il gruppo
   *  delle pose */
  badge?: ChiaveConteggio;
  /** Fuori dal menu ma dentro la ricerca: la pagina esiste ancora e i link
   *  salvati funzionano, semplicemente non merita una riga fissa. */
  nascosta?: boolean;
}

export interface GruppoMenu {
  titolo: string;
  voci: VoceMenu[];
}

/** Il permesso che una voce richiede: quello dichiarato, altrimenti quello che
 *  si ricava dalla sua scheda. Sta qui, in una funzione sola, perché lo stesso
 *  giudizio serve al menu e alla ricerca ⌘K (routes/CRM.tsx usa GRUPPI_MENU):
 *  due copie si sarebbero disallineate, e la ricerca avrebbe continuato a
 *  portare dove il menu non porta più. */
export function permessoDiVoce(v: VoceMenu): Permesso | null {
  return v.permesso ?? (v.scheme ? (PERMESSO_DI_SCHEDA[v.scheme] ?? null) : null);
}

/** ── L'ELENCO ──────────────────────────────────────────────────────────────
 *  Esportato perché la ricerca globale (⌘K, in routes/CRM.tsx) usa la STESSA
 *  lista per la navigazione rapida: due elenchi separati si sarebbero
 *  disallineati alla prima pagina nuova — ed è anche il motivo per cui le voci
 *  nascoste restano qui invece di essere cancellate. */
export const GRUPPI_MENU: GruppoMenu[] = [
  {
    //  L'ordine è quello della giornata, non quello dell'organigramma: si parte
    //  da cosa è in scadenza, si passa a chi è appena arrivato, si finisce con
    //  la logistica della posa.
    titolo: "Giornata",
    voci: [
      {
        titolo: "Oggi",
        descrizione: "Cosa c'è da fare adesso",
        url: "/CRM",
        icon: Sun,
        exact: true,
        scheme: "dashboard",
        alias: "dashboard home panoramica riepilogo agenda appuntamenti giornata",
        badge: "oggi",
      },
      {
        //  ── LA PAGINA CHE NON ERA NEL MENU ────────────────────────────────
        //   /CRM/dafare esisteva già ed era raggiungibile SOLO scrivendo
        //   l'indirizzo: una schermata di lavoro quotidiano che vedeva chi si
        //   era salvato il preferito, cioè nessuno. Sta subito sotto «Oggi»
        //   perché risponde alla stessa domanda un minuto dopo: «Oggi» dice
        //   com'è fatta la giornata, questa dice cosa toccare adesso, in ordine
        //   di momento — con dentro anche le cose scritte a mano, che nessuna
        //   altra pagina conosce.
        //   ⚠️ Nessun badge: il numero di questa pagina è la pagina stessa, e
        //   un badge accanto a «Oggi» direbbe quasi sempre lo stesso numero del
        //   suo (le due code si sovrappongono). Due numeri vicini che non
        //   coincidono mai fanno smettere di credere a entrambi.
        titolo: "Da fare oggi",
        descrizione: "Le cose del giorno in ordine di momento, note comprese",
        url: "/CRM/dafare",
        icon: ListChecks,
        scheme: "dashboard",
        alias: "da fare task cose promemoria chiamate giornata adesso arretrato",
        badge: "dafare",
      },
      {
        //  Sono lead anche questi: la voce dice in che STATO sono, non che cosa
        //  sono — appena arrivati e non ancora di nessuno. Passano nell'elenco
        //  "Lead" nel momento in cui vengono assegnati, ed è il motivo per cui
        //  le due voci restano separate invece di essere un filtro solo.
        titolo: "Nuovi contatti",
        descrizione: "Lead appena arrivati, da assegnare",
        url: "/CRM/nuovi-contatti",
        icon: Inbox,
        scheme: "nuovi",
        alias: "lead nuovi arrivo assegnare accettare funnel",
      },
      {
        //  Si dice LEAD: era "Trattative" qui e "lead" dappertutto nella
        //  scheda, e chi cercava l'elenco doveva tradurre. L'indirizzo NON
        //  cambia (/CRM/trattative): i link salvati e le rotte restano validi.
        //  "trattative" resta fra gli alias: chi la chiama ancora così la trova
        //  lo stesso scrivendolo in ⌘K.
        titolo: "Lead",
        descrizione: "Tutti i lead: l'archivio completo",
        url: "/CRM/trattative",
        icon: Users,
        scheme: "leads",
        alias: "lead trattative clienti elenco archivio anagrafica pratiche",
        //  NESSUN NUMERO A SCHERMO, MA LA FRASE SÌ. Questa voce è l'archivio,
        //  non una coda da smaltire: un numero sempre a tre cifre accanto a
        //  una voce di menu non viene più letto e toglie forza ai badge che
        //  invece contano. Per questo conteggiMenu restituisce `n: 0` e il
        //  badge non viene disegnato.
        //  La chiave però serve, perché senza di essa la descrizione calcolata
        //  non arriva mai a schermo: al passaggio del mouse questa riga dice
        //  quanti lead hanno una scadenza già passata — lo stesso numero del
        //  filtro "In ritardo" della pagina, che usa la stessa prossimaAzione.
        //  È il posto dell'arretrato: prima stava appeso al badge "Oggi", dove
        //  faceva sembrare arretrato il lavoro di giornata.
        badge: "trattative",
      },
      {
        titolo: "Appuntamento in sede",
        descrizione: "Clienti che vengono in sede",
        url: "/CRM/sede",
        icon: MapPin,
        scheme: "sede",
        //  ⚠️ NON È ROBA DA SETTER, e finora non lo diceva nessuno: lo schema
        //   «sede» non ha un permesso suo, quindi questa voce si apriva a
        //   chiunque fosse entrato. Chi viene in sede ci viene per una
        //   CONSULENZA — la pagina conta chi è atteso, chi ha un esito da
        //   mettere e quanto c'è da incassare quel giorno: sono le tre domande
        //   di chi la consulenza la fa. Il setter fissa e telefona, e questa
        //   riga nel suo menu era una pagina in cui non aveva niente da fare
        //   (segnalazione del committente).
        //   `preventivi` è lo stesso permesso con cui si distinguono Meetly e
        //   il webinar: uno solo per «questa persona fa consulenze».
        permesso: "preventivi",
        alias: "visita negozio showroom appuntamento fisico",
        badge: "sede",
      },
      {
        //  ── PRIMA QUELLO CHE VA DECISO, POI QUELLO CHE VA FATTO ───────────
        //   Un impianto pagato senza una data non è in ritardo con nessuno, ma
        //   è fermo — e finché il suo numero stava dentro quello delle pose,
        //   cinque impianti da programmare e una giornata vuota lasciavano il
        //   menu identico. Ha una voce sua, ambra, perché chiede di decidere;
        //   la voce qui sotto è verde perché lì c'è solo da eseguire.
        //   Porta alla stessa pagina con la lente già scelta, come le altre tre.
        titolo: "Da programmare",
        descrizione: "Impianti pagati che aspettano una data",
        url: "/CRM/installazioni?lente=senza-data",
        icon: CalendarPlus,
        scheme: "installazioni",
        alias: "senza data da fissare calendario programmare pose ferme",
        badge: "da_programmare",
      },
      {
        //  ── ⚠️ FUORI DAL MENU, SU RICHIESTA: ERA LA RIGA DI TROPPO ────────
        //   Questa voce apriva l'elenco INTERO delle pose programmate, cioè
        //   la somma delle tre righe qui sotto — sede, domicilio, spedizione —
        //   che sono i tre modi in cui l'impianto arriva al cliente e sono le
        //   righe su cui si lavora davvero. Quattro voci per lo stesso elenco
        //   fanno esitare ogni volta su quale premere.
        //   ⚠️ NASCOSTA, NON CANCELLATA, ed è la differenza che conta: la
        //    rotta /CRM/installazioni esiste ancora, i link salvati funzionano,
        //    ⌘K continua a portarci e le tre lenti qui sotto — che sono la
        //    STESSA pagina con un filtro — non hanno perso niente. Stesso
        //    trattamento di «Agenda» e «Installazioni oggi» (vedi la nota in
        //    cima al file).
        titolo: "Installazioni",
        descrizione: "Installazioni programmate, incluse quelle di oggi",
        url: "/CRM/installazioni",
        icon: Wrench,
        //  Confronto esatto: la giornata del tecnico sta DENTRO
        //  /CRM/installazioni/oggi, e senza questo resterebbe accesa anche
        //  questa voce mentre si è là — la barra direbbe due posti insieme.
        exact: true,
        scheme: "installazioni",
        alias: "posa montaggio installatore tecnico oggi",
        badge: "installazioni",
        nascosta: true,
      },
      {
        //  ── LE POSE CHE SI FANNO DA NOI ───────────────────────────────────
        //   Le tre voci che cominciano da qui sono i TRE MODI in cui l'impianto
        //   arriva al cliente (crm/spedizione.ts: sede · domicilio ·
        //   spedizione), nello stesso ordine in cui li nomina quel file.
        //   Mancava proprio la più frequente: chi voleva l'elenco delle pose in
        //   centro doveva partire da "Tutte" e togliere a mente le trasferte e
        //   i pacchi.
        //   ⚠️ «Nel nostro centro» NON è «Viene in sede», la voce lì sopra: là
        //   c'è una visita ancora da vendere, qui una vendita già fatta che va
        //   posata. Due schermate diverse per due momenti opposti, e le parole
        //   si somigliano abbastanza da sbagliare voce — l'etichetta è quella
        //   dello stato «Nel nostro centro» (types.ts), non "In sede", proprio
        //   per tenerle distinte all'occhio.
        titolo: "Nel nostro centro",
        descrizione: "Pose che si fanno da noi, in centro",
        url: "/CRM/installazioni?lente=in-sede",
        icon: Store,
        scheme: "installazioni",
        alias: "sede centro laboratorio posa in sede da noi negozio",
        badge: "in_sede",
      },
      {
        //  ── LE POSE A CASA DEL CLIENTE ────────────────────────────────────
        //   Stessa ragione della voce qui sotto: si raggiungono con la lente
        //   scritta nell'indirizzo, altrimenti bisognerebbe cambiarla a mano
        //   ogni volta. ⚠️ A differenza dei pacchi, queste pose restano nella
        //   giornata del tecnico e nei conteggi del giorno: occupano un tecnico
        //   e hanno un'ora. La voce serve a scriverne indirizzo e viaggio
        //   tutte insieme, non a tirarle fuori dal lavoro di giornata.
        titolo: "A domicilio",
        descrizione: "Pose a casa del cliente: indirizzo e costo del viaggio",
        url: "/CRM/installazioni?lente=a-domicilio",
        icon: House,
        scheme: "installazioni",
        alias: "domicilio casa cliente trasferta viaggio indirizzo posa a casa",
        badge: "a_domicilio",
      },
      {
        //  ── I PACCHI HANNO UNA VOCE LORO ──────────────────────────────────
        //   Non tutti gli impianti si posano: alcuni si spediscono. Una
        //   spedizione non occupa un tecnico e non ha un orario, quindi non
        //   compare fra le pose né nella giornata del tecnico — e senza una
        //   voce sua non si raggiungeva se non cambiando lente a mano ogni
        //   volta.
        //   L'indirizzo porta la lente con sé: si può mandare a un collega.
        titolo: "Da spedire",
        descrizione: "Impianti pagati che vanno spediti a casa",
        url: "/CRM/installazioni?lente=da-spedire",
        icon: Truck,
        scheme: "installazioni",
        alias: "spedizioni pacchi corriere indirizzo tracking",
        badge: "da_spedire",
      },
      {
        //  ── LE POSE IN CUI SI ESCE IN DUE ─────────────────────────────────
        //   Non è un quarto modo di consegna: una posa col driver si fa lo
        //   stesso in centro o a casa del cliente. È l'altra domanda che si fa
        //   chi prepara la settimana — «quel giorno chi impegno?» — perché
        //   ognuna di queste blocca anche l'agenda del driver, e per più ore di
        //   quella di chi posa (tre prima e tre dopo).
        //   ⚠️ STA IN FONDO AL GRUPPO DI PROPOSITO: le tre voci sopra sono i
        //   TRE MODI in cui l'impianto arriva al cliente, nell'ordine di
        //   crm/spedizione.ts, e infilare qui in mezzo una domanda diversa
        //   avrebbe spezzato l'unica sequenza del menu che si legge come un
        //   elenco chiuso — «o l'una, o l'altra, o l'altra ancora».
        titolo: "Con driver",
        descrizione: "Pose che escono in due: c'è un driver assegnato",
        url: "/CRM/installazioni?lente=con-driver",
        icon: Car,
        scheme: "installazioni",
        //  ⚠️ NIENTE "accompagnatore" fra le parole cercabili: è un'ALTRA
        //   persona (va a fare il lavoro, e quel compenso non lo prende — vedi
        //   crm/InstallationScheduleDialog). Chi la cerca da qui aprirebbe una
        //   lente che non la contiene.
        alias: "driver autista trasporto viaggio escono in due chi guida",
        badge: "con_driver",
      },
      {
        //  ── I CLIENTI CHE DEVONO TORNARE ──────────────────────────────────
        //   Richiesta del committente. È l'unica coda di questo gruppo che
        //   NON parla di pose in lavorazione: un impianto si mantiene, e il
        //   cliente torna ogni tot settimane per anni — cioè molto dopo che la
        //   sua posa è stata chiusa e non compare più in nessuna delle quattro
        //   voci qui sopra. Senza una riga sua, l'unico modo di trovarla era
        //   entrare in Installazioni e cambiare lente a mano, che è
        //   esattamente il motivo per cui esistono anche «A domicilio» e «Da
        //   spedire».
        //   ⚠️ STA DOPO «Con driver» e non in mezzo ai modi di consegna: le
        //    quattro voci sopra sono il ciclo di UNA vendita, questa è quello
        //    che succede dopo. Metterla prima avrebbe spezzato una sequenza
        //    che si legge come un elenco chiuso.
        titolo: "Manutenzioni",
        descrizione: "Clienti che devono tornare: ritorni scaduti, di oggi e della settimana",
        url: "/CRM/installazioni?lente=manutenzioni",
        icon: Repeat,
        scheme: "installazioni",
        alias: "manutenzione ritorni richiami periodici assistenza rifacimento tornano",
        badge: "manutenzioni",
      },
      //  ── Le due voci uscite dal menu ───────────────────────────────────────
      //  Restano raggiungibili da ⌘K e dai link salvati.
      {
        titolo: "Agenda",
        descrizione: "Appuntamenti dei consulenti",
        url: "/CRM/agenda",
        icon: CalendarDays,
        scheme: "agenda",
        alias: "calendario appuntamenti meet call consulenti",
        nascosta: true,
      },
      {
        titolo: "Installazioni oggi",
        descrizione: "Installazioni di oggi",
        url: "/CRM/installazioni/oggi",
        icon: CalendarCheck,
        scheme: "installazioni_oggi",
        alias: "posa oggi giornata installatore tecnico",
        nascosta: true,
      },
    ],
  },
  {
    //  Non sono code di lavoro: sono modi diversi di guardare o di toccare gli
    //  stessi lead. Tenerli fuori dal primo blocco è ciò che permette al primo
    //  blocco di leggersi in un colpo d'occhio.
    titolo: "Strumenti",
    voci: [
      {
        titolo: "Preventivi",
        descrizione: "Preventivi dal configuratore",
        url: "/CRM/preventivi",
        icon: FileText,
        scheme: "leads",
        //  Fare preventivi È il mestiere del consulente: senza questa riga la
        //  voce erediterebbe da `scheme: "leads"` il permesso «vedere i lead di
        //  tutti» e sparirebbe proprio a chi la usa tutto il giorno.
        permesso: "preventivi",
        alias: "quote configuratore percorso offerte",
      },
      {
        //  ── LE FATTURE ────────────────────────────────────────────────────
        //   Subito sotto i preventivi, ed è l'ordine in cui le due cose si
        //   incontrano davvero: prima si fa il preventivo, poi — quando i soldi
        //   arrivano — la fattura di quello stesso ordine.
        //   ⚠️ NESSUN BADGE, e nemmeno per le bozze in attesa: una bozza non è
        //    lavoro arretrato, è un documento pronto che aspetta un incasso che
        //    magari arriva fra tre settimane. Un numero acceso per tre settimane
        //    smette di essere letto, e si porta dietro anche quelli che contano.
        titolo: "Fatture",
        descrizione: "Bozze, emesse e file per il commercialista",
        url: "/CRM/fatture",
        icon: Receipt,
        scheme: "leads",
        permesso: "preventivi",
        alias: "fattura fatturazione xml sdi",
      },
      {
        /*  ── ⚠️ IL WEBINAR NON È UNA CONSULENZA CON PIÙ POSTI ──────────────
            Sta qui e non accanto a Meetly di proposito: sono due mestieri
            diversi. La consulenza è uno a uno, si prenota, e la si apre dalla
            scheda del lead. Il webinar è uno a tanti, non ha un lead davanti,
            e chi lo prepara sta pensando a una campagna — cioè è nella testa
            in cui si sta quando si aprono preventivi, fatture e conti.
            ⚠️ E il pulsante è SEPARATO: da qui non si può aprire per sbaglio
             una videoconsulenza, e da Meetly non si può far partire per
             sbaglio un webinar. Le due tecnologie non si toccano. */
        /*  ── ⚠️ LA PROVA CAPELLI STA FRA GLI STRUMENTI DI VENDITA ─────────
            Non è una schermata di impostazioni: è il posto dove si crea il
            codice da mandare a una persona con cui si sta già parlando, e
            dove si vede se quella persona ha poi comprato. Chi lo apre sta
            lavorando un contatto, non configurando un programma. */
        titolo: "Prova capelli",
        descrizione: "Codici da mandare su WhatsApp, ordini e tagli più scelti",
        url: "/CRM/prova-capelli",
        icon: Sparkles,
        scheme: "leads",
        permesso: "impostazioni",
        alias: "capelli taglio simulatore anteprima codice generazioni sumup pagamento pacchetti",
      },
      {
        titolo: "Webinar",
        descrizione: "Dirette a molte persone, con link da mandare agli iscritti",
        url: "/CRM/webinar",
        icon: Radio,
        scheme: "leads",
        //  ⚠️ ERA `agenda` — «creare una sala è creare un link che porta a un
        //   evento, lo stesso permesso di chi fissa gli appuntamenti» — E COSÌ
        //   IL WEBINAR LO VEDEVA IL SETTER. Il ragionamento reggeva sul
        //   permesso, non sul mestiere: l'agenda ce l'ha anche chi sta al
        //   telefono tutto il giorno, mentre la diretta la fa chi presenta.
        //   Il committente l'ha chiesto tolto dal setter, e `preventivi` è
        //   l'unico permesso che distingue i due lavori.
        permesso: "preventivi",
        alias: "diretta live streaming sala evento presentazione molte persone",
      },
      {
        /*  ── ⚠️ CONTABILITÀ È UNA VOCE SUA, NON UNA SCHEDA DENTRO KPI ──────
            Ci è stata per qualche giorno ed era il posto sbagliato. KPI si
            guarda a finestre mobili — «ultimi trenta giorni» — perché misura
            l'andamento della pubblicità, che col calendario non c'entra. La
            contabilità si guarda per mese, trimestre, anno, perché l'IVA si
            liquida e le imposte si calcolano su periodi con un primo e un
            ultimo giorno stabiliti dalla legge. Due calendari diversi nella
            stessa pagina: il periodo scelto in cima ne accontentava uno solo.
            ⚠️ E STA ACCANTO A «FATTURE», non fra i numeri: chi ci arriva ci
             arriva pensando ai documenti e al commercialista, non ai KPI. */
        titolo: "Contabilità",
        descrizione: "IVA, imposte, costi che si scaricano e quelli che no",
        url: "/CRM/contabilita",
        icon: Calculator,
        scheme: "leads",
        permesso: "preventivi",
        alias: "contabilita iva tasse imposte ires irap commercialista fornitori bilancio utile",
        //  ⚠️ QUESTO BADGE CONTA GIORNI, NON COSE. Vedi ChiaveConteggioFiscale
        //   in crm/ui: è l'unico della barra che scende da solo.
        badge: "scadenza",
      },
      {
        /*  ── ⚠️ CARICARE UNA LISTA ERA UN PULSANTE CHE NESSUNO TROVAVA ─────
            Richiesta del committente: «aggiungi una scheda per importare lead,
            che poi andranno su lead importati».
            Il pannello c'era già, ma dietro un pulsante da premere nella
            testata della coda di chiamata: una funzione che si scopre solo se
            qualcuno te la mostra. E chiedeva «Creare nuovi lead», permesso che
            il SETTER non aveva — cioè era invisibile proprio a chi di mestiere
            lavora le liste, che ogni mattina chiedeva a un admin di caricarle.
            Adesso ha una riga sua, e il setter ce l'ha (vedi BASE_SETTER in
            crm/permessi.ts).
            ⚠️ STA SUBITO SOPRA «Lead importati» e non altrove: sono lo stesso
             lavoro in due tempi — prima carico, poi chiamo — e due righe
             vicine si leggono come una sequenza invece che come due attrezzi
             scollegati. */
        titolo: "Importa lead",
        descrizione: "Carichi un file di contatti: finiscono in «Lead importati»",
        url: "/CRM/importa-lead",
        icon: Upload,
        scheme: "pipeline",
        permesso: "lead.crea",
        alias: "importa importare carica caricare lista liste csv contatti file excel foglio rubrica lead nuovi",
      },
      {
        //  ── UNA VOCE SOLA, ED È LA POSTAZIONE ──────────────────────────────
        //   QUI CE N'ERANO DUE, quasi omonime: «Lead importati» (l'ELENCO, su
        //   /CRM/avanzamento) e «Lead importati · uno alla volta» (la CODA di
        //   chiamata, su /CRM/importa). Erano nate diverse per un motivo vero —
        //   chi passa la mattina al telefono non vuole una tabella, chi cerca un
        //   nome non vuole una coda — ma nel menu due righe che cominciano con
        //   le stesse due parole si scelgono a caso: si apriva ogni volta quella
        //   sbagliata e si tornava indietro. Il committente ne ha chiesta una, e
        //   quella che resta è la CODA: è il gesto che si ripete duecento volte
        //   al giorno, mentre l'elenco si guarda una volta ogni tanto.
        //
        //   ⚠️ LA CODA HA DOVUTO PRENDERSI CIÒ CHE SOLO L'ELENCO SAPEVA FARE,
        //    prima che l'elenco uscisse dal menu: caricare un CSV con
        //    l'anteprima e dividere le schede fra i consulenti sono due pannelli
        //    di /CRM/importa (i pulsanti «Carica una lista» e «Assegna» nella
        //    sua testata), e la ricerca su TUTTO l'archivio è il campo in cima.
        //    Restano solo dell'elenco i filtri, le azioni di gruppo su venti
        //    righe insieme e l'esportazione in CSV: per quelli l'indirizzo esiste
        //    ancora ed è a un clic dalla coda (vedi la voce nascosta qui sotto e
        //    il pulsante «Elenco completo» in routes/CRM.importa.tsx).
        //
        //   Il permesso è quello del lavoro di consulenza e non dell'archivio:
        //   chi non può caricare né assegnare deve comunque poter chiamare i
        //   propri, e i due comandi si spengono da soli dentro la pagina.
        titolo: "Lead importati",
        descrizione: "Carichi la lista, chiami, segni l'esito, passi al prossimo",
        url: "/CRM/importa",
        icon: PhoneCall,
        scheme: "pipeline",
        permesso: "lead.propri",
        //  Gli alias delle DUE voci di prima, uniti: chi chiama la schermata
        //  "pipeline" da anni, chi ha imparato "da fare" il mese scorso e chi
        //  cerca "importa csv" devono arrivare tutti qui scrivendolo in ⌘K —
        //  altrimenti la fusione delle due voci si legge come una pagina sparita.
        alias:
          "pipeline avanzamento da fare coda scadenze stati fasi kanban imbuto importa importare csv lista liste contatti chiamate setter chiamare telefonate uno alla volta postazione dialer richiami saltati",
      },
      {
        //  ── L'ELENCO: FUORI DAL MENU, NON DAL CRM ──────────────────────────
        //   `nascosta: true` è lo stesso trattamento di "Agenda" e "Installazioni
        //   oggi" qui sopra, e per lo stesso motivo: la pagina esiste, i link
        //   salvati funzionano, ⌘K continua a portarci (routes/CRM.tsx pesca da
        //   GRUPPI_MENU, che le voci nascoste le contiene), semplicemente non
        //   occupa più una riga di menu accanto a una che si chiama quasi uguale.
        //   ⚠️ NON CANCELLARE LA ROTTA pensando di finire il lavoro: qui vivono
        //    ancora tre cose che la coda NON sa fare — i filtri (stato,
        //    consulente, periodo), le azioni di gruppo su una selezione di righe
        //    e l'esportazione in CSV — e la lente «Tutta la coda», che è l'unico
        //    posto del CRM in cui si vede cosa è in ritardo su TUTTO l'archivio e
        //    non solo sulle liste importate. Toglierla significa perdere quelle,
        //    non spostarle.
        //   IL TITOLO NON PUÒ RICOMINCIARE CON «Lead importati» E BASTA: in ⌘K
        //   tornerebbe il doppione che questa modifica è servita a togliere.
        titolo: "Elenco completo dei lead importati",
        descrizione: "La tabella: filtri, azioni di gruppo, esportazione, tutta la coda",
        url: "/CRM/avanzamento",
        icon: Upload,
        scheme: "pipeline",
        nascosta: true,
        alias:
          "elenco tabella filtri azioni di gruppo esporta csv massive selezione tutta la coda avanzamento pipeline",
      },
      {
        titolo: "WhatsApp",
        descrizione: "Messaggi e template WhatsApp",
        url: "/CRM/whatsapp",
        icon: MessageCircle,
        scheme: "leads",
        //  Scrivere al proprio cliente è lavoro di consulenza, non lettura
        //  dell'archivio altrui: basta essere entrati.
        permesso: "lead.propri",
        alias: "chat messaggi template",
      },
      /*  ── ⚠️ «NOTIFICHE» NON STA PIÙ QUI ─────────────────────────────────
          Tolta su richiesta del committente, e la ragione regge: la campanella
          in cima allo schermo è già la porta delle notifiche, si vede da ogni
          pagina e porta il numero di quelle da leggere. Una seconda voce nel
          menu portava allo stesso posto senza dire niente in più, e occupava
          una riga fra gli strumenti che si usano tutti i giorni.
          ⚠️ LA PAGINA C'È ANCORA — /CRM/notifiche risponde, e la campanella ci
           manda: togliere la voce non è togliere la schermata, e gli indirizzi
           salvati continuano a funzionare. */
    ],
  },
  {
    titolo: "Numeri",
    voci: [
      {
        titolo: "KPI",
        descrizione: "KPI e andamento",
        url: "/CRM/kpi",
        icon: BarChart3,
        //  Come per Installazioni: l'inserimento a mano vive sotto /CRM/kpi,
        //  e senza confronto esatto si accenderebbe anche questa voce.
        exact: true,
        scheme: "kpi",
        alias: "fatturato incassi conversione risultati statistiche",
      },
      {
        //  ── SI DICE COLLABORATORI ──────────────────────────────────────────
        //   Era "Consulenti", ma là dentro ci sono consulenti, setter, driver,
        //   installatori e accompagnatori — i cinque mestieri di
        //   crm/kpi-setter.ts, che convivono nella stessa scheda. La parola
        //   vecchia nominava UNO dei cinque e faceva sembrare gli altri quattro
        //   degli ospiti in casa d'altri: chi cercava l'elenco degli
        //   installatori non pensava di aprire "Consulenti".
        //   ⚠️ L'INDIRIZZO RESTA /CRM/consulenti, ed è voluto: cambiarlo
        //    romperebbe i preferiti e i link già mandati in chat ai colleghi in
        //    cambio di niente — la barra degli indirizzi di un CRM non la legge
        //    nessuno. Se fra sei mesi qualcuno nota la differenza e la
        //    "sistema", rompe quei link per allineare una stringa che non si
        //    vede. Stessa scelta già fatta per "Lead" su /CRM/trattative, qui
        //    sopra.
        //   "consulenti" resta fra le parole cercabili: chi la chiama ancora
        //   così la trova lo stesso scrivendolo in ⌘K.
        titolo: "Collaboratori",
        descrizione: "Chi lavora con noi e i suoi risultati",
        url: "/CRM/consulenti",
        icon: UserCheck,
        scheme: "consulenti",
        alias:
          "consulenti collaboratori persone squadra team setter driver installatori accompagnatori venditori mestieri commissioni pin",
      },
      {
        titolo: "Landing page",
        descrizione: "Rendimento delle landing page",
        url: "/CRM/landing-page",
        icon: Activity,
        scheme: "performance",
        alias: "lp performance pagine funnel",
      },
      {
        titolo: "Campagne Meta",
        descrizione: "Campagne Facebook e Instagram",
        url: "/CRM/campagne-meta",
        icon: Megaphone,
        scheme: "ads",
        alias: "meta ads manager facebook instagram adv campagne spesa creative",
      },
      {
        titolo: "Campagne TikTok",
        descrizione: "Campagne TikTok",
        url: "/CRM/campagne-tiktok",
        icon: Music2,
        scheme: "ads",
        alias: "tiktok ads manager adv campagne spesa creative",
      },
      {
        titolo: "Attribuzione",
        descrizione: "Da quale annuncio arriva il fatturato",
        url: "/CRM/attribuzione",
        icon: GitMerge,
        scheme: "ads",
        alias: "attribution sorgenti utm origine",
      },
    ],
  },
  {
    titolo: "Impostazioni",
    voci: [
      {
        titolo: "Disponibilità",
        descrizione: "Orari che il cliente può prenotare dal funnel",
        url: "/CRM/orari-disponibili",
        icon: CalendarClock,
        scheme: "agenda",
        //  Qui si decidono gli orari prenotabili di TUTTI, non i propri
        //  appuntamenti: è una configurazione. Dichiararlo tiene la voce
        //  d'accordo con la regola di pagina in permessi.ts — altrimenti la
        //  voce compare e poi la pagina rifiuta, che è il peggiore dei due modi.
        permesso: "impostazioni",
        alias: "disponibilita slot orari booking prenotazioni",
      },
      {
        titolo: "Impostazioni",
        descrizione: "Impostazioni del CRM",
        url: "/CRM/impostazioni",
        icon: Settings,
        scheme: "impostazioni",
        alias: "configurazione utenti permessi integrazioni",
      },
    ],
  },
];

/** ── I NUMERI DEL GRUPPO DELLE POSE ────────────────────────────────────────
 *  Gli altri badge nascono in `conteggiMenu` (ui.tsx); questi quattro no, e non
 *  è una svista: le lenti si decidono con `inNostroCentro`/`aDomicilio`/
 *  `daSpedire` (crm/spedizione.ts) e con `conDriver`
 *  (crm/InstallationScheduleDialog), due file che importano già da ui.tsx — di
 *  là il cerchio si chiuderebbe. Riscrivere il criterio qui sarebbe stato il
 *  rimedio ovvio ed è esattamente il guasto da evitare: un badge che dice 3 e
 *  una pagina che ne mostra 5 non toglie fiducia solo a sé stesso, la toglie a
 *  tutti gli altri numeri del menu. Quindi si importano le regole vere.
 *
 *  ── IL NUMERO È LA GIORNATA, LA PAGINA MOSTRA DI PIÙ, E VA DETTO ──────────
 *  Come tutti i badge di questa barra, il numero è OGGI (vedi la nota in testa
 *  al file): il gruppo racconta la giornata delle pose — «Installazioni» quante
 *  sono in tutto, e le tre voci sotto come si dividono. Le lenti della pagina
 *  invece tengono tutta la coda aperta, prossimi giorni compresi: aprendo la
 *  voce si vedono più righe del numero che si è premuto, e questo lo dice la
 *  frase al passaggio del mouse. Si dice a parole e non con un secondo numero
 *  di proposito: un totale ricalcolato qui sarebbe una seconda copia
 *  dell'insieme della pagina (`pratiche`, filtrato per tecnico) e prima o poi
 *  direbbe una cifra diversa dalla sua — cioè il difetto che si sta evitando.
 *
 *  LE TRE POSE DEL GIORNO PARTONO DALLO STESSO INSIEME di «Installazioni»
 *  (`leadInstallazioniOggi`, meno i pacchi): sono per costruzione dei pezzi di
 *  quel numero, e nessuno dei tre può dire più del totale che ha sopra. */
function conteggiPose(leads: Lead[]): Record<ChiaveConteggioPosa, ContoBadge> {
  //  Le pose di oggi ancora da fare: la stessa selezione del badge
  //  «Installazioni», già ripulita dalle pose chiuse e dalle pratiche
  //  archiviate. Si attraversa una volta sola per tutte e tre le lenti — la
  //  barra si ridisegna a ogni cambio pagina.
  //  ── I PACCHI VANNO TOLTI PRIMA DI FILTRARE, NON DOPO ─────────────────────
  //   La pagina non conta le lenti su tutti i lead del giorno: le conta su
  //   `pratiche`, cioè `soloPose(...)` — i pacchi hanno una scheda loro. Per
  //   «Nel nostro centro» e «A domicilio» la cosa si aggiustava da sola (i tre
  //   modi di consegna si escludono a vicenda, quindi uno spedito non è né
  //   l'uno né l'altro), ma `conDriver` guarda SOLO se c'è un driverId: una
  //   pratica segnata da spedire, con una data di oggi e un driver scritto
  //   sopra, sarebbe finita nel badge e non nella pagina. Un caso raro, che è
  //   esattamente il modo in cui un badge perde credibilità — capita una volta,
  //   e da lì in poi non si guarda più nessuno degli altri.
  //   Il taglio si fa QUI, una volta, sull'insieme: così le tre lenti partono
  //   per costruzione dallo stesso perimetro della pagina invece di ricordarsi
  //   ognuna di escludere i pacchi.
  const oggi = soloPose(leadInstallazioniOggi(leads));
  const inSede = oggi.filter(inNostroCentro).length;
  const domicilio = oggi.filter(aDomicilio).length;
  const driver = oggi.filter(conDriver).length;
  //  ── I PACCHI NON HANNO UNA GIORNATA ──────────────────────────────────────
  //   Una spedizione non occupa un tecnico e non ha un'ora: chiedersi «quanti
  //   ne partono oggi» non ha risposta, e un badge costruito su una data che
  //   nessuno scrive sarebbe rimasto spento per sempre. La sua coda è «non è
  //   ancora partito», che è anche l'unico numero che cala lavorando — ed è la
  //   STESSA cifra della pastiglia «Da spedire» nella pagina, riga per riga.
  const daSpedireAperti = (Array.isArray(leads) ? leads : []).filter(
    (l) => daSpedire(l) && !spedita(l),
  ).length;

  //  ── QUELLE CHE NESSUNO HA ANCORA MESSO IN CALENDARIO ─────────────────────
  //   Impianti pagati e senza una data: è la lente «Senza data» della pagina,
  //   con la stessa regola (nessun giorno e posa non ancora fatta). Non sono in
  //   ritardo — nessuno ha promesso niente a nessuno — ma sono l'unica cosa di
  //   questa famiglia che chiede una DECISIONE invece di un'esecuzione, e
  //   finché stavano dentro il numero delle pose una giornata vuota e cinque
  //   impianti fermi davano lo stesso menu spento.
  //   ⚠️ I pacchi restano fuori: una spedizione non si «programma» in
  //    calendario, ha la sua coda e il suo badge.
  //  ⚠️ LA REGOLA NON SI RISCRIVE QUI. `aspettaUnaData` è la stessa che filtra
  //   la lente «Senza data» della pagina: scritta a mano in questo file dava 10
  //   dove la pagina ne mostrava 11 — mancava chi ha VERSATO un acconto senza
  //   che lo stato sia ancora una delle tre pose. Un badge che dice una cifra e
  //   la pagina che ne dice un'altra fa smettere di credere a tutti e due.
  const daProgrammare = soloPose(Array.isArray(leads) ? leads : []).filter(aspettaUnaData).length;

  //  I ritorni si contano su TUTTI i lead e con la funzione della pagina: il
  //  perché di entrambe le cose è sulla voce `manutenzioni` qui sotto.
  const ritorni = quanteDaSeguire(Array.isArray(leads) ? leads : []);

  //  La frase dice sempre due cose: cosa sono quei numeri, e perché la pagina
  //  ne mostra di più. Si legge anche a badge spento (il tooltip compare
  //  comunque), quindi lo zero va detto a parole: «0 pose oggi» si legge
  //  peggio di «Nessuna».
  const tuttaLaCoda = "la scheda tiene tutta la coda aperta, anche degli altri giorni";
  return {
    //  ── VERDE: SONO GIÀ PROGRAMMATE ──────────────────────────────────────
    //   Queste tre righe (in centro, a domicilio, con driver) sono le pose di
    //   OGGI che hanno già un giorno e quasi sempre un'ora: non c'è niente da
    //   decidere, c'è da farle. L'ambra resta a «Da programmare», che è l'unica
    //   voce di questa famiglia che chiede una decisione — ed è la differenza
    //   che si deve leggere col colore, senza fermarsi sulle parole.
    in_sede: {
      n: inSede,
      urgenza: "pronto",
      titolo: inSede
        ? `${plurale(inSede, "posa", "pose")} oggi nel nostro centro · ${tuttaLaCoda}`
        : "Nessuna posa in centro oggi",
    },
    a_domicilio: {
      n: domicilio,
      urgenza: "pronto",
      titolo: domicilio
        ? `${plurale(domicilio, "posa", "pose")} oggi a casa del cliente · ${tuttaLaCoda}`
        : "Nessuna posa a domicilio oggi",
    },
    //  Grigio, non ambra: non è la giornata di nessuno — è la coda dei pacchi
    //  fermi, e il colore in questa barra dice l'urgenza, non la categoria.
    da_spedire: {
      n: daSpedireAperti,
      urgenza: "info",
      titolo: daSpedireAperti
        ? `${plurale(daSpedireAperti, "impianto ancora da spedire", "impianti ancora da spedire")} · quelli già partiti restano nella scheda`
        : "Nessun impianto da spedire",
    },
    //  Ambra: è una decisione da prendere, non un lavoro da eseguire.
    da_programmare: {
      n: daProgrammare,
      urgenza: "oggi",
      titolo: daProgrammare
        ? `${plurale(daProgrammare, "impianto pagato senza una data", "impianti pagati senza una data")} · vanno messi in calendario`
        : "Nessun impianto da programmare",
    },
    con_driver: {
      n: driver,
      urgenza: "pronto",
      titolo: driver
        ? `${plurale(driver, "posa esce in due", "pose escono in due")} oggi · ${tuttaLaCoda}`
        : "Nessuna posa con driver oggi",
    },
    //  ── I RITORNI, CONTATI COME LI CONTA LA PAGINA ──────────────────────────
    //   `quanteDaSeguire` è la stessa funzione che accende la pastiglia della
    //   lente «Manutenzioni» (crm/manutenzione/PannelloManutenzioni): il badge
    //   del menu e il numero della pagina devono dire lo stesso, e due conti
    //   scritti in due posti si separano al primo archivio storto.
    //   ⚠️ Si contano su TUTTI i lead e non sulle pose in lavorazione, che è
    //    l'insieme delle altre quattro voci: un cliente che deve tornare fra
    //    tre settimane ha la posa chiusa da un pezzo, e contarlo di lì lo
    //    farebbe sparire dal numero il giorno stesso in cui la posa si chiude.
    //   Ambra come le giornate: un ritorno scaduto è lavoro fermo, non una
    //   categoria da guardare con calma.
    manutenzioni: {
      n: ritorni,
      urgenza: "oggi",
      titolo: ritorni
        ? `${plurale(ritorni, "ritorno da seguire", "ritorni da seguire")}: in ritardo, oggi o entro sette giorni`
        : "Nessun ritorno da seguire",
    },
  };
}

export function CRMSidebar() {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { signOut, user } = useAuth();
  const { canAccess, isAdmin } = useUserSettings();
  const puo = usePuo();
  const { leads } = useCRM();
  const ricerca = useRicerca();
  const cmd = useTastoComando();

  //  I numeri seguono i dati: appena un lead cambia stato o viene
  //  programmata una posa, il badge si aggiorna senza ricaricare la pagina.
  //  Il conto è memorizzato perché la barra si ridisegna a ogni cambio pagina.
  //  Due funzioni e un oggetto solo: le voci del menu chiedono il badge per
  //  nome e non devono sapere da quale delle due arriva il loro numero (il
  //  perché della divisione sta su `conteggiPose`, qui sopra).
  /** ── LE COSE SCRITTE A MANO, PER IL BADGE DI «DA FARE OGGI» ─────────────
   *  Vivono in `app_config` e non nei lead, quindi vanno lette a parte. Si
   *  leggono UNA VOLTA all'apertura del CRM: la barra si ridisegna a ogni
   *  cambio pagina, e una query per ogni ridisegno sarebbe un costo pagato
   *  tutto il giorno per un numero che cambia tre volte.
   *  ⚠️ Se la lettura non riesce non si spegne il badge: si conta quello che si
   *   sa (le righe che nascono dai lead). Un numero un po' più basso è meno
   *   peggio di nessun numero — e la pagina, aperta, dice comunque il vero. */
  const [taskManuali, setTaskManuali] = useState<TaskManuale[]>([]);
  useEffect(() => {
    let vivo = true;
    void caricaTask().then((e) => {
      if (vivo && e.ok) setTaskManuali(e.lista);
    });
    return () => {
      vivo = false;
    };
  }, []);

  /** ── IL CONTO ALLA ROVESCIA DELLA PROSSIMA LIQUIDAZIONE ────────────────
   *  Mensile o trimestrale cambia tutte le date, e non si puo' indovinare: è
   *  un'opzione che si esercita in dichiarazione. La risposta sta in un posto
   *  solo (`crm/contabilita-liquidazione`), così cambiandola dalla pagina
   *  della contabilità questo badge si aggiorna nello stesso istante — prima
   *  restava indietro fino al ricaricamento, e menu e pagina dicevano due date
   *  diverse per la stessa scadenza. */
  const { regime: liquidazione } = useLiquidazione();
  //  Le scadenze gia' segnate come fatte non contano alla rovescia.
  const { chiuse } = useChiusure();

  const scadenza = useMemo(
    () => badgeScadenza(new Date().toISOString().slice(0, 10), liquidazione, chiuse),
    [liquidazione, chiuse],
  );

  /** ── ⚠️ IL PROMEMORIA, UNA VOLTA AL GIORNO E NON A OGNI PAGINA ─────────
   *  La barra si rimonta a ogni cambio pagina: un avviso legato al montaggio
   *  comparirebbe venti volte in una mattina, e alla terza si smetterebbe di
   *  leggerlo — che è il modo in cui un promemoria diventa dannoso invece che
   *  inutile. Si segna il giorno in cui è già stato mostrato, nel browser:
   *  è l'unico posto giusto, perché la domanda è «l'ho già visto IO oggi» e
   *  non «qualcuno l'ha visto». */
  useEffect(() => {
    if (!scadenza || !toccaAvvisare(scadenza.giorni)) return;
    const oggi = new Date().toISOString().slice(0, 10);
    const chiave = "crm_avviso_fiscale";
    try {
      if (localStorage.getItem(chiave) === oggi) return;
      localStorage.setItem(chiave, oggi);
    } catch {
      //  Navigazione privata, o memoria piena: si avvisa lo stesso. Un avviso
      //  di troppo è meno grave di una scadenza mancata.
    }
    toast(scadenza.frase, {
      duration: scadenza.giorni <= 7 ? 15000 : 9000,
      description:
        scadenza.giorni <= PREAVVISO_AVVISO
          ? "Apri Contabilità: carica le fatture che mancano e controlla che ogni costo abbia il suo documento."
          : undefined,
    });
  }, [scadenza]);

  /** Quante cose ci sono da fare OGGI: la stessa funzione della pagina, sulla
   *  stessa giornata. Le spuntate non contano — il badge dice quello che resta,
   *  e a giornata finita deve sparire. */
  const daFareOggi = useMemo(() => {
    const righe = costruisciRighe({ leads, task: taskManuali, ora: new Date() });
    const oggi = new Date().toISOString().slice(0, 10);
    return righe.filter((r) => !r.fatta && r.giorno === oggi).length;
  }, [leads, taskManuali]);

  const conteggi: Record<ChiaveConteggio, ContoBadge> = useMemo(
    () => ({
      ...conteggiMenu(leads),
      ...conteggiPose(leads),
      //  Verde: quello che c'è da fare oggi è già deciso, va solo fatto.
      //  ⚠️ Giorni, non cose: `n` qui è il conto alla rovescia. Il tooltip lo
      //   dice, perché «Contabilità 29» da solo si legge come 29 documenti.
      scadenza: {
        n: scadenza?.giorni ?? 0,
        //  Il giorno stesso non si scrive «0»: si scrive «oggi». Un badge con
        //  dentro uno zero si legge come «niente da fare», che è l'opposto.
        ...(scadenza && scadenza.giorni === 0 ? { testo: "oggi" } : {}),
        urgenza: scadenza?.urgenza ?? "info",
        titolo: scadenza?.frase ?? "Nessuna scadenza IVA nei prossimi tre mesi",
      },
      dafare: {
        n: daFareOggi,
        urgenza: "pronto",
        titolo: daFareOggi
          ? `${plurale(daFareOggi, "cosa da fare", "cose da fare")} oggi · l'arretrato dei giorni scorsi si vede aprendo la pagina`
          : "Niente da fare oggi",
      },
    }),
    [leads, daFareOggi, scadenza],
  );

  //  Il confronto è sul segmento di percorso, non sul prefisso di stringa:
  //  "/CRM/trattative" è prefisso anche di "/CRM/trattative-perse", e con lo
  //  startsWith secco si accendevano due voci insieme. Dove invece il ramo ha
  //  davvero dei figli (installazioni, kpi) la voce padre chiede `exact`,
  //  altrimenti resterebbe accesa mentre si sta su una delle sue pagine.
  //  ── LE VOCI CHE PORTANO UNA LENTE (?lente=…) ────────────────────────────
  //   «Nel nostro centro», «A domicilio», «Da spedire» e «Con driver» sono la
  //   STESSA pagina delle installazioni con una lente diversa: il percorso non
  //   basta a distinguerle. Senza questo, premendone una si accendeva
  //   «Installazioni» — cioè il menu indicava un posto diverso da quello che si
  //   stava guardando, ed erano proprio le voci con la lente a non accendersi
  //   mai.
  const lenteAttiva = new URLSearchParams(location.searchStr || "").get("lente") || "";

  const isActive = (url: string, exact?: boolean) => {
    const [percorso, query] = url.split("?");
    const lenteVoce = query ? new URLSearchParams(query).get("lente") || "" : "";
    //  Voce con la lente: accesa solo se è ESATTAMENTE quella che si sta
    //  guardando, altrimenti si accenderebbero tutte e tre insieme.
    if (lenteVoce) return location.pathname === percorso && lenteAttiva === lenteVoce;
    //  Voce senza lente sullo stesso percorso: si spegne mentre una lente è
    //  accesa, per lo stesso motivo — una sola voce alla volta.
    if (lenteAttiva && location.pathname === percorso) return false;
    return exact
      ? location.pathname === percorso
      : location.pathname === percorso || location.pathname.startsWith(`${percorso}/`);
  };

  const puoVedere = (v: VoceMenu) => {
    const p = permessoDiVoce(v);
    return !p || puo(p);
  };

  //  ── CHI VEDE CHE COSA ────────────────────────────────────────────────────
  //  Due domande diverse, e servono tutte e due:
  //   · `canAccess` guarda l'ACCOUNT (user_settings.scheme_access): quali schede
  //     sono state acquistate/abilitate per questa installazione;
  //   · `puo` guarda la PERSONA che ha digitato il PIN: che cosa le è concesso.
  //  Una voce compare solo col sì di entrambe. Nascondere NON è difendere — chi
  //  conosce l'indirizzo apre la pagina lo stesso: il rifiuto vero lo dà
  //  `guardiaCRM` sulle rotte /api, e `GuardiaPagina` qui sotto spiega il perché
  //  a chi ci arriva col link. Un gruppo rimasto senza voci sparisce, invece di
  //  lasciare un'intestazione sopra il vuoto.
  const gruppi = GRUPPI_MENU.map((g) => ({
    ...g,
    voci: g.voci.filter((v) => !v.nascosta && (!v.scheme || canAccess(v.scheme)) && puoVedere(v)),
  })).filter((g) => g.voci.length > 0);

  // Su mobile la barra è un pannello sovrapposto: dopo aver scelto va chiusa,
  // altrimenti copre la pagina appena aperta.
  const chiudiSuMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        {/*  ── IL MARCHIO SI GUARDA, NON SI LEGGE ────────────────────────────
            C'era il quadratino del logo con accanto «CRM / Hair Genius Labs»
            scritto: due volte la stessa informazione, e quella scritta la
            leggeva chi lavora qui dentro tutto il giorno — cioè nessuno, dopo
            il primo minuto. Adesso c'è il marchio per esteso, che è la forma in
            cui l'azienda si riconosce, e lo spazio guadagnato va alle voci.
            ⚠️ A barra stretta resta il quadratino: il marchio per esteso a
            32 px di larghezza diventa una macchia illeggibile.

            ── QUANTO DEV'ESSERE ALTO ────────────────────────────────────────
            Stava a 36 px dentro un blocco da 56: due righe di menu piene, in
            una colonna di voci da 14 px con l'icona da 16. Un marchio in un CRM
            dice «sei nel posto giusto» e poi deve togliersi di mezzo — si guarda
            una volta la mattina, mentre le voci si guardano tutto il giorno.
            Adesso è 24 px: una volta e mezza l'icona di una voce (16 px) — resta
            un marchio, non un'icona — e sotto i 32 px della riga di menu, così
            l'intestazione non arriva mai a valere due voci.
            A barra chiusa resta 32×32: là non c'è nessuna scritta con cui stare
            in rapporto, e 32 px è esattamente l'ingombro dei pulsanti-icona
            sotto (`!size-8`), quindi il marchio ci sta incolonnato invece di
            galleggiare mezzo passo a sinistra. */}
        <div className="flex items-center gap-2 px-2 py-2">
          <img
            src={logoBrand}
            alt="Hair Genius Labs"
            className={
              collapsed
                ? "h-8 w-8 shrink-0 rounded-md object-contain"
                : "h-6 w-auto max-w-[168px] shrink-0 object-contain object-left"
            }
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* La ricerca sta in cima e fuori dai gruppi: è l'unica voce che serve
            in qualunque momento, indipendentemente da cosa si sta facendo. */}
        <SidebarGroup className="pb-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {/* Sembra un campo, non una voce di menu: chi arriva qui col
                    mouse sta cercando dove si scrive, e un pulsante travestito
                    da riga di elenco lo fa passare oltre. */}
                <SidebarMenuButton
                  tooltip={`Cerca un lead (${cmd}K)`}
                  onClick={() => {
                    chiudiSuMobile();
                    ricerca.apri();
                  }}
                  className="h-9 rounded-lg border border-sidebar-border bg-background/70 text-muted-foreground hover:bg-background"
                >
                  <Search className="h-4 w-4" />
                  {!collapsed && (
                    <>
                      <span>Cerca nome o telefono…</span>
                      <Tasto className="ml-auto">{cmd}K</Tasto>
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {gruppi.map((gruppo, i) => (
          <SidebarGroup key={gruppo.titolo} className="py-1">
            {/* A barra chiusa l'etichetta sparisce da sola (classe della UI):
                al suo posto la riga di separazione tiene i gruppi distinti. */}
            {collapsed && i > 0 ? <SidebarSeparator className="my-1" /> : null}
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
              {gruppo.titolo}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {gruppo.voci.map((voce) => {
                  const attiva = isActive(voce.url, voce.exact);
                  const conto = voce.badge ? conteggi[voce.badge] : undefined;
                  //  ⚠️ Acceso anche a zero quando c'è una parola al posto del
                  //   numero: è il giorno della scadenza, e spegnerlo lì è il
                  //   momento peggiore in cui potesse succedere.
                  const acceso = !!conto && (conto.n > 0 || !!conto.testo);
                  return (
                    <SidebarMenuItem key={voce.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={attiva}
                        //  Il tooltip vale solo a barra chiusa: lì il punto
                        //  colorato dice che c'è del lavoro ma non quanto, e
                        //  senza questa riga bisognerebbe riaprire la barra.
                        //  La frase si mostra anche a badge spento: il numero
                        //  dice solo la giornata, e ciò che resta indietro —
                        //  le visite in sede mai chiuse, le scadenze arretrate
                        //  — vive qui. Senza, con zero appuntamenti oggi non
                        //  ci sarebbe più nessun posto dove leggerlo.
                        tooltip={
                          conto?.titolo ? `${voce.descrizione} — ${conto.titolo}` : voce.descrizione
                        }
                      >
                        <Link
                          to={voce.url}
                          onClick={chiudiSuMobile}
                          aria-current={attiva ? "page" : undefined}
                          //  A barra aperta il tooltip non compare: la stessa
                          //  frase la dà il titolo della riga, così l'arretrato
                          //  resta leggibile anche quando il badge è spento
                          //  (a barra chiusa no, altrimenti si sovrapporrebbe
                          //  al tooltip e si vedrebbero due volte le stesse
                          //  parole).
                          title={!collapsed && conto?.titolo ? conto.titolo : undefined}
                          className="relative"
                        >
                          {/*  Dove sono lo dice un trattino a sinistra, non una
                              campitura: il fondo della voce attiva è già un
                              grigio appena percettibile, e mettergli sopra del
                              colore pieno renderebbe la barra un semaforo.
                              A barra chiusa non serve: lì l'unica icona con lo
                              sfondo acceso è già inequivocabile. */}
                          {attiva && !collapsed && (
                            <span className="pointer-events-none absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-sky-500" />
                          )}
                          <voce.icon className="h-4 w-4" />
                          {collapsed ? (
                            acceso && (
                              <span
                                className={cn(
                                  "absolute right-1 top-1 h-1.5 w-1.5 rounded-full",
                                  PUNTO_BADGE[conto.urgenza],
                                )}
                              />
                            )
                          ) : (
                            <>
                              <span className="truncate">{voce.titolo}</span>
                              {conto && (
                                <Badge
                                  n={conto.n}
                                  testo={conto.testo}
                                  urgenza={conto.urgenza}
                                  titolo={conto.titolo}
                                  className="ml-auto"
                                />
                              )}
                            </>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="flex items-center gap-1.5 px-2 pt-1 text-[11px] text-muted-foreground">
            <span className="truncate">{user.email}</span>
            {isAdmin && (
              <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                ADMIN
              </span>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Esci</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

/** ── LA PAGINA APERTA PER INDIRIZZO ────────────────────────────────────────
 *  Togliere la voce dal menu non impedisce niente: l'indirizzo si conosce, si
 *  ricorda, sta nei preferiti di chi ieri aveva più permessi. Chi ci arriva
 *  senza diritto oggi vedrebbe la struttura della pagina con dentro il vuoto —
 *  e chiamerebbe per dire che «il CRM è rotto». Qui vede scritto che cosa
 *  manca e a chi chiederlo.
 *
 *  ⚠️ QUESTA È CORTESIA, NON DIFESA. I dati non arrivano perché le rotte /api
 *  rispondono 403 (guardiaCRM): se questo componente sparisse, la pagina
 *  resterebbe vuota, non piena.
 *
 *  Si usa avvolgendo il contenuto di una pagina, oppure l'<Outlet /> del
 *  contenitore per coprirle tutte in un colpo solo:
 *
 *      <GuardiaPagina><Outlet /></GuardiaPagina>
 */
export function GuardiaPagina({
  children,
  permesso,
}: {
  children: ReactNode;
  /** Di norma si ricava dall'indirizzo (permessi.ts). Si dichiara solo per una
   *  pagina che chiede qualcosa di diverso da ciò che dice il suo percorso. */
  permesso?: Permesso;
}) {
  const location = useLocation();
  const puo = usePuo();
  //  L'indirizzo cambia a ogni navigazione: il permesso si ricalcola con lui,
  //  altrimenti la prima pagina aperta deciderebbe per tutte le successive.
  const richiesto = permesso ?? permessoDiPagina(location.pathname);
  //  Dove mandare chi è capitato qui: la sua postazione, non una home uguale
  //  per tutti. Si calcola comunque — è una riga — così la si ha pronta senza
  //  un secondo ramo dentro il disegno.
  const casa = paginaIniziale(puo);

  if (!richiesto || puo(richiesto)) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-[15px] font-semibold">Questa parte non è per te</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{MOTIVO_PERMESSO[richiesto]}</p>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Se ti serve per lavorare, chiedi a un admin di aggiungerti il permesso «
          {ETICHETTA_PERMESSO[richiesto]}».
        </p>
        {/*  ── ⚠️ UNA PORTA CHIUSA CON UNA VIA D'USCITA ────────────────────
             Segnalazione del committente: chi finiva qui restava qui. La
             schermata spiegava benissimo che cosa mancava e non diceva DOVE
             andare: l'unica uscita era il menu — che su un telefono è chiuso —
             oppure l'indirizzo battuto a mano. Un vicolo cieco cortese resta
             un vicolo cieco.
             Il tasto porta alla propria postazione, che per chi sta al
             telefono è la coda di chiamata (vedi `paginaIniziale`). */}
        {casa !== location.pathname && (
          <Button asChild size="sm" variant="outline" className="mt-4 h-8 text-[12px]">
            <Link to={casa}>Torna al tuo lavoro</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
