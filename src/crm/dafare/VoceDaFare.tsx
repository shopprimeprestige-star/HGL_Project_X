/** ── UNA RIGA DELLA GIORNATA ───────────────────────────────────────────────
 *
 *  Dice due cose e basta: CHE COSA fare e A CHI. «Ricontattare Mario Rossi».
 *  Tutto il resto — note, preventivo, telefono — sta nel riquadro che si apre
 *  senza cambiare pagina, perché aprire la scheda intera per rileggere due
 *  righe di appunti costa dieci secondi e fa perdere il segno nella lista.
 *
 *  ── IL RIQUADRO SI APRE IN DUE MODI, E NON È UN LUSSO ─────────────────────
 *  ⚠️ SUL TELEFONO IL PASSAGGIO DEL MOUSE NON ESISTE. Una funzione appesa solo
 *   all'hover, su metà delle postazioni di questo CRM (il consulente lavora dal
 *   telefono), semplicemente non c'è — e non lo dice nessuno: la riga sembra
 *   soltanto una riga che non fa niente. Quindi:
 *    · CON IL MOUSE si passa sopra la riga e il riquadro si apre da solo: zero
 *      clic, che è tutto il punto di averlo;
 *    · CON IL DITO c'è un pulsante «i» SEMPRE VISIBILE (non compare all'hover,
 *      che sarebbe lo stesso errore un livello più in basso): un tocco apre lo
 *      stesso identico riquadro.
 *   Il contenuto è scritto UNA volta sola e serve tutti e due i gesti: due
 *   copie dello stesso pannello divergono entro un mese.
 *   L'apertura al passaggio del mouse è filtrata su `pointerType === "mouse"`
 *   perché i browser su schermo tattile emettono comunque un evento di
 *   ingresso al tocco: senza il filtro il riquadro si apriva e il clic
 *   successivo lo richiudeva subito, cioè il pulsante «i» sembrava rotto.
 *
 *  ── LA RIGA SCRITTA A MANO HA TRE COMANDI, E NESSUNO È NASCOSTO ───────────
 *  La casella (fatto / non fatto), il calendario (spostala a un altro giorno o
 *  cambiale l'ora) e il cestino. Il calendario è la novità e non è un lusso:
 *  senza, una cosa scritta per ieri e non fatta aveva due sole uscite —
 *  restare in cima per sempre o essere cancellata — e fra le due si sceglie
 *  sempre la seconda, cioè si perde il lavoro invece di riprogrammarlo.
 *  Sono tutti e tre bersagli da 28 px sempre visibili: qui si lavora anche dal
 *  telefono, e un comando che si scopre passandoci sopra col mouse là non
 *  esiste.
 *
 *  ── PERCHÉ NON `HoverCard` ────────────────────────────────────────────────
 *  Il componente `hover-card` c'è, ma per costruzione risponde solo al mouse:
 *  usarlo avrebbe voluto dire montarne DUE (uno per il mouse, un Popover per il
 *  dito) con lo stesso contenuto dentro. Qui il Popover è uno solo e i due
 *  gesti aprono lui.
 *  ───────────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type PointerEvent,
} from "react";
import {
  BellRing,
  CalendarClock,
  CalendarPlus,
  Clock,
  Info,
  MessageCircle,
  Phone,
  PhoneOff,
  Repeat,
  StickyNote,
  Trash2,
  User,
  UserCheck,
  Wrench,
} from "lucide-react";
import { Popover, PopoverAnchor, PopoverTrigger } from "@/components/ui/popover";
//  Il cartellino della priorità: lo stesso dell'elenco delle installazioni.
import { SegnoPriorita } from "@/crm/PrioritaPosa";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pannello, Pillola } from "@/crm/ui/Finestra";
import {
  CLASSE_BADGE_STATO,
  ChipAttesa,
  classiStato,
  dataBreve,
  etichettaStato,
  eur,
  giorniDaOggi,
  oggiIso,
  soloData,
} from "@/crm/ui";
import { TastoMessaggio } from "@/crm/TastoMessaggio";
import { ascoltaScritti, eScritto, segnaScritto } from "@/crm/scritti";
import {
  buildMeetReminderMessage,
  buildWhatsAppLink,
  getWhatsAppMessageForStatus,
  etichettaPromemoria,
  promemoriaUtile,
} from "@/crm/whatsapp";
import { cn } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/crm/types";
import { attesaRiga, schedaRapida, type RigaDaFare, type TipoRiga } from "./righe";
import { fraGiorni, oraPulita, quandoDellaRiga, quandoInChiaro } from "./quando";
import { AzioniLead } from "./AzioniLead";

/** L'icona dice il TIPO di gesto in un colpo d'occhio, il verbo lo dice per
 *  esteso: chi conosce la pagina legge l'icona, chi ci arriva oggi legge la
 *  frase. Non sono un doppione, sono due velocità di lettura. */
