/** ── TUTTI I LEAD IMPORTATI ────────────────────────────────────────────────
 *
 *  L'elenco intero delle liste caricate, e il posto in cui si lavora A GRUPPI.
 *
 *  ── PERCHÉ SERVIVA ────────────────────────────────────────────────────────
 *  Le altre tre viste di questa pagina rispondono a domande della GIORNATA:
 *  «chi chiamo adesso» (la coda), «cosa ho promesso e scade» (Oggi), «chi ho
 *  messo da parte» (i saltati). Tutte e tre, per costruzione, mostrano una
 *  fetta: la coda esclude chi ha già un esito, chi ha un appuntamento e chi è
 *  saltato; le altre due sono ancora più strette. Mancava la domanda che si fa
 *  chi ha appena finito una lista da trecento nomi: «fammi vedere TUTTI quelli
 *  che ho importato» — per contarli, per ritrovarne uno, e soprattutto per
 *  segnare in un colpo solo i venti che hanno detto di no.
 *  Fino a ieri quel gesto esisteva in un solo posto — /CRM/avanzamento, la
 *  tabella — cioè fuori da questa schermata e dietro un cambio di pagina, con
 *  il telefono in mano.
 *
 *  ── IL FILTRO PER STATO ───────────────────────────────────────────────────
 *  Le pastiglie in cima non sono un filtro «avanzato»: sono ciò che rende
 *  possibile il gesto di gruppo. «Prendi tutti» su trecento righe mischiate non
 *  serve a niente, «prendi tutti» dopo aver isolato i quaranta «Non risponde» è
 *  il lavoro di mezz'ora fatto in un minuto. Le voci si ricavano dagli stati
 *  che ci sono DAVVERO fra i lead importati — un filtro che offre stati vuoti
 *  fa premere a vuoto — e restano nell'ordine canonico di crm/types, non in
 *  quello della frequenza: un elenco che si riordina da solo è un elenco in cui
 *  la stessa pastiglia sta ogni giorno in un posto diverso.
 *
 *  ── LA SELEZIONE È QUELLA DEI SALTATI ─────────────────────────────────────
 *  Stessa identica: clic su TUTTA la riga, Maiusc+clic per il blocco, stessa
 *  barra in basso. Non è una copia — è crm/importa/selezione, che è uscito da
 *  SchedaSaltati apposta. Due selezioni multiple diverse nella stessa pagina
 *  vorrebbero dire due bersagli e due significati per lo stesso clic, a una
 *  linguetta di distanza.
 *
 *  ── LA PASTIGLIA DELLA RIGA: UNA SCHEDA PER VOLTA, TUTTI GLI STATI ────────
 *  Lo stato scritto sulla riga È il comando per cambiarlo: si preme e si apre
 *  la griglia con tutti gli stati che QUELLA scheda può davvero prendere. Non è
 *  una griglia di questo file — è `PastigliaStato` di crm/SelettoreStatoDialog,
 *  la stessa che si preme nella scheda del lead, in «Da fare», in WhatsApp:
 *  stesso gesto e stesso elenco ovunque si veda uno stato.
 *  ⚠️ QUI PRIMA C'ERA UN'ETICHETTA E BASTA. Chi voleva mettere un
 *   «Appuntamento fissato» a UNA riga di questo elenco doveva aprirle la scheda
 *   e cercarlo lì dentro: due finestre e un ritorno, per un gesto che sull'unico
 *   elenco che mostra tutti i lead è quello che si fa più spesso.
 *  Chi scrive non è questo file: `onStato` è la pipeline della pagina — le tre
 *  chiusure vinte finiscono nella loro finestra con dentro i soldi, gli stati
 *  che promettono un momento o degli importi aprono da soli il calendario o il
 *  modulo, gli altri si scrivono e basta. Da qui parte l'intenzione, non la
 *  scrittura.
 *
 *  ── ⚠️ IL CAMBIO IN MASSA TOCCA DEI DATI: LE TRE REGOLE ──────────────────
 *   1. NON TUTTI GLI STATI SI POSSONO DARE A VENTI SCHEDE INSIEME, e quelli che
 *      non si possono NON SONO NEL MENU DI GRUPPO. Un «Appuntamento fissato» in
 *      massa scriverebbe lo stesso giorno e la stessa ora su venti persone; un
 *      «Acconto incassato» in massa scriverebbe lo stesso importo. Chi decide
 *      non è questo file: è `requiresAnyDialog` (gli stati che promettono un
 *      momento o degli importi) e `richiedeChiusura` (le tre chiusure vinte,
 *      che hanno la loro finestra con dentro i soldi).
 *      ⚠️ MA NON SONO PIÙ IRRAGGIUNGIBILI DA QUI: si danno a UNA riga per
 *       volta, dalla pastiglia dello stato, dove la finestra del giorno e
 *       dell'ora — o quella degli importi — si apre per quella persona sola.
 *       La regola non è «quello stato non si dà in questa vista», è «quel dato è
 *       di quella persona»: sotto il menu di gruppo c'è scritto dove trovarlo,
 *       altrimenti l'assenza si legge come un difetto e si cambia pagina.
 *   2. SI PROPONGONO SOLO GLI STATI VALIDI PER TUTTE LE SCHEDE SCELTE. Una
 *      selezione può mescolare righe ancora da chiamare e righe già diventate
 *      trattative, e i due elenchi di stati sono diversi (crm/types,
 *      `statiPer`): l'intersezione è l'unico modo per non scrivere su una
 *      scheda uno stato che quella scheda non avrebbe mai potuto avere. Quando
 *      l'intersezione è vuota il menu lo dice, invece di aprirsi vuoto.
 *      La pastiglia di riga non ha questo problema: gli stati li calcola sulla
 *      scheda che si sta guardando, quindi sono per definizione tutti buoni.
 *   3. SI CONFERMA PRIMA E SI LEGGE LA RISPOSTA DOPO. Prima: la barra dice per
 *      esteso cosa sta per succedere e su quante schede — un menu che scrive su
 *      venti righe al primo clic è un menu che si apre per sbaglio. Dopo: chi
 *      ha fallito RESTA SELEZIONATO e resta a schermo com'era, perché una riga
 *      che sparisce dall'elenco dopo un errore è una riga che nessuno rifà.
 *
 *  ── ⚠️ ELIMINARE NON SI DISFA ────────────────────────────────────────────
 *  Il cestino di questa scheda toglie la persona dall'archivio: non c'è un
 *  cestino da cui ripescarla, e nessun «Annulla» nel messaggio dopo — quello se
 *  lo può permettere «Salta», che è reversibile. Quindi l'avviso sta PRIMA,
 *  sempre, e in due passi:
 *   · DALLA RIGA il primo clic non elimina: chiede «Elimino Mario Rossi?» col
 *     nome scritto, perché in un elenco di trecento righe alte trenta pixel la
 *     riga su cui si è premuto e quella di sotto sono la stessa cosa.
 *   · DAL GRUPPO la conferma dice quante schede sono, e il tasto rosso NON è
 *     dove stava quello appena premuto: sta in TESTA alla barra, cioè fuori da
 *     dove la barra corta arrivava, mentre sotto il dito finisce «Lascia
 *     stare». Un doppio clic partito per sbaglio annulla, non elimina venti
 *     persone. (La barra è centrata: allungandola si allarga da tutte e due le
 *     parti — vedi il ⚠️ sulla conferma, che è dove il ragionamento sbagliato
 *     era costato.)
 *   · A riposo il cestino è grigio come gli altri comandi. Il rosso è della
 *     conferma, non dell'icona: un elenco con trecento icone rosse è un elenco
 *     in cui il rosso non vuol più dire niente.
 *   · Chi NON è stato eliminato resta selezionato e a schermo, esattamente come
 *     dopo un cambio di stato fallito.
 *
 *  ── ⚠️ IL TETTO NON RIFIUTA PIÙ IL LAVORO ────────────────────────────────
 *  Fino a ieri «Seleziona tutti» prendeva le prime cinquanta righe e la barra in
 *  basso, sopra quel numero, si rifiutava di scrivere dicendo «togline 262».
 *  Era il modo per non tenere la pagina ferma un minuto con trecento
 *  salvataggi uno dietro l'altro, ma il prezzo lo pagava chi il lavoro ce
 *  l'aveva davvero: una lista da trecento nomi si chiudeva a mano, sei volte.
 *  Adesso la selezione prende tutto quello che si vede e la pagina scrive A
 *  LOTTI, aggiornando il conteggio fra un lotto e l'altro: `avanzamento` è
 *  quel conto, e la barra lo mostra al posto del rifiuto. Il tetto resta come
 *  soglia da DIRE («sono più di 50, andrà a lotti»), non più come divieto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ListChecks, Trash2, Undo2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ALL_LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  SELECTABLE_LEAD_STATUSES,
  eStatoDaChiamare,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "@/crm/types";
//  Le due domande che dicono se uno stato può essere dato a venti schede
//  insieme. Sono di chi possiede le finestre, non di questa scheda: il giorno in
//  cui uno stato comincerà a chiedere un dato in più sparirà da questo menu da
//  solo, senza che nessuno debba ricordarsi di passare di qui.
import {
  FETTE_TEMPO,
  NOME_FETTA_TEMPO,
  SPIEGA_FETTA_TEMPO,
  dentroLaFetta,
  giornoLocale,
  type FettaTempo,
} from "@/crm/quando-stato";
import { requiresAnyDialog } from "@/crm/QuickStatusDialog";
import { richiedeChiusura } from "@/crm/ChiusuraDialog";
//  `PastigliaStato` è lo stato-che-si-preme di tutto il CRM: porta con sé la
//  griglia, gli stati giusti per quella scheda e l'avviso dei soldi ancora da
//  chiedere. Qui si monta e basta — non si decide niente di quello che mostra.
import { PastigliaStato, statiSelezionabili } from "@/crm/SelettoreStatoDialog";
import {
  BarraSelezione,
  Scheda,
  Segmento,
  Vuoto,
  etichettaStato,
  ordinaPerUrgenza,
  dettoIlInChiaro,
  prossimaAzione,
} from "@/crm/ui";
import { eSaltato } from "./saltati";
//  La riga appena sistemata non sparisce sotto le dita: la regola sta lì.
import { restaNellElenco, targhettaSistemato } from "./elenco-stabile";
//  Chi si telefona oggi e chi aspetta la sua data: la stessa regola della coda.
import { daTelefonareOggi, etichettaAttesa } from "./da-telefonare";
import {
  RigaSelezionabile,
  TETTO_SELEZIONE,
  testoSelezionaTutti,
  useSelezioneRighe,
} from "./selezione";

/** Gli stati che si possono dare a più schede in un gesto solo: quelli che non
 *  chiedono nient'altro. Vedi la regola 1 in cima — l'elenco non è scritto a
 *  mano, è quello che si può scegliere ovunque nel CRM meno chi apre una
 *  finestra. Gli altri non sono spariti: si danno dalla pastiglia della riga. */
