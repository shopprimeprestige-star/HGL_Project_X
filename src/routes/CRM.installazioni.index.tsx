/** ── INSTALLAZIONI ─────────────────────────────────────────────────────────
 *
 *  LA SALA DI CONTROLLO DELLE POSE
 *  Da qui si risponde, senza aprire niente, alle sole domande che si fanno
 *  davvero ogni mattina: cosa si installa oggi, cosa è rimasto indietro, quanto
 *  c'è da incassare, chi ha pagato e sta ancora aspettando una data.
 *
 *  UNA BANDA SOLA SOPRA L'ELENCO
 *  Prima, fra il titolo e la prima posa, c'erano TRE bande: due file di filtri e
 *  sei riquadri di numeri. E i sei riquadri ripetevano per numero ciò che i
 *  filtri dicevano per parola — "Oggi 0" era sia un filtro sia un riquadro, con
 *  lo stesso numero, a dieci centimetri di distanza. Adesso la banda è UNA: i
 *  filtri, con il conteggio dentro la pastiglia. Il totale da incassare, che
 *  era l'unico numero dei sei che non fosse già un filtro, sta nella riga sotto
 *  il titolo.
 *
 *  LA RIGA RISPONDE A QUATTRO DOMANDE, IN QUEST'ORDINE
 *  CHI · QUANDO · QUANTO RESTA · COSA MANCA. Gli avvisi ("orario da definire",
 *  "tecnico da assegnare") erano pastiglie grandi come i pulsanti e mescolate a
 *  cinque comandi: avviso e comando dello stesso peso obbligano a leggere tutto
 *  per capire cosa si può premere. Adesso ogni cosa che manca è AMBRA DOVE SI
 *  LEGGE — l'orario nel "quando", il tecnico al posto del nome, l'importo nella
 *  sua scatola — e sotto resta un solo segno con il punto ambra, per lo stato
 *  del materiale, che nella riga non ha un posto suo. I comandi visibili sono
 *  DUE — il principale e il telefono — con il resto dietro "…".
 *
 *  L'IMPORTO SI PREME, ED È SEMPRE LA STESSA SCATOLA
 *  Nella scatola stanno TRE numeri, nell'ordine in cui si raccontano a voce:
 *  GIÀ VERSATO · TOTALE · RESTA. L'ultimo è il più grande e l'unico colorato —
 *  è quello che il tecnico deve avere in testa uscendo.
 *  Un tocco sulla scatola apre la finestra che chiede quanto è stato incassato
 *  (proposto il saldo aperto, correggibile), con IVA o senza, e se la pratica è
 *  conclusa. Confermando: incasso registrato, pratica completata, spostata fra
 *  le Completate.
 *  Quando il prezzo non è ancora in scheda i tre numeri NON compaiono — tre
 *  zeri si leggerebbero come "già pagato" — e al loro posto c'è l'avviso
 *  "Importo da definire", che è anche il rimedio: si preme e si scrive la cifra.
 *  La scatola ha sempre la stessa forma e la stessa larghezza: cambia solo il
 *  colore — ambra resta qualcosa da fare (da incassare, o il prezzo che manca),
 *  emerald incassato.
 *
 *  COME ARRIVA AL CLIENTE: TRE MODI, TRE LENTI
 *  Un impianto si posa NEL NOSTRO CENTRO, si posa A DOMICILIO o SI SPEDISCE, e
 *  ognuno dei tre ha la sua lente nella banda — nello stesso ordine in cui li
 *  nomina crm/spedizione.ts, che è il file che decide chi è cosa. I due modi
 *  che non sono la sede hanno anche la loro scheda, con l'indirizzo che si
 *  scrive sulla riga (e, sul domicilio, il costo del viaggio); «Nel nostro
 *  centro» invece usa l'elenco normale, perché una posa in centro ha esattamente
 *  i dati di tutte le altre — giorno, ora, tecnico — e una scheda a parte
 *  avrebbe solo raccontato le stesse righe in un secondo modo.
 *  ⚠️ La differenza che conta non è grafica: le SPEDIZIONI non compaiono fra le
 *  pose né nei conteggi del giorno — non occupano un tecnico e non hanno un
 *  orario. Le pose A DOMICILIO invece ci restano tutte: occupano un tecnico per
 *  delle ore e hanno un'ora, quindi contano come una posa in sede.
 *
 *  TRE LENTI SULLO STESSO INSIEME: TUTTE · IN LAVORAZIONE · COMPLETATE
 *  «In lavorazione» è la coda del lavoro, «Completate» è l'archivio delle pose
 *  chiuse, e «Tutte» è la somma esatta delle due — il totale delle pose di cui
 *  ci si occupa. Il totale prima non lo diceva nessuna lente: quella che si
 *  chiamava «Tutte» mostrava solo il da fare, quindi chi voleva sapere quante
 *  installazioni ci sono IN TUTTO non lo poteva leggere da nessuna parte, e il
 *  nome prometteva l'opposto di quello che faceva. Adesso ognuna delle tre
 *  parole dice quello che sembra dire.
 *  Le pose chiuse restano visibili anche nelle lenti del CALENDARIO (oggi,
 *  domani, una data): la giornata deve mostrarsi com'è andata davvero.
 *  ⚠️ «Tutte» vuol dire tutte le POSE, non tutti i lead. I pacchi restano
 *  fuori (hanno la loro scheda, non occupano né tecnico né orario) e le
 *  pratiche che non sono mai diventate una posa non entrano affatto: il perché
 *  per esteso sta su `case "tutte"` in passaFiltro.
 *
 *  L'ORDINE È QUELLO DELL'ATTESA: DALLA PIÙ VECCHIA ALLA PIÙ RECENTE
 *  Le giornate con del lavoro aperto scorrono in ordine di calendario — le
 *  passate non chiuse, poi oggi, poi quelle in arrivo — perché è così che si
 *  legge una coda: quello che aspetta da più tempo sta in cima. Sotto ci sono
 *  le pose SENZA DATA, e in fondo l'archivio delle giornate chiuse.
 *  ⚠️ Questa pagina NON usa più `ordinaGruppi` (l'ordine dell'imminenza, che
 *  teneva oggi inchiodato in cima e faceva scendere il passato dal più
 *  recente): usa `ordinaGiornate` di crm/priorita.ts, dove le due regole tolte
 *  sono scritte per esteso insieme a quello che si perde a toglierle. La
 *  giornata dell'installatore continua a usare l'ordine di prima, ed è giusto:
 *  là si guarda un giorno solo.
 *
 *  IL SENZA DATA STA IN FONDO, E LA VIA D'USCITA È «ANTICIPA»
 *  Chi non ha ancora un giorno non partecipa a un ordine per data: la sua
 *  attesa si misura con un altro orologio (da quando ha pagato), e non è
 *  confrontabile con un appuntamento. Metterlo in cima — oggi sono dieci su
 *  quattordici — avrebbe sepolto sotto una schermata intera le quattro pose che
 *  un giorno ce l'hanno, cioè le uniche che qualcuno deve andare a fare. Chi le
 *  cerca ha la lente «Senza data» a un clic, con il suo conteggio.
 *  Quando però una di quelle non può aspettare, il rimedio non è l'ordine: è
 *  «Anticipa», che la porta in cima a tutto e lo dice sulla riga. Vedi
 *  crm/priorita.ts e crm/PrioritaPosa.tsx.
 *
 *  ⚠️ IL GIORNO CHE VUOLE IL CLIENTE NON È IL GIORNO DELLA POSA
 *  Il primo è un desiderio detto al telefono e non impegna nessuno; il secondo
 *  è un appuntamento con una persona e occupa un'agenda. Per questo sulla riga
 *  si legge sempre «vorrebbe il 20 gen», con il verbo, e la posa si continua a
 *  fissare solo da «Programma».
 *
 *  IL NUMERO GIUSTO È IL SALDO
 *  Quello che il tecnico ritira è ciò che RESTA da incassare: quanto è già in
 *  cassa lo è da settimane e il giorno della posa non serve a nessuno. In queste
 *  pagine si scrive "importo da incassare in attesa", mai "acconti".
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCRM } from "@/crm/CRMContext";
import { LeadDialog } from "@/crm/LeadDialog";
import { DomicilioPannello, SpedizioniPannello } from "@/crm/SpedizioniPannello";
//  L'icona «torna allo stato di prima»: la stessa della pagina Oggi, con la
//  conferma sui soldi che serve solo qui. Vedi crm/TornaIndietroPosa.
import { TornaIndietroPosa } from "@/crm/TornaIndietroPosa";
//  Il pulsante con dentro la miniatura delle foto del cliente: apre il
//  carosello (e, quando non c'è ancora niente, invita a caricare). Vedi
//  crm/portfolio/Visore.
import { SegnoMedia } from "@/crm/portfolio/Visore";
import {
  AzioniInstallazione,
  BadgeOggi,
  ImportoRiga,
  InstallationScheduleDialog,
  SegnoAccompagnatore,
  SegnoDriver,
  SegnoNote,
  aspettaUnaData,
  avvisoMateriale,
  conDriver,
  giaIncassato,
  giorniDiAttesa,
  giorniScelti,
  giornoISO,
  nomeCompleto,
  nomeAccompagnatore,
  nomeDriver,
  nomeTecnico,
  posaCompletata,
  raggruppaPerGiorno,
  rigaSoldi,
  saldoAllaConsegna,
  senzaTecnico,
  totaleDaIncassare,
  totaleIncassato,
} from "@/crm/InstallationScheduleDialog";
import {
  aDomicilio,
  daSpedire,
  haIndirizzo,
  inNostroCentro,
  soloPose,
  spedita,
} from "@/crm/spedizione";
//  ── LA POSA CHE NON ASPETTA IL SUO TURNO ──────────────────────────────────
//   L'ordine delle giornate e la priorità stanno nello stesso file perché sono
//   la stessa cosa vista da due lati: la regola, e l'unico modo di scavalcarla.
import { personePerInstallazioni } from "@/crm/chi-fa-le-installazioni";
//  Quanto ha speso in tutto quel cliente: il numero e la finestra che lo apre.
import { SpesaTotale } from "@/crm/SpesaCliente";
//  ── LE FINESTRE DEGLI STATI, LE STESSE DEL RESTO DEL CRM ─────────────────
//   Da questa pagina si può cambiare lo stato del cliente (menu «…» della
//   riga), e cambiare stato NON è scrivere una parola: le tre chiusure vinte
//   vogliono importi e modo di consegna, gli appuntamenti vogliono un giorno.
//   Si montano le finestre che quei dati li chiedono già, invece di scrivere
//   secco da qui — che è il guasto che ChiusuraDialog esiste per evitare.
import { useChiusura } from "@/crm/ChiusuraDialog";
import { QuickStatusDialog, requiresAnyDialog } from "@/crm/QuickStatusDialog";
import { confrontaAnticipate, inCimaAllElenco, ordinaGiornate } from "@/crm/priorita";
import { SegnoPriorita, TastoPriorita } from "@/crm/PrioritaPosa";
//  Il riepilogo di consegna: si stampa o si salva in PDF (crm/ricevuta).
import { TastoRicevuta } from "@/crm/ricevuta";
//  La fattura: bozza o emissione, dalla riga (crm/fatture).
import { TastoFattura } from "@/crm/fatture/TastoFattura";
import { FinestraCsvInstallazioni, TastoScaricaCsv } from "@/crm/FinestraCsvInstallazioni";
//  ── IL RITORNO DEL CLIENTE ────────────────────────────────────────────────
//   La manutenzione non è una posa e non ha una pagina sua: è un'altra LENTE
//   sulle stesse persone, e vive qui perché qui si arriva quando si finisce una
//   posa. Le regole (ogni quanto, a che punto è) stanno in crm/manutenzione/.
import {
  BottoneManutenzione,
  PannelloManutenzioni,
  quanteDaSeguire,
} from "@/crm/manutenzione/PannelloManutenzioni";
import { ManutenzioneDialog } from "@/crm/manutenzione/ManutenzioneDialog";
import { NuovaPosaDialog } from "@/crm/NuovaPosaDialog";
import { formatDate } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LEAD_STATUS_LABEL,
  eChiusuraVinta,
  fasePer,
  type Consultant,
  type Lead,
  type LeadStatus,
} from "@/crm/types";
import {
  BarraAzioni,
  Chip,
  Pagina,
  Scheda,
  Segmento,
  Titolo,
  Vuoto,
  eur,
  giorniDaOggi,
  normalizza,
  soloCifre,
  trovaNelLead,
} from "@/crm/ui";
import {
  AlertTriangle,
  ArrowUpToLine,
  Banknote,
  CalendarClock,
  FileSpreadsheet,
  CalendarPlus,
  Car,
  CheckCircle2,
  ClipboardList,
  House,
  Repeat,
  SlidersHorizontal,
  Store,
  UserPlus,
  Truck,
  Wrench,
  Search,
  X,
} from "lucide-react";
import { Finestra } from "@/crm/ui/Finestra";
import { BadgeDaFatturare } from "@/crm/fatture/BadgeDaFatturare";

export const Route = createFileRoute("/CRM/installazioni/")({
  component: InstallazioniPage,
});

/* ═══════════════════════════════════════════════════════════════════════════
   1. LE LENTI — un filtro alla volta, sempre sullo stesso insieme
   ═════════════════════════════════════════════════════════════════════════ */

