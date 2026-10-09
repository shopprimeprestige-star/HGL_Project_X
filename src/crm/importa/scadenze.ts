/** ── LE SCADENZE DEL SETTER — LA REGOLA, IN UN POSTO SOLO ──────────────────
 *
 *  Questo file non disegna niente: prende i lead e le note scritte a mano e
 *  restituisce le righe della sotto-scheda «Oggi» di /CRM/importa, già divise
 *  per momento. È una funzione pura — stessi lead, stessa ora, stesso risultato
 *  — per la stessa ragione per cui lo è crm/dafare/righe.tsx: sul «che cosa
 *  entra nella giornata» si deve poter ragionare senza tirarsi dietro React.
 *
 *  ── DUE COSE, NON CINQUE ──────────────────────────────────────────────────
 *  Qui dentro entrano soltanto:
 *   · i RICHIAMI CONCORDATI — «la richiamo giovedì alle 15:30». C'è una data,
 *     spesso un'ora, e soprattutto c'è una promessa fatta a voce a una persona;
 *   · le NOTE INTERNE che il setter si scrive, con la loro scadenza.
 *  NON entrano le chiamate da rifare (non risponde, segreteria): quelle SONO la
 *  coda, stanno nella scheda accanto, e ripeterle qui vorrebbe dire due elenchi
 *  della stessa cosa che si contraddicono appena si segna un esito. Non entrano
 *  le consulenze da fissare né le chat: sono lavoro di consulenza, e la
 *  giornata intera del centro ha già la sua pagina (/CRM/dafare).
 *
 *  ⚠️ IL CALCOLO DELLE RIGHE NON SI RISCRIVE QUI. Chi entra, con che giorno,
 *   con che ora e con quale frase lo decide `costruisciRighe` di
 *   crm/dafare/righe.tsx, che è lo stesso motore della pagina «Da fare oggi» e
 *   che sa già fare la cosa più difficile: UNA PERSONA = UNA RIGA, anche quando
 *   la stessa scheda soddisfa due criteri. Qui si FILTRA il suo risultato e lo
 *   si divide in fasce. Riscriverne un pezzo vorrebbe dire che un giorno le due
 *   pagine dicono due orari diversi dello stesso richiamo.
 *  Anche le note a mano sono le STESSE: `crm/dafare/task-manuali` scrive in
 *  `app_config`, chiave `crm_dafare_task`. Una nota scritta da questa
 *  postazione si vede in /CRM/dafare, e viceversa. Un secondo elenco di note
 *  «del setter» sarebbe la prima cosa che i due posti si dicono diversa.
 *
 *  ── E UNA SCADUTA CHE NESSUNO HA FATTO? ───────────────────────────────────
 *  È la domanda che decide se questa scheda sarà ancora aperta fra due
 *  settimane. Un elenco che accumula scadute diventa illeggibile, e un elenco
 *  illeggibile non lo apre più nessuno: a quel punto le promesse mancate non
 *  sono «visibili», sono sepolte.
 *  La risposta è che una riga scaduta NON RESTA MAI IN CIMA PIÙ DI UN GIORNO, e
 *  non risale mai da sola. Scende di fascia, e il gesto che si chiede cambia
 *  insieme alla fascia:
 *
 *    ADESSO           è il momento (o lo era stamattina)  → CHIAMA
 *    PIÙ TARDI OGGI   ha un'ora che deve ancora arrivare  → conto alla rovescia
 *    OGGI, QUANDO CAPITA  ha il giorno ma non l'ora       → quando il telefono tace
 *    PROMESSA MANCATA  1-2 giorni fa                      → RIDAI UNA DATA
 *    DIMENTICATE      3 giorni fa o più                   → chiusa a fisarmonica
 *
 *  Il salto di senso è fra la terza e la quarta: alle 15:30 di ieri non si
 *  telefona più: quell'ora non esiste. Chiedere ancora «chiama alle 15:30» tre
 *  giorni dopo è la riga che insegna a ignorare l'elenco. Da lì in poi l'unico
 *  gesto onesto è ridare una data (o segnare che la persona non risponde più).
 *
 *  ⚠️ NIENTE SPARISCE, MAI. «Dimenticate» è chiusa, non tagliata: il suo numero
 *   si legge sempre, anche a fisarmonica chiusa, e la fascia se ne va da sola
 *   solo quando le righe vengono davvero lavorate. Una promessa che il
 *   programma butta via da solo dopo N giorni è esattamente il guasto che
 *   questa divisione serve a evitare: la persona resterebbe in archivio senza
 *   che nessuno la richiami e senza che nessuno lo sappia.
 *   È la stessa disciplina di `daPotare` in crm/dafare/task-manuali: si potano
 *   le righe FATTE, mai quelle rimaste aperte.
 *
 *  ⚠️ DENTRO QUELLE DUE FASCE L'ORDINE NON SI DECIDE QUI. Le fasce del passato
 *   sono le uniche che mescolano più giornate, quindi le uniche in cui «chi sta
 *   in cima» sia una domanda: la risposta — di partenza i più vicini a oggi, e
 *   il comando per girarla — sta in crm/dafare/arretrati, che è lo STESSO file
 *   da cui la prendono i due mucchi gemelli di /CRM/dafare. Le stesse parole
 *   nelle due pagine, e una preferenza sola: chi gira l'ordine qui lo ritrova
 *   girato di là.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Lead } from "@/crm/types";
import { giorniDaOggi, oggiIso } from "@/crm/ui";
import {
  attesaDi,
  costruisciRighe,
  ordinaRighe,
  type Attesa,
  type RigaDaFare,
} from "@/crm/dafare/righe";
import { ordinaArretrati, type VersoArretrati } from "@/crm/dafare/arretrati";
import type { TaskManuale } from "@/crm/dafare/task-manuali";

/** Le fasce, nell'ordine in cui compaiono a schermo. L'ordine È il messaggio:
 *  in cima quello su cui si può fare qualcosa ADESSO, in fondo quello su cui
 *  bisogna riprendere in mano il telefono con un'altra testa. */