const ICONA_RIGA: Record<TipoRiga, ComponentType<{ className?: string }>> = {
  ricontatto: Phone,
  meet_da_fissare: CalendarPlus,
  meet_da_rifissare: CalendarClock,
  chat: MessageCircle,
  //  Il telefono sbarrato è la stessa icona con cui la pagina Oggi segna
  //  «non ha risposto»: qui vuol dire la stessa cosa, e va disegnata uguale.
  richiamo_setter: PhoneOff,
  //  La stessa chiave inglese con cui le pose si riconoscono in tutto il CRM:
  //  la voce «Installazioni» del menu e la pagina delle pose usano quella.
  //  ⚠️ Una chiave che manca qui NON è un'icona assente: è `undefined` passato
  //   a React come componente, cioè lo schermo bianco (errore #130). Chi
  //   aggiunge un tipo di riga aggiunge la sua icona nello stesso momento — il
  //   controllo dei tipi lo pretende, ma `vite build` non lo esegue.
  installazione: Wrench,
  task: StickyNote,
};

/** Quanto si aspetta prima di richiudere il riquadro quando il mouse esce.
 *  Senza questa pausa, spostarsi dalla riga verso il riquadro — che è
 *  disegnato FUORI dalla riga — lo farebbe sparire a metà strada. */
const PAUSA_CHIUSURA_MS = 220;

/* ── SPOSTARE UNA COSA DA FARE ───────────────────────────────────────────── */

/** Le distanze che si scelgono sempre. Sono le stesse — e nello stesso ordine —
 *  delle scorciatoie con cui si sposta un richiamo nella procedura del «quando»
 *  (crm/QuickStatusDialog.tsx): chi ha imparato «Domani / Fra 3 giorni» su un
 *  lead lo ritrova identico su una nota scritta a mano. Manca «fra due
 *  settimane», che là serve a diluire un cliente insistente e qui vorrebbe dire
 *  soltanto che quella cosa non si farà: per quello c'è il cestino, ed è più
 *  onesto. */
const SCORCIATOIE_SPOSTA: { g: number; l: string }[] = [
  { g: 0, l: "Oggi" },
  { g: 1, l: "Domani" },
  { g: 3, l: "Fra 3 giorni" },
  { g: 7, l: "Fra una settimana" },
];

/** ── IL PULSANTE CHE SVUOTA IL MUCCHIO ─────────────────────────────────────
 *  Una lista che accumula gli scaduti diventa illeggibile, una che li nasconde
 *  mente: la terza strada è che uscire dal mucchio costi UN clic. Questo
 *  riquadro è quella strada — «Oggi» e «Domani» sono un tocco solo, la data
 *  esatta e l'ora restano lì sotto per il caso preciso.
 *
 *  Che cambi anche l'ORA di una riga già scritta non è un extra: prima l'ora si
 *  poteva mettere soltanto alla nascita, e per correggere un «alle 15» diventato
 *  «alle 17» bisognava cancellare la riga e riscriverla — cioè perdere chi
 *  l'aveva scritta, da quanto era lì e quante volte era già slittata.
 *
 *  ⚠️ Gli hook stanno in questo componente e non dentro VoceDaFare: là sopra
 *   c'è un `return` anticipato per le righe senza lead, e un hook aggiunto
 *   sotto quel return è l'errore React 310 — schermata bianca in produzione. */
function SpostaTask({
  riga,
  occupato,
  onSposta,
}: {
  riga: RigaDaFare;
  occupato?: boolean;
  onSposta: (id: string, data: string, ora: string) => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [data, setData] = useState(riga.giorno);
  const [ora, setOra] = useState(riga.ora);

  //  Riaprendo il riquadro si riparte da quello che la riga dice ADESSO: se
  //  nel frattempo l'ha spostata un collega, i campi devono raccontare la sua
  //  versione e non quella rimasta in memoria da mezz'ora.
  useEffect(() => {
    if (!aperto) {
      setData(riga.giorno);
      setOra(riga.ora);
    }
  }, [aperto, riga.giorno, riga.ora]);

  const id = riga.task?.id;
  if (!id) return null;

  const manda = (nuovaData: string, nuovaOra: string) => {
    setAperto(false);
    onSposta(id, nuovaData, oraPulita(nuovaOra));
  };

  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={occupato}
          //  Si vede sempre, come la «i»: un comando che compare solo al
          //  passaggio del mouse sul telefono non esiste.
          aria-label="Sposta questa cosa da fare a un altro giorno o a un'altra ora"
          title="Spostala a un altro giorno o cambia l'ora"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <CalendarClock className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <Pannello
        side="bottom"
        align="end"
        className="w-[19rem] max-w-[calc(100vw-2rem)]"
        titolo="Quando ricordarla"
        contesto={quandoInChiaro(riga.giorno, riga.ora) || "senza giorno"}
        classeCorpo="flex flex-col gap-2.5"
      >
        <div className="flex flex-wrap gap-1.5">
          {SCORCIATOIE_SPOSTA.map((s) => {
            const giorno = fraGiorni(s.g);
            return (
              <Pillola
                key={s.g}
                attiva={riga.giorno === giorno}
                //  Un tocco solo: la scorciatoia salva subito e tiene l'ora che
                //  c'era. Chiedere una conferma dopo aver premuto «Domani»
                //  raddoppierebbe il costo del gesto più frequente della pagina.
                onClick={() => manda(giorno, ora)}
              >
                {s.l}
              </Pillola>
            );
          })}
        </div>

        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-slate-500">
            Un altro giorno
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-9 text-[13px] tabular-nums"
            />
          </label>
          <label className="flex w-[6.5rem] shrink-0 flex-col gap-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Ora
            </span>
            <Input
              type="time"
              value={ora}
              onChange={(e) => setOra(e.target.value)}
              className="h-9 text-[13px] tabular-nums"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/*  Togliere l'ora è un gesto vero: l'appuntamento con se stessi
              salta, la cosa resta da fare in giornata. Senza questo pulsante
              l'unico modo sarebbe svuotare il campo a mano, che su un input
              «time» sul telefono è quasi impossibile. */}
          {riga.ora ? (
            <button
              type="button"
              onClick={() => manda(data || riga.giorno, "")}
              className="text-[11.5px] text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              Togli l&apos;ora
            </button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            disabled={occupato || !data}
            onClick={() => manda(data, ora)}
          >
            Sposta
          </Button>
        </div>

        {/*  La conferma per esteso, con il giorno della settimana: «2026-09-08»
            e «2026-08-09» si somigliano abbastanza da passare inosservati, ed è
            la stessa riga di controllo che sta sotto la data del richiamo. */}
        <p className="text-[11.5px] text-slate-600">
          {data
            ? `Finirà fra le cose di ${quandoInChiaro(data, ora) || data}.`
            : "Senza un giorno non finisce in nessuna giornata: scegline uno."}
        </p>
      </Pannello>
    </Popover>
  );
}

/* ── I PEZZI DEL RIQUADRO ────────────────────────────────────────────────── */

/** Un blocco di note. NON tronca e NON va a capo da solo: gli appunti presi al
 *  telefono sono l'unica cosa che si legge davvero prima di richiamare, e
 *  tagliarli a una riga li rende inutili. Sopra una certa altezza si scorre. */
function BloccoNote({ etichetta, testo }: { etichetta: string; testo: string }) {
  if (!testo) return null;
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {etichetta}
      </div>
      <p className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words text-[12.5px] leading-snug text-slate-800">
        {testo}
      </p>
    </div>
  );
}

