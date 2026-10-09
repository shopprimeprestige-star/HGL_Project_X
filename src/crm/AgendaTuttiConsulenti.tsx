/** AgendaTuttiConsulenti — la giornata di TUTTI i consulenti, uno accanto all'altro.
 *
 *  L'agenda mensile risponde a "quando è libero Marco?"; questa risponde alla
 *  domanda che ci si fa davvero quando squilla il telefono: "chi ce la fa oggi
 *  alle 15?". Con una colonna per consulente e una riga ogni 30 minuti, gli
 *  incastri e i buchi della giornata si vedono senza aprire nulla.
 *
 *  Cosa finisce nella griglia: meeting, "viene in sede" e installazioni, cioè
 *  tutto ciò che booking-utils considera tempo occupato. Mostrarne solo una
 *  parte darebbe l'illusione di slot liberi che liberi non sono. Per la stessa
 *  ragione una posa compare anche nella colonna del DRIVER che accompagna, e le
 *  ore di strada (due per chi posa, tre per chi guida) si spengono come una
 *  pausa: sono tempo in cui quella persona non c'è, e la griglia non deve
 *  offrirlo a chi cerca "chi copre le 15?".
 *
 *  RIVESTITA CON IL LINGUAGGIO DEL CALENDARIO NUOVO
 *   · SI APRE SOLO SE LA SI CHIEDE. Ventiquattro righe per cinque colonne
 *     aperte sotto il calendario erano metà del disordine della pagina: sono
 *     una risposta precisa ("chi copre le 15?"), non un panorama da tenere
 *     sempre acceso. Chiusa resta una riga che dice quanto c'è dentro.
 *   · SEGUE IL GIORNO SCELTO NEL CALENDARIO. Aveva un suo selettore di data
 *     indipendente: si finiva col guardare il 14 sopra e il 12 sotto, sulla
 *     stessa schermata, senza accorgersene. Ora la data si può ancora cambiare
 *     da qui, ma è la stessa delle due viste.
 *   · MENO COLORE, PIÙ STRUTTURA. Le celle libere erano verdi a tutta griglia e
 *     gli appuntamenti riquadri pieni del colore dello stato: una griglia così
 *     è una bandiera, non un'agenda. Adesso il blocco è neutro e lo stato è un
 *     pallino, come nella linea del giorno; il tratteggio dice "libero".
 *   · SUPERFICIE UNICA. Card grezza → <Scheda/>, come tutte le altre sezioni
 *     del CRM.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  MapPin,
  Wrench,
  Video,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date-format";
import { Chip, PUNTO_TONO, Scheda, tonoStato } from "@/crm/ui";
//  La durata di serie di una consulenza: una sola per tutto il CRM.
import { DURATA_PREDEFINITA } from "@/crm/invito";
//  Chi fa le consulenze si chiede lì, e solo lì: vedi la testata di quel file.
import { NotaSoloConsulenti, consulentiPerConsulenza } from "@/crm/chi-fa-la-consulenza";
import { LEAD_STATUS_LABEL, type Consultant, type FasciaOraria, type Lead } from "@/crm/types";
import {
  STRADA_ACCOMPAGNATORE,
  STRADA_DRIVER,
  STRADA_POSATORE,
  pauseDelGiorno,
} from "@/crm/booking-utils";

// La giornata operativa: 9–21 a passi di 30'. Fuori da questa fascia non si
// fissa nulla, ma gli appuntamenti che ci finiscono comunque non spariscono:
// vengono elencati sotto la griglia (vedi `fuoriFascia`).
const START_MIN = 9 * 60;
const END_MIN = 21 * 60;
const STEP = 30;
const ROWS = (END_MIN - START_MIN) / STEP;
// Altezza di riga fissa: serve a dare ai blocchi multi-slot un'altezza
// proporzionale alla durata reale, che è l'unico modo per leggere gli incastri.
const ROW_H = 40;

type EventKind = "meet" | "sede" | "install";

interface AgendaEvent {
  key: string;
  lead: Lead;
  kind: EventKind;
  startMin: number;
  endMin: number;
  ora: string;
}

interface PlacedEvent {
  ev: AgendaEvent;
  span: number;
}

/** Cella della griglia: inizio di un appuntamento, riga coperta da quello sopra, o libera. */
type Cell = { t: "start"; placed: PlacedEvent } | { t: "covered" } | { t: "free" };

