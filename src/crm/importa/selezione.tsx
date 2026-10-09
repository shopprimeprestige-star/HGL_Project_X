/** ── SELEZIONARE PIÙ RIGHE, IN UN MODO SOLO ────────────────────────────────
 *
 *  Qui dentro sta il gesto «prendine venti — o prendile tutte», e ci sta UNA
 *  VOLTA.
 *
 *  ── PERCHÉ È USCITO DA SchedaSaltati ─────────────────────────────────────
 *  La selezione a gruppi è nata lì (rimettere in coda venti schede in un
 *  gesto) ed era scritta lì. Adesso la vuole anche la scheda «Tutti», dove si
 *  cambia lo stato a un blocco di righe: ricopiarla avrebbe voluto dire due
 *  selezioni multiple nella stessa pagina, con due idee di cosa fa un clic e
 *  due bersagli diversi — cioè esattamente la cosa che la nota in cima a
 *  SchedaSaltati esiste per impedire. Quindi non è stata ricopiata: è stata
 *  spostata qui, e le due schede la chiamano.
 *
 *  ── PERCHÉ NON PARLA PIÙ DI LEAD ─────────────────────────────────────────
 *  ⚠️ `useSelezioneRighe` prendeva `Lead[]` e adesso prende qualunque cosa abbia
 *   un `id`. Il motivo è «Da fare oggi»: là le righe non sono schede ma COSE DA
 *   FARE (un richiamo, una consulenza da fissare, un'installazione), e il
 *   committente ha chiesto lo stesso gesto — prendine venti, cambia lo stato in
 *   un colpo. Ricopiare qui accanto una seconda selezione a blocchi voleva dire
 *   due idee di cosa fa Maiusc+clic in due pagine dello stesso CRM, che è
 *   esattamente la cosa che questo file esiste per impedire.
 *   Del contenuto delle righe qui dentro non si legge NIENTE tranne l'id: chi
 *   chiama sa cosa sono e cosa farci.
 *
 *  ⚠️ SI SELEZIONA CLICCANDO TUTTA LA RIGA, non il quadratino da 16 pixel.
 *   È la regola che rende usabili le azioni di gruppo: venti righe prese con un
 *   bersaglio grande sono venti clic comodi, con un bersaglio piccolo sono venti
 *   clic sbagliati e una funzione che nessuno usa. Il quadratino resta perché è
 *   il segno che dice «questa riga si può prendere» e perché da tastiera è
 *   l'unico modo per prenderla; ma è AFFIANCATO al bersaglio grande, non ne è la
 *   sola porta.
 *
 *  ── MAIUSC+CLIC: IL BLOCCO ────────────────────────────────────────────────
 *  Il gesto di tutti gli elenchi del mondo: si prende la prima riga, si tiene
 *  premuto Maiusc e si preme l'ultima. Prende tutto quello che c'è in mezzo,
 *  NELL'ORDINE IN CUI SI VEDE — che è il motivo per cui il blocco si calcola
 *  sull'elenco già ordinato che la scheda passa, e non su un elenco suo.
 *
 *  ⚠️ IL BLOCCO PRENDE E BASTA: NON TOGLIE. Maiusc su venti righe che ne
 *   deseleziona diciannove è il gesto che fa perdere in un colpo il lavoro
 *   appena fatto, e chi lo subisce non capisce nemmeno cos'è successo. Per
 *   togliere c'è il clic singolo, una riga per volta, oppure la X della barra.
 *
 *  ── IL TETTO: PRIMA STAVA SUL GESTO, ADESSO STA SULLA SCRITTURA ──────────
 *  `TETTO_SELEZIONE` è nato come tetto vero: «Seleziona tutti» prendeva le
 *  prime cinquanta righe e le altre duecentocinquanta restavano lì. La ragione
 *  era giusta — ogni riga selezionata diventa UN salvataggio a sé (`updateLead`
 *  scrive una riga per volta), quindi trecento selezionate sono trecento
 *  richieste al database una dietro l'altra, con la pagina ferma in mezzo e
 *  nessun modo di sapere a che punto è.
 *  ⚠️ MA LA CURA COSTAVA PIÙ DEL MALE. Chi doveva cambiare stato a trecento
 *   righe non poteva farlo e basta: prendine cinquanta, aspetta, riprendine
 *   cinquanta, sei volte, ricordandosi a mente dove era arrivato. E il tetto
 *   non era nemmeno solo qui — la pagina lo ricontrollava e RIFIUTAVA di
 *   scrivere («Troppe schede insieme»), quindi un blocco preso con Maiusc su
 *   sessanta righe non era una selezione da sfoltire: era un'azione di gruppo
 *   che si rompeva dopo averla decisa. Un limite che vieta il gesto invece di
 *   reggerlo.
 *
 *  ADESSO «Seleziona tutti» prende TUTTE le righe che si vedono, e il numero
 *  resta a dire un'altra cosa: da qui in su la scrittura va A LOTTI, uno dopo
 *  l'altro, con il contatore a schermo — lo stesso `{ fatti, totale }` con cui
 *  questa pagina importa i file. Il male vero era la pagina ferma e muta, e un
 *  lotto per volta con il conto che avanza lo cura davvero; vietare il gesto lo
 *  nascondeva soltanto.
 *  ⚠️ QUI DENTRO NON SI SCRIVE NIENTE, e i lotti non li fa questo file: li fa
 *   chi possiede le scritture (routes/CRM.importa), che è anche l'unico a
 *   sapere quanto è grande un lotto. Da qui passano solo i fatti che le schede
 *   devono poter DIRE prima che si prema: quante righe si vedono (`quante`), se
 *   prenderle tutte vorrà un lavoro lungo (`tettoStretto`), e se la selezione
 *   di adesso già lo vuole (`oltreIlTetto`).
 *  ⚠️ IL NUMERO SI DICE A SCHERMO, sempre — è la stessa regola di prima, con
 *   un'altra frase. Prima serviva a non far credere di aver lavorato tutta la
 *   lista quando se ne erano prese cinquanta; adesso serve perché un'operazione
 *   lunga che parte muta è indistinguibile da una pagina bloccata. Chi lo usa
 *   lo legge sul pulsante («Seleziona tutti (312)») e nella barra in basso.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Lead } from "@/crm/types";

/** ── LA SOGLIA DEL LAVORO LUNGO ────────────────────────────────────────────
 *  Da quante righe in su un'azione di gruppo smette di essere istantanea e
 *  diventa un lavoro da raccontare: sopra questo numero chi scrive va a lotti e
 *  accende il contatore, sotto si fa e basta.
 *
 *  ⚠️ IL NOME È RIMASTO «TETTO» MA NON TIENE PIÙ NIENTE FUORI. Non toglie una
 *   riga alla selezione — «Seleziona tutti» le prende tutte (vedi la nota in
 *   cima). È il numero oltre il quale si AVVISA, non oltre il quale si vieta.
 *   Chi lo legge da fuori (le schede, la pagina) lo usa per scrivere una frase,
 *   mai per tagliare un elenco.
 *
 *  ⚠️ E NON È LA GRANDEZZA DEL LOTTO: quanto grande sia un giro di scrittura lo
 *   decide chi scrive, che è l'unico a sapere quanto costa una richiesta. Qui
 *   c'è solo il punto in cui vale la pena avvertire. Cinquanta perché è la
 *   stessa misura con cui questa pagina importa i file a blocchi: un solo
 *   numero da ricordare in tutta la schermata. */