const STATI_IN_MASSA: LeadStatus[] = SELECTABLE_LEAD_STATUSES.filter(
  (s) => !requiresAnyDialog(s) && !richiedeChiusura(s),
);

/** Quanti stati diversi ci stanno nella fila delle pastiglie prima che diventi
 *  un muro da leggere. Oltre, gli altri finiscono nel conteggio di «Tutti» e si
 *  raggiungono da lì: le liste importate hanno tre o quattro stati veri, la coda
 *  lunga sono schede singole che si cercano per nome. */
const STATI_IN_FILA = 8;

/** La riga di sotto-testo di un lead: telefono, prossima azione, e i due fatti
 *  che qui non si vedrebbero — che è in coda oggi, o che è messo da parte. */
function sottoTesto(l: Lead, inCoda: boolean, targhetta = ""): string {
  const d = l.data ?? ({} as LeadData);
  const azione = prossimaAzione(l);
  const pezzi = [d.telefono || "senza telefono"];
  if (azione.quando) pezzi.push(`${azione.cosa} ${azione.quando}`);
  //  ⚠️ Richiesta del committente: «fai che si vede anche nella lista lead la
  //   data». Qui sopra c'è ENTRO QUANDO si fa vivo; questa è da quanto
  //   aspettiamo, e compare solo su «Ci ricontatta lui» (vedi
  //   `dettoIlInChiaro`).
  const detto = dettoIlInChiaro(d);
  if (detto) pezzi.push(detto);
  if (eSaltato(l)) pezzi.push(d.saltatoDa ? `messo da parte da ${d.saltatoDa}` : "messo da parte");
  else if (inCoda) pezzi.push("in coda oggi");
  //  ⚠️ IN FONDO E SCRITTO, non un colore soltanto: una riga che per l'elenco
  //   non dovrebbe più esserci, senza una parola che lo dica, sembra un filtro
  //   che non funziona (vedi importa/elenco-stabile).
  if (targhetta) pezzi.push(targhetta);
  //  ⚠️ CHI ASPETTA LO DICE: senza, una riga che compare solo con
  //   l'interruttore acceso sembra «sistemata» come le altre — e invece è una
  //   telefonata che va fatta, ma non oggi.
  const attesa = etichettaAttesa(d);
  if (attesa) pezzi.push(attesa);
  return pezzi.join(" · ");
}

