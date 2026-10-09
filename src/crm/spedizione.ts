/** ── COME LA PRATICA ARRIVA AL CLIENTE ─────────────────────────────────────
 *
 *  TRE MODI, UNA SCELTA SOLA
 *   · IN SEDE      → il cliente viene da noi: agenda, orario, tecnico.
 *   · A DOMICILIO  → si va a casa sua: occupa un tecnico per delle ore e HA
 *     un'ora, quindi resta NELL'AGENDA e nei conteggi del giorno come una posa
 *     in sede. In più ha due dati che una posa in sede non ha: l'indirizzo e il
 *     costo del viaggio.
 *   · SPEDIZIONE   → si imballa e parte: nessun tecnico, nessun orario. Fuori
 *     dall'agenda e dai conteggi — è l'unico dei tre che ne esce.
 *
 *  ⚠️ NON SONO DUE INTERRUTTORI. Un booleano "a domicilio" accanto a
 *  "da spedire" avrebbe permesso di accenderli tutti e due, e nessuno dei due
 *  posti che leggono questo dato avrebbe saputo dire cosa fosse quella pratica.
 *  È UN valore a tre.
 *  ⚠️ E non è nemmeno l'unico campo che parla di questo: `tipoInstallazione`
 *  esisteva da prima e nei suoi valori "taxi"/"indipendente" dice ancora
 *  «A domicilio»/«In sede». Non è stato lasciato a sé — si aggiorna insieme al
 *  modo (vedi tipoDaAllineare), altrimenti sarebbe l'interruttore in più che
 *  qui si è evitato di creare.
 *
 *  DOVE VIVE IL DATO
 *  Dentro `installazione.spedizione`, così una sola scrittura (updateLead con
 *  `installazione`) porta con sé anche il resto della posa e non c'è un secondo
 *  campo di primo livello da aggiungere al database. Il COSTO DEL VIAGGIO no:
 *  quello sta in `payment.costi`, insieme agli altri costi della pratica,
 *  perché è un'uscita e il netto lo deve sottrarre (vedi salvaCostoViaggio).
 *
 *  ── NIENTE SI PERDE DI CIÒ CHE È GIÀ SALVATO ──────────────────────────────
 *  Le pratiche esistenti non hanno `modo`: hanno solo il vecchio `daSpedire`.
 *  Si legge `modo` se c'è ED è uno dei tre, altrimenti si ricade sul booleano —
 *  quindi tutto l'archivio resta "in sede" o "spedizione" esattamente com'era.
 *  Ogni scrittura aggiorna I DUE CAMPI INSIEME: se domani qualcuno leggesse
 *  ancora `daSpedire` da solo, troverebbe la stessa verità.
 *  ───────────────────────────────────────────────────────────────────────── */
import { toast } from "sonner";
import { useCRM } from "./CRMContext";
import { oggiIso } from "./ui";
//  La tabella «quale stato dichiara quale consegna» sta in types.ts, accanto
//  agli stati: è la stessa che legge la finestra della chiusura e la rotta del
//  telefono del consulente. Qui si legge da là, non se ne tiene una copia —
//  due copie sono due copie che un giorno divergono.
import {
  MODO_CONSEGNA_DA_STATO,
  type InstallazioneInfo,
  type Lead,
  type LeadData,
  type LeadStatus,
  type PaymentInfo,
  type TipoInstallazione,
} from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   1. IL DATO
   ═════════════════════════════════════════════════════════════════════════ */

/** I tre modi in cui una pratica arriva al cliente. */
export type ModoConsegna = "sede" | "domicilio" | "spedizione";

const MODI: readonly string[] = ["sede", "domicilio", "spedizione"];

export interface SpedizioneInfo {
  /** come arriva al cliente. Assente sulle pratiche già salvate: lì lo dice
   *  `daSpedire` (vedi la nota in testa al file) */
  modo?: ModoConsegna;
  /** true = questa pratica si spedisce, non si posa. Resta scritto accanto a
   *  `modo` per non spegnere le pratiche salvate prima dei tre modi */
  daSpedire?: boolean;
  /** dove va consegnata: via, civico, CAP, città. Si scrive sulla riga, e vale
   *  sia per la spedizione sia per la posa a domicilio */
  indirizzo?: string;
  /** true = il pacco è partito */
  spedito?: boolean;
  /** giorno della partenza (AAAA-MM-GG) */
  dataSpedizione?: string;
  /** codice di tracciamento del corriere, se c'è */
  tracking?: string;
}

