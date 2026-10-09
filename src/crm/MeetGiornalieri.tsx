// ── L'AGENDA, GIORNO PER GIORNO ─────────────────────────────────────────────
//  La domanda a cui questa sezione risponde è una sola: "com'è fatta la
//  giornata — chi devo ancora sentire, chi ho già sentito, chi è mancato".
//  Tutto ciò che è ARRETRATO (non presentati di ieri, ricontatti scaduti,
//  appuntamenti rimasti senza esito) NON sta più qui: sta in cima alla
//  dashboard, in "Da recuperare". Prima le due cose erano mescolate e il
//  risultato era che l'arretrato — l'unica parte urgente — si leggeva per
//  ultimo, in fondo alla pagina.
//
//  COME È FATTA, e perché:
//   · una BARRA DEL GIORNO chiusa, che di norma dice "Oggi" e basta: la
//     schermata si apre sulla giornata in corso, che è la domanda del mattino.
//     Un tocco sulla barra apre il MESE INTERO — dal primo all'ultimo giorno,
//     con le frecce per cambiare mese — perché ogni tanto serve anche "e
//     giovedì prossimo?", e prima quella domanda costava sei frecce o un salto
//     alla pagina Agenda. Prima la fila dei giorni (due indietro, oggi, sei
//     avanti) stava sempre aperta: nove pastiglie da leggere ogni volta per
//     scegliere, quasi sempre, quella di mezzo;
//   · in fondo alla stessa striscia, TUTTO LO STORICO: tutte le date
//     dall'inizio fino a oggi in un elenco solo, per la domanda che il
//     calendario non sa fare — «quante ne abbiamo svolte, da sempre». Da
//     acceso la striscia dei giorni sparisce (non si sta scegliendo un giorno),
//     i tre totali contano tutto lo storico, le righe portano la data oltre
//     all'ora e vanno dalla più recente all'indietro. Le frasi che parlano di
//     una giornata sola — «Da fare», «Esiti di oggi», i conti alla rovescia —
//     cambiano o spariscono: una frase falsa è peggio della funzione mancante;
//   · tre gruppi netti — DA FARE · SVOLTI · NON SVOLTI — invece di un elenco
//     unico ordinato per ora: sono tre tipi di lavoro diversi, e mescolarli
//     costringe a leggere ogni riga per capire quale sia quale;
//   · il filtro per consulente è CONDIVISO con il resto della dashboard (arriva
//     dall'alto): filtrare l'agenda su una persona e vedere gli arretrati di
//     tutti era il modo più rapido per lavorare sui contatti di un collega;
//   · su ogni riga il taccuino delle NOTE DOPO LA CONSULENZA (campo
//     `notePostCall`, quello di sempre): si scrivono nei due minuti fra una
//     consulenza e l'altra, e il tasto dice da fuori se dentro c'è già qualcosa.
//
//  UNA REGOLA DI LETTURA, VALIDA PER TUTTA LA PAGINA: ciò che è SEGNATO —
//  l'esito premuto, la lente accesa — si riconosce da una tinta piena E da una
//  spunta, mai dalla sola parola scritta sopra. Su venti righe la parola si
//  legge una alla volta; la forma si vede tutta insieme.
//
//  Un meeting non è una riga a sé: è LO STATO del lead letto in chiave agenda —
//  no_show resta no-show, appuntamento fissato è da fare, tutto il resto è
//  fatto. Così non esiste il caso "meeting completato ma lead ancora da
//  contattare": non ci sono due verità da tenere allineate.
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  //  ── PERCHÉ `History` E NON `CalendarRange` O `Layers` ────────────────────
  //   `CalendarRange` disegna un INTERVALLO scelto (dal…al…), e qui non si
  //   sceglie niente: si guarda tutto. `Layers` sono strati sovrapposti, che
  //   nel CRM non vogliono dire niente. `History` — la freccia che gira
  //   all'indietro sull'orologio — è già la faccia di «roba dei giorni
  //   passati» in questa stessa dashboard (è l'icona di «Da recuperare» in
  //   routes/CRM.index): un solo segno per un solo significato.
  History,
  MessageCircle,
  NotebookPen,
  Phone,
  PhoneOff,
  Play,
  Send,
  Star,
  Undo2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { intestazioniCRM, fetchCRM } from "./AuthContext";
//  ⚠️ DA QUI IN POI QUESTO FILE VUOLE IL CRMProvider SOPRA DI SÉ. Le note dopo
//  la consulenza si salvano con `updateLead`, che è l'unico punto da cui passano
//  tutte le modifiche di un lead (ci scrive `statoPrecedente`, ci gira
//  `applyAutoStatus`, e da lì l'elenco in memoria si aggiorna da solo). Scrivere
//  su Supabase da qui sarebbe stato più corto e avrebbe lasciato la riga a
//  mostrare il vecchio testo fino al ricaricamento della pagina.
//  Chi riusa `RigaLead` o `SchedaAdesso` fuori dalla dashboard deve quindi
//  restare dentro il provider: senza, `useCRM` solleva un errore.
import { useCRM } from "./CRMContext";
//  La textarea delle finestre, con il `text-base` sotto i 640px che impedisce a
//  iOS di ingrandire la pagina al primo tocco sul campo. Presa dov'è già
//  definita invece di riscriverne una quarta versione.
import { CLASSI_AREA } from "./SchedaCliente";
import { Finestra } from "./ui/Finestra";
//  Le stesse porte che usa la pagina pubblica dell'invito per leggere una data
//  e un'ora dell'archivio: qui servono a decidere se il tasto ha senso, e sono
//  volutamente LE STESSE — se la riga e la pagina giudicassero "leggibile" con
//  due regole diverse, il tasto comparirebbe proprio dove la pagina non sa
//  cosa scrivere.
import { depositaAnteprimaBiglietto, depositaAnteprimaPerLead } from "./anteprima-link";
import { BigliettoPannello } from "./BigliettoPannello";
import type { DatiBiglietto } from "./biglietto";
import {
  DURATA_PREDEFINITA,
  dataPulita as dataInvitoPulita,
  durataPulita,
  nomeDiBattesimo,
  oraPulita as oraInvitoPulita,
} from "./invito";
import type { Consultant, Lead } from "./types";
//  Chi può fare una consulenza si chiede a un posto solo: vedi la testata di
//  crm/chi-fa-la-consulenza per il perché il filtro non si riscrive qui.
import { NotaSoloConsulenti, consulentiPerConsulenza } from "./chi-fa-la-consulenza";
import {
  buildLinkConsulenzaMessage,
  codiceStanzaDi,
  haStanzaNostra,
  buildMeetReminderMessage,
  etichettaPromemoria,
  promemoriaUtile,
  buildWhatsAppLink,
  getWhatsAppMessageForStatus,
} from "./whatsapp";
//  eStatoNonSvolta (crm/types) è IL criterio di "svolta", scritto una volta
//  sola: qui non si riscrive l'elenco degli stati negativi, lo si chiede a lui.
import { TastoMessaggio } from "./TastoMessaggio";
import { LEAD_STATUS_LABEL, eAppuntamento, eStatoNonSvolta, type LeadStatus } from "./types";
//  Forma della pastiglia, colori dell'esito e filtri a segmento arrivano dal
//  linguaggio comune: se restano qui, l'agenda e l'elenco lead ricominciano a
//  colorare la stessa cosa in due modi.
//  `giorniDaOggi` è LA PORTA per leggere una data dell'archivio: restituisce
//  NaN quando la data non si legge, e "non lo so" non è "oggi". Serve qui a due
//  cose — tenere fuori dai conteggi del calendario le date storte dell'import,
//  e trasformare una casella del mese nello scarto rispetto a oggi.
import {
  dataBreve,
  BadgeCarico,
  CLASSE_BADGE_STATO,
  ChipAttesa,
  ESITI,
  LENTI_ESITO,
  Segmento,
  VuotoRiga,
  classiRigaStato,
  classiStato,
  giorniDaOggi,
  type ChiaveEsito,
} from "./ui";
//  IL SELETTORE DI STATO È UNO SOLO IN TUTTO IL CRM (crm/SelettoreStatoDialog).
//  Qui c'erano due <select> nativi — la riga e il riquadro "Adesso" — cioè
//  quindici voci in colonna, che sul telefono aprono la rotella di sistema.
//  `statiSelezionabili` è la stessa funzione che usa la finestra: `statiPer`
//  più lo stato attuale quando è uno di quelli storici.
import { PastigliaStato } from "./SelettoreStatoDialog";

type Esito = "programmato" | "completato" | "no_show";

/** ── I TRE TOTALI, DETTI AL PLURALE ────────────────────────────────────────
 *  Sotto un numero l'etichetta va al plurale ("3 · Clienti assenti"), e
 *  soprattutto va detta senza ambiguità: `ESITI[].breve` diceva "Non svolte",
 *  che si legge come "consulenze andate male" mentre nove volte su dieci il
 *  fatto è che il cliente non c'era. Qui i tre riquadri dicono le stesse parole
 *  della pastiglia di stato della riga — "Cliente assente", "Da riprogrammare" —
 *  così il numero e le righe che ci stanno dietro si chiamano allo stesso modo.
 *  Vive in questo file e non in crm/ui perché è l'unico punto in cui l'esito
 *  compare come conteggio; altrove è un pulsante, e lì la sigla basta. */
const ETICHETTA_TOTALE: Record<ChiaveEsito, string> = {
  fatto: "Svolte",
  no_show: "Clienti assenti",
  da_spostare: "Da riprogrammare",
};

/** La frase che spiega il numero, sul passaggio del mouse e al lettore di
 *  schermo. "Svolte" è il totale che verrà controllato per primo: deve poter
 *  dire da solo che cosa ha contato, senza che qualcuno debba aprire il codice.
 *
 *  ⚠️ PRENDE L'AMBITO DA FUORI, e non è un vezzo: qui dentro c'era scritto
 *  «tutti gli appuntamenti DEL GIORNO», e su «tutto lo storico» quella frase
 *  restava attaccata al numero più controllato della pagina — spiegava un
 *  totale di sette mesi dicendo che era di una giornata. È la stessa bugia di
 *  «Esiti di oggi», solo nascosta nel titolo e nell'etichetta del lettore di
 *  schermo, cioè nei due posti che nessuno rilegge. L'ambito arriva dal
 *  chiamante perché è LUI a sapere che cosa sta mostrando; le altre due frasi
 *  non ne hanno bisogno (un cliente assente è un cliente assente in qualsiasi
 *  insieme) e lo ignorano. */
const SPIEGAZIONE_TOTALE: Record<ChiaveEsito, (ambito: string) => string> = {
  fatto: (ambito) =>
    `tutti gli appuntamenti ${ambito} tranne i clienti assenti e quelli da riprogrammare: venduto, acconto, visita in sede, in valutazione, ricontatto fissato — la consulenza c'è stata`,
  no_show: () => "non si è presentato nessuno: si recuperano con una telefonata",
  da_spostare: () => "l'incontro è saltato e aspetta una data nuova",
};

/** Lo stato del lead, letto come esito dell'appuntamento.
 *  Esportata e usata anche dalle pagine del consulente: due funzioni diverse
 *  per decidere se una consulenza è stata fatta produrrebbero due agende
 *  diverse per la stessa giornata. */
export function esitoDi(l: Lead): Esito {
  //  Lettura difensiva: questa funzione gira dentro conteggi al montaggio della
  //  pagina, e una scheda arrivata dall'archivio senza `data` non deve poter
  //  buttare giù l'intera giornata. Senza stato la scheda vale "programmato",
  //  cioè resta fra le cose da guardare invece di sparire in silenzio.
  const s = l?.data?.stato;
  //  "Cliente assente" e "Consulenza non svolta" sono la stessa cosa vista da
  //  due lati: nessuno dei due si è svolto, e il gesto di recupero è lo stesso —
  //  una telefonata.
  //  "Da riprogrammare" sta anch'esso fra i NON SVOLTI, e non fra quelli da
  //  fare: un appuntamento senza data nuova non si svolge, e restando fra i "da
  //  fare" gonfiava il numero della giornata con lavoro che non esiste. Ci
  //  resta finché non gli si dà una data — e da lì torna da solo fra i
  //  programmati.
  //  Sono nello stesso gruppo ma NON sono la stessa cosa, e il colore lo dice:
  //  arancione = da rifissare (si recupera con il calendario), rosso = perso
  //  (si recupera al telefono). Vedi classiRigaStato in crm/ui.
  //  L'elenco dei due (più il vecchio non_fatto) sta in crm/types: qui si legge,
  //  lì si decide — due copie della stessa regola diventano due agende diverse.
  if (eStatoNonSvolta(s)) return "no_show";
  //  `!s` sta qui e non altrove: una scheda senza stato non è una consulenza
  //  svolta — è una riga da guardare, e va fra quelle da fare.
  //  Anche «Appuntamento rifissato» è un appuntamento che deve ancora
  //  succedere: senza `eAppuntamento` un cliente di ritorno sarebbe nato
  //  «completato», cioè con la consulenza già data per svolta il giorno stesso
  //  in cui la si è fissata.
  if (!s || eAppuntamento(s)) return "programmato";
  return "completato";
}

/** ── COSA CONTA COME "SVOLTA" — IL CRITERIO, PER ESTESO ────────────────────
 *  Questo è il numero più controllato della pagina, quindi il criterio sta
 *  scritto qui una volta sola e lo usano sia i tre totali sia le tre lenti.
 *
 *  Regola del committente: «contano tutte come consulenze svolte tranne quei 2
 *  stati». Cioè, di un appuntamento del giorno:
 *   · CLIENTE ASSENTE  → no_show (e il vecchio non_fatto, che dice la stessa
 *     cosa e nell'archivio esiste ancora): il cliente non c'era, la consulenza
 *     non è avvenuta;
 *   · DA RIPROGRAMMARE → da_spostare: l'incontro è saltato e aspetta una data
 *     nuova, quindi non è avvenuto nemmeno lui;
 *   · TUTTO IL RESTO   → SVOLTA. Venduto, acconto incassato, visita in sede,
 *     visita in sede disdetta, "sta valutando", ricontatto fissato, trattativa
 *     in chat, non interessato, chiusa — e le schede storiche segnate "fatto":
 *     sono tutti esiti di una consulenza che È STATA FATTA. Prima contava solo
 *     lo stato "fatto", e chi segnava subito il venduto si vedeva sparire la
 *     consulenza dal totale della giornata. Quello stato ora non si assegna
 *     nemmeno più: «svolta» si calcola, non si dichiara.
 *
 *  L'UNICA COSA CHE NON È NÉ SVOLTA NÉ NON SVOLTA è l'appuntamento ancora in
 *  piedi ("Appuntamento fissato"): non è un esito, è lavoro che deve ancora
 *  succedere. Contarlo fra le svolte avrebbe detto "10 svolte" alle otto del
 *  mattino, con la sezione "Da fare" piena sotto. Restituisce `null`, e i tre
 *  totali sommati possono quindi valere meno degli appuntamenti del giorno: la
 *  differenza sono esattamente quelli ancora da fare.
 *
 *  Così il totale "Svolte" e l'elenco "Svolti" sono lo stesso insieme contato
 *  due volte — un numero che non torna con il suo elenco smette di essere
 *  creduto. */
export function esitoContato(l: Lead): ChiaveEsito | null {
  const gruppo = esitoDi(l);
  if (gruppo === "programmato") return null;
  if (gruppo === "completato") return "fatto";
  //  Dentro i "non svolti" i due casi restano distinti: rifissare è lavoro di
  //  calendario, un assente è una telefonata.
  return l?.data?.stato === "da_spostare" ? "da_spostare" : "no_show";
}

/** ── IL SEGNO CHE DICE "QUESTO È QUELLO SEGNATO" ───────────────────────────
 *  Una spunta, dentro uno spazio che esiste anche quando la spunta non c'è.
 *
 *  PERCHÉ NON BASTAVA IL COLORE. I pulsanti d'esito passano da tinta chiara a
 *  tinta piena quando sono quelli attivi, e a schermo grande la differenza si
 *  vede. Ma è UNA SOLA differenza, di sola saturazione, su bersagli da 28px:
 *  su un monitor tarato male, con la luce del sole addosso o con gli occhi di
 *  chi guarda dall'altra parte della scrivania, "rosa chiaro" e "rosso pieno"
 *  si assomigliano abbastanza da dover leggere la sigla per esserne sicuri.
 *  E la sigla è due lettere: leggerla è esattamente il gesto che il committente
 *  ha chiesto di togliere. La spunta invece è una FORMA — c'è o non c'è — e si
 *  riconosce con la coda dell'occhio, in bianco e nero e su venti righe insieme.
 *
 *  ⚠️ LO SPAZIO È SEMPRE OCCUPATO, anche da spento. Una spunta che compare
 *  allargando il pulsante sposta tutti i comandi che ha accanto nell'istante in
 *  cui la si preme: il dito parte verso un bersaglio e ne trova un altro. */