/* ── LA RIGA ─────────────────────────────────────────────────────────────── */

export interface ProprietaVoce {
  riga: RigaDaFare;
  /** L'ora "adesso" arriva dall'alto e non da `Date.now()` letto qui dentro:
   *  quaranta righe che leggono l'orologio ognuna per conto suo darebbero
   *  quaranta conti alla rovescia leggermente diversi. */
  adesso: number;
  /** Apre la scheda completa della trattativa (sopra la pagina, senza uscire). */
  onApriLead: (leadId: string) => void;
  /** ── IL NOME DI CHI SEGUE, E QUELLO DELLA CONSULENZA GIÀ FATTA ─────────
   *  Richiesta del committente: su questa lista si TELEFONA, e prima di
   *  telefonare le due cose che cambiano la chiamata sono «chi lo segue» e
   *  «quanto è passato dalla consulenza». Senza, si richiama un cliente
   *  visto ieri con lo stesso tono di uno visto due mesi fa.
   *  Arriva dall'alto e non si cerca qui dentro: la mappa dei consulenti la
   *  ha già la pagina, e rifarla per ogni riga sarebbe lavoro per niente. */
  nomeConsulente?: (id?: string | null) => string;
  /** Spunta / toglie la spunta a una riga scritta a mano. */
  onSpunta: (id: string, fatta: boolean) => void;
  /** Butta via una riga scritta a mano. */
  onElimina: (id: string) => void;
  /** Sposta a un altro giorno e/o a un'altra ora una riga scritta a mano.
   *  `ora` vuota vuol dire «toglila»: la cosa resta, l'appuntamento no. */
  onSposta: (id: string, data: string, ora: string) => void;
  /** true = c'è un salvataggio in corso: i comandi si spengono, altrimenti si
   *  spunta due volte e la seconda scrittura parte da una lista già vecchia. */
  occupato?: boolean;
  /** ── I TRE GESTI SULLE RIGHE CHE NASCONO DA UN LEAD ────────────────────
   *  Esito, giorno del richiamo e note: li raccoglie `AzioniLead`, li scrive
   *  la pagina. Facoltativi perché questa riga la monta anche chi non ha
   *  nessuna scrittura da offrire — e in quel caso il pulsante non compare,
   *  invece di comparire e non fare niente. */
  onStatoLead?: (lead: Lead, stato: LeadStatus) => void;
  onQuandoLead?: (lead: Lead, data: string) => void;
  onNotaLead?: (lead: Lead, testo: string) => void;
  /** ── LA SELEZIONE A GRUPPI ─────────────────────────────────────────────
   *  Richiesta del committente: prendere venti righe e cambiare loro lo stato
   *  in un gesto solo, con il clic o con Maiusc+clic — lo stesso gesto dei lead
   *  importati, che è anche lo stesso codice (crm/importa/selezione).
   *  ⚠️ `onScegli` ASSENTE = NIENTE QUADRATINO, ed è voluto: la selezione ha
   *   senso solo dove dietro c'è una scheda su cui scrivere. Sulle righe scritte
   *   a mano non c'è nessuno stato da cambiare, e un quadratino che si spunta
   *   senza poter fare niente è un comando che tradisce.
   *  ⚠️ E IL QUADRATINO PRENDE IL POSTO DELL'ICONA DEL TIPO, non le si aggiunge
   *   accanto: la riga ha già quattro comandi in coda, e un quinto elemento in
   *   testa la manderebbe a capo sul telefono — dove questa pagina si legge. Il
   *   tipo della riga resta leggibile dal verbo («Ricontattare…»), che è la
   *   prima parola. */
  scelta?: boolean;
  onScegli?: (blocco: boolean) => void;
}

