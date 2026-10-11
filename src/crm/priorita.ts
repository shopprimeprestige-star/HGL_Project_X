/** ── ANTICIPA — L'UNICO MODO DI SCAVALCARE L'ORDINE ────────────────────────
 *
 *  PERCHÉ ESISTE
 *  L'elenco delle installazioni si legge dalla data più vecchia alla più
 *  recente, e chi non ha ancora un giorno sta in fondo (il perché sta in
 *  `ordinaGiornate`, qui sotto). È l'ordine giusto nove volte su dieci, e la
 *  decima è sempre la stessa: una persona al telefono dice qualcosa che l'ordine
 *  non sa — parte per un matrimonio, ha un colloquio, torna all'estero fra dieci
 *  giorni. Senza un modo di dirlo, quella riga resta dov'è e il rimedio diventa
 *  ricordarsela a memoria: cioè dimenticarla.
 *
 *  PERCHÉ SI CHIAMA «ANTICIPA» E NON «PRIORITÀ» NÉ «URGENTE»
 *  «Anticipa» è un VERBO e dice esattamente cosa fa il gesto — porta avanti
 *  questa posa — quindi il pulsante promette una cosa sola e la mantiene.
 *  «Priorità» è un sostantivo: nomina una proprietà e non dice cosa succede
 *  premendolo, e la lingua di questo CRM mette sui pulsanti quello che
 *  accadrà. «Urgente» è peggio ancora perché è un GIUDIZIO sul cliente, e i
 *  giudizi si allargano: fra un mese sarebbero urgenti tutte, cioè nessuna.
 *  ⚠️ Nel testo delle finestre e nei messaggi si continua a dire anche «in
 *  cima all'elenco», che è il fatto verificabile: il nome dice l'intenzione,
 *  la frase dice il risultato.
 *
 *  IL DESIDERIO NON È L'APPUNTAMENTO
 *  Insieme alla priorità si può scrivere IL GIORNO CHE VORREBBE IL CLIENTE. Non
 *  è la data di posa: non occupa un'agenda, non impegna nessun installatore e
 *  nessuno ci si presenta. Il perché per esteso sta su `dataDesiderata` in
 *  types.ts; qui basta la conseguenza pratica, ed è il motivo per cui a schermo
 *  quella data si scrive SEMPRE con il verbo («vorrebbe il 20 gen»): due date
 *  affiancate senza aggettivo si leggono tutte e due come appuntamenti presi.
 *
 *  SI TOGLIE CON LO STESSO GESTO CON CUI SI METTE
 *  Un interruttore che si accende e non si spegne non è un ordinamento: è una
 *  seconda lista che cresce e non cala, e in un mese ci finisce dentro tutto.
 *  Per questo `togli` esiste, sta nella stessa finestra di `metti` e non dietro
 *  un menu: il gesto che disfa deve costare quanto il gesto che fa.
 *  ───────────────────────────────────────────────────────────────────────── */
import { toast } from "sonner";
import { useCRM } from "./CRMContext";
//  Le tre domande di sempre — "è fatta?", "da quanto aspetta?", "chi è?" — si
//  leggono da dove le leggono tutte le altre pagine delle pose: una seconda
//  definizione qui darebbe una riga in cima a un elenco e in fondo all'altro.
import {
  giornoISO,
  giorniDiAttesa,
  nomeCompleto,
  posaCompletata,
} from "./InstallationScheduleDialog";
import { dataBreve } from "./ui";
import type { InstallazioneInfo, Lead } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   1. IL DATO — tre domande, tre risposte, nessuna scritta a mano altrove
   ═════════════════════════════════════════════════════════════════════════ */

/** La priorità è accesa su questa pratica? */
export function inPriorita(l: Lead): boolean {
  return l.data.installazione?.priorita === true;
}

/** Il giorno che vorrebbe il cliente, "" se non l'ha detto.
 *  ⚠️ Si legge anche a priorità spenta — il campo non si cancella (vedi
 *  types.ts) — quindi CHI LO MOSTRA deve chiedersi prima se la priorità è
 *  accesa: una data desiderata di tre mesi fa lasciata a video su una riga
 *  normale si legge come una scadenza che nessuno ha promesso. */