/** `installazione` con la spedizione. Il tipo in types.ts è allineato a questo:
 *  la variabile tipizzata serve comunque a scrivere senza letterali storti. */
export type InstallazioneConSpedizione = InstallazioneInfo & { spedizione?: SpedizioneInfo };

/* ═══════════════════════════════════════════════════════════════════════════
   2. LEGGERE — l'archivio importato può avere qualsiasi cosa in quel campo
   ═════════════════════════════════════════════════════════════════════════ */

/** La spedizione di una pratica, sempre in forma leggibile.
 *  ⚠️ Non si dà per scontato che sia un oggetto: negli archivi importati un
 *  campo può arrivare come stringa, come null o come array, e un accesso diretto
 *  a `.indirizzo` su un valore storto fa morire l'intera riga all'apertura. */
/** La stessa lettura a partire dai soli dati della scheda. Serve a chi compone
 *  la modifica DOPO la rilettura dall'archivio (vedi crm/patch-scheda): lì non
 *  si ha un `Lead`, si ha la scheda vera appena letta. */
export const spedizioneDaDati = (d: LeadData | null | undefined): Required<SpedizioneInfo> =>
  spedizioneDi(d ? ({ data: d } as Lead) : null);

export function spedizioneDi(l: Lead | null | undefined): Required<SpedizioneInfo> {
  const v = (l?.data?.installazione as InstallazioneConSpedizione | undefined)?.spedizione;
  const ok = !!v && typeof v === "object" && !Array.isArray(v);
  const testo = (x: unknown) => (typeof x === "string" ? x : "");
  //  Il modo scritto vale solo se è uno dei tre: un archivio che porta
  //  "DOMICILIO", " sede " o "boh" non deve inventare un quarto stato.
  const scritto = ok ? testo(v.modo).trim().toLowerCase() : "";
  const modo: ModoConsegna = MODI.includes(scritto)
    ? (scritto as ModoConsegna)
    : ok && v.daSpedire === true
      ? "spedizione"
      : "sede";
  return {
    modo,
    //  Ricavato dal modo, mai letto grezzo: così una pratica non può risultare
    //  insieme "a domicilio" e "da spedire".
    daSpedire: modo === "spedizione",
    indirizzo: ok ? testo(v.indirizzo) : "",
    spedito: ok && v.spedito === true,
    dataSpedizione: ok ? testo(v.dataSpedizione) : "",
    tracking: ok ? testo(v.tracking) : "",
  };
}

/** Come arriva al cliente. È l'unica domanda da fare: le tre risposte si
 *  escludono a vicenda. */
export function modoConsegna(l: Lead | null | undefined): ModoConsegna {
  return spedizioneDi(l).modo;
}

/** La pratica si spedisce: fuori dalle pose, dall'agenda e dai conteggi. */
export function daSpedire(l: Lead | null | undefined): boolean {
  return spedizioneDi(l).modo === "spedizione";
}

/** La posa si fa a casa del cliente. ⚠️ Resta una POSA: occupa un tecnico e ha
 *  un'ora, quindi NON va tolta dall'agenda né dai conteggi del giorno — è la
 *  differenza che separa questo caso da una spedizione. */
export function aDomicilio(l: Lead | null | undefined): boolean {
  return spedizioneDi(l).modo === "domicilio";
}

/** Il pacco è già partito. */
export function spedita(l: Lead | null | undefined): boolean {
  return spedizioneDi(l).spedito;
}