function SpuntaSegnato({ acceso, grande }: { acceso: boolean; grande?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center", grande ? "w-3.5" : "w-3")}
    >
      {/*  Tratto più spesso del normale: a 12px una spunta sottile su fondo
          pieno si perde. */}
      {acceso ? <Check className={grande ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={3.25} /> : null}
    </span>
  );
}

/** ── TORNA ALLO STATO DI PRIMA ─────────────────────────────────────────────
 *  Un'icona sola, a sinistra dell'etichetta. Compare SOLO se c'è uno stato
 *  precedente da cui tornare: un tasto sempre presente e quasi sempre inerte
 *  smette di essere guardato dopo mezza giornata.
 *
 *  A cosa serve davvero: gli esiti si segnano col telefono in mano, e premere
 *  "Cliente assente" al posto di "Da riprogrammare" è l'errore più facile della
 *  giornata. Senza questo, rimediare vuol dire aprire la scheda, ricordarsi
 *  dove stava e riportarcelo a mano — tre gesti per disfarne uno.
 *
 *  Niente conferma: è un gesto che ANNULLA, e chiedere conferma per annullare
 *  raddoppia i clic proprio a chi ha appena sbagliato. Il rimedio dell'errore
 *  contrario è lo stesso tasto, che dopo il ritorno indietro punta di nuovo
 *  allo stato di prima. */
/** ⚠️ ESPORTATA perché non serve solo alla pagina Oggi: lo stesso gesto —
 *  «ho sbagliato stato, rimettilo com'era» — capita identico sulle
 *  installazioni, dove uno stato messo per errore manda una pratica nella
 *  scheda sbagliata e ce la lascia. Una seconda copia di questo pulsante
 *  altrove sarebbe la stessa idea scritta due volte, e fra un mese una delle
 *  due si comporterebbe in modo diverso. */
export function TornaIndietro({
  lead,
  onStato,
}: {
  lead: Lead;
  onStato?: (l: Lead, s: LeadStatus) => void;
}) {
  const prima = lead.data?.statoPrecedente;
  if (!onStato || !prima || prima === lead.data?.stato) return null;
  const titolo = `Torna a "${LEAD_STATUS_LABEL[prima] ?? prima}"`;
  return (
    <button
      type="button"
      title={titolo}
      aria-label={titolo}
      onClick={(e) => {
        e.stopPropagation();
        onStato(lead, prima);
      }}
      className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <Undo2 className="h-3.5 w-3.5" />
    </button>
  );
}

/** ── QUANTI, IN CHE STATO ──────────────────────────────────────────────────
 *  Il riquadro dei totali: tre numeri che dicono com'è andata la giornata
 *  senza contarli a mano dalle righe. Cliccabili, perché il numero da solo non
 *  serve — serve arrivare alle schede che ci stanno dietro.
 *
 *  ATTENZIONE, È UN CONTEGGIO SU UN INSIEME GIÀ SCELTO. Questa funzione non sa
 *  che giorno è: conta quello che le si passa. Va chiamata SOLO sugli
 *  appuntamenti dell'insieme mostrato (`insieme`: un giorno, oppure tutto lo
 *  storico quando lo si chiede) — passarle l'archivio intero mentre a schermo
 *  c'è una giornata restituisce i totali di sempre sotto l'intestazione di
 *  oggi, ed è esattamente il numero che nessuno riesce più a spiegarsi. Per
 *  questo l'intestazione dei tre numeri dice sempre di CHE COSA sono.
 *  I "cliente assente" (no_show) sono contati con le consulenze non svolte:
 *  sono lo stesso gruppo anche nell'elenco qui sotto e negli stessi filtri.
 *
 *  IL CRITERIO DEI TRE NUMERI sta tutto in `esitoContato` qui sopra, scritto
 *  per esteso: "Svolte" = tutto ciò che non è cliente assente e non è da
 *  riprogrammare, appuntamenti ancora in piedi esclusi. Non ripeterlo qui è
 *  voluto: due copie della stessa regola diventano due numeri diversi. */
export function contaEsiti(leadsDelGiorno: Lead[]): Record<ChiaveEsito, number> {
  const totali: Record<ChiaveEsito, number> = { fatto: 0, no_show: 0, da_spostare: 0 };
  //  Il gruppo arriva da un filtro su dati di database: se per qualsiasi motivo
  //  non è una lista, si restituiscono tre zeri invece di far cadere la pagina.
  //  Questo conto gira in un useMemo al montaggio, e lì un errore non si vede
  //  come un numero sbagliato: si vede come schermata bianca.
  if (!Array.isArray(leadsDelGiorno)) return totali;
  for (const l of leadsDelGiorno) {
    const chiave = esitoContato(l);
    //  null = appuntamento ancora da fare: non entra in nessuno dei tre.
    if (chiave) totali[chiave] += 1;
  }
  return totali;
}

/** ── LE ULTIME CIFRE DEL TELEFONO ──────────────────────────────────────────
 *  Accanto al nome, in chiaro, le ultime cinque cifre del numero. Servono a due
 *  cose che capitano ogni giorno: distinguere due omonimi (ce ne sono, e aprire
 *  la scheda per capire quale sia costa un giro intero) e ritrovare la chiamata
 *  nel registro del telefono, dove il numero si vede per intero.
 *  Cinque cifre e non il numero completo: bastano a riconoscere, non riempiono
 *  la riga e non mettono un dato personale intero sotto gli occhi di chiunque
 *  passi davanti allo schermo.
 *
 *  Il valore arriva dal database e non è detto che sia una stringa (negli
 *  import capitano numeri, spazi, prefissi con il +): si porta a testo, si
 *  tengono solo le cifre e si prendono le ultime. Se non ne resta nessuna si
 *  restituisce stringa vuota, e la riga non mostra NIENTE — un trattino al
 *  posto di un numero è rumore che si legge venti volte al giorno. */
export function ultimeCifre(telefono?: unknown, quante = 5): string {
  const cifre = String(telefono ?? "").replace(/\D/g, "");
  return cifre ? cifre.slice(-quante) : "";
}

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Solo la parte data: alcuni record portano l'ora appiccicata ("2026-08-13T00:00")
 *  e il confronto secco con il giorno li faceva sparire dall'agenda. */
export const soloGiorno = (v?: string | null) => (v ? String(v).slice(0, 10) : "");

/** Oggi, con l'orologio LOCALE. Serve a capire se una data attaccata a un lead
 *  è ancora buona o è già passata. Letto al momento e non tenuto in uno stato:
 *  una riga si ridisegna comunque a ogni cambio, e una pagina lasciata aperta
 *  la notte non deve restare convinta che oggi sia ieri. */
const oggiLocale = () => iso(new Date());

/** "2026-08-11" → "11/08": nelle righe la data serve a collocare, non a essere
 *  letta per intero. Sta qui perché la usano sia l'agenda sia la dashboard. */
export function giornoBreve(d?: string | null): string {
  const s = soloGiorno(d);
  if (!s) return "";
  const g = new Date(`${s}T12:00:00`);
  return Number.isNaN(g.getTime())
    ? s
    : g.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}
const piu = (n: number) => {
  const d = new Date();
  //  Mezzogiorno e non mezzanotte: sommando giorni a mezzanotte, nelle due notti
  //  del cambio d'ora si finisce sul giorno prima.
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

/** Le colonne del mese partono di LUNEDÌ: in Italia la settimana comincia lì, e
 *  un calendario che parte di domenica si legge sempre con un giorno di scarto.
 *  Sono le stesse due lettere della pagina Agenda: un calendario solo, un
 *  alfabeto solo. */
const COLONNE_SETTIMANA = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"];

/** "giovedì 14 agosto". Costruito una volta sola: dentro il mese aperto verrebbe
 *  chiamato trentun volte a ogni render. */
const FMT_ESTESO = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** ── IL GIORNO MOSTRATO, RICAVATO DALLO SCARTO ─────────────────────────────
 *  Lo scarto è il numero di giorni da oggi (0 = oggi, -1 = ieri) e NON un indice
 *  dentro una tabella di giorni precalcolati: da quando la striscia apre il mese
 *  intero, il giorno scelto può stare a marzo dell'anno prossimo, e nove voci in
 *  memoria non bastavano più.
 *
 *  Da qui esce sempre un giorno valido, anche se lo scarto arrivasse malformato
 *  dall'alto: su questo oggetto si reggono l'elenco della giornata, i tre totali
 *  e il titolo, e un `undefined` qui dentro è la pagina bianca. */
function giornoDaScarto(o: number) {
  //  Uno scarto che non è un numero intero vale "oggi": è l'unica risposta che
  //  non inventa una giornata.
  const scarto = Number.isFinite(o) ? Math.trunc(o) : 0;
  const d = piu(scarto);
  //  IL NOME RELATIVO C'È SOLO DOVE DICE QUALCOSA CHE LA DATA NON DICE.
  //  "Oggi", "Ieri", "Domani", "Altro ieri" si capiscono senza guardare il
  //  calendario, e sono le quattro giornate che si aprono ogni giorno. Per
  //  tutte le altre resta stringa vuota: prima qui usciva l'abbreviazione del
  //  giorno della settimana e la barra leggeva «Sab sabato 16 agosto» — lo
  //  stesso giorno detto due volte, la seconda per esteso.
  const nome =
    scarto === -2
      ? "Altro ieri"
      : scarto === -1
        ? "Ieri"
        : scarto === 0
          ? "Oggi"
          : scarto === 1
            ? "Domani"
            : "";
  //  Il nome per esteso ("giovedì 14 agosto") serve alla barra: dopo tre frecce
  //  — o dopo un salto di mese — non si sa più che giorno si sta guardando.
  //
  //  ⚠️ `settimana` e `numero` sono TORNATI, e il commento di prima diceva il
  //  contrario: erano stati tolti perché nessuno li leggeva più. Adesso li
  //  legge la rotaia dei giorni, che di ogni casella mostra il giorno della
  //  settimana e il numero — e sono l'unico modo di riconoscere un giorno in
  //  uno spazio largo tre centimetri. Chi li togliesse di nuovo, guardi prima
  //  la rotaia.
  return {
    o: scarto,
    nome,
    iso: iso(d),
    esteso: FMT_ESTESO.format(d),
    settimana: d.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", ""),
    numero: d.getDate(),
  };
}

/** Minuti dall'inizio del giorno, da "HH:MM". null se l'ora manca. */
export function minutiDi(ora?: string): number | null {
  if (!ora) return null;
  const [h, m] = ora.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** ── QUANTO MANCA, DETTO IN PAROLE ────────────────────────────────────────
 *  "10:30" obbliga a fare il conto con l'orologio; "tra 25 min" no. È la
 *  differenza fra accorgersi di un appuntamento e ricordarsene dopo. */
export function attesaDi(
  minutiMeet: number,
  adesso: number,
  /** Il giorno dell'appuntamento (ISO). Serve solo oltre le 24 ore: vedi
   *  `durataInParole`. Assente = non si scrive nessuna data. */
  giorno?: string,
): { testo: string; tono: "ora" | "ritardo" | "attesa" } {
  const d = minutiMeet - adesso;
  if (d <= -5) return { testo: `in ritardo di ${durataInParole(-d, giorno)}`, tono: "ritardo" };
  if (d <= 5) return { testo: "adesso", tono: "ora" };
  if (d < 60) return { testo: `tra ${d} min`, tono: "attesa" };
  return { testo: `tra ${durataInParole(d)}`, tono: "attesa" };
}

/** ── UNA DURATA CHE SI LEGGE SENZA FARE DIVISIONI ─────────────────────────
 *  ⚠️ QUI SI SCRIVEVANO I MINUTI E BASTA, e a mezzogiorno comparivano frasi
 *   come «in ritardo di 356 min»: per capire quanto sia bisogna dividere per
 *   sessanta a mente, cioè fare un conto davanti a una riga che serve a NON
 *   farne. Sotto l'ora restano i minuti — lì il minuto è l'unità con cui si
 *   ragiona davvero, «fra 25 min» si capisce meglio di «fra 0h 25m».
 *  Oltre le 24 ore si passa ai giorni E si scrive la data: «in ritardo di 3
 *  giorni» dice quanto, non quando, e su un appuntamento saltato la seconda è
 *  la domanda vera — è il giorno da cercare in chat per capire cos'era
 *  successo. */
function durataInParole(minuti: number, giorno?: string): string {
  const m = Math.max(0, Math.round(minuti));
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) {
    const h = Math.floor(m / 60);
    const resto = m % 60;
    return resto ? `${h}h ${resto}m` : `${h}h`;
  }
  const g = Math.floor(m / (24 * 60));
  const quando = giorno ? ` · era il ${dataBreve(giorno)}` : "";
  return `${g} ${g === 1 ? "giorno" : "giorni"}${quando}`;
}

/** ── AVVIA LA CONSULENZA ───────────────────────────────────────────────────
 *  Un gesto solo: apre (o riusa) la stanza di questo appuntamento, mette il
 *  consulente dentro come padrone di casa e porta con sé i dati del lead, così
 *  il preventivo nasce già intestato — nome, cognome, telefono, età. Prima si
 *  riscrivevano a mano davanti al cliente, ed è lì che nascono gli errori.
 *  Sta qui, esportata, perché la si avvia sia dall'agenda sia dal riquadro
 *  "Adesso" della dashboard: un solo comportamento, un solo punto da correggere. */
export async function avviaConsulenza(l: Lead, nomeConsulenteDi?: (x: Lead) => string | undefined) {
  try {
    const r = await fetch("/api/crm/meeting-session", {
      method: "POST",
      //  Senza intestazioni la rotta risponde 401 (chiede il permesso
      //  «agenda») e la stanza non nasce: il consulente resterebbe a fissare
      //  un "Stanza non creata" senza sapere perché.
      headers: await intestazioniCRM({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        leadId: l.id,
        consultantId: l.data.consulenteId,
        //  ⚠️ La conduco IO, adesso: la stanza è mia, non di chi risulta
        //   assegnato alla scheda. Senza questo, aprendo la consulenza di una
        //   persona assegnata a un collega si finiva nella SUA stanza — due
        //   padroni di casa nello stesso canale, e al cliente del secondo
        //   veniva rifiutato l'ingresso.
        conduco: true,
        quando: `${l.data.dataMeeting || ""}T${l.data.oraMeeting || ""}`,
        durata: l.data.durataMeeting || DURATA_PREDEFINITA,
      }),
    }).then((x) => x.json());
    //  Il fallimento silenzioso era peggio dell'errore: si restava a fissare
    //  una scheda che non si apriva, senza sapere se ritentare.
    if (!r?.ok || !r.code) {
      toast.error("Stanza non creata. Riprova.");
      return;
    }
    localStorage.setItem("hg_live_session", r.code);
    //  ── L'ANTEPRIMA DELLA STANZA NASCE CON LA STANZA ──────────────────────
    //   È il link che il cliente riceve più spesso, e finché il biglietto era
    //   legato al tasto dell'invito quasi nessuna stanza ce l'aveva: chi lo
    //   riceveva vedeva la scheda generica. Qui la stanza esiste da un
    //   millisecondo e i dati del lead sono in mano: è il momento giusto.
    //   Non si aspetta e non si dice niente — vedi depositaAnteprimaPerLead.
    void depositaAnteprimaPerLead(l, String(r.code));
    //  Il preventivo legge da qui chi ha davanti: resta finché non si apre
    //  un'altra consulenza.
    localStorage.setItem(
      "hg_lead_corrente",
      JSON.stringify({
        id: l.id,
        nome: l.data.nome || "",
        cognome: l.data.cognome || "",
        telefono: l.data.telefono || "",
        email: l.data.email || "",
        eta: l.data.eta ? String(l.data.eta) : "",
        problemi: l.data.note || "",
        //  ⚠️ Giorno, ora e durata viaggiano con il lead perché servono
        //  DENTRO l'app del presentatore: è lì che si copia il link della
        //  stanza da mandare al cliente, ed è lì che va disegnato il biglietto
        //  dell'anteprima. Senza questi tre campi il presentatore conosce il
        //  nome del cliente ma non l'appuntamento, e un biglietto che non sa
        //  dire quando non si disegna (vedi depositaAnteprimaPerLead).
        dataMeeting: l.data.dataMeeting || "",
        oraMeeting: l.data.oraMeeting || "",
        durataMeeting: l.data.durataMeeting || 0,
        consulente: nomeConsulenteDi?.(l) || "",
      }),
    );
    //  ── ⚠️ SI APRIVA IL PREVENTIVO, NON LA CONSULENZA ────────────────────
    //   Segnalato dal committente. «Avvia» creava la stanza, salvava il codice
    //   e il lead corrente… e poi apriva /preventivo, cioè il modulo dei
    //   prezzi. La videochiamata non partiva: il consulente si trovava davanti
    //   un preventivo vuoto mentre il cliente aspettava in una stanza in cui
    //   non c'era entrato nessuno — e il link da mandargli sta proprio nella
    //   pagina che non si apriva.
    //   `/presenta` è l'app del presentatore: legge la stanza appena creata da
    //   `hg_live_session` (shop/live, shop/call) e il cliente da
    //   `hg_lead_corrente`, cioè le due cose che questa funzione ha appena
    //   scritto. Il preventivo si apre da lì dentro, quando serve.
    /*  ── ⚠️ «AVVIA» DEVE AVVIARE ANCHE LA TRASMISSIONE ─────────────────
        Richiesta del committente: «quando clicco avvia, si apre direttamente
        la consulenza e avvia la trasmissione su quel link, senza che debba
        selezionare avvia trasmissione».
        Fin qui questo tasto apriva l'app del presentatore sulla stanza giusta
        e si fermava lì: la videochiamata la si avviava con un secondo gesto,
        in un'altra parte dello schermo. Due comandi per una cosa sola — e nel
        mezzo il cliente che aspetta in una stanza vuota.
        Il biglietto si lascia in `localStorage` e non in `sessionStorage`: la
        scheda che si apre è nuova, e la memoria di sessione non la segue.
        Porta il codice e l'ora, così una scheda riaperta domani per altro non
        fa partire una trasmissione che nessuno ha chiesto. */
    try {
      localStorage.setItem("hg_avvia_subito", JSON.stringify({ code: r.code, at: Date.now() }));
    } catch {
      /* niente memoria: si avvierà a mano, come prima */
    }
    window.open("/presenta", "_blank", "noopener");
  } catch {
    toast.error("Stanza non creata. Controlla la connessione.");
  }
}

// ── SEZIONE ─────────────────────────────────────────────────────────────────
//  Un solo contenitore per tutti gli elenchi della dashboard: stesso bordo,
//  stessa intestazione, stesso posto per il conteggio e per il collegamento.
//  Quando ogni blocco ha un vestito suo, ogni blocco va imparato da capo.
export function Sezione({
  titolo,
  icona: Icona,
  tinta,
  conteggio,
  nota,
  azione,
  accento,
  id,
  children,
}: {
  titolo: string;
  icona: ComponentType<{ className?: string }>;
  tinta?: string;
  conteggio?: number;
  nota?: string;
  azione?: ReactNode;
  /** urgente = da fare adesso, arretrato = lavoro rimasto indietro */
  accento?: "urgente" | "arretrato";
  id?: string;
  children: ReactNode;
}) {
  //  I due accenti usano le stesse due famiglie di colore del resto del CRM:
  //  cielo = "si lavora adesso", ambra = "manca un passaggio". Il blu di prima
  //  era una terza tinta che non voleva dire niente di diverso.
  const bordo =
    accento === "urgente"
      ? "border-sky-300 ring-1 ring-sky-200"
      : accento === "arretrato"
        ? "border-amber-300"
        : "border-border";
  return (
    <section id={id} className={`scroll-mt-16 rounded-xl border bg-card ${bordo}`}>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icona className={`h-4 w-4 shrink-0 ${tinta || "text-muted-foreground"}`} />
        <h2 className="text-[13px] font-semibold text-foreground">{titolo}</h2>
        {conteggio !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {conteggio}
          </span>
        )}
        {azione && <div className="ml-auto flex items-center gap-1">{azione}</div>}
      </header>
      {nota && (
        <p className="border-b border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
          {nota}
        </p>
      )}
      {children}
    </section>
  );
}

/** Elenco vuoto: una frase che dice cosa manca, non un riquadro grigio.
 *  Il componente sta in ui.tsx (lo usano anche altre code): qui viene solo
 *  riesportato, perché esistevano DUE componenti chiamati "Vuoto" con proprietà
 *  diverse — l'occasione perfetta per importare quello sbagliato. */
export { VuotoRiga } from "./ui";

/** ── COPIA NEGLI APPUNTI, CON RIPIEGO ──────────────────────────────────────
 *  `navigator.clipboard` non è sempre disponibile e non sempre riesce: sui
 *  browser Apple la copia è legata al TOCCO, e dopo un `await` — qui in mezzo
 *  c'è una chiamata al server — il tocco è considerato finito e la richiesta
 *  viene rifiutata. È esattamente il nostro caso, e senza ripiego il consulente
 *  vedrebbe "link copiato" e incollerebbe qualcos'altro nella chat del cliente.
 *  Il ripiego è la vecchia strada (un campo di testo invisibile + `execCommand`)
 *  che quei browser accettano ancora. Se fallisce anche quella si RESTITUISCE
 *  falso: chi chiama mostra il link per esteso, così si copia a mano. Mai dire
 *  che è fatto quando non lo è. */
async function copiaNegliAppunti(testo: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(testo);
      return true;
    }
  } catch {
    /* rifiutata: si prova la vecchia strada */
  }
  try {
    const campo = document.createElement("textarea");
    campo.value = testo;
    campo.setAttribute("readonly", "");
    //  Fuori dallo schermo ma NON `display:none`: un elemento nascosto davvero
    //  non si può selezionare, e senza selezione non c'è niente da copiare.
    campo.style.position = "fixed";
    campo.style.top = "-1000px";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(campo);
    return ok;
  } catch {
    return false;
  }
}