interface ColumnData {
  consultant: Consultant;
  cells: Cell[];
  /** true = il consulente lavora in quella mezz'ora (fasce, pause, indisponibilità) */
  work: boolean[];
  appuntamenti: number;
  liberi: number;
  primoLibero: string | null;
  /** appuntamenti che non entrano nella griglia: si sovrappongono o cadono fuori 9–21 */
  sovrapposti: AgendaEvent[];
  fuoriFascia: AgendaEvent[];
}

const KIND_ICON = { meet: Video, sede: MapPin, install: Wrench } as const;
const KIND_LABEL = { meet: "Meeting", sede: "In sede", install: "Installazione" } as const;

function toMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function isoOf(d: Date): string {
  // Costruita a mano: toISOString() sposta la data di un giorno per chi sta a est di Greenwich.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function fasceDelGiorno(c: Consultant, dow: number): FasciaOraria[] {
  const override = c.data.fasceOrarieGiorno?.[dow];
  if (override && override.length > 0) return override;
  return c.data.fasceOrarie || [];
}

/** Maschera delle mezz'ore lavorabili: distingue un buco vero da un orario in cui
 *  il consulente non c'è. Senza questa distinzione la griglia mostrerebbe come
 *  disponibili le prime ore del mattino di chi lavora solo di pomeriggio. */
function buildWorkMask(c: Consultant, date: string): boolean[] {
  const mask = new Array<boolean>(ROWS).fill(false);
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return mask;
  const dow = d.getDay();
  if (!c.data.giorniLavorativi?.includes(dow)) return mask;

  const fasce = fasceDelGiorno(c, dow);
  //  Stessa lettura tollerante del calendario: `pause` nel database è a volte
  //  un elenco, a volte un oggetto per giorno (vedi pauseDelGiorno).
  const pause = pauseDelGiorno(c, dow);
  const blocchi = (c.data.indisponibilita || []).filter((x) => x.data === date);

  for (let r = 0; r < ROWS; r++) {
    const s = START_MIN + r * STEP;
    const e = s + STEP;
    const inFascia = fasce.some((f) => {
      const fs = toMin(f.inizio);
      const fe = toMin(f.fine);
      return fs !== null && fe !== null && overlaps(s, e, fs, fe);
    });
    if (!inFascia) continue;
    const inPausa = pause.some((p) => {
      const ps = toMin(p.inizio);
      const pe = toMin(p.fine);
      return ps !== null && pe !== null && overlaps(s, e, ps, pe);
    });
    if (inPausa) continue;
    const bloccato = blocchi.some((b) => {
      if (!b.inizio || !b.fine) return true; // indisponibilità di tutto il giorno
      const bs = toMin(b.inizio);
      const be = toMin(b.fine);
      return bs !== null && be !== null && overlaps(s, e, bs, be);
    });
    if (bloccato) continue;
    mask[r] = true;
  }
  return mask;
}