/** ── «NEL NOSTRO CENTRO»: LA POSA SI FA DA NOI ────────────────────────────
 *  Il terzo dei tre modi, e sta QUI insieme agli altri due — prima viveva
 *  dentro routes/CRM.installazioni.index, cioè in una pagina, e nessun altro
 *  poteva farsi la stessa domanda senza riscriverne il criterio. Adesso la
 *  lente della pagina e il badge del menu («Nel nostro centro», in CRMSidebar)
 *  leggono la stessa riga: erano proprio i due posti destinati a divergere.
 *
 *  ⚠️ SE LO STATO DICE ALTRO, VINCE LO STATO. Le pratiche che non hanno mai
 *  avuto il campo `modo` — cioè tutto l'archivio — ricevono "sede" per RIPIEGO,
 *  non per scelta di qualcuno (vedi spedizioneDi qui sopra). Quindi una vendita
 *  chiusa come «A domicilio» o «Da spedire» su cui nessuno ha ancora scritto il
 *  modo finirebbe qui dentro, e verrebbe preparata per una posa in centro mentre
 *  il cliente aspetta a casa sua. Un ripiego non deve mai vincere su una scelta
 *  dichiarata: quelle due righe escono da questa lente e restano dove le mette
 *  il loro stato.
 *
 *  ⚠️ QUESTA REGOLA VALE PER L'ARCHIVIO, NON PER RIPARARE I GESTI DI OGGI, e la
 *  differenza conta: una pratica in cui stato e modo si contraddicono va
 *  RIPARATA dove nasce la contraddizione, non nascosta da un filtro. Il ritorno
 *  indietro dello stato — che ne creava senza che nessuno potesse accorgersene,
 *  perché a schermo non cambiava niente — adesso sposta i due campi insieme
 *  (`consegnaDaAllineare`, più sotto in questo file).
 *  ⚠️ Ma NON è vero che ne resti solo l'archivio, e darlo per scontato farebbe
 *  cercare un guasto dove non c'è: il menu «…» («Come arriva al cliente») e la
 *  finestra della programmazione scrivono il MODO senza toccare lo stato, ed è
 *  giusto così — dire «questo glielo mandiamo» non è disdire la vendita. Una
 *  pratica chiusa «A domicilio» che dal menu viene rimessa «Si posa in sede»
 *  resta quindi fuori da questa lente finché lo stato dice altro: è il ripiego
 *  che non vince sulla scelta dichiarata, applicato anche alle righe di oggi.
 *  Si rimettono in pari richiudendola dalla finestra della chiusura, che stato e
 *  modo li scrive insieme (crm/ChiusuraDialog). Far leggere anche lo stato alle
 *  schede «A domicilio» e «Da spedire» sembrava la scorciatoia: avrebbe messo
 *  due regole diverse su «in quale scheda si vede questa riga», e un pacco
 *  pronto a partire sarebbe sparito dalla sua scheda per un cambio di stato che
 *  con il magazzino non c'entra niente. */
export function inNostroCentro(l: Lead): boolean {
  //  Lettura difensiva come nel resto del file: da quando la usa anche il badge,
  //  questa riga gira nella barra laterale — che sta sopra OGNI pagina del CRM —
  //  e una sola scheda arrivata a metà dall'import non deve far sparire il menu
  //  insieme alla pagina che si sta guardando.
  const stato = l?.data?.stato;
  if (stato === "posa_a_domicilio" || stato === "posa_da_spedire") return false;
  return modoConsegna(l) === "sede";
}

/** ── UNA SOLA DEFINIZIONE DI "HA L'INDIRIZZO" ─────────────────────────────
 *  L'indirizzo che conta è quello SCRITTO nella spedizione. La città della
 *  scheda è solo un suggerimento da cui partire (indirizzoProposto): finché
 *  nessuno la conferma non è un indirizzo di consegna, e trattarla come tale
 *  farebbe partire un pacco con sopra scritto "Milano".
 *  ⚠️ Un tempo qui c'erano due regole diverse — l'ordinamento guardava lo
 *  scritto, il pulsante "Spedisci" accettava la città — e la stessa riga
 *  risultava insieme "pronta da spedire" e "senza indirizzo". */
export function indirizzoScritto(l: Lead): string {
  return spedizioneDi(l).indirizzo.trim();
}

export function haIndirizzo(l: Lead): boolean {
  return indirizzoScritto(l).length > 0;
}

/** Cosa mettere DENTRO il campo dell'indirizzo: quello scritto se c'è,
 *  altrimenti la città della scheda — l'unico pezzo di indirizzo che l'archivio
 *  importato porta con sé. Ricopiarla a mano su duecento righe sarebbe lavoro
 *  inventato; confermarla è un tocco. */
export function indirizzoProposto(l: Lead): string {
  return indirizzoScritto(l) || String(l?.data?.citta || "").trim();
}

/** Le pose vere: tutto ciò che NON si spedisce. Usata dall'elenco, dalla
 *  giornata del tecnico e dall'agenda, così le tre pagine non possono
 *  disallinearsi su chi è una posa e chi è un pacco.
 *  ⚠️ LE POSE A DOMICILIO RESTANO DENTRO, ed è il punto di tutto: occupano un
 *  tecnico e hanno un'ora. Toglierle da qui le farebbe sparire dall'agenda e
 *  dalla giornata del tecnico, cioè manderebbe una persona a casa di un cliente
 *  senza che nessuna schermata lo sappia. */
export function soloPose(items: Lead[]): Lead[] {
  return Array.isArray(items) ? items.filter((l) => !daSpedire(l)) : [];
}

