// ── AGENDA ──────────────────────────────────────────────────────────────────
//  IL CALENDARIO DI CHI STA AL TELEFONO
//
//  Chi guarda questa pagina è il setter: chiama duecento contatti al giorno e,
//  quando uno risponde "sì, quando?", deve saper dire due o tre orari SUBITO,
//  con la persona in linea. Tutto qui dentro risponde a una domanda sola —
//  DOVE C'È POSTO — e le altre vengono dopo:
//    · dove c'è posto questo mese?   → i posti liberi scritti in ogni cella;
//    · dove c'è posto questo giorno? → la fila di orari premibili in cima al
//                                      pannello, da leggere ad alta voce;
//    · chi ho quel giorno?           → la linea del giorno, sotto la fila;
//    · spostami questo appuntamento  → la freccia sulla riga, due tocchi.
//
//  LE REGOLE DEL DISEGNO (le stesse in tutta la pagina)
//   · UN NUMERO SOLO PER CELLA, E SI SA COS'È. Nella cella c'erano due numeri
//     — il giorno e un secondo numero senza nome — e il secondo non si capiva.
//     Adesso ce n'è uno solo oltre alla data, sono i POSTI LIBERI, e la parola
//     "liberi" gli sta accanto (sul telefono, dove non ci sta, lo dice la
//     legenda sotto la griglia). Gli appuntamenti del giorno non si contano
//     più qui: erano la risposta a una domanda che il setter non fa.
//   · LA BARRA MISURA QUELLO CHE RESTA, non quello che è pieno. Prima cella e
//     numero raccontavano il giorno da due versi opposti (barra = occupato,
//     numero = ?): barra lunga adesso vuol dire "c'è ancora posto", come il
//     numero che le sta sopra.
//   · IL COLORE È UN SEGNALE, NON UNA DECORAZIONE. Ne restano due in tutto il
//     mese: SKY su oggi (è "adesso", l'unico giorno che si cerca senza sapere
//     la data) e AMBRA sull'arretrato (è l'unica cosa che chiede di essere
//     fatta). I posti liberi sono inchiostro neutro: sono una quantità.
//   · I GIORNI PASSATI SONO SPENTI, NON CANCELLATI. Sbiadirli al 30% nascondeva
//     proprio l'arretrato, che vive solo lì.
//   · IL POLLICE PRIMA DEL MOUSE. Celle da 64px in su, nessuna informazione che
//     esista solo al passaggio del mouse: quello che serve è scritto.
//   · UN RIEPILOGO SOLO PER BLOCCO. Il pannello del giorno diceva "10 in agenda
//     · 14 orari liberi su 24" e, due centimetri sotto, "10 mezz'ore su 24 già
//     impegnate": lo stesso fatto due volte con parole diverse fa dubitare che
//     siano due fatti diversi. Ne è rimasto uno.
//
//  I POSTI LIBERI SI MISURANO IN SLOT, NON IN APPUNTAMENTI, e li calcola
//  booking-utils (caricoGiorni/getFreeSlotsForDate) per tutta l'applicazione:
//  qui non si rifà quel conto, altrimenti lo stesso pomeriggio avrebbe due
//  risposte diverse a seconda di dove lo si guarda.
//
//  LE DATE SONO LOCALI (oggiIso): `toISOString()` lavora in UTC e d'estate,
//  dalle 22 in poi, spostava "oggi" al giorno dopo.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCRM } from "@/crm/CRMContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  caricoGiorni,
  capienzaConsulenza,
  getFreeSlotsForDate,
  presiPerOra,
  prossimoSlotLibero,
  type CaricoGiorno,
} from "@/crm/booking-utils";
import { LeadDialog } from "@/crm/LeadDialog";
import { formatDate } from "@/lib/date-format";
import type { Lead, Consultant, LeadData } from "@/crm/types";
import { eAppuntamento } from "@/crm/types";
import {
  AgendaDaySheet,
  LineaDelGiorno,
  OrariDaOffrire,
  dataLeggibile,
  giornoPassato,
  impegniDelGiorno,
  orariOffribili,
} from "@/crm/agenda/AgendaDaySheet";
import { AgendaTuttiConsulenti } from "@/crm/AgendaTuttiConsulenti";
//  Chi fa le consulenze si chiede lì, e solo lì: vedi la testata di quel file.
import { TESTO_SOLO_CONSULENTI, consulentiPerConsulenza } from "@/crm/chi-fa-la-consulenza";
import {
  AiutoScorciatoie,
  BarraAzioni,
  Kpi,
  KpiRiga,
  Pagina,
  SCORCIATOIE_COMUNI,
  Scheda,
  SepBarra,
  Titolo,
  oggiIso,
  useScorciatoie,
  type Scorciatoia,
} from "@/crm/ui";

export const Route = createFileRoute("/CRM/agenda")({
  component: AgendaPage,
});

const DOW_SHORT = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"];
const MESI_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

//  Il passo dell'agenda. È lo stesso della griglia di squadra (30 minuti): se le
//  due viste contassero con unità diverse, "4 liberi" qui e "8 liberi" lì
//  sarebbero due verità sullo stesso pomeriggio.
const PASSO = 30;