/** Il nome per esteso, o il ripiego: si scrive nella riga, nella conferma di
 *  eliminazione e nella finestra degli stati, e deve essere lo stesso in tutti
 *  e tre — «Senza nome» in un posto e vuoto nell'altro sono due persone. */
function nomeDi(d: LeadData): string {
  return `${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome";
}

export function SchedaTutti({
  importati,
  inCoda,
  restano,
  inCorso,
  avanzamento,
  onCambiaStato,
  onStato,
  onEliminaUno,
  onEliminaMolti,
  onApri,
}: {
  /** TUTTI i lead arrivati da una lista, senza nessun altro filtro. Il filtro
   *  lo fa questa scheda, e lo fa a vista: quale sia lo dicono le pastiglie in
   *  cima, accese. Arriva già filtrato per `importato` dalla pagina, che è
   *  l'unica cosa che «lead importato» vuol dire. */
  importati: Lead[];
  /** Chi è nella coda di oggi: serve solo a scriverlo sulla riga. La coda la
   *  calcola la pagina, e non si ricalcola qui — due idee di «chi è da
   *  chiamare» nella stessa schermata smettono presto di coincidere. */
  inCoda: Set<string>;
  /** ── CHI È STATO SISTEMATO IN QUESTA SCHERMATA ────────────────────────
   *  Gli id che devono restare visibili anche se lo stato nuovo li toglierebbe
   *  dall'elenco. Li tiene la PAGINA, perché è lei che sa quando si cambia
   *  linguetta (e allora si ricomincia da capo). Vedi importa/elenco-stabile. */
  restano?: Set<string>;
  /** Vero mentre il cambio in massa sta scrivendo: i tasti si spengono, o si
   *  preme due volte e partono due giri di salvataggi sugli stessi id. */
  inCorso: boolean;
  /** A che punto è un'operazione di gruppo che la pagina sta scrivendo a lotti.
   *  `null` = nessuna in corso. È l'unico motivo per cui la selezione può
   *  arrivare a trecento righe (vedi la nota sul tetto in cima): senza un conto
   *  a schermo, trecento salvataggi sono una pagina che sembra bloccata. */
  avanzamento?: { fatti: number; totale: number } | null;
  /** Cambia lo stato alle schede scelte. La scrittura è della pagina — qui non
   *  si sa nemmeno cosa sia `updateLead`.
   *  ⚠️ RESTITUISCE GLI ID RIMASTI COM'ERANO, cioè quelli su cui l'archivio non
   *   ha scritto niente. Non è un dettaglio: è quello che permette di lasciare
   *   selezionate SOLO le righe da rifare invece di svuotare la selezione come
   *   se fosse andato tutto bene. */
  onCambiaStato: (righe: Lead[], stato: LeadStatus) => Promise<string[]>;
  /** Lo stato scelto dalla pastiglia di UNA riga. Non restituisce niente e non
   *  è una dimenticanza: dall'altra parte la stessa chiamata può finire in tre
   *  modi diversi — scritta subito, oppure in attesa che si scelga un giorno e
   *  un'ora, oppure in attesa degli importi di una chiusura — e le ultime due
   *  finiscono quando l'utente chiude una finestra, non quando questa funzione
   *  ritorna. L'esito lo dice la pagina, con i suoi messaggi. */
  onStato: (l: Lead, s: LeadStatus) => void;
  /** Toglie UNA persona dall'archivio. `true` = è sparita davvero; `false` =
   *  l'archivio non l'ha tolta, e la conferma resta aperta per riprovare. */
  onEliminaUno: (l: Lead) => Promise<boolean>;
  /** Toglie le schede scelte, a lotti. Stessa disciplina di `onCambiaStato`:
   *  ⚠️ RESTITUISCE GLI ID NON ELIMINATI, che restano selezionati e a schermo. */
  onEliminaMolti: (righe: Lead[]) => Promise<string[]>;
  onApri: (l: Lead) => void;
}) {
  /** Lo stato su cui si sta filtrando. `null` = tutti. */
  const [filtro, setFiltro] = useState<LeadStatus | null>(null);
  /** ── ⚠️ DA QUANDO HA QUESTO STATO ───────────────────────────────────────
   *  Richiesta del committente: il filtro sul tempo c'era solo sulla coda di
   *  chiamata — quella che porta avanti una persona per volta — e non qui, che
   *  è l'elenco su cui si lavora a gruppi. Ma è proprio qui che serve di più:
   *  «segna non interessati tutti quelli a cui ho lasciato la segreteria la
   *  settimana scorsa» è un gesto di gruppo, non una telefonata.
   *  Stesso modulo della coda (crm/quando-stato): una sola idea di «quando»,
   *  o le due schermate risponderebbero diverso alla stessa domanda. */
  const [quando, setQuando] = useState<FettaTempo>("sempre");
  //  Il giorno di lavoro, non quello di Greenwich: vedi `giornoLocale`.
  const oggiQui = giornoLocale(new Date().toISOString());
  /** Lo stato scelto dal menu e non ancora confermato: finché è qui non è stato
   *  scritto niente da nessuna parte (vedi la regola 3 in cima). */
  const [proposto, setProposto] = useState<LeadStatus | null>(null);
  /** La riga che ha chiesto di essere eliminata e aspetta il secondo clic. È un
   *  id solo: due conferme aperte insieme in un elenco lungo sono due cestini
   *  armati, e si preme quello sbagliato. */
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  /** Vero quando è la SELEZIONE ad aver chiesto di essere eliminata. Sta a parte
   *  da `proposto` perché sono due frasi diverse nella stessa barra, e una alla
   *  volta: chi apre l'una spegne l'altra. */
  const [chiedeElimina, setChiedeElimina] = useState(false);
  /** Vero mentre un'eliminazione è in volo (riga o gruppo).
   *  ⚠️ NON SI RIUSA `inCorso`: quello è il cambio in massa della pagina, e
   *   spegnerlo per un'eliminazione — o viceversa — vorrebbe dire comandi
   *   spenti da un lavoro che non è il loro. */
  const [eliminando, setEliminando] = useState(false);

  /** ── QUESTO ELENCO RISPONDE A «QUANTE ME NE RESTANO» ────────────────────
   *  Mostrava OGNI scheda importata: 843 righe di cui 43 da telefonare, con
   *  dentro i 209 che avevano già detto no, gli appuntamenti già fissati e le
   *  vendite chiuse. Il numero in cima non si poteva usare per decidere niente
   *  — e chi apriva questa linguetta per sapere quanto lavoro restava leggeva
   *  una cifra venti volte più grande del vero.
   *  Adesso di riposo ci sono le schede in cui la PRIMA CHIAMATA È ANCORA
   *  APERTA, con la stessa definizione della coda (crm/types,
   *  `STATI_DA_CHIAMARE`): due idee diverse di «da chiamare» nella stessa
   *  schermata smettono presto di coincidere.
   *  ⚠️ Il resto non è sparito: è dietro un interruttore che DICE QUANTE sono.
   *   Serve ancora — è da qui che si segnano in gruppo i venti che hanno detto
   *   di no, ed è il solo posto che le mostra tutte insieme. Nascondere si può,
   *   nascondere senza dire quanto no. */
  const [ancheSistemati, setAncheSistemati] = useState(false);
  /*  ⚠️ CHI ASPETTA LA SUA DATA NON È «DA CHIAMARE» OGGI ────────────────
      Segnalazione del committente: «se lo metto da ricontattare fra due
      settimane deve uscire fino a quella data; ora continua a mostrarlo».
      Qui si guardava solo lo STATO: «richiamo» era da chiamare, fosse per
      oggi o fra due settimane — mentre la coda, che la regola ce l'aveva,
      lo saltava. La stessa persona spariva di là e restava di qua.
      La regola adesso è una sola (crm/importa/da-telefonare), e chi aspetta
      si ritrova con l'interruttore qui sotto, con scritto quando torna. */
  const daChiamare = useMemo(() => importati.filter((l) => daTelefonareOggi(l.data)), [importati]);
  const sistemati = importati.length - daChiamare.length;
  /*  ── ⚠️ CHI È STATO SISTEMATO ADESSO RESTA DOV'È ──────────────────────
      Segnalazione del committente: «qualsiasi cosa faccio su quel contatto
      scompare; se metto appuntamento fissato e chiudo il popup deve rimanere
      lì, perché significa che devo selezionare altro».
      L'elenco si ricalcolava nell'istante del salvataggio e la riga spariva
      sotto le dita: niente secondo gesto sulla stessa persona, nessun modo di
      distinguere «fatto» da «sparito per un errore», e le righe sotto che
      salgono di un posto mentre il dito sta già scendendo.
      La regola — e il perché — stanno in importa/elenco-stabile, dove si
      provano. ⚠️ Si filtra su `importati` e non si accoda in fondo: la riga
      deve restare AL SUO POSTO, se no il salto è lo stesso guaio di prima. */
  const base = useMemo(
    () =>
      importati.filter((l) =>
        restaNellElenco({
          daChiamare: eStatoDaChiamare(l.data?.stato),
          appenaSistemato: restano?.has(l.id),
          tuttiVisibili: ancheSistemati,
        }),
      ),
    [importati, restano, ancheSistemati],
  );

  /** Quanti per stato, sull'elenco INTERO: il numero sulla pastiglia deve dire
   *  quanti ne troverò premendola, quindi non può essere calcolato su un elenco
   *  già filtrato da lei stessa. */
  //  ⚠️ Si contano dentro la fetta di tempo scelta: il numero sulla pastiglia
  //   deve dire quanti ne troverò premendola, e con «ieri» acceso quelli di
  //   oggi non li troverò. Un conto che si smentisce al primo tocco non lo
  //   guarda più nessuno. È la stessa regola della coda di chiamata.
  const conteggi = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of base) {
      if (!dentroLaFetta(l.data, quando, oggiQui)) continue;
      const s = String(l.data?.stato ?? "");
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  }, [base, quando, oggiQui]);

  /** Quanti per fetta di tempo, dentro lo stato scelto: il verso opposto. */
  const contiQuando = useMemo(() => {
    const perStato = filtro ? base.filter((l) => l.data?.stato === filtro) : base;
    const m = new Map<FettaTempo, number>();
    for (const q of FETTE_TEMPO) {
      m.set(q, perStato.filter((l) => dentroLaFetta(l.data, q, oggiQui)).length);
    }
    return m;
  }, [base, filtro, oggiQui]);

  /** Le pastiglie: solo gli stati presenti, nell'ordine canonico di crm/types.
   *  ⚠️ QUELLA ACCESA C'È SEMPRE, anche se la coda lunga l'avrebbe tagliata
   *   fuori. Senza questa riga bastava cambiare stato all'ultima riga di un
   *   filtro raro per veder sparire la pastiglia che si stava usando: l'elenco
   *   restava filtrato su qualcosa che a schermo non si vedeva più, cioè una
   *   scheda che sembra vuota senza dire perché. */
  const statiPresenti = useMemo(() => {
    const fila = ALL_LEAD_STATUSES.filter((s) => (conteggi.get(s) ?? 0) > 0).slice(
      0,
      STATI_IN_FILA,
    );
    return filtro && !fila.includes(filtro) ? [...fila, filtro] : fila;
  }, [conteggi, filtro]);

  /** L'elenco a schermo. L'ordine è quello di tutte le code del CRM
   *  (`ordinaPerUrgenza`, la stessa urgenza di `prossimaAzione`): non se ne
   *  inventa un secondo qui, o la stessa lista avrebbe due «primi» a seconda
   *  della vista da cui la si guarda. È anche l'ordine su cui Maiusc+clic
   *  calcola il blocco — «da qui a lì» vuol dire quello che si vede. */
  const righe = useMemo(() => {
    const scelte = base.filter(
      (l) => (!filtro || l.data?.stato === filtro) && dentroLaFetta(l.data, quando, oggiQui),
    );
    return ordinaPerUrgenza(scelte);
  }, [base, filtro, quando, oggiQui]);

  const {
    selezione,
    selezionati,
    //  Quante righe prenderebbe «Seleziona tutti»: va SUL pulsante e non solo
    //  nel suggerimento a comparsa, che su un tablet non esiste. È l'altra metà
    //  del patto per cui il tetto è potuto cadere — si preme sapendo quante se
    //  ne stanno prendendo.
    quante,
    tuttiSelezionati,
    tettoStretto,
    oltreIlTetto,
    scegli,
    selezionaTutti,
    azzera,
    tieniSolo,
  } = useSelezioneRighe(righe);

  /** ── GLI STATI PROPONIBILI A QUESTA SELEZIONE ────────────────────────────
   *  L'intersezione fra ciò che si può dare in massa e ciò che ognuna delle
   *  schede scelte può davvero diventare (regola 2 in cima). */
  const statiProponibili = useMemo(() => {
    if (selezionati.length === 0) return [] as LeadStatus[];
    return STATI_IN_MASSA.filter((s) =>
      selezionati.every((l) => statiSelezionabili(l.data ?? {}).includes(s)),
    );
  }, [selezionati]);

  /** Una scrittura per volta, da qualunque parte arrivi. Mentre l'archivio sta
   *  cambiando venti schede non si deve poter armare un'eliminazione né cambiare
   *  stato a una riga: sarebbero due giri di salvataggi sugli stessi id. */
  const occupato = inCorso || eliminando || !!avanzamento;

  /** ── LE CONFERME IN SOSPESO CADONO INSIEME ──────────────────────────────
   *  Ogni gesto che cambia «su quante schede» o «quali righe» annulla ciò che
   *  era stato proposto e non ancora confermato: la barra dice «su 12 schede» e
   *  «elimino 12 schede», e se nel frattempo diventano 30 quelle due frasi sono
   *  false. Vale anche per la conferma di riga: un clic altrove è un ripensamento
   *  — e un cestino che resta armato mentre si guarda un'altra riga è il modo
   *  più facile per cancellare la persona sbagliata. */
  const annullaConferme = () => {
    setProposto(null);
    setChiedeElimina(false);
    setDaEliminare(null);
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
  const cambiaFiltro = (s: LeadStatus | null) => {
    //  ⚠️ Cambiando filtro la selezione NON si svuota: si ricalcola sulle righe
    //   che restano (lo fa `useSelezioneRighe`). Chi prende venti «Non risponde»
    //   e poi guarda un altro stato non ha perso niente — e la barra in basso
    //   continua a dire il numero giusto, perché conta solo quello che si vede.
    annullaConferme();
    setFiltro(s);
  };

  /** Propone uno stato dal menu di gruppo. Passa da qui e non da `setProposto`
   *  diretto perché ⚠️ IL CESTINO DI UNA RIGA POTEVA RESTARE ARMATO DIETRO
   *  QUESTA CONFERMA: si arma il cestino della riga 7 (che azzera la barra), si
   *  apre «Cambia stato», si conferma — e a lavoro finito, in un elenco che nel
   *  frattempo si è riordinato, quel tasto rosso è ancora acceso su una riga che
   *  non si sta più guardando. Una domanda per volta in tutta la scheda. */
  const proponi = (s: LeadStatus) => {
    setDaEliminare(null);
    setChiedeElimina(false);
    setProposto(s);
  };

  const conferma = async () => {
    if (!proposto || selezionati.length === 0 || occupato) return;
    const rimasti = await onCambiaStato(selezionati, proposto);
    //  Cadono TUTTE le conferme, non solo quella appena eseguita: l'elenco si è
    //  appena riordinato sotto (le righe cambiate escono dal filtro acceso) e
    //  una domanda armata prima punterebbe a una riga che adesso sta altrove.
    annullaConferme();
    //  ⚠️ RESTA SELEZIONATO SOLO CHI NON È CAMBIATO. Le altre escono dalla
    //   selezione perché sono a posto; queste restano scelte e sotto gli occhi,
    //   così si riprova senza ricercarle una per una — ed è anche il segno che
    //   qualcosa non è andato, oltre al messaggio che lo dice.
    tieniSolo(rimasti);
  };

  /** Arma il cestino di una riga: non elimina niente, apre la domanda. */
  const chiediElimina = (id: string) => {
    if (occupato) return;
    setProposto(null);
    setChiedeElimina(false);
    setDaEliminare(id);
  };

  /** Lo stesso primo passo, per la selezione: apre la domanda nella barra. Una
   *  domanda alla volta in tutta la scheda — quella di riga si chiude. */
  const chiediEliminaGruppo = () => {
    if (occupato) return;
    setProposto(null);
    setDaEliminare(null);
    setChiedeElimina(true);
  };

  const eliminaRiga = async (l: Lead) => {
    if (occupato) return;
    setEliminando(true);
    try {
      const fatto = await onEliminaUno(l);
      //  Andata: la riga esce da `importati` e sparisce da sé, non c'è niente da
      //  chiudere — si azzera l'id per non lasciare armato un cestino che punta
      //  a una persona che non c'è più.
      //  ⚠️ NON ANDATA: LA CONFERMA RESTA APERTA. Chiuderla anche in caso di
      //   errore vorrebbe dire una riga tornata come prima senza una domanda a
      //   cui rispondere, cioè un'eliminazione che sembra riuscita.
      if (!fatto) return;
      setDaEliminare(null);
      //  L'elenco si è accorciato: una proposta di stato ancora in sospeso
      //  direbbe «su N schede» con la N di un momento fa.
      setProposto(null);
    } finally {
      setEliminando(false);
    }
  };

  const confermaElimina = async () => {
    if (selezionati.length === 0 || occupato) return;
    setEliminando(true);
    try {
      const rimasti = await onEliminaMolti(selezionati);
      annullaConferme();
      //  ⚠️ RESTA SELEZIONATO SOLO CHI NON È STATO ELIMINATO, come dopo un
      //   cambio di stato fallito: chi è sparito esce dall'elenco da solo, chi
      //   è rimasto resta scelto e sotto gli occhi per un secondo tentativo.
      tieniSolo(rimasti);
    } finally {
      setEliminando(false);
    }
  };

  if (importati.length === 0) {
    return (
      <Vuoto
        titolo="Nessuna lista importata"
        testo="Qui compaiono TUTTI i contatti arrivati da un file, qualunque stato abbiano: quelli ancora da chiamare, quelli già chiusi, quelli messi da parte. Da qui si prendono a gruppi e si cambia loro lo stato in un gesto solo."
        icona={ListChecks}
      />
    );
  }

  return (
    <>
      <Scheda
        titolo={ancheSistemati ? "Tutti i lead importati" : "Da chiamare, di tutte le liste"}
        nota={
          filtro
            ? `${righe.length} con stato «${etichettaStato(filtro)}» su ${base.length}`
            : ancheSistemati
              ? `${importati.length} arrivati da una lista, compresi i già sistemati · clic sulla riga per prenderla, Maiusc+clic per un blocco, clic sullo stato per cambiarlo`
              : `${base.length} con la prima chiamata ancora aperta · clic sulla riga per prenderla, Maiusc+clic per un blocco, clic sullo stato per cambiarlo`
        }
        icona={ListChecks}
        azioni={
          <>
            {/*  ── DUE LENTI, NON UN INTERRUTTORE ──────────────────────────
                ⚠️ QUI C'ERA UN PULSANTE SOLO — «Anche i già sistemati · 800» —
                 e diceva la cosa giusta nel modo sbagliato: un interruttore
                 spento non mostra quale sia l'altra vista, quindi «fammi vedere
                 TUTTI i lead importati» sembrava una cosa che questa scheda non
                 sapeva fare. Il committente l'ha richiesta da zero, che è la
                 prova che di fatto non si trovava.
                 Adesso sono due lenti affiancate, ognuna col suo numero, e si
                 legge in un colpo sia dove si è sia cosa c'è dall'altra parte:
                 «Da chiamare · 43» e «Tutti · 843». Il gesto è lo stesso di
                 tutte le lenti del CRM — la fila di pastiglie — e il conto
                 risponde alla domanda per cui questa scheda esiste: quanto mi
                 resta da telefonare.
                 ⚠️ Restano DUE e non tre: «solo i già sistemati» non è una
                  domanda che si fa nessuno, e una lente che non si preme mai
                  toglie spazio alle due che si premono. */}
            {sistemati > 0 && (
              <>
                <Segmento
                  attivo={!ancheSistemati}
                  conteggio={daChiamare.length}
                  onClick={() => setAncheSistemati(false)}
                  titolo="Solo chi si telefona OGGI: la prima chiamata è ancora aperta e non c'è una promessa per un altro giorno. Chi hai rimandato torna qui il giorno che gli hai detto"
                >
                  Da chiamare
                </Segmento>
                <Segmento
                  attivo={ancheSistemati}
                  conteggio={importati.length}
                  onClick={() => setAncheSistemati(true)}
                  titolo="Tutti i contatti arrivati da una lista, in qualunque stato: appuntamenti fissati, vendite chiuse, chi ha già detto di no e chi aspetta la sua data di richiamo"
                >
                  Tutti
                </Segmento>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[12px]"
              disabled={occupato || righe.length === 0}
              onClick={prendiTutti}
              title={
                tettoStretto
                  ? //  ⚠️ QUI PRIMA C'ERA SCRITTO «ne prende 50 per volta». Adesso le
                    //  prende tutte: quello che va detto non è più un limite, è che
                    //  il lavoro di gruppo si scriverà a lotti e che il conto si
                    //  vede — vedi la nota sul tetto in cima.
                    `Prende tutte e ${righe.length} le righe che si vedono. Sopra le ${TETTO_SELEZIONE} il lavoro di gruppo si scrive a lotti, e il conto compare nella barra in basso`
                  : "Prende tutte le righe che si vedono adesso, cioè quelle del filtro acceso"
              }
            >
              {testoSelezionaTutti(tuttiSelezionati, tettoStretto, quante)}
            </Button>
          </>
        }
        senzaPadding
      >
        {/* ── LE PASTIGLIE DEGLI STATI ────────────────────────────────────
            Sono il filtro, e sono anche il conto: «quanti non rispondono» si
            legge senza premere niente. Stanno DENTRO la scheda e non sopra
            perché filtrano questo elenco e nient'altro — la fila di linguette
            che sta sopra cambia vista, e due file di pulsanti simili a due
            centimetri di distanza si confondono. */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
          {/*  ⚠️ SPENTE MENTRE UNA SCRITTURA DI GRUPPO STA LAVORANDO. Il
              filtro decide QUALI righe si vedono, e la selezione — insieme al
              conto della barra — si ricalcola su quelle: cambiarlo a metà di un
              lotto da trecento può portare a zero le righe selezionate, e con
              loro sparisce la barra, cioè l'unico posto in cui si legge
              «Scrivo… 40/300». Resterebbe una scheda con tutti i comandi spenti
              e niente che spieghi perché. In più le righe rifiutate non
              potrebbero più «restare selezionate e sotto gli occhi» (regola 3),
              perché sotto gli occhi ci sarebbe un'altra fetta di elenco. */}
          <Segmento
            attivo={filtro === null}
            onClick={() => cambiaFiltro(null)}
            conteggio={importati.length}
            disabilitato={occupato}
            titolo="Tutti i contatti arrivati da una lista, qualunque stato abbiano"
          >
            Tutti
          </Segmento>
          {statiPresenti.map((s) => (
            <Segmento
              key={s}
              attivo={filtro === s}
              onClick={() => cambiaFiltro(s)}
              conteggio={conteggi.get(s) ?? 0}
              disabilitato={occupato}
              titolo={`Solo chi è «${LEAD_STATUS_LABEL[s]}»`}
            >
              {LEAD_STATUS_LABEL[s]}
            </Segmento>
          ))}
        </div>

        {/* ── ⚠️ DA QUANDO ─────────────────────────────────────────────────
            Richiesta del committente: il filtro sul tempo c'era solo sulla
            coda di chiamata, quella che porta avanti una persona per volta.
            Ma è QUI che serve di più: «segna non interessati tutti quelli a
            cui ho lasciato la segreteria la settimana scorsa» è un gesto di
            gruppo, e senza il tempo lo si fa a memoria guardando le date riga
            per riga.
            ⚠️ Sotto le pastiglie degli stati e più piccola: sono due domande
             in ordine — prima QUALE stato, poi DA QUANDO — e appiattirle in
             un'unica fila di bottoni uguali vorrebbe dire scelte pari fra cui
             scegliere a caso.
            ⚠️ Compare solo se serve: quando tutto l'elenco è di oggi, «oggi» e
             «sempre» danno la stessa cosa e la riga sarebbe ingombro.
            ⚠️ Spenta durante una scrittura di gruppo, per la stessa ragione
             delle pastiglie qui sopra: cambiare la fetta di elenco a metà di
             un lotto porta a zero la selezione e con lei sparisce la barra che
             dice «Scrivo… 40/300». */}
        {(contiQuando.get("oggi") ?? 0) !== base.length && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-1.5">
            <span className="pr-0.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
              Da quando
            </span>
            {FETTE_TEMPO.map((q) => {
              const quante = contiQuando.get(q) ?? 0;
              const acceso = quando === q;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuando(q)}
                  disabled={occupato || (quante === 0 && !acceso)}
                  aria-pressed={acceso}
                  title={SPIEGA_FETTA_TEMPO[q]}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition",
                    acceso
                      ? "border-foreground/30 bg-foreground/[0.05] font-semibold text-foreground"
                      : "border-border/70 bg-card font-medium text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                    (occupato || (quante === 0 && !acceso)) && "cursor-not-allowed opacity-45",
                  )}
                >
                  <span className="whitespace-nowrap">{NOME_FETTA_TEMPO[q]}</span>
                  <span
                    className={cn(
                      "tabular-nums",
                      acceso ? "text-foreground/70" : "text-muted-foreground/70",
                    )}
                  >
                    {quante}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {righe.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            {/*  ⚠️ Dice QUALE filtro sta togliendo di mezzo: «nessuno con
                questo stato» davanti a un elenco pieno, con «ieri» acceso, fa
                credere che le schede siano sparite. */}
            Nessuno con questi filtri
            {quando === "sempre" ? "" : ` (${NOME_FETTA_TEMPO[quando].toLowerCase()})`}.
          </p>
        ) : (
          /*  L'elenco scorre DENTRO la scheda e non allunga la pagina: con
              trecento righe il resto della schermata — le linguette delle viste,
              la testata con i numeri — finirebbe fuori dallo schermo, e la barra
              delle azioni di gruppo si raggiungerebbe solo scorrendo fino in
              fondo. */
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {righe.map((l) => {
              const d = l.data ?? ({} as LeadData);
              const nome = nomeDi(d);
              const chiedeConferma = daEliminare === l.id;
              return (
                <RigaSelezionabile
                  key={l.id}
                  scelta={selezione.has(l.id)}
                  etichetta={nome}
                  onScegli={(blocco) => scegliRiga(l.id, blocco)}
                  azioni={
                    chiedeConferma ? (
                      /*  ── LA DOMANDA PRENDE IL POSTO DEI COMANDI ───────────
                          Stato e «apri scheda» spariscono finché la domanda è
                          aperta, per due motivi: la riga non ha larghezza per
                          cinque comandi — la frase col nome finirebbe tagliata
                          proprio dove serve — e soprattutto il tasto rosso non
                          deve avere vicini premibili. Chi risponde «No» li
                          ritrova tutti dov'erano. */
                      <>
                        <span className="max-w-[170px] shrink-0 truncate text-[11.5px] font-medium text-rose-700">
                          Elimino {nome}?
                        </span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 shrink-0 px-2 text-[12px]"
                          disabled={occupato}
                          onClick={() => void eliminaRiga(l)}
                          title={`Toglie ${nome} dall'archivio: non c'è un cestino da cui ripescarlo`}
                        >
                          {eliminando ? "Elimino…" : "Elimina"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0 px-2 text-[12px]"
                          disabled={eliminando}
                          onClick={() => setDaEliminare(null)}
                          title="Lascia stare: la scheda resta dov'è"
                        >
                          No
                        </Button>
                      </>
                    ) : (
                      <>
                        {/*  Lo stato È il comando per cambiarlo: la griglia con
                            tutti gli stati buoni per questa scheda la porta la
                            pastiglia, e il giorno, l'ora o gli importi li chiede
                            la pagina da sé (vedi `onStato`). La pastiglia ferma
                            il clic prima che arrivi alla riga, quindi cambiare
                            stato non seleziona anche la riga sotto le dita. */}
                        <PastigliaStato
                          dati={d}
                          contesto={nome}
                          onScegli={(s) => onStato(l, s)}
                          disabilitata={occupato}
                          className="max-w-[160px] shrink-0"
                        />
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
                        {/*  ⚠️ GRIGIO A RIPOSO, rosso solo quando si passa sopra
                            e nella conferma: in un elenco di trecento righe
                            un'icona rossa fissa è rumore, e il rumore si smette
                            di leggere proprio dove non si dovrebbe. */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0 px-2 text-[12px] text-muted-foreground hover:text-rose-600"
                          disabled={occupato}
                          onClick={() => chiediElimina(l.id)}
                          aria-label={`Elimina ${nome} dall'archivio`}
                          title="Elimina dall'archivio (chiede conferma)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )
                  }
                >
                  <span className="block truncate text-[13px] font-medium">{nome}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {sottoTesto(
                      l,
                      inCoda.has(l.id),
                      targhettaSistemato({
                        daChiamare: eStatoDaChiamare(l.data?.stato),
                        appenaSistemato: restano?.has(l.id),
                        tuttiVisibili: ancheSistemati,
                      }),
                    )}
                  </span>
                </RigaSelezionabile>
              );
            })}
          </ul>
        )}
      </Scheda>

      {/*  La stessa barra delle azioni di gruppo del resto del CRM, nello stesso
          posto: da qui passano le operazioni che toccano venti righe insieme. */}
      <BarraSelezione conteggio={selezionati.length} onAnnulla={togliTutti}>
        {avanzamento ? (
          /*  ── IL CONTO, AL POSTO DEL RIFIUTO ─────────────────────────────
              ⚠️ QUI PRIMA C'ERA «Troppe insieme: togline 262», e non si
              scriveva niente. Il motivo era vero — trecento salvataggi uno
              dietro l'altro sono un minuto di pagina ferma — ma la risposta era
              vietare il gesto a chi il lavoro ce l'aveva davvero. Adesso la
              pagina scrive a lotti e qui si legge a che punto è: stessa forma
              del «Importazione… 40/312» del pannello di caricamento, perché è
              lo stesso fatto detto due volte nella stessa schermata.
              Il numero a sinistra («N selezionate») cala man mano che le righe
              eliminate escono dall'elenco: è la stessa cosa vista dall'altra
              parte, non una contraddizione. */
          <span className="px-1 text-[12px] tabular-nums" aria-live="polite">
            Scrivo… <b>{avanzamento.fatti}</b>/{avanzamento.totale}
          </span>
        ) : chiedeElimina ? (
          <>
            {/*  ⚠️ IL TASTO ROSSO STA PRIMO, A SINISTRA DI TUTTO. Qui c'era il
                 ragionamento opposto — «la frase sta prima e spinge via il
                 rosso dal punto appena premuto» — ed era sbagliato:
                 `BarraSelezione` è centrata (`mx-auto w-fit`, crm/ui), quindi
                 quando la barra si allunga il bordo destro va a destra E quello
                 sinistro va a sinistra. La frase non spingeva il rosso lontano
                 dal cestino grigio: glielo portava addosso, perché quel cestino
                 stava sulla destra della barra corta. Messo per primo, il rosso
                 finisce dove un attimo fa non c'era nemmeno la barra; e in fondo
                 resta «Lascia stare», cioè proprio sotto il dito che ha appena
                 premuto — è la disposizione delle righe, dove il doppio clic
                 per inerzia annulla e non cancella. */}
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-[12px]"
              disabled={occupato}
              onClick={() => void confermaElimina()}
            >
              {eliminando
                ? "Elimino…"
                : `Elimina ${selezionati.length === 1 ? "1 scheda" : `${selezionati.length} schede`}`}
            </Button>
            <span className="max-w-[24rem] px-1 text-[12px] leading-snug">
              <b>dall'archivio</b>. Non si torna indietro: non c'è nessun cestino da cui ripescarle.
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12px]"
              disabled={eliminando}
              onClick={() => setChiedeElimina(false)}
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Lascia stare
            </Button>
          </>
        ) : proposto ? (
          /*  ── LA CONFERMA ────────────────────────────────────────────────
              Dice il numero e lo stato per esteso, prima di scrivere. Non è una
              finestra: una finestra in mezzo a una giornata al telefono si
              chiude a occhi chiusi, mentre una frase nella barra che si sta già
              guardando si legge. */
          <>
            <span className="max-w-[24rem] px-1 text-[12px] leading-snug">
              Metto <b>«{LEAD_STATUS_LABEL[proposto]}»</b> su{" "}
              {selezionati.length === 1 ? "1 scheda" : `${selezionati.length} schede`}.
              {/*  Sopra il tetto non è più un no: è un avviso su COME andrà,
                  cioè a lotti, con il conto che compare qui al posto di questa
                  frase. */}
              {oltreIlTetto &&
                ` Sono più di ${TETTO_SELEZIONE}: le scrivo a lotti, e qui compare a che punto sono.`}
            </span>
            <Button
              size="sm"
              className="h-8 text-[12px]"
              disabled={occupato}
              onClick={() => void conferma()}
            >
              {inCorso ? "Scrivo…" : "Conferma"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12px]"
              disabled={occupato}
              onClick={() => setProposto(null)}
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Lascia stare
            </Button>
          </>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-[12px]" disabled={occupato}>
                  Cambia stato <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-64">
                <DropdownMenuLabel>
                  A {selezionati.length === 1 ? "1 scheda" : `${selezionati.length} schede`}
                </DropdownMenuLabel>
                {statiProponibili.length > 0 ? (
                  statiProponibili.map((s) => (
                    <DropdownMenuItem key={s} onSelect={() => proponi(s)}>
                      {LEAD_STATUS_LABEL[s]}
                    </DropdownMenuItem>
                  ))
                ) : (
                  /*  Voce SPENTA e non premibile: dentro un menu una riga che si
                      può cliccare promette un cambio di stato, e qui non ce n'è
                      nessuno da fare. Capita davvero — basta mescolare una riga
                      ancora da chiamare con una già diventata trattativa. */
                  <DropdownMenuItem disabled className="whitespace-normal text-[11px] leading-snug">
                    Le schede scelte sono a punti diversi del percorso e non hanno nessuno stato in
                    comune da dare a tutte. Restringi la selezione, o cambiale una per una dalla
                    loro pastiglia.
                  </DropdownMenuItem>
                )}
                {/*  ⚠️ COSA NON C'È E DOVE STA. Senza questa riga l'assenza di
                    «Appuntamento fissato» dal menu si legge come una
                    dimenticanza, e si va a cercarla altrove; scritta, si capisce
                    in una riga che quello stato chiede una data — e una data
                    sola su venti persone sarebbe sbagliata per diciannove di
                    loro. Adesso dice anche dove trovarlo: sulla riga, dove la
                    data si chiede a quella persona sola. */}
                <p className="flex items-start gap-1.5 border-t border-border px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  Gli stati che chiedono un giorno, un'ora o degli importi — appuntamenti, richiami,
                  acconti, vendite — non sono qui: si danno una scheda per volta, premendo lo stato
                  sulla sua riga, perché quel dato è di quella persona.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
            {/*  ⚠️ IL CESTINO DI GRUPPO È L'ULTIMO E NON È ROSSO. Il rosso
                arriva con la conferma, che è anche in un altro punto della
                barra: due bersagli distinti per due passi distinti. */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12px] text-muted-foreground hover:text-rose-600"
              disabled={occupato}
              onClick={chiediEliminaGruppo}
              title="Toglie dall'archivio le schede selezionate: chiede conferma, e da lì non si torna indietro"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Elimina
            </Button>
          </>
        )}
      </BarraSelezione>
    </>
  );
}
