/** ─────────────────────────────────────────────────────────────────────────
 *  SelettoreStatoDialog — "Cambia stato", UNA VOLTA SOLA PER TUTTO IL CRM
 *
 *  PERCHÉ ESISTE, E PERCHÉ NON DEVE ESISTERNE UN SECONDO
 *  Lo stato si cambiava in sei punti e in quattro modi diversi: un <select>
 *  nativo nella riga di Oggi (sul telefono apre la rotella di sistema, quindi
 *  quindici voci in colonna da leggere una per una), un altro <select> nel
 *  riquadro "Adesso", uno nella scheda del lead, due menu a tendina fra
 *  WhatsApp e la lente delle liste, e un pannello a elenco nella ricerca ⌘K.
 *  Due selettori si imparano due volte, e fra un mese uno dei due ha uno stato
 *  che l'altro non ha: è già successo — la tendina di WhatsApp proponeva la
 *  lista fissa `SELECTABLE_LEAD_STATUSES` e ignorava `statiPer`, cioè offriva
 *  a un lead importato gli stati della trattativa.
 *
 *  COM'È ADESSO
 *  Si preme la pastiglia dello stato e si apre una finestra con gli stati come
 *  PULSANTI in griglia — due colonne sul telefono, fino a quattro sul monitor —
 *  raggruppati per momento della trattativa.
 *   · COLORE MINIMO: la fase (da lavorare, in corso, in sospeso, vinto, perso,
 *     chiuso) sta in una barretta sul fianco del pulsante, non nel riempimento.
 *     Quindici pulsanti pieni di colore sono una tavolozza in cui non si
 *     distingue più niente; la tinta è la stessa delle pastiglie in elenco,
 *     quindi non c'è una tavolozza nuova da imparare;
 *   · UN'ICONA PER STATO, coerente con quello che lo stato significa. Dove
 *     un'icona sensata non c'è, non c'è nemmeno l'icona: una a caso è peggio
 *     di nessuna, perché si prova a interpretarla;
 *   · ICONA CALENDARIO sugli stati che RICHIEDONO UNA DATA. È un avviso, non un
 *     comando: dice che scegliendo quello stato verrà chiesta una data.
 *     L'elenco NON è riscritto qui — arriva da `STATI_CON_DATA`, che è
 *     derivato da `QUANDO_PER_STATO` (crm/quando-per-stato.ts);
 *   · si scrive per filtrare quando gli stati sono molti, ↑↓←→ scorrono, Invio
 *     applica, Esc svuota il filtro e solo dopo chiude;
 *   · bersagli da 56px: gli stati si cambiano col telefono in mano.
 *
 *  QUELLO CHE IL SELETTORE NON DECIDE
 *  Non sostituisce la PROCEDURA, solo la SCELTA. Uno stato che promette un
 *  momento continua ad aprire la finestrella che chiede giorno e ora
 *  (FinestraQuando nella scheda, QuickStatusDialog altrove); le tre chiusure
 *  vinte aprono la finestra della chiusura (ChiusuraDialog), che chiede acconto,
 *  su misura ed extra e salva anche lo stato. Questa finestra chiama `onScegli`
 *  e si toglie di mezzo.
 *  ⚠️ Chi riceve `onScegli` NON deve scrivere lo stato da sé quando è una
 *   chiusura vinta (`richiedeChiusura`): lo scrive ChiusuraDialog insieme agli
 *   importi, in un salvataggio solo. Uno stato scritto qui e dei soldi scritti
 *   dopo sono due momenti, e in mezzo c'è un lead verde con la cassa vuota.
 *
 *  QUALI STATI COMPAIONO
 *  Quelli che `statiPer` (crm/types) dichiara giusti per QUEL lead: chi lavora
 *  una lista importata vede gli esiti della prima chiamata, chi ha già fatto la
 *  consulenza vede quelli della trattativa. I tre esiti dell'appuntamento
 *  (svolta / cliente assente / da riprogrammare) restano fuori: hanno i loro
 *  pulsanti dedicati, e sono documentati in types.ts.
 *  ───────────────────────────────────────────────────────────────────────── */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import {
  Archive,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  Check,
  ChevronDown,
  Euro,
  Home,
  Hourglass,
  MapPin,
  MapPinOff,
  MessageCircle,
  Package,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Repeat,
  Scale,
  SearchX,
  Store,
  Tags,
  ThumbsDown,
  Undo2,
  TimerOff,
  Trophy,
  UserX,
  Voicemail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CLASSE_CAMPO, Finestra, VuotoFinestra } from "./ui/Finestra";