export function dataDesiderata(l: Lead): string {
  return l.data.installazione?.dataDesiderata || "";
}

/** ── LA PRIORITÀ SI VEDE, MA SOLO FINCHÉ C'È QUALCOSA DA ANTICIPARE ───────
 *  A posa fatta non c'è più niente da portare avanti: il segno resterebbe
 *  acceso per sempre su una pratica finita, esattamente come l'ambra dei dati
 *  mancanti che questa pagina toglie dalle righe completate. Il campo NON si
 *  riscrive di nascosto — se la posa torna indietro il segno ricompare, che è
 *  la verità: quella pratica era stata messa in cima e non è ancora finita. */
export function daAnticipare(l: Lead): boolean {
  return inPriorita(l) && !posaCompletata(l);
}

/** Va estratta dal suo giorno e portata IN CIMA all'elenco?
 *  Solo se un giorno non ce l'ha ancora. ⚠️ Una posa già programmata NON si
 *  sposta: la sua data è un appuntamento con una persona, e toglierla dal suo
 *  blocco svuoterebbe la giornata da cui l'installatore lavora — il riepilogo
 *  che si copia in chat perderebbe una riga senza dirlo a nessuno. Là la
 *  priorità resta un SEGNO sulla riga (vedi `SegnoPriorita`), che è tutto
 *  quello che serve: il giorno c'è già, e se va spostato lo si sposta da
 *  «Programma». */