export type Fascia = "adesso" | "piuTardi" | "quandoCapita" | "mancate" | "dimenticate" | "fatte";

export const FASCE: Fascia[] = [
  "adesso",
  "piuTardi",
  "quandoCapita",
  "mancate",
  "dimenticate",
  "fatte",
];

export const TITOLO_FASCIA: Record<Fascia, string> = {
  adesso: "Adesso",
  piuTardi: "Più tardi oggi",
  quandoCapita: "Oggi, quando capita",
  mancate: "Promesse mancate",
  dimenticate: "Dimenticate",
  fatte: "Fatte oggi",
};

export const NOTA_FASCIA: Record<Fascia, string> = {
  adesso: "È il momento — o lo era, e nessuno ha ancora chiamato",
  piuTardi: "Ha un'ora, e deve ancora arrivare",
  quandoCapita: "È di oggi ma non ha un orario: si fa quando il telefono è libero",
  mancate: "Il giorno promesso è passato: non si chiama a quell'ora, si ridà una data",
  dimenticate: "Ferme da giorni. Nessuno le sta lavorando",
  fatte: "Spuntate oggi: restano a vista fino a stasera",
};

/** Le fasce che vogliono dire «sei in ritardo». È l'elenco da cui nasce il
 *  numero grande della testata, e sta qui perché quella pagina non deve avere
 *  una sua idea di che cosa sia «scaduto»: una sola definizione, un solo
 *  numero. */
export const FASCE_IN_RITARDO: Fascia[] = ["adesso", "mancate", "dimenticate"];

/** ── I DUE MUCCHI DELL'ARRETRATO ───────────────────────────────────────────
 *  Le fasce fatte di righe il cui GIORNO è passato: sono le uniche che
 *  mescolano più giornate, quindi le uniche in cui l'ordine sia una domanda.
 *  Il verso con cui si leggono — e il perché di partenza si comincia dai più
 *  vicini a oggi — sta in crm/dafare/arretrati, insieme a quello dei due
 *  mucchi gemelli di /CRM/dafare: è lo stesso comando, con le stesse parole,
 *  perché è lo stesso lavoro guardato da un'altra finestra.
 *  ⚠️ «Adesso» non è qui dentro pur contando come ritardo (vedi
 *   FASCE_IN_RITARDO): quella è roba di OGGI la cui ora è passata, sta tutta
 *   nella stessa giornata e si legge in ordine di orologio. Rovesciarla
 *   vorrebbe dire chiamare le 17:00 prima delle 9:00.
 *  ⚠️ E nemmeno «Fatte oggi»: una cosa fatta non è arretrato. */
export const FASCE_ARRETRATE: Fascia[] = ["mancate", "dimenticate"];

/** Oltre questa attesa una promessa smette di essere una riga della giornata.
 *  Tre giorni, come `SALTATO_DA_TROPPO` in crm/importa/saltati — ed è lo stesso
 *  numero per lo stesso motivo: è il tempo in cui un contatto si raffredda e
 *  non si ricorda più di aver lasciato il numero. Due soglie diverse per la
 *  stessa idea di «troppo tempo» sarebbero due CRM in uno. */
export const SCADUTA_DA_TROPPO = 3;

/** Una riga della sotto-scheda: la riga del motore condiviso più le due cose
 *  che servono a disegnarla — in che fascia sta e da quanto è scaduta. */