/** ── ⚠️ MENTRE LA PAGINA SCORRE, I RIQUADRI NON SI APRONO ──────────────────
 *  DIFETTO VISTO CON GLI OCCHI: scorrendo la lista con il mouse sopra le
 *  righe, ogni riga che passava sotto al puntatore apriva il suo riquadro —
 *  senza che nessuno l'avesse chiesto — e la schermata si riempiva di pannelli
 *  che coprivano proprio quello che si stava cercando di leggere scorrendo.
 *  Il puntatore, durante uno scorrimento, non sta SCEGLIENDO niente: sta fermo
 *  mentre il contenuto gli passa sotto. Per un terzo di secondo dopo l'ultimo
 *  movimento della pagina i riquadri restano chiusi; si riaprono al primo
 *  vero spostamento del mouse.
 *  ⚠️ Il tempo sta FUORI dal componente perché è uno solo per tutta la lista:
 *   quaranta righe con quaranta memorie separate saprebbero ognuna solo di sé,
 *   e quella appena arrivata sotto al puntatore non saprebbe che la pagina si
 *   sta muovendo.
 */
let ultimoScorrimento = 0;
const QUIETE_MS = 350;

if (typeof window !== "undefined") {
  window.addEventListener(
    "scroll",
    () => {
      ultimoScorrimento = Date.now();
    },
    { capture: true, passive: true },
  );
}

