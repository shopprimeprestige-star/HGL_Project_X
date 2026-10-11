/** ─────────────────────────────────────────────────────────────────────────
 *  LeadDialog — LA SCHEDA DEL LEAD
 *
 *  È la finestra più aperta della giornata: ci si entra dall'elenco, dalla
 *  ricerca ⌘K, dall'agenda, da WhatsApp — spesso col cliente in linea che
 *  aspetta. Per questo è stata riscritta da zero attorno a quattro regole.
 *
 *  1 · ORDINE CRONOLOGICO, NON TEMATICO
 *  Fissare un appuntamento è una catena di decisioni con un ordine naturale:
 *  CHI lo fa (il consulente) → QUANTO dura → CHE GIORNO → CHE ORA. La versione
 *  precedente metteva l'appuntamento sopra e il consulente in fondo alla
 *  scheda, quindi si sceglieva l'ora prima di sapere di chi fosse l'agenda e
 *  poi si tornava su: otto ritorni all'indietro per una catena di sei
 *  decisioni. Adesso ogni campo sta DOPO ciò che serve a compilarlo e PRIMA di
 *  ciò che ne dipende — che è anche l'ordine che pretende il codice, visto che
 *  `generateAvailability(consulente, durata, …)` ha bisogno dei primi due per
 *  produrre giorni e ore.
 *
 *  2 · UNA COSA ALLA VOLTA
 *  Niente linguette: erano loro a costringere ai ritorni e, peggio, a far
 *  sparire i campi appena entrava un acconto (le note appena scritte
 *  diventavano irraggiungibili). Una colonna sola, e in cima il blocco
 *  «ADESSO», che cambia con lo stato del lead: un contatto mai chiamato vede
 *  gli esiti della chiamata, un appuntamento fissato vede conferma e
 *  spostamento, una consulenza svolta vede prezzo e acconto, un cliente che ha
 *  pagato vede la consegna. Il resto resta raggiungibile in fondo, sotto
 *  «Altri dati», che è chiuso finché non serve.
 *
 *  3 · IL LEAD NUOVO È UNA PROCEDURA GUIDATA
 *  A finestra vuota il modulo pieno non dice da dove cominciare: quando
 *  `lead === null` la stessa finestra diventa un wizard di quattro passi (chi è
 *  → da dove arriva → l'appuntamento → conferma). Si salva anche a metà: un
 *  lead con nome e telefono è già utile, e obbligare a compilare tutto fa
 *  perdere contatti.
 *
 *  4 · SI CHIAMA «LEAD»
 *  Nell'interfaccia non compare più la parola "trattativa". I nomi interni del
 *  codice restano quelli (`trattativaVinta`, `LeadData`): è il testo visibile
 *  che conta, e rinominare l'archivio non aiuta nessuno.
 *
 *  COSA NON STA PIÙ QUI, E PERCHÉ (così fra sei mesi nessuno lo rimette)
 *   · il riepilogo economico a cinque righe occupava il primo terzo dello
 *     schermo anche su un contatto mai chiamato, dove erano cinque «€ 0,00»:
 *     è diventato una riga sola, e compare solo se c'è un prezzo;
 *   · il consulente aveva DUE selettori (uno nudo in cima, uno col carico in
 *     fondo): resta quello che dice chi è già pieno oggi;
 *   · l'acconto si registrava in due punti con due comportamenti diversi:
 *     resta l'acconto rapido, l'unico che tiene coerenti stato, saldo e data;
 *   · i due input data/ora della vecchia barra cambiavano BERSAGLIO in base al
 *     menu di stato accanto (su «Non risponde» scrivevano su `dataRicontatto`
 *     invece che su `dataMeeting`, e l'appuntamento restava dov'era senza che
 *     nessuno lo sapesse). Ogni campo data qui ha un nome e un solo campo di
 *     destinazione, scritto nell'etichetta;
 *   · «Tipo di appuntamento», «Saldo rimanente» e il campo di testo del link
 *     della consulenza scrivevano dati che il sistema decide da solo;
 *   · il «Percorso del cliente» faceva due chiamate a Supabase a ogni apertura
 *     della finestra: adesso si monta solo se qualcuno apre «Altri dati»;
 *   · I DUE PULSANTI D'ESITO («Cliente assente», «Da riprogrammare») e «Avvia
 *     la videoconsulenza»: sono gli stessi comandi, con le stesse parole e gli
 *     stessi colori, che stanno su OGNI riga dell'agenda e dell'elenco e nel
 *     riquadro «Adesso» della pagina Oggi (RigaLead e SchedaAdesso in
 *     MeetGiornalieri, le righe di CRM.trattative). Si segna l'esito e si entra
 *     in stanza da dove si guarda la giornata, senza aprire nessuna scheda;
 *   · «Entra nella consulenza» della stanza: apriva la stessa stanza di
 *     «Avvia», con la stessa funzione. Un tasto solo per una cosa sola.
 *  NON se ne sono andati, e non è una dimenticanza: «Sposta l'appuntamento»
 *  (fuori NESSUNO dà una data nuova a una consulenza già fissata — il
 *  calendarietto della riga compare solo quando la data manca, e apre proprio
 *  questa scheda) e «Copia il link per il cliente» (fuori il link si può solo
 *  mandare su WhatsApp; per una mail o un SMS non c'è altra strada).
 *
 *  5 · LA DATA SI CHIEDE QUANDO LA SI PROMETTE
 *  Uno stato che promette un momento («Ricontatto fissato», «Meet da fissare»,
 *  «Visita in sede») e non riceve la data è il modo esatto in cui nascono gli
 *  arretrati: il lead esce dalle code di lavoro e non ci rientra più. Appena si
 *  sceglie uno di quegli stati si apre una finestrella che chiede il quando —
 *  scatti rapidi, data, ora — e mostra sotto, scritta in chiaro, LA DATA CHE
 *  VERRÀ SALVATA e IN QUALE CAMPO finisce. L'elenco degli stati e il criterio
 *  stanno in `QUANDO_PER_STATO`, qui sotto.
 *
 *  6 · SPOSTARE UN APPUNTAMENTO COSTA DUE TOCCHI
 *  «Sposta» apre la stessa finestrella, già compilata con la data attuale: uno
 *  scatto («+1 settimana») e conferma. Chi vuole vedere l'agenda del consulente
 *  ha lì dentro il passaggio agli orari liberi. Prima alla data si arrivava solo
 *  passando dalla catena completa — e in quattro situazioni ricorrenti (la
 *  consulenza di oggi, quella passata, l'esito già segnato, il lead senza
 *  consulente) alla catena non ci si arrivava affatto: vedi «I QUATTRO MODI IN
 *  CUI NON SI RIUSCIVA A SPOSTARE UNA DATA».
 *
 *  DUE TRAPPOLE TECNICHE DA NON RIAPRIRE
 *   a) i dati veri non rispettano sempre i tipi dichiarati (un campo dichiarato
 *      array può arrivare oggetto dall'archivio importato): ogni valore che
 *      viene dal database è trattato come "potrebbe non essere della forma che
 *      credi", e il calcolo degli orari liberi vive in un componente figlio
 *      dentro uno scudo — se cade, cade solo lui e restano i due campi manuali;
 *   b) il salvataggio non è mai silenzioso: `catch` esplicito, un messaggio per
 *      ogni esito, e la finestra si chiude SOLO se è andata a buon fine.
 *
 *  I QUATTRO MODI IN CUI NON SI RIUSCIVA A SPOSTARE UNA DATA
 *  (trovati rileggendo il file, tutti e quattro corretti alla radice)
 *   1. CONSULENZA DI OGGI O PASSATA → si vedeva solo il blocco dell'esito, e il
 *      tasto per riprogrammare c'era SOLO se lo stato era già «Da
 *      riprogrammare». Cioè il caso più frequente in assoluto — il cliente che
 *      chiama la mattina stessa per spostare — non aveva nessun comando.
 *      Adesso il blocco dell'esito porta sempre «Sposta l'appuntamento».
 *   2. LEAD SENZA CONSULENTE → nella catena il passo «Quando» mostrava solo
 *      «Scegli prima il consulente» e teneva NASCOSTI anche i due campi
 *      manuali: sulle schede importate (consulenteId nullo) la data non era
 *      scrivibile in nessun modo. Adesso i campi manuali ci sono sempre, e
 *      senza consulente sono già aperti.
 *   3. LEAD PERSO CON APPUNTAMENTO (no_show, perditempo, chiuso) → nessun
 *      blocco dell'appuntamento, nessuna catena: un «Cliente assente» non si
 *      poteva riprogrammare, che è l'unica cosa che si fa con un cliente
 *      assente. Adesso l'esito resta visibile e la catena si può aprire.
 *   4. LA DATA ENTRAVA MA LO STATO NO → scegliendo uno slot per un lead «Da
 *      riprogrammare» lo stato restava «Da riprogrammare», quindi la scheda
 *      continuava a chiedere di riprogrammare una consulenza già spostata.
 *      Adesso data e stato si scrivono insieme, da una porta sola
 *      (`fissaConsulenza`).
 *  Il sospetto iniziale — la vecchia barra che scriveva nel campo deciso dallo
 *  stato corrente (`quandoDaStato`/`leggiQuando`) — era già stato rimosso dalla
 *  riscrittura: nel file non esiste più nessun campo data con destinazione
 *  variabile. Ogni scrittura di data qui dentro nomina il proprio campo, e la
 *  finestrella del «quando» lo scrive perfino a schermo.
 *  ───────────────────────────────────────────────────────────────────────── */

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useCRM } from "./CRMContext";
import { depositaAnteprimaPerLead } from "./anteprima-link";
import {
  //  `statiPer` non si chiama più da qui: quale elenco di stati proporre lo
  //  decide `statiSelezionabili` dentro la pastiglia condivisa, per tutto il
  //  CRM allo stesso modo. L'import era rimasto, e un import morto fa credere
  //  che la regola viva ancora in due posti.
  eAppuntamento,
  eChiusuraVinta,
  LEAD_STATUS_LABEL,
  LOST_STATUSES,
  LOST_REASON_LABEL,
  LOST_REASON_OPTIONS,
  STATI_VINTI,
  type Consultant,
  type Lead,
  type LeadData,
  type LeadFonte,
  type LeadStatus,
  type LostReason,
  type PaymentInfo,
  type PiattaformaAds,
} from "./types";
import { DURATA_PREDEFINITA } from "./invito";
import {
  CLASSE_BADGE_STATO,
  Chip,
  TESTO_TONO,
  TONO_AZIONE,
  classiStato,
  dataBreve,
  eur,
  oggiIso,
  prossimaAzione,
} from "./ui";
//  Le consulenze le fanno solo i consulenti, e chi lo sia si chiede a un posto
//  solo: vedi la testata di crm/chi-fa-la-consulenza.
import { NotaSoloConsulenti, consulentiPerConsulenza } from "./chi-fa-la-consulenza";
//  Le risposte che la persona ha dato nel modulo dell'inserzione: come si
//  riconoscono e come si leggono sta tutto in crm/modulo-lead.
import { vociModulo } from "./modulo-lead";
import {
  BORDO_FINESTRA,
  Finestra,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
  VuotoFinestra,
} from "./ui/Finestra";
//  La regola dell'IVA — il conto e i tre riquadri — sta in crm/iva: la stessa
//  domanda si fa registrando l'acconto dalla pastiglia dello stato, chiudendo
//  la vendita e incassando il saldo.
import { MODO_IVA_PREDEFINITO, ScegliIva, conIvaBool, contoIva, type ModoIva } from "./iva";
/*  I mattoncini dei campi (Campo, Scelta, le classi dei controlli), le
 *  scorciatoie e la schermata della consegna vivono in SchedaCliente perché
 *  servono identici alle due facce della scheda: qui si importano, non si
 *  ricopiano. L'import va in una direzione sola — LeadDialog → SchedaCliente —
 *  così non nasce un ciclo. */
import {
  CLASSI_AREA,
  CLASSI_CAMPO,
  CLASSI_SELECT,
  Campo,
  GRIGLIA,
  Scelta,
  SchedaPostVendita,
  ScorciatoieFinestra,
  trattativaVinta,
  useSalvaConTastiera,
} from "./SchedaCliente";
import { StoricoAcquisti } from "./StoricoAcquisti";
/*  La tabella del «quando» sta in un file suo: la leggono anche la ricerca ⌘K
 *  e il selettore di stato, e finché viveva qui dentro erano costretti a
 *  ricopiarsela. Vedi crm/quando-per-stato.ts. */
import { QUANDO_PER_STATO, SPOSTA_CONSULENZA, type RichiestaQuando } from "./quando-per-stato";
/*  IL SELETTORE DI STATO È UNO SOLO IN TUTTO IL CRM. L'import va in una
 *  direzione sola — LeadDialog → SelettoreStatoDialog — e per questo la tabella
 *  del «quando» è uscita da qui: il selettore la legge per l'icona calendario,
 *  e se fosse rimasta in questo file i due si importerebbero a vicenda. */
import { PastigliaStato, etichettaDi } from "./SelettoreStatoDialog";
import {
  generateAvailability,
  slotDelGiorno,
  type DaySlots,
  type SlotConStato,
} from "./booking-utils";
import { TastoMessaggio } from "./TastoMessaggio";
import { BloccoAnagrafica } from "./DatiAnagrafici";
import {
  buildMeetReminderMessage,
  buildWhatsAppLink,
  getWhatsAppMessageForStatus,
  linkStanzaDi,
  etichettaPromemoria,
  promemoriaUtile,
} from "./whatsapp";
import { AnteprimeLead, type AnteprimaSalvata } from "./AnteprimeLead";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Pencil,
  Percent,
  Phone,
  Receipt,
  RotateCcw,
  Bell,
  UserIcon,
  Wallet,
  Lock,
  Trash2,
} from "lucide-react";
//  Le righe non modificabili di chi è già ricomparso in una lista: la regola —
//  e il modo di contare le volte — sta tutta nel modulo.
import { righeRicarico } from "@/crm/importa/ricarico";
//  ⚠️ La finestra dei preventivi di una persona è UNA in tutto il CRM
//   (crm/preventivi/DelLead), la stessa che si apre dall'elenco Trattative:
//   due elenchi «i suoi preventivi» con due regole di aggancio diverse
//   direbbero, per la stessa persona, due cose diverse.
import { PulsantePreventivi } from "@/crm/preventivi/DelLead";
//  Le registrazioni delle consulenze fatte a questa persona: la scheda lo
//  prometteva («Preventivo, slide e registrazione restano legati a questo
//  lead») e non c'era modo di vederle. Vedi crm/RegistrazioniDelLead.
import { RegistrazioniDelLead } from "@/crm/RegistrazioniDelLead";
import { LeadJourneyCard } from "./LeadJourneyCard";
import { intestazioniCRM, usePuo } from "./AuthContext";
//  Il link della stanza con dentro CHI lo riceve: un link per ciascuno.
import { gettoneDi } from "./fascia-consulenza";
import { linkPerPersona } from "@/shop/chi-dal-link";
//  La spunta «quest'ora solo per questa persona»: la stessa di tutto il CRM.
import { SpuntaSoloUnaPersona, useModiFascia } from "@/crm/ModoDellaFascia";
//  «Questo numero ce l'abbiamo già»: la regola sta lì, con il suo perché.
import { avvisoDoppione, chiaveTelefono, schedeConLoStessoNumero } from "@/crm/telefono-doppio";

/*  LA FIRMA NON CAMBIA: questa finestra è aperta da undici punti diversi
 *  (elenco lead, dashboard, agenda, WhatsApp, ricerca ⌘K, installazioni,
 *  report). Due di loro passano `prefill`, in due forme diverse: l'agenda dà
 *  consulente + giorno + ora di uno slot vuoto, WhatsApp dà telefono + nome di
 *  un numero sconosciuto. Il wizard le riconosce entrambe. */
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead | null;
  prefill?: Partial<LeadData>;
  /** ── ⚠️ LA SCHEDA APERTA DA DENTRO UN'ALTRA SCHEDA ────────────────────
   *  Quando si apre la scheda del doppione, quella scheda troverebbe come
   *  doppione proprio quella da cui si è partiti — e aprirebbe un avviso
   *  dentro un avviso, all'infinito. Qui il controllo si spegne: su quella
   *  scheda il numero è il suo, e lo si è aperta apposta sapendolo. */
  nidificata?: boolean;
}

const FONTI: LeadFonte[] = ["ADV", "Organico", "Passa parola", "Store"];
const PAIN_OPTS = ["Invisibilità", "Resistenza sport/vita attiva", "Aspetto naturale"];
const DURATE = [15, 30, 45, 60, 90];
/*  La durata predefinita è la stessa che booking-utils assume quando una scheda
 *  non ne porta una: se qui fosse diversa, la griglia degli orari offrirebbe
 *  slot che l'agenda considera di un'altra lunghezza. */

/** Il lead appena nato. Lo stato di partenza è «Da contattare» e non
 *  «Appuntamento fissato» come prima: un contatto che arriva da WhatsApp o
 *  dalla ricerca non ha nessun appuntamento, e nascere già "fissato" faceva
 *  comparire in agenda righe senza data. Chi apre dallo slot dell'agenda passa
 *  lo stato giusto nel prefill. */
const nuovo = (): LeadData => ({
  nome: "",
  cognome: "",
  telefono: "",
  email: "",
  citta: "",
  fonte: "ADV",
  consulenteId: null,
  stato: "da_contattare",
  highlighted: false,
  createdAt: new Date().toISOString(),
});

/* ── LA PORTA D'INGRESSO DEI DATI ──────────────────────────────────────────
   Il tipo dice `string`, l'archivio no: nelle schede importate `nome` arriva
   `null` e `telefono` arriva NUMERO. Sono i due campi su cui questa finestra
   chiama `.trim()` e `.replace()` mentre disegna — cioè PRIMA che qualcuno
   tocchi qualcosa — e un `.trim is not a function` lì dentro non rompe un
   campo: fa sparire l'intera scheda del contatto, esattamente come è già
   successo con le pause del consulente. Quindi ogni testo che entra passa da
   qui, e chi lo legge non deve più chiedersi di che forma sia. */