export interface RigaScadenza {
  riga: RigaDaFare;
  fascia: Fascia;
  /** 0 = oggi, 1 = ieri, 2 = l'altro ieri… Mai negativo: le righe di domani in
   *  questa scheda non entrano proprio. */
  giorniIndietro: number;
  /** Il conto alla rovescia («fra 12 minuti»), con il tono già scelto. È `null`
   *  quando non c'è un'ora: senza un'ora non c'è niente da contare. */
  attesa: Attesa | null;
}

/** Quanti giorni fa, come lo direbbe una persona. `NaN` (data illeggibile,
 *  frequente negli archivi importati) vale «oggi» e non «mai»: la riga si vede
 *  comunque, perché una scadenza che non si riesce a leggere è precisamente
 *  quella che va guardata a mano. */
function giorniIndietroDi(giorno: string): number {
  const g = giorniDaOggi(giorno);
  return Number.isNaN(g) ? 0 : Math.max(0, -g);
}

/** ── LA REGOLA, IN UNA FUNZIONE ────────────────────────────────────────────
 *  Le righe già spuntate vanno tutte in fondo qualunque giorno abbiano: una
 *  cosa fatta non è più una scadenza, e vederla fra le scadute farebbe dubitare
 *  di tutte le altre.
 *  Per le altre decide PRIMA il giorno e POI l'orologio, e non il contrario:
 *  l'orologio di `attesaDi` ragiona in minuti e su una riga di tre giorni fa
 *  direbbe «era per le 15:30» — vero, e inutile. Il giorno è ciò che cambia il
 *  gesto da chiedere. */
export function fasciaDi(riga: RigaDaFare, attesa: Attesa | null, giorniIndietro: number): Fascia {
  if (riga.fatta) return "fatte";
  if (giorniIndietro >= SCADUTA_DA_TROPPO) return "dimenticate";
  if (giorniIndietro > 0) return "mancate";
  //  Da qui in giù è roba di oggi, e comanda l'orologio.
  if (!attesa) return "quandoCapita";
  //  `attesa` = manca ancora più di un quarto d'ora. Gli altri due toni ("ora"
  //  e "ritardo") vogliono dire tutti e due che il momento È ARRIVATO, ed è
  //  esattamente il salto in primo piano che si vuole: la riga cambia fascia da
  //  sola al passaggio dell'orologio, senza che nessuno tocchi niente.
  return attesa.tono === "attesa" ? "piuTardi" : "adesso";
}

export interface IngressoScadenze {
  leads: Lead[];
  task: TaskManuale[];
  /** L'istante di adesso, in millisecondi. Arriva dall'alto e non da un
   *  `Date.now()` letto qui dentro: due letture dell'orologio nella stessa
   *  passata darebbero due conti alla rovescia diversi sulla stessa schermata. */
  adesso: number;
}

/** Le righe della sotto-scheda, divise per fascia e ordinate dentro ognuna.
 *  Le fasce vuote NON compaiono nella mappa a valore vuoto: chi disegna
 *  scorre `FASCE` e salta quelle senza righe, così con tre scadenze si legge un
 *  elenco solo invece di sei intestazioni. */
export function calcolaScadenze({ leads, task, adesso }: IngressoScadenze): RigaScadenza[] {
  const oggi = oggiIso(new Date(adesso));
  //  ⚠️ QUI C'ERA `conArretrato: true`, E NON COMPILAVA. Era l'interruttore di
  //   una versione precedente del motore, che allora scartava da sé tutto ciò
  //   che è di ieri o prima; `costruisciRighe` non lo conosce più — costruisce
  //   OGNI riga con la sua data e lascia a chi chiama la scelta di quali fasce
  //   mostrare (il perché per esteso sta in crm/dafare/righe). A schermo non
  //   cambiava niente, ed è precisamente ciò che lo rendeva pericoloso: una
  //   proprietà in più che nessuno legge non fa rumore, ma era un errore di
  //   tipo (`npx tsc` in più sul conto base) e soprattutto il commento accanto
  //   giurava che senza quella riga le promesse mancate sparivano — cioè
  //   spiegava una regola che non esiste, che è il modo in cui il prossimo che
  //   passa di qui ha paura di toccare la riga giusta.
  //   L'arretrato arriva sempre, e le fasce «mancate»/«dimenticate» — che sono
  //   il motivo per cui questa scheda esiste — le decide `fasciaDi` qui sotto.
  const righe = costruisciRighe({ leads, task, ora: new Date(adesso) });

  const fuori: RigaScadenza[] = [];
  for (const riga of righe) {
    //  Due tipi e non cinque: vedi l'intestazione. Il filtro sta qui e non
    //  dentro il motore perché il motore serve anche alla pagina che li vuole
    //  tutti e cinque.
    if (riga.tipo !== "ricontatto" && riga.tipo !== "task") continue;
    //  Una riga di domani non è una scadenza di oggi. Il motore le lascia
    //  passare solo per i lead (le note a mano future le scarta già lui): un
    //  richiamo concordato per giovedì si vede giovedì, ed è la stessa promessa
    //  che tiene la coda pulita in `eDaChiamare`.
    if (riga.giorno > oggi) continue;
    const attesa = attesaDi(riga.istante, riga.ora, adesso);
    const giorniIndietro = giorniIndietroDi(riga.giorno);
    fuori.push({ riga, attesa, giorniIndietro, fascia: fasciaDi(riga, attesa, giorniIndietro) });
  }
  return fuori;
}