/** ── LA PAGINA DELL'APPUNTAMENTO, DA MANDARE AL CLIENTE ────────────────────
 *  Crea (o ritrova) il link di /invito/… e lo mette negli appunti, pronto da
 *  incollare in chat. La pagina che si apre dice al cliente quando è la
 *  consulenza, quanto dura, come si svolge e con chi — le quattro domande che
 *  altrimenti tornano indietro come messaggi da riscrivere a mano.
 *
 *  Perché non apre nulla e non manda nulla: il consulente sta già scrivendo
 *  nella chat aperta accanto, e ciò che gli serve è il link nel dito. Aprire
 *  una scheda nuova lo porterebbe fuori dall'agenda a metà giornata.
 *
 *  ⚠️ NON È UN COMPONENTE, ed è voluto. Il gesto parte da una voce di menu, e
 *  il menu si CHIUDE nell'istante in cui la si sceglie: se lo stato della
 *  conferma vivesse lì dentro, sparirebbe insieme al menu prima ancora che il
 *  server abbia risposto. La conferma è il messaggio a comparsa, che sopravvive
 *  a qualsiasi cosa succeda alla riga (cambio di giorno, filtro, riordino).
 *
 *  ⚠️ Premuto due volte restituisce lo STESSO indirizzo (vedi api.crm.invito):
 *  due link diversi per la stessa consulenza nella stessa chat sono un modo
 *  sicuro di far aprire al cliente quello sbagliato. */
const invitiInCorso = new Set<string>();

//  Restituisce il link, perché al richiamante non serve solo che la pagina sia
//  nata: ci deve aprire sopra il biglietto da mandare. Chi vuole solo copiare
//  ignora il valore, e si comporta come prima.
/** ── LA STANZA DI QUESTO LEAD, CHIESTA A CHI LA SA ─────────────────────────
 *  `linkMeeting` non è una fonte attendibile per il codice della stanza: ci
 *  finisce anche quello che il consulente ha incollato a mano, e nei lead più
 *  vecchi è un indirizzo di Google Meet. La stanza Meetly, quella che apriamo
 *  noi, sta sul server sotto `meet:<leadId>`.
 *  ⚠️ Si legge e basta (GET): non deve CREARE una stanza a un lead che non ne
 *  ha una — premere il tasto del biglietto non è chiedere una videoconsulenza.
 *  Stringa vuota se non c'è, e in quel caso l'anteprima resta sulla sola pagina
 *  dell'appuntamento. */
async function stanzaDelLead(leadId: string): Promise<string> {
  try {
    const r = (await fetchCRM(`/api/crm/meeting-session?leadId=${encodeURIComponent(leadId)}`).then(
      (x) => x.json(),
    )) as { ok?: boolean; code?: string };
    return r?.ok && r.code ? String(r.code) : "";
  } catch {
    return "";
  }
}

async function generaInvito(lead: Lead): Promise<string | null> {
  //  Due tocchi rapidi sulla stessa riga sono due chiamate identiche: la rotta
  //  le regge (restituisce lo stesso codice), ma la seconda risposta
  //  sovrascriverebbe negli appunti quello che l'utente ha appena copiato.
  if (invitiInCorso.has(lead.id)) return null;
  invitiInCorso.add(lead.id);
  try {
    const r = await fetch("/api/crm/invito", {
      method: "POST",
      //  Senza intestazioni la rotta risponde 401 (chiede il permesso
      //  «agenda») e il link non nasce: si resterebbe a premere un tasto che
      //  non fa niente, senza sapere perché.
      headers: await intestazioniCRM({ "Content-Type": "application/json" }),
      body: JSON.stringify({ leadId: lead.id }),
    }).then((x) => x.json());
    if (!r?.ok || !r.link) {
      toast.error("Pagina non creata. Riprova.");
      return null;
    }
    const copiato = await copiaNegliAppunti(String(r.link));
    if (copiato) {
      //  Il link resta scritto nella conferma: è la prova che ciò che sta
      //  negli appunti è quello giusto, e serve la volta che la copia riesce
      //  ma si incolla nella finestra sbagliata.
      toast.success("Link copiato — pagina dell'appuntamento pronta", {
        description: String(r.link),
      });
      return String(r.link);
    }
    //  Copia rifiutata dal browser: si mostra il link a lungo, così si
    //  seleziona a mano. Meglio un gesto in più di un incollaggio a vuoto —
    //  e soprattutto mai dire "copiato" quando non lo è.
    toast.info("Ecco il link della pagina: copialo a mano", {
      description: String(r.link),
      duration: 15000,
    });
    return String(r.link);
  } catch {
    toast.error("Pagina non creata. Controlla la connessione.");
    return null;
  } finally {
    invitiInCorso.delete(lead.id);
  }
}

// ── COSA SI PUÒ MANDARE A QUESTA PERSONA ────────────────────────────────────
//  Una voce del menu "Manda". `href` = apre WhatsApp già scritto; `onScegli` =
//  fa qualcosa qui (per ora: crea la pagina dell'appuntamento e copia il link).
interface VoceInvia {
  chiave: string;
  icona: ComponentType<{ className?: string }>;
  tinta: string;
  testo: string;
  nota: string;
  href?: string;
  onScegli?: () => void;
}

/** ── PERCHÉ LE ICONE SONO RAGGRUPPATE ──────────────────────────────────────
 *  Sulla riga di un appuntamento di oggi i tasti che "mandano qualcosa" erano
 *  arrivati a cinque: chiama · scrivi · link della consulenza · promemoria ·
 *  pagina dell'appuntamento. Cinque bersagli piccoli, quattro dei quali con la
 *  stessa forma e colori diversi, su una riga che ne ha già altri sei (stella,
 *  stato, i due esiti, "Avvia"). Una fila così non si legge: si conta.
 *  E il costo dell'errore non è teorico — sbagliare fra la videocamera e la
 *  campanella significa mandare al cliente il messaggio sbagliato.
 *
 *  Restano fuori i DUE gesti quotidiani, quelli che si fanno decine di volte al
 *  giorno e che devono stare sotto il pollice senza passaggi: chiamare e
 *  scrivere su WhatsApp. Gli altri tre — che si usano una volta per
 *  appuntamento — stanno qui dentro, dove hanno finalmente un NOME scritto
 *  invece di un'icona da indovinare. Chi cerca "manda il promemoria" adesso lo
 *  legge; prima doveva ricordarsi che era la campanella arancione.
 *
 *  Il menu compare anche con una voce sola: la posizione dei comandi non deve
 *  cambiare da una riga all'altra, altrimenti si torna a cercarli ogni volta. */