function testo(v: unknown): string {
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

/** I campi di testo del modulo, riportati alla forma dichiarata. Si tocca solo
 *  quello che serve: gli altri campi vengono letti sempre con `||` o con
 *  `Array.isArray`, e riscriverli tutti significherebbe salvare in archivio
 *  valori che nessuno ha modificato. */
function normalizza(d: LeadData): LeadData {
  return {
    ...d,
    nome: testo(d.nome),
    cognome: testo(d.cognome),
    telefono: testo(d.telefono),
    email: testo(d.email),
    citta: testo(d.citta),
  };
}

/** Il nome del consulente, letto senza dare per scontato che la scheda del
 *  consulente sia completa: una riga senza `data` è bastata a far cadere una
 *  finestra intera, e qui il nome compare in cinque punti diversi. */
function nomeConsulente(c?: Consultant): string {
  return testo(c?.data?.nome);
}

/* ── PICCOLE UTILITÀ DI DATA ───────────────────────────────────────────────
   `toISOString()` non si usa per le date "da calendario": converte in UTC e la
   mezzanotte italiana diventa le 22 del giorno prima, cioè il giorno sbagliato.
   Stessa scelta fatta in booking-utils. */
function isoOggi(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoToDateInput(iso?: unknown): string {
  //  `createdAt` è dichiarato stringa ISO ma dagli archivi arriva anche come
  //  numero (millisecondi): `.slice` su un numero è un errore di render.
  return testo(iso).slice(0, 10);
}

/** «2026-08-14» + «15:30» → «Ven 14 Ago · 15:30». Una data ISO nuda si legge,
 *  ma non si controlla — e quello che si controlla al telefono è il giorno
 *  della settimana.
 *  DUE FORME, UNA REGOLA: questa breve sta dove lo spazio è una riga sola e il
 *  testo è troncato (titoli, note delle sezioni); `quandoInChiaro`, per esteso,
 *  sta dove la data va CONFERMATA prima di scriverla. Non sono due stili: la
 *  seconda è più lenta da leggere, ed è esattamente quello che serve quando si
 *  deve controllare. */
const GIORNI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
function quandoLeggibile(data?: unknown, ora?: unknown): string {
  const giorno = testo(data).slice(0, 10);
  const orario = testo(ora);
  if (!giorno) return "";
  const d = new Date(`${giorno}T12:00:00`);
  if (isNaN(d.getTime())) return orario ? `${giorno} · ${orario}` : giorno;
  const etichetta = `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
  return orario ? `${etichetta} · ${orario}` : etichetta;
}

/** La stessa data, ma detta come si dice al telefono: «giovedì 21 agosto, ore
 *  15:30». Serve alla riga di conferma della finestrella del quando — una data
 *  in cifre si legge, ma non si CONTROLLA, e quello che si controlla mentre si
 *  parla è il giorno della settimana. */
const GIORNI_LUNGHI = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
];
const MESI_LUNGHI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];
function quandoInChiaro(data?: unknown, ora?: unknown): string {
  const giorno = testo(data).slice(0, 10);
  const orario = testo(ora).slice(0, 5);
  if (!giorno) return "";
  const d = new Date(`${giorno}T12:00:00`);
  if (isNaN(d.getTime())) return orario ? `${giorno}, ore ${orario}` : giorno;
  const etichetta = `${GIORNI_LUNGHI[d.getDay()]} ${d.getDate()} ${MESI_LUNGHI[d.getMonth()]}`;
  return orario ? `${etichetta}, ore ${orario}` : etichetta;
}

/** «fra 8 giorni», «domani», «3 giorni fa». La distanza è l'unica cosa che dice
 *  se la data scelta è quella giusta: «21 agosto» da solo non lo dice. */
function distanzaInChiaro(data?: unknown): string {
  const giorno = testo(data).slice(0, 10);
  if (!giorno) return "";
  const d = new Date(`${giorno}T12:00:00`);
  if (isNaN(d.getTime())) return "";
  const oggi = new Date();
  oggi.setHours(12, 0, 0, 0);
  const g = Math.round((d.getTime() - oggi.getTime()) / 86_400_000);
  if (g === 0) return "oggi";
  if (g === 1) return "domani";
  if (g === -1) return "ieri";
  return g > 0 ? `fra ${g} giorni` : `${-g} giorni fa`;
}

/** La data di N giorni dopo `base` (o dopo oggi), nel formato del campo date. */
function fraGiorni(n: number, base?: string): string {
  const d = testo(base).slice(0, 10)
    ? new Date(`${testo(base).slice(0, 10)}T12:00:00`)
    : new Date();
  if (isNaN(d.getTime())) return isoOggi();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ── IN CHE MOMENTO È QUESTO LEAD ──────────────────────────────────────────
   Non è lo "stato": lo stato dice dov'è la pratica, il momento dice cosa serve
   ADESSO a chi ha appena aperto la finestra. Da qui esce l'unico blocco che si
   vede per primo, e non c'è nessun altro punto del file che decide cosa
   mostrare. */
/** ── LA PRIMA CHIAMATA, E SOLO QUELLA ─────────────────────────────────────
 *  ⚠️ «Ricontatto fissato» (`da_ricontattare`) STAVA QUI DENTRO, ed era il
 *   difetto segnalato dal committente: su un lead già sentito, con un richiamo
 *   concordato, la scheda mostrava ancora gli esiti della PRIMA telefonata —
 *   «Ha risposto → fissa l'appuntamento», «Segreteria», «Non risponde» — come
 *   se nessuno gli avesse mai parlato. Quella fase è passata, e una schermata
 *   che la ripropone fa perdere tempo a chi la legge e insegna a ignorarla.
 *  Qui restano i quattro stati in cui il numero non ha ancora risposto a
 *  nessuno; il richiamo ha un blocco suo (`BloccoRichiamo`). */
const STATI_CHIAMATA = new Set<LeadStatus>([
  "da_contattare",
  "non_risponde",
  "segreteria",
  "richiamo",
]);

/** ── SI TELEFONA ANCORA, MA NON È PIÙ LA PRIMA VOLTA ──────────────────────
 *  Il cliente ha già parlato con qualcuno: c'è un richiamo concordato, un meet
 *  da fissare, una chat aperta, o non si riesce più a prenderlo. Il gesto è
 *  sempre una telefonata, ma gli esiti sono altri — «richiama più avanti» qui
 *  vuol dire qualcosa, «segreteria» molto meno. */
/*  ⚠️ SOLO DUE. «Meet da fissare», «In valutazione», «Lead in chat» e «Attesa
    acconto» usano GIÀ questo blocco, montato più sotto con i loro titoli: qui
    ci vanno i due che ne erano rimasti fuori — «Ricontatto fissato», che
    prendeva gli esiti della prima chiamata, e «Irreperibile», che non aveva
    nessun posto dove segnare un tentativo. */
const STATI_RICHIAMO = new Set<LeadStatus>(["da_ricontattare", "irreperibile"]);
/*  Stati che vivono DOPO la consulenza: quello che serve è il denaro, non
 *  l'agenda. `fissa_meet_dopo` non sta qui — è un richiamo per fissare. */
const STATI_TRATTATIVA = new Set<LeadStatus>([
  "fatto",
  "in_attesa_acconto",
  "sta_valutando",
  "gestire_in_chat",
]);
/*  Gli esiti di un appuntamento. `no_show` («Cliente assente») è quello che si
 *  assegna oggi; `non_fatto` è lo stesso fatto scritto con la vecchia parola e
 *  vive solo nelle schede storiche — vanno trattati insieme, qui come ovunque,
 *  altrimenti una consulenza segnata come «Cliente assente» risulta ancora «da
 *  fare» e la scheda continua a chiedere l'esito. */
const STATI_ESITO = new Set<LeadStatus>(["fatto", "no_show", "non_fatto", "da_spostare"]);
/*  Stati che si portano dietro una data di RICONTATTO e nessun appuntamento:
 *  senza un campo dedicato quella data non si potrebbe più scrivere da qui. */
const STATI_RICONTATTO = new Set<LeadStatus>([
  "sta_valutando",
  "gestire_in_chat",
  "in_attesa_acconto",
  //  «Visita in sede disdetta» non è un lead perso: è una visita da riprendere,
  //  e senza una data di richiamo non la riprende più nessuno.
  "sede_disdetta",
]);

/* ── LA TABELLA DEL «QUANDO» NON VIVE PIÙ QUI ──────────────────────────────
   Stava in questo file e non era esportata, così CRM.tsx se n'era fatta una
   copia. Adesso è una sola, in crm/quando-per-stato.ts, e la leggono la scheda,
   la ricerca ⌘K e il selettore di stato (che ci disegna sopra il calendario).
   Il criterio — «uno stato chiede la data quando promette un momento» — e
   l'elenco di chi NON la chiede stanno lì, insieme alla tabella.            */

/*  Una data nuova sulla consulenza NON deve cambiare questi stati: la
 *  consulenza è già stata fatta, il lead è già venduto, o la data è quella
 *  della visita in sede. Tutti gli altri — «Da riprogrammare», «Cliente
 *  assente», un perso che si recupera — tornano «Appuntamento fissato», che è
 *  quello che è appena successo davvero. */
//  ⚠️ "venduto" e "acconto" da soli non bastavano più: le tre chiusure di oggi
//   sono altrettanti lead già venduti, e senza di loro fissare una data di
//   consulenza su una pratica appena chiusa la riportava ad «Appuntamento
//   fissato» — cioè annullava la vendita per aver scritto una data. Si legge da
//   `STATI_VINTI` di types.ts, che è l'elenco unico.
const STATI_CHE_TENGONO_LO_STATO = new Set<LeadStatus>(["fatto", ...STATI_VINTI, "viene_in_sede"]);

/** ── L'UNICA PORTA DELLA DATA DI CONSULENZA ───────────────────────────────
 *  Ci passano tutti e tre i modi di fissarla — lo slot libero, i due campi
 *  manuali, la finestrella del «quando» — perché data, ora, durata e stato sono
 *  un dato solo: scriverne uno e dimenticare gli altri è il guasto n. 4 della
 *  lista qui in cima (la consulenza spostata che restava «da riprogrammare»). */
function fissaConsulenza(
  form: LeadData,
  update: Update,
  data: string,
  ora: string,
  durata?: number,
) {
  update("dataMeeting", data || undefined);
  update("oraMeeting", ora || undefined);
  //  La durata si fissa insieme allo slot: senza, l'appuntamento veniva mandato
  //  al server con una durata diversa da quella su cui la griglia lo aveva
  //  calcolato, e in agenda occupava un'altra fascia.
  if (durata && !form.durataMeeting) update("durataMeeting", durata);
  if (data && ora && !STATI_CHE_TENGONO_LO_STATO.has(form.stato)) {
    update("stato", "appuntamento_fissato");
  }
}

export function LeadDialog({ open, onOpenChange, lead, prefill, nidificata }: Props) {
  const { consultants, createLead, updateLead, deleteLead, leads: allLeads } = useCRM();
  //  Chi può eliminare: il pulsante non compare a chi poi si sentirebbe dire
  //  «non puoi» (vedi crm/permessi).
  const puo = usePuo();
  const [form, setForm] = useState<LeadData>(nuovo());
  const [salvataggio, setSalvataggio] = useState(false);
  /** Passo del wizard (0-3). Vale solo a lead nuovo. */
  const [passo, setPasso] = useState(0);
  /** Il lead creato dal wizard: finché è null, «Manda la conferma» resta
   *  spento. Prima si poteva mandare al cliente la conferma di un appuntamento
   *  che il salvataggio poi rifiutava. */
  const [creato, setCreato] = useState<Lead | null>(null);
  /** La catena dell'appuntamento aperta a mano (tasto «Sposta» / «Fissa»). */
  const [catenaAperta, setCatenaAperta] = useState(false);
  /** La finestrella del «quando», aperta subito dopo uno stato che promette una
   *  data (o dal tasto «Sposta»). `null` = chiusa. */
  const [quando, setQuando] = useState<RichiestaQuando | null>(null);
  const [altriDati, setAltriDati] = useState(false);
  /** C'è qualcosa scritto che non è ancora in archivio. Serve al passo finale
   *  del wizard: dopo il primo salvataggio il tasto diventava «Fine», e chi
   *  toccava una riga del riepilogo per correggere il telefono, correggeva e
   *  poi premeva «Fine» perdeva la correzione SENZA che nessuno glielo
   *  dicesse. Ora finché c'è qualcosa da salvare il tasto lo dice. */
  const [modificato, setModificato] = useState(false);

  //  Servono a portare il cursore SUL campo che ha bloccato il salvataggio:
  //  un messaggio che dice "manca il motivo" senza dire dov'è costa una
  //  ricerca a occhio in mezzo alla finestra.
  const rifNome = useRef<HTMLInputElement>(null);
  const rifTelefono = useRef<HTMLInputElement>(null);
  const rifMotivo = useRef<HTMLSelectElement>(null);

  /* ── L'APERTURA LEGGE LA SORGENTE UNA VOLTA SOLA ────────────────────────
     L'effetto di riempimento dipende da `open` e dall'ID del lead, MAI
     dall'oggetto `prefill`: un chiamante che passasse un oggetto letterale
     ricreerebbe la sua identità a ogni render del genitore e il modulo si
     azzererebbe sotto le dita — con il wizard, che tiene anche il passo, si
     ricomincerebbe da capo a metà compilazione. Le due sorgenti si leggono da
     un riferimento sempre aggiornato. */
  const sorgente = useRef({ lead, prefill });
  useEffect(() => {
    sorgente.current = { lead, prefill };
  });

  //  La chiave è l'ID, non l'oggetto: dopo un salvataggio il lead torna
  //  aggiornato dal contesto con una nuova identità, e ricaricare il modulo su
  //  quella cancellerebbe quello che si sta scrivendo in quel momento.
  const idLead = lead?.id ?? null;
  useEffect(() => {
    if (!open) return;
    const { lead: l, prefill: pf } = sorgente.current;
    //  `{...nuovo(), ...l.data}` NON basta a garantire i tipi: una chiave
    //  presente e messa a `null` in archivio sovrascrive il valore vuoto di
    //  partenza, e il `null` arriva intatto fino a `.trim()`. Da qui in giù il
    //  modulo è della forma che dichiara.
    setForm(normalizza(l ? { ...nuovo(), ...l.data } : { ...nuovo(), ...(pf ?? {}) }));
    setPasso(0);
    setCreato(null);
    setCatenaAperta(false);
    setQuando(null);
    setAltriDati(false);
    setModificato(false);
  }, [open, idLead]);

  //  Ogni scrittura sul modulo passa da una di queste tre porte, e tutte e tre
  //  segnano che c'è qualcosa da salvare.
  const update = <K extends keyof LeadData>(k: K, v: LeadData[K]) => {
    setModificato(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  /* ── STATO E DATA SONO UN GESTO SOLO ───────────────────────────────────
     Lo stato si scrive subito (la scheda si ricalcola sotto gli occhi), e se
     quello stato promette un momento la finestrella lo chiede all'istante:
     chiederlo dopo significa non chiederlo mai. Chi la chiude senza data trova
     comunque il campo aperto nel blocco qui sotto — la finestrella è una
     scorciatoia, non un pedaggio. */
  const cambiaStato = (s: LeadStatus) => {
    update("stato", s);
    const richiesta = QUANDO_PER_STATO[s];
    if (richiesta) setQuando(richiesta);
  };

  /** Conferma della finestrella: scrive nei DUE campi nominati dalla richiesta,
   *  mai in campi decisi dallo stato corrente. */
  /** ── SPOSTARE UN APPUNTAMENTO SALVA SUBITO ─────────────────────────────
   *  ⚠️ QUI LO SPOSTAMENTO NON SI SALVAVA, ed è il difetto segnalato dal
   *   committente: «all'inizio sembra che lo sposta, poi ritorna come prima».
   *   Questa funzione scriveva solo nella BOZZA e lasciava un messaggio
   *   «Ricordati di salvare» — chiudendo la scheda, o premendo Esc, la data
   *   nuova spariva. Ed è il gesto meno adatto del CRM a chiedere un secondo
   *   passaggio: si fa col cliente al telefono che sta dicendo «facciamo
   *   giovedì», e chi riattacca la scheda la chiude.
   *   Peggio: la data era già cambiata a schermo, quindi il ritorno indietro
   *   non si vedeva subito ma il giorno dopo, con il cliente che si presenta
   *   quando non lo aspetta più nessuno.
   *  Su un lead che in archivio non c'è ancora (il wizard del lead nuovo) non
   *  si può scrivere: lì resta la bozza, e il salvataggio finale è il passo
   *  successivo della procedura — che infatti si vede. */
  const confermaQuando = async (data: string, ora: string) => {
    if (!quando) return;
    const patch: Partial<LeadData> = {};
    if (quando.chiaveData === "dataMeeting") {
      fissaConsulenza(form, update, data, ora, DURATA_PREDEFINITA);
      patch.dataMeeting = data || undefined;
      patch.oraMeeting = ora || undefined;
      if (DURATA_PREDEFINITA && !form.durataMeeting) patch.durataMeeting = DURATA_PREDEFINITA;
      if (data && ora && !STATI_CHE_TENGONO_LO_STATO.has(form.stato)) {
        patch.stato = "appuntamento_fissato";
      }
    } else {
      update(quando.chiaveData, data || undefined);
      update(quando.chiaveOra, ora || undefined);
      (patch as Record<string, unknown>)[quando.chiaveData] = data || undefined;
      (patch as Record<string, unknown>)[quando.chiaveOra] = ora || undefined;
    }
    setQuando(null);
    const leggibile = quandoInChiaro(data, ora);
    //  Lead nuovo: non c'è una riga in archivio su cui scrivere.
    if (!lead?.id) {
      if (leggibile) {
        toast.success(`Segnato: ${leggibile}`, { description: "Si salva alla fine della scheda." });
      }
      return;
    }
    //  ⚠️ La risposta si legge: `updateLead` torna `false` anche senza errore
    //   di rete, e un «spostato» su una scrittura mai avvenuta rifarebbe
    //   esattamente il guasto che questa riga esiste per chiudere.
    if (!(await updateLead(lead.id, patch))) {
      toast.error("Spostamento NON salvato", {
        description: "In archivio è rimasta la data di prima. Riprova.",
      });
      return;
    }
    toast.success(leggibile ? `Spostato: ${leggibile}` : "Spostato", {
      description: "Salvato in archivio.",
    });
  };

  /* ── IL DENARO SI SCRIVE SEMPRE INTERO ─────────────────────────────────
     Prezzo, incassato, saldo e stato del pagamento sono quattro facce dello
     stesso numero: toccarne uno solo produceva schede con "pagato interamente"
     e il saldo ancora aperto. Stessa regola della schermata di consegna. */
  const patchPagamento = (patch: Partial<PaymentInfo>) => {
    setModificato(true);
    setForm((f) => {
      const next: PaymentInfo = { ...f.payment, ...patch };
      const prezzo = Number(next.prezzoFinaleVendita) || Number(next.prezzoTotale) || 0;
      const acconto = Number(next.accontoPagato) || 0;
      next.saldoRimanente = Math.max(0, prezzo - acconto);
      next.statoPagamento =
        acconto <= 0
          ? "nessun_pagamento"
          : acconto >= prezzo && prezzo > 0
            ? "pagato_interamente"
            : "acconto_ricevuto";
      return { ...f, payment: next };
    });
  };

  /* ── LA BOZZA, VISTA COME UN LEAD ──────────────────────────────────────
     Prossima azione, messaggio WhatsApp e storico acquisti ragionano su un
     Lead, non su un modulo: se ne costruisce UNO solo con dentro quello che si
     sta scrivendo, così l'anteprima del messaggio cambia mentre si sposta la
     data, senza salvare. */
  const bozza = useMemo<Lead>(
    () => ({
      id: lead?.id ?? "bozza",
      user_id: lead?.user_id ?? "",
      data: form,
      created_at: lead?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    [lead, form],
  );
  const salvaStorico = (patch: Partial<LeadData>) => {
    setModificato(true);
    setForm((f) => ({ ...f, ...patch }));
  };

  //  L'elenco arriva dal contesto e in teoria è sempre un array; in pratica un
  //  caricamento a metà o un archivio importato ci hanno già messo dentro
  //  altro, e `.find`/`.map` su un non-array è la finestra che non si apre.
  const elencoConsulenti = Array.isArray(consultants) ? consultants : [];
  const elencoLead = Array.isArray(allLeads) ? allLeads : [];
  const consulente = elencoConsulenti.find((c) => c?.id === form.consulenteId);
  const nomeCompleto = `${testo(form.nome)} ${testo(form.cognome)}`.trim();

  /*  ── ⚠️ QUESTO NUMERO CE L'ABBIAMO GIÀ ────────────────────────────────
      Richiesta del committente: «se aggiungo un numero di telefono che già è
      presente nel CRM segna rosso il campo del numero, e si apre un popup per
      andare a vedere la scheda del lead».
      È l'unico momento in cui accorgersene costa zero: dopo, la stessa persona
      ha due storie e quella vecchia — note, tentativi, preventivo,
      appuntamento mancato — non la guarda più nessuno.
      La regola di quando due numeri sono «lo stesso» sta in crm/telefono-doppio
      (ultime nove cifre), ed è la stessa dell'importazione: due idee diverse di
      «stesso numero» sono due archivi che non coincidono.
      ⚠️ NON BLOCCA NIENTE: due persone possono davvero condividere un numero
       (madre e figlia, due coniugi, un centralino). Si dice, non si impedisce. */
  const doppioni = useMemo(
    () =>
      nidificata
        ? []
        : schedeConLoStessoNumero({
            telefono: form.telefono,
            schede: elencoLead,
            escludiId: lead?.id,
          }),
    [nidificata, form.telefono, elencoLead, lead?.id],
  );
  const [doppioneAperto, setDoppioneAperto] = useState<Lead | null>(null);
  /*  ── ⚠️ ELIMINARE UN LEAD DA QUI ───────────────────────────────────────
      Richiesta del committente: «cliccando sulla scheda lead, dentro ci sia
      anche il pulsante per eliminare il lead».
      Finora si poteva solo dall'ELENCO: si apriva la scheda per guardare chi
      era, si decideva che non serviva più, e bisognava chiuderla, ritrovare la
      riga e premere lì — cioè cercare due volte la stessa persona.
      ⚠️ NON SI ELIMINA CON UN TOCCO SOLO, e non è prudenza generica: una
       scheda eliminata porta via le note, i tentativi, i preventivi e la
       storia, e non c'è nessun cestino da cui ripescarla. Il primo tocco
       CHIEDE, il secondo fa — e la domanda dice il nome di chi sta per
       sparire, perché la finestra può essere aperta da un'ora. */
  const [chiedoElimina, setChiedoElimina] = useState(false);
  const eliminoAdesso = async () => {
    if (!lead?.id) return;
    setSalvataggio(true);
    const fatto = await deleteLead(lead.id);
    setSalvataggio(false);
    setChiedoElimina(false);
    if (!fatto) return;
    toast.success(`${nomeCompleto || "Il lead"} non è più in archivio`, {
      description: "Eliminato per sempre: non c'è un cestino da cui ripescarlo.",
    });
    onOpenChange(false);
  };
  const [avvisoDoppioneAperto, setAvvisoDoppioneAperto] = useState(false);
  /*  ⚠️ LA FINESTRA SI APRE UNA VOLTA PER NUMERO, non a ogni tasto premuto:
      si apre quando l'IMPRONTA del numero cambia e trova qualcosa. Senza
      questo, cancellando una cifra e riscrivendola la finestra tornerebbe su
      mentre si sta ancora scrivendo. */
  const chiaveVista = useRef("");
  useEffect(() => {
    const chiave = chiaveTelefono(form.telefono);
    if (chiave === chiaveVista.current) return;
    chiaveVista.current = chiave;
    if (chiave && doppioni.length) setAvvisoDoppioneAperto(true);
  }, [form.telefono, doppioni.length]);

  /** Le anteprime che questa persona si è salvata dalla prova capelli.
   *  ⚠️ Lettura difensiva: schede vecchie non hanno il campo, e una scheda
   *   lead che esplode per una fotografia mancante è la finestra più usata del
   *   gestionale che smette di aprirsi. */
  const anteprimeSalvate = useMemo<AnteprimaSalvata[]>(() => {
    const dentro = (lead?.data as { provaCapelli?: { anteprime?: unknown } } | undefined)
      ?.provaCapelli?.anteprime;
    return Array.isArray(dentro) ? (dentro as AnteprimaSalvata[]) : [];
  }, [lead]);

  const messaggioWhatsApp = useMemo(() => {
    if (!form.telefono) return null;
    try {
      return getWhatsAppMessageForStatus(bozza, nomeConsulente(consulente));
    } catch {
      //  I modelli dei messaggi sono personalizzabili e vivono fuori da qui:
      //  un modello rotto non deve impedire di aprire la scheda.
      return null;
    }
  }, [bozza, consulente, form.telefono]);

  /** ── ⚠️ IL SECONDO TASTO: IL PROMEMORIA ────────────────────────────────
   *  Il primo manda il messaggio dello STATO, che per ogni stato è già quello
   *  giusto. Questo manda il promemoria dell'appuntamento, con giorno, ora e
   *  link: è l'altra cosa che si scrive venti volte al giorno, e per averla
   *  bisognava passare da un'altra pagina.
   *  ⚠️ C'è solo dove c'è una data di appuntamento — senza, il promemoria
   *   arriverebbe con la data vuota — e solo se dice una cosa DIVERSA dal
   *   primo: su un appuntamento appena fissato il messaggio dello stato è già
   *   la conferma con giorno e link, e due tasti gemelli non sono una scelta. */
  const messaggioPromemoria = useMemo(() => {
    //  ⚠️ Non basta che una data ci sia: vedi `promemoriaUtile`. Ricordare un
    //   appuntamento già avvenuto lo fa sembrare saltato.
    if (!form.telefono || !promemoriaUtile(bozza.data, oggiIso())) return null;
    try {
      const testo = buildMeetReminderMessage(bozza, nomeConsulente(consulente));
      return testo === messaggioWhatsApp ? null : testo;
    } catch {
      return null;
    }
  }, [bozza, consulente, form.telefono, messaggioWhatsApp]);

  /* ── IL MOMENTO ─────────────────────────────────────────────────────── */
  const oggi = isoOggi();
  const postVendita = trattativaVinta(form);
  const perso = LOST_STATUSES.includes(form.stato);
  const haAppuntamento = !!(form.dataMeeting && form.oraMeeting);
  //  «<=» e non «<»: l'esito di una consulenza si segna il giorno stesso,
  //  spesso mezz'ora dopo che è finita. Il confronto è fra due stringhe
  //  «AAAA-MM-GG»: se la data arrivasse in un'altra forma, `testo()` la rende
  //  comunque confrontabile invece di far confrontare un oggetto.
  const appuntamentoPassato = haAppuntamento && testo(form.dataMeeting).slice(0, 10) <= oggi;
  const esitoSegnato = STATI_ESITO.has(form.stato);
  const daChiamare = STATI_CHIAMATA.has(form.stato);
  const daRichiamare = STATI_RICHIAMO.has(form.stato);
  const inTrattativa = STATI_TRATTATIVA.has(form.stato);

  /* ── AVVIARE LA VIDEOCONSULENZA NON SI FA PIÙ DA QUI ───────────────────
     Il tasto c'era in due blocchi di questa finestra e faceva esattamente
     quello che fanno la riga dell'elenco e il riquadro «Adesso»: `avviaConsulenza`
     (MeetGiornalieri) apre la stanza di QUELL'appuntamento con dentro i dati del
     lead. Chi ha la consulenza adesso la fa partire da lì — dalla pagina Oggi,
     dall'agenda del giorno o dalla riga dell'elenco trattative (anche col tasto
     «V») — senza aprire nessuna scheda. Qui era una terza porta sulla stessa
     stanza, e teneva in vita `puoAvviareConsulenza`, `consulenzaDiOggi` e
     l'import da MeetGiornalieri: sono spariti tutti insieme. */

  const prezzo = form.payment?.prezzoFinaleVendita || form.payment?.prezzoTotale || 0;
  const acconto = form.payment?.accontoPagato || 0;

  /*  La catena si apre da sola solo quando fissare È il lavoro: su un lead
   *  appena importato, mai chiamato, la prima cosa da fare è telefonare — non
   *  scegliere uno slot.
   *  Quando invece la si è aperta a mano si apre SEMPRE, anche su un lead
   *  perso: riprogrammare è esattamente quello che si fa con un «Cliente
   *  assente», e prima quel tasto non esisteva (guasto n. 3). */
  const mostraCatena =
    !postVendita &&
    (catenaAperta ||
      (!perso && !haAppuntamento && (eAppuntamento(form.stato) || form.stato === "da_spostare")));

  //  L'elenco degli stati non si compone più qui: lo fa `statiSelezionabili`
  //  dentro la pastiglia condivisa, con la stessa regola di sempre (statiPer,
  //  più lo stato attuale quando è uno storico come «Acconto incassato») e in
  //  un posto solo per tutto il CRM.

  //  Anche questo è un calcolo al montaggio su dati che arrivano dall'archivio
  //  (cinque date diverse, una dentro `installazione`): se una di loro ha una
  //  forma inattesa non deve portarsi via la scheda del contatto, tanto qui
  //  serve solo a scrivere «fra 3 giorni» accanto al titolo del blocco.
  const azione = useMemo<ReturnType<typeof prossimaAzione>>(() => {
    try {
      return prossimaAzione(bozza);
    } catch (e) {
      console.warn("[CRM] prossima azione non calcolabile", e);
      return {
        cosa: "—",
        quando: "",
        quandoBreve: "",
        giorno: "",
        ora: "",
        ritardo: 0,
        urgenza: 0,
        tono: "aperto",
      };
    }
  }, [bozza]);
  const isPriority = (form.qualifica?.disagio ?? 0) > 8 && form.qualifica?.urgenza === "si";

  /* ═════ SALVATAGGIO ══════════════════════════════════════════════════════
     Restituisce il lead salvato, oppure null. Chi chiama decide se chiudere:
     il wizard resta aperto per far mandare la conferma su WhatsApp. */
  const salva = async (): Promise<Lead | null> => {
    if (salvataggio) return null;

    //  IL MINIMO PER SALVARE È NOME + TELEFONO. Il cognome non blocca più:
    //  un lead con nome e numero è già utile, e obbligare a compilarlo faceva
    //  perdere contatti presi al volo.
    if (!testo(form.nome).trim()) {
      toast.error("Serve almeno il nome");
      rifNome.current?.focus();
      return null;
    }
    if (!testo(form.telefono).trim()) {
      toast.error("Serve il numero di telefono");
      rifTelefono.current?.focus();
      return null;
    }
    //  Regola nuova: un appuntamento senza consulente non entra in nessuna
    //  agenda e non fa nascere la stanza della consulenza. Prima il consulente
    //  era richiesto solo per «Viene in sede».
    if (form.dataMeeting && form.oraMeeting && !form.consulenteId) {
      toast.error("Scegli il consulente", {
        description: "Senza consulente l'appuntamento non entra in nessuna agenda.",
      });
      //  Nel wizard la catena vive dentro il PRIMO passo (l'appuntamento viene
      //  prima dei dati): aprirla senza portarci sopra chi sta compilando è un
      //  messaggio che indica un campo invisibile.
      if (!lead) setPasso(0);
      setCatenaAperta(true);
      return null;
    }
    if (form.stato === "viene_in_sede" && !form.consulenteId) {
      toast.error("Per «Appuntamento in sede» serve un consulente");
      return null;
    }

    let toSave = form;
    if (perso) {
      if (!form.lostReason) {
        toast.error("Dimmi perché è andato perso", {
          description: "Senza il motivo il lead non si può chiudere.",
        });
        rifMotivo.current?.focus();
        return null;
      }
      if (form.lostReason === "altro" && !form.lostReasonNote?.trim()) {
        toast.error("Descrivi brevemente il motivo");
        rifMotivo.current?.focus();
        return null;
      }
      if (!form.lostReasonAt) toSave = { ...form, lostReasonAt: new Date().toISOString() };
    }

    //  Un secondo clic mentre il primo è ancora in volo creava DUE lead
    //  identici: il pulsante si spegne finché non è finita.
    setSalvataggio(true);
    try {
      let salvato: Lead | null = null;
      //  ── SI CREA UNA VOLTA SOLA ────────────────────────────────────────
      //  Nel wizard `lead` resta null anche DOPO la creazione: chi salvava,
      //  tornava indietro dal riepilogo a correggere il telefono e salvava di
      //  nuovo si ritrovava DUE lead identici in archivio (e due sessioni di
      //  consulenza). Dal secondo salvataggio in poi il bersaglio è il lead
      //  appena creato.
      const esistente = lead ?? creato;
      if (esistente) {
        await updateLead(esistente.id, toSave);
        salvato = { ...esistente, data: toSave };
      } else {
        salvato = await createLead(toSave);
        //  Prima, quando `createLead` tornava null, non usciva NESSUN
        //  messaggio e la finestra si chiudeva lo stesso: il lead non era
        //  stato creato e chi lo aveva inserito credeva di sì.
        if (!salvato) {
          toast.error("Lead non creato", { description: "Riprova fra un istante." });
          return null;
        }
      }
      toast.success(esistente ? "Lead aggiornato" : "Lead creato");
      setCreato(salvato);
      setModificato(false);

      // ── L'APPUNTAMENTO NASCE GIÀ CON LA SUA STANZA ─────────────────────
      //  Appena ci sono consulente, data e ora la consulenza esiste: codice
      //  dedicato a QUESTO lead, link pronto, salvato sulla scheda. Non è un
      //  link a una stanza qualsiasi — è una sessione dell'applicazione, con
      //  dentro il preventivo che si compone in diretta, le slide, la
      //  registrazione. Non dipende da nessun calendario collegato.
      //  A lead vinto la consulenza è già avvenuta: chiamare il server a ogni
      //  salvataggio della consegna sarebbe lavoro per una stanza che non
      //  serve più a nessuno.
      if (!postVendita && toSave.consulenteId && toSave.dataMeeting && toSave.oraMeeting) {
        try {
          const r = await fetch("/api/crm/meeting-session", {
            method: "POST",
            //  Le credenziali servono: la rotta chiede il permesso «agenda», e
            //  una chiamata senza intestazioni riceve 401 — l'appuntamento si
            //  salverebbe senza la sua stanza di videoconsulenza.
            headers: await intestazioniCRM({ "Content-Type": "application/json" }),
            body: JSON.stringify({
              leadId: salvato.id,
              consultantId: toSave.consulenteId,
              quando: `${toSave.dataMeeting}T${toSave.oraMeeting}`,
              durata: toSave.durataMeeting || DURATA_PREDEFINITA,
            }),
          }).then((x) => x.json());
          //  L'anteprima del link della stanza si prepara adesso, che la stanza
          //  è appena nata e i dati dell'appuntamento sono qui davanti. Vale
          //  anche quando il link non cambia (stanza riusata): il biglietto
          //  potrebbe non essere mai stato depositato.
          if (r?.ok && r.code) {
            void depositaAnteprimaPerLead({ ...salvato, data: toSave }, String(r.code));
          }
          if (r?.ok && r.link && r.link !== toSave.linkMeeting) {
            const conLink = { ...toSave, linkMeeting: r.link as string };
            await updateLead(salvato.id, conLink);
            salvato = { ...salvato, data: conLink };
            setForm(conLink);
            setCreato(salvato);
            toast.success("Sessione di consulenza pronta", {
              description: "Il link è sulla scheda del lead.",
            });
          }
        } catch (e) {
          //  La stanza è un di più: se il server non risponde il lead resta
          //  salvato, e questo NON deve diventare un errore di salvataggio.
          console.warn("[CRM] sessione consulenza non creata", e);
        }
      }
      return salvato;
    } catch (e) {
      //  Prima non c'era `catch`: un errore di rete lasciava la finestra
      //  aperta senza dire niente, e chi salvava credeva fosse andata.
      console.error("[CRM] salvataggio lead non riuscito", e);
      toast.error("Salvataggio non riuscito", {
        description: e instanceof Error ? e.message : "Controlla la connessione e riprova.",
      });
      return null;
    } finally {
      setSalvataggio(false);
    }
  };

  const salvaEChiudi = async () => {
    const ok = await salva();
    if (ok) onOpenChange(false);
  };

  //  ⌘/Ctrl+↵ salva da qualunque campo, ed è scritto nel piede: una
  //  scorciatoia che non si vede non esiste.
  useSalvaConTastiera(open, () => void salvaEChiudi());

  /* ═════ WIZARD ═══════════════════════════════════════════════════════════ */
  const modoWizard = !lead;
  const puoAvanzare = !!testo(form.nome).trim() && !!testo(form.telefono).trim();

  const titolo = modoWizard
    ? "Nuovo lead"
    : postVendita
      ? "Consegna e installazione"
      : nomeCompleto || "Lead";

  return (
    <Finestra
      aperta={open}
      onCambio={onOpenChange}
      icona={postVendita ? PackageCheck : UserIcon}
      titolo={titolo}
      contesto={
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          {modoWizard ? (
            <span className="font-medium text-slate-700">
              Passo {passo + 1} di 4 · {PASSI[passo]}
            </span>
          ) : (
            <>
              <span className="font-medium text-slate-700">{nomeCompleto || "Senza nome"}</span>
              {form.citta && <span>{form.citta}</span>}
              {form.fonte && <span>{form.fonte}</span>}
            </>
          )}
          {/*  Il tracciamento pubblicitario in monospace stava qui e occupava
              la riga d'identità del cliente: serve all'attribuzione, una volta
              al mese, ed è finito in «Altri dati». */}
          {isPriority && (
            <Chip tono="in_sospeso" icona={AlertTriangle}>
              Priorità
            </Chip>
          )}
        </span>
      }
      larghezza="lg"
      azioni={
        modoWizard ? (
          <>
            <ScorciatoieFinestra />
            {passo > 0 && (
              <Button
                variant="outline"
                onClick={() => setPasso((p) => p - 1)}
                disabled={salvataggio}
              >
                <ChevronLeft className="h-4 w-4" /> Indietro
              </Button>
            )}
            {/*  Si salva anche a metà, da fine passo 1 in poi: un lead con
                nome e telefono è già lavorabile. */}
            {passo < 3 && puoAvanzare && (
              <Button variant="outline" onClick={() => void salvaEChiudi()} disabled={salvataggio}>
                {salvataggio ? "Salvataggio…" : "Salva ed esci"}
              </Button>
            )}
            {passo < 3 ? (
              <Button
                onClick={() => setPasso((p) => p + 1)}
                /*  ⚠️ IL BLOCCO SI È SPOSTATO CON I PASSI: adesso il primo è
                    l'appuntamento, e lì non serve sapere chi è — anzi, è tutto
                    il senso del nuovo ordine. Quello che non si può saltare è
                    USCIRE dai dati senza nome e telefono: senza quei due una
                    scheda non si salva e non si lavora. */
                disabled={passo === 1 && !puoAvanzare}
                className="sm:min-w-32"
              >
                Avanti <ChevronRight className="h-4 w-4" />
              </Button>
            ) : creato && !modificato ? (
              /*  «Fine» solo quando non c'è più niente da salvare: altrimenti
                  chiude una finestra con dentro una correzione mai scritta. */
              <Button onClick={() => onOpenChange(false)} className="sm:min-w-32">
                Fine
              </Button>
            ) : (
              <Button
                onClick={() => void salva()}
                disabled={salvataggio || !puoAvanzare}
                className="sm:min-w-32"
              >
                {salvataggio ? "Salvataggio…" : creato ? "Salva le modifiche" : "Salva il lead"}
              </Button>
            )}
          </>
        ) : (
          <>
            <ScorciatoieFinestra />
            {/*  ⚠️ Sta fra le scorciatoie e i tasti di uscita, cioè dove non
                dà fastidio: la scheda si apre col cliente al telefono e la
                prima cosa che serve è stato, numero e prossima azione. Le
                anteprime sono un tesoro quando ci sono, ma non sono la
                domanda per cui si apre questa finestra. */}
            <AnteprimeLead anteprime={anteprimeSalvate} />
            {/*  ── ELIMINA ──────────────────────────────────────────────────
                 A sinistra, staccato dai due tasti di uscita: è l'unico gesto
                 di questa finestra che non si può disfare, e non deve stare
                 accanto a «Salva» dove il pollice arriva per inerzia.
                 ⚠️ Compare solo su una scheda che esiste già (su un lead nuovo
                  non c'è niente da eliminare) e solo a chi ha il permesso: un
                  pulsante che poi dice «non puoi» è un pulsante che fa perdere
                  tempo due volte. */}
            {!!lead?.id && puo("lead.elimina") && (
              <Button
                variant="ghost"
                onClick={() => setChiedoElimina(true)}
                disabled={salvataggio}
                className="mr-auto text-red-700 hover:bg-red-50 hover:text-red-800"
                title="Elimina questa scheda: non si può disfare"
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Elimina
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvataggio}>
              Annulla
            </Button>
            <Button
              onClick={() => void salvaEChiudi()}
              disabled={salvataggio}
              className="sm:min-w-28"
            >
              {salvataggio ? "Salvataggio…" : "Salva"}
            </Button>
          </>
        )
      }
    >
      {modoWizard ? (
        <PassiWizard
          passo={passo}
          vaiAlPasso={setPasso}
          form={form}
          update={update}
          rifNome={rifNome}
          rifTelefono={rifTelefono}
          consultants={elencoConsulenti}
          allLeads={elencoLead}
          messaggioWhatsApp={messaggioWhatsApp}
          messaggioPromemoria={messaggioPromemoria}
          creato={creato}
          consulente={consulente}
          doppioni={doppioni}
          onVediDoppione={() => setAvvisoDoppioneAperto(true)}
        />
      ) : (
        <div className="space-y-3">
          {/* ═══ 1 · CHI È E COME LO RAGGIUNGO ═══
              Sempre per primo, sempre uguale, in qualunque momento sia il
              lead. I due tasti — chiamare e scrivere — esistono UNA volta
              sola in tutta la finestra: prima erano in cima e la conferma da
              mandare stava in fondo, e per una telefonata si attraversava la
              scheda due volte. */}
          <BloccoContatto
            form={form}
            update={update}
            rifNome={rifNome}
            rifTelefono={rifTelefono}
            messaggioWhatsApp={messaggioWhatsApp}
            messaggioPromemoria={messaggioPromemoria}
            compatto
            doppioni={doppioni}
            onVediDoppione={() => setAvvisoDoppioneAperto(true)}
          />

          {/* ═══ 2 · ADESSO ═══ */}
          {postVendita ? (
            /*  Il cliente ha pagato: il lavoro è la consegna. Questa schermata
                è già stata rifatta e verificata altrove — si importa e non si
                riscrive. Da lì si può anche annullare l'incasso: la scheda
                torna alla consulenza e questo blocco si ricalcola da solo,
                perché dipende dallo stato e non da una linguetta ricordata. */
            <>
              {/*  Sotto scudo: la consegna si calcola l'agenda dell'installatore
                  con lo STESSO `generateAvailability` che ha già fatto morire
                  questa finestra, dentro un `useMemo` al montaggio e senza rete
                  propria. Se cade, sotto restano i campi manuali della posa —
                  cioè il lavoro si può ancora fare. */}
              <Scudo
                dove="scheda consegna"
                ripiego={
                  <NotaFinestra tono="attenzione" icona={AlertTriangle}>
                    La schermata della consegna non si è caricata (dati di agenda o installazione in
                    una forma inattesa). Data e ora della posa si scrivono qui sotto; il resto della
                    scheda funziona.
                  </NotaFinestra>
                }
              >
                <SchedaPostVendita
                  form={form}
                  update={update}
                  consultants={elencoConsulenti}
                  allLeads={elencoLead}
                  currentLeadId={lead?.id}
                  //  ── LA VIA D'USCITA CHE PORTA FUORI DA QUESTA FINESTRA ──
                  //   Quando nessuno è segnato come installatore, il blocco
                  //   della posa offre di aprire l'anagrafica dei consulenti.
                  //   Quella pagina sta SOTTO questa finestra: senza chiuderla
                  //   prima si cambierebbe pagina per ritrovarsi davanti la
                  //   stessa scheda, con l'anagrafica nascosta dietro.
                  chiudiScheda={() => onOpenChange(false)}
                  storicoAcquisti={
                    <Scudo
                      dove="storico acquisti"
                      ripiego={
                        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
                          Lo storico acquisti non è leggibile. Il resto della consegna funziona.
                        </NotaFinestra>
                      }
                    >
                      <StoricoAcquisti lead={bozza} onSalva={salvaStorico} />
                    </Scudo>
                  }
                />
              </Scudo>
              <PosaManuale form={form} update={update} />
            </>
          ) : (
            <>
              {perso && <BloccoPerso form={form} update={update} rifMotivo={rifMotivo} />}

              {!perso && daChiamare && (
                <BloccoChiamata
                  form={form}
                  update={update}
                  onFissa={() => {
                    update("stato", "appuntamento_fissato");
                    setCatenaAperta(true);
                  }}
                />
              )}

              {/* ── IL RICHIAMO ─────────────────────────────────────────
                  ⚠️ SENZA GLI ESITI DELLA TELEFONATA, e la correzione è del
                  committente: qui gli
                  esiti NON ci vanno. Li avevo messi
                  pensando di dare uno strumento a chi richiama, ma quello
                  strumento c'è già ed è a due centimetri — il pulsante con i
                  cursori sulla riga di «Da fare oggi» (crm/dafare/AzioniLead)
                  segna esito, giorno del richiamo e nota senza nemmeno aprire
                  la scheda. Ripeterli qui vuol dire due porte per lo stesso
                  gesto, e su una riga già lavorata dall'una l'altra dice
                  ancora di farlo.
                  Resta quello che a questo stato serve davvero e che nessun
                  altro posto scrive: QUANDO risentirlo. Sono le stesse due
                  caselle che vedono «Meet da fissare», «In valutazione»,
                  «Trattativa in chat» e «Attesa acconto» — cioè tutti gli stati
                  dopo il setter si comportano allo stesso modo, ed è la
                  richiesta: la schermata delle chiamate è roba del setter. */}
              {!perso && daRichiamare && (
                <BloccoRichiamo
                  form={form}
                  update={update}
                  titolo={
                    form.stato === "irreperibile" ? "prova a riprenderlo" : "richiama il cliente"
                  }
                  nota={
                    form.stato === "irreperibile"
                      ? "Non risponde da un po': se lo riprendi, riparti da dove eravate rimasti."
                      : "Ci avete già parlato: qui si segna quando risentirlo."
                  }
                  onFissaOra={() => {
                    update("stato", "appuntamento_fissato");
                    setCatenaAperta(true);
                  }}
                />
              )}

              {/*  L'esito resta visibile ANCHE su un lead perso: «Cliente
                  assente» è un esito, e da lì si riprogramma o si corregge.
                  Prima sparivano insieme il blocco e ogni modo di rimettere
                  mano alla data (guasto n. 3). */}
              {haAppuntamento && (appuntamentoPassato || esitoSegnato) && (
                <BloccoConsulenzaPassata
                  form={form}
                  consulente={consulente}
                  onSposta={() => setQuando(SPOSTA_CONSULENZA)}
                  onCatena={() => setCatenaAperta(true)}
                />
              )}

              {!perso && haAppuntamento && !appuntamentoPassato && !esitoSegnato && (
                <BloccoAppuntamentoFissato
                  form={form}
                  consulente={consulente}
                  azione={azione}
                  onSposta={() => setQuando(SPOSTA_CONSULENZA)}
                  onCatena={() => setCatenaAperta(true)}
                />
              )}

              {!perso && form.stato === "fissa_meet_dopo" && (
                <BloccoRichiamo
                  form={form}
                  update={update}
                  titolo="Meet da fissare"
                  nota="Quando lo richiami per fissare la consulenza"
                  onFissaOra={() => setCatenaAperta(true)}
                />
              )}

              {/* ═══ 3 · LA CATENA DELL'APPUNTAMENTO ═══
                  Subito sotto il blocco che l'ha chiesta: chi preme «Ha
                  risposto → fissa» o «Vedi gli orari liberi» deve trovarsela
                  sotto le dita, non dopo il prezzo e i richiami. */}
              {mostraCatena && (
                <CatenaAppuntamento
                  form={form}
                  update={update}
                  consultants={elencoConsulenti}
                  allLeads={elencoLead}
                  currentLeadId={lead?.id}
                  onChiudi={haAppuntamento ? () => setCatenaAperta(false) : undefined}
                />
              )}

              {!perso && form.stato === "viene_in_sede" && (
                <BloccoInSede
                  form={form}
                  update={update}
                  consultants={elencoConsulenti}
                  conConsulente={!mostraCatena}
                />
              )}

              {!perso && (inTrattativa || prezzo > 0) && (
                <BloccoDenaro
                  form={form}
                  update={update}
                  patchPagamento={patchPagamento}
                  prezzo={prezzo}
                  acconto={acconto}
                />
              )}

              {/*  Dopo il denaro: quando lo risenti. Questi tre stati vivono di
                   richiami e la loro data non ha nessun altro campo in tutta la
                   finestra. */}
              {!perso && STATI_RICONTATTO.has(form.stato) && (
                <BloccoRichiamo
                  form={form}
                  update={update}
                  titolo="quando lo risenti"
                  nota="La data del ricontatto: è quella che lo riporta nelle code di lavoro"
                />
              )}

              {/* La stanza della consulenza: UN tasto solo, copiare il link.
                  Il campo di testo del link era già sparito (non va scritto a
                  mano: lo crea il salvataggio); «Entra nella consulenza» se n'è
                  andato dietro, perché apriva la stessa stanza dei tasti
                  «Avvia» dell'elenco e dell'agenda. Copiare invece non lo fa
                  nessun altro punto del CRM: fuori il link si può solo MANDARE
                  su WhatsApp, e serve anche per l'email o l'SMS. */}
              {/*  ── SI COPIA SOLO UNA STANZA NOSTRA ────────────────────────
                  Il link salvato sulle schede vecchie è di Google Meet, ripreso
                  dall'archivio del CRM precedente: stanze che non esistono più.
                  Copiarlo e mandarlo significa spedire il cliente davanti a una
                  porta chiusa mentre il consulente lo aspetta dall'altra parte.
                  linkStanzaDi ricostruisce sempre l'indirizzo Meetly dal codice
                  della stanza, e restituisce vuoto quando quel codice non c'è:
                  in quel caso il riquadro non compare affatto. */}
              {/*  ⚠️ IL LINK CHE SI COPIA DA QUI È QUELLO DI QUESTA PERSONA:
                   porta il suo gettone, così in una consulenza con tre
                   persone chi lo apre è riconosciuto senza toccare nessun
                   nome alla porta (vedi shop/chi-dal-link). Copiarlo «nudo»
                   vorrebbe dire tre ospiti identici sullo schermo. */}
              {!!linkStanzaDi(form) && (
                <StanzaConsulenza
                  link={
                    lead?.id
                      ? linkPerPersona(
                          linkStanzaDi(form),
                          gettoneDi({ leadId: lead.id, nome: form.nome || "" }),
                        )
                      : linkStanzaDi(form)
                  }
                />
              )}

              {/* Lo stato sta sempre nello stesso posto, dopo il lavoro del
                  momento, perché è la rete di sicurezza: i gesti frequenti si
                  fanno con i tasti qui sopra (esiti, chiamata, acconto), gli
                  altri quindici stati si scelgono da qui. */}
              <SezioneFinestra
                titolo="Stato del lead"
                nota="Gli stati che promettono una data la chiedono subito dopo"
                classeCorpo="p-4"
              >
                {/*  La pastiglia apre la stessa finestra a griglia di tutto il
                     CRM. Era un <select> nativo: venti voci in colonna, e sul
                     telefono la rotella di sistema. `cambiaStato` non cambia —
                     è lui che, subito dopo, apre la finestrella del «quando». */}
                <PastigliaStato
                  dati={form}
                  contesto={`${form.nome ?? ""} ${form.cognome ?? ""}`.trim() || undefined}
                  etichetta={etichettaStato}
                  onScegli={cambiaStato}
                />
              </SezioneFinestra>
            </>
          )}

          {/* ═══ 3bis · QUELLO CHE HA DETTO LUI ═══
              Richiesta del committente: «in base alle domande dentro al lead,
              ci siano anche queste info, ma non nelle note, ma proprio come
              voce a sé stante — così posso tenere traccia bene».
              Sta SOPRA le note e non dentro, ed è il punto: queste non sono
              appunti nostri, sono parole sue. Finivano in fondo alle note, in
              fila dopo un «Dal modulo:», e sparivano alla prima riga scritta
              da un consulente. */}
          <BloccoModulo form={form} />

          {/* ═══ 3ter · È GIÀ RICOMPARSO IN UNA LISTA ═══
              Richiesta del committente: «aggiunge delle note interne che è
              stato duplicato e ci sta scritto anche il numero di volte… e le
              note sono non modificabili queste».
              Sta SOPRA le note e fuori dalla casella, ed è tutto il punto: se
              stessero dentro, basterebbe un colpo di tastiera per cancellarle.
              Qui non c'è niente da cancellare perché non c'è nessun campo: le
              righe si calcolano da `ricarico` ogni volta (crm/importa/ricarico),
              quindi non esiste un posto in cui riscriverle e non possono
              sfasarsi dal contatore delle volte. */}
          <RigheRicarico dati={form} />

          {/* ═══ 4 · NOTE ═══ una sola casella, sempre nello stesso posto */}
          <SezioneFinestra titolo="Note" classeCorpo="p-4">
            <Textarea
              rows={3}
              className={CLASSI_AREA}
              placeholder="Appunti sempre visibili su questo lead"
              value={form.note || ""}
              onChange={(e) => update("note", e.target.value)}
            />
          </SezioneFinestra>

          {/* ═══ 4bis · I SUOI PREVENTIVI ═══
              Richiesta del committente: «cliccando sui lead, nella scheda
              dentro ci sia anche il collegamento a tutti i suoi preventivi».
              La finestra esisteva già ed era ottima — la stessa dell'elenco
              Trattative — ma si apriva SOLO da lì: da qualunque altro punto
              del CRM (la coda delle telefonate, «Da fare oggi», l'agenda, i
              lead importati) si arriva a QUESTA scheda, e da qui per vedere
              cosa gli era stato proposto bisognava uscire, andare in
              «Preventivi» e cercare il cognome — con due omonimi si sbagliava
              persona e il link partiva al cliente sbagliato.
              ⚠️ La finestra legge il database SOLO quando la si apre: questa
               scheda si apre decine di volte al giorno per leggere un numero
               di telefono, e una lettura per ognuna sarebbe traffico speso per
               una domanda che nessuno ha fatto (vedi crm/preventivi/DelLead).
              ⚠️ E solo su una scheda che in archivio c'è già: nel wizard del
               lead nuovo non c'è ancora niente da collegare. */}
          {!!lead && (
            <SezioneFinestra
              titolo="Preventivi"
              nota="Quelli fatti a questa persona: si aprono con Meetly o si copia il link da mandarle"
              classeCorpo="p-4"
            >
              <PulsantePreventivi lead={lead} className="w-full sm:w-auto" />
            </SezioneFinestra>
          )}

          {/*  Le registrazioni stanno SOTTO i preventivi perché è lì che si
              guarda quando si ripercorre una trattativa: prima che cosa gli è
              stato proposto, poi com'è andata la consulenza. Se non ce ne sono
              la sezione non compare affatto. */}
          {!!lead && <RegistrazioniDelLead lead={lead} />}

          {/* ═══ 5 · ALTRI DATI ═══ */}
          <AltriDati
            aperto={altriDati}
            onCambio={setAltriDati}
            form={form}
            update={update}
            bozza={bozza}
            lead={lead}
            postVendita={postVendita}
            salvaStorico={salvaStorico}
            /*  La qualifica si compila MENTRE si parla, quindi la sua casa è il
                blocco della chiamata. Quando quel blocco non c'è (l'appuntamento
                è già fissato, la consulenza è passata) resta comunque
                modificabile da qui — ma mai in due punti insieme: due controlli
                per lo stesso dato fanno dubitare di quale sia quello vero. */
            conQualifica={!daChiamare}
          />
        </div>
      )}

      {/*  LA FINESTRELLA DEL QUANDO — sopra la scheda, non dentro: si apre
          appena si sceglie uno stato che promette una data, e si chiude appena
          la data c'è. Montata solo quando serve, così ogni apertura riparte dai
          valori della scheda invece che da quelli dell'apertura precedente. */}
      {quando && (
        <FinestraQuando
          richiesta={quando}
          cliente={nomeCompleto}
          valoreData={testo(form[quando.chiaveData])}
          valoreOra={testo(form[quando.chiaveOra])}
          onAnnulla={() => setQuando(null)}
          onConferma={confermaQuando}
          onOrariLiberi={
            quando.conOrariLiberi
              ? () => {
                  setQuando(null);
                  setCatenaAperta(true);
                }
              : undefined
          }
        />
      )}

      {/*  ── ⚠️ «QUESTO NUMERO CE L'ABBIAMO GIÀ» ─────────────────────────
           Richiesta del committente: «si apre un popup per andare a vedere la
           scheda del lead». Si apre UNA VOLTA per numero — non a ogni tasto
           premuto — e si può richiamare dalla riga rossa sotto il campo.
           ⚠️ NON È UN BLOCCO: il tasto principale porta a vedere, quello
            secondario lascia scrivere. Due persone possono davvero avere lo
            stesso numero, e un programma che lo impedisce sa meglio di chi ha
            la persona al telefono. */}
      {avvisoDoppioneAperto && doppioni.length > 0 && (
        <FinestraDoppione
          doppioni={doppioni}
          onChiudi={() => setAvvisoDoppioneAperto(false)}
          onApri={(l) => {
            setAvvisoDoppioneAperto(false);
            setDoppioneAperto(l);
          }}
        />
      )}

      {/*  ── LA DOMANDA PRIMA DI ELIMINARE ───────────────────────────────
           Dice il NOME e che cosa se ne va: «sei sicuro?» da solo non fa
           decidere niente, e questa finestra può essere aperta da un'ora su
           una persona che nel frattempo non si ricorda più. */}
      {chiedoElimina && (
        <Finestra
          aperta
          onCambio={(v) => !v && setChiedoElimina(false)}
          icona={Trash2}
          titolo="Eliminare questa scheda?"
          contesto={<span className="text-red-700">{nomeCompleto || "Senza nome"}</span>}
          larghezza="sm"
          bloccante
          azioni={
            <>
              <Button
                variant="outline"
                onClick={() => setChiedoElimina(false)}
                disabled={salvataggio}
              >
                No, la tengo
              </Button>
              <Button
                onClick={() => void eliminoAdesso()}
                disabled={salvataggio}
                className="bg-red-600 text-white hover:bg-red-700 sm:min-w-32"
              >
                {salvataggio ? "Elimino…" : "Sì, elimina"}
              </Button>
            </>
          }
        >
          <div className="space-y-2 p-4 text-[12.5px] leading-relaxed text-muted-foreground">
            <p>
              Se ne vanno con lei{" "}
              <b className="text-foreground">
                le note, i tentativi di chiamata, gli appuntamenti e i preventivi
              </b>{" "}
              di questa persona. Non c'è un cestino da cui ripescarla.
            </p>
            <p>
              Se invece non ti interessa più ma vuoi tenerne traccia, chiudi questa finestra e
              mettile lo stato «Non interessato»: resta in archivio e smette di comparire fra le
              telefonate da fare.
            </p>
          </div>
        </Finestra>
      )}

      {/*  La scheda di chi ce l'ha già, aperta sopra questa. `nidificata`
           spegne il controllo là dentro: quel numero è il suo, e la scheda
           troverebbe come doppione proprio quella da cui siamo partiti. */}
      {doppioneAperto && (
        <LeadDialog
          open
          lead={doppioneAperto}
          onOpenChange={(v) => !v && setDoppioneAperto(null)}
          nidificata
        />
      )}
    </Finestra>
  );
}

/** ── LA FINESTRA DEL NUMERO GIÀ IN ARCHIVIO ───────────────────────────────
 *  Dice chi è, com'è messo e quando se n'è parlato l'ultima volta: senza
 *  queste tre cose «esiste già» non aiuta a decidere niente. */
function FinestraDoppione({
  doppioni,
  onChiudi,
  onApri,
}: {
  doppioni: Lead[];
  onChiudi: () => void;
  onApri: (l: Lead) => void;
}) {
  return (
    <Finestra
      aperta
      onCambio={(v) => !v && onChiudi()}
      icona={AlertTriangle}
      titolo="Questo numero ce l'abbiamo già"
      contesto={
        <span className="text-red-700">
          {doppioni.length === 1
            ? "C'è già una scheda con questo numero"
            : `Ci sono già ${doppioni.length} schede con questo numero`}
        </span>
      }
      larghezza="sm"
      azioni={
        <Button variant="outline" onClick={onChiudi} className="sm:min-w-32">
          Continua comunque
        </Button>
      }
    >
      <div className="space-y-2 p-4">
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Prima di crearne una nuova: quella vecchia ha dentro le note, i tentativi e gli
          appuntamenti di questa persona. Se è la stessa, lavora su quella.
        </p>
        <ul className="divide-y rounded-lg border">
          {doppioni.map((l) => {
            const d = l.data ?? ({} as LeadData);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onApri(l)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {`${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome"}
                    </span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {[
                        String(d.telefono || ""),
                        d.citta || null,
                        d.dataMeeting ? `consulenza del ${dataBreve(d.dataMeeting)}` : null,
                      ]
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
      </div>
    </Finestra>
  );
}

/*  ── ⚠️ PRIMA L'ORARIO, POI LA PERSONA ────────────────────────────────────
    Richiesta del committente: «quando clicco nuovo lead mi dà subito le
    disponibilità, seleziono la disponibilità, e poi mi fa inserire i dati
    dell'utente alla fine».
    È l'ordine della telefonata vera: il cliente chiede «quando potete?», si
    guardano gli orari e si blocca quello buono — i dati si prendono dopo, con
    l'appuntamento già fermato. Nell'ordine di prima si scrivevano nome,
    cognome, telefono, fonte, città ed email mentre la persona aspettava al
    telefono di sapere se c'era posto, e intanto quell'ora poteva prenderla un
    collega.
    ⚠️ L'ORDINE LO DECIDE QUESTA RIGA, e i blocchi la seguono: cambiarne uno
     solo vuol dire una barra che dice una cosa e una schermata che ne mostra
     un'altra. */
const PASSI = ["L'appuntamento", "Chi è", "Da dove arriva", "Conferma"] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   I PEZZI DELLA FINESTRA
   Nessuno di loro porta un colore proprio: il colore arriva dai toni condivisi
   e significa sempre la stessa cosa (sky = da fare adesso, ambra = manca un
   passaggio, emerald = fatto, rose = perso, slate = neutro).
   ═════════════════════════════════════════════════════════════════════════ */

type Update = <K extends keyof LeadData>(k: K, v: LeadData[K]) => void;

/** ── LE RISPOSTE DEL MODULO ────────────────────────────────────────────────
 *  Una voce per domanda, con la risposta in chiaro. Non si modificano: sono
 *  quello che la persona ha dichiarato compilando l'inserzione, e correggerle
 *  vorrebbe dire riscrivere quello che ha detto — se una è sbagliata lo si
 *  scopre al telefono e lo si scrive nelle note, che è il posto degli appunti
 *  nostri.
 *  Non c'è nessuna sezione quando non c'è niente da mostrare: una scheda che
 *  non viene da un'inserzione non deve portarsi dietro un riquadro vuoto. */
/** ── LE RIGHE CHE NESSUNO PUÒ RISCRIVERE ──────────────────────────────────
 *  Non è una casella spenta: è testo. Un campo disabilitato resta un campo, e
 *  il giorno in cui qualcuno lo riabilita da un'altra schermata queste righe
 *  diventano modificabili come le altre. Qui si stampa quello che dice
 *  `ricarico`, e basta.
 *  Non compare su nessuna scheda che non sia mai ricomparsa in una lista —
 *  cioè sulla quasi totalità — perché un riquadro che c'è sempre e quasi
 *  sempre vuoto è rumore. */
function RigheRicarico({ dati }: { dati?: Partial<LeadData> | null }) {
  const righe = useMemo(() => righeRicarico(dati), [dati]);
  if (!righe.length) return null;
  return (
    <SezioneFinestra titolo="Già in archivio" classeCorpo="p-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-800">
          <RotateCcw className="h-3.5 w-3.5" /> Scritto dal programma · non modificabile
        </div>
        <ul className="space-y-1">
          {righe.map((r, i) => (
            <li key={i} className="text-[12.5px] leading-snug text-amber-900">
              {r}
            </li>
          ))}
        </ul>
      </div>
    </SezioneFinestra>
  );
}

function BloccoModulo({ form }: { form: LeadData }) {
  const voci = vociModulo(form.modulo);
  if (!voci.length) return null;
  const TONO: Record<string, "vinta" | "da_lavorare" | "neutro"> = {
    buono: "vinta",
    medio: "da_lavorare",
    neutro: "neutro",
  };
  return (
    <SezioneFinestra
      titolo="Quello che ha detto nel modulo"
      nota="Risposte sue, dall'inserzione: non si modificano"
      icona={ClipboardList}
      classeCorpo="p-4"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {voci.map((v) => (
          <div key={v.campo} className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {v.titolo}
            </p>
            {/*  ⚠️ `whitespace-normal`: il chip di serie tiene tutto su una
                riga, e una risposta scritta a mano («giovedì dopo le 19, non
                prima») uscirebbe dalla scheda invece di andare a capo. */}
            {/*  Il nome corto è nostro: la frase che la persona ha scelto per
                intero si legge passandoci sopra, così non si perde niente di
                quello che ha detto senza riempire la scheda. */}
            <Chip
              tono={TONO[v.tono] ?? "neutro"}
              className="mt-1 h-auto whitespace-normal py-1"
              title={v.testo && v.testo !== v.valore ? v.testo : undefined}
            >
              {v.valore}
            </Chip>
          </div>
        ))}
      </div>
    </SezioneFinestra>
  );
}

/** I dati anagrafici, dietro una riga che si apre. Si apre da sé se ce n'è già
 *  uno scritto: un dato che esiste e non si vede è un dato che si riscrive. */
function BloccoDatiFattura({ form, update }: { form: LeadData; update: Update }) {
  const res = form.residenza ?? {};
  const qualcosa =
    !!form.codiceFiscale || !!form.dataNascita || !!res.indirizzo || !!res.cap || !!res.comune;
  const [aperto, setAperto] = useState(qualcosa);
  return (
    <div className="mt-2.5 rounded-lg border border-slate-200 bg-white/60">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Receipt className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="flex-1 text-[12.5px] font-medium text-slate-700">
          Dati per la fattura
          <span className="ml-1.5 font-normal text-slate-500">
            {qualcosa ? "· compilati" : "· facoltativi"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            aperto && "rotate-180",
          )}
        />
      </button>
      {aperto && (
        <div className="border-t border-slate-200 p-3">
          <BloccoAnagrafica form={form} update={update} />
        </div>
      )}
    </div>
  );
}

/** ── CHI È E COME LO RAGGIUNGO ────────────────────────────────────────────
 *  Nome, cognome, telefono e i due modi di usarlo. In modalità `compatto` è la
 *  testa della scheda; nel wizard è il primo passo, con gli stessi campi. */
function BloccoContatto({
  form,
  update,
  rifNome,
  rifTelefono,
  messaggioWhatsApp,
  messaggioPromemoria,
  compatto,
  doppioni = [],
  onVediDoppione,
}: {
  form: LeadData;
  update: Update;
  /** Le schede che hanno già questo numero. Vuoto = numero nuovo. */
  doppioni?: Lead[];
  /** Apre la scheda di chi ce l'ha già. */
  onVediDoppione?: () => void;
  rifNome: RefObject<HTMLInputElement | null>;
  rifTelefono: RefObject<HTMLInputElement | null>;
  messaggioWhatsApp: string | null;
  /** Il secondo messaggio, quando lo stato ne ha due (il ricontatto). */
  messaggioPromemoria?: string | null;
  compatto?: boolean;
}) {
  return (
    <SezioneFinestra
      titolo={compatto ? undefined : "Chi è"}
      nota={compatto ? undefined : "Bastano nome e telefono: il resto si aggiunge dopo"}
      classeCorpo="p-4 space-y-3"
    >
      <div className={GRIGLIA}>
        <Campo etichetta="Nome" obbligatorio>
          <Input
            ref={rifNome}
            className={CLASSI_CAMPO}
            autoFocus={!compatto}
            value={form.nome}
            onChange={(e) => update("nome", e.target.value)}
          />
        </Campo>
        <Campo etichetta="Cognome">
          <Input
            className={CLASSI_CAMPO}
            value={form.cognome}
            onChange={(e) => update("cognome", e.target.value)}
          />
        </Campo>
      </div>

      <Campo etichetta="Telefono" obbligatorio>
        <div className="flex items-center gap-1.5">
          <Input
            ref={rifTelefono}
            inputMode="tel"
            /*  ⚠️ ROSSO, NON BLOCCATO: il numero si può salvare lo stesso —
                due persone possono davvero averne uno solo (madre e figlia,
                due coniugi, un centralino). Il rosso dice «guarda», non
                «non puoi». */
            className={cn(
              CLASSI_CAMPO,
              "flex-1",
              doppioni.length > 0 &&
                "border-red-400 bg-red-50 text-red-900 focus-visible:ring-red-300",
            )}
            placeholder="Numero di telefono"
            value={form.telefono}
            onChange={(e) => update("telefono", e.target.value)}
          />
          <TastiContatto
            telefono={form.telefono}
            nome={form.nome}
            quandoConsulenza={form.dataMeeting}
            stato={form.stato}
            messaggio={messaggioWhatsApp}
            messaggioExtra={messaggioPromemoria}
            etichettaExtra={`Manda ${etichettaPromemoria(form, oggiIso())}`}
          />
        </div>
        {/*  ── LA RIGA SOTTO IL CAMPO ROSSO ────────────────────────────────
             Dice CHI ce l'ha già — un rosso senza nome è un allarme che non si
             può usare — e porta alla sua scheda con un clic. Resta lì anche
             dopo aver chiuso la finestra: è l'unica traccia che rimane. */}
        {doppioni.length > 0 && (
          <button
            type="button"
            onClick={onVediDoppione}
            className="mt-1 flex w-full items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-left text-[11.5px] leading-snug text-red-800 hover:bg-red-100"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              {avvisoDoppione(
                doppioni.length,
                `${doppioni[0]?.data?.nome ?? ""} ${doppioni[0]?.data?.cognome ?? ""}`.trim(),
              )}{" "}
              <span className="font-semibold underline underline-offset-2">Apri la sua scheda</span>
            </span>
          </button>
        )}
      </Campo>

      {/* ── ⚠️ L'EMAIL SI CHIEDE QUI, ED È FACOLTATIVA ────────────────────
            Segnalazione del committente: creando un lead nuovo non la chiedeva
            nessuno. C'era, ma dentro «Altri dati» — cioè in un blocco chiuso
            che nel percorso di creazione non si apre — e chi aveva l'email
            della persona non aveva dove scriverla senza salvare, riaprire e
            cercarla.
            ⚠️ FACOLTATIVA sul serio, e senza asterisco: un lead arriva da una
             telefonata, e chiedere l'email come obbligatoria vorrebbe dire
             inventarsela. Serve a due cose vere quando c'è — la fattura
             elettronica e il ritrovare una bozza — e a niente quando non c'è. */}
      <Campo etichetta="Email">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          className={CLASSI_CAMPO}
          placeholder="Facoltativa"
          value={form.email || ""}
          onChange={(e) => update("email", e.target.value)}
        />
      </Campo>

      {/* ── ⚠️ I DATI PER LA FATTURA, CHIUSI FINCHÉ NON SERVONO ────────────
            Richiesta del committente: codice fiscale, nascita e residenza sul
            LEAD, non solo dentro la finestra della fattura — da dove non
            tornavano indietro, e chi rifatturava due mesi dopo ricominciava da
            capo.
            ⚠️ Chiusi di suo, e aperti da soli quando qualcosa c'è già: un lead
             è una persona che ha chiesto informazioni, non una pratica
             fiscale, e quattro campi anagrafici in cima alla scheda di chi
             deve ancora fissare una consulenza sono quattro campi che fanno
             sembrare il programma un ufficio. */}
      <BloccoDatiFattura form={form} update={update} />
    </SezioneFinestra>
  );
}

/** I due tasti che si premono venti volte al giorno. Esistono in un solo punto
 *  della finestra: duplicarli obbligava a chiedersi ogni volta quale dei due
 *  fosse quello aggiornato. */
function TastiContatto({
  telefono,
  messaggio,
  nome,
  quandoConsulenza,
  stato,
  esteso,
  messaggioExtra,
  etichettaExtra,
}: {
  telefono: string;
  messaggio: string | null;
  /** Il nome del cliente: serve al messaggio dei lavori. */
  nome?: string;
  /** Il giorno della consulenza: lo nomina il messaggio dei lavori. */
  quandoConsulenza?: string;
  /** Lo stato del lead: è il raggio dell'interruttore dei lavori. */
  stato?: string;
  /** true = tasti con l'etichetta scritta (riepiloghi, conferme) */
  esteso?: boolean;
  /** Un SECONDO messaggio per lo stesso numero, quando lo stato ne ha due.
   *  ⚠️ Nullo quasi sempre: un tasto in più che manda lo stesso testo del
   *   primo farebbe soltanto chiedersi quale dei due sia quello giusto. */
  messaggioExtra?: string | null;
  etichettaExtra?: string;
}) {
  const spento = !telefono;
  return (
    <>
      <Button
        asChild
        size={esteso ? "sm" : "icon"}
        variant="outline"
        className={cn(
          esteso ? "h-9" : "h-9 w-9",
          "shrink-0",
          spento && "pointer-events-none opacity-40",
        )}
        title="Chiama"
      >
        <a href={`tel:${telefono}`} aria-label="Chiama">
          <Phone className="h-3.5 w-3.5 text-slate-500" />
          {esteso && "Chiama"}
        </a>
      </Button>
      {/*  ⚠️ Passa dalla domanda sui lavori (crm/TastoMessaggio): le
          fotografie al primo messaggio rispondono alla domanda che il cliente
          non fa — «ma si vede?» — e a chi ha appena finito la consulenza non
          dicono niente di nuovo. Chi scrive lo sa in un istante. */}
      <TastoMessaggio
        telefono={telefono}
        messaggio={messaggio || ""}
        nome={nome}
        quandoConsulenza={quandoConsulenza}
        stato={stato}
        titolo="Scrivi su WhatsApp"
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white text-[13px] font-medium text-slate-700 transition hover:bg-slate-50",
          esteso ? "h-9 px-3" : "h-9 w-9",
          (spento || !messaggio) && "pointer-events-none opacity-40",
        )}
      >
        <IconaWhatsApp />
        {esteso && "WhatsApp"}
      </TastoMessaggio>
      {!!messaggioExtra && (
        <Button
          asChild
          size={esteso ? "sm" : "icon"}
          variant="outline"
          className={cn(
            esteso ? "h-9" : "h-9 w-9",
            "shrink-0",
            spento && "pointer-events-none opacity-40",
          )}
          title={etichettaExtra || "Scrivi il secondo messaggio"}
        >
          <a
            href={buildWhatsAppLink(telefono, messaggioExtra)}
            target="_blank"
            rel="noreferrer"
            aria-label={etichettaExtra || "Scrivi il secondo messaggio"}
          >
            <Bell className="h-3.5 w-3.5 text-amber-500" />
            {esteso && "Promemoria"}
          </a>
        </Button>
      )}
    </>
  );
}

function IconaWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-emerald-600" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

/** ── LE DUE PAROLE CHE QUI SI DICONO DIVERSAMENTE ─────────────────────────
 *  In questa finestra un contatto si chiama LEAD, e due etichette condivise
 *  parlavano ancora di trattativa: «Trattativa in chat» lo dice per esteso,
 *  «Chiusa» è al femminile perché concordava con quella parola. Sono l'unico
 *  punto in cui il testo visibile contraddiceva il nome della scheda.
 *  Restano un'eccezione locale finché `LEAD_STATUS_LABEL` non cambia in
 *  types.ts (vedi la richiesta lasciata a chi lo mantiene): cambiarlo lì
 *  significa toccarlo anche nell'elenco, nella pipeline e nei filtri, e vanno
 *  cambiati insieme o le due viste diranno due parole diverse. */
const ETICHETTA_STATO_LEAD: Partial<Record<LeadStatus, string>> = {
  gestire_in_chat: "Lead in chat",
  concluso: "Lead chiuso",
};
/*  Il ripiego è `etichettaDi`, non `?? s`: su una scheda arrivata dall'archivio
    lo stato può MANCARE del tutto, e `?? s` restituiva allora `undefined` —
    cioè la pastiglia dello stato usciva vuota e il lettore di schermo leggeva
    «Stato: undefined». `etichettaDi` scrive «—» quando non c'è niente e il
    valore grezzo quando c'è ma nessuna tabella lo conosce. */