export function VoceDaFare({
  riga,
  nomeConsulente,
  adesso,
  onApriLead,
  onSpunta,
  onElimina,
  onSposta,
  occupato,
  onStatoLead,
  onQuandoLead,
  onNotaLead,
  scelta,
  onScegli,
}: ProprietaVoce) {
  //  ⚠️ TUTTI GLI HOOK STANNO QUI, SOPRA QUALUNQUE USCITA ANTICIPATA. Un
  //  `return` prima di un hook è l'errore React 310, che in sviluppo non si
  //  vede e in produzione è una schermata bianca.
  const [aperto, setAperto] = useState(false);
  const timerRef = useRef<number | null>(null);
  //  Ricorda COME è stato aperto: al passaggio del mouse il riquadro non deve
  //  rubare il fuoco della tastiera (si sta solo guardando), al tocco sì.
  const perHoverRef = useRef(false);
  //  Il tasto Maiusc dell'ultimo clic: sta in un `ref` perché non disegna
  //  niente, e leggerlo da uno stato ridisegnerebbe quaranta righe a ogni clic.
  const maiusc = useRef(false);

  const annullaChiusura = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const entra = useCallback(
    (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      //  ⚠️ Vedi `ultimoScorrimento`: durante uno scorrimento il puntatore non
      //   sta scegliendo niente, sta fermo mentre il contenuto gli passa sotto.
      if (Date.now() - ultimoScorrimento < QUIETE_MS) return;
      annullaChiusura();
      perHoverRef.current = true;
      setAperto(true);
    },
    [annullaChiusura],
  );

  const esce = useCallback(
    (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      annullaChiusura();
      timerRef.current = window.setTimeout(() => setAperto(false), PAUSA_CHIUSURA_MS);
    },
    [annullaChiusura],
  );

  //  Il timer va spento quando la riga sparisce dall'elenco (una spunta, un
  //  filtro, un cambio pagina): un setState su un componente smontato è un
  //  avviso in console e, con quaranta righe, quaranta.
  useEffect(() => annullaChiusura, [annullaChiusura]);

  /** ── ⚠️ SI CHIUDE APPENA LA PAGINA SI MUOVE ────────────────────────────
   *  DIFETTO VISTO CON GLI OCCHI, segnalato dal committente: aperto il
   *  riquadro su una riga, scorrendo la lista quel riquadro restava lì —
   *  ancorato a una riga ormai lontana — e copriva tutto quello che veniva
   *  sotto. Da fuori si legge come «la pagina non va oltre quel lead»: il
   *  contenuto scorre, ma resta nascosto dietro un pannello che non se ne va.
   *  Un riquadro ancorato a una riga che si è spostata indica comunque la riga
   *  sbagliata, quindi chiuderlo è giusto due volte.
   *  ⚠️ Lo scorrimento DENTRO al riquadro non lo chiude: le note lunghe si
   *   leggono scorrendole, e chiudersi mentre le si legge sarebbe il difetto
   *   opposto.
   *  È la stessa regola — stesse parole — del riquadro delle note in
   *  routes/CRM.trattative: due riquadri che si comportano in modo diverso
   *  costringono a scoprire due volte come si chiudono.
   */
  useEffect(() => {
    if (!aperto) return;
    const suScorrimento = (e: Event) => {
      const dove = e.target;
      if (dove instanceof Element && dove.closest("[data-radix-popper-content-wrapper]")) return;
      annullaChiusura();
      setAperto(false);
    };
    window.addEventListener("scroll", suScorrimento, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", suScorrimento, { capture: true });
  }, [aperto, annullaChiusura]);

  //  Il giorno si ricava dall'orologio che arriva dall'alto e non da un
  //  `oggiIso()` letto qui: quaranta righe con quaranta idee di «oggi» sono
  //  quaranta pastiglie che possono contraddirsi a cavallo della mezzanotte.
  const oggi = oggiIso(new Date(adesso));
  const attesa = attesaRiga(riga, adesso, oggi);

  /** ── ⚠️ DUE TASTI, E OGNUNO MANDA UNA COSA SOLA ────────────────────────
   *  Il primo è il messaggio dello STATO, che per ogni stato è già quello
   *  giusto per oggi: su «Ricontatto fissato» dice «come promesso ci
   *  risentiamo», su «Richiamo concordato» che ci abbiamo provato, su «In
   *  valutazione» chiede a che punto è il pensiero.
   *  Il secondo è il promemoria dell'appuntamento, con il link.
   *  ⚠️ Il secondo c'è solo dove c'è una data di appuntamento — un promemoria
   *   senza appuntamento manda una frase con la data vuota — e solo se dice
   *   una cosa DIVERSA dal primo: su una riga di appuntamento il messaggio
   *   dello stato è già la conferma con giorno e link, e due tasti gemelli non
   *   sono una scelta, sono un dubbio.
   */
  /** ── ⚠️ GIÀ SCRITTO, OGGI ───────────────────────────────────────────────
   *  A metà mattina la domanda non è più «a chi devo scrivere» ma «a questo
   *  gli ho già scritto?»: senza una risposta si riapre WhatsApp per
   *  controllare, quaranta volte, o si scrive due volte alla stessa persona.
   *  Il segno cade da solo se cambia lo stato (è successo qualcosa, e quel
   *  messaggio appartiene a una conversazione finita) o se cambia il giorno.
   *  Vedi crm/scritti. */
  const idLead = riga.lead?.id ?? "";
  const statoLead = String(riga.lead?.data?.stato ?? "");
  const scritto = useSyncExternalStore(
    ascoltaScritti,
    useCallback(() => eScritto(idLead, statoLead, oggi), [idLead, statoLead, oggi]),
    useCallback(() => false, []),
  );

  const consulenteDelLead = riga.lead ? nomeConsulente?.(riga.lead.data.consulenteId) : undefined;
  /** ⚠️ I modelli sono personalizzabili e vivono fuori da qui: uno scritto
   *  male non deve far cadere una riga dell'elenco — e cadendo in fase di
   *  disegno porterebbe giù la pagina intera, non solo il suo pulsante. */
  const scriviMessaggio = (fai: () => string): string => {
    try {
      return fai();
    } catch {
      return "";
    }
  };
  const messaggioStato = riga.lead
    ? scriviMessaggio(() => getWhatsAppMessageForStatus(riga.lead as Lead, consulenteDelLead))
    : "";
  //  ⚠️ Non basta che una data ci sia: vedi `promemoriaUtile`. Su una scheda
  //   che ha già passato la consulenza, quella data è l'incontro di stamattina.
  const messaggioPromemoria = promemoriaUtile(riga.lead?.data, oggi)
    ? scriviMessaggio(() => buildMeetReminderMessage(riga.lead as Lead, consulenteDelLead))
    : "";

  const Icona = ICONA_RIGA[riga.tipo];
  //  «È adesso» è l'unico stato che deve saltare all'occhio da lontano: bordo
  //  acceso e pallino che pulsa. Il colore è quello di `ChipAttesa` tono "ora",
  //  non un rosso nuovo: chi ha imparato quel blu nell'agenda lo ritrova qui.
  const eAdesso = attesa?.tono === "ora";

  const corpo = (
    <div
      onPointerEnter={riga.lead ? entra : undefined}
      //  Il primo movimento VERO del mouse dopo lo scorrimento riapre: senza,
      //  per riavere il riquadro bisognerebbe uscire dalla riga e rientrarci.
      onPointerMove={riga.lead ? entra : undefined}
      onPointerLeave={riga.lead ? esce : undefined}
      //  ⚠️ IL MAIUSC SI LEGGE QUI, IN CATTURA SULL'INTERA RIGA, e non dentro
      //   il quadratino: Radix chiama `onCheckedChange` senza passare l'evento,
      //   quindi da lì il tasto premuto non si vedrebbe affatto. È la stessa
      //   tecnica — e per la stessa ragione — di `RigaSelezionabile` nei lead
      //   importati.
      onClickCapture={(e) => {
        maiusc.current = e.shiftKey;
      }}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
        riga.fatta
          ? "border-border bg-muted/40 opacity-60"
          : scelta
            ? //  La riga scelta si tinge, e il colore è quello della selezione
              //  del CRM, non un secondo verde: qui l'azzurro acceso vuol già
              //  dire «è adesso».
              //  ⚠️ E porta il bordo sinistro pieno, come le liste rifatte
              //   (crm/importa/selezione): qui le righe sono riquadri staccati
              //   e non una lista continua, quindi il segno si fa col bordo
              //   invece che con una barretta sovrapposta — ma è lo stesso
              //   segno, nello stesso posto, e vuol dire la stessa cosa.
              "border-primary/40 border-l-[3px] border-l-primary bg-primary/[0.07]"
            : scritto
              ? //  ⚠️ Azzurro chiaro e SENZA anello: «è adesso» ha il bordo
                //   acceso e l'anello perché chiama; questa riga invece è
                //   sistemata, e deve calmarsi — non gridare un secondo
                //   allarme accanto a quello vero. Vince su «è adesso» proprio
                //   per questo: scritto il messaggio, l'urgenza è passata.
                "border-sky-200 bg-sky-50/80"
              : eAdesso
                ? "border-sky-500 bg-sky-50/70 ring-1 ring-sky-500/40"
                : "border-border bg-card hover:bg-accent/50",
      )}
    >
      {onScegli ? (
        //  Il riquadro attorno porta il bersaglio da sedici a trentadue pixel
        //  senza ingrandire il segno: su un telefono sedici pixel sono un tocco
        //  che sbaglia una volta su tre.
        <span className="-my-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-foreground/[0.06]">
          <Checkbox
            checked={!!scelta}
            onCheckedChange={() => onScegli(maiusc.current)}
            aria-label={`Seleziona ${riga.chi}`}
            className="shrink-0"
          />
        </span>
      ) : riga.task ? (
        <Checkbox
          checked={riga.fatta}
          disabled={occupato}
          onCheckedChange={(v) => onSpunta(riga.task!.id, v === true)}
          aria-label={riga.fatta ? "Segna come da fare" : "Segna come fatta"}
          className="shrink-0"
        />
      ) : (
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background">
          <Icona className="h-3.5 w-3.5 text-muted-foreground" />
          {eAdesso && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-sky-500" />
          )}
        </span>
      )}

      {/*  Il corpo della riga è un pulsante quando dietro c'è una scheda da
          aprire: il gesto più frequente («fammi vedere questa persona») non
          deve costare la caccia a un'icona piccola. */}
      {riga.lead ? (
        <button
          type="button"
          onClick={() => onApriLead(riga.lead!.id)}
          className="min-w-0 flex-1 text-left"
        >
          <RigaTesto riga={riga} oggi={oggi} nomeConsulente={nomeConsulente} />
        </button>
      ) : (
        <div className="min-w-0 flex-1">
          <RigaTesto riga={riga} oggi={oggi} nomeConsulente={nomeConsulente} />
        </div>
      )}

      <ChipAttesa attesa={attesa} grande={eAdesso} className="shrink-0" />

      {riga.lead && (
        <PopoverTrigger asChild>
          <button
            type="button"
            //  Il pulsante esiste PER IL TOCCO, ma si vede sempre: un comando
            //  che compare solo al passaggio del mouse è un comando che sul
            //  telefono non esiste e che sul computer si scopre per caso.
            onPointerDown={() => {
              perHoverRef.current = false;
              annullaChiusura();
            }}
            aria-label={`Cosa sapere prima di chiamare ${riga.chi}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
      )}

      {/* ── CHIAMARE E SCRIVERE, DA QUI ──────────────────────────────────
          Richiesta del committente. Questa è la lista da cui si telefona: il
          numero c'era già scritto, ma per usarlo bisognava selezionarlo a mano
          o aprire la scheda e perdere il punto della lista.
          ⚠️ IL MESSAGGIO NON È UNO SOLO: lo compone `getWhatsAppMessageForStatus`
           in base allo STATO del lead — la stessa funzione dell'elenco
           trattative e della pagina Oggi. Un secondo testo scritto qui
           divergerebbe al primo ritocco, e a riceverli è il cliente.
          ⚠️ E porta il nome di chi segue: nel modello c'è il segnaposto del
           consulente, e senza passarglielo il cliente riceve un messaggio che
           si presenta a nome di nessuno. */}
      {riga.lead?.data?.telefono && (
        <>
          <a
            href={`tel:${riga.lead.data.telefono}`}
            onClick={(e) => e.stopPropagation()}
            title={`Chiama ${riga.chi}`}
            aria-label={`Chiama ${riga.chi}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
          {/* ── I DUE MESSAGGI ────────────────────────────────────────────
                Il testo dello stato e, quando c'è un appuntamento, il
                promemoria col link. Vedi la nota sopra: ognuno manda una cosa
                sola, e il secondo sparisce quando direbbe quello che dice già
                il primo.
                ⚠️ SONO LINK, NON PULSANTI CON `window.open`: aperta così la
                 finestra la blocca il browser — su telefono quasi sempre — e
                 il tasto sembrava rotto, mentre lo stesso gesto nella scheda
                 del lead (che è un link) funzionava. Il telefono qui accanto è
                 un link da sempre, ed è la ragione per cui quello non ha mai
                 dato problemi. */}
          {!!messaggioStato && (
            //  ⚠️ Passa da una domanda sola — «allego anche i nostri lavori?» —
            //   perché le fotografie al primo messaggio cambiano tutto e a chi
            //   ha appena fatto la consulenza non dicono niente. Vedi
            //   crm/TastoMessaggio.
            <TastoMessaggio
              telefono={riga.lead.data.telefono}
              messaggio={messaggioStato}
              nome={riga.lead.data.nome || riga.chi}
              quandoConsulenza={riga.lead.data.dataMeeting}
              stato={riga.lead.data.stato}
              onInviato={() => segnaScritto(idLead, statoLead, oggi)}
              titolo={`Scrivi a ${riga.chi} il messaggio giusto per il suo stato`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
            />
          )}
          {!!messaggioPromemoria && messaggioPromemoria !== messaggioStato && (
            <a
              href={buildWhatsAppLink(riga.lead.data.telefono, messaggioPromemoria)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`Manda a ${riga.chi} ${etichettaPromemoria(riga.lead?.data, oggi)}`}
              aria-label={`Promemoria per ${riga.chi}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
            >
              <BellRing className="h-3.5 w-3.5" />
            </a>
          )}
        </>
      )}

      {/*  Spostare si può finché c'è qualcosa da fare. Su una riga già spuntata
          il pulsante non c'è: rimandare una cosa fatta non vuol dire niente, e
          un comando che non vuol dire niente si preme lo stesso e poi confonde.
          Per rimetterla da fare c'è la casella, che è il gesto opposto e sta a
          due centimetri. */}
      {/*  Sulle righe che vengono da una scheda: esito, giorno del richiamo e
          note, senza aprire la scheda intera e perdere il punto della lista. */}
      {riga.lead && onStatoLead && onQuandoLead && onNotaLead && (
        <AzioniLead
          riga={riga}
          occupato={occupato}
          onStato={onStatoLead}
          onQuando={onQuandoLead}
          onNota={onNotaLead}
        />
      )}

      {riga.task && !riga.fatta && (
        <SpostaTask riga={riga} occupato={occupato} onSposta={onSposta} />
      )}

      {riga.task && (
        <button
          type="button"
          disabled={occupato}
          onClick={() => onElimina(riga.task!.id)}
          aria-label="Elimina questa cosa da fare"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  //  Una riga scritta a mano non ha note, né preventivo, né un telefono da
  //  comporre: non c'è NIENTE da mostrare in un riquadro, e un riquadro vuoto
  //  è peggio di nessun riquadro — insegna che aprirlo non serve, e poi non lo
  //  si apre più nemmeno dove servirebbe.
  if (!riga.lead) return <li>{corpo}</li>;

  const scheda = schedaRapida(riga.lead);
  const telefono = riga.lead.data.telefono || "";
  const vuoto =
    !scheda.notePre && !scheda.notePost && !scheda.notePreventivo && !scheda.importoPreventivo;

  return (
    <li>
      <Popover
        open={aperto}
        onOpenChange={(v) => {
          annullaChiusura();
          setAperto(v);
        }}
      >
        <PopoverAnchor asChild>{corpo}</PopoverAnchor>
        <Pannello
          side="bottom"
          align="start"
          className="w-[22rem] max-w-[calc(100vw-2rem)]"
          titolo={riga.chi}
          contesto={etichettaStato(riga.lead.data.stato)}
          //  Aperto con il mouse si sta solo guardando: rubare il fuoco della
          //  tastiera farebbe saltare il cursore fuori dalla lista a ogni riga
          //  sfiorata. Aperto con un tocco (o da tastiera) il fuoco ci va, che
          //  è l'unico modo di leggerlo con uno screen reader.
          onOpenAutoFocus={(e) => {
            if (perHoverRef.current) e.preventDefault();
          }}
          onPointerEnter={annullaChiusura}
          onPointerLeave={esce}
          classeCorpo="flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Preventivo
              </div>
              <div className="text-[17px] font-semibold leading-tight tabular-nums text-slate-900">
                {scheda.importoPreventivo > 0 ? eur(scheda.importoPreventivo) : "—"}
              </div>
              {/*  L'acconto sta accanto e con il suo nome. ⚠️ Non si somma e non
                  sostituisce: «preventivo» è quanto gli abbiamo CHIESTO,
                  l'acconto è quanto è già entrato. Dirli con la stessa parola
                  fa promettere al telefono cifre mai pronunciate. */}
              {scheda.acconto > 0 && (
                <div className="text-[11px] text-slate-500">
                  di cui già incassati {eur(scheda.acconto)}
                </div>
              )}
            </div>
            {telefono && (
              <a
                href={`tel:${telefono}`}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-medium text-slate-700"
              >
                <Phone className="h-3.5 w-3.5" />
                {telefono}
              </a>
            )}
          </div>

          <BloccoNote etichetta="Note prima della consulenza" testo={scheda.notePre} />
          <BloccoNote etichetta="Note dopo la consulenza" testo={scheda.notePost} />
          <BloccoNote etichetta="Note del preventivo" testo={scheda.notePreventivo} />

          {vuoto && (
            <p className="text-[12px] text-slate-500">
              Su questa scheda non c'è ancora niente di scritto: note, preventivo e importo si
              aggiungono aprendo la scheda.
            </p>
          )}
        </Pannello>
      </Popover>
    </li>
  );
}

/** Le due righe di testo: cosa fare, e sotto il contorno che serve a decidere
 *  in quale ordine farlo. Estratta perché compare identica nei due rami (con e
 *  senza scheda dietro) e una copia sarebbe divergita al primo ritocco. */
function RigaTesto({
  riga,
  oggi,
  nomeConsulente,
}: {
  riga: RigaDaFare;
  oggi: string;
  nomeConsulente?: (id?: string | null) => string;
}) {
  const d = riga.lead?.data;
  /*  ── LA CONSULENZA, SE È GIÀ STATA FATTA ────────────────────────────────
      ⚠️ `giorniDaOggi` e non un conto scritto qui: il CRM conta i giorni in un
      posto solo, e un secondo modo darebbe una riga che dice «47 giorni fa» e
      una colonna accanto che ne dice 46.
      ⚠️ E solo per il PASSATO: vedi la nota accanto a dove si mostra. */
  const consulenzaFatta = (() => {
    const giorno = soloData(d?.dataMeeting);
    if (!giorno) return null;
    const g = giorniDaOggi(giorno);
    if (Number.isNaN(g) || g > 0) return null;
    const chi = nomeConsulente?.(d?.consulenteId) ?? "";
    return {
      giorno: dataBreve(giorno),
      quanto: g === 0 ? "oggi" : g === -1 ? "ieri" : `${-g} giorni fa`,
      chi: chi && chi !== "—" ? chi : "",
    };
  })();
  //  Il giorno si scrive solo quando NON è oggi (vedi `quandoDellaRiga`): in
  //  una pagina che si chiama «Da fare oggi», «per oggi» sotto ogni riga è
  //  rumore; «era per ieri» sotto una riga sola è l'informazione che conta.
  const quando = quandoDellaRiga(riga.giorno, riga.ora, oggi);
  //  Quante volte è già slittata. Si dice dalla seconda in poi: la prima volta
  //  che si rimanda qualcosa non è una notizia, la quarta sì — ed è l'unico
  //  modo che ha la lista di far notare che quella cosa non si farà mai.
  const rimandi = riga.task?.rimandi ?? 0;
  return (
    <>
      <div
        className={cn(
          "truncate text-[13px] font-medium leading-tight",
          riga.fatta && "line-through",
        )}
      >
        {riga.cosa}
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        {d ? (
          <>
            <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato))}>
              {etichettaStato(d.stato)}
            </span>
            {/*  ── «DA ANTICIPARE», ANCHE QUI ────────────────────────────
                Richiesta del committente: la priorità si deve vedere anche
                fuori dall'elenco delle installazioni. Questa è la lista da cui
                si telefona, quindi è il posto in cui sapere che quella persona
                è stata messa in cima — e soprattutto che giorno ha chiesto —
                cambia la telefonata che si sta per fare.
                È lo STESSO componente dell'elenco delle pose (crm/PrioritaPosa):
                stesse parole, stesso colore, e la stessa regola su quando
                sparire. Su chi non ha nessuna priorità non rende niente. */}
            {riga.lead && <SegnoPriorita lead={riga.lead} className="shrink-0" />}
            {d.telefono && <span className="truncate tabular-nums">{d.telefono}</span>}
            {/*  ── LA CONSULENZA GIÀ FATTA, E CHI L'HA FATTA ───────────────
                ⚠️ Solo se è GIÀ AVVENUTA: su un appuntamento di domani questa
                 riga direbbe «fra 1 giorno», che è la stessa cosa che dice la
                 pastiglia dello stato due centimetri più a sinistra. Il valore
                 sta tutto nel passato — «visto 47 giorni fa» spiega perché
                 quel lead non ha ancora comprato, e cambia come si apre la
                 telefonata.
                ⚠️ E il nome del consulente accanto: chi richiama deve sapere
                 con chi ha già parlato il cliente, o si presenta come il primo
                 che chiama. */}
            {consulenzaFatta && (
              <>
                <span className="shrink-0 opacity-40">·</span>
                <span className="shrink-0" title={`Consulenza del ${consulenzaFatta.giorno}`}>
                  visto {consulenzaFatta.quanto}
                </span>
                {consulenzaFatta.chi && (
                  <>
                    <span className="shrink-0 opacity-40">·</span>
                    <span className="truncate">{consulenzaFatta.chi}</span>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {quando && (
              <span
                className={cn(
                  "shrink-0 font-medium",
                  riga.giorno < oggi ? "text-rose-600" : "text-sky-700",
                )}
              >
                {quando}
              </span>
            )}
            {rimandi >= 2 && (
              <span
                className="flex shrink-0 items-center gap-0.5 text-amber-700"
                title={
                  riga.task?.nataPer
                    ? `Scritta per il ${riga.task.nataPer} e spostata ${rimandi} volte`
                    : `Spostata ${rimandi} volte`
                }
              >
                <Repeat className="h-3 w-3" />
                {rimandi}
              </span>
            )}
            {/* ── ⚠️ A CHI TOCCA VIENE PRIMA DI CHI L'HA SCRITTA ────────────
                  Chi legge questa riga si sta chiedendo «devo farla io?», non
                  «chi l'ha segnata». Il nome di chi ha scritto resta — serve a
                  chiedere spiegazioni — ma dopo, e solo se è un'altra persona:
                  ripetere lo stesso nome due volte fa cercare la differenza. */}
            {!!riga.task?.aNome && (
              <span className="flex shrink-0 items-center gap-0.5 font-medium text-foreground">
                <UserCheck className="h-3 w-3" />
                {riga.task.aNome}
              </span>
            )}
            {!!riga.task?.perNome && (
              <span className="flex min-w-0 shrink items-center gap-0.5" title="Per questo cliente">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{riga.task.perNome}</span>
              </span>
            )}
            {/*  Il tempo bloccato si dice sulla riga: è l'unica cosa scritta
                qui che cambia qualcosa fuori da questa pagina — quell'ora non
                si può più prenotare — e chi la sposta o la cancella deve
                saperlo prima di farlo. */}
            {!!riga.task?.occupaAgenda && (
              <span
                className="flex shrink-0 items-center gap-0.5 text-sky-700"
                title={`Blocca l'agenda per ${riga.task.durata || 60} minuti: in quel tempo nessuno può prenotare`}
              >
                <CalendarClock className="h-3 w-3" />
                agenda
              </span>
            )}
            <span className="truncate">
              {riga.task?.diNome && riga.task.diNome !== riga.task.aNome
                ? `scritta da ${riga.task.diNome}`
                : riga.task?.aNome
                  ? ""
                  : "scritta a mano"}
            </span>
          </>
        )}
      </div>
    </>
  );
}
