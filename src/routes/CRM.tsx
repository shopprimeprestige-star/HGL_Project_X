/** ─────────────────────────────────────────────────────────────────────────
 *  Guscio del CRM: barra laterale, testata, e la RICERCA GLOBALE (⌘K).
 *
 *  PERCHÉ LA RICERCA STA QUI
 *  Il gesto più frequente della giornata è "il cliente è al telefono, trovami
 *  la sua scheda". Prima significava: scegliere la pagina giusta, aspettare il
 *  caricamento, trovare il campo filtro, scrivere, cercare la riga, aprirla.
 *  Adesso è: ⌘K, tre lettere o le ultime cifre del numero, Invio.
 *  La finestra vive nel guscio e non nelle pagine per due motivi:
 *   1. resta disponibile ovunque, anche dentro Ads Manager o le Impostazioni;
 *   2. apre la scheda della trattativa SENZA cambiare pagina — chi stava
 *      guardando l'agenda ci ritorna chiudendo la scheda, senza perdere il
 *      punto in cui era.
 *  ───────────────────────────────────────────────────────────────────────── */

import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  //  Rinominato apposta: importare `KeyboardEvent` con il suo nome coprirebbe
  //  quello del browser, e la scorciatoia ⌘K qui sopra — che ascolta la
  //  finestra, non un componente React — smetterebbe di compilare.
  type KeyboardEvent as EventoTastiera,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { AuthProvider, useAuth, usePuo } from "@/crm/AuthContext";
import { paginaIniziale } from "@/crm/permessi";
import { CRMProvider, useCRM } from "@/crm/CRMContext";
import { reteDeiClic } from "@/crm/clic-liberi";
import { UserSettingsProvider, useUserSettings } from "@/crm/UserSettingsContext";
import { AdminLogin } from "@/crm/AdminLogin";
import {
  CRMSidebar,
  GRUPPI_MENU,
  GuardiaPagina,
  permessoDiVoce,
  type VoceMenu,
} from "@/crm/CRMSidebar";
import { NewLeadAlert } from "@/crm/NewLeadAlert";
import { LeadAcceptanceAlert } from "@/crm/LeadAcceptanceAlert";
import { MeetReminderListener } from "@/crm/MeetReminderListener";
import { NotificationsBell } from "@/crm/notifications/NotificationsBell";
import { NotificationsRunner } from "@/crm/notifications/NotificationsRunner";
import { usaPassataAnteprime } from "@/crm/anteprime-passata";
import { HelpButton } from "@/crm/HelpButton";
import { LeadDialog } from "@/crm/LeadDialog";
import { QuickStatusDialog } from "@/crm/QuickStatusDialog";
import { useChiusura } from "@/crm/ChiusuraDialog";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  CLASSE_BADGE_STATO,
  ProviderRicerca,
  Tasto,
  classiStato,
  etichettaQuando,
  etichettaStato,
  eur,
  normalizza,
  oggiIso,
  soloCifre,
  soloData,
  useTastoComando,
  type ApiRicerca,
} from "@/crm/ui";
import {
  BORDO_FINESTRA,
  CLASSE_CAMPO,
  FONDO_FINESTRA,
  NotaFinestra,
  Pillola,
} from "@/crm/ui/Finestra";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { LEAD_STATUS_LABEL, type Lead, type LeadData, type LeadStatus } from "@/crm/types";
//  La tabella del «quando» e il selettore di stato sono UNA COSA SOLA in tutto
//  il CRM: qui c'era una copia della prima e una seconda versione del secondo.
import { QUANDO_PER_STATO, type RichiestaQuando } from "@/crm/quando-per-stato";
import { GrigliaStati, statiSelezionabili } from "@/crm/SelettoreStatoDialog";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  CornerDownLeft,
  FileText,
  Phone,
  Presentation,
  RefreshCw,
  Search,
  SearchX,
  Tags,
  UserPlus,
  X,
} from "lucide-react";
//  ⚠️ La versione SCURA, non quella chiara: il CRM ha il fondo bianco, e il
//  marchio chiaro lì sopra si vedeva solo perché gli era stato messo dietro un
//  rettangolo bianco — cioè un rimedio che nascondeva il problema invece di
//  risolverlo. Il file scuro esisteva già in cartella.
import logoBrand from "@/assets/logo-hair-genius-dark.png";

