// ── LEAD IMPORTATI — LA CASA DELLE LISTE DA CHIAMARE ────────────────────────
//  Indirizzo: /CRM/avanzamento. Per anni «pipeline», poi «Avanzamento», poi
//  «Da fare». L'INDIRIZZO NON CAMBIA MAI: è nei preferiti di chi lo apre ogni
//  mattina, ci puntano il menu (crm/CRMSidebar.tsx), la pagina iniziale del CRM
//  (routes/CRM.index.tsx), la ricerca ⌘K (che usa GRUPPI_MENU) e la tabella dei
//  vecchi nomi (routes/CRM.$.tsx, alias «pipeline»). Cambia solo come si chiama
//  a schermo.
//
//  ── PERCHÉ SI CHIAMA «LEAD IMPORTATI» ─────────────────────────────────────
//  «Da fare» non dice cosa c'è dentro: qualunque schermata del CRM è roba da
//  fare. Il committente ha proposto «Lead importati» e il nome è quello, perché
//  descrive il LAVORO che ci si viene a fare: si carica una lista e la si
//  chiama, una riga dopo l'altra. È il mestiere del setter, ed è la sola
//  schermata da cui adesso quel lavoro si fa per intero — caricare il CSV,
//  vedere com'è stato letto, scrivere l'archivio, chiamare, segnare l'esito.
//
//  ── E TUTTI GLI ALTRI LEAD? RESTANO, IN UNA LENTE ACCANTO ─────────────────
//  Questa pagina mostrava TUTTI i lead aperti ordinati per scadenza. Quella
//  coda non è sparita e non poteva sparire: è l'unico posto del CRM in cui si
//  vede «cosa è in ritardo» su tutto l'archivio. Adesso sono DUE LENTI:
//   · «Lead importati» (quella d'ingresso): solo le liste caricate e non ancora
//     lavorate, con il vocabolario della PRIMA CHIAMATA;
//   · «Tutta la coda»: esattamente ciò che questa pagina faceva prima, righe,
//     colonne, numeri e azioni di gruppo compresi.
//  La lente scelta si ricorda: chi apriva la coda ogni mattina la ritrova.
//  NESSUNA SCHEDA SPARISCE DAL CRM: un lead importato si vede qui, si vede in
//  /CRM/trattative dentro «Tutte» e col filtro «Da una lista importata», e
//  compare in «Tutta la coda» appena ha una scadenza.
//
//  ── COSA È ARRIVATO QUI DALL'ELENCO LEAD ──────────────────────────────────
//  Il gruppo «Importati» di /CRM/trattative non esiste più: lì i lead di una
//  lista si mescolavano a quelli avviati e portavano con sé un vocabolario di
//  stati tutto loro. Sono arrivate qui, una per una:
//   · il caricamento del CSV (prima un pulsante nella testata dell'elenco);
//   · il filtro «esito della prima chiamata», doppioni compresi;
//   · l'ordine con cui si lavora una lista al telefono (PESO_PRIMA_CHIAMATA);
//   · gli stati di primo contatto, sia in blocco sia riga per riga.
//
//  ── IL PERIODO È SUO, E PARTE DA «TUTTO» ──────────────────────────────────
//  Il periodo (barra della pagina) taglia sulla data di INGRESSO del lead: con
//  «30 giorni» un lead entrato a marzo e in ritardo da ieri sparirebbe dalla
//  coda, e chi guarda crederebbe di essere in pari. Per questo si apre su tutto
//  lo storico e l'avvertimento qui sotto compare appena si restringe.
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCRM } from "@/crm/CRMContext";
import { useAuth, usePuo } from "@/crm/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Pannello } from "@/crm/ui/Finestra";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  SELECTABLE_LEAD_STATUSES,
  //  Il vocabolario della prima chiamata NON si riscrive qui: sta in crm/types
  //  e lo usa anche la scheda del lead per proporre gli stati giusti.
  STATI_PRIMO_CONTATTO,
  //  L'elenco dei vinti sta in un posto solo. Rinominato all'ingresso perché
  //  qui esiste già un `STATI_VINTI` locale che vale UNA cosa in più
  //  ("concluso", vedi più sotto): due nomi uguali per due insiemi diversi
  //  nello stesso file sarebbero la prossima svista.
  STATI_VINTI as STATI_VINTI_CANONICI,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "@/crm/types";
import type { FiltroPeriodo, Intervallo } from "@/crm/kpi-calcoli";
import { CVR_BASSO } from "@/crm/kpi/soglie";
//  Chi può fare una consulenza si chiede lì e solo lì: vedi la testata di quel
//  file per il perché il filtro non si riscrive in ogni scheda.
import { TESTO_SOLO_CONSULENTI, consulentiPerConsulenza } from "@/crm/chi-fa-la-consulenza";
import { LeadDialog } from "@/crm/LeadDialog";
import { QuickStatusDialog, requiresAnyDialog } from "@/crm/QuickStatusDialog";
import { AvvisoExtra, richiedeChiusura, useChiusura } from "@/crm/ChiusuraDialog";
//  Il selettore di stato è uno solo in tutto il CRM (crm/SelettoreStatoDialog):
//  qui la riga aveva la sua tendina.
import { PastigliaStato } from "@/crm/SelettoreStatoDialog";
import { buildWhatsAppLink } from "@/crm/whatsapp";
//  IL RICONOSCIMENTO DEL CSV NON STA QUI. Intestazioni in italiano e in
//  inglese, separatore, stati con un altro nome, righe scartate, colonne
//  ignorate: tutto in crm/import-backup, che è lo stesso motore di /CRM/importa
//  e dell'importazione di un archivio intero. Qui si CHIAMA e si mostra.
import { noteDelLead, separaRitorni, traduciCsv } from "@/crm/import-backup";
import {
  AiutoScorciatoie,
  BarraAzioni,
  BarraSelezione,
  ChipAzione,
  ChipStato,
  Kpi,
  KpiRiga,
  SCORCIATOIE_COMUNI,
  Scheda,
  Segmento,
  SepBarra,
  Vuoto,
  contaInRitardo,
  dataBreve,
  esportaCsvLead,
  eur,
  normalizza,
  ordinaPerUrgenza,
  prossimaAzione,
  saldoDaIncassare,
  soloCifre,
  useScorciatoie,
  type Scorciatoia,
} from "@/crm/ui";
import {
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  GitBranch,
  LayoutGrid,
  List as ListIcon,
  MessageCircle,
  Phone,
  Plus,
  Table2,
  Upload,
  UserRound,
  X,
} from "lucide-react";

//  Gruppi di stati usati dai riquadri: "vinto" comprende anche le pratiche
//  concluse, che sono vendite arrivate in fondo.
//
//  ATTENZIONE — QUI IL CONTO È DIVERSO DALLA PANORAMICA, ED È VOLUTO. Là
//  `eConversione` (crm/kpi-calcoli) esclude di proposito "concluso", perché
//  replica il CRM storico dell'azienda e i numeri a cui l'utente è abituato.
//  In una coda di lavoro nascondere le pratiche concluse dalle vinte vorrebbe
//  dire far sparire le vendite arrivate in fondo: qui contano. La conseguenza è
//  che la percentuale di conversione di questa scheda può essere più alta di
//  quella della panoramica, e il riquadro lo dice a chiare lettere invece di
//  lasciarlo scoprire per differenza.
//  ⚠️ L'elenco NON è più scritto a mano: arriva da `STATI_VINTI` di types.ts
//  (importato qui come STATI_VINTI_CANONICI), che conosce anche le tre chiusure
//  vinte. Riscritto a mano perdeva silenziosamente ogni vendita chiusa come
//  «Nel nostro centro» / «A domicilio» / «Da spedire»: il filtro «vinti» le
//  saltava, il conteggio le dava per zero, e nessun errore avvisava — il numero
//  compariva lo stesso, era solo sbagliato.
//  "concluso" resta AGGIUNTO qui, e resta una scelta di questa scheda soltanto:
//  types.ts lo tiene fuori dai vinti di proposito (una pratica archiviata non è
//  detto che sia stata vinta), ma in questa coda di lavoro le vendite arrivate
//  in fondo devono continuare a contare — è il motivo scritto qui sopra, e la
//  differenza col resto del CRM la dichiara il riquadro a schermo.
const STATI_VINTI: LeadStatus[] = [...STATI_VINTI_CANONICI, "concluso"];
const STATI_PERSI: LeadStatus[] = ["no_show", "perdi_tempo"];