/* ═══════════════════════════════════════════════════════════════════════════
   2 bis. IL COSTO DEL VIAGGIO — è un'uscita, non un incasso
   ═════════════════════════════════════════════════════════════════════════ */

/** Il blocco costi della scheda, solo se è davvero un oggetto.
 *  ⚠️ Negli archivi importati `payment` e `costi` possono essere una stringa:
 *  fare lo spread di una stringa non dà errore, sparge le lettere dentro
 *  l'oggetto e salva una scheda illeggibile. */
function costiDi(l: Lead | null | undefined): Record<string, unknown> {
  const p = l?.data?.payment as unknown;
  if (!p || typeof p !== "object" || Array.isArray(p)) return {};
  const c = (p as { costi?: unknown }).costi;
  return c && typeof c === "object" && !Array.isArray(c) ? (c as Record<string, unknown>) : {};
}

/** Il pagamento della scheda, solo se è davvero un oggetto (vedi sopra). */
function pagamentoDi(l: Lead | null | undefined): PaymentInfo {
  const p = l?.data?.payment as unknown;
  return p && typeof p === "object" && !Array.isArray(p) ? (p as PaymentInfo) : {};
}

/** ── QUANTO COSTA ANDARE DAL CLIENTE ──────────────────────────────────────
 *  Benzina, pedaggi, ore di strada: si scrive solo sulle pose a domicilio.
 *  ⚠️ È UN COSTO. Non entra nel totale da incassare, non si somma al saldo del
 *  cliente e non compare in nessuno dei tre numeri della riga: sta in
 *  `payment.costi`, insieme a prodotto, installatore e taglio, che è il posto
 *  da cui il netto sottrae.
 *  La conversione è `Number()` secco come in kpi-netto.ts: una lettura più
 *  tollerante qui darebbe un numero e là zero, cioè due margini diversi nella
 *  stessa pagina. Quello che si scrive da questa app è sempre un numero — la
 *  virgola la scioglie leggiEuro PRIMA di arrivare qui. */
