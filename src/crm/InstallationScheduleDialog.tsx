/** ── IL MODULO INSTALLAZIONE ───────────────────────────────────────────────
 *
 *  COSA C'È QUI DENTRO
 *  Due cose che devono restare attaccate: la finestra con cui si PROGRAMMA una
 *  posa (data, ora, tecnico, materiali) e i comandi con cui la si GOVERNA giorno
 *  per giorno (importo da incassare, saldo, stato del materiale, completata).
 *
 *  PERCHÉ NON STANNO PIÙ NELLA PAGINA
 *  Stavano dentro /CRM/installazioni, cioè dentro un file di rotta. Ma la stessa
 *  installazione si controlla da DUE posti — la riga dell'elenco e la scheda del
 *  cliente — e la scheda del cliente non può importare una pagina per avere un
 *  pulsante. Finché è stato così, la scheda ha avuto comandi propri, con parole
 *  proprie: "acconto" di là, "saldo" di qua, e due modi diversi di dire che la
 *  posa era fatta. Adesso il comando è UNO e vive qui, in un componente: chi lo
 *  monta — elenco, giornata del tecnico, scheda cliente — mostra lo stesso
 *  aspetto e scrive gli stessi campi.
 *
 *  LE PAROLE, UNA VOLTA SOLA
 *  Alla consegna si ritira il SALDO: prezzo di vendita meno quanto è già stato
 *  incassato. La parola "acconto" non compare nelle installazioni — lì l'acconto
 *  è in cassa da settimane e non è il numero che serve: si scrive "importo da
 *  incassare in attesa", che è ciò che il tecnico deve ritirare.
 *  ───────────────────────────────────────────────────────────────────────── */
//  `ComponentType` serve solo a tipare l'icona che ogni passo della procedura
//  si porta dietro: è lo stesso tipo che chiedono le sezioni di crm/ui/Finestra.
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
//  Serve solo al riquadro del vicolo cieco qui sotto: quando in «Chi la esegue»
//  non c'è nessuno, la finestra non si limita a dirlo — porta nella pagina in
//  cui si ripara (SenzaInstallatori).
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { totaleCostiPratica } from "./costi-pratica";
import { dataChiusura } from "./kpi-netto";
import { leggiEuro, scriviEuro } from "./euro";
import { canaleDopoIncasso, divisioneMovimento, ripartisciCanale } from "./canale-incasso";
import { FinestraConto } from "./FinestraConto";
import { FinestraCosti } from "./FinestraCosti";
import { CostiCollassabili } from "./CostiCollassabili";
import { formatDate } from "@/lib/date-format";
import { useCRM } from "./CRMContext";
//  «Può aprire l'anagrafica?» — serve a non offrire un pulsante che porta a una
//  pagina che dirà di no. Nasconde, non difende: il no vero lo dà la guardia
//  della rotta (permessi.ts).
import { usePuo } from "./AuthContext";
import {
  STRADA_ACCOMPAGNATORE,
  STRADA_DRIVER,
  generateAvailability,
  liberoNellaFascia,
} from "./booking-utils";
//  ⚠️ «Fa l'installatore», «fa l'accompagnatore» e «fa il driver» NON sono
//  permessi e non stanno in crm/permessi.ts: quel file risponde a «cosa può
//  toccare» ed è una scala su cui si sale. Chi posa, chi affianca e chi guida
//  fanno un MESTIERE, come setter e consulente, e vivono dove vivono già quelli
//  — sulla scheda del consulente, letti da mestieriDi(). Un elenco di ruoli in
//  due posti è esattamente ciò che qui si è deciso di non avere.
import { etichettaMestieri, mestieriDi } from "./kpi-setter";
import { buildWhatsAppLink } from "./whatsapp";
import { toast } from "sonner";
import {
  CHECKLIST_DEFAULT_BY_TYPE,
  LEAD_STATUS_LABEL,
  MODO_CONSEGNA_DA_STATO,
  eChiusuraVinta,
  fasePer,
  posaFatta,
  statiPer,
  type ChecklistItem,
  type Consultant,
  type InstallazioneInfo,
  type Lead,
  type LeadData,
  type PaymentInfo,
  type LeadStatus,
  type StatoOrdine,
  type TipoInstallazione,
  type VoceCosto,
} from "./types";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  CalendarPlus,
  Car,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Euro,
  House,
  ListChecks,
  MessageCircle,
  MoreHorizontal,
  Percent,
  Phone,
  Plus,
  StickyNote,
  Truck,
  Trash2,
  UserPlus,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
//  ⚠️ `tipoDaAllineare` è la regola che dice quale `tipoInstallazione` corrisponde
//  a un modo di consegna. Si importa invece di riscriverla qui: da quando questa
//  finestra non chiede più il tipo a mano, il valore che scrive deve essere lo
//  STESSO che scrivono la chiusura e il menu «Come arriva al cliente» — due
//  risposte alla stessa domanda sono esattamente il guasto che si sta togliendo.
import { modoConsegna, spedizioneDi, tipoDaAllineare, useAzioniSpedizione } from "./spedizione";
//  La regola dell'IVA — il conto e i tre riquadri della domanda — sta in un
//  file suo: la stessa scelta si fa qui, sull'acconto e alla chiusura della
//  vendita, e una regola scritta in tre punti diverge al primo ritocco.
import {
  ALIQUOTA_IVA,
  MODO_IVA_PREDEFINITO,
  ScegliIva,
  conIvaBool,
  contoIva,
  modoDaBooleano,
  type ModoIva,
} from "./iva";
import { noteDelLead, type NotaLead } from "./import-backup";
import {
  CLASSE_BADGE_STATO,
  Chip,
  CLASSI_TONO,
  PUNTO_TONO,
  Segmento,
  TESTO_TONO,
  classiStato,
  dataBreve,
  eur,
  soloData,
  type Tono,
  giorniDaOggi,
} from "./ui";
import {
  CampoFinestra,
  CLASSE_AREA,
  CLASSE_CAMPO,
  DatoFinestra,
  Finestra,
  KpiFinestra,
  NotaFinestra,
  Pannello,
  Pillola,
  SezioneFinestra,
  VoceScelta,
  VuotoFinestra,
} from "./ui/Finestra";

/* ═══════════════════════════════════════════════════════════════════════════
   1. IL GIORNO — una sola definizione di "oggi"
   ═════════════════════════════════════════════════════════════════════════ */

/** Data locale in formato ISO (AAAA-MM-GG).
 *  NON si usa `toISOString()`: lavora in UTC e fino alle 2 di notte italiane
 *  restituisce IERI — le pagine si aprivano sul giorno sbagliato proprio nelle
 *  ore in cui si prepara la giornata dopo. */
export function giornoISO(scarto = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + scarto);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const gg = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${gg}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. IL DENARO — una sola definizione di "quanto manca"
   ═════════════════════════════════════════════════════════════════════════ */

/** Il prezzo su cui si fanno i conti. `prezzoFinaleVendita` è quello trattato;
 *  se manca si ripiega sul totale di listino, esattamente come fa la scheda del
 *  lead — due numeri diversi per lo stesso cliente sono un errore che si scopre
 *  solo alla consegna. */
//  ⚠️ `prezzoVendita`, `giaIncassato` e `saldoAllaConsegna` sono passate in
//   `costi-pratica`, che è puro e quindi si può mettere alla prova: sono regole
//   di denaro, e da qui non erano raggiungibili senza tirarsi dietro React e
//   tutta questa finestra. Si ri-esportano perché nessuno debba cambiare import.
import {
  altriCosti,
  giaIncassato,
  nuovoIdVoce,
  prezzoScontato,
  prezzoVendita,
  saldoAllaConsegna,
} from "./costi-pratica";
export { giaIncassato, prezzoVendita, saldoAllaConsegna };

/** ── ASPETTA CHE QUALCUNO LE FISSI UNA DATA ────────────────────────────────
 *  Un impianto pagato e senza un giorno in calendario. È la regola della lente
 *  «Senza data» di /CRM/installazioni, e da qui la legge anche il badge «Da
 *  programmare» della barra laterale.
 *
 *  ⚠️ STA IN UN POSTO SOLO PERCHÉ DUE COPIE AVEVANO GIÀ DIVERSO. Riscritta
 *   nella barra come «lo stato è una chiusura vinta», dava 10 dove la pagina ne
 *   mostrava 11: manca chi ha VERSATO un acconto senza che lo stato sia ancora
 *   una delle tre pose — e quello, per chi programma il calendario, è un
 *   impianto pagato esattamente come gli altri. Un badge che dice una cifra e
 *   la pagina che ne dice un'altra fa smettere di credere a tutti e due.
 *
 *  ⚠️ Il pagamento conta quanto lo stato, e non è un di più: metà delle schede
 *   arrivate da un'importazione hanno l'acconto scritto e lo stato fermo a
 *   prima della vendita. Guardando solo lo stato resterebbero invisibili
 *   proprio a chi deve chiamarle per fissare la posa. */
export function aspettaUnaData(l: Lead | null | undefined): boolean {
  const d = l?.data;
  if (!d) return false;
  if (d.installazione?.dataInstallazione) return false;
  if (fasePer(d.stato) === "persa") return false;
  if (d.stato === "concluso" || d.stato === "perdi_tempo") return false;
  return eChiusuraVinta(d.stato) || giaIncassato(l as Lead) > 0;
}

/** C'è una cifra da mostrare? Non è "il prezzo esiste": una pratica d'archivio
 *  senza prezzo ma con un residuo è un importo perfettamente definito. Serve a
 *  non far comparire l'avviso "Importo da definire" su righe che l'importo ce
 *  l'hanno, e a non far leggere un "€ 0" come "già pagato". */
export function importoDefinito(l: Lead): boolean {
  return prezzoVendita(l) > 0 || saldoAllaConsegna(l) > 0;
}

/** Il totale in attesa su un insieme di pratiche: è il numero che serve a chi
 *  organizza la giornata e a chi chiude la cassa la sera. */
export function totaleDaIncassare(items: Lead[]): number {
  return items.reduce((somma, l) => somma + saldoAllaConsegna(l), 0);
}

/** ── L'IVA SI SCRIVE, NON SI DEDUCE ───────────────────────────────────────
 *  Chi calcola il netto ha bisogno di sapere se QUELL'INCASSO comprendeva
 *  l'IVA e con quale aliquota. Finora restava solo `payment.costi.ivaInclusa`,
 *  un interruttore buono per il margine ma muto sull'aliquota e senza data:
 *  a fine trimestre non si poteva più dire quando e su quanto era stato
 *  applicato. Da qui in poi l'incasso del saldo lascia una riga esplicita.
 *
 *  Il campo vive dentro `payment` e si chiama `incassoSaldo`. Non sta in
 *  types.ts perché quel file è di un'altra mano: qui il tipo è dichiarato e
 *  esportato, così chi calcola il netto lo importa invece di riscriverlo. */
/** ⚠️ L'ALIQUOTA NON È PIÙ DEFINITA QUI. Sta in crm/iva, insieme al conto e
 *  alla domanda a schermo, perché la stessa domanda si fa in altre due finestre
 *  (l'acconto e la chiusura della vendita) e tre copie del ventidue per cento
 *  divergono al primo ritocco. Si ri-esporta perché mezzo CRM la importa da
 *  questo file: il valore resta uno solo, cambia solo dove è scritto. */
export { ALIQUOTA_IVA } from "./iva";

export interface IncassoSaldo {
  /** true = la cifra incassata comprende l'IVA (va scorporata nel netto) */
  conIva: boolean;
  /** ── COME CI STAVA DENTRO L'IVA ────────────────────────────────────────
   *  `conIva` dice SE c'era, questo dice COME: aggiunta al prezzo pattuito
   *  (e allora il totale è salito del 22%), già compresa, oppure niente.
   *  ⚠️ Facoltativo perché gli incassi registrati prima che i modi fossero tre
   *   non ce l'hanno: là c'era solo il sì/no, e `modoDaBooleano` in crm/iva sa
   *   ricavarne le due vecchie risposte. Mai «aggiunta» da un archivio — quella
   *   scelta cambia il totale, e quel totale è già scritto. */
  modoIva?: ModoIva;
  /** aliquota applicata in percentuale: 22 con IVA, 0 senza */
  aliquotaIva: number;
  /** quanto è stato incassato in quel momento (il saldo, non il totale) */
  importo: number;
  /** quanto ha versato in tutto il cliente su questa pratica, dopo l'incasso */
  totaleIncassato: number;
  /** giorno dell'incasso (AAAA-MM-GG) */
  data: string;
}

/** `payment` con la riga dell'incasso. Serve per SCRIVERE senza toccare
 *  types.ts: un letterale con una proprietà in più verrebbe rifiutato, una
 *  variabile tipizzata così no. */
export type PagamentoConIncasso = PaymentInfo & { incassoSaldo?: IncassoSaldo };

/** La riga dell'incasso, se c'è. L'archivio importato può avere qualsiasi cosa
 *  in quel campo (una stringa, un numero, null): si controlla la forma prima di
 *  leggerla, altrimenti basta una scheda vecchia per abbattere l'elenco. */
export function incassoRegistrato(l: Lead): IncassoSaldo | null {
  const v = (l.data.payment as PagamentoConIncasso | undefined)?.incassoSaldo;
  if (!v || typeof v !== "object" || typeof v.conIva !== "boolean") return null;
  return v;
}

/** Quanto ha speso il cliente negli acquisti già registrati in scheda.
 *  `acquistiDettaglio` negli archivi importati non è sempre un array: senza il
 *  controllo, un `.reduce()` su un oggetto fa morire la riga. */
export function spesoInAcquisti(l: Lead): number {
  const righe = l.data.acquistiDettaglio;
  if (!Array.isArray(righe)) return 0;
  return righe.reduce((somma, r) => somma + (Number(r?.importo) || 0), 0);
}

/** ── IL TOTALE CHE SI DICE AL CLIENTE ─────────────────────────────────────
 *  "Quanto ha versato in tutto?" è la domanda che si fa al telefono e alla
 *  consegna, e finora si faceva a mente sommando l'importo già in cassa e
 *  quello che il tecnico sta per ritirare. Qui è un conto solo:
 *   · versato      → quello che è già entrato
 *   · daIncassare  → quello che entra adesso
 *   · totale       → la cifra che si dice al cliente
 *   · precedenti   → gli acquisti di altre volte, tenuti SEPARATI perché sono
 *     un'altra pratica: sommarli qui gonfierebbe la cassa di oggi. */
export function totaleIncassatoCliente(l: Lead): {
  versato: number;
  daIncassare: number;
  precedenti: number;
  totale: number;
} {
  const versato = giaIncassato(l);
  const daIncassare = saldoAllaConsegna(l);
  return { versato, daIncassare, precedenti: spesoInAcquisti(l), totale: versato + daIncassare };
}

/** Quanto è già entrato su un insieme di pratiche. */
export function totaleIncassato(items: Lead[]): number {
  return items.reduce((somma, l) => somma + giaIncassato(l), 0);
}

//  ⚠️ `leggiEuro` e `scriviEuro` ABITANO IN `crm/euro.ts` e da qui si
//   riesportano soltanto. Hanno traslocato perché la finestra dei costi
//   (crm/FinestraCosti) ha bisogno di leggere gli importi come li legge questo
//   file, e questo file importa quella finestra: lasciandole qui, i due moduli
//   si sarebbero importati a vicenda. Un ciclo fra due moduli non dà un errore
//   di compilazione — dà un componente `undefined` al montaggio, cioè una
//   schermata bianca in produzione e nient'altro.
export { leggiEuro, scriviEuro } from "./euro";

/** ── QUANDO UNA POSA È "COMPLETATA" ───────────────────────────────────────
 *  Una sola definizione, usata dal chip, dall'elenco e dall'archivio: averla
 *  scritta in tre pagine significava che bastava cambiarne una per avere due
 *  archivi diversi.
 *  ⚠️ LA REGOLA NON STA PIÙ QUI: sta in `posaFatta` (crm/types.ts), e questa è
 *   solo la porta d'ingresso comoda per chi ha già un `Lead` in mano. Ha
 *   dovuto traslocare perché la stessa domanda la fa anche crm/ui.tsx per il
 *   badge «Installazioni» del menu, e ui.tsx non può importare questo file
 *   (questo importa già da ui.tsx: si chiuderebbe il cerchio). Finché la regola
 *   stava qui, l'unica strada era ricopiarla di là — e due copie della stessa
 *   riga sono il motivo per cui il badge del menu poteva contare una cosa e la
 *   pagina un'altra senza che nessuno se ne accorgesse.
 *  ⚠️ E soprattutto NON È PIÙ `stato === "venduto"`: quello resta come ripiego
 *   per l'archivio, ma da oggi la posa fatta ha un campo suo
 *   (`installazione.completataIl`). Il perché per esteso è su quel campo, in
 *   types.ts; in due righe: le tre chiusure vinte si assegnano quando il
 *   cliente COMPRA, e leggerle come "installata" manderebbe fra le pose fatte
 *   una pratica che il tecnico non ha ancora visto. */
export function posaCompletata(l: Lead): boolean {
  return posaFatta(l.data);
}

/** ── QUANDO UNA POSA È "PROGRAMMATA" ──────────────────────────────────────
 *  Vero quando la procedura «Programma installazione» ha lasciato qualcosa
 *  dietro di sé. Non basta guardare il giorno: una posa può avere il tecnico e
 *  il driver ancora senza data (succede a chi assegna prima le persone e poi
 *  cerca lo slot), e quella è già una programmazione a tutti gli effetti —
 *  l'agenda del driver, per esempio, si blocca sulla fascia solo quando c'è
 *  anche il giorno, ma il nome scritto in scheda dice comunque che qualcuno è
 *  stato impegnato su questo intervento.
 *  Serve a chi deve DISFARE la programmazione: senza questa domanda si
 *  offrirebbe «togli la posa» su pratiche che una posa non ce l'hanno mai
 *  avuta. Le note e il tipo di posa NON contano: sono lavoro di vendita, non
 *  della programmazione — vedi `senzaProgrammazione`. */
export function posaProgrammata(l: Lead): boolean {
  const inst = l.data.installazione;
  if (!inst) return false;
  return (
    !!inst.dataInstallazione ||
    !!inst.orarioInstallazione ||
    !!inst.consulenteInstallazioneId ||
    !!inst.tecnicoAssegnato ||
    //  L'accompagnatore conta quanto il driver: è una persona impegnata su
    //  questa posa, e la sua agenda si blocca come quella di chi esegue.
    !!accompagnatoreDi(l) ||
    conDriver(l) ||
    compensoDriver(l) > 0
  );
}

/** ── LA STESSA INSTALLAZIONE, SENZA LA POSA PROGRAMMATA ───────────────────
 *  Toglie i campi che scrive «Programma installazione» — giorno, ora, durata,
 *  chi la esegue, l'accompagnatore (e il nome a mano che c'era prima di lui), il
 *  driver e il suo compenso — e lascia in piedi tutto il resto.
 *
 *  ⚠️ COSA RESTA, E PERCHÉ RESTA
 *   · `spedizione` (modo, indirizzo, tracciamento): dice COME l'impianto arriva
 *     al cliente, che è una decisione presa alla vendita e non in agenda.
 *     Cancellarla qui farebbe tornare «in sede» un pacco già pronto a partire,
 *     ed è il guasto silenzioso più caro che questo CRM conosca (vedi
 *     `MODO_CONSEGNA_DA_STATO` in types.ts).
 *   · `noteInstallazione` e `tipoInstallazione`: quello che è stato detto a voce
 *     («cane in giardino», «citofono a nome della figlia») vale ancora quando la
 *     posa verrà rifissata, e riscriverlo a memoria non lo saprebbe fare
 *     nessuno.
 *   · `checklist` e `completataIl`: la prima è materiale già spuntato, il
 *     secondo è un fatto avvenuto. Un intervento fatto non si cancella
 *     togliendogli la data — chi vuole riaprirlo passa da `riapriInstallazione`.
 *
 *  Si CANCELLANO i campi invece di svuotarli con "" o 0: `senzaTecnico`,
 *  `driverDi` e l'agenda leggono l'assenza, e un campo presente ma vuoto è la
 *  stessa cosa scritta in un modo che nessuno controlla due volte. */
export function senzaProgrammazione(inst?: InstallazioneInfo | null): InstallazioneInfo {
  const resta: InstallazioneInfo = { ...(inst ?? {}) };
  delete resta.dataInstallazione;
  delete resta.orarioInstallazione;
  delete resta.durataInstallazione;
  delete resta.consulenteInstallazioneId;
  delete resta.tecnicoAssegnato;
  delete resta.accompagnatoreId;
  delete resta.driverId;
  delete resta.compensoDriver;
  return resta;
}

/** ── I TRE NUMERI DI UNA POSA, NELL'ORDINE DEL RACCONTO ───────────────────
 *
 *  GIÀ VERSATO · TOTALE · RESTA. È la sequenza con cui si spiega a voce al
 *  cliente ("ha già dato cinquecento, in tutto sono duemila, oggi ne restano
 *  millecinquecento") ed è per questo che vanno in quest'ordine: chi legge deve
 *  poter leggere ad alta voce, non ricomporre.
 *
 *  IL TERZO È QUELLO CHE CONTA
 *  RESTA è la cifra che il tecnico deve avere in testa uscendo per la consegna:
 *  è la più grande delle tre e l'unica colorata. Gli altri due restano a 13px e
 *  pieni — non sono decorazione, sono quello che si dice al cliente prima di
 *  arrivare al terzo numero.
 *
 *  COLORE = SEGNALE
 *   · ambra   → resta qualcosa da incassare, oppure il prezzo non c'è ancora:
 *     in tutti e due i casi manca un passaggio, ed è per questo che il grigio di
 *     prima sull'"Importo da definire" è sparito — grigio si legge come "niente
 *     da fare", e invece è proprio lì che c'è da fare qualcosa.
 *   · emerald → incassato tutto.
 *
 *  NIENTE ZERI FINTI
 *  Se il prezzo non è stato ancora messo, i tre numeri non compaiono affatto:
 *  un "totale € 0 · resta € 0" si legge come "già pagato" e manda un tecnico a
 *  suonare senza chiedere niente. Al loro posto compare l'avviso, che ADESSO è
 *  anche il rimedio: si preme e si scrive la cifra (FinestraImportoPosa). */
function CellaSoldi({
  etichetta,
  valore,
  nota,
  forte,
  tono,
}: {
  etichetta: string;
  valore: string;
  nota?: string;
  /** il numero che conta: più grande e colorato */
  forte?: boolean;
  tono?: Tono;
}) {
  return (
    <span className="min-w-0">
      {/*  Etichette NON maiuscole: "GIÀ VERSATO" in maiuscoletto spaziato non
          entra nella colonna e si troncherebbe in "GIÀ VERSA…" — un'etichetta
          tagliata costringe a indovinare proprio la parola che deve chiarire. */}
      <span className="block truncate text-[11px] font-medium leading-tight opacity-70">
        {etichetta}
      </span>
      <span
        className={cn(
          "block truncate tabular-nums leading-tight",
          forte
            ? cn("text-[16px] font-bold", tono && TESTO_TONO[tono])
            : "text-[13px] font-semibold opacity-90",
        )}
      >
        {valore}
      </span>
      {nota && <span className="block truncate text-[11px] leading-tight opacity-70">{nota}</span>}
    </span>
  );
}

/** Il blocco dei soldi di una posa. Uno solo, montato ovunque si parli di
 *  denaro di un'installazione — elenco, giornata del tecnico, agenda, pacchi da
 *  spedire — perché le stesse tre parole dette in quattro modi diversi
 *  costringono a rileggere ogni schermata da capo.
 *
 *  Si preme, e cosa apre dipende da cosa manca:
 *   · manca il prezzo → la finestra che lo imposta;
 *   · resta da incassare → la finestra dell'incasso (CON IVA / SENZA IVA), la
 *     stessa di sempre: qui non se ne scrive una seconda;
 *   · incassato tutto → non è un pulsante, è un riquadro da leggere. */
export function SoldiPosa({ lead, className }: { lead: Lead; className?: string }) {
  //  ⚠️ Tutti gli hook SOPRA qualunque ritorno anticipato: React li conta per
  //  posizione, e uno saltato in un render sposta tutti gli altri.
  const [incassoAperto, setIncassoAperto] = useState(false);
  const [importoAperto, setImportoAperto] = useState(false);
  const [costiAperti, setCostiAperti] = useState(false);
  const { versato, daIncassare: resta, totale } = totaleIncassatoCliente(lead);
  const definito = importoDefinito(lead);
  const conData = !!lead.data.installazione?.dataInstallazione;
  const tono: Tono = resta > 0 || !definito ? "in_sospeso" : "vinta";
  const classi = cn(
    "block w-full rounded-lg border px-2.5 py-1.5 text-left leading-tight",
    CLASSI_TONO[tono],
    className,
  );

  /* ── ⚠️ IL PREZZO NON C'È: SI SCRIVE DA QUI ─────────────────────────────
     L'avviso era solo un avviso e il rimedio stava da un'altra parte. Adesso
     l'avviso È il rimedio: un tocco e si scrive la cifra.

     ⚠️ ROSSO CHIARO E NON AMBRA, su richiesta del committente — ed è anche più
      giusto: una pratica senza prezzo non è «in attesa» come le altre, è una
      pratica su cui non si può fare niente. Non si sa quanto ritirare alla
      consegna, non si può emettere una fattura, non entra nei conti del mese.
      L'ambra la metteva accanto a «resta da incassare», che è una cosa che si
      sta svolgendo; il rosso dice che manca un dato.
     ⚠️ ROSSO CHIARO, però, e non rosso pieno: è una cosa da riempire, non un
      guasto. In un elenco di venti righe un rosso acceso urla, e quello che
      urla sempre smette di essere guardato entro mezza giornata.

     ⚠️ UNA RIGA SOLA. Erano tre bande impilate — l'etichetta, la frase, la
      nota — per dire una cosa che sta in mezza riga: manca il prezzo, premi.
      Adesso l'etichetta e la frase stanno affiancate, e quello che si è già
      incassato — se c'è — è la cella accanto, dove le cifre di questo blocco
      stanno in tutti gli altri stati. */
  if (!definito) {
    return (
      <>
        <div
          className={cn(
            "flex items-stretch divide-x divide-rose-200 overflow-hidden rounded-lg border border-rose-200 bg-rose-50/70 leading-tight text-rose-900",
            className,
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setImportoAperto(true);
            }}
            aria-haspopup="dialog"
            title={`Imposta l'importo della pratica · ${nomeCompleto(lead)}`}
            className="flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5 text-left transition hover:bg-rose-100/60"
          >
            <Euro className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13.5px] font-bold leading-tight text-rose-800">
                Importo da definire
              </span>
              <span className="truncate text-[10px] leading-tight text-rose-700/70">
                tocca per impostarlo
              </span>
            </span>
            <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden />
          </button>
          {/*  Quello che è già entrato, se è entrato: su una pratica senza
              prezzo è l'unico numero che esiste, e nasconderlo vorrebbe dire
              far credere che non abbia versato niente. */}
          {versato > 0 && (
            <span className="flex min-w-0 flex-col justify-center px-2.5 py-1">
              <span className="truncate text-[9.5px] font-semibold uppercase leading-tight tracking-wide text-rose-700/60">
                Già versato
              </span>
              <span className="text-[13px] font-semibold leading-tight tabular-nums text-rose-800/90">
                {eur(versato)}
              </span>
            </span>
          )}
        </div>
        <FinestraImportoPosa lead={lead} aperta={importoAperto} onCambio={setImportoAperto} />
      </>
    );
  }

  /* ── ⚠️ IL BLOCCO DEI SOLDI: IN RIGA, NON IN COLONNA ────────────────────
     Rifatto su richiesta del committente, con lo stesso criterio della fascia
     «Speso in tutto» (crm/SpesaCliente): largo e basso invece che stretto e
     alto. Era cinque bande impilate — i tre numeri, l'invito a premere, i
     costi — cioè un riquadro alto il triplo della riga del cliente accanto; e
     in un elenco dove ogni riga è una posa quell'altezza si moltiplica per
     venti.
     Adesso è una fascia sola: quattro celle affiancate, separate da un filo.

     ⚠️ IL «RESTA» È PIÙ GRANDE DEGLI ALTRI DUE, e non per estetica: versato e
      totale sono la premessa, «resta» è la cifra che si va a ritirare. In fila,
      senza una differenza di grandezza, l'occhio legge tre numeri qualunque e
      per sapere quale conta deve leggere le etichette.

     ⚠️ L'INVITO A PREMERE NON SI PERDE NEL PASSAGGIO. Stava su una banda tutta
      sua («Tocca per registrare l'incasso») e quella banda è sparita: al suo
      posto la riga minuta sotto la cifra, che prende lo spazio dove prima
      c'era «alla consegna». Il chevron da solo non bastava — su un telefono
      una freccia da dodici pixel non è un invito, e questo blocco l'ho reso
      premibile proprio perché nessuno se ne accorgeva.

     ⚠️ DUE BOTTONI AFFIANCATI, NON UNO DENTRO L'ALTRO. I tre numeri aprono
      l'incasso, i costi aprono le voci: un pulsante dentro un pulsante è
      marcatura non valida, e i browser la riparano spostandone uno fuori
      dall'altro — con il risultato che si preme una cosa e ne parte un'altra. */
  const costi = totaleCostiPratica(lead.data);

  /** Una cella che si legge e basta: etichetta minuta sopra, cifra sotto. */
  /** Una cella che si legge e basta: etichetta minuta sopra, cifra sotto.
   *  ⚠️ `shrink-0` e `whitespace-nowrap` SU TUTTE. Senza, la fascia in una riga
   *   stretta comprime le celle finché «Già versato» diventa «GIÀ V…» e
   *   «€ 1.160» si spezza fra il simbolo e il numero. Un blocco di soldi in cui
   *   non si capisce quale cifra sia quale è peggio di un blocco assente: si
   *   legge lo stesso, ma si legge sbagliato. Meglio che vada a capo la riga
   *   della posa. */
  /* ── ⚠️ I COLORI DICONO CHE COSA È QUEL NUMERO ──────────────────────────
     Prima la fascia era tutta ambra: quattro celle dello stesso colore, e per
     sapere quale fosse quale bisognava leggere le etichette una per una. Il
     colore c'era e non informava — che è il modo più costoso di usarlo.

     Adesso il fondo è neutro e il colore sta SOLO sulle cifre, uno per
     significato:
       · VERDE  = soldi già entrati (versato, incassato, netto positivo);
       · ROSSO  = soldi usciti (i costi) o un netto in perdita;
       · AMBRA  = soldi che devono ancora arrivare (resta);
       · GRIGIO = numeri di riferimento che non sono né entrate né uscite
                  (il totale pattuito).
     Sono gli stessi tre significati che il CRM usa già dappertutto, e questa
     fascia smette di essere un'eccezione.

     ⚠️ TENUI E NON ACCESI. In un elenco di venti pose quattro colori pieni
      affiancati fanno una tavolozza, e una tavolozza non si legge: il colore
      sta sul numero, l'etichetta resta grigia, il fondo resta bianco. Solo la
      cella che conta — quella che si va a ritirare, o il netto — ha una velatura
      del suo colore, ed è così che si distingue senza gridare.

     ⚠️ LE MISURE: etichetta 10px, cifre 14px, la cifra principale 18px. Erano
      9,5 e 13, cioè quasi uguali fra loro: la gerarchia si leggeva solo dal
      grassetto. Tre passi distinti si riconoscono con la coda dell'occhio. */
  const cella = (etichetta: string, valore: string, colore = "text-slate-700") => (
    <span className="flex shrink-0 flex-col justify-center whitespace-nowrap px-3 py-1.5">
      <span className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-500">
        {etichetta}
      </span>
      <span className={cn("text-[14px] font-semibold leading-tight tabular-nums", colore)}>
        {valore}
      </span>
    </span>
  );

  /** La cella dei costi: soldi usciti, quindi rosso. La stessa in tutti e due
   *  gli stati del blocco. */
  const cellaCosti = (
    <button
      type="button"
      onClick={(e) => {
        //  Le righe delle installazioni si aprono al tocco: senza questo si
        //  aprirebbe anche la scheda del cliente dietro la finestra.
        e.stopPropagation();
        setCostiAperti(true);
      }}
      aria-haspopup="dialog"
      title={`Scrivi i costi avuti su ${nomeCompleto(lead)}`}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-left transition hover:bg-slate-50"
    >
      <span className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-500">
          Costi
        </span>
        <span className="text-[14px] font-semibold leading-tight tabular-nums text-rose-700">
          {costi > 0 ? eur(costi) : "—"}
        </span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
    </button>
  );

  //  Fondo bianco e fili grigi: il colore sta sulle cifre, non sul guscio.
  const fascia = cn(
    "flex w-fit shrink-0 items-stretch divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-card leading-tight",
    className,
  );

  /* ── PRATICA SALDATA ───────────────────────────────────────────────────
     Incassato, costi, netto. I tre numeri di prima — «già versato 650»,
     «totale 650», «resta 0» — dicevano la stessa cosa tre volte, e la sola
     che aggiungevano era l'informazione meno utile che si possa dare su una
     pratica finita.
     ⚠️ Dove accanto c'è la fascia «Speso in tutto» questo blocco non compare
      affatto (lo spengono CRM.installazioni.index e crm/SchedaCliente): là il
      denaro lo racconta quella. Qui resta per la giornata dell'installatore e
      per i pacchi da spedire, dove è l'unico blocco dei soldi. */
  if (resta <= 0) {
    const netto = totale - costi;
    return (
      <>
        <div className={fascia}>
          {cella("Incassato", eur(totale), "text-emerald-700")}
          {cellaCosti}
          <span
            className={cn(
              "flex shrink-0 flex-col justify-center whitespace-nowrap px-3.5 py-1.5",
              netto < 0 ? "bg-rose-50" : "bg-emerald-50",
            )}
            title="Incassato meno i costi scritti su questa pratica. L'IVA non è scorporata e le spese fisse del mese non ci sono: il margine vero sta nella pagina dei numeri."
          >
            <span className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-500">
              Netto
            </span>
            <span
              className={cn(
                "text-[18px] font-bold leading-tight tabular-nums",
                //  Un netto negativo non si nasconde e non si ferma a zero:
                //  quella posa ha perso denaro, ed è la cosa più utile che
                //  questa fascia possa dire.
                netto < 0 ? "text-rose-700" : "text-emerald-700",
              )}
            >
              {eur(netto)}
            </span>
          </span>
        </div>
        <FinestraCosti lead={lead} aperta={costiAperti} onCambio={setCostiAperti} />
      </>
    );
  }

  /* ── C'È ANCORA DA INCASSARE ───────────────────────────────────────────
     Le prime tre celle sono un pulsante solo: si preme dove capita fra
     versato, totale e resta, e si apre l'incasso. Separarle in tre bersagli
     avrebbe voluto dire tre pulsanti che fanno la stessa cosa e un dito che
     deve sceglierne uno. */
  return (
    <>
      <div className={fascia}>
        <button
          type="button"
          onClick={() => setIncassoAperto(true)}
          aria-haspopup="dialog"
          title={`Registra l'incasso di ${eur(resta)} · ${nomeCompleto(lead)}`}
          className="flex shrink-0 items-stretch divide-x divide-slate-200 text-left transition hover:bg-slate-50"
        >
          {/*  Il versato è verde perché è già entrato; il totale è grigio
              perché non è né un'entrata né un'uscita — è il metro con cui si
              leggono gli altri due. */}
          {cella("Versato", eur(versato), "text-emerald-700")}
          {cella("Totale", eur(totale))}
          <span className="flex shrink-0 flex-col justify-center whitespace-nowrap bg-amber-50 px-3.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-amber-700/80">
              Resta
            </span>
            <span className="flex items-center gap-1 text-[18px] font-bold leading-tight tabular-nums text-amber-700">
              {eur(resta)}
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-amber-600/60" aria-hidden />
            </span>
            {/*  ⚠️ L'INVITO RESTA SCRITTO. Stava su una banda tutta sua e
                quella è sparita; qui è una riga minuta, che costa niente in
                altezza. Il chevron da solo non basta: su un telefono una
                freccia da dodici pixel non è un invito, e questo blocco è
                stato reso premibile proprio perché nessuno se ne accorgeva. */}
            <span className="text-[10px] leading-tight text-amber-700/70">tocca per incassare</span>
          </span>
        </button>
        {cellaCosti}
      </div>
      <FinestraIncasso lead={lead} aperta={incassoAperto} onCambio={setIncassoAperto} />
      <FinestraCosti lead={lead} aperta={costiAperti} onCambio={setCostiAperti} />
    </>
  );
}

/** Gli stessi tre numeri detti a parole, per il riepilogo che si incolla al
 *  tecnico: stesse etichette, stesso ordine. Un foglio incollato in chat che
 *  dice "saldo 1.200" mentre lo schermo dice "resta 1.200" è la stessa
 *  divergenza di vocabolario che questa pagina è stata rifatta per togliere. */
export function rigaSoldi(l: Lead): string {
  if (!importoDefinito(l)) return "importo da definire";
  const { versato, daIncassare: resta, totale } = totaleIncassatoCliente(l);
  return `già versato ${eur(versato)} · totale ${eur(totale)} · resta ${eur(resta)}`;
}

/** La scheda del tecnico e la riga dell'elenco montano lo STESSO blocco: qui
 *  cambia solo quanto spazio occupa. Restano due nomi perché sono quelli con cui
 *  le pagine lo chiamano da sempre, e rinominare quattro punti di montaggio per
 *  un vestito diverso non serve a nessuno. */
export function ImportoConsegna({ lead, className }: { lead: Lead; className?: string }) {
  return <SoldiPosa lead={lead} className={className} />;
}

/** ── ⚠️ NIENTE PIÙ LARGHEZZA FISSA ────────────────────────────────────────
 *  Qui c'era `sm:w-[16.5rem]`, cioè 264 pixel esatti. Aveva senso finché il
 *  blocco era in COLONNA: tre cifre incolonnate una sotto l'altra, e un elenco
 *  di numeri che balla a destra e a sinistra non si somma con l'occhio.
 *  Da quando è una fascia in riga quella misura è diventata una gabbia: quattro
 *  celle in 264 pixel non ci stanno, e il risultato erano etichette mozzate
 *  («GIÀ V…», «TO…», «C…») e il simbolo dell'euro mandato a capo da solo — cioè
 *  un blocco di soldi in cui non si capiva più quale cifra fosse quale.
 *  Adesso la fascia prende la larghezza che le serve e basta. L'incolonnamento
 *  se lo prendono le celle, che hanno tutte la stessa struttura. */