const SCORCIATOIE: Scorciatoia[] = [
  ["← →", "Giorno precedente o successivo"],
  ["Maiusc + ← →", "Mese precedente o successivo"],
  ["O", "Torna a oggi"],
  ...SCORCIATOIE_COMUNI.filter(([k]) => k !== "/"),
];

/* ═══════════════════════════════════════════════════════════════════════════
   1. IL MESE, CALCOLATO UNA VOLTA SOLA
   ═════════════════════════════════════════════════════════════════════════ */

interface Giorno {
  iso: string;
  numero: number;
  dow: number;
  /** false = giorno di riempimento del mese vicino */
  nelMese: boolean;
  oggi: boolean;
  passato: boolean;
  impegni: Lead[];
  /** capienza e riempimento in slot da PASSO minuti */
  carico: CaricoGiorno;
  /** false = nessun consulente scelto, quindi del carico non si sa niente.
   *  Serve a non dipingere di grigio l'intero mese come se nessuno lavorasse
   *  mai: "non lo so" e "non si lavora" sono due cose diverse e la cella deve
   *  dirle in due modi diversi. */
  noto: boolean;
  /** appuntamenti di un giorno già passato rimasti senza esito */
  daSegnare: number;
}

/** Gli impegni indicizzati per data: senza indice si filtrerebbero tutte le
 *  trattative quarantadue volte, una per cella. */
function indicizzaImpegni(leads: Lead[], consultant: Consultant | null): Map<string, Lead[]> {
  const per = new Map<string, Lead[]>();
  const aggiungi = (giorno: string | undefined, l: Lead) => {
    if (!giorno) return;
    const riga = per.get(giorno);
    if (riga) riga.push(l);
    else per.set(giorno, [l]);
  };
  for (const l of leads) {
    if (consultant && l.data.consulenteId !== consultant.id) continue;
    aggiungi(l.data.dataMeeting, l);
    //  Stessa data nei due campi = un impegno solo: contarlo due volte
    //  gonfierebbe il conteggio del giorno.
    if (l.data.dataVieneInSede && l.data.dataVieneInSede !== l.data.dataMeeting) {
      aggiungi(l.data.dataVieneInSede, l);
    }
  }
  return per;
}

const CARICO_VUOTO: CaricoGiorno = {
  date: "",
  lavorativo: false,
  totali: 0,
  liberi: 0,
  occupati: 0,
  carico: 0,
};