/** Le lenti sono volutamente ESCLUSIVE: comporre "oggi + da saldare + tecnico
 *  Marco" sembra potente e in pratica lascia filtri accesi che nessuno ricorda
 *  di aver messo, e una lista vuota che sembra un guasto. Il filtro del tecnico
 *  resta a parte perché è l'unica combinazione che si usa davvero (una persona
 *  guarda le proprie pose).
 *
 *  "da_spedire" e "a_domicilio" sono lenti come le altre — stessa banda, stesso
 *  conteggio — ma mostrano un elenco di forma diversa, perché lì il dato che
 *  manca quasi sempre è l'indirizzo (e sul domicilio anche il costo del
 *  viaggio). "in_sede" è la terza di quella famiglia e resta invece sull'elenco
 *  normale: le pose in centro hanno gli stessi dati di tutte le altre.
 *
 *  "con_driver" non è un modo di consegna: è la domanda «quel giorno escono in
 *  due?». Sta nella stessa banda perché si guarda insieme alle altre — chi
 *  prepara la settimana deve poter vedere in un colpo solo tutte le pose che
 *  impegnano due persone, visto che ognuna di quelle blocca anche l'agenda del
 *  driver per tre ore prima e tre dopo.
 *
 *  "tutte" · "in_lavorazione" · "completate" SONO UNA FAMIGLIA: la prima è
 *  l'insieme intero, le altre due lo tagliano in due metà che non si
 *  sovrappongono e non lasciano fuori niente. Tenere il nome "tutte" su ciò che
 *  è soltanto il da fare era la trappola di prima — il conteggio accanto alla
 *  parola «Tutte» era vero per la lente e falso per la parola. */
/** ── COME SI CHIAMA OGNI LENTE, PER ESTESO ────────────────────────────────
 *  Serve al telefono: là i filtri stanno chiusi in un foglio, e sotto il
 *  pulsante va scritto QUALE è acceso — altrimenti si guarda un elenco
 *  incompleto senza sapere perché. Sul monitor non serve, perché la pastiglia
 *  accesa si vede.
 *  ⚠️ Le chiavi sono quelle di `Filtro`: il compilatore obbliga a mettere
 *   l'etichetta il giorno che se ne aggiunge una, invece di lasciare a schermo
 *   il nome tecnico con la lineetta bassa. */
export const NOME_LENTE: Record<Filtro, string> = {
  oggi: "Oggi",
  domani: "Domani",
  settimana: "Questa settimana",
  ritardo: "In ritardo",
  da_saldare: "Da saldare",
  senza_data: "Senza data",
  tutte: "Tutte",
  in_lavorazione: "In lavorazione",
  completate: "Eseguite",
  in_sede: "Nel nostro centro",
  da_spedire: "Da spedire",
  a_domicilio: "A domicilio",
  con_driver: "Con driver",
  manutenzioni: "Manutenzioni",
  data: "Una data",
};

export type Filtro =
  | "oggi"
  | "domani"
  | "settimana"
  | "ritardo"
  | "da_saldare"
  | "senza_data"
  | "tutte"
  | "in_lavorazione"
  | "completate"
  | "in_sede"
  | "da_spedire"
  | "a_domicilio"
  | "con_driver"
  /*  ── LA MANUTENZIONE È UNA LENTE, NON UNA PAGINA ────────────────────────
   *   Guarda le stesse persone di questa pagina da un'altra distanza: non «che
   *   cosa si posa», ma «chi deve tornare». Sta nella stessa banda perché è la
   *   domanda che ci si fa subito dopo aver chiuso una posa, e una pagina a
   *   parte l'avrebbe messa a due clic — cioè non l'avrebbe aperta nessuno.
   *   ⚠️ Come "da_spedire" e "a_domicilio" NON usa l'elenco delle pose: ha una
   *   scheda sua, perché una manutenzione non ha orario di posa, tecnico né
   *   importo da ritirare, e mostrarla nella riga di una posa avrebbe voluto
   *   dire tre colonne vuote su ogni riga. */
  | "manutenzioni"
  | "data";

/** ── LA LENTE SCRITTA NELL'INDIRIZZO ──────────────────────────────────────
 *  Il menu ha quattro voci che puntano a questa pagina con una lente già scelta
 *  (?lente=in-sede, ?lente=da-spedire, ?lente=a-domicilio, ?lente=con-driver).
 *  Il nome nell'indirizzo si scrive col trattino perché è quello che si legge
 *  nella barra del browser; dentro al codice resta il valore del filtro.
 *  ⚠️ Questi nomi sono un CONTRATTO con crm/CRMSidebar.tsx: cambiarne uno
 *  qui senza cambiarlo là non dà nessun errore, apre semplicemente la pagina
 *  sulla giornata — e la voce di menu si accende su una lente che non è quella
 *  che si sta guardando. */
function lenteDellIndirizzo(query: string): Filtro | null {
  const q = new URLSearchParams(query || "").get("lente");
  if (q === "in-sede") return "in_sede";
  if (q === "da-spedire") return "da_spedire";
  if (q === "a-domicilio") return "a_domicilio";
  //  La voce «Con driver» del menu arriva da qui. Senza questa riga il link non
  //  darebbe nessun errore: aprirebbe «Oggi» — cioè una voce che sembra
  //  funzionare e porta altrove, il guasto più difficile da vedere.
  if (q === "con-driver") return "con_driver";
  //  La voce «Da programmare» del menu arriva qui: sono gli impianti pagati che
  //  aspettano una data, cioè esattamente questa lente. Senza questa riga il
  //  link non darebbe errore — aprirebbe «Oggi», che è il modo più silenzioso
  //  di far fallire una voce di menu.
  if (q === "senza-data") return "senza_data";
  //  La lente delle manutenzioni si apre anche dall'indirizzo. Senza questa
  //  riga `?lente=manutenzioni` non dava errore: apriva «Oggi», cioè un link
  //  che sembra funzionare e porta altrove — il guasto più difficile da vedere.
  if (q === "manutenzioni") return "manutenzioni";
  return null;
}

/** ── "QUESTA SETTIMANA" VUOL DIRE UNA COSA SOLA ───────────────────────────
 *  Questa pagina aveva un suo calcolo (da oggi a domenica) e la giornata del
 *  tecnico ne aveva un altro (i prossimi sette giorni): di venerdì le due
 *  pagine mostravano due numeri diversi sotto la stessa parola. Adesso il
 *  periodo lo decide una funzione sola — giorniScelti() — e vale per tutto il
 *  ramo delle installazioni.
 *
 *  Il periodo si ricalcola una volta al giorno, non una volta per riga:
 *  passaFiltro() gira su tutte le pratiche per ognuna delle lenti, e rifare
 *  l'elenco dei sette giorni ogni volta significava qualche migliaio di stringhe
 *  buttate via a ogni battito della pagina. */
let settimanaInCache: { calcolataIl: string; giorni: Set<string> } | null = null;
function giorniDellaSettimana(): Set<string> {
  const oggi = giornoISO();
  if (settimanaInCache?.calcolataIl !== oggi) {
    settimanaInCache = { calcolataIl: oggi, giorni: new Set(giorniScelti("settimana", "") ?? []) };
  }
  return settimanaInCache.giorni;
}

/*  ── «NEL NOSTRO CENTRO» SI DECIDE IN crm/spedizione.ts ────────────────────
 *   `inNostroCentro` stava qui, ed è il terzo dei tre modi di consegna: adesso
 *   sta accanto agli altri due (`aDomicilio`, `daSpedire`) nel file che decide
 *   chi è cosa. Il motivo non è l'ordine: da qui non lo poteva leggere nessuno,
 *   e il badge «Nel nostro centro» del menu avrebbe dovuto riscriversi il
 *   criterio — cioè due regole per la stessa domanda, che è il modo in cui una
 *   pastiglia finisce per promettere righe che poi non si vedono.
 *   Le ⚠️ che c'erano qui (il ripiego "sede" che non deve vincere sullo stato
 *   dichiarato) sono partite con la funzione, per esteso. */

/** Una pratica passa la lente? Regola scritta una volta e usata sia per
 *  filtrare sia per contare: un "Domani 3" che poi mostra una riga sola fa
 *  perdere fiducia in tutti gli altri numeri della pagina. */