function MenuInvia({ voci }: { voci: VoceInvia[] }) {
  //  Nessun hook qui dentro: l'uscita anticipata è sicura.
  if (!voci.length) return null;
  const titolo = "Manda qualcosa a questo cliente";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={titolo}
          aria-label={titolo}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
        >
          <Send className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      {/*  Largo abbastanza da contenere una riga di spiegazione: il nome da
          solo ("Promemoria") non distingue due messaggi che si somigliano. */}
      <DropdownMenuContent align="end" className="w-[270px] bg-popover">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Manda al cliente
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {voci.map((v) => {
          const Icona = v.icona;
          const corpo = (
            <>
              <Icona className={`mt-0.5 h-4 w-4 shrink-0 ${v.tinta}`} />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium leading-snug">{v.testo}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {v.nota}
                </span>
              </span>
            </>
          );
          return v.href ? (
            <DropdownMenuItem key={v.chiave} asChild className="cursor-pointer items-start gap-2.5">
              <a href={v.href} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                {corpo}
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={v.chiave}
              className="cursor-pointer items-start gap-2.5"
              onSelect={() => v.onScegli?.()}
            >
              {corpo}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** ── LE NOTE DOPO LA CONSULENZA ────────────────────────────────────────────
 *  IL CAMPO ESISTE GIÀ E SI CHIAMA `notePostCall`. Non ne è stato inventato uno
 *  nuovo: è lo stesso che scrivono la scheda del lead ("Note dopo la
 *  consulenza") e la scheda cliente ("Note della consulenza"), ha già il suo
 *  permesso (`canAddPostCallNotes`) e nell'archivio ne è pieno. Un secondo
 *  campo avrebbe voluto dire due punti in cui cercare la stessa frase, e la
 *  metà delle volte guardare in quello vuoto.
 *  ⚠️ Da non confondere con `chiusura.note`, che riguardano l'accordo
 *  economico: queste dicono com'è andata la consulenza.
 *
 *  PERCHÉ UN TASTO SULLA RIGA E NON "APRI LA SCHEDA".
 *  Le note si scrivono nei due minuti fra una consulenza e la successiva, con
 *  l'agenda già davanti. Aprire la scheda intera per tre righe di testo costa
 *  il caricamento, lo scorrimento fino alla sezione giusta e la chiusura — e
 *  quello che costa tre gesti, a fine giornata, non è stato fatto.
 *
 *  IL TASTO DICE DA SOLO SE DENTRO C'È QUALCOSA, e questa è la parte che conta:
 *   · VUOTO  → icona sola, tenue, come gli altri comandi di servizio;
 *   · PIENO  → riquadro indaco pieno, e nel titolo LE PRIME RIGHE del testo.
 *  Un tasto che non distingue i due casi obbliga ad aprirlo su ogni riga per
 *  scoprire che è vuoto: venti aperture per trovare le due schede che hanno
 *  davvero una nota. Il riquadro pieno è lo stesso linguaggio del calendario
 *  ambra qui sotto ("qui c'è qualcosa"), non una tinta nuova da imparare. */
const MAX_NOTE_POST = 5000;

function NotePostConsulenza({ lead, grande }: { lead: Lead; grande?: boolean }) {
  //  ⚠️ HOOK: tutti in cima, prima di qualunque uscita anticipata (React #310 =
  //  schermata bianca in produzione, già successo in questo file).
  const { updateLead } = useCRM();
  const [aperta, setAperta] = useState(false);
  const [bozza, setBozza] = useState("");
  /** Il testo che stiamo aspettando di rivedere scritto nel lead. `null` =
   *  nessun salvataggio in corso. Vedi l'effetto qui sotto: è la ricevuta. */
  const [atteso, setAtteso] = useState<string | null>(null);

  const salvate = (lead.data?.notePostCall ?? "").trim();
  const ciSono = salvate.length > 0;

  /** ── LA RICEVUTA DEL SALVATAGGIO ────────────────────────────────────────
   *  `updateLead` non restituisce niente: quando il database rifiuta la
   *  scrittura si limita a una riga in console, e a schermo non succede nulla.
   *  Dire "salvato" subito dopo averlo chiamato sarebbe quindi una promessa
   *  fatta senza aver letto la risposta — l'errore che in questo progetto ha
   *  già fatto credere per giorni che un salvataggio funzionasse.
   *  Qui la conferma è il DATO: l'elenco in memoria viene aggiornato solo se
   *  Supabase ha accettato, quindi si aspetta di rivedere il proprio testo
   *  arrivare dentro `lead` e solo allora si dice che è fatto. Se entro otto
   *  secondi non arriva, non è arrivato: lo si dice, e la finestra resta
   *  aperta con il testo ancora dentro, così non si riscrive da capo.
   *  ⚠️ Non si confronta lo stato del contesto letto dalla chiusura: dopo un
   *  `await` quella variabile è quella di prima del salvataggio, e si sarebbe
   *  annunciato un errore su ogni salvataggio riuscito. */
  useEffect(() => {
    if (atteso === null) return;
    if (salvate === atteso) {
      setAtteso(null);
      setAperta(false);
      toast.success(atteso ? "Note salvate" : "Note svuotate");
      return;
    }
    const t = setTimeout(() => {
      setAtteso(null);
      toast.error("Note NON salvate", {
        description:
          "Il server non ha confermato la modifica. Controlla la connessione e riprova: il testo è ancora qui.",
        duration: 9000,
      });
    }, 8000);
    return () => clearTimeout(t);
  }, [atteso, salvate]);

  const inCorso = atteso !== null;
  const chi = `${lead.data?.nome ?? ""} ${lead.data?.cognome ?? ""}`.trim();

  /** Il titolo dice a cosa serve il tasto E cosa c'è dentro. Le andate a capo
   *  diventano puntini di separazione: in un `title` di sistema il testo su più
   *  righe viene reso a caso da ogni browser, e una nota di dieci righe coprirebbe
   *  metà schermo. Centoquaranta caratteri bastano a riconoscere la nota; per
   *  leggerla tutta si apre. */
  const anteprima = salvate.replace(/\s+/g, " ").slice(0, 140);
  const titolo = ciSono
    ? `Note dopo la consulenza: ${anteprima}${salvate.length > 140 ? "…" : ""}`
    : "Note dopo la consulenza — ancora nessuna. Scrivile";

  const salva = () => {
    //  Prima il taglio, poi la ripulitura dei margini: al contrario, un taglio
    //  a cinquemila caratteri può lasciare uno spazio in coda, e allora il testo
    //  salvato non sarebbe MAI uguale a quello atteso — la finestra resterebbe
    //  ad aspettare una conferma che non può arrivare e finirebbe per dire che
    //  il salvataggio è fallito mentre invece era riuscito.
    const testo = bozza.slice(0, MAX_NOTE_POST).trim();
    //  Niente da scrivere: si chiude senza chiamare il server e senza fingere
    //  un salvataggio che non è avvenuto perché non serviva.
    if (testo === salvate) {
      setAperta(false);
      toast.info("Nessuna modifica da salvare.");
      return;
    }
    setAtteso(testo);
    void updateLead(lead.id, { notePostCall: testo });
  };

  return (
    <>
      <button
        type="button"
        title={titolo}
        aria-label={titolo}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.stopPropagation();
          //  La bozza si riprende dal dato ogni volta che si apre: se qualcun
          //  altro ha scritto sulla stessa scheda nel frattempo, si parte da
          //  quello che c'è adesso e non da quello che c'era all'apertura
          //  della pagina.
          setBozza(lead.data?.notePostCall ?? "");
          setAperta(true);
        }}
        className={cn(
          //  Bordo trasparente anche da vuoto: senza, il tasto si allargherebbe
          //  di 2px nell'istante in cui la prima nota viene salvata, e tutta la
          //  fila di icone accanto si sposterebbe sotto il dito.
          "inline-flex shrink-0 items-center gap-1 rounded-md border border-transparent transition",
          //  5px + bordo = 28px netti, la stessa misura del tasto "chiama" e di
          //  quello di WhatsApp qui accanto: una fila di icone in cui una è più
          //  piccola delle altre si legge come un difetto.
          grande ? "h-9 px-2" : "p-[5px]",
          ciSono
            ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:brightness-95"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <NotebookPen className="h-4 w-4 shrink-0" />
        {/*  Nel riquadro "Adesso" c'è spazio per il nome scritto: lì il tasto si
            legge da un metro, e "Note" toglie ogni dubbio su cosa apra. Sulla
            riga dell'agenda no — sette comandi in fila con l'etichetta non ci
            stanno — e il nome sta nel titolo, come per tutte le altre icone. */}
        {grande && <span className="text-[12px] font-semibold">Note</span>}
      </button>

      <Finestra
        aperta={aperta}
        //  Mentre il salvataggio è in volo la finestra non si chiude da sola:
        //  chiudendola si perderebbe il testo proprio nel caso in cui il server
        //  sta per dire di no.
        onCambio={(v) => !v && !inCorso && setAperta(false)}
        titolo="Note dopo la consulenza"
        contesto={chi || undefined}
        icona={NotebookPen}
        larghezza="sm"
        azioni={
          <>
            <Button variant="outline" onClick={() => setAperta(false)} disabled={inCorso}>
              Annulla
            </Button>
            <Button onClick={salva} disabled={inCorso}>
              {inCorso ? "Salvo…" : "Salva"}
            </Button>
          </>
        }
      >
        <Textarea
          rows={8}
          autoFocus
          //  Il limite è quello che applica già la rotta del consulente
          //  (api.consulente.azione): tagliare in silenzio a 5000 caratteri
          //  DOPO aver detto "salvato" sarebbe una perdita di testo muta, così
          //  invece il campo semplicemente non ne accetta di più.
          maxLength={MAX_NOTE_POST}
          className={CLASSI_AREA}
          placeholder="Com'è andata: che cosa ha chiesto, che cosa gli è stato promesso, qual è il prossimo passo"
          value={bozza}
          onChange={(e) => setBozza(e.target.value)}
        />
        <p className="mt-2 text-[11.5px] leading-snug text-slate-500">
          Sono le stesse note che si leggono nella scheda del lead, sotto «Note dopo la consulenza»:
          qui si scrivono senza aprirla.
        </p>
      </Finestra>
    </>
  );
}

// ── LA RIGA DI UN CONTATTO ──────────────────────────────────────────────────
//  UNA sola riga per tutta la dashboard — agenda, arretrati, ricontatti, sede,
//  installazioni. Le azioni stanno sempre nello stesso ordine e nello stesso
//  punto: stato, esito, messaggi, azione principale. Chi lavora otto ore al
//  giorno su questa pagina non deve cercare due volte lo stesso pulsante.
//  Su telefono le azioni scendono a capo tutte insieme, allineate a destra:
//  restano nell'ordine di sempre, senza nascondere niente (prima F/NF/DS
//  sparivano sotto i 640px, e l'esito si poteva segnare solo dal menu).
export function RigaLead({
  lead,
  onApri,
  onEvidenzia,
  onStato,
  nomeConsulente,
  quando,
  attesa,
  motivo,
  esiti = true,
  promemoria,
  principale,
}: {
  lead: Lead;
  onApri: (l: Lead) => void;
  onEvidenzia?: (l: Lead) => void;
  onStato?: (l: Lead, s: LeadStatus) => void;
  /** serve alla firma del messaggio: il cliente deve leggere CHI gli scrive */
  nomeConsulente?: (l: Lead) => string | undefined;
  /** il chip a sinistra: l'ora del giorno, oppure la data quando la riga non è di oggi */
  quando?: string;
  /** "tra 25 min" / "in ritardo di 10 min": solo dove serve davvero */
  attesa?: { testo: string; tono: "ora" | "ritardo" | "attesa" } | null;
  /** perché questa riga è in questo elenco (es. "Non presentato · 11/08") */
  motivo?: string;
  /** i tre pulsanti d'esito: hanno senso su un appuntamento, non su un'installazione */
  esiti?: boolean;
  /** il promemoria dell'appuntamento: di norma dove un appuntamento c'è */
  promemoria?: boolean;
  /** azione principale della sezione: undefined = "Avvia", null = nessuna */
  principale?: ReactNode | null;
}) {
  const l = lead;
  //  ⚠️ HOOK: sta qui, in cima, prima di qualunque uscita anticipata. In questo
  //  file un hook messo sotto un `return` ha già fatto una schermata bianca in
  //  produzione (React #310).
  //
  //  Il pannello vive nella RIGA e non nella pagina perché `RigaLead` è
  //  esportata e usata anche altrove: alzare lo stato avrebbe voluto dire una
  //  prop nuova obbligatoria in ogni chiamante. A pannello chiuso il componente
  //  non disegna niente — la tela nasce solo all'apertura.
  const [biglietto, setBiglietto] = useState<DatiBiglietto | null>(null);
  const consulente = nomeConsulente?.(l);
  const mostraPromemoria = promemoria ?? (esiti && !!l.data.dataMeeting);
  /** ── IL LINK SI MANDA ANCHE A CHI NON SI È PRESENTATO ──────────────────
   *  Il tasto seguiva la stessa condizione del promemoria, che vive solo dove
   *  si segnano gli esiti: su un "Cliente assente" spariva. Ed è proprio lì che
   *  serve — nove volte su dieci chi non si presenta non ha trovato il link, o
   *  l'ha perso nella chat. Toglierlo in quel momento è togliere il rimedio
   *  esattamente quando serve.
   *  Basta che ci sia un appuntamento e una stanza vera: se la stanza non è
   *  nostra il tasto resta nascosto, perché mandare un link morto è peggio. */
  const mostraLinkStanza = !!l.data.dataMeeting && haStanzaNostra(l.data);
  /** ── LA PAGINA DELL'APPUNTAMENTO VUOLE UN GIORNO, UN'ORA, E UN DOMANI ──
   *  Tre condizioni, e ognuna toglie di mezzo un link che al cliente farebbe
   *  danno invece che comodo:
   *
   *  1. una data che si LEGGE DAVVERO. Non basta che il campo non sia vuoto:
   *     nell'archivio importato ci sono "21/08/2026" e stringhe storte, e
   *     `soloGiorno` (che taglia e basta) le considerava date buone. Il tasto
   *     compariva, e la pagina che nasceva diceva "Giorno e ora da confermare"
   *     — un invito che non risponde alla domanda per cui è stato mandato.
   *     Si usa la stessa porta della pagina pubblica, così le due cose non
   *     possono più dare due giudizi diversi sulla stessa riga.
   *
   *  2. un'ora, per lo stesso motivo: la pagina esiste per dire «Oggi alle
   *     15:30». Finché l'ora manca, al posto del tasto la riga mostra già il
   *     calendario per metterla (vedi `dataDaFissare` qui sotto).
   *
   *  3. l'appuntamento NON dev'essere già passato. Questa riga vive anche
   *     fuori dall'agenda di oggi — installazioni, "viene in sede", ricontatti,
   *     arretrati — e lì il `dataMeeting` è quasi sempre la consulenza di
   *     settimane fa. Senza questo controllo il tasto sarebbe comparso su
   *     mezzo CRM offrendo di mandare a un cliente la pagina di un incontro
   *     già avvenuto: la pagina se ne accorge e lo dice con garbo, ma un
   *     consulente che la manda ha comunque mandato la cosa sbagliata.
   *
   *  Non serve invece la stanza: la pagina resta utile anche senza — dice
   *  quando, quanto dura e come si svolge — e in quel caso avvisa da sola che
   *  il link per collegarsi arriva più tardi. */
  const giornoInvito = dataInvitoPulita(l.data.dataMeeting);
  const mostraInvito =
    !!giornoInvito && !!oraInvitoPulita(l.data.oraMeeting) && giornoInvito >= oggiLocale();

  /** ── QUELLO CHE SI PUÒ MANDARE, IN UN POSTO SOLO ───────────────────────
   *  L'elenco si costruisce qui e non dentro il menu: le condizioni sono le
   *  stesse di prima (nessun tasto è sparito, nessuno è comparso dove non era)
   *  e restano leggibili accanto a quelle che le hanno generate.
   *  L'ordine è quello del lavoro: prima il link per entrare, poi il
   *  promemoria del giorno prima, poi la pagina da mandare appena si fissa. */
  const vociInvia: VoceInvia[] = [];
  if (l.data.telefono && mostraLinkStanza) {
    vociInvia.push({
      chiave: "link",
      icona: Video,
      tinta: "text-sky-600",
      testo: "Link della consulenza",
      nota: "Solo il link, e che non serve scaricare nulla",
      href: buildWhatsAppLink(l.data.telefono, buildLinkConsulenzaMessage(l, consulente)),
    });
  }
  if (l.data.telefono && mostraPromemoria && haStanzaNostra(l.data)) {
    vociInvia.push({
      chiave: "promemoria",
      icona: Bell,
      tinta: "text-amber-600",
      testo: "Promemoria dell'appuntamento",
      nota: "Giorno, ora e link, con richiesta di conferma",
      href: buildWhatsAppLink(l.data.telefono, buildMeetReminderMessage(l, consulente)),
    });
  }
  //  ⚠️ La pagina dell'appuntamento NON chiede il telefono, ed è voluto: un
  //  link si copia e si incolla dove si vuole — anche in una chat che non è
  //  WhatsApp — e legarlo al numero l'avrebbe tolto proprio dalle schede senza
  //  recapito, che sono quelle in cui si scrive da un altro canale.
  if (mostraInvito) {
    vociInvia.push({
      chiave: "invito",
      icona: CalendarCheck,
      tinta: "text-violet-600",
      testo: "Pagina dell'appuntamento",
      nota: "Crea il link e lo copia: quando, quanto dura, come si svolge",
      onScegli: () => void generaInvito(l),
    });
  }
  //  Le ultime cifre del numero: se manca, resta stringa vuota e non si stampa
  //  niente (vedi ultimeCifre).
  const cifreTelefono = ultimeCifre(l.data?.telefono);
  //  L'elenco degli stati non si calcola più qui: lo fa `statiSelezionabili`
  //  dentro la pastiglia, con la stessa regola (statiPer, più lo stato attuale
  //  quando è uno storico) e in un posto solo per tutto il CRM.

  /** ── LA DATA C'È, OPPURE È IL GESTO PER METTERLA ──────────────────────────
   *  "Meet da fissare" e "Appuntamento fissato" senza giorno e ora lasciavano
   *  la colonna del quando vuota: una cella bianca non dice che manca qualcosa
   *  e soprattutto non dice dove si aggiunge. Finché la data non c'è, al suo
   *  posto sta la SOLA icona del calendario — un bersaglio da premere, non
   *  un'etichetta da leggere. Appena c'è, la riga mostra data e ora per esteso
   *  e l'icona sparisce: a quel punto non serve più a niente.
   *
   *  "Da riprogrammare" sta nello stesso elenco: è lo stato che di date ne ha
   *  una, ma è quella VECCHIA — lo slot saltato. Trattarla come una data buona
   *  faceva credere che l'appuntamento fosse ancora in piedi, ed era il modo
   *  più silenzioso di perdere un cliente che aspettava solo di essere
   *  richiamato per un altro giorno. */
  const attendeUnaData =
    l.data.stato === "fissa_meet_dopo" ||
    //  I due stati di appuntamento insieme: quello del cliente di ritorno ha
    //  data e ora negli stessi campi, e dev'essere leggibile allo stesso modo.
    eAppuntamento(l.data.stato) ||
    l.data.stato === "da_spostare";
  const quandoDelMeeting = (() => {
    if (!attendeUnaData) return "";
    const g = soloGiorno(l.data.dataMeeting);
    if (!g) return "";
    //  Su "Da riprogrammare" la data passata NON conta come data: conta solo se
    //  è di oggi o dei giorni a venire, cioè se qualcuno l'ha già rifissato e
    //  ha soltanto dimenticato di cambiare lo stato.
    if (l.data.stato === "da_spostare" && g < oggiLocale()) return "";
    return l.data.oraMeeting ? `${giornoBreve(g)} · ${l.data.oraMeeting}` : giornoBreve(g);
  })();
  //  `quando` passato dalla sezione ha la precedenza: nell'agenda la colonna è
  //  l'ora e il giorno lo dice già l'intestazione.
  const testoQuando = quando || quandoDelMeeting;
  const dataDaFissare = attendeUnaData && !testoQuando;
  const titoloDataDaFissare =
    l.data.stato === "da_spostare"
      ? "Dai una data nuova all'appuntamento"
      : "Fissa data e ora dell'appuntamento";

  return (
    <li
      //  La tinta della riga arriva dal linguaggio comune, e sono i due colori
      //  che il committente ha chiesto di tenere separati:
      //   · ARANCIONE = da rifissare — non è perso, manca solo una data nuova;
      //   · ROSSO     = cliente assente o consulenza non svolta — è una perdita,
      //     e si recupera al telefono, non con il calendario.
      //  Vedi classiRigaStato in crm/ui: il colore è definito lì una volta sola,
      //  così l'agenda e l'elenco trattative non tornano a colorarlo in due modi.
      className={`flex flex-wrap items-center gap-x-2.5 gap-y-2 px-3 py-2.5 transition-colors ${classiRigaStato(l.data.stato)}`}
    >
      {onEvidenzia && (
        <button
          type="button"
          onClick={() => onEvidenzia(l)}
          title="Segna come da seguire"
          aria-label="Segna come da seguire"
          className={`shrink-0 rounded p-1 transition ${l.data.highlighted ? "text-amber-500" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
        >
          <Star className="h-4 w-4" fill={l.data.highlighted ? "currentColor" : "none"} />
        </button>
      )}

      {/* L'ora a larghezza fissa: incolonnata, si legge come una tabella */}
      {testoQuando && (
        <span className="min-w-[46px] shrink-0 whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-foreground">
          {testoQuando}
        </span>
      )}

      {/*  Manca la data: al posto dell'ora, solo il calendario. Niente scritta
          "Da fissare" accanto — la parola la dice già la pastiglia di stato, e
          ripeterla su ogni riga riempiva la colonna di testo identico.
          Il titolo però cambia con lo stato: su un appuntamento da rifissare il
          gesto è "dagli un giorno nuovo", non "fissalo la prima volta", e chi
          usa il lettore di schermo sente solo questa frase. */}
      {dataDaFissare && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onApri(l);
          }}
          title={titoloDataDaFissare}
          aria-label={titoloDataDaFissare}
          className="flex h-8 w-[46px] shrink-0 items-center justify-center rounded-md border border-amber-300 bg-amber-50 text-amber-700 transition hover:brightness-95"
        >
          <CalendarPlus className="h-4 w-4" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onApri(l)}
          //  Riga in flex e non un blocco con `truncate`: così a tagliarsi è il
          //  NOME, e le cifre restano sempre visibili. Con il taglio sull'intero
          //  blocco sparivano proprio nel caso che le rende utili — due omonimi
          //  con il cognome lungo su uno schermo da 360px.
          className="flex w-full min-w-0 items-baseline gap-1.5 text-left text-[13.5px] font-medium text-foreground hover:underline"
        >
          <span className="truncate">
            {l.data.nome} {l.data.cognome}
          </span>
          {/*  Cifre tabellari e colore tenue: devono restare LEGGIBILI ma non
              competere con il nome — servono a confermare "è questo qui", non
              a essere lette per prime. Il puntino iniziale dice che è la coda
              del numero e non un numero intero. */}
          {cifreTelefono && (
            <span
              className="shrink-0 text-[11.5px] font-normal tabular-nums text-muted-foreground"
              title={`Numero che finisce con ${cifreTelefono}`}
            >
              …{cifreTelefono}
            </span>
          )}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
          <ChipAttesa attesa={attesa} />
          {motivo && <span className="truncate">{motivo}</span>}
          {consulente && <span className="truncate">{consulente}</span>}
          {l.data.citta && <span className="truncate">{l.data.citta}</span>}
        </div>
      </div>

      {/* ── AZIONI: SEMPRE QUESTE, SEMPRE IN QUEST'ORDINE ──────────────────
          stato · esito · messaggi · azione principale. Su telefono vanno a
          capo in blocco, allineate a destra. */}
      {/*  flex-wrap anche qui: su uno schermo da 360px stato + esiti + icone +
          "Avvia" non ci stanno in una riga sola, e senza il ritorno a capo
          l'ultimo pulsante finiva fuori dallo schermo. */}
      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto">
        {/* ── LO STATO SI CAMBIA DA QUI ──────────────────────────────────
            La pastiglia apre la finestra degli stati a griglia: gli stessi che
            propone la scheda, perché li decide `statiPer` in tutti e due i
            posti. I tre pulsanti accanto sono le scorciatoie per i casi
            frequenti; questa serve per tutti gli altri.
            Era un <select> nativo: quindici voci in colonna da leggere una per
            una, e sul telefono la rotella di sistema. */}
        {onStato ? (
          <PastigliaStato
            dati={l.data}
            contesto={`${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim() || undefined}
            className="max-w-[160px]"
            onScegli={(s) => onStato(l, s)}
          />
        ) : (
          /*  ⚠️ `truncate` E LARGHEZZA MASSIMA COME NELLA PASTIGLIA PREMIBILE.
              Qui l'etichetta era un testo nudo dentro il badge: `CLASSE_BADGE_STATO`
              non impone `whitespace-nowrap`, quindi «Appuntamento rifissato» o
              «Nel nostro centro» andavano a capo DENTRO la pastiglia, che è
              disegnata per una riga sola (leading-5) — la seconda riga usciva
              dal bordo colorato e finiva sopra quello che stava sotto.
              Non è un difetto di colore: è di larghezza, e si vede solo dove la
              riga è stretta (telefono) o l'etichetta lunga. La stessa forma
              della pastiglia che si può premere — un solo modo di tagliare. */
          <span
            title={LEAD_STATUS_LABEL[l.data.stato]}
            className={cn(CLASSE_BADGE_STATO, classiStato(l.data.stato), "h-7 max-w-[160px]")}
          >
            <span className="truncate">{LEAD_STATUS_LABEL[l.data.stato]}</span>
          </span>
        )}
        <TornaIndietro lead={l} onStato={onStato} />

        {/* ── ESITO DELL'APPUNTAMENTO, UN GESTO SOLO ─────────────────────
            Due pulsanti invece di due voci dentro un menu: è la cosa che si
            segna più spesso, e cercarla ogni volta in un elenco di quindici
            stati era il motivo per cui restava indietro.
            Erano tre: il terzo diceva "Consulenza svolta" e non c'è più, perché
            una consulenza è svolta appena NON è segnata assente o da
            riprogrammare. L'esito vero (venduto, in valutazione, ricontatto)
            si sceglie nella pastiglia qui accanto. */}
        {onStato && esiti && (
          <div className="flex shrink-0 items-center gap-1">
            {ESITI.map((e) => {
              const on = l.data.stato === e.stato;
              //  Il nome per esteso arriva da ESITI (crm/ui), non da
              //  LEAD_STATUS_LABEL: il pulsante rosso copre sia il cliente
              //  assente sia la consulenza non svolta, e il committente ha
              //  chiesto che si chiami "Cliente assente" — il caso vero quasi
              //  sempre. Definito in un posto solo, l'agenda e l'elenco lead
              //  non possono più chiamarlo in due modi.
              const titolo = e.nome;
              return (
                <button
                  key={e.stato}
                  type="button"
                  title={titolo}
                  aria-label={titolo}
                  aria-pressed={on}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onStato(l, e.stato);
                  }}
                  //  ⚠️ LARGHEZZA FISSA, ACCESO O SPENTO. La spunta occupa il
                  //  suo posto anche quando non si vede: se comparisse
                  //  allargando il pulsante, premere "NF" sposterebbe di
                  //  quattordici pixel il pulsante accanto — cioè proprio sotto
                  //  il dito che sta per premerlo, su una riga che si lavora
                  //  venti volte al giorno.
                  className={cn(
                    "inline-flex h-7 w-[42px] shrink-0 items-center justify-center gap-0.5",
                    "rounded-md border text-[11px] font-bold transition",
                    on ? e.acceso : e.spento,
                  )}
                >
                  <SpuntaSegnato acceso={on} />
                  {e.sigla}
                </button>
              );
            })}
          </div>
        )}

        {/*  ── COM'È ANDATA, SCRITTO ────────────────────────────────────────
            Sta qui, attaccato allo stato e agli esiti, perché è la stessa
            domanda ("com'è andata questa consulenza") solo con le parole
            invece che con un pulsante. Le icone che MANDANO qualcosa al
            cliente cominciano dopo: sono un altro mestiere. */}
        <NotePostConsulenza lead={l} />

        {/*  ── I DUE GESTI DI TUTTI I GIORNI, SCOPERTI ──────────────────────
            Chiamare e scrivere sono le due cose che si fanno decine di volte
            al giorno: restano a un tocco, senza passaggi. Tutto il resto sta
            nel menu qui accanto (vedi MenuInvia per il perché). */}
        {l.data.telefono && (
          <>
            <a
              href={`tel:${l.data.telefono}`}
              title="Chiama"
              aria-label="Chiama"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Phone className="h-4 w-4" />
            </a>
            {/* ── IL MESSAGGIO GIÀ SCRITTO, IN BASE ALLO STATO ──────────────
                Qui il collegamento apriva WhatsApp VUOTO: si finiva a
                riscrivere ogni volta lo stesso messaggio a mano, e chi scrive
                di fretta scrive peggio. Ora parte già compilato con il testo
                dello stato in cui si trova la trattativa — compreso il link
                della consulenza. */}
            {/*  ⚠️ Passa dalla domanda sui lavori: vedi crm/TastoMessaggio. */}
            <TastoMessaggio
              telefono={l.data.telefono}
              messaggio={getWhatsAppMessageForStatus(l, consulente)}
              nome={l.data.nome || ""}
              quandoConsulenza={l.data.dataMeeting}
              stato={l.data.stato}
              titolo="Scrivi su WhatsApp"
              className="shrink-0 rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-50"
            >
              <MessageCircle className="h-4 w-4" />
            </TastoMessaggio>
            {/* ── ⚠️ IL PROMEMORIA, DOVE SERVE DAVVERO ────────────────────
                Richiesto dal committente: finita la consulenza si resta su
                questa lista, e da qui si mandano i messaggi senza aprire la
                scheda. Il promemoria però non è un messaggio che si manda
                sempre — dice «ti ricordo il nostro appuntamento» e allega il
                link — e su una consulenza appena conclusa ricorderebbe
                l'incontro di stamattina, facendolo sembrare saltato.
                `promemoriaUtile` legge data e stato INSIEME: su una scheda
                ancora ad appuntamento l'incontro di oggi va ricordato, su una
                andata avanti serve solo se ce n'è già uno NUOVO più in là. */}
            {promemoriaUtile(l.data, oggiLocale()) && (
              <a
                href={buildWhatsAppLink(l.data.telefono, buildMeetReminderMessage(l, consulente))}
                target="_blank"
                rel="noopener"
                title={`Manda ${etichettaPromemoria(l.data, oggiLocale())}`}
                aria-label="Manda il promemoria"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 rounded-md p-1.5 text-amber-600 transition hover:bg-amber-50"
              >
                <Bell className="h-4 w-4" />
              </a>
            )}
          </>
        )}

        {/*  ── LA PAGINA DELL'APPUNTAMENTO STA FUORI DAL MENU ───────────────
            Era finita dentro il menu insieme agli altri invii, e da lì non
            l'ha trovata nessuno: una funzione nuova nascosta sotto tre puntini
            è una funzione che non esiste. Sta accanto alle altre icone, come
            chiesto, ed è l'unica del gruppo che CREA qualcosa invece di aprire
            un messaggio già scritto — motivo in più per tenerla distinta.
            Il resto (link della consulenza, promemoria) resta nel menu. */}
        {mostraInvito && (
          <button
            type="button"
            title="Pagina dell'appuntamento: crea il link e lo copia"
            aria-label="Crea la pagina dell'appuntamento e copia il link"
            onClick={(e) => {
              e.stopPropagation();
              //  Il link si copia SEMPRE, anche quando poi si apre il pannello:
              //  chi voleva solo mandare il link fa un gesto solo, come prima, e
              //  chi vuole anche l'immagine se la trova già davanti. Il pannello
              //  si apre solo a link nato — senza, non ci sarebbe niente da
              //  mandare e sarebbe una finestra che si apre per dire di no.
              void generaInvito(l).then((link) => {
                if (!link) return;
                const dati: DatiBiglietto = {
                  //  Solo il nome di battesimo, la stessa regola della pagina
                  //  pubblica: un'immagine si inoltra, e il cognome di una
                  //  persona che sta valutando un trapianto non deve viaggiare.
                  nome: nomeDiBattesimo(l.data.nome, l.data.cognome),
                  giorno: giornoInvito,
                  ora: oraInvitoPulita(l.data.oraMeeting),
                  durataMinuti: durataPulita(l.data.durataMeeting) || DURATA_PREDEFINITA,
                  consulente,
                  link,
                  //  Serve solo ad aprire WhatsApp sulla chat giusta: non
                  //  finisce sul biglietto (vedi DatiBiglietto).
                  telefono: l.data.telefono,
                  //  ⚠️ Il codice della stanza NON si legge da `linkMeeting`.
                  //  Quel campo contiene quello che c'era prima — spesso un
                  //  indirizzo di Google Meet — mentre la stanza Meetly del lead
                  //  vive sul server (app_config `meet:<leadId>`, vedi
                  //  api.crm.meeting-session). Cercando il codice nel posto
                  //  sbagliato, per tutti i lead con un vecchio link di Google
                  //  l'anteprima non veniva depositata sul link che il cliente
                  //  riceve davvero. Si chiede al server, subito sotto.
                  stanza: codiceStanzaDi(l.data),
                };
                setBiglietto(dati);
                //  ⚠️ L'anteprima del link parte DA QUI, non dal pannello.
                //  Legarla al pannello voleva dire legarla al fatto che
                //  qualcuno la guardasse: chi copia il link e chiude subito
                //  mandava un link senza immagine, e infatti nell'archivio non
                //  c'era un solo deposito. Il disegno si fa fuori schermo.
                //
                //  ⚠️ E se fallisce SI DICE. Questo è il percorso principale —
                //  quello che percorre chiunque, anche senza aprire il pannello
                //  — e lasciarlo muto ha già fatto credere per due volte che la
                //  funzione ci fosse mentre non depositava niente. Un'anteprima
                //  mancante non blocca il lavoro, quindi l'avviso non è un
                //  allarme: è la sola cosa che distingue «mandato col biglietto»
                //  da «mandato col logo».
                //  Prima di depositare si chiede al server qual è la stanza
                //  di questo lead: è l'unica fonte che sa distinguere una
                //  stanza nostra da un link di terzi rimasto in scheda.
                void stanzaDelLead(l.id).then((codiceStanza) => {
                  const conStanza = codiceStanza ? { ...dati, stanza: codiceStanza } : dati;
                  void depositaAnteprimaBiglietto(conStanza, (stato, motivo) => {
                    if (stato === "errore") {
                      toast.warning("Anteprima del link non creata", {
                        description: `${motivo || "motivo sconosciuto"} · il link funziona, ma nella chat comparirà il logo.`,
                        duration: 9000,
                      });
                    }
                  });
                });
              });
            }}
            className="shrink-0 rounded-md p-1.5 text-violet-600 transition hover:bg-violet-50"
          >
            <CalendarCheck className="h-4 w-4" />
          </button>
        )}
        {/*  Il pannello si disegna dentro un portale, quindi qui conta solo che
            stia nell'albero della riga: non eredita né spaziature né allineamenti
            da questa fila di icone. */}
        <BigliettoPannello
          aperto={!!biglietto}
          chiudi={() => setBiglietto(null)}
          dati={biglietto}
        />

        {/*  ── TUTTO CIÒ CHE SI MANDA UNA VOLTA PER APPUNTAMENTO ────────────
            Link della consulenza · promemoria. Erano icone sciolte accanto
            alle due qui sopra: la ragione per cui adesso stanno insieme, con
            un nome scritto ciascuno, è spiegata su MenuInvia. */}
        <MenuInvia voci={vociInvia.filter((v) => v.chiave !== "invito")} />

        {/*  ── UNA SOLA VIDEOCAMERA SULLA RIGA ──────────────────────────────
            Qui c'era anche "Entra nella consulenza", che apriva il link della
            stanza: stessa icona e stesso colore del tasto che MANDA il link, e
            due videocamere identiche una accanto all'altra si leggono come un
            doppione. Ma soprattutto duplicava "Avvia consulenza", che fa la
            stessa cosa e in più porta con sé i dati del lead, così il
            preventivo nasce già intestato. È rimasto quello, ed è meglio. */}

        {/*  L'azione principale usa il colore primario del CRM invece di un blu
            scritto a mano: è l'unico pulsante pieno della riga, e deve essere
            lo stesso blu dei pulsanti principali di tutte le altre pagine. */}
        {principale === undefined ? (
          <button
            type="button"
            title="Avvia la consulenza con questo cliente"
            onClick={(e) => {
              e.stopPropagation();
              void avviaConsulenza(l, nomeConsulente);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:brightness-110"
          >
            <Play className="h-3 w-3" fill="currentColor" /> Avvia
          </button>
        ) : (
          principale
        )}
      </div>
    </li>
  );
}

/** Elenco di righe: un solo separatore, sempre lo stesso. */
export function Elenco({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border/70">{children}</ul>;
}

/* ── ADESSO ─────────────────────────────────────────────────────────────────
   IL RIQUADRO PIÙ IMPORTANTE DELLA GIORNATA, e l'unico che si legge in piedi.
   La dashboard rispondeva "ecco tutti i tuoi appuntamenti": giusto, ma la
   domanda delle otto del mattino è più stretta — «chi ho ADESSO e cosa premo».
   Con dieci righe tutte uguali quella risposta costava una lettura completa
   dell'elenco, ogni volta, venti volte al giorno.

   Qui il prossimo appuntamento è UNO, grande, con quanto manca scritto in
   parole e i quattro gesti che servono davvero (avvia · WhatsApp · chiama ·
   promemoria) a portata di pollice: bersagli da 40px, perché questa pagina si
   guarda dal telefono mentre si cammina verso la sala.
   Il resto della giornata resta sotto, nell'agenda, dov'è sempre stato. */
export function SchedaAdesso({
  lead,
  attesa,
  prossimi,
  onApri,
  onStato,
  nomeConsulente,
}: {
  lead: Lead;
  attesa?: { testo: string; tono: "ora" | "ritardo" | "attesa" } | null;
  /** i successivi della giornata: si guardano, non si lavorano da qui */
  prossimi?: Lead[];
  onApri: (l: Lead) => void;
  onStato?: (l: Lead, s: LeadStatus) => void;
  nomeConsulente?: (l: Lead) => string | undefined;
}) {
  const l = lead;
  const consulente = nomeConsulente?.(l);
  const cifreTelefono = ultimeCifre(l.data?.telefono);

  //  Il riquadro cambia tinta con il ritardo: finché si è in orario è cielo
  //  ("si lavora adesso"), quando l'appuntamento è passato diventa rosa. È lo
  //  stesso passaggio di colore delle righe e delle scadenze, quindi non c'è
  //  una tavolozza nuova da imparare.
  const inRitardo = attesa?.tono === "ritardo";
  const cornice = inRitardo
    ? "border-rose-300 ring-1 ring-rose-200"
    : "border-sky-300 ring-1 ring-sky-200";
  const testata = inRitardo ? "border-rose-200 bg-rose-50/70" : "border-sky-200 bg-sky-50/70";
  const iconaTestata = inRitardo ? "text-rose-600" : "text-sky-600";

  /** Bersaglio quadrato da 40px: è la misura sotto la quale, in piedi e di
   *  fretta, si sbaglia pulsante. */
  const tondo =
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card transition hover:bg-muted";

  return (
    <section className={`overflow-hidden rounded-xl border bg-card ${cornice}`}>
      <header className={`flex items-center gap-2 border-b px-3 py-2 ${testata}`}>
        <Clock className={`h-4 w-4 shrink-0 ${iconaTestata}`} />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide">Adesso</h2>
        <div className="ml-auto">
          <ChipAttesa attesa={attesa} grande />
        </div>
      </header>

      <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
        <span className="shrink-0 text-[22px] font-semibold leading-none tabular-nums">
          {l.data.oraMeeting || "—"}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onApri(l)}
            className="flex w-full min-w-0 items-baseline gap-2 text-left text-[17px] font-semibold leading-tight hover:underline"
          >
            <span className="truncate">
              {l.data.nome} {l.data.cognome}
            </span>
            {/*  Le ultime cifre del numero anche qui: è la scheda che si guarda
                dal telefono un attimo prima di chiamare, ed è lì che serve
                sapere se il numero in rubrica è quello giusto. */}
            {cifreTelefono && (
              <span
                className="shrink-0 text-[13px] font-medium tabular-nums text-muted-foreground"
                title={`Numero che finisce con ${cifreTelefono}`}
              >
                …{cifreTelefono}
              </span>
            )}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
            <TornaIndietro lead={l} onStato={onStato} />
            {/*  Stesso taglio della riga: senza `truncate` l'etichetta lunga si
                spezzava in due righe dentro una pastiglia alta una riga sola. */}
            <span
              title={LEAD_STATUS_LABEL[l.data.stato]}
              className={cn(CLASSE_BADGE_STATO, classiStato(l.data.stato), "max-w-[190px]")}
            >
              <span className="truncate">{LEAD_STATUS_LABEL[l.data.stato]}</span>
            </span>
            {consulente && <span className="truncate">{consulente}</span>}
            {l.data.citta && <span className="truncate">{l.data.citta}</span>}
            {l.data.durataMeeting ? <span>{l.data.durataMeeting} min</span> : null}
          </div>
        </div>
      </div>

      {/* ── I GESTI ────────────────────────────────────────────────────────
          Uno pieno e tre di contorno: l'unica azione che si fa davvero è
          avviare, le altre servono quando qualcosa non torna (non risponde,
          è in ritardo, va avvisato). */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={() => void avviaConsulenza(l, nomeConsulente)}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition hover:brightness-110 sm:flex-none"
        >
          <Play className="h-4 w-4" fill="currentColor" /> Avvia consulenza
        </button>

        {l.data.telefono && (
          <>
            <TastoMessaggio
              telefono={l.data.telefono}
              messaggio={getWhatsAppMessageForStatus(l, consulente)}
              nome={l.data.nome || ""}
              quandoConsulenza={l.data.dataMeeting}
              stato={l.data.stato}
              titolo="Scrivi su WhatsApp"
              className={`${tondo} text-emerald-600`}
            >
              <MessageCircle className="h-4 w-4" />
            </TastoMessaggio>
            <a
              href={`tel:${l.data.telefono}`}
              title="Chiama"
              aria-label="Chiama"
              className={`${tondo} text-muted-foreground`}
            >
              <Phone className="h-4 w-4" />
            </a>
            {/*  Consegna il link e dice che non serve scaricare nulla: è il
                messaggio del momento in cui l'ora è quella e il cliente non
                è ancora entrato. Compare solo con una stanza NOSTRA: sulle
                schede vecchie il link salvato è di Google Meet, una stanza che
                non esiste più, e mandarlo vuol dire spedire il cliente davanti
                a una porta chiusa. */}
            {haStanzaNostra(l.data) && (
              <a
                href={buildWhatsAppLink(l.data.telefono, buildLinkConsulenzaMessage(l, consulente))}
                target="_blank"
                rel="noopener"
                title="Manda il link della consulenza (spiega che non serve scaricare nulla)"
                aria-label="Manda il link della consulenza"
                className={`${tondo} text-sky-600`}
              >
                <Video className="h-4 w-4" />
              </a>
            )}
            <a
              href={buildWhatsAppLink(l.data.telefono, buildMeetReminderMessage(l, consulente))}
              target="_blank"
              rel="noopener"
              title={`Manda ${etichettaPromemoria(l.data, oggiLocale())}`}
              aria-label="Manda il promemoria"
              className={`${tondo} text-amber-600`}
            >
              <Bell className="h-4 w-4" />
            </a>
          </>
        )}
      </div>

      {/* ── COM'È ANDATA ───────────────────────────────────────────────────
          Si segna da qui senza scorrere fino all'agenda: è il gesto che, se
          costa un passaggio in più, resta indietro fino a sera.
          I due pulsanti dicono solo che la consulenza NON c'è stata; se c'è
          stata si va dritti alla pastiglia accanto e si dice com'è andata —
          quella scelta, da sola, la conta già fra le svolte. */}
      {onStato && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-3 py-2.5 sm:px-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Esito
          </span>
          <div className="flex items-center gap-1.5">
            {ESITI.map((e) => {
              const on = l.data.stato === e.stato;
              return (
                <button
                  key={e.stato}
                  type="button"
                  title={e.nome}
                  aria-label={e.nome}
                  aria-pressed={on}
                  onClick={() => onStato(l, e.stato)}
                  //  Stessa spunta della riga, stesso spazio riservato: i due
                  //  posti in cui si segna l'esito devono somigliarsi, perché
                  //  chi impara qui deve saper leggere anche là.
                  className={cn(
                    "inline-flex h-9 min-w-[56px] items-center justify-center gap-1",
                    "rounded-lg border px-2 text-[12px] font-bold transition",
                    on ? e.acceso : e.spento,
                  )}
                >
                  <SpuntaSegnato acceso={on} grande />
                  {e.sigla}
                </button>
              );
            })}
          </div>
          {/*  Le note stanno accanto agli esiti, e qui col nome scritto: questo
              riquadro si guarda da lontano, e ha lo spazio per dire cosa fa un
              tasto invece di lasciarlo indovinare. */}
          <NotePostConsulenza lead={l} grande />
          {/*  Stessa finestra della riga: qui il riquadro è più grande, ma il
               gesto che si impara deve restare uno. */}
          <PastigliaStato
            dati={l.data}
            contesto={`${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim() || undefined}
            className="ml-auto h-9 max-w-[190px] text-[12px]"
            onScegli={(s) => onStato(l, s)}
          />
        </div>
      )}

      {/* ── POI ────────────────────────────────────────────────────────────
          Due o tre nomi, non l'agenda intera: serve a sapere se si può
          allungare questa consulenza o se il prossimo è già alla porta. */}
      {prossimi && prossimi.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-2 text-[11.5px] sm:px-4">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">Poi</span>
          {prossimi.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApri(p)}
              className="max-w-full truncate text-muted-foreground transition hover:text-foreground hover:underline"
            >
              <span className="font-semibold tabular-nums text-foreground">
                {p.data.oraMeeting}
              </span>{" "}
              {p.data.nome} {p.data.cognome}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── LA STRISCIA DEI GIORNI ─────────────────────────────────────────────────
   CHIUSA MOSTRA OGGI. APERTA MOSTRA IL MESE.

   Prima qui c'erano nove pastiglie sempre aperte — due giorni indietro, oggi,
   sei avanti — e due difetti che si pagavano ogni mattina: nove bersagli da
   leggere per sceglierne quasi sempre uno (oggi), e nessun modo di arrivare a
   giovedì prossimo senza uscire dalla dashboard.

   Adesso la barra dice UN giorno solo — quello che si sta guardando, di norma
   oggi — con quanti appuntamenti ha. Un tocco sulla barra apre il mese intero,
   dal primo all'ultimo giorno; le frecce del mese portano ovunque; "Oggi"
   riporta a casa da qualsiasi mese, e costa un tocco.

   IL VOCABOLARIO È QUELLO DELLA PAGINA AGENDA (CRM.agenda.tsx), non un terzo
   inventato qui: due calendari diversi nello stesso programma si imparano due
   volte.
    · OGGI  = il numero dentro un pieno SKY. È l'unico giorno che si cerca senza
      sapere la data, e si vede anche con la coda dell'occhio;
    · SCELTO = anello scuro intorno alla cella. Bordo e pieno sono due segnali
      diversi apposta: oggi e il giorno scelto devono poter stare sulla stessa
      cella senza sovrapporsi;
    · PASSATO = inchiostro tenue, non sbiadito: i giorni andati si leggono
      ancora, perché è lì che vive l'arretrato;
    · QUANTI = il badge del carico, la stessa pastiglia del resto del CRM
      (verde c'è margine · ambra giornata piena · rosso si sfora). A ZERO NON
      RENDE NIENTE (vedi BadgeCarico): un mese pieno di "0" è un mese in cui
      non si vede più dove c'è spazio.

   LE MISURE. Le celle sono più piccole delle vecchie pastiglie — un mese intero
   deve entrare senza scorrere — ma mai sotto i 40px: sotto quella misura, in
   piedi e di fretta, il pollice sbaglia bersaglio. 46px di altezza, larghezza
   data dalle sette colonne (su uno schermo da 360px restano circa 41px). */
function StrisciaGiorni({
  giorno,
  oggi,
  conta,
  onScegli,
  storico,
  onStorico,
  quantiStorico,
  periodo,
  onPeriodo,
}: {
  /** il giorno mostrato, così come lo costruisce giornoDaScarto */
  giorno: { o: number; nome: string; iso: string; esteso: string };
  /** oggi in formato "2026-08-14", con l'orologio locale */
  oggi: string;
  /** quanti appuntamenti in quel giorno (0 = nessuno, e il badge non compare) */
  conta: (isoGiorno: string) => number;
  /** cambia giorno passando lo SCARTO rispetto a oggi */
  onScegli: (scarto: number) => void;
  /** acceso = si stanno guardando TUTTE le date fino a oggi, non una giornata */
  storico: boolean;
  onStorico: (acceso: boolean) => void;
  /** quanti appuntamenti ci sono in tutto lo storico, filtro consulente compreso */
  quantiStorico: number;
  /** ── DA UNA DATA A UN'ALTRA ──────────────────────────────────────────
   *  Richiesta del committente: «il filtro degli esiti di oggi voglio poterlo
   *  cambiare e mettere anche tutto il periodo o da data a data».
   *  C'erano due sole risposte — una giornata, oppure tutto — e in mezzo c'è
   *  la domanda che si fa davvero: «com'è andata questa settimana?», «e il
   *  mese scorso?». `null` = non è attivo. */
  periodo: { da: string; a: string } | null;
  onPeriodo: (p: { da: string; a: string } | null) => void;
}) {
  //  Gli hook stanno tutti qui in cima, prima di qualsiasi uscita anticipata:
  //  React li conta per posizione.
  const [aperto, setAperto] = useState(false);
  /** ── IL MESE SFOGLIATO VALE FINCHÉ IL GIORNO NON CAMBIA ─────────────────
   *  `null` = "segui il giorno scelto", che è il caso normale: aprendo la
   *  striscia si vede il mese del giorno che si sta guardando.
   *  Quando si sfoglia con le frecce del mese ci si segna anche PER QUALE
   *  giorno lo si è fatto: se poi il giorno cambia da fuori — le frecce della
   *  tastiera, il tasto "Oggi", un'altra parte della dashboard — il mese
   *  sfogliato scade da solo e la griglia torna a seguire il giorno scelto.
   *  Senza questo legame si restava a guardare ottobre con la barra ferma su un
   *  giorno di agosto: due date sullo schermo, nessuna delle due sbagliata,
   *  e nessun modo di capire quale comandasse. */
  const [meseVisto, setMeseVisto] = useState<{
    anno: number;
    mese: number;
    /** il giorno scelto nel momento in cui si è sfogliato */
    per: string;
  } | null>(null);
  const meseSfogliato = meseVisto?.per === giorno.iso ? meseVisto : null;

  /** ── IL FUOCO NON DEVE CADERE NEL VUOTO ──────────────────────────────────
   *  Accendendo lo storico la striscia intera viene smontata, e con lei il
   *  pulsante che si era appena premuto: il fuoco della tastiera torna al
   *  `body`, cioè il prossimo Tab riparte dall'inizio della pagina e chi non
   *  usa il mouse deve riattraversare tutta la dashboard per ritrovare il
   *  posto. Lo stesso all'uscita. Qui lo si sposta a mano sul pulsante
   *  gemello — «Torna a oggi» entrando, «Tutto lo storico» uscendo — che è
   *  anche il comando che serve subito dopo.
   *  ⚠️ È anche l'unico annuncio SICURO per il lettore di schermo: l'`aria-live`
   *  qui sotto nasce insieme al testo che dovrebbe leggere, e una regione viva
   *  inserita già piena non viene riletta da tutti i lettori. Un pulsante che
   *  prende il fuoco invece viene detto sempre, con il suo titolo.
   *  ⚠️ `precedente` esiste per non rubare il fuoco AL PRIMO MONTAGGIO: senza,
   *  aprendo la dashboard il cursore salterebbe dentro l'agenda da solo. */
  const tornaOggiRef = useRef<HTMLButtonElement>(null);
  const apriStoricoRef = useRef<HTMLButtonElement>(null);
  const precedente = useRef(storico);
  useEffect(() => {
    if (precedente.current === storico) return;
    precedente.current = storico;
    (storico ? tornaOggiRef : apriStoricoRef).current?.focus();
  }, [storico]);

  //  Lettura difensiva anche qui: `giorno.iso` nasce da una Date e non dovrebbe
  //  mai essere illeggibile, ma se lo fosse il mese si costruirebbe intorno a
  //  "Invalid Date" e la griglia uscirebbe vuota senza dire perché.
  const base = (() => {
    const d = new Date(`${giorno.iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  })();
  const anno = meseSfogliato?.anno ?? base.getFullYear();
  const mese = meseSfogliato?.mese ?? base.getMonth();

  /** Il mese, dal primo all'ultimo giorno: niente giorni di riempimento dei mesi
   *  vicini. Il committente ha chiesto "dal 1 al 31" e ha ragione — qui il mese
   *  serve a scegliere un giorno di QUESTO mese, e le code grigie sono bersagli
   *  che portano altrove. L'allineamento con le colonne resta comunque, perché
   *  la prima cella parte dalla sua colonna vera. */
  const celle = useMemo(() => {
    const quantiGiorni = new Date(anno, mese + 1, 0).getDate();
    //  Colonna del primo del mese, con lunedì = 1 (le colonne CSS partono da 1).
    const colonnaPrimo = ((new Date(anno, mese, 1).getDay() + 6) % 7) + 1;
    const elenco: {
      num: number;
      iso: string;
      /** scarto rispetto a oggi: è quello che si passa a chi ci sta sopra */
      o: number;
      oggi: boolean;
      passato: boolean;
      esteso: string;
    }[] = [];
    for (let n = 1; n <= quantiGiorni; n++) {
      const d = new Date(anno, mese, n, 12, 0, 0, 0);
      const isoGiorno = iso(d);
      elenco.push({
        num: n,
        iso: isoGiorno,
        o: giorniDaOggi(isoGiorno),
        oggi: isoGiorno === oggi,
        passato: isoGiorno < oggi,
        esteso: FMT_ESTESO.format(d),
      });
    }
    return { colonnaPrimo, elenco };
  }, [anno, mese, oggi]);

  const nDelGiorno = conta(giorno.iso);
  const meseDiOggi = oggi.slice(0, 7) === `${anno}-${String(mese + 1).padStart(2, "0")}`;
  /** "Oggi" compare quando serve a qualcosa: o non si sta guardando oggi, o lo
   *  si sta guardando ma il calendario è aperto su un altro mese — e da lì
   *  tornare a casa senza un tasto costa tante frecce quanti sono i mesi. */
  const serveOggi = giorno.o !== 0 || (aperto && !meseDiOggi);

  const cambiaMese = (delta: number) => {
    const d = new Date(anno, mese + delta, 1);
    setMeseVisto({ anno: d.getFullYear(), mese: d.getMonth(), per: giorno.iso });
  };

  /** Scegliere un giorno riporta il calendario a seguire il giorno scelto: se
   *  restasse fermo sul mese sfogliato, la barra direbbe una data e la griglia
   *  ne mostrerebbe un'altra. */
  const scegli = (scarto: number) => {
    setMeseVisto(null);
    onScegli(scarto);
  };

  /** Bersaglio da 40px: la misura sotto la quale, in piedi e di fretta, si
   *  sbaglia pulsante. Vale per le frecce come per le celle. */
  const tasto =
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground";

  /* ── DA ACCESO, LA STRISCIA SI TOGLIE DI MEZZO ────────────────────────────
     ⚠️ Questa uscita anticipata sta DOPO tutti gli hook: sopra ci sono due
     `useState` e un `useMemo`, e React li conta per posizione — un `return`
     messo più in alto è la schermata bianca (#310), che in questo file è già
     successa una volta.

     Perché sparisce tutto — barra, frecce, rotaia degli undici giorni,
     calendario del mese: sono comandi che scelgono UN giorno, e quando si
     guardano otto mesi insieme non scelgono più niente. Lasciarli accesi
     avrebbe messo in cima alla pagina una data evidenziata mentre sotto
     scorrono le righe di marzo: due verità sullo schermo, e chi guarda deve
     indovinare quale comanda.
     Al loro posto resta una sola riga che dice dove si è e come si torna
     indietro, e il ritorno costa UN tocco — lo stesso "Oggi" di sempre, qui
     scritto per esteso perché è l'unica via d'uscita rimasta. */
  if (storico) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/5 px-2.5 py-2">
        <History className="h-4 w-4 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          {/*  `aria-live` è la CINTURA, non le bretelle: chi usa il lettore di
              schermo preme un pulsante in fondo alla striscia e si ritrova la
              pagina cambiata sotto, e deve sentirsi dire che cosa è successo.
              Ma questa regione nasce già piena — non viene aggiornata, viene
              INSERITA — e in quel caso non tutti i lettori la rileggono: l'unica
              cosa che viene detta di sicuro è il pulsante che prende il fuoco,
              spostato a mano dall'effetto qui sopra. */}
          <p aria-live="polite" className="text-[13px] font-semibold leading-tight">
            Tutto lo storico
          </p>
          <p className="text-[11.5px] leading-snug text-muted-foreground">
            Tutte le date dall'inizio fino a oggi, insieme: {quantiStorico}{" "}
            {quantiStorico === 1 ? "appuntamento" : "appuntamenti"}. Non è una giornata — orari,
            attese e conti alla rovescia qui non valgono.
          </p>
        </div>
        <button
          type="button"
          ref={tornaOggiRef}
          onClick={() => onStorico(false)}
          title="Torna alla giornata di oggi"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold text-foreground transition hover:bg-muted"
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
          Torna a oggi
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* ── LA BARRA: CHE GIORNO SI STA GUARDANDO ──────────────────────────
          Dice il giorno e quanto pesa, ed è essa stessa il gesto che apre il
          mese: il bersaglio più grande della riga fa la cosa più richiesta. */}
      <div className="flex items-center gap-1 px-1.5 py-1.5 sm:px-2">
        <button
          type="button"
          onClick={() => setAperto((v) => !v)}
          aria-expanded={aperto}
          title={aperto ? "Chiudi il calendario" : "Apri il mese intero e scegli un giorno"}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-muted/60"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          {/*  "Oggi"/"Ieri"/"Domani" quando c'è; per gli altri giorni la data per
              esteso prende il posto in evidenza, invece di lasciare un vuoto. */}
          {giorno.nome && (
            <span className="shrink-0 text-[13px] font-semibold leading-tight">{giorno.nome}</span>
          )}
          {/*  `flex-1` sulla data e non `ml-auto` sul badge: il badge a zero non
              rende niente (vedi BadgeCarico), e con `ml-auto` la freccia si
              spostava a seconda che il giorno avesse o no appuntamenti — un
              comando che cambia posto sotto il dito. */}
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              giorno.nome
                ? "text-[12px] text-muted-foreground"
                : "text-[13px] font-semibold text-foreground",
            )}
          >
            {giorno.esteso}
          </span>
          {/*  Il carico del giorno mostrato: stesse soglie e stessi colori di
              tutto il CRM (caricoGiornata in crm/ui). A zero il badge non c'è —
              al suo posto la frase, ma solo dove c'è spazio per leggerla. */}
          {nDelGiorno > 0 ? (
            <BadgeCarico
              n={nDelGiorno}
              titolo={`${nDelGiorno} ${nDelGiorno === 1 ? "appuntamento" : "appuntamenti"} in agenda`}
            />
          ) : (
            <span className="hidden shrink-0 text-[12px] text-muted-foreground sm:inline">
              Nessun appuntamento
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              aperto && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {/*  Ieri e domani restano a un tocco anche a striscia chiusa: "e
            domani?" è la domanda che segue "com'è oggi", e aprire il mese per
            spostarsi di un giorno sarebbe un passaggio in più venti volte al
            giorno. Le frecce restano ANCHE ora che c'è la rotaia qui sotto:
            servono alla tastiera e al gesto preciso «uno avanti». */}
        <button
          type="button"
          onClick={() => scegli(giorno.o - 1)}
          title="Giorno precedente (←)"
          aria-label="Giorno precedente"
          className={tasto}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scegli(giorno.o + 1)}
          title="Giorno successivo (→)"
          aria-label="Giorno successivo"
          className={tasto}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {serveOggi && (
          <button
            type="button"
            onClick={() => scegli(0)}
            title="Torna a oggi (O)"
            className="inline-flex h-10 shrink-0 items-center rounded-lg border border-border bg-card px-2.5 text-[12px] font-semibold text-foreground transition hover:bg-muted"
          >
            Oggi
          </button>
        )}
      </div>

      {/*  ── LA ROTAIA DEI GIORNI ────────────────────────────────────────────
          ⚠️ Prima qui c'era solo la riga con il giorno e due frecce, e il
          committente ha detto la cosa giusta: non si capiva che ci fossero
          altri giorni da guardare. Una freccia dice «si può andare avanti»
          solo a chi ha già capito che esiste un avanti; una fila di giorni lo
          MOSTRA, e si vede in un colpo d'occhio anche dove c'è carico e dove no.

          Scorre in orizzontale con aggancio ai bordi (`snap`), quindi funziona
          col dito sul telefono e con due dita sul portatile — che è il gesto
          con cui la gente prova a scorrere quando vede una fila.
          ⚠️ Undici giorni e non trenta: oltre la settimana e mezzo si smette di
          ragionare per «fra quanti giorni» e si va al mese, che è a un tocco
          qui sopra. Una rotaia lunghissima sarebbe un calendario fatto male. */}
      <div className="flex gap-1 overflow-x-auto px-1.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-2">
        {Array.from({ length: 11 }, (_, k) => giorno.o - 3 + k).map((scarto) => {
          const g = giornoDaScarto(scarto);
          const quanti = conta(g.iso);
          const scelto = scarto === giorno.o;
          const eOggi = scarto === 0;
          return (
            <button
              key={g.iso}
              type="button"
              onClick={() => scegli(scarto)}
              aria-current={scelto ? "date" : undefined}
              title={`${g.esteso}${quanti ? ` · ${quanti} in agenda` : " · nessun appuntamento"}`}
              className={cn(
                "flex min-w-[3.25rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 transition",
                scelto
                  ? "border-brand bg-brand text-white shadow-sm"
                  : "border-border bg-card hover:border-brand/40 hover:bg-accent/60",
              )}
            >
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wide",
                  scelto ? "text-white/75" : "text-muted-foreground",
                )}
              >
                {g.settimana}
              </span>
              <span className="text-[15px] font-semibold leading-none">{g.numero}</span>
              {/*  Il carico come punto, non come numero: su undici giorni undici
                  cifre diventano rumore. Il punto dice «qui c'è roba», il
                  numero esatto lo dice il giorno scelto lì sopra. */}
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  quanti === 0
                    ? "bg-transparent"
                    : scelto
                      ? "bg-white"
                      : quanti >= 5
                        ? "bg-amber-500"
                        : "bg-brand",
                )}
                aria-hidden
              />
              {/*  ⚠️ Oggi si riconosce anche quando è selezionato: senza questo
                  segno, spostandosi di tre giorni si perde il riferimento di
                  dove si è partiti. */}
              <span
                className={cn(
                  "h-0.5 w-4 rounded-full",
                  eOggi ? (scelto ? "bg-white/70" : "bg-brand/70") : "bg-transparent",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {/* ── IL MESE INTERO ─────────────────────────────────────────────────
          Si apre solo a richiesta: chiuso, questa schermata risponde alla
          domanda del mattino senza far scegliere niente. */}
      {aperto && (
        <div className="border-t border-border px-1.5 pb-2 pt-2 sm:px-2">
          <div className="flex items-center gap-1 pb-1.5">
            <button
              type="button"
              onClick={() => cambiaMese(-1)}
              title="Mese precedente (Maiusc + ←)"
              aria-label="Mese precedente"
              className={tasto}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/*  "agosto 2026" con l'iniziale alta: una parola sola e un numero,
                quindi `capitalize` non può rovinare niente. */}
            <span
              aria-live="polite"
              className="flex-1 text-center text-[13px] font-semibold capitalize"
            >
              {new Date(anno, mese, 1).toLocaleDateString("it-IT", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              onClick={() => cambiaMese(1)}
              title="Mese successivo (Maiusc + →)"
              aria-label="Mese successivo"
              className={tasto}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {COLONNE_SETTIMANA.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "text-center text-[11px] font-medium",
                  //  Sabato e domenica più tenui: sono giorni in cui di norma
                  //  non si fissa, e devono pesare meno nel colpo d'occhio.
                  i >= 5 ? "text-muted-foreground/60" : "text-muted-foreground",
                )}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {celle.elenco.map((c, i) => {
              const n = conta(c.iso);
              const scelto = c.iso === giorno.iso;
              //  Il badge dice il numero, ma il numero da solo non si legge con
              //  il lettore di schermo né sotto il dito: la frase per esteso
              //  ("giovedì 14 agosto, 3 appuntamenti") sta sul titolo e
              //  sull'etichetta, ed è l'unico posto dove "0" si dice a parole —
              //  lì serve, nella cella sarebbe rumore.
              const quanti =
                n === 0 ? "nessun appuntamento" : n === 1 ? "1 appuntamento" : `${n} appuntamenti`;
              return (
                <button
                  key={c.iso}
                  type="button"
                  //  Solo il primo giorno del mese si mette in colonna: gli altri
                  //  seguono da soli, e il mese resta allineato ai giorni della
                  //  settimana senza celle di riempimento.
                  style={i === 0 ? { gridColumnStart: celle.colonnaPrimo } : undefined}
                  //  Scelto il giorno, il mese si richiude: la risposta —
                  //  l'elenco degli appuntamenti — sta SOTTO la griglia, e un
                  //  mese aperto la spinge fuori dallo schermo del telefono.
                  //  Chiudendo, la barra si aggiorna proprio dove è appena
                  //  arrivato il dito e l'elenco è la riga dopo. Per sapere
                  //  quanti ne ha un giorno non serve sceglierlo: lo dice il
                  //  badge, ed è per questo che c'è.
                  onClick={() => {
                    scegli(c.o);
                    setAperto(false);
                  }}
                  title={`${c.esteso} · ${quanti}`}
                  aria-label={`${c.esteso}, ${quanti}`}
                  aria-current={c.oggi ? "date" : undefined}
                  aria-pressed={scelto}
                  className={cn(
                    "flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-lg border py-1 transition sm:min-h-[54px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    scelto
                      ? "border-foreground ring-1 ring-foreground"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1 text-[13px] font-semibold leading-none tabular-nums",
                      c.oggi
                        ? "bg-sky-600 text-white"
                        : c.passato
                          ? "text-muted-foreground"
                          : "text-foreground",
                    )}
                  >
                    {c.num}
                  </span>
                  {/*  Riga di altezza fissa anche quando il badge non c'è: senza,
                      le celle vuote si accorciavano e la griglia ballava. */}
                  <span className="flex h-[16px] items-center justify-center">
                    <BadgeCarico n={n} tenue className="h-[16px] min-w-[16px] px-1 text-[11px]" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── E SE VOLESSI VEDERLE TUTTE INSIEME? ─────────────────────────────
          Sta IN FONDO alla striscia, dopo i giorni, e non fra le frecce: è la
          domanda che viene dopo aver guardato la giornata, e messa in mezzo ai
          comandi del giorno avrebbe rubato spazio proprio a quelli che si
          usano venti volte al mattino.
          Ha l'etichetta E la frase che la spiega, tutte e due sempre visibili:
          "Tutto lo storico" da solo lascia la domanda «tutto cosa?», e un
          comando che si capisce solo dopo averlo premuto si preme una volta e
          poi lo si evita. Il numero è lì apposta: dice quanto pesa PRIMA di
          entrare, così nessuno apre ottocento righe per sbaglio. */}
      <div className="border-t border-border">
        <button
          type="button"
          ref={apriStoricoRef}
          onClick={() => onStorico(true)}
          title={`Mostra insieme tutti gli appuntamenti dall'inizio fino a oggi (${quantiStorico}), invece di una giornata sola`}
          className="flex w-full items-center gap-2 rounded-b-xl px-3 py-2 text-left transition hover:bg-muted/60"
        >
          <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-[12.5px] font-semibold">Tutto lo storico</span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
            Tutte le date fino a oggi in un elenco solo
          </span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {quantiStorico}
          </span>
        </button>
        {/*  ── DAL … AL … ───────────────────────────────────────────────────
             Richiesta del committente: «anche da data a data, minimale».
             Due campi e basta: niente finestre, niente «applica» — si scrive
             la data e l'elenco cambia, com'è già per il giorno. Sta sotto
             «Tutto lo storico» perché è la stessa domanda, più stretta.
             ⚠️ VALE QUANDO CI SONO TUTTE E DUE: con una sola si guarderebbe
              «da martedì a mai», e l'elenco diventerebbe lo storico senza che
              nessuno l'abbia chiesto.
             ⚠️ E SI SPEGNE DA SÉ: la × rimette la giornata, perché un filtro
              acceso che non si sa come togliere è peggio di un filtro che
              manca. */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
          <span className="text-[11.5px] font-semibold text-muted-foreground">Dal</span>
          <input
            type="date"
            value={periodo?.da || ""}
            max={oggi}
            onChange={(e) =>
              onPeriodo(
                e.target.value && periodo?.a
                  ? { da: e.target.value, a: periodo.a }
                  : e.target.value
                    ? { da: e.target.value, a: oggi }
                    : null,
              )
            }
            className="h-8 rounded-lg border border-border bg-background px-2 text-[12px] tabular-nums"
          />
          <span className="text-[11.5px] font-semibold text-muted-foreground">al</span>
          <input
            type="date"
            value={periodo?.a || ""}
            max={oggi}
            onChange={(e) =>
              onPeriodo(
                e.target.value && periodo?.da
                  ? { da: periodo.da, a: e.target.value }
                  : e.target.value
                    ? { da: e.target.value, a: e.target.value }
                    : null,
              )
            }
            className="h-8 rounded-lg border border-border bg-background px-2 text-[12px] tabular-nums"
          />
          {periodo && (
            <button
              type="button"
              onClick={() => onPeriodo(null)}
              title="Torna alla giornata"
              className="ml-auto rounded-lg px-2 py-1 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ✕ togli
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** ── QUANTE RIGHE SI DISEGNANO IN «TUTTO LO STORICO» ───────────────────────
 *  Cinquanta per gruppo, e SCRITTO A SCHERMO quando il taglio scatta.
 *
 *  Il perché, con i numeri veri di questo archivio (agosto 2026): 843 schede,
 *  di cui 532 con una data di appuntamento leggibile, sparse su sette mesi —
 *  il solo luglio ne ha 285. Una riga qui dentro non è una riga di tabella: è
 *  `RigaLead`, cioè pastiglia di stato, menu «Invia», pulsanti d'esito, note
 *  post-consulenza. Disegnarne cinquecento tutte insieme significa qualche
 *  migliaio di nodi, e il costo non si paga una volta sola: si ripaga a ogni
 *  esito segnato, perché ogni cambio di stato ridisegna l'elenco.
 *
 *  Il taglio è per GRUPPO (da fare · svolti · non svolti) e non sul totale:
 *  tagliando prima di dividere, un archivio pieno di consulenze svolte avrebbe
 *  lasciato i "non svolti" — la parte che si lavora — fuori dallo schermo.
 *  Per la stessa ragione, dentro i "non svolti" vale per ciascuno dei due
 *  sottogruppi: gli arancioni da rifissare stanno in cima, e sessanta di
 *  quelli avrebbero tenuto i clienti assenti fuori dallo schermo pur essendo
 *  contati nella testata (vedi elencoDi).
 *  Il tetto vero a schermo è quindi 4 × 50 = 200 righe (da fare · svolti · da
 *  rifissare · clienti assenti), non 50: è scritto qui perché è il numero che
 *  conta per la fluidità, e chi volesse abbassarlo sappia da dove nasce.
 *
 *  ⚠️ I TRE TOTALI IN CIMA NON SI TAGLIANO MAI: contano tutto lo storico, e
 *  restano veri. Si taglia solo quanto se ne disegna, e la riga sotto l'elenco
 *  lo dice con le stesse parole di «Da recuperare» in routes/CRM.index
 *  («Mostrati i … più recenti di …»): un elenco troncato in silenzio è il modo
 *  più rapido di far contare le righe a mano a qualcuno. */
const MAX_STORICO = 50;

export function MeetGiornalieri({
  leads,
  consulenti,
  onApri,
  onEvidenzia,
  onStato,
  nomeConsulente,
  consulenteId,
  onConsulenteId,
  scarto,
  onScarto,
  adesso,
  storico: storicoDaFuori,
  onStorico,
}: {
  leads: Lead[];
  /** ⚠️ Era una forma minima scritta a mano (`{ id, data: { nome } }`), e con
   *  quella non si poteva chiedere che mestiere fa nessuno: adesso il filtro
   *  qui sopra mostra SOLO chi fa le consulenze, e i mestieri stanno dentro
   *  `data`. Chi monta questo componente passa già l'anagrafica vera. */
  consulenti: Consultant[];
  onApri: (l: Lead) => void;
  onEvidenzia?: (l: Lead) => void;
  onStato?: (l: Lead, s: LeadStatus) => void;
  /** serve alla firma del messaggio: il cliente deve leggere CHI gli scrive */
  nomeConsulente?: (l: Lead) => string | undefined;
  /** filtro consulente condiviso con il resto della pagina (opzionale) */
  consulenteId?: string;
  onConsulenteId?: (id: string) => void;
  /** giorno scelto rispetto a oggi, guidabile da fuori (frecce ← →) */
  scarto?: number;
  onScarto?: (n: number) => void;
  /** minuti dall'inizio della giornata: serve a marcare "adesso" sulle righe di oggi */
  adesso?: number;
  /** ── «TUTTO LO STORICO», GUIDABILE DA FUORI ────────────────────────────
   *  Stessa coppia di `scarto`/`onScarto`: se la dashboard la passa, il
   *  comando è uno solo per tutta la pagina. Serve perché fuori di qui ci
   *  sono due cose che parlano della stessa scelta e devono saperla:
   *  l'intestazione «La giornata» sopra l'agenda — che da acceso sarebbe una
   *  bugia grande quanto il titolo — e il tasto O «torna a oggi», che stando
   *  già su oggi non cambia lo scarto e senza questa prop non avrebbe nessun
   *  modo di riportare indietro chi è dentro lo storico. */
  storico?: boolean;
  onStorico?: (acceso: boolean) => void;
}) {
  //  Stato interno solo come riserva: quando la dashboard passa i valori, il
  //  filtro è uno solo per tutta la pagina.
  const [scartoInterno, setScartoInterno] = useState(0);
  const [chiInterno, setChiInterno] = useState<string>("");
  const giornoScelto = scarto ?? scartoInterno;
  const cambiaGiorno = onScarto ?? setScartoInterno;
  const chi = consulenteId ?? chiInterno;
  const cambiaChi = onConsulenteId ?? setChiInterno;
  /** Quando si preme un totale, l'elenco mostra solo quelle schede. */
  const [soloEsito, setSoloEsito] = useState<ChiaveEsito | null>(null);
  /** ── TUTTO LO STORICO, O UNA GIORNATA ──────────────────────────────────
   *  Acceso = si guardano tutte le date dall'inizio fino a oggi insieme.
   *  La scelta vive alla pagina intera e non dentro la striscia, perché non
   *  riguarda solo la striscia: da acceso cambiano l'insieme mostrato, i tre
   *  totali, l'ordine delle righe e metà delle frasi della pagina.
   *
   *  ⚠️ CAMBIARE GIORNO ESCE DALLO STORICO, ANCHE DA FUORI, e non c'è nessun
   *  `useEffect` a farlo: la riserva interna non tiene un `boolean` ma IL
   *  GIORNO da cui si è entrati, e «sono nello storico» è vero solo finché il
   *  giorno non si muove. Il motivo è che il giorno lo muovono anche le frecce
   *  della tastiera della dashboard (← →, Maiusc per il mese, vedi
   *  routes/CRM.index), che di questo interruttore non sanno niente: senza
   *  questo si premeva ← e non succedeva niente di visibile — lo scarto
   *  cambiava sotto, ma lo schermo continuava a mostrare tutto lo storico.
   *  Scritto come stato derivato invece che come effetto, la regola non può
   *  arrivare un render in ritardo e non c'è un `setState` che parte a ogni
   *  render se chi sta sopra passa una funzione nuova ogni volta. */
  const [storicoDa, setStoricoDa] = useState<number | null>(null);
  /*  ── IL PERIODO SCELTO A MANO ──────────────────────────────────────────
      Richiesta del committente: «il filtro degli esiti di oggi voglio poterlo
      cambiare e mettere anche tutto il periodo o da data a data».
      C'erano due sole risposte — una giornata o tutto lo storico — e in mezzo
      c'è la domanda che ci si fa davvero: com'è andata questa settimana, e il
      mese scorso.
      ⚠️ DA QUI IN POI UN PERIODO È UNO STORICO PIÙ STRETTO: l'elenco si legge
       con le date davanti e dal più recente, come lo storico, e tutte le frasi
       che dicono «dello storico» restano giuste. L'unica cosa che cambia è
       QUALI righe entrano (vedi `insieme`) e come si chiama l'ambito. */
  const [periodo, setPeriodo] = useState<{ da: string; a: string } | null>(null);
  const storico =
    (storicoDaFuori ?? (storicoDa !== null && storicoDa === giornoScelto)) || !!periodo;
  const cambiaStorico = (acceso: boolean) =>
    onStorico ? onStorico(acceso) : setStoricoDa(acceso ? giornoScelto : null);

  //  Il giorno mostrato si RICAVA dallo scarto a ogni render invece di essere
  //  pescato da una tabella calcolata una volta al montaggio. Due motivi:
  //   · lo scarto adesso può valere qualsiasi cosa (il mese aperto porta ovunque)
  //     e una tabella di nove voci restituiva `undefined` fuori da quel tratto;
  //   · una tabella costruita al montaggio con `useMemo(…, [])` invecchia: una
  //     pagina lasciata aperta la notte continuava a chiamare "Oggi" il giorno
  //     prima. Costa una data e una formattazione per render, cioè niente.
  const oggiCorrente = oggiLocale();
  const giorno = giornoDaScarto(giornoScelto);

  /** ── QUANTI APPUNTAMENTI HA OGNI GIORNO ───────────────────────────────────
   *  L'indice dei conteggi per data, costruito UNA VOLTA su tutte le schede.
   *  Serve ai badge del mese: senza indice, aprendo il calendario si filtrerebbe
   *  l'archivio intero trentun volte, una per cella, a ogni render.
   *
   *  LE DATE STORTE RESTANO FUORI. Nell'archivio importato ce ne sono a
   *  centinaia, e `giorniDaOggi` è la porta che le riconosce: se dice NaN la
   *  data non si legge, e una data che non si legge non è un giorno — non va
   *  contata da nessuna parte. Contarle avrebbe gonfiato il badge di una casella
   *  a caso, che è il modo più silenzioso di far perdere fiducia a un numero. */
  const contiPerGiorno = useMemo(() => {
    const per = new Map<string, number>();
    const tutti = Array.isArray(leads) ? leads : [];
    for (const l of tutti) {
      if (chi && l?.data?.consulenteId !== chi) continue;
      const g = soloGiorno(l?.data?.dataMeeting);
      if (!g || Number.isNaN(giorniDaOggi(g))) continue;
      per.set(g, (per.get(g) ?? 0) + 1);
    }
    return per;
  }, [leads, chi]);

  const contaDelGiorno = (isoGiorno: string) => contiPerGiorno.get(isoGiorno) ?? 0;

  /** Quanto pesa lo storico, detto PRIMA di entrarci. Si somma dallo stesso
   *  indice dei badge — quindi con lo stesso filtro consulente e le stesse date
   *  storte già escluse — e si ferma a oggi: «storico» qui vuol dire dall'inizio
   *  FINO A OGGI, non «tutte le date che esistono». Gli appuntamenti di domani
   *  non sono storia, sono agenda, e stanno un tocco più su. */
  const quantiStorico = useMemo(() => {
    let n = 0;
    for (const [g, quanti] of contiPerGiorno) if (g <= oggiCorrente) n += quanti;
    return n;
  }, [contiPerGiorno, oggiCorrente]);

  /** ── L'INSIEME MOSTRATO: UN GIORNO, OPPURE TUTTO LO STORICO ──────────────
   *  Da qui in giù ogni conteggio della sezione parte da questo insieme —
   *  compresi i tre totali, che quindi non possono mai contare schede fuori da
   *  ciò che si sta guardando.
   *
   *  L'ORDINE NON È LO STESSO NEI DUE CASI, ed è voluto:
   *   · SU UN GIORNO l'ordine è l'ORA CRESCENTE. Lì l'elenco si legge come si
   *     vive la giornata, dalla mattina alla sera, e l'ora basta a collocare
   *     ogni riga perché il giorno è uno solo e sta scritto qui sopra.
   *   · SU TUTTO LO STORICO l'ora da sola non colloca più niente: «10:30» può
   *     essere di stamattina o di marzo, e ordinando per ora si otterrebbe un
   *     elenco in cui tutti i «09:00» di sette mesi stanno appiccicati. Si
   *     ordina quindi per DATA E ORA INSIEME, dalla più recente all'indietro:
   *     una storia si legge partendo da ciò che è appena successo, ed è anche
   *     l'unico ordine che mette in cima le righe su cui si può ancora fare
   *     qualcosa — quelle di ieri, non quelle di marzo. All'indietro anche
   *     DENTRO la giornata: un elenco che scende nelle date e risale nelle ore
   *     fa zigzagare la lettura a ogni cambio di giorno.
   *
   *  Le letture sono difensive (`l?.data?.…`) perché questo calcolo gira al
   *  montaggio: una sola scheda malformata arrivata dall'archivio, qui dentro,
   *  non fa sparire una riga — fa sparire tutta la pagina. */
  const insieme = useMemo(() => {
    const tutti = Array.isArray(leads) ? leads : [];
    const miei = tutti.filter((l) => !chi || l?.data?.consulenteId === chi);
    if (!storico) {
      return miei
        .filter((l) => soloGiorno(l?.data?.dataMeeting) === giorno.iso)
        .sort((a, b) => (a?.data?.oraMeeting || "").localeCompare(b?.data?.oraMeeting || ""));
    }
    //  Stessa porta dei badge del calendario: una data che `giorniDaOggi` non
    //  sa leggere non è un giorno, e nell'archivio importato ce ne sono a
    //  centinaia. Se entrassero qui, si ritroverebbero in fondo all'elenco
    //  ordinate come stringhe, sotto una data che non esiste.
    const chiave = (l: Lead) =>
      `${soloGiorno(l?.data?.dataMeeting)}T${l?.data?.oraMeeting || "00:00"}`;
    return miei
      .filter((l) => {
        const g = soloGiorno(l?.data?.dataMeeting);
        if (!g || Number.isNaN(giorniDaOggi(g))) return false;
        //  Un periodo scelto a mano è uno storico più stretto: stessi ordini,
        //  stesse frasi, solo meno righe. ⚠️ Gli estremi sono COMPRESI: «dal
        //  1 al 7» senza il 7 è il modo più rapido per non fidarsi di un
        //  conteggio.
        if (periodo) return g >= periodo.da && g <= periodo.a;
        return g <= oggiCorrente;
      })
      .sort((a, b) => chiave(b).localeCompare(chiave(a)));
  }, [leads, giorno.iso, chi, storico, oggiCorrente, periodo]);

  /** I tre totali. Calcolati QUI, una volta sola e sull'insieme mostrato:
   *  erano ricontati dentro il ciclo dei pulsanti, ed è il punto in cui è
   *  facilissimo passare per sbaglio l'archivio intero e ritrovarsi i numeri
   *  di sempre sotto l'intestazione di oggi.
   *  Sullo storico contano TUTTO lo storico, anche la parte che non si disegna
   *  (vedi MAX_STORICO): un totale che seguisse il taglio delle righe direbbe
   *  «50 svolte» su sette mesi di lavoro. */
  const totali = useMemo(() => contaEsiti(insieme), [insieme]);

  //  ── IL FILTRO MOSTRA SOLO CHI FA LE CONSULENZE ─────────────────────────
  //   Questa pagina è la giornata delle consulenze: un setter o un installatore
  //   in questa barra è un pulsante che non può che dare zero, e chi lo preme
  //   pensa di aver trovato una giornata vuota invece di un filtro fuori posto.
  //   Si passa `leads` di proposito: chi ha delle schede assegnate resta nella
  //   barra anche senza spunta, altrimenti quelle schede non si potrebbero più
  //   isolare da nessuna parte. La regola e il ripiego stanno in
  //   crm/chi-fa-la-consulenza.
  //   ⚠️ `leads` è l'elenco INTERO che arriva alla pagina, non `insieme`: le
  //   assegnazioni si guardano su tutto l'archivio, o il filtro cambierebbe
  //   voci cambiando giorno.
  const { elenco: consulentiScelta, ripiego: ripiegoConsulenti } = useMemo(
    () => consulentiPerConsulenza(consulenti, { leads, anche: [chi] }),
    [consulenti, leads, chi],
  );

  //  ── LE TRE LENTI USANO LA STESSA REGOLA DEI TRE NUMERI ─────────────────
  //   Premuto un totale, l'elenco deve contenere ESATTAMENTE le schede che
  //   quel totale ha contato: stessa funzione, quindi non possono divergere.
  //   Prima la lente confrontava lo stato alla lettera, e con il nuovo criterio
  //   "Svolte" avrebbe mostrato solo i "fatto" — un numero e un elenco che non
  //   si somigliano nemmeno.
  const visti = soloEsito ? insieme.filter((l) => esitoContato(l) === soloEsito) : insieme;
  //  I "gestire in chat" NON sono appuntamenti da fare: sono trattative che
  //  vivono in chat. Restare nell'elenco delle chiamate da fare significava
  //  cercarli al telefono tutti i giorni senza motivo. (Nei totali contano fra
  //  le svolte: la trattativa si sta facendo, solo in chat.)
  const daFare = visti.filter(
    (l) => esitoDi(l) === "programmato" && l.data.stato !== "gestire_in_chat",
  );
  const fatti = visti.filter((l) => esitoDi(l) === "completato");
  const nonPresentati = visti.filter((l) => esitoDi(l) === "no_show");

  /** ── DENTRO I NON SVOLTI, L'ORDINE È L'IMMINENZA DEL GESTO ───────────────
   *  Prima gli ARANCIONI — "da riprogrammare": basta aprire il calendario e
   *  dare un giorno, e l'appuntamento torna dentro l'agenda oggi stesso.
   *  Poi i ROSSI — clienti assenti: vogliono una telefonata e una spiegazione,
   *  e quasi mai si chiudono nello stesso pomeriggio.
   *  Mescolati per orario, l'occhio partiva dalla prima riga e rimandava per
   *  ultima proprio la cosa che costava meno e rendeva di più. Dentro ciascuno
   *  dei due gruppi l'ordine di partenza resta (arriva da `insieme`: l'orario
   *  crescente su una giornata, la data più recente per prima sullo storico). */
  const daRifissare = nonPresentati.filter((l) => l.data.stato === "da_spostare");
  const assenti = nonPresentati.filter((l) => l.data.stato !== "da_spostare");
  const nonSvolti = [...daRifissare, ...assenti];

  /** Il conto alla rovescia ha senso solo sul giorno di oggi.
   *  ⚠️ E NON SULLO STORICO, nemmeno se lo si apre stando su oggi: lì dentro
   *  `giorno.o` vale ancora 0, ma le righe sono di sette mesi diversi, e
   *  «in ritardo di 214.560 min» su una consulenza di marzo è una frase falsa
   *  attaccata a venti righe per volta. */
  const attesaDelGiorno = (l: Lead) => {
    if (storico || giorno.o !== 0 || adesso === undefined) return null;
    const m = minutiDi(l.data.oraMeeting);
    return m === null ? null : attesaDi(m, adesso);
  };

  /** Su un appuntamento "da riprogrammare" di un giorno GIÀ PASSATO l'ora
   *  vecchia non serve più a niente — quell'ora non esiste — mentre serve il
   *  gesto che gli dà una data nuova. Lasciando fuori `quando`, RigaLead mette
   *  al posto della colonna l'icona del calendario. Sui giorni di oggi e a
   *  venire l'ora resta: lì l'appuntamento è ancora collocato, va solo spostato.
   *
   *  SULLO STORICO LA COLONNA DIVENTA «14/08 · 10:30». L'ora da sola bastava
   *  finché il giorno stava scritto in cima alla pagina; su tutte le date
   *  insieme un elenco di soli orari non dice più di quale mese si stia
   *  parlando, e ogni riga costringerebbe ad aprire la scheda per saperlo.
   *  Il giorno passato, lì, si legge dalla riga stessa e non dall'intestazione.
   *
   *  ⚠️ E CON L'ANNO, QUANDO NON È QUELLO IN CORSO. `giornoBreve` dà "14/08",
   *  che è la forma giusta ovunque nel CRM perché altrove si guardano sempre
   *  settimane vicine. Qui no: «tutto lo storico» è l'unico posto della pagina
   *  in cui due righe adiacenti possono essere di due anni diversi, e siccome
   *  l'elenco scende all'indietro il salto d'anno passerebbe senza che niente
   *  a schermo lo dica — "14/08" sopra "20/12" sembra solo un elenco in ordine.
   *  L'anno compare SOLO dove serve, cioè sulle righe che non sono di
   *  quest'anno: metterlo su tutte allungherebbe ogni riga per ripetere il
   *  numero che il lettore ha già in testa. */
  /** DI CHE COSA STIAMO PARLANDO, in tre parole, scritte UNA VOLTA SOLA.
   *  La stessa frase serve al criterio sotto i tre riquadri e al titolo dei
   *  riquadri stessi: sono la stessa regola detta a due lettori diversi (chi
   *  legge la pagina e chi passa il mouse o usa il lettore di schermo), e
   *  tenerne due copie a mano significa che fra un mese una delle due dirà
   *  ancora «del giorno» sopra sette mesi di conteggi. */
  const ambito = storico ? "di tutte le date fino a oggi" : "del giorno";

  const annoCorrente = oggiCorrente.slice(0, 4);
  const dataDellaRiga = (isoGiorno: string) => {
    const breve = giornoBreve(isoGiorno);
    if (!breve) return "";
    const anno = isoGiorno.slice(0, 4);
    return anno === annoCorrente ? breve : `${breve}/${anno.slice(2)}`;
  };
  const quandoDellaRiga = (l: Lead) => {
    const suo = soloGiorno(l.data.dataMeeting);
    const passato = (storico ? suo : giorno.iso) < oggiCorrente;
    if (l.data.stato === "da_spostare" && passato) {
      //  ⚠️ SULLO STORICO SI BUTTA L'ORA, NON IL GIORNO — e la differenza si
      //  vedeva a schermo. Su una giornata togliere tutto è giusto: la data
      //  sta scritta in cima alla pagina, quindi al posto della colonna resta
      //  solo il calendario (vedi RigaLead) e non si perde niente. Sullo
      //  storico l'intestazione non dice più nessuna data, e i «da
      //  riprogrammare» stanno APERTI IN CIMA ai non svolti: l'elenco si
      //  apriva con una colonna di righe senza data, in mezzo a righe
      //  ordinate per data, e non c'era modo di sapere se fossero di ieri o
      //  di marzo se non aprendo la scheda una per una.
      //  Il giorno resta perché COLLOCA la riga; l'ora se ne va perché
      //  quell'ora non esiste più — è lo slot saltato. Che l'appuntamento non
      //  sia in piedi lo dice la pastiglia di stato accanto al nome, e la
      //  data nuova si mette aprendo la scheda dal nome, come per ogni altra
      //  riga dello storico.
      return storico ? dataDellaRiga(suo) || undefined : undefined;
    }
    if (!storico) return l.data.oraMeeting;
    const quando = dataDellaRiga(suo);
    return l.data.oraMeeting ? `${quando} · ${l.data.oraMeeting}` : quando;
  };

  //  Il conto alla rovescia si mette solo su ciò che deve ancora succedere: su
  //  un appuntamento già fatto direbbe "in ritardo di tre ore", che è falso.
  const riga = (l: Lead, senzaAttesa?: boolean) => (
    <RigaLead
      key={l.id}
      lead={l}
      onApri={onApri}
      onEvidenzia={onEvidenzia}
      onStato={onStato}
      nomeConsulente={nomeConsulente}
      quando={quandoDellaRiga(l)}
      attesa={senzaAttesa ? null : attesaDelGiorno(l)}
    />
  );

  /** ── L'ELENCO DI UN GRUPPO, TAGLIATO AD ALTA VOCE ────────────────────────
   *  Su una giornata non taglia niente (dieci righe non hanno bisogno di
   *  limiti). Sullo storico si ferma a MAX_STORICO e lo DICE, con il totale
   *  vero accanto: il conteggio nella testata della sezione e il numero dei
   *  tre riquadri restano quelli di tutte le righe, non di quelle disegnate. */
  const elencoDi = (gruppi: Lead[][], senzaAttesa?: boolean) => {
    //  ⚠️ SI TAGLIA PRIMA DI INCOLLARE, E NON DOPO. Quasi tutte le sezioni
    //  passano un elenco solo, ma i NON SVOLTI ne passano due incollati —
    //  prima gli arancioni da rifissare, poi i rossi dei clienti assenti (vedi
    //  l'ordine più su). Tagliando la somma, un archivio con sessanta
    //  «da riprogrammare» riempiva il limite con quelli soli e i clienti
    //  assenti non arrivavano MAI a schermo, pur essendo contati nel numero
    //  della testata: un elenco che nega il proprio conteggio. Peggio, la riga
    //  qui sotto avrebbe continuato a chiamarli «i più recenti», mentre i più
    //  recenti dell'altro gruppo erano proprio quelli rimasti fuori.
    //  Tagliando prima, ogni gruppo porta a schermo le sue righe più recenti e
    //  la frase torna a essere vera.
    const mostrate = gruppi.flatMap((g) => (storico ? g.slice(0, MAX_STORICO) : g));
    const totale = gruppi.reduce((n, g) => n + g.length, 0);
    return (
      <>
        <Elenco>{mostrate.map((l) => riga(l, senzaAttesa))}</Elenco>
        {totale > mostrate.length && (
          <p className="px-3 py-2 text-[11.5px] text-muted-foreground">
            {/*  Si dichiara QUANTE se ne vedono davvero, non il limite: con due
                gruppi tagliati le righe a schermo sono più del limite, e un
                numero che non torna con le righe che si contano sotto è
                esattamente ciò che questa frase serve a evitare. */}
            Mostrate le più recenti — {mostrate.length} righe di {totale}: i numeri qui sopra li
            contano tutti, l'elenco si ferma per non dover disegnare mezzo archivio a ogni esito
            segnato. Per lavorarci sopra c'è l'elenco trattative, che è fatto per gli elenchi
            lunghi.
          </p>
        )}
      </>
    );
  };

  return (
    <div className="space-y-3">
      {/* ── I GIORNI ───────────────────────────────────────────────────────
          Una barra sola: dice il giorno che si sta guardando e quanto pesa, e
          apre il mese intero quando serve scegliere. Ha preso il posto di due
          blocchi — la fila di nove pastiglie sempre aperta e il banner della
          giornata — che dicevano la stessa cosa in due punti diversi.

          IL CRITERIO DELLE SOGLIE DEL BADGE (caricoGiornata, crm/ui — qui si
          usa, lì si decide). Il centro lavora intorno alle dieci consulenze al
          giorno; una consulenza occupa circa 45 minuti fra incontro, preventivo
          e note, e ogni giorno se ne aggiungono due o tre di recupero. Da lì i
          tre scalini: fino a 6 VERDE (c'è margine), da 7 a 11 ARANCIONE
          (giornata piena, non è un allarme), da 12 ROSSO (si sfora, e va saputo
          la mattina quando si può ancora spostare qualcuno).
          Il colore INFORMA e basta: la frase che commentava la giornata è stata
          tolta apposta — cosa farne lo decide chi la lavora. */}
      <StrisciaGiorni
        giorno={giorno}
        oggi={oggiCorrente}
        conta={contaDelGiorno}
        onScegli={cambiaGiorno}
        storico={storico}
        periodo={periodo}
        onPeriodo={setPeriodo}
        onStorico={(acceso) => {
          //  Uscire dallo storico riporta a OGGI e non al giorno da cui si era
          //  entrati: si entra quasi sempre da oggi, e nei rari altri casi
          //  «torna a oggi» è comunque la destinazione che il tasto promette.
          //  ⚠️ `cambiaGiorno(0)` non basta da solo — se si era già su oggi lo
          //  scarto non cambia, la regola qui sopra non scatta e si resterebbe
          //  dentro lo storico premendo il tasto per uscirne.
          if (!acceso) cambiaGiorno(0);
          cambiaStorico(acceso);
        }}
        quantiStorico={quantiStorico}
      />

      {/* ── FILTRO CONSULENTE ──────────────────────────────────────────────
          Mostrato qui solo quando la dashboard non lo gestisce già in alto:
          due filtri uguali sulla stessa pagina sono due filtri da tenere
          d'accordo a mano.
          ⚠️ La soglia si guarda sull'elenco FILTRATO e non sull'anagrafica: con
          dieci persone di cui una sola fa consulenze, il filtro avrebbe mostrato
          un pulsante «Tutti» e un pulsante solo — due modi di dire la stessa
          cosa, cioè rumore. */}
      {consulentiScelta.length > 1 && consulenteId === undefined && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Segmento attivo={!chi} onClick={() => cambiaChi("")}>
              Tutti
            </Segmento>
            {consulentiScelta.map((c) => (
              <Segmento
                key={c.id}
                attivo={chi === c.id}
                onClick={() => cambiaChi(chi === c.id ? "" : c.id)}
              >
                {c.data.nome}
              </Segmento>
            ))}
          </div>
          {/*  Il ripiego si dice qui e non da nessun'altra parte: senza questa
              riga la barra piena di nomi sembrerebbe la barra corretta, e
              nessuno andrebbe mai ad accendere la spunta che la corregge. */}
          <NotaSoloConsulenti ripiego={ripiegoConsulenti} />
        </div>
      )}

      {/* ── ESITI DEL GIORNO MOSTRATO ─────────────────────────────────────
          Cliccabili: il numero da solo non serve, serve arrivare alle schede
          che ci stanno dietro. Premuto di nuovo, toglie il filtro.
          Sopra c'è scritto DI CHE GIORNO sono: erano tre numeri sospesi in
          mezzo alla pagina e si leggevano come i totali di sempre. */}
      <div className="space-y-1.5">
        {/*  ⚠️ QUI SI DICE DI CHE COSA SONO I TRE NUMERI, e sullo storico la
            frase cambia davvero: «Esiti di oggi» sopra sette mesi di conteggi
            è la bugia più costosa della pagina — sono i numeri che finiscono
            nei riepiloghi, e nessuno ricontrolla un totale che ha già una data
            scritta sopra. */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {/*  ⚠️ L'AMBITO VA DETTO PER INTERO: sono i numeri che finiscono nei
               riepiloghi, e nessuno ricontrolla un totale che ha già una data
               scritta sopra. Con un periodo acceso, «tutto lo storico» sarebbe
               la stessa bugia di «Esiti di oggi» su sette mesi. */}
          Esiti{" "}
          {periodo
            ? `dal ${dataBreve(periodo.da)} al ${dataBreve(periodo.a)}`
            : storico
              ? "di tutto lo storico"
              : giorno.o === 0
                ? "di oggi"
                : `di ${giorno.esteso}`}
        </p>
        {/*  Qui si cicla su LENTI_ESITO e non su ESITI: le caselle da LEGGERE
            restano tre — svolte, assenti, da riprogrammare — mentre i pulsanti
            da PREMERE sono scesi a due. "Svolte" non è più un tasto, ma è
            rimasto il numero che si guarda per primo. */}
        <div className="grid grid-cols-3 gap-2">
          {LENTI_ESITO.map((e) => {
            const n = totali[e.stato];
            const attivo = soloEsito === e.stato;
            return (
              <button
                key={e.stato}
                type="button"
                onClick={() => setSoloEsito(attivo ? null : e.stato)}
                //  La frase per esteso dice CHE COSA ha contato il numero: due
                //  parole e una cifra non bastano a spiegare un totale che
                //  qualcuno verrà a ricontrollare.
                title={`${n} · ${ETICHETTA_TOTALE[e.stato]} — ${SPIEGAZIONE_TOTALE[e.stato](ambito)}. ${
                  attivo ? "Premi per mostrare di nuovo tutti." : "Premi per vedere solo queste."
                }`}
                aria-label={`${n} ${ETICHETTA_TOTALE[e.stato]}: ${SPIEGAZIONE_TOTALE[e.stato](ambito)}`}
                aria-pressed={attivo}
                /*  ── ACCESO SI VEDE, NON SI LEGGE ──────────────────────────
                    Il filtro attivo si segnava con `ring-2 ring-foreground/25`:
                    un anello grigio al 25% intorno a un riquadro che restava
                    IDENTICO agli altri due. A quel punto l'unico modo di sapere
                    quale lente fosse accesa era leggere la riga «Filtro attivo»
                    qui sotto — cioè leggere, che è la cosa da togliere.
                    Adesso il riquadro acceso prende la sua tinta piena (gli
                    stessi due colori dei pulsanti d'esito: `acceso`/`spento`
                    stanno in crm/ui e sono già quelli) e porta la spunta.
                    Colore E forma: chi non distingue il rosso dall'ambra vede
                    comunque la spunta, chi guarda di sfuggita vede la macchia. */
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition",
                  attivo ? e.acceso : e.spento,
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[19px] font-semibold leading-none tabular-nums">{n}</span>
                  {/*  La spunta sta in alto a destra e compare solo da accesa:
                      qui, a differenza dei pulsanti d'esito, il riquadro ha
                      larghezza fissa (tre colonne), quindi non c'è niente che
                      possa spostarsi. */}
                  {attivo && <Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />}
                </div>
                {/*  ⚠️ `break-words` NON È DECORAZIONE, È IL DIFETTO VERO.
                    L'etichetta doveva andare a capo invece di essere tagliata,
                    ma a capo ci va solo FRA le parole: "RIPROGRAMMARE" è una
                    parola sola e su un telefono da 360px la colonna ne è larga
                    circa ottanta pixel contro i cento che le servono. Non
                    potendo spezzarsi usciva dal riquadro e finiva sopra quello
                    accanto — il testo «sovrapposto» che si vedeva. Con
                    `break-words` la parola si spezza e resta dentro casa sua.
                    Il colore non c'entrava niente: cambiarlo l'avrebbe soltanto
                    reso meno evidente. */}
                <div className="mt-1 break-words text-[11px] font-medium uppercase leading-tight tracking-wide opacity-80">
                  {ETICHETTA_TOTALE[e.stato]}
                </div>
              </button>
            );
          })}
        </div>
        {/*  IL CRITERIO, SCRITTO DOVE STA IL NUMERO. È il totale che viene
            ricontrollato a mano più spesso, e finché la regola stava solo nel
            codice ogni verifica finiva in una domanda. Una riga sola, sotto i
            riquadri: si legge quando serve e non ruba spazio all'agenda. */}
        {insieme.length > 0 && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            «Svolte» conta tutti gli appuntamenti {ambito} tranne i clienti assenti e quelli da
            riprogrammare. Gli appuntamenti ancora da fare non sono in nessuno dei tre.
          </p>
        )}
      </div>

      {soloEsito && (
        <button
          type="button"
          onClick={() => setSoloEsito(null)}
          className="text-[12px] font-medium text-primary hover:underline"
        >
          Filtro attivo — mostra tutti gli appuntamenti {storico ? "dello storico" : "del giorno"}
        </button>
      )}

      {/*  ⚠️ IL TITOLO DI QUESTO GRUPPO CAMBIA, e non è un vezzo. «Da fare»
          vuol dire «oggi, più tardi»: appiccicato a un appuntamento di marzo
          rimasto senza esito diventa un ordine di lavoro falso — quella
          consulenza non si farà più, semmai si segna com'è andata o si
          richiama il cliente. Sullo storico il gruppo si chiama per quello che
          è davvero: appuntamenti a cui non è mai stato segnato un esito. */}
      <Sezione
        titolo={storico ? "Rimasti senza esito" : "Da fare"}
        icona={Clock}
        tinta="text-sky-600"
        conteggio={daFare.length}
        nota={
          storico && daFare.length > 0
            ? "Appuntamenti fino a oggi a cui non è mai stato segnato com'è andata. Quelli di oggi possono semplicemente non essere ancora avvenuti; gli altri sono lavoro rimasto indietro."
            : undefined
        }
      >
        {daFare.length === 0 ? (
          <VuotoRiga
            testo={
              storico
                ? "Nessun appuntamento è rimasto senza esito."
                : "Nessun appuntamento in programma per questo giorno."
            }
          />
        ) : (
          elencoDi([daFare])
        )}
      </Sezione>

      <Sezione
        titolo="Svolti"
        icona={Check}
        tinta="text-emerald-600"
        conteggio={fatti.length}
        /*  Il riquadro "Svolte" qui sopra e questo elenco sono LO STESSO
            INSIEME: entrambi contano tutto ciò che non è cliente assente né da
            riprogrammare (vedi esitoContato). Prima il totale contava solo lo
            stato "fatto" e l'elenco anche le trattative già andate avanti, e i
            due numeri non coincidevano quasi mai.
            La riga di spiegazione che stava qui — «tot con l'esito segnato, tot
            già andate avanti» — è sparita insieme allo stato "fatto": non c'è
            più un tasto da premere, quindi non c'è più una differenza da
            giustificare. Il criterio è scritto sotto i tre riquadri. */
        nota={
          fatti.length > 0
            ? `Tutti gli appuntamenti ${storico ? "fino a oggi" : "del giorno"} che non sono clienti assenti né da riprogrammare.`
            : undefined
        }
      >
        {fatti.length === 0 ? (
          <VuotoRiga
            testo={
              //  «Ancora» racconta una giornata che deve finire: su tutto lo
              //  storico non c'è nessun "ancora" — o ce ne sono, o non ce n'è
              //  mai stata una.
              storico
                ? "Nessuna consulenza svolta in archivio."
                : "Ancora nessuna consulenza conclusa."
            }
          />
        ) : (
          elencoDi([fatti], true)
        )}
      </Sezione>

      {/*  "Non svolti" e non "Non presentati": qui dentro finiscono i clienti
          assenti, le consulenze non svolte per altri motivi e gli appuntamenti
          da riprogrammare. Sono due lavori opposti e il colore li separa —
          ARANCIONE = basta rifissarlo, ROSSO = è mancato — perché su venti
          righe la pastiglia di stato si legge una alla volta, la tinta tutta
          insieme. Anche la testata segue quello che c'è dentro: se restano solo
          appuntamenti da rifissare non è un elenco di perdite ma lavoro di
          calendario, e il rosso lo farebbe leggere come una sconfitta. */}
      <Sezione
        titolo="Non svolti"
        icona={assenti.length ? PhoneOff : CalendarPlus}
        tinta={assenti.length ? "text-rose-600" : "text-amber-600"}
        conteggio={nonSvolti.length}
        nota={
          nonSvolti.length === 0
            ? undefined
            : daRifissare.length && assenti.length
              ? `${daRifissare.length} da rifissare — righe arancioni, manca solo una data — e ${assenti.length} ${assenti.length === 1 ? "cliente assente" : "clienti assenti"}, righe rosse, da recuperare al telefono.`
              : daRifissare.length
                ? "Righe arancioni: non sono perse, manca solo una data nuova."
                : "Righe rosse: il cliente non c'era. Si recuperano con una telefonata, non con il calendario."
        }
      >
        {nonSvolti.length === 0 ? (
          <VuotoRiga testo="Nessuno è mancato e non c'è niente da rifissare." />
        ) : (
          //  I due sottogruppi restano DUE anche qui, e non si passa
          //  `nonSvolti` già incollato: il limite dello storico va applicato a
          //  ciascuno, altrimenti gli arancioni si mangiano il posto dei rossi
          //  (vedi elencoDi). L'ordine a schermo è lo stesso di prima.
          elencoDi([daRifissare, assenti], true)
        )}
      </Sezione>
    </div>
  );
}