function costruisciMese(
  anno: number,
  mese: number,
  consultant: Consultant | null,
  leads: Lead[],
): Giorno[] {
  const primo = new Date(anno, mese, 1);
  const scarto = (primo.getDay() + 6) % 7; // lunedì = 0
  const inizio = new Date(anno, mese, 1 - scarto);
  const giorniMese = new Date(anno, mese + 1, 0).getDate();
  const totale = Math.ceil((scarto + giorniMese) / 7) * 7;

  const oggi = oggiIso();
  const perGiorno = indicizzaImpegni(leads, consultant);

  const date: string[] = [];
  const giorni: Date[] = [];
  for (let i = 0; i < totale; i++) {
    const d = new Date(inizio);
    d.setDate(inizio.getDate() + i);
    giorni.push(d);
    date.push(oggiIso(d));
  }

  //  Il carico si chiede per TUTTA la griglia, non solo per il mese: i giorni
  //  di coda appartengono al mese vicino ma sono comunque prenotabili, e
  //  mostrarli sempre vuoti diceva una cosa falsa.
  const carichi = consultant ? caricoGiorni(consultant, PASSO, leads, date) : null;

  //  OGGI VALE MENO DI QUANTO DICE IL CONTEGGIO. `caricoGiorni` conta i posti
  //  liberi dell'intera giornata, comprese le nove del mattino quando sono le
  //  quattro del pomeriggio: sulla cella di oggi si vedeva "6 liberi" mentre
  //  da proporre ne restavano due. Qui la disponibilità NON si ricalcola —
  //  arriva sempre da booking-utils — si toglie solo quello che è già passato,
  //  con la stessa regola del pannello del giorno (orariOffribili).
  const liberiOggi =
    consultant && date.includes(oggi)
      ? orariOffribili(oggi, getFreeSlotsForDate(consultant, oggi, PASSO, leads)).offribili.length
      : null;

  return giorni.map((d, i) => {
    const iso = date[i];
    const impegni = perGiorno.get(iso) ?? [];
    const carico = carichi?.get(iso) ?? { ...CARICO_VUOTO, date: iso };
    return {
      iso,
      numero: d.getDate(),
      dow: d.getDay(),
      nelMese: d.getMonth() === mese,
      oggi: iso === oggi,
      passato: iso < oggi,
      impegni,
      carico: iso === oggi && liberiOggi !== null ? { ...carico, liberi: liberiOggi } : carico,
      noto: carichi !== null,
      //  Solo i giorni già passati: la giornata di oggi non è arretrato, è in
      //  corso. "Appuntamento fissato" su un giorno finito significa che
      //  nessuno ha detto com'è andata.
      //  Entrambi gli stati di appuntamento: anche quello di un cliente di
      //  ritorno, se il giorno è passato ed è rimasto lì, è un esito che
      //  nessuno ha segnato.
      daSegnare: iso < oggi ? impegni.filter((l) => eAppuntamento(l.data.stato)).length : 0,
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LA BARRA DEI POSTI — quanto spazio resta, come lunghezza
   ═════════════════════════════════════════════════════════════════════════ */

/** Quanto POSTO è rimasto in un giorno, come lunghezza.
 *
 *  La traccia è la capienza della giornata, la parte piena i posti ancora
 *  prenotabili: barra lunga = c'è dove infilare qualcuno, barra vuota = non
 *  entra più niente. Prima misurava il contrario (il tempo già occupato) e
 *  conviveva nella stessa cella con un numero che diceva un'altra cosa
 *  ancora: due misure opposte a due centimetri l'una dall'altra.
 *
 *  Il colore non varia con la quantità: sarebbe un secondo alfabeto da
 *  imparare, e trenta celle in scala di rosso sono una pagina in allarme.
 *  Sui giorni passati non si disegna proprio (vedi la cella): lì "posto" non
 *  vuol dire più niente. */
function BarraPosti({ carico, className }: { carico: CaricoGiorno; className?: string }) {
  //  Giorno non lavorativo: nessuna traccia da riempire. Una barra vuota
  //  direbbe "pieno", e pieno non è: lì non si lavora proprio.
  if (!carico.lavorativo || carico.totali === 0) {
    return (
      <span
        className={cn("block border-t border-dashed border-border/80", className)}
        aria-hidden
      />
    );
  }
  const quota = carico.totali > 0 ? carico.liberi / carico.totali : 0;
  return (
    <span
      className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      aria-hidden
    >
      <span
        className="block h-full rounded-full bg-slate-500 transition-[width]"
        style={{ width: `${Math.round(quota * 100)}%` }}
      />
    </span>
  );
}

/** La cella letta ad alta voce (titolo e aria-label): comincia dai posti
 *  liberi, che è il motivo per cui la si sta guardando. */
function descriviGiorno(g: Giorno): string {
  const parti: string[] = [];
  //  Su un giorno finito i posti liberi non sono un'informazione: è passato.
  if (g.passato) {
    parti.push(`${g.impegni.length} ${g.impegni.length === 1 ? "appuntamento" : "appuntamenti"}`);
    if (g.daSegnare > 0) parti.push(`${g.daSegnare} esiti da segnare`);
    return `giorno passato · ${parti.join(" · ")}`;
  }
  if (!g.noto) parti.push("nessun consulente selezionato");
  else if (!g.carico.lavorativo) parti.push("giorno non lavorativo");
  else if (g.carico.totali === 0) parti.push("nessuna fascia di lavoro");
  else if (g.carico.liberi === 0)
    parti.push(
      g.oggi && g.carico.occupati < g.carico.totali
        ? "nessun posto libero: la giornata è finita"
        : "nessun posto libero: giornata piena",
    );
  else
    parti.push(
      `${g.carico.liberi} ${g.carico.liberi === 1 ? "posto libero" : "posti liberi"} su ${g.carico.totali}`,
    );
  parti.push(`${g.impegni.length} ${g.impegni.length === 1 ? "appuntamento" : "appuntamenti"}`);
  if (g.daSegnare > 0) parti.push(`${g.daSegnare} esiti da segnare`);
  return parti.join(" · ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA CELLA — che giorno è, e quanti posti restano. Niente altro.
   ═════════════════════════════════════════════════════════════════════════ */

function CellaGiorno({
  giorno,
  scelto,
  onScegli,
}: {
  giorno: Giorno;
  scelto: boolean;
  onScegli: () => void;
}) {
  const g = giorno;
  const pieno = g.carico.lavorativo && g.carico.totali > 0 && g.carico.liberi === 0;
  //  Su oggi "zero posti" ha due cause diverse: la giornata è stata riempita,
  //  oppure è semplicemente finita (gli orari residui erano di stamattina).
  //  Chiamare "pieno" un pomeriggio vuoto ma passato è una bugia che fa
  //  cercare posto in un altro giorno per niente.
  const parolaZero = g.oggi && g.carico.occupati < g.carico.totali ? "finito" : "pieno";
  return (
    <button
      type="button"
      onClick={onScegli}
      title={descriviGiorno(g)}
      aria-label={`${g.numero} — ${descriviGiorno(g)}`}
      aria-current={g.oggi ? "date" : undefined}
      aria-pressed={scelto}
      className={cn(
        //  64px sul telefono è la misura sotto la quale il pollice comincia a
        //  sbagliare cella; sul desktop si allarga per far respirare la barra.
        "relative flex min-h-[64px] flex-col rounded-xl border p-1.5 text-left transition-colors sm:min-h-[86px] sm:p-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        g.nelMese ? "bg-card" : "bg-transparent",
        //  Il grigio dice "qui non si lavora": va messo solo quando lo si sa
        //  davvero, cioè quando un consulente è stato scelto.
        g.noto && !g.carico.lavorativo && "bg-muted/30",
        scelto
          ? "border-foreground ring-1 ring-foreground"
          : "border-border hover:border-foreground/30",
      )}
    >
      <span className="flex items-start justify-between gap-1">
        {/*  Oggi è un pieno, non un bordo: il bordo se lo prende il giorno
            scelto, e i due segnali devono poter stare sulla stessa cella. */}
        <span
          className={cn(
            "flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[13px] font-semibold leading-none tabular-nums",
            g.oggi
              ? "bg-sky-600 text-white"
              : !g.nelMese
                ? "text-muted-foreground/50"
                : g.passato
                  ? "text-muted-foreground"
                  : "text-foreground",
          )}
        >
          {g.numero}
        </span>
        {/*  L'ambra è l'unico allarme del mese: qui c'è qualcosa che nessuno
            ha chiuso. Resta un punto anche sul desktop: il numero preciso lo
            dice il pannello del giorno. */}
        {g.daSegnare > 0 && (
          <span
            className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-amber-500"
            title={`${g.daSegnare} esiti da segnare`}
            aria-hidden
          />
        )}
      </span>

      <span className="mt-auto block pt-2">
        {/*  Nei giorni PASSATI non si scrive niente: "6 liberi" su ieri sarebbe
            un posto che non esiste più, e la barra dei posti direbbe "c'è
            spazio" sul giorno più pieno dell'anno. Del passato interessa una
            cosa sola, l'esito da segnare, e quella ha già il suo punto ambra. */}
        {!g.passato && (
          <>
            {/*  L'UNICO altro numero della cella, e porta il suo nome attaccato.
                Prima qui c'era un numero nudo che nessuno sapeva leggere (erano
                gli appuntamenti, ma poteva essere qualunque cosa). Adesso sono i
                posti liberi — la sola cosa che il setter cerca guardando un mese
                — e la parola "liberi" compare appena c'è spazio per scriverla;
                sul telefono, dove la cella è larga quaranta pixel, la spiega la
                legenda sotto la griglia. */}
            {g.noto && g.carico.lavorativo && g.carico.totali > 0 && (
              <span
                className={cn(
                  "mb-1 flex items-baseline gap-1 leading-none",
                  g.nelMese ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {pieno ? (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {parolaZero}
                  </span>
                ) : (
                  <>
                    <span className="text-[13px] font-semibold tabular-nums">
                      {g.carico.liberi}
                    </span>
                    <span className="hidden text-[11px] text-muted-foreground sm:inline">
                      liberi
                    </span>
                  </>
                )}
              </span>
            )}
            <BarraPosti carico={g.carico} />
          </>
        )}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. LA PAGINA
   ═════════════════════════════════════════════════════════════════════════ */

/** "oggi 09:30" / "domani 09:30" / "gio 14 · 09:30": la data per esteso qui non
 *  serve, serve capire se è adesso o fra una settimana. */
function etichettaProssimo(iso: string, label: string, ora: string, isoOggi: string): string {
  if (iso === isoOggi) return `oggi · ${ora}`;
  const domani = new Date(isoOggi + "T00:00:00");
  domani.setDate(domani.getDate() + 1);
  if (iso === oggiIso(domani)) return `domani · ${ora}`;
  //  label è "Gio 14 Ago": il mese si taglia, il giorno della settimana e il
  //  numero bastano a orientarsi dentro le due settimane che contano.
  return `${label.split(" ").slice(0, 2).join(" ").toLowerCase()} · ${ora}`;
}

function AgendaPage() {
  const { leads, consultants } = useCRM();
  const oggi = new Date();
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [mese, setMese] = useState(oggi.getMonth());
  const [consulenteId, setConsulenteId] = useState<string>("");
  const [giornoSel, setGiornoSel] = useState<string>(oggiIso());
  const [editing, setEditing] = useState<Lead | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [prefill, setPrefill] = useState<Partial<LeadData> | undefined>(undefined);
  const [aiutoAperto, setAiutoAperto] = useState(false);
  // Finestra del giorno: si apre solo quando c'è da scrivere qualcosa
  const [giornoAperto, setGiornoAperto] = useState(false);
  const [oraScelta, setOraScelta] = useState<string | null>(null);
  const [daSpostare, setDaSpostare] = useState<Lead | null>(null);

  const rifPannello = useRef<HTMLDivElement | null>(null);

  const consultant = consultants.find((c) => c.id === consulenteId) || null;

  /** ── DI CHI SI GUARDA L'AGENDA ──────────────────────────────────────────
   *  Questa pagina serve a trovare «gli orari da proporre a chi è al telefono»:
   *  gli orari che si propongono sono quelli di una CONSULENZA, quindi in questa
   *  tendina ci vanno i consulenti e basta. Un installatore qui dentro mostrava
   *  un'agenda piena di buchi che nessuno può usare — ed era la prima che si
   *  apriva, perché era la più libera.
   *  ⚠️ `leads`: chi ha appuntamenti già fissati resta in tendina anche senza
   *  spunta, o la sua giornata non si potrebbe più aprire da nessuna parte. */
  const { elenco: consulentiScelta, ripiego: ripiegoConsulenti } = useMemo(
    () => consulentiPerConsulenza(consultants, { leads, anche: [consulenteId] }),
    [consultants, leads, consulenteId],
  );

  //  I consulenti arrivano dal server dopo il primo render: la scelta iniziale
  //  va fatta quando l'elenco esiste, non prima. Si applica una volta sola —
  //  dopo, chi cambia consulente resta su quello che ha scelto.
  //  ⚠️ Si parte dal primo dell'elenco FILTRATO: partendo dal primo
  //  dell'anagrafica la pagina poteva aprirsi sull'agenda di un installatore,
  //  cioè su una griglia vuota da cui non si propone niente.
  useEffect(() => {
    if (!consulenteId && consulentiScelta.length > 0) setConsulenteId(consulentiScelta[0].id);
  }, [consulentiScelta, consulenteId]);

  const celle = useMemo(
    () => costruisciMese(anno, mese, consultant, leads),
    [anno, mese, consultant, leads],
  );

  const isoOggi = oggiIso();

  /* ── IL GIORNO SCELTO ────────────────────────────────────────────────────
     Calcolato a parte e non pescato dalla griglia: sfogliando i mesi il giorno
     scelto può restare fuori dalla griglia visibile, e il pannello non deve
     svuotarsi per questo. */
  const impegniSel = useMemo(
    () => impegniDelGiorno(leads, giornoSel, consultant),
    [leads, giornoSel, consultant],
  );
  const liberiSel = useMemo(
    () => (consultant ? getFreeSlotsForDate(consultant, giornoSel, PASSO, leads) : []),
    [consultant, giornoSel, leads],
  );
  //  Quante persone ci sono già in ciascun orario: fino alla capienza l'orario
  //  resta offribile, e il contatore dice quanto è pieno.
  const quantiPerOra = useMemo(
    () => (consultant ? presiPerOra(consultant, giornoSel, PASSO, leads) : new Map<string, number>()),
    [consultant, giornoSel, leads],
  );
  const caricoSel = useMemo(
    () =>
      consultant
        ? (caricoGiorni(consultant, PASSO, leads, [giornoSel]).get(giornoSel) ?? {
            ...CARICO_VUOTO,
            date: giornoSel,
          })
        : { ...CARICO_VUOTO, date: giornoSel },
    [consultant, giornoSel, leads],
  );

  /** Porta il calendario su un giorno e lo mette nel pannello. Sul telefono il
   *  pannello sta sotto la griglia: `nearest` lo porta in vista solo se serve
   *  davvero (sul desktop è già lì e non si muove niente). */
  const vaiA = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    if (!Number.isNaN(d.getTime())) {
      setAnno(d.getFullYear());
      setMese(d.getMonth());
    }
    setGiornoSel(iso);
    requestAnimationFrame(() =>
      rifPannello.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  };

  /** Sposta il giorno scelto di N giorni, trascinandosi dietro il mese
   *  mostrato: le frecce devono poter uscire dal mese senza fermarsi al 31. */
  const spostaGiorno = (delta: number) => {
    const d = new Date(giornoSel + "T00:00:00");
    if (Number.isNaN(d.getTime())) return vaiA(isoOggi);
    d.setDate(d.getDate() + delta);
    vaiA(oggiIso(d));
  };

  /* ── I QUATTRO NUMERI IN CIMA ────────────────────────────────────────── */
  //  Il primo buco vero a partire da ADESSO — non dall'inizio della giornata:
  //  alle 16 "prossimo libero 09:00" è un orario già passato, e fissarci sopra
  //  un appuntamento è un errore che si scopre il giorno dopo.
  //  Sta in un calcolo suo perché guarda due mesi avanti e non dipende dal mese
  //  che si sta sfogliando: rifarlo a ogni freccia sarebbe lavoro buttato.
  const prossimo = useMemo(
    () => (consultant ? prossimoSlotLibero(consultant, PASSO, leads) : null),
    [consultant, leads],
  );

  const sintesi = useMemo(() => {
    const delMese = celle.filter((c) => c.nelMese);
    //  I POSTI SI CONTANO SOLO DA OGGI IN AVANTI. Le celle dei giorni passati
    //  il numero non lo scrivono nemmeno — un posto di ieri non è un posto —
    //  ma questa somma li rastrellava lo stesso: il 28 del mese il riquadro
    //  diceva "ottanta posti liberi" mentre da proporre non ne restavano
    //  dieci, e i due numeri stavano sulla stessa schermata a contraddirsi.
    //  Oggi entra con i soli orari ancora offribili, che è esattamente quello
    //  che la sua cella scrive (vedi `liberiOggi` in costruisciMese).
    const liberiMese = delMese.reduce((s, c) => (c.passato ? s : s + c.carico.liberi), 0);
    const daSegnareMese = delMese.reduce((s, c) => s + c.daSegnare, 0);
    //  L'arretrato si affronta dal più vecchio: è quello di cui nessuno si
    //  ricorda più niente.
    const arretrato = delMese.find((c) => c.daSegnare > 0) ?? null;

    return { liberiMese, daSegnareMese, arretrato };
  }, [celle]);

  const impegniOggi = useMemo(
    () => impegniDelGiorno(leads, isoOggi, consultant).length,
    [leads, isoOggi, consultant],
  );

  /* ── NAVIGAZIONE ─────────────────────────────────────────────────────── */
  //  Cambiando mese si sposta anche il giorno scelto: un pannello fermo su una
  //  data che non è più sullo schermo racconta un altro giorno.
  const cambiaMese = (delta: number) => {
    const d = new Date(anno, mese + delta, 1);
    setAnno(d.getFullYear());
    setMese(d.getMonth());
    const stessoMese = d.getFullYear() === oggi.getFullYear() && d.getMonth() === oggi.getMonth();
    setGiornoSel(stessoMese ? isoOggi : oggiIso(d));
  };
  const vaiAOggi = () => vaiA(isoOggi);
  const meseCorrente = anno === oggi.getFullYear() && mese === oggi.getMonth();

  //  Le frecce muovono il GIORNO scelto, non il mese: davanti a una griglia di
  //  giorni è quello che le dita si aspettano, ed è anche il gesto più
  //  frequente ("e domani? e dopodomani?"). Il mese resta sotto Maiusc.
  //  Su e giù non sono legate a niente di proposito: `useScorciatoie` blocca il
  //  comportamento predefinito del tasto, e una pagina che non scorre più con
  //  le frecce costa più di quanto valga saltare una settimana.
  //  Con una finestra aperta i tasti appartengono a lei: altrimenti una freccia
  //  premuta dentro il pannello cambierebbe il giorno sotto, e alla chiusura ci
  //  si ritroverebbe altrove senza capire perché.
  useScorciatoie(
    {
      ArrowLeft: (e) => (e.shiftKey ? cambiaMese(-1) : spostaGiorno(-1)),
      ArrowRight: (e) => (e.shiftKey ? cambiaMese(1) : spostaGiorno(1)),
      o: vaiAOggi,
      "?": () => setAiutoAperto((x) => !x),
      Escape: () => setAiutoAperto(false),
    },
    { bloccato: editOpen || giornoAperto },
  );

  /* ── APERTURE ────────────────────────────────────────────────────────── */
  const apriLead = (l: Lead) => {
    setEditing(l);
    setPrefill(undefined);
    setEditOpen(true);
    setGiornoAperto(false);
  };

  const apriFinestraGiorno = (ora?: string | null, lead?: Lead | null) => {
    setOraScelta(ora ?? null);
    setDaSpostare(lead ?? null);
    setGiornoAperto(true);
  };

  const etichettaSel = formatDate(giornoSel);

  //  I posti che si possono ancora PROPORRE: su oggi gli orari di stamattina
  //  sono liberi ma non sono offribili, e contarli faceva dire al telefono
  //  "ho ancora sei buchi" quando i primi quattro erano già passati.
  const offribiliSel = useMemo(
    () => orariOffribili(giornoSel, liberiSel).offribili.length,
    [giornoSel, liberiSel],
  );

  //  L'UNICO riepilogo del pannello. Prima ce n'erano due, uno sotto l'altro:
  //  "10 in agenda · 14 orari liberi su 24" e "10 mezz'ore su 24 già
  //  impegnate", cioè lo stesso fatto raccontato al dritto e al rovescio.
  //  Comincia dai posti perché è la domanda con cui si guarda un giorno.
  const notaPannello = !consultant
    ? "Seleziona un consulente"
    : //  Una data storta confrontata con "<" risponde a caso: qui rispondeva
      //  "giorno passato" su una stringa che nessuno sa leggere. "Non lo so" è
      //  la sola risposta onesta, ed è la stessa che dà la fila degli orari.
      !dataLeggibile(giornoSel)
      ? "Data non leggibile"
      : giornoPassato(giornoSel)
        ? //  Su un giorno finito i posti liberi non esistono più: quello che
          //  resta da dire è cosa c'era, e se è rimasto qualcosa da segnare.
          `Giorno passato · ${impegniSel.length} in agenda`
        : !caricoSel.lavorativo || caricoSel.totali === 0
          ? `Non lavorativo · ${impegniSel.length} in agenda`
          : `${offribiliSel} ${offribiliSel === 1 ? "posto libero" : "posti liberi"} · ${impegniSel.length} in agenda`;

  return (
    <Pagina larga>
      <Titolo
        testo="Agenda"
        icona={CalendarDays}
        nota="Dove c'è posto, giorno per giorno: gli orari da proporre a chi è al telefono"
        azioni={
          <AiutoScorciatoie voci={SCORCIATOIE} aperto={aiutoAperto} onCambia={setAiutoAperto} />
        }
      />

      <BarraAzioni>
        <Select value={consulenteId} onValueChange={setConsulenteId}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Consulente" />
          </SelectTrigger>
          <SelectContent>
            {consulentiScelta.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.data.nome}
              </SelectItem>
            ))}
            {/*  Dentro la tendina, che è dove si guarda mentre si sceglie un
                nome: la barra qui accanto è già una fila di comandi e una riga
                in più lì sopra non verrebbe letta. */}
            {ripiegoConsulenti && (
              <p className="px-2 py-1.5 text-[11px] leading-snug text-amber-800">
                {TESTO_SOLO_CONSULENTI}
              </p>
            )}
          </SelectContent>
        </Select>

        <SepBarra />
        <Button
          variant="outline"
          size="sm"
          onClick={() => cambiaMese(-1)}
          title="Mese precedente (Maiusc+←)"
          aria-label="Mese precedente"
          className="h-9 w-9 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[8.5rem] text-center text-[13px] font-semibold">
          {MESI_IT[mese]} {anno}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => cambiaMese(1)}
          title="Mese successivo (Maiusc+→)"
          aria-label="Mese successivo"
          className="h-9 w-9 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {/*  Compare solo quando serve davvero: se si sta già guardando oggi è un
             pulsante che non fa niente. */}
        {(!meseCorrente || giornoSel !== isoOggi) && (
          <Button variant="ghost" size="sm" onClick={vaiAOggi} title="Torna a oggi (O)">
            Oggi
          </Button>
        )}

        <span className="ml-auto" />
        <Button size="sm" onClick={() => apriFinestraGiorno()} className="h-9">
          <Plus className="h-3.5 w-3.5" />
          Nuovo appuntamento
        </Button>
      </BarraAzioni>

      {/* ── I TRE NUMERI CHE PORTANO DA QUALCHE PARTE ───────────────────────
           Non sono totali da leggere: sono salti. Il quarto riquadro ("Nel
           mese: N appuntamenti · giorno più carico") è stato tolto — dice al
           capo quanto si è lavorato, ma a chi chiama non serve sapere dove c'è
           più gente, serve sapere dove c'è posto. */}
      <KpiRiga colonne={3}>
        <Kpi
          etichetta="Primo posto libero"
          valore={
            prossimo
              ? etichettaProssimo(prossimo.date, prossimo.label, prossimo.ora, isoOggi)
              : "nessuno"
          }
          tono={prossimo ? "vinta" : "in_sospeso"}
          nota={
            prossimo
              ? //  "ancora": il conto parte da oggi, i giorni già passati non
                //  ci sono dentro (vedi `sintesi`).
                `${sintesi.liberiMese} posti ancora liberi in ${MESI_IT[mese].toLowerCase()} · premi per aprirlo`
              : "Nessun orario libero nei prossimi due mesi"
          }
          onClick={prossimo ? () => vaiA(prossimo.date) : undefined}
        />
        <Kpi
          etichetta="Oggi"
          valore={impegniOggi}
          tono={impegniOggi > 0 ? "in_corso" : "neutro"}
          nota="Appuntamenti di oggi · premi per aprirli"
          onClick={vaiAOggi}
          attivo={giornoSel === isoOggi}
        />
        {/*  Il numero che fa aprire l'agenda: appuntamenti finiti di cui nessuno
             ha segnato l'esito. Restano invisibili finché non li si cerca. */}
        <Kpi
          etichetta="Esiti da segnare"
          valore={sintesi.daSegnareMese}
          tono={sintesi.daSegnareMese > 0 ? "in_sospeso" : "neutro"}
          nota={
            sintesi.arretrato
              ? "Appuntamenti passati senza esito · premi per il più vecchio"
              : "Nessun esito arretrato in questo mese"
          }
          onClick={sintesi.arretrato ? () => vaiA(sintesi.arretrato!.iso) : undefined}
        />
      </KpiRiga>

      {/* ── CALENDARIO + GIORNO ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Scheda
          titolo={`${MESI_IT[mese]} ${anno}`}
          nota={consultant ? consultant.data.nome : "Nessun consulente selezionato"}
          icona={CalendarDays}
          classeCorpo="p-2.5 sm:p-4"
        >
          <div className="mb-1.5 grid grid-cols-7 gap-1 sm:gap-1.5">
            {DOW_SHORT.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "py-1 text-center text-[11px] font-medium",
                  i >= 5 ? "text-muted-foreground/60" : "text-muted-foreground",
                )}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {celle.map((g) => (
              <CellaGiorno
                key={g.iso}
                giorno={g}
                scelto={g.iso === giornoSel}
                onScegli={() => vaiA(g.iso)}
              />
            ))}
          </div>

          {/*  La legenda esiste perché un numero senza didascalia è un enigma:
              quattro voci, una per ogni segnale che il calendario usa davvero —
              e sono quattro proprio perché il vocabolario finisce qui. La prima
              è la più importante sul telefono, dove la parola "liberi" non ci
              sta dentro la cella. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-[13px] font-semibold leading-none text-foreground">6</span>
                <span className="block h-1.5 w-8 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full w-1/2 rounded-full bg-slate-500" />
                </span>
              </span>
              posti liberi quel giorno (barra = quanto ne resta)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-amber-500" />
              esiti da segnare
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-sky-600 text-[10px] font-semibold text-white">
                {oggi.getDate()}
              </span>
              oggi
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="block w-8 border-t border-dashed border-border" />
              non lavorativo
            </span>
          </div>
        </Scheda>

        {/* ── IL PANNELLO DEL GIORNO ──────────────────────────────────────
             SUL TELEFONO STA SOPRA IL MESE. Nel DOM viene dopo perché sul
             desktop è la colonna di destra, ma su uno schermo stretto le due
             schede si impilano e il pannello finiva sotto sei righe di
             calendario più la legenda: per dire un orario a chi è in linea
             bisognava scorrere. Qui la prima cosa che si vede sono gli orari
             di oggi; il mese resta subito sotto, per "e giovedì?". */}
        <div ref={rifPannello} className="order-first min-w-0 lg:order-none">
          <Scheda
            className="lg:sticky lg:top-16"
            titolo={<span className="capitalize">{etichettaSel}</span>}
            nota={notaPannello}
            azioni={
              <div className="flex items-center gap-1">
                {/*  Il giorno si sfoglia anche da qui: leggendo la giornata
                     capita di voler vedere "e domani?", e tornare a cercare la
                     cella nel calendario è un passaggio in più. */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => spostaGiorno(-1)}
                  title="Giorno precedente (←)"
                  aria-label="Giorno precedente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => spostaGiorno(1)}
                  title="Giorno successivo (→)"
                  aria-label="Giorno successivo"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => apriFinestraGiorno()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Fissa
                </Button>
              </div>
            }
            classeCorpo="p-3 sm:p-4 space-y-3"
          >
            {/*  PRIMA GLI ORARI DA DIRE AL TELEFONO. È la sola cosa che serve
                mentre qualcuno aspetta in linea: una fila di orari premibili,
                divisi in mattina e pomeriggio, che si leggono così come sono
                ("posso alle 10, alle 11:30 o alle 15"). Premerne uno apre la
                fissazione già su quell'ora, senza cambiare giorno né perdere il
                punto in cui si era. */}
            <OrariDaOffrire
              giorno={giornoSel}
              liberi={liberiSel}
              presiPerOra={quantiPerOra}
              capienza={capienzaConsulenza()}
              durata={PASSO}
              lavorativo={caricoSel.lavorativo}
              senzaConsulente={!consultant}
              onScegliOra={(ora) => apriFinestraGiorno(ora)}
              //  ⚠️ Serve a leggere i posti VERI: un'ora tenuta per una
              //   persona sola qui diceva «1/3, c'è posto» (la spunta si mette
              //   dalla finestra del giorno, che è dove si fissa).
              consultantId={consultant?.id}
            />

            {/*  Poi com'è occupata la giornata: chi c'è, a che ora, e i buchi
                come righe di contorno. Serve a capire "chi occupa le 11" e ad
                aprire la sua scheda, non a cercare posto. */}
            <LineaDelGiorno
              giorno={giornoSel}
              impegni={impegniSel}
              liberi={liberiSel}
              durata={PASSO}
              lavorativo={caricoSel.lavorativo}
              stretta
              onApriLead={apriLead}
              onSposta={(l) => apriFinestraGiorno(null, l)}
              onScegliOra={(ora) => apriFinestraGiorno(ora)}
            />
          </Scheda>
        </div>
      </div>

      {/* Il calendario qui sopra guarda un consulente alla volta: per capire chi
          copre le 15 di giovedì serve invece la squadra intera sulla stessa
          giornata, colonna per colonna. Segue il giorno scelto qui sopra, così
          le due viste non raccontano mai due giorni diversi — e resta chiusa
          finché non la si chiede, perché una tabella di ventiquattro righe
          aperta sotto il calendario era metà del disordine della pagina. */}
      <AgendaTuttiConsulenti
        leads={leads}
        consultants={consultants}
        date={giornoSel}
        //  Cambiando giorno da qui il calendario deve seguirlo: restando sul
        //  mese di prima il giorno scelto non aveva una cella accesa da
        //  nessuna parte, e il pannello raccontava una data che nella griglia
        //  del mese non compariva. Niente scorrimento (non si usa `vaiA`):
        //  chi sta guardando questa tabella non vuole essere portato altrove.
        onCambiaData={(iso) => {
          const d = new Date(iso + "T00:00:00");
          if (!Number.isNaN(d.getTime())) {
            setAnno(d.getFullYear());
            setMese(d.getMonth());
          }
          setGiornoSel(iso);
        }}
        onOpenLead={apriLead}
        onCreateAtSlot={(consulenteId, giorno, ora) => {
          setEditing(null);
          setPrefill({
            consulenteId,
            dataMeeting: giorno,
            oraMeeting: ora,
            stato: "appuntamento_fissato",
          });
          setEditOpen(true);
        }}
      />

      <AgendaDaySheet
        open={giornoAperto}
        onOpenChange={(o) => {
          setGiornoAperto(o);
          if (!o) {
            setOraScelta(null);
            setDaSpostare(null);
          }
        }}
        date={giornoSel}
        consultant={consultant}
        leads={leads}
        consultants={consultants}
        oraIniziale={oraScelta}
        leadDaSpostare={daSpostare}
        onOpenLead={apriLead}
        onCreateLead={(pf) => {
          setEditing(null);
          setPrefill(pf);
          setEditOpen(true);
          setGiornoAperto(false);
        }}
      />

      <LeadDialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setPrefill(undefined);
        }}
        lead={editing}
        prefill={prefill}
      />
    </Pagina>
  );
}
