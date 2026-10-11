/** ── LA SCHEDA «OGGI» — LE SCADENZE DEL SETTER ─────────────────────────────
 *
 *  Le due cose che un setter si porta dietro da una telefonata all'altra:
 *   · «lo richiamo giovedì alle 15:30» — la promessa fatta a voce;
 *   · «ricordati di riprovare al numero fisso» — la nota che si scrive lui.
 *  Fino a ieri la prima viveva solo dentro la coda (un lead con una data, che
 *  ricompariva il giorno giusto e senza un'ora) e la seconda da nessuna parte in
 *  questa pagina. Sono la stessa cosa per chi lavora: un momento della giornata
 *  a cui bisogna esserci. Perciò stanno in un elenco solo, ordinato per
 *  orologio, e si comportano allo stesso modo.
 *
 *  ── PERCHÉ È UNA VISTA DI /CRM/importa E NON UNA VOCE DI MENU ─────────────
 *  Per la stessa ragione della scheda dei saltati (vedi SchedaSaltati.tsx): è
 *  lo stesso lavoro guardato da un altro lato, con la stessa testata sopra e
 *  con la coda a un pulsante di distanza. Il gesto che chiude una riga di qui —
 *  chiamare, segnare l'esito — è esattamente il gesto della coda.
 *
 *  ── COSA SUCCEDE QUANDO L'ORA ARRIVA ──────────────────────────────────────
 *  La riga cambia fascia da sola, senza che nessuno tocchi niente: l'orologio
 *  della pagina batte ogni quindici secondi e `calcolaScadenze` ricalcola. Alle
 *  15:15 la riga dice «fra 15 min» ed è in «Più tardi oggi»; alle 15:30 sale in
 *  cima, in «Adesso», col fondo acceso e la cornetta a portata di pollice. Non
 *  c'è nessun elenco «scadute» tenuto da parte: la fascia È il calcolo, e per
 *  questo non può scollarsi.
 *
 *  ⚠️ LE FASCE E IL LORO DECADIMENTO NON SI DECIDONO QUI. Stanno in
 *   crm/importa/scadenze, con scritto per esteso perché una promessa mancata
 *   scende invece di restare in cima per sempre. Questo file DISEGNA quella
 *   regola: in particolare «Dimenticate» nasce chiusa a fisarmonica, ed è la
 *   sola cosa che tiene la scheda leggibile dopo due settimane storte.
 *
 *  ⚠️ E NEMMENO IL VERSO CON CUI SI LEGGONO LE DUE FASCE DEL PASSATO. Quello
 *   sta in crm/dafare/arretrati, che è lo stesso file da cui lo prendono i due
 *   mucchi arretrati di /CRM/dafare: stesse parole, stessa striscia, stessa
 *   preferenza salvata. Di partenza si parte dai più vicini a oggi — sono
 *   quelli che una telefonata recupera ancora — e si gira in un clic quando
 *   invece si sta facendo pulizia. Questo file lo DISEGNA soltanto, e per non
 *   inventarsi una seconda risposta legge lo stesso verso che disegna.
 *
 *  ⚠️ LE NOTE SONO QUELLE DI «DA FARE OGGI». Stessa lista, stessa riga di
 *   `app_config` (crm/dafare/task-manuali): una nota scritta da qui si vede in
 *   /CRM/dafare e viceversa. Non è un dettaglio di implementazione, è la
 *   promessa che questa scheda non diventi un secondo posto in cui cercare le
 *   proprie cose da fare.
 *
 *  ── DUE COSE SI ELIMINANO QUI, E NON SONO LA STESSA ──────────────────────
 *  Una riga di questo elenco è una nota scritta a mano OPPURE un richiamo
 *  concordato con una persona: le due cose non stanno mai sulla stessa riga, ma
 *  stanno nello stesso elenco. Buttare una nota è un gesto da niente; eliminare
 *  il contatto è per sempre e non ha cestino.
 *  ⚠️ PER QUESTO NON HANNO LA STESSA ICONA. Il cestino resta della nota, e da
 *   sempre; il contatto si elimina con `UserX`, accanto al `User` che ne apre la
 *   scheda — «la persona» e «togli la persona». Due cestini identici a due
 *   righe di distanza, uno che butta un promemoria e uno che cancella un
 *   cliente, sono lo sbaglio che si fa una volta sola e non si ripara.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Plus,
  SlidersHorizontal,
  StickyNote,
  Trash2,
  Undo2,
  User,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
//  Il pezzo di nota che si legge di sfuggita: la regola (e il perché) sta lì.
import { notaInBreve } from "./nota-breve";
import { cn } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/crm/types";
//  La pastiglia è quella di tutto il CRM: gli stati che propone li decide
//  `statiPer` a partire dai dati del lead, quindi una riga importata continua a
//  vedere gli stati della prima chiamata anche da qui.
import { PastigliaStato } from "@/crm/SelettoreStatoDialog";
import { ChipAttesa, Scheda, Vuoto } from "@/crm/ui";
//  ⚠️ Anche `MINIMO_PER_ORDINARE` viene da lì: era scritto qui e in /CRM/dafare,
//  con lo stesso valore e due commenti gemelli. Il verso, le parole e la soglia
//  sono lo stesso comando visto da due pagine.
import { MINIMO_PER_ORDINARE, ScambiaVerso, useVersoArretrati } from "@/crm/dafare/arretrati";
//  ⚠️ Il filtro «di chi» è LO STESSO di /CRM/dafare, componente compreso: le
//   due schermate mostrano la stessa giornata da due porte diverse, e due
//   filtri con lo stesso scopo e due aspetti diversi si imparano due volte.
import { FiltroDiChi } from "@/crm/dafare/FiltroDiChi";
import {
  contaDiChi,
  personeDelFiltro,
  rigaPassaChi,
  type MappaMestieri,
} from "@/crm/dafare/di-chi";
import { TastoChiama } from "./chiamare";
import {
  FASCE,
  //  I due mucchi del passato: una definizione sola, letta da qui per sapere
  //  quali fasce si tingono d'ambra e quali portano il comando dell'ordine.
  //  Prima era un `PASSATO` scritto a mano in questo file, cioè un secondo
  //  elenco delle stesse due fasce che nessuno avrebbe aggiornato il giorno in
  //  cui ne nasce una terza.
  FASCE_ARRETRATE,
  NOTA_FASCIA,
  SCADUTA_DA_TROPPO,
  TITOLO_FASCIA,
  //  ⚠️ Il conto delle righe in ritardo si CHIEDE, non si rifà. Qui c'era un
  //   `voci.filter(...)` con le tre fasce riscritte a mano: la stessa parola
  //   («in ritardo») contata in due posti diversi è la fascia in cima che dice
  //   3 e questa scheda che ne dice 4 — e a quel punto non si crede più a
  //   nessuna delle due. La definizione sta in FASCE_IN_RITARDO, una sola.
  contaInRitardo,
  righeDi,
  ritardoLeggibile,
  type RigaScadenza,
} from "./scadenze";

/** Una riga. Due sole informazioni in grande — CHE COSA e QUANDO — e i comandi
 *  a destra: è la stessa forma delle righe di «Da fare oggi»
 *  (crm/dafare/VoceDaFare), perché chi passa da una pagina all'altra non deve
 *  reimparare dove si guarda. */