export const TETTO_SELEZIONE = 50;

/** ── LA SELEZIONE ──────────────────────────────────────────────────────────
 *  `righe` è l'elenco COSÌ COM'È A SCHERMO, già ordinato e già filtrato: da lì
 *  si ricava sia chi è selezionato sia cosa vuol dire «da qui a lì» quando si
 *  tiene premuto Maiusc.
 *
 *  ⚠️ `selezionati` SI RICALCOLA SULLE RIGHE DI ADESSO, invece di fidarsi del
 *   `Set`. È quello che tiene onesta la barra in basso dopo un'operazione di
 *   gruppo: chi è uscito dall'elenco (rimesso in coda, filtrato via dal cambio
 *   di stato, oppure ELIMINATO — e da lì non torna) esce dal
 *   conto da solo, e chi è rimasto — perché il server ha rifiutato — resta
 *   selezionato e sotto gli occhi, pronto per un secondo tentativo. È anche il
 *   motivo per cui nessun conto qui dentro parte dal `Set`: si parte sempre da
 *   `righe`, e il `Set` risponde solo a «questa riga è scelta?».
 *
 *  ⚠️ GLI ID SPARITI NON SI POTANO, ED È VOLUTO. Dopo un'eliminazione il `Set`
 *   conserva id di righe che non esistono più: sembra roba da ripulire, e
 *   invece ripulirla romperebbe un'altra cosa. `righe` è già FILTRATA (la
 *   scheda «Tutti» la filtra per stato), quindi «tieni solo gli id che sono in
 *   `righe`» vorrebbe dire perdere la selezione ogni volta che si cambia
 *   pastiglia — che è esattamente il gesto documentato come sicuro in
 *   SchedaTutti. Gli id morti non li legge nessuno: entrano solo in `.has()`,
 *   riga per riga, su righe che ci sono. A ripulire davvero ci pensa
 *   `tieniSolo` alla fine di ogni operazione di gruppo. */