function eventiDelConsulente(c: Consultant, date: string, leads: Lead[]): AgendaEvent[] {
  const out: AgendaEvent[] = [];
  for (const l of leads) {
    const d = l.data;
    if (d.consulenteId === c.id && d.dataMeeting === date && d.oraMeeting) {
      const s = toMin(d.oraMeeting);
      if (s !== null) {
        out.push({
          key: `${l.id}-meet`,
          lead: l,
          kind: "meet",
          startMin: s,
          endMin: s + (d.durataMeeting || DURATA_PREDEFINITA),
          ora: d.oraMeeting,
        });
      }
    }
    if (d.consulenteId === c.id && d.dataVieneInSede === date && d.oraVieneInSede) {
      const s = toMin(d.oraVieneInSede);
      if (s !== null) {
        out.push({
          key: `${l.id}-sede`,
          lead: l,
          kind: "sede",
          startMin: s,
          endMin: s + (d.durataVieneInSede || 60),
          ora: d.oraVieneInSede,
        });
      }
    }
    //  ── UNA POSA PUÒ ESSERE DI TRE PERSONE ───────────────────────────────
    //   Chi posa, chi lo affianca sul lavoro (l'accompagnatore) e chi ce lo
    //   porta (il driver). La posa compare in TUTTE le loro colonne perché in
    //   quell'ora sono fuori tutti: mostrarla solo al posatore lasciava vuota la
    //   colonna di chi in quella giornata non c'era.
    const inst = d.installazione;
    const posa = inst?.consulenteInstallazioneId === c.id;
    const guida = !!inst?.driverId && inst.driverId === c.id;
    const affianca = !!inst?.accompagnatoreId && inst.accompagnatoreId === c.id;
    if (
      (posa || guida || affianca) &&
      inst?.dataInstallazione === date &&
      inst?.orarioInstallazione
    ) {
      const s = toMin(inst.orarioInstallazione);
      if (s !== null) {
        out.push({
          key: `${l.id}-install`,
          lead: l,
          kind: "install",
          startMin: s,
          endMin: s + (inst.durataInstallazione || 60),
          ora: inst.orarioInstallazione,
        });
      }
    }
  }
  return out.sort((a, b) => a.startMin - b.startMin);
}

/** ── IL TEMPO DELLA STRADA, DISEGNATO ──────────────────────────────────────
 *  Le ore prima e dopo una posa in cui la persona è in viaggio: booking-utils le
 *  toglie dagli orari prenotabili, e questa griglia deve toglierle dalle celle
 *  libere. Altrimenti succede la cosa peggiore che una griglia possa fare —
 *  mostrare un buco bianco alle 15 e poi rifiutare le 15 quando qualcuno prova a
 *  fissarcele, senza spiegare perché.
 *  I minuti sono gli stessi di booking-utils (importati, non ricopiati): due
 *  numeri scritti in due file si separano al primo ripensamento.
 *
 *  Si restituiscono solo le CODE, non la posa: quella è già un blocco disegnato
 *  con il nome del cliente sopra, e sovrascriverla non aggiungerebbe niente.
 *  Le code invece diventano celle grigie, come una pausa — che è esattamente
 *  quello che sono: tempo in cui la persona non c'è. */
function fasceDiStrada(c: Consultant, date: string, leads: Lead[]): [number, number][] {
  const out: [number, number][] = [];
  for (const l of leads) {
    const inst = l.data.installazione;
    if (!inst || inst.dataInstallazione !== date || !inst.orarioInstallazione) continue;
    const posa = inst.consulenteInstallazioneId === c.id;
    const guida = !!inst.driverId && inst.driverId === c.id;
    //  Chi affianca fa lo stesso viaggio di chi posa: parte con lui e torna con
    //  lui. Se la sua strada non si disegnasse qui, la griglia mostrerebbe un
    //  buco bianco alle 15 su una persona che booking-utils considera in
    //  viaggio, e le 15 verrebbero rifiutate senza spiegare perché.
    const affianca = !!inst.accompagnatoreId && inst.accompagnatoreId === c.id;
    if (!posa && !guida && !affianca) continue;
    const s = toMin(inst.orarioInstallazione);
    if (s === null) continue;
    const e = s + (inst.durataInstallazione || 60);
    //  Chi guida sta in strada di più. Chi fa più cose sulla stessa posa prende
    //  il margine più largo: fra due risposte si tiene quella che toglie più
    //  tempo, come in booking-utils.
    const margine = guida ? STRADA_DRIVER : posa ? STRADA_POSATORE : STRADA_ACCOMPAGNATORE;
    out.push([s - margine, s]);
    out.push([e, e + margine]);
  }
  return out;
}