export function inCimaAllElenco(l: Lead): boolean {
  return daAnticipare(l) && !l.data.installazione?.dataInstallazione;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. L'ORDINE
   ═════════════════════════════════════════════════════════════════════════ */

/** ── L'ORDINE FRA LE ANTICIPATE ───────────────────────────────────────────
 *  «In cima» smette di voler dire qualcosa appena le anticipate sono dieci:
 *  serve un ordine anche lì dentro, e sono due chiavi in fila.
 *   1 · LA DATA CHE VORREBBE IL CLIENTE, dalla più vicina. È l'unica scadenza
 *       vera che abbiamo su queste righe, e una già passata resta in testa —
 *       è la promessa che stiamo mancando adesso, non un dato scaduto da
 *       nascondere.
 *   2 · CHI ASPETTA DA PIÙ TEMPO, per tutte quelle che una data desiderata non
 *       ce l'hanno. Vanno DOPO quelle che ce l'hanno: un giorno chiesto è una
 *       cosa che il cliente ha detto, l'attesa è una cosa che gli è capitata.
 *  Il nome chiude i pari merito: senza, due righe identiche si scambiano di
 *  posto a ogni aggiornamento e si perde il segno mentre le si lavora. */
export function confrontaAnticipate(a: Lead, b: Lead): number {
  const da = dataDesiderata(a);
  const db = dataDesiderata(b);
  if (!da !== !db) return da ? -1 : 1;
  if (da && db && da !== db) return da.localeCompare(db);
  const attesaA = giorniDiAttesa(a) ?? 0;
  const attesaB = giorniDiAttesa(b) ?? 0;
  if (attesaA !== attesaB) return attesaB - attesaA;
  return nomeCompleto(a).localeCompare(nomeCompleto(b));
}

/** Le anticipate in testa, tutto il resto NELL'ORDINE IN CUI È ARRIVATO.
 *  Serve alle schede sorelle — «A domicilio», «Da spedire» — che un ordine loro
 *  ce l'hanno già e non va riscritto: qui si aggiunge uno strato sopra, non se
 *  ne sostituisce uno. Senza niente da spostare restituisce la STESSA lista,
 *  così una scheda senza anticipate non paga nemmeno una copia.
 *
 *  ⚠️ CHI SALE LO DICE LA SCHEDA, e non è un dettaglio di comodo: le due schede
 *  che chiamano questa funzione guardano cose diverse.
 *   · UN PACCO non ha un appuntamento con nessuno, quindi sale sempre: `sale`
 *     resta `daAnticipare`, che è anche il valore di ripiego.
 *   · UNA POSA A DOMICILIO un appuntamento ce l'ha, e allora vale la stessa
 *     regola dell'elenco delle installazioni — `inCimaAllElenco`: sale solo
 *     chi un giorno non ce l'ha ancora. Passando `daAnticipare` anche di là,
 *     una trasferta fissata per il mese prossimo scavalcava quella di domani
 *     dentro la scheda con cui si preparano proprio le trasferte, e la STESSA
 *     riga si comportava in due modi in due lenti della stessa pagina.
 *  Chi chiama passa la sua domanda; il criterio dell'ordine QUI DENTRO —
 *  `confrontaAnticipate` — resta uno solo, altrimenti «in cima» vorrebbe dire
 *  due cose. */
export function primaLeAnticipate(
  items: Lead[],
  sale: (l: Lead) => boolean = daAnticipare,
): Lead[] {
  const sopra = items.filter((l) => sale(l));
  if (sopra.length === 0) return items;
  return [...sopra.sort(confrontaAnticipate), ...items.filter((l) => !sale(l))];
}

/** ── L'ORDINE DELLE GIORNATE: DALLA PIÙ VECCHIA ALLA PIÙ RECENTE ──────────
 *  Una scala sola per tutto ciò che è da fare — il passato aperto, oggi, i
 *  giorni in arrivo — perché è così che si legge una coda di lavoro: quello che
 *  aspetta da più tempo sta in cima.
 *
 *   1 · DA FARE — tutte le giornate con del lavoro aperto, in ORDINE DI
 *       CALENDARIO CRESCENTE. Le passate non chiuse vengono prima di oggi, oggi
 *       prima di domani.
 *   2 · SENZA DATA — chi ha pagato e aspetta che si fissi il giorno.
 *   3 · ARCHIVIO — giornate passate con tutto chiuso, dalla più recente: lì non
 *       c'è più niente da recuperare, si guarda solo com'è andata.
 *
 *  ⚠️ COSA È CAMBIATO RISPETTO A `ordinaGruppi` (crm/InstallationScheduleDialog),
 *   che questa pagina usava e che la giornata dell'installatore usa ancora.
 *   Là l'ordine era quello dell'IMMINENZA, e due sue regole qui non ci sono più:
 *    · OGGI NON È PIÙ INCHIODATO IN CIMA. Prima pesava 0 e stava sopra a tutto;
 *      adesso sta al suo posto nel calendario, cioè sotto le giornate passate
 *      ancora aperte. Non è una svista ed è la conseguenza voluta della regola
 *      chiesta: se la giornata di oggi restasse pinnata, «dalla più vecchia in
 *      cima» sarebbe falso per la prima scheda della pagina. Quello che oggi
 *      aveva di suo non si perde — la scheda resta cerchiata di azzurro e ogni
 *      riga porta il cartellino OGGI, che è quello che si cerca scorrendo — e la
 *      lente «Oggi» della banda è a un clic.
 *    · IL PASSATO NON SCENDE PIÙ DAL PIÙ RECENTE. Prima le giornate in ritardo
 *      erano ordinate al contrario, con questa ragione: quella di ieri si
 *      recupera con una telefonata, quella di sei mesi fa è archeologia.
 *      ⚠️ Il prezzo del rovesciamento è esattamente quello: la posa più vecchia
 *      rimasta aperta si pianta in testa alla pagina e ci resta finché qualcuno
 *      non la chiude o non la riprogramma. È il comportamento chiesto, ed è
 *      anche il suo antidoto — una riga ferma da sei mesi in cima a tutto è
 *      difficile da ignorare quanto è facile ignorarla in fondo.
 *   Resta invece la regola che divideva il passato in due, e resta perché non
 *   parla di date ma di LAVORO: una giornata passata pesa come da fare se
 *   contiene anche UNA SOLA posa non completata, e diventa archivio solo quando
 *   sono chiuse tutte. Toglierla avrebbe mescolato le pose dimenticate con
 *   quelle finite, che è l'unica confusione che questa pagina non può fare. */
export function ordinaGiornate(
  gruppi: { giorno: string; items: Lead[] }[],
): { giorno: string; items: Lead[] }[] {
  const oggi = giornoISO();
  const peso = (g: { giorno: string; items: Lead[] }) => {
    if (!g.giorno) return 2;
    //  Oggi e il futuro sono sempre lavoro: una giornata in arrivo con tutto
    //  già segnato fatto è un caso che esiste (si chiude in anticipo) e resta
    //  dov'è nel calendario — spedirla in archivio la farebbe sparire da sotto
    //  gli occhi di chi sta preparando quella settimana.
    if (g.giorno >= oggi) return 1;
    return g.items.some((l) => !posaCompletata(l)) ? 1 : 3;
  };
  return [...gruppi].sort((a, b) => {
    const pa = peso(a);
    const pb = peso(b);
    if (pa !== pb) return pa - pb;
    //  Nell'archivio si scende dal più recente: è la cosa appena successa che
    //  si va a rileggere. Nel da fare si sale, che è la regola di questa pagina.
    return pa === 3 ? b.giorno.localeCompare(a.giorno) : a.giorno.localeCompare(b.giorno);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LE SCRITTURE — mettere in cima, e toglierne
   ═════════════════════════════════════════════════════════════════════════ */

/** Le due azioni della priorità. Ognuna lascia per qualche secondo un
 *  «Annulla», come tutti gli altri gesti delle pose: è ciò che rende
 *  accettabile cambiare l'ordine di un elenco con un tocco solo. */
export function useAzioniPriorita() {
  const { updateLead } = useCRM();

  /** Scrive dentro `installazione` SOMMANDO a quello che c'è già: giorno,
   *  orario, tecnico e note non devono sparire perché si è messa in cima una
   *  riga. Restituisce l'installazione di prima, che è ciò che serve ad
   *  «Annulla» — oppure null se il salvataggio non è andato, e in quel caso
   *  chi chiama ha già visto l'errore.
   *  ⚠️ LA RISPOSTA DI `updateLead` SI LEGGE. Torna `false` anche senza nessun
   *  errore in console — succede quando la pagina lavora su un lead che
   *  l'elenco in memoria non ha — e dare per riuscita quella scrittura
   *  significherebbe mostrare la riga in cima fino al primo ricaricamento. */
  /*  ── ⚠️ IL PEZZO SI COMPONE SULLA RIGA VERA, NON SU QUELLA A SCHERMO ──
      Qui si scriveva `{ installazione: patch }` con `patch` costruito fuori,
      su `l.data.installazione` — cioè sulla copia che il browser aveva in
      memoria. `updateLead` rilegge la riga prima di salvare, ma non serve a
      niente se l'oggetto da scrivere è GIÀ stato composto su dati vecchi:
      mettere una posa in cima cancellava il tecnico o il giorno che un
      collega aveva appena scritto dentro `installazione`.
      Adesso si passa il MODO di comporla, e `updateLead` lo esegue dopo aver
      riletto: vedi crm/patch-scheda.
      ⚠️ Anche il «prima» viene dalla riga vera: è quello che «Annulla»
       rimetterà, e rimettere una copia vecchia vorrebbe dire cancellare col
       tasto Annulla il lavoro di un altro. */
  const scrivi = async (
    l: Lead,
    come: (attuale: InstallazioneInfo) => InstallazioneInfo,
    guasto: string,
  ) => {
    //  ⚠️ Parte dalla copia a schermo e viene sostituito da quella vera: se
    //   il salvataggio non arriva mai a comporre la modifica — scheda sparita
    //   dall'archivio, lettura fallita — un «prima» vuoto farebbe scrivere ad
    //   «Annulla» un'installazione vuota, cioè cancellerebbe tecnico, giorno e
    //   spedizione invece di rimetterli. Nel caso peggiore fa quello che
    //   faceva ieri.
    let precedente: InstallazioneInfo = { ...(l.data.installazione ?? {}) };
    const riuscito = await updateLead(l.id, (attuale) => {
      precedente = { ...(attuale.installazione ?? {}) };
      return { installazione: come(attuale.installazione ?? {}) };
    });
    if (!riuscito) {
      toast.error(guasto);
      return null;
    }
    return precedente;
  };

  const annulla = (l: Lead, precedente: InstallazioneInfo) => ({
    label: "Annulla",
    onClick: () => {
      void (async () => {
        //  Qui l'oggetto intero è giusto: «Annulla» vuol dire «rimettila com'era»,
      //  e `precedente` viene dalla riga vera letta al momento del salvataggio.
      const rimesso = await updateLead(l.id, { installazione: precedente });
        if (!rimesso) {
          toast.error("«Annulla» non è riuscito: la riga è rimasta come l'hai lasciata. Riprova.");
        }
      })();
    },
  });

  /** Mette la posa in cima all'elenco, con o senza il giorno che vorrebbe il
   *  cliente. Rimettere la stessa data sulla stessa pratica non scrive niente:
   *  è il caso di chi apre la finestra per guardare e la chiude con «Salva». */
  const metti = async (l: Lead, quando: string) => {
    const giorno = quando.trim();
    if (inPriorita(l) && dataDesiderata(l) === giorno) return;
    const precedente = await scrivi(
      l,
      (attuale) => {
        const aggiornata: InstallazioneInfo = { ...attuale, priorita: true };
        //  La data si TOGLIE davvero quando si svuota il campo: lasciata a `""`
        //  sarebbe un desiderio vuoto che l'ordinamento continua a leggere come
        //  "una data c'è", e quella riga scavalcherebbe chi una data l'ha detta.
        if (giorno) aggiornata.dataDesiderata = giorno;
        else delete aggiornata.dataDesiderata;
        return aggiornata;
      },
      "Non sono riuscito a mettere in cima questa posa: è rimasta al suo posto. Riprova.",
    );
    if (!precedente) return;
    toast.success(`In cima all'elenco · ${nomeCompleto(l)}`, {
      description: giorno
        ? //  ⚠️ La frase dice la differenza fra le due date OGNI VOLTA, e non
          //  una volta sola nella finestra: questo messaggio è l'ultima cosa
          //  che si legge prima di tornare all'elenco, ed è lì che nasce
          //  l'equivoco «allora è fissata per il 20».
          `Il cliente vorrebbe il ${dataBreve(giorno)}. È quello che ha chiesto, non un appuntamento: il giorno della posa si fissa da «Programma».`
        : "Nessuna data chiesta dal cliente: resta in cima finché non le si dà un giorno.",
      action: annulla(l, precedente),
    });
  };

  /** Toglie la priorità e rimanda la riga nel suo turno.
   *  ⚠️ La data desiderata NON si cancella (vedi types.ts): smette solo di
   *  vedersi. Il messaggio lo dice, altrimenti chi rimette la priorità un'ora
   *  dopo e ritrova la data scritta pensa di averla riscritta lui.
   *  ⚠️ E DICE DOVE SI RILEGGE, che è il punto in cui questa frase mentiva.
   *  Prometteva «resta scritto in scheda», ma `dataDesiderata` non ha nessun
   *  lettore fuori da `SegnoPriorita` — e quel cartellino a priorità spenta non
   *  c'è: la scheda del cliente quel giorno non lo mostra da nessuna parte.
   *  L'unico posto da cui si rilegge (e si corregge) è lo stesso pulsante ↑ che
   *  l'ha scritto, che riapre con dentro la data salvata. Mandare qualcuno a
   *  cercare un dato dove non c'è è il modo più rapido di fargli credere che
   *  quel dato sia andato perso — e la telefonata la rifà. */
  const togli = async (l: Lead) => {
    if (!inPriorita(l)) return;
    const chiesta = dataDesiderata(l);
    const precedente = await scrivi(
      l,
      (attuale) => ({ ...attuale, priorita: false }),
      "Non sono riuscito a togliere la priorità: la riga è rimasta in cima. Riprova.",
    );
    if (!precedente) return;
    toast.success(`Torna nel suo turno · ${nomeCompleto(l)}`, {
      description: chiesta
        ? `Rientra nell'ordine per data. Il giorno chiesto dal cliente (${dataBreve(chiesta)}) non si cancella: smette di comparire sulla riga e si rilegge riaprendo lo stesso pulsante ↑.`
        : "Rientra nell'ordine per data, dalla più vecchia alla più recente.",
      action: annulla(l, precedente),
    });
  };

  return { metti, togli };
}