const etichettaStato = (s: LeadStatus): string => ETICHETTA_STATO_LEAD[s] ?? etichettaDi(s);

/*  Il menu degli stati NON vive più qui: era un <select> nativo, adesso è la
 *  pastiglia condivisa (crm/SelettoreStatoDialog) che apre la finestra a
 *  griglia usata in tutto il CRM. Di questo blocco resta solo `etichettaStato`
 *  qui sopra, che la pastiglia riceve come prop: è l'unico punto in cui due
 *  stati si chiamano con parole diverse. */

/* ── ADESSO · IL CONTATTO DA CHIAMARE ──────────────────────────────────────
   Quattro esiti e basta, nell'ordine in cui capitano. La qualifica sta subito
   sotto perché si compila MENTRE si parla: prima era in fondo alla scheda
   dell'appuntamento, cioè si compilava a cose fatte o non si compilava. */
function BloccoChiamata({
  form,
  update,
  onFissa,
}: {
  form: LeadData;
  update: Update;
  onFissa: () => void;
}) {
  return (
    <SezioneFinestra
      titolo="Adesso · chiama e segna com'è andata"
      icona={Phone}
      classeCorpo="p-4 space-y-4"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={onFissa} className="h-11 bg-sky-600 hover:bg-sky-700 sm:col-span-2">
          <CalendarClock className="h-4 w-4" /> Ha risposto → fissa l&apos;appuntamento
        </Button>
        <Pillola
          attiva={form.stato === "non_risponde"}
          onClick={() => update("stato", "non_risponde")}
          className="py-2.5"
        >
          Non risponde
        </Pillola>
        <Pillola
          attiva={form.stato === "segreteria"}
          onClick={() => update("stato", "segreteria")}
          className="py-2.5"
        >
          Segreteria
        </Pillola>
        <Pillola
          attiva={form.stato === "annullato"}
          onClick={() => update("stato", "annullato")}
          className="py-2.5 sm:col-span-2"
        >
          Non interessato
        </Pillola>
      </div>

      <CampiRichiamo form={form} update={update} />
      <div className="border-t border-slate-200 pt-4">
        <Qualifica form={form} update={update} />
      </div>
    </SezioneFinestra>
  );
}