import {
  CLASSE_BADGE_STATO,
  PUNTO_TONO,
  Tasto,
  classiStato,
  etichettaStato,
  normalizza,
  tonoStato,
} from "./ui";
import {
  LEAD_PHASE_LABEL,
  LEAD_STATUS_PHASE,
  statiPer,
  type ExtraDaChiedere,
  type Lead,
  type LeadPhase,
  type LeadStatus,
} from "./types";
import { STATI_CON_DATA } from "./quando-per-stato";
//  `requiresAnyDialog` dice se dopo la scelta si aprirà una seconda finestra.
//  Serve per il secondo avviso — quello degli IMPORTI — e arriva da chi quella
//  finestra la disegna, così i due non possono dire cose diverse.
//  L'import va in una direzione sola: SelettoreStatoDialog → QuickStatusDialog.
import { requiresAnyDialog } from "./QuickStatusDialog";
//  Le tre chiusure vinte hanno la LORO finestra (acconto, su misura, extra da
//  chiedere) e il loro avviso da elenco. Qui servono due cose sole di quel
//  file: sapere che dopo la scelta si aprirà un modulo di importi, e la
//  pastiglia d'avviso da appendere accanto allo stato. L'import va in una
//  direzione sola — SelettoreStatoDialog → ChiusuraDialog — così non nasce un
//  ciclo: la finestra della chiusura non sa che questo selettore esiste.
import { AvvisoExtra, richiedeChiusura } from "./ChiusuraDialog";
import { ScorciatoieFinestra } from "./SchedaCliente";

/* ── LE ICONE: UNA PER STATO, E SOLO SE VUOL DIRE QUALCOSA ─────────────────
   Il criterio è che l'icona racconti il GESTO o l'ESITO, non la categoria:
   una cornetta con la freccia in uscita è la chiamata da fare, una cornetta
   spezzata è il "non risponde". Dove non esiste un'icona che dica la cosa
   giusta, la casella resta vuota: un simbolo generico si guarda comunque, e
   guardarlo per poi scoprire che non significa niente costa più che leggere
   la sola etichetta.
   Nota: `fatto` e `non_fatto` sono stati STORICI — non si assegnano più, ma
   compaiono come "stato attuale" sulle schede d'archivio, e anche lì devono
   avere la loro faccia. */