function buildColumn(c: Consultant, date: string, leads: Lead[]): ColumnData {
  const cells: Cell[] = new Array(ROWS).fill(null).map(() => ({ t: "free" }) as Cell);
  const work = buildWorkMask(c, date);
  //  La strada si sottrae DOPO l'orario di lavoro, mai al posto suo: è una
  //  regola in più, non una regola diversa.
  for (const [inizio, fine] of fasceDiStrada(c, date, leads)) {
    for (let r = 0; r < ROWS; r++) {
      const s = START_MIN + r * STEP;
      if (overlaps(s, s + STEP, inizio, fine)) work[r] = false;
    }
  }
  const sovrapposti: AgendaEvent[] = [];
  const fuoriFascia: AgendaEvent[] = [];

  for (const ev of eventiDelConsulente(c, date, leads)) {
    if (ev.endMin <= START_MIN || ev.startMin >= END_MIN) {
      fuoriFascia.push(ev);
      continue;
    }
    const row = Math.max(0, Math.floor((ev.startMin - START_MIN) / STEP));
    const endRow = Math.min(ROWS, Math.ceil((Math.min(ev.endMin, END_MIN) - START_MIN) / STEP));
    const span = Math.max(1, endRow - row);
    // Due appuntamenti sulla stessa fascia non si possono impilare in una tabella
    // senza mentire sugli orari: il secondo esce dalla griglia e viene segnalato,
    // perché una sovrapposizione è esattamente il problema che si cerca qui.
    let libero = true;
    for (let r = row; r < row + span; r++) {
      if (cells[r].t !== "free") libero = false;
    }
    if (!libero) {
      sovrapposti.push(ev);
      continue;
    }
    cells[row] = { t: "start", placed: { ev, span } };
    for (let r = row + 1; r < row + span; r++) cells[r] = { t: "covered" };
  }

  let liberi = 0;
  let primoLibero: string | null = null;
  for (let r = 0; r < ROWS; r++) {
    if (work[r] && cells[r].t === "free") {
      liberi++;
      if (!primoLibero) primoLibero = fmtMin(START_MIN + r * STEP);
    }
  }
  const appuntamenti =
    cells.filter((x) => x.t === "start").length + sovrapposti.length + fuoriFascia.length;

  return {
    consultant: c,
    cells,
    work,
    appuntamenti,
    liberi,
    primoLibero,
    sovrapposti,
    fuoriFascia,
  };
}

interface Props {
  leads: Lead[];
  consultants: Consultant[];
  /** apre la scheda del lead cliccando un appuntamento */
  onOpenLead?: (lead: Lead) => void;
  /** crea un lead già agganciato a consulente + giorno + ora cliccando una cella libera */
  onCreateAtSlot?: (consulenteId: string, date: string, ora: string) => void;
  /** giorno mostrato: passandolo, la griglia segue il calendario della pagina */
  date?: string;
  onCambiaData?: (date: string) => void;
  /** giorno di partenza quando la griglia si governa da sola (default: oggi) */
  initialDate?: string;
  /** true = già aperta al primo render (montata da sola, senza calendario sopra) */
  apertaAllInizio?: boolean;
}