/** Data e ora del richiamo. Scrivono SEMPRE su `dataRicontatto`/`oraRicontatto`
 *  e l'etichetta lo dice: i vecchi due input cambiavano campo di destinazione
 *  in base al menu di stato accanto, e uno spostamento finiva sul richiamo
 *  lasciando l'appuntamento vecchio in agenda. */
function CampiRichiamo({ form, update }: { form: LeadData; update: Update }) {
  //  ⚠️ CON «Ci ricontatta lui» LE PAROLE CAMBIANO, e non è un vezzo: «Data
  //   del richiamo» su una scheda in cui la telefonata la fa il cliente fa
  //   richiamare chi aveva chiesto di non essere richiamato.
  const suo = form.stato === "ci_ricontatta_lui";
  return (
    <div className="space-y-2">
      {/*  ── QUANDO L'HA DETTO ────────────────────────────────────────────
           Richiesta del committente: «segna in dinamico la data di quando lo
           ha detto, quella di oggi, sempre». La scrive il programma da sé
           (updateLead), qui si LEGGE: una promessa di ieri e una di tre mesi
           fa si leggono uguali se non c'è scritto quando è stata fatta. */}
      {suo && !!form.ciRicontattaDettoIl && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-700">
          L'ha detto il{" "}
          <span className="font-semibold">{quandoInChiaro(form.ciRicontattaDettoIl)}</span>
          <span className="text-slate-400">
            {distanzaInChiaro(form.ciRicontattaDettoIl)
              ? ` · ${distanzaInChiaro(form.ciRicontattaDettoIl)}`
              : ""}
          </span>
        </p>
      )}
      <div className={GRIGLIA}>
        <Campo etichetta={suo ? "Entro quando si fa vivo" : "Data del richiamo"}>
          <Input
            type="date"
            className={CLASSI_CAMPO}
            value={form.dataRicontatto || ""}
            onChange={(e) => update("dataRicontatto", e.target.value)}
          />
        </Campo>
        <Campo etichetta={suo ? "Ora (se l'ha detta)" : "Ora del richiamo"}>
          <Input
            type="time"
            className={CLASSI_CAMPO}
            value={form.oraRicontatto || ""}
            onChange={(e) => update("oraRicontatto", e.target.value)}
          />
        </Campo>
      </div>
      {/*  La data effettiva, riscritta come si dice al telefono: «2026-09-08» e
          «2026-08-09» si somigliano abbastanza da passare inosservati, e questo
          campo finisce dritto nelle code di lavoro. */}
      {!!form.dataRicontatto && (
        <p className="text-[12px] text-slate-600">
          <Check className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
          {quandoInChiaro(form.dataRicontatto, form.oraRicontatto)}
          <span className="text-slate-400">
            {distanzaInChiaro(form.dataRicontatto)
              ? ` · ${distanzaInChiaro(form.dataRicontatto)}`
              : ""}
          </span>
        </p>
      )}
    </div>
  );
}

/** Il blocco del richiamo. Serve a tutti gli stati che hanno una data di
 *  ricontatto e non un appuntamento: «Ricontatto fissato», «Irreperibile»,
 *  «Meet da fissare», «In valutazione», «Trattativa in chat», «Attesa acconto».
 *  Sono due caselle e basta — il quando — perché il COM'È ANDATA si segna dalla
 *  riga di «Da fare oggi» e dalla pastiglia di stato, non aprendo la scheda.
 *  Senza di lui quelle schede
 *  non avrebbero più nessun campo dove scrivere QUANDO risentire il cliente —
 *  la vecchia barra in cima ci arrivava cambiando bersaglio da sola, ed è
 *  esattamente il meccanismo che ha fatto perdere appuntamenti. */
function BloccoRichiamo({
  form,
  update,
  titolo,
  nota,
  onFissaOra,
}: {
  form: LeadData;
  update: Update;
  titolo: string;
  nota: string;
  /** presente solo dove fissare la consulenza è il gesto successivo */
  onFissaOra?: () => void;
}) {
  return (
    <SezioneFinestra
      titolo={`Adesso · ${titolo}`}
      nota={nota}
      icona={CalendarClock}
      classeCorpo="p-4 space-y-3"
    >
      <CampiRichiamo form={form} update={update} />

      {onFissaOra && (
        <Button variant="outline" onClick={onFissaOra} className="w-full sm:w-auto">
          <CalendarClock className="h-4 w-4" /> Fissa adesso la consulenza
        </Button>
      )}
    </SezioneFinestra>
  );
}

/* ── ADESSO · LA CONSULENZA È PASSATA ──────────────────────────────────────
   Qui c'erano i due pulsanti d'esito («Cliente assente», «Da riprogrammare») e
   «Avvia la videoconsulenza». Sono andati via perché l'esito si segna DOVE si
   guarda la giornata, non dentro una scheda che va aperta apposta: due pulsanti
   identici, con le stesse parole e gli stessi colori (arrivano tutti da ESITI in
   crm/ui), stanno su ogni riga dell'agenda e nel riquadro «Adesso» della pagina
   Oggi — vedi RigaLead e SchedaAdesso in MeetGiornalieri — e nell'elenco
   trattative si assegnano dalla pastiglia di stato e dalle azioni di gruppo.
   Segnare l'esito richiede zero aperture di finestra, ed è il gesto più
   frequente della giornata: un doppione qui dentro serviva solo a farsi la
   domanda «quale dei due comanda».

   COSA È RIMASTO, E PERCHÉ NON POTEVA ANDARSENE
   «Sposta l'appuntamento». Fuori da questa finestra non esiste NESSUN comando
   che dia una data nuova a una consulenza già fissata: il calendarietto della
   riga (MeetGiornalieri) compare solo quando la data MANCA e apre proprio
   questa scheda, e la procedura guidata del cambio stato (QuickStatusDialog)
   chiede il quando solo passando a uno stato diverso da quello attuale. Toglierlo
   avrebbe reso immodificabile la data di ogni consulenza già in agenda — il
   guasto n. 1 della lista in cima al file, quello che era appena stato corretto. */
function BloccoConsulenzaPassata({
  form,
  consulente,
  onSposta,
  onCatena,
}: {
  form: LeadData;
  consulente?: Consultant;
  /** apre la finestrella del quando, già compilata con la data attuale */
  onSposta: () => void;
  /** apre la catena, dove si sceglie la persona */
  onCatena: () => void;
}) {
  return (
    <SezioneFinestra
      titolo="Adesso · la consulenza è passata"
      nota={`${quandoLeggibile(form.dataMeeting, form.oraMeeting)}${
        consulente ? ` · ${nomeConsulente(consulente)}` : ""
      }`}
      icona={CalendarClock}
      classeCorpo="p-4 space-y-3"
    >
      {/*  SEMPRE, non solo su «Da riprogrammare»: la telefonata che sposta
          arriva quasi sempre il giorno stesso, con la consulenza ancora
          «fissata» — ed era proprio il caso in cui questo tasto non c'era e
          la data sembrava immodificabile (guasto n. 1).
          A tutta larghezza sul telefono: un bersaglio da 90px si manca. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onSposta} className="w-full sm:w-auto">
          <CalendarClock className="h-4 w-4" /> Sposta l&apos;appuntamento
        </Button>
        {/*  Anche su una consulenza passata: capita di scoprire dopo che l'ha
            fatta un altro, e senza questo tasto la scheda resta intestata alla
            persona sbagliata — con i conti e le KPI che la seguono. */}
        <Button variant="outline" onClick={onCatena} className="w-full sm:w-auto">
          <UserIcon className="h-3.5 w-3.5 text-slate-500" />{" "}
          {consulente ? "Cambia consulente" : "Assegna il consulente"}
        </Button>
      </div>
      {/*  Dove si segna com'è andata, scritto una volta sola: senza questa riga
          il tasto sembra sparito, e chi lo cerca riapre la scheda dieci volte. */}
      <p className="text-[11px] leading-snug text-slate-500">
        L&apos;esito — cliente assente, da riprogrammare — si segna dalla riga del lead, in agenda o
        nell&apos;elenco.
      </p>
    </SezioneFinestra>
  );
}

/* ── ADESSO · L'APPUNTAMENTO C'È ───────────────────────────────────────────
   Quando, con chi, e il modo di spostarlo: erano in tre angoli diversi della
   finestra, qui sono un blocco solo.

   CHIAMA E WHATSAPP NON SONO QUI, ED È VOLUTO
   Ci sono stati, ed erano il doppione più insidioso: gli stessi due tasti, con
   lo stesso messaggio, a due centimetri da quelli del blocco «Chi è» — cioè
   proprio il caso in cui ci si ferma a chiedersi quale dei due sia quello
   aggiornato. Vivono in un punto solo, il primo blocco della finestra, che è
   sopra questo e non si perde mai di vista. */
