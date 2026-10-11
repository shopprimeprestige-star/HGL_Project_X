/** ── LA SCHEDA DEI SALTATI ─────────────────────────────────────────────────
 *
 *  Dove finisce chi è stato messo da parte, e da dove torna in coda.
 *
 *  ── PERCHÉ È UNA VISTA DI /CRM/importa E NON UNA VOCE DI MENU ─────────────
 *  Perché è lo STESSO lavoro della coda, guardato dall'altro lato: sono i
 *  contatti di quel giro, con quei numeri in cima, e l'unico gesto che fanno —
 *  «rimettili in coda» — riporta lì. Una voce di menu a parte vorrebbe dire
 *  una schermata vuota tutti i giorni tranne quando non lo è, un secondo posto
 *  da cui telefonare, e soprattutto un contatore («N saltati») lontano da
 *  quello a cui appartiene. Il menu del CRM elenca MESTIERI (chiamare, l'agenda,
 *  le trattative, le installazioni): mettere da parte non è un mestiere, è una
 *  mossa dentro quello di chi chiama.
 *
 *  ── L'ORDINE È «CHI ASPETTA DA PIÙ TEMPO» ────────────────────────────────
 *  Non l'urgenza della prossima azione, che è l'ordine della coda e a cui la
 *  coda risponde già. Qui la domanda è una sola, ed è quella che il committente
 *  ha posto: chi è rimasto qui senza che nessuno lo rimettesse in giro? Perciò
 *  ogni riga dice da quanti giorni è lì, e oltre `SALTATO_DA_TROPPO` lo dice in
 *  rosso: un elenco in cui tutto ha lo stesso peso è un elenco che non si
 *  guarda.
 *
 *  ⚠️ SI SELEZIONA CLICCANDO LA RIGA, non solo il quadratino. Questa scheda
 *   esiste per lavorare a gruppi — venti righe rimesse in coda in un gesto — e
 *   un bersaglio di 16 pixel per venti volte è la ragione per cui le azioni di
 *   gruppo non le usa nessuno. La scheda del contatto si apre col suo tasto, a
 *   destra.
 *  ⚠️ IL COME NON STA PIÙ QUI: sta in crm/importa/selezione, perché adesso lo
 *   usa anche la scheda «Tutti». Con lo spostamento questa scheda si è presa
 *   gratis due cose che non aveva — Maiusc+clic per prendere un blocco, e un
 *   tetto DICHIARATO su quante righe si scrivono insieme.
 *  ⚠️ IL TETTO NON FERMA PIÙ NIENTE, NÉ LA SELEZIONE NÉ LA SCRITTURA. Prima
 *   «Seleziona tutti» ne prendeva cinquanta su duecento: si credeva di aver
 *   preso la lista e se ne lavorava un quarto. Adesso prende tutte le righe che
 *   si vedono, e sopra le cinquanta la pagina scrive A LOTTI col contatore a
 *   schermo — vale per l'eliminazione E per il rientro in coda, che sono la
 *   stessa `aLotti` (routes/CRM.importa).
 *  ⚠️ QUI LA BARRA NASCONDEVA «RIMETTI IN CODA» SOPRA LE CINQUANTA, con un
 *   avviso in ambra che diceva di toglierne 151. Era il difetto peggiore di
 *   questa scheda: premere «Seleziona tutti» — cioè il gesto che la testata
 *   consiglia — faceva sparire l'unico comando per cui la scheda esiste, e per
 *   riaverlo bisognava deselezionare a mano una riga per volta. In più la frase
 *   era falsa da quando il rientro va a lotti: non se ne rimettevano in coda
 *   «cinquanta per volta», non se ne rimetteva NESSUNA. Il numero adesso si
 *   dice — nella conferma e nel contatore — e non vieta più niente.
 *
 *  ── COSA SI PUÒ FARE DA QUI, OLTRE A RIMETTERE IN CODA ───────────────────
 *  Da ogni riga si cambia lo stato — la pastiglia apre la griglia di tutto il
 *  CRM, e se lo stato scelto chiede un giorno o degli importi la finestra la
 *  apre la pagina — e si elimina il contatto. È il posto in cui servivano di
 *  più: qui finisce chi è fermo da settimane, e fino a ieri per chiudere una di
 *  quelle righe bisognava aprire la sua scheda, una per una, tornando indietro
 *  ogni volta.
 *  ⚠️ ELIMINARE NON SI ANNULLA: non c'è cestino, e il messaggio dopo non ha
 *   nessun «Annulla» da offrire. Per questo il primo clic non elimina — chiede
 *   conferma col NOME davanti — e la conferma di gruppo dice il numero. Il
 *   «rimetti in coda» può permettersi un gesto solo perché si disfa premendo
 *   «salta»; questo no.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  SkipForward,
  Trash2,
  Undo2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Lead, LeadData, LeadStatus } from "@/crm/types";
//  La pastiglia è QUELLA di tutto il CRM: apre la griglia con gli stati che
//  hanno senso per questa scheda (li decide `statiPer`, non questo file) e
//  ferma da sola la propagazione del clic — che qui è indispensabile, perché la
//  riga intera è il bersaglio della selezione.
import { PastigliaStato } from "@/crm/SelettoreStatoDialog";
import { BarraSelezione, CLASSE_BADGE_STATO, Scheda, Vuoto } from "@/crm/ui";
import { SALTATO_DA_TROPPO, attesaLeggibile, eDimenticato, ordinaSaltati } from "./saltati";
//  Un contatto di ritorno messo da parte sta SOLO in questo elenco: la sua
//  decisione aperta va detta qui, o non la ritrova più nessuno.
import { chiedeAncoraUnaDecisione } from "./ricarico";
import {
  RigaSelezionabile,
  TETTO_SELEZIONE,
  testoSelezionaTutti,
  useSelezioneRighe,
} from "./selezione";

export function SchedaSaltati({
  saltati,
  idRitorno,
  inCorso,
  avanzamento,
  tornaInCoda,
  onRimetti,
  onStato,
  onEliminaUno,
  onEliminaMolti,
  onApri,
}: {
  /** Le schede messe da parte. Arrivano dalla pagina già filtrate: chi è
   *  saltato lo decide `eSaltato`, e non si ridecide qui. */
  saltati: Lead[];
  /** Chi il file appena caricato ha riportato a galla: un saltato che ricompare
   *  in una lista nuova ha appena rilasciato di nuovo il suo numero, ed è la
   *  riga da rimettere in coda per prima. Si dice sulla riga invece di
   *  rimetterlo in coda da soli: la regola resta una sola — un saltato torna in
   *  giro quando qualcuno lo decide — e le regole con un'eccezione sono quelle
   *  che poi nessuno sa più spiegare. */
  idRitorno: Set<string>;
  /** vero mentre il rientro sta scrivendo in archivio: i tasti si spengono, o
   *  si preme due volte e partono due giri di salvataggi sugli stessi id */
  inCorso: boolean;
  /** A che punto è l'operazione di gruppo che la pagina sta scrivendo a lotti;
   *  `null` = nessuna in corso.
   *  ⚠️ NON ERA PASSATO, E QUESTA È LA SCHEDA CHE NE HA PIÙ BISOGNO: è quella
   *   della pulizia di massa, dove duecento righe si rimettono in coda o si
   *   buttano in un gesto. Senza il conto, un minuto di scritture è un tasto
   *   che dice «Elimino…» e una pagina indistinguibile da una piantata — e il
   *   suggerimento di «Seleziona tutti» promette proprio che «te lo dice la
   *   barra in basso». */
  avanzamento?: { fatti: number; totale: number } | null;
  /** Se togliergli il salto lo riporta DAVVERO nel giro delle telefonate.
   *  ⚠️ Non è sempre sì, ed è la cosa meno ovvia di questa scheda: chi nel
   *   frattempo ha preso un appuntamento o ha comprato non è più da prima
   *   chiamata, quindi esce di qui e in coda non entra — cioè sparisce dalla
   *   pagina sotto gli occhi di chi ha premuto. Lo si dice PRIMA, sulla riga,
   *   invece di spiegarlo dopo con un messaggio.
   *  La domanda arriva dalla pagina (è lei che sa com'è fatta la sua coda) e non
   *  si rifà qui: due idee di «chi è da chiamare» nella stessa schermata
   *  finirebbero per non essere più la stessa. */
  tornaInCoda: (l: Lead) => boolean;
  /** Rimette in coda le schede scelte. La scrittura — e la risposta del server —
   *  sono della pagina: qui non si sa nemmeno cosa sia `updateLead`. */
  onRimetti: (righe: Lead[]) => void;
  /** Il cambio di stato di UNA riga, dalla pastiglia. È la stessa `segna` della
   *  coda: intercetta le chiusure vinte, apre la finestra del giorno/ora o degli
   *  importi quando lo stato la chiede, e solo negli altri casi scrive. Qui non
   *  se ne sa niente — e non si deve: due idee di «cosa vuol dire mettere
   *  appuntamento fissato» nella stessa pagina sono la fine della pagina. */
  onStato: (l: Lead, s: LeadStatus) => void;
  /** Elimina una riga. `true` = è sparita davvero dall'archivio; il messaggio,
   *  in un senso e nell'altro, lo dà la pagina. Qui il valore serve solo a
   *  spegnere la conferma. */
  onEliminaUno: (l: Lead) => Promise<boolean>;
  /** Elimina le righe scelte e restituisce gli id di quelle RIMASTE — stessa
   *  disciplina di `onCambiaStato` nella scheda «Tutti»: chi non è stato
   *  eliminato resta selezionato e sotto gli occhi, pronto per un secondo giro.
   *  Sopra il tetto la pagina scrive a lotti: da qui si vede solo che il tasto
   *  dice «Elimino…» finché non ha finito. */
  onEliminaMolti: (righe: Lead[]) => Promise<string[]>;
  onApri: (l: Lead) => void;
}) {
  const righe = useMemo(() => ordinaSaltati(saltati), [saltati]);
  /** La selezione multipla di crm/importa/selezione: clic sulla riga intera,
   *  Maiusc+clic per il blocco, e il conto che si ricalcola sulle righe di
   *  adesso — cioè chi non è tornato in coda resta selezionato. */
  const {
    selezione,
    selezionati,
    //  Quante righe prenderebbe «Seleziona tutti»: si scrive SUL PULSANTE, non
    //  solo nel suggerimento a comparsa — un aiuto che compare passandoci sopra
    //  col mouse su un tablet non esiste, e il numero è metà del patto che ha
    //  permesso di togliere il tetto («si preme sapendo quante se ne prendono»).
    quante,
    tuttiSelezionati,
    tettoStretto,
    oltreIlTetto,
    scegli,
    selezionaTutti,
    azzera,
    //  ⚠️ Serve solo all'eliminazione di gruppo: dopo, restano selezionate le
    //   righe che NON sono state eliminate. Prima non era destrutturato perché
    //   il rientro in coda non lascia falliti sotto gli occhi — li rimette e
    //   basta — ed è la stessa svista che qui costerebbe una selezione svuotata
    //   sopra a un errore, cioè un errore che non si riesce più a riprovare.
    tieniSolo,
  } = useSelezioneRighe(righe);
  const dimenticati = useMemo(() => righe.filter(eDimenticato).length, [righe]);

  /** ── LE DUE CONFERME ────────────────────────────────────────────────────
   *  Eliminare non si annulla, quindi il primo clic non elimina mai: arma una
   *  domanda e la domanda dice CHI (dalla riga) o QUANTI (dal gruppo).
   *  ⚠️ UNA SOLA RIGA ARMATA PER VOLTA — è un id, non un insieme. Con dieci
   *   tasti rossi accesi contemporaneamente basta un clic distratto sulla riga
   *   sbagliata, e non c'è modo di rimediare. Armandone una si disarma l'altra
   *   da sola. */
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  /** L'id che sta scrivendo adesso: il tasto si spegne e lo dice, altrimenti si
   *  preme due volte e partono due eliminazioni sullo stesso contatto. */
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [gruppoArmato, setGruppoArmato] = useState(false);
  const [gruppoInCorso, setGruppoInCorso] = useState(false);

  /** ── LE CONFERME IN SOSPESO CADONO QUANDO CAMBIA IL BERSAGLIO ───────────
   *  ⚠️ QUI NON CADEVANO, ED È LA DIFESA CHE MANCAVA. Le due domande di questa
   *   scheda dicono un NOME («Elimina Mario Rossi») o un NUMERO («Elimino 12
   *   contatti»): un attimo dopo aver armato la seconda si preme «Seleziona
   *   tutti», e il tasto rosso resta lì sotto il dito — solo che adesso punta a
   *   duecento contatti e non a dodici, con la frase che si aggiorna sotto gli
   *   occhi di nessuno. Quella di riga era peggio: restava armata mentre si
   *   cliccava altrove, e il tasto rosso occupa il posto di «apri la scheda»,
   *   cioè quello che si preme di più. Basta una distrazione in mezzo e si
   *   elimina una persona con un clic, senza cestino da cui ripescarla.
   *   È la stessa regola che la scheda «Tutti» applica da sempre (`annullaConferme`).
   *  ⚠️ MENTRE UNA SCRITTURA È IN VOLO NON SI DISARMA NIENTE: la conferma è
   *   anche il posto in cui si legge «Elimino…», e toglierla a metà lavoro
   *   nasconde l'unica cosa che dice che sta succedendo qualcosa. */
  const annullaConferme = () => {
    if (gruppoInCorso || eliminando) return;
    setDaEliminare(null);
    setGruppoArmato(false);
  };
  const scegliRiga = (id: string, blocco: boolean) => {
    annullaConferme();
    scegli(id, blocco);
  };
  const prendiTutti = () => {
    annullaConferme();
    selezionaTutti();
  };
  const togliTutti = () => {
    annullaConferme();
    azzera();
  };

  const elimina = async (l: Lead) => {
    if (eliminando) return;
    setEliminando(l.id);
    await onEliminaUno(l);
    setEliminando(null);
    //  La domanda si chiude comunque: se è andata la riga non c'è più, e se non
    //  è andata il messaggio della pagina l'ha già detto — lasciare il tasto
    //  rosso acceso sotto il dito è il modo per eliminare il contatto sbagliato
    //  al tentativo successivo.
    setDaEliminare(null);
  };

  const eliminaGruppo = async () => {
    if (selezionati.length === 0 || gruppoInCorso) return;
    setGruppoInCorso(true);
    const rimasti = await onEliminaMolti(selezionati);
    setGruppoInCorso(false);
    setGruppoArmato(false);
    tieniSolo(rimasti);
  };

  if (righe.length === 0) {
    return (
      <Vuoto
        titolo="Nessuno messo da parte"
        testo="Qui finisce chi salti dalla coda: trovato occupato, da richiamare stasera, numero che squilla mentre entra l'altra chiamata. Restano qui — anche domani, anche dall'altra postazione — finché non li rimetti in coda."
        icona={SkipForward}
      />
    );
  }

  return (
    <>
      <Scheda
        titolo="Lead saltati"
        nota={`${righe.length} messi da parte · i più fermi in cima`}
        icona={SkipForward}
        azioni={
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[12px]"
            disabled={inCorso || righe.length === 0}
            onClick={prendiTutti}
            //  ⚠️ ADESSO LE PRENDE DAVVERO TUTTE, e il tetto si dice lo stesso
            //   — ma per quello che è diventato: non «te ne do cinquanta», e
            //   nemmeno «da qui in su il rientro si ferma» (non si ferma più
            //   niente), bensì «da qui in su si scrive a lotti e vedi a che
            //   punto sono». Il limite silenzioso di prima era peggio di non
            //   averlo: chi premeva su duecento righe ne prendeva cinquanta e
            //   credeva di aver lavorato la lista. Maiusc+clic sta qui accanto
            //   perché nessuno legge un aiuto per scoprire una scorciatoia.
            title={
              tettoStretto
                ? `Le prende tutte e ${righe.length} — sopra ${TETTO_SELEZIONE} le scritture di gruppo vanno a lotti e il conto compare nella barra in basso. Per un pezzo preciso, clic sulla prima e Maiusc+clic sull'ultima`
                : "Prendile tutte. Per un pezzo preciso: clic sulla prima e Maiusc+clic sull'ultima"
            }
          >
            {testoSelezionaTutti(tuttiSelezionati, tettoStretto, quante)}
          </Button>
        }
        senzaPadding
      >
        {/*  L'avviso sta DENTRO l'elenco e non in cima alla pagina: qui si è
            già venuti a guardare. In cima ci va il numero, che è quello che fa
            venire. */}
        {dimenticati > 0 && (
          <p className="flex items-start gap-1.5 border-b border-border bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {/*  L'avviso dice adesso le TRE uscite, non due: la terza — la
                pastiglia dello stato, sulla riga — è nata oggi, e un avviso che
                manda ad aprire una scheda per un gesto che sta a due centimetri
                è un avviso che fa perdere tempo. */}
            {dimenticati === 1
              ? `Uno è qui da più di ${SALTATO_DA_TROPPO} giorni e nessuno lo sta chiamando: o torna in coda, o gli si dà un esito dalla pastiglia dello stato, o si elimina.`
              : `${dimenticati} sono qui da più di ${SALTATO_DA_TROPPO} giorni e nessuno li sta chiamando: o tornano in coda, o gli si dà un esito dalla pastiglia dello stato, o si eliminano.`}
          </p>
        )}

        <ul className="divide-y divide-border">
          {righe.map((l) => {
            const d = l.data ?? ({} as LeadData);
            const scelta = selezione.has(l.id);
            const vecchio = eDimenticato(l);
            const nome = `${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome";
            return (
              //  Il guscio della riga — quadratino, bersaglio grande, comandi a
              //  destra — è quello condiviso: vedi crm/importa/selezione.
              <RigaSelezionabile
                key={l.id}
                scelta={scelta}
                etichetta={nome}
                onScegli={(blocco) => scegliRiga(l.id, blocco)}
                azioni={
                  <>
                    {/*  Era un chip di sola lettura: lo stato si vedeva e non si
                        toccava, e per cambiarlo si apriva la scheda grande —
                        cioè si usciva dall'elenco che si stava lavorando. Adesso
                        è la stessa pastiglia premibile del resto del CRM.
                        ⚠️ Sta in `azioni`, che è FRATELLO del bersaglio della
                         selezione e non figlio: dentro `children` sarebbe un
                         pulsante dentro un pulsante — marcatura non valida, e su
                         una pagina servita dal server un'idratazione che non
                         combacia. */}
                    {/*  ⚠️ SI SPEGNE ANCHE MENTRE LAVORA UNA SCRITTURA DI
                         GRUPPO, e non solo mentre questa riga si sta
                         eliminando. Prima guardava `eliminando === l.id` e
                         basta: durante un «Rimetti in coda» su duecento righe
                         si poteva aprire la griglia e cambiare stato a una di
                         quelle duecento. Il lotto tiene UNA sola istanza di
                         `updateLead`, presa prima di partire, che scrive
                         l'oggetto `data` intero com'era allora: arrivato a
                         quella riga le rimetteva i dati di prima e cancellava
                         lo stato appena scelto, senza un messaggio. È la stessa
                         forma che usa la scheda «Tutti» (`occupato`). */}
                    <PastigliaStato
                      dati={d}
                      contesto={nome}
                      className="max-w-[150px] shrink-0"
                      disabilitata={inCorso || eliminando === l.id}
                      onScegli={(s) => onStato(l, s)}
                    />
                    {daEliminare === l.id ? (
                      /*  ── LA DOMANDA, SULLA RIGA ────────────────────────
                          Col nome scritto dentro il tasto rosso: «Elimina» e
                          basta, in un elenco di venti righe uguali, è la
                          domanda a cui si risponde sì guardando la riga
                          sbagliata. E non è una finestra: una finestra in mezzo
                          a una giornata al telefono si chiude a occhi chiusi.
                          ⚠️ «Lascia stare» sta DOVE STAVA IL CESTINO, cioè
                           sotto il dito che ha appena premuto: un secondo clic
                           per inerzia annulla, non elimina. Il tasto rosso è
                           spostato a sinistra apposta.
                          L'altro comando — «apri la scheda» — sparisce finché la
                          domanda è aperta: la riga sta chiedendo una cosa sola,
                          e le risposte devono essere due. */
                      <>
                        {/*  Questo è l'unico comando della riga che PUÒ
                            stringersi (niente `shrink-0`, e il nome dentro è
                            `truncate`): su uno schermo stretto la riga è già
                            piena di pastiglia e conferma, e un tasto rigido
                            manderebbe l'elenco a scorrere di lato. */}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 min-w-0 text-[12px]"
                          //  ⚠️ Si spegne anche mentre lavora una scrittura di
                          //   gruppo (`inCorso`): sono le stesse righe: eliminare
                          //   una scheda che il rientro in coda sta salvando in
                          //   quel momento vuol dire due richieste che si
                          //   scavalcano sullo stesso id. «Lascia stare», qui
                          //   accanto, resta invece sempre premibile: annullare
                          //   una domanda non scrive niente.
                          disabled={inCorso || eliminando === l.id}
                          onClick={() => void elimina(l)}
                          title="Elimina per sempre: non si può annullare"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5 shrink-0" />
                          <span className="max-w-[10rem] truncate">
                            {eliminando === l.id ? "Elimino…" : `Elimina ${nome}`}
                          </span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0 px-2 text-[12px]"
                          disabled={eliminando === l.id}
                          onClick={() => setDaEliminare(null)}
                          aria-label={`Non eliminare ${nome}`}
                          title="Lascia stare"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0 px-2 text-[12px]"
                          onClick={() => onApri(l)}
                          aria-label={`Apri la scheda di ${nome}`}
                          title="Apri la scheda"
                        >
                          <User className="h-3.5 w-3.5" />
                        </Button>
                        {/*  A riposo il cestino NON è rosso: un elenco di venti
                            righe con venti icone rosse è un elenco che sembra un
                            guasto, e il colore che avvisa non avvisa più
                            nessuno. Il rosso compare sulla conferma, che è il
                            solo clic che cancella davvero. */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0 px-2 text-[12px] text-muted-foreground hover:text-rose-600"
                          disabled={inCorso}
                          //  Arma la domanda di QUESTA riga e spegne quella del
                          //  gruppo: una sola alla volta in tutta la scheda.
                          onClick={() => {
                            setGruppoArmato(false);
                            setDaEliminare(l.id);
                          }}
                          aria-label={`Elimina ${nome}`}
                          title="Elimina il contatto dall'archivio. Chiede conferma, perché non si può annullare"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </>
                }
              >
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium">{nome}</span>
                  {idRitorno.has(l.id) && (
                    <span
                      className={cn(
                        CLASSE_BADGE_STATO,
                        "border-amber-300 bg-amber-50 text-amber-700",
                      )}
                    >
                      <RotateCcw className="h-3 w-3 shrink-0" /> È tornato nella lista
                    </span>
                  )}
                  {/*  ── ⚠️ LA DOMANDA APERTA NON SI PERDE QUI DENTRO ──────
                       Un contatto di ritorno messo da parte sta in questo
                       elenco e in nessun altro (vedi `repartoDelRitorno`):
                       senza questa targhetta la sua decisione — conferma o
                       rimettilo fra i da contattare — non la ritroverebbe
                       più nessuno. Rimettendolo in coda torna da solo nel suo
                       reparto, con le sue due scelte. */}
                  {chiedeAncoraUnaDecisione(l) && (
                    <span
                      className={cn(
                        CLASSE_BADGE_STATO,
                        "border-violet-300 bg-violet-50 text-violet-700",
                      )}
                      title="È un contatto di ritorno e ha ancora una decisione aperta: rimettilo in coda e la ritrovi fra i «Di ritorno», con «conferma» e «rimettilo fra i da contattare»"
                    >
                      <HelpCircle className="h-3 w-3 shrink-0" /> Decisione aperta
                    </span>
                  )}
                </span>
                <span className="block truncate text-[11.5px] text-muted-foreground">
                  {d.telefono || "senza telefono"} ·{" "}
                  <span className={cn(vecchio && "font-medium text-rose-600")}>
                    {attesaLeggibile(l)}
                  </span>
                  {d.saltatoDa ? ` da ${d.saltatoDa}` : ""}
                  {/*  Rimetterlo in coda gli toglie il salto ma non lo riporta a
                      telefono: il suo stato è andato avanti da un'altra pagina.
                      Detto qui, si sceglie sapendolo — detto dopo, sembra che la
                      riga si sia persa. */}
                  {!tornaInCoda(l) && " · rimettendolo in coda non torna a telefono"}
                </span>
              </RigaSelezionabile>
            );
          })}
        </ul>
      </Scheda>

      {/*  La stessa barra delle azioni di gruppo del resto del CRM, nello stesso
          posto: da qui passano le operazioni che toccano venti righe insieme, e
          non è il punto in cui inventarsi una variante. */}
      <BarraSelezione conteggio={selezionati.length} onAnnulla={togliTutti}>
        {avanzamento ? (
          /*  ── IL CONTO, MENTRE LA PAGINA SCRIVE ──────────────────────────
              Stessa forma del «Importazione… 40/312» del pannello di carica e
              della barra di «Tutti»: è lo stesso fatto — un numero che sale su
              un totale fermo — e in questa schermata si racconta in un modo
              solo. Vale per tutte e due le scritture di gruppo di qui, il
              rientro in coda e l'eliminazione. */
          <span className="px-1 text-[12px] tabular-nums" aria-live="polite">
            Scrivo… <b>{avanzamento.fatti}</b>/{avanzamento.totale}
          </span>
        ) : gruppoArmato ? (
          /*  ── LA DOMANDA, PER IL GRUPPO ──────────────────────────────────
              Dice il numero per esteso e dice che non si torna indietro, PRIMA
              di scrivere. Non è una finestra, per la stessa ragione della
              conferma di riga: una frase nella barra che si sta già guardando
              si legge, una finestra si chiude.
              ⚠️ IL TASTO ROSSO STA A SINISTRA DI TUTTO, e prima stava dopo la
               frase «perché la frase lo spinge via dal punto appena premuto».
               Quel ragionamento era sbagliato: `BarraSelezione` è centrata
               (`mx-auto w-fit`), quindi allungandola il bordo destro va a
               destra E quello sinistro va a sinistra — la frase spingeva il
               tasto rosso proprio ADDOSSO al «Elimina» grigio che l'aveva
               aperta, che stava sulla destra della barra corta. Messo per
               primo, il rosso finisce dove un attimo fa non c'era barra; e in
               fondo resta «Lascia stare», cioè sotto il dito che ha appena
               premuto — la stessa disposizione delle righe, dove funziona. */
          <>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-[12px]"
              disabled={gruppoInCorso}
              onClick={() => void eliminaGruppo()}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {gruppoInCorso
                ? "Elimino…"
                : `Elimina ${selezionati.length === 1 ? "1 contatto" : `${selezionati.length} contatti`}`}
            </Button>
            <span className="max-w-[22rem] px-1 text-[12px] leading-snug">
              dall'archivio, per sempre: non c'è cestino e non si può annullare.
              {/*  Sopra il tetto non è più un no: è un avviso su COME andrà,
                  cioè a lotti, col conto che compare qui al posto di questa
                  frase. */}
              {oltreIlTetto &&
                ` Sono più di ${TETTO_SELEZIONE}: le tolgo a lotti, e qui compare a che punto sono.`}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12px]"
              disabled={gruppoInCorso}
              onClick={() => setGruppoArmato(false)}
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Lascia stare
            </Button>
          </>
        ) : (
          <>
            {/*  ⚠️ QUI IL TETTO NASCONDEVA QUESTO PULSANTE. Sopra le cinquanta
                selezionate la barra sostituiva «Rimetti in coda» con un avviso
                in ambra («se ne rimettono in coda 50 per volta, togline 151»):
                cioè premendo «Seleziona tutti» su duecento saltati spariva
                l'unico comando per cui questa scheda esiste, e per riaverlo
                bisognava deselezionare a mano centocinquanta righe. La frase
                era anche falsa: da quando `rimettiInCoda` passa da `aLotti`
                (routes/CRM.importa) il rientro regge qualunque numero, venti
                righe per volta, col conto a schermo — esattamente come
                l'eliminazione qui accanto. Il numero adesso si dice nel
                suggerimento e nel contatore, e non vieta più niente. */}
            <Button
              size="sm"
              disabled={inCorso}
              onClick={() => onRimetti(selezionati)}
              className="h-8 text-[12px]"
              title={
                oltreIlTetto
                  ? `Toglie il salto a tutte e ${selezionati.length}: sono più di ${TETTO_SELEZIONE}, quindi le scrivo a lotti e qui compare a che punto sono`
                  : "Toglie il salto: chi è ancora da prima chiamata torna nel giro"
              }
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" />
              {inCorso ? "Rimetto in coda…" : "Rimetti in coda"}
            </Button>
            {/*  L'eliminazione di gruppo sta QUI e non altrove perché questa è
                la scheda della pulizia: l'avviso in cima all'elenco dice da
                settimane che chi è fermo da troppo «o torna in coda, o gli si dà
                un esito» — e la terza risposta, per le liste comprate piene di
                numeri morti, è buttarli. Il tasto è spento e grigio finché non
                si preme: il rosso è della conferma. */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12px] text-muted-foreground hover:text-rose-600"
              disabled={inCorso}
              //  Armando la domanda del gruppo si spegne quella di riga: una
              //  domanda per volta in tutta la scheda, o si risponde «sì» a
              //  quella che non si stava guardando.
              onClick={() => {
                setDaEliminare(null);
                setGruppoArmato(true);
              }}
              title="Elimina dall'archivio le schede selezionate. Chiede conferma: non si può annullare"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Elimina
            </Button>
          </>
        )}
      </BarraSelezione>
    </>
  );
}