export function useSelezioneRighe<T extends { id: string }>(righe: T[]) {
  const [selezione, setSelezione] = useState<Set<string>>(new Set());
  /** L'ultima riga toccata: è il capo del blocco quando arriva un Maiusc+clic.
   *  Sta in un `ref` e non in uno stato perché non disegna niente — cambiarlo
   *  non deve ridisegnare trecento righe. */
  const capo = useRef<string | null>(null);

  const selezionati = useMemo(() => righe.filter((l) => selezione.has(l.id)), [righe, selezione]);

  /** ⚠️ SI CONFRONTANO I CONTI, NON SI RILEGGE IL `Set`. `selezionati` è già
   *   «le righe di adesso che sono scelte», quindi è un sottoinsieme di
   *   `righe`: se sono tante uguali, sono tutte. Un secondo `righe.every(...)`
   *   qui vorrebbe dire riattraversare trecento righe a ogni disegno per
   *   rispondere a una domanda già risposta.
   *  ⚠️ E SI CONTA SU TUTTE LE RIGHE, non più sulle prime cinquanta: finché il
   *   conto si fermava al tetto, dopo un «Seleziona tutti» su trecento righe il
   *   pulsante diceva «Togli la selezione» perché le prime cinquanta c'erano —
   *   e toglieva una selezione da trecento a chi credeva di aggiungerne. */
  const tuttiSelezionati = righe.length > 0 && selezionati.length === righe.length;
  /** Vero quando l'elenco a schermo supera la soglia: prenderlo tutto è un
   *  lavoro lungo, e serve alla scheda per DIRLO sul pulsante — «Seleziona
   *  tutti (312)» — prima che si prema, non dopo. */
  const tettoStretto = righe.length > TETTO_SELEZIONE;
  /** Vero quando è la selezione di adesso a superare la soglia: la scrittura ci
   *  andrà a lotti, con il contatore acceso. Non è un errore e non blocca
   *  niente — è la frase che la barra in basso deve poter dire prima che si
   *  confermi, perché un'attesa annunciata si aspetta e una a sorpresa no.
   *
   *  ⚠️ PRIMA VOLEVA DIRE «NON SI SCRIVE»: la barra mostrava un avviso in
   *   giallo con quante righe togliere, e la pagina rispondeva «Troppe schede
   *   insieme» senza scrivere niente. Costava il lavoro di chi aveva appena
   *   preso un blocco di sessanta con Maiusc: nessun danno ai dati, ma il gesto
   *   andava rifatto in due volte, contando a mano. */
  const oltreIlTetto = selezionati.length > TETTO_SELEZIONE;

  const scegli = (id: string, blocco: boolean) => {
    const da = capo.current ? righe.findIndex((l) => l.id === capo.current) : -1;
    const a = righe.findIndex((l) => l.id === id);
    /** ⚠️ IL BLOCCO SI CALCOLA QUI, FUORI DALL'AGGIORNAMENTO DI STATO, e prima
     *   di spostare il capo. Dentro l'aggiornatore di `setSelezione` non
     *   funzionerebbe: React chiama quella funzione quando gli pare — di
     *   norma al giro di disegno successivo — cioè DOPO la riga che sposta
     *   `capo`, e «da qui a lì» diventerebbe «da qui a qui». Maiusc+clic
     *   prenderebbe una riga sola, e sembrerebbe che il tasto non serva.
     *  Maiusc senza un capo (primo clic della sessione, oppure capo uscito
     *  dall'elenco nel frattempo — filtrato via, rimesso in coda, eliminato)
     *  vale come un clic normale: `findIndex` non lo trova, `da` resta -1 e si
     *  prende una riga sola. Meglio così che indovinare da dove partiva il
     *  blocco su un elenco che nel frattempo si è accorciato. */
    const blocchi =
      blocco && da >= 0 && a >= 0
        ? righe.slice(Math.min(da, a), Math.max(da, a) + 1).map((l) => l.id)
        : null;
    capo.current = id;
    setSelezione((prec) => {
      const n = new Set(prec);
      if (blocchi) {
        for (const x of blocchi) n.add(x);
        return n;
      }
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  /** Prende (o lascia) TUTTE le righe che si vedono: quelle del filtro acceso,
   *  siano venti o trecentododici. Chi le scrive lo farà a lotti — vedi la nota
   *  in cima — e questo è il gesto che quella scelta ha reso possibile.
   *
   *  Il capo del blocco si azzera: dopo un «prendi tutti» un Maiusc+clic deve
   *  partire da dove si preme, non da una riga toccata mezz'ora fa. */
  const selezionaTutti = () => {
    capo.current = null;
    setSelezione(tuttiSelezionati ? new Set() : new Set(righe.map((l) => l.id)));
  };

  const azzera = () => {
    capo.current = null;
    setSelezione(new Set());
  };

  /** Lascia selezionate SOLO queste: è come finisce un'operazione di gruppo —
   *  restano scelte le righe su cui non è successo niente. Vedi le note sulle
   *  scritture fallite nelle due schede che la usano. Vale per il cambio di
   *  stato come per l'eliminazione: quello che il database ha rifiutato resta
   *  scelto e sotto gli occhi, e il `Set` si ripulisce degli altri. */
  const tieniSolo = (ids: string[]) => {
    capo.current = null;
    setSelezione(new Set(ids));
  };

  return {
    selezione,
    selezionati,
    /** Quante righe si vedono adesso: è il numero che «Seleziona tutti»
     *  prenderebbe, ed esce da qui invece di lasciarlo ricavare a chi chiama.
     *  ⚠️ Non è `selezionati.length`: quello è quante ne sono già scelte, e i
     *   due numeri sul pulsante direbbero due cose opposte. */
    quante: righe.length,
    tuttiSelezionati,
    tettoStretto,
    oltreIlTetto,
    scegli,
    selezionaTutti,
    azzera,
    tieniSolo,
  };
}

/** ── LA RIGA ───────────────────────────────────────────────────────────────
 *  Il guscio di una riga selezionabile: il quadratino, il bersaglio grande, e a
 *  destra i comandi che NON selezionano (aprire la scheda, telefonare).
 *
 *  ⚠️ IL QUADRATINO E IL BERSAGLIO SONO DUE COMANDI AFFIANCATI, non uno dentro
 *   l'altro: un <Checkbox> è già un pulsante, e infilarlo dentro un altro
 *   pulsante è marcatura non valida che in pagine servite dal server (queste) si
 *   paga con un'idratazione che non combacia.
 *
 *  ⚠️ IL MAIUSC SI LEGGE IN CATTURA SULLA RIGA, e non nei due gesti separati.
 *   Il motivo è il quadratino: Radix chiama `onCheckedChange` senza passare
 *   l'evento, quindi da lì il tasto premuto non si vedrebbe e Maiusc+clic
 *   funzionerebbe sul bersaglio grande e non sulla spunta — due comportamenti
 *   per lo stesso gesto a due pixel di distanza. Il `onClickCapture` corre prima
 *   di tutti e due, nello stesso invio dell'evento, e serve entrambi. */
export function RigaSelezionabile({
  scelta,
  etichetta,
  onScegli,
  azioni,
  className,
  children,
}: {
  scelta: boolean;
  /** Chi c'è su questa riga: è quello che la spunta si fa leggere ad alta voce. */
  etichetta: string;
  /** `blocco` è vero quando c'era il Maiusc: prendi tutto da qui al capo. */
  onScegli: (blocco: boolean) => void;
  /** I comandi a destra, fuori dal bersaglio: premerli non seleziona niente. */
  azioni?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const maiusc = useRef(false);
  return (
    <li
      onClickCapture={(e) => {
        maiusc.current = e.shiftKey;
      }}
      className={cn(
        //  ── ⚠️ LA RIGA SCELTA SI VEDE DA TRE SEGNI, NON DA UNO ────────────
        //   Prima era un fondo azzurrino al 5%: su uno schermo luminoso, in
        //   negozio, dieci righe prese e dieci no si distinguevano solo
        //   avvicinandosi. Adesso c'è anche la barretta piena sul bordo
        //   sinistro — che si vede con la coda dell'occhio scorrendo l'elenco —
        //   e la spunta piena. Tre segni perché uno solo, su un elenco lungo,
        //   si perde.
        "relative flex items-center gap-3 py-2 pl-4 pr-4 transition-colors",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-r before:transition-colors",
        scelta ? "bg-primary/[0.07] before:bg-primary" : "before:bg-transparent hover:bg-accent/40",
        className,
      )}
    >
      {/*  ⚠️ IL QUADRATINO E IL BERSAGLIO SONO DUE COMANDI AFFIANCATI, non uno
          dentro l'altro: un <Checkbox> è già un pulsante, e infilarlo dentro un
          altro pulsante è marcatura non valida che in pagine servite dal server
          (queste) si paga con un'idratazione che non combacia.
          Il riquadro attorno serve a un'altra cosa: allarga il bersaglio della
          spunta da sedici a trentadue pixel senza ingrandire il segno, che
          resta piccolo e discreto. Su un telefono, sedici pixel sono un tocco
          che sbaglia una volta su tre. */}
      <span className="-my-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-foreground/[0.06]">
        <Checkbox
          checked={scelta}
          onCheckedChange={() => onScegli(maiusc.current)}
          aria-label={`Seleziona ${etichetta}`}
          className="shrink-0"
        />
      </span>
      <button
        type="button"
        onClick={(e) => onScegli(e.shiftKey)}
        aria-pressed={scelta}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">{children}</span>
      </button>
      {azioni}
    </li>
  );
}

/** La scritta del pulsante «prendili tutti» delle intestazioni. È qui e non
 *  ricopiata nelle due schede perché è il posto in cui il gesto si DICE: la
 *  stessa frase in tutte e due, e se cambia, cambia in un punto solo.
 *
 *  ⚠️ PRIMA DICEVA «Seleziona i primi 50» ed era una promessa mantenuta a
 *   metà: prendeva cinquanta di trecento e lasciava a chi premeva il conto
 *   delle altre duecentocinquanta. Adesso le prende tutte, e il numero fra
 *   parentesi serve all'altra metà del patto — dire QUANTE ne sta prendendo,
 *   perché trecentododici salvataggi non sono un clic e chi preme deve saperlo
 *   prima, non dal contatore che parte dopo.
 *
 *  `quante` è facoltativo apposta: se chi chiama non lo passa la frase resta
 *  vera («Seleziona tutti»), perde solo il numero. Il numero si dice quando
 *  l'elenco supera un lotto (`tettoStretto`); sotto è rumore — «Seleziona tutti
 *  (7)» accanto a sette righe che si contano a occhio non informa nessuno. */
export function testoSelezionaTutti(
  tuttiSelezionati: boolean,
  tettoStretto: boolean,
  quante?: number,
): string {
  if (tuttiSelezionati) return "Togli la selezione";
  return tettoStretto && quante ? `Seleziona tutti (${quante})` : "Seleziona tutti";
}