export function AgendaTuttiConsulenti({
  leads,
  consultants,
  onOpenLead,
  onCreateAtSlot,
  date: dataDalPadre,
  onCambiaData,
  initialDate,
  apertaAllInizio,
}: Props) {
  //  Chiusa di default: sotto il calendario è una risposta che si chiede, non
  //  un panorama da tenere acceso. Il riepilogo nell'intestazione basta a
  //  decidere se vale la pena aprirla.
  const [aperta, setAperta] = useState(!!apertaAllInizio);
  const [dataInterna, setDataInterna] = useState<string>(initialDate || isoOf(new Date()));
  //  Controllata dal padre quando il padre gliela passa, autonoma altrimenti:
  //  la griglia deve funzionare anche montata da sola.
  const date = dataDalPadre ?? dataInterna;
  const impostaData = (v: string) => {
    setDataInterna(v);
    onCambiaData?.(v);
  };
  const [soloAttivi, setSoloAttivi] = useState(true);

  //  ── UNA COLONNA PER CONSULENTE, E SOLO PER I CONSULENTI ────────────────
  //   Questa griglia risponde a «chi copre le 15?», e cliccando una cella libera
  //   si fissa lì un appuntamento (`onCreateAtSlot`): una colonna intestata a un
  //   driver o a un installatore offriva ore libere a chi le consulenze non le
  //   fa, ed erano per giunta le colonne più vuote — cioè quelle che l'occhio
  //   sceglieva per prime cercando un buco.
  //   ⚠️ Non si perde niente di quello che questa scheda diceva: le pose che
  //   occupano l'agenda di un driver restano segnate sulla colonna di CHI POSA e
  //   sull'ora della strada. La colonna del driver serviva a non offrire un
  //   orario a lui, e a lui adesso non si offre più niente.
  //   Finché nessuno è segnato consulente si vedono tutti — vedi il ripiego in
  //   crm/chi-fa-la-consulenza — così il giorno del rilascio la griglia non
  //   nasce vuota.
  const { elenco: possibili, ripiego: ripiegoConsulenti } = useMemo(
    () => consulentiPerConsulenza(consultants, { leads }),
    [consultants, leads],
  );

  const colonne = useMemo(() => {
    const attivi = possibili.filter((c) => c.data.attivo);
    // Se nessuno risulta attivo la griglia vuota non aiuterebbe nessuno:
    // meglio mostrarli tutti che una pagina bianca senza spiegazione.
    const base = soloAttivi && attivi.length > 0 ? attivi : possibili;
    return [...base]
      .sort((a, b) => (a.data.nome || "").localeCompare(b.data.nome || ""))
      .map((c) => buildColumn(c, date, leads));
  }, [possibili, leads, date, soloAttivi]);

  const totali = useMemo(() => {
    const app = colonne.reduce((s, c) => s + c.appuntamenti, 0);
    const liberi = colonne.reduce((s, c) => s + c.liberi, 0);
    const anomalie = colonne.reduce((s, c) => s + c.sovrapposti.length + c.fuoriFascia.length, 0);
    return { app, liberi, anomalie };
  }, [colonne]);

  const oggi = isoOf(new Date());
  //  Sul giorno di oggi la riga dell'ora corrente porta un segno: dice "da qui
  //  in giù è ancora recuperabile", che è l'unica cosa che cambia guardando la
  //  stessa griglia alle 9 o alle 18.
  const rigaAdesso = useMemo(() => {
    if (date !== oggi) return -1;
    const adesso = new Date();
    const m = adesso.getHours() * 60 + adesso.getMinutes();
    if (m < START_MIN || m >= END_MIN) return -1;
    return Math.floor((m - START_MIN) / STEP);
  }, [date, oggi]);

  return (
    <Scheda
      icona={Users}
      //  Il titolo dice a cosa serve, non cosa contiene: la si apre per sapere
      //  chi può prendere le 15, non per guardare la squadra.
      titolo="Chi è libero, ora per ora"
      nota={
        <>
          {/*  Prima i posti liberi: chiusa, questa riga è tutto quello che si
               vede, e deve rispondere alla domanda con cui la si guarda. */}
          <span className="capitalize">{formatDate(date)}</span> · {totali.liberi} posti liberi ·{" "}
          {totali.app} appuntamenti · {colonne.length} consulenti
          {/*  Chiusa, il riepilogo è tutto quello che si vede: se c'è qualcosa
               fuori posto va detto qui, altrimenti resta sepolto sotto un
               pannello che nessuno apre. */}
          {totali.anomalie > 0 && (
            <span className="font-medium text-amber-700"> · {totali.anomalie} da controllare</span>
          )}
        </>
      }
      azioni={
        <div className="flex flex-wrap items-center gap-1.5">
          {/*  I comandi della giornata esistono solo mentre la griglia si vede:
               chiusa, sarebbero quattro pulsanti che agiscono su niente. */}
          {aperta && (
            <>
              <Button
                variant={soloAttivi ? "default" : "outline"}
                size="sm"
                onClick={() => setSoloAttivi(!soloAttivi)}
                title="Mostra solo i consulenti attivi"
                className="h-9"
              >
                Solo attivi
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => impostaData(shiftIso(date, -1))}
                aria-label="Giorno precedente"
                className="h-9 w-9 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={date}
                onChange={(e) => e.target.value && impostaData(e.target.value)}
                className="h-9 w-[9.5rem]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => impostaData(shiftIso(date, 1))}
                aria-label="Giorno successivo"
                className="h-9 w-9 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => impostaData(oggi)}
                disabled={date === oggi}
                className="h-9"
              >
                Oggi
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAperta((v) => !v)}
            aria-expanded={aperta}
            title={aperta ? "Chiudi la griglia della squadra" : "Apri la griglia della squadra"}
            className="h-9"
          >
            {aperta ? "Chiudi" : "Apri la griglia"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", aperta && "rotate-180")} />
          </Button>
        </div>
      }
      classeCorpo="p-3 sm:p-4 space-y-3"
    >
      {!aperta ? null : colonne.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
          Nessun consulente disponibile.
        </p>
      ) : (
        <>
          {/*  Sopra la griglia, non sotto: dice perché le colonne sono più di
              quelle che ci si aspetta PRIMA che qualcuno ci fissi sopra un
              appuntamento. */}
          <NotaSoloConsulenti ripiego={ripiegoConsulenti} />
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th
                    className="sticky left-0 top-0 z-30 w-14 min-w-14 border-b border-r border-border bg-card text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                    style={{ height: ROW_H }}
                  >
                    Ora
                  </th>
                  {colonne.map((col) => (
                    <th
                      key={col.consultant.id}
                      className="sticky top-0 z-20 min-w-[9.5rem] border-b border-r border-border bg-card px-2 py-1.5 text-left last:border-r-0"
                    >
                      <div className="truncate text-[12.5px] font-semibold">
                        {col.consultant.data.nome}
                      </div>
                      {/*  Sotto il nome, la sola cosa che serve per scegliere a
                           chi dare la prossima chiamata: quanti posti ha e da
                           che ora. Gli appuntamenti vengono dopo. */}
                      <div className="truncate text-[11px] font-normal tabular-nums text-muted-foreground">
                        {col.liberi} liberi
                        {col.primoLibero ? ` da ${col.primoLibero}` : ""} · {col.appuntamenti} app
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: ROWS }, (_, r) => {
                  const min = START_MIN + r * STEP;
                  const oraLabel = fmtMin(min);
                  const isOra = min % 60 === 0;
                  const adesso = r === rigaAdesso;
                  return (
                    <tr key={r}>
                      <td
                        className={cn(
                          "sticky left-0 z-10 border-b border-r border-border bg-card text-center align-middle tabular-nums",
                          isOra
                            ? "text-[11px] font-semibold text-foreground"
                            : "text-[10.5px] text-muted-foreground",
                        )}
                        style={{ height: ROW_H }}
                      >
                        <span className="inline-flex items-center gap-1">
                          {adesso && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-sky-500"
                              title="Siamo qui"
                            />
                          )}
                          {oraLabel}
                        </span>
                      </td>
                      {colonne.map((col) => {
                        const cell = col.cells[r];
                        if (cell.t === "covered") return null;

                        if (cell.t === "start") {
                          const { ev, span } = cell.placed;
                          const Icon = KIND_ICON[ev.kind];
                          const l = ev.lead;
                          return (
                            <td
                              key={col.consultant.id}
                              rowSpan={span}
                              className="border-b border-r border-border p-0.5 align-top last:border-r-0"
                            >
                              {/*  Blocco neutro con un pallino di stato, come
                                   nella linea del giorno: il colore serve a
                                   distinguere UNA riga fra le altre, e se lo
                                   prendono tutte non distingue più niente. */}
                              <button
                                type="button"
                                onClick={() => onOpenLead?.(l)}
                                title={`${KIND_LABEL[ev.kind]} · ${fmtMin(ev.startMin)}–${fmtMin(ev.endMin)} · ${l.data.nome} ${l.data.cognome} · ${LEAD_STATUS_LABEL[l.data.stato]}`}
                                className="flex w-full items-start gap-1.5 overflow-hidden rounded-lg border border-border bg-card px-1.5 py-1 text-left transition-colors hover:border-foreground/30 hover:bg-accent/60"
                                style={{ minHeight: span * ROW_H - 4 }}
                              >
                                <span
                                  className={cn(
                                    "mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full",
                                    PUNTO_TONO[tonoStato(l.data.stato)],
                                  )}
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1 text-[10.5px] font-semibold tabular-nums text-muted-foreground">
                                    <Icon className="h-3 w-3 shrink-0" />
                                    {fmtMin(ev.startMin)}–{fmtMin(ev.endMin)}
                                  </span>
                                  <span className="block truncate text-[11.5px] font-semibold leading-tight">
                                    {l.data.nome} {l.data.cognome}
                                  </span>
                                  <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                                    {LEAD_STATUS_LABEL[l.data.stato]}
                                  </span>
                                </span>
                              </button>
                            </td>
                          );
                        }

                        const lavora = col.work[r];
                        return (
                          <td
                            key={col.consultant.id}
                            className={cn(
                              "border-b border-r border-border p-0.5 last:border-r-0",
                              !lavora && "bg-muted/40",
                            )}
                            style={{ height: ROW_H }}
                          >
                            {lavora && (
                              <button
                                type="button"
                                onClick={() => onCreateAtSlot?.(col.consultant.id, date, oraLabel)}
                                disabled={!onCreateAtSlot}
                                title={`${col.consultant.data.nome} libero alle ${oraLabel}`}
                                className="group flex h-full min-h-[2rem] w-full items-center justify-center rounded-lg border border-dashed border-border transition-colors hover:border-foreground/30 hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
                              >
                                <Plus className="h-3 w-3 text-muted-foreground/30 transition-colors group-hover:text-foreground" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legenda: senza, il tratteggio e il grigio si leggono allo stesso modo */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-dashed border-border" />
              libero, premi per fissare
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-border bg-muted" />
              fuori orario, pausa, indisponibilità o tempo di strada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              il pallino è la fase della trattativa
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Video className="h-3 w-3" /> meeting
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> viene in sede
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Wrench className="h-3 w-3" /> installazione
            </span>
          </div>

          {/* Ciò che la griglia non può contenere va detto, non nascosto */}
          {totali.anomalie > 0 && (
            <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" />
                Da controllare
              </div>
              {colonne.map((col) =>
                [
                  ...col.sovrapposti.map((e) => ({ e, motivo: "sovrapposto" })),
                  ...col.fuoriFascia.map((e) => ({ e, motivo: "fuori 9–21" })),
                ].map(({ e, motivo }) => (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => onOpenLead?.(e.lead)}
                    className="flex flex-wrap items-center gap-2 text-[12px] text-amber-900 hover:underline"
                  >
                    <span className="tabular-nums">{fmtMin(e.startMin)}</span>
                    <span className="font-medium">
                      {e.lead.data.nome} {e.lead.data.cognome}
                    </span>
                    <span className="opacity-70">{col.consultant.data.nome}</span>
                    <Chip tono="in_sospeso">{motivo}</Chip>
                  </button>
                )),
              )}
            </div>
          )}
        </>
      )}
    </Scheda>
  );
}
