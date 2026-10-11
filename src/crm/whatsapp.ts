/** ─────────────────────────────────────────────────────────────────────────
 *  I MESSAGGI PREIMPOSTATI DI WHATSAPP
 *
 *  COSA C'È QUI
 *  Un messaggio pronto per ogni stato della trattativa, il promemoria del
 *  giorno prima e la firma. Sono i testi che partono decine di volte al giorno:
 *  dall'elenco trattative, dall'agenda, dalla scheda cliente, dalla pagina
 *  WhatsApp e dall'area consulenti.
 *
 *  PERCHÉ ADESSO SONO MODELLI E NON PIÙ CODICE
 *  Erano venti stringhe dentro uno switch: per cambiare una virgola serviva un
 *  rilascio. Chi scrive ai clienti tutti i giorni sa meglio di chiunque altro
 *  come va detta una frase, e non deve chiedere il permesso a nessuno. Adesso
 *  ogni testo è un MODELLO con dei segnaposto, modificabile da /CRM/whatsapp e
 *  salvato in app_config. I testi qui sotto restano il punto di partenza: sono
 *  quelli che il centro usa da sempre e si ripristinano in un clic.
 *
 *  LE DUE REGOLE DEL MODELLO — sono poche apposta
 *   1. `{nome}` viene sostituito col dato vero. Se il dato manca e il
 *      segnaposto è FACOLTATIVO (`{link}`, `{consulente}`) sparisce l'intera
 *      RIGA su cui sta: è il modo per non far arrivare "Link per collegarsi:"
 *      seguito dal nulla.
 *   2. `{quando|a breve}` — dopo la barra c'è il testo di riserva, usato quando
 *      il dato manca. Con la riserva la riga non sparisce mai.
 *
 *  L'ERRORE CHE QUESTO FILE DEVE IMPEDIRE
 *  Un `{nome}` arrivato così com'è sul telefono del cliente vale più di dieci
 *  messaggi ben scritti, in negativo. Per questo la sostituzione è una funzione
 *  sola (`componiMessaggio`) e c'è `segnapostiResidui()` per controllare il
 *  testo un attimo prima di premere invio.
 *  ───────────────────────────────────────────────────────────────────────── */