export const ICONA_STATO: Partial<Record<LeadStatus, ComponentType<{ className?: string }>>> = {
  da_contattare: PhoneOutgoing,
  non_risponde: PhoneMissed,
  segreteria: Voicemail,
  richiamo: PhoneCall,
  appuntamento_fissato: CalendarCheck,
  //  Ri-fissato: è lo stesso appuntamento che torna, non uno nuovo.
  appuntamento_rifissato: Repeat,
  fatto: CalendarCheck,
  //  Assente è il CLIENTE che manca, non l'appuntamento: la persona barrata lo
  //  dice, un calendario barrato direbbe "appuntamento annullato".
  non_fatto: UserX,
  no_show: UserX,
  da_spostare: CalendarX,
  venduto: Trophy,
  //  ── LE TRE CHIUSURE VINTE: SI DISTINGUONO PER DOVE FINISCE L'IMPIANTO ───
  //   Sono tre voci vicine in griglia e con etichette corte ("Nel nostro
  //   centro" / "A domicilio" / "Da spedire"): il colpo d'occhio deve arrivare
  //   dall'icona, non dalla lettura. Quindi NON tre coppe uguali — la coppa
  //   direbbe solo "vinto", che è già la barretta verde sul fianco — ma i tre
  //   posti diversi: la nostra vetrina, la casa del cliente, il pacco.
  //   ⚠️ `Store` è lo stesso simbolo che il menu usa per la lente «Nel nostro
  //   centro» (CRMSidebar): due facce diverse per lo stesso posto costringono
  //   a impararle due volte.
  posa_in_sede: Store,
  posa_a_domicilio: Home,
  posa_da_spedire: Package,
  acconto: Euro,
  //  "Irreperibile": si è cercato e non si è trovato. NON una cornetta — quelle
  //  sono già tre (chiamata da fare, non risponde, richiamo) e la quarta si
  //  confonderebbe proprio con "non_risponde", che è l'altra cosa che questo
  //  stato non è (types.ts lo dice per esteso).
  irreperibile: SearchX,
  in_attesa_acconto: Hourglass,
  viene_in_sede: MapPin,
  sede_disdetta: MapPinOff,
  gestire_in_chat: MessageCircle,
  //  "In valutazione": la bilancia è il cliente che sta pesando la proposta.
  sta_valutando: Scale,
  da_ricontattare: PhoneForwarded,
  //  La cornetta che ENTRA: la chiamata la fa lui, non noi. È l'opposto della
  //  freccia in uscita del ricontatto, e si distingue a colpo d'occhio.
  ci_ricontatta_lui: PhoneIncoming,
  fissa_meet_dopo: CalendarPlus,
  //  Perditempo: il tempo speso che non torna. Non un divieto — non è il
  //  cliente a essere vietato, è la trattativa che non esiste.
  perdi_tempo: TimerOff,
  //  "Non interessato": è il cliente che dice no, non un errore nostro.
  annullato: ThumbsDown,
  //  Una freccia che torna indietro: ha fatto un passo avanti e l'ha disfatto.
  //  Non il pollice giù di «Non interessato» — quello dichiara un no mai
  //  cambiato, questo un sì che si è sciolto.
  ripensamento: Undo2,
  concluso: Archive,
};

/** L'ordine dei gruppi è quello del tempo: si comincia al telefono e si finisce
 *  in archivio. Sono le sei fasi di types.ts — non un secondo elenco. */
const ORDINE_FASI: LeadPhase[] = [
  "da_lavorare",
  "in_corso",
  "in_sospeso",
  "vinta",
  "persa",
  "chiusa",
];

/** Sopra questa soglia l'elenco non si scorre più a colpo d'occhio e il campo
 *  di ricerca smette di essere ingombro e diventa la strada più corta. */
const SOGLIA_RICERCA = 8;

/** ── GLI STATI DA PROPORRE PER QUESTO LEAD ────────────────────────────────
 *  `statiPer` decide QUALI (primo contatto o trattativa) ed è la regola del
 *  committente, ripetuta: non si scavalca.
 *  Lo stato ATTUALE va però sempre mostrato, anche quando non è più fra le
 *  scelte: una scheda d'archivio segnata "Consulenza svolta" apparirebbe
 *  altrimenti senza stato corrente, cioè con la finestra che nega quello che
 *  la riga qui dietro sta scrivendo. Si continua a riconoscerlo, non ad
 *  assegnarlo (il suo pulsante è spento).
 *  Regge anche il dato sporco: `stato` può arrivare mancante o sconosciuto. */
export function statiSelezionabili(d: {
  importato?: boolean;
  dataMeeting?: string;
  consulenteId?: string | null;
  stato?: LeadStatus | string | null;
}): LeadStatus[] {
  const base = statiPer(d ?? {});
  const attuale = d?.stato as LeadStatus | undefined;
  return attuale && !base.includes(attuale) ? [attuale, ...base] : base;
}

/** Etichetta di uno stato con rete di sicurezza: dal database arriva anche
 *  quello che nessuna tabella conosce, e una casella vuota non si spiega.
 *  È `etichettaStato` di crm/ui — la stessa identica riga era scritta anche
 *  qui, e due copie della stessa rete di sicurezza sono il difetto che questo
 *  file esiste per togliere. Il nome locale resta perché lo usano i punti che
 *  passano `etichetta` come prop. */
export const etichettaDi: (s: LeadStatus | string | null | undefined) => string = etichettaStato;

/* ═══════════════════════════════════════════════════════════════════════════
   IL PULSANTE DI UNO STATO
   ═════════════════════════════════════════════════════════════════════════ */