export function ImportoRiga({ lead, className }: { lead: Lead; className?: string }) {
  return <SoldiPosa lead={lead} className={cn("sm:shrink-0", className)} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2 bis. L'IMPORTO CHE MANCA — si scrive dove si legge che manca
   ═════════════════════════════════════════════════════════════════════════ */

/** ── LA FINESTRA CHE METTE IL PREZZO ──────────────────────────────────────
 *  Si chiede UN numero solo: quanto costa in tutto la pratica. Il resto si
 *  deduce — quello che è già in cassa lo sa la scheda, e la differenza è quello
 *  che il tecnico ritira. Chiedere due numeri (totale e residuo) vuol dire
 *  chiedere due volte la stessa cosa e potersi contraddire.
 *
 *  ⚠️ CAMPO DI TESTO, NON `type="number"`
 *  In italiano i decimali si scrivono con la virgola e le migliaia col punto
 *  (1.250,50): un campo numerico la virgola la rifiuta, sul telefono apre una
 *  tastiera senza, e con la rotellina cambia il valore mentre si scorre. La
 *  lettura la fa leggiEuro(), che accetta tutti i modi in cui una cifra viene
 *  scritta davvero.
 *
 *  I TRE NUMERI SI VEDONO MENTRE SI SCRIVE
 *  Sotto il campo compaiono GIÀ VERSATO · TOTALE · RESTA aggiornati a ogni
 *  battuta: è la stessa terna che si vedrà nella riga appena salvato, quindi
 *  chi scrive vede il risultato prima di confermarlo.
 *
 *  Esc annulla senza scrivere niente; il salvataggio lascia un messaggio con
 *  "Annulla", perché un importo sbagliato scritto in silenzio si scopre alla
 *  consegna. */
export function FinestraImportoPosa({
  lead,
  aperta,
  onCambio,
}: {
  lead: Lead;
  aperta: boolean;
  onCambio: (v: boolean) => void;
}) {
  const { impostaImportoTotale } = useAzioniInstallazione();
  const versato = giaIncassato(lead);
  const [testo, setTesto] = useState("");

  //  Ogni apertura riparte dal campo vuoto: una cifra rimasta da un'apertura
  //  precedente — magari di un altro cliente, sulla stessa riga riusata — è il
  //  modo più silenzioso di scrivere in scheda un prezzo che non è il suo.
  useEffect(() => {
    if (aperta) setTesto("");
  }, [aperta]);

  const totale = leggiEuro(testo);
  const resta = Math.max(0, totale - versato);
  //  Un totale più basso di quello che il cliente ha già versato non esiste: o
  //  è un errore di battitura o è un rimborso, e un rimborso non si registra
  //  scrivendo un prezzo.
  const sottoIlVersato = totale > 0 && totale < versato;
  const valido = totale > 0 && !sottoIlVersato;

  const salva = () => {
    if (!valido) return;
    //  Si chiude PRIMA di scrivere: l'ultimo tocco deve sembrare istantaneo, il
    //  salvataggio si prende il tempo che gli serve.
    onCambio(false);
    void impostaImportoTotale(lead, totale);
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      larghezza="sm"
      icona={Euro}
      titolo="Imposta l'importo"
      contesto={`${nomeCompleto(lead)} · prezzo non ancora in scheda`}
      classeCorpo="space-y-3"
      azioni={
        <>
          <Button
            variant="outline"
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            onClick={() => onCambio(false)}
          >
            Annulla
          </Button>
          <Button onClick={salva} disabled={!valido}>
            <Check className="mr-1 h-3.5 w-3.5" /> Salva importo
          </Button>
        </>
      }
    >
      <SezioneFinestra
        titolo="Quanto costa in tutto la pratica"
        nota="Il totale del cliente, non quello che resta: la differenza la fa la scheda"
        classeCorpo="p-3 space-y-2.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-slate-500">€</span>
          {/*  Campo di TESTO con tastiera numerica: in italiano si scrive
              1.250,50 e un campo "number" quella virgola non la accetta. */}
          <Input
            autoFocus
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={(e) => {
              //  Invio salva: chi scrive una cifra su un telefono si aspetta di
              //  chiudere col tasto che ha sotto il pollice.
              if (e.key === "Enter") {
                e.preventDefault();
                salva();
              }
            }}
            inputMode="decimal"
            aria-label="Importo totale della pratica in euro"
            placeholder="0,00"
            className={cn(CLASSE_CAMPO, "h-11 flex-1 text-[17px] font-semibold tabular-nums")}
          />
        </div>

        {/*  Gli stessi tre numeri, nello stesso ordine, che compariranno nella
            riga: si vede il risultato prima di confermarlo. */}
        <div className="grid grid-cols-3 gap-2">
          <KpiFinestra etichetta="Già versato" valore={eur(versato)} />
          <KpiFinestra etichetta="Totale" valore={totale > 0 ? eur(totale) : "—"} />
          {/*  Il terzo riquadro è il più evidente anche qui: nei KPI la parola
              "forte" cambia solo la gradazione del testo, e tre riquadri bianchi
              uguali si leggono da sinistra a destra senza che nessuno spicchi —
              mentre RESTA è l'unico numero che si porta dietro uscendo. Il
              colore è il solito segnale: ambra finché c'è da incassare. */}
          <KpiFinestra
            etichetta="Resta"
            valore={totale > 0 ? eur(resta) : "—"}
            nota={totale > 0 ? (resta > 0 ? "da incassare" : "niente da ritirare") : undefined}
            forte
            className={
              totale <= 0
                ? undefined
                : resta > 0
                  ? "border-amber-300 bg-amber-50"
                  : "border-emerald-300 bg-emerald-50"
            }
          />
        </div>

        {sottoIlVersato && (
          <p className="text-[11px] leading-snug text-amber-700">
            Il cliente ha già versato {eur(versato)}: il totale non può essere più basso.
          </p>
        )}
      </SezioneFinestra>

      <NotaFinestra>
        {valido
          ? "Salvando, l'avviso sparisce e al suo posto compaiono i tre numeri. Subito dopo compare «Annulla»."
          : "Scrivi l'importo totale: si può usare la virgola (1.250,50). Esc annulla senza salvare."}
      </NotaFinestra>
    </Finestra>
  );
}

/** ── LO STESSO CAMPO, DENTRO UNA FINESTRA CHE È GIÀ APERTA ────────────────
 *  Nel riepilogo della programmazione il prezzo mancante va rimediato lì dove lo
 *  si scopre. Non si apre una seconda finestra sopra la prima — una finestra
 *  dentro una finestra è il modo più sicuro di lasciare l'utente senza sapere
 *  quale Esc chiude cosa: qui il campo è già lì, aperto, e "Salva" scrive.
 *
 *  Le regole sono le stesse della finestra: campo di TESTO con tastiera
 *  numerica (la virgola italiana), lettura con leggiEuro, mai un totale sotto a
 *  quello che il cliente ha già versato, conferma visibile con "Annulla". */
function ImpostaImportoInline({ lead }: { lead: Lead }) {
  const { impostaImportoTotale } = useAzioniInstallazione();
  const versato = giaIncassato(lead);
  const [testo, setTesto] = useState("");
  const totale = leggiEuro(testo);
  const resta = Math.max(0, totale - versato);
  const sottoIlVersato = totale > 0 && totale < versato;
  const valido = totale > 0 && !sottoIlVersato;

  const salva = () => {
    if (!valido) return;
    void impostaImportoTotale(lead, totale);
    setTesto("");
  };

  return (
    <SezioneFinestra
      titolo="Importo da definire"
      nota="Il prezzo non è ancora in scheda: scrivilo qui e chi va a posare saprà quanto ritirare"
      icona={Euro}
      classeCorpo="p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold text-slate-500">€</span>
        <Input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              salva();
            }
          }}
          inputMode="decimal"
          aria-label="Importo totale della pratica in euro"
          placeholder="0,00"
          className={cn(CLASSE_CAMPO, "h-10 flex-1 text-[16px] font-semibold tabular-nums")}
        />
        <Button onClick={salva} disabled={!valido} className="h-10 shrink-0">
          <Check className="mr-1 h-3.5 w-3.5" /> Salva
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-slate-500">
        {sottoIlVersato
          ? `Il cliente ha già versato ${eur(versato)}: il totale non può essere più basso.`
          : valido
            ? `Già versato ${eur(versato)} · totale ${eur(totale)} · resta ${eur(resta)} da incassare.`
            : `Già versato ${eur(versato)}. Si può scrivere con la virgola (1.250,50).`}
      </p>
    </SezioneFinestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2 ter. LE NOTE DEL LEAD — si leggono senza aprire la scheda
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ UN SEGNO E NON TUTTA LA RIGA ──────────────────────────────────
 *  Il riquadro si apre passando sopra UN SEGNO — il foglietto accanto al nome —
 *  e non passando sopra la riga intera. Con la riga intera il riquadro si
 *  aprirebbe ogni volta che il mouse la attraversa per arrivare ai comandi di
 *  destra, coprendoli proprio mentre ci si va: in un elenco di venti pose
 *  significherebbe venti riquadri che sbucano mentre si scorre.
 *  Il segno c'è solo dove ci sono note, quindi dice anche una cosa in più: quali
 *  righe hanno qualcosa da leggere e quali no.
 *
 *  ⚠️ SENZA NOTE IL SEGNO NON ESISTE: un riquadro vuoto che appare al passaggio
 *  del mouse è solo fastidio.
 *
 *  SUL TELEFONO SI TOCCA
 *  Il passaggio del mouse sul telefono non esiste: l'apertura via mouse è legata
 *  a pointerType "mouse", mentre il tocco apre col comportamento normale del
 *  pannello e si chiude toccando fuori. Senza la distinzione un tocco aprirebbe
 *  e richiuderebbe subito il riquadro, e la funzione resterebbe irraggiungibile
 *  proprio sul dispositivo con cui questa pagina si usa in piedi. */