//  Gli stati che chiedono altri dati (acconto, data di ricontatto, sede) hanno
//  una finestra dedicata e NON possono essere assegnati a venti righe insieme:
//  si perderebbe il dato che li rende utili. Stessa regola dell'elenco lead,
//  così le due schermate offrono le stesse voci.
//  ⚠️ Le domande sono DUE: `requiresAnyDialog` conosce il modulo dei pagamenti
//  e le date, `richiedeChiusura` conosce le tre chiusure vinte, che hanno una
//  finestra propria e che la prima domanda non intercetta. Senza la seconda,
//  «Nel nostro centro» finiva fra gli stati applicabili a cinquanta lead in un
//  colpo: cinquanta vendite senza un euro registrato su nessuna.
const STATI_MASSIVI = SELECTABLE_LEAD_STATUSES.filter(
  (s) => !requiresAnyDialog(s) && !richiedeChiusura(s),
);
const ESITI_MASSIVI: LeadStatus[] = ["fatto", "non_fatto", "da_spostare"];

/** ── GLI ESITI DI UNA PRIMA CHIAMATA ──────────────────────────────────────
 *  Gli stati di primo contatto MENO i due appuntamenti: fissare l'appuntamento
 *  fa uscire il lead dalla lista (vedi `eInLista`), quindi come filtro non
 *  toglierebbe mai una riga — mentre come ESITO da assegnare serve eccome, ed è
 *  infatti nel menu degli stati della riga. */
const STATI_PRIMA_CHIAMATA = STATI_PRIMO_CONTATTO.filter(
  (s) => s !== "appuntamento_fissato" && s !== "appuntamento_rifissato",
);

/** In blocco si assegnano solo gli stati di primo contatto che non aprono una
 *  finestra: «appuntamento fissato» su venti righe insieme scriverebbe lo
 *  stesso giorno e la stessa ora a venti persone diverse. */
//  Stessa doppia domanda di STATI_MASSIVI: oggi nessuna chiusura vinta è fra
//  gli stati di primo contatto, ma quell'elenco è di types.ts e può cambiare
//  senza che nessuno passi di qui — e il filtro che lo dimentica non fa rumore.
const STATI_LISTA_MASSIVI = STATI_PRIMO_CONTATTO.filter(
  (s) => !requiresAnyDialog(s) && !richiedeChiusura(s),
);

/** ── CHI È ANCORA «UNA RIGA DI UNA LISTA» ──────────────────────────────────
 *  Importato e senza consulenza fissata: appena ha data E consulente smette di
 *  essere una riga da chiamare e diventa un lead in lavorazione. È la stessa
 *  regola di `statiPer` (crm/types) e del gruppo che stava in /CRM/trattative:
 *  se un giorno cambia, va cambiata in tutti e due i punti.
 *  Lettura difensiva: una scheda vecchia può non avere `data`. */
const eInLista = (l: Lead) => !!l?.data?.importato && !(l.data.dataMeeting && l.data.consulenteId);

/** Un lead nato da una lista che l'appuntamento ce l'ha: è il risultato del
 *  lavoro al telefono, e il numero che dice se la lista sta rendendo. */
const eDiventatoAppuntamento = (l: Lead) =>
  !!l?.data?.importato && !!l.data.dataMeeting && !!l.data.consulenteId;

type Vista = "kanban" | "lista";
type Lente = "importati" | "coda";
type Ordine = "urgenza" | "recenti" | "valore";
type FiltroFase = LeadStatus | "all" | "won" | "lost" | "open";
/** L'esito della prima chiamata usato come filtro. "duplicato" non è uno stato:
 *  è la condizione di chi era già in archivio. */
type EsitoPrimaChiamata = "tutti" | "duplicato" | LeadStatus;

const ORDINI: { chiave: Ordine; titolo: string; spiega: string }[] = [
  { chiave: "urgenza", titolo: "Cosa scade prima", spiega: "In cima ciò che è già in ritardo" },
  { chiave: "recenti", titolo: "Più recenti", spiega: "Ordine di acquisizione del contatto" },
  { chiave: "valore", titolo: "Valore", spiega: "Dal preventivo più alto" },
];

/* ── L'ORDINE CON CUI SI LAVORA UNA LISTA ──────────────────────────────────
   In una lista appena caricata quasi nessuno ha una data: sono tutti a pari
   merito e l'imminenza non discrimina più niente. Allora a parità decide
   l'ordine in cui una lista si lavora al telefono — prima i richiami promessi
   (qualcuno ha detto «richiamami»), poi chi non è mai stato chiamato, poi la
   segreteria, poi chi non risponde. Arriva pari pari dal gruppo «Importati»
   dell'elenco lead: era la sua unica regola d'ordine, e senza sarebbe stata
   una funzione tolta e non sostituita. */
const PESO_PRIMA_CHIAMATA: Record<string, number> = {
  richiamo: 0,
  da_contattare: 1,
  segreteria: 2,
  non_risponde: 3,
};

const perCognome = (l: Lead) => `${l.data?.cognome || ""} ${l.data?.nome || ""}`;

/** ── IL NOME, ANCHE QUANDO NON C'È ─────────────────────────────────────────
 *  Una lista vera arriva anche con il solo numero di telefono (l'importazione
 *  accetta la riga: un numero da chiamare è un lead). Senza ripiego la riga
 *  mostrava una striscia bianca dove sta il nome, e chi la vede pensa a una
 *  scheda rotta invece che a un contatto da qualificare. */
const nomeDi = (l: Lead) => `${l.data?.nome || ""} ${l.data?.cognome || ""}`.trim();

function ordinaPerPrimaChiamata(righe: Lead[]): Lead[] {
  return [...righe]
    .map((l) => ({
      l,
      urgenza: prossimaAzione(l).urgenza,
      peso: PESO_PRIMA_CHIAMATA[l.data?.stato] ?? 4,
    }))
    .sort(
      (a, b) =>
        a.urgenza - b.urgenza ||
        a.peso - b.peso ||
        perCognome(a.l).localeCompare(perCognome(b.l), "it"),
    )
    .map((x) => x.l);
}

const SCORCIATOIE: Scorciatoia[] = [
  ["V", "Cambia vista: colonne o elenco"],
  ["R", "Mostra solo ciò che è in ritardo"],
  ["I", "Apri o chiudi il caricamento di una lista"],
  ["A", "Seleziona tutte le righe visibili"],
  ["E", "Esporta quello che vedi"],
  ...SCORCIATOIE_COMUNI,
];

/** Il promemoria per chi non può caricare liste: la lettera che non fa niente
 *  non si annuncia, altrimenti la si prova e si crede che sia rotta. */
const SCORCIATOIE_SENZA_IMPORT: Scorciatoia[] = SCORCIATOIE.filter(([t]) => t !== "I");

/** La chiave con cui si ricorda la lente scelta. */
const CHIAVE_LENTE = "crm-lead-importati-lente";

/* ═══════════════════════════════════════════════════════════════════════════
   IL TASTO DELLA CORNETTA — IL GESTO DELLA GIORNATA

   Per un setter la telefonata non è "un'azione fra le altre": è IL lavoro,
   duecento volte al giorno. Perciò sulla riga la cornetta non è un'iconcina
   grigia come le altre — è l'unico comando pieno e colorato, alto abbastanza
   da prendersi col pollice senza mirare.

   ⚠️ SUL COMPUTER UN COLLEGAMENTO tel: PUÒ NON FARE NULLA. Se non c'è un'app
   associata, il clic non apre niente e il tasto sembra rotto: si preme due, tre
   volte, e si perde la chiamata. Non esiste modo di sapere DOPO se il sistema
   l'ha aperto, quindi si decide PRIMA guardando l'apparecchio: dove il tocco è
   l'unico modo di puntare (telefono, tablet) il tasto è un collegamento tel:
   diretto; su tutto il resto apre un riquadro con il numero grande, il tasto
   per copiarlo e — per chi il programma per chiamare ce l'ha davvero — il
   collegamento tel:. Meglio un riquadro in più che un tasto che non fa niente.
   ═════════════════════════════════════════════════════════════════════════ */

/** Vero solo dove il dito è l'unico modo di puntare: lì `tel:` apre il
 *  telefono e non c'è nulla da spiegare. Si calcola dopo il montaggio perché in
 *  render sul server `window` non esiste. */
function useApparecchioCheChiama(): boolean {
  const [sì, setSì] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    setSì(window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  }, []);
  return sì;
}

/** ── IL NUMERO COME LO VUOLE `tel:` ────────────────────────────────────────
 *  A schermo il numero si legge come sta in archivio — «+39 333 123 45 67»,
 *  spazi e parentesi compresi: è così che il setter lo riconosce. Ma dentro il
 *  collegamento no: uno spazio o una parentesi in `tel:` è un carattere che
 *  certi telefoni non compongono, e il risultato è di nuovo il tasto che non fa
 *  niente. Si tengono le cifre e il `+` iniziale, che è l'unico segno che
 *  cambia la chiamata (prefisso internazionale). */
function numeroDaComporre(grezzo: string): string {
  const cifre = grezzo.replace(/[^\d]/g, "");
  return `${grezzo.trim().startsWith("+") ? "+" : ""}${cifre}`;
}