function passaFiltro(l: Lead, filtro: Filtro, dataScelta: string): boolean {
  const giorno = l.data.installazione?.dataInstallazione || "";
  const oggi = giornoISO();
  const fatta = posaCompletata(l);
  switch (filtro) {
    //  Le lenti sul CALENDARIO mostrano la giornata com'è davvero, comprese le
    //  pose già fatte: togliere dall'elenco di oggi quella appena completata
    //  farebbe sembrare che sia sparita, e alle 18 nessuno saprebbe più cosa è
    //  stato fatto in giornata.
    case "oggi":
      return giorno === oggi;
    case "domani":
      return giorno === giornoISO(1);
    case "settimana":
      return !!giorno && giorniDellaSettimana().has(giorno);
    case "data":
      return giorno === (dataScelta || oggi);
    case "ritardo":
      //  Passata e non chiusa: è l'unica cosa che in questa pagina è un errore,
      //  non un'attesa.
      return !!giorno && giorno < oggi && !fatta;
    case "da_saldare":
      //  ── ⚠️ SOLO LE POSE ANCORA DA FARE ──────────────────────────────────
      //   Il numero diceva 12 dove ce n'erano 5, e il motivo è che questa era
      //   l'UNICA lente che non escludeva le pose già completate: sette lavori
      //   finiti, col saldo mai segnato come incassato, si sommavano a quelli
      //   ancora in coda.
      //   Sono due cose diverse e vanno lette in due momenti diversi: qui c'è
      //   il lavoro che devi ancora fare e per cui devi ancora prendere dei
      //   soldi; il saldo di un lavoro FINITO è un credito, e si guarda
      //   quando si guardano i conti — non mentre si organizza la giornata.
      //   ⚠️ E NON SPARISCE: il totale sotto il titolo adesso dice quanto di
      //    quel denaro sta su pose già fatte. Nascondere un credito sarebbe
      //    stato peggio del numero sbagliato.
      return !fatta && saldoAllaConsegna(l) > 0;
    case "senza_data":
      //  Chi ha già finito non sta aspettando una data: sarebbe lavoro fermo che
      //  in realtà è chiuso, e il numero accanto alla lente mentirebbe.
      return !giorno && !fatta;
    case "completate":
      return fatta;
    /*  ── IL TOTALE ─────────────────────────────────────────────────────────
     *   «Tutte» risponde a «quante installazioni ci sono, in tutto?»: in
     *   lavorazione PIÙ completate. È l'unica lente senza condizione, ed è
     *   proprio per questo che va letta insieme a ciò che sta a monte — perché
     *   "tutte" NON vuol dire "tutti i lead", e trasformarla in quello avrebbe
     *   rotto due cose in una volta:
     *    · l'insieme su cui gira è `pratiche`, cioè soloPose(inLavorazione).
     *      I PACCHI restano fuori: hanno la loro scheda, non occupano un
     *      tecnico e non hanno un orario, quindi mescolarli qui li farebbe
     *      comparire DUE VOLTE in due schede diverse, per giunta su righe che
     *      nel posto del "quando" non avrebbero niente da scrivere.
     *    · e restano fuori le pratiche che una posa non lo sono mai diventate
     *      — archiviate, perse, o ancora in trattativa senza un euro in cassa.
     *      Contarle qui vorrebbe dire inventare installazioni che nessuno ha
     *      mai venduto: un totale gonfio è peggio di nessun totale, perché non
     *      si capisce da dove venga.
     *   Le pose A DOMICILIO invece ci sono, esattamente come in tutte le altre
     *   lenti: sono pose a tutti gli effetti (vedi crm/spedizione.ts), e la
     *   scheda «A domicilio» è un altro MODO DI GUARDARE le stesse righe, non
     *   un altro insieme — è la differenza con i pacchi.
     *   Conseguenza verificabile, ed è la ragione per cui qui si scrive `true`
     *   secco invece di rifare un elenco di condizioni: tutte = in lavorazione
     *   + completate, sempre, e i tre numeri della banda tornano da soli. */
    case "tutte":
      return true;
    /*  La lente delle manutenzioni non guarda le POSE: guarda i clienti che
     *  devono tornare, e li pesca da tutti i lead (crm/manutenzione). Qui si
     *  risponde `false` di proposito — l'elenco delle pose sotto resta vuoto e
     *  al suo posto si disegna la scheda, esattamente come per i pacchi. */
    case "manutenzioni":
      return false;
    case "in_lavorazione":
      //  La coda del lavoro: tutto ciò che è ancora aperto. Le pose chiuse
      //  hanno la loro lente e da qui in poi non la ingrossano più — un numero
      //  che non cala mai smette di essere guardato.
      return !fatta;
    case "con_driver":
      //  Le pose che impegnano DUE persone e sono ancora da fare. Le chiuse
      //  restano fuori per la stessa ragione delle altre lenti di lavorazione:
      //  un numero che non cala mai smette di essere guardato.
      return conDriver(l) && !fatta;
    case "in_sede":
      //  È «In lavorazione» meno le trasferte (i pacchi sono già fuori da
      //  questo insieme). Le pose chiuse restano fuori per la stessa ragione:
      //  hanno la loro lente, e qui gonfierebbero una coda di lavoro che in
      //  realtà è finita.
      //  ⚠️ Il paragone era con "Tutte" finché "Tutte" voleva dire il da fare:
      //  adesso quella parola è il totale, e la frase di prima descriveva un
      //  insieme diverso da quello che questa riga costruisce davvero.
      return inNostroCentro(l) && !fatta;
    default:
      //  Qui ci arrivano solo "da_spedire" e "a_domicilio", che non usano
      //  questo elenco ma la loro scheda: `visibili` si calcola comunque e non
      //  si vede. Restano sul da fare, che è la risposta meno sorprendente se
      //  un domani qualcuno le facesse passare di qui.
      return !fatta;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LA PAGINA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── L'ETICHETTA DAVANTI A UNA FILA DI NOMI ───────────────────────────────
 *  Stesse classi della barra «CONSULENTE» della pagina Oggi (routes/CRM.index):
 *  maiuscoletto piccolo, grigio, spaziato. Non è una scelta estetica ma di
 *  coerenza — due file di pastiglie identiche in due pagine della stessa
 *  applicazione devono essere introdotte allo stesso modo, o si leggono come
 *  due comandi diversi.
 *  Sul telefono sparisce: lì la barra scorre in orizzontale e ogni parola in
 *  più allontana i nomi dal bordo, che è quello che si cerca col pollice. Il
 *  titolo di ogni pastiglia dice comunque a cosa serve. */
function EtichettaFiltro({ children }: { children: ReactNode }) {
  return (
    <span className="mr-0.5 hidden shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
      {children}
    </span>
  );
}

function InstallazioniPage() {
  const { leads, consultants, updateLead } = useCRM();
  //  Le tre finestre degli stati vivono qui, montate una volta sola per la
  //  pagina: una per riga sarebbe centinaia di finestre chiuse da ridisegnare.
  const chiusura = useChiusura();
  const [quickLead, setQuickLead] = useState<Lead | null>(null);
  const [quickStato, setQuickStato] = useState<LeadStatus | null>(null);
  const [quickAperta, setQuickAperta] = useState(false);

  //  ── LE PASTIGLIE MOSTRANO CHI ENTRA IN MAGAZZINO ────────────────────────
  //   Solo installatori e manutentori, senza eccezioni: la regola sta in
  //   crm/chi-fa-le-installazioni, non qui, perché queste pastiglie esistono
  //   anche sulla giornata dell'installatore e i due elenchi non devono poter
  //   divergere.
  const persone = useMemo(() => personePerInstallazioni(consultants), [consultants]);

  /** ── CHI HA VENDUTO DAVVERO QUALCOSA ────────────────────────────────────
   *  Non tutti i consulenti, ma quelli che compaiono come venditori sulle pose
   *  che questa pagina conosce. È l'elenco più corto e l'unico onesto: una
   *  pastiglia con il nome di chi non ha nessuna posa è un filtro che, premuto,
   *  svuota l'elenco senza spiegare perché.
   *  ⚠️ Si calcola su TUTTI i lead e non su `inLavorazione`: quest'ultimo è già
   *   filtrato per venditore, e un elenco che si accorcia mentre lo si usa
   *   toglierebbe da sotto le mani la pastiglia appena premuta. */
  const vendite = useMemo(() => {
    const dentro = new Set<string>();
    for (const l of leads) {
      if (l.data?.consulenteId) dentro.add(l.data.consulenteId);
    }
    //  L'ordine è quello dell'anagrafica, come per gli installatori: due file
    //  di nomi ordinate in due modi diversi si leggono come due elenchi.
    return consultants.filter((c) => c.data.attivo && dentro.has(c.id));
  }, [leads, consultants]);

  /** ── CAMBIARE LO STATO DEL CLIENTE DAL MENU «…» ─────────────────────────
   *  La stessa strada di tutte le altre pagine del CRM, nello stesso ordine:
   *   1. le tre chiusure vinte passano da ChiusuraDialog, che scrive stato,
   *      importi e modo di consegna in un salvataggio solo — ⚠️ il ramo va
   *      PRIMA di `requiresAnyDialog` e non scrive niente da sé, o in mezzo
   *      resterebbe un lead verde con la cassa vuota;
   *   2. chi promette un giorno o degli importi apre QuickStatusDialog;
   *   3. tutto il resto — «Perditempo», «Ripensamento», «Non interessato» —
   *      si scrive subito, perché non chiede altro.
   *  ⚠️ La risposta si legge: `updateLead` torna `false` anche senza errore di
   *   rete, e qui la riga sparisce dall'elenco. Una conferma su una scrittura
   *   mai avvenuta lascerebbe credere di aver chiuso una pratica che è ancora
   *   lì, in una pagina in cui non la si rivedrà più.
   */
  const cambiaStato = async (l: Lead, nuovo: LeadStatus) => {
    if (nuovo === l.data.stato) return;
    if (chiusura.intercetta(l, nuovo)) return;
    if (requiresAnyDialog(nuovo)) {
      setQuickLead(l);
      setQuickStato(nuovo);
      //  Le due finestre non si scambiano il posto nello stesso istante: quella
      //  delle azioni si sta ancora chiudendo, e sovrapporle lascia la pagina
      //  non cliccabile.
      setTimeout(() => setQuickAperta(true), 60);
      return;
    }
    const precedente = l.data.stato;
    if (!(await updateLead(l.id, { stato: nuovo }))) {
      toast.error("Stato NON salvato", { description: "La pratica è rimasta com'era. Riprova." });
      return;
    }
    toast.success(`${nomeCompleto(l)} → ${LEAD_STATUS_LABEL[nuovo]}`, {
      description:
        fasePer(nuovo) === "persa"
          ? "Esce dalle installazioni: la ritrovi dall'elenco dei lead."
          : undefined,
      action: {
        label: "Annulla",
        onClick: () => void updateLead(l.id, { stato: precedente }),
      },
    });
  };

  //  ── LA LENTE PUÒ ARRIVARE DALL'INDIRIZZO ────────────────────────────────
  //   Serve perché il menu ha due voci dedicate — «Da spedire» e «A domicilio»
  //   — che senza questo aprirebbero la pagina sulla giornata, e chi le cerca
  //   dovrebbe cambiare lente a mano ogni volta. L'indirizzo si può anche
  //   mandare a un collega, che vede esattamente la stessa schermata.
  //   ⚠️ SI GUARDA A OGNI CAMBIO DI INDIRIZZO, non solo al primo montaggio:
  //   fra le due voci del menu non si cambia pagina (è la stessa rotta con una
  //   query diversa), quindi un valore letto una volta sola avrebbe lasciato la
  //   pagina ferma sulla lente di prima — il menu si accendeva sulla voce
  //   nuova e sotto restava l'elenco vecchio.
  const lenteUrl = useRouterState({
    select: (s) => lenteDellIndirizzo(s.location.searchStr),
  });
  const [filtro, setFiltro] = useState<Filtro>(() => lenteUrl ?? "oggi");
  useEffect(() => {
    if (lenteUrl) setFiltro(lenteUrl);
  }, [lenteUrl]);
  const [dataScelta, setDataScelta] = useState("");
  const [chiInstalla, setChiInstalla] = useState(""); // id consulente, vale per tutta la pagina
  //  ── LA RICERCA ────────────────────────────────────────────────────────
  //   Qui si arriva sapendo un nome o un numero — «quello di Brindisi», «il
  //   3331234567 che ha chiamato ieri» — e finora l'unico modo era scorrere.
  //   ⚠️ NON tocca le lenti né i conteggi in cima: quelli continuano a dire
  //    quante pose ci sono davvero. La ricerca restringe solo COSA SI VEDE, o
  //    scrivendo tre lettere si vedrebbero i numeri crollare e si penserebbe di
  //    aver perso delle pratiche.
  const [cerca, setCerca] = useState("");
  /** ── CHI HA VENDUTO ─────────────────────────────────────────────────────
   *  Richiesta del committente, ed è una domanda DIVERSA da «chi installa»:
   *  la prima risponde a «come sta andando il lavoro di Filippo», la seconda a
   *  «cosa deve fare Luca domani». Sulla stessa pratica sono quasi sempre due
   *  persone, e finché il filtro era uno solo la prima domanda non si poteva
   *  fare da qui — bisognava passare dall'elenco lead e perdere di vista le
   *  pose. I due filtri si sommano: «venduto da Filippo E installato da Luca»
   *  è la terza domanda, quella che si fa quando qualcosa non torna. */
  const [chiVende, setChiVende] = useState("");

  const [leadAperto, setLeadAperto] = useState<Lead | null>(null);
  const [schedaAperta, setSchedaAperta] = useState(false);
  const [leadDaProgrammare, setLeadDaProgrammare] = useState<Lead | null>(null);
  const [programmaAperto, setProgrammaAperto] = useState(false);

  const apriScheda = (l: Lead) => {
    setLeadAperto(l);
    setSchedaAperta(true);
  };
  const apriProgrammazione = (l: Lead) => {
    setLeadDaProgrammare(l);
    setProgrammaAperto(true);
  };
  //  ── IL RITORNO SI FISSA DALLA RIGA DELLA POSA APPENA CHIUSA ─────────────
  //   Lo stato sta QUI e non dentro la riga: la finestra è una sola per tutta
  //   la pagina, come quella della programmazione. Montarne una per riga
  //   significherebbe cinquanta dialoghi chiusi in memoria su un elenco lungo.
  const [leadManutenzione, setLeadManutenzione] = useState<Lead | null>(null);
  const [manutenzioneAperta, setManutenzioneAperta] = useState(false);
  const apriManutenzione = (l: Lead) => {
    setLeadManutenzione(l);
    setManutenzioneAperta(true);
  };

  /** ── AGGIUNGERE UNA POSA CHE NON È MAI PASSATA DALLA TRATTATIVA ─────────
   *  Il passaparola che si presenta e compra, o il cliente di tre anni fa che
   *  torna per una manutenzione: due casi che non nascono da un lead, e che
   *  fino a ieri per entrare qui dovevano passare dal percorso in quattro passi
   *  della trattativa — cioè rispondere a domande su un appuntamento che è già
   *  successo e su una campagna che non c'è mai stata. Finivano su un foglio a
   *  parte.
   *  ⚠️ APPENA CREATO SI APRE LA FINESTRA GIUSTA, quella della posa o quella
   *   del ritorno. Fermarsi al lead creato lascerebbe una pratica senza data in
   *   fondo a un elenco: il gesto che si stava facendo era «metti in
   *   calendario», e va finito. */
  const [nuovaPosaAperta, setNuovaPosaAperta] = useState(false);
  /** Il foglio delle pose: si legge e si scarica da qui (crm/FinestraCsvInstallazioni). */
  const [csvAperto, setCsvAperto] = useState(false);

  /** ── L'INSIEME ────────────────────────────────────────────────────────────
   *  Tutto ciò che è "in lavorazione posa": chi ha una data (è sul calendario) e
   *  chi ha pagato ma la data non ce l'ha ancora. Restano fuori le pratiche
   *  archiviate o dichiarate fuori target senza data: non sono lavoro arretrato,
   *  sono archivio, e in mezzo alle pose sarebbero solo rumore.
   *  Il filtro del tecnico guarda sia il consulente collegato sia il nome
   *  scritto a mano: metà archivio ha solo il secondo, e senza questo confronto
   *  quelle righe sparivano appena si sceglieva un tecnico. */
  const inLavorazione = useMemo(() => {
    const scelto = consultants.find((c) => c.id === chiInstalla);
    const nomeScelto = normalizza(scelto?.data.nome);
    return leads.filter((l) => {
      const inst = l.data.installazione;
      const conData = !!inst?.dataInstallazione;
      //  ── ⚠️ UNA PRATICA PERSA ESCE DA QUI, ANCHE SE HA UNA DATA ───────────
      //   La regola guardava «perdi_tempo» e «concluso» SOLO quando mancava il
      //   giorno: bastava che la posa fosse già stata programmata perché un
      //   cliente segnato perditempo — o che ci ha ripensato — restasse in
      //   elenco per sempre, con la sua giornata, il suo tecnico e il suo
      //   «da incassare» dentro i totali della pagina. Segnalato dal
      //   committente: «se metto perditempo lo toglie dalla lista».
      //   Si legge la FASE e non un elenco di stati scritto a mano, così il
      //   giorno che nasce una quinta chiusura persa questa riga non va
      //   ritrovata (è già successo con «ripensamento»).
      //   Il giorno rimasto in scheda non si cancella: la pratica si può
      //   riaprire, e allora la posa è ancora quella. Semplicemente non
      //   occupa più il lavoro di nessuno.
      if (fasePer(l.data.stato) === "persa") return false;
      if (!conData) {
        if (l.data.stato === "concluso" || l.data.stato === "perdi_tempo") return false;
        //  ⚠️ QUI SI DECIDE CHI ENTRA NEL LAVORO DA FARE, e l'elenco scritto a
        //   mano conosceva solo i due stati vinti di ieri. Una vendita chiusa
        //   oggi senza acconto — «paga tutto alla consegna», che è un caso
        //   normale — non era né "acconto" né "venduto" e non aveva un euro in
        //   cassa: non compariva in questa pagina finché qualcuno non le metteva
        //   una data. Cioè la posa la si scopriva solo se qualcuno se la
        //   ricordava a memoria.
        //  ⚠️ La regola non è più scritta qui: sta in `aspettaUnaData`
        //   (crm/InstallationScheduleDialog), perché la legge anche il badge
        //   «Da programmare» della barra laterale — e quando era scritta due
        //   volte le due cifre erano già diverse, 10 contro 11.
        if (!aspettaUnaData(l)) return false;
      }
      //  I due filtri si sommano: chi ne accende due vuole l'incrocio, non
      //  l'unione — «venduto da lui E posato da lei».
      if (chiVende && l.data.consulenteId !== chiVende) return false;
      if (!chiInstalla) return true;
      return (
        inst?.consulenteInstallazioneId === chiInstalla ||
        (!!nomeScelto && normalizza(inst?.tecnicoAssegnato) === nomeScelto)
      );
    });
  }, [leads, consultants, chiInstalla, chiVende]);

  //  Le pose vere e i pacchi sono due insiemi separati: una pratica da spedire
  //  non occupa un tecnico, non ha un orario e non deve entrare in nessun
  //  conteggio del giorno.
  const pratiche = useMemo(() => soloPose(inLavorazione), [inLavorazione]);

  //  I pacchi si prendono da TUTTI i lead, non da quelli "in lavorazione
  //  posa": una pratica segnata da spedire deve restare visibile qualunque cosa
  //  dicano il suo stato o il suo pagamento. Se sparisse da tutti e due gli
  //  elenchi, il pacco resterebbe in magazzino e nessuno saprebbe perché — è il
  //  danno peggiore che questa pagina possa fare.
  const spedizioni = useMemo(() => leads.filter((l) => daSpedire(l)), [leads]);

  //  ── LE POSE A DOMICILIO ────────────────────────────────────────────────
  //   Si prendono da `pratiche`, cioè dallo STESSO insieme delle altre pose (e
  //   quindi già filtrato per tecnico): una posa a domicilio è una posa a tutti
  //   gli effetti, e leggerla da un'altra parte avrebbe voluto dire un numero
  //   diverso qui e nella lente "Oggi" per la stessa pratica. È la differenza
  //   con i pacchi, che invece stanno fuori dalle pose e si leggono da tutti i
  //   lead.
  const domicili = useMemo(() => pratiche.filter((l) => aDomicilio(l)), [pratiche]);

  const conteggi = useMemo(() => {
    const quanti = (f: Filtro) => pratiche.filter((l) => passaFiltro(l, f, dataScelta)).length;
    return {
      oggi: quanti("oggi"),
      domani: quanti("domani"),
      settimana: quanti("settimana"),
      ritardo: quanti("ritardo"),
      da_saldare: quanti("da_saldare"),
      senza_data: quanti("senza_data"),
      //  I TRE NUMERI CHE DEVONO TORNARE. Nascono tutti e tre dalla stessa
      //  `quanti` sullo stesso insieme, quindi non possono scollarsi:
      //  tutte = in_lavorazione + completate. Contare il totale come
      //  `pratiche.length` sarebbe stato più corto e avrebbe aperto la porta a
      //  un numero che vive per conto suo — è esattamente il modo in cui una
      //  pastiglia finisce per promettere righe che poi non si vedono.
      tutte: quanti("tutte"),
      in_lavorazione: quanti("in_lavorazione"),
      completate: quanti("completate"),
      //  Le pose in centro ancora in lavorazione. Qui il numero e l'elenco
      //  nascono dalla STESSA riga di passaFiltro, quindi la pastiglia non può
      //  promettere righe che poi non si vedono — a differenza delle due lenti
      //  qui sotto, che hanno una scheda tutta loro e contano solo il da fare.
      in_sede: quanti("in_sede"),
      //  Come sopra: numero ed elenco nascono dalla stessa riga di passaFiltro,
      //  quindi la pastiglia non può promettere righe che poi non si vedono.
      con_driver: quanti("con_driver"),
      //  Il conteggio dei pacchi dice quanti devono ANCORA partire: quelli già
      //  spediti sono archivio, e un numero che non cala mai smette di essere
      //  guardato.
      da_spedire: spedizioni.filter((l) => !spedita(l)).length,
      //  Come sopra: quante pose a domicilio sono ancora DA FARE. Le fatte
      //  restano visibili nella scheda, ma un numero che non cala mai smette
      //  di essere guardato.
      a_domicilio: domicili.filter((l) => !posaCompletata(l)).length,
      //  ── LE MANUTENZIONE SI CONTANO SU TUTTI I LEAD ────────────────────
      //   Non su `pratiche`: un cliente che deve tornare fra tre settimane non
      //   è più una posa in lavorazione, e contarlo di lì lo avrebbe fatto
      //   sparire dal numero il giorno stesso in cui la posa si chiude.
      //   Il numero è quello su cui si può AGIRE — in ritardo, oggi, entro
      //   sette giorni — e non il totale dei ritorni in programma: un numero
      //   che non cala mai smette di essere guardato, come per le altre lenti.
      manutenzioni: quanteDaSeguire(leads),
    };
  }, [pratiche, spedizioni, domicili, dataScelta, leads]);

  /** Il totale in attesa si calcola su TUTTO l'insieme, non sulla lente attiva:
   *  "quanto c'è da incassare" non deve cambiare perché sto guardando domani.
   *  È l'unico numero dei sei riquadri di prima che non fosse già un filtro, e
   *  per questo è rimasto — ma come riga sotto il titolo, non come banda. */
  const inAttesa = useMemo(() => totaleDaIncassare(pratiche), [pratiche]);
  /*  ⚠️ Quanto di quel denaro è su lavori GIÀ CONSEGNATI. Prima finiva nel
      mucchio, e il numero delle pose «da saldare» lo contava come se fossero
      lavori ancora da fare. Adesso la lente conta solo la coda, e questa riga
      dice quello che resta fuori: un credito su una consegna avvenuta è la
      cosa che si dimentica per prima, e va detta con un numero. */
  const saldoSuFatte = useMemo(
    () => totaleDaIncassare(pratiche.filter((l) => posaCompletata(l))),
    [pratiche],
  );

  const visibili = useMemo(() => {
    const dentroLaLente = pratiche.filter((l) => passaFiltro(l, filtro, dataScelta));
    //  Si preparano UNA volta, non a ogni riga: su qualche centinaio di
    //  pratiche la differenza si sente sotto le dita mentre si scrive.
    const q = normalizza(cerca).trim();
    const qCifre = soloCifre(cerca);
    if (!q && !qCifre) return dentroLaLente;
    return dentroLaLente.filter((l) => trovaNelLead(l, q, qCifre));
  }, [pratiche, filtro, dataScelta, cerca]);

  /** ── LE ANTICIPATE ESCONO DALLA PILA, IL RESTO SI RAGGRUPPA PER GIORNO ───
   *  Due elenchi da UNA lente sola: `anticipate` e `gruppi` nascono tutti e due
   *  da `visibili`, e insieme lo esauriscono. È l'invariante che tiene onesta
   *  questa pagina — il blocco in cima NON è un altro insieme, è la stessa lente
   *  riordinata: una riga che il filtro esclude non può ricomparire lassù
   *  perché è stata messa in priorità, e una che il filtro include non può
   *  sparire da tutti e due gli elenchi.
   *  ⚠️ Salgono solo le pose SENZA UN GIORNO FISSATO. Una già programmata resta
   *  nella sua giornata, con il cartellino: portarla via svuoterebbe la scheda
   *  del giorno — e con lei il conteggio, il totale da incassare e il riepilogo
   *  che si copia all'installatore, che perderebbe una riga senza dirlo. Il
   *  perché per esteso sta su `inCimaAllElenco` in crm/priorita.ts. */
  const anticipate = useMemo(
    () => visibili.filter((l) => inCimaAllElenco(l)).sort(confrontaAnticipate),
    [visibili],
  );

  const gruppi = useMemo(
    () => ordinaGiornate(raggruppaPerGiorno(visibili.filter((l) => !inCimaAllElenco(l)))),
    [visibili],
  );

  /** Il riepilogo del giorno in testo semplice: si incolla nella chat del
   *  tecnico. Prima si dettava a voce o si facevano tre screenshot. */
  const copiaRiepilogo = async (giorno: string, items: Lead[]) => {
    const righe = [
      `Installazioni ${giorno ? formatDate(giorno) : "senza data"} — ${items.length} · da incassare ${eur(
        totaleDaIncassare(items),
      )}`,
      ...items.map((l) => {
        const inst = l.data.installazione;
        return [
          inst?.orarioInstallazione || "orario da definire",
          nomeCompleto(l),
          l.data.citta,
          nomeTecnico(l, consultants),
          //  Le stesse tre parole nello stesso ordine dello schermo: un foglio
          //  incollato in chat che dice "saldo 1.200" mentre la riga dice
          //  "resta 1.200" costringe a ricontrollare quale delle due è giusta.
          rigaSoldi(l),
          l.data.telefono,
        ]
          .filter(Boolean)
          .join(" · ");
      }),
    ];
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Copia non disponibile su questo dispositivo.");
      return;
    }
    try {
      await navigator.clipboard.writeText(righe.join("\n"));
      toast.success("Riepilogo copiato: puoi incollarlo all'installatore.");
    } catch {
      toast.error("Copia non riuscita.");
    }
  };

  const periodo: Record<Filtro, string> = {
    oggi: "oggi",
    domani: "domani",
    settimana: "questa settimana",
    ritardo: "fra le pose in ritardo",
    da_saldare: "fra le pose con saldo aperto",
    senza_data: "in attesa di una data",
    tutte: "né in lavorazione né completata",
    in_lavorazione: "in lavorazione",
    completate: "fra le pose completate",
    in_sede: "da fare nel nostro centro",
    da_spedire: "da spedire",
    a_domicilio: "a domicilio",
    con_driver: "con un driver",
    manutenzioni: "fra le manutenzioni",
    data: formatDate(dataScelta || giornoISO()).toLowerCase(),
  };

  const lente = (f: Filtro) => ({
    attivo: filtro === f,
    conteggio: conteggi[f as keyof typeof conteggi] as number,
    onClick: () => setFiltro(f),
  });

  /** ── IL FOGLIO DEI FILTRI, SOLO SUL TELEFONO ─────────────────────────────
   *  Sul monitor non si apre mai: la banda è già tutta in vista. */
  const [foglioFiltri, setFoglioFiltri] = useState(false);

  /** ── QUANTI FILTRI NON SI VEDONO DALLA RIGA IN CIMA ─────────────────────
   *  Sul telefono restano fuori tre pastiglie sole, e tutto il resto è chiuso.
   *  Questo numero è quello che va SOPRA il pulsante, ed è l'unica difesa
   *  contro il difetto classico dei filtri a scomparsa: guardare un elenco
   *  parziale credendolo completo, e concludere che mancano delle pose.
   *  ⚠️ Le tre in vista NON contano: sono accese e visibili, dirlo due volte
   *   farebbe segnare «1 filtro» sulla schermata predefinita — cioè un
   *   allarme che suona sempre, e che quindi non si guarda più. */
  const filtriInPiu =
    (["oggi", "domani", "ritardo"].includes(filtro) ? 0 : 1) +
    (chiVende ? 1 : 0) +
    (chiInstalla ? 1 : 0);

  /** ── ⚠️ I FILTRI SONO SCRITTI UNA VOLTA E MOSTRATI IN DUE POSTI ────────
   *  Sul monitor sono la banda in cima, dove ci stanno tutti e si leggono a
   *  colpo d'occhio. Sul telefono no: sono più di quindici pastiglie più due
   *  file di nomi, e su 375 punti diventano cinque righe di muro sopra
   *  l'elenco — cioè la pagina non comincia mai. Là stanno dentro un foglio
   *  che si apre da un pulsante solo.
   *
   *  ⚠️ MA SONO GLI STESSI, non una seconda versione ridotta: qui c'è UNA
   *   espressione, resa in due contenitori. Riscriverne una copia per il
   *   telefono vorrebbe dire che il giorno in cui si aggiunge un filtro lo si
   *   aggiunge in un posto solo, e da lì in poi le due schermate filtrano
   *   insiemi diversi senza che niente lo dica. */
  /** ── QUANDO IL MODO DI CONSEGNA HA QUALCOSA DA DIRE ──────────────────────
   *  MISURATO, non supposto: sulle pratiche vere «Nel nostro centro» seleziona
   *  ESATTAMENTE le stesse righe di «In lavorazione» — undici e undici, gli
   *  stessi id. Non è un caso: «in sede» è «in lavorazione MENO le trasferte»,
   *  e finché non c'è nemmeno una spedizione o un domicilio quel "meno" non
   *  toglie niente. Erano quattro pastiglie che non potevano cambiare l'elenco,
   *  una delle quali col nome di un'altra.
   *
   *  Quindi il gruppo compare solo quando DIVIDE davvero, cioè quando esiste
   *  almeno una pratica che non si fa in centro. È la stessa regola che questa
   *  barra applica già ai nomi («solo se c'è più di un nome da scegliere»),
   *  scritta una seconda volta per le consegne.
   *  ⚠️ Se però la lente attiva è una di quelle il gruppo si vede COMUNQUE:
   *   ci si arriva dal menu di lato (?lente=da-spedire), e una pagina che si
   *   apre filtrata senza mostrare il filtro acceso è un elenco corto e
   *   inspiegabile. */
  const MODI_CONSEGNA: Filtro[] = ["in_sede", "da_spedire", "a_domicilio", "con_driver"];
  const consegnaDivide =
    conteggi.da_spedire > 0 || conteggi.a_domicilio > 0 || conteggi.con_driver > 0;
  const mostraConsegna = consegnaDivide || MODI_CONSEGNA.includes(filtro);

  const tuttiIFiltri = (
    <div className="flex w-full flex-col gap-2">
      {/* ── PRIMA FILA: QUANDO ────────────────────────────────────────────
            La domanda che si fa nove volte su dieci, e per questo sta da sola
            sulla prima riga: cercarla dentro un muro di quattordici pastiglie
            tutte uguali costava ogni volta una lettura di tutta la barra.
            Niente icone qui di proposito — sono quattro parole di tempo che si
            leggono come una sequenza, e un simbolo davanti a ognuna le
            spezzerebbe. L'unica che ne porta uno è «In ritardo», perché è
            l'unica che non descrive un giorno ma un guaio. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <EtichettaFiltro>Quando</EtichettaFiltro>
        <Segmento {...lente("oggi")}>Oggi</Segmento>
        <Segmento {...lente("domani")}>Domani</Segmento>
        <Segmento {...lente("settimana")} titolo="I prossimi sette giorni">
          Settimana
        </Segmento>
        <Segmento
          {...lente("ritardo")}
          titolo="Giorno passato, posa non chiusa"
          className={cn(
            //  Il rosso solo quando c'è davvero qualcosa in ritardo: una
            //  pastiglia d'allarme accesa su «0» insegna a ignorarla.
            conteggi.ritardo > 0 && filtro !== "ritardo" && "border-red-300 text-red-700",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            In ritardo
          </span>
        </Segmento>

        {/*  Il campo data resta chiaro anche quando è quello attivo (segnato
              solo dal bordo): riempirlo di scuro come i segmenti nasconderebbe
              l'icona del calendario del browser, che è disegnata scura e non si
              può cambiare. */}
        <label
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-[12px]",
            filtro === "data"
              ? "border-foreground text-foreground ring-1 ring-foreground/20"
              : "border-border text-muted-foreground",
          )}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          {/*  Scegliere una data È già la richiesta di vederla: cambiare anche
                il segmento a mano sarebbe un secondo clic per la stessa
                intenzione. */}
          <input
            type="date"
            aria-label="Scegli una data"
            value={dataScelta}
            onChange={(e) => {
              setDataScelta(e.target.value);
              setFiltro(e.target.value ? "data" : "oggi");
            }}
            className="bg-transparent text-[12px] tabular-nums text-foreground outline-none"
          />
        </label>

        {/* ── LA RICERCA ─────────────────────────────────────────────────
              ⚠️ STA IN FONDO ALLA PRIMA FILA, spinta a destra, e non in cima
               alla pagina: le lenti sono la domanda che ci si fa nove volte su
               dieci, la ricerca la decima («dov'è finito quel signore di
               Brindisi»). Mettendola sopra prenderebbe il posto d'onore che
               serve alle lenti; messa a destra è comunque il primo posto dove
               si guarda cercando un campo di testo.
              ⚠️ E NON TOCCA I CONTEGGI delle lenti: quelli continuano a dire
               quante pose ci sono davvero. Scrivendo tre lettere si vedrebbero
               crollare tutti i numeri in cima e si penserebbe di aver perso
               delle pratiche. */}
        <label
          className={cn(
            "ml-auto inline-flex min-w-[11rem] flex-1 items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-[12px] sm:max-w-[20rem] sm:flex-none",
            cerca ? "border-foreground ring-1 ring-foreground/20" : "border-border",
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            //  Esc svuota: è il gesto che si fa d'istinto quando la ricerca non
            //  trova niente, e senza costringe a cancellare a mano.
            onKeyDown={(e) => {
              if (e.key === "Escape") setCerca("");
            }}
            placeholder="Nome, telefono, o una parola nelle note…"
            aria-label="Cerca fra le pose"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {!!cerca && (
            <button
              type="button"
              onClick={() => setCerca("")}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
              aria-label="Svuota la ricerca"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </label>
      </div>

      {/* ── SECONDA FILA: A CHE PUNTO SONO · COSA È FERMO · COME ARRIVA ──── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/*  L'INSIEME E LE SUE DUE METÀ, disegnati come UN interruttore a tre
              posizioni e non come tre pastiglie sciolte: sono una partizione —
              «in tutto sono 24: 11 da fare e 13 fatte» — e i due numeri di
              destra sommano al primo. Da sciolte sembravano tre filtri
              indipendenti che si potessero accendere insieme.
              ⚠️ La lente che portava il nome «Tutte» mostrava soltanto il da
              fare: chi cercava il totale leggeva un numero più basso del vero,
              e niente sullo schermo glielo diceva. */}
        <div className="flex flex-wrap items-center gap-1.5">
        <EtichettaFiltro>A che punto</EtichettaFiltro>
        <div className="inline-flex items-center gap-px overflow-hidden rounded-lg border border-border bg-border">
          <Segmento
            {...lente("in_lavorazione")}
            titolo="La coda del lavoro: tutto ciò che è ancora aperto"
            className="rounded-none border-0"
          >
            <span className="inline-flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              Da fare
            </span>
          </Segmento>
          <Segmento
            {...lente("completate")}
            titolo="Pose fatte e incassate: l'archivio"
            className="rounded-none border-0"
          >
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Eseguite
            </span>
          </Segmento>
          <Segmento
            {...lente("tutte")}
            titolo="Il totale delle pose: in lavorazione più completate. I pacchi hanno la loro scheda e restano fuori"
            className="rounded-none border-0"
          >
            Tutte
          </Segmento>
        </div>
        </div>

        {/*  COSA È FERMO. Le due lenti che non descrivono uno stato ma un
              lavoro che aspetta qualcuno: una data da fissare, dei soldi da
              ritirare. Sono le uniche due su cui si AGISCE, e stanno insieme
              per questo. */}
        <div className="flex flex-wrap items-center gap-1.5">
        <EtichettaFiltro>Fermo</EtichettaFiltro>
        <Segmento
          {...lente("senza_data")}
          titolo="Hanno pagato e aspettano che si fissi il giorno"
        >
          <span className="inline-flex items-center gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
            Senza data
          </span>
        </Segmento>
        <Segmento {...lente("da_saldare")} titolo="Pose ancora da fare con un importo da incassare">
          <span className="inline-flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5 shrink-0" />
            Da saldare
          </span>
        </Segmento>
        </div>

        {/*  ⚠️ QUI C'ERANO DEI SEPARATORI VERTICALI fra un gruppo e l'altro, e
              a schermo stretto andavano a capo DA SOLI: una lineetta orfana in
              cima a una riga sembra un pezzo di interfaccia rotto. Le etichette
              in maiuscoletto separano già i gruppi, e lo fanno dicendo anche
              QUALE domanda sta separando — la lineetta era rumore che ripeteva
              un confine già scritto a parole. */}
        {/*  IL DOPO POSA. Non è una lente sull'elenco: al suo posto si apre
              un'altra scheda, quella dei clienti che devono tornare. Sta in
              fondo perché è il tempo in cui arriva — quando tutto il resto è
              finito, il cliente torna. */}
        <Segmento
          {...lente("manutenzioni")}
          titolo="Clienti che devono tornare: in ritardo, oggi o entro sette giorni"
        >
          <span className="inline-flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5 shrink-0" />
            Manutenzioni
          </span>
        </Segmento>

        {/*  I MODI DI CONSEGNA — solo quando dividono qualcosa (vedi sopra).
              L'ordine è quello di crm/spedizione.ts: il centro davanti, perché
              è il caso normale ed è quello che si apre più spesso. «Con driver»
              non è un modo di consegna ma sta con loro perché risponde alla
              stessa domanda pratica — come esce di qui, e con chi. */}
        {mostraConsegna && (
          <div className="flex flex-wrap items-center gap-1.5">
            <EtichettaFiltro>Come arriva</EtichettaFiltro>
            <Segmento {...lente("in_sede")} titolo="Pose che si fanno da noi: né trasferta né pacco">
              <span className="inline-flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 shrink-0" />
                In centro
              </span>
            </Segmento>
            <Segmento
              {...lente("da_spedire")}
              titolo="Impianti che si spediscono: non occupano un installatore né un orario"
            >
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 shrink-0" />
                Da spedire
              </span>
            </Segmento>
            <Segmento
              {...lente("a_domicilio")}
              titolo="Pose a casa del cliente: occupano un installatore e restano nella giornata"
            >
              <span className="inline-flex items-center gap-1.5">
                <House className="h-3.5 w-3.5 shrink-0" />A domicilio
              </span>
            </Segmento>
            <Segmento
              {...lente("con_driver")}
              titolo="Pose con un driver: quel giorno escono in due, e si bloccano due agende"
            >
              <span className="inline-flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 shrink-0" />
                Con driver
              </span>
            </Segmento>
          </div>
        )}
      </div>

      {/* ── TERZA FILA: CHI ────────────────────────────────────────────────
            ⚠️ DUE DOMANDE, DUE FILE, UN'ETICHETTA CIASCUNA. Le pastiglie dei
             nomi erano una fila sola e senza titolo: si capiva che filtravano
             per persona, non QUALE persona — e da quando le domande sono due
             («chi ha venduto» e «chi installa») una fila muta sarebbe stata
             indecifrabile.
            Ogni gruppo compare solo se c'è più di un nome da scegliere: con una
            persona sola il filtro non toglie niente ed è solo una riga in più
            da leggere. Ed è la STESSA regola dei modi di consegna qui sopra —
            un filtro che non divide non si mostra. */}
      {(vendite.length > 1 || (persone.elenco.length > 1 && filtro !== "da_spedire") ||
        (persone.nessuno && filtro !== "da_spedire")) && (
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
          {/*  ⚠️ DUE FILE SEPARATE, non una che va a capo. Andando a capo si
                leggeva «… Mirko Cona · INSTALLATA DA · Tutti · Marco»: due
                domande diverse attaccate sulla stessa riga, e i nomi in mezzo
                che non si capiva a quale delle due rispondessero. */}
          {vendite.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <EtichettaFiltro>Venduto da</EtichettaFiltro>
              <Segmento attivo={!chiVende} onClick={() => setChiVende("")}>
                Tutti
              </Segmento>
              {vendite.map((c) => (
                <Segmento
                  key={c.id}
                  attivo={chiVende === c.id}
                  onClick={() => setChiVende(chiVende === c.id ? "" : c.id)}
                  titolo={`Solo le pose vendute da ${c.data.nome}`}
                >
                  {c.data.nome}
                </Segmento>
              ))}
            </div>
          )}

          {/*  Il filtro dell'installatore sparisce sui pacchi: una spedizione
                non ha un installatore, e un comando che resta acceso senza
                cambiare niente di quello che si vede è esattamente il rumore
                che si sta togliendo. La scelta però resta in memoria: tornando
                alle pose la persona selezionata è ancora quella. */}
          {persone.elenco.length > 1 && filtro !== "da_spedire" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <EtichettaFiltro>Installata da</EtichettaFiltro>
              <Segmento attivo={!chiInstalla} onClick={() => setChiInstalla("")}>
                Tutti
              </Segmento>
              {persone.elenco.map((c) => (
                <Segmento
                  key={c.id}
                  attivo={chiInstalla === c.id}
                  onClick={() => setChiInstalla(chiInstalla === c.id ? "" : c.id)}
                  titolo={`Solo le pose che fa ${c.data.nome}`}
                >
                  {c.data.nome}
                </Segmento>
              ))}
            </div>
          )}

          {/*  ── QUANDO NON C'È NESSUN NOME DA MOSTRARE ──────────────────
                Una barra che finisce senza pastiglie sembra un filtro rotto, e
                la tentazione — mostrare tutti «per non lasciarla vuota» — è
                proprio quello che qui non si deve fare: rimetterebbe dentro
                setter e consulenti. Si dice invece la cosa vera, cioè che manca
                una spunta e dove sta, così il vuoto ha una causa e un
                rimedio. */}
          {persone.nessuno && filtro !== "da_spedire" && (
            <span
              className="text-[11.5px] text-slate-500"
              title="Scheda del collaboratore → «Che mestiere fa» → «Fa le installazioni» o «Fa le manutenzioni»."
            >
              Nessun installatore o manutentore: la spunta è nella scheda del collaboratore.
            </span>
          )}
        </div>
      )}
    </div>
  );
  return (
    <Pagina>
      {/*  Le due schermate delle pose sono una cosa sola: da qui si raggiunge
          l'altra senza tornare al menu.
          ⚠️ QUI C'ERA ANCHE «Agenda», che apriva /CRM/installazioni/agenda: la
          pagina non esiste più, e con lei il pulsante. Il lavoro che ci si
          faceva — dare un giorno a chi ha pagato e aspetta — è la lente «Senza
          data» qui sotto, che conta esattamente quelle pratiche. */}
      <Titolo
        testo="Installazioni"
        nota={
          <>
            {/*  Il "su N" compare solo quando c'è un archivio: finché non è
                stata chiusa nessuna posa i due numeri sono lo stesso numero, e
                "12 in lavorazione su 12" è rumore che fa dubitare di tutti gli
                altri.
                ⚠️ SI SCRIVE «pose» E NON «in tutto» E BASTA: due voci più in là
                questa stessa riga dice «2 da spedire», e i pacchi in quel
                totale NON ci sono (l'insieme è `soloPose`). Con la parola
                generica i due numeri sembrano l'uno dentro l'altro, e chi
                prova a farli tornare conclude che uno dei due è sbagliato. */}
            {conteggi.in_lavorazione} in lavorazione
            {conteggi.completate > 0 && ` su ${conteggi.tutte} pose in tutto`} ·{" "}
            <span className={cn("font-semibold tabular-nums", inAttesa > 0 && "text-amber-700")}>
              {eur(inAttesa)}
            </span>{" "}
            da incassare in attesa
            {saldoSuFatte > 0 && (
              <>
                {" · "}
                <span className="font-semibold tabular-nums text-amber-700">{eur(saldoSuFatte)}</span>
                {" su pose già consegnate"}
              </>
            )}
            {conteggi.a_domicilio > 0 && ` · ${conteggi.a_domicilio} a domicilio`}
            {conteggi.da_spedire > 0 && ` · ${conteggi.da_spedire} da spedire`}
          </>
        }
        icona={Wrench}
        azioni={
          <>
            <Button asChild size="sm" variant="outline" className="h-8 text-[12px]">
              <Link to="/CRM/installazioni/oggi">
                <CalendarClock className="mr-1 h-3.5 w-3.5" /> Giornata dell&apos;installatore
              </Link>
            </Button>
            {/*  ── IL FOGLIO, DENTRO E FUORI ─────────────────────────────
                  Richiesta del committente: le pose stavano su un foglio di
                  calcolo, e quel foglio deve poter entrare qui dentro — e
                  uscirne. Sono due tasti contornati e non pieni: si usano una
                  volta ogni tanto, mentre «Aggiungi» è il gesto di tutti i
                  giorni e resta l'unico pieno. */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[12px]"
              onClick={() => setCsvAperto(true)}
              title="Leggi un foglio CSV: acconti, prezzi, date delle pose e note"
            >
              <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Importa CSV
            </Button>
            <TastoScaricaCsv leads={pratiche} />
            {/*  Pieno e non contornato: è l'unica cosa che si AGGIUNGE da
                  questa pagina, e tutto il resto qui sopra guarda e basta. */}
            <Button size="sm" className="h-8 text-[12px]" onClick={() => setNuovaPosaAperta(true)}>
              <UserPlus className="mr-1 h-3.5 w-3.5" /> Aggiungi
            </Button>
          </>
        }
      />

      {/* ── LA BANDA UNICA ──────────────────────────────────────────────────
          I filtri, con il numero DENTRO la pastiglia. I sei riquadri che
          ripetevano gli stessi numeri sono spariti: il conteggio sta dove si
          preme, e ogni numero è contato sullo stesso insieme che si vedrà dopo
          il clic. */}
      {/* ── SUL MONITOR: TUTTO IN VISTA ─────────────────────────────────── */}
      <BarraAzioni className="hidden lg:flex">{tuttiIFiltri}</BarraAzioni>

      {/* ── SUL TELEFONO: TRE PASTIGLIE E UN PULSANTE ──────────────────────
          ⚠️ QUALI TRE, E PERCHÉ PROPRIO QUELLE. «Oggi», «Domani» e «In
          ritardo» sono le sole domande che si fanno CON IL TELEFONO IN MANO —
          in macchina, in cantiere, mentre il cliente sta chiamando. Tutto il
          resto («questa settimana», «da saldare», chi ha venduto, chi
          installa) è lavoro da scrivania, e su una banda da quindici pastiglie
          costava cinque righe di muro sopra l'elenco: la pagina non cominciava
          mai. Adesso comincia subito, e il resto è a un tocco.
          ⚠️ La pastiglia porta il suo conteggio: un filtro che dice «0» prima
          di premerlo evita il viaggio a vuoto, che è il vero costo su un
          telefono lento. */}
      <div className="sticky top-0 z-20 flex items-center gap-1.5 rounded-xl border border-border bg-card/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
        <Segmento {...lente("oggi")}>Oggi</Segmento>
        <Segmento {...lente("domani")}>Domani</Segmento>
        <Segmento {...lente("ritardo")}>Ritardo</Segmento>
        <button
          type="button"
          onClick={() => setFoglioFiltri(true)}
          aria-label="Tutti i filtri"
          className={cn(
            "relative ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition",
            filtriInPiu > 0
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtri
          {/*  Il numero e non un puntino: «2» dice quanti filtri stanno
              nascondendo delle righe, e un puntino dice solo che qualcosa
              c'è — cioè fa aprire il foglio per scoprirlo. */}
          {filtriInPiu > 0 && <span className="tabular-nums">{filtriInPiu}</span>}
        </button>
      </div>

      {/*  ── CHE COSA STO GUARDANDO, QUANDO NON È OVVIO ────────────────────
          Con i filtri chiusi in un foglio si può restare su un elenco parziale
          senza sapere perché: è il difetto classico dei filtri a scomparsa, e
          si manifesta come «mancano delle pose». Questa riga dice la lente
          accesa e i nomi scelti, e la si spegne dov'è scritta. */}
      {filtriInPiu > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-0.5 lg:hidden">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Filtro</span>
          {!["oggi", "domani", "ritardo"].includes(filtro) && (
            <button
              type="button"
              onClick={() => setFiltro("oggi")}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11.5px]"
            >
              {NOME_LENTE[filtro]}
              <X className="h-3 w-3 opacity-60" />
            </button>
          )}
          {chiVende && (
            <button
              type="button"
              onClick={() => setChiVende("")}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11.5px]"
            >
              Venduto da {vendite.find((c) => c.id === chiVende)?.data.nome ?? "—"}
              <X className="h-3 w-3 opacity-60" />
            </button>
          )}
          {chiInstalla && (
            <button
              type="button"
              onClick={() => setChiInstalla("")}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11.5px]"
            >
              Installata da {persone.elenco.find((c) => c.id === chiInstalla)?.data.nome ?? "—"}
              <X className="h-3 w-3 opacity-60" />
            </button>
          )}
        </div>
      )}

      {/*  Il foglio con TUTTI i filtri: gli stessi del monitor, non una
          seconda versione. Si monta solo da aperto — quelle pastiglie sono
          molte, e disegnarle sempre per tenerle nascoste è lavoro buttato su
          un telefono. */}
      {foglioFiltri && (
        <Finestra
          aperta={foglioFiltri}
          onCambio={setFoglioFiltri}
          icona={SlidersHorizontal}
          titolo="Filtri"
          contesto={`${visibili.length} ${visibili.length === 1 ? "riga" : "righe"}`}
          larghezza="md"
        >
          <div className="flex flex-wrap items-center gap-2">{tuttiIFiltri}</div>
        </Finestra>
      )}

      {/* ── L'ELENCO ────────────────────────────────────────────────────────
          Le pose raggruppate per giorno, in ordine di imminenza; oppure, con la
          lente dei pacchi, la scheda delle spedizioni. */}
      {filtro === "manutenzioni" ? (
        //  Legge da TUTTI i lead, non dalle pose in lavorazione: un cliente che
        //  torna fra tre settimane ha la posa chiusa da un pezzo.
        <PannelloManutenzioni leads={leads} consulenti={consultants} onApri={apriScheda} />
      ) : filtro === "da_spedire" ? (
        <SpedizioniPannello spedizioni={spedizioni} onApri={apriScheda} />
      ) : filtro === "a_domicilio" ? (
        <DomicilioPannello
          domicili={domicili}
          consulenti={consultants}
          onApri={apriScheda}
          onProgramma={apriProgrammazione}
        />
      ) : gruppi.length === 0 && anticipate.length === 0 ? (
        <Vuoto
          titolo="Niente da mostrare"
          testo={`Non c'è nessuna installazione ${periodo[filtro]}.`}
          icona={Wrench}
          azione={
            //  La via d'uscita da una lente vuota è l'insieme INTERO, non più
            //  la sola coda del lavoro: chi guarda «Completate» e non trova
            //  niente non sta cercando il da fare. Su «Tutte» il pulsante non
            //  compare — sotto non c'è più niente da allargare, e un comando
            //  che riporta alla schermata che si sta già guardando fa sembrare
            //  rotta la pagina.
            filtro !== "tutte" ? (
              <Button size="sm" variant="outline" onClick={() => setFiltro("tutte")}>
                Vedi tutte le installazioni
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <GruppoDaAnticipare
            items={anticipate}
            consulenti={consultants}
            onApri={apriScheda}
            onProgramma={apriProgrammazione}
            onStato={(l, st) => void cambiaStato(l, st)}
            onManutenzione={apriManutenzione}
          />
          {gruppi.map((g, i) => (
            <Fragment key={g.giorno || "senza-data"}>
              {/* ── DOVE FINISCE IL CALENDARIO E COMINCIA IL DA FARE ────────
                  `ordinaGiornate` mette per prime le giornate (oggi in testa),
                  poi il mucchio senza data, poi l'archivio: l'ordine era già
                  giusto, ma il passaggio fra le due famiglie non si vedeva —
                  si scorreva una fila di giornate e all'improvviso arrivava una
                  scheda che parlava di tutt'altro. Sono due lavori diversi:
                  sopra c'è da ESEGUIRE quello che è già in calendario, qui
                  sotto c'è da DECIDERE una data. La riga lo dice, con il suo
                  numero, e compare solo se sopra c'è davvero qualcosa —
                  altrimenti sarebbe un titolo per un elenco solo. */}
              {!g.giorno && filtro !== "completate" && i > 0 && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-amber-700">
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Da programmare · {g.items.length}
                  </span>
                  <span className="hidden text-[12px] text-muted-foreground sm:inline">
                    hanno pagato e aspettano che si fissi il giorno
                  </span>
                  <span className="h-px flex-1 bg-amber-200" />
                </div>
              )}
              <GruppoGiorno
                giorno={g.giorno}
                items={g.items}
                consulenti={consultants}
                archivio={filtro === "completate"}
                onApri={apriScheda}
                onProgramma={apriProgrammazione}
                onStato={(l, st) => void cambiaStato(l, st)}
                onManutenzione={apriManutenzione}
                onCopia={copiaRiepilogo}
              />
            </Fragment>
          ))}
        </>
      )}

      {/*  Le finestre degli stati: una per la pagina, non una per riga.
           `chiusura.finestra` scrive stato, importi e consegna insieme;
           QuickStatusDialog chiede il giorno o gli importi quando servono. */}
      <QuickStatusDialog
        open={quickAperta}
        onOpenChange={setQuickAperta}
        lead={quickLead}
        newStatus={quickStato}
      />
      {chiusura.finestra}

      <LeadDialog open={schedaAperta} onOpenChange={setSchedaAperta} lead={leadAperto} />
      <InstallationScheduleDialog
        open={programmaAperto}
        onOpenChange={setProgrammaAperto}
        lead={leadDaProgrammare}
      />
      <ManutenzioneDialog
        open={manutenzioneAperta}
        onOpenChange={setManutenzioneAperta}
        lead={leadManutenzione}
      />
      {/*  Il foglio delle pose: si legge riga per riga e non si importa niente
          finché non lo si dice — vedi crm/FinestraCsvInstallazioni. */}
      <FinestraCsvInstallazioni aperta={csvAperto} onCambio={setCsvAperto} leads={leads} />
      <NuovaPosaDialog
        aperta={nuovaPosaAperta}
        onCambio={setNuovaPosaAperta}
        onCreato={(l, tipo) =>
          tipo === "manutenzione" ? apriManutenzione(l) : apriProgrammazione(l)
        }
      />
    </Pagina>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. IL BLOCCO IN CIMA — le pose messe avanti a mano
   ═════════════════════════════════════════════════════════════════════════ */

/** ── «DA ANTICIPARE» ──────────────────────────────────────────────────────
 *  Il solo blocco che non è una giornata: raccoglie le pose che qualcuno ha
 *  deciso di portare avanti e che un giorno non ce l'hanno ancora. Ha la forma
 *  di tutti gli altri — stessa scheda, stesse righe — perché non è una pagina a
 *  parte: è lo stesso elenco, con quattro righe tirate fuori dal fondo.
 *
 *  ⚠️ NON RENDE NIENTE QUANDO È VUOTO, ed è la regola che lo tiene onesto: una
 *  scheda «Da anticipare (0)» in cima a ogni lente insegnerebbe a saltare la
 *  prima scheda della pagina — e la prima scheda della pagina è quella che
 *  qualcuno ha chiesto di guardare per prima.
 *
 *  La nota dice due cose e nessuna delle due è decorativa: che queste righe
 *  sono state messe qui A MANO (quindi si possono togliere, e da dove), e che
 *  il giorno scritto accanto al nome è quello che VORREBBE il cliente — non un
 *  appuntamento. È l'unico posto della pagina in cui la differenza fra le due
 *  date si può scrivere per esteso senza rubare spazio a una riga. */
function GruppoDaAnticipare({
  items,
  consulenti,
  onApri,
  onProgramma,
  onStato,
  onManutenzione,
}: {
  items: Lead[];
  consulenti: Consultant[];
  onApri: (l: Lead) => void;
  onProgramma: (l: Lead) => void;
  /** Cambia lo stato del cliente: la pipeline sta nella pagina. */
  onStato: (l: Lead, s: LeadStatus) => void;
  onManutenzione: (l: Lead) => void;
}) {
  if (items.length === 0) return null;
  const chieste = items.filter((l) => !!l.data.installazione?.dataDesiderata).length;

  return (
    <Scheda
      className="border-violet-300 ring-1 ring-violet-200"
      icona={ArrowUpToLine}
      titolo="Da anticipare"
      nota={
        <>
          {items.length} {items.length === 1 ? "posa messa" : "pose messe"} in cima a mano · il
          giorno non è ancora fissato
          {chieste > 0 && " · «vorrebbe il…» è la data chiesta dal cliente, non un appuntamento"}
        </>
      }
      azioni={
        <Chip tono="neutro" className="border-violet-300 bg-violet-50 text-violet-700">
          Si toglie dal pulsante ↑ della riga
        </Chip>
      }
      senzaPadding
      classeCorpo="divide-y divide-border"
    >
      {items.map((l) => (
        <RigaInstallazione
          key={l.id}
          lead={l}
          tecnico={nomeTecnico(l, consulenti)}
          driver={nomeDriver(l, consulenti)}
          //  Chi affianca si risolve QUI insieme al driver, e per lo stesso
          //  motivo: sono due nomi che l'elenco dei consulenti sa già dare, e
          //  farli cercare alla riga vorrebbe dire passarle un secondo elenco.
          accompagnatore={nomeAccompagnatore(l, consulenti)}
          //  Qui dentro non ci sono pose di oggi: ci finisce solo chi un giorno
          //  non ce l'ha. Il cartellino OGGI sarebbe una promessa falsa.
          oggi={false}
          onApri={onApri}
          onProgramma={onProgramma}
          onStato={onStato}
          onManutenzione={onManutenzione}
        />
      ))}
    </Scheda>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. IL BLOCCO DI UNA GIORNATA
   ═════════════════════════════════════════════════════════════════════════ */

function GruppoGiorno({
  giorno,
  items,
  consulenti,
  archivio,
  onApri,
  onProgramma,
  onStato,
  onManutenzione,
  onCopia,
}: {
  /** "" = nessuna data ancora fissata */
  giorno: string;
  items: Lead[];
  consulenti: Consultant[];
  /** true = si sta guardando l'archivio delle pose completate: qui non c'è più
   *  niente da recuperare, conta solo cosa è entrato */
  archivio?: boolean;
  onApri: (l: Lead) => void;
  onProgramma: (l: Lead) => void;
  /** Cambia lo stato del cliente: la pipeline sta nella pagina. */
  onStato: (l: Lead, s: LeadStatus) => void;
  /** apre la procedura del ritorno per la manutenzione: serve solo alle pose
   *  già chiuse, ma la riga la riceve sempre — è lei a sapere se è il caso */
  onManutenzione: (l: Lead) => void;
  onCopia: (giorno: string, items: Lead[]) => void;
}) {
  const oggi = giorno === giornoISO();
  const scartoRaw = giorno ? giorniDaOggi(giorno) : 0;
  //  Data illeggibile = nessuno scarto da mostrare, non "oggi".
  const scarto = Number.isNaN(scartoRaw) ? 0 : scartoRaw;
  const totale = totaleDaIncassare(items);
  const entrato = totaleIncassato(items);
  //  "In ritardo" è un giudizio, non una data: lo è solo se quel giorno è
  //  passato E c'è ancora qualcosa di aperto.
  const aperte = items.filter((l) => !posaCompletata(l)).length;
  const inRitardo = !archivio && !!giorno && scarto < 0 && aperte > 0;

  return (
    <Scheda
      className={cn(oggi && "border-sky-300 ring-1 ring-sky-200")}
      icona={archivio ? CheckCircle2 : giorno ? CalendarClock : CalendarPlus}
      titolo={
        <span className="flex items-center gap-2">
          {giorno ? formatDate(giorno) : archivio ? "Senza data di posa" : "Data da fissare"}
          {oggi && <BadgeOggi />}
        </span>
      }
      nota={
        archivio
          ? `${items.length} ${items.length === 1 ? "posa completata" : "pose completate"} · ${
              entrato > 0 ? `${eur(entrato)} incassati` : "nessun incasso registrato"
            }`
          : `${items.length} ${items.length === 1 ? "posa" : "pose"} · ${
              totale > 0 ? `${eur(totale)} da incassare` : "niente da incassare"
            }`
      }
      azioni={
        <>
          {inRitardo && (
            <Chip tono="in_sospeso" punto>
              Passata da {-scarto} {-scarto === 1 ? "giorno" : "giorni"}
            </Chip>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11.5px]"
            onClick={() => onCopia(giorno, items)}
            title="Copia l'elenco del giorno da incollare all'installatore"
          >
            <ClipboardList className="mr-1 h-3.5 w-3.5" /> Copia
          </Button>
        </>
      }
      senzaPadding
      classeCorpo="divide-y divide-border"
    >
      {items.map((l) => (
        <RigaInstallazione
          key={l.id}
          lead={l}
          tecnico={nomeTecnico(l, consulenti)}
          //  Il nome si risolve QUI, dove l'elenco dei consulenti c'è già: la
          //  riga riceve una stringa e non deve cercare nessuno, come fa da
          //  sempre per il tecnico.
          driver={nomeDriver(l, consulenti)}
          //  Stessa porta e stesso posto per chi affianca: il segno del driver
          //  da solo raccontava metà della squadra che esce quel giorno.
          accompagnatore={nomeAccompagnatore(l, consulenti)}
          oggi={oggi}
          onApri={onApri}
          onProgramma={onProgramma}
          onStato={onStato}
          onManutenzione={onManutenzione}
        />
      ))}
    </Scheda>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. LA RIGA — CHI · QUANDO · QUANTO RESTA · COSA MANCA
   ═════════════════════════════════════════════════════════════════════════ */

/** Una riga = una posa, e porta CINQUE elementi in tutto: il nome, la riga di
 *  servizio (quando · dove · chi va), l'eventuale riga degli avvisi, la scatola
 *  dell'importo e il gruppo di comandi. Prima ne portava una quindicina, fra
 *  pastiglie di stato, avvisi, contatori dei materiali e sei pulsanti.
 *
 *  La stessa riga serve anche a chi non ha ancora una data: cambia la parola del
 *  "quando" (l'attesa al posto dell'orario) e il comando principale diventa
 *  "Programma". Due componenti diversi avrebbero significato due posti in cui
 *  aggiungere ogni comando nuovo. */
function RigaInstallazione({
  lead,
  tecnico,
  driver,
  accompagnatore,
  oggi,
  onApri,
  onProgramma,
  onStato,
  onManutenzione,
}: {
  lead: Lead;
  tecnico: string;
  /** il nome di chi dà il passaggio, "" se ci va da solo: il segno del driver è
   *  l'unico modo di sapere DALL'ELENCO che quel giorno escono in due */
  driver: string;
  /** il nome di chi va a posare INSIEME all'installatore, "" se posa da solo.
   *  ⚠️ Non è il driver e non lo sostituisce: una posa può avere tutti e due, e
   *  in quel caso sulla riga si vedono due pastiglie perché quel pomeriggio le
   *  agende occupate sono davvero tre (vedi la nota su `accompagnatoreDi`). */
  accompagnatore: string;
  /** la riga appartiene alla giornata di oggi: il badge va anche qui, non solo
   *  sull'intestazione — scorrendo un elenco lungo l'intestazione esce di campo */
  oggi: boolean;
  onApri: (l: Lead) => void;
  onProgramma: (l: Lead) => void;
  /** Cambia lo stato del cliente: la pipeline sta nella pagina. */
  onStato: (l: Lead, s: LeadStatus) => void;
  onManutenzione: (l: Lead) => void;
}) {
  const inst = lead.data.installazione;
  const conData = !!inst?.dataInstallazione;
  const attesa = giorniDiAttesa(lead);
  const completata = posaCompletata(lead);
  const materiale = avvisoMateriale(lead);
  //  A posa fatta niente è più "da fare": l'ambra su una pratica chiusa la
  //  rimetterebbe fra i problemi solo perché l'orario non era stato scritto.
  const daAssegnare = senzaTecnico(lead) && !completata;
  //  Una posa a domicilio si legge come le altre — sta nello stesso elenco, nei
  //  conteggi e nella giornata del tecnico — ma chi la prepara deve sapere che
  //  si esce, e che
  //  senza indirizzo non si esce affatto. Due parole nella riga di servizio,
  //  ambra solo quando l'indirizzo manca davvero.
  const casa = aDomicilio(lead);
  const senzaIndirizzo = casa && !haIndirizzo(lead) && !completata;

  //  QUANDO: l'orario se c'è (il giorno lo dice già l'intestazione del blocco),
  //  altrimenti da quanto tempo questa pratica sta aspettando — che è il motivo
  //  per cui sta in cima alla coda.
  const quando = conData
    ? inst?.orarioInstallazione || "orario da fissare"
    : attesa === null
      ? "in attesa di una data"
      : attesa === 0
        ? "in attesa da oggi"
        : `in attesa da ${attesa} ${attesa === 1 ? "giorno" : "giorni"}`;
  /*  ── ⚠️ L'AMBRA SOLO DOVE DICE QUALCOSA ────────────────────────────────
      Il "quando" era ambra ogni volta che mancava la data O l'ora. Sembra
      giusto, e nell'elenco «Da programmare» era un disastro: LÌ NON HA LA
      DATA NESSUNO — è il criterio con cui quelle righe stanno in quella lista
      — quindi ogni riga usciva ambra. Dieci righe ambra di fila non sono
      dieci avvisi: sono uno sfondo, e da quel momento l'ambra non segnala più
      niente nemmeno dove servirebbe davvero (l'installatore mancante,
      l'indirizzo, il materiale).
      Adesso l'attesa è inchiostro neutro — è un fatto, non un buco — e l'ambra
      resta all'ORA che manca su una posa che una data ce l'ha già: quello sì
      è un passaggio a metà. */
  const quandoManca = conData && !inst?.orarioInstallazione && !completata;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 hover:bg-muted/40">
      {/* CHI · QUANDO · COSA MANCA */}
      <div className="min-w-0 flex-1 basis-[12rem]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onApri(lead)}
            /*  `t-riga`: 15 sul telefono, 13 sul monitor — la scala sta in
                styles.css, con il perché. Il nome è quello per cui si guarda
                l'elenco, e a 13 pesava come la riga di servizio sotto. */
            className="t-riga truncate font-semibold hover:underline"
          >
            {nomeCompleto(lead)}
          </button>
          {oggi && <BadgeOggi />}
          {/*  IL CARTELLINO DELLA PRIORITÀ, con accanto il giorno che vorrebbe
              il cliente. Sta subito dopo il nome e prima di tutti gli altri
              segni perché è l'unica cosa che spiega PERCHÉ questa riga è dove
              è: senza, una posa in cima all'elenco sembra un ordinamento
              rotto. Vedi crm/PrioritaPosa. */}
          <SegnoPriorita lead={lead} />
          {completata && (
            <CheckCircle2
              className="h-3.5 w-3.5 shrink-0 text-emerald-600"
              aria-label="Completata"
            />
          )}
          {/*  IL FOGLIETTO DELLE NOTE — passando sopra (o toccandolo sul
              telefono) si leggono TUTTE le note del lead, la più recente in
              alto. Sta accanto al nome, a sinistra, per due motivi: il riquadro
              si apre da lì verso destra e non finisce sopra l'importo e i
              comandi, e compare solo dove ci sono note — quindi dice anche
              quali righe hanno qualcosa da leggere. */}
          <SegnoNote lead={lead} />
          {/*  IL SEGNO DEL DRIVER, accanto al nome e non in fondo alla riga di
              servizio: dice che quella posa impegna DUE persone, ed è
              l'informazione che cambia come si riempie il resto della giornata.
              Sta fuori dalla scheda apposta — prima si poteva sapere solo
              aprendo la finestra della programmazione. */}
          <SegnoDriver nome={driver} />
          {/*  IL SEGNO DI CHI AFFIANCA, subito dopo quello del driver e non al
              posto suo: sono due persone in due mestieri diversi, e una posa
              può averle tutte e due. Manca da qui era il buco più caro
              dell'elenco — «Driver · Marco» faceva leggere «escono in due»
              anche quando a uscire erano in tre, e la terza agenda risultava
              libera a chi programmava il resto della giornata. */}
          <SegnoAccompagnatore nome={accompagnatore} />
          {/*  IL PORTAFOGLIO DEL CLIENTE — le foto e i video dell'installazione.
              Sta in fondo alla fila del nome e non davanti per un motivo
              pratico: è l'unico elemento con un'immagine dentro, e messo prima
              farebbe cominciare ogni riga con un rettangolo invece che con un
              nome, che è il dato con cui questo elenco si legge e si cerca.
              ⚠️ Il riquadro c'è ANCHE quando non c'è ancora niente (tratteggiato,
              con un «+»): così la prima foto si carica da qui, e tutte le righe
              restano alte uguali invece di ballare a seconda del cliente. */}
          <SegnoMedia lead={lead} />
        </div>
        {/*  QUANDO · DOVE · CHI CI VA, in una riga sola. Ogni cosa mancante è
            ambra dove si legge: l'orario nel "quando", il tecnico al posto del
            nome. Prima lo stesso buco era detto due volte — "orario da fissare"
            qui e "Manca: orario" nella riga sotto. */}
        <div className="t-nota truncate text-muted-foreground">
          <span
            className={cn(
              "font-medium tabular-nums",
              quandoManca ? "text-amber-700" : "text-foreground",
            )}
          >
            {quando}
          </span>
          {lead.data.citta && ` · ${lead.data.citta}`}
          {" · "}
          <span className={cn(daAssegnare && "text-amber-700")}>
            {daAssegnare ? "installatore da assegnare" : tecnico}
          </span>
          {casa && (
            <span className={cn(senzaIndirizzo && "text-amber-700")}>
              {senzaIndirizzo ? " · a domicilio, manca l'indirizzo" : " · a domicilio"}
            </span>
          )}
        </div>
        {/*  L'UNICO AVVISO CHE NON HA UN POSTO SUO: lo stato del materiale. È un
            segno — un punto ambra e due parole — non una pastiglia grande come
            un pulsante: da pastiglia si leggeva per prima, ed è l'ultima cosa da
            fare. Si sistema dal menu «…». */}
        {materiale && (
          <div
            className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-snug text-amber-700"
            title="Lo stato del materiale si cambia dal menu «…»"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span className="truncate">{materiale}</span>
          </div>
        )}
        {/*  ── LA FATTURA CHE MANCA ────────────────────────────────────────
            ⚠️ È UNA PASTIGLIA E NON UN SEGNO come quello del materiale qui
             sopra, ed è voluto: il materiale è una cosa da fare, questa sono
             soldi già incassati senza un documento. E soprattutto SI CLICCA —
             apre la stessa finestra di composizione della scheda cliente, coi
             dati del cliente già dentro — quindi deve avere l'aria di un
             comando, non di una nota.
            Compare solo quando c'è davvero da fatturare e la fattura non c'è
             già: vedi BadgeDaFatturare, che decide da sé quando tacere. */}
        <BadgeDaFatturare lead={lead} className="mt-1" />
      </div>

      {/*  ── ⚠️ A POSA FATTA IL RIQUADRO DELL'INCASSO SPARISCE ──────────────
          Richiesta del committente: quando l'ordine è completato deve restare
          solo «Speso in tutto», coi costi e il netto sotto.
          Non è una preferenza di stile: a saldo chiuso quel riquadro diceva
          «già versato 650 · totale 650 · resta 0», cioè tre caselle per
          ripetere una cifra che il blocco qui sotto scriveva già — e la sola
          cosa che aggiungeva, «resta 0», è l'informazione meno utile che si
          possa dare su una pratica finita.
          ⚠️ SPARISCE SOLO DOVE C'È L'ALTRO. Nella giornata dell'installatore e
           nei pacchi da spedire `SoldiPosa` resta l'unico blocco dei soldi, e
           là continua a comparire col suo conto (vedi la nota su `SoldiPosa`
           in crm/InstallationScheduleDialog): toglierlo lascerebbe quelle
           schermate senza nessun numero. */}
      {!posaCompletata(lead) && <ImportoRiga lead={lead} />}

      {/*  ── QUANTO HA SPESO IN TUTTO, SOLO SULLE POSE FATTE ────────────────
          Richiesta del committente. Compare a posa COMPLETATA e non prima, ed
          è una scelta: finché l'impianto non è addosso al cliente il numero
          che serve è «quanto resta da incassare» — quello accanto — e due
          cifre in euro sulla stessa riga, una che sale e una che scende, si
          leggono l'una per l'altra proprio nel momento in cui si sta per
          incassare. Da posa fatta invece la domanda cambia: quella pratica è
          chiusa, e quello che conta è quanto vale il cliente.
          Il conto — impianto, acquisti, manutenzioni fatte — lo compone
          crm/acquisti.ts; premendolo si aggiunge cosa ha comprato. */}
      {posaCompletata(lead) && <SpesaTotale lead={lead} className="sm:shrink-0" />}

      {/*  I COMANDI — due visibili, il resto dietro "…".
          ⚠️ Senza indirizzo una posa a domicilio non si chiude NEMMENO DA QUI.
          Il blocco c'era solo nella scheda «A domicilio», che è una lente a un
          clic di distanza sulla stessa pagina: la stessa pratica si chiudeva
          da "Oggi" e non da «A domicilio», cioè il blocco era una decorazione.
          Il motivo dice DOVE si rimedia, perché in questa riga il campo
          dell'indirizzo non c'è. */}
      {/*  IL RITORNO ALLO STATO DI PRIMA sta anche qui, non solo nelle due
          schede della consegna: la riga sbagliata si incontra guardando "Oggi"
          o "In ritardo", ed è lì che ci si accorge che una pratica è finita
          nello stato sbagliato. Stesso gruppo e stessa posizione delle altre
          due righe — a sinistra del comando principale.
          ⚠️ Da qui una pratica può anche ENTRARE in una delle due schede della
          consegna: tornando a «A domicilio» o «Da spedire» la riga si sposta
          là, perché quelle schede guardano il modo di consegna e il ritorno
          indietro adesso lo porta con sé (crm/TornaIndietroPosa). Il messaggio
          dice in quale scheda è finita: una riga che sparisce dall'elenco senza
          spiegazione la si cerca per mezz'ora. */}
      <div className="flex shrink-0 items-center gap-1">
        {/*  ── IL DOPO ─────────────────────────────────────────────────────
            Compare SOLO su una posa completata, ed è l'unico momento in cui il
            gesto ha senso: prima non c'è niente da far tornare, il cliente
            l'impianto non ce l'ha addosso. Se un ritorno è già in programma, al
            posto del pulsante si legge quando cade — vedi BottoneManutenzione,
            che decide da sé quale delle due cose mostrare. */}
        {completata && <BottoneManutenzione lead={lead} onFissa={onManutenzione} />}
        {/*  ── IL FOGLIO DA DARE AL CLIENTE ────────────────────────────────
            Solo a posa fatta, come «Manutenzione» qui accanto: prima non c'è
            niente da riepilogare. Porta la parola e non solo l'icona, e lo
            spazio c'è perché su una riga completata «Anticipa» non compare —
            non resta niente da portare avanti. */}
        {completata && <TastoRicevuta lead={lead} esteso />}
        {/*  ── LA FATTURA, DALLA RIGA ──────────────────────────────────────
            Richiesta del committente: emetterla da qui, scegliendo se è
            l'acconto o l'importo intero.
            ⚠️ NON è legata alla posa completata come «Riepilogo» qui accanto:
             una fattura nasce con l'INCASSO, e il primo incasso è l'acconto —
             settimane prima che l'impianto sia addosso a qualcuno. Il pulsante
             decide da sé se comparire (vedi TastoFattura): serve una cifra da
             fatturare, non una posa finita. */}
        {/*  ⚠️ SOLO ICONA IN QUESTO ELENCO. Con la parola erano tre pulsanti
            di testo per riga — «Fattura», «Anticipa», «Programma» — e su venti
            righe diventano sessanta parole in colonna che si contendono
            l'attenzione col nome del cliente e con la cifra. Qui il comando
            che questa lista chiede è UNO, «Programma»: è l'unico che tiene la
            parola e il colore pieno. Gli altri restano raggiungibili con un
            tocco e si spiegano al passaggio del dito. */}
        <TastoFattura lead={lead} />
        {/*  ── ANTICIPA ────────────────────────────────────────────────────
            Il comando che porta questa posa in cima, e che la rimanda nel suo
            turno. Sta per primo nel gruppo — cioè il più lontano dal comando
            principale — perché non fa niente alla pratica: cambia solo dove si
            legge. Premuto per sbaglio non chiude, non incassa e non sposta un
            appuntamento, e si disfa dallo stesso pulsante. */}
        <TastoPriorita lead={lead} />
        <TornaIndietroPosa lead={lead} />
        <AzioniInstallazione
          lead={lead}
          onApri={onApri}
          onProgramma={onProgramma}
          onStato={onStato}
          bloccata={
            senzaIndirizzo ? "Manca l'indirizzo: scrivilo nella scheda «A domicilio»" : undefined
          }
        />
      </div>
    </div>
  );
}