function Riga({
  voce,
  urgente,
  occupato,
  armata,
  onArma,
  onChiama,
  onRidaiData,
  onApriLead,
  onStato,
  onEliminaLead,
  onSpunta,
  onElimina,
}: {
  voce: RigaScadenza;
  /** Il fondo acceso della fascia «Adesso»: è l'unico punto colorato
   *  dell'elenco, per la stessa ragione per cui la testata ne ha uno solo. */
  urgente?: boolean;
  occupato?: boolean;
  /** Vero quando è QUESTA la riga che sta chiedendo conferma prima di
   *  eliminare. La domanda aperta è una sola in tutto l'elenco e la tiene la
   *  scheda: dieci tasti rossi accesi insieme sono dieci occasioni di cancellare
   *  la persona sbagliata. */
  armata?: boolean;
  onArma: (v: boolean) => void;
  onChiama: (l: Lead) => void;
  onRidaiData: (l: Lead) => void;
  onApriLead: (l: Lead) => void;
  /** Il cambio di stato dalla pastiglia. È la stessa `segna` della coda: qui non
   *  si sa — e non si deve sapere — quali stati aprano una finestra. */
  onStato: (l: Lead, s: LeadStatus) => void;
  /** Elimina la PERSONA (non la nota): `true` se è sparita davvero. */
  onEliminaLead: (l: Lead) => Promise<boolean>;
  onSpunta: (id: string, fatta: boolean) => void;
  /** Butta la NOTA scritta a mano. Esiste da prima dell'altro e non c'entra
   *  niente: vedi la nota sulle due eliminazioni in cima al file. */
  onElimina: (id: string) => void;
}) {
  /** Sto scrivendo l'eliminazione di questa riga: il tasto si spegne e lo dice,
   *  altrimenti si preme due volte e partono due cancellazioni sullo stesso
   *  contatto. */
  const [eliminando, setEliminando] = useState(false);
  const { riga, attesa, giorniIndietro } = voce;
  const lead = riga.lead;
  const task = riga.task;
  const telefono = String(lead?.data?.telefono || "");
  const Icona = lead ? CalendarClock : StickyNote;

  const elimina = async (l: Lead) => {
    if (eliminando) return;
    setEliminando(true);
    await onEliminaLead(l);
    setEliminando(false);
    //  La domanda si chiude in tutti e due i casi: riuscita, la riga non c'è
    //  più; fallita, il messaggio della pagina l'ha già detto — e un tasto rosso
    //  lasciato acceso sotto il dito è il modo per eliminare il contatto
    //  sbagliato al tentativo dopo.
    onArma(false);
  };

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 transition-colors",
        urgente ? "bg-rose-50/70" : "hover:bg-accent/40",
        riga.fatta && "opacity-60",
      )}
    >
      {/*  La spunta esiste solo per le note scritte a mano: un richiamo non si
          «spunta», si chiude segnando un esito sulla scheda del cliente — che è
          l'unico posto in cui quel fatto resta scritto per tutti. */}
      {task ? (
        <Checkbox
          checked={riga.fatta}
          disabled={occupato}
          onCheckedChange={(v) => onSpunta(task.id, v === true)}
          aria-label={`Segna come fatta: ${riga.cosa}`}
          className="shrink-0"
        />
      ) : (
        <Icona
          className={cn("h-4 w-4 shrink-0", urgente ? "text-rose-600" : "text-muted-foreground")}
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "truncate text-[13.5px] font-medium",
              riga.fatta && "line-through decoration-muted-foreground",
            )}
          >
            {riga.cosa}
          </span>
          {/*  ── LO STATO SI CAMBIA DA QUI ──────────────────────────────────
              Era un chip di sola lettura: per dare un esito a un richiamo
              scaduto bisognava aprire la scheda grande, cioè uscire dall'elenco
              che si sta smaltendo e tornarci dopo. Adesso è la pastiglia
              premibile del resto del CRM, con la griglia di tutti gli stati.
              ⚠️ Resta accanto al titolo e NON scende fra i comandi a destra: lì
               sarebbe il quinto pulsante di una fila già lunga, e soprattutto
               qui è anche l'informazione «a che punto è questa persona», che si
               legge insieme al suo nome.
              ⚠️ Ha la larghezza massima stretta perché il testo dentro è
               `truncate`: senza, «Appuntamento rifissato» spinge fuori riga il
               conto alla rovescia, che in questa scheda è la colonna che si
               guarda per prima. */}
          {lead && (
            <PastigliaStato
              dati={lead.data}
              contesto={riga.chi || undefined}
              className="max-w-[160px] shrink-0"
              disabilitata={eliminando}
              onScegli={(s) => onStato(lead, s)}
            />
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
          {/*  ── IL CONTO ALLA ROVESCIA ─────────────────────────────────────
              Nelle fasce di oggi è «fra 12 minuti» e diventa «adesso» da solo.
              Nel passato non si conta più in minuti: «in ritardo di 4.320 min»
              è una divisione da fare a mente per sapere una cosa che «era per
              ieri» dice subito. */}
          {giorniIndietro > 0 ? (
            <span className="font-medium text-rose-600">
              {ritardoLeggibile(giorniIndietro)}
              {riga.ora ? `, alle ${riga.ora}` : ""}
            </span>
          ) : (
            <ChipAttesa attesa={attesa} grande={urgente} />
          )}
          {telefono && <span className="truncate">{telefono}</span>}
          {task?.diNome && <span className="truncate">scritta da {task.diNome}</span>}
        </div>
        {/*  ── LE NOTE DELLA SCHEDA, LETTE DA QUI ─────────────────────────
             Richiesta del committente: «le note che mette il setter dentro al
             lead devono mostrarsi anche fuori, sulla scheda Oggi».
             Quello che fa fare una buona telefonata non è l'orario, è quello
             che ha scritto il collega: «lavora fino alle 18», «chiede di
             parlare con la moglie», «ha già un preventivo da un altro».
             Prima bisognava aprire la scheda una per una, uscendo dall'elenco
             che si sta smaltendo. */}
        <NotaDelLead testo={lead?.data?.note} />
      </div>

      {/* ── I COMANDI ───────────────────────────────────────────────────────
          Cambiano con la fascia, ed è tutto il senso della divisione: dove il
          momento è arrivato si telefona, dove è passato da giorni si ridà una
          data. Un elenco che chiede sempre lo stesso gesto è un elenco che
          chiede il gesto sbagliato metà delle volte. */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {lead && armata ? (
          /*  ── LA DOMANDA, SULLA RIGA ──────────────────────────────────────
              Col nome dentro il tasto rosso: «Elimina» e basta, in un elenco di
              righe uguali, è la domanda a cui si risponde sì guardando la riga
              sbagliata. E non è una finestra — una finestra in mezzo a una
              giornata al telefono si chiude a occhi chiusi, una frase che
              compare dove si sta già guardando si legge.
              ⚠️ MENTRE LA DOMANDA È APERTA GLI ALTRI COMANDI SPARISCONO: la
               riga sta chiedendo una cosa sola e le risposte devono essere due.
               E «Lascia stare» finisce in fondo, cioè DOVE STAVA il tasto che si
               è appena premuto: un secondo clic per inerzia annulla, non
               cancella una persona. */
          <>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-[12px]"
              disabled={eliminando}
              onClick={() => void elimina(lead)}
              title="Elimina il contatto dall'archivio: non si può annullare"
            >
              <UserX className="mr-1 h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[10rem] truncate">
                {eliminando ? "Elimino…" : `Elimina ${riga.chi}`}
              </span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-[12px]"
              disabled={eliminando}
              onClick={() => onArma(false)}
              aria-label={`Non eliminare ${riga.chi}`}
              title="Lascia stare"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            {lead && giorniIndietro === 0 && <TastoChiama telefono={telefono} compatto />}
            {lead && giorniIndietro > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => onRidaiData(lead)}
                title="Concorda un nuovo giorno e una nuova ora: la promessa vecchia non si recupera, si rifà"
              >
                <CalendarClock className="mr-1 h-3.5 w-3.5" /> Ridai una data
              </Button>
            )}
            {lead && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-[12px]"
                onClick={() => onChiama(lead)}
                title="Portalo in testa alla coda: la scheda grande, con gli esiti a un tocco"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {lead && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-[12px]"
                onClick={() => onApriLead(lead)}
                title="Apri la scheda"
                aria-label={`Apri la scheda di ${riga.chi}`}
              >
                <User className="h-3.5 w-3.5" />
              </Button>
            )}
            {/*  ⚠️ `UserX` E NON UN SECONDO CESTINO: il cestino su queste righe
                vuol già dire «butta la nota», e la stessa icona per «cancella la
                persona» sarebbe un errore che non si ripara. Accanto al `User`
                che apre la scheda si legge per quello che è — la persona, tolta.
                A riposo è grigia: il rosso è della conferma, perché è quello
                l'unico clic che cancella. */}
            {lead && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-muted-foreground hover:text-rose-600"
                onClick={() => onArma(true)}
                title="Elimina il contatto dall'archivio. Chiede conferma, perché non si può annullare"
                aria-label={`Elimina il contatto ${riga.chi}`}
              >
                <UserX className="h-3.5 w-3.5" />
              </Button>
            )}
            {task && (
              <Button
                size="sm"
                variant="ghost"
                disabled={occupato}
                className="h-8 px-2 text-muted-foreground hover:text-rose-600"
                onClick={() => onElimina(task.id)}
                title="Butta via questa nota"
                aria-label={`Elimina: ${riga.cosa}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** ── LA NOTA, FUORI DALLA SCHEDA ──────────────────────────────────────────
 *  Un pezzo di nota sotto la riga: si legge di sfuggita, e al tocco si apre
 *  tutta. Non si modifica — per quello c'è la scheda, ed è anche quello che
 *  dice il cartello in cima all'elenco.
 *  ⚠️ CHIUSA DI SERIE: in un elenco di venti righe venti note aperte sono una
 *   pagina da scorrere, cioè il contrario di una lista da smaltire. */
function NotaDelLead({ testo }: { testo?: string | null }) {
  const [aperta, setAperta] = useState(false);
  const { breve, intera, tagliata } = notaInBreve(testo);
  if (!breve) return null;
  return (
    <button
      type="button"
      onClick={() => tagliata && setAperta((v) => !v)}
      className={cn(
        "mt-1 flex w-full items-start gap-1.5 rounded-lg border border-amber-200/70 bg-amber-50/60 px-2 py-1 text-left text-[11.5px] leading-snug text-amber-900/90",
        tagliata && "hover:bg-amber-100/70",
      )}
      title={tagliata ? (aperta ? "Chiudi la nota" : "Apri la nota intera") : undefined}
    >
      <StickyNote className="mt-px h-3 w-3 shrink-0 opacity-60" />
      <span className="min-w-0 flex-1">
        {aperta ? intera : breve}
        {tagliata && (
          <span className="ml-1 whitespace-nowrap font-semibold underline underline-offset-2">
            {aperta ? "meno" : "tutta"}
          </span>
        )}
      </span>
    </button>
  );
}

export function SchedaOggi({
  voci,
  occupato,
  caricando,
  onAggiungi,
  onDettagli,
  onSpunta,
  onElimina,
  onChiama,
  onRidaiData,
  onStato,
  onEliminaUno,
  onApriLead,
  mestieri,
}: {
  /** Le righe già divise in fasce: il calcolo è di crm/importa/scadenze e la
   *  pagina lo fa una volta sola, perché lo stesso conto serve anche al numero
   *  grande della testata. */
  voci: RigaScadenza[];
  occupato?: boolean;
  caricando?: boolean;
  /** Scrive una nota nuova. La pagina la salva e RILEGGE dal server: qui non si
   *  sa nemmeno che esista `app_config`. */
  onAggiungi: (campi: { testo: string; data: string; ora: string }) => void;
  /** Apre la finestra dei dettagli — a chi tocca, per quale cliente, se si
   *  prende un pezzo di agenda. ⚠️ È la STESSA finestra di «Da fare oggi»: le
   *  due pagine scrivono nella stessa lista, e due modi diversi di scrivere la
   *  stessa riga sono due formati destinati a divergere. */
  onDettagli?: () => void;
  onSpunta: (id: string, fatta: boolean) => void;
  /** ⚠️ QUESTA BUTTA LA NOTA, non la persona. Il nome è quello di sempre e non
   *   si tocca (lo passa la pagina da prima che esistesse l'altra); la
   *   differenza si legge dal tipo — un id di task — e dall'icona sulla riga. */
  onElimina: (id: string) => void;
  onChiama: (l: Lead) => void;
  onRidaiData: (l: Lead) => void;
  /** Il cambio di stato dalla pastiglia: è la `segna` della pagina, quella che
   *  apre la finestra del giorno/ora o degli importi quando lo stato scelto li
   *  chiede. Da qui si passa e basta.
   *  ⚠️ «Ridai una data» qui accanto NON è la stessa cosa detta due volte: è la
   *   scorciatoia per l'unico gesto che serve su una promessa mancata, ed è per
   *   questo che compare solo lì. La pastiglia serve a tutti gli altri esiti —
   *   non risponde, non interessato, appuntamento — che prima da questa scheda
   *   non si potevano dare affatto. */
  onStato: (l: Lead, s: LeadStatus) => void;
  /** Elimina la PERSONA dall'archivio. `true` = è sparita davvero; i messaggi
   *  li dà la pagina, qui il valore serve solo a chiudere la conferma. */
  onEliminaUno: (l: Lead) => Promise<boolean>;
  onApriLead: (l: Lead) => void;
  /** ── ⚠️ CHI FA CHE MESTIERE ───────────────────────────────────────────
   *  Segnalazione del committente: «ci sia filtro per setter e per consulenti,
   *  correggi perché ora mette tutto insieme». Qui dentro finivano insieme le
   *  scadenze di tutti, e non c'era nessun modo di separarle: il filtro
   *  esisteva soltanto in /CRM/dafare, che mostra la stessa giornata da
   *  un'altra porta.
   *  La mappa arriva dalla pagina, che è quella che ha i collaboratori.
   *  Assente = nessun filtro, e la scheda si comporta esattamente come prima. */
  mestieri?: MappaMestieri;
}) {
  //  ⚠️ Tutti gli hook stanno qui, sopra qualunque uscita anticipata (React 310
  //  in produzione è la schermata bianca, e in questo file la tentazione di
  //  intercettare `caricando` in cima è forte).
  const [testo, setTesto] = useState("");
  const [data, setData] = useState("");
  const [ora, setOra] = useState("");
  /** «Dimenticate» nasce CHIUSA: vedi l'intestazione e crm/importa/scadenze.
   *  Chiusa, non tagliata — il numero si legge sempre sul pulsante. */
  const [dimenticateAperte, setDimenticateAperte] = useState(false);
  /** L'unica riga che sta chiedendo «lo elimino davvero?». È un id solo — quello
   *  di `RigaDaFare`, cioè già prefissato «lead:» — e non un insieme: armare una
   *  riga disarma la precedente, perché un elenco con dieci tasti rossi accesi è
   *  un elenco in cui prima o poi si cancella la persona sbagliata, e qui non
   *  c'è nessun cestino da cui ripescarla. */
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  /** Il verso con cui si leggono i due mucchi del passato. Non è uno stato di
   *  questa scheda: sta nel browser e vale anche per /CRM/dafare — vedi
   *  crm/dafare/arretrati. Qui serve solo a ordinare; a disegnare il comando ci
   *  pensa `ScambiaVerso`, che legge lo stesso verso e resta quindi d'accordo
   *  con quello che si vede. */
  const [verso] = useVersoArretrati();
  /** Il filtro «di chi»: vuoto = tutti, cioè come questa scheda si è sempre
   *  comportata. Vive qui e non nella pagina perché riguarda solo questo
   *  elenco: la coda delle telefonate ha i suoi filtri, e mescolarli vorrebbe
   *  dire una linguetta che ne cambia un'altra. */
  const [chi, setChi] = useState("");
  const persone = useMemo(() => (mestieri ? personeDelFiltro(mestieri) : []), [mestieri]);
  //  ⚠️ I conteggi si fanno su TUTTE le voci, non su quelle già filtrate: il
  //   numero accanto a una scelta deve dire quante righe si otterrebbero
  //   premendola, e con il filtro già applicato direbbe sempre «tutte» o zero.
  const conteggi = useMemo(
    () =>
      contaDiChi(
        voci.map((v) => v.riga),
        mestieri ?? new Map(),
      ),
    [voci, mestieri],
  );
  const vociFiltrate = useMemo(
    () => (chi && mestieri ? voci.filter((v) => rigaPassaChi(v.riga, chi, mestieri)) : voci),
    [voci, chi, mestieri],
  );

  /** ── UNA DOMANDA ARMATA NON SOPRAVVIVE A UN ELENCO CHE SI MUOVE ─────────
   *  ⚠️ QUESTO ELENCO SI RIORDINA DA SOLO, ed è l'unico della pagina a farlo:
   *   l'orologio batte ogni quindici secondi, `calcolaScadenze` ricalcola, e la
   *   riga il cui momento è arrivato cambia fascia — cioè salta in cima,
   *   spostando tutte le altre. La conferma però è legata a un ID, non a una
   *   posizione: restava armata mentre le righe le scorrevano sotto, e nella
   *   riga armata il tasto rosso occupa il posto della cornetta e di «Ridai una
   *   data», cioè i due comandi che si premono di più. Bastava scorrere,
   *   distrarsi mezzo minuto, tornare — e il clic che credeva di ridare una
   *   data eliminava una persona, senza cestino da cui ripescarla.
   *  ⚠️ LA FIRMA GUARDA GLI ID E LE FASCE, NON GLI ORARI. Quelli cambiano a
   *   ogni battito senza spostare nulla, e una conferma disarmata un istante
   *   dopo essere stata armata è un pulsante che sembra rotto: la domanda cade
   *   quando l'elenco cambia davvero forma — una riga che entra, una che esce,
   *   una che cambia mucchio — e non a ogni ticchettio. */
  const firmaElenco = vociFiltrate.map((v) => `${v.riga.id}:${v.fascia}`).join("|");
  useEffect(() => {
    setDaEliminare(null);
  }, [firmaElenco]);

  const aggiungi = () => {
    const t = testo.trim();
    if (!t) return;
    onAggiungi({ testo: t, data, ora });
    setTesto("");
    setData("");
    setOra("");
  };

  const inRitardo = contaInRitardo(vociFiltrate);

  return (
    <Scheda
      titolo="Le tue scadenze di oggi"
      nota={
        inRitardo > 0
          ? `${inRitardo} da recuperare · i richiami concordati e le note che ti sei scritto`
          : "I richiami concordati e le note che ti sei scritto, in ordine di orologio"
      }
      icona={AlarmClock}
      senzaPadding
    >
      {/* ── SCRIVERSI UNA NOTA ────────────────────────────────────────────
          In cima e non in fondo: si scrive una nota MENTRE si è al telefono, e
          se il campo sta sotto quaranta righe si scrive su un foglio.
          La data e l'ora sono due campi facoltativi accanto al testo, non una
          finestra: chiedere di aprire qualcosa per dire «alle 15:30» è il modo
          più sicuro per far scrivere note senza scadenza — cioè note che non
          scadono mai e che quindi non si fanno mai. Senza data vale OGGI, ed è
          `nuovoTask` a deciderlo (crm/dafare/task-manuali): è la stessa regola
          della pagina «Da fare oggi», e una sola. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
        <Input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              aggiungi();
            }
          }}
          placeholder="Scriviti una cosa da fare… (es. «riprovare al fisso dopo le 18»)"
          className="h-9 min-w-[12rem] flex-1 text-[13px]"
          maxLength={500}
        />
        <Input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="h-9 w-[9.5rem] text-[13px]"
          title="Il giorno di scadenza. Vuoto = oggi"
          aria-label="Giorno di scadenza"
        />
        <Input
          type="time"
          value={ora}
          onChange={(e) => setOra(e.target.value)}
          className="h-9 w-[6.5rem] text-[13px]"
          title="L'ora di scadenza. Senza ora la nota resta «in giornata, quando capita» e non fa il conto alla rovescia"
          aria-label="Ora di scadenza"
        />
        <Button
          size="sm"
          className="h-9 text-[12px]"
          disabled={occupato || !testo.trim()}
          onClick={aggiungi}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Aggiungi
        </Button>
        {/*  ── ⚠️ I DETTAGLI DIETRO UN TASTO ─────────────────────────────
             A chi tocca, per quale cliente e se blocca l'agenda sono tre
             campi veri: messi in questa riga la trasformerebbero in un
             modulo, e una nota che costa un modulo si scrive su un foglio —
             che è esattamente quello che questa riga esiste per evitare. */}
        {!!onDettagli && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-[12px]"
            onClick={onDettagli}
            title="Assegna a qualcuno, collega un cliente, blocca l'agenda"
          >
            <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Con dettagli
          </Button>
        )}
      </div>

      {/* ── ⚠️ DI CHI SONO QUESTE SCADENZE ────────────────────────────────
          Segnalazione del committente: «correggi perché ora mette tutto
          insieme». Qui dentro cadevano insieme i richiami dei setter e le cose
          dei consulenti, e l'unico modo di separarle era aprire un'altra
          pagina. Il filtro è lo stesso di «Da fare oggi» — stesso componente,
          stesse parole, stessi mestieri — e sta SOTTO il campo delle note e
          SOPRA l'elenco: è una lente su ciò che segue, non un comando della
          riga che lo precede.
          Compare solo se la pagina ha detto chi fa che mestiere: senza quella
          mappa un filtro per mestiere non saprebbe cosa rispondere. */}
      {/*  ── IL CARTELLO SULLE NOTE ──────────────────────────────────────
           Richiesta del committente: le note della scheda si leggono anche da
           qui, «con disclaimer». Serve: quello che si legge sotto le righe lo
           ha scritto una persona dentro la scheda del cliente, in un altro
           momento — non è un dato del programma, può essere vecchio, e da qui
           non si corregge. Dirlo una volta sola in cima, e non su ogni riga,
           è l'unico modo perché venga letto davvero. */}
      {voci.some((v) => !!v.riga.lead?.data?.note) && (
        <p className="flex items-start gap-1.5 border-b border-border bg-amber-50/40 px-4 py-1.5 text-[11px] leading-snug text-amber-900/80">
          <StickyNote className="mt-px h-3 w-3 shrink-0 opacity-60" />
          <span>
            Sotto ai nomi ci sono le note scritte nella scheda del cliente, da chi l'ha lavorato:
            possono essere di giorni fa e si correggono solo aprendo la scheda.
          </span>
        </p>
      )}

      {!!mestieri && voci.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <FiltroDiChi valore={chi} persone={persone} conteggi={conteggi} onScegli={setChi} />
          {/*  Un filtro acceso che nasconde delle righe deve dirlo dove le
              righe mancano, non solo dentro il pannello che si è chiuso: è la
              causa numero uno degli elenchi «vuoti» che vuoti non sono. */}
          {!!chi && (
            <span className="text-[11.5px] text-muted-foreground">
              {vociFiltrate.length} di {voci.length} ·{" "}
              <button
                type="button"
                onClick={() => setChi("")}
                className="font-medium text-foreground underline underline-offset-2"
              >
                mostra tutte
              </button>
            </span>
          )}
        </div>
      )}

      {vociFiltrate.length === 0 ? (
        <div className="px-4 py-2">
          <Vuoto
            titolo={caricando ? "Sto leggendo le tue note…" : "Niente in scadenza"}
            testo={
              caricando
                ? "Un istante: le note scritte a mano stanno sul server, non in questo browser."
                : "Qui arrivano i richiami che concordi con il cliente («la richiamo giovedì alle 15:30») e le note che ti scrivi qui sopra. Quando il momento arriva, la riga sale in cima e si accende."
            }
            icona={ListTodo}
          />
        </div>
      ) : (
        FASCE.map((fascia) => {
          const righe = righeDi(vociFiltrate, fascia, verso);
          //  Le fasce vuote non si disegnano: con tre scadenze si legge un
          //  elenco solo invece di sei intestazioni a zero.
          if (righe.length === 0) return null;

          const chiusa = fascia === "dimenticate" && !dimenticateAperte;
          const urgente = fascia === "adesso";
          const arretrata = FASCE_ARRETRATE.includes(fascia);
          //  Il comando dell'ordine si disegna sul mucchio che governa, e solo
          //  se quel mucchio ha davvero un ordine. Su «Dimenticate» chiusa a
          //  fisarmonica non si disegna affatto: girare un elenco che non si
          //  vede è un gesto senza risposta a schermo.
          const conOrdine = arretrata && !chiusa && righe.length >= MINIMO_PER_ORDINARE;

          return (
            <section key={fascia}>
              {/*  L'intestazione della fascia dice il nome E la regola: senza
                  la seconda riga «Promesse mancate» e «Dimenticate» sembrano
                  due modi di dire la stessa cosa, e la divisione — che è tutto
                  il valore di questa scheda — non si capisce. */}
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 border-y border-border px-4 py-1.5",
                  urgente ? "border-rose-200 bg-rose-100/60" : "bg-muted/40",
                  arretrata && !urgente && "bg-amber-50/70",
                )}
              >
                <div className="min-w-0">
                  <span
                    className={cn(
                      "text-[12px] font-semibold uppercase tracking-wide",
                      urgente ? "text-rose-700" : "text-foreground",
                    )}
                  >
                    {TITOLO_FASCIA[fascia]}
                    <span className="ml-1.5 tabular-nums opacity-70">{righe.length}</span>
                  </span>
                  <span className="ml-2 text-[11.5px] text-muted-foreground">
                    {NOTA_FASCIA[fascia]}
                  </span>
                </div>
                {fascia === "dimenticate" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 text-[12px]"
                    //  Aprire o chiudere il mucchio sposta tutto quello che sta
                    //  sotto: una domanda armata a metà elenco si ritroverebbe
                    //  il tasto rosso trenta righe più in su. Cade, come cade
                    //  quando l'elenco si riordina da solo (vedi `firmaElenco`).
                    onClick={() => {
                      setDaEliminare(null);
                      setDimenticateAperte((v) => !v);
                    }}
                    aria-expanded={dimenticateAperte}
                  >
                    {dimenticateAperte ? (
                      <>
                        <ChevronDown className="mr-1 h-3.5 w-3.5" /> Nascondi
                      </>
                    ) : (
                      <>
                        <ChevronRight className="mr-1 h-3.5 w-3.5" /> Guarda le {righe.length}
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/*  ── IL VERSO DELL'ARRETRATO ──────────────────────────────
                  Subito sotto l'intestazione del mucchio e subito sopra la sua
                  prima riga: è il punto in cui l'occhio si trova già quando si
                  accorge che l'elenco è nel verso sbagliato. La stessa striscia,
                  con le stesse parole e nello stesso posto, sta in testa ai due
                  mucchi arretrati di /CRM/dafare — è lo stesso comando e la
                  stessa preferenza, non una copia (crm/dafare/arretrati).
                  ⚠️ Di partenza si comincia dai più vicini a oggi: sono quelli
                   che una telefonata recupera ancora, mentre una promessa di tre
                   settimane fa non si «recupera», si rifà da capo. Il verso
                   opposto serve alla mezz'ora di pulizia — chi è fermo da troppo
                   e va chiuso — ed è a un clic. Il perché per esteso sta nel
                   file del comando. */}
              {conOrdine && <ScambiaVerso />}

              {/*  ── PERCHÉ «DIMENTICATE» NASCE CHIUSA ────────────────────
                  È la scelta che tiene in vita questa scheda. Dopo due
                  settimane storte le scadute vecchie sono più numerose del
                  lavoro di oggi: lasciarle aperte vuol dire che per arrivare al
                  richiamo delle 15:30 si scorre oltre trenta righe di ieri
                  l'altro, e dopo due giorni la scheda non la apre più nessuno.
                  Chiuse non spariscono — il loro numero sta sul pulsante e nel
                  numero grande della testata — ma smettono di competere con la
                  giornata. Si aprono quando si decide di dedicargli mezz'ora,
                  che è l'unico modo in cui si smaltiscono davvero. */}
              {chiusa ? (
                <p className="px-4 py-2 text-[12px] text-muted-foreground">
                  Ferme da più di {SCADUTA_DA_TROPPO} giorni. Non sono sparite e non spariranno:
                  restano qui finché non gli si ridà una data o un esito, ma stanno chiuse per non
                  coprire il lavoro di oggi.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {righe.map((voce) => (
                    <Riga
                      key={voce.riga.id}
                      voce={voce}
                      urgente={urgente}
                      occupato={occupato}
                      armata={daEliminare === voce.riga.id}
                      onArma={(v) => setDaEliminare(v ? voce.riga.id : null)}
                      onChiama={onChiama}
                      onRidaiData={onRidaiData}
                      onApriLead={onApriLead}
                      onStato={onStato}
                      //  Dentro la riga si chiama `onEliminaLead` e non
                      //  `onEliminaUno`: lì accanto c'è `onElimina`, che butta la
                      //  nota, e due nomi che si somigliano su due gesti che non
                      //  si somigliano affatto sono un guasto che aspetta.
                      onEliminaLead={onEliminaUno}
                      onSpunta={onSpunta}
                      onElimina={onElimina}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </Scheda>
  );
}