async function copiaNegliAppunti(testo: string) {
  //  In HTTP semplice (rete locale, anteprime) `navigator.clipboard` non
  //  esiste: dirlo è meglio che fingere una copia mai avvenuta.
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    toast.message("Copia il numero a mano", { description: testo });
    return;
  }
  try {
    await navigator.clipboard.writeText(testo);
    toast.success("Numero copiato", { description: testo });
  } catch {
    toast.message("Copia il numero a mano", { description: testo });
  }
}

function BottoneChiama({ lead, className }: { lead: Lead; className?: string }) {
  const daTelefono = useApparecchioCheChiama();
  const [aperto, setAperto] = useState(false);
  //  Il numero arriva dall'archivio e non è garantito che sia una stringa: una
  //  lista importata può portarlo come numero, e `.trim()` diretto cadrebbe.
  const numero = String(lead?.data?.telefono ?? "").trim();
  const chi = nomeDi(lead) || "questo contatto";
  const componibile = numeroDaComporre(numero);

  //  Senza numero non si finge un tasto che chiama: si dice che manca, così
  //  chi sta lavorando la lista sa che va cercato prima di perderci tempo.
  //  ⚠️ «Non c'è» comprende anche il campo pieno di roba che non si compone:
  //  le liste portano «n/d», «da verificare», un trattino. Con meno di tre
  //  cifre `tel:` sarebbe un collegamento vuoto — cioè di nuovo il tasto che
  //  non fa niente, che è esattamente ciò che si sta evitando.
  if (componibile.replace(/\D/g, "").length < 3) {
    return (
      <span
        title={
          numero
            ? `In scheda c'è «${numero}»: non è un numero che si possa comporre`
            : "Questo lead non ha un numero di telefono in scheda"
        }
        className="inline-flex h-9 items-center rounded-lg border border-dashed border-border px-2.5 text-[11.5px] text-muted-foreground"
      >
        <Phone className="mr-1 h-3.5 w-3.5 opacity-50" />
        <span className="hidden sm:inline">senza numero</span>
      </span>
    );
  }

  const classi = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 ${className ?? ""}`;

  if (daTelefono) {
    return (
      <a
        href={`tel:${componibile}`}
        onClick={(e) => e.stopPropagation()}
        title={`Chiama ${chi} — ${numero}`}
        aria-label={`Chiama ${chi}, ${numero}`}
        className={classi}
      >
        <Phone className="h-4 w-4" />
        <span className="hidden sm:inline">Chiama</span>
      </a>
    );
  }

  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={`Chiama ${chi} — ${numero}`}
          aria-label={`Chiama ${chi}, ${numero}`}
          className={classi}
        >
          <Phone className="h-4 w-4" />
          <span className="hidden sm:inline">Chiama</span>
        </button>
      </PopoverTrigger>
      <Pannello
        align="end"
        className="w-64"
        titolo="Chiama adesso"
        contesto={chi}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          {/*  Il numero è la cosa per cui il riquadro esiste: grande, in cifre
              tabellari, selezionabile a mano da chi preferisce trascinare. */}
          <p className="select-all text-center text-[17px] font-semibold tabular-nums tracking-wide">
            {numero}
          </p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                void copiaNegliAppunti(numero);
                setAperto(false);
              }}
            >
              <Copy className="mr-1 h-3.5 w-3.5" /> Copia
            </Button>
            <Button asChild size="sm" variant="outline" className="flex-1">
              <a href={`tel:${componibile}`} onClick={() => setAperto(false)}>
                <Phone className="mr-1 h-3.5 w-3.5" /> Apri
              </a>
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            «Apri» funziona solo se su questo computer c'è un programma che sa telefonare. Se non
            succede niente, copia il numero e chiama dal telefono.
          </p>
        </div>
      </Pannello>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CARICARE UNA LISTA — PRIMA SI GUARDA, POI SI SCRIVE

   La regola è quella di /CRM/importa e non cambia: aprire un file NON tocca il
   database. Si legge, si mostra come è stato capito (quante righe, quante
   verrebbero create, quante sono contatti già in archivio, quante scartate,
   quali colonne sono rimaste fuori) e solo dopo compare il pulsante che scrive.

   ⚠️ QUI NON C'È UNA RIGA DI RICONOSCIMENTO. Intestazioni, separatore,
   traduzione degli stati, righe scartate: tutto `traduciCsv`; chi è nuovo e chi
   è di ritorno: tutto `separaRitorni`. Sono le stesse funzioni che usa
   /CRM/importa — se qui si riscrivessero, un giorno l'anteprima direbbe una
   cosa e l'importazione ne farebbe un'altra.
   ═════════════════════════════════════════════════════════════════════════ */

interface EsitoLettura {
  leads: LeadData[];
  colonneIgnorate: string[];
  scartate: number;
  nomeFile: string;
}

/** Le colonne dell'anteprima: le stesse che si guardano per capire se il file
 *  è stato letto storto. */
const COLONNE_ANTEPRIMA: { chiave: keyof LeadData; etichetta: string }[] = [
  { chiave: "nome", etichetta: "Nome" },
  { chiave: "cognome", etichetta: "Cognome" },
  { chiave: "telefono", etichetta: "Telefono" },
  { chiave: "citta", etichetta: "Città" },
  { chiave: "stato", etichetta: "Stato" },
  { chiave: "createdAt", etichetta: "Data" },
];

/** Il valore di un campo scritto come finirà a schermo. */
function valoreAnteprima(d: LeadData, k: keyof LeadData): string {
  const v = d[k];
  if (v == null || v === "") return "";
  if (k === "stato") return LEAD_STATUS_LABEL[v as LeadStatus] ?? String(v);
  if (k === "createdAt") return dataBreve(String(v));
  return String(v);
}

function PannelloImportCsv({ onImportata }: { onImportata: () => void }) {
  const { leads, reload } = useCRM();
  const { user } = useAuth();
  const [letto, setLetto] = useState<EsitoLettura | null>(null);
  const [lavoro, setLavoro] = useState<{ fatti: number; totale: number } | null>(null);
  const [fine, setFine] = useState<{
    inseriti: number;
    ritorno: number;
    ripetute: number;
    scartate: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /** Chi è nuovo e chi è già in archivio. Il conto e l'elenco vengono dalla
   *  STESSA divisione: due calcoli diversi, un giorno, direbbero due cose. */
  const { nuovi, ritorni, ripetute } = useMemo(
    () => separaRitorni(letto?.leads ?? [], leads ?? []),
    [letto, leads],
  );

  const leggi = async (f: File) => {
    setFine(null);
    try {
      const testo = await f.text();
      const r = traduciCsv(testo);
      setLetto({
        leads: r.leads,
        colonneIgnorate: r.colonneIgnorate,
        scartate: r.scartate,
        nomeFile: f.name,
      });
      toast.success(`Lista letta: ${r.leads.length} contatti`, {
        description: "Niente è stato ancora scritto: controlla l'anteprima qui sotto.",
      });
    } catch (e) {
      setLetto(null);
      toast.error("File non leggibile", {
        description:
          e instanceof Error ? e.message : "Serve un CSV con l'intestazione sulla prima riga.",
      });
    }
  };

  const scrivi = async () => {
    if (!letto || !user || !nuovi.length) return;
    setLavoro({ fatti: 0, totale: nuovi.length });
    let inseriti = 0;
    //  A blocchi: ottocento righe in una sola richiesta è il modo più semplice
    //  per farsi respingere dal database a metà strada.
    const BLOCCO = 50;
    for (let i = 0; i < nuovi.length; i += BLOCCO) {
      const parte = nuovi
        .slice(i, i + BLOCCO)
        .map((d) => ({ user_id: user.id, data: { ...d, importato: true } as never }));
      const { error } = await supabase.from("crm_leads").insert(parte as never);
      if (error) {
        console.error(error);
        toast.error("Importazione interrotta", { description: error.message });
        break;
      }
      inseriti += parte.length;
      setLavoro({ fatti: Math.min(i + BLOCCO, nuovi.length), totale: nuovi.length });
    }
    setLavoro(null);
    setFine({ inseriti, ritorno: ritorni.length, ripetute, scartate: letto.scartate });
    setLetto(null);
    await reload();
    onImportata();
    toast.success(`Importati ${inseriti} lead`, {
      description: "Sono in cima alla lista, pronti da chiamare.",
    });
  };

  return (
    <Scheda
      titolo="Carica una lista"
      nota="Un CSV di contatti: separatore e intestazioni si riconoscono da soli. Sceglierlo non scrive nulla."
      icona={FileSpreadsheet}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (f) void leggi(f);
          }}
        />
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Scegli il file
        </Button>
        <span className="text-[12px] text-muted-foreground">
          {letto
            ? letto.nomeFile
            : "Formati: .csv · .tsv · .txt, con l'intestazione sulla prima riga"}
        </span>
      </div>

      {letto && (
        <div className="mt-3 space-y-3">
          <KpiRiga colonne={4}>
            <Kpi
              etichetta="Righe lette"
              valore={letto.leads.length}
              nota="contatti riconosciuti nel file"
              icona={Table2}
            />
            <Kpi
              etichetta="Verranno create"
              valore={nuovi.length}
              nota={
                ripetute > 0
                  ? `${ripetute} righe ripetute nel file contano una volta`
                  : "schede nuove in archivio"
              }
              tono={nuovi.length > 0 ? "vinta" : "neutro"}
            />
            {/*  Non "saltate": erano già in archivio e sono tornate. La loro
                scheda non si tocca — riscriverci sopra nome e telefono
                cancellerebbe mesi di storia per aggiungere zero. */}
            <Kpi
              etichetta="Già in archivio"
              valore={ritorni.length}
              nota="stesso telefono, o stesso nome e cognome"
              tono={ritorni.length > 0 ? "in_sospeso" : "neutro"}
            />
            <Kpi
              etichetta="Scartate"
              valore={letto.scartate}
              nota="righe senza nome, cognome e telefono"
              tono={letto.scartate > 0 ? "persa" : "neutro"}
            />
          </KpiRiga>

          {letto.colonneIgnorate.length > 0 && (
            <p className="rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
              Colonne del file rimaste fuori: <b>{letto.colonneIgnorate.join(", ")}</b>. Se una di
              queste contiene un dato che ti serve, rinominala nel file (per esempio «telefono»,
              «email», «città») e ricarica: non è stata ancora scritta nessuna riga.
            </p>
          )}

          {letto.leads.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-left text-[12.5px]">
                <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {COLONNE_ANTEPRIMA.map((c) => (
                      <th key={String(c.chiave)} className="px-3 py-2 font-medium">
                        {c.etichetta}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {letto.leads.slice(0, 5).map((d, i) => (
                    <tr key={i}>
                      {COLONNE_ANTEPRIMA.map((c) => (
                        <td key={String(c.chiave)} className="max-w-[180px] truncate px-3 py-2">
                          {valoreAnteprima(d, c.chiave) || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {letto.leads.length > 5 && (
                <p className="border-t border-border px-3 py-2 text-[11.5px] text-muted-foreground">
                  … e altre {letto.leads.length - 5} righe lette con le stesse regole. Se una
                  colonna è finita nel posto sbagliato, si vede qui.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void scrivi()} disabled={!!lavoro || nuovi.length === 0}>
              {lavoro
                ? `Importazione… ${lavoro.fatti}/${lavoro.totale}`
                : nuovi.length === 0
                  ? "Niente da importare"
                  : `Importa ${nuovi.length} lead`}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLetto(null)}>
              Annulla
            </Button>
            <p className="text-[12px] text-muted-foreground">
              {nuovi.length === 0
                ? "Tutte le righe leggibili risultano già in archivio: le trovi nell'elenco lead."
                : `Da qui in poi il database viene toccato. ${ritorni.length} già in archivio restano fuori.`}
            </p>
          </div>

          {ritorni.length > 0 && (
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              I {ritorni.length} contatti già in archivio non vengono ricreati: sarebbe una seconda
              scheda per la stessa persona. Per rifissare il meet a chi è tornato, la procedura
              completa (note della scheda comprese) è in <b>Importa archivio</b>, /CRM/importa.
            </p>
          )}
        </div>
      )}

      {fine && !letto && (
        <ul className="mt-3 space-y-0.5 text-[12.5px]">
          <li>{fine.inseriti} schede aggiunte</li>
          <li>{fine.ritorno} erano già in archivio: la loro scheda resta la sua</li>
          {fine.ripetute > 0 && (
            <li>{fine.ripetute} righe ripetute nel file: contate una volta sola</li>
          )}
          <li>{fine.scartate} righe scartate perché senza nome, cognome e telefono</li>
        </ul>
      )}
    </Scheda>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA SCHERMATA
   ═════════════════════════════════════════════════════════════════════════ */

export function DaFareScheda({
  dentro,
  intervallo,
  onTuttoLoStorico,
}: {
  dentro: FiltroPeriodo;
  /** serve solo per l'avvertimento qui sotto: il taglio vero lo fa `dentro` */
  intervallo: Intervallo;
  /** Toglie il taglio di data e mostra la coda intera. È una funzione e non un
   *  link perché il periodo di questa schermata non sta nell'indirizzo: è una
   *  pagina sua e il periodo è un suo comando. */
  onTuttoLoStorico: () => void;
}) {
  const { leads, consultants, updateLead } = useCRM();

  /** ── CHI PUÒ CARICARE UNA LISTA ──────────────────────────────────────────
   *  Importare un CSV crea schede in archivio per tutto lo studio: è il
   *  permesso «creare nuovi lead», lo stesso che serviva quando il pulsante
   *  «Importa lista» stava nell'elenco lead (pagina riservata a chi vede i
   *  lead di tutti). Questa schermata invece la vede chiunque — è anche la coda
   *  del lavoro — quindi il permesso si chiede al COMANDO e non alla pagina:
   *  chi non può caricare continua a vedere la sua coda e a chiamare. */
  const puo = usePuo();
  const puoCaricare = puo("lead.crea");

  const [editing, setEditing] = useState<Lead | null>(null);
  const [open, setOpen] = useState(false);
  const [consulenteId, setConsulenteId] = useState<string>("all");
  const [faseFiltro, setFaseFiltro] = useState<FiltroFase>("all");
  const [esitoPrima, setEsitoPrima] = useState<EsitoPrimaChiamata>("tutti");
  const [cerca, setCerca] = useState("");
  const [soloRitardo, setSoloRitardo] = useState(false);
  const [ordine, setOrdine] = useState<Ordine>("urgenza");
  const [selezione, setSelezione] = useState<Set<string>>(new Set());
  const [inCorso, setInCorso] = useState(false);
  const [aiutoAperto, setAiutoAperto] = useState(false);
  const [importAperto, setImportAperto] = useState(false);
  const cercaRef = useRef<HTMLInputElement>(null);

  /** La finestra che chiede i dati mancanti (giorno e ora di un appuntamento,
   *  importo di un acconto): è quella condivisa del CRM, non una copia. */
  const [quickLead, setQuickLead] = useState<Lead | null>(null);
  const [quickStato, setQuickStato] = useState<LeadStatus | null>(null);
  const [quickAperta, setQuickAperta] = useState(false);
  //  La finestra delle tre chiusure vinte: si porta dietro i suoi stati.
  const chiusura = useChiusura();

  /** ── LA LENTE ────────────────────────────────────────────────────────────
   *  Si apre sui lead importati — è la casa delle liste — ma la scelta si
   *  ricorda: chi ogni mattina apriva la coda completa la ritrova aperta. */
  const [lente, setLente] = useState<Lente>(() => {
    if (typeof window === "undefined") return "importati";
    return window.localStorage.getItem(CHIAVE_LENTE) === "coda" ? "coda" : "importati";
  });
  const cambiaLente = (v: Lente) => {
    setLente(v);
    setSelezione(new Set());
    if (typeof window !== "undefined") window.localStorage.setItem(CHIAVE_LENTE, v);
  };

  const [vista, setVista] = useState<Vista>(() => {
    if (typeof window === "undefined") return "kanban";
    //  La chiave resta quella di prima: chi lavorava in elenco deve ritrovare
    //  l'elenco anche adesso che la schermata ha cambiato nome.
    const salvata = window.localStorage.getItem("crm-pipeline-view");
    return salvata === "lista" || salvata === "list" ? "lista" : "kanban";
  });
  const cambiaVista = (v: Vista) => {
    setVista(v);
    if (typeof window !== "undefined") window.localStorage.setItem("crm-pipeline-view", v);
  };

  //  Le colonne vuote non sono informazione: con venti stati riempivano lo
  //  schermo di intestazioni a zero e spingevano il lavoro fuori dalla vista.
  const [nascondiVuote, setNascondiVuote] = useState(true);

  const nomeConsulente = (id?: string | null) =>
    consultants.find((c) => c.id === id)?.data.nome ?? "—";

  /** ── I DUE ELENCHI DI NOMI DI QUESTA SCHEDA, DA UNA PORTA SOLA ──────────
   *  Il filtro «Tutti i consulenti» in barra e il menu «Assegna» della
   *  selezione multipla: tutti e due parlano di chi FA la consulenza, quindi
   *  tutti e due mostrano solo i consulenti. Erano l'anagrafica intera, e in
   *  una scheda che serve a smaltire code voleva dire assegnare telefonate da
   *  richiamare a chi non le fa e filtrare per persone sempre a zero.
   *  ⚠️ `leads`: chi ha già delle schede assegnate resta in tutti e due gli
   *  elenchi anche senza spunta, o quelle schede diventerebbero irrecuperabili.
   *  Il ripiego e la sua frase stanno in crm/chi-fa-la-consulenza. */
  const { elenco: consulentiScelta, ripiego: ripiegoConsulenti } = useMemo(
    () =>
      consulentiPerConsulenza(consultants, {
        leads,
        anche: [consulenteId === "all" ? null : consulenteId],
      }),
    [consultants, leads, consulenteId],
  );

  const suLista = lente === "importati";

  /* ── COSA SI VEDE ────────────────────────────────────────────────────────
     `insieme` è la lente scelta più il periodo in alto, il consulente e la
     ricerca: è la base su cui contano i riquadri, perché un numero che cambia
     quando si preme un filtro di stato non è più un totale.
     Il taglio sul periodo usa lo stesso filtro delle altre schede: una data
     illeggibile non passa il filtro e quel lead non compare in nessuna
     finestra — meglio che vederlo comparire in tutte. */
  const insieme = useMemo(() => {
    const q = normalizza(cerca).trim();
    const qCifre = soloCifre(cerca);
    return leads.filter((l) => {
      if (suLista && !eInLista(l)) return false;
      if (consulenteId !== "all" && l.data?.consulenteId !== consulenteId) return false;
      if (!dentro(l.data?.createdAt)) return false;
      if (q) {
        const testo = normalizza(
          `${l.data?.nome || ""} ${l.data?.cognome || ""} ${l.data?.citta || ""}`,
        );
        const perTelefono = qCifre.length >= 3 && soloCifre(l.data?.telefono).includes(qCifre);
        if (!testo.includes(q) && !perTelefono) return false;
      }
      return true;
    });
  }, [leads, suLista, consulenteId, dentro, cerca]);

  const filtrati = useMemo(() => {
    const righe = insieme.filter((l) => {
      const s = l.data?.stato;
      // ── LA LENTE DELLE LISTE PARLA DI PRIMA CHIAMATA ─────────────────────
      //  I due vocabolari non si mescolano mai: o si guarda com'è andata la
      //  prima telefonata, o a che punto è una trattativa avviata.
      if (suLista) {
        if (esitoPrima === "duplicato") {
          if (!l.data?.giaPresente) return false;
        } else if (esitoPrima !== "tutti" && s !== esitoPrima) return false;
      } else {
        if (faseFiltro === "won" && !STATI_VINTI.includes(s)) return false;
        if (faseFiltro === "lost" && !STATI_PERSI.includes(s)) return false;
        if (faseFiltro === "open" && (STATI_VINTI.includes(s) || STATI_PERSI.includes(s)))
          return false;
        if (
          faseFiltro !== "all" &&
          faseFiltro !== "won" &&
          faseFiltro !== "lost" &&
          faseFiltro !== "open" &&
          s !== faseFiltro
        )
          return false;
      }
      if (soloRitardo && prossimaAzione(l).ritardo <= 0) return false;
      return true;
    });
    if (ordine === "recenti") {
      return [...righe].sort((a, b) =>
        (b.data?.createdAt || "").localeCompare(a.data?.createdAt || ""),
      );
    }
    if (ordine === "valore") {
      const val = (l: Lead) => Number(l.data?.payment?.prezzoFinaleVendita) || 0;
      return [...righe].sort((a, b) => val(b) - val(a));
    }
    //  Su una lista appena caricata l'imminenza non discrimina: decide
    //  l'ordine con cui si telefona.
    return suLista ? ordinaPerPrimaChiamata(righe) : ordinaPerUrgenza(righe);
  }, [insieme, suLista, faseFiltro, esitoPrima, soloRitardo, ordine]);

  const perStato = useMemo(() => {
    const mappa = new Map<LeadStatus, Lead[]>(ALL_LEAD_STATUSES.map((s) => [s, [] as Lead[]]));
    //  `filtrati` è già ordinato: le colonne ereditano l'ordine scelto e in
    //  cima a ognuna sta il lead più urgente di quella colonna.
    for (const l of filtrati) mappa.get(l.data?.stato)?.push(l);
    return mappa;
  }, [filtrati]);

  /** I numeri della coda completa. */
  const kpi = useMemo(() => {
    const totale = insieme.length;
    const vinti = insieme.filter((l) => STATI_VINTI.includes(l.data?.stato));
    const persi = insieme.filter((l) => STATI_PERSI.includes(l.data?.stato)).length;
    const aperti = totale - vinti.length - persi;
    const conversione = totale > 0 ? (vinti.length / totale) * 100 : 0;
    //  `Number(...)`: negli archivi importati l'acconto arriva anche come
    //  stringa ("500"), e una somma che parte da 0 e incontra una stringa
    //  diventa "0500" — un totale che si legge e non si capisce.
    const incassato = insieme.reduce(
      (s, l) => s + (Number(l.data?.payment?.accontoPagato) || 0),
      0,
    );
    //  Da incassare = solo sui lead vinti: sui preventivi ancora aperti sarebbe
    //  un desiderio, non un credito.
    const daIncassare = vinti.reduce((s, l) => s + saldoDaIncassare(l), 0);
    return {
      totale,
      vinti: vinti.length,
      persi,
      aperti,
      conversione,
      incassato,
      daIncassare,
      inRitardo: contaInRitardo(insieme),
    };
  }, [insieme]);

  /** I numeri della lista: quanti per esito della prima chiamata, più quanti
   *  sono già diventati un appuntamento — che è il risultato del lavoro.
   *  UNA PASSATA SOLA: `insieme` può essere di ottocento righe e questa si
   *  ricalcola a ogni battuta della ricerca. */
  const kpiLista = useMemo(() => {
    const perEsito: Record<string, number> = { tutti: insieme.length, duplicato: 0 };
    let senzaConsulente = 0;
    for (const l of insieme) {
      const s = l.data?.stato;
      if (s) perEsito[s] = (perEsito[s] || 0) + 1;
      if (l.data?.giaPresente) perEsito.duplicato++;
      if (!l.data?.consulenteId) senzaConsulente++;
    }
    return {
      perEsito,
      senzaConsulente,
      //  Si conta su TUTTI i lead, non su `insieme`: chi ha l'appuntamento è
      //  uscito dalla lista per definizione, quindi in `insieme` non c'è.
      diventatiAppuntamento: leads.filter(eDiventatoAppuntamento).length,
    };
  }, [insieme, leads]);

  /** Quanti lead ci sono in ciascuna lente: il numero sta sul pulsante, così
   *  si sceglie dove andare senza entrare e tornare indietro. */
  const conteggioLenti = useMemo(() => {
    let inLista = 0;
    for (const l of leads) if (eInLista(l)) inLista++;
    return { importati: inLista, coda: leads.length };
  }, [leads]);

  const filtriAttivi =
    consulenteId !== "all" ||
    !!cerca ||
    soloRitardo ||
    (suLista ? esitoPrima !== "tutti" : faseFiltro !== "all");

  const azzeraFiltri = () => {
    setConsulenteId("all");
    setFaseFiltro("all");
    setEsitoPrima("tutti");
    setCerca("");
    setSoloRitardo(false);
  };

  /* ── SELEZIONE E AZIONI DI GRUPPO ────────────────────────────────────────
     Le stesse tre azioni dell'elenco lead (stato, consulente, esporta). Nella
     lente delle liste gli stati proposti sono quelli della PRIMA CHIAMATA: sono
     gli unici che abbia senso dare a venti righe insieme dopo una mattinata al
     telefono, ed erano l'unica cosa che il gruppo «Importati» sapeva fare in
     blocco nell'elenco lead. */
  const selezionati = useMemo(
    () => filtrati.filter((l) => selezione.has(l.id)),
    [filtrati, selezione],
  );
  const tuttiSelezionati = filtrati.length > 0 && selezionati.length === filtrati.length;

  const commutaRiga = (id: string) =>
    setSelezione((prec) => {
      const next = new Set(prec);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selezionaTutti = () =>
    setSelezione(tuttiSelezionati ? new Set() : new Set(filtrati.map((l) => l.id)));

  const statoMassivo = async (s: LeadStatus) => {
    setInCorso(true);
    let fatti = 0;
    try {
      for (const l of selezionati) {
        if (l.data?.stato === s) continue;
        await updateLead(l.id, { stato: s });
        fatti++;
      }
      toast.success(`${fatti} lead → ${LEAD_STATUS_LABEL[s]}`);
    } finally {
      setInCorso(false);
    }
  };

  const assegnaMassivo = async (cid: string | null) => {
    setInCorso(true);
    try {
      for (const l of selezionati) await updateLead(l.id, { consulenteId: cid });
      toast.success(
        cid
          ? `${selezionati.length} lead a ${nomeConsulente(cid)}`
          : `${selezionati.length} lead senza consulente`,
      );
    } finally {
      setInCorso(false);
    }
  };

  const esporta = (righe: Lead[], suffisso: string) => {
    if (righe.length === 0) {
      toast.message("Niente da esportare");
      return;
    }
    esportaCsvLead(righe, suffisso, nomeConsulente);
  };

  const apriLead = (l: Lead | null) => {
    setEditing(l);
    setOpen(true);
  };

  /** ── SEGNARE L'ESITO DALLA RIGA, SENZA APRIRE LA SCHEDA ──────────────────
   *  «Chiamo, segno com'è andata, passo al prossimo»: se per segnare bisogna
   *  aprire una finestra, moltiplicato per duecento chiamate è mezz'ora persa.
   *  Gli stati che hanno bisogno di altri dati (giorno e ora di un
   *  appuntamento) aprono la procedura guidata condivisa — quella e non una
   *  copia, altrimenti lo stesso appuntamento si fisserebbe in due modi. */
  const segnaEsito = async (l: Lead, s: LeadStatus) => {
    if (l.data?.stato === s) return;
    //  Le tre chiusure vinte hanno la loro finestra, che scrive stato, importi
    //  e modo di consegna in un salvataggio solo. ⚠️ Il ramo va PRIMA di
    //  `requiresAnyDialog` e non scrive niente da sé: vedi ChiusuraDialog.
    if (chiusura.intercetta(l, s)) return;
    if (requiresAnyDialog(s)) {
      setQuickLead(l);
      setQuickStato(s);
      setQuickAperta(true);
      return;
    }
    try {
      await updateLead(l.id, { stato: s });
      const chi = nomeDi(l) || "Il lead";
      toast.success(`${chi} → ${LEAD_STATUS_LABEL[s]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stato non salvato");
    }
  };

  /* ── SCORCIATOIE ─────────────────────────────────────────────────────────
     Le stesse lettere dell'elenco lead dove il gesto è lo stesso ("/" cerca, A
     seleziona tutto, ? il promemoria, Esc torna indietro): due schermate che
     usano la stessa tastiera in modo diverso costringono a ricordarsi in quale
     ci si trova. */
  useScorciatoie(
    {
      "/": () => cercaRef.current?.focus(),
      v: () => cambiaVista(vista === "kanban" ? "lista" : "kanban"),
      r: () => setSoloRitardo((x) => !x),
      i: () => puoCaricare && setImportAperto((x) => !x),
      a: () => selezionaTutti(),
      e: () => esporta(filtrati, suLista ? "lista-importata" : "coda"),
      "?": () => setAiutoAperto((x) => !x),
      Escape: () => {
        //  Una via d'uscita sola e prevedibile: prima il promemoria, poi la
        //  selezione, poi i filtri.
        if (aiutoAperto) setAiutoAperto(false);
        else if (selezione.size) setSelezione(new Set());
        else if (filtriAttivi) azzeraFiltri();
      },
    },
    { bloccato: open || quickAperta },
  );

  /** Le voci del filtro «esito della prima chiamata», con quanti ne contengono. */
  const vociPrimaChiamata: { chiave: EsitoPrimaChiamata; titolo: string }[] = [
    { chiave: "tutti", titolo: "Tutti" },
    ...STATI_PRIMA_CHIAMATA.map((s) => ({
      chiave: s as EsitoPrimaChiamata,
      titolo: LEAD_STATUS_LABEL[s],
    })),
    //  «Doppioni» non è uno stato: è la condizione di chi era già in archivio.
    { chiave: "duplicato", titolo: "Doppioni" },
  ];

  /** L'ultima cosa detta a questo lead, se c'è: su una lista è il motivo per
   *  cui si richiama («richiamare dopo le 18», «la moglie non è convinta») e
   *  fino a ieri si leggeva solo aprendo la scheda. */
  const ultimaNota = (l: Lead): string => noteDelLead(l.data)[0]?.testo ?? "";

  return (
    <>
      {/* ── LE DUE LENTI ─────────────────────────────────────────────────────
          Prima è la casa delle liste, poi c'è tutto il resto: la coda completa
          non è sparita, è qui accanto con il suo numero. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Segmento
          attivo={suLista}
          conteggio={conteggioLenti.importati}
          onClick={() => cambiaLente("importati")}
          titolo="Solo le liste caricate e non ancora lavorate: da chiamare"
        >
          Lead importati
        </Segmento>
        <Segmento
          attivo={!suLista}
          conteggio={conteggioLenti.coda}
          onClick={() => cambiaLente("coda")}
          titolo="Tutti i lead con la loro prossima scadenza, in cima quelle già passate"
        >
          Tutta la coda
        </Segmento>
        <span className="text-[11.5px] text-muted-foreground">
          {suLista
            ? "Chi è ancora una riga di lista: appena ha consulente e data passa nella coda"
            : "Ogni lead con la sua prossima scadenza — le liste comprese"}
        </span>
      </div>

      {/* ── UNA BARRA SOLA: cerco → di chi → come ordino → come guardo ─────
          `fissa={false}`: la barra del periodo è già in alto nella pagina, e
          due barre appiccicate si coprono a vicenda. */}
      <BarraAzioni fissa={false}>
        <Input
          ref={cercaRef}
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca nome, telefono, città  ( / )"
          className="h-8 w-56"
        />
        <Select value={consulenteId} onValueChange={setConsulenteId}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i consulenti</SelectItem>
            {consulentiScelta.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.data.nome}
              </SelectItem>
            ))}
            {/*  Il ripiego si dice DENTRO la tendina, che è l'unico posto in cui
                si guarda mentre si sceglie: la barra qui accanto è già piena di
                comandi e una riga in più lì sopra non verrebbe letta. */}
            {ripiegoConsulenti && (
              <p className="px-2 py-1.5 text-[11px] leading-snug text-amber-800">
                {TESTO_SOLO_CONSULENTI}
              </p>
            )}
          </SelectContent>
        </Select>
        {filtriAttivi && (
          <Button variant="ghost" size="sm" onClick={azzeraFiltri}>
            <X className="mr-1 h-3 w-3" /> Azzera
          </Button>
        )}

        <SepBarra />
        {ORDINI.map((o) => (
          <Segmento
            key={o.chiave}
            titolo={
              o.chiave === "urgenza" && suLista
                ? "In cima i richiami promessi, poi chi non è mai stato chiamato"
                : o.spiega
            }
            attivo={ordine === o.chiave}
            onClick={() => setOrdine(o.chiave)}
          >
            {o.chiave === "urgenza" && suLista ? "Chi chiamare prima" : o.titolo}
          </Segmento>
        ))}

        <SepBarra />
        <Segmento
          attivo={vista === "kanban"}
          onClick={() => cambiaVista("kanban")}
          titolo="Colonne per stato (V)"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </Segmento>
        <Segmento
          attivo={vista === "lista"}
          onClick={() => cambiaVista("lista")}
          titolo="Elenco con azioni di gruppo (V)"
        >
          <ListIcon className="h-3.5 w-3.5" />
        </Segmento>
        {vista === "kanban" && (
          <Segmento
            attivo={nascondiVuote}
            onClick={() => setNascondiVuote((x) => !x)}
            titolo="Nascondi le colonne senza lead"
          >
            Solo colonne piene
          </Segmento>
        )}

        <SepBarra />
        <span className="text-[11.5px] text-muted-foreground">
          {filtrati.length} lead visibili su {kpi.totale}
          {kpi.inRitardo > 0 && (
            <>
              {" · "}
              <span className="font-medium text-rose-600">{kpi.inRitardo} in ritardo</span>
            </>
          )}
        </span>
        <AiutoScorciatoie
          voci={puoCaricare ? SCORCIATOIE : SCORCIATOIE_SENZA_IMPORT}
          aperto={aiutoAperto}
          onCambia={setAiutoAperto}
        />
        {puoCaricare && (
          <Button
            variant={importAperto ? "default" : "outline"}
            size="sm"
            onClick={() => setImportAperto((x) => !x)}
            title="Carica un CSV di contatti: si legge, si controlla, poi si scrive (I)"
            aria-expanded={importAperto}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Carica lista</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => esporta(filtrati, suLista ? "lista-importata" : "coda")}
          title="Esporta in CSV quello che vedi (E)"
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Esporta</span>
        </Button>
        <Button size="sm" onClick={() => apriLead(null)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Nuovo lead</span>
          <span className="sm:hidden">Nuovo</span>
        </Button>
      </BarraAzioni>

      {/* ── IL CARICAMENTO DELLA LISTA ─────────────────────────────────────
          Sta qui, dove la lista poi si lavora: chi la riceve la carica e la
          chiama nella stessa schermata. Chiuso di default — la coda del lavoro
          non deve stare sotto un modulo che si usa una volta a settimana. */}
      {importAperto && puoCaricare && (
        <PannelloImportCsv onImportata={() => cambiaLente("importati")} />
      )}

      {/* ── L'AVVERTIMENTO CHE EVITA UN ERRORE GROSSO ───────────────────────
          Il periodo taglia sulla data di INGRESSO del lead: con «30 giorni» un
          lead entrato a marzo e in ritardo da ieri non compare, e chi guarda
          crede di essere in pari. Qui va detto a voce alta, con il modo di
          toglierlo. */}
      {intervallo !== "tutto" && (
        <p className="rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
          Stai vedendo solo i lead <strong>entrati nel periodo scelto</strong>: le scadenze dei lead
          più vecchi restano fuori da questa coda.{" "}
          <button
            type="button"
            onClick={onTuttoLoStorico}
            className="font-semibold underline underline-offset-2"
          >
            Guarda tutto lo storico
          </button>{" "}
          per avere la coda completa.
        </p>
      )}

      {/* ── I NUMERI SONO FILTRI: si preme il numero e si vedono le righe ────
          IL COLORE È UN SEGNALE, NON UNA CATEGORIA: restano coloriti solo i
          numeri che chiedono di fare qualcosa. */}
      {suLista ? (
        <>
          <KpiRiga colonne={4}>
            <Kpi
              etichetta="In lista"
              valore={kpi.totale}
              nota="ancora da lavorare al telefono"
              attivo={esitoPrima === "tutti"}
              onClick={() => setEsitoPrima("tutti")}
            />
            <Kpi
              etichetta="Mai chiamati"
              valore={kpiLista.perEsito.da_contattare || 0}
              nota="nessuna telefonata ancora"
              tono={(kpiLista.perEsito.da_contattare || 0) > 0 ? "in_sospeso" : "neutro"}
              attivo={esitoPrima === "da_contattare"}
              onClick={() => setEsitoPrima("da_contattare")}
            />
            <Kpi
              etichetta="Richiami promessi"
              valore={kpiLista.perEsito.richiamo || 0}
              nota="hanno detto loro quando"
              attivo={esitoPrima === "richiamo"}
              onClick={() => setEsitoPrima("richiamo")}
            />
            <Kpi
              etichetta="In ritardo"
              valore={kpi.inRitardo}
              tono={kpi.inRitardo > 0 ? "in_sospeso" : "neutro"}
              nota="richiamo già passato"
              attivo={soloRitardo}
              onClick={() => setSoloRitardo((x) => !x)}
            />
            <Kpi
              etichetta="Non risponde"
              valore={kpiLista.perEsito.non_risponde || 0}
              nota="da riprovare"
              attivo={esitoPrima === "non_risponde"}
              onClick={() => setEsitoPrima("non_risponde")}
            />
            <Kpi
              etichetta="Segreteria"
              valore={kpiLista.perEsito.segreteria || 0}
              nota="squilla e non risponde nessuno"
              attivo={esitoPrima === "segreteria"}
              onClick={() => setEsitoPrima("segreteria")}
            />
            <Kpi
              etichetta="Senza consulente"
              valore={kpiLista.senzaConsulente}
              nota="da spartire fra chi chiama"
            />
            {/*  Il risultato del lavoro: quanti di quelli arrivati da una lista
                hanno oggi un appuntamento con giorno, ora e consulente. Non
                sono più «in lista» — infatti il numero non filtra niente qui:
                si va a vederli nella coda. */}
            <Kpi
              etichetta="Diventati appuntamento"
              valore={kpiLista.diventatiAppuntamento}
              tono={kpiLista.diventatiAppuntamento > 0 ? "vinta" : "neutro"}
              nota="usciti dalla lista: sono nella coda"
            />
          </KpiRiga>

          {/* ── L'ESITO DELLA PRIMA CHIAMATA ──────────────────────────────
              Il vocabolario delle liste, che nell'elenco lead stava dentro un
              menu: qui è una riga sola sempre in vista, perché è il filtro che
              si cambia più volte in un'ora. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              1ª chiamata
            </span>
            {vociPrimaChiamata.map((v) => (
              <Segmento
                key={String(v.chiave)}
                attivo={esitoPrima === v.chiave}
                conteggio={kpiLista.perEsito[String(v.chiave)] || 0}
                onClick={() => setEsitoPrima(v.chiave)}
                titolo={
                  v.chiave === "duplicato"
                    ? "Erano già in archivio quando la lista è stata caricata"
                    : undefined
                }
              >
                {v.titolo}
              </Segmento>
            ))}
          </div>
        </>
      ) : (
        <KpiRiga colonne={4}>
          <Kpi
            etichetta="Totale"
            valore={kpi.totale}
            nota="Nel periodo scelto"
            attivo={faseFiltro === "all"}
            onClick={() => setFaseFiltro("all")}
          />
          <Kpi
            etichetta="Aperti"
            valore={kpi.aperti}
            nota="Ancora in lavorazione"
            attivo={faseFiltro === "open"}
            onClick={() => setFaseFiltro("open")}
          />
          <Kpi
            etichetta="In ritardo"
            valore={kpi.inRitardo}
            tono={kpi.inRitardo > 0 ? "in_sospeso" : "neutro"}
            nota="Scadenza già passata"
            attivo={soloRitardo}
            onClick={() => setSoloRitardo((x) => !x)}
          />
          <Kpi
            etichetta="Vinti"
            valore={kpi.vinti}
            nota="Venduto, acconto, chiusi"
            attivo={faseFiltro === "won"}
            onClick={() => setFaseFiltro("won")}
          />
          <Kpi
            etichetta="Persi"
            valore={kpi.persi}
            nota="Assenti e non in target"
            attivo={faseFiltro === "lost"}
            onClick={() => setFaseFiltro("lost")}
          />
          {/*  Rosso solo sotto soglia, ed è la STESSA soglia della scheda
               «Consulenti»: lo stesso numero non può cambiare colore cambiando
               linguetta. Sopra soglia resta inchiostro neutro — una conversione
               che va bene non è una notizia.
               Con la coda vuota il rapporto non esiste: «0,0%» su zero lead si
               legge come un disastro, ed è invece l'assenza di dati. */}
          <Kpi
            etichetta="Conversione"
            valore={kpi.totale > 0 ? `${kpi.conversione.toFixed(1)}%` : "—"}
            tono={kpi.totale > 0 && kpi.conversione < CVR_BASSO ? "persa" : "neutro"}
            nota={
              kpi.totale > 0
                ? `${kpi.vinti} vinti su ${kpi.totale}, chiusi compresi`
                : "nessun lead con questi filtri"
            }
          />
          <Kpi etichetta="Incassato" valore={eur(kpi.incassato)} nota="Acconti già ricevuti" />
          {/*  Il numero che conta per la cassa: quanto devono ancora darci i
               clienti che hanno già comprato. */}
          <Kpi
            etichetta="Da incassare"
            valore={eur(kpi.daIncassare)}
            tono={kpi.daIncassare > 0 ? "in_sospeso" : "neutro"}
            nota="Saldi in attesa sui vinti"
          />
        </KpiRiga>
      )}

      {filtrati.length === 0 ? (
        <Vuoto
          titolo={
            filtriAttivi
              ? "Nessun lead con questi filtri"
              : suLista
                ? "Nessuna lista da lavorare"
                : "La coda è vuota"
          }
          testo={
            filtriAttivi
              ? "Prova ad allargare il periodo in alto o ad azzerare i filtri."
              : suLista
                ? puoCaricare
                  ? "Carica un CSV di contatti e comincia a chiamare. I lead già lavorati non stanno qui: sono in «Tutta la coda»."
                  : "Le liste le carica chi ha il permesso di creare lead. I lead già lavorati non stanno qui: sono in «Tutta la coda»."
                : "Nessun lead nel periodo scelto."
          }
          icona={suLista ? Upload : GitBranch}
          azione={
            filtriAttivi ? (
              <Button variant="outline" size="sm" onClick={azzeraFiltri}>
                Azzera i filtri
              </Button>
            ) : suLista && puoCaricare ? (
              <Button size="sm" onClick={() => setImportAperto(true)}>
                <Upload className="mr-1 h-3.5 w-3.5" /> Carica una lista
              </Button>
            ) : undefined
          }
        />
      ) : vista === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ALL_LEAD_STATUSES.filter(
            (s) => !nascondiVuote || (perStato.get(s)?.length ?? 0) > 0,
          ).map((s) => {
            const righe = perStato.get(s) ?? [];
            const ritardo = contaInRitardo(righe);
            return (
              <div key={s} className="w-[262px] min-w-[262px] flex-shrink-0">
                <div className="mb-2 flex items-center gap-1.5">
                  <ChipStato stato={s} />
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {righe.length}
                  </span>
                  {/*  Il numero rosso è l'unica ragione per aprire una colonna
                       invece di un'altra: sta accanto al totale, non dentro. */}
                  {ritardo > 0 && (
                    <span className="text-[11px] font-semibold tabular-nums text-rose-600">
                      · {ritardo} in ritardo
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {righe.map((l) => {
                    const az = prossimaAzione(l);
                    const saldo = saldoDaIncassare(l);
                    return (
                      /*  Il cartellino è un div e non un <button>: dentro c'è
                          il tasto per chiamare, e un pulsante dentro un
                          pulsante è HTML non valido — il browser lo spezza e
                          uno dei due clic smette di funzionare. */
                      <div
                        key={l.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => apriLead(l)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            apriLead(l);
                          }
                        }}
                        className="w-full cursor-pointer rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:border-foreground/30"
                      >
                        <div className="truncate text-[13px] font-medium">
                          {nomeDi(l) || (
                            <span className="text-muted-foreground">Contatto senza nome</span>
                          )}
                        </div>
                        <ChipAzione azione={az} className="mt-0.5 w-full" />
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span className="truncate">{nomeConsulente(l.data?.consulenteId)}</span>
                          {/*  Sul cartellino si scrive quanto resta DA
                               INCASSARE, non l'acconto già preso: è la cifra
                               che serve il giorno della consegna. */}
                          {saldo > 0 && (
                            <span className="shrink-0 tabular-nums text-amber-700">
                              {eur(saldo)} da incassare
                            </span>
                          )}
                        </div>
                        {/*  La cornetta anche sul cartellino: il gesto della
                             giornata non può esistere in una vista sola.
                             ⚠️ Si ferma anche la TASTIERA, non solo il clic: il
                             cartellino apre la scheda con Invio e con lo
                             spazio, e senza questa riga premere Invio sulla
                             cornetta avviava la chiamata E apriva la scheda
                             sopra — con il telefono che squilla dietro una
                             finestra. */}
                        <div
                          className="mt-2"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <BottoneChiama lead={l} className="w-full" />
                        </div>
                      </div>
                    );
                  })}
                  {righe.length === 0 && (
                    <p className="py-4 text-center text-[11.5px] text-muted-foreground">Vuota</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Scheda senzaPadding classeCorpo="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="text-left">
                <th className="w-9 px-3 py-2">
                  <Checkbox
                    checked={tuttiSelezionati}
                    onCheckedChange={selezionaTutti}
                    aria-label="Seleziona tutte le righe visibili"
                  />
                </th>
                <th className="px-3 py-2 font-medium">Lead</th>
                <th className="px-3 py-2 font-medium">Stato</th>
                <th className="px-3 py-2 font-medium">Prossima azione</th>
                <th className="px-3 py-2 font-medium">Consulente</th>
                {!suLista && <th className="px-3 py-2 text-right font-medium">Da incassare</th>}
                <th className="px-3 py-2 text-right font-medium">Chiama</th>
              </tr>
            </thead>
            <tbody>
              {filtrati.map((l) => {
                const az = prossimaAzione(l);
                const saldo = saldoDaIncassare(l);
                const scelta = selezione.has(l.id);
                const nota = suLista ? ultimaNota(l) : "";
                const telefono = String(l.data?.telefono ?? "").trim();
                return (
                  <tr
                    key={l.id}
                    onClick={() => apriLead(l)}
                    className={`cursor-pointer border-t border-border hover:bg-muted/30 ${
                      scelta ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={scelta}
                        onCheckedChange={() => commutaRiga(l.id)}
                        aria-label={`Seleziona ${nomeDi(l) || telefono || "questo contatto"}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {nomeDi(l) || (
                          <span className="text-muted-foreground">Contatto senza nome</span>
                        )}
                      </div>
                      <div className="truncate text-[11.5px] text-muted-foreground">
                        {telefono || "—"}
                        {l.data?.citta ? ` · ${l.data.citta}` : ""}
                      </div>
                      {/*  L'ultima cosa detta a questa persona: su una lista è
                           il motivo per cui la si richiama, e leggerla costava
                           l'apertura della scheda. */}
                      {nota && (
                        <div className="mt-0.5 max-w-[22rem] truncate text-[11.5px] italic text-muted-foreground">
                          “{nota}”
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {/*  Nella lente delle liste lo stato si cambia da qui: il
                           setter chiama, segna com'è andata e passa oltre. Le
                           voci sono quelle della prima chiamata; per tutto il
                           resto c'è la scheda, che si apre dalla riga. */}
                      {/*  La pastiglia apre la stessa finestra a griglia del
                           resto del CRM. Gli stati proposti restano quelli
                           della prima chiamata: non perché sia scritto qui, ma
                           perché `statiPer` lo decide per i lead importati —
                           era già così, ora è la stessa funzione a dirlo in
                           tutte le schermate. */}
                      {suLista ? (
                        <PastigliaStato
                          dati={l.data ?? {}}
                          contesto={nomeDi(l) || undefined}
                          onScegli={(s) => void segnaEsito(l, s)}
                        />
                      ) : (
                        /*  ⚠️ Il ramo di sola lettura mostra il chip nudo, e il
                            chip non sa niente dei soldi ancora da chiedere: su
                            questo lato della tabella l'avviso non compariva,
                            cioè spariva esattamente dove l'elenco è più lungo.
                            `AvvisoExtra` non disegna nulla quando non c'è
                            niente da dire, quindi sta accanto senza condizioni. */
                        <>
                          <ChipStato stato={l.data?.stato} />
                          <AvvisoExtra dati={l.data} className="ml-1" />
                        </>
                      )}
                    </td>
                    <td className="max-w-[220px] px-3 py-2">
                      <ChipAzione azione={az} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {nomeConsulente(l.data?.consulenteId)}
                    </td>
                    {!suLista && (
                      <td className="px-3 py-2 text-right tabular-nums">
                        {saldo > 0 ? (
                          <span className="font-medium text-amber-700">{eur(saldo)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    {/* ── I COMANDI DELLA RIGA: MAI PIÙ DI TRE ─────────────
                        La cornetta è piena e colorata perché è IL gesto della
                        giornata; WhatsApp le sta accanto, spento, perché è il
                        ripiego di quando non rispondono. Tutto il resto si fa
                        aprendo la scheda (basta premere la riga): una fila di
                        icone letta ottocento volte al giorno non si legge più. */}
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <BottoneChiama lead={l} />
                        {/*  Stessa soglia della cornetta: con un campo che non
                            contiene cifre wa.me apre una pagina d'errore, e
                            l'icona spenta è meglio del viaggio a vuoto. */}
                        {soloCifre(telefono).length >= 3 && (
                          <Button asChild size="icon" variant="ghost" className="h-9 w-9">
                            <a
                              href={buildWhatsAppLink(telefono, "")}
                              target="_blank"
                              rel="noreferrer"
                              title="Scrivi su WhatsApp"
                              aria-label="Scrivi su WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Scheda>
      )}

      <BarraSelezione conteggio={selezionati.length} onAnnulla={() => setSelezione(new Set())}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={inCorso}>
              Stato <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56">
            {suLista ? (
              <>
                <DropdownMenuLabel>Esito della prima chiamata</DropdownMenuLabel>
                {STATI_LISTA_MASSIVI.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => void statoMassivo(s)}>
                    {LEAD_STATUS_LABEL[s]}
                  </DropdownMenuItem>
                ))}
              </>
            ) : (
              <>
                <DropdownMenuLabel>Esito appuntamento</DropdownMenuLabel>
                {ESITI_MASSIVI.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => void statoMassivo(s)}>
                    {LEAD_STATUS_LABEL[s]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Stato del lead</DropdownMenuLabel>
                {STATI_MASSIVI.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => void statoMassivo(s)}>
                    {LEAD_STATUS_LABEL[s]}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={inCorso}>
              <UserRound className="mr-1 h-3.5 w-3.5" /> Assegna
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52">
            <DropdownMenuLabel>Assegna a</DropdownMenuLabel>
            {/*  Lo stesso elenco del filtro in barra: assegnare a mazzi a chi
                non fa consulenze è l'errore che si moltiplica per il numero di
                righe selezionate, e si scopre giorni dopo. */}
            {consulentiScelta.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => void assegnaMassivo(c.id)}>
                {c.data.nome}
              </DropdownMenuItem>
            ))}
            {ripiegoConsulenti && (
              //  Voce SPENTA, non premibile: dentro un menu una riga che si può
              //  cliccare promette un'assegnazione, e questa non ne fa nessuna.
              <DropdownMenuItem disabled className="whitespace-normal text-[11px] leading-snug">
                {TESTO_SOLO_CONSULENTI}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void assegnaMassivo(null)}>
              Togli assegnazione
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="outline"
          disabled={inCorso}
          onClick={() => esporta(selezionati, "selezione")}
        >
          <Download className="mr-1 h-3.5 w-3.5" /> Esporta
        </Button>
      </BarraSelezione>

      <LeadDialog open={open} onOpenChange={setOpen} lead={editing} />
      {/*  La procedura guidata condivisa: giorno e ora di un appuntamento, o
          l'importo di un acconto. Non disegna nulla per gli stati che non
          gestisce, quindi non può sovrapporsi alla scheda. */}
      <QuickStatusDialog
        open={quickAperta}
        onOpenChange={(v) => {
          setQuickAperta(v);
          if (!v) setQuickLead(null);
        }}
        lead={quickLead}
        newStatus={quickStato}
      />
      {chiusura.finestra}
    </>
  );
}