/** ── LE RIGHE DI UNA FASCIA, NELL'ORDINE GIUSTO PER QUELLA FASCIA ──────────
 *  Nelle fasce di oggi comanda l'orologio, che è `ordinaRighe` del motore
 *  condiviso. Nei due mucchi dell'arretrato comanda il `verso` che arriva
 *  dall'alto: quale sia, e perché di partenza si comincia dai più vicini a
 *  oggi, sta scritto in crm/dafare/arretrati.
 *
 *  ⚠️ QUI C'ERA UN SECONDO ORDINAMENTO SCRITTO A MANO — un `sort` su
 *   `giorniIndietro` con il nome a parità — e con esso il commento che
 *   prometteva «dentro Dimenticate si guarda PRIMA LA PIÙ VECCHIA, come
 *   `ordinaSaltati`». Erano due cose sbagliate insieme.
 *   La prima è che dava lo stesso risultato di `ordinaRighe` per una strada
 *   diversa (giorno passato più lontano = più giorni indietro), cioè teneva in
 *   piedi due regole d'ordine per la stessa idea: bastava che una delle due
 *   imparasse a mettere le spuntate in fondo perché le due pagine mostrassero
 *   la stessa fascia in due modi.
 *   La seconda è che la promessa non regge più: il verso è una scelta di chi
 *   guarda, e il paragone con `ordinaSaltati` vale solo per uno dei due versi —
 *   quello della pulizia, che infatti risponde alla stessa domanda («chi sta lì
 *   da troppo?»).
 *  ⚠️ `giorniIndietro` resta sulla riga: serve a scriverci sopra «era per ieri»
 *   (`ritardoLeggibile`), che è un'altra cosa dall'ordinarle. */
export function righeDi(
  tutte: RigaScadenza[],
  fascia: Fascia,
  verso: VersoArretrati,
): RigaScadenza[] {
  const mie = tutte.filter((r) => r.fascia === fascia);
  const nude = mie.map((r) => r.riga);
  const ordinate = FASCE_ARRETRATE.includes(fascia)
    ? ordinaArretrati(nude, verso)
    : ordinaRighe(nude);
  //  Si riordina la lista delle righe «vestite» seguendo l'ordine deciso dal
  //  motore: rifare qui il confronto vorrebbe dire avere due ordini possibili
  //  per la stessa fascia a seconda di chi la chiede.
  const posizione = new Map(ordinate.map((r, i) => [r.id, i]));
  return [...mie].sort((a, b) => (posizione.get(a.riga.id) ?? 0) - (posizione.get(b.riga.id) ?? 0));
}

/** Quante scadenze sono in ritardo, cioè quante promesse non sono state
 *  mantenute. È IL numero della pagina: quello che dice se si è in pari.
 *  Le righe fatte non ci sono dentro e le righe di più tardi nemmeno — un
 *  richiamo delle 17 alle 10 del mattino non è un ritardo, è un programma. */
export function contaInRitardo(tutte: RigaScadenza[]): number {
  return tutte.filter((r) => FASCE_IN_RITARDO.includes(r.fascia)).length;
}

/** Da quanto è scaduta, detto come lo direbbe una persona. Serve alle due
 *  fasce del passato, dove il conto alla rovescia in minuti non vuol più dire
 *  niente («in ritardo di 4.320 min» è una divisione da fare a mente). */
export function ritardoLeggibile(giorniIndietro: number): string {
  if (giorniIndietro <= 0) return "oggi";
  if (giorniIndietro === 1) return "era per ieri";
  //  ⚠️ QUI C'ERA «era per 3 giorni fa», che in italiano non si dice: «era per»
  //   regge un giorno («era per ieri», «era per giovedì»), non una distanza.
  //   Le parole sono quelle di `attesaRiga` in crm/dafare/righe — «da ieri» /
  //   «3 giorni fa» — perché le stesse due righe compaiono anche in /CRM/dafare
  //   e un ritardo raccontato con due vocabolari diversi si legge due volte.
  return `${giorniIndietro} giorni fa`;
}