function PulsanteStato({
  stato,
  etichetta,
  attuale,
  puntata,
  indice,
  onClick,
}: {
  stato: LeadStatus;
  etichetta: string;
  /** è lo stato che il lead ha adesso: si riconosce, non si preme */
  attuale: boolean;
  /** è la voce sotto il cursore della tastiera */
  puntata: boolean;
  /** posizione nell'ordine a schermo: la usa lo scorrimento da tastiera */
  indice: number;
  onClick: () => void;
}) {
  const Icona = ICONA_STATO[stato];
  const conData = STATI_CON_DATA.has(stato);
  //  Gli unici che aprono una seconda finestra SENZA chiedere una data sono
  //  quelli che chiedono degli IMPORTI (l'acconto, e le tre chiusure vinte):
  //  meritano il loro avviso, altrimenti l'assenza del calendario si legge
  //  «questo si chiude in un tocco» e invece arriva un modulo.
  //  ⚠️ Le due domande si fanno a DUE file diversi, e devono farsi tutte e due:
  //   `requiresAnyDialog` conosce il modulo dei pagamenti di QuickStatusDialog,
  //   `richiedeChiusura` conosce quello delle tre chiusure vinte. Chiederlo a
  //   uno solo dei due lascia metà degli stati che promettono un tocco e
  //   consegnano un modulo.
  const conImporti = !conData && (requiresAnyDialog(stato) || richiedeChiusura(stato));
  return (
    <button
      type="button"
      data-indice={indice}
      onClick={onClick}
      disabled={attuale}
      aria-current={attuale ? "true" : undefined}
      /*  Il titolo dice PRIMA di premere cosa succederà dopo: un calendario che
          si apre a sorpresa fa credere di aver sbagliato pulsante. */
      title={
        attuale
          ? `${etichetta} · è lo stato attuale`
          : conData
            ? `${etichetta} · chiederà giorno e ora`
            : conImporti
              ? `${etichetta} · chiederà gli importi`
              : etichetta
      }
      className={cn(
        //  56px: il bersaglio del pollice. Sotto i 44 si sbaglia riga, e questa
        //  finestra si usa in piedi, col telefono in una mano sola.
        "relative flex min-h-[56px] items-center gap-2 overflow-hidden rounded-xl border",
        "py-2 pl-3 pr-2 text-left transition-colors",
        attuale
          ? "cursor-default border-slate-300 bg-slate-100"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
        //  La voce sotto il cursore si segna con un anello, non con un fondo
        //  pieno: il fondo pieno affogava il testo che si sta per scegliere.
        puntata && !attuale && "border-sky-400 ring-2 ring-sky-200",
      )}
    >
      {/*  IL COLORE STA TUTTO QUI: una barretta di 3px sul fianco, il tono
          della fase. Stessa tinta delle pastiglie in elenco, quindi già nota. */}
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-[3px]", PUNTO_TONO[tonoStato(stato)])}
      />
      {Icona ? <Icona className="h-4 w-4 shrink-0 text-slate-500" /> : null}
      <span className="min-w-0 flex-1 text-[12.5px] font-medium leading-snug text-slate-900">
        {etichetta}
      </span>
      {/*  L'AVVISO DELLA DATA. Non è decorazione: è la differenza fra un tocco
          e un tocco più una finestrella da compilare. */}
      {conData ? (
        <CalendarDays
          aria-label="Chiederà giorno e ora"
          className="h-3.5 w-3.5 shrink-0 text-slate-400"
        />
      ) : conImporti ? (
        <Euro aria-label="Chiederà gli importi" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      ) : null}
      {/*  ── «È QUESTO» SI VEDE, NON SI LEGGE ──────────────────────────────
          Era la parola "attuale" in grigio chiaro accanto all'etichetta, e
          aveva due difetti in uno. Il primo: una scritta tenue in mezzo ad
          altre scritte si trova solo leggendo tutta la griglia, mentre una
          spunta è una FORMA e si vede con la coda dell'occhio (è la stessa
          correzione già fatta sui pulsanti d'esito della pagina Oggi).
          ⚠️ Il secondo, e il più caro: il pulsante è `overflow-hidden`, e da
          quando esistono le etichette lunghe delle chiusure vinte ("Nel nostro
          centro") in griglia a due colonne sul telefono l'etichetta si prende
          tutto lo spazio e "attuale" veniva tagliato a metà — cioè proprio
          sulla scheda d'archivio, l'unico posto dove quel segno serve, spariva.
          La spunta occupa 14px e non si taglia. */}
      {attuale ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" /> : null}
      {/*  Il segno visivo non basta a chi legge con la voce sintetica:
          `aria-current` sopra dice già "è questo", questa riga lo dice a
          parole senza occupare un pixel. */}
      {attuale ? <span className="sr-only">è lo stato attuale</span> : null}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA GRIGLIA — il cuore condiviso
   Sta separata dalla finestra perché la ricerca ⌘K la mostra dentro un pannello
   che è già in un dialogo: una finestra dentro una finestra è un velo sopra un
   velo, e il tasto Esc smetterebbe di sapere quale delle due chiudere.
   ═════════════════════════════════════════════════════════════════════════ */

export function GrigliaStati({
  stato,
  opzioni,
  onScegli,
  etichetta = etichettaDi,
  autoFocus = true,
  className,
}: {
  /** lo stato attuale: può mancare o essere sconosciuto */
  stato?: LeadStatus | string | null;
  /** gli stati proposti — sempre il risultato di `statiSelezionabili` */
  opzioni: LeadStatus[];
  onScegli: (s: LeadStatus) => void;
  /** per i punti che chiamano le cose con un altro nome (la scheda dice
   *  "Lead in chat" dove l'elenco dice "Trattativa in chat") */
  etichetta?: (s: LeadStatus) => string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [filtro, setFiltro] = useState("");
  const [indice, setIndice] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  const conRicerca = opzioni.length > SOGLIA_RICERCA;

  //  L'ordine è quello dei gruppi, non quello in cui gli stati arrivano: due
  //  finestre che mostrano gli stessi stati in ordine diverso sono due
  //  finestre da imparare.
  //  IL FILTRO LEGGE L'ETICHETTA CANONICA, non quella eventualmente riscritta
  //  dal chiamante: `etichetta` arriva spesso come funzione scritta al volo,
  //  quindi cambia identità a ogni render — metterla qui dentro rifarebbe
  //  `voci` a ogni render, e l'effetto che riposa il cursore lo riporterebbe
  //  in cima mentre lo si sta muovendo con le frecce.
  const gruppi = useMemo(() => {
    const q = normalizza(filtro).trim();
    const visibili = q ? opzioni.filter((s) => normalizza(etichettaDi(s)).includes(q)) : opzioni;
    return ORDINE_FASI.map((fase) => ({
      fase,
      //  `?? "da_lavorare"`: uno stato che nessuna tabella conosce non deve
      //  sparire dalla griglia, altrimenti il lead resta bloccato lì dentro.
      stati: visibili.filter((s) => (LEAD_STATUS_PHASE[s] ?? "da_lavorare") === fase),
    })).filter((g) => g.stati.length > 0);
  }, [opzioni, filtro]);

  /** L'elenco appiattito nell'ordine in cui si vede: è su questo che corre il
   *  cursore della tastiera, altrimenti le frecce salterebbero fra i gruppi in
   *  un ordine che a schermo non esiste. */
  const voci = useMemo(() => gruppi.flatMap((g) => g.stati), [gruppi]);

  //  Il fuoco va nel campo, non sulla crocetta: la finestra si apre per
  //  scrivere. Radix, quando monta il dialogo, porta il fuoco sul primo
  //  elemento raggiungibile — che nel guscio condiviso è il tasto di chiusura;
  //  con un rinvio a fine ciclo il campo se lo riprende.
  //  Quando gli stati sono pochi il campo non c'è: allora il fuoco va sul
  //  contenitore (tabIndex -1), altrimenti le frecce non arriverebbero a
  //  questo gestore e la tastiera resterebbe muta proprio dove il selettore è
  //  più corto — cioè dove si lavora una lista al telefono.
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => (conRicerca ? campoRef.current : listaRef.current)?.focus(), 0);
    return () => clearTimeout(t);
  }, [autoFocus, conRicerca]);

  //  Il cursore si posa sempre sulla prima voce APPLICABILE: partire sullo
  //  stato già in uso significherebbe che il primo Invio non fa nulla.
  useEffect(() => {
    const primo = voci.findIndex((s) => s !== stato);
    setIndice(primo >= 0 ? primo : 0);
  }, [voci, stato]);

  //  La casella scelta con le frecce deve restare visibile anche quando la
  //  griglia è più alta della finestra.
  useEffect(() => {
    listaRef.current
      ?.querySelector<HTMLElement>(`[data-indice="${indice}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [indice, voci.length]);

  const scegli = (s: LeadStatus | undefined) => {
    if (!s || s === stato) return;
    onScegli(s);
  };

  /** Sposta il cursore saltando lo stato già in uso (non è una scelta).
   *  Le frecce corrono sull'ordine a schermo: in una griglia che va da due a
   *  quattro colonne a seconda dello schermo, "la casella sopra" non è la
   *  stessa cosa in due momenti diversi — e una scorciatoia che cambia
   *  bersaglio con la larghezza della finestra non si impara. */
  const muovi = (passo: number) => {
    if (!voci.length) return;
    setIndice((i) => {
      let n = i;
      for (let k = 0; k < voci.length; k++) {
        n = (n + passo + voci.length) % voci.length;
        if (voci[n] !== stato) return n;
      }
      return i;
    });
  };

  const suTasto = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      muovi(1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      muovi(-1);
    } else if (e.key === "Enter") {
      //  Se il fuoco è già su un pulsante (ci si è arrivati col tabulatore),
      //  Invio deve premere QUELLO: rubarglielo qui applicherebbe la casella
      //  sotto al cursore, cioè un altro stato. È lo stesso guasto che la
      //  ricerca ⌘K aveva già trovato e chiuso.
      if ((e.target as HTMLElement | null)?.closest?.("button")) return;
      e.preventDefault();
      scegli(voci[indice]);
    } else if (e.key === "Escape" && filtro) {
      //  Esc svuota il filtro prima di chiudere: chi ha scritto per sbaglio
      //  non si ritrova la finestra sparita.
      e.preventDefault();
      e.stopPropagation();
      setFiltro("");
    }
  };

  return (
    <div onKeyDown={suTasto} className={cn("flex min-h-0 flex-col", className)}>
      {conRicerca && (
        <div className="shrink-0 border-b border-slate-200 px-3 py-2.5 sm:px-4">
          <Input
            ref={campoRef}
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Scrivi per filtrare…"
            aria-label="Filtra gli stati"
            className={CLASSE_CAMPO}
          />
        </div>
      )}

      <div
        ref={listaRef}
        //  -1: si può ricevere il fuoco a comando (vedi l'effetto qui sopra) ma
        //  non si finisce qui col tabulatore, che deve continuare a saltare da
        //  un pulsante all'altro.
        tabIndex={-1}
        aria-label="Stati disponibili"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 outline-none sm:p-4"
      >
        {voci.length === 0 ? (
          //  Due vuoti diversi, perché sono due fatti diversi: «non ho trovato
          //  quello che hai scritto» si rimedia cancellando, «per questo lead
          //  non c'è niente da proporre» no. Senza la distinzione, un elenco
          //  vuoto con il filtro vuoto scriveva «Nessuno stato corrisponde a
          //  “”», cioè una frase che non si può nemmeno leggere.
          <VuotoFinestra
            testo={
              filtro.trim()
                ? `Nessuno stato corrisponde a “${filtro}”.`
                : "Nessuno stato da proporre per questo lead."
            }
          />
        ) : (
          gruppi.map((g) => (
            <div key={g.fase} className="shrink-0">
              {/*  L'intestazione è discreta di proposito: serve a separare, non
                   a essere letta. Chi cerca uno stato guarda i pulsanti. */}
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PUNTO_TONO[g.fase])}
                />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {LEAD_PHASE_LABEL[g.fase]}
                </span>
              </div>
              {/*  Due colonne sul telefono — sotto i 640px tre pulsanti in riga
                   danno bersagli da 100px con l'etichetta tagliata a metà. */}
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {g.stati.map((s) => (
                  <PulsanteStato
                    key={s}
                    stato={s}
                    etichetta={etichetta(s)}
                    attuale={s === stato}
                    puntata={voci[indice] === s}
                    indice={voci.indexOf(s)}
                    onClick={() => scegli(s)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA FINESTRA — quello che si apre premendo la pastiglia
   ═════════════════════════════════════════════════════════════════════════ */

export function FinestraStati({
  aperta,
  onChiudi,
  stato,
  opzioni,
  contesto,
  onScegli,
  etichetta,
}: {
  aperta: boolean;
  onChiudi: () => void;
  stato?: LeadStatus | string | null;
  opzioni: LeadStatus[];
  contesto?: string;
  onScegli: (s: LeadStatus) => void;
  etichetta?: (s: LeadStatus) => string;
}) {
  return (
    <Finestra
      aperta={aperta}
      onCambio={(v) => !v && onChiudi()}
      titolo="Cambia stato"
      icona={Tags}
      contesto={contesto}
      larghezza="md"
      senzaPadding
      classeCorpo="flex flex-col"
      /*  Non c'è un tasto «Salva»: la scelta È il salvataggio, quindi in fondo
          resta solo la via d'uscita. */
      azioni={
        <>
          <ScorciatoieFinestra salva={false}>
            <span className="inline-flex items-center gap-1">
              <Tasto>↑</Tasto>
              <Tasto>↓</Tasto> scorri
            </span>
            <span className="inline-flex items-center gap-1">
              <Tasto>Invio</Tasto> applica
            </span>
          </ScorciatoieFinestra>
          <Button variant="outline" onClick={onChiudi}>
            Annulla
          </Button>
        </>
      }
    >
      <GrigliaStati stato={stato} opzioni={opzioni} onScegli={onScegli} etichetta={etichetta} />
    </Finestra>
  );
}

/** La finestra a partire da un LEAD: gli stati giusti li calcola lei.
 *  `lead === null` significa "chiusa" — è la forma che usa già l'elenco lead e
 *  che permette di tenere un solo pezzo di stato nella pagina. */
export function SelettoreStatoDialog({
  lead,
  onChiudi,
  onScegli,
}: {
  /** la trattativa da cambiare; `null` = finestra chiusa */
  lead: Lead | null;
  onChiudi: () => void;
  onScegli: (lead: Lead, stato: LeadStatus) => void;
}) {
  //  Gli hook stanno sopra ogni uscita anticipata, sempre: `lead` diventa null
  //  a ogni chiusura, e un ramo che salta un hook cambia l'ordine degli hook.
  const opzioni = useMemo(() => (lead ? statiSelezionabili(lead.data ?? {}) : []), [lead]);

  return (
    <FinestraStati
      aperta={!!lead}
      onChiudi={onChiudi}
      stato={lead?.data?.stato}
      opzioni={opzioni}
      contesto={
        lead
          ? `${lead.data?.nome ?? ""} ${lead.data?.cognome ?? ""} · adesso: ${etichettaDi(lead.data?.stato)}`.trim()
          : undefined
      }
      onScegli={(s) => lead && onScegli(lead, s)}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA PASTIGLIA — il pulsante che apre la finestra
   È lei che si sostituisce ai <select> nativi e alle tendine: chi la mette in
   pagina non deve più occuparsi né di aprire, né di chiudere, né di sapere
   quali stati proporre.
   Da qui passa anche l'AVVISO dei soldi ancora da chiedere: le pagine che
   mostrano la pastiglia le passano già tutta la scheda, quindi l'avviso compare
   nell'elenco di Oggi, nella tabella "da fare", in WhatsApp e nella scheda
   senza che nessuno di quei file cambi una riga.
   ═════════════════════════════════════════════════════════════════════════ */

export function PastigliaStato({
  dati,
  onScegli,
  contesto,
  etichetta = etichettaDi,
  className,
  disabilitata,
}: {
  /** i campi del lead che servono a decidere gli stati e a mostrare l'attuale */
  dati: {
    importato?: boolean;
    dataMeeting?: string;
    consulenteId?: string | null;
    stato?: LeadStatus | string | null;
    /** ── PERCHÉ UN CAMPO CHE CON GLI STATI NON C'ENTRA ────────────────────
     *  Perché è l'unico modo di far uscire dalla scheda l'avviso dei soldi
     *  ancora da chiedere. Chi monta questa pastiglia le passa già `lead.data`
     *  intero — l'elenco di Oggi, la tabella "da fare", WhatsApp, la scheda —
     *  quindi il campo arriva da solo e l'avviso compare in tutte e quattro
     *  senza toccare nessuno di quei file.
     *  Resta facoltativo: chi passa solo i quattro campi di prima continua a
     *  funzionare, semplicemente senza avviso. */
    extraDaChiedere?: ExtraDaChiedere;
  };
  onScegli: (s: LeadStatus) => void;
  /** la riga sotto il titolo della finestra: di solito il nome del cliente */
  contesto?: string;
  etichetta?: (s: LeadStatus) => string;
  className?: string;
  disabilitata?: boolean;
}) {
  const [aperta, setAperta] = useState(false);
  const opzioni = useMemo(() => statiSelezionabili(dati ?? {}), [dati]);
  const stato = dati?.stato;

  return (
    <>
      <button
        type="button"
        disabled={disabilitata}
        //  La pastiglia vive dentro righe che si aprono al clic: senza questo
        //  il cambio stato aprirebbe anche la scheda del lead dietro.
        onClick={(e) => {
          e.stopPropagation();
          setAperta(true);
        }}
        //  ── IL TITOLO PORTA L'ETICHETTA PER INTERO ────────────────────────
        //   Era il solo "Cambia stato", cioè diceva a cosa serve il pulsante e
        //   non cosa c'è scritto sopra. Il testo dentro è `truncate`, e i
        //   chiamanti gli danno larghezze massime strette (160px nella riga di
        //   Oggi, 190px nel riquadro "Adesso"): da quando esistono etichette
        //   lunghe come «Appuntamento rifissato» o «Nel nostro centro», l'unico
        //   modo di leggere lo stato per esteso era APRIRE la finestra — cioè
        //   entrare in un menu di scrittura per fare una domanda di lettura, che
        //   è anche il modo più facile per cambiare stato per sbaglio.
        title={`${etichetta(stato as LeadStatus)} · cambia stato`}
        aria-haspopup="dialog"
        aria-label={`Stato: ${etichetta(stato as LeadStatus)}. Cambialo`}
        className={cn(
          CLASSE_BADGE_STATO,
          classiStato(stato),
          "h-7 cursor-pointer transition hover:brightness-95 disabled:cursor-default disabled:opacity-60",
          className,
        )}
      >
        <span className="truncate">{etichetta(stato as LeadStatus)}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </button>

      {/*  ── I SOLDI CHE IL CLIENTE ANCORA NON SA ─────────────────────────────
           Sta FUORI dal pulsante e non dentro: dentro sarebbe parte del
           bersaglio che apre la finestra degli stati, e prenderebbe i colori
           della pastiglia — cioè verde su un lead vinto, che è il contrario di
           quello che vuol dire.
           E non c'è nemmeno un contenitore intorno ai due: chi monta la
           pastiglia le passa classi di posizionamento (`ml-auto`, larghezze
           massime) che valgono nella riga del chiamante, e infilarci in mezzo
           un <span> le farebbe agire dentro una scatola nuova, spostando
           l'allineamento in tre schermate diverse. Restano due fratelli nella
           stessa riga, come se fossero stati scritti lì. */}
      <AvvisoExtra dati={dati} />

      <FinestraStati
        aperta={aperta}
        onChiudi={() => setAperta(false)}
        stato={stato}
        opzioni={opzioni}
        contesto={contesto}
        etichetta={etichetta}
        onScegli={(s) => {
          //  Prima si chiude, poi si sceglie: quasi sempre `onScegli` apre una
          //  SECONDA finestra (giorno e ora, gli importi), e due dialoghi
          //  aperti insieme si rubano il fuoco e lasciano due veli sovrapposti.
          setAperta(false);
          onScegli(s);
        }}
      />
    </>
  );
}