import {
  ALL_LEAD_STATUSES,
  eAppuntamento,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "./types";
import { giornoEsteso } from "./lavori";
import { urlStanza } from "@/lib/sito";
//  Il gettone di una persona (l'impronta della sua scheda) e il link che lo
//  porta: un link per ciascuno, nella stessa stanza.
import { gettoneDi } from "./fascia-consulenza";
import { linkPerPersona } from "@/shop/chi-dal-link";

/* ═══════════════════════════════════════════════════════════════════════════
   1. QUANDO — "oggi" vale più di una data
   ═════════════════════════════════════════════════════════════════════════ */

/** ── "OGGI" VALE PIÙ DI UNA DATA ────────────────────────────────────────────
 *  Un appuntamento scritto come 14/08/2026 obbliga chi legge a fare un conto
 *  mentale — e chi non lo fa se ne dimentica. Se è oggi si scrive OGGI, se è
 *  domani DOMANI, e solo più in là si scrive il giorno per esteso, col nome
 *  della settimana davanti: "giovedì 21 agosto" si colloca da solo. */
function quandoDetto(d?: string): string {
  if (!d) return "";
  const oggi = new Date();
  oggi.setHours(12, 0, 0, 0);
  const g = new Date(`${d}T12:00:00`);
  if (Number.isNaN(g.getTime())) return fmtData(d);
  const scarto = Math.round((g.getTime() - oggi.getTime()) / 86400000);
  if (scarto === 0) return "oggi";
  if (scarto === 1) return "domani";
  if (scarto === -1) return "ieri";
  //  Entro la settimana basta il giorno; oltre serve anche il mese, altrimenti
  //  "martedì" può essere uno qualsiasi dei martedì che verranno.
  /*  ── ⚠️ I NOMI DEI GIORNI NON SI CHIEDONO A `toLocaleDateString` ────────
      Qui c'era `g.toLocaleDateString("it-IT", …)`. In un browser va bene; in un
      Worker la lingua disponibile NON è garantita, e quello che esce è un
      «Thursday» in mezzo a un messaggio italiano — che lo legge il cliente.
      È la stessa trappola già disinnescata in crm/lavori (`giornoEsteso`), e
      averla evitata là e lasciata qui voleva dire che il giorno in cui uno di
      questi testi si compone lato server — i modelli Meta sono già a un passo —
      il guasto sarebbe uscito da solo, mesi dopo, su un messaggio vero.
      Adesso i nomi arrivano da lì: una lista sola, scritta a mano.
      ⚠️ E `giornoEsteso` aggiunge l'ANNO quando non è questo — «martedì 22
       settembre 2027» — che qui è un miglioramento: una data lontana senza
       anno è una data ambigua. */
  return scarto > 1 && scarto <= 6 ? SOLO_GIORNO[g.getDay()] : giornoEsteso(d) || fmtData(d);
}

/** I sette giorni, per quando basta il nome. Oltre la settimana serve anche il
 *  giorno del mese, e lì si usa `giornoEsteso` (crm/lavori). */
const SOLO_GIORNO = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

function fmtData(d?: string): string {
  if (!d) return "";
  // YYYY-MM-DD → DD/MM/YYYY
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** "domani alle 15:30" — l'ora si scrive solo se c'è, senza spazi doppi. */
function quandoEOra(data?: string, ora?: string): string {
  const q = quandoDetto(data);
  if (q && ora) return `${q} alle ${ora}`;
  if (q) return q;
  return ora ? `alle ${ora}` : "";
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. I SEGNAPOSTO
   ═════════════════════════════════════════════════════════════════════════ */

export type ChiaveSegnaposto =
  | "nome"
  | "cognome"
  | "consulente"
  | "quando"
  | "giorno"
  | "link"
  | "preventivi"
  | "firma";

export interface Segnaposto {
  chiave: ChiaveSegnaposto;
  /** cosa ci finisce dentro, detto a chi scrive il messaggio */
  descrizione: string;
  /** true = se il dato manca sparisce tutta la riga (vedi regola 1) */
  facoltativo: boolean;
}

/** L'elenco che la pagina WhatsApp mostra sotto l'editor: sono gli UNICI
 *  segnaposto riconosciuti, tutto il resto resta a schermo com'è scritto e per
 *  questo viene segnalato come errore. */
export const SEGNAPOSTI: Segnaposto[] = [
  { chiave: "nome", descrizione: "Nome del cliente", facoltativo: false },
  { chiave: "cognome", descrizione: "Cognome del cliente", facoltativo: false },
  {
    chiave: "consulente",
    descrizione: "Nome del consulente che scrive",
    facoltativo: true,
  },
  {
    chiave: "quando",
    descrizione: "Data e ora dell'appuntamento, dette come «domani alle 15:30»",
    facoltativo: false,
  },
  /*  ⚠️ IL GIORNO SENZA L'ORA, e non è un doppione di `{quando}`: serve a
      raccontare una cosa GIÀ SUCCESSA. «L'abbiamo già fatta giovedì 18
      settembre alle 15:00» suona come una convocazione — l'ora di una cosa
      passata non serve a nessuno — mentre per un appuntamento da tenere o da
      spostare l'ora è metà dell'informazione. */
  {
    chiave: "giorno",
    descrizione: "Solo il giorno dell'appuntamento, senza l'ora: «giovedì 18 settembre»",
    facoltativo: false,
  },
  { chiave: "link", descrizione: "Link della stanza per la videochiamata", facoltativo: true },
  /*  ── ⚠️ IL PREVENTIVO VERO DI QUESTA PERSONA ─────────────────────────
      Richiesta del committente: il messaggio a chi sta decidendo deve portare
      «il preventivo che abbiamo fatto insieme in consulenza», e «se ha più
      preventivi deve mettere più link nello stesso messaggio».
      Porta con sé la riga che li presenta, perché quella riga deve cambiare da
      sola fra «il preventivo» e «i preventivi» (crm/preventivi/link-nei-
      messaggi): nel modello sarebbe una frase fissa, e a chi ne ha due
      arriverebbe «Qui trovi il preventivo» seguito da due indirizzi.
      ⚠️ È FACOLTATIVO: chi non ha preventivi non deve ricevere una riga
       spaiata, e infatti sparisce tutta. */
  {
    chiave: "preventivi",
    descrizione:
      "Il preventivo del cliente: la riga che lo presenta e il link (o i link, se ne ha più d'uno)",
    facoltativo: true,
  },
  { chiave: "firma", descrizione: "La firma, uguale in tutti i messaggi", facoltativo: true },
];

const FACOLTATIVI = new Set<string>(SEGNAPOSTI.filter((s) => s.facoltativo).map((s) => s.chiave));
const CONOSCIUTI = new Set<string>(SEGNAPOSTI.map((s) => s.chiave));

//  Riconosce `{chiave}` e `{chiave|testo di riserva}`. La riserva può contenere
//  spazi e punteggiatura ma non graffe: annidarle renderebbe illeggibile un
//  modello che deve poter essere corretto al volo da chi non programma.
const RE_SEGNAPOSTO = /\{([a-zA-Z]+)(?:\|([^{}]*))?\}/g;

/* ═══════════════════════════════════════════════════════════════════════════
   3. I MODELLI — il testo di partenza
   ═════════════════════════════════════════════════════════════════════════ */

/** Le chiavi dei modelli: i venti stati, più il promemoria del giorno prima e
 *  la firma (che non sono stati ma testi a sé, e vanno modificati allo stesso
 *  modo). */
export type ChiaveModello =
  | LeadStatus
  | "promemoria"
  //  ⚠️ TRE PROMEMORIA, NON UNO. Vedi `promemoriaDi`: «ti ricordo il nostro
  //   appuntamento, ecco il link, collegati da un posto tranquillo» è giusto
  //   solo per una consulenza in videochiamata. A chi deve VENIRE da noi non
  //   serve nessun link (gli serve l'indirizzo) e a chi aspetta una TELEFONATA
  //   non serve né l'uno né l'altro.
  | "promemoria_sede"
  | "promemoria_richiamo"
  | "firma"
  | "link_consulenza"
  /*  ── ⚠️ I TRE MESSAGGI DEL CONTATTO DI RITORNO ────────────────────────
      Richiesta del committente: «fai che tutti i messaggi posso modificarli
      da una scheda nelle impostazioni, con i segnaposto».
      Erano scritti nel codice (crm/importa/ricarico): per cambiare una virgola
      serviva una pubblicazione, ed è precisamente il motivo per cui tutti gli
      altri testi sono diventati modelli.
      Sono TRE e non uno perché sono tre situazioni diverse, e dirle con la
      stessa frase è il modo di scrivere una figuraccia: a chi la consulenza è
      saltata, a chi ce l'ha ancora davanti, e a chi non l'ha mai presa. */
  | "ritorno_sospeso"
  | "ritorno_futuro"
  | "ritorno_mai"
  | "ritorno_fatta";

/** ── PERCHÉ QUESTI TESTI FUNZIONANO ────────────────────────────────────────
 *  Regole che valgono per tutti, e sono il motivo per cui vale la pena non
 *  stravolgerli mentre si modificano:
 *   · il nome della persona nella PRIMA riga: un messaggio che non ti nomina
 *     si legge come un invio di massa, e come tale viene ignorato;
 *   · UNA sola domanda per messaggio, e CHIUSA: "le va bene domani alle 15?"
 *     ottiene un sì o un no, "quando le fa comodo?" non ottiene niente. Le
 *     domande aperte erano la perdita più silenziosa che avevamo: il cliente
 *     rimanda la risposta a "quando ci penso", e non ci pensa mai;
 *   · nessun blocco di testo: chi legge sul telefono abbandona alla terza riga;
 *   · nessuna pressione e nessun superlativo — si dice cosa succede adesso e
 *     si lascia la porta aperta. La fretta fa rispondere una volta, la calma
 *     fa rispondere sempre;
 *   · dove c'è una data o un'ora, sono DENTRO il messaggio: chiedere di
 *     ricontrollare l'agenda è il modo più rapido per farsi rimandare;
 *   · sui messaggi di chiusura (non interessato, non in target, pratica
 *     chiusa) la domanda NON c'è: lì insistere è l'unico vero errore. */
/** L'indirizzo dello studio. ⚠️ Sta in una costante perché da oggi lo usano
 *  due testi, e un indirizzo copiato a mano è la cosa che, il giorno del
 *  trasloco, resta giusta in un messaggio e sbagliata nell'altro.
 *  ⚠️ I testi PIÙ VECCHI se lo portano ancora dentro scritto per esteso, e non
 *   li ho riscritti di proposito: sono testi che il committente ha approvato e
 *   che può aver già modificato dal pannello (i modelli personalizzati vincono
 *   su questi), quindi riscriverli qui non arriverebbe comunque a chi li ha
 *   cambiati — cambierebbe solo il testo di partenza sotto i piedi di tutti
 *   gli altri. Il giorno del trasloco si cercano con `grep Scipioni`. */
export const INDIRIZZO_SEDE = "Via degli Scipioni 132, Roma";

/** ── LA RACCOLTA DEI RISULTATI ─────────────────────────────────────────────
 *  Il link ai casi reali che i tre messaggi del contatto di ritorno allegano.
 *  Sta in una costante perché è il valore di PARTENZA di tre testi: chi lo
 *  vuole cambiare lo cambia dal pannello (i modelli personalizzati vincono su
 *  questi), e quella modifica vale da subito senza pubblicare niente.
 *  ⚠️ È un indirizzo pubblico e statico (routes/media.$codice): chi lo riceve
 *   lo apre quando vuole, anche fra tre giorni. Non è il link «solo media»
 *   della diretta, che vale mentre il consulente sta mostrando qualcosa. */
export const LINK_RISULTATI = "https://hair-genius-hub.hair/media/DPKW-3JHV-RC77";

/** ── IL MESSAGGIO DI CHI STA DECIDENDO ────────────────────────────────────
 *
 *  Richiesta del committente: «il messaggio per quando è da ricontattare, o è
 *  in chat, o ci deve pensare, ecc ecc — tutti questi stati devono avere lo
 *  stesso messaggio», con il preventivo vero dentro e «se ha più preventivi,
 *  più link nello stesso messaggio».
 *
 *  ── PERCHÉ UNO SOLO, E NON QUATTRO ───────────────────────────────────────
 *  Sono quattro stati diversi in agenda — «Ricontatto fissato», «In
 *  valutazione», «Da gestire in chat», «Fissa meet dopo» — ma per il cliente
 *  sono lo stesso momento: la consulenza l'ha fatta, il preventivo ce l'ha, e
 *  deve decidere. Quattro testi diversi per quel momento non erano una
 *  sfumatura: erano quattro modi di dire la stessa cosa, e chi scriveva doveva
 *  ricordarsi quale stato aveva messo per sapere cosa sarebbe partito.
 *
 *  ── COM'È FATTO ──────────────────────────────────────────────────────────
 *  Quattro righe, in quest'ordine, e ognuna fa una cosa sola:
 *   1. chi scrive (il nome della persona, non «gentile cliente»);
 *   2. il PREVENTIVO, che è il motivo per cui questo messaggio esiste — e che
 *      prima non c'era in nessuno di quei quattro testi: si mandava un link
 *      alla raccolta dei lavori a chi aveva già fatto la consulenza;
 *   3. l'accordo che c'era («ci sentivamo oggi»), che è quello che rende il
 *      messaggio atteso invece che insistente;
 *   4. UNA domanda, e apre due strade sole: hai deciso, o ti serve altro.
 *
 *  ⚠️ NIENTE LINK AI RISULTATI QUI DENTRO. Vale per chi non ci conosce ancora;
 *   a chi ha passato un'ora in consulenza con noi dice «non mi ricordo chi
 *   sei», e allunga proprio il messaggio che deve restare corto.
 *  ⚠️ LA RIGA DEL PREVENTIVO SPARISCE DA SOLA se quella persona non ne ha
 *   (`{preventivi}` è facoltativo): il messaggio resta giusto anche lì. */
const DECIDENDO = `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs.\n\n{preventivi}\n\nEravamo rimasti che ci sentivamo {quando|in questi giorni}: hai deciso come procedere o ti servono altri chiarimenti?`;

export const MODELLI_ORIGINALI: Record<ChiaveModello, string> = {
  // ── ⚠️ SI DÀ DEL TU, E NON SI FIRMA ─────────────────────────────────────
  //  Due regole che valgono per TUTTI i testi qui sotto, chieste dal
  //  committente, e vanno tenute insieme perché insieme fanno il tono:
  //
  //  · DEL TU. Prima questi messaggi davano del Lei — anche quelli scritti a
  //    un cliente che aveva già fatto la consulenza e con cui al telefono ci si
  //    dà del tu da settimane. Due registri diversi fra la voce e la chat si
  //    notano, e fanno sembrare la chat scritta da un ufficio invece che dalla
  //    persona con cui si è parlato.
  //
  //  · NIENTE FIRMA IN FONDO. C'era «A presto, {consulente} — Hair Genius
  //    Labs» alla fine di ogni messaggio: su WhatsApp è una lettera, non un
  //    messaggio. Il nome di chi scrive sta già in cima alla chat, e ripeterlo
  //    ogni volta rende il tutto macchinoso e formale.
  //    ⚠️ Il modello `firma` RESTA DEFINITO qui sotto anche se nessun testo lo
  //     usa più: chi ha personalizzato un messaggio a mano può averci lasciato
  //     dentro `{firma}`, e togliendo la chiave a quel cliente arriverebbe la
  //     scritta «{firma}» tale e quale.
  //    ⚠️ E VIA ANCHE I CONGEDI. Le due conferme d'appuntamento finivano con
  //     «A presto.»: su WhatsApp una riga di saluto in fondo è la coda di una
  //     lettera, e soprattutto spinge sotto l'anteprima le due sole cose che
  //     quel messaggio deve consegnare — quando e il link. Chiudere sul link
  //     non è brusco: è quello che si tocca.
  //
  //  ⚠️ UNA DOMANDA CHIUSA, IN FONDO, E NIENTE GIRI. «Ti va bene se riproviamo
  //   domani?» e «Riproviamo domani?» chiedono la stessa cosa; la seconda si
  //   legge di sfuggita e si risponde con un sì. I giri di cortesia («ti va
  //   se», «preferisci che», «mi confermi che ci sarai») allungano la riga
  //   proprio dove il pollice sta già scorrendo.
  //
  //  ⚠️ E OGNI MESSAGGIO DEVE DIRE LA COSA VERA DEL SUO STATO. Non è un
  //   dettaglio di stile: «Ricontatto fissato» vuol dire che la consulenza È
  //   GIÀ STATA FATTA e che il cliente ha chiesto tempo per pensarci, e il
  //   testo di prima («come d'accordo ci risentiamo, mi conferma che va
  //   bene?») andava bene per un appuntamento telefonico mai avvenuto. A chi
  //   l'ha ricevuto sembrava che ci fossimo dimenticati della consulenza.
  firma: "A presto,\n{consulente}\nHair Genius Labs",

  // ── PRIMA DELLA CONSULENZA ──────────────────────────────────────────────
  //  ⚠️ QUI CHI SCRIVE SI PRESENTA, ed è l'unico messaggio che lo fa. Non è
  //   una firma: è il PRIMO messaggio, arriva da un numero che il telefono non
  //   conosce, e senza un nome davanti si legge come spam e non si risponde.
  //   Dal secondo in poi la chat ce l'ha già in cima, e ripeterlo diventa la
  //   lettera che questi testi non devono essere.
  da_contattare: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs. Hai richiesto informazioni sui nostri impianti capillari.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nCi sentiamo 5 minuti oggi pomeriggio?`,

  non_risponde: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — ho provato a chiamarti ma non ti ho trovato.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nTi richiamo più tardi o domani mattina?`,

  //  Diverso dal precedente di proposito: se non ha risposto due volte, due
  //  messaggi identici si notano e infastidiscono.
  segreteria: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — ti ho lasciato un messaggio in segreteria.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nRiprovo domani mattina?`,

  //  ⚠️ «Richiamo concordato» vuol dire che il cliente ha chiesto LUI di essere
  //   richiamato a un certo orario — e questo messaggio si manda quando a
  //   quell'orario il telefono ha squillato a vuoto. Dirgli «ti richiamo come
  //   d'accordo» dopo averci già provato è la frase di chi non ha chiamato:
  //   qui si dice che ci abbiamo provato e si rimette a lui la scelta
  //   dell'orario, che è l'unica cosa che serve per riprovare bene.
  richiamo: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — ti ho chiamato come d'accordo ma non sono riuscito a raggiungerti.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nQuando ti va bene che ti richiami?`,

  annullato: `Capito {nome}, nessun problema — sono {consulente|un consulente} di Hair Genius Labs.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nSe più avanti vorrai riparlarne, scrivimi qui.`,

  // ── APPUNTAMENTO ────────────────────────────────────────────────────────
  //  Il link è quello della NOSTRA stanza, generato quando l'appuntamento
  //  viene fissato: dentro c'è il preventivo che si compone in diretta, le
  //  slide e la registrazione. Mandarlo subito toglie di mezzo il passaggio
  //  "poi ti arriva il link", che è quello in cui si perde la gente.
  //  ── LA CONFERMA SI LEGGE IN TRE SECONDI ────────────────────────────────
  //   Sintetica e chiara a colpo d'occhio: fra il cliente e l'unica cosa che
  //   deve sapere — QUANDO e DOVE — non ci va nemmeno una frase. Su WhatsApp
  //   la seconda riga è già sotto l'anteprima, e quello che sta dopo lo legge
  //   una persona su tre. Le informazioni stanno su righe separate apposta: si
  //   ritrovano scorrendo la chat il giorno dell'appuntamento.
  appuntamento_fissato: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — appuntamento confermato.\n\n{quando|come concordato}\n{link}`,

  //  ── L'APPUNTAMENTO DI CHI ERA GIÀ IN ARCHIVIO ─────────────────────────
  //   A questa persona abbiamo già scritto almeno una volta. Rimandarle il
  //   messaggio del primo appuntamento la tratta come se non ci fossimo mai
  //   sentiti, ed è la riga che fa rispondere «ma io vi avevo già detto di no».
  //   Cambia una parola — «nuovo appuntamento» — perché è l'unica cosa che il
  //   cliente deve notare, cioè che la data di prima non vale più.
  appuntamento_rifissato: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — nuovo appuntamento confermato.\n\n{quando|come concordato}\n{link}`,

  // ── IL LINK, DA SOLO ────────────────────────────────────────────────────
  //  Serve quando il link va rimandato fuori dal momento in cui si fissa: il
  //  cliente l'ha perso nella chat, o si collega da un altro telefono, o è
  //  l'ora e non è ancora entrato.
  //  Perché dice per prima cosa che non si scarica niente: è LA domanda che
  //  fanno tutti, e chi non se lo sente dire dà per scontato di dover
  //  installare un'applicazione. A quel punto rimanda, e rimandare vuol dire
  //  non presentarsi.
  link_consulenza:
    //  ⚠️ NIENTE SEGNAPOSTO DENTRO UN SEGNAPOSTO: il testo di riserva è
    //  dichiarato senza graffe (vedi RE_SEGNAPOSTO), quindi una forma come
    //  "{quando| di {quando}}" non veniva riconosciuta e finiva nel messaggio
    //  tale e quale, davanti al cliente. Il quando sta su una frase sua.
    "Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — ecco il link per la consulenza:\n{link}\n\nCi vediamo {quando|all'orario che ci siamo detti}.\n\nTi basta aprirlo dal telefono o dal computer: non devi installare nulla.\n\nSe hai problemi ad accedere, scrivimi qui.",

  /*  ── ⚠️ I TRE MESSAGGI DEL CONTATTO DI RITORNO ────────────────────────
      Tre parti, in quest'ordine:
       1. CHI SCRIVE, COM'È ANDATA E PERCHÉ HA IL SUO NUMERO — tutto nella
          prima riga, e CAMBIA CON IL CASO: «la consulenza che avevamo fissato
          è saltata», «hai già una consulenza fissata», «non l'abbiamo ancora
          fatta», «l'abbiamo già fatta». Richiesta del committente: «in base
          alla motivazione del ritorno deve mettere il messaggio corretto».
          È la riga che regge tutto: chi legge non si ricorda di noi, e la
          prima domanda che si fa chiunque davanti a un numero sconosciuto è
          «questi come mi hanno trovato?». Il modulo la chiude prima che se la
          faccia; il «cos'era successo» gli dice che non stiamo ricominciando
          da capo — e che dall'altra parte qualcuno sa chi è.
          ⚠️ «HAI chiesto», non «avevi chiesto»: la richiesta dal modulo è di
           adesso, ed è il motivo per cui gli stiamo scrivendo oggi.
          ⚠️ E CHE COSA FACCIAMO, in tutti e quattro: «la soluzione non
           chirurgica contro la calvizie». Richiesta del committente, e regge
           il messaggio quanto il resto: chi ha compilato un modulo mesi fa si
           ricorda del problema, non del nome dell'azienda — un nome da solo
           lo obbliga a cercare chi siamo prima di decidere se rispondere, e
           quasi nessuno lo fa. «Non chirurgica» sta lì apposta: è la prima
           obiezione di chi ha paura del trapianto, e toglierla dalla prima
           riga vale più di qualunque frase in fondo.
       2. LA DOMANDA: le SUE disponibilità, non un giorno proposto da noi.
          ⚠️ Richiesta del committente — «chiedi a lui disponibilità e poi noi
           controlliamo in agenda» — ed è giusta anche meccanicamente:
           proporre un orario da un messaggio vuol dire prenotarlo senza averlo
           guardato in agenda, e se qualcuno nel frattempo l'ha preso la prima
           cosa che quel cliente sente da noi è un dietrofront.
       3. I RISULTATI, in fondo e su una riga sola.
      ⚠️ CORTI, ed è una scelta: «rendi breve ma che si capisce, non scrivere
       troppo testo». WhatsApp mostra le prime righe in anteprima e il resto lo
       apre solo chi è già interessato — un messaggio che comincia con tre
       righe di premessa viene giudicato prima di essere letto. Prima i
       risultati stavano in mezzo, PRIMA della domanda: il messaggio era più
       lungo e la domanda finiva sotto il link, dove si legge per ultima.
      ⚠️ Il link sta su una RIGA SUA: incollato in mezzo a una frase, WhatsApp
       lo attacca alla parola che segue e l'anteprima non parte.
      ⚠️ `{consulente|un consulente}` con il testo di riserva: senza la riserva,
       su una scheda senza consulente assegnato sparirebbe l'intera prima riga
       — cioè il saluto e la presentazione (vedi la regola 1 dei segnaposto). */
  ritorno_sospeso: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs, la soluzione non chirurgica contro la calvizie: la consulenza che avevamo fissato per {quando|qualche tempo fa} è saltata, e adesso hai chiesto di essere ricontattato dal modulo sul nostro sito.\n\nDimmi le tue disponibilità e controllo in agenda.\n\nRisultati veri di nostri clienti:\n${LINK_RISULTATI}`,

  //  ⚠️ A chi la consulenza ce l'ha ANCORA DAVANTI non si scrive «è rimasta in
  //   sospeso»: fra i contatti di ritorno ci sono anche appuntamenti da fare, e
  //   dargli per saltato un appuntamento che c'è ancora è una figuraccia.
  ritorno_futuro: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs, la soluzione non chirurgica contro la calvizie: hai chiesto di essere ricontattato dal modulo sul nostro sito, e hai già una consulenza fissata per {quando|come concordato}.\n\nTi va ancora bene? Se no dimmi le tue disponibilità e controllo in agenda.\n\nRisultati veri di nostri clienti:\n${LINK_RISULTATI}`,

  //  ⚠️ E a chi un appuntamento non l'ha MAI preso non si nomina nessuna data:
  //   sarebbe raccontargli una cosa mai successa. Per questo qui dentro
  //   `{quando}` non c'è affatto.
  ritorno_mai: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs, la soluzione non chirurgica contro la calvizie: hai chiesto di essere ricontattato dal modulo sul nostro sito, e la consulenza non l'abbiamo ancora fatta.\n\nDimmi le tue disponibilità e controllo in agenda.\n\nRisultati veri di nostri clienti:\n${LINK_RISULTATI}`,

  /*  ── ⚠️ E QUELLO A CHI LA CONSULENZA L'HA GIÀ FATTA ──────────────────
      Richiesta del committente: «se ho già fatto consulenza deve dire che
      l'abbiamo già fatta e se vuole altre info possiamo risentirci».
      Era il buco più grosso dei tre di prima: a chi si era seduto un'ora con
      un consulente arrivava «la consulenza non l'abbiamo ancora fatta» — cioè
      la prova, in una riga, che dall'altra parte nessuno si ricorda di lui.
      ⚠️ Quando la consulenza è stata fatta lo dice `eStatoNonSvolta`
       (crm/types), non un elenco scritto qui: NON svolta sono solo «Cliente
       assente» e «Da riprogrammare» — «quelli che non si presentano sono solo
       quelli assenti o da spostare», parole del committente — e tutto il resto
       (ricontatto fissato, lead in chat, in valutazione, venduto…) è una
       consulenza avvenuta. Un secondo elenco qui dentro si sarebbe scostato da
       quello al primo stato nuovo. */
  ritorno_fatta: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs, la soluzione non chirurgica contro la calvizie: la consulenza l'abbiamo già fatta {giorno|insieme}, e adesso hai chiesto di essere ricontattato dal modulo sul nostro sito.\n\nSe ti servono altre informazioni possiamo risentirci: dimmi le tue disponibilità e controllo in agenda.\n\nRisultati veri di nostri clienti:\n${LINK_RISULTATI}`,

  //  Consulenza svolta: la domanda serve a far uscire il dubbio adesso,
  //  finché è ancora piccolo, invece di scoprirlo fra una settimana.
  fatto: `{nome}, sono {consulente|un consulente} di Hair Genius Labs: grazie per il tempo di oggi.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nHai qualche dubbio sull'impianto capillare?`,

  //  ⚠️ STESSO TESTO DI `no_show`, e di proposito: sono lo stesso fatto —
  //   l'appuntamento non c'è stato — detto da due stati, uno storico e uno in
  //   uso. Due testi diversi per la stessa cosa vorrebbero dire che, a seconda
  //   di quanto è vecchia la scheda, al cliente arriva un messaggio diverso.
  non_fatto: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — oggi non ci siamo trovati, capita.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nRiproviamo domani alla stessa ora?`,

  da_spostare: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — dobbiamo spostare l'appuntamento.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nDomani alla stessa ora va bene?`,

  no_show: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — oggi non ci siamo trovati, capita.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nRiproviamo domani alla stessa ora?`,

  // ── TRATTATIVA APERTA ───────────────────────────────────────────────────
  //  ⚠️ Si manda a chi ha già avuto la consulenza e il preventivo: non ripete
  //   nulla e non rivende, chiede solo a che punto è il pensiero. Breve, e
  //   senza il «gentile cliente» che trasforma una chat in una lettera.
  //  ⚠️ STESSO TESTO PER I QUATTRO STATI DI CHI STA DECIDENDO (vedi
  //   `DECIDENDO`): per il cliente sono lo stesso momento, e quattro testi
  //   diversi erano quattro modi di dire la stessa cosa.
  sta_valutando: DECIDENDO,

  //  ── ⚠️ QUESTO STATO VIENE DOPO LA CONSULENZA, E IL TESTO NON LO DICEVA ──
  //   «Ricontatto fissato» significa una cosa precisa: la consulenza è stata
  //   fatta, il cliente ha detto che ci voleva pensare, e si è concordato
  //   quando risentirsi. Il messaggio di prima — «come d'accordo ci risentiamo
  //   {quando}, mi conferma che va bene?» — era quello di un appuntamento
  //   telefonico mai avvenuto: a chi aveva appena passato un'ora con noi
  //   sembrava che ce ne fossimo dimenticati.
  //   Adesso il messaggio nomina la consulenza, dice che prendersi tempo è
  //   giusto (chi ha chiesto tempo si aspetta di essere incalzato, e non
  //   esserlo è la cosa che lo fa restare), ricorda quando ci si risente e
  //   lascia una porta per i dubbi che nascono nei giorni in mezzo — che sono
  //   quelli che, senza una risposta, diventano un no.
  //  ⚠️ IL MESSAGGIO DELLO STATO È QUELLO DEL GIORNO DEL RICONTATTO, non
  //   l'annuncio del richiamo. Questo tasto si preme QUANDO IL RICONTATTO È
  //   OGGI — è il giorno in cui quella scheda compare fra le cose da fare — e
  //   lì «come d'accordo ci sentiamo giovedì» suona come se ci fossimo
  //   dimenticati di chiamare. L'accordo si prende a voce o in coda alla
  //   consulenza; qui si mantiene.
  //  ⚠️ La domanda è APERTA, contro la regola generale di questo file, e la
  //   deroga è voluta: dopo giorni di silenzio un sì/no chiude la
  //   conversazione proprio nel momento in cui serve farla ripartire.
  da_ricontattare: DECIDENDO,

  fissa_meet_dopo: DECIDENDO,

  /*  ── CI RICONTATTA LUI ───────────────────────────────────────────────
      La palla ce l'ha il cliente: ha detto che si fa vivo lui. Il messaggio
      non lo incalza e non gli chiede niente — sarebbe esattamente il contrario
      di quello che ha chiesto — ma lascia scritto nero su bianco DOVE
      scrivere, perché «ti faccio sapere io» muore quasi sempre lì: non per un
      no, ma perché quando decide non ha più sottomano il numero giusto.
      ⚠️ Niente domanda finale: a chi ha chiesto lui di gestire i tempi, una
       domanda rimette addosso la fretta da cui si era tolto. */
  ci_ricontatta_lui: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs. Nessuna fretta: resto a disposizione e aspetto un tuo messaggio {quando|quando te la senti}.\n\nIntanto ti lascio qui i risultati veri di alcuni nostri clienti, così puoi farti un'idea con calma:\n${LINK_RISULTATI}\n\nQuando vuoi, scrivimi pure su questo numero.`,

  viene_in_sede: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — ti aspettiamo {quando|nei prossimi giorni} in ${INDIRIZZO_SEDE}.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nMi confermi che ci sei?`,

  //  ── VISITA DISDETTA ─────────────────────────────────────────────────
  //   Chi disdice si aspetta fastidio, e la maggior parte delle volte non
  //   risponde più proprio per evitarlo. Il messaggio fa il contrario: toglie
  //   ogni imbarazzo e propone una data nuova, che è l'unica cosa che serve.
  //   Nessuna domanda sul perché: chi vuole dirlo lo dice da sé.
  sede_disdetta: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — nessun problema per {quando|l'appuntamento che avevamo preso}.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nQuando ti sarebbe più comodo passare?`,

  gestire_in_chat: DECIDENDO,

  // ── SOLDI ───────────────────────────────────────────────────────────────
  in_attesa_acconto: `{nome}, sono {consulente|un consulente} di Hair Genius Labs: per bloccare la produzione del tuo impianto manca solo l'acconto.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nTi mando qui i dati per il bonifico?`,

  //  ── HA CAMBIATO IDEA ──────────────────────────────────────────────────
  //   Il messaggio più difficile del file, e per questo il più corto. Non
  //   insiste, non chiede perché e non prova a rivendere: chi si è appena
  //   tirato indietro ha già detto no una volta, e un secondo tentativo nello
  //   stesso messaggio è quello che fa cancellare il numero. Lascia però la
  //   porta aperta senza scadenza — una decisione cambiata una volta può
  //   cambiare di nuovo, e questa è la sola frase che permette di richiamarlo
  //   fra sei mesi senza ricominciare da zero.
  ripensamento: `Nessun problema {nome} — sono {consulente|un consulente} di Hair Genius Labs.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nSe più avanti vorrai riparlarne, scrivimi pure.`,

  acconto: `{nome}, sono {consulente|un consulente} di Hair Genius Labs: acconto ricevuto, grazie! Procediamo con la produzione del tuo impianto.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nTi confermo le tempistiche appena ho la data.`,

  //  L'unico messaggio in cui la domanda serve a fissare il passo dopo: un
  //  "benvenuto" senza data lascia la consegna a "quando ci si sente".
  //  ⚠️ Stato STORICO: non si assegna più (lo dicono per intero le tre chiusure
  //  qui sotto), ma il modello RESTA. In archivio ci sono schede "venduto" a
  //  centinaia e da quelle si scrive ancora: togliere il testo avrebbe mandato
  //  a quei clienti il MODELLO_RIPIEGO, cioè un "Ciao Mario," e basta.
  venduto: `{nome}, sono {consulente|un consulente} di Hair Genius Labs: benvenuto tra noi!\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nCi sentiamo domani per fissare l'installazione?`,

  // ── LE TRE CHIUSURE VINTE ───────────────────────────────────────────────
  //  Sostituiscono l'unico "venduto" e dicono ciascuna il passo dopo, che è
  //  DIVERSO nei tre casi: chi viene da noi deve sapere che si fissa un giorno
  //  e dove siamo, chi ci riceve a casa deve sapere che serve il suo indirizzo,
  //  chi riceve un pacco deve sapere che non deve aspettare nessuno.
  //  ⚠️ Nessuno dei tre usa {quando}: quando si chiude la vendita la data della
  //  posa non c'è ancora (la si programma dopo, dalle installazioni), e la
  //  riserva di quandoDelModello ripiegherebbe sulla data della CONSULENZA —
  //  cioè si prometterebbe al cliente un'installazione per un giorno già
  //  passato. La data la porta il messaggio dell'installazione, non questo.
  posa_in_sede: `{nome}, sono {consulente|un consulente} di Hair Genius Labs: benvenuto tra noi! L'installazione del tuo impianto sarà nel nostro centro, in ${INDIRIZZO_SEDE}.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nTi propongo due date?`,

  posa_a_domicilio: `{nome}, sono {consulente|un consulente} di Hair Genius Labs: benvenuto tra noi! Per l'installazione veniamo noi da te.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nMi confermi indirizzo e giorni disponibili?`,

  posa_da_spedire: `{nome}, sono {consulente|un consulente} di Hair Genius Labs: benvenuto tra noi! Prepariamo il tuo impianto e te lo spediamo.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nMi confermi l'indirizzo di consegna?`,

  // ── IL CLIENTE CHE SI È ZITTITO ─────────────────────────────────────────
  //  Ha avuto la consulenza e il preventivo, e da lì in poi silenzio. È
  //  l'unico messaggio scritto per NON ottenere una risposta subito: chi non
  //  risponde da settimane sta evitando la conversazione, e insistere ("sei
  //  ancora interessato?", "posso chiamarti?") gli dà l'unica cosa che gli
  //  serve per chiuderla del tutto. Qui si dice che il preventivo è ancora
  //  valido e si smette di chiedere: la porta resta aperta e la mossa è sua.
  //  ⚠️ NON è il modello di "non_risponde": quello parla a un numero che
  //  squilla a vuoto e chiede quando richiamare, perché lì la telefonata non è
  //  ancora avvenuta. Qui ci si è già parlati a lungo, e chiederlo di nuovo
  //  suonerebbe come se non ce ne ricordassimo.
  irreperibile: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — non ti disturbo oltre. Il preventivo per il tuo impianto capillare resta valido.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nQuando vuoi riprendere, scrivimi qui.`,

  // ── CHIUSURE ────────────────────────────────────────────────────────────
  perdi_tempo: `{nome}, sono {consulente|un consulente} di Hair Genius Labs: grazie comunque per il tempo dedicato.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}`,

  concluso: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — è stato un piacere seguirti.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nPer qualsiasi cosa, anche più avanti, scrivimi qui.`,

  // ── PROMEMORIA DEL GIORNO PRIMA ─────────────────────────────────────────
  //  Cinque righe, non dieci: ricorda quando, dà il link, dice l'unica cosa da
  //  preparare e chiede conferma. È il messaggio che riduce le assenze, quindi
  //  deve poter essere letto tutto in una schermata del telefono.
  //  "Partner" e non "moglie/compagno": chi decide insieme a qualcuno lo sa da
  //  sé, e "partner" non sbaglia mai destinatario.
  promemoria:
    "Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — ti ricordo il nostro appuntamento di {quando|oggi}.\n\nLink: {link|te lo mando poco prima}\n\nSe puoi, collegati da un posto tranquillo e con una buona connessione. Se possibile, anche insieme al tuo partner.\n\nMi confermi che ci sei?",

  /*  ── ⚠️ IL PROMEMORIA DI CHI VIENE DA NOI ───────────────────────────────
      Niente link e niente «collegati»: questa persona prende la macchina.
      Quello che le serve è l'indirizzo e l'ora, e il messaggio del giorno
      prima è il posto in cui rileggerli senza cercare nella chat.
      ⚠️ Nessuna raccomandazione sulla connessione, ovviamente — ma nemmeno
       sul partner: in studio si viene accompagnati o no, e invitare qualcuno a
       portare una persona in un luogo fisico è una cosa diversa dal dirgli di
       accendere la webcam in due. */
  promemoria_sede: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — ti ricordo il nostro appuntamento di {quando|domani} in ${INDIRIZZO_SEDE}.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nSe hai bisogno di indicazioni scrivimi pure. Mi confermi che ci sei?`,

  /*  ── ⚠️ IL PROMEMORIA DI CHI ASPETTA UNA TELEFONATA ─────────────────────
      Non è un appuntamento e non ha un posto: è una chiamata che facciamo
      NOI. Dirgli «ti ricordo il nostro appuntamento» lo manda a cercare un
      link che non esiste; dirgli «mi confermi che ci sei?» gli chiede di
      esserci da qualche parte.
      Qui si annuncia la chiamata e si chiede solo se l'ora va bene — che è
      l'unica cosa che può ancora cambiare. */
  promemoria_richiamo: `Ciao {nome}, sono {consulente|un consulente} di Hair Genius Labs — come d'accordo ti chiamo io {quando|nei prossimi giorni}.\n\nQui trovi i risultati veri di alcuni nostri clienti, così sai con chi stai parlando:\n${LINK_RISULTATI}\n\nTi va bene come orario, o preferisci che ci sentiamo in un altro momento?`,
};

/** Come si chiama ogni modello nell'editor. Per gli stati l'etichetta arriva da
 *  types.ts (una sola fonte); qui ci sono solo i due che stati non sono. */
export const ETICHETTA_MODELLO_EXTRA: Record<
  | "promemoria"
  | "promemoria_sede"
  | "promemoria_richiamo"
  | "firma"
  | "link_consulenza"
  | "ritorno_sospeso"
  | "ritorno_futuro"
  | "ritorno_mai"
  | "ritorno_fatta",
  string
> = {
  promemoria: "Promemoria · consulenza online",
  promemoria_sede: "Promemoria · visita in studio",
  promemoria_richiamo: "Promemoria · richiamo telefonico",
  firma: "Firma (vale per tutti)",
  link_consulenza: "Link della consulenza",
  ritorno_sospeso: "Di ritorno · consulenza saltata",
  ritorno_futuro: "Di ritorno · consulenza ancora da fare",
  ritorno_mai: "Di ritorno · senza appuntamento",
  ritorno_fatta: "Di ritorno · consulenza già fatta",
};

/** Modello usato quando lo stato non ne ha uno: meglio una riga corretta di un
 *  messaggio vuoto che parte per sbaglio.
 *  ⚠️ DAVA DEL LEI mentre tutti gli altri danno del tu: se fosse mai partito,
 *   sarebbe arrivato a una persona con cui al telefono ci si dà del tu da
 *   settimane — e si sarebbe notato subito. Oggi ogni stato ha il suo testo e
 *   questa riga non dovrebbe uscire mai: ma è proprio per questo che va
 *   scritta bene, perché nessuno la sta guardando. */
const MODELLO_RIPIEGO = "Ciao {nome},";

/* ── QUALE DATA FINISCE IN {quando} ────────────────────────────────────────
   Ogni messaggio parla di UNA data sola, e quale sia lo dice lo stato: il
   richiamo usa la data del ricontatto, la conferma usa quella della consulenza,
   la visita usa quella in sede. Senza questa tabella si sarebbe dovuto
   inventare un segnaposto diverso per ogni data — cinque nomi da ricordare per
   scrivere una frase. */
const CAMPI_QUANDO: Partial<Record<ChiaveModello, [keyof LeadData, keyof LeadData]>> = {
  richiamo: ["dataRicontatto", "oraRicontatto"],
  da_ricontattare: ["dataRicontatto", "oraRicontatto"],
  //  È la data entro cui ha detto che si fa vivo: è l'unica data di cui
  //  parlare con lui.
  ci_ricontatta_lui: ["dataRicontatto", "oraRicontatto"],
  sta_valutando: ["dataRicontatto", "oraRicontatto"],
  appuntamento_fissato: ["dataMeeting", "oraMeeting"],
  //  Un appuntamento rifissato ha data e ora negli stessi campi: senza questa
  //  riga il "{quando}" del messaggio resterebbe muto proprio nel messaggio in
  //  cui si sta comunicando il nuovo giorno.
  appuntamento_rifissato: ["dataMeeting", "oraMeeting"],
  //  La data è FACOLTATIVA qui: il link si manda anche senza dire quando,
  //  per esempio dieci minuti prima di iniziare.
  link_consulenza: ["dataMeeting", "oraMeeting"],
  promemoria: ["dataMeeting", "oraMeeting"],
  //  Ogni promemoria guarda la SUA data: quella della visita in studio, quella
  //  del richiamo. Con una sola tabella qui sotto il resto viene da sé.
  promemoria_sede: ["dataVieneInSede", "oraVieneInSede"],
  promemoria_richiamo: ["dataRicontatto", "oraRicontatto"],
  no_show: ["dataMeeting", "oraMeeting"],
  non_fatto: ["dataMeeting", "oraMeeting"],
  da_spostare: ["dataMeeting", "oraMeeting"],
  viene_in_sede: ["dataVieneInSede", "oraVieneInSede"],
  //  La data della visita disdetta serve al messaggio ("l'appuntamento di
  //  giovedì"): senza, si scriverebbe "di questi giorni" a chi ricorda benissimo
  //  quale giorno aveva preso.
  sede_disdetta: ["dataVieneInSede", "oraVieneInSede"],
};

function quandoDelModello(d: LeadData, chiave: ChiaveModello): string {
  const campi = CAMPI_QUANDO[chiave];
  if (campi) {
    const [cd, co] = campi;
    const q = quandoEOra(d[cd] as string | undefined, d[co] as string | undefined);
    if (q) return q;
  }
  //  Nessuna data pertinente: si prende la prima che c'è. Serve a chi aggiunge
  //  {quando} a un messaggio che prima non ne aveva, senza dover sapere quale
  //  campo sia collegato a quello stato.
  return (
    quandoEOra(d.dataMeeting, d.oraMeeting) ||
    quandoEOra(d.dataRicontatto, d.oraRicontatto) ||
    quandoEOra(d.dataVieneInSede, d.oraVieneInSede)
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. I MODELLI MODIFICATI DALL'UTENTE
   ═════════════════════════════════════════════════════════════════════════ */

/** La chiave di app_config in cui la pagina WhatsApp salva i testi modificati.
 *  Sta qui e non nella pagina perché chi legge i modelli e chi li scrive devono
 *  puntare allo stesso posto: due costanti uguali scritte in due file diversi
 *  divergono al primo rinominare. */
export const CHIAVE_CONFIG_MODELLI = "wa_messaggi_stato";

//  Copia locale dei modelli modificati. Serve a un motivo preciso: gli stessi
//  testi vengono composti da otto pagine diverse (agenda, trattative, scheda
//  cliente, area consulenti…) che NON possono aspettare una lettura dal
//  database per disegnare un pulsante "Scrivi su WhatsApp". La verità resta il
//  database — questa è solo la scorciatoia per averli subito, e viene
//  riallineata ogni volta che la pagina WhatsApp li carica o li salva.
const CHIAVE_CACHE = "hg.wa.modelli";

let personalizzati: Partial<Record<ChiaveModello, string>> = leggiCache();

function leggiCache(): Partial<Record<ChiaveModello, string>> {
  //  Durante il render sul server `localStorage` non esiste: senza questa
  //  guardia la pagina non si genererebbe affatto.
  if (typeof window === "undefined") return {};
  try {
    const grezzo = window.localStorage.getItem(CHIAVE_CACHE);
    return grezzo ? (JSON.parse(grezzo) as Partial<Record<ChiaveModello, string>>) : {};
  } catch {
    return {};
  }
}

/** Sostituisce i modelli in uso. La chiama la pagina WhatsApp dopo aver letto o
 *  salvato la configurazione: da quel momento TUTTE le pagine compongono i
 *  messaggi con i testi nuovi, senza ricaricare il CRM. */
export function impostaModelliPersonalizzati(
  mappa: Partial<Record<ChiaveModello, string>> | null | undefined,
): void {
  personalizzati = mappa ?? {};
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHIAVE_CACHE, JSON.stringify(personalizzati));
  } catch {
    //  Spazio esaurito o navigazione privata: si continua con i modelli in
    //  memoria. Un messaggio composto col testo originale è un problema molto
    //  minore di una pagina che non si apre.
  }
}

/** Il modello attualmente in uso per una chiave: quello modificato se c'è,
 *  altrimenti l'originale. Un testo svuotato per sbaglio NON diventa un
 *  messaggio vuoto: torna l'originale. */
export function modelloDi(chiave: ChiaveModello): string {
  const p = personalizzati[chiave];
  if (typeof p === "string" && p.trim()) return p;
  /*  ── ⚠️ I QUATTRO CHE CONDIVIDONO IL TESTO LO CONDIVIDONO ANCHE QUANDO
      LO SI CORREGGE. Senza questa riga i quattro stati di chi sta decidendo
      partono uguali (vedi `DECIDENDO`) e si separano al primo ritocco: si
      corregge «Ricontatto fissato» dal pannello, e agli altri tre continua ad
      arrivare il testo di prima. Chi ha chiesto «lo stesso messaggio» non si
      aspetta che valga solo finché nessuno lo tocca.
      ⚠️ La personalizzazione del singolo stato VINCE COMUNQUE (è il controllo
       qui sopra): chi vuole differenziarne uno può ancora farlo, e chi l'aveva
       già fatto non se lo vede cancellare. */
  const capofila = CAPOFILA[chiave];
  if (capofila) {
    const pc = personalizzati[capofila];
    if (typeof pc === "string" && pc.trim()) return pc;
  }
  return MODELLI_ORIGINALI[chiave] ?? MODELLO_RIPIEGO;
}

/** Chi segue il testo di chi. ⚠️ DERIVATO DAI MODELLI, non un secondo elenco:
 *  gli stati che partono con lo stesso identico testo di `da_ricontattare`
 *  sono quelli che lo seguono anche dopo una correzione. Il giorno in cui uno
 *  dei quattro prende un testo suo, esce da qui da solo. */
export const CAPO_DECIDENDO: ChiaveModello = "da_ricontattare";
const CAPOFILA: Partial<Record<ChiaveModello, ChiaveModello>> = (() => {
  const testo = MODELLI_ORIGINALI[CAPO_DECIDENDO];
  const out: Partial<Record<ChiaveModello, ChiaveModello>> = {};
  for (const k of Object.keys(MODELLI_ORIGINALI) as ChiaveModello[]) {
    if (k !== CAPO_DECIDENDO && MODELLI_ORIGINALI[k] === testo) out[k] = CAPO_DECIDENDO;
  }
  return out;
})();

/** Gli stati che seguono il testo di un altro: l'editor lo scrive accanto al
 *  testo, perché chi lo corregge deve sapere che sta correggendo anche gli
 *  altri tre. */
export const SEGUE_IL_TESTO_DI = (chiave: ChiaveModello): ChiaveModello | null =>
  CAPOFILA[chiave] ?? null;

/** Tutti i modelli in uso, per l'editor. */
export function modelliCorrenti(): Record<ChiaveModello, string> {
  const out = {} as Record<ChiaveModello, string>;
  (Object.keys(MODELLI_ORIGINALI) as ChiaveModello[]).forEach((k) => {
    out[k] = modelloDi(k);
  });
  return out;
}

/** Quali modelli sono stati modificati rispetto all'originale: l'editor lo
 *  segnala, così si sa sempre cosa è stato toccato e da dove si torna indietro. */
export function modelloModificato(chiave: ChiaveModello, testo: string): boolean {
  return testo.trim() !== (MODELLI_ORIGINALI[chiave] ?? "").trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. COMPOSIZIONE — l'unico posto dove i segnaposto diventano testo
   ═════════════════════════════════════════════════════════════════════════ */

export interface ValoriMessaggio {
  nome?: string;
  cognome?: string;
  consulente?: string;
  quando?: string;
  /** Solo il giorno, senza l'ora: per le cose già successe (vedi SEGNAPOSTI). */
  giorno?: string;
  link?: string;
  /** Il blocco dei preventivi di questa persona, già composto. */
  preventivi?: string;
}

/** Compone un modello con i valori veri.
 *  Il lavoro si fa riga per riga perché la regola che conta è di riga: un
 *  segnaposto facoltativo rimasto vuoto porta via con sé la riga intera. */
export function componiMessaggio(
  modello: string,
  valori: ValoriMessaggio,
  /** i segnaposto già espansi: impedisce a {firma} di richiamare se stessa */
  espandiFirma = true,
): string {
  const base = espandiFirma
    ? modello.replace(/\{firma\}/g, () => componiMessaggio(modelloDi("firma"), valori, false))
    : modello;

  const righe = base.split("\n");
  const tenute: string[] = [];

  for (const riga of righe) {
    let saltaRiga = false;
    const composta = riga.replace(RE_SEGNAPOSTO, (intero, chiave: string, riserva?: string) => {
      if (!CONOSCIUTI.has(chiave)) return intero; // sconosciuto: resta com'è, e si vede
      const valore = (valori[chiave as keyof ValoriMessaggio] ?? "").toString().trim();
      if (valore) return valore;
      if (riserva !== undefined) return riserva;
      if (FACOLTATIVI.has(chiave)) saltaRiga = true;
      return "";
    });
    if (!saltaRiga) tenute.push(composta);
  }

  return (
    tenute
      .join("\n")
      //  Togliendo una riga si possono creare tre a capo di fila: sul telefono
      //  diventano un buco in mezzo al messaggio.
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+$/gm, "")
      .trim()
  );
}

/* ── I PREVENTIVI DI CIASCUNO, LETTI UNA VOLTA SOLA ────────────────────────
   Il blocco `{preventivi}` non si può comporre qui: sta in un'altra tabella, e
   `getWhatsAppMessageForStatus` viene chiamata mentre si DISEGNA una riga di
   elenco — una lettura a database per ogni riga sarebbe il guasto già visto
   col tetto giornaliero delle richieste.
   Perciò si fa come con i modelli personalizzati qui sopra: chi ha già
   l'archivio in mano lo legge una volta e lo deposita qui (lo fa CRMContext,
   in sottofondo, dopo aver caricato le trattative); i messaggi lo trovano
   pronto, senza chiedere niente a nessuno.
   ⚠️ SE NON C'È, IL MESSAGGIO ESCE SENZA QUELLA RIGA e non rotto: il
    segnaposto è facoltativo e si porta via la sua riga. Un messaggio senza il
    link è incompleto; un messaggio con dentro «{preventivi}» è una figuraccia. */
let linkPreventivi: Record<string, string> = {};

/** Deposita i link dei preventivi, per identificativo di trattativa. */
export function impostaLinkPreventivi(mappa: Record<string, string> | null | undefined): void {
  linkPreventivi = mappa ?? {};
}

/** Il blocco dei preventivi di questa trattativa, se qualcuno l'ha depositato. */
export function linkPreventiviDi(leadId: string | null | undefined): string {
  return linkPreventivi[String(leadId ?? "")] ?? "";
}

/** I valori veri di una trattativa, pronti per la composizione. */
export function valoriDaLead(
  lead: Lead,
  chiave: ChiaveModello,
  consulente?: string,
): ValoriMessaggio {
  const d = lead.data;
  return {
    nome: d.nome || "",
    cognome: d.cognome || "",
    consulente: consulente || "",
    quando: quandoDelModello(d, chiave),
    //  ── ⚠️ IL LINK SPARIVA DAL MESSAGGIO DI CONFERMA ─────────────────────
    //   `linkStanzaDi` risponde SOLO per le stanze nostre (/meetly/<codice>):
    //   su un appuntamento con un link esterno già scritto in scheda — un
    //   Google Meet, una stanza di un altro strumento — tornava vuoto, e il
    //   segnaposto {link} usciva muto. Il cliente riceveva «ci vediamo
    //   giovedì» e nessun posto dove andare, e nessuno se ne accorgeva
    //   scrivendo, perché il messaggio si legge già mandato.
    //   Il ripiego è il link scritto in scheda così com'è, purché sia un
    //   indirizzo vero: qui serve un posto dove il cliente entra, non una
    //   stanza di un tipo particolare.
    /*  ── ⚠️ UN LINK PER CIASCUNO ────────────────────────────────────────
        Segnalazione del committente: «quando invio il link alle 3 persone
        della consulenza deve generare un link univoco per ogni persona,
        perché ora mette a tutti lo stesso nome».
        La stanza resta una sola — tre persone alla stessa ora sono UNA
        consulenza — ma il link adesso dice anche CHI lo riceve: senza, tutti
        e tre arrivavano senza nome, e con più di una persona attesa il
        programma non può indovinare chi è chi (aprirebbe a uno il preventivo
        di un altro). Vedi shop/chi-dal-link. */
    link:
      linkPerPersona(linkStanzaDi(d), gettoneDi({ leadId: lead.id, nome: d.nome || "" })) ||
      linkEsterno(d),
    //  Il preventivo vero di questa persona: lo ha depositato chi ha letto
    //  l'archivio (vedi `impostaLinkPreventivi`).
    preventivi: linkPreventiviDi(lead.id),
  };
}

/** ── IL LINK DELLA STANZA, RIPULITO ────────────────────────────────────────
 *  Nell'archivio importato dal CRM precedente molti appuntamenti hanno ancora
 *  un link di Google Meet: stanze che non esistono più e che non sono nostre.
 *  Mandarne uno a un cliente significa mandarlo davanti a una porta chiusa
 *  mentre il consulente lo aspetta dall'altra parte.
 *
 *  Qui il link viene ricostruito SEMPRE sul dominio pubblico a partire dal
 *  codice della stanza, da qualunque forma arrivi (/meetly/… o il vecchio
 *  /videochiamata/…). Se il codice non c'è — perché il link è di un altro
 *  servizio — si restituisce stringa vuota: meglio un messaggio senza link,
 *  che si vede subito, di un link sbagliato, che si scopre a consulenza
 *  saltata. Chi mostra il tasto deve controllare questo valore prima di
 *  offrirlo (vedi haStanzaNostra). */
const RE_CODICE_STANZA = /\/(?:meetly|videochiamata)\/([^/?#]+)/i;

export function linkStanzaDi(d: Partial<LeadData>): string {
  const grezzo = typeof d?.linkMeeting === "string" ? d.linkMeeting.trim() : "";
  if (!grezzo) return "";
  const m = grezzo.match(RE_CODICE_STANZA);
  if (!m) return "";
  return urlStanza(decodeURIComponent(m[1]));
}

/** Il solo CODICE della stanza. Serve all'anteprima del link: l'immagine di un
 *  link si deposita sotto il codice che sta nell'indirizzo, e /meetly/<codice>
 *  ha il suo, diverso da quello della pagina dell'appuntamento. */
export function codiceStanzaDi(d: Partial<LeadData>): string {
  const grezzo = typeof d?.linkMeeting === "string" ? d.linkMeeting.trim() : "";
  const m = grezzo.match(RE_CODICE_STANZA);
  return m ? decodeURIComponent(m[1]) : "";
}

/** Il link scritto in scheda quando NON è una stanza nostra: si accetta solo
 *  se è un indirizzo http(s), o nel messaggio finirebbe un appunto preso a mano
 *  («chiamo io», «su zoom») spacciato per un collegamento. */
function linkEsterno(d: Partial<LeadData>): string {
  const grezzo = typeof d?.linkMeeting === "string" ? d.linkMeeting.trim() : "";
  return /^https?:\/\/\S+$/i.test(grezzo) ? grezzo : "";
}

/** Vero quando esiste una stanza Meetly vera per questo lead. */
export const haStanzaNostra = (d: Partial<LeadData>) => linkStanzaDi(d) !== "";

/** IL messaggio da mandare a questa persona adesso, deciso dal suo stato.
 *  Firma invariata: la chiamano otto pagine e nessuna deve sapere che sotto è
 *  cambiato tutto. */
export function getWhatsAppMessageForStatus(lead: Lead, consultantName?: string): string {
  const chiave = (lead.data.stato ?? "") as ChiaveModello;
  const modello = MODELLI_ORIGINALI[chiave] ? modelloDi(chiave) : MODELLO_RIPIEGO;
  return componiMessaggio(modello, valoriDaLead(lead, chiave, consultantName));
}

/** Il promemoria del giorno prima. */
/** ── QUANDO IL PROMEMORIA HA SENSO ─────────────────────────────────────────
 *  Il promemoria dice «ti ricordo il nostro appuntamento di giovedì» e allega
 *  il link: mandato dopo, è la cosa più sbagliata che si possa scrivere a un
 *  cliente — ricorda un incontro già avvenuto e lo fa sembrare saltato.
 *
 *  ⚠️ LA DATA DA SOLA NON BASTA, E NEMMENO LO STATO. Serve leggerli insieme:
 *   · se la trattativa è ANCORA a un appuntamento, quello di OGGI va ricordato
 *     (è il promemoria della mattina stessa, quello che riduce le assenze);
 *   · se invece è andata avanti — la consulenza è stata fatta e lo stato è
 *     diventato «In valutazione», «Ricontatto fissato», «Attesa acconto» — la
 *     data di oggi è quella dell'incontro APPENA CONCLUSO, e ricordarlo non
 *     vuol dire niente. Lì serve solo se ce n'è già uno NUOVO, più avanti.
 *  È la regola che permette di tenere lo stesso pulsante in fondo a una
 *  consulenza appena finita senza che mandi la cosa sbagliata.
 */
/** Gli stati in cui la cosa in calendario è una TELEFONATA che facciamo noi. */
const STATI_RICHIAMO = ["da_ricontattare", "sta_valutando", "richiamo"];

/** ── QUALE PROMEMORIA, SE UNO SERVE ────────────────────────────────────────
 *  Ritorna la chiave del modello da usare, oppure `null` se oggi non c'è
 *  niente da ricordare a questa persona.
 *
 *  ⚠️ IL PROMEMORIA ERA UNO SOLO, E PARLAVA SEMPRE DI VIDEOCHIAMATA. Diceva
 *   «ti ricordo il nostro appuntamento di…, ecco il LINK, collegati da un
 *   posto tranquillo e con una buona connessione»: giusto per una consulenza
 *   online, sbagliato per tutti gli altri. A chi deve VENIRE in studio mandava
 *   un link da aprire invece dell'indirizzo dove presentarsi; a chi aspetta
 *   una TELEFONATA chiedeva di «esserci» da qualche parte. E guardava solo
 *   `dataMeeting`: su una scheda con un richiamo fissato per domani il tasto
 *   non compariva affatto — oppure, peggio, ricordava «l'appuntamento» citando
 *   la data della consulenza già fatta.
 *
 *  ⚠️ SI LEGGONO STATO E DATA INSIEME, e la data è quella che appartiene allo
 *   stato. È la stessa regola di `consulenzaAlleSpalle` (crm/lavori), e per lo
 *   stesso motivo: una data da sola non dice che cosa stiamo per fare con
 *   quella persona.
 *
 *  ⚠️ «DA OGGI IN POI», non «da domani»: il promemoria della mattina stessa è
 *   quello che riduce davvero le assenze. Quello che non deve succedere è
 *   ricordare una cosa GIÀ AVVENUTA — ed è il motivo per cui la consulenza,
 *   quando lo stato dice che è andata avanti, vale solo se è nel futuro.
 */
export function promemoriaDi(d: Partial<LeadData> | undefined, oggi: string): ChiaveModello | null {
  if (!d || !oggi) return null;
  const giorno = (v?: string) => String(v || "").slice(0, 10);
  const stato = String(d.stato ?? "");

  //  Chi viene da noi: comanda la data della visita.
  const sede = giorno(d.dataVieneInSede);
  if (stato === "viene_in_sede" && sede && sede >= oggi) return "promemoria_sede";

  //  Chi aspetta una nostra telefonata.
  const richiamo = giorno(d.dataRicontatto);
  if (STATI_RICHIAMO.includes(stato) && richiamo && richiamo >= oggi) return "promemoria_richiamo";

  //  La consulenza in videochiamata. Se lo stato dice che c'è un appuntamento,
  //  anche quello di OGGI va ricordato; se la trattativa è andata avanti, la
  //  data di oggi è quella dell'incontro appena concluso e serve solo se ce
  //  n'è uno NUOVO più avanti.
  const meeting = giorno(d.dataMeeting);
  if (meeting && (eAppuntamento(stato) ? meeting >= oggi : meeting > oggi)) return "promemoria";

  return null;
}

/** Come si chiama il promemoria di questa scheda, per il titolo del pulsante.
 *  ⚠️ Una frase sola e decisa qui: i tre pulsanti dicevano tutti «il
 *   promemoria dell'appuntamento, col link» — e adesso due su tre un link non
 *   ce l'hanno. Un'etichetta che promette una cosa che il messaggio non fa è
 *   il modo più rapido per non fidarsi più di nessuna etichetta. */
export function etichettaPromemoria(d: Partial<LeadData> | undefined, oggi: string): string {
  switch (promemoriaDi(d, oggi)) {
    case "promemoria_sede":
      return "il promemoria della visita in studio, con l'indirizzo";
    case "promemoria_richiamo":
      return "il promemoria del richiamo: gli diciamo che lo chiamiamo noi";
    default:
      return "il promemoria dell'appuntamento, col link";
  }
}

/** Vero se a questa persona c'è qualcosa da ricordare oggi. Firma invariata:
 *  la chiamano tre schermate e nessuna deve sapere che sotto sono diventati
 *  tre messaggi. */
export function promemoriaUtile(d: Partial<LeadData> | undefined, oggi: string): boolean {
  return promemoriaDi(d, oggi) !== null;
}

/** Il promemoria giusto per questa scheda. ⚠️ `oggi` si può passare (le prove
 *  lo fanno); di suo prende il giorno locale, non quello UTC — fino alle 2 di
 *  notte italiane `toISOString` restituisce IERI, e il promemoria del mattino
 *  sarebbe partito con la data sbagliata. */
export function buildMeetReminderMessage(
  lead: Lead,
  consultantName?: string,
  oggi?: string,
): string {
  const adesso = new Date();
  const oggiLocale =
    oggi ||
    `${adesso.getFullYear()}-${String(adesso.getMonth() + 1).padStart(2, "0")}-${String(adesso.getDate()).padStart(2, "0")}`;
  //  Nessun promemoria pertinente: resta quello della consulenza, che è il
  //  comportamento di sempre. Chi chiama questa funzione senza chiedersi se
  //  serva (il menu «…» ne ha una voce fissa) non deve ricevere una stringa
  //  vuota in mano.
  const chiave = promemoriaDi(lead.data, oggiLocale) ?? "promemoria";
  return componiMessaggio(modelloDi(chiave), valoriDaLead(lead, chiave, consultantName));
}

/** ── IL LINK DELLA CONSULENZA, DA MANDARE QUANDO SERVE ────────────────────
 *  Non è legato allo stato: si manda quando il cliente ha perso il link nella
 *  chat, si collega da un altro telefono, o è l'ora e non è ancora entrato.
 *  Per questo ha un tasto suo invece di stare dentro il messaggio dello stato. */
export function buildLinkConsulenzaMessage(lead: Lead, consultantName?: string): string {
  return componiMessaggio(
    modelloDi("link_consulenza"),
    valoriDaLead(lead, "link_consulenza", consultantName),
  );
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  const num = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. CONTROLLI — quello che non deve arrivare al cliente
   ═════════════════════════════════════════════════════════════════════════ */

/** Limite duro di WhatsApp per un messaggio di testo: oltre, l'invio viene
 *  rifiutato dall'API e il cliente non riceve niente. */
export const LIMITE_WHATSAPP = 4096;

/** Soglia di leggibilità: oltre questa lunghezza il messaggio non entra in una
 *  schermata di telefono e viene letto a metà. Non è un errore, è un consiglio
 *  — ma è il consiglio che fa la differenza fra un messaggio letto e uno no. */
export const SOGLIA_LUNGO = 600;

export interface Problema {
  /** errore = non si manda così · avviso = si può mandare, ma è peggio */
  livello: "errore" | "avviso";
  testo: string;
}

/** I segnaposto rimasti nel testo FINALE, cioè quelli che il cliente leggerebbe
 *  alla lettera. È il controllo da fare un attimo prima di premere invio.
 *  Riconosce anche la forma `{{1}}` di Meta: incollata in un messaggio libero
 *  non viene sostituita da nessuno. */
export function segnapostiResidui(messaggio: string): string[] {
  const trovati = new Set<string>();
  for (const m of messaggio.matchAll(/\{\{?[^{}]*\}?\}/g)) trovati.add(m[0]);
  return Array.from(trovati);
}

/** Cosa non va in un MODELLO, prima ancora di comporlo.
 *  L'ordine conta: prima quello che blocca l'invio, poi quello che lo peggiora. */
export function controllaModello(chiave: ChiaveModello, testo: string): Problema[] {
  const problemi: Problema[] = [];
  const pulito = testo.trim();

  if (!pulito) {
    problemi.push({ livello: "errore", testo: "Il messaggio è vuoto: verrà usato l'originale." });
    return problemi;
  }

  //  Segnaposto inventati: `{cliente}` non esiste e arriverebbe scritto così.
  const sconosciuti = new Set<string>();
  for (const m of pulito.matchAll(RE_SEGNAPOSTO)) {
    if (!CONOSCIUTI.has(m[1])) sconosciuti.add(`{${m[1]}}`);
  }
  //  Graffe spaiate: `{nome` non viene riconosciuto come segnaposto e resta lì.
  const spaiate = pulito.replace(RE_SEGNAPOSTO, "").match(/[{}]/g);

  if (sconosciuti.size > 0) {
    problemi.push({
      livello: "errore",
      testo: `Segnaposto che non esiste: ${Array.from(sconosciuti).join(", ")} — arriverebbe scritto così al cliente.`,
    });
  }
  if (spaiate) {
    problemi.push({
      livello: "errore",
      testo: "C'è una graffa aperta e mai chiusa: il segnaposto non verrà sostituito.",
    });
  }
  if (pulito.length > LIMITE_WHATSAPP) {
    problemi.push({
      livello: "errore",
      testo: `Troppo lungo: ${pulito.length} caratteri, il limite di WhatsApp è ${LIMITE_WHATSAPP}. L'invio verrebbe rifiutato.`,
    });
  } else if (pulito.length > SOGLIA_LUNGO) {
    problemi.push({
      livello: "avviso",
      testo: `Lungo ${pulito.length} caratteri: oltre i ${SOGLIA_LUNGO} non entra in una schermata di telefono e viene letto a metà.`,
    });
  }
  if (chiave !== "firma" && !pulito.includes("{nome}")) {
    problemi.push({
      livello: "avviso",
      testo:
        "Non c'è {nome}: un messaggio che non chiama la persona per nome si legge come un invio di massa.",
    });
  }
  //  Il link è utile solo dove esiste una stanza: altrove resterebbe sempre
  //  vuoto e porterebbe via la riga a ogni invio.
  if (
    pulito.includes("{link}") &&
    chiave !== "appuntamento_fissato" &&
    chiave !== "appuntamento_rifissato" &&
    chiave !== "promemoria"
  ) {
    problemi.push({
      livello: "avviso",
      testo: "{link} c'è solo negli appuntamenti: qui la riga sparirà quasi sempre.",
    });
  }
  return problemi;
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. L'ANTEPRIMA — con dati veri, non con "XXX"
   ═════════════════════════════════════════════════════════════════════════ */

/** Una trattativa finta ma verosimile per l'anteprima: la data è DOMANI, così
 *  l'anteprima mostra davvero come suona "domani alle 15:30" invece di una data
 *  qualsiasi che non dice niente. La pagina la usa solo quando in archivio non
 *  c'è nessuna trattativa vera in quello stato. */
export function leadDiEsempio(chiave: ChiaveModello): Lead {
  const domani = new Date();
  domani.setDate(domani.getDate() + 1);
  const iso = `${domani.getFullYear()}-${String(domani.getMonth() + 1).padStart(2, "0")}-${String(
    domani.getDate(),
  ).padStart(2, "0")}`;
  //  ⚠️ SOLO UNO STATO VERO. Prima si escludevano a mano «promemoria» e
  //   «firma»: con i due promemoria nuovi quella riga avrebbe messo
  //   «promemoria_sede» dentro `stato`, cioè uno stato che non esiste, e
  //   l'anteprima avrebbe mostrato il messaggio di ripiego senza dire perché.
  //   Si chiede all'elenco vero, che non va aggiornato a mano.
  const stato = (
    (ALL_LEAD_STATUSES as string[]).includes(String(chiave)) ? chiave : "appuntamento_fissato"
  ) as LeadStatus;
  return {
    id: "esempio",
    user_id: "esempio",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: {
      nome: "Marco",
      cognome: "Bianchi",
      telefono: "+39 333 1234567",
      stato,
      createdAt: new Date().toISOString(),
      dataMeeting: iso,
      oraMeeting: "15:30",
      dataRicontatto: iso,
      oraRicontatto: "11:00",
      dataVieneInSede: iso,
      oraVieneInSede: "10:00",
      linkMeeting: "https://hairgeniuslabs.it/stanza/marco-b",
    },
  };
}