function BloccoAppuntamentoFissato({
  form,
  consulente,
  azione,
  onSposta,
  onCatena,
}: {
  form: LeadData;
  consulente?: Consultant;
  azione: ReturnType<typeof prossimaAzione>;
  /** apre la finestrella del quando, già compilata: due tocchi e conferma */
  onSposta: () => void;
  /** apre la catena: serve quando manca il consulente, che è l'unica cosa che
   *  la finestrella del quando non chiede */
  onCatena: () => void;
}) {
  return (
    <SezioneFinestra
      titolo="Adesso · appuntamento fissato"
      icona={CalendarClock}
      azioni={
        azione.quando ? (
          <span className={cn("text-[11px] tabular-nums", TONO_AZIONE[azione.tono])}>
            {azione.quando}
          </span>
        ) : undefined
      }
      classeCorpo="p-4 space-y-3"
    >
      <p className="text-[15px] font-semibold text-slate-900">
        {quandoLeggibile(form.dataMeeting, form.oraMeeting)}
        <span className="ml-2 text-[12px] font-normal text-slate-500">
          {form.durataMeeting || DURATA_PREDEFINITA} min
          {consulente ? ` · ${nomeConsulente(consulente)}` : " · consulente da assegnare"}
        </span>
      </p>
      {/*  A tutta larghezza sul telefono, come gli altri comandi della
          finestra: un bersaglio da 90px in mezzo alla riga si manca.
          «Avvia la videoconsulenza» stava qui e non c'è più: la stanza si apre
          dalla riga del lead, dall'agenda e dal riquadro «Adesso», che sono i
          posti dove ci si trova quando arriva l'ora. Resta lo spostamento, che
          fuori non lo fa nessuno. */}
      {/*  ── ⚠️ IL CONSULENTE SI CAMBIA, NON SOLO SI ASSEGNA ───────────────
          Richiesta del committente: «se un lead è assegnato a un consulente,
          aprendo la scheda devo poterlo assegnare a un altro».
          Questo tasto c'era SOLO quando il consulente mancava: una volta
          assegnato non esisteva più nessun modo evidente di cambiarlo. C'era,
          ma nascosto in fondo a tre passaggi — «Sposta l'appuntamento» → «Vedi
          gli orari liberi» → l'elenco delle persone — cioè dentro il comando
          che dice di cambiare la DATA, che è un'altra cosa e nessuno apre per
          cambiare la persona.
          Adesso sta qui, sempre, accanto allo spostamento: sono i due modi di
          correggere un appuntamento già preso. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onSposta} className="w-full sm:w-auto">
          <Pencil className="h-3.5 w-3.5 text-slate-500" /> Sposta l&apos;appuntamento
        </Button>
        <Button variant="outline" onClick={onCatena} className="w-full sm:w-auto">
          <UserIcon className="h-3.5 w-3.5 text-slate-500" />{" "}
          {consulente ? "Cambia consulente" : "Assegna il consulente"}
        </Button>
      </div>
      {!consulente && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          Manca il consulente: senza, l&apos;appuntamento non entra in nessuna agenda e il lead non
          si salva.
        </NotaFinestra>
      )}
    </SezioneFinestra>
  );
}

/* ── ADESSO · VISITA IN SEDE ─────────────────────────────────────────────
   Il menu del consulente compare qui SOLO se la catena dell'appuntamento non è
   aperta: la catena ha già il suo elenco, quello che dice chi è pieno oggi, e
   due comandi per lo stesso campo visibili insieme fanno chiedere quale
   comandi (succede su una visita in sede che ha anche una consulenza fissata,
   quando si preme «Sposta»). Quando c'è la catena, comanda la catena. */
function BloccoInSede({
  form,
  update,
  consultants,
  conConsulente,
}: {
  form: LeadData;
  update: Update;
  consultants: Consultant[];
  conConsulente: boolean;
}) {
  //  Una visita in sede È una consulenza: occupa l'agenda di chi la riceve
  //  esattamente come quella in videochiamata, quindi qui si sceglie fra chi
  //  fa le consulenze e basta. Chi è già scritto sulla scheda resta in elenco
  //  anche senza spunta, o riaprendo il lead il campo si svuoterebbe da solo e
  //  sembrerebbe che nessuno lo stesse seguendo.
  const { elenco: squadra, ripiego } = consulentiPerConsulenza(consultants, {
    anche: [form.consulenteId],
  });
  return (
    <SezioneFinestra
      titolo="Adesso · visita in sede"
      nota="Il consulente è obbligatorio: la visita occupa la sua agenda"
      icona={CalendarClock}
      classeCorpo="p-4 space-y-3"
    >
      {/*  PRIMA CHI, POI QUANDO — anche qui. Il consulente stava SOTTO i due
          campi dell'orario: si sceglieva l'ora e poi si scopriva di chi fosse
          l'agenda che quell'ora occupa, cioè l'unico ritorno all'indietro
          rimasto in tutta la scheda dopo la riscrittura. */}
      {conConsulente && (
        <Campo etichetta="Chi la riceve" obbligatorio>
          <select
            className={CLASSI_SELECT}
            value={form.consulenteId || ""}
            onChange={(e) => update("consulenteId", e.target.value || null)}
          >
            <option value="">Non assegnato</option>
            {squadra.map((c) => (
              <option key={c.id} value={c.id}>
                {nomeConsulente(c) || "Senza nome"}
              </option>
            ))}
          </select>
          {/*  ⚠️ La nota sta FUORI dalla tendina di sistema: dentro un <select>
              ci stanno solo <option>, e un avviso travestito da voce si
              sceglierebbe per sbaglio al posto di una persona. */}
          <NotaSoloConsulenti ripiego={ripiego} className="mt-1.5" />
        </Campo>
      )}
      <div className={GRIGLIA}>
        <Campo etichetta="Data in sede">
          <Input
            type="date"
            className={CLASSI_CAMPO}
            value={form.dataVieneInSede || ""}
            onChange={(e) => update("dataVieneInSede", e.target.value)}
          />
        </Campo>
        <Campo etichetta="Ora in sede">
          <Input
            type="time"
            className={CLASSI_CAMPO}
            value={form.oraVieneInSede || ""}
            onChange={(e) => update("oraVieneInSede", e.target.value)}
          />
        </Campo>
      </div>
      {/*  La riga di conferma: la stessa lingua della finestrella del quando,
          così una data appena scritta si rilegge come si dice al telefono. */}
      {!!form.dataVieneInSede && (
        <p className="text-[12px] text-slate-600">
          <Check className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
          {quandoInChiaro(form.dataVieneInSede, form.oraVieneInSede)}
        </p>
      )}
    </SezioneFinestra>
  );
}

/* ── DOPO LA CONSULENZA: PREZZO → ACCONTO → NOTE ───────────────────────────
   Questo è l'ordine in cui si compila dopo una call, ed era sparso su due
   linguette: le note in fondo alla seconda, il prezzo in cima, l'acconto in
   una terza colonna. Il riepilogo economico è una riga sola e compare solo se
   c'è un prezzo: su un contatto mai chiamato erano cinque «€ 0,00» in fila.
   Il titolo non dice «adesso» perché questo blocco convive con quello
   dell'esito: due sezioni che si annunciano entrambe come la cosa da fare
   adesso non ne annunciano nessuna, e l'ordine sulla pagina basta già. */
function BloccoDenaro({
  form,
  update,
  patchPagamento,
  prezzo,
  acconto,
}: {
  form: LeadData;
  update: Update;
  patchPagamento: (p: Partial<PaymentInfo>) => void;
  prezzo: number;
  acconto: number;
}) {
  const costi = form.payment?.costi || {};
  const totaleCosti =
    (costi.costoProdotto || 0) + (costi.costoInstallatore || 0) + (costi.costoTaglio || 0);
  const profitto = prezzo - totaleCosti;

  return (
    <SezioneFinestra titolo="Prezzo e acconto" icona={Wallet} classeCorpo="p-4 space-y-4">
      <Campo
        etichetta="Prezzo concordato (€)"
        nota="È il numero su cui tutto il sistema calcola saldo e profitto"
      >
        <Input
          type="number"
          inputMode="decimal"
          className={cn(CLASSI_CAMPO, "tabular-nums")}
          value={form.payment?.prezzoFinaleVendita || form.payment?.prezzoTotale || 0}
          onChange={(e) => patchPagamento({ prezzoFinaleVendita: Number(e.target.value) })}
        />
      </Campo>

      <AccontoRapido
        form={form}
        update={update}
        patchPagamento={patchPagamento}
        prezzo={prezzo}
        acconto={acconto}
      />

      {prezzo > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-[12px] tabular-nums text-slate-600">
          <span>
            Prezzo <span className="font-medium text-slate-900">{eur(prezzo)}</span>
          </span>
          <span>
            Incassato <span className="font-medium text-slate-900">{eur(acconto)}</span>
          </span>
          <span>
            Resta{" "}
            <span className="font-medium text-slate-900">{eur(Math.max(0, prezzo - acconto))}</span>
          </span>
          <span>
            Profitto{" "}
            <span
              className={cn("font-semibold", profitto >= 0 ? TESTO_TONO.vinta : TESTO_TONO.persa)}
            >
              {eur(profitto)}
            </span>
          </span>
        </div>
      )}

      <Campo etichetta="Note dopo la consulenza">
        <Textarea
          rows={3}
          className={CLASSI_AREA}
          placeholder="Cosa è stato detto, esiti, prossimi passi"
          value={form.notePostCall || ""}
          onChange={(e) => update("notePostCall", e.target.value)}
        />
      </Campo>
    </SezioneFinestra>
  );
}

/** ── L'UNICO CONTROLLO DELL'ACCONTO ───────────────────────────────────────
 *  Prima ce n'erano due: questi importi rapidi (che aggiornavano anche stato e
 *  data del pagamento) e un campo numerico dentro la vendita (che scriveva solo
 *  il numero). Stesso dato, due esiti diversi, nessun segno che li
 *  distinguesse. Resta questo, perché è quello che tiene tutto coerente. */
function AccontoRapido({
  form,
  update,
  patchPagamento,
  prezzo,
  acconto,
}: {
  form: LeadData;
  update: Update;
  patchPagamento: (p: Partial<PaymentInfo>) => void;
  prezzo: number;
  acconto: number;
}) {
  const [libero, setLibero] = useState(false);
  const [valore, setValore] = useState("");
  const [confermaAzzera, setConfermaAzzera] = useState(false);
  /** ── L'ACCONTO IN ATTESA DELLA RISPOSTA SULL'IVA ───────────────────────
   *  Richiesta del committente: segnando che un lead ha lasciato l'acconto si
   *  deve poter dire se il prezzo l'IVA la comprende, se va aggiunta — e allora
   *  il totale sale del 22% — o se non se ne applica.
   *  Finché la cifra è qui NON è stata scritta da nessuna parte: si preme un
   *  importo, si risponde, e solo allora si registra. Prima il tocco
   *  sull'importo scriveva e basta.
   *  ⚠️ `null` = nessuna domanda aperta. E la domanda si fa SOLO se un prezzo
   *   c'è: senza, non c'è niente su cui applicare un'aliquota e chiederlo
   *   sarebbe un passaggio in più per una risposta che non cambia niente —
   *   vedi `imposta` qui sotto. */
  const [inAttesa, setInAttesa] = useState<number | null>(null);
  const [modoIva, setModoIva] = useState<ModoIva>(MODO_IVA_PREDEFINITO);
  const contoAcconto = contoIva(prezzo, modoIva);

  /** Chiede l'IVA se c'è un prezzo su cui applicarla, altrimenti registra e
   *  basta. È il punto in cui il gesto si sdoppia, e sta qui — non dentro i
   *  pulsanti — perché gli importi rapidi e il campo libero devono comportarsi
   *  allo stesso modo. */
  const chiedi = (importo: number) => {
    if (prezzo > 0) {
      setModoIva(MODO_IVA_PREDEFINITO);
      setInAttesa(importo);
      return;
    }
    imposta(importo);
  };

  const imposta = (importo: number, modo?: ModoIva) => {
    const conto = modo ? contoIva(prezzo, modo) : null;
    patchPagamento({
      accontoPagato: importo,
      dataPagamento: form.payment?.dataPagamento || isoOggi(),
      //  ⚠️ CON «AGGIUNGI IVA» IL PREZZO SALE, e va riscritto qui: è l'unica
      //   delle tre scelte che cambia quello che il cliente deve. Con le altre
      //   due il conto restituisce lo stesso numero, e non si tocca niente.
      ...(conto && modo === "aggiunta" ? { prezzoFinaleVendita: conto.totale } : {}),
      ...(modo
        ? {
            //  I `costi` si ricopiano: `patchPagamento` fonde in superficie, e
            //  passare solo `ivaInclusa` cancellerebbe costo prodotto,
            //  installatore e taglio — cioè il margine di quella pratica.
            costi: { ...(form.payment?.costi ?? {}), ivaInclusa: conIvaBool(modo) },
          }
        : {}),
    });
    //  ⚠️ UN ACCONTO NON DEVE MANGIARSI UNA CHIUSURA GIÀ SCELTA.
    //   Questa riga conosceva due soli stati vinti, "venduto" e "concluso",
    //   perché due soli ce n'erano. Con le tre chiusure di oggi, registrare da
    //   qui l'acconto di un lead segnato «Da spedire» lo riportava ad «Acconto
    //   incassato»: nei totali del mese non cambia niente (sono entrambi vinti)
    //   ma sparisce l'unica riga che diceva di preparare un pacco, e il pacco
    //   non lo prepara più nessuno. È esattamente il guasto che `applyAutoStatus`
    //   (types.ts) si guarda dal fare — solo che qui lo stato veniva riscritto
    //   PRIMA, a mano, quindi la protezione di là non entrava mai in gioco.
    //   Si legge da `eChiusuraVinta`, l'unico elenco.
    if (importo > 0 && !eChiusuraVinta(form.stato) && form.stato !== "concluso") {
      update("stato", "acconto");
      toast.success(`Acconto registrato: ${eur(importo)}`, {
        description: "La scheda passa alla consegna. Ricordati di salvare.",
      });
    }
  };

  const azzera = () => {
    //  Azzerare disfa una vendita: è irreversibile per l'archivio (lo stato
    //  torna indietro, la data di conversione sparisce) e quindi si conferma.
    patchPagamento({ accontoPagato: 0, dataPagamento: undefined });
    update("convertedAt", undefined);
    setConfermaAzzera(false);
    toast.success("Acconto azzerato");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Acconto incassato
        </span>
        {acconto > 0 &&
          (confermaAzzera ? (
            <span className="inline-flex items-center gap-2 text-[11px] text-slate-600">
              Azzerare l&apos;acconto?
              <button
                type="button"
                onClick={() => setConfermaAzzera(false)}
                className="underline underline-offset-2"
              >
                No
              </button>
              <button
                type="button"
                onClick={azzera}
                className="font-semibold text-rose-700 underline underline-offset-2"
              >
                Sì, azzera
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfermaAzzera(true)}
              className="text-[11px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              Azzera
            </button>
          ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[100, 250, 500].map((p) => (
          <Pillola key={p} attiva={acconto === p} onClick={() => chiedi(p)} className="py-2.5">
            € {p}
          </Pillola>
        ))}
      </div>
      {!libero ? (
        <Pillola
          onClick={() => setLibero(true)}
          className="w-full border-dashed border-slate-300 py-2.5 text-slate-500"
        >
          Altro importo
        </Pillola>
      ) : (
        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="decimal"
            autoFocus
            placeholder="€"
            className={cn(CLASSI_CAMPO, "tabular-nums")}
            value={valore}
            onChange={(e) => setValore(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setLibero(false);
                setValore("");
              }
              if (e.key === "Enter") {
                const v = Number(valore);
                if (!Number.isFinite(v) || v < 0) {
                  toast.error("Importo non valido");
                  return;
                }
                chiedi(v);
                setValore("");
                setLibero(false);
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3"
            onClick={() => {
              const v = Number(valore);
              if (!Number.isFinite(v) || v < 0) {
                toast.error("Importo non valido");
                return;
              }
              chiedi(v);
              setValore("");
              setLibero(false);
            }}
          >
            Applica
          </Button>
        </div>
      )}
      {prezzo > 0 && acconto > 0 && (
        <p className="text-[11px] text-slate-500">
          Incassato <span className="font-medium tabular-nums text-slate-700">{eur(acconto)}</span>
          {" · resta "}
          <span className="font-medium tabular-nums text-slate-700">
            {eur(Math.max(0, prezzo - acconto))}
          </span>
        </p>
      )}

      {/* ── LA DOMANDA SULL'IVA ──────────────────────────────────────────────
          Si apre premendo un importo e si chiude rispondendo. Non è una
          conferma dell'acconto — quella non serviva e non serve: è il dato che
          il calcolo del margine non può dedurre da solo, e che finora si
          chiedeva solo settimane dopo, incassando il saldo. Nel frattempo la
          cifra girava per il CRM senza che nessuno sapesse se era lorda o netta.
          ⚠️ NON SI SALVA PREMENDO UN RIQUADRO: si sceglie, e si conferma sotto.
           Con «aggiungi 22%» in mezzo, un tocco per sbaglio alzerebbe il totale
           della pratica e lo scriverebbe nello stesso gesto. */}
      <Finestra
        aperta={inAttesa !== null}
        onCambio={(v) => {
          if (!v) setInAttesa(null);
        }}
        larghezza="sm"
        icona={Percent}
        titolo="Com'è l'IVA su questo prezzo?"
        contesto={`Acconto di ${eur(inAttesa ?? 0)} su un totale di ${eur(prezzo)}`}
        classeCorpo="space-y-3"
      >
        <ScegliIva modo={modoIva} onCambia={setModoIva} base={prezzo} />

        {contoAcconto.cambiaIlTotale && (
          //  L'unico avviso in ambra, e solo quando il totale è cambiato
          //  davvero: si sta per chiedere al cliente più di quanto gli è stato
          //  detto a voce.
          <p className="text-[11.5px] leading-snug text-amber-700">
            Il totale della pratica passa da {eur(prezzo)} a{" "}
            <span className="font-semibold tabular-nums">{eur(contoAcconto.totale)}</span>: sono{" "}
            {eur(contoAcconto.imposta)} in più da chiedere al cliente.
          </p>
        )}

        <Button
          type="button"
          className="h-10 w-full text-[13.5px]"
          onClick={() => {
            const importo = inAttesa;
            setInAttesa(null);
            if (importo !== null) imposta(importo, modoIva);
          }}
        >
          Registra l&apos;acconto di {eur(inAttesa ?? 0)}
        </Button>

        <NotaFinestra>
          Resta scritto con l&apos;aliquota: serve al calcolo del netto. Come sempre in questa
          scheda, la modifica si salva chiudendo con «Salva».
        </NotaFinestra>
      </Finestra>
    </div>
  );
}

/* ── ADESSO · IL LEAD È PERSO ──────────────────────────────────────────────
   Il motivo è obbligatorio per salvare, e prima stava in fondo alla colonna di
   sinistra: lontanissimo dal menu che lo rendeva obbligatorio, con un
   messaggio d'errore che non diceva dove fosse. Adesso è il primo blocco, e il
   messaggio ci porta sopra il cursore. */
function BloccoPerso({
  form,
  update,
  rifMotivo,
}: {
  form: LeadData;
  update: Update;
  rifMotivo: RefObject<HTMLSelectElement | null>;
}) {
  return (
    <SezioneFinestra
      titolo="Adesso · perché è andato perso"
      nota="Obbligatorio: senza motivo il lead non si salva"
      icona={AlertTriangle}
      classeCorpo="p-4 space-y-3"
    >
      <Campo etichetta="Motivo" obbligatorio>
        <select
          ref={rifMotivo}
          className={CLASSI_SELECT}
          value={form.lostReason || ""}
          onChange={(e) =>
            update("lostReason", (e.target.value || undefined) as LostReason | undefined)
          }
        >
          <option value="">Seleziona un motivo</option>
          {LOST_REASON_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {LOST_REASON_LABEL[r]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etichetta={form.lostReason === "altro" ? "Descrivi il motivo" : "Note sul motivo"}>
        <Textarea
          rows={2}
          className={CLASSI_AREA}
          placeholder={form.lostReason === "altro" ? "Obbligatorio" : "Facoltative"}
          value={form.lostReasonNote || ""}
          onChange={(e) => update("lostReasonNote", e.target.value)}
        />
      </Campo>
    </SezioneFinestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA CATENA DELL'APPUNTAMENTO — l'ordine è il cuore di questa riscrittura
   3.1 CHI (con il carico di lavoro) → 3.2 QUANTO dura → 3.3 QUANDO (giorno,
   poi le ore di QUEL giorno) → riga di conferma.
   È l'inversione esatta dell'ordine precedente, ed è l'unico che rispetta la
   dipendenza reale: `generateAvailability(consulente, durata, …)` HA BISOGNO
   dei primi due per produrre i giorni. Prima lo sapeva il codice e non
   l'interfaccia, che chiedeva l'ora e in fondo il consulente.
   ═════════════════════════════════════════════════════════════════════════ */
function CatenaAppuntamento({
  form,
  update,
  consultants,
  allLeads,
  currentLeadId,
  onChiudi,
}: {
  form: LeadData;
  update: Update;
  consultants: Consultant[];
  allLeads: Lead[];
  currentLeadId?: string;
  /** presente solo quando c'era già un appuntamento: «lascia com'era» */
  onChiudi?: () => void;
}) {
  const durata = Number(form.durataMeeting) > 0 ? Number(form.durataMeeting) : DURATA_PREDEFINITA;
  //  Le due liste si guardano prima di usarle: qui si scorre l'archivio intero
  //  a ogni render, ed è il punto in cui una riga malformata (`data` mancante,
  //  elenco non ancora caricato) farebbe cadere la finestra al montaggio.
  //  ── E LA CONSULENZA LA FA UN CONSULENTE ────────────────────────────────
  //   Questo è IL punto in cui si decide chi svolgerà l'appuntamento: prima
  //   c'era dentro tutta l'anagrafica, driver e installatori compresi, e la
  //   consulenza finita addosso a chi non ne fa si scopriva il giorno stesso.
  //   Chi è già scelto sulla scheda resta (riaprire il lead non deve far
  //   sparire il nome di chi ci sta lavorando), e finché nessuno è segnato
  //   consulente si vedono tutti con la riga che dice quale spunta manca.
  const { elenco: squadra, ripiego: ripiegoConsulenti } = consulentiPerConsulenza(consultants, {
    anche: [form.consulenteId],
  });
  //  L'archivio si guarda prima di usarlo: qui si scorre intero a ogni render,
  //  ed è il punto in cui una riga malformata (`data` mancante, elenco non
  //  ancora caricato) farebbe cadere la finestra al montaggio.
  const elenco = Array.isArray(allLeads) ? allLeads : [];
  const consulente = squadra.find((c) => c.id === form.consulenteId);
  const oggi = isoOggi();

  //  Quante consulenze ha già oggi: è l'informazione che fa scegliere, ed era
  //  l'unica cosa che il selettore in cima NON diceva.
  const callDiOggi = (cid: string) =>
    elenco.filter((l) => l?.data?.consulenteId === cid && l?.data?.dataMeeting === oggi).length;

  //  Se la scheda porta una durata fuori elenco (import, dati vecchi) la si
  //  mostra invece di farla sparire dietro un valore che non è quello vero.
  const durate = DURATE.includes(durata) ? DURATE : [...DURATE, durata].sort((a, b) => a - b);

  //  Data, ora, durata e stato passano dalla porta unica: scegliere uno slot
  //  per un lead «Da riprogrammare» e lasciarlo «Da riprogrammare» era il
  //  guasto n. 4 — la scheda continuava a chiedere di spostare una consulenza
  //  che era già stata spostata.
  const scegliSlot = (data: string, ora: string) =>
    fissaConsulenza(form, update, data, ora, durata);

  return (
    <SezioneFinestra
      titolo="L'appuntamento"
      nota="Nell'ordine: chi lo fa, quanto dura, quando"
      icona={CalendarClock}
      azioni={
        onChiudi ? (
          <button
            type="button"
            onClick={onChiudi}
            className="text-[11px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Lascia com&apos;era
          </button>
        ) : undefined
      }
      classeCorpo="p-4 space-y-5"
    >
      {/* 3.1 · CHI */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          1 · Chi lo fa
        </p>
        {squadra.length === 0 ? (
          <div className="mt-2">
            <VuotoFinestra testo="Nessun consulente configurato." />
          </div>
        ) : (
          <div className="mt-2 grid gap-2">
            {squadra.map((c) => {
              const n = callDiOggi(c.id);
              const max = Number(c.data?.maxCallGiorno) || 0;
              const pieno = max > 0 && n >= max;
              const scelto = form.consulenteId === c.id;
              return (
                <Scelta
                  key={c.id}
                  attiva={scelto}
                  disabilitata={pieno && !scelto}
                  onClick={() => update("consulenteId", c.id)}
                  nota={`${n}${max > 0 ? `/${max}` : ""} oggi${pieno ? " · pieno" : ""}`}
                >
                  {testo(c.data?.nome) || "Senza nome"}
                </Scelta>
              );
            })}
            {/*  Sotto le persone, non sopra: quando il ripiego è acceso l'elenco
                è comunque utilizzabile, e la riga spiega perché è più lungo di
                quanto ci si aspetta invece di sbarrare la strada. */}
            <NotaSoloConsulenti ripiego={ripiegoConsulenti} />
          </div>
        )}
      </div>

      {/* 3.2 · QUANTO */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          2 · Quanto dura
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {durate.map((d) => (
            <Pillola
              key={d}
              attiva={durata === d}
              onClick={() => update("durataMeeting", d)}
              className="min-w-[64px] py-2"
            >
              {d} min
            </Pillola>
          ))}
        </div>
      </div>

      {/* 3.3 · QUANDO */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">3 · Quando</p>
        {!consulente ? (
          <div className="mt-2">
            <VuotoFinestra testo="Scegli il consulente per vedere i suoi orari liberi — oppure scrivi data e ora qui sotto." />
          </div>
        ) : (
          /*  Il ripiego è SOLO l'avviso: i due campi manuali stanno già qui
              sotto, fuori dallo scudo, ed erano l'unico doppione rimasto —
              quando la griglia cadeva si vedevano due volte data e ora, uno
              aperto e uno dietro il link, senza sapere quale comandasse. */
          <Scudo
            dove="griglia orari"
            ripiego={
              <NotaFinestra tono="attenzione" icona={AlertTriangle} className="mt-2">
                Gli orari liberi non si caricano — scrivi data e ora a mano qui sotto.
              </NotaFinestra>
            }
          >
            <GrigliaOrari
              consulente={consulente}
              durata={durata}
              allLeads={elenco}
              currentLeadId={currentLeadId}
              dataScelta={form.dataMeeting}
              oraScelta={form.oraMeeting}
              onScegli={scegliSlot}
            />
          </Scudo>
        )}
        {/*  I DUE CAMPI MANUALI CI SONO SEMPRE. Prima esistevano solo dopo aver
            scelto un consulente, e su una scheda importata (consulenteId nullo)
            non c'era NESSUN modo di scrivere una data: è il guasto n. 2, quello
            che faceva dire «non me lo fa fare». Senza consulente sono già
            aperti, perché lì sono l'unica strada. */}
        <CampiMeetingManuali form={form} update={update} apribile={!!consulente} />
      </div>

      {/* 3.4 · LA RIGA DI CONFERMA — una sola, per rileggere quello che si è
          scelto. Prima la stessa data compariva in tre punti e per convincersi
          che fosse entrata si tornava in cima alla finestra. */}
      {form.dataMeeting && form.oraMeeting && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-[13px] font-semibold text-slate-900">
            {quandoLeggibile(form.dataMeeting, form.oraMeeting)}
          </span>
          <span className="text-[12px] text-slate-500">
            {durata} min{consulente ? ` · ${nomeConsulente(consulente)}` : ""}
          </span>
        </div>
      )}
    </SezioneFinestra>
  );
}

/** I due campi manuali. Servono in due casi: quando la griglia non si carica e
 *  quando l'orario che serve è occupato (uno spostamento concordato al
 *  telefono vince sulla disponibilità teorica). Di norma stanno chiusi. */
function CampiMeetingManuali({
  form,
  update,
  apribile,
}: {
  form: LeadData;
  update: Update;
  apribile?: boolean;
}) {
  const [aperto, setAperto] = useState(!apribile);
  if (apribile && !aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="mt-2 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
      >
        Oppure scrivi data e ora a mano
      </button>
    );
  }
  return (
    <div className={cn(GRIGLIA, "mt-2")}>
      {/*  Anche qui si passa dalla porta unica: scritta a mano o scelta dalla
          griglia, una data di consulenza è sempre la stessa cosa e deve
          aggiornare lo stato allo stesso modo. */}
      <Campo etichetta="Data della consulenza">
        <Input
          type="date"
          className={CLASSI_CAMPO}
          value={form.dataMeeting || ""}
          onChange={(e) => fissaConsulenza(form, update, e.target.value, form.oraMeeting || "")}
        />
      </Campo>
      <Campo etichetta="Ora della consulenza">
        <Input
          type="time"
          className={CLASSI_CAMPO}
          value={form.oraMeeting || ""}
          onChange={(e) =>
            fissaConsulenza(
              form,
              update,
              form.dataMeeting || "",
              e.target.value,
              DURATA_PREDEFINITA,
            )
          }
        />
      </Campo>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA FINESTRELLA DEL «QUANDO»
   Si apre subito dopo uno stato che promette un momento, e dal tasto «Sposta».
   Fa UNA domanda sola, e mette sotto la risposta scritta come si dice al
   telefono: «giovedì 21 agosto, ore 15:30 · fra 8 giorni». Quella riga non è
   decorazione — è il controllo che manca a un campo data, dove «2026-09-08» e
   «2026-08-09» si somigliano abbastanza da passare inosservati.

   E DICE ANCHE DOVE VA A FINIRE
   Sotto la data c'è il nome del campo in cui verrà scritta. È la risposta
   definitiva al guasto storico: quando il campo di destinazione lo decideva lo
   stato corrente, la data digitata finiva altrove e l'elenco continuava a
   mostrare quella vecchia. Qui la destinazione arriva da `QUANDO_PER_STATO`,
   è una sola, ed è a schermo mentre si sceglie.
   ═════════════════════════════════════════════════════════════════════════ */
const ORE_FREQUENTI = ["09:00", "11:00", "15:00", "18:00"];

function FinestraQuando({
  richiesta,
  cliente,
  valoreData,
  valoreOra,
  onAnnulla,
  onConferma,
  onOrariLiberi,
}: {
  richiesta: RichiestaQuando;
  cliente: string;
  /** quello che c'è adesso sulla scheda: spostare parte da lì, non da zero */
  valoreData: string;
  valoreOra: string;
  onAnnulla: () => void;
  onConferma: (data: string, ora: string) => void;
  /** presente solo per la consulenza: passa all'agenda del consulente */
  onOrariLiberi?: () => void;
}) {
  const partenza = valoreData.slice(0, 10);
  const [data, setData] = useState(partenza);
  const [ora, setOra] = useState(valoreOra.slice(0, 5));

  //  Gli scatti si contano dalla data ATTUALE quando c'è ed è ancora futura
  //  («+1 settimana» da quella fissata, che è come lo si dice al cliente).
  //  Se la data è già passata si riparte da OGGI: «+1 giorno» su una consulenza
  //  di tre giorni fa avrebbe proposto un'altra data passata, cioè lo scatto
  //  rapido sarebbe stato la strada più veloce per sbagliare.
  const base = partenza && partenza >= isoOggi() ? partenza : "";
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
  const leggibile = quandoInChiaro(data, ora);
  const distanza = distanzaInChiaro(data);
  const passata = !!data && data < isoOggi();

  const conferma = () => {
    if (!puoConfermare) return;
    onConferma(data, ora);
  };

  return (
    <Finestra
      aperta
      onCambio={(v) => {
        if (!v) onAnnulla();
      }}
      icona={CalendarClock}
      larghezza="sm"
      titolo={richiesta.titolo}
      contesto={[cliente, richiesta.nota].filter(Boolean).join(" · ")}
      classeCorpo="space-y-3"
      azioni={
        <>
          {onOrariLiberi && (
            <Button variant="outline" onClick={onOrariLiberi}>
              <CalendarClock className="h-4 w-4" /> Vedi gli orari liberi
            </Button>
          )}
          {/*  «Non adesso» e non «Annulla»: lo stato è già stato cambiato, qui
              si sta solo rimandando la data — e il campo resta aperto sotto,
              nella scheda. Dirlo «Annulla» faceva credere di annullare anche
              lo stato. */}
          <Button variant="outline" onClick={onAnnulla}>
            Non adesso
          </Button>
          <Button onClick={conferma} disabled={!puoConfermare} className="sm:min-w-32">
            Conferma
          </Button>
        </>
      }
    >
      <SezioneFinestra
        titolo={spostamento ? "Sposta di" : "Il giorno"}
        nota={
          spostamento
            ? `Adesso è ${quandoInChiaro(partenza, valoreOra)}`
            : "Uno scatto, oppure scrivi la data"
        }
        classeCorpo="p-4 space-y-3"
      >
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
        <div className={GRIGLIA}>
          <Campo etichetta={richiesta.nomeCampo} obbligatorio>
            <Input
              type="date"
              autoFocus
              className={CLASSI_CAMPO}
              value={data}
              onChange={(e) => setData(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") conferma();
              }}
            />
          </Campo>
          <Campo etichetta="Ora" obbligatorio={richiesta.oraObbligatoria}>
            <Input
              type="time"
              className={CLASSI_CAMPO}
              value={ora}
              onChange={(e) => setOra(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") conferma();
              }}
            />
          </Campo>
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
      </SezioneFinestra>

      {/*  LA DATA EFFETTIVA — scritta per esteso, con la distanza da oggi e il
          nome del campo che riceverà il valore. */}
      {leggibile ? (
        <NotaFinestra
          tono={passata ? "attenzione" : "conferma"}
          icona={passata ? AlertTriangle : Check}
        >
          <span className="block font-semibold">
            {leggibile}
            {distanza ? ` · ${distanza}` : ""}
          </span>
          <span className="block">
            {passata
              ? `È una data già passata. Finirà comunque in «${richiesta.nomeCampo}».`
              : `Verrà scritta in «${richiesta.nomeCampo}» e si salva con «Salva».`}
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
    </Finestra>
  );
}

/** ── GLI ORARI LIBERI, IN DUE LIVELLI ─────────────────────────────────────
 *  Prima erano quattordici giorni srotolati dentro un riquadro che scorreva da
 *  solo: cinquanta pastiglie e uno scorrimento dentro un altro scorrimento.
 *  Qui si sceglie il giorno, e solo del giorno scelto si vedono le ore.
 *
 *  PERCHÉ È UN COMPONENTE A SÉ: il calcolo della disponibilità legge i dati
 *  del consulente così come arrivano dal database, e quei dati non rispettano
 *  sempre i tipi dichiarati. Isolato qui dentro, e dentro lo scudo, se cade
 *  cade solo lui — non la scheda del contatto. */
function GrigliaOrari({
  consulente,
  durata,
  allLeads,
  currentLeadId,
  dataScelta,
  oraScelta,
  onScegli,
}: {
  consulente: Consultant;
  durata: number;
  allLeads: Lead[];
  currentLeadId?: string;
  dataScelta?: string;
  oraScelta?: string;
  onScegli: (data: string, ora: string) => void;
}) {
  const [giorno, setGiorno] = useState<string | null>(null);
  /*  ── ⚠️ QUALI FASCE SONO TENUTE PER UNO SOLO ─────────────────────────
      Richiesta del committente: «quando fisso un appuntamento posso
      selezionare se bloccare la fascia per solo quella persona oppure se
      rimane aperta; quando ho già messo una persona aperta, gli altri entrano
      aperti fino a 3».
      Il modo sta sul server (una riga per fascia) perché deve valere anche per
      chi si prenota da solo dal link pubblico: se vivesse qui dentro, il
      cliente ti riempirebbe proprio l'ora che volevi tenere libera. Qui si
      legge, tutto il giorno in una richiesta sola. */

  /*  ── ⚠️ I GIORNI RESTANO QUELLI IN CUI SI LAVORA, GLI ORARI TUTTI ──────
      Richiesta del committente: «uno slot prenotato va segnato in rosso e deve
      restare selezionabile; e il rosso deve coprire tutta la durata della
      prenotazione».
      `generateAvailability` risponde a un'altra domanda — «dove c'è posto» — e
      per farlo BUTTA VIA gli orari presi: un giorno pieno spariva del tutto, e
      con lui l'informazione che serviva («è pieno», non «non lavora»).
      Qui i giorni li dà ancora lei (sa quali sono lavorativi e come si
      chiamano), ma gli orari di ciascuno li chiede a `slotDelGiorno`, che li
      restituisce TUTTI con lo stato e con il nome di chi li tiene. */
  const giorni = useMemo<(DaySlots & { ore: SlotConStato[] })[] | null>(() => {
    try {
      const out = generateAvailability(consulente, durata, allLeads, 14, undefined, currentLeadId);
      //  Non si dà per scontata la forma di quello che torna: se un giorno
      //  arrivasse senza slot utilizzabili, `.map` su un non-array
      //  abbatterebbe il ramo di render.
      if (!Array.isArray(out)) return null;
      return out
        .filter((d) => d && Array.isArray(d.slots))
        .map((d) => ({
          ...d,
          ore: slotDelGiorno(consulente, d.date, durata, allLeads, currentLeadId),
        }));
    } catch (e) {
      console.warn("[CRM] disponibilità non calcolabile", e);
      return null;
    }
  }, [consulente, durata, allLeads, currentLeadId]);

  /*  ⚠️ IL GIORNO SI CALCOLA QUI, PRIMA DELLE USCITE ANTICIPATE: sotto ci
      sono tre `return`, e un gancio messo dopo si smonterebbe a ogni giornata
      senza orari (vedi la prova «nessun hook sotto un'uscita anticipata»). */
  const attivo =
    (giorno && giorni?.some((d) => d.date === giorno) && giorno) ||
    (dataScelta && giorni?.some((d) => d.date === dataScelta) && dataScelta) ||
    giorni?.[0]?.date ||
    "";

  /*  ⚠️ LA SPUNTA È LA STESSA DI TUTTO IL CRM (crm/ModoDellaFascia): qui ne
      esisteva una copia, e quando il committente ha chiesto la stessa cosa
      nella coda dei lead importati sarebbero diventate due copie che un
      giorno divergono. La lettura, il salvataggio e le parole stanno in un
      posto solo. */
  const {
    modi,
    cambia: cambiaModo,
    salvando: salvandoModo,
  } = useModiFascia(consulente?.id, attivo, durata);

  if (!giorni) {
    return (
      <NotaFinestra tono="attenzione" icona={AlertTriangle} className="mt-2">
        Gli orari liberi non si caricano — scrivi data e ora a mano qui sotto.
      </NotaFinestra>
    );
  }
  if (giorni.length === 0) {
    return (
      <div className="mt-2">
        <VuotoFinestra
          testo={`Nessun orario libero per ${nomeConsulente(consulente) || "questo consulente"} nei prossimi 14 giorni.`}
        />
      </div>
    );
  }

  //  Il giorno mostrato lo decide `attivo`, calcolato più in alto.
  const ore: SlotConStato[] = giorni.find((d) => d.date === attivo)?.ore ?? [];

  return (
    <div className="mt-2 space-y-3">
      {/* I giorni scorrono in orizzontale: sul telefono è il gesto naturale, e
          non porta via altezza alla finestra. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {giorni.map((d) => (
          <Pillola
            key={d.date}
            attiva={attivo === d.date}
            onClick={() => setGiorno(d.date)}
            className="shrink-0 py-2"
          >
            {d.label}
            {/*  Il numero è quanti orari sono ANCORA LIBERI, non quanti ne
                esistono: è la cosa che fa scegliere il giorno. */}
            <span className="ml-1 text-[11px] font-normal text-slate-500">{d.slots.length}</span>
          </Pillola>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ore.map((o) => {
          const scelto = dataScelta === attivo && oraScelta === o.ora;
          /*  ── ⚠️ FINO A TRE PERSONE, POI LA FASCIA SI CHIUDE ─────────────
              Richiesta del committente: «fai che posso aggiungere fino a 3
              persone nella stessa ora di consulenza per singolo consulente,
              con il contatore 1/3, 2/3, 3/3, e poi quello slot non è più
              disponibile».
              Gli stati sono tre, non due: vuota, con qualcuno dentro ma con
              posto (ambra, si sceglie sapendo chi c'è già), piena (rossa e
              spenta). Il rosso premibile di prima prometterebbe adesso un
              posto che non c'è più. */
          /*  ── ⚠️ I POSTI SONO QUELLI DI QUESTA FASCIA, NON DELLA CAPIENZA ──
              Una fascia tenuta per uno solo ha UN posto, anche se la capienza
              generale dice tre: se qui uscisse sempre «1/3», chi guarda
              leggerebbe che c'è posto su un'ora che non accetta più nessuno. */
          const soloLui = modi[o.ora] === "solo";
          const posti = soloLui ? 1 : o.capienza;
          /*  ── ⚠️ QUATTRO STATI, NON DUE ──────────────────────────────────
               Segnalazione del committente: «mi dà disponibilità che sono già
               occupate». Erano le ore che si ACCAVALLANO a una consulenza di
               un altro orario: contavano «1 di 3, c'è ancora posto», ma
               prenotandole non si entra in quella consulenza — se ne crea una
               seconda sovrapposta, con un altro link.
               Adesso lo stato lo decide una regola sola (`statoDellaFascia`) e
               qui si dipinge soltanto:
                · coperto → sbarrato e spento, con scritto DA COSA;
                · pieno   → rosso e spento;
                · insieme → ambra, si sceglie sapendo con chi;
                · libero  → normale.
               ⚠️ Sbarrato e non nascosto: un'ora che sparisce fa venire il
                dubbio che manchi per un errore del programma. */
          const coperto = o.stato === "coperto";
          const pieno = o.stato === "pieno" || (!coperto && o.presi >= posti);
          const spento = coperto || pieno;
          return (
            <Pillola
              key={o.ora}
              attiva={scelto}
              disabilitata={spento && !scelto}
              onClick={() => (!spento || scelto) && onScegli(attivo, o.ora)}
              className={cn(
                "py-2",
                !scelto &&
                  (coperto
                    ? "border-slate-200 bg-slate-100 text-slate-400 line-through"
                    : pieno
                      ? "border-red-300 bg-red-50 text-red-700"
                      : o.presi > 0 &&
                        "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"),
              )}
              titolo={
                coperto
                  ? `Coperto${o.copertoDa ? ` dalla consulenza delle ${o.copertoDa}` : ""}${o.chi ? ` di ${o.chi}` : ""}${o.fino ? `, fino alle ${o.fino}` : ""}: il consulente è già impegnato.`
                  : soloLui
                    ? `Tenuta per una persona sola${o.chi ? `: ${o.chi}` : ""}${o.presi >= 1 ? ". Nessun altro ci può entrare." : ". Il primo che entra la occupa tutta."}`
                    : pieno
                      ? `Fascia piena: ${o.presi} persone su ${posti}${o.fino ? `, fino alle ${o.fino}` : ""}. Scegli un altro orario.`
                      : o.presi > 0
                        ? `${o.presi} di ${posti}${o.chi ? ` · c'è già ${o.chi}` : ""}${o.fino ? `, fino alle ${o.fino}` : ""}. C'è ancora posto.`
                        : undefined
              }
            >
              <span className="flex items-center gap-1">
                {/*  Il lucchetto: è l'unica cosa che distingue a colpo
                     d'occhio un'ora tenuta per una persona sola da una
                     libera per tutti. Vedi il cartello in TastoOra. */}
                {soloLui && <Lock className="h-2.5 w-2.5 shrink-0 opacity-70" />}
                {o.ora}
              </span>
              {/*  ⚠️ IL CONTATORE SI VEDE SEMPRE, anche a zero. Segnalazione
                   del committente: «non mi dà gli slot disponibili dentro un
                   unico orario, sono 3 per ogni orario» — cioè quanti posti ha
                   quell'ora non si leggeva da nessuna parte finché non ce ne
                   finiva dentro almeno uno. */}
              <span className="text-[10px] font-semibold opacity-80">
                {/*  Su un'ora coperta il contatore direbbe sempre «0/3», cioè
                     «è libera»: al suo posto si dice da che ora è occupata. */}
                {coperto ? (o.copertoDa ? `← ${o.copertoDa}` : "occupato") : `${o.presi}/${posti}`}
              </span>
            </Pillola>
          );
        })}
      </div>
      {/*  ── LA SCELTA DELL'ORA APPENA SCELTA ──────────────────────────────
           Richiesta del committente: «se seleziono una data posso selezionare
           se bloccarla per solo quella persona, oppure se rimane aperta».
           Compare solo quando un'ora è selezionata — prima non c'è niente da
           decidere — e con le parole di quello che succede, non con la parola
           «esclusiva»: chi fissa un appuntamento non deve tradurre.
           ⚠️ Se in quell'ora c'è già qualcun altro, la scelta è già stata
            fatta e non si richiede: gli altri entrano aperti fino al massimo.
            È la seconda metà della richiesta — «quando già assegno 1 persona
            aperta a orario, poi quell'orario per tutti gli altri di default è
            aperto fino a 3». */}
      {oraScelta &&
        dataScelta === attivo &&
        (() => {
          const o = ore.find((x) => x.ora === oraScelta);
          if (!o) return null;
          const soloLui = modi[o.ora] === "solo";
          const altri = o.presi;
          const posti = soloLui ? 1 : o.capienza;
          return (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <p className="mb-1.5 text-[11.5px] font-semibold text-slate-700">
                Le {o.ora} di questo giorno
              </p>
              <SpuntaSoloUnaPersona
                ora={o.ora}
                presi={altri}
                capienza={o.capienza}
                modo={soloLui ? "solo" : "aperta"}
                onCambia={cambiaModo}
                salvando={salvandoModo}
                durata={durata}
                className="border-0 bg-transparent p-0"
              />
            </div>
          );
        })()}

      {ore.some((o) => o.presi > 0 || !o.libero) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-amber-300 bg-amber-100" />
            Il contatore dice quante persone hai già in quella fascia: fino a{" "}
            {ore[0]?.capienza ?? 3} si può ancora fissare.
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-red-300 bg-red-100" />
            Al numero pieno la fascia si chiude.
          </span>
        </p>
      )}
    </div>
  );
}

/** ── LO SCUDO ─────────────────────────────────────────────────────────────
 *  Un errore dentro un pezzo della finestra non deve portarsi via la scheda del
 *  contatto: è già successo, con un campo del consulente che nell'archivio
 *  importato ha una forma diversa da quella dichiarata, e la finestra è morta
 *  al montaggio con il cliente in linea. Qui il ramo che cade viene sostituito
 *  da un ripiego e il resto della finestra continua a funzionare.
 *
 *  DOVE È MESSO, E PERCHÉ PROPRIO LÌ
 *  Attorno a ogni pezzo che LEGGE DATI ALTRUI facendo un calcolo al montaggio:
 *   · la griglia degli orari (disponibilità del consulente);
 *   · la schermata della consegna, che si calcola l'agenda dell'installatore
 *     con lo stesso `generateAvailability`, dentro un `useMemo` senza rete;
 *   · «Altri dati», che monta storico acquisti e percorso del cliente.
 *  Non serve altrove: il resto della finestra legge solo il modulo, che entra
 *  già normalizzato. */
class Scudo extends Component<
  { ripiego: ReactNode; dove: string; children: ReactNode },
  { caduto: boolean }
> {
  state = { caduto: false };
  static getDerivedStateFromError() {
    return { caduto: true };
  }
  componentDidCatch(errore: unknown) {
    console.warn(`[CRM] ${this.props.dove}: pezzo caduto`, errore);
  }
  render() {
    return this.state.caduto ? this.props.ripiego : this.props.children;
  }
}

/* ── UNA SEZIONE CHE SI APRE TOCCANDOLA DOVUNQUE ───────────────────────────
   Richiesta del committente sulla fotografia di «Altri dati»: la sezione si
   apriva SOLO centrando la parolina «Apri» in alto a destra — un bersaglio da
   trenta pixel, sul telefono, in cima a una riga larga tutto lo schermo che
   invece sembra premibile. Chi tocca il titolo, il sottotitolo o lo spazio in
   mezzo non ottiene niente e conclude che la sezione è morta.

   COM'È FATTA, E PERCHÉ NON È UN DIV CON UN onClick
   L'intestazione È il pulsante: un <button> vero, quindi raggiungibile col
   tabulatore, premibile con Invio e con la barra spaziatrice, annunciato dal
   lettore di schermo insieme al suo `aria-expanded`. Un <div onClick> avrebbe
   lo stesso aspetto e nessuna di queste tre cose. Il titolo resta dentro un
   <h3> perché la finestra si scorre anche saltando da un titolo all'altro.

   LA REGOLA CHE NON VA ROTTA: dentro questa intestazione non va messo nessun
   altro comando. Un pulsante dentro un pulsante non è valido, e il tocco
   finirebbe per fare due cose insieme — la sezione si aprirebbe mentre si
   preme tutt'altro. Se un giorno servisse un'azione lì dentro, va messa nel
   CORPO della sezione, non nella riga che la apre.

   Le classi ricalcano quelle di SezioneFinestra (stesso bordo, stessa altezza
   dell'intestazione, stesse due righe di testo): le sezioni apribili e quelle
   fisse devono restare indistinguibili finché non le si tocca. */
function SezioneApribile({
  titolo,
  nota,
  icona: Icona,
  aperto,
  onCambio,
  classeCorpo,
  children,
}: {
  titolo: ReactNode;
  nota?: ReactNode;
  icona?: ComponentType<{ className?: string }>;
  aperto: boolean;
  onCambio: (v: boolean) => void;
  classeCorpo?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-white", BORDO_FINESTRA)}>
      <h3 className="min-w-0">
        <button
          type="button"
          aria-expanded={aperto}
          onClick={() => onCambio(!aperto)}
          className={cn(
            "flex w-full items-center justify-between gap-2 border-b px-4 py-2.5 text-left transition-colors hover:bg-slate-50",
            BORDO_FINESTRA,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {Icona && <Icona className="h-4 w-4 shrink-0 text-slate-400" />}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight text-slate-900">
                {titolo}
              </span>
              {nota ? (
                <span className="block truncate text-[11px] text-slate-500">{nota}</span>
              ) : null}
            </span>
          </span>
          {/*  La parola resta: dice cosa succede al tocco, e su una riga che
              si apre e si chiude la sola freccia è un indovinello. */}
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-600">
            {aperto ? "Chiudi" : "Apri"}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", aperto && "rotate-180")}
            />
          </span>
        </button>
      </h3>
      {/*  Il corpo si monta solo da aperto: «Altri dati» tira su lo storico
          acquisti e il percorso del cliente, che parlano con l'archivio. */}
      {aperto ? <div className={cn("p-4", classeCorpo)}>{children}</div> : null}
    </section>
  );
}

/** ── IL RIPIEGO DELLA POSA ────────────────────────────────────────────────
 *  La schermata della consegna fissa data e ora della posa scegliendo uno slot
 *  dall'agenda del tecnico, ed è il modo giusto: quello slot si blocca in
 *  agenda. Ma se il tecnico non è configurato, se la sua agenda non ha buchi o
 *  se la posa è stata concordata fuori orario, quella strada non porta a
 *  niente — e i due campi manuali che coprivano il caso stavano nella vecchia
 *  barra in cima, che non c'è più. Restano qui, chiusi, perché sono
 *  l'eccezione e non la regola.
 *
 *  CHI INSTALLA SI SCRIVE INSIEME AL QUANDO: l'agenda considera occupato uno
 *  slot solo se l'installazione dice di chi è. Senza quel nome lo stesso
 *  orario verrebbe offerto di nuovo a un altro cliente. */
function PosaManuale({ form, update }: { form: LeadData; update: Update }) {
  const [aperto, setAperto] = useState(false);
  const inst = form.installazione;
  const scrivi = (patch: { data?: string; ora?: string }) =>
    update("installazione", {
      ...inst,
      consulenteInstallazioneId: inst?.consulenteInstallazioneId ?? form.consulenteId ?? null,
      ...(patch.data !== undefined ? { dataInstallazione: patch.data } : {}),
      ...(patch.ora !== undefined ? { orarioInstallazione: patch.ora } : {}),
    });

  return (
    <SezioneApribile
      titolo="Data della posa a mano"
      nota={
        quandoLeggibile(inst?.dataInstallazione, inst?.orarioInstallazione) ||
        "Di norma si sceglie dall'agenda dell'installatore, qui sopra"
      }
      aperto={aperto}
      onCambio={setAperto}
      classeCorpo={GRIGLIA}
    >
      <Campo etichetta="Data dell'installazione">
        <Input
          type="date"
          className={CLASSI_CAMPO}
          value={inst?.dataInstallazione || ""}
          onChange={(e) => scrivi({ data: e.target.value })}
        />
      </Campo>
      <Campo etichetta="Ora dell'installazione">
        <Input
          type="time"
          className={CLASSI_CAMPO}
          value={inst?.orarioInstallazione || ""}
          onChange={(e) => scrivi({ ora: e.target.value })}
        />
      </Campo>
    </SezioneApribile>
  );
}

/** La stanza della consulenza: UN destinatario, UN tasto. Il link non si
 *  scrive a mano — lo genera il salvataggio — quindi il campo di testo non c'è
 *  più.
 *
 *  «ENTRA NELLA CONSULENZA» NON STA PIÙ QUI. Faceva la stessa identica cosa dei
 *  tasti «Avvia» di fuori (`avviaConsulenza`, MeetGiornalieri): stessa stanza,
 *  stessi dati del cliente dentro. Entrare in consulenza si fa dalla pagina
 *  Oggi, dall'agenda del giorno e dalla riga dell'elenco trattative, cioè dai
 *  posti in cui si è quando arriva l'ora dell'appuntamento.
 *
 *  COPIARE IL LINK È RIMASTO, ED È L'UNICO POSTO CHE LO FA. Fuori il link si
 *  può solo MANDARE su WhatsApp (i due messaggi già scritti sulla riga
 *  dell'agenda). Chi lo deve incollare in una mail, in un SMS o in un altro
 *  canale non ha nessun'altra strada in tutto il CRM: era da tenere. */
function StanzaConsulenza({ link }: { link: string }) {
  return (
    <SezioneFinestra
      titolo="Stanza della consulenza"
      nota="Preventivo, slide e registrazione restano legati a questo lead"
      icona={CalendarClock}
      classeCorpo="flex flex-wrap items-center gap-2 p-4"
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9"
        onClick={() => {
          //  Il messaggio arriva DOPO la copia riuscita: la scrittura negli
          //  appunti è negata su parecchie configurazioni, e un «Link copiato»
          //  su un incollaggio vuoto manda al cliente un messaggio a metà.
          const appunti = navigator.clipboard?.writeText(link);
          if (!appunti) {
            toast.error("Gli appunti non sono disponibili", {
              description: "Copia il link a mano dalla scheda.",
            });
            return;
          }
          appunti.then(
            () => toast.success("Link copiato — pronto da mandare al cliente"),
            () => toast.error("Copia non riuscita — riprova"),
          );
        }}
      >
        Copia il link per il cliente
      </Button>
    </SezioneFinestra>
  );
}

/* ── LA QUALIFICA ──────────────────────────────────────────────────────────
   Si compila MENTRE si parla, quindi vive dentro il blocco della chiamata e
   non in fondo alla finestra. */
function Qualifica({ form, update }: { form: LeadData; update: Update }) {
  //  `painPoints` è dichiarato array ma dall'archivio importato può arrivare
  //  in un'altra forma: senza questa porta, un `.includes` su un oggetto
  //  abbatteva la scheda al primo clic.
  const painPoints = Array.isArray(form.qualifica?.painPoints) ? form.qualifica!.painPoints! : [];
  //  Il cursore vuole un numero: un «7» arrivato come testo dall'archivio lo
  //  fa partire da una posizione che non esiste e non torna più indietro.
  const disagio = Number(form.qualifica?.disagio);
  const disagioValido = Number.isFinite(disagio) && disagio >= 1 && disagio <= 10 ? disagio : 5;
  //  Se `qualifica` non fosse un oggetto, sparpagliarlo produrrebbe chiavi
  //  numeriche al posto dei campi: si riparte da vuoto invece di salvarle.
  const base =
    form.qualifica && typeof form.qualifica === "object" && !Array.isArray(form.qualifica)
      ? form.qualifica
      : {};
  const patch = (p: Partial<NonNullable<LeadData["qualifica"]>>) =>
    update("qualifica", { ...base, ...p });

  //  Nessun bordo né riquadro propri: la riga di separazione la mette chi la
  //  monta, altrimenti dentro «Altri dati» si vedrebbero due filetti attaccati.
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Disagio estetico
          </span>
          <span className="text-[15px] font-semibold tabular-nums text-slate-900">
            {disagioValido}
            <span className="text-[12px] font-normal text-slate-400">/10</span>
          </span>
        </div>
        <Slider
          className="mt-2.5"
          value={[disagioValido]}
          min={1}
          max={10}
          step={1}
          onValueChange={(v) => patch({ disagio: v[0] })}
        />
      </div>
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Cosa lo blocca
        </span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PAIN_OPTS.map((p) => (
            <Scelta
              key={p}
              attiva={painPoints.includes(p)}
              onClick={() =>
                patch({
                  painPoints: painPoints.includes(p)
                    ? painPoints.filter((x) => x !== p)
                    : [...painPoints, p],
                })
              }
            >
              {p}
            </Scelta>
          ))}
        </div>
      </div>
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Urgenza
        </span>
        <div className={cn(GRIGLIA, "mt-2")}>
          {[
            { v: "si" as const, l: "È pronto" },
            { v: "valutando" as const, l: "Sta valutando" },
          ].map((o) => (
            <Scelta
              key={o.v}
              attiva={form.qualifica?.urgenza === o.v}
              onClick={() => patch({ urgenza: o.v })}
            >
              {o.l}
            </Scelta>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── ALTRI DATI ────────────────────────────────────────────────────────────
   Tutto ciò che serve una volta al mese: anagrafica completa, costi a
   consuntivo, tracciamento pubblicitario, storico, percorso del cliente.
   Resta raggiungibile ma non davanti agli occhi, e — cosa che conta più di
   tutte — il percorso del cliente si MONTA solo qui dentro: prima faceva due
   chiamate a Supabase a ogni apertura della finestra, per un pannello che
   nessuno dei lavori quotidiani guarda. */
function AltriDati({
  aperto,
  onCambio,
  form,
  update,
  bozza,
  lead,
  postVendita,
  salvaStorico,
  conQualifica,
}: {
  aperto: boolean;
  onCambio: (v: boolean) => void;
  form: LeadData;
  update: Update;
  bozza: Lead;
  lead: Lead | null;
  postVendita: boolean;
  salvaStorico: (patch: Partial<LeadData>) => void;
  /** true quando la qualifica non è già mostrata dal blocco della chiamata */
  conQualifica?: boolean;
}) {
  return (
    <SezioneApribile
      titolo="Altri dati"
      nota="Anagrafica completa, costi, tracciamento, storico"
      aperto={aperto}
      onCambio={onCambio}
      classeCorpo="space-y-4"
    >
      {aperto ? (
        <>
          <div className={GRIGLIA}>
            <Campo etichetta="Email">
              <Input
                className={CLASSI_CAMPO}
                value={form.email || ""}
                onChange={(e) => update("email", e.target.value)}
              />
            </Campo>
            <Campo etichetta="Città">
              <Input
                className={CLASSI_CAMPO}
                value={form.citta || ""}
                onChange={(e) => update("citta", e.target.value)}
              />
            </Campo>
            <Campo etichetta="Fonte">
              <select
                className={CLASSI_SELECT}
                value={form.fonte || "ADV"}
                onChange={(e) => update("fonte", e.target.value as LeadFonte)}
              >
                {FONTI.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Campo>
            {form.fonte === "ADV" && (
              <Campo etichetta="Piattaforma pubblicitaria">
                <select
                  className={CLASSI_SELECT}
                  value={form.piattaformaAds || "meta"}
                  onChange={(e) => update("piattaformaAds", e.target.value as PiattaformaAds)}
                >
                  <option value="meta">Meta (Facebook/Instagram)</option>
                  <option value="tiktok">TikTok</option>
                  <option value="none">Non pubblicitario</option>
                </select>
              </Campo>
            )}
          </div>

          {/* I costi entrano nel profitto e si mettono a consuntivo: è un
              lavoro del titolare, non di chi telefona. */}
          <div className="border-t border-slate-200 pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Costi · entrano nel profitto
            </p>
            <div className={cn(GRIGLIA, "mt-2")}>
              {(
                [
                  ["costoProdotto", "Prodotto (€)"],
                  ["costoInstallatore", "Installazione (€)"],
                  ["costoTaglio", "Taglio (€)"],
                ] as const
              ).map(([chiave, etichetta]) => (
                <Campo key={chiave} etichetta={etichetta}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    className={cn(CLASSI_CAMPO, "tabular-nums")}
                    value={form.payment?.costi?.[chiave] || 0}
                    onChange={(e) =>
                      update("payment", {
                        ...form.payment,
                        costi: { ...form.payment?.costi, [chiave]: Number(e.target.value) },
                      })
                    }
                  />
                </Campo>
              ))}
              <Campo etichetta="Prezzo di listino (€)" nota="Solo se c'è uno sconto da mostrare">
                <Input
                  type="number"
                  inputMode="decimal"
                  className={cn(CLASSI_CAMPO, "tabular-nums")}
                  value={form.payment?.prezzoTotale || 0}
                  onChange={(e) =>
                    update("payment", { ...form.payment, prezzoTotale: Number(e.target.value) })
                  }
                />
              </Campo>
              <Campo etichetta="Metodo di pagamento">
                <Input
                  className={CLASSI_CAMPO}
                  placeholder="es. Bonifico"
                  value={form.payment?.metodoPagamento || ""}
                  onChange={(e) =>
                    update("payment", { ...form.payment, metodoPagamento: e.target.value })
                  }
                />
              </Campo>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className={GRIGLIA}>
              <Campo etichetta="Codice colore">
                <Input
                  className={CLASSI_CAMPO}
                  value={form.codiceColore || ""}
                  onChange={(e) => update("codiceColore", e.target.value)}
                />
              </Campo>
              <Campo etichetta="Dettagli impianto">
                <Input
                  className={CLASSI_CAMPO}
                  value={form.dettagliImpianto || ""}
                  onChange={(e) => update("dettagliImpianto", e.target.value)}
                />
              </Campo>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-slate-700">Sotto osservazione</span>
              <Switch
                checked={!!form.highlighted}
                onCheckedChange={(v) => update("highlighted", v)}
              />
            </div>
          </div>

          {/* Acquisito il … e da dove: in sola lettura. La data di
              acquisizione era modificabile e, toccata, falsava i report. */}
          <div className="border-t border-slate-200 pt-4 text-[12px] text-slate-600">
            <p>
              Acquisito il{" "}
              <span className="font-medium text-slate-900 tabular-nums">
                {isoToDateInput(form.createdAt) || "—"}
              </span>
            </p>
            {form.tracking?.source && (
              <p className="mt-1 font-mono uppercase text-[11px] text-slate-500">
                {form.tracking.source}
                {form.tracking.utm_campaign ? ` · ${form.tracking.utm_campaign}` : ""}
              </p>
            )}
          </div>

          {conQualifica && (
            <div className="border-t border-slate-200 pt-4">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Qualifica del contatto
              </p>
              <Qualifica form={form} update={update} />
            </div>
          )}

          {/* Lo storico sta qui prima della vendita; dopo l'acconto lo mostra
              la schermata della consegna. Uno solo alla volta: due copie dello
              stesso contatore si contraddicono a vicenda.
              Sotto scudo perché legge le righe d'acquisto così come stanno in
              archivio (dove «acquisti» può essere un numero, un elenco di
              oggetti o una riga senza prodotto): un dettaglio storto qui non
              deve chiudere la scheda del contatto. */}
          {!postVendita && (
            <div className="border-t border-slate-200 pt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Storico acquisti
              </p>
              <Scudo
                dove="storico acquisti"
                ripiego={
                  <NotaFinestra tono="attenzione" icona={AlertTriangle}>
                    Lo storico acquisti di questo lead non è leggibile.
                  </NotaFinestra>
                }
              >
                {/*  `senzaScheda`: qui dentro siamo già in un riquadro, e con la
                    sua cornice erano tre bordi annidati — finestra, «Altri
                    dati», storico. Un livello solo, come tutto il resto. */}
                <StoricoAcquisti lead={lead ? bozza : null} onSalva={salvaStorico} senzaScheda />
              </Scudo>
            </div>
          )}

          {lead && (
            <Scudo
              dove="percorso cliente"
              ripiego={
                <NotaFinestra tono="attenzione" icona={AlertTriangle}>
                  Il percorso del cliente non si è caricato.
                </NotaFinestra>
              }
            >
              {/*  `lead.data?` e non `lead.data.`: le proprietà si calcolano QUI,
                  fuori dallo scudo (lo scudo protegge il render del figlio, non
                  la creazione dell'elemento), quindi una riga d'archivio senza
                  `data` porterebbe via l'intera scheda invece del solo pezzo. */}
              <PercorsoCliente leadId={lead.id} publicLeadId={lead.data?.publicLeadId} />
            </Scudo>
          )}
        </>
      ) : null}
    </SezioneApribile>
  );
}

function PercorsoCliente({ leadId, publicLeadId }: { leadId: string; publicLeadId?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [storico, setStorico] = useState<unknown[] | null>(null);

  //  Le due letture hanno un `catch`: senza, una rete che cade qui produce un
  //  rifiuto non gestito — nessun messaggio, e la riga «Caricamento percorso…»
  //  che resta lì per sempre facendo credere a una finestra bloccata.
  useEffect(() => {
    let vivo = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (vivo) setToken(data.session?.access_token ?? null);
      })
      .catch((e) => {
        console.warn("[CRM] sessione non leggibile", e);
        if (vivo) setToken(null);
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!publicLeadId) return;
    let vivo = true;
    supabase
      .from("public_leads")
      .select("touch_history")
      .eq("id", publicLeadId)
      .maybeSingle()
      //  Due argomenti e non `.catch`: quello che torna da qui è un
      //  `PromiseLike`, non una Promise vera, e `.catch` non esiste.
      .then(
        ({ data }) => {
          if (!vivo) return;
          const th = (data?.touch_history ?? null) as unknown[] | null;
          setStorico(Array.isArray(th) ? th : null);
        },
        (e: unknown) => {
          console.warn("[CRM] percorso cliente non leggibile", e);
          if (vivo) setStorico(null);
        },
      );
    return () => {
      vivo = false;
    };
  }, [publicLeadId]);

  if (!token) return <p className="text-[12px] text-slate-500">Caricamento percorso…</p>;
  return <LeadJourneyCard leadId={leadId} accessToken={token} touchHistory={storico as never} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL WIZARD DEL LEAD NUOVO
   Un passo per schermata. La finestra piena, a lead vuoto, è un modulo da
   compilare senza sapere da dove cominciare: qui le domande arrivano
   nell'ordine in cui si fanno al telefono.
   ═════════════════════════════════════════════════════════════════════════ */
function PassiWizard({
  doppioni,
  onVediDoppione,
  passo,
  vaiAlPasso,
  form,
  update,
  rifNome,
  rifTelefono,
  consultants,
  allLeads,
  messaggioWhatsApp,
  messaggioPromemoria,
  creato,
  consulente,
}: {
  passo: number;
  vaiAlPasso: (p: number) => void;
  form: LeadData;
  update: Update;
  rifNome: RefObject<HTMLInputElement | null>;
  rifTelefono: RefObject<HTMLInputElement | null>;
  consultants: Consultant[];
  allLeads: Lead[];
  messaggioWhatsApp: string | null;
  messaggioPromemoria?: string | null;
  creato: Lead | null;
  consulente?: Consultant;
  /** Le schede che hanno già questo numero, e come andarci: li calcola la
   *  finestra, perché è lei che sa qual è la scheda aperta (vedi
   *  crm/telefono-doppio). */
  doppioni?: Lead[];
  onVediDoppione?: () => void;
}) {
  return (
    <div className="space-y-3">
      {/*  `trim()`: uno spazio battuto per sbaglio nel nome non è un'identità,
          e sbloccava i passi successivi come se lo fosse. */}
      <BarraPassi
        passo={passo}
        vaiAlPasso={vaiAlPasso}
        //  Appuntamento, dati e provenienza si girano liberamente; la conferma
        //  si apre quando la persona ha un nome e un telefono.
        finoA={!!testo(form.nome).trim() && !!testo(form.telefono).trim() ? 3 : 2}
      />

      {passo === 2 && (
        <SezioneFinestra
          titolo="Da dove arriva"
          nota="Tutto facoltativo: si può completare più avanti"
          classeCorpo={cn(GRIGLIA, "p-4")}
        >
          <Campo etichetta="Fonte">
            <select
              className={CLASSI_SELECT}
              value={form.fonte || "ADV"}
              onChange={(e) => update("fonte", e.target.value as LeadFonte)}
            >
              {FONTI.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Campo>
          {form.fonte === "ADV" && (
            <Campo etichetta="Piattaforma pubblicitaria">
              <select
                className={CLASSI_SELECT}
                value={form.piattaformaAds || "meta"}
                onChange={(e) => update("piattaformaAds", e.target.value as PiattaformaAds)}
              >
                <option value="meta">Meta (Facebook/Instagram)</option>
                <option value="tiktok">TikTok</option>
                <option value="none">Non pubblicitario</option>
              </select>
            </Campo>
          )}
          <Campo etichetta="Città">
            <Input
              className={CLASSI_CAMPO}
              value={form.citta || ""}
              onChange={(e) => update("citta", e.target.value)}
            />
          </Campo>
          <Campo etichetta="Email">
            <Input
              className={CLASSI_CAMPO}
              value={form.email || ""}
              onChange={(e) => update("email", e.target.value)}
            />
          </Campo>
        </SezioneFinestra>
      )}

      {passo === 0 && (
        <>
          {/*  Non tutti i contatti si fissano subito: chi non ha risposto, o
              chi ha chiesto di essere richiamato, deve poter saltare questo
              passo senza inventarsi un appuntamento finto.
              ⚠️ ADESSO PORTA AI DATI, non alla conferma: l'appuntamento è il
               primo passo, quindi «non è ancora il momento» vuol dire «passo a
               scrivere chi è», non «ho finito». Portare alla conferma qui
               vorrebbe dire una scheda salvata senza nome né telefono. */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                update("stato", "da_contattare");
                update("dataMeeting", undefined);
                update("oraMeeting", undefined);
                vaiAlPasso(1);
              }}
              className="text-[12px] text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Non è ancora il momento →
            </button>
          </div>
          <CatenaAppuntamento
            form={form}
            update={update}
            consultants={consultants}
            allLeads={allLeads}
          />
        </>
      )}

      {passo === 1 && (
        <BloccoContatto
          doppioni={doppioni}
          onVediDoppione={onVediDoppione}
          form={form}
          update={update}
          rifNome={rifNome}
          rifTelefono={rifTelefono}
          messaggioWhatsApp={messaggioWhatsApp}
        />
      )}

      {passo === 3 && (
        <>
          <SezioneFinestra
            titolo="Conferma"
            nota="Tocca una riga per tornare a correggerla"
            senzaPadding
          >
            <dl className="divide-y divide-slate-200">
              {/*  ⚠️ OGNI RIGA TORNA AL SUO PASSO, e i passi sono cambiati:
                   l'appuntamento è il primo, i dati il secondo. Una riga che
                   riporta al passo sbagliato è peggio di una riga che non si
                   può toccare. */}
              <RigaRiepilogo
                etichetta="Quando"
                valore={quandoLeggibile(form.dataMeeting, form.oraMeeting) || "Nessun appuntamento"}
                onVai={() => vaiAlPasso(0)}
              />
              <RigaRiepilogo
                etichetta="Consulente"
                valore={nomeConsulente(consulente) || "Non assegnato"}
                onVai={() => vaiAlPasso(0)}
              />
              <RigaRiepilogo
                etichetta="Durata"
                valore={form.dataMeeting ? `${form.durataMeeting || DURATA_PREDEFINITA} min` : "—"}
                onVai={() => vaiAlPasso(0)}
              />
              <RigaRiepilogo
                etichetta="Nome"
                valore={`${form.nome} ${form.cognome}`.trim()}
                onVai={() => vaiAlPasso(1)}
              />
              <RigaRiepilogo
                etichetta="Telefono"
                valore={form.telefono}
                onVai={() => vaiAlPasso(1)}
              />
              <RigaRiepilogo
                etichetta="Fonte"
                valore={form.fonte || "—"}
                onVai={() => vaiAlPasso(2)}
              />
            </dl>
          </SezioneFinestra>

          {/* ── LA CONFERMA AL CLIENTE ────────────────────────────────────
              Il messaggio si compone dalla bozza, ma parte solo DOPO che il
              salvataggio è riuscito: prima si poteva mandare la conferma di un
              appuntamento che il salvataggio rifiutava. */}
          {!!form.dataMeeting && !!form.telefono && (
            <SezioneFinestra
              titolo="Conferma su WhatsApp"
              nota={creato ? "Il lead è salvato: puoi mandarla" : "Si attiva dopo il salvataggio"}
              classeCorpo="p-4 space-y-3"
            >
              {messaggioWhatsApp && (
                <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[12px] leading-snug text-slate-600">
                  {messaggioWhatsApp}
                </p>
              )}
              {creato ? (
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <a
                    href={buildWhatsAppLink(form.telefono, messaggioWhatsApp || "")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconaWhatsApp /> Manda la conferma
                  </a>
                </Button>
              ) : (
                <Button variant="outline" disabled className="w-full sm:w-auto">
                  <IconaWhatsApp /> Manda la conferma
                </Button>
              )}
            </SezioneFinestra>
          )}

          {creato && (
            <NotaFinestra tono="conferma" icona={Check}>
              Lead salvato. Puoi chiudere con «Fine».
            </NotaFinestra>
          )}
        </>
      )}
    </div>
  );
}

/** I quattro passi, sempre visibili: si sa dove si è e quanto manca. Si può
 *  tornare indietro toccandoli, ma solo dopo che nome e telefono ci sono —
 *  saltare avanti su un lead senza identità non porta da nessuna parte. */
function BarraPassi({
  passo,
  vaiAlPasso,
  finoA,
}: {
  passo: number;
  vaiAlPasso: (p: number) => void;
  /** ── ⚠️ FIN DOVE SI PUÒ SALTARE ──────────────────────────────────────
   *  Era un sì/no legato a «c'è nome e telefono», e con il nuovo ordine
   *  avrebbe chiuso la barra proprio al primo passo: all'appuntamento il nome
   *  non c'è ancora — è tutto il senso di cominciare da lì.
   *  Adesso dice fin dove si arriva: in avanti si gira liberamente fra
   *  appuntamento, dati e provenienza, e la CONFERMA si apre solo quando la
   *  persona ha un nome e un telefono — senza quei due non si salva comunque. */
  finoA: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {PASSI.map((nome, i) => {
        const fatto = i < passo;
        const corrente = i === passo;
        return (
          <button
            key={nome}
            type="button"
            disabled={i > passo && i > finoA}
            onClick={() => vaiAlPasso(i)}
            className={cn(
              "min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
              corrente
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : fatto
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-500",
              i > passo && i > finoA && "cursor-not-allowed opacity-50",
            )}
          >
            <span className="block truncate">
              {i + 1} · {nome}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RigaRiepilogo({
  etichetta,
  valore,
  onVai,
}: {
  etichetta: string;
  valore: string;
  onVai: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onVai}
      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
    >
      <dt className="text-[12px] text-slate-500">{etichetta}</dt>
      <dd className="min-w-0 truncate text-[13px] font-medium text-slate-900">{valore || "—"}</dd>
    </button>
  );
}