function ElencoNote({ note }: { note: NotaLead[] }) {
  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
      {note.map((n, i) => (
        <li key={i} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
          {(n.data || n.fonte) && (
            <div className="mb-0.5 text-[11px] font-medium text-slate-500">{n.data ?? n.fonte}</div>
          )}
          {/*  whitespace-pre-wrap: le note vanno a capo come sono state scritte.
              break-words: un link incollato lungo una riga intera altrimenti
              allarga il pannello fuori dallo schermo. */}
          <p className="whitespace-pre-wrap break-words text-[12px] leading-snug text-slate-700">
            {n.testo}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function SegnoNote({ lead, className }: { lead: Lead; className?: string }) {
  //  ⚠️ Gli hook stanno tutti SOPRA il ritorno anticipato di più sotto.
  const [aperto, setAperto] = useState(false);
  //  noteDelLead controlla la forma di ogni campo prima di leggerlo: negli
  //  archivi importati `note` è a volte un oggetto o un numero, e trattarlo da
  //  testo scriverebbe "[object Object]" — o farebbe cadere la riga.
  const note = useMemo(() => noteDelLead(lead.data), [lead.data]);

  //  ── FRA IL SEGNO E IL RIQUADRO C'È UN VUOTO ────────────────────────────
  //   Il riquadro sta qualche pixel sotto il segno: attraversando quel vuoto il
  //   mouse esce dal segno PRIMA di entrare nel riquadro, e senza un attimo di
  //   attesa si chiuderebbe proprio nel momento in cui si va a leggerlo.
  const ritardo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fermaChiusura = () => {
    if (ritardo.current) clearTimeout(ritardo.current);
    ritardo.current = null;
  };
  const apri = () => {
    fermaChiusura();
    setAperto(true);
  };
  const chiudi = () => {
    fermaChiusura();
    ritardo.current = setTimeout(() => setAperto(false), 140);
  };
  //  Smontando la riga (basta cambiare filtro) il timer resterebbe a scrivere
  //  su un componente che non c'è più.
  useEffect(() => fermaChiusura, []);

  if (note.length === 0) return null;

  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerEnter={(e) => e.pointerType === "mouse" && apri()}
          onPointerLeave={(e) => e.pointerType === "mouse" && chiudi()}
          aria-label={`${note.length} ${note.length === 1 ? "nota" : "note"} in scheda · ${nomeCompleto(lead)}`}
          title="Le note della scheda: passa sopra o tocca"
          className={cn(
            "relative inline-flex shrink-0 cursor-help items-center gap-0.5 rounded-md px-1 py-0.5",
            "text-[11px] font-medium leading-none text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            //  ── IL SEGNO È PICCOLO, IL BERSAGLIO NO ──────────────────────
            //   Disegnato, il foglietto è largo un dito di bambino: su questa
            //   pagina — che si usa in piedi, col telefono in una mano — un
            //   bersaglio di venti pixel si manca, e mancandolo si tocca il
            //   nome e si apre la scheda del cliente. L'area sensibile viene
            //   allargata con uno pseudo-elemento invisibile, che NON occupa
            //   spazio: la riga resta identica, ma il dito ha dove atterrare.
            //   L'allargamento laterale è di 4px contro 6px di distanza dagli
            //   elementi vicini: non ruba tocchi al nome né al tasto accanto.
            "before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-['']",
            className,
          )}
        >
          <StickyNote className="h-3.5 w-3.5 shrink-0" />
          <span className="tabular-nums">{note.length}</span>
        </button>
      </PopoverTrigger>
      {/*  align="start": il riquadro cresce verso destra a partire dal segno, che
          sta a sinistra accanto al nome — così non finisce sopra l'importo e i
          comandi, che stanno in fondo alla riga. */}
      <Pannello
        align="start"
        collisionPadding={12}
        className="w-80"
        titolo="Note della scheda"
        contesto={`${nomeCompleto(lead)} · ${note.length} ${note.length === 1 ? "nota" : "note"} · la più recente in alto`}
        //  Aperto col mouse deve restare aperto mentre ci si entra dentro a
        //  scorrere: senza questo, uscire dal segno lo chiuderebbe proprio
        //  mentre si sta leggendo.
        onPointerEnter={(e) => e.pointerType === "mouse" && apri()}
        onPointerLeave={(e) => e.pointerType === "mouse" && chiudi()}
        //  Il riquadro si legge, non si compila: rubare il fuoco al passaggio
        //  del mouse farebbe saltare la pagina sotto le mani.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ElencoNote note={note} />
      </Pannello>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. ETICHETTE — le stesse parole in ogni riga e in ogni scheda
   ═════════════════════════════════════════════════════════════════════════ */

export const ETICHETTA_TIPO: Record<TipoInstallazione, string> = {
  da_impostare: "Tipo da definire",
  taxi: "A domicilio",
  indipendente: "In sede",
};

/** Lo stato del materiale si leggeva grezzo dal database ("manca_colore"): qui
 *  diventa italiano, e il tono dice se è una cosa risolta o da risolvere. */
export const ETICHETTA_ORDINE: Record<StatoOrdine, string> = {
  da_ordinare: "Da ordinare",
  ordinato: "Ordinato",
  manca_colore: "Colore da confermare",
  colore_preso: "Colore confermato",
};

export const TONO_ORDINE: Record<StatoOrdine, Tono> = {
  da_ordinare: "in_sospeso",
  ordinato: "in_corso",
  manca_colore: "in_sospeso",
  colore_preso: "vinta",
};

/** L'ordine in cui si presentano le scelte: è il percorso reale del materiale,
 *  non l'ordine alfabetico. */
export const ORDINE_MATERIALE: StatoOrdine[] = [
  "da_ordinare",
  "manca_colore",
  "ordinato",
  "colore_preso",
];

export const nomeCompleto = (l: Lead) => `${l.data.nome} ${l.data.cognome}`.trim();

/** Chi esegue l'installazione: prima il consulente collegato, poi il nome
 *  scritto a mano, infine la mancanza detta a voce alta — un'installazione
 *  senza installatore è il problema che si scopre la mattina stessa.
 *  ⚠️ Si chiama ancora `nomeTecnico` perché la usano otto schermate: il nome
 *  della funzione è l'unico posto in cui la parola vecchia sopravvive, e a
 *  schermo non compare. Quello che si LEGGE dice «installatore». */
export function nomeTecnico(l: Lead, consulenti: Consultant[]): string {
  const inst = l.data.installazione;
  const collegato = consulenti.find((c) => c.id === inst?.consulenteInstallazioneId);
  return collegato?.data.nome || inst?.tecnicoAssegnato || "Installatore da assegnare";
}

/** ── CHI DEVE ANCORA ESSERE ASSEGNATO ─────────────────────────────────────
 *  Vero quando alla posa non è attaccato nessuno: né un consulente collegato né
 *  un nome scritto a mano. Serve a colorare il nome nella riga — nomeTecnico()
 *  da solo non lo dice, perché restituisce comunque la frase "Installatore da
 *  assegnare" e chi legge non può distinguerla da un nome vero. */
export function senzaTecnico(l: Lead): boolean {
  const inst = l.data.installazione;
  return !inst?.consulenteInstallazioneId && !inst?.tecnicoAssegnato;
}

/** ── CHI PUÒ ESEGUIRE LA POSA ──────────────────────────────────────────────
 *  SOLO GLI INSTALLATORI, SENZA SCORCIATOIE.
 *  In «Chi la esegue» compare solo chi ha la spunta «fa l'installatore». Prima
 *  l'elenco erano tutti gli attivi con gli installatori in cima; poi è stato un
 *  elenco di installatori che, finché non ce n'era nemmeno uno, tornava a essere
 *  tutti gli attivi con un avviso sopra. Tutte e due le versioni facevano la
 *  stessa cosa: mettere in agenda chi non posa — ed è il modo in cui una posa
 *  arriva al giorno prima senza nessuno che la esegua davvero. Il committente ha
 *  chiesto che quella porta si chiuda, e qui è chiusa: niente consulenti in
 *  questo elenco, mai, nemmeno il primo giorno.
 *
 *  ⚠️ E QUANDO NON C'È NESSUNO? L'elenco resta VUOTO, e vuoto qui vuol dire che
 *  non si programma niente: è un vicolo cieco, e va detto come tale. Per questo
 *  non si restituisce solo l'elenco ma anche PERCHÉ è vuoto — le due mancanze si
 *  riparano in due posti diversi (una persona da aggiungere in anagrafica, o una
 *  spunta da accendere su una persona che c'è già), e una schermata che dicesse
 *  «nessuno» e basta lascerebbe a chi legge un interruttore da indovinare in
 *  un'altra pagina. Il testo e la via d'uscita stanno in `SenzaInstallatori`,
 *  qui sotto, che è l'unico posto in cui quella frase è scritta.
 *  ⚠️ La domanda si fa sull'ANAGRAFICA, non su questa posa: appena una persona
 *  qualsiasi viene segnata installatore, la schermata del vicolo cieco sparisce
 *  da sé, su tutte le pratiche e senza che nessuno debba tornare qui.
 *  ⚠️ Chi è già scritto su questa posa resta in elenco anche se nel frattempo è
 *  stato spento o non è (più) installatore — stessa regola dei driver: riaprire
 *  una posa vecchia non deve svuotare il primo passo facendo credere che quella
 *  persona sia sparita. */

/** Perché «Chi la esegue» non ha nessuno da proporre. `null` = ce l'ha.
 *  Sono due mancanze diverse perché si riparano in due modi diversi, e dirle
 *  con la stessa frase manderebbe metà delle volte nel posto sbagliato. */
export type MancaEsecutore = "nessuno_in_anagrafica" | "nessun_installatore" | null;

export function esecutoriPossibili(
  consulenti: Consultant[],
  sceltoId?: string,
): { elenco: Consultant[]; manca: MancaEsecutore } {
  const attivi = consulenti.filter((c) => c.data.attivo);
  const installatori = attivi.filter((c) => mestieriDi(c.data).faInstallatore);
  //  Chi è già scritto sulla posa si aggiunge in coda se non c'è già: si
  //  confrontano gli id e non gli oggetti, perché due letture dello stesso
  //  consulente non sono lo stesso oggetto.
  const scelto = sceltoId ? consulenti.find((c) => c.id === sceltoId) : undefined;
  const elenco =
    scelto && !installatori.some((c) => c.id === scelto.id)
      ? [...installatori, scelto]
      : installatori;
  //  Il motivo si guarda sugli ATTIVI, non sull'elenco appena composto: «non c'è
  //  nessuno in anagrafica» e «ci sono persone ma nessuna posa» portano in due
  //  punti diversi della stessa pagina.
  const manca: MancaEsecutore =
    elenco.length > 0
      ? null
      : attivi.length === 0
        ? "nessuno_in_anagrafica"
        : "nessun_installatore";
  return { elenco, manca };
}

/** ── IL VICOLO CIECO SI DICE, E SI APRE ────────────────────────────────────
 *  Un elenco vuoto, da solo, è una scatola vuota: chi la trova non ha modo di
 *  sapere che quello che manca è una spunta, e che quella spunta sta in
 *  un'altra pagina. Questo riquadro dice in una riga COSA manca e il percorso
 *  esatto per accenderlo — scheda del consulente → «Che mestiere fa» →
 *  «Installatore» — e poi ci porta, invece di lasciarlo cercare.
 *
 *  ⚠️ IL PULSANTE SI VEDE SOLO SE PORTA DAVVERO DA QUALCHE PARTE. L'anagrafica
 *  è dietro il permesso `consulenti` (vedi permessi.ts): a chi non ce l'ha il
 *  pulsante aprirebbe una pagina che dice di no, cioè un secondo vicolo cieco
 *  dentro il primo. A quella persona si dice invece a chi chiederlo, che è
 *  l'unica cosa vera che può fare.
 *  ⚠️ Prima di cambiare pagina la finestra da cui si parte va CHIUSA, altrimenti
 *  resta aperta sopra l'anagrafica e copre proprio la scheda da aprire: chi la
 *  monta passa `primaDiAndare`.
 *
 *  Sta qui, accanto alla regola, e lo montano tutte e due le schermate in cui si
 *  sceglie chi posa (questa finestra e il blocco posa della scheda cliente): la
 *  stessa mancanza raccontata con due frasi diverse è il modo in cui una delle
 *  due invecchia senza che nessuno se ne accorga. */
export function SenzaInstallatori({
  manca,
  primaDiAndare,
  className,
}: {
  manca: MancaEsecutore;
  /** cosa fare prima di cambiare pagina (di norma: chiudere la finestra) */
  primaDiAndare?: () => void;
  className?: string;
}) {
  //  ⚠️ Gli hook stanno SOPRA il ritorno anticipato: React li conta per
  //  posizione, e uno saltato in un render sposta tutti gli altri.
  const navigate = useNavigate();
  const puoAprireAnagrafica = usePuo()("consulenti");
  if (!manca) return null;

  const vai = () => {
    primaDiAndare?.();
    void navigate({ to: "/CRM/consulenti" });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <VuotoFinestra
        icona={Wrench}
        testo={
          manca === "nessuno_in_anagrafica" ? (
            <>
              <strong>Non c&apos;è nessun consulente attivo</strong>, quindi non c&apos;è nessuno a
              cui affidare la posa: si aggiunge la persona in anagrafica e le si accende{" "}
              <strong>scheda del consulente → «Che mestiere fa» → «Installatore»</strong>.
            </>
          ) : (
            <>
              <strong>Nessuno è ancora segnato come installatore</strong> e la posa non si affida a
              chi non lo è: la spunta si accende in{" "}
              <strong>scheda del consulente → «Che mestiere fa» → «Installatore»</strong>.
            </>
          )
        }
      />
      {puoAprireAnagrafica ? (
        <Button variant="outline" onClick={vai} className="w-full">
          {/*  «Collaboratori» è il nome che quella sezione ha nel menu: qui si
              va a segnare un INSTALLATORE, e mandarci con la parola
              "consulenti" faceva sembrare di aver sbagliato porta. */}
          Apri l&apos;anagrafica dei collaboratori <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      ) : (
        //  Niente pulsante che non porta da nessuna parte: si dice chi può.
        <NotaFinestra tono="attenzione" icona={Wrench}>
          {/*  Il PERMESSO si chiama ancora «consulenti» (crm/permessi.ts) e non
              si rinomina: è una chiave scritta nei PIN già assegnati. Qui si
              nomina per esteso quello che concede, così la frase non manda a
              cercare una spunta con un nome che nella schermata dei permessi
              non c'è. */}
          L&apos;anagrafica dei collaboratori si apre solo con il permesso{" "}
          <strong>«Gestire consulenti, PIN e permessi»</strong>: la spunta va chiesta a chi ce
          l&apos;ha.
        </NotaFinestra>
      )}
    </div>
  );
}

/* ── CHI VA INSIEME A POSARE: L'ACCOMPAGNATORE ──────────────────────────────
 *  ⚠️⚠️ NON È IL DRIVER, e le due cose non si uniscono mai — vedi il campo
 *  `accompagnatoreId` in types.ts e il mestiere in kpi-setter.ts. In due righe:
 *  il driver è quello del passo «viene da solo o con un driver», è un servizio
 *  di TRASPORTO e si porta dietro un compenso da pagare in più;
 *  l'accompagnatore va con l'installatore a FARE il lavoro e quel compenso non
 *  lo prende. Sono due persone diverse in due momenti diversi: fonderle avrebbe
 *  messo un pagamento addosso a chi non lo riceve.
 *  Le funzioni qui sotto sono l'unica porta da cui si legge «c'è un
 *  accompagnatore», esattamente come `driverDi`/`nomeDriver` per chi guida. */

/** L'id dell'accompagnatore, o "" se ci va da solo. Il campo può essere `null`
 *  o — negli archivi importati — qualunque cosa: si legge solo se è testo. */
export function accompagnatoreDi(l: Lead): string {
  const v = l.data.installazione?.accompagnatoreId;
  return typeof v === "string" ? v.trim() : "";
}

/** Il nome da mostrare. Chi è stato disattivato dopo aver preso la posa non fa
 *  sparire il segno: la posa quell'accompagnatore ce l'ha. */
export function nomeAccompagnatore(l: Lead, consulenti: Consultant[]): string {
  const id = accompagnatoreDi(l);
  if (!id) return "";
  return consulenti.find((c) => c.id === id)?.data.nome || "accompagnatore non più in elenco";
}

/** ── IL NOME SCRITTO A MANO CHE C'ERA PRIMA ────────────────────────────────
 *  Sulle pose vecchie il campo «Tecnico che va a posare» era testo libero
 *  (`installazione.tecnicoAssegnato`). Adesso al suo posto si sceglie un
 *  accompagnatore, ma quel nome NON si butta via: si mostra finché su quella
 *  posa nessuno sceglie una persona vera, e da quel momento tace — la persona
 *  scelta è più vera di una stringa, e tenere tutti e due a schermo farebbe
 *  leggere due accompagnatori dove ce n'è uno.
 *  ⚠️⚠️ E NON SI SPACCIA PER UN ACCOMPAGNATORE. Quel campo voleva dire «chi va a
 *  posare», e chi lo compilava poteva intendere l'una o l'altra cosa: la stessa
 *  stringa è ancora il ripiego di `nomeTecnico()`, cioè l'ESECUTORE, in tutti
 *  gli elenchi. Non c'è modo di sapere quale delle due fosse — quindi il testo a
 *  schermo non lo decide al posto di chi legge: dice che il nome c'è, dove
 *  metterlo se era chi esegue e dove se era chi affianca. Deciderlo qui avrebbe
 *  spostato in silenzio l'esecutore di una posa d'archivio nel posto sbagliato.
 *  ⚠️ Il campo non viene MAI riscritto né cancellato: vedi types.ts. */
export function accompagnatoreScrittoAMano(l: Lead): string {
  if (accompagnatoreDi(l)) return "";
  const v = l.data.installazione?.tecnicoAssegnato;
  return typeof v === "string" ? v.trim() : "";
}

/** Chi si può mettere accanto a chi posa: gli attivi a cui è segnato il mestiere
 *  «accompagnatore». Chi è già scritto su questa posa resta in elenco anche se
 *  nel frattempo è stato spento o gli è stato tolto il mestiere.
 *  ⚠️ Fuori l'esecutore (nessuno accompagna se stesso: sarebbe una persona sola
 *  contata due volte, con la stessa agenda bloccata due volte) e fuori il driver
 *  di questa posa, che è l'altro mestiere e l'altra persona — vedi la nota qui
 *  sopra sul perché non si sovrappongono. */
export function accompagnatoriPossibili(
  consulenti: Consultant[],
  sceltoId?: string,
  posatoreId?: string,
  driverId?: string,
): Consultant[] {
  return consulenti.filter(
    (c) =>
      c.id !== posatoreId &&
      !(!!driverId && c.id === driverId) &&
      ((c.data.attivo && mestieriDi(c.data).faAccompagnatore) || (!!sceltoId && c.id === sceltoId)),
  );
}

/* ── CHI ACCOMPAGNA: IL DRIVER ──────────────────────────────────────────────
 *  Una posa si fa da soli o in due. Il secondo caso non è un dettaglio della
 *  scheda: cambia chi si può mandare altrove quel giorno (l'agenda del driver si
 *  blocca, e per più ore di quella del posatore) e va quindi VISTO senza aprire
 *  niente, dall'elenco. Le funzioni qui sotto sono l'unica porta da cui si legge
 *  «c'è un driver»: la finestra, le righe degli elenchi (installazioni, giornata
 *  del tecnico, «A domicilio») e la lente passano tutte da qui, così il segno e
 *  il filtro non possono dare due risposte diverse sulla stessa posa.
 *  ⚠️ La lente «Con driver» aggiunge UNA condizione sua, che non sta qui:
 *  esclude le pose già fatte (vedi passaFiltro in CRM.installazioni.index). È
 *  voluto — è una coda di lavoro e deve calare — ma vuol dire che una posa
 *  completata mostra ancora il segno e si ritrova sotto «Completate», non sotto
 *  «Con driver». */

/** L'id del driver, o "" se ci va da solo. Il campo può essere `null` o — negli
 *  archivi importati — qualunque cosa: si legge solo se è testo. */
export function driverDi(l: Lead): string {
  const v = l.data.installazione?.driverId;
  return typeof v === "string" ? v.trim() : "";
}

export function conDriver(l: Lead): boolean {
  return driverDi(l).length > 0;
}

/** Il nome da mostrare. Chi è stato disattivato (o cancellato) dopo aver preso
 *  la posa non deve far sparire il segno: la posa quel driver ce l'ha, e una
 *  riga che smette di dirlo è peggio di un nome che non si trova più. */
export function nomeDriver(l: Lead, consulenti: Consultant[]): string {
  const id = driverDi(l);
  if (!id) return "";
  return consulenti.find((c) => c.id === id)?.data.nome || "driver non più in elenco";
}

/** Quanto va pagato in più per il driver. ⚠️ È un COSTO: non si somma mai al
 *  saldo del cliente né al totale da incassare (vedi la nota sul campo in
 *  types.ts). */
export function compensoDriver(l: Lead): number {
  const n = Number(l.data.installazione?.compensoDriver);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Chi si può mandare come driver: gli attivi a cui è segnato il mestiere
 *  «driver» nella scheda del consulente. Chi è già scritto su questa posa resta
 *  in elenco anche se nel frattempo è stato spento o gli è stato tolto il
 *  mestiere — altrimenti riaprire la finestra svuoterebbe il campo e sembrerebbe
 *  che non ci fosse mai stato nessuno.
 *  ⚠️ Chi la posa non può accompagnare se stesso: «da solo» e «con un driver»
 *  sono le due risposte alla stessa domanda, e una posa in cui il driver è il
 *  posatore bloccherebbe due volte la stessa agenda dicendo che escono in due.
 *  ⚠️ Fuori anche l'accompagnatore già scelto, per la stessa ragione: sono due
 *  persone in due mestieri diversi, e sceglierne una sola per tutti e due i
 *  posti farebbe raccontare al riepilogo una squadra di tre dove sono in due. */
export function driverPossibili(
  consulenti: Consultant[],
  sceltoId?: string,
  posatoreId?: string,
  accompagnatoreId?: string,
): Consultant[] {
  return consulenti.filter(
    (c) =>
      c.id !== posatoreId &&
      !(!!accompagnatoreId && c.id === accompagnatoreId) &&
      ((c.data.attivo && mestieriDi(c.data).faDriver) || (!!sceltoId && c.id === sceltoId)),
  );
}

/** Il segno che si vede NELL'ELENCO, senza aprire la scheda. Niente nome =
 *  niente segno: una pastiglia vuota si legge comunque, e fa cercare un dato che
 *  non c'è. */
export function SegnoDriver({ nome, className }: { nome: string; className?: string }) {
  if (!nome) return null;
  return (
    <Chip tono="in_corso" icona={Car} className={className} title={`Ci va con ${nome}`}>
      Driver · {nome}
    </Chip>
  );
}

/** ── E IL SEGNO DI CHI AFFIANCA ────────────────────────────────────────────
 *  Gemello di `SegnoDriver`, e sta qui accanto apposta: negli elenchi si vedeva
 *  «Driver · Marco» e non si vedeva NIENTE dell'accompagnatore, quindi una posa
 *  che impegna due persone si leggeva come una posa da solo — e chi riempiva il
 *  resto della giornata dava per libera un'agenda che quel pomeriggio non c'è.
 *  Le due pastiglie hanno tono e icona diversi di proposito: sono due mestieri
 *  diversi (vedi la nota lunga sopra `accompagnatoreDi`), e due segni identici
 *  con solo la parola che cambia si scambiano di colpo d'occhio.
 *  ⚠️ Il nome si risolve con `nomeAccompagnatore` DOVE l'elenco dei consulenti
 *  c'è già, come per il driver: la riga riceve una stringa e non cerca nessuno.
 *  Niente nome = niente segno, per la stessa ragione del driver: una pastiglia
 *  vuota si legge comunque e fa cercare un dato che non c'è. */
export function SegnoAccompagnatore({ nome, className }: { nome: string; className?: string }) {
  if (!nome) return null;
  return (
    <Chip
      tono="da_lavorare"
      icona={UserPlus}
      className={className}
      title={`Va a posare insieme a ${nome}`}
    >
      Con · {nome}
    </Chip>
  );
}

/** L'ora spostata di tanti minuti, per DIRE a schermo quanto tempo si occupa
 *  ("dalle 06:00 alle 14:00"). Solo per farlo leggere: il calcolo che conta —
 *  quello che toglie gli orari dall'agenda — sta in booking-utils e lavora in
 *  minuti, senza passare da queste stringhe.
 *  Fuori dalla giornata si ferma agli estremi: "‑01:00" e "26:00" non sono ore,
 *  e in una frase che deve rassicurare fanno l'effetto opposto. */
function oraSpostata(hhmm: string, minuti: number): string {
  const [h, m] = String(hhmm || "")
    .split(":")
    .map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "—";
  const totale = Math.min(24 * 60 - 1, Math.max(0, h * 60 + m + minuti));
  return `${String(Math.floor(totale / 60)).padStart(2, "0")}:${String(totale % 60).padStart(2, "0")}`;
}

const oraMeno = (hhmm: string, minuti: number) => oraSpostata(hhmm, -minuti);
const oraPiu = (hhmm: string, minuti: number) => oraSpostata(hhmm, minuti);

/* ── L'INDIRIZZO DELLA POSA A DOMICILIO ─────────────────────────────────────
 *  Si scrive in tre campi — via, CAP, città — perché è così che si detta al
 *  telefono, ma si SALVA in uno solo: `installazione.spedizione.indirizzo`, che
 *  è il campo che leggono già la scheda «A domicilio», l'elenco delle
 *  spedizioni, `haIndirizzo()` e il blocco che impedisce di chiudere una posa
 *  senza sapere dove si va. Un secondo campo strutturato accanto a quello
 *  sarebbe la solita coppia che al primo ritocco dice due cose diverse: si
 *  correggerebbe il civico dalla riga dell'elenco e il tecnico partirebbe con
 *  quello vecchio.
 *
 *  Riaprendo la finestra la riga si rilegge nei tre campi. Il formato è quello
 *  che scriviamo noi ("Via Roma 12, 20100 Milano"); tutto ciò che non lo rispetta
 *  — cioè l'archivio importato, scritto a mano in cento modi — finisce INTERO
 *  nella via, che è l'unico modo di non perdere niente. */
export function componiIndirizzo(via: string, cap: string, citta: string): string {
  const coda = [cap.trim(), citta.trim()].filter(Boolean).join(" ");
  return [via.trim(), coda].filter(Boolean).join(", ");
}

export function scomponiIndirizzo(riga: string): { via: string; cap: string; citta: string } {
  const testo = String(riga ?? "").trim();
  if (!testo) return { via: "", cap: "", citta: "" };
  //  Il CAP è l'unico pezzo riconoscibile con certezza (cinque cifre): si àncora
  //  a lui, così una via che contiene una virgola ("Via Roma 12, int. 3") resta
  //  tutta nella via invece di spezzarsi a metà.
  const conCap = testo.match(/^(.*),\s*(\d{5})\s+(.+)$/);
  if (conCap) return { via: conCap[1].trim(), cap: conCap[2], citta: conCap[3].trim() };
  const senzaCap = testo.match(/^(.*),\s*([^,]+)$/);
  if (senzaCap) return { via: senzaCap[1].trim(), cap: "", citta: senzaCap[2].trim() };
  return { via: testo, cap: "", citta: "" };
}

/** ── COSA MANCA, DETTO UNA VOLTA SOLA ─────────────────────────────────────
 *  Qui c'era l'elenco di TUTTO ciò che manca (orario, tecnico, importo,
 *  materiale) e la riga lo stampava sotto il nome. Ma orario, tecnico e importo
 *  hanno già il loro posto nella riga — il "quando", la coda città·tecnico, la
 *  scatola dell'importo — e ripeterli sotto significava dire la stessa cosa due
 *  volte a due centimetri di distanza: esattamente il difetto per cui questa
 *  pagina è stata rifatta. Quei tre si segnalano DOVE si leggono, con l'ambra.
 *
 *  Resta questo: lo stato del materiale, l'unica cosa che nella riga non ha un
 *  posto suo e l'unica che si scopre tardi — a posa fatta non è più un problema.
 *  Il controllo è sui DATI, non sull'etichetta mostrata: uno stato sconosciuto
 *  (archivio importato con un valore fuori elenco) non accende un falso allarme
 *  e soprattutto non fa esplodere la riga. */
export function avvisoMateriale(l: Lead): string | null {
  if (posaCompletata(l)) return null;
  const m = l.data.statoOrdine;
  if (!m) return "Materiale: stato da indicare";
  if (TONO_ORDINE[m] !== "in_sospeso") return null;
  return m === "da_ordinare" ? "Materiale da ordinare" : ETICHETTA_ORDINE[m];
}

/** La checklist di un lead: quella personalizzata se c'è, altrimenti quella
 *  standard del tipo di installazione. Senza questo ripiego una scheda appena
 *  programmata partirebbe con la borsa vuota. */
export function checklistDi(lead: Lead): ChecklistItem[] {
  const inst = lead.data.installazione;
  //  Array.isArray e non "esiste ed è lunga": negli archivi importati la
  //  checklist a volte arriva come oggetto, e il `.filter()` che ci gira sopra
  //  in ogni riga dell'elenco farebbe morire l'intera pagina.
  if (Array.isArray(inst?.checklist) && inst.checklist.length > 0) return inst.checklist;
  const tipo = inst?.tipoInstallazione || "da_impostare";
  return CHECKLIST_DEFAULT_BY_TYPE[tipo].map((label) => ({ label, done: false }));
}

/** Vero quando la borsa è completa. Una checklist vuota NON è una borsa pronta:
 *  è una checklist da compilare, e contarla fra le pronte darebbe una
 *  tranquillità che non esiste. */
export function borsaPronta(lead: Lead): boolean {
  const cl = checklistDi(lead);
  return cl.length > 0 && cl.every((c) => c.done);
}

/** Il promemoria al cliente. Dice l'ora E la cifra che dovrà avere pronta: è la
 *  telefonata che non si dovrà fare la mattina dell'installazione. */
export function messaggioInstallazione(l: Lead): string {
  const inst = l.data.installazione;
  const quando = formatDate(inst?.dataInstallazione).toLowerCase();
  const ora = inst?.orarioInstallazione ? ` alle ${inst.orarioInstallazione}` : "";
  const saldo = saldoAllaConsegna(l);
  return [
    `Buongiorno ${l.data.nome}, le confermiamo l'installazione di ${quando}${ora}.`,
    saldo > 0 ? `Al termine dell'intervento è previsto il saldo di ${eur(saldo)}.` : "",
    "Restiamo a disposizione per qualsiasi necessità.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. L'ORDINE DELLE COSE — cosa si guarda prima
   ═════════════════════════════════════════════════════════════════════════ */

/** ── IL BADGE DI OGGI ─────────────────────────────────────────────────────
 *  L'unico elemento pieno di tutta la pagina. Un chip tenue come gli altri si
 *  perde: "oggi" non è una categoria fra le tante, è la giornata che si sta
 *  lavorando, e va trovata scorrendo con la coda dell'occhio. Sky perché nel
 *  linguaggio di queste pagine sky vuol dire "da fare adesso". */
export function BadgeOggi({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md bg-sky-600 px-1.5 py-0.5",
        "text-[11px] font-semibold uppercase leading-none tracking-wide text-white",
        className,
      )}
    >
      Oggi
    </span>
  );
}

/** Ordine di lettura di una giornata: per orario. Le righe senza orario vanno
 *  in fondo, non in cima — sono da sistemare, non da fare per prime. */
export function ordinaPerOrario(items: Lead[]): Lead[] {
  return [...items].sort((a, b) => {
    const oa = a.data.installazione?.orarioInstallazione || "99:99";
    const ob = b.data.installazione?.orarioInstallazione || "99:99";
    return oa.localeCompare(ob) || nomeCompleto(a).localeCompare(nomeCompleto(b));
  });
}

/** Da quanto tempo questa pratica aspetta (giorni interi). Vale per chi ha
 *  pagato e non ha ancora una data: è il motivo per cui sta in cima alla coda. */
export function giorniDiAttesa(l: Lead): number | null {
  //  ── ⚠️ DA QUANDO SI CONTA L'ATTESA ─────────────────────────────────────
  //   Dal giorno in cui la trattativa è DIVENTATA UNA VENDITA, cioè da quando
  //   è arrivato l'acconto e lo stato è passato a vinto. Non dal giorno della
  //   consulenza — quella può essere di settimane prima, e il cliente non
  //   stava aspettando niente: stava decidendo. E non dal saldo, che arriva
  //   spesso alla consegna, cioè DOPO l'attesa che si vuole misurare: contarlo
  //   da lì darebbe zero giorni proprio alle pratiche rimaste ferme di più.
  //
  //   ⚠️ E LA REGOLA NON È SCRITTA QUI. È `dataChiusura` di `kpi-netto`, la
  //    stessa con cui i KPI decidono in che giorno una vendita è stata
  //    chiusa: `convertedAt` (lo stato è passato a vinto) → il pagamento →
  //    la posa fatta → l'ingresso. Due regole separate vorrebbero dire una
  //    coda che dice «ferma da 33 giorni» e un cruscotto che attribuisce
  //    quella stessa vendita a un altro mese.
  const riferimento = dataChiusura(l);
  if (!riferimento) return null;
  //  Confronto fra due mezzenotti LOCALI, non fra istanti: `new Date("2026-08-01")`
  //  è mezzanotte UTC, e in estate una pratica di ieri sera contava un giorno
  //  in più della sera prima.
  const g = giorniDaOggi(riferimento);
  if (Number.isNaN(g)) return null;
  return Math.max(0, -g);
}

/** Le installazioni raccolte per giorno. La chiave vuota "" raccoglie chi non
 *  ha ancora una data: non è un caso a parte da tenere in un'altra pagina, è un
 *  giorno che non è ancora stato scelto. */
export function raggruppaPerGiorno(items: Lead[]): { giorno: string; items: Lead[] }[] {
  const mappa = new Map<string, Lead[]>();
  for (const l of items) {
    const g = l.data.installazione?.dataInstallazione || "";
    const gruppo = mappa.get(g);
    if (gruppo) gruppo.push(l);
    else mappa.set(g, [l]);
  }
  return [...mappa.entries()].map(([giorno, elenco]) => ({
    giorno,
    items: giorno
      ? ordinaPerOrario(elenco)
      : //  Senza data non c'è un orario da rispettare: comanda l'attesa, dalla
        //  più lunga. Chi ha pagato tre settimane fa non può stare in fondo.
        [...elenco].sort((a, b) => (giorniDiAttesa(b) ?? 0) - (giorniDiAttesa(a) ?? 0)),
  }));
}

/** ── L'ORDINE DEI BLOCCHI: L'IMMINENZA ────────────────────────────────────
 *  Non è l'ordine del calendario, è l'ordine in cui le cose fanno danno:
 *   0 · OGGI — la giornata che si sta lavorando, sempre in cima.
 *   1 · IN RITARDO — giorni passati con pose ancora aperte: erano da fare e non
 *       risultano fatte. Dalla più recente, perché quella di ieri si recupera
 *       con una telefonata e quella di sei mesi fa è archeologia.
 *   2 · IN ARRIVO — i giorni futuri, in ordine di calendario: si preparano così.
 *   3 · SENZA DATA — hanno pagato e aspettano: è lavoro fermo, non urgente.
 *   4 · FATTE — giorni passati con tutto chiuso: archivio, in fondo.
 *  Un giorno passato pesa 1 se contiene ANCHE una sola posa non completata:
 *  basta una riga aperta per far tornare quel giorno un problema. */
export function ordinaGruppi(
  gruppi: { giorno: string; items: Lead[] }[],
): { giorno: string; items: Lead[] }[] {
  const oggi = giornoISO();
  const peso = (g: { giorno: string; items: Lead[] }) => {
    if (g.giorno === oggi) return 0;
    if (!g.giorno) return 3;
    if (g.giorno > oggi) return 2;
    //  Si chiede a `posaCompletata`, non allo stato: da quando la posa fatta ha
    //  un campo suo, `stato !== "venduto"` era vero anche su una posa appena
    //  eseguita — e il gruppo restava aperto per sempre.
    return g.items.some((l) => !posaCompletata(l)) ? 1 : 4;
  };
  return [...gruppi].sort((a, b) => {
    const pa = peso(a);
    const pb = peso(b);
    if (pa !== pb) return pa - pb;
    //  Dentro il passato si scende dal più recente; nel futuro si sale.
    return pa === 1 || pa === 4
      ? b.giorno.localeCompare(a.giorno)
      : a.giorno.localeCompare(b.giorno);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. LE SCRITTURE — tutto ciò che una posa può cambiare, in un posto solo
   ═════════════════════════════════════════════════════════════════════════ */

/** Quello che la finestra dell'incasso può dire in più del semplice "sì".
 *  Entrambi facoltativi: senza opzioni si incassa tutto il saldo e la pratica
 *  si chiude, che è il gesto di nove volte su dieci. */
export interface OpzioniIncasso {
  /** quanto è stato incassato davvero (default: tutto il saldo aperto) */
  importo?: number;
  /** true = con questo incasso la pratica è conclusa (default: se non resta
   *  niente da incassare) */
  concludi?: boolean;
  /** ── IL GIORNO IN CUI È SUCCESSO, QUANDO NON È OGGI ────────────────────
   *  Serve per le pose registrate DOPO: quelle già eseguite che non erano mai
   *  state programmate, e che si mettono in archivio settimane più tardi.
   *  Assente = oggi, che è il caso normale (si registra col cliente davanti).
   *  ⚠️ Vale anche per la cassa, non solo per la posa: registrare a settembre
   *   un saldo incassato a luglio con la data di oggi sposta quei soldi nel
   *   mese sbagliato, e i conti del mese non tornano più senza che nessuno
   *   sappia perché. */
  giorno?: string;
  /** Il giorno in cui la posa è stata ESEGUITA, da scrivere insieme al resto.
   *  ⚠️ Sta qui e non in una seconda `updateLead` perché `updateLead`
   *   SOSTITUISCE il campo intero: due scritture di fila su `installazione`
   *   partono entrambe dalla stessa copia vecchia, e la seconda cancella quello
   *   che ha appena scritto la prima. */
  dataPosa?: string;
  /** ── ⚠️ L'INCASSO DIVISO IN PIÙ PARTI ──────────────────────────────────
   *  Richiesta del committente: una parte con l'IVA compresa e un'altra con un
   *  trattamento diverso, incassate nello stesso momento. Succede davvero —
   *  un pezzo pagato in contanti con il prezzo comprensivo e il resto
   *  fatturato al netto.
   *  Quando c'è, `importo` e il `modo` passato alla funzione NON si guardano:
   *  comandano le parti. Due strade per la stessa cifra sarebbero due cifre.
   *  ⚠️ È QUI E NON IN UNA SECONDA FUNZIONE. Una `incassaDiviso()` accanto a
   *   questa avrebbe voluto dire due posti in cui si scrive in cassa, e la
   *   prossima regola sull'IVA sarebbe finita in uno solo dei due. */
  parti?: ParteIncasso[];
  /** ── ⚠️ QUANTO DI QUESTO INCASSO È IN CONTANTI ──────────────────────────
   *  Richiesta del committente: registrando una posa già fatta mancava del
   *  tutto la parte tracciata, e chi incassava il saldo non aveva dove dire
   *  che 200 erano arrivati per bonifico e 230 in mano.
   *  `undefined` = non è stato detto, e allora NON si tocca quello che era
   *  stato dichiarato alla vendita: zero vorrebbe dire «tutto tracciato»,
   *  che è una dichiarazione, non un silenzio.
   *  ⚠️ Il tracciato non si passa: è `importo − contanti`, e due numeri per la
   *   stessa cifra sono due cifre. Il conto — e soprattutto come si somma a
   *   quello che era già in cassa senza contarlo due volte — sta tutto in
   *   crm/canale-incasso. */
  contanti?: number;
  /** ── ⚠️ LO SCONTO FATTO ALLA CONSEGNA ──────────────────────────────────
   *  Richiesta del committente: lo sconto si toglie da «Registra la vendita»
   *  (là si scrive solo quanto deve pagare) e si scrive QUI, che è il momento
   *  in cui il prezzo vero si sa davvero — il cliente è davanti, la posa è
   *  fatta, e «le tolgo cinquanta» si dice adesso, non tre settimane prima.
   *  È la CIFRA CHE SI TOGLIE, non il prezzo finale: è il verso in cui la frase
   *  esce di bocca, e non chiede una sottrazione a mente mentre si parla.
   *  ⚠️ ABBASSA IL PREZZO DELLA PRATICA, quindi cambia il margine, l'IVA
   *   scorporata e le tasse: `prezzoFinaleVendita` scende e `prezzoTotale`
   *   conserva il prezzo di partenza, che è l'unico modo per sapere dopo
   *   quanto si è scontato. Da lì in poi tutti i conti del CRM si aggiornano
   *   da soli, perché leggono già quei due campi. */
  sconto?: number;
  /** ── ⚠️ I COSTI AVUTI SU QUESTA POSA ───────────────────────────────────
   *  Richiesta del committente: «fai che posso aggiungere anche costi extra se
   *  voglio e li sottrae dal profitto». Sono le voci scritte a mano di
   *  `payment.costi.altri` — il corriere, il rimborso, il ritocco — e il
   *  margine le sottrae già da sé: `totaleCostiPratica` (crm/costi-pratica) è
   *  l'unico posto in cui si sommano, e kpi-netto legge da lì.
   *  ⚠️ È L'ELENCO INTERO, non un'aggiunta: chi lo passa ha in mano la lista
   *   completa e la sostituisce. Un elenco «da aggiungere» avrebbe duplicato
   *   ogni voce a ogni riapertura della finestra.
   *  ⚠️ E passa DA QUI e non da una seconda `updateLead`: due scritture di fila
   *   sullo stesso lead partono dalla stessa copia vecchia, e la seconda
   *   cancella quello che ha appena scritto la prima. */
  altriCosti?: VoceCosto[];
  /** ── ⚠️ IL PREZZO E IL GIÀ VERSATO, CORRETTI QUI ────────────────────────
   *  Richiesta del committente: «fai che da qui posso modificare anche la
   *  somma dell'acconto che ha pagato». Registrando una posa vecchia il conto
   *  scritto in cassa è spesso quello sbagliato — l'acconto preso a mano e mai
   *  segnato, il prezzo cambiato a voce — e finora questa finestra lo poteva
   *  solo LEGGERE: si correggeva da un'altra schermata, cioè quasi mai.
   *  ⚠️ `prezzo` è il PATTUITO, prima dello sconto: lo sconto si toglie da lui
   *   (vedi `sconto`), e passarlo già scontato lo toglierebbe due volte.
   *  ⚠️ `versato` è quanto era in cassa PRIMA di questo incasso. Su di lui si
   *   fa anche il conto di tracciato e contanti (crm/canale-incasso), quindi
   *   correggerlo qui li tiene allineati invece di lasciarli indietro.
   *  Assenti = si legge la scheda, com'è sempre stato. */
  prezzo?: number;
  versato?: number;
}

/** Una parte di un incasso diviso: quanto, e come ci sta dentro l'IVA. */
export interface ParteIncasso {
  importo: number;
  modo: ModoIva;
}

/** Le azioni che governano una posa. Ognuna lascia per qualche secondo un
 *  "Annulla": è ciò che rende accettabile agire con un tocco solo.
 *  Saldo e completamento restano DUE comandi separati: il saldo a volte si
 *  incassa dopo (bonifico, rata), quindi "installazione fatta" e "soldi presi"
 *  non possono essere lo stesso pulsante — altrimenti la cassa risulta
 *  incassata quando non lo è. */
export function useAzioniInstallazione() {
  const { updateLead } = useCRM();

  /** Registra l'incasso del saldo. `modo` dice COME l'IVA sta dentro il prezzo
   *  pattuito, ed è l'unico dato che il calcolo del margine non può dedurre da
   *  solo (payment.costi.ivaInclusa scorpora ÷1,22 in kpi-calcoli.ts): da qui in
   *  poi resta scritto per esteso in `payment.incassoSaldo` — modo, aliquota e
   *  data comprese — perché il netto lo calcola un'altra pagina e non deve
   *  indovinare niente.
   *
   *  ⚠️ CON «aggiunta» QUESTA FUNZIONE ALZA IL PREZZO DELLA PRATICA. È l'unica
   *   delle tre scelte che tocca quello che il cliente deve, non solo quello che
   *   noi guadagniamo: il pattuito era al netto, il totale diventa +22% e il
   *   saldo cresce della stessa cifra. Il conto lo fa `contoIva` (crm/iva) e non
   *   una moltiplicazione scritta qui — è la stessa che vede a schermo chi
   *   sceglie, quindi il numero sul riquadro e il numero in cassa non possono
   *   discostarsi.
   *
   *  ⚠️ E PER LO STESSO MOTIVO IL SALDO SI RICALCOLA DOPO, non prima: leggendo
   *   `saldoAllaConsegna` all'inizio — com'era — una pratica già pagata per
   *   intero avrebbe avuto saldo zero e la funzione sarebbe uscita subito,
   *   lasciando l'IVA da aggiungere sul tavolo senza dire niente a nessuno.
   *   Il caso non è teorico: è esattamente quello di chi ha saldato al netto e
   *   se ne accorge alla consegna. */
  /** ⚠️ TORNA `false` QUANDO NON HA SCRITTO NIENTE, e serve: questa funzione
   *  esce in silenzio in due casi — non c'è saldo aperto, o l'importo è zero —
   *  e chi la chiama non aveva modo di accorgersene. Il primo caso è quello che
   *  ha morso davvero: registrando all'indietro una posa di un cliente che
   *  aveva già pagato tutto, la finestra si chiudeva e in archivio non finiva
   *  NIENTE — né la cassa né il giorno della posa. Nessun errore, nessun
   *  avviso: solo un lavoro che sembrava fatto. */
  const incassaSaldo = async (
    l: Lead,
    modo: ModoIva,
    opzioni?: OpzioniIncasso,
  ): Promise<boolean> => {
    const conIva = conIvaBool(modo);
    //  Quando è successo. Vedi `giorno` in OpzioniIncasso: quasi sempre oggi.
    const quando = opzioni?.giorno || giornoISO();
    //  Quanto era già in cassa: quello scritto sulla scheda, oppure la
    //  correzione fatta a mano in questa finestra (vedi `versato`).
    const versatoPrec = Math.max(0, Number(opzioni?.versato ?? giaIncassato(l)) || 0);
    //  Il pattuito: il prezzo di listino della pratica, oppure — sulle schede
    //  d'archivio che un prezzo non ce l'hanno — quello che si ricava da cassa
    //  e residuo. È la stessa cifra di ripiego usata più sotto, e sta qui perché
    //  è su di lei che si applica l'IVA.
    const listino =
      opzioni?.prezzo !== undefined
        ? Math.max(0, Number(opzioni.prezzo) || 0)
        : prezzoVendita(l) > 0
          ? prezzoVendita(l)
          : versatoPrec + saldoAllaConsegna(l);
    /* ── ⚠️ LO SCONTO SI TOGLIE PRIMA DELL'IVA, non dopo ────────────────────
       Scontare il totale ivato vorrebbe dire regalare anche l'imposta su quella
       parte, e poi versarla comunque: si sconta il prezzo, e l'IVA si calcola
       su quello che resta — che è anche l'unico ordine che la fattura può
       ripetere.
       ⚠️ Mai più del prezzo: uno sconto più grande darebbe una pratica dal
        valore negativo, che in cassa non vuol dire niente. */
    const pattuito = prezzoScontato(listino, opzioni?.sconto);
    const sconto = Math.round((listino - pattuito) * 100) / 100;

    /* ── ⚠️ UNA PARTE SOLA O PIÙ PARTI: LO STESSO CONTO ────────────────────
       Senza `parti` si comporta come si è sempre comportata: l'IVA scelta
       descrive il PREZZO PATTUITO, e con «aggiunta» quel prezzo sale del 22%.
       Con le parti la domanda cambia: ogni parte è una cifra che è entrata,
       e il prezzo sale soltanto dell'IVA che qualcuno ha dichiarato da
       aggiungere su quella parte — non del 22% di tutto.
       ⚠️ Il conto dell'IVA lo fa sempre `contoIva` (crm/iva), la stessa
        funzione che disegna i numeri a schermo: una moltiplicazione scritta
        qui farebbe vedere un totale e metterne in cassa un altro. */
    const parti = (opzioni?.parti ?? []).filter((p) => (Number(p.importo) || 0) > 0);
    const divisa = parti.length > 0;
    const conti = parti.map((p) => contoIva(Number(p.importo) || 0, p.modo));
    //  Quanto sale il prezzo della pratica: solo l'IVA delle parti dichiarate
    //  al netto. Con una parte sola «aggiunta» torna esattamente il conto di
    //  prima; senza parti «aggiunta», idem.
    const ivaDaAggiungere = divisa
      ? conti.reduce((s, c) => s + (c.modo === "aggiunta" ? c.imposta : 0), 0)
      : 0;
    const conto = divisa
      ? {
          ...contoIva(pattuito, "inclusa"),
          totale: Math.round((pattuito + ivaDaAggiungere) * 100) / 100,
        }
      : contoIva(pattuito, modo);
    //  Con «inclusa» e «senza» il totale è identico al pattuito, quindi il saldo
    //  qui sotto è lo stesso di sempre: il comportamento cambia SOLO scegliendo
    //  «aggiunta».
    const saldo = Math.max(0, conto.totale - versatoPrec);
    //  ⚠️ UNO SCONTO È UNA COSA DA SCRIVERE ANCHE SENZA INCASSO. Le due uscite
    //   in silenzio qui sotto esistono per non scrivere niente quando non è
    //   successo niente; ma se qualcuno ha appena tolto cinquanta euro al
    //   prezzo, è successo — e uscire di qui lascerebbe la pratica al prezzo
    //   pieno senza dire una parola. Succede sul serio: il cliente che aveva
    //   già pagato tutto e a cui si fa uno sconto alla consegna.
    //  Anche dei costi da scrivere sono una cosa successa: vale lo stesso
    //  ragionamento dello sconto, due righe più su.
    const daScrivere =
      sconto > 0 ||
      !!opzioni?.altriCosti ||
      //  Anche una correzione del prezzo o del già versato è una cosa
      //  successa: senza, un acconto corretto su una pratica già saldata non
      //  arriverebbe mai in archivio.
      (opzioni?.prezzo !== undefined && opzioni.prezzo !== prezzoVendita(l)) ||
      (opzioni?.versato !== undefined && opzioni.versato !== giaIncassato(l));
    if (saldo <= 0 && !daScrivere) return false;
    //  Quanto è stato incassato DAVVERO: se non viene detto vale tutto il saldo
    //  (il caso normale). Si accetta anche una cifra parziale — il cliente che
    //  lascia metà e salda per bonifico esiste — ma mai più del dovuto: un
    //  incasso più grande del saldo produrrebbe un residuo negativo, e
    //  "-120 € da incassare" non vuol dire niente per nessuno.
    const incassato = divisa
      ? Math.min(Math.round(conti.reduce((s, c) => s + c.totale, 0) * 100) / 100, saldo)
      : Math.min(Math.max(Number(opzioni?.importo ?? saldo) || 0, 0), saldo);
    if (incassato <= 0 && !daScrivere) return false;
    const restante = Math.max(0, saldo - incassato);
    /* ── ⚠️ TRACCIATO E CONTANTI DI QUESTO MOVIMENTO ───────────────────────
       Si dichiara il contante; il tracciato è il resto. `null` quando non è
       stato detto niente: in quel caso quello che era stato dichiarato alla
       vendita resta com'è, perché registrare una posa senza rispondere alla
       domanda non è una risposta.
       ⚠️ I TOTALI DELLA PRATICA NON SI SOMMANO A MANO. La vendita dichiara
        come entrerà il TOTALE quando in cassa c'è solo l'acconto: sommarci
        sopra il saldo di adesso farebbe più contanti del prezzo. La regola —
        della vendita vale solo la quota già entrata, del saldo vale il fatto —
        sta in crm/canale-incasso, che è anche il posto in cui è messa alla
        prova. */
    const canaleOra = canaleDopoIncasso({
      versatoPrima: versatoPrec,
      tracciatoPrima: l.data.payment?.incassoTracciato,
      contantiPrima: l.data.payment?.incassoContanti,
      incassato,
      contantiOra: opzioni?.contanti,
    });
    //  Come si divide movimento per movimento: con l'incasso diviso in parti il
    //  contante dichiarato è uno solo e si spalma in proporzione.
    const divisioni = ripartisciCanale(
      divisa ? conti.map((c) => c.totale) : [incassato],
      opzioni?.contanti,
    );
    //  Chiude la pratica? Se non lo si dice, lo dicono i soldi: saldo a zero =
    //  posa completata.
    const concludi = opzioni?.concludi ?? restante === 0;

    /*  ⚠️ IL «PRIMA» DI «ANNULLA» VIENE DALLA RIGA VERA, non dalla copia a
        schermo: è quello che il tasto rimetterà, e rimettere una copia vecchia
        vorrebbe dire cancellare con «Annulla» un incasso registrato nel
        frattempo da un'altra postazione — cioè lo stesso guasto, con un tasto
        che promette l'opposto. Si riempiono dentro la modifica, che
        `updateLead` esegue dopo aver riletto la scheda. */
    /*  ⚠️ PARTONO DALLA COPIA A SCHERMO E VENGONO SOSTITUITI DA QUELLA VERA.
        Il valore di partenza non è un ripiego pigro: se il salvataggio non
        arriva mai a comporre la modifica — scheda sparita dall'archivio,
        lettura fallita — questi resterebbero vuoti, e «Annulla» scriverebbe
        `payment: undefined`, cioè cancellerebbe il conto invece di rimetterlo
        com'era. Con il valore di prima, nel caso peggiore «Annulla» fa quello
        che faceva ieri. */
    let pagamentoPrec: PagamentoConIncasso | undefined = l.data.payment as
      | PagamentoConIncasso
      | undefined;
    let statoPrec: LeadStatus | undefined = l.data.stato;
    const totaleVersato = versatoPrec + incassato;
    //  Il modello rappresenta "quanto è entrato" con `accontoPagato`, e il
    //  residuo è prezzo − versato: statoPagamento lo ricalcola applyAutoStatus,
    //  come fa la scheda del lead. Per le pratiche d'archivio senza prezzo (dove
    //  il saldo arriva da `saldoRimanente`) il prezzo diventa versato + residuo
    //  — lasciare zero manderebbe a zero anche la vendita nelle KPI.
    //  ⚠️ IL PREZZO ADESSO ARRIVA DAL CONTO DELL'IVA, non più direttamente dal
    //   listino: con «aggiunta» è il pattuito +22%, con le altre due è il
    //   pattuito e basta. Riscriverlo qui da `prezzoVendita` avrebbe salvato in
    //   cassa un saldo calcolato sul totale con IVA e un prezzo senza — cioè
    //   una pratica che chiede al cliente più di quanto dice di valere.
    const prezzo = conto.totale;
    /*  ── ⚠️ SI COMPONE SULLA RIGA VERA, NON SU QUELLA A SCHERMO ────────
        `payment` si riscrive per intero, e comporlo sulla copia che il browser
        ha in memoria vuol dire riportare indietro quello che un collega ci ha
        scritto dentro nel frattempo — un incasso registrato da un'altra
        postazione, una riga del registro. Qui dentro si scrivono soldi.
        `updateLead` esegue questa funzione DOPO aver riletto la scheda
        dall'archivio: vedi crm/patch-scheda. */
    const componiPagamento = (attuale: LeadData): PagamentoConIncasso => ({
      ...attuale.payment,
      //  ⚠️ IL PREZZO DI PARTENZA RESTA SCRITTO. `prezzoTotale` è il listino e
      //   `prezzoFinaleVendita` quello a cui si è chiuso: senza il primo, uno
      //   sconto fatto qui sparirebbe nel prezzo più basso e nessuno saprebbe
      //   più che c'era. Si scrive solo scontando, e solo se il listino di
      //   prima non era già più alto (una pratica scontata due volte parte dal
      //   prezzo pieno, non dal già scontato).
      ...(sconto > 0
        ? {
            prezzoTotale: Math.max(
              Number(attuale.payment?.prezzoTotale ?? 0) || 0,
              divisa ? listino : contoIva(listino, modo).totale,
            ),
          }
        : {}),
      prezzoFinaleVendita: prezzo,
      accontoPagato: totaleVersato,
      saldoRimanente: restante,
      dataPagamento: attuale.payment?.dataPagamento || quando,
      //  ⚠️ Con l'incasso diviso «c'era l'IVA» vale se ALMENO UNA parte la
      //   portava: è la lettura che serve al margine storico (kpi-netto legge
      //   questo booleano). Il dettaglio esatto, parte per parte, sta nel
      //   registro qui sotto — ed è da lì che si fa la contabilità vera.
      costi: {
        ...attuale.payment?.costi,
        ivaInclusa: divisa ? conti.some((c) => c.imposta > 0) : conIva,
        //  I costi scritti a mano su questa pratica: il margine li sottrae da
        //  solo (vedi `altriCosti` in OpzioniIncasso).
        ...(opzioni?.altriCosti ? { altri: opzioni.altriCosti } : {}),
      },
      //  ⚠️ Si scrivono SOLO se qualcuno ha dichiarato: l'assente non vuol dire
      //   zero (vedi `incassoTracciato` in types.ts), e una pratica su cui non
      //   si è mai detto niente non deve diventare «tutto tracciato».
      ...(canaleOra
        ? { incassoTracciato: canaleOra.tracciato, incassoContanti: canaleOra.contanti }
        : {}),
      //  ⚠️ Anche questo riassunto si riscrive solo se è entrato qualcosa:
      //   registrando uno sconto su una pratica già saldata, un «ultimo
      //   incasso da 0 €» cancellerebbe quello vero di prima.
      ...(incassato <= 0 ? {} : { incassoSaldo: {
        conIva: divisa ? conti.some((c) => c.imposta > 0) : conIva,
        //  Il modo dell'ultimo movimento: con le parti si scrive quello della
        //  parte più grossa, che è il riassunto meno sbagliato possibile in un
        //  campo che ne accetta uno solo.
        modoIva: divisa ? [...conti].sort((a, b) => b.totale - a.totale)[0].modo : modo,
        aliquotaIva: conto.aliquota,
        importo: incassato,
        totaleIncassato: totaleVersato,
        data: quando,
      } }),
      //  ── IL REGISTRO ────────────────────────────────────────────────────
      //   Una riga per movimento, con la sua IVA già calcolata: è l'unico
      //   posto in cui un incasso diviso resta scritto per intero.
      //  ⚠️ A INCASSO ZERO non si aggiunge nessuna riga: succede registrando
      //   uno sconto su una pratica già saldata, e un movimento da 0 € nel
      //   registro degli incassi è una riga che qualcuno dovrà spiegare.
      incassi: [
        ...(Array.isArray(attuale.payment?.incassi) ? attuale.payment.incassi : []),
        ...(incassato <= 0
          ? []
          : divisa
          ? conti.map((c, i) => ({
              id: `i${Date.now().toString(36)}${i}`,
              data: quando,
              importo: c.totale,
              modoIva: c.modo,
              aliquota: c.aliquota,
              imposta: c.imposta,
              ...(divisioni[i] ?? {}),
            }))
          : [
              {
                id: `i${Date.now().toString(36)}`,
                data: quando,
                importo: incassato,
                modoIva: modo,
                aliquota: conto.aliquota,
                //  Quanta IVA c'è dentro QUESTO movimento, non dentro il
                //  prezzo: si scorpora la cifra entrata.
                imposta:
                  modo === "senza"
                    ? 0
                    : Math.round((incassato - incassato / (1 + conto.aliquota / 100)) * 100) / 100,
                //  Il registro è l'unico posto in cui resta scritto com'è
                //  entrato OGNI singolo movimento: i due campi sulla pratica
                //  sono il riassunto, questo è il dettaglio.
                ...(divisioni[0] ?? {}),
              },
            ]),
      ],
    });
    await updateLead(l.id, (attuale) => ({
      payment: ((): PagamentoConIncasso => {
        pagamentoPrec = attuale.payment as PagamentoConIncasso | undefined;
        statoPrec = attuale.stato;
        return componiPagamento(attuale);
      })(),
      //  Pratica conclusa = posa completata: si sposta fra le completate.
      //  Lasciare il segno indietro obbligherebbe a un secondo passaggio su
      //  un'altra pagina per dire una cosa che i soldi hanno già detto. Se
      //  invece resta aperta non si tocca niente: una pratica con un residuo
      //  dichiarata completata sparirebbe dalla coda del lavoro.
      //  ⚠️ Si scrive il GIORNO DELLA POSA, non lo stato del lead. Prima qui
      //   c'era `stato: "venduto"`, e oggi quella riga farebbe due danni in
      //   uno: cancellerebbe la chiusura vinta appena registrata (con dentro il
      //   modo di consegna — cioè non si saprebbe più se il pacco va spedito o
      //   se il cliente viene da noi) e riscriverebbe uno stato che non è più
      //   assegnabile. Il resto di `installazione` si ricopia: `updateLead`
      //   sostituisce il campo intero, non lo fonde.
      ...(concludi
        ? {
            installazione: {
              //  Anche qui dalla riga vera: il tecnico o le note della posa
              //  scritti da un altro non devono sparire perché qui si segna
              //  «completata».
              ...(attuale.installazione ?? {}),
              //  Il giorno della posa si scrive solo se ci è stato detto: per
              //  una posa di oggi è già in agenda, e riscriverlo qui sarebbe
              //  un modo di spostarlo per sbaglio.
              ...(opzioni?.dataPosa ? { dataInstallazione: opzioni.dataPosa } : {}),
              completataIl: quando,
            },
          }
        : {}),
    }));
    //  ⚠️ SE IL TOTALE È SALITO, LO DICE IL MESSAGGIO. «Aggiungi IVA» cambia
    //   quanto deve il cliente, e un aumento del 22% che passa senza una parola
    //   si scopre alla telefonata dopo — quando la cifra da chiedere non è più
    //   quella detta di persona mezz'ora prima.
    toast.success(
      `${sconto > 0 ? `Sconto ${eur(sconto)} · ` : ""}Incassato ${eur(incassato)} ${
        modo === "aggiunta"
          ? `· IVA ${ALIQUOTA_IVA}% aggiunta, totale ${eur(prezzo)}`
          : conIva
            ? `con IVA ${ALIQUOTA_IVA}%`
            : "senza IVA"
      } · versato ${eur(totaleVersato)} · ${nomeCompleto(l)}`,
      {
        //  ⚠️ Il taglio fra tracciato e contante si dice QUI, non solo dentro
        //   la finestra che si è appena chiusa: è la conferma che la
        //   dichiarazione è stata registrata, ed è l'ultimo momento in cui
        //   «Annulla» è ancora a un centimetro di distanza.
        description: `${
          divisioni[0] ? `${eur(divisioni[0].tracciato)} tracciati · ${eur(divisioni[0].contanti)} in contanti. ` : ""
        }${
          concludi
            ? restante > 0
              ? `Pratica conclusa con ${eur(restante)} ancora da incassare: la trovi fra le completate.`
              : "Installazione completata: la trovi fra le pose completate."
            : `Restano ${eur(restante)} da incassare: la pratica resta in lavorazione.`
        }`,
        action: {
          label: "Annulla",
          onClick: () => void updateLead(l.id, { payment: pagamentoPrec, stato: statoPrec }),
        },
      },
    );
    return true;
  };

  /** ── IL PREZZO CHE MANCAVA ───────────────────────────────────────────────
   *  Scrive il totale della pratica in `prezzoFinaleVendita`, lo stesso campo su
   *  cui la scheda del lead fa i suoi conti: da lì `saldoAllaConsegna` ricava da
   *  sola quanto resta (prezzo − già versato). Non si tocca né il calcolo del
   *  saldo né la finestra dell'incasso — qui si mette il dato che mancava, il
   *  resto continua a funzionare come prima.
   *
   *  `saldoRimanente` viene riallineato nello stesso momento: è il ripiego che
   *  le pratiche d'archivio usano quando il prezzo non c'è, e lasciarlo indietro
   *  significherebbe tenere in scheda due residui diversi per la stessa posa. */
  const impostaImportoTotale = async (l: Lead, totale: number) => {
    const versato = giaIncassato(l);
    //  Mai sotto quello che è già in cassa: un prezzo più basso del versato
    //  produrrebbe un residuo negativo, e "-120 € da incassare" non vuol dire
    //  niente per nessuno. La finestra lo impedisce già, ma questa è la
    //  scrittura e deve reggere da sola.
    const importo = Math.max(Number(totale) || 0, versato);
    if (importo <= 0) return;
    const restante = Math.max(0, importo - versato);
    //  Anche qui il «prima» viene dalla riga vera, con la copia a schermo come
    //  valore di partenza: vedi sopra il perché.
    let pagamentoPrec: PagamentoConIncasso | undefined = l.data.payment as
      | PagamentoConIncasso
      | undefined;
    //  Dalla riga vera: `payment` si riscrive intero, e partire dalla copia a
    //  schermo cancellerebbe un incasso registrato altrove nel frattempo.
    await updateLead(l.id, (attuale) => {
      pagamentoPrec = attuale.payment as PagamentoConIncasso | undefined;
      return {
        payment: {
          ...attuale.payment,
          prezzoFinaleVendita: importo,
          saldoRimanente: restante,
        } as PagamentoConIncasso,
      };
    });
    toast.success(`Importo impostato: ${eur(importo)} · ${nomeCompleto(l)}`, {
      description:
        restante > 0
          ? `Già versato ${eur(versato)} · totale ${eur(importo)} · resta ${eur(restante)} da incassare.`
          : `Il cliente ha già versato tutto: non resta niente da ritirare.`,
      action: {
        label: "Annulla",
        onClick: () => void updateLead(l.id, { payment: pagamentoPrec }),
      },
    });
  };

  const segnaCompletata = async (l: Lead, quando?: { giorno?: string; dataPosa?: string }) => {
    if (posaCompletata(l)) return;
    //  ⚠️ SI SEGNA LA POSA, NON SI RISCRIVE LO STATO. Il gesto qui è «il
    //   tecnico ha finito», e lo stato del lead risponde a un'altra domanda —
    //   «ha comprato, e come gli arriva l'impianto». Scrivendo "venduto", come
    //   si faceva prima, si cancellava la chiusura vinta registrata alla
    //   vendita: un impianto «Da spedire» tornava un generico venduto, e il
    //   pacco non lo preparava più nessuno perché quell'informazione era
    //   sparita dalla riga. Il precedente da rimettere con «Annulla» è quindi
    //   la vecchia installazione, non il vecchio stato.
    const precedente = l.data.installazione;
    await updateLead(l.id, {
      installazione: {
        ...(precedente ?? {}),
        ...(quando?.dataPosa ? { dataInstallazione: quando.dataPosa } : {}),
        completataIl: quando?.giorno || giornoISO(),
      },
    });
    toast.success(`Installazione completata · ${nomeCompleto(l)}`, {
      action: {
        label: "Annulla",
        onClick: () => void updateLead(l.id, { installazione: precedente ?? {} }),
      },
    });
  };

  /** Torna indietro da "completata": si toglie il giorno della posa e basta.
   *  ⚠️ LO STATO NON SI TOCCA PIÙ, ed è la correzione di un guasto vero. Prima
   *   qui si scriveva "acconto" oppure "fatto", perché "venduto" era insieme
   *   «ha comprato» e «posa fatta» e per disfare la seconda bisognava disfare
   *   anche la prima. Oggi sono due cose distinte, e riscrivere lo stato
   *   vorrebbe dire ANNULLARE LA VENDITA per correggere una spunta:
   *   il lead uscirebbe dai vinti, sparirebbe dal fatturato del mese e
   *   perderebbe il modo di consegna. Una pratica riaperta resta venduta — è
   *   solo di nuovo da installare.
   *  ⚠️ Resta il caso dell'ARCHIVIO: là «completata» è ancora lo stato
   *   "venduto" (vedi `posaFatta`), e su quelle schede togliere solo il campo
   *   non basterebbe perché il campo non c'è. Quelle si portano al vinto di
   *   oggi che corrisponde alla loro consegna, così la vendita resta contata e
   *   la posa torna da fare. */
  const riapriInstallazione = async (l: Lead) => {
    if (!posaCompletata(l)) return;
    const precedenteInst = l.data.installazione;
    const precedenteStato = l.data.stato;
    const inst = { ...(precedenteInst ?? {}) };
    delete inst.completataIl;
    const patch: Partial<LeadData> = { installazione: inst };
    if (l.data.stato === "venduto") {
      const modo = modoConsegna(l);
      patch.stato =
        modo === "spedizione"
          ? "posa_da_spedire"
          : modo === "domicilio"
            ? "posa_a_domicilio"
            : "posa_in_sede";
    }
    await updateLead(l.id, patch);
    toast.success(`Installazione di nuovo da fare · ${nomeCompleto(l)}`, {
      action: {
        label: "Annulla",
        onClick: () =>
          void updateLead(l.id, { installazione: precedenteInst ?? {}, stato: precedenteStato }),
      },
    });
  };

  /** ── DISFARE LA PROGRAMMAZIONE ──────────────────────────────────────────
   *  «Questa posa non andava fissata»: la persona sbagliata, il giorno
   *  sbagliato, o proprio il cliente sbagliato. Fino a ieri non c'era modo di
   *  tornare indietro — la finestra della posa PRETENDE giorno e ora per
   *  salvare, quindi una volta scritta la si poteva solo spostare, mai togliere
   *  — e la conseguenza non restava sulla riga: quel consulente risultava
   *  occupato in agenda (e il driver per tre ore prima e tre dopo) per un
   *  intervento che nessuno avrebbe fatto. Lo si scopriva solo quando qualcun
   *  altro non trovava più posto in quella giornata.
   *
   *  ⚠️ LO STATO NON SI TOCCA. Qui si disfa il «quando e con chi», non il «ha
   *   comprato»: lo stato resta dov'è, gli importi restano scritti, e la pratica
   *   torna semplicemente fra le pose da programmare — se contava nel fatturato
   *   continua a contarci, se non ci contava questo gesto non ce la mette.
   *   Chi vuole disfare la VENDITA usa il ritorno allo stato di
   *   prima (crm/TornaIndietroPosa), che porta via anche questa programmazione
   *   nello stesso salvataggio.
   *  Su una posa già fatta non si fa niente: un intervento avvenuto non è una
   *  prenotazione da cancellare — vedi `senzaProgrammazione`. */
  const togliProgrammazione = async (l: Lead) => {
    if (!posaProgrammata(l) || posaCompletata(l)) return;
    const precedente = l.data.installazione;
    //  ⚠️ DUE FRASI DIVERSE PERCHÉ SONO DUE FATTI DIVERSI. Le ore in agenda le
    //   blocca il GIORNO (booking-utils salta le pose senza `dataInstallazione`,
    //   e con loro le tre ore di strada del driver): su una posa a cui erano
    //   state scelte solo le persone non si libera niente, e annunciare uno
    //   sblocco che non c'è stato è il modo più rapido per far smettere di
    //   leggere anche i messaggi veri. Si guarda PRIMA di scrivere: dopo, la
    //   data non c'è più e la domanda non ha più una risposta.
    const bloccavaOre = !!precedente?.dataInstallazione;
    const ok = await updateLead(l.id, { installazione: senzaProgrammazione(precedente) });
    //  ⚠️ Senza questo controllo si direbbe «agenda libera» su una scrittura mai
    //   partita, e quella fascia verrebbe considerata disponibile da chi legge
    //   il messaggio e occupata da chi legge il calendario.
    if (!ok) {
      toast.error("Non è stato salvato: la posa resta programmata com'era. Riprova.");
      return;
    }
    toast.success(`Posa da riprogrammare · ${nomeCompleto(l)}`, {
      //  ⚠️ NON SI DICE «il cliente resta venduto»: questa voce si raggiunge
      //   anche da una pratica che venduta non è (basta una data di posa perché
      //   la riga entri nell'elenco delle installazioni — vedi `inLavorazione`
      //   in routes/CRM.installazioni.index), e una conferma che afferma una
      //   vendita inesistente è peggio di una conferma muta. Quello che è vero
      //   sempre è che questo gesto lo stato non lo tocca.
      description: `Giorno, ora, chi la esegue e il driver sono stati tolti${
        bloccavaOre ? ": quelle ore tornano libere in agenda" : ""
      }. Lo stato della pratica e gli importi restano com'erano.`,
      action: {
        label: "Annulla",
        onClick: () => void updateLead(l.id, { installazione: precedente ?? {} }),
      },
    });
  };

  const cambiaStatoMateriale = async (l: Lead, stato: StatoOrdine) => {
    if (l.data.statoOrdine === stato) return;
    const precedente = l.data.statoOrdine;
    await updateLead(l.id, { statoOrdine: stato });
    toast.success(`${ETICHETTA_ORDINE[stato]} · ${nomeCompleto(l)}`, {
      action: {
        label: "Annulla",
        onClick: () => void updateLead(l.id, { statoOrdine: precedente }),
      },
    });
  };

  /** Spunta un materiale della borsa. Si SOMMA a ciò che c'è già: tipo, note e
   *  orario sono lavoro fatto in fase di vendita e non devono sparire perché si
   *  è spuntata una casella. */
  const spuntaMateriale = async (l: Lead, indice: number) => {
    const attuale = checklistDi(l);
    const nuova = attuale.map((v, i) => (i === indice ? { ...v, done: !v.done } : v));
    //  Dalla riga vera: spuntare un materiale non deve cancellare il tecnico o
    //  il giorno che un collega ha appena scritto dentro `installazione`.
    await updateLead(l.id, (attuale) => ({
      installazione: { ...(attuale.installazione ?? {}), checklist: nuova },
    }));
  };

  /** ── I SOLDI IN PIÙ: «GLIEL'HO DETTO» / «NON ANCORA» ─────────────────────
   *  Il campo lo scrive la finestra della chiusura quando salta fuori che
   *  serve qualcosa in più (`extraDaChiedere`), e finché non risulta detto al
   *  cliente il lead porta un avviso ambra in tutti gli elenchi.
   *  ⚠️ QUELL'AVVISO NON SI POTEVA SPEGNERE DA NESSUNA PARTE. types.ts indica
   *   questa scheda come proprietaria del campo, ma qui non c'era una riga che
   *   lo scrivesse: una volta acceso, l'avviso restava addosso al lead per
   *   sempre. E un avviso che non si spegne è un avviso che in due settimane
   *   si impara a non vedere più — cioè, il giorno che ne compare uno vero,
   *   quei soldi non li chiede nessuno lo stesso.
   *  Si scrive da qui perché è qui che la domanda si fa: al momento della posa,
   *  col cliente al telefono per confermare giorno e saldo. */
  /** ── CORREGGERE O TOGLIERE LA CIFRA IN PIÙ ──────────────────────────────
   *  ⚠️ NON ESISTEVA NESSUN MODO DI FARLO, ed è stato il committente ad
   *   accorgersene: l'importo lo scrive la finestra della chiusura, che si
   *   riapre solo cambiando stato verso una chiusura vinta — e su una pratica
   *   che in quello stato ci sta già, non si riapre affatto. Una cifra
   *   sbagliata restava addosso al cliente per sempre, con l'avviso ambra
   *   acceso in tutti gli elenchi. Si poteva solo dichiararla «detta», cioè
   *   spegnere la spia invece di riparare il guasto.
   *  `importo` a zero o assente = non serve più: l'avviso si spegne e la voce
   *  sparisce dalla riga. Non si cancella il campo — resta `serve: false`, che
   *  è la traccia del fatto che una volta c'era. */
  const correggiExtra = async (l: Lead, importo: number) => {
    const extra = l.data.extraDaChiedere ?? {};
    const cifra = Math.max(0, Number(importo) || 0);
    const ok = await updateLead(l.id, {
      extraDaChiedere:
        cifra > 0
          ? { ...extra, serve: true, importo: cifra }
          : { ...extra, serve: false, importo: 0 },
    });
    if (!ok) {
      toast.error("Non è stato salvato: la scheda è rimasta com'era.");
      return;
    }
    toast.success(
      cifra > 0
        ? `${nomeCompleto(l)} · da chiedere ${eur(cifra)}`
        : `${nomeCompleto(l)} · non c'è più niente da chiedere`,
    );
  };

  const segnaExtraComunicato = async (l: Lead, detto: boolean) => {
    const extra = l.data.extraDaChiedere;
    if (!extra?.serve || !!extra.comunicatoAlCliente === detto) return;
    const ok = await updateLead(l.id, {
      extraDaChiedere: { ...extra, comunicatoAlCliente: detto },
    });
    //  ⚠️ Non si dice «fatto» senza aver guardato la risposta: qui si spegne un
    //   avviso che riguarda del denaro non ancora chiesto, e spegnerlo per
    //   sbaglio (o crederlo spento quando non lo è) costa esattamente quella
    //   cifra alla consegna.
    if (!ok) {
      toast.error("Non è stato salvato: l'avviso resta com'era. Riprova.");
      return;
    }
    toast.success(
      detto
        ? `Segnato come già detto al cliente · ${nomeCompleto(l)}`
        : `Torna fra le cose da dire al cliente · ${nomeCompleto(l)}`,
      {
        action: {
          label: "Annulla",
          onClick: () =>
            void updateLead(l.id, { extraDaChiedere: { ...extra, comunicatoAlCliente: !detto } }),
        },
      },
    );
  };

  return {
    incassaSaldo,
    impostaImportoTotale,
    segnaCompletata,
    riapriInstallazione,
    togliProgrammazione,
    cambiaStatoMateriale,
    spuntaMateriale,
    segnaExtraComunicato,
    correggiExtra,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. IL SALDO IN DUE TOCCHI
   ═════════════════════════════════════════════════════════════════════════ */

/** ── IL MICRO-PASSAGGIO ───────────────────────────────────────────────────
 *  Un tocco su "Saldato", un tocco sulla riga giusta, finito. Non c'è un
 *  pulsante di conferma in fondo: sarebbe un terzo tocco per confermare una
 *  scelta che è già una conferma, e l'errore si ripara con "Annulla" nel
 *  messaggio che compare subito dopo.
 *
 *  PERCHÉ SI CHIEDE L'IVA E NON ALTRO
 *  Con IVA il prezzo va scorporato prima di sottrarre i costi: è l'unico dato
 *  che il margine non può indovinare. Chiederlo qui — dove si incassa — costa
 *  un tocco; scoprirlo a fine mese costa una riconciliazione.
 *
 *  Lo stato vive DENTRO questo pulsante e non nella pagina, così l'azione
 *  funziona identica ovunque venga montata la barra delle azioni rapide. */
/** La finestra dell'incasso: UNA sola, montata sia dal tasto "Saldato" sia dal
 *  riquadro dell'importo. Chi la apre non cambia quello che si vede né quello
 *  che viene scritto — è la stessa domanda, fatta nello stesso modo.
 *
 *  Sopra la scelta c'è il conto del cliente: già in cassa, quanto entra adesso,
 *  totale. È la riga che si legge ad alta voce al cliente mentre si incassa. */
export function FinestraIncasso({
  lead,
  aperta,
  onCambio,
  /** ── LA STESSA FINESTRA, APERTA DA «FATTA» ───────────────────────────────
   *  Richiesta del committente: premendo che la posa è completata «deve
   *  risultare tutto saldato». Non è una seconda finestra — è questa, con tre
   *  differenze:
   *   · il titolo dice che si sta chiudendo, non che si sta incassando;
   *   · «la pratica si chiude» non è più una domanda: lo si è già detto premendo
   *     «Fatta», e richiederlo qui è far rispondere due volte alla stessa cosa;
   *   · se non resta niente da incassare la finestra non si rifiuta di lavorare:
   *     segna la posa e basta (vedi `conferma`).
   *  ⚠️ NON È UN SECONDO MODULO. Una copia di questa finestra per la chiusura
   *   avrebbe voluto dire due idee di «quanto resta» e due modi di scrivere
   *   l'IVA a due pulsanti di distanza. */
  chiudiLaPosa,
}: {
  lead: Lead;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  chiudiLaPosa?: boolean;
}) {
  const { incassaSaldo, segnaCompletata } = useAzioniInstallazione();
  const { versato, precedenti } = totaleIncassatoCliente(lead);
  //  ⚠️ Gli hook stanno tutti SOPRA qualunque ritorno: React li conta per
  //  posizione, e uno saltato in un render sposta tutti gli altri.
  const [testo, setTesto] = useState("");
  const [concludi, setConcludi] = useState(true);
  const [modo, setModo] = useState<ModoIva>(MODO_IVA_PREDEFINITO);
  const [inCorso, setInCorso] = useState(false);
  /* ── ⚠️ L'INCASSO DIVISO IN DUE ─────────────────────────────────────────
     Richiesta del committente: una parte con l'IVA compresa e un'altra con un
     trattamento diverso, nello stesso momento.
     ⚠️ SPENTO DI PARTENZA, E DIETRO UN INTERRUTTORE. Chi incassa lo fa quasi
      sempre in un colpo solo, col cliente davanti: due campi e due scelte
      d'IVA sempre a schermo avrebbero rallentato ogni singolo incasso per un
      caso su venti. Acceso, la finestra diventa quello che serve; spento,
      resta esattamente com'era. */
  const [divisa, setDivisa] = useState(false);
  const [testoB, setTestoB] = useState("");
  const [modoB, setModoB] = useState<ModoIva>("aggiunta");

  //  ── IL PATTUITO, E QUELLO CHE NE ESCE CON L'IVA SCELTA ──────────────────
  //   `pattuito` è la stessa cifra che legge la scrittura (vedi `incassaSaldo`):
  //   il prezzo della pratica, o il ripiego cassa+residuo per le schede
  //   d'archivio. Da lì il conto dell'IVA, e dal conto il saldo: con «aggiunta»
  //   sale il totale e sale il saldo, con le altre due non si muove niente.
  const pattuito =
    prezzoVendita(lead) > 0 ? prezzoVendita(lead) : versato + saldoAllaConsegna(lead);
  const conto = contoIva(pattuito, modo);
  const daIncassare = Math.max(0, conto.totale - versato);

  /** ── ⚠️ COSA PROPONE QUESTA FINESTRA APPENA SI APRE ────────────────────
   *  L'IVA parte da «senza», che è l'unico dei tre modi che non tocca il
   *  totale della pratica: «aggiunta» lo alza del 22%, «inclusa» lo lascia
   *  dov'è ma dichiara un'imposta dentro. Confermato senza guardare, non
   *  cambia niente di quello che il cliente deve. La parte con l'IVA si
   *  dichiara sotto e si scorpora da questo importo.
   *
   *  ⚠️ L'IMPORTO PROPOSTO È IL SALDO APERTO, TUTTO. Per un giro è stato
   *   l'acconto già versato, su richiesta, e il committente ha chiesto di
   *   rimetterlo com'era: chi incassa alla consegna prende quello che manca,
   *   ed è la risposta giusta quasi sempre. Si corregge scrivendoci sopra —
   *   chi lascia metà cifra non deve uscire di qui e cercare un'altra
   *   schermata.
   *
   *  ⚠️ ED È TORNATO UN EFFETTO SOLO. Con l'acconto ne servivano due, perché
   *   l'importo insegue l'IVA (vedi sotto) e il ricalcolo avrebbe cancellato
   *   la proposta appena scritta: c'era un `useRef` che faceva saltare il primo
   *   giro. Adesso proposta e ricalcolo dicono la stessa cosa — il saldo
   *   aperto — quindi quel meccanismo non serve più e se n'è andato con lui.
   *   Un pezzo di macchinario che non protegge più niente è solo una cosa in
   *   più che può rompersi.
   *
   *  Un importo lasciato da un'apertura precedente — magari di un altro
   *  cliente, sulla stessa riga riusata — resta il modo più silenzioso di
   *  scrivere in cassa una cifra sbagliata: per questo si riparte sempre da
   *  capo. */
  useEffect(() => {
    if (aperta) {
      /* ── ⚠️ I DUE VALORI DI PARTENZA VALGONO SU TUTTE E DUE LE APERTURE ──
         Questa finestra ha due mestieri: si apre da «Registra l'incasso» e da
         «Fatta». Per un giro i valori nuovi — l'acconto e «aggiungi 22%» —
         erano solo sul primo, e il committente ha chiesto di estenderli anche
         al secondo. Fatto.

         ⚠️ VA SAPUTO COSA COMPORTA, perché è il pulsante che si preme tutti i
          giorni: aprendo da «Fatta» e confermando senza guardare si registra
          l'ACCONTO — non il saldo aperto, quindi meno di quanto il cliente ha
          lasciato — e il totale della pratica sale del 22%, cioè si chiede al
          cliente più di quanto gli è stato detto a voce.
         L'unica cosa che lo impedisce è la riga in ambra qui sotto, che dice
          il rincaro in cifre. Non si toglie e non si smorza: è il freno di un
          gesto quotidiano.

         ⚠️ E IL VALORE DI PARTENZA È TORNATO PRUDENTE, su richiesta: «senza
          IVA». È l'unico dei tre che non tocca il totale della pratica —
          «aggiunta» lo alza del 22%, «inclusa» lo lascia dov'è ma dichiara
          un'imposta dentro — quindi è quello che, confermato senza guardare,
          non cambia niente di quello che il cliente deve. La parte con l'IVA
          si dichiara sotto, e si scorpora da questo importo invece di
          sommarcisi. */
      setModo("senza");
      setConcludi(true);
      setInCorso(false);
      //  La divisione non si ricorda fra un'apertura e l'altra: lasciata
      //  accesa dalla pratica di prima, il secondo importo di un altro cliente
      //  finirebbe in cassa senza che nessuno l'abbia scritto.
      setDivisa(false);
      setTestoB("");
      //  La parte dichiarata è quasi sempre una fattura già emessa, e quelle
      //  hanno l'IVA dentro: «inclusa» è il valore di partenza giusto, e si
      //  cambia con un tocco.
      setModoB("inclusa");
    }
  }, [aperta]);

  //  ⚠️ L'IMPORTO PROPOSTO SEGUE L'IVA. Scegliendo «aggiungi 22%» il saldo
  //   cresce, e lasciare nel campo la cifra di prima vorrebbe dire proporre di
  //   incassare il netto sotto un totale lordo — cioè lasciare aperto proprio il
  //   ventidue per cento appena aggiunto. Si riscrive a ogni cambio di modo:
  //   è un gesto esplicito di chi guarda, non un ripensamento della macchina.
  //  ⚠️ TRANNE AL PRIMO GIRO, dove comanda la proposta dell'apertura —
  //   l'acconto (vedi l'effetto qui sopra). Senza questa eccezione la cifra
  //   proposta durerebbe un battito e poi tornerebbe il saldo, e l'impostazione
  //   chiesta dal committente non si vedrebbe mai.
  useEffect(() => {
    if (aperta) setTesto(scriviEuro(daIncassare));
  }, [aperta, daIncassare]);

  /* ── ⚠️ LA SECONDA PARTE SI SCORPORA, NON SI SOMMA ─────────────────────
     Richiesta del committente, ed è il rovescio di come funzionava un giro fa.
     Prima erano due importi che si sommavano: «ho preso 700 così e 300 così,
     in tutto 1000». Adesso l'importo è UNO — quello scritto sopra — e sotto si
     dichiara QUANTA PARTE di quell'importo è con l'IVA. I 300 escono dai 1000,
     non ci si aggiungono: il cliente ha dato mille euro, e mille restano.

     È il caso vero: si incassa una cifra sola e solo un pezzo viene fatturato.
     Sommandola, quel pezzo veniva contato due volte — una nell'importo e una
     nella parte — e in cassa finiva più denaro di quanto ne era entrato.

     ⚠️ LA PARTE NON PUÒ SUPERARE L'IMPORTO: si taglia lì. Dichiarare 1.200
      con IVA dentro un incasso da 1.000 lascerebbe una prima parte NEGATIVA, e
      un importo negativo in cassa non vuol dire niente per nessuno.

     ⚠️ RESTA UN CASO IN CUI IL TOTALE CAMBIA LO STESSO: scegliendo «aggiungi
      22%» sulla parte dichiarata, quei 300 sono un netto e l'imposta si somma
      davvero. Non è una contraddizione con lo scorporo — l'importo incassato
      resta quello scritto sopra — ma il PREZZO della pratica sale, e chi lo
      sceglie deve vederlo: lo dice la riga in ambra della sezione qui sotto.

     I conti li fa `contoIva` (crm/iva), la stessa funzione che li fa in
     scrittura: i numeri che si vedono qui e quelli che finiscono in archivio
     non possono discostarsi perché sono gli stessi. */
  const importoScritto = Math.max(0, leggiEuro(testo));
  //  La parte dichiarata, mai più grande dell'importo che la contiene.
  const parteDichiarata = divisa ? Math.min(Math.max(0, leggiEuro(testoB)), importoScritto) : 0;
  const contoB = contoIva(parteDichiarata, modoB);
  //  Quello che resta dell'importo dopo aver tolto la parte dichiarata: è la
  //  fetta che segue l'IVA scelta in cima.
  const contoA = contoIva(
    divisa ? Math.max(0, importoScritto - parteDichiarata) : importoScritto,
    modo,
  );
  const entrateDivise = Math.round((contoA.totale + (divisa ? contoB.totale : 0)) * 100) / 100;
  //  ⚠️ Il tetto sale solo per l'IVA che qualcuno ha chiesto di AGGIUNGERE: è
  //   l'unico caso in cui il prezzo della pratica cresce, e capitare sotto il
  //   vecchio tetto vorrebbe dire scartare proprio i soldi appena aggiunti.
  const tettoDiviso =
    daIncassare +
    (divisa
      ? (contoA.modo === "aggiunta" ? contoA.imposta : 0) +
        (contoB.modo === "aggiunta" ? contoB.imposta : 0)
      : 0);
  const incassato = divisa
    ? Math.min(entrateDivise, tettoDiviso)
    : Math.min(Math.max(leggiEuro(testo), 0), daIncassare);
  const restante = Math.max(0, (divisa ? tettoDiviso : daIncassare) - incassato);
  const totaleDopo = versato + incassato;
  const troppo = divisa ? entrateDivise > tettoDiviso : leggiEuro(testo) > daIncassare;
  //  Chiudendo dal tasto «Fatta» la domanda «si conclude?» non si fa: la
  //  risposta è già stata data premendo.
  const chiude = chiudiLaPosa ? true : concludi;

  const conferma = () => {
    if (inCorso) return;
    setInCorso(true);
    //  Si chiude PRIMA di scrivere: l'ultimo tocco deve sembrare istantaneo,
    //  il salvataggio si prende il tempo che gli serve.
    onCambio(false);
    //  ⚠️ NIENTE DA INCASSARE NON VUOL DIRE NIENTE DA FARE. Chi ha già pagato
    //   tutto e sceglie «senza IVA» o «IVA inclusa» arriva qui con zero euro da
    //   registrare: `incassaSaldo` uscirebbe subito senza scrivere, e la posa
    //   resterebbe da fare dopo che si è premuto «Fatta». Qui si segna e basta.
    if (incassato <= 0) {
      if (chiude) void segnaCompletata(lead);
      return;
    }
    void incassaSaldo(lead, modo, {
      importo: incassato,
      concludi: chiude,
      //  ⚠️ La prima parte è l'importo MENO quello dichiarato, non l'importo
      //   intero: è lo scorporo, ed è tutta la differenza fra registrare mille
      //   euro e registrarne milletrecento.
      ...(divisa
        ? {
            parti: [
              { importo: Math.max(0, importoScritto - parteDichiarata), modo },
              { importo: parteDichiarata, modo: modoB },
            ],
          }
        : {}),
    });
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      larghezza="sm"
      icona={chiudiLaPosa ? Check : Wallet}
      titolo={chiudiLaPosa ? "Installazione completata" : "Registra l'incasso"}
      contesto={
        chiudiLaPosa
          ? `${nomeCompleto(lead)} · ${daIncassare > 0 ? `${eur(daIncassare)} da saldare` : "niente da saldare"}`
          : `${nomeCompleto(lead)} · ${eur(daIncassare)} da incassare`
      }
      classeCorpo="space-y-3"
    >
      {/* ── I COSTI, IN CIMA ─────────────────────────────────────────────
          ⚠️ SPOSTATO QUI SU RICHIESTA DEL COMMITTENTE, e la sua ragione batte
           la mia. Io l'avevo messo sotto gli importi per non mettere delle
           caselle fra chi ha il telefono in mano e il pulsante che registra.
           Ma un blocco CHIUSO non è una casella: è una riga che dice un
           numero. E in cima quel numero si legge PRIMA di decidere quanto
           chiedere — che è il momento in cui serve, mentre sotto arrivava
           quando la cifra era già scritta.
          Il perché del resto sta in crm/CostiCollassabili. */}
      <CostiCollassabili lead={lead} />
      {/* ── L'IVA, PRIMA DELL'IMPORTO ──────────────────────────────────────
          ⚠️ ERA IN FONDO, ED ERA GIUSTO FINCHÉ NON CAMBIAVA NIENTE: due
           risposte, «comprende l'IVA?» sì o no, e il totale restava quello.
           Adesso una delle tre ALZA il totale del 22%, quindi va scelta prima —
           altrimenti si scrive una cifra, si sceglie l'IVA, e la cifra scritta
           un attimo prima non è più quella giusta. Chi legge la finestra
           dall'alto incontra le domande nell'ordine in cui contano: com'è il
           prezzo, e quindi quanto si incassa. */}
      <SezioneFinestra
        titolo="Com'è l'IVA su questo prezzo?"
        nota={`Sul pattuito di ${eur(pattuito)}. Resta scritta con l'aliquota: serve al calcolo del netto`}
        classeCorpo="p-3 space-y-2"
      >
        <ScegliIva modo={modo} onCambia={setModo} base={pattuito} />
        {conto.cambiaIlTotale && (
          /*  ── ⚠️ L'UNICO FRENO RIMASTO ────────────────────────────────
              Era una riga di testo in ambra e bastava, perché «aggiungi 22%»
              si sceglieva a mano ed era il caso raro. Adesso è il valore di
              PARTENZA su tutte e due le aperture di questa finestra (vedi la
              nota sull'effetto), quindi questo avviso è l'ultima cosa che sta
              fra un tocco distratto e una cifra chiesta al cliente più alta di
              quella detta a voce.
              Per questo ha un riquadro suo e non è più una riga di testo in
              mezzo alle altre: doveva pesare quanto il caso raro che
              descriveva, e adesso descrive il caso normale. */
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Il totale della pratica passa da {eur(pattuito)} a{" "}
              <strong className="font-semibold tabular-nums">{eur(conto.totale)}</strong>: sono{" "}
              <strong className="font-semibold tabular-nums">{eur(conto.imposta)}</strong> in più da
              chiedere al cliente.
            </span>
          </p>
        )}
      </SezioneFinestra>

      {/* ── QUANTO È STATO INCASSATO ──────────────────────────────────────
          Proposto il saldo aperto, perché è la risposta quasi sempre. Si
          corregge scrivendoci sopra: chi lascia metà cifra non deve uscire di
          qui e andare a cercare un'altra schermata. */}
      <SezioneFinestra
        titolo={chiudiLaPosa ? "Quanto ha saldato" : "Quanto è stato incassato"}
        nota="Proposto il saldo aperto: si può correggere"
        classeCorpo="p-3 space-y-2.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-slate-500">€</span>
          {/*  Campo di TESTO, non "number": in italiano si scrive 450,73 e un
              campo numerico rifiuta la virgola. La lettura la fa leggiEuro. */}
          <Input
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            inputMode="decimal"
            aria-label="Importo incassato in euro"
            placeholder="0,00"
            className={cn(CLASSE_CAMPO, "h-10 flex-1 text-[16px] font-semibold tabular-nums")}
          />
          {incassato !== daIncassare && daIncassare > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTesto(scriviEuro(daIncassare))}
              className="h-9 shrink-0 border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-100"
            >
              Tutto
            </Button>
          )}
        </div>

        {/* ── ⚠️ LA SECONDA PARTE, DIETRO UN INTERRUTTORE ─────────────────
            Chi incassa lo fa quasi sempre in un colpo solo, col cliente
            davanti: due campi e due scelte d'IVA sempre a schermo avrebbero
            rallentato ogni incasso per un caso su venti. Sta su una riga di
            testo, non su un pulsante grosso: si vede se la si cerca, non
            ingombra se non serve.
            Acceso, il campo qui sopra diventa «la prima parte» e sotto
            compare la seconda con la sua scelta d'IVA — che parte da
            «aggiunta», perché è il motivo per cui si divide un incasso. */}
        {!divisa ? (
          <button
            type="button"
            onClick={() => {
              setDivisa(true);
              //  La prima parte resta quello che c'è scritto; la seconda parte
              //  nasce vuota, perché è una cifra che nessuno ha ancora detto.
              setTestoB("");
            }}
            className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[12px] font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Una parte di questo importo è con l&apos;IVA
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Quanto, di quell&apos;importo, è con l&apos;IVA
              </span>
              <button
                type="button"
                onClick={() => {
                  setDivisa(false);
                  setTestoB("");
                }}
                className="text-[11.5px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              >
                Togli
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-slate-500">€</span>
              <Input
                value={testoB}
                onChange={(e) => setTestoB(e.target.value)}
                inputMode="decimal"
                aria-label="Parte dell'importo che è con l'IVA, in euro"
                placeholder="0,00"
                className={cn(CLASSE_CAMPO, "h-10 flex-1 text-[16px] font-semibold tabular-nums")}
              />
            </div>
            <ScegliIva modo={modoB} onCambia={setModoB} base={parteDichiarata} />

            {/*  ── COME SI DIVIDE L'IMPORTO ────────────────────────────────
                Le due fette per esteso, e in quest'ordine: quella dichiarata
                prima, perché è quella che si è appena scritta, e il resto
                dopo. Il «resto» è la cosa che chi scrive non sta calcolando —
                si scrive 300 su 1000 e non si pensa ai 700 — ed è proprio il
                numero che finisce in cassa con l'IVA scelta in cima. */}
            <div className="grid grid-cols-2 gap-2">
              <KpiFinestra
                etichetta="Con IVA"
                valore={eur(contoB.totale)}
                nota={contoB.imposta > 0 ? `${eur(contoB.imposta)} di imposta` : "nessuna imposta"}
              />
              <KpiFinestra
                etichetta="Il resto"
                valore={eur(contoA.totale)}
                nota={contoA.imposta > 0 ? `${eur(contoA.imposta)} di imposta` : "senza IVA"}
              />
            </div>

            {/*  ⚠️ Il caso in cui lo scorporo NON tiene: «aggiungi 22%» sulla
                parte dichiarata fa salire il prezzo della pratica per davvero.
                Va detto qui, accanto alla scelta, e non solo in cima. */}
            {contoB.modo === "aggiunta" && contoB.imposta > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11.5px] leading-snug text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Con l&apos;IVA da aggiungere questa parte non si scorpora: il totale della pratica
                  sale di{" "}
                  <strong className="font-semibold tabular-nums">{eur(contoB.imposta)}</strong>.
                </span>
              </p>
            )}
            {parteDichiarata > 0 && parteDichiarata === importoScritto && (
              <p className="text-[11.5px] leading-snug text-slate-500">
                È tutto l&apos;importo: l&apos;IVA scelta in cima non si applica a niente.
              </p>
            )}
            {leggiEuro(testoB) > importoScritto && (
              <p className="text-[11.5px] leading-snug text-amber-700">
                Non può superare i {eur(importoScritto)} scritti sopra: viene contato quello.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <KpiFinestra etichetta="Già versato" valore={eur(versato)} />
          <KpiFinestra
            etichetta={divisa ? "Incassato ora" : "Totale versato"}
            valore={eur(divisa ? incassato : totaleDopo)}
            forte
          />
          <KpiFinestra
            etichetta="Resta da incassare"
            valore={eur(restante)}
            nota={restante > 0 ? "in attesa" : "niente"}
          />
        </div>

        {troppo && (
          <p className="text-[11px] leading-snug text-amber-700">
            Il saldo aperto è {eur(divisa ? tettoDiviso : daIncassare)}: viene registrato quello,
            non di più.
          </p>
        )}
        {precedenti > 0 && (
          <p className="text-[11px] leading-snug text-slate-500">
            Da acquisti precedenti registrati in scheda ha speso altri{" "}
            <span className="font-semibold tabular-nums">{eur(precedenti)}</span>: sono
            un&apos;altra pratica e restano fuori da questo totale.
          </p>
        )}

        {/* ── LA PRATICA SI CHIUDE? ───────────────────────────────────────
            È la seconda domanda del committente e va fatta QUI: un incasso
            parziale non chiude niente, un saldo pieno quasi sempre sì. La
            casella parte già spuntata, così il caso normale resta un tocco.
            ⚠️ Aprendo da «Fatta» la domanda sparisce: la risposta è già stata
             data premendo il pulsante, e richiederla è un passo che si può solo
             sbagliare — togliendo la spunta si otterrebbe una posa dichiarata
             fatta che resta da fare. */}
        {!chiudiLaPosa && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <Checkbox
              checked={concludi}
              onCheckedChange={(v) => setConcludi(v === true)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-slate-900">
                Il cliente ha concluso: pratica completata
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                {concludi
                  ? "Passa fra le pose completate e esce dalla coda del lavoro."
                  : "Resta in lavorazione: si vede ancora nell'elenco delle pose."}
              </span>
            </span>
          </label>
        )}
      </SezioneFinestra>

      {/* ── IL PULSANTE ────────────────────────────────────────────────────
          ⚠️ PRIMA NON C'ERA: si salvava PREMENDO LA RISPOSTA sull'IVA, e con due
           risposte che non toccavano il prezzo era il gesto giusto — un tocco in
           meno su una finestra che si apre venti volte al giorno. Con tre
           risposte, e una che alza il totale del 22%, quel tocco è diventato
           pericoloso: si sceglie per guardare cosa viene, e si è già scritto. */}
      <Button
        type="button"
        onClick={conferma}
        disabled={inCorso || (incassato <= 0 && !chiudiLaPosa)}
        className="h-10 w-full text-[13.5px]"
      >
        {chiudiLaPosa ? (
          <Check className="mr-1.5 h-4 w-4" />
        ) : (
          <Wallet className="mr-1.5 h-4 w-4" />
        )}
        {incassato > 0
          ? chiudiLaPosa
            ? `Segna fatta e incassa ${eur(incassato)}`
            : `Registra ${eur(incassato)}`
          : chiudiLaPosa
            ? "Segna l'installazione fatta"
            : "Scrivi l'importo incassato"}
      </Button>

      <NotaFinestra>
        {incassato <= 0
          ? chiudiLaPosa
            ? "Non resta niente da incassare: si segna solo che la posa è fatta."
            : "Scrivi l'importo incassato per registrare."
          : chiude
            ? "L'incasso viene registrato e la pratica passa fra le completate. Subito dopo compare «Annulla»."
            : "L'incasso viene registrato e la pratica resta in lavorazione. Subito dopo compare «Annulla»."}
      </NotaFinestra>
    </Finestra>
  );
}

/*  ── IL TASTO "SALDATO" NON ESISTE PIÙ ───────────────────────────────────
    Era un pulsante pieno accanto agli altri, e diceva la stessa cosa della
    cifra che gli stava a fianco: "1.200 € da incassare · [Saldato]". Adesso si
    incassa PREMENDO L'IMPORTO — ImportoRiga nelle liste, ImportoConsegna nelle
    schede — cioè esattamente dove si legge il numero. Un pulsante in meno per
    riga, e nessun dubbio su quale dei due usare.
    Chi dovesse riportarlo: non ne serve una copia, basta montare
    <FinestraIncasso> con il proprio pulsante — la scrittura è una sola.  */

/* ═══════════════════════════════════════════════════════════════════════════
   7. LO STATO — lo stesso comando dalla riga e dalla scheda cliente
   ═════════════════════════════════════════════════════════════════════════ */

/** ── "A CHE PUNTO È" ──────────────────────────────────────────────────────
 *  Di un'installazione si controllano due cose sole: se il materiale è pronto e
 *  se la posa è stata fatta. Erano in due posti diversi — le pastiglie del
 *  materiale dentro la scheda cliente, il tasto "Completa" nell'elenco — e
 *  nessuno dei due mostrava l'altro.
 *
 *  Qui è un comando solo: si legge lo stato senza aprire niente (il chip lo
 *  dice), lo si cambia in due tocchi, e ogni scelta si applica subito con
 *  "Annulla" nel messaggio. Montato nella riga o nella scheda del cliente si
 *  comporta e si vede allo stesso modo: chi impara a usarlo in un posto lo sa
 *  già usare nell'altro. */
export function StatoInstallazione({ lead, className }: { lead: Lead; className?: string }) {
  const [aperta, setAperta] = useState(false);
  const { cambiaStatoMateriale, riapriInstallazione } = useAzioniInstallazione();
  const [chiusura, setChiusura] = useState(false);
  const materiale = lead.data.statoOrdine;
  const completata = posaCompletata(lead);

  const scegliMateriale = (s: StatoOrdine) => {
    setAperta(false);
    void cambiaStatoMateriale(lead, s);
  };
  /** ⚠️ «Completata» NON scrive più da qui: apre la finestra della chiusura,
   *   dove si dice com'è l'IVA e si registra quello che il cliente ha saldato.
   *   Richiesta del committente — chi dichiara fatta una posa sta quasi sempre
   *   incassando in quel momento, e i due gesti erano separati da due schermate.
   *   ⚠️ E lo fa ANCHE questa voce, non solo il pulsante della riga: erano due
   *   porte per la stessa cosa, e lasciarne una che scrive di nascosto avrebbe
   *   voluto dire una pratica chiusa con l'IVA chiesta e una senza, a seconda di
   *   dove qualcuno aveva premuto. Il ritorno indietro invece resta immediato:
   *   riaprire una posa non tocca i soldi. */
  const scegliPosa = (fatta: boolean) => {
    setAperta(false);
    if (fatta) setChiusura(true);
    else void riapriInstallazione(lead);
  };

  return (
    <>
      {/*  Il chip dice UNA cosa sola, quella che conta in quel momento: finché la
          posa è aperta conta il materiale (è ciò che la può far saltare), appena
          è fatta conta che sia fatta — a posa completata lo stato dell'ordine è
          storia, e lasciarlo lì farebbe sembrare aperta una pratica chiusa. */}
      <button
        type="button"
        onClick={() => setAperta(true)}
        aria-haspopup="dialog"
        title={
          completata
            ? "Posa completata: premi per riaprirla o correggere il materiale"
            : "Cambia lo stato dell'installazione"
        }
        className={cn("inline-flex max-w-full items-center rounded-full", className)}
      >
        <Chip
          tono={completata ? "vinta" : materiale ? TONO_ORDINE[materiale] : "neutro"}
          punto={!completata && (!materiale || TONO_ORDINE[materiale] === "in_sospeso")}
          icona={completata ? Check : undefined}
          className="hover:brightness-95"
        >
          {completata
            ? "Posa completata"
            : materiale
              ? ETICHETTA_ORDINE[materiale]
              : "Materiale da segnare"}
          <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 opacity-60" />
        </Chip>
      </button>

      <Finestra
        aperta={aperta}
        onCambio={setAperta}
        larghezza="sm"
        icona={Wrench}
        titolo="Stato dell'installazione"
        contesto={nomeCompleto(lead)}
        classeCorpo="space-y-3"
      >
        <SezioneFinestra
          titolo="Il materiale"
          nota="A che punto è l'ordine del prodotto da posare"
          classeCorpo="p-3 space-y-1.5"
        >
          {ORDINE_MATERIALE.map((s) => (
            <VoceScelta
              key={s}
              selezionata={materiale === s}
              punto={PUNTO_TONO[TONO_ORDINE[s]]}
              titolo={ETICHETTA_ORDINE[s]}
              onClick={() => scegliMateriale(s)}
            />
          ))}
        </SezioneFinestra>

        <SezioneFinestra titolo="La posa" classeCorpo="p-3 space-y-1.5">
          <VoceScelta
            selezionata={!completata}
            punto={PUNTO_TONO.da_lavorare}
            titolo="Ancora da fare"
            nota="Resta nelle installazioni in programma"
            onClick={() => scegliPosa(false)}
          />
          <VoceScelta
            selezionata={completata}
            punto={PUNTO_TONO.vinta}
            titolo="Eseguita"
            /*  ⚠️ Diceva «Il lead passa a Venduto», e non è più vero da quando
                la posa fatta ha un campo suo (`completataIl`): "venduto" non è
                nemmeno più assegnabile. Una nota che promette un cambio di
                stato che non avviene è peggio di nessuna nota — si prende una
                decisione sulla base di quella riga. */
            nota="Si apre la chiusura: com'è l'IVA e quanto ha saldato"
            onClick={() => scegliPosa(true)}
          />
        </SezioneFinestra>

        <NotaFinestra>
          Ogni scelta si applica subito: se sbagli, nel messaggio che compare c&apos;è
          &quot;Annulla&quot;.
        </NotaFinestra>
      </Finestra>

      {/*  La chiusura della posa: si dice com'è l'IVA e si registra il saldo.
          È LA STESSA finestra del pulsante «Completa» sulla riga — montata due
          volte, scritta una. */}
      <FinestraIncasso lead={lead} aperta={chiusura} onCambio={setChiusura} chiudiLaPosa />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. LE AZIONI RAPIDE — la riga si lavora senza aprire niente
   ═════════════════════════════════════════════════════════════════════════ */

/** ── DUE COMANDI, IL RESTO DIETRO UN TOCCO ────────────────────────────────
 *  La riga aveva SEI pulsanti in fila (telefono, WhatsApp, Scheda, Riprogramma,
 *  Saldato, Completa) tutti dello stesso peso: una fila così non si legge, si
 *  rilegge — e sul telefono non si tocca senza sbagliare bersaglio.
 *
 *  Adesso restano visibili DUE cose sole:
 *   · l'AZIONE PRINCIPALE, che cambia con la situazione (Programma se manca la
 *     data, Completa se la posa è ancora aperta, il segno "fatta" se è chiusa).
 *     L'incasso NON è più qui: si preme sull'importo, dove si legge la cifra;
 *   · il TELEFONO, perché chiamare è l'unica cosa che si fa di corsa.
 *  Tutto il resto sta dietro "…", in una finestra sola con le voci raggruppate.
 *
 *  `onApri` e `onProgramma` sono facoltativi: dentro la scheda del cliente non
 *  serve un pulsante che apra la scheda del cliente. */
/** ── SCRIVERE AL CLIENTE DI UNA POSA ──────────────────────────────────────
 *  Il messaggio giusto dipende da una cosa sola: se la data c'è già o no.
 *  Senza giorno si chiede la disponibilità, con il giorno si conferma tutto —
 *  ora e saldo compresi (`messaggioInstallazione`).
 *
 *  ⚠️ ESISTE PERCHÉ ADESSO I PUNTI DI PARTENZA SONO DUE: la voce dentro la
 *   finestra «Azioni» e il pulsante sulla riga, accanto alla cornetta. Erano
 *   due copie della stessa apertura, e due copie di un messaggio al cliente
 *   divergono al primo ritocco — con il risultato che la stessa persona riceve
 *   due testi diversi a seconda del pulsante che qualcuno ha premuto. */
export function scriviSuWhatsApp(lead: Lead) {
  const telefono = lead.data?.telefono;
  if (!telefono) return;
  const senzaData = !lead.data.installazione?.dataInstallazione;
  window.open(
    buildWhatsAppLink(
      telefono,
      senzaData
        ? `Buongiorno ${lead.data.nome}, possiamo fissare la data di installazione. Mi indica i giorni in cui è disponibile?`
        : messaggioInstallazione(lead),
    ),
    "_blank",
    "noreferrer",
  );
}

/** ── LO STATO DELLA POSA, DA CAMBIARE ─────────────────────────────────────
 *
 *  La apre la pastiglia della riga, in tutti e due i colori. Dice dov'è questa
 *  posa e quali sono le vie d'uscita, per esteso.
 *
 *  ── ⚠️ QUI NON SI SCRIVE NIENTE DI NUOVO ─────────────────────────────────
 *  Ogni voce chiama un'azione che esisteva già — `riapriInstallazione`,
 *  `togliProgrammazione`, la finestra della chiusura — perché erano tutte
 *  raggiungibili, ma solo da dentro il «…», e nessuno le trovava. Il difetto
 *  segnalato non era che mancasse la disdetta: era che la disdetta stava dove
 *  non la cerca chi ha appena messo giù il telefono. Riscriverle qui avrebbe
 *  dato due modi di disfare la stessa cosa, e il giorno che divergono si
 *  scopre dal fatturato.
 *
 *  ── ⚠️ «DA PROGRAMMARE» SONO DUE GESTI, E VANNO IN QUEST'ORDINE ──────────
 *  Prima si riapre (via `completataIl`), poi si toglie la programmazione. Al
 *  contrario non funzionerebbe: `togliProgrammazione` si rifiuta di agire su
 *  una posa risultata eseguita — ed è giusto che si rifiuti, un intervento
 *  avvenuto non è una prenotazione da cancellare.
 *  ───────────────────────────────────────────────────────────────────────── */
function FinestraStatoPosa({
  lead,
  aperta,
  onCambio,
  bloccata,
  onEseguita,
}: {
  lead: Lead;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  /** Se c'è, la posa non si può ancora dichiarare eseguita: si dice perché. */
  bloccata?: string;
  /** Apre la chiusura: com'è l'IVA e quanto ha saldato. */
  onEseguita: () => void;
}) {
  const { riapriInstallazione, togliProgrammazione } = useAzioniInstallazione();
  const completata = posaCompletata(lead);
  const quando = soloData(lead.data.installazione?.dataInstallazione);

  //  Stessa regola della finestra «Azioni»: si chiude e poi si scrive, così il
  //  tocco non sembra perso per il tempo della rete.
  const fai = (azione: () => void | Promise<void>) => {
    onCambio(false);
    void azione();
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      icona={completata ? Check : CalendarClock}
      titolo="Lo stato della posa"
      contesto={
        completata
          ? `${nomeCompleto(lead)} · eseguita`
          : `${nomeCompleto(lead)}${quando ? ` · ${dataBreve(quando)}` : ""}`
      }
      larghezza="sm"
      classeCorpo="space-y-3"
    >
      {completata ? (
        <>
          <SezioneFinestra titolo="Se non era eseguita" classeCorpo="p-3 space-y-1.5">
            <VoceScelta
              icona={Wrench}
              titolo="Riportala fra quelle da fare"
              nota="Il giorno e le persone restano: torna nella coda del lavoro, pronta per quel giorno"
              onClick={() => fai(() => riapriInstallazione(lead))}
            />
            <VoceScelta
              icona={CalendarClock}
              titolo="Riportala fra quelle da programmare"
              nota="Toglie anche giorno, ora, chi la esegue e il driver: quelle ore tornano libere in agenda"
              onClick={() =>
                fai(async () => {
                  //  ⚠️ In quest'ordine, e non è indifferente: vedi la nota in
                  //   testa a questa finestra.
                  await riapriInstallazione(lead);
                  await togliProgrammazione({
                    ...lead,
                    data: {
                      ...lead.data,
                      installazione: (() => {
                        const i = { ...(lead.data.installazione ?? {}) };
                        delete i.completataIl;
                        return i;
                      })(),
                    },
                  });
                })
              }
            />
          </SezioneFinestra>
          <NotaFinestra>
            La vendita non si tocca: il cliente resta venduto, gli importi restano scritti e il mese
            continua a contarla. Qui si disfa solo la posa.
          </NotaFinestra>
        </>
      ) : (
        <>
          <SezioneFinestra titolo="Com'è andata" classeCorpo="p-3 space-y-1.5">
            <VoceScelta
              icona={Check}
              titolo="È stata eseguita"
              nota={
                bloccata ||
                "Si apre la chiusura: com'è l'IVA e quanto ha saldato. La posa si segna eseguita nello stesso gesto"
              }
              disabilitata={!!bloccata}
              onClick={() => fai(onEseguita)}
            />
            <VoceScelta
              icona={CalendarClock}
              titolo="Il cliente ha disdetto"
              nota="Torna fra quelle da programmare: giorno, ora, chi la esegue e il driver vengono tolti e quelle ore tornano libere"
              onClick={() => fai(() => togliProgrammazione(lead))}
            />
          </SezioneFinestra>
          <NotaFinestra>
            Disdire non annulla la vendita: lo stato della pratica e gli importi restano
            com&#39;erano. Serve solo a rimettere la posa in coda.
          </NotaFinestra>
        </>
      )}
    </Finestra>
  );
}

export function AzioniInstallazione({
  lead,
  onApri,
  onProgramma,
  onStato,
  bloccata,
  className,
}: {
  lead: Lead;
  onApri?: (l: Lead) => void;
  onProgramma?: (l: Lead) => void;
  /** Vedi `FinestraAzioniPosa`: si passa e basta. */
  onStato?: (l: Lead, s: LeadStatus) => void;
  /** ── PERCHÉ LA POSA NON SI PUÒ ANCORA CHIUDERE ────────────────────────
   *  Se c'è un motivo, "Completa" resta SPENTO e il motivo si legge passando
   *  sopra. È la stessa regola di "Spedisci" senza indirizzo: un comando che
   *  chiude una pratica a cui manca il dato per farla non deve essere
   *  premibile — lo usa la scheda «A domicilio» finché l'indirizzo non c'è. */
  bloccata?: string;
  className?: string;
}) {
  const completata = posaCompletata(lead);
  const senzaData = !lead.data.installazione?.dataInstallazione;
  /** ── ⚠️ LO STATO DELLA POSA SI TOCCA, NON SI GUARDA E BASTA ────────────
   *  Segnalato dal committente, ed era vero: la pastiglia verde «Fatta» era
   *  un'etichetta morta, e per riaprire una posa o per disdirne una fissata
   *  bisognava sapere che le due voci esistevano dentro il «…». Chi ha appena
   *  ricevuto la telefonata «devo disdire» non va a cercare in un menu: guarda
   *  la riga, e sulla riga non c'era niente.
   *  Adesso la pastiglia È il comando, in tutti e due i casi, e apre una
   *  finestra che dice per esteso che cosa succede. Le AZIONI però restano
   *  quelle di sempre — `riapriInstallazione` e `togliProgrammazione`, le
   *  stesse che chiama il menu: riscriverle qui vorrebbe dire due modi di
   *  disfare la stessa cosa, e fra un mese due comportamenti diversi. */
  const [statoPosa, setStatoPosa] = useState(false);
  /** ⚠️ «Completa» NON scrive più direttamente. Apre la finestra della chiusura
   *   — la stessa dell'incasso — dove si sceglie com'è l'IVA e si registra quello
   *   che il cliente ha saldato. Richiesta del committente: «se clicco che ha
   *   completato deve risultare tutto saldato». Prima erano due gesti in due
   *   schermate, e il secondo lo faceva chi se lo ricordava. */
  const [chiusura, setChiusura] = useState(false);

  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      {/*  L'azione piena è UNA sola: due pulsanti pieni accanto costringono a
          leggerli tutti e due ogni volta. */}
      {completata ? (
        /*  ⚠️ «Eseguita» e non più «Fatta»: è la parola che usa il resto della
            pagina per la stessa cosa, e una pratica si esegue — «fatta» è come
            si parla, non come si scrive su un documento che qualcuno stampa. */
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-emerald-500/40 bg-emerald-500/10 text-[11.5px] font-medium text-emerald-700 hover:bg-emerald-500/20 hover:text-emerald-800"
          onClick={() => setStatoPosa(true)}
          title="Posa eseguita. Premi per riaprirla o per rimetterla fra quelle da programmare"
        >
          <Check className="mr-1 h-3.5 w-3.5" /> Eseguita
        </Button>
      ) : senzaData ? (
        <Button
          size="sm"
          className="h-7 text-[11.5px]"
          onClick={() => onProgramma?.(lead)}
          disabled={!onProgramma}
          title="Fissa il giorno e l'ora della posa"
        >
          <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Programma
        </Button>
      ) : (
        /*  ── ⚠️ AMBRA, E NON PIÙ BLU ────────────────────────────────────────
            In questo CRM l'ambra vuol dire una cosa sola — «manca un passaggio»
            — ed è esattamente il caso: la posa ha un giorno, e nessuno ha
            ancora detto se quel giorno è passato bene. Il blu diceva «premi
            qui», che è un ordine, non uno stato: chi guardava la riga non
            sapeva se l'intervento fosse già avvenuto.
            ⚠️ Non chiude più da sola: apre la finestra dove si sceglie fra
            «è stata eseguita» e «il cliente ha disdetto». È il clic in più che
            il committente ha chiesto, e paga proprio il caso per cui l'ha
            chiesto — la disdetta, che prima non stava da nessuna parte che si
            guardasse. */
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-amber-400/60 bg-amber-50 text-[11.5px] font-medium text-amber-800 hover:bg-amber-100 hover:text-amber-900"
          onClick={() => setStatoPosa(true)}
          title={bloccata || "Posa programmata: conferma che è stata eseguita, oppure disdicila"}
        >
          <CalendarClock className="mr-1 h-3.5 w-3.5" /> Da confermare
        </Button>
      )}

      {lead.data.telefono && (
        <Button asChild size="sm" variant="outline" className="h-7 w-7 p-0" title="Chiama">
          <a href={`tel:${lead.data.telefono}`} aria-label={`Chiama ${nomeCompleto(lead)}`}>
            <Phone className="h-3.5 w-3.5" />
          </a>
        </Button>
      )}

      {/*  ── SCRIVERE, ACCANTO AL CHIAMARE ────────────────────────────────
           Richiesta del committente. La stessa apertura che sta dentro la
           finestra «Azioni», portata fuori: su una posa da fissare si scrive
           più spesso di quanto si telefoni — il cliente risponde con i giorni
           in cui può, e lo fa con calma — e per farlo bisognava aprire il «…»
           e cercare una voce fra le altre.
           ⚠️ NON è un secondo messaggio: è `scriviSuWhatsApp`, la stessa
            funzione della voce nel menu. Due testi per lo stesso gesto
            divergono al primo ritocco, e a riceverli è il cliente.
           Spento e non colorato: il verde di WhatsApp accanto al blu di
           «Completa» sposterebbe l'occhio sul gesto secondario. */}
      {lead.data.telefono && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          onClick={() => scriviSuWhatsApp(lead)}
          title={
            senzaData
              ? "Scrivi su WhatsApp: chiede i giorni disponibili"
              : "Scrivi su WhatsApp: conferma giorno, ora e saldo"
          }
          aria-label={`Scrivi su WhatsApp a ${nomeCompleto(lead)}`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </Button>
      )}

      {/*  ⚠️ Il motivo viaggia anche nel menu: dentro "…" c'è la voce
          "Completata", che chiude la pratica esattamente come questo pulsante.
          Spegnere solo il pulsante e lasciare accesa la voce a un tocco di
          distanza è un blocco finto — si aggira senza nemmeno accorgersene. */}
      <TastoAltreAzioni
        lead={lead}
        onApri={onApri}
        onProgramma={onProgramma}
        onStato={onStato}
        bloccata={bloccata}
      />

      {/*  La finestra della chiusura, aperta da «È stata eseguita»: com'è
          l'IVA, quanto ha saldato, e la posa si segna eseguita nello stesso
          gesto. */}
      <FinestraIncasso lead={lead} aperta={chiusura} onCambio={setChiusura} chiudiLaPosa />

      {/*  Dove si cambia lo stato della posa: è la finestra che apre la
          pastiglia, in tutti e due i colori. */}
      <FinestraStatoPosa
        lead={lead}
        aperta={statoPosa}
        onCambio={setStatoPosa}
        bloccata={bloccata}
        onEseguita={() => setChiusura(true)}
      />
    </div>
  );
}

/** Il "…" da solo, per chi ha già il proprio comando principale (la riga delle
 *  spedizioni ha "Spedisci" al posto di "Completa"). Lo stato della finestra sta
 *  DENTRO il pulsante: montato dove si vuole, si comporta sempre uguale. */
export function TastoAltreAzioni({
  lead,
  onApri,
  onProgramma,
  onStato,
  bloccata,
  className,
}: {
  lead: Lead;
  onApri?: (l: Lead) => void;
  onProgramma?: (l: Lead) => void;
  /** Vedi `FinestraAzioniPosa`: si passa e basta, qui non si scrive niente. */
  onStato?: (l: Lead, s: LeadStatus) => void;
  /** motivo per cui la posa non si può ancora chiudere: spegne anche la voce
   *  "Completata" della finestra, non solo il pulsante della riga */
  bloccata?: string;
  className?: string;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={cn("h-7 w-7 p-0", className)}
        onClick={() => setMenu(true)}
        aria-haspopup="dialog"
        title="Altre azioni"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        <span className="sr-only">Altre azioni</span>
      </Button>
      <FinestraAzioniPosa
        lead={lead}
        aperta={menu}
        onCambio={setMenu}
        onApri={onApri}
        onProgramma={onProgramma}
        onStato={onStato}
        bloccata={bloccata}
      />
    </>
  );
}

/** Il campo che corregge la cifra in più. Vive dentro la sezione e non in una
 *  finestra sua: aprire una seconda finestra sopra questa per scrivere un
 *  numero è tre gesti per uno, e su una riga che si tocca col telefono in mano
 *  la seconda finestra si chiude per sbaglio. Invio salva, come ovunque. */
function CorreggiExtra({ lead, onSalva }: { lead: Lead; onSalva: (cifra: number) => void }) {
  const [testo, setTesto] = useState(String(Number(lead.data.extraDaChiedere?.importo) || ""));
  //  La virgola si accetta: si scrive al volo e un campo che la rifiuta fa
  //  salvare zero, cioè cancella l'avviso senza che nessuno l'abbia chiesto.
  const cifra = Math.max(0, Number(testo.replace(",", ".")) || 0);
  const attuale = Number(lead.data.extraDaChiedere?.importo) || 0;
  return (
    <div className="flex items-end gap-2 border-t border-border pt-2">
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
          Quanto è, esattamente
        </span>
        <Input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          inputMode="decimal"
          placeholder="€"
          className="h-8 text-[12.5px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && cifra !== attuale) onSalva(cifra);
          }}
        />
      </label>
      <Button
        size="sm"
        variant="outline"
        className="h-8 shrink-0 text-[12px]"
        disabled={cifra === attuale}
        onClick={() => onSalva(cifra)}
        title={cifra > 0 ? "Salva la cifra corretta" : "A zero l'avviso sparisce dalla riga"}
      >
        {cifra > 0 ? "Correggi" : "Non serve più"}
      </Button>
    </div>
  );
}

/** ── IL RESTO DELLE AZIONI, IN UNA FINESTRA SOLA ──────────────────────────
 *  Non è un menu a tendina ma una finestra: i menu a tendina vivono in un
 *  portale fuori dal tema chiaro del CRM (stesso problema descritto in
 *  ui/Finestra.tsx) e sul telefono si aprono fuori dallo schermo. Qui sul
 *  telefono è un foglio che sale dal basso, con voci grandi da toccare.
 *
 *  Ogni voce SCRIVE SUBITO e lascia "Annulla" nel messaggio: nessuna finestra
 *  dentro un'altra finestra, nessun pulsante "Salva" in fondo. */
export function FinestraAzioniPosa({
  lead,
  aperta,
  onCambio,
  onApri,
  onProgramma,
  onStato,
  bloccata,
}: {
  lead: Lead;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  onApri?: (l: Lead) => void;
  onProgramma?: (l: Lead) => void;
  /** ── CAMBIARE LO STATO DEL CLIENTE DA QUI ────────────────────────────────
   *  Richiesta del committente: da questa finestra si deve poter dire «questo
   *  non compra più», e la riga deve uscire dalle installazioni.
   *  ⚠️ È una PROPRIETÀ e non un import, ed è una scelta obbligata: il
   *   percorso giusto per cambiare stato passa da ChiusuraDialog e
   *   QuickStatusDialog, e ChiusuraDialog importa GIÀ questo file (vedi la
   *   nota in testa a quel modulo). Importarli qui chiuderebbe il cerchio, e
   *   un ciclo di import in questo repo si manifesta come una funzione
   *   «undefined» a runtime, non come un errore di compilazione. La pagina che
   *   monta la riga ha già quelle finestre: si chiede a lei.
   *  Assente = la sezione non compare, e chi montava questa finestra prima
   *  continua a funzionare identico. */
  onStato?: (l: Lead, s: LeadStatus) => void;
  /** motivo per cui la posa non si può ancora chiudere (es. manca l'indirizzo
   *  di una posa a domicilio): spegne la voce "Completata" e lo dice */
  bloccata?: string;
}) {
  const {
    cambiaStatoMateriale,
    riapriInstallazione,
    togliProgrammazione,
    segnaExtraComunicato,
    correggiExtra,
  } = useAzioniInstallazione();
  const { segnaModoConsegna } = useAzioniSpedizione();
  const materiale = lead.data.statoOrdine;
  const completata = posaCompletata(lead);
  const senzaData = !lead.data.installazione?.dataInstallazione;
  //  Una scelta a tre, non due interruttori: vedi crm/spedizione.ts.
  const modo = modoConsegna(lead);

  //  Ogni scelta chiude la finestra e poi scrive: chiudere dopo il salvataggio
  //  farebbe restare la finestra ferma il tempo della rete, e sembrerebbe che
  //  il tocco non sia stato preso.
  const fai = (azione: () => void | Promise<void>) => {
    onCambio(false);
    void azione();
  };

  /** ⚠️ ANCHE DA QUI «Completata» passa dalla finestra della chiusura, non
   *   scrive di nascosto. Sono tre le porte che dichiarano fatta una posa — il
   *   pulsante della riga, la scelta dello stato, questa voce — e finché una
   *   sola delle tre chiedeva l'IVA e registrava il saldo, quale delle due cose
   *   finiva in cassa dipendeva da dove qualcuno aveva premuto. È la stessa
   *   ragione per cui `bloccata` vale su tutte e tre: un blocco che si aggira
   *   cambiando pulsante non è un blocco. */
  const [chiusura, setChiusura] = useState(false);
  /** ── ⚠️ IL CONTO SI CORREGGE DA QUI ─────────────────────────────────────
   *  Richiesta del committente: «fai che posso cambiare l'importo che ha
   *  pagato da qui, acconto, sconti, costi ecc ecc, aggiungi una voce per
   *  farlo». Le altre finestre REGISTRANO qualcosa che succede; questa
   *  CORREGGE quello che è già scritto, ed è l'unica cosa che mancava: per
   *  cambiare un acconto sbagliato bisognava far finta che stesse succedendo
   *  un incasso. Vedi crm/FinestraConto. */
  const [conto, setConto] = useState(false);
  const [costiFissi, setCostiFissi] = useState(false);

  return (
    <>
      <Finestra
        aperta={aperta}
        onCambio={onCambio}
        larghezza="sm"
        icona={Wrench}
        titolo="Azioni"
        contesto={nomeCompleto(lead)}
        classeCorpo="space-y-3"
      >
        <SezioneFinestra titolo="Apri" classeCorpo="p-3 space-y-1.5">
          {onApri && (
            <VoceScelta
              icona={UserRound}
              titolo="Scheda del cliente"
              nota="Anagrafica, importi, storico"
              onClick={() => fai(() => onApri(lead))}
            />
          )}
          {onProgramma && (
            <VoceScelta
              icona={CalendarClock}
              titolo={senzaData ? "Programma la posa" : "Riprogramma la posa"}
              nota="Giorno, ora, installatore e note"
              onClick={() => fai(() => onProgramma(lead))}
            />
          )}
          <VoceScelta
            icona={Wallet}
            titolo="Il conto della pratica"
            nota="Prezzo, sconto, quanto ha pagato e i costi"
            onClick={() => {
              onCambio(false);
              setConto(true);
            }}
          />
          {lead.data.telefono && (
            <VoceScelta
              icona={MessageCircle}
              titolo="Scrivi su WhatsApp"
              nota={senzaData ? "Chiede i giorni disponibili" : "Conferma giorno, ora e saldo"}
              onClick={() => fai(() => scriviSuWhatsApp(lead))}
            />
          )}
        </SezioneFinestra>

        {/*  ── LO STATO DEL CLIENTE ────────────────────────────────────────
           Richiesta del committente: da qui si deve poter dire «questo non
           compra più». Le voci sono quelle che `statiPer` giudica valide per
           QUESTA scheda — lo stesso elenco del selettore grande, chiesto alla
           stessa funzione, così non nasce una seconda idea di quali stati un
           lead possa prendere.
           ⚠️ Non si scrive da qui: si passa a chi ha le finestre (`onStato`).
            Le tre chiusure vinte vogliono importi e modo di consegna, gli
            appuntamenti vogliono un giorno: scriverli secchi da questa
            finestra vorrebbe dire una vendita senza cassa o un appuntamento
            senza data — cioè i due guasti che quelle finestre esistono per
            evitare. */}
        {onStato && (
          <SezioneFinestra
            titolo="Lo stato del cliente"
            nota="Da qui esce dalle installazioni se non compra più"
            classeCorpo="p-3"
          >
            <div className="flex flex-wrap gap-1.5">
              {statiPer(lead.data ?? {}).map((s) => {
                const attuale = s === lead.data?.stato;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={attuale}
                    onClick={() => fai(() => onStato(lead, s))}
                    title={
                      attuale
                        ? `È già «${LEAD_STATUS_LABEL[s]}»`
                        : `Passa a «${LEAD_STATUS_LABEL[s]}»`
                    }
                    className={cn(
                      CLASSE_BADGE_STATO,
                      classiStato(s),
                      "h-7 transition",
                      attuale ? "opacity-100 ring-2 ring-offset-1" : "opacity-80 hover:opacity-100",
                    )}
                  >
                    {LEAD_STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </SezioneFinestra>
        )}

        {/*  A posa chiusa lo stato del materiale è storia: mostrarlo inviterebbe
          a rimettere mano a una pratica finita. */}
        {!completata && (
          <SezioneFinestra
            titolo="Il materiale"
            nota="A che punto è l'ordine del prodotto da posare"
            classeCorpo="p-3 space-y-1.5"
          >
            {ORDINE_MATERIALE.map((s) => (
              <VoceScelta
                key={s}
                selezionata={materiale === s}
                punto={PUNTO_TONO[TONO_ORDINE[s]]}
                titolo={ETICHETTA_ORDINE[s]}
                onClick={() => fai(() => cambiaStatoMateriale(lead, s))}
              />
            ))}
          </SezioneFinestra>
        )}

        {/* ── L'IMPIANTO NON È UNO DEI SOLITI ──────────────────────────────
          ⚠️ IL CAMPO ERA SCRITTO E NON LO LEGGEVA NESSUNO. `suMisura` lo salva
           la finestra della chiusura (ChiusuraDialog) nel momento della
           vendita, e types.ts dichiara da sempre che a leggerlo è la scheda
           della posa: ma qui non c'era una riga che lo mostrasse, quindi
           l'interruttore acceso davanti al cliente non arrivava a nessuno.
           Un dato raccolto e mai mostrato è peggio di un dato mancante: chi lo
           ha scritto crede di aver avvisato, e chi posa non è stato avvisato.
          Sta PRIMA dei soldi in più e prima della posa perché cambia il gesto,
          non il conto: un impianto su misura ha altri tempi e non si sostituisce
          al volo se qualcosa non torna, e va saputo mentre si sceglie la data,
          non dopo. Sola lettura di proposito — si decide alla vendita, e questa
          finestra non è il posto per cambiare cos'è stato ordinato. */}
        {lead.data.suMisura?.attivo && (
          <SezioneFinestra
            titolo="Impianto su misura"
            nota={
              lead.data.suMisura.note?.trim()
                ? lead.data.suMisura.note.trim()
                : "Tempi diversi dallo standard: non si sostituisce al volo"
            }
            classeCorpo="p-3"
          >
            <p className="text-[12px] leading-snug text-muted-foreground">
              Segnato alla vendita. Tienine conto sulla data: se qualcosa non torna non c&apos;è un
              ricambio pronto a magazzino.
            </p>
          </SezioneFinestra>
        )}

        {/* ── I SOLDI IN PIÙ CHE IL CLIENTE ANCORA NON SA ───────────────────
          Compare SOLO se su questa pratica è stato segnato che c'è altro da
          chiedere: è la scheda della posa a doverlo sapere, perché è chi
          consegna che si trova davanti il conto diverso da quello pattuito.
          ⚠️ È l'unico posto da cui l'avviso ambra degli elenchi si spegne.
           Finché non c'era, quell'avviso restava acceso per sempre — e un
           avviso che non si spegne smette di essere letto, quindi il giorno che
           ne compare uno vero quei soldi non li chiede nessuno.
          Due voci e non una spunta, per la stessa ragione di «La posa» qui
          sotto: si vede in che stato è la cosa senza doverlo dedurre da un
          quadratino, e un tocco sbagliato si ripara con l'altro tocco. */}
        {lead.data.extraDaChiedere?.serve && (
          <SezioneFinestra
            titolo="Altri soldi da chiedere"
            nota={
              Number(lead.data.extraDaChiedere.importo) > 0
                ? `${eur(Number(lead.data.extraDaChiedere.importo))} in più rispetto a quanto pattuito`
                : "Una cifra in più rispetto a quanto pattuito"
            }
            classeCorpo="p-3 space-y-1.5"
          >
            <VoceScelta
              selezionata={!lead.data.extraDaChiedere.comunicatoAlCliente}
              punto={PUNTO_TONO.in_sospeso}
              titolo="Non gliene ho ancora parlato"
              nota="Il lead porta l'avviso in tutti gli elenchi"
              onClick={() => fai(() => segnaExtraComunicato(lead, false))}
            />
            <VoceScelta
              selezionata={!!lead.data.extraDaChiedere.comunicatoAlCliente}
              punto={PUNTO_TONO.vinta}
              titolo="Gliel'ho detto"
              nota="Spegne l'avviso: il cliente sa che arriverà questa cifra"
              onClick={() => fai(() => segnaExtraComunicato(lead, true))}
            />
            {/*  ── LA CIFRA SI CORREGGE QUI, E QUI SI TOGLIE ──────────────────
               Le due voci sopra dicono se il cliente lo SA; questa dice quanto
               è. Erano due domande diverse e una sola aveva una risposta: si
               poteva dichiarare «detta» una cifra sbagliata — cioè spegnere la
               spia invece di riparare il guasto — e non toglierla in nessun
               modo. A zero l'avviso si spegne del tutto. */}
            <CorreggiExtra lead={lead} onSalva={(cifra) => fai(() => correggiExtra(lead, cifra))} />
          </SezioneFinestra>
        )}

        <SezioneFinestra titolo="La posa" classeCorpo="p-3 space-y-1.5">
          <VoceScelta
            selezionata={!completata}
            punto={PUNTO_TONO.da_lavorare}
            titolo="Ancora da fare"
            nota="Resta nell'elenco del lavoro"
            onClick={() => fai(() => riapriInstallazione(lead))}
          />
          {/*  Se la posa non si può ancora chiudere, qui il motivo si LEGGE: la
            voce spenta e basta farebbe pensare a un guasto, e chi lavora
            proverebbe a chiuderla dalla riga (dove è spenta anche lì). */}
          <VoceScelta
            selezionata={completata}
            disabilitata={!completata && !!bloccata}
            punto={PUNTO_TONO.vinta}
            titolo="Eseguita"
            nota={!completata && bloccata ? bloccata : "Passa fra le pose eseguite"}
            onClick={() =>
              fai(() => {
                setChiusura(true);
              })
            }
          />
        </SezioneFinestra>

        {/* ── DISFARE LA PROGRAMMAZIONE ─────────────────────────────────────
          Sta in un blocco SUO e non fra le due voci qui sopra: quelle sono una
          scelta a due («da fare» / «fatta») e una terza voce lì dentro si
          leggerebbe come un terzo stato della posa, mentre questo toglie il
          «quando e con chi» e basta.
          Compare solo se c'è davvero una programmazione da togliere e la posa
          non è già stata fatta: un comando quasi sempre inerte smette di essere
          letto, e su un intervento avvenuto non avrebbe nemmeno senso.
          ⚠️ È l'unico modo di togliere una posa senza disfare la vendita: la
           procedura guidata PRETENDE giorno e ora per salvare, quindi da lì una
           posa si può solo spostare. Riprogrammare sul giorno sbagliato per
           liberarsi di quello ancora più sbagliato è ciò che si faceva prima, e
           lasciava comunque un consulente occupato. */}
        {!completata && posaProgrammata(lead) && (
          <SezioneFinestra
            titolo="La programmazione"
            nota="Il giorno, l'ora e le persone di questo intervento"
            classeCorpo="p-3"
          >
            <VoceScelta
              icona={CalendarClock}
              titolo="Togli la programmazione"
              //  Stessa cautela del messaggio che ne esce: qui si arriva anche da
              //  una pratica non venduta, quindi si promette solo ciò che questo
              //  gesto fa davvero — non tocca né lo stato né i soldi.
              nota="Rimette la posa fra quelle da fissare e libera le ore in agenda. Lo stato della pratica e gli importi non si toccano"
              onClick={() => fai(() => togliProgrammazione(lead))}
            />
          </SezioneFinestra>
        )}

        {/* ── SI POSA IN SEDE, A DOMICILIO, O SI SPEDISCE ───────────────────
          È qui e non in una pagina a parte perché la si scopre lavorando la
          riga: "questo non lo installiamo, glielo mandiamo".
          Le tre voci sono una scelta SOLA: scegliendone una le altre due si
          spengono da sole, perché una pratica non può arrivare al cliente in
          due modi insieme. */}
        <SezioneFinestra
          titolo="Come arriva al cliente"
          nota="Solo le pratiche da spedire escono dall'agenda e dai conteggi del giorno: quelle a domicilio restano"
          classeCorpo="p-3 space-y-1.5"
        >
          <VoceScelta
            selezionata={modo === "sede"}
            icona={Wrench}
            titolo="Si posa in sede"
            nota="Agenda, orario e installatore come sempre"
            onClick={() => fai(() => segnaModoConsegna(lead, "sede"))}
          />
          <VoceScelta
            selezionata={modo === "domicilio"}
            icona={House}
            titolo="Si posa a domicilio"
            nota="Va nella scheda «A domicilio»: indirizzo e costo del viaggio. Resta in agenda, occupa un installatore"
            onClick={() => fai(() => segnaModoConsegna(lead, "domicilio"))}
          />
          <VoceScelta
            selezionata={modo === "spedizione"}
            icona={Truck}
            titolo="Si spedisce"
            nota="Va nella scheda «Da spedire», dove si scrive l'indirizzo"
            onClick={() => fai(() => segnaModoConsegna(lead, "spedizione"))}
          />
        </SezioneFinestra>

        <NotaFinestra>
          Ogni scelta si applica subito: se sbagli, nel messaggio che compare c&apos;è
          &quot;Annulla&quot;.
        </NotaFinestra>
      </Finestra>

      {/*  La chiusura della posa, aperta dalla voce «Completata»: la STESSA
        finestra del pulsante sulla riga e della scelta dello stato. */}
      <FinestraIncasso lead={lead} aperta={chiusura} onCambio={setChiusura} chiudiLaPosa />

      {/*  Il conto della pratica, aperto dalla voce in cima: corregge quello
        che è già scritto (prezzo, sconto, incassato, costi). I tre costi fissi
        restano nella loro finestra, che da lì si apre. */}
      <FinestraConto
        lead={lead}
        aperta={conto}
        onCambio={setConto}
        onApriCostiFissi={() => setCostiFissi(true)}
      />
      <FinestraCosti lead={lead} aperta={costiFissi} onCambio={setCostiFissi} />
    </>
  );
}

/** ── LA BORSA DEI MATERIALI: NON SI MONTA PIÙ DA NESSUNA PARTE ────────────
 *  Le quattro voci fisse (protesi, colla, forbici, modulo firma) erano un elenco
 *  inventato dal programma: occupavano una riga su ogni posa, un contatore
 *  "0/4" nell'intestazione di ogni giornata e una riga di riepilogo nei numeri
 *  in cima — e non venivano spuntate mai, perché chi lavora non le riconosce.
 *  Sono state tolte dall'elenco, dalla giornata del tecnico, dalla scheda
 *  cliente e dalla procedura che programma la posa.
 *
 *  ⚠️ IL DATO NON È STATO CANCELLATO: le checklist già spuntate restano scritte
 *  in `installazione.checklist` e nessuna scrittura di questo file le tocca (si
 *  salva sempre con lo spread di `installazione`). Il componente resta qui,
 *  esportato e non montato, perché rimettere una schermata costa dieci minuti e
 *  un dato buttato non torna più. Non montarlo senza una richiesta esplicita. */
export function ChecklistMateriali({ lead, className }: { lead: Lead; className?: string }) {
  const { spuntaMateriale } = useAzioniInstallazione();
  const materiali = checklistDi(lead);
  const spuntati = materiali.filter((m) => m.done).length;
  const pronta = materiali.length > 0 && spuntati === materiali.length;

  return (
    <div className={className}>
      <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold">
        <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
        Materiali da caricare
        <span className={cn("tabular-nums", pronta ? "text-emerald-700" : "text-muted-foreground")}>
          {spuntati}/{materiali.length}
        </span>
      </div>
      <div className="space-y-1">
        {materiali.map((m, i) => (
          <label
            key={`${m.label}-${i}`}
            className="flex cursor-pointer items-center gap-2 text-[12px]"
          >
            <Checkbox checked={m.done} onCheckedChange={() => void spuntaMateriale(lead, i)} />
            <span className={m.done ? "text-muted-foreground line-through" : ""}>{m.label}</span>
          </label>
        ))}
        {materiali.length === 0 && (
          <p className="text-[11px] italic text-muted-foreground">
            Nessun materiale in elenco: si aggiunge da &quot;Riprogramma&quot;.
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. LA PROCEDURA GUIDATA — si programma la posa un passo alla volta
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ A PASSI E NON UN MODULO SOLO ──────────────────────────────────
 *  Programmare una posa è una catena di decisioni con un ordine naturale, lo
 *  stesso di quando si fissa un appuntamento al telefono: CHI ci va → CHE
 *  GIORNO → CHE ORA → come ci va → dove si va → quanto si ritira. Nel modulo
 *  unico l'ordine non esisteva: gli orari stavano sopra il consulente, e chi lo
 *  compilava si trovava a scegliere un'ora prima di sapere di chi fosse
 *  l'agenda — l'errore che il committente aveva già segnalato sulla scheda del
 *  lead.
 *
 *  Ogni campo sta DOPO ciò che serve a compilarlo: la durata prima dei giorni
 *  (decide dove c'è posto), il giorno prima degli orari, il driver dopo l'ora
 *  (prima non si sa chi è libero). L'ultimo passo non chiede niente per poter
 *  premere «Programma»: dice cosa si è deciso — e raccoglie le note per chi va a
 *  posare, che sono facoltative e vengono in mente proprio guardando il resto.
 *
 *  Non si può saltare avanti a un passo che dipende da uno vuoto — la scala in
 *  cima mostra dove si è, e indietro si torna sempre. */

interface Props {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const DURATIONS = [60, 90, 120, 150, 180] as const;

/** ── I PASSI, NELL'ORDINE IN CUI SI PRENDONO LE DECISIONI ──────────────────
 *  La nota dice cosa si decide lì: il titolo da solo ("Che giorno") non dice
 *  perché la durata sta nella stessa schermata. Ogni passo si porta dietro la
 *  sua ICONA e un ID: l'icona non sta più in un elenco a parte perché due
 *  elenchi paralleli, ora che i passi non sono sempre gli stessi, si sfasano al
 *  primo ritocco — e la schermata dell'indirizzo si ritroverebbe l'icona del
 *  riepilogo. L'id serve a montare il corpo del passo: `passoAttivo === 4` era
 *  un numero che voleva dire «l'indirizzo» solo finché i passi restavano sei.
 *
 *  ── PERCHÉ «IL MATERIALE» NON C'È PIÙ ─────────────────────────────────────
 *  Quel passo chiedeva a mano il TIPO DI POSA — «Da impostare / Taxi /
 *  Indipendente» — cioè la stessa identica domanda a cui rispondono già lo stato
 *  della pratica e il modo di consegna. Due interruttori sulla stessa cosa non
 *  restano d'accordo: bastava programmare una posa lasciando «Da impostare» —
 *  il valore con cui il passo si apriva su ogni pratica che non l'aveva mai
 *  scelto — per riscrivere in scheda un tipo che contraddiceva la consegna, e da
 *  lì in poi la scheda «A domicilio» e la giornata del tecnico raccontavano due
 *  storie diverse sulla stessa pratica.
 *  ⚠️ Il dato NON sparisce: `tipoInstallazione` si continua a scrivere, ma
 *  RICAVATO (`tipoDaAllineare` in crm/spedizione.ts, la stessa regola della
 *  chiusura e del menu «Come arriva al cliente»). Chi lo legge non perde niente
 *  — la borsa dei materiali di `checklistDi`, le pastiglie della scheda cliente,
 *  il «Cosa si posa» del riepilogo qui sotto.
 *  Le NOTE PER CHI VA A POSARE, che stavano nello stesso passo, sono passate al
 *  RIEPILOGO: è l'ultimo momento in cui si guarda tutto insieme, ed è lì che si
 *  scrive «citofono a nome della figlia» dopo aver visto giorno, ora e chi va —
 *  invece che una schermata prima, alla cieca. In fondo al riepilogo c'era già
 *  la loro copia in sola lettura: adesso quella copia è il campo stesso, e una
 *  nota scritta e mai riletta non esiste più.
 *
 *  ── L'INDIRIZZO INVECE RESTA, PERCHÉ NON È «IL MATERIALE» ─────────────────
 *  A domicilio l'indirizzo è l'unico dato che manca quasi sempre, e senza non si
 *  consegna: resta un passo suo, con il suo titolo e i suoi campi, e resta
 *  scrivibile da dentro la procedura — che è l'unica ragione per cui la scheda
 *  «A domicilio» non torna a dire «manca l'indirizzo» senza un modo per porvi
 *  rimedio da qui.
 *  ⚠️ Adesso compare SOLO sulle pose a domicilio, quindi i passi sono cinque —
 *  sei quando si va a casa del cliente. Prima non si poteva: la scala era fissa
 *  a sei e un passo che appare a volte avrebbe fatto ballare i numeri («4 di 6»
 *  seguito da «6 di 6»). Adesso non c'è più nessun numero fisso da far ballare:
 *  la scala conta `passi.length` ogni volta, e il conto non cambia MENTRE si
 *  compila perché `casa` non dipende più da una scelta fatta qui dentro — solo
 *  dalla pratica, che nel frattempo sta ferma.
 *
 *  ── E PERCHÉ IL DRIVER STA DOPO L'ORA ─────────────────────────────────────
 *  Perché solo a quel punto si sa QUANDO, e sapendolo si può dire chi in quella
 *  fascia è libero e chi no. Chiederlo prima avrebbe voluto dire scegliere un
 *  driver e scoprire dopo che quel giorno è già in strada. */
type IdPasso = "esecutore" | "giorno" | "ora" | "viaggio" | "indirizzo" | "riepilogo";

interface Passo {
  id: IdPasso;
  titolo: string;
  nota: string;
  /** l'icona della testata: dice di che decisione si tratta a colpo d'occhio,
   *  anche a chi ha smesso di leggere le etichette */
  icona: ComponentType<{ className?: string }>;
}

/** Il passo che esiste solo a domicilio. Sta fuori dall'elenco per una ragione
 *  di tipi e per una di lettura: dichiarato qui è un `Passo` completo, e
 *  nell'elenco si vede a colpo d'occhio che è l'unico condizionato. */
const PASSO_INDIRIZZO: Passo = {
  id: "indirizzo",
  titolo: "L'indirizzo",
  nota: "Dove si va a posare: senza, il tecnico non parte e la posa non si chiude",
  icona: House,
};

function passiDella(casa: boolean): Passo[] {
  return [
    {
      id: "esecutore",
      titolo: "Chi la esegue",
      nota: "Solo gli installatori. Gli orari escono dall'agenda di questa persona, e qui si sceglie anche chi la affianca",
      icona: UserRound,
    },
    {
      id: "giorno",
      titolo: "Che giorno",
      nota: "Quanto dura l'intervento e in che giornata c'è posto",
      icona: CalendarClock,
    },
    {
      id: "ora",
      titolo: "Che ora",
      nota: "Gli orari ancora liberi del giorno scelto",
      icona: Clock,
    },
    {
      id: "viaggio",
      titolo: "Come ci va",
      nota: "Da solo, oppure con un driver che ce lo porta",
      icona: Car,
    },
    ...(casa ? [PASSO_INDIRIZZO] : []),
    {
      id: "riepilogo",
      titolo: "Riepilogo",
      nota: "Cosa si posa, quando, chi va, quanto si ritira — e le note per chi ci va",
      icona: ClipboardCheck,
    },
  ];
}

/** La scala dei passi: dove si è, cosa si è già deciso, dove si può tornare.
 *  Sul telefono resta scritto solo il passo corrente — cinque etichette in fila
 *  su 360px diventano cinque parole tagliate a metà — ma i numeri restano tutti,
 *  perché "3 di 5" è l'informazione che dice quanto manca.
 *  ⚠️ Quanti sono lo dice l'elenco che arriva, non una costante: i passi sono
 *  cinque o sei a seconda che si vada a casa del cliente, e un numero scritto a
 *  mano qui dentro tornerebbe a dire sei anche quando la fila ne mostra cinque —
 *  cioè un trattino di collegamento appeso dopo l'ultimo riquadro. */
function ScalaPassi({
  passi,
  passo,
  massimo,
  onVai,
}: {
  passi: Passo[];
  passo: number;
  /** l'ultimo passo raggiungibile: oltre, mancano dati */
  massimo: number;
  onVai: (i: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-0.5">
      {passi.map((p, i) => {
        const fatto = i < passo;
        const corrente = i === passo;
        const raggiungibile = i <= massimo;
        //  La chiave è l'ID e non il titolo: il titolo è testo da schermo e
        //  cambia quando cambiano le parole, l'id no.
        return (
          <li key={p.id} className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              disabled={!raggiungibile}
              onClick={() => onVai(i)}
              aria-current={corrente ? "step" : undefined}
              title={raggiungibile ? p.titolo : "Manca ancora qualcosa nei passi precedenti"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors",
                corrente
                  ? "border-slate-400 bg-slate-200/70 font-semibold text-slate-900"
                  : raggiungibile
                    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    : "cursor-not-allowed border-dashed border-slate-200 bg-white text-slate-400",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none",
                  fatto
                    ? "bg-emerald-600 text-white"
                    : corrente
                      ? "bg-slate-900 text-white"
                      : "bg-slate-200 text-slate-500",
                )}
              >
                {fatto ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn("truncate", !corrente && "hidden sm:inline")}>{p.titolo}</span>
            </button>
            {i < passi.length - 1 && <span className="h-px w-2 shrink-0 bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}

export function InstallationScheduleDialog({ lead, open, onOpenChange }: Props) {
  const { consultants, leads: allLeads, updateLead } = useCRM();
  //  Le stesse due scritture della finestra dell'incasso: la cassa e il giorno
  //  della posa hanno un solo posto in cui si scrivono.
  const { incassaSaldo, segnaCompletata } = useAzioniInstallazione();
  const [passo, setPasso] = useState(0);
  const [consulenteId, setConsulenteId] = useState<string>("");
  const [duration, setDuration] = useState<number>(60);
  const [pickedDate, setPickedDate] = useState<string>("");
  const [pickedTime, setPickedTime] = useState<string>("");
  //  ── CHI VA INSIEME A POSARE ──────────────────────────────────────────────
  //   Prima era un campo di TESTO: un nome che non bloccava nessuna agenda.
  //   Adesso è l'id di una persona vera, perché è l'unico modo perché la posa le
  //   tolga il tempo che le sta togliendo davvero. "" = ci va da solo.
  const [accompagnatoreId, setAccompagnatoreId] = useState("");
  const [note, setNote] = useState("");
  //  ⚠️ QUI C'ERA `tipo`, lo stato del passo «Il materiale». Non c'è più perché
  //  non si sceglie più a mano: il tipo di posa si RICAVA (vedi `tipoPosa` più
  //  sotto). Uno stato che nessuno può cambiare non è uno stato, è una copia del
  //  dato vero che invecchia per conto suo.
  //  ── IL DRIVER ────────────────────────────────────────────────────────────
  //   `accompagnato` è solo la domanda a schermo ("da solo" / "con un driver"):
  //   quello che si SALVA è l'id, e uno solo. Un booleano salvato accanto
  //   all'id sarebbe la coppia che si contraddice — «con driver» acceso e
  //   nessun nome sotto — quindi qui vive e qui muore, dentro la finestra.
  const [accompagnato, setAccompagnato] = useState(false);
  const [driverId, setDriverId] = useState("");
  //  Il compenso è testo, come tutti gli importi di questo file: `type=number`
  //  in italiano rifiuta la virgola (vedi leggiEuro).
  const [compenso, setCompenso] = useState("");
  //  L'indirizzo si scrive in tre pezzi e si salva in una riga sola: vedi
  //  componiIndirizzo / scomponiIndirizzo.
  const [via, setVia] = useState("");
  const [cap, setCap] = useState("");
  const [citta, setCitta] = useState("");

  /* ── ⚠️ LA POSA CHE È GIÀ STATA FATTA ────────────────────────────────────
     Richiesta del committente, e nasce da un buco vero: questa finestra sa
     PROGRAMMARE, cioè prendere un posto nell'agenda di qualcuno in un giorno
     che deve ancora arrivare. Ma esistono le pose fatte e mai scritte — quelle
     dei giorni pieni, quelle di chi è passato senza appuntamento — e per
     metterle in archivio bisognava fissarle a oggi e poi correggere il giorno
     da un'altra parte, il che voleva dire due bugie di fila: un'agenda occupata
     da un intervento già finito e una data sbagliata in cassa.

     Qui non si programma niente: si REGISTRA una cosa successa. Nessuna
     agenda viene toccata, non serve un esecutore libero, e il giorno può
     stare nel passato — anzi, deve.

     ⚠️ È UNA MODALITÀ, NON UN SETTIMO PASSO. Infilata come passo avrebbe
      allungato la scala a tutti quelli che stanno programmando davvero, e per
      i pochi che registrano all'indietro avrebbe comunque chiesto esecutore,
      orario e viaggio — tutte domande che su una posa già fatta non hanno
      risposta. */
  const [giaFatta, setGiaFatta] = useState(false);
  const [giornoFatta, setGiornoFatta] = useState("");
  //  ⚠️ `contanti` è QUANTO HA SALDATO, non la parte in contante: il nome è
  //   rimasto da quando questa finestra chiedeva solo i contanti, e cambiarlo
  //   qui vorrebbe dire toccarlo in dieci punti di un file che già scrive in
  //   cassa. La parte in contante è `quotaContanti`, qui sotto.
  const [contanti, setContanti] = useState("");
  /** Quanto del saldo appena incassato è arrivato in mano. "" = non è stato
   *  detto, ed è diverso da zero: zero vuol dire «tutto tracciato». */
  const [quotaContanti, setQuotaContanti] = useState("");
  /** Il gemello scritto: la parte tracciata. ⚠️ NON è un secondo dato — le due
   *  caselle si riempiono a vicenda e sommano sempre al saldo, così non possono
   *  contraddirsi. In archivio ne va una sola (vedi `contanti` in
   *  OpzioniIncasso): l'altra è sempre il resto. */
  const [quotaTracciato, setQuotaTracciato] = useState("");
  /** Lo sconto fatto adesso, alla consegna. "" = nessuno sconto. */
  const [scontoFatta, setScontoFatta] = useState("");
  /** ── ⚠️ IL CONTO DELLA PRATICA, CORREGGIBILE DA QUI ─────────────────────
   *  Richiesta del committente. Registrando una posa vecchia il conto scritto
   *  in cassa è spesso quello sbagliato — l'acconto preso in mano e mai
   *  segnato, il prezzo cambiato a voce — e finora qui si poteva solo
   *  leggerlo: si correggeva da un'altra schermata, cioè quasi mai.
   *  `prezzoFatta` è il PATTUITO, prima dello sconto. */
  const [prezzoFatta, setPrezzoFatta] = useState("");
  const [versatoFatta, setVersatoFatta] = useState("");
  /** ── ⚠️ I COSTI DI QUESTA POSA, SCRITTI QUI ─────────────────────────────
   *  Richiesta del committente: poter aggiungere i costi extra mentre si
   *  registra la posa, e vederli sottratti dal profitto. Sono le stesse voci
   *  della finestra dei costi (`payment.costi.altri`) — non un secondo elenco:
   *  un secondo posto in cui si scrivono dei costi vorrebbe dire due margini
   *  diversi per la stessa pratica.
   *  ⚠️ L'importo è TESTO e non un numero: rileggerlo a ogni tasto con
   *   `leggiEuro` e riscriverlo con `scriviEuro` impedisce di battere la
   *   virgola — «12,» diventa «12» sotto le dita. Si converte al salvataggio. */
  const [costiPosa, setCostiPosa] = useState<{ id: string; titolo: string; testo: string }[]>([]);
  const [modoFatta, setModoFatta] = useState<ModoIva>(MODO_IVA_PREDEFINITO);
  const [registrando, setRegistrando] = useState(false);

  //  ── L'ANAGRAFICA COM'È AL MOMENTO IN CUI LA FINESTRA SI APRE ─────────────
  //   Serve solo dentro l'effetto qui sotto, per sapere se chi ha venduto può
  //   anche posare. Sta in un riferimento e NON fra le dipendenze: messo lì,
  //   ogni rilettura dei consulenti — che arrivano da Supabase e cambiano
  //   oggetto da soli — rieseguirebbe l'effetto e riporterebbe la finestra al
  //   primo passo cancellando quello che si sta compilando.
  const consultantsRef = useRef(consultants);
  consultantsRef.current = consultants;

  useEffect(() => {
    if (open && lead) {
      //  Si riparte sempre dal primo passo: riaprire su "Riepilogo" la scheda di
      //  un altro cliente mostrerebbe un riepilogo che non è ancora stato deciso.
      setPasso(0);
      //  ⚠️ La registrazione all'indietro NON si ricorda fra un'apertura e
      //   l'altra: un giorno o una cifra rimasti dalla pratica di prima
      //   metterebbero in cassa i soldi di un cliente sotto il nome di un
      //   altro. Il giorno resta VUOTO di proposta: proponendo oggi, il gesto
      //   più veloce — aprire e confermare — scriverebbe la data sbagliata,
      //   che è esattamente ciò che questa modalità esiste per evitare.
      setGiaFatta(false);
      setGiornoFatta("");
      /** ── ⚠️ LA CIFRA E L'IVA ARRIVANO DALLA VENDITA ────────────────────
       *  Segnalazione del committente: questa finestra non sapeva niente di
       *  quello che era stato scritto registrando la vendita, e chi arrivava
       *  qui doveva riaprire l'altra schermata per leggere quanto restava —
       *  oppure ribattere una cifra a memoria, che è il modo in cui in cassa
       *  finisce un numero che non torna con nessun altro.
       *  Adesso si propone il SALDO (prezzo chiuso meno quello che ha già
       *  versato) e si eredita il trattamento IVA scelto allora: due cose che
       *  la scheda sa già, e che qui si possono solo confermare o correggere.
       *  ⚠️ Resta una PROPOSTA: chi salda meno — o chi aggiunge una lavorazione
       *   — la corregge, ed è lui a sapere com'è andata. */
      const daSaldare = saldoAllaConsegna(lead);
      //  ⚠️ Il prezzo si propone come lo legge il resto del CRM: quello
      //   concordato, oppure — sulle pratiche d'archivio che non ce l'hanno —
      //   quello che si ricava da cassa e residuo. È la stessa cifra di ripiego
      //   di `incassaSaldo`: due letture diverse vorrebbero dire due prezzi.
      const giaVersato = giaIncassato(lead);
      const pattuito = prezzoVendita(lead) > 0 ? prezzoVendita(lead) : giaVersato + daSaldare;
      setPrezzoFatta(pattuito > 0 ? scriviEuro(pattuito) : "");
      setVersatoFatta(giaVersato > 0 ? scriviEuro(giaVersato) : "");
      setContanti(daSaldare > 0 ? scriviEuro(daSaldare) : "");
      //  ⚠️ Il taglio fra contante e tracciato NON si eredita dalla pratica di
      //   prima — è la stessa scelta della finestra della vendita: lasciato
      //   acceso, i contanti di un cliente finirebbero sulla scheda di un
      //   altro senza che nessuno l'abbia detto.
      setQuotaContanti("");
      setQuotaTracciato("");
      //  ⚠️ Lo sconto non si eredita MAI dalla pratica di prima: è la cifra
      //   che si regala, e lasciata accesa si regalerebbe due volte.
      setScontoFatta("");
      //  Si riparte SEMPRE da quello che c'è in archivio: una modifica lasciata
      //  a metà sull'apertura precedente — magari su un altro cliente — è il
      //  modo più silenzioso di scrivere un costo sbagliato.
      setCostiPosa(
        altriCosti(lead.data).map((v) => ({
          id: v.id,
          titolo: v.titolo,
          testo: v.importo > 0 ? scriviEuro(v.importo) : "",
        })),
      );
      setModoFatta(modoDaBooleano(lead.data.payment?.costi?.ivaInclusa !== false));
      setRegistrando(false);
      const inst = lead.data.installazione;
      //  ── IL RIPIEGO «LA FA CHI HA VENDUTO» NON SCAVALCA LA REGOLA ────────
      //   Quello che è già scritto SULLA POSA vince sempre: è una decisione
      //   presa, e riaprire la finestra non deve cancellarla (per questo
      //   `esecutoriPossibili` tiene in elenco anche chi nel frattempo è stato
      //   spento).
      //   Il ripiego, invece, è solo un'abitudine — di solito la posa la fa chi
      //   ha venduto — e vale finché quella persona può davvero eseguirla.
      //   Proposto comunque, riempiva il primo passo con un nome che l'elenco
      //   non contiene: il passo risultava già risposto, «Avanti» si accendeva
      //   da solo e la posa finiva addosso a chi non è installatore senza che
      //   nessuno avesse scelto niente — cioè il filtro appena aggiunto non
      //   avrebbe cambiato nulla per le pose nuove, che sono tutte.
      //   ⚠️ Decide la STESSA funzione dell'elenco, non una seconda regola: nel
      //   giorno del ripiego (nessun installatore in anagrafica) chi ha venduto
      //   è di nuovo fra i possibili e torna a essere proposto come prima.
      const giaSullaPosa = inst?.consulenteInstallazioneId || "";
      const chiHaVenduto = lead.data.consulenteId || "";
      const puoEseguire = esecutoriPossibili(consultantsRef.current).elenco;
      setConsulenteId(
        giaSullaPosa ||
          (chiHaVenduto && puoEseguire.some((c) => c.id === chiHaVenduto) ? chiHaVenduto : ""),
      );
      setDuration(inst?.durataInstallazione || 60);
      setPickedDate(inst?.dataInstallazione || "");
      setPickedTime(inst?.orarioInstallazione || "");
      setAccompagnatoreId(accompagnatoreDi(lead));
      setNote(inst?.noteInstallazione || "");
      const chiGuida = driverDi(lead);
      setAccompagnato(!!chiGuida);
      setDriverId(chiGuida);
      const gia = compensoDriver(lead);
      setCompenso(gia > 0 ? scriviEuro(gia) : "");
      const scritto = scomponiIndirizzo(spedizioneDi(lead).indirizzo);
      setVia(scritto.via);
      setCap(scritto.cap);
      //  La città della scheda è un SUGGERIMENTO da cui partire, non un
      //  indirizzo (crm/spedizione.ts lo dice per esteso): si propone nel campo,
      //  ma da sola non verrà mai salvata come riga di consegna — vedi il
      //  salvataggio, che scrive solo se c'è una via.
      setCitta(scritto.citta || String(lead.data.citta || "").trim());
    }
  }, [open, lead]);

  const consultant = useMemo(
    () => consultants.find((c) => c.id === consulenteId),
    [consultants, consulenteId],
  );

  const availability = useMemo(() => {
    if (!consultant) return [];
    return generateAvailability(consultant, duration, allLeads, 30, undefined, lead?.id);
  }, [consultant, duration, allLeads, lead?.id]);

  /* ── SI VA A CASA DEL CLIENTE? ───────────────────────────────────────────
     Lo dice la PRATICA, e solo lei: lo stato della trattativa e il modo di
     consegna, che sono la stessa decisione presa alla chiusura.
     ⚠️ QUI C'ERA UNA TERZA FONTE che vinceva sulle altre due: il tipo di posa
     scelto a mano in questa finestra. È sparita insieme al passo che lo
     chiedeva — era il secondo interruttore su «dove avviene l'intervento», e
     l'unico che si poteva lasciare su «Da impostare» sopra una pratica già
     chiusa a domicilio. Togliendola si guadagna anche una cosa che prima non
     c'era: `casa` non può più cambiare mentre si compila, quindi il numero dei
     passi non balla sotto le mani di chi li sta percorrendo.
     ⚠️ Si legge lo stato OLTRE al modo perché sull'archivio importato il modo
     non è una scelta di nessuno ma un ripiego a "sede" (vedi `spedizioneDi`):
     senza lo stato, una vendita chiusa «A domicilio» perderebbe il passo
     dell'indirizzo proprio dove l'indirizzo manca sempre. */
  const casa =
    !!lead && (lead.data.stato === "posa_a_domicilio" || modoConsegna(lead) === "domicilio");

  const passi = useMemo(() => passiDella(casa), [casa]);
  //  Quanti sono lo dice l'elenco: cinque, o sei quando c'è l'indirizzo. Ogni
  //  numero scritto a mano qui sarebbe giusto per una delle due procedure e
  //  sbagliato per l'altra.
  const ultimoPasso = passi.length - 1;

  /* ── IL TIPO DI POSA NON SI CHIEDE PIÙ: SI RICAVA ─────────────────────────
     `installazione.tipoInstallazione` ha ancora due lettori A SCHERMO — le
     pastiglie «Tipo» della scheda cliente e il «Cosa si posa» del riepilogo qui
     sotto — più uno addormentato: `checklistDi`, che da quel valore sceglie la
     borsa dei materiali di default, ma il solo componente che la disegna
     (`ChecklistMateriali`) oggi non lo monta nessuno. Vale come lettore lo
     stesso — il giorno in cui quella borsa torna a schermo deve trovare un tipo
     aggiornato, non uno fermo a quando qualcuno lo scelse a mano — ma non è su
     di lui che si regge questa scrittura. Si continua a
     scriverlo, ma DERIVATO dal modo di consegna con la stessa funzione che usano
     la chiusura e il menu «Come arriva al cliente»: una risposta sola alla
     domanda «dove avviene l'intervento».
     `tipoDaAllineare` torna `undefined` quando non c'è niente da correggere —
     il valore in scheda è già quello giusto, oppure è un pacco su cui non si
     inventa un tipo di posa — e in quel caso quello che c'è resta com'è.

     ⚠️ MA SI RICAVA SOLO QUANDO STATO E MODO DICONO LA STESSA COSA, e questa
     riga in più è tutta la differenza fra riparare il guasto e rifarlo due
     schermate più in là. Sull'archivio importato il modo NON è una scelta di
     nessuno: è il ripiego "sede" di `spedizioneDi`, e ce l'ha addosso anche una
     vendita chiusa «A domicilio». Ricavando il tipo dal solo modo, programmare
     la posa avrebbe riscritto in scheda «In sede» proprio sulla pratica a cui
     questa stessa finestra sta chiedendo l'indirizzo di casa (`casa` qui sopra
     legge anche lo stato, apposta): la pastiglia «Tipo» della scheda cliente e
     il «Cosa si posa» del riepilogo avrebbero contraddetto il passo
     dell'indirizzo — cioè esattamente le due voci discordi che il passo «Il
     materiale» è stato tolto per far sparire.
     Quando i due si contraddicono non si elegge un vincitore QUI: si lascia
     scritto quello che c'è (arriva intatto dallo spread di `installazione`) e la
     contraddizione si ripara dove nasce, cioè dove stato e modo si scrivono
     insieme — la finestra della chiusura, o il menu «…» → «Come arriva al
     cliente». È la stessa regola del salvataggio qui sotto, che ha smesso di
     scrivere il modo per non essere il terzo posto che decide una cosa decisa
     altrove. */
  const modoScritto = lead ? modoConsegna(lead) : "sede";
  //  Cosa dichiara lo stato, se lo dichiara: solo le tre chiusure dicono come
  //  arriva l'impianto (MODO_CONSEGNA_DA_STATO in crm/types). Su tutti gli altri
  //  stati non c'è niente da confrontare e il modo scritto è l'unica risposta.
  const modoDelloStato = lead ? MODO_CONSEGNA_DA_STATO[lead.data.stato] : undefined;
  const consegnaConcorde = !modoDelloStato || modoDelloStato === modoScritto;
  const allineamentoTipo =
    lead && consegnaConcorde ? tipoDaAllineare(lead, modoScritto) : undefined;
  const tipoPosa: TipoInstallazione =
    allineamentoTipo?.tipoInstallazione ??
    lead?.data.installazione?.tipoInstallazione ??
    "da_impostare";

  //  Chi si può mandare come driver. Chi è già scritto su questa posa resta in
  //  elenco anche se nel frattempo è stato spento: vedi driverPossibili.
  const elencoDriver = useMemo(
    () => driverPossibili(consultants, driverId, consulenteId, accompagnatoreId),
    [consultants, driverId, consulenteId, accompagnatoreId],
  );

  //  Chi si può mettere accanto a chi posa. Stessa regola dell'elenco dei
  //  driver, altro mestiere: vedi accompagnatoriPossibili.
  const elencoAccompagnatori = useMemo(
    () => accompagnatoriPossibili(consultants, accompagnatoreId, consulenteId, driverId),
    [consultants, accompagnatoreId, consulenteId, driverId],
  );

  /** Gli accompagnatori che in quella fascia NON sono liberi.
   *  ⚠️ Il margine è STRADA_ACCOMPAGNATORE, non quello del driver: fa lo stesso
   *  viaggio di chi esegue, non quello — più lungo — di chi guida. Chiederlo con
   *  un margine diverso da quello che booking-utils usa per bloccargli l'agenda
   *  significherebbe proporre qui una persona che ogni altra schermata mostra
   *  occupata.
   *  ⚠️ Finché non ci sono giorno e ora l'insieme è VUOTO, e va bene così:
   *  l'accompagnatore si sceglie al primo passo, quando l'orario non esiste
   *  ancora. La domanda si rifà appena l'orario c'è — vedi
   *  `accompagnatoreOccupato`, che ferma la scala dei passi. */
  const accompagnatoriImpegnati = useMemo(() => {
    const fuori = new Set<string>();
    if (!pickedDate || !pickedTime) return fuori;
    for (const c of elencoAccompagnatori) {
      if (
        !liberoNellaFascia(
          c,
          pickedDate,
          pickedTime,
          duration,
          allLeads,
          STRADA_ACCOMPAGNATORE,
          lead?.id,
        )
      ) {
        fuori.add(c.id);
      }
    }
    return fuori;
  }, [elencoAccompagnatori, pickedDate, pickedTime, duration, allLeads, lead?.id]);

  /** I driver che in quella fascia NON sono liberi.
   *  ⚠️ La fascia è quella della posa più TRE ORE di strada prima e dopo: è la
   *  stessa regola con cui booking-utils blocca la loro agenda, e chiederla qui
   *  in modo più permissivo significherebbe proporre un driver che poi risulta
   *  occupato in ogni altra schermata. */
  const driverImpegnati = useMemo(() => {
    const fuori = new Set<string>();
    if (!pickedDate || !pickedTime) return fuori;
    for (const c of elencoDriver) {
      if (
        !liberoNellaFascia(c, pickedDate, pickedTime, duration, allLeads, STRADA_DRIVER, lead?.id)
      ) {
        fuori.add(c.id);
      }
    }
    return fuori;
  }, [elencoDriver, pickedDate, pickedTime, duration, allLeads, lead?.id]);

  /** ── IL DRIVER GIÀ SCELTO PUÒ DIVENTARE OCCUPATO ──────────────────────────
   *  L'elenco qui sopra spegne le voci di chi non è libero, ma quella SELEZIONATA
   *  resta scelta — e deve restarlo, o cambiare durata farebbe sparire il nome
   *  sotto le mani. Il guaio è l'ordine in cui si torna indietro: si sceglie il
   *  driver alle 10:00, si torna al passo dell'ora, si sposta la posa alle 15:00
   *  e in quella fascia quella persona è già in strada. Nessuno riapre il passo
   *  del driver, quindi nessuno rilegge la voce: si arriverebbe al riepilogo con
   *  due agende che si accavallano e il messaggio di conferma direbbe pure che
   *  lo slot è stato bloccato a tutti e due.
   *  Da qui in poi è la stessa domanda fatta al momento giusto — «quello scelto,
   *  ADESSO, è libero?» — e la risposta ferma la scala dei passi come la ferma un
   *  giorno senza ora. È la regola scritta in booking-utils: fra perdere uno slot
   *  e mandare la stessa persona in due posti, si perde lo slot. */
  const driverOccupato = accompagnato && !!driverId && driverImpegnati.has(driverId);

  /** ── E L'ACCOMPAGNATORE ANCORA DI PIÙ ─────────────────────────────────────
   *  Lo stesso guaio del driver, peggiorato dall'ordine dei passi: qui la
   *  persona si sceglie al PRIMO passo, quando giorno e ora non ci sono ancora,
   *  quindi la domanda «è libero?» la prima volta non si può nemmeno fare. Si fa
   *  qui, dove l'orario esiste, e la risposta ferma la scala dei passi: senza,
   *  si arriverebbe al «Programma» con una persona che quel pomeriggio è già in
   *  strada per un'altra posa — che è esattamente il problema per cui l'agenda è
   *  una sola. */
  const accompagnatoreOccupato =
    !!accompagnatoreId && accompagnatoriImpegnati.has(accompagnatoreId);

  //  L'indirizzo come verrà salvato: una riga sola. Si calcola qui perché lo
  //  usano sia il salvataggio sia il riepilogo, e due composizioni diverse
  //  farebbero leggere un indirizzo e salvarne un altro.
  const indirizzoComposto = componiIndirizzo(via, cap, citta);
  //  Senza via non è un indirizzo: la sola città è il suggerimento che c'era
  //  già in scheda, e salvarla spegnerebbe l'avviso «manca l'indirizzo» senza
  //  che nessuno abbia scritto dove si va.
  const indirizzoDaSalvare = via.trim() ? indirizzoComposto : "";

  /* ── IL CONTO DELLA POSA REGISTRATA ALL'INDIETRO ─────────────────────────
     ⚠️ NON C'È UNA SECONDA ARITMETICA DELL'IVA. Il conto lo fa `contoIva`, la
      stessa funzione che usa la finestra dell'incasso e che disegna i tre
      numeri qui sotto: imponibile, imposta, totale. Una moltiplicazione
      scritta a mano in questa finestra avrebbe fatto vedere a schermo un
      numero e messo in cassa l'altro. */
  const contanteIncassato = Math.max(0, leggiEuro(contanti));
  const contoFatta = contoIva(contanteIncassato, modoFatta);
  /* ── ⚠️ QUANTO DI QUESTO SALDO È TRACCIATO ────────────────────────────────
     Segnalazione del committente: qui mancava del tutto. Si chiede il
     contante e il tracciato è il resto — un campo solo, come nella finestra
     della vendita, perché due campi per la stessa cifra si contraddicono al
     primo arrotondamento.
     ⚠️ Campo VUOTO e campo a ZERO sono due cose diverse: vuoto vuol dire che
      nessuno l'ha detto e in archivio non si scrive niente; zero vuol dire
      «tutto tracciato», che è una dichiarazione. */
  const quotaDetta = quotaContanti.trim() !== "";
  const canaleFatta =
    divisioneMovimento(contanteIncassato, quotaDetta ? leggiEuro(quotaContanti) : undefined) ??
    ({ tracciato: contanteIncassato, contanti: 0 } as const);
  /* ── ⚠️ DUE CASELLE CHE NON POSSONO CONTRADDIRSI ──────────────────────────
     Richiesta del committente: voleva scrivere il TRACCIATO, non dedurlo dal
     contante. Due caselle libere che devono fare una somma esatta si
     contraddicono al primo ripensamento — si corregge una e l'altra resta
     indietro — quindi qui ognuna riempie l'altra: quello che si batte in una è
     la verità, l'altra diventa il resto. Sommano sempre al saldo, per
     costruzione.
     ⚠️ In archivio ne finisce UNA SOLA (il contante): il tracciato è il resto
      e si ricalcola, così non esiste il caso di due cifre salvate che non
      tornano. */
  const restoDi = (testo: string) =>
    scriviEuro(
      Math.max(0, contanteIncassato - Math.min(Math.max(0, leggiEuro(testo)), contanteIncassato)),
    );
  const scriviQuotaContanti = (v: string) => {
    setQuotaContanti(v);
    setQuotaTracciato(v.trim() === "" ? "" : restoDi(v));
  };
  const scriviQuotaTracciato = (v: string) => {
    setQuotaTracciato(v);
    setQuotaContanti(v.trim() === "" ? "" : restoDi(v));
  };
  /** Le due caselle insieme: le pillole e lo svuota-tutto passano da qui. */
  const scriviQuote = (contanteDichiarato: string) => {
    setQuotaContanti(contanteDichiarato);
    setQuotaTracciato(contanteDichiarato.trim() === "" ? "" : restoDi(contanteDichiarato));
  };
  /* ── ⚠️ CAMBIANDO IL SALDO, IL TAGLIO SI RIFÀ ────────────────────────────
     Il tracciato è il RESTO del saldo: se il saldo cambia (si corregge la cifra
     o si applica uno sconto) e nessuno rifà il conto, resta a schermo una
     seconda cifra che con la prima non torna più. */
  const scriviSaldato = (v: string) => {
    setContanti(v);
    if (quotaContanti.trim() === "") return;
    const saldo = Math.max(0, leggiEuro(v));
    const inMano = Math.min(Math.max(0, leggiEuro(quotaContanti)), saldo);
    setQuotaContanti(scriviEuro(inMano));
    setQuotaTracciato(scriviEuro(Math.max(0, saldo - inMano)));
  };
  /** Lo sconto abbassa quello che resta da saldare, e la cifra proposta sopra
   *  si rifà da sola: è una PROPOSTA, e una proposta che non tiene conto dello
   *  sconto appena scritto costringerebbe a rifare la sottrazione a mente. */
  const scontoDato = Math.max(0, leggiEuro(scontoFatta));
  /* ── I COSTI SCRITTI QUI, PRONTI PER L'ARCHIVIO ──────────────────────────
     ⚠️ Le righe senza titolo E senza importo si buttano: sono i «+» premuti
      per sbaglio, e salvarle vorrebbe dire una voce di costo vuota che ogni
      volta che si riapre la finestra torna lì a chiedere cosa fosse. */
  const costiPuliti: VoceCosto[] = costiPosa
    .map((r) => ({
      id: r.id,
      titolo: r.titolo.trim(),
      importo: Math.max(0, leggiEuro(r.testo)),
    }))
    .filter((r) => r.titolo !== "" || r.importo > 0);
  const totaleCostiScritti = costiPuliti.reduce((s, r) => s + r.importo, 0);
  /* ── ⚠️ IL MARGINE CHE SI VEDE QUI È QUELLO DELLA PRATICA, NON DEL MESE ──
     Si conta come lo conta la pagina KPI, scheda per scheda: prezzo chiuso,
     meno l'IVA che ci sta dentro, meno TUTTI i costi della pratica — i tre
     fissi (impianto, installatore, parrucchiere) più quelli scritti a mano.
     Non toglie la pubblicità, che è una spesa del mese e non di un cliente:
     per questo l'etichetta lo dice, invece di far credere che sia l'utile
     finale. */
  const prezzoDato = Math.max(0, leggiEuro(prezzoFatta));
  const versatoDato = Math.max(0, leggiEuro(versatoFatta));
  const prezzoChiuso = prezzoScontato(prezzoDato, scontoDato);
  const costiDellaPratica = lead
    ? totaleCostiPratica({
        payment: { ...lead.data.payment, costi: { ...lead.data.payment?.costi, altri: costiPuliti } },
      })
    : 0;
  const margineStimato = prezzoChiuso - contoIva(prezzoChiuso, modoFatta).imposta - costiDellaPratica;
  /* ── ⚠️ SI SCRIVE SOLO SE SONO DAVVERO CAMBIATI ─────────────────────────
     Aprire e chiudere questa finestra senza toccare i costi non deve produrre
     una scrittura in archivio: una modifica finta finisce comunque nello
     storico della scheda, e chi lo legge dopo cerca per mezz'ora cosa è
     cambiato. */
  /** Vero se qualcuno ha corretto il conto della pratica: senza, una
   *  correzione su una pratica già saldata non arriverebbe mai in archivio
   *  (`incassaSaldo` esce in silenzio quando non c'è un saldo aperto). */
  const contoCorretto =
    !!lead && (prezzoDato !== prezzoVendita(lead) || versatoDato !== giaIncassato(lead));
  const costiCambiati =
    !!lead &&
    JSON.stringify(costiPuliti) !== JSON.stringify(altriCosti(lead.data));
  const cambiaCosto = (id: string, dati: Partial<{ titolo: string; testo: string }>) =>
    setCostiPosa((righe) => righe.map((r) => (r.id === id ? { ...r, ...dati } : r)));
  const togliCosto = (id: string) => setCostiPosa((righe) => righe.filter((r) => r.id !== id));
  const aggiungiCosto = () =>
    setCostiPosa((righe) => [...righe, { id: nuovoIdVoce(), titolo: "", testo: "" }]);
  /* ── ⚠️ IL CONTO SI LEGGE DAI CAMPI, NON PIÙ DALLA SCHEDA ────────────────
     Da quando prezzo e già versato si possono correggere qui, ogni cifra a
     schermo deve partire da quello che c'è NEI CAMPI: leggendo la scheda,
     correggere l'acconto avrebbe lasciato il «resta» fermo al vecchio conto —
     due numeri sotto gli occhi che si contraddicono, e quello sbagliato è
     quello grande. */
  const restaSecondoIcampi = (prezzoT: string, scontoT: string, versatoT: string) =>
    Math.max(
      0,
      prezzoScontato(Math.max(0, leggiEuro(prezzoT)), Math.max(0, leggiEuro(scontoT))) -
        Math.max(0, leggiEuro(versatoT)),
    );
  /** Le tre correzioni rifanno la proposta: una proposta che non tiene conto di
   *  quello che si è appena scritto costringerebbe a rifare la sottrazione a
   *  mente, che è esattamente il lavoro che questa finestra toglie. */
  const scriviSconto = (v: string) => {
    setScontoFatta(v);
    const resta = restaSecondoIcampi(prezzoFatta, v, versatoFatta);
    scriviSaldato(resta > 0 ? scriviEuro(resta) : "");
  };
  const scriviPrezzo = (v: string) => {
    setPrezzoFatta(v);
    const resta = restaSecondoIcampi(v, scontoFatta, versatoFatta);
    scriviSaldato(resta > 0 ? scriviEuro(resta) : "");
  };
  const scriviVersato = (v: string) => {
    setVersatoFatta(v);
    const resta = restaSecondoIcampi(prezzoFatta, scontoFatta, v);
    scriviSaldato(resta > 0 ? scriviEuro(resta) : "");
  };
  //  Il giorno non può stare nel futuro: si sta registrando una cosa successa,
  //  e una posa «già fatta» datata la settimana prossima è un errore di
  //  digitazione che finirebbe in archivio senza che nessuno lo veda.
  const giornoFuturo = !!giornoFatta && giornoFatta > giornoISO();
  const puoRegistrare = !!lead && !!giornoFatta && !giornoFuturo && !registrando;

  const registraGiaFatta = async () => {
    if (!lead || !puoRegistrare) return;
    setRegistrando(true);
    //  Si chiude prima di scrivere: l'ultimo tocco deve sembrare istantaneo.
    onOpenChange(false);
    //  ⚠️ SI GUARDA COSA HA SCRITTO, NON QUANTO SI È DIGITATO. `incassaSaldo`
    //   scrive la cassa e il giorno della posa insieme (vedi `dataPosa` in
    //   OpzioniIncasso), ma esce in silenzio quando non c'è un saldo aperto —
    //   e un cliente che aveva già pagato tutto è esattamente il caso di una
    //   posa registrata all'indietro. Il controllo di prima guardava
    //   `contanteIncassato > 0`, cioè la cifra digitata: con dei contanti
    //   scritti sopra una pratica già saldata la finestra si chiudeva e in
    //   archivio non finiva NIENTE, né la cassa né la posa. Nessun errore,
    //   solo un lavoro che sembrava fatto.
    //   Adesso: se non ha scritto lei, si segna comunque la posa.
    //  ⚠️ ANCHE IL SOLO SCONTO È UNA COSA DA SCRIVERE. Senza questo «oppure»,
    //   uno sconto fatto a un cliente che aveva già pagato tutto non arrivava
    //   mai in archivio: la finestra si chiudeva, la posa si segnava, e il
    //   prezzo restava quello pieno.
    const scritto =
      (contanteIncassato > 0 || scontoDato > 0 || costiCambiati || contoCorretto) &&
      (await incassaSaldo(lead, modoFatta, {
        importo: contanteIncassato,
        concludi: true,
        giorno: giornoFatta,
        dataPosa: giornoFatta,
        //  Lo sconto abbassa il prezzo della pratica: da lì margine, IVA
        //  scorporata e tasse si rifanno da soli (vedi `sconto` in
        //  OpzioniIncasso).
        sconto: scontoDato,
        //  ⚠️ L'elenco INTERO dei costi scritti a mano, non un'aggiunta: la
        //   finestra si è aperta con quelli che c'erano e li sostituisce.
        altriCosti: costiPuliti,
        //  Il conto corretto a mano in questa finestra: prezzo pattuito e
        //  quello che era già in cassa (vedi `prezzo`/`versato` in
        //  OpzioniIncasso).
        prezzo: prezzoDato,
        versato: versatoDato,
        //  Vuoto = non detto: `undefined` lascia intatta la dichiarazione
        //  fatta alla vendita (vedi `contanti` in OpzioniIncasso).
        contanti: quotaDetta ? leggiEuro(quotaContanti) : undefined,
      }));
    if (scritto) return;
    await segnaCompletata(lead, { giorno: giornoFatta, dataPosa: giornoFatta });
  };

  const handleSave = async () => {
    if (!lead) return;
    if (!consulenteId) {
      toast.error("Seleziona un consulente per l'installazione");
      return;
    }
    if (!pickedDate || !pickedTime) {
      toast.error("Scegli uno slot dall'agenda del consulente");
      return;
    }
    //  «Con un driver» senza aver detto chi è non si salva: scritto così
    //  resterebbe una posa che dichiara un accompagnatore e non ne blocca
    //  l'agenda. La scala dei passi lo impedisce già, ma il salvataggio non si
    //  fida di una regola che vive a schermo.
    if (accompagnato && !driverId) {
      toast.error("Hai scelto «con un driver»: dì chi è, oppure segna che ci va da solo.");
      return;
    }
    //  ⚠️ L'AGENDA È UNA SOLA, e vale anche per chi affianca. Un accompagnatore
    //  che in quella fascia è già impegnato non si salva: la scala dei passi lo
    //  impedisce già, ma il salvataggio non si fida di una regola che vive a
    //  schermo — si arriva qui anche con una scorciatoia di tastiera.
    if (accompagnatoreOccupato) {
      toast.error(
        "L'accompagnatore scelto non è libero in quella fascia: cambia orario, oppure scegline un altro al primo passo.",
      );
      return;
    }
    //  ── QUESTA FINESTRA NON DECIDE PIÙ COME ARRIVA L'IMPIANTO ──────────────
    //   Qui il salvataggio scriveva anche il MODO DI CONSEGNA, ricavandolo dal
    //   tipo di posa scelto a mano: "Taxi" spostava la pratica a domicilio,
    //   "Indipendente" la riportava in sede. Aveva senso finché quella era una
    //   scelta di qualcuno — era la stessa domanda dei tre modi, e andava
    //   scritta insieme. Adesso il tipo si RICAVA dal modo (vedi `tipoPosa`), e
    //   riscrivere il modo a partire da lui sarebbe un cerchio: un valore
    //   derivato che torna a sovrascrivere la propria fonte. Il caso in cui
    //   morde è reale e frequente — una pratica chiusa «A domicilio» il cui
    //   modo è ancora il ripiego "sede" dell'archivio si vedrebbe cambiare la
    //   consegna solo perché qualcuno le ha fissato il giorno della posa.
    //   Come arriva al cliente si decide dove lo si decide: alla chiusura
    //   (ChiusuraDialog) o dal menu «…» → «Come arriva al cliente»
    //   (`segnaModoConsegna`), che è una riga sola e lascia un «Annulla».
    //   Resta l'INDIRIZZO, che è un dato di questa posa e non una
    //   classificazione: si prepara un oggetto solo e lo si allega soltanto se è
    //   davvero cambiato — riscrivere gli stessi valori è una modifica finta che
    //   finisce comunque nello storico della scheda.
    const sped = spedizioneDi(lead);
    const spedNuova = { ...sped };
    let spedCambiata = false;
    //  L'indirizzo si scrive solo se si va a domicilio e solo se è stato scritto
    //  davvero: un campo lasciato vuoto NON cancella quello che c'è in scheda —
    //  cancellare un indirizzo è un gesto suo, e si fa dalla scheda «A
    //  domicilio», non dimenticandosi di riscriverlo qui.
    if (casa && indirizzoDaSalvare && indirizzoDaSalvare !== sped.indirizzo) {
      spedNuova.indirizzo = indirizzoDaSalvare;
      spedCambiata = true;
    }
    //  ── COM'ERA PRIMA DI QUESTO SALVATAGGIO ────────────────────────────────
    //   Serve all'«Annulla» del messaggio: programmare è la decisione più facile
    //   da sbagliare di tutta la pagina — la persona sbagliata, il giorno
    //   sbagliato, o proprio il cliente sbagliato — e finora era anche l'unica
    //   che non si poteva disfare. Si tiene l'installazione INTERA e non i
    //   singoli campi perché `updateLead` sostituisce il campo tutto insieme:
    //   rimettere solo giorno e ora lascerebbe in scheda il driver di adesso,
    //   l'indirizzo appena scritto e il tipo di posa appena riallineato.
    const installazionePrima = lead.data.installazione;
    //  ⚠️ Si SOMMA a ciò che c'è già (spread di `installazione`): la checklist
    //  dei materiali non si mostra più, ma quella già salvata resta scritta —
    //  e con lei la spedizione, che vive nello stesso oggetto.
    const salvato = await updateLead(lead.id, (attuale) => ({
      installazione: {
        ...(attuale.installazione ?? {}),
        consulenteInstallazioneId: consulenteId,
        dataInstallazione: pickedDate,
        orarioInstallazione: pickedTime,
        durataInstallazione: duration,
        //  ⚠️ `tecnicoAssegnato` NON si scrive più: era il campo di testo libero
        //  che stava qui prima dell'accompagnatore, e quello che c'è in archivio
        //  resta dov'è — viaggia dentro lo spread qui sopra, intatto. Vedi
        //  `accompagnatoreScrittoAMano`, che è l'unico posto da cui si rilegge.
        //  Chi va insieme a posare. «Da solo» si scrive per esteso (stringa
        //  vuota) per la stessa ragione del driver: lasciare il campo com'era
        //  vorrebbe dire che toglierlo non ha effetto, e la sua agenda
        //  resterebbe bloccata per una posa a cui non va più.
        accompagnatoreId,
        noteInstallazione: note,
        //  ⚠️ Il tipo di posa si scrive ancora, ma RICAVATO e solo quando c'è
        //  davvero da correggerlo: `allineamentoTipo` è `undefined` quando il
        //  valore in scheda è già quello giusto (e allora arriva intatto dallo
        //  spread qui sopra) oppure quando la pratica è un pacco, su cui un tipo
        //  di posa sarebbe inventato. Vedi `tipoPosa`: la regola è una sola e
        //  vive in crm/spedizione.ts.
        ...allineamentoTipo,
        //  Chi lo accompagna. «Da solo» si scrive per esteso (stringa vuota):
        //  lasciare il campo com'era vorrebbe dire che togliere il driver non ha
        //  effetto, e la sua agenda resterebbe bloccata per una posa a cui non
        //  va più. Il compenso segue il driver: senza driver non c'è niente da
        //  pagare in più, e un importo orfano si troverebbe mesi dopo senza
        //  sapere a chi si riferisse.
        driverId: accompagnato ? driverId : "",
        compensoDriver: accompagnato ? leggiEuro(compenso) : 0,
        ...(spedCambiata ? { spedizione: spedNuova } : {}),
      },
    }));
    //  ⚠️ LA RISPOSTA SI LEGGE. `updateLead` torna `false` anche senza errore di
    //   rete — per esempio quando lavora su un lead che l'elenco in memoria non
    //   ha — e senza questo controllo la finestra si chiuderebbe annunciando uno
    //   slot bloccato che non è stato bloccato: il tecnico resta libero in
    //   agenda, il cliente ha l'appuntamento a voce, e nessuno sa perché.
    //   La finestra NON si chiude: quello che è stato compilato resta lì, pronto
    //   per riprovare.
    if (!salvato) {
      toast.error("Non è stato salvato: la posa non è stata programmata. Riprova.");
      return;
    }
    //  Il messaggio dice CHE COSA è stato bloccato e a chi: con un driver le
    //  agende occupate sono due, ed è esattamente la cosa che chi programma deve
    //  sapere subito (le tre ore di strada del driver spariscono da tutte le
    //  altre schermate senza altri avvisi).
    const nomeDelDriver = accompagnato
      ? consultants.find((c) => c.id === driverId)?.data.nome || ""
      : "";
    const nomeDiChiAffianca = accompagnatoreId
      ? consultants.find((c) => c.id === accompagnatoreId)?.data.nome || ""
      : "";
    //  Le agende bloccate possono essere tre — chi esegue, chi lo affianca, chi
    //  guida — e si nominano TUTTE: sono ore che spariscono da ogni altra
    //  schermata senza nessun altro avviso, e chi programma deve saperlo adesso.
    const bloccate = [
      consultant?.data.nome || "chi la esegue",
      nomeDiChiAffianca ? `${nomeDiChiAffianca} (accompagnatore)` : null,
      nomeDelDriver ? `${nomeDelDriver} (driver)` : null,
    ].filter((v): v is string => !!v);
    toast.success(
      bloccate.length > 1
        ? `Installazione programmata. Slot bloccato a ${bloccate.slice(0, -1).join(", ")} e a ${bloccate[bloccate.length - 1]}.`
        : "Installazione programmata. Slot bloccato sull'agenda del consulente.",
      {
        //  ── DISFARE LA PROGRAMMAZIONE ─────────────────────────────────────
        //   Stessa forma di ogni altra azione di questo file: si scrive subito e
        //   l'errore si ripara dal messaggio, senza conferme davanti. Qui vale
        //   doppio, perché una posa programmata per sbaglio non resta ferma
        //   dov'è: occupa la fascia del consulente (e le tre ore di strada del
        //   driver) su ogni altra schermata, e la si scopre solo quando qualcun
        //   altro non trova più posto in quella giornata.
        //   Rimette l'installazione com'era — se prima non c'era niente, un
        //   oggetto vuoto: `updateLead` sostituisce il campo intero, quindi
        //   `undefined` lascerebbe in scheda proprio la posa da togliere.
        action: {
          label: "Annulla",
          onClick: () => void updateLead(lead.id, { installazione: installazionePrima ?? {} }),
        },
      },
    );
    onOpenChange(false);
  };

  const cliente = [lead?.data.nome, lead?.data.cognome].filter(Boolean).join(" ") || "—";
  //  Chi può eseguire la posa: SOLO gli installatori, senza ripieghi. Se non ce
  //  n'è nemmeno uno l'elenco è vuoto e `manca` dice perché: il primo passo
  //  diventa la schermata che spiega cosa accendere e ci porta (vedi
  //  SenzaInstallatori). Il criterio sta tutto in `esecutoriPossibili`, che è
  //  l'unica porta da cui questo elenco si legge.
  const { elenco: esecutori, manca: mancaEsecutore } = esecutoriPossibili(
    consultants,
    consulenteId,
  );
  //  Il denaro in attesa si dice anche qui: chi fissa il giorno è la stessa
  //  persona che poi dovrà avvisare il tecnico di quanto ritirare.
  const saldo = lead ? saldoAllaConsegna(lead) : 0;
  const versatoLead = lead ? giaIncassato(lead) : 0;
  //  Il prodotto arriva dall'archivio e non è sempre una stringa: mostrarlo
  //  senza controllare è il modo più veloce di far esplodere il riepilogo.
  const prodotto =
    typeof lead?.data.payment?.prodotto === "string" ? lead.data.payment.prodotto.trim() : "";

  /* ── DOVE SI PUÒ ARRIVARE ────────────────────────────────────────────────
     Un passo si apre solo quando quello da cui dipende è deciso: senza
     consulente non c'è agenda, senza giorno non ci sono orari. È la stessa
     regola che disegna la scala in cima e che accende "Avanti", scritta una
     volta sola — due copie divergono al primo ritocco.
     Il passo del driver si comporta come gli altri: «con un driver» senza aver
     detto chi è non fa passare avanti, esattamente come un giorno senza ora — e
     nemmeno un driver che nel frattempo è diventato occupato in quella fascia,
     che è un nome scritto ma non una persona disponibile. */
  //  ⚠️ L'accompagnatore si sceglie al passo 1 ma si può verificare solo da qui
  //  in poi: la sua fascia esiste appena c'è l'ora. Se in quella fascia è
  //  occupato ci si ferma AL PASSO DELL'ORA — è lì che si ripara, spostando la
  //  posa — e la nota di quel passo dice anche l'altra via d'uscita, cioè
  //  tornare al primo e cambiare persona.
  //  ⚠️ NON basta che un id sia scritto: deve essere una persona che questo
  //  passo propone davvero. Un id rimasto in scheda dopo che quella persona è
  //  sparita dall'anagrafica accenderebbe «Avanti» sopra una schermata che dice
  //  che non c'è nessuno — cioè si programmerebbe una posa su un esecutore che
  //  non esiste più, senza che nessuno l'abbia scelto.
  const esecutoreScelto = !!consulenteId && esecutori.some((c) => c.id === consulenteId);
  const massimo = !esecutoreScelto
    ? 0
    : !pickedDate
      ? 1
      : !pickedTime || accompagnatoreOccupato
        ? 2
        : accompagnato && (!driverId || driverOccupato)
          ? 3
          : //  Da qui in poi non c'è più niente da bloccare: l'indirizzo si può
            //  lasciare per dopo (lo dice l'avviso del riepilogo) e il riepilogo
            //  non chiede niente. Quanti passi siano — cinque o sei — lo dice
            //  l'elenco, non una costante.
            ultimoPasso;
  //  Se un dato viene tolto mentre si è più avanti (si cambia consulente e la
  //  data salta), il passo mostrato torna indietro da solo invece di restare su
  //  una schermata che non ha più senso.
  const passoAttivo = Math.min(passo, massimo);
  //  ⚠️ «Siamo all'ultimo?» si chiede sull'ID e non sul numero: è l'ultimo passo
  //  quello del RIEPILOGO, ed è lui a portare il pulsante «Programma». Con
  //  l'indice, una procedura da cinque passi e una da sei avrebbero avuto due
  //  numeri diversi per la stessa schermata.
  const attivo = passi[passoAttivo];
  const ultimo = attivo.id === "riepilogo";

  const giornoScelto = availability.find((d) => d.date === pickedDate) || null;
  //  La data già fissata può non essere più fra quelle libere (è passata, o
  //  l'agenda del consulente è cambiata): resta comunque scelta, perché
  //  riprogrammare non deve cancellare quello che c'era.
  const dataFuoriAgenda = !!pickedDate && !availability.some((d) => d.date === pickedDate);
  const orariLiberi = giornoScelto?.slots ?? [];
  const orari =
    pickedTime && !orariLiberi.includes(pickedTime) ? [pickedTime, ...orariLiberi] : orariLiberi;

  const nomeConsulente = consultant?.data.nome || "—";
  //  Il driver entra nella riga «chi va» perché è esattamente quello: una
  //  seconda persona che quel giorno esce. Tenerlo fuori avrebbe lasciato il
  //  riepilogo a dire «ci va Marco» mentre in strada ce ne sono due.
  const nomeDriverScelto = accompagnato
    ? consultants.find((c) => c.id === driverId)?.data.nome || ""
    : "";
  const nomeAccompagnatoreScelto = accompagnatoreId
    ? consultants.find((c) => c.id === accompagnatoreId)?.data.nome || ""
    : "";
  //  ── IL NOME SCRITTO A MANO DELLE POSE VECCHIE ────────────────────────────
  //   Compare ancora, dichiarato per quello che è: su quelle pratiche è l'unica
  //   cosa che si sa di chi altro ci andava, e toglierlo l'avrebbe fatto sparire
  //   senza che nessuno se ne accorgesse.
  //   ⚠️ Si guarda anche la scelta APPENA FATTA, non solo quella salvata: chi
  //   sceglie una persona vera deve veder sparire il vecchio nome subito, non
  //   dopo aver premuto «Programma» — altrimenti per tutta la finestra si
  //   leggono due accompagnatori per una posa sola.
  const scrittoAMano = lead && !accompagnatoreId ? accompagnatoreScrittoAMano(lead) : "";
  const chiVa = [
    nomeConsulente,
    nomeAccompagnatoreScelto ? `con ${nomeAccompagnatoreScelto}` : null,
    scrittoAMano ? `${scrittoAMano} (nome scritto a mano)` : null,
    nomeDriverScelto ? `driver ${nomeDriverScelto}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  //  Nel titolo si legge «passo 4 di 5», e il totale è quello vero di QUESTA
  //  procedura: cinque passi, sei quando c'è l'indirizzo. Lo dà `passi.length` e
  //  mai una costante — da oggi che i passi non sono più sempre gli stessi, un
  //  numero fisso mentirebbe su metà delle pratiche.
  return (
    <Finestra
      aperta={open}
      onCambio={onOpenChange}
      titolo={giaFatta ? "Installazione già fatta" : "Programma installazione"}
      contesto={
        giaFatta
          ? `${cliente} · si registra una posa già eseguita, l'agenda non viene toccata`
          : `${cliente} · passo ${passoAttivo + 1} di ${passi.length}: ${attivo.titolo}`
      }
      icona={Wrench}
      larghezza="md"
      classeCorpo="space-y-3"
      azioni={
        giaFatta ? (
          <>
            <Button
              variant="outline"
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              onClick={() => setGiaFatta(false)}
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Torna a programmare
            </Button>
            <Button
              onClick={() => void registraGiaFatta()}
              disabled={!puoRegistrare}
              title={
                giornoFatta
                  ? giornoFuturo
                    ? "Il giorno non può essere nel futuro: qui si registra una posa già fatta"
                    : "Segna la posa come fatta in quel giorno e registra il contante"
                  : "Serve il giorno in cui è stata eseguita"
              }
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              {registrando ? "Registro…" : "Registra"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              onClick={() => (passoAttivo === 0 ? onOpenChange(false) : setPasso(passoAttivo - 1))}
            >
              {passoAttivo === 0 ? (
                "Annulla"
              ) : (
                <>
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Indietro
                </>
              )}
            </Button>
            {ultimo ? (
              //  Stessa domanda della scala dei passi: non «c'è un id scritto»
              //  ma «c'è una persona che può eseguirla».
              <Button
                onClick={handleSave}
                disabled={!esecutoreScelto || !pickedDate || !pickedTime}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Programma
              </Button>
            ) : (
              <Button
                onClick={() => setPasso(passoAttivo + 1)}
                disabled={passoAttivo >= massimo}
                title={
                  passoAttivo >= massimo
                    ? "Scegli prima quello che chiede questo passo"
                    : "Vai al passo successivo"
                }
              >
                Avanti <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )
      }
    >
      {giaFatta ? (
        <PosaGiaFatta
          giorno={giornoFatta}
          onGiorno={setGiornoFatta}
          futuro={giornoFuturo}
          contanti={contanti}
          onContanti={scriviSaldato}
          sconto={scontoFatta}
          onSconto={scriviSconto}
          prezzoTesto={prezzoFatta}
          onPrezzo={scriviPrezzo}
          versatoTesto={versatoFatta}
          onVersato={scriviVersato}
          quotaContanti={quotaContanti}
          onQuotaContanti={scriviQuotaContanti}
          quotaTracciato={quotaTracciato}
          onQuotaTracciato={scriviQuotaTracciato}
          onQuote={scriviQuote}
          canale={canaleFatta}
          costi={costiPosa}
          onCambiaCosto={cambiaCosto}
          onTogliCosto={togliCosto}
          onAggiungiCosto={aggiungiCosto}
          totaleCosti={costiDellaPratica}
          margine={margineStimato}
          modo={modoFatta}
          onModo={setModoFatta}
          conto={contoFatta}
          versato={versatoDato}
          prezzo={prezzoDato}
          daSaldare={Math.max(0, prezzoDato - versatoDato)}
          contantiDichiarati={Number(lead?.data.payment?.incassoContanti ?? 0) || 0}
        />
      ) : (
        <>
          {/* ── ⚠️ «L'HO GIÀ INSTALLATA», PRIMA DI QUALUNQUE PASSO ────────────
          Sta in cima e non in fondo perché è una domanda che si fa PRIMA di
          cominciare: chi apre questa finestra per registrare una posa vecchia
          non deve scoprire dopo tre schermate che c'era una strada più corta —
          e soprattutto non deve percorrere quelle tre schermate scegliendo un
          esecutore e un orario per un intervento già finito.
          Compare solo al primo passo, e solo su una posa non ancora
          completata: su una già segnata non c'è niente da registrare, e più
          avanti nella scala sarebbe un'uscita di sicurezza in mezzo al
          corridoio. */}
          {passoAttivo === 0 && lead && !posaCompletata(lead) && (
            <button
              type="button"
              onClick={() => setGiaFatta(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <CalendarCheck className="h-4 w-4 text-slate-600" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-900">
                  L&apos;hai già installata?
                </span>
                <span className="block text-[11.5px] leading-snug text-slate-500">
                  Registrala con il giorno in cui è stata fatta e quanto ha saldato in contanti
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            </button>
          )}

          <ScalaPassi passi={passi} passo={passoAttivo} massimo={massimo} onVai={setPasso} />

          <SezioneFinestra
            titolo={attivo.titolo}
            nota={attivo.nota}
            //  L'icona viene dal passo, non da un elenco parallelo indicizzato per
            //  posizione: con l'indirizzo che a volte c'è e a volte no, quell'elenco
            //  avrebbe messo l'icona del riepilogo sulla schermata dell'indirizzo.
            icona={attivo.icona}
            classeCorpo="p-4 space-y-3"
          >
            {/* 1 · CHI LA ESEGUE — prima di tutto: l'agenda è la sua */}
            {attivo.id === "esecutore" &&
              //  ── NESSUNO PUÒ ESEGUIRLA: SI DICE COSA MANCA, NON SI MOSTRA IL
              //     VUOTO ────────────────────────────────────────────────────────
              //   Qui prima c'era un ripiego: senza installatori l'elenco tornava a
              //   essere tutti gli attivi, con un avviso sopra. Il committente l'ha
              //   fatto togliere — in questo elenco i consulenti non ci vanno — e
              //   togliendolo il passo può restare senza nessuno da proporre. Un
              //   elenco vuoto però è un vicolo cieco, quindi al suo posto si mette
              //   la strada per uscirne: cosa manca, dove si accende, e il pulsante
              //   che ci porta (SenzaInstallatori, accanto alla regola).
              //   ⚠️ Sparisce anche la scelta di CHI ACCOMPAGNA: accompagna chi
              //   esegue, e finché non c'è nessuno che esegue quella domanda non ha
              //   risposta — lasciarla lì farebbe compilare l'unico campo del passo
              //   che non serve a superarlo.
              (mancaEsecutore ? (
                <SenzaInstallatori
                  manca={mancaEsecutore}
                  primaDiAndare={() => onOpenChange(false)}
                />
              ) : (
                <>
                  <div className="grid gap-1.5">
                    {esecutori.map((c) => {
                      //  Il mestiere si dice sulla riga: il segno conferma perché
                      //  quella persona è in elenco, e distingue gli installatori da
                      //  chi ci resta soltanto perché è già scritto su questa posa —
                      //  l'unico caso in cui qui compare qualcuno senza la spunta.
                      const suoi = mestieriDi(c.data);
                      return (
                        <VoceScelta
                          key={c.id}
                          selezionata={consulenteId === c.id}
                          coda={
                            suoi.faInstallatore ? (
                              <Chip
                                tono="in_corso"
                                icona={Wrench}
                                title="Segnato come installatore"
                              >
                                Installatore
                              </Chip>
                            ) : undefined
                          }
                          onClick={() => {
                            //  Cambiare persona cambia l'agenda: giorno e ora scelti
                            //  su quella di prima non valgono più niente.
                            setConsulenteId(c.id);
                            //  Se a posare va proprio chi era stato messo come driver,
                            //  il driver si azzera: nessuno accompagna se stesso. La
                            //  domanda «da solo o accompagnato?» resta com'era, e la
                            //  scala dei passi si ferma lì finché non si sceglie
                            //  qualcun altro — invece di salvare in silenzio una posa
                            //  con due volte la stessa persona.
                            if (c.id === driverId) setDriverId("");
                            //  Stessa cosa per chi lo affianca: nessuno affianca se
                            //  stesso, e lasciarlo scritto avrebbe bloccato due
                            //  volte la stessa agenda dicendo che ci vanno in due.
                            if (c.id === accompagnatoreId) setAccompagnatoreId("");
                            setPickedDate("");
                            setPickedTime("");
                          }}
                          titolo={c.data.nome}
                          //  Il mestiere prima del calendario: qui si sta scegliendo
                          //  CHI va a posare, e «va a posare» conta più di «ha Google
                          //  collegato». Le due note non si affiancano perché la riga
                          //  taglia il testo in un `truncate`: due frasi diventano una
                          //  frase illeggibile.
                          //  ⚠️ Chi non è (più) installatore è in elenco per un solo
                          //  motivo — è già scritto su questa posa — e va detto: il
                          //  nome da solo, in un elenco di installatori, farebbe
                          //  credere che la spunta ce l'abbia.
                          nota={
                            !suoi.faInstallatore
                              ? "Non è fra gli installatori: resta perché è già scritto su questa posa"
                              : etichettaMestieri(suoi) !== "Nessun mestiere segnato"
                                ? etichettaMestieri(suoi)
                                : c.data.calendarioCollegato
                                  ? "Calendario Google collegato"
                                  : undefined
                          }
                        />
                      );
                    })}
                  </div>
                  {/*  ── CHI VA INSIEME A POSARE ────────────────────────────────
                QUI C'ERA UN CAMPO DI TESTO, ed era un nome che non bloccava
                nessuna agenda: si scriveva «Luca», il CRM continuava a proporre
                Luca libero, e lo si scopriva il giorno stesso. Adesso è una
                SCELTA fra persone vere, ed è l'unico modo perché la posa tolga a
                chi affianca il tempo che gli sta togliendo davvero.
                ⚠️ Non è il driver: quello si sceglie al passo «come ci va», ha
                un compenso suo e sta in strada tre ore prima e tre dopo. Qui si
                mette chi va a FARE il lavoro insieme all'installatore. */}
                  <CampoFinestra
                    etichetta="Chi lo accompagna a fare il lavoro"
                    nota="Facoltativo. Solo chi ha la spunta «Fa l'accompagnatore»: quel giorno la posa gli blocca l'agenda come a chi la esegue — due ore di strada prima e due dopo. Il driver, che invece ci porta qualcuno, si sceglie più avanti."
                  >
                    {/*  Il nome scritto a mano prima che questa scelta esistesse. Non
                  si butta: si mostra finché su questa posa nessuno sceglie una
                  persona vera, dichiarato per quello che è — un testo, non un
                  impegno in agenda. Sparisce da sé appena si sceglie qualcuno,
                  perché due accompagnatori a schermo per una posa sola sono la
                  domanda «e allora chi ci va?». */}
                    {scrittoAMano && (
                      <NotaFinestra tono="attenzione" icona={UserRound}>
                        Su questa posa era scritto a mano <strong>{scrittoAMano}</strong>, da quando
                        qui c&apos;era un campo di testo. È rimasto un nome e{" "}
                        <strong>non blocca nessuna agenda</strong>. Quel campo diceva solo «chi va a
                        posare»: se era la persona che <strong>esegue</strong> la posa, sceglila qui
                        sopra; se ci andava <strong>insieme</strong> a chi esegue, sceglila qui
                        sotto. Da quel momento la posa le toglie davvero il tempo che serve.
                      </NotaFinestra>
                    )}
                    {elencoAccompagnatori.length === 0 ? (
                      //  Il vuoto dice DOVE si accende, come per i driver: la sezione
                      //  «Che mestiere fa» della scheda del consulente. NON accanto al
                      //  livello di permesso — mandarci qualcuno gli farebbe cambiare
                      //  i permessi mentre cerca una mansione.
                      <VuotoFinestra testo="Nessun accompagnatore in elenco: «Fa l'accompagnatore» si accende nella scheda del consulente, nella sezione «Che mestiere fa», insieme a setter e driver. Finché non c'è, la posa si programma lo stesso: ci va da solo." />
                    ) : (
                      <div className="grid gap-1.5">
                        {/*  «Ci va da solo» è una VOCE e non l'assenza di una scelta,
                      come al passo del driver: serve anche a tornare indietro,
                      cioè a togliere una persona già scritta senza doverne
                      scegliere un'altra. */}
                        <VoceScelta
                          selezionata={!accompagnatoreId}
                          icona={UserRound}
                          titolo="Ci va da solo"
                          nota="Si blocca solo l'agenda di chi esegue"
                          onClick={() => setAccompagnatoreId("")}
                        />
                        {elencoAccompagnatori.map((c) => {
                          const impegnato = accompagnatoriImpegnati.has(c.id);
                          //  Chi non ha (più) la mansione ma è già scritto su questa
                          //  posa va detto: il nome da solo non spiegherebbe perché è
                          //  in un elenco di accompagnatori.
                          const senzaMestiere = !mestieriDi(c.data).faAccompagnatore;
                          return (
                            <VoceScelta
                              key={c.id}
                              selezionata={accompagnatoreId === c.id}
                              //  ⚠️ Occupato = non scegliibile, stessa regola del
                              //  driver: fra perdere uno slot e mandare la stessa
                              //  persona in due posti, si perde lo slot.
                              disabilitata={impegnato && accompagnatoreId !== c.id}
                              onClick={() => setAccompagnatoreId(c.id)}
                              icona={UserPlus}
                              titolo={c.data.nome}
                              nota={
                                impegnato
                                  ? //  ⚠️ NON «occupato» e basta: liberoNellaFascia dice
                                    //  no anche a chi quel giorno non lavora, è in pausa
                                    //  o in ferie, e si andrebbe a cercare un impegno
                                    //  che non esiste.
                                    "Non disponibile in quella fascia: un impegno più le due ore di strada, oppure quel giorno non lavora (orari, pause, ferie)"
                                  : senzaMestiere
                                    ? "Non è più fra gli accompagnatori: resta perché è già scritto su questa posa"
                                    : !c.data.attivo
                                      ? "Consulente disattivato"
                                      : pickedTime
                                        ? "Libero in quella fascia"
                                        : "La disponibilità si controlla quando avrai scelto giorno e ora"
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                  </CampoFinestra>
                </>
              ))}

            {/* 2 · CHE GIORNO — la durata sta qui perché decide dove c'è posto */}
            {attivo.id === "giorno" && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Quanto dura
                  </span>
                  {DURATIONS.map((d) => (
                    <Pillola
                      key={d}
                      attiva={duration === d}
                      onClick={() => {
                        setDuration(d);
                        //  Un intervento più lungo può non entrare più nell'orario
                        //  scelto: si rifà la scelta invece di salvare un buco.
                        setPickedTime("");
                      }}
                      className="px-2 py-1"
                    >
                      {d} min
                    </Pillola>
                  ))}
                </div>
                {dataFuoriAgenda && (
                  <VoceScelta
                    selezionata
                    titolo={`${formatDate(pickedDate)} · data già fissata`}
                    nota="Non è fra i giorni liberi dell'agenda: resta valida finché non ne scegli un'altra."
                  />
                )}
                {availability.length === 0 ? (
                  <VuotoFinestra
                    testo={`Nessun giorno libero nei prossimi 30 giorni per un intervento di ${duration} minuti.`}
                  />
                ) : (
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
                    {availability.map((d) => (
                      <VoceScelta
                        key={d.date}
                        selezionata={pickedDate === d.date}
                        titolo={d.label}
                        coda={`${d.slots.length} ${d.slots.length === 1 ? "orario" : "orari"}`}
                        onClick={() => {
                          setPickedDate(d.date);
                          setPickedTime("");
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* 3 · CHE ORA — solo del giorno scelto, mai un elenco generico */}
            {attivo.id === "ora" && (
              <>
                <p className="text-[12px] text-slate-600">
                  {giornoScelto?.label || formatDate(pickedDate)} · agenda di {nomeConsulente} ·{" "}
                  {duration} minuti
                </p>
                {orari.length === 0 ? (
                  <VuotoFinestra testo="In questo giorno non è rimasto nessun orario libero per questa durata: torna indietro e scegli un altro giorno." />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {orari.map((s) => (
                      <Pillola
                        key={s}
                        attiva={pickedTime === s}
                        onClick={() => setPickedTime(s)}
                        className="px-2.5 py-1.5 font-mono"
                      >
                        {s}
                      </Pillola>
                    ))}
                  </div>
                )}
                {/*  ⚠️ L'ORARIO SI SCEGLIE SULL'AGENDA DI CHI ESEGUE, ma la posa ne
                blocca due: chi la esegue e chi lo affianca. L'accompagnatore è
                stato scelto al primo passo, quando quest'ora non esisteva
                ancora, quindi è QUI che si scopre se in quella fascia è già in
                strada — e qui che ci si ferma, perché è qui che si ripara. */}
                {pickedTime && accompagnatoreOccupato ? (
                  <NotaFinestra tono="attenzione" icona={UserPlus}>
                    <strong>{nomeAccompagnatoreScelto || "L'accompagnatore scelto"}</strong> non è
                    libero in questa fascia: ha già un impegno (più le due ore di strada), oppure
                    quel giorno non lavora. Scegli un altro orario, oppure torna al primo passo e
                    cambia chi lo accompagna — anche «ci va da solo» è una risposta.
                  </NotaFinestra>
                ) : (
                  pickedTime && (
                    <NotaFinestra tono="conferma" icona={Check}>
                      {formatDate(pickedDate)} alle {pickedTime} · {duration} minuti. Lo slot viene
                      bloccato sull&apos;agenda del consulente
                      {nomeAccompagnatoreScelto
                        ? ` e su quella di ${nomeAccompagnatoreScelto}`
                        : ""}
                      .
                    </NotaFinestra>
                  )
                )}
              </>
            )}

            {/* 4 · COME CI VA — da solo, o accompagnato da un driver */}
            {attivo.id === "viaggio" && (
              <>
                {/*  Due voci e non un interruttore: «da solo» è una risposta, non
                l'assenza di una risposta, e va scelta — un interruttore spento
                si legge come «non ci ha ancora pensato nessuno». */}
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <VoceScelta
                    selezionata={!accompagnato}
                    icona={UserRound}
                    titolo="Ci va da solo"
                    nota="Si blocca solo l'agenda di chi posa"
                    onClick={() => {
                      setAccompagnato(false);
                      //  Il nome resta scritto: cambiando idea due volte si
                      //  ritroverebbe da riscegliere. A salvare va comunque "",
                      //  perché è `accompagnato` a decidere.
                    }}
                  />
                  <VoceScelta
                    selezionata={accompagnato}
                    icona={Car}
                    titolo="Lo accompagna un driver"
                    nota="Si bloccano due agende"
                    onClick={() => setAccompagnato(true)}
                  />
                </div>

                {accompagnato && (
                  <>
                    {/*  Il vuoto dice DOVE si accende, e il posto è uno solo: la
                    sezione «Che mestiere fa» della scheda del consulente,
                    insieme a setter e consulente. NON accanto al livello di
                    permesso — mandarci qualcuno gli farebbe cambiare i permessi
                    mentre cerca una mansione. */}
                    {elencoDriver.length === 0 ? (
                      <VuotoFinestra testo="Nessun driver in elenco: «Fa il driver» si accende nella scheda del consulente, nella sezione «Che mestiere fa», insieme a setter e consulente." />
                    ) : (
                      <div className="grid gap-1.5">
                        {elencoDriver.map((c) => {
                          const impegnato = driverImpegnati.has(c.id);
                          //  Chi non ha (più) la mansione ma è già scritto su questa
                          //  posa va detto: il nome da solo non spiegherebbe perché
                          //  è in fondo a un elenco di driver.
                          const senzaMestiere = !mestieriDi(c.data).faDriver;
                          return (
                            <VoceScelta
                              key={c.id}
                              selezionata={driverId === c.id}
                              //  ⚠️ Occupato = non scegliibile. È la regola scritta in
                              //  booking-utils: fra perdere uno slot e mandare la
                              //  stessa persona in due posti si perde lo slot.
                              disabilitata={impegnato && driverId !== c.id}
                              onClick={() => setDriverId(c.id)}
                              icona={Car}
                              titolo={c.data.nome}
                              nota={
                                impegnato
                                  ? //  ⚠️ NON dire «occupato» e basta: liberoNellaFascia
                                    //  risponde no anche a chi quel giorno non lavora, è
                                    //  in pausa o in ferie. Scritto «occupato» si andava a
                                    //  cercare l'impegno che gli si accavalla, e non c'era
                                    //  niente da trovare.
                                    "Non disponibile in quella fascia: un impegno più le tre ore di strada, oppure quel giorno non lavora (orari, pause, ferie)"
                                  : senzaMestiere
                                    ? "Non è più fra i driver: resta perché è già scritto su questa posa"
                                    : !c.data.attivo
                                      ? "Consulente disattivato"
                                      : "Libero in quella fascia"
                              }
                            />
                          );
                        })}
                      </div>
                    )}

                    <CampoFinestra
                      etichetta="Quanto va pagato in più per il driver"
                      nota="È un COSTO della posa, come il viaggio: non si somma al saldo del cliente e non compare fra gli importi da incassare."
                    >
                      <Input
                        value={compenso}
                        onChange={(e) => setCompenso(e.target.value)}
                        inputMode="decimal"
                        placeholder="Es. 50"
                        className={CLASSE_CAMPO}
                      />
                    </CampoFinestra>

                    {driverId && (
                      <NotaFinestra tono="conferma" icona={Car}>
                        Quel giorno il driver risulta occupato dalle{" "}
                        {oraMeno(pickedTime, STRADA_DRIVER)} alle{" "}
                        {oraPiu(pickedTime, duration + STRADA_DRIVER)}: tre ore di strada prima e
                        tre dopo. In quelle ore non gli si possono fissare né pose né consulenze.
                      </NotaFinestra>
                    )}
                  </>
                )}
              </>
            )}

            {/*  L'INDIRIZZO — c'è solo quando si va a casa del cliente, quindi non
            porta un numero fisso: i passi sono cinque, sei a domicilio. */}
            {attivo.id === "indirizzo" && (
              <>
                {/*  QUI C'ERA ANCHE «IL MATERIALE», ED È SPARITO IN DUE TEMPI.
                Prima la borsa dei materiali: quattro voci fisse che nessuno
                spuntava mai (vedi la nota su ChecklistMateriali). Poi il TIPO DI
                POSA, che era una fila di pastiglie — «Da impostare / Taxi /
                Indipendente» — e che il committente ha chiesto di togliere: era
                la stessa domanda a cui rispondono già lo stato della pratica e
                il modo di consegna, e farla due volte vuol dire poter dire due
                cose diverse sulla stessa pratica. Adesso quel valore si ricava
                (`tipoPosa`) e si continua a scriverlo, senza chiederlo.
                ⚠️ Restava attaccato a quelle pastiglie l'unico modo di scrivere
                l'INDIRIZZO da dentro la procedura. Ecco perché questo passo non
                è morto con loro: a domicilio l'indirizzo non è «il materiale», è
                la condizione per consegnare — senza, la posa resta segnata
                «manca l'indirizzo» e non si può chiudere.
                ── SI VA A CASA: L'INDIRIZZO ────────────────────────────────
                Nome, cognome e telefono NON si riscrivono. Sono già nella
                scheda, e un secondo posto in cui scriverli è un secondo posto
                in cui possono essere sbagliati: si mostrano e basta, così chi
                prepara la posa vede subito se sono quelli giusti (e se non lo
                sono, si correggono dove vivono — nella scheda del cliente).
                Si scrive solo ciò che nella scheda non c'è: dove si va.
                ⚠️ Il `casa &&` che avvolgeva questi campi non c'è più: questo
                passo ESISTE solo quando si va a casa del cliente — lo decide
                passiDella() — e un secondo controllo sulla stessa condizione è
                il punto in cui prima o poi le due risposte si dividono. */}
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <DatoFinestra etichetta="Cliente">{cliente}</DatoFinestra>
                  <DatoFinestra etichetta="Telefono">
                    {lead?.data.telefono || "non in scheda"}
                  </DatoFinestra>
                  <DatoFinestra etichetta="Città in scheda">
                    {lead?.data.citta || "non indicata"}
                  </DatoFinestra>
                </div>

                <CampoFinestra
                  etichetta="Via e civico"
                  nota="È la parte che rende un indirizzo un indirizzo: senza, la posa resta segnata «manca l'indirizzo»."
                >
                  <Input
                    value={via}
                    onChange={(e) => setVia(e.target.value)}
                    placeholder="Via Roma 12, interno 3"
                    className={CLASSE_CAMPO}
                  />
                </CampoFinestra>
                <div className="grid gap-2.5 sm:grid-cols-[8rem_1fr]">
                  <CampoFinestra etichetta="CAP">
                    <Input
                      value={cap}
                      onChange={(e) => setCap(e.target.value)}
                      inputMode="numeric"
                      placeholder="20100"
                      className={CLASSE_CAMPO}
                    />
                  </CampoFinestra>
                  <CampoFinestra etichetta="Città">
                    <Input
                      value={citta}
                      onChange={(e) => setCitta(e.target.value)}
                      placeholder="Milano"
                      className={CLASSE_CAMPO}
                    />
                  </CampoFinestra>
                </div>

                {via.trim() ? (
                  <NotaFinestra tono="conferma" icona={House}>
                    Si salva così: <strong>{indirizzoComposto}</strong>. È la stessa riga che si
                    legge nella scheda «A domicilio» e nell&apos;elenco delle pose.
                  </NotaFinestra>
                ) : (
                  <NotaFinestra tono="attenzione" icona={House}>
                    Senza via non si salva nessun indirizzo — la sola città non basta a farci
                    arrivare qualcuno — e la posa resterà segnata «manca l&apos;indirizzo». Si può
                    programmare lo stesso e scriverlo dopo, ma finché manca non si chiude.
                  </NotaFinestra>
                )}
              </>
            )}

            {/*  RIEPILOGO — l'ultimo passo, quinto o sesto a seconda che si vada a
            casa. Non chiede niente… tranne le note per chi va a posare. */}
            {attivo.id === "riepilogo" && (
              <>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <DatoFinestra etichetta="Cliente">{cliente}</DatoFinestra>
                  {/*  Il ripiego quando il prodotto non è in scheda resta il tipo di
                  posa, con le stesse parole di ogni altra schermata
                  (ETICHETTA_TIPO). Adesso però è il tipo RICAVATO, non quello
                  scelto a mano una schermata prima: dice «A domicilio» o «In
                  sede» d'accordo con la scheda «A domicilio», non con una
                  pastiglia che qualcuno poteva aver lasciato su «Da impostare». */}
                  <DatoFinestra etichetta="Cosa si posa">
                    {prodotto || ETICHETTA_TIPO[tipoPosa]}
                  </DatoFinestra>
                  <DatoFinestra etichetta="Quando">
                    {formatDate(pickedDate)} alle {pickedTime}
                  </DatoFinestra>
                  <DatoFinestra etichetta="Quanto dura">{duration} minuti</DatoFinestra>
                  <DatoFinestra etichetta="Chi va">{chiVa}</DatoFinestra>
                  {/*  Il compenso del driver si dice QUI accanto a chi va, e non fra
                  i tre numeri del denaro qui sotto: quelli sono l'incasso, e un
                  costo messo in mezzo a loro si legge come qualcosa da ritirare.
                  ⚠️ Vale la stessa avvertenza del costo del viaggio: è dichiarato
                  e non ancora sottratto dal margine (kpi-netto.ts). */}
                  {accompagnato && leggiEuro(compenso) > 0 && (
                    <DatoFinestra etichetta="Costo del driver">
                      {eur(leggiEuro(compenso))} · da pagare in più, non da incassare
                    </DatoFinestra>
                  )}
                  {casa && (
                    <DatoFinestra etichetta="Dove si va">
                      {indirizzoDaSalvare || "indirizzo non ancora scritto"}
                    </DatoFinestra>
                  )}
                </div>

                {/*  L'unica cosa che a domicilio ferma tutto: senza indirizzo il
                tecnico non parte, e la posa non si chiude nemmeno dall'elenco.
                Si dice qui, dove si preme «Programma», non solo nel passo prima:
                chi torna indietro a correggere qualcos'altro lo riattraversa. */}
                {casa && !indirizzoDaSalvare && (
                  <NotaFinestra tono="attenzione" icona={House}>
                    Manca l&apos;indirizzo: si programma lo stesso, ma finché non c&apos;è nessuno
                    può chiudere questa posa. Si scrive al passo precedente o nella scheda «A
                    domicilio».
                  </NotaFinestra>
                )}

                {/*  Gli stessi tre numeri di tutte le altre schermate, nello stesso
                ordine: GIÀ VERSATO · TOTALE · RESTA. L'ultimo è quello che il
                tecnico deve riportare indietro, e si legge qui — non si va a
                cercare altrove.
                ⚠️ Se il prezzo non c'è ancora non si stampano tre zeri: si dice
                che manca e si offre il campo per scriverlo, subito sotto. */}
                {lead && !importoDefinito(lead) ? (
                  <ImpostaImportoInline lead={lead} />
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <KpiFinestra etichetta="Già versato" valore={eur(versatoLead)} />
                    <KpiFinestra etichetta="Totale" valore={eur(versatoLead + saldo)} />
                    <KpiFinestra
                      etichetta="Resta"
                      valore={saldo > 0 ? eur(saldo) : "Niente da ritirare"}
                      nota={
                        saldo > 0
                          ? "Si incassa premendo l'importo, qui o nell'elenco"
                          : "Il cliente ha già versato tutto"
                      }
                      forte
                      //  È il numero che il tecnico si porta dietro: fra tre
                      //  riquadri bianchi identici non spiccherebbe. Ambra = c'è
                      //  ancora un passaggio da fare, emerald = fatto.
                      className={
                        saldo > 0
                          ? "border-amber-300 bg-amber-50"
                          : "border-emerald-300 bg-emerald-50"
                      }
                    />
                  </div>
                )}

                {/*  ── LE NOTE PER CHI VA A POSARE, ADESSO SI SCRIVONO QUI ───────
                Stavano nel passo «Il materiale», che non c'è più. Sono venute
                nel RIEPILOGO e non altrove per una ragione sola: è l'ultimo
                momento in cui si guarda tutto insieme — il giorno, l'ora, chi
                va, dove si va, quanto si ritira — ed è guardando quelle righe
                che viene in mente cosa scrivere («citofono a nome della figlia»,
                «cane in giardino», «al secondo piano senza ascensore»). Prima si
                chiedevano una schermata più in su, prima ancora di sapere chi
                sarebbe andato, e in fondo a questa stessa schermata ne compariva
                la copia in sola lettura: adesso quella copia È il campo, e una
                nota riletta qui si può anche correggere.
                ⚠️ Non è un passo in più: il riepilogo continua a non chiedere
                niente per poter premere «Programma» — le note sono facoltative e
                lo sono sempre state. */}
                <CampoFinestra
                  etichetta="Note per chi va a posare"
                  nota="Facoltative. È l'ultima cosa che il tecnico legge prima di uscire: si salvano insieme alla posa."
                >
                  <Textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Piano, citofono, animali in casa, dettagli del colore…"
                    className={CLASSE_AREA}
                  />
                </CampoFinestra>
              </>
            )}
          </SezioneFinestra>
        </>
      )}
    </Finestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   9-bis. LA POSA CHE È GIÀ STATA FATTA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── REGISTRARE ALL'INDIETRO ───────────────────────────────────────────────
 *  Tre domande e tre numeri. Le domande sono quelle a cui chi registra sa
 *  rispondere davvero: quando è stata fatta, quanto ha lasciato in contanti,
 *  e come stava l'IVA dentro quella cifra. Nessun esecutore, nessun orario,
 *  nessun viaggio: sono cose che servono a PRENOTARE, e qui non si prenota.
 *
 *  I tre numeri sotto non sono un riepilogo di cortesia: sono la risposta alla
 *  domanda che ci si fa mentre si sceglie l'IVA — «quindi quanto è netto, e
 *  quanto viene col ventidue?». Si aggiornano mentre si scrive.
 *
 *  ⚠️ Il componente non tocca niente: riceve i valori e li rimanda su. Tutto
 *   quello che si scrive in archivio passa da `incassaSaldo` e
 *   `segnaCompletata`, cioè dalle stesse due funzioni di ogni altra posa. */
function PosaGiaFatta({
  giorno,
  onGiorno,
  futuro,
  contanti,
  onContanti,
  sconto,
  onSconto,
  prezzoTesto,
  onPrezzo,
  versatoTesto,
  onVersato,
  quotaContanti,
  onQuotaContanti,
  quotaTracciato,
  onQuotaTracciato,
  onQuote,
  canale,
  costi,
  onCambiaCosto,
  onTogliCosto,
  onAggiungiCosto,
  totaleCosti,
  margine,
  modo,
  onModo,
  conto,
  versato,
  prezzo,
  daSaldare,
  contantiDichiarati,
}: {
  giorno: string;
  onGiorno: (v: string) => void;
  futuro: boolean;
  contanti: string;
  onContanti: (v: string) => void;
  /** lo sconto fatto adesso, come testo. "" = nessuno sconto */
  sconto: string;
  onSconto: (v: string) => void;
  /** il prezzo pattuito della pratica, correggibile da qui */
  prezzoTesto: string;
  onPrezzo: (v: string) => void;
  /** quanto era già in cassa prima di oggi, correggibile da qui */
  versatoTesto: string;
  onVersato: (v: string) => void;
  /** la parte in contante del saldo, come testo. "" = non è stato detto */
  quotaContanti: string;
  onQuotaContanti: (v: string) => void;
  /** il suo gemello: la parte tracciata. Si riempiono a vicenda */
  quotaTracciato: string;
  onQuotaTracciato: (v: string) => void;
  /** scrive tutte e due insieme: lo usano le pillole */
  onQuote: (contanteDichiarato: string) => void;
  /** i costi scritti a mano su questa pratica, come righe di testo */
  costi: { id: string; titolo: string; testo: string }[];
  onCambiaCosto: (id: string, dati: Partial<{ titolo: string; testo: string }>) => void;
  onTogliCosto: (id: string) => void;
  onAggiungiCosto: () => void;
  /** tutti i costi della pratica, non solo quelli scritti qui */
  totaleCosti: number;
  /** prezzo chiuso meno IVA meno costi: il margine di QUESTA pratica */
  margine: number;
  /** i due numeri già divisi, così a schermo non si rifà nessun conto */
  canale: { tracciato: number; contanti: number };
  modo: ModoIva;
  onModo: (v: ModoIva) => void;
  conto: ReturnType<typeof contoIva>;
  versato: number;
  /** il prezzo chiuso della pratica, come è stato registrato alla vendita */
  prezzo: number;
  /** quanto resta da incassare secondo la scheda */
  daSaldare: number;
  /** quanto era stato dichiarato in contanti registrando la vendita */
  contantiDichiarati: number;
}) {
  //  La cifra su cui si divide contante e tracciato è quella appena scritta
  //  sopra: si legge una volta sola, così il campo, le pillole e la frase di
  //  riepilogo parlano tutti dello stesso numero.
  const contanteDelSaldo = Math.max(0, leggiEuro(contanti));
  //  Lo sconto non può superare il prezzo: uno sconto più grande darebbe una
  //  pratica dal valore negativo, che non vuol dire niente per nessuno.
  const scontato = Math.min(Math.max(0, leggiEuro(sconto)), Math.max(0, prezzo));
  return (
    <SezioneFinestra
      titolo="Quando è stata fatta"
      nota="Si registra una posa già eseguita: nessuna agenda viene occupata"
      icona={CalendarClock}
      classeCorpo="p-4 space-y-3"
    >
      <CampoFinestra
        etichetta="Giorno dell'installazione"
        nota={
          futuro
            ? "Non può essere nel futuro: qui si registra una cosa già successa"
            : "Il giorno in cui è stata eseguita davvero, anche mesi fa"
        }
      >
        <Input
          type="date"
          value={giorno}
          max={giornoISO()}
          onChange={(e) => onGiorno(e.target.value)}
          className={futuro ? "border-rose-400" : undefined}
        />
      </CampoFinestra>

      {/* ── ⚠️ QUI L'IVA NON SI SCEGLIE PIÙ ───────────────────────────────
          Segnalazione del committente: «quanto deve saldare, fai che devo
          inserire il totale senza contare l'IVA, senza che devo calcolarla».
          Aveva ragione due volte. Primo: chi registra una posa scrive la cifra
          che il cliente gli ha messo in mano — quella è, e quella deve
          restare. Secondo: i tre riquadri qui sotto mostravano «NETTO € 352»
          sopra un saldo di 430, e quel numero si legge come «te ne ho tolti
          78», anche se il totale non era cambiato di un centesimo.
          Il trattamento IVA lo porta la pratica (arriva dalla vendita) e resta
          dentro i conti: margine, imponibile e tasse continuano a scorporarla.
          Qui si dice solo quanto ha lasciato, e una riga sotto racconta quanta
          IVA c'è dentro quella cifra — un'informazione, non una domanda. */}
      {/* ── ⚠️ «QUANTO HA SALDATO», NON «IN CONTANTI» ─────────────────────
            Quanto di una pratica è in contanti si dichiara una volta sola,
            registrando la vendita, e vale su tutto il prezzo (vedi
            crm/ChiusuraDialog). Chiederlo di nuovo qui — e per il solo saldo —
            voleva dire due dichiarazioni sulla stessa pratica che possono
            contraddirsi, e nessun modo di sapere quale delle due valga.
            Qui si registra QUANTO ha saldato adesso; com'è entrato lo dice la
            riga sotto, presa dalla vendita. */}
      {/* ── ⚠️ IL CONTO DELLA PRATICA SI CORREGGE DA QUI ──────────────────
            Richiesta del committente: «fai che da qui posso modificare anche
            la somma dell'acconto che ha pagato».
            Registrando una posa vecchia il conto scritto in cassa è spesso
            quello sbagliato — l'acconto preso in mano e mai segnato, il prezzo
            cambiato a voce — e finora qui si poteva solo LEGGERLO: si
            correggeva da un'altra schermata, cioè quasi mai. Chi ha in mano la
            pratica in questo momento è l'unico che sa com'è andata davvero.
            ⚠️ Il prezzo è il PATTUITO, prima dello sconto: lo sconto qui sotto
             si toglie da lui. E toccandoli, la cifra da saldare si rifà da
             sola — restare ferma sul vecchio conto vorrebbe dire due numeri
             sotto gli occhi che si contraddicono. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoFinestra
          etichetta="Prezzo della pratica (€)"
          nota="Quello concordato, prima dello sconto"
        >
          <Input
            value={prezzoTesto}
            onChange={(e) => onPrezzo(e.target.value)}
            inputMode="decimal"
            placeholder="€"
          />
        </CampoFinestra>
        <CampoFinestra
          etichetta="Già versato prima (€)"
          nota="L'acconto che aveva lasciato: correggilo se in cassa è scritto male"
        >
          <Input
            value={versatoTesto}
            onChange={(e) => onVersato(e.target.value)}
            inputMode="decimal"
            placeholder="€"
          />
        </CampoFinestra>
      </div>

      {/* ── ⚠️ LO SCONTO SI FA QUI, NON ALLA VENDITA ──────────────────────
            Richiesta del committente. È il momento in cui il prezzo vero si sa
            davvero: il cliente è davanti, la posa è fatta, e «le tolgo
            cinquanta» si dice adesso — non tre settimane prima, quando alla
            vendita si scrive solo quanto deve pagare.
            Si scrive la CIFRA CHE SI TOGLIE, non il prezzo finale: è il verso
            in cui la frase esce di bocca, e non chiede una sottrazione a mente
            mentre si parla. Il prezzo chiuso lo fa il programma, e la cifra da
            saldare qui sotto si rifà da sola.
            ⚠️ Abbassa il prezzo della pratica, quindi cambia margine, IVA
             scorporata e tasse: `prezzoTotale` conserva il prezzo di partenza,
             che è l'unico modo per sapere dopo quanto si è scontato. */}
      {prezzo > 0 && (
        <CampoFinestra
          etichetta="Sconto fatto adesso (€)"
          nota="Quanto gli hai tolto sul prezzo. Lascia vuoto se non hai scontato niente"
        >
          <Input
            value={sconto}
            onChange={(e) => onSconto(e.target.value)}
            inputMode="decimal"
            placeholder="nessuno sconto"
          />
          {scontato > 0 && (
            <p className="mt-1 text-[11.5px] text-emerald-700">
              Prezzo chiuso {eur(Math.max(0, prezzo - scontato))}
              {prezzo > 0 ? ` · ${Math.round((scontato / prezzo) * 100)}% di sconto` : ""} — resta
              da saldare {eur(Math.max(0, daSaldare - scontato))}.
            </p>
          )}
        </CampoFinestra>
      )}

      <CampoFinestra
        etichetta="Quanto ha saldato adesso"
        nota="Lascia vuoto se non ha lasciato niente: la posa si segna lo stesso"
      >
        <Input
          value={contanti}
          onChange={(e) => onContanti(e.target.value)}
          inputMode="decimal"
          placeholder="€"
        />
      </CampoFinestra>

      {/* ── ⚠️ COM'È ENTRATO: TRACCIATO E CONTANTI ────────────────────────
            Segnalazione del committente: «MANCA TUTTA LA PARTE DI QUANTO HA
            PAGATO TRACCIATO». Qui si incassa il saldo — è il momento in cui
            lo si sa davvero — e fino a ieri l'unico posto per dirlo era la
            finestra della vendita, cioè settimane prima, quando come sarebbe
            arrivato il resto era una previsione.
            Si scrive il CONTANTE e il tracciato è il resto: un campo solo,
            come nella finestra della vendita. Due campi per la stessa cifra
            si contraddicono al primo arrotondamento, e poi nessuno sa quale
            dei due vale.
            ⚠️ Lasciato vuoto NON scrive niente: quello che era stato
             dichiarato alla vendita resta com'è. Zero invece è una risposta —
             vuol dire tutto tracciato.
            ⚠️ E non si somma alla dichiarazione della vendita: quella parla
             del totale quando in cassa c'era solo l'acconto. Come si mettono
             insieme senza far venire più contanti del prezzo sta in
             crm/canale-incasso. */}
      {contanteDelSaldo > 0 && (
        <div className="border-t border-slate-200 pt-3">
          <p className="mb-2 text-[12px] font-medium text-slate-900">
            Come è entrato <span className="font-normal text-slate-500">· facoltativo</span>
          </p>
          {/* ── ⚠️ DUE CASELLE, E SI RIEMPIONO A VICENDA ──────────────────
                Richiesta del committente: voleva scrivere il TRACCIATO, non
                dedurlo dal contante. Due caselle libere che devono fare una
                somma esatta si contraddicono al primo ripensamento — si
                corregge una e l'altra resta indietro — quindi quello che si
                batte in una diventa il resto nell'altra. Sommano sempre al
                saldo, per costruzione, e in archivio ne finisce una sola. */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                di cui tracciato (€)
              </span>
              <Input
                inputMode="decimal"
                value={quotaTracciato}
                onChange={(e) => onQuotaTracciato(e.target.value)}
                placeholder="facoltativo"
                className={cn(CLASSE_CAMPO, "h-9 w-[7.5rem] text-[14px] tabular-nums")}
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                di cui in contanti (€)
              </span>
              <Input
                inputMode="decimal"
                value={quotaContanti}
                onChange={(e) => onQuotaContanti(e.target.value)}
                placeholder="facoltativo"
                className={cn(CLASSE_CAMPO, "h-9 w-[7.5rem] text-[14px] tabular-nums")}
              />
            </label>
            <div className="flex flex-wrap gap-1.5 pb-1">
              <Pillola
                attiva={quotaContanti.trim() !== "" && canale.contanti === 0}
                onClick={() => onQuote("0")}
                titolo="Bonifico, carta o POS: tutto tracciato"
              >
                tutto tracciato
              </Pillola>
              <Pillola
                attiva={canale.contanti === contanteDelSaldo && quotaContanti.trim() !== ""}
                onClick={() => onQuote(scriviEuro(contanteDelSaldo))}
                titolo="Tutto in mano, niente dalla banca"
              >
                tutto contanti
              </Pillola>
              {quotaContanti.trim() !== "" && (
                <Pillola onClick={() => onQuote("")} titolo="Torna a non dichiararlo">
                  non lo dico
                </Pillola>
              )}
            </div>
          </div>
          {/*  La frase con tutte e due le cifre: è quella che si rilegge per
              controllare, e due numeri in riga si confrontano meglio di due
              campi da compilare. */}
          <p className="mt-1.5 text-[11.5px] text-slate-600">
            {quotaContanti.trim() === "" ? (
              <>
                Non dichiarato: resta quello che era stato detto registrando la vendita. Scrivilo
                se questo saldo è entrato diversamente.
              </>
            ) : (
              <>
                Di {eur(contanteDelSaldo)} saldati adesso:{" "}
                <span className="font-medium">{eur(canale.tracciato)}</span> tracciati (bonifico,
                carta o POS) e <span className="font-medium">{eur(canale.contanti)}</span> in
                contanti.
              </>
            )}
          </p>
        </div>
      )}

      {/* ── ⚠️ I COSTI AVUTI SU QUESTA POSA ───────────────────────────────
          Richiesta del committente: «fai che posso aggiungere anche costi
          extra se voglio e li sottrae dal profitto». Il posto giusto è questo:
          il corriere, il rimborso benzina, il ritocco dal parrucchiere si
          sanno quando la posa è finita, non tre settimane prima — e scriverli
          altrove voleva dire ricordarsene dopo, cioè quasi mai.
          ⚠️ NON È UN SECONDO ELENCO. Sono le stesse voci della finestra dei
           costi (`payment.costi.altri`): due posti in cui si scrivono dei
           costi vorrebbero dire due margini diversi per la stessa pratica.
           Si apre con quelle che ci sono già e le sostituisce.
          ⚠️ E il margine qui sotto è quello della PRATICA, contato come lo
           conta la pagina KPI — prezzo chiuso, meno l'IVA che ci sta dentro,
           meno tutti i costi. Non toglie la pubblicità, che è una spesa del
           mese e non di un cliente: per questo l'etichetta lo dice, invece di
           far credere che sia l'utile finale. */}
      <div className="border-t border-slate-200 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-slate-900">
            Costi di questa pratica <span className="font-normal text-slate-500">· facoltativo</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11.5px]"
            onClick={onAggiungiCosto}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Aggiungi un costo
          </Button>
        </div>
        {costi.length === 0 ? (
          <p className="text-[11.5px] text-slate-600">
            Corriere, rimborso benzina, un ritocco: quello che hai speso per questo cliente. Si
            sottrae dal profitto.
          </p>
        ) : (
          <div className="space-y-2">
            {costi.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Input
                  value={r.titolo}
                  onChange={(e) => onCambiaCosto(r.id, { titolo: e.target.value })}
                  placeholder="Corriere, rimborso, ritocco…"
                  className={cn(CLASSE_CAMPO, "h-9 min-w-0 flex-1 text-[14px]")}
                />
                <Input
                  value={r.testo}
                  onChange={(e) => onCambiaCosto(r.id, { testo: e.target.value })}
                  inputMode="decimal"
                  placeholder="€"
                  className={cn(CLASSE_CAMPO, "h-9 w-24 shrink-0 text-[14px] tabular-nums")}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 shrink-0 px-2 text-muted-foreground hover:text-rose-600"
                  onClick={() => onTogliCosto(r.id)}
                  title={`Togli «${r.titolo || "questa voce"}»`}
                  aria-label="Togli questa voce"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {prezzo > 0 && (
          <p className="mt-2 text-[11.5px] text-slate-600">
            Costi della pratica <span className="font-medium">{eur(totaleCosti)}</span> — resta{" "}
            <span className={cn("font-medium", margine < 0 ? "text-rose-700" : "text-emerald-700")}>
              {eur(margine)}
            </span>{" "}
            di margine, IVA esclusa. Non conta la pubblicità, che è una spesa del mese.
          </p>
        )}
      </div>

      {/* ── L'IVA DETTA, NON CHIESTA ──────────────────────────────────────
          ⚠️ Una riga di testo e non tre riquadri: la cifra che comanda è una
           sola — quella battuta sopra — e affiancarle un «netto» grande uguale
           faceva sembrare che il programma se ne prendesse un pezzo. Qui si
           dice soltanto quanta IVA c'è dentro, perché è quella che poi si versa
           e che la contabilità scorpora da sola. */}
      {contanteDelSaldo > 0 && (
        <p className="text-[11.5px] text-slate-600">
          Il cliente ha saldato <span className="font-medium">{eur(conto.totale)}</span>: è la cifra
          che entra in cassa.{" "}
          {conto.imposta > 0
            ? `Dentro ci sono ${eur(conto.imposta)} di IVA al ${conto.aliquota}%, scorporati nei conti — non li devi togliere tu.`
            : "Su questa pratica non c'è IVA da scorporare."}
        </p>
      )}

      {/* ── ⚠️ DA DOVE VIENE LA CIFRA PROPOSTA ────────────────────────────
            Segnalazione del committente: questa finestra non diceva niente di
            quello che era stato scritto registrando la vendita, e chi arrivava
            qui doveva riaprire l'altra schermata per sapere quanto restava.
            Adesso il conto è scritto per intero — prezzo, già versato, resta —
            e la cifra sopra parte da lì: si conferma, non si ricalcola a
            memoria. */}
      {prezzo > 0 && (
        <NotaFinestra>
          Il conto: prezzo {eur(prezzo)}
          {scontato > 0 ? `, sconto ${eur(scontato)}` : ""}
          {versato > 0 ? `, già versati ${eur(versato)}` : ", niente versato finora"} — resta{" "}
          {eur(Math.max(0, daSaldare - scontato))}. È la cifra proposta qui sopra: correggila se ha
          saldato diversamente.
          {contantiDichiarati > 0 && (
            <>
              {" "}
              Alla vendita erano stati dichiarati {eur(contantiDichiarati)} in contanti sul totale:
              di quella cifra vale la parte già entrata allora, il resto lo dice il campo «come è
              entrato» qui sopra.
            </>
          )}
        </NotaFinestra>
      )}
      {prezzo <= 0 && versato > 0 && (
        <NotaFinestra>
          Questo cliente aveva già versato {eur(versato)}: la cifra qui sopra si somma a quella.
        </NotaFinestra>
      )}
    </SezioneFinestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. QUALE GIORNO SI STA GUARDANDO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── UN SOLO MODO DI DIRE "QUESTA SETTIMANA" ──────────────────────────────
 *  Elenco e giornata del tecnico devono filtrare i giorni ALLO STESSO MODO: se
 *  ognuna avesse il suo selettore, "questa settimana" finirebbe per voler dire
 *  due cose diverse nelle due pagine e i totali non tornerebbero più. */
export type SceltaGiorno = "oggi" | "domani" | "settimana" | "data" | "tutte";

/** I giorni (AAAA-MM-GG) coperti da una scelta. `null` = nessun filtro. */
export function giorniScelti(scelta: SceltaGiorno, dataScelta: string): string[] | null {
  switch (scelta) {
    case "tutte":
      return null;
    case "oggi":
      return [giornoISO(0)];
    case "domani":
      return [giornoISO(1)];
    //  Sette giorni da oggi, non "da lunedì": chi prepara le pose ragiona sui
    //  prossimi sette giorni di lavoro, non sul calendario.
    case "settimana":
      return Array.from({ length: 7 }, (_, i) => giornoISO(i));
    case "data":
      return dataScelta ? [dataScelta] : [giornoISO(0)];
  }
}

/** La riga dei giorni: quattro scorciatoie e un calendario per il resto.
 *  I conteggi stanno sulla scorciatoia perché è la domanda che si fa davvero
 *  ("quante ne ho domani?"), e chiederla costringeva ad aprire il giorno.
 *
 *  SCEGLIERE UNA DATA È GIÀ CHIEDERE DI VEDERLA
 *  Il cambio di lente lo fa il componente, non chi lo monta: quando il selettore
 *  stava nelle pagine, ognuna si ricordava a modo suo di spostare anche la lente
 *  dopo aver scritto la data, e bastava dimenticarsene una volta per avere un
 *  calendario pieno e un elenco che mostrava ancora oggi. */
export function SelettoreGiorno({
  scelta,
  onScelta,
  dataScelta,
  onDataScelta,
  conteggi,
}: {
  scelta: SceltaGiorno;
  onScelta: (s: SceltaGiorno) => void;
  dataScelta: string;
  onDataScelta: (d: string) => void;
  conteggi: { oggi: number; domani: number; settimana: number; tutte: number };
}) {
  const scegliData = (v: string) => {
    onDataScelta(v);
    //  Cancellando la data non si resta su una lente senza giorno: si torna a
    //  oggi, che è il punto di partenza di questa pagina.
    onScelta(v ? "data" : "oggi");
  };

  return (
    <>
      <Segmento
        attivo={scelta === "oggi"}
        onClick={() => onScelta("oggi")}
        conteggio={conteggi.oggi}
      >
        Oggi
      </Segmento>
      <Segmento
        attivo={scelta === "domani"}
        onClick={() => onScelta("domani")}
        conteggio={conteggi.domani}
        titolo="Il giorno che si prepara stasera"
      >
        Domani
      </Segmento>
      <Segmento
        attivo={scelta === "settimana"}
        onClick={() => onScelta("settimana")}
        conteggio={conteggi.settimana}
        titolo="I prossimi sette giorni"
      >
        Settimana
      </Segmento>
      <Segmento
        attivo={scelta === "tutte"}
        onClick={() => onScelta("tutte")}
        conteggio={conteggi.tutte}
        titolo="Tutte le pose che hanno una data"
      >
        Tutte
      </Segmento>
      {/*  Stesso vestito del campo data dell'elenco installazioni: resta chiaro
          anche da attivo (lo dice il bordo), perché riempirlo di scuro come i
          segmenti nasconderebbe l'icona del calendario del browser, che è
          disegnata scura e non si può cambiare. */}
      <label
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-[12px]",
          scelta === "data"
            ? "border-foreground text-foreground ring-1 ring-foreground/20"
            : "border-border text-muted-foreground",
        )}
      >
        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Una data</span>
        <input
          type="date"
          value={dataScelta}
          onChange={(e) => scegliData(e.target.value)}
          className="bg-transparent text-[12px] tabular-nums text-foreground outline-none"
          aria-label="Scegli una data"
        />
      </label>
    </>
  );
}