export const Route = createFileRoute("/CRM")({
  head: () => ({
    meta: [
      { title: "CRM — Hair Genius Labs SRLS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CRMLayout,
});

function CRMLayout() {
  /*  ── ⚠️ I CLIC NON DEVONO POTER MORIRE ────────────────────────────────
      Segnalazione del committente: «su Chrome il CRM va male, si blocca, non
      clicca bene». Il guasto è misurato e riprodotto: chiudendo una finestra
      mentre Chrome non sta dipingendo (scheda in secondo piano, finestra
      coperta o ridotta a icona) l'animazione di uscita non parte, il dialogo
      non si smonta e il <body> resta con `pointer-events: none` — da lì in
      avanti NESSUN clic raggiunge più niente, in tutta la pagina.
      La rete sta nel guscio perché il guasto non appartiene a una pagina: si
      produce ovunque ci sia una finestra, e le finestre sono dappertutto.
      Vedi crm/clic-liberi.ts per il come e il perché. */
  useEffect(() => reteDeiClic(), []);
  return (
    <div className="crm-theme min-h-screen">
      <AuthProvider>
        <CRMGate />
        <Toaster />
      </AuthProvider>
    </div>
  );
}

function CRMGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Caricamento…</div>
      </div>
    );
  }
  if (!user) return <AdminLogin />;
  return (
    <CRMProvider>
      <UserSettingsProvider>
        <SidebarProvider>
          <Guscio />
        </SidebarProvider>
      </UserSettingsProvider>
    </CRMProvider>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Guscio: tiene lo stato della ricerca e della scheda trattativa, e li mette
   a disposizione di tutte le pagine tramite ProviderRicerca.
   ═════════════════════════════════════════════════════════════════════════ */

/** Non disegna niente: esiste solo per far girare la passata dentro l'albero
 *  del CRM, dove i lead e i consulenti ci sono già. Un componente vuoto è il
 *  modo di questo progetto per attaccare un lavoro di sottofondo (vedi
 *  NotificationsRunner). */
function PassataAnteprime() {
  const { leads, consultants } = useCRM();
  //  Il nome del consulente finisce sul biglietto: si risolve qui, dove la
  //  lista c'è già, invece di farla cercare alla passata.
  const nomeConsulente = useCallback(
    (l: Lead) => consultants.find((c) => c.id === l.data.consulenteId)?.data.nome,
    [consultants],
  );
  usaPassataAnteprime(leads, nomeConsulente);
  return null;
}

function Guscio() {
  const { leads } = useCRM();
  const [ricercaAperta, setRicercaAperta] = useState(false);
  const [query, setQuery] = useState("");
  // `scheda` è null quando nessuna trattativa è aperta; { lead: null } significa
  // "scheda nuova". Tenere i due casi in un solo stato evita la combinazione
  // impossibile "aperta ma senza sapere se è nuova o esistente".
  const [scheda, setScheda] = useState<{ lead: Lead | null } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Passare da una finestra all'altra nello stesso istante lascia a volte il
  // fondo pagina non cliccabile (le due finestre si contendono il focus):
  // si chiude la ricerca, e solo dopo si apre la scheda.
  const apriDopoChiusura = useCallback((valore: { lead: Lead | null }) => {
    setRicercaAperta(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setScheda(valore), 120);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Ogni apertura riparte dal campo vuoto: ritrovarsi il testo della ricerca
  // precedente significa cancellarlo prima di poter scrivere.
  const apriRicerca = useCallback((q = "") => {
    setQuery(q);
    setRicercaAperta(true);
  }, []);

  const api = useMemo<ApiRicerca>(
    () => ({
      apri: (q?: string) => apriRicerca(q ?? ""),
      apriLead: (leadId: string) => {
        const trovato = leads.find((l) => l.id === leadId);
        if (trovato) apriDopoChiusura({ lead: trovato });
      },
      nuovaTrattativa: () => apriDopoChiusura({ lead: null }),
    }),
    [leads, apriDopoChiusura, apriRicerca],
  );

  // ⌘K / Ctrl+K da qualunque punto, anche mentre si scrive in un campo:
  // chi cerca un cliente lo fa spesso con la mano già sulla tastiera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (ricercaAperta) setRicercaAperta(false);
        else apriRicerca();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ricercaAperta, apriRicerca]);

  return (
    <ProviderRicerca valore={api}>
      <NewLeadAlert />
      <LeadAcceptanceAlert />
      <MeetReminderListener />
      <NotificationsRunner />
      {/*  ── LE ANTEPRIME SI PREPARANO DA SOLE ────────────────────────────
          Il biglietto che il cliente vede nel riquadro di WhatsApp nasceva
          solo se il consulente premeva il tasto giusto: su tredici stanze
          create, dodici erano senza. Questa passata gira in sottofondo mentre
          il CRM è aperto e prepara quelle che mancano — poche per volta, con
          una pausa fra l'una e l'altra, perché è la stessa schermata che si
          usa mentre si è al telefono con un cliente. */}
      <PassataAnteprime />

      {/*  ── ⚠️ OGNUNO ENTRA DALLA SUA PORTA ──────────────────────────────
           Segnalazione del committente: il setter, appena entrato, finiva su
           una schermata che non gli apparteneva. Vedi `PortaDiCasa`. */}
      <PortaDiCasa />

      <div className="flex min-h-screen w-full bg-background">
        <CRMSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Testata />
          <main className="flex-1 overflow-auto">
            {/*  Una pagina vietata aperta per indirizzo (link salvato, preferito
                di quando si avevano più permessi) deve DIRLO, non mostrare la
                sua struttura con dentro il vuoto: chi ci arriva chiamerebbe per
                segnalare che «il CRM è rotto». Sta qui e non pagina per pagina
                perché il permesso si ricava dal percorso (permessi.ts), e così
                nessuna pagina nuova nasce già scoperta.
                ⚠️ È cortesia, non difesa: i dati non arrivano perché le rotte
                /api rispondono 403. */}
            <GuardiaPagina>
              <Outlet />
            </GuardiaPagina>
          </main>
        </div>
      </div>

      <FinestraRicerca
        aperta={ricercaAperta}
        onApertaChange={setRicercaAperta}
        query={query}
        onQuery={setQuery}
        onApriLead={(l) => apriDopoChiusura({ lead: l })}
        onNuovaTrattativa={() => apriDopoChiusura({ lead: null })}
      />

      {/* La scheda si monta solo quando serve: è la finestra più pesante del
          CRM e tenerla montata a vuoto rallenta ogni cambio pagina. */}
      {scheda && (
        <LeadDialog
          open
          onOpenChange={(v) => {
            if (!v) setScheda(null);
          }}
          lead={scheda.lead}
        />
      )}
    </ProviderRicerca>
  );
}

/** ── LA PORTA DI CASA DI CHI ENTRA ────────────────────────────────────────
 *  Segnalazione del committente: «il setter appena entra non deve portarlo su
 *  una scheda bloccata, ma direttamente su Lead importati».
 *
 *  Il CRM aveva una porta sola per tutti, e dietro quella porta c'è la giornata
 *  di chi fa consulenze. Chi sta al telefono ci entrava e trovava una schermata
 *  che parla di cose che non può aprire: il primo gesto della sua giornata
 *  diventava cercare nel menu la riga giusta, ogni mattina.
 *
 *  ⚠️ SOLO DA «/CRM», E SOLO UNA VOLTA. Qui si corregge l'ingresso, non la
 *   navigazione: chi arriva sulla home generica viene accompagnato alla propria
 *   postazione. Se poi torna sulla home di sua volontà ci resta — un rimando
 *   che scatta ogni volta è una pagina che non si riesce più ad aprire, e il
 *   segno `fatto` esiste per questo.
 *  ⚠️ `replace`: nella cronologia non resta una tappa che rimanda subito
 *   altrove, o il tasto «indietro» del telefono diventa un rimbalzo.
 *  ⚠️ E NON DISEGNA NIENTE. Un rimando fatto dentro il corpo di una pagina la
 *   farebbe lampeggiare prima di cambiare; qui la decisione è presa fuori, a
 *   fianco della struttura, e la pagina giusta è la prima che si vede. */
function PortaDiCasa() {
  const puo = usePuo();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fatto = useRef(false);
  useEffect(() => {
    if (fatto.current) return;
    const casa = paginaIniziale(puo);
    if (pathname !== "/CRM" || casa === "/CRM") {
      //  Si è entrati da un indirizzo preciso (un link, un preferito): quello
      //  comanda. Accompagnare altrove chi ha chiesto una pagina precisa vuol
      //  dire non poterla più aprire.
      fatto.current = true;
      return;
    }
    fatto.current = true;
    void navigate({ to: casa, replace: true });
  }, [puo, pathname, navigate]);
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Testata
   ═════════════════════════════════════════════════════════════════════════ */

/** ⚠️ La testata non riceve più `onCerca`: la ricerca non parte da qui. Il
 *  richiamante non gliela passa più — una prop che nessuno usa è una funzione
 *  che sembra esistere. */
function Testata() {
  //  Serve al solo pulsante di Meetly qui sotto: chi non fa consulenze non
  //  deve trovarsi in barra l'invito a entrare in un altro programma.
  const puo = usePuo();
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-2 backdrop-blur">
      <SidebarTrigger />

      {/*  ── QUI NON C'È PIÙ NÉ IL MARCHIO NÉ LA RICERCA ───────────────────
          Il marchio stava sia qui sia in cima alla barra laterale, a due
          centimetri di distanza: la seconda volta non la legge nessuno, e
          intanto occupava la riga più preziosa dello schermo.
          La ricerca invece è ancora tutta lì — è la stessa finestra di prima,
          e si apre da dove è sempre stata: dalla barra laterale, e con {cmd}K
          da qualunque punto del CRM. Quello che è sparito è il secondo
          bersaglio che apriva la stessa cosa: due campi di ricerca che
          rispondono uguale fanno solo chiedere quale sia quello giusto. */}

      <div className="ml-auto flex items-center gap-1">
        {/*  ── DA QUI SI ENTRA IN MEETLY ──────────────────────────────────────
             Il CRM e Meetly sono due mestieri diversi — qui si lavora l'elenco
             dei clienti, là si fa la consulenza in video — e finora per passare
             dall'uno all'altro bisognava sapere a memoria un indirizzo. Il
             pulsante porta all'accesso presentatore (/presentatore), che è la
             schermata dove si sceglie il proprio nome e si entra col PIN: è il
             punto d'ingresso vero, non una pagina di contenuti.
             ⚠️ Ha l'ETICHETTA accanto all'icona, a differenza degli altri due
              pulsanti di questa barra: quelli aprono qualcosa DENTRO il CRM e
              si riconoscono dal simbolo, questo porta in un altro software.
              Un'icona muta che cambia programma è la cosa che si preme per
              sbaglio. Sul telefono resta la sola icona, dove lo spazio non c'è. */}
        {/*  ── ⚠️ NON A TUTTI: MEETLY È IL MESTIERE DELLA CONSULENZA ───────
             Il committente l'ha chiesto tolto dal setter. Questo pulsante era
             per tutti, e mandava chi sta al telefono in un software che non
             gli serve — con in più la schermata d'accesso col PIN, cioè una
             porta chiusa da provare ad aprire. `preventivi` è il permesso di
             chi fa la consulenza: è l'unico che distingue i due lavori, e lo
             stesso usato per la voce «Webinar» nel menu (crm/CRMSidebar).
             ⚠️ Nascondere non è difendere: /presentatore ha la sua porta col
              PIN e continua ad averla. Qui si toglie solo un invito. */}
        {puo("preventivi") && (
        <Link
          to="/presentatore"
          title="Vai a Meetly: scegli il presentatore ed entra col PIN"
          className="mr-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[12.5px] font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
        >
          <Presentation className="h-4 w-4" />
          <span className="hidden sm:inline">Meetly</span>
        </Link>
        )}
        <HelpButton />
        <NotificationsBell />
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Ricerca globale
   ═════════════════════════════════════════════════════════════════════════ */

/** Riga di quote_requests, letta solo per la ricerca: bastano il numero, il
 *  nominativo e il recapito per riconoscere il preventivo. */
interface RigaPreventivo {
  id: string;
  quote_ref: string | null;
  nome: string | null;
  telefono: string | null;
  total: number | null;
  status: string | null;
  created_at: string;
}

/** La tabella `quote_requests` non c'è nei tipi generati di Supabase (è nata
 *  dopo l'ultima rigenerazione). Invece di lasciare un errore di compilazione
 *  o di spegnere i tipi con `any`, si descrive qui la sola catena di chiamate
 *  che serve: se un domani i tipi verranno rigenerati, basta togliere questo. */
type LetturaPreventivi = PromiseLike<{ data: RigaPreventivo[] | null }>;
const dbPreventivi = supabase as unknown as {
  from(tabella: string): {
    select(colonne: string): {
      order(
        colonna: string,
        opzioni: { ascending: boolean },
      ): { limit(n: number): LetturaPreventivi };
    };
  };
};

const MAX_TRATTATIVE = 7;
const MAX_PREVENTIVI = 4;
const MAX_PAGINE = 5;

/* ── LO STATO CHE PROMETTE UN MOMENTO ──────────────────────────────────────
   Metà delle volte si cerca un lead per cambiargli stato, non per leggerlo:
   prima erano tre passaggi (apri la scheda, cambia, chiudi) per una sola
   informazione. Adesso la pastiglia della riga si preme e lo stato si cambia
   qui dentro.

   MA UNO STATO CHE PROMETTE UN MOMENTO DEVE RICEVERLO. «Ricontatto fissato»
   senza data, «Appuntamento fissato» senza ora: il lead esce dalle code di
   lavoro e non lo richiama più nessuno — è così che nascono gli arretrati.
   Quindi la ricerca chiede la data subito dopo, esattamente come fa la
   finestrella «quando» della scheda.

   LA TABELLA NON È PIÙ RICOPIATA. Stava qui in copia perché viveva dentro
   LeadDialog.tsx e non era esportata; adesso è una sola, in
   crm/quando-per-stato.ts, e la leggono la scheda, questa ricerca e il
   selettore di stato. Due tabelle gemelle divergono sempre, e il giorno in cui
   divergono la ricerca smette di chiedere una data che la scheda chiede.   */

/** Questi non chiedono una data ma degli IMPORTI, e un importo non si
 *  raccoglie di sfuggita in una barra di ricerca: si passa alla finestra che
 *  li chiede da sempre (QuickStatusDialog), la stessa dell'elenco lead.
 *  ⚠️ "venduto" resta nell'insieme pur non essendo più assegnabile: la barra
 *  propone `statiSelezionabili`, che rimette in lista lo stato ATTUALE anche
 *  quando è storico, e una scheda d'archivio già "venduto" non deve poterlo
 *  riapplicare passando dalla porta di servizio.
 *  ⚠️ Le tre chiusure vinte NON stanno qui: chiedono degli importi, ma a una
 *  finestra diversa (ChiusuraDialog) e con una regola in più — lo stato lo
 *  scrive lei, insieme ai soldi. Metterle qui vorrebbe dire mandarle al modulo
 *  dei pagamenti, che di consegne non sa niente. Le intercetta `applicaStato`
 *  una riga prima. */
const CHIEDE_IMPORTI = new Set<LeadStatus>(["venduto", "acconto"]);

/** Gli orari che si scelgono davvero: gli stessi quattro della scheda. */
const ORE_FREQUENTI = ["09:00", "11:00", "15:00", "18:00"];

/** La data di N giorni da `da` (o da oggi), con l'orologio LOCALE: le date del
 *  CRM sono stringhe locali e si confrontano solo se nascono dallo stesso. */
function fraGiorni(n: number, da?: string): string {
  const d = da ? new Date(`${da}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return oggiIso();
  d.setDate(d.getDate() + n);
  return oggiIso(d);
}

/** Il nome per esteso, con la rete di sicurezza: `data` di un lead può
 *  mancare del tutto (archivio importato), e un nome vuoto è meglio di una
 *  scheda che non si apre. */
function nomeLead(l: Lead): string {
  const d = l.data as Partial<LeadData> | undefined;
  return `${d?.nome ?? ""} ${d?.cognome ?? ""}`.trim() || "Senza nome";
}

/* ── PERCHÉ PROPRIO QUESTA RIGA ────────────────────────────────────────────
   Chi scrive "347 88" si vede tornare sei numeri quasi identici e ha una
   domanda muta: perché questo? Le due funzioni qui sotto tagliano il testo in
   tre — prima, corrispondenza, dopo — così la riga risponde da sola invece di
   costringere a confrontare cifra per cifra.                                 */

type Pezzi = [string, string, string];

/** Si lavora per indice e non per sostituzione: `normalizza` toglie gli
 *  accenti senza cambiare la lunghezza (à → a), quindi le posizioni trovate
 *  sulla stringa normalizzata valgono anche su quella vera, con l'accento al
 *  posto suo. Se una stringa fuori dall'ordinario rompesse la corrispondenza
 *  si rinuncia all'evidenza: meglio nessuna che una spostata di due lettere. */
function pezziTesto(testo: string, cerca: string): Pezzi | null {
  if (!testo || cerca.length < 2) return null;
  const n = normalizza(testo);
  if (n.length !== testo.length) return null;
  const i = n.indexOf(cerca);
  if (i < 0) return null;
  return [testo.slice(0, i), testo.slice(i, i + cerca.length), testo.slice(i + cerca.length)];
}

/** Il telefono si cerca a cifre nude ("3478") ma si mostra come l'ha scritto
 *  il cliente ("+39 347 8…"): l'indice trovato sulle cifre va riportato sulla
 *  stringa vera, spazi e prefissi compresi, altrimenti si evidenzierebbe il
 *  pezzo sbagliato del numero. */
function pezziTelefono(grezzo: string, cifre: string): Pezzi | null {
  if (!grezzo || cifre.length < 2) return null;
  const i = soloCifre(grezzo).indexOf(cifre);
  if (i < 0) return null;
  let viste = -1;
  let da = -1;
  let a = grezzo.length;
  for (let k = 0; k < grezzo.length; k++) {
    if (grezzo[k] < "0" || grezzo[k] > "9") continue;
    viste += 1;
    if (viste === i) da = k;
    if (viste === i + cifre.length - 1) {
      a = k + 1;
      break;
    }
  }
  if (da < 0) return null;
  return [grezzo.slice(0, da), grezzo.slice(da, a), grezzo.slice(a)];
}

function FinestraRicerca({
  aperta,
  onApertaChange,
  query,
  onQuery,
  onApriLead,
  onNuovaTrattativa,
}: {
  aperta: boolean;
  onApertaChange: (v: boolean) => void;
  query: string;
  onQuery: (v: string) => void;
  onApriLead: (l: Lead) => void;
  onNuovaTrattativa: () => void;
}) {
  const { leads, consultants, reload, updateLead } = useCRM();
  const { canAccess } = useUserSettings();
  //  Le due domande sono diverse e servono entrambe: `canAccess` guarda
  //  l'ACCOUNT (quali schede sono abilitate), `puo` la PERSONA entrata col PIN.
  const puo = usePuo();
  const navigate = useNavigate();
  const cmd = useTastoComando();
  const [preventivi, setPreventivi] = useState<RigaPreventivo[] | null>(null);

  /* ── I TRE VOLTI DELLA STESSA FINESTRA ─────────────────────────────────
     "ricerca" è quella di sempre; "stato" e "quando" prendono il suo posto
     senza aprirne una seconda. Due finestre sovrapposte si contendono il
     fuoco — è già successo in questo CRM — e chi cambia stato da qui vuole
     restare dov'era: si torna indietro con Esc e la ricerca è ancora scritta.
     Del lead si tiene l'ID e non l'oggetto: dopo il salvataggio il contesto
     ne restituisce uno nuovo, e una copia vecchia mostrerebbe lo stato di
     prima proprio nel momento in cui si guarda se è cambiato. */
  const [modo, setModo] = useState<
    | { tipo: "ricerca" }
    | { tipo: "stato"; leadId: string }
    | { tipo: "quando"; leadId: string; richiesta: RichiestaQuando }
  >({ tipo: "ricerca" });

  /** Il lead a cui si riferisce il pannello aperto, sempre riletto dall'elenco
   *  vivo. Se è sparito (cancellato altrove) si torna alla ricerca. */
  const leadModo =
    modo.tipo === "ricerca" ? null : (leads.find((l) => l.id === modo.leadId) ?? null);

  /** Serve al comando da tastiera: la riga sotto al cursore la conosce cmdk,
   *  che la marca con `data-selected`. La si legge dal DOM invece di tenerne
   *  una copia in stato — una copia che si disallinea è una riga che apre il
   *  lead sbagliato. */
  const listaRef = useRef<HTMLDivElement>(null);

  /** Gli stati che chiedono importi escono dalla ricerca e passano alla loro
   *  finestra: si chiude prima, si apre dopo (vedi il rinvio nel Guscio). */
  const [importi, setImporti] = useState<{ lead: Lead; stato: LeadStatus } | null>(null);
  const [importiAperto, setImportiAperto] = useState(false);
  //  La finestra delle tre chiusure vinte: si porta dietro i suoi stati.
  const chiusura = useChiusura();
  const rinvio = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (rinvio.current) clearTimeout(rinvio.current);
    },
    [],
  );

  //  Ogni apertura riparte dalla ricerca: riaprire ⌘K e ritrovarsi il pannello
  //  degli stati di un lead di ieri è una finestra che non risponde più alla
  //  domanda per cui la si è aperta.
  useEffect(() => {
    if (!aperta) setModo({ tipo: "ricerca" });
  }, [aperta]);

  // I preventivi stanno in un'altra tabella e non servono a nessun'altra
  // schermata del guscio: si leggono alla prima apertura della ricerca e
  // restano in memoria per il resto della sessione.
  useEffect(() => {
    if (!aperta || preventivi !== null) return;
    let annullato = false;
    void (async () => {
      const { data } = await dbPreventivi
        .from("quote_requests")
        .select("id,quote_ref,nome,telefono,total,status,created_at")
        .order("created_at", { ascending: false })
        .limit(400);
      if (!annullato) setPreventivi(data ?? []);
    })();
    return () => {
      annullato = true;
    };
  }, [aperta, preventivi]);

  const nomeConsulente = useMemo(() => {
    const m = new Map<string, string>();
    consultants.forEach((c) => m.set(c.id, c.data.nome));
    return m;
  }, [consultants]);

  // Indice preparato una volta sola: con ~850 trattative confrontare stringhe
  // già normalizzate ad ogni tasto premuto è istantaneo, rifarle no.
  const indice = useMemo(
    () =>
      leads.map((l) => {
        //  Stessa cautela della riga: questo `map` gira al montaggio del
        //  guscio, e un solo lead senza `data` porterebbe giù tutto il CRM
        //  prima ancora che si veda una schermata.
        const d = l.data ?? ({} as LeadData);
        return {
          lead: l,
          testo: normalizza(`${d.nome ?? ""} ${d.cognome ?? ""} ${d.citta ?? ""} ${d.email ?? ""}`),
          cifre: soloCifre(d.telefono),
        };
      }),
    [leads],
  );

  const q = query.trim();
  const qn = normalizza(q);
  const qc = soloCifre(q);
  const parole = useMemo(() => qn.split(/\s+/).filter(Boolean), [qn]);

  const trattative = useMemo(() => {
    if (!qn && !qc) {
      // Campo vuoto: le ultime toccate. Nove volte su dieci il cliente che
      // richiama è uno di questi, e così si apre senza scrivere niente.
      return [...leads]
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
        .slice(0, MAX_TRATTATIVE);
    }
    const trovati: { lead: Lead; punti: number }[] = [];
    for (const v of indice) {
      let punti = 0;
      // Il telefono vince su tutto: se si scrivono cifre, si sta leggendo un
      // numero da uno schermo o da un biglietto, non cercando un nome. Bastano
      // tre cifre e possono stare in mezzo al numero: al telefono il cliente
      // detta quello che si ricorda, quasi mai il prefisso.
      if (qc.length >= 3 && v.cifre.includes(qc)) punti = 100;
      else if (
        parole.length &&
        //  Nome e cifre nella stessa ricerca ("rossi 347") sono il caso di chi
        //  ha davanti mezza rubrica: ogni pezzo può soddisfarsi dove sa stare,
        //  le lettere sull'anagrafica e i numeri sul telefono.
        //  Tre cifre come sopra: con due si aggancerebbe mezzo archivio.
        parole.every((p) => v.testo.includes(p) || (p.length >= 3 && v.cifre.includes(p)))
      )
        punti = v.testo.startsWith(parole[0]) ? 60 : 40;
      if (punti) trovati.push({ lead: v.lead, punti });
    }
    return trovati
      .sort((a, b) =>
        b.punti !== a.punti ? b.punti - a.punti : a.lead.updated_at < b.lead.updated_at ? 1 : -1,
      )
      .slice(0, MAX_TRATTATIVE)
      .map((t) => t.lead);
  }, [qn, qc, parole, indice, leads]);

  const preventiviTrovati = useMemo(() => {
    if (!preventivi || (!qn && !qc)) return [];
    return preventivi
      .filter((p) => {
        const rif = normalizza(p.quote_ref);
        const nome = normalizza(p.nome);
        const cifre = soloCifre(p.telefono);
        return (
          (qn.length >= 2 && (rif.includes(qn) || nome.includes(qn))) ||
          (qc.length >= 3 && (cifre.includes(qc) || rif.includes(qc)))
        );
      })
      .slice(0, MAX_PREVENTIVI);
  }, [preventivi, qn, qc]);

  // Le pagine arrivano dallo stesso elenco della barra laterale, con lo STESSO
  // giudizio (`permessoDiVoce`, esportata da CRMSidebar): la ricerca non può
  // portare dove il menu non porta più. Con due filtri scritti a mano si
  // sarebbero disallineati al primo permesso aggiunto.
  const pagine = useMemo(() => {
    const tutte: VoceMenu[] = GRUPPI_MENU.flatMap((g) => g.voci).filter((v) => {
      if (v.scheme && !canAccess(v.scheme)) return false;
      const p = permessoDiVoce(v);
      return !p || puo(p);
    });
    if (!qn) return [];
    return tutte
      .filter((v) => normalizza(`${v.titolo} ${v.descrizione} ${v.alias ?? ""}`).includes(qn))
      .slice(0, MAX_PAGINE);
  }, [qn, canAccess, puo]);

  /** Un preventivo non è collegato a una trattativa: si prova ad agganciarlo
   *  dal numero di telefono (le ultime 9 cifre, per non farsi fermare da
   *  prefissi e spazi). Se il cliente esiste si apre la sua scheda, altrimenti
   *  si va alla pagina Preventivi. */
  const apriPreventivo = (p: RigaPreventivo) => {
    const cifre = soloCifre(p.telefono).slice(-9);
    const lead =
      cifre.length >= 6
        ? leads.find((l) => soloCifre(l.data?.telefono).slice(-9) === cifre)
        : undefined;
    if (lead) onApriLead(lead);
    else {
      onApertaChange(false);
      void navigate({ to: "/CRM/preventivi" });
    }
  };

  const vaiA = (url: string) => {
    onApertaChange(false);
    void navigate({ to: url });
  };

  /* ── IL CAMBIO DI STATO, DA QUI ────────────────────────────────────────
     Tre strade, e si vede prima di premere quale si sta imboccando (la riga
     dello stato lo scrive: «chiede la data», «chiede gli importi»).       */
  const applicaStato = async (l: Lead, s: LeadStatus) => {
    if (s === l.data?.stato) {
      setModo({ tipo: "ricerca" });
      return;
    }
    //  0. «Ha comprato»: la finestra della chiusura, che scrive stato, acconto,
    //     totale e modo di consegna in un salvataggio solo. Sta PRIMA di tutto
    //     il resto e non chiama `updateLead`: qui sotto lo stato si scriverebbe
    //     subito (è la scelta giusta per gli stati con una data — meglio uno
    //     stato senza data che nessuno dei due), ma su una vendita quella
    //     stessa scelta lascerebbe un lead verde con la cassa vuota se poi la
    //     finestra viene chiusa.
    if (chiusura.intercetta(l, s)) {
      onApertaChange(false);
      return;
    }
    //  1. Importi: fuori dalla ricerca, dentro la finestra che li raccoglie.
    if (CHIEDE_IMPORTI.has(s)) {
      setImporti({ lead: l, stato: s });
      onApertaChange(false);
      if (rinvio.current) clearTimeout(rinvio.current);
      rinvio.current = setTimeout(() => setImportiAperto(true), 120);
      return;
    }
    await updateLead(l.id, { stato: s });
    const richiesta = QUANDO_PER_STATO[s];
    //  2. Lo stato promette un momento: lo si chiede subito. Lo stato è già
    //     scritto — come nella scheda — così anche chi chiude senza data
    //     lascia il lead nello stato giusto, non a metà del gesto.
    if (richiesta) {
      setModo({ tipo: "quando", leadId: l.id, richiesta });
      return;
    }
    //  3. Tutto il resto: fatto, e la riga qui sotto lo mostra già.
    setModo({ tipo: "ricerca" });
    toast.success(`${nomeLead(l)} → ${LEAD_STATUS_LABEL[s]}`);
  };

  const confermaQuando = async (l: Lead, richiesta: RichiestaQuando, data: string, ora: string) => {
    //  Si scrive nei DUE campi nominati dalla richiesta, mai in campi decisi
    //  dallo stato corrente: è la regola che ha chiuso il guasto storico.
    const patch: Partial<LeadData> = {};
    patch[richiesta.chiaveData] = data || undefined;
    patch[richiesta.chiaveOra] = ora || undefined;
    await updateLead(l.id, patch);
    setModo({ tipo: "ricerca" });
    toast.success(`${nomeLead(l)} · ${richiesta.nomeCampo.toLowerCase()}`, {
      description: etichettaQuando(data, ora),
    });
  };

  /** «Non adesso»: lo stato resta cambiato, la data no — e lo si dice, con la
   *  strada per rimediare. Un avviso che non offre il rimedio è un arretrato
   *  che nasce in silenzio. */
  const rimandaQuando = (l: Lead, richiesta: RichiestaQuando) => {
    setModo({ tipo: "ricerca" });
    toast.warning(`Manca «${richiesta.nomeCampo}»`, {
      description: "Senza data questo lead esce dalle code di lavoro: nessuno lo richiama.",
      action: { label: "Apri la scheda", onClick: () => onApriLead(l) },
    });
  };

  /** ⌘↵ sulla riga sotto al cursore: apre gli stati senza rubare Invio, che
   *  resta il tasto per aprire la scheda. cmdk chiama questo gestore PRIMA del
   *  suo, e si ferma se l'evento è già stato consumato. */
  const suTastoRicerca = (e: EventoTastiera<HTMLDivElement>) => {
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
    const riga = listaRef.current?.querySelector<HTMLElement>('[data-selected="true"][data-lead]');
    const id = riga?.dataset.lead;
    const l = id ? leads.find((x) => x.id === id) : undefined;
    if (!l) return;
    e.preventDefault();
    setModo({ tipo: "stato", leadId: l.id });
  };

  const totale = trattative.length + preventiviTrovati.length + pagine.length;
  const nulla = totale === 0;

  return (
    <>
      <Dialog open={aperta} onOpenChange={onApertaChange}>
        {/*  `crm-theme` DEVE stare qui: il dialogo vive in un portale attaccato a
           <body>, quindi FUORI dal guscio del CRM, e senza la classe i token
           tornano quelli della landing — fondo navy scuro e bordi del marchio.
           Resta per bordi, testi secondari e pastiglie dei tasti; i colori che
           contano davvero — fondo della finestra e riga sotto al cursore — non
           dipendono più da nessun token: erano proprio loro a diventare blu
           pieno quando il tema sbagliato vinceva la gara. */}
        <DialogContent
          className={cn(
            "crm-theme gap-0 overflow-hidden p-0 shadow-2xl [&>button]:hidden",
            FONDO_FINESTRA,
            BORDO_FINESTRA,
            //  TELEFONO: foglio dal basso come tutte le altre finestre — la
            //  ricerca si apre anche da qui (il pulsante in testata), non solo
            //  con ⌘K, e una finestra centrata lascerebbe i risultati sotto la
            //  tastiera che si apre da sola.
            "inset-x-0 bottom-0 top-auto max-w-none translate-x-0 translate-y-0",
            "rounded-b-none rounded-t-2xl",
            //  DA TABLET IN SU: finestra centrata.
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-2xl",
            "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
          )}
          /*  ESC TORNA INDIETRO DI UN PASSO, NON CHIUDE TUTTO.
              Va intercettato QUI e non nei pannelli: Radix ascolta Escape sul
              documento in fase di cattura, cioè PRIMA di qualunque gestore
              React appeso dentro la finestra — uno `stopPropagation` là dentro
              arriverebbe a cose fatte, con la ricerca già chiusa e la query
              buttata via. Con `preventDefault` la chiusura non parte. */
          onEscapeKeyDown={(e) => {
            if (modo.tipo === "ricerca") return;
            e.preventDefault();
            if (modo.tipo === "quando" && leadModo) rimandaQuando(leadModo, modo.richiesta);
            else setModo({ tipo: "ricerca" });
          }}
        >
          <DialogTitle className="sr-only">Ricerca</DialogTitle>

          {/*  Un volto per volta, nella stessa cornice. I due pannelli sono
             componenti a sé: i loro campi (filtro, data, ora) nascono e
             muoiono con loro, e non c'è nessun hook che compare o sparisce a
             seconda del ramo. */}
          {modo.tipo === "stato" && leadModo ? (
            <PannelloStato
              lead={leadModo}
              onIndietro={() => setModo({ tipo: "ricerca" })}
              onScegli={(s) => void applicaStato(leadModo, s)}
            />
          ) : modo.tipo === "quando" && leadModo ? (
            <PannelloQuando
              lead={leadModo}
              richiesta={modo.richiesta}
              onIndietro={() => rimandaQuando(leadModo, modo.richiesta)}
              onConferma={(data, ora) => void confermaQuando(leadModo, modo.richiesta, data, ora)}
            />
          ) : (
            /* shouldFilter={false}: il filtro è nostro, perché deve capire i numeri
            di telefono e gli alias delle pagine, cose che il confronto testuale
            di serie non sa fare. */
            <Command
              shouldFilter={false}
              loop
              className="bg-transparent"
              onKeyDown={suTastoRicerca}
            >
              <CommandInput
                variant="grande"
                autoFocus
                value={query}
                onValueChange={onQuery}
                placeholder="Nome, telefono o n° preventivo…"
                //  A campo vuoto la scorciatoia, appena si scrive la crocetta: col
                //  telefono in mano cancellare selezionando il testo è un'impresa.
                azione={
                  q ? (
                    <button
                      type="button"
                      //  Senza questo il click porta via il fuoco dal campo e le
                      //  frecce smettono di muovere la selezione finché non si
                      //  riclicca dentro: si cancella per riscrivere, non per
                      //  smettere di scrivere.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onQuery("")}
                      className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Cancella la ricerca</span>
                    </button>
                  ) : (
                    <Tasto className="hidden shrink-0 sm:inline-flex">{cmd}K</Tasto>
                  )
                }
              />

              <CommandList
                ref={listaRef}
                className="max-h-[56vh] overscroll-contain pb-1.5 sm:max-h-[420px]"
              >
                {nulla && (
                  <div className="flex flex-col items-center px-6 py-10 text-center">
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      {q ? <SearchX className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                    </span>
                    <p className="text-[13px] font-semibold text-slate-900">
                      {q ? `Nessun risultato per “${q}”` : "Scrivi per cercare"}
                    </p>
                    <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-slate-500">
                      {q
                        ? "Prova con le ultime cifre del telefono o con il solo cognome."
                        : "Nome, cognome, telefono anche parziale o numero di preventivo."}
                    </p>
                  </div>
                )}

                {trattative.length > 0 && (
                  <CommandGroup variant="discreta" heading={q ? "Lead" : "Aperti di recente"}>
                    {trattative.map((l) => {
                      //  Una riga sola con `data` mancante — capita nell'archivio
                      //  importato — faceva morire l'INTERA finestra di ricerca:
                      //  da qui in giù si legge solo da questo oggetto, che c'è
                      //  sempre.
                      const dati = l.data ?? ({} as LeadData);
                      const nomeIntero = `${dati.nome ?? ""} ${dati.cognome ?? ""}`.trim();
                      const consulente = dati.consulenteId
                        ? (nomeConsulente.get(dati.consulenteId) ?? "consulente")
                        : null;
                      return (
                        <CommandItem
                          key={l.id}
                          variant="riga"
                          value={`lead-${l.id}`}
                          //  L'unica cosa che serve al comando da tastiera: da qui
                          //  ⌘↵ risale al lead della riga sotto al cursore.
                          data-lead={l.id}
                          onSelect={() => onApriLead(l)}
                        >
                          <Simbolo>{iniziali(dati.nome, dati.cognome)}</Simbolo>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[13.5px] font-semibold text-slate-900">
                                <Evidenzia
                                  testo={nomeIntero || "Senza nome"}
                                  pezzi={pezziTesto(nomeIntero, parole[0] ?? "")}
                                />
                              </span>
                              <PastigliaStato
                                stato={dati.stato}
                                nome={nomeIntero || "questo lead"}
                                onApri={() => setModo({ tipo: "stato", leadId: l.id })}
                              />
                            </div>
                            {/*  La riga sotto esiste per un motivo solo: due Rossi
                            Mario si distinguono qui, non nel nome. */}
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-slate-500">
                              <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                              <span className="shrink-0 tabular-nums">
                                {dati.telefono ? (
                                  <Evidenzia
                                    testo={dati.telefono}
                                    pezzi={pezziTelefono(dati.telefono, qc)}
                                  />
                                ) : (
                                  "—"
                                )}
                              </span>
                              {dati.citta && <span className="truncate">· {dati.citta}</span>}
                              {consulente && <span className="truncate">· {consulente}</span>}
                            </div>
                          </div>
                          <Invio />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {preventiviTrovati.length > 0 && (
                  <CommandGroup variant="discreta" heading="Preventivi">
                    {preventiviTrovati.map((p) => (
                      <CommandItem
                        key={p.id}
                        variant="riga"
                        value={`quote-${p.id}`}
                        onSelect={() => apriPreventivo(p)}
                      >
                        <Simbolo>
                          <FileText className="h-4 w-4" />
                        </Simbolo>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] font-semibold text-slate-900">
                              {p.nome || "Preventivo"}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-slate-500">
                              <Evidenzia
                                testo={p.quote_ref ?? "—"}
                                pezzi={pezziTesto(p.quote_ref ?? "", qn)}
                              />
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-slate-500">
                            <span className="shrink-0 tabular-nums">{eur(p.total)}</span>
                            <span className="truncate">· {p.status ?? "in attesa"}</span>
                            {p.telefono && (
                              <span className="hidden shrink-0 tabular-nums sm:inline">
                                ·{" "}
                                <Evidenzia
                                  testo={p.telefono}
                                  pezzi={pezziTelefono(p.telefono, qc)}
                                />
                              </span>
                            )}
                          </div>
                        </div>
                        <Invio />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {pagine.length > 0 && (
                  <CommandGroup variant="discreta" heading="Pagine">
                    {pagine.map((v) => (
                      <CommandItem
                        key={v.url}
                        variant="riga"
                        value={`pagina-${v.url}`}
                        onSelect={() => vaiA(v.url)}
                      >
                        <Simbolo>
                          <v.icon className="h-4 w-4" />
                        </Simbolo>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold text-slate-900">
                            <Evidenzia testo={v.titolo} pezzi={pezziTesto(v.titolo, qn)} />
                          </div>
                          <div className="mt-0.5 truncate text-[11.5px] text-slate-500">
                            {v.descrizione}
                          </div>
                        </div>
                        <Invio />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                <CommandGroup variant="discreta" heading="Azioni">
                  <CommandItem variant="riga" value="azione-nuova" onSelect={onNuovaTrattativa}>
                    <Simbolo>
                      <UserPlus className="h-4 w-4" />
                    </Simbolo>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-slate-900">Nuovo lead</div>
                      <div className="mt-0.5 truncate text-[11.5px] text-slate-500">
                        Apre la scheda vuota, senza cambiare pagina
                      </div>
                    </div>
                    <Invio />
                  </CommandItem>
                  <CommandItem
                    variant="riga"
                    value="azione-aggiorna"
                    onSelect={() => {
                      onApertaChange(false);
                      void reload();
                    }}
                  >
                    <Simbolo>
                      <RefreshCw className="h-4 w-4" />
                    </Simbolo>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-slate-900">
                        Ricarica i dati
                      </div>
                      <div className="mt-0.5 truncate text-[11.5px] text-slate-500">
                        Rilegge lead e agenda dal server
                      </div>
                    </div>
                    <Invio />
                  </CommandItem>
                </CommandGroup>
              </CommandList>

              {/* Le stesse parole della finestra "Cambia stato": chi impara la
              scorciatoia in un punto la ritrova scritta uguale nell'altro.
              Sotto i 640px i tasti spariscono — non c'è nessuna tastiera da
              cui premerli — e resta il solo conteggio. */}
              <div
                className={cn(
                  "flex items-center gap-4 border-t px-3.5 py-2 text-[11px] text-slate-500",
                  BORDO_FINESTRA,
                )}
              >
                <span className="hidden items-center gap-1.5 sm:flex">
                  <span className="flex gap-0.5">
                    <Tasto>↑</Tasto>
                    <Tasto>↓</Tasto>
                  </span>
                  per muoversi
                </span>
                <span className="hidden items-center gap-1.5 sm:flex">
                  <Tasto>↵</Tasto> per aprire
                </span>
                {/*  La scorciatoia sta scritta qui perché una scorciatoia che non
                si vede non esiste: ⌘↵ e non ↵, perché Invio apre la scheda e
                cambiargli mestiere sotto le dita sarebbe il modo più veloce
                per aprire la scheda sbagliata. */}
                <span className="hidden items-center gap-1.5 sm:flex">
                  <Tasto>{cmd}↵</Tasto> per cambiare stato
                </span>
                <span className="hidden items-center gap-1.5 md:flex">
                  <Tasto>esc</Tasto> per chiudere
                </span>
                <span className="ml-auto tabular-nums">
                  {q
                    ? `${totale} ${totale === 1 ? "risultato" : "risultati"}`
                    : `${leads.length} lead in archivio`}
                </span>
              </div>
            </Command>
          )}
        </DialogContent>
      </Dialog>

      {/*  Fuori dal dialogo della ricerca, e non dentro: quando si passa di qui
         la ricerca si è appena chiusa, e tutto ciò che sta nel suo corpo viene
         smontato con lei — compresa la finestra che si stava aprendo. */}
      <QuickStatusDialog
        open={importiAperto}
        onOpenChange={setImportiAperto}
        lead={importi?.lead ?? null}
        newStatus={importi?.stato ?? null}
      />
      {/*  Stessa ragione della finestra qui sopra: fuori dal corpo della
          ricerca, che si smonta nell'istante in cui questa si apre. */}
      {chiusura.finestra}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAMBIARE STATO SENZA USCIRE DALLA RICERCA
   I due pannelli prendono il posto dell'elenco dentro la stessa cornice: una
   sola finestra a schermo, nessun fuoco conteso, e la ricerca scritta è ancora
   lì quando si torna indietro.
   ═════════════════════════════════════════════════════════════════════════ */

/** La pastiglia dello stato sulla riga del risultato. Stessa forma e stesso
 *  colore di tutte le altre del CRM (CLASSE_BADGE_STATO + classiStato): qui in
 *  più è un pulsante, e lo dichiara con la freccetta — una pastiglia che si
 *  preme e una che non si preme non possono essere identiche.
 *  Il click NON deve arrivare alla riga: la riga apre la scheda, e aprirla
 *  mentre si voleva solo cambiare stato è esattamente il giro che questo
 *  intervento toglie di mezzo. */
function PastigliaStato({
  stato,
  nome,
  onApri,
}: {
  stato: LeadStatus | string | undefined | null;
  nome: string;
  onApri: () => void;
}) {
  return (
    <button
      type="button"
      title={`Cambia lo stato di ${nome}`}
      //  Senza questo il click porta via il fuoco dal campo di ricerca prima
      //  ancora che il pannello si apra.
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onApri();
      }}
      className={cn(
        CLASSE_BADGE_STATO,
        classiStato(stato),
        "shrink-0 cursor-pointer pr-1 transition-shadow",
        "hover:ring-2 hover:ring-slate-300/70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
      )}
    >
      <span className="truncate">{etichettaStato(stato)}</span>
      <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
    </button>
  );
}

/** Testata dei pannelli: la via del ritorno sta a sinistra, dove si cerca. */
function TestataPannello({
  icona: Icona,
  titolo,
  contesto,
  onIndietro,
}: {
  icona: typeof Tags;
  titolo: string;
  contesto: string;
  onIndietro: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 border-b px-3 py-2.5 sm:px-3.5", BORDO_FINESTRA)}>
      <button
        type="button"
        onClick={onIndietro}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="sr-only">Torna ai risultati</span>
      </button>
      <Icona className="h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-slate-900">{titolo}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-slate-500">{contesto}</div>
      </div>
    </div>
  );
}

/** Il tasto premuto è arrivato da un pulsante (una pastiglia, una voce, un
 *  tasto del piede)? Allora Invio appartiene a lui e non al pannello: due
 *  gestori sullo stesso tasto sono un click che finisce dove non si guardava. */
function dentroUnPulsante(e: EventoTastiera<HTMLDivElement>): boolean {
  return !!(e.target as HTMLElement | null)?.closest?.("button");
}

/** Piede dei pannelli: stesso ritmo e stesso peso di quello della ricerca. */
function PiedePannello({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3.5 py-2 text-[11px] text-slate-500",
        BORDO_FINESTRA,
      )}
    >
      {children}
    </div>
  );
}

/* ── IL PANNELLO DEGLI STATI ───────────────────────────────────────────────
   È LA STESSA GRIGLIA di tutto il resto del CRM — `GrigliaStati` in
   crm/SelettoreStatoDialog — messa dentro la ricerca invece che dentro una
   finestra. Perché la griglia e non la finestra: qui siamo già dentro un
   dialogo, e un dialogo dentro un dialogo è un velo sopra un velo, con Esc che
   non sa più quale dei due chiudere. La testata e il piede restano quelli del
   pannello, il resto — pulsanti, gruppi, icone, l'avviso del calendario, la
   ricerca da tastiera — arriva da lì.
   Prima era un elenco a righe scritto qui dentro: la seconda versione dello
   stesso selettore, con la sua copia della regola su quali stati mostrare.  */
function PannelloStato({
  lead,
  onIndietro,
  onScegli,
}: {
  lead: Lead;
  onIndietro: () => void;
  onScegli: (s: LeadStatus) => void;
}) {
  //  `data` può mancare del tutto sulle schede arrivate dall'archivio: qui non
  //  si dà per scontato nemmeno lo stato.
  const attuale = lead.data?.stato;

  //  Gli stati proposti sono quelli giusti per QUESTO lead — la regola è
  //  `statiPer`, e la applica `statiSelezionabili` per tutti allo stesso modo:
  //  chi lavora una lista vede gli esiti della chiamata, chi ha già fatto la
  //  consulenza vede quelli della trattativa.
  const stati = useMemo<LeadStatus[]>(() => statiSelezionabili(lead.data ?? {}), [lead]);

  return (
    <div className="flex min-h-0 flex-col">
      <TestataPannello
        icona={Tags}
        titolo="Cambia stato"
        contesto={`${nomeLead(lead)} · adesso: ${etichettaStato(attuale)}`}
        onIndietro={onIndietro}
      />

      {/*  max-h: dentro la ricerca il pannello divide lo spazio con la testata e
           il piede, e senza un tetto la griglia spingerebbe il piede fuori. */}
      <GrigliaStati stato={attuale} opzioni={stati} onScegli={onScegli} className="max-h-[52vh]" />

      <PiedePannello>
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="flex gap-0.5">
            <Tasto>↑</Tasto>
            <Tasto>↓</Tasto>
          </span>
          per scorrere
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <Tasto>↵</Tasto> per applicare
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <Tasto>esc</Tasto> per tornare ai risultati
        </span>
        <span className="ml-auto tabular-nums">
          {stati.length} {stati.length === 1 ? "stato" : "stati"}
        </span>
      </PiedePannello>
    </div>
  );
}

/* ── IL PANNELLO DELLA DATA ────────────────────────────────────────────────
   Fa una domanda sola e scrive sotto la risposta come si dice al telefono
   («domani · 15:30»), più il nome del campo che riceverà il valore: è lo
   stesso comportamento della finestrella della scheda, e lo stesso controllo
   che a un campo data manca — «2026-09-08» e «2026-08-09» si somigliano
   abbastanza da passare inosservati.                                        */
function PannelloQuando({
  lead,
  richiesta,
  onIndietro,
  onConferma,
}: {
  lead: Lead;
  richiesta: RichiestaQuando;
  /** «Non adesso»: torna ai risultati lasciando lo stato già cambiato */
  onIndietro: () => void;
  onConferma: (data: string, ora: string) => void;
}) {
  //  Quello che c'è già sulla scheda, ripulito: spostare parte da lì, non da
  //  zero. `soloData` e String() perché in archivio questi campi non sono
  //  sempre della forma dichiarata.
  const partenza = soloData(lead.data?.[richiesta.chiaveData]);
  const oraPartenza = String(lead.data?.[richiesta.chiaveOra] ?? "").slice(0, 5);
  const [data, setData] = useState(partenza);
  const [ora, setOra] = useState(oraPartenza);

  //  Gli scatti si contano dalla data ATTUALE quando c'è ed è ancora futura
  //  («+1 settimana» da quella fissata, che è come lo si dice al cliente). Se
  //  è già passata si riparte da oggi, altrimenti lo scatto rapido sarebbe la
  //  strada più veloce per fissare un'altra data passata.
  const base = partenza && partenza >= oggiIso() ? partenza : "";
  const spostamento = !!base;
  const scatti = spostamento
    ? [
        { g: 1, l: "+1 giorno" },
        { g: 3, l: "+3 giorni" },
        { g: 7, l: "+1 settimana" },
        { g: 14, l: "+2 settimane" },
      ]
    : [
        { g: 1, l: "Domani" },
        { g: 3, l: "Fra 3 giorni" },
        { g: 7, l: "Fra una settimana" },
        { g: 14, l: "Fra due settimane" },
      ];

  const mancaOra = richiesta.oraObbligatoria && !ora;
  const puoConfermare = !!data && !mancaOra;
  const passata = !!data && data < oggiIso();

  const conferma = () => {
    if (!puoConfermare) return;
    onConferma(data, ora);
  };

  const suTasto = (e: EventoTastiera<HTMLDivElement>) => {
    if (e.key === "Enter") {
      //  Invio su «Non adesso» o su uno scatto deve fare quello, non
      //  confermare: il pannello prende Invio solo dai campi.
      if (dentroUnPulsante(e)) return;
      e.preventDefault();
      conferma();
    }
    //  Escape lo gestisce la finestra: da lì equivale a «Non adesso».
  };

  return (
    <div onKeyDown={suTasto} className="flex min-h-0 flex-col">
      <TestataPannello
        icona={CalendarClock}
        titolo={richiesta.titolo}
        contesto={`${nomeLead(lead)} · ${richiesta.nota}`}
        onIndietro={onIndietro}
      />

      <div className="min-h-0 max-h-[52vh] flex-1 space-y-3 overflow-y-auto overscroll-contain p-3.5 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {scatti.map((s) => {
            const d = fraGiorni(s.g, base || undefined);
            return (
              <Pillola key={s.g} attiva={data === d} onClick={() => setData(d)} className="py-2">
                {s.l}
              </Pillola>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="min-w-0">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {richiesta.nomeCampo}
            </span>
            <Input
              type="date"
              autoFocus
              className={cn(CLASSE_CAMPO, "w-full")}
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Ora {richiesta.oraObbligatoria ? "" : "(facoltativa)"}
            </span>
            <Input
              type="time"
              className={cn(CLASSE_CAMPO, "w-full")}
              value={ora}
              onChange={(e) => setOra(e.target.value)}
            />
          </label>
        </div>

        <div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Orari più usati
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ORE_FREQUENTI.map((o) => (
              <Pillola key={o} attiva={ora === o} onClick={() => setOra(o)} className="py-2">
                {o}
              </Pillola>
            ))}
          </div>
        </div>

        {/*  LA DATA EFFETTIVA, detta in relazione a oggi e col nome del campo
            che la riceverà: è il controllo che manca a un campo data. */}
        {data ? (
          <NotaFinestra
            tono={passata ? "attenzione" : "conferma"}
            icona={passata ? AlertTriangle : Check}
          >
            <span className="block font-semibold">{etichettaQuando(data, ora || undefined)}</span>
            <span className="block">
              {passata
                ? `È una data già passata. Finirà comunque in «${richiesta.nomeCampo}».`
                : `Va in «${richiesta.nomeCampo}» e si salva subito.`}
            </span>
          </NotaFinestra>
        ) : (
          <NotaFinestra tono="attenzione" icona={AlertTriangle}>
            Senza data questo lead esce dalle code di lavoro: nessuno lo richiama.
          </NotaFinestra>
        )}
        {mancaOra && (
          <NotaFinestra tono="attenzione" icona={AlertTriangle}>
            Manca l&apos;ora: per questo stato è un appuntamento preso, non un &laquo;prima o
            poi&raquo;.
          </NotaFinestra>
        )}
      </div>

      <PiedePannello>
        <span className="hidden items-center gap-1.5 sm:flex">
          <Tasto>↵</Tasto> per confermare
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/*  «Non adesso» e non «Annulla»: lo stato è già cambiato, qui si sta
              solo rimandando la data. */}
          <Button variant="outline" size="sm" onClick={onIndietro}>
            Non adesso
          </Button>
          <Button size="sm" onClick={conferma} disabled={!puoConfermare}>
            Conferma
          </Button>
        </div>
      </PiedePannello>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   I pezzi di una riga di risultato
   ═════════════════════════════════════════════════════════════════════════ */

/** Il quadratino a sinistra: dice di che cosa si tratta prima ancora che si
 *  legga il testo, ed è dello stesso ingombro per ogni tipo di risultato —
 *  così i nomi restano incolonnati e l'occhio scende dritto invece di andare
 *  a zig-zag. È l'unico punto in cui entra del colore, e solo sulla riga
 *  scelta: un accenno di azzurro su una riga sola è un segnale, lo stesso
 *  azzurro su sette righe è una decorazione. */
function Simbolo({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100",
        "text-[11px] font-semibold text-slate-500 transition-colors",
        "group-data-[selected=true]/riga:bg-sky-50 group-data-[selected=true]/riga:text-sky-700",
      )}
    >
      {children}
    </span>
  );
}

/** Il simbolo di invio in fondo alla riga: compare solo su quella scelta.
 *  Ripetuto su ogni riga sarebbe rumore; su una sola è l'istruzione di cosa
 *  succede se si preme adesso. */
function Invio() {
  return (
    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-data-[selected=true]/riga:opacity-100" />
  );
}

function Evidenzia({ testo, pezzi }: { testo: string; pezzi: Pezzi | null }) {
  if (!pezzi) return <>{testo}</>;
  return (
    <>
      {pezzi[0]}
      <span className="rounded-[3px] bg-sky-100 text-slate-900">{pezzi[1]}</span>
      {pezzi[2]}
    </>
  );
}

/** Iniziali del cliente: due lettere bastano a dare una forma riconoscibile
 *  alla riga, e a chi cerca lo stesso cliente ogni giorno bastano quelle. */
function iniziali(nome?: string | null, cognome?: string | null): string {
  const n = (nome ?? "").trim();
  const c = (cognome ?? "").trim();
  return `${n[0] ?? ""}${c[0] ?? ""}`.toUpperCase() || "?";
}