export function costoViaggio(l: Lead | null | undefined): number {
  const n = Number(costiDi(l).costoTrasferta);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Quanto costano i viaggi di un insieme di pose. Serve a dire il totale
 *  nell'intestazione della scheda — dove va detto che è un costo, perché un
 *  numero in euro accanto a un altro si legge come denaro che entra. */
export function totaleCostiViaggio(items: Lead[]): number {
  return Array.isArray(items) ? items.reduce((somma, l) => somma + costoViaggio(l), 0) : 0;
}

/** Le pratiche da spedire, in ordine di lavoro: prima quelle che devono ancora
 *  partire (e fra queste prima quelle senza indirizzo, che sono ferme per un
 *  dato mancante), poi quelle già spedite dalla più recente. */
export function ordinaSpedizioni(items: Lead[]): Lead[] {
  return [...items].sort((a, b) => {
    const sa = spedizioneDi(a);
    const sb = spedizioneDi(b);
    if (sa.spedito !== sb.spedito) return sa.spedito ? 1 : -1;
    if (!sa.spedito) {
      const ia = haIndirizzo(a) ? 1 : 0;
      const ib = haIndirizzo(b) ? 1 : 0;
      if (ia !== ib) return ia - ib;
      return String(a.data.cognome || "").localeCompare(String(b.data.cognome || ""));
    }
    return String(sb.dataSpedizione).localeCompare(String(sa.dataSpedizione));
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. SCRIVERE — ogni gesto lascia un "Annulla"
   ═════════════════════════════════════════════════════════════════════════ */

const nomeDi = (l: Lead) =>
  `${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim() || "questa pratica";

/** ── L'ALTRO CAMPO CHE DICE "A DOMICILIO" ─────────────────────────────────
 *  `installazione.tipoInstallazione` esiste da prima dei tre modi, e due dei
 *  suoi tre valori rispondono ALLA STESSA DOMANDA: ETICHETTA_TIPO stampa
 *  "taxi" come «A domicilio» e "indipendente" come «In sede». Lasciarlo
 *  indietro lo rende il secondo interruttore che questo file esiste per non
 *  avere: la scheda del cliente e la giornata del tecnico direbbero
 *  «A domicilio» su una pratica che si posa in sede — quindi senza indirizzo,
 *  senza costo del viaggio e fuori dalla scheda «A domicilio». È un tecnico
 *  che parte per un indirizzo che nessuno ha mai scritto.
 *  Si allinea NELLA STESSA scrittura del modo, e "Annulla" rimette
 *  l'installazione intera com'era, tipo compreso.
 *  Restituisce `undefined` quando non c'è niente da correggere: scrivere una
 *  chiave con lo stesso valore che ha già è una modifica finta.
 *
 *  ⚠️ È ESPORTATA perché non la usa più solo questo file. «Programma
 *  installazione» ha smesso di CHIEDERE il tipo di posa a mano — era il secondo
 *  interruttore descritto qui sopra, con l'aggravante che si poteva lasciare su
 *  «Da impostare» e rimettere in scheda una risposta che contraddiceva la
 *  consegna — e adesso lo RICAVA da qui prima di riscriverlo. Ricopiare le tre
 *  righe di questa funzione là dentro avrebbe rifatto in un altro modo lo stesso
 *  guasto: due copie della regola divergono al primo ritocco, e a divergere
 *  sarebbe di nuovo «questa posa è a domicilio oppure no». */
export function tipoDaAllineare(
  l: Lead,
  modo: ModoConsegna,
): { tipoInstallazione: TipoInstallazione } | undefined {
  const attuale = l.data.installazione?.tipoInstallazione;
  //  Un pacco NON ha una posa. Non si inventa "in sede" su qualcosa che non si
  //  posa: si toglie soltanto il "a domicilio" rimasto indietro, che sarebbe
  //  falso.
  const voluto: TipoInstallazione | undefined =
    modo === "domicilio"
      ? "taxi"
      : modo === "sede"
        ? "indipendente"
        : attuale === "taxi"
          ? "da_impostare"
          : undefined;
  return voluto && voluto !== attuale ? { tipoInstallazione: voluto } : undefined;
}

/** ── LO STATO E LA SCHEDA IN CUI SI VEDE LA RIGA DEVONO DIRE LA STESSA COSA ─
 *
 *  IL GUASTO CHE QUESTA FUNZIONE ESISTE PER CHIUDERE
 *  Le schede «A domicilio» e «Da spedire» non guardano lo stato: guardano il
 *  MODO (`aDomicilio`, `daSpedire`, qui sopra). Finché i due campi restano
 *  d'accordo la differenza non si vede. Si vede quando qualcuno riporta
 *  INDIETRO lo stato — la freccia «torna allo stato precedente» — e la pratica
 *  passa da «A domicilio» a «Nel nostro centro»: lo stato torna indietro, il
 *  modo no, e la riga resta identica nella scheda «A domicilio». Il messaggio
 *  dice che è stato salvato, lo schermo dice che non è successo niente, e chi
 *  guarda conclude che il pulsante è rotto. Dopo un gesto, quello che si vede
 *  deve essere quello che è successo.
 *
 *  COSA SI SPOSTA E COSA NO
 *  Si sposta la CLASSIFICAZIONE — `modo`, `daSpedire` e il `tipoInstallazione`
 *  che dice la stessa cosa con altre parole — e basta.
 *  ⚠️ NON SI CANCELLA NIENTE. L'indirizzo, il tracciamento e la data di
 *   partenza restano scritti dove sono; il costo del viaggio non viene nemmeno
 *   sfiorato, perché sta in `payment.costi`. Sono ore di lavoro di qualcuno, e
 *   soprattutto: se il ritorno indietro era l'errore, «Annulla» — o un secondo
 *   cambio di modo dal menu «…» — ritrova tutto al suo posto. Svuotare quei
 *   campi avrebbe reso irreversibile il gesto che serve a rendere reversibili
 *   gli altri.
 *  ⚠️ «NON SFIORATO» NON VUOL DIRE «SENZA CONSEGUENZE», e chi chiama questa
 *   funzione lo deve dire a schermo. Il costo del viaggio continua a essere
 *   sottratto dal margine di quella vendita (ricavoNetto in kpi-calcoli,
 *   costiDellaScheda in kpi-netto) anche quando la pratica non è più una
 *   trasferta, e il campo per leggerlo e correggerlo esiste SOLO dentro la
 *   scheda «A domicilio» — cioè proprio quella da cui la riga esce. Un'uscita
 *   che resta addosso a una vendita e non si vede da nessuna parte è il tipo di
 *   numero che si scopre a fine mese: qui non si tocca (sarebbe un gesto che ne
 *   cancella un altro), ma `raccontaConsegna` in crm/TornaIndietroPosa lo dice
 *   insieme al rimedio.
 *
 *  ⚠️ SOLO LE TRE CHIUSURE DICHIARANO UNA CONSEGNA. Tornando a «Appuntamento
 *   fissato» o «In valutazione» non si scrive niente e la pratica resta dov'è:
 *   quegli stati non dicono come arriva l'impianto, e ricavarne "sede" per
 *   ripiego sarebbe lo stesso errore che `inNostroCentro` (qui sopra) evita — un
 *   ripiego che vince su una scelta dichiarata, cioè un pacco pronto a partire
 *   che torna «in sede» da solo.
 *
 *  ⚠️ UN PACCO GIÀ PARTITO NON SI RICLASSIFICA, ed è il caso opposto: quello è
 *   un fatto avvenuto, non una prenotazione — esattamente come una posa già
 *   fatta. La riga resta fra le «Spedite», che è l'unico posto in cui si può
 *   ancora rispondere al cliente che chiede dov'è il suo pacco. Chi preme non
 *   deve scoprirlo dopo: glielo dice il messaggio (vedi
 *   `paccoPartitoNonSiSposta` e crm/TornaIndietroPosa).
 *
 *  Restituisce `undefined` quando non c'è niente da allineare — stato che non
 *  dichiara nulla, modo già d'accordo, pacco già partito — così il chiamante
 *  non scrive un'installazione uguale a sé stessa, che è una modifica finta che
 *  finisce comunque nello storico della scheda. */
export function consegnaDaAllineare(
  l: Lead,
  /** lo stato in cui la pratica STA ARRIVANDO. ⚠️ Non quello che si è chiesto:
   *  `applyAutoStatus` ha l'ultima parola e può portarla altrove */
  stato: LeadStatus,
  /** l'installazione che il chiamante sta già per scrivere, se ne ha una: il
   *  ritorno indietro può aver appena tolto la posa programmata, e ripartire da
   *  quella in scheda gliela rimetterebbe dentro */
  base?: InstallazioneConSpedizione,
):
  | { modo: ModoConsegna; installazione: InstallazioneConSpedizione; payment?: PaymentInfo }
  | undefined {
  const voluto = MODO_CONSEGNA_DA_STATO[stato];
  const sped = spedizioneDi(l);
  if (!voluto || voluto === sped.modo) return undefined;
  if (sped.modo === "spedizione" && sped.spedito) return undefined;
  //  ── ⚠️ IL COSTO DEL VIAGGIO SI AZZERA USCENDO DAL DOMICILIO ─────────────
  //  Deciso dal committente, e regge da sé: quel costo esiste perché qualcuno
  //  deve andare a casa del cliente. Se la pratica torna in sede o diventa un
  //  pacco, quel viaggio non si farà — e lasciarlo scritto significa tenere
  //  un'uscita a carico di una vendita per una trasferta che non esiste,
  //  invisibile in scheda (i campi si vedono solo dalla scheda «A domicilio»)
  //  ma ben visibile nel margine, che kpi-calcoli e kpi-netto sottraggono
  //  davvero. Un numero che nessuno può più vedere e che continua a togliere
  //  soldi ai conti è il tipo di sporcizia che si scopre a fine mese.
  //
  //  ⚠️ Si azzera SOLO uscendo dal domicilio, mai entrandoci: chi ci entra il
  //  viaggio deve ancora farlo. E si scrive `payment` solo in quel caso, così
  //  chi non c'entra non se lo vede riscritto sotto.
  const usciva = sped.modo === "domicilio" && voluto !== "domicilio";
  const viaggio = costoViaggio(l);
  const payment =
    usciva && viaggio > 0
      ? {
          ...(l.data.payment ?? {}),
          costi: { ...costiDi(l), costoTrasferta: 0 },
        }
      : undefined;

  return {
    modo: voluto,
    payment,
    installazione: {
      ...(base ?? (l.data.installazione as InstallazioneConSpedizione | undefined) ?? {}),
      ...tipoDaAllineare(l, voluto),
      //  La spedizione si riscrive INTERA a partire da quella letta: `modo` e
      //  `daSpedire` cambiano insieme — scriverne uno solo lascerebbe una
      //  pratica che dice due cose diverse a chi legge l'uno o l'altro — e
      //  tutto il resto passa di qui intatto.
      spedizione: { ...sped, modo: voluto, daSpedire: voluto === "spedizione" },
    },
  };
}

/** ── C'ERA DAVVERO UN PACCO IN MEZZO? ─────────────────────────────────────
 *  Vero quando sulla spedizione c'è del lavoro fatto da qualcuno — un
 *  indirizzo confermato o un codice di tracciamento — e il pacco non è ancora
 *  partito. Non cambia cosa si scrive: cambia cosa si DICE, perché una riga che
 *  esce dalla scheda «Da spedire» con dentro un indirizzo scritto a mano non
 *  può uscirne in silenzio. */
export function paccoInPreparazione(l: Lead): boolean {
  const s = spedizioneDi(l);
  return s.modo === "spedizione" && !s.spedito && (!!s.indirizzo.trim() || !!s.tracking.trim());
}

/** ── IL PACCO È PARTITO E LA RIGA NON SI MUOVE ────────────────────────────
 *  Vero quando lo stato in arrivo direbbe un'altra consegna ma il pacco è già
 *  partito: `consegnaDaAllineare` non tocca niente (è un fatto avvenuto) e la
 *  riga resta fra le «Spedite». È la sola combinazione in cui, dopo il gesto,
 *  lo schermo non cambia — quindi è la sola in cui va DETTO perché.
 *  La domanda si fa qui e non a occhio nel messaggio: la tabella
 *  stato → consegna si legge in un posto solo. */
export function paccoPartitoNonSiSposta(l: Lead, stato: LeadStatus): boolean {
  const voluto = MODO_CONSEGNA_DA_STATO[stato];
  const s = spedizioneDi(l);
  return !!voluto && voluto !== "spedizione" && s.modo === "spedizione" && s.spedito;
}

export function useAzioniSpedizione() {
  const { updateLead } = useCRM();

  /** Scrive un pezzo di spedizione SOMMANDOLO a quello che c'è già: data,
   *  orario, tecnico e note della posa non devono sparire perché si è corretto
   *  un civico. Restituisce l'installazione precedente, che è ciò che serve a
   *  "Annulla" per rimettere le cose com'erano. */
  const scrivi = async (
    l: Lead,
    patch: Partial<SpedizioneInfo>,
    /** altri campi dell'installazione da scrivere NELLA STESSA scrittura: due
     *  updateLead di fila leggerebbero il secondo da un `l` già vecchio, e il
     *  primo dei due risulterebbe non salvato */
    resto?: Partial<InstallazioneConSpedizione>,
  ) => {
    /*  ── ⚠️ SI COMPONE SULLA RIGA VERA, NON SU QUELLA A SCHERMO ────────
        Qui l'oggetto da scrivere si costruiva su `l.data.installazione`, cioè
        sulla copia in memoria del browser. `updateLead` rilegge la riga prima
        di salvare, ma non serve a niente se il pezzo è già stato composto su
        dati vecchi: correggere un civico cancellava il tecnico o il giorno
        della posa scritti da un altro un minuto prima.
        Adesso si passa il MODO di comporlo e lo esegue `updateLead` dopo la
        rilettura (vedi crm/patch-scheda). Vale anche per il «prima» che serve
        ad «Annulla»: rimettere una copia vecchia vorrebbe dire cancellare col
        tasto Annulla il lavoro di un collega. */
    //  ⚠️ Parte dalla copia a schermo e viene sostituito da quella vera: se
    //   il salvataggio non arriva mai a comporre la modifica — scheda sparita
    //   dall'archivio, lettura fallita — un «prima» vuoto farebbe scrivere ad
    //   «Annulla» un'installazione vuota, cioè cancellerebbe tecnico, giorno e
    //   spedizione invece di rimetterli. Nel caso peggiore fa quello che
    //   faceva ieri.
    let precedente: InstallazioneConSpedizione = { ...(l.data.installazione ?? {}) };
    await updateLead(l.id, (attuale) => {
      const base = (attuale.installazione ?? {}) as InstallazioneConSpedizione;
      precedente = { ...base };
      return {
        installazione: {
          ...base,
          ...resto,
          spedizione: { ...spedizioneDaDati(attuale), ...patch },
        },
      };
    });
    return precedente;
  };

  const annulla = (l: Lead, precedente: InstallazioneConSpedizione) => ({
    label: "Annulla",
    onClick: () => void updateLead(l.id, { installazione: precedente }),
  });

  /** Sposta la pratica fra i tre modi di consegna.
   *  Il messaggio dice DOVE è finita: una riga che sparisce dall'elenco senza
   *  spiegazione sembra un dato perso. */
  const segnaModoConsegna = async (l: Lead, modo: ModoConsegna) => {
    if (modoConsegna(l) === modo) return;
    //  ⚠️ Si scrivono `modo` E `daSpedire` insieme: il secondo è ciò che hanno
    //  le pratiche salvate prima dei tre modi, e lasciarlo indietro darebbe una
    //  scheda che dice "a domicilio" e un booleano che dice ancora "da
    //  spedire" — chi legge non saprebbe a quale credere.
    const precedente = await scrivi(
      l,
      { modo, daSpedire: modo === "spedizione" },
      tipoDaAllineare(l, modo),
    );
    const dove: Record<ModoConsegna, { titolo: string; nota: string }> = {
      sede: {
        titolo: `Si posa in sede · ${nomeDi(l)}`,
        nota: "Torna nell'elenco delle pose e nell'agenda.",
      },
      domicilio: {
        titolo: `A domicilio · ${nomeDi(l)}`,
        nota: "La trovi nella scheda «A domicilio». Resta in agenda: occupa un installatore e ha un'ora.",
      },
      spedizione: {
        titolo: `Da spedire · ${nomeDi(l)}`,
        nota: "La trovi nella scheda «Da spedire»: non occupa più un posto in agenda.",
      },
    };
    toast.success(dove[modo].titolo, {
      description: dove[modo].nota,
      action: annulla(l, precedente),
    });
  };

  /** L'indirizzo si salva uscendo dal campo, senza messaggio: è una correzione
   *  che si fa dieci volte di fila, e dieci notifiche di fila sono rumore. Chi
   *  scrive vede la conferma sulla riga stessa.
   *  Lo stesso campo serve al pacco e alla posa a domicilio: cambiando modo di
   *  consegna l'indirizzo già scritto resta dov'è, e non si riscrive due volte
   *  la stessa via. */
  const salvaIndirizzo = async (l: Lead, indirizzo: string) => {
    if (spedizioneDi(l).indirizzo === indirizzo) return;
    await scrivi(l, { indirizzo });
  };

  /** ── IL COSTO DEL VIAGGIO ────────────────────────────────────────────────
   *  Si scrive sulla riga come l'indirizzo, e finisce in `payment.costi`
   *  insieme agli altri costi della pratica.
   *  ⚠️ NON TOCCA NÉ IL PREZZO NÉ L'INCASSATO: `prezzoFinaleVendita`,
   *  `accontoPagato` e `saldoRimanente` restano quelli che erano. Sommarlo al
   *  totale farebbe pagare al cliente la nostra benzina e gonfierebbe la cassa
   *  di giornata di un costo.
   *  Nessun messaggio: è la stessa correzione ripetuta dell'indirizzo, e la
   *  conferma è la spunta sulla riga. */
  const salvaCostoViaggio = async (l: Lead, importo: number) => {
    const valore = Math.max(0, Number(importo) || 0);
    if (costoViaggio(l) === valore) return;
    const pagamento: PaymentInfo = {
      ...pagamentoDi(l),
      costi: { ...costiDi(l), costoTrasferta: valore },
    };
    await updateLead(l.id, { payment: pagamento });
  };

  const salvaTracking = async (l: Lead, tracking: string) => {
    if (spedizioneDi(l).tracking === tracking) return;
    await scrivi(l, { tracking });
  };

  /** Spedito: si segna la data da sola. Chiederla sarebbe una finestra in più
   *  per scrivere "oggi", che è la risposta nel 99% dei casi; se serve un altro
   *  giorno si corregge dal campo della data. */
  const segnaSpedito = async (l: Lead, valore: boolean) => {
    const precedente = await scrivi(l, {
      spedito: valore,
      dataSpedizione: valore ? spedizioneDi(l).dataSpedizione || oggiIso() : "",
    });
    toast.success(valore ? `Spedito · ${nomeDi(l)}` : `Di nuovo da spedire · ${nomeDi(l)}`, {
      action: annulla(l, precedente),
    });
  };

  /** Corregge il giorno della partenza. ⚠️ Svuotare il campo NON riporta il
   *  pacco fra quelli da spedire: quello è un cambio di sezione, si fa con il
   *  tasto "Spedito" (che lascia "Annulla") e non con una cancellazione
   *  distratta in un campo data, che sposterebbe una riga senza dire niente. */
  const cambiaDataSpedizione = async (l: Lead, dataSpedizione: string) => {
    if (!dataSpedizione) return;
    if (spedizioneDi(l).dataSpedizione === dataSpedizione) return;
    await scrivi(l, { dataSpedizione, spedito: true });
  };

  return {
    segnaModoConsegna,
    salvaIndirizzo,
    salvaCostoViaggio,
    salvaTracking,
    segnaSpedito,
    cambiaDataSpedizione,
  };
}
